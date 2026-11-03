// @ts-nocheck
import __shaderRaw1 from "./shaders/glsl/csm-pars.glsl?raw";
import __shaderRaw2 from "./shaders/glsl/csm-block.glsl?raw";
import csmTryCode from "./shaders/glsl/csm-try-code.glsl?raw";
import csmCharCascade from "./shaders/glsl/csm-char-cascade.glsl?raw";
import { injectShader } from "./shader.ts";
// OWNER: render agent.
// Cascaded shadow maps for the sun, implemented with N DirectionalLights (one shadow map per cascade) and a
// GLOBAL override of three's `lights_fragment_begin` / `shadowmap_pars_fragment` chunks, so EVERY built-in lit
// material (Standard, Physical, Lambert, Phong, Toon) gets cascaded shadows automatically -- no per-material
// setup is required. Light 0 carries the sun radiance; lights 1..N-1 have intensity 0 and only provide their
// shadow maps. Cascade selection is done by testing the fragment's shadow coordinates (map-based selection),
// with a stochastic (dithered) blend band between cascades that TAA resolves.
//
// Caveat for other agents: do NOT add another DirectionalLight with castShadow=true before the CSM lights in
// scene traversal order. Non-shadow directional lights are fine (they're shaded normally).
import * as THREE from "three";

let _installed = false;
export const CHAR_LAYER = 30;
export const BIG_CASTER_LAYER = 28; // far cascades only render casters on this layer (small props/people skipped)
export const SHADOW_PROXY_LAYER = 29; // (perf r2) shadow-only stand-ins: drawn by the shadow cameras of cascades >= 2 only
export const csmShared = { params: new THREE.Vector4(0, 0.1, 1, 0) }; // x: frame noise, y: blend band

function installChunks(N, taps, charCascade) {
  if (_installed) return;
  _installed = true;
  const SC = THREE.ShaderChunk;
  let tryCode = "";
  // high-res character cascade (shadow index N) is tested first: it covers a small box around the player
  // (self-shadowing of the suit, contact shadows of feet / hands on ground and walls).
  // The character cascade (shadow index N) holds ONLY the player's meshes (layer CHAR_LAYER), so it is multiplied
  // with the regular cascade result (buildings still shadow the player's surroundings inside its small box).
  for (let i = 0; i < N; i++) {
    tryCode += injectShader(csmTryCode, i);
  }
  if (charCascade)
    tryCode += injectShader(csmCharCascade, N);
  const pars = injectShader(__shaderRaw1, taps, tryCode);
  if (!SC.shadowmap_pars_fragment.includes("csmShadow"))
    SC.shadowmap_pars_fragment = SC.shadowmap_pars_fragment + pars;

  // Replace the directional-light block of lights_fragment_begin.
  const src = SC.lights_fragment_begin;
  const start = src.indexOf(
    "#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )",
  );
  const end = src.indexOf("#if ( NUM_RECT_AREA_LIGHTS > 0 )");
  if (start < 0 || end < 0) {
    console.error("[render/csm] could not patch lights_fragment_begin");
    return;
  }
  const cascades = N + (charCascade ? 1 : 0);
  const block = injectShader(__shaderRaw2, N - 1, cascades, cascades);
  SC.lights_fragment_begin = src.slice(0, start) + block + src.slice(end);

  // Shared uniform: add to the built-in ShaderLib entries (object value is shared by reference across clones).
  for (const k of ["standard", "physical", "lambert", "phong", "toon"]) {
    const lib = THREE.ShaderLib[k];
    if (lib) lib.uniforms.csmData = { value: csmShared };
  }
}

