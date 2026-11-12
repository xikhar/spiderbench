// @ts-nocheck
/**
 * Generates residential building architecture variants and lot splits.
 *
 * @module world-residential
 * @version 1.0.0
 * @file src/world/residential.ts
 * @since 0.0.1
 * @description Selects and customizes residential styles, dimensions, and subdivisions for housing-like building lots.
 */
import { STYLE, LAYER } from "./facade.ts";
const G_CURB = 0.15;

const BRICK = [
    [LAYER.RED, [1.0, 0.92, 0.88]],
    [LAYER.RED, [1.08, 0.86, 0.76]],
    [LAYER.RED, [0.84, 0.72, 0.7]],
    [LAYER.RED, [0.95, 0.8, 0.74]],
    [LAYER.BROWN, [1.0, 0.98, 0.96]],
    [LAYER.BROWN, [0.8, 0.74, 0.7]],
    [LAYER.BROWN, [0.68, 0.62, 0.6]],
    [LAYER.BROWN, [1.08, 0.96, 0.86]],
    [LAYER.BUFF, [1.0, 0.97, 0.92]],
    [LAYER.BUFF, [0.92, 0.84, 0.74]],
];
const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];
const jit = (rnd, t, k = 0.05) => t.map((c) => c * (1 + (rnd() - 0.5) * 2 * k));

export function residentialArch(lot, dist, rnd, gen) {
    const A = residentialArch0(lot, dist, rnd, gen);
    if (!A) return A;
    const v = () => 0.9 + rnd() * 0.2;
    A.winW *= v();
    A.winH *= 0.92 + rnd() * 0.18;
    A.bayW *= 0.94 + rnd() * 0.14;
    if (A.type !== "postwar") {
        A.lintel = rnd() < 0.7 ? 1 : 0;
        A.noBalconies = true;
    }

    if (A.type === "apt" && dist.parkEdge > 0 && A.shape === undefined) {
        const q = rnd();

        {
            const h = rnd(),
                f =
                    h < 0.3
                        ? 7 + Math.floor(rnd() * 5)
                        : h < 0.75
                          ? 12 + Math.floor(rnd() * 6)
                          : 18 + Math.floor(rnd() * 9);
            A.height = A.gH + f * A.floorH;
        }
        A.shape =
            q < 0.22
                ? prewarTowers
                : q < 0.46
                  ? mansardTop
                  : q < 0.72
                    ? steppedCrown
                    : q < 0.88
                      ? "setbackTop"
                      : mansardTop;
        A.waterTower = A.waterTower || rnd() < 0.55;
        if (A.shape === prewarTowers) A.towerFloors = 7 + Math.floor(rnd() * 8);
    } else if (A.type === "apt" && A.shape === undefined) {
        const q = rnd();
        if (A.height > 45 && q < 0.14) {
            A.shape = prewarTowers;
            A.towerFloors = 4 + Math.floor(rnd() * 5);
        } else if (q < 0.4) A.shape = mansardTop;
        else if (A.height > 40 && q < 0.6) A.shape = steppedCrown;
    } else if (A.type === "walkup" && A.shape === undefined && rnd() < 0.18)
        A.shape = mansardTop;

    if (A.type === "postwar" && A.height > 60 && A.shape === undefined) {
        const q = rnd();

        const w = lot.x1 - lot.x0,
            d = lot.z1 - lot.z0;
        if (Math.min(w, d) >= 30 && q < 0.2) A.shape = "notched";
        else if (q < 0.34) A.shape = "slab";
        else if (q < 0.5) A.shape = "podiumTower";
        else if (q < 0.62) A.shape = "asym";
        else if (q < 0.74) A.shape = "setbackTop";
        else A.shape = steppedCrown;
    }

    if (rnd() < 0.28 && A.type !== "postwar") {
        const alt = [
            [LAYER.BROWN, [0.62, 0.5, 0.44]],
            [LAYER.CONCRETE, [0.78, 0.76, 0.74]],
            [LAYER.LIME, [1.02, 1.0, 0.96]],
            [LAYER.WHITE, [0.92, 0.9, 0.84]],
            [LAYER.GRANITE, [0.9, 0.86, 0.8]],
        ];
        const [lay, t] = alt[Math.floor(rnd() * alt.length)];
        A.layer = lay;
        A.tint = jit(rnd, t, 0.04);
    }

    {
        const val = 0.78 + rnd() * 0.32,
            h = rnd(),
            g = rnd() < 0.3 ? 0.35 * rnd() : 0;
        const drift =
            h < 0.33
                ? [1.04, 0.99, 0.94]
                : h < 0.66
                  ? [0.96, 0.99, 1.04]
                  : [1, 1, 1];
        A.tint = A.tint.map((c, i) => {
            const v = c * drift[i] * val;
            const m = ((A.tint[0] + A.tint[1] + A.tint[2]) / 3) * val;
            return v + (m - v) * g;
        });
    }

    if (
        A.shape === undefined &&
        (A.type === "walkup" || A.type === "apt") &&
        rnd() < 0.6
    )
        A.shape = lightwell;

    const wq =
        0.5 +
        0.5 * Math.sin(lot.cx * 0.013 + 1.1) * Math.cos(lot.cz * 0.011 - 0.4);
    A.waterTower =
        (A.waterTower && rnd() < 0.88) ||
        rnd() < (A.type === "postwar" ? 0.2 : 0.2 + 0.35 * wq);

    if (rnd() < 0.8)
        A.acRate = 0.04 + rnd() * (A.type === "postwar" ? 0.26 : 0.2);
    if (A.type !== "postwar" && rnd() < 0.45) A.boxRate = 0.04 + rnd() * 0.12;

    A.belts =
        A.type === "postwar"
            ? rnd() < 0.55
                ? 1
                : 0
            : rnd() < 0.85
              ? 1 + (rnd() < 0.5 ? 1 : 0)
              : 0;
    A.beltTint =
        A.layer === LAYER.LIME ||
        A.layer === LAYER.WHITE ||
        A.layer === LAYER.GRANITE
            ? rnd() < 0.5
                ? 0x9a948a
                : 0x7c776f
            : pick(rnd, [0xc9c1b0, 0xbdb4a2, 0xd6cfbf, 0xa9a397, 0x8f8a82]);
    A.decor = resDecor;
    {
        const st = ["nz", "pz", "nx", "px"].filter(
            (k) => lot.sides?.[k] === "street",
        );
        A.doorSide =
            st.length && rnd() < 0.8 ? st[Math.floor(rnd() * st.length)] : null;
    }
    A.noBedGrid = rnd() < 0.85;
    A.parK = pick(rnd, [0.55, 0.8, 1, 1, 1.25, 1.6, 2.1, 2.6]);
    A.pediment = A.type === "walkup" && rnd() < 0.35;
    if (
        A.shape === undefined &&
        (A.type === "walkup" || (A.type === "apt" && A.height <= 50))
    )
        A.shape = plainBlock;
    if (typeof A.shape === "function") A.shape = withParapet(A.shape);
    return A;
}

