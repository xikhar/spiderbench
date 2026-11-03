// @ts-nocheck
// City-wide signage outside Times Square, attached procedurally per building lot + face, so it
// follows whatever street layout generateBuildings() was given (no hard-coded coordinates except optional square hints):
//   * rooftop billboard frames (printed vinyl from the ts_ads atlas, steel columns, catwalk, gooseneck lamps) on low /
//     mid-rise roofs, facing an avenue, the waterfront highway / bridges, or (rarer) a side street
//   * painted / vinyl wall ads on exposed party walls (above the lower neighbour), faded 'ghost signs' on old brick
//   * tall vertical blade signs (hotels, theatres, delis ... sign atlas, lit) on shopfront facades
//   * LED screens at key corners (Herald-Square / Union-Square-like squares when layout exports them, else hot corners)
// Density follows layout.district(): heavy in Midtown / near Times Square / the square hints, moderate on avenues,
// light in residential / park edges, few (corporate LED only) in FiDi.
//
//   buildSignage({ scene, gen }) -> { update(camPos), stats }
//   Call after buildTimesSquare / buildRooftops and BEFORE the tile builders are converted (fine steel goes into the
//   per-tile detail meshes: no extra draw calls; it fades with the detail tiles). Ad faces + main steel are one opaque
//   mesh per 512 m cell (+ one blended ghost-sign mesh per cell), distance culled. Every solid registers collision.
import { lazyShaderSections } from "../shaderSections.ts";
import signageShaderSource from "./shaders/glsl/signage.glsl?raw";
import { injectShader } from "../render/shaderInjection.ts";
import * as THREE from "three";
import { assetUrl } from "../assets.ts";
import * as LAY from "./layout.ts";
const { district, mulberry32, streetsAt, SITES } = LAY;
import { DP } from "./buildings.ts";
import { LAYER } from "./facade.ts";
import { OVERHANG } from "./collision.ts";
import {
  LANDSCAPE_AD_AVERAGE_LINEAR_RGB as landscapeAdAverageLinearRgb,
  PORTRAIT_AD_AVERAGE_LINEAR_RGB as portraitAdAverageLinearRgb,
} from "./advertisingAtlasMetadata.ts";
import { nightK, screenK } from "../render/daynight.ts"; // (daynight)
import {
  getAdvertisingAtlasTexture,
  getSignAtlasTexture,
  getSignColorGrid,
} from "./advertisingTextures.ts"; // shared ad and sign textures
import {
  screenLightSet,
  uScrBoost,
  uScrKnee,
  uScrTop,
} from "./screenlights.ts";

const signageShader = lazyShaderSections(() => signageShaderSource);
// (night) LED screens / marquees as real lights

const TEX = assetUrl("city/tex/");
const CELL = 512;
const Q =
  typeof location !== "undefined"
    ? new URLSearchParams(location.search)
    : new URLSearchParams();
const OFF = Q.has("nosignage");

