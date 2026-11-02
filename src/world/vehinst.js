// OWNER: bridges agent (bridges r3). Instanced street-traffic vehicle models for the scripted traffic streams outside
// the npc/traffic.js network (waterfront highways): the same vehicles.glb models, LODs, shared vehicle material programs
// ('veh0/1/2'), NYC paint mix and taxi toppers as the street traffic, on CLONED geometry (the street traffic binds its
// own per-instance buffers to the shared model geometry).
//   const V = createVehicleSet({ models, group, counts: {type: n}, name })  -> null when the models are missing
//   V.begin(camera); V.push(type, x, y, z, yaw, pitch, tint, seed); V.end()
// yaw: heading angle about +y with the model's nose along +x at yaw 0 (x' = cos, z' = -sin); pitch: nose up (rad).
// Tiers: LOD0 < 48 m, LOD1 < 230 m, grouped LOD2 beyond (4 groups); frustum-culled per car beyond 40 m; LOD0 / LOD1
// cast shadows in cascades 0-1 only. Draw calls = non-empty (model, tier) pairs.
import * as THREE from "three";
import { createVehicleMaterial } from "./vehicles.js";

export const HI_D = 48,
  LOW_D = 230;
const lin = (c) =>
  [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map((s) =>
    Math.pow(s, 2.2),
  );
// the street traffic's NYC paint mix (npc/traffic.js CAR_COLORS / TAXI / VANC / LIVERY; copied: not exported there)
const PAL = [
  0x0e0e0f, 0x151517, 0x1b1c1f, 0x101418, 0xe2e2df, 0xd8d8d4, 0xcfcfca,
  0xe6e3da, 0xa9adb1, 0x9c9fa3, 0xb7b9bb, 0x8e9296, 0x6d7074, 0x55585c,
  0x44474b, 0x1b2a4a, 0x223a63, 0x2f4c7a, 0x5a1216, 0x6e1a1a, 0x8a1f1f,
  0xb3a98f, 0x9b8f75, 0x2c3d2e, 0x44563f, 0x6b86a0, 0x4a3a2c, 0x3b4450,
  0x7c8a8f, 0x2a2d33,
].map(lin);
const TAXI = lin(0xf5a900),
  VANC = [0xd6d6d2, 0xcfccc4, 0xc9c9c7, 0xd9d7d0].map(lin),
  LIVERY = [0x0b0b0c, 0x0e0e10, 0x121315, 0x0d1014].map(lin);
// highway / bridge mix: type, weight, grouped far model, length
export const VTYPES = [
  { t: "taxi_hy", w: 0.16, far: "sedan", len: 4.7 },
  { t: "sedan", w: 0.32, far: "sedan", len: 4.9 },
  { t: "suv", w: 0.3, far: "suv", len: 5.1 },
  { t: "van", w: 0.12, far: "van", len: 6.0 },
  { t: "truck", w: 0.1, far: "truck", len: 7.3 },
];
export function pickVehicle(r) {
  for (const q of VTYPES) {
    if (r < q.w) return q;
    r -= q.w;
  }
  return VTYPES[0];
}
export function paintFor(t, r) {
  return t.startsWith("taxi")
    ? TAXI
    : t === "van" || t === "truck"
      ? VANC[Math.floor(r * 4) % 4]
      : t === "suv" && r < 0.35
        ? LIVERY[Math.floor(r * 97) % 4]
        : PAL[Math.floor(r * PAL.length) % PAL.length];
}

class Inst {
  constructor(geo, mat, max, name, shadow) {
    const g = geo.clone();
    this.tint = new THREE.InstancedBufferAttribute(
      new Float32Array(max * 3),
      3,
    ).setUsage(THREE.DynamicDrawUsage);
    this.state = new THREE.InstancedBufferAttribute(
      new Float32Array(max),
      1,
    ).setUsage(THREE.DynamicDrawUsage);
    this.seed = new THREE.InstancedBufferAttribute(
      new Float32Array(max),
      1,
    ).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aTint", this.tint);
    g.setAttribute("aState", this.state);
    g.setAttribute("aSeed", this.seed);
    this.mesh = new THREE.InstancedMesh(g, mat, max);
    this.mesh.name = name;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow;
    this.mesh.receiveShadow = true;
    this.mesh.userData.maxCascade = 1;
    this.mesh.userData.smallCasters = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.visible = false;
    this.max = max;
    this.n = 0;
  }
  push(m, tint, seed) {
    if (this.n >= this.max) return false;
    const k = this.n++;
    m.toArray(this.mesh.instanceMatrix.array, k * 16);
    this.tint.array.set(tint, k * 3);
    this.seed.array[k] = seed;
    return true;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    if (!this.n) return;
    for (const a of [this.mesh.instanceMatrix, this.tint, this.seed]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.n * a.itemSize);
      a.needsUpdate = true;
    }
  }
}

