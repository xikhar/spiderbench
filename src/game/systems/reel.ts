/**
 * Replay and reel capture utilities.
 *
 * @module src-game-systems-reel
 * @version 1.0.0
 * @file src/game/systems/reel.ts
 * @since 0.0.1
 * @description Provides developer and reel capture helpers for recording and playback-related workflows.
 */

import * as THREE from "three";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const H = 0.95;
const ease = (t: number) => {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
};
const MOUSE: Record<string, number> = {
    MouseLeft: 0,
    MouseMiddle: 1,
    MouseRight: 2,
};

const N = Math.PI,
    S = 0,
    E = Math.PI / 2,
    W = -Math.PI / 2;

const chain = (t0: number, n: number, on = 1.25, off = 0.5, trick = true) => {
    const hold: any[] = [],
        tap: any[] = [];
    for (let i = 0, t = t0; i < n; i++, t += on + off) {
        hold.push([t, t + on, "MouseRight"]);
        if (trick) tap.push([t + on - 0.06, "Space"]);
    }
    return { hold, tap };
};
const merge = (...o: any[]) => ({
    hold: o.flatMap((x) => x.hold || []),
    tap: o.flatMap((x) => x.tap || []),
});

export const SHOTS: any[] = [
    {
        id: "ts-swing",
        title: "Times Square · swing",
        tod: "night",
        dur: 5.5,
        yaw: N,
        setup: (R: any) => R.air(V(0, 36, -92), N, V(0, -1, -26)),
        ...merge({ hold: [[0, 9, "KeyW"]] }, chain(0.05, 3, 1.3, 0.45)),
        look: [
            [0.6, 0, 0, 0],
            [2.2, 1.3, -0.05, 1.5],
            [3.6, 1.9, -0.1, 2],
            [5.0, 0.6, 0, 0],
        ],
    },
    {
        id: "ts-run",
        title: "Times Square · street run + zip",
        tod: "night",
        dur: 5,
        yaw: N,
        pitch: -0.05,
        setup: (R: any) => R.ground(V(-22, 0, -95), N),
        hold: [
            [0, 9, "KeyW"],
            [0.2, 2.4, "ShiftLeft"],
        ],
        tap: [
            [1.5, "Space"],
            [3.1, "KeyE"],
        ],
        look: [
            [0, 0.9, 0.05],
            [1.3, 0.3, 0],
            [2.6, 0, -0.08],
            [3.4, 0, -0.12],
        ],
    },
    {
        id: "ts-fight",
        title: "Times Square · combo + finisher",
        tod: "night",
        dur: 6.5,
        setup: (R: any) => {
            R.ground(V(18, 0, -150), N);
            R.fight("mmmb", 6);
        },
        tap: [
            [0.7, "MouseLeft"],
            [1.0, "MouseLeft"],
            [1.3, "MouseLeft"],
            [1.6, "MouseLeft"],
            [2.1, "KeyE"],
            [2.7, "MouseLeft"],
            [3.0, "MouseLeft"],
            [3.3, "MouseLeft"],
            [4.0, "KeyF"],
            [4.4, "MouseLeft"],
            [4.7, "MouseLeft"],
            [5.3, "KeyQ"],
        ],
        hold: [[3.55, 3.85, "MouseLeft"]],
        slow: [[5.3, 1.1, 0.35]],
    },
    {
        id: "metlife-perch",
        title: "MetLife roof · perch + dive",
        tod: "night",
        dur: 6,
        yaw: S,
        pitch: 0.2,
        setup: (R: any) => R.perch(V(430, 223.8, -160.2), V(0, 0, 1), S),
        hold: [
            [3.1, 9, "KeyW"],
            [3.7, 9, "ControlLeft"],
        ],
        tap: [[2.9, "Space"]],
        pre: 0.8,
        look: [
            [0, 2.4, 0.1, 0.5],
            [2.2, 0.6, 0.12, 1.5],
            [2.8, 0, 0.2, 1],
            [4, 0, 0.25, 0],
        ],
    },
    {
        id: "57th-tricks",
        title: "Billionaires' Row · swing tricks",
        tod: "sunset",
        dur: 5.5,
        yaw: E,
        setup: (R: any) => R.air(V(-110, 62, -560), E, V(27, 0, 0)),
        ...merge({ hold: [[0, 9, "KeyW"]] }, chain(0.05, 3, 1.2, 0.55)),
        look: [
            [0.5, 0, 0, 0],
            [1.8, 1.35, 0, 4],
            [3.4, 1.35, 0, 4],
            [4.8, 0.2, 0, 1],
        ],
    },
    {
        id: "esb-dive",
        title: "Empire State · dive + catch",
        tod: "sunset",
        dur: 5.5,
        yaw: S,
        pitch: 0.45,
        setup: (R: any) => R.air(V(243, 240, 250), S, V(0, 2, 9)),
        hold: [
            [0, 9, "KeyW"],
            [0.15, 2.6, "ControlLeft"],
            [2.8, 9, "MouseRight"],
        ],
        look: [
            [0, -0.3, 0, 2],
            [1.5, -1.2, -0.05, 3],
            [2.6, -0.4, 0.1, 1],
            [3.6, 0, -0.3, 0],
        ],
    },
    {
        id: "5th-swing",
        title: "5th Avenue · swing past the Empire State",
        tod: "sunset",
        dur: 5,
        yaw: S,
        setup: (R: any) => R.air(V(250, 44, 110), S, V(0, 0, 27)),
        ...merge({ hold: [[0, 9, "KeyW"]] }, chain(0.05, 3, 1.35, 0.4, false)),
        look: [
            [0.6, 0, 0, 0],
            [2.0, -1.1, -0.12, 3],
            [3.2, -2.6, -0.05, 2],
            [4.6, -3.0, 0, 1],
        ],
    },
    {
        id: "bridge",
        title: "Brooklyn Bridge · swing + zip to the tower",
        tod: "sunset",
        dur: 6,
        yaw: E,
        pitch: -0.15,
        setup: (R: any) => R.air(V(640, 62, 2600), E, V(26, 2, 0)),
        ...merge(
            {
                hold: [[0, 3.3, "KeyW"]],
                tap: [
                    [2.6, "KeyE"],
                    [4.4, "Space"],
                ],
            },
            chain(0.1, 1, 1.9, 0.5),
        ),
        look: [
            [2.7, 0, 0, 0],
            [3.8, -1.2, 0.05, 3],
            [5.6, -2.0, -0.1, 6],
        ],
    },
    {
        id: "hudson-swing",
        title: "Hudson waterfront · swing along 12th Avenue",
        tod: "sunset",
        dur: 5.5,
        yaw: S,
        setup: (R: any) => R.air(V(-608, 38, -260), S, V(0, 0, 26)),
        ...merge({ hold: [[0, 9, "KeyW"]] }, chain(0.05, 3, 1.3, 0.5)),
        look: [
            [0.6, 0, 0, 0],
            [2.0, -1.2, 0, 4],
            [3.6, -1.5, -0.05, 5],
            [5.0, -0.5, 0, 2],
        ],
    },
    {
        id: "cps-swing",
        title: "Central Park South · swing",
        tod: "morning",
        dur: 5,
        yaw: E,
        setup: (R: any) => R.air(V(-225, 42, -574), E, V(26, 0, 0)),
        ...merge({ hold: [[0, 9, "KeyW"]] }, chain(0.05, 3, 1.25, 0.45)),
        look: [
            [0.8, 0, 0, 0],
            [2.2, 0.9, 0.05, 5],
            [3.8, 0.9, 0.05, 6],
            [4.8, 0.3, 0, 2],
        ],
    },
    {
        id: "park-run",
        title: "Central Park · run + jumps",
        tod: "morning",
        dur: 5,
        yaw: N,
        setup: (R: any) => R.ground(V(0, 0, -715), N),
        hold: [
            [0, 9, "KeyW"],
            [2.2, 2.7, "Space"],
        ],
        tap: [
            [1.0, "Space"],
            [4.0, "Space"],
        ],
        look: [
            [0, -1.5, 0, 0.5],
            [2.0, -0.8, 0, 0],
            [4.0, 0.8, 0, 1],
        ],
    },
    {
        id: "harlem-swing",
        title: "Harlem · swing + web boosts",
        tod: "morning",
        dur: 5.5,
        yaw: N,
        setup: (R: any) => R.air(V(-250, 36, -2260), N, V(0, 0, -25)),
        ...merge(
            {
                hold: [[0, 9, "KeyW"]],
                tap: [
                    [1.9, "KeyQ"],
                    [4.1, "KeyQ"],
                ],
            },
            chain(0.05, 2, 1.3, 1.0, false),
        ),
        look: [
            [0.5, 0, 0, 0],
            [1.7, 1.0, -0.05, 2],
            [3.2, 2.2, 0, 1.5],
            [5.0, 0.6, 0, 0],
        ],
    },
    {
        id: "wall-run",
        title: "Billionaires' Row · wall run",
        tod: "day",
        dur: 5.5,
        yaw: S,
        pitch: -0.2,
        setup: (R: any) => R.ground(V(155, 0, -555.5), S),
        hold: [
            [0.1, 9, "KeyW"],
            [0.1, 9, "ShiftLeft"],
        ],
        look: [
            [0.5, 0, 0, 0],
            [2.0, 0.9, -0.1, 2],
            [4.0, 1.4, 0, 6],
        ],
    },
    {
        id: "slingshot",
        title: "8th Avenue · web slingshot",
        tod: "day",
        dur: 6,
        yaw: N,
        setup: (R: any) => R.ground(V(-250, 0, -100), N),
        hold: [
            [0.2, 2.3, "ControlLeft"],
            [1.0, 2.25, "KeyS"],
            [2.5, 9, "KeyW"],
            [3.9, 5.4, "MouseRight"],
        ],
        tap: [
            [0.45, "MouseLeft"],
            [0.75, "MouseRight"],
        ],
        look: [
            [2.6, 0, 0, 0],
            [3.6, 1.0, 0, 3],
            [5.5, 0.4, 0, 1],
        ],
    },
    {
        id: "street-fight",
        title: "Hell's Kitchen · street fight",
        tod: "day",
        dur: 6.5,
        setup: (R: any) => {
            R.ground(V(-425, 0, -230), N);
            R.fight("mmgb", 6);
        },
        tap: [
            [0.6, "MouseLeft"],
            [0.9, "MouseLeft"],
            [1.2, "MouseLeft"],
            [1.8, "KeyF"],
            [2.2, "KeyE"],
            [2.8, "MouseLeft"],
            [3.1, "MouseLeft"],
            [3.4, "MouseLeft"],
            [3.9, "KeyR"],
            [4.4, "MouseLeft"],
            [4.8, "KeyE"],
            [5.4, "KeyQ"],
        ],
        slow: [[5.4, 1.0, 0.35]],
    },
    {
        id: "fidi-dive",
        title: "Financial District · dive + swing",
        tod: "day",
        dur: 5.5,
        yaw: S,
        pitch: 0.45,
        setup: (R: any) => R.air(V(-100, 260, 2690), S, V(0, 0, 8)),
        hold: [
            [0, 9, "KeyW"],
            [0.1, 2.8, "ControlLeft"],
            [3.0, 4.6, "MouseRight"],
        ],
        tap: [[4.55, "Space"]],
        look: [
            [0, 0.4, -0.2, 0],
            [1.5, 1.6, 0.05, 2],
            [2.8, 0.6, 0.1, 1],
            [3.4, 0, -0.1, 0],
            [5.2, -0.8, 0, 3],
        ],
    },
    {
        id: "gc-zip",
        title: "Park Avenue · zip to Grand Central",
        tod: "dusk",
        dur: 5.5,
        yaw: N,
        pitch: -0.12,
        setup: (R: any) => R.air(V(430, 42, 90), N, V(0, 0, -25)),
        ...merge(
            { hold: [[0, 3.4, "KeyW"]], tap: [[3.5, "KeyE"]] },
            chain(0.05, 2, 1.2, 0.5),
        ),
        look: [
            [0.4, 0, 0, 0],
            [1.6, -0.9, 0, 2],
            [2.8, 0, 0, 0],
            [3.9, 0, 0, 0],
            [5.3, -1.6, -0.05, 4],
        ],
    },
    {
        id: "village-swing",
        title: "Greenwich Village · low swings",
        tod: "dusk",
        dur: 5,
        yaw: S,
        setup: (R: any) => R.air(V(0, 28, 420), S, V(0, 0, 24)),
        ...merge({ hold: [[0, 9, "KeyW"]] }, chain(0.05, 3, 1.15, 0.45)),
        look: [
            [0.4, 0, 0, 0],
            [1.8, 0.9, 0.05, 1],
            [3.4, -0.9, 0.05, 1],
            [4.6, 0, 0, 0],
        ],
    },
    {
        id: "chinatown-fight",
        title: "Chinatown · brute fight",
        tod: "dusk",
        dur: 6.5,
        setup: (R: any) => {
            R.ground(V(436, 0, 1150), N);
            R.fight("mbm", 6);
        },
        tap: [
            [0.6, "MouseLeft"],
            [0.9, "MouseLeft"],
            [1.2, "MouseLeft"],
            [1.7, "KeyC"],
            [2.1, "KeyE"],
            [2.6, "MouseLeft"],
            [2.9, "MouseLeft"],
            [3.2, "KeyF"],
            [3.6, "KeyR"],
            [4.2, "MouseLeft"],
            [4.5, "MouseLeft"],
            [4.8, "MouseLeft"],
            [5.3, "KeyQ"],
        ],
        slow: [
            [1.7, 0.5, 0.4],
            [5.3, 1.0, 0.35],
        ],
    },
    {
        id: "ts-roofrun",
        title: "Times Square · rooftop run + leap",
        tod: "night",
        dur: 5.5,
        yaw: E,
        setup: (R: any) => R.ground(V(-66, 50, -200), E),
        hold: [
            [0, 9, "KeyW"],
            [0.45, 0.85, "Space"],
            [1.5, 9, "MouseRight"],
        ],
        look: [
            [0.6, 0, 0, 0],
            [1.4, 0.4, 0.1, 1],
            [3.0, 1.1, -0.05, 3],
            [5.0, 0.5, 0, 2],
        ],
    },
    {
        id: "ts-wallclimb",
        title: "Times Square · wall run to the roof",
        tod: "night",
        dur: 6,
        yaw: W,
        pitch: -0.25,
        setup: (R: any) => R.ground(V(-30, 0, -205), W),
        hold: [
            [0.1, 9, "KeyW"],
            [0.1, 9, "ShiftLeft"],
        ],
        look: [
            [0.5, 0, 0, 0],
            [2.5, -1.0, 0, 2],
            [4.5, -1.4, 0.05, 5],
            [5.8, -0.6, 0.1, 3],
        ],
    },
    {
        id: "ts-finale",
        title: "Times Square · perch",
        tod: "night",
        dur: 6,
        yaw: E,
        pitch: 0.12,
        setup: (R: any) => R.perch(V(-34.2, 45, -165), V(1, 0, 0), E),
        pre: 0.8,
        look: [
            [0, 2.5, 0.05, 0],
            [3.0, 1.2, 0, 1.5],
            [5.5, -0.4, -0.05, 6],
        ],
    },
];