export function residentialSplit(lot, dist) {
    if (lot.reserved || lot.subK) return null;
    if (dist.id !== "uws" && dist.id !== "ues" && dist.id !== "harlem")
        return null;
    const w = lot.x1 - lot.x0,
        d = lot.z1 - lot.z0,
        S = lot.sides;
    const h = mulberry(
        ((Math.floor(lot.cx * 3.7) * 73856093) ^
            (Math.floor(lot.cz * 2.9) * 19349663) ^
            0x6a11) >>>
            0,
    );
    const out = [];
    const mk = (x0, x1, z0, z1, sides, kind) => {
        if (x1 - x0 > 0.5 && z1 - z0 > 0.5)
            out.push({
                ...lot,
                x0,
                x1,
                z0,
                z1,
                sides,
                kind,
                cx: (x0 + x1) / 2,
                cz: (z0 + z1) / 2,
                resSub: out.length + 1,
            });
    };

    const houses = (a, e, z0, z1, sN, sP, rowK) => {
        let x = a;
        while (x < e - 0.1) {
            let ww = h() < 0.74 ? 6 + h() * 5 : 12 + h() * 7;
            if (e - (x + ww) < 6) ww = e - x;
            const sides = {
                nx: Math.abs(x - lot.x0) < 0.05 ? S.nx : "party",
                px: Math.abs(x + ww - lot.x1) < 0.05 ? S.px : "party",
                nz: sN,
                pz: sP,
            };
            mk(x, x + ww, z0, z1, sides, rowK);
            x += ww;
        }
    };
    if (lot.kind === "tower" && w > 34) {
        const parkX =
            dist.id === "uws" ? "px" : dist.id === "ues" ? "nx" : null;
        const end =
            dist.parkEdge > 0 && parkX && S[parkX] === "street"
                ? parkX
                : S.nx === "street" && S.px === "street"
                  ? h() < 0.5
                      ? "nx"
                      : "px"
                  : S.nx === "street"
                    ? "nx"
                    : S.px === "street"
                      ? "px"
                      : h() < 0.5
                        ? "nx"
                        : "px";
        const pw = Math.min(w - 12, 20 + h() * 14);
        const p0 = end === "nx" ? lot.x0 : lot.x1 - pw,
            p1 = p0 + pw;
        const pS = {
            nx: end === "nx" ? S.nx : "party",
            px: end === "px" ? S.px : "party",
            nz: S.nz,
            pz: S.pz,
        };
        if (d > 48 && h() < 0.35) {
            const zc = lot.z0 + d * (0.4 + h() * 0.2);
            mk(p0, p1, lot.z0, zc, { ...pS, pz: "party" }, "tower");
            mk(p0, p1, zc, lot.z1, { ...pS, nz: "party" }, "corner");
        } else mk(p0, p1, lot.z0, lot.z1, pS, "tower");

        let a = end === "nx" ? p1 : lot.x0,
            e = end === "nx" ? lot.x1 : p0;
        const far = end === "nx" ? "px" : "nx";
        if (S[far] === "street" && e - a > 34) {
            const fw = 14 + h() * 10;
            if (far === "px") {
                mk(
                    e - fw,
                    e,
                    lot.z0,
                    lot.z1,
                    { nx: "party", px: S.px, nz: S.nz, pz: S.pz },
                    "corner",
                );
                e -= fw;
            } else {
                mk(
                    a,
                    a + fw,
                    lot.z0,
                    lot.z1,
                    { nx: S.nx, px: "party", nz: S.nz, pz: S.pz },
                    "corner",
                );
                a += fw;
            }
        }
        if (e - a < 0.5) return out;
        const gap = d > 40 ? 8 + h() * 8 : 0;
        const dN = (d - gap) * (0.44 + h() * 0.12),
            zN = lot.z0 + dN,
            zS = zN + gap;
        const rs = gap > 0 ? "rear" : "party";
        houses(a, e, lot.z0, zN, S.nz, rs, "row");
        houses(a, e, zS, lot.z1, rs, S.pz, "row");
        return out;
    }
    if (lot.kind === "corner" && d > 44 && h() < 0.6) {
        const zc = lot.z0 + d * (0.38 + h() * 0.24);
        mk(lot.x0, lot.x1, lot.z0, zc, { ...S, pz: "party" }, "corner");
        mk(lot.x0, lot.x1, zc, lot.z1, { ...S, nz: "party" }, "corner");
        return out;
    }
    if (lot.kind === "row" && w > 15 && h() < 0.7) {
        const keep = w > 24 && h() < 0.35;
        if (keep) {
            const kw = 13 + h() * 6,
                at = h() < 0.5;
            if (at) {
                mk(
                    lot.x0,
                    lot.x0 + kw,
                    lot.z0,
                    lot.z1,
                    { ...S, px: "party" },
                    "row",
                );
                houses(lot.x0 + kw, lot.x1, lot.z0, lot.z1, S.nz, S.pz, "row");
            } else {
                houses(lot.x0, lot.x1 - kw, lot.z0, lot.z1, S.nz, S.pz, "row");
                mk(
                    lot.x1 - kw,
                    lot.x1,
                    lot.z0,
                    lot.z1,
                    { ...S, nx: "party" },
                    "row",
                );
            }
        } else houses(lot.x0, lot.x1, lot.z0, lot.z1, S.nz, S.pz, "row");
        return out.length > 1 ? out : null;
    }
    return null;
}
function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function withParapet(fn) {
    return (lot, A, P, r, H, parH) => {
        const out = fn(lot, A, P, r, H, parH * (A.parK ?? 1));
        if (!out || !A.pediment) return out;
        const top = out
            .filter((m) => !m.crown)
            .reduce((a, m) => (m.y1 > a.y1 ? m : a));
        const ph = top.parapet ?? 0;
        const s = ["nz", "pz", "nx", "px"].find(
            (k) =>
                lot.sides[k] === "street" &&
                Math.abs(
                    k[1] === "z"
                        ? k[0] === "n"
                            ? top.z0 - lot.z0
                            : lot.z1 - top.z1
                        : k[0] === "n"
                          ? top.x0 - lot.x0
                          : lot.x1 - top.x1,
                ) < 0.05,
        );
        if (!s || ph <= 0) return out;
        const alongX = s[1] === "z",
            L = alongX ? top.x1 - top.x0 : top.z1 - top.z0;
        if (L < 9) return out;
        const w = Math.min(9, L * (0.3 + r() * 0.15)),
            c = (alongX ? top.x0 + top.x1 : top.z0 + top.z1) / 2,
            t = 0.45,
            hh = 0.9 + r() * 0.8;
        const y0 = top.y1 + ph,
            st = { ...P, style: STYLE.BLANK };
        const b = alongX
            ? {
                  x0: c - w / 2,
                  x1: c + w / 2,
                  z0: s === "nz" ? top.z0 : top.z1 - t,
                  z1: s === "nz" ? top.z0 + t : top.z1,
              }
            : {
                  z0: c - w / 2,
                  z1: c + w / 2,
                  x0: s === "nx" ? top.x0 : top.x1 - t,
                  x1: s === "nx" ? top.x0 + t : top.x1,
              };
        out.push({ ...b, y0, y1: y0 + hh, p: st, parapet: 0, crown: true });
        return out;
    };
}
function plainBlock(lot, A, P, r, H, parH) {
    const out = [{ ...lot, y0: 0, y1: H, p: P, parapet: parH, roof: true }];

    const w = lot.x1 - lot.x0,
        d = lot.z1 - lot.z0;
    if (
        Math.min(w, d) >= 11 &&
        H > 18 &&
        r() < (A.type === "apt" ? 0.55 : 0.22)
    ) {
        const v = 2.5 + r() * 2,
            k = (s) => (lot.sides[s] === "street" ? v : 1.2);
        const m = {
            x0: lot.x0 + k("nx"),
            x1: lot.x1 - k("px"),
            z0: lot.z0 + k("nz"),
            z1: lot.z1 - k("pz"),
        };
        const alongX = m.x1 - m.x0 >= m.z1 - m.z0,
            f = 0.4 + r() * 0.35,
            e = r() < 0.5;
        if (alongX) {
            const L = (m.x1 - m.x0) * f;
            if (e) m.x1 = m.x0 + L;
            else m.x0 = m.x1 - L;
        } else {
            const L = (m.z1 - m.z0) * f;
            if (e) m.z1 = m.z0 + L;
            else m.z0 = m.z1 - L;
        }
        if (m.x1 - m.x0 > 4.5 && m.z1 - m.z0 > 4.5) {
            const ph = A.floorH * (0.9 + r() * 0.15);
            out.push({
                ...m,
                y0: H,
                y1: H + ph,
                p: P,
                parapet: 0.7,
                roof: true,
                sides: {
                    nx: "setback",
                    px: "setback",
                    nz: "setback",
                    pz: "setback",
                },
            });
        }
    }
    return out;
}
function residentialArch0(lot, dist, rnd, gen) {
    const id = dist.id;
    if (lot.reserved) return null;
    if (id !== "uws" && id !== "ues" && id !== "harlem") return null;

    const A = {
        seed: gen.seed,
        resid: 0,
        lintel: gen.lintel ?? 0,
        glass: gen.glass ?? 0,
        depth: 0.22,
        margin: 0.7,
    };
    const w = lot.x1 - lot.x0;
    const harlem = id === "harlem";
    const parkEdge = dist.parkEdge > 0;
    const r = rnd();
    if (lot.kind === "tower") {
        if (harlem) {
            if (r < 0.7) {
                const [lay, t] = pick(rnd, BRICK.slice(0, 7));
                return {
                    ...A,
                    type: "postwar",
                    style: STYLE.PUNCHED,
                    layer: lay,
                    base: LAYER.CONCRETE,
                    floorH: 2.9,
                    bayW: 2.5,
                    winW: 0.5,
                    winH: 0.52,
                    gH: 3.4,
                    height: 3.4 + (14 + Math.floor(rnd() * 8)) * 2.9,
                    depth: 0.12,
                    margin: 0.8,
                    tint: jit(rnd, t),
                    lintel: 0,
                    waterTower: rnd() < 0.4,
                };
            }
        } else if (!parkEdge && r < 0.62) {
            const pq = rnd();
            const [lay, t] =
                pq < 0.12
                    ? [LAYER.WHITE, [0.86, 0.84, 0.8]]
                    : pq < 0.2
                      ? [LAYER.BUFF, [0.9, 0.84, 0.76]]
                      : pq < 0.24
                        ? [LAYER.CONCRETE, [0.74, 0.72, 0.7]]
                        : rnd() < 0.62
                          ? pick(rnd, BRICK.slice(4, 8))
                          : pick(rnd, BRICK);
            const floors =
                rnd() < 0.2
                    ? 42 + Math.floor(rnd() * 14)
                    : 24 + Math.floor(rnd() * 20);
            return {
                ...A,
                type: "postwar",
                style: STYLE.PUNCHED,
                layer: lay,
                base: rnd() < 0.5 ? LAYER.GRANITE : LAYER.LIME,
                floorH: 2.8 + rnd() * 0.3,
                bayW: 1.9 + rnd() * 1.2,
                winW: 0.42 + rnd() * 0.22,
                winH: 0.5 + rnd() * 0.12,
                gH: 4.6,
                height: 4.6 + floors * 2.95,
                depth: 0.14,
                margin: 0.6,
                tint: jit(rnd, t),
                lintel: 0,
                resid: 1,
                waterTower: rnd() < 0.35,
                cornice: false,
            };
        }

        if (parkEdge && !harlem && r < 0.2) {
            const q = rnd();

            const [lay, t] =
                q < 0.14
                    ? [LAYER.WHITE, [0.9, 0.88, 0.83]]
                    : q < 0.28
                      ? [LAYER.BUFF, [1, 0.96, 0.9]]
                      : q < 0.4
                        ? [LAYER.LIME, [0.98, 0.95, 0.9]]
                        : pick(rnd, BRICK.slice(4, 8));
            const floors = 21 + Math.floor(rnd() * 12);
            return {
                ...A,
                type: "postwar",
                style: STYLE.PUNCHED,
                layer: lay,
                base: LAYER.GRANITE,
                floorH: 3.0,
                bayW: 2.3 + rnd() * 0.4,
                winW: 0.5 + rnd() * 0.08,
                winH: 0.56,
                gH: 5.2,
                height: 5.2 + floors * 3.0,
                depth: 0.16,
                margin: 0.7,
                tint: jit(rnd, t),
                lintel: 0,
                resid: 1,
                waterTower: rnd() < 0.2,
                cornice: false,
            };
        }

        const [lay, t] =
            parkEdge && rnd() < 0.4
                ? [rnd() < 0.6 ? LAYER.LIME : LAYER.BUFF, [1, 0.98, 0.94]]
                : pick(rnd, BRICK);
        const floors =
            (parkEdge ? 15 : 12) + Math.floor(rnd() * (parkEdge ? 10 : 7));
        return {
            ...A,
            type: "apt",
            style: STYLE.PUNCHED,
            layer: lay,
            base: LAYER.LIME,
            floorH: 3.1,
            bayW: 2.4 + rnd() * 0.3,
            winW: 0.46,
            winH: 0.54,
            gH: 5.0,
            height: 5.0 + floors * 3.1,
            resid: 1,
            tint: jit(rnd, t),
            cornice: true,
            waterTower: rnd() < 0.6,
            fireEscape: !parkEdge && rnd() < 0.3,
            margin: 0.7,
        };
    }
    const small = w < 12;
    if (parkEdge && !small && r < 0.75) {
        const [lay, t] =
            rnd() < 0.38
                ? [rnd() < 0.6 ? LAYER.LIME : LAYER.BUFF, [1, 0.98, 0.94]]
                : pick(rnd, BRICK);
        const floors = 12 + Math.floor(rnd() * 7);
        return {
            ...A,
            type: "apt",
            style: STYLE.PUNCHED,
            layer: lay,
            base: LAYER.LIME,
            floorH: 3.1,
            bayW: 2.4,
            winW: 0.46,
            winH: 0.54,
            gH: 5.0,
            height: 5.0 + floors * 3.1,
            resid: 1,
            tint: jit(rnd, t),
            cornice: true,
            waterTower: rnd() < 0.5,
            margin: 0.8,
        };
    }
    if (harlem) {
        const [lay, t] =
            rnd() < 0.55
                ? pick(rnd, BRICK.slice(4, 8))
                : pick(rnd, BRICK.slice(0, 4));
        const floors = small
            ? 3 + Math.floor(rnd() * 2)
            : 4 + Math.floor(rnd() * 3);
        return {
            ...A,
            type: "walkup",
            style: STYLE.PUNCHED,
            layer: lay,
            base: rnd() < 0.6 ? LAYER.LIME : LAYER.GRANITE,
            floorH: 3.2,
            bayW: 2.3 + rnd() * 0.4,
            winW: 0.5,
            winH: 0.56,
            gH: 3.8,
            height: 3.8 + floors * 3.2,
            resid: 1,
            tint: jit(rnd, t, 0.07),
            cornice: true,
            waterTower: !small && rnd() < 0.3,
            fireEscape: !small && rnd() < 0.7,
            margin: 0.5,
        };
    }

    if (!small && lot.kind === "corner" && r < 0.7) {
        const [lay, t] = pick(rnd, BRICK);
        if (rnd() < 0.42) {
            const floors = 22 + Math.floor(rnd() * 22);
            return {
                ...A,
                type: "postwar",
                style: STYLE.PUNCHED,
                layer: lay,
                base: LAYER.GRANITE,
                floorH: 2.95,
                bayW: 2.3,
                winW: 0.52,
                winH: 0.54,
                gH: 4.6,
                height: 4.6 + floors * 2.95,
                depth: 0.14,
                margin: 0.6,
                tint: jit(rnd, t),
                lintel: 0,
                resid: 1,
                waterTower: rnd() < 0.4,
                cornice: false,
            };
        }
        const floors = 12 + Math.floor(rnd() * 10);
        return {
            ...A,
            type: "apt",
            style: STYLE.PUNCHED,
            layer: lay,
            base: LAYER.LIME,
            floorH: 3.05,
            bayW: 2.3 + rnd() * 0.4,
            winW: 0.48,
            winH: 0.55,
            gH: 4.8,
            height: 4.8 + floors * 3.05,
            resid: 1,
            tint: jit(rnd, t),
            cornice: rnd() < 0.85,
            waterTower: rnd() < 0.6,
            fireEscape: rnd() < 0.4,
            margin: 0.6,
        };
    }
    if (!small && (lot.kind === "corner" || w > 22) && r < 0.5) {
        const [lay, t] = pick(rnd, BRICK);
        const floors = 9 + Math.floor(rnd() * 7);
        return {
            ...A,
            type: "apt",
            style: STYLE.PUNCHED,
            layer: lay,
            base: LAYER.LIME,
            floorH: 3.05,
            bayW: 2.3 + rnd() * 0.4,
            winW: 0.48,
            winH: 0.55,
            gH: 4.6,
            height: 4.6 + floors * 3.05,
            resid: 1,
            tint: jit(rnd, t),
            cornice: rnd() < 0.8,
            waterTower: rnd() < 0.55,
            fireEscape: rnd() < 0.55,
            margin: 0.6,
        };
    }

    if (rnd() < 0.34) {
        const [lay, t] =
            rnd() < 0.55 ? [LAYER.BROWN, [0.64, 0.52, 0.46]] : pick(rnd, BRICK);
        const floors = 3 + Math.floor(rnd() * 3);
        return {
            ...A,
            type: "walkup",
            style: STYLE.PUNCHED,
            layer: lay,
            base: LAYER.LIME,
            floorH: 3.3,
            bayW: 2.0 + rnd() * 0.4,
            winW: 0.5,
            winH: 0.6,
            gH: 0,
            height: floors * 3.3 + 0.6,
            resid: 1,
            tint: jit(rnd, t, 0.08),
            cornice: true,
            waterTower: false,
            fireEscape: false,
            margin: 0.5,
            stoop: true,
        };
    }
    const [lay, t] = pick(rnd, BRICK);
    const floors = 5 + Math.floor(rnd() * 3);
    return {
        ...A,
        type: "walkup",
        style: STYLE.PUNCHED,
        layer: lay,
        base: rnd() < 0.5 ? LAYER.LIME : LAYER.GRANITE,
        floorH: 3.2,
        bayW: 2.3 + rnd() * 0.5,
        winW: 0.5,
        winH: 0.56,
        gH: 4.2,
        height: 4.2 + floors * 3.2,
        resid: 1,
        tint: jit(rnd, t, 0.07),
        cornice: true,
        waterTower: rnd() < 0.4,
        fireEscape: !small || rnd() < 0.5,
        margin: 0.5,
    };
}

