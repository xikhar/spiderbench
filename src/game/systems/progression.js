// OWNER: systems engineer. XP / levels / skill points / skill tree -> ctx.params (traversal tuning multipliers).
//
// ctx.params (read by traversal, feature-detected: `const P = window.__ctx?.params; speed *= P?.swingSpeed ?? 1`):
//   swingSpeed        x  swing pump / max speed            swingReleaseBoost x  speed kept/added on release
//   webRange          x  web anchor search distance        zipSpeed          x  web-zip speed
//   pointLaunch       x  point-launch impulse              jump              x  jump / charged-jump impulse
//   wallRunSpeed      x  wall-run speed                    diveSpeed         x  dive terminal speed / accel
//   airTricks      bool  tricks award XP
// Traversal reads swingReleaseBoost natively; the rest are applied by skillfx.js as impulses/time-scales on traversal's
// public state unless traversal lists the key in traversal.consumesParams.
//   mouseSensitivity, invertY  -> ALREADY applied to input.state.look by the systems input layer (lookScaledByInput=true);
//                                 traversal/camera must NOT apply them again.
import { emit } from "./events.js";

export const SKILL_TREES = [
    {
        id: "webslinger",
        name: "Webslinger",
        desc: "Traversal mastery. Faster swings, higher jumps, harder launches.",
    },
    {
        id: "innovator",
        name: "Innovator",
        desc: "Peter's tech. Scanners, detectors and field tools.",
    },
];

// x,y are layout coordinates in 0..1 within the tree panel
export const SKILLS = [
    {
        id: "swing1",
        tree: "webslinger",
        x: 0.5,
        y: 0.04,
        name: "Swing Momentum",
        icon: "swing",
        desc: "Pump harder at the bottom of each arc.",
        eff: "Swing speed +8%",
        apply: (p) => {
            p.swingSpeed *= 1.08;
        },
    },
    {
        id: "reach",
        tree: "webslinger",
        x: 0.2,
        y: 0.3,
        req: ["swing1"],
        name: "Long Web",
        icon: "reach",
        desc: "Web lines reach anchors further away.",
        eff: "Web range +15%",
        apply: (p) => {
            p.webRange *= 1.15;
        },
    },
    {
        id: "swing2",
        tree: "webslinger",
        x: 0.5,
        y: 0.3,
        req: ["swing1"],
        name: "Slingshot Swing",
        icon: "swing",
        desc: "Release at the top of the arc to catapult forward.",
        eff: "Swing speed +8% · release boost +15%",
        apply: (p) => {
            p.swingSpeed *= 1.08;
            p.swingReleaseBoost *= 1.15;
        },
    },
    {
        id: "zip",
        tree: "webslinger",
        x: 0.8,
        y: 0.3,
        req: ["swing1"],
        name: "Quick Zip",
        icon: "zip",
        desc: "Web-zip and air web-dash with more force.",
        eff: "Web-zip & web-dash speed +20%",
        apply: (p) => {
            p.zipSpeed *= 1.2;
        },
    },
    {
        id: "jump",
        tree: "webslinger",
        x: 0.2,
        y: 0.56,
        req: ["reach"],
        name: "Charged Jump",
        icon: "jump",
        desc: "Leg day paid off. Higher charged jumps.",
        eff: "Jump +12%",
        apply: (p) => {
            p.jump *= 1.12;
        },
    },
    {
        id: "wallrun",
        tree: "webslinger",
        x: 0.5,
        y: 0.56,
        req: ["swing2"],
        name: "Wall Sprint",
        icon: "wall",
        desc: "Run up and along walls faster.",
        eff: "Wall-run speed +20%",
        apply: (p) => {
            p.wallRunSpeed *= 1.2;
        },
    },
    {
        id: "tricks",
        tree: "webslinger",
        x: 0.8,
        y: 0.56,
        req: ["zip"],
        name: "Air Tricks",
        icon: "trick",
        desc: "Style in the air earns XP. Chain tricks between swings.",
        eff: "Air tricks unlocked · +XP per trick",
        apply: (p) => {
            p.airTricks = true;
        },
    },
    {
        id: "dive",
        tree: "webslinger",
        x: 0.35,
        y: 0.82,
        req: ["jump", "wallrun"],
        name: "Dive Bomb",
        icon: "dive",
        desc: "Tuck and plummet with greater speed.",
        eff: "Dive acceleration & top speed +15%",
        apply: (p) => {
            p.diveSpeed *= 1.15;
        },
    },
    {
        id: "launch",
        tree: "webslinger",
        x: 0.7,
        y: 0.82,
        req: ["wallrun", "tricks"],
        name: "Point Launch+",
        icon: "land",
        desc: "Spring off perch points with a much bigger launch.",
        eff: "Point-launch force +18%",
        apply: (p) => {
            p.pointLaunch *= 1.18;
        },
    },

    {
        id: "scanner",
        tree: "innovator",
        x: 0.5,
        y: 0.04,
        name: "Police Scanner",
        icon: "scanner",
        desc: "Tap into NYPD radio. Crimes are reported more often.",
        eff: "Crime frequency +40%",
        apply: (p) => {
            p.crimeRate *= 1.4;
        },
    },
    {
        id: "detector",
        tree: "innovator",
        x: 0.25,
        y: 0.36,
        req: ["scanner"],
        name: "Backpack Detector",
        icon: "backpack",
        desc: "Pings nearby backpacks even in districts you have not unlocked.",
        eff: "Backpacks within 200 m show on the minimap",
        apply: (p) => {
            p.backpackDetector = 200;
        },
    },
    {
        id: "cred",
        tree: "innovator",
        x: 0.75,
        y: 0.36,
        req: ["scanner"],
        name: "Street Cred",
        icon: "xp",
        desc: "The city notices. Everything is worth a little more.",
        eff: "XP +10%",
        apply: (p) => {
            p.xpMul *= 1.1;
        },
    },
    {
        id: "photog",
        tree: "innovator",
        x: 0.25,
        y: 0.7,
        req: ["detector"],
        name: "Photojournalist",
        icon: "camera",
        desc: "The Bugle pays better for sharper shots.",
        eff: "Photo XP +50% · landmark range +40%",
        apply: (p) => {
            p.photoXp *= 1.5;
            p.landmarkRange *= 1.4;
        },
    },
    {
        id: "gps",
        tree: "innovator",
        x: 0.75,
        y: 0.7,
        req: ["cred"],
        name: "Smart GPS",
        icon: "gps",
        desc: "Suit HUD plots the fastest rooftop route.",
        eff: "Waypoint route + distance readout",
        apply: (p) => {
            p.gpsDistance = true;
        },
    },
];

