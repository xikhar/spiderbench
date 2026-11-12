import { JUNCTION_ISLES } from "./jisles.js"; // (layout2 r9) baked refuge islands (tools/gen_islands.mjs)
// OWNER: city agent. Manhattan-island layout (pure data, no three.js objects).
// Axes: +x = east, -z = north, y up, meters. Avenues run N-S (along z), streets run E-W (along x).
//
// The island: a long narrow landmass (~6.8 km x 1.45 km, north tip z=-3480, south tip z=+3330) with the Hudson to the
// west, the East River to the east and the harbour to the south. Shorelines are polylines resampled at every street
// row boundary, so within one row the land is a trapezoid (exact, cheap clipping for the ground mesh and an exact
// analytic terrain query for collision, contract C4).
//
// Grid cells: columns alternate between "between-avenue" (even c) and "avenue" (odd c) strips, rows alternate between
// "between-street" (even r) and "street" (odd r) strips. Every cell is a road (active avenue / street / intersection),
// a block (curb rect with sidewalk ring + building lots), the park, or promenade fill (sidewalk-height paving).
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

// (zfix) ?nozfix: A/B switch that turns the z-fight fixes off (before / after renders, tools/zfight_jitter.mjs)
export const ZFIX = !(
    typeof location !== "undefined" && /[?&]nozfix\b/.test(location.search)
);
export const G = {
    AV_ROAD: 22,
    AV_WALK: 5, // avenue roadway width, sidewalk width
    ST_SP: 80,
    ST_ROAD: 10,
    ST_WALK: 4, // street spacing
    PROM: 16, // min promenade width between the grid and the seawall
    X_MIN: -790,
    X_MAX: 870, // island bounding box (x) (incl. SHORE_PUSH)
    Z_MIN: -3480,
    Z_MAX: 3330, // island tips (z)
    CORE: { x0: -640, x1: 640, z0: -820, z1: 820 }, // (legacy) midtown full-detail area
    PARK: { x0: -234, x1: 234, z0: -2151, z1: -569 }, // Central-Park-like: 8th/CPW (x=-250) .. 5th (x=250), 110th .. 59th
    DRIVE_X0: 1e9,
    DRIVE_X1: 1e9, // (legacy: the old straight waterfront drive no longer exists)
    SEAWALL_X: 1e9,
    RIVER_X1: 1e9,
    WATER_Y: -1.6,
    CURB_H: 0.15,
};
G.AV_HALF = G.AV_ROAD / 2;
G.ST_HALF = G.ST_ROAD / 2;
G.AV_LANE = 3.6; // 3 lanes each direction + double yellow
G.AV_SP = 200; // (legacy: nominal spacing; the real list is irregular)

// avenues west -> east: 12th/West End, 10th/Amsterdam, 8th/CPW, 6th/Lenox, 5th, Park/Lex, 2nd/1st
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
// (layout2 r9) per-street roadway widths (director: real road-width variation on the grid). WIDE_ROADS: wide crosstown
// streets (2 lanes each way + a parking lane each side, two-way); NARROW_STREETS: narrow side streets (one lane + one
// parking lane, one-way). Every other street keeps G.ST_HALF. stHalf(k) is THE half width of street k: rows, blocks,
// road rects, lanes, markings and props all read it.
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
// half width of the street nearest to z (for code that only knows a street's z)
export const stHalfAt = (z) =>
    stHalf(Math.max(0, Math.min(NS - 1, Math.round((z - Z0) / G.ST_SP))));

// ------------------------------------------------------------------------------------------ shoreline
// control polylines [z, x] north -> south; both start / end at the tips
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
// resample at every row boundary (street edges) + tips -> within a row the shore is one straight segment
export const SHORE_Z = [];
{
    const s = new Set([G.Z_MIN, G.Z_MAX]);
    streets.forEach((z, k) => {
        for (const e of [z - ST_HW[k], z + ST_HW[k]])
            if (e > G.Z_MIN && e < G.Z_MAX) s.add(e);
    }); // (layout2 r9) per-street width
    SHORE_Z.push(...[...s].sort((a, b) => a - b));
}
// (round 4) the waterfront (West Side Highway / FDR Drive + esplanade, highway.js) needs ~40 m between the seawall and
// the grid: the land is pushed out by SHORE_PUSH (tapered to 0 at the tips) while the street grid is still laid out
// against the ORIGINAL shoreline (SHORE_W0 / SHORE_E0 + PROM), so blocks / avenues / streets are unchanged.
export const SHORE_PUSH = 30;
export const shorePushAt = (z) =>
    SHORE_PUSH *
    Math.max(0, Math.min(1, (z - G.Z_MIN) / 450, (G.Z_MAX - z) / 450));
