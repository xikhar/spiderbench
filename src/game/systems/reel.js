// OWNER: systems engineer. CINEMATIC DEMO REEL (dev menu: "Cinematic demo reel"). Plays a scripted showcase of the game:
// ~17 shots of 4-6 s across the best-looking areas (Times Square, Empire State, 5th Av, Billionaires' Row, Grand Central /
// MetLife, Central Park, the Financial District, Brooklyn Bridge), each a traversal or combat combo (swings with release
// tricks, zips, point launches, wall runs, dives, the web slingshot, fights with finishers). Meant to be screen-recorded
// for demos: HUD hidden, fades between shots, time of day per shot.
//
// The camera is ALWAYS the normal game camera (chase camera behind the player, the combat camera in fights). The reel only
// turns it the way a player would with the mouse: per shot a heading (`yaw`) plus gentle look-around keyframes (`look`),
// and the movement input is counter-rotated by the look offset, so looking around never changes where he goes.
// Input: synthetic DOM key / mouse events on window (the same listeners real input uses: player/input.js for traversal,
// game/combat/input.js for fighting) and the existing debug hooks (traversal.toAir / perchAt, __cmb.debug.fight,
// __cmb.slowmo).
//   const reel = createReel(sys) -> { start(opts), stop(), active, status(), shots, telemetry }
//   opts: { only: [index...] } plays a subset (tools/reel_check.mjs), { loop: true } repeats.  Esc stops.
// Shot: { id, title, tod, dur, setup(R), yaw (camera / travel heading; omit = camera untouched), pitch (base pitch),
//         look: [[t, dYaw, dPitch, dDist], ...] (the game camera orbited around him: yaw / pitch offsets from the heading, up
//               to all the way round in front of him, plus an extra pull-back in m to show the city; eased between keys;
//               kept at 0 around zips / the slingshot / perch launches, which aim with the camera),
//         hold: [[t0, t1, code]], tap: [[t, code, ms]], slow: [[t, dur, scale]] }   (times in game seconds)
import * as THREE from "three";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const H = 0.95; // body centre above the feet (traversal H)
const ease = (t) => {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
};
const MOUSE = { MouseLeft: 0, MouseMiddle: 1, MouseRight: 2 };

// ------------------------------------------------------------------------------------------------ the shots
// Coordinates: avenues run along z (x = -610 12th, -430 10th, -250 8th, 0 6th / Times Square, 250 5th, 430 Park, 610 2nd),
// north = -z (yaw PI), south = +z (yaw 0), east = +x (yaw PI / 2). Landmarks: Times Square x -80..82 z -245..-78 (towers
// ~45 m), ESB lot x 146..234 z 240..320 (459 m), Chrysler (512, -120), Grand Central across Park Av z -160..-80 (48 m),
// MetLife x 384..476 z -240..-160 (224 m), 57th St z -560, Central Park Tower x 136..174 z -552..-514, Central Park
// z < -569 (|x| < 234), One WTC (-139, 2760), Brooklyn Bridge z 2600 (towers x 740 / 1140, 96 m; deck 38 m).
// Look offsets: +dYaw turns the view to his left, -dYaw to his right; -dPitch looks up, +dPitch down.
const N = Math.PI,
    S = 0,
    E = Math.PI / 2,
    W = -Math.PI / 2;
// swing chain: RMB held for `on` s, released for `off` s (Space at each release = a trick), from t0 for n webs
const chain = (t0, n, on = 1.25, off = 0.5, trick = true) => {
    const hold = [],
        tap = [];
    for (let i = 0, t = t0; i < n; i++, t += on + off) {
        hold.push([t, t + on, "MouseRight"]);
        if (trick) tap.push([t + on - 0.06, "Space"]);
    }
    return { hold, tap };
};
const merge = (...o) => ({
    hold: o.flatMap((x) => x.hold || []),
    tap: o.flatMap((x) => x.tap || []),
});

