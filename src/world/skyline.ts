// @ts-nocheck
/**
 * Defines skyline landmark reserves and crown lighting helpers.
 *
 * @module world-skyline
 * @version 1.0.0
 * @file src/world/skyline.ts
 * @since 0.0.1
 * @description Provides hero tower placement data and utilities for accentuating prominent skyline buildings.
 */
import { STYLE, LAYER, addCrownFlood } from "./facade.ts";
import { cityLights } from "@/render/citylights.ts";
import { lmBox, lmCyl } from "./landmarks.ts";

const snapA = (A, y) =>
    A.gH + Math.max(1, Math.round((y - A.gH) / A.floorH)) * A.floorH;
const ins = (m, a, b = a, c = a, d = a) => ({
    x0: m.x0 + a,
    x1: m.x1 - b,
    z0: m.z0 + c,
    z1: m.z1 - d,
});
const UP = { nx: "setback", px: "setback", nz: "setback", pz: "setback" };
const sq = (cx, cz, hx, hz = hx) => ({
    x0: cx - hx,
    x1: cx + hx,
    z0: cz - hz,
    z1: cz + hz,
});
const METAL = (tint = [2.4, 2.45, 2.5], seed = 5) => ({
    floorH: 3.0,
    bayW: 1.2,
    winW: 0.5,
    winH: 0.5,
    layer: LAYER.METAL,
    base: LAYER.METAL,
    seed,
    margin: 0,
    depth: 0.05,
    tint,
});

function cross(m, c, y0, y1, p, o = {}) {
    if (c <= 0.4)
        return [{ ...m, y0, y1, p, parapet: 0, sides: { ...UP }, ...o }];
    return [
        {
            x0: m.x0 + c,
            x1: m.x1 - c,
            z0: m.z0,
            z1: m.z1,
            y0,
            y1,
            p,
            parapet: 0,
            sides: { ...UP },
            ...o,
        },
        {
            x0: m.x0,
            x1: m.x0 + c,
            z0: m.z0 + c,
            z1: m.z1 - c,
            y0,
            y1,
            p,
            parapet: 0,
            sides: { ...UP, px: "party" },
            ...o,
        },
        {
            x0: m.x1 - c,
            x1: m.x1,
            z0: m.z0 + c,
            z1: m.z1 - c,
            y0,
            y1,
            p,
            parapet: 0,
            sides: { ...UP, nx: "party" },
            ...o,
        },
    ];
}

function chamferPlan(cx, cz, X, D, y0, y1, p) {
    if (D >= 2 * X - 0.3)
        return [{ ...sq(cx, cz, X), y0, y1, p, parapet: 0, sides: { ...UP } }];
    const k = Math.max(1, Math.min(4, Math.round((2 * X - D) / 4)));
    const xs = [],
        zs = [];
    for (let j = 0; j <= k; j++) {
        const x = X - (j * (2 * X - D)) / k;
        xs.push(x);
        zs.push(D - x);
    }
    const out = [
        {
            x0: cx - xs[k],
            x1: cx + xs[k],
            z0: cz - zs[k],
            z1: cz + zs[k],
            y0,
            y1,
            p,
            parapet: 0,
            sides: { ...UP },
        },
    ];
    for (let j = 0; j < k; j++) {
        out.push({
            x0: cx + xs[j + 1],
            x1: cx + xs[j],
            z0: cz - zs[j],
            z1: cz + zs[j],
            y0,
            y1,
            p,
            parapet: 0,
            sides: { ...UP, nx: "party" },
        });
        out.push({
            x0: cx - xs[j],
            x1: cx - xs[j + 1],
            z0: cz - zs[j],
            z1: cz + zs[j],
            y0,
            y1,
            p,
            parapet: 0,
            sides: { ...UP, px: "party" },
        });
    }
    return out;
}

function esbFloods(lot, A, cx, cz, yObs, yb) {
    const L = (n) => A.gH + n * A.floorH,
        gold = [1.0, 0.7, 0.36];
    const t72 = ins(lot, 24.5, 24.5, 20, 20),
        t80 = ins(lot, 27.5, 27.5, 23, 23);
    addCrownFlood(t72, L(72), L(80), gold, 2.4, 1.1);
    addCrownFlood(t80, L(80), L(85) + 1, gold, 2.4, 1.1);
    addCrownFlood(sq(cx, cz, 12, 9), yObs, yObs + 14.6, gold, 2.0, 1.1);
    addCrownFlood(
        sq(cx, cz, 12, 9),
        yObs + 1.5,
        yObs + 14.6,
        gold,
        0.9,
        6,
        1.2,
        1.75,
    );
    addCrownFlood(
        ins(lot, 21, 21, 17, 17),
        L(72) - 14,
        L(72) + 0.2,
        gold,
        0.3,
        -3.5,
    );
    addCrownFlood(
        sq(cx, cz, 8.2),
        yb,
        yb + 38,
        [1.0, 0.8, 0.52],
        0.4,
        7,
        1.2,
        1.4,
    );
    floodSpots(t72, L(72) + 0.4, 0xffc27a, 4);
    floodSpots(t80, L(80) + 0.4, 0xffc27a, 4);
}