// (perf r2) three re-uploads matrix-array uniforms (directionalShadowMatrix[6] of the 5 cascades + character light)
// on EVERY material switch -- it has no equality cache for arrays -- and in Chrome each such uniformMatrix4fv costs
// ~0.1 ms (measured: ~115 uploads / 13.6 ms per frame at street level). A GL program keeps its uniform values, so an
// upload identical to the last one sent to the same location is skipped. Locations are per program (a relink makes new
// ones), so the cache is exact.
function installUniformCache(renderer) {
  const gl = renderer.getContext();
  if (!gl || gl.__uCache) return;
  gl.__uCache = true;
  const last = new WeakMap();
  for (const fn of ["uniformMatrix4fv", "uniformMatrix3fv"]) {
    const orig = gl[fn].bind(gl);
    gl[fn] = function (loc, transpose, data, srcOffset, srcLength) {
      if (loc && data && srcOffset === undefined && data.length > 16) {
        // arrays only: single matrices are mostly per-object
        const prev = last.get(loc);
        if (prev && prev.length === data.length) {
          let same = true;
          for (let i = 0; i < data.length; i++)
            if (prev[i] !== data[i]) {
              same = false;
              break;
            }
          if (same) return;
          prev.set(data);
        } else last.set(loc, Float32Array.from(data));
      }
      return srcOffset === undefined
        ? orig(loc, transpose, data)
        : orig(loc, transpose, data, srcOffset, srcLength);
    };
  }
}