export const SHOTS = [
    {
        id: "ts-swing",
        title: "Times Square · swing",
        tod: "night",
        dur: 5.5,
        yaw: N,
        setup: (R) => R.air(V(0, 36, -92), N, V(0, -1, -26)),
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
        setup: (R) => R.ground(V(-22, 0, -95), N),
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
        setup: (R) => {
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
        setup: (R) => R.perch(V(430, 223.8, -160.2), V(0, 0, 1), S),
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
        setup: (R) => R.air(V(-110, 62, -560), E, V(27, 0, 0)),
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
        setup: (R) => R.air(V(243, 240, 250), S, V(0, 2, 9)), // the web catches ~70-100 m up (the neighbours' roofs): start low enough to see it
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
        setup: (R) => R.air(V(250, 44, 110), S, V(0, 0, 27)),
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
        setup: (R) => R.air(V(640, 62, 2600), E, V(26, 2, 0)),
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
        setup: (R) => R.air(V(-608, 38, -260), S, V(0, 0, 26)),
        ...merge({ hold: [[0, 9, "KeyW"]] }, chain(0.05, 3, 1.3, 0.5)),
        look: [
            [0.6, 0, 0, 0],
            [2.0, -1.2, 0, 4],
            [3.6, -1.5, -0.05, 5],
            [5.0, -0.5, 0, 2],
        ],
    }, // round to his right: the river + sunset
    {
        id: "cps-swing",
        title: "Central Park South · swing",
        tod: "morning",
        dur: 5,
        yaw: E,
        setup: (R) => R.air(V(-225, 42, -574), E, V(26, 0, 0)),
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
        setup: (R) => R.ground(V(0, 0, -715), N),
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
        setup: (R) => R.air(V(-250, 36, -2260), N, V(0, 0, -25)),
        ...merge(
            {
                hold: [[0, 9, "KeyW"]],
                tap: [
                    [1.9, "KeyQ"],
                    [4.1, "KeyQ"],
                ],
            },
            chain(0.05, 2, 1.3, 1.0, false),
        ), // Q = quick web boost between the swings
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
        setup: (R) => R.ground(V(155, 0, -555.5), S), // on the sidewalk: at -562 the parked cars stopped him
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
        setup: (R) => R.ground(V(-250, 0, -100), N),
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
        setup: (R) => {
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
        setup: (R) => R.air(V(-100, 260, 2690), S, V(0, 0, 8)),
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
        setup: (R) => R.air(V(430, 42, 90), N, V(0, 0, -25)),
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
        setup: (R) => R.air(V(0, 28, 420), S, V(0, 0, 24)),
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
        setup: (R) => {
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
        setup: (R) => R.ground(V(-66, 50, -200), E),
        hold: [
            [0, 9, "KeyW"],
            [0.45, 0.85, "Space"],
            [1.5, 9, "MouseRight"],
        ], // charged leap at the roof edge (~1 s), web out over the square
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
        setup: (R) => R.ground(V(-30, 0, -205), W),
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
        setup: (R) => R.perch(V(-34.2, 45, -165), V(1, 0, 0), E),
        pre: 0.8,
        look: [
            [0, 2.5, 0.05, 0],
            [3.0, 1.2, 0, 1.5],
            [5.5, -0.4, -0.05, 6],
        ],
    },
];

// ------------------------------------------------------------------------------------------------ director
export function createReel(sys) {
    const ctx = sys.ctx,
        P = ctx.player,
        input = ctx.input;
    const st = {
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
    const telemetry = [];
    let origUpdate = null,
        origPoll = null,
        style = null,
        fade = null,
        keyOff = null,
        sysEntry = null,
        crimesWas = true;

    // ---------------------------------------------------------------- synthetic input
    const ctrl = () => st.held.has("ControlLeft");
    function down(code) {
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
    function up(code) {
        if (code in MOUSE)
            dispatchEvent(
                new MouseEvent("mouseup", {
                    button: MOUSE[code],
                    ctrlKey: ctrl(),
                }),
            );
        else dispatchEvent(new KeyboardEvent("keyup", { code, key: code }));
    }
    // held buttons go through input.press (the automation set): a real mouse move without pointer lock drops a DOM-held
    // button and a window blur (clicking into a screen recorder) clears DOM keys; taps stay DOM events (combat reads those)
    // (LMB holds stay DOM: combat's launcher reads the held button; Ctrl also as DOM for the combat dodge / sling clicks)
    const hdown = (code) => {
        if (code === "MouseLeft") return down(code);
        input.press(code);
        if (code === "ControlLeft") down(code);
    };
    const hup = (code) => {
        if (code === "MouseLeft") return up(code);
        input.release(code);
        if (code === "ControlLeft") up(code);
    };
    function releaseAll() {
        for (const c of st.held) hup(c);
        st.held.clear();
        ctx.flow?.clearInput?.();
    }

    // ---------------------------------------------------------------- setup helpers (R)
    const R = {
        air(p, yaw, vel) {
            P.teleport(p.clone(), yaw);
            if (vel) P.traversal.toAir(vel.clone());
            R.face(yaw);
        },
        ground(p, yaw) {
            const g = ctx.world.groundHeight(p.x, p.z, p.y + 3);
            P.teleport(V(p.x, g + H, p.z), yaw);
            R.face(yaw);
        },
        perch(p, n, yaw) {
            P.teleport(
                p
                    .clone()
                    .addScaledVector(n, 1.5)
                    .setY(p.y + 2),
                yaw,
            );
            P.traversal.perchAt(p.clone(), n.clone());
            P.web?.release?.(); // perchAt arrives through a zip: no leftover zip webs on screen
            P.cam.reset(P.position, yaw);
            R.face(yaw);
        },
        face(yaw) {
            P.cam.yaw = yaw;
            P.cam.pitch = st.shot?.pitch ?? 0.14;
        },
        fight(spec, dist) {
            const c = window.__cmb;
            if (!c) return;
            c.debug
                .fight(spec, dist)
                .then(() => c.debug.focus(3))
                .catch(() => {});
        },
    };

    // ---------------------------------------------------------------- look-around (the game camera, turned like a mouse would)
    function lookAt(shot, t) {
        // eased [dYaw, dPitch, dDist] between keyframes (a key at t = 0 is taken as the start)
        const K = shot.look;
        if (!K || !K.length) return [0, 0, 0];
        const at = (k, i) => k[i] || 0;
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
        // before the player updates: heading + look offset (+ pull-back) on the chase camera
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
        if (Math.abs(dy) > 0.02 || Math.abs(dp) > 0.02) P.cam.lastLook = 0; // like a player holding the view: no auto-recenter fighting it
    }

    // ---------------------------------------------------------------- timeline
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
        fade.style.opacity = "0";
    }
    function prepShot() {
        // under black: time of day, clean slate
        const shot = st.list[st.i];
        releaseAll();
        try {
            window.__cmb?.debug?.end?.();
        } catch {}
        try {
            sys.crimes?.cancel?.();
        } catch {}
        if (shot.tod) ctx.lighting.setTimeOfDay(shot.tod);
        // shot.pre (s): set up while still black (perches arrive through a zip: its webs clear before the fade-in)
        st.preDone = false;
        if (shot.pre) {
            st.shot = shot;
            st.t = 0;
            R.face(shot.yaw ?? P.cam.yaw);
            shot.setup(R);
            ctx.pipeline.resetHistory?.();
            st.preDone = true;
        } // steer() holds the t = 0 look meanwhile
    }
    function inputs(shot, t1) {
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
                window.__cmb?.slowmo?.(dur, scale, 0.3);
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
        T.combo = window.__cmb?.combo?.n ?? 0;
        T.y = +(P.position.y - H).toFixed(1);
    }
    function update(dt) {
        if (!st.active) return;
        const rdt = ctx.realDt ?? dt;
        if (st.phase === "play") {
            st.t += dt;
            inputs(st.shot, st.t);
            record();
            if (st.t >= st.shot.dur) {
                st.phase = "out";
                st.pt = 0;
                fade.style.opacity = "1";
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

    // ---------------------------------------------------------------- start / stop
    function start(opts = {}) {
        if (st.active) stop();
        st.list = opts.only
            ? opts.only.map((i) => SHOTS[i]).filter(Boolean)
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
        P.update = function (dt) {
            steer();
            return origUpdate.call(this, dt);
        };
        // movement stays on the shot's heading while the view looks around (move is camera-relative)
        origPoll = input.poll;
        input.poll = function (...a) {
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
        keyOff = ctx.flow?.onKey?.((e) => {
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
            window.__cmb?.debug?.end?.();
        } catch {}
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
        sys.applySettings?.(); // back to the player's time of day
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
    window.__reel = api;
    return api;
}
