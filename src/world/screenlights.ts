// @ts-nocheck
/**
 * Manages emissive screen lighting state and shader uniforms.
 *
 * @module world-screenlights
 * @version 1.0.0
 * @file src/world/screenlights.ts
 * @since 0.0.1
 * @description Provides screen light sets, brightness controls, and shader helpers for illuminated displays and billboards.
 */
import * as THREE from "three";
import { cityLights } from "@/render/citylights.ts";
import { nightK, screenK } from "@/render/daynight.ts";
import { adsGrid } from "./adstex.ts";

export const SL = {
    gain: 1.0,
    sat: 2.0,
    minL: 0.06,
    mergeA: 40,
    mergeGap: 5.0,
    mergeMax: 26,
    volume: 0.28,
    point: 1.0,
    split: 10,
    halo: 0.3,
    printed: 0.8,
    lodNear: 45,
    tileMin: 3,
};
const all = [];
export function refreshScreenLights() {
    for (const e of all) {
        if (e.sync) e.sync();
        else if (e.col)
            cityLights.update(e.id, { color: e.col(), intensity: e.I() });
        else cityLights.update(e.id, { intensity: e.I() });
    }
}
if (typeof window !== "undefined")
    window.__screenLights = { SL, refresh: refreshScreenLights, all };

const _c = new THREE.Color();

const lightDrive = (m) =>
    (1.5 * Math.max(m, SL.minL)) / (1 + Math.max(m, SL.minL));
function lightColour(avg) {
    const l = 0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2];
    const r = Math.max(0, l + (avg[0] - l) * SL.sat),
        g = Math.max(0, l + (avg[1] - l) * SL.sat),
        b = Math.max(0, l + (avg[2] - l) * SL.sat);
    const m = Math.max(r, g, b, 1e-4);
    return { rgb: [r / m, g / m, b / m], lum: l, m };
}

