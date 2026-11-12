/**
 * Spider-Man combat controller.
 *
 * @module src-game-combat-spidey
 * @version 1.0.0
 * @file src/game/combat/spidey.ts
 * @since 0.0.1
 * @description Implements player combat moves, targeting assistance, attacks, dodges, and combat state transitions.
 */

import * as THREE from "three";
import { PoseLayer } from "./poselayer";
import { clamp, smooth, lerp, yawTo, hdist, angWrap } from "./util";

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _cp = new THREE.Vector3();
const H = 0.95;

const MOVES: Record<string, any> = {
    jab: {
        clip: "punch1",
        hit: 0.2,
        ts: 1.3,
        reach: 0.95,
        dmg: 9,
        kind: "light",
        side: 0,
    },
    cross: {
        clip: "punch2",
        hit: 0.23,
        ts: 1.3,
        reach: 0.95,
        dmg: 10,
        kind: "light",
        side: 1,
    },
    hook: {
        clip: "punch3",
        hit: 0.3,
        ts: 1.35,
        reach: 1.0,
        dmg: 11,
        kind: "light",
        side: -1,
    },
    kick: {
        clip: "kick",
        hit: 0.3,
        ts: 1.4,
        reach: 1.1,
        dmg: 11,
        kind: "light",
        side: 1,
    },
    roundhouse: {
        clip: "kick",
        hit: 0.3,
        ts: 1.15,
        reach: 1.1,
        dmg: 16,
        kind: "ender",
        side: 1,
    },
    riser: {
        clip: "uppercut",
        hit: 0.33,
        ts: 1.2,
        reach: 1.0,
        dmg: 17,
        kind: "ender",
        side: 0,
    },
    flyKick: {
        clip: "webStrike",
        from: 0.36,
        hit: 0.57,
        ts: 1.15,
        reach: 1.05,
        dmg: 18,
        kind: "ender",
        side: 0,
    },
};
const POOLS = [
    ["jab", "cross"],
    ["cross", "hook"],
    ["hook", "kick", "jab"],
    ["roundhouse", "riser", "flyKick"],
];
const AIR = [
    { from: 0.0, until: 0.22, hit: 0.13, dmg: 9, kind: "air" },
    { from: 0.2, until: 0.42, hit: 0.27, dmg: 9, kind: "air" },
    { from: 0.42, until: 0.8, hit: 0.6, dmg: 14, kind: "slam" },
];
const DASH_MAX = 5.2;
const LUNGE = 0.3;
const NEAR = 9;