function floodSpots(b, y, color, intensity) {
    const cx = (b.x0 + b.x1) / 2,
        cz = (b.z0 + b.z1) / 2;
    for (const [px, pz, nx, nz] of [
        [cx, b.z0 - 2.8, 0, 1],
        [cx, b.z1 + 2.8, 0, -1],
        [b.x0 - 2.8, cz, 1, 0],
        [b.x1 + 2.8, cz, -1, 0],
    ])
        cityLights.add({
            type: "spot",
            pos: [px, y, pz],
            dir: [nx * 0.12, 1, nz * 0.12],
            angle: 0.7,
            penumbra: 0.7,
            color,
            intensity,
            range: 34,
            radius: 1.2,
            volume: 0,
        });
}
export function heroTowerReserves() {
    const R = [];

    R.push({
        name: "empire",
        x0: 146,
        x1: 234,
        z0: 240,
        z1: 320,
        seed: 3401,
        arch: () => ({
            type: "deco",
            style: STYLE.DECO,
            layer: LAYER.LIME,
            base: LAYER.GRANITE,
            floorH: 3.9,
            bayW: 1.75,
            winW: 0.72,
            winH: 0.8,
            gH: 7.0,
            height: 340,
            depth: 0.34,
            margin: 1.0,
            tint: [0.86, 0.85, 0.82],
            cornice: false,
            waterTower: false,
            lintel: 0,
            seed: 34.1,

            shape: (lot, A, P) => {
                const L = (n) => A.gH + n * A.floorH;
                const Pw = { ...P, tint: [0.78, 0.775, 0.76] };
                const out = [
                    { ...lot, y0: 0, y1: L(5), p: P, parapet: 1.3, roof: true },
                    {
                        ...ins(lot, 9, 9, 7, 7),
                        y0: L(5),
                        y1: L(20),
                        p: Pw,
                        parapet: 1.2,
                        roof: true,
                        sides: { ...UP },
                    },
                    {
                        ...ins(lot, 15, 15, 12, 12),
                        y0: L(20),
                        y1: L(29),
                        p: P,
                        parapet: 1.2,
                        roof: true,
                        sides: { ...UP },
                    },
                    ...cross(ins(lot, 21, 21, 17, 17), 5.5, L(29), L(72), P, {
                        roof: true,
                    }).map((m, i) => (i ? { ...m, p: Pw } : m)),
                    ...cross(ins(lot, 24.5, 24.5, 20, 20), 4, L(72), L(80), P, {
                        roof: true,
                    }),
                    ...cross(ins(lot, 27.5, 27.5, 23, 23), 3, L(80), L(85), P),
                ];

                const s = ins(lot, 21, 21, 17, 17),
                    cx = (lot.x0 + lot.x1) / 2,
                    cz = (lot.z0 + lot.z1) / 2,
                    hb = 7.5,
                    pr = 1.4;
                out.push({
                    x0: cx - hb,
                    x1: cx + hb,
                    z0: s.z0 - pr,
                    z1: s.z0,
                    y0: L(29),
                    y1: L(72) - 2 * A.floorH,
                    p: P,
                    parapet: 0,
                    roof: false,
                    sides: { ...UP, pz: "party" },
                });
                out.push({
                    x0: cx - hb,
                    x1: cx + hb,
                    z0: s.z1,
                    z1: s.z1 + pr,
                    y0: L(29),
                    y1: L(72) - 2 * A.floorH,
                    p: P,
                    parapet: 0,
                    roof: false,
                    sides: { ...UP, nz: "party" },
                });
                out.push({
                    x0: s.x0 - pr,
                    x1: s.x0,
                    z0: cz - hb,
                    z1: cz + hb,
                    y0: L(29),
                    y1: L(72) - 2 * A.floorH,
                    p: P,
                    parapet: 0,
                    roof: false,
                    sides: { ...UP, px: "party" },
                });
                out.push({
                    x0: s.x1,
                    x1: s.x1 + pr,
                    z0: cz - hb,
                    z1: cz + hb,
                    y0: L(29),
                    y1: L(72) - 2 * A.floorH,
                    p: P,
                    parapet: 0,
                    roof: false,
                    sides: { ...UP, nx: "party" },
                });
                return out;
            },
        }),
        extra(lot, bld, { S, Z, tile }) {
            const top = bld.masses.reduce(
                (a, m) => (m.y1 > a.y1 ? m : a),
                bld.masses[0],
            );
            const cx = (lot.x0 + lot.x1) / 2,
                cz = (lot.z0 + lot.z1) / 2;
            const y0 = top.y1;

            for (const m of bld.masses) {
                if (m.y0 < 0.1) continue;
                const ft = m.sides || {},
                    p = m.p,
                    top = m.y1 + (m.parapet || 0) - 0.12,
                    rp = {
                        ...p,
                        style: STYLE.BLANK,
                        tint: p.tint.map((c) => c * 1.06),
                    };
                for (const s of ["nz", "pz", "nx", "px"]) {
                    if (ft[s] === "party") continue;
                    const alongX = s === "nz" || s === "pz",
                        W = alongX ? m.x1 - m.x0 : m.z1 - m.z0,
                        a0 = alongX ? m.x0 : m.z0;
                    const usable = W - 2 * p.margin,
                        nb = Math.max(1, Math.floor(usable / p.bayW + 0.5)),
                        bw = usable / nb;
                    for (let k = 0; k <= nb; k++) {
                        const maj = k % 4 === 0,
                            c = a0 + p.margin + k * bw,
                            hw = k === 0 || k === nb ? 0.4 : maj ? 0.4 : 0.24,
                            d = maj ? 0.55 : 0.3;
                        let bx;
                        if (s === "nz") bx = [c - hw, m.z0 - d, c + hw, m.z0];
                        else if (s === "pz")
                            bx = [c - hw, m.z1, c + hw, m.z1 + d];
                        else if (s === "nx")
                            bx = [m.x0 - d, c - hw, m.x0, c + hw];
                        else bx = [m.x1, c - hw, m.x1 + d, c + hw];
                        const px = (bx[0] + bx[2]) / 2,
                            pz = (bx[1] + bx[3]) / 2;
                        if (
                            bld.masses.some(
                                (o) =>
                                    o !== m &&
                                    o.y1 > m.y0 + 1 &&
                                    o.y0 < top - 1 &&
                                    px > o.x0 - 0.05 &&
                                    px < o.x1 + 0.05 &&
                                    pz > o.z0 - 0.05 &&
                                    pz < o.z1 + 0.05,
                            )
                        )
                            continue;
                        lmBox(
                            tile,
                            S,
                            Z,
                            bx[0],
                            m.y0 + 0.2,
                            bx[1],
                            bx[2],
                            top,
                            bx[3],
                            rp,
                            { zip: false, lod: false },
                        );
                    }
                }
            }

            {
                const FAC = { nz: null, pz: null, nx: null, px: null },
                    A0 = bld.A;
                for (const m of bld.masses) {
                    if (m.y0 < 0.1 || m.x1 - m.x0 < 2.5 || m.z1 - m.z0 < 2.5)
                        continue;
                    const ft = m.sides || {},
                        par = m.parapet || 0,
                        topY = m.y1 + par,
                        o = 0.7,
                        lh = 0.5;
                    const ledge = par < 0.1,
                        ext = (s) => (ft[s] === "party" ? 0 : o);
                    const lp = {
                        ...m.p,
                        style: STYLE.BLANK,
                        tint: [0.97, 0.95, 0.9],
                        topY: m.y1,
                        baseY: m.y1 - lh,
                    };
                    const yUnder = ledge ? m.y1 - lh : topY - 1.4;
                    for (const s of ["nz", "pz", "nx", "px"]) {
                        if (ft[s] === "party") continue;
                        if (ledge) {
                            let b;
                            if (s === "nz")
                                b = [
                                    m.x0 - ext("nx"),
                                    m.z0 - o,
                                    m.x1 + ext("px"),
                                    m.z0,
                                ];
                            else if (s === "pz")
                                b = [
                                    m.x0 - ext("nx"),
                                    m.z1,
                                    m.x1 + ext("px"),
                                    m.z1 + o,
                                ];
                            else if (s === "nx")
                                b = [m.x0 - o, m.z0, m.x0, m.z1];
                            else b = [m.x1, m.z0, m.x1 + o, m.z1];
                            const hide =
                                s === "nx" || s === "px"
                                    ? { nz: null, pz: null }
                                    : {};
                            tile.fac.box(
                                b[0],
                                m.y1 - lh,
                                b[1],
                                b[2],
                                m.y1,
                                b[3],
                                lp,
                                hide,
                                true,
                                true,
                            );
                            tile.lod.box(
                                b[0],
                                m.y1 - lh,
                                b[1],
                                b[2],
                                m.y1,
                                b[3],
                                lp,
                                hide,
                                true,
                                false,
                            );
                            S.box(
                                b[0],
                                m.y1 - lh,
                                b[1],
                                b[2],
                                m.y1,
                                b[3],
                                "ledge",
                            );
                        }
                        const e = 0.012,
                            sp = (k, _y0, _y1) => ({
                                ...m.p,
                                topY: topY,
                                tint: m.p.tint.map((c) => c * k),
                            });
                        const strip = (y0, y1, k) => {
                            if (y1 - y0 < 0.3) return;
                            let b;
                            if (s === "nz") b = [m.x0, m.z0 - e, m.x1, m.z0];
                            else if (s === "pz")
                                b = [m.x0, m.z1, m.x1, m.z1 + e];
                            else if (s === "nx")
                                b = [m.x0 - e, m.z0, m.x0, m.z1];
                            else b = [m.x1, m.z0, m.x1 + e, m.z1];
                            tile.fac.box(
                                b[0],
                                y0,
                                b[1],
                                b[2],
                                y1,
                                b[3],
                                sp(k),
                                {
                                    ...FAC,
                                    [s]: {
                                        style: m.p.style ?? A0.style,
                                        gH: -A0.gH,
                                    },
                                },
                                false,
                                false,
                            );
                        };
                        strip(yUnder - 2.2, yUnder, 0.8);
                        strip(m.y0, Math.min(m.y0 + 3.0, yUnder - 2.2), 0.7);
                    }
                }
            }
            const stone = {
                floorH: 3.9,
                bayW: 1.75,
                winW: 0.44,
                winH: 0.66,
                layer: LAYER.LIME,
                base: LAYER.LIME,
                seed: 12,
                margin: 0.8,
                depth: 0.3,
                tint: [0.9, 0.88, 0.83],
            };
            const al = METAL([2.5, 2.52, 2.55], 7);

            for (const m of bld.masses) {
                if (Math.abs(m.y0 - (7 + 72 * 3.9)) > 0.1 || m.x1 - m.x0 < 20)
                    continue;
                for (const [px, pz] of [
                    [m.x0 - 2.2, m.z0 - 2.2],
                    [m.x1, m.z0 - 2.2],
                    [m.x0 - 2.2, m.z1],
                    [m.x1, m.z1],
                ])
                    lmBox(
                        tile,
                        S,
                        Z,
                        px,
                        m.y0,
                        pz,
                        px + 2.2,
                        m.y0 + 7.8,
                        pz + 2.2,
                        stone,
                        { style: STYLE.BLANK, zip: false },
                    );
                break;
            }

            lmBox(
                tile,
                S,
                Z,
                cx - 12,
                y0,
                cz - 9,
                cx + 12,
                y0 + 7.8,
                cz + 9,
                stone,
                { style: STYLE.DECO },
            );
            lmBox(
                tile,
                S,
                Z,
                cx - 12,
                y0 + 7.8,
                cz - 9,
                cx + 12,
                y0 + 9.0,
                cz - 8.6,
                stone,
                { zip: false },
            );
            lmBox(
                tile,
                S,
                Z,
                cx - 12,
                y0 + 7.8,
                cz + 8.6,
                cx + 12,
                y0 + 9.0,
                cz + 9,
                stone,
                { zip: false },
            );
            lmBox(
                tile,
                S,
                Z,
                cx - 12,
                y0 + 7.8,
                cz - 8.6,
                cx - 11.6,
                y0 + 9.0,
                cz + 8.6,
                stone,
                { zip: false },
            );
            lmBox(
                tile,
                S,
                Z,
                cx + 11.6,
                y0 + 7.8,
                cz - 8.6,
                cx + 12,
                y0 + 9.0,
                cz + 8.6,
                stone,
                { zip: false },
            );
            lmBox(
                tile,
                S,
                Z,
                cx - 8,
                y0 + 7.8,
                cz - 8,
                cx + 8,
                y0 + 14.5,
                cz + 8,
                stone,
                { style: STYLE.DECO },
            );
            const yb = y0 + 14.5;

            lmCyl(tile, S, Z, cx, cz, 6.2, yb, yb + 4, stone, {
                n: 12,
                zipTop: false,
            });
            lmCyl(tile, S, Z, cx, cz, 5.2, yb + 4, yb + 34, al, {
                n: 12,
                style: STYLE.DECO,
                zipTop: false,
            });
            const fin = { ...stone, tint: [0.95, 0.93, 0.88] };
            for (const [a, b, c, d, h] of [
                [5.0, 7.8, -0.7, 0.7, 26],
                [-7.8, -5.0, -0.7, 0.7, 26],
                [4.4, 7.0, -2.4, -1.4, 20],
                [4.4, 7.0, 1.4, 2.4, 20],
                [-7.0, -4.4, -2.4, -1.4, 20],
                [-7.0, -4.4, 1.4, 2.4, 20],
            ]) {
                lmBox(
                    tile,
                    S,
                    Z,
                    cx + a,
                    yb + 4,
                    cz + c,
                    cx + b,
                    yb + 4 + h,
                    cz + d,
                    fin,
                    { zip: false },
                );
                lmBox(
                    tile,
                    S,
                    Z,
                    cx + c,
                    yb + 4,
                    cz + a,
                    cx + d,
                    yb + 4 + h,
                    cz + b,
                    fin,
                    { zip: false },
                );
            }
            lmCyl(tile, S, Z, cx, cz, 4.2, yb + 34, yb + 38, stone, {
                n: 12,
                zipTop: false,
            });
            lmCyl(tile, S, Z, cx, cz, 3.6, yb + 38, yb + 44, al, {
                n: 12,
                style: STYLE.CURTAIN,
                zipTop: false,
            });
            lmCyl(
                tile,
                S,
                Z,
                cx,
                cz,
                3.6,
                yb + 44,
                yb + 49,
                METAL([2.0, 2.02, 2.05]),
                { n: 12, r1: 1.3, zipTop: false },
            );
            lmCyl(
                tile,
                S,
                Z,
                cx,
                cz,
                1.1,
                yb + 49,
                yb + 60,
                METAL([1.8, 1.8, 1.85]),
                { n: 8, r1: 0.8, zipTop: false },
            );
            lmCyl(
                tile,
                S,
                Z,
                cx,
                cz,
                0.7,
                yb + 60,
                yb + 106,
                METAL([1.6, 1.6, 1.65]),
                { n: 6, r1: 0.18 },
            );
            esbFloods(lot, bld.A, cx, cz, y0, yb);
        },
    });

    R.push({
        name: "chrysler",
        x0: 484,
        x1: 540,
        z0: -160,
        z1: -80,
        seed: 4202,
        arch: () => ({
            type: "deco",
            style: STYLE.DECO,
            layer: LAYER.WHITE,
            base: LAYER.GRANITE,
            floorH: 3.8,
            bayW: 1.6,
            winW: 0.5,
            winH: 0.62,
            gH: 6.5,
            height: 240,
            depth: 0.3,
            margin: 0.8,
            tint: [0.9, 0.89, 0.87],
            cornice: false,
            waterTower: false,
            seed: 42.2,
            shape: (lot, A, P) => {
                const L = (n) => A.gH + n * A.floorH;
                const cx = (lot.x0 + lot.x1) / 2,
                    cz = (lot.z0 + lot.z1) / 2;
                return [
                    { ...lot, y0: 0, y1: L(4), p: P, parapet: 1.1, roof: true },
                    {
                        ...ins(lot, 4, 4, 6, 6),
                        y0: L(4),
                        y1: L(16),
                        p: P,
                        parapet: 1.1,
                        roof: true,
                        sides: { ...UP },
                    },
                    {
                        ...ins(lot, 8, 8, 10, 10),
                        y0: L(16),
                        y1: L(24),
                        p: P,
                        parapet: 1.1,
                        roof: true,
                        sides: { ...UP },
                    },
                    ...cross(sq(cx, cz, 15), 2.5, L(24), L(58), P, {
                        roof: true,
                    }),
                    ...cross(sq(cx, cz, 13), 2, L(58), L(61), P),
                ];
            },
        }),
        extra(lot, bld, { S, Z, tile }) {
            const cx = (lot.x0 + lot.x1) / 2,
                cz = (lot.z0 + lot.z1) / 2;
            let y = bld.H,
                h = 12.5;
            const steel = { ...METAL([3.3, 3.32, 3.35], 9) };
            for (let i = 0; i < 7; i++) {
                lmBox(
                    tile,
                    S,
                    Z,
                    cx - h,
                    y,
                    cz - h,
                    cx + h,
                    y + 6.2,
                    cz + h,
                    steel,
                    { style: STYLE.ARCH, zip: i === 0 },
                );
                y += 6.2;
                h -= 1.5;
            }
            lmCyl(tile, S, Z, cx, cz, 2.2, y, y + 42, steel, { n: 8, r1: 0.1 });

            addCrownFlood(
                sq(cx, cz, 12.5),
                bld.H,
                y + 42,
                [0.86, 0.92, 1.0],
                0.55,
                16,
            );
            floodSpots(sq(cx, cz, 12.5), bld.H + 0.4, 0xdce8ff, 10);
        },
    });

    R.push({
        name: "park432",
        x0: 372,
        x1: 404,
        z0: -620,
        z1: -586,
        seed: 5701,
        arch: () => ({
            type: "postwar",
            style: STYLE.PUNCHED,
            layer: LAYER.WHITE,
            base: LAYER.CONCRETE,
            floorH: 4.7,
            bayW: 3.6,
            winW: 0.7,
            winH: 0.66,
            gH: 9,
            height: 425,
            margin: 0,
            depth: 0.45,
            tint: [1.05, 1.05, 1.03],
            cornice: false,
            waterTower: false,
            lintel: 0,
            resid: 1,
            glass: 2,
            seed: 57.01,
            shape: (lot, A, P) => {
                const cx = (lot.x0 + lot.x1) / 2,
                    cz = (lot.z0 + lot.z1) / 2;
                return [
                    {
                        ...sq(cx, cz, 14.5),
                        y0: 0,
                        y1: snapA(A, 425),
                        p: P,
                        parapet: 1.6,
                        sides: { ...UP },
                    },
                ];
            },
        }),
        extra(lot, bld, { S, Z, tile }) {
            const m = bld.masses[0],
                A = bld.A;
            const band = {
                floorH: A.floorH,
                bayW: 3.6,
                winW: 0.66,
                winH: 0.97,
                layer: LAYER.WHITE,
                base: LAYER.WHITE,
                seed: 3,
                margin: 0,
                depth: 0.9,
                tint: [1.0, 1.0, 0.98],
                resid: 0,
                glass: 2,
            };
            for (let f = 12; f * A.floorH + A.gH < m.y1 - 10; f += 12) {
                const y = A.gH + f * A.floorH;
                lmBox(
                    tile,
                    S,
                    Z,
                    m.x0 - 0.06,
                    y,
                    m.z0 - 0.06,
                    m.x1 + 0.06,
                    y + A.floorH,
                    m.z1 + 0.06,
                    band,
                    { style: STYLE.RIBBON, zip: false },
                );
            }

            const yc = m.y1 - 2 * A.floorH;
            lmBox(
                tile,
                S,
                Z,
                m.x0 - 0.06,
                yc,
                m.z0 - 0.06,
                m.x1 + 0.06,
                m.y1 - 0.6,
                m.z1 + 0.06,
                { ...band, floorH: 2 * A.floorH - 0.6, winH: 0.92 },
                { style: STYLE.RIBBON, zip: false },
            );
        },
    });

    R.push({
        name: "cptower",
        x0: 136,
        x1: 174,
        z0: -552,
        z1: -514,
        seed: 5702,
        arch: () => ({
            type: "glass",
            style: STYLE.CURTAIN,
            layer: LAYER.METAL,
            base: LAYER.GRANITE,
            floorH: 4.3,
            bayW: 1.5,
            winW: 0.97,
            winH: 0.8,
            gH: 9,
            height: 440,
            margin: 0,
            depth: 0.04,
            tint: [1, 1, 1],
            glass: 4,
            seed: 1.0,
            shape: (lot, A, P) => {
                const pp = {
                    ...P,
                    style: STYLE.PUNCHED,
                    layer: LAYER.LIME,
                    winW: 0.62,
                    winH: 0.66,
                    depth: 0.3,
                    margin: 1.0,
                    tint: [1, 0.98, 0.95],
                };

                const y1 = snapA(A, 30),
                    y2 = snapA(A, 300),
                    y3 = snapA(A, 370),
                    y4 = snapA(A, 425);
                return [
                    { ...lot, y0: 0, y1, p: pp, parapet: 1.0, roof: true },
                    ...cross(ins(lot, 3), 4, y1, y2, P, { roof: true }),
                    ...cross(ins(lot, 3, 10, 3, 3), 3, y2, y3, P, {
                        roof: true,
                    }),
                    ...cross(ins(lot, 3, 10, 10, 3), 3, y3, y4, P),
                ];
            },
        }),
        extra(lot, bld, { S, Z, tile }) {
            const yT = bld.H,
                tops = bld.masses.filter((m) => Math.abs(m.y1 - yT) < 0.1);
            const top = {
                x0: Math.min(...tops.map((m) => m.x0)),
                x1: Math.max(...tops.map((m) => m.x1)),
                z0: Math.min(...tops.map((m) => m.z0)),
                z1: Math.max(...tops.map((m) => m.z1)),
            };
            const A = bld.A,
                gp = {
                    floorH: A.floorH,
                    bayW: A.bayW,
                    winW: A.winW,
                    winH: A.winH,
                    layer: LAYER.METAL,
                    base: LAYER.METAL,
                    seed: 1.0,
                    margin: 0,
                    depth: 0.04,
                    tint: [1, 1, 1],
                    glass: 4,
                };

            let t = top,
                y = yT;
            for (let i = 0; i < 2; i++) {
                t = ins(t, 2.2);
                lmBox(
                    tile,
                    S,
                    Z,
                    t.x0,
                    y,
                    t.z0,
                    t.x1,
                    y + 2 * A.floorH,
                    t.z1,
                    gp,
                    { style: STYLE.CURTAIN, zip: i === 1 },
                );
                y += 2 * A.floorH;
            }

            t = ins(t, 2.2);
            lmBox(tile, S, Z, t.x0, y, t.z0, t.x1, y + 2 * A.floorH, t.z1, gp, {
                style: STYLE.CURTAIN,
                zip: false,
            });
            y += 2 * A.floorH;
            const louv = {
                floorH: 0.4,
                bayW: 1.2,
                winW: 1,
                winH: 0.2,
                layer: LAYER.CONCRETE,
                base: LAYER.CONCRETE,
                seed: 13,
                margin: 0,
                depth: 0.05,
                tint: [1.08, 1.08, 1.1],
                glass: 2,
            };
            lmBox(
                tile,
                S,
                Z,
                t.x0 - 0.3,
                y,
                t.z0 - 0.3,
                t.x1 + 0.3,
                y + 9,
                t.z1 + 0.3,
                louv,
                { style: STYLE.RIBBON, zip: false },
            );
            lmBox(
                tile,
                S,
                Z,
                t.x0 - 0.8,
                y + 9,
                t.z0 - 0.8,
                t.x1 + 0.8,
                y + 10.2,
                t.z1 + 0.8,
                METAL([2.6, 2.62, 2.66], 9),
            );
            const pc = ins(t, 2.5),
                ax = (t.x0 + t.x1) / 2,
                az = (t.z0 + t.z1) / 2;
            let ya = y + 10.2;
            if (pc.x1 - pc.x0 > 4 && pc.z1 - pc.z0 > 4) {
                lmBox(
                    tile,
                    S,
                    Z,
                    pc.x0,
                    ya,
                    pc.z0,
                    pc.x1,
                    ya + 4.5,
                    pc.z1,
                    { ...louv, tint: [0.92, 0.93, 0.95] },
                    { style: STYLE.RIBBON },
                );
                ya += 4.5;
            }
            lmCyl(
                tile,
                S,
                Z,
                ax,
                az,
                1.6,
                ya,
                ya + 3.5,
                METAL([2.3, 2.3, 2.35]),
                { n: 8, zipTop: false },
            );
            lmCyl(
                tile,
                S,
                Z,
                ax,
                az,
                0.9,
                ya + 3.5,
                ya + 11.5,
                METAL([2.5, 2.5, 2.55]),
                { n: 8, r1: 0.7, zipTop: false },
            );
            lmCyl(
                tile,
                S,
                Z,
                ax,
                az,
                1.3,
                ya + 7.5,
                ya + 7.9,
                METAL([2.6, 2.6, 2.65]),
                { n: 8, zipTop: false },
            );
            lmCyl(
                tile,
                S,
                Z,
                ax,
                az,
                0.45,
                ya + 11.5,
                ya + 19.5,
                METAL([2.6, 2.6, 2.65]),
                { n: 6, r1: 0.12 },
            );
        },
    });

    R.push({
        name: "one57",
        x0: 40,
        x1: 80,
        z0: -552,
        z1: -512,
        seed: 5703,
        arch: () => ({
            type: "glass",
            style: STYLE.CURTAIN,
            layer: LAYER.METAL,
            base: LAYER.GRANITE,
            floorH: 4.0,
            bayW: 1.5,
            winW: 0.97,
            winH: 0.72,
            gH: 8,
            height: 306,
            margin: 0,
            depth: 0.04,
            tint: [0.95, 0.98, 1.02],
            glass: 1,
            seed: 2.0,
            shape: (lot, A, P) => {
                const m = ins(lot, 2);
                const out = [
                    {
                        ...lot,
                        y0: 0,
                        y1: snapA(A, 24),
                        p: {
                            ...P,
                            style: STYLE.PUNCHED,
                            layer: LAYER.GRANITE,
                            winW: 0.62,
                            winH: 0.66,
                            depth: 0.3,
                            margin: 1.0,
                        },
                        parapet: 1.0,
                        roof: true,
                    },
                ];
                let y = snapA(A, 24);
                const steps = [200, 226, 250, 270, 290, 306];
                steps.forEach((h, i) => {
                    const y1 = snapA(A, h);
                    out.push({
                        ...m,
                        x0: m.x0 + i * 5.5,
                        y0: y,
                        y1,
                        p: P,
                        parapet: 0,
                        roof: true,
                        sides: { ...UP },
                    });
                    y = y1;
                });
                return out;
            },
        }),
    });

    R.push({
        name: "wtc1",
        x0: -168,
        x1: -110,
        z0: 2731,
        z1: 2789,
        seed: 1776,
        arch: () => ({
            type: "glass",
            style: STYLE.CURTAIN,
            layer: LAYER.METAL,
            base: LAYER.GRANITE,
            floorH: 4.2,
            bayW: 1.5,
            winW: 0.97,
            winH: 0.84,
            gH: 12,
            height: 430,
            margin: 0,
            depth: 0.04,
            tint: [0.97, 1.0, 1.05],
            glass: 4,
            seed: 3.0,
            shape: (lot, A, P) => {
                const cx = (lot.x0 + lot.x1) / 2,
                    cz = (lot.z0 + lot.z1) / 2,
                    a = Math.min(lot.x1 - lot.x0, lot.z1 - lot.z0) / 2;
                const base = snapA(A, 57);
                const bp = {
                    ...P,
                    style: STYLE.RIBBON,
                    layer: LAYER.METAL,
                    winW: 0.22,
                    winH: 0.94,
                    tint: [1.55, 1.57, 1.6],
                };
                const out = [
                    {
                        ...sq(cx, cz, a),
                        y0: 0,
                        y1: base,
                        p: bp,
                        parapet: 0,
                        roof: false,
                        sides: { ...UP },
                    },
                ];
                const N = 14,
                    Rt = a * 1.03;
                let y = base;
                for (let i = 0; i < N; i++) {
                    const y1 = snapA(A, base + ((430 - base) * (i + 1)) / N);
                    if (y1 <= y) continue;
                    const tm = (i + 0.5) / N;
                    out.push(
                        ...chamferPlan(
                            cx,
                            cz,
                            a,
                            2 * a + (Rt - 2 * a) * tm,
                            y,
                            y1,
                            P,
                        ),
                    );
                    y = y1;
                }
                return out;
            },
        }),
        extra(lot, bld, { S, Z, tile }) {
            const cx = (lot.x0 + lot.x1) / 2,
                cz = (lot.z0 + lot.z1) / 2,
                y = bld.H;
            lmCyl(tile, S, Z, cx, cz, 9, y, y + 4.5, METAL([1.8, 1.85, 1.9]), {
                n: 16,
                style: STYLE.RIBBON,
                zipTop: false,
            });
            lmCyl(
                tile,
                S,
                Z,
                cx,
                cz,
                3.2,
                y + 4.5,
                y + 9,
                METAL([2.0, 2.0, 2.05]),
                { n: 12, zipTop: false },
            );
            lmCyl(
                tile,
                S,
                Z,
                cx,
                cz,
                2.1,
                y + 9,
                y + 140,
                METAL([2.7, 2.72, 2.75]),
                { n: 8, r1: 0.35 },
            );
            addCrownFlood(
                sq(cx, cz, 9.5),
                y,
                y + 140,
                [0.88, 0.93, 1.0],
                0.7,
                45,
            );
        },
    });

    R.push({
        name: "bluehq",
        x0: -234,
        x1: -176,
        z0: -71,
        z1: -9,
        seed: 811,
        arch: () => ({
            type: "glass",
            style: STYLE.CURTAIN,
            layer: LAYER.METAL,
            base: LAYER.GRANITE,
            floorH: 4.0,
            bayW: 1.5,
            winW: 0.97,
            winH: 0.7,
            gH: 8,
            height: 300,
            margin: 0,
            depth: 0.04,
            tint: [0.9, 0.95, 1.05],
            glass: 0,
            seed: 1.94,
            cornice: false,
            waterTower: false,
            shape: (lot, A, P) => {
                const pp = {
                    ...P,
                    style: STYLE.PUNCHED,
                    layer: LAYER.GRANITE,
                    winW: 0.6,
                    winH: 0.62,
                    depth: 0.32,
                    margin: 1.0,
                    tint: [0.62, 0.63, 0.66],
                };
                const y1 = snapA(A, 30),
                    y2 = snapA(A, 252),
                    y3 = snapA(A, 284),
                    y4 = snapA(A, 300);
                return [
                    { ...lot, y0: 0, y1, p: pp, parapet: 1.2, roof: true },
                    ...cross(ins(lot, 5, 5, 6, 6), 5, y1, y2, P, {
                        roof: true,
                    }),
                    ...cross(ins(lot, 5, 15, 6, 6), 4, y2, y3, P, {
                        roof: true,
                    }),
                    {
                        ...ins(lot, 9, 19, 10, 10),
                        y0: y3,
                        y1: y4,
                        p: P,
                        parapet: 0,
                        sides: { ...UP },
                        spireR: 6,
                    },
                ];
            },
        }),
        extra(lot, bld, { S, Z, tile }) {
            const _A = bld.A,
                gold = METAL([2.9, 2.2, 0.85], 21),
                s = ins(lot, 5, 5, 6, 6),
                c = 5;
            const yb = bld.masses[0].y1,
                sh = bld.masses.find((m) => m.y0 === yb && m.x0 === s.x0 + c);
            const up = bld.masses.find((m) => Math.abs(m.y0 - sh.y1) < 0.01),
                yT = (up ? up.y1 : sh.y1) + 2,
                d = 0.45,
                hw = 1.3;

            for (const f of [1 / 3, 2 / 3]) {
                const x = sh.x0 + (sh.x1 - sh.x0) * f;
                lmBox(
                    tile,
                    S,
                    Z,
                    x - hw,
                    yb,
                    sh.z0 - d,
                    x + hw,
                    yT,
                    sh.z0,
                    gold,
                    { zip: false },
                );
                lmBox(
                    tile,
                    S,
                    Z,
                    x - hw,
                    yb,
                    sh.z1,
                    x + hw,
                    yT,
                    sh.z1 + d,
                    gold,
                    { zip: false },
                );
            }
            const zc = (s.z0 + s.z1) / 2;
            lmBox(tile, S, Z, s.x0 - d, yb, zc - hw, s.x0, yT, zc + hw, gold, {
                zip: false,
            });

            const wing = bld.masses.find(
                (m) => m.y0 === yb && m.x0 === s.x1 - c,
            );
            lmBox(
                tile,
                S,
                Z,
                s.x1,
                yb,
                zc - hw,
                s.x1 + d,
                wing.y1 + 3,
                zc + hw,
                gold,
                { zip: false },
            );

            const tm = bld.masses[bld.masses.length - 1],
                y = tm.y1;
            const louv = {
                floorH: 0.42,
                bayW: 1.2,
                winW: 1,
                winH: 0.3,
                layer: LAYER.METAL,
                base: LAYER.METAL,
                seed: 7,
                margin: 0,
                depth: 0.05,
                tint: [2.3, 2.34, 2.4],
                glass: 2,
            };
            lmBox(
                tile,
                S,
                Z,
                tm.x0 - 0.4,
                y,
                tm.z0 - 0.4,
                tm.x1 + 0.4,
                y + 7,
                tm.z1 + 0.4,
                louv,
                { style: STYLE.RIBBON, zip: false },
            );
            lmBox(
                tile,
                S,
                Z,
                tm.x0 - 0.7,
                y + 7,
                tm.z0 - 0.7,
                tm.x1 + 0.7,
                y + 8,
                tm.z1 + 0.7,
                METAL([2.6, 2.62, 2.65], 9),
            );
            const mx = (tm.x0 + tm.x1) / 2,
                mz = (tm.z0 + tm.z1) / 2,
                ym = y + 8;
            lmCyl(
                tile,
                S,
                Z,
                mx,
                mz,
                3.2,
                ym,
                ym + 5,
                METAL([2.2, 2.22, 2.25]),
                { n: 12, zipTop: false },
            );
            lmCyl(
                tile,
                S,
                Z,
                mx,
                mz,
                1.5,
                ym + 5,
                ym + 30,
                METAL([2.4, 2.4, 2.45]),
                { n: 8, r1: 0.9, zipTop: false },
            );
            for (const f of [0.3, 0.65])
                lmCyl(
                    tile,
                    S,
                    Z,
                    mx,
                    mz,
                    2.2 - f,
                    ym + 5 + 25 * f,
                    ym + 5.6 + 25 * f,
                    METAL([2.6, 2.6, 2.65]),
                    { n: 8, zipTop: false },
                );
            lmCyl(
                tile,
                S,
                Z,
                mx,
                mz,
                0.9,
                ym + 30,
                ym + 46,
                METAL([2.7, 2.7, 2.75]),
                { n: 6, r1: 0.15 },
            );
            addCrownFlood(
                { x0: tm.x0 - 1, z0: tm.z0 - 1, x1: tm.x1 + 1, z1: tm.z1 + 1 },
                y - 3,
                ym + 46,
                [0.85, 0.92, 1.0],
                0.6,
                14,
            );
            for (const [a, b] of [
                [-1, -1],
                [1, -1],
                [-1, 1],
                [1, 1],
            ])
                lmBox(
                    tile,
                    S,
                    Z,
                    mx + a * 4.2 - 0.3,
                    ym,
                    mz + b * 4.2 - 0.3,
                    mx + a * 4.2 + 0.3,
                    ym + 9,
                    mz + b * 4.2 + 0.3,
                    METAL([2.2, 2.2, 2.25]),
                    { zip: false },
                );
        },
    });

    R.push({
        name: "vanderbilt",
        x0: 336,
        x1: 384,
        z0: -151,
        z1: -89,
        seed: 4203,
        arch: () => ({
            type: "glass",
            style: STYLE.CURTAIN,
            layer: LAYER.METAL,
            base: LAYER.LIME,
            floorH: 4.1,
            bayW: 1.6,
            winW: 0.97,
            winH: 0.74,
            gH: 10,
            height: 330,
            margin: 0,
            depth: 0.04,
            tint: [1.0, 1.0, 1.02],
            glass: 4,
            seed: 1.05,
            cornice: false,
            waterTower: false,
            shape: (lot, A, P) => {
                const pp = {
                    ...P,
                    style: STYLE.PUNCHED,
                    layer: LAYER.LIME,
                    winW: 0.66,
                    winH: 0.7,
                    depth: 0.32,
                    margin: 1.0,
                    tint: [0.97, 0.95, 0.9],
                };
                const cx = (lot.x0 + lot.x1) / 2,
                    cz = (lot.z0 + lot.z1) / 2;
                const out = [
                    {
                        ...lot,
                        y0: 0,
                        y1: snapA(A, 26),
                        p: pp,
                        parapet: 1.1,
                        roof: true,
                    },
                ];
                const tiers = [
                    [112, 20, 26, 3],
                    [178, 18.5, 24, 5],
                    [238, 17, 22, 7],
                    [288, 15, 19, 8.5],
                    [330, 12.5, 15.5, 9],
                ];
                let y = snapA(A, 26);
                for (const [h, hx, hz, ch] of tiers) {
                    const y1 = snapA(A, h);

                    const boxes = chamferPlan(
                        cx,
                        cz,
                        hx,
                        2 * hx - ch,
                        y,
                        y1,
                        P,
                    );
                    const k = hz / hx;
                    for (const b of boxes)
                        out.push({
                            ...b,
                            z0: cz + (b.z0 - cz) * k,
                            z1: cz + (b.z1 - cz) * k,
                            roof: true,
                            ...(h === 330 ? { spireR: 12 } : {}),
                        });
                    y = y1;
                }
                return out;
            },
        }),
        extra(lot, bld, { S, Z, tile }) {
            const cx = (lot.x0 + lot.x1) / 2,
                cz = (lot.z0 + lot.z1) / 2,
                y = bld.H,
                A = bld.A;
            const gp = {
                floorH: A.floorH,
                bayW: 1.6,
                winW: 0.97,
                winH: 0.74,
                layer: LAYER.METAL,
                base: LAYER.METAL,
                seed: 1.05,
                margin: 0,
                depth: 0.04,
                tint: [1, 1, 1.02],
                glass: 4,
            };
            lmBox(
                tile,
                S,
                Z,
                cx - 8,
                y,
                cz - 10,
                cx + 8,
                y + 3 * A.floorH,
                cz + 10,
                gp,
                { style: STYLE.CURTAIN },
            );
            const y2 = y + 3 * A.floorH;
            lmBox(
                tile,
                S,
                Z,
                cx - 8.4,
                y2,
                cz - 10.4,
                cx + 8.4,
                y2 + 1.2,
                cz + 10.4,
                METAL([2.6, 2.62, 2.65], 9),
                { zip: false },
            );
            lmBox(
                tile,
                S,
                Z,
                cx - 5,
                y2 + 1.2,
                cz - 6,
                cx + 5,
                y2 + 7,
                cz + 6,
                gp,
                { style: STYLE.CURTAIN },
            );
            lmCyl(
                tile,
                S,
                Z,
                cx,
                cz,
                1.8,
                y2 + 7,
                y2 + 12,
                METAL([2.4, 2.42, 2.45]),
                { n: 8, zipTop: false },
            );
            lmCyl(
                tile,
                S,
                Z,
                cx,
                cz,
                1.1,
                y2 + 12,
                y2 + 40,
                METAL([2.7, 2.72, 2.75]),
                { n: 8, r1: 0.2 },
            );
            addCrownFlood(
                { x0: cx - 9, z0: cz - 11, x1: cx + 9, z1: cz + 11 },
                y,
                y2 + 40,
                [0.9, 0.94, 1.0],
                0.5,
                18,
            );
        },
    });
    return R;
}
