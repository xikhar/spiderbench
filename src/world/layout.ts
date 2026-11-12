// @ts-nocheck
/**
 * Defines the city layout, districts, roads, and spatial queries.
 *
 * @module world-layout
 * @version 1.0.0
 * @file src/world/layout.ts
 * @since 0.0.1
 * @description Contains core map data and utility functions for streets, avenues, shorelines, districts, and location classification.
 */
import { JUNCTION_ISLES } from "./jisles.ts";

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function hash2(x, z) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const ZFIX = !(
    typeof location !== "undefined" && /[?&]nozfix\b/.test(location.search)
);
export const G = {
    AV_ROAD: 22,
    AV_WALK: 5,
    ST_SP: 80,
    ST_ROAD: 10,
    ST_WALK: 4,
    PROM: 16,
    X_MIN: -790,
    X_MAX: 870,
    Z_MIN: -3480,
    Z_MAX: 3330,
    CORE: { x0: -640, x1: 640, z0: -820, z1: 820 },
    PARK: { x0: -234, x1: 234, z0: -2151, z1: -569 },
    DRIVE_X0: 1e9,
    DRIVE_X1: 1e9,
    SEAWALL_X: 1e9,
    RIVER_X1: 1e9,
    WATER_Y: -1.6,
    CURB_H: 0.15,
};
G.AV_HALF = G.AV_ROAD / 2;
G.ST_HALF = G.ST_ROAD / 2;
G.AV_LANE = 3.6;
G.AV_SP = 200;

export const avenues = [-610, -430, -250, 0, 250, 430, 610];
export const AV_NAMES = [
    "12TH AV",
    "10TH AV",
    "8TH AV",
    "6TH AV",
    "5TH AV",
    "PARK AV",
    "2ND AV",
];
export const streets = [];
for (let z = -3440; z <= 3280; z += G.ST_SP) streets.push(z);
const NA = avenues.length,
    NS = streets.length,
    Z0 = streets[0];

export const WIDE_ST_HALF = 9,
    NARROW_ST_HALF = 3.75;
export const WIDE_ROADS = [-480, -1200, -1680, -2480, -2800];
export const NARROW_STREETS = [
    -3280, -3040, -2720, -2320, -1920, -1760, -1440, 80, 1600, 1760,
];
export const ST_HW = streets.map((z) =>
    WIDE_ROADS.includes(z)
        ? WIDE_ST_HALF
        : NARROW_STREETS.includes(z)
          ? NARROW_ST_HALF
          : G.ST_HALF,
);
export const stHalf = (k) => (k >= 0 && k < NS ? ST_HW[k] : G.ST_HALF);
export const stWide = (k) => stHalf(k) > G.ST_HALF + 0.01,
    stNarrow = (k) => stHalf(k) < G.ST_HALF - 0.01;

export const stHalfAt = (z) =>
    stHalf(Math.max(0, Math.min(NS - 1, Math.round((z - Z0) / G.ST_SP))));

const WEST_CP = [
    [-3480, -100],
    [-3380, -300],
    [-3200, -440],
    [-2800, -545],
    [-2200, -620],
    [-1400, -665],
    [-600, -700],
    [0, -718],
    [600, -725],
    [1200, -708],
    [1800, -665],
    [2300, -595],
    [2700, -490],
    [3000, -360],
    [3200, -215],
    [3330, -60],
];
const EAST_CP = [
    [-3480, -100],
    [-3380, 110],
    [-3200, 320],
    [-2800, 555],
    [-2200, 660],
    [-1400, 690],
    [-600, 700],
    [0, 708],
    [600, 722],
    [1200, 772],
    [1650, 812],
    [2050, 775],
    [2450, 620],
    [2780, 430],
    [3050, 205],
    [3250, 25],
    [3330, -60],
];
const lerpCP = (cp, z) => {
    if (z <= cp[0][0]) return cp[0][1];
    for (let i = 1; i < cp.length; i++)
        if (z <= cp[i][0]) {
            const [za, xa] = cp[i - 1],
                [zb, xb] = cp[i];
            return xa + ((xb - xa) * (z - za)) / (zb - za);
        }
    return cp[cp.length - 1][1];
};

export const SHORE_Z = [];
{
    const s = new Set([G.Z_MIN, G.Z_MAX]);
    streets.forEach((z, k) => {
        for (const e of [z - ST_HW[k], z + ST_HW[k]])
            if (e > G.Z_MIN && e < G.Z_MAX) s.add(e);
    });
    SHORE_Z.push(...[...s].sort((a, b) => a - b));
}

export const SHORE_PUSH = 30;
export const shorePushAt = (z) =>
    SHORE_PUSH *
    Math.max(0, Math.min(1, (z - G.Z_MIN) / 450, (G.Z_MAX - z) / 450));
const SHORE_W0 = SHORE_Z.map((z) => lerpCP(WEST_CP, z));
const SHORE_E0 = SHORE_Z.map((z) => lerpCP(EAST_CP, z));
export const SHORE_W = SHORE_Z.map((z, i) => SHORE_W0[i] - shorePushAt(z));
export const SHORE_E = SHORE_Z.map((z, i) => SHORE_E0[i] + shorePushAt(z));
function shoreIdx(z) {
    let lo = 0,
        hi = SHORE_Z.length - 1;
    while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (SHORE_Z[m] <= z) lo = m;
        else hi = m;
    }
    return lo;
}
export function shoreX(z) {
    if (z < G.Z_MIN || z > G.Z_MAX) return [1, 0];
    const i = shoreIdx(z),
        za = SHORE_Z[i],
        zb = SHORE_Z[i + 1],
        t = (z - za) / (zb - za);
    return [
        SHORE_W[i] + (SHORE_W[i + 1] - SHORE_W[i]) * t,
        SHORE_E[i] + (SHORE_E[i + 1] - SHORE_E[i]) * t,
    ];
}
export function onLand(x, z) {
    if (z < G.Z_MIN || z > G.Z_MAX) return false;
    const [w, e] = shoreX(z);
    return x >= w && x <= e;
}

export function landRange(za, zb) {
    let w,
        e;
    const [w0, e0] = shoreX(Math.max(G.Z_MIN, za)),
        [w1, e1] = shoreX(Math.min(G.Z_MAX, zb));
    w = Math.max(w0, w1);
    e = Math.min(e0, e1);
    for (let i = 0; i < SHORE_Z.length; i++)
        if (SHORE_Z[i] > za && SHORE_Z[i] < zb) {
            w = Math.max(w, SHORE_W[i]);
            e = Math.min(e, SHORE_E[i]);
        }
    if (za < G.Z_MIN || zb > G.Z_MAX) return [1, 0];
    return [w, e];
}

function landRange0(za, zb) {
    if (za < G.Z_MIN || zb > G.Z_MAX) return [1, 0];
    const at = (A, z) => {
        const i = shoreIdx(z),
            t = (z - SHORE_Z[i]) / (SHORE_Z[i + 1] - SHORE_Z[i]);
        return A[i] + (A[i + 1] - A[i]) * t;
    };
    let w = Math.max(
        at(SHORE_W0, Math.max(G.Z_MIN, za)),
        at(SHORE_W0, Math.min(G.Z_MAX - 1e-6, zb)),
    );
    let e = Math.min(
        at(SHORE_E0, Math.max(G.Z_MIN, za)),
        at(SHORE_E0, Math.min(G.Z_MAX - 1e-6, zb)),
    );
    for (let i = 0; i < SHORE_Z.length; i++)
        if (SHORE_Z[i] > za && SHORE_Z[i] < zb) {
            w = Math.max(w, SHORE_W0[i]);
            e = Math.min(e, SHORE_E0[i]);
        }
    return [w, e];
}

export const LAND_POLY = [
    ...SHORE_Z.map((z, i) => [SHORE_W[i], z]),
    ...SHORE_Z.map((z, i) => [SHORE_E[i], z])
        .reverse()
        .slice(1, -1),
];

export const BRIDGES = [
    {
        name: "brooklyn",
        z: 2600,
        style: "stone",
        deckY: 38,
        towerH: 94,
        width: 34,
        anchor: 40,
        ramp: 520,
        sideFrac: 0.2,
        mGrade: 0.083,
        lanes: 3,
        inner: 4.2,
        color: 0x9a8a6e,
        railColor: 0x27352c,
    },
    {
        name: "manhattan",
        z: 2280,
        style: "steel",
        tower: "arch",
        deckY: 42,
        towerH: 112,
        width: 38,
        anchor: 36,
        ramp: 560,
        color: 0x4d5e70,
        sideFrac: 0.2,
        mGrade: 0.066,
        lanes: 3,
        inner: 0.6,
        pairs: true,
        plazaArch: true,
    },
    {
        name: "williamsburg",
        z: 1480,
        style: "steel",
        tower: "lattice",
        deckY: 40,
        towerH: 104,
        width: 40,
        anchor: 34,
        ramp: 520,
        color: 0x6b4840,
        sideFrac: 0.19,
        mGrade: 0.076,
        lanes: 2,
        inner: 4.6,
        pairs: true,
        tracks: true,
    },
    {
        name: "queensboro",
        z: -680,
        style: "cantilever",
        deckY: 40,
        width: 30,
        anchor: 30,
        ramp: 520,
        color: 0x4a504c,
        mGrade: 0.092,
        lanes: 3,
        inner: 0.6,
    },
    {
        name: "triborough",
        z: -3000,
        style: "steel",
        tower: "deco",
        deckY: 40,
        towerH: 98,
        width: 36,
        anchor: 30,
        ramp: 480,
        color: 0x56644d,
        sideFrac: 0.2,
        mGrade: 0.094,
        lanes: 3,
        inner: 0.6,
    },
];

export const CLOSED = [{ z: 560, x0: -250, x1: 0 }];

export const CLOSED_AV = [
    { x: 430, z0: -160, z1: -80 },
    { x: 0, z0: -80, z1: 0 },
];
export function closedAt(z, x) {
    return CLOSED.some((c) => Math.abs(c.z - z) < 1 && x > c.x0 && x < c.x1);
}

export function inPark(x, z, pad = 0) {
    const P = G.PARK;
    return x > P.x0 - pad && x < P.x1 + pad && z > P.z0 - pad && z < P.z1 + pad;
}
export function inCore(x, z) {
    const C = G.CORE;
    return x > C.x0 && x < C.x1 && z > C.z0 && z < C.z1;
}

const PARK_CELLS = {
    x0: G.PARK.x0 - G.AV_WALK,
    x1: G.PARK.x1 + G.AV_WALK,
    z0: G.PARK.z0 - G.ST_WALK,
    z1: G.PARK.z1 + G.ST_WALK,
};
const inParkCells = (x0, z0, x1, z1) =>
    x0 >= PARK_CELLS.x0 - 0.01 &&
    x1 <= PARK_CELLS.x1 + 0.01 &&
    z0 >= PARK_CELLS.z0 - 0.01 &&
    z1 <= PARK_CELLS.z1 + 0.01;

const PL = G.PARK.z1 - G.PARK.z0;
const _pz = (f) => G.PARK.z1 - f * PL;

