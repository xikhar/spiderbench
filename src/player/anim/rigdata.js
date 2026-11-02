// OWNER: animation agent.
// Derived skeleton metrics (character space) + finger curl + common procedural helpers shared by generators.
import * as THREE from "three";
import { X, Y, Z, frameRot } from "./builder.js";

const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _q = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion();

export class RigData {
  constructor(skel) {
    this.s = skel;
    const P = (k) => {
      const i = skel.idx(k);
      return i < 0 ? null : skel.bP(i, new THREE.Vector3());
    };
    this.hipsP = P("hips") || new THREE.Vector3(0, 0.95, 0);
    this.hipY = this.hipsP.y;
    this.thigh = { L: P("upperLegL"), R: P("upperLegR") };
    this.knee = { L: P("lowerLegL"), R: P("lowerLegR") };
    this.ankle = { L: P("footL"), R: P("footR") };
    this.shoulder = { L: P("upperArmL"), R: P("upperArmR") };
    this.elbow = { L: P("lowerArmL"), R: P("lowerArmR") };
    this.wrist = { L: P("handL"), R: P("handR") };
    const ti = { L: skel.idx("toeL"), R: skel.idx("toeR") };
    this.toe = {
      L:
        ti.L >= 0
          ? skel.bP(ti.L, new THREE.Vector3())
          : this.ankle.L.clone().add(new THREE.Vector3(0, -0.06, 0.13)),
      R:
        ti.R >= 0
          ? skel.bP(ti.R, new THREE.Vector3())
          : this.ankle.R.clone().add(new THREE.Vector3(0, -0.06, 0.13)),
    };
    this.l1 = this.thigh.L.distanceTo(this.knee.L);
    this.l2 = this.knee.L.distanceTo(this.ankle.L);
    this.legLen = this.l1 + this.l2;
    this.a1 = this.shoulder.L.distanceTo(this.elbow.L);
    this.a2 = this.elbow.L.distanceTo(this.wrist.L);
    this.ankleH = this.ankle.L.y; // ankle height above sole when standing
    // ball of foot (toe joint) relative to ankle, in bind char space
    this.ballOff = this.toe.L.clone().sub(this.ankle.L); // (x,y,z) mostly forward/down
    this.heelOff = new THREE.Vector3(0, -this.ankleH, -0.06);
    this.hipHalfW = Math.abs(this.thigh.L.x - this.thigh.R.x) / 2;
    this.shoulderHalfW = Math.abs(this.shoulder.L.x - this.shoulder.R.x) / 2;
    // finger curl axes (bone-local) — rotate around the hand's "across" axis (index -> pinky)
    this.fingers = { L: [], R: [] };
    for (const S of ["L", "R"]) {
      const h = skel.idx("hand" + S);
      if (h < 0) continue;
      const kids = [];
      for (let i = 0; i < skel.N; i++) {
        let p = skel.parent[i];
        while (p >= 0 && p !== h) p = skel.parent[p];
        if (p === h) kids.push(i);
      }
      const nm = (i) => skel.bones[i].name.toLowerCase();
      const idx1 = kids.find(
          (i) => /index/.test(nm(i)) && skel.parent[i] === h,
        ),
        pin1 = kids.find(
          (i) => /pinky|ring/.test(nm(i)) && skel.parent[i] === h,
        );
      const across =
        idx1 != null && pin1 != null
          ? skel
              .bP(pin1, new THREE.Vector3())
              .sub(skel.bP(idx1, _v))
              .normalize()
          : new THREE.Vector3(S === "L" ? -1 : 1, 0, 0);
      const sgn = S === "L" ? 1 : -1;
      for (const i of kids) {
        const n = nm(i),
          thumb = /thumb/.test(n);
        const seg = +(n.match(/(\d)/)?.[1] || 1) - 1;
        const m = n.match(/^(thumb|index|middle|ring|pinky)/)?.[1] || "middle";
        const inv = skel.bQ(i, new THREE.Quaternion()).invert();
        let axisChar = across.clone();
        if (thumb) {
          // thumb folds across the palm: rotate around the finger direction of the hand
          const mid = kids.find(
            (j) => /middle/.test(nm(j)) && skel.parent[j] === h,
          );
          axisChar =
            mid != null
              ? skel
                  .bP(mid, new THREE.Vector3())
                  .sub(skel.bP(h, _v))
                  .normalize()
              : Y.clone().negate();
        }
        const local = axisChar.applyQuaternion(inv).normalize();
        const segA = thumb
          ? [0, 0.5, 0.6][seg] * -1
          : [1.2, 1.5, 1.0][seg] *
            (m === "index" ? 0.92 : m === "pinky" ? 1.08 : 1);
        this.fingers[S].push({ i, axis: local, amt: segA * sgn });
      }
    }
  }
  // Curl fingers of side S in `pose` (0 flat .. 1 fist), relative to the bind local rotation; w blends toward it.
  curl(pose, S, amount, w = 1, spread = 0) {
    for (const f of this.fingers[S]) {
      this.s.rest.getQ(f.i, _q);
      _q2.setFromAxisAngle(f.axis, f.amt * amount);
      _q.multiply(_q2);
      if (w < 1) {
        pose.getQ(f.i, _q2);
        _q2.slerp(_q, w);
        pose.setQ(f.i, _q2);
      } else pose.setQ(f.i, _q);
    }
  }
}

// Arm directions from anatomical angles (character space). S: 'L'|'R'.
//  flex: shoulder flexion (forward swing, + = forward/up), abd: abduction (out to the side), elbow: bend (0 straight).
//  Returns { elbow, hand } target positions relative to the shoulder joint (char space).
export function armTarget(
  rd,
  S,
  flex,
  abd,
  elbow,
  out = { elbow: new THREE.Vector3(), hand: new THREE.Vector3() },
  twist = 0,
) {
  const sx = S === "L" ? 1 : -1;
  const u = new THREE.Vector3(
    Math.sin(abd) * sx,
    -Math.cos(abd) * Math.cos(flex),
    Math.cos(abd) * Math.sin(flex),
  ).normalize();
  // hinge: forearm folds forward/up relative to the upper arm, rotated by `twist` (internal rotation brings forearm across the body)
  let h = new THREE.Vector3().crossVectors(u, Z);
  if (h.lengthSq() < 1e-3) h.set(-1, 0, 0);
  h.normalize();
  if (twist) h.applyAxisAngle(u, twist * sx);
  const l = u.clone().applyAxisAngle(h, elbow);
  out.elbow.copy(u).multiplyScalar(rd.a1);
  out.hand.copy(out.elbow).addScaledVector(l, rd.a2);
  return out;
}
