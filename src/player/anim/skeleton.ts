// @ts-nocheck
// OWNER: animation agent.
// Skeleton model + pose buffers for the animation layer.
//  - "character space" = the local frame of rig.object (X = char left, Y = up, Z = forward, feet at y=0).
//  - A Pose stores LOCAL quaternions for every bone + local positions (only the root-ish bones translate).
//  - Everything (clips, procedural generators, blends, mirroring) produces Poses; the animator writes the final
//    pose into the THREE bones once per frame, then runs world-space post IK.
import * as THREE from "three";

const _q = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion(),
  _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();

export class Pose {
  constructor(n) {
    this.n = n;
    this.q = new Float32Array(n * 4);
    this.p = new Float32Array(n * 3);
  }
  copy(o) {
    this.q.set(o.q);
    this.p.set(o.p);
    return this;
  }
  getQ(i, out) {
    const q = this.q,
      k = i * 4;
    return out.set(q[k], q[k + 1], q[k + 2], q[k + 3]);
  }
  setQ(i, v) {
    const q = this.q,
      k = i * 4;
    q[k] = v.x;
    q[k + 1] = v.y;
    q[k + 2] = v.z;
    q[k + 3] = v.w;
    return this;
  }
  getP(i, out) {
    const p = this.p,
      k = i * 3;
    return out.set(p[k], p[k + 1], p[k + 2]);
  }
  setP(i, v) {
    const p = this.p,
      k = i * 3;
    p[k] = v.x;
    p[k + 1] = v.y;
    p[k + 2] = v.z;
    return this;
  }
}

// out = a*(1-t) + b*t (nlerp with hemisphere fix; accurate enough for t-blends of nearby poses, and
// cheap). `mask` (Float32Array per bone, optional) scales t per bone.
// `mem` (Int8Array per bone, optional, one per blend site): hemisphere continuity. When a bone's two rotations are
// ~180 deg apart (dot ~ 0) the shortest way round flips sides as soon as the dot crosses zero, and the blended
// result jumps (user r-anim6: jump arms twisting in an instant = 134 deg in one frame). With `mem` the side chosen
// last frame is kept while the blend is partial; it is only re-chosen where that cannot pop: weight 0 / 1, or the
// two rotations close together (|dot| > 0.85).
export function blendPoses(a, b, t, out, mask = null, mem = null) {
  const n = a.n,
    qa = a.q,
    qb = b.q,
    qo = out.q,
    pa = a.p,
    pb = b.p,
    po = out.p;
  for (let i = 0; i < n; i++) {
    const w = mask ? t * mask[i] : t;
    const k = i * 4,
      j = i * 3;
    if (w <= 0) {
      if (mem) mem[i] = 0;
      if (out !== a) {
        qo[k] = qa[k];
        qo[k + 1] = qa[k + 1];
        qo[k + 2] = qa[k + 2];
        qo[k + 3] = qa[k + 3];
        po[j] = pa[j];
        po[j + 1] = pa[j + 1];
        po[j + 2] = pa[j + 2];
      }
      continue;
    }
    if (w >= 1) {
      if (mem) mem[i] = 0;
      qo[k] = qb[k];
      qo[k + 1] = qb[k + 1];
      qo[k + 2] = qb[k + 2];
      qo[k + 3] = qb[k + 3];
      po[j] = pb[j];
      po[j + 1] = pb[j + 1];
      po[j + 2] = pb[j + 2];
      continue;
    }
    const dot =
      qa[k] * qb[k] +
      qa[k + 1] * qb[k + 1] +
      qa[k + 2] * qb[k + 2] +
      qa[k + 3] * qb[k + 3];
    let sg = dot < 0 ? -1 : 1;
    if (mem) {
      if (mem[i] && Math.abs(dot) < 0.85) sg = mem[i];
      mem[i] = sg;
    }
    const s = sg * w,
      r = 1 - w;
    let x = qa[k] * r + qb[k] * s,
      y = qa[k + 1] * r + qb[k + 1] * s,
      z = qa[k + 2] * r + qb[k + 2] * s,
      ww = qa[k + 3] * r + qb[k + 3] * s;
    const l = 1 / Math.hypot(x, y, z, ww);
    qo[k] = x * l;
    qo[k + 1] = y * l;
    qo[k + 2] = z * l;
    qo[k + 3] = ww * l;
    po[j] = pa[j] * r + pb[j] * w;
    po[j + 1] = pa[j + 1] * r + pb[j + 1] * w;
    po[j + 2] = pa[j + 2] * r + pb[j + 2] * w;
  }
  return out;
}

