// @ts-nocheck
/**
 * Generates building lots, architectures, and procedural building geometry.
 *
 * @module world-buildings
 * @version 1.0.0
 * @file src/world/buildings.ts
 * @since 0.0.1
 * @description Subdivides blocks, selects architectural variants, and emits building meshes, solids, and metadata into world tiles.
 */
import * as THREE from "three";
import {
    G,
    district,
    mulberry32,
    diagTrimRect,
    diagRectClear,
    diagLotPieces,
    clipPoly,
    polyArea,
    diagD,
    _VMAP,
    MAPS,
    streetsAt,
    addCurbCut,
    _DIAG_SEGS,
    WIDE_STREETS,
    WIDE_ST_SET,
} from "./layout.ts";
import { FacadeBuilder, STYLE, LAYER } from "./facade.ts";
import { MB, hexLin, M4 } from "./geom.ts";
import { Solids, OVERHANG, NOZIP } from "./collision.ts";
import { hash2, islands, ZFIX } from "./layout.ts";
import { ZipPoints } from "./zippoints.ts";
import { residentialArch, residentialSplit } from "./residential.ts";

export const TILE = 256;
const tkey = (x, z) => `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;

export const DP = {
    PAINT: 0,
    WOOD: 1,
    STEEL: 2,
    GLASS: 3,
    TAR: 4,
    CONC: 5,
    GALV: 6,
    CANVAS: 7,
    BRICK: 8,
    GRATE: 9,
    WIRE: 10,
};

const AWNING = [
    0x1f3d2b, 0x5a1a1f, 0x1a2540, 0x151515, 0x7a1616, 0x3b2e22, 0x2b4a4a,
    0x444444,
];
const ROOFS = [
    LAYER.ROOF,
    LAYER.ROOF_GRAVEL,
    LAYER.ROOF_MEMBRANE,
    LAYER.ROOF,
    LAYER.ROOF_MEMBRANE,
    LAYER.ROOF_PAVERS,
    LAYER.ROOF_GREEN,
];

const polyR = (r, n) => (r * (1 + Math.cos(Math.PI / n))) / 2;

function tintJitter(rnd, base, amt = 0.08) {
    const k = 1 + (rnd() - 0.5) * 2 * amt;
    return base.map((c) => c * k * (1 + (rnd() - 0.5) * amt * 0.5));
}

export function generateBuildings(blocks, seed = 1234, opts = {}) {
    const rnd = mulberry32(seed);
    const tiles = new Map();
    const ctx = {
        boxes: [],
        footprints: [],
        buildings: [],
        S: opts.solids ?? new Solids(),
        Z: opts.zips ?? new ZipPoints(),
    };
    const tile = (x, z) => {
        const k = tkey(x, z);
        let t = tiles.get(k);
        if (!t) {
            t = {
                fac: new FacadeBuilder(),
                lod: Object.assign(new FacadeBuilder(), {
                    noLights: true,
                }),
                det: new MB(),
                key: k,
                cx: (Math.floor(x / TILE) + 0.5) * TILE,
                cz: (Math.floor(z / TILE) + 0.5) * TILE,
            };
            tiles.set(k, t);
        }
        return t;
    };

    const diagLots = new Map();
    const placedMid = [];
    const excluded = (opts.exclude || []).map(() => null);
    const reserves = (opts.reserve || []).map((r) => ({ ...r, lot: null }));
    for (const b of blocks) {
        const bStart = ctx.buildings.length;
        const flat = b.diag?.length ? flatironPoly(b) : null;
        const halves = b.split
            ? [
                  { ...b, pz1: b.split },
                  { ...b, pz0: b.split },
              ]
            : [b];
        let lots = [];
        for (const h of halves) {
            const hl = subdivide(h, rnd);
            if (b.split) {
                for (const l of hl) {
                    if (
                        Math.abs(l.z1 - b.split) < 0.1 &&
                        l.sides.pz === "street"
                    )
                        l.sides.pz = "party";
                    if (
                        Math.abs(l.z0 - b.split) < 0.1 &&
                        l.sides.nz === "street"
                    )
                        l.sides.nz = "party";
                }
            }
            lots.push(...hl);
        }

        const mine = [];
        for (const R of reserves) {
            const x0 = Math.max(R.x0, b.px0),
                x1 = Math.min(R.x1, b.px1),
                z0 = Math.max(R.z0, b.pz0),
                z1 = Math.min(R.z1, b.pz1);
            if (x1 - x0 < 1 || z1 - z0 < 1) continue;
            const e = 0.2;
            const sides = {
                nx: Math.abs(x0 - b.px0) < e ? "street" : "party",
                px: Math.abs(x1 - b.px1) < e ? "street" : "party",
                nz: Math.abs(z0 - b.pz0) < e ? "street" : "party",
                pz: Math.abs(z1 - b.pz1) < e ? "street" : "party",
            };
            if (b.split && Math.abs(z0 - b.split) < e) sides.nz = "party";
            if (b.split && Math.abs(z1 - b.split) < e) sides.pz = "party";
            Object.assign(sides, R.sides || {});
            const lot = {
                x0,
                x1,
                z0,
                z1,
                sides,
                kind: "tower",
                cx: (x0 + x1) / 2,
                cz: (z0 + z1) / 2,
                reserved: true,
            };
            R.lot = lot;
            mine.push([R, lot]);
            const out = [];
            for (const l of lots) {
                if (!(
                    l.x1 > x0 + 0.01 &&
                    l.x0 < x1 - 0.01 &&
                    l.z1 > z0 + 0.01 &&
                    l.z0 < z1 - 0.01
                )) {
                    out.push(l);
                    continue;
                }
                const mk = (a0, a1, c0, c1, ov) => {
                    const n = {
                        ...l,
                        x0: a0,
                        x1: a1,
                        z0: c0,
                        z1: c1,
                        sides: { ...l.sides, ...ov },
                    };
                    n.cx = (a0 + a1) / 2;
                    n.cz = (c0 + c1) / 2;
                    if (a1 - a0 >= 6 && c1 - c0 >= 6) out.push(n);
                };
                const nf = R.trimFace ?? "party";
                if (l.z0 >= z0 - e && l.z1 <= z1 + e) {
                    mk(l.x0, x0, l.z0, l.z1, { px: nf });
                    mk(x1, l.x1, l.z0, l.z1, { nx: nf });
                } else if (l.x0 >= x0 - e && l.x1 <= x1 + e) {
                    mk(l.x0, l.x1, l.z0, z0, { pz: nf });
                    mk(l.x0, l.x1, z1, l.z1, { nz: nf });
                }
            }
            lots = out;
        }

        lots = lots.flatMap((l) => splitTowerLot(l, opts));
        const bv = blockVariety(b, lots, mine, opts, ctx, tile);
        for (const lot of lots) {
            let skip = false;
            (opts.exclude || []).forEach((e, i) => {
                if (
                    lot.x1 > e.x0 &&
                    lot.x0 < e.x1 &&
                    lot.z1 > e.z0 &&
                    lot.z0 < e.z1
                ) {
                    skip = true;
                    const u = excluded[i];
                    excluded[i] = u
                        ? {
                              x0: Math.min(u.x0, lot.x0),
                              z0: Math.min(u.z0, lot.z0),
                              x1: Math.max(u.x1, lot.x1),
                              z1: Math.max(u.z1, lot.z1),
                          }
                        : { x0: lot.x0, z0: lot.z0, x1: lot.x1, z1: lot.z1 };
                }
            });
            if (skip) continue;
            const lr = lot.subK
                ? mulberry32(
                      (Math.floor(lot.cx * 9.1) * 73856093) ^
                          (Math.floor(lot.cz * 6.7) * 19349663) ^
                          0x3c1d,
                  )
                : rnd;
            let arch = chooseArch(lot, b, lr);
            arch =
                residentialArch(
                    lot,
                    district(lot.cx, lot.cz),
                    mulberry32(
                        (Math.floor(lot.cx * 7.3) * 73856093) ^
                            (Math.floor(lot.cz * 5.1) * 19349663),
                    ),
                    arch,
                ) ?? arch;
            const f = (opts.force || []).find(
                (f) =>
                    f.x > lot.x0 &&
                    f.x < lot.x1 &&
                    f.z > lot.z0 &&
                    f.z < lot.z1,
            );
            if (f) arch = { ...arch, ...f.arch(lr, lot) };
            if (!f && arch.shape === undefined)
                arch.shape = pickShape(lot, arch, b, lr);
            if (!f) streetVary(lot, arch, placedMid);
            const er = mulberry32(Math.floor(lr() * 4294967296));

            const subs = f
                ? null
                : residentialSplit(lot, district(lot.cx, lot.cz));
            if (b.diag?.length && DIAG_R7) continue;
            if (b.diag?.length) {
                if (bv.open.has(lot)) continue;
                let db = diagLots.get(b);
                if (!db) diagLots.set(b, (db = []));
                for (const sl of subs ?? [lot]) {
                    const t = diagTrimRect(
                        b.diag,
                        sl.x0,
                        sl.z0,
                        sl.x1,
                        sl.z1,
                        8,
                    );
                    if (!t) continue;
                    if (
                        flat &&
                        t.x1 > flat.x0 &&
                        t.x0 < flat.x1 &&
                        t.z1 > flat.z0 &&
                        t.z0 < flat.z1
                    )
                        continue;
                    if (!t.trimmed && !subs) {
                        emitBuilding(lot, arch, b, er, tile, ctx);
                        db.push(lot);
                        continue;
                    }
                    const e = 0.01,
                        keep = !t.trimmed;
                    const sides = { ...sl.sides };
                    if (t.x0 > sl.x0 + e) sides.nx = "street";
                    if (t.x1 < sl.x1 - e) sides.px = "street";
                    if (t.z0 > sl.z0 + e) sides.nz = "street";
                    if (t.z1 < sl.z1 - e) sides.pz = "street";
                    const nl = {
                        ...sl,
                        x0: t.x0,
                        z0: t.z0,
                        x1: t.x1,
                        z1: t.z1,
                        sides,
                        cx: (t.x0 + t.x1) / 2,
                        cz: (t.z0 + t.z1) / 2,
                        diagTrim: t.trimmed,
                    };
                    const sr = keep
                        ? mulberry32(
                              (Math.floor(sl.cx * 8.3) * 73856093) ^
                                  (Math.floor(sl.cz * 6.1) * 19349663) ^
                                  0x5e71,
                          )
                        : mulberry32(
                              (Math.floor(nl.cx * 8.9) * 73856093) ^
                                  (Math.floor(nl.cz * 6.3) * 19349663) ^
                                  0x1a2b,
                          );
                    let sa = chooseArch(nl, b, sr);
                    sa =
                        residentialArch(
                            nl,
                            district(nl.cx, nl.cz),
                            mulberry32(
                                (Math.floor(nl.cx * 7.3) * 73856093) ^
                                    (Math.floor(nl.cz * 5.1) * 19349663),
                            ),
                            sa,
                        ) ?? sa;
                    if (sa.shape === undefined)
                        sa.shape = pickShape(nl, sa, b, sr);
                    streetVary(nl, sa, placedMid);
                    emitBuilding(
                        nl,
                        sa,
                        b,
                        mulberry32(Math.floor(sr() * 4294967296)),
                        tile,
                        ctx,
                    );
                    db.push(nl);
                }
                continue;
            }

            if (!subs) {
                const L = bvLot(bv, lot, lot);
                bvHeight(L, arch);
                bvEnsemble(ctx, b, lot, lot, L, arch);
                if (L) emitBuilding(L, arch, b, er, tile, ctx);
                continue;
            }
            if (bv.open.has(lot)) continue;
            for (const sl of subs) {
                const sr = mulberry32(
                    (Math.floor(sl.cx * 8.3) * 73856093) ^
                        (Math.floor(sl.cz * 6.1) * 19349663) ^
                        0x5e71,
                );
                let sa = chooseArch(sl, b, sr);
                sa =
                    residentialArch(
                        sl,
                        district(sl.cx, sl.cz),
                        mulberry32(
                            (Math.floor(sl.cx * 7.3) * 73856093) ^
                                (Math.floor(sl.cz * 5.1) * 19349663),
                        ),
                        sa,
                    ) ?? sa;
                if (sa.shape === undefined) sa.shape = pickShape(sl, sa, b, sr);
                streetVary(sl, sa, placedMid);
                const SL = bvLot(bv, lot, sl),
                    er2 = mulberry32(Math.floor(sr() * 4294967296));
                bvHeight(SL, sa);
                bvEnsemble(ctx, b, lot, sl, SL, sa);
                if (SL) emitBuilding(SL, sa, b, er2, tile, ctx);
            }
        }
        if (bv.square) diagLots.delete(b);
        else if (b.diag?.length && DIAG_R7) {
            diagPieceBuild(
                b,
                [...mine.map((m) => m[1]), ...(opts.exclude || [])],
                flat,
                ctx,
                tile,
                placedMid,
                diagLots,
            );
            diagFrontage(
                b,
                bStart,
                [...mine.map((m) => m[1]), ...(opts.exclude || [])],
                flat,
                ctx,
                tile,
                true,
            );
        } else if (b.diag?.length)
            diagInfill(
                b,
                diagLots.get(b) ?? [],
                [
                    ...mine.map((m) => m[1]),
                    ...(opts.exclude || []),
                    ...(flat ? [flat] : []),
                ],
                (nl) => {
                    const sr = mulberry32(
                        (Math.floor(nl.cx * 9.7) * 73856093) ^
                            (Math.floor(nl.cz * 4.3) * 19349663) ^
                            0x6b1f,
                    );
                    let sa = chooseArch(nl, b, sr);
                    sa =
                        residentialArch(
                            nl,
                            district(nl.cx, nl.cz),
                            mulberry32(
                                (Math.floor(nl.cx * 7.3) * 73856093) ^
                                    (Math.floor(nl.cz * 5.1) * 19349663),
                            ),
                            sa,
                        ) ?? sa;
                    if (sa.shape === undefined)
                        sa.shape = pickShape(nl, sa, b, sr);
                    streetVary(nl, sa, placedMid);
                    emitBuilding(
                        nl,
                        sa,
                        b,
                        mulberry32(Math.floor(sr() * 4294967296)),
                        tile,
                        ctx,
                    );
                    let db = diagLots.get(b);
                    if (!db) diagLots.set(b, (db = []));
                    db.push(nl);
                },
            );
        if (b.diag?.length && !bv.square && !DIAG_R7)
            diagFrontage(
                b,
                bStart,
                [...mine.map((m) => m[1]), ...(opts.exclude || [])],
                flat,
                ctx,
                tile,
            );
        for (const [R, lot] of mine) {
            if (R.custom) continue;
            const r2 = mulberry32(R.seed ?? 77);
            const arch = {
                ...chooseArch({ ...lot, kind: "tower" }, b, r2),
                ...R.arch(r2, lot),
            };
            const bld = emitBuilding(
                lot,
                arch,
                b,
                mulberry32(R.seed ?? 99),
                tile,
                ctx,
            );
            R.build = bld;
            R.extra?.(lot, bld, {
                S: ctx.S,
                Z: ctx.Z,
                tile: tile(lot.cx, lot.cz),
            });
        }
    }
    const vmapStats = vmapBuildings(ctx, tile, placedMid, opts, reserves);
    return {
        tiles,
        boxes: ctx.boxes,
        footprints: ctx.footprints,
        buildings: ctx.buildings,
        excluded,
        reserves,
        solids: ctx.S,
        zips: ctx.Z,
        tile,
        diagLots,
        vmap: vmapStats,
        frontPolys: ctx.frontPolys ?? [],
        polyBuildings: ctx.polyBuildings ?? [],
        frontage: { n: ctx.frontage || 0, solids: ctx.frontSolids || 0 },
        openSpaces: ctx.open ?? [],
        openTrees: ctx.openTrees ?? [],
        variety: ctx.bvStats,
        diagR7: ctx.diagR7,
    };
}

export const DIAG_SQUARES = [
    [0, 320],
    [250, 720],
    [430, 1040],
    [-250, -560],
    [-430, -880],
    [250, 1360],
];
const FLATIRON_PT = [288, 845];
function inConvex(P, x, z) {
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
const clipRectPoly = (P, r) =>
    [
        (x, _z) => x - r.x0,
        (x, _z) => r.x1 - x,
        (x, z) => z - r.z0,
        (x, z) => r.z1 - z,
    ].reduce((Q, f) => (Q.length >= 3 ? clipPoly(Q, f) : Q), P);
const bboxOf = (P) => ({
    x0: Math.min(...P.map((p) => p[0])),
    x1: Math.max(...P.map((p) => p[0])),
    z0: Math.min(...P.map((p) => p[1])),
    z1: Math.max(...P.map((p) => p[1])),
});
const centroid = (P) =>
    P.reduce(
        (a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length],
        [0, 0],
    );
function convexOverlap(Q, O) {
    let R = Q;
    const [ocx, ocz] = centroid(O);
    for (let i = 0; i < O.length && R.length >= 3; i++) {
        const p = O[i],
            q = O[(i + 1) % O.length];
        const sd = Math.sign(
            (q[0] - p[0]) * (ocz - p[1]) - (q[1] - p[1]) * (ocx - p[0]),
        );
        R = clipPoly(
            R,
            (x, z) =>
                sd * ((q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0])),
        );
    }
    return R.length >= 3 ? polyArea(R) : 0;
}
function flatironPoly(b) {
    const [fx, fz] = FLATIRON_PT;
    if (fx < b.px0 || fx > b.px1 || fz < b.pz0 || fz > b.pz1) return null;
    const P = diagLotPieces(b, 0).find((Q) => inConvex(Q, fx, fz));
    if (!P) return null;
    const e = 0.06;
    let Q = clipRectPoly(P, {
        x0: b.px0 + e,
        x1: b.px1 - e,
        z0: b.pz0 + e,
        z1: b.pz1 - e,
    });
    {
        const zN = Math.min(...Q.map((p) => p[1])),
            xW = Math.min(...Q.map((p) => p[0])),
            zS = Math.max(...Q.map((p) => p[1]));
        const F = Q.filter((p) => p[1] > zS - 0.01).reduce((a, p) =>
                p[0] > a[0] ? p : a,
            ),
            N = [xW + 2.4, zN];
        const f = (x, z) =>
                (F[0] - N[0]) * (z - N[1]) - (F[1] - N[1]) * (x - N[0]),
            sg = Math.sign(f(xW, zS)) || 1;
        const T = clipPoly(Q, (x, z) => sg * f(x, z));
        if (T.length >= 3 && polyArea(T) > 200) Q = T;
    }
    return Object.assign(bboxOf(Q), { poly: Q });
}

export function polySolids(S, P, y0, y1, kind = "wall", tol = 0.018) {
    const bb = bboxOf(P);
    let mx = 0,
        mz = 0;
    for (let i = 0; i < P.length; i++) {
        const [ax, az] = P[i],
            [bx, bz] = P[(i + 1) % P.length],
            L = Math.hypot(bx - ax, bz - az);
        if (L < 1e-6) continue;
        const ex = Math.abs(bx - ax) / L,
            ez = Math.abs(bz - az) / L;
        if (ex > 1e-3 && ez > 1e-3) {
            mx = Math.max(mx, ex);
            mz = Math.max(mz, ez);
        }
    }
    if (!mx) {
        S.box(bb.x0, y0, bb.z0, bb.x1, y1, bb.z1, kind);
        return 1;
    }
    const dz = (2 * tol) / mx,
        dx = (2 * tol) / mz;
    const alongZ = (bb.z1 - bb.z0) / dz <= (bb.x1 - bb.x0) / dx;
    const lo = alongZ ? bb.z0 : bb.x0,
        hi = alongZ ? bb.z1 : bb.x1,
        st = alongZ ? dz : dx;
    const n = Math.ceil((hi - lo) / st - 1e-9);
    const sect = (c) => {
        let a = Infinity,
            b2 = -Infinity;
        for (let i = 0; i < P.length; i++) {
            const p = P[i],
                q = P[(i + 1) % P.length],
                pc = alongZ ? p[1] : p[0],
                qc = alongZ ? q[1] : q[0];
            if ((pc - c) * (qc - c) > 0 || pc === qc) continue;
            const t = (c - pc) / (qc - pc),
                o = alongZ
                    ? p[0] + (q[0] - p[0]) * t
                    : p[1] + (q[1] - p[1]) * t;
            a = Math.min(a, o);
            b2 = Math.max(b2, o);
        }
        return a < b2 ? [a, b2] : null;
    };
    let run = null,
        cnt = 0;
    const flush = () => {
        if (!run) return;
        cnt++;
        if (alongZ) S.box(run.l, y0, run.a, run.r, y1, run.b, kind);
        else S.box(run.a, y0, run.l, run.b, y1, run.r, kind);
        run = null;
    };
    for (let i = 0; i < n; i++) {
        const a = lo + i * st,
            b2 = Math.min(hi, a + st),
            r = sect((a + b2) / 2);
        if (!r) {
            flush();
            continue;
        }
        if (
            run &&
            Math.abs(run.l - r[0]) < 1e-3 &&
            Math.abs(run.r - r[1]) < 1e-3
        )
            run.b = b2;
        else {
            flush();
            run = { a, b: b2, l: r[0], r: r[1] };
        }
    }
    flush();
    return cnt;
}

export function emitPrism(F, FL, P, H, pp, faceOf, bands, roofP) {
    const [cx, cz] = centroid(P);
    for (let i = 0; i < P.length; i++) {
        const [ax, az] = P[i],
            [bx, bz] = P[(i + 1) % P.length],
            W = Math.hypot(bx - ax, bz - az);
        if (W < 0.05) continue;
        let nx = (bz - az) / W,
            nz = -(bx - ax) / W;
        if (nx * ((ax + bx) / 2 - cx) + nz * ((az + bz) / 2 - cz) < 0) {
            nx = -nx;
            nz = -nz;
        }
        const T = [nz, 0, -nx],
            fwd = (bx - ax) * T[0] + (bz - az) * T[2] > 0,
            corner = fwd ? [ax, 0, az] : [bx, 0, bz];
        const f = faceOf(i);
        if (!f) continue;
        let y = 0;
        for (const [ya, yb, bp] of bands) {
            if (ya > y + 0.01)
                F.quad(
                    corner,
                    T,
                    W,
                    y,
                    ya,
                    [nx, 0, nz],
                    pp,
                    f.style,
                    y < 0.1 ? f.gH : -Math.abs(f.gH),
                );
            F.quad(corner, T, W, ya, yb, [nx, 0, nz], bp, STYLE.BLANK, 0);
            y = yb;
        }
        if (H > y + 0.01)
            F.quad(
                corner,
                T,
                W,
                y,
                H,
                [nx, 0, nz],
                pp,
                f.style,
                y < 0.1 ? f.gH : -Math.abs(f.gH),
            );
        FL.quad(corner, T, W, 0, H, [nx, 0, nz], pp, f.style, -Math.abs(f.gH));
    }
    F.fan(P, H, roofP);
    FL.fan(P, H, roofP);
    return [cx, cz];
}

function prismBuilding(ctx, tile, P, A, H, r, front, isFlat) {
    const T = tile(...centroid(P));
    const tint = A.tint ?? [1, 1, 1];
    const pp = {
        floorH: A.floorH,
        bayW: A.bayW,
        winW: A.winW,
        winH: A.winH,
        layer: A.layer,
        base: A.base,
        seed: A.seed,
        resid: A.resid,
        lintel: A.lintel,
        glass: A.glass,
        depth: A.depth,
        margin: A.margin,
        tint,
        baseY: 0,
        topY: H,
        tierY: 0,
    };
    const stone = {
        ...pp,
        style: STYLE.BLANK,
        layer: LAYER.LIME,
        tint: tint.map((c) => c * 0.97),
    };
    const bands = isFlat
        ? [
              [A.gH - 0.5, A.gH + 0.4, stone],
              [A.gH + 3 * A.floorH, A.gH + 3 * A.floorH + 0.6, stone],
              [H - 4.2, H, stone],
          ]
        : [[H - (r() < 0.5 ? 0.9 : 1.6), H, stone]];
    const rk = 0.62 + r() * 0.16;
    const roofP = {
        ...pp,
        style: STYLE.BLANK,
        layer: [LAYER.ROOF, LAYER.ROOF_GRAVEL, LAYER.ROOF_MEMBRANE][
            Math.floor(r() * 3)
        ],
        tint: [rk, rk, rk * 0.97],
    };
    const faceOf = (i) => {
        const ty = front(P[i], P[(i + 1) % P.length]);
        return ty === "party"
            ? { style: STYLE.PARTY, gH: 0 }
            : ty === "street"
              ? { style: A.style, gH: A.gH }
              : { style: A.style, gH: -A.gH };
    };
    const [cx, cz] = emitPrism(T.fac, T.lod, P, H, pp, faceOf, bands, roofP);

    (ctx.polyBuildings ??= []).push({
        poly: P,
        H,
        gH: A.gH,
        style: A.style,
        type: A.type,
        layer: A.layer,
        tint,
        A,
        isFlat: !!isFlat,
        faces: P.map((p, i) => front(p, P[(i + 1) % P.length])),
    });
    ctx.frontSolids =
        (ctx.frontSolids || 0) + polySolids(ctx.S, P, 0, H, "wall");
    for (let i = 0; i < P.length; i++) {
        const p = P[i],
            q = P[(i + 1) % P.length];
        if (front(p, q) === "party") continue;
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (L < 3) continue;
        let nx = (q[1] - p[1]) / L,
            nz = -(q[0] - p[0]) / L;
        if (nx * ((p[0] + q[0]) / 2 - cx) + nz * ((p[1] + q[1]) / 2 - cz) < 0) {
            nx = -nx;
            nz = -nz;
        }
        ctx.Z.edge(
            p[0] - nx * 0.12,
            p[1] - nz * 0.12,
            q[0] - nx * 0.12,
            q[1] - nz * 0.12,
            H,
            nx,
            nz,
        );
    }

    const s = isFlat ? 4.5 : 1.7,
        bx0 = cx - s,
        bx1 = cx + s,
        bz0 = cz - s,
        bz1 = cz + s;
    if (
        [
            [bx0, bz0],
            [bx1, bz0],
            [bx0, bz1],
            [bx1, bz1],
        ].every(([x, z]) => inConvex(P, x, z))
    ) {
        const bh = isFlat ? 5 : 2.8 + r() * 0.8;
        T.fac.box(
            bx0,
            H,
            bz0,
            bx1,
            H + bh,
            bz1,
            { ...stone, tint: [0.78, 0.76, 0.72] },
            {},
            true,
        );
        ctx.S.box(bx0, H, bz0, bx1, H + bh, bz1, "bulkhead");
    }
    {
        const hr = mulberry32(
            ((Math.floor(cx * 7.7) * 73856093) ^
                (Math.floor(cz * 5.3) * 19349663) ^
                0x2e5d) >>>
                0,
        );
        const k = 0.7 + hr() * 0.14,
            Pi = P.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
        const lay = [LAYER.ROOF, LAYER.ROOF_GRAVEL, LAYER.ROOF_MEMBRANE].filter(
            (l) => l !== roofP.layer,
        )[Math.floor(hr() * 2)];
        const tk = 0.52 + hr() * 0.2;
        T.fac.fan(Pi, H + 0.08, {
            ...roofP,
            layer: lay,
            tint: [tk, tk, tk * 0.97],
        });
        const bb = bboxOf(P),
            n = Math.min(6, Math.floor(polyArea(P) / 80)),
            put = [[cx, cz, s + 0.6, s + 0.6]];
        for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
            const w = 1 + hr() * 1.8,
                dd = 0.8 + hr() * 1.4,
                h = 0.8 + hr() * 1.1,
                x = bb.x0 + hr() * (bb.x1 - bb.x0),
                z = bb.z0 + hr() * (bb.z1 - bb.z0);
            if (
                ![
                    [-1, -1],
                    [1, -1],
                    [1, 1],
                    [-1, 1],
                ].every(([a, c]) =>
                    inConvex(P, x + a * (w / 2 + 0.7), z + c * (dd / 2 + 0.7)),
                )
            )
                continue;
            if (
                put.some(
                    ([px, pz, hx, hz]) =>
                        Math.abs(px - x) < hx + w / 2 + 0.5 &&
                        Math.abs(pz - z) < hz + dd / 2 + 0.5,
                )
            )
                continue;
            put.push([x, z, w / 2, dd / 2]);
            i++;
            const g = 0.5 + hr() * 0.16;
            T.fac.box(
                x - w / 2,
                H,
                z - dd / 2,
                x + w / 2,
                H + h,
                z + dd / 2,
                { ...stone, layer: LAYER.METAL, tint: [g, g * 1.01, g * 1.02] },
                {},
                true,
            );
            ctx.S.box(
                x - w / 2,
                H,
                z - dd / 2,
                x + w / 2,
                H + h,
                z + dd / 2,
                "equipment",
            );
        }
    }
}

function vmapBuildings(ctx, tile, placedMid, opts = {}, reserves = []) {
    let nRect = 0,
        nPrism = 0;
    const hitEx = (x0, z0, x1, z1) =>
        (opts.exclude || []).some(
            (e) => x1 > e.x0 && x0 < e.x1 && z1 > e.z0 && z0 < e.z1,
        );
    for (const c of MAPS.flatMap((M) => M.cells)) {
        const P0 = c.prop;
        if (!P0 || polyArea(P0) < 160 || c.park) continue;
        const b = c.block,
            _hs = (x, z, k) =>
                mulberry32(
                    ((Math.floor(x * 6.1) * 73856093) ^
                        (Math.floor(z * 4.3) * 19349663) ^
                        k) >>>
                        0,
                );
        const fidi = c.map.name === "fidi";
        {
            const R = reserves.find(
                (R) =>
                    !R.lot &&
                    inConvex(P0, (R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2),
            );
            if (R) {
                const lot = {
                    x0: R.x0,
                    x1: R.x1,
                    z0: R.z0,
                    z1: R.z1,
                    sides: {
                        nx: "street",
                        px: "street",
                        nz: "street",
                        pz: "street",
                    },
                    kind: "tower",
                    cx: (R.x0 + R.x1) / 2,
                    cz: (R.z0 + R.z1) / 2,
                    reserved: true,
                };
                R.lot = lot;
                if (!R.custom) {
                    const r2 = mulberry32(R.seed ?? 77),
                        arch = {
                            ...chooseArch({ ...lot, kind: "tower" }, b, r2),
                            ...R.arch(r2, lot),
                        };
                    const bld = emitBuilding(
                        lot,
                        arch,
                        b,
                        mulberry32(R.seed ?? 99),
                        tile,
                        ctx,
                    );
                    R.build = bld;
                    R.extra?.(lot, bld, {
                        S: ctx.S,
                        Z: ctx.Z,
                        tile: tile(lot.cx, lot.cz),
                    });
                }
                continue;
            }
        }
        const st = cellLots(ctx, tile, placedMid, P0, b, fidi, (Q) => {
            const qb = bboxOf(Q);
            return hitEx(qb.x0, qb.z0, qb.x1, qb.z1);
        });
        nRect += st.nRect;
        nPrism += st.nPrism;
    }
    return { nRect, nPrism };
}

function cellLots(ctx, tile, placedMid, P0, b, fidi, hitP, o = {}) {
    let nRect = 0,
        nPrism = 0;
    const hs = (x, z, k) =>
        mulberry32(
            ((Math.floor(x * 6.1) * 73856093) ^
                (Math.floor(z * 4.3) * 19349663) ^
                k) >>>
                0,
        );
    const r0 = hs(b.x0, b.z0, 0x71a9);
    const bz0 = Math.min(...P0.map((p) => p[1])),
        bz1 = Math.max(...P0.map((p) => p[1]));
    const halves = [];
    if (bz1 - bz0 > 46) {
        const zm = bz0 + (bz1 - bz0) * (0.42 + r0() * 0.16);
        halves.push(
            [clipPoly(P0, (x, z) => zm - z), "pz"],
            [clipPoly(P0, (x, z) => z - zm), "nz"],
        );
    } else halves.push([P0, null]);
    for (const [H0, cutSide] of halves) {
        if (H0.length < 3 || polyArea(H0) < 60) continue;
        const hb = bboxOf(H0),
            za = hb.z0,
            zb = hb.z1;
        const xAt = (z, left) => {
            let a = Infinity,
                bb2 = -Infinity;
            for (let i = 0; i < H0.length; i++) {
                const p = H0[i],
                    q = H0[(i + 1) % H0.length];
                if ((p[1] - z) * (q[1] - z) > 0 || p[1] === q[1]) continue;
                const t = (z - p[1]) / (q[1] - p[1]),
                    x = p[0] + (q[0] - p[0]) * t;
                a = Math.min(a, x);
                bb2 = Math.max(bb2, x);
            }
            return left ? a : bb2;
        };
        const e = 0.02;
        let xL = Math.max(xAt(za + e, true), xAt(zb - e, true)),
            xR = Math.min(xAt(za + e, false), xAt(zb - e, false));

        if (xL - hb.x0 > 0.3) xL = Math.max(xL, hb.x0 + 5);
        if (hb.x1 - xR > 0.3) xR = Math.min(xR, hb.x1 - 5);
        const r = hs(hb.x0, za, 0x3b77);
        const cuts = [];
        const lw0 = fidi ? 15 : 7,
            lw1 = fidi ? 22 : 15;
        if (xR - xL >= 7) {
            let x = xL;
            cuts.push(x);
            while (xR - x > lw0 + lw1 + 4) {
                x += lw0 + r() * lw1;
                cuts.push(x);
            }
            cuts.push(xR);
        }
        const lots = [];
        for (let i = 0; i + 1 < cuts.length; i++)
            lots.push({ rect: [cuts[i], cuts[i + 1]] });
        const leftP = cuts.length ? clipPoly(H0, (x, _z) => cuts[0] - x) : H0,
            rightP = cuts.length
                ? clipPoly(H0, (x, _z) => x - cuts[cuts.length - 1])
                : [];
        const sideZ = (z) =>
            Math.abs(z - za) < 0.05
                ? cutSide === "nz"
                    ? "party"
                    : "street"
                : cutSide === "pz"
                  ? "party"
                  : "street";
        const endOK = (Q) =>
            Q.length >= 3 &&
            polyArea(Q) >= 25 &&
            bboxOf(Q).x1 - bboxOf(Q).x0 >= 2.5;
        const okL = endOK(leftP),
            okR = endOK(rightP);
        for (const [li, L] of lots.entries()) {
            const [x0, x1] = L.rect;
            if (
                hitP([
                    [x0, za],
                    [x1, za],
                    [x1, zb],
                    [x0, zb],
                ])
            )
                continue;
            const lot = {
                x0,
                x1,
                z0: za,
                z1: zb,
                cx: (x0 + x1) / 2,
                cz: (za + zb) / 2,
                kind:
                    (x1 - x0) * (zb - za) > (fidi ? 900 : 1400)
                        ? "tower"
                        : "row",
                sides: {
                    nx: li === 0 && !okL ? "street" : "party",
                    px: li === lots.length - 1 && !okR ? "street" : "party",
                    nz: sideZ(za),
                    pz: sideZ(zb),
                },
            };
            const sr = hs(lot.cx, lot.cz, 0x5a11);
            let A = chooseArch(lot, b, sr);
            A =
                residentialArch(
                    lot,
                    district(lot.cx, lot.cz),
                    hs(lot.cx, lot.cz, 0x2c3d),
                    A,
                ) ?? A;
            if (A.shape === undefined) A.shape = pickShape(lot, A, b, sr);
            streetVary(lot, A, placedMid);
            emitBuilding(
                lot,
                A,
                b,
                mulberry32(Math.floor(sr() * 4294967296)),
                tile,
                ctx,
            );
            o.onRect?.(lot);
            nRect++;
        }
        for (const Q of [leftP, rightP]) {
            if (!endOK(Q)) continue;
            const qb = bboxOf(Q);
            if (hitP(Q)) continue;
            const rr = hs(qb.x0, qb.z0, 0x7e13);
            const lot = {
                x0: qb.x0,
                x1: qb.x1,
                z0: qb.z0,
                z1: qb.z1,
                cx: (qb.x0 + qb.x1) / 2,
                cz: (qb.z0 + qb.z1) / 2,
                kind: "row",
                sides: {},
            };
            const A = chooseArch(lot, b, rr);
            const floors = Math.max(
                2,
                Math.round(((A.height ?? 18) - A.gH) / A.floorH),
            );
            const _H = A.gH + Math.min(floors, 14) * A.floorH;
            const onProp = (p, q) => {
                for (let i = 0; i < P0.length; i++) {
                    const a = P0[i],
                        bq = P0[(i + 1) % P0.length],
                        L = Math.hypot(bq[0] - a[0], bq[1] - a[1]);
                    if (L < 1e-6) continue;
                    const d = (x, z) =>
                        Math.abs(
                            (bq[0] - a[0]) * (z - a[1]) -
                                (bq[1] - a[1]) * (x - a[0]),
                        ) / L;
                    if (d(p[0], p[1]) < 0.03 && d(q[0], q[1]) < 0.03)
                        return true;
                }
                return false;
            };
            const chunks = [Q];
            if (o.split) {
                const qb0 = bboxOf(Q),
                    cr = hs(qb0.x0, qb0.z1, 0x4c21);
                if (qb0.z1 - qb0.z0 > 36) {
                    chunks.length = 0;
                    let z = qb0.z0,
                        R = Q;
                    while (qb0.z1 - z > 34) {
                        z += 16 + cr() * 14;
                        const A1 = clipPoly(R, (x, zz) => z - zz);
                        if (A1.length >= 3) chunks.push(A1);
                        R = clipPoly(R, (x, zz) => zz - z);
                        if (R.length < 3) break;
                    }
                    if (R.length >= 3) chunks.push(R);
                }
            }
            for (const [ci, Qc] of chunks.entries()) {
                if (!endOK(Qc)) continue;
                const cb = bboxOf(Qc),
                    rc = ci ? hs(cb.x0, cb.z0, 0x7e13 + ci) : rr;
                const Ac = ci
                    ? chooseArch(
                          {
                              ...lot,
                              z0: cb.z0,
                              z1: cb.z1,
                              cz: (cb.z0 + cb.z1) / 2,
                          },
                          b,
                          rc,
                      )
                    : A;
                const fl = Math.max(
                    2,
                    Math.round(((Ac.height ?? 18) - Ac.gH) / Ac.floorH),
                );
                const Hc = Ac.gH + Math.min(fl, o.maxFloors ?? 14) * Ac.floorH;
                prismBuilding(
                    ctx,
                    tile,
                    Qc,
                    Ac,
                    Hc,
                    rc,
                    (p, q) => (onProp(p, q) ? "street" : "party"),
                    false,
                );
                o.onPrism?.(Qc);
                nPrism++;
            }
        }
    }
    return { nRect, nPrism };
}

const DIAG_R7 = !globalThis.__DIAG_OLD;
function diagPieceBuild(b, blockers, flat, ctx, tile, placedMid, diagLots) {
    const e = 0.06,
        prop = { x0: b.px0 + e, x1: b.px1 - e, z0: b.pz0 + e, z1: b.pz1 - e };
    let db = diagLots.get(b);
    if (!db) diagLots.set(b, (db = []));
    const hitB = (Q) =>
        blockers.some((r) => {
            const R = clipRectPoly(Q, r);
            return R.length >= 3 && polyArea(R) > 0.2;
        }) ||
        (flat && convexOverlap(Q, flat.poly) > 0.2);
    const st = (ctx.diagR7 ??= { pieces: 0, plazas: 0, rect: 0, prism: 0 });
    for (const P0 of diagLotPieces(b, 0)
        .map((P) => clipRectPoly(P, prop))
        .filter((P) => P.length >= 3 && polyArea(P) > 30)) {
        if (flat && inConvex(P0, FLATIRON_PT[0], FLATIRON_PT[1])) continue;
        const area = polyArea(P0),
            c0 = bboxOf(P0),
            mx = (c0.x0 + c0.x1) / 2,
            mz = (c0.z0 + c0.z1) / 2;
        if (
            area < 3500 &&
            DIAG_SQUARES.some(([x, z]) => Math.hypot(mx - x, mz - z) < 95)
        ) {
            st.plazas++;
            continue;
        }
        const d = district(mx, mz),
            r = cellLots(ctx, tile, placedMid, P0, b, d.fidi > 0.5, hitB, {
                split: true,
                maxFloors: Math.round(14 + 16 * Math.max(d.midtown, d.fidi)),
                onRect: (l) => db.push(l),
                onPrism: (Q) => (ctx.frontPolys ??= []).push(Q),
            });
        st.pieces++;
        st.rect += r.nRect;
        st.prism += r.nPrism;
    }
}
function diagFrontage(b, bStart, blockers, flat, ctx, tile, flatOnly = false) {
    const blds = ctx.buildings.slice(bStart);
    const e = 0.06,
        prop = { x0: b.px0 + e, x1: b.px1 - e, z0: b.pz0 + e, z1: b.pz1 - e };
    const placed = [];
    const hsh = (x, z, k) =>
        mulberry32(
            ((Math.floor(x * 5.9) * 73856093) ^
                (Math.floor(z * 3.3) * 19349663) ^
                k) >>>
                0,
        );
    const onEdge = (p, q) => {
        const E = 0.02;
        return (
            (Math.abs(p[0] - q[0]) < E &&
                (Math.abs(p[0] - prop.x0) < E ||
                    Math.abs(p[0] - prop.x1) < E)) ||
            (Math.abs(p[1] - q[1]) < E &&
                (Math.abs(p[1] - prop.z0) < E || Math.abs(p[1] - prop.z1) < E))
        );
    };
    const build = (P, A, H, r, front, isFlat) => {
        prismBuilding(ctx, tile, P, A, H, r, front, isFlat);
        placed.push(P);
    };
    const capH = (P) => {
        let h = Infinity;
        for (const bl of blds) {
            const Q = clipRectPoly(P, bl.lot);
            if (Q.length >= 3 && polyArea(Q) > 0.5) h = Math.min(h, bl.H - 3);
        }
        return h;
    };
    const hitBlk = (P) =>
        blockers.some((r) => {
            const Q = clipRectPoly(P, r);
            return Q.length >= 3 && polyArea(Q) > 0.2;
        });
    if (flat && !hitBlk(flat.poly)) {
        const A = {
            seed: 37,
            resid: 0,
            lintel: 1,
            glass: 1,
            depth: 0.3,
            margin: 1.0,
            type: "deco",
            style: STYLE.PUNCHED,
            layer: LAYER.BUFF,
            base: LAYER.GRANITE,
            floorH: 3.75,
            bayW: 1.75,
            winW: 0.5,
            winH: 0.62,
            gH: 6.2,
            tint: [1.0, 0.95, 0.86],
        };
        build(
            flat.poly,
            A,
            A.gH + 21 * A.floorH,
            hsh(flat.x0, flat.z0, 0xf1a7),
            () => "street",
            true,
        );
    }
    const pieces = flatOnly
        ? []
        : diagLotPieces(b, 0)
              .map((P) => clipRectPoly(P, prop))
              .filter((P) => P.length >= 3 && polyArea(P) > 30);
    for (const P0 of pieces) {
        if (flat && inConvex(P0, FLATIRON_PT[0], FLATIRON_PT[1])) continue;
        const area = polyArea(P0),
            c0 = bboxOf(P0),
            mx = (c0.x0 + c0.x1) / 2,
            mz = (c0.z0 + c0.z1) / 2;
        if (
            area < 3500 &&
            DIAG_SQUARES.some(([x, z]) => Math.hypot(mx - x, mz - z) < 95)
        )
            continue;
        for (const s of b.diag) {
            const m = s.hw + s.walk;
            const ds = P0.map((p) => diagD(s, p[0], p[1])),
                sg = Math.sign(ds.reduce((a, v) => a + v, 0)) || 1;
            if (!ds.some((v) => Math.abs(sg * v - m) < 0.05)) continue;
            const r = hsh(mx + s.id * 17, mz, 0x2f31);
            const D = 12 + r() * 10;
            const strip = clipPoly(P0, (x, z) => m + D - sg * diagD(s, x, z));
            if (strip.length < 3 || polyArea(strip) < 30) continue;

            const cz = Math.abs(s.uz) >= Math.abs(s.ux),
                U = (x, z) => (cz ? z : x);
            const us = strip.map((p) => U(p[0], p[1])),
                u0 = Math.min(...us),
                u1 = Math.max(...us);
            const cuts = [u0];
            for (let u = u0 + 14 + r() * 20; u < u1 - 8; u += 14 + r() * 20)
                cuts.push(u);
            cuts.push(u1);
            for (let k = 0; k + 1 < cuts.length; k++) {
                const a = cuts[k],
                    c = cuts[k + 1];
                let Q = clipPoly(strip, (x, z) => U(x, z) - a);
                if (Q.length >= 3) Q = clipPoly(Q, (x, z) => c - U(x, z));
                if (Q.length < 3 || polyArea(Q) < 40) continue;
                const bq = bboxOf(Q);
                if (Math.min(bq.x1 - bq.x0, bq.z1 - bq.z0) < 3) continue;
                if (hitBlk(Q) || (flat && convexOverlap(Q, flat.poly) > 0.2))
                    continue;
                if (placed.some((O) => convexOverlap(Q, O) > 0.2)) continue;
                const rr = hsh(bq.x0 + a, bq.z0, 0x7e11);
                const lot = {
                    x0: bq.x0,
                    x1: bq.x1,
                    z0: bq.z0,
                    z1: bq.z1,
                    cx: (bq.x0 + bq.x1) / 2,
                    cz: (bq.z0 + bq.z1) / 2,
                    kind: "row",
                    sides: {},
                };
                const A = chooseArch(lot, b, rr);
                const dist = district(lot.cx, lot.cz);
                let H = Math.min(
                    A.height ?? 20,
                    16 + 44 * Math.max(dist.midtown, dist.fidi) + rr() * 12,
                );
                H = Math.min(H, capH(Q));
                const floors = Math.floor((H - A.gH) / A.floorH);
                if (!(floors >= 2)) continue;
                H = A.gH + floors * A.floorH;
                const front = (p, q) => {
                    const dp = sg * diagD(s, p[0], p[1]),
                        dq = sg * diagD(s, q[0], q[1]);
                    if (Math.abs(dp - m) < 0.05 && Math.abs(dq - m) < 0.05)
                        return "street";
                    if (onEdge(p, q)) return "street";
                    const up = U(p[0], p[1]),
                        uq = U(q[0], q[1]);
                    if (
                        Math.abs(up - uq) < 0.05 &&
                        up > u0 + 0.05 &&
                        up < u1 - 0.05
                    )
                        return "party";
                    return "rear";
                };
                build(Q, A, H, rr, front, false);
            }
        }
    }
    ctx.frontage = (ctx.frontage || 0) + placed.length;
    (ctx.frontPolys ??= []).push(...placed);
}

function diagInfill(b, lots, blockers, emit) {
    const C = 2,
        x0 = b.px0,
        z0 = b.pz0,
        nx = Math.floor((b.px1 - b.px0) / C),
        nz = Math.floor((b.pz1 - b.pz0) / C);
    if (nx < 4 || nz < 4) return;
    const occ = new Uint8Array(nx * nz);
    const cellFree = (i, j) =>
        diagRectClear(
            b.diag,
            x0 + i * C,
            z0 + j * C,
            x0 + (i + 1) * C,
            z0 + (j + 1) * C,
            0.3,
        );
    const hit = (r, i, j, m) =>
        x0 + (i + 1) * C > r.x0 - m &&
        x0 + i * C < r.x1 + m &&
        z0 + (j + 1) * C > r.z0 - m &&
        z0 + j * C < r.z1 + m;
    for (let j = 0; j < nz; j++)
        for (let i = 0; i < nx; i++) {
            if (
                !cellFree(i, j) ||
                lots.some((r) => hit(r, i, j, -0.05)) ||
                blockers.some((r) => hit(r, i, j, 0.5))
            )
                occ[j * nx + i] = 1;
        }
    const placed = [];
    for (let it = 0; it < 6; it++) {
        const H = new Int32Array(nx);
        let best = null,
            bestA = 0;
        for (let j = 0; j < nz; j++) {
            for (let i = 0; i < nx; i++) H[i] = occ[j * nx + i] ? 0 : H[i] + 1;
            for (let i = 0; i < nx; i++) {
                let h = H[i];
                for (let k = i; k < nx && h > 0; k++) {
                    h = Math.min(h, H[k]);
                    const w = k - i + 1;
                    if (w * h > bestA && w * C >= 9 && h * C >= 9) {
                        bestA = w * h;
                        best = { i0: i, i1: k + 1, j0: j - h + 1, j1: j + 1 };
                    }
                }
            }
        }
        if (!best || bestA * C * C < 140) break;
        const r = {
            x0: x0 + best.i0 * C,
            x1: x0 + best.i1 * C,
            z0: z0 + best.j0 * C,
            z1: z0 + best.j1 * C,
        };

        if (r.x0 - b.px0 < C + 0.01) r.x0 = b.px0;
        if (b.px1 - r.x1 < C + 0.01) r.x1 = b.px1;
        if (r.z0 - b.pz0 < C + 0.01) r.z0 = b.pz0;
        if (b.pz1 - r.z1 < C + 0.01) r.z1 = b.pz1;
        if (
            !diagRectClear(b.diag, r.x0, r.z0, r.x1, r.z1, 0.3) ||
            [...lots, ...placed].some(
                (l) =>
                    l.x1 > r.x0 + 0.05 &&
                    l.x0 < r.x1 - 0.05 &&
                    l.z1 > r.z0 + 0.05 &&
                    l.z0 < r.z1 - 0.05,
            )
        ) {
            for (let j = best.j0; j < best.j1; j++)
                for (let i = best.i0; i < best.i1; i++) occ[j * nx + i] = 1;
            continue;
        }
        for (let j = best.j0; j < best.j1; j++)
            for (let i = best.i0; i < best.i1; i++) occ[j * nx + i] = 1;
        const e = 0.2,
            touch = (L, side) =>
                L.some((l) =>
                    side === "nx"
                        ? Math.abs(l.x1 - r.x0) < e &&
                          l.z1 > r.z0 &&
                          l.z0 < r.z1
                        : side === "px"
                          ? Math.abs(l.x0 - r.x1) < e &&
                            l.z1 > r.z0 &&
                            l.z0 < r.z1
                          : side === "nz"
                            ? Math.abs(l.z1 - r.z0) < e &&
                              l.x1 > r.x0 &&
                              l.x0 < r.x1
                            : Math.abs(l.z0 - r.z1) < e &&
                              l.x1 > r.x0 &&
                              l.x0 < r.x1,
                );
        const all = [...lots, ...placed],
            sides = {};
        for (const sd of ["nx", "px", "nz", "pz"])
            sides[sd] = touch(all, sd) ? "party" : "street";
        const nl = {
            ...r,
            sides,
            kind: (r.x1 - r.x0) * (r.z1 - r.z0) > 900 ? "tower" : "row",
            cx: (r.x0 + r.x1) / 2,
            cz: (r.z0 + r.z1) / 2,
            diagTrim: true,
            infill: true,
        };
        placed.push(nl);
        emit(nl);
    }
}

const BV_EMPTY = { open: new Set(), mod: new Map(), rects: [] };
const SQUARE_PARKS = [
    { name: "Madison Square Park", x: 340, z: 680 },
    { name: "Union Square Park", x: 520, z: 1000 },
];
function blockVariety(b, lots, mine, opts, ctx, tile) {
    const st = (ctx.bvStats ??= {
        park: 0,
        parking: 0,
        vacant: 0,
        plaza: 0,
        square: 0,
        alley: 0,
        notch: 0,
        trees: 0,
    });
    const sq = SQUARE_PARKS.find(
        (s) => s.x > b.px0 && s.x < b.px1 && s.z > b.pz0 && s.z < b.pz1,
    );
    if (sq && !mine.length && !b.vmap) {
        const o = {
            kind: "square",
            name: sq.name,
            x0: b.px0,
            x1: b.px1,
            z0: b.pz0,
            z1: b.pz1,
        };
        const bv = {
            open: new Set(lots),
            mod: new Map(),
            rects: [o],
            square: true,
        };
        (ctx.open ??= []).push(o);
        st.square++;
        openDress(o, ctx, tile, (k) =>
            hash2(b.col * 31 + k * 977 + 13, b.rj * 57 + k * 131 + 7),
        );
        return bv;
    }
    if (b.diag?.length || b.vmap) return BV_EMPTY;
    const hx = (k) => hash2(b.col * 31 + k * 977 + 13, b.rj * 57 + k * 131 + 7);
    const near = (l, r, p) =>
        l.x1 > r.x0 - p &&
        l.x0 < r.x1 + p &&
        l.z1 > r.z0 - p &&
        l.z0 < r.z1 + p;
    const hitE = (l) =>
        l.reserved ||
        (opts.exclude || []).some((e) => near(l, e, 1)) ||
        (opts.reserve || []).some((e) => near(l, e, 1)) ||
        (opts.force || []).some(
            (f) =>
                f.x > l.x0 - 30 &&
                f.x < l.x1 + 30 &&
                f.z > l.z0 - 30 &&
                f.z < l.z1 + 30,
        );
    const bv = { open: new Set(), mod: new Map(), rects: [] };
    const u = hx(0),
        hot = Math.max(b.dist.midtown, b.dist.fidi);
    const mode =
        u < 0.1
            ? "park"
            : u < 0.17
              ? "lot"
              : hot > 0.4 && u < 0.32
                ? "plaza"
                : null;
    const front = (l) =>
        l.sides.nz === "street" && l.sides.pz !== "street"
            ? "nz"
            : l.sides.pz === "street" && l.sides.nz !== "street"
              ? "pz"
              : null;
    if (mode === "park" || mode === "lot") {
        const rows = lots
            .filter(
                (l) =>
                    l.kind === "row" &&
                    !hitE(l) &&
                    front(l) &&
                    l.sides.nx === "party" &&
                    l.sides.px === "party",
            )
            .sort((p, q) => p.x0 - q.x0);
        const n = rows.length,
            s0 = Math.floor(hx(1) * n);
        for (let t = 0; t < n; t++) {
            const first = rows[(s0 + t) % n],
                f = front(first),
                run = [first];
            let x1 = first.x1;
            while (x1 - first.x0 < 15) {
                const nx = rows.find(
                    (l) => front(l) === f && Math.abs(l.x0 - x1) < 0.1,
                );
                if (!nx) break;
                run.push(nx);
                x1 = nx.x1;
            }
            const w = x1 - first.x0;
            if (w < 12 || w > 34) continue;
            const z0 = Math.min(...run.map((l) => l.z0)),
                z1 = Math.max(...run.map((l) => l.z1));
            if (z1 - z0 < 10) continue;
            const o = {
                kind:
                    mode === "park"
                        ? "park"
                        : hx(2) < 0.6
                          ? "parking"
                          : "vacant",
                x0: first.x0,
                x1,
                z0,
                z1,
                front: f,
            };
            for (const l of run) bv.open.add(l);
            bv.rects.push(o);
            (ctx.open ??= []).push(o);
            st[o.kind]++;
            openDress(o, ctx, tile, hx);
            break;
        }
    }
    if (mode === "plaza") {
        const cand = lots.filter(
            (l) =>
                (l.kind === "tower" || l.kind === "corner") &&
                !hitE(l) &&
                (l.sides.nx === "street" || l.sides.px === "street") &&
                (l.sides.nz === "street" || l.sides.pz === "street"),
        );
        if (cand.length) {
            const l = cand[Math.floor(hx(3) * cand.length)];
            const ax =
                l.sides.nx === "street" &&
                (l.sides.px !== "street" || hx(4) < 0.5)
                    ? "nx"
                    : "px";
            const az =
                l.sides.nz === "street" &&
                (l.sides.pz !== "street" || hx(5) < 0.5)
                    ? "nz"
                    : "pz";
            const sx = 8 + hx(6) * 6,
                sz = 7 + hx(7) * 5,
                mn = l.kind === "tower" ? 18 : 12;
            if (l.x1 - l.x0 - sx >= mn && l.z1 - l.z0 - sz >= mn) {
                const T = {
                    x0: ax === "nx" ? l.x0 + sx : l.x0,
                    x1: ax === "px" ? l.x1 - sx : l.x1,
                    z0: az === "nz" ? l.z0 + sz : l.z0,
                    z1: az === "pz" ? l.z1 - sz : l.z1,
                    face: "street",
                };
                bv.mod.set(l, T);
                const o = {
                    kind: "plaza",
                    x0: l.x0,
                    x1: l.x1,
                    z0: l.z0,
                    z1: l.z1,
                    tower: T,
                    ax,
                    az,
                };
                (ctx.open ??= []).push(o);
                st.plaza++;
                openDress(o, ctx, tile, hx);
            }
        }
    }

    for (const l of lots) {
        if (l.kind !== "row" || bv.open.has(l) || hitE(l)) continue;
        const f = front(l);
        if (!f) continue;
        const h = hash2(
                Math.floor(l.x0 * 3.7) + 7919,
                Math.floor(l.z0 * 5.3) + 104729,
            ),
            h2 = hash2(
                Math.floor(l.x1 * 2.9) + 31,
                Math.floor(l.z1 * 4.1) + 17,
            );
        let T = null;
        if (
            h < 0.09 &&
            l.sides.px === "party" &&
            l.x1 - l.x0 >= 12 &&
            !bv.rects.some((o) => Math.abs(o.x0 - l.x1) < 0.2)
        ) {
            T = { x0: l.x0, x1: l.x1 - 3.5, z0: l.z0, z1: l.z1, face: "rear" };
            st.alley++;
        }
        const rs = f === "nz" ? "pz" : "nz";
        if (l.sides[rs] === "party" && h2 < 0.4 && l.z1 - l.z0 >= 20) {
            const c = 4 + h2 * 8;
            T = T ?? { x0: l.x0, x1: l.x1, z0: l.z0, z1: l.z1, face: "rear" };
            if (rs === "pz") T.z1 -= c;
            else T.z0 += c;
            st.notch++;
        }
        if (T) bv.mod.set(l, T);
    }

    const wideN = WIDE_STREETS.some(
            (z) => Math.abs(z - (b.z0 - G.ST_HALF)) < 1,
        ),
        wideS = WIDE_STREETS.some((z) => Math.abs(z - (b.z1 + G.ST_HALF)) < 1);
    if (wideN || wideS)
        for (const l of lots) {
            if (
                (l.kind !== "row" && l.kind !== "corner") ||
                bv.open.has(l) ||
                hitE(l)
            )
                continue;
            const f =
                wideN && l.sides.nz === "street" && Math.abs(l.z0 - b.pz0) < 0.5
                    ? "nz"
                    : wideS &&
                        l.sides.pz === "street" &&
                        Math.abs(l.z1 - b.pz1) < 0.5
                      ? "pz"
                      : null;
            if (!f) continue;
            const T = bv.mod.get(l) ?? {
                x0: l.x0,
                x1: l.x1,
                z0: l.z0,
                z1: l.z1,
                face: "rear",
            };
            if (f === "nz") T.z0 = Math.max(T.z0, l.z0 + WIDE_ST_SET);
            else T.z1 = Math.min(T.z1, l.z1 - WIDE_ST_SET);
            if (T.z1 - T.z0 < 12) continue;
            (T.faces ??= {})[f] = "street";
            T.wide = true;
            bv.mod.set(l, T);
            st.wide = (st.wide || 0) + 1;
        }

    for (const l of lots) {
        if (
            (l.kind !== "row" && l.kind !== "corner") ||
            bv.open.has(l) ||
            hitE(l)
        )
            continue;
        const f =
            l.kind === "row"
                ? front(l)
                : l.sides.nz === "street"
                  ? "nz"
                  : l.sides.pz === "street"
                    ? "pz"
                    : null;
        if (!f) continue;
        const h3 = hash2(
                Math.floor(l.x0 * 4.3) + 313,
                Math.floor(l.z0 * 2.1) + 977,
            ),
            h4 = hash2(
                Math.floor(l.x1 * 3.3) + 71,
                Math.floor(l.z1 * 6.7) + 29,
            );
        const h5 = hash2(
            Math.floor(l.cx * 2.3) + 5003,
            Math.floor(l.cz * 1.7) + 211,
        );
        const w = l.x1 - l.x0,
            dep = l.z1 - l.z0,
            cornerK = l.kind === "corner";
        let kind = null,
            d = 0;
        if (h3 < (cornerK ? 0.05 : 0.1) && w >= 7 && dep >= 18) {
            kind = "fore";
            d = 2.5 + h4 * 4.5;
        } else if (!cornerK && h3 < 0.16 && w >= 9 && dep >= 22) {
            kind = "bay";
            d = 5 + h4 * 2.5;
        }
        const hMod = h5 < 0.08 ? "low" : h5 > 0.93 ? "tall" : null;
        if (!kind && !hMod) continue;
        const T = bv.mod.get(l) ?? {
            x0: l.x0,
            x1: l.x1,
            z0: l.z0,
            z1: l.z1,
            face: "rear",
        };
        if (T.wide) kind = null;
        if (!kind && !hMod) continue;
        if (hMod) {
            T.hMod = hMod;
            T.hU = h4;
            st[hMod] = (st[hMod] || 0) + 1;
        }
        if (kind) {
            if (f === "nz") T.z0 = l.z0 + d;
            else T.z1 = l.z1 - d;
            (T.faces ??= {})[f] = "street";
            if (T.z1 - T.z0 < 12) continue;
            const o = {
                kind,
                x0: l.x0,
                x1: l.x1,
                z0: f === "nz" ? l.z0 : T.z1,
                z1: f === "nz" ? T.z0 : l.z1,
                front: f,
                b,
                u: h4,
                v: h5,
            };
            (ctx.open ??= []).push(o);
            st[kind] = (st[kind] || 0) + 1;
            openDress(o, ctx, tile, (k) =>
                hash2(
                    Math.floor(l.x0 * 1.3) + k * 977,
                    Math.floor(l.z0 * 1.9) + k * 131,
                ),
            );
        }
        bv.mod.set(l, T);
    }
    return bv;
}

function bvHeight(L, A) {
    if (
        !L?.hMod ||
        !(A.type === "walkup" || A.type === "loft" || A.type === "apt")
    )
        return;
    const fh = A.floorH ?? 3.4,
        gH = A.gH ?? 4.5;
    if (L.hMod === "low") {
        A.height = gH + fh * (L.hU < 0.5 ? 0 : 1) + 0.6;
        A.waterTower = false;
        A.fireEscape = false;
        A.shape = "box";
    } else A.height = Math.min(A.height * (1.45 + L.hU * 0.5) + fh * 2, 110);
}

const ENS_KEYS = [
    "height",
    "layer",
    "base",
    "tint",
    "style",
    "floorH",
    "gH",
    "cornice",
    "bayW",
    "winW",
    "winH",
    "lintel",
    "type",
];
function bvEnsemble(ctx, b, lot, sl, L, A) {
    if (!L || L.hMod || b.diag?.length || b.vmap || lot.reserved) return;
    if (!(A.type === "walkup" || A.type === "loft" || A.type === "apt")) return;
    let key = null;
    if (sl !== lot) {
        if (
            hash2(
                Math.floor(lot.x0 * 3.1) + 811,
                Math.floor(lot.z0 * 2.7) + 57,
            ) < 0.6
        )
            key = `s${lot.x0.toFixed(1)},${lot.z0.toFixed(1)}`;
    } else if (lot.kind === "row") {
        const hb = hash2(b.col * 13 + 5, b.rj * 29 + 3);
        if (hb > 0.8) return;
        const win =
                16 + Math.floor(hash2(b.col * 7 + 1, b.rj * 11 + 9) * 3) * 10,
            ph = hash2(b.col + 77, b.rj + 13) * win;
        const front =
            lot.sides.nz === "street"
                ? "n"
                : lot.sides.pz === "street"
                  ? "s"
                  : "m";
        key = `r${b.col},${b.rj},${front},${Math.floor((lot.cx - b.px0 + ph) / win)}`;
    }
    if (!key) return;
    const E = (ctx.ens ??= new Map()),
        rec = E.get(key);
    if (!rec) {
        E.set(key, Object.fromEntries(ENS_KEYS.map((k) => [k, A[k]])));
        return;
    }
    if (rec.type !== A.type) return;
    for (const k of ENS_KEYS)
        if (rec[k] === undefined) delete A[k];
        else A[k] = rec[k];
    (ctx.bvStats ??= {}).ens = (ctx.bvStats.ens || 0) + 1;
}

function bvLot(bv, lot, L) {
    if (bv.open.has(lot)) return null;
    const m = bv.mod.get(lot);
    if (!m && !bv.rects.length) return L;
    const sides = { ...L.sides };
    let { x0, x1, z0, z1 } = L;
    if (m) {
        x0 = Math.max(x0, m.x0);
        x1 = Math.min(x1, m.x1);
        z0 = Math.max(z0, m.z0);
        z1 = Math.min(z1, m.z1);
        if (x1 - x0 < 6 || z1 - z0 < 6) return null;
        if (x0 > L.x0 + 0.01) sides.nx = m.faces?.nx ?? m.face;
        if (x1 < L.x1 - 0.01) sides.px = m.faces?.px ?? m.face;
        if (z0 > L.z0 + 0.01) sides.nz = m.faces?.nz ?? m.face;
        if (z1 < L.z1 - 0.01) sides.pz = m.faces?.pz ?? m.face;
    }
    const ov = (a0, a1, c0, c1) => Math.min(a1, c1) - Math.max(a0, c0) > 1;
    for (const o of bv.rects) {
        if (ov(z0, z1, o.z0, o.z1)) {
            if (Math.abs(x1 - o.x0) < 0.1 && sides.px === "party")
                sides.px = "rear";
            if (Math.abs(x0 - o.x1) < 0.1 && sides.nx === "party")
                sides.nx = "rear";
        }
        if (ov(x0, x1, o.x0, o.x1)) {
            if (Math.abs(z1 - o.z0) < 0.1 && sides.pz === "party")
                sides.pz = "rear";
            if (Math.abs(z0 - o.z1) < 0.1 && sides.nz === "party")
                sides.nz = "rear";
        }
    }
    return {
        ...L,
        x0,
        x1,
        z0,
        z1,
        sides,
        cx: (x0 + x1) / 2,
        cz: (z0 + z1) / 2,
        hMod: m?.hMod,
        hU: m?.hU,
    };
}

function openDress(o, ctx, tile, hx) {
    const S = ctx.S,
        Y = G.CURB_H;
    let D = tile((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2).det;
    const trees = (ctx.openTrees ??= []),
        st = ctx.bvStats;
    const tree = (x, z, clear, y = Y) => {
        trees.push({
            x,
            z,
            kind: "street",
            clear,
            y,
            sc: 0.85 + hx(20 + (trees.length % 7)) * 0.3,
        });
        st.trees++;
    };
    const slab = (x0, z0, x1, z1, part, col, t = 0.015) =>
        D.setPart(part)
            .setColor(col)
            .box(x0, Y, z0, x1, Y + t, z1, 0b110111);
    const planter = (x0, z0, x1, z1, h) => {
        D.setPart(DP.CONC)
            .setColor(0x8a857c)
            .box(x0, Y, z0, x1, Y + h, z1, 0b110111);
        D.setPart(DP.CANVAS)
            .setColor(0x3c4a2c)
            .box(
                x0 + 0.15,
                Y + h,
                z0 + 0.15,
                x1 - 0.15,
                Y + h + 0.004,
                z1 - 0.15,
                0b000100,
            );
        S.box(x0, Y, z0, x1, Y + h, z1, "equipment", NOZIP);
    };
    const bench = (x, z, alongX, back) => {
        const L = 0.9,
            W = 0.24;
        const [a0, a1, c0, c1] = alongX
            ? [x - L, x + L, z - W, z + W]
            : [x - W, x + W, z - L, z + L];
        D.setPart(DP.WOOD)
            .setColor(0x6a4c32)
            .box(a0, Y + 0.4, c0, a1, Y + 0.46, c1, 0b111111);
        const bk = alongX
            ? [
                  a0,
                  Y + 0.46,
                  back > 0 ? c1 - 0.06 : c0,
                  a1,
                  Y + 0.85,
                  back > 0 ? c1 : c0 + 0.06,
              ]
            : [
                  back > 0 ? a1 - 0.06 : a0,
                  Y + 0.46,
                  c0,
                  back > 0 ? a1 : a0 + 0.06,
                  Y + 0.85,
                  c1,
              ];
        D.box(...bk, 0b111111);
        D.setPart(DP.STEEL).setColor(0x2a2c2e);
        for (const s of [0.12, 0.88]) {
            const p = alongX ? a0 + (a1 - a0) * s : c0 + (c1 - c0) * s;
            if (alongX)
                D.box(
                    p - 0.03,
                    Y,
                    c0 + 0.03,
                    p + 0.03,
                    Y + 0.4,
                    c1 - 0.03,
                    0b110011,
                );
            else
                D.box(
                    a0 + 0.03,
                    Y,
                    p - 0.03,
                    a1 - 0.03,
                    Y + 0.4,
                    p + 0.03,
                    0b110011,
                );
        }
        S.box(a0, Y, c0, a1, Y + 0.46, c1, "equipment", NOZIP);
        S.box(...bk, "equipment", NOZIP);
    };
    const fence = (x0, z0, x1, z1, h, pitch, col) => {
        const alongX = x1 - x0 > z1 - z0,
            len = alongX ? x1 - x0 : z1 - z0,
            n = Math.max(1, Math.round(len / pitch));
        D.setPart(DP.WIRE).setColor(col);
        for (let i = 0; i <= n; i++) {
            const p = (alongX ? x0 : z0) + (len * i) / n,
                t = i % 12 === 0 || i === n ? 0.04 : 0.012;
            if (alongX) D.box(p - t, Y, z0, p + t, Y + h, z1, 0b110011);
            else D.box(x0, Y, p - t, x1, Y + h, p + t, 0b110011);
        }
        D.setPart(DP.STEEL)
            .box(x0, Y + h - 0.05, z0, x1, Y + h, z1, 0b111111)
            .box(x0, Y + 0.1, z0, x1, Y + 0.14, z1, 0b111111);
        S.box(x0, Y, z0, x1, Y + h, z1, "wall", NOZIP);
    };
    const { x0, x1, z0, z1 } = o;
    if (o.kind === "square") {
        const at = (x, z) => {
            D = tile(x, z).det;
        };
        const cx = (x0 + x1) / 2,
            cz = (z0 + z1) / 2,
            PW = 4.5,
            CR = 9;
        at(cx, cz);
        slab(x0, z0, x1, z1, DP.CONC, 0x9a948a, 0.01);

        const gx = [
                [x0, cx - PW / 2 - 0.5],
                [cx + PW / 2 + 0.5, x1],
            ],
            gz = [
                [z0, cz - PW / 2 - 0.5],
                [cz + PW / 2 + 0.5, z1],
            ];
        for (const [a, c] of gx)
            for (const z of [z0 + 0.5, z1 - 0.56]) {
                at((a + c) / 2, z);
                fence(a + 0.5, z, c - 0.5, z + 0.06, 0.95, 0.15, 0x1c1e1f);
            }
        for (const [a, c] of gz)
            for (const x of [x0 + 0.5, x1 - 0.56]) {
                at(x, (a + c) / 2);
                fence(x, a + 0.5, x + 0.06, c - 0.5, 0.95, 0.15, 0x1c1e1f);
            }

        const lawns = [];
        for (const [a, c] of [
            [x0 + 4, cx - PW / 2],
            [cx + PW / 2, x1 - 4],
        ])
            for (const [e, f] of [
                [z0 + 4, cz - PW / 2],
                [cz + PW / 2, z1 - 4],
            ]) {
                const nearX =
                        a < cx
                            ? [c - (CR * 1.8 - PW / 2), c]
                            : [a, a + (CR * 1.8 - PW / 2)],
                    nearZ =
                        e < cz
                            ? [f - (CR - PW / 2), f]
                            : [e, e + (CR - PW / 2)];
                const farX = a < cx ? [a, nearX[0] - 0] : [nearX[1], c];
                lawns.push(
                    [farX[0], e, farX[1], f],
                    [
                        nearX[0],
                        e < cz ? e : nearZ[1],
                        nearX[1],
                        e < cz ? nearZ[0] : f,
                    ],
                );
            }
        for (const [a, e, c, f] of lawns) {
            if (c - a < 2 || f - e < 2) continue;
            at((a + c) / 2, (e + f) / 2);
            D.setPart(DP.CONC)
                .setColor(0x7c776e)
                .box(a, Y, e, c, Y + 0.018, f, 0b110111);
            D.setPart(DP.CANVAS)
                .setColor(0x4a5a30)
                .box(
                    a + 0.3,
                    Y + 0.018,
                    e + 0.3,
                    c - 0.3,
                    Y + (ZFIX ? 0.025 : 0.019),
                    f - 0.3,
                    0b000100,
                );
            for (let x = a + 3.5; x < c - 2.5; x += 7.2)
                for (let z = e + 3.5; z < f - 2.5; z += 7.2) {
                    const j = hash2(
                            Math.floor(x * 3.1) + 11,
                            Math.floor(z * 2.7) + 5,
                        ),
                        jx = x + (j - 0.5) * 2.4,
                        jz =
                            z +
                            (hash2(Math.floor(z * 5.3), Math.floor(x * 1.9)) -
                                0.5) *
                                2.4;
                    if (j < 0.12) continue;
                    trees.push({
                        x: jx,
                        z: jz,
                        kind: j < 0.25 ? "small" : "street",
                        clear: 5.5,
                        y: Y,
                        sc: 0.95 + j * 0.45,
                    });
                    st.trees++;
                }
        }

        at(cx, cz);
        D.setPart(DP.CONC)
            .setColor(0x8f8a80)
            .cyl(cx, Y, cz, 5.2, 5.2, 0.55, 28, true);
        D.setPart(DP.PAINT)
            .setColor(0x51646a)
            .cyl(cx, Y + 0.55, cz, 4.7, 4.7, 0.005, 28, true);
        D.setPart(DP.CONC)
            .setColor(0x9a958c)
            .cyl(cx, Y + 0.55, cz, 0.9, 0.6, 1.4, 12, true);
        S.cyl(
            cx,
            cz,
            Y,
            Y + 0.55,
            polyR(5.2, 28),
            polyR(5.2, 28),
            "equipment",
            NOZIP,
        );
        S.cyl(
            cx,
            cz,
            Y + 0.55,
            Y + 1.95,
            polyR(0.9, 12),
            polyR(0.6, 12),
            "equipment",
            NOZIP,
        );
        for (const [dx, dz, ax, bk] of [
            [-13, -6.5, true, -1],
            [13, -6.5, true, -1],
            [-13, 6.5, true, 1],
            [13, 6.5, true, 1],
            [-7, -6.5, true, -1],
            [7, -6.5, true, -1],
            [-7, 6.5, true, 1],
            [7, 6.5, true, 1],
        ])
            bench(cx + dx, cz + dz, ax, bk);

        for (let x = x0 + 8; x < x1 - 8; x += 9)
            if (Math.abs(x - cx) > CR * 1.8 + 2) {
                at(x, cz);
                bench(x, cz - PW / 2 - 0.35, true, -1);
                bench(x, cz + PW / 2 + 0.35, true, 1);
            }
        for (let z = z0 + 8; z < z1 - 8; z += 9)
            if (Math.abs(z - cz) > CR + 2) {
                at(cx, z);
                bench(cx - PW / 2 - 0.35, z, false, -1);
                bench(cx + PW / 2 + 0.35, z, false, 1);
            }
        return;
    }
    if (o.kind === "plaza") {
        const T = o.tower;

        const A = o.ax === "nx" ? [x0, z0, T.x0, z1] : [T.x1, z0, x1, z1];
        const B =
            o.az === "nz" ? [T.x0, z0, T.x1, T.z0] : [T.x0, T.z1, T.x1, z1];
        slab(...A, DP.CONC, 0xa29d93);
        slab(...B, DP.CONC, 0xa29d93);
        const aw = A[2] - A[0],
            ax = (A[0] + A[2]) / 2;
        for (let z = z0 + 5, k = 0; z < z1 - 4; z += 8.5, k++) {
            planter(ax - 1.1, z - 1.1, ax + 1.1, z + 1.1, 0.55);
            if (k % 3 !== 2) tree(ax, z, aw / 2, Y + 0.55);
            else bench(ax, z + 2.6, true, 1);
        }
        const bd = B[3] - B[1],
            bz = (B[1] + B[3]) / 2;
        if (bd >= 7)
            for (let x = T.x0 + 6, k = 0; x < T.x1 - 4; x += 10, k++) {
                if (k % 2) {
                    bench(x, bz, true, o.az === "nz" ? 1 : -1);
                    continue;
                }
                planter(x - 1.1, bz - 1.1, x + 1.1, bz + 1.1, 0.55);
                tree(x, bz, bd / 2, Y + 0.55);
            }
        return;
    }
    const sg = o.front === "nz" ? 1 : -1,
        zf = o.front === "nz" ? z0 : z1,
        _zr = o.front === "nz" ? z1 : z0;
    const zin = (d) => zf + sg * d;
    const Zs = (a, c) => [Math.min(zin(a), zin(c)), Math.max(zin(a), zin(c))];
    const dep = z1 - z0,
        w = x1 - x0,
        xc = (x0 + x1) / 2;
    const bollard = (x, z, col = 0x2a2c2e, h = 0.95) => {
        D.setPart(col === 0x2a2c2e ? DP.STEEL : DP.PAINT)
            .setColor(col)
            .cyl(x, Y, z, 0.11, 0.1, h, 8, true);
        S.cyl(
            x,
            z,
            Y,
            Y + h,
            polyR(0.11, 8),
            polyR(0.1, 8),
            "equipment",
            NOZIP,
        );
    };
    if (o.kind === "fore") {
        const [fz0, fz1] = Zs(0, dep - 0.02);
        if (o.v < 0.35) {
            slab(x0, fz0, x1, fz1, DP.CONC, 0x9b958b);
            const [gz0, gz1] = Zs(0.2, 0.25),
                gate = 1.0;
            fence(x0 + 0.1, gz0, xc - gate, gz1, 0.9, 0.12, 0x1c1e1f);
            fence(xc + gate, gz0, x1 - 0.1, gz1, 0.9, 0.12, 0x1c1e1f);
            const nS = Math.min(4, Math.floor((dep - 0.6) / 0.35));
            D.setPart(DP.CONC).setColor(0x8c8377);
            for (let i = 0; i < nS; i++) {
                const [a, c] = Zs(dep - 0.02 - (nS - i) * 0.35, dep - 0.02);
                D.box(
                    xc - 1.1,
                    Y,
                    a,
                    xc + 1.1,
                    Y + (i + 1) * 0.17,
                    c,
                    0b110111,
                );
                S.box(
                    xc - 1.1,
                    Y,
                    a,
                    xc + 1.1,
                    Y + (i + 1) * 0.17,
                    c,
                    "equipment",
                    NOZIP,
                );
            }
            if (xc - 1.5 - (x0 + 0.5) > 1.2) {
                const [pz0, pz1] = Zs(0.6, dep - 0.3);
                planter(x0 + 0.5, pz0, xc - 1.5, pz1, 0.35);
                planter(xc + 1.5, pz0, x1 - 0.5, pz1, 0.35);
            }
        } else if (o.v < 0.7) {
            slab(x0, fz0, x1, fz1, DP.CONC, 0xa9a397, 0.012);
            D.setPart(DP.CONC).setColor(0x7e7970);
            for (let x = x0 + 3; x < x1 - 1.5; x += 3)
                D.box(
                    x - 0.1,
                    Y + 0.012,
                    fz0,
                    x + 0.1,
                    Y + 0.016,
                    fz1,
                    0b000100,
                );
            const [bz0, bz1] = Zs(dep - 0.5, dep - 0.3);
            D.box(x0, Y + 0.012, bz0, x1, Y + 0.016, bz1, 0b000100);
            if (dep >= 3.5) {
                const [pz0, pz1] = Zs(1.2, Math.min(dep - 0.8, 3.2));
                planter(x0 + 0.6, pz0, x0 + 2.4, pz1, 0.55);
                tree(x0 + 1.5, (pz0 + pz1) / 2, 2.2, Y + 0.55);
                if (w > 12) {
                    planter(x1 - 2.4, pz0, x1 - 0.6, pz1, 0.55);
                    tree(x1 - 1.5, (pz0 + pz1) / 2, 2.2, Y + 0.55);
                }
                if (w > 9) bench(xc, zin(Math.min(dep - 1.2, 2.2)), true, sg);
            }
            for (let x = x0 + 3.5; x < x1 - 3; x += 1.8) bollard(x, zin(0.45));
        } else {
            slab(x0, fz0, x1, fz1, DP.CONC, 0xaaa499, 0.012);
            const tx = x0 + 1.5 + o.u * Math.max(0.1, w - 3),
                tz = zin(Math.min(1.4, dep / 2));
            D.setPart(DP.GRATE)
                .setColor(0x2c2b29)
                .box(
                    tx - 0.75,
                    Y + 0.012,
                    tz - 0.75,
                    tx + 0.75,
                    Y + 0.02,
                    tz + 0.75,
                    0b000100,
                );
            tree(tx, tz, 1.8);
            if (w > 10) {
                D.setPart(DP.STEEL).setColor(0x3a3c3e);
                const bx = tx < xc ? x1 - 3 : x0 + 3;
                for (let k = 0; k < 3; k++)
                    D.box(
                        bx - 0.4,
                        Y,
                        zin(1.0 + k * 0.8) - 0.03,
                        bx + 0.4,
                        Y + 0.85,
                        zin(1.0 + k * 0.8) + 0.03,
                        0b110011,
                    );
            }
        }
        return;
    }
    if (o.kind === "bay") {
        {
            const [az0, az1] = Zs(0, dep - 0.02);
            slab(x0, az0, x1, az1, DP.TAR, 0x4b4c4e, 0.012);
        }
        const dw = Math.min(w - 2, 9 + o.u * 3),
            dx0 = xc - dw / 2,
            dx1 = xc + dw / 2,
            [kz0, kz1] = Zs(dep - 1.7, dep - 0.02),
            DH = 1.15;
        D.setPart(DP.CONC)
            .setColor(0x8e897f)
            .box(dx0, Y, kz0, dx1, Y + DH, kz1, 0b110111);
        S.box(dx0, Y, kz0, dx1, Y + DH, kz1, "equipment", NOZIP);
        const [ez0, ez1] = Zs(dep - 1.7, dep - 1.55);
        D.setPart(DP.PAINT)
            .setColor(0xb8922a)
            .box(dx0, Y + DH, ez0, dx1, Y + DH + 0.004, ez1, 0b000100);
        D.setPart(DP.PAINT).setColor(0x161616);
        const [rz0, rz1] = Zs(dep - 1.84, dep - 1.7);
        for (let x = dx0 + 0.8; x < dx1 - 0.5; x += 1.6)
            D.box(x - 0.15, Y + 0.45, rz0, x + 0.15, Y + 1.05, rz1, 0b110111);
        const nd = dw > 10 ? 3 : 2,
            doorW = Math.min(3.4, dw / nd - 0.6);
        D.setPart(DP.GALV).setColor(0x6f7274);
        for (let i = 0; i < nd; i++) {
            const cx = dx0 + (dw * (i + 0.5)) / nd,
                [a, c] = Zs(dep - 0.1, dep - 0.02);
            D.box(
                cx - doorW / 2,
                Y + DH,
                a,
                cx + doorW / 2,
                Y + 4.4,
                c,
                0b110111,
            );
        }
        for (const x of [x0 + 0.5, x1 - 0.5])
            bollard(x, zin(0.5), 0xc9a227, 1.05);
        for (const x of [dx0 - 0.4, dx1 + 0.4])
            if (x > x0 + 1 && x < x1 - 1)
                bollard(x, zin(dep - 1.9), 0xc9a227, 1.05);
        const B = o.b;
        if (B) {
            const [cz0, cz1] = o.front === "nz" ? [B.z0, B.pz0] : [B.pz1, B.z1],
                ax0 = Math.max(x0 + 0.3, dx0 - 1),
                ax1 = Math.min(x1 - 0.3, dx1 + 1);
            if (cz1 - cz0 > 1 && ax1 - ax0 > 3) {
                const at = tile((ax0 + ax1) / 2, (cz0 + cz1) / 2).det;
                at.setPart(DP.CONC)
                    .setColor(0x8b867c)
                    .box(ax0, Y, cz0, ax1, Y + 0.012, cz1, 0b000100);
                at.setPart(DP.TAR).setColor(0x3a3b3c);
                const [q0, q1] =
                    o.front === "nz" ? [cz0, cz0 + 0.6] : [cz1 - 0.6, cz1];
                at.box(
                    ax0 + 0.6,
                    Y + 0.012,
                    q0,
                    ax1 - 0.6,
                    Y + 0.016,
                    q1,
                    0b000100,
                );
                addCurbCut({ x0: ax0, z0: cz0, x1: ax1, z1: cz1 });
            }
        }
        return;
    }
    if (o.kind === "park") {
        slab(x0, z0, x1, z1, DP.CONC, 0x958f84);

        const [bz0, bz1] = Zs(2.5, dep - 0.35);
        planter(x0, bz0, x0 + 1.8, bz1, 0.45);
        planter(x1 - 1.8, bz0, x1, bz1, 0.45);
        const [rz0, rz1] = Zs(dep - 0.35, dep);
        D.setPart(DP.BRICK)
            .setColor(0x7a4b3b)
            .box(x0 + 1.8, Y, rz0, x1 - 1.8, Y + 1.6, rz1, 0b110111);
        D.setPart(DP.CONC)
            .setColor(0xb0aa9e)
            .box(
                x0 + 1.8,
                Y + 1.6,
                rz0 - 0.05,
                x1 - 1.8,
                Y + 1.7,
                rz1 + 0.05,
                0b111111,
            );
        S.box(x0 + 1.8, Y, rz0, x1 - 1.8, Y + 1.6, rz1, "wall", NOZIP);
        S.box(
            x0 + 1.8,
            Y + 1.6,
            rz0 - 0.05,
            x1 - 1.8,
            Y + 1.7,
            rz1 + 0.05,
            "coping",
            NOZIP,
        );
        const [fz0, fz1] = Zs(0.25, 0.31),
            gate = 1.8;
        fence(x0, fz0, xc - gate, fz1, 1.1, 0.14, 0x1c1e1f);
        fence(xc + gate, fz0, x1, fz1, 1.1, 0.14, 0x1c1e1f);

        const cols = w >= 18 ? [x0 + w / 3, x0 + (2 * w) / 3] : [xc];
        const clear = cols.length > 1 ? w / 3 : w / 2 - 1;
        for (let d = 5, k = 0; d < dep - 3.5; d += 6.5, k++)
            for (const cx of cols) {
                const z = zin(d);
                D.setPart(DP.CONC)
                    .setColor(0x6f6a62)
                    .box(
                        cx - 0.7,
                        Y,
                        z - 0.7,
                        cx + 0.7,
                        Y + 0.08,
                        z + 0.7,
                        0b110111,
                    );
                D.setPart(DP.CANVAS)
                    .setColor(0x3a3027)
                    .box(
                        cx - 0.62,
                        Y + 0.08,
                        z - 0.62,
                        cx + 0.62,
                        Y + 0.084,
                        z + 0.62,
                        0b000100,
                    );
                S.box(
                    cx - 0.7,
                    Y,
                    z - 0.7,
                    cx + 0.7,
                    Y + 0.08,
                    z + 0.7,
                    "park",
                    NOZIP,
                );
                tree(cx, z, clear);
            }
        for (let d = 8.2; d < dep - 3; d += 6.5) {
            bench(x0 + 2.35, zin(d), false, -1);
            bench(x1 - 2.35, zin(d), false, 1);
        }
        return;
    }

    const park = o.kind === "parking";
    slab(x0, z0, x1, z1, park ? DP.TAR : DP.CONC, park ? 0x46474a : 0x6d665b);
    const [fz0, fz1] = Zs(0.2, 0.26),
        [rz0, rz1] = Zs(dep - 0.26, dep - 0.2);
    if (park) {
        const g0 = x0 + 1.5,
            g1 = Math.min(x1 - 1.5, g0 + 6.5);
        fence(g1, fz0, x1, fz1, 2.1, 0.09, 0x6b6e70);
    } else fence(x0, fz0, x1, fz1, 2.1, 0.09, 0x6b6e70);
    fence(x0, rz0, x1, rz1, 2.1, 0.09, 0x6b6e70);
    if (park) {
        D.setPart(DP.PAINT).setColor(0xa8a598);
        const rowsD =
            dep >= 19
                ? [
                      [dep - 5.6, dep - 0.6],
                      [0.8, 5.8],
                  ]
                : [[dep - 5.6, dep - 0.6]];
        for (const [a, c] of rowsD) {
            const [q0, q1] = Zs(a, c);
            for (let x = x0 + 0.6; x <= x1 - 0.5; x += 2.6)
                D.box(
                    x - 0.05,
                    Y + 0.015,
                    q0,
                    x + 0.05,
                    Y + 0.018,
                    q1,
                    0b000100,
                );
        }
    } else {
        D.setPart(DP.CANVAS).setColor(0x4c5434);
        for (let k = 0; k < 5; k++) {
            const x = x0 + 2 + hx(30 + k) * (w - 4),
                z = zin(2 + hx(40 + k) * (dep - 4)),
                r = 0.8 + hx(50 + k) * 1.6;
            D.box(
                x - r,
                Y + 0.015,
                z - r * 0.7,
                x + r,
                Y + 0.018,
                z + r * 0.7,
                0b000100,
            );
        }
    }
}

function splitTowerLot(lot, opts) {
    if (lot.kind !== "tower" || lot.reserved) return [lot];
    const hit = (e) =>
        lot.x1 > e.x0 && lot.x0 < e.x1 && lot.z1 > e.z0 && lot.z0 < e.z1;
    if (
        (opts.exclude || []).some(hit) ||
        (opts.force || []).some(
            (f) => f.x > lot.x0 && f.x < lot.x1 && f.z > lot.z0 && f.z < lot.z1,
        )
    )
        return [lot];
    const d = district(lot.cx, lot.cz),
        hot = Math.max(d.midtown, d.fidi);
    if (hot < 0.4 || d.water) return [lot];
    const h = mulberry32(
        (Math.floor(lot.cx * 5.3) * 73856093) ^
            (Math.floor(lot.cz * 4.7) * 19349663) ^
            0x51ab,
    );
    if (h() > 0.85) return [lot];
    const w = lot.x1 - lot.x0,
        D = lot.z1 - lot.z0;
    const xs = [lot.x0],
        zs = [lot.z0];
    if (w >= 78) {
        const a = w * (0.3 + h() * 0.06),
            c = w * (0.3 + h() * 0.06);
        xs.push(lot.x0 + a, lot.x1 - c);
    } else if (w >= 46) xs.push(lot.x0 + w * (0.4 + h() * 0.2));
    if (D >= 48 && h() < 0.8) zs.push(lot.z0 + D * (0.42 + h() * 0.16));
    xs.push(lot.x1);
    zs.push(lot.z1);
    if (xs.length === 2 && zs.length === 2) return [lot];
    const gap = h() < 0.4 ? 1.5 : 0;
    const out = [];
    for (let j = 0; j < zs.length - 1; j++)
        for (let i = 0; i < xs.length - 1; i++) {
            const inX0 = i > 0,
                inX1 = i < xs.length - 2,
                inZ0 = j > 0,
                inZ1 = j < zs.length - 2;
            const x0 = xs[i] + (inX0 ? gap : 0),
                x1 = xs[i + 1] - (inX1 ? gap : 0),
                z0 = zs[j] + (inZ0 ? gap : 0),
                z1 = zs[j + 1] - (inZ1 ? gap : 0);
            const it = gap > 0 ? "rear" : "party";
            const sides = {
                nx: inX0 ? it : lot.sides.nx,
                px: inX1 ? it : lot.sides.px,
                nz: inZ0 ? it : lot.sides.nz,
                pz: inZ1 ? it : lot.sides.pz,
            };
            out.push({
                ...lot,
                x0,
                x1,
                z0,
                z1,
                sides,
                cx: (x0 + x1) / 2,
                cz: (z0 + z1) / 2,
                subK: out.length,
            });
        }
    return out;
}

function subdivide(b, rnd) {
    const { px0, px1, pz0, pz1 } = b;
    const W = px1 - px0,
        D = pz1 - pz0;
    const cx = (px0 + px1) / 2,
        cz = (pz0 + pz1) / 2;
    const dist = district(cx, cz);
    const lots = [];
    const mk = (x0, x1, z0, z1, sides, kind) =>
        lots.push({
            x0,
            x1,
            z0,
            z1,
            sides,
            kind,
            cx: (x0 + x1) / 2,
            cz: (z0 + z1) / 2,
        });
    const side = (x0, x1, z0, z1) => ({
        nx: Math.abs(x0 - px0) < 0.1 ? "street" : "party",
        px: Math.abs(x1 - px1) < 0.1 ? "street" : "party",
        nz: Math.abs(z0 - pz0) < 0.1 ? "street" : "party",
        pz: Math.abs(z1 - pz1) < 0.1 ? "street" : "party",
    });
    const segs = [];
    const waterfront =
        dist.water &&
        (dist.midtown > 0.15 ||
            dist.fidi > 0.15 ||
            dist.upper ||
            rnd() < 0.3) &&
        W > 30;
    const pTower =
        dist.midtown * 1.25 +
        dist.fidi * 1.35 +
        (dist.harlem ? 0.06 : 0) +
        (dist.village > 0.6 ? 0 : 0.04);
    if (waterfront) {
        let x = px0;
        const n = W > 80 ? 2 : 1;
        const w = W / n;
        for (let i = 0; i < n; i++) {
            segs.push([x, x + w, "tower"]);
            x += w;
        }
    } else if (rnd() < pTower || (dist.parkEdge && rnd() < 0.45)) {
        const x = px0;
        const nT = rnd() < 0.5 ? 1 : 2;
        const tw = [];
        for (let i = 0; i < nT; i++) tw.push(45 + rnd() * 50);
        const pos =
            nT === 1 ? [rnd() < 0.5 ? 0 : rnd() < 0.5 ? 0.5 : 1] : [0, 1];
        const rows = [];
        let remaining = W - tw.reduce((a, c) => a + c, 0);
        if (remaining < 20) {
            tw[0] += remaining;
            remaining = 0;
        }
        if (nT === 1) {
            const a =
                pos[0] === 0 ? 0 : pos[0] === 1 ? remaining : remaining / 2;
            if (a > 0) rows.push([x, x + a]);
            segs.push(...rows.map((r) => [r[0], r[1], "rows"]));
            segs.push([x + a, x + a + tw[0], "tower"]);
            if (remaining - a > 0.1) segs.push([x + a + tw[0], px1, "rows"]);
        } else {
            segs.push([px0, px0 + tw[0], "tower"]);
            if (remaining > 0.1) segs.push([px0 + tw[0], px1 - tw[1], "rows"]);
            segs.push([px1 - tw[1], px1, "tower"]);
        }
    } else {
        segs.push([px0, px1, "rows"]);
    }
    for (const [x0, x1, kind] of segs) {
        if (x1 - x0 < 1) continue;
        if (kind === "tower") {
            mk(x0, x1, pz0, pz1, side(x0, x1, pz0, pz1), "tower");
            continue;
        }
        let a = x0,
            e = x1;
        if (Math.abs(a - px0) < 0.1 && e - a > 40) {
            const w = 16 + rnd() * 16;
            mk(a, a + w, pz0, pz1, side(a, a + w, pz0, pz1), "corner");
            a += w;
        }
        if (Math.abs(e - px1) < 0.1 && e - a > 40) {
            const w = 16 + rnd() * 16;
            mk(e - w, e, pz0, pz1, side(e - w, e, pz0, pz1), "corner");
            e -= w;
        }
        let gap = rnd() < 0.3 ? 0 : 5 + rnd() * 8;
        {
            const gh = mulberry32(
                (Math.floor(px0 * 7.7) * 73856093) ^
                    (Math.floor(pz0 * 5.3) * 19349663) ^
                    0x7a2d,
            );
            if (gap === 0 && gh() < 0.6) gap = 5 + gh() * 7;
        }
        const dN = (D - gap) / 2,
            dS = D - gap - dN;
        for (const row of [0, 1]) {
            let x = a;
            const z0 = row === 0 ? pz0 : pz1 - dS,
                z1 = row === 0 ? pz0 + dN : pz1;
            while (x < e - 0.1) {
                let w = rnd() < 0.55 ? 7 + rnd() * 8 : 14 + rnd() * 16;
                if (dist.harlem > 0.5 || dist.village > 0.6)
                    w = rnd() < 0.75 ? 6 + rnd() * 4 : 12 + rnd() * 12;
                if (e - (x + w) < 7) w = e - x;

                const hr = mulberry32(
                    (Math.floor(x * 13.7) * 73856093) ^
                        (Math.floor(z0 * 3.1 + row * 977) * 19349663),
                );
                const cut =
                    hr() < 0.55 && w < 32
                        ? Math.max(0, Math.min(2 + hr() * 9, z1 - z0 - 16))
                        : 0;
                const rz0 = row === 1 && cut > 0 ? z0 + cut : z0,
                    rz1 = row === 0 && cut > 0 ? z1 - cut : z1;
                const s = side(x, x + w, rz0, rz1);
                if (gap > 0 || cut > 0) {
                    if (row === 0) s.pz = "rear";
                    else s.nz = "rear";
                }
                mk(x, x + w, rz0, rz1, s, "row");
                x += w;
            }
        }
    }
    return lots;
}

const MASONRY = [
    [LAYER.RED, [0.93, 0.86, 0.83]],
    [LAYER.BROWN, [0.9, 0.85, 0.8]],
    [LAYER.BUFF, [1.0, 0.95, 0.86]],
    [LAYER.LIME, [0.98, 0.95, 0.88]],
    [LAYER.RED, [0.8, 0.72, 0.68]],
    [LAYER.WHITE, [0.98, 0.95, 0.89]],
    [LAYER.BROWN, [0.78, 0.7, 0.64]],
];
const famOf = (l) =>
    l === LAYER.WHITE || l === LAYER.LIME || l === LAYER.CONCRETE
        ? "pale"
        : l === LAYER.BUFF
          ? "buff"
          : "dark";
function streetVary(lot, A, placed) {
    if (A.type !== "loft" && A.type !== "walkup") return;
    if (A.style !== STYLE.PUNCHED) return;
    const h = mulberry32(
        (Math.floor(lot.cx * 5.3) * 73856093) ^
            (Math.floor(lot.cz * 4.1) * 19349663) ^
            0x57e3,
    );

    const across = [],
        adj = [];
    for (const o of placed) {
        const zOv = Math.min(o.z1, lot.z1) - Math.max(o.z0, lot.z0),
            xOv = Math.min(o.x1, lot.x1) - Math.max(o.x0, lot.x0);
        const gx = Math.max(o.x0 - lot.x1, lot.x0 - o.x1),
            gz = Math.max(o.z0 - lot.z1, lot.z0 - o.z1);
        if ((zOv > 4 && gx > 6 && gx < 48) || (xOv > 4 && gz > 6 && gz < 40))
            across.push(o);
        else if (
            (gx > -0.5 && gx < 0.6 && zOv > 2) ||
            (gz > -0.5 && gz < 0.6 && xOv > 2)
        )
            adj.push(o);
    }
    const light = (f) => f === "pale" || f === "buff";
    const score = (L) => {
        let s = 0;
        const f = famOf(L);
        for (const o of across) {
            const g = famOf(o.layer);
            s +=
                (g === f ? 10 : light(g) && light(f) ? 4 : 0) +
                (o.layer === L ? 3 : 0);
        }
        for (const o of adj)
            s += (famOf(o.layer) === f ? 2 : 0) + (o.layer === L ? 1 : 0);
        return s;
    };
    if (score(A.layer) > 0 || h() < 0.3) {
        const k0 = Math.floor(h() * MASONRY.length);
        let best = -1,
            bs = 1e9;
        for (let i = 0; i < MASONRY.length; i++) {
            const k = (k0 + i) % MASONRY.length,
                s = score(MASONRY[k][0]);
            if (s < bs) {
                bs = s;
                best = k;
            }
        }
        const [L, tn] = MASONRY[best];
        A.layer = L;
        A.tint = tintJitter(h, tn, 0.05);
    } else if (A.layer === LAYER.WHITE)
        A.tint = tintJitter(h, [0.97, 0.94, 0.88], 0.05);
    if (A.type === "loft") {
        const q = h();
        A.winW =
            q < 0.3
                ? 0.44 + h() * 0.08
                : q < 0.75
                  ? 0.52 + h() * 0.12
                  : 0.64 + h() * 0.1;
        A.winH = 0.5 + h() * 0.24;
        A.bayW = A.bayW * (0.88 + h() * 0.3);
        A.lintel = Math.floor(h() * 3);
        A.glass = Math.floor(h() * 4);
        if (h() < 0.4) A.resid = 1;
        if (h() < 0.35) A.fireEscape = true;
        A.seed = (A.seed ?? 0) + Math.floor(h() * 37) * 1.37;
    }
    placed.push({
        x0: lot.x0,
        x1: lot.x1,
        z0: lot.z0,
        z1: lot.z1,
        layer: A.layer,
    });
    if (placed.length > 400) placed.shift();
}

function chooseArch(lot, b, rnd) {
    const w = lot.x1 - lot.x0;
    const dist = district(lot.cx, lot.cz);
    const r = rnd();
    const A = {
        seed: rnd() * 100,
        resid: 0,
        lintel: Math.floor(rnd() * 3),
        glass: Math.floor(rnd() * 4),
        depth: 0.22,
        margin: 0.7,
    };
    const hot = Math.max(dist.midtown, dist.fidi);
    if (lot.kind === "tower") {
        const waterfront = !!dist.water;
        const pGlass = waterfront
            ? 0.7
            : 0.22 + hot * 0.34 + (dist.fidi > 0.3 ? 0.08 : 0);
        const hBoost =
            0.45 +
            dist.midtown * 1.05 +
            dist.fidi * 0.95 +
            (waterfront ? 0.35 : 0) +
            (dist.upper ? 0.15 : 0);
        if (dist.harlem > 0.5 && r < 0.8) {
            return {
                ...A,
                type: "postwar",
                style: STYLE.PUNCHED,
                layer: LAYER.RED,
                base: LAYER.CONCRETE,
                floorH: 2.9,
                bayW: 2.6,
                winW: 0.5,
                winH: 0.5,
                gH: 3.4,
                height: 3.4 + (14 + Math.floor(rnd() * 7)) * 2.9,
                depth: 0.12,
                margin: 0.8,
                tint: tintJitter(rnd, [0.95, 0.92, 0.9], 0.05),
                lintel: 0,
            };
        }

        const hr = mulberry32(
            (Math.floor(lot.cx * 3.7) * 73856093) ^
                (Math.floor(lot.cz * 2.9) * 19349663) ^
                0x5eed,
        );

        const dE = Math.hypot(lot.cx - 190, lot.cz - 280);
        const skin = (o) => {
            towerSkin(o, hr, dist);
            if (dE < 460)
                o.height = Math.min(
                    o.height,
                    dE < 130 ? 55 + dE * 0.4 : 107 + (dE - 130) * 0.8,
                );

            const hot2 = Math.max(dist.midtown * (dE < 200 ? 0 : 1), dist.fidi);
            if (hot2 > 0.3 && o.height < 95 + 60 * hot2)
                o.height = Math.min(
                    dE < 460 && dE >= 130 ? 107 + (dE - 130) * 0.8 : 1e9,
                    (95 + 60 * hot2) * (0.85 + 0.45 * hr()),
                );
            if (dist.fidi > 0.35) o.height *= 1.08 + 0.2 * hr();

            if (lot.subK !== undefined) {
                const u = hr();
                o.height = Math.max(
                    70,
                    o.height * (u < 0.35 ? 0.45 + u : 0.72 + 0.4 * u),
                );
            }
            o.height = Math.min(o.height, o.shape === "slender" ? 318 : 290);
            return o;
        };
        if (r < pGlass) {
            return skin({
                ...A,
                type: "glass",
                style: STYLE.CURTAIN,
                layer: LAYER.METAL,
                base: LAYER.GRANITE,
                floorH: 4.0,
                bayW: 1.55,
                winW: 0.97,
                winH: 0.74,
                gH: 6.5,
                height: (90 + rnd() * 150) * hBoost,
                margin: 0,
                depth: 0.04,
                tint: [1, 1, 1],
                podium: rnd() < 0.45,
            });
        }
        if (r < pGlass + 0.45) {
            const lay = rnd() < 0.6 ? LAYER.LIME : LAYER.BUFF;
            return skin({
                ...A,
                type: "deco",
                style: STYLE.DECO,
                layer: lay,
                base: LAYER.GRANITE,
                floorH: 3.8,
                bayW: 1.9,
                winW: 0.52,
                winH: 0.62,
                gH: 6.0,
                height: (70 + rnd() * 110) * hBoost,
                depth: 0.3,
                margin: 1.2,
                tint: tintJitter(rnd, [1, 0.98, 0.94], 0.06),
                lintel: 0,
            });
        }
        return skin({
            ...A,
            type: "postwar",
            style: STYLE.RIBBON,
            layer: rnd() < 0.5 ? LAYER.WHITE : LAYER.CONCRETE,
            base: LAYER.GRANITE,
            floorH: 3.6,
            bayW: 1.6,
            winW: 1.0,
            winH: 0.46,
            gH: 5.5,
            height: (55 + rnd() * 80) * hBoost,
            depth: 0.12,
            margin: 0.4,
            tint: tintJitter(rnd, [1, 1, 1], 0.04),
            lintel: 0,
        });
    }
    const small = w < 13;
    const parkEdge = dist.parkEdge > 0;
    if ((parkEdge || dist.upper) && !small && rnd() < (parkEdge ? 0.7 : 0.55)) {
        const lay = [LAYER.BROWN, LAYER.BUFF, LAYER.RED, LAYER.LIME][
            Math.floor(rnd() * 4)
        ];
        return {
            ...A,
            type: "apt",
            style: STYLE.PUNCHED,
            layer: lay,
            base: LAYER.LIME,
            floorH: 3.1,
            bayW: 2.5,
            winW: 0.46,
            winH: 0.52,
            gH: 4.8,
            height: (parkEdge ? 45 : 32) + rnd() * (parkEdge ? 55 : 30),
            resid: 1,
            tint: tintJitter(rnd, [1, 1, 1], 0.08),
            cornice: true,
            waterTower: rnd() < 0.5,
        };
    }
    const lowrise = dist.harlem > 0.5 || dist.village > 0.55;
    if (small || (lowrise && rnd() < 0.75)) {
        const lay =
            dist.harlem > 0.5
                ? rnd() < 0.6
                    ? LAYER.BROWN
                    : LAYER.RED
                : rnd() < 0.55
                  ? LAYER.RED
                  : rnd() < 0.6
                    ? LAYER.BROWN
                    : LAYER.BUFF;
        const floors = Math.floor(
            3 + rnd() * 3 + (lowrise ? 0 : dist.midtown * rnd() * 8 + 1),
        );
        return {
            ...A,
            type: "walkup",
            style: STYLE.PUNCHED,
            layer: lay,
            base: rnd() < 0.5 ? LAYER.LIME : LAYER.GRANITE,
            floorH: 3.2,
            bayW: 2.3 + rnd() * 0.5,
            winW: 0.5,
            winH: 0.55,
            gH: 4.2,
            height: 4.2 + floors * 3.2,
            resid: rnd() < 0.7 ? 1 : 0,
            tint: tintJitter(rnd, [1, 1, 1], 0.1),
            cornice: true,
            waterTower: rnd() < 0.3,
            fireEscape: rnd() < 0.5,
            margin: 0.5,
        };
    }
    const lay = [LAYER.LIME, LAYER.BUFF, LAYER.RED, LAYER.BROWN, LAYER.WHITE][
        Math.floor(rnd() * 5)
    ];
    const floors = Math.floor(
        (lowrise ? 5 : 7) + rnd() * (lowrise ? 4 : 7) + hot * rnd() * 20,
    );
    return {
        ...A,
        type: "loft",
        style: STYLE.PUNCHED,
        layer: lay,
        base: rnd() < 0.5 ? LAYER.LIME : LAYER.GRANITE,
        floorH: 3.6,
        bayW: 1.9 + rnd() * 0.8,
        winW: 0.52 + rnd() * 0.12,
        winH: 0.6,
        gH: 5.2,
        height: 5.2 + floors * 3.6,
        tint: tintJitter(rnd, [0.87, 0.86, 0.84], 0.1),
        cornice: rnd() < 0.8,
        waterTower: rnd() < 0.45,
        margin: 0.8,
    };
}

function towerSkin(o, hr, dist) {
    const q = hr();
    const tone = (base, amt = 0.06) => tintJitter(hr, base, amt);

    if (
        o.type === "deco" &&
        Math.max(dist.midtown, dist.fidi) > 0.3 &&
        hr() < 0.24
    )
        Object.assign(o, {
            type: "glass",
            style: STYLE.CURTAIN,
            layer: LAYER.METAL,
            base: LAYER.GRANITE,
            floorH: 4.0,
            bayW: 1.55,
            winW: 0.97,
            winH: 0.74,
            gH: 6.5,
            margin: 0,
            depth: 0.04,
            tint: [1, 1, 1],
            podium: false,
            height: o.height * 1.15,
        });
    if (o.type === "deco") {
        if (q < 0.17)
            Object.assign(o, {
                layer: LAYER.LIME,
                tint: tone([1.0, 0.96, 0.9]),
            });
        else if (q < 0.24)
            Object.assign(o, {
                layer: LAYER.WHITE,
                tint: tone([0.98, 0.95, 0.9]),
            });
        else if (q < 0.31)
            Object.assign(o, {
                layer: LAYER.CONCRETE,
                tint: tone([0.96, 0.94, 0.9]),
            });
        else if (q < 0.44)
            Object.assign(o, {
                layer: LAYER.BUFF,
                tint: tone([0.98, 0.9, 0.8]),
            });
        else if (q < 0.5)
            Object.assign(o, {
                layer: LAYER.LIME,
                tint: tone([1.0, 0.86, 0.72]),
            });
        else if (q < 0.66)
            Object.assign(o, {
                layer: LAYER.RED,
                tint: tone([0.9, 0.78, 0.72]),
            });
        else if (q < 0.8)
            Object.assign(o, {
                layer: LAYER.BROWN,
                tint: tone([0.78, 0.7, 0.64]),
            });
        else if (q < 0.88)
            Object.assign(o, {
                layer: LAYER.LIME,
                tint: tone([0.86, 0.85, 0.82]),
            });
        else if (q < 0.94)
            Object.assign(o, {
                layer: LAYER.BROWN,
                tint: tone([0.56, 0.5, 0.46]),
            });
        else
            Object.assign(o, {
                layer: LAYER.GRANITE,
                tint: tone([0.66, 0.66, 0.68]),
            });
        if (o.layer !== LAYER.LIME && o.layer !== LAYER.WHITE && hr() < 0.45)
            Object.assign(o, {
                style: STYLE.PUNCHED,
                lintel: 2,
                bayW: 2.1,
                winW: 0.5,
                winH: 0.58,
                depth: 0.25,
            });
        o.cornice = hr() < 0.35;
        o.crownKind = hr();

        if (dist.fidi > 0.35 && o.crownKind > 0.46)
            o.crownKind =
                o.crownKind < 0.75
                    ? 0.05 + o.crownKind * 0.2
                    : 0.26 + (o.crownKind - 0.75) * 0.16;
        if (dist.fidi > 0.35) o.fidiSpire = true;
    } else if (o.type === "postwar") {
        if (q < 0.3)
            Object.assign(o, {
                layer: LAYER.WHITE,
                tint: tone([0.96, 0.96, 0.95]),
            });
        else if (q < 0.56)
            Object.assign(o, {
                layer: LAYER.CONCRETE,
                tint: tone([0.92, 0.92, 0.93]),
            });
        else if (q < 0.72)
            Object.assign(o, {
                layer: LAYER.LIME,
                tint: tone([0.95, 0.93, 0.89]),
            });
        else if (q < 0.87)
            Object.assign(o, {
                layer: LAYER.BROWN,
                style: STYLE.RIBBON,
                tint: tone([0.82, 0.79, 0.77]),
            });
        else
            Object.assign(o, {
                layer: LAYER.METAL,
                tint: tone([1.35, 1.35, 1.38]),
                winH: 0.52,
            });
        if (o.layer === LAYER.LIME && hr() < 0.45)
            o.tint = tone([1.0, 0.9, 0.78]);
    } else if (o.type === "glass") {
        o.glass = q < 0.28 ? 0 : q < 0.44 ? 1 : q < 0.72 ? 4 : q < 0.9 ? 2 : 3;
        if (dist.fidi > 0.3 && hr() < 0.3) o.glass = 2;

        {
            const g2 = hr();
            if (g2 < 0.17) o.glass = 6;
            else if (g2 < 0.29) o.glass = 5;
            else if (g2 < 0.34) o.glass = 7;
        }

        const bq = hr();
        Object.assign(o, {
            bayW:
                bq < 0.2
                    ? 1.25
                    : bq < 0.5
                      ? 1.55
                      : bq < 0.75
                        ? 2.0
                        : bq < 0.9
                          ? 3.0
                          : 4.5,
            winH: 0.6 + hr() * 0.32,
            floorH: 3.7 + Math.floor(hr() * 4) * 0.2,
        });
    }

    if (o.type !== "deco" || hr() < 0.7) {
        const hq = hr(),
            hot = Math.max(dist.midtown, dist.fidi);
        if (hot > 0.35 && hq < 0.2 && o.type !== "postwar") {
            o.height *= 1.2 + hr() * 0.35;
            o.shape = "slender";
        } else if (hq > 0.75) o.height *= 0.62 + hr() * 0.15;
    }

    o.height = Math.min(
        o.height,
        o.shape === "slender"
            ? dist.fidi > 0.3
                ? 300
                : 318
            : dist.fidi > 0.3
              ? 265
              : 290,
    );
    return o;
}

function faceTypes(mass, lot) {
    const t = {};
    const e = 0.3;
    t.nx = Math.abs(mass.x0 - lot.x0) < e ? lot.sides.nx : "setback";
    t.px = Math.abs(mass.x1 - lot.x1) < e ? lot.sides.px : "setback";
    t.nz = Math.abs(mass.z0 - lot.z0) < e ? lot.sides.nz : "setback";
    t.pz = Math.abs(mass.z1 - lot.z1) < e ? lot.sides.pz : "setback";
    if (mass.sides) Object.assign(t, mass.sides);
    return t;
}
const OUT = { nx: [-1, 0], px: [1, 0], nz: [0, -1], pz: [0, 1] };
const TIER_BAND = { deco: 1, postwar: 1, apt: 1, loft: 1 };

function trimRun(
    F,
    S,
    m,
    s,
    o,
    y0,
    y1,
    p,
    ext,
    kind,
    flags = OVERHANG,
    bottom = true,
) {
    let bx;
    if (s === "nz") bx = [m.x0 - ext.nx, m.z0 - o, m.x1 + ext.px, m.z0];
    else if (s === "pz") bx = [m.x0 - ext.nx, m.z1, m.x1 + ext.px, m.z1 + o];
    else if (s === "nx") bx = [m.x0 - o, m.z0, m.x0, m.z1];
    else bx = [m.x1, m.z0, m.x1 + o, m.z1];
    const faces = {};
    faces[{ nz: "pz", pz: "nz", nx: "px", px: "nx" }[s]] = null;
    if (s === "nx" || s === "px") {
        if (ext.nz > 0) faces.nz = null;
        if (ext.pz > 0) faces.pz = null;
    }
    F.box(bx[0], y0, bx[1], bx[2], y1, bx[3], p, faces, true, bottom);
    S.box(bx[0], y0, bx[1], bx[2], y1, bx[3], kind, flags);
}

const fract = (x) => x - Math.floor(x);
function pierRibs(F, S, m, ft, A, masses, top) {
    if (globalThis.__noRibs) return;
    const p = m.p,
        st = p.style ?? A.style;
    const curtain = st === STYLE.CURTAIN,
        deco = st === STYLE.DECO,
        ribbon = st === STYLE.RIBBON,
        brick = st === STYLE.PUNCHED && A.type === "deco";
    if (!curtain && !deco && !ribbon && !brick) return;
    const seed = p.seed ?? 0,
        sh = fract(seed * 3.91 + 0.13);
    const banded =
        TIER_BAND[A.type] &&
        m.parapet > 0 &&
        top > 28 &&
        Math.min(m.x1 - m.x0, m.z1 - m.z0) > 8;
    const yA = m.y0 < 0.1 ? A.gH + 0.6 : m.y0 + 0.02,
        yB = top - (banded ? 1.45 : 0.15);
    if (yB - yA < 15) return;
    let K,
        w,
        d,
        rp;
    const off = 0;
    const usable0 = (W) => W - 2 * (p.margin ?? 0);
    if (curtain) {
        if (top - A.gH <= 36 || fract(seed * 6.17 + 0.23) <= 0.45) return;
        K = 2 + Math.floor(fract(seed * 9.31) * 4);
        w = 0.3 + 0.2 * fract(seed * 1.77);
        d = 0.6;
        const cq = fract(seed * 4.39 + 0.5);
        rp = {
            ...p,
            style: STYLE.BLANK,
            layer: LAYER.METAL,
            tint:
                cq < 0.4
                    ? [2.1, 2.15, 2.2]
                    : cq < 0.62
                      ? [0.95, 0.82, 0.66]
                      : cq < 0.82
                        ? [0.6, 0.62, 0.65]
                        : [2.7, 2.72, 2.7],
        };
    } else {
        const bw0 = p.bayW ?? 2;
        const pierW = bw0 * (1 - (p.winW ?? 0.5));
        if (deco) {
            K = sh < 0.45 ? 1 : 2;
            w = Math.min(0.62, pierW * 0.72);
            d = 0.34;
        } else if (brick) {
            K = 3;
            w = Math.min(0.6, pierW * 0.5);
            d = 0.28;
        } else {
            K = 2 + Math.floor(sh * 3);
            w = 0.36;
            d = 0.45;
        }
        rp = {
            ...p,
            style: STYLE.BLANK,
            tint: (p.tint ?? [1, 1, 1]).map((c) => c * 1.07),
        };
    }
    rp.topY = yB;
    rp.baseY = 0;
    for (const s of ["nz", "pz", "nx", "px"]) {
        if (ft[s] === "party") continue;
        const alongX = s === "nz" || s === "pz",
            W = alongX ? m.x1 - m.x0 : m.z1 - m.z0;
        const usable = usable0(W),
            nb = Math.max(1, Math.floor(usable / (p.bayW ?? 2) + 0.5)),
            bw = usable / nb;
        let KK = K;
        while (nb / KK > 16) KK++;
        const n = Math.floor(nb / KK);
        for (let j = 0; j <= n; j++) {
            const k = j * KK;
            if (curtain && (k === 0 || k >= nb)) continue;
            const uc = (p.margin ?? 0) + k * bw + off;
            const major = !curtain && j % 4 === 0 && j > 0 && k < nb;
            const hw = (major ? Math.min(w * 1.45, bw * 0.45) : w) / 2,
                dd = major ? d * 1.7 : d;

            const c =
                s === "pz"
                    ? m.x0 + uc
                    : s === "nz"
                      ? m.x1 - uc
                      : s === "px"
                        ? m.z1 - uc
                        : m.z0 + uc;
            let bx;
            if (s === "nz") bx = [c - hw, m.z0 - dd, c + hw, m.z0];
            else if (s === "pz") bx = [c - hw, m.z1, c + hw, m.z1 + dd];
            else if (s === "nx") bx = [m.x0 - dd, c - hw, m.x0, c + hw];
            else bx = [m.x1, c - hw, m.x1 + dd, c + hw];
            const px = (bx[0] + bx[2]) / 2,
                pz = (bx[1] + bx[3]) / 2;
            if (
                masses.some(
                    (o) =>
                        o !== m &&
                        o.y1 > yA + 1 &&
                        o.y0 < yB - 1 &&
                        px > o.x0 - 0.05 &&
                        px < o.x1 + 0.05 &&
                        pz > o.z0 - 0.05 &&
                        pz < o.z1 + 0.05,
                )
            )
                continue;
            const faces = {};
            faces[{ nz: "pz", pz: "nz", nx: "px", px: "nx" }[s]] = null;
            F.box(bx[0], yA, bx[1], bx[2], yB, bx[3], rp, faces, true, false);
            S.box(bx[0], yA, bx[1], bx[2], yB, bx[3], "wall");
        }
    }
}

const f32 = Math.fround;
const zfr = (s, a, b) => {
    const v = f32(f32(f32(s) * f32(a)) + f32(b));
    return v - Math.floor(v);
};
function zoneBelts(F, S, mg, ft0, A) {
    const p = mg.p,
        seed = p.seed ?? 0,
        fh = p.floorH ?? A.floorH,
        gH = A.gH;
    const topY = mg.y1 + (mg.parapet ?? 0);
    const nF = Math.floor((topY - gH) / fh + 0.01);
    const zH1 = zfr(seed, 2.37, 0.11),
        zH2 = zfr(seed, 4.73, 0.59);
    const zBase = nF >= 5 ? 1 + (zH1 >= 0.55 && nF >= 9 ? 1 : 0) : 0;
    const zCap = nF >= 6 ? 1 + (zH2 >= 0.6 && nF >= 11 ? 1 : 0) : 0;
    const bands = [];
    if (zBase)
        bands.push([gH + zBase * fh + 0.02, gH + zBase * fh + 0.42, 0.16]);
    if (zCap && mg.y1 - (gH + (nF - zCap) * fh) > 1)
        bands.push([gH + (nF - zCap) * fh - 0.36, gH + (nF - zCap) * fh, 0.13]);

    if (nF - zBase - zCap >= 11) {
        const K = 6 + Math.floor(zfr(seed, 3.31, 0.47) * 3);
        for (let bF = zBase + K; bF <= nF - zCap - 3; bF += K)
            bands.push([gH + bF * fh - 0.02, gH + bF * fh + 0.5, 0.12]);
    }
    const light = p.layer === LAYER.LIME || p.layer === LAYER.WHITE;
    const bp = {
        ...p,
        style: STYLE.BLANK,
        layer: light ? p.layer : LAYER.LIME,
        tint: [0.9, 0.88, 0.83],
    };
    for (const [y0, y1, o] of bands) {
        if (y1 > mg.y1 - 0.5) continue;
        const ext = {};
        for (const s of ["nx", "px", "nz", "pz"])
            ext[s] = ft0[s] === "street" ? o : 0;
        for (const s of ["nz", "pz", "nx", "px"])
            if (ft0[s] === "street")
                trimRun(F, S, mg, s, o, y0, y1, bp, ext, "ledge");
    }
}

function emitBuilding(lot, A, b, r, tile, ctx) {
    const { S, Z } = ctx;
    const T = tile(lot.cx, lot.cz);
    const F = T.fac,
        D = T.det,
        FL = T.lod;
    const core = b.core;
    let H = A.height;
    const floors = Math.max(2, Math.round((H - A.gH) / A.floorH));
    H = A.gH + floors * A.floorH;
    const P = {
        floorH: A.floorH,
        bayW: A.bayW,
        winW: A.winW,
        winH: A.winH,
        layer: A.layer,
        base: A.base,
        seed: A.seed,
        resid: A.resid,
        lintel: A.lintel,
        glass: A.glass,
        depth: A.depth,
        margin: A.margin,
        tint: A.tint,
        baseY: 0,
    };
    const masses = [];
    const inset = (m, k) => ({
        x0: m.x0 + k,
        x1: m.x1 - k,
        z0: m.z0 + k,
        z1: m.z1 - k,
    });
    const lw = lot.x1 - lot.x0,
        ld = lot.z1 - lot.z0;
    const parH = 0.95 + Math.floor(r() * 4) * 0.1;
    const shapeFn = typeof A.shape === "function" ? A.shape : SHAPES[A.shape];
    const shaped = shapeFn ? shapeFn(lot, A, P, r, H, parH) : null;
    if (shaped) masses.push(...shaped);
    else if (A.type === "glass") {
        if (A.podium) {
            const ph = A.gH + 4 * A.floorH;
            masses.push({
                ...lot,
                y0: 0,
                y1: ph,
                p: {
                    ...P,
                    style: STYLE.PUNCHED,
                    layer: LAYER.LIME,
                    winW: 0.62,
                    winH: 0.66,
                    depth: 0.3,
                    margin: 1.0,
                    tint: [1, 0.98, 0.95],
                },
                parapet: 1.0,
            });
            const k = Math.min(6, Math.min(lw, ld) * 0.12);
            masses.push({ ...inset(lot, k), y0: ph, y1: H, p: P, parapet: 0 });
        } else if (r() < 0.5 && H > 150) {
            const h1 = H * (0.55 + r() * 0.2);
            masses.push({ ...lot, y0: 0, y1: h1, p: P, parapet: 0 });
            masses.push({
                ...inset(lot, Math.min(7, Math.min(lw, ld) * 0.15)),
                y0: h1,
                y1: H,
                p: P,
                parapet: 0,
            });
        } else {
            masses.push({ ...lot, y0: 0, y1: H, p: P, parapet: 0 });
        }
    } else if (A.type === "deco") {
        const sheer = r() < 0.32;
        const steps = sheer ? 1 : 2 + Math.floor(r() * 3);
        let m = { ...lot },
            y = 0;
        const hs = [];
        let acc = sheer ? 0.72 + r() * 0.18 : 0.45 + r() * 0.15;
        for (let i = 0; i < steps; i++) {
            hs.push(acc);
            acc += (1 - acc) * (0.45 + r() * 0.2);
        }
        hs.push(1);
        for (let i = 0; i <= steps; i++) {
            const y1 =
                A.gH + Math.round(((H - A.gH) * hs[i]) / A.floorH) * A.floorH;
            if (y1 - y < A.floorH * 2 && i < steps) continue;
            masses.push({ ...m, y0: y, y1, p: P, parapet: 1.2 });
            y = y1;
            const k = Math.min(
                2 + r() * 6,
                (Math.min(m.x1 - m.x0, m.z1 - m.z0) - 12) / 2,
            );
            if (k <= 1) break;
            m = inset(m, k);
        }
        const top = masses[masses.length - 1];
        const cw = Math.min(top.x1 - top.x0, top.z1 - top.z0);
        const ck = A.crownKind ?? 0.55;
        const crownTiers = (m0, n, hk, kk, p, par, crown) => {
            let m = m0,
                y = m0.y1;
            for (let i = 0; i < n; i++) {
                const k = Math.max(
                    1.2,
                    Math.min(m.x1 - m.x0, m.z1 - m.z0) * kk,
                );
                const nm = inset(m, k);
                if (Math.min(nm.x1 - nm.x0, nm.z1 - nm.z0) < 4) break;
                const h = typeof hk === "function" ? hk(i) : hk;
                masses.push({
                    ...nm,
                    y0: y,
                    y1: y + h,
                    p,
                    parapet: par,
                    crown,
                    sides: {
                        nx: "setback",
                        px: "setback",
                        nz: "setback",
                        pz: "setback",
                    },
                });
                m = { ...nm, y1: y + h };
                y += h;
            }
            return m;
        };
        const finial = (m, h, w = 0.35) => {
            const sx = (m.x0 + m.x1) / 2,
                sz = (m.z0 + m.z1) / 2,
                y0 = m.y1;
            const mp = {
                ...P,
                style: STYLE.BLANK,
                layer: LAYER.METAL,
                tint: [2.5, 2.52, 2.58],
            };
            for (const B of [F, FL])
                B.box(sx - w, y0, sz - w, sx + w, y0 + h, sz + w, mp, {}, true);
            S.box(sx - w, y0, sz - w, sx + w, y0 + h, sz + w, "antenna");
            Z.add(sx, y0 + h, sz, 0, 1, 0, "antenna");
        };
        if (cw > 10 && ck < 0.26) {
            const n = 2 + (Math.floor(ck * 11.5) % 2);
            const m = crownTiers(
                top,
                n,
                (i) => A.floorH * (4 - i),
                0.13,
                P,
                1.0,
                false,
            );
            const t = crownTiers(
                m,
                2,
                3.2,
                0.2,
                { ...P, style: STYLE.BLANK },
                0.6,
                true,
            );
            if (ck < 0.1 || (A.fidiSpire && ck < 0.2))
                finial(
                    t,
                    8 + ck * 40 + (A.fidiSpire ? 22 : 0),
                    A.fidiSpire ? 0.5 : 0.35,
                );
        } else if (cw > 10 && ck < 0.34) {
            const pat = {
                ...P,
                style: STYLE.BLANK,
                layer: LAYER.CONCRETE,
                tint: [0.26 + ck * 0.2, 0.6, 0.48],
            };
            const m = crownTiers(top, 1, A.floorH * 2, 0.06, P, 0, false);
            const t = crownTiers(m, 6, 1.7, 0.075, pat, 0, true);
            finial(t, 5 + ck * 20, 0.25);
        } else if (cw > 10 && ck >= 0.62 && ck < 0.8) {
            const m = crownTiers(top, 2, A.floorH * 4, 0.16, P, 1.1, false);
            const t = crownTiers(
                m,
                3,
                2.4,
                0.14,
                { ...P, style: STYLE.BLANK },
                0,
                true,
            );
            if (ck > 0.75) finial(t, 20 + ck * 20, 0.45);
        } else if (cw > 14 && ck >= 0.8) {
            let m = top,
                y = top.y1;
            for (let i = 0; i < 2; i++) {
                const k = Math.max(
                        1.5,
                        Math.min(m.x1 - m.x0, m.z1 - m.z0) * 0.1,
                    ),
                    nm = inset(m, k);
                const c = Math.min(nm.x1 - nm.x0, nm.z1 - nm.z0) * 0.16,
                    h = A.floorH * (i ? 3 : 5);
                if (Math.min(nm.x1 - nm.x0, nm.z1 - nm.z0) < 8) break;
                const UPc = {
                    nx: "setback",
                    px: "setback",
                    nz: "setback",
                    pz: "setback",
                };
                masses.push({
                    x0: nm.x0 + c,
                    x1: nm.x1 - c,
                    z0: nm.z0,
                    z1: nm.z1,
                    y0: y,
                    y1: y + h,
                    p: P,
                    parapet: 0.9,
                    sides: { ...UPc },
                });
                masses.push({
                    x0: nm.x0,
                    x1: nm.x0 + c,
                    z0: nm.z0 + c,
                    z1: nm.z1 - c,
                    y0: y,
                    y1: y + h,
                    p: P,
                    parapet: 0.9,
                    sides: { ...UPc, px: "party" },
                });
                masses.push({
                    x0: nm.x1 - c,
                    x1: nm.x1,
                    z0: nm.z0 + c,
                    z1: nm.z1 - c,
                    y0: y,
                    y1: y + h,
                    p: P,
                    parapet: 0.9,
                    sides: { ...UPc, nx: "party" },
                });
                m = { ...nm, x0: nm.x0 + c, x1: nm.x1 - c, y1: y + h };
                y += h;
            }
            const t = crownTiers(
                m,
                2,
                3.0,
                0.18,
                { ...P, style: STYLE.BLANK },
                0.5,
                true,
            );
            if (ck > 0.9) finial(t, 10 + ck * 18, 0.35);
        } else if (cw > 10 && ck < 0.62) {
            const c = inset(top, cw * 0.28);

            const rq = r();
            const pat =
                rq > 0.6
                    ? {
                          ...P,
                          style: STYLE.BLANK,
                          layer: LAYER.CONCRETE,
                          tint: [0.34 + 0.2 * (rq - 0.6), 0.6, 0.5],
                      }
                    : { ...P, style: STYLE.BLANK };
            masses.push({
                ...c,
                y0: top.y1,
                y1: top.y1 + 8,
                p: pat,
                parapet: 0,
                crown: true,
            });
            if (rq < 0.25) {
                const sx = (c.x0 + c.x1) / 2,
                    sz = (c.z0 + c.z1) / 2;
                const sw = Math.min(c.x1 - c.x0, c.z1 - c.z0) * 0.3;
                const mp = {
                    ...P,
                    style: STYLE.BLANK,
                    layer: LAYER.METAL,
                    tint: [1.9, 1.92, 1.98],
                };
                const y8 = top.y1 + 8,
                    y20 = top.y1 + 20,
                    yt = top.y1 + 30 + r() * 12;
                F.box(
                    sx - sw / 2,
                    y8,
                    sz - sw / 2,
                    sx + sw / 2,
                    y20,
                    sz + sw / 2,
                    mp,
                    {},
                    true,
                );
                S.box(
                    sx - sw / 2,
                    y8,
                    sz - sw / 2,
                    sx + sw / 2,
                    y20,
                    sz + sw / 2,
                    "spire",
                );
                F.box(
                    sx - 0.4,
                    y20,
                    sz - 0.4,
                    sx + 0.4,
                    yt,
                    sz + 0.4,
                    mp,
                    {},
                    true,
                );
                FL.box(
                    sx - sw / 2,
                    y8,
                    sz - sw / 2,
                    sx + sw / 2,
                    y20,
                    sz + sw / 2,
                    mp,
                    {},
                    true,
                );
                FL.box(
                    sx - 0.4,
                    y20,
                    sz - 0.4,
                    sx + 0.4,
                    yt,
                    sz + 0.4,
                    mp,
                    {},
                    true,
                );
                S.box(
                    sx - 0.4,
                    y20,
                    sz - 0.4,
                    sx + 0.4,
                    yt,
                    sz + 0.4,
                    "antenna",
                );
                Z.add(sx, yt, sz, 0, 1, 0, "antenna");
            }
        }
    } else {
        if (A.type === "apt" && H > 50 && r() < 0.6) {
            const h1 = H - 2 * A.floorH;
            masses.push({ ...lot, y0: 0, y1: h1, p: P, parapet: parH });
            const k = Math.min(4, Math.min(lw, ld) * 0.15);
            masses.push({
                ...inset(lot, k),
                y0: h1,
                y1: H,
                p: P,
                parapet: parH,
            });
        } else if (A.type === "postwar" && H > 60 && r() < 0.5) {
            const h1 = A.gH + Math.round((H * 0.3) / A.floorH) * A.floorH;
            masses.push({ ...lot, y0: 0, y1: h1, p: P, parapet: parH });
            const k = Math.min(8, Math.min(lw, ld) * 0.2);
            masses.push({
                ...inset(lot, k),
                y0: h1,
                y1: H,
                p: P,
                parapet: parH,
            });
        } else {
            masses.push({
                ...lot,
                y0: 0,
                y1: H,
                p: P,
                parapet: A.type === "postwar" ? 1.2 : parH,
            });
        }
    }

    if (
        (A.type === "glass" ||
            A.type === "postwar" ||
            (A.type === "deco" && shaped)) &&
        typeof A.shape !== "function"
    )
        addCrown(masses, A, P, r, F, FL, S, Z);

    if (typeof A.shape !== "function" && A.type !== "glass") {
        const lv = [
            ...new Set(
                masses.filter((m) => m.y0 > 0.1 && m.p === P).map((m) => m.y0),
            ),
        ].sort((a, b) => a - b);
        const BW = [1, 0.72, 1.32, 0.86, 1.18],
            WH = [1, 1.12, 0.88, 1.06, 0.94];
        for (const m of masses) {
            if (m.p !== P || m.y0 <= 0.1) continue;
            const i = lv.indexOf(m.y0) + 1,
                h =
                    Math.abs(
                        Math.sin(A.seed * 91.7 + i * 12.9898) * 43758.5453,
                    ) % 1;
            const j = (i + Math.floor(h * 5)) % 5,
                tk = 1.0 + (h - 0.5) * 0.08 + i * 0.012;
            m.p = {
                ...P,
                bayW: P.bayW * BW[j],
                winH: Math.min(0.9, P.winH * WH[j]),
                seed: P.seed + i * 7.31,
                tint: (P.tint ?? [1, 1, 1]).map((c) => c * tk),
            };
        }
    }

    if (
        typeof A.shape !== "function" &&
        A.type === "deco" &&
        (P.layer === LAYER.RED ||
            P.layer === LAYER.BROWN ||
            P.layer === LAYER.BUFF) &&
        Math.abs(Math.sin(A.seed * 45.3) * 9631.7) % 1 < 0.65
    ) {
        const Htot = masses.reduce((a, m) => Math.max(a, m.y1), 0);
        for (const m of masses)
            if (m.y0 < 0.1 && m.p === P && m.y1 < 0.62 * Htot)
                m.p = {
                    ...P,
                    layer: LAYER.LIME,
                    style:
                        P.style === STYLE.PUNCHED ? STYLE.PUNCHED : STYLE.DECO,
                    tint: [0.9, 0.885, 0.85],
                    lintel: 2,
                };
    }
    const roofLayer =
        A.type === "glass"
            ? LAYER.ROOF_MEMBRANE
            : ROOFS[Math.floor(r() * ROOFS.length)];
    const hasCornice = !!A.cornice;
    const stoneP = {
        ...P,
        style: STYLE.BLANK,
        layer: A.type === "walkup" && r() < 0.5 ? LAYER.METAL : LAYER.LIME,
        tint: A.type === "walkup" ? [0.55, 0.5, 0.45] : [0.95, 0.93, 0.88],
    };
    const Htop = masses.reduce((a, m) => Math.max(a, m.y1), 0);
    masses.forEach((m, _mi) => {
        if (m.round) {
            emitRound(m, A, lot, F, FL, S, Z, ctx, roofLayer, r);
            return;
        }
        const ft = faceTypes(m, lot);
        const style = m.p.style ?? A.style;
        const faces = {};
        const top = m.y1 + m.parapet;
        for (const s of ["nx", "px", "nz", "pz"]) {
            const ty = ft[s];
            if (ty === "party") faces[s] = { style: STYLE.PARTY, gH: 0 };
            else if (ty === "street")
                faces[s] = { style, gH: m.y0 < 0.1 ? A.gH : -A.gH };
            else faces[s] = { style, gH: -A.gH };
        }

        let tierY = 0;
        if (m.y0 > 1) {
            const below = masses.filter(
                (mb) =>
                    mb !== m &&
                    !mb.round &&
                    Math.abs(mb.y1 - m.y0) < 0.6 &&
                    mb.x0 < m.x1 &&
                    mb.x1 > m.x0 &&
                    mb.z0 < m.z1 &&
                    mb.z1 > m.z0,
            );
            const e = 0.35;
            if (
                below.length &&
                !below.some(
                    (mb) =>
                        Math.abs(mb.x0 - m.x0) < e ||
                        Math.abs(mb.x1 - m.x1) < e ||
                        Math.abs(mb.z0 - m.z0) < e ||
                        Math.abs(mb.z1 - m.z1) < e,
                )
            )
                tierY = m.y0;
        }

        if (ZFIX && m.y0 > 1) {
            const e = 0.01,
                span = (a0, a1, b0, b1) => a0 <= b0 + e && a1 >= b1 - e;
            for (const s of ["nx", "px", "nz", "pz"]) {
                if (!faces[s]) continue;
                let yb = m.y0;
                for (const lo of masses) {
                    if (
                        lo === m ||
                        lo.round ||
                        !(lo.parapet > 0) ||
                        Math.abs(lo.y1 - m.y0) > 0.6 ||
                        lo.y1 + lo.parapet <= yb
                    )
                        continue;
                    const flush =
                        s === "nx"
                            ? Math.abs(lo.x0 - m.x0) < e &&
                              span(lo.z0, lo.z1, m.z0, m.z1)
                            : s === "px"
                              ? Math.abs(lo.x1 - m.x1) < e &&
                                span(lo.z0, lo.z1, m.z0, m.z1)
                              : s === "nz"
                                ? Math.abs(lo.z0 - m.z0) < e &&
                                  span(lo.x0, lo.x1, m.x0, m.x1)
                                : Math.abs(lo.z1 - m.z1) < e &&
                                  span(lo.x0, lo.x1, m.x0, m.x1);
                    if (flush)
                        yb =
                            lo.y1 +
                            lo.parapet +
                            (hasCornice && lo.y0 < 0.1 ? 0.1 : 0.08);
                }
                if (yb > m.y0 + 1e-3 && yb < top - 0.05)
                    faces[s] = { ...faces[s], y0: yb };
            }
        }
        const pp = { ...m.p, topY: top, tierY };

        let facesF = faces;
        if (
            (A.type === "glass" || A.type === "postwar" || A.type === "deco") &&
            top > 60 &&
            ["nx", "px", "nz", "pz"].some((k) => ft[k] === "party")
        ) {
            const hh =
                Math.abs(
                    Math.sin(lot.x0 * 12.9898 + lot.z0 * 78.233) * 43758.5453,
                ) % 1;
            const hP =
                A.gH + Math.round((14 + hh * 30 - A.gH) / A.floorH) * A.floorH;
            facesF = { ...faces };
            for (const k of ["nx", "px", "nz", "pz"])
                if (ft[k] === "party")
                    facesF[k] = { style, gH: -A.gH, y0: faces[k]?.y0 };
            if (hP > m.y0 + 0.5 && hP < top - 0.5) {
                F.box(m.x0, m.y0, m.z0, m.x1, hP, m.z1, pp, faces, false);
                F.box(m.x0, hP, m.z0, m.x1, top, m.z1, pp, facesF, false);
            } else
                F.box(
                    m.x0,
                    m.y0,
                    m.z0,
                    m.x1,
                    top,
                    m.z1,
                    pp,
                    hP >= top - 0.5 ? faces : facesF,
                    false,
                );
        } else F.box(m.x0, m.y0, m.z0, m.x1, top, m.z1, pp, faces, false);

        FL.box(m.x0, m.y0, m.z0, m.x1, top, m.z1, pp, facesF, true, false, {
            ...pp,
            style: STYLE.BLANK,
            layer: m.crown ? m.p.layer : LAYER.ROOF,
            tint: m.crown ? m.p.tint.map((c) => c * 0.9) : [0.85, 0.85, 0.85],
        });
        S.box(m.x0, m.y0, m.z0, m.x1, m.y1, m.z1, "wall");
        const rk = 0.88 + r() * 0.24,
            rw = (r() - 0.5) * 0.04;
        const roofP = {
            ...pp,
            style: STYLE.BLANK,
            layer: m.crown ? m.p.layer : roofLayer,
            tint: m.crown
                ? m.p.tint.map((c) => c * rk)
                : [rk * (1 + rw), rk, rk * (1 - rw)],
        };
        if (m.parapet > 0) {
            const t = 0.3;
            F.horiz(m.x0 + t, m.z0 + t, m.x1 - t, m.z1 - t, m.y1, roofP);
            const ip = {
                ...pp,
                style: STYLE.BLANK,
                tint: m.p.tint.map((c) => c * 0.8),
            };
            F.innerRing(m.x0 + t, m.z0 + t, m.x1 - t, m.z1 - t, m.y1, top, ip);
            S.box(m.x0, m.y1, m.z0, m.x1, top, m.z0 + t, "parapet");
            S.box(m.x0, m.y1, m.z1 - t, m.x1, top, m.z1, "parapet");
            S.box(m.x0, m.y1, m.z0 + t, m.x0 + t, top, m.z1 - t, "parapet");
            S.box(m.x1 - t, m.y1, m.z0 + t, m.x1, top, m.z1 - t, "parapet");

            const cor = hasCornice && m.y0 < 0.1;
            const cH = cor ? 0.1 : 0.08;
            const street = (s) => cor && ft[s] === "street";
            const ov = (s) => (ft[s] === "party" || street(s) ? 0 : 0.04);
            const cp = {
                ...P,
                style: STYLE.BLANK,
                layer:
                    A.type === "glass"
                        ? LAYER.LIME
                        : cor
                          ? stoneP.layer
                          : LAYER.LIME,
                tint: cor ? stoneP.tint : [0.86, 0.85, 0.82],
            };
            const ti = t + 0.03,
                yc = top + cH;
            const runs = [
                [
                    "nz",
                    m.x0 - ov("nx"),
                    m.z0 - ov("nz"),
                    m.x1 + ov("px"),
                    m.z0 + ti,
                ],
                [
                    "pz",
                    m.x0 - ov("nx"),
                    m.z1 - ti,
                    m.x1 + ov("px"),
                    m.z1 + ov("pz"),
                ],
                ["nx", m.x0 - ov("nx"), m.z0 + ti, m.x0 + ti, m.z1 - ti],
                ["px", m.x1 - ti, m.z0 + ti, m.x1 + ov("px"), m.z1 - ti],
            ];
            for (const [s, a0, b0, a1, b1] of runs) {
                const fc = {};
                if (street(s)) fc[s] = null;
                if (s === "nx" || s === "px") {
                    fc.nz = null;
                    fc.pz = null;
                }
                F.box(a0, top, b0, a1, yc, b1, cp, fc, true, true);
                S.box(a0, top, b0, a1, yc, b1, "coping");
            }

            for (const s of ["nz", "pz", "nx", "px"]) {
                if (ft[s] === "party" || street(s)) continue;
                const [nx, nz] = OUT[s];
                const e = 0.1;
                if (s === "nz")
                    Z.edge(m.x0, m.z0 + e, m.x1, m.z0 + e, yc, nx, nz);
                if (s === "pz")
                    Z.edge(m.x0, m.z1 - e, m.x1, m.z1 - e, yc, nx, nz);
                if (s === "nx")
                    Z.edge(m.x0 + e, m.z0, m.x0 + e, m.z1, yc, nx, nz);
                if (s === "px")
                    Z.edge(m.x1 - e, m.z0, m.x1 - e, m.z1, yc, nx, nz);
            }
            for (const [sx, sz] of [
                ["nx", "nz"],
                ["px", "nz"],
                ["nx", "pz"],
                ["px", "pz"],
            ]) {
                if (ft[sx] === "party" || ft[sz] === "party") continue;
                const nx = OUT[sx][0],
                    nz = OUT[sz][1];
                const oc = street(sx) && street(sz) ? 0.55 : 0;
                Z.add(
                    (sx === "nx" ? m.x0 : m.x1) + nx * (oc - 0.12),
                    yc,
                    (sz === "nz" ? m.z0 : m.z1) + nz * (oc - 0.12),
                    nx * Math.SQRT1_2,
                    0,
                    nz * Math.SQRT1_2,
                    "roofCorner",
                );
            }
        } else {
            F.horiz(m.x0, m.z0, m.x1, m.z1, m.y1, roofP);
            if (!m.crown) {
                for (const s of ["nz", "pz", "nx", "px"]) {
                    if (ft[s] === "party") continue;
                    const [nx, nz] = OUT[s],
                        e = 0.12;
                    if (s === "nz")
                        Z.edge(m.x0, m.z0 + e, m.x1, m.z0 + e, m.y1, nx, nz);
                    if (s === "pz")
                        Z.edge(m.x0, m.z1 - e, m.x1, m.z1 - e, m.y1, nx, nz);
                    if (s === "nx")
                        Z.edge(m.x0 + e, m.z0, m.x0 + e, m.z1, m.y1, nx, nz);
                    if (s === "px")
                        Z.edge(m.x1 - e, m.z0, m.x1 - e, m.z1, m.y1, nx, nz);
                }
                for (const [cx, cz, nx, nz] of [
                    [m.x0, m.z0, -1, -1],
                    [m.x1, m.z0, 1, -1],
                    [m.x0, m.z1, -1, 1],
                    [m.x1, m.z1, 1, 1],
                ]) {
                    Z.add(
                        cx - nx * 0.15,
                        m.y1,
                        cz - nz * 0.15,
                        nx * Math.SQRT1_2,
                        0,
                        nz * Math.SQRT1_2,
                        "roofCorner",
                    );
                }
            }
        }

        if (
            m.parapet > 0 &&
            !m.crown &&
            top > 28 &&
            TIER_BAND[A.type] &&
            !(hasCornice && m.y0 < 0.1) &&
            Math.min(m.x1 - m.x0, m.z1 - m.z0) > 8
        ) {
            const light =
                A.layer === LAYER.LIME ||
                A.layer === LAYER.WHITE ||
                A.layer === LAYER.CONCRETE;
            const bp = {
                ...P,
                style: STYLE.BLANK,
                layer: light ? A.layer : LAYER.LIME,
                tint: light
                    ? (A.tint ?? [1, 1, 1]).map((c) => Math.min(1.1, c * 1.1))
                    : [0.93, 0.91, 0.86],
            };
            const big = top > 110 ? 1.45 : top > 60 ? 1 : 0.7,
                o1 = 0.34 * big,
                o2 = 0.16 * big;
            const has = (s) => ft[s] !== "party";
            const ext1 = {},
                ext2 = {};
            for (const s of ["nx", "px", "nz", "pz"]) {
                ext1[s] = has(s) ? o1 : 0;
                ext2[s] = has(s) ? o2 : 0;
            }
            const yb = top - 0.12;
            for (const s of ["nz", "pz", "nx", "px"]) {
                if (!has(s)) continue;
                trimRun(
                    F,
                    S,
                    m,
                    s,
                    o1,
                    yb - 0.85 * big,
                    yb,
                    bp,
                    ext1,
                    "cornice",
                );
                trimRun(
                    F,
                    S,
                    m,
                    s,
                    o2,
                    yb - 1.25 * big,
                    yb - 0.85 * big,
                    bp,
                    ext2,
                    "cornice",
                );
            }

            if (top > 60) {
                const hide = {};
                for (const s of ["nx", "px", "nz", "pz"])
                    if (!has(s)) hide[s] = null;
                FL.box(
                    m.x0 - ext1.nx,
                    yb - 0.85 * big,
                    m.z0 - ext1.nz,
                    m.x1 + ext1.px,
                    yb,
                    m.z1 + ext1.pz,
                    bp,
                    hide,
                    true,
                    true,
                );
            }
        }
        if (typeof A.shape !== "function" && !m.crown && Htop > 70)
            pierRibs(F, S, m, ft, A, masses, top);
        if (m.soffit) {
            const sp = {
                ...pp,
                style: STYLE.BLANK,
                layer: A.type === "glass" ? LAYER.METAL : m.p.layer,
                tint:
                    A.type === "glass"
                        ? [1.7, 1.72, 1.76]
                        : (m.p.tint ?? [1, 1, 1]).map((c) => c * 0.85),
            };
            F.horiz(m.x0, m.z0, m.x1, m.z1, m.y0, sp, true);
            FL.horiz(m.x0, m.z0, m.x1, m.z1, m.y0, sp, true);
        }
        ctx.boxes.push({ min: [m.x0, m.y0, m.z0], max: [m.x1, top, m.z1] });
    });
    const topMass = masses.reduce((a, m) => (m.y1 > a.y1 ? m : a), masses[0]);
    const _m0 = masses[0];
    ctx.footprints.push({
        x0: lot.x0,
        z0: lot.z0,
        x1: lot.x1,
        z1: lot.z1,
        h: topMass.y1,
        kind: A.type,
    });
    const bld = { lot, A, H: topMass.y1, masses };
    ctx.buildings.push(bld);

    for (const mg of masses) {
        if (mg.y0 > 0.1) continue;
        const mainTop = mg.y1 + mg.parapet;

        const ft0 = faceTypes(mg, lot);
        if (hasCornice && mg.parapet > 0) {
            const o = 0.55;
            const yT = mainTop + 0.1,
                yB = mainTop - 0.7;
            const ext = {};
            for (const s of ["nx", "px", "nz", "pz"])
                ext[s] = ft0[s] === "street" ? o : 0;
            const extD = {};
            for (const s of ["nx", "px", "nz", "pz"]) extD[s] = ext[s] * 0.4;
            for (const s of ["nz", "pz", "nx", "px"]) {
                if (ft0[s] !== "street") continue;
                trimRun(F, S, mg, s, o, yB, yT, stoneP, ext, "cornice");
                trimRun(
                    F,
                    S,
                    mg,
                    s,
                    o * 0.4,
                    yB - 0.35,
                    yB,
                    stoneP,
                    extD,
                    "cornice",
                );
                const [nx, nz] = OUT[s];
                const e = o - 0.12;
                if (s === "nz")
                    Z.edge(
                        mg.x0,
                        mg.z0 - e,
                        mg.x1,
                        mg.z0 - e,
                        yT,
                        nx,
                        nz,
                        "roofEdge",
                        9,
                    );
                if (s === "pz")
                    Z.edge(
                        mg.x0,
                        mg.z1 + e,
                        mg.x1,
                        mg.z1 + e,
                        yT,
                        nx,
                        nz,
                        "roofEdge",
                        9,
                    );
                if (s === "nx")
                    Z.edge(
                        mg.x0 - e,
                        mg.z0,
                        mg.x0 - e,
                        mg.z1,
                        yT,
                        nx,
                        nz,
                        "roofEdge",
                        9,
                    );
                if (s === "px")
                    Z.edge(
                        mg.x1 + e,
                        mg.z0,
                        mg.x1 + e,
                        mg.z1,
                        yT,
                        nx,
                        nz,
                        "roofEdge",
                        9,
                    );
            }
        }

        if (A.gH > 0 && A.type !== "glass") {
            const y0 = A.gH - 0.5,
                y1 = A.gH - 0.05,
                o = 0.28;
            const bp = {
                ...P,
                style: STYLE.BLANK,
                layer: A.base === LAYER.GRANITE ? LAYER.LIME : A.base,
                tint: [0.92, 0.9, 0.85],
            };
            const ext = {};
            for (const s of ["nx", "px", "nz", "pz"])
                ext[s] = ft0[s] === "street" ? o : 0;
            for (const s of ["nz", "pz", "nx", "px"]) {
                if (ft0[s] !== "street") continue;
                trimRun(F, S, mg, s, o, y0, y1, bp, ext, "ledge");
                const [nx, nz] = OUT[s],
                    e = o - 0.1;
                if (s === "nz")
                    Z.edge(
                        mg.x0,
                        mg.z0 - e,
                        mg.x1,
                        mg.z0 - e,
                        y1,
                        nx,
                        nz,
                        "ledge",
                        10,
                    );
                if (s === "pz")
                    Z.edge(
                        mg.x0,
                        mg.z1 + e,
                        mg.x1,
                        mg.z1 + e,
                        y1,
                        nx,
                        nz,
                        "ledge",
                        10,
                    );
                if (s === "nx")
                    Z.edge(
                        mg.x0 - e,
                        mg.z0,
                        mg.x0 - e,
                        mg.z1,
                        y1,
                        nx,
                        nz,
                        "ledge",
                        10,
                    );
                if (s === "px")
                    Z.edge(
                        mg.x1 + e,
                        mg.z0,
                        mg.x1 + e,
                        mg.z1,
                        y1,
                        nx,
                        nz,
                        "ledge",
                        10,
                    );
            }
        }

        if (
            (mg.p.style ?? A.style) === STYLE.PUNCHED &&
            A.gH > 0 &&
            (mg.p.layer ?? A.layer) <= LAYER.LIME
        )
            zoneBelts(F, S, mg, ft0, A);
        if (core) facadeDetails(A, H, mg, ft0, D, S, Z, r, ctx);
    }
    if (!core) return bld;

    for (const m of masses) {
        if (m !== topMass && !m.roof) continue;
        const pre = masses
            .filter((o) => o !== m && Math.abs(o.y0 - m.y1) < 0.1)
            .map((o) =>
                o.round
                    ? [
                          o.round.cx - o.round.r - 1,
                          o.round.cz - o.round.r - 1,
                          o.round.cx + o.round.r + 1,
                          o.round.cz + o.round.r + 1,
                      ]
                    : [o.x0 - 1, o.z0 - 1, o.x1 + 1, o.z1 + 1],
            );
        const glassTop = A.type === "glass" && !pre.length && m.parapet === 0;
        const Ar =
            glassTop || A.type !== "glass"
                ? A
                : { ...A, type: "loft", waterTower: false };
        roofDetails(Ar, m.y1, P, m, roofLayer, F, D, S, Z, r, pre);
    }
    return bld;
}

function emitRound(m, A, lot, F, FL, S, Z, ctx, roofLayer, r) {
    const { cx, cz, r: R } = m.round;
    const n =
        Math.ceil(Math.max(24, Math.PI / Math.acos(1 - 0.03 / R)) / 4) * 4;
    const style = m.p.style ?? A.style;
    const pp = { ...m.p, topY: m.y1, baseY: m.y0, margin: 0, wrap: true };
    F.cyl(cx, cz, R, m.y0, m.y1, n, pp, style, false);
    FL.cyl(cx, cz, R, m.y0, m.y1, n, pp, style, false);
    if (!m.crown && m.y1 - m.y0 > 12) {
        const lipR = R + 0.42,
            ly0 = m.y1 - 0.75,
            lp = {
                ...m.p,
                style: STYLE.BLANK,
                layer: style === STYLE.CURTAIN ? LAYER.METAL : LAYER.LIME,
                tint:
                    style === STYLE.CURTAIN
                        ? [2.2, 2.24, 2.3]
                        : [1, 0.98, 0.94],
                topY: m.y1,
                baseY: ly0,
            };
        for (const B of [F, FL]) {
            B.cyl(cx, cz, lipR, ly0, m.y1, n, lp, STYLE.BLANK, false);
            B.ring(cx, cz, R, lipR, m.y1, n, lp);
        }
        F.ring(
            cx,
            cz,
            R,
            lipR,
            ly0,
            n,
            { ...lp, tint: lp.tint.map((v) => v * 0.6) },
            true,
        );
        S.cyl(cx, cz, ly0, m.y1, polyR(lipR, n), polyR(lipR, n), "cornice");
    }
    const rk = 0.88 + r() * 0.24;
    const roofP = {
        ...pp,
        style: STYLE.BLANK,
        layer: m.crown ? m.p.layer : roofLayer,
        tint: [rk, rk, rk],
    };
    const pts = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]);
    }
    F.fan(pts, m.y1, roofP);
    FL.fan(pts, m.y1, {
        ...roofP,
        layer: m.crown ? m.p.layer : LAYER.ROOF,
        tint: [0.85, 0.85, 0.85],
    });
    const Rm = polyR(R, n);
    S.cyl(cx, cz, m.y0, m.y1, Rm, Rm, "wall");
    if (!m.crown) {
        const k = Math.max(6, Math.round((2 * Math.PI * R) / 7));
        for (let i = 0; i < k; i++) {
            const a = (i / k) * Math.PI * 2,
                c = Math.cos(a),
                sN = Math.sin(a);
            Z.add(
                cx + c * (Rm - 0.15),
                m.y1,
                cz + sN * (Rm - 0.15),
                c,
                0,
                sN,
                "roofEdge",
            );
        }
    }
    ctx.boxes.push({
        min: [cx - R, m.y0, cz - R],
        max: [cx + R, m.y1, cz + R],
    });
}

const snapF = (A, y) =>
    A.gH + Math.max(1, Math.round((y - A.gH) / A.floorH)) * A.floorH;
const insetM = (m, a, b = a, c = a, d = a) => ({
    x0: m.x0 + a,
    x1: m.x1 - b,
    z0: m.z0 + c,
    z1: m.z1 - d,
});
const dims = (m) => [m.x1 - m.x0, m.z1 - m.z0];
const SHAPES = {
    podiumTower(lot, A, P, r, H, parH) {
        const ph = snapF(A, A.gH + (3 + Math.floor(r() * 5)) * A.floorH);
        if (H < ph + 6 * A.floorH) return null;
        const glass = A.type === "glass";
        const pp = glass
            ? {
                  ...P,
                  style: STYLE.PUNCHED,
                  layer: r() < 0.5 ? LAYER.LIME : LAYER.GRANITE,
                  winW: 0.62,
                  winH: 0.66,
                  depth: 0.3,
                  margin: 1.0,
                  tint: [1, 0.98, 0.95],
              }
            : P;
        const out = [
            {
                ...lot,
                y0: 0,
                y1: ph,
                p: pp,
                parapet: glass ? 1.0 : parH,
                roof: true,
            },
        ];
        const ins = (s) =>
            lot.sides[s] === "street" ? 5 + r() * 7 : 1.5 + r() * 3;
        let m = insetM(lot, ins("nx"), ins("px"), ins("nz"), ins("pz"));
        let y = ph;
        const n = 1 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
            const [w, d] = dims(m);
            if (w < 14 || d < 14) break;
            const y1 =
                i === n - 1 ? H : snapF(A, y + (H - y) * (0.5 + r() * 0.25));
            if (y1 - y < 3 * A.floorH) continue;
            out.push({ ...m, y0: y, y1, p: P, parapet: glass ? 0 : 1.1 });
            y = y1;
            const k = 2.5 + r() * 3;
            m = insetM(m, k);
        }
        return out.length > 1 ? out : null;
    },

    twin(lot, A, P, r, H, _parH) {
        const [w, d] = dims(lot);
        if (w < 64 || d < 36) return null;
        const ph = snapF(A, A.gH + (4 + Math.floor(r() * 4)) * A.floorH);
        const pp = {
            ...P,
            style: STYLE.PUNCHED,
            layer: LAYER.GRANITE,
            winW: 0.62,
            winH: 0.66,
            depth: 0.3,
            margin: 1.0,
            tint: [0.95, 0.94, 0.92],
        };
        const tw = Math.min(w * 0.36, 34),
            inz = Math.min(6, d * 0.12);
        const H2 = snapF(A, H * (0.82 + r() * 0.12));
        return [
            { ...lot, y0: 0, y1: ph, p: pp, parapet: 1.0, roof: true },
            {
                x0: lot.x0 + 3,
                x1: lot.x0 + 3 + tw,
                z0: lot.z0 + inz,
                z1: lot.z1 - inz,
                y0: ph,
                y1: H,
                p: P,
                parapet: 0,
                roof: true,
            },
            {
                x0: lot.x1 - 3 - tw,
                x1: lot.x1 - 3,
                z0: lot.z0 + inz,
                z1: lot.z1 - inz,
                y0: ph,
                y1: H2,
                p: P,
                parapet: 0,
                roof: true,
            },
        ];
    },

    notched(lot, A, P, r, H) {
        const [w, d] = dims(lot);
        if (Math.min(w, d) < 30) return null;
        const c = Math.max(
            3,
            Math.min(7, Math.min(w, d) * (0.12 + r() * 0.06)),
        );
        const Hc = r() < 0.6 ? snapF(A, H * (0.8 + r() * 0.1)) : H;
        const out = [
            {
                x0: lot.x0 + c,
                x1: lot.x1 - c,
                z0: lot.z0,
                z1: lot.z1,
                y0: 0,
                y1: Hc,
                p: P,
                parapet: 0,
                roof: Hc === H,
            },
            {
                x0: lot.x0,
                x1: lot.x0 + c,
                z0: lot.z0 + c,
                z1: lot.z1 - c,
                y0: 0,
                y1: Hc,
                p: P,
                parapet: 0,
                sides: { px: "party" },
            },
            {
                x0: lot.x1 - c,
                x1: lot.x1,
                z0: lot.z0 + c,
                z1: lot.z1 - c,
                y0: 0,
                y1: Hc,
                p: P,
                parapet: 0,
                sides: { nx: "party" },
            },
        ];
        if (Hc < H) {
            const t = insetM(out[0], c * 0.8, c * 0.8, c + 1, c + 1);
            if (dims(t)[0] > 10 && dims(t)[1] > 10)
                out.push({ ...t, y0: Hc, y1: H, p: P, parapet: 0 });
            else out[0].y1 = out[1].y1 = out[2].y1 = H;
        }
        return out;
    },

    plaza(lot, A, P, r, H) {
        const ins = (s) => (lot.sides[s] === "street" ? 8 + r() * 8 : 0);
        const m = insetM(lot, ins("nx"), ins("px"), ins("nz"), ins("pz"));
        const [w, d] = dims(m);
        if (w < 18 || d < 18) return null;
        const out = [{ ...m, y0: 0, y1: H, p: P, parapet: 0 }];
        if (r() < 0.5 && H > 120) {
            const h1 = snapF(A, H * (0.7 + r() * 0.15));
            out[0].y1 = h1;
            out.push({ ...insetM(m, 4), y0: h1, y1: H, p: P, parapet: 0 });
        }
        return out;
    },

    slab(lot, A, P, r, H, parH) {
        const [w, d] = dims(lot);
        if (w < 30 || d < 30) return null;
        const ph = snapF(A, A.gH + (1 + Math.floor(r() * 3)) * A.floorH);
        const along = w > d;
        const t = 13 + r() * 5;
        const cx = (lot.x0 + lot.x1) / 2,
            cz = (lot.z0 + lot.z1) / 2;
        const s = along
            ? { x0: lot.x0 + 5, x1: lot.x1 - 5, z0: cz - t / 2, z1: cz + t / 2 }
            : {
                  x0: cx - t / 2,
                  x1: cx + t / 2,
                  z0: lot.z0 + 5,
                  z1: lot.z1 - 5,
              };
        return [
            { ...lot, y0: 0, y1: ph, p: P, parapet: parH, roof: true },
            { ...s, y0: ph, y1: H, p: P, parapet: 1.2 },
        ];
    },

    courtU(lot, A, P, r, H, parH) {
        const [w, d] = dims(lot);
        if (w < 30 || d < 24) return null;
        const front =
            lot.sides.nz === "street"
                ? "nz"
                : lot.sides.pz === "street"
                  ? "pz"
                  : null;
        if (!front) return null;
        const ww = Math.max(8, Math.min(14, w * 0.3)),
            rd = Math.max(8, Math.min(12, d * 0.4));
        const bar =
            front === "nz"
                ? { z0: lot.z1 - rd, z1: lot.z1 }
                : { z0: lot.z0, z1: lot.z0 + rd };
        return [
            {
                x0: lot.x0,
                x1: lot.x0 + ww,
                z0: lot.z0,
                z1: lot.z1,
                y0: 0,
                y1: H,
                p: P,
                parapet: parH,
            },
            {
                x0: lot.x1 - ww,
                x1: lot.x1,
                z0: lot.z0,
                z1: lot.z1,
                y0: 0,
                y1: H,
                p: P,
                parapet: parH,
                roof: true,
            },
            {
                x0: lot.x0 + ww,
                x1: lot.x1 - ww,
                ...bar,
                y0: 0,
                y1: H,
                p: P,
                parapet: parH,
                sides: { nx: "party", px: "party" },
            },
        ];
    },

    ell(lot, A, P, r, H, parH) {
        const [w, d] = dims(lot);
        if (w < 16 || d < 20) return null;
        const av =
            lot.sides.nx === "street"
                ? "nx"
                : lot.sides.px === "street"
                  ? "px"
                  : null;
        const st =
            lot.sides.nz === "street"
                ? "nz"
                : lot.sides.pz === "street"
                  ? "pz"
                  : null;
        if (!av || !st) return null;
        const bw = Math.max(8, w * 0.5),
            bd = Math.max(8, d * 0.45);
        const a =
            av === "nx"
                ? { x0: lot.x0, x1: lot.x0 + bw }
                : { x0: lot.x1 - bw, x1: lot.x1 };
        const b =
            av === "nx"
                ? { x0: lot.x0 + bw, x1: lot.x1 }
                : { x0: lot.x0, x1: lot.x1 - bw };
        const bz =
            st === "nz"
                ? { z0: lot.z0, z1: lot.z0 + bd }
                : { z0: lot.z1 - bd, z1: lot.z1 };
        return [
            { ...a, z0: lot.z0, z1: lot.z1, y0: 0, y1: H, p: P, parapet: parH },
            {
                ...b,
                ...bz,
                y0: 0,
                y1: H,
                p: P,
                parapet: parH,
                sides: { [av === "nx" ? "nx" : "px"]: "party" },
                roof: true,
            },
        ];
    },

    slender(lot, A, P, r, H, parH) {
        const [w, d] = dims(lot);
        if (Math.min(w, d) < 24) return null;
        const glass = A.type === "glass";
        const ph = snapF(A, A.gH + (4 + Math.floor(r() * 5)) * A.floorH);
        const pp = glass
            ? {
                  ...P,
                  style: STYLE.PUNCHED,
                  layer: r() < 0.5 ? LAYER.LIME : LAYER.GRANITE,
                  winW: 0.62,
                  winH: 0.66,
                  depth: 0.3,
                  margin: 1.0,
                  tint: [0.95, 0.94, 0.92],
              }
            : P;
        const s = Math.min(30, Math.min(w, d) - 8) / 2,
            cx =
                (lot.x0 + lot.x1) / 2 +
                (r() - 0.5) * Math.max(0, w - 2 * s - 8),
            cz =
                (lot.z0 + lot.z1) / 2 +
                (r() - 0.5) * Math.max(0, d - 2 * s - 8);
        const out = [
            {
                ...lot,
                y0: 0,
                y1: ph,
                p: pp,
                parapet: glass ? 1.0 : parH,
                roof: true,
            },
        ];
        const y1 = snapF(A, H * (0.72 + r() * 0.12)),
            y2 = snapF(A, H * (0.9 + r() * 0.05));
        const par = glass ? 0 : 1.1;
        out.push({
            x0: cx - s,
            x1: cx + s,
            z0: cz - s,
            z1: cz + s,
            y0: ph,
            y1,
            p: P,
            parapet: par,
            roof: !glass,
            sides: { ...UPS },
        });
        const s2 = s - 2 - r() * 2.5,
            s3 = s2 - 2 - r() * 2;
        out.push({
            x0: cx - s2,
            x1: cx + s2,
            z0: cz - s2,
            z1: cz + s2,
            y0: y1,
            y1: y2,
            p: P,
            parapet: par,
            roof: !glass,
            sides: { ...UPS },
        });
        if (s3 > 6)
            out.push({
                x0: cx - s3,
                x1: cx + s3,
                z0: cz - s3,
                z1: cz + s3,
                y0: y2,
                y1: H,
                p: P,
                parapet: par,
                sides: { ...UPS },
            });
        return out;
    },

    drum(lot, A, P, r, H) {
        const [w, d] = dims(lot);
        if (Math.min(w, d) < 30) return null;
        const ph = snapF(A, A.gH + (3 + Math.floor(r() * 5)) * A.floorH);
        if (H < ph + 12 * A.floorH) return null;
        const pp = {
            ...P,
            style: STYLE.PUNCHED,
            layer: r() < 0.5 ? LAYER.LIME : LAYER.GRANITE,
            winW: 0.62,
            winH: 0.66,
            depth: 0.3,
            margin: 1.0,
            tint: [0.95, 0.94, 0.92],
        };
        const R0 = Math.min(21, (Math.min(w, d) - 7) / 2);
        const cx =
                (lot.x0 + lot.x1) / 2 +
                (r() - 0.5) * Math.max(0, w - 2 * R0 - 7),
            cz =
                (lot.z0 + lot.z1) / 2 +
                (r() - 0.5) * Math.max(0, d - 2 * R0 - 7);
        const rm = (R, y0, y1, p = P, crown = false) => {
            const k = R * 0.62;
            return {
                x0: cx - k,
                x1: cx + k,
                z0: cz - k,
                z1: cz + k,
                y0,
                y1,
                p,
                parapet: 0,
                round: { cx, cz, r: R },
                crown,
                sides: { ...UPS },
                roof: !crown,
            };
        };
        const out = [
            { ...lot, y0: 0, y1: ph, p: pp, parapet: 1.0, roof: true },
        ];
        let Rt = R0;
        if (r() < 0.5) out.push(rm(R0, ph, H));
        else {
            const y1 = snapF(A, ph + (H - ph) * (0.55 + r() * 0.25));
            out.push(rm(R0, ph, y1));
            Rt = R0 * (0.7 + r() * 0.12);
            out.push(rm(Rt, y1, H));
        }

        const qc = r(),
            louv = {
                ...P,
                style: STYLE.RIBBON,
                layer: LAYER.METAL,
                floorH: 0.36,
                bayW: 1.2,
                winW: 1,
                winH: 0.42,
                depth: 0.05,
                tint: [1.45, 1.48, 1.52],
                glass: 2,
            };
        if (qc < 0.3) out.push(rm(Rt * 0.86, H, H + A.floorH * 1.6, louv));
        else if (qc < 0.72)
            out.push(rm(Rt * (0.62 + qc * 0.2), H, H + 5.4, louv));
        else {
            const y2 = H + 2 * A.floorH;
            out.push(rm(Rt * 0.8, H, y2));
            out.push(rm(Rt * 0.6, y2, y2 + 2 * A.floorH));
        }
        for (let i = 1; i < out.length; i++) out[i].roof = !out[i].crown;
        return out;
    },

    cantilever(lot, A, P, r, H, parH) {
        const [w, d] = dims(lot);
        if (Math.min(w, d) < 28 || H < 90) return null;
        const glass = A.type === "glass";
        const ph = snapF(A, A.gH + (2 + Math.floor(r() * 3)) * A.floorH);
        const along = w >= d,
            k = 5 + r() * 4,
            both = r() < 0.5,
            e = 1.5;
        const k0 = both || r() < 0.5 ? k : e,
            k1 = both || k0 === e ? k : e;
        const shaft = along
            ? insetM(lot, e, e, k0, k1)
            : insetM(lot, k0, k1, e, e);
        const y1 = snapF(A, ph + (H - ph) * (0.45 + r() * 0.25));
        if (y1 - ph < 6 * A.floorH || H - y1 < 6 * A.floorH) return null;
        const pp = glass
            ? {
                  ...P,
                  style: STYLE.PUNCHED,
                  layer: LAYER.GRANITE,
                  winW: 0.62,
                  winH: 0.66,
                  depth: 0.3,
                  margin: 1.0,
                  tint: [0.9, 0.9, 0.9],
              }
            : P;
        return [
            {
                ...lot,
                y0: 0,
                y1: ph,
                p: pp,
                parapet: glass ? 1.0 : parH,
                roof: true,
            },
            { ...shaft, y0: ph, y1, p: P, parapet: 0, sides: { ...UPS } },
            {
                ...insetM(lot, e),
                y0: y1,
                y1: H,
                p: P,
                parapet: glass ? 0 : 1.1,
                soffit: true,
                sides: { ...UPS },
            },
        ];
    },

    asym(lot, A, P, r, H, _parH) {
        const [w, d] = dims(lot);
        if (Math.min(w, d) < 24 || H < 60) return null;
        const glass = A.type === "glass";
        const S4 = ["nx", "px", "nz", "pz"],
            s1 = S4[Math.floor(r() * 4)];
        const adj = s1[1] === "x" ? ["nz", "pz"] : ["nx", "px"],
            s2 = r() < 0.6 ? adj[Math.floor(r() * 2)] : null;
        const n = 2 + Math.floor(r() * 3),
            out = [];
        const m = { x0: lot.x0, x1: lot.x1, z0: lot.z0, z1: lot.z1 };
        let y = 0;
        for (let i = 0; i < n; i++) {
            const y1 =
                i === n - 1 ? H : snapF(A, y + (H - y) * (0.3 + r() * 0.3));
            if (y1 - y < 3 * A.floorH && i < n - 1) continue;
            out.push({
                ...m,
                y0: y,
                y1,
                p: P,
                parapet: glass ? 0 : 1.1,
                roof: i < n - 1,
            });
            y = y1;
            const [mw, md] = dims(m),
                cut = (s, f) => {
                    const L = s[1] === "x" ? mw : md;
                    const k = L * f;
                    if (s === "nx") m.x0 += k;
                    if (s === "px") m.x1 -= k;
                    if (s === "nz") m.z0 += k;
                    if (s === "pz") m.z1 -= k;
                };
            cut(s1, 0.16 + r() * 0.14);
            if (s2) cut(s2, 0.08 + r() * 0.1);
            if (Math.min(...dims(m)) < 12) {
                out[out.length - 1].y1 = H;
                out[out.length - 1].roof = false;
                break;
            }
        }
        if (out.length < 2) return null;
        out[out.length - 1].y1 = H;
        out[out.length - 1].roof = false;
        return out;
    },

    rcaSlab(lot, A, P, r, H, parH) {
        const [w, d] = dims(lot),
            along = w >= d,
            L = along ? w : d,
            T = along ? d : w;
        if (L < 44 || T < 24 || H < 90) return null;
        const ph = snapF(A, A.gH + (4 + Math.floor(r() * 4)) * A.floorH);
        const t = Math.min(T - 6, 17 + r() * 7),
            c = (along ? lot.z0 + lot.z1 : lot.x0 + lot.x1) / 2;
        const out = [
            { ...lot, y0: 0, y1: ph, p: P, parapet: parH, roof: true },
        ];
        let a0 = (along ? lot.x0 : lot.z0) + 2,
            a1 = (along ? lot.x1 : lot.z1) - 2,
            y = ph;
        const n = 3 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) {
            const y1 =
                i === n - 1 ? H : snapF(A, y + (H - y) * (0.3 + r() * 0.2));
            if (y1 - y < 3 * A.floorH && i < n - 1) continue;
            const tt = i === 0 ? Math.min(T - 3, t + 6) : t;
            const b = {
                x0: along ? a0 : c - tt / 2,
                x1: along ? a1 : c + tt / 2,
                z0: along ? c - tt / 2 : a0,
                z1: along ? c + tt / 2 : a1,
            };
            out.push({
                ...b,
                y0: y,
                y1,
                p: P,
                parapet: 1.1,
                roof: i < n - 1,
                sides: { ...UPS },
            });
            y = y1;
            const st = (a1 - a0) * (0.08 + r() * 0.08);
            if (r() < 0.7) a0 += st;
            if (r() < 0.7) a1 -= st;
            if (a1 - a0 < 14) {
                out[out.length - 1].y1 = H;
                out[out.length - 1].roof = false;
                break;
            }
        }
        return out.length > 2 ? out : null;
    },

    setbackTop(lot, A, P, r, H, parH) {
        if (H < 36) return null;
        const out = [];
        const n = 1 + Math.floor(r() * 2);
        let y1 = snapF(A, H - n * (1 + Math.floor(r() * 3)) * A.floorH);
        out.push({ ...lot, y0: 0, y1, p: P, parapet: parH, roof: true });
        let m = { ...lot };
        for (let i = 0; i < n; i++) {
            const k = (s) => (lot.sides[s] === "street" ? 2.5 + r() * 2 : 0);
            m = insetM(m, k("nx"), k("px"), k("nz"), k("pz"));
            const [w, d] = dims(m);
            if (w < 8 || d < 8) break;
            const y2 = i === n - 1 ? H : snapF(A, y1 + (H - y1) / 2);
            if (y2 <= y1) break;
            out.push({
                ...m,
                y0: y1,
                y1: y2,
                p: P,
                parapet: parH,
                roof: i < n - 1,
            });
            y1 = y2;
        }
        return out.length > 1 ? out : null;
    },
};
function pickShape(lot, A, b, rnd) {
    const [w, d] = dims(lot),
        q = rnd();

    if (A.type === "glass") {
        if (Math.min(w, d) >= 30 && q < 0.16) return "notched";
        if (w >= 64 && d >= 36 && q < 0.26) return "twin";
        if (q < 0.34) return "drum";
        if (q < 0.5) return "cantilever";
        if (q < 0.62) return "asym";
        if (q < 0.72) return "plaza";
        if (q < 0.86) return "podiumTower";
        return null;
    }
    if (A.type === "deco") {
        if (w >= 36 && q < 0.26) return "podiumTower";
        if (q < 0.46) return "asym";
        if (q < 0.6) return "rcaSlab";
        if (q < 0.68) return "notched";
        return null;
    }
    if (A.type === "postwar") {
        if (A.height > 60 && q < 0.3) return "slab";
        if (q < 0.37) return "drum";
        if (q < 0.54) return "asym";
        if (q < 0.64) return "cantilever";
        if (q < 0.84) return "podiumTower";
        return null;
    }
    if (A.type === "apt" || A.type === "loft") {
        if (w >= 30 && d >= 24 && q < 0.3) return "courtU";
        if (lot.kind === "corner" && q < 0.3) return "ell";
        if (A.height > 40 && q < 0.55) return "setbackTop";
    }
    if (A.type === "walkup" && lot.kind === "corner" && q < 0.15) return "ell";
    return null;
}

const UPS = { nx: "setback", px: "setback", nz: "setback", pz: "setback" };
function addCrown(masses, A, P, r, F, FL, S, Z) {
    const tm = masses.reduce((a, m) => (m.y1 > a.y1 ? m : a), masses[0]);
    if (tm.round || tm.crown) return;
    const H = tm.y1,
        w = tm.x1 - tm.x0,
        d = tm.z1 - tm.z0;
    if (H < 72 || Math.min(w, d) < 16 || r() > 0.92) return;
    const fh = A.floorH,
        q = r(),
        par = tm.parapet;
    const glass = A.type === "glass";
    if (A.type === "deco" && q < 0.08) {
        const pat = {
            ...P,
            style: STYLE.BLANK,
            layer: LAYER.CONCRETE,
            tint: [0.3 + q * 1.5, 0.6, 0.48],
        };
        let m = tm,
            y = H;
        for (let i = 0; i < 6; i++) {
            const nm = insetM(
                m,
                Math.max(1.2, Math.min(m.x1 - m.x0, m.z1 - m.z0) * 0.075),
            );
            if (Math.min(nm.x1 - nm.x0, nm.z1 - nm.z0) < 4) break;
            masses.push({
                ...nm,
                y0: y,
                y1: y + 1.8,
                p: pat,
                parapet: 0,
                crown: true,
                sides: { ...UPS },
            });
            m = nm;
            y += 1.8;
        }
        return;
    }
    if (q < 0.34) {
        let m = tm,
            y = H;
        const n = 3 + (r() < 0.5 ? 1 : 0);
        const pyr = r() < 0.3;
        for (let i = 0; i < (pyr ? n + 3 : n); i++) {
            const k = Math.max(
                1.8,
                Math.min(m.x1 - m.x0, m.z1 - m.z0) *
                    (pyr ? 0.1 : 0.13 + r() * 0.08),
            );
            const nm = insetM(m, k);
            if (Math.min(nm.x1 - nm.x0, nm.z1 - nm.z0) < 6) break;
            const h =
                fh * (pyr ? 1 + (i < 2 ? 1 : 0) : 2 + Math.floor(r() * 4));
            masses.push({
                ...nm,
                y0: y,
                y1: y + h,
                p: P,
                parapet: par,
                sides: { ...UPS },
            });
            m = nm;
            y += h;
        }
    } else if (q < 0.58) {
        const n = 4 + Math.floor(r() * 3),
            s = fh * (1 + Math.floor(r() * 2)),
            dir = r() < 0.5 ? 1 : -1;
        const alongX = w >= d;
        for (let i = 0; i < n; i++) {
            const f = i / n;
            const m = alongX
                ? dir > 0
                    ? { x0: tm.x0 + w * f, x1: tm.x1, z0: tm.z0, z1: tm.z1 }
                    : { x0: tm.x0, x1: tm.x1 - w * f, z0: tm.z0, z1: tm.z1 }
                : dir > 0
                  ? { x0: tm.x0, x1: tm.x1, z0: tm.z0 + d * f, z1: tm.z1 }
                  : { x0: tm.x0, x1: tm.x1, z0: tm.z0, z1: tm.z1 - d * f };
            masses.push({
                ...m,
                y0: H + i * s,
                y1: H + (i + 1) * s,
                p: P,
                parapet: 0,
                sides: { ...UPS },
            });
        }
    } else if (q >= 0.66 && q < 0.8) {
        return;
    } else if (q < 0.8) {
        const cx = (tm.x0 + tm.x1) / 2,
            cz = (tm.z0 + tm.z1) / 2,
            y0 = H + par;

        const mp = {
            ...P,
            style: STYLE.BLANK,
            layer: LAYER.CONCRETE,
            tint: [1.08, 1.08, 1.1],
        };
        const rb = Math.min(w, d) * 0.09,
            hS = 12 + r() * 14,
            rm = Math.min(0.8, Math.max(0.35, rb * 0.16));
        for (const B of [F, FL]) {
            B.cyl(
                cx,
                cz,
                rb,
                y0,
                y0 + 6,
                8,
                { ...mp, topY: y0 + 6, baseY: y0 },
                STYLE.BLANK,
                true,
            );
            B.cyl(
                cx,
                cz,
                rm,
                y0 + 6,
                y0 + 6 + hS,
                8,
                { ...mp, topY: y0 + 6 + hS, baseY: y0 + 6 },
                STYLE.BLANK,
                true,
                0.12,
            );
        }
        for (const f of [0.35, 0.7]) {
            const yr = y0 + 6 + hS * f,
                rr = rm * (1 - f) + 0.12 * f + 0.55;
            F.cyl(
                cx,
                cz,
                rr,
                yr,
                yr + 0.25,
                8,
                { ...mp, topY: yr + 0.25, baseY: yr },
                STYLE.BLANK,
                true,
            );
            S.cyl(cx, cz, yr, yr + 0.25, polyR(rr, 8), polyR(rr, 8), "antenna");
        }
        S.cyl(cx, cz, y0, y0 + 6, polyR(rb, 8), polyR(rb, 8), "spire");
        S.cyl(
            cx,
            cz,
            y0 + 6,
            y0 + 6 + hS,
            polyR(rm, 8),
            polyR(0.12, 8),
            "antenna",
        );
        Z.add(cx, y0 + 6, cz + polyR(rb, 8) - 0.2, 0, 1, 0, "antenna");
        tm.spireR = rb + 1.2;
    } else if (glass) {
        const hF = 8 + r() * 10,
            t = 0.5,
            sp = 2.4 + r() * 1.4,
            y0 = H;
        const fp = {
            ...P,
            style: STYLE.BLANK,
            layer: LAYER.CONCRETE,
            tint: [0.98, 1.0, 1.03],
        };
        const fin = (x0, z0, x1, z1) => {
            for (const B of [F, FL])
                B.box(
                    x0,
                    y0,
                    z0,
                    x1,
                    y0 + hF,
                    z1,
                    { ...fp, topY: y0 + hF, baseY: y0 },
                    {},
                    true,
                );
            S.box(x0, y0, z0, x1, y0 + hF, z1, "spire");
        };
        for (let x = tm.x0 + 0.3; x < tm.x1 - t; x += sp) {
            fin(x, tm.z0, x + t, tm.z0 + t);
            fin(x, tm.z1 - t, x + t, tm.z1);
        }
        for (let z = tm.z0 + t + sp; z < tm.z1 - t - 0.3; z += sp) {
            fin(tm.x0, z, tm.x0 + t, z + t);
            fin(tm.x1 - t, z, tm.x1, z + t);
        }

        const lv = {
            ...P,
            style: STYLE.RIBBON,
            layer: LAYER.METAL,
            floorH: 0.4,
            bayW: 1.2,
            winW: 1,
            winH: 0.26,
            depth: 0.05,
            tint: [2.2, 2.23, 2.28],
            glass: 2,
        };
        const i0 = 0.52,
            i1 = 0.78,
            hS = hF - 1.2;
        const wall = (x0, z0, x1, z1) => {
            for (const B of [F, FL])
                B.box(
                    x0,
                    y0,
                    z0,
                    x1,
                    y0 + hS,
                    z1,
                    { ...lv, topY: y0 + hS, baseY: y0 },
                    {},
                    true,
                );
            S.box(x0, y0, z0, x1, y0 + hS, z1, "wall");
        };
        if (w > 2 * i1 + 2 && d > 2 * i1 + 2) {
            wall(tm.x0 + i0, tm.z0 + i0, tm.x1 - i0, tm.z0 + i1);
            wall(tm.x0 + i0, tm.z1 - i1, tm.x1 - i0, tm.z1 - i0);
            wall(tm.x0 + i0, tm.z0 + i1, tm.x0 + i1, tm.z1 - i1);
            wall(tm.x1 - i1, tm.z0 + i1, tm.x1 - i0, tm.z1 - i1);
        }
    }
}

function roofDetails(A, H, P, tm, roofLayer, F, D, S, Z, r, pre = []) {
    const pin = tm.parapet > 0 ? 0.3 + 0.6 : 0.8;
    const rx0 = tm.x0 + pin,
        rz0 = tm.z0 + pin,
        rx1 = tm.x1 - pin,
        rz1 = tm.z1 - pin;
    const rw = rx1 - rx0,
        rd = rz1 - rz0;
    const ry = tm.y1;
    const used = pre.slice();
    const place = (w, d, tries = 8) => {
        for (let i = 0; i < tries; i++) {
            if (rw < w || rd < d) return null;
            const x = rx0 + r() * (rw - w),
                z = rz0 + r() * (rd - d);
            if (
                used.some(
                    (u) =>
                        x < u[2] + 0.6 &&
                        x + w > u[0] - 0.6 &&
                        z < u[3] + 0.6 &&
                        z + d > u[1] - 0.6,
                )
            )
                continue;
            used.push([x, z, x + w, z + d]);
            return [x, z];
        }
        return null;
    };
    if (tm.crown) return;
    if (
        (A.type === "glass" || (A.type === "postwar" && H > 70)) &&
        tm.x1 - tm.x0 > 12 &&
        tm.z1 - tm.z0 > 12
    ) {
        const k = 3,
            sh = 5;
        const mp = {
            ...P,
            style: STYLE.BLANK,
            layer: LAYER.METAL,
            tint: [2.6, 2.7, 2.8],
        };
        F.box(
            tm.x0 + k,
            ry,
            tm.z0 + k,
            tm.x1 - k,
            ry + sh,
            tm.z1 - k,
            mp,
            {},
            true,
            false,
            { ...mp, layer: LAYER.ROOF_MEMBRANE, tint: [1, 1, 1] },
        );
        S.box(
            tm.x0 + k,
            ry,
            tm.z0 + k,
            tm.x1 - k,
            ry + sh,
            tm.z1 - k,
            "equipment",
        );
        used.push([tm.x0 + k, tm.z0 + k, tm.x1 - k, tm.z1 - k]);
        for (const [cx, cz, nx, nz] of [
            [tm.x0 + k, tm.z0 + k, -1, -1],
            [tm.x1 - k, tm.z0 + k, 1, -1],
            [tm.x0 + k, tm.z1 - k, -1, 1],
            [tm.x1 - k, tm.z1 - k, 1, 1],
        ]) {
            Z.add(
                cx - nx * 0.15,
                ry + sh,
                cz - nz * 0.15,
                nx * Math.SQRT1_2,
                0,
                nz * Math.SQRT1_2,
                "roofCorner",
            );
        }

        const sy = ry + sh,
            sx0 = tm.x0 + k + 0.8,
            sz0 = tm.z0 + k + 0.8,
            sx1 = tm.x1 - k - 0.8,
            sz1 = tm.z1 - k - 0.8;
        const top = [];
        if (tm.spireR) {
            const qx = (tm.x0 + tm.x1) / 2,
                qz = (tm.z0 + tm.z1) / 2;
            top.push([
                qx - tm.spireR,
                qz - tm.spireR,
                qx + tm.spireR,
                qz + tm.spireR,
            ]);
        }
        const placeTop = (w, d) => {
            for (let i = 0; i < 10; i++) {
                if (sx1 - sx0 < w || sz1 - sz0 < d) return null;
                const x = sx0 + r() * (sx1 - sx0 - w),
                    z = sz0 + r() * (sz1 - sz0 - d);
                if (
                    top.some(
                        (u) =>
                            x < u[2] + 0.8 &&
                            x + w > u[0] - 0.8 &&
                            z < u[3] + 0.8 &&
                            z + d > u[1] - 0.8,
                    )
                )
                    continue;
                top.push([x, z, x + w, z + d]);
                return [x, z];
            }
            return null;
        };
        const area = (sx1 - sx0) * (sz1 - sz0);

        const nCT = 1 + Math.floor(area / 500 + r() * 2);
        if (area > 180) {
            const lng = 7 + r() * 5,
                sh2 = 3.6 + r() * 1.0,
                ax = r() < 0.5;
            const at = placeTop(ax ? lng : sh2, ax ? sh2 : lng);
            if (at)
                coolingTower(
                    D,
                    S,
                    Z,
                    at[0],
                    sy,
                    at[1],
                    ax ? lng : sh2,
                    ax ? sh2 : lng,
                    3.0 + r() * 1.4,
                    r,
                );
        }
        for (let i = 0; i < nCT; i++) {
            const a2 = 2.6 + r() * 4.5,
                b2 = 2.8 + r() * 2.2,
                ax = r() < 0.5;
            const at = placeTop(ax ? a2 : b2, ax ? b2 : a2);
            if (at)
                coolingTower(
                    D,
                    S,
                    Z,
                    at[0],
                    sy,
                    at[1],
                    ax ? a2 : b2,
                    ax ? b2 : a2,
                    1.8 + r() * 2.2,
                    r,
                );
        }
        for (let i = 0, nd = 1 + Math.floor(r() * 3); i < nd; i++) {
            const L = 4 + r() * 9,
                t2 = 0.6 + r() * 0.5,
                ax = r() < 0.5,
                at = placeTop(ax ? L : t2, ax ? t2 : L);
            if (!at) continue;
            const [x0, z0] = at,
                x1 = x0 + (ax ? L : t2),
                z1 = z0 + (ax ? t2 : L),
                yb = sy + 0.25 + r() * 0.5;
            D.setPart(DP.GALV)
                .setColor([0x8e9294, 0x7d8183, 0x9a9a92][Math.floor(r() * 3)])
                .box(x0, yb, z0, x1, yb + t2, z1, 0b111111);
            D.setPart(DP.STEEL).setColor(0x3b3d3f);
            for (let u = 0.3; u < L - 0.2; u += 2.2) {
                const [sx0, sz0] = ax ? [x0 + u, z0 + 0.1] : [x0 + 0.1, z0 + u];
                D.box(
                    sx0,
                    sy,
                    sz0,
                    sx0 + (ax ? 0.12 : t2 - 0.2),
                    yb,
                    sz0 + (ax ? t2 - 0.2 : 0.12),
                    0b110111,
                );
                S.box(
                    sx0,
                    sy,
                    sz0,
                    sx0 + (ax ? 0.12 : t2 - 0.2),
                    yb,
                    sz0 + (ax ? t2 - 0.2 : 0.12),
                    "equipment",
                );
            }
            S.box(x0, yb, z0, x1, yb + t2, z1, "equipment");
        }
        for (let i = 0, np = Math.floor(r() * 3); i < np; i++) {
            const L = 5 + r() * 8,
                ax = r() < 0.5,
                at = placeTop(ax ? L : 0.8, ax ? 0.8 : L);
            if (!at) continue;
            const c = [0x7a6a3a, 0x5d6b73, 0x8a8f8a, 0x6b3f33][
                Math.floor(r() * 4)
            ];
            for (const o2 of [0.1, 0.48]) {
                const [x0, z0] = ax ? [at[0], at[1] + o2] : [at[0] + o2, at[1]],
                    x1 = x0 + (ax ? L : 0.22),
                    z1 = z0 + (ax ? 0.22 : L);
                D.setPart(DP.PAINT)
                    .setColor(c)
                    .box(x0, sy + 0.3, z0, x1, sy + 0.52, z1, 0b111111);
                S.box(x0, sy + 0.3, z0, x1, sy + 0.52, z1, "equipment");
            }
            D.setPart(DP.STEEL).setColor(0x2e3032);
            for (let u = 0.2; u < L; u += 2.5) {
                const [sx0, sz0] = ax ? [at[0] + u, at[1]] : [at[0], at[1] + u];
                const sx1 = sx0 + (ax ? 0.15 : 0.8),
                    sz1 = sz0 + (ax ? 0.8 : 0.15);
                D.box(sx0, sy, sz0, sx1, sy + 0.3, sz1, 0b110111);
                S.box(sx0, sy, sz0, sx1, sy + 0.3, sz1, "equipment");
            }
        }
        {
            const gx0 = tm.x0 + k + 0.15,
                gz0 = tm.z0 + k + 0.15,
                gx1 = tm.x1 - k - 0.15,
                gz1 = tm.z1 - k - 0.15,
                rt = 0.05;
            D.setPart(DP.STEEL).setColor(0x6d7072);
            for (const [a0, b0, a1, b1] of [
                [gx0, gz0, gx1, gz0 + rt],
                [gx0, gz1 - rt, gx1, gz1],
                [gx0, gz0 + rt, gx0 + rt, gz1 - rt],
                [gx1 - rt, gz0 + rt, gx1, gz1 - rt],
            ]) {
                for (const yr of [0.55, 1.05]) {
                    D.box(a0, sy + yr, b0, a1, sy + yr + 0.05, b1, 0b111111);
                    S.box(
                        a0,
                        sy + yr,
                        b0,
                        a1,
                        sy + yr + 0.05,
                        b1,
                        "pole",
                        OVERHANG,
                    );
                }
                const alx = a1 - a0 > b1 - b0,
                    L = alx ? a1 - a0 : b1 - b0,
                    np2 = Math.max(1, Math.round(L / 2.4));
                for (let i = 0; i <= np2; i++) {
                    const u = (alx ? a0 : b0) + ((L - rt) * i) / np2;
                    const [px0, pz0] = alx ? [u, b0] : [a0, u];
                    D.box(
                        px0,
                        sy,
                        pz0,
                        px0 + rt,
                        sy + 1.05,
                        pz0 + rt,
                        0b110111,
                    );
                    S.box(px0, sy, pz0, px0 + rt, sy + 1.05, pz0 + rt, "pole");
                }
            }
        }
        for (
            let pb = 0, npb = 1 + Math.floor(area / 600 + r());
            pb < npb;
            pb++
        ) {
            const w = 4 + r() * 6,
                d = 3 + r() * 4,
                h = 2.5 + r() * 2.5;
            const at = placeTop(w, d);
            if (at) {
                F.box(
                    at[0],
                    sy,
                    at[1],
                    at[0] + w,
                    sy + h,
                    at[1] + d,
                    mp,
                    {},
                    true,
                    false,
                    {
                        ...mp,
                        layer: LAYER.ROOF_MEMBRANE,
                        tint: [0.9, 0.9, 0.9],
                    },
                );
                S.box(
                    at[0],
                    sy,
                    at[1],
                    at[0] + w,
                    sy + h,
                    at[1] + d,
                    "equipment",
                );
                for (const [cx, cz, nx, nz] of [
                    [at[0], at[1], -1, -1],
                    [at[0] + w, at[1], 1, -1],
                    [at[0], at[1] + d, -1, 1],
                    [at[0] + w, at[1] + d, 1, 1],
                ])
                    Z.add(
                        cx - nx * 0.15,
                        sy + h,
                        cz - nz * 0.15,
                        nx * Math.SQRT1_2,
                        0,
                        nz * Math.SQRT1_2,
                        "roofCorner",
                    );
            }
        }
        for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) {
            const at = placeTop(0.7, 0.7);
            if (at)
                antenna(D, S, Z, at[0] + 0.35, sy, at[1] + 0.35, 5 + r() * 16);
        }
        for (let i = 0, n = 2 + Math.floor(area / 250 + r() * 3); i < n; i++) {
            const w = 1.6 + r() * 1.6,
                d = 1.2 + r() * 1.0,
                at = placeTop(w, d);
            if (at) hvac(D, S, at[0], sy, at[1], w, d, 1.0 + r() * 0.8, r);
        }

        const ring = Math.min(k - 1.2, 1.6);
        if (ring > 1.0) {
            const side = Math.floor(r() * 4);
            for (let u = 0.2; u < 0.8; u += 0.3)
                if (r() < 0.7) {
                    const w = 1.4,
                        d = Math.min(ring, 1.3);
                    const x =
                        side < 2
                            ? tm.x0 + (tm.x1 - tm.x0) * u
                            : side === 2
                              ? tm.x0 + 0.9
                              : tm.x1 - 0.9 - d;
                    const z =
                        side < 2
                            ? side === 0
                                ? tm.z0 + 0.9
                                : tm.z1 - 0.9 - d
                            : tm.z0 + (tm.z1 - tm.z0) * u;
                    if (side < 2) hvac(D, S, x, ry, z, w, d, 1.1, r);
                    else hvac(D, S, x, ry, z, d, w, 1.1, r);
                }
            for (const [cx, cz] of [
                [tm.x0 + 0.6, tm.z0 + 0.6],
                [tm.x1 - 0.6, tm.z0 + 0.6],
                [tm.x0 + 0.6, tm.z1 - 0.6],
                [tm.x1 - 0.6, tm.z1 - 0.6],
            ]) {
                D.setPart(DP.GALV)
                    .setColor(0x9a9da0)
                    .cyl(cx, ry, cz, 0.09, 0.08, 2.4, 8, true);
                S.cyl(
                    cx,
                    cz,
                    ry,
                    ry + 2.4,
                    polyR(0.09, 8),
                    polyR(0.08, 8),
                    "pole",
                );
                Z.add(cx, ry + 2.4, cz, 0, 1, 0, "pole");
            }
        }
        return;
    }
    if (A.type !== "deco" && rw > 5 && rd > 5) {
        const bw = Math.min(5, rw * 0.4),
            bd = Math.min(4, rd * 0.4),
            bh = 3.2;
        const at = place(bw, bd);
        if (at) {
            const [bx, bz] = at;
            F.box(
                bx,
                ry,
                bz,
                bx + bw,
                ry + bh,
                bz + bd,
                { ...P, style: STYLE.BLANK, topY: ry + bh },
                {},
                true,
                false,
                {
                    ...P,
                    style: STYLE.BLANK,
                    layer: roofLayer,
                    tint: [0.85, 0.85, 0.85],
                },
            );
            S.box(bx, ry, bz, bx + bw, ry + bh, bz + bd, "bulkhead");
            D.setPart(DP.STEEL)
                .setColor(0x3a3f44)
                .box(
                    bx + bw * 0.5 - 0.5,
                    ry,
                    bz - 0.04,
                    bx + bw * 0.5 + 0.5,
                    ry + 2.1,
                    bz,
                    0b100111,
                );
            S.box(
                bx + bw * 0.5 - 0.5,
                ry,
                bz - 0.04,
                bx + bw * 0.5 + 0.5,
                ry + 2.1,
                bz,
                "bulkhead",
            );
            for (const [cx, cz, nx, nz] of [
                [bx, bz, -1, -1],
                [bx + bw, bz, 1, -1],
                [bx, bz + bd, -1, 1],
                [bx + bw, bz + bd, 1, 1],
            ]) {
                Z.add(
                    cx - nx * 0.15,
                    ry + bh,
                    cz - nz * 0.15,
                    nx * Math.SQRT1_2,
                    0,
                    nz * Math.SQRT1_2,
                    "roofCorner",
                );
            }
        }
    }
    if (A.waterTower && r() < 0.5) {
        const rad = 1.5 + r() * 1.4;
        const at = place(rad * 2 + 0.4, rad * 2 + 0.4);
        if (at)
            waterTower(
                D,
                S,
                Z,
                at[0] + rad + 0.2,
                ry,
                at[1] + rad + 0.2,
                rad,
                r,
            );
    }

    if (rw * rd > 120 || A.type === "postwar") {
        const n = Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
            const w = 1.1 + r() * 1.6,
                d2 = 0.9 + r() * 1.3,
                h = 0.8 + r() * 0.8;
            const at = place(w, d2);
            if (!at) continue;
            const [x, z] = at;
            hvac(D, S, x, ry, z, w, d2, h, r);
        }
    }

    if (
        (A.type === "loft" || A.type === "walkup" || A.type === "apt") &&
        r() < 0.55
    ) {
        const n = 1 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
            const w = 1.4 + r() * 2.2,
                d2 = 1.2 + r() * 0.8;
            const at = place(w, d2);
            if (!at) continue;
            skylight(D, S, at[0], ry, at[1], w, d2, r() < 0.5 ? 0 : 2);
        }
    }

    for (let i = 0, n = 1 + Math.floor(r() * 2); i < n; i++) {
        const at = place(0.5, 0.5, 3);
        if (!at) continue;
        D.setPart(DP.STEEL)
            .setColor(0x1c1d1e)
            .cyl(at[0] + 0.25, ry, at[1] + 0.25, 0.24, 0.2, 0.012, 16, true);
        D.setColor(0x0e0e0e).cyl(
            at[0] + 0.25,
            ry + 0.012,
            at[1] + 0.25,
            0.11,
            0.07,
            0.035,
            8,
            true,
        );
    }

    for (let i = 0, n = Math.floor(r() * 5); i < n; i++) {
        const at = place(0.3, 0.3, 3);
        if (!at) continue;
        const vr = 0.06 + r() * 0.06,
            vh = 0.6 + r() * 0.8;
        D.setPart(DP.GALV)
            .setColor(0x8c8f92)
            .cyl(at[0] + 0.15, ry, at[1] + 0.15, vr, vr, vh, 8, true);
        S.cyl(at[0] + 0.15, at[1] + 0.15, ry, ry + vh, vr, vr, "equipment");
    }

    if (H > 70 && r() < 0.35) {
        const at = place(0.6, 0.6, 4);
        if (at) antenna(D, S, Z, at[0] + 0.3, ry, at[1] + 0.3, 6 + r() * 8);
    }
}

function facadeDetails(A, H, m0, ft0, D, S, Z, r, ctx) {
    for (const s of ["nx", "px", "nz", "pz"]) {
        if (ft0[s] !== "street") continue;
        const fr = faceFrame(m0, s);
        if (A.type !== "glass" && A.gH > 0) {
            const nb2 = Math.max(1, Math.floor(fr.W / 6.5 + 0.5));
            const bw2 = fr.W / nb2;
            for (let i = 0; i < nb2; i++) {
                if (r() > 0.38) continue;
                const u0 = i * bw2 + 0.45,
                    u1 = (i + 1) * bw2 - 0.45;

                awning(
                    D,
                    S,
                    fr,
                    u0,
                    u1,
                    Math.min(A.gH - 0.6, Math.max(A.gH - 1.62, 3.5)),
                    AWNING[Math.floor(r() * AWNING.length)],
                    r,
                );
            }
        }
        if (A.fireEscape && (s === "nz" || s === "pz") && fr.W > 7) {
            const floorsN = Math.round((H - A.gH) / A.floorH);
            fireEscape(D, S, fr, fr.W * 0.5, A, floorsN);
        }
        if (A.decor)
            A.decor({ D, S, fr, m: m0, s, A, DP, frameMatrix, frameAABB });
        if (A.type !== "walkup" && r() < 0.12 && fr.W > 12)
            flagPole(
                D,
                Z,
                fr,
                fr.W * (0.3 + r() * 0.4),
                A.gH + A.floorH * 0.6,
                r,
                ctx.buildings,
            );
        if (
            (A.type === "postwar" || A.type === "apt") &&
            !A.noBalconies &&
            fr.W > 14 &&
            r() < 0.55
        )
            balconies(D, S, Z, fr, A, m0.y1, r);
    }
}

function faceFrame(m, s) {
    switch (s) {
        case "pz":
            return {
                O: [m.x0, 0, m.z1],
                T: [1, 0, 0],
                N: [0, 0, 1],
                W: m.x1 - m.x0,
            };
        case "nz":
            return {
                O: [m.x1, 0, m.z0],
                T: [-1, 0, 0],
                N: [0, 0, -1],
                W: m.x1 - m.x0,
            };
        case "px":
            return {
                O: [m.x1, 0, m.z1],
                T: [0, 0, -1],
                N: [1, 0, 0],
                W: m.z1 - m.z0,
            };
        default:
            return {
                O: [m.x0, 0, m.z0],
                T: [0, 0, 1],
                N: [-1, 0, 0],
                W: m.z1 - m.z0,
            };
    }
}
function frameMatrix(fr) {
    const m = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...fr.T),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(...fr.N),
    );
    m.setPosition(fr.O[0], 0, fr.O[2]);
    return m;
}

function frameAABB(fr, u0, y0, n0, u1, y1, n1) {
    const xs = [],
        zs = [];
    for (const u of [u0, u1])
        for (const n of [n0, n1]) {
            xs.push(fr.O[0] + fr.T[0] * u + fr.N[0] * n);
            zs.push(fr.O[2] + fr.T[2] * u + fr.N[2] * n);
        }
    return [
        Math.min(...xs),
        y0,
        Math.min(...zs),
        Math.max(...xs),
        y1,
        Math.max(...zs),
    ];
}

function awning(D, S, fr, u0, u1, yTop, color, r) {
    const out = 1.1 + r() * 0.3,
        drop = 0.55,
        val = 0.32,
        thk = 0.03;
    const sl = Math.hypot(out, drop),
        ny = out / sl,
        nn = drop / sl;
    D.setPart(DP.CANVAS);
    D.with(frameMatrix(fr), (d) => {
        d.setColor(color);
        const a = d.vert(u0, yTop, 0, 0, ny, nn, 0, 0),
            bb = d.vert(u1, yTop, 0, 0, ny, nn, 1, 0);
        const c = d.vert(u1, yTop - drop, out, 0, ny, nn, 1, 1),
            e = d.vert(u0, yTop - drop, out, 0, ny, nn, 0, 1);
        d.quad(a, e, c, bb);
        d.setColor(hexLin(color).map((v) => v * 0.35));
        const a2 = d.vert(u0, yTop - thk, 0, 0, -ny, -nn),
            b2 = d.vert(u1, yTop - thk, 0, 0, -ny, -nn);
        const c2 = d.vert(u1, yTop - drop - thk, out - 0.02, 0, -ny, -nn),
            e2 = d.vert(u0, yTop - drop - thk, out - 0.02, 0, -ny, -nn);
        d.quad(a2, b2, c2, e2);
        d.setColor(color);
        d.box(
            u0,
            yTop - drop - val,
            out - 0.02,
            u1,
            yTop - drop,
            out + 0.01,
            0b110111,
        );

        const oc = out - 0.02,
            yc = yTop - drop * (oc / out);
        const s0 = [
            d.vert(u0, yTop, 0, -1, 0, 0),
            d.vert(u0, yTop - drop - val, oc, -1, 0, 0),
            d.vert(u0, yc, oc, -1, 0, 0),
        ];
        d.tri(s0[0], s0[1], s0[2]);
        const s1 = [
            d.vert(u1, yTop, 0, 1, 0, 0),
            d.vert(u1, yc, oc, 1, 0, 0),
            d.vert(u1, yTop - drop - val, oc, 1, 0, 0),
        ];
        d.tri(s1[0], s1[1], s1[2]);
    });

    const bx = frameAABB(fr, u0, 0, 0, u1, 0, out);
    const axis = fr.N[0] !== 0 ? 0 : 2,
        sign = fr.N[0] + fr.N[2];
    const yA = sign > 0 ? yTop : yTop - drop,
        yB = sign > 0 ? yTop - drop : yTop;
    S.ramp(
        bx[0],
        yTop - drop - thk,
        bx[2],
        bx[3],
        bx[5],
        axis,
        yA,
        yB,
        "awning",
        OVERHANG,
        thk,
    );
    const vb = frameAABB(
        fr,
        u0,
        yTop - drop - val,
        out - 0.02,
        u1,
        yTop - drop,
        out + 0.01,
    );
    S.box(vb[0], vb[1], vb[2], vb[3], vb[4], vb[5], "awning", OVERHANG);
}

function fireEscape(D, S, fr, uc, A, floorsN) {
    const w = 5.2,
        dep = 1.15;
    const u0 = uc - w / 2,
        u1 = uc + w / 2;
    D.setPart(DP.STEEL);
    D.with(frameMatrix(fr), (d) => {
        d.setColor(0x2b2b2a);
        for (let f = 0; f < floorsN; f++) {
            const y = A.gH + f * A.floorH + 0.05;
            d.setPart(DP.GRATE);
            d.box(u0, y - 0.06, 0.01, u1, y, dep, 0b111111);
            d.setPart(DP.STEEL);
            d.setPart(DP.WIRE);
            d.box(u0, y + 0.95, dep - 0.04, u1, y + 1.0, dep, 0b111111);
            d.box(
                u0,
                y + 0.45,
                dep - 0.024,
                u1,
                y + 0.48,
                dep + 0.006,
                0b110111,
            );
            for (let k = 0; k <= 8; k++) {
                const u = u0 + (k / 8) * w;
                d.box(
                    u - 0.015,
                    y,
                    dep - 0.03,
                    u + 0.015,
                    y + 0.95,
                    dep,
                    0b110011,
                );
            }
            d.setPart(DP.STEEL);

            for (const [a0, a1] of [
                [u0, u0 + 0.04],
                [u1 - 0.04, u1],
            ]) {
                d.box(a0, y + 0.95, 0.01, a1, y + 1.0, dep - 0.04, 0b111111);
                d.box(a0, y + 0.45, 0.01, a1, y + 0.48, dep - 0.04, 0b111111);
                d.box(
                    a0,
                    y,
                    dep * 0.5 - 0.015,
                    a1,
                    y + 0.95,
                    dep * 0.5 + 0.015,
                    0b110011,
                );
            }
            if (f < floorsN - 1) {
                const yn = y + A.floorH;
                const a0 = [u0 + 0.5, y, dep * 0.5],
                    a1 = [u1 - 0.6, yn, dep * 0.5];
                d.tube([a0[0], a0[1], 0.25], [a1[0], a1[1], 0.25], 0.03, 4);
                d.tube(
                    [a0[0], a0[1], dep - 0.25],
                    [a1[0], a1[1], dep - 0.25],
                    0.03,
                    4,
                );
                const n = 12;
                for (let k = 1; k < n; k++) {
                    const t = k / n;
                    const x = a0[0] + (a1[0] - a0[0]) * t,
                        yy = a0[1] + (a1[1] - a0[1]) * t;
                    d.box(
                        x - 0.1,
                        yy - 0.02,
                        0.25,
                        x + 0.1,
                        yy,
                        dep - 0.25,
                        0b000100,
                    );
                }
            }
            const bb = frameAABB(fr, u0, y - 0.06, 0.01, u1, y, dep);
            S.box(...bb, "fireescape", OVERHANG);
            const rb = frameAABB(
                fr,
                u0,
                y + 0.95,
                dep - 0.04,
                u1,
                y + 1.0,
                dep,
            );
            S.box(...rb, "fireescape", OVERHANG);
            S.box(
                ...frameAABB(
                    fr,
                    u0,
                    y + 0.45,
                    dep - 0.024,
                    u1,
                    y + 0.48,
                    dep + 0.006,
                ),
                "fireescape",
                OVERHANG,
            );
            for (const [a0, a1] of [
                [u0, u0 + 0.04],
                [u1 - 0.04, u1],
            ]) {
                S.box(
                    ...frameAABB(
                        fr,
                        a0,
                        y + 0.95,
                        0.01,
                        a1,
                        y + 1.0,
                        dep - 0.04,
                    ),
                    "fireescape",
                    OVERHANG,
                );
                S.box(
                    ...frameAABB(
                        fr,
                        a0,
                        y + 0.45,
                        0.01,
                        a1,
                        y + 0.48,
                        dep - 0.04,
                    ),
                    "fireescape",
                    OVERHANG,
                );
            }
        }
    });
}

function balconies(D, S, Z, fr, A, H, r) {
    const dep = 1.3,
        w = 3.4,
        nStack = fr.W > 26 ? 2 : 1;
    const floorsN = Math.round((H - A.gH) / A.floorH);
    const f0 = 1 + Math.floor(r() * 2);
    for (let k = 0; k < nStack; k++) {
        const uc =
            fr.W * (nStack === 1 ? 0.5 : k === 0 ? 0.27 : 0.73) +
            (r() - 0.5) * 2;
        const u0 = uc - w / 2,
            u1 = uc + w / 2;
        if (u0 < 1 || u1 > fr.W - 1) continue;
        for (let f = f0; f < floorsN - 1; f++) {
            const y = A.gH + f * A.floorH;
            D.with(frameMatrix(fr), (d) => {
                d.setPart(DP.CONC)
                    .setColor(0xb9b6ae)
                    .box(u0, y - 0.18, 0, u1, y, dep, 0b111111 & ~0b100000);
                d.setPart(DP.GLASS)
                    .setColor(0x8fa3b0)
                    .box(
                        u0 + 0.05,
                        y,
                        dep - 0.06,
                        u1 - 0.05,
                        y + 1.0,
                        dep - 0.04,
                        0b111111,
                    );
                d.setPart(DP.WIRE)
                    .setColor(0x2c2e30)
                    .box(
                        u0 + 0.03,
                        y + 1.0,
                        dep - 0.07,
                        u1 - 0.03,
                        y + 1.05,
                        dep - 0.03,
                        0b111111,
                    );
                for (const u of [u0 + 0.05, u1 - 0.09])
                    d.box(
                        u,
                        y,
                        dep - 0.07,
                        u + 0.04,
                        y + 1.0,
                        dep - 0.03,
                        0b110011,
                    );
                d.setPart(DP.STEEL);
            });
            S.box(
                ...frameAABB(fr, u0, y - 0.18, 0, u1, y, dep),
                "ledge",
                OVERHANG,
            );
            S.box(
                ...frameAABB(
                    fr,
                    u0 + 0.03,
                    y,
                    dep - 0.07,
                    u1 - 0.03,
                    y + 1.05,
                    dep - 0.03,
                ),
                "glass",
                OVERHANG,
            );
            if (y >= 8) {
                const p = frameAABB(fr, uc, y, dep - 0.5, uc, y, dep - 0.5);
                Z.add(p[0], y, p[2], fr.N[0], 0, fr.N[2], "ledge");
            }
        }
    }
}

function flagPole(D, Z, fr, u, y, r, buildings) {
    const M = frameMatrix(fr);
    D.setPart(DP.GALV);
    D.with(M, (d) => {
        d.setColor(0xc9b27a);
        d.tube([u, y, 0], [u, y + 1.8, 2.6], 0.035, 6);
    });
    const p = new THREE.Vector3(u, y + 1.8, 2.6).applyMatrix4(M);
    const q = new THREE.Vector3(u, y, 0).applyMatrix4(M);
    (buildings.flags ??= []).push({
        top: p,
        base: q,
        N: fr.N,
        T: fr.T,
        color: Math.floor(r() * 4),
    });
    Z.add(p.x, p.y + 0.035, p.z, 0, 1, 0, "pole");
}

function hvac(D, S, x, y, z, w, d, h, r) {
    const c = [0x6f706c, 0x5f6364, 0x77705f, 0x566061, 0x7c776b, 0x656d66][
        Math.floor(r() * 6)
    ];
    D.setPart(DP.PAINT)
        .setColor(c)
        .box(x, y + 0.12, z, x + w, y + h, z + d, 0b110111);

    D.setPart(DP.STEEL)
        .setColor(0x3b3d3f)
        .box(
            x + 0.08,
            y,
            z + 0.08,
            x + w - 0.08,
            y + 0.12,
            z + d - 0.08,
            0b110011,
        );
    S.box(x, y + 0.12, z, x + w, y + h, z + d, "equipment");
    S.box(
        x + 0.08,
        y,
        z + 0.08,
        x + w - 0.08,
        y + 0.12,
        z + d - 0.08,
        "equipment",
    );

    const fr = Math.min(w, d) * 0.3;
    D.setPart(DP.STEEL)
        .setColor(0x2e3032)
        .cyl(x + w * 0.5, y + h, z + d * 0.5, fr, fr, 0.3, 20, true);
    S.cyl(
        x + w * 0.5,
        z + d * 0.5,
        y + h,
        y + h + 0.3,
        polyR(fr, 20),
        polyR(fr, 20),
        "equipment",
    );

    D.setPart(DP.STEEL).setColor(0x55585a);
    for (let k = 0; k < 5; k++)
        D.box(
            x + 0.2,
            y + 0.3 + k * 0.16,
            z - 0.02,
            x + w - 0.2,
            y + 0.36 + k * 0.16,
            z,
            0b110111,
        );
    S.box(
        x + 0.2,
        y + 0.3,
        z - 0.02,
        x + w - 0.2,
        y + 0.36 + 4 * 0.16,
        z,
        "equipment",
    );
}

function coolingTower(D, S, Z, x, y, z, w, d, h, r) {
    D.setPart(DP.PAINT)
        .setColor(
            [0x9da3a6, 0x8f969a, 0x8a8778, 0x7b847e, 0x6a6d6e, 0xa39a86][
                Math.floor(r() * 6)
            ],
        )
        .box(x, y + 0.15, z, x + w, y + h, z + d, 0b110111);
    D.setPart(DP.STEEL)
        .setColor(0x3b3d3f)
        .box(x + 0.1, y, z + 0.1, x + w - 0.1, y + 0.15, z + d - 0.1, 0b110011);
    S.box(x, y + 0.15, z, x + w, y + h, z + d, "equipment");
    S.box(x + 0.1, y, z + 0.1, x + w - 0.1, y + 0.15, z + d - 0.1, "equipment");

    D.setPart(DP.STEEL).setColor(0x4f5456);
    for (let k = 0; k < 6; k++) {
        const yy = y + 0.3 + (k * (h - 0.8)) / 6;
        D.box(x + 0.15, yy, z - 0.02, x + w - 0.15, yy + 0.05, z, 0b110111);
        D.box(
            x + 0.15,
            yy,
            z + d,
            x + w - 0.15,
            yy + 0.05,
            z + d + 0.02,
            0b110111,
        );
    }
    S.box(
        x + 0.15,
        y + 0.3,
        z - 0.02,
        x + w - 0.15,
        y + 0.35 + (5 * (h - 0.8)) / 6,
        z,
        "equipment",
    );
    S.box(
        x + 0.15,
        y + 0.3,
        z + d,
        x + w - 0.15,
        y + 0.35 + (5 * (h - 0.8)) / 6,
        z + d + 0.02,
        "equipment",
    );
    const ax = w >= d,
        L = ax ? w : d,
        T2 = ax ? d : w;
    const nf = Math.max(1, Math.min(4, Math.round(L / 3.4))),
        fr = Math.min(T2 * 0.36, (L / nf) * 0.36);
    for (let i = 0; i < nf; i++) {
        const cx = ax ? x + (w * (i + 0.5)) / nf : x + w / 2,
            cz = ax ? z + d / 2 : z + (d * (i + 0.5)) / nf;
        D.setPart(DP.STEEL)
            .setColor(0x2e3032)
            .cyl(cx, y + h, cz, fr, fr * 0.92, 0.7, 24, false);
        D.setPart(DP.STEEL)
            .setColor(0x151617)
            .cyl(cx, y + h + 0.68, cz, fr * 0.9, fr * 0.9, 0.02, 24, true);
        S.cyl(
            cx,
            cz,
            y + h,
            y + h + 0.7,
            polyR(fr, 24),
            polyR(fr * 0.92, 24),
            "equipment",
        );
    }
    for (const [cx, cz, nx, nz] of [
        [x, z, -1, -1],
        [x + w, z, 1, -1],
        [x, z + d, -1, 1],
        [x + w, z + d, 1, 1],
    ])
        Z.add(
            cx - nx * 0.15,
            y + h,
            cz - nz * 0.15,
            nx * Math.SQRT1_2,
            0,
            nz * Math.SQRT1_2,
            "roofCorner",
        );
}

function skylight(D, S, x, y, z, w, d, axis) {
    const ch = 0.35,
        rise = Math.min(w, d) * 0.28;
    D.setPart(DP.PAINT)
        .setColor(0x6b6e70)
        .box(x, y, z, x + w, y + ch, z + d, 0b110011);
    S.box(x, y, z, x + w, y + ch, z + d, "skylight");
    const yc = y + ch;
    D.setPart(DP.GLASS).setColor(0x8fa3b0);
    if (axis === 0) {
        const zm = z + d / 2,
            l = Math.hypot(d / 2, rise),
            ny = d / 2 / l,
            nz = rise / l;
        let a = D.vert(x, yc, z, 0, ny, -nz),
            b = D.vert(x + w, yc, z, 0, ny, -nz),
            c = D.vert(x + w, yc + rise, zm, 0, ny, -nz),
            e = D.vert(x, yc + rise, zm, 0, ny, -nz);
        D.quad(a, e, c, b);
        a = D.vert(x, yc, z + d, 0, ny, nz);
        b = D.vert(x + w, yc, z + d, 0, ny, nz);
        c = D.vert(x + w, yc + rise, zm, 0, ny, nz);
        e = D.vert(x, yc + rise, zm, 0, ny, nz);
        D.quad(a, b, c, e);
        D.tri(
            D.vert(x, yc, z, -1, 0, 0),
            D.vert(x, yc, z + d, -1, 0, 0),
            D.vert(x, yc + rise, zm, -1, 0, 0),
        );
        D.tri(
            D.vert(x + w, yc, z + d, 1, 0, 0),
            D.vert(x + w, yc, z, 1, 0, 0),
            D.vert(x + w, yc + rise, zm, 1, 0, 0),
        );
        S.ramp(x, yc, z, x + w, zm, 2, yc, yc + rise, "skylight");
        S.ramp(x, yc, zm, x + w, z + d, 2, yc + rise, yc, "skylight");
    } else {
        const xm = x + w / 2,
            l = Math.hypot(w / 2, rise),
            ny = w / 2 / l,
            nx = rise / l;
        let a = D.vert(x, yc, z, -nx, ny, 0),
            b = D.vert(x, yc, z + d, -nx, ny, 0),
            c = D.vert(xm, yc + rise, z + d, -nx, ny, 0),
            e = D.vert(xm, yc + rise, z, -nx, ny, 0);
        D.quad(a, b, c, e);
        a = D.vert(x + w, yc, z, nx, ny, 0);
        b = D.vert(x + w, yc, z + d, nx, ny, 0);
        c = D.vert(xm, yc + rise, z + d, nx, ny, 0);
        e = D.vert(xm, yc + rise, z, nx, ny, 0);
        D.quad(a, e, c, b);
        D.tri(
            D.vert(x + w, yc, z, 0, 0, -1),
            D.vert(x, yc, z, 0, 0, -1),
            D.vert(xm, yc + rise, z, 0, 0, -1),
        );
        D.tri(
            D.vert(x, yc, z + d, 0, 0, 1),
            D.vert(x + w, yc, z + d, 0, 0, 1),
            D.vert(xm, yc + rise, z + d, 0, 0, 1),
        );
        S.ramp(x, yc, z, xm, z + d, 0, yc, yc + rise, "skylight");
        S.ramp(xm, yc, z, x + w, z + d, 0, yc + rise, yc, "skylight");
    }

    D.setPart(DP.STEEL).setColor(0x2a2c2e);

    if (axis === 0) {
        D.box(
            x - 0.01,
            yc + rise - 0.02,
            z + d / 2 - 0.04,
            x + w + 0.01,
            yc + rise + 0.02,
            z + d / 2 + 0.04,
            0b110111,
        );
        S.box(
            x - 0.01,
            yc + rise - 0.02,
            z + d / 2 - 0.04,
            x + w + 0.01,
            yc + rise + 0.02,
            z + d / 2 + 0.04,
            "skylight",
        );
    } else {
        D.box(
            x + w / 2 - 0.04,
            yc + rise - 0.02,
            z - 0.01,
            x + w / 2 + 0.04,
            yc + rise + 0.02,
            z + d + 0.01,
            0b110111,
        );
        S.box(
            x + w / 2 - 0.04,
            yc + rise - 0.02,
            z - 0.01,
            x + w / 2 + 0.04,
            yc + rise + 0.02,
            z + d + 0.01,
            "skylight",
        );
    }
}

function antenna(D, S, Z, x, y, z, h) {
    D.setPart(DP.STEEL).setColor(0x3c3f42);
    D.cyl(x, y, z, 0.3, 0.3, 0.25, 16, true);
    D.setPart(DP.WIRE).cyl(x, y + 0.25, z, 0.08, 0.04, h - 0.25, 6, true);
    for (let k = 1; k <= 3; k++) {
        const yy = y + h * (0.35 + k * 0.15);
        D.box(x - 0.6, yy, z - 0.02, x + 0.6, yy + 0.04, z + 0.02);
        S.box(
            x - 0.6,
            yy,
            z - 0.02,
            x + 0.6,
            yy + 0.04,
            z + 0.02,
            "antenna",
            OVERHANG,
        );
    }
    D.setPart(DP.PAINT)
        .setColor(0xc02020)
        .cyl(x, y + h, z, 0.06, 0.06, 0.12, 6, true);
    S.cyl(x, z, y, y + 0.25, 0.3, 0.3, "antenna");
    S.cyl(x, z, y + 0.25, y + h, 0.08, 0.04, "antenna");
    S.cyl(x, z, y + h, y + h + 0.12, 0.06, 0.06, "antenna");
    Z.add(x, y + h + 0.12, z, 0, 1, 0, "antenna");
}

function waterTower(D, S, Z, x, y, z, r, rnd) {
    const legH = 1.6 + rnd() * 4.2;
    const tankH = r * (1.7 + rnd() * 0.9);
    const lr = 0.11,
        lx = r * 0.72;

    D.setPart(DP.STEEL).setColor(0x2a2624);
    const legs = [
        [x - lx, z - lx],
        [x + lx, z - lx],
        [x + lx, z + lx],
        [x - lx, z + lx],
    ];
    for (const [px, pz] of legs) {
        D.cyl(px, y, pz, lr, lr, legH - 0.2, 8, false);
        S.cyl(
            px,
            pz,
            y,
            y + legH - 0.2,
            polyR(lr, 8),
            polyR(lr, 8),
            "watertower",
        );
    }
    D.setPart(DP.WIRE);
    for (let k = 0; k < 4; k++) {
        const [ax, az] = legs[k],
            [bx, bz] = legs[(k + 1) % 4];
        D.tube([ax, y + 0.3, az], [bx, y + legH - 0.4, bz], 0.03, 4);
        D.tube([bx, y + 0.3, bz], [ax, y + legH - 0.4, az], 0.03, 4);
    }

    D.setPart(DP.WOOD)
        .setColor(0x5a4a3c)
        .box(
            x - r * 0.95,
            y + legH - 0.2,
            z - r * 0.95,
            x + r * 0.95,
            y + legH,
            z + r * 0.95,
        );
    S.box(
        x - r * 0.95,
        y + legH - 0.2,
        z - r * 0.95,
        x + r * 0.95,
        y + legH,
        z + r * 0.95,
        "watertower",
        OVERHANG,
    );

    const wq = rnd(),
        wood =
            wq < 0.35
                ? 0x6e5846
                : wq < 0.55
                  ? 0x5a4636
                  : wq < 0.72
                    ? 0x7d6a57
                    : wq < 0.86
                      ? 0x8a8580
                      : 0x9a8f80;
    D.setPart(DP.WOOD)
        .setColor(wood)
        .cyl(x, y + legH, z, r, r * 0.97, tankH, 32, false);

    S.cyl(
        x,
        z,
        y + legH,
        y + legH + tankH,
        polyR(r, 32) + 0.005,
        polyR(r * 0.97, 32) + 0.005,
        "watertower",
        OVERHANG,
    );
    D.setPart(DP.STEEL).setColor(0x222222);
    for (let k = 0; k < 6; k++) {
        const t = (0.3 + (k * (tankH - 0.5)) / 5) / tankH,
            rr = r + (r * 0.97 - r) * t + 0.015;
        D.cyl(x, y + legH + t * tankH - 0.04, z, rr, rr, 0.08, 32, false);
    }

    const yR = y + legH + tankH;
    D.setPart(DP.TAR)
        .setColor(0x4a4038)
        .cyl(x, yR, z, r * 1.04, 0.15, r * 0.7, 32, true);
    S.cyl(
        x,
        z,
        yR,
        yR + r * 0.7,
        polyR(r * 1.04, 32),
        polyR(0.15, 32),
        "watertower",
        OVERHANG,
    );
    D.setPart(DP.STEEL)
        .setColor(0x333333)
        .cyl(x, yR + r * 0.7, z, 0.12, 0.05, 0.6, 6, true);
    S.cyl(
        x,
        z,
        yR + r * 0.7,
        yR + r * 0.7 + 0.6,
        0.12,
        0.05,
        "watertower",
        OVERHANG,
    );

    D.setPart(DP.STEEL).setColor(0x2a2624);
    const lz = z - r - 0.05,
        ls = rnd() < 0.5 ? 1 : -1;
    D.with(M4(x, 0, z, ls < 0 ? 0 : Math.PI, 1), (DD) => {
        const l = -r - 0.05;
        DD.box(-0.25, y + legH, l - 0.03, -0.22, yR, l);
        DD.box(0.22, y + legH, l - 0.03, 0.25, yR, l);
        for (let yy = y + legH + 0.3; yy < yR - 0.1; yy += 0.3)
            DD.box(-0.22, yy, l - 0.02, 0.22, yy + 0.025, l - 0.01, 0b111100);
    });
    void lz;
    Z.add(x, yR + r * 0.7 + 0.6, z, 0, 1, 0, "waterTower");
    for (let k = 0; k < 4; k++) {
        const a = ((k + 0.5) * Math.PI) / 2,
            rr = r * 0.88,
            yy = yR + ((r * 1.04 - rr) / (r * 1.04 - 0.15)) * r * 0.7;
        Z.add(
            x + Math.cos(a) * rr,
            yy,
            z + Math.sin(a) * rr,
            Math.cos(a),
            0,
            Math.sin(a),
            "waterTower",
        );
    }
}

export function createDetailMaterial(T) {
    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.75,
        metalness: 0.1,
    });
    const uni = {
        tNoise: { value: T.noise },
        tDetail: { value: T.detailNrm ?? null },
    };
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uni);
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nattribute float aPart; flat varying float vPart; varying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;",
            )
            .replace(
                "#include <fog_vertex>",
                "#include <fog_vertex>\nvPart = aPart; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vUv2 = uv;",
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      uniform sampler2D tNoise; ${T.detailNrm ? "uniform sampler2D tDetail;" : ""}
      flat varying float vPart; varying vec3 vWP; varying vec3 vWN; varying vec2 vUv2;
      float dR; float dM; vec3 dN;`,
            )
            .replace(
                "#include <color_fragment>",
                `#include <color_fragment>
      {
        int P = int(vPart + 0.5);
        vec3 N = normalize(vWN);
        vec2 tp = abs(N.y) > 0.6 ? vWP.xz : (abs(N.x) > abs(N.z) ? vWP.zy : vWP.xy);
        vec3 nz = texture(tNoise, tp / 7.0).rgb, nz2 = texture(tNoise, tp / 1.3).rgb;
        dR = 0.7; dM = 0.0; dN = vec3(0.0, 0.0, 1.0);
        float grime = smoothstep(0.35, 0.8, nz.r) * 0.35 + (1.0 - smoothstep(0.0, 0.6, fract(vWP.y) + nz2.g * 0.2)) * 0.0;
        if (P == 0) { dR = 0.45 + 0.3 * nz2.g; dM = 0.2; diffuseColor.rgb *= 1.0 - grime * 0.5;
          // rain streaks on painted sheet metal
          if (abs(N.y) < 0.5) diffuseColor.rgb *= 1.0 - 0.25 * smoothstep(0.55, 0.9, texture(tNoise, vec2(tp.x * 0.9, tp.y * 0.05)).g); }
        else if (P == 1) { // timber staves (vertical boards) weathered
          float st = fract(vUv2.x * 48.0);
          float seam = smoothstep(0.0, 0.06, st) * smoothstep(1.0, 0.94, st);
          float board = fract(sin(floor(vUv2.x * 48.0) * 91.7) * 4375.5);
          diffuseColor.rgb *= (0.75 + 0.35 * board) * mix(0.55, 1.0, seam) * (0.8 + 0.4 * nz2.b);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.88, 0.9, 0.88), smoothstep(0.4, 0.9, nz.g));
          dR = 0.85; dN = normalize(vec3((1.0 - seam) * sign(st - 0.5) * 0.6, 0.0, 1.0)); }
        else if (P == 2) { dR = 0.5 + 0.3 * nz2.r; dM = 0.7; diffuseColor.rgb *= mix(vec3(1.0), vec3(1.25, 0.92, 0.75), smoothstep(0.55, 0.85, nz2.g) * 0.5); }
        else if (P == 3) { dR = 0.06 + 0.25 * smoothstep(0.5, 0.9, nz2.g); dM = 0.0; diffuseColor.rgb = mix(vec3(0.02, 0.025, 0.03), vec3(0.2), smoothstep(0.6, 0.95, nz2.g) * 0.5); }
        else if (P == 4) { dR = 0.9; diffuseColor.rgb *= 0.9 + 0.2 * nz2.b; }
        else if (P == 5) { dR = 0.85; diffuseColor.rgb *= 0.9 + 0.15 * nz2.r; }
        else if (P == 6) { dR = 0.35 + 0.25 * nz2.g; dM = 0.85; }
        else if (P == 7) { dR = 0.8; diffuseColor.rgb *= 0.9 + 0.2 * nz2.b; diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.5, 0.9, nz.g); }
        else if (P == 8) { dR = 0.85; }
        else if (P == 10) { // thin steel (rails, masts, bracing): dithered fade 90-170 m (TAA resolves it; no sub-pixel crawl)
          dR = 0.5 + 0.3 * nz2.r; dM = 0.7;
          float fd = smoothstep(90.0, 170.0, length(cameraPosition - vWP));
          if (fd > 0.0 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < fd) discard;
        }
        else if (P == 9) { // steel bar grating (fire-escape decks): 3 mm bearing bars every 3 cm, cross rods every 10 cm
          dM = 0.6; dR = 0.55 + 0.25 * nz2.r; diffuseColor.rgb *= mix(vec3(1.0), vec3(1.2, 0.92, 0.75), smoothstep(0.55, 0.85, nz2.g) * 0.4);
          if (abs(N.y) > 0.6) {
            vec2 q = vWP.xz; vec2 fw = fwidth(q);
            vec2 pitch = vec2(0.03, 0.10);
            // bars along the longer deck axis: pick the axis with more variation of the part... use world x
            float bx = abs(fract(q.x / pitch.x) - 0.5) * pitch.x, bz = abs(fract(q.y / pitch.y) - 0.5) * pitch.y;
            float onBar = max(step(pitch.x * 0.5 - 0.004, bx), step(pitch.y * 0.5 - 0.004, bz));
            float fine = max(fw.x / pitch.x, fw.y / pitch.y);
            if (fine < 0.25) { if (onBar < 0.5) discard; }
            else { // (textures r4) critic: 'fire escapes are solid black slabs'. Past the bar resolution the deck stays
              // see-through: dithered coverage at the grating's true open fraction (~65 %), resolved by TAA
              float dth = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
              if (dth < 0.62 * (1.0 - smoothstep(1.5, 4.0, fine) * 0.4)) discard;
            }
          }
        }
        diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.85); // muted palette
      }`,
            )
            .replace(
                "#include <roughnessmap_fragment>",
                "float roughnessFactor = dR;",
            )
            .replace(
                "#include <metalnessmap_fragment>",
                "float metalnessFactor = dM;",
            )
            .replace(
                "#include <normal_fragment_maps>",
                `#include <normal_fragment_maps>
      { vec3 Nw = normalize(vWN); vec3 Tw = abs(Nw.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), Nw)); vec3 Bw = cross(Nw, Tw);
        vec3 nw = normalize(Tw * dN.x + Bw * dN.y + Nw * dN.z); if (dN.z < 0.999) normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz); }`,
            );
    };
    mat.customProgramCacheKey = () => "city-detail-v3";
    return mat;
}

