// OWNER: timessq agent. Times-Square-like plaza on 6th Av (x = 0) between the streets z -320 .. 0.
//   timesSquareReserves() -> reserve specs for generateBuildings (replaces the old landmarks.js 'ts*' entries):
//       red pedestrian plaza lots along both sides of the avenue (rows -240 / -160), screen-clad podium towers on the
//       lots behind them, and screen-clad corner towers at the north (-320) and south (-80) ends of the "bow tie".
//   buildTimesSquare({scene, gen}) -> after generateBuildings, before the tile meshes are built:
//       LED screens (one merged emissive mesh, ad atlas public/assets/city/tex/ts_ads.webp from tools/gen_ts_ads.py),
//       screen frames / marquee light trims / storefront sign bands, red paver plaza surfaces, the red TKTS-like
//       steps, the One-Times-Square-like tower standing on the closed avenue segment (layout.CLOSED_AV x=0, -80..0),
//       planters with hedges and bollards. Every solid registers its collision (gen.solids) in the same call.
import * as THREE from "three";
import { G, mulberry32, ZFIX } from "./layout.js"; // (zfix) ZFIX: ?nozfix A/B
import { STYLE, LAYER } from "./facade.js";
import { MB } from "./geom.js";
import { AD_AVG_L, AD_AVG_P } from "./ts_ads_meta.js";
import * as ADM from "./ts_ads_meta.js"; // (billboards r4) AD_ID_L / AD_ID_P: twin cells that show the same ad
import { adsTexture, signsTexture } from "./adstex.js"; // (billboards r3) one shared GPU copy of the ad atlas (night r5) + sign atlas
import { nightK } from "../render/daynight.js"; // (daynight)
import { cityLights } from "../render/citylights.js"; // (night) screens are real light sources
import {
  screenLightSet,
  scrUniforms,
  SCR_GLSL_PARS,
  SCR_GAIN_GLSL,
  SCR_SHOULDER_GLSL,
  screenNightMat,
} from "./screenlights.js"; // (night)

const CH = G.CURB_H;
const TS_SPILL = 1.3; // (r5) was 1.0 // (r4) strength of the screens' coloured light spill cards
const TEX = "/assets/city/tex/";
// block rows (street z at the north edge of the row) and x extents
export const TS = {
  plazaRows: [-240, -160], // rows with the pedestrian plazas
  endRows: [-320, -80], // north / south end rows: corner towers right at the avenue sidewalk
  plazaX: 44, // plaza lots |x| 16..44
  towerX: 100, // plaza-row billboard towers |x| 44..100
  endX: 96, // end-row towers |x| 16..96
  oneTS: { x0: -9, x1: 9, z0: -64, z1: -24, h: 98 }, // One-Times-Square-like tower on the closed avenue segment
  tkts: { x0: -40, x1: -21, zFront: -207, zBack: -229, n: 16 },
};
// static plaza crowd spots (filled by buildTimesSquare, read by npc/crowd.js): {x, z, ry, mode: 'stand'|'sit', y?, clip}
export const tsCrowdSpots = [];
// (r9) plaza tree spots (low granite tree planters), appended to the props tree spots by tsTrimTrees -> trees.js
export const TS_TREE_SPOTS = [];
const rowZ = (zs) => ({
  z0: zs + G.ST_HALF + G.ST_WALK,
  z1: zs + G.ST_SP - G.ST_HALF - G.ST_WALK,
  c0: zs + G.ST_HALF,
  c1: zs + G.ST_SP - G.ST_HALF,
});
const snap = (A, y) =>
  A.gH + Math.max(1, Math.round((y - A.gH) / A.floorH)) * A.floorH;

export function timesSquareReserves() {
  const R = [];
  // (r9) sunLow: the towers south-west of the plaza (sun from the SW in the game's one look) are lower + set further
  // back, so sun reaches the plaza / avenue floor in shafts between the shadows (critic r8: 'flat overcast, no cast shadows')
  const tower = (name, x0, x1, z0, z1, face, seed, podium, sunLow = false) =>
    R.push({
      name,
      x0,
      x1,
      z0,
      z1,
      seed,
      ts: true,
      face,
      sides: { [face]: "street" },
      arch: (r) => ({
        type: "glass",
        style: r() < 0.5 ? STYLE.RIBBON : STYLE.CURTAIN,
        layer: r() < 0.45 ? LAYER.CONCRETE : LAYER.METAL,
        base: LAYER.GRANITE,
        floorH: 3.8,
        bayW: 1.6,
        winW: 0.9,
        winH: 0.5,
        gH: 7,
        height: sunLow ? 72 + r() * 40 : 140 + r() * 110,
        depth: 0.12,
        margin: 0.4,
        tint: [0.62, 0.64, 0.68],
        cornice: false,
        waterTower: false,
        shape: (lot, A, P, r2, H) => {
          const ph = snap(A, podium[0] + r2() * podium[1]);
          const pp = {
            ...P,
            style: STYLE.PUNCHED,
            layer: [LAYER.CONCRETE, LAYER.LIME, LAYER.BUFF, LAYER.RED][
              Math.floor(r2() * 4)
            ],
            winW: 0.6,
            winH: 0.55,
            tint: [0.62, 0.6, 0.58],
          };
          const k = (sd) =>
            sd === face
              ? (sunLow ? 9 : 4) + r2() * 3
              : lot.sides[sd] === "street"
                ? 2.5
                : 1.2;
          // mixed-era tower kit above the screen podium: pre-war limestone / buff deco, brick, post-war ribbon, blue glass
          const kit = [
            {
              ...P,
              style: STYLE.DECO,
              layer: r2() < 0.5 ? LAYER.LIME : LAYER.BUFF,
              bayW: 1.9,
              winW: 0.52,
              winH: 0.62,
              depth: 0.25,
              tint: [1, 0.98, 0.94],
            },
            {
              ...P,
              style: STYLE.PUNCHED,
              layer: r2() < 0.6 ? LAYER.RED : LAYER.BROWN,
              bayW: 2.3,
              winW: 0.55,
              winH: 0.6,
              depth: 0.22,
              tint: [1, 1, 1],
            },
            {
              ...P,
              style: STYLE.RIBBON,
              layer: LAYER.WHITE,
              bayW: 1.6,
              winW: 0.9,
              winH: 0.5,
              depth: 0.12,
              tint: [0.9, 0.9, 0.9],
            },
            {
              ...P,
              style: STYLE.CURTAIN,
              layer: LAYER.METAL,
              bayW: 1.5,
              winW: 0.97,
              winH: 0.74,
              depth: 0.05,
              tint: [0.62, 0.66, 0.74],
            },
            P,
          ];
          const tp = kit[Math.floor(r2() * kit.length)];
          const out = [
            {
              x0: lot.x0,
              x1: lot.x1,
              z0: lot.z0,
              z1: lot.z1,
              y0: 0,
              y1: ph,
              p: pp,
              parapet: 1.1,
              roof: true,
            },
          ];
          let m = {
              x0: lot.x0 + k("nx"),
              x1: lot.x1 - k("px"),
              z0: lot.z0 + k("nz"),
              z1: lot.z1 - k("pz"),
            },
            y = ph;
          const tiers = 1 + Math.floor(r2() * 3);
          for (let i = 0; i < tiers; i++) {
            const last =
              i === tiers - 1 || Math.min(m.x1 - m.x0, m.z1 - m.z0) < 22;
            const y1 = last ? H : snap(A, y + (H - y) * (0.45 + r2() * 0.25));
            out.push({
              ...m,
              y0: y,
              y1,
              p: tp,
              parapet: tp.style === STYLE.CURTAIN ? 0.6 : 1.3,
              roof: true,
            });
            if (last) break;
            y = y1;
            const q = 2.5 + r2() * 3;
            m = { x0: m.x0 + q, x1: m.x1 - q, z0: m.z0 + q, z1: m.z1 - q };
          }
          return out;
        },
      }),
    });
  for (const zs of TS.plazaRows) {
    const { z0, z1 } = rowZ(zs);
    R.push({
      name: "tsqPlazaW",
      x0: -TS.plazaX,
      x1: -10,
      z0,
      z1,
      custom: true,
      tsPlaza: true,
    });
    R.push({
      name: "tsqPlazaE",
      x0: 10,
      x1: TS.plazaX,
      z0,
      z1,
      custom: true,
      tsPlaza: true,
    });
    tower(
      "tsqTowerW",
      -TS.towerX,
      -TS.plazaX,
      z0,
      z1,
      "px",
      900 + zs,
      [36, 22],
      true,
    );
    tower("tsqTowerE", TS.plazaX, TS.towerX, z0, z1, "nx", 950 + zs, [36, 22]);
  }
  for (const zs of TS.endRows) {
    const { z0, z1 } = rowZ(zs);
    tower(
      "tsqEndW",
      -TS.endX,
      -10,
      z0,
      z1,
      "px",
      1300 + zs,
      [30, 26],
      zs === -80,
    );
    tower("tsqEndE", 10, TS.endX, z0, z1, "nx", 1350 + zs, [30, 26]);
  }
  return R;
}

// ------------------------------------------------------------------------------------------------ atlas helpers
// ts_ads.webp (4096 x 4096): top half 64 landscape cells (512x256, 8 x 8), bottom half 64 portrait cells (256x512, 16 x 4).
// Ad choice: every screen takes the cell whose previous uses are farthest away (no ad repeats inside one view).
const AD_N = 64,
  AD_W = 4096,
  AD_H = 4096;
function makeAdPicker(rnd) {
  const used = {
    L: Array.from({ length: AD_N }, () => []),
    P: Array.from({ length: AD_N }, () => []),
  };
  return (land, x, z) => {
    const U = used[land ? "L" : "P"];
    let best = 0,
      bd = -1;
    // (billboards r4) critic r3: 'AUREL x2, BIG APPLE BURGER x2, DETECTIVE NEON x2' - a cell's shifted-crop twin shows the
    // same ad, so distance counts every cell of the same ad identity (and both orientations of it), with less jitter
    const ids = land ? ADM.AD_ID_L : ADM.AD_ID_P;
    for (let i = 0; i < AD_N; i++) {
      let d = 1e5;
      if (ids) {
        const id = ids[i];
        for (const k of ["L", "P"]) {
          const I = k === "L" ? ADM.AD_ID_L : ADM.AD_ID_P;
          for (let j = 0; j < AD_N; j++)
            if (I[j] === id)
              for (const q of used[k][j])
                d = Math.min(d, Math.hypot(q[0] - x, q[1] - z));
        }
      } else
        for (const q of U[i]) d = Math.min(d, Math.hypot(q[0] - x, q[1] - z));
      d += rnd() * 8;
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    U[best].push([x, z]);
    return best;
  };
}
function adUV(rnd, aspect, pick, x = 0, z = 0) {
  const land = aspect >= 1 || (aspect > 0.75 && rnd() < 0.5);
  return cellUV(land, pick(land, x, z), aspect);
}
// (billboards r5) a specific ad by its source art name (ts_ads_meta AD_NAME_*, e.g. 'L41' = the OUR logo band), or null
function namedUV(name, aspect, vCrop) {
  const land = name[0] !== "P",
    names = land ? ADM.AD_NAME_L : ADM.AD_NAME_P;
  const i = names ? names.indexOf(name) : -1;
  if (i < 0) return null;
  const uv = cellUV(land, i, vCrop ? (land ? 2 : 0.5) : aspect);
  if (vCrop) {
    const dv = uv[3] - uv[1];
    uv[1] += dv * vCrop[0];
    uv[3] = uv[1] + dv * (vCrop[1] - vCrop[0]);
  } // keep a horizontal band of the cell
  return uv;
}
function cellUV(land, i, aspect) {
  let u0, v0, du, dv, ca;
  if (land) {
    u0 = (i % 8) / 8;
    du = 1 / 8;
    dv = 1 / 16;
    v0 = 1 - (Math.floor(i / 8) + 1) / 16;
    ca = 2;
  } else {
    u0 = (i % 16) / 16;
    du = 1 / 16;
    dv = 1 / 8;
    v0 = 0.5 - (Math.floor(i / 16) + 1) / 8;
    ca = 0.5;
  }
  // centre-crop the cell to the screen aspect (no stretching) + 2 texel inset against mip bleed
  const eu = 2 / AD_W,
    ev = 2 / AD_H;
  u0 += eu;
  du -= 2 * eu;
  v0 += ev;
  dv -= 2 * ev;
  if (aspect > ca) {
    const k = ca / aspect;
    v0 += (dv * (1 - k)) / 2;
    dv *= k;
  } else {
    const k = aspect / ca;
    u0 += (du * (1 - k)) / 2;
    du *= k;
  }
  const out = [u0, v0, u0 + du, v0 + dv];
  out.avg = (land ? AD_AVG_L : AD_AVG_P)[i]; // linear average colour of the ad (light spill)
  return out;
}
// ts_signs.webp (2048 x 2048): 64 unique storefront signs 512x128 (4 cols x 16 rows, tools/gen_ts_ads3.py). Signs are
// dealt from a shuffled deck, so no name repeats until all 64 are used.
const SIGN_N = 64;
let signDeck = [];
function signUV(rnd, aspect) {
  if (!signDeck.length) {
    signDeck = Array.from({ length: SIGN_N }, (_, i) => i);
    for (let i = SIGN_N - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [signDeck[i], signDeck[j]] = [signDeck[j], signDeck[i]];
    }
  }
  const i = signDeck.pop();
  let u0 = (i % 4) / 4 + 2 / 2048,
    du = 0.25 - 4 / 2048,
    v0 = 1 - (Math.floor(i / 4) + 1) / 16 + 2 / 2048,
    dv = 1 / 16 - 4 / 2048;
  const ca = 4;
  if (aspect > ca) {
    const k = ca / aspect;
    v0 += (dv * (1 - k)) / 2;
    dv *= k;
  } else {
    const k = aspect / ca;
    u0 += (du * (1 - k)) / 2;
    du *= k;
  }
  return [u0, v0, u0 + du, v0 + dv];
}
// (billboards r6) a specific sign cell (neon script signs pick the script / serif names)
function signCellUV(i, aspect) {
  let u0 = (i % 4) / 4 + 2 / 2048,
    du = 0.25 - 4 / 2048,
    v0 = 1 - (Math.floor(i / 4) + 1) / 16 + 2 / 2048,
    dv = 1 / 16 - 4 / 2048;
  if (aspect > 4) {
    const k = 4 / aspect;
    v0 += (dv * (1 - k)) / 2;
    dv *= k;
  } else {
    const k = aspect / 4;
    u0 += (du * (1 - k)) / 2;
    du *= k;
  }
  return [u0, v0, u0 + du, v0 + dv];
}
const NEON_CELLS = [3, 19, 22, 38, 54, 57, 37, 53, 20, 18, 12, 36];

// simple quad batch: positions / normals / uvs / colors
class QB {
  constructor() {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.c = [];
    this.i = [];
    this.v = 0;
  }
  quad(a, b, c, d, n, uv, col = [1, 1, 1]) {
    for (const q of [a, b, c, d]) {
      this.p.push(q[0], q[1], q[2]);
      this.n.push(n[0], n[1], n[2]);
      this.c.push(col[0], col[1], col[2]);
    }
    this.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
    this.i.push(this.v, this.v + 1, this.v + 2, this.v, this.v + 2, this.v + 3);
    this.v += 4;
  }
  // (r6) room quad for the interior-mapped shop fronts: tangent (face right dir) + per-vertex [lu, lv, width, height]
  room(a, b, c, d, n, uv, col, tan, w, h) {
    if (!this.tan) {
      this.tan = [];
      this.rm = [];
    }
    this.quad(a, b, c, d, n, uv, col);
    for (const [lu, lv] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]) {
      this.tan.push(tan[0], tan[1], tan[2]);
      this.rm.push(lu, lv, w, h);
    }
  }
  build() {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    if (this.tan) {
      g.setAttribute("aTan", new THREE.Float32BufferAttribute(this.tan, 3));
      g.setAttribute("aRoom", new THREE.Float32BufferAttribute(this.rm, 4));
    }
    g.setIndex(
      this.v > 65535
        ? new THREE.Uint32BufferAttribute(this.i, 1)
        : new THREE.Uint16BufferAttribute(this.i, 1),
    );
    g.computeBoundingSphere();
    return g;
  }
}

