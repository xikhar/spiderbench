/**
 * Procedural gait parameterization and locomotion pose generation.
 *
 * @module player-anim-gait
 * @version 1.0.0
 * @file src/player/anim/gait.ts
 * @since 0.0.1
 * @description Computes gait parameters and generates foot, body, and arm motion for walking/running cycles.
 */

import * as THREE from "three";
import { X, Y, clamp, lerp, smooth, bez, TAU } from "./builder";
import { armTarget } from "./rigdata";
import type { RigData } from "./rigdata";
import type { PoseBuilder } from "./builder";

const KEYS = [
    [
        0.0, 1.0, 0.62, 0.07, 0.0, 0.02, 0.0, 0.012, 1.0, 0.02, 0.06, 0.05, 0.1,
        0.25, 0.14, 0.11, 0.22, 0.45, 0.03,
    ],
    [
        1.7, 0.95, 0.61, 0.1, 0.03, 0.05, 0.01, 0.022, 1.0, 0.05, 0.12, 0.1,
        0.34, 0.3, 0.12, 0.1, 0.28, 0.6, 0.05,
    ],
    [
        4.5, 1.3, 0.4, 0.24, 0.14, 0.1, 0.05, 0.032, -1.0, 0.13, 0.13, 0.17,
        0.62, 1.25, 0.14, 0.08, 0.05, 0.75, 0.04,
    ],
    [
        8.5, 1.45, 0.3, 0.36, 0.28, 0.14, 0.08, 0.042, -1.0, 0.24, 0.15, 0.22,
        0.9, 1.45, 0.16, 0.065, 0.0, 0.85, 0.035,
    ],
    [
        15.0, 1.62, 0.2, 0.46, 0.38, 0.2, 0.11, 0.05, -1.0, 0.36, 0.14, 0.26,
        1.1, 1.55, 0.18, 0.055, -0.05, 0.95, 0.03,
    ],
];
const NAMES = [
    "v",
    "freq",
    "duty",
    "lift",
    "kick",
    "drive",
    "drop",
    "bob",
    "bobS",
    "lean",
    "pYaw",
    "cYaw",
    "arm",
    "elbow",
    "abd",
    "wid",
    "heel",
    "toeOff",
    "roll",
];

export function gaitParams(v: number, out: any = {}): any {
    v = Math.max(0, v);
    let i = 0;
    while (i < KEYS.length - 2 && v > KEYS[i + 1][0]) i++;
    const a = KEYS[i],
        b = KEYS[i + 1];
    const t = clamp((v - a[0]) / (b[0] - a[0]), 0, 1),
        u = t * t * (3 - 2 * t) * 0.5 + t * 0.5;
    for (let k = 0; k < NAMES.length; k++)
        out[NAMES[k]] = a[k] + (b[k] - a[k]) * u;
    out.v = v;
    return out;
}

const _v = new THREE.Vector3(),
    _v2 = new THREE.Vector3(),
    _v3 = new THREE.Vector3();
const P0 = new THREE.Vector3(),
    P1 = new THREE.Vector3(),
    P2 = new THREE.Vector3(),
    P3 = new THREE.Vector3();

export interface FootPlan {
    pos: THREE.Vector3;
    pitch: number;
    plant: number;
}

export class Gait {
    rd: RigData;
    phase: number;
    prm: any;
    L: number;
    maxStance: number;
    f: number;
    vEff: number;
    inPlace: number;
    feet: { L: FootPlan; R: FootPlan };

    constructor(rd: RigData) {
        this.rd = rd;
        this.phase = 0;
        this.prm = gaitParams(0);
        this.L = 0;
        this.f = 1;
        this.vEff = 0;
        this.inPlace = 0;
        this.maxStance = rd.legLen * 1.3;
        this.feet = {
            L: { pos: new THREE.Vector3(), pitch: 0, plant: 1 },
            R: { pos: new THREE.Vector3(), pitch: 0, plant: 1 },
        };
    }