export function screenLightSet() {
    const rects = [],
        points = [],
        halos = [];
    return {
        rects,
        points,
        halos,
        rect(c, n, u, w, h, avg, k = 1, o = {}) {
            if ((avg || o.uv) && w > 0.3 && h > 0.3)
                rects.push({
                    c: [...c],
                    n: [...n],
                    u: [...u],
                    w,
                    h,
                    avg: avg ? [...avg] : null,
                    k,
                    uv: o.uv ? [o.uv[0], o.uv[1], o.uv[2], o.uv[3]] : null,
                    pr: !!o.printed,
                    range: o.range,
                    whole: !!o.whole,
                    gain: o.gain ?? 1,
                });
        },
        point(p, col, I, range = 8, volume = 0.2) {
            points.push({ p: [...p], col, I, range, volume });
        },

        halo(c, n, u, w, h, avg) {
            if (avg)
                halos.push({
                    c: [...c],
                    n: [...n],
                    u: [...u],
                    w,
                    h,
                    avg: [...avg],
                });
        },
        commit(tag = "", opt = {}) {
            const st = {
                tag,
                panels: rects.length,
                emitters: 0,
                halos: halos.length,
                points: points.length,
                pending: true,
            };
            if (typeof window !== "undefined")
                (window.__screenLightStats ??= []).push(st);
            const need = rects.some((r) => r.uv);
            const go = (G) => {
                try {
                    register(G, tag, opt, st);
                } catch (e) {
                    console.warn("[screenlights]", tag, e);
                }
                st.pending = false;
            };
            if (need) (opt.grid ?? adsGrid()).then(go, () => go(null));
            else go(null);
            return st;
        },
    };
    function register(G, tag, opt, st) {
        const mA = opt.mergeA ?? SL.mergeA,
            mG = opt.mergeGap ?? SL.mergeGap,
            mM = opt.mergeMax ?? SL.mergeMax;
        for (const r of rects) {
            const a = r.uv && G ? regionAvg(G, r.uv, 0, 1, 0, 1) : null;
            if (a) r.avg = a;
            else if (!r.avg) r.avg = [0.15, 0.15, 0.15];
        }

        const small = rects.filter((r) => r.w * r.h < mA),
            big = rects.filter((r) => r.w * r.h >= mA);
        const groups = [];
        for (const r of small) {
            const t = r.c[0] * r.u[0] + r.c[2] * r.u[2],
                d = r.c[0] * r.n[0] + r.c[2] * r.n[2];
            let g = null;
            for (const G of groups) {
                if (
                    G.n[0] !== r.n[0] ||
                    G.n[2] !== r.n[2] ||
                    Math.abs(G.d - d) > 2.0
                )
                    continue;
                const t0 = Math.min(G.t0, t - r.w / 2),
                    t1 = Math.max(G.t1, t + r.w / 2),
                    y0 = Math.min(G.y0, r.c[1] - r.h / 2),
                    y1 = Math.max(G.y1, r.c[1] + r.h / 2);
                const gapT = Math.max(G.t0 - (t + r.w / 2), t - r.w / 2 - G.t1),
                    gapY = Math.max(
                        G.y0 - (r.c[1] + r.h / 2),
                        r.c[1] - r.h / 2 - G.y1,
                    );
                if (gapT > mG || gapY > mG || t1 - t0 > mM || y1 - y0 > mM)
                    continue;
                g = G;
                Object.assign(G, { t0, t1, y0, y1 });
                break;
            }
            if (!g)
                groups.push(
                    (g = {
                        n: r.n,
                        u: r.u,
                        d,
                        t0: t - r.w / 2,
                        t1: t + r.w / 2,
                        y0: r.c[1] - r.h / 2,
                        y1: r.c[1] + r.h / 2,
                        list: [],
                    }),
                );
            g.list.push(r);
        }

        const out = [],
            bl = [];
        const tiles = (r) => {
            let nu = Math.max(1, Math.ceil(r.w / SL.split - 0.15)),
                nv = Math.max(1, Math.ceil(r.h / SL.split - 0.15));
            if (r.uv && G && !r.whole) {
                if (r.w >= SL.tileMin && r.w >= 0.6 * r.h) nu = Math.max(nu, 2);
                if (r.h >= SL.tileMin && r.h >= 0.6 * r.w) nv = Math.max(nv, 2);
            }
            const tw = r.w / nu,
                th = r.h / nv;
            for (let i = 0; i < nu; i++)
                for (let j = 0; j < nv; j++) {
                    const du = (i + 0.5) * tw - r.w / 2,
                        dv = (j + 0.5) * th - r.h / 2;
                    const t = {
                        ...r,
                        c: [
                            r.c[0] + r.u[0] * du,
                            r.c[1] + dv,
                            r.c[2] + r.u[2] * du,
                        ],
                        w: tw,
                        h: th,
                    };
                    if (r.uv && G && !r.whole)
                        t.avg =
                            regionAvg(
                                G,
                                r.uv,
                                i / nu,
                                (i + 1) / nu,
                                j / nv,
                                (j + 1) / nv,
                            ) ?? r.avg;
                    t.list = [t];
                    out.push(t);
                    T.push(t);
                }
            if (T.length === 1) {
                out.pop();
                T.length = 0;
            }
            const W = { ...r, list: [r] };
            out.push(W);
            bl.push({ whole: W, tiles: T.length > 1 ? T : null, T });
        };
        let T;
        const tilesB = (r) => {
            T = [];
            tiles(r);
        };
        for (const r of big) tilesB(r);
        for (const Q of groups) {
            if (Q.list.length === 1) {
                tilesB(Q.list[0]);
                continue;
            }
            const w = Q.t1 - Q.t0,
                h = Q.y1 - Q.y0,
                tc = (Q.t0 + Q.t1) / 2,
                dd =
                    Q.list.reduce(
                        (a, r) => a + r.c[0] * r.n[0] + r.c[2] * r.n[2],
                        0,
                    ) / Q.list.length;

            const W = {
                c: [
                    Q.n[0] * dd + Q.u[0] * tc,
                    (Q.y0 + Q.y1) / 2,
                    Q.n[2] * dd + Q.u[2] * tc,
                ],
                n: Q.n,
                u: Q.u,
                w,
                h,
                list: Q.list,
                pr: Q.list.every((r) => r.pr),
            };
            out.push(W);
            bl.push({ whole: W, tiles: null });
        }

        for (const E of out) {
            let fr = 0,
                fg = 0,
                fb = 0;
            for (const r of E.list) {
                const a = r.w * r.h * r.k;
                fr += r.avg[0] * a;
                fg += r.avg[1] * a;
                fb += r.avg[2] * a;
            }
            const A = E.w * E.h,
                avg = [fr / A, fg / A, fb / A];
            const e = {
                kind: "rect",
                avg,
                c: E.c,
                n: E.n,
                w: E.w,
                h: E.h,
                tag,
                pr: !!E.pr,
                g: E.gain ?? 1,
            };
            e.col = () => {
                const q = lightColour(e.avg);
                return _c
                    .setRGB(
                        q.rgb[0],
                        q.rgb[1],
                        q.rgb[2],
                        THREE.LinearSRGBColorSpace,
                    )
                    .clone();
            };
            e.I = () => {
                const q = lightColour(e.avg);
                return (
                    SL.gain * e.g * lightDrive(q.m) * (e.pr ? SL.printed : 1)
                );
            };
            const size = Math.sqrt(A);
            const range =
                E.range ??
                Math.min(
                    60,
                    Math.max(E.pr ? 12 : 18, size * (E.pr ? 3.5 : 4.5)),
                );

            e.rec = {
                type: "rect",
                pos: E.c,
                dir: E.n,
                u: E.u,
                width: E.w,
                height: E.h,
                color: new THREE.Color(),
                intensity: 1,
                range,
                radius: Math.min(E.w, E.h) / 2,
                volume: SL.volume,
            };
            e.sync = () => {
                e.rec.color.copy(e.col()).multiplyScalar(e.I());
            };
            e.sync();
            E.e = e;
            all.push(e);
        }
        for (const b of bl) {
            const W = b.whole.e,
                sz = Math.max(W.w, W.h);
            boards.push({
                x: W.c[0],
                z: W.c[2],
                R: W.rec.range + sz,
                lod: SL.lodNear + sz,
                far: W.pr ? 160 : 70 + 5 * (W.rec.range + sz),
                /* (night r10) printed boards: not from aerial distances (their big-rect GGX glint in facing glass read as a white flare, sc_r10_aerial) */ whole: W.rec,
                tiles: b.tiles ? b.tiles.map((t) => t.e.rec) : null,
            });
        }
        for (const H of halos) {
            const e = {
                kind: "rect",
                avg: H.avg,
                c: H.c,
                n: H.n,
                w: H.w,
                h: H.h,
                tag: tag + "Halo",
            };
            e.col = () => {
                const q = lightColour(e.avg);
                return _c
                    .setRGB(
                        q.rgb[0],
                        q.rgb[1],
                        q.rgb[2],
                        THREE.LinearSRGBColorSpace,
                    )
                    .clone();
            };
            e.I = () => {
                const q = lightColour(e.avg);
                return SL.gain * SL.halo * lightDrive(q.m) * H.w * H.h;
            };
            e.id = cityLights.add({
                type: "point",
                pos: H.c,
                color: e.col(),
                intensity: e.I(),
                range: Math.min(22, 3 + 0.8 * Math.max(H.w, H.h)),
                radius: 0.3 * Math.min(H.w, H.h),
                volume: 0,
            });
            all.push(e);
        }
        for (const P of points) {
            const e = { kind: "point", I: () => P.I * SL.point };
            e.id = cityLights.add({
                type: "point",
                pos: P.p,
                color: P.col,
                intensity: e.I(),
                range: P.range,
                radius: 0.3,
                volume: P.volume,
            });
            all.push(e);
        }
        st.emitters = out.length;
        st.boards = bl.length;
    }
}