const snap = (A, y) =>
    A.gH + Math.max(1, Math.round((y - A.gH) / A.floorH)) * A.floorH;
function prewarTowers(lot, A, P, r, H, parH) {
    const w = lot.x1 - lot.x0,
        d = lot.z1 - lot.z0;
    if (Math.min(w, d) < 22 || H < 35) return null;
    const out = [{ ...lot, y0: 0, y1: H, p: P, parapet: parH, roof: true }];
    const tw = Math.max(11, Math.min(18, Math.min(w, d) * 0.42));
    const twin = Math.max(w, d) >= 2 * tw + 12 && r() < 0.75;
    const alongX = w >= d;
    const Ht = snap(A, H + (A.towerFloors ?? 7) * A.floorH);
    const cs = [];
    if (twin) {
        const m = 3 + r() * 2;
        if (alongX) {
            const cz = (lot.z0 + lot.z1) / 2;
            cs.push([lot.x0 + m + tw / 2, cz], [lot.x1 - m - tw / 2, cz]);
        } else {
            const cx = (lot.x0 + lot.x1) / 2;
            cs.push([cx, lot.z0 + m + tw / 2], [cx, lot.z1 - m - tw / 2]);
        }
    } else cs.push([(lot.x0 + lot.x1) / 2, (lot.z0 + lot.z1) / 2]);
    const stone = { ...P, style: 0, layer: 3, tint: [0.95, 0.92, 0.86] };
    for (const [cx, cz] of cs) {
        const h = tw / 2;
        out.push({
            x0: cx - h,
            x1: cx + h,
            z0: cz - h,
            z1: cz + h,
            y0: H,
            y1: Ht,
            p: P,
            parapet: 1.1,
            roof: false,
        });

        const k1 = h * 0.72,
            y1 = Ht + 3.4,
            k2 = h * 0.34,
            y2 = y1 + 3.0;
        out.push({
            x0: cx - k1,
            x1: cx + k1,
            z0: cz - k1,
            z1: cz + k1,
            y0: Ht,
            y1,
            p: stone,
            parapet: 0.6,
            crown: true,
        });
        out.push({
            x0: cx - k2,
            x1: cx + k2,
            z0: cz - k2,
            z1: cz + k2,
            y0: y1,
            y1: y2,
            p: stone,
            parapet: 0,
            crown: true,
        });
    }
    return out;
}