    advance(dt: number, v: number, stepInPlace = 0): number {
        const p = gaitParams(v, this.prm);
        let f = p.freq;
        const vEff = Math.max(v, stepInPlace * 1.2);
        let L = (vEff * p.duty) / f;
        if (L > this.maxStance) {
            f = (vEff * p.duty) / this.maxStance;
            L = this.maxStance;
        }
        this.L = L;
        this.f = f;
        this.vEff = vEff;
        this.inPlace = stepInPlace;
        this.phase = (this.phase + f * dt) % 1;
        return f;
    }

    footPlan(S: "L" | "R", ph: number, out: FootPlan): FootPlan {
        const p = this.prm,
            _rd = this.rd,
            L = this.L,
            duty = p.duty;
        const sx = S === "L" ? 1 : -1;
        const x = sx * Math.max(p.wid, 0.04);
        const scale = clamp(this.vEff / 1.2, 0, 1);
        const lift = p.lift * lerp(0.35, 1, scale),
            kick = p.kick,
            drive = p.drive * scale;
        let z: number, y: number, pitch: number, plant: number;
        if (ph < duty) {
            const s = ph / duty;
            z = L / 2 - L * s;

            const heelIn = p.heel * (1 - smooth(s / 0.22));
            const heelOff =
                -p.toeOff *
                smooth(
                    (s - lerp(0.55, 0.25, clamp((this.vEff - 2) / 5, 0, 1))) /
                        0.45,
                );
            pitch = heelIn + heelOff;
            plant = 1;
            const a = this.anklePivot(pitch);
            z += a.z;
            y = a.y;
        } else {
            const s = (ph - duty) / (1 - duty);
            const a0 = this.anklePivot(-p.toeOff),
                a3 = this.anklePivot(p.heel);
            const y0 = a0.y,
                z0 = -L / 2 + a0.z,
                y3 = a3.y,
                z3 = L / 2 + a3.z;
            P0.set(0, y0, z0);
            P1.set(
                0,
                y0 + lift * 1.25 + kick * 0.9,
                z0 - kick * 1.1 - L * 0.05,
            );
            P2.set(0, this.rd.ankleH + lift * 0.55, z3 + drive + L * 0.12);
            P3.set(0, y3, z3);
            bez(P0, P1, P2, P3, s, _v);
            z = _v.z;
            y = _v.y;

            pitch =
                lerp(-p.toeOff, p.heel, smooth((s - 0.15) / 0.7)) -
                Math.sin(Math.PI * s) * kick * 0.6;
            plant = 1 - smooth(Math.min(s, 1 - s) / 0.12);
        }
        out.pos.set(x, y, z);
        out.pitch = pitch;
        out.plant = plant;
        return out;
    }