const boards = [];
cityLights.addProvider((emit, camera) => {
    if (nightK.value < 0.01 || !boards.length) return;
    const cx = camera.position.x,
        cz = camera.position.z,
        W = 256;
    let n = 0;
    for (let i = 0; i < boards.length; i++) {
        const b = boards[i],
            dx = b.x - cx,
            dz = b.z - cz;
        if (Math.abs(dx) > W + b.R || Math.abs(dz) > W + b.R) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 > b.far * b.far) continue;
        if (b.tiles && d2 < b.lod * b.lod) {
            for (let k = 0; k < b.tiles.length; k++) emit(b.tiles[k]);
            n += b.tiles.length;
        } else {
            emit(b.whole);
            n++;
        }
    }
    SL.emitted = n;
});

export function regionAvg(G, uv, fx0, fx1, fy0, fy1) {
    const ua = uv[0] + (uv[2] - uv[0]) * fx0,
        ub = uv[0] + (uv[2] - uv[0]) * fx1,
        va = uv[1] + (uv[3] - uv[1]) * fy0,
        vb = uv[1] + (uv[3] - uv[1]) * fy1;
    const x0 = Math.max(0, Math.floor(Math.min(ua, ub) * G.W)),
        x1 = Math.min(
            G.W,
            Math.max(x0 + 1, Math.round(Math.max(ua, ub) * G.W)),
        );
    const y0 = Math.max(0, Math.floor((1 - Math.max(va, vb)) * G.H)),
        y1 = Math.min(
            G.H,
            Math.max(y0 + 1, Math.round((1 - Math.min(va, vb)) * G.H)),
        );
    let r = 0,
        g = 0,
        b = 0,
        n = 0;
    for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
            const k = (y * G.W + x) * 3;
            r += G.d[k];
            g += G.d[k + 1];
            b += G.d[k + 2];
            n++;
        }
    return n ? [r / n, g / n, b / n] : null;
}