export const PARK_WATER = [
    {
        name: "pond",
        cx: 150,
        cz: -620,
        rx: 58,
        rz: 27,
        a: 0.35,
        h: [0.16, 0.12, 0.0, 0.06],
        q: 0.05,
        n: 120,
        y: G.CURB_H - 0.55,
    },
    {
        name: "lake",
        cx: -62,
        cz: -1030,
        rx: 116,
        rz: 56,
        a: -0.22,
        h: [0.1, 0.24, 0.06, 0.13],
        q: 0.06,
        n: 200,
        y: G.CURB_H - 0.55,
    },
    {
        name: "turtle",
        cx: 40,
        cz: -1150,
        rx: 50,
        rz: 15,
        a: 0.04,
        h: [0.06, 0.1, 0.0, 0.05],
        q: 0.04,
        n: 90,
        y: G.CURB_H - 0.5,
    },
    {
        name: "reservoir",
        cx: 0,
        cz: -1515,
        rx: 170,
        rz: 120,
        a: 0.05,
        h: [0.03, 0.04, 0.09, 0.02],
        q: 0.012,
        n: 144,
        y: G.CURB_H - 0.7,
    },
    {
        name: "meer",
        cx: 140,
        cz: -2080,
        rx: 74,
        rz: 36,
        a: -0.15,
        h: [0.12, 0.15, 0.0, 0.07],
        q: 0.05,
        n: 120,
        y: G.CURB_H - 0.55,
    },
].map((w) => {
    const kf = (t) =>
        1 +
        0.08 * Math.sin(t * 3 + w.cx) +
        0.05 * Math.sin(t * 5 + w.cz * 0.1) +
        w.h[0] * Math.sin(t * 2 + 0.7) +
        w.h[1] * Math.sin(t * 3 + 2.1) +
        w.h[2] * Math.cos(t * 4) +
        w.h[3] * Math.sin(t * 5 + 4.2) +
        w.q *
            (Math.sin(t * 7 + w.cx * 0.05) +
                0.7 * Math.sin(t * 11 + w.cz * 0.03) +
                0.45 * Math.sin(t * 17 + 1.9));
    let mk = 0;
    for (let i = 0; i < 360; i++)
        mk = Math.max(mk, kf((i / 360) * Math.PI * 2));
    const sc = Math.min(1, 1.1 / mk),
        rx = w.rx * sc,
        rz = w.rz * sc;
    const pts = [];
    for (let i = 0; i < w.n; i++) {
        const t = (i / w.n) * Math.PI * 2,
            k = kf(t);
        const u = Math.cos(t) * rx * k,
            v = Math.sin(t) * rz * k,
            c = Math.cos(w.a),
            s = Math.sin(w.a);
        pts.push([w.cx + u * c + v * s, w.cz - u * s + v * c]);
    }
    return { ...w, rx, rz, pts, R: Math.max(rx, rz) * 1.15 };
});
export function pointInPoly(pts, x, z) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, zi] = pts[i],
            [xj, zj] = pts[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)
            inside = !inside;
    }
    return inside;
}
export function parkWaterAt(x, z) {
    for (const w of PARK_WATER)
        if (
            Math.abs(x - w.cx) < w.R &&
            Math.abs(z - w.cz) < w.R &&
            pointInPoly(w.pts, x, z)
        )
            return w;
    return null;
}

const XL = [];
for (const a of avenues) XL.push(a - G.AV_HALF, a + G.AV_HALF);
export const NCOL = 2 * NA + 1,
    NROW = 2 * NS + 1;
export function colOf(x) {
    let c = 0;
    while (c < XL.length && x >= XL[c]) c++;
    return c;
}
export function rowOf(z) {
    const k = Math.max(0, Math.min(NS - 1, Math.round((z - Z0) / G.ST_SP))),
        d = z - streets[k],
        h = ST_HW[k];
    if (d >= -h && d < h) return 2 * k + 1;
    if (d < 0) return 2 * k;
    return k + 1 >= NS ? 2 * NS : 2 * k + 2;
}
export function colRange(c) {
    return [c === 0 ? -1e5 : XL[c - 1], c === XL.length ? 1e5 : XL[c]];
}
export function rowRange(r) {
    if (r === 0) return [-1e5, Z0 - ST_HW[0]];
    if (r & 1) {
        const k = (r - 1) / 2,
            z = streets[k];
        return [z - ST_HW[k], z + ST_HW[k]];
    }
    const k = r / 2 - 1;
    return [
        streets[k] + ST_HW[k],
        k + 1 < NS ? streets[k + 1] - ST_HW[k + 1] : 1e5,
    ];
}

export const avAct = new Uint8Array(NA * NS),
    isAct = new Uint8Array(NA * NS);
export const stSeg = new Array(NS * NCOL).fill(null);
export const blockCell = new Array(NS * NCOL).fill(null);

export const VREG = { x0: -610, x1: 0, z0: 640, z1: 1360 };

export const FREG = { z0: 2400 };
const inVReg = (x0, z0, x1, z1) =>
    x0 >= VREG.x0 - 1e-6 &&
    x1 <= VREG.x1 + 1e-6 &&
    z0 >= VREG.z0 - 1e-6 &&
    z1 <= VREG.z1 + 1e-6;
{
    const P = G.PROM;
    const closedAv = (i, k) =>
        CLOSED_AV.some(
            (c) =>
                Math.abs(c.x - avenues[i]) < 1 &&
                streets[k] >= c.z0 - 1 &&
                streets[k + 1] <= c.z1 + 1,
        );

    for (let i = 0; i < NA; i++)
        for (let k = 0; k + 1 < NS; k++) {
            const x = avenues[i],
                za = streets[k] - ST_HW[k],
                zb = streets[k + 1] + ST_HW[k + 1];
            const [w, e] = landRange0(za, zb);
            if (
                x - G.AV_HALF - G.AV_WALK < w + P ||
                x + G.AV_HALF + G.AV_WALK > e - P
            )
                continue;
            if (inPark(x, (streets[k] + streets[k + 1]) / 2)) continue;
            if (closedAv(i, k)) continue;
            if (
                x > VREG.x0 &&
                x < VREG.x1 &&
                inVReg(x, streets[k], x, streets[k + 1])
            )
                continue;
            if (streets[k] >= FREG.z0 - 1e-6) continue;
            avAct[i * NS + k] = 1;
        }

    for (let k = 0; k + 1 < NS; k++)
        for (let c = 0; c < NCOL; c += 2) {
            const z0 = streets[k] + ST_HW[k],
                z1 = streets[k + 1] - ST_HW[k + 1];
            let [x0, x1] = colRange(c);
            const [w, e] = landRange0(z0, z1);
            x0 = Math.max(x0, w + P);
            x1 = Math.min(x1, e - P);
            if (x1 - x0 < 26) continue;
            if (inParkCells(x0, z0, x1, z1)) continue;
            if (inVReg(x0, z0, x1, z1)) continue;
            if (z0 >= FREG.z0) continue;
            blockCell[k * NCOL + c] = { x0, x1, z0, z1, k, c };
        }

    for (let k = 0; k < NS; k++)
        for (let c = 0; c < NCOL; c += 2) {
            const z = streets[k];
            let [x0, x1] = colRange(c);
            const hk = ST_HW[k],
                [w, e] = landRange0(z - hk - G.ST_WALK, z + hk + G.ST_WALK);
            const cx0 = x0,
                cx1 = x1;
            x0 = Math.max(x0, w + P);
            x1 = Math.min(x1, e - P);
            if (x1 - x0 < 18) continue;
            const bN = k > 0 ? blockCell[(k - 1) * NCOL + c] : null,
                bS = blockCell[k * NCOL + c];
            if (!bN && !bS) continue;
            if (inParkCells(x0, z - hk, x1, z + hk)) continue;
            if (closedAt(z, (x0 + x1) / 2)) continue;
            if (z > VREG.z0 && z < VREG.z1 && inVReg(x0, z, x1, z)) continue;
            if (z > FREG.z0 + 1e-6) continue;

            const avOn = (i) =>
                i >= 0 &&
                i < NA &&
                ((k > 0 && avAct[i * NS + k - 1]) || avAct[i * NS + k]);
            const westOK = Math.abs(x0 - cx0) < 1e-6 && avOn(c / 2 - 1),
                eastOK = Math.abs(x1 - cx1) < 1e-6 && avOn(c / 2);
            if (!westOK && !eastOK) continue;

            if (!westOK) {
                const bx = Math.min(
                    bN ? bN.x0 : Infinity,
                    bS ? bS.x0 : Infinity,
                );
                x0 = Math.max(x0, bx);
            }
            if (!eastOK) {
                const bx = Math.max(
                    bN ? bN.x1 : -Infinity,
                    bS ? bS.x1 : -Infinity,
                );
                x1 = Math.min(x1, bx);
            }
            if (x1 - x0 < 18) continue;
            stSeg[k * NCOL + c] = [x0, x1];
        }
    for (let i = 0; i < NA; i++)
        for (let k = 0; k < NS; k++) {
            const c = 2 * i + 1;
            const s = (cc) => {
                const g = cc >= 0 && cc < NCOL ? stSeg[k * NCOL + cc] : null;
                return (
                    g &&
                    (cc === c - 1
                        ? Math.abs(g[1] - (avenues[i] - G.AV_HALF)) < 1e-6
                        : Math.abs(g[0] - (avenues[i] + G.AV_HALF)) < 1e-6)
                );
            };
            if (
                (k > 0 && avAct[i * NS + k - 1]) ||
                avAct[i * NS + k] ||
                s(c - 1) ||
                s(c + 1)
            ) {
                const [w, e] = landRange0(
                    streets[k] - ST_HW[k],
                    streets[k] + ST_HW[k],
                );
                if (
                    avenues[i] - G.AV_HALF > w + 4 &&
                    avenues[i] + G.AV_HALF < e - 4 &&
                    !inPark(avenues[i], streets[k])
                )
                    isAct[i * NS + k] = 1;
            }
        }
}
export const avActive = (i, k) =>
    i >= 0 && i < NA && k >= 0 && k + 1 < NS && avAct[i * NS + k] === 1;
export const isActive = (i, k) =>
    i >= 0 && i < NA && k >= 0 && k < NS && isAct[i * NS + k] === 1;
export const stRange = (k, c) =>
    k >= 0 && k < NS && c >= 0 && c < NCOL ? stSeg[k * NCOL + c] : null;

export const stActiveAv = (k, i) => stRange(k, 2 * (i + 1));