function mansardTop(lot, A, P, r, H, _parH) {
    const w = lot.x1 - lot.x0,
        d = lot.z1 - lot.z0;
    if (Math.min(w, d) < 12 || H < 16) return null;
    const Hb = snap(A, H - A.floorH);
    const copper = r() < 0.3;
    const slate = {
        ...P,
        layer: LAYER.METAL,
        tint: copper ? [0.42, 0.86, 0.72] : [0.62, 0.62, 0.66],
        winW: Math.min(0.5, P.winW),
        margin: 0.4,
    };
    const out = [{ ...lot, y0: 0, y1: Hb, p: P, parapet: 0.35, roof: true }];
    const k = (s, v) => (lot.sides[s] === "street" ? v : 0);
    const ins = (m, v) => ({
        x0: m.x0 + k("nx", v),
        x1: m.x1 - k("px", v),
        z0: m.z0 + k("nz", v),
        z1: m.z1 - k("pz", v),
    });
    let y = Hb;
    const tiers = [
        [0.9, A.floorH * 0.95, slate],
        [1.9, A.floorH * 0.9, slate],
        [3.0, 1.1, { ...slate, style: STYLE.BLANK }],
    ];
    for (let i = 0; i < tiers.length; i++) {
        const [v, h, p] = tiers[i];
        const m = ins(lot, v);
        if (m.x1 - m.x0 < 6 || m.z1 - m.z0 < 6) break;
        out.push({
            ...m,
            y0: y,
            y1: y + h,
            p,
            parapet: i === tiers.length - 1 ? 0.5 : 0,
        });
        y += h;
    }

    return out;
}