const SHORE_W0 = SHORE_Z.map((z) => lerpCP(WEST_CP, z));
const SHORE_E0 = SHORE_Z.map((z) => lerpCP(EAST_CP, z));
export const SHORE_W = SHORE_Z.map((z, i) => SHORE_W0[i] - shorePushAt(z));
export const SHORE_E = SHORE_Z.map((z, i) => SHORE_E0[i] + shorePushAt(z));
function shoreIdx(z) {
    // index i with SHORE_Z[i] <= z < SHORE_Z[i+1]
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
    // -> [xWest, xEast] (xWest > xEast: no land)
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
// most restrictive land x-range over [za, zb]
export function landRange(za, zb) {
    let w = -Infinity,
        e = Infinity;
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
// landRange against the original (un-pushed) shoreline: used only to lay out the street grid
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
// closed land outline [[x, z], ...] (west side north->south, east side south->north)
export const LAND_POLY = [
    ...SHORE_Z.map((z, i) => [SHORE_W[i], z]),
    ...SHORE_Z.map((z, i) => [SHORE_E[i], z])
        .reverse()
        .slice(1, -1),
];

// East River bridges (built by bridges.js; the far-shore generator keeps their approach corridors free).
// z: centre line, deckY: road deck height, towerH: tower top height (suspension), width: deck width, anchor: anchorage
// length (x) off each seawall, ramp: far-shore approach length, sideFrac: side span / total span.
export const BRIDGES = [
    // (r14) towers ~10% taller (critic: 'bridges tiny, vanish into the haze; main towers must read as silhouettes')
    // mGrade: Manhattan approach viaduct grade (round 4): the deck ramps down west from the anchorage over the waterfront
    // and the avenues (>= 7 m clearance) and lands inside a block row (z centred between two streets; the lots under it
    // are left empty by city.js -> approach plazas). See bridges.js manhattanApproach().
    // (bridges r1) every bridge now has a Manhattan approach (mGrade) that lands in a block row and joins a real street at
    // grade (bridges.js mJoin). lanes: traffic lanes per direction (3.4 m), inner: half width of the centre zone
    // (0.6 jersey median, 4.2 Brooklyn raised promenade, 4.6 Williamsburg subway tracks), tower: steel tower variant.
    // width = overall structural width (deck + tower legs / trusses), read by the corridor clearing in other modules.
    // queensboro (-640 -> -680) and triborough (-2960 -> -3000) moved off their street lines into block rows so their
    // approach viaducts no longer sit on a street.
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

// Street segments that are closed (built over) to form T-junctions (ref 3 composition): {z, x0, x1}
export const CLOSED = [{ z: 560, x0: -250, x1: 0 }];
// Avenue segments closed by a landmark standing across them (Grand-Central-like terminal on Park Av): {x, z0, z1}
export const CLOSED_AV = [
    { x: 430, z0: -160, z1: -80 },
    { x: 0, z0: -80, z1: 0 },
]; // + timessq: One-Times-Square-like tower on 6th Av
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
// park region incl. its sidewalk ring = whole grid cells
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

// Central-Park water bodies (Pond, Lake, Reservoir, Meer): polygons shared by the ground mesh and the terrain query
const PL = G.PARK.z1 - G.PARK.z0;
const pz = (f) => G.PARK.z1 - f * PL;
// (round 3) authored Central-Park-like layout, real relative positions scaled to the park (59th .. 110th):
//   the Pond (SE corner, crescent), the Lake (irregular, many-lobed, west of centre ~72nd-78th), Turtle Pond (small,
//   south edge of the Great Lawn), the Reservoir (big, squarish, spans most of the park ~86th-96th), Harlem Meer (NE).
// Each outline is an ellipse (rx, rz, rotation a) modulated by harmonics h = [a2, a3, a4, a5] plus the legacy
// 3rd/5th wobble; the grass shader (ground.js) evaluates the same function, so bank rings follow the real outline.
// rx / rz are normalised so the outline never leaves 1.1 x the ellipse (trees / paths test the ellipse envelope).
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
    // (round 7) + q: small high-frequency coves / points / rocky spits (harmonics 7, 11, 17) so the banks are no longer
    // smooth pasted blobs from the air (the grass shader's pondD in ground.js evaluates the same terms)
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

// ------------------------------------------------------------------------------------------ cells
const XL = [];
for (const a of avenues) XL.push(a - G.AV_HALF, a + G.AV_HALF); // column boundaries
export const NCOL = 2 * NA + 1,
    NROW = 2 * NS + 1;
export function colOf(x) {
    let c = 0;
    while (c < XL.length && x >= XL[c]) c++;
    return c;
}
export function rowOf(z) {
    // (layout2 r9) per-street half widths
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
// road tables. avAct[i*NS + k]: avenue i between street k and k+1. stSeg[k*NCOL + c] = [x0, x1] road extent | null.
export const avAct = new Uint8Array(NA * NS),
    isAct = new Uint8Array(NA * NS);
export const stSeg = new Array(NS * NCOL).fill(null);
export const blockCell = new Array(NS * NCOL).fill(null); // block row k (between street k and k+1), column c
// (layout2 r2) Greenwich / West Village: the grid is REPLACED (not overlaid) inside this rect of seam roads (12th Av,
// 6th Av, the streets at z 640 / 1360) by a real street map (VMAP below): no grid avenues / streets / blocks inside
export const VREG = { x0: -610, x1: 0, z0: 640, z1: 1360 };
// (layout2 r4) Financial District: the grid south of the street at FREG.z0 is REPLACED by an authored street map (FMAP)
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
    // avenues
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
                continue; // (layout2 r2) Village map
            if (streets[k] >= FREG.z0 - 1e-6) continue; // (layout2 r4) FiDi map
            avAct[i * NS + k] = 1;
        }
    // blocks (clipped against the shore with the promenade margin)
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
            if (inVReg(x0, z0, x1, z1)) continue; // (layout2 r2) Village map
            if (z0 >= FREG.z0) continue; // (layout2 r4) FiDi map
            blockCell[k * NCOL + c] = { x0, x1, z0, z1, k, c };
        }
    // streets: needs a block on one side, reaches at least one avenue that is active next to it
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
            if (z > VREG.z0 && z < VREG.z1 && inVReg(x0, z, x1, z)) continue; // (layout2 r2) Village map
            if (z > FREG.z0 + 1e-6) continue; // (layout2 r4) FiDi map
            // an end touches avenue i if not clipped there and the avenue has an active segment at this street
            const avOn = (i) =>
                i >= 0 &&
                i < NA &&
                ((k > 0 && avAct[i * NS + k - 1]) || avAct[i * NS + k]);
            const westOK = Math.abs(x0 - cx0) < 1e-6 && avOn(c / 2 - 1),
                eastOK = Math.abs(x1 - cx1) < 1e-6 && avOn(c / 2);
            if (!westOK && !eastOK) continue;
            // snap the clipped end back to the block edges so the road never pokes past both blocks' sidewalks
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
                // an intersection must itself lie on land with margin
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
// street k between avenue i and i+1 (i = -1: west shore column, i = NA-1: east shore column)
export const stActiveAv = (k, i) => stRange(k, 2 * (i + 1));

// ------------------------------------------------------------------------------------------ (layout2) off-grid roads
// Broadway + angled Village / Financial-District streets cut ACROSS the grid blocks. Each polyline vertex lies on a grid
// road (intersection or street), so inside any block a segment always crosses fully. A segment is ASSIGNED to every
// block its finite road+walk band overlaps; inside an assigned block the segment acts as an infinite band:
//   |d| <= hw          asphalt (y = 0)           streetsAt -> {type:'street', diag: seg}
//   hw < |d| <= hw+walk sidewalk (y = CURB_H)     streetsAt -> {type:'sidewalk'}
// where d = signed distance to the centre line. Buildings stay outside |d| > hw + walk (lots are trimmed; the leftover
// triangles / wedges become paved plazas). Everything (ground mesh, terrain query, lots) derives from the same bands,
// so render and collision agree exactly. Pure data: see LAYOUT_API.md "Off-grid roads".
//   w: roadway width, walk: sidewalk width each side, kind: 'broadway' | 'street' | 'lane'
export const DIAG_ROADS = [
    // Broadway: Upper West Side (between West End & Amsterdam) -> Lincoln-Center bow-tie at 10th Av -> Columbus Circle
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
    // Columbus Circle -> Times Square (merges into 6th Av through the Times-Square bow-tie)
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
    // Herald Square (6th Av) -> Madison Square / Flatiron wedge (5th Av) -> Union Square (Park Av)
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
    // Union Square -> SoHo / Civic Center, then Broadway follows 6th Av (x = 0) down to the Battery
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
    // (layout2 r2) user: no angled strips through grid blocks. The Village / FiDi overlay streets were removed; the Village
    // is a real street map now (VMAP below), FiDi is on hold (progress_layout.md)
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
export const diagD = (s, x, z) => (x - s.ax) * s.nx + (z - s.az) * s.nz; // signed distance to the centre line
export const diagS = (s, x, z) => (x - s.ax) * s.ux + (z - s.az) * s.uz; // arc length along the segment
// finite band (|d| <= m, 0 <= s <= len) overlaps the axis-aligned rect? (separating axis test)
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
// convex polygon [[x,z],...] clipped to f(x,z) >= 0 (f linear)
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
// band query inside a block's assigned segments -> 0 outside, 1 sidewalk band, 2 asphalt (+ the segment)
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
// a block's curb rect split by its off-grid roads into convex cells: {road: [poly], walk: [poly]} (walk = everything
// at sidewalk height, incl. the property / plaza area). Shared by the ground mesh and anyone needing the exact shapes.
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
            const f = (x, z) => sg * (diagD(s, x, z) - sg * s.hw); // line d = sg * hw
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
        walk.push(...c.outside); // (layout2 r3) Columbus Circle
    }
    return { road, walk };
}
// is the rect clear of every off-grid road + sidewalk band of the block (by `pad` extra metres)?
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
// largest axis-aligned sub-rect of the lot clear of the block's off-grid bands (min side `minW`), or null
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
// (layout2 r2) the block's property rect minus its off-grid road + sidewalk bands, as convex pieces [[x, z], ...]
// (inset `pad` from the bands). Wedges / triangles / trapezoids: true-footprint frontage buildings (buildings.js)
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
// full band polygons of every off-grid segment (minimap / debug): {pts, seg}
export function diagRoadPolys(walk = false) {
    return DIAG_SEGS.map((s) => {
        const m = s.hw + (walk ? s.walk : 0),
            e = s.hw; // extend the ends a little into the grid road it joins
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

// ------------------------------------------------------------------------------------------ (layout2 r2) Village map
// A real street map for the Greenwich / West Village (inside VREG; the grid there is removed, the four seam roads stay
// grid roads). Cross streets run along x at irregular spacing; the Village streets are polylines x(z) at odd angles
// (bends only at cross-street z values), 7th Av S merges into Bleecker (triangle blocks). Blocks are the convex cells
// between consecutive streets of each band: `curb` polygon (sidewalk at 0.15, curb faces), `prop` polygon (buildings).
// Everything (ground, buildings, traffic, trees, minimap, streetsAt) derives from these polygons.
const _bleeckerX = (z) => -250 - (150 * (z - 640)) / 720;
export const VMAP = {
    name: "village",
    ...VREG,
    idBase: 100000,
    seamX: [
        { x: VREG.x0, hw: G.AV_HALF, walk: G.AV_WALK },
        { x: VREG.x1, hw: G.AV_HALF, walk: G.AV_WALK },
    ],
    // cross streets: [z, roadway width, sidewalk width, name, fromLine?, toLine?, oneway?]
    // (layout2 r4) Jane / Perry / Grove / Morton: true one-lane one-way side streets (6-7 m, cars single file, no centre line)
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
    // Village streets: pts [[z, x], ...] with z ascending (north -> south), vertices on cross-street z values
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
// (layout2 r4) the map builder is generic now (Village + Financial District, MAPS below). A map = two boundary lines
// (`left` / `right`: grid seam avenues, or `edge` lines along the waterfront), a top / bottom boundary (seam street or
// open edge), Village-style streets `lines` (x(z) polylines, bends only at band z values) and cross streets `xst`
// [z, w, walk, name, fromLine?, toLine?, oneway?] that may span only part of the map (T-junctions, staggered streets):
// a cell edge not covered by a cross street merges the cells above / below it (the lines must stay straight there, or
// bend so the merged cell stays convex; checked, warned). Segments carry `oneway` (+1 along a->b, -1 against) for true
// one-lane streets.
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
        // the street along the cell edge [a, b] at z -> {hw, walk} | null (uncovered: merge)
        if (Math.abs(z - V.z0) < 1e-6) return V.top;
        if (Math.abs(z - V.z1) < 1e-6) return V.bot;
        if (b - a < 0.01) return { hw: 0, walk: 0 }; // triangle tip
        for (const r of V.xst) {
            if (Math.abs(r[0] - z) > 1e-6) continue;
            const [x0, x1] = span(r, z);
            if (a >= x0 - 0.01 && b <= x1 + 0.01)
                return { hw: r[1] / 2, walk: r[2] };
        }
        return null;
    };
    // raw cells per band, then vertical chains through the uncovered edges
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
            if (b0 - a0 < 0.01 && b1 - a1 < 0.01) continue; // merged streets
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
            // polygon (top-left, top edge, down the B side, bottom edge, up the A side) + the type of the edge leaving each vertex
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
                // drop zero-length edges, then collinear same-side vertices
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
    // street segments along the lines, split at junctions (cross streets, line ends / merges) and bends only
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
        // cross-street segments between consecutive crossings inside the street's span
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
    // boundary query (npc/roads.js): the seam road met at (x, z) -> {hw} (grid road), {edge: true} (waterfront) | null
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
    // the asphalt under the map (the raised cells sit on it): one convex trapezoid per band between the boundary curbs
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
            s.oneway = 0; // a dead end / seam T needs a way back
    const X0 = Math.min(...V.left.pts.map((p) => p[1])),
        X1 = Math.max(...V.right.pts.map((p) => p[1]));
    V.bx0 = X0;
    V.bx1 = X1;
    return V;
}
buildStreetMap(VMAP);
// ------------------------------------------------------------------------------------------ (layout2 r4) FiDi map
// Lower Manhattan south of the street at z 2400 (Chambers): the grid is REPLACED by an authored crooked street map
// modelled on the real network: Broadway (straight, the 6th Av line) with Park Row splitting off it around a triangular
// City Hall Park, Church / Trinity Pl and Greenwich (bending round the fixed WTC block), South End Av (Battery Park City
// superblocks), Nassau (one lane, one-way) becoming Broad St at Wall St, William, Pearl and Water St following the old
// shoreline, staggered cross streets (Murray / Frankfort, Rector / Wall, Liberty / Maiden Ln, Morris / Beaver ...),
// cobbled one-lane Stone St, Exchange Pl, Whitehall splitting off Broadway round Bowling Green, and Battery Park at the
// tip (BATTERY below). West / east the map is bounded by the waterfront (edge lines at the original seawall + PROM; the
// highway / esplanade stay outside). Fixed sites inside it: the WTC block (Greenwich / Church / Vesey / Liberty holds
// SITES.wtc1 exactly) and the Brooklyn Bridge approach (lands in the Park Row / William / Spruce / Ann block).
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
// street-map point query (streetsAt contract) or null outside every map
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
// street polygons of the maps (minimap / map): {pts, seg}
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
// (layout2 r4) Battery Park: the island tip south of the FiDi map (land 12 m in from the seawall: the esplanade stays),
// lawns split by curving-ish promenades (straight path bands at odd angles) around a Castle-Clinton-like round fort.
// streetsAt: lawns -> 'park' (grass 0.17), paths / the fort plaza -> promenade fill (0.15). ground.js renders the lawns +
// the fort (exact collision), city.js plants the trees.
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
    const paths = [
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
    // (coast r2) coordinator: 'a huge flat lawn with thin straight paths' -> one lawn (the park inset 4 m for its
    // perimeter promenade) with the fort plaza cut out as a circle in batteryAt; the curving paths, groves, fort, ferry
    // terminal and furniture are waterfront.js' (paths are flush paver decals on the lawn, like Central Park's)
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
    let lawns = []; // (coast r2) no convex lawn pieces any more (city.js plants no grid trees here; waterfront.js plants the groves)
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
    // 'park' on a Battery Park lawn, null elsewhere (the promenade fill answers)
    const B = BATTERY;
    if (z < B.z0 || z > B.z1 || x < B.x0 || x > B.x1) return null;
    if (Math.hypot(x - B.castle.x, z - B.castle.z) < B.plazaR) return null; // (coast r2) fort plaza + courtyard: promenade fill
    if (B.inner.length >= 3 && _inConvex(B.inner, x, z))
        return { type: "park", battery: true };
    return null;
}

// ------------------------------------------------------------------------------------------ (layout2 r3) Columbus Circle
// A roundabout at the Broadway / 8th Av / 59th St node by the park's SW corner: the asphalt disc (n-gon of radius R)
// carves the corners of the blocks around it (their sidewalk cells are split along the n-gon: inside -> asphalt,
// outside -> convex sidewalk wedges), a central island (radius r, monument column) sits in the middle, traffic circles
// counter-clockwise (seen from above) on the ring at radius `lane` (npc/roads.js ring connectors).
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
// convex polygon -> {inside: [poly] (in the roundabout disc), outside: [convex polys]} (radial-sector decomposition)
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
    let Q = P; // inside: clip by every n-gon edge
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
        // sector i (between the rays through vertices i, i+1) outside edge i
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

// ------------------------------------------------------------------------------------------ (layout2 r3) curb islands
// Raised convex curb polygons standing ON the asphalt (top at CURB_H, curb faces all round): the Park Av median, corner
// bulb-outs (neck-downs over the parking lanes at crosswalks) and pedestrian refuge islands. streetsAt() reports them as
// {type:'sidewalk', island}; ground.js draws them into the sidewalk mesh, so terrain / render / collision agree exactly.
// Traffic keeps clear: moving lanes never overlap them (Park Av lanes shift outward beside the median, npc/roads.js),
// parked cars skip them (islandNear). Built lazily on first query (needs the block index). See LAYOUT_API.md.
//   {kind: 'median'|'bulb'|'island', poly: [[x, z], ...] convex, x0, x1, z0, z1, trees: [[x, z], ...]}
// painted curb-side bike lanes (1.8 m green lane + 0.9 m hatched buffer where the parking lane was): avenue i, side -1 west / +1 east
export const BIKE_LANES = [
    { i: 2, side: -1, z0: -3440, z1: 3300 },
    { i: 6, side: 1, z0: -3440, z1: 3300 },
    { i: 1, side: 1, z0: -560, z1: 640 },
];
// (layout2 r8) red curb-side bus lanes (paint only, ground.js; critic r7: 'no painted bike lanes, bus lanes'): 5th Av west
// side, 6th Av east side south of Times Sq, 2nd Av west side (the bike lane is on its east side), 10th Av west side uptown
export const BUS_LANES = [
    { i: 4, side: -1, z0: -3440, z1: 2400 },
    { i: 3, side: 1, z0: -60, z1: 2400 },
    { i: 6, side: -1, z0: -3440, z1: 2400 },
    { i: 1, side: -1, z0: -3440, z1: -560 },
];
// (layout2 r8) wide crosstown streets (14th, 23rd, 34th, 57th-, 72nd-, 86th-, 116th-, 125th-like): the building line
// on both sides steps back WIDE_ST_SET m (buildings.js blockVariety, emit-time setback: the city rnd / lots are
// unchanged), so the canyon is ~6 m wider than the ordinary side streets. The roadway itself keeps the grid width.
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
export const PARK_AV_I = 5; // avenues[5] = 430 (Park Av): median-divided between these z (Grand Central + viaduct excluded)
export const PARK_MEDIAN = {
    hw: 2.0,
    z0: -2150,
    z1: 960,
    skip: [[-280, 30]],
    lane0: 3.7,
    lane1: 7.1,
};
export function parkMedianAt(k) {
    // median on the Park Av segment between streets k and k+1? -> [za, zb] | null
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
    // Park Av median: planted islands with chamfered noses, one per block, trees down the middle
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
    add("island", ROUNDABOUT.islandPoly, []); // Columbus Circle centre (monument: ground.js)
    // (layout2 r9) refuge / pedestrian islands baked on the empty asphalt of the irregular junctions (tools/gen_islands.mjs)
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
    // corner bulb-outs: over the parking lane on both legs of a block corner at ~45% of the signalised grid intersections
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
    ]; // (layout2 r4) + FiDi seam
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
            return false; // just inside the curb line
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
                continue; // Broadway junctions
            for (const sx of [-1, 1])
                for (const sz of [-1, 1]) {
                    if (
                        hash2(i * 131 + (sx + 1) * 7 + sz + 3, k * 977 + 41) >
                        0.42
                    )
                        continue;
                    const cx = ax + sx * G.AV_HALF,
                        cz = z + sz * ST_HW[k]; // block corner (curb)
                    if (i === PARK_AV_I) continue; // Park Av: median instead (no parking lane)
                    if (
                        BIKE_LANES.some(
                            (B) =>
                                B.i === i &&
                                B.side === sx &&
                                z > B.z0 &&
                                z < B.z1,
                        )
                    )
                        continue; // curb-side bike lane
                    // avenue leg: over the avenue's parking lane (curb .. 2.4 m in), from the box edge 6 m along, 45-degree taper
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
                    // street leg: over the street's parking lane (curb .. 1.9 m in), across the crosswalk + taper
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
                        // both legs: a rounded quarter-ellipse wraps the corner between them (the kerb return of the bulb-out)
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
// any island within r metres (axis probes + centre): parked cars / props keep clear
export function islandNear(x, z, r = 1) {
    return !!(
        islandAt(x, z) ||
        islandAt(x + r, z) ||
        islandAt(x - r, z) ||
        islandAt(x, z + r) ||
        islandAt(x, z - r)
    );
}

// ------------------------------------------------------------------------------------------ (layout2 r3) kerb returns
// User: rounded sidewalk corners at every intersection (grid, Broadway, Village; acute / obtuse too). Every convex
// sidewalk-polygon vertex with asphalt all round its outside (3 probes) gets a fillet of radius KERB_R (tangent length
// clamped to 45% of the shorter edge / 7 m). The cut = triangle(V, T1, T2) minus the convex arc polygon (T1, arc.., T2)
// becomes asphalt: streetsAt reports {type:'intersection', cut}, ground.js replaces V by the arc in the sidewalk polygon
// (the curb faces follow the curve) and fills the cut with asphalt fan triangles, so render and terrain agree exactly.
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
    if (th > Math.PI * 0.86 || th < 0.2) return null; // nearly straight (no corner) / degenerate
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
    let a2 = Math.atan2(T2[1] - C[1], T2[0] - C[0]);
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
    }; // (layout2 r9) refuge islands never change the kerb returns
    const scan = (P, vmap) => {
        const n = P.length;
        let mx = 0,
            mz = 0;
        for (const [x, z] of P) {
            mx += x;
            mz += z;
        }
        mx /= n;
        mz /= n;
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
                continue; // bulb-out corner: the bulb carries its own rounded return
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
    for (const M of MAPS) for (const c of M.cells) scan(c.curb, true); // (layout2 r4) every street map
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
// a sidewalk polygon with its registered kerb-return vertices replaced by their arcs (still convex)
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

// road rects (asphalt): {x0, z0, x1, z1, kind: 'avenue'|'street'|'intersection', i?, k?, c?}
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

// ------------------------------------------------------------------------------------------ districts
// Named districts (south = +z). Weights drive the building generator; `id` matches game/systems/worlddata.js.
export function district(x, z) {
    // zoning height map (round 9): Midtown / FiDi peaks plus a 12-30 storey mid band (Chelsea / Flatiron / Murray Hill /
    // Kips Bay, Tribeca / Civic Center, the UES / UWS avenue walls) so the skyline layers instead of a low-rise mat.
    // The mid band is folded into `midtown` (the generator's tower weight); the Village / SoHo trough stays low.
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
    const village = Math.exp(-(((z - 1300) / 380) ** 2)); // low-rise Village / SoHo / LES
    const upper = z < G.PARK.z1 && z > G.PARK.z0 ? 1 : 0; // Upper West / East Side residential
    const [w, e] = shoreX(z);
    const water = x < w + 120 || x > e - 120 ? 1 : 0; // waterfront towers
    const south = z > 330 ? Math.min(1, (z - 330) / 250) : 0;
    let id = "mid";
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

// ------------------------------------------------------------------------------------------ blocks
// Blocks: curb rectangles (x0,x1,z0,z1). Property (building) rect is inset by the sidewalk width.
// ci: index of the avenue to the west (-1 = west shore column), rj: street index to the north.
export function buildBlocks() {
    const blocks = [];
    for (let c = 0; c < NCOL; c += 2) {
        for (let k = 0; k + 1 < NS; k++) {
            const bc = blockCell[k * NCOL + c];
            if (!bc) continue;
            let { x0, x1, z0, z1 } = bc;
            let split = null;
            // a closed street merges this block with the next row (T-junction)
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
                diag: bc.diag || [], // (layout2) off-grid roads crossing this block (see DIAG_ROADS)
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

// Road-type query: 'avenue' | 'street' | 'intersection' | 'sidewalk' | 'block' | 'park' | 'water'
// (promenade / plaza fill reports 'sidewalk' with fill: true)
export function streetsAt(x, z) {
    const I = islandAt(x, z); // (layout2 r3) curb islands on the asphalt (median, bulb-outs)
    if (I) return { type: "sidewalk", island: I };
    const K = cutAt(x, z); // (layout2 r3) rounded kerb returns: the cut-off sidewalk corner is asphalt
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
    // (layout2 r3) the query without curb islands
    if (!onLand(x, z)) return { type: "water" };
    if (inRoundabout(x, z))
        return {
            type: "intersection",
            round: ROUNDABOUT,
            avenueX: ROUNDABOUT.x,
            streetZ: ROUNDABOUT.z,
        }; // (layout2 r3)
    if (inPark(x, z)) return { type: "park" };
    {
        const v = vmapAt(x, z);
        if (v) return v;
    } // (layout2 r2) Village street map (+ r4 FiDi)
    if (z > FMAP.z1 - 1e-6) {
        const q = batteryAt(x, z);
        if (q) return q;
    } // (layout2 r4) Battery Park lawns
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
            // (layout2) Broadway / angled streets cutting the block
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
// true where the ground is asphalt (y = 0)
export function onRoad(x, z) {
    const t = streetsAt(x, z).type;
    return t === "avenue" || t === "street" || t === "intersection";
}

// ------------------------------------------------------------------------------------------ layout API (for district builders)
// Pure data + helpers so every module places things from ONE source of truth. See tools/briefs/city_remake/LAYOUT_API.md.
// District rectangles (ids match game/systems/worlddata.js DISTRICTS). Rects are coarse bounding boxes; clip with onLand().
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
// Named sites (lot rectangles on the building grid). Landmarks already built by landmarks.js are marked `built`.
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
    // where the tall towers belong (building generator weights: district().midtown / .fidi)
    midtownTowers: { x0: -125, x1: 610, z0: -569, z1: 240 },
    billionairesRow: { x0: -250, x1: 430, z0: -600, z1: -520 }, // along the street just south of the park
    downtownTowers: { x0: -560, x1: 360, z0: 2300, z1: 3150 },
};
// nearest avenue / street index, grid lookups
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
// block (curb rect with sidewalk ring; property rect px0..px1 / pz0..pz1) containing (x, z), or null
export function blockAt(x, z) {
    const c = colOf(x);
    if (c & 1) return null;
    const r = rowOf(z);
    const k = r & 1 ? ((r - 1) >> 1) - 1 : r / 2 - 1;
    if (k < 0 || k + 1 >= streets.length) return null;
    const b = blockIndex()[k * NCOL + c];
    return b && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 ? b : null;
}
// all blocks overlapping a rect {x0,x1,z0,z1}
export function blocksInRect(R) {
    return buildBlocks().filter(
        (b) => b.x1 > R.x0 && b.x0 < R.x1 && b.z1 > R.z0 && b.z0 < R.z1,
    );
}
export function districtAt(x, z) {
    return district(x, z).id;
}
// shore / waterfront helpers: distance (m) from (x, z) to the nearest seawall across x at that z (Infinity off-island)
export function distToShore(x, z) {
    if (!onLand(x, z)) return 0;
    const [w, e] = shoreX(z);
    return Math.min(x - w, e - x);
}
// (layout2 r5) curb cuts: driveway / loading-bay aprons across the sidewalk (registered by buildings.js blockVariety
// while the city generates). Street props (lamps, trees, hydrants, sheds...) keep off them. Rects {x0,z0,x1,z1}, 64 m hash.
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
// (layout2 r5) Lincoln-Center-like superblock (block west of the 10th Av / Broadway bow-tie): three travertine halls round
// an open plaza facing the avenue (fountain, bosque, pavers: buildings.js dressSquares). `plaza` clears the whole block's
// generic lots; the halls are reserves built by generateBuildings (arch in city.js).
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
        }, // opera house closing the plaza
        {
            name: "lcNorth",
            x0: -521,
            x1: -479,
            z0: -871,
            z1: -853,
            h: 26,
            fh: 6.5,
            bay: 3.4,
        }, // concert hall
        {
            name: "lcSouth",
            x0: -521,
            x1: -479,
            z0: -827,
            z1: -809,
            h: 26,
            fh: 6.5,
            bay: 3.4,
        }, // theater
        {
            name: "lcRear",
            x0: -594,
            x1: -571,
            z0: -871,
            z1: -809,
            h: 17,
            fh: 4.2,
            bay: 2.2,
        }, // school / library behind
    ],
    fountain: { x: -500, z: -840, r: 7 },
};