export const DIAG_ROADS = [
    {
        name: "BROADWAY",
        kind: "broadway",
        w: 16,
        walk: 5,
        pts: [
            [-520, -2160],
            [-520, -1360],
            [-430, -880],
            [-250, -560],
        ],
    },

    {
        name: "BROADWAY",
        kind: "broadway",
        w: 16,
        walk: 5,
        pts: [
            [-250, -560],
            [0, -320],
        ],
    },

    {
        name: "BROADWAY",
        kind: "broadway",
        w: 16,
        walk: 5,
        pts: [
            [0, 320],
            [250, 720],
            [430, 1040],
        ],
    },

    {
        name: "BROADWAY",
        kind: "broadway",
        w: 16,
        walk: 5,
        pts: [
            [430, 1040],
            [250, 1360],
            [0, 2160],
        ],
    },
];
export const DIAG_SEGS = [];
for (const R of DIAG_ROADS)
    for (let i = 0; i + 1 < R.pts.length; i++) {
        const [ax, az] = R.pts[i],
            [bx, bz] = R.pts[i + 1],
            len = Math.hypot(bx - ax, bz - az),
            ux = (bx - ax) / len,
            uz = (bz - az) / len;
        DIAG_SEGS.push({
            id: DIAG_SEGS.length,
            name: R.name,
            kind: R.kind,
            ax,
            az,
            bx,
            bz,
            len,
            ux,
            uz,
            nx: -uz,
            nz: ux,
            hw: R.w / 2,
            walk: R.walk,
        });
    }
export const diagD = (s, x, z) => (x - s.ax) * s.nx + (z - s.az) * s.nz;
export const diagS = (s, x, z) => (x - s.ax) * s.ux + (z - s.az) * s.uz;

function diagHitsRect(s, m, x0, z0, x1, z1) {
    const cx = (s.ax + s.bx) / 2,
        cz = (s.az + s.bz) / 2,
        hl = s.len / 2;
    const rx = (x1 - x0) / 2,
        rz = (z1 - z0) / 2,
        dx = (x0 + x1) / 2 - cx,
        dz = (z0 + z1) / 2 - cz;
    if (Math.abs(dx) > rx + Math.abs(s.ux) * hl + Math.abs(s.nx) * m)
        return false;
    if (Math.abs(dz) > rz + Math.abs(s.uz) * hl + Math.abs(s.nz) * m)
        return false;
    if (
        Math.abs(dx * s.ux + dz * s.uz) >
        hl + rx * Math.abs(s.ux) + rz * Math.abs(s.uz)
    )
        return false;
    if (
        Math.abs(dx * s.nx + dz * s.nz) >
        m + rx * Math.abs(s.nx) + rz * Math.abs(s.nz)
    )
        return false;
    return true;
}

export function clipPoly(P, f) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
        const A = P[i],
            B = P[(i + 1) % P.length],
            fa = f(A[0], A[1]),
            fb = f(B[0], B[1]);
        if (fa >= 0) out.push(A);
        if (fa >= 0 !== fb >= 0) {
            const t = fa / (fa - fb);
            out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
        }
    }
    return out;
}
export function polyArea(P) {
    let a = 0;
    for (let i = 0; i < P.length; i++) {
        const p = P[i],
            q = P[(i + 1) % P.length];
        a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a) / 2;
}
for (let k = 0; k + 1 < NS; k++)
    for (let c = 0; c < NCOL; c += 2) {
        const bc = blockCell[k * NCOL + c];
        if (!bc) continue;
        bc.diag = DIAG_SEGS.filter((s) =>
            diagHitsRect(s, s.hw + s.walk, bc.x0, bc.z0, bc.x1, bc.z1),
        );
    }

export function diagBand(diag, x, z) {
    let best = 0,
        seg = null;
    for (const s of diag) {
        const d = Math.abs(diagD(s, x, z));
        if (d <= s.hw) return { band: 2, seg: s };
        if (d <= s.hw + s.walk && best < 1) {
            best = 1;
            seg = s;
        }
    }
    return { band: best, seg };
}

export function blockPieces(b) {
    let cells = [
        [
            [b.x0, b.z0],
            [b.x1, b.z0],
            [b.x1, b.z1],
            [b.x0, b.z1],
        ],
    ];
    for (const s of b.diag || [])
        for (const sg of [1, -1]) {
            const f = (x, z) => sg * (diagD(s, x, z) - sg * s.hw);
            const nx = [];
            for (const P of cells)
                for (const g of [f, (x, z) => -f(x, z)]) {
                    const Q = clipPoly(P, g);
                    if (Q.length >= 3 && polyArea(Q) > 1e-3) nx.push(Q);
                }
            cells = nx;
        }
    const road = [],
        walk = [];
    for (const P of cells) {
        let mx = 0,
            mz = 0;
        for (const [x, z] of P) {
            mx += x;
            mz += z;
        }
        mx /= P.length;
        mz /= P.length;
        if (diagBand(b.diag || [], mx, mz).band === 2) {
            road.push(P);
            continue;
        }
        if (!nearRoundabout(b)) {
            walk.push(P);
            continue;
        }
        const c = roundCarve(P);
        road.push(...c.inside);
        walk.push(...c.outside);
    }
    return { road, walk };
}

export function diagRectClear(diag, x0, z0, x1, z1, pad = 0) {
    for (const s of diag) {
        const m = s.hw + s.walk + pad;
        const ds = [
            diagD(s, x0, z0),
            diagD(s, x1, z0),
            diagD(s, x0, z1),
            diagD(s, x1, z1),
        ];
        if (!(Math.min(...ds) >= m || Math.max(...ds) <= -m)) return false;
    }
    return true;
}

export function diagTrimRect(diag, x0, z0, x1, z1, minW = 8, pad = 0.3) {
    if (diagRectClear(diag, x0, z0, x1, z1, pad))
        return { x0, z0, x1, z1, trimmed: false };
    const N = 16,
        xs = [],
        zs = [];
    for (let i = 0; i <= N; i++) {
        xs.push(x0 + ((x1 - x0) * i) / N);
        zs.push(z0 + ((z1 - z0) * i) / N);
    }
    let best = null,
        bestA = 0;
    for (let a = 0; a < N; a++)
        for (let bI = N; bI > a; bI--) {
            const w = xs[bI] - xs[a];
            if (w < minW) break;
            for (let c = 0; c < N; c++)
                for (let d = N; d > c; d--) {
                    const h = zs[d] - zs[c];
                    if (h < minW) break;
                    if (w * h <= bestA) break;
                    if (diagRectClear(diag, xs[a], zs[c], xs[bI], zs[d], pad)) {
                        bestA = w * h;
                        best = {
                            x0: xs[a],
                            z0: zs[c],
                            x1: xs[bI],
                            z1: zs[d],
                            trimmed: true,
                        };
                        break;
                    }
                }
        }
    return best;
}

export function diagLotPieces(b, pad = 0) {
    let cells = [
        [
            [b.px0, b.pz0],
            [b.px1, b.pz0],
            [b.px1, b.pz1],
            [b.px0, b.pz1],
        ],
    ];
    for (const s of b.diag || []) {
        const m = s.hw + s.walk + pad,
            nx = [];
        for (const P of cells)
            for (const sg of [1, -1]) {
                const Q = clipPoly(P, (x, z) => sg * diagD(s, x, z) - m);
                if (Q.length >= 3 && polyArea(Q) > 1) nx.push(Q);
            }
        cells = nx;
    }
    return cells;
}

export function diagRoadPolys(walk = false) {
    return DIAG_SEGS.map((s) => {
        const m = s.hw + (walk ? s.walk : 0),
            e = s.hw;
        const p = (u, v) => [
            s.ax + s.ux * u + s.nx * v,
            s.az + s.uz * u + s.nz * v,
        ];
        return {
            pts: [p(-e, -m), p(s.len + e, -m), p(s.len + e, m), p(-e, m)],
            seg: s,
        };
    });
}

const _bleeckerX = (z) => -250 - (150 * (z - 640)) / 720;
export const VMAP = {
    name: "village",
    ...VREG,
    idBase: 100000,
    seamX: [
        { x: VREG.x0, hw: G.AV_HALF, walk: G.AV_WALK },
        { x: VREG.x1, hw: G.AV_HALF, walk: G.AV_WALK },
    ],

    xst: [
        [720, 10, 4, "W 12TH ST"],
        [790, 6, 3.5, "JANE ST", null, null, "W"],
        [880, 12, 4.5, "W 4TH ST"],
        [955, 7, 3.5, "PERRY ST", null, null, "E"],
        [1040, 13, 5, "CHRISTOPHER ST"],
        [1110, 6, 3.5, "GROVE ST", null, null, "W"],
        [1200, 10, 4, "BARROW ST"],
        [1290, 7, 3.5, "MORTON ST", null, null, "E"],
    ],

    lines: [
        {
            name: "WASHINGTON ST",
            w: 7,
            walk: 3.5,
            oneway: "N",
            pts: [
                [640, -520],
                [1360, -545],
            ],
        },
        {
            name: "HUDSON ST",
            w: 12,
            walk: 4.5,
            pts: [
                [640, -430],
                [880, -422],
                [1040, -440],
                [1360, -472],
            ],
        },
        {
            name: "BLEECKER ST",
            w: 10,
            walk: 4,
            pts: [
                [640, -250],
                [1360, _bleeckerX(1360)],
            ],
        },
        {
            name: "7TH AV S",
            w: 14,
            walk: 5,
            pts: [
                [640, -160],
                [1040, _bleeckerX(1040)],
            ],
        },
        {
            name: "MACDOUGAL ST",
            w: 7,
            walk: 3.5,
            oneway: "S",
            pts: [
                [1040, -240],
                [1200, -262],
                [1360, -300],
            ],
        },
        {
            name: "GREENWICH AV",
            w: 12,
            walk: 4.5,
            pts: [
                [640, -60],
                [1360, -200],
            ],
        },
    ],
    left: {
        name: "12TH AV",
        w: 2 * G.AV_HALF,
        walk: G.AV_WALK,
        seam: true,
        pts: [
            [VREG.z0, VREG.x0],
            [VREG.z1, VREG.x0],
        ],
    },
    right: {
        name: "6TH AV",
        w: 2 * G.AV_HALF,
        walk: G.AV_WALK,
        seam: true,
        pts: [
            [VREG.z0, VREG.x1],
            [VREG.z1, VREG.x1],
        ],
    },
    top: { hw: G.ST_HALF, walk: G.ST_WALK },
    bot: { hw: G.ST_HALF, walk: G.ST_WALK },
};