function steppedCrown(lot, A, P, r, H, parH) {
    const w = lot.x1 - lot.x0,
        d = lot.z1 - lot.z0;
    if (Math.min(w, d) < 18 || H < 40) return null;
    const n = 2 + (r() < 0.45 ? 1 : 0);
    const fl = [];
    let tot = 0;
    for (let i = 0; i < n; i++) {
        const f = 2 + Math.floor(r() * 3);
        fl.push(f);
        tot += f;
    }
    let y = snap(A, H - tot * A.floorH);
    const out = [{ ...lot, y0: 0, y1: y, p: P, parapet: parH, roof: true }];
    let m = { x0: lot.x0, x1: lot.x1, z0: lot.z0, z1: lot.z1 };
    for (let i = 0; i < n; i++) {
        const v = 3.0 + r() * 2.8;
        const k = (s) => (lot.sides[s] === "street" ? v : v * 0.4);
        const nm = {
            x0: m.x0 + k("nx"),
            x1: m.x1 - k("px"),
            z0: m.z0 + k("nz"),
            z1: m.z1 - k("pz"),
        };
        if (nm.x1 - nm.x0 < 8 || nm.z1 - nm.z0 < 8) break;
        const y1 = y + fl[i] * A.floorH;
        out.push({
            ...nm,
            y0: y,
            y1,
            p: P,
            parapet: 1.0,
            roof: true,
            sides: {
                nx: "setback",
                px: "setback",
                nz: "setback",
                pz: "setback",
            },
        });
        m = nm;
        y = y1;
    }
    const c = Math.min(m.x1 - m.x0, m.z1 - m.z0);
    if (c > 10 && r() < 0.7) {
        const cx = (m.x0 + m.x1) / 2,
            cz = (m.z0 + m.z1) / 2,
            h = c * 0.28;
        out.push({
            x0: cx - h,
            x1: cx + h,
            z0: cz - h,
            z1: cz + h,
            y0: y,
            y1: y + 4.2,
            p: {
                ...P,
                style: STYLE.BLANK,
                layer: LAYER.LIME,
                tint: [0.95, 0.92, 0.86],
            },
            parapet: 0.5,
            crown: true,
        });
    }
    return out;
}