function fountainRing(d, x, y, z, a, b, n) {
    const I = [],
        O = [];
    for (let k = 0; k <= n; k++) {
        const t = (k / n) * Math.PI * 2,
            c = Math.cos(t),
            s = Math.sin(t);
        I.push(d.vert(x + c * a, y, z + s * a, 0, 1, 0));
        O.push(d.vert(x + c * b, y, z + s * b, 0, 1, 0));
    }
    for (let k = 0; k < n; k++) {
        d.tri(I[k], I[k + 1], O[k + 1]);
        d.tri(I[k], O[k + 1], O[k]);
    }
}
function fountainWallIn(d, x, y0, y1, z, r, n) {
    const A = [],
        B = [];
    for (let k = 0; k <= n; k++) {
        const t = (k / n) * Math.PI * 2,
            c = Math.cos(t),
            s = Math.sin(t);
        A.push(d.vert(x + c * r, y0, z + s * r, -c, 0, -s));
        B.push(d.vert(x + c * r, y1, z + s * r, -c, 0, -s));
    }
    for (let k = 0; k < n; k++) d.quad(A[k], A[k + 1], B[k + 1], B[k]);
}

const FY = G.CURB_H;
const furn = {
    bench(d, S, x, z, alongX, back, y = FY) {
        const L = 0.95,
            W = 0.26;
        const [a0, a1, c0, c1] = alongX
            ? [x - L, x + L, z - W, z + W]
            : [x - W, x + W, z - L, z + L];
        d.setPart(DP.WOOD)
            .setColor(0x6a4c32)
            .box(a0, y + 0.4, c0, a1, y + 0.46, c1, 0b111111);
        const bk = alongX
            ? [
                  a0,
                  y + 0.46,
                  back > 0 ? c1 - 0.06 : c0,
                  a1,
                  y + 0.85,
                  back > 0 ? c1 : c0 + 0.06,
              ]
            : [
                  back > 0 ? a1 - 0.06 : a0,
                  y + 0.46,
                  c0,
                  back > 0 ? a1 : a0 + 0.06,
                  y + 0.85,
                  c1,
              ];
        d.box(...bk, 0b111111);
        d.setPart(DP.STEEL).setColor(0x2a2c2e);
        for (const s of [0.12, 0.88]) {
            const p = alongX ? a0 + (a1 - a0) * s : c0 + (c1 - c0) * s;
            if (alongX)
                d.box(
                    p - 0.03,
                    y,
                    c0 + 0.03,
                    p + 0.03,
                    y + 0.4,
                    c1 - 0.03,
                    0b110011,
                );
            else
                d.box(
                    a0 + 0.03,
                    y,
                    p - 0.03,
                    a1 - 0.03,
                    y + 0.4,
                    p + 0.03,
                    0b110011,
                );
        }
        S.box(a0, y, c0, a1, y + 0.46, c1, "equipment", NOZIP);
        S.box(...bk, "equipment", NOZIP);
    },
    bollard(d, S, x, z, y = FY) {
        d.setPart(DP.STEEL)
            .setColor(0x2b2d2f)
            .cyl(x, y, z, 0.12, 0.11, 0.9, 8, true);
        d.setPart(DP.GALV)
            .setColor(0x8a8d8f)
            .cyl(x, y + 0.9, z, 0.11, 0.02, 0.08, 8, true);
        S.cyl(
            x,
            z,
            y,
            y + 0.95,
            polyR(0.12, 8),
            polyR(0.11, 8),
            "equipment",
            NOZIP,
        );
    },
    planter(d, S, x0, z0, x1, z1, h, shrub, y = FY) {
        d.setPart(DP.CONC)
            .setColor(0x8a857c)
            .box(x0, y, z0, x1, y + h, z1, 0b110111);
        d.setColor(0x9a958b).box(
            x0 - 0.05,
            y + h,
            z0 - 0.05,
            x1 + 0.05,
            y + h + 0.06,
            z1 + 0.05,
            0b111111,
        );
        d.setPart(DP.CANVAS)
            .setColor(0x3a2f25)
            .box(
                x0 + 0.12,
                y + h + 0.06,
                z0 + 0.12,
                x1 - 0.12,
                y + h + 0.064,
                z1 - 0.12,
                0b000100,
            );
        if (shrub)
            d.setColor(shrub).box(
                x0 + 0.22,
                y + h + 0.06,
                z0 + 0.22,
                x1 - 0.22,
                y + h + 0.5,
                z1 - 0.22,
                0b111111,
            );
        S.box(
            x0 - 0.05,
            y,
            z0 - 0.05,
            x1 + 0.05,
            y + h + 0.06,
            z1 + 0.05,
            "equipment",
            NOZIP,
        );
    },
    lamp(d, S, x, z, y = FY) {
        d.setPart(DP.PAINT)
            .setColor(0x26302a)
            .cyl(x, y, z, 0.16, 0.16, 0.5, 8, true)
            .cyl(x, y + 0.5, z, 0.07, 0.06, 3.7, 6, false);
        d.cyl(x, y + 4.2, z, 0.22, 0.12, 0.15, 8, false);
        d.setPart(DP.GLASS)
            .setColor(0xe8dcb8)
            .cyl(x, y + 4.35, z, 0.2, 0.2, 0.45, 8, false);
        d.setPart(DP.PAINT)
            .setColor(0x26302a)
            .cyl(x, y + 4.8, z, 0.26, 0.04, 0.22, 8, true);
        S.cyl(x, z, y, y + 5.02, polyR(0.16, 8), polyR(0.12, 8), "pole", NOZIP);
    },
    kiosk(d, S, x, z, alongX, y = FY) {
        const kw = alongX ? 1.7 : 1.1,
            kd = alongX ? 1.1 : 1.7,
            kh = 2.55;
        d.setPart(DP.PAINT)
            .setColor(0x2c3d33)
            .box(x - kw, y, z - kd, x + kw, y + kh, z + kd, 0b110111);
        d.setPart(DP.GLASS).setColor(0x9fb3b8);
        if (alongX)
            d.box(
                x - kw + 0.2,
                y + 1.2,
                z + kd,
                x + kw - 0.2,
                y + 2.15,
                z + kd + 0.02,
                0b010000,
            );
        else
            d.box(
                x + kw,
                y + 1.2,
                z - kd + 0.2,
                x + kw + 0.02,
                y + 2.15,
                z + kd - 0.2,
                0b000001,
            );
        d.setPart(DP.CANVAS)
            .setColor(0x6b2f2c)
            .box(
                x - kw - 0.3,
                y + kh,
                z - kd - 0.3,
                x + kw + 0.3,
                y + kh + 0.16,
                z + kd + 0.3,
                0b111111,
            );
        d.setPart(DP.PAINT).setColor(0xc9b98a);
        if (alongX)
            d.box(
                x - kw + 0.3,
                y + 0.5,
                z + kd,
                x + kw - 0.3,
                y + 1.1,
                z + kd + 0.12,
                0b111111,
            );
        else
            d.box(
                x + kw,
                y + 0.5,
                z - kd + 0.3,
                x + kw + 0.12,
                y + 1.1,
                z + kd - 0.3,
                0b111111,
            );
        S.box(
            x - kw - 0.3,
            y,
            z - kd - 0.3,
            x + kw + 0.3,
            y + kh + 0.16,
            z + kd + 0.3,
            "equipment",
            NOZIP,
        );
    },
    bikeDock(d, S, x0, z0, alongX, n, y = FY) {
        const len = n * 0.85 + 1.4,
            x1 = alongX ? x0 + len : x0 + 0.5,
            z1 = alongX ? z0 + 0.5 : z0 + len;
        d.setPart(DP.STEEL)
            .setColor(0x4d5256)
            .box(x0, y, z0, x1, y + 0.06, z1, 0b110111);
        d.setPart(DP.PAINT)
            .setColor(0x2f5f86)
            .box(
                alongX ? x0 : x0 + 0.05,
                y,
                alongX ? z0 + 0.05 : z0,
                alongX ? x0 + 0.6 : x0 + 0.45,
                y + 1.9,
                alongX ? z0 + 0.45 : z0 + 0.6,
                0b110111,
            );
        for (let i = 0; i < n; i++) {
            const t = 1.2 + i * 0.85,
                px = alongX ? x0 + t : x0 + 0.25,
                pz = alongX ? z0 + 0.25 : z0 + t;
            d.setPart(DP.STEEL)
                .setColor(0x7c8388)
                .box(
                    px - 0.07,
                    y,
                    pz - 0.07,
                    px + 0.07,
                    y + 0.75,
                    pz + 0.07,
                    0b110111,
                );
            if ((i * 7 + Math.floor(x0 + z0)) % 5 === 3) continue;
            const bx0 = alongX ? px - 0.04 : px - 1.7,
                bx1 = alongX ? px + 0.04 : px - 0.1,
                bz0 = alongX ? pz - 1.7 : pz - 0.04,
                bz1 = alongX ? pz - 0.1 : pz + 0.04;
            const sx = alongX ? 0 : 1,
                sz = alongX ? 1 : 0;
            d.setPart(DP.STEEL).setColor(0x1d1f21);
            d.box(
                bx0 - 0.02 * sz,
                y,
                bz0 - 0.02 * sx,
                bx0 + (bx1 - bx0) * (sx ? 0.38 : 1) + 0.02 * sz,
                y + 0.66,
                bz0 + (bz1 - bz0) * (sz ? 0.38 : 1) + 0.02 * sx,
                0b111111,
            );
            d.box(
                bx0 + (bx1 - bx0) * (sx ? 0.62 : 0) - 0.02 * sz,
                y,
                bz0 + (bz1 - bz0) * (sz ? 0.62 : 0) - 0.02 * sx,
                bx1 + 0.02 * sz,
                y + 0.66,
                bz1 + 0.02 * sx,
                0b111111,
            );
            d.setPart(DP.PAINT)
                .setColor(0x3a6e97)
                .box(
                    bx0 + 0.01,
                    y + 0.6,
                    bz0 + 0.01,
                    bx1 - 0.01,
                    y + 0.72,
                    bz1 - 0.01,
                    0b111111,
                );
            d.setPart(DP.STEEL)
                .setColor(0x1d1f21)
                .box(
                    bx0 + (bx1 - bx0) * (sx ? 0.25 : 0) - 0.01,
                    y + 0.72,
                    bz0 + (bz1 - bz0) * (sz ? 0.25 : 0) - 0.01,
                    bx0 + (bx1 - bx0) * (sx ? 0.33 : 1) + 0.01,
                    y + 0.95,
                    bz0 + (bz1 - bz0) * (sz ? 0.33 : 1) + 0.01,
                    0b111111,
                );
        }
        S.box(
            alongX ? x0 : x0 - 1.7,
            y,
            alongX ? z0 - 1.7 : z0,
            x1,
            y + 0.95,
            z1,
            "equipment",
            NOZIP,
        );
        return alongX ? [x0, z0 - 1.75, x1, z1] : [x0 - 1.75, z0, x1, z1];
    },
};

