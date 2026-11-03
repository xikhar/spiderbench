// @ts-nocheck
// OWNER: animation agent.
// PoseBuilder: character-space procedural editing of a Pose (FK-aware), incl. analytic 2-bone IK.
// All positions/directions are in character space (X = left, Y = up, Z = forward, feet at y = 0).
import * as THREE from "three";

const _q = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion(),
  _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _v3 = new THREE.Vector3(),
  _v4 = new THREE.Vector3(),
  _v5 = new THREE.Vector3();
const _e = new THREE.Euler();
export const X = new THREE.Vector3(1, 0, 0),
  Y = new THREE.Vector3(0, 1, 0),
  Z = new THREE.Vector3(0, 0, 1);

export class PoseBuilder {
  constructor(skel) {
    this.s = skel;
    this.pose = null;
    this.dirty = true;
  }
  begin(pose) {
    this.pose = pose;
    this.dirty = true;
    return this;
  }
  fk() {
    if (this.dirty || this.gen !== this.s.gen) {
      this.s.fk(this.pose);
      this.dirty = false;
      this.gen = this.s.gen;
    }
  }
  i(k) {
    return typeof k === "number" ? k : this.s.idx(k);
  }
  pos(k, out = new THREE.Vector3()) {
    const i = this.i(k);
    if (i < 0) return out.set(0, 0, 0);
    this.fk();
    return this.s.cP(i, out);
  }
  cq(k, out = new THREE.Quaternion()) {
    const i = this.i(k);
    this.fk();
    return this.s.cQ(i, out);
  }
  // Set bone's character-space rotation (children follow).
  setCQ(k, Q, w = 1) {
    const i = this.i(k);
    if (i < 0 || w <= 0) return this;
    this.fk();
    this.s.parentCQ(i, _q2).invert().multiply(Q);
    if (w < 1) {
      this.pose.getQ(i, _q3);
      _q3.slerp(_q2, w);
      this.pose.setQ(i, _q3);
    } else this.pose.setQ(i, _q2);
    this.dirty = true;
    return this;
  }
  // Rotate a bone about a character-space axis (pre-multiply in char space).
  rot(k, axis, angle) {
    const i = this.i(k);
    if (i < 0 || !angle) return this;
    this.fk();
    this.s.cQ(i, _q);
    _q3.setFromAxisAngle(axis, angle);
    _q.premultiply(_q3);
    return this.setCQ(i, _q.clone());
  }
  // Euler (YXZ: yaw, pitch, roll) rotation in character space about the bone's own pivot. [pitch(X), yaw(Y), roll(Z)]
  rotE(k, pitch = 0, yaw = 0, roll = 0) {
    if (!pitch && !yaw && !roll) return this;
    const i = this.i(k);
    if (i < 0) return this;
    this.fk();
    this.s.cQ(i, _q);
    _q3.setFromEuler(_e.set(pitch, yaw, roll, "YXZ"));
    _q.premultiply(_q3);
    return this.setCQ(i, _q.clone());
  }
  // Local-space (bone parent frame) rotation relative to the bone's current local quaternion, expressed in character axes
  // of the bone's *current* orientation (i.e. post-multiply). Useful for twists.
  twist(k, angle) {
    const i = this.i(k);
    if (i < 0 || !angle) return this;
    const c = this.s.child[i];
    if (c < 0) return this;
    this.fk();
    const a = this.s.cP(c, _v).sub(this.s.cP(i, _v2)).normalize();
    return this.rot(i, a.clone(), angle);
  }
  // Point bone k (toward its child) along char-space direction d. Weighted.
  aim(k, d, w = 1) {
    const i = this.i(k);
    if (i < 0 || w <= 0) return this;
    const c = this.s.child[i];
    if (c < 0) return this;
    this.fk();
    const cur = this.s.cP(c, _v).sub(this.s.cP(i, _v2)).normalize();
    _q.setFromUnitVectors(cur, _v3.copy(d).normalize());
    if (w < 1) _q.slerp(_q3.identity(), 1 - w);
    this.s.cQ(i, _q2);
    _q2.premultiply(_q);
    return this.setCQ(i, _q2.clone());
  }
  // Rotate bone so its bind-frame orientation is transformed by char-space rotation R (absolute pose from bind).
  fromBind(k, R, w = 1) {
    const i = this.i(k);
    if (i < 0) return this;
    this.s.bQ(i, _q).premultiply(R);
    return this.setCQ(i, _q.clone(), w);
  }
  // Hips translation in character space (added to current).
  moveHips(dx, dy, dz) {
    const i = this.i("hips");
    if (i < 0) return this;
    const S = this.s.scale;
    const pi = this.s.parent[i];
    _v.set(dx, dy, dz);
    if (pi < 0) _v.applyQuaternion(_q.copy(this.s.baseQ[i]).invert());
    else {
      this.fk();
      this.s.cQ(pi, _q).invert();
      _v.applyQuaternion(_q);
    }
    this.pose.getP(i, _v2).addScaledVector(_v, 1 / S);
    this.pose.setP(i, _v2);
    this.dirty = true;
    return this;
  }
  setHipsChar(p) {
    // absolute char-space hips position
    this.fk();
    const cur = this.s.cP(this.i("hips"), _v4);
    return this.moveHips(p.x - cur.x, p.y - cur.y, p.z - cur.z);
  }
  // Analytic 2-bone IK. limb 'L'|'R' + kind 'arm'|'leg'. target: end-joint (wrist/ankle) char position.
  // pole: char-space point the middle joint bends toward. Returns unclamped reach ratio (>1 = overextended).
  ik(kind, S, target, pole, w = 1, { absolute = true, keepEnd = false } = {}) {
    const a = this.i((kind === "arm" ? "upperArm" : "upperLeg") + S),
      b = this.i((kind === "arm" ? "lowerArm" : "lowerLeg") + S),
      c = this.i((kind === "arm" ? "hand" : "foot") + S);
    if (a < 0 || b < 0 || c < 0 || w <= 0) return 0;
    this.fk();
    const A = this.s.cP(a, new THREE.Vector3()),
      B0 = this.s.cP(b, new THREE.Vector3()),
      C0 = this.s.cP(c, new THREE.Vector3());
    const l1 = A.distanceTo(B0),
      l2 = B0.distanceTo(C0);
    const T = _v5.copy(target);
    if (w < 1) T.lerpVectors(C0, target, w);
    const toT = T.clone().sub(A);
    const dRaw = toT.length();
    const d = THREE.MathUtils.clamp(
      dRaw,
      Math.abs(l1 - l2) + 1e-3,
      (l1 + l2) * 0.9995,
    );
    const dir = toT.normalize();
    const pv = (pole ? pole.clone() : B0.clone()).sub(A);
    pv.addScaledVector(dir, -pv.dot(dir));
    if (pv.lengthSq() < 1e-8) {
      pv.copy(B0).sub(A);
      pv.addScaledVector(dir, -pv.dot(dir));
      if (pv.lengthSq() < 1e-8) pv.set(0, 0, 1);
    }
    pv.normalize();
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
      h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const mid = A.clone().addScaledVector(dir, x).addScaledVector(pv, h);
    const end = A.clone().addScaledVector(dir, d);
    if (absolute) {
      // Absolute hinge IK: bone frames are rebuilt from bind so the joint hinge axis is perpendicular to the
      // bend plane (no candy-wrapper twist). Bind hinge: legs bend with the pole in front (+Z), arms behind (-Z).
      const bindPole = kind === "arm" ? _v.set(0, 0, -1) : _v.set(0, 0, 1);
      const u0 = this.s
        .bP(b, new THREE.Vector3())
        .sub(this.s.bP(a, _v2))
        .normalize();
      const l0 = this.s
        .bP(c, new THREE.Vector3())
        .sub(this.s.bP(b, _v2))
        .normalize();
      const h0 = new THREE.Vector3().crossVectors(u0, bindPole).normalize();
      const u1 = mid.clone().sub(A).normalize(),
        l1v = end.clone().sub(mid).normalize();
      const h1 = new THREE.Vector3().crossVectors(u1, pv).normalize();
      if (h1.lengthSq() < 0.5) h1.copy(h0);
      const Ru = frameRot(u0, h0, u1, h1),
        Rl = frameRot(l0, h0, l1v, h1);
      const endQ = this.s.cQ(c, new THREE.Quaternion());
      if (w < 1) {
        this.fromBind(a, Ru, w);
        this.fromBind(b, Rl, w);
      } else {
        this.fromBind(a, Ru);
        this.fromBind(b, Rl);
      }
      if (keepEnd) this.setCQ(c, endQ);
      return dRaw / (l1 + l2);
    }
    // relative: minimal rotations (keeps the clip's limb twist)
    const endQ = this.s.cQ(c, new THREE.Quaternion());
    this._aimTo(a, B0.clone().sub(A), mid.clone().sub(A));
    this.fk();
    const B1 = this.s.cP(b, new THREE.Vector3()),
      C1 = this.s.cP(c, new THREE.Vector3());
    this._aimTo(b, C1.sub(B1), end.clone().sub(B1));
    if (keepEnd) this.setCQ(c, endQ);
    return dRaw / (l1 + l2);
  }
  _aimTo(i, from, to) {
    _q.setFromUnitVectors(from.normalize(), to.normalize());
    this.fk();
    this.s.cQ(i, _q2);
    _q2.premultiply(_q);
    this.setCQ(i, _q2.clone());
  }
  // Orient the end effector (hand/foot) so that its bone "forward" (toward child) points along d and its
  // bind-frame "up" reference (refAxisBind in bind char space) lines up as close as possible with `up`.
  orient(k, d, up, refAxisBind = Y, w = 1) {
    const i = this.i(k);
    if (i < 0 || w <= 0) return this;
    const c = this.s.child[i];
    // bind frame: f0 = bind dir to child, u0 = refAxisBind ortho'd
    const f0 =
      c >= 0
        ? this.s.bP(c, _v).sub(this.s.bP(i, _v2)).normalize().clone()
        : Z.clone();
    const u0 = refAxisBind
      .clone()
      .addScaledVector(f0, -refAxisBind.dot(f0))
      .normalize();
    const f1 = d.clone().normalize(),
      u1 = up.clone().addScaledVector(f1, -up.dot(f1)).normalize();
    const m0 = new THREE.Matrix4().makeBasis(
      f0,
      u0,
      new THREE.Vector3().crossVectors(f0, u0),
    );
    const m1 = new THREE.Matrix4().makeBasis(
      f1,
      u1,
      new THREE.Vector3().crossVectors(f1, u1),
    );
    const R = new THREE.Quaternion().setFromRotationMatrix(
      m1.multiply(m0.transpose()),
    );
    return this.fromBind(i, R, w);
  }
}