export function createSpidey(c: any) {
    const ctx = c.ctx;
    const P = ctx.player;
    const s = P.state;
    const rig = P.rig;
    const layer = new PoseLayer(rig);
    const M: any = { name: "free", t: 0 };
    const me: any = {
        layer,
        M,
        hp: 100,
        maxHp: 100,
        focus: 0,
        invulnUntil: 0,
        comboStep: 0,
        comboT: 0,
        lastAttackT: -9,
        target: null,
        airborne: false,
        counterUntil: 0,
        downed: false,
    };
    const feet = () => _v3.set(s.pos.x, s.pos.y - H, s.pos.z);
    const an = () => rig.animator;
    const trav = () => P.traversal;
    const vel = new THREE.Vector3();
    const prevPos = new THREE.Vector3();

    function face(yaw: number) {
        s.facing = yaw;
        s.speed = 0;
        M.yawGoal = yaw;
    }

    function turn(dt: number, rate = 14, maxW = 11) {
        if (M.yawGoal == null) return;
        s.facing = M.yawGoal;
        const a = an();
        if (!a) return;
        const d = angWrap(M.yawGoal - a.yaw);
        const step = d * (1 - Math.exp(-rate * dt));
        a.yaw += clamp(step, -maxW * dt, maxW * dt);
    }
    const _zero = new THREE.Vector3();
    const _kin = new THREE.Vector3();
    const KIN_MAX = 1.2;
    function kinTo(p: THREE.Vector3) {
        if (
            s.mode === "ground" &&
            p.y - H - ctx.world.groundHeight(p.x, p.z, p.y) > 0.04
        )
            trav()?.toAir?.(_zero);

        const d = p.distanceTo(s.pos);
        if (d > KIN_MAX) p = _kin.copy(s.pos).lerp(p, KIN_MAX / d);
        s.kin = {
            type: "cmb",
            t: 0,
            dur: 1e-4,
            p0: s.pos.clone(),
            p1: s.pos.clone().lerp(p, 0.5),
            p2: p.clone(),
        };
        s.vel.set(0, 0, 0);
    }
    function groundXZ(x: number, z: number) {
        s.pos.x = x;
        s.pos.z = z;
        s.speed = 0;
        s.vel.set(0, 0, 0);
    }
    function start(name: string, o: any = {}) {
        const g = M.yawGoal;
        for (const k of Object.keys(M)) delete M[k];
        Object.assign(M, { name, t: 0, hitDone: false, yawGoal: g, ...o });
    }

    function free(fade = 0.22, v: THREE.Vector3 | null = null) {
        const air =
            s.kin ||
            s.mode !== "ground" ||
            feet().y - ctx.world.groundHeight(s.pos.x, s.pos.z, s.pos.y) > 0.35;
        for (const k of Object.keys(M)) delete M[k];
        M.name = "free";
        M.t = 0;
        layer.stop(fade);
        s.kin = null;
        if (air && s.mode !== "swing")
            trav()?.toAir?.(
                v ||
                    _v
                        .copy(vel)
                        .multiplyScalar(0.35)
                        .setY(Math.min(vel.y * 0.35, 1)),
            );
    }
    const onGround = () => s.mode === "ground" && !s.kin;
    me.isFree = () => M.name === "free";
    me.busy = () => M.name !== "free";
    me.invuln = () =>
        c.time < me.invulnUntil ||
        (M.name === "dodge" && M.t < 0.5) ||
        M.name === "finisher" ||
        M.name === "down" ||
        (M.name === "throw" && M.t < 0.75);
    function nearest(maxD = NEAR) {
        let d = Infinity;
        for (const e of c.enemies)
            if (e.alive && e.state !== "out")
                d = Math.min(d, hdist(e.pos, s.pos));
        return d <= maxD ? d : null;
    }

    let lastMove = "";
    function chooseMove(step: number, target: any) {
        const P0 = feet();
        const d = hdist(P0, target.pos);

        const pool = POOLS[step].filter(
            (k) =>
                k !== lastMove &&
                !(k === "flyKick" && d < 1.6) &&
                !(d > 2.2 && step < 3 && MOVES[k].clip === "kick"),
        );
        return pool[Math.floor(Math.random() * pool.length)] || POOLS[step][0];
    }

    function dashDist(u: number, D: number, T: number, v0: number, v1: number) {
        const u2 = u * u;
        const u3 = u2 * u;
        return (
            (u3 - 2 * u2 + u) * v0 * T +
            (-2 * u3 + 3 * u2) * D +
            (u3 - u2) * v1 * T
        );
    }
    function strikeWith(target: any, S: any, o: any = {}) {
        const P0 = feet().clone();
        const gap = Math.max(0, hdist(P0, target.pos) - S.reach);
        const dir0 = _v
            .set(P0.x - target.pos.x, 0, P0.z - target.pos.z)
            .normalize()
            .clone();
        let { clip, from = 0, until = null, hit, ts, kind, dmg } = S;
        const { side } = S;
        if (o.ender) kind = "ender";
        const counter = c.time < me.counterUntil;
        if (counter) {
            dmg *= 1.6;
            if (kind === "light") kind = "ender";
            me.counterUntil = 0;
        }
        if (gap > DASH_MAX && !o.noLong) {
            clip = "webStrike";
            from = 0.32;
            hit = 0.57;
            until = null;
            const fly = clamp(gap / 17, 0.24, 0.5);
            ts = (hit - from) / fly;
            start(o.name || "strike", {
                target,
                clip,
                from,
                until,
                hit,
                ts,
                kind,
                dmg,
                side,
                P0,
                dir0,
                reach: S.reach,
                long: true,
                fly,
                clipAt: 0,
                clipOn: true,
                dashDur: fly,
                pressT: c.time,
            });
            M.track = layer.play(clip, { from, ts, fade: 0.08 });
            c.sfx("whoosh", 18);
        } else {
            const windup = (hit - from) / ts;
            const hv =
                s.vel.x * s.vel.x + s.vel.z * s.vel.z >
                vel.x * vel.x + vel.z * vel.z
                    ? s.vel
                    : vel;
            const v0 = Math.max(
                0,
                Math.hypot(hv.x, hv.z) *
                    Math.cos(
                        angWrap(Math.atan2(hv.x, hv.z) - yawTo(P0, target.pos)),
                    ),
            );
            const runD = Math.max(0, gap - LUNGE);
            const runT =
                runD > 0.05
                    ? clamp(
                          0.06 + runD / 12.5 - Math.min(0.1, v0 * 0.01),
                          0.1,
                          0.44,
                      )
                    : 0;
            const dashDur = runT + windup;
            const clipAt = Math.max(0, runT - 0.05);
            start(o.name || "strike", {
                target,
                clip,
                from,
                until,
                hit,
                ts,
                kind,
                dmg,
                side,
                P0,
                dir0,
                reach: S.reach,
                long: false,
                dashDur,
                runT,
                runD,
                windup,
                clipAt,
                clipOn: false,
                v0,
                D0: Math.max(0.01, gap),
                pressT: c.time,
                noMove: !!o.noMove,
            });
            if (clipAt <= 0) playStrikeClip();
            else layer.stop(0.12);
        }
        face(yawTo(P0, target.pos));
        me.target = target;
        me.lastAttackT = c.time;
    }
    function playStrikeClip() {
        M.clipOn = true;
        const windup = (M.hit - M.from) / M.ts;
        M.track = layer.play(M.clip, {
            from: M.from,
            until: M.until ?? undefined,
            ts: M.ts,
            fade: clamp(windup * 0.7, 0.07, 0.12),
        });
    }
    function strike(target: any, step: number) {
        const key = chooseMove(step, target);
        lastMove = key;
        strikeWith(target, MOVES[key]);
    }
    function launcher(target: any) {
        strikeWith(
            target,
            {
                clip: "uppercut",
                hit: 0.33,
                ts: 1.25,
                reach: 1.0,
                dmg: 10,
                kind: "launch",
                side: 0,
            },
            { name: "launch", noLong: true },
        );
        M.rise = false;
    }
    function airStrike(target: any, seg: number, forceSlam = false) {
        const A = AIR[forceSlam ? 2 : seg];
        start("airStrike", {
            target,
            seg: forceSlam ? 2 : seg,
            A,
            hit: A.hit,
            ts: 1.2,
        });
        M.track = layer.play("airCombo", {
            from: A.from,
            until: A.until,
            ts: 1.2,
            fade: 0.08,
        });
        me.target = target;
        me.lastAttackT = c.time;
    }

    function arcOver(p0: THREE.Vector3, to: THREE.Vector3, base: number) {
        const W = ctx.world;
        let top = 0;
        for (let i = 1; i < 8; i++) {
            const k = i / 8;
            const x = lerp(p0.x, to.x, k);
            const z = lerp(p0.z, to.z, k);
            const y = lerp(p0.y - H, to.y, k);
            const dyn = W.collideDynamic?.(_v.set(x, y, z), 0.35, 1.7);
            if (dyn?.push?.lengthSq() > 1e-4) top = Math.max(top, 1.9);
            const g = W.groundHeight(x, z, y + 2.2) - y;
            if (g > 0.25 && g < 2.3) top = Math.max(top, g + 0.5);
        }
        return Math.max(base, top);
    }
    function diveStrike(target: any) {
        const P0 = s.pos.clone();
        start("dive", {
            target,
            P0,
            hit: 0.57,
            from: 0.3,
            ts: 1,
            arrive: clamp(P0.distanceTo(target.pos) / 22, 0.2, 0.6),
            arc: arcOver(P0, target.pos, 0.4),
        });
        M.ts = (0.57 - 0.3) / M.arrive;
        layer.play("webStrike", { from: 0.3, ts: M.ts, fade: 0.1 });
        face(yawTo(P0, target.pos));
        me.target = target;
        c.sfx("whoosh", 22);
    }
    function webStrike(target: any) {
        const P0 = s.pos.clone();
        const d = hdist(P0, target.pos);
        const fly = clamp(d / 24, 0.2, 0.55);
        start("webStrike", { target, P0, hit: 0.57, fly, pulled: false });
        M.ts2 = (0.57 - 0.3) / fly;
        layer.play("webStrike", {
            from: 0.05,
            until: 0.3,
            ts: 1.4,
            fade: 0.09,
        });
        face(yawTo(P0, target.pos));
        me.target = target;
        c.fx.strand(
            () => rig.handWorld("R", new THREE.Vector3()),
            () => target.chest(new THREE.Vector3()),
            { life: 0.18 + fly, sag: 0.05, fade: 0.1 },
        );
        c.sfx("thwip", 1.2);
    }

    function dodge(
        threatDir: THREE.Vector3,
        perfect: boolean,
        inputDir?: THREE.Vector3,
    ) {
        let move: THREE.Vector3;
        if (inputDir && inputDir.lengthSq() > 0.1)
            move = inputDir.clone().normalize();
        else
            move = threatDir.lengthSq()
                ? threatDir.clone().negate()
                : new THREE.Vector3(
                      -Math.sin(s.facing),
                      0,
                      -Math.cos(s.facing),
                  );
        const yawBack = Math.atan2(-move.x, -move.z);
        const yawSide = Math.atan2(-move.z, move.x);
        const tb = Math.abs(angWrap(yawBack - s.facing));
        const tsd = Math.abs(angWrap(yawSide - s.facing));

        const side =
            inputDir && inputDir.lengthSq() > 0.1 ? tsd + 0.25 < tb : false;
        start("dodge", {
            move,
            side,
            dist: side ? 3.2 : 3.4,
            P0: feet().clone(),
            perfect,
            go: side ? 0.05 : 0.1,
        });
        layer.play(side ? "dodgeSide" : "dodge", {
            ts: side ? 1.35 : 1.45,
            fade: 0.07,
        });
        face(side ? yawSide : yawBack);
        me.invulnUntil = c.time + 0.55;
        c.sfx("whoosh", 16);
        if (perfect) {
            me.counterUntil = c.time + 1.4;
        }
    }
    function webShoot(target: any) {
        layer.play("webShootR", {
            ts: 1.5,
            fade: 0.08,
            mask: "upper",
            id: "shoot",
            hold: false,
        });
        M.shootT = c.time;
        M.shootTarget = target;
        c.pendingShot = { at: c.time + 0.09, target };
    }
    function throwProp(prop: any, target: any) {
        start("throw", { prop, target, released: false });
        layer.play("webShootR", { ts: 1.3, fade: 0.09 });
        face(yawTo(feet(), prop.pos));
        c.props.grab(prop, me);
        c.fx.strand(
            () => rig.handWorld("R", new THREE.Vector3()),
            () => prop.pos.clone(),
            { life: 0.5, sag: 0.08 },
        );
        c.fx.strand(
            () => rig.handWorld("L", new THREE.Vector3()),
            () => prop.pos.clone(),
            { life: 0.5, sag: 0.1 },
        );
        c.sfx("thwip", 1.0);
    }
    function finisher(target: any) {
        const P0 = feet().clone();
        const dir0 = _v
            .set(P0.x - target.pos.x, 0, P0.z - target.pos.z)
            .normalize()
            .clone();
        start("finisher", {
            target,
            P0,
            dir0,
            hit: 0.57,
            reach: 1.15,
            arrive: 0.4,
        });
        M.track = layer.play("finisher", { ts: 1, fade: 0.1 });
        face(yawTo(P0, target.pos));
        me.target = target;
        target.set("stagger");
        target.stagT = 2;
        target.play("thugStumbleBack", { once: true, ts: 0.35, fade: 0.1 });
        c.releaseToken(target);
        c.clearThreats(target);
        c.cine(target, 1.45);
    }
    function takeHit(e: any, dmg: number, heavy: boolean) {
        me.hp = Math.max(0, me.hp - dmg);
        trav()?.ropeFall?.();
        if (!onGround() && me.hp > 0) return;
        const dir = _v
            .set(s.pos.x - e.pos.x, 0, s.pos.z - e.pos.z)
            .normalize()
            .clone();
        s.kin = null;
        me.comboStep = 0;
        if (heavy || me.hp <= 0) {
            start("down", {
                dir,
                dist: 2.2,
                P0: feet().clone(),
                dead: me.hp <= 0,
            });
            layer.play("knockdown", { ts: 1.15, fade: 0.07 });
            me.invulnUntil = c.time + 2.4;
        } else {
            start("hit", { dir, dist: 0.35, P0: feet().clone() });
            layer.play("hitReact", { ts: 1.25, fade: 0.06 });
            me.invulnUntil = c.time + 0.45;
        }
        face(Math.atan2(-dir.x, -dir.z));
    }
    me.takeHit = takeHit;

    function contactPoint(
        t: any,
        dir0: THREE.Vector3,
        reach: number,
        out: THREE.Vector3,
    ) {
        return out.copy(t.pos).addScaledVector(dir0, reach);
    }
    function motion(dt: number) {
        M.t += dt;
        const tr = M.track || layer.top();
        switch (M.name) {
            case "strike":
            case "launch": {
                const T = M.target;
                if (!T.alive && !M.hitDone) {
                    free(0.2);
                    break;
                }
                if (M.long) {
                    const u = clamp(M.t / M.fly, 0, 1);
                    const e = 1 - (1 - u) * (1 - u);
                    if (!M.hitDone) {
                        const cp = contactPoint(T, M.dir0, M.reach, _v2);
                        const x = lerp(M.P0.x, cp.x, e);
                        const z = lerp(M.P0.z, cp.z, e);
                        const y =
                            lerp(M.P0.y, T.pos.y, e) +
                            H +
                            Math.sin(Math.PI * u) * 0.55;
                        if (u < 1) kinTo(_v.set(x, y, z));
                        else {
                            s.kin = null;
                            groundXZ(x, z);
                        }
                        M.yawGoal = yawTo(feet(), T.pos);
                    }
                } else if (
                    !M.hitDone &&
                    T.alive &&
                    !M.noMove &&
                    M.t <= M.dashDur + 0.02
                ) {
                    const cp = contactPoint(T, M.dir0, M.reach, _v2);
                    let d;
                    if (M.t < M.runT)
                        d = dashDist(
                            clamp(M.t / M.runT, 0, 1),
                            M.runD,
                            M.runT,
                            M.v0,
                            2.2,
                        );
                    else {
                        const u = clamp(
                            (M.t - M.runT) / Math.max(1e-3, M.windup),
                            0,
                            1,
                        );
                        d = M.runD + (M.D0 - M.runD) * (1 - (1 - u) * (1 - u));
                    }
                    const k = clamp(d / M.D0, 0, 1.02);
                    groundXZ(lerp(M.P0.x, cp.x, k), lerp(M.P0.z, cp.z, k));
                    M.yawGoal = yawTo(feet(), T.pos);
                } else if (M.noMove && !M.hitDone && T.alive)
                    M.yawGoal = yawTo(feet(), T.pos);
                if (!M.clipOn && M.t >= M.clipAt) playStrikeClip();
                const trk = M.clipOn ? M.track : null;
                const clipT = trk ? trk.t : -1;
                if (
                    !M.hitDone &&
                    M.clipOn &&
                    clipT >= M.hit - 0.001 &&
                    M.t >= M.dashDur - 0.03
                ) {
                    M.hitDone = true;
                    c.playerHit(M.target, {
                        kind: M.kind,
                        dmg: M.dmg,
                        heavy: M.kind !== "light" ? 0.6 : 0.15,
                        side: M.side,
                    });
                    if (M.name === "launch" && M.target.state === "air") {
                        M.rise = true;
                        M.riseT = 0;
                        M.riseFrom = s.pos.clone();
                    }
                    if (M.long) {
                        s.kin = null;
                    }
                }
                if (M.name === "launch" && M.rise) {
                    M.riseT += dt;
                    const T2 = M.target;
                    const k = smooth(M.riseT / 0.38);
                    const want = _v.copy(T2.pos).addScaledVector(M.dir0, 1.0);
                    want.y = T2.pos.y + H + 0.1;
                    kinTo(_v2.copy(M.riseFrom).lerp(want, k));
                    if (M.riseT > 0.38) {
                        start("air", { target: T2, idleT: 0 });
                        M.track = layer.play("airCombo", {
                            from: 0.0,
                            until: 0.02,
                            ts: 0.2,
                            fade: 0.2,
                        });
                    }
                    return;
                }

                if (
                    trk &&
                    (clipT >= trk.until - 0.02 ||
                        (M.hitDone &&
                            M.name === "strike" &&
                            clipT >= M.hit + 0.3))
                )
                    free(M.long ? 0.3 : 0.25);
                break;
            }
            case "finisher": {
                const T = M.target;
                const u = clamp(M.t / M.arrive, 0, 1);
                const e = 1 - (1 - u) * (1 - u);
                if (T.alive && M.t <= M.arrive + 0.02) {
                    const cp = contactPoint(T, M.dir0, M.reach, _v2);
                    groundXZ(lerp(M.P0.x, cp.x, e), lerp(M.P0.z, cp.z, e));
                    M.yawGoal = yawTo(feet(), T.pos);
                }
                const clipT = tr ? tr.t : 0;
                if (!M.hitDone && clipT >= M.hit - 0.001 && M.t > 0.2) {
                    M.hitDone = true;
                    c.playerHit(M.target, { kind: "finisher", dmg: 999 });
                }
                if (clipT >= (tr ? tr.until : 0) - 0.02) free(0.25);
                break;
            }
            case "air":
            case "airStrike": {
                const T = M.target;
                if (!T || !T.alive || T.state !== "air") {
                    free(0.3, _v.set(0, -1, 0));
                    break;
                }
                const dir = _v2.set(s.pos.x - T.pos.x, 0, s.pos.z - T.pos.z);
                if (dir.lengthSq() < 1e-4)
                    dir.set(
                        Math.sin(s.facing + Math.PI),
                        0,
                        Math.cos(s.facing + Math.PI),
                    );
                dir.normalize();
                const want = _v.copy(T.pos).addScaledVector(dir, 0.95);
                want.y = T.pos.y + H + 0.05;
                kinTo(_v.copy(s.pos).lerp(want, 1 - Math.exp(-14 * dt)));
                M.yawGoal = yawTo(feet(), T.pos);
                if (M.name === "air") {
                    M.idleT += dt;
                    if (M.idleT > 0.9) {
                        T.juggle = Math.min(T.juggle, 0);
                        free(0.3, _v.set(0, -1, 0));
                    }
                    break;
                }
                const clipT = tr ? tr.t : 0;
                if (!M.hitDone && clipT >= M.hit) {
                    M.hitDone = true;
                    c.playerHit(T, {
                        kind: M.A.kind === "slam" ? "slam" : "air",
                        dmg: M.A.dmg,
                        heavy: M.A.kind === "slam" ? 0.9 : 0.25,
                    });
                    if (M.A.kind === "slam") {
                        start("slamDown", { from: s.pos.clone() });
                        break;
                    }
                }
                if (M.hitDone && clipT >= M.A.until - 0.01) {
                    const trk = M.track;
                    start("air", { target: T, idleT: 0, seg: M.seg });
                    M.track = trk;
                }
                break;
            }
            case "slamDown": {
                const g = c.ctx.world.groundHeight(s.pos.x, s.pos.z, s.pos.y);
                const k = M.t / 0.22;
                const e = k * k;
                kinTo(
                    _v
                        .copy(M.from)
                        .lerp(
                            _v2.set(M.from.x, g + H, M.from.z),
                            Math.min(1, e),
                        ),
                );
                if (M.t >= 0.22) {
                    s.kin = null;
                    s.pos.y = g + H + 0.01;
                    s.vel.set(0, -9, 0);
                    c.groundPound(_v.set(s.pos.x, g, s.pos.z));
                    start("landing");
                    layer.play("finisher", { from: 1.0, ts: 1.3, fade: 0.06 });
                }
                break;
            }
            case "landing":
                if (M.t > 0.4 / 1.3 + 0.1) free(0.25);
                break;
            case "dive": {
                const T = M.target;
                const u = clamp(M.t / M.arrive, 0, 1);
                const e = u * u * (3 - 2 * u);
                if (T.alive && !M.hitDone) {
                    const dir0 = _v2
                        .set(M.P0.x - T.pos.x, 0, M.P0.z - T.pos.z)
                        .normalize();
                    const cp = _cp.copy(T.pos).addScaledVector(dir0, 1.05);
                    cp.y = T.pos.y + H;
                    kinTo(
                        _v
                            .copy(M.P0)
                            .lerp(cp, e)
                            .setY(
                                lerp(M.P0.y, cp.y, e) +
                                    Math.sin(Math.PI * u) * M.arc,
                            ),
                    );
                    M.yawGoal = yawTo(feet(), T.pos);
                }
                if (!M.hitDone && u >= 1) {
                    M.hitDone = true;
                    s.kin = null;
                    c.playerHit(T, {
                        kind: "strike",
                        dmg: 16,
                        heavy: 0.7,
                        reach: 1.6,
                    });

                    const b = _v2
                        .set(Math.sin(s.facing), 0, Math.cos(s.facing))
                        .multiplyScalar(-2.5);
                    b.y = 3.2;
                    free(0.3, b);
                }
                if (M.name === "dive" && M.t > M.arrive + 0.3) free(0.3);
                break;
            }
            case "webStrike": {
                const T = M.target;
                if (!M.pulled && M.t >= 0.18) {
                    M.pulled = true;
                    M.flyT0 = M.t;
                    M.P0 = s.pos.clone();
                    M.arc = arcOver(M.P0, T.pos, 0.9);
                    M.track = layer.play("webStrike", {
                        from: 0.3,
                        ts: M.ts2,
                        fade: 0.08,
                    });
                    c.sfx("whoosh", 26);
                }
                if (M.pulled && T.alive && !M.hitDone) {
                    const u = clamp((M.t - M.flyT0) / M.fly, 0, 1);
                    const e = u * u * (3 - 2 * u);
                    const dir0 = _v2
                        .set(M.P0.x - T.pos.x, 0, M.P0.z - T.pos.z)
                        .normalize();
                    const cp = _cp.copy(T.pos).addScaledVector(dir0, 1.0);
                    cp.y = T.pos.y + H + 0.1;
                    kinTo(
                        _v
                            .copy(M.P0)
                            .lerp(cp, e)
                            .setY(
                                lerp(M.P0.y, cp.y, e) +
                                    Math.sin(Math.PI * u) * M.arc,
                            ),
                    );
                    M.yawGoal = yawTo(feet(), T.pos);
                    if (u >= 1) {
                        M.hitDone = true;
                        c.playerHit(T, {
                            kind: "strike",
                            dmg: 20,
                            heavy: 0.8,
                            stunBrute: true,
                            reach: 1.6,
                        });

                        M.recover = M.t;
                        M.R0 = s.pos.clone();
                        M.Rdir = dir0.clone();
                        const g = ctx.world.groundHeight(
                            s.pos.x + dir0.x * 0.8,
                            s.pos.z + dir0.z * 0.8,
                            s.pos.y - H + 0.3,
                        );
                        M.Ry = Math.min(g + H, s.pos.y);
                        M.Rdur = (0.93 - 0.57) / 1.45;
                        if (M.track) M.track.ts = 1.45;
                    }
                }
                if (M.hitDone && M.R0) {
                    const u = clamp((M.t - M.recover) / M.Rdur, 0, 1);
                    const e = 1 - (1 - u) * (1 - u);
                    const p = _v.copy(M.R0).addScaledVector(M.Rdir, 0.8 * e);
                    p.y = lerp(M.R0.y, M.Ry, u * u);
                    if (M.Ry > M.R0.y - 2) {
                        if (u < 1) kinTo(p);
                        else {
                            s.kin = null;
                            groundXZ(p.x, p.z);
                        }
                    } else if (u > 0.2)
                        free(0.3, _v2.set(M.Rdir.x * 2, 1, M.Rdir.z * 2));
                    if (u >= 1 && M.name === "webStrike") free(0.22);
                }
                if (!T.alive && !M.hitDone && M.t > 0.2) free(0.3);
                break;
            }
            case "whiff":
                if (M.t > 0.3) free(0.25);
                break;
            case "dodge": {
                const u = clamp((M.t - M.go) / 0.48, 0, 1);
                const e = 1 - Math.pow(1 - u, 2.2);
                const x = M.P0.x + M.move.x * M.dist * e;
                const z = M.P0.z + M.move.z * M.dist * e;
                if (onGround()) groundXZ(x, z);
                if (M.t > (M.side ? 0.6 : 0.7)) free(0.28);
                break;
            }
            case "hit":
            case "down": {
                const dur = M.name === "hit" ? 0.3 : 0.5;
                const u = clamp(M.t / dur, 0, 1);
                const e = 1 - (1 - u) * (1 - u);
                if (onGround())
                    groundXZ(
                        M.P0.x + M.dir.x * M.dist * e,
                        M.P0.z + M.dir.z * M.dist * e,
                    );
                if (M.name === "hit" && M.t > 0.38) free(0.22);
                if (M.name === "down") {
                    if (!M.up && M.t > (M.dead ? 2.2 : 1.0)) {
                        M.up = true;
                        layer.play("getUp", { ts: 1.2, fade: 0.12 });
                        if (M.dead || me.hp <= 0) {
                            me.hp = me.maxHp;
                            c.onPlayerDefeated();
                        }
                    }
                    if (M.up && M.t > (M.dead ? 2.2 : 1.0) + 0.8) free(0.25);
                }
                break;
            }
            case "throw": {
                if (M.t > 0.42 && !M.released) {
                    M.released = true;
                    layer.play("punch2", { ts: 1.1, fade: 0.1 });
                    if (M.target) M.yawGoal = yawTo(feet(), M.target.pos);
                }
                if (M.released && !M.launched && M.t > 0.42 + 0.23 / 1.1) {
                    M.launched = true;
                    c.props.launch(M.prop, M.target);
                    c.sfx("whoosh", 24);
                }
                if (M.t > 1.0) free(0.25);
                break;
            }
        }
    }

    function inputDir(I: any) {
        const cam = P.cam;
        const f = cam.forwardFlat(new THREE.Vector3());
        const r = cam.rightFlat(new THREE.Vector3());
        return f.multiplyScalar(I.move.y).addScaledVector(r, I.move.x);
    }
    let lastI: any = null;
    function attackInput(hold = false) {
        const I = lastI;
        const dir = I ? inputDir(I) : null;
        me.airborne = !onGround() && s.mode !== "ground";
        if (M.name === "air" || M.name === "airStrike") {
            const T = M.target;
            if (T && T.alive) {
                airStrike(T, hold ? 2 : ((M.seg ?? -1) + 1) % 3, hold);
            }
            return true;
        }
        if (s.mode === "air" || (s.mode === "ground" && s.kin)) {
            const T = c.pickTarget(dir, 14, feet());
            if (T && s.mode === "air") {
                diveStrike(T);
                return true;
            }
            return false;
        }
        if (s.mode !== "ground") return false;
        const T = c.pickTarget(dir, 8.5, feet());
        if (!T) {
            const S = MOVES[POOLS[me.comboStep % 3][0]];
            me.comboStep = (me.comboStep + 1) % 4;
            me.lastAttackT = c.time;
            start("whiff");
            layer.play(S.clip, { ts: S.ts, fade: 0.1 });
            c.sfx("whoosh", 8);
            return true;
        }
        if (
            hold &&
            (T.type !== "brute" || T.stun > 0) &&
            hdist(feet(), T.pos) < 4.5
        ) {
            launcher(T);
            me.comboStep = 0;
            return true;
        }
        if (c.time - me.lastAttackT > 0.95) me.comboStep = 0;
        strike(T, me.comboStep % 4);
        me.comboStep = (me.comboStep + 1) % 4;
        return true;
    }

    const CI: any = {
        move: { x: 0, y: 0 },
        look: { dx: 0, dy: 0 },
        swing: false,
        jump: false,
        zip: false,
        sprint: false,
        drop: false,
        swingPressed: false,
        jumpPressed: false,
        zipPressed: false,
        dropPressed: false,
        sprintPressed: false,
        swingReleased: false,
        jumpReleased: false,
        zipReleased: false,
        dropReleased: false,
        sprintReleased: false,
        jumpHeld: 0,
        aimT: 99,
        combat: true,
        combatSub: null,
        combatVel: null,
        combatCam: true,
    };
    function neutral(I: any) {
        CI.look = I.look;
        CI.aimT = I.aimT;
        CI.usingPad = I.usingPad;
        const hs = Math.hypot(vel.x, vel.z);
        CI.combatVel = vel;
        CI.combatSub =
            hs > 7.5 ? "sprint" : hs > 2.2 ? "run" : hs > 0.3 ? "walk" : "idle";
        return CI;
    }

    function yankStrike(T: any) {
        c.fx.strand(
            () => rig.handWorld("R", new THREE.Vector3()),
            () => T.chest(new THREE.Vector3()),
            { life: 0.3, sag: 0.02, fade: 0.08 },
        );
        c.sfx("thwip", 1.1);
        lastMove = "roundhouse";
        const S = MOVES.roundhouse;
        if ((T.type === "brute" && !(T.stun > 0)) || !T.yank) {
            strikeWith(T, S, { ender: true });
            return;
        }
        const P0 = feet().clone();
        const dir = _v2.set(T.pos.x - P0.x, 0, T.pos.z - P0.z);
        if (dir.lengthSq() < 1e-4)
            dir.set(Math.sin(s.facing), 0, Math.cos(s.facing));
        dir.normalize();
        const windup = S.hit / S.ts;
        const pull = Math.max(0.24, windup + 0.02);
        T.yank(_v.copy(P0).addScaledVector(dir, S.reach), pull);
        strikeWith(T, S, { ender: true, noMove: true });
        M.dashDur = pull;
        M.clipAt = Math.max(0, pull - windup);
        M.runT = 0;
        if (M.clipAt > 0) layer.stop(0.1);
        else if (!M.clipOn) playStrikeClip();
    }
    const deny = (msg: string) => {
        c.hud.flash(msg);
        c.sfx("deny");
    };

    function doAction(k: string, I: any) {
        const dir = inputDir(I);
        const air =
            s.mode !== "ground" || M.name === "air" || M.name === "airStrike";
        if (k === "attack") return attackInput(false);
        if (k === "web") {
            const T =
                M.name === "air" || M.name === "airStrike"
                    ? M.target
                    : c.pickTarget(dir, 26, feet(), 0, true) ||
                      c.pickTarget(dir, 26, feet());
            if (T) webShoot(T);
            else deny("No target");
            return true;
        }
        if (k === "strike") {
            const far = c.pickTarget(dir, 22, feet(), 3.5, 1.95);
            if (far) {
                if (s.mode === "swing") P.web?.release?.();
                webStrike(far);
                return true;
            }
            const near2 = !air && c.pickTarget(dir, 3.5, feet());
            if (near2) {
                yankStrike(near2);
                return true;
            }
            return false;
        }
        if (k === "finisher") {
            const T = c.pickTarget(dir, 10, feet());
            const cost = T?.type === "brute" ? 2 : 1;
            if (T && !air && me.focus >= cost) {
                me.focus -= cost;
                finisher(T);
                return true;
            }
            if (air) return false;
            if (!T) deny("No target");
            else deny(cost > 1 ? "Brutes need 2 focus" : "Need focus");
            return true;
        }
        if (air) {
            deny("Not in the air");
            return true;
        }
        if (k === "heal") {
            if (me.focus >= 1 && me.hp < me.maxHp) {
                me.focus -= 1;
                c.heal(35);
            } else deny(me.focus < 1 ? "Need focus" : "Health full");
            return true;
        }
        if (k === "throw") {
            const pr = c.props.nearest(feet(), 14);
            const T = c.pickTarget(dir, 25, feet());
            if (pr && T) {
                throwProp(pr, T);
                return true;
            }
            deny(pr ? "No target" : "Nothing to throw");
            return true;
        }
        return true;
    }
    me.override = (I: any, dt: number) => {
        lastI = I;
        const inp = c.input;
        inp.poll();
        prevPos.copy(s.pos);
        me.airborne =
            s.mode === "air" ||
            s.mode === "swing" ||
            s.mode === "zip" ||
            M.name === "air" ||
            M.name === "airStrike" ||
            (M.name === "launch" && M.rise);
        const clipT = M.track ? M.track.t : 0;
        const near = nearest() != null;
        const ground = s.mode === "ground";
        let passZip = true;
        let passQuick = true;

        if (inp.holdNow()) {
            if (
                M.name === "strike" &&
                !M.long &&
                M.target?.alive &&
                c.time - M.pressT < 0.45 &&
                M.target.state !== "knock" &&
                (M.target.type !== "brute" || M.target.stun > 0)
            ) {
                launcher(M.target);
                me.comboStep = 0;
            } else if (
                (M.name === "air" || M.name === "airStrike") &&
                M.target?.alive
            )
                airStrike(M.target, 2, true);
            else if (M.name === "free" || M.name === "whiff") {
                attackInput(true);
            }
        }

        const threat = c.nearestThreat();
        if (inp.has("dodge") && !ground && M.name === "free") inp.take("dodge");
        if (
            inp.has("dodge") &&
            ground &&
            !["down", "finisher", "throw", "landing"].includes(M.name) &&
            !(M.name === "dodge" && M.t < 0.4)
        ) {
            inp.take("dodge");
            const tdir = threat
                ? _v
                      .set(
                          threat.e.pos.x - s.pos.x,
                          0,
                          threat.e.pos.z - s.pos.z,
                      )
                      .normalize()
                      .clone()
                : new THREE.Vector3();
            const perfect =
                !!threat &&
                threat.at - c.time <= 0.3 &&
                threat.at - c.time > -0.05;
            s.kin = null;
            dodge(tdir, perfect, inputDir(I));
            c.onDodge(threat, perfect);
            motion(dt);
            turn(dt, 16, 13);
            pushProps();
            measure(dt);
            return neutral(I);
        }

        if (I.jumpPressed && ground && M.name !== "free") {
            const canJump =
                M.name === "whiff" ||
                (M.name === "strike" && (M.hitDone || !M.clipOn)) ||
                (M.name === "hit" && M.t > 0.2) ||
                (M.name === "dodge" && M.t > 0.45) ||
                M.name === "landing";
            if (
                canJump ||
                (threat && ["strike", "whiff", "hit"].includes(M.name))
            )
                free(0.14);
        }
        if (I.jumpPressed && ground && M.name === "free" && threat) {
            const perfect =
                threat.at - c.time <= 0.3 && threat.at - c.time > -0.05;
            me.invulnUntil = Math.max(me.invulnUntil, c.time + 0.45);
            c.onDodge(threat, perfect);
            if (perfect) me.counterUntil = c.time + 1.4;
        }

        const cancel =
            M.name === "free" ||
            (M.name === "whiff" && M.t > 0.1) ||
            (M.name === "strike" && M.hitDone && clipT >= M.hit + 0.05) ||
            (M.name === "dodge" && (M.perfect ? M.t > 0.08 : M.t > 0.38)) ||
            (M.name === "hit" && M.t > 0.3) ||
            (M.name === "landing" && M.t > 0.15) ||
            M.name === "air" ||
            (M.name === "airStrike" && M.hitDone);
        if (cancel) {
            for (const k of [
                "finisher",
                "throw",
                "strike",
                "heal",
                "attack",
                "web",
            ]) {
                if (!inp.has(k)) continue;
                inp.take(k);
                const used = doAction(k, I);
                if (k === "strike") passZip = !used;
                if (k === "finisher") passQuick = !used;
                break;
            }
        } else if (
            inp.has("web") &&
            ![
                "dodge",
                "down",
                "finisher",
                "throw",
                "hit",
                "webStrike",
            ].includes(M.name)
        ) {
            inp.take("web");
            doAction("web", I);
        }
        if (me.hp <= 0 && M.name !== "down" && ground) {
            const e = c.enemies.find((x: any) => x.alive);
            if (e) takeHit(e, 0, true);
        }
        if (M.name !== "free") {
            motion(dt);
            turn(dt);
            pushProps();
            measure(dt);
            if (M.name !== "free") return neutral(I);
        }
        pushProps();
        return passThrough(I, near, ground, passZip, passQuick);
    };

    const pushProps = () => {
        if (s.mode === "ground" && !s.kin)
            c.props.collide(feet(), 0.3, (x: number, z: number) => {
                const L = Math.hypot(x, z);
                const k = L > 0.12 ? 0.12 / L : 1;
                s.pos.x += x * k;
                s.pos.z += z * k;
            });
    };

    function measure(dt: number) {
        if (dt < 1e-4) return;
        vel.copy(s.kin ? s.kin.p2 : s.pos)
            .sub(prevPos)
            .divideScalar(dt);
        if (vel.length() > 40) vel.setLength(40);
    }

    function passThrough(
        I: any,
        near: boolean,
        ground: boolean,
        passZip: boolean,
        passQuick: boolean,
    ) {
        vel.set(0, 0, 0);
        I.combat = near && ground;
        I.combatSub = null;
        I.combatVel = null;
        I.combatCam = false;
        if (!passZip) {
            I.zipPressed = false;
            I.zip = false;
        }
        if (!passQuick) I.quickPressed = false;
        if (near && ground) {
            I.dropPressed = false;
            I.drop = false;
            I.ctrl = false;
        }
        return I;
    }
    me.late = (dt: number) => {
        layer.apply(dt);
    };
    me.reset = () => {
        if (M.name !== "free") free(0.3);
        me.comboStep = 0;
    };
    me.moveName = () => M.name;
    return me;
}