// ------------------------------------------------------------------------------------------------ atlas pickers
// ts_ads.webp: top half 64 landscape cells (512x256, 8 x 8), bottom half 64 portrait cells (256x512, 16 x 4).
// ts_signs.webp: 64 storefront signs 512x128 (4 cols x 16 rows); addressed with u + 2 (second sampler in the shader).
function makePicker(n, rnd, ban = []) {
  const used = Array.from({ length: n }, () => []);
  return (x, z, avoid = null) => {
    let best = 0,
      bd = -1;
    for (let i = 0; i < n; i++) {
      if ((avoid && avoid(i)) || ban.includes(i)) continue;
      let d = 1e5;
      for (const q of used[i]) d = Math.min(d, Math.hypot(q[0] - x, q[1] - z));
      d += rnd() * 40;
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    used[best].push([x, z]);
    return best;
  };
}
// crop a cell (u0, v0, du, dv, cell aspect ca) to the target aspect; 2-texel inset against mip bleed
function crop(u0, v0, du, dv, ca, aspect, tex, texH = tex) {
  const e = 2 / tex,
    f = 2 / texH;
  u0 += e;
  du -= 2 * e;
  v0 += f;
  dv -= 2 * f;
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
const adLand = (i, aspect) =>
  crop(
    (i % 8) / 8,
    1 - (Math.floor(i / 8) + 1) / 16,
    1 / 8,
    1 / 16,
    2,
    aspect,
    4096,
  );
const adPort = (i, aspect) =>
  crop(
    (i % 16) / 16,
    0.5 - (Math.floor(i / 16) + 1) / 8,
    1 / 16,
    1 / 8,
    0.5,
    aspect,
    4096,
  );
const signCell = (i, aspect) => {
  const r = crop(
    (i % 4) / 4,
    1 - (Math.floor(i / 4) + 1) / 16,
    1 / 4,
    1 / 16,
    4,
    aspect,
    2048,
  );
  r[0] += 2;
  r[2] += 2;
  return r;
};
// (r3) city_signart.webp (2048 x 1280, tools/imagegen/signage/pack_ads.py, Codex-generated): 8 painted ghost signs
// (1024 x 256, 2 x 4) + 8 shop fascia boards (512 x 128, 4 x 2 at y 1024); addressed with u + 4 (third sampler).
const artCell = (x0, y0, w, h, aspect) => {
  const r = crop(
    x0 / 2048,
    1 - (y0 + h) / 1792,
    w / 2048,
    h / 1792,
    4,
    aspect,
    2048,
    1792,
  );
  r[0] += 4;
  r[2] += 4;
  return r;
}; // (r4) atlas 1280 -> 1792 tall
const ghostArt = (i, aspect) =>
  artCell((i % 2) * 1024, Math.floor(i / 2) * 256, 1024, 256, aspect);
const shopArt = (i, aspect) =>
  artCell((i % 4) * 512, 1024 + Math.floor(i / 4) * 128, 512, 128, aspect);
const winArt = (i, aspect) =>
  artCell((i % 4) * 512, 1280 + Math.floor(i / 4) * 128, 512, 128, aspect); // (r4) window lettering (0-7 gold leaf, 8-15 white vinyl)
// sign-atlas cells that read as old painted wall signs / hotel & theatre blades
const GHOST_OK = [
  1, 4, 8, 11, 12, 13, 19, 21, 24, 28, 33, 35, 36, 37, 40, 48, 52, 56, 60, 61,
  62, 63,
];
const BLADE_OK = [
  2, 11, 12, 13, 15, 19, 24, 32, 36, 41, 44, 45, 46, 51, 52, 56, 59, 61,
];

// ------------------------------------------------------------------------------------------------ batch
// kind (aSig.x): 0 plain steel (vertex colour), 1 printed vinyl, 2 painted wall ad, 3 LED screen, 4 lit sign, 5 ghost, 6 bulbs
class SB {
  constructor() {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.c = [];
    this.s = [];
    this.l = [];
    this.i = [];
    this.v = 0;
  }
  quad(P4, n, uv, col, kind, gain) {
    for (const q of P4) {
      this.p.push(q[0], q[1], q[2]);
      this.n.push(n[0], n[1], n[2]);
      this.c.push(col[0], col[1], col[2]);
      this.s.push(kind, gain);
    }
    if (uv)
      this.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
    else this.uv.push(0, 0, 0, 0, 0, 0, 0, 0);
    this.l.push(0, 0, 1, 0, 1, 1, 0, 1); // (r3) quad-local 0..1 (edge wear, ghost fade, awning stripes)
    this.i.push(this.v, this.v + 1, this.v + 2, this.v, this.v + 2, this.v + 3);
    this.v += 4;
  }
  build() {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute("aSig", new THREE.Float32BufferAttribute(this.s, 2));
    g.setAttribute("aLoc", new THREE.Float32BufferAttribute(this.l, 2));
    g.setIndex(
      this.v > 65535
        ? new THREE.Uint32BufferAttribute(this.i, 1)
        : new THREE.Uint16BufferAttribute(this.i, 1),
    );
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
const srgb = (h) =>
  [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map((s) =>
    Math.pow(s, 2.2),
  );

// face frame of an axis-aligned mass side: O = left corner seen from outside, T along the face, N outward
function frame(m, s) {
  switch (s) {
    case "pz":
      return { O: [m.x0, m.z1], T: [1, 0], N: [0, 1], W: m.x1 - m.x0, s };
    case "nz":
      return { O: [m.x1, m.z0], T: [-1, 0], N: [0, -1], W: m.x1 - m.x0, s };
    case "px":
      return { O: [m.x1, m.z1], T: [0, -1], N: [1, 0], W: m.z1 - m.z0, s };
    default:
      return { O: [m.x0, m.z0], T: [0, 1], N: [-1, 0], W: m.z1 - m.z0, s };
  }
}
const at = (fr, u, y, n) => [
  fr.O[0] + fr.T[0] * u + fr.N[0] * n,
  y,
  fr.O[1] + fr.T[1] * u + fr.N[1] * n,
];
const aabb = (fr, u0, y0, n0, u1, y1, n1) => {
  const a = at(fr, u0, y0, n0),
    b = at(fr, u1, y1, n1);
  return [
    Math.min(a[0], b[0]),
    y0,
    Math.min(a[2], b[2]),
    Math.max(a[0], b[0]),
    y1,
    Math.max(a[2], b[2]),
  ];
};
// face-frame box into an SB: `front` = uv for the +N face (null: plain); all other faces plain `col`
function boxF(
  B,
  fr,
  u0,
  u1,
  y0,
  y1,
  n0,
  n1,
  col,
  front = null,
  kind = 0,
  gain = 0,
  faces = 63,
  pk = 0,
) {
  // pk: kind of the plain faces (r3: 7 = fabric)
  const P = (u, y, n) => at(fr, u, y, n);
  const T3 = [fr.T[0], 0, fr.T[1]],
    N3 = [fr.N[0], 0, fr.N[1]];
  const neg = (v) => v.map((x) => -x);
  if (faces & 1)
    B.quad(
      [P(u0, y0, n1), P(u1, y0, n1), P(u1, y1, n1), P(u0, y1, n1)],
      N3,
      front,
      front ? [1, 1, 1] : col,
      front ? kind : pk,
      gain,
    ); // front (+N)
  if (faces & 2)
    B.quad(
      [P(u1, y0, n0), P(u0, y0, n0), P(u0, y1, n0), P(u1, y1, n0)],
      neg(N3),
      null,
      col,
      pk,
      0,
    ); // back
  if (faces & 4)
    B.quad(
      [P(u1, y0, n1), P(u1, y0, n0), P(u1, y1, n0), P(u1, y1, n1)],
      T3,
      null,
      col,
      pk,
      0,
    ); // right (+T)
  if (faces & 8)
    B.quad(
      [P(u0, y0, n0), P(u0, y0, n1), P(u0, y1, n1), P(u0, y1, n0)],
      neg(T3),
      null,
      col,
      pk,
      0,
    ); // left
  if (faces & 16)
    B.quad(
      [P(u0, y1, n1), P(u1, y1, n1), P(u1, y1, n0), P(u0, y1, n0)],
      [0, 1, 0],
      null,
      col.map((v) => v * 1.1),
      pk,
      0,
    ); // top
  if (faces & 32)
    B.quad(
      [P(u0, y0, n0), P(u1, y0, n0), P(u1, y0, n1), P(u0, y0, n1)],
      [0, -1, 0],
      null,
      col.map((v) => v * 0.6),
      pk,
      0,
    ); // bottom
}
// face-frame box into a detail tile MeshBuilder (world transform baked; face frame axis aligned)
function detBox(D, fr, u0, u1, y0, y1, n0, n1) {
  const b = aabb(fr, u0, y0, n0, u1, y1, n1);
  D.box(b[0], b[1], b[2], b[3], b[4], b[5]);
}

// ------------------------------------------------------------------------------------------------ materials
function loadTex(url) {
  const t = new THREE.TextureLoader().load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function signMaterial(ads, signs, noise, ghost, art) {
  const mat = new THREE.MeshStandardMaterial({
    map: ads,
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
    transparent: ghost,
    depthWrite: !ghost,
    polygonOffset: ghost,
    polygonOffsetFactor: ghost ? -3 : 0,
    polygonOffsetUnits: ghost ? -3 : 0,
  });
  if (ghost)
    Object.assign(mat, {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    }); // keep the target alpha (SSR weight)
  const uni = {
    tSigns: { value: signs },
    tNoiseS: { value: noise },
    tArt: { value: art },
    uNightK: nightK,
    uScreenK: screenK,
    uScrBoost,
    uScrKnee,
    uScrTop,
  }; // (daynight) uNightK (night) uScrBoost / shoulder
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",signageShader.vertexCommon,
      )
      .replace(
        "#include <fog_vertex>",signageShader.vertexFogVertex,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",signageShader.fragmentCommon,
      )
      .replace("#include <map_fragment>",signageShader.fragmentMap)
      .replace(
        "#include <color_fragment>",signageShader.fragmentColor,
      )
      .replace(
        "#include <roughnessmap_fragment>",signageShader.fragmentRoughness,
      )
      .replace(
        "#include <metalnessmap_fragment>",signageShader.fragmentMetalness,
      )
      .replace(
        "#include <emissivemap_fragment>",injectShader(signageShader.fragmentEmissive, // (daynight) night: LED / back-lit faces dimmed against the x4.5 night exposure (readable + saturated, not blown to
          // white), marquee bulbs full, printed vinyl lit by its gooseneck lamps (brightest under the top rail)
          "if (K == 3 || K == 4) sgE *= uScreenK * (K == 4 ? mix(1.0, 1.7, uNightK) : 1.0 + (uScrBoost - 1.0) * uNightK); /* (lighting2 r5) exposure-compensated at every preset (night) LED x uScrBoost at night */\n", // (night r2) same highlight shoulder as the Times Square screens (screenlights.ts): LED / back-lit faces seen up close
          // clipped to flat white blobs at the night exposure (vp:street corners); whole colour scaled, hue kept
          // (night r2) chaser / marquee bulbs (K 6) were not exposure-compensated: x4.5 night exposure -> clipped white blobs at
          // the blade-sign edges (vp:street): ~0.3 at night, still the hottest dots on the facade, a little bloom
          "if (K == 6) sgE *= mix(1.0, 0.3, uNightK);\n"),
      );
  };
  mat.customProgramCacheKey = () => "city-signage-r5n2-" + (ghost ? "g" : "o"); // (night) r5n2
  return mat;
}

// ------------------------------------------------------------------------------------------------ build
export function buildSignage({ scene, gen }) {
  const stats = {
    roof: 0,
    wall: 0,
    ghost: 0,
    blade: 0,
    led: 0,
    tris: 0,
    meshes: 0,
    at: {
      roof: [],
      wall: [],
      ghost: [],
      blade: [],
      led: [],
      marquee: [],
      canopy: [],
      letters: [],
      flag: [],
      awning: [],
      win: [],
    },
  };
  if (typeof window !== "undefined") window.__signStats = stats; // (r4) debug: placement samples
  const note = (k, fr, u, y) => {
    const a = stats.at[k];
    if (a.length < 5000) {
      const p = at(fr, u, y, 0);
      a.push([
        Math.round(p[0]),
        Math.round(y),
        Math.round(p[2]),
        fr.N[0],
        fr.N[1],
      ]);
    }
  };
  if (OFF) return { update() {}, stats };
  const S = gen.solids,
    Z = gen.zips;
  const rnd = mulberry32(90210);
  const SLS = screenLightSet(); // (night) emitters -> cityLights (committed at the end)
  const SLB = screenLightSet(); // (night r9) lit blade signs (sign atlas colours)
  // (r3) critic: placeholder-looking cells out of city billboards (flat colour + tiny product, generic 'YOUR CITY' copy, TS tickers)
  const pickL = makePicker(64, rnd),
    pickP = makePicker(64, rnd),
    pickS = makePicker(64, rnd),
    pickG = makePicker(8, rnd); // (r3) atlas regenerated: no bans
  const cells = new Map();
  const cellOf = (x, z) => {
    const k = Math.floor(x / CELL) + "," + Math.floor(z / CELL);
    let c = cells.get(k);
    if (!c) {
      c = {
        op: new SB(),
        gh: new SB(),
        x0: Math.floor(x / CELL) * CELL,
        z0: Math.floor(z / CELL) * CELL,
      };
      cells.set(k, c);
    }
    return c;
  };

  // roof occupancy: every solid standing above 3 m (bulkheads, water towers, roof kits, TS screens ...)
  const OC = 16,
    occ = new Map();
  const occAdd = (x0, y0, z0, x1, y1, z1) => {
    for (let gx = Math.floor(x0 / OC); gx <= Math.floor(x1 / OC); gx++)
      for (let gz = Math.floor(z0 / OC); gz <= Math.floor(z1 / OC); gz++) {
        const k = gx * 100003 + gz;
        let a = occ.get(k);
        if (!a) occ.set(k, (a = []));
        a.push(x0, y0, z0, x1, y1, z1);
      }
  };
  for (let i = 0; i < S.t.length; i++) {
    const j = i * 6;
    if (S.b[j + 1] >= 3 || (S.b[j + 1] >= 1.8 && S.b[j + 4] > 2.4))
      occAdd(
        S.b[j],
        S.b[j + 1],
        S.b[j + 2],
        S.b[j + 3],
        S.b[j + 4],
        S.b[j + 5],
      );
  }
  const occHit = (b) => {
    // b = [x0, y0, z0, x1, y1, z1]
    for (let gx = Math.floor(b[0] / OC); gx <= Math.floor(b[3] / OC); gx++)
      for (let gz = Math.floor(b[2] / OC); gz <= Math.floor(b[5] / OC); gz++) {
        const a = occ.get(gx * 100003 + gz);
        if (!a) continue;
        for (let i = 0; i < a.length; i += 6)
          if (
            a[i + 4] > b[1] + 0.05 &&
            a[i + 1] < b[4] &&
            b[3] > a[i] &&
            b[0] < a[i + 3] &&
            b[5] > a[i + 2] &&
            b[2] < a[i + 5]
          )
            return true;
      }
    return false;
  };
  // building footprints (neighbour heights across party walls)
  const FC = 32,
    fps = new Map();
  gen.footprints.forEach((f, i) => {
    for (let gx = Math.floor(f.x0 / FC); gx <= Math.floor(f.x1 / FC); gx++)
      for (let gz = Math.floor(f.z0 / FC); gz <= Math.floor(f.z1 / FC); gz++) {
        const k = gx * 100003 + gz;
        let a = fps.get(k);
        if (!a) fps.set(k, (a = []));
        a.push(i);
      }
  });
  const neighbourH = (x0, z0, x1, z1, self) => {
    // max footprint height overlapping the thin probe rect
    let h = 0;
    const seen = new Set();
    for (let gx = Math.floor(x0 / FC); gx <= Math.floor(x1 / FC); gx++)
      for (let gz = Math.floor(z0 / FC); gz <= Math.floor(z1 / FC); gz++) {
        for (const i of fps.get(gx * 100003 + gz) ?? []) {
          if (seen.has(i)) continue;
          seen.add(i);
          const f = gen.footprints[i];
          if (f === self) continue;
          if (f.x1 > x0 && f.x0 < x1 && f.z1 > z0 && f.z0 < z1)
            h = Math.max(h, f.h);
        }
      }
    return h;
  };
  // what a face looks onto: probe the ground in front of it
  const faceView = (fr, u) => {
    let view = "block";
    for (const d of [3, 6, 10, 15]) {
      const p = at(fr, u, 0, d),
        t = streetsAt(p[0], p[2]);
      if (t.type === "avenue") return "avenue";
      if (t.type === "street" || t.type === "intersection") view = "street";
      else if (t.type === "water" || (t.type === "sidewalk" && t.fill)) {
        if (view === "block") view = "water";
      } else if (t.type === "park" && view === "block") view = "park";
    }
    return view;
  };
  // key squares (bow-ties): where Broadway (layout.DIAG_ROADS, when present) crosses an avenue -- Columbus-Circle-,
  // Herald-, Madison- and Union-Square-like spots; explicit SITES entries win; grid fallback hints otherwise
  const squares = [SITES.heraldSquare, SITES.unionSquare]
    .filter(Boolean)
    .map((s) => [(s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2]);
  for (const R of LAY.DIAG_ROADS ?? [])
    if (R?.kind === "broadway" && Array.isArray(R.pts))
      for (const [x, z] of R.pts)
        if (
          (LAY.avenues ?? []).some((a) => Math.abs(a - x) < 1) &&
          (LAY.onLand?.(x, z) ?? true)
        )
          squares.push([x, z]); // guarded: Broadway may be reworked / removed
  if (!squares.length) squares.push([0, 320], [430, 1040]);
  const TSR = SITES.timesSquare ?? { x0: 1e6, x1: 1e6, z0: 1e6, z1: 1e6 }; // (r2) guarded: layout may rename / drop sites
  const inTS = (l) =>
    l.x1 > TSR.x0 - 30 &&
    l.x0 < TSR.x1 + 30 &&
    l.z1 > TSR.z0 - 90 &&
    l.z0 < TSR.z1 + 10;
  const brick = (A) =>
    A.layer === LAYER.RED || A.layer === LAYER.BROWN || A.layer === LAYER.BUFF;
  const WALLC = {
    [LAYER.RED]: srgb(0x7a4a3c),
    [LAYER.BROWN]: srgb(0x5c4238),
    [LAYER.BUFF]: srgb(0x9c8468),
  };
  const STEEL = [0x3c3f40, 0x4a4d4c, 0x2e3133, 0x55524a, 0x3d4640].map(srgb);

  // (r2) non-rectangular lots / faces (layout's authored street map: polygon blocks and lots). Any building record that
  // carries a footprint polygon (bld.poly | lot.poly | ground mass .poly, [[x, z], ...]) gets flat lit shop signs on its
  // street-facing edges (face frames along arbitrary directions; flush within 2 cm of the wall, so no extra collision).
  const polyOf = (b) =>
    b.poly ??
    b.lot?.poly ??
    b.masses?.find((m) => m.y0 < 0.1 && m.poly)?.poly ??
    null;
  const densAt = (x, z) => {
    const d = district(x, z),
      ts = Math.exp(-Math.hypot(x, z + 160) / 420),
      sq = Math.max(
        0,
        ...squares.map(([a, c]) => Math.exp(-Math.hypot(x - a, z - c) / 220)),
      );
    return {
      d,
      dens: Math.min(
        1.6,
        0.3 +
          0.55 * (d.midtown ?? 0) +
          0.35 * (d.village ?? 0) +
          0.9 * ts +
          0.8 * sq -
          0.2 * (d.parkEdge ?? 0) -
          0.15 * (d.harlem ?? 0) -
          0.35 * (d.fidi ?? 0),
      ),
    };
  };
  const polySigns = (P, A, H, F = null) => {
    // F: per-edge face type from layout ('street' | 'party' | ...), when exported
    if (
      !Array.isArray(P) ||
      P.length < 3 ||
      !A ||
      A.type === "glass" ||
      !((A.gH ?? 0) > 3.6) ||
      !(H > (A.gH ?? 0) + 3)
    )
      return;
    let gx = 0,
      gz = 0;
    for (const q of P) {
      gx += q[0];
      gz += q[1];
    }
    gx /= P.length;
    gz /= P.length;
    const { d, dens } = densAt(gx, gz);
    if (d.id === "park") return;
    const r = mulberry32(
      (Math.floor(gx * 3.7) * 73856093) ^
        (Math.floor(gz * 2.9) * 19349663) ^
        0x9e11,
    );
    const C = cellOf(gx, gz),
      gH = A.gH,
      y0 = gH - 1.52,
      y1 = gH - 0.6,
      pBay = Math.min(0.92, 0.3 + 0.45 * dens);
    for (let i = 0; i < P.length; i++) {
      const p = P[i],
        q = P[(i + 1) % P.length],
        L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (L < 5 || (F && F[i] !== "street")) continue;
      const T = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
      let N = [T[1], -T[0]];
      if (
        N[0] * ((p[0] + q[0]) / 2 - gx) + N[1] * ((p[1] + q[1]) / 2 - gz) <
        0
      ) {
        N = [-N[0], -N[1]];
      }
      // keep O on the viewer's left: T x Y must equal N (right-handed face frame as in frame())
      const fr =
        Math.abs(-T[1] - N[0]) < 1e-6 && Math.abs(T[0] - N[1]) < 1e-6
          ? { O: p, T, N, W: L }
          : { O: q, T: [-T[0], -T[1]], N, W: L }; // T x Y = N
      const v = faceView(fr, L / 2);
      if (v !== "avenue" && v !== "street") continue;
      const nb2 = Math.max(1, Math.floor(L / 6.5 + 0.5)),
        bw2 = L / nb2;
      for (let k = 0; k < nb2; k++) {
        if (r() > pBay) continue;
        const u0 = k * bw2 + 0.4,
          u1 = (k + 1) * bw2 - 0.4,
          N3 = [N[0], 0, N[1]];
        const col = srgb(
          [0x1c1d1f, 0x2a2f38, 0x3a2420, 0x1f3326, 0x6a5a3a, 0x2c2c30][
            Math.floor(r() * 6)
          ],
        );
        C.op.quad(
          [
            at(fr, u0, y0, 0.012),
            at(fr, u1, y0, 0.012),
            at(fr, u1, y1, 0.012),
            at(fr, u0, y1, 0.012),
          ],
          N3,
          null,
          col,
          0,
          0,
        );
        const fw = Math.min(u1 - u0 - 0.16, (y1 - y0 - 0.12) * 4.6),
          fu = (u0 + u1 - fw) / 2;
        C.op.quad(
          [
            at(fr, fu, y0 + 0.06, 0.018),
            at(fr, fu + fw, y0 + 0.06, 0.018),
            at(fr, fu + fw, y1 - 0.06, 0.018),
            at(fr, fu, y1 - 0.06, 0.018),
          ],
          N3,
          signCell(Math.floor(r() * 64), fw / (y1 - y0 - 0.12)),
          [1, 1, 1],
          4,
          0.3 + 0.35 * Math.min(1, dens) * r(),
        );
        stats.front = (stats.front ?? 0) + 1;
      }
    }
  };
  for (const pb of gen.polyBuildings ?? [])
    polySigns(pb.poly, pb.A, pb.H, Array.isArray(pb.faces) ? pb.faces : null);

  // (r3) sloped fabric shop awning (critic: 'no awnings / colored canopies seen from above'): canvas slope, dark underside,
  //      valance (optional shop name printed on it), side cheeks; collision like buildings.ts awnings (thin ramp + valance)
  const AWN = [
    0x2f5a3a, 0x7a2a2a, 0x2a3d6a, 0x9a8458, 0x356a6a, 0x8a4a2a, 0x5a2a4a,
    0x303030, 0x6a6a2a,
  ].map(srgb);
  const awningSB = (B, fr, u0, u1, yTop, r, nameCell = -1) => {
    const out = 1.15 + r() * 0.35,
      drop = 0.55,
      val = nameCell >= 0 ? 0.4 : 0.3,
      col = AWN[Math.floor(r() * AWN.length)];
    const stripes = r() < 0.3 ? Math.round((u1 - u0) / 0.32) : 0,
      yb = yTop - drop,
      sl = Math.hypot(out, drop);
    const nT = [(fr.N[0] * drop) / sl, out / sl, (fr.N[1] * drop) / sl],
      P = (u, y, n) => at(fr, u, y, n);
    B.quad(
      [P(u0, yb, out), P(u1, yb, out), P(u1, yTop, 0.02), P(u0, yTop, 0.02)],
      nT,
      null,
      col,
      7,
      stripes,
    );
    B.quad(
      [
        P(u0, yTop - 0.03, 0.02),
        P(u1, yTop - 0.03, 0.02),
        P(u1, yb - 0.03, out - 0.02),
        P(u0, yb - 0.03, out - 0.02),
      ],
      nT.map((v) => -v),
      null,
      col.map((v) => v * 0.3),
      7,
      0,
    );
    boxF(
      B,
      fr,
      u0,
      u1,
      yb - val,
      yb,
      out - 0.02,
      out + 0.01,
      col,
      null,
      7,
      stripes,
      61,
      7,
    );
    for (const [u, sg] of [
      [u0, -1],
      [u1, 1],
    ]) {
      // side cheeks (triangles as degenerate quads, both windings)
      const a = P(u, yTop, 0.02),
        b = P(u, yb, out - 0.02),
        c = P(u, yb - val * 0.2, 0.25),
        T3 = [fr.T[0] * sg, 0, fr.T[1] * sg];
      B.quad(
        [a, c, b, b],
        T3,
        null,
        col.map((v) => v * 0.8),
        7,
        0,
      );
      B.quad(
        [a, b, c, c],
        T3.map((v) => -v),
        null,
        col.map((v) => v * 0.8),
        7,
        0,
      );
    }
    if (nameCell >= 0) {
      const nw = Math.min(u1 - u0 - 0.4, (val - 0.09) * 4.6),
        nu = (u0 + u1 - nw) / 2;
      B.quad(
        [
          P(nu, yb - val + 0.05, out + 0.014),
          P(nu + nw, yb - val + 0.05, out + 0.014),
          P(nu + nw, yb - 0.04, out + 0.014),
          P(nu, yb - 0.04, out + 0.014),
        ],
        [fr.N[0], 0, fr.N[1]],
        signCell(nameCell, nw / (val - 0.09)),
        [1, 1, 1],
        1,
        0,
      );
    }
    const bx = aabb(fr, u0, 0, 0, u1, 0, out),
      axis = fr.N[0] !== 0 ? 0 : 2,
      sign = fr.N[0] + fr.N[1];
    S.ramp(
      bx[0],
      yb - 0.03,
      bx[2],
      bx[3],
      bx[5],
      axis,
      sign > 0 ? yTop : yb,
      sign > 0 ? yb : yTop,
      "awning",
      OVERHANG,
      0.03,
    );
    S.box(
      ...aabb(fr, u0, yb - val, out - 0.02, u1, yb, out + 0.01),
      "awning",
      OVERHANG,
    );
    occAdd(...aabb(fr, u0, yb - val, 0, u1, yTop, out + 0.02));
    stats.awning = (stats.awning ?? 0) + 1;
    note("awning", fr, (u0 + u1) / 2, yTop);
  };

  const blds = [...gen.buildings].sort(
    (a, b) =>
      (a.lot?.cx ?? 0) - (b.lot?.cx ?? 0) ||
      (a.lot?.cz ?? 0) - (b.lot?.cz ?? 0),
  );
  for (const bld of blds) {
    const { lot, A, masses } = bld;
    if (lot && !lot.reserved && (polyOf(bld) || lot.angle || lot.rot)) {
      if (polyOf(bld)) polySigns(polyOf(bld), A, bld.H);
      continue;
    } // (r2) polygon lots
    if (!lot || !A || !masses?.length || lot.reserved) continue; // generic box lots only
    if (inTS(lot)) continue; // Times Square has its own screens
    const cx = lot.cx ?? (lot.x0 + lot.x1) / 2,
      cz = lot.cz ?? (lot.z0 + lot.z1) / 2;
    const d = district(cx, cz);
    if (d.id === "park") continue;
    const r = mulberry32(
      (Math.floor(cx * 3.7) * 73856093) ^
        (Math.floor(cz * 2.9) * 19349663) ^
        0x51a7,
    );
    const tsNear = Math.exp(-Math.hypot(cx - 0, cz + 160) / 420);
    const sqNear = Math.max(
      ...squares.map(([x, z]) => Math.exp(-Math.hypot(cx - x, cz - z) / 220)),
    );
    const dens = Math.min(
      1.6,
      0.3 +
        0.55 * d.midtown +
        0.35 * d.village +
        0.9 * tsNear +
        0.8 * sqNear -
        0.2 * d.parkEdge -
        0.15 * d.harlem -
        0.35 * d.fidi,
    );
    const m0 = masses.find((m) => m.y0 < 0.1 && !m.round && !m.crown);
    if (!m0) continue;
    const type = A.type,
      glassy = type === "glass";
    const sideType = (m, s) => {
      const onEdge =
        s === "nx"
          ? Math.abs(m.x0 - lot.x0) < 0.15
          : s === "px"
            ? Math.abs(m.x1 - lot.x1) < 0.15
            : s === "nz"
              ? Math.abs(m.z0 - lot.z0) < 0.15
              : Math.abs(m.z1 - lot.z1) < 0.15;
      if (!onEdge) return "inner";
      return m.sides?.[s] ?? lot.sides?.[s] ?? "street";
    };
    const above = (m, b) =>
      masses.some(
        (o) =>
          o !== m &&
          o.y1 > b[1] + 0.2 &&
          o.y0 < b[4] &&
          o.x0 < b[3] &&
          o.x1 > b[0] &&
          o.z0 < b[5] &&
          o.z1 > b[2],
      );
    const faces = ["nx", "px", "nz", "pz"].map((s) => ({
      s,
      t: sideType(m0, s),
      fr: frame(m0, s),
    }));
    for (const f of faces)
      if (f.t === "street") f.view = faceView(f.fr, f.fr.W / 2);

    // ---------------- 1. rooftop billboard
    const roofY = m0.y1,
      par = m0.parapet ?? 1;
    const topIsM0 = !masses.some(
      (o) =>
        o !== m0 &&
        o.y0 > m0.y1 - 0.5 &&
        o.y0 < m0.y1 + 0.5 &&
        o.x0 <= m0.x0 + 0.1 &&
        o.x1 >= m0.x1 - 0.1 &&
        o.z0 <= m0.z0 + 0.1 &&
        o.z1 >= m0.z1 - 0.1,
    );
    if (!glassy && roofY > 8 && roofY < 75 && topIsM0 && d.fidi < 0.55) {
      const cand = faces
        .filter((f) => f.t === "street" && f.fr.W > 9)
        .map((f) => ({
          ...f,
          w:
            f.view === "avenue"
              ? 0.42
              : f.view === "water"
                ? 0.4
                : f.view === "street"
                  ? 0.1
                  : 0,
        }))
        .filter((f) => f.w > 0)
        .sort((a, b) => b.w - a.w);
      const f = cand[0];
      if (f && r() < f.w * dens) {
        const fr = f.fr;
        const bh = f.view === "water" ? 4.6 + r() * 1.4 : 3.6 + r() * 1.6,
          bw = Math.min(fr.W - 1.2, bh * (2.05 + r() * 0.45));
        const u0 = Math.max(0.6, (fr.W - bw) * (0.15 + r() * 0.7)),
          u1 = u0 + bw;
        const nF = -0.7,
          nB = nF - 0.32,
          nPost = nB - 0.5,
          dep = 2.6;
        const legH = par + 1.6 + r() * 3.2;
        const yb = roofY + legH,
          yt = yb + bh;
        const fp = aabb(fr, u0 - 0.2, roofY, nF - dep, u1 + 0.2, yt + 0.8, 0.6);
        const fq = aabb(
          fr,
          u0 - 0.2,
          roofY + par + 0.35,
          nF - dep,
          u1 + 0.2,
          yt + 0.8,
          -0.05,
        ); // clear of parapet / coping / cornice
        if (bw > 6.5 && !occHit(fq) && !above(m0, fp)) {
          const C = cellOf(cx, cz),
            stc = STEEL[Math.floor(r() * STEEL.length)];
          const uv = adLand(pickL(cx, cz), bw / bh);
          boxF(C.op, fr, u0, u1, yb, yt, nB, nF, stc, uv, 1, 0); // panel (vinyl front, steel back)
          SLS.rect(
            at(fr, (u0 + u1) / 2, (yb + yt) / 2, nF + 0.03),
            [fr.N[0], 0, fr.N[1]],
            [fr.T[0], 0, fr.T[1]],
            bw,
            bh,
            null,
            1,
            { uv, printed: true },
          ); // (night r9) floodlit print lights the roof
          boxF(
            C.op,
            fr,
            u0 - 0.12,
            u1 + 0.12,
            yt,
            yt + 0.14,
            nB - 0.04,
            nF + 0.06,
            stc.map((v) => v * 0.7),
            null,
            0,
            0,
            62,
          ); // top rail
          boxF(
            C.op,
            fr,
            u0 - 0.12,
            u1 + 0.12,
            yb - 0.16,
            yb,
            nB - 0.04,
            nF + 0.06,
            stc.map((v) => v * 0.7),
            null,
            0,
            0,
            62,
          ); // bottom rail
          for (const ue of [u0 - 0.12, u1])
            boxF(
              C.op,
              fr,
              ue,
              ue + 0.12,
              yb - 0.16,
              yt + 0.14,
              nB - 0.04,
              nF + 0.06,
              stc.map((v) => v * 0.75),
              null,
              0,
              0,
              61,
            ); // side trims
          S.box(
            ...aabb(
              fr,
              u0 - 0.12,
              yb - 0.16,
              nB - 0.04,
              u1 + 0.12,
              yt + 0.14,
              nF + 0.06,
            ),
            "equipment",
          );
          // columns (I-beams) behind the panel down to the roof + raked rear posts
          const nc = Math.max(2, Math.ceil(bw / 3.6) + 1);
          const D = gen.tile(cx, cz).det;
          for (let i = 0; i < nc; i++) {
            const ua = u0 + 0.3 + (bw - 0.6 - 0.26) * (i / (nc - 1));
            boxF(
              C.op,
              fr,
              ua,
              ua + 0.26,
              roofY,
              yt,
              nB - 0.3,
              nB,
              stc,
              null,
              0,
              0,
              62,
            );
            S.box(...aabb(fr, ua, roofY, nB - 0.3, ua + 0.26, yt, nB), "pole");
            D.setPart(DP.STEEL).setColor(stc);
            detBox(
              D,
              fr,
              ua + 0.05,
              ua + 0.21,
              roofY,
              yb + bh * 0.5,
              nPost - dep + 0.9,
              nPost - dep + 1.1,
            ); // rear post
            detBox(
              D,
              fr,
              ua + 0.07,
              ua + 0.19,
              yb + bh * 0.5 - 0.14,
              yb + bh * 0.5,
              nPost - dep + 0.9,
              nB - 0.3,
            ); // kicker
            detBox(
              D,
              fr,
              ua + 0.07,
              ua + 0.19,
              roofY + 0.9,
              roofY + 1.02,
              nPost - dep + 0.9,
              nB - 0.3,
            ); // low tie
            S.box(
              ...aabb(
                fr,
                ua + 0.05,
                roofY,
                nPost - dep + 0.9,
                ua + 0.21,
                yb + bh * 0.5,
                nPost - dep + 1.1,
              ),
              "pole",
            );
          }
          // catwalk in front of the panel (grating), toe rail, handrail posts
          D.setPart(DP.GRATE).setColor(0x5a5c5a);
          detBox(D, fr, u0 - 0.1, u1 + 0.1, yb - 0.26, yb - 0.2, nF, nF + 0.95);
          D.setPart(DP.STEEL).setColor(stc);
          detBox(
            D,
            fr,
            u0 - 0.1,
            u1 + 0.1,
            yb - 0.34,
            yb - 0.26,
            nF + 0.85,
            nF + 0.95,
          );
          for (
            let q = u0;
            q <= u1 + 0.01;
            q += bw / Math.max(1, Math.round(bw / 2.4))
          )
            detBox(
              D,
              fr,
              q - 0.03,
              q + 0.03,
              yb - 0.34,
              yb + 0.72,
              nF + 0.88,
              nF + 0.94,
            );
          detBox(
            D,
            fr,
            u0 - 0.1,
            u1 + 0.1,
            yb + 0.68,
            yb + 0.74,
            nF + 0.88,
            nF + 0.94,
          );
          S.box(
            ...aabb(fr, u0 - 0.1, yb - 0.34, nF, u1 + 0.1, yb - 0.2, nF + 0.95),
            "awning",
            OVERHANG,
          );
          // gooseneck lamps over the top rail
          D.setPart(DP.PAINT).setColor(0x2a2c2c);
          for (let q = u0 + 1.0; q < u1 - 0.5; q += 3.2) {
            detBox(
              D,
              fr,
              q - 0.035,
              q + 0.035,
              yt + 0.14,
              yt + 0.62,
              nB + 0.1,
              nB + 0.17,
            );
            detBox(
              D,
              fr,
              q - 0.035,
              q + 0.035,
              yt + 0.55,
              yt + 0.62,
              nB + 0.1,
              nF + 0.95,
            );
            detBox(
              D,
              fr,
              q - 0.16,
              q + 0.16,
              yt + 0.44,
              yt + 0.6,
              nF + 0.75,
              nF + 1.08,
            );
          }
          Z.edge?.(
            ...(() => {
              const a = at(fr, u0, 0, (nB + nF) / 2),
                b = at(fr, u1, 0, (nB + nF) / 2);
              return [a[0], a[2], b[0], b[2]];
            })(),
            yt + 0.14,
            fr.N[0],
            fr.N[1],
            "roofEdge",
            5,
          );
          occAdd(...fp);
          stats.roof++;
          note("roof", fr, (u0 + u1) / 2, yb);
        }
      }
    }

    // ---------------- 2. wall ads / ghost signs on exposed party walls (and blank flanks over vacant lots)
    if (!glassy && type !== "deco" && bld.H < 110) {
      for (const f of faces) {
        if (f.t !== "party" || f.fr.W < 8) continue;
        const fr = f.fr;
        const pr = aabb(fr, 0.3, 0, 0.2, fr.W - 0.3, 1, 1.2);
        const hN = neighbourH(pr[0], pr[2], pr[3], pr[5], null);
        const yLo = Math.max(hN + 1.2, (A.gH ?? 4) + 1.5),
          yHi = m0.y1 - 1.2;
        if (yHi - yLo < 6.5) continue;
        const old =
          brick(A) &&
          (type === "walkup" ||
            type === "loft" ||
            type === "apt" ||
            type === "postwar");
        const pWall = 0.5 * dens + (old ? 0.12 : 0);
        if (r() > pWall) continue;
        const ghost = old && r() < 0.5;
        const aw = fr.W - 1.6,
          ah = yHi - yLo;
        const C = cellOf(cx, cz);
        if (ghost) {
          // stacked ghost lettering: 1-3 sign-atlas panels (4:1), faded, straight onto the brick
          const w = Math.min(aw, 16 + r() * 6),
            h = w / 4;
          const nRow = Math.max(1, Math.min(3, Math.floor(ah / (h * 1.1))));
          const u0 = (fr.W - w) / 2;
          let y = yHi - 0.6 - r() * Math.max(0, ah - nRow * h * 1.1) * 0.5;
          for (let k = 0; k < nRow && y - h > yLo; k++) {
            const uv =
              r() < 0.6
                ? ghostArt(pickG(cx + k * 50, cz), w / h)
                : signCell(
                    pickS(cx + k * 50, cz, (i) => !GHOST_OK.includes(i)),
                    w / h,
                  ); // (r3) generated vintage paint
            C.op.quad(
              [
                at(fr, u0, y - h, 0.045),
                at(fr, u0 + w, y - h, 0.045),
                at(fr, u0 + w, y, 0.045),
                at(fr, u0, y, 0.045),
              ],
              [fr.N[0], 0, fr.N[1]],
              uv,
              WALLC[A.layer] ?? [0.3, 0.25, 0.2],
              5,
              0.42 + r() * 0.2,
            ); // (r3) vertex colour = the brick (fade target)
            y -= h * 1.12;
          }
          stats.ghost++;
          note("ghost", fr, fr.W / 2, yHi);
        } else {
          // vinyl / painted mural: the biggest landscape or portrait crop that fits
          const portrait = ah > aw * 0.8;
          let w, h;
          if (portrait) {
            h = Math.min(ah, 34);
            w = Math.min(aw, h * 0.62);
            h = Math.min(h, w / 0.5);
          } else {
            w = Math.min(aw, 26);
            h = Math.min(ah, w / 1.7);
            w = Math.min(w, h * 2.3);
          }
          if (w < 6 || h < 5) continue;
          const u0 = (fr.W - w) * (0.3 + r() * 0.4),
            y1 = yHi - r() * (ah - h) * 0.4,
            y0 = y1 - h;
          const uv = portrait
            ? adPort(pickP(cx, cz), w / h)
            : adLand(pickL(cx, cz), w / h);
          const painted = brick(A) && r() < 0.55;
          if (painted)
            C.op.quad(
              [
                at(fr, u0, y0, 0.05),
                at(fr, u0 + w, y0, 0.05),
                at(fr, u0 + w, y1, 0.05),
                at(fr, u0, y1, 0.05),
              ],
              [fr.N[0], 0, fr.N[1]],
              uv,
              WALLC[A.layer] ?? [0.3, 0.25, 0.2],
              2,
              0,
            );
          else {
            // (r3) wallscape: vinyl stretched in a 32 cm deep steel frame (rails + stiles with side depth), bottom
            //      service catwalk on brackets with a handrail, gooseneck flood lamps aimed up at the print
            const stc = STEEL[Math.floor(r() * STEEL.length)],
              dk = stc.map((v) => v * 0.72),
              fd = 0.32,
              fb = 0.2;
            boxF(
              C.op,
              fr,
              u0,
              u0 + w,
              y0,
              y1,
              0.02,
              fd - 0.07,
              stc,
              uv,
              1,
              0,
              1,
            ); // print, recessed 7 cm
            SLS.rect(
              at(fr, u0 + w / 2, (y0 + y1) / 2, fd - 0.04),
              [fr.N[0], 0, fr.N[1]],
              [fr.T[0], 0, fr.T[1]],
              w,
              h,
              null,
              1,
              { uv, printed: true },
            ); // (night r9)
            boxF(
              C.op,
              fr,
              u0 - fb,
              u0 + w + fb,
              y1,
              y1 + fb,
              0.0,
              fd,
              dk,
              null,
              0,
              0,
              61,
            ); // top rail
            boxF(
              C.op,
              fr,
              u0 - fb,
              u0 + w + fb,
              y0 - fb,
              y0,
              0.0,
              fd,
              dk,
              null,
              0,
              0,
              61,
            ); // bottom rail
            boxF(C.op, fr, u0 - fb, u0, y0, y1, 0.0, fd, dk, null, 0, 0, 61); // stiles
            boxF(
              C.op,
              fr,
              u0 + w,
              u0 + w + fb,
              y0,
              y1,
              0.0,
              fd,
              dk,
              null,
              0,
              0,
              61,
            );
            S.box(
              ...aabb(fr, u0 - fb, y0 - fb, 0, u0 + w + fb, y1 + fb, fd),
              "wall",
            );
            const D = gen.tile(cx, cz).det,
              yc = y0 - fb - 0.28,
              cu0 = u0 - fb,
              cu1 = u0 + w + fb;
            D.setPart(DP.GRATE).setColor(0x55575a);
            detBox(D, fr, cu0, cu1, yc, yc + 0.06, 0.05, 1.0); // grating
            D.setPart(DP.STEEL).setColor(stc);
            detBox(D, fr, cu0, cu1, yc - 0.1, yc, 0.9, 1.0); // toe channel
            detBox(D, fr, cu0, cu1, yc + 1.0, yc + 1.06, 0.93, 0.99); // handrail
            const nb = Math.max(2, Math.round(w / 2.6) + 1);
            for (let q = 0; q < nb; q++) {
              const uq = cu0 + 0.1 + ((cu1 - cu0 - 0.2) * q) / (nb - 1);
              detBox(D, fr, uq - 0.03, uq + 0.03, yc, yc + 1.0, 0.93, 0.99); // rail post
              D.tube(
                at(fr, uq, yc - 1.1, 0.02),
                at(fr, uq, yc - 0.04, 0.95),
                0.04,
                4,
              ); // knee brace
            }
            D.setPart(DP.PAINT).setColor(0x2a2c2c);
            for (let q = u0 + 1.0; q < u0 + w - 0.4; q += 3.0) {
              D.tube(
                at(fr, q, yc + 1.03, 0.96),
                at(fr, q, yc + 1.55, 1.45),
                0.03,
                4,
              ); // gooseneck arm
              detBox(D, fr, q - 0.17, q + 0.17, yc + 1.5, yc + 1.68, 1.28, 1.6); // lamp head
            }
            S.box(
              ...aabb(fr, cu0, yc - 0.1, 0, cu1, yc + 0.06, 1.0),
              "awning",
              OVERHANG,
            );
          }
          stats.wall++;
          note("wall", fr, u0 + w / 2, y0);
        }
      }
    }

    // ---------------- 3. tall vertical blade signs (hotel / theatre / deli ...) over the shopfront
    if (
      !glassy &&
      (type === "loft" || type === "walkup" || type === "apt") &&
      (A.gH ?? 0) > 3.5
    ) {
      for (const f of faces) {
        if (
          f.t !== "street" ||
          f.fr.W < 9 ||
          (f.view !== "avenue" && f.view !== "street")
        )
          continue;
        if (r() > (f.view === "avenue" ? 0.2 : 0.11) * dens) continue;
        const fr = f.fr,
          w = 0.95 + r() * 0.75 * Math.min(1, dens),
          h = w * 4;
        const y0 = A.gH + 0.9,
          y1 = y0 + h;
        if (y1 > m0.y1 - 1.5) continue;
        const uc = r() < 0.5 ? 1.6 + r() * 1.2 : fr.W - 1.6 - r() * 1.2,
          n0 = 0.3,
          n1 = n0 + w;
        const C = cellOf(cx, cz);
        const cell = BLADE_OK[Math.floor(r() * BLADE_OK.length)];
        const stc = [
          srgb(0x1c1d1f),
          srgb(0x5a1d1a),
          srgb(0x1d2a4a),
          srgb(0x7a6a3a),
        ][Math.floor(r() * 4)];
        // sign box (plain edges), lit faces both sides (text reads bottom-to-top)
        boxF(
          C.op,
          fr,
          uc - 0.18,
          uc + 0.18,
          y0,
          y1,
          n0,
          n1,
          stc,
          null,
          0,
          0,
          61,
        );
        const uv = signCell(cell, h / w),
          gain = 0.45 + 0.4 * Math.min(1, dens);
        const L = (u, y, n) => at(fr, u, y, n);
        // +T side: bottom-to-top text: u of the texture runs up the sign (y), v runs across (n)
        const sideQuad = (u, sgn) => {
          // seen from the +/-T side: a/b bottom left/right, c/d top right/left (CCW)
          const nL = sgn > 0 ? n1 - 0.06 : n0 + 0.06,
            nR = sgn > 0 ? n0 + 0.06 : n1 - 0.06,
            ya = y0 + 0.08,
            yb2 = y1 - 0.08;
          const N3 = [fr.T[0] * sgn, 0, fr.T[1] * sgn],
            B = C.op,
            v = B.v;
          for (const q of [
            L(u, ya, nL),
            L(u, ya, nR),
            L(u, yb2, nR),
            L(u, yb2, nL),
          ]) {
            B.p.push(q[0], q[1], q[2]);
            B.n.push(...N3);
            B.c.push(1, 1, 1);
            B.s.push(4, gain);
          }
          // text rotated 90 deg CCW (reads bottom-to-top): texture u runs up the sign, letter tops (v1) on the viewer's left
          B.uv.push(uv[0], uv[3], uv[0], uv[1], uv[2], uv[1], uv[2], uv[3]);
          B.l.push(0, 0, 1, 0, 1, 1, 0, 1);
          B.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
          B.v += 4;
        };
        sideQuad(uc + 0.185, 1);
        sideQuad(uc - 0.185, -1);
        {
          const su = [uv[0] - 2, uv[1], uv[2] - 2, uv[3]]; // (night r9) both lit faces as lights (the sign cell's own colour)
          for (const sg of [1, -1])
            SLB.rect(
              at(fr, uc + sg * 0.2, (y0 + y1) / 2, (n0 + n1) / 2),
              [fr.T[0] * sg, 0, fr.T[1] * sg],
              [fr.N[0] * sg, 0, fr.N[1] * sg],
              w,
              h,
              null,
              1,
              { uv: su, whole: true, gain: 0.7, range: 10 },
            );
        }
        // (r3) chaser bulbs down the outer edge + a cap; forged arms with diagonal braces (critic: 'flat slabs, no brackets')
        const nBu = Math.max(4, Math.round((h - 0.2) / 0.17));
        C.op.quad(
          [
            L(uc - 0.13, y0 + 0.1, n1 + 0.006),
            L(uc + 0.13, y0 + 0.1, n1 + 0.006),
            L(uc + 0.13, y1 - 0.1, n1 + 0.006),
            L(uc - 0.13, y1 - 0.1, n1 + 0.006),
          ],
          [fr.N[0], 0, fr.N[1]],
          [0, 0, 2, nBu],
          stc,
          6,
          0.9 + 0.5 * Math.min(1, dens),
        );
        boxF(
          C.op,
          fr,
          uc - 0.24,
          uc + 0.24,
          y1,
          y1 + 0.12,
          n0 - 0.05,
          n1 + 0.08,
          stc.map((v) => v * 0.8),
          null,
          0,
          0,
          61,
        );
        const D = gen.tile(cx, cz).det;
        D.setPart(DP.STEEL).setColor(0x2a2b2c);
        for (const yy of [y0 + 0.35, y1 - 0.35]) {
          detBox(
            D,
            fr,
            uc - 0.04,
            uc + 0.04,
            yy - 0.06,
            yy + 0.06,
            0,
            n0 + 0.08,
          );
          detBox(D, fr, uc - 0.1, uc + 0.1, yy - 0.18, yy + 0.18, 0, 0.05); // wall plate
          D.tube(
            at(fr, uc, yy - 0.9, 0.03),
            at(fr, uc, yy - 0.04, n0 + 0.05),
            0.025,
            4,
          ); // brace
        }
        S.box(
          ...aabb(fr, uc - 0.19, y0, 0, uc + 0.19, y1, n1),
          "equipment",
          OVERHANG,
        );
        stats.blade++;
        note("blade", fr, uc, y0);
        break; // one per building
      }
    }

    const gH = A.gH ?? 0;
    // ---------------- 6. (r2) theatre / cinema / hotel marquees with bulb borders (theatre district: side streets around
    //      Times Square; rarer elsewhere). Deep canopy box over the entrance, sign faces on three sides (ts_signs, lit),
    //      chaser-bulb strips top + bottom, a bulb-grid soffit underneath.
    if (!glassy && gH > 4.2 && m0.y1 > 14) {
      const pM =
        0.5 * Math.min(1, tsNear * 1.6) + 0.04 * d.midtown + 0.03 * sqNear;
      const f = faces.find(
        (g) =>
          g.t === "street" &&
          (g.view === "street" || g.view === "avenue") &&
          g.fr.W > 12,
      );
      if (f && r() < pM) {
        const fr = f.fr,
          w = Math.min(fr.W - 4, 7 + r() * 5),
          dep = 2.6 + r() * 0.8,
          mh = 1.3 + r() * 0.5;
        const u0 = 1.5 + r() * (fr.W - w - 3),
          u1 = u0 + w,
          yb = Math.max(3.3, gH - 1.9),
          yt = yb + mh;
        const bx = aabb(
          fr,
          u0 - 0.1,
          yb - 0.1,
          0.6,
          u1 + 0.1,
          yt + 0.2,
          dep + 0.1,
        ); // (the storefront cornice projects < 0.6 m: the marquee butts into it)
        if (!occHit(bx)) {
          const C = cellOf(cx, cz),
            B = C.op;
          const THEATRE = [12, 42, 53, 21, 31, 15, 48, 12, 42];
          const cell =
            tsNear > 0.3
              ? THEATRE[Math.floor(r() * THEATRE.length)]
              : [15, 48, 12, 42][Math.floor(r() * 4)];
          const trim = srgb(
            [0x2a2420, 0x6a5020, 0x3a1818, 0x1a1c20][Math.floor(r() * 4)],
          );
          boxF(B, fr, u0, u1, yb, yt, 0.05, dep, trim, null, 0, 0, 29); // body (top, sides, front-plain; soffit below)
          const L3 = (u, y, n) => at(fr, u, y, n),
            N3 = [fr.N[0], 0, fr.N[1]],
            T3 = [fr.T[0], 0, fr.T[1]],
            Tn = T3.map((v) => -v);
          const sb0 = yb + 0.22,
            sb1 = yt - 0.22,
            sh = sb1 - sb0;
          // front sign face
          B.quad(
            [
              L3(u0 + 0.25, sb0, dep + 0.006),
              L3(u1 - 0.25, sb0, dep + 0.006),
              L3(u1 - 0.25, sb1, dep + 0.006),
              L3(u0 + 0.25, sb1, dep + 0.006),
            ],
            N3,
            signCell(cell, (w - 0.5) / sh),
            [1, 1, 1],
            4,
            0.9,
          );
          // side faces
          const sc = signCell(cell, 4); // (r3) whole cell, squeezed ~30% (a centre crop clipped the letters)
          B.quad(
            [
              L3(u1 + 0.006, sb0, dep - 0.25),
              L3(u1 + 0.006, sb0, 0.3),
              L3(u1 + 0.006, sb1, 0.3),
              L3(u1 + 0.006, sb1, dep - 0.25),
            ],
            T3,
            sc,
            [1, 1, 1],
            4,
            0.9,
          );
          B.quad(
            [
              L3(u0 - 0.006, sb0, 0.3),
              L3(u0 - 0.006, sb0, dep - 0.25),
              L3(u0 - 0.006, sb1, dep - 0.25),
              L3(u0 - 0.006, sb1, 0.3),
            ],
            Tn,
            sc,
            [1, 1, 1],
            4,
            0.9,
          );
          // bulb strips (kind 6: uv.x = bulb index, one row in v) along the front + sides, top and bottom
          const P = 0.16;
          for (const [ya, yb2] of [
            [yb + 0.04, sb0 - 0.04],
            [sb1 + 0.04, yt - 0.04],
          ]) {
            const nF = Math.round((w - 0.1) / P),
              nS = Math.round((dep - 0.1) / P);
            B.quad(
              [
                L3(u0 + 0.05, ya, dep + 0.008),
                L3(u1 - 0.05, ya, dep + 0.008),
                L3(u1 - 0.05, yb2, dep + 0.008),
                L3(u0 + 0.05, yb2, dep + 0.008),
              ],
              N3,
              [0, 0, nF, 1],
              trim,
              6,
              1.4,
            );
            B.quad(
              [
                L3(u1 + 0.008, ya, dep - 0.05),
                L3(u1 + 0.008, ya, 0.1),
                L3(u1 + 0.008, yb2, 0.1),
                L3(u1 + 0.008, yb2, dep - 0.05),
              ],
              T3,
              [0, 0, nS, 1],
              trim,
              6,
              1.4,
            );
            B.quad(
              [
                L3(u0 - 0.008, ya, 0.1),
                L3(u0 - 0.008, ya, dep - 0.05),
                L3(u0 - 0.008, yb2, dep - 0.05),
                L3(u0 - 0.008, yb2, 0.1),
              ],
              Tn,
              [0, 0, nS, 1],
              trim,
              6,
              1.4,
            );
          }
          // soffit: bulb grid facing down
          const gu = Math.round(w / 0.45),
            gn = Math.round(dep / 0.45);
          B.quad(
            [
              L3(u0, yb - 0.002, 0.05),
              L3(u1, yb - 0.002, 0.05),
              L3(u1, yb - 0.002, dep),
              L3(u0, yb - 0.002, dep),
            ],
            [0, -1, 0],
            [0, 0, gu, gn],
            trim,
            6,
            1.1,
          );
          // tie rods to the wall
          const D = gen.tile(cx, cz).det;
          D.setPart(DP.STEEL).setColor(0x232425);
          for (const uu of [u0 + 0.4, u1 - 0.4])
            (detBox(
              D,
              fr,
              uu - 0.03,
              uu + 0.03,
              yt + 0.02,
              yt + 0.08 + dep * 0.6,
              0,
              0.06,
            ),
              detBox(
                D,
                fr,
                uu - 0.02,
                uu + 0.02,
                yt,
                yt + 0.05,
                0.05,
                dep - 0.3,
              ));
          S.box(...aabb(fr, u0, yb, 0, u1, yt, dep), "awning", OVERHANG);
          occAdd(
            ...aabb(fr, u0 - 0.1, yb - 0.1, 0, u1 + 0.1, yt + 0.2, dep + 0.1),
          );
          SLS.point(
            at(fr, (u0 + u1) / 2, yb - 0.5, dep * 0.6),
            new THREE.Color(1.0, 0.72, 0.42),
            10 + 2.5 * w,
            12,
            0.4,
          ); // (night) bulb-lit sidewalk
          stats.marquee = (stats.marquee ?? 0) + 1;
          note("marquee", fr, (u0 + u1) / 2, yb);
        }
      }
    }

    // ---------------- 7. (r3) entrances (critic: 'no tenant signage, no flags, no doorman canopies'): brass building-name
    //      letters over the lobby, flag pairs on office / deco / glass avenue fronts, doorman canopies on apartment houses
    if (gH > 3.4 && m0.y1 > 14) {
      const good = (f) =>
        f.t === "street" &&
        (f.view === "avenue" || f.view === "street" || f.view === "park") &&
        f.fr.W > 14;
      const fe = faces
        .filter(good)
        .sort((a, b) => (b.view !== "street") - (a.view !== "street"))[0];
      if (fe) {
        const fr = fe.fr,
          uc = fr.W * (0.4 + r() * 0.2),
          C = cellOf(cx, cz),
          D = gen.tile(cx, cz).det;
        const office = glassy || type === "deco" || type === "postwar",
          resid = type === "apt" || type === "postwar";
        // doorman canopy: fabric box from the door to the curb, brass posts, name letters on its end
        let canopy = false;
        if (
          resid &&
          r() < 0.6 &&
          ["sidewalk"].includes(
            streetsAt(...((p) => [p[0], p[2]])(at(fr, uc, 0, 3.9))).type,
          )
        ) {
          const cw = 2.3,
            out = 3.5,
            yb = 2.95,
            yt = 3.3;
          if (
            !occHit(
              aabb(
                fr,
                uc - cw / 2 - 0.1,
                2.5,
                0.1,
                uc + cw / 2 + 0.1,
                yt + 0.3,
                out + 0.1,
              ),
            )
          ) {
            const col = srgb(
              [0x1f3d2b, 0x5a1a1f, 0x1a2540, 0x2a2a2a, 0x3b2e22][
                Math.floor(r() * 5)
              ],
            );
            boxF(
              C.op,
              fr,
              uc - cw / 2,
              uc + cw / 2,
              yb,
              yt,
              0.02,
              out,
              col,
              null,
              7,
              0,
              61,
              7,
            );
            const nw = Math.min(cw - 0.3, 0.26 * 4.6);
            C.op.quad(
              [
                at(fr, uc - nw / 2, yb + 0.04, out + 0.012),
                at(fr, uc + nw / 2, yb + 0.04, out + 0.012),
                at(fr, uc + nw / 2, yb + 0.3, out + 0.012),
                at(fr, uc - nw / 2, yb + 0.3, out + 0.012),
              ],
              [fr.N[0], 0, fr.N[1]],
              signCell(
                [15, 48, 10, 36, 35, 60, 63][Math.floor(r() * 7)],
                nw / 0.26,
              ),
              srgb(0xc9a860),
              8,
              0,
            );
            D.setPart(DP.GALV).setColor(0xb89a5a);
            for (const su of [-1, 1]) {
              D.tube(
                at(fr, uc + su * (cw / 2 - 0.12), 0, out - 0.15),
                at(fr, uc + su * (cw / 2 - 0.12), yb, out - 0.15),
                0.035,
                6,
              );
              S.box(
                ...aabb(
                  fr,
                  uc + su * (cw / 2 - 0.12) - 0.04,
                  0,
                  out - 0.19,
                  uc + su * (cw / 2 - 0.12) + 0.04,
                  yb,
                  out - 0.11,
                ),
                "pole",
              );
            }
            S.box(
              ...aabb(fr, uc - cw / 2, yb, 0, uc + cw / 2, yt, out),
              "awning",
              OVERHANG,
            );
            occAdd(...aabb(fr, uc - cw / 2, 0, 0, uc + cw / 2, yt, out));
            canopy = true;
            stats.canopy = (stats.canopy ?? 0) + 1;
            note("canopy", fr, uc, yb);
          }
        }
        // building name in cut brass / steel letters over the lobby
        if (!canopy && (office || resid) && r() < 0.55 + 0.3 * d.fidi) {
          const lh = 0.36 + r() * 0.16,
            lw = Math.min(fr.W - 2, lh * 4.3),
            ly1 = gH - 0.45,
            ly0 = ly1 - lh;
          if (
            ly0 > 2.4 &&
            !occHit(aabb(fr, uc - lw / 2, ly0, 0, uc + lw / 2, ly1, 0.3))
          ) {
            C.op.quad(
              [
                at(fr, uc - lw / 2, ly0, 0.035),
                at(fr, uc + lw / 2, ly0, 0.035),
                at(fr, uc + lw / 2, ly1, 0.035),
                at(fr, uc - lw / 2, ly1, 0.035),
              ],
              [fr.N[0], 0, fr.N[1]],
              signCell(
                [10, 36, 35, 15, 48, 60, 63, 41][Math.floor(r() * 8)],
                lw / lh,
              ),
              srgb(r() < 0.6 ? 0xc9a860 : 0xc8c8c4),
              8,
              0,
            );
            occAdd(...aabb(fr, uc - lw / 2, ly0, 0, uc + lw / 2, ly1, 0.1));
            stats.letters = (stats.letters ?? 0) + 1;
            note("letters", fr, uc, ly0);
          }
        }
        // flag pair (instanced cloth in flags.ts; pole tubes into the detail tile)
        if (
          office &&
          fe.view !== "street" &&
          r() < 0.3 + 0.35 * Math.min(1, dens)
        ) {
          const fy = gH + 1.5;
          for (const du of [-2.4, 2.4]) {
            const u = uc + du;
            if (u < 1 || u > fr.W - 1) continue;
            if (occHit(aabb(fr, u - 0.4, fy - 1.4, 0, u + 0.4, fy + 1.9, 2.7)))
              continue;
            const base = at(fr, u, fy, 0),
              top = at(fr, u, fy + 1.8, 2.6);
            D.setPart(DP.GALV).setColor(0xc9b27a);
            D.tube(base, top, 0.035, 6);
            (gen.buildings.flags ??= []).push({
              top: new THREE.Vector3(...top),
              base: new THREE.Vector3(...base),
              N: [fr.N[0], 0, fr.N[1]],
              T: [fr.T[0], 0, fr.T[1]],
              color: Math.floor(r() * 4),
            });
            Z.add?.(top[0], top[1] + 0.035, top[2], 0, 1, 0, "pole");
            occAdd(...aabb(fr, u - 0.3, fy - 1.4, 0, u + 0.3, fy + 1.9, 2.7));
            stats.flag = (stats.flag ?? 0) + 1;
            note("flag", fr, u, fy);
          }
        }
      }
    }

    // ---------------- 5. (r2) raised, lit storefront sign boxes over the shopfront bays (critic r1: 'ground floors read as
    //      blank walls; add continuous retail sign bands'). Same bay split as the facade shader's storefront zone
    //      (nb2 = round(W / 6.5)), covering its flat painted band; awnings / blade signs already there win (occupancy).
    if (!glassy && gH > 3.6 && type !== "deco" && m0.y1 > gH + 3) {
      const pBay = Math.min(0.92, 0.3 + 0.45 * dens);
      for (const f of faces) {
        if (
          f.t !== "street" ||
          (f.view !== "avenue" && f.view !== "street") ||
          f.fr.W < 5
        )
          continue;
        const fr = f.fr,
          nb2 = Math.max(1, Math.floor(fr.W / 6.5 + 0.5)),
          bw2 = fr.W / nb2;
        const y1 = gH - 0.6,
          y0 = y1 - (0.72 + r() * 0.36); // (r3) fascia height varies per shopfront
        const C = cellOf(cx, cz);
        let run = r() < 0.35; // a shop spanning several bays gets one continuous fascia
        const runCell = Math.floor(r() * 64),
          runCol = srgb(
            [0x1c1d1f, 0x2a2f38, 0x3a2420, 0x1f3326, 0x6a5a3a, 0x2c2c30][
              Math.floor(r() * 6)
            ],
          );
        for (let i = 0; i < nb2; i++) {
          const u0 = i * bw2 + 0.38,
            u1 = (i + 1) * bw2 - 0.38;
          if (!run && r() > pBay) {
            // (r3) no fascia: a fabric awning with the shop name on its valance, where the bay is free
            const yT = Math.min(gH - 0.6, Math.max(gH - 1.5, 3.6));
            if (
              yT - 0.95 >= 2.63 &&
              r() < 0.5 * Math.min(1, dens) + 0.12 &&
              !occHit(aabb(fr, u0, 2.4, 0.1, u1, yT + 0.1, 1.8))
            )
              awningSB(C.op, fr, u0, u1, yT, r, Math.floor(r() * 64));
            continue;
          }
          const n1 = 0.16 + r() * 0.1;
          if (
            occHit(aabb(fr, u0, y0, 0.0, u1, y1, n1 + 0.05)) ||
            occHit(aabb(fr, u0, 3.0, 0.2, u1, y1, 1.6))
          ) {
            run = false;
            continue;
          }
          const col = run
            ? runCol
            : srgb(
                [
                  0x1c1d1f, 0x2a2f38, 0x3a2420, 0x1f3326, 0x6a5a3a, 0x2c2c30,
                  0x4a1e1e, 0x20304a,
                ][Math.floor(r() * 8)],
              );
          boxF(C.op, fr, u0, u1, y0, y1, 0.02, n1, col, null, 0, 0, 61); // fascia box (no back face)
          const fw = Math.min(u1 - u0 - 0.16, (y1 - y0 - 0.12) * 4.6),
            fu = (u0 + u1 - fw) / 2;
          const cell = run ? runCell : Math.floor(r() * 64);
          const uv =
              !run && r() < 0.22
                ? shopArt(Math.floor(r() * 8), fw / (y1 - y0 - 0.12))
                : signCell(cell, fw / (y1 - y0 - 0.12)),
            gain = 0.3 + 0.35 * Math.min(1, dens) * r(); // (r3) + generated boards
          C.op.quad(
            [
              at(fr, fu, y0 + 0.06, n1 + 0.004),
              at(fr, fu + fw, y0 + 0.06, n1 + 0.004),
              at(fr, fu + fw, y1 - 0.06, n1 + 0.004),
              at(fr, fu, y1 - 0.06, n1 + 0.004),
            ],
            [fr.N[0], 0, fr.N[1]],
            uv,
            [1, 1, 1],
            4,
            gain,
          );
          S.box(...aabb(fr, u0, y0, 0, u1, y1, n1), "equipment", OVERHANG);
          occAdd(...aabb(fr, u0, y0, 0, u1, y1, n1));
          stats.front = (stats.front ?? 0) + 1;
          if (
            y0 - 0.06 - 0.85 >= 2.63 &&
            r() < 0.35 * Math.min(1, dens) + 0.08 &&
            !occHit(aabb(fr, u0, 2.4, 0.1, u1, y0 - 0.1, 1.8))
          )
            awningSB(C.op, fr, u0, u1, y0 - 0.06, r); // (r3) awning under the sign
        }
      }
    }

    // ---------------- 5b. (r4) second-floor window lettering (critic r3: 'few second-floor window signs'): gold-leaf or white
    //      vinyl names on 1-3 adjacent windows of the floor above the shops (LAW OFFICES, DENTIST, TAX SERVICE, ...). Same
    //      bay / floor maths as the facade shader (margin, bayW, winW, winH; rusticated-base floors get taller windows).
    if (!glassy && type !== "deco" && gH > 3.4) {
      const FP = m0.p ?? A,
        fh = FP.floorH ?? 3.3,
        mg = FP.margin ?? 0.6;
      const zNf = Math.floor((m0.y1 + (m0.parapet ?? 0) - gH) / fh + 0.01);
      if ((FP.style ?? 0) < 1.5 && m0.y1 > gH + fh + 1) {
        const pW = Math.min(0.75, 0.2 + 0.45 * Math.min(1, dens));
        for (const f of faces) {
          if (
            f.t !== "street" ||
            (f.view !== "avenue" && f.view !== "street") ||
            r() > pW
          )
            continue;
          const fr = f.fr,
            usable = fr.W - 2 * mg;
          if (usable < 2.5) continue;
          const nb = Math.max(1, Math.floor(usable / (FP.bayW ?? 2.4) + 0.5)),
            bw = usable / nb;
          if (zNf < 5 && bw > 2.15) continue; // the shader may pair the sashes here (lettering would land on the mullion)
          const ww = bw * (FP.winW ?? 0.5);
          let wh = fh * (FP.winH ?? 0.55),
            wy0 = (fh - wh) * 0.42;
          if (zNf >= 5) {
            wh = Math.min(fh - 0.5, wh * 1.14);
            wy0 = (fh - wh) * 0.5;
          }
          const lw = Math.min(ww * 0.96, 1.7),
            lh = lw / 4,
            yc = gH + wy0 + wh * (0.42 + r() * 0.2);
          if (lw < 0.5 || lh > wh * 0.5) continue;
          const cell = Math.floor(r() * 16),
            nw = Math.min(nb, 1 + Math.floor(r() * 3)),
            b0 = Math.floor(r() * (nb - nw + 1));
          const C = cellOf(cx, cz);
          for (let i = 0; i < nw; i++) {
            const u = mg + (b0 + i + 0.5) * bw;
            if (
              occHit(
                aabb(
                  fr,
                  u - lw / 2,
                  yc - lh / 2,
                  0,
                  u + lw / 2,
                  yc + lh / 2,
                  0.06,
                ),
              )
            )
              continue;
            C.op.quad(
              [
                at(fr, u - lw / 2, yc - lh / 2, 0.014),
                at(fr, u + lw / 2, yc - lh / 2, 0.014),
                at(fr, u + lw / 2, yc + lh / 2, 0.014),
                at(fr, u - lw / 2, yc + lh / 2, 0.014),
              ],
              [fr.N[0], 0, fr.N[1]],
              winArt(cell, lw / lh),
              [1, 1, 1],
              9,
              0,
            );
            stats.winLetters = (stats.winLetters ?? 0) + 1;
            note("win", fr, u, yc);
          }
        }
      }
    }

    // ---------------- 4. LED screens at hot corners (square hints, Midtown corners, FiDi corporate tickers)
    const corner =
      faces.filter(
        (f) => f.t === "street" && (f.view === "avenue" || f.view === "street"),
      ).length >= 2;
    const pLed =
      0.55 * sqNear * sqNear +
      0.02 * d.midtown +
      0.04 * tsNear +
      0.025 * d.fidi;
    if (corner && roofY > 18 && r() < pLed) {
      const fs = faces
        .filter(
          (f) =>
            f.t === "street" &&
            (f.view === "avenue" || f.view === "street") &&
            f.fr.W > 12,
        )
        .sort((a, b) => (b.view === "avenue") - (a.view === "avenue"))
        .slice(0, sqNear > 0.45 ? 2 : 1);
      for (const f of fs) {
        const fr = f.fr,
          w = Math.min(fr.W * 0.45, 9 + r() * 7),
          h = Math.min(roofY - (A.gH ?? 5) - 3, w * (0.45 + r() * 0.35));
        if (h < 4) continue;
        // hug the corner: which end of the face is the corner? the end whose neighbour side is also a street
        const i = ["nx", "px", "nz", "pz"].indexOf(f.s);
        const other = faces.filter(
          (g) =>
            g.t === "street" &&
            g !== f &&
            ["nx", "px", "nz", "pz"].indexOf(g.s) >> 1 !== i >> 1,
        )[0];
        let atEnd = r() < 0.5;
        if (other) {
          const e = at(fr, fr.W, 0, 0),
            oc = other.fr;
          atEnd = Math.abs(oc.N[0] ? e[0] - oc.O[0] : e[2] - oc.O[1]) < 0.5;
        }
        const u0 = atEnd ? fr.W - w - 0.4 : 0.4,
          y0 = (A.gH ?? 5) + 1.2,
          y1 = y0 + h;
        const C = cellOf(cx, cz);
        const land = w / h > 1.1;
        const ai = land ? pickL(cx, cz) : pickP(cx, cz),
          uv = land ? adLand(ai, w / h) : adPort(ai, w / h);
        const averageColor =
          (land ? landscapeAdAverageLinearRgb : portraitAdAverageLinearRgb)[
            ai
          ] ?? [0.15, 0.15, 0.15];
        const luminance =
          0.2126 * averageColor[0] +
          0.7152 * averageColor[1] +
          0.0722 * averageColor[2];
        const nits =
          1.35 *
          Math.min(
            1.4,
            Math.max(0.5, Math.pow(0.15 / (luminance + 0.02), 0.5)),
          );
        boxF(
          C.op,
          fr,
          u0 - 0.18,
          u0 + w + 0.18,
          y0 - 0.18,
          y1 + 0.18,
          0.02,
          0.42,
          srgb(0x1a1b1d),
          null,
          0,
          0,
          62,
        );
        boxF(
          C.op,
          fr,
          u0,
          u0 + w,
          y0,
          y1,
          0.42,
          0.45,
          srgb(0x1a1b1d),
          uv,
          3,
          nits,
          1,
        );
        S.box(
          ...aabb(fr, u0 - 0.18, y0 - 0.18, 0, u0 + w + 0.18, y1 + 0.18, 0.45),
          "equipment",
          OVERHANG,
        );
        SLS.rect(
          at(fr, u0 + w / 2, (y0 + y1) / 2, 0.4),
          [fr.N[0], 0, fr.N[1]],
          [fr.T[0], 0, fr.T[1]],
          w,
          h,
          averageColor,
          1,
          { uv, gain: 1.8 },
        ); // (night) (r9: per-region colours; x1.8: a lone city screen in a dark street is the dominant local light)
        stats.led++;
        note("led", fr, u0 + w / 2, y0);
      }
    }
  }

  // ---------------------------------------------------------------- (r2) rooftops.ts 'sign' archetype frames: real ad faces
  for (const P of gen.roofSignPanels ?? []) {
    const m = P.alx
      ? { x0: P.a0, x1: P.a1, z0: P.plane, z1: P.plane }
      : { x0: P.plane, x1: P.plane, z0: P.a0, z1: P.a1 };
    const fr = frame(m, P.k),
      w = P.a1 - P.a0,
      h = P.y1 - P.y0,
      c = at(fr, w / 2, 0, 0);
    const C = cellOf(c[0], c[2]);
    const uv = adLand(pickL(c[0], c[2]), w / h);
    C.op.quad(
      [
        at(fr, 0, P.y0, 0),
        at(fr, w, P.y0, 0),
        at(fr, w, P.y1, 0),
        at(fr, 0, P.y1, 0),
      ],
      [fr.N[0], 0, fr.N[1]],
      uv,
      [1, 1, 1],
      1,
      0,
    );
    SLS.rect(
      at(fr, w / 2, (P.y0 + P.y1) / 2, 0.03),
      [fr.N[0], 0, fr.N[1]],
      [fr.T[0], 0, fr.T[1]],
      w,
      h,
      null,
      1,
      { uv, printed: true },
    ); // (night r9)
    stats.roofPanel = (stats.roofPanel ?? 0) + 1;
  }

  // ---------------------------------------------------------------- meshes (one opaque mesh per 512 m cell; ghost signs are dithered into it)
  const T = gen.textures ?? null;
  void T;
  const adsTex = getAdvertisingAtlasTexture(),
    signTex = getSignAtlasTexture(); // (night r5) shared sign atlas copy
  const noise = (() => {
    // small tiling value-noise texture (linear) for weathering
    const N = 128,
      dd = new Uint8Array(N * N * 4),
      rr = mulberry32(7),
      g = Array.from({ length: 16 * 16 * 3 }, () => rr());
    const sm = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        for (let c = 0; c < 3; c++) {
          let v = 0,
            amp = 0.5,
            f = 1;
          for (let o = 0; o < 3; o++) {
            const S2 = 4 * f,
              fx = (x / N) * S2,
              fy = (y / N) * S2,
              ix = Math.floor(fx),
              iy = Math.floor(fy),
              tx = sm(fx - ix),
              ty = sm(fy - iy);
            const G2 = (a, b) =>
              g[
                (((((a % S2) + S2) % S2) * 16 + (((b % S2) + S2) % S2)) % 256) *
                  3 +
                  c
              ];
            v +=
              amp *
              ((G2(ix, iy) * (1 - tx) + G2(ix + 1, iy) * tx) * (1 - ty) +
                (G2(ix, iy + 1) * (1 - tx) + G2(ix + 1, iy + 1) * tx) * ty);
            amp *= 0.5;
            f *= 2;
          }
          dd[(y * N + x) * 4 + c] = Math.round(255 * Math.min(1, v / 0.875));
          dd[(y * N + x) * 4 + 3] = 255;
        }
    const t = new THREE.DataTexture(dd, N, N);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  })();
  const artTex = loadTex(TEX + "city_signart.webp"); // (r3)
  const opMat = signMaterial(adsTex, signTex, noise, false, artTex),
    ghMat = null; // (ghost signs now dithered inside the opaque mesh)
  const list = [];
  for (const c of cells.values()) {
    const go = c.op.build(),
      gg = c.gh.build();
    const e = { x0: c.x0, z0: c.z0, op: null, gh: null };
    if (go) {
      const m = new THREE.Mesh(go, opMat);
      m.name = "signage";
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.smallCasters = true;
      m.userData.maxCascade = 2;
      scene.add(m);
      e.op = m;
      stats.tris += go.index.count / 3;
    }
    if (gg) {
      const m = new THREE.Mesh(gg, ghMat);
      m.name = "signageGhost";
      m.castShadow = false;
      m.receiveShadow = true;
      m.renderOrder = 1;
      scene.add(m);
      e.gh = m;
      stats.tris += gg.index.count / 3;
    }
    if (e.op || e.gh) list.push(e);
  }
  stats.meshes = list.reduce((a, e) => a + !!e.op + !!e.gh, 0);
  stats.lights = SLS.commit("signage"); // (night)
  stats.bladeLights = SLB.commit("signBlades", {
    grid: getSignColorGrid(),
    mergeA: 0,
  }); // (night r9)
  console.log(
    `[signage] ${stats.roof} rooftop billboards (+${stats.roofPanel ?? 0} roof-kit ad faces), ${stats.front ?? 0} shop fascias, ${stats.marquee ?? 0} marquees, ${stats.wall} wall ads, ${stats.ghost} ghost signs, ${stats.blade} blade signs, ${stats.led} LED screens, ${stats.awning ?? 0} awnings, ${stats.canopy ?? 0} canopies, ${stats.letters ?? 0} lobby letters, ${stats.winLetters ?? 0} window letterings, ${stats.flag ?? 0} flags | ${list.length} cells, ${stats.meshes} meshes, ${(stats.tris / 1000).toFixed(1)}k tris`,
  );
  if (Q.has("signdbg")) {
    const [qx, qz, qr] = (Q.get("signdbg") || "0,0,900").split(",").map(Number);
    for (const k in stats.at)
      console.log(
        "[signage-at] " +
          k +
          " " +
          JSON.stringify(
            stats.at[k]
              .filter((p) => Math.hypot(p[0] - qx, p[2] - qz) < qr)
              .slice(0, 40),
          ),
      );
  }
  if (typeof window !== "undefined") window.__signage = stats; // debug: positions for shots
  return {
    stats,
    update(cp) {
      // nearest-point cell distance: opaque ads to 850 m (cell edge; ~1.2 km to its far side), ghost paint dithers out 420-520 m, shadows < 120 m
      for (const e of list) {
        const dx = Math.max(0, e.x0 - cp.x, cp.x - (e.x0 + CELL)),
          dz = Math.max(0, e.z0 - cp.z, cp.z - (e.z0 + CELL)),
          dd = Math.hypot(dx, dz);
        if (e.op) {
          e.op.visible = dd < 850;
          e.op.castShadow = dd < 120;
        }
        if (e.gh) e.gh.visible = dd < 520;
      }
    },
  };
}
