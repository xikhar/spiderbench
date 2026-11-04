// @ts-nocheck
// Distance-culled instancing: one InstancedMesh per prop type; the instances near the camera
// are repacked every time the camera moves a few metres (static props) or every frame (dynamic sets).
import { lazyShaderSections } from "../shaderSections.ts";
import poolShaderSource from "./shaders/glsl/pool.glsl?raw";
import { injectShader } from "../render/shaderInjection.ts";
import * as THREE from "three";
import { cascadedShadowState } from "../render/cascadedShadows.ts";
import { getQuality } from "../render/quality.ts";
import { isPerformanceFeatureDisabled } from "./performanceFlags.ts";

const poolShader = lazyShaderSections(() => poolShaderSource);
const isViewWedgeDisabled = isPerformanceFeatureDisabled("nowedge");

// ---- dithered LOD fades. Every Pool writes a per-instance aLod = (in0, in1, out0, out1) (horizontal camera distance):
// the instance fades IN over [in0, in1] and OUT over [out0, out1] by a screen-space dither (interleaved gradient noise
// + the per-frame offset the CSM already animates, so TAA resolves it into a smooth cross-fade). A near LOD fading out
// over [a, b] and a far LOD fading in over the same [a, b] use complementary dither thresholds -> no hole, no double.
// The distance is computed per vertex from the live camera, so fades are continuous even though pools only repack
// after the camera has moved a few metres (pools include instances out to far + fade margin).
const LOD_VERT_PARS = poolShader.lodVertexDeclarations;
const LOD_VERT = poolShader.lodVertexFade;
const LOD_FRAG_PARS = poolShader.lodFragmentDeclarations;
const LOD_FRAG = poolShader.lodFragmentFade;
export function applyLodFade(mat) {
  if (!mat || mat.userData.lodFade) return mat;
  mat.userData.lodFade = true;
  const prev = mat.onBeforeCompile,
    prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uLodFrame = { value: cascadedShadowState.params };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>",injectShader(poolShader.vertexCommon, LOD_VERT_PARS))
      .replace(
        "#include <project_vertex>",injectShader(poolShader.vertexProjectVertex, LOD_VERT),
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>",injectShader(poolShader.fragmentCommon, LOD_FRAG_PARS))
      .replace(
        "#include <clipping_planes_fragment>",injectShader(poolShader.fragmentClipping, LOD_FRAG),
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

const GRIDS = new WeakMap();

export class Pool {
  static sortF2B = !new URLSearchParams(location.search).has("nof2b");
  static sortMax = 20000; // (perf r3) A/B: ?nof2b
  // extra: {name: itemSize} per-instance attributes
  // fadeIn / fadeOut: widths (m) of the dithered fades over [near - fadeIn, near] and [far - fadeOut, far]. The defaults
  // (8% of the distance, >= 10 m) match between a near LOD (far = X) and its far LOD (near = X) -> complementary bands.
  // static: true -> all items are written once (no distance culling, no cap): far LODs that span the whole map.
  constructor(
    geo,
    mat,
    {
      max = 1024,
      near = 0,
      far = 400,
      castShadow = true,
      receiveShadow = true,
      extra = {},
      color = false,
      name = "",
      fadeIn = 0,
      fadeOut = null,
      isStatic = false,
      shadowFar = null,
      smallCasters = false,
    } = {},
  ) {
    const lodScale = isStatic ? 1 : getQuality().lodScale;
    this.geo = geo;
    this.mat = mat;
    this.max = max;
    this.near = near * lodScale;
    this.far = far * lodScale;
    this.fadeIn = this.near > 0 ? fadeIn * lodScale || Math.max(10, this.near * 0.08) : 0;
    this.fadeOut = fadeOut == null ? Math.max(10, this.far * 0.08) : fadeOut * lodScale;
    this.isStatic = isStatic;
    // shadow casting only for instances within shadowFar of the camera (default 160 m, never beyond `far`): the
    // instances are written nearest-shadow-casters-first and the shadow passes draw only that prefix (onBeforeShadow)
    this.shadowFar = Math.min(this.far, (shadowFar ?? 160) * lodScale);
    this.nShadow = 0;
    extra = { ...extra, aLod: 4 };
    applyLodFade(mat);
    this.items = []; // {x,y,z,ry,s,sx?,sy?,sz?,color?,extra:{}}
    this.extraDefs = extra;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.name = name;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = receiveShadow;
    if (smallCasters) this.mesh.userData.smallCasters = true; // CSM: skip in the far cascades
    let saved = 0;
    this.mesh.onBeforeShadow = () => {
      saved = this.mesh.count;
      this.mesh.count = Math.min(saved, this.nShadow);
    };
    this.mesh.onAfterShadow = () => {
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
    this.last = new THREE.Vector3(1e9, 0, 0);
    this.sel = new Int32Array(max);
  }
  add(x, y, z, ry = 0, s = 1, color = null, extra = null, scale3 = null) {
    const it = { x, y, z, ry, s, color, extra, scale3 };
    this.items.push(it);
    return it;
  }
  // write one instance
  // hide(it) / show(it): take one item out of the rendered set (e.g. picked up by combat); forces a repack
  hide(it) {
    it.hidden = true;
    this.last.set(1e9, 0, 0);
    this.written = -1;
  }
  show(it) {
    it.hidden = false;
    this.last.set(1e9, 0, 0);
    this.written = -1;
  }
  write(k, it) {
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
    _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.ry);
    if (it.rx || it.rz) {
      _e.set(it.rx || 0, it.ry, it.rz || 0, "YXZ");
      _q.setFromEuler(_e);
    }
    if (it.scale3)
      _s.set(it.scale3[0] * it.s, it.scale3[1] * it.s, it.scale3[2] * it.s);
    else _s.set(it.s, it.s, it.s);
    if (it.hidden) _s.set(0, 0, 0);
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(k, _m);
    if (it.color && this.mesh.instanceColor)
      this.mesh.instanceColor.setXYZ(k, it.color[0], it.color[1], it.color[2]);
    if (it.extra)
      for (const key in it.extra) {
        const a = this.extra[key];
        if (!a) continue;
        const v = it.extra[key];
        if (a.itemSize === 1) a.setX(k, v);
        else a.array.set(v, k * a.itemSize);
      }
  }
  // static repack when the camera moved. Items are bucketed in a 64 m grid on first use (static item lists; set
  // pool.dirty = true after adding/moving items to rebuild the buckets).
  buildGrid() {
    // LOD pools of one prop share their items array -> share the bucket grid too
    const cached = GRIDS.get(this.items);
    if (cached && cached.n === this.items.length && !this.dirty) {
      this.grid = cached.g;
      this.gridN = cached.n;
      return;
    }
    const C = 64,
      g = new Map();
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
  // true when update() would repack now (lets callers budget repacks across frames)
  due(cam) {
    return this.isStatic
      ? this.written !== this.items.length || this.dirty
      : cam.distanceToSquared(this.last) >= this.thresh() ** 2 ||
          this.viewDue();
  }
  // (perf r2) view-direction culling: instances beyond the shadow range that lie outside the camera's horizontal view
  // wedge (csm._viewWedge: frustum corners + 60 deg margin) are not written; repack after a 20 deg turn or when the
  // wedge switches on / off. Shadow casters (within shadowFar) are kept in every direction.
  viewDue() {
    const V = cascadedShadowState.view;
    if (isViewWedgeDisabled || !V || !this.far || this.far <= this.shadowFar) return false;
    const on = V.cos > -1;
    if (on !== !!this.vOn) return true;
    return on && V.x * this.vx + V.z * this.vz < 0.94;
  }
  // repack distance scales with the LOD's range: near pools every 6 m, a 1.5 km far ring every ~30 m
  thresh() {
    return Math.max(6, Math.min(40, this.far * 0.02));
  }
  update(cam, force = false, moveThresh = this.thresh()) {
    if (this.isStatic) {
      if (this.written === this.items.length && !force && !this.dirty) return;
      const n = Math.min(this.max, this.items.length);
      for (let k = 0; k < n; k++) this.write(k, this.items[k]);
      this.mesh.count = n;
      this.nShadow = this.shadowFar >= this.far ? n : 0;
      this.written = this.items.length;
      this.dirty = false;
      this.mesh.visible = n > 0; // (perf) empty pools cost no draw call in the main / shadow passes
      this.upload(n);
      return;
    }
    if (
      !force &&
      cam.distanceToSquared(this.last) < moveThresh * moveThresh &&
      !this.viewDue()
    )
      return;
    this.last.copy(cam);
    const V = cascadedShadowState.view,
      wedge = !isViewWedgeDisabled && !!V && V.cos > -1 && this.far > this.shadowFar; // (perf r2) view wedge
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
    // include the fade bands + the repack hysteresis so the shader fade (continuous camera distance) never runs out
    const nr = Math.max(0, this.near - this.fadeIn - moveThresh),
      fr = this.far + moveThresh;
    const n2 = nr * nr,
      f2 = fr * fr;
    let k = 0;
    const items = this.items;
    // pass 1: collect candidate indices with distance (only grid cells overlapping the far radius)
    const cand = [];
    const C = 64,
      r = Math.ceil(fr / C);
    const cx = Math.floor(cam.x / C),
      cz = Math.floor(cam.z / C);
    for (let gx = cx - r; gx <= cx + r; gx++)
      for (let gz = cz - r; gz <= cz + r; gz++) {
        const cell = this.grid.get(gx * 100003 + gz);
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
      // keep the nearest
      const idx = [];
      for (let i = 0; i < cand.length; i += 2) idx.push(i);
      idx.sort((a, b) => cand[a + 1] - cand[b + 1]);
      let ns = 0;
      for (let j = 0; j < this.max; j++) {
        if (cand[idx[j] + 1] < s2) ns = j + 1;
        this.write(k++, items[cand[idx[j]]]);
      }
      this.nShadow = ns;
    } else if (Pool.sortF2B && cand.length / 2 <= Pool.sortMax) {
      // (perf r3) nearest first: the whole written set in front-to-back order (casters stay a prefix: they are the
      // nearest). Same instances, same pixels; the GPU's early depth test then rejects most hidden leaf / crown fragments
      // (alpha-tested foliage was shaded once per overlapping layer in the old grid-cell order)
      const n = cand.length >> 1,
        key =
          Pool._key && Pool._key.length >= n
            ? Pool._key
            : (Pool._key = new Float64Array(Math.max(n, 4096)));
      // key: floor(d2) (m^2), then casters before non-casters inside one 1 m^2 step (the shadow prefix stays exactly the
      // old caster set), then the candidate index; exact in a double out to ~60 km
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
      // shadow casters (within shadowFar) first, then the rest
      for (let i = 0; i < cand.length; i += 2)
        if (cand[i + 1] < s2) this.write(k++, items[cand[i]]);
      this.nShadow = k;
      for (let i = 0; i < cand.length; i += 2)
        if (cand[i + 1] >= s2) this.write(k++, items[cand[i]]);
    }
    this.mesh.count = k;
    this.mesh.visible = k > 0; // (perf) empty pools: no zero-instance draw in the main pass + every cascade
    this.upload(k);
  }
  // upload only the written prefix (never a 0-length range: WebGL2 would read that as "to the end of the buffer")
  upload(n) {
    if (!n) return;
    const set = (a, w) => {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * w);
      a.needsUpdate = true;
    };
    set(this.mesh.instanceMatrix, 16);
    if (this.mesh.instanceColor) set(this.mesh.instanceColor, 3);
    for (const a of Object.values(this.extra)) set(a, a.itemSize);
  }
}

// Per-fragment dithered distance fade for merged (non-instanced) meshes: fragments dissolve between d0 and d1 metres
// (horizontal distance to the camera), so whole tiles can be hidden beyond d1 without a visible pop.
export function applyDistanceFade(mat, d0, d1) {
  if (!mat || mat.userData.distFade) return mat;
  mat.userData.distFade = true;
  const prev = mat.onBeforeCompile,
    prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uLodFrame = sh.uniforms.uLodFrame || {
      value: cascadedShadowState.params,
    };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",poolShader.vertexCommonByDistanceFade,
      )
      .replace(
        "#include <project_vertex>",injectShader(poolShader.vertexProjectVertexByDistanceFade, d1.toFixed(1), (d1 - d0).toFixed(1)),
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",poolShader.fragmentCommonByDistanceFade,
      )
      .replace(
        "#include <clipping_planes_fragment>",poolShader.fragmentClippingByDistanceFade,
      );
  };
  mat.customProgramCacheKey = () =>
    (prevKey ? prevKey.call(mat) : "") + `|distfade${d0}-${d1}`;
  mat.needsUpdate = true;
  return mat;
}