export function createVehicleSet({
  models,
  group,
  counts,
  name = "veh",
  maxHi = 40,
  maxLow = 400,
  maxFar = 3000,
}) {
  const G = models?.geos ?? {};
  const types = VTYPES.filter((T) => counts[T.t]);
  if (
    !types.every((T) => G[T.t] && G[T.t + "_l1"]) ||
    !["sedan", "suv", "van", "truck"].every((f) => G[f + "_l2"])
  )
    return null;
  const map = models.atlas;
  const mats = {
    hi: createVehicleMaterial({ name: "veh0", map }),
    low: createVehicleMaterial({ name: "veh1", map }),
    far: createVehicleMaterial({ name: "veh2", map, physical: false }),
  };
  const tiers = {},
    far = {},
    all = [];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const T of types) {
    const n = counts[T.t];
    tiers[T.t] = {
      hi: new Inst(
        G[T.t],
        mats.hi,
        Math.min(n, maxHi),
        `${name}-hi-${T.t}`,
        true,
      ),
      low: new Inst(
        G[T.t + "_l1"],
        mats.low,
        Math.min(n, maxLow),
        `${name}-low-${T.t}`,
        true,
      ),
    };
    all.push(tiers[T.t].hi, tiers[T.t].low);
  }
  for (const f of ["sedan", "suv", "van", "truck"]) {
    far[f] = new Inst(
      G[f + "_l2"],
      mats.far,
      Math.min(total, maxFar),
      `${name}-far-${f}`,
      false,
    );
    all.push(far[f]);
  }
  for (const k of all) group.add(k.mesh);
  const farOf = Object.fromEntries(VTYPES.map((T) => [T.t, T.far]));
  const lenOf = Object.fromEntries(VTYPES.map((T) => [T.t, T.len]));
  const _m = new THREE.Matrix4(),
    _q = new THREE.Quaternion(),
    _q2 = new THREE.Quaternion(),
    _p = new THREE.Vector3(),
    _s = new THREE.Vector3(1, 1, 1),
    _ax = new THREE.Vector3();
  const _fr = new THREE.Frustum(),
    _pv = new THREE.Matrix4(),
    _sph = new THREE.Sphere();
  let cp = null,
    farD2 = Infinity;
  return {
    meshes: all.map((k) => k.mesh),
    begin(camera, farCut = Infinity) {
      camera.updateMatrixWorld();
      _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _fr.setFromProjectionMatrix(_pv);
      cp = camera.position;
      farD2 = farCut * farCut;
      for (const k of all) k.n = 0;
    },
    push(t, x, y, z, yaw, pitch, tint, seed) {
      const dx = x - cp.x,
        dy = y - cp.y,
        dz = z - cp.z,
        d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > farD2) return;
      if (d2 > 1600) {
        _sph.center.set(x, y + 1.5, z);
        _sph.radius = lenOf[t] * 0.6 + 1;
        if (!_fr.intersectsSphere(_sph)) return;
      }
      _q.setFromAxisAngle(_ax.set(0, 1, 0), yaw);
      if (pitch) _q.multiply(_q2.setFromAxisAngle(_ax.set(0, 0, 1), pitch));
      _m.compose(_p.set(x, y, z), _q, _s);
      const T = tiers[t];
      if (d2 < HI_D * HI_D && T.hi.push(_m, tint, seed)) return;
      if (d2 < LOW_D * LOW_D && T.low.push(_m, tint, seed)) return;
      far[farOf[t]].push(_m, tint, seed);
    },
    end() {
      for (const k of all) k.end();
    },
    hide() {
      for (const k of all) {
        k.n = 0;
        k.end();
      }
    },
  };
}