function _lxp(p, z) {
    for (let i = 1; i < p.length; i++)
        if (z <= p[i][0] + 1e-6)
            return (
                p[i - 1][1] +
                ((p[i][1] - p[i - 1][1]) * (z - p[i - 1][0])) /
                    (p[i][0] - p[i - 1][0])
            );
    return p[p.length - 1][1];
}
function buildStreetMap(V) {
    const lx = (L, z) => _lxp(L.pts, z);
    const has = (L, za, zb) =>
        L.pts[0][0] <= za + 1e-6 && L.pts[L.pts.length - 1][0] >= zb - 1e-6;
    const zs = [...new Set([V.z0, V.z1, ...V.xst.map((r) => r[0])])].sort(
        (a, b) => a - b,
    );
    for (const B of [V.left, V.right])
        if (B.auto) B.pts = zs.map((z) => [z, B.auto(z)]);
    const all = [V.left, ...V.lines, V.right],
        byName = new Map(all.map((L) => [L.name, L]));
    V.zs = zs;
    V.lx = lx;
    V.bands = zs.slice(1).map(() => []);
    V.cells = [];
    V.segs = [];
    V.nodes = [];
    const span = (r, z) => [
        r[4] ? lx(byName.get(r[4]), z) : -Infinity,
        r[5] ? lx(byName.get(r[5]), z) : Infinity,
    ];
    const cover = (z, a, b) => {
        if (Math.abs(z - V.z0) < 1e-6) return V.top;
        if (Math.abs(z - V.z1) < 1e-6) return V.bot;
        if (b - a < 0.01) return { hw: 0, walk: 0 };
        for (const r of V.xst) {
            if (Math.abs(r[0] - z) > 1e-6) continue;
            const [x0, x1] = span(r, z);
            if (a >= x0 - 0.01 && b <= x1 + 0.01)
                return { hw: r[1] / 2, walk: r[2] };
        }
        return null;
    };

    const raw = [];
    for (let k = 0; k + 1 < zs.length; k++) {
        const za = zs[k],
            zb = zs[k + 1],
            zm = (za + zb) / 2;
        const act = all
            .filter((L) => has(L, za, zb))
            .sort((a, b) => lx(a, zm) - lx(b, zm));
        raw[k] = [];
        for (let i = 0; i + 1 < act.length; i++) {
            const A = act[i],
                B = act[i + 1];
            const a0 = lx(A, za),
                a1 = lx(A, zb),
                b0 = lx(B, za),
                b1 = lx(B, zb);
            if (b0 - a0 < 0.01 && b1 - a1 < 0.01) continue;
            raw[k].push({
                k,
                A,
                B,
                top: cover(za, a0, b0),
                bot: cover(zb, a1, b1),
                prev: null,
                next: null,
            });
        }
    }
    for (let k = 1; k < raw.length; k++)
        for (const c of raw[k]) {
            if (c.top) continue;
            const p = raw[k - 1].find(
                (q) => q.A === c.A && q.B === c.B && !q.bot,
            );
            if (p) {
                p.next = c;
                c.prev = p;
            } else {
                c.top = { hw: 0, walk: 0 };
                console.warn(
                    "[layout] map",
                    V.name,
                    "uncovered edge without partner at",
                    zs[k],
                );
            }
        }
    for (let k = 0; k < raw.length; k++)
        for (const c of raw[k])
            if (!c.bot && !c.next) c.bot = { hw: 0, walk: 0 };
    const bb = (Q) => ({
        x0: Math.min(...Q.map((p) => p[0])),
        x1: Math.max(...Q.map((p) => p[0])),
        z0: Math.min(...Q.map((p) => p[1])),
        z1: Math.max(...Q.map((p) => p[1])),
    });
    for (let k = 0; k < raw.length; k++)
        for (const head of raw[k]) {
            if (head.prev) continue;
            const chain = [];
            for (let c = head; c; c = c.next) chain.push(c);
            const tail = chain[chain.length - 1],
                A = head.A,
                B = head.B;
            const zl = [zs[head.k], ...chain.map((c) => zs[c.k + 1])];

            let V0 = [[lx(A, zl[0]), zl[0], "top"]];
            for (let i = 0; i < zl.length; i++)
                V0.push([
                    lx(B, zl[i]),
                    zl[i],
                    i === zl.length - 1 ? "bot" : "B",
                ]);
            for (let i = zl.length - 1; i >= 1; i--)
                V0.push([lx(A, zl[i]), zl[i], "A"]);
            for (let it = 0; it < 2; it++) {
                const out = [];
                for (let i = 0; i < V0.length; i++) {
                    const p = V0[i],
                        q = V0[(i + 1) % V0.length];
                    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6)
                        out.push(p);
                }
                V0 = out.filter((p, i) => {
                    const o = out[(i + out.length - 1) % out.length],
                        q = out[(i + 1) % out.length];
                    return !(
                        o[2] === p[2] &&
                        Math.abs(
                            (p[0] - o[0]) * (q[1] - p[1]) -
                                (p[1] - o[1]) * (q[0] - p[0]),
                        ) < 1e-6
                    );
                });
            }
            const P = V0.map((p) => [p[0], p[1]]);
            let sg = 0,
                convex = true;
            for (let i = 0; i < P.length; i++) {
                const o = P[(i + P.length - 1) % P.length],
                    p = P[i],
                    q = P[(i + 1) % P.length],
                    c =
                        (p[0] - o[0]) * (q[1] - p[1]) -
                        (p[1] - o[1]) * (q[0] - p[0]);
                if (Math.abs(c) < 1e-6) continue;
                if (sg && Math.sign(c) !== sg) convex = false;
                sg = Math.sign(c);
            }
            if (!convex)
                console.warn(
                    "[layout] map",
                    V.name,
                    "non-convex cell at",
                    P[0],
                );
            const dist = (t, walk) => {
                const s =
                    t === "top"
                        ? head.top
                        : t === "bot"
                          ? tail.bot
                          : t === "A"
                            ? { hw: A.w / 2, walk: A.walk }
                            : { hw: B.w / 2, walk: B.walk };
                return s.hw + (walk ? s.walk : 0);
            };
            let mx = 0,
                mz = 0;
            for (const [x, z] of P) {
                mx += x;
                mz += z;
            }
            mx /= P.length;
            mz /= P.length;
            const inset = (walk) => {
                let Q = P;
                for (let i = 0; i < P.length && Q.length >= 3; i++) {
                    const p = P[i],
                        q = P[(i + 1) % P.length],
                        L = Math.hypot(q[0] - p[0], q[1] - p[1]);
                    let nx = -(q[1] - p[1]) / L,
                        nz = (q[0] - p[0]) / L;
                    if ((mx - p[0]) * nx + (mz - p[1]) * nz < 0) {
                        nx = -nx;
                        nz = -nz;
                    }
                    const d = dist(V0[i][2], walk);
                    Q = clipPoly(
                        Q,
                        (x, z) => (x - p[0]) * nx + (z - p[1]) * nz - d,
                    );
                }
                return Q.length >= 3 && polyArea(Q) > 0.5 ? Q : null;
            };
            const curb = inset(false);
            if (!curb) continue;
            const prop = inset(true);
            const cb = bb(curb),
                pb = prop ? bb(prop) : null;
            const park =
                (V.parks || []).find((p) => _inConvex(P, p.x, p.z)) ?? null;
            const c = {
                id: V.cells.length,
                k: head.k,
                ks: chain.map((q) => q.k),
                poly: P,
                curb,
                prop,
                A,
                B,
                za: zl[0],
                zb: zl[zl.length - 1],
                map: V,
                park,
                block: {
                    ...cb,
                    px0: pb?.x0 ?? cb.x0,
                    px1: pb?.x1 ?? cb.x0,
                    pz0: pb?.z0 ?? cb.z0,
                    pz1: pb?.z1 ?? cb.z0,
                    poly: prop,
                    curb,
                    vmap: true,
                    core: true,
                    diag: [],
                    park: !!park,
                    id: V.idBase + V.cells.length,
                    dist: district((cb.x0 + cb.x1) / 2, (cb.z0 + cb.z1) / 2),
                },
            };
            V.cells.push(c);
            for (const q of chain) V.bands[q.k].push(c);
        }

    const lines = V.lines;
    for (const L of lines) {
        const z0 = L.pts[0][0],
            z1 = L.pts[L.pts.length - 1][0],
            cuts = [z0];
        for (const z of zs) {
            if (z <= z0 + 1e-6 || z >= z1 - 1e-6) continue;
            const x = lx(L, z);
            const bend = L.pts.some((p) => Math.abs(p[0] - z) < 1e-6);
            const xs = V.xst.some(
                (r) =>
                    Math.abs(r[0] - z) < 1e-6 &&
                    (() => {
                        const [a, b] = span(r, z);
                        return x >= a - 0.01 && x <= b + 0.01;
                    })(),
            );
            const meet = lines.some(
                (O) =>
                    O !== L &&
                    [O.pts[0], O.pts[O.pts.length - 1]].some(
                        (p) =>
                            Math.abs(p[0] - z) < 1e-6 &&
                            Math.abs(p[1] - x) < 0.01,
                    ),
            );
            if (bend || xs || meet) cuts.push(z);
        }
        cuts.push(z1);
        for (let i = 0; i + 1 < cuts.length; i++) {
            const za = cuts[i],
                zb = cuts[i + 1];
            if (
                lines.some(
                    (O) =>
                        O !== L &&
                        lines.indexOf(O) < lines.indexOf(L) &&
                        has(O, za, zb) &&
                        Math.abs(lx(O, za) - lx(L, za)) < 0.01 &&
                        Math.abs(lx(O, zb) - lx(L, zb)) < 0.01,
                )
            )
                continue;
            V.segs.push({
                name: L.name,
                w: L.w,
                walk: L.walk,
                ax: lx(L, za),
                az: za,
                bx: lx(L, zb),
                bz: zb,
                line: L,
                oneway: L.oneway === "S" ? 1 : L.oneway === "N" ? -1 : 0,
            });
        }
    }
    for (const r of V.xst) {
        const [z, w, walk, name] = r,
            [sa, sb] = span(r, z);
        const xs = [
            ...new Set(
                all
                    .filter(
                        (L) =>
                            L.pts[0][0] <= z + 1e-6 &&
                            L.pts[L.pts.length - 1][0] >= z - 1e-6,
                    )
                    .map((L) => Math.round(lx(L, z) * 1000) / 1000),
            ),
        ]
            .filter((x) => x >= sa - 0.01 && x <= sb + 0.01)
            .sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i++)
            V.segs.push({
                name,
                w,
                walk,
                ax: xs[i],
                az: z,
                bx: xs[i + 1],
                bz: z,
                cross: true,
                oneway: r[6] === "E" ? 1 : r[6] === "W" ? -1 : 0,
            });
    }
    for (const s of V.segs) {
        const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
        s.len = L;
        s.ux = (s.bx - s.ax) / L;
        s.uz = (s.bz - s.az) / L;
        s.nx = -s.uz;
        s.nz = s.ux;
        s.hw = s.w / 2;
        s.map = V;
    }

    V.boundary = (x, z) => {
        for (const B of [V.left, V.right])
            if (
                z >= B.pts[0][0] - 0.5 &&
                z <= B.pts[B.pts.length - 1][0] + 0.5 &&
                Math.abs(lx(B, z) - x) < 0.5
            )
                return B.edge
                    ? { edge: true, hw: 0 }
                    : { hw: B.w / 2, ux: 0, uz: 1 };
        if (Math.abs(z - V.z0) < 0.5)
            return V.top.hw
                ? { hw: V.top.hw, ux: 1, uz: 0 }
                : { edge: true, hw: 0 };
        if (Math.abs(z - V.z1) < 0.5)
            return V.bot.hw
                ? { hw: V.bot.hw, ux: 1, uz: 0 }
                : { edge: true, hw: 0 };
        return null;
    };

    V.asphalt = [];
    for (let k = 0; k + 1 < zs.length; k++) {
        const za = k === 0 ? zs[0] + V.top.hw : zs[k],
            zb = k + 2 === zs.length ? zs[k + 1] - V.bot.hw : zs[k + 1];
        const l = (z) => lx(V.left, z) + V.left.w / 2,
            r = (z) => lx(V.right, z) - V.right.w / 2;
        V.asphalt.push([
            [l(za), za],
            [r(za), za],
            [r(zb), zb],
            [l(zb), zb],
        ]);
    }
    for (const s of V.segs)
        if (s.oneway && (V.boundary(s.ax, s.az) || V.boundary(s.bx, s.bz)))
            s.oneway = 0;
    const X0 = Math.min(...V.left.pts.map((p) => p[1])),
        X1 = Math.max(...V.right.pts.map((p) => p[1]));
    V.bx0 = X0;
    V.bx1 = X1;
    return V;
}
buildStreetMap(VMAP);

