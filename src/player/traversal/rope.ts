// @ts-nocheck
// OWNER: traversal engineer. Web tightrope (T while perched): the shared strand model.
// One rope = a straight web strand between two anchors, A (the perch point he shot from) and B (the targeted perch /
// zip point), used by traversal (walking position), player/ropeweb.js (rendering) and the animator (foot contact).
//
// Shape along u (0 = A, 1 = B):
//   straight line A -> B
//   - rest sag      sag * 4u(1-u)                     (slight, ~0.2 % of the length)
//   - point load    dip * tri(u, load.u)              (a taut string under one point load bends into a V with its apex
//                                                      at the load: linear on both sides; dip itself ~ 4 u(1-u))
// so his feet (at load.u) sit exactly at the apex, and the strand dips under him and springs back when he leaves.
import * as THREE from "three";

export const ROPE = {
  MIN: 6,
  MAX: 120, // valid length (m)
  SLOPE: (30 * Math.PI) / 180, // max incline
  SPEED: 3.4, // walk speed on the line (m/s; the Shift ground walk is 1.4; user r13b: +25 %)
  ACC: 4.2,
  DEC: 5.5, // m/s^2
  AIM: 0.14, // T -> web leaves the hand (arm up + point)
  PIN: 0.16, // web hits the target -> near end pinned at our perch point
  STAND: 0.5, // stand-up from the perch crouch onto the line
  LINGER: 3.5,
  DROP: 0.8, // after he leaves: the strand stays, then lets go at B and falls away
};

export function makeRope() {
  return {
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    na: new THREE.Vector3(0, 1, 0),
    nb: new THREE.Vector3(0, 0, 1),
    dir: new THREE.Vector3(0, 0, 1),
    len: 1,
    lenH: 1,
    slope: 0,
    u: 0,
    v: 0,
    face: 1,
    lean: 0,
    sag: 0,
    dip: 0,
    dipV: 0,
    loadU: 0.5,
    load: 0,
    dipMax: 0.1,
    t: 0,
    fireT: ROPE.AIM,
    shootDur: 0.1,
    hitT: 0.3,
    pinT: 0.45,
    hit: false,
    pinned: false,
    gone: -1,
    drop: 0,
    alive: true,
    fromStand: false,
    target: { pos: new THREE.Vector3(), normal: new THREE.Vector3(), kind: "" },
    start: null, // perch struct copy of the start point (return-to-perch)
  };
}

// point on the strand at u (world). R.loadU / R.dip describe the current point load.
export function ropePoint(R, u, out) {
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  out.copy(R.a).lerp(R.b, u);
  let y = R.sag * 4 * u * (1 - u);
  if (R.dip !== 0) {
    const p = Math.min(0.999, Math.max(0.001, R.loadU));
    y += R.dip * (u < p ? u / p : (1 - u) / (1 - p));
  }
  out.y -= y;
  return out;
}
export const ropeY = (R, u) => ropePoint(R, u, _p).y;
const _p = new THREE.Vector3();

// dip spring toward the current load (load 0..1 = someone standing on it); bounces a little when he steps on / off
export function stepRopeSpring(R, dt) {
  const u = R.loadU,
    want = R.load * R.dipMax * 4 * u * (1 - u);
  const k = 55,
    c = 2 * 0.32 * Math.sqrt(k);
  R.dipV += ((want - R.dip) * k - R.dipV * c) * dt;
  R.dip += R.dipV * dt;
}