function lightwell(lot, A, P, r, H, parH) {
    const w = lot.x1 - lot.x0,
        d = lot.z1 - lot.z0;
    const rear = ["pz", "nz", "px", "nx"].filter(
        (s) => lot.sides[s] !== "street",
    );
    if (!rear.length) return null;
    const side = rear[Math.floor(r() * rear.length)];
    const alongX = side === "pz" || side === "nz";
    const L = alongX ? w : d,
        D = alongX ? d : w;
    if (L < 14 || D < 14) return null;
    const nd = Math.min(D * 0.42, 4 + r() * 5);
    const nN = L > 30 && r() < 0.5 ? 2 : 1;
    const cuts = [];
    for (let i = 0; i < nN; i++) {
        const nw = 3.6 + r() * 3.2;
        const c = ((i + 0.5) / nN) * L + (r() - 0.5) * (L / nN - nw - 6);
        const a0 = Math.max(3, c - nw / 2),
            a1 = Math.min(L - 3, c + nw / 2);
        if (a1 - a0 > 2.5) cuts.push([a0, a1]);
    }
    if (!cuts.length) return null;

    const box = (a0, a1, b0, b1) => {
        if (alongX) {
            const z =
                side === "pz"
                    ? [lot.z1 - b1, lot.z1 - b0]
                    : [lot.z0 + b0, lot.z0 + b1];
            return { x0: lot.x0 + a0, x1: lot.x0 + a1, z0: z[0], z1: z[1] };
        }
        const x =
            side === "px"
                ? [lot.x1 - b1, lot.x1 - b0]
                : [lot.x0 + b0, lot.x0 + b1];
        return { x0: x[0], x1: x[1], z0: lot.z0 + a0, z1: lot.z0 + a1 };
    };
    const inner = { pz: "nz", nz: "pz", px: "nx", nx: "px" }[side];
    const out = [
        { ...box(0, L, nd, D), y0: 0, y1: H, p: P, parapet: parH, roof: true },
    ];
    let a = 0;
    for (const [c0, c1] of [...cuts, [L, L]]) {
        if (c0 - a > 0.5)
            out.push({
                ...box(a, c0, 0, nd),
                y0: 0,
                y1: H,
                p: P,
                parapet: parH,
                sides: { [inner]: "party" },
            });
        a = c1;
    }
    return out;
}

const AC_COL = [
    0x6e695f, 0x77746c, 0x5f5f5c, 0x6a6352, 0x7d7a71, 0x4e5054, 0x3f3d39,
    0x675f55,
];

function resDecor(o) {
    const { D, S, fr, m, A, DP, frameMatrix, frameAABB } = o;
    const p = m.p || {};
    const fh = p.floorH ?? A.floorH,
        H = m.y1;
    if (A.belts && fr.W > 5 && H > A.gH + 3 * fh) {
        const nF = Math.round((H - A.gH) / fh);

        const lv = [A.gH + fh];
        if (A.belts > 1 && nF > 8) lv.push(A.gH + 3 * fh);
        if (nF > 4 && H + (m.parapet ?? 0) <= 28) lv.push(A.gH + (nF - 1) * fh);
        if (A.type === "postwar" && nF > 20)
            lv.push(A.gH + Math.round(nF * 0.5) * fh);
        D.setPart(DP.CONC).setColor(A.beltTint ?? 0xbdb4a2);
        D.with(frameMatrix(fr), (d) => {
            for (const y of lv) {
                const y0 = y - 0.06,
                    y1 = y + 0.26,
                    dep = 0.14;
                d.box(-0.02, y0, 0, fr.W + 0.02, y1, dep, 0b111111);
                S.box(
                    ...frameAABB(fr, -0.02, y0, 0, fr.W + 0.02, y1, dep),
                    "wall",
                );
            }
        });
    }
    if (A.acRate) windowACs(o);
    if (A.boxRate) windowBoxes(o);
    entrances(o);
}