// Accumulating weighted blend (for N-way blend spaces). Call begin, add..., end.
export class PoseAccum {
  constructor(n) {
    this.pose = new Pose(n);
    this.wsum = 0;
    this.ref = null;
  }
  begin() {
    this.pose.q.fill(0);
    this.pose.p.fill(0);
    this.wsum = 0;
    this.ref = null;
    return this;
  }
  add(src, w) {
    if (w <= 1e-5) return this;
    const n = src.n,
      q = this.pose.q,
      p = this.pose.p,
      sq = src.q,
      sp = src.p;
    if (!this.ref) this.ref = src;
    const rq = this.ref.q;
    for (let i = 0; i < n; i++) {
      const k = i * 4,
        j = i * 3;
      const d =
        sq[k] * rq[k] +
        sq[k + 1] * rq[k + 1] +
        sq[k + 2] * rq[k + 2] +
        sq[k + 3] * rq[k + 3];
      const s = d < 0 ? -w : w;
      q[k] += sq[k] * s;
      q[k + 1] += sq[k + 1] * s;
      q[k + 2] += sq[k + 2] * s;
      q[k + 3] += sq[k + 3] * s;
      p[j] += sp[j] * w;
      p[j + 1] += sp[j + 1] * w;
      p[j + 2] += sp[j + 2] * w;
    }
    this.wsum += w;
    return this;
  }
  end(out) {
    const n = out.n,
      q = this.pose.q,
      p = this.pose.p,
      oq = out.q,
      op = out.p,
      iw = this.wsum > 0 ? 1 / this.wsum : 0;
    for (let i = 0; i < n; i++) {
      const k = i * 4,
        j = i * 3;
      const l = Math.hypot(q[k], q[k + 1], q[k + 2], q[k + 3]);
      if (l > 1e-8) {
        oq[k] = q[k] / l;
        oq[k + 1] = q[k + 1] / l;
        oq[k + 2] = q[k + 2] / l;
        oq[k + 3] = q[k + 3] / l;
      }
      op[j] = p[j] * iw;
      op[j + 1] = p[j + 1] * iw;
      op[j + 2] = p[j + 2] * iw;
    }
    return out;
  }
}