export class CSM {
  constructor({ scene, quality, reversed, renderer }) {
    this.N = quality.cascades;
    this.splits = quality.splits.slice();
    this.size = quality.shadowMapSize;
    this.reversed = reversed;
    this.charSize = quality.charShadow || 0;
    installChunks(this.N, quality.shadowTaps, this.charSize > 0);
    this.sunDir = new THREE.Vector3(0.5, 0.7, 0.3).normalize();
    this.lights = [];
    this.frame = 0;
    // update period per cascade (far cascades refresh less often; they are padded to cover staleness)
    this.periods = [1, 2, 4, 8, 8].slice(0, this.N);
    const radii = [1.6, 1.25, 1.1, 1.0, 1.0]; // (lighting2 r3) was 2.5/1.8/1.4/1.1: crisper street-scale shadow edges (TAA smooths the taps)
    for (let i = 0; i < this.N; i++) {
      const l = new THREE.DirectionalLight(0xffffff, i === 0 ? 1 : 0);
      l.name = "CSM_" + i;
      l.castShadow = true;
      const sz = i === this.N - 1 && this.N > 2 ? this.size >> 1 : this.size; // far cascade: half res
      l.shadow.mapSize.set(sz, sz);
      l.shadow.radius = radii[i] * (sz < this.size ? 0.6 : 1);
      l.shadow.autoUpdate = false;
      l.shadow.needsUpdate = true;
      scene.add(l);
      scene.add(l.target);
      this.lights.push(l);
    }
    this.sun = this.lights[0];
    // cascades beyond ~200 m only need large casters (buildings, trees, big vehicles)
    // (perf) was i >= 2 (> 50 m); the filter never applied before the layer fix below, so cascade 2 keeps every caster
    // (unchanged look for 50-200 m: cars / people / props keep their shadows)
    for (let i = 3; i < this.N; i++)
      this.lights[i].shadow.camera.layers.set(BIG_CASTER_LAYER);
    // (perf r2) shadow-only stand-ins (never drawn by the main camera: they live on SHADOW_PROXY_LAYER only) cast in
    // cascades >= 2; the far cascades see them only when also tagged BIG_CASTER_LAYER (tagCasters)
    if (quality.perf !== false)
      for (let i = 2; i < this.N; i++)
        this.lights[i].shadow.camera.layers.enable(
          i >= 3 ? BIG_CASTER_LAYER : SHADOW_PROXY_LAYER,
        );
    csmShared.proxyShadows = quality.perf !== false && !!renderer; // traffic.js: hi cars hand their far-cascade shadows to proxies
    this._tagged = new WeakSet();
    this._tagFrame = 0;
    // character cascade: must be added right after the cascades (shadow index N)
    this.charLight = null;
    this.focus = null;
    this.charRadius = 1.6;
    if (this.charSize > 0) {
      const l = new THREE.DirectionalLight(0xffffff, 0);
      l.name = "CSM_char";
      l.castShadow = true;
      l.shadow.mapSize.set(this.charSize, this.charSize);
      l.shadow.radius = 2.0;
      l.shadow.autoUpdate = false;
      l.shadow.needsUpdate = true;
      l.shadow.camera.layers.set(CHAR_LAYER); // only the player casts into this map (see setCharacter)
      scene.add(l);
      scene.add(l.target);
      this.charLight = l;
    }
    // Pre-create every shadow map exactly as three's WebGLShadowMap would (PCF: depth texture with a compare
    // function). Otherwise, any draw that happens before the first shadow pass binds three's shared 1x1
    // `emptyShadowTexture` into the directionalShadowMap[] ARRAY -- whose setter never sets its compareFunction --
    // which raises "GL_INVALID_OPERATION: Mismatch between texture format and sampler type" on every draw.
    for (const l of [...this.lights, this.charLight]) {
      if (!l || l.shadow.map) continue;
      const s = l.shadow.mapSize;
      const rt = new THREE.WebGLRenderTarget(s.x, s.y);
      const dt = new THREE.DepthTexture(s.x, s.y, THREE.UnsignedIntType);
      dt.name = l.name + ".shadowMap";
      dt.format = THREE.DepthFormat;
      dt.compareFunction = reversed
        ? THREE.GreaterEqualCompare
        : THREE.LessEqualCompare;
      dt.minFilter = dt.magFilter = THREE.LinearFilter;
      rt.depthTexture = dt;
      rt.texture.name = l.name + ".shadowMap";
      l.shadow.map = rt;
      renderer?.initRenderTarget?.(rt); // allocate + apply compare mode now (an un-allocated depth texture binds nothing)
    }
    // (perf) three r186's WebGLShadowMap tests object.layers against the MAIN camera, not the shadow camera, so the
    // per-cascade layer filters (BIG_CASTER_LAYER for the far cascades, CHAR_LAYER for the 3 m character box) were
    // silently ignored: every cascade -- including the character one -- drew every caster (~130 draws / 3M tris per
    // frame for the character box alone). Render the shadow lights one at a time with the main camera's layer mask
    // swapped for that light's shadow-camera mask. ?perfoff restores the old behaviour.
    if (quality.perf !== false && renderer) {
      this._installLayerFix(renderer);
      this._layerFix = true;
    }
    if (
      quality.perf !== false &&
      renderer &&
      !/[?&](perf2off|noucache)\b/.test(globalThis.location?.search ?? "")
    )
      installUniformCache(renderer); // (perf r2)
    this._fwd = new THREE.Vector3();
    this._c = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._u = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this.forceAll = true;
  }
  // (perf) merged city meshes (256 m tiles, park, far shore, highway...) have huge bounding SPHERES, which three's
  // shadow pass tests against each cascade: a 28 m wide cascade-0 column still drew the whole far-shore city. Keep a
  // list of the big static casters with their world AABB (rebuilt with tagCasters) and hide those whose box misses
  // the cascade's light frustum while that cascade renders. Exact test -> no visible change.
  _collectBig(scene) {
    const L = (this._big = []),
      C = (this._capped = []);
    // (perf r3) the per-object result only changes with the geometry, the instance set or the world matrix: reuse it
    // (this ran every 120 frames and recomputed every instanced caster's bounds: a 13-16 ms frame every 2 s)
    const memo = (this._bigMemo ??= new WeakMap());
    scene.traverse((o) => {
      if (
        (o.userData?.maxCascade !== undefined ||
          o.userData?.minCascade !== undefined) &&
        o.castShadow
      )
        C.push(o); // (perf r2) see _installLayerFix
      if (
        !o.isMesh ||
        o.isSkinnedMesh ||
        !o.frustumCulled ||
        !o.geometry ||
        !o.castShadow ||
        o.userData.dynamic
      )
        return; // (perf r2) dynamic: bounds change every frame
      const g = o.geometry;
      if (o.isInstancedMesh && !o.count) return;
      o.updateWorldMatrix(true, false);
      const me = o.matrixWorld.elements,
        iv = o.isInstancedMesh ? o.instanceMatrix.version : -1,
        pc = g.attributes.position?.count ?? 0;
      let mm = memo.get(o);
      if (
        mm &&
        mm.g === g &&
        mm.n === (o.isInstancedMesh ? o.count : -1) &&
        mm.iv === iv &&
        mm.pc === pc &&
        mm.bb === g.boundingBox &&
        (!mm.bb || (mm.bb.min.equals(mm.b0) && mm.bb.max.equals(mm.b1))) &&
        me.every((v, i) => v === mm.m[i])
      ) {
        if (mm.boxes) L.push(o, mm.boxes);
        return;
      }
      if (o.isInstancedMesh) o.computeBoundingBox();
      else if (!g.boundingBox) g.computeBoundingBox();
      mm = {
        g,
        n: o.isInstancedMesh ? o.count : -1,
        iv,
        pc,
        bb: g.boundingBox,
        b0: g.boundingBox?.min.clone(),
        b1: g.boundingBox?.max.clone(),
        m: me.slice(),
        boxes: null,
      };
      memo.set(o, mm);
      const bb = o.isInstancedMesh ? o.boundingBox : g.boundingBox;
      if (!bb || bb.isEmpty()) return;
      const box = bb.clone().applyMatrix4(o.matrixWorld);
      if (
        box.max.x - box.min.x < 60 &&
        box.max.z - box.min.z < 60 &&
        box.max.y - box.min.y < 60
      )
        return; // small: sphere test is fine
      // meshes merged over several distant regions (far shores on both rivers, park + avenue strips): one AABB would
      // cover the whole map, so split them into per-256 m-cell boxes of their vertices (computed once, static meshes)
      let boxes = [box];
      if (
        !o.isInstancedMesh &&
        (box.max.x - box.min.x > 512 || box.max.z - box.min.z > 512)
      ) {
        const c = (this._cellBoxes ??= new WeakMap());
        let e = c.get(o);
        if (!e || e.g !== g || e.n !== g.attributes.position.count) {
          const pos = g.attributes.position,
            v = new THREE.Vector3(),
            cells = new Map();
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
            const k = Math.floor(v.x / 256) * 65536 + Math.floor(v.z / 256);
            let b = cells.get(k);
            if (!b) cells.set(k, (b = new THREE.Box3()));
            b.expandByPoint(v);
          }
          c.set(o, (e = { g, n: pos.count, boxes: [...cells.values()] }));
        }
        boxes = e.boxes;
      }
      mm.boxes = boxes;
      L.push(o, boxes);
    });
  }
  _installLayerFix(renderer) {
    // (perf) see the constructor
    const sm = renderer.shadowMap,
      orig = sm.render,
      one = [null],
      csm = this,
      hid = [];
    sm.render = function (lights, scene, camera) {
      if (
        sm.enabled === false ||
        (sm.autoUpdate === false && sm.needsUpdate === false) ||
        !lights.length
      )
        return orig.call(this, lights, scene, camera);
      const mask = camera.layers.mask,
        nu = sm.needsUpdate;
      try {
        for (const l of lights) {
          const sh = l.shadow;
          if (!sh || (sh.autoUpdate === false && sh.needsUpdate === false))
            continue;
          camera.layers.mask = sh.camera.layers.mask;
          const big = csm._big;
          // (perf r2) casters limited to a cascade range (userData.minCascade / maxCascade): hidden in the other cascades.
          // Hi-detail cars (~50k tris each) cast in cascades 0-1 only, a low-poly stand-in on SHADOW_PROXY_LAYER beyond;
          // crowd LOD0 (< 24 m) casts in 0-1, LOD1 (24-70 m) in 1-2 (see npc/crowd.js)
          const ci = csm.lights.indexOf(l);
          if (csm._capped && ci >= 0)
            for (const o of csm._capped) {
              const u = o.userData;
              if (
                o.visible &&
                (ci > (u.maxCascade ?? 99) || ci < (u.minCascade ?? 0))
              ) {
                o.visible = false;
                hid.push(o);
              }
            }
          if (big && l.isDirectionalLight && sh.getFrustum) {
            sh.updateMatrices(l);
            const fr = sh.getFrustum();
            for (let i = 0; i < big.length; i += 2) {
              const o = big[i];
              if (!o.visible || !o.castShadow) continue;
              const bx = big[i + 1];
              let hit = false;
              for (let j = 0; j < bx.length && !hit; j++)
                hit = fr.intersectsBox(bx[j]);
              if (!hit) {
                o.visible = false;
                hid.push(o);
              }
            }
          }
          one[0] = l;
          sm.needsUpdate = nu;
          try {
            orig.call(this, one, scene, camera);
          } finally {
            for (const o of hid) o.visible = true;
            hid.length = 0;
          }
        }
      } finally {
        camera.layers.mask = mask;
        one[0] = null;
      }
    };
  }
  // (perf r2) horizontal view wedge for world/pool.js: forward (x, z) + cos of the half-angle that contains every frustum
  // corner ray's horizontal direction, plus a 60 deg margin (pools repack on a 20 deg turn and are budgeted over frames).
  // cos = -2: no wedge (looking steeply up / down: the corners' horizontal directions span ~everything)
  _viewWedge(camera) {
    const V = (csmShared.view ??= { x: 0, z: 1, cos: -2 });
    if (!camera.isPerspectiveCamera) {
      V.cos = -2;
      return;
    }
    const f = this._fwd,
      hl = Math.hypot(f.x, f.z);
    if (hl < 0.3) {
      V.cos = -2;
      return;
    }
    V.x = f.x / hl;
    V.z = f.z / hl;
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5),
      th = tv * camera.aspect,
      v = this._tmp,
      e = camera.matrixWorld.elements;
    let worst = 1;
    for (let k = 0; k < 4; k++) {
      const x = k & 1 ? th : -th,
        y = k & 2 ? tv : -tv; // camera space (x, y, -1) -> world direction
      v.set(
        e[0] * x + e[4] * y - e[8],
        e[1] * x + e[5] * y - e[9],
        e[2] * x + e[6] * y - e[10],
      );
      const h = Math.hypot(v.x, v.z);
      if (h < 1e-4) {
        V.cos = -2;
        return;
      }
      worst = Math.min(worst, (v.x * V.x + v.z * V.z) / h);
    }
    const half = Math.acos(Math.max(-1, Math.min(1, worst))) + Math.PI / 3;
    V.cos = half >= Math.PI ? -2 : Math.cos(half);
  }
  setSunDirection(dir) {
    this.sunDir.copy(dir).normalize();
    this.forceAll = true;
  }
  /** world position of the player's feet (or null): the character cascade covers a box around it */
  /** tag large shadow casters (world bounding radius >= 3 m, or instanced batches of such) for the far cascades */
  tagCasters(scene) {
    const _s = new THREE.Vector3();
    scene.traverse((o) => {
      if (!o.castShadow || !o.isMesh || this._tagged.has(o)) return;
      this._tagged.add(o);
      const g = o.geometry;
      if (!g) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      o.updateWorldMatrix(true, false);
      _s.setFromMatrixScale(o.matrixWorld);
      let r = (g.boundingSphere?.radius ?? 0) * Math.max(_s.x, _s.y, _s.z);
      if (o.isInstancedMesh && o.instanceMatrix && o.count > 0) {
        // per-instance scale of the first instance
        const m = new THREE.Matrix4().fromArray(o.instanceMatrix.array, 0);
        const s2 = new THREE.Vector3().setFromMatrixScale(m);
        r =
          (g.boundingSphere?.radius ?? 0) *
          Math.max(s2.x, s2.y, s2.z) *
          Math.max(_s.x, _s.y, _s.z);
      }
      // merged small-detail batches (cornices, sills, vents: city 'detail x,z' chunks) have large bounds but only
      // small features: their shadows are sub-texel in the far cascades, so skip them there
      if (/^detail\b/.test(o.name || "") || o.userData?.smallCasters) return;
      if (r >= 3.0) o.layers.enable(BIG_CASTER_LAYER);
    });
  }
  /** mark the player's meshes so they (only) render into the character cascade */
  setCharacter(obj) {
    if (
      !obj ||
      (obj === this._charObj && this._charCount === this._countMeshes(obj))
    )
      return;
    this._charObj = obj;
    this._charCount = this._countMeshes(obj);
    obj.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) o.layers.enable(CHAR_LAYER);
    });
  }
  _countMeshes(obj) {
    let n = 0;
    obj.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) n++;
    });
    return n;
  }
  setFocus(p) {
    if (p) (this.focus ??= new THREE.Vector3()).copy(p);
    else this.focus = null;
  }
  _fit(light, center, r, right, lup, L, size) {
    const texel = (2 * r) / size;
    const cx = Math.round(center.dot(right) / texel) * texel;
    const cy = Math.round(center.dot(lup) / texel) * texel;
    const cz = center.dot(L);
    center
      .copy(right)
      .multiplyScalar(cx)
      .addScaledVector(lup, cy)
      .addScaledVector(L, cz);
    const D = r + 900;
    light.position.copy(center).addScaledVector(L, D);
    light.target.position.copy(center);
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();
    const cam = light.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = D + r + 50;
    cam.updateProjectionMatrix();
    const depthRange = cam.far - cam.near;
    light.shadow.normalBias = texel * 1.4;
    light.shadow.bias = ((this.reversed ? 1 : -1) * (texel * 0.6)) / depthRange;
    light.shadow.needsUpdate = true;
  }
  update(camera, scene) {
    this.frame++;
    if (scene && this._tagFrame++ % 120 === 0) {
      this.tagCasters(scene);
      if (this._layerFix) this._collectBig(scene);
    } // (perf)
    csmShared.params.x = ((this.frame % 64) * 0.618034) % 1;
    csmShared.params.y = 0.06;
    const L = this.sunDir;
    // light basis
    const up =
      Math.abs(L.y) > 0.99 ? this._tmp.set(0, 0, 1) : this._tmp.set(0, 1, 0);
    const right = this._r.crossVectors(up, L).normalize();
    const lup = this._u.crossVectors(L, right).normalize();
    camera.getWorldDirection(this._fwd);
    this._viewWedge(camera); // (perf r2) csmShared.view for Pool's view-direction culling
    const camPos = new THREE.Vector3().setFromMatrixPosition(
      camera.matrixWorld,
    );
    // cascade radii from a FIXED max field of view (not the live FOV): swing FOV kicks must not resize the cascades
    // (a resize re-snaps every shadow texel -> visible shimmer)
    const tanV = Math.tan(
      THREE.MathUtils.degToRad(Math.max(camera.fov, 80)) * 0.5,
    );
    const tanH = tanV * Math.max(camera.aspect, 16 / 9);
    const k2 = tanV * tanV + tanH * tanH;
    for (let i = 0; i < this.N; i++) {
      const light = this.lights[i];
      const period = this.periods[i];
      const due = this.forceAll || (this.frame + i) % period === 0;
      if (!due) {
        light.shadow.needsUpdate = false;
        continue;
      }
      const n = Math.max(this.splits[i], camera.near),
        f = Math.min(this.splits[i + 1], camera.far);
      let zc = (f + n) * 0.5 * (1 + k2),
        r;
      if (zc >= f) {
        zc = f;
        r = f * Math.sqrt(k2);
      } else r = Math.sqrt((zc - n) ** 2 + n * n * k2);
      if (i >= 1) r *= [1, 1.06, 1.12, 1.15][i]; // padding for staggered updates
      r = Math.ceil(r);
      const center = this._c.copy(this._fwd).multiplyScalar(zc).add(camPos);
      // snap to texel grid in light space
      const texel = (2 * r) / light.shadow.mapSize.x;
      const cx = Math.round(center.dot(right) / texel) * texel;
      const cy = Math.round(center.dot(lup) / texel) * texel;
      const cz = Math.round(center.dot(L) / 4) * 4; // quantised depth: stable depth range / bias between frames
      center
        .copy(right)
        .multiplyScalar(cx)
        .addScaledVector(lup, cy)
        .addScaledVector(L, cz);
      const D = r + 900;
      light.position.copy(center).addScaledVector(L, D);
      light.target.position.copy(center);
      light.updateMatrixWorld();
      light.target.updateMatrixWorld();
      const cam = light.shadow.camera;
      cam.left = -r;
      cam.right = r;
      cam.top = r;
      cam.bottom = -r;
      cam.near = 1;
      cam.far = D + r + 50;
      cam.updateProjectionMatrix();
      // bias: normal offset ~1.5 texels, small depth bias
      const depthRange = cam.far - cam.near;
      light.shadow.normalBias = texel * 1.4;
      light.shadow.bias =
        ((this.reversed ? 1 : -1) * (texel * 0.6)) / depthRange;
      light.shadow.needsUpdate = true;
    }
    this.forceAll = false;
    if (this.charLight) {
      const c = this._c;
      // only while the player is close to the camera (it is a contact/self-shadow detail cascade); a far player's
      // box would otherwise override world shadows in a small moving patch
      const near = this.focus && this.focus.distanceTo(camPos) < 25;
      if (near) c.copy(this.focus).add(this._tmp.set(0, 0.9, 0));
      else c.set(0, -5000, 0);
      const r = this.charRadius;
      this._fit(this.charLight, c, r, right, lup, L, this.charSize);
      // tighter bias: the character map is very high resolution
      this.charLight.shadow.normalBias = ((2 * r) / this.charSize) * 2.0;
    }
  }
}