const BOX_COL = [0x8a4a32, 0x6e3b2a, 0x2c3a2c, 0x1d1d1d, 0x5a4a3a, 0xb8b2a4];
const LEAF_COL = [0x3d5227, 0x4a5c2c, 0x2f4222, 0x7a3a24, 0x8a6a2a, 0x5a2a3a];
function windowBoxes({ D, S, fr, m, s, A, DP, frameMatrix, frameAABB }) {
    const p = m.p || {};
    const fh = p.floorH ?? A.floorH,
        margin = p.margin ?? 0.6,
        usable = fr.W - 2 * margin;
    if (usable < 2) return;
    const nb = Math.max(1, Math.floor(usable / (p.bayW ?? A.bayW) + 0.5)),
        bw = usable / nb;
    const ww = bw * (p.winW ?? A.winW),
        wh = fh * (p.winH ?? A.winH),
        wy0 = (fh - wh) * 0.42;
    const top = m.y1 + (m.parapet ?? 0) - 1.2;
    const fe = A.fireEscape && (s === "nz" || s === "pz") && fr.W > 7;
    let h =
        (Math.imul(((A.seed ?? 1) * 1000) | 0, 1597334677) ^
            Math.imul(s.charCodeAt(1) + 3, 40503)) >>>
        0;
    const rr = () => {
        h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
        return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
    };
    const bc = BOX_COL[Math.floor(rr() * BOX_COL.length)];
    const pr = pairing(p, A, m, bw, ww, fh);
    D.setPart(DP.PAINT);
    D.with(frameMatrix(fr), (d) => {
        for (let fl = 0; ; fl++) {
            if (A.gH + (fl + 1) * fh > top) break;
            const ys = A.gH + fl * fh + wy0;
            for (let i = 0; i < nb; i++) {
                if (rr() > A.boxRate) continue;
                let uc = margin + (i + 0.5) * bw,
                    wwi = ww;
                if (pr) {
                    const c = pr.at(fl, rr() < 0.5);
                    if (c !== null) {
                        uc = margin + i * bw + c;
                        wwi = pr.w2;
                    }
                }
                if (fe && Math.abs(uc - fr.W / 2) < 3.1) continue;
                const w = wwi * (0.9 + rr() * 0.12),
                    u0 = uc - w / 2,
                    u1 = uc + w / 2,
                    dep = 0.24,
                    bh = 0.22;
                d.setColor(bc).box(
                    u0,
                    ys - bh - 0.02,
                    0.0,
                    u1,
                    ys - 0.02,
                    dep,
                    0b111111,
                );

                d.setColor(LEAF_COL[Math.floor(rr() * LEAF_COL.length)]);
                const fy = ys + 0.06 + rr() * 0.08;
                d.box(
                    u0 + 0.03,
                    ys - 0.02,
                    0.02,
                    u1 - 0.03,
                    fy,
                    dep - 0.02,
                    0b110111,
                );
                S.box(
                    ...frameAABB(fr, u0, ys - bh - 0.02, 0, u1, fy, dep),
                    "equipment",
                );
            }
        }
    });
}

const CANOPY = [0x1e3a2a, 0x3a1a1c, 0x1c2438, 0x151515, 0x4a3a24, 0x2a3a3a];
function entrances({ D, S, fr, s, A, DP, frameMatrix, frameAABB }) {
    let h =
        (Math.imul(((A.seed ?? 1) * 1000) | 0, 2246822519) ^
            Math.imul(s.charCodeAt(1) + 7 * s.charCodeAt(0), 3266489917)) >>>
        0;
    const rr = () => {
        h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
        return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
    };
    if (A.stoop) {
        if (fr.W < 5) return;
        const n = Math.max(1, Math.floor(fr.W / 6.2)),
            bw = fr.W / n;
        D.setPart(DP.CONC);
        D.with(frameMatrix(fr), (d) => {
            for (let i = 0; i < n; i++) {
                if (rr() < 0.15) continue;
                const uc = (i + (rr() < 0.5 ? 0.28 : 0.72)) * bw,
                    w = 1.7,
                    steps = 6,
                    rise = 0.24,
                    run = 0.34;
                const t = 0.62 + rr() * 0.2;
                d.setColor([0.42 * t + 0.1, 0.34 * t + 0.08, 0.3 * t + 0.07]);
                for (let k = 0; k < steps; k++) {
                    const n1 = (steps - k) * run,
                        y1 = G_CURB + (k + 1) * rise;
                    d.box(
                        uc - w / 2,
                        G_CURB - 0.05,
                        0,
                        uc + w / 2,
                        y1,
                        n1,
                        0b111111,
                    );
                    S.box(
                        ...frameAABB(
                            fr,
                            uc - w / 2,
                            G_CURB - 0.05,
                            0,
                            uc + w / 2,
                            y1,
                            n1,
                        ),
                        "wall",
                    );
                }

                d.setColor([0.05, 0.05, 0.05]);
                for (const e of [-1, 1]) {
                    const u = uc + e * (w / 2 - 0.04);
                    d.box(
                        u - 0.03,
                        G_CURB + steps * rise,
                        0.1,
                        u + 0.03,
                        G_CURB + steps * rise + 0.9,
                        0.16,
                        0b111111,
                    );
                    d.box(
                        u - 0.03,
                        G_CURB + rise,
                        steps * run - 0.1,
                        u + 0.03,
                        G_CURB + rise + 0.9,
                        steps * run - 0.04,
                        0b111111,
                    );
                }
            }
        });
        return;
    }
    if ((A.type !== "apt" && A.type !== "postwar") || fr.W < 14 || A.gH < 3.5)
        return;
    if (s !== A.doorSide) return;
    const uc = fr.W * (0.35 + rr() * 0.3),
        dw = 1.6 + rr() * 0.5;
    const top = Math.min(A.gH - 0.7, 3.4);
    D.setPart(DP.CONC).setColor(A.beltTint ?? 0xc9c1b0);
    D.with(frameMatrix(fr), (d) => {
        d.box(
            uc - dw / 2 - 0.55,
            G_CURB,
            0,
            uc - dw / 2,
            top + 0.5,
            0.22,
            0b111111,
        );
        d.box(
            uc + dw / 2,
            G_CURB,
            0,
            uc + dw / 2 + 0.55,
            top + 0.5,
            0.22,
            0b111111,
        );
        d.box(
            uc - dw / 2 - 0.7,
            top + 0.5,
            0,
            uc + dw / 2 + 0.7,
            top + 1.0,
            0.3,
            0b111111,
        );
        S.box(
            ...frameAABB(
                fr,
                uc - dw / 2 - 0.7,
                G_CURB,
                0,
                uc + dw / 2 + 0.7,
                top + 1.0,
                0.3,
            ),
            "wall",
        );
        d.setColor(0x14120f).box(
            uc - dw / 2,
            G_CURB,
            0.0,
            uc + dw / 2,
            top + 0.45,
            0.05,
            0b111111,
        );

        const out = 2.6 + rr() * 0.6,
            cw = dw + 0.9,
            y1 = Math.max(2.9, top - 0.1),
            y0 = y1 - 0.34;
        d.setColor(CANOPY[Math.floor(rr() * CANOPY.length)]);
        d.box(uc - cw / 2, y0, 0.3, uc + cw / 2, y1, out, 0b111111);
        S.box(
            ...frameAABB(fr, uc - cw / 2, y0, 0.3, uc + cw / 2, y1, out),
            "awning",
        );
        d.setColor([0.55, 0.45, 0.22]);
        for (const e of [-1, 1]) {
            const u = uc + e * (cw / 2 - 0.08),
                n = out - 0.1;
            d.box(
                u - 0.035,
                G_CURB,
                n - 0.035,
                u + 0.035,
                y0,
                n + 0.035,
                0b111111,
            );
            S.box(
                ...frameAABB(
                    fr,
                    u - 0.035,
                    G_CURB,
                    n - 0.035,
                    u + 0.035,
                    y0,
                    n + 0.035,
                ),
                "pole",
            );
        }
    });
}

