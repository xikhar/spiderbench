// OWNER: neon agent. (night) Exterior neon + LED lighting on the city's places: neon tube frames around shop windows,
// script / block neon words and icons hung in the windows (bars, pizza, diners, liquor stores, clubs, hotels ...), neon
// borders on awning valances, LED strips under the shop fascias and awnings, LED perimeter strips under entrance
// canopies and accent strips over modern tower lobbies. Every sign / strip is a REAL light (render/citylights.js): one
// small coloured point (signs) or a down-facing rect (strips) that tints the wall, sidewalk, awning underside, people and
// cars around it (and mirrors in wet asphalt).
//
//   buildNeon({ scene, solids }) -> { stats, tubes, words }
//   Call after buildSignage / buildProps (awning + canopy solids exist). Placement data:
//     facade.js SHOP_FRONTS (every storefront frontage; same bay split + open / shuttered / closed hash as the shader)
//     collision solids of kind 'awning' (valances: thin boxes next to a sloped ramp; canopies: flat boxes)
//
// Draw calls: 2. Tubes (+ LED strips) are ONE instanced rectangle-frame tube mesh (lit glass by day, emissive at night;
// each instance is a rectangle / line in any plane, sides masked per instance, the radius widened to ~0.6 px with
// distance so thin tubes never shimmer); words / icons are ONE additive instanced quad mesh on a baked atlas
// (public/assets/city/tex/neon_words.webp, tools/imagegen/neon/pack.py), drawn only at night (nightOnly).
// Tunables: window.__neon (NEON.gain, NEON.word, NEON.light ...; neon lights: __neon.relight()). ?noneon disables.
import * as THREE from "three";
import * as LAY from "./layout.js";
import { SHOP_FRONTS } from "./facade.js";
import { cityLights } from "../render/citylights.js";
import { nightK, dnTime, screenK, nightOnly } from "../render/daynight.js";

const { district, mulberry32 } = LAY;
const Q =
    typeof location !== "undefined"
        ? new URLSearchParams(location.search)
        : new URLSearchParams();

export const NEON = {
    gain: 7.0, // tube / word core radiance at night (x screenK: the night exposure compensation)
    word: 3.0, // words relative to tubes
    glow: 0.16, // word atlas halo (G channel) relative to the core
    led: 0.8, // LED strips relative to neon
    light: 5.0, // sign point light intensity (irradiance at 1 m)
    ledLight: 3.2, // strip rect radiance
    range: 5.5, // sign light range (m; small: the light grid's CPU binning cost grows with the cells each light covers)
    day: 0.22, // unlit glass albedo by day
};

// atlas cells (tools/imagegen/neon/pack.py): tight bbox aspect of each cell
const ASPECT = [
    2.37, 2.35, 3.2, 5.17, 3.57, 3.55, 2.94, 3.57, 3.16, 4.93, 3.2, 3.79, 6.75,
    4.67, 2.36, 3.04, 4.67, 10.86, 10.44, 8.86, 4.68, 5.74, 3.59, 4.96, 1, 1, 1,
    1, 1, 1, 1, 1,
]; // icons: square cells
const W_ = {
    Open: 0,
    Bar: 1,
    Pizza: 2,
    Cocktails: 3,
    Diner: 4,
    Liquors: 5,
    Beer: 6,
    Lounge: 7,
    Sushi: 8,
    Karaoke: 9,
    Hotel: 10,
    Tattoo: 11,
    LiveMusic: 12,
    Noodles: 13,
    Deli: 14,
    Wine: 15,
    OPEN: 16,
    OPEN24: 17,
    BARGRILL: 18,
    COCKTAILS: 19,
    PIZZA: 20,
    HOTEL: 21,
    Hudson: 22,
    Kessler: 23,
    martini: 24,
    mug: 25,
    slice: 26,
    arrow: 27,
    coffee: 28,
    heart: 29,
    star: 30,
    notes: 31,
};
// neon colours (sRGB): pink / magenta, cyan, red, blue, green, amber, violet, warm / cool white (LED)
const C = {
    pink: 0xff2f8e,
    magenta: 0xe636ff,
    cyan: 0x23d8ff,
    red: 0xff2a1c,
    blue: 0x2f55ff,
    green: 0x2cff62,
    amber: 0xffa21e,
    violet: 0x8f3cff,
    orange: 0xff6a18,
    warm: 0xffd2a0,
    cool: 0xdce8ff,
    gold: 0xffc46a,
};
// venues: main words, icons, palette, weight, frame chance
const VENUES = [
    {
        k: "bar",
        w: 0.22,
        words: [
            "Bar",
            "Cocktails",
            "Beer",
            "Lounge",
            "BARGRILL",
            "COCKTAILS",
            "Hudson",
            "Kessler",
        ],
        icons: ["martini", "mug", "arrow"],
        pal: ["pink", "blue", "red", "violet", "amber", "cyan"],
        frame: 0.6,
    },
    {
        k: "food",
        w: 0.15,
        words: ["Sushi", "Noodles", "Deli", "OPEN"],
        icons: ["arrow", "heart"],
        pal: ["red", "amber", "cyan", "pink", "green"],
        frame: 0.4,
    },
    {
        k: "pizza",
        w: 0.1,
        words: ["Pizza", "PIZZA"],
        icons: ["slice"],
        pal: ["red", "green", "amber", "orange"],
        frame: 0.45,
    },
    {
        k: "diner",
        w: 0.07,
        words: ["Diner", "OPEN24"],
        icons: ["coffee", "arrow"],
        pal: ["red", "cyan", "pink", "blue"],
        frame: 0.65,
    },
    {
        k: "liquor",
        w: 0.08,
        words: ["Liquors", "Wine", "Beer"],
        icons: ["martini", "star"],
        pal: ["red", "green", "amber", "blue"],
        frame: 0.4,
    },
    {
        k: "club",
        w: 0.07,
        words: ["Karaoke", "LiveMusic", "Lounge"],
        icons: ["notes", "star", "heart"],
        pal: ["violet", "magenta", "cyan", "blue", "pink"],
        frame: 0.7,
    },
    {
        k: "tattoo",
        w: 0.04,
        words: ["Tattoo"],
        icons: ["heart", "star"],
        pal: ["red", "cyan", "violet"],
        frame: 0.5,
    },
    {
        k: "hotel",
        w: 0.04,
        words: ["Hotel", "HOTEL"],
        icons: ["star"],
        pal: ["red", "amber", "blue"],
        frame: 0.35,
    },
    {
        k: "cafe",
        w: 0.07,
        words: ["Open", "OPEN"],
        icons: ["coffee", "heart"],
        pal: ["amber", "pink", "cyan", "warm"],
        frame: 0.3,
    },
    {
        k: "shop",
        w: 0.16,
        words: [],
        icons: [],
        pal: ["red", "blue", "cyan", "pink"],
        frame: 0.25,
    },
];
const VW = VENUES.reduce((s, v) => s + v.w, 0);