function loadTex(url, { srgb = true, repeat = false, aniso = 8 } = {}) {
  const t = new THREE.TextureLoader().load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function dotTexture() {
  // marquee bulbs / LED dashes (repeats along the strip)
  const S = 32,
    d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const r = Math.hypot(x - S / 2 + 0.5, y - S / 2 + 0.5) / (S * 0.36);
      const v = Math.max(0, Math.min(1, 1.25 - r)) ** 1.5;
      const k = (y * S + x) * 4;
      d[k] = d[k + 1] = d[k + 2] = Math.round(20 + 235 * v);
      d[k + 3] = 255;
    }
  const t = new THREE.DataTexture(d, S, S);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
// (r6) contact-AO card texture (alpha only), 4 regions along u: linear ramp (opaque at v = 0), radial blob, soft box,
// grime streaks (rain-washed dirt running down from ledges; opaque at v = 0)
function aoTexture() {
  const W = 256,
    H = 64,
    d = new Uint8Array(W * H * 4),
    rr = mulberry32(99);
  const cols = Array.from({ length: 64 }, () => rr()),
    lens = Array.from({ length: 64 }, () => 0.3 + rr() * 0.7);
  const ss = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const reg = Math.floor(x / 64),
        u = ((x % 64) + 0.5) / 64,
        v = (y + 0.5) / H;
      let a;
      if (reg === 0) a = Math.pow(1 - v, 1.9);
      else if (reg === 1) {
        const r = Math.hypot(u - 0.5, v - 0.5) * 2;
        a = Math.pow(Math.max(0, 1 - r), 1.6);
      } else if (reg === 2) a = ss(0, 0.16, Math.min(u, 1 - u, v, 1 - v));
      else {
        const c = x % 64,
          n = 0.5 * cols[c] + 0.25 * (cols[(c + 1) % 64] + cols[(c + 63) % 64]);
        a =
          Math.max(0, n - 0.25) *
            1.4 *
            Math.pow(Math.max(0, 1 - v / lens[c]), 1.3) +
          0.15 * Math.pow(1 - v, 2);
      }
      const k = (y * W + x) * 4;
      d[k] = d[k + 1] = d[k + 2] = 0;
      d[k + 3] = Math.round(255 * a);
    }
  const t = new THREE.DataTexture(d, W, H);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// (night) storefront sign bands as light: their colour is the mean of their ts_signs.webp cell (4 x 16 cells), measured
// once from a small canvas downsample when the image arrives (browser-cached: same URL as the texture)
function signLights(q) {
  if (!q.length || typeof Image === "undefined") return;
  const im = new Image();
  im.onload = () => {
    const W = 64,
      H = 128,
      cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(im, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data,
      lin = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
    const set = screenLightSet();
    for (const s of q) {
      const uc = (s.uv[0] + s.uv[2]) / 2,
        vc = (s.uv[1] + s.uv[3]) / 2,
        du = Math.abs(s.uv[2] - s.uv[0]) / 2,
        dv = Math.abs(s.uv[3] - s.uv[1]) / 2;
      const x0 = Math.floor((uc - du) * W),
        x1 = Math.ceil((uc + du) * W),
        y0 = Math.floor((1 - vc - dv) * H),
        y1 = Math.ceil((1 - vc + dv) * H);
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
        for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
          const k = (y * W + x) * 4;
          r += lin(d[k]);
          g += lin(d[k + 1]);
          b += lin(d[k + 2]);
          n++;
        }
      if (n) set.rect(s.c, s.n, s.u, s.w, s.h, [r / n, g / n, b / n], 3.0); // (night r3) x3.0 at gain 1.0 (r2 0.7 -> 1.8 at gain 1.9): street-level colour on the plaza (critic: plaza 0.6x ref)
    }
    set.commit("tsSigns", { mergeA: 1e9, mergeGap: 9, mergeMax: 44 }); // one emitter per run of sign bands along a face
  };
  im.src = TEX + "ts_signs.webp";
}

// ------------------------------------------------------------------------------------------------ build
export function buildTimesSquare({ scene, gen }) {
  const S = gen.solids,
    Z = gen.zips;
  let rnd = mulberry32(4242); // (r11) let: new r11 features swap in their own stream (r11) so the ad layout stays put
  const r11 = mulberry32(1111);
  const r4b = mulberry32(4404); // (billboards r4) own stream: the r4 additions leave the ad layout put
  const r5 = mulberry32(5505); // (billboards r5) own stream: OUR ring bands + same-ad LED grids
  let ringN = 0,
    gridN = 0;
  signDeck = [];
  tsCrowdSpots.length = 0;
  TS_TREE_SPOTS.length = 0;
  const scr = new QB(); // LED screens (ad atlas, emissive)
  const sgn = new QB(); // storefront sign bands (sign atlas, emissive)
  const lit = new QB(); // marquee bulb / LED dash strips (dot texture, vertex colour)
  const frm = new MB(); // frames, steel, planters (vertex colour, lit)
  const pav = new QB(); // red pavers (world-space uv)
  const tk = new MB(); // TKTS red glass steps
  const glass = new QB(); // (r9) clear glass balustrades (TKTS)
  const shp = new QB(); // storefront interiors (lit, glassy)
  const vin = new QB(); // (r6) printed vinyl posters (ad atlas, lit by the sun, NOT emissive) under gooseneck lamps
  const ao = new QB(); // (r6) baked contact AO: soft dark alpha cards (ground contact, wall behind screen cabinets)
  // ao texture regions along u: linear ramp (dark at the a-b edge), radial blob, soft-edged box
  const AO_LIN = [0.008, 0.0, 0.242, 1.0],
    AO_BLOB = [0.256, 0.0, 0.494, 1.0],
    AO_BOX = [0.506, 0.0, 0.744, 1.0],
    AO_STREAK = [0.752, 0.0, 0.998, 1.0];
  const yAO = CH + 0.016;
  const aoStrip = (a, b, out, w, s) =>
    ao.quad(
      a,
      b,
      [b[0] + out[0] * w, b[1] + out[1] * w, b[2] + out[2] * w],
      [a[0] + out[0] * w, a[1] + out[1] * w, a[2] + out[2] * w],
      [0, 1, 0],
      AO_LIN,
      [s, s, s],
    );
  const aoBlob = (x, z, rx, rz, s, y = yAO) =>
    ao.quad(
      [x - rx, y, z + rz],
      [x + rx, y, z + rz],
      [x + rx, y, z - rz],
      [x - rx, y, z - rz],
      [0, 1, 0],
      AO_BLOB,
      [s, s, s],
    );
  const aoRect = (x0, z0, x1, z1, s, y = yAO) =>
    ao.quad(
      [x0, y, z1],
      [x1, y, z1],
      [x1, y, z0],
      [x0, y, z0],
      [0, 1, 0],
      AO_BOX,
      [s, s, s],
    );

  const pick = makeAdPicker(rnd);
  const pick2 = makeAdPicker(r11); // (r11) ad picks for the r11 additions (own stream)
  const box = (x0, y0, z0, x1, y1, z1, kind, col) => {
    // lit frame geometry + exact collision
    if (col !== undefined) frm.setColor(col);
    frm.box(x0, y0, z0, x1, y1, z1);
    S.box(x0, y0, z0, x1, y1, z1, kind);
  };
  // --- a screen on a vertical face. face: {n:[nx,nz], r:[rx,rz], d} with n.p = d the wall plane, r = viewer's right
  const P3 = (f, t, y, off) => [
    f.n[0] * (f.d + off) + f.r[0] * t,
    y,
    f.n[1] * (f.d + off) + f.r[1] * t,
  ];
  const fbox = (f, ta, tb, ya, yb, oa, ob, kind, col) => {
    // axis-aligned box in face coordinates
    const a = P3(f, ta, ya, oa),
      b = P3(f, tb, yb, ob);
    box(
      Math.min(a[0], b[0]),
      ya,
      Math.min(a[2], b[2]),
      Math.max(a[0], b[0]),
      yb,
      Math.max(a[2], b[2]),
      kind,
      col,
    );
  };
  const LEDC = [
    [0.35, 1.0, 0.9],
    [1.0, 0.3, 0.65],
    [1.0, 0.75, 0.35],
    [0.45, 0.6, 1.0],
    [1, 1, 1],
  ];
  // (r4) screens hang off steel outriggers: the cabinet stands 0.3-0.9 m proud of the facade on posts + rails (visible
  // in the gap), has >= 0.4 m deep side returns, and big low screens get a service catwalk with a railing underneath.
  // Every screen below ~30 m queues a coloured light-spill card for the ground / facade below it (see spill()).
  const spillQ = [],
    haloQ = [];
  const SLS = screenLightSet(),
    signQ = []; // (night) screen / sign emitters -> cityLights (committed after the build)
  let noWalk = false;
  const scrRects = []; // (r7) face rects taken by screens / rigs (window AC units keep clear of them)
  const screen = (f0, ta, tb, ya, yb, dep, opt = {}) => {
    scrRects.push({ n: f0.n, d: f0.d, ta, tb, ya, yb: yb + 2.2 });
    // (r6) frames: mostly dark cabinets, some brushed-steel / light-grey / white-painted surrounds (refs 14 / 15)
    const fc =
      opt.frame ??
      [
        0x1b1c1f, 0x222326, 0x2c2d31, 0x151517, 0x3a3b3f, 0x1b1c1f, 0x6c6e72,
        0x8e9094, 0xb9b8b2,
      ][Math.floor(rnd() * 9)];
    const gap = opt.sign || opt.flush ? 0 : (opt.gap ?? 0.3 + rnd() * 0.6);
    if (gap) dep = Math.max(dep, 0.4);
    const f = gap ? { ...f0, d: f0.d + gap } : f0;
    if (gap) {
      frm.setColor(0x2b2d30);
      const posts = Math.max(2, Math.round((tb - ta) / 3.2) + 1);
      for (let i = 0; i < posts; i++) {
        const t = ta + 0.3 + ((tb - ta - 0.75) * i) / (posts - 1);
        fbox(f0, t, t + 0.15, ya + 0.25, yb - 0.25, 0, gap, "wall");
      }
      for (const y of [ya + 0.45, yb - 0.65])
        fbox(f0, ta + 0.2, tb - 0.2, y, y + 0.18, 0.03, gap - 0.03, "wall");
      // (r6) contact AO on the facade behind / around the cabinet (it sits in its own shadow pocket)
      const aw = 0.7 + Math.min(1.2, gap * 1.2);
      ao.quad(
        P3(f0, ta - aw, ya - aw, 0.02),
        P3(f0, tb + aw, ya - aw, 0.02),
        P3(f0, tb + aw, yb + aw * 0.5, 0.02),
        P3(f0, ta - aw, yb + aw * 0.5, 0.02),
        [f0.n[0], 0, f0.n[1]],
        AO_BOX,
        [0.62, 0.62, 0.62],
      );
    }
    fbox(f, ta, tb, ya, yb, 0, dep, "wall", fc);
    const big = !opt.sign && !opt.flush && tb - ta > 5; // (r7) big cabinets: chunkier bezel + deeper box (critic: 'flush rectangles, no bezel depth')
    if (big) dep = Math.max(dep, 0.6 + rnd() * 0.5);
    const e = opt.bezel ?? (big ? 0.26 + rnd() * 0.3 : 0.16 + rnd() * 0.22),
      o = dep + 0.012,
      n = [f.n[0], 0, f.n[1]];
    const w = tb - ta - 2 * e,
      h = yb - ya - 2 * e;
    const cx = P3(f, (ta + tb) / 2, 0, 0);
    const uv =
      opt.uv ??
      (opt.sign
        ? signUV(rnd, w / h)
        : adUV(rnd, w / h, pick, cx[0] + (ya + yb) * 0.15, cx[2]));
    const vinyl = !!opt.vinyl && !opt.sign;
    if (!opt.sign && !vinyl && !opt.noSpill && ya < 32)
      spillQ.push({ f: f0, ta, tb, ya, yb, off: gap + dep, avg: uv.avg });
    if (!opt.sign && !vinyl && !opt.noHalo && uv.avg && tb - ta > 2.5)
      haloQ.push({ f: f0, ta, tb, ya, yb, avg: uv.avg }); // (r9) glow on the wall around the cabinet
    const B = opt.sign ? sgn : vinyl ? vin : scr;
    let k = opt.bright ?? (vinyl ? 0.85 + rnd() * 0.2 : 0.62 + rnd() * 0.5); // (r5/r6) wide exposure spread between panels
    // (r7) per-sign 'nits' normalised by the ad's own mean luminance: bright full-bleed cells (the mint VERA wall, the
    // near-white wraps) are driven down, dark key-art cells up, so the canyon is no longer uniformly overexposed
    if (!opt.sign && !vinyl && uv.avg) {
      const a = uv.avg,
        lum = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
      k *= Math.min(1.45, Math.max(0.55, Math.pow(0.15 / (lum + 0.02), 0.5)));
    } // (r9) dark cells lifted more (critic: 'many near-black')
    B.quad(
      P3(f, ta + e, ya + e, o),
      P3(f, tb - e, ya + e, o),
      P3(f, tb - e, yb - e, o),
      P3(f, ta + e, yb - e, o),
      n,
      uv,
      [k, k, k],
    );
    // (night) the panel lights the square: emitter plane just behind the LED face (a player crawling on it is lit too).
    // The facade the cabinet hangs on lies behind that plane (no direct light), so cabinets on outriggers add a point
    // light in the stand-off gap (screenlights.js halo): the wall around the cabinet gets a soft glow falling off with
    // distance (critic r2 / r3: zero spill on the facade beside a screen)
    if (!vinyl && !opt.sign) {
      SLS.rect(
        P3(f, (ta + tb) / 2, (ya + yb) / 2, o - 0.05),
        n,
        [f.r[0], 0, f.r[1]],
        w,
        h,
        uv.avg,
        1,
        { uv },
      ); // (night r9) per-region image colours
      if (w * h > 30 && gap)
        SLS.halo(
          P3(
            f,
            (ta + tb) / 2,
            (ya + yb) / 2,
            -gap + Math.min(1.5, gap + o - 0.15),
          ),
          n,
          [f.r[0], 0, f.r[1]],
          w,
          h,
          uv.avg,
        );
    } else if (vinyl)
      SLS.rect(
        P3(f, (ta + tb) / 2, (ya + yb) / 2, o + 0.02),
        n,
        [f.r[0], 0, f.r[1]],
        w,
        h,
        uv.avg,
        1,
        { uv, printed: true },
      ); // (night r9) floodlit print reflects its colours
    else if (opt.sign)
      signQ.push({
        c: P3(f, (ta + tb) / 2, (ya + yb) / 2, o + 0.06),
        n,
        u: [f.r[0], 0, f.r[1]],
        w,
        h,
        uv,
      }); // (night) sign-band light (colour from the sign atlas once loaded)
    if (opt.sign) return;
    if (vinyl) {
      // (r6) printed vinyl on a stretched frame: flat moulding, gooseneck lamps on arms along the top edge
      const L = 0.1;
      frm.setColor(fc);
      fbox(f, ta, tb, yb - e, yb, dep, dep + L, "wall");
      fbox(f, ta, tb, ya, ya + e, dep, dep + L, "wall");
      fbox(f, ta, ta + e, ya + e, yb - e, dep, dep + L, "wall");
      fbox(f, tb - e, tb, ya + e, yb - e, dep, dep + L, "wall");
      const nl = Math.max(2, Math.round((tb - ta) / 3.4)),
        arm = 0.9 + Math.min(0.8, (yb - ya) * 0.05);
      for (let i = 0; i < nl; i++) {
        const t = ta + ((tb - ta) * (i + 0.5)) / nl;
        frm.setColor(0x26282b);
        fbox(
          f,
          t - 0.035,
          t + 0.035,
          yb + 0.05,
          yb + 0.12,
          dep,
          dep + arm,
          "pole",
        ); // arm
        fbox(
          f,
          t - 0.035,
          t + 0.035,
          yb - 0.25,
          yb + 0.12,
          dep + 0.02,
          dep + 0.1,
          "pole",
        ); // clamp on the frame
        fbox(
          f,
          t - 0.2,
          t + 0.2,
          yb - 0.02,
          yb + 0.16,
          dep + arm - 0.05,
          dep + arm + 0.22,
          "pole",
        ); // lamp head
        const q0 = P3(f, t - 0.18, yb - 0.025, dep + arm - 0.03),
          q1 = P3(f, t + 0.18, yb - 0.025, dep + arm + 0.2);
        lit.quad(
          [q0[0], yb - 0.025, q0[2]],
          [q1[0], yb - 0.025, q0[2]],
          [q1[0], yb - 0.025, q1[2]],
          [q0[0], yb - 0.025, q1[2]],
          [0, -1, 0],
          [0.5, 0.5, 0.5, 0.5],
          [1, 0.93, 0.8],
        );
      }
      return;
    }
    // raised bezel lip around the panel (reads as a real cabinet, casts a thin shadow line onto the LEDs)
    const L = opt.lip ?? (big ? 0.14 + rnd() * 0.16 : 0.06 + rnd() * 0.06);
    frm.setColor(fc);
    fbox(f, ta, tb, yb - e, yb, dep, dep + L, "wall");
    fbox(f, ta, tb, ya, ya + e, dep, dep + L, "wall");
    fbox(f, ta, ta + e, ya + e, yb - e, dep, dep + L, "wall");
    fbox(f, tb - e, tb, ya + e, yb - e, dep, dep + L, "wall");
    // trims: theatre marquee bulbs / LED dash columns / glowing LED edge bars / none
    // (billboards r6) opt.trim picks the trim explicitly ('bulbs' | 'cols' | 'bar' | 'none'); the LED dash columns stand
    // OUTSIDE the cabinet, so they only come when the caller reserved room for them (critic r5: boards clip neighbours)
    const q =
        opt.trim === "bulbs"
          ? 0
          : opt.trim === "cols"
            ? 0.3
            : opt.trim === "bar"
              ? 0.5
              : opt.trim === "none"
                ? 1
                : rnd(),
      o2 = dep + L + 0.01;
    const strip = (t0, y0, t1, y1, horiz, col, s, oo = o2) => {
      const len = horiz ? t1 - t0 : y1 - y0;
      lit.quad(
        P3(f, t0, y0, oo),
        P3(f, t1, y0, oo),
        P3(f, t1, y1, oo),
        P3(f, t0, y1, oo),
        n,
        !s
          ? [0.5, 0.5, 0.5, 0.5]
          : horiz
            ? [0, 0, len / s, 1]
            : [0, 0, 1, len / s],
        col,
      );
    };
    if (q < 0.2 && !opt.noTrim) {
      const col = [1.0, 0.82, 0.55],
        s = 0.34;
      strip(ta, yb - s, tb, yb, true, col, s);
      strip(ta, ya, tb, ya + s, true, col, s);
      strip(ta, ya + s, ta + s, yb - s, false, col, s);
      strip(tb - s, ya + s, tb, yb - s, false, col, s);
    } else if (q < 0.36 && opt.trim === "cols" && yb - ya > 6 && !opt.noTrim) {
      const col = LEDC[Math.floor(rnd() * 2)],
        s = 0.5,
        o3 = dep + 0.3;
      for (const t of [ta - 0.9, tb + 0.35]) {
        fbox(f, t, t + 0.55, ya, yb, 0, dep + 0.28, "wall", 0x16171a);
        if (gap)
          fbox(
            f0,
            t + 0.2,
            t + 0.35,
            ya + 0.4,
            yb - 0.4,
            0,
            gap,
            "wall",
            0x2b2d30,
          );
        lit.quad(
          P3(f, t + 0.08, ya + 0.3, o3),
          P3(f, t + 0.47, ya + 0.3, o3),
          P3(f, t + 0.47, yb - 0.3, o3),
          P3(f, t + 0.08, yb - 0.3, o3),
          n,
          [0, 0, 1, (yb - ya) / (s * 1.6)],
          col,
        );
      }
    } else if (q < 0.56) {
      const col = LEDC[Math.floor(rnd() * LEDC.length)],
        th = 0.12 + rnd() * 0.18;
      strip(ta, yb - th, tb, yb, true, col, 0);
      if (rnd() < 0.6) strip(ta, ya, tb, ya + th, true, col, 0);
    }
    if (opt.edgeLed) {
      const c = opt.edgeLed;
      strip(ta, ya, ta + 0.09, yb, false, c, 0);
      strip(tb - 0.09, ya, tb, yb, false, c, 0);
    } // (r6) frameless LED column: glowing edge lines
    // (r7) steel rigging on top of big LED cabinets (critic r6: 'no steel truss, no lighting rigs on top'): a Vierendeel
    // truss (two chords + posts) standing on the cabinet, carrying flood heads on arms that reach out over the face
    if (big && gap && opt.rig && yb - ya > 4) {
      const y0 = yb + 0.02,
        hT = Math.min(opt.rigH ?? 1.3, 0.8 + rnd() * 0.5),
        d0 = dep * 0.2,
        d1 = Math.min(dep, d0 + 0.5);
      frm.setColor(0x3b3e42);
      fbox(f, ta + 0.1, tb - 0.1, y0, y0 + 0.1, d0, d1, "pole");
      fbox(f, ta + 0.1, tb - 0.1, y0 + hT - 0.1, y0 + hT, d0, d1, "pole");
      const np = Math.max(2, Math.round((tb - ta) / 1.4) + 1);
      for (let i = 0; i < np; i++) {
        const t = ta + 0.1 + ((tb - ta - 0.3) * i) / (np - 1);
        fbox(
          f,
          t,
          t + 0.09,
          y0 + 0.1,
          y0 + hT - 0.1,
          d0 + 0.08,
          d1 - 0.08,
          "pole",
        );
      }
      const nl = Math.max(2, Math.round((tb - ta) / 4.5));
      for (let i = 0; i < nl; i++) {
        const t = ta + ((tb - ta) * (i + 0.5)) / nl;
        frm.setColor(0x232528);
        fbox(
          f,
          t - 0.04,
          t + 0.04,
          y0 + hT - 0.09,
          y0 + hT - 0.01,
          d1,
          dep + L + 0.85,
          "pole",
        );
        fbox(
          f,
          t - 0.17,
          t + 0.17,
          y0 + hT - 0.32,
          y0 + hT - 0.02,
          dep + L + 0.72,
          dep + L + 1.02,
          "pole",
        );
        const q0 = P3(f, t - 0.15, y0 + hT - 0.325, dep + L + 0.74),
          q1 = P3(f, t + 0.15, y0 + hT - 0.325, dep + L + 1.0);
        lit.quad(
          [q0[0], q0[1], q0[2]],
          [q1[0], q0[1], q0[2]],
          [q1[0], q0[1], q1[2]],
          [q0[0], q0[1], q1[2]],
          [0, -1, 0],
          [0.5, 0.5, 0.5, 0.5],
          [1, 0.95, 0.85],
        );
      }
    }
    // service catwalk (grating deck on brackets, posts + two rails) under big screens low on the podium / on towers
    if (
      gap &&
      !noWalk &&
      !opt.noWalk &&
      tb - ta > 7 &&
      (ya < 9.5 || opt.walk) &&
      rnd() < 0.2
    ) {
      // (r5) rarer + darker (critic: 'balcony pasted in front')
      const D = gap + dep + 1.0,
        y = ya - 0.14;
      frm.setColor(0x232427);
      fbox(f0, ta - 0.3, tb + 0.3, y, y + 0.08, 0, D, "roof");
      for (let t = ta - 0.25; t < tb + 0.3; t += 1.55)
        fbox(f0, t, t + 0.05, y + 0.08, y + 1.1, D - 0.06, D - 0.01, "pole");
      fbox(f0, ta - 0.3, tb + 0.3, y + 1.05, y + 1.1, D - 0.07, D, "pole");
      fbox(
        f0,
        ta - 0.3,
        tb + 0.3,
        y + 0.56,
        y + 0.6,
        D - 0.06,
        D - 0.01,
        "pole",
      );
      for (let t = ta + 0.4; t < tb - 0.3; t += 3.2)
        fbox(f0, t, t + 0.12, y - 0.55, y, 0, D - 0.4, "wall");
    }
  };
  // --- wraparound corner screen: face A straight run -> quarter arc (radius R) -> face B straight run, one continuous
  // ad across the corner. m: mass box, sa/sb: the two faces meeting at the corner, o: screen offset from the walls.
  const NRM = { px: [1, 0], nx: [-1, 0], pz: [0, 1], nz: [0, -1] };
  const wrap = (m, sa, sb, ya, yb, La, Lb, R = 3.4, o = 1.25, opt = {}) => {
    // (billboards r5) opt: {uv, tile (m), k}
    const nA = NRM[sa],
      nB = NRM[sb];
    for (const sd of [sa, sb]) {
      const F = faceOf(m, sd);
      scrRects.push({
        n: F.f.n,
        d: F.f.d,
        ta: -1e9,
        tb: 1e9,
        ya: ya - 0.5,
        yb: yb + 0.6,
      });
    }
    const cxz = [
      (nA[0] || nB[0]) > 0 ? m.x1 : m.x0,
      (nA[1] || nB[1]) > 0 ? m.z1 : m.z0,
    ];
    const at = (a, b) => [
      cxz[0] + nA[0] * a + nB[0] * b,
      cxz[1] + nA[1] * a + nB[1] * b,
    ]; // a along nA, b along nB
    const C = at(o - R, o - R);
    // frame / collision: straight slabs (wall .. o) + a cylinder for the arc
    frm.setColor(0x1d1e21);
    const slab = (p0, p1) =>
      box(
        Math.min(p0[0], p1[0]),
        ya,
        Math.min(p0[1], p1[1]),
        Math.max(p0[0], p1[0]),
        yb,
        Math.max(p0[1], p1[1]),
        "wall",
      );
    slab(at(0, o - R - La), at(o, o - R));
    slab(at(o - R - Lb, 0), at(o - R, o));
    frm.cyl(C[0], ya, C[1], R - 0.015, R - 0.015, yb - ya, 20, true);
    S.cyl(C[0], C[1], ya, yb, R, R, "wall");
    // (r7) projecting steel cap + sill plate (0.32 m proud of the LED face) over the whole curved wall: the wrap reads as
    // a deep cabinet with a lip instead of a printed band
    frm.setColor(0x2a2c30);
    for (const [y0, y1] of [
      [yb, yb + 0.34],
      [ya - 0.3, ya],
    ]) {
      const Rc = R + 0.32,
        oc = o + 0.32;
      frm.cyl(C[0], y0, C[1], Rc, Rc, y1 - y0, 40, true);
      S.cyl(C[0], C[1], y0, y1, Rc, Rc, "wall");
      for (const [p0, p1] of [
        [at(0, o - R - La - 0.3), at(oc, o - R)],
        [at(o - R - Lb - 0.3, 0), at(o - R, oc)],
      ])
        box(
          Math.min(p0[0], p1[0]),
          y0,
          Math.min(p0[1], p1[1]),
          Math.max(p0[0], p1[0]),
          y1,
          Math.max(p0[1], p1[1]),
          "wall",
        );
    }
    // the panel polyline A -> B
    const pts = [];
    pts.push([...at(o + 0.01, o - R - La), nA]);
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const th = ((i / N) * Math.PI) / 2,
        c = Math.cos(th),
        sn = Math.sin(th);
      const nn = [nA[0] * c + nB[0] * sn, nA[1] * c + nB[1] * sn];
      pts.push([C[0] + nn[0] * (R + 0.01), C[1] + nn[1] * (R + 0.01), nn]);
    }
    pts.push([...at(o - R - Lb, o + 0.01), nB]);
    // viewer's-left -> right order: face A's right direction is r(nA) = [nA.z, -nA.x]
    const right = [nA[1], -nA[0]];
    if (right[0] !== nB[0] || right[1] !== nB[1]) pts.reverse();
    const len = [0];
    for (let i = 1; i < pts.length; i++)
      len.push(
        len[i - 1] +
          Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
      );
    const W = len[len.length - 1],
      e = 0.18;
    const mid = at(o, o);
    const uv =
      opt.uv ??
      adUV(rnd, W / (yb - ya - 2 * e), pick, mid[0] + (ya + yb) * 0.15, mid[1]);
    const k = opt.k ?? 0.95 + rnd() * 0.2;
    // (billboards r5) tiled logo bands (the 'OUR OUR OUR' ring of ref ts_day_perch): split the polyline at every tile
    // boundary so each piece maps to [0, 1] of the cell (the atlas cannot repeat)
    const T = opt.tile ? W / Math.max(1, Math.round(W / opt.tile)) : W;
    if (opt.tile) {
      const P2 = [pts[0]],
        L2 = [0];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1],
          q = pts[i],
          la = len[i - 1],
          lb = len[i];
        for (
          let b = (Math.floor(la / T + 1e-6) + 1) * T;
          b < lb - 1e-4;
          b += T
        ) {
          const t = (b - la) / (lb - la),
            nn = [
              p[2][0] + (q[2][0] - p[2][0]) * t,
              p[2][1] + (q[2][1] - p[2][1]) * t,
            ],
            nl = Math.hypot(nn[0], nn[1]) || 1;
          P2.push([
            p[0] + (q[0] - p[0]) * t,
            p[1] + (q[1] - p[1]) * t,
            [nn[0] / nl, nn[1] / nl],
          ]);
          L2.push(b);
        }
        P2.push(q);
        L2.push(lb);
      }
      pts.length = 0;
      pts.push(...P2);
      len.length = 0;
      len.push(...L2);
    }
    {
      // (night) the wrap as a few near-planar rect emitters (chunks of the polyline within ~35 deg)
      let i0 = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i0],
          b = pts[i],
          last = i === pts.length - 1;
        const nx = pts[i][2],
          dev = a[2][0] * nx[0] + a[2][1] * nx[1];
        if (!last && dev > 0.82) continue;
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          L = Math.hypot(dx, dz);
        if (L > 0.5) {
          const u = [dx / L, 0, dz / L],
            nn = [u[2], 0, -u[0]],
            m2 = pts[Math.round((i0 + i) / 2)][2];
          if (nn[0] * m2[0] + nn[2] * m2[1] < 0) {
            nn[0] *= -1;
            nn[2] *= -1;
          }
          const cu = opt.tile
            ? null
            : [
                uv[0] + ((uv[2] - uv[0]) * len[i0]) / W,
                uv[1],
                uv[0] + ((uv[2] - uv[0]) * len[i]) / W,
                uv[3],
              ]; // (night r9) this chunk's part of the image
          SLS.rect(
            [
              (a[0] + b[0]) / 2 - nn[0] * 0.05,
              (ya + yb) / 2,
              (a[1] + b[1]) / 2 - nn[2] * 0.05,
            ],
            nn,
            u,
            L,
            yb - ya - 2 * e,
            uv.avg,
            1,
            cu ? { uv: cu } : {},
          ); // just behind the face (see screen())
          SLS.halo(
            [
              (a[0] + b[0]) / 2 - nn[0] * o * 0.5,
              (ya + yb) / 2,
              (a[1] + b[1]) / 2 - nn[2] * o * 0.5,
            ],
            nn,
            u,
            L,
            yb - ya - 2 * e,
            uv.avg,
          ); // in the gap to the walls
        }
        i0 = i;
      }
    }
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1],
        q = pts[i],
        kt = Math.floor((len[i - 1] + len[i]) / 2 / T);
      const u0 = uv[0] + (uv[2] - uv[0]) * (len[i - 1] / T - kt),
        u1 = uv[0] + (uv[2] - uv[0]) * (len[i] / T - kt);
      const nn = [(p[2][0] + q[2][0]) / 2, 0, (p[2][1] + q[2][1]) / 2];
      scr.quad(
        [p[0], ya + e, p[1]],
        [q[0], ya + e, q[1]],
        [q[0], yb - e, q[1]],
        [p[0], yb - e, p[1]],
        nn,
        [u0, uv[1], u1, uv[3]],
        [k, k, k],
      );
      // glowing LED edge bars top + bottom
      const col = LEDC[(i + Math.floor(ya)) % 2 ? 0 : 1];
      for (const [y0, y1] of [
        [yb - e, yb],
        [ya, ya + e],
      ]) {
        const pp = [p[0] + p[2][0] * 0.02, p[1] + p[2][1] * 0.02],
          qq = [q[0] + q[2][0] * 0.02, q[1] + q[2][1] * 0.02];
        lit.quad(
          [pp[0], y0, pp[1]],
          [qq[0], y0, qq[1]],
          [qq[0], y1, qq[1]],
          [pp[0], y1, pp[1]],
          nn,
          [0.5, 0.5, 0.5, 0.5],
          col,
        );
      }
    }
  };
  // fill a face rect [t0, t1] x [y0, y1] with a dense, irregular wall of screens
  const fillFace = (f, t0, t1, y0, y1, dens = 0.9) => {
    let y = y0;
    while (y < y1 - 3.5) {
      let h = Math.min(y1 - y, 7 + rnd() * 15);
      if (y1 - (y + h) < 4) h = y1 - y;
      const top = y + h >= y1 - 0.01; // (r7) the top row gets truss rigs standing above the podium roof line
      let t = t0 + rnd() * 0.8;
      while (t < t1 - 3) {
        let w = Math.min(t1 - t, h * (0.7 + rnd() * 2.4));
        if (t1 - (t + w) < 3.5) w = t1 - t;
        if (w < 3) break;
        if (rnd() < dens) {
          const hh = h * (0.82 + rnd() * 0.18),
            yo = y + (h - hh) * rnd();
          screen(f, t, t + w, yo, yo + hh, 0.35 + rnd() * rnd() * 2.4, {
            vinyl: rnd() < 0.1,
            rig: top && rnd() < 0.7,
          }); // (r9) vinyl 24 -> 10 % (critic: 'flat printed posters') // (r6) ~1/4 printed vinyl
        }
        t += w + 0.2 + rnd() * 0.9;
      }
      y += h + 0.3 + rnd() * 1.3;
    }
  };
  // ---------------------------------------------------------------- (billboards r6) sign TYPES + face composition
  // critic r5: 'a uniform wallpaper of identical flat rectangles with thin black bezels, packed wall-to-wall, no
  // hierarchy, no blade / neon / marquee / wrap variety'. A face now gets ONE dominant hero piece (55-80 % of the width)
  // plus at most 1-2 secondary pieces of a DIFFERENT type, with 1.4-2.6 m of bare facade between them.
  const FR_DARK = [0x1b1c1f, 0x222326, 0x151517, 0x2c2d31],
    FR_CHROME = [0xa9adb2, 0x8e9094, 0xc4c6c8],
    FR_GOLD = [0x9a7a40, 0x80642f, 0xb08d4a];
  const frameStyle = () => {
    const q = rnd(),
      a =
        q < 0.5
          ? FR_DARK
          : q < 0.72
            ? FR_CHROME
            : q < 0.86
              ? FR_GOLD
              : [0xd9d6ce, 0xe8e6e0];
    return a[Math.floor(rnd() * a.length)];
  };
  const NEON = [
    [1, 0.22, 0.55],
    [0.25, 0.85, 1],
    [1, 0.5, 0.15],
    [1, 0.14, 0.1],
    [0.75, 0.4, 1],
    [0.95, 0.95, 1],
  ];
  const neo = new QB(); // neon tube lettering (sign atlas, letters only: the board is discarded in the shader)
  // neon script sign: glowing tube letters on an open black raceway (or straight on the wall), stand-off brackets
  const neonSign = (f, ta, tb, ya, yb, opt = {}) => {
    scrRects.push({
      n: f.n,
      d: f.d,
      ta: ta - 0.5,
      tb: tb + 0.5,
      ya: ya - 0.5,
      yb: yb + 0.5,
    });
    const n = [f.n[0], 0, f.n[1]],
      col = opt.col ?? NEON[Math.floor(rnd() * NEON.length)],
      D = opt.dep ?? 0.3 + rnd() * 0.2;
    const uv = signCellUV(
      NEON_CELLS[Math.floor(rnd() * NEON_CELLS.length)],
      (tb - ta) / (yb - ya),
    );
    if (rnd() < 0.65)
      fbox(
        f,
        ta - 0.25,
        tb + 0.25,
        ya - 0.18,
        yb + 0.18,
        D - 0.07,
        D,
        "wall",
        0x111113,
      ); // raceway / backer
    frm.setColor(0x2a2b2e);
    for (const t of [ta + 0.35, (ta + tb) / 2, tb - 0.35])
      fbox(f, t - 0.04, t + 0.04, ya + 0.15, yb - 0.15, 0, D - 0.07, "pole");
    neo.quad(
      P3(f, ta, ya, D + 0.025),
      P3(f, tb, ya, D + 0.025),
      P3(f, tb, yb, D + 0.025),
      P3(f, ta, yb, D + 0.025),
      n,
      uv,
      col,
    );
    SLS.point(
      P3(f, (ta + tb) / 2, (ya + yb) / 2, D + 0.6),
      new THREE.Color(col[0], col[1], col[2]),
      6 + 2 * (tb - ta),
      7 + (tb - ta),
      0.35,
    ); // (night) neon glow on the wall / sidewalk
  };
  // tall frameless LED column (the full-height vertical fashion / brand boards of ref ts_day_perch), chrome edge
  const ledColumn = (f, ta, tb, ya, yb) =>
    screen(f, ta, tb, ya, yb, 0.45, {
      bezel: 0.05,
      lip: 0.02,
      frame: FR_CHROME[Math.floor(rnd() * 3)],
      trim: "none",
      noWalk: true,
      edgeLed: rnd() < 0.6 ? [0.85, 0.92, 1] : null,
    });
  // projecting cabinet sign with deep visible sides (0.9-1.4 m), thick bezel
  const cabinet = (f, ta, tb, ya, yb) =>
    screen(f, ta, tb, ya, yb, 0.9 + rnd() * 0.5, {
      gap: 0.25,
      bezel: 0.3 + rnd() * 0.2,
      lip: 0.18,
      frame: frameStyle(),
      trim: rnd() < 0.4 ? "bar" : "none",
      noWalk: true,
      noHalo: true,
    });
  // vinyl building wrap: printed mesh stretched on a thin tension frame 9 cm off the facade, vertical panel seams and the
  // window heads ghosting through the mesh (lit by the sun, not emissive)
  const vinylWrap = (f, ta, tb, ya, yb, fh = 3.8) => {
    scrRects.push({ n: f.n, d: f.d, ta, tb, ya, yb: yb + 1 });
    const n = [f.n[0], 0, f.n[1]],
      o = 0.09,
      cc = P3(f, (ta + tb) / 2, 0, 0),
      k = 0.88 + rnd() * 0.16;
    vin.quad(
      P3(f, ta, ya, o),
      P3(f, tb, ya, o),
      P3(f, tb, yb, o),
      P3(f, ta, yb, o),
      n,
      adUV(rnd, (tb - ta) / (yb - ya), pick, cc[0] + ya * 0.15, cc[2]),
      [k, k, k],
    );
    frm.setColor(0x3a3c40);
    fbox(f, ta - 0.08, tb + 0.08, yb, yb + 0.1, 0, o + 0.04, "wall");
    fbox(f, ta - 0.08, tb + 0.08, ya - 0.1, ya, 0, o + 0.04, "wall");
    fbox(f, ta - 0.1, ta, ya, yb, 0, o + 0.04, "wall");
    fbox(f, tb, tb + 0.1, ya, yb, 0, o + 0.04, "wall");
    const nd = Math.max(2, Math.round((tb - ta) / 2.5)),
      dw = (tb - ta) / nd;
    for (let i = 1; i < nd; i++) {
      const t = ta + i * dw;
      ao.quad(
        P3(f, t - 0.04, ya, o + 0.006),
        P3(f, t + 0.04, ya, o + 0.006),
        P3(f, t + 0.04, yb, o + 0.006),
        P3(f, t - 0.04, yb, o + 0.006),
        n,
        AO_BOX,
        [0.5, 0.5, 0.5],
      );
    }
    for (let y = ya + fh * (0.3 + rnd() * 0.4); y < yb - 0.3; y += fh)
      ao.quad(
        P3(f, ta, y, o + 0.006),
        P3(f, tb, y, o + 0.006),
        P3(f, tb, y + 0.35, o + 0.006),
        P3(f, ta, y + 0.35, o + 0.006),
        n,
        AO_BOX,
        [0.16, 0.16, 0.16],
      );
    const a = P3(f, ta, ya, 0),
      b = P3(f, tb, yb, o + 0.02);
    S.box(
      Math.min(a[0], b[0]),
      ya,
      Math.min(a[2], b[2]),
      Math.max(a[0], b[0]),
      yb,
      Math.max(a[2], b[2]),
      "wall",
    );
  };
  // secondary piece in the strip beside the hero
  const secondary = (f, sa, sb, y0, y1, outerLo) => {
    const SW = sb - sa,
      H = y1 - y0,
      q = rnd();
    if (q < 0.34 && H > 9) {
      // tall LED column at the outer face edge
      const c = Math.min(SW, 3.2 + rnd() * 2.8),
        h = Math.min(H, Math.max(c * 3.2, H * (0.7 + rnd() * 0.3)));
      const a = outerLo ? sa : sb - c;
      ledColumn(f, a, a + c, y1 - h, y1);
      if (SW - c > 8 && rnd() < 0.5) {
        const w = Math.min(SW - c - 2, 4 + rnd() * 4),
          b0 = outerLo ? a + c + 1.8 : a - 1.8 - w,
          yy = y0 + rnd() * Math.max(0, H - w / 4 - 1);
        neonSign(f, b0, b0 + w, yy, yy + w / 4.2);
      }
    } else if (q < 0.58) {
      // neon script sign
      const w = Math.min(SW - 0.5, 4 + rnd() * 5),
        h = w / 4.2,
        a = sa + (SW - w) * rnd(),
        yy = y0 + 1 + rnd() * Math.max(0, H - h - 2);
      if (w > 2.5) neonSign(f, a, a + w, yy, yy + h);
    } else if (q < 0.8) {
      // 1-2 projecting cabinets stacked with facade between
      const w = Math.min(SW, 4 + rnd() * 4),
        a = outerLo ? sa : sb - w,
        h = w * (0.55 + rnd() * 0.5);
      let y = y1 - h;
      for (let i = 0; i < 2 && y > y0; i++) {
        cabinet(f, a, a + w, y, y + h);
        y -= h + 2 + rnd() * 3;
        if (rnd() < 0.5) break;
      }
    } // else: bare facade (negative space)
  };
  // band piece above / below the hero
  const heroBand = (f, ta, tb, ya, yb) => {
    const V = yb - ya,
      q = rnd();
    if (q < 0.4) {
      ticker(f, ta, tb, yb - Math.min(V, 1.25), Math.min(V, 1.25));
      if (V > 3.4 && rnd() < 0.5) ticker(f, ta, tb, yb - 2.9, 1.1);
    } else if (q < 0.62) {
      const h = Math.min(V - 0.2, 1.6 + rnd() * 1.2),
        w = Math.min(tb - ta - 1, h * 4.2),
        a = ta + (tb - ta - w) * rnd();
      if (w > 3) neonSign(f, a, a + w, yb - h - 0.1, yb - 0.1);
    } else if (q < 0.82 && V > 3) {
      const n = 2 + Math.floor(rnd() * 2),
        g = 1.8 + rnd(),
        w = Math.min(7, (tb - ta - (n - 1) * g) / n),
        h = Math.min(V - 0.4, w * 0.6);
      if (w > 2.5)
        for (let i = 0; i < n; i++) {
          const a = ta + (tb - ta - n * w - (n - 1) * g) / 2 + i * (w + g);
          cabinet(f, a, a + w, yb - h, yb);
        }
    }
  };
  const composeFace = (f, t0, t1, y0, y1, o = {}) => {
    const pad = o.pad ?? 1.8;
    t0 += pad;
    t1 -= pad; // keep the building corners clear (cabinets on both faces met there)
    const W = t1 - t0,
      H = y1 - y0;
    if (W < 5 || H < 4) return;
    if (W > 50) {
      const m = t0 + W * (0.42 + rnd() * 0.16),
        o2 = { ...o, pad: 0 };
      composeFace(f, t0, m - 1.2, y0, y1, o2);
      composeFace(f, m + 1.2, t1, y0, y1, o2);
      return;
    }
    const GAP = 1.4 + rnd() * 1.2;
    let hh = H * (0.6 + rnd() * 0.32);
    if (H - hh < GAP + 2) hh = H;
    let hw = Math.min(W * (0.55 + rnd() * 0.25), hh * 3.2);
    if (W - hw < GAP + 3) hw = W;
    const atHi = o.heroHi ?? rnd() < 0.5,
      atTop = rnd() < 0.62;
    const ha = atHi ? t1 - hw : t0,
      hb = ha + hw,
      hy0 = atTop ? y1 - hh : y0,
      hy1 = hy0 + hh,
      top = hy1 >= y1 - 0.01;
    const q = rnd();
    if (q < 0.4)
      screen(f, ha, hb, hy0, hy1, 0.5 + rnd() * 0.7, {
        frame: frameStyle(),
        bezel: rnd() < 0.3 ? 0.05 : 0.35 + rnd() * 0.45,
        lip: rnd() < 0.3 ? 0.02 : undefined,
        trim: rnd() < 0.45 ? "bar" : "none",
        rig: top && rnd() < 0.7,
      });
    else if (q < 0.64 && !o.noWrap) vinylWrap(f, ha, hb, hy0, hy1, o.fh);
    else if (q < 0.8)
      screen(f, ha, hb, hy0, hy1, 0.55 + rnd() * 0.5, {
        frame: rnd() < 0.6 ? FR_GOLD[Math.floor(rnd() * 3)] : 0x1a1a1c,
        bezel: 0.45 + rnd() * 0.25,
        trim: "bulbs",
        rig: top && rnd() < 0.4,
      });
    else
      screen(f, ha, hb, hy0, hy1, 0.4, {
        vinyl: true,
        frame: frameStyle(),
        walk: hy0 < 14,
      });
    const sa = atHi ? t0 : hb + GAP,
      sb = atHi ? ha - GAP : t1;
    if (sb - sa >= 2.6) secondary(f, sa, sb, y0, y1, atHi);
    const va = atTop ? y0 : hy1 + GAP,
      vb = atTop ? hy0 - GAP : y1;
    if (vb - va >= 1.4) heroBand(f, ha, hb, va, vb);
  };
  // storefront sign band just above the shop fronts
  // storefront modules: lit interior seen through the glass (ts_shops.webp), mullions, kick plate, entrance door with
  // push bar, a coloured canopy and the illuminated sign band above
  const PIER = [0x8c8680, 0x6f6a64, 0x3a3836, 0xa49a8c, 0x5b4a3e, 0x2c2e31];
  const CANOPY = [
    0x2a2b2e, 0x8e2226, 0x245236, 0x23346a, 0x6a4a24, 0x151515, 0xa87a22,
    0x7a1e44,
  ]; // (r9) + brighter awnings
  const storefront = (f, t, w) => {
    const y0 = CH,
      y1 = 4.65,
      n = [f.n[0], 0, f.n[1]]; // (r9) taller ground floor (was 4.15; critic: 'storefront level is a thin strip')
    const bays = Math.max(1, Math.round(w / 3.6)),
      bw = w / bays,
      shop = Math.floor(rnd() * 8);
    for (let i = 0; i < bays; i++) {
      const ta = t + i * bw,
        tb = ta + bw;
      const iu = (shop + (i % 2)) % 8,
        u0 = (iu % 4) / 4 + 0.004,
        v1 = 1 - Math.floor(iu / 4) / 2 - 0.004;
      const k = 0.8 + rnd() * 0.35;
      // (r6) interior-mapped room behind the glass (5.5 m deep box: floor, ceiling lights, side walls, the shop card
      // on the back wall) -- real parallax depth instead of a picture glued on the glass
      shp.room(
        P3(f, ta, y0 + 0.5, 0.035),
        P3(f, tb, y0 + 0.5, 0.035),
        P3(f, tb, y1, 0.035),
        P3(f, ta, y1, 0.035),
        n,
        [u0, v1 - 0.49, u0 + 0.242, v1],
        [k, k, k],
        [f.r[0], 0, f.r[1]],
        tb - ta,
        y1 - y0 - 0.5,
      );
    }
    // (r6) sidewalk contact AO along the shop front
    aoStrip(
      P3(f, t - 0.6, yAO, 0.42),
      P3(f, t + w + 0.6, yAO, 0.42),
      [f.n[0], 0, f.n[1]],
      1.5,
      0.5,
    );
    frm.setColor(0x1e1f22);
    fbox(f, t, t + w, y0, y0 + 0.5, 0, 0.06, "wall"); // kick plate
    fbox(f, t, t + w, 3.6, 3.7, 0.035, 0.06, "wall"); // transom bar
    fbox(f, t, t + w, y1, y1 + 0.08, 0, 0.06, "wall"); // head
    for (let i = 0; i <= bays; i++) {
      const tm = t + i * bw;
      fbox(
        f,
        Math.max(t, tm - 0.05),
        Math.min(t + w, tm + 0.05),
        y0 + 0.5,
        y1,
        0.035,
        0.06,
        "wall",
      );
    }
    // door in the middle bay: dark frame + steel push bar
    const dc = t + (Math.floor(bays / 2) + 0.5) * bw;
    fbox(f, dc - 0.95, dc - 0.87, y0, 3.6, 0.035, 0.06, "wall");
    fbox(f, dc + 0.87, dc + 0.95, y0, 3.6, 0.035, 0.06, "wall");
    frm.setColor(0xb8bcbf);
    fbox(f, dc - 0.8, dc + 0.8, 1.1, 1.16, 0.035, 0.06, "wall");
    S.box(
      ...(() => {
        const a = P3(f, t, y0, 0),
          b = P3(f, t + w, y1, 0.06);
        return [
          Math.min(a[0], b[0]),
          y0,
          Math.min(a[2], b[2]),
          Math.max(a[0], b[0]),
          y1,
          Math.max(a[2], b[2]),
        ];
      })(),
      "wall",
    );
    // recess: stone piers at both ends + a header fascia stand 0.42 m proud of the glass (the shop front reads as set
    // back into the building instead of a decal on the wall); piers get a dark base and a thin cap line
    const pc = PIER[Math.floor(rnd() * PIER.length)];
    for (const [pa, pb] of [
      [t - 0.55, t],
      [t + w, t + w + 0.55],
    ]) {
      fbox(f, pa, pb, 0, 4.7, 0, 0.42, "wall", pc);
      fbox(f, pa - 0.02, pb + 0.02, 0, 0.45, 0, 0.44, "wall", 0x2a2a2c);
    }
    fbox(f, t, t + w, y1 + 0.08, 4.7, 0, 0.42, "wall", pc);
  };
  const signBand = (f, t0, t1) => {
    let t = t0 + 0.6;
    while (t < t1 - 3) {
      const w = Math.min(t1 - 0.6 - t, 6 + rnd() * 9);
      if (w < 3) break;
      screen(f, t, t + w, 5.0, 7.25, 0.3, {
        sign: true,
        bezel: 0.1,
        frame: 0x121214,
        bright: 1.15,
      }); // (r9) 1.6 -> 2.25 m tall signs
      storefront(f, t, w);
      // shallow canopy / marquee soffit under the sign (varied colours), with a glowing downlight strip underneath
      const mq = w > 6 && rnd() < 0.28; // theatre-style marquee: deep canopy, sign faces + chasing bulb borders
      const D = mq ? 2.6 + rnd() * 0.8 : 1.6,
        yT = mq ? 5.8 : 5.0;
      const a = P3(f, t, 4.7, 0),
        b = P3(f, t + w, yT, D);
      frm
        .setColor(mq ? 0x1a1a1c : CANOPY[Math.floor(rnd() * CANOPY.length)])
        .box(
          Math.min(a[0], b[0]),
          4.7,
          Math.min(a[2], b[2]),
          Math.max(a[0], b[0]),
          yT,
          Math.max(a[2], b[2]),
        );
      S.box(
        Math.min(a[0], b[0]),
        4.7,
        Math.min(a[2], b[2]),
        Math.max(a[0], b[0]),
        yT,
        Math.max(a[2], b[2]),
        "awning",
      );
      if (mq) {
        const n = [f.n[0], 0, f.n[1]],
          o = D + 0.012,
          bc = [1.0, 0.8, 0.5];
        sgn.quad(
          P3(f, t + 0.35, 4.95, o),
          P3(f, t + w - 0.35, 4.95, o),
          P3(f, t + w - 0.35, 5.55, o),
          P3(f, t + 0.35, 5.55, o),
          n,
          signUV(rnd, (w - 0.7) / 0.6),
          [1, 1, 1],
        );
        const bs = 0.2;
        for (const [y0, y1] of [
          [4.72, 4.92],
          [5.58, 5.78],
        ])
          lit.quad(
            P3(f, t, y0, o + 0.005),
            P3(f, t + w, y0, o + 0.005),
            P3(f, t + w, y1, o + 0.005),
            P3(f, t, y1, o + 0.005),
            n,
            [0, 0, w / bs, 1],
            bc,
          );
        // bulb rows along both marquee ends (side faces)
        for (const [tt, sgnr] of [
          [t - 0.012, -1],
          [t + w + 0.012, 1],
        ]) {
          const rr = [f.r[0] * sgnr, 0, f.r[1] * sgnr];
          const q0 = P3(f, tt, 4.72, 0.1),
            q1 = P3(f, tt, 4.72, D),
            q2 = P3(f, tt, 4.92, D),
            q3 = P3(f, tt, 4.92, 0.1);
          lit.quad(q0, q1, q2, q3, rr, [0, 0, (D - 0.1) / bs, 1], bc);
          const r0 = P3(f, tt, 5.58, 0.1),
            r1 = P3(f, tt, 5.58, D),
            r2 = P3(f, tt, 5.78, D),
            r3 = P3(f, tt, 5.78, 0.1);
          lit.quad(r0, r1, r2, r3, rr, [0, 0, (D - 0.1) / bs, 1], bc);
        }
        // soffit: a dense grid of downlight bulbs under the marquee
        const s0 = P3(f, t + 0.2, 4.695, 0.3),
          s1 = P3(f, t + w - 0.2, 4.695, D - 0.2);
        SLS.point(
          P3(f, t + w / 2, 4.3, D * 0.6),
          new THREE.Color(1.0, 0.72, 0.42),
          10 + 2.5 * w,
          12,
          0.4,
        ); // (night) marquee bulbs light the sidewalk
        lit.quad(
          [s0[0], 4.695, s0[2]],
          [s1[0], 4.695, s0[2]],
          [s1[0], 4.695, s1[2]],
          [s0[0], 4.695, s1[2]],
          [0, -1, 0],
          [
            0,
            0,
            Math.abs(s1[0] - s0[0]) / 0.45,
            Math.abs(s1[2] - s0[2]) / 0.45,
          ],
          [1, 0.9, 0.7],
        );
        t += w + 0.8 + rnd() * 2;
        continue;
      }
      const l0 = P3(f, t + 0.3, 4.695, 1.1),
        l1 = P3(f, t + w - 0.3, 4.695, 1.3);
      lit.quad(
        [l0[0], 4.695, l0[2]],
        [l1[0], 4.695, l0[2]],
        [l1[0], 4.695, l1[2]],
        [l0[0], 4.695, l1[2]],
        [0, -1, 0],
        [0.5, 0.5, 0.5, 0.5],
        [1, 0.92, 0.78],
      );
      t += w + 0.8 + rnd() * 2;
    }
  };
  const faceOf = (m, side) => {
    // outward face of an axis-aligned mass
    if (side === "px")
      return { f: { n: [1, 0], r: [0, -1], d: m.x1 }, t0: -m.z1, t1: -m.z0 };
    if (side === "nx")
      return { f: { n: [-1, 0], r: [0, 1], d: -m.x0 }, t0: m.z0, t1: m.z1 };
    if (side === "pz")
      return { f: { n: [0, 1], r: [1, 0], d: m.z1 }, t0: m.x0, t1: m.x1 };
    return { f: { n: [0, -1], r: [-1, 0], d: -m.z0 }, t0: -m.x1, t1: -m.x0 };
  };

  // (r4) LED news zipper: a thin cabinet with a scrolling dot-matrix ticker (ts_ticker.webp, scrolled in onBeforeRender)
  const tck = new QB();
  const ticker = (f, ta, tb, ya, h, u0 = rnd()) => {
    fbox(f, ta, tb, ya, ya + h, 0, 0.4, "wall", 0x141416);
    const n = [f.n[0], 0, f.n[1]],
      e = 0.08,
      len = tb - ta - 2 * e,
      du = len / ((h - 2 * e) * 32);
    tck.quad(
      P3(f, ta + e, ya + e, 0.412),
      P3(f, tb - e, ya + e, 0.412),
      P3(f, tb - e, ya + h - e, 0.412),
      P3(f, ta + e, ya + h - e, 0.412),
      n,
      [u0, 0, u0 + du, 1],
    );
    return u0 + du;
  };
  // (r4) vertical blade sign: a double-sided portrait LED slab sticking out of the facade with a bulb-lit front edge
  const blade = (f, t, y0, y1, P) => {
    scrRects.push({
      n: f.n,
      d: f.d,
      ta: t - 0.8,
      tb: t + 0.8,
      ya: y0 - 0.5,
      yb: y1 + 0.5,
    });
    fbox(f, t - 0.22, t + 0.22, y0, y1, 0, P, "wall", 0x1a1b1e);
    const c = P3(f, t, 0, P),
      uv = adUV(
        rnd,
        (P - 0.35) / (y1 - y0 - 0.5),
        pick,
        c[0] + y0 * 0.15,
        c[2],
      );
    for (const sg of [1, -1]) {
      const tt = t + sg * 0.225,
        N = [f.r[0] * sg, 0, f.r[1] * sg],
        oa = sg > 0 ? P - 0.1 : 0.25,
        ob = sg > 0 ? 0.25 : P - 0.1;
      scr.quad(
        P3(f, tt, y0 + 0.25, oa),
        P3(f, tt, y0 + 0.25, ob),
        P3(f, tt, y1 - 0.25, ob),
        P3(f, tt, y1 - 0.25, oa),
        N,
        uv,
        [1, 1, 1],
      );
      SLS.rect(
        P3(f, tt + sg * 0.06, (y0 + y1) / 2, (P + 0.15) / 2),
        N,
        [f.n[0] * -sg, 0, f.n[1] * -sg],
        P - 0.35,
        y1 - y0 - 0.5,
        uv.avg,
      ); // (night)
    }
    lit.quad(
      P3(f, t - 0.2, y0, P + 0.01),
      P3(f, t + 0.2, y0, P + 0.01),
      P3(f, t + 0.2, y1, P + 0.01),
      P3(f, t - 0.2, y1, P + 0.01),
      [f.n[0], 0, f.n[1]],
      [0, 0, 1, (y1 - y0) / 0.3],
      [1, 0.82, 0.55],
    );
  };

  // ---------------------------------------------------------------- billboard towers
  const rightOf = (sd) => {
    const n = NRM[sd];
    return [n[1], -n[0]];
  };
  const hiEnd = (face, sd) => {
    const r = rightOf(face),
      n = NRM[sd];
    return r[0] === n[0] && r[1] === n[1];
  }; // corner (face x sd) at the t1 end?
  for (const R of gen.reserves) {
    if (!R.ts || !R.build) continue;
    const [pod, tw] = R.build.masses;
    let roofSpan = null; // (r11) the podium-roof billboard's face span (the edge toppers keep clear of it)
    const face = R.face;
    // wraparound corner screens at the avenue corners of the podium (curved LED walls, refs 14 / 15)
    const cut = { [face]: [0, 0], nz: [0, 0], pz: [0, 0] }; // metres kept free at the [t0, t1] ends of each face
    const RW = 3.4,
      OW = 1.25;
    for (const sd of ["nz", "pz"]) {
      if (R.lot.sides[sd] !== "street" || rnd() < 0.3) continue; // (billboards r6) 0.15 -> 0.3 (fewer, bigger pieces)
      const La = 7 + rnd() * 8,
        Lb = 5 + rnd() * 6;
      let y = 8.5 + rnd() * 3,
        yTop = 0;
      while (y < pod.y1 - 8) {
        const h = Math.min(pod.y1 - 0.8 - y, 8 + rnd() * 12);
        if (h < 6) break;
        wrap(pod, face, sd, y, y + h, La, Lb, RW, OW);
        yTop = y + h;
        y += h + 0.75 + rnd() * 2.5; // (r7) room for the cap / sill plates
        if (rnd() < 0.55) break; // (r6) was 0.25: one tall curved screen, rarely a stack
      }
      // (billboards r5) ref ts_day_perch: a white 'OUR OUR OUR' logo ring band running round the top of the curved
      // corner screen (same arc, its own cap / sill plates; may stand a little above the podium roof line)
      if (yTop && yTop + 4.6 < pod.y1 + 4.2 && r5() < (ringN ? 0.45 : 0.9)) {
        const bh = 3.3 + r5() * 0.8,
          uvR = namedUV("L41", 0, [0.27, 0.71]);
        if (uvR) {
          wrap(pod, face, sd, yTop + 0.55, yTop + 0.55 + bh, La, Lb, RW, OW, {
            uv: uvR,
            tile: (bh - 0.36) * 4.4,
            k: 0.62,
          });
          ringN++;
        }
      }
      cut[face][hiEnd(face, sd) ? 1 : 0] = RW - OW + La + 0.6;
      cut[sd][hiEnd(sd, face) ? 1 : 0] = RW - OW + Lb + 0.6;
    }
    // avenue face: the whole podium is screens
    {
      const { f, t0, t1 } = faceOf(pod, face);
      const tk0 = rnd() < 0.55; // news zipper along the avenue face between the shop signs and the screen wall
      if (tk0) {
        ticker(f, t0 + 0.5 + cut[face][0], t1 - 0.5 - cut[face][1], 7.4, 0.95);
        noWalk = true;
      }
      // (r5) a big double-sided LED blade projecting 3.6-5 m from the avenue face (reads edge-on along the avenue, gives
      // the screen wall depth / protruding boxes); the screen wall leaves a slot for it
      const A0 = t0 + 0.5 + cut[face][0],
        A1 = t1 - 0.5 - cut[face][1];
      if (A1 - A0 > 14 && rnd() < 0.7) {
        const bl = A0 + 4 + rnd() * (A1 - A0 - 8),
          by0 = 8.7 + rnd() * 3,
          by1 = Math.min(pod.y1 - 1, by0 + 14 + rnd() * 16);
        composeFace(f, A0, bl - 2, 8.6, pod.y1 - 0.6);
        composeFace(f, bl + 2, A1, 8.6, pod.y1 - 0.6); // (billboards r6) hierarchy, not wallpaper
        blade(f, bl, by0, by1, 3.6 + rnd() * 1.4);
      } else if (
        A1 - A0 > 24 &&
        pod.y1 > 22 &&
        r5() < (gridN ? 0.4 : 0.85) &&
        namedUV("L42", 1.8)
      ) {
        // (billboards r5) ref ts_day_perch: a 3 x 3 grid of separate LED cabinets all running the same (pink PUREWAVE)
        // spot, with gaps showing the facade between them; screen walls fill the rest of the face
        const cw = 4.4 + r5() * 0.8,
          ch = cw / 1.75,
          gx = 0.55 + r5() * 0.3,
          gw = 3 * cw + 2 * gx,
          gh = 3 * ch + 2 * gx;
        const gA = A0 + 3 + r5() * (A1 - A0 - gw - 6),
          gB = gA + gw,
          gy = Math.min(pod.y1 - 1 - gh, 9.2 + r5() * 4);
        const uvG = namedUV("L42", cw / ch);
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) {
            const a = gA + i * (cw + gx),
              y0 = gy + j * (ch + gx);
            screen(f, a, a + cw, y0, y0 + ch, 0.35, {
              uv: uvG,
              noTrim: true,
              noWalk: true,
              gap: 0.3,
              bright: 0.72,
              noHalo: i !== 1 || j !== 1,
            });
          }
        if (gA - A0 > 6) composeFace(f, A0, gA - 2, 8.6, pod.y1 - 0.6);
        if (A1 - gB > 6) composeFace(f, gB + 2, A1, 8.6, pod.y1 - 0.6);
        if (pod.y1 - 0.6 - (gy + gh + 2) > 3)
          heroBand(f, gA, gB, gy + gh + 2, pod.y1 - 0.6);
        gridN++;
      } else composeFace(f, A0, A1, 8.6, pod.y1 - 0.6);
      signBand(f, t0, t1);
      noWalk = false;
    }
    // cross-street faces: screens within ~30 m of the avenue corner, sign bands along the shop fronts
    for (const sd of ["nz", "pz"]) {
      if (R.lot.sides[sd] !== "street") continue;
      const { f, t0, t1 } = faceOf(pod, sd);
      const nearHi = hiEnd(sd, face);
      const span = Math.min(t1 - t0, 26 + rnd() * 12);
      let a = nearHi ? t1 - span : t0,
        b = nearHi ? t1 : t0 + span;
      if (nearHi) b -= cut[sd][1];
      else a += cut[sd][0];
      // (billboards r5) ref ts_rooftop_day: a row of 4-6 identical portrait posters side by side (one campaign repeated
      // along the frieze) under the screen wall
      const pw = 3.4 + r5() * 0.9,
        ph = pw * 1.8,
        np = Math.min(6, Math.floor((b - a - 0.8) / (pw + 0.35)));
      if (np >= 3 && pod.y1 - 9 - ph > 7 && r5() < 0.45) {
        const cc = P3(f, (a + b) / 2, 0, 0),
          uvP = cellUV(false, pick(false, cc[0], cc[2]), pw / ph),
          vinR = r5() < 0.5;
        const a0 = (a + b) / 2 - (np * pw + (np - 1) * 0.35) / 2;
        for (let i = 0; i < np; i++) {
          const x = a0 + i * (pw + 0.35);
          screen(f, x, x + pw, 8.8, 8.8 + ph, 0.3, {
            uv: uvP,
            vinyl: vinR,
            noTrim: true,
            noWalk: true,
            gap: 0.25,
            bright: vinR ? 0.95 : 0.8,
            noHalo: true,
          });
        }
        heroBand(f, a + 0.4, b - 0.4, 8.8 + ph + 2, pod.y1 - 0.6);
      } else
        composeFace(f, a + 0.4, b - 0.4, 8.4, pod.y1 - 0.6, { heroHi: nearHi });
      signBand(f, t0, t1);
      // blade signs further down the side street (seen along the avenue, ref 14)
      for (
        let k = 0, tb0 = nearHi ? t1 - span - 3 : t0 + span + 3;
        k < 2;
        k++
      ) {
        if (rnd() < 0.35) continue;
        const tb = tb0 + (nearHi ? -1 : 1) * k * (9 + rnd() * 6);
        if (tb < t0 + 2 || tb > t1 - 2) continue;
        const y0 = 8 + rnd() * 2,
          y1 = Math.min(pod.y1 - 1, y0 + 9 + rnd() * 9);
        if (y1 - y0 > 6) blade(f, tb, y0, y1, 2.6 + rnd() * 0.8);
      }
    }
    // tower: a wraparound corner screen or tall vertical screens on the avenue face + near corners of the street faces
    if (tw) {
      const { f, t0, t1 } = faceOf(tw, face);
      const sds = ["nz", "pz"].filter((sd) => R.lot.sides[sd] === "street");
      // (billboards r4) user refs city3/ts_day_perch + ts_rooftop_day: the signature full-height fashion wrap - one huge
      // portrait vinyl / LED print over the whole tower face, 10-16 floors (own stream r4b; the other towers keep their ads)
      const bigWrap = t1 - t0 > 14 && tw.y1 - tw.y0 > 60 && r4b() < 0.42;
      if (bigWrap) {
        const w = t1 - t0 - 1.6,
          h = Math.min(tw.y1 - tw.y0 - 12, w * (1.45 + r4b() * 0.35)),
          y0 = tw.y0 + 2 + r4b() * 6;
        const vin = r4b() < 0.45,
          cc = P3(f, (t0 + t1) / 2, 0, 0);
        screen(f, t0 + 0.8, t0 + 0.8 + w, y0, y0 + h, 0.5, {
          walk: true,
          vinyl: vin,
          rig: !vin,
          bright: vin ? 0.95 : undefined,
          noTrim: true,
          uv: adUV(r4b, Math.min(0.74, w / h), pick, cc[0] + y0 * 0.15, cc[2]),
        });
      } else if (sds.length && rnd() < 0.55) {
        const sd = sds[Math.floor(rnd() * sds.length)];
        const y0 = tw.y0 + 3 + rnd() * 8,
          h = Math.min(tw.y1 - y0 - 6, 18 + rnd() * 26);
        if (h > 10)
          wrap(
            tw,
            face,
            sd,
            y0,
            y0 + h,
            Math.min(t1 - t0 - 8, 8 + rnd() * 8),
            6 + rnd() * 6,
            3.0,
            1.1,
          );
      } else {
        const n = 1 + (rnd() < 0.35 ? 1 : 0); // (billboards r6) 1-2 big tower screens (was 2-4: critic r5 'wallpaper')
        let y = tw.y0 + 2 + rnd() * 6;
        for (let i = 0; i < n && y < tw.y1 - 20; i++) {
          const h = Math.min(tw.y1 - 4 - y, 22 + rnd() * 34),
            w = Math.min(t1 - t0 - 3, 12 + rnd() * 14);
          const c = t0 + 1.5 + rnd() * (t1 - t0 - 3 - w);
          if (i === 0 && rnd() < 0.3)
            vinylWrap(f, c, c + w, y, y + h); // (r6) mesh vinyl wrap over the windows
          else
            screen(f, c, c + w, y, y + h, 0.5 + rnd() * 0.8, {
              walk: true,
              vinyl: rnd() < 0.15,
              rig: rnd() < 0.6,
              frame: frameStyle(),
              bezel: rnd() < 0.35 ? 0.05 : undefined,
            });
          y += h + 2 + rnd() * 8;
        }
        for (const sd of sds) {
          if (rnd() < 0.45) continue; // (billboards r6) back to 0.45 (r3: 0.15 over-packed the towers)
          const F = faceOf(tw, sd);
          const nearHi = hiEnd(sd, face);
          const w = Math.min(F.t1 - F.t0 - 2, 10 + rnd() * 10),
            h = Math.min(tw.y1 - tw.y0 - 6, 14 + rnd() * 26);
          const a = nearHi ? F.t1 - w - 0.8 : F.t0 + 0.8,
            y0 = tw.y0 + 3 + rnd() * 10;
          screen(F.f, a, a + w, y0, y0 + h, 0.6, { rig: rnd() < 0.5 });
        }
      }
    }
    // (billboards r4) LED ribbon edges (ref city3/ts_night: rows of white LED dashes up both edges of the tower face, one
    // per floor): short lit bars on the avenue face corners of the tower, the full tower height
    if (tw && r4b() < 0.7) {
      const { f, t0, t1 } = faceOf(tw, face),
        fh = 3.8,
        n = [f.n[0], 0, f.n[1]],
        dw = 0.9 + r4b() * 0.5,
        dh = 0.22 + r4b() * 0.1;
      const col =
        r4b() < 0.75
          ? [0.78, 0.9, 0.96]
          : LEDC[Math.floor(r4b() * 4)].map((v) => v * 0.85);
      const inset = 0.25 + r4b() * 0.6;
      for (const ta of [t0 + inset, t1 - inset - dw])
        for (let y = tw.y0 + 1.4; y < tw.y1 - 1.5; y += fh) {
          lit.quad(
            P3(f, ta, y, 0.07),
            P3(f, ta + dw, y, 0.07),
            P3(f, ta + dw, y + dh, 0.07),
            P3(f, ta, y + dh, 0.07),
            n,
            [0.5, 0.5, 0.5, 0.5],
            col,
          );
        }
    }
    // (night r9) ref ts_perch_night: the perch ledge / roof deck is flooded pink by a big LED screen right beside it. The
    // west plaza tower of the south row (the perch cam -45.5, 55, -89 stands on its podium roof) gets a 20 x 15 m screen on
    // the tower wall facing the podium deck, running a magenta ad. Own random stream (the ad layout elsewhere stays put)
    if (
      tw &&
      R.name === "tsqTowerW" &&
      R.lot.z1 > -100 &&
      R.lot.z0 < -100 &&
      tw.y1 > pod.y1 + 22
    ) {
      const keep = rnd;
      rnd = mulberry32(9109);
      const { f, t0, t1 } = faceOf(tw, face),
        ta = t0 + 2.2,
        tb = Math.min(t1 - 2, ta + 20),
        ya = pod.y1 + (pod.parapet ?? 1.1) + 0.9,
        yb = ya + 15;
      // the pink PUREWAVE ad (L42, the ref's magenta glow)
      const uvP =
        namedUV("L42", (tb - ta - 0.6) / (yb - ya - 0.6)) ??
        cellUV(true, 49, (tb - ta - 0.6) / (yb - ya - 0.6));
      screen(f, ta, tb, ya, yb, 0.6, {
        uv: uvP,
        gap: 0.5,
        bezel: 0.3,
        lip: 0.16,
        frame: 0x1b1c1f,
        trim: "bar",
        noWalk: true,
        noSpill: true,
        noHalo: true,
        bright: 0.38,
      }); // (night r10) 1.0 -> 0.38: whites ~0.8 of clip up close (the light spill uses the ad colours, unchanged)
      rnd = keep;
    }
    for (const sd of [face, "nz", "pz"])
      if (sd === face || R.lot.sides[sd] === "street") {
        // (r6) ground contact AO at the podium base
        const F = faceOf(pod, sd);
        aoStrip(
          P3(F.f, F.t0, yAO, 0),
          P3(F.f, F.t1, yAO, 0),
          [F.f.n[0], 0, F.f.n[1]],
          1.2,
          0.42,
        );
      }
    // (r6) floor-line belt courses every 3-5 floors + a projecting cornice under every tier's parapet (critic r5: 'one
    // window module tiled, no floor-line breaks, no cornices'). Colour follows the cladding family.
    for (const m of R.build.masses) {
      const p = m.p || {},
        cur = p.style === STYLE.CURTAIN;
      const c =
        p.layer === LAYER.RED || p.layer === LAYER.BROWN
          ? 0x9a9386
          : p.layer === LAYER.LIME || p.layer === LAYER.BUFF
            ? 0xb0a58f
            : cur
              ? 0x30353c
              : p.layer === LAYER.WHITE
                ? 0xc2c1bb
                : 0x85817a;
      const fh = p.floorH || 3.8,
        g0 = p.gH || 7,
        every = 3 + Math.floor(rnd() * 3);
      if (m !== pod)
        for (let y = m.y0 + every * fh; y < m.y1 - fh * 1.5; y += every * fh) {
          const yy = Math.round((y - g0) / fh) * fh + g0 - 0.22;
          box(
            m.x0 - 0.1,
            yy,
            m.z0 - 0.1,
            m.x1 + 0.1,
            yy + (cur ? 0.3 : 0.42),
            m.z1 + 0.1,
            "ledge",
            c,
          );
        }
      // (r6) grime streaks washing down the facade under the cornice and the belt courses (street-facing faces)
      if (m !== pod)
        for (const sd of ["px", "nx", "pz", "nz"]) {
          const F = faceOf(m, sd),
            nn = [F.f.n[0], 0, F.f.n[1]],
            k0 = cur ? 0.35 : 0.6;
          const st = (y, L, k) =>
            ao.quad(
              P3(F.f, F.t0, y, 0.03),
              P3(F.f, F.t1, y, 0.03),
              P3(F.f, F.t1, y - L, 0.03),
              P3(F.f, F.t0, y - L, 0.03),
              nn,
              AO_STREAK,
              [k, k, k],
            );
          st(m.y1 - 0.95, Math.min(m.y1 - m.y0 - 1, 6 + rnd() * 8), k0);
          for (let y = m.y0 + every * fh; y < m.y1 - fh * 1.5; y += every * fh)
            st(
              Math.round((y - g0) / fh) * fh + g0 - 0.24,
              2.5 + rnd() * 3,
              k0 * 0.6,
            );
        }
      const d = cur ? 0.18 : 0.45,
        h = cur ? 0.5 : 0.85;
      box(
        m.x0 - d,
        m.y1 - h - 0.05,
        m.z0 - d,
        m.x1 + d,
        m.y1 - 0.05,
        m.z1 + d,
        "cornice",
        c,
      );
      if (!cur)
        box(
          m.x0 - d * 0.55,
          m.y1 - h - 0.35,
          m.z0 - d * 0.55,
          m.x1 + d * 0.55,
          m.y1 - h - 0.05,
          m.z1 + d * 0.55,
          "cornice",
          c,
        ); // stepped bed moulding
      // (r7) window AC units on the masonry tower tiers (critic r6: 'stamped windows, flat facades, no AC units'): sit in
      // the lower part of a window opening (same bay / floor maths as the facade shader), ~6 % of windows, off the
      // screens, in sun-faded beige / grey
      if (p.style === STYLE.PUNCHED || p.style === STYLE.DECO) {
        const gH = 7,
          fhh = p.floorH || 3.8,
          mg = p.margin ?? 0.4,
          top = m.y1 + (m.parapet || 0);
        const prob = p.style === STYLE.PUNCHED ? 0.1 : 0.06;
        for (const sd of ["px", "nx", "pz", "nz"]) {
          if (m === pod && R.lot.sides[sd] !== "street") continue; // podium party walls have no windows
          const W = sd === "px" || sd === "nx" ? m.z1 - m.z0 : m.x1 - m.x0,
            usable = W - 2 * mg;
          const nb = Math.max(1, Math.round(usable / (p.bayW || 2.4))),
            bw = usable / nb,
            ww = bw * (p.winW || 0.5),
            wh = fhh * (p.winH || 0.55);
          const F = faceOf(m, sd),
            nn = F.f.n;
          const fl0 = Math.ceil((m.y0 + 0.5 - gH) / fhh),
            fl1 = Math.floor((top - gH - 1.2 - fhh) / fhh);
          for (let fl = fl0; fl <= fl1; fl++)
            for (let bi = 0; bi < nb; bi++) {
              if (rnd() > prob) continue;
              const u = mg + (bi + 0.5) * bw,
                ySill = gH + fl * fhh + (fhh - wh) * 0.42;
              const wx =
                sd === "pz"
                  ? m.x0 + u
                  : sd === "nz"
                    ? m.x1 - u
                    : sd === "px"
                      ? m.x1
                      : m.x0;
              const wz =
                sd === "pz"
                  ? m.z1
                  : sd === "nz"
                    ? m.z0
                    : sd === "px"
                      ? m.z1 - u
                      : m.z0 + u;
              const t = F.f.r[0] * wx + F.f.r[1] * wz;
              if (
                scrRects.some(
                  (q) =>
                    q.n[0] === nn[0] &&
                    q.n[1] === nn[1] &&
                    Math.abs(q.d - F.f.d) < 2.5 &&
                    t > q.ta - 1.2 &&
                    t < q.tb + 1.2 &&
                    ySill > q.ya - 1.5 &&
                    ySill < q.yb,
                )
              )
                continue;
              const aw = Math.min(ww - 0.08, 0.62 + rnd() * 0.12),
                ah = 0.38 + rnd() * 0.08,
                out = 0.3 + rnd() * 0.12;
              const ac = [0xc9c3b6, 0xb3afa6, 0x9d9990, 0xd6d2c8, 0x8d8a84][
                Math.floor(rnd() * 5)
              ];
              fbox(
                F.f,
                t - aw / 2,
                t + aw / 2,
                ySill + 0.02,
                ySill + 0.02 + ah,
                -0.22,
                out,
                "equipment",
                ac,
              );
              fbox(
                F.f,
                t - aw / 2 + 0.05,
                t + aw / 2 - 0.05,
                ySill + 0.07,
                ySill + ah - 0.04,
                out,
                out + 0.012,
                "equipment",
                0x55544f,
              ); // vent grille
              fbox(
                F.f,
                t - aw / 2 + 0.04,
                t - aw / 2 + 0.08,
                ySill - 0.22,
                ySill + 0.02,
                0,
                out - 0.04,
                "pole",
                0x3a3a3a,
              ); // brackets
              fbox(
                F.f,
                t + aw / 2 - 0.08,
                t + aw / 2 - 0.04,
                ySill - 0.22,
                ySill + 0.02,
                0,
                out - 0.04,
                "pole",
                0x3a3a3a,
              );
              ao.quad(
                P3(F.f, t - aw / 2 - 0.1, ySill, 0.02),
                P3(F.f, t + aw / 2 + 0.1, ySill, 0.02),
                P3(F.f, t + aw / 2 + 0.1, ySill - 1.2 - rnd() * 1.5, 0.02),
                P3(F.f, t - aw / 2 - 0.1, ySill - 1.2 - rnd() * 1.5, 0.02),
                [nn[0], 0, nn[1]],
                AO_STREAK,
                [0.45, 0.45, 0.45],
              ); // drip stain
            }
        }
      }
    }
    // (r6) rooftop billboard on a steel lattice on the podium roof in front of the tower (the classic Times Square
    // skyline of signs standing on roofs, refs 14 / 15); ~half LED, half lit vinyl
    if (tw && rnd() < 0.8) {
      const { f, t0, t1 } = faceOf(pod, face);
      const sb = face === "px" ? pod.x1 - tw.x1 : tw.x0 - pod.x0; // setback depth in front of the tower
      if (sb > 3.4) {
        const W = Math.min(t1 - t0 - 6, 12 + rnd() * 10),
          ta = t0 + 3 + rnd() * (t1 - t0 - 6 - W),
          tb = ta + W;
        const yR = pod.y1,
          leg = 2.2 + rnd() * 2.4,
          ys0 = yR + leg,
          ys1 = ys0 + Math.min(10, W * (0.38 + rnd() * 0.2));
        const oF = -1.15,
          D = Math.min(sb - 1.6, 1.9),
          fr = { ...f, d: f.d + oF - 0.55 };
        frm.setColor(0x34373b);
        const nL = Math.max(3, Math.round(W / 3) + 1);
        for (let i = 0; i < nL; i++) {
          const t = ta + 0.2 + ((W - 0.6) * i) / (nL - 1);
          fbox(f, t, t + 0.2, yR, ys0 + 0.2, oF - 0.75, oF - 0.55, "pole"); // front leg
          fbox(
            f,
            t,
            t + 0.2,
            yR,
            ys1 - 0.6,
            oF - 0.55 - D,
            oF - 0.35 - D,
            "pole",
          ); // rear leg (runs up the back of the sign)
          fbox(
            f,
            t + 0.04,
            t + 0.16,
            yR + leg * 0.5,
            yR + leg * 0.5 + 0.14,
            oF - 0.35 - D,
            oF - 0.75,
            "pole",
          ); // tie
          fbox(
            f,
            t + 0.04,
            t + 0.16,
            ys0 + (ys1 - ys0) * 0.5,
            ys0 + (ys1 - ys0) * 0.5 + 0.14,
            oF - 0.35 - D,
            oF - 0.55,
            "pole",
          ); // back strut
        }
        for (const y of [yR + 0.9, yR + leg - 0.3, ys0 + (ys1 - ys0) * 0.72])
          fbox(f, ta, tb, y, y + 0.16, oF - 0.55 - D, oF - 0.39 - D, "pole"); // rear girts
        fbox(
          f,
          ta,
          tb,
          yR + leg * 0.5,
          yR + leg * 0.5 + 0.14,
          oF - 0.75,
          oF - 0.61,
          "pole",
        );
        // service catwalk along the bottom edge (grating + rail)
        frm.setColor(0x26282b);
        fbox(
          f,
          ta - 0.3,
          tb + 0.3,
          ys0 - 0.12,
          ys0 - 0.04,
          oF - 0.55,
          oF + 0.5,
          "roof",
        );
        fbox(
          f,
          ta - 0.3,
          tb + 0.3,
          ys0 + 0.9,
          ys0 + 0.95,
          oF + 0.44,
          oF + 0.5,
          "pole",
        );
        for (let t = ta - 0.3; t < tb + 0.3; t += 1.8)
          fbox(
            f,
            t,
            t + 0.05,
            ys0 - 0.04,
            ys0 + 0.9,
            oF + 0.44,
            oF + 0.49,
            "pole",
          );
        screen(fr, ta, tb, ys0 + 0.05, ys1, 0.55, {
          flush: true,
          vinyl: rnd() < 0.5,
          noWalk: true,
          noSpill: true,
          noHalo: true /* (r11) free-standing: no wall behind it */,
        });
        scrRects.push({
          n: f.n,
          d: f.d - sb,
          ta: ta - 1,
          tb: tb + 1,
          ya: yR,
          yb: ys1 + 1.5,
        });
        roofSpan = [ta, tb];
      }
    }
    // (r11) roof-edge sign toppers (critic r9: 'the billboard wall is a regular stack of flat rectangles, the silhouette is
    // too orderly'): at the street corners of the podium a sign stands on steel legs just behind the parapet, rising
    // 2-11 m above the roof line with sky showing through the legs; about half get a second sign on the cross-street
    // face, forming an L around the corner. Own random stream (r11) so the rest of the square's layout is unchanged.
    {
      const saved = rnd;
      rnd = r11;
      const { f, t0, t1 } = faceOf(pod, face);
      for (const sd of ["nz", "pz"]) {
        if (R.lot.sides[sd] !== "street" || r11() < 0.3) continue;
        const hi = hiEnd(face, sd),
          W = 7 + r11() * 8,
          lift = 0.6 + r11() * 3.2,
          Hs = Math.min(9, W * (0.42 + r11() * 0.4));
        const ta = hi ? t1 - W - 0.5 - r11() * 2.5 : t0 + 0.5 + r11() * 2.5,
          tb = ta + W;
        if (roofSpan && ta < roofSpan[1] + 1.5 && tb > roofSpan[0] - 1.5)
          continue;
        const topper = (F, a, b, back) => {
          // sign on legs, face plane F.d - back
          const yR = pod.y1,
            ys0 = yR + 1.1 + lift,
            ys1 = ys0 + Hs,
            fr = { ...F, d: F.d - back - 0.55 },
            D = 1.4; // rear legs stay < 2.5 m behind the face (tower setback)
          frm.setColor(0x33363a);
          const nL = Math.max(2, Math.round((b - a) / 3.2) + 1);
          for (let i = 0; i < nL; i++) {
            const t = a + 0.25 + ((b - a - 0.7) * i) / (nL - 1);
            fbox(
              F,
              t,
              t + 0.2,
              yR,
              ys1 - 0.4,
              -back - 0.8,
              -back - 0.58,
              "pole",
            ); // front leg (behind the cabinet)
            fbox(
              F,
              t,
              t + 0.2,
              yR,
              ys0 + (ys1 - ys0) * 0.6,
              -back - 0.6 - D,
              -back - 0.4 - D,
              "pole",
            ); // rear leg
            fbox(
              F,
              t + 0.04,
              t + 0.16,
              yR + (ys0 - yR) * 0.5,
              yR + (ys0 - yR) * 0.5 + 0.14,
              -back - 0.45 - D,
              -back - 0.75,
              "pole",
            ); // tie
            fbox(
              F,
              t + 0.04,
              t + 0.16,
              ys0 + (ys1 - ys0) * 0.55,
              ys0 + (ys1 - ys0) * 0.55 + 0.14,
              -back - 0.45 - D,
              -back - 0.75,
              "pole",
            );
          }
          for (const y of [ys0 - 0.3, ys0 + (ys1 - ys0) * 0.55])
            fbox(
              F,
              a,
              b,
              y,
              y + 0.16,
              -back - 0.6 - D,
              -back - 0.44 - D,
              "pole",
            ); // rear girts
          fbox(
            F,
            a,
            b,
            ys0 - 0.45,
            ys0 - 0.3,
            -back - 0.8,
            -back - 0.6,
            "pole",
          );
          const c = P3(F, (a + b) / 2, 0, 0);
          screen(fr, a, b, ys0, ys1, 0.55, {
            flush: true,
            noWalk: true,
            noSpill: true,
            noHalo: true,
            vinyl: r11() < 0.3,
            uv: adUV(r11, (b - a) / Hs, pick2, c[0] + ys0 * 0.15, c[2]),
          });
        };
        topper(f, ta, tb, 0.35);
        if (r11() < 0.5) {
          // L around the corner onto the cross-street face
          const G2 = faceOf(pod, sd),
            h2 = hiEnd(sd, face),
            W2 = Math.min(G2.t1 - G2.t0 - 4, 5 + r11() * 5);
          const a2 = h2 ? G2.t1 - W2 - 3.2 : G2.t0 + 3.2;
          if (W2 > 3) topper(G2.f, a2, a2 + W2, 0.35);
        }
      }
      rnd = saved;
    }
  }

  // ---------------------------------------------------------------- One-Times-Square-like tower (closed avenue)
  {
    const O = TS.oneTS,
      t = gen.tile((O.x0 + O.x1) / 2, (O.z0 + O.z1) / 2);
    const P = {
      floorH: 3.9,
      bayW: 1.5,
      winW: 0.9,
      winH: 0.6,
      layer: LAYER.METAL,
      base: LAYER.GRANITE,
      seed: 88,
      margin: 0,
      depth: 0.05,
      tint: [0.42, 0.44, 0.48],
    };
    const f = { style: STYLE.CURTAIN, gH: 6 };
    for (const B of [t.fac, t.lod])
      B.box(
        O.x0,
        CH,
        O.z0,
        O.x1,
        O.h,
        O.z1,
        { ...P, topY: O.h, baseY: CH },
        { px: f, nx: f, pz: f, nz: f },
        true,
        false,
      );
    S.box(O.x0, CH, O.z0, O.x1, O.h, O.z1, "wall");
    for (const sd of ["px", "nx", "pz", "nz"]) {
      const F = faceOf(O, sd);
      aoStrip(
        P3(F.f, F.t0, yAO, 0),
        P3(F.f, F.t1, yAO, 0),
        [F.f.n[0], 0, F.f.n[1]],
        1.4,
        0.5,
      );
    } // (r6)
    gen.footprints.push({
      x0: O.x0,
      z0: O.z0,
      x1: O.x1,
      z1: O.z1,
      h: O.h + 18,
      kind: "tower",
    });
    gen.boxes.push({ min: [O.x0, 0, O.z0], max: [O.x1, O.h + 18, O.z1] });
    Z.edge(O.x0 + 0.12, O.z0, O.x0 + 0.12, O.z1, O.h, -1, 0);
    Z.edge(O.x1 - 0.12, O.z0, O.x1 - 0.12, O.z1, O.h, 1, 0);
    Z.edge(O.x0, O.z0 + 0.12, O.x1, O.z0 + 0.12, O.h, 0, -1);
    Z.edge(O.x0, O.z1 - 0.12, O.x1, O.z1 - 0.12, O.h, 0, 1);
    // north face (toward the square): full-width stacked screens, each slightly wider than the tower
    const N = { n: [0, -1], r: [-1, 0], d: -O.z0 };
    // (r6) not a spreadsheet of equal bands (critic r5) but the real composition (refs 14 / 15): a grid of small repeated
    // screens at the base, one wide overhanging band, a split pair, then ONE giant portrait screen up the tower with
    // cyan LED dash columns running up both sides
    {
      // base: 3 x 4 grid of small panels, all showing the same ad
      // the most saturated bright landscape ad (the refs' pink grid), same cell on every panel
      let bi = 0,
        bs = -1;
      AD_AVG_L.forEach((c, i) => {
        const mx = Math.max(...c),
          mn = Math.min(...c),
          sat = mx > 0.08 ? ((mx - mn) / mx) * Math.sqrt(mx) : 0;
        if (sat > bs) {
          bs = sat;
          bi = i;
        }
      });
      const gu = adUV(rnd, 1.25, () => bi, 0, O.z0),
        cw = (O.x1 - O.x0 + 1.2) / 4;
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 4; c++) {
          const l = -O.x1 - 0.6 + c * cw,
            ya = 8.5 + r * 3.0;
          screen(
            N,
            l + 0.12,
            l + cw - 0.12,
            ya,
            ya + 2.8,
            0.7 + (r % 2) * 0.12,
            {
              uv: gu,
              bezel: 0.12,
              noTrim: true,
              noWalk: true,
              gap: 0.3,
              bright: 1.05,
              frame: 0x1a1b1d,
            },
          );
        }
    }
    screen(N, -O.x1 - 2.6, -O.x0 + 1.4, 17.6, 26.4, 1.6, {
      bright: 1.08,
      noWalk: true,
    });
    {
      const m = (rnd() - 0.5) * 3;
      screen(N, -O.x1 - 0.6, m - 0.3, 27.2, 38.6, 0.9, { bright: 0.95 });
      screen(N, m + 0.3, -O.x0 + 0.9, 27.8, 37.4, 1.5, { bright: 1.1 });
    }
    screen(N, -O.x1 - 0.4, -O.x0 + 0.4, 39.6, 44.4, 1.1, { noTrim: true });
    {
      // the giant portrait screen + LED columns
      const ya = 45.4,
        yb = 92.5,
        l = -O.x1 - 1.0,
        r = -O.x0 + 1.0;
      screen(N, l, r, ya, yb, 1.4, {
        bright: 1.12,
        noTrim: true,
        walk: false,
        noWalk: true,
      });
      for (const t of [l - 0.75, r + 0.1]) {
        fbox(N, t, t + 0.65, ya - 0.4, yb + 0.4, 0, 1.75, "wall", 0x141517);
        const o3 = 1.76,
          nn = [N.n[0], 0, N.n[1]];
        lit.quad(
          P3(N, t + 0.12, ya, o3),
          P3(N, t + 0.53, ya, o3),
          P3(N, t + 0.53, yb, o3),
          P3(N, t + 0.12, yb, o3),
          nn,
          [0, 0, 1, (yb - ya) / 0.9],
          [0.35, 1.0, 0.9],
        );
      }
    }
    signBand(N, -O.x1, -O.x0);
    // the famous news zipper wrapping the base of the tower (west side -> north face -> east side, continuous text)
    {
      let u = ticker(
        { n: [-1, 0], r: [0, 1], d: -O.x0 },
        O.z0 + 0.4 - 0.4,
        O.z0 + 16,
        7.35,
        0.95,
      );
      void u;
      u = ticker(N, -O.x1 - 0.4, -O.x0 + 0.4, 7.35, 0.95);
      ticker(
        { n: [1, 0], r: [0, -1], d: O.x1 },
        -(O.z0 + 16),
        -O.z0 + 0.4,
        7.35,
        0.95,
      );
    }
    // side faces near the north end + a few on the south face
    for (const sd of ["px", "nx"]) {
      const W =
        sd === "px"
          ? { n: [1, 0], r: [0, -1], d: O.x1 }
          : { n: [-1, 0], r: [0, 1], d: -O.x0 };
      const zc =
        sd === "px" ? [-(O.z0 + 16), -O.z0 - 0.3] : [O.z0 + 0.3, O.z0 + 16];
      for (const [ya, yb] of [
        [8.5, 20],
        [21, 38],
        [39, 62],
      ])
        screen(W, zc[0], zc[1], ya, yb, 0.6);
      const zt =
        sd === "px" ? [-O.z1 + 1, -(O.z0 + 17)] : [O.z0 + 17, O.z1 - 1];
      signBand(W, zt[0], zt[1]);
    }
    const Sf = { n: [0, 1], r: [1, 0], d: O.z1 };
    composeFace(Sf, O.x0 + 0.5, O.x1 - 0.5, 8.6, 40);
    // crown: open steel frame (the ball-drop mast) + flagpole
    frm.setColor(0x3a3c40);
    const cy0 = O.h,
      cy1 = O.h + 14,
      cz0 = O.z0 + 4,
      cz1 = O.z0 + 16;
    for (const [x, z] of [
      [O.x0 + 1, cz0],
      [O.x1 - 1.6, cz0],
      [O.x0 + 1, cz1 - 0.6],
      [O.x1 - 1.6, cz1 - 0.6],
    ]) {
      frm.box(x, cy0, z, x + 0.6, cy1, z + 0.6);
      S.box(x, cy0, z, x + 0.6, cy1, z + 0.6, "pole");
    }
    for (const y of [cy0 + 7, cy1 - 0.6]) {
      frm.box(O.x0 + 1, y, cz0, O.x1 - 1, y + 0.6, cz0 + 0.6);
      frm.box(O.x0 + 1, y, cz1 - 0.6, O.x1 - 1, y + 0.6, cz1);
      S.box(O.x0 + 1, y, cz0, O.x1 - 1, y + 0.6, cz0 + 0.6, "pole");
      S.box(O.x0 + 1, y, cz1 - 0.6, O.x1 - 1, y + 0.6, cz1, "pole");
    }
    frm.cyl(0, cy1, (cz0 + cz1) / 2, 0.35, 0.2, 18, 8);
    S.cyl(0, (cz0 + cz1) / 2, cy1, cy1 + 18, 0.33, 0.19, "pole");
    Z.add(0, cy1 + 18, (cz0 + cz1) / 2, 0, 1, 0, "antenna");
    // top screen band facing north (the crown ticker)
    screen(N, -O.x1 + 0.5, -O.x0 - 0.5, cy0 + 1.5, cy0 + 6.5, 0.7);
  }

  // ---------------------------------------------------------------- red paver plaza surfaces
  const yP = CH + 0.006;
  const pave = (x0, z0, x1, z1) =>
    pav.quad(
      [x0, yP, z1],
      [x1, yP, z1],
      [x1, yP, z0],
      [x0, yP, z0],
      [0, 1, 0],
      [x0 / 9.6, -z1 / 9.6, x1 / 9.6, -z0 / 9.6],
    );
  for (const zs of TS.plazaRows) {
    const { c0, c1 } = rowZ(zs);
    pave(-TS.plazaX, c0, -G.AV_HALF, c1);
    pave(G.AV_HALF, c0, TS.plazaX, c1);
  }
  {
    // closed avenue segment around One Times Square (+ the sidewalks along it)
    const { c0, c1 } = rowZ(-80);
    pave(-G.AV_HALF - G.AV_WALK, c0, G.AV_HALF + G.AV_WALK, c1);
  }
  // grey granite banding (curb edge + cross bands) and painted seating circles on the pavers
  const yB = yP + 0.003,
    band = new QB();
  const bq = (x0, z0, x1, z1, col) =>
    band.quad(
      [x0, yB, z1],
      [x1, yB, z1],
      [x1, yB, z0],
      [x0, yB, z0],
      [0, 1, 0],
      [0, 0, 1, 1],
      col,
    );
  const GR = [0.3, 0.29, 0.28]; // (r4) lighter granite (was a flat dark strip)
  for (const zs of TS.plazaRows) {
    const { c0, c1 } = rowZ(zs);
    for (const s of [-1, 1]) {
      const xa = s * G.AV_HALF,
        xb = s * TS.plazaX;
      // (r5) granite bands are laid as individual slabs (tone varies per slab) and also run lengthwise, so the paving
      // reads as a laid pattern of fields instead of one salmon plane
      const slabs = (x0, z0, x1, z1, L = 1.2) => {
        const alongZ = z1 - z0 > x1 - x0,
          n = Math.max(1, Math.round((alongZ ? z1 - z0 : x1 - x0) / L));
        for (let i = 0; i < n; i++) {
          const k = 0.86 + rnd() * 0.28,
            c = GR.map((v) => v * k);
          if (alongZ)
            bq(
              x0,
              z0 + ((z1 - z0) * i) / n + 0.01,
              x1,
              z0 + ((z1 - z0) * (i + 1)) / n - 0.01,
              c,
            );
          else
            bq(
              x0 + ((x1 - x0) * i) / n + 0.01,
              z0,
              x0 + ((x1 - x0) * (i + 1)) / n - 0.01,
              z1,
              c,
            );
        }
      };
      slabs(Math.min(xa, xa + s * 0.9), c0, Math.max(xa, xa + s * 0.9), c1);
      for (let z = c0 + 19.2; z < c1 - 2; z += 19.2)
        slabs(Math.min(xa, xb), z, Math.max(xa, xb), z + 0.45, 0.9);
      for (const xm of [11.6, 22.4]) {
        const x = s * (G.AV_HALF + xm);
        slabs(
          Math.min(x, x + s * 0.45),
          c0,
          Math.max(x, x + s * 0.45),
          c1,
          0.9,
        );
      }
      // darker granite border along the building frontage
      slabs(
        Math.min(xb, xb - s * 1.2),
        c0,
        Math.max(xb, xb - s * 1.2),
        c1,
        1.5,
      );
    }
  }

  // ---------------------------------------------------------------- TKTS-like red steps (west plaza, north end)
  {
    const K = TS.tkts,
      tread = (K.zFront - K.zBack) / K.n,
      rise = 0.42;
    for (let i = 0; i < K.n; i++) {
      const zf = K.zFront - i * tread,
        y1 = CH + (i + 1) * rise;
      tk.setColor(i % 2 ? [0.78, 0.74, 0.74] : [1, 1, 1]);
      // (zfix) each step was a full-height box from the ground: the back and side faces of all n boxes overlapped in the
      // same planes with alternating colours (flicker). Draw each step as its own rise-high slab (same union).
      tk.box(
        K.x0,
        ZFIX ? CH + i * rise : CH,
        K.zBack,
        K.x1,
        y1,
        zf,
        0b111111 & ~(1 << 3),
      ); // no bottom face
      S.box(K.x0, CH, K.zBack, K.x1, y1, zf, "wall");
    }
    const yT = CH + K.n * rise;
    aoStrip([K.x0, yAO, K.zBack], [K.x0, yAO, K.zFront], [-1, 0, 0], 1.4, 0.55);
    aoStrip([K.x1, yAO, K.zFront], [K.x1, yAO, K.zBack], [1, 0, 0], 1.4, 0.55); // (r6)
    aoStrip([K.x1, yAO, K.zBack], [K.x0, yAO, K.zBack], [0, 0, -1], 1.4, 0.55);
    // step nosings: a bright edge line on every riser top (reads as a flight of steps, not a red slab) + people
    // sitting all over the steps (static crowd spots, see npc/crowd.js)
    for (let i = 0; i < K.n; i++) {
      const zf = K.zFront - i * tread + 0.012,
        y1 = CH + (i + 1) * rise;
      // (r4) glowing red glass riser + a pale nosing band on the tread (reads as a flight of steps from above too)
      lit.quad(
        [K.x0, y1 - rise + 0.02, zf],
        [K.x1, y1 - rise + 0.02, zf],
        [K.x1, y1 - 0.06, zf],
        [K.x0, y1 - 0.06, zf],
        [0, 0, 1],
        [0.5, 0.5, 0.5, 0.5],
        [0.4, 0.05, 0.045],
      );
      lit.quad(
        [K.x0, y1 - 0.05, zf],
        [K.x1, y1 - 0.05, zf],
        [K.x1, y1 - 0.01, zf],
        [K.x0, y1 - 0.01, zf],
        [0, 0, 1],
        [0.5, 0.5, 0.5, 0.5],
        [0.5, 0.28, 0.25],
      );
      lit.quad(
        [K.x0, y1 + 0.004, zf - 0.012],
        [K.x1, y1 + 0.004, zf - 0.012],
        [K.x1, y1 + 0.004, zf - 0.16],
        [K.x0, y1 + 0.004, zf - 0.16],
        [0, 1, 0],
        [0.5, 0.5, 0.5, 0.5],
        [0.3, 0.16, 0.15],
      );
      // (billboards r6) critic r5 'flat glowing salmon wedge': the flanks are clad in dark steel side plates (the red only
      // shows on the treads / risers), with a lighter stringer cap tracing each step so the side reads as a stair profile
      frm.setColor(0x33363b);
      for (const x of [K.x0 - 0.04, K.x1 + 0.005])
        frm.box(x, CH, zf - tread, x + 0.035, y1 - 0.08, zf + 0.012);
      frm.setColor(0x7c8086);
      for (const x of [K.x0 - 0.05, K.x1 + 0.005])
        frm.box(x, y1 - 0.08, zf - tread, x + 0.045, y1 + 0.012, zf + 0.012);
      // stair-stepped steel handrails on both sides and down the middle (posts + rail segment per step)
      frm.setColor(0xa8adb2);
      for (const x of [K.x0 + 0.08, (K.x0 + K.x1) / 2 - 0.03, K.x1 - 0.14]) {
        box(x, y1, zf - 0.08, x + 0.06, y1 + 1.0, zf - 0.02, "pole");
        box(x - 0.01, y1 + 0.94, zf - tread, x + 0.07, y1 + 1.0, zf, "pole");
      }
      // (r9) frameless glass balustrade panels on both flanks (critic r8: 'flat red slab; needs railing, glass')
      for (const x of [K.x0 + 0.03, K.x1 - 0.03]) {
        glass.quad(
          [x, y1 - 0.02, zf],
          [x, y1 - 0.02, zf - tread],
          [x, y1 + 1.08, zf - tread],
          [x, y1 + 1.08, zf],
          [x < (K.x0 + K.x1) / 2 ? -1 : 1, 0, 0],
          [0, 0, 1, 1],
        );
        S.box(x - 0.02, y1, zf - tread, x + 0.02, y1 + 1.08, zf, "glass");
      }
      if (i === K.n - 1) continue;
      for (let x = K.x0 + 0.6; x < K.x1 - 0.5; x += 0.62 + rnd() * 0.5) {
        if (rnd() < (i % 3 === 1 ? 0.95 : 0.74)) {
          // (r6) sparser (critic: 'confetti' crowd), some rows nearly empty
          // (peds r4) peds critic 'TKTS steps empty': extra sitters from a position hash (keeps this rnd() stream unchanged)
          const hq =
            Math.abs(Math.sin(x * 12.9898 + i * 78.233) * 43758.5453) % 1;
          if (hq < (i % 3 === 1 ? 0.8 : 0.55)) continue;
          tsCrowdSpots.push({
            x: x + (hq - 0.5) * 0.3,
            z: K.zFront - i * tread - 0.12,
            y: y1 - 0.43,
            ry: (((hq * 7.1) % 1) - 0.5) * 0.6,
            mode: "sit",
          });
          continue;
        }
        tsCrowdSpots.push({
          x: x + (rnd() - 0.5) * 0.15,
          z: K.zFront - i * tread - 0.12,
          y: y1 - 0.43,
          ry: (rnd() - 0.5) * 0.5,
          mode: "sit",
        });
      }
    }
    // the back of the stair (seen from the north / from the far end of the plaza) is a big LED screen
    screen(
      { n: [0, -1], r: [-1, 0], d: -K.zBack },
      -K.x1 + 0.15,
      -K.x0 - 0.15,
      CH + 0.35,
      yT - 0.1,
      0.12,
      { noTrim: true, bezel: 0.12, flush: true, noSpill: true },
    );
    // glass side railings + a steel handrail up the middle
    frm.setColor(0x9aa3a8);
    for (const x of [K.x0 + 0.05, K.x1 - 0.1]) {
      frm.box(x, yT, K.zBack, x + 0.05, yT + 1.05, K.zBack + 1.4);
    }
    frm.box(K.x0, yT, K.zBack, K.x1, yT + 1.05, K.zBack + 0.06);
    S.box(K.x0, yT, K.zBack, K.x1, yT + 1.05, K.zBack + 0.06, "glass");
    // the ticket booth under the top (south-facing glass front with a sign)
    const ZB = { n: [0, 1], r: [1, 0], d: K.zFront };
    void ZB;
    Z.edge(K.x0, K.zBack + 0.2, K.x1, K.zBack + 0.2, yT, 0, -1);
  }

  // ---------------------------------------------------------------- screen kiosks on the plazas (ref 12 booth)
  const KR = [];
  const kiosk = (x0, z0, x1, z1, h) => {
    KR.push([x0 - 2, z0 - 2, x1 + 2, z1 + 2]);
    frm.setColor(0x202124).box(x0, CH, z0, x1, CH + h, z1);
    S.box(x0, CH, z0, x1, CH + h, z1, "wall");
    aoRect(x0 - 1.0, z0 - 1.0, x1 + 1.0, z1 + 1.0, 0.7);
    frm
      .setColor(0x5a5c60)
      .box(x0 - 0.4, CH + h, z0 - 0.4, x1 + 0.4, CH + h + 0.5, z1 + 0.4);
    S.box(x0 - 0.4, CH + h, z0 - 0.4, x1 + 0.4, CH + h + 0.5, z1 + 0.4, "roof");
    const m = { x0, x1, z0, z1 };
    for (const sd of ["px", "nx", "pz", "nz"]) {
      const F = faceOf(m, sd);
      screen(F.f, F.t0 + 0.3, F.t1 - 0.3, CH + 1.2, CH + h - 0.3, 0.12, {
        bezel: 0.12,
        bright: 1.1,
        flush: true,
      });
    }
  };
  for (const zs of TS.plazaRows) {
    const { z0, z1 } = rowZ(zs);
    if (zs === -160) {
      kiosk(-34, z0 + 8, -26, z0 + 13, 4.6);
      kiosk(24, z1 - 16, 31, z1 - 10, 4.2);
    } else kiosk(26, z0 + 10, 33, z0 + 15, 4.4);
  }

  // ---------------------------------------------------------------- planters (hedges), bollards, painted circles
  // planters: scattered (not gridded) over each plaza with a minimum spacing; three kinds: square box hedge, cone
  // topiary, ball topiary, long rectangular hedge planters (non-uniform scale), and three finishes (steel / concrete /
  // dark granite). planters[i] = [x, z, sx, sz, kind]
  const planters = [],
    bollards = [];
  for (const zs of TS.plazaRows) {
    const { z0, z1 } = rowZ(zs);
    for (const s of [-1, 1]) {
      // (r9) planters as the refs lay them out (critic r8: 'procedural grid of identical hedge planters'): a loose row of
      // chunky stone boxes along the avenue edge of the plaza, short rows facing the crosswalks at both ends, and only a
      // few interior pieces (cone topiary, trees in low granite tree planters); the middle of the plaza stays open
      const K = TS.tkts;
      const tryP = (x, z, sx, sz, kind, gap = 2.2) => {
        const hx = sx / 2,
          hz = sz / 2;
        if (
          x + hx > K.x0 - 3 &&
          x - hx < K.x1 + 3 &&
          z + hz > K.zBack - 3 &&
          z - hz < K.zFront + 4
        )
          return false;
        if (
          KR.some(
            ([a, b, c, d]) =>
              x + hx > a - 1 &&
              x - hx < c + 1 &&
              z + hz > b - 1 &&
              z - hz < d + 1,
          )
        )
          return false;
        if (
          planters.some(
            ([px, pz, psx, psz]) =>
              Math.abs(px - x) < (psx + sx) / 2 + gap &&
              Math.abs(pz - z) < (psz + sz) / 2 + gap,
          )
        )
          return false;
        planters.push([x, z, sx, sz, kind]);
        return true;
      };
      for (let z = z0 + 3 + rnd() * 3; z < z1 - 2.5; z += 8 + rnd() * 5) {
        if (rnd() < 0.15) continue;
        const w = 1.7 + rnd() * 0.5;
        tryP(s * (G.AV_HALF + 4.3 + rnd() * 0.4), z, w, w, rnd() < 0.8 ? 0 : 2);
      }
      for (const [ze, zi] of [
        [z0 + 2.4, 1],
        [z1 - 2.4, -1],
      ])
        for (
          let x = G.AV_HALF + 10 + rnd() * 3;
          x < TS.plazaX - 4;
          x += 6.5 + rnd() * 4
        ) {
          if (rnd() < 0.3) continue;
          const w = 1.6 + rnd() * 0.6,
            lng = rnd() < 0.25;
          tryP(
            s * x,
            ze + zi * (lng ? 0.4 : 0),
            lng ? w * 2.4 : w,
            w,
            lng ? 3 : rnd() < 0.85 ? 0 : 2,
          );
        }
      for (let k = 0, tries = 0; k < 4 && tries < 80; tries++) {
        const tree = k < 2,
          w = tree ? 2.6 + rnd() * 0.4 : 1.8 + rnd() * 0.4;
        const x = s * (G.AV_HALF + 9 + rnd() * (TS.plazaX - G.AV_HALF - 14)),
          z = z0 + 10 + rnd() * (z1 - z0 - 20);
        if (tryP(x, z, w, w, tree ? 4 : 1, 5)) k++;
      }
      for (let z = z0 + 1.5; z < z1 - 1; z += 2.6)
        bollards.push([s * (G.AV_HALF + 1.05), z]);
    }
  }
  for (const zs of TS.endRows) {
    const { z0, z1 } = rowZ(zs);
    if (zs === -80)
      for (const s of [-1, 1])
        for (let z = z0 + 1.5; z < z1 - 1; z += 2.6)
          bollards.push([s * (G.AV_HALF - 0.6), z]);
  }
  for (const zs of TS.plazaRows) {
    const { c0, c1 } = rowZ(zs),
      K = TS.tkts;
    for (const s of [-1, 1])
      for (let x = G.AV_HALF + 2.4; x < TS.plazaX - 1; x += 2.2)
        for (const z of [c0 + 0.7, c1 - 0.7]) {
          const X = s * x;
          if (
            X > K.x0 - 1 &&
            X < K.x1 + 1 &&
            z > K.zBack - 1 &&
            z < K.zFront + 1
          )
            continue;
          bollards.push([X, z]);
        }
  }
  // ---------------------------------------------------------------- cafe tables + chairs (axis-aligned sets: exact boxes)
  const cafes = [];
  for (const zs of TS.plazaRows) {
    const { z0, z1 } = rowZ(zs);
    for (const s of [-1, 1])
      for (let k = 0; k < 14; k++) {
        const x = s * (17 + rnd() * 24),
          z = z0 + 3 + rnd() * (z1 - z0 - 6);
        const K = TS.tkts;
        if (x > K.x0 - 2 && x < K.x1 + 2 && z > K.zBack - 2 && z < K.zFront + 2)
          continue;
        if (
          planters.some(
            ([px, pz, sx, sz]) =>
              Math.abs(px - x) < sx / 2 + 2 && Math.abs(pz - z) < sz / 2 + 2,
          )
        )
          continue;
        if (KR.some(([a, b, c, d]) => x > a && x < c && z > b && z < d))
          continue;
        if (
          cafes.some(([cx, cz]) => Math.abs(cx - x) < 3 && Math.abs(cz - z) < 3)
        )
          continue;
        cafes.push([x, z]);
      }
  }

  // foliage: a dark clumpy core + ~90 alpha-tested boxwood leaf cards scattered over it (reads as real shrubbery)
  const bushGeo = (cone) => {
    const ball = cone === "ball";
    if (ball) cone = false;
    const r = mulberry32(ball ? 29 : cone ? 19 : 9),
      core = ball
        ? new THREE.SphereGeometry(0.47, 16, 12)
        : cone
          ? new THREE.ConeGeometry(0.5, 1, 14, 6)
          : new THREE.BoxGeometry(1, 1, 1, 6, 5, 6);
    core.translate(0, 0.5, 0);
    const cp = core.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      let x = cp.getX(i),
        y = cp.getY(i),
        z = cp.getZ(i);
      if (ball) {
        const k = 1 + 0.06 * Math.sin(x * 13 + z * 7) * Math.cos(y * 11);
        cp.setXYZ(i, x * k, 0.5 + (y - 0.5) * k * 0.92, z * k);
        continue;
      } else if (!cone) {
        const k =
          1 -
          0.18 * Math.max(0, Math.abs(x) + Math.abs(z) - 0.7) -
          0.1 * Math.max(0, y - 0.8) * (Math.abs(x) + Math.abs(z));
        x *= k;
        z *= k;
      }
      const j = 1 + (r() - 0.5) * 0.1;
      cp.setXYZ(i, x * j, y * (y > 0.02 ? 1 + (r() - 0.5) * 0.06 : 1), z * j);
    }
    core.computeVertexNormals();
    const cards = new MB();
    const n = cone ? 300 : ball ? 420 : 560; // (r7) denser, smaller leaves (the planters are ~2x bigger now)
    for (let i = 0; i < n; i++) {
      let px, py, pz, nx, ny, nz;
      if (ball) {
        const u = r() * 2 - 1,
          a = r() * Math.PI * 2,
          q = Math.sqrt(1 - u * u);
        nx = q * Math.cos(a);
        ny = u;
        nz = q * Math.sin(a);
        px = nx * 0.47;
        py = 0.5 + ny * 0.47;
        pz = nz * 0.47;
      } else if (cone) {
        py = r() * 0.95;
        const rr = 0.5 * (1 - py) + 0.02,
          a = r() * Math.PI * 2;
        px = Math.cos(a) * rr;
        pz = Math.sin(a) * rr;
        nx = Math.cos(a);
        ny = 0.45;
        nz = Math.sin(a);
      } else {
        const f = Math.floor(r() * 5);
        const u = r() - 0.5,
          v = r();
        if (f === 4) {
          px = u * 0.9;
          pz = (r() - 0.5) * 0.9;
          py = 1.0;
          nx = 0;
          ny = 1;
          nz = 0;
        } else {
          const sx = [1, -1, 0, 0][f],
            sz = [0, 0, 1, -1][f];
          px = sx * 0.5 + (sx ? 0 : u);
          pz = sz * 0.5 + (sz ? 0 : u);
          py = 0.05 + v * 0.95;
          nx = sx;
          ny = 0.15;
          nz = sz;
        }
      }
      const s = 0.1 + r() * 0.09,
        a = r() * Math.PI;
      const m = new THREE.Matrix4().lookAt(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(
          nx + (r() - 0.5) * 0.8,
          ny + (r() - 0.5) * 0.8,
          nz + (r() - 0.5) * 0.8,
        ),
        new THREE.Vector3(0, 1, 0),
      );
      m.multiply(new THREE.Matrix4().makeRotationZ(a)).setPosition(
        px + nx * 0.03,
        py,
        pz + nz * 0.03,
      );
      const g0 = 0.8 + r() * 0.4;
      cards.setColor([g0, g0, g0]).setXf(m);
      const q = [
        cards.vert(-s / 2, -s / 2, 0, 0, 0, 1, 0, 0),
        cards.vert(s / 2, -s / 2, 0, 0, 0, 1, 1, 0),
        cards.vert(s / 2, s / 2, 0, 0, 0, 1, 1, 1),
        cards.vert(-s / 2, s / 2, 0, 0, 0, 1, 0, 1),
      ];
      cards.quad(q[0], q[1], q[2], q[3]);
    }
    cards.setXf(null);
    return { core, cards: cards.build() };
  };
  const hedgeB = bushGeo(false),
    coneB = bushGeo(true),
    ballB = bushGeo("ball");
  // concrete planter: tapered body, projecting rim, plinth, uplight slot
  const potMB = new MB();
  potMB
    .setColor(0x8a8680)
    .box(-0.5, 0.06, -0.5, 0.5, 0.86, 0.5)
    .setColor(0x9a968f)
    .box(-0.54, 0.86, -0.54, 0.54, 1.0, 0.54)
    .setColor(0x55524e)
    .box(-0.47, 0, -0.47, 0.47, 0.06, 0.47)
    .setColor(0x4a4744)
    .box(-0.506, 0.45, -0.506, 0.506, 0.475, 0.506)
    .box(-0.506, 0.2, -0.506, 0.506, 0.215, 0.506)
    .setColor(0x2f3b25)
    .box(-0.46, 0.96, -0.46, 0.46, 1.005, 0.46);
  const potGeo = potMB.build();
  const potMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0.35,
  });
  const leafTex = loadTex(TEX + "ts_foliage.webp", { aniso: 4 });
  // (r6) brighter, varied leaf cards (new ts_foliage.webp) + a less black core: r5 hedges read as black blobs
  const hedgeMat = new THREE.MeshStandardMaterial({
    color: 0x2f4126,
    roughness: 0.95,
  });
  const cardMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    color: 0xc4ccb8,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    vertexColors: true,
    roughness: 0.78,
  });
  const pots = new THREE.InstancedMesh(
    potGeo,
    potMat,
    Math.max(1, planters.length),
  );
  const cnt = [0, 0, 0];
  planters.forEach(([, , , , k]) => {
    cnt[k === 3 ? 0 : k]++;
  });
  const mk = (B) => [
    new THREE.InstancedMesh(B.core, hedgeMat, Math.max(1, planters.length * 4)),
    new THREE.InstancedMesh(B.cards, cardMat, Math.max(1, planters.length * 4)),
  ]; // (r5) x4: long hedges are split into near-cubic segments
  const F3 = [mk(hedgeB), mk(coneB), mk(ballB)],
    fi = [0, 0, 0];
  const FIN = [
    [0.78, 0.8, 0.84],
    [0.82, 0.76, 0.7],
    [0.42, 0.42, 0.44],
    [0.62, 0.58, 0.55],
  ]; // (r4) steel / warm granite / dark granite / concrete (no white boxes)
  const m4 = new THREE.Matrix4(),
    tc = new THREE.Color();
  planters.forEach(([x, z, sx, sz, kind], i) => {
    const ph =
      kind === 4 ? 0.55 + rnd() * 0.1 : kind === 3 ? 1.0 : 1.08 + rnd() * 0.14;
    m4.makeScale(sx, ph, sz).setPosition(x, CH, z);
    pots.setMatrixAt(i, m4);
    const fn = FIN[Math.floor(rnd() * FIN.length)];
    pots.setColorAt(i, tc.setRGB(fn[0], fn[1], fn[2]));
    aoRect(
      x - sx * 0.5 - 0.55,
      z - sz * 0.5 - 0.55,
      x + sx * 0.5 + 0.55,
      z + sz * 0.5 + 0.55,
      0.6,
    ); // (r6) contact AO
    S.box(
      x - sx * 0.5,
      CH,
      z - sz * 0.5,
      x + sx * 0.5,
      CH + 0.86 * ph,
      z + sz * 0.5,
      "equipment",
    );
    S.box(
      x - sx * 0.54,
      CH + 0.86 * ph,
      z - sz * 0.54,
      x + sx * 0.54,
      CH + ph,
      z + sz * 0.54,
      "equipment",
    );
    // (r9) square lamp windows near the foot of every face (ref 12's planters), two per face
    const lamps = (n, ctr, half, along, cross) => {
      // n: face normal [nx, nz]; along: half-extent along the face
      for (const u of [-0.3, 0.3]) {
        const a = u * along * 2,
          lw = Math.min(0.13, along * 0.12);
        const P = (da, y) =>
          n[0]
            ? [ctr[0] + n[0] * (half + 0.006), y, ctr[1] + (a + da) * n[0]]
            : [ctr[0] - (a + da) * n[1], y, ctr[1] + n[1] * (half + 0.006)];
        lit.quad(
          P(-lw, CH + 0.12),
          P(lw, CH + 0.12),
          P(lw, CH + 0.26),
          P(-lw, CH + 0.26),
          [n[0], 0, n[1]],
          [0.5, 0.5, 0.5, 0.5],
          [1, 0.93, 0.8],
        );
      }
      void cross;
    };
    if (kind !== 4) {
      lamps([0, 1], [x, z], sz / 2, sx / 2);
      lamps([0, -1], [x, z], sz / 2, sx / 2);
      lamps([1, 0], [x, z], sx / 2, sz / 2);
      lamps([-1, 0], [x, z], sx / 2, sz / 2);
    }
    if (kind === 4) {
      // low granite tree planter: a street tree (trees.js) + trunk collision
      TS_TREE_SPOTS.push({
        x,
        z,
        y: CH + ph * 0.96,
        kind: "street",
        sc: 0.7 + rnd() * 0.25,
        clear: 99,
      });
      S.cyl(x, z, CH + ph, CH + ph + 3.2, 0.24, 0.2, "pole");
      return;
    }
    const g = kind === 3 ? 0 : kind,
      [core, cards] = F3[g],
      j = fi[g]++;
    const gt = 0.8 + rnd() * 0.4; // per-plant green variation
    if (kind === 1) {
      const hs = sx * (0.72 + rnd() * 0.15),
        hh = 1.9 + rnd() * 1.3;
      m4.makeScale(hs, hh, hs).setPosition(x, CH + ph, z);
      S.cyl(x, z, CH + ph, CH + ph + hh, hs * 0.5, 0.02, "equipment");
    } else if (kind === 2) {
      const hs = sx * (0.8 + rnd() * 0.18);
      m4.makeScale(hs, hs, hs).setPosition(x, CH + ph - 0.05, z);
      S.cyl(
        x,
        z,
        CH + ph,
        CH + ph + hs * 0.95,
        hs * 0.45,
        hs * 0.3,
        "equipment",
      );
    } else {
      // (r9) long hedges may run along x or z; split into near-cubic segments along the long axis
      const ax = sx > sz,
        Lm = (ax ? sx : sz) * 0.97,
        Wd = (ax ? sz : sx) * 0.96;
      const hh = kind === 3 ? 0.8 + rnd() * 0.45 : 1.0 + rnd() * 0.55; // (r8) tall clipped boxwood cubes (ref 13)
      const nseg = Math.max(1, Math.min(4, Math.round(Lm / Wd))),
        sl = Lm / nseg;
      const seg = (q, hq, wj) => {
        const c = -Lm / 2 + sl * (q + 0.5),
          cx = ax ? x + c : x,
          cz = ax ? z : z + c;
        m4.makeScale(
          ax ? sl * 1.04 : Wd * wj,
          hq,
          ax ? Wd * wj : sl * 1.04,
        ).setPosition(cx, CH + ph, cz);
        const ex = (ax ? sl * 1.04 : Wd) / 2,
          ez = (ax ? Wd : sl * 1.04) / 2;
        S.box(
          cx - ex,
          CH + ph,
          cz - ez,
          cx + ex,
          CH + ph + hq,
          cz + ez,
          "equipment",
        );
      };
      for (let q = 1; q < nseg; q++) {
        const jj = fi[g]++;
        seg(q, hh * (0.9 + rnd() * 0.2), 0.95 + rnd() * 0.08);
        core.setMatrixAt(jj, m4);
        cards.setMatrixAt(jj, m4);
        cards.setColorAt(
          jj,
          tc.setRGB(gt * (0.9 + rnd() * 0.2), gt, gt * (0.85 + rnd() * 0.2)),
        );
      }
      seg(0, hh, 1);
    }
    core.setMatrixAt(j, m4);
    cards.setMatrixAt(j, m4);
    cards.setColorAt(
      j,
      tc.setRGB(gt * (0.9 + rnd() * 0.2), gt, gt * (0.85 + rnd() * 0.2)),
    );
  });
  pots.count = planters.length;
  F3.forEach(([a, b], g) => {
    a.count = b.count = fi[g];
  });
  const [[hedges, hCards], [cones, cCards], [balls, bCards]] = F3;
  // stainless bollard: grey base collar, brushed shaft, domed cap with a reflective band
  const bolMB = new MB();
  bolMB
    .setColor(0x3a3c3f)
    .cyl(0, 0, 0, 0.16, 0.16, 0.08, 14, false)
    .setColor(0x9a9ea2)
    .cyl(0, 0.08, 0, 0.15, 0.15, 0.8, 14, false)
    .setColor(0x2a2c2e)
    .cyl(0, 0.72, 0, 0.152, 0.152, 0.05, 14, false)
    .setColor(0xa4a8ac)
    .cyl(0, 0.88, 0, 0.15, 0.1, 0.07, 14, false)
    .cyl(0, 0.95, 0, 0.1, 0.02, 0.05, 14, true);
  const bolGeo = bolMB.build();
  // (r5) smaller, varied: a few gaps, per-bollard height / finish (brushed steel, scuffed, black painted, dull grey)
  for (let i = bollards.length - 1; i >= 0; i--)
    if (rnd() < 0.12) bollards.splice(i, 1);
  const bol = new THREE.InstancedMesh(
    bolGeo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.75,
    }),
    Math.max(1, bollards.length),
  );
  const BF = [
    [1, 1, 1],
    [0.85, 0.84, 0.8],
    [0.28, 0.28, 0.3],
    [0.62, 0.63, 0.64],
    [0.95, 0.93, 0.88],
  ];
  bollards.forEach(([x, z], i) => {
    const hs = 0.84 + rnd() * 0.1,
      rs = 0.82;
    m4.makeScale(rs, hs, rs).setPosition(x, CH, z);
    bol.setMatrixAt(i, m4);
    aoBlob(x, z, 0.34, 0.34, 0.55);
    const c = BF[Math.floor(rnd() * BF.length)];
    bol.setColorAt(i, tc.setRGB(c[0], c[1], c[2]));
    S.cyl(x, z, CH, CH + 0.88 * hs, 0.155 * rs, 0.155 * rs, "pole");
    S.cyl(x, z, CH + 0.88 * hs, CH + hs, 0.15 * rs, 0.02 * rs, "pole");
  });
  bol.count = bollards.length;
  // cafe sets: three variants (4 red chairs / 2 green chairs / 3 grey chairs), exact AABB collision per piece
  const CV = [
    {
      ch: [
        [0.75, 0],
        [-0.75, 0],
        [0, 0.75],
        [0, -0.75],
      ],
      col: 0xa3262a,
    },
    {
      ch: [
        [0.75, 0],
        [-0.75, 0],
      ],
      col: 0x3a5f4a,
    },
    {
      ch: [
        [0.75, 0],
        [0, 0.75],
        [0, -0.75],
      ],
      col: 0x8c9094,
    },
  ];
  const cafeGeo = (v) => {
    const cs = new MB();
    cs.setColor(0x2c2e30)
      .cyl(0, 0, 0, 0.05, 0.05, 0.72, 6, false)
      .cyl(0, 0.72, 0, 0.4, 0.4, 0.04, 12, true);
    for (const [cx, cz] of v.ch) {
      cs.setColor(v.col).box(
        cx - 0.22,
        0.44,
        cz - 0.22,
        cx + 0.22,
        0.48,
        cz + 0.22,
      );
      const bx = Math.sign(cx) * 0.2,
        bz = Math.sign(cz) * 0.2;
      cs.box(
        cx + bx - (bx ? 0.02 : 0.22),
        0.48,
        cz + bz - (bz ? 0.02 : 0.22),
        cx + bx + (bx ? 0.02 : 0.22),
        0.9,
        cz + bz + (bz ? 0.02 : 0.22),
      );
      for (const [lx, lz] of [
        [-0.18, -0.18],
        [0.18, -0.18],
        [-0.18, 0.18],
        [0.18, 0.18],
      ])
        cs.setColor(0x2c2e30).box(
          cx + lx - 0.015,
          0,
          cz + lz - 0.015,
          cx + lx + 0.015,
          0.44,
          cz + lz + 0.015,
        );
    }
    return cs.build();
  };
  const UMB = [
    0xb8342c, 0x2a5a8a, 0xd8a02a, 0x2f6a3a, 0xe8e2d6, 0x1f2a3a, 0xc8c2b0,
  ];
  const cafeMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    metalness: 0.6,
  });
  const cafeI = CV.map(
    (v) =>
      new THREE.InstancedMesh(cafeGeo(v), cafeMat, Math.max(1, cafes.length)),
  );
  const cafeN = [0, 0, 0];
  cafes.forEach(([x, z], i) => {
    const vi = Math.floor(rnd() * 3),
      v = CV[vi];
    m4.makeTranslation(x, CH, z);
    cafeI[vi].setMatrixAt(cafeN[vi]++, m4);
    aoBlob(x, z, 1.15, 1.15, 0.4);
    S.box(x - 0.4, CH, z - 0.4, x + 0.4, CH + 0.76, z + 0.4, "equipment");
    if (rnd() < 0.45) {
      // (r9) market umbrella through the table (critic r8: 'add chairs/tables, umbrellas')
      const uc = UMB[Math.floor(rnd() * UMB.length)],
        r = 1.2 + rnd() * 0.3;
      frm.setColor(0x8a8d90).cyl(x, CH + 0.76, z, 0.025, 0.025, 1.7, 6, false);
      S.cyl(x, z, CH + 0.76, CH + 2.4, 0.03, 0.03, "pole");
      frm.setColor(uc).cyl(x, CH + 2.2, z, r, 0.03, 0.42, 10, true);
      S.cyl(x, z, CH + 2.2, CH + 2.62, r, 0.03, "awning");
      frm.setColor(uc).cyl(x, CH + 2.08, z, r, r, 0.12, 10, false);
      aoBlob(x, z, r + 0.5, r + 0.5, 0.3);
    }
    for (const [cx, cz] of v.ch)
      S.box(
        x + cx - 0.22,
        CH,
        z + cz - 0.22,
        x + cx + 0.22,
        CH + 0.48,
        z + cz + 0.22,
        "equipment",
      );
    // somebody sits at most tables
    for (const [cx, cz] of v.ch)
      if (rnd() < 0.55)
        tsCrowdSpots.push({
          x: x + cx * 0.81,
          z: z + cz * 0.81,
          y: CH,
          ry: Math.atan2(-cx, -cz),
          mode: "sit",
        });
  });
  cafeI.forEach((m, k) => {
    m.count = cafeN[k];
  });
  const cafe = cafeI[0];
  cafe.name = "tsCafe";

  // ---------------------------------------------------------------- street furniture: food carts, newsstands, trash cans,
  // a police booth (all merged into tsFrames / tsLights / tsSigns, exact collision boxes)
  const taken = [
    ...planters.map(([x, z, sx, sz]) => [x, z, Math.max(sx, sz) * 0.6 + 0.8]),
    ...cafes.map(([x, z]) => [x, z, 1.8]),
    ...KR.map(([a, b, c, d]) => [
      (a + c) / 2,
      (b + d) / 2,
      Math.max(c - a, d - b) / 2,
    ]),
  ];
  const free = (x, z, r) => {
    const K = TS.tkts;
    if (
      x > K.x0 - r - 1 &&
      x < K.x1 + r + 1 &&
      z > K.zBack - r - 1 &&
      z < K.zFront + r + 1
    )
      return false;
    return !taken.some(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) < tr + r);
  };
  const cart = (x, z, along) => {
    // along: 'x' | 'z' long axis
    const L = 1.9,
      W = 0.95,
      sx = along === "x" ? L / 2 : W / 2,
      sz = along === "x" ? W / 2 : L / 2;
    box(
      x - sx,
      CH + 0.25,
      z - sz,
      x + sx,
      CH + 1.15,
      z + sz,
      "equipment",
      0xa9adb0,
    ); // stainless body
    aoRect(x - sx - 0.5, z - sz - 0.5, x + sx + 0.5, z + sz + 0.5, 0.6);
    aoBlob(x, z, 1.3, 1.3, 0.25);
    box(
      x - sx - 0.04,
      CH + 1.15,
      z - sz - 0.04,
      x + sx + 0.04,
      CH + 1.22,
      z + sz + 0.04,
      "equipment",
      0x6a6d70,
    ); // counter
    frm.setColor(0x1a1a1a);
    for (const [wx, wz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      frm.cyl(
        x + wx * (sx - 0.2),
        CH,
        z + wz * (sz - 0.12),
        0.2,
        0.2,
        0.25,
        8,
        true,
      );
    S.box(x - sx, CH, z - sz, x + sx, CH + 0.25, z + sz, "equipment");
    frm.setColor(0x8a8d90).cyl(x, CH + 1.22, z, 0.03, 0.03, 1.2, 6, false);
    S.cyl(x, z, CH + 1.22, CH + 2.42, 0.03, 0.03, "pole");
    frm
      .setColor(UMB[Math.floor(rnd() * UMB.length)])
      .cyl(x, CH + 2.2, z, 1.25, 0.02, 0.45, 12, true);
    S.cyl(x, z, CH + 2.2, CH + 2.65, 1.25, 0.02, "awning");
    // menu board (sign atlas) + a warm glow strip under the counter
    const f =
      along === "x"
        ? { n: [0, -1], r: [-1, 0], d: -(z - sz) }
        : { n: [-1, 0], r: [0, 1], d: -(x - sx) };
    const t0 = along === "x" ? -(x + sx) + 0.15 : z - sz + 0.15;
    screen(f, t0, t0 + L - 0.3, CH + 0.55, CH + 1.0, 0.02, {
      sign: true,
      bezel: 0.03,
      frame: 0x2a2a2a,
      bright: 1,
    });
  };
  const newsstand = (x, z, sd) => {
    // green kiosk with magazine racks facing the plaza side sd
    const w = 3.2,
      d = 1.8,
      h = 2.7;
    box(
      x - w / 2,
      CH,
      z - d / 2,
      x + w / 2,
      CH + h,
      z + d / 2,
      "wall",
      0x24503a,
    );
    aoRect(
      x - w / 2 - 0.8,
      z - d / 2 - 0.8,
      x + w / 2 + 0.8,
      z + d / 2 + 0.8,
      0.65,
    );
    box(
      x - w / 2 - 0.25,
      CH + h,
      z - d / 2 - 0.25,
      x + w / 2 + 0.25,
      CH + h + 0.18,
      z + d / 2 + 0.25,
      "roof",
      0x1b3a2a,
    );
    // (r5) trim: cream fascia band under the roof lip, dark plinth, corner pilasters, a bulb strip under the overhang
    frm
      .setColor(0xcfc6ae)
      .box(
        x - w / 2 - 0.015,
        CH + h - 0.28,
        z - d / 2 - 0.015,
        x + w / 2 + 0.015,
        CH + h - 0.02,
        z + d / 2 + 0.015,
      );
    frm
      .setColor(0x1a1c1b)
      .box(
        x - w / 2 - 0.015,
        CH,
        z - d / 2 - 0.015,
        x + w / 2 + 0.015,
        CH + 0.22,
        z + d / 2 + 0.015,
      );
    for (const [px, pz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      box(
        x + (px * w) / 2 - 0.09,
        CH + 0.22,
        z + (pz * d) / 2 - 0.09,
        x + (px * w) / 2 + 0.09,
        CH + h - 0.28,
        z + (pz * d) / 2 + 0.09,
        "wall",
        0x2f5e45,
      );
    lit.quad(
      [x - w / 2 - 0.1, CH + h - 0.005, z - d / 2 - 0.2],
      [x + w / 2 + 0.1, CH + h - 0.005, z - d / 2 - 0.2],
      [x + w / 2 + 0.1, CH + h - 0.005, z - d / 2 - 0.05],
      [x - w / 2 - 0.1, CH + h - 0.005, z - d / 2 - 0.05],
      [0, -1, 0],
      [0, 0, (w + 0.2) / 0.25, 1],
      [1, 0.85, 0.6],
    );
    const F = faceOf(
      { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 },
      sd,
    );
    screen(F.f, F.t0 + 0.2, F.t1 - 0.2, CH + h - 0.55, CH + h - 0.1, 0.03, {
      sign: true,
      bezel: 0.03,
      frame: 0x163024,
      bright: 1,
    });
    for (let i = 0; i < 3; i++)
      screen(
        F.f,
        F.t0 + 0.25 + i * 0.95,
        F.t0 + 1.1 + i * 0.95,
        CH + 0.9,
        CH + 1.9,
        0.12,
        {
          bezel: 0.04,
          frame: 0x303030,
          noTrim: true,
          bright: 0.8,
          flush: true,
          noSpill: true,
        },
      );
  };
  const booth = (x, z) => {
    // police booth: white box, blue band, light bar
    box(x - 1.2, CH, z - 1.2, x + 1.2, CH + 2.8, z + 1.2, "wall", 0xe4e6e8);
    aoRect(x - 2, z - 2, x + 2, z + 2, 0.6);
    box(
      x - 1.22,
      CH + 2.2,
      z - 1.22,
      x + 1.22,
      CH + 2.55,
      z + 1.22,
      "wall",
      0x1f3f8a,
    );
    box(
      x - 1.35,
      CH + 2.8,
      z - 1.35,
      x + 1.35,
      CH + 2.95,
      z + 1.35,
      "roof",
      0x2a2c30,
    );
    box(
      x - 0.5,
      CH + 2.95,
      z - 0.15,
      x + 0.5,
      CH + 3.15,
      z + 0.15,
      "equipment",
      0x303238,
    );
    lit.quad(
      [x - 0.48, CH + 2.97, z - 0.155],
      [x, CH + 2.97, z - 0.155],
      [x, CH + 3.13, z - 0.155],
      [x - 0.48, CH + 3.13, z - 0.155],
      [0, 0, -1],
      [0.5, 0.5, 0.5, 0.5],
      [1, 0.2, 0.2],
    );
    lit.quad(
      [x, CH + 2.97, z - 0.155],
      [x + 0.48, CH + 2.97, z - 0.155],
      [x + 0.48, CH + 3.13, z - 0.155],
      [x, CH + 3.13, z - 0.155],
      [0, 0, -1],
      [0.5, 0.5, 0.5, 0.5],
      [0.3, 0.45, 1],
    );
    for (const sd of ["px", "nx", "pz", "nz"]) {
      // dark windows
      const F = faceOf(
        { x0: x - 1.2, x1: x + 1.2, z0: z - 1.2, z1: z + 1.2 },
        sd,
      );
      fbox(
        F.f,
        F.t0 + 0.3,
        F.t1 - 0.3,
        CH + 1.1,
        CH + 2.05,
        0,
        0.015,
        "wall",
        0x1a2530,
      );
    }
  };
  // (r6) LinkNYC-style kiosks (slim double-sided portrait screens) along the plaza curb + slatted benches
  const link = (x, z) => {
    box(
      x - 0.16,
      CH,
      z - 0.45,
      x + 0.16,
      CH + 2.9,
      z + 0.45,
      "equipment",
      0x2a2c2f,
    );
    box(
      x - 0.21,
      CH,
      z - 0.5,
      x + 0.21,
      CH + 0.12,
      z + 0.5,
      "equipment",
      0x46484b,
    );
    box(
      x - 0.17,
      CH + 2.9,
      z - 0.46,
      x + 0.17,
      CH + 2.98,
      z + 0.46,
      "equipment",
      0x8a8d90,
    );
    for (const sd of ["px", "nx"]) {
      const F = faceOf(
        { x0: x - 0.16, x1: x + 0.16, z0: z - 0.45, z1: z + 0.45 },
        sd,
      );
      screen(F.f, F.t0 + 0.07, F.t1 - 0.07, CH + 0.95, CH + 2.75, 0.015, {
        bezel: 0.04,
        frame: 0x1a1a1c,
        noTrim: true,
        flush: true,
        noSpill: true,
        bright: 0.85,
      });
    }
    aoBlob(x, z, 0.75, 1.0, 0.5);
  };
  const bench = (x, z, alongZ, back) => {
    // back: +1 / -1 side of the backrest (across the long axis)
    const L = 1.9,
      D = 0.5;
    const B = (a0, y0, b0, a1, y1, b1, col) =>
      alongZ
        ? box(x + b0, y0, z + a0, x + b1, y1, z + a1, "equipment", col)
        : box(x + a0, y0, z + b0, x + a1, y1, z + b1, "equipment", col);
    for (const a of [-L / 2 + 0.1, L / 2 - 0.18]) {
      B(a, CH, -D / 2, a + 0.08, CH + 0.42, D / 2, 0x2b2d2f);
      B(
        a,
        CH + 0.42,
        back > 0 ? D / 2 - 0.08 : -D / 2,
        a + 0.08,
        CH + 0.86,
        back > 0 ? D / 2 : -D / 2 + 0.08,
        0x2b2d2f,
      );
    }
    for (let k = 0; k < 4; k++) {
      const b0 = -D / 2 + k * (D / 4) + 0.01;
      B(-L / 2, CH + 0.42, b0, L / 2, CH + 0.46, b0 + D / 4 - 0.02, 0x6b5a48);
    }
    for (const y of [0.56, 0.7]) {
      const bb = back > 0 ? D / 2 - 0.1 : -D / 2 + 0.06;
      B(-L / 2, CH + y, bb, L / 2, CH + y + 0.1, bb + 0.04, 0x6b5a48);
    }
    alongZ
      ? aoRect(x - 0.6, z - 1.3, x + 0.6, z + 1.3, 0.45)
      : aoRect(x - 1.3, z - 0.6, x + 1.3, z + 0.6, 0.45);
  };
  for (const zs of TS.plazaRows) {
    const { z0, z1 } = rowZ(zs);
    for (const s of [-1, 1]) {
      for (let z = z0 + 9 + rnd() * 6; z < z1 - 6; z += 20 + rnd() * 8) {
        const x = s * (G.AV_HALF + 3.1);
        if (free(x, z, 0.9)) {
          link(x, z);
          taken.push([x, z, 1.0]);
        }
      }
      for (let k = 0, tries = 0; k < 5 && tries < 40; tries++) {
        const alongZ = rnd() < 0.6,
          x = s * (G.AV_HALF + 5 + rnd() * (TS.plazaX - G.AV_HALF - 10)),
          z = z0 + 5 + rnd() * (z1 - z0 - 10);
        if (!free(x, z, 1.4)) continue;
        const back = rnd() < 0.5 ? 1 : -1;
        bench(x, z, alongZ, back);
        taken.push([x, z, 1.4]);
        k++;
        if (rnd() < 0.6) {
          const off = alongZ ? 0 : 0.05;
          void off;
          tsCrowdSpots.push({
            x: x + (alongZ ? -back * 0.05 : (rnd() - 0.5) * 1.0),
            z: z + (alongZ ? (rnd() - 0.5) * 1.0 : -back * 0.05),
            y: CH,
            ry: alongZ ? Math.atan2(-back, 0) : Math.atan2(0, -back),
            mode: "sit",
          });
        }
      }
    }
  }
  const cans = [];
  for (const zs of TS.plazaRows) {
    const { z0, z1 } = rowZ(zs);
    for (const s of [-1, 1]) {
      // carts near the avenue curb, trash cans along the curb line, a newsstand at the far side
      for (let k = 0, tries = 0; k < 3 && tries < 30; tries++) {
        const x = s * (G.AV_HALF + 3.6 + rnd() * 6),
          z = z0 + 4 + rnd() * (z1 - z0 - 8);
        if (!free(x, z, 1.6)) continue;
        cart(x, z, "z");
        taken.push([x, z, 1.8]);
        k++;
      }
      for (let z = z0 + 6; z < z1 - 4; z += 9 + rnd() * 5) {
        const x = s * (G.AV_HALF + 2.1);
        if (free(x, z, 0.5)) {
          cans.push([x, z]);
          taken.push([x, z, 0.5]);
        }
      }
      for (let tries = 0; tries < 20; tries++) {
        const x = s * (TS.plazaX - 3.5),
          z = z0 + 6 + rnd() * (z1 - z0 - 12);
        if (!free(x, z, 2.2)) continue;
        newsstand(x, z, s < 0 ? "px" : "nx");
        taken.push([x, z, 2.4]);
        break;
      }
    }
    if (zs === -160)
      for (let tries = 0; tries < 30; tries++) {
        const x = 22 + rnd() * 14,
          z = z0 + 10 + rnd() * (z1 - z0 - 20);
        if (free(x, z, 2)) {
          booth(x, z);
          taken.push([x, z, 2.2]);
          break;
        }
      }
  }
  // (r7) curb clutter clusters (critic r6: 'no newsstands / hydrants / trash cans at the curb, street level is thin'):
  // rows of coloured newspaper boxes on pedestals, a blue mailbox, trash baskets, at the plaza curb near the crossings
  // and along the cross-street sidewalks of the towers (props.js skips its own newsboxes inside the square)
  {
    const NB = [
      0xa8302a, 0x2a4f8a, 0xc9a22c, 0x2f6a3a, 0xcfccc4, 0x1c1c1e, 0x3a7aa0,
      0x7a2b52,
    ];
    // band: along-axis 'x' | 'z', curb line cl, si = +-1 toward the building; a = along coordinate, o = distance from curb
    const clutter = (axis, cl, si, a0, a1) => {
      const P2 = (a, o) => (axis === "x" ? [a, cl + si * o] : [cl + si * o, a]);
      const bx = (a0_, a1_, o0, o1, y0, y1, kind, col) => {
        const p = P2(a0_, o0),
          q = P2(a1_, o1);
        box(
          Math.min(p[0], q[0]),
          y0,
          Math.min(p[1], q[1]),
          Math.max(p[0], q[0]),
          y1,
          Math.max(p[1], q[1]),
          kind,
          col,
        );
      };
      const nbox = (a, o) => {
        // newspaper vending box on a pedestal, window facing the sidewalk
        const c = NB[Math.floor(rnd() * NB.length)];
        bx(
          a - 0.05,
          a + 0.05,
          o + 0.18,
          o + 0.28,
          CH,
          CH + 0.42,
          "pole",
          0x2a2b2d,
        );
        bx(
          a - 0.2,
          a + 0.2,
          o + 0.1,
          o + 0.36,
          CH,
          CH + 0.03,
          "equipment",
          0x2a2b2d,
        );
        bx(
          a - 0.24,
          a + 0.24,
          o,
          o + 0.46,
          CH + 0.42,
          CH + 1.02,
          "equipment",
          c,
        );
        bx(
          a - 0.26,
          a + 0.26,
          o - 0.02,
          o + 0.48,
          CH + 1.02,
          CH + 1.07,
          "equipment",
          0x2b2c2e,
        );
        bx(
          a - 0.19,
          a + 0.19,
          o + 0.46,
          o + 0.47,
          CH + 0.6,
          CH + 0.94,
          "equipment",
          0x1c252c,
        ); // window
        bx(
          a - 0.2,
          a + 0.2,
          o + 0.46,
          o + 0.475,
          CH + 0.5,
          CH + 0.56,
          "equipment",
          0x9a9c9e,
        ); // handle bar
        bx(
          a + 0.06,
          a + 0.18,
          o + 0.3,
          o + 0.42,
          CH + 1.07,
          CH + 1.2,
          "equipment",
          0x8a8c8f,
        ); // coin box
        aoBlob(...P2(a, o + 0.23), 0.45, 0.45, 0.45);
      };
      const mailbox = (a, o) => {
        for (const [da, dO] of [
          [-0.2, 0.05],
          [0.16, 0.05],
          [-0.2, 0.47],
          [0.16, 0.47],
        ])
          bx(
            a + da,
            a + da + 0.04,
            o + dO,
            o + dO + 0.04,
            CH,
            CH + 0.14,
            "pole",
            0x1b2c55,
          );
        bx(
          a - 0.26,
          a + 0.26,
          o,
          o + 0.56,
          CH + 0.14,
          CH + 1.02,
          "equipment",
          0x1f3a7a,
        );
        bx(
          a - 0.24,
          a + 0.24,
          o + 0.03,
          o + 0.53,
          CH + 1.02,
          CH + 1.16,
          "equipment",
          0x1f3a7a,
        );
        bx(
          a - 0.2,
          a + 0.2,
          o + 0.08,
          o + 0.48,
          CH + 1.16,
          CH + 1.22,
          "equipment",
          0x1f3a7a,
        );
        bx(
          a - 0.16,
          a + 0.16,
          o + 0.56,
          o + 0.575,
          CH + 0.86,
          CH + 0.95,
          "equipment",
          0xb9bcbe,
        ); // pull-down slot
        aoBlob(...P2(a, o + 0.28), 0.5, 0.5, 0.5);
      };
      let a = a0 + 1 + rnd() * 4;
      while (a < a1 - 2) {
        const q = rnd(),
          o = 0.5 + rnd() * 0.2;
        if (q < 0.5) {
          // row of 2-5 newsboxes (+ a trash basket at the end)
          const n = 2 + Math.floor(rnd() * 4),
            L = n * 0.56;
          if (a + L > a1 - 1) break;
          const c = P2(a + L / 2, o + 0.25);
          if (!free(c[0], c[1], L / 2 + 0.3)) {
            a += 3;
            continue;
          }
          for (let i = 0; i < n; i++) nbox(a + 0.28 + i * 0.56, o);
          taken.push([c[0], c[1], L / 2 + 0.3]);
          if (rnd() < 0.6) {
            const t = P2(a + L + 0.55, o + 0.3);
            if (free(t[0], t[1], 0.5)) {
              cans.push(t);
              taken.push([t[0], t[1], 0.5]);
            }
          }
          a += L + 6 + rnd() * 9;
        } else if (q < 0.72) {
          const c = P2(a, o + 0.28);
          if (free(c[0], c[1], 0.6)) {
            mailbox(a, o);
            taken.push([c[0], c[1], 0.6]);
          }
          if (rnd() < 0.7) {
            const t = P2(a + 0.9, o + 0.3);
            if (free(t[0], t[1], 0.5)) {
              cans.push(t);
              taken.push([t[0], t[1], 0.5]);
            }
          }
          a += 7 + rnd() * 9;
        } else {
          const t = P2(a, o + 0.3);
          if (free(t[0], t[1], 0.5)) {
            cans.push(t);
            taken.push([t[0], t[1], 0.5]);
          }
          a += 5 + rnd() * 8;
        }
      }
    };
    for (const zs of [...TS.plazaRows, ...TS.endRows]) {
      const { c0, c1 } = rowZ(zs),
        plaza = TS.plazaRows.includes(zs);
      const xa = plaza ? TS.plazaX + 1 : G.AV_HALF + G.AV_WALK + 2,
        xb = plaza ? TS.towerX - 3 : TS.endX - 3;
      for (const sg of [-1, 1]) {
        for (const [cl, si] of [
          [c0, 1],
          [c1, -1],
        ]) {
          if (sg > 0) clutter("x", cl, si, xa, xb);
          else clutter("x", cl, si, -xb, -xa);
        }
        // the plaza's avenue curb: clusters near both crossings (outside the bollard line)
        if (plaza) {
          const cx = sg * (G.AV_HALF + 1.5),
            si = sg;
          clutter("z", cx, si, c0 + 2, c0 + 16);
          clutter("z", cx, si, c1 - 16, c1 - 2);
        }
      }
      if (zs === -320)
        for (const sg of [-1, 1])
          clutter("z", sg * G.AV_HALF, sg, c0 + 3, c1 - 3);
    }
  }
  const canMB = new MB();
  canMB
    .setColor(0x2d4a34)
    .cyl(0, 0, 0, 0.3, 0.33, 0.9, 12, false)
    .setColor(0x243a2a)
    .cyl(0, 0.9, 0, 0.35, 0.3, 0.12, 12, true);
  const canI = new THREE.InstancedMesh(
    canMB.build(),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.5,
    }),
    Math.max(1, cans.length),
  );
  canI.count = cans.length;
  canI.name = "tsTrash";
  cans.forEach(([x, z], i) => {
    m4.makeTranslation(x, CH, z);
    canI.setMatrixAt(i, m4);
    aoBlob(x, z, 0.6, 0.6, 0.55);
    S.cyl(x, z, CH, CH + 0.9, 0.3, 0.33, "equipment");
    S.cyl(x, z, CH + 0.9, CH + 1.02, 0.35, 0.3, "equipment");
  });
  canI.castShadow = canI.receiveShadow = true;
  canI.computeBoundingSphere();
  scene.add(canI);
  for (const m of [
    pots,
    hedges,
    hCards,
    cones,
    cCards,
    balls,
    bCards,
    bol,
    ...cafeI,
  ]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.computeBoundingSphere();
    scene.add(m);
  }
  pots.name = "tsPlanters";
  hedges.name = "tsHedges";
  bol.name = "tsBollards";

  // ---------------------------------------------------------------- plaza crowd (static standers, npc/crowd.js renders them)
  // tourists in loose groups (talking, taking photos, looking up at the screens), singles on phones, denser along the
  // avenue curb and around the TKTS steps; spread over the whole plaza (not clumped at one corner)
  {
    const K = TS.tkts;
    const addP = (x, z, ry, clip) => {
      if (free(x, z, 0.35)) {
        tsCrowdSpots.push({ x, z, ry, mode: "stand", clip });
        taken.push([x, z, 0.35]);
        return true;
      }
      return false;
    };
    const zones = [];
    for (const zs of TS.plazaRows) {
      const { z0, z1 } = rowZ(zs);
      for (const s of [-1, 1])
        zones.push([s, z0 + 1.5, z1 - 1.5, G.AV_HALF + 1.6, TS.plazaX - 1.2]);
    }
    {
      const { z0, z1 } = rowZ(-80);
      for (const s of [-1, 1])
        zones.push([
          s,
          z0 + 1.5,
          z1 - 1.5,
          TS.oneTS.x1 + 0.9,
          G.AV_HALF + G.AV_WALK - 0.8,
        ]);
    }
    for (const [s, za, zb, xa, xb] of zones) {
      const area = (zb - za) * (xb - xa),
        nG = Math.round(area / 36),
        nS = Math.round(area / 19); // (r7) ~1.5x denser (critic: 'far too thin for Times Square')
      for (let g = 0; g < nG; g++) {
        const cx = s * (xa + rnd() * (xb - xa)),
          cz = za + rnd() * (zb - za);
        const n = 2 + Math.floor(rnd() * rnd() * 5),
          R0 = 0.45 + n * 0.08,
          a0 = rnd() * 6.28,
          look = rnd() < 0.35;
        for (let k = 0; k < n; k++) {
          const ang = a0 + (k / n) * 6.28 + (rnd() - 0.5) * 0.5,
            px = cx + Math.cos(ang) * R0,
            pz = cz + Math.sin(ang) * R0 * 0.85;
          const ry = look
            ? Math.atan2(g % 2 ? s : -s, 0) + (rnd() - 0.5) * 1.2
            : Math.atan2(cx - px, cz - pz);
          addP(
            px,
            pz,
            ry,
            look
              ? rnd() < 0.45
                ? "lookUp"
                : rnd() < 0.5
                  ? "photo"
                  : "phone"
              : rnd() < 0.7
                ? "talk"
                : "idle",
          );
        }
      }
      // (r6) singles cluster toward the avenue curb and the crossings at both ends (not an even dot field)
      for (let k = 0; k < nS; k++) {
        const x = s * (xa + Math.pow(rnd(), 1.05) * (xb - xa)),
          e = rnd(); // (r8) spread over the plaza (critic r7: 'uniform band along the curb')
        const z =
          e < 0.3
            ? rnd() < 0.5
              ? za + Math.pow(rnd(), 2) * 16
              : zb - Math.pow(rnd(), 2) * 16
            : za + rnd() * (zb - za);
        addP(x, z, rnd() * 6.28, rnd() < 0.55 ? "phone" : "idle");
      }
    }
    // around the foot of the TKTS steps
    for (let k = 0; k < 26; k++)
      addP(
        K.x0 - 1 + rnd() * (K.x1 - K.x0 + 2),
        K.zFront + 0.8 + rnd() * 5,
        Math.PI + (rnd() - 0.5) * 2,
        rnd() < 0.5 ? "phone" : "talk",
      );
    // (r7) the tower sidewalks along both cross streets (critic r6: 'pedestrians bunched at one island; spread them along
    // both sidewalks'): window shoppers at the shop fronts, people waiting at the curb, pairs chatting, denser near corners
    for (const zs of [...TS.plazaRows, ...TS.endRows]) {
      const { c0, c1 } = rowZ(zs),
        plaza = TS.plazaRows.includes(zs);
      const xa = plaza ? TS.plazaX + 0.8 : G.AV_HALF + G.AV_WALK + 0.8,
        xb = plaza ? TS.towerX - 1 : TS.endX - 1;
      for (const sg of [-1, 1])
        for (const [cl, si] of [
          [c0, 1],
          [c1, -1],
        ]) {
          const n = Math.round((xb - xa) / 2.6);
          for (let k = 0; k < n; k++) {
            const t = Math.pow(rnd(), 1.5),
              x = sg * (xa + t * (xb - xa)),
              q = rnd();
            if (q < 0.35)
              addP(
                x,
                cl + si * (G.ST_WALK - 0.7 - rnd() * 0.4),
                Math.atan2(0, si),
                rnd() < 0.5 ? "idle" : "phone",
              ); // window shopping
            else if (q < 0.55)
              addP(
                x,
                cl + si * (0.8 + rnd() * 0.4),
                Math.atan2(0, -si) + (rnd() - 0.5) * 0.8,
                rnd() < 0.5 ? "idle" : "phone",
              ); // at the curb
            else if (q < 0.8) {
              const z = cl + si * (1.4 + rnd() * 1.4),
                ry = rnd() * 6.28;
              if (addP(x, z, ry, "talk"))
                addP(
                  x + Math.sin(ry) * 0.75,
                  z + Math.cos(ry) * 0.75,
                  ry + Math.PI,
                  "talk",
                );
            } else
              addP(
                x,
                cl + si * (1.2 + rnd() * 2),
                rnd() * 6.28,
                rnd() < 0.4 ? "lookUp" : "phone",
              );
          }
        }
      if (zs === -320)
        for (const sg of [-1, 1])
          for (let k = 0; k < 26; k++) {
            const z = c0 + 2 + rnd() * (c1 - c0 - 4),
              q = rnd();
            if (q < 0.4)
              addP(
                sg * (G.AV_HALF + G.AV_WALK - 0.8),
                z,
                Math.atan2(sg, 0),
                "idle",
              );
            else
              addP(
                sg * (G.AV_HALF + 0.9 + rnd() * 3),
                z,
                rnd() * 6.28,
                rnd() < 0.5 ? "phone" : "talk",
              );
          }
    }
    // (r11) soft contact shadow under every static plaza pedestrian (critic r9: 'tiny pedestrians lack contact shadows';
    // the crowd's own shadow maps are too coarse at the plaza scale). Standing spots only (seated ones sit on chairs / steps).
    for (const p of tsCrowdSpots)
      if (p.mode === "stand") aoBlob(p.x, p.z, 0.42, 0.42, 0.5);
  }

  // ---------------------------------------------------------------- (r4) screen light spill
  // every screen below ~32 m throws a soft card of its average colour onto the ground in front of it (sidewalk, plaza,
  // roadway: strips follow the curb heights) and, for low screens, onto the facade / shop band under it. Additive.
  const spl = new QB();
  const groundY = (x, z) => {
    const zz = ((z % G.ST_SP) + G.ST_SP) % G.ST_SP;
    if (zz < G.ST_HALF || zz > G.ST_SP - G.ST_HALF) return 0;
    if (Math.abs(x) < G.AV_HALF) {
      const { c0, c1 } = rowZ(-80);
      return z > c0 && z < c1 ? CH : 0;
    }
    return CH;
  };
  for (const q of spillQ) {
    const { f, ta, tb, ya, yb, avg } = q;
    if (!avg) continue;
    const w = tb - ta,
      h = yb - ya,
      yc = (ya + yb) / 2,
      mx = Math.max(avg[0], avg[1], avg[2], 0.02);
    const I = TS_SPILL * Math.min(0.7, (w * h) / (yc * yc * 0.6 + 30));
    if (I < 0.012) continue;
    const col = avg.map((c) => (c / mx) * (0.35 + Math.sqrt(mx)) * I);
    const L = Math.min(30, 6 + yc * 1.0),
      ea = ta - w * 0.25,
      eb = tb + w * 0.25,
      nS = Math.ceil(L / 1.5);
    for (let k = 0; k < nS; k++) {
      const s0 = (k / nS) * L,
        s1 = ((k + 1) / nS) * L,
        m = P3(f, (ta + tb) / 2, 0, (s0 + s1) / 2),
        y = groundY(m[0], m[2]) + 0.03;
      spl.quad(
        P3(f, ea, y, s0),
        P3(f, eb, y, s0),
        P3(f, eb, y, s1),
        P3(f, ea, y, s1),
        [0, 1, 0],
        [0, 1 - s0 / L, 1, 1 - s1 / L],
        col,
      );
    }
    if (ya < 16) {
      // facade under the screen (shop band, piers, sign band), fading downwards
      const o = 0.47,
        c2 = col.map((c) => c * 0.45);
      spl.quad(
        P3(f, ta - 0.5, CH, o),
        P3(f, tb + 0.5, CH, o),
        P3(f, tb + 0.5, ya, o),
        P3(f, ta - 0.5, ya, o),
        [f.n[0], 0, f.n[1]],
        [0, 0.35, 1, 1],
        c2,
      );
    }
  }

  // ---------------------------------------------------------------- (r9) screen halo: light spill on the facade around
  // every LED cabinet (9-slice card on the wall plane: glow falls off over ~1-3 m outside the screen rect). Critic r8:
  // 'no light spill onto adjacent facades'. Same alpha-preserving additive blend as the ground spill.
  const hal = new QB();
  for (const q of haloQ) {
    const { f, ta, tb, ya, yb, avg } = q,
      w = tb - ta,
      h = yb - ya,
      mx = Math.max(avg[0], avg[1], avg[2], 0.02);
    const m = Math.min(3.2, 0.9 + 0.12 * Math.min(w, h)),
      o = 0.035,
      n = [f.n[0], 0, f.n[1]];
    const I =
        0.3 *
        Math.min(
          1,
          Math.sqrt(w * h) / 8,
        ) /* (r10) 0.3 -> 0.2, (r11) 0.3 again: the view-angle fade now handles altitude */,
      col = avg.map((c) => (c / mx) * (0.3 + Math.sqrt(mx)) * I);
    const T = [ta - m, ta, tb, tb + m],
      Y = [Math.max(CH + 0.05, ya - m), ya, yb, yb + m];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        if (i === 1 && j === 1) continue; // behind the cabinet: invisible
        const u0 = i === 0 ? 1 : 0,
          u1 = i === 2 ? 1 : 0,
          v0 = j === 0 ? 1 : 0,
          v1 = j === 2 ? 1 : 0;
        hal.quad(
          P3(f, T[i], Y[j], o),
          P3(f, T[i + 1], Y[j], o),
          P3(f, T[i + 1], Y[j + 1], o),
          P3(f, T[i], Y[j + 1], o),
          n,
          [u0, v0, u1, v1],
          col,
        );
      }
  }

  // ---------------------------------------------------------------- (r4) plaza + roadway wear decals
  // ts_decals.webp 4x4 cells: 0-1 manholes, 2 trench drain, 3 square drain, 4-7 stains, 8-9 gum, 10-11 cracks,
  // 12-13 patched pavers, 14 wet patch, 15 tar seam
  const dec = new QB(),
    rdw = new QB(),
    rd2 = new QB(),
    rd3 = new QB();
  const decal = (x, z, sx, sz, cellI, y, rot = 0, col = [1, 1, 1]) => {
    const u0 = (cellI % 4) / 4,
      v1 = 1 - Math.floor(cellI / 4) / 4,
      c = Math.cos(rot),
      sn = Math.sin(rot);
    const P = (a, b) => [x + a * c - b * sn, y, z + a * sn + b * c];
    let va = v1 - 0.25,
      vb = v1;
    if (cellI === 2) {
      va = v1 - 0.25 * (160 / 256);
      vb = v1 - 0.25 * (96 / 256);
    }
    dec.quad(
      P(-sx / 2, sz / 2),
      P(sx / 2, sz / 2),
      P(sx / 2, -sz / 2),
      P(-sx / 2, -sz / 2),
      [0, 1, 0],
      [u0 + 0.002, va + 0.002, u0 + 0.248, vb - 0.002],
      col,
    );
  };
  {
    const yD = yP + 0.005;
    const inStuff = (x, z) =>
      planters.some(
        ([px, pz, sx, sz]) =>
          Math.abs(px - x) < sx / 2 + 0.6 && Math.abs(pz - z) < sz / 2 + 0.6,
      ) ||
      KR.some(([a, b, c, d]) => x > a && x < c && z > b && z < d) ||
      (x > TS.tkts.x0 - 1 &&
        x < TS.tkts.x1 + 1 &&
        z > TS.tkts.zBack - 1 &&
        z < TS.tkts.zFront + 1);
    for (const zs of TS.plazaRows) {
      const { c0, c1 } = rowZ(zs);
      for (const sg of [-1, 1]) {
        const xa = G.AV_HALF + 1,
          xb = TS.plazaX - 1;
        for (let k = 0; k < 70; k++) {
          const x = sg * (xa + rnd() * (xb - xa)),
            z = c0 + 1 + rnd() * (c1 - c0 - 2);
          if (inStuff(x, z)) continue;
          const q = rnd();
          if (q < 0.06)
            decal(x, z, 0.9, 0.9, rnd() < 0.5 ? 0 : 1, yD, rnd() * 6.28);
          else if (q < 0.12) decal(x, z, 0.7, 0.7, 3, yD);
          else if (q < 0.48) {
            const sz = 1.5 + rnd() * 3.5;
            decal(
              x,
              z,
              sz,
              sz * (0.6 + rnd() * 0.6),
              4 + Math.floor(rnd() * 4),
              yD,
              rnd() * 6.28,
            );
          } else if (q < 0.68) {
            const sz = 1.2 + rnd() * 1.6;
            decal(x, z, sz, sz, 8 + Math.floor(rnd() * 2), yD, rnd() * 6.28);
          } else if (q < 0.8) {
            const sz = 1.5 + rnd() * 2;
            decal(
              x,
              z,
              sz,
              sz * 0.5,
              10 + Math.floor(rnd() * 2),
              yD,
              rnd() * 6.28,
            );
          } else if (q < 0.9)
            decal(
              x,
              z,
              1.2,
              0.8,
              12 + Math.floor(rnd() * 2),
              yD,
              rnd() < 0.5 ? 0 : Math.PI / 2,
            );
          else {
            const sz = 2.5 + rnd() * 3;
            decal(x, z, sz, sz * 0.7, 14, yD, rnd() * 6.28);
          }
        }
        // trench drains along the curb band
        for (let z = c0 + 8 + rnd() * 6; z < c1 - 4; z += 14 + rnd() * 10)
          decal(sg * (G.AV_HALF + 1.6), z, 0.5, 3.0, 2, yD, Math.PI / 2);
      }
    }
    // avenue roadway through the square: manholes, oil drips down the lane centres, tar-sealed cracks, patches
    const yR = 0.014;
    for (let z = -318; z < -2; z += 3 + rnd() * 5) {
      const lane = [-8.25, -2.75, 2.75, 8.25][Math.floor(rnd() * 4)],
        x = lane + (rnd() - 0.5) * 1.2;
      const zz = ((z % G.ST_SP) + G.ST_SP) % G.ST_SP;
      if (zz < G.ST_HALF + 3 || zz > G.ST_SP - G.ST_HALF - 3) continue;
      const q = rnd();
      if (q < 0.1) decal(x, z, 0.9, 0.9, 0, yR, rnd() * 6.28);
      else if (q < 0.55)
        decal(
          x,
          z,
          1.2 + rnd() * 1.5,
          2.5 + rnd() * 4,
          4 + Math.floor(rnd() * 4),
          yR,
          (rnd() - 0.5) * 0.3,
          [0.8, 0.8, 0.8],
        );
      else if (q < 0.8)
        decal(x, z, 3 + rnd() * 4, 0.6, 15, yR, (rnd() - 0.5) * 2.5);
      else decal(x, z, 2 + rnd() * 2, 1.2 + rnd(), 14, yR, rnd() * 6.28);
    }
    // (r5) ts_road.webp (2x2): tyre-darkened wheel paths in every lane, asphalt patch repairs, sealed crack webs and grimy,
    // chipped crosswalk paint at every intersection of the square (critic: 'spotless road, perfect white stripes')
    const rdq = (x, z, sx, sz, cellI, y, rot = 0, a = 1) => {
      const u0 = (cellI % 2) / 2,
        v1 = 1 - Math.floor(cellI / 2) / 2,
        c = Math.cos(rot),
        sn = Math.sin(rot);
      const P = (p, q) => [x + p * c - q * sn, y, z + p * sn + q * c];
      let uv = [u0 + 0.004, v1 - 0.496, u0 + 0.496, v1 - 0.004];
      if (cellI === 3) {
        // (r11) crack webs read as one stamped shape (critic r9): position-hashed mirror + stretch, fainter
        const h = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1,
          h2 = Math.abs((h * 7.31) % 1);
        if (h < 0) uv = [uv[2], uv[1], uv[0], uv[3]];
        if (h2 > 0.5) uv = [uv[0], uv[3], uv[2], uv[1]];
        sx *= 0.65 + 0.7 * h2;
        sz *= 1.35 - 0.7 * h2;
        a *= 0.7;
      }
      rdw.quad(
        P(-sx / 2, sz / 2),
        P(sx / 2, sz / 2),
        P(sx / 2, -sz / 2),
        P(-sx / 2, -sz / 2),
        [0, 1, 0],
        uv,
        [a, a, a],
      );
    };
    const yW = 0.017;
    for (const zs of [-320, -240, -160, -80]) {
      const za = zs + G.ST_HALF,
        zb = zs + G.ST_SP - G.ST_HALF;
      const closed = zs === -80; // the One-TS segment is paved over
      if (!closed) {
        for (const lane of [-8.25, -2.75, 2.75, 8.25])
          for (const w of [-0.85, 0.85]) {
            for (let z = za + 1; z < zb - 1; ) {
              const L = 6 + rnd() * 10,
                zz = Math.min(zb - 1, z + L);
              rdq(
                lane + w + (rnd() - 0.5) * 0.15,
                (z + zz) / 2,
                0.75 + rnd() * 0.3,
                zz - z + 1.5,
                0,
                yW,
                (rnd() - 0.5) * 0.01,
                0.6 + rnd() * 0.4,
              );
              if (zz >= zb - 1) break;
              z = zz - 0.8;
            }
          }
        for (let k = 0; k < 7; k++) {
          const w = 1.5 + rnd() * 3.5,
            l = 1.5 + rnd() * 5;
          rdq(
            -9 + rnd() * 18,
            za + 4 + rnd() * (zb - za - 8),
            w,
            l,
            1,
            yW + 0.001,
            (rnd() < 0.8 ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.04,
          );
        }
        for (let k = 0; k < 4; k++) {
          const sz = 2.5 + rnd() * 3;
          rdq(
            -9 + rnd() * 18,
            za + 3 + rnd() * (zb - za - 6),
            sz,
            sz,
            3,
            yW + 0.002,
            rnd() * 6.28,
          );
        }
        for (const xg of [-G.AV_HALF + 0.3, G.AV_HALF - 0.3])
          for (let z = za + 4; z < zb - 4; z += 8)
            rdq(xg, z, 0.55, 8.4, 0, yW + 0.001, 0, 1);
      }
      // crosswalk grime over both avenue crossings and the side-street crossings of this intersection
      for (let pass = 0; pass < 2; pass++)
        for (const zc of [zs - G.ST_HALF - 2.4, zs + G.ST_HALF + 2.4])
          for (let x = -10 + pass * 2; x < 10; x += 4.2 + rnd())
            rdq(
              x + 2,
              zc + (rnd() - 0.5),
              4.6 + rnd() * 1.5,
              3.6 + rnd(),
              2,
              yW + 0.003,
              rnd() < 0.5 ? 0 : Math.PI,
              0.7 + rnd() * 0.3,
            );
      for (let pass = 0; pass < 2; pass++)
        for (const xc of [-G.AV_HALF - 2.4, G.AV_HALF + 2.4])
          for (let z = zs - 4.5 + pass * 1.7; z < zs + 4.5; z += 3.6)
            rdq(
              xc + (rnd() - 0.5),
              z + 1.8,
              3.6 + rnd(),
              4.4,
              2,
              yW + 0.003,
              Math.PI / 2,
              0.7 + rnd() * 0.3,
            );
      // the cross street through the square (both sides of the avenue): wheel paths along x, patches, cracks, grime
      for (const sg of [-1, 1]) {
        for (const zl of [zs - 2.5, zs + 2.5])
          for (const w of [-0.8, 0.8])
            for (let x = G.AV_HALF + 6; x < TS.towerX; x += 9 + rnd() * 5)
              rdq(
                sg * (x + 5),
                zl + w,
                0.7 + rnd() * 0.3,
                10 + rnd() * 3,
                0,
                yW,
                Math.PI / 2 + (rnd() - 0.5) * 0.01,
                0.8,
              );
        for (let k = 0; k < 7; k++)
          rdq(
            sg * (G.AV_HALF + 4 + rnd() * (TS.towerX - 16)),
            zs - 3 + rnd() * 6,
            1.5 + rnd() * 3,
            1.2 + rnd() * 2.5,
            1,
            yW + 0.001,
            (rnd() < 0.8 ? 0 : Math.PI / 2) + (rnd() - 0.5) * 0.04,
            k % 2 ? 1 : 1.7 + rnd() * 0.6,
          ); // odd: sun-bleached lighter patches
        for (let k = 0; k < 3; k++)
          decal(
            sg * (G.AV_HALF + 6 + rnd() * (TS.towerX - 20)),
            zs + (rnd() - 0.5) * 5,
            0.9,
            0.9,
            rnd() < 0.5 ? 0 : 1,
            yW + 0.004,
            rnd() * 6.28,
          ); // manholes
        for (let k = 0; k < 10; k++) {
          const sz = 2 + rnd() * 3;
          rdq(
            sg * (G.AV_HALF + 4 + rnd() * (TS.towerX - 16)),
            zs - 3.5 + rnd() * 7,
            sz,
            sz * 0.8,
            rnd() < 0.4 ? 3 : 2,
            yW + 0.002,
            rnd() * 6.28,
            0.7,
          );
        }
        // (r6) utility trench cuts across the street (long, lighter, re-paved strips) + square utility cuts + more manholes
        // near the crossings: the foreground roadway in the street-level views was a featureless dark plane
        for (let k = 0; k < 3; k++) {
          const x = sg * (G.AV_HALF + 6 + rnd() * 26);
          rdq(
            x,
            zs + (rnd() - 0.5) * 0.6,
            0.7 + rnd() * 0.5,
            9.6,
            1,
            yW + 0.0015,
            (rnd() - 0.5) * 0.05,
            1.5 + rnd() * 0.5,
          );
        }
        for (let k = 0; k < 5; k++) {
          const w = 1.2 + rnd() * 1.6;
          rdq(
            sg * (G.AV_HALF + 5 + rnd() * 30),
            zs + (rnd() - 0.5) * 7,
            w,
            w * (0.7 + rnd() * 0.6),
            1,
            yW + 0.0012,
            (rnd() - 0.5) * 0.08,
            rnd() < 0.5 ? 1 : 1.6 + rnd() * 0.5,
          );
        }
        for (let k = 0; k < 2; k++)
          decal(
            sg * (G.AV_HALF + 7 + rnd() * 22),
            zs + (rnd() - 0.5) * 5,
            0.8,
            0.8,
            1,
            yW + 0.004,
            rnd() * 6.28,
          );
        for (let k = 0; k < 3; k++) {
          const sz = 2 + rnd() * 3.5;
          rdq(
            sg * (G.AV_HALF + 4 + rnd() * 30),
            zs + (rnd() - 0.5) * 8,
            sz,
            sz * 0.8,
            3,
            yW + 0.0022,
            rnd() * 6.28,
            0.8,
          );
        }
        // dirty gutter along both curbs (the kerb line collects grime / wet silt)
        for (const zg of [zs - G.ST_HALF + 0.3, zs + G.ST_HALF - 0.3])
          for (let x = G.AV_HALF + 1; x < TS.towerX; x += 8)
            rdq(sg * (x + 4), zg, 0.55, 8.4, 0, yW + 0.001, Math.PI / 2, 1);
      }
      // the intersection box itself: wheel-worn grime + a patch or two
      for (let k = 0; k < 5; k++)
        rdq(
          -8 + rnd() * 16,
          zs - 3 + rnd() * 6,
          4 + rnd() * 4,
          3 + rnd() * 3,
          rnd() < 0.7 ? 2 : 1,
          yW + 0.001,
          rnd() * 6.28,
          0.6,
        );
    }
    // (r7) ts_road2.webp (2x2): 0 skid marks, 1 oil drips, 2 gutter debris (u = 0 at the kerb), 3 pale dust / aggregate.
    // critic r6: 'foreground road is a flat dark-grey expanse with one crack decal; needs tire marks, patching, a
    // gutter with debris'
    const rd2q = (x, z, sx, sz, cellI, y, rot = 0, a = 1) => {
      const u0 = (cellI % 2) / 2,
        v1 = 1 - Math.floor(cellI / 2) / 2,
        c = Math.cos(rot),
        sn = Math.sin(rot);
      const P = (p, q) => [x + p * c - q * sn, y, z + p * sn + q * c];
      rd2.quad(
        P(-sx / 2, sz / 2),
        P(sx / 2, sz / 2),
        P(sx / 2, -sz / 2),
        P(-sx / 2, -sz / 2),
        [0, 1, 0],
        [u0 + 0.004, v1 - 0.496, u0 + 0.496, v1 - 0.004],
        [a, a, a],
      );
    };
    const yX = yW + 0.0026;
    for (const zs of [-320, -240, -160, -80]) {
      const za = zs + G.ST_HALF,
        zb = zs + G.ST_SP - G.ST_HALF,
        closed = zs === -80;
      if (!closed) {
        // avenue: skid marks + oil drips on the approaches to both stop lines, gutters along both curbs, dusty patches
        for (const lane of [-8.25, -2.75, 2.75, 8.25]) {
          const zStop = lane < 0 ? za + 3 : zb - 3,
            dir = lane < 0 ? 1 : -1;
          if (rnd() < 0.55)
            rd2q(
              lane + (rnd() - 0.5) * 0.4,
              zStop + dir * (6 + rnd() * 8),
              1.9,
              5 + rnd() * 5,
              0,
              yX,
              (rnd() - 0.5) * 0.08,
              0.7 + rnd() * 0.3,
            );
          for (let k = 0; k < 2; k++)
            rd2q(
              lane + (rnd() - 0.5) * 0.6,
              zStop + dir * (1.5 + k * 5.5 + rnd() * 1.5),
              1.3 + rnd() * 0.8,
              1.6 + rnd(),
              1,
              yX + 0.0002,
              rnd() * 6.28,
              0.8 + rnd() * 0.2,
            );
        }
        for (const sg of [-1, 1])
          for (let z = za + 2; z < zb - 3; z += 5.5)
            rd2q(
              sg * (G.AV_HALF - 0.55),
              z + 2.75,
              1.1,
              5.8,
              2,
              yX + 0.0004,
              sg > 0 ? Math.PI : 0,
              0.9,
            );
        for (let k = 0; k < 6; k++) {
          const sz = 2.5 + rnd() * 4;
          rd2q(
            -10 + rnd() * 20,
            za + 3 + rnd() * (zb - za - 6),
            sz,
            sz * (0.6 + rnd() * 0.5),
            3,
            yX - 0.0003,
            rnd() * 6.28,
            0.8,
          );
        }
      }
      // cross street through the square: gutters on both curbs, skids + drips at the avenue stop lines, dust
      for (const sg of [-1, 1]) {
        for (const [zc, rot] of [
          [zs - G.ST_HALF, Math.PI / 2],
          [zs + G.ST_HALF, -Math.PI / 2],
        ]) {
          const zz = zc + (rot > 0 ? 0.55 : -0.55);
          for (let x = G.AV_HALF + 1; x < TS.towerX - 1; x += 5.5)
            rd2q(sg * (x + 2.75), zz, 1.1, 5.8, 2, yX + 0.0004, rot, 0.9);
        }
        for (const zl of [zs - 2.5, zs + 2.5]) {
          const xs = sg * (G.AV_HALF + 5 + rnd() * 10);
          if (rnd() < 0.6)
            rd2q(
              xs,
              zl + (rnd() - 0.5) * 0.3,
              1.8,
              5 + rnd() * 4,
              0,
              yX,
              Math.PI / 2 + (rnd() - 0.5) * 0.1,
              0.8,
            );
          rd2q(
            sg * (G.AV_HALF + 4 + rnd() * 3),
            zl + (rnd() - 0.5) * 0.5,
            1.4,
            1.8,
            1,
            yX + 0.0002,
            rnd() * 6.28,
            0.9,
          );
        }
        for (let k = 0; k < 9; k++) {
          const sz = 2 + rnd() * 4;
          rd2q(
            sg * (G.AV_HALF + 2 + rnd() * 36),
            zs + (rnd() - 0.5) * 7.5,
            sz,
            sz * 0.7,
            3,
            yX - 0.0003,
            rnd() * 6.28,
            1,
          );
        }
        for (let k = 0; k < 3; k++)
          rd2q(
            sg * (G.AV_HALF + 3 + rnd() * 30),
            zs + (rnd() - 0.5) * 6,
            1.8,
            4 + rnd() * 4,
            0,
            yX,
            Math.PI / 2 + (rnd() - 0.5) * 0.5,
            0.7,
          );
      }
    }
    // (r9) ts_road3.webp (2x2): 0 tar snakes, 1 alligator cracking, 2 lane-centre oil stain, 3 steel road plate
    // (critic r8: 'asphalt is a flat untextured grey plane ... tar snakes, cracks, oil stains, road-wear')
    const rd3q = (x, z, sx, sz, cellI, y, rot = 0, a = 1) => {
      const u0 = (cellI % 2) / 2,
        v1 = 1 - Math.floor(cellI / 2) / 2,
        c = Math.cos(rot),
        sn = Math.sin(rot);
      const P = (p, q) => [x + p * c - q * sn, y, z + p * sn + q * c];
      rd3.quad(
        P(-sx / 2, sz / 2),
        P(sx / 2, sz / 2),
        P(sx / 2, -sz / 2),
        P(-sx / 2, -sz / 2),
        [0, 1, 0],
        [u0 + 0.004, v1 - 0.496, u0 + 0.496, v1 - 0.004],
        [a, a, a],
      );
    };
    const y3 = yX + 0.0008;
    const roadAt = (x, z) => {
      // roadway (not sidewalk / plaza) inside the square
      const zz = ((z % G.ST_SP) + G.ST_SP) % G.ST_SP,
        inSt = zz < G.ST_HALF - 0.3 || zz > G.ST_SP - G.ST_HALF + 0.3;
      if (inSt) return Math.abs(x) < TS.towerX;
      return Math.abs(x) < G.AV_HALF - 0.3 && !(z > -80 && z < 0);
    };
    for (let k = 0; k < 300; k++) {
      const onAv = rnd() < 0.5,
        zs = [-320, -240, -160, -80, 0][Math.floor(rnd() * 5)];
      const x = onAv
        ? (rnd() - 0.5) * 2 * (G.AV_HALF - 1.5)
        : (rnd() - 0.5) * 2 * (TS.towerX - 4);
      const z = onAv
        ? -318 + rnd() * 236
        : zs + (rnd() - 0.5) * (G.ST_ROAD - 1.5);
      if (!roadAt(x, z)) continue;
      const q = rnd();
      if (q < 0.4) {
        const sz = 3.5 + rnd() * 3;
        rd3q(x, z, sz, sz, 0, y3, rnd() * 6.28, 0.6 + rnd() * 0.4);
      } else if (q < 0.55) {
        const sz = 2.2 + rnd() * 2.5;
        rd3q(x, z, sz, sz, 1, y3 + 0.0002, rnd() * 6.28, 0.8);
      } else if (q < 0.93) {
        // oil down the lane centre (along the traffic direction)
        const lane = onAv
            ? [-8.25, -2.75, 2.75, 8.25][Math.floor(rnd() * 4)]
            : 0,
          xx = onAv ? lane + (rnd() - 0.5) * 0.3 : x;
        const zz = onAv
          ? z
          : zs + (rnd() < 0.5 ? -2.5 : 2.5) + (rnd() - 0.5) * 0.3;
        if (roadAt(xx, zz))
          rd3q(
            xx,
            zz,
            1.0 + rnd() * 0.6,
            2.4 + rnd() * 2.5,
            2,
            y3 + 0.0004,
            onAv ? (rnd() - 0.5) * 0.1 : Math.PI / 2 + (rnd() - 0.5) * 0.1,
            0.8 + rnd() * 0.2,
          );
      } else if (q > 0.975)
        rd3q(
          x,
          z,
          2.44,
          3.05,
          3,
          y3 + 0.0006,
          onAv ? 0 : Math.PI / 2,
          0.9 + rnd() * 0.2,
        ); // 8 x 10 ft steel plate
    }
  }

  // ---------------------------------------------------------------- meshes
  const adsTex = adsTexture(),
    signTex = signsTexture() /* (night r5) shared copy */,
    paveTex = loadTex(TEX + "ts_pavers.webp", { repeat: true, aniso: 16 });
  const dots = dotTexture();
  const add = (g, mat, name, shadow = false) => {
    if (!g) return null;
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.castShadow = shadow;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const screenMat = (map) =>
    new THREE.MeshStandardMaterial({
      map,
      color: 0x2a2a2a,
      emissive: 0xffffff,
      emissiveMap: map,
      emissiveIntensity: 2.5,
      roughness: 0.28,
      metalness: 0,
      vertexColors: true,
    });
  const sm = screenMat(adsTex);
  // (night) own night brightness (screenlights.js): out of the lighting.js emissive scan, x uScrBoost at night
  sm.userData.nightGain = 1;
  sm.defines = { ...sm.defines, CITYL_NOSPEC: "" }; // (night r11) no city-light specular on the LED faces (citylights.js)
  // LED panel micro-structure: faint pixel grid that fades out with distance (no moire far away)
  sm.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, scrUniforms());
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + SCR_GLSL_PARS)
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
      totalEmissiveRadiance *= ${SCR_GAIN_GLSL}; // (night)
      { vec2 px = vEmissiveMapUv * vec2(4096.0) * 0.5; vec2 fw = fwidth(px);
        float k = clamp(1.0 - max(fw.x, fw.y) * 1.6, 0.0, 1.0);
        vec2 g = abs(fract(px) - 0.5); float m = smoothstep(0.5, 0.36, max(g.x, g.y));
        // RGB sub-pixel triads (visible up close only) + the dark pixel grid between the LEDs
        float sp = fract(px.x * 3.0); vec3 tri = vec3(smoothstep(0.0, 0.12, sp) * smoothstep(0.36, 0.24, sp), smoothstep(0.3, 0.42, sp) * smoothstep(0.7, 0.58, sp), smoothstep(0.64, 0.76, sp) * smoothstep(1.0, 0.88, sp));
        float k2 = clamp(1.0 - max(fw.x, fw.y) * 4.0, 0.0, 1.0);
        totalEmissiveRadiance *= mix(vec3(1.0), (0.4 + 0.75 * m) * mix(vec3(1.0), 0.35 + 1.9 * tri, k2), k);
        // (r6) a touch less chroma (critic: 'over-saturated, too clean')
        totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(dot(totalEmissiveRadiance, vec3(0.3, 0.55, 0.15))), mix(0.26, uScrDesat, uNightK)); // (night) vivid LED colour at night (ts_perch_night) // (billboards r6) 0.14 -> 0.26 (critic r5: 'uniformly saturated poster imagery')
        // (r7) LED cabinet modules (16 x 16 LEDs): thin dark seams that survive much farther than the LED grid, plus faint
        // horizontal scan rows (critic r6: 'flat glowing cards with no LED pixel grid or scanline')
        vec2 cb = vEmissiveMapUv * vec2(4096.0) / 32.0; vec2 fc = fwidth(cb);
        float kc = clamp(1.0 - max(fc.x, fc.y) * 14.0, 0.0, 1.0);
        vec2 gc = 0.5 - abs(fract(cb) - 0.5);
        float seam = max(1.0 - smoothstep(0.006, 0.006 + fc.x, gc.x), 1.0 - smoothstep(0.006, 0.006 + fc.y, gc.y));
        totalEmissiveRadiance *= 1.0 - 0.09 * seam * kc; // (r9) 0.2 -> 0.09 (critic r8: 'visible grid tiling pattern' up close)
        float kr = clamp(1.0 - fw.y * 1.4, 0.0, 1.0);
        totalEmissiveRadiance *= mix(1.0, 0.8 + 0.2 * cos(px.y * 6.2831853), kr * 0.8);
        // (r7) LED viewing cone: panels seen off-axis dim + shift slightly cool, so screens at different angles differ
        float ca = abs(dot(normalize(normal), normalize(vViewPosition)));
        totalEmissiveRadiance *= mix(vec3(0.5, 0.54, 0.6), vec3(1.0), smoothstep(0.08, 0.7, ca));
        // (r7) soft highlight shoulder: whites roll off instead of clipping to a flat near-white card
        float mx = max(totalEmissiveRadiance.r, max(totalEmissiveRadiance.g, totalEmissiveRadiance.b));
        if (mx > 1.0) totalEmissiveRadiance *= (1.0 + (mx - 1.0) / (1.0 + (mx - 1.0) * 1.1)) / mx;
        ${SCR_SHOULDER_GLSL.replace("+ 1e-4;", "* clamp(vColor.r / 0.7, 0.3, 1.0) + 1e-4;")} }`,
      ); // (night r10) dim-driven panels (vertex k < 0.7) get a lower white cap
  };
  const scrMesh = add(scr.build(), sm, "tsScreens");
  {
    // (r6) printed vinyl posters: same atlas, lit by the sun / sky, slightly faded print
    const vm = new THREE.MeshStandardMaterial({
      map: adsTex,
      vertexColors: true,
      roughness: 0.62,
      metalness: 0,
      color: 0xe2e2e2,
      emissive: 0xffffff,
      emissiveMap: adsTex,
      emissiveIntensity: 0,
    }); // (daynight) lit by gooseneck lamps at night (lighting.js scan: userData.nightLit)
    vm.userData.nightLit = 0.3;
    vm.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), 0.2) * 0.92 + 0.012;`,
      );
    };
    add(vin.build(), vm, "tsVinyl");
  }
  {
    // (r6) contact AO cards (alpha-only darkening; keeps the target alpha = the pipeline's SSR weight)
    const am = new THREE.MeshBasicMaterial({
      map: aoTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    Object.assign(am, {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    am.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <color_fragment>",
        "diffuseColor.a *= vColor.r; diffuseColor.rgb = vec3(0.0);",
      );
    };
    const m = add(ao.build(), am, "tsAO");
    if (m) {
      m.receiveShadow = false;
      m.renderOrder = 3;
    }
  }
  add(sgn.build(), screenNightMat(screenMat(signTex), "tsSigns"), "tsSigns"); // (night) screenNightMat: bright at night
  {
    // (billboards r6) neon tube lettering: the sign atlas letters only (contrast vs the blurred board), tube hue from the
    // vertex colour with a whiter hot core; the board is discarded so the wall / raceway shows between the letters
    const nm = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveMap: signTex,
      emissiveIntensity: 2.2,
      roughness: 0.4,
      metalness: 0,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    nm.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `{
      vec3 c = texture2D(emissiveMap, vEmissiveMapUv).rgb, b = textureLod(emissiveMap, vEmissiveMapUv, 5.0).rgb;
      float m = smoothstep(0.1, 0.3, length(c - b));
      if (m < 0.4) discard;
      totalEmissiveRadiance = emissive * mix(vColor.rgb, vec3(1.0, 0.96, 0.92), 0.45 * smoothstep(0.65, 1.0, m)) * m; }`,
      );
    };
    nm.customProgramCacheKey = () => "tsNeon";
    screenNightMat(nm, "neon"); // (night)
    add(neo.build(), nm, "tsNeon");
  }
  add(
    lit.build(),
    new THREE.MeshBasicMaterial({
      map: dots,
      vertexColors: true,
      color: 0xffffff,
      side: THREE.DoubleSide,
    }),
    "tsLights",
  );
  {
    // scrolling news zippers
    const tt = loadTex(TEX + "ts_ticker.webp", { aniso: 8 });
    tt.wrapS = THREE.RepeatWrapping;
    const tm = add(
      tck.build(),
      screenNightMat(
        new THREE.MeshStandardMaterial({
          map: tt,
          color: 0x202020,
          emissive: 0xffffff,
          emissiveMap: tt,
          emissiveIntensity: 2.4,
          roughness: 0.35,
        }),
        "ticker",
      ),
      "tsTicker",
    ); // (night)
    if (tm)
      tm.onBeforeRender = () => {
        tt.offset.x = (performance.now() * 0.00004) % 1;
      };
  }
  {
    // screen light spill (additive, no depth write)
    const st = loadTex(TEX + "ts_spill.png", { aniso: 1 });
    // custom additive blend that leaves the target's alpha alone (scene alpha > 1 is the pipeline's SSR weight)
    const sm2 = new THREE.MeshBasicMaterial({
      map: st,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    Object.assign(sm2, {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    const m = add(spl.build(), sm2, "tsSpill");
    if (m) {
      m.receiveShadow = false;
      m.renderOrder = 2;
    }
    // (daynight, lighting2 r4) additive spill is scaled by the x4.5 night exposure: it blew the road / plaza to white.
    // At night the spill drops to ~22 % (the per-pixel coloured spill in render/surface.js carries the screen light)
    // (night) with real screen lights (cityLights) the fake spill fades out completely as the lights fade in
    if (m)
      m.onBeforeRender = () => {
        sm2.color.setScalar(1 - (cityLights.enabled ? 1 : 0.78) * nightK.value);
      };
    // (r9) halo falloff texture: (1 - |uv|)^2 radial from the (0, 0) corner = the screen edge
    const HS = 64,
      hd = new Uint8Array(HS * HS * 4);
    for (let y = 0; y < HS; y++)
      for (let x = 0; x < HS; x++) {
        const r = Math.min(1, Math.hypot(x / (HS - 1), y / (HS - 1))),
          v = Math.round(255 * Math.pow(1 - r, 2.2)),
          k = (y * HS + x) * 4;
        hd[k] = hd[k + 1] = hd[k + 2] = v;
        hd[k + 3] = 255;
      }
    const ht = new THREE.DataTexture(hd, HS, HS);
    ht.magFilter = THREE.LinearFilter;
    ht.minFilter = THREE.LinearFilter;
    ht.needsUpdate = true;
    const hm = sm2.clone();
    hm.map = ht;
    // (r10) fade the halo out when seen from above (it read as a bright cyan rectangle from swinging altitude):
    // full strength for views within ~17 deg of horizontal, gone by ~40 deg looking down
    hm.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vHaloF;",
        )
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\n{ vec3 hwp = (modelMatrix * vec4(transformed, 1.0)).xyz; vHaloF = 1.0 - smoothstep(0.3, 0.65, -normalize(hwp - cameraPosition).y); }",
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vHaloF;",
        )
        .replace(
          "#include <opaque_fragment>",
          "outgoingLight *= vHaloF;\n#include <opaque_fragment>",
        );
    };
    hm.customProgramCacheKey = () => "tsHaloFade";
    const mh = add(hal.build(), hm, "tsHalo");
    if (mh) {
      mh.receiveShadow = false;
      mh.renderOrder = 2;
      mh.onBeforeRender = () => {
        hm.color.setScalar(1 - (cityLights.enabled ? 1 : 0.72) * nightK.value);
      };
    } // (daynight) halo glow not blown at night
    // (night) full night + real screen lights: the spill / halo cards add nothing -> not drawn (toggled from the screens'
    // own onBeforeRender, one frame lag; by day / at dusk they stay)
    if (scrMesh && (m || mh))
      scrMesh.onBeforeRender = () => {
        const on = !(cityLights.enabled && nightK.value > 0.99);
        if (m) m.visible = on;
        if (mh) mh.visible = on;
      };
  }
  {
    // wear decals (plaza + avenue roadway)
    const dt = loadTex(TEX + "ts_decals.webp", { aniso: 8 });
    const dm = new THREE.MeshStandardMaterial({
      map: dt,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      roughness: 0.75,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    });
    Object.assign(dm, {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    const m = add(dec.build(), dm, "tsDecals");
    if (m) m.renderOrder = 1;
    const rt = loadTex(TEX + "ts_road.webp", { aniso: 8 }),
      rm = dm.clone();
    rm.map = rt;
    const m2 = add(rdw.build(), rm, "tsRoadWear"); // (r5)
    if (m2) m2.renderOrder = 1;
    const rm2 = dm.clone();
    rm2.map = loadTex(TEX + "ts_road2.webp", { aniso: 8 }); // (r7)
    const m3 = add(rd2.build(), rm2, "tsRoadWear2");
    if (m3) m3.renderOrder = 1;
    const rm3 = dm.clone();
    rm3.map = loadTex(TEX + "ts_road3.webp", { aniso: 8 }); // (r9)
    const m4r = add(rd3.build(), rm3, "tsRoadWear3");
    if (m4r) m4r.renderOrder = 1;
  }
  // storefront glass: lit interior card (emissive) under a glossy, env-reflecting surface
  const shopTex = loadTex(TEX + "ts_shops.webp", { aniso: 4 });
  {
    // (r6) interior mapping: each bay is a 5.5 m deep lit room (floor tiles, ceiling light panels, side walls, the shop
    // card on the back wall) ray-traced per pixel behind the reflective glass
    const shm = new THREE.MeshStandardMaterial({
      map: shopTex,
      color: 0x303030,
      emissive: 0xffffff,
      emissiveMap: shopTex,
      emissiveIntensity: 1.0 /* (r11) was 0.72: 'storefront band dark and muddy' */,
      roughness: 0.05,
      metalness: 0.0,
      vertexColors: true,
    });
    shm.onBeforeCompile = (sh) => {
      sh.vertexShader =
        "attribute vec3 aTan;\nattribute vec4 aRoom;\nvarying vec3 vTanW;\nvarying vec4 vRoom;\nvarying vec3 vWP;\nvarying vec3 vNW;\n" +
        sh.vertexShader.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\n vTanW = aTan; vRoom = aRoom; vNW = normal; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;",
        );
      sh.fragmentShader =
        "varying vec3 vTanW;\nvarying vec4 vRoom;\nvarying vec3 vWP;\nvarying vec3 vNW;\n" +
        sh.fragmentShader
          .replace(
            "#include <map_fragment>",
            "#include <map_fragment>\n diffuseColor.rgb = vec3(0.03);",
          )
          .replace(
            "#include <emissivemap_fragment>",
            `{
          vec3 V = normalize(vWP - cameraPosition), Nn = normalize(vNW), Tt = normalize(vTanW);
          float dx = dot(V, Tt), dy = V.y, dz = max(-dot(V, Nn), 1e-3);
          vec2 sz = vRoom.zw, p = vRoom.xy * sz; const float D = 5.5;
          float tx = dx > 1e-4 ? (sz.x - p.x) / dx : (dx < -1e-4 ? -p.x / dx : 1e5);
          float ty = dy > 1e-4 ? (sz.y + 0.6 - p.y) / dy : (dy < -1e-4 ? -(p.y + 0.5) / dy : 1e5);
          float tz = D / dz, t = min(min(tx, ty), tz);
          vec3 h = vec3(p.x + dx * t, p.y + dy * t, dz * t);
          vec2 cs = vec2(0.242, 0.49), c0 = vEmissiveMapUv - vRoom.xy * cs;
          float fall = 1.0 - 0.4 * h.z / D;
          vec3 col;
          if (t >= tz - 1e-3) col = texture2D(emissiveMap, c0 + clamp(h.xy / sz, 0.02, 0.98) * cs).rgb;
          else if (t >= tx - 1e-3) { float s = 0.3 * h.z / D; // side walls: the outer strips of the shop picture run down the wall
            col = texture2D(emissiveMap, c0 + vec2(dx > 0.0 ? 0.98 - s : 0.02 + s, clamp(h.y / sz.y, 0.02, 0.98)) * cs).rgb * 0.6 * fall; }
          else if (dy > 0.0) { float lp = step(0.62, fract(h.z / 1.5 + 0.2)) * step(0.3, fract(h.x / 1.8 + 0.15));
            col = vec3(0.3, 0.29, 0.27) * fall + vec3(1.7, 1.6, 1.4) * lp; }
          else { vec2 q = vec2(h.x, h.z) / 0.6; float tl = step(0.05, fract(q.x)) * step(0.05, fract(q.y));
            col = vec3(0.36, 0.33, 0.3) * (0.7 + 0.3 * tl) * fall; }
          totalEmissiveRadiance = emissive * col * vColor.r;
        }`,
          );
    };
    add(shp.build(), shm, "tsShops");
  }
  if (frm.v)
    add(
      frm.build(),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        metalness: 0.5,
      }),
      "tsFrames",
      true,
    );
  // (r6) paver normal (recessed grout, bevelled arrises) + roughness (G) / cavity (R) maps, tools/gen_ts_ground6.py
  const pavN = loadTex(TEX + "ts_pavers_n.webp", {
      srgb: false,
      repeat: true,
      aniso: 16,
    }),
    pavR = loadTex(TEX + "ts_pavers_r.webp", {
      srgb: false,
      repeat: true,
      aniso: 8,
    });
  const pm = new THREE.MeshStandardMaterial({
    map: paveTex,
    normalMap: pavN,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: pavR,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  // macro variation: large soft blotches (wear / grime / cleaning patterns) so the 9.6 m paver tile never reads as a repeat
  const noiseTex = loadTex(TEX + "noise.png", {
    srgb: false,
    repeat: true,
    aniso: 1,
  });
  // (r7) painted plaza graphics: big worn blue / teal / grey discs painted over the pavers (the real plaza's circles).
  // Drawn in the paver shader, so the grout, stains and cavity darkening show through the paint (not a sticker decal)
  const circ = [];
  {
    const K = TS.tkts;
    for (const zs of TS.plazaRows) {
      const { c0, c1 } = rowZ(zs);
      for (const sg of [-1, 1])
        for (let k = 0, tries = 0; k < 4 && tries < 60; tries++) {
          const r = 2.2 + rnd() * 2.2,
            x =
              sg *
              (G.AV_HALF + 4 + r + rnd() * (TS.plazaX - G.AV_HALF - 8 - 2 * r)),
            z = c0 + 3 + r + rnd() * (c1 - c0 - 6 - 2 * r);
          if (
            x + r > K.x0 - 1 &&
            x - r < K.x1 + 1 &&
            z + r > K.zBack - 1 &&
            z - r < K.zFront + 1
          )
            continue;
          if (circ.some((c) => Math.hypot(c.x - x, c.y - z) < c.z + r + 2.5))
            continue;
          circ.push(new THREE.Vector4(x, z, r, Math.floor(rnd() * 4)));
          k++;
        }
    }
    while (circ.length < 24) circ.push(new THREE.Vector4(0, 0, -1, 0));
  }
  pm.onBeforeCompile = (sh) => {
    sh.uniforms.tMacro = { value: noiseTex };
    sh.uniforms.uCirc = { value: circ };
    sh.uniforms.uEdgeX = { value: TS.plazaX };
    sh.fragmentShader =
      "uniform sampler2D tMacro;\nuniform vec4 uCirc[24];\nuniform float uEdgeX;\n" +
      sh.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
      { vec2 wp = vec2(vMapUv.x, -vMapUv.y) * 9.6;
        // (r7) large-scale colour variance (warm red-brown <-> cooler grey-pink fields), lighter polished walking lines,
        // darker grime along the building frontage
        float h1 = texture2D(tMacro, wp * 0.0071 + 0.53).b, h2 = texture2D(tMacro, wp * 0.021 + 0.21).r;
        diffuseColor.rgb *= mix(vec3(1.07, 0.97, 0.9), vec3(0.9, 0.96, 1.05), smoothstep(0.3, 0.72, h1));
        float path = smoothstep(0.55, 0.8, h2) * (0.6 + 0.4 * texture2D(tMacro, wp * 0.13).g);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + vec3(0.012, 0.011, 0.01), path * 0.7);
        float ex = abs(wp.x);
        diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(uEdgeX - 4.0, uEdgeX - 0.5, ex) * (0.6 + 0.4 * h2);
        // painted discs: worn, blotchy, paver texture multiplied through
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        for (int i = 0; i < 24; i++) {
          vec4 C = uCirc[i]; if (C.z < 0.0) continue;
          float d = length(wp - C.xy) - C.z;
          if (d > 0.05) continue;
          float m = 1.0 - smoothstep(-0.04, 0.03, d);
          float rim = (1.0 - smoothstep(-0.34, -0.3, d)) * smoothstep(-0.46, -0.42, d); // pale inner ring line
          vec3 pc = C.w < 0.5 ? vec3(0.07, 0.2, 0.3) : C.w < 1.5 ? vec3(0.09, 0.22, 0.24) : C.w < 2.5 ? vec3(0.16, 0.17, 0.2) : vec3(0.06, 0.12, 0.26);
          float wr = texture2D(tMacro, wp * 0.31 + C.xy * 0.01).g * 0.6 + texture2D(tMacro, wp * 1.9).r * 0.5;
          float keep = smoothstep(0.34, 0.62, wr);
          vec3 painted = pc * clamp(lum / 0.16, 0.45, 1.5);
          painted = mix(painted, vec3(0.5, 0.52, 0.52) * clamp(lum / 0.16, 0.45, 1.5), rim * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, painted, m * keep * 0.5); // (r8) fainter, worn (critic: 'cheap flat circles')
        } }
      { float a = texture2D(tMacro, vMapUv * 0.061).r, b = texture2D(tMacro, vMapUv * 0.23 + 0.37).g, c = texture2D(tMacro, vMapUv * 0.9 + 0.11).b;
        diffuseColor.rgb *= 0.74 + 0.42 * a * (0.7 + 0.6 * b);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))), 0.12 + 0.25 * smoothstep(0.55, 0.8, c));
        diffuseColor.rgb *= mix(1.0, texture2D(roughnessMap, vRoughnessMapUv).r, 0.8);
        diffuseColor.rgb = diffuseColor.rgb * 1.2 + vec3(0.014, 0.012, 0.011); // (r8) paler, sunlit pavers (director r7)
        // (r11) critic r9: 'pavers flat and too saturated, no grime' -> less chroma + a sooty film in the macro noise lows
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.2);
        diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(0.5, 0.2, a) * (0.5 + 0.5 * b); }`,
      );
  };
  add(pav.build(), pm, "tsPavers");
  {
    // (r8) weathered, sun-bleached asphalt: a pale blotchy wash over every roadway in the square (director r7: 'the road
    // reads too dark vs the ref's sunlit pale grey'). Alpha-preserving blend (the pipeline reads alpha as SSR weight).
    const dq = new QB(),
      y = 0.0125,
      S_ = 37;
    const rect = (x0, z0, x1, z1) =>
      dq.quad(
        [x0, y, z1],
        [x1, y, z1],
        [x1, y, z0],
        [x0, y, z0],
        [0, 1, 0],
        [x0 / S_, z1 / S_, x1 / S_, z0 / S_],
      );
    for (const zs of [-320, -240, -160])
      rect(-G.AV_HALF, zs + G.ST_HALF, G.AV_HALF, zs + G.ST_SP - G.ST_HALF); // avenue blocks
    for (const zs of [-320, -240, -160, -80, 0])
      rect(-TS.towerX, zs - G.ST_HALF, TS.towerX, zs + G.ST_HALF); // cross streets
    // (r11) critic r9: 'foreground asphalt flat, over-bright and washed out' -> the wash is now a darker grime / tyre
    // film (was a pale 0xaaa7a1 sun-bleach) with sparse pale dusty blotches kept only in the lightest noise fields
    const mkDust = (cwOnly) => {
      const dm2 = new THREE.MeshStandardMaterial({
        map: noiseTex,
        color: 0x5d5b57,
        roughness: 0.93,
        metalness: 0,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      Object.assign(dm2, {
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor,
      });
      dm2.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
          "#include <map_fragment>",
          `{
      vec4 n1 = texture2D(map, vMapUv), n2 = texture2D(map, vMapUv * 4.3 + 0.37), n3 = texture2D(map, vMapUv * 17.0 + 0.71);
      float pale = smoothstep(0.72, 0.9, n1.g) * smoothstep(0.45, 0.75, n2.b);
      diffuseColor = vec4(mix(diffuse * (0.75 + 0.4 * n3.b), vec3(0.62, 0.61, 0.58), pale), clamp((0.26 + 0.34 * smoothstep(0.2, 0.8, n1.r)) * (0.65 + 0.7 * n2.g) + 0.25 * pale, 0.0, 0.68));
      vec2 wq = vMapUv * ${S_}.0;
      // (r11) worn crosswalk paint (critic r9: 'stripes too clean and uniformly white'): denser grime film + chipped
      // spots over the avenue crossings (z = street +- 7.4) and the side-street crossings (|x| = 13.4)
      { float zz = mod(wq.y, ${G.ST_SP}.0), ax = abs(wq.x);
        float cw = (1.0 - smoothstep(2.2, 3.0, abs(zz - ${G.ST_HALF + 2.4}))) + (1.0 - smoothstep(2.2, 3.0, abs(zz - ${G.ST_SP - G.ST_HALF - 2.4})));
        cw *= 1.0 - smoothstep(${G.AV_HALF - 0.5}, ${G.AV_HALF + 0.5}, ax);
        cw += (1.0 - smoothstep(${G.ST_HALF - 0.5}, ${G.ST_HALF + 0.2}, min(zz, ${G.ST_SP}.0 - zz))) * (1.0 - smoothstep(1.8, 2.6, abs(ax - ${G.AV_HALF + 2.4})));
        float chip = smoothstep(0.55, 0.72, n3.r) * (0.6 + 0.4 * n2.b);
        diffuseColor.a = ${cwOnly ? "clamp(cw, 0.0, 1.0) * (0.32 + 0.5 * chip)" : "diffuseColor.a"}; }
      diffuseColor.a *= smoothstep(${TS.towerX}.0, ${TS.towerX - 24}.0, abs(wq.x)) * smoothstep(-326.0, -306.0, wq.y) * smoothstep(6.0, -8.0, wq.y); }`,
        );
      };
      dm2.customProgramCacheKey = () => "tsDust" + (cwOnly ? "CW" : "");
      return dm2;
    };
    const m = add(dq.build(), mkDust(false), "tsRoadDust");
    if (m) m.renderOrder = 0.5;
    // (r11) the crosswalk wear is its own small mesh drawn AFTER the ground markings (renderOrder 1, transparent), so the
    // grime film + chipping lands on the paint itself
    const cq = new QB(),
      yc = 0.02;
    const crect = (x0, z0, x1, z1) =>
      cq.quad(
        [x0, yc, z1],
        [x1, yc, z1],
        [x1, yc, z0],
        [x0, yc, z0],
        [0, 1, 0],
        [x0 / S_, z1 / S_, x1 / S_, z0 / S_],
      );
    for (const zs of [-320, -240, -160, -80, 0]) {
      for (const z0 of [zs - G.ST_HALF - 5.2, zs + G.ST_HALF + 0.2])
        if (z0 > -330 && z0 < 0) crect(-G.AV_HALF, z0, G.AV_HALF, z0 + 5);
      for (const sg of [-1, 1])
        crect(
          sg > 0 ? G.AV_HALF + 0.2 : -G.AV_HALF - 4.6,
          zs - G.ST_HALF,
          sg > 0 ? G.AV_HALF + 4.6 : -G.AV_HALF - 0.2,
          zs + G.ST_HALF,
        );
    }
    const mc = add(cq.build(), mkDust(true), "tsCrossWear");
    if (mc) {
      mc.renderOrder = 1.5;
      mc.receiveShadow = true;
    }
  }
  {
    // (r9) clear glass (alpha-preserving blend: the pipeline reads target alpha as the SSR weight)
    const gm = new THREE.MeshStandardMaterial({
      color: 0xcfe0e4,
      transparent: true,
      opacity: 0.2,
      roughness: 0.04,
      metalness: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      vertexColors: true,
    });
    Object.assign(gm, {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    const m = add(glass.build(), gm, "tsGlass");
    if (m) m.renderOrder = 4;
  }
  add(
    band.build(),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
    "tsBands",
  );
  if (tk.v) {
    const tm = add(
      tk.build(),
      Object.assign(
        new THREE.MeshStandardMaterial({
          color: 0xa81c22,
          emissive: 0xc0141c,
          emissiveIntensity: 0.12 /* (billboards r6) 0.85 -> 0.12: critic r5 'glowing flat salmon wedge, no step shading' - the risers carry the glow */,
          roughness: 0.5,
          metalness: 0.1,
          vertexColors: true,
        }),
        { userData: { nightGain: 0.4 } },
      ) /* (daynight) TKTS: x0.4 at night via lighting.js (was x3: a flat glowing red slab) */,
      "tsTKTS",
      true,
    );
    // (billboards r4, daynight) critic r3 night: 'bleachers are a flat glowing orange-pink slab, read as a light leak' - the
    // x4.5 night exposure blew the red glass glow to pink-white; at night it drops so the steps read deep red, row by row
    // (lighting2 r5) no per-frame override any more: it fought userData.nightGain (lighting.js night scan). One path: nightGain 0.4
    if (tm) tm.material.userData.nightGain = 0.4;
  }
  const slStats = SLS.commit("ts"); // (night) screens / neon / marquees -> cityLights
  signLights(signQ);
  return {
    planters: planters.length,
    bollards: bollards.length,
    screens: scr.v / 4,
    crowd: tsCrowdSpots.length,
    lights: slStats,
  };
}

// (r5) props.js asks this before placing sidewalk sheds / dumpsters: none inside the square (they read as placeholder
// slabs in the middle of the plaza views)
export const tsNoProp = (x, z) =>
  Math.abs(x) < TS.towerX + 6 && z > -332 && z < 8;

// street trees: Times Square has almost none (refs 12-15). Drop the props module's tree spots inside the square
// (keeps a few along the far ends); called by city.js before buildTrees.
export function tsTrimTrees(spots) {
  const r = mulberry32(77);
  for (let i = spots.length - 1; i >= 0; i--) {
    const s = spots[i];
    if (Math.abs(s.x) < TS.towerX + 8 && s.z > -330 && s.z < 8 && r() > -1)
      spots.splice(i, 1);
  }
  for (const t of TS_TREE_SPOTS) spots.push(t); // (r9) trees in the plaza's tree planters
}