const f32 = Math.fround,
    frc = (x) => x - Math.floor(x);
function pairing(p, A, m, bw, ww, fh) {
    const style = p.style ?? A.style,
        Lw = p.layer ?? A.layer ?? 0,
        seed = f32(p.seed ?? A.seed ?? 0),
        gH = A.gH;
    if (!(style < 1.5 && Lw < 3.5) || !(bw > 2.15)) return null;
    const zH = (a, b) => frc(f32(f32(seed * f32(a)) + f32(b)));
    const zH1 = zH(2.37, 0.11),
        zH2 = zH(4.73, 0.59),
        zH4 = zH(1.61, 0.83);
    if (!(zH4 < 0.42)) return null;
    const topY = m.y1 + (m.parapet ?? 0),
        zNf = Math.floor((topY - gH) / fh + 0.01);
    const zBase = zNf >= 5 ? 1 + (zH1 >= 0.55 && zNf >= 9 ? 1 : 0) : 0,
        zCap = zNf >= 6 ? 1 + (zH2 >= 0.6 && zNf >= 11 ? 1 : 0) : 0;
    const hb = bw / 2,
        w2 = Math.min(hb * 0.8, ww * 0.62);

    return {
        w2,
        at: (fl, left) =>
            fl < zBase || (zCap > 0 && fl >= zNf - zCap)
                ? null
                : left
                  ? hb - 0.09 - w2 / 2
                  : hb + 0.09 + w2 / 2,
    };
}
function windowACs({ D, S, fr, m, s, A, DP, frameMatrix, frameAABB }) {
    const p = m.p || {};
    const fh = p.floorH ?? A.floorH,
        margin = p.margin ?? 0.6,
        usable = fr.W - 2 * margin;
    if (usable < 2 || !A.acRate) return;
    const nb = Math.max(1, Math.floor(usable / (p.bayW ?? A.bayW) + 0.5)),
        bw = usable / nb;
    const ww = bw * (p.winW ?? A.winW),
        wh = fh * (p.winH ?? A.winH),
        wy0 = (fh - wh) * 0.42;
    const top = m.y1 + (m.parapet ?? 0) - 1.2;
    const fe = A.fireEscape && (s === "nz" || s === "pz") && fr.W > 7;
    let h =
        (Math.imul(((A.seed ?? 1) * 1000) | 0, 2654435761) ^
            Math.imul(s.charCodeAt(1), 40503)) >>>
        0;
    const rr = () => {
        h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
        return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
    };
    const aw0 = Math.min(0.68, ww * 0.82);
    const pr = pairing(p, A, m, bw, ww, fh);
    D.setPart(DP.PAINT);
    D.with(frameMatrix(fr), (d) => {
        for (let fl = 0; ; fl++) {
            const y0 = A.gH + fl * fh + wy0 + 0.03;
            if (A.gH + (fl + 1) * fh > top) break;
            for (let i = 0; i < nb; i++) {
                if (rr() > A.acRate) continue;
                let uc = margin + (i + 0.5) * bw,
                    wwi = ww,
                    aw1 = aw0;
                if (pr) {
                    const c = pr.at(fl, rr() < 0.5);
                    if (c === null) {
                        rr();
                    } else {
                        uc = margin + i * bw + c;
                        wwi = pr.w2;
                        aw1 = Math.min(aw0, pr.w2 * 0.9);
                    }
                }
                if (fe && Math.abs(uc - fr.W / 2) < 3.1) continue;

                const aw = aw1 * (0.78 + rr() * 0.3),
                    ah = 0.34 + rr() * 0.14,
                    dep = 0.3 + rr() * 0.2,
                    du = (rr() - 0.5) * Math.max(0, wwi - aw) * 0.9;
                const u0 = uc + du - aw / 2,
                    u1 = uc + du + aw / 2;
                d.setColor(AC_COL[Math.floor(rr() * AC_COL.length)]);
                d.box(u0, y0, 0.0, u1, y0 + ah, dep, 0b111111);
                d.setColor(0x2a2a2a).box(
                    u0 + 0.05,
                    y0 + 0.06,
                    dep,
                    u1 - 0.05,
                    y0 + ah - 0.08,
                    dep + 0.01,
                    0b111111,
                );
                S.box(
                    ...frameAABB(fr, u0, y0, 0, u1, y0 + ah, dep + 0.01),
                    "equipment",
                );
            }
        }
    });
}