// the facade shader's per-bay hash (same float32 maths as facade.js registerShop / fh1)
const f32 = Math.fround,
    fr = (x) => f32(x - Math.floor(x));
function fh1(x, y) {
    let px = fr(f32(f32(x) * f32(123.34))),
        py = fr(f32(f32(y) * f32(456.21)));
    const d = f32(
        f32(px * f32(px + f32(45.32))) + f32(py * f32(py + f32(45.32))),
    );
    px = f32(px + d);
    py = f32(py + d);
    return fr(f32(px * py));
}
const _c = new THREE.Color();
const lin = (hex) => {
    _c.set(hex);
    return [_c.r, _c.g, _c.b];
}; // linear rgb (ColorManagement converts sRGB hex)
const norm = (c) => {
    const m = Math.max(c[0], c[1], c[2], 1e-4);
    return [c[0] / m, c[1] / m, c[2] / m];
};

// ------------------------------------------------------------------------------------------------ tube mesh
const RAD = 4; // radial segments (smooth normals: reads round at 1.5 cm)
function frameGeometry() {
    // 4 sides (0 bottom, 1 right, 2 top, 3 left) x 2 rings x RAD: aS = (side, t, cos, sin)
    const aS = [],
        idx = [];
    for (let s = 0; s < 4; s++) {
        const b = aS.length / 4;
        for (let t = 0; t < 2; t++)
            for (let k = 0; k < RAD; k++) {
                const a = ((k + 0.5) / RAD) * Math.PI * 2;
                aS.push(s, t, Math.cos(a), Math.sin(a));
            }
        for (let k = 0; k < RAD; k++) {
            const k1 = (k + 1) % RAD;
            idx.push(
                b + k,
                b + k1,
                b + RAD + k,
                b + k1,
                b + RAD + k1,
                b + RAD + k,
            );
        }
    }
    const g = new THREE.InstancedBufferGeometry();
    const n = aS.length / 4;
    g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3),
    ); // unused (computed in the shader)
    g.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3),
    );
    g.setAttribute("aS", new THREE.Float32BufferAttribute(aS, 4));
    g.setIndex(idx);
    return g;
}
function tubeMaterial() {
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.22,
        metalness: 0,
        side: THREE.DoubleSide,
    });
    const uni = {
        uNeonK: nightK,
        uNeonT: dnTime,
        uNeonS: screenK,
        uNeon: { value: new THREE.Vector4() },
    };
    mat.userData.uni = uni;
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uni);
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
      attribute vec4 aS; attribute vec3 iO; attribute vec3 iT; attribute vec3 iV; attribute vec4 iD; attribute vec4 iC;
      varying vec4 vNeonC; varying float vNeonDim; vec3 neonPos;`,
            )
            .replace(
                "#include <beginnormal_vertex>",
                `
      int nSide = int(aS.x + 0.5);
      float nW = iD.x, nH = iD.y, nR = iD.z; int nMask = int(iD.w + 0.5);
      vec3 nT = iT, nV = iV, nN = normalize(cross(iT, iV));
      float nDist = length(iO + nT * nW * 0.5 + nV * nH * 0.5 - cameraPosition);
      float nRe = max(nR, nDist * 0.00062); // ~0.6 px at 1080p / 55 deg: no sub-pixel shimmer, energy kept below
      vNeonDim = nR / nRe;
      vNeonC = iC;
      vec2 p0 = nSide == 0 ? vec2(0.0) : nSide == 1 ? vec2(nW, 0.0) : nSide == 2 ? vec2(nW, nH) : vec2(0.0, nH);
      vec2 dr = nSide == 0 ? vec2(1.0, 0.0) : nSide == 1 ? vec2(0.0, 1.0) : nSide == 2 ? vec2(-1.0, 0.0) : vec2(0.0, -1.0);
      float nLen = (nSide == 0 || nSide == 2) ? nW : nH;
      float nS = mix(-nRe, nLen + nRe, aS.y);                            // run past the corners: closed joints / end caps
      vec3 nAx = nT * dr.x + nV * dr.y, nPerp = nT * abs(dr.y) + nV * abs(dr.x);
      float nFlat = iC.w >= 1.0 ? 0.35 : 1.0;                               // LED strips: a flat ribbon
      vec3 objectNormal = normalize(nPerp * aS.z + nN * aS.w);
      neonPos = iO + nT * p0.x + nV * p0.y + nAx * nS + (nPerp * aS.z * nFlat + nN * aS.w) * nRe;
      if (((nMask >> nSide) & 1) == 0 || nDist > 700.0) neonPos = iO;       // masked side / far: degenerate
      #ifdef USE_TANGENT
      vec3 objectTangent = vec3(tangent.xyz);
      #endif`,
            )
            .replace("#include <begin_vertex>", "vec3 transformed = neonPos;");
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      varying vec4 vNeonC; varying float vNeonDim; uniform float uNeonK, uNeonT, uNeonS; uniform vec4 uNeon;`,
            )
            .replace(
                "#include <color_fragment>",
                `#include <color_fragment>
      diffuseColor.rgb = mix(vec3(0.55), vNeonC.rgb, 0.35) * uNeon.z; // unlit glass tube (pale tint) by day`,
            )
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>
      if (uNeonK > 0.0) {
        float led = step(1.0, vNeonC.w), seed = fract(vNeonC.w);
        float face = abs(dot(normalize(normal), normalize(vViewPosition)));
        vec3 col = vNeonC.rgb;
        // bright saturated core, dimmer + deeper colour toward the tube's silhouette; LED ribbons flat and even
        vec3 e = col * mix(mix(0.4, 1.0, pow(face, 1.5)), 0.85, led);
        e = mix(e, vec3(max(max(col.r, col.g), col.b)), 0.18 * pow(face, 6.0) * (1.0 - led));
        float fl = 1.0;
        if (seed < 0.034 && led < 0.5) { // ~1 in 30 tubes buzz: brief dips, cheap hash of time
          float h = fract(sin(floor(uNeonT * 13.0 + seed * 977.0) * 12.9898) * 43758.5453);
          fl = h > 0.82 ? 0.25 + 0.5 * h * h : 1.0;
        }
        totalEmissiveRadiance += e * uNeon.x * mix(1.0, uNeon.y, led) * uNeonS * uNeonK * vNeonDim * fl;
      }`,
            );
    };
    mat.customProgramCacheKey = () => "neon-tubes-1";
    return mat;
}

// ------------------------------------------------------------------------------------------------ word mesh
function wordMaterial() {
    const tex = new THREE.TextureLoader().load(
        "/assets/city/tex/neon_words.webp",
    );
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = 4;
    const uni = {
        uNeonK: nightK,
        uNeonT: dnTime,
        uNeonS: screenK,
        uNeonTex: { value: tex },
        uNeonW: { value: new THREE.Vector4() },
    };
    // additive colour, destination alpha kept: the HDR target's alpha carries the SSR weight (render/surface.js); plain
    // additive blending raised it under the words and the shop glass there turned into a sky mirror
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        fog: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor,
    });
    mat.userData.uni = uni;
    mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uni);
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
      attribute vec3 iO; attribute vec3 iT; attribute vec4 iD; attribute vec4 iC; varying vec2 vNeonUv, vNeonQ; varying vec4 vNeonC; varying float vNeonDim;`,
            )
            .replace(
                "#include <begin_vertex>",
                `
      vec3 nN = vec3(-iT.z, 0.0, iT.x);
      vec3 transformed = iO + iT * position.x * iD.x + vec3(0.0, 1.0, 0.0) * position.y * iD.y;
      float cell = iD.z, asp = iD.x / iD.y;
      // the cell holds the item centred at its own aspect (90 % x 78 % of 512 x 256): map the quad onto that box
      float ca = ${((0.9 * 512) / (0.78 * 256)).toFixed(4)};
      vec2 sz = asp > ca ? vec2(0.9, 0.9 / asp * 2.0) : vec2(0.78 * asp * 0.5, 0.78);
      if (cell > 23.5) sz = vec2(0.5, 1.0) / 1.12; // icons: drawn in the cell's centre square
      vec2 cuv = 0.5 + position.xy * min(sz * 1.12, vec2(0.995));
      vNeonUv = vec2((mod(cell, 4.0) + cuv.x) / 4.0, 1.0 - (floor(cell / 4.0) + 1.0 - cuv.y) / 8.0);
      vNeonC = iC; vNeonQ = position.xy + 0.5;
      float d = length(iO - cameraPosition);
      vNeonDim = 1.0 - smoothstep(420.0, 600.0, d);
      if (d > 600.0) transformed = iO;`,
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      varying vec2 vNeonUv, vNeonQ; varying vec4 vNeonC; varying float vNeonDim; uniform float uNeonK, uNeonT, uNeonS; uniform sampler2D uNeonTex; uniform vec4 uNeonW;`,
            )
            .replace(
                "#include <map_fragment>",
                `
      vec2 nt = max(texture2D(uNeonTex, vNeonUv).rg - 0.02, 0.0) / 0.98; // webp noise floor
      vec2 eq = min(vNeonQ, 1.0 - vNeonQ); nt.g *= smoothstep(0.0, 0.12, min(eq.x, eq.y * 2.0)); // halo fades out before the quad edge
      float seed = fract(vNeonC.w), fl = 1.0;
      if (seed < 0.034) { float h = fract(sin(floor(uNeonT * 11.0 + seed * 613.0) * 12.9898) * 43758.5453); fl = h > 0.8 ? 0.2 + 0.4 * h : 1.0; }
      vec3 col = vNeonC.rgb;
      vec3 e = col * nt.r + mix(col, vec3(max(max(col.r, col.g), col.b)), 0.25) * nt.r * nt.r * 0.2 + col * nt.g * uNeonW.y;
      diffuseColor.rgb = e * uNeonW.x * uNeonS * uNeonK * fl * vNeonDim;`,
            );
    };
    mat.customProgramCacheKey = () => "neon-words-1";
    return mat;
}

// ------------------------------------------------------------------------------------------------ build
export function buildNeon({ scene, solids }) {
    const stats = {
        fronts: SHOP_FRONTS.length,
        bays: 0,
        open: 0,
        neonBays: 0,
        frames: 0,
        words: 0,
        strips: 0,
        awnings: 0,
        canopies: 0,
        towers: 0,
        lights: 0,
        tubes: 0,
    };
    if (typeof window !== "undefined") window.__neon = { NEON, stats };
    if (Q.has("noneon")) return { stats };
    const tubes = []; // [ox, oy, oz, tx, ty, tz, vx, vy, vz, w, h, r, mask, cr, cg, cb, kind + seed]
    const words = []; // [cx, cy, cz, tx, tz, w, h, cell, cr, cg, cb, seed]
    const lights = []; // cityLights.add descriptions (ids kept for relight)
    const addTube = (o, t, v, w, h, r, mask, col, led, seed) => {
        tubes.push(
            o[0],
            o[1],
            o[2],
            t[0],
            t[1],
            t[2],
            v[0],
            v[1],
            v[2],
            w,
            h,
            r,
            mask,
            col[0],
            col[1],
            col[2],
            (led ? 1 : 0) + Math.min(0.999, seed),
        );
        stats.tubes++;
    };
    const Y = [0, 1, 0];
    const colOf = (name) => norm(lin(C[name]));
    const densAt = (x, z) => {
        const d = district(x, z),
            ts = Math.exp(-Math.hypot(x, z + 160) / 420);
        return {
            d,
            dens: Math.max(
                0,
                Math.min(
                    1.6,
                    0.3 +
                        0.55 * d.midtown +
                        0.35 * d.village +
                        0.9 * ts -
                        0.2 * d.parkEdge -
                        0.15 * d.harlem -
                        0.35 * d.fidi,
                ),
            ),
        };
    };
    const pickVenue = (r) => {
        let q = r() * VW;
        for (const v of VENUES) {
            q -= v.w;
            if (q <= 0) return v;
        }
        return VENUES[0];
    };
    const pick = (a, r) => a[Math.floor(r() * a.length)];
    const at_ = (stats.at = { bay: [], awning: [], canopy: [], tower: [] }); // debug samples: [x, z, nx, nz, what]
    const note = (k, x, z, n, w) => {
        if (at_[k].length < 4000)
            at_[k].push([Math.round(x), Math.round(z), n[0], n[2], w]);
    };

    // ---------------- 1. storefronts: neon in the lit (open) shop windows
    for (const F of SHOP_FRONTS) {
        const { corner, T, N, W, gH, baseY, seed } = F;
        const cx = corner[0] + (T[0] * W) / 2,
            cz = corner[2] + (T[2] * W) / 2;
        const { d, dens } = densAt(cx, cz);
        if (d.id === "park") continue;
        let pBay =
            Math.min(0.6, 0.14 + 0.3 * dens) *
            (F.resid ? 0.45 : 1) *
            (d.upper ? 0.7 : 1);
        const r = mulberry32(
            (Math.floor(cx * 7.3) * 73856093) ^
                (Math.floor(cz * 5.1) * 19349663) ^
                0x4e30,
        );
        const fw = f32(W),
            sd = f32(seed),
            nb = Math.max(1, Math.floor(W / 6.5 + 0.5)),
            bw = W / nb;
        const signY0 = baseY + gH - 1.55,
            glassY0 = baseY + 0.55;
        const at = (u, y, n) => [
            corner[0] + T[0] * u + N[0] * n,
            y,
            corner[2] + T[2] * u + N[2] * n,
        ];
        let prev = null;
        // modern tower lobby: one continuous LED accent line over the ground floor
        if (F.topY > 70 && !F.resid && W > 12 && r() < 0.35 + 0.2 * d.midtown) {
            const col = colOf(
                    pick(["cool", "cool", "warm", "gold", "cyan", "blue"], r),
                ),
                y = baseY + gH - 0.42;
            addTube(
                at(0.3, y, 0.07),
                T,
                Y,
                W - 0.6,
                0,
                0.022,
                1 | 2 | 8,
                col,
                true,
                r(),
            );
            lights.push({
                type: "rect",
                pos: at(W / 2, y - 0.05, 0.25),
                dir: [N[0] * 0.55, -0.83, N[2] * 0.55],
                u: T,
                width: W - 0.6,
                height: 0.2,
                color: col,
                intensity: NEON.ledLight * NEON.led * 0.6,
                range: 7,
                radius: 0.3,
                volume: 0.15,
                _led: 0.6,
            });
            stats.towers++;
            note("tower", cx, cz, N, "");
        }
        for (let i = 0; i < nb; i++) {
            stats.bays++;
            const rnd = fh1(
                f32(i + f32(sd * f32(13.1))),
                f32(f32(sd * f32(7.7)) + fw),
            );
            if (rnd >= 0.78 || fr(f32(rnd * f32(37.1))) < 0.2) {
                prev = null;
                continue;
            } // shuttered / closed for the night: dark
            stats.open++;
            const cont = prev && r() < 0.6;
            if (!cont && r() > pBay) {
                prev = null;
                continue;
            }
            const V = cont ? prev.v : pickVenue(r);
            const main = cont ? prev.main : colOf(pick(V.pal, r)),
                second = cont ? prev.second : colOf(pick(V.pal, r));
            const pw = prev?.word;
            prev = { v: V, main, second, word: cont ? pw : null };
            stats.neonBays++;
            note(
                "bay",
                corner[0] + T[0] * (i + 0.5) * bw,
                corner[2] + T[2] * (i + 0.5) * bw,
                N,
                V.k,
            );
            const u0 = i * bw + 0.35,
                u1 = (i + 1) * bw - 0.35,
                gw = u1 - u0,
                uc = (u0 + u1) / 2;
            const top = signY0 - 0.26,
                gy0 = glassY0 + 0.1;
            if (gw < 1.2 || top - gy0 < 1.2) continue;
            let lightCol = null,
                lightY = (top + gy0) / 2 + 0.3,
                lightI = 0;
            // window outline frame
            if (r() < V.frame) {
                addTube(
                    at(u0 + 0.1, gy0, 0.045),
                    T,
                    Y,
                    gw - 0.2,
                    top - gy0,
                    0.014,
                    15,
                    second,
                    false,
                    r(),
                );
                stats.frames++;
                lightCol = second;
                lightI += 0.6;
            }
            // main word / icon hung in the window (upper half)
            const wl = cont ? V.words.filter((w) => w !== pw) : V.words; // a venue spanning bays never repeats its word
            if (wl.length && r() < (cont ? 0.55 : 0.85)) {
                const wn = pick(wl, r),
                    cell = W_[wn],
                    asp = ASPECT[cell];
                prev.word = wn;
                let w = Math.min(gw * 0.74, 3.0),
                    h = w / asp;
                if (h > 0.9) {
                    h = 0.9;
                    w = h * asp;
                }
                if (h < 0.24) {
                    h = 0.24;
                    w = Math.min(gw * 0.8, h * asp);
                    h = w / asp;
                }
                const y = Math.max(
                    gy0 + 1.25 + h / 2,
                    Math.min(top - 0.18 - h / 2, baseY + 2.5 - h / 2),
                ); // below awning valances (>= 2.63 m) where the glass allows
                let wu = uc;
                const icon =
                    V.icons.length && r() < 0.35 && gw > w + 1.0
                        ? W_[pick(V.icons, r)]
                        : -1;
                if (icon >= 0) wu -= 0.35;
                words.push(
                    ...at(wu, y, 0.035),
                    T[0],
                    T[2],
                    w,
                    h,
                    cell,
                    ...main,
                    r(),
                );
                stats.words++;
                lightCol = main;
                lightI += Math.min(1.2, w * h * 1.6 + 0.3);
                lightY = y;
                if (icon >= 0) {
                    const ih = Math.min(0.62, h * 1.3 + 0.15),
                        iw = ih * ASPECT[icon];
                    words.push(
                        ...at(wu + w / 2 + 0.12 + iw / 2, y, 0.035),
                        T[0],
                        T[2],
                        iw,
                        ih,
                        icon,
                        ...second,
                        r(),
                    );
                    stats.words++;
                }
            }
            // small OPEN sign low in a corner (classic red / blue box letters or script)
            if (r() < (V.k === "shop" ? 0.55 : 0.3)) {
                const cell = pick([W_.OPEN, W_.OPEN, W_.Open, W_.OPEN24], r),
                    asp = ASPECT[cell],
                    w = Math.min(0.95, gw * 0.3, 0.26 * asp),
                    h = w / asp;
                const col = colOf(
                        pick(["red", "red", "blue", "pink", "cyan"], r),
                    ),
                    side = r() < 0.5 ? -1 : 1;
                words.push(
                    ...at(
                        uc + side * (gw / 2 - w / 2 - 0.25),
                        gy0 + 0.75 + h / 2,
                        0.035,
                    ),
                    T[0],
                    T[2],
                    w,
                    h,
                    cell,
                    ...col,
                    r(),
                );
                stats.words++;
                if (!lightCol) {
                    lightCol = col;
                    lightY = gy0 + 0.9;
                }
                lightI += 0.35;
            }
            // LED strip under the sign band (downlight over the window and the sidewalk in front)
            if (r() < (V.k === "shop" ? 0.45 : 0.3)) {
                const q = r(),
                    col =
                        q < 0.55
                            ? colOf("warm")
                            : q < 0.75
                              ? colOf("cool")
                              : main,
                    y = baseY + gH - 1.74;
                addTube(
                    at(u0 + 0.05, y, 0.12),
                    T,
                    Y,
                    gw - 0.1,
                    0,
                    0.02,
                    1 | 2 | 8,
                    col,
                    true,
                    r(),
                );
                lights.push({
                    type: "rect",
                    pos: at(uc, y - 0.03, 0.22),
                    dir: [N[0] * 0.25, -0.97, N[2] * 0.25],
                    u: T,
                    width: gw - 0.1,
                    height: 0.2,
                    color: col,
                    intensity: NEON.ledLight * NEON.led,
                    range: 5,
                    radius: 0.2,
                    volume: 0.15,
                    _led: 1,
                });
                stats.strips++;
            }
            if (lightCol && lightI > 0)
                lights.push({
                    type: "point",
                    pos: at(uc, lightY, 0.9),
                    color: lightCol,
                    intensity: NEON.light * Math.min(1.6, lightI),
                    range: NEON.range,
                    radius: 0.85,
                    volume: 0.08,
                    spec: 0.35,
                    shadow: false,
                    _k: Math.min(1.6, lightI),
                });
        }
    }

    // ---------------- 2. awnings (valance neon borders / LED strips) and entrance canopies (LED perimeter)
    if (solids) {
        const S = solids,
            AW = 9; // KIND index of 'awning' (collision.js)
        const ramps = new Map(),
            RC = 8,
            rk = (x, z) => Math.floor(x / RC) * 100003 + Math.floor(z / RC);
        for (let i = 0; i < S.t.length; i++) {
            if (S.t[i] !== 2 || S.k[i] !== AW || S.f[i] & 4) continue;
            const j = i * 6;
            const k = rk(
                (S.b[j] + S.b[j + 3]) / 2,
                (S.b[j + 2] + S.b[j + 5]) / 2,
            );
            let a = ramps.get(k);
            if (!a) ramps.set(k, (a = []));
            a.push(j);
        }
        const rampAt = (x, z) => {
            for (let gx = -1; gx <= 1; gx++)
                for (let gz = -1; gz <= 1; gz++)
                    for (const j of ramps.get(rk(x + gx * RC, z + gz * RC)) ??
                        [])
                        if (
                            x > S.b[j] - 0.12 &&
                            x < S.b[j + 3] + 0.12 &&
                            z > S.b[j + 2] - 0.12 &&
                            z < S.b[j + 5] + 0.12
                        )
                            return j;
            return -1;
        };
        for (let i = 0; i < S.t.length; i++) {
            if (S.t[i] !== 0 || S.k[i] !== AW || S.f[i] & 4) continue;
            const j = i * 6,
                x0 = S.b[j],
                y0 = S.b[j + 1],
                z0 = S.b[j + 2],
                x1 = S.b[j + 3],
                y1 = S.b[j + 4],
                z1 = S.b[j + 5];
            const dx = x1 - x0,
                dy = y1 - y0,
                dz = z1 - z0,
                cx = (x0 + x1) / 2,
                cz = (z0 + z1) / 2;
            if (y0 < 1.8 || y0 > 5.5) continue;
            const { d, dens } = densAt(cx, cz);
            if (d.id === "park") continue;
            const r = mulberry32(
                (Math.floor(cx * 9.1) * 73856093) ^
                    (Math.floor(cz * 4.3) * 19349663) ^
                    0xa3e1,
            );
            if (
                dy > 0.2 &&
                dy < 0.5 &&
                Math.min(dx, dz) < 0.07 &&
                Math.max(dx, dz) > 1.2
            ) {
                // valance of a sloped awning
                const alongX = dx > dz,
                    rj = rampAt(cx, cz);
                if (rj < 0) continue;
                const rc = alongX
                    ? (S.b[rj + 2] + S.b[rj + 5]) / 2
                    : (S.b[rj] + S.b[rj + 3]) / 2;
                const sgn = alongX ? Math.sign(cz - rc) : Math.sign(cx - rc);
                if (!sgn) continue;
                const N = alongX ? [0, 0, sgn] : [sgn, 0, 0],
                    T = [N[2], 0, -N[0]]; // T x Y = N
                const Lw = Math.max(dx, dz),
                    front = alongX ? (sgn > 0 ? z1 : z0) : sgn > 0 ? x1 : x0;
                // left corner seen from outside (u = 0)
                const ox = alongX ? (T[0] > 0 ? x0 : x1) : front,
                    oz = alongX ? front : T[2] > 0 ? z0 : z1;
                const q = r(),
                    p = Math.min(0.55, 0.15 + 0.25 * dens);
                if (q < p * 0.5) {
                    // neon border around the valance face
                    const col = colOf(
                        pick(
                            [
                                "pink",
                                "cyan",
                                "red",
                                "blue",
                                "amber",
                                "violet",
                                "green",
                            ],
                            r,
                        ),
                    );
                    addTube(
                        [
                            ox + T[0] * 0.06 + N[0] * 0.03,
                            y0 + 0.05,
                            oz + T[2] * 0.06 + N[2] * 0.03,
                        ],
                        T,
                        Y,
                        Lw - 0.12,
                        dy - 0.1,
                        0.013,
                        15,
                        col,
                        false,
                        r(),
                    );
                    lights.push({
                        type: "point",
                        pos: [cx + N[0] * 0.8, y0 - 0.1, cz + N[2] * 0.8],
                        color: col,
                        intensity: NEON.light * 0.9,
                        range: NEON.range,
                        radius: 0.8,
                        volume: 0.08,
                        spec: 0.35,
                        shadow: false,
                        _k: 0.9,
                    });
                    stats.awnings++;
                    note("awning", cx, cz, N, "neon");
                } else if (q < p) {
                    // LED strip under the valance's lower edge (lights the sidewalk under the awning front)
                    const col =
                        r() < 0.7
                            ? colOf("warm")
                            : colOf(pick(["cool", "pink", "cyan", "amber"], r));
                    addTube(
                        [
                            ox + T[0] * 0.05 - N[0] * 0.03,
                            y0 - 0.012,
                            oz + T[2] * 0.05 - N[2] * 0.03,
                        ],
                        T,
                        Y,
                        Lw - 0.1,
                        0,
                        0.018,
                        1 | 2 | 8,
                        col,
                        true,
                        r(),
                    );
                    lights.push({
                        type: "rect",
                        pos: [cx - N[0] * 0.1, y0 - 0.03, cz - N[2] * 0.1],
                        dir: [0, -1, 0],
                        u: T,
                        width: Lw - 0.1,
                        height: 0.25,
                        color: col,
                        intensity: NEON.ledLight * NEON.led,
                        range: 5,
                        radius: 0.2,
                        volume: 0.15,
                        _led: 1,
                    });
                    stats.awnings++;
                    stats.strips++;
                    note("awning", cx, cz, N, "led");
                }
            } else if (
                dy >= 0.28 &&
                dy < 0.75 &&
                Math.min(dx, dz) > 1.3 &&
                Math.max(dx, dz) < 7 &&
                y0 > 2.3 &&
                y0 < 3.8
            ) {
                // entrance / doorman canopy
                if (r() > 0.45 + 0.2 * dens) continue;
                const q = r(),
                    col =
                        q < 0.6
                            ? colOf("warm")
                            : q < 0.8
                              ? colOf("gold")
                              : colOf(
                                    pick(["red", "amber", "blue", "cool"], r),
                                ),
                    led = q < 0.8;
                // perimeter strip just under the canopy edge (horizontal frame: axes x / z, normal down)
                addTube(
                    [x0 + 0.06, y0 - 0.015, z1 - 0.06],
                    [1, 0, 0],
                    [0, 0, -1],
                    dx - 0.12,
                    dz - 0.12,
                    led ? 0.018 : 0.013,
                    15,
                    col,
                    led,
                    r(),
                );
                lights.push({
                    type: "point",
                    pos: [cx, y0 - 0.35, cz],
                    color: col,
                    intensity: NEON.light * 1.1,
                    range: 6,
                    radius: 0.9,
                    volume: 0.1,
                    spec: 0.25,
                    shadow: false,
                    _k: 1.1,
                });
                stats.canopies++;
                note("canopy", cx, cz, [0, 1, 0], led ? "led" : "neon");
            }
        }
    }

    // ---------------- 3. lights
    for (const L of lights) L.id = cityLights.add(L);
    stats.lights = lights.length;
    const relight = () => {
        for (const L of lights)
            cityLights.update(L.id, {
                intensity: L._led
                    ? NEON.ledLight * NEON.led * L._led
                    : NEON.light * L._k,
                range: L._led ? L.range : NEON.range,
            });
    };

    // ---------------- 4. meshes
    let tubeMesh = null,
        wordMesh = null;
    const nT = tubes.length / 17;
    if (nT) {
        const g = frameGeometry(),
            A = new Float32Array(tubes);
        const ib = new THREE.InstancedInterleavedBuffer(A, 17, 1);
        g.setAttribute("iO", new THREE.InterleavedBufferAttribute(ib, 3, 0));
        g.setAttribute("iT", new THREE.InterleavedBufferAttribute(ib, 3, 3));
        g.setAttribute("iV", new THREE.InterleavedBufferAttribute(ib, 3, 6));
        g.setAttribute("iD", new THREE.InterleavedBufferAttribute(ib, 4, 9));
        g.setAttribute("iC", new THREE.InterleavedBufferAttribute(ib, 4, 13));
        g.instanceCount = nT;
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
        g.boundingBox = new THREE.Box3(
            new THREE.Vector3(-1e5, -1e5, -1e5),
            new THREE.Vector3(1e5, 1e5, 1e5),
        );
        const mat = tubeMaterial();
        tubeMesh = new THREE.Mesh(g, mat);
        tubeMesh.name = "neonTubes";
        tubeMesh.frustumCulled = false;
        tubeMesh.castShadow = false;
        tubeMesh.receiveShadow = false;
        tubeMesh.onBeforeRender = () => {
            mat.userData.uni.uNeon.value.set(NEON.gain, NEON.led, NEON.day, 0);
        };
        scene.add(tubeMesh);
    }
    const nW = words.length / 12;
    if (nW) {
        const g = new THREE.InstancedBufferGeometry(),
            P = new THREE.PlaneGeometry(1, 1);
        g.index = P.index;
        g.setAttribute("position", P.getAttribute("position"));
        g.setAttribute("uv", P.getAttribute("uv"));
        const A = new Float32Array(nW * 14);
        for (let i = 0; i < nW; i++) {
            const s = i * 12,
                o = i * 14;
            A[o] = words[s];
            A[o + 1] = words[s + 1];
            A[o + 2] = words[s + 2];
            A[o + 3] = words[s + 3];
            A[o + 4] = 0;
            A[o + 5] = words[s + 4];
            A[o + 6] = words[s + 5];
            A[o + 7] = words[s + 6];
            A[o + 8] = words[s + 7];
            A[o + 9] = 0;
            A[o + 10] = words[s + 8];
            A[o + 11] = words[s + 9];
            A[o + 12] = words[s + 10];
            A[o + 13] = words[s + 11];
        }
        const ib = new THREE.InstancedInterleavedBuffer(A, 14, 1);
        g.setAttribute("iO", new THREE.InterleavedBufferAttribute(ib, 3, 0));
        g.setAttribute("iT", new THREE.InterleavedBufferAttribute(ib, 3, 3));
        g.setAttribute("iD", new THREE.InterleavedBufferAttribute(ib, 4, 6));
        g.setAttribute("iC", new THREE.InterleavedBufferAttribute(ib, 4, 10));
        g.instanceCount = nW;
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
        const mat = wordMaterial();
        wordMesh = new THREE.Mesh(g, mat);
        wordMesh.name = "neonWords";
        wordMesh.frustumCulled = false;
        wordMesh.renderOrder = 3;
        wordMesh.onBeforeRender = () => {
            mat.userData.uni.uNeonW.value.set(
                NEON.gain * NEON.word,
                NEON.glow,
                0,
                0,
            );
        };
        scene.add(nightOnly(wordMesh));
    }
    stats.wordsN = nW;
    if (typeof window !== "undefined")
        Object.assign(window.__neon, {
            relight,
            tubes: tubeMesh,
            words: wordMesh,
        });
    console.log(
        `[neon] ${stats.neonBays}/${stats.open} open shop bays (${stats.bays} bays, ${stats.fronts} fronts): ${stats.frames} frames, ${stats.words} words, ${stats.strips} LED strips, ${stats.awnings} awnings, ${stats.canopies} canopies, ${stats.towers} tower strips | ${stats.tubes} tube instances, ${stats.lights} lights`,
    );
    return { stats, tubes: tubeMesh, words: wordMesh };
}
