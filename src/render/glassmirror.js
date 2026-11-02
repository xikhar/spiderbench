// OWNER: render agent. (render r-refl) Player reflection in facade glass (user: "fix player reflection not showing on
// glass windows").
// The facade glass (curtain walls, storefronts, sash windows) does its own procedural city reflection and opts out of
// the pipeline SSR (world/facade.js), so nothing dynamic ever showed up in it. This renders the DYNAMIC things only --
// the player (+ web lines) and near pedestrians (L0 pools; cars were too costly) -- mirrored about the ONE facade plane
// next to the player that the camera sees, into a half-res HDR target (alpha = coverage). The facade shader
// (lights_fragment_maps) projects its world position through `uGMMat` and lays the mirror image over its own
// reflection on the glass pixels that lie on that plane, before the Fresnel / specular BRDF, so it gets the glass's
// own reflectance, sash dimming and aerial perspective like the rest of the reflection.
//   - same frame (rendered just before the main scene pass, with the main camera's jittered projection: TAA resolves it)
//   - same lights / shadow maps / programs as the main pass (no extra shader variants: shadows stay enabled, no clip
//     planes -- an oblique projection clips at the glass; the shadow maps are not re-rendered), only layer GM_LAYER is
//     drawn (tagged by scan(): player + web lines, near peds, lights)
//   - skipped when the player is > 32 m from a wall, the camera is behind / in the plane, or the mirror image of the
//     player is off-screen
// ?nogmirror disables it (A/B).
import * as THREE from "three";

export const GM_LAYER = 26;
// shared by every facade material (world/facade.js imports it, like surface.js's ambShared)
export const glassMirrorShared = {
  tGM: { value: null },
  uGMMat: { value: new THREE.Matrix4() },
  uGMPlane: { value: new THREE.Vector4(0, 1, 0, -1e6) },
  uGMOn: { value: 0 },
};
export const GLSL_GLASS_MIRROR_DECL = /* glsl */ `
uniform sampler2D tGM; uniform mat4 uGMMat; uniform vec4 uGMPlane; uniform float uGMOn;
// mirror image (rgb) + coverage (a) at this facade point, or 0 when it is not on the mirrored plane
vec4 glassMirror(vec3 wp, vec3 wn) {
  if (uGMOn < 0.5) return vec4(0.0);
  float pd = dot(wp, uGMPlane.xyz) - uGMPlane.w;
  float pm = smoothstep(0.96, 0.99, dot(wn, uGMPlane.xyz)) * (1.0 - smoothstep(0.2, 0.45, abs(pd)));
  if (pm <= 0.0) return vec4(0.0);
  vec4 rp = uGMMat * vec4(wp, 1.0);
  if (rp.w <= 0.0) return vec4(0.0);
  vec2 ruv = rp.xy / rp.w;
  vec2 e = smoothstep(0.0, 0.03, ruv) * smoothstep(1.0, 0.97, ruv);
  vec4 m = texture(tGM, ruv);
  return vec4(m.rgb, clamp(m.a, 0.0, 1.0) * pm * e.x * e.y);
}
`;