function islandFurnish(gen, si, sx, sz, rr, blocks, h) {
    const S = gen.solids,
        { lotsAt, polysAt, asph, far, spots, D, sqParks } = h;
    const bld = (x, z) => {
        for (const l of lotsAt(x, z))
            if (
                x > l.x0 - 0.8 &&
                x < l.x1 + 0.8 &&
                z > l.z0 - 0.8 &&
                z < l.z1 + 0.8
            )
                return true;
        for (const P of polysAt(x, z)) if (inConvex(P, x, z)) return true;
        const t = streetsAt(x, z).type;
        return t === "block";
    };
    const walk = (x, z) => {
        const q = streetsAt(x, z);
        return q.type === "sidewalk" && !q.island && !q.fill;
    };
    const noB = (x, z, r) => {
        if (bld(x, z)) return false;
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            if (bld(x + Math.cos(a) * r, z + Math.sin(a) * r)) return false;
        }
        return true;
    };
    const dA = (x, z) => {
        for (const r of [0.9, 1.5, 2.2, 3, 4])
            for (let k = 0; k < 12; k++) {
                const a = (k / 12) * Math.PI * 2;
                if (asph(x + Math.cos(a) * r, z + Math.sin(a) * r)) return r;
            }
        return 5;
    };
    const allW = (x, z, r) => {
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            if (!walk(x + Math.cos(a) * r, z + Math.sin(a) * r)) return false;
        }
        return true;
    };
    const cand = [];
    for (let x = Math.round(sx - 80); x < sx + 80; x += 1.5)
        for (let z = Math.round(sz - 80); z < sz + 80; z += 1.5) {
            if (
                !walk(x, z) ||
                sqParks.some(
                    (o) =>
                        x > o.x0 - 2 &&
                        x < o.x1 + 2 &&
                        z > o.z0 - 2 &&
                        z < o.z1 + 2,
                )
            )
                continue;
            if (!noB(x, z, 3.5)) continue;
            cand.push([x, z, dA(x, z)]);
        }
    for (let i = cand.length - 1; i > 0; i--) {
        const j = Math.floor(rr() * (i + 1));
        [cand[i], cand[j]] = [cand[j], cand[i]];
    }
    let n = 0;
    const put = (x, z, r) => {
        spots.push({ x, z, r });
        n++;
    };
    {
        let best = null;
        for (const c of cand)
            if (
                c[2] >= 4 &&
                allW(c[0], c[1], 3) &&
                far(c[0], c[1], 3) &&
                (!best || rr() < 0.3)
            )
                best = c;
        if (best) {
            const [x, z] = best,
                ax = allW(x + 3.2, z, 0.5) && allW(x - 3.2, z, 0.5);
            furn.kiosk(D(x, z), S, x, z, ax);
            put(x, z, 3.2);
        }
    }
    {
        let done = false;
        for (const [x, z, a] of cand) {
            if (done || a < 2.2) continue;
            for (const ax of [true, false]) {
                const nd = 10 + Math.floor(rr() * 4),
                    len = nd * 0.85 + 1.4;
                let ok = true;
                for (let t = -0.3; t <= len + 0.3 && ok; t += 0.7)
                    for (const o of [0.3, -1.0, -2.0]) {
                        const px = ax ? x + t : x + o,
                            pz = ax ? z + o : z + t;
                        if (
                            !walk(px, pz) ||
                            bld(px, pz) ||
                            !far(px, pz, 0.8) ||
                            dA(px, pz) < 0.9
                        ) {
                            ok = false;
                            break;
                        }
                    }
                if (!ok) continue;
                furn.bikeDock(D(x, z), S, x, z, ax, nd);
                for (let t = 0; t <= len; t += 1.5)
                    put(ax ? x + t : x - 0.7, ax ? z - 0.7 : z + t, 1.3);
                done = true;
                break;
            }
        }
    }
    let nb = 0,
        np = 0,
        nl = 0,
        nbo = 0;
    for (const [x, z, a] of cand) {
        if (nb >= 6) break;
        if (a < 2.2 || !far(x, z, 1.5) || !allW(x, z, 1.4)) continue;
        const ax =
            walk(x + 2.2, z) && walk(x - 2.2, z)
                ? true
                : walk(x, z + 2.2) && walk(x, z - 2.2)
                  ? false
                  : null;
        if (ax === null) continue;
        const back = ax
            ? dA(x, z + 1.6) < dA(x, z - 1.6)
                ? 1
                : -1
            : dA(x + 1.6, z) < dA(x - 1.6, z)
              ? 1
              : -1;
        furn.bench(D(x, z), S, x, z, ax, back);
        put(x, z, 1.5);
        nb++;
    }
    const SHR = [0x3e4b2c, 0x4a5230, 0x36452c];
    for (const [x, z, a] of cand) {
        if (np >= 5) break;
        if (a < 2.2 || !far(x, z, 1.9) || !allW(x, z, 1.8)) continue;
        const ax = rr() < 0.5,
            hw = ax ? 1.4 : 0.7,
            hd = ax ? 0.7 : 1.4;
        furn.planter(
            D(x, z),
            S,
            x - hw,
            z - hd,
            x + hw,
            z + hd,
            0.55,
            rr() < 0.55 ? SHR[np % 3] : 0,
        );
        if (rr() < 0.4)
            (gen.openTrees ??= []).push({
                x,
                z,
                kind: "small",
                clear: 2.2,
                y: FY + 0.61,
                sc: 0.55 + rr() * 0.2,
            });
        put(x, z, 2.0);
        np++;
    }
    for (const [x, z, a] of cand) {
        if (nl >= 3) break;
        if (
            a < 1.5 ||
            !far(x, z, 1.2) ||
            spots.some((s) => s.lamp && Math.hypot(s.x - x, s.z - z) < 14)
        )
            continue;
        furn.lamp(D(x, z), S, x, z);
        spots.push({ x, z, r: 1.2, lamp: true });
        n++;
        nl++;
    }

    const bc = [];
    for (let x = Math.round(sx - 80); x < sx + 80; x += 0.8)
        for (let z = Math.round(sz - 80); z < sz + 80; z += 0.8) {
            if (!walk(x, z) || dA(x, z) !== 1.5 || !noB(x, z, 3.5)) continue;
            bc.push([x, z]);
        }
    for (const [x, z] of bc) {
        if (nbo >= 40) break;
        if (!far(x, z, 0.8)) continue;
        furn.bollard(D(x, z), S, x, z);
        spots.push({ x, z, r: 0.8 });
        n++;
        nbo++;
    }
    return n;
}