// ---------------------------------------------------------------- skeleton
export class Skel {
  constructor(rigObject, logical) {
    this.root = rigObject;
    const list = [];
    rigObject.traverse((o) => {
      if (o.isBone || o.userData.isRigBone) list.push(o);
    });
    this.bones = list;
    const N = (this.N = list.length);
    this.index = new Map(list.map((b, i) => [b, i]));
    this.byName = new Map(list.map((b, i) => [b.name, i]));
    this.parent = new Int16Array(N);
    rigObject.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(rigObject.matrixWorld).invert();
    this.baseQ = [];
    this.baseP = [];
    this.scale = 1;
    this.rest = new Pose(N);
    for (let i = 0; i < N; i++) {
      const b = list[i];
      const pi = this.index.get(b.parent);
      this.parent[i] = pi ?? -1;
      this.rest.setQ(i, b.quaternion);
      this.rest.setP(i, b.position);
      if (pi == null) {
        // root bone: frame of its parent object in character space
        _m.multiplyMatrices(inv, b.parent.matrixWorld);
        const P = new THREE.Vector3(),
          Q = new THREE.Quaternion(),
          S = new THREE.Vector3();
        _m.decompose(P, Q, S);
        this.baseQ[i] = Q;
        this.baseP[i] = P;
        this.scale = S.y;
      }
    }
    // logical keys -> index
    this.key = {};
    for (const [k, b] of Object.entries(logical))
      if (b && this.index.has(b)) this.key[k] = this.index.get(b);
    // character-space FK buffers
    this.cq = new Float32Array(N * 4);
    this.cp = new Float32Array(N * 3);
    // rest FK -> bind char quats (A) and positions
    this.fk(this.rest);
    this.bindQ = Float32Array.from(this.cq);
    this.bindP = Float32Array.from(this.cp);
    // child lookup for aiming: first bone child
    this.child = new Int16Array(N).fill(-1);
    for (let i = N - 1; i >= 0; i--) {
      const p = this.parent[i];
      if (p >= 0) this.child[p] = i;
    }
    // prefer the logical chain children (upperArm->forearm etc.)
    const pref = {
      upperArmL: "lowerArmL",
      lowerArmL: "handL",
      upperArmR: "lowerArmR",
      lowerArmR: "handR",
      upperLegL: "lowerLegL",
      lowerLegL: "footL",
      upperLegR: "lowerLegR",
      lowerLegR: "footR",
      neck: "head",
      chest: "neck",
    };
    for (const [a, c] of Object.entries(pref))
      if (this.key[a] != null && this.key[c] != null)
        this.child[this.key[a]] = this.key[c];
    for (const S of ["L", "R"]) {
      // hand -> middle finger base; foot -> toe
      const h = this.key["hand" + S];
      if (h != null) {
        const m = list.findIndex(
          (b, i) => this.parent[i] === h && /middle/i.test(b.name),
        );
        if (m >= 0) this.child[h] = m;
      }
    }
    // mirror map (by name L<->R)
    this.mirror = new Int16Array(N);
    for (let i = 0; i < N; i++) {
      const n = list[i].name;
      let m = null;
      const cands = [
        n.replace(/L$/, "R"),
        n.replace(/R$/, "L"),
        n.replace(/Left/, "Right"),
        n.replace(/Right/, "Left"),
        n.replace(/\.L$/, ".R"),
        n.replace(/\.R$/, ".L"),
        n.replace(/_l$/, "_r"),
        n.replace(/_r$/, "_l"),
      ];
      for (const c of cands)
        if (c !== n && this.byName.has(c)) {
          m = this.byName.get(c);
          break;
        }
      this.mirror[i] = m ?? i;
    }
    // segment lengths (for IK), char-space
    this.len = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const c = this.child[i];
      if (c >= 0)
        this.len[i] = Math.hypot(
          this.bindP[c * 3] - this.bindP[i * 3],
          this.bindP[c * 3 + 1] - this.bindP[i * 3 + 1],
          this.bindP[c * 3 + 2] - this.bindP[i * 3 + 2],
        );
    }
  }
  idx(k) {
    return this.key[k] ?? -1;
  }
  // Character-space FK of a pose into this.cq / this.cp (or given buffers).
  fk(pose, cq = this.cq, cp = this.cp) {
    if (cq === this.cq) this.gen = (this.gen || 0) + 1;
    const N = this.N,
      par = this.parent,
      q = pose.q,
      p = pose.p,
      S = this.scale;
    for (let i = 0; i < N; i++) {
      const k = i * 4,
        j = i * 3,
        pi = par[i];
      let pqx, pqy, pqz, pqw, ppx, ppy, ppz;
      if (pi < 0) {
        const B = this.baseQ[i],
          P = this.baseP[i];
        pqx = B.x;
        pqy = B.y;
        pqz = B.z;
        pqw = B.w;
        ppx = P.x;
        ppy = P.y;
        ppz = P.z;
      } else {
        const a = pi * 4,
          b = pi * 3;
        pqx = cq[a];
        pqy = cq[a + 1];
        pqz = cq[a + 2];
        pqw = cq[a + 3];
        ppx = cp[b];
        ppy = cp[b + 1];
        ppz = cp[b + 2];
      }
      const lx = q[k],
        ly = q[k + 1],
        lz = q[k + 2],
        lw = q[k + 3];
      cq[k] = pqw * lx + pqx * lw + pqy * lz - pqz * ly;
      cq[k + 1] = pqw * ly - pqx * lz + pqy * lw + pqz * lx;
      cq[k + 2] = pqw * lz + pqx * ly - pqy * lx + pqz * lw;
      cq[k + 3] = pqw * lw - pqx * lx - pqy * ly - pqz * lz;
      // rotate local pos by parent quat
      const vx = p[j] * S,
        vy = p[j + 1] * S,
        vz = p[j + 2] * S;
      const ix = pqw * vx + pqy * vz - pqz * vy,
        iy = pqw * vy + pqz * vx - pqx * vz,
        iz = pqw * vz + pqx * vy - pqy * vx,
        iw = -pqx * vx - pqy * vy - pqz * vz;
      cp[j] = ppx + ix * pqw + iw * -pqx + iy * -pqz - iz * -pqy;
      cp[j + 1] = ppy + iy * pqw + iw * -pqy + iz * -pqx - ix * -pqz;
      cp[j + 2] = ppz + iz * pqw + iw * -pqz + ix * -pqy - iy * -pqx;
    }
  }
  // parent char quat of bone i (from current cq)
  parentCQ(i, out) {
    const pi = this.parent[i];
    if (pi < 0) return out.copy(this.baseQ[i]);
    const k = pi * 4;
    return out.set(this.cq[k], this.cq[k + 1], this.cq[k + 2], this.cq[k + 3]);
  }
  cQ(i, out) {
    const k = i * 4;
    return out.set(this.cq[k], this.cq[k + 1], this.cq[k + 2], this.cq[k + 3]);
  }
  cP(i, out) {
    const k = i * 3;
    return out.set(this.cp[k], this.cp[k + 1], this.cp[k + 2]);
  }
  bQ(i, out) {
    const k = i * 4;
    return out.set(
      this.bindQ[k],
      this.bindQ[k + 1],
      this.bindQ[k + 2],
      this.bindQ[k + 3],
    );
  }
  bP(i, out) {
    const k = i * 3;
    return out.set(this.bindP[k], this.bindP[k + 1], this.bindP[k + 2]);
  }

  // Mirror a pose across the character's YZ plane (left <-> right). Uses rotation deltas from bind in char space.
  mirrorPose(
    src,
    out,
    tmpQ = this._mq || (this._mq = new Float32Array(this.N * 4)),
  ) {
    const N = this.N;
    this.fk(src);
    const cq = this.cq,
      D = tmpQ;
    // D_i = C_i * A_i^-1
    for (let i = 0; i < N; i++) {
      this.cQ(i, _q);
      this.bQ(i, _q2).invert();
      _q.multiply(_q2);
      const k = i * 4;
      D[k] = _q.x;
      D[k + 1] = _q.y;
      D[k + 2] = _q.z;
      D[k + 3] = _q.w;
    }
    // hips/root translation: mirror char-space position of root bones
    const newC = this._mc || (this._mc = new Float32Array(N * 4));
    for (let i = 0; i < N; i++) {
      const m = this.mirror[i],
        km = m * 4,
        k = i * 4;
      _q.set(D[km], -D[km + 1], -D[km + 2], D[km + 3]); // reflect across X
      this.bQ(i, _q2);
      _q.multiply(_q2);
      newC[k] = _q.x;
      newC[k + 1] = _q.y;
      newC[k + 2] = _q.z;
      newC[k + 3] = _q.w;
    }
    for (let i = 0; i < N; i++) {
      const pi = this.parent[i],
        k = i * 4;
      if (pi < 0) _q2.copy(this.baseQ[i]);
      else
        _q2.set(
          newC[pi * 4],
          newC[pi * 4 + 1],
          newC[pi * 4 + 2],
          newC[pi * 4 + 3],
        );
      _q.set(newC[k], newC[k + 1], newC[k + 2], newC[k + 3]);
      _q2.invert().multiply(_q); // local = parentC^-1 * C
      out.setQ(i, _q2);
      // positions: only translate-able bones matter (roots). Mirror root local position in char space.
      if (pi < 0) {
        const m = this.mirror[i];
        src.getP(m, _v);
        _v.multiplyScalar(this.scale)
          .applyQuaternion(this.baseQ[m])
          .add(this.baseP[m]);
        _v.x = -_v.x + 0; // char-space
        _v.sub(this.baseP[i])
          .applyQuaternion(_q3.copy(this.baseQ[i]).invert())
          .divideScalar(this.scale);
        out.setP(i, _v);
      } else {
        src.getP(i, _v);
        out.setP(i, _v);
      }
    }
    return out;
  }

  // Write pose into the THREE bones.
  apply(pose) {
    const B = this.bones,
      q = pose.q,
      p = pose.p;
    for (let i = 0; i < this.N; i++) {
      const b = B[i],
        k = i * 4,
        j = i * 3;
      b.quaternion.set(q[k], q[k + 1], q[k + 2], q[k + 3]);
      b.position.set(p[j], p[j + 1], p[j + 2]);
    }
  }
  // Read the THREE bones into a pose.
  read(pose) {
    const B = this.bones;
    for (let i = 0; i < this.N; i++) {
      pose.setQ(i, B[i].quaternion);
      pose.setP(i, B[i].position);
    }
    return pose;
  }
}