export function createGlassMirror(renderer, scene) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(
    Math.max(64, size.x >> 1),
    Math.max(64, size.y >> 1),
    { type: THREE.HalfFloatType, depthBuffer: true },
  );
  rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
  rt.texture.generateMipmaps = false;
  const S = glassMirrorShared;
  S.tGM.value = rt.texture;
  let off = false;
  try {
    off = new URLSearchParams(location.search).has("nogmirror");
  } catch (e) {
    /* non-browser */
  }
  const vcam = new THREE.PerspectiveCamera();
  vcam.layers.set(GM_LAYER);
  vcam.matrixAutoUpdate = true;
  const bias = new THREE.Matrix4().set(
    0.5,
    0,
    0,
    0.5,
    0,
    0.5,
    0,
    0.5,
    0,
    0,
    0.5,
    0.5,
    0,
    0,
    0,
    1,
  );
  const _p = new THREE.Vector3(),
    _c = new THREE.Vector3(),
    _d = new THREE.Vector3(),
    _t = new THREE.Vector3(),
    _u = new THREE.Vector3();
  const _m = new THREE.Vector3(),
    _n = new THREE.Vector3(),
    _q = new THREE.Vector4(),
    _col = new THREE.Color(),
    _pl = new THREE.Plane(),
    _rq = new THREE.Quaternion();
  const DIRS = [];
  for (let i = 0; i < 8; i++)
    DIRS.push(
      new THREE.Vector3(
        Math.cos((i * Math.PI) / 4),
        0,
        Math.sin((i * Math.PI) / 4),
      ),
    );
  const cur = { on: false, n: new THREE.Vector3(), d: 0 };
  const stats = { on: 0, plane: null };
  const refl = (v, n, d) => v.addScaledVector(n, -2 * (v.dot(n) - d)); // point across the plane n.x = d
  const reflDir = (v, n) => v.addScaledVector(n, -2 * v.dot(n));

  // tag what the mirror draws: the player, near-LOD cars and pedestrians, and every light (the mirror pass must see
  // the same lights as the main pass, or three would compile another program variant per material)
  function scan() {
    scene.traverse((o) => {
      if (o.isLight) {
        o.layers.enable(GM_LAYER);
        return;
      }
      if (!(o.isMesh || o.isSkinnedMesh) || o.layers.isEnabled(GM_LAYER))
        return;
      // (perf) near pedestrians only: the hi-LOD car pools (~50k tris a car) cost ~2-3 ms more at street level
      if (/^people-.*-L0$/.test(o.name)) o.layers.enable(GM_LAYER);
    });
    window.__ctx?.player?.object?.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) o.layers.enable(GM_LAYER);
    });
    for (const o of scene.children)
      if (/^(WebStrands|WebRopes|SlingWebs)$/.test(o.name))
        o.traverse((w) => w.layers.enable(GM_LAYER)); // the web lines
  }

  // the facade plane next to the player that the camera looks at, whose mirror image of the player is on screen
  function pickPlane(cam, player, world) {
    _p.copy(player.position);
    _c.setFromMatrixPosition(cam.matrixWorld);
    let best = null,
      bestS = Infinity;
    for (const dir of DIRS) {
      const h = world.raycast(_p, dir, 32);
      if (
        !h ||
        h.ground ||
        Math.abs(h.normal.y) > 0.3 ||
        !(h.kind === "wall" || h.kind === "glass")
      )
        continue;
      _n.copy(h.normal).setY(0).normalize();
      const d = _n.dot(h.point);
      if (_n.dot(_c) - d < 0.4) continue; // camera behind / in the plane
      _m.copy(_p);
      refl(_m, _n, d);
      _q.set(_m.x, _m.y, _m.z, 1)
        .applyMatrix4(cam.matrixWorldInverse)
        .applyMatrix4(cam.projectionMatrix);
      if (
        _q.w <= 0.1 ||
        Math.abs(_q.x / _q.w) > 1.35 ||
        Math.abs(_q.y / _q.w) > 1.35
      )
        continue; // mirror image off-screen
      let s = h.distance;
      if (cur.on && cur.n.dot(_n) > 0.999 && Math.abs(cur.d - d) < 0.1)
        s -= 2.5; // hysteresis: keep the current plane
      if (s < bestS) {
        bestS = s;
        best = { n: _n.clone(), d };
      }
    }
    return best;
  }

  let frame = 0;
  return {
    rt,
    stats,
    setSize(w, h) {
      rt.setSize(Math.max(64, w >> 1), Math.max(64, h >> 1));
    },
    // call just before the main scene render (camera already carries this frame's TAA jitter)
    render(cam) {
      S.uGMOn.value = 0;
      stats.on = 0;
      const ctx = window.__ctx,
        player = ctx?.player,
        world = ctx?.world;
      if (off || !player?.object?.visible || !world?.raycast) {
        cur.on = false;
        return;
      }
      if (frame++ % 60 === 0) scan();
      const pl = pickPlane(cam, player, world);
      if (!pl) {
        cur.on = false;
        return;
      }
      cur.on = true;
      cur.n.copy(pl.n);
      cur.d = pl.d;
      // mirrored camera (a proper right-handed camera: position, look target and up reflected across the plane)
      _c.setFromMatrixPosition(cam.matrixWorld);
      cam.getWorldDirection(_d);
      _t.copy(_c).add(_d);
      refl(_t, pl.n, pl.d);
      vcam.position.copy(_c);
      refl(vcam.position, pl.n, pl.d);
      _u.set(0, 1, 0).applyQuaternion(cam.getWorldQuaternion(_rq));
      reflDir(_u, pl.n);
      vcam.up.copy(_u);
      vcam.lookAt(_t);
      vcam.updateMatrixWorld();
      vcam.projectionMatrix.copy(cam.projectionMatrix);
      vcam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      vcam.near = cam.near;
      vcam.far = cam.far;
      vcam.fov = cam.fov;
      vcam.aspect = cam.aspect;
      if (cam.reversedDepth) vcam._reversedDepth = true;
      // oblique near plane = the glass plane (5 cm behind it): cars / peds / the player's limbs BEHIND the mirror (the
      // street on the far side of the block, a hand through the glass) must not show up in front of it. No clip-plane
      // program variants: the projection's depth row is replaced (Lengyel). Reversed Z (three r186, [0,1] depth):
      // near <=> w - z_clip >= 0, far <=> z_clip >= 0 -> z row = w row - s * C (C: view-space plane, kept side >= 0);
      // s = 0.5 keeps everything up to 2x its view depth in front of the plane (always, for fov < 120 deg)
      _pl.set(pl.n, -(pl.d - 0.05)).applyMatrix4(vcam.matrixWorldInverse);
      const e = vcam.projectionMatrix.elements,
        C = _pl.normal,
        Cw = _pl.constant;
      if (cam.reversedDepth) {
        const k = 0.5;
        e[2] = -C.x * k;
        e[6] = -C.y * k;
        e[10] = -1 - C.z * k;
        e[14] = -Cw * k;
      } else {
        // standard [-1,1] depth (three's Reflector)
        _q.set(
          (Math.sign(C.x) + e[8]) / e[0],
          (Math.sign(C.y) + e[9]) / e[5],
          -1,
          (1 + e[10]) / e[14],
        );
        const k = 2 / (C.x * _q.x + C.y * _q.y + C.z * _q.z + Cw * _q.w);
        e[2] = C.x * k;
        e[6] = C.y * k;
        e[10] = C.z * k + 1;
        e[14] = Cw * k;
      }
      vcam.projectionMatrixInverse.copy(vcam.projectionMatrix).invert();
      S.uGMMat.value
        .copy(bias)
        .multiply(vcam.projectionMatrix)
        .multiply(vcam.matrixWorldInverse);
      S.uGMPlane.value.set(pl.n.x, pl.n.y, pl.n.z, pl.d);
      player.object.updateMatrixWorld(true);
      const prevRT = renderer.getRenderTarget(),
        prevA = renderer.getClearAlpha();
      renderer.getClearColor(_col);
      const sm = renderer.shadowMap,
        prevAuto = sm.autoUpdate,
        prevNU = sm.needsUpdate;
      const prevWAU = scene.matrixWorldAutoUpdate;
      sm.autoUpdate = false;
      sm.needsUpdate = false;
      scene.matrixWorldAutoUpdate = false; // shadow maps / world matrices: this frame's main pass does them
      try {
        renderer.setRenderTarget(rt);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, false);
        renderer.render(scene, vcam);
      } finally {
        sm.autoUpdate = prevAuto;
        sm.needsUpdate = prevNU;
        scene.matrixWorldAutoUpdate = prevWAU;
        renderer.setRenderTarget(prevRT);
        renderer.setClearColor(_col, prevA);
      }
      S.uGMOn.value = 1;
      stats.on = 1;
      stats.plane = [pl.n.x, pl.n.z, +pl.d.toFixed(2)];
    },
  };
}
