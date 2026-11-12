/**
 * Provides instanced pooling and LOD-aware rendering utilities.
 *
 * @module world-pool
 * @version 1.0.0
 * @file src/world/pool.ts
 * @since 0.0.1
 * @description Implements reusable instanced mesh pools and distance-fade helpers for efficiently rendering repeated world objects.
 */
import * as THREE from "three";
import { csmShared } from "@/render/csm.ts";
import { perf2Off } from "./tilebatch.ts";
const NOWEDGE = perf2Off("nowedge");

const LOD_VERT_PARS = `attribute vec4 aLod; varying float vLodIn; varying float vLodOut;`;
const LOD_VERT = `
  #ifdef USE_INSTANCING
  {
    vec3 lodP = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
    float lodD = length(lodP.xz - cameraPosition.xz);
    vLodIn = aLod.y > aLod.x ? clamp((lodD - aLod.x) / (aLod.y - aLod.x), 0.0, 1.0) : 1.0;
    vLodOut = aLod.w > aLod.z ? clamp((aLod.w - lodD) / (aLod.w - aLod.z), 0.0, 1.0) : 1.0;
  }
  #else
  vLodIn = 1.0; vLodOut = 1.0;
  #endif`;
const LOD_FRAG_PARS = `varying float vLodIn; varying float vLodOut; uniform vec4 uLodFrame;
  float lodIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`;
const LOD_FRAG = `{
    float lodN = fract(lodIGN(gl_FragCoord.xy) + uLodFrame.x * 1.618034);
    if (lodN >= vLodOut || lodN < 1.0 - vLodIn) discard;
  }`;

export function applyLodFade(mat: any) {
    if (!mat || mat.userData.lodFade) return mat;
    mat.userData.lodFade = true;
    const prev = mat.onBeforeCompile,
        prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh: any, r: any) => {
        prev?.call(mat, sh, r);
        sh.uniforms.uLodFrame = { value: csmShared.params };
        sh.vertexShader = sh.vertexShader
            .replace("#include <common>", "#include <common>\n" + LOD_VERT_PARS)
            .replace(
                "#include <project_vertex>",
                "#include <project_vertex>\n" + LOD_VERT,
            );
        sh.fragmentShader = sh.fragmentShader
            .replace("#include <common>", "#include <common>\n" + LOD_FRAG_PARS)
            .replace(
                "#include <clipping_planes_fragment>",
                "#include <clipping_planes_fragment>\n" + LOD_FRAG,
            );
    };
    mat.customProgramCacheKey = () =>
        (prevKey ? prevKey.call(mat) : "") + "|lodfade1";
    mat.needsUpdate = true;
    return mat;
}

const _m = new THREE.Matrix4(),
    _q = new THREE.Quaternion(),
    _p = new THREE.Vector3(),
    _s = new THREE.Vector3(),
    _e = new THREE.Euler();

const GRIDS = new WeakMap<any, any>();

export class Pool {
    static sortF2B = !(
        typeof location !== "undefined" &&
        new URLSearchParams(location.search).has("nof2b")
    );
    static sortMax = 20000;
    static _key: Float64Array | null = null;

    geo: THREE.BufferGeometry;
    mat: THREE.Material;
    max: number;
    near: number;
    far: number;
    fadeIn: number;
    fadeOut: number;
    isStatic: boolean;
    shadowFar: number;
    nShadow = 0;
    items: any[] = [];
    extraDefs: Record<string, number>;
    mesh: THREE.InstancedMesh;
    extra: Record<string, THREE.InstancedBufferAttribute>;
    last = new THREE.Vector3(1e9, 0, 0);
    sel = new Int32Array(0);
    grid: Map<number, number[]> | null = null;
    gridN = 0;
    dirty = false;
    written = -1;
    vOn = false;
    vx = 0;
    vz = 0;