// ---------------------------------------------------------------- clip sampling
export class ClipSampler {
  constructor(clip, skel) {
    this.clip = clip;
    this.duration = clip.duration;
    this.name = clip.name;
    this.tracks = [];
    this.keyed = new Uint8Array(skel.N);
    for (const tr of clip.tracks) {
      const pb = THREE.PropertyBinding.parseTrackName(tr.name);
      const i = skel.byName.get(pb.nodeName);
      if (i == null) continue;
      if (pb.propertyName !== "quaternion" && pb.propertyName !== "position")
        continue;
      const res = new Float32Array(pb.propertyName === "quaternion" ? 4 : 3);
      this.tracks.push({
        i,
        quat: pb.propertyName === "quaternion",
        interp: tr.createInterpolant(res),
        res,
      });
      this.keyed[i] = 1;
    }
  }
  // Sample at time t (seconds; wrapped if loop) into `pose` (untouched bones keep their values).
  sample(t, pose, loop = true) {
    const d = this.duration;
    if (loop) t = ((t % d) + d) % d;
    else t = Math.min(Math.max(t, 0), d);
    for (const tr of this.tracks) {
      const r = tr.interp.evaluate(t);
      if (tr.quat) {
        const k = tr.i * 4;
        pose.q[k] = r[0];
        pose.q[k + 1] = r[1];
        pose.q[k + 2] = r[2];
        pose.q[k + 3] = r[3];
      } else {
        const k = tr.i * 3;
        pose.p[k] = r[0];
        pose.p[k + 1] = r[1];
        pose.p[k + 2] = r[2];
      }
    }
    return pose;
  }
  sampleNorm(u, pose, loop = true) {
    return this.sample(u * this.duration, pose, loop);
  }
}