    build(b: PoseBuilder, opts: any = {}): this {
        const rd = this.rd,
            p = this.prm,
            ph = this.phase,
            L = Math.max(this.L, 0.05);
        const fl = this.footPlan("L", ph, this.feet.L),
            fr = this.footPlan("R", (ph + 0.5) % 1, this.feet.R);
        const zDiff = clamp((fl.pos.z - fr.pos.z) / Math.max(L, 0.6), -1, 1);
        const sp = clamp(this.vEff / 8.5, 0, 1.4);

        const duty = p.duty;
        const bobPh = TAU * 2 * (ph - duty / 2);
        const bob =
            p.bob * clamp(this.vEff / 1.2, 0, 1) * p.bobS * Math.cos(bobPh);

        const hipY = rd.hipY - p.drop + bob - 0.012 * clamp(this.inPlace, 0, 1);
        const sway =
            (p.bobS > 0 ? 0.022 : 0.006) *
            Math.sin(TAU * ph) *
            clamp(this.vEff / 1.5, 0, 1) *
            (p.bobS > 0 ? 1 : 0.5);
        b.moveHips(0, hipY - rd.hipY, 0);
        b.moveHips(sway, 0, 0.02 * sp);

        const pelvisYaw = -p.pYaw * zDiff;
        const rollS = Math.sin(TAU * ph) * p.roll;
        b.rotE("hips", 0.06 * sp + (opts.pelvisPitch || 0), pelvisYaw, -rollS);

        const lean = p.lean + (opts.lean || 0);
        b.rotE("spine", lean * 0.45, -pelvisYaw * 0.55, rollS * 0.5);
        const i1 = b.i("spine1");
        if (i1 >= 0) b.rotE(i1, lean * 0.2, p.cYaw * zDiff * 0.35, rollS * 0.3);
        b.rotE(
            "chest",
            lean * 0.35,
            p.cYaw * zDiff * 0.65,
            rollS * 0.3 + (opts.bankChest || 0),
        );

        b.rotE("chest", -0.04 * sp * Math.cos(bobPh), 0, 0);

        b.rotE(
            "neck",
            -lean * 0.45,
            -p.cYaw * zDiff * 0.35 - pelvisYaw * 0.1,
            -rollS * 0.5,
        );
        b.rotE(
            "head",
            -lean * 0.35 - 0.02 * sp * Math.cos(bobPh),
            -p.cYaw * zDiff * 0.3,
            -rollS * 0.3,
        );

        for (const [S, f] of [
            ["L", fl],
            ["R", fr],
        ] as Array<["L" | "R", FootPlan]>) {
            const sx = S === "L" ? 1 : -1;
            const ank = _v.copy(f.pos);
            const hipP = b.pos("upperLeg" + S, _v2);

            const pole = _v3.set(
                hipP.x + sx * 0.12,
                hipP.y - 0.3,
                hipP.z + 1.0,
            );
            b.ik("leg", S, ank, pole, 1);

            b.orient(
                "foot" + S,
                this._footDir(S, f.pitch),
                _v3.set(0, Math.cos(f.pitch), -Math.sin(f.pitch)),
                Y,
            );

            const toe = b.i("toe" + S);
            if (toe >= 0)
                b.rot(toe, X, f.pitch < 0 ? f.pitch * 0.8 * f.plant : 0);
        }

        const armAmp = p.arm,
            elbow = p.elbow;
        for (const S of ["L", "R"] as const) {
            const sx = S === "L" ? 1 : -1;
            const sw = -zDiff * sx;

            const flex = sw > 0 ? sw * armAmp : sw * armAmp * 0.75;
            const el =
                elbow + (sw > 0 ? sw * 0.35 : sw * 0.2) * clamp(sp, 0, 1);
            const abd = p.abd + 0.04 * Math.abs(sw);
            const sh = b.pos("upperArm" + S, new THREE.Vector3());
            const t = armTarget(
                rd,
                S,
                flex - lean * 0.6,
                abd,
                el,
                undefined,
                0.25 + 0.25 * sp,
            );
            const hand = t.hand.add(sh),
                elb = t.elbow.add(sh);

            const pole = elb
                .clone()
                .multiplyScalar(2)
                .sub(sh.clone().add(hand).multiplyScalar(0.5))
                .add(_v.set(sx * 0.05, 0, -0.05));
            b.ik("arm", S, hand, pole, 1);

            b.twist("hand" + S, 0);
        }
        return this;
    }

    anklePivot(pitch: number, out = { z: 0, y: 0 }): { z: number; y: number } {
        const rd = this.rd,
            ah = rd.ankleH,
            bz = rd.ballOff.z,
            by = rd.ballOff.y;
        if (pitch < 0) {
            const r = Math.hypot(bz, by),
                b0 = Math.atan2(-by, -bz);
            out.z = bz + r * Math.cos(b0 + pitch);
            out.y = ah + by + r * Math.sin(b0 + pitch);
        } else {
            const hz = rd.heelOff.z,
                r = Math.hypot(hz, ah),
                g0 = Math.atan2(ah, -hz);
            out.z = hz + r * Math.cos(g0 + pitch);
            out.y = r * Math.sin(g0 + pitch);
        }
        return out;
    }
    _footDir(S: "L" | "R", pitch: number): THREE.Vector3 {
        const bo = this.rd.ballOff;
        const r = Math.hypot(bo.y, bo.z),
            a0 = Math.atan2(bo.y, bo.z);
        return new THREE.Vector3(
            bo.x *
                (S === "L" ? 1 : -1) *
                Math.sign(this.rd.ballOff.x || 1) *
                0.0 +
                (S === "L" ? 1 : -1) * 0.02,
            r * Math.sin(a0 + pitch),
            r * Math.cos(a0 + pitch),
        ).normalize();
    }
}