const _bwy = [
        [2400, 0],
        [2721, -10],
        [2880, -25],
        [3040, -45],
    ],
    _bx = (z) => _lxp(_bwy, z);
export const FMAP = {
    name: "fidi",
    z0: FREG.z0,
    z1: 3052,
    x0: -600,
    x1: 660,
    idBase: 200000,
    top: { hw: G.ST_HALF, walk: G.ST_WALK },
    bot: { hw: 0, walk: 0 },
    left: {
        name: "W EDGE",
        w: 0,
        walk: 4,
        edge: true,
        auto: (z) => lerpCP(WEST_CP, z) + G.PROM,
    },
    right: {
        name: "E EDGE",
        w: 0,
        walk: 4,
        edge: true,
        auto: (z) => lerpCP(EAST_CP, z) - G.PROM,
    },
    xst: [
        [2480, 9, 3.5, "MURRAY ST", "W EDGE", "BROADWAY"],
        [2490, 9, 3.5, "FRANKFORT ST", "PARK ROW", "E EDGE"],
        [2560, 10, 4, "PARK PL", "W EDGE", "BROADWAY"],
        [2560, 10, 4, "SPRUCE ST", "PARK ROW", "E EDGE"],
        [2640, 11, 4, "BARCLAY ST", "W EDGE", "BROADWAY"],
        [2640, 10, 4, "ANN ST", "BROADWAY", "E EDGE"],
        [2721, 10, 4, "VESEY ST", "W EDGE", "BROADWAY"],
        [2721, 12, 4.5, "FULTON ST", "BROADWAY", "E EDGE"],
        [2765, 7, 3, "JOHN ST", "NASSAU ST", "E EDGE", "E"],
        [2799, 10, 4, "LIBERTY ST", "W EDGE", "BROADWAY"],
        [2799, 9, 3.5, "MAIDEN LN", "BROADWAY", "E EDGE"],
        [2840, 7, 3, "PINE ST", "NASSAU ST", "WATER ST", "W"],
        [2865, 9, 3.5, "RECTOR ST", "W EDGE", "BROADWAY"],
        [2880, 11, 5, "WALL ST", "BROADWAY", "E EDGE"],
        [2920, 6, 3, "EXCHANGE PL", "BROADWAY", "WILLIAM ST", "E"],
        [2950, 9, 3.5, "MORRIS ST", "W EDGE", "BROADWAY"],
        [2960, 10, 4, "BEAVER ST", "BROADWAY", "PEARL ST"],
        [2960, 9, 3.5, "OLD SLIP", "PEARL ST", "E EDGE"],
        [3000, 6, 3, "STONE ST", "WHITEHALL ST", "PEARL ST", "E"],
        [3040, 12, 5, "BATTERY PL", "W EDGE", "E EDGE"],
    ],
    lines: [
        {
            name: "SOUTH END AV",
            w: 10,
            walk: 4,
            pts: [
                [2640, -400],
                [2799, -340],
                [2950, -300],
                [3040, -265],
            ],
        },
        {
            name: "GREENWICH ST",
            w: 10,
            walk: 5,
            pts: [
                [2400, -430],
                [2560, -320],
                [2721, -186],
                [2799, -186],
                [2950, -215],
                [3040, -220],
            ],
        },
        {
            name: "CHURCH ST",
            w: 10,
            walk: 5,
            pts: [
                [2400, -250],
                [2560, -165],
                [2721, -100],
                [2799, -100],
                [2950, -85],
                [3040, -95],
            ],
        },
        { name: "BROADWAY", w: 18, walk: 5, pts: _bwy },
        {
            name: "WHITEHALL ST",
            w: 12,
            walk: 4.5,
            pts: [
                [2960, _bx(2960)],
                [3040, 22],
            ],
        },
        {
            name: "NASSAU ST",
            w: 6,
            walk: 3.5,
            oneway: "S",
            pts: [
                [2640, 38],
                [2721, 42],
                [2880, 50],
            ],
        },
        {
            name: "BROAD ST",
            w: 14,
            walk: 5,
            pts: [
                [2880, 50],
                [2960, 60],
                [3040, 76],
            ],
        },
        {
            name: "PARK ROW",
            w: 12,
            walk: 4.5,
            pts: [
                [2400, 250],
                [2560, 120],
                [2640, _bx(2640)],
            ],
        },
        {
            name: "WILLIAM ST",
            w: 9,
            walk: 3.5,
            pts: [
                [2400, 430],
                [2560, 300],
                [2721, 190],
                [2880, 118],
                [2960, 95],
            ],
        },
        {
            name: "PEARL ST",
            w: 10,
            walk: 4,
            pts: [
                [2400, 545],
                [2560, 445],
                [2721, 335],
                [2880, 215],
                [2960, 150],
                [3040, 120],
            ],
        },
        {
            name: "WATER ST",
            w: 12,
            walk: 4.5,
            pts: [
                [2721, 400],
                [2880, 290],
                [2960, 235],
            ],
        },
    ],
    parks: [
        { name: "CITY HALL PARK", x: 60, z: 2470 },
        { name: "BOWLING GREEN", x: -25, z: 3022 },
    ],
};
buildStreetMap(FMAP);
export const MAPS = [VMAP, FMAP];
function _inConvex(P, x, z) {
    let sg = 0;
    for (let i = 0; i < P.length; i++) {
        const [ax, az] = P[i],
            [bx, bz] = P[(i + 1) % P.length],
            c = (bx - ax) * (z - az) - (bz - az) * (x - ax);
        if (Math.abs(c) < 1e-9) continue;
        const s = Math.sign(c);
        if (sg && s !== sg) return false;
        sg = s;
    }
    return true;
}
export const inConvexPoly = _inConvex;

function _mapAt(V, x, z) {
    if (
        z <= V.z0 + V.top.hw ||
        z >= V.z1 - V.bot.hw ||
        x <= V.bx0 ||
        x >= V.bx1
    )
        return null;
    if (
        x <= V.lx(V.left, z) + V.left.w / 2 ||
        x >= V.lx(V.right, z) - V.right.w / 2
    )
        return null;
    let k = 0;
    while (k + 2 < V.zs.length && z >= V.zs[k + 1]) k++;
    for (const c of V.bands[k]) {
        if (
            z < c.block.z0 ||
            z > c.block.z1 ||
            x < c.block.x0 ||
            x > c.block.x1 ||
            !_inConvex(c.curb, x, z)
        )
            continue;
        if (c.prop && _inConvex(c.prop, x, z))
            return c.park
                ? { type: "park", vcell: c, mapPark: c.park }
                : { type: "block", block: c.block, vcell: c };
        return { type: "sidewalk", vcell: c };
    }
    return { type: "street", vmap: true, map: V, streetZ: z };
}
export function vmapAt(x, z) {
    for (const V of MAPS) {
        const q = _mapAt(V, x, z);
        if (q) return q;
    }
    return null;
}

export function vmapRoadPolys(walk = false) {
    return MAPS.flatMap((M) => M.segs).map((s) => {
        const m = s.hw + (walk ? s.walk : 0),
            e = s.cross ? 0 : s.hw;
        const p = (u, v) => [
            s.ax + s.ux * u + s.nx * v,
            s.az + s.uz * u + s.nz * v,
        ];
        return {
            pts: [p(-e, -m), p(s.len + e, -m), p(s.len + e, m), p(-e, m)],
            seg: s,
        };
    });
}

export const BATTERY = (() => {
    const zB = FMAP.z1,
        M = 12,
        W = [],
        E = [];
    for (const z of [zB, ...SHORE_Z.filter((z) => z > zB)]) {
        const [w, e] = shoreX(z);
        if (e - w < 2 * M + 6) break;
        W.push([w + M, z]);
        E.push([e - M, z]);
    }
    const poly = [...W, ...E.reverse()];
    const castle = { x: -205, z: 3140, r: 20, h: 8.5 };
    const _paths = [
        [
            [-20, zB],
            [castle.x, castle.z],
        ],
        [
            [128, zB],
            [-60, 3290],
        ],
        [
            [castle.x, castle.z],
            [60, 3236],
        ],
        [
            [-150, zB],
            [-240, 3200],
        ],
    ].map(([a, b]) => {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return {
            ax: a[0],
            az: a[1],
            nx: -(b[1] - a[1]) / L,
            nz: (b[0] - a[0]) / L,
            hw: 2.8,
        };
    });

    let inner = poly;
    {
        let mx = 0,
            mz = 0;
        for (const [x, z] of poly) {
            mx += x;
            mz += z;
        }
        mx /= poly.length;
        mz /= poly.length;
        for (let i = 0; i < poly.length && inner.length >= 3; i++) {
            const p = poly[i],
                q = poly[(i + 1) % poly.length],
                L = Math.hypot(q[0] - p[0], q[1] - p[1]);
            if (L < 1e-6) continue;
            let nx = -(q[1] - p[1]) / L,
                nz = (q[0] - p[0]) / L;
            if ((mx - p[0]) * nx + (mz - p[1]) * nz < 0) {
                nx = -nx;
                nz = -nz;
            }
            inner = clipPoly(
                inner,
                (x, z) => (x - p[0]) * nx + (z - p[1]) * nz - 4,
            );
        }
        inner = clipPoly(inner, (x, z) => z - zB - 4);
    }
    let lawns = [];
    const plazaR = castle.r + 9;
    lawns = lawns.filter((P) => polyArea(P) > 120);
    const xs = poly.map((p) => p[0]),
        zs = poly.map((p) => p[1]);
    return {
        poly,
        inner,
        plazaR,
        lawns,
        castle,
        paths: [],
        x0: Math.min(...xs),
        x1: Math.max(...xs),
        z0: zB,
        z1: Math.max(...zs),
        lawnBB: lawns.map((P) => ({
            x0: Math.min(...P.map((p) => p[0])),
            x1: Math.max(...P.map((p) => p[0])),
            z0: Math.min(...P.map((p) => p[1])),
            z1: Math.max(...P.map((p) => p[1])),
        })),
    };
})();
export function batteryAt(x, z) {
    const B = BATTERY;
    if (z < B.z0 || z > B.z1 || x < B.x0 || x > B.x1) return null;
    if (Math.hypot(x - B.castle.x, z - B.castle.z) < B.plazaR) return null;
    if (B.inner.length >= 3 && _inConvex(B.inner, x, z))
        return { type: "park", battery: true };
    return null;
}

