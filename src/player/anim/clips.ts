/**
 * Animation clip library and sampling/metadata utilities.
 *
 * @module player-anim-clips
 * @version 1.0.0
 * @file src/player/anim/clips.ts
 * @since 0.0.1
 * @description Manages clip samplers, hip-lock sampling, locomotion metrics, and contact/yaw analysis for animation clips.
 */

import * as THREE from "three";
import { Pose, ClipSampler, type Skel } from "./skeleton";

const _v = new THREE.Vector3(),
    _q = new THREE.Quaternion();

export class ClipLib {
    s: Skel;
    samplers: Map<string, ClipSampler>;
    meta: Map<string, any>;
    tmp: Pose;
    hips: number;

    constructor(skel: Skel, clips: THREE.AnimationClip[]) {
        this.s = skel;
        this.samplers = new Map();
        this.meta = new Map();
        for (const c of clips)
            this.samplers.set(c.name, new ClipSampler(c, skel));
        this.tmp = new Pose(skel.N);
        this.hips = skel.idx("hips");
    }
    has(n: string): boolean {
        return this.samplers.has(n);
    }
    dur(n: string): number {
        return this.samplers.get(n)?.duration ?? 0;
    }
    first(...names: Array<string | null | undefined>): string | null {
        for (const n of names) if (n && this.samplers.has(n)) return n;
        return null;
    }

    sample(
        n: string,
        t: number,
        out: Pose,
        { loop = true, lock = "xz" as "xz" | "xyz" | null } = {},
    ): boolean {
        const s = this.samplers.get(n);
        if (!s) return false;
        out.copy(this.s.rest);
        s.sample(t, out, loop);
        if (lock) this.lockHips(out, lock);
        return true;
    }
    lockHips(pose: Pose, lock: "xz" | "xyz" = "xz"): void {
        const i = this.hips;
        if (i < 0 || this.s.parent[i] >= 0) return;
        const S = this.s.scale,
            bq = this.s.baseQ[i] as THREE.Quaternion,
            bp = this.s.baseP[i] as THREE.Vector3;
        pose.getP(i, _v).multiplyScalar(S).applyQuaternion(bq).add(bp);
        const rx = this.s.bindP[i * 3],
            ry = this.s.bindP[i * 3 + 1],
            rz = this.s.bindP[i * 3 + 2];
        _v.x = rx;
        _v.z = rz;
        if (lock === "xyz") _v.y = ry;
        _v.sub(bp).applyQuaternion(_q.copy(bq).invert()).divideScalar(S);
        pose.setP(i, _v);
    }

    loco(n: string, axis: "z" | "wall" = "z"): any {
        const key = n + ":" + axis;
        if (this.meta.has(key)) return this.meta.get(key);
        const s = this.samplers.get(n);
        if (!s) return null;
        const N = 90,
            fl = this.s.idx("footL"),
            dur = s.duration,
            P = this.tmp;
        const ys: number[] = [],
            zs: number[] = [];
        for (let j = 0; j < N; j++) {
            P.copy(this.s.rest);
            s.sample((dur * j) / N, P);
            this.lockHips(P, "xz");
            this.s.fk(P);
            ys.push(this.s.cp[fl * 3 + 1]);
            zs.push(this.s.cp[fl * 3 + 2]);
        }
        let contact: boolean[], travel: number[];
        if (axis === "z") {
            const m = Math.min(...ys);
            contact = ys.map((y) => y < m + 0.03);
            travel = zs;
        } else {
            const m = Math.max(...zs);
            contact = zs.map((z) => z > m - 0.03);
            travel = ys;
        }
        let td = 0,
            best = -1;
        const vs: number[] = [];
        for (let j = 0; j < N; j++) {
            const a = j,
                b = (j + 1) % N;
            if (contact[a] && contact[b])
                vs.push((travel[a] - travel[b]) / (dur / N));
            if (!contact[(j + N - 1) % N] && contact[j] && best < 0) {
                best = j;
                td = j / N;
            }
        }

        vs.sort((x, y) => x - y);
        const med = vs.length ? Math.abs(vs[Math.floor(vs.length / 2)]) : 1;
        const m = { v: med || 1, phase0: td, dur };
        this.meta.set(key, m);
        return m;
    }

    contactTime(n: string): number {
        const key = n + ":contact";
        if (this.meta.has(key)) return this.meta.get(key);
        const s = this.samplers.get(n);
        if (!s) return 0;
        const fl = this.s.idx("footL"),
            fr = this.s.idx("footR"),
            P = this.tmp,
            ah = this.s.bindP[fl * 3 + 1];
        let t0 = 0;
        for (let t = 0; t < Math.min(0.5, s.duration); t += 1 / 60) {
            P.copy(this.s.rest);
            s.sample(t, P, false);
            this.s.fk(P);
            if (
                Math.min(this.s.cp[fl * 3 + 1], this.s.cp[fr * 3 + 1]) <
                ah + 0.05
            ) {
                t0 = t;
                break;
            }
        }
        this.meta.set(key, t0);
        return t0;
    }

    yawDelta(n: string): number {
        const key = n + ":yaw";
        if (this.meta.has(key)) return this.meta.get(key);
        const s = this.samplers.get(n);
        if (!s) return 0;
        const h = this.hips,
            P = this.tmp;
        const fwdAt = (t: number) => {
            P.copy(this.s.rest);
            s.sample(t, P, false);
            this.s.fk(P);
            this.s.cQ(h, _q);
            this.s.bQ(h, new THREE.Quaternion());
            const f = new THREE.Vector3(0, 0, 1).applyQuaternion(
                _q.multiply(this.s.bQ(h, new THREE.Quaternion()).invert()),
            );
            return Math.atan2(f.x, f.z);
        };
        let acc = 0,
            prev = fwdAt(0);
        for (let j = 1; j <= 30; j++) {
            const a = fwdAt((s.duration * j) / 30);
            let d = a - prev;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            acc += d;
            prev = a;
        }
        this.meta.set(key, acc);
        return acc;
    }
}
