/**
 * Skeleton pose data structures, blending, FK, and clip sampling.
 *
 * @module player-anim-skeleton
 * @version 1.0.0
 * @file src/player/anim/skeleton.ts
 * @since 0.0.1
 * @description Provides pose storage, blending/accumulation, skeleton forward kinematics, mirroring, and animation clip samplers.
 */

import * as THREE from "three";

const _q = new THREE.Quaternion(),
    _q2 = new THREE.Quaternion(),
    _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3(),
    _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();

export class Pose {
    n: number;
    q: Float32Array;
    p: Float32Array;
    constructor(n: number) {
        this.n = n;
        this.q = new Float32Array(n * 4);
        this.p = new Float32Array(n * 3);
    }
    copy(o: Pose): this {
        this.q.set(o.q);
        this.p.set(o.p);
        return this;
    }
    getQ(i: number, out: THREE.Quaternion): THREE.Quaternion {
        const q = this.q,
            k = i * 4;
        return out.set(q[k], q[k + 1], q[k + 2], q[k + 3]);
    }
    setQ(i: number, v: THREE.Quaternion): this {
        const q = this.q,
            k = i * 4;
        q[k] = v.x;
        q[k + 1] = v.y;
        q[k + 2] = v.z;
        q[k + 3] = v.w;
        return this;
    }
    getP(i: number, out: THREE.Vector3): THREE.Vector3 {
        const p = this.p,
            k = i * 3;
        return out.set(p[k], p[k + 1], p[k + 2]);
    }
    setP(i: number, v: THREE.Vector3): this {
        const p = this.p,
            k = i * 3;
        p[k] = v.x;
        p[k + 1] = v.y;
        p[k + 2] = v.z;
        return this;
    }
}

