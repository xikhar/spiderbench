/**
 * Batches instanced tree canopy geometry for efficient rendering.
 *
 * @module world-canopy
 * @version 1.0.0
 * @file src/world/canopy.ts
 * @since 0.0.1
 * @description Creates and manages instanced canopy meshes and materials used by trees and rooftop foliage.
 */
import * as THREE from "three";
import { mulberry32 } from "./layout.ts";

const PAL = [
    [0.13, 0.16, 0.085],
    [0.15, 0.18, 0.1],
    [0.11, 0.145, 0.08],
    [0.17, 0.19, 0.11],
    [0.13, 0.165, 0.11],
    [0.25, 0.2, 0.09],
    [0.28, 0.17, 0.08],
    [0.2, 0.19, 0.1],
];

export class CanopyBatch {
    rnd: () => number;
    M: THREE.Matrix4[] = [];
    C: number[] = [];
    pal: number[][];
    fade: [number, number] | null;
    squash: number;
    shape: string;
    _geo: THREE.BufferGeometry | null = null;
    _mat: THREE.Material | null = null;

    constructor(seed = 1, opts: any = {}) {
        this.rnd = mulberry32(seed);
        this.pal = opts.palette ?? PAL;
        this.fade = opts.fade ?? null;
        this.squash = opts.squash ?? 1;
        this.shape = opts.shape ?? "blob";
    }
    add(
        x: number,
        y: number,
        z: number,
        r: number,
        autumn = 0.25,
        sq: number | null = null,
    ) {
        const rnd = this.rnd;
        const P = this.pal,
            c =
                P[
                    rnd() < autumn
                        ? 5 + Math.floor(rnd() * (P.length - 5))
                        : Math.floor(rnd() * 5)
                ],
            k = 0.8 + rnd() * 0.4;
        const sy = (0.75 + rnd() * 0.3) * (sq ?? this.squash),
            sx = r * (0.9 + rnd() * 0.2),
            sz = r * (0.9 + rnd() * 0.2);
        const m = new THREE.Matrix4().compose(
            new THREE.Vector3(x, y + r * sy * 0.9 + r * 0.35, z),
            new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                rnd() * 6.28,
            ),
            new THREE.Vector3(sx, r * sy, sz),
        );
        this.M.push(m);
        this.C.push(c[0] * k, c[1] * k, c[2] * k);
    }
    clump(
        x: number,
        y: number,
        z: number,
        R: number,
        n: number,
        rMin = 3,
        rMax = 6,
        autumn = 0.25,
    ) {
        for (let i = 0; i < n; i++) {
            const a = this.rnd() * Math.PI * 2,
                d = R * Math.sqrt(this.rnd());
            this.add(
                x + Math.cos(a) * d,
                y,
                z + Math.sin(a) * d,
                rMin + this.rnd() * (rMax - rMin),
                autumn,
            );
        }
    }
    get count() {
        return this.M.length;
    }
    build(
        scene: THREE.Scene,
        name = "canopy",
        castShadow = true,
        opts: any = {},
    ) {
        if (!this.M.length) return null;
        if (opts.tile) {
            const cells = new Map<string, number[]>(),
                _p = new THREE.Vector3();
            this.M.forEach((m, i) => {
                _p.setFromMatrixPosition(m);
                const k =
                    Math.floor(_p.x / opts.tile) +
                    "," +
                    Math.floor(_p.z / opts.tile);
                if (!cells.has(k)) cells.set(k, []);
                cells.get(k)!.push(i);
            });
            let first: THREE.InstancedMesh | null = null;
            for (const idx of cells.values()) {
                const sub = new CanopyBatch(1, {
                    palette: this.pal,
                    fade: this.fade,
                    squash: this.squash,
                    shape: this.shape,
                });
                sub.M = idx.map((i) => this.M[i]);
                sub.C = idx.flatMap((i) => [
                    this.C[i * 3],
                    this.C[i * 3 + 1],
                    this.C[i * 3 + 2],
                ]);
                (sub as any)._geo = this._geo;
                (sub as any)._mat = this._mat;
                const m = sub.build(scene, name, castShadow, {
                    smallCasters: opts.smallCasters,
                });
                this._geo = (sub as any)._geo;
                this._mat = (sub as any)._mat;
                first ??= m as THREE.InstancedMesh;
            }
            return first;
        }
        const geo =
            this._geo ??
            (this.shape === "cone"
                ? new THREE.ConeGeometry(0.62, 2.3, 7, 3).translate(0, 0.25, 0)
                : new THREE.IcosahedronGeometry(1, 0));
        if (!this._geo) {
            const pos = geo.attributes.position as THREE.BufferAttribute,
                rnd = mulberry32(3);
            const bump = new Map<string, number>();
            for (let i = 0; i < pos.count; i++) {
                const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
                if (!bump.has(key)) bump.set(key, 0.85 + rnd() * 0.3);
                const b = bump.get(key)!;
                pos.setXYZ(
                    i,
                    pos.getX(i) * b,
                    pos.getY(i) * b,
                    pos.getZ(i) * b,
                );
            }
            const nrm = geo.attributes.normal as THREE.BufferAttribute;
            for (let i = 0; i < pos.count; i++) {
                const l = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
                nrm.setXYZ(
                    i,
                    pos.getX(i) / l,
                    pos.getY(i) / l,
                    pos.getZ(i) / l,
                );
            }
            this._geo = geo;
        }
        if (this._mat)
            return this._inst(scene, name, castShadow, geo, this._mat, opts);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.95,
            metalness: 0,
            flatShading: false,
        }) as any;
        this._mat = mat;
        const fade = this.fade;
        mat.onBeforeCompile = (sh: any) => {
            sh.vertexShader = sh.vertexShader
                .replace(
                    "#include <common>",
                    "#include <common>\nvarying float vCy; varying vec3 vCn; varying vec3 vCi;",
                )
                .replace(
                    "#include <begin_vertex>",
                    `#include <begin_vertex>
          vCy = position.y; vCn = normal; vCi = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          ${
              fade
                  ? `{ vec3 ic = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float fs = smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, length(ic - cameraPosition)); transformed *= max(fs, 1e-3); }`
                  : ""
          }`,
                );
            sh.fragmentShader = sh.fragmentShader
                .replace(
                    "#include <common>",
                    `#include <common>
          varying float vCy; varying vec3 vCn; varying vec3 vCi; float cClump;
          float cH3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
          float cVn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(cH3(i), cH3(i + vec3(1, 0, 0)), f.x), mix(cH3(i + vec3(0, 1, 0)), cH3(i + vec3(1, 1, 0)), f.x), f.y),
                       mix(mix(cH3(i + vec3(0, 0, 1)), cH3(i + vec3(1, 0, 1)), f.x), mix(cH3(i + vec3(0, 1, 1)), cH3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`,
                )
                .replace(
                    "#include <color_fragment>",
                    `#include <color_fragment>
          diffuseColor.rgb *= mix(0.45, 1.05, smoothstep(-0.9, 0.7, vCy));
          diffuseColor.rgb *= 0.92 + 0.16 * fract(sin(dot(floor(vCn * 2.0 + 0.5), vec3(12.9, 78.2, 37.7))) * 4375.5);
          cClump = cVn(vCn * 3.3 + vCi * 0.137) * 0.62 + cVn(vCn * 7.9 + vCi * 0.291) * 0.38;
          diffuseColor.rgb *= mix(0.58, 1.1, smoothstep(0.28, 0.72, cClump));`,
                )
                .replace(
                    "#include <normal_fragment_maps>",
                    `#include <normal_fragment_maps>
          { vec3 sx = normalize(dFdx(-vViewPosition)), sy = normalize(dFdy(-vViewPosition));
            vec2 dh = vec2(dFdx(cClump), dFdy(cClump)) * 2.2;
            vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
            vec3 bn = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
            if (det != 0.0) normal = bn; }`,
                );
        };
        mat.customProgramCacheKey = () =>
            "far-canopy-v2" + (fade ? fade.join(",") : "") + this.shape;
        return this._inst(scene, name, castShadow, geo, mat, opts);
    }
    _inst(
        scene: THREE.Scene,
        name: string,
        castShadow: boolean,
        geo: THREE.BufferGeometry,
        mat: THREE.Material,
        opts: any,
    ) {
        const mesh = new THREE.InstancedMesh(geo, mat, this.M.length);
        const col = new THREE.Color();
        for (let i = 0; i < this.M.length; i++) {
            mesh.setMatrixAt(i, this.M[i]);
            mesh.setColorAt(
                i,
                col.setRGB(this.C[i * 3], this.C[i * 3 + 1], this.C[i * 3 + 2]),
            );
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = castShadow && !this.fade;
        mesh.receiveShadow = true;
        mesh.name = name;
        if (opts.smallCasters) (mesh.userData as any).smallCasters = true;
        scene.add(mesh);
        return mesh;
    }
}