const _fm0 = new THREE.Matrix4(),
  _fm1 = new THREE.Matrix4();
// Rotation taking orthonormal-ish frame (d0, h0) onto (d1, h1).
export function frameRot(d0, h0, d1, h1, out = new THREE.Quaternion()) {
  const a0 = d0.clone().normalize(),
    b0 = h0.clone().addScaledVector(a0, -h0.dot(a0)).normalize(),
    c0 = new THREE.Vector3().crossVectors(a0, b0);
  const a1 = d1.clone().normalize(),
    b1 = h1.clone().addScaledVector(a1, -h1.dot(a1)).normalize(),
    c1 = new THREE.Vector3().crossVectors(a1, b1);
  _fm0.makeBasis(a0, b0, c0);
  _fm1.makeBasis(a1, b1, c1);
  return out.setFromRotationMatrix(_fm1.multiply(_fm0.transpose()));
}

// ---------------------------------------------------------------- small math helpers
export const clamp = THREE.MathUtils.clamp,
  lerp = THREE.MathUtils.lerp;
export const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export const smoother = (t) => {
  t = clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const remap = (x, a, b, c = 0, d = 1) =>
  lerp(c, d, clamp((x - a) / (b - a), 0, 1));
export const damp = (a, b, rate, dt) =>
  a + (b - a) * (1 - Math.exp(-rate * dt));
export const TAU = Math.PI * 2;
// Critically damped spring (value + velocity) — used for secondary motion.
export class Spring {
  constructor(x = 0, freq = 4, zeta = 0.6) {
    this.x = x;
    this.v = 0;
    this.f = freq;
    this.z = zeta;
  }
  step(target, dt) {
    const w = TAU * this.f,
      z = this.z;
    const n = Math.max(1, Math.ceil(dt / (1 / 120))),
      h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = w * w * (target - this.x) - 2 * z * w * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}
export class Spring3 {
  constructor(freq = 4, zeta = 0.6) {
    this.x = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.f = freq;
    this.z = zeta;
  }
  step(target, dt) {
    const w = TAU * this.f,
      z = this.z;
    const n = Math.max(1, Math.ceil(dt / (1 / 120))),
      h = dt / n;
    for (let i = 0; i < n; i++) {
      const ax = w * w * (target.x - this.x.x) - 2 * z * w * this.v.x,
        ay = w * w * (target.y - this.x.y) - 2 * z * w * this.v.y,
        az = w * w * (target.z - this.x.z) - 2 * z * w * this.v.z;
      this.v.x += ax * h;
      this.v.y += ay * h;
      this.v.z += az * h;
      this.x.addScaledVector(this.v, h);
    }
    return this.x;
  }
}
// Cubic bezier in 2D/3D
export function bez(p0, p1, p2, p3, t, out) {
  const u = 1 - t,
    a = u * u * u,
    b = 3 * u * u * t,
    c = 3 * u * t * t,
    d = t * t * t;
  return out.set(
    p0.x * a + p1.x * b + p2.x * c + p3.x * d,
    p0.y * a + p1.y * b + p2.y * c + p3.y * d,
    p0.z * a + p1.z * b + p2.z * c + p3.z * d,
  );
}
// deterministic smooth noise
export function noise1(x, seed = 0) {
  const h = (n) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(x),
    f = x - i,
    u = f * f * (3 - 2 * f);
  return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1;
}
