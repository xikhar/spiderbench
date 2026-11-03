// @ts-nocheck
// OWNER: traversal engineer. Web tightrope strands (traversal s.ropes, model in traversal/rope.js), drawn with the same
// screen-space web ribbon as the swing / zip webs (web.js Strands), one mesh for up to SLOTS ropes.
//  shoot : the strand leaves the right palm and flies to the target (ease-out, wavy while flying), then the palm brings
//          the near end down and it is pinned at the perch point (near end hand -> anchor A over the last 0.1 s)
//  taut  : ropePoint() A -> B (rest sag + the V under his feet), splayed fork strands at both anchors
//  drop  : ROPE.LINGER s after he leaves, it lets go at the far end and falls away toward the start anchor, thinning out
import * as THREE from "three";
import { Strands } from "./web.ts";
import { ropePoint } from "./traversal/rope.ts";

const SEG = 48,
  NF = 3,
  FSEG = 5,
  SLOTS = 3,
  PER = 1 + 2 * NF;
const smooth = (x) => {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
};

export function createRopeWebs(scene) {
  const counts = [];
  for (let i = 0; i < SLOTS; i++) counts.push(SEG, ...Array(2 * NF).fill(FSEG));
  const strands = new Strands(counts);
  strands.mesh.name = "WebRopes";
  scene.add(strands.mesh);
  const pts = [...Array(SEG + 1)].map(() => new THREE.Vector3()),
    fp = [...Array(FSEG + 1)].map(() => new THREE.Vector3());
  const _a = new THREE.Vector3(),
    _b = new THREE.Vector3(),
    _c = new THREE.Vector3(),
    _d = new THREE.Vector3(),
    _e = new THREE.Vector3();
  let time = 0;

  function hideSlot(k) {
    for (let j = 0; j < PER; j++) strands.hideStrand(k * PER + j);
  }
  // splayed fork strands from a point on the strand (from) to around the anchor, on the surface plane (normal n)
  function forks(si0, from, anchor, n, seed, spread, width) {
    _a.set(0, 1, 0);
    if (Math.abs(n.y) > 0.9) _a.set(1, 0, 0);
    const t1 = _b.crossVectors(n, _a).normalize(),
      t2 = _c.crossVectors(n, t1).normalize();
    for (let f = 0; f < NF; f++) {
      const ang =
        seed * 6.28 + f * ((Math.PI * 2) / NF) + Math.sin(seed * 11 + f) * 0.4;
      const r = spread * (0.6 + 0.4 * Math.abs(Math.sin(seed * 5 + f * 1.7)));
      const end = _d
        .copy(anchor)
        .addScaledVector(t1, Math.cos(ang) * r)
        .addScaledVector(t2, Math.sin(ang) * r)
        .addScaledVector(n, 0.015);
      for (let i = 0; i <= FSEG; i++) fp[i].copy(from).lerp(end, i / FSEG);
      strands.setStrand(si0 + f, fp, 0.5 * width);
    }
  }
  function drawRope(k, R, hand) {
    const base = k * PER;
    if (!R.fired || (R.gone >= 0 && !R.pinned)) {
      hideSlot(k);
      return;
    }
    const L = R.len,
      seed = R.seed ?? (R.seed = Math.random());
    let width = 1,
      hitK = 0,
      pinK = 0;
    if (!R.pinned || R.t < R.pinT + 0.02) {
      // shooting: palm -> (flying end) -> target, then the near end goes from the palm down to the perch point
      const k0 = Math.min(1, Math.max(0, (R.t - R.fireT) / R.shootDur)),
        ext = 1 - Math.pow(1 - k0, 3);
      const near = _e
        .copy(hand)
        .lerp(R.a, smooth((R.t - (R.pinT - 0.1)) / 0.1));
      const dir = _a.copy(R.b).sub(near);
      const D = dir.length();
      dir.divideScalar(Math.max(D, 1e-4));
      const p1 = _b.set(0, 1, 0).cross(dir);
      if (p1.lengthSq() < 1e-4) p1.set(1, 0, 0);
      p1.normalize();
      const since = Math.max(0, R.t - R.hitT),
        wave =
          (1 - ext) * 0.3 +
          Math.exp(-since * 10) * 0.12 * (ext >= 1 ? 1 : 0) +
          0.01;
      for (let i = 0; i <= SEG; i++) {
        const s = (i / SEG) * ext,
          env = Math.sin(Math.min(1, s / Math.max(ext, 1e-3)) * Math.PI);
        pts[i]
          .copy(near)
          .addScaledVector(dir, D * s)
          .addScaledVector(
            p1,
            Math.sin(s * D * 0.9 - time * 22 + seed * 40) * wave * env,
          );
        pts[i].y -= Math.cos(s * D * 0.6 + seed * 9) * wave * 0.5 * env;
      }
      hitK = R.hit ? 1 : 0;
    } else {
      for (let i = 0; i <= SEG; i++) ropePoint(R, i / SEG, pts[i]);
      hitK = 1;
      pinK = 1;
      if (R.drop > 0) {
        // let go at the far end: the free end falls and swings in toward the start anchor
        const r = R.drop;
        for (let i = 0; i <= SEG; i++) {
          const f = i / SEG;
          pts[i]
            .sub(R.a)
            .multiplyScalar(1 - 0.35 * r * f)
            .add(R.a);
          pts[i].y -= Math.min(L * 0.5, 3.5) * r * r * f * f;
        }
        width = 1 - 0.75 * r;
        hitK = 0;
      }
    }
    strands.setStrand(base, pts, width);
    if (hitK)
      forks(
        base + 1,
        pts[Math.floor(SEG * 0.985)],
        R.b,
        R.nb,
        seed,
        0.28,
        width,
      );
    else for (let f = 0; f < NF; f++) strands.hideStrand(base + 1 + f);
    if (pinK)
      forks(
        base + 1 + NF,
        pts[Math.ceil(SEG * 0.015)],
        R.a,
        R.na,
        seed + 0.37,
        0.22,
        width,
      );
    else for (let f = 0; f < NF; f++) strands.hideStrand(base + 1 + NF + f);
  }

  return {
    mesh: strands.mesh,
    // ropes: traversal s.ropes (newest last), hand: the right palm (world) for a strand being shot
    update(dt, ropes, hand, renderer) {
      time += dt;
      const res = renderer.getDrawingBufferSize(_a);
      strands.mat.uniforms.uRes.value.set(res.x, res.y);
      const n = ropes ? ropes.length : 0;
      for (let k = 0; k < SLOTS; k++) {
        const R = ropes && ropes[n - SLOTS + k]; // the newest SLOTS ropes
        if (R) drawRope(k, R, hand);
        else hideSlot(k);
      }
      strands.commit();
    },
  };
}
