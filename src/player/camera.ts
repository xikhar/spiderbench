/**
 * Chase camera controller for player follow, framing, and effects.
 *
 * @module player-camera
 * @version 1.0.0
 * @file src/player/camera.ts
 * @since 0.0.1
 * @description Handles camera look, target following, collision avoidance, shake/impact, and dynamic framing based on player state.
 */

import * as THREE from "three";

const _v = new THREE.Vector3(),
    _v2 = new THREE.Vector3(),
    _v3 = new THREE.Vector3(),
    _v4 = new THREE.Vector3(),
    _v3b = new THREE.Vector3(),
    _v4b = new THREE.Vector3();
const damp = (a: number, b: number, rate: number, dt: number) =>
    a + (b - a) * (1 - Math.exp(-rate * dt));
const clamp = THREE.MathUtils.clamp,
    smooth = THREE.MathUtils.smoothstep;
function angDamp(a: number, b: number, rate: number, dt: number): number {
    const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + d * (1 - Math.exp(-rate * dt));
}
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function sd(o: any, k: string, target: number, st: number, dt: number): number {
    const w = 2 / Math.max(1e-4, st),
        x = w * dt,
        e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    if (!Number.isFinite(o[k])) {
        o[k] = target;
        o[k + "V"] = 0;
        return target;
    }
    const v = o[k + "V"] || 0,
        ch = o[k] - target,
        tmp = (v + w * ch) * dt;
    o[k + "V"] = (v - w * tmp) * e;
    o[k] = target + (ch + tmp) * e;
    return o[k];
}

function sdA(
    o: any,
    k: string,
    target: number,
    st: number,
    dt: number,
): number {
    return sd(o, k, o[k] + wrapA(target - o[k]), st, dt);
}

const _sdTmp = { x: 0, xV: 0 };
function sdV(
    o: any,
    k: string,
    target: THREE.Vector3,
    st: number,
    dt: number,
): THREE.Vector3 {
    const cur = o[k] as THREE.Vector3,
        vel =
            (o[k + "V"] as THREE.Vector3) || (o[k + "V"] = new THREE.Vector3());
    const tmp = _sdTmp;
    for (const a of ["x", "y", "z"] as const) {
        tmp.x = (cur as any)[a];
        tmp.xV = (vel as any)[a];
        sd(tmp, "x", (target as any)[a], st, dt);
        (cur as any)[a] = tmp.x;
        (vel as any)[a] = tmp.xV;
    }
    return cur;
}
const noise = (t: number, s: number) =>
    Math.sin(t * 1.7 + s) * 0.5 +
    Math.sin(t * 3.1 + s * 2.3) * 0.3 +
    Math.sin(t * 5.3 + s * 4.1) * 0.2;

export interface CameraPlayerState {
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    mode: string;
    sub?: string;
    modeT?: number;
    anchor?: THREE.Vector3 | null;
    swingDir?: THREE.Vector3 | null;
    wallNormal: THREE.Vector3;
    perchNormal?: THREE.Vector3;
    facing: number;
    dive?: boolean;
    tension?: number;
    bank?: number;
    sling?: number;
    walkK?: number;
    ropeDir?: THREE.Vector3 | null;
    noAuto?: boolean;
}

export interface ChaseCamera {
    yaw: number;
    pitch: number;
    dist: number;
    fov: number;
    roll: number;
    target: THREE.Vector3;
    targetVel: THREE.Vector3;
    lookAt: THREE.Vector3;
    lastLook: number;
    trauma: number;
    time: number;
    heightOff: number;
    collDist: number;
    sideOff: number;
    punch: number;
    punchV: number;
    dip: number;
    dipV: number;
    sens: number;
    anchorLean: number;
    lookSmooth: number;
    pendX: number;
    pendY: number;
    extraDist?: number;
    foliage?: (p: THREE.Vector3) => any[] | null | undefined;
    [key: string]: any;
    reset: (pos: THREE.Vector3, yaw: number) => void;
    shake: (amt: number) => void;
    kick: (amt: number) => void;
    impact: (sev: number) => void;
    forward: (out?: THREE.Vector3) => THREE.Vector3;
    forwardFlat: (out?: THREE.Vector3) => THREE.Vector3;
    rightFlat: (out?: THREE.Vector3) => THREE.Vector3;
    getLookDir: (out?: THREE.Vector3) => THREE.Vector3;
    applyLook: (I: any, dt?: number) => void;
    update: (dt: number, p: CameraPlayerState) => void;
}