export function blendPoses(
    a: Pose,
    b: Pose,
    t: number,
    out: Pose,
    mask: Float32Array | null = null,
    mem: Int8Array | null = null,
): Pose {
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
        const x = qa[k] * r + qb[k] * s,
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

export class PoseAccum {
    pose: Pose;
    wsum: number;
    ref: Pose | null;
    constructor(n: number) {
        this.pose = new Pose(n);
        this.wsum = 0;
        this.ref = null;
    }
    begin(): this {
        this.pose.q.fill(0);
        this.pose.p.fill(0);
        this.wsum = 0;
        this.ref = null;
        return this;
    }
    add(src: Pose, w: number): this {
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
    end(out: Pose): Pose {
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

export class Skel {
    root: THREE.Object3D;
    bones: THREE.Object3D[];
    index: Map<THREE.Object3D, number>;
    byName: Map<string, number>;
    parent: Int16Array;
    baseQ: THREE.Quaternion[];
    baseP: THREE.Vector3[];
    scale: number;
    rest: Pose;
    N: number;
    key: Record<string, number>;
    cq: Float32Array;
    cp: Float32Array;
    bindQ: Float32Array;
    bindP: Float32Array;
    child: Int16Array;
    mirror: Int16Array;
    len: Float32Array;
    gen?: number;
    private _mq?: Float32Array;
    private _mc?: Float32Array;

    constructor(
        rigObject: THREE.Object3D,
        logical: Record<string, THREE.Object3D | undefined | null>,
    ) {
        this.root = rigObject;
        const list: THREE.Object3D[] = [];
        rigObject.traverse((o: any) => {
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
            const pi = this.index.get(b.parent as THREE.Object3D);
            this.parent[i] = pi ?? -1;
            this.rest.setQ(i, b.quaternion);
            this.rest.setP(i, b.position);
            if (pi == null) {
                _m.multiplyMatrices(
                    inv,
                    (b.parent as THREE.Object3D).matrixWorld,
                );
                const P = new THREE.Vector3(),
                    Q = new THREE.Quaternion(),
                    S = new THREE.Vector3();
                _m.decompose(P, Q, S);
                this.baseQ[i] = Q;
                this.baseP[i] = P;
                this.scale = S.y;
            } else {
                this.baseQ[i] = new THREE.Quaternion();
                this.baseP[i] = new THREE.Vector3();
            }
        }

        this.key = {};
        for (const [k, b] of Object.entries(logical))
            if (b && this.index.has(b)) this.key[k] = this.index.get(b)!;

        this.cq = new Float32Array(N * 4);
        this.cp = new Float32Array(N * 3);

        this.fk(this.rest);
        this.bindQ = Float32Array.from(this.cq);
        this.bindP = Float32Array.from(this.cp);

        this.child = new Int16Array(N).fill(-1);
        for (let i = N - 1; i >= 0; i--) {
            const p = this.parent[i];
            if (p >= 0) this.child[p] = i;
        }

        const pref: Record<string, string> = {
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
            const h = this.key["hand" + S];
            if (h != null) {
                const m = list.findIndex(
                    (b, i) => this.parent[i] === h && /middle/i.test(b.name),
                );
                if (m >= 0) this.child[h] = m;
            }
        }

        this.mirror = new Int16Array(N);
        for (let i = 0; i < N; i++) {
            const n = list[i].name;
            let m: number | null = null;
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
                    m = this.byName.get(c)!;
                    break;
                }
            this.mirror[i] = m ?? i;
        }

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
    idx(k: string): number {
        return this.key[k] ?? -1;
    }

    fk(
        pose: Pose,
        cq: Float32Array = this.cq,
        cp: Float32Array = this.cp,
    ): void {
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
            let pqx: number,
                pqy: number,
                pqz: number,
                pqw: number,
                ppx: number,
                ppy: number,
                ppz: number;
            if (pi < 0) {
                const B = this.baseQ[i] as THREE.Quaternion,
                    P = this.baseP[i] as THREE.Vector3;
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

    parentCQ(i: number, out: THREE.Quaternion): THREE.Quaternion {
        const pi = this.parent[i];
        if (pi < 0) return out.copy(this.baseQ[i] as THREE.Quaternion);
        const k = pi * 4;
        return out.set(
            this.cq[k],
            this.cq[k + 1],
            this.cq[k + 2],
            this.cq[k + 3],
        );
    }
    cQ(i: number, out: THREE.Quaternion): THREE.Quaternion {
        const k = i * 4;
        return out.set(
            this.cq[k],
            this.cq[k + 1],
            this.cq[k + 2],
            this.cq[k + 3],
        );
    }
    cP(i: number, out: THREE.Vector3): THREE.Vector3 {
        const k = i * 3;
        return out.set(this.cp[k], this.cp[k + 1], this.cp[k + 2]);
    }
    bQ(i: number, out: THREE.Quaternion): THREE.Quaternion {
        const k = i * 4;
        return out.set(
            this.bindQ[k],
            this.bindQ[k + 1],
            this.bindQ[k + 2],
            this.bindQ[k + 3],
        );
    }
    bP(i: number, out: THREE.Vector3): THREE.Vector3 {
        const k = i * 3;
        return out.set(this.bindP[k], this.bindP[k + 1], this.bindP[k + 2]);
    }

    mirrorPose(
        src: Pose,
        out: Pose,
        tmpQ = this._mq || (this._mq = new Float32Array(this.N * 4)),
    ): Pose {
        const N = this.N;
        this.fk(src);
        const _cq = this.cq,
            D = tmpQ;

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

        const newC = this._mc || (this._mc = new Float32Array(N * 4));
        for (let i = 0; i < N; i++) {
            const m = this.mirror[i],
                km = m * 4,
                k = i * 4;
            _q.set(D[km], -D[km + 1], -D[km + 2], D[km + 3]);
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
            if (pi < 0) _q2.copy(this.baseQ[i] as THREE.Quaternion);
            else
                _q2.set(
                    newC[pi * 4],
                    newC[pi * 4 + 1],
                    newC[pi * 4 + 2],
                    newC[pi * 4 + 3],
                );
            _q.set(newC[k], newC[k + 1], newC[k + 2], newC[k + 3]);
            _q2.invert().multiply(_q);
            out.setQ(i, _q2);

            if (pi < 0) {
                const m = this.mirror[i];
                src.getP(m, _v);
                _v.multiplyScalar(this.scale)
                    .applyQuaternion(this.baseQ[m] as THREE.Quaternion)
                    .add(this.baseP[m] as THREE.Vector3);
                _v.x = -_v.x + 0;
                _v.sub(this.baseP[i] as THREE.Vector3)
                    .applyQuaternion(
                        _q3.copy(this.baseQ[i] as THREE.Quaternion).invert(),
                    )
                    .divideScalar(this.scale);
                out.setP(i, _v);
            } else {
                src.getP(i, _v);
                out.setP(i, _v);
            }
        }
        return out;
    }

    apply(pose: Pose): void {
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

    read(pose: Pose): Pose {
        const B = this.bones;
        for (let i = 0; i < this.N; i++) {
            pose.setQ(i, B[i].quaternion);
            pose.setP(i, B[i].position);
        }
        return pose;
    }
}

export class ClipSampler {
    clip: THREE.AnimationClip;
    duration: number;
    name: string;
    tracks: Array<{ i: number; quat: boolean; interp: any; res: Float32Array }>;
    keyed: Uint8Array;

    constructor(clip: THREE.AnimationClip, skel: Skel) {
        this.clip = clip;
        this.duration = clip.duration;
        this.name = clip.name;
        this.tracks = [];
        this.keyed = new Uint8Array(skel.N);
        for (const tr of clip.tracks) {
            const pb = (THREE as any).PropertyBinding.parseTrackName(tr.name);
            const i = skel.byName.get(pb.nodeName);
            if (i == null) continue;
            if (
                pb.propertyName !== "quaternion" &&
                pb.propertyName !== "position"
            )
                continue;
            const res = new Float32Array(
                pb.propertyName === "quaternion" ? 4 : 3,
            );
            this.tracks.push({
                i,
                quat: pb.propertyName === "quaternion",
                interp: (tr as any).createInterpolant(res),
                res,
            });
            this.keyed[i] = 1;
        }
    }

    sample(t: number, pose: Pose, loop = true): Pose {
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
    sampleNorm(u: number, pose: Pose, loop = true): Pose {
        return this.sample(u * this.duration, pose, loop);
    }
}