export const ROUNDABOUT = {
    x: -250,
    z: -560,
    R: 16,
    r: 5.5,
    lane: 10.4,
    n: 32,
};
{
    const RB = ROUNDABOUT,
        ng = (rad, n) =>
            Array.from({ length: n }, (_, i) => {
                const a = (i / n) * Math.PI * 2;
                return [RB.x + Math.cos(a) * rad, RB.z + Math.sin(a) * rad];
            });
    RB.poly = ng(RB.R, RB.n);
    RB.islandPoly = ng(RB.r, 20);
}
export function inRoundabout(x, z) {
    const R = ROUNDABOUT,
        dx = x - R.x,
        dz = z - R.z;
    return dx * dx + dz * dz <= R.R * R.R && _inConvex(R.poly, x, z);
}

export function roundCarve(P) {
    const R = ROUNDABOUT,
        n = R.poly.length;
    let bx0 = Infinity,
        bx1 = -Infinity,
        bz0 = Infinity,
        bz1 = -Infinity;
    for (const [x, z] of P) {
        bx0 = Math.min(bx0, x);
        bx1 = Math.max(bx1, x);
        bz0 = Math.min(bz0, z);
        bz1 = Math.max(bz1, z);
    }
    if (
        bx0 > R.x + R.R ||
        bx1 < R.x - R.R ||
        bz0 > R.z + R.R ||
        bz1 < R.z - R.R
    )
        return { inside: [], outside: [P] };
    const inside = [],
        outside = [];
    let Q = P;
    for (let i = 0; i < n && Q.length >= 3; i++) {
        const a = R.poly[i],
            b = R.poly[(i + 1) % n];
        Q = clipPoly(
            Q,
            (x, z) => (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]),
        );
    }
    if (Q.length >= 3 && polyArea(Q) > 1e-3) inside.push(Q);
    for (let i = 0; i < n; i++) {
        const a = R.poly[i],
            b = R.poly[(i + 1) % n];
        let S = clipPoly(
            P,
            (x, z) =>
                -((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])),
        );
        if (S.length >= 3)
            S = clipPoly(
                S,
                (x, z) => (a[0] - R.x) * (z - R.z) - (a[1] - R.z) * (x - R.x),
            );
        if (S.length >= 3)
            S = clipPoly(
                S,
                (x, z) =>
                    -((b[0] - R.x) * (z - R.z) - (b[1] - R.z) * (x - R.x)),
            );
        if (S.length >= 3 && polyArea(S) > 1e-3) outside.push(S);
    }
    return { inside, outside };
}
export const nearRoundabout = (b) =>
    b.x0 < ROUNDABOUT.x + ROUNDABOUT.R &&
    b.x1 > ROUNDABOUT.x - ROUNDABOUT.R &&
    b.z0 < ROUNDABOUT.z + ROUNDABOUT.R &&
    b.z1 > ROUNDABOUT.z - ROUNDABOUT.R;

export const BIKE_LANES = [
    { i: 2, side: -1, z0: -3440, z1: 3300 },
    { i: 6, side: 1, z0: -3440, z1: 3300 },
    { i: 1, side: 1, z0: -560, z1: 640 },
];

export const BUS_LANES = [
    { i: 4, side: -1, z0: -3440, z1: 2400 },
    { i: 3, side: 1, z0: -60, z1: 2400 },
    { i: 6, side: -1, z0: -3440, z1: 2400 },
    { i: 1, side: -1, z0: -3440, z1: -560 },
];

export const WIDE_STREETS = [1040, 720, 320, -480, -1200, -1680, -2480, -2800];
export const WIDE_ST_SET = 3.2;
export const bikeLaneAt = (x, z) =>
    BIKE_LANES.some((B) => {
        const a = avenues[B.i];
        return (
            z > B.z0 &&
            z < B.z1 &&
            B.side * (x - a) > G.AV_HALF - 3.0 &&
            B.side * (x - a) <= G.AV_HALF + 0.01
        );
    });
export const PARK_AV_I = 5;
export const PARK_MEDIAN = {
    hw: 2.0,
    z0: -2150,
    z1: 960,
    skip: [[-280, 30]],
    lane0: 3.7,
    lane1: 7.1,
};
export function parkMedianAt(k) {
    if (!avActive(PARK_AV_I, k)) return null;
    const za = streets[k] + ST_HW[k] + 6.5,
        zb = streets[k + 1] - ST_HW[k + 1] - 6.5;
    if (
        za < PARK_MEDIAN.z0 ||
        zb > PARK_MEDIAN.z1 ||
        PARK_MEDIAN.skip.some(([a, b]) => zb > a && za < b)
    )
        return null;
    if (BRIDGES.some((B) => Math.abs((za + zb) / 2 - B.z) < B.width / 2 + 60))
        return null;
    return [za, zb];
}
let _isl = null,
    _islIdx = null;
const _ISB = 32,
    _islKey = (bx, bz) => (bx + 4000) * 10000 + (bz + 4000);
export function islands() {
    if (_isl) return _isl;
    _isl = [];
    _islIdx = new Map();
    const add = (kind, poly, trees = []) => {
        const xs = poly.map((p) => p[0]),
            zs = poly.map((p) => p[1]);
        const I = {
            kind,
            poly,
            trees,
            x0: Math.min(...xs),
            x1: Math.max(...xs),
            z0: Math.min(...zs),
            z1: Math.max(...zs),
        };
        I.id = _isl.length;
        _isl.push(I);
        for (
            let bx = Math.floor(I.x0 / _ISB);
            bx <= Math.floor(I.x1 / _ISB);
            bx++
        )
            for (
                let bz = Math.floor(I.z0 / _ISB);
                bz <= Math.floor(I.z1 / _ISB);
                bz++
            ) {
                const key = _islKey(bx, bz);
                let L = _islIdx.get(key);
                if (!L) _islIdx.set(key, (L = []));
                L.push(I);
            }
        return I;
    };
    const x = avenues[PARK_AV_I],
        hw = PARK_MEDIAN.hw;

    for (let k = 0; k + 1 < NS; k++) {
        const m = parkMedianAt(k);
        if (!m) continue;
        const [za, zb] = m,
            n = 1.6;
        const trees = [];
        for (let z = za + 5; z < zb - 4; z += 9) trees.push([x, z]);
        add(
            "median",
            [
                [x - hw + 0.6, za],
                [x + hw - 0.6, za],
                [x + hw, za + n],
                [x + hw, zb - n],
                [x + hw - 0.6, zb],
                [x - hw + 0.6, zb],
                [x - hw, zb - n],
                [x - hw, za + n],
            ],
            trees,
        );
    }
    add("island", ROUNDABOUT.islandPoly, []);

    if (!globalThis.__NO_JISLES)
        for (const P of JUNCTION_ISLES) {
            let cx = 0,
                cz = 0;
            for (const [px, pz] of P) {
                cx += px;
                cz += pz;
            }
            cx /= P.length;
            cz /= P.length;
            let sxx = 0,
                szz = 0,
                sxz = 0;
            for (const [px, pz] of P) {
                sxx += (px - cx) ** 2;
                szz += (pz - cz) ** 2;
                sxz += (px - cx) * (pz - cz);
            }
            const an = 0.5 * Math.atan2(2 * sxz, sxx - szz),
                ux = Math.cos(an),
                uz = Math.sin(an);
            let t0 = 1e9,
                t1 = -1e9,
                w0 = 1e9,
                w1 = -1e9;
            for (const [px, pz] of P) {
                const t = (px - cx) * ux + (pz - cz) * uz,
                    w = -(px - cx) * uz + (pz - cz) * ux;
                t0 = Math.min(t0, t);
                t1 = Math.max(t1, t);
                w0 = Math.min(w0, w);
                w1 = Math.max(w1, w);
            }
            const trees = [];
            if (w1 - w0 >= 3.4 && t1 - t0 >= 7) {
                const wc = (w0 + w1) / 2,
                    n = Math.max(1, Math.floor((t1 - t0 - 5) / 8) + 1),
                    st = (t1 - t0 - 5) / Math.max(1, n - 1);
                for (let j = 0; j < n; j++) {
                    const t = n === 1 ? (t0 + t1) / 2 : t0 + 2.5 + st * j;
                    trees.push([cx + ux * t - uz * wc, cz + uz * t + ux * wc]);
                }
            }
            const I = add("refuge", P, trees);
            I.axis = [ux, uz];
            I.len = t1 - t0;
            I.wid = w1 - w0;
        }

    const road = (px, pz) => {
        const q = streetsAt0(px, pz);
        return (
            (q.type === "avenue" ||
                q.type === "street" ||
                q.type === "intersection") &&
            !q.diag &&
            !q.vmap
        );
    };
    const walkOK = (px, pz) => {
        const q = streetsAt0(px, pz);
        return q.type === "sidewalk" && !q.fill && !q.diagWalk;
    };
    const keepOut = [
        SITES.timesSquare,
        SITES.grandCentral,
        {
            x0: VREG.x0 - 40,
            x1: VREG.x1 + 40,
            z0: VREG.z0 - 30,
            z1: VREG.z1 + 30,
        },
        { x0: -2000, x1: 2000, z0: FREG.z0 - 30, z1: 9000 },
    ];
    const tryAdd = (poly, probe) => {
        const mx = poly.reduce((a, p) => a + p[0], 0) / poly.length,
            mz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
        if (
            !poly.every(([px, pz]) =>
                road(
                    px + Math.sign(mx - px) * 0.1,
                    pz + Math.sign(mz - pz) * 0.1,
                ),
            )
        )
            return false;
        if (!walkOK(probe[0], probe[1])) return false;
        add("bulb", poly);
        return true;
    };
    for (let i = 0; i < NA; i++)
        for (let k = 1; k + 1 < NS; k++) {
            if (!isActive(i, k)) continue;
            const ax = avenues[i],
                z = streets[k];
            if (
                keepOut.some(
                    (R) =>
                        ax > R.x0 - 20 &&
                        ax < R.x1 + 20 &&
                        z > R.z0 - 20 &&
                        z < R.z1 + 20,
                )
            )
                continue;
            if (BRIDGES.some((B) => Math.abs(z - B.z) < B.width / 2 + 50))
                continue;
            if (
                DIAG_SEGS.some(
                    (s) =>
                        Math.hypot(s.ax - ax, s.az - z) < 40 ||
                        Math.hypot(s.bx - ax, s.bz - z) < 40,
                )
            )
                continue;
            for (const sx of [-1, 1])
                for (const sz of [-1, 1]) {
                    if (
                        hash2(i * 131 + (sx + 1) * 7 + sz + 3, k * 977 + 41) >
                        0.42
                    )
                        continue;
                    const cx = ax + sx * G.AV_HALF,
                        cz = z + sz * ST_HW[k];
                    if (i === PARK_AV_I) continue;
                    if (
                        BIKE_LANES.some(
                            (B) =>
                                B.i === i &&
                                B.side === sx &&
                                z > B.z0 &&
                                z < B.z1,
                        )
                    )
                        continue;

                    const d = 2.4,
                        L = 6,
                        t = 2.2;
                    const okA = tryAdd(
                        [
                            [cx, cz],
                            [cx, cz + sz * (L + t)],
                            [cx - sx * d, cz + sz * L],
                            [cx - sx * d, cz],
                        ],
                        [cx + sx * 1.5, cz + sz * 3],
                    );

                    const e = 1.9,
                        Ls = 7,
                        ts = 2;
                    const okS =
                        !stNarrow(k) &&
                        tryAdd(
                            [
                                [cx, cz],
                                [cx + sx * (Ls + ts), cz],
                                [cx + sx * Ls, cz - sz * e],
                                [cx, cz - sz * e],
                            ],
                            [cx + sx * 3, cz + sz * 1.5],
                        );
                    if (okA && okS) {
                        const Q = [[cx, cz]];
                        for (let j = 0; j <= 8; j++) {
                            const a = ((j / 8) * Math.PI) / 2;
                            Q.push([
                                cx - sx * d * Math.cos(a),
                                cz - sz * e * Math.sin(a),
                            ]);
                        }
                        if (
                            Q.every(
                                ([px, pz]) =>
                                    road(
                                        px + Math.sign(cx - px) * 0.05,
                                        pz + Math.sign(cz - pz) * 0.05,
                                    ) ||
                                    (Math.abs(px - cx) < 1e-6 &&
                                        Math.abs(pz - cz) < 1e-6),
                            )
                        )
                            add("bulb", Q);
                    }
                }
        }
    return _isl;
}
export function islandAt(x, z) {
    const L = (_isl ? _islIdx : (islands(), _islIdx)).get(
        _islKey(Math.floor(x / _ISB), Math.floor(z / _ISB)),
    );
    if (!L) return null;
    for (const I of L)
        if (
            x >= I.x0 &&
            x <= I.x1 &&
            z >= I.z0 &&
            z <= I.z1 &&
            _inConvex(I.poly, x, z)
        )
            return I;
    return null;
}