export function createChaseCamera(
    camera: THREE.PerspectiveCamera,
    world: any,
): ChaseCamera {
    const c: ChaseCamera = {
        yaw: 0,
        pitch: 0.14,
        dist: 4.2,
        fov: 58,
        roll: 0,
        target: new THREE.Vector3(),
        targetVel: new THREE.Vector3(),
        lookAt: new THREE.Vector3(),
        lastLook: 10,
        trauma: 0,
        time: 0,
        heightOff: 0,
        collDist: 4.2,
        sideOff: 0.32,
        punch: 0,
        punchV: 0,
        dip: 0,
        dipV: 0,
        sens: 0.0023,
        anchorLean: 0,
        lookSmooth: 0,
        pendX: 0,
        pendY: 0,
        reset(pos: THREE.Vector3, yaw: number) {
            c.target.copy(pos);
            c.target.y += 0.55;
            c.targetVel.set(0, 0, 0);
            c.yaw = yaw;
            c.pitch = 0.14;
            c.collDist = c.dist;
            c.autoYaw = undefined;
            c.lagOff?.set(0, 0, 0);
            c.lagOffV?.set(0, 0, 0);
            c.jumpOff?.set(0, 0, 0);
            c.jumpOffV?.set(0, 0, 0);
            c._lastGoal = null;
            c.anchorLean = 0;
            c.anchorLeanV = 0;
        },
        shake(amt: number) {
            c.trauma = Math.min(1, c.trauma + amt);
        },

        kick(amt: number) {
            c.kickV = (c.kickV || 0) + 9 * amt;
            c.trauma = Math.min(1, c.trauma + 0.08 * amt);
        },
        impact(sev: number) {
            c.trauma = Math.min(1, c.trauma + 0.12 + 0.55 * sev);
            c.punchV -= 40 * sev;
            c.dipV -= 5 * sev;
        },
        forward(out = new THREE.Vector3()) {
            return out.set(
                Math.sin(c.yaw) * Math.cos(c.pitch),
                -Math.sin(c.pitch),
                Math.cos(c.yaw) * Math.cos(c.pitch),
            );
        },
        forwardFlat(out = new THREE.Vector3()) {
            return out.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
        },
        rightFlat(out = new THREE.Vector3()) {
            return out.set(-Math.cos(c.yaw), 0, Math.sin(c.yaw));
        },
        getLookDir(out = new THREE.Vector3()) {
            return camera.getWorldDirection(out);
        },

        applyLook(I: any, dt = 1 / 60) {
            const l = I.look;
            let dx = l.dx,
                dy = l.dy;
            if (c.lookSmooth > 0) {
                c.pendX += dx;
                c.pendY += dy;
                const k = 1 - Math.exp(-Math.min(dt, 0.1) / c.lookSmooth);
                dx = c.pendX * k;
                dy = c.pendY * k;
                c.pendX -= dx;
                c.pendY -= dy;
                if (Math.abs(c.pendX) < 0.01) c.pendX = 0;
                if (Math.abs(c.pendY) < 0.01) c.pendY = 0;
            } else c.pendX = c.pendY = 0;
            if (
                Math.abs(l.dx) + Math.abs(l.dy) > 0.5 ||
                Math.abs(c.pendX) + Math.abs(c.pendY) > 0.5
            )
                c.lastLook = 0;
            c.yaw -= dx * c.sens;
            const p = c.pitch + dy * c.sens,
                pc = clamp(p, -0.9, 1.25);
            if (pc !== p) c.pendY = 0;
            c.pitch = pc;
        },
        update(dt: number, p: CameraPlayerState) {
            dt = Math.min(dt, 0.1);
            c.time += dt;
            c.lastLook += dt;
            const vel = p.vel,
                speed = vel.length(),
                hs = Math.hypot(vel.x, vel.z);
            const m = p.mode,
                swinging = m === "swing",
                air = m === "air" || m === "zip",
                dive = !!p.dive;

            const blend = clamp((c.lastLook - 0.9) * 1.5, 0, 1);
            if (c.lastLook < 0.05 || c.autoYaw === undefined) {
                c.autoYaw = c.yaw;
                c.autoYawV = 0;
                c.autoPitch = c.pitch;
                c.autoPitchV = 0;
            }
            {
                let wantYaw: number | null = null,
                    wantPitch: number | null = null,
                    rate = 0;
                if (m === "wall") {
                    if ((p.modeT ?? 0) > 0.3) {
                        wantYaw = Math.atan2(-p.wallNormal.x, -p.wallNormal.z);
                        rate = 1.6;
                    }
                    wantPitch = p.sub === "wallRun" ? -0.08 : -0.05;
                } else if (m === "perch") {
                    wantYaw = p.facing;
                    rate = 1.4;
                    wantPitch = 0.3;
                } else if (m === "rope") {
                    wantYaw = p.facing;
                    rate = p.sub === "ropeShoot" ? 0.6 : 1.8;
                    wantPitch = 0.26;
                } else if (dive && hs <= 2.5) {
                    wantPitch = 0.75 + 0.4 * smooth(-vel.y, 18, 45);
                } else if (swinging && p.swingDir) {
                    wantYaw = Math.atan2(p.swingDir.x, p.swingDir.z);
                    rate = 2.2;
                    wantPitch = clamp(0.1 - vel.y * 0.006, -0.12, 0.3);
                } else if (hs > 2.5 && !(p.sling && p.sling > 0) && !p.noAuto) {
                    wantYaw = Math.atan2(vel.x, vel.z);
                    rate = clamp((hs - 2) / 10, 0, 1) * (air ? 1.8 : 1.3);
                    wantPitch = dive
                        ? 0.62 + 0.5 * smooth(-vel.y, 18, 45)
                        : air
                          ? clamp(0.14 - vel.y * 0.01, -0.1, 0.45)
                          : 0.14;
                }
                c.occHold = (c.occHold || 0) - dt;
                if (c.occHold > 0) {
                    wantYaw = null;
                    wantPitch = null;
                }
                if (wantYaw !== null) sdA(c, "autoYaw", wantYaw, 0.5, dt);
                else if ((c.autoRate || 0) < 0.05) {
                    c.autoYaw = c.yaw;
                    c.autoYawV = 0;
                }
                if (wantPitch !== null) sd(c, "autoPitch", wantPitch, 0.5, dt);
                else if ((c.autoPRate || 0) < 0.05) {
                    c.autoPitch = c.pitch;
                    c.autoPitchV = 0;
                }
                sd(c, "autoRate", wantYaw !== null ? rate : 0, 0.35, dt);
                sd(
                    c,
                    "autoPRate",
                    wantPitch !== null ? (dive ? 2.4 : 1.1) : 0,
                    0.35,
                    dt,
                );
                if (blend > 0) {
                    c.yaw = angDamp(
                        c.yaw,
                        c.autoYaw,
                        Math.max(0, c.autoRate) * blend,
                        dt,
                    );
                    c.pitch = damp(
                        c.pitch,
                        c.autoPitch,
                        Math.max(0, c.autoPRate) * blend,
                        dt,
                    );
                }
            }

            const goal = _v.copy(p.pos);
            goal.y += 0.55;
            c.lagOff = c.lagOff || new THREE.Vector3();
            c.jumpOff = c.jumpOff || new THREE.Vector3();
            sd(
                c,
                "lagK",
                swinging || air ? 0.03 : m === "wall" ? 0.02 : 0.012,
                0.4,
                dt,
            );
            sd(c, "lagMax", swinging || air ? 0.8 : 0.5, 0.4, dt);
            const wantLag = _v2.copy(vel).multiplyScalar(-c.lagK);
            {
                const L = wantLag.length();
                if (L > 1e-4)
                    wantLag.multiplyScalar(
                        (c.lagMax * Math.tanh(L / c.lagMax)) / L,
                    );
            }
            sdV(c, "lagOff", wantLag, 0.3, dt);
            if (c._lastGoal) {
                const mv = _v3b.copy(goal).sub(c._lastGoal),
                    jump = _v3.copy(mv).addScaledVector(vel, -dt);
                if (c._lastVel) {
                    const j2 = mv.addScaledVector(c._lastVel, -dt);
                    if (j2.lengthSq() < jump.lengthSq()) jump.copy(j2);
                }
                const jl = jump.length();
                if (jl > 0.06 && jl < 3) c.jumpOff.sub(jump);
                else if (jl >= 3) {
                    c.jumpOff.set(0, 0, 0);
                    c.jumpOffV?.set(0, 0, 0);
                }
            } else c._lastGoal = new THREE.Vector3();
            c._lastGoal.copy(goal);
            (c._lastVel = c._lastVel || new THREE.Vector3()).copy(vel);
            if (c.jumpOff.length() > 1.2) c.jumpOff.setLength(1.2);
            sdV(c, "jumpOff", _v4.set(0, 0, 0), 0.3, dt);
            const prevT = _v4b.copy(c.target);
            c.target.copy(goal).add(c.lagOff).add(c.jumpOff);
            c.targetVel
                .copy(c.target)
                .sub(prevT)
                .divideScalar(Math.max(dt, 1e-4));
            c.lead = c.lead || new THREE.Vector3();
            const lw = swinging || air ? 0.06 : 0.04;
            const leadW = _v2.set(
                vel.x * lw,
                vel.y * (swinging || air ? 0.015 : lw),
                vel.z * lw,
            );
            if (leadW.length() > 2.0) leadW.setLength(2.0);
            sdV(c, "lead", leadW, 0.45, dt);

            let wantDist = 4.0,
                wantH = 0,
                wantFov,
                wantSide = 0.32;
            if (m === "ground") {
                wantDist = 3.9 + clamp((speed - 8) * 0.07, 0, 0.7);
                wantSide = 0.35;
                const wk = (p.walkK || 0) * (1 - smooth(speed, 2.2, 4.5));
                wantDist -= 0.45 * wk;
                wantH -= 0.1 * wk;
            } else if (swinging) {
                wantDist = 3.6 + clamp((speed - 12) * 0.025, 0, 0.7);
                wantH = 0.35 + (p.tension || 0) * 0.25;
                wantSide = 0.15;
            } else if (air) {
                wantDist = dive
                    ? 3.9
                    : 3.8 + clamp((speed - 12) * 0.025, 0, 0.7);
                wantH = dive ? 0.9 : 0.15;
                wantSide = 0.2;
            } else if (m === "wall") {
                wantDist = 4.8;
                wantH = p.sub === "wallRun" ? 0.2 : 0;
                wantSide = 0;
            } else if (m === "perch") {
                wantDist = 4.3;
                wantH = 0.25;
                wantSide = 0.4;
            } else if (m === "rope") {
                wantDist = 4.1;
                wantH = 0.4;
                wantSide = 0.2;
            }
            if (m === "land" || p.sub?.startsWith?.("land")) wantDist = 4.2;
            const ledge = p.sub === "ledgeGrab" || p.sub === "ledgeClimb";
            if (ledge) {
                wantH = 1.4;
                c.pitch = damp(c.pitch, 0.42, 4, dt);
            }
            wantFov = 58 + 13 * smooth(speed, 12, 44) + (dive ? 5 : 0);
            if ((p.sling || 0) > 0) {
                wantDist += 1.6 * (p.sling || 0);
                wantH += 0.3 * (p.sling || 0);
                wantFov += 8 * (p.sling || 0) * (p.sling || 0);
            }
            wantDist += c.extraDist || 0;
            wantH += 0.18 * (c.extraDist || 0);
            sd(c, "dist", wantDist, 0.55, dt);
            sd(c, "heightOff", wantH, 0.5, dt);
            sd(c, "sideOff", wantSide, 0.6, dt);
            c.punchV += (-c.punch * 140 - c.punchV * 16) * dt;
            c.punch += c.punchV * dt;
            c.dipV += (-c.dip * 90 - c.dipV * 13) * dt;
            c.dip += c.dipV * dt;
            sd(c, "fov", wantFov, 0.5, dt);
            c.kickV =
                (c.kickV || 0) +
                (-(c.kickK || 0) * 55 - (c.kickV || 0) * 11) * dt;
            c.kickK = (c.kickK || 0) + c.kickV * dt;
            const velYaw = Math.atan2(vel.x, vel.z);
            const dy =
                c._lastVelYaw === undefined ? 0 : wrapA(velYaw - c._lastVelYaw);
            c._lastVelYaw = velYaw;
            sd(
                c,
                "yawRate",
                hs > 3
                    ? clamp(dy / Math.max(dt, 1e-3), -3, 3) *
                          Math.min(1, (hs - 3) / 17)
                    : 0,
                0.3,
                dt,
            );
            sd(c, "bankS", swinging ? p.bank || 0 : 0, 0.35, dt);
            const wantRoll =
                clamp(-c.yawRate * 0.04, -0.09, 0.09) - c.bankS * 0.05;
            c.roll = damp(c.roll, wantRoll, 3, dt);

            const fwd = c.forward(_v2);
            const pivot = _v.copy(c.target);
            pivot.y += c.heightOff + c.dip;
            const right = _v3.set(-Math.cos(c.yaw), 0, Math.sin(c.yaw));
            pivot.addScaledVector(right, c.sideOff);
            {
                const eye = _v3b.copy(p.pos);
                eye.y += 0.55;
                const d = _v4b.copy(pivot).sub(eye);
                const L = d.length();
                if (L > 1e-3) {
                    d.divideScalar(L);
                    const h = world.raycast(eye, d, L + 0.25);
                    const cap = h ? Math.max(0, h.distance - 0.3) : L + 0.25;
                    c.pivCap =
                        c.pivCap === undefined
                            ? cap
                            : cap < c.pivCap
                              ? cap
                              : damp(c.pivCap, cap, 4, dt);
                    if (c.pivCap < L)
                        pivot.copy(eye).addScaledVector(d, c.pivCap);
                }
            }
            const back = _v4.copy(fwd).negate();
            let allowed = c.dist;
            const o = new THREE.Vector3();
            const probe = (ox: number, oy: number) => {
                o.copy(pivot).addScaledVector(right, ox);
                o.y += oy;
                const h = world.raycast(o, back, c.dist + 0.4);
                if (h)
                    allowed = Math.min(
                        allowed,
                        Math.max(0.5, h.distance - 0.35),
                    );
            };
            probe(0, 0);
            probe(0.3, 0);
            probe(-0.3, 0);
            probe(0, 0.25);
            probe(0, -0.25);
            const cans = c.foliage?.(pivot);
            if (cans && cans.length) {
                for (let t = 0.8; t < allowed; t += 0.5) {
                    o.copy(pivot).addScaledVector(back, t);
                    let inside = false;
                    for (const q of cans) {
                        const dy = o.y - q.cy;
                        if (
                            Math.abs(dy) < q.r * 0.75 &&
                            (o.x - q.pos.x) ** 2 + (o.z - q.pos.z) ** 2 <
                                q.r * q.r
                        ) {
                            inside = true;
                            break;
                        }
                    }
                    if (inside) {
                        allowed = Math.max(0.8, t - 0.35);
                        break;
                    }
                }
            }
            const minD = Math.min(3.0, c.dist * 0.75);
            c.occT = (c.occT || 0) - dt;
            if (
                (p.sub === "vault" || p.sub?.startsWith?.("ledge")) &&
                c.occT > 0.03
            )
                c.occT = 0.03;
            if (allowed < minD && c.occT <= 0) {
                c.occT = 0.12;
                const clear = (yaw: number, pitch: number) => {
                    const cp = Math.cos(pitch),
                        d = _v4b.set(
                            -Math.sin(yaw) * cp,
                            Math.sin(pitch),
                            -Math.cos(yaw) * cp,
                        );
                    let a = c.dist;
                    for (const ox of [0, 0.3, -0.3]) {
                        o.copy(pivot).addScaledVector(right, ox);
                        const h = world.raycast(o, d, c.dist + 0.4);
                        if (h) a = Math.min(a, h.distance - 0.35);
                    }
                    return a;
                };
                let best: { yaw: number; pitch: number } | null = null,
                    bs = -Infinity;
                const base =
                    m === "perch" && p.facing != null ? p.facing : c.yaw;
                for (const dp of [0, 0.35, 0.7, 1.0])
                    for (const dyw of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
                        const yaw = base + dyw,
                            pitch = clamp(c.pitch + dp, -0.3, 1.15);
                        const a = clear(yaw, pitch);
                        const sc =
                            Math.min(a, c.dist) -
                            0.9 * Math.abs(dyw) -
                            0.6 * dp;
                        if (a >= minD && sc > bs) {
                            bs = sc;
                            best = { yaw, pitch };
                        }
                    }
                c.occGoal = best;
                if (best) c.occHold = 2.0;
            }
            if (allowed >= minD + 0.5 && c.occT <= -1) c.occGoal = null;
            if (c.occGoal) {
                const fast =
                    p.sub === "vault" ||
                    p.sub?.startsWith?.("ledge") ||
                    ((p.modeT ?? 0) < 0.8 && !swinging && !air);
                const r =
                    c.lastLook < 0.4
                        ? 1.5
                        : fast
                          ? 11
                          : swinging || air
                            ? 3
                            : 5;
                c.yaw = angDamp(c.yaw, c.occGoal.yaw, r, dt);
                c.pitch = damp(c.pitch, c.occGoal.pitch, r, dt);
                back.set(
                    -Math.sin(c.yaw) * Math.cos(c.pitch),
                    Math.sin(c.pitch),
                    -Math.cos(c.yaw) * Math.cos(c.pitch),
                );
                if (
                    Math.abs(wrapA(c.yaw - c.occGoal.yaw)) < 0.05 &&
                    Math.abs(c.pitch - c.occGoal.pitch) < 0.05
                )
                    c.occGoal = null;
            }
            if (allowed < c.collDist) {
                c.collDist = damp(c.collDist, allowed, 30, dt);
                c.collDistV = 0;
            } else sd(c, "collDist", allowed, 0.45, dt);
            camera.position
                .copy(pivot)
                .addScaledVector(
                    back,
                    Math.min(
                        c.collDist + 1.3 * Math.max(0, c.kickK || 0),
                        Math.max(c.collDist, allowed),
                    ),
                );
            const gy =
                world.groundHeight(
                    camera.position.x,
                    camera.position.z,
                    camera.position.y + 0.3,
                ) + 0.3;
            if (camera.position.y < gy) camera.position.y = gy;
            if (world.collideDynamic) {
                try {
                    const r = world.collideDynamic(
                        _v3b.set(
                            camera.position.x,
                            camera.position.y - 0.35,
                            camera.position.z,
                        ),
                        0.4,
                        0.7,
                    );
                    if (r && r.push) {
                        camera.position.x += r.push.x;
                        camera.position.z += r.push.z;
                        if (r.grounded && r.groundY != null)
                            camera.position.y = Math.max(
                                camera.position.y,
                                r.groundY + 0.4,
                            );
                    }
                } catch {
                    void 0;
                }
            }
            c.leanOff = c.leanOff || new THREE.Vector3();
            if (swinging && p.anchor) {
                const want = _v3b.copy(p.anchor).sub(pivot);
                if (c.anchorLean < 0.005) c.leanOff.copy(want);
                sdV(c, "leanOff", want, 0.4, dt);
            }
            sd(
                c,
                "anchorLean",
                swinging && p.anchor ? 0.1 : 0,
                swinging ? 0.5 : 0.7,
                dt,
            );
            const lookAt = c.lookAt
                .copy(pivot)
                .addScaledVector(fwd, 10)
                .add(c.lead);
            if (c.anchorLean > 0.0005)
                lookAt.lerp(_v3b.copy(pivot).add(c.leanOff), c.anchorLean);
            c.trauma = Math.max(0, c.trauma - dt * 1.5);
            const sh = c.trauma * c.trauma;
            camera.up.set(0, 1, 0);
            camera.lookAt(lookAt);
            camera.rotateZ(c.roll + sh * 0.045 * noise(c.time * 22, 3));
            camera.rotateX(sh * 0.035 * noise(c.time * 25, 1));
            camera.rotateY(sh * 0.035 * noise(c.time * 24, 7));
            const f = c.fov + c.punch + 9 * Math.max(0, c.kickK || 0);
            if (Math.abs(camera.fov - f) > 0.01) {
                camera.fov = f;
                camera.updateProjectionMatrix();
            }
            camera.updateMatrixWorld();
            const pipe = (globalThis as any).__ctx?.pipeline;
            if (pipe) {
                const mbK =
                    (m === "ground" || m === "wall" ? 0.45 : dive ? 1.6 : 1) *
                    smooth(speed, 6, 36) *
                    1.1;
                pipe.setMotionBlur?.(
                    Math.max(
                        0,
                        sd(c, "mbK", mbK, mbK > (c.mbK || 0) ? 0.35 : 0.2, dt),
                    ),
                );
                pipe.setFocus?.(camera.position.distanceTo(p.pos));
                pipe.setAperture?.(0);
            }
        },
    };
    return c;
}