export function defaultParams() {
    return {
        version: 1,
        swingSpeed: 1,
        swingReleaseBoost: 1,
        webRange: 1,
        zipSpeed: 1,
        pointLaunch: 1,
        jump: 1,
        wallRunSpeed: 1,
        diveSpeed: 1,
        airControl: 1,
        landingRecovery: 1,
        airTricks: false,
        landingRoll: false,
        crimeRate: 1,
        backpackDetector: 0,
        xpMul: 1,
        photoXp: 1,
        landmarkRange: 1,
        gpsDistance: false,
        mouseSensitivity: 1,
        invertY: false,
        lookScaledByInput: true,
    };
}

export const xpForLevel = (lvl) => 500 + 200 * (lvl - 1); // XP needed to go from lvl -> lvl+1
export const MAX_LEVEL = 50;

export function createProgression(ctx, save) {
    const params = (ctx.params = Object.assign(
        ctx.params || {},
        defaultParams(),
    ));
    function recompute() {
        const base = defaultParams();
        const st = save.state;
        base.mouseSensitivity = st.settings.mouseSensitivity;
        base.invertY = !!st.settings.invertY;
        for (const id of st.skills)
            SKILLS.find((s) => s.id === id)?.apply(base);
        Object.assign(params, base);
        emit("params:changed", params);
    }
    recompute();

    const api = {
        params,
        get level() {
            return save.state.level;
        },
        get xp() {
            return save.state.xp;
        },
        get skillPoints() {
            return save.state.skillPoints;
        },
        get need() {
            return xpForLevel(save.state.level);
        },
        has: (id) => save.state.skills.includes(id),
        canUnlock(id) {
            const s = SKILLS.find((k) => k.id === id);
            if (!s || api.has(id)) return false;
            return (s.req || []).every((r) => api.has(r));
        },
        unlock(id) {
            if (!api.canUnlock(id) || save.state.skillPoints < 1) return false;
            save.state.skillPoints--;
            save.state.skills.push(id);
            save.markDirty();
            recompute();
            emit("skill:unlocked", { id });
            return true;
        },
        addXp(amount, reason = "") {
            const st = save.state;
            amount = Math.round(amount * params.xpMul);
            if (amount <= 0) return;
            let leveled = false;
            const from = st.level;
            st.xp += amount;
            while (st.level < MAX_LEVEL && st.xp >= xpForLevel(st.level)) {
                st.xp -= xpForLevel(st.level);
                st.level++;
                st.skillPoints++;
                leveled = true;
            }
            // one event per gain, even across several levels (banner + HUD stay in agreement)
            if (leveled)
                emit("level:up", {
                    level: st.level,
                    from,
                    gained: st.level - from,
                    skillPoints: st.skillPoints,
                });
            if (st.level >= MAX_LEVEL)
                st.xp = Math.min(st.xp, xpForLevel(st.level));
            save.markDirty();
            emit("xp:gain", { amount, reason, total: st.xp, leveled });
        },
        recompute,
    };
    return api;
}