export function islandNear(x, z, r = 1) {
    return !!(
        islandAt(x, z) ||
        islandAt(x + r, z) ||
        islandAt(x - r, z) ||
        islandAt(x, z + r) ||
        islandAt(x, z - r)
    );
}

export const KERB_R = 4.5;
let _cuts = null,
    _cutIdx = null,
    _cutByV = null;
const _vkey = (x, z) => Math.round(x * 20) + "," + Math.round(z * 20);
function _fillet(P, i, r0) {
    const n = P.length,
        V = P[i],
        A = P[(i + n - 1) % n],
        B = P[(i + 1) % n];
    const la = Math.hypot(A[0] - V[0], A[1] - V[1]),
        lb = Math.hypot(B[0] - V[0], B[1] - V[1]);
    if (la < 1 || lb < 1) return null;
    const a = [(A[0] - V[0]) / la, (A[1] - V[1]) / la],
        b = [(B[0] - V[0]) / lb, (B[1] - V[1]) / lb];
    const th = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));
    if (th > Math.PI * 0.86 || th < 0.2) return null;
    let t = r0 / Math.tan(th / 2);
    t = Math.min(t, 0.45 * Math.min(la, lb), 7);
    const r = t * Math.tan(th / 2);
    if (r < 0.8) return null;
    const T1 = [V[0] + a[0] * t, V[1] + a[1] * t],
        T2 = [V[0] + b[0] * t, V[1] + b[1] * t];
    let bx = a[0] + b[0],
        bz = a[1] + b[1];
    const bl = Math.hypot(bx, bz);
    bx /= bl;
    bz /= bl;
    const h = r / Math.sin(th / 2),
        C = [V[0] + bx * h, V[1] + bz * h];
    const a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]);
    const a2 = Math.atan2(T2[1] - C[1], T2[0] - C[0]);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const N = Math.max(3, Math.ceil(Math.abs(da) / (Math.PI / 16))),
        arc = [];
    for (let j = 0; j <= N; j++) {
        const q = a1 + (da * j) / N;
        arc.push(
            j === 0
                ? T1
                : j === N
                  ? T2
                  : [C[0] + Math.cos(q) * r, C[1] + Math.sin(q) * r],
        );
    }
    return { V, T1, T2, C, r, arc, a, b };
}
export function cornerCuts() {
    if (_cuts) return _cuts;
    _cuts = [];
    _cutIdx = new Map();
    _cutByV = new Map();
    islands();
    const road = (x, z) => {
        const I = islandAt(x, z);
        if (I && I.kind !== "refuge") return false;
        const t = streetsAt0(x, z).type;
        return t === "avenue" || t === "street" || t === "intersection";
    };
    const scan = (P, vmap) => {
        const n = P.length;
        let _mx = 0,
            _mz = 0;
        for (const [x, z] of P) {
            _mx += x;
            _mz += z;
        }
        for (let i = 0; i < n; i++) {
            const V = P[i];
            if (_cutByV.has(_vkey(V[0], V[1]))) continue;
            const f = _fillet(P, i, KERB_R);
            if (!f) continue;
            const { a, b } = f;
            const na = [
                    -(b[0] - (a[0] * b[0] + a[1] * b[1]) * a[0]),
                    -(b[1] - (a[0] * b[0] + a[1] * b[1]) * a[1]),
                ],
                nb = [
                    -(a[0] - (a[0] * b[0] + a[1] * b[1]) * b[0]),
                    -(a[1] - (a[0] * b[0] + a[1] * b[1]) * b[1]),
                ];
            const nl = (v) => {
                const l = Math.hypot(v[0], v[1]) || 1;
                return [v[0] / l, v[1] / l];
            };
            const oa = nl(na),
                ob = nl(nb),
                ob2 = nl([-(a[0] + b[0]), -(a[1] + b[1])]);
            const probes = [
                [V[0] + ob2[0] * 1.0, V[1] + ob2[1] * 1.0],
                [
                    V[0] + a[0] * 1.5 + oa[0] * 0.7,
                    V[1] + a[1] * 1.5 + oa[1] * 0.7,
                ],
                [
                    V[0] + b[0] * 1.5 + ob[0] * 0.7,
                    V[1] + b[1] * 1.5 + ob[1] * 0.7,
                ],
            ];
            if (!probes.every(([x, z]) => road(x, z))) continue;
            if (
                [
                    [0, 0],
                    [3.5, 0],
                    [-3.5, 0],
                    [0, 3.5],
                    [0, -3.5],
                ].some(([dx, dz]) => {
                    const I = islandAt(V[0] + dx, V[1] + dz);
                    return I && I.kind !== "refuge";
                })
            )
                continue;
            const K = { ...f, vmap, poly: [f.T1, ...f.arc.slice(1, -1), f.T2] };
            K.x0 = Math.min(V[0], f.T1[0], f.T2[0]);
            K.x1 = Math.max(V[0], f.T1[0], f.T2[0]);
            K.z0 = Math.min(V[1], f.T1[1], f.T2[1]);
            K.z1 = Math.max(V[1], f.T1[1], f.T2[1]);
            K.id = _cuts.length;
            _cuts.push(K);
            _cutByV.set(_vkey(V[0], V[1]), K);
            for (
                let bx = Math.floor(K.x0 / _ISB);
                bx <= Math.floor(K.x1 / _ISB);
                bx++
            )
                for (
                    let bz = Math.floor(K.z0 / _ISB);
                    bz <= Math.floor(K.z1 / _ISB);
                    bz++
                ) {
                    const key = _islKey(bx, bz);
                    let L = _cutIdx.get(key);
                    if (!L) _cutIdx.set(key, (L = []));
                    L.push(K);
                }
        }
    };
    for (const b of buildBlocks()) {
        if (nearRoundabout(b)) continue;
        if (b.diag.length) for (const P of blockPieces(b).walk) scan(P, false);
        else
            scan(
                [
                    [b.x0, b.z0],
                    [b.x1, b.z0],
                    [b.x1, b.z1],
                    [b.x0, b.z1],
                ],
                false,
            );
    }
    for (const M of MAPS) for (const c of M.cells) scan(c.curb, true);
    return _cuts;
}
export function cutAt(x, z) {
    const L = (_cuts ? _cutIdx : (cornerCuts(), _cutIdx)).get(
        _islKey(Math.floor(x / _ISB), Math.floor(z / _ISB)),
    );
    if (!L) return null;
    for (const K of L)
        if (
            x >= K.x0 &&
            x <= K.x1 &&
            z >= K.z0 &&
            z <= K.z1 &&
            _inConvex([K.V, K.T1, K.T2], x, z) &&
            !_inConvex(K.poly, x, z)
        )
            return K;
    return null;
}

export function roundCorners(P) {
    if (!_cuts) cornerCuts();
    const out = [];
    for (const V of P) {
        const K = _cutByV.get(_vkey(V[0], V[1]));
        if (K && Math.hypot(K.V[0] - V[0], K.V[1] - V[1]) < 0.05)
            out.push(...K.arc);
        else out.push(V);
    }
    return out;
}

export function roadRects() {
    const out = [];
    for (let i = 0; i < NA; i++)
        for (let k = 0; k < NS; k++) {
            const x = avenues[i],
                z = streets[k];
            if (isActive(i, k))
                out.push({
                    x0: x - G.AV_HALF,
                    x1: x + G.AV_HALF,
                    z0: z - ST_HW[k],
                    z1: z + ST_HW[k],
                    kind: "intersection",
                    i,
                    k,
                    cx: x,
                    cz: z,
                });
            if (avActive(i, k))
                out.push({
                    x0: x - G.AV_HALF,
                    x1: x + G.AV_HALF,
                    z0: z + ST_HW[k],
                    z1: streets[k + 1] - ST_HW[k + 1],
                    kind: "avenue",
                    i,
                    k,
                    cx: x,
                });
        }
    for (let k = 0; k < NS; k++)
        for (let c = 0; c < NCOL; c += 2) {
            const s = stSeg[k * NCOL + c];
            if (!s) continue;
            out.push({
                x0: s[0],
                x1: s[1],
                z0: streets[k] - ST_HW[k],
                z1: streets[k] + ST_HW[k],
                kind: "street",
                k,
                c,
                cz: streets[k],
                hw: ST_HW[k],
            });
        }
    return out;
}