export const uScrBoost = { value: 2.0 },
    uScrDesat = { value: -0.18 };
export const scrUniforms = () => ({
    uScreenK: screenK,
    uNightK: nightK,
    uScrBoost,
    uScrDesat,
    uScrKnee,
    uScrTop,
});
export const SCR_GLSL_PARS =
    "uniform float uScreenK; uniform float uNightK; uniform float uScrBoost; uniform float uScrDesat; uniform float uScrKnee; uniform float uScrTop;";
export const SCR_GAIN_GLSL =
    "( uScreenK * ( 1.0 + ( uScrBoost - 1.0 ) * uNightK ) )";

export const uScrKnee = { value: 0.28 },
    uScrTop = { value: 0.46 };
if (typeof window !== "undefined")
    Object.assign(window.__screenLights, { uScrBoost, uScrKnee, uScrTop });
export const SCR_SHOULDER_GLSL = `if ( uNightK > 0.0 ) {
  float scrN = max( max( emissive.r, emissive.g ), emissive.b ) * ${SCR_GAIN_GLSL} + 1e-4;
  float scrM = max( max( totalEmissiveRadiance.r, totalEmissiveRadiance.g ), totalEmissiveRadiance.b ) / scrN;
  if ( scrM > uScrKnee ) { float scrW = uScrTop - uScrKnee; float scrY = uScrKnee + scrW * ( 1.0 - exp( - ( scrM - uScrKnee ) / scrW ) );
    totalEmissiveRadiance *= mix( 1.0, scrY / scrM, uNightK ); } }`;

export function screenNightMat(m, key) {
    m.userData.nightGain = 1;
    const obc = m.onBeforeCompile;
    m.onBeforeCompile = function (sh, r) {
        if (obc && obc !== THREE.Material.prototype.onBeforeCompile)
            obc.call(this, sh, r);
        Object.assign(sh.uniforms, scrUniforms());
        sh.fragmentShader = sh.fragmentShader
            .replace("#include <common>", "#include <common>\n" + SCR_GLSL_PARS)
            .replace(
                "#include <lights_fragment_begin>",
                `totalEmissiveRadiance *= ${SCR_GAIN_GLSL}; // (night)\n${SCR_SHOULDER_GLSL}\n#include <lights_fragment_begin>`,
            );
    };
    const ck = m.customProgramCacheKey;
    m.customProgramCacheKey = function () {
        return (ck ? ck.call(this) : "") + "|scrNight|" + key;
    };
    return m;
}