function furnishRefuges(gen) {
    const S = gen.solids,
        D = (x, z) => gen.tile(x, z).det;
    let n = 0;
    const SHR = [0x3e4b2c, 0x4a5230, 0x36452c];
    for (const I of islands()) {
        if (I.kind !== "refuge") continue;
        const P = I.poly,
            [ux, uz] = I.axis,
            vx = -uz,
            vz = ux;
        const [cx, cz] = centroid(P);
        let t0 = 1e9,
            t1 = -1e9,
            w0 = 1e9,
            w1 = -1e9;
        for (const [x, z] of P) {
            const t = (x - cx) * ux + (z - cz) * uz,
                w = (x - cx) * vx + (z - cz) * vz;
            t0 = Math.min(t0, t);
            t1 = Math.max(t1, t);
            w0 = Math.min(w0, w);
            w1 = Math.max(w1, w);
        }
        const wc = (w0 + w1) / 2,
            at = (t, w) => [cx + ux * t + vx * w, cz + uz * t + vz * w];
        const inside = (x, z, m) =>
            inConvex(P, x, z) &&
            [
                [m, 0],
                [-m, 0],
                [0, m],
                [0, -m],
            ].every(([a, b]) => inConvex(P, x + a, z + b));
        for (const [tn, sg] of [
            [t0, 1],
            [t1, -1],
        ]) {
            const wid = I.wid,
                offs = wid >= 2.8 ? [-0.75, 0, 0.75] : [0];
            for (const o of offs) {
                const [x, z] = at(
                    tn + sg * (Math.abs(o) > 0 ? 1.25 : 0.75),
                    wc + o,
                );
                if (inside(x, z, 0.3)) {
                    furn.bollard(D(x, z), S, x, z);
                    n++;
                }
            }
        }
        const h = hash2(Math.round(cx * 3), Math.round(cz * 3));
        if (!I.trees.length && t1 - t0 >= 7 && I.wid >= 2.3) {
            const L = Math.min(t1 - t0 - 4.2, 6),
                W = Math.min(I.wid - 1.3, 1.5),
                [x, z] = at((t0 + t1) / 2, wc);
            const ax = Math.abs(ux) >= Math.abs(uz),
                hx = ax ? L / 2 : W / 2,
                hz = ax ? W / 2 : L / 2;
            if (
                [
                    [-hx, -hz],
                    [hx, -hz],
                    [hx, hz],
                    [-hx, hz],
                ].every(([a, b]) => inside(x + a, z + b, 0.35))
            ) {
                furn.planter(
                    D(x, z),
                    S,
                    x - hx,
                    z - hz,
                    x + hx,
                    z + hz,
                    0.5,
                    SHR[Math.floor(h * 3)],
                );
                n++;
            }
        }
    }
    return n;
}