export function district(x, z) {
    const core =
        Math.exp(-(((z + 130) / 360) ** 2)) *
        Math.exp(-(((x - 120) / 640) ** 2));
    const band =
        0.34 * Math.exp(-(((z - 620) / 330) ** 2)) +
        0.26 * Math.exp(-(((z - 1900) / 260) ** 2)) +
        (z < G.PARK.z1 && z > G.PARK.z0 - 300 ? 0.2 : 0) +
        0.16 * Math.exp(-(((z + 700) / 260) ** 2));
    const midtown = Math.min(1, core + band * (1 - core));
    const fidi =
        Math.exp(-(((z - 2760) / 380) ** 2)) *
        Math.exp(-(((x + 120) / 560) ** 2));
    const parkEdge =
        z > G.PARK.z0 - 40 &&
        z < G.PARK.z1 + 60 &&
        Math.abs(Math.abs(x) - 250) < 200
            ? 1
            : 0;
    const harlem =
        z < G.PARK.z0 - 20 ? Math.min(1, (G.PARK.z0 - 20 - z) / 200) : 0;
    const village = Math.exp(-(((z - 1300) / 380) ** 2));
    const upper = z < G.PARK.z1 && z > G.PARK.z0 ? 1 : 0;
    const [w, e] = shoreX(z);
    const water = x < w + 120 || x > e - 120 ? 1 : 0;
    const south = z > 330 ? Math.min(1, (z - 330) / 250) : 0;
    const _id = "mid";
    if (z > 2250) id = "fd";
    else if (z > 1500) id = "ct";
    else if (z > 350) id = x < 0 ? "gv" : "ct";
    else if (z > G.PARK.z1) id = x < -125 ? "hk" : "mid";
    else if (z > G.PARK.z0)
        id = x < G.PARK.x0 ? "uws" : x > G.PARK.x1 ? "ues" : "park";
    else id = "harlem";
    return {
        midtown,
        fidi,
        parkEdge,
        harlem,
        village,
        upper,
        water,
        south,
        id,
    };
}

export function buildBlocks() {
    const blocks = [];
    for (let c = 0; c < NCOL; c += 2) {
        for (let k = 0; k + 1 < NS; k++) {
            const bc = blockCell[k * NCOL + c];
            if (!bc) continue;
            let { x0, x1, z1 } = bc;
            const { z0 } = bc;
            let split = null;

            if (k + 2 < NS && closedAt(streets[k + 1], (x0 + x1) / 2)) {
                const nb = blockCell[(k + 1) * NCOL + c];
                if (nb) {
                    split = streets[k + 1];
                    z1 = nb.z1;
                    x0 = Math.max(x0, nb.x0);
                    x1 = Math.min(x1, nb.x1);
                }
            }
            const cx = (x0 + x1) / 2,
                cz = (z0 + z1) / 2;
            blocks.push({
                x0,
                x1,
                z0,
                z1,
                core: true,
                ci: c / 2 - 1,
                rj: k,
                col: c,
                px0: x0 + G.AV_WALK,
                px1: x1 - G.AV_WALK,
                pz0: z0 + G.ST_WALK,
                pz1: z1 - G.ST_WALK,
                id: blocks.length,
                split,
                dist: district(cx, cz),
                diag: bc.diag || [],
            });
            if (split) k++;
        }
    }
    return blocks;
}
let _bIndex = null;
function blockIndex() {
    if (_bIndex) return _bIndex;
    _bIndex = new Array(NS * NCOL).fill(null);
    for (const b of buildBlocks()) {
        _bIndex[b.rj * NCOL + b.col] = b;
        if (b.split) _bIndex[(b.rj + 1) * NCOL + b.col] = b;
    }
    return _bIndex;
}

export function streetsAt(x, z) {
    const I = islandAt(x, z);
    if (I) return { type: "sidewalk", island: I };
    const K = cutAt(x, z);
    if (K)
        return {
            type: "intersection",
            cut: K,
            avenueX: K.V[0],
            streetZ: K.V[1],
        };
    return streetsAt0(x, z);
}
function streetsAt0(x, z) {
    if (!onLand(x, z)) return { type: "water" };
    if (inRoundabout(x, z))
        return {
            type: "intersection",
            round: ROUNDABOUT,
            avenueX: ROUNDABOUT.x,
            streetZ: ROUNDABOUT.z,
        };
    if (inPark(x, z)) return { type: "park" };
    {
        const v = vmapAt(x, z);
        if (v) return v;
    }
    if (z > FMAP.z1 - 1e-6) {
        const q = batteryAt(x, z);
        if (q) return q;
    }
    const c = colOf(x),
        r = rowOf(z);
    if (c & 1) {
        const i = (c - 1) >> 1,
            ax = avenues[i];
        if (r & 1) {
            const k = (r - 1) >> 1;
            if (isActive(i, k))
                return {
                    type: "intersection",
                    avenueX: ax,
                    streetZ: streets[k],
                };
        } else {
            const k = r / 2 - 1;
            if (avActive(i, k))
                return {
                    type: "avenue",
                    avenueX: ax,
                    lane: Math.floor((x - ax) / G.AV_LANE),
                };
        }
        return { type: "sidewalk", fill: true };
    }
    if (r & 1) {
        const k = (r - 1) >> 1,
            s = stRange(k, c);
        if (s && x >= s[0] && x <= s[1] && !closedAt(streets[k], x))
            return { type: "street", streetZ: streets[k] };
        const b = blockIndex()[Math.max(0, k - 1) * NCOL + c];
        if (b && b.split === streets[k] && x > b.px0 && x < b.px1)
            return { type: "block", block: b };
        return { type: "sidewalk", fill: !s };
    }
    const k = r / 2 - 1;
    const b = k >= 0 && k + 1 < NS ? blockIndex()[k * NCOL + c] : null;
    if (b && x >= b.x0 && x <= b.x1) {
        if (b.diag.length) {
            const q = diagBand(b.diag, x, z);
            if (q.band === 2)
                return { type: "street", diag: q.seg, streetZ: z };
            if (q.band === 1) return { type: "sidewalk", diagWalk: q.seg };
        }
        if (x > b.px0 && x < b.px1 && z > b.pz0 && z < b.pz1)
            return { type: "block", block: b };
        return { type: "sidewalk" };
    }
    return { type: "sidewalk", fill: true };
}

export function onRoad(x, z) {
    const t = streetsAt(x, z).type;
    return t === "avenue" || t === "street" || t === "intersection";
}

export const DISTRICT_RECTS = {
    harlem: { x0: -800, x1: 900, z0: -3500, z1: -2151, name: "Harlem" },
    uws: { x0: -800, x1: -234, z0: -2151, z1: -569, name: "Upper West Side" },
    park: { x0: -234, x1: 234, z0: -2151, z1: -569, name: "Central Park" },
    ues: { x0: 234, x1: 900, z0: -2151, z1: -569, name: "Upper East Side" },
    hk: { x0: -800, x1: -125, z0: -569, z1: 350, name: "Hell's Kitchen" },
    mid: { x0: -125, x1: 900, z0: -569, z1: 350, name: "Midtown" },
    gv: {
        x0: -800,
        x1: 0,
        z0: 350,
        z1: 1900,
        name: "Greenwich Village / SoHo",
    },
    ct: {
        x0: 0,
        x1: 900,
        z0: 350,
        z1: 1900,
        name: "Chinatown / Lower East Side",
    },
    fd: { x0: -800, x1: 900, z0: 1900, z1: 3400, name: "Financial District" },
};

export const SITES = {
    park: { ...G.PARK },
    timesSquare: {
        x0: -78,
        x1: 80,
        z0: -240,
        z1: -80,
        avenueX: 0,
        plazaStrips: [
            [-34, -10],
            [10, 34],
        ],
        built: "timessq.js (plaza strips + billboard towers)",
    },
    grandCentral: {
        x0: 388,
        x1: 472,
        z0: -160,
        z1: -80,
        avenueX: 430,
        built: "landmarks.js (terminal across Park Av, CLOSED_AV)",
    },
    metlife: { x0: 316, x1: 414, z0: -240, z1: -160, built: "landmarks.js" },
    empire: {
        x0: 146,
        x1: 234,
        z0: 240,
        z1: 320,
        built: "landmarks.js (Empire-State-like, 336 m + mast)",
    },
    chrysler: {
        x0: 484,
        x1: 540,
        z0: -160,
        z1: -80,
        built: "landmarks.js (Chrysler-like crown)",
    },
    wtc1: {
        x0: -168,
        x1: -110,
        z0: 2731,
        z1: 2789,
        built: "landmarks.js (One-WTC-like, 386 m + spire)",
    },
    heroTower: {
        x0: 266,
        x1: 300,
        z0: -620,
        z1: -580,
        built: "hero.js (ref-2 glass/stone tower)",
    },

    midtownTowers: { x0: -125, x1: 610, z0: -569, z1: 240 },
    billionairesRow: { x0: -250, x1: 430, z0: -600, z1: -520 },
    downtownTowers: { x0: -560, x1: 360, z0: 2300, z1: 3150 },
};

export function avenueIndexAt(x) {
    let b = 0;
    for (let i = 1; i < avenues.length; i++)
        if (Math.abs(avenues[i] - x) < Math.abs(avenues[b] - x)) b = i;
    return b;
}
export function streetIndexAt(z) {
    return Math.max(
        0,
        Math.min(streets.length - 1, Math.round((z - streets[0]) / G.ST_SP)),
    );
}

export function blockAt(x, z) {
    const c = colOf(x);
    if (c & 1) return null;
    const r = rowOf(z);
    const k = r & 1 ? ((r - 1) >> 1) - 1 : r / 2 - 1;
    if (k < 0 || k + 1 >= streets.length) return null;
    const b = blockIndex()[k * NCOL + c];
    return b && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 ? b : null;
}

export function blocksInRect(R) {
    return buildBlocks().filter(
        (b) => b.x1 > R.x0 && b.x0 < R.x1 && b.z1 > R.z0 && b.z0 < R.z1,
    );
}
export function districtAt(x, z) {
    return district(x, z).id;
}

export function distToShore(x, z) {
    if (!onLand(x, z)) return 0;
    const [w, e] = shoreX(z);
    return Math.min(x - w, e - x);
}

export const CURB_CUTS = [];
const _ccIdx = new Map();
export function addCurbCut(r) {
    CURB_CUTS.push(r);
    for (let i = Math.floor(r.x0 / 64); i <= Math.floor(r.x1 / 64); i++)
        for (let j = Math.floor(r.z0 / 64); j <= Math.floor(r.z1 / 64); j++) {
            const k = i * 4096 + j;
            let a = _ccIdx.get(k);
            if (!a) _ccIdx.set(k, (a = []));
            a.push(r);
        }
}
export function inCurbCut(x, z, pad = 0.6) {
    const a = _ccIdx.get(Math.floor(x / 64) * 4096 + Math.floor(z / 64));
    return (
        !!a &&
        a.some(
            (r) =>
                x > r.x0 - pad &&
                x < r.x1 + pad &&
                z > r.z0 - pad &&
                z < r.z1 + pad,
        )
    );
}

export const LINCOLN = {
    plaza: { x0: -594, x1: -446, z0: -871, z1: -809 },
    halls: [
        {
            name: "lcMet",
            x0: -566,
            x1: -527,
            z0: -865,
            z1: -815,
            h: 34,
            fh: 8.5,
            bay: 4.6,
        },
        {
            name: "lcNorth",
            x0: -521,
            x1: -479,
            z0: -871,
            z1: -853,
            h: 26,
            fh: 6.5,
            bay: 3.4,
        },
        {
            name: "lcSouth",
            x0: -521,
            x1: -479,
            z0: -827,
            z1: -809,
            h: 26,
            fh: 6.5,
            bay: 3.4,
        },
        {
            name: "lcRear",
            x0: -594,
            x1: -571,
            z0: -871,
            z1: -809,
            h: 17,
            fh: 4.2,
            bay: 2.2,
        },
    ],
    fountain: { x: -500, z: -840, r: 7 },
};