export function createReel(sys: any) {
    const ctx = sys.ctx,
        P = ctx.player,
        input = ctx.input;
    const st: any = {
        active: false,
        i: -1,
        phase: "idle",
        t: 0,
        pt: 0,
        list: [],
        shot: null,
        held: new Set(),
        fired: new Set(),
        loop: false,
        dYaw: 0,
    };
    const telemetry: any[] = [];
    let origUpdate: any = null,
        origPoll: any = null,
        style: HTMLStyleElement | null = null,
        fade: HTMLDivElement | null = null,
        keyOff: (() => void) | null = null,
        sysEntry: any = null,
        crimesWas = true;

    const ctrl = () => st.held.has("ControlLeft");
    function down(code: string) {
        if (code in MOUSE)
            dispatchEvent(
                new MouseEvent("mousedown", {
                    button: MOUSE[code],
                    ctrlKey: ctrl(),
                }),
            );
        else
            dispatchEvent(
                new KeyboardEvent("keydown", {
                    code,
                    key: code,
                    ctrlKey: code === "ControlLeft" || ctrl(),
                }),
            );
    }
    function up(code: string) {
        if (code in MOUSE)
            dispatchEvent(
                new MouseEvent("mouseup", {
                    button: MOUSE[code],
                    ctrlKey: ctrl(),
                }),
            );
        else dispatchEvent(new KeyboardEvent("keyup", { code, key: code }));
    }

    const hdown = (code: string) => {
        if (code === "MouseLeft") return down(code);
        input.press(code);
        if (code === "ControlLeft") down(code);
    };
    const hup = (code: string) => {
        if (code === "MouseLeft") return up(code);
        input.release(code);
        if (code === "ControlLeft") up(code);
    };
    function releaseAll() {
        for (const c of st.held) hup(c);
        st.held.clear();
        ctx.flow?.clearInput?.();
    }

    const R = {
        air(p: THREE.Vector3, yaw: number, vel: THREE.Vector3) {
            P.teleport(p.clone(), yaw);
            if (vel) P.traversal.toAir(vel.clone());
            R.face(yaw);
        },
        ground(p: THREE.Vector3, yaw: number) {
            const g = ctx.world.groundHeight(p.x, p.z, p.y + 3);
            P.teleport(V(p.x, g + H, p.z), yaw);
            R.face(yaw);
        },
        perch(p: THREE.Vector3, n: THREE.Vector3, yaw: number) {
            P.teleport(
                p
                    .clone()
                    .addScaledVector(n, 1.5)
                    .setY(p.y + 2),
                yaw,
            );
            P.traversal.perchAt(p.clone(), n.clone());
            P.web?.release?.();
            P.cam.reset(P.position, yaw);
            R.face(yaw);
        },
        face(yaw: number) {
            P.cam.yaw = yaw;
            P.cam.pitch = st.shot?.pitch ?? 0.14;
        },
        fight(spec: string, dist: number) {
            const c = (window as any).__cmb;
            if (!c) return;
            c.debug
                .fight(spec, dist)
                .then(() => c.debug.focus(3))
                .catch(() => {});
        },
    };

    function lookAt(shot: any, t: number) {
        const K = shot.look;
        if (!K || !K.length) return [0, 0, 0];
        const at = (k: any[], i: number) => k[i] || 0;
        if (t <= K[0][0]) {
            const k = K[0][0] > 0 ? ease(t / Math.max(K[0][0], 0.4)) : 1;
            return [at(K[0], 1) * k, at(K[0], 2) * k, at(K[0], 3) * k];
        }
        for (let j = 1; j < K.length; j++)
            if (t < K[j][0]) {
                const a = K[j - 1],
                    b = K[j],
                    k = ease((t - a[0]) / (b[0] - a[0]));
                return [1, 2, 3].map(
                    (i) => at(a, i) + (at(b, i) - at(a, i)) * k,
                );
            }
        const L = K[K.length - 1];
        return [at(L, 1), at(L, 2), at(L, 3)];
    }
    function steer() {
        const shot = st.shot;
        st.dYaw = 0;
        if (
            !shot ||
            shot.yaw == null ||
            (st.phase !== "play" &&
                st.phase !== "out" &&
                !(st.phase === "hold" && st.preDone))
        ) {
            P.cam.extraDist = 0;
            return;
        }
        const [dy, dp, dd] = lookAt(shot, st.t);
        st.dYaw = dy;
        P.cam.extraDist = dd;
        P.cam.yaw = shot.yaw + dy;
        if (shot.pitch != null || dp) P.cam.pitch = (shot.pitch ?? 0.14) + dp;
        if (Math.abs(dy) > 0.02 || Math.abs(dp) > 0.02) P.cam.lastLook = 0;
    }

    function beginShot() {
        const shot = (st.shot = st.list[st.i]);
        st.t = 0;
        st.fired.clear();
        if (!st.preDone) {
            shot.setup(R);
            ctx.pipeline.resetHistory?.();
        }
        st.preDone = false;
        telemetry.push({
            id: shot.id,
            modes: [],
            events: [],
            start: performance.now(),
        });
        fade!.style.opacity = "0";
    }
    function prepShot() {
        const shot = st.list[st.i];
        releaseAll();
        try {
            (window as any).__cmb?.debug?.end?.();
        } catch {
            void 0;
        }
        try {
            sys.crimes?.cancel?.();
        } catch {
            void 0;
        }
        if (shot.tod) ctx.lighting.setTimeOfDay(shot.tod);

        st.preDone = false;
        if (shot.pre) {
            st.shot = shot;
            st.t = 0;
            R.face(shot.yaw ?? P.cam.yaw);
            shot.setup(R);
            ctx.pipeline.resetHistory?.();
            st.preDone = true;
        }
    }
    function inputs(shot: any, t1: number) {
        for (const [a, b, code] of shot.hold || []) {
            const k = "h" + a + code;
            if (!st.fired.has(k) && t1 >= a) {
                st.fired.add(k);
                if (t1 < b) {
                    hdown(code);
                    st.held.add(code);
                }
            }
            if (
                st.held.has(code) &&
                t1 >= b &&
                st.fired.has(k) &&
                !st.fired.has(k + "u")
            ) {
                st.fired.add(k + "u");
                hup(code);
                st.held.delete(code);
            }
        }
        for (const [a, code, ms = 90] of shot.tap || []) {
            const k = "t" + a + code;
            if (!st.fired.has(k) && t1 >= a) {
                st.fired.add(k);
                down(code);
                const kept = st.held.has(code);
                setTimeout(() => {
                    if (!kept && st.active) up(code);
                }, ms);
            }
        }
        for (const [a, dur, scale] of shot.slow || []) {
            const k = "s" + a;
            if (!st.fired.has(k) && t1 >= a) {
                st.fired.add(k);
                (window as any).__cmb?.slowmo?.(dur, scale, 0.3);
            }
        }
    }
    function record() {
        const T = telemetry[telemetry.length - 1];
        if (!T) return;
        const m = P.mode + "/" + P.sub;
        if (T.modes[T.modes.length - 1]?.[1] !== m)
            T.modes.push([+st.t.toFixed(2), m]);
        for (const e of P.traversal.events || [])
            if (e.type !== "noAnchor")
                T.events.push([
                    +st.t.toFixed(2),
                    e.type + (e.trick ? ":" + e.trick : ""),
                ]);
        T.combo = (window as any).__cmb?.combo?.n ?? 0;
        T.y = +(P.position.y - H).toFixed(1);
    }
    function update(dt: number) {
        if (!st.active) return;
        const rdt = ctx.realDt ?? dt;
        if (st.phase === "play") {
            st.t += dt;
            inputs(st.shot, st.t);
            record();
            if (st.t >= st.shot.dur) {
                st.phase = "out";
                st.pt = 0;
                fade!.style.opacity = "1";
            }
        } else if (st.phase === "out") {
            st.t += dt;
            st.pt += rdt;
            inputs(st.shot, st.t);
            if (st.pt >= 0.32) {
                st.i++;
                if (st.i >= st.list.length) {
                    if (st.loop) st.i = 0;
                    else {
                        stop();
                        return;
                    }
                }
                prepShot();
                st.phase = "hold";
                st.pt = 0;
            }
        } else if (st.phase === "hold") {
            st.pt += rdt;
            if (st.pt >= 0.3 + (st.list[st.i]?.pre || 0)) {
                beginShot();
                st.phase = "play";
            }
        }
    }

    function start(opts: any = {}) {
        if (st.active) stop();
        st.list = opts.only
            ? opts.only.map((i: number) => SHOTS[i]).filter(Boolean)
            : SHOTS.slice();
        if (!st.list.length) return false;
        st.loop = !!opts.loop;
        st.active = true;
        st.i = 0;
        st.shot = null;
        telemetry.length = 0;
        style = document.createElement("style");
        style.id = "reel-css";
        style.textContent = `#sys-root,#hud,#cmb-hud,#dev-menu{display:none!important}
#reel-fade{position:fixed;inset:0;background:#000;opacity:1;transition:opacity .3s ease;pointer-events:none;z-index:90}`;
        document.head.appendChild(style);
        fade = document.createElement("div");
        fade.id = "reel-fade";
        document.body.appendChild(fade);
        crimesWas = sys.crimes?.enabled ?? true;
        sys.crimes?.enable?.(false);
        origUpdate = P.update;
        P.update = function (dt: number) {
            steer();
            return origUpdate.call(this, dt);
        };

        origPoll = input.poll;
        input.poll = function (...a: any[]) {
            const s = origPoll.apply(this, a),
                d = st.dYaw;
            if (s?.move && d) {
                const c = Math.cos(d),
                    sn = Math.sin(d),
                    x = s.move.x,
                    y = s.move.y;
                s.move = { x: y * sn + x * c, y: y * c - x * sn };
            }
            return s;
        };
        sysEntry = { name: "reel", update };
        ctx.systems.push(sysEntry);
        keyOff = ctx.flow?.onKey?.((e: KeyboardEvent) => {
            if (e.code === "Escape" && st.active) {
                stop();
                return true;
            }
            return false;
        });
        prepShot();
        st.phase = "hold";
        st.pt = 0;
        return true;
    }
    function stop() {
        if (!st.active) return;
        st.active = false;
        st.phase = "idle";
        st.dYaw = 0;
        P.cam.extraDist = 0;
        releaseAll();
        try {
            (window as any).__cmb?.debug?.end?.();
        } catch {
            void 0;
        }
        if (origUpdate) {
            P.update = origUpdate;
            origUpdate = null;
        }
        if (origPoll) {
            input.poll = origPoll;
            origPoll = null;
        }
        const k = ctx.systems.indexOf(sysEntry);
        if (k >= 0) ctx.systems.splice(k, 1);
        keyOff?.();
        keyOff = null;
        style?.remove();
        fade?.remove();
        style = fade = null;
        sys.crimes?.enable?.(crimesWas);
        sys.applySettings?.();
    }
    const api = {
        start,
        stop,
        shots: SHOTS,
        telemetry,
        get active() {
            return st.active;
        },
        status() {
            return st.active
                ? `Shot ${Math.min(st.i + 1, st.list.length)} of ${st.list.length} · ${st.list[st.i]?.title ?? ""}`
                : `Off: ${SHOTS.length} shots, about ${Math.round(SHOTS.reduce((a, s) => a + s.dur + 0.6, 0))} s · Esc stops`;
        },
    };
    (window as any).__reel = api;
    return api;
}