function insetConvex(P, d) {
    const [cx, cz] = centroid(P),
        n = P.length,
        L = [];
    for (let i = 0; i < n; i++) {
        const [ax, az] = P[i],
            [bx, bz] = P[(i + 1) % n],
            l = Math.hypot(bx - ax, bz - az);
        let nx = -(bz - az) / l,
            nz = (bx - ax) / l;
        if (nx * (cx - ax) + nz * (cz - az) < 0) {
            nx = -nx;
            nz = -nz;
        }
        L.push([ax + nx * d, az + nz * d, (bx - ax) / l, (bz - az) / l]);
    }
    const out = [];
    for (let i = 0; i < n; i++) {
        const [px, pz, ux, uz] = L[(i + n - 1) % n],
            [qx, qz, vx, vz] = L[i],
            den = ux * vz - uz * vx;
        if (Math.abs(den) < 1e-9) {
            out.push([qx, qz]);
            continue;
        }
        const t = ((qx - px) * vz - (qz - pz) * vx) / den;
        out.push([px + ux * t, pz + uz * t]);
    }
    return out;
}

function furnishMapParks(gen) {
    const S = gen.solids,
        Y = G.CURB_H + 0.02,
        D = (x, z) => gen.tile(x, z).det,
        rr = mulberry32(8123);
    const lawns = (gen.mapLawns = []);
    let n = 0;
    for (const c of MAPS.flatMap((M) => M.cells)) {
        if (!c.park || !c.prop) continue;
        const P = c.prop,
            A = polyArea(P),
            big = A > 5000,
            w = big ? 6 : 4.2,
            In = insetConvex(P, w);
        lawns.push({ outer: P, inner: In });
        const [cx, cz] = centroid(In);
        const tone = (k) => {
            const v =
                0.94 +
                0.1 * ((((Math.sin(k * 12.9898) * 43758.5453) % 1) + 1) % 1);
            return [0.19 * v, 0.18 * v, 0.165 * v];
        };
        const Oc = c.curb.length === P.length ? insetConvex(c.curb, 0.3) : P;

        for (let i = 0; i < P.length; i++) {
            const j = (i + 1) % P.length,
                a = P[i],
                b = P[j],
                ai = In[i],
                bi = In[j];
            const quad = (Q, col, y) => {
                const d = D((Q[0][0] + Q[2][0]) / 2, (Q[0][1] + Q[2][1]) / 2)
                    .setPart(DP.CONC)
                    .setColor(col);
                let sa = 0;
                for (let k = 0; k < 4; k++) {
                    const p = Q[k],
                        q = Q[(k + 1) % 4];
                    sa += p[0] * q[1] - q[0] * p[1];
                }
                const R = sa > 0 ? Q.slice().reverse() : Q,
                    vi = R.map(([x, z]) =>
                        d.vert(x, y, z, 0, 1, 0, x / 1.5, z / 1.5),
                    );
                d.tri(vi[0], vi[1], vi[2]);
                d.tri(vi[0], vi[2], vi[3]);
            };
            quad([a, b, bi, ai], tone(i), Y + 0.01);
            quad([Oc[i], Oc[j], b, a], tone(i + 7), G.CURB_H + 0.012);
            const k0 = insetConvex(P, w - 0.5);
            quad([k0[i], k0[j], bi, ai], [0.1, 0.095, 0.09], Y + 0.014);

            const L = Math.hypot(bi[0] - ai[0], bi[1] - ai[1]),
                ux = (bi[0] - ai[0]) / L,
                uz = (bi[1] - ai[1]) / L;
            const d = D((ai[0] + bi[0]) / 2, (ai[1] + bi[1]) / 2);
            const fh = 1.05,
                ang = Math.atan2(-uz, ux),
                m = new THREE.Matrix4()
                    .makeRotationY(ang)
                    .setPosition(ai[0], 0, ai[1]);
            d.setPart(DP.STEEL)
                .setColor(0x1c1e1f)
                .with(m, (q) => {
                    q.box(
                        0,
                        Y + fh - 0.05,
                        -0.03,
                        L,
                        Y + fh,
                        0.03,
                        0b111111,
                    ).box(0, Y + 0.12, -0.02, L, Y + 0.16, 0.02, 0b111111);
                    for (let t = 0; t <= L; t += 0.14)
                        q.box(
                            t - 0.012,
                            Y,
                            -0.012,
                            t + 0.012,
                            Y + fh,
                            0.012,
                            0b110011,
                        );
                    for (let t = 0; t <= L; t += 2.4)
                        q.box(
                            t - 0.05,
                            Y,
                            -0.05,
                            t + 0.05,
                            Y + fh + 0.12,
                            0.05,
                            0b110111,
                        );
                });
            const nx = -uz * 0.04,
                nz = ux * 0.04;
            polySolids(
                S,
                [
                    [ai[0] + nx, ai[1] + nz],
                    [bi[0] + nx, bi[1] + nz],
                    [bi[0] - nx, bi[1] - nz],
                    [ai[0] - nx, ai[1] - nz],
                ],
                Y,
                Y + fh,
                "equipment",
            );

            const on = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const ax = Math.abs(ux) > 0.97,
                az = Math.abs(uz) > 0.97;
            const [ccx, ccz] = centroid(P);
            let ox = uz,
                oz = -ux;
            if (ox * (ccx - ai[0]) + oz * (ccz - ai[1]) > 0) {
                ox = -ox;
                oz = -oz;
            }
            for (let t = 4; t < L - 4; t += 7 + rr() * 2) {
                const x = ai[0] + ux * t + ox * 1.4,
                    z = ai[1] + uz * t + oz * 1.4;
                if (ax || az) {
                    furn.bench(
                        D(x, z),
                        S,
                        x,
                        z,
                        ax,
                        ax ? Math.sign(oz) : Math.sign(ox),
                    );
                    n++;
                    continue;
                }
                const bm = new THREE.Matrix4()
                        .makeRotationY(ang)
                        .setPosition(x, 0, z),
                    dd = D(x, z);
                dd.setPart(DP.WOOD)
                    .setColor(0x6a4c32)
                    .with(bm, (q) =>
                        q.box(
                            -0.95,
                            Y + 0.4,
                            -0.26,
                            0.95,
                            Y + 0.46,
                            0.26,
                            0b111111,
                        ),
                    );
                const s = Math.sign(-uz * ox + ux * oz) || 1;
                dd.with(bm, (q) =>
                    q.box(
                        -0.95,
                        Y + 0.46,
                        s > 0 ? 0.2 : -0.26,
                        0.95,
                        Y + 0.85,
                        s > 0 ? 0.26 : -0.2,
                        0b111111,
                    ),
                );
                dd.setPart(DP.STEEL)
                    .setColor(0x2a2c2e)
                    .with(bm, (q) => {
                        q.box(-0.8, Y, -0.22, -0.74, Y + 0.4, 0.22, 0b110011);
                        q.box(0.74, Y, -0.22, 0.8, Y + 0.4, 0.22, 0b110011);
                    });
                const cs = Math.cos(ang),
                    sn = Math.sin(ang),
                    F = [
                        [-0.95, -0.26],
                        [0.95, -0.26],
                        [0.95, 0.26],
                        [-0.95, 0.26],
                    ].map(([u, v]) => [
                        x + u * cs + v * sn,
                        z - u * sn + v * cs,
                    ]);
                polySolids(S, F, Y, Y + 0.46, "equipment");
                n++;
            }
            void on;
        }

        for (let i = 0; i < P.length; i++) {
            const a = P[i],
                ai = In[i],
                mx = a[0] * 0.45 + ai[0] * 0.55,
                mz = a[1] * 0.45 + ai[1] * 0.55;
            furn.lamp(D(mx, mz), S, mx, mz, Y);
            n++;
            const pv = P[(i + P.length - 1) % P.length],
                nx2 = P[(i + 1) % P.length];
            for (const q of [pv, nx2]) {
                const l = Math.hypot(q[0] - a[0], q[1] - a[1]);
                if (l < 8) continue;
                for (let t = 1.2; t < 5; t += 1.6) {
                    const bx = a[0] + ((q[0] - a[0]) / l) * t,
                        bz = a[1] + ((q[1] - a[1]) / l) * t;
                    const [kx, kz] = centroid(P),
                        kl = Math.hypot(kx - bx, kz - bz);
                    const ex = bx + ((kx - bx) / kl) * 0.5,
                        ez = bz + ((kz - bz) / kl) * 0.5;
                    furn.bollard(D(ex, ez), S, ex, ez, Y);
                    n++;
                }
            }
        }

        const R = big ? 7 : 2.4,
            d = D(cx, cz);
        d.setPart(DP.CONC)
            .setColor(0x7a766e)
            .cyl(cx, Y, cz, R, R, 0.55, 32, false);
        d.setColor(0xa29c90).cyl(
            cx,
            Y + 0.55,
            cz,
            R + 0.15,
            R + 0.15,
            0.06,
            32,
            false,
        );
        fountainRing(d, cx, Y + 0.61, cz, R - 0.3, R + 0.15, 32);
        d.setPart(DP.PAINT)
            .setColor(0x5a6668)
            .cyl(cx, Y + 0.42, cz, R - 0.3, R - 0.3, 0.01, 32, true);
        d.setColor(0xc9d1d3)
            .cyl(cx, Y + 0.43, cz, R * 0.35, R * 0.35, 0.005, 20, true)
            .cyl(cx, Y + 0.43, cz, 0.25, 0.05, big ? 3 : 1.6, 8, true);
        fountainWallIn(d, cx, Y + 0.43, Y + 0.61, cz, R - 0.3, 32);
        S.cyl(
            cx,
            cz,
            Y,
            Y + 0.61,
            polyR(R + 0.15, 32),
            polyR(R + 0.15, 32),
            "equipment",
            NOZIP,
        );
        lawns[lawns.length - 1].fountain = { x: cx, z: cz, r: R + 0.4 };
        if (big) {
            const RP = R + 6,
                NS = 48,
                PV = [];
            for (let k = 0; k < NS; k++) {
                const a = (k / NS) * Math.PI * 2;
                PV.push([cx + Math.cos(a) * RP, cz + Math.sin(a) * RP]);
            }
            fountainRing(
                D(cx, cz).setPart(DP.CONC).setColor([0.2, 0.19, 0.175]),
                cx,
                Y + 0.012,
                cz,
                R + 0.1,
                RP,
                NS,
            );
            for (let i = 0; i < In.length; i++) {
                const [px, pz] = In[i],
                    L = Math.hypot(cx - px, cz - pz),
                    ux = (cx - px) / L,
                    uz = (cz - pz) / L,
                    wv = 1.8;
                const Q = [
                    [px - uz * wv, pz + ux * wv],
                    [cx - ux * RP - uz * wv, cz - uz * RP + ux * wv],
                    [cx - ux * RP + uz * wv, cz - uz * RP - ux * wv],
                    [px + uz * wv, pz - ux * wv],
                ];
                const dq = D((px + cx) / 2, (pz + cz) / 2)
                    .setPart(DP.CONC)
                    .setColor([0.22, 0.2, 0.17]);
                let sa = 0;
                for (let k = 0; k < 4; k++) {
                    const p = Q[k],
                        q = Q[(k + 1) % 4];
                    sa += p[0] * q[1] - q[0] * p[1];
                }
                const R2 = sa > 0 ? Q.slice().reverse() : Q,
                    vi = R2.map(([x, z]) =>
                        dq.vert(x, Y + 0.011, z, 0, 1, 0, x / 1.5, z / 1.5),
                    );
                dq.tri(vi[0], vi[1], vi[2]);
                dq.tri(vi[0], vi[2], vi[3]);
                (lawns[lawns.length - 1].walks ??= []).push({
                    ax: px,
                    az: pz,
                    bx: cx,
                    bz: cz,
                    w: wv + 1.2,
                });
            }
            lawns[lawns.length - 1].fountain.r = RP + 1;
        }
        n++;
    }
    return n;
}
export function dressSquares(gen, blocks) {
    const S = gen.solids,
        Y = G.CURB_H,
        spots = (gen.squareSpots = []);
    const lots0 = gen.buildings.map((b) => b.lot).filter(Boolean),
        polys0 = (gen.polyBuildings ?? []).map((p) => p.poly);

    const near = (x0, x1, z0, z1) =>
        DIAG_SQUARES.some(
            ([sx, sz]) =>
                x1 > sx - 100 &&
                x0 < sx + 100 &&
                z1 > sz - 100 &&
                z0 < sz + 100,
        );
    const LB = new Map(),
        PB = new Map(),
        bk = (i, j) => i * 65536 + j;
    const idx = (M, o, x0, x1, z0, z1) => {
        for (let i = Math.floor(x0 / 32); i <= Math.floor(x1 / 32); i++)
            for (let j = Math.floor(z0 / 32); j <= Math.floor(z1 / 32); j++) {
                const k = bk(i, j);
                let a = M.get(k);
                if (!a) M.set(k, (a = []));
                a.push(o);
            }
    };
    for (const l of lots0)
        if (near(l.x0, l.x1, l.z0, l.z1))
            idx(LB, l, l.x0 - 1, l.x1 + 1, l.z0 - 1, l.z1 + 1);
    for (const P of polys0) {
        const xs = P.map((p) => p[0]),
            zs = P.map((p) => p[1]);
        if (
            near(
                Math.min(...xs),
                Math.max(...xs),
                Math.min(...zs),
                Math.max(...zs),
            )
        )
            idx(
                PB,
                P,
                Math.min(...xs),
                Math.max(...xs),
                Math.min(...zs),
                Math.max(...zs),
            );
    }
    const EMPTY = [],
        lotsAt = (x, z) =>
            LB.get(bk(Math.floor(x / 32), Math.floor(z / 32))) ?? EMPTY,
        polysAt = (x, z) =>
            PB.get(bk(Math.floor(x / 32), Math.floor(z / 32))) ?? EMPTY;
    const free = (x, z) => {
        if (streetsAt(x, z).type !== "block") return false;
        for (const l of lotsAt(x, z))
            if (
                x > l.x0 - 0.8 &&
                x < l.x1 + 0.8 &&
                z > l.z0 - 0.8 &&
                z < l.z1 + 0.8
            )
                return false;
        for (const P of polysAt(x, z)) if (inConvex(P, x, z)) return false;
        return true;
    };
    const clear = (x, z, r) => {
        if (!free(x, z)) return false;
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            if (!free(x + Math.cos(a) * r, z + Math.sin(a) * r)) return false;
        }
        return true;
    };
    const far = (x, z, r) =>
        spots.every((s) => Math.hypot(s.x - x, s.z - z) >= s.r + r);
    const inSqPark = (x, z) =>
        (gen.openSpaces ?? []).some(
            (o) =>
                o.kind === "square" &&
                x > o.x0 - 1 &&
                x < o.x1 + 1 &&
                z > o.z0 - 1 &&
                z < o.z1 + 1,
        );
    let nT = 0,
        nP = 0,
        nG = 0,
        nF = 0,
        nPv = 0,
        nSc = 0,
        nK = 0,
        nB = 0,
        nBo = 0,
        nIs = 0;
    DIAG_SQUARES.forEach(([sx, sz], si) => {
        const rr = mulberry32(7717 + si * 131);
        const cand = [];
        for (const b of blocks) {
            if (
                !b.diag?.length ||
                b.x1 < sx - 95 ||
                b.x0 > sx + 95 ||
                b.z1 < sz - 95 ||
                b.z0 > sz + 95
            )
                continue;
            for (let x = b.px0 + 0.75; x < b.px1; x += 1.5)
                for (let z = b.pz0 + 0.75; z < b.pz1; z += 1.5)
                    if (
                        Math.hypot(x - sx, z - sz) < 95 &&
                        free(x, z) &&
                        !inSqPark(x, z)
                    )
                        cand.push([x, z]);
        }
        if (!cand.length) return;
        const D = (x, z) => gen.tile(x, z).det;
        const lincoln = Math.hypot(sx + 430, sz + 880) < 1;
        let focal = null;
        if (lincoln) {
            let best = null,
                br = 0;
            for (const [x, z] of cand) {
                let r = 0;
                for (const t of [4, 6, 8, 10]) {
                    if (clear(x, z, t)) r = t;
                    else break;
                }
                if (r > br) {
                    br = r;
                    best = [x, z];
                }
            }
            if (best && br >= 4) {
                const [x, z] = best,
                    R = br - 0.6,
                    d = D(x, z);

                const Ro = R + 0.12,
                    Ri = R - 0.3,
                    Yw = Y + 0.64,
                    Yt = Y + 0.72,
                    NS = 40;
                d.setPart(DP.CONC)
                    .setColor(0x6f6b64)
                    .cyl(x, Y, z, Ro, Ro, 0.72, NS, false);
                d.setColor(0xa29c90);
                fountainRing(d, x, Yt, z, Ri, Ro, NS);
                d.setColor(0x625e57);
                fountainWallIn(d, x, Yw, Yt, z, Ri, NS);
                d.setPart(DP.PAINT)
                    .setColor(0x4a575b)
                    .cyl(x, Yw - 0.02, z, Ri, Ri, 0.02, NS, true);
                d.setColor(0xa3adaf).cyl(
                    x,
                    Yw,
                    z,
                    R * 0.58,
                    R * 0.58,
                    0.006,
                    28,
                    true,
                );
                S.cyl(
                    x,
                    z,
                    Y,
                    Yw,
                    polyR(Ro, NS),
                    polyR(Ro, NS),
                    "equipment",
                    NOZIP,
                );
                for (let i = 0; i < 48; i++) {
                    const a = (i / 48) * Math.PI * 2,
                        rc = (Ri + Ro) / 2;
                    S.cyl(
                        x + Math.cos(a) * rc,
                        z + Math.sin(a) * rc,
                        Yw,
                        Yt,
                        0.21,
                        0.21,
                        "equipment",
                        NOZIP,
                    );
                }
                S.cyl(
                    x,
                    z,
                    Yw,
                    Y + 1.05,
                    polyR(1.2, 20),
                    polyR(1.1, 20),
                    "equipment",
                    NOZIP,
                );
                d.setPart(DP.CONC)
                    .setColor(0x8a847a)
                    .cyl(x, Yw, z, 1.2, 1.1, Y + 1.05 - Yw, 20, true);
                d.setPart(DP.PAINT)
                    .setColor(0xdfe5e7)
                    .cyl(x, Y + 1.05, z, 1.05, 1.05, 0.02, 20, true);
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * Math.PI * 2,
                        rx = x + Math.cos(a) * R * 0.62,
                        rz = z + Math.sin(a) * R * 0.62;
                    d.cyl(rx, Yw, rz, 0.13, 0.04, 2.2, 6, true);
                    d.cyl(rx, Yw, rz, 0.45, 0.45, 0.01, 8, true);
                }
                for (let i = 0; i < 8; i++) {
                    const a = ((i + 0.5) / 8) * Math.PI * 2;
                    d.cyl(
                        x + Math.cos(a) * 0.75,
                        Y + 1.05,
                        z + Math.sin(a) * 0.75,
                        0.1,
                        0.03,
                        2.8,
                        6,
                        true,
                    );
                }
                d.cyl(x, Y + 1.05, z, 0.55, 0.3, 2.2, 10, false)
                    .cyl(x, Y + 3.25, z, 0.3, 0.14, 2.6, 8, false)
                    .cyl(x, Y + 5.85, z, 0.14, 0.02, 1.6, 6, true);
                focal = { x, z, r: Ro };
                spots.push({ x, z, r: R + 1.5 });
                nF++;
            }

            const bpal = [
                [
                    [0.2, 0.24, 0.08],
                    [0.12, 0.16, 0.05],
                ],
                [
                    [0.24, 0.26, 0.08],
                    [0.14, 0.17, 0.05],
                ],
            ].map((p) => p.map((c) => c.map((v) => v * 1.2)));
            for (let bx0 = -476; bx0 <= -450; bx0 += 5.2)
                for (let bz0 = -840; bz0 <= -814; bz0 += 5.2) {
                    const h1 =
                            Math.abs(
                                Math.sin(bx0 * 12.99 + bz0 * 78.23) * 43758.55,
                            ) % 1,
                        h2 = (h1 * 17.31) % 1,
                        h3 = (h1 * 91.7) % 1;
                    if (h3 < 0.24) continue;
                    const bx = bx0 + (h1 - 0.5) * 2.4,
                        bz = bz0 + (h2 - 0.5) * 2.4;
                    if (!clear(bx, bz, 1.6) || !far(bx, bz, 2)) continue;
                    const d = D(bx, bz);
                    d.setPart(DP.CONC)
                        .setColor(0x8e897f)
                        .cyl(bx, Y, bz, 0.9, 0.9, 0.35, 12, true);
                    d.setPart(DP.CANVAS)
                        .setColor(0x3a3027)
                        .cyl(bx, Y + 0.35, bz, 0.8, 0.8, 0.004, 12, true);
                    S.cyl(
                        bx,
                        bz,
                        Y,
                        Y + 0.35,
                        polyR(0.9, 12),
                        polyR(0.9, 12),
                        "equipment",
                        NOZIP,
                    );
                    (gen.openTrees ??= []).push({
                        x: bx,
                        z: bz,
                        kind: "street",
                        clear: 3.2,
                        y: Y + 0.35,
                        sc: 0.6 + 0.45 * ((h1 + h2) / 2),
                        pal: bpal,
                    });
                    spots.push({ x: bx, z: bz, r: 2.2 });
                }
        }
        const shuffle = (A) => {
            for (let i = A.length - 1; i > 0; i--) {
                const j = Math.floor(rr() * (i + 1));
                [A[i], A[j]] = [A[j], A[i]];
            }
            return A;
        };
        shuffle(cand);

        {
            let best = null,
                br = 0;
            for (const [x, z] of cand) {
                if (!far(x, z, 3.5)) continue;
                let r = 0;
                for (const t of [2.6, 3.5, 5, 7]) {
                    if (clear(x, z, t)) r = t;
                    else break;
                }
                if (r > br) {
                    br = r;
                    best = [x, z];
                }
            }
            if (best) {
                const [x, z] = best,
                    d = D(x, z),
                    pl = 1.5,
                    ph = 0.75;
                if (!focal) focal = { x, z, r: 2.2 };
                d.setPart(DP.CONC)
                    .setColor(0x8d887f)
                    .box(x - pl, Y, z - pl, x + pl, Y + ph, z + pl, 0b110111);
                S.box(
                    x - pl,
                    Y,
                    z - pl,
                    x + pl,
                    Y + ph,
                    z + pl,
                    "equipment",
                    NOZIP,
                );
                let y = Y + ph;
                for (const [s, a] of [
                    [2.0, 0.35 + rr() * 0.3],
                    [1.35, 0.95 + rr() * 0.4],
                    [0.8, 0.2 + rr() * 0.5],
                ]) {
                    const c = Math.cos(a),
                        sn = Math.sin(a),
                        h = s / 2;
                    const m = new THREE.Matrix4()
                        .makeRotationY(a)
                        .setPosition(x, 0, z);
                    d.setPart(DP.STEEL)
                        .setColor(0x6a3b24)
                        .with(m, (q) =>
                            q.box(-h, y, -h, h, y + s, h, 0b110111),
                        );
                    const P = [
                        [-h, -h],
                        [h, -h],
                        [h, h],
                        [-h, h],
                    ].map(([u, v]) => [x + u * c + v * sn, z - u * sn + v * c]);
                    polySolids(S, P, y, y + s, "equipment");
                    y += s;
                }
                spots.push({ x, z, r: 3.2 });
                nSc++;
            }
        }
        let kiosks = 0;
        for (const [x, z] of cand) {
            if (kiosks >= 1) break;
            if (!clear(x, z, 2.4) || !far(x, z, 3.2)) continue;
            const d = D(x, z),
                kw = 1.6,
                kd = 1.1,
                kh = 2.6;
            d.setPart(DP.PAINT)
                .setColor(0x243a2e)
                .box(x - kw, Y, z - kd, x + kw, Y + kh, z + kd, 0b110111);
            d.setPart(DP.GLASS)
                .setColor(0x9fb3b8)
                .box(
                    x - kw + 0.2,
                    Y + 1.15,
                    z + kd,
                    x + kw - 0.2,
                    Y + 2.1,
                    z + kd + 0.02,
                    0b010000,
                );
            d.setPart(DP.STEEL)
                .setColor(0x6f7274)
                .box(
                    x - kw - 0.1,
                    Y + 1.05,
                    z + kd,
                    x + kw + 0.1,
                    Y + 1.12,
                    z + kd + 0.45,
                    0b110111,
                );
            d.setPart(DP.CANVAS)
                .setColor(0x7a2a24)
                .box(
                    x - kw - 0.25,
                    Y + kh,
                    z - kd - 0.25,
                    x + kw + 0.25,
                    Y + kh + 0.18,
                    z + kd + 0.9,
                    0b111111,
                );
            d.setPart(DP.PAINT)
                .setColor(0xd8cfb4)
                .box(
                    x - 0.9,
                    Y + kh + 0.18,
                    z - 0.3,
                    x + 0.9,
                    Y + kh + 0.75,
                    z + 0.3,
                    0b110111,
                );
            S.box(
                x - kw,
                Y,
                z - kd,
                x + kw,
                Y + kh,
                z + kd,
                "equipment",
                NOZIP,
            );
            S.box(
                x - kw - 0.25,
                Y + kh,
                z - kd - 0.25,
                x + kw + 0.25,
                Y + kh + 0.18,
                z + kd + 0.9,
                "equipment",
                NOZIP,
            );
            spots.push({ x, z, r: 3.2 });
            kiosks++;
            nK++;
        }
        const UMB = [0x3d4a3a, 0x6b2f2c, 0xb8ab8c, 0x2f3a4c, 0x7a6a4a];
        let tables = 0,
            planters = 0,
            blocksN = 0;
        for (const [x, z] of cand) {
            if (tables >= 12) break;
            if (!clear(x, z, 1.9) || !far(x, z, 1.9)) continue;
            const d = D(x, z),
                uc = UMB[Math.floor(rr() * UMB.length)];
            d.setPart(DP.STEEL)
                .setColor(0x2b2d2f)
                .cyl(x, Y, z, 0.05, 0.05, 0.72, 6, false);
            d.cyl(x, Y + 0.72, z, 0.42, 0.42, 0.03, 12, true);
            for (let k = 0; k < 3; k++) {
                const a = (k / 3 + rr() * 0.1) * Math.PI * 2,
                    cx = x + Math.cos(a) * 0.85,
                    cz = z + Math.sin(a) * 0.85;
                d.box(
                    cx - 0.2,
                    Y + 0.42,
                    cz - 0.2,
                    cx + 0.2,
                    Y + 0.46,
                    cz + 0.2,
                    0b111111,
                ).box(
                    cx - 0.03,
                    Y,
                    cz - 0.03,
                    cx + 0.03,
                    Y + 0.42,
                    cz + 0.03,
                    0b110011,
                );
            }
            if (rr() < 0.8) {
                d.cyl(x, Y + 0.75, z, 0.03, 0.03, 1.55, 5, false);
                d.setPart(DP.CANVAS)
                    .setColor(uc)
                    .cyl(x, Y + 2.05, z, 1.35, 0.06, 0.42, 8, true);
            }
            S.cyl(
                x,
                z,
                Y,
                Y + 0.75,
                polyR(0.42, 12),
                polyR(0.42, 12),
                "equipment",
                NOZIP,
            );
            spots.push({ x, z, r: 1.9 });
            tables++;
            nT++;
        }
        for (const [x, z] of cand) {
            if (planters >= 8) break;
            if (!clear(x, z, 1.6) || !far(x, z, 1.6)) continue;
            const d = D(x, z),
                h = 0.6;
            d.setPart(DP.CONC)
                .setColor(0x8a857c)
                .box(x - 0.9, Y, z - 0.9, x + 0.9, Y + h, z + 0.9, 0b110111);
            d.setPart(DP.CANVAS)
                .setColor(0x3c4a2c)
                .box(
                    x - 0.78,
                    Y + h,
                    z - 0.78,
                    x + 0.78,
                    Y + h + 0.004,
                    z + 0.78,
                    0b000100,
                );
            S.box(
                x - 0.9,
                Y,
                z - 0.9,
                x + 0.9,
                Y + h,
                z + 0.9,
                "equipment",
                NOZIP,
            );
            (gen.openTrees ??= []).push({
                x,
                z,
                kind: "small",
                clear: 2.5,
                y: Y + h,
                sc: 0.7 + rr() * 0.25,
            });
            spots.push({ x, z, r: 2.4 });
            planters++;
            nP++;
        }
        for (const [x, z] of cand) {
            if (blocksN >= 14) break;
            if (!clear(x, z, 0.6) || clear(x, z, 2.2) || !far(x, z, 0.9))
                continue;
            const d = D(x, z),
                s = 0.45,
                h = 0.5;
            d.setPart(DP.CONC)
                .setColor(0xa29d93)
                .box(x - s, Y, z - s, x + s, Y + h, z + s, 0b110111);
            S.box(x - s, Y, z - s, x + s, Y + h, z + s, "equipment", NOZIP);
            spots.push({ x, z, r: 1.2 });
            blocksN++;
            nG++;
        }

        const sqParks = (gen.openSpaces ?? []).filter(
            (o) => o.kind === "square",
        );

        const asph = (x, z) => {
            const q = streetsAt(x, z),
                t = q.type;
            return (
                t === "avenue" ||
                t === "street" ||
                t === "intersection" ||
                q.round ||
                q.cut
            );
        };
        const pfree = (x, z) => {
            const t = streetsAt(x, z).type;
            if (t !== "block" && t !== "sidewalk") return false;
            for (const l of lotsAt(x, z))
                if (
                    x > l.x0 - 0.8 &&
                    x < l.x1 + 0.8 &&
                    z > l.z0 - 0.8 &&
                    z < l.z1 + 0.8
                )
                    return false;
            for (const P of polysAt(x, z)) if (inConvex(P, x, z)) return false;
            return true;
        };
        const _cellFree = (x, z) => {
            if (
                sqParks.some(
                    (o) =>
                        x > o.x0 - 1 &&
                        x < o.x1 + 1 &&
                        z > o.z0 - 1 &&
                        z < o.z1 + 1,
                )
            )
                return false;
            if (!(
                pfree(x, z) &&
                pfree(x - 0.7, z - 0.7) &&
                pfree(x + 0.7, z - 0.7) &&
                pfree(x - 0.7, z + 0.7) &&
                pfree(x + 0.7, z + 0.7)
            ))
                return false;
            if (free(x, z)) return true;
            for (let k = 0; k < 12; k++) {
                const a = (k / 12) * Math.PI * 2;
                if (asph(x + Math.cos(a) * 4.6, z + Math.sin(a) * 4.6))
                    return false;
            }
            return true;
        };

        const Cs = 1.5,
            lin = (h) =>
                [
                    ((h >> 16) & 255) / 255,
                    ((h >> 8) & 255) / 255,
                    (h & 255) / 255,
                ].map((v) => Math.pow(v, 2.2));
        const GR = lin(0x736e67),
            DK = lin(0x423f3b),
            RL = lin(0x8a857b),
            RD = lin(0x57534e),
            DG = lin(0x645a4c),
            PT = lin(0x908a7f);

        const pd =
            lincoln && focal
                ? [1, 0]
                : focal
                  ? (() => {
                        const dx = sx - focal.x,
                            dz = sz - focal.z,
                            l = Math.hypot(dx, dz);
                        return l > 1 ? [dx / l, dz / l] : [1, 0];
                    })()
                  : null;
        const pathD = (x, z) => {
            if (!pd) return 9;
            const rx = x - focal.x,
                rz = z - focal.z;
            return Math.min(
                Math.abs(rx * pd[1] - rz * pd[0]),
                Math.abs(rx * pd[0] + rz * pd[1]),
            );
        };
        const hh = (x, z, k) => {
            const v =
                Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453;
            return v - Math.floor(v);
        };
        const grime = (x, z) =>
            0.5 +
            0.5 *
                (0.55 *
                    Math.sin(x * 0.083 + z * 0.041 + si) *
                    Math.cos(z * 0.067 - x * 0.029 - si * 1.7) +
                    0.3 * Math.sin((x - z) * 0.19 + si * 2.3) +
                    0.15 * Math.sin(x * 0.43 + z * 0.37));
        const tone = (c, x, z) => {
            const g = grime(x, z),
                j = 0.93 + 0.12 * hh(x, z, 1),
                w = 1 - (0.24 * Math.max(0, g - 0.4)) / 0.6;
            return c.map((v, n) => v * j * w * (n === 2 ? 0.985 : 1));
        };
        const cells = [],
            cellSet = (gen.paverCells ??= new Set()),
            ck = (i, j) => i * 100003 + j;

        const ringOK = (x, z, r = 4.6) => {
            for (let k = 0; k < 16; k++) {
                const a = (k / 16) * Math.PI * 2;
                if (asph(x + Math.cos(a) * r, z + Math.sin(a) * r))
                    return false;
            }
            return true;
        };

        const bldNear = (x, z, r) => {
            for (let k = 0; k < 8; k++) {
                const a = (k / 8) * Math.PI * 2,
                    px = x + Math.cos(a) * r,
                    pz = z + Math.sin(a) * r;
                if (streetsAt(px, pz).type === "block" && !free(px, pz))
                    return true;
                if (
                    !pfree(px, pz) &&
                    streetsAt(px, pz).type !== "avenue" &&
                    streetsAt(px, pz).type !== "street" &&
                    streetsAt(px, pz).type !== "intersection"
                )
                    return true;
            }
            return false;
        };
        const Fp = (x, z) =>
            !sqParks.some(
                (o) =>
                    x > o.x0 - 1 &&
                    x < o.x1 + 1 &&
                    z > o.z0 - 1 &&
                    z < o.z1 + 1,
            ) &&
            pfree(x, z) &&
            (free(x, z) ||
                ringOK(x, z) ||
                (ringOK(x, z, 2.4) && !bldNear(x, z, 3.5)));
        const vC = (gen._pavV ??= new Map()),
            Fv = (i, j) => {
                const k = ck(i, j);
                let v = vC.get(k);
                if (v === undefined) vC.set(k, (v = Fp(i * Cs, j * Cs)));
                return v;
            };
        const eC = (gen._pavE ??= new Map());
        const crossAt = (ai, aj, bi, bj) => {
            if (ai > bi || aj > bj) [ai, aj, bi, bj] = [bi, bj, ai, aj];
            const k = ck(ai, aj) * 2 + (bi > ai ? 0 : 1);
            let r = eC.get(k);
            if (r) return r;
            const fa = Fv(ai, aj);
            let lo = 0,
                hi = 1;
            for (let it = 0; it < 8; it++) {
                const t = (lo + hi) / 2;
                if (
                    Fp((ai + (bi - ai) * t) * Cs, (aj + (bj - aj) * t) * Cs) ===
                    fa
                )
                    lo = t;
                else hi = t;
            }
            const t = (lo + hi) / 2;
            r = [(ai + (bi - ai) * t) * Cs, (aj + (bj - aj) * t) * Cs];
            eC.set(k, r);
            return r;
        };
        for (const b of blocks) {
            if (
                !b.diag?.length ||
                b.x1 < sx - 95 ||
                b.x0 > sx + 95 ||
                b.z1 < sz - 95 ||
                b.z0 > sz + 95
            )
                continue;
            for (let i = Math.floor(b.x0 / Cs); i * Cs < b.x1; i++)
                for (let j = Math.floor(b.z0 / Cs); j * Cs < b.z1; j++) {
                    const x = (i + 0.5) * Cs,
                        z = (j + 0.5) * Cs;
                    if (
                        Math.hypot(x - sx, z - sz) > 95 ||
                        cellSet.has(ck(i, j))
                    )
                        continue;
                    const n =
                        Fv(i, j) +
                        Fv(i + 1, j) +
                        Fv(i + 1, j + 1) +
                        Fv(i, j + 1);
                    if (!n) continue;
                    const full = n === 4 && Fp(x, z);
                    if (n === 4 && !full) continue;
                    cellSet.add(ck(i, j));
                    cells.push([x, z, i, j, full]);
                }
        }

        const PALS = [
            [
                [0.29, 0.31, 0.09],
                [0.17, 0.2, 0.06],
            ],
            [
                [0.2, 0.24, 0.08],
                [0.12, 0.16, 0.05],
            ],
            [
                [0.33, 0.3, 0.09],
                [0.19, 0.19, 0.06],
            ],
            [
                [0.17, 0.21, 0.1],
                [0.1, 0.13, 0.06],
            ],
        ].map((p) => p.map((c) => c.map((v) => v * 1.2)));
        const pal = [PALS[si % PALS.length], PALS[(si + 1) % PALS.length]],
            grove = [];
        if (!lincoln) {
            const fld = (x, z) =>
                0.5 +
                0.5 *
                    (0.6 *
                        Math.sin(x * 0.061 + si * 3.1) *
                        Math.cos(z * 0.053 - si) +
                        0.4 * Math.sin((x + z) * 0.11 + si * 1.3));
            const order = cells
                .filter((c) => c[4])
                .sort((a, b) => hh(a[0], a[1], 7) - hh(b[0], b[1], 7));
            for (const [x, z] of order) {
                if (grove.length >= 16) break;
                const f = fld(x, z);
                if (f < 0.52) continue;
                const gap = 7.5 - 3.2 * f + hh(x, z, 3) * 1.5;
                if (
                    grove.some((g) => Math.hypot(g.x - x, g.z - z) < gap) ||
                    !clear(x, z, 2.0) ||
                    !far(x, z, 1.4)
                )
                    continue;
                if (focal && Math.hypot(x - focal.x, z - focal.z) < focal.r + 7)
                    continue;
                if (pathD(x, z) < 3.4) continue;
                const sc = 0.6 + 0.55 * hh(x, z, 5) * f,
                    small = hh(x, z, 9) < 0.18;
                grove.push({ x, z, r: 1.4 + sc * 1.3 });
                (gen.openTrees ??= []).push({
                    x,
                    z,
                    kind: small ? "small" : "street",
                    clear: 3.2,
                    y: Y + 0.012,
                    sc,
                    pal,
                });
                spots.push({ x, z, r: 1.6 });
            }
        }
        const Rr = focal ? focal.r + (lincoln ? 22 : 9) : 0;

        let _nClip = 0;
        const cellPoly = new Map();
        const fan = (d, P, y, cx0, cz0) => {
            if (P.length < 3) return;
            let sa = 0;
            for (let k = 0; k < P.length; k++) {
                const A2 = P[k],
                    B2 = P[(k + 1) % P.length];
                sa += A2[0] * B2[1] - B2[0] * A2[1];
            }
            const Q = sa > 0 ? P.slice().reverse() : P,
                u0 = cx0 - 0.75,
                v0 = cz0 + 0.75;
            const vi = Q.map(([px, pz]) =>
                d.vert(px, y, pz, 0, 1, 0, (px - u0) / Cs, (v0 - pz) / Cs),
            );
            for (let k = 1; k + 1 < vi.length; k++)
                d.tri(vi[0], vi[k], vi[k + 1]);
        };
        const clipConvex = (Q, C) => {
            let R = Q;
            const [ocx, ocz] = centroid(C);
            for (let i = 0; i < C.length && R.length >= 3; i++) {
                const p = C[i],
                    q = C[(i + 1) % C.length],
                    sd =
                        Math.sign(
                            (q[0] - p[0]) * (ocz - p[1]) -
                                (q[1] - p[1]) * (ocx - p[0]),
                        ) || 1;
                R = clipPoly(
                    R,
                    (x2, z2) =>
                        sd *
                        ((q[0] - p[0]) * (z2 - p[1]) -
                            (q[1] - p[1]) * (x2 - p[0])),
                );
            }
            return R;
        };
        const Ypath = [Y + 0.014, Y + 0.018],
            Yring = Y + 0.022,
            Ybed = [Y + 0.026, Y + 0.03],
            Yband = Y + 0.034;
        const bandsQ = [];
        for (const [x, z, ci, cj, full] of cells) {
            let poly;
            const segs = [];
            const d0 = D(x, z).setPart(DP.CONC);
            if (full) {
                poly = [
                    [ci * Cs, cj * Cs],
                    [(ci + 1) * Cs, cj * Cs],
                    [(ci + 1) * Cs, (cj + 1) * Cs],
                    [ci * Cs, (cj + 1) * Cs],
                ];
                const edge =
                    !cellSet.has(ck(ci + 1, cj)) ||
                    !cellSet.has(ck(ci - 1, cj)) ||
                    !cellSet.has(ck(ci, cj + 1)) ||
                    !cellSet.has(ck(ci, cj - 1));
                d0.setColor(tone(edge ? DK : GR, x, z)).box(
                    x - 0.735,
                    Y,
                    z - 0.735,
                    x + 0.735,
                    Y + 0.01,
                    z + 0.735,
                    0b000100,
                );
                const pb = ((gen.squarePavers ??= [])[si] ??= {
                    sx,
                    sz,
                    n: 0,
                    x0: 1e9,
                    x1: -1e9,
                    z0: 1e9,
                    z1: -1e9,
                    sxs: 0,
                    szs: 0,
                });
                pb.n++;
                pb.sxs += x;
                pb.szs += z;
                pb.x0 = Math.min(pb.x0, x);
                pb.x1 = Math.max(pb.x1, x);
                pb.z0 = Math.min(pb.z0, z);
                pb.z1 = Math.max(pb.z1, z);
                if (edge) {
                    cellPoly.set(ck(ci, cj), poly);
                    nPv++;
                    continue;
                }
            } else {
                const C4 = [
                    [ci, cj],
                    [ci + 1, cj],
                    [ci + 1, cj + 1],
                    [ci, cj + 1],
                ];
                poly = [];
                let exitP = null;
                for (let k = 0; k < 4; k++) {
                    const [ai, aj] = C4[k],
                        [bi, bj] = C4[(k + 1) % 4],
                        fa = Fv(ai, aj),
                        fb = Fv(bi, bj);
                    if (fa) poly.push([ai * Cs, aj * Cs]);
                    if (fa !== fb) {
                        const X = crossAt(ai, aj, bi, bj);
                        poly.push(X);
                        if (fa) exitP = X;
                        else if (exitP) {
                            segs.push([exitP, X]);
                            exitP = null;
                        } else segs.push([null, X]);
                    }
                }
                for (const sg of segs) if (!sg[0]) sg[0] = exitP;
                if (poly.length < 3) continue;
                d0.setColor(tone(GR, x, z));
                fan(d0, poly, Y + 0.01, x, z);
                _nClip++;
            }
            cellPoly.set(ck(ci, cj), poly);
            nPv++;
            if (pd) {
                const rx0 = focal.x,
                    rz0 = focal.z;
                const T = [
                    (px, pz) => (px - rx0) * pd[1] - (pz - rz0) * pd[0],
                    (px, pz) => (px - rx0) * pd[0] + (pz - rz0) * pd[1],
                ];
                T.forEach((t, w) => {
                    const tv = poly.map(([px, pz]) => t(px, pz));
                    if (Math.min(...tv) > 2.4 || Math.max(...tv) < -2.4) return;
                    for (const [lo, hi, c] of [
                        [-2.4, -1.6, RD],
                        [-1.6, 1.6, PT],
                        [1.6, 2.4, RD],
                    ]) {
                        let Q = clipPoly(poly, (px, pz) => t(px, pz) - lo);
                        if (Q.length >= 3)
                            Q = clipPoly(Q, (px, pz) => hi - t(px, pz));
                        if (Q.length >= 3 && polyArea(Q) > 1e-3) {
                            d0.setColor(tone(c, x, z));
                            fan(d0, Q, Ypath[w], x, z);
                        }
                    }
                });
            }
            for (const [P, Q] of segs)
                if (P && Q) bandsQ.push([P, Q, poly, x, z]);
        }

        const annulus = (ax, az, ra, rb, col, y) => {
            const n = Math.max(20, Math.ceil((2 * Math.PI * rb) / 1.1));
            for (let k = 0; k < n; k++) {
                const a0 = (k / n) * Math.PI * 2,
                    a1 = ((k + 1) / n) * Math.PI * 2,
                    c0 = Math.cos(a0),
                    s0 = Math.sin(a0),
                    c1 = Math.cos(a1),
                    s1 = Math.sin(a1);
                const q =
                    ra > 0.01
                        ? [
                              [ax + c0 * ra, az + s0 * ra],
                              [ax + c0 * rb, az + s0 * rb],
                              [ax + c1 * rb, az + s1 * rb],
                              [ax + c1 * ra, az + s1 * ra],
                          ]
                        : [
                              [ax, az],
                              [ax + c0 * rb, az + s0 * rb],
                              [ax + c1 * rb, az + s1 * rb],
                          ];
                const bb = bboxOf(q),
                    mx = (bb.x0 + bb.x1) / 2,
                    mz = (bb.z0 + bb.z1) / 2,
                    cc = col(mx, mz);
                for (let i = Math.floor(bb.x0 / Cs); i * Cs < bb.x1; i++)
                    for (let j = Math.floor(bb.z0 / Cs); j * Cs < bb.z1; j++) {
                        const C = cellPoly.get(ck(i, j));
                        if (!C) continue;
                        const R = clipConvex(q, C);
                        if (R.length < 3 || polyArea(R) < 1e-3) continue;
                        const d = D((i + 0.5) * Cs, (j + 0.5) * Cs)
                            .setPart(DP.CONC)
                            .setColor(tone(cc, mx, mz));
                        fan(d, R, y, (i + 0.5) * Cs, (j + 0.5) * Cs);
                    }
            }
        };
        if (focal)
            for (let bI = 0, r0 = Math.max(0, focal.r - 0.2); r0 < Rr; bI++) {
                const band = Math.floor((r0 + 0.01 - focal.r) / 2.25),
                    r1 = Math.min(Rr, focal.r + (band + 1) * 2.25);
                const c = band % 3 === 2 ? RD : band % 2 ? RL : GR;
                annulus(focal.x, focal.z, r0, r1, () => c, Yring);
                r0 = r1;
            }
        for (const g of grove) {
            const rb = Math.min(g.r, 2.4);
            annulus(g.x, g.z, Math.max(0, rb - 0.8), rb, () => RD, Ybed[0]);
            annulus(g.x, g.z, 0, rb - 0.8, () => DG, Ybed[1]);
        }
        for (const [P, Q, poly, x, z] of bandsQ) {
            const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
            if (L < 1e-3) continue;
            const [mx, mz] = centroid(poly);
            let nx = -(Q[1] - P[1]) / L,
                nz = (Q[0] - P[0]) / L;
            if (nx * (mx - P[0]) + nz * (mz - P[1]) < 0) {
                nx = -nx;
                nz = -nz;
            }
            const w = 0.55;
            fan(
                D(x, z)
                    .setPart(DP.CONC)
                    .setColor(tone(DK, x, z)),
                [
                    P,
                    Q,
                    [Q[0] + nx * w, Q[1] + nz * w],
                    [P[0] + nx * w, P[1] + nz * w],
                ],
                Yband,
                x,
                z,
            );
        }
        let benches = 0,
            bollards = 0;
        for (const [x, z] of cand) {
            if (benches >= 10) break;
            if (!clear(x, z, 1.3) || !far(x, z, 1.3)) continue;
            const d = D(x, z),
                ax = rr() < 0.5,
                L = 0.95,
                W = 0.26,
                bk = rr() < 0.5 ? 1 : -1;
            const [a0, a1, c0, c1] = ax
                ? [x - L, x + L, z - W, z + W]
                : [x - W, x + W, z - L, z + L];
            d.setPart(DP.WOOD)
                .setColor(0x6a4c32)
                .box(a0, Y + 0.4, c0, a1, Y + 0.46, c1, 0b111111);
            const bb = ax
                ? [
                      a0,
                      Y + 0.46,
                      bk > 0 ? c1 - 0.06 : c0,
                      a1,
                      Y + 0.85,
                      bk > 0 ? c1 : c0 + 0.06,
                  ]
                : [
                      bk > 0 ? a1 - 0.06 : a0,
                      Y + 0.46,
                      c0,
                      bk > 0 ? a1 : a0 + 0.06,
                      Y + 0.85,
                      c1,
                  ];
            d.box(...bb, 0b111111);
            d.setPart(DP.STEEL).setColor(0x2a2c2e);
            for (const s of [0.12, 0.88]) {
                const p = ax ? a0 + (a1 - a0) * s : c0 + (c1 - c0) * s;
                if (ax)
                    d.box(
                        p - 0.03,
                        Y,
                        c0 + 0.03,
                        p + 0.03,
                        Y + 0.4,
                        c1 - 0.03,
                        0b110011,
                    );
                else
                    d.box(
                        a0 + 0.03,
                        Y,
                        p - 0.03,
                        a1 - 0.03,
                        Y + 0.4,
                        p + 0.03,
                        0b110011,
                    );
            }
            S.box(a0, Y, c0, a1, Y + 0.46, c1, "equipment", NOZIP);
            S.box(...bb, "equipment", NOZIP);
            spots.push({ x, z, r: 1.4 });
            benches++;
            nB++;
        }
        for (const [x, z] of cand) {
            if (bollards >= 28) break;
            if (!clear(x, z, 0.4) || clear(x, z, 1.6) || !far(x, z, 0.85))
                continue;
            const d = D(x, z);
            d.setPart(DP.STEEL)
                .setColor(0x2b2d2f)
                .cyl(x, Y, z, 0.12, 0.11, 0.9, 8, true);
            d.setPart(DP.GALV)
                .setColor(0x8a8d8f)
                .cyl(x, Y + 0.9, z, 0.11, 0.02, 0.08, 8, true);
            S.cyl(
                x,
                z,
                Y,
                Y + 0.95,
                polyR(0.12, 8),
                polyR(0.11, 8),
                "equipment",
                NOZIP,
            );
            spots.push({ x, z, r: 0.85 });
            bollards++;
            nBo++;
        }
        nIs += islandFurnish(gen, si, sx, sz, rr, blocks, {
            lotsAt,
            polysAt,
            asph,
            far,
            spots,
            D,
            sqParks,
        });
    });
    nIs += furnishMapParks(gen);
    nIs += furnishRefuges(gen);
    return {
        tables: nT,
        planters: nP,
        granite: nG,
        fountains: nF,
        pavers: nPv,
        sculptures: nSc,
        kiosks: nK,
        benches: nB,
        bollards: nBo,
        islandItems: nIs,
    };
}