    constructor(
        geo: THREE.BufferGeometry,
        mat: THREE.Material,
        {
            max = 1024,
            near = 0,
            far = 400,
            castShadow = true,
            receiveShadow = true,
            extra = {} as Record<string, number>,
            color = false,
            name = "",
            fadeIn = 0,
            fadeOut = null as number | null,
            isStatic = false,
            shadowFar = null as number | null,
            smallCasters = false,
        } = {},
    ) {
        this.geo = geo;
        this.mat = mat;
        this.max = max;
        this.near = near;
        this.far = far;
        this.fadeIn = near > 0 ? fadeIn || Math.max(10, near * 0.08) : 0;
        this.fadeOut = fadeOut ?? Math.max(10, far * 0.08);
        this.isStatic = isStatic;
        this.shadowFar = Math.min(far, shadowFar ?? 160);
        extra = { ...extra, aLod: 4 };
        applyLodFade(mat);
        this.extraDefs = extra;
        this.mesh = new THREE.InstancedMesh(geo, mat, max);
        this.mesh.name = name;
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = castShadow;
        this.mesh.receiveShadow = receiveShadow;
        if (smallCasters) (this.mesh.userData as any).smallCasters = true;
        let saved = 0;
        (this.mesh as any).onBeforeShadow = () => {
            saved = this.mesh.count;
            this.mesh.count = Math.min(saved, this.nShadow);
        };
        (this.mesh as any).onAfterShadow = () => {
            this.mesh.count = saved;
        };
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (color) {
            this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
                new Float32Array(max * 3),
                3,
            );
            this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        }
        this.extra = {};
        for (const [k, n] of Object.entries(extra)) {
            const a = new THREE.InstancedBufferAttribute(
                new Float32Array(max * n),
                n,
            );
            a.setUsage(THREE.DynamicDrawUsage);
            geo.setAttribute(k, a);
            this.extra[k] = a;
        }
        this.sel = new Int32Array(max);
    }
    add(
        x: number,
        y: number,
        z: number,
        ry = 0,
        s = 1,
        color: number[] | null = null,
        extra: any = null,
        scale3: number[] | null = null,
    ) {
        const it = { x, y, z, ry, s, color, extra, scale3 } as any;
        this.items.push(it);
        return it;
    }
    hide(it: any) {
        it.hidden = true;
        this.last.set(1e9, 0, 0);
        this.written = -1;
    }
    show(it: any) {
        it.hidden = false;
        this.last.set(1e9, 0, 0);
        this.written = -1;
    }
    write(k: number, it: any) {
        const lod = this.extra.aLod;
        if (lod)
            lod.setXYZW(
                k,
                this.near - this.fadeIn,
                this.near,
                this.far - this.fadeOut,
                this.far,
            );
        _p.set(it.x, it.y, it.z);
        _q.setFromAxisAngle((THREE.Object3D as any).DEFAULT_UP, it.ry);
        if (it.rx || it.rz) {
            _e.set(it.rx || 0, it.ry, it.rz || 0, "YXZ");
            _q.setFromEuler(_e);
        }
        if (it.scale3)
            _s.set(
                it.scale3[0] * it.s,
                it.scale3[1] * it.s,
                it.scale3[2] * it.s,
            );
        else _s.set(it.s, it.s, it.s);
        if (it.hidden) _s.set(0, 0, 0);
        _m.compose(_p, _q, _s);
        this.mesh.setMatrixAt(k, _m);
        if (it.color && this.mesh.instanceColor)
            this.mesh.instanceColor.setXYZ(
                k,
                it.color[0],
                it.color[1],
                it.color[2],
            );
        if (it.extra)
            for (const key in it.extra) {
                const a = this.extra[key];
                if (!a) continue;
                const v = it.extra[key];
                if (a.itemSize === 1) a.setX(k, v);
                else (a.array as Float32Array).set(v, k * a.itemSize);
            }
    }
    buildGrid() {
        const cached = GRIDS.get(this.items);
        if (cached && cached.n === this.items.length && !this.dirty) {
            this.grid = cached.g;
            this.gridN = cached.n;
            return;
        }
        const C = 64,
            g = new Map<number, number[]>();
        for (let i = 0; i < this.items.length; i++) {
            const it = this.items[i];
            const key = Math.floor(it.x / C) * 100003 + Math.floor(it.z / C);
            let a = g.get(key);
            if (!a) g.set(key, (a = []));
            a.push(i);
        }
        this.grid = g;
        this.gridN = this.items.length;
        this.dirty = false;
        GRIDS.set(this.items, { g, n: this.items.length });
    }
    due(cam: THREE.Object3D | THREE.Camera) {
        return this.isStatic
            ? this.written !== this.items.length || this.dirty
            : (cam as any).distanceToSquared(this.last) >= this.thresh() ** 2 ||
                  this.viewDue();
    }
    viewDue() {
        const V = (csmShared as any).view;
        if (NOWEDGE || !V || !this.far || this.far <= this.shadowFar)
            return false;
        const on = V.cos > -1;
        if (on !== !!this.vOn) return true;
        return on && V.x * this.vx + V.z * this.vz < 0.94;
    }
    thresh() {
        return Math.max(6, Math.min(40, this.far * 0.02));
    }
    update(cam: any, force = false, moveThresh = this.thresh()) {
        if (this.isStatic) {
            if (this.written === this.items.length && !force && !this.dirty)
                return;
            const n = Math.min(this.max, this.items.length);
            for (let k = 0; k < n; k++) this.write(k, this.items[k]);
            this.mesh.count = n;
            this.nShadow = this.shadowFar >= this.far ? n : 0;
            this.written = this.items.length;
            this.dirty = false;
            this.mesh.visible = n > 0;
            this.upload(n);
            return;
        }
        if (
            !force &&
            cam.distanceToSquared(this.last) < moveThresh * moveThresh &&
            !this.viewDue()
        )
            return;
        this.last.copy(cam.position || cam);
        const V = (csmShared as any).view,
            wedge = !NOWEDGE && !!V && V.cos > -1 && this.far > this.shadowFar;
        this.vOn = wedge;
        if (wedge) {
            this.vx = V.x;
            this.vz = V.z;
        }
        const wc = wedge ? V.cos : -2,
            wx = wedge ? V.x : 0,
            wz = wedge ? V.z : 0,
            w2 = (this.shadowFar + moveThresh) ** 2;
        if (!this.grid || this.dirty || this.gridN !== this.items.length)
            this.buildGrid();
        const nr = Math.max(0, this.near - this.fadeIn - moveThresh),
            fr = this.far + moveThresh;
        const n2 = nr * nr,
            f2 = fr * fr;
        let k = 0;
        const items = this.items;
        const cand: number[] = [];
        const C = 64,
            r = Math.ceil(fr / C);
        const cx = Math.floor(cam.x / C),
            cz = Math.floor(cam.z / C);
        for (let gx = cx - r; gx <= cx + r; gx++)
            for (let gz = cz - r; gz <= cz + r; gz++) {
                const cell = this.grid!.get(gx * 100003 + gz);
                if (!cell) continue;
                for (const i of cell) {
                    const it = items[i];
                    const dx = it.x - cam.x,
                        dz = it.z - cam.z;
                    const d2 = dx * dx + dz * dz;
                    if (
                        d2 >= n2 &&
                        d2 < f2 &&
                        (d2 < w2 || dx * wx + dz * wz >= wc * Math.sqrt(d2))
                    )
                        cand.push(i, d2);
                }
            }
        const s2 = (this.shadowFar + moveThresh) ** 2;
        if (cand.length / 2 > this.max) {
            const idx: number[] = [];
            for (let i = 0; i < cand.length; i += 2) idx.push(i);
            idx.sort((a, b) => cand[a + 1] - cand[b + 1]);
            let ns = 0;
            for (let j = 0; j < this.max; j++) {
                if (cand[idx[j] + 1] < s2) ns = j + 1;
                this.write(k++, items[cand[idx[j]]]);
            }
            this.nShadow = ns;
        } else if (Pool.sortF2B && cand.length / 2 <= Pool.sortMax) {
            const n = cand.length >> 1;
            const key =
                Pool._key && Pool._key.length >= n
                    ? Pool._key
                    : (Pool._key = new Float64Array(Math.max(n, 4096)));
            let ns = 0;
            for (let j = 0; j < n; j++) {
                const d2 = cand[2 * j + 1],
                    sh = d2 < s2;
                if (sh) ns++;
                key[j] = (Math.floor(d2) * 2 + (sh ? 0 : 1)) * 1048576 + j;
            }
            const ks = key.subarray(0, n).sort();
            for (let j = 0; j < n; j++)
                this.write(k++, items[cand[2 * (ks[j] % 1048576)]]);
            this.nShadow = ns;
        } else {
            for (let i = 0; i < cand.length; i += 2)
                if (cand[i + 1] < s2) this.write(k++, items[cand[i]]);
            this.nShadow = k;
            for (let i = 0; i < cand.length; i += 2)
                if (cand[i + 1] >= s2) this.write(k++, items[cand[i]]);
        }
        this.mesh.count = k;
        this.mesh.visible = k > 0;
        this.upload(k);
    }
    upload(n: number) {
        if (!n) return;
        const set = (a: any, w: number) => {
            a.clearUpdateRanges();
            a.addUpdateRange(0, n * w);
            a.needsUpdate = true;
        };
        set(this.mesh.instanceMatrix, 16);
        if (this.mesh.instanceColor) set(this.mesh.instanceColor, 3);
        for (const a of Object.values(this.extra)) set(a, (a as any).itemSize);
    }
}

export function applyDistanceFade(mat: any, d0: number, d1: number) {
    if (!mat || mat.userData.distFade) return mat;
    mat.userData.distFade = true;
    const prev = mat.onBeforeCompile,
        prevKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh: any, r: any) => {
        prev?.call(mat, sh, r);
        sh.uniforms.uLodFrame = sh.uniforms.uLodFrame || {
            value: csmShared.params,
        };
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying float vDistFade;",
            )
            .replace(
                "#include <project_vertex>",
                `#include <project_vertex>
        { vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz; vDistFade = clamp((${d1.toFixed(1)} - length(wp.xz - cameraPosition.xz)) / ${(d1 - d0).toFixed(1)}, 0.0, 1.0); }`,
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      varying float vDistFade; uniform vec4 uLodFrame;
      float dfIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`,
            )
            .replace(
                "#include <clipping_planes_fragment>",
                `#include <clipping_planes_fragment>
        if (vDistFade < 0.999 && fract(dfIGN(gl_FragCoord.xy + 7.0) + uLodFrame.x * 1.618034) >= vDistFade) discard;`,
            );
    };
    mat.customProgramCacheKey = () =>
        (prevKey ? prevKey.call(mat) : "") + `|distfade${d0}-${d1}`;
    mat.needsUpdate = true;
    return mat;
}
