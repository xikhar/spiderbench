// @ts-nocheck
// OWNER: foundation agent (city remake). The far shores across the rivers: New-Jersey-like west bank (Hoboken /
// Jersey City), Bronx / Queens / Brooklyn-like east bank, Roosevelt-like and Governors-like islets, a Staten-Island-like
// strip far south.
//
// Low-cost but believable: every far land is laid out as a real street grid of perimeter blocks (row houses around
// back yards, walk-up mid-rises, waterfront industry with sheds, housing projects, parks, tower clusters for Jersey
// City / Long Island City / Downtown Brooklyn) plus piers with sheds along the waterfronts.
//   - near band (< NEAR m from the Manhattan shore): facade-shader boxes (procedural windows), exact collision boxes
//   - far band: one massed box per block (cheap vertex-colour material with a procedural floor/bay pattern)
//   - the land slabs carry a baked ground map (streets, sidewalks, yards, parks, parking) so the fabric reads between
//     buildings and beyond the modelled band all the way to the horizon.
// terrain: farShoreHeight(x,z) -> FAR_Y | null (water). Piers are collision boxes (kind 'pier').
import __shaderPatch1 from "./shaders/glsl/farshore-patch-1.glsl?raw";
import __shaderPatch10 from "./shaders/glsl/farshore-patch-10.glsl?raw";
import __shaderPatch11 from "./shaders/glsl/farshore-patch-11.glsl?raw";
import __shaderPatch12 from "./shaders/glsl/farshore-patch-12.glsl?raw";
import __shaderPatch13 from "./shaders/glsl/farshore-patch-13.glsl?raw";
import __shaderPatch14 from "./shaders/glsl/farshore-patch-14.glsl?raw";
import __shaderPatch2 from "./shaders/glsl/farshore-patch-2.glsl?raw";
import __shaderPatch3 from "./shaders/glsl/farshore-patch-3.glsl?raw";
import __shaderPatch4 from "./shaders/glsl/farshore-patch-4.glsl?raw";
import __shaderPatch5 from "./shaders/glsl/farshore-patch-5.glsl?raw";
import __shaderPatch6 from "./shaders/glsl/farshore-patch-6.glsl?raw";
import __shaderPatch7 from "./shaders/glsl/farshore-patch-7.glsl?raw";
import __shaderPatch8 from "./shaders/glsl/farshore-patch-8.glsl?raw";
import __shaderPatch9 from "./shaders/glsl/farshore-patch-9.glsl?raw";
import { injectShader } from "../render/shader.ts";
import { nightK } from "../render/daynight.ts"; // (daynight)
import * as THREE from "three";
import { mulberry32, hash2, pointInPoly, onLand, shoreX, G } from "./layout.ts";
import { FacadeBuilder, STYLE, LAYER, deriveFacadeMaterial } from "./facade.ts";
import { bridgeSpans } from "./bridges.ts";
import { REFL_LAYER } from "./water.ts";
import { CanopyBatch } from "./canopy.ts";
import { farCoastOwns, COAST } from "./waterfront.ts"; // (coast r1) near banks rebuilt by waterfront.js

export const FAR_Y = 1.2;
// polygons [[x, z], ...]
export const FAR_LANDS = [
  // (the outer vertices run out toward the 150 km far plane; the hinterland (horizon.js) fills the first 20 km)
  {
    name: "nj",
    pts: [
      [-140000, -140000],
      [-1520, -140000],
      [-1500, -12000],
      [-1480, -5000],
      [-1510, -3500],
      [-1610, -2000],
      [-1690, -600],
      [-1735, 600],
      [-1760, 1600],
      // (round 10) Liberty-State-Park / Bayonne-like peninsula: the NJ shore now runs south along the Upper Bay to a Kill-van-Kull
      // channel opposite Staten Island, so the harbour view south has a land terminator on the right (critic: 'endless ocean')
      [-1860, 2400],
      [-1935, 3000],
      [-2010, 3480],
      [-2130, 4080],
      [-2230, 4800],
      [-2330, 5550],
      [-2480, 6250],
      [-2700, 6800],
      [-3300, 6980],
      [-4300, 6960],
      [-9600, 6960],
      [-10400, 12000],
      [-13000, 17000],
      [-140000, 60000],
    ],
  },
  {
    name: "east",
    pts: [
      [-950, -140000],
      [140000, -140000],
      [140000, 20000],
      [40000, 14500],
      [21000, 13800],
      [12000, 12900],
      [6800, 12600],
      [4200, 11800],
      [3350, 9000],
      [2900, 6200],
      [2150, 4300],
      [1600, 3500],
      [1330, 2800],
      [1275, 2150],
      [1265, 1700],
      [1225, 1150],
      [1160, 600],
      [1135, 0],
      [1125, -800],
      [1115, -1600],
      [1070, -2400],
      [920, -3000],
      [560, -3480],
      [180, -3800],
      [-280, -3960],
      [-950, -4150],
      [-970, -12000],
    ],
  },
  // Staten-Island-like: south-west across the Upper Bay; the Narrows open south of it onto the Lower Bay / ocean horizon
  {
    name: "si",
    pts: [
      [-8800, 7400],
      [-2600, 7700],
      [800, 7900],
      [2600, 9100],
      [2300, 10600],
      [600, 12400],
      [-2400, 14200],
      [-6200, 15200],
      [-8800, 14600],
    ],
  },
  {
    name: "gov",
    pts: [
      [380, 3700],
      [760, 3610],
      [980, 3860],
      [880, 4180],
      [520, 4230],
      [340, 3990],
    ],
  },
  // (round 10) Liberty-Island-like islet off the Bayonne shore (star-fort pedestal + copper statue, see libertyStatue())
  {
    name: "lib",
    pts: [
      [-1560, 3890],
      [-1500, 3905],
      [-1470, 3960],
      [-1490, 4020],
      [-1560, 4040],
      [-1615, 4000],
      [-1618, 3935],
    ],
  },
  // Roosevelt-Island-like sliver in the East River (the Queensboro-like bridge passes over it)
  {
    name: "roos",
    pts: [
      [905, -1760],
      [935, -1700],
      [952, -1300],
      [950, -800],
      [930, -420],
      [905, -380],
      [880, -420],
      [866, -800],
      [862, -1300],
      [878, -1700],
    ],
  },
];
// Palisades-like plateau on the New Jersey side: cliffs rising ~200-400 m behind a narrow waterfront strip opposite
// Midtown / Upper Manhattan (towers stand on top of it) -> the characteristic raised west skyline.
export const PAL_Y = 58;
const PAL_KEY = [
  [-1880, -5200],
  [-1885, -3400],
  [-1905, -2300],
  [-1945, -1300],
  [-1985, -350],
  [-2030, 450],
  [-2120, 900],
  [-2330, 1150],
];
// (round 6) the river-side cliff line is densified (~80 m pieces) and wiggled: headlands, coves and ravines instead of
// one ruler-straight plinth; the plateau slab, cliff faces, collision (farShoreHeight) all derive from this polygon
const PAL_CLIFF = [];
for (let i = 0; i + 1 < PAL_KEY.length; i++) {
  const [ax, az] = PAL_KEY[i],
    [bx, bz] = PAL_KEY[i + 1],
    n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 80));
  for (let k = 0; k < n; k++) {
    const t = k / n,
      z = az + (bz - az) * t,
      e =
        i === 0 && k === 0
          ? 0
          : 30 * Math.sin(z * 0.0093 + 0.6) +
            17 * Math.sin(z * 0.031 + 2.3) +
            9 * Math.sin(z * 0.087 + 4.1);
    PAL_CLIFF.push([ax + (bx - ax) * t + e - 20, z]);
  }
}
PAL_CLIFF.push(PAL_KEY[PAL_KEY.length - 1]);
const PAL_N = PAL_CLIFF.length;
export const PALISADES = [...PAL_CLIFF, [-7000, 1500], [-7000, -5200]];
const PAL_BB = [-7000, -5200, Math.max(...PAL_CLIFF.map((p) => p[0])), 1500];
export function inPalisades(x, z) {
  return (
    x >= PAL_BB[0] &&
    x <= PAL_BB[2] &&
    z >= PAL_BB[1] &&
    z <= PAL_BB[3] &&
    pointInPoly(PALISADES, x, z)
  );
}
for (const L of FAR_LANDS) {
  let x0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    z1 = -Infinity;
  for (const [x, z] of L.pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  L.bb = [x0, z0, x1, z1];
}
export function farShoreHeight(x, z) {
  for (const L of FAR_LANDS) {
    const b = L.bb;
    if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
    if (pointInPoly(L.pts, x, z))
      return L.name === "nj" && inPalisades(x, z) ? PAL_Y : FAR_Y;
  }
  return null;
}
// distance from (x,z) to a polygon's boundary (edges far out in the ocean / off-map are ignored)
function edgeDist(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i],
      [bx, bz] = pts[(i + 1) % pts.length];
    if (
      Math.max(Math.abs(ax), Math.abs(bx)) > 11000 ||
      Math.max(Math.abs(az), Math.abs(bz)) > 11000
    )
      continue;
    const dx = bx - ax,
      dz = bz - az,
      l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
// distance to the Palisades cliff line (its river-side polyline)
function cliffDist(x, z) {
  let best = Infinity;
  for (let i = 0; i + 1 < PAL_N; i++) {
    const [ax, az] = PALISADES[i],
      [bx, bz] = PALISADES[i + 1],
      dx = bx - ax,
      dz = bz - az,
      l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
// distance to Manhattan (horizontal distance to the island's shore at that z, or to its tips)
function islandDist(x, z) {
  const zc = Math.max(G.Z_MIN + 1, Math.min(G.Z_MAX - 1, z));
  const [w, e] = shoreX(zc);
  const dx = x < w ? w - x : x > e ? x - e : 0;
  return Math.hypot(dx, z - zc);
}

// tower clusters: centre, radius, height range, glass share
export const FAR_CLUSTERS = [
  {
    x: -2020,
    z: 2380,
    r: 560,
    h: [55, 235],
    glass: 0.55,
    name: "Jersey City",
    dens: 1.5,
  }, // (round 7: denser, wider downtown; round 12: lower floor, less glass -> height hierarchy + warm stone, critic 'row of grey boxes of near-identical height')
  { x: -1850, z: 800, r: 330, h: [40, 95], glass: 0.35, name: "Hoboken" },
  {
    x: 1400,
    z: -760,
    r: 380,
    h: [70, 205],
    glass: 0.7,
    name: "Long Island City",
  },
  {
    x: 1560,
    z: 2560,
    r: 430,
    h: [70, 180],
    glass: 0.5,
    name: "Downtown Brooklyn",
  },
  { x: 1420, z: 1320, r: 330, h: [40, 110], glass: 0.45, name: "Williamsburg" },
  { x: -560, z: -4500, r: 480, h: [35, 75], glass: 0.1, name: "Bronx" },
  {
    x: -2080,
    z: 5000,
    r: 360,
    h: [28, 70],
    glass: 0.25,
    name: "Bayonne",
    dens: 0.6,
  }, // (round 10) mid-rise knot on the new peninsula
  {
    x: -700,
    z: 7800,
    r: 380,
    h: [25, 60],
    glass: 0.2,
    name: "St George",
    dens: 0.6,
  },
];

// street grids per region: block long side along z ('z') or x ('x'), block size, street width, grid phase
function gridFor(name, z) {
  if (name === "nj") return { lx: 78, lz: 196, st: 13, ox: 17, oz: 41 };
  if (name === "east") {
    if (z < -3350) return { lx: 214, lz: 74, st: 14, ox: 5, oz: 23 }; // Bronx
    if (z < 700) return { lx: 88, lz: 205, st: 14, ox: 31, oz: 7 }; // Queens / LIC
    return { lx: 206, lz: 80, st: 13, ox: 12, oz: 52 }; // Brooklyn
  }
  if (name === "roos") return { lx: 60, lz: 120, st: 10, ox: 0, oz: 0 };
  if (name === "si") return { lx: 72, lz: 150, st: 12, ox: 9, oz: 30 }; // (round 10) Staten-Island-like suburban grid (massed band)
  return { lx: 110, lz: 110, st: 12, ox: 0, oz: 0 };
}

// (round 6) arterial boulevard grid on the far shores (x lines every ART_SX, z lines every ART_SZ, half width ART_H)
const ART_SX = 1100,
  ART_SZ = 950,
  ART_H = 13;
const artX = (x) => Math.round((x - 350) / ART_SX) * ART_SX + 350,
  artZ = (z) => Math.round((z - 180) / ART_SZ) * ART_SZ + 180;
const nearLand = (x, z) =>
  FAR_LANDS.find(
    (L) =>
      (L.name === "nj" || L.name === "east") &&
      x >= L.bb[0] &&
      x <= L.bb[2] &&
      z >= L.bb[1] &&
      z <= L.bb[3] &&
      pointInPoly(L.pts, x, z),
  );
const NEAR = 1500; // facade boxes (with collision) out to this distance from Manhattan
const FAR = 4300; // massed blocks out to this distance (beyond: only the ground map)
const MAP = { x0: -6000, x1: 6000, z0: -7600, z1: 9000, px: 5 }; // ground-map coverage, metres per pixel

export function buildFarShore({ scene, facadeMat, solids = null }) {
  facadeMat = deriveFacadeMaterial(facadeMat, {
    NO_CITYLIGHT: "",
    FAR_NIGHT: "",
  }); // (night) no Manhattan street-light fill on the far-shore facades (flat tan band)
  const group = new THREE.Group();
  group.name = "farShore";
  scene.add(group);
  const rnd = mulberry32(9090);
  // (round 11) neighbourhood fields (hash value noise, no rng stream use): critic 'far shore = grid of near-identical
  // boxes, beige mush, no height variation'. hoodH: height multiplier (low 3-storey rows .. 8-14 storey apartment
  // districts), hoodP: palette (0 = red-brick / brownstone quarter, 1 = pale limestone / concrete quarter)
  const vn = (x, z, sc, sd) => {
    const fx = x / sc,
      fz = z / sc,
      ix = Math.floor(fx),
      iz = Math.floor(fz),
      tx = fx - ix,
      tz = fz - iz;
    const u = tx * tx * (3 - 2 * tx),
      v = tz * tz * (3 - 2 * tz),
      h = (a, b) => hash2(a + sd * 131, b - sd * 71);
    return (
      (h(ix, iz) * (1 - u) + h(ix + 1, iz) * u) * (1 - v) +
      (h(ix, iz + 1) * (1 - u) + h(ix + 1, iz + 1) * u) * v
    );
  };
  const hoodH = (x, z) =>
    0.5 + 2.3 * Math.pow(vn(x, z, 620, 11), 3.2) + 0.3 * vn(x, z, 190, 23); // mostly 0.6-0.9, rare 2-2.8 hot spots
  const hoodP = (x, z) => vn(x, z, 840, 37);
  const RED_Q = [LAYER.RED, LAYER.BROWN, LAYER.RED, LAYER.BROWN, LAYER.RED],
    PALE_Q = [LAYER.BUFF, LAYER.LIME, LAYER.CONCRETE, LAYER.WHITE, LAYER.BUFF];
  const hoodLay = (arr, x, z) => {
    const r = rnd(),
      p = hoodP(x, z); // biased pick: 60% of lots follow the quarter's palette
    if (p < 0.46 && r < 0.6) return RED_Q[Math.floor((r / 0.6) * RED_Q.length)];
    if (p > 0.74 && r < 0.6)
      return PALE_Q[Math.floor((r / 0.6) * PALE_Q.length)];
    return arr[Math.floor(r * 0.9999 * arr.length)];
  };
  const F = Object.assign(new FacadeBuilder(), { noLights: true }); // near buildings (facade shader); (night) out of window-light reach
  const FR = new FacadeBuilder(); // (round 4) rooftop kits + container stacks / cranes: small casters (near cascades only)
  const bulk = new FacadeBuilder(); // bulkheads, piers
  const M = { P: [], N: [], C: [], I: [], n: 0 }; // far massed blocks (vertex colours)
  const wetSegs = []; // water-line edges for the wet tidal band (water.js buildWetBands)
  const W = Math.round((MAP.x1 - MAP.x0) / MAP.px),
    H = Math.round((MAP.z1 - MAP.z0) / MAP.px);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g2 = cv.getContext("2d");
  const mx = (x) => (x - MAP.x0) / MAP.px,
    mz = (z) => (z - MAP.z0) / MAP.px;
  const rectPx = (x0, z0, x1, z1, col) => {
    g2.fillStyle = col;
    g2.fillRect(mx(x0), mz(z0), (x1 - x0) / MAP.px, (z1 - z0) / MAP.px);
  };
  g2.fillStyle = "#5b5a53";
  g2.fillRect(0, 0, W, H); // (r14: darker, was #6d6c64) // default: faded mixed urban ground

  // ---- land slabs: ground map fill + bulkheads
  for (const L of FAR_LANDS) {
    g2.fillStyle = L.name === "si" ? "#4c5343" : "#53524c"; // (r14: darker)
    g2.beginPath();
    L.pts.forEach(([x, z], i) =>
      i ? g2.lineTo(mx(x), mz(z)) : g2.moveTo(mx(x), mz(z)),
    );
    g2.closePath();
    g2.fill();
    // (r13) critic: 'far shore = a hazy wall, separate it with a darker waterline'. A dark waterfront apron (wet
    // timber / tar bulkhead tops, shed shadows, parked trucks) ~14 m deep along every bank, broken into lighter lots
    if (L.name !== "lib") {
      g2.save();
      g2.clip();
      g2.strokeStyle = "#3a3b39";
      g2.lineWidth = 28 / MAP.px;
      g2.stroke();
      g2.restore();
    }
  }
  const bp = {
    style: STYLE.BLANK,
    layer: LAYER.CONCRETE,
    tint: [0.34, 0.33, 0.31],
    seed: 3,
  }; // (r13: 0.6 -> 0.34, critic 'no darker waterline, far shore = pale smear')
  for (const L of FAR_LANDS) {
    let area = 0;
    for (let j = 0; j < L.pts.length; j++) {
      const p = L.pts[j],
        q = L.pts[(j + 1) % L.pts.length];
      area += p[0] * q[1] - q[0] * p[1];
    }
    for (let i = 0; i < L.pts.length; i++) {
      const [ax, az] = L.pts[i],
        [bx, bz] = L.pts[(i + 1) % L.pts.length];
      if (
        Math.max(Math.abs(ax), Math.abs(bx)) > 11000 ||
        Math.max(Math.abs(az), Math.abs(bz)) > 11000
      )
        continue;
      if (farCoastOwns(L.name, i)) continue; // (coast r1) seawall / fill / wet band built by waterfront.js
      const Lh = Math.hypot(bx - ax, bz - az);
      let nx = (bz - az) / Lh,
        nz = -(bx - ax) / Lh;
      if (area < 0) {
        nx = -nx;
        nz = -nz;
      }
      const Tx = nz,
        Tz = -nx;
      const sx = (ax - bx) * Tx + (az - bz) * Tz > 0 ? bx : ax,
        sz = sx === bx ? bz : az;
      bulk.quad(
        [sx, 0, sz],
        [Tx, 0, Tz],
        Lh,
        G.WATER_Y - 2,
        FAR_Y,
        [nx, 0, nz],
        bp,
        STYLE.BLANK,
        0,
      );
      wetSegs.push({ ax, az, bx, bz, nx, nz });
    }
  }

  // ---- buildings
  const LAY_ROW = [
    LAYER.BROWN,
    LAYER.RED,
    LAYER.RED,
    LAYER.BUFF,
    LAYER.BROWN,
    LAYER.RED,
    LAYER.LIME,
  ]; // (round 5: fewer pale fronts)
  const LAY_MID = [
    LAYER.BUFF,
    LAYER.RED,
    LAYER.BROWN,
    LAYER.LIME,
    LAYER.CONCRETE,
    LAYER.WHITE,
  ];
  const ROOFS = [
    LAYER.ROOF,
    LAYER.ROOF_GRAVEL,
    LAYER.ROOF_MEMBRANE,
    LAYER.ROOF,
    LAYER.ROOF_GRAVEL,
  ];
  // representative albedo per facade layer for the far massed blocks (muted, faded)
  // (r14) critic: 'outer boroughs = a sea of identical light-blue-grey low boxes, no brick reds'. Darker, warmer,
  // more saturated albedos (the haze lifts and cools them; they must start well below the Manhattan facades)
  const FAR_COL = {
    [LAYER.RED]: [0.43, 0.2, 0.14],
    [LAYER.BROWN]: [0.34, 0.22, 0.16],
    [LAYER.BUFF]: [0.5, 0.4, 0.29],
    [LAYER.LIME]: [0.54, 0.48, 0.39],
    [LAYER.CONCRETE]: [0.42, 0.41, 0.39],
    [LAYER.METAL]: [0.3, 0.35, 0.39],
    [LAYER.WHITE]: [0.56, 0.54, 0.5],
    [LAYER.GRANITE]: [0.4, 0.38, 0.36],
  };
  let nNear = 0,
    nFar = 0,
    curBase = FAR_Y,
    palGeo = null;
  const foot = []; // (r14) flat [x0, z0, x1, z1, ...] of every ground-level building footprint
  // (round 5) curtain-wall tints for the massed towers (blue-grey, green-grey, smoked, bronze, pale) instead of one grey
  const FAR_GLASS = [
    [0.3, 0.36, 0.42],
    [0.25, 0.3, 0.3],
    [0.36, 0.37, 0.4],
    [0.2, 0.24, 0.3],
    [0.38, 0.34, 0.3],
    [0.46, 0.5, 0.52],
  ];
  // (round 5) tower massing: a single shaft, 2-3 setback tiers, or a slab + lower wing, so a cluster is not a clump of
  // copy-pasted prisms. fn = nearBox / farBox-like (x0, z0, x1, z1, h, layer, glass, isUpper)
  // (round 8) crowns on the tall ones: a stepped lantern (1-2 narrower tiers) and / or a mast, so the Jersey City /
  // LIC / Downtown Brooklyn skylines get varied tops instead of flat-cut prisms. Own rng (the layout stream is kept).
  const crnd = mulberry32(90210);
  const vrnd = mulberry32(31337); // (round 10) massing-variety stream
  const crown = (fn, cx, cz, w, d, top, layer, glass) => {
    if (top - curBase < 95 || crnd() > 0.62) return;
    const s = curBase,
      k = crnd();
    curBase = top;
    if (k < 0.6) {
      let a = w * (0.55 + crnd() * 0.15),
        b = d * (0.55 + crnd() * 0.15);
      for (let i = 0; i < 1 + (crnd() < 0.5 ? 1 : 0); i++) {
        const h = 5 + crnd() * 9;
        fn(
          cx - a / 2,
          cz - b / 2,
          cx + a / 2,
          cz + b / 2,
          h,
          layer,
          glass,
          true,
        );
        curBase += h;
        a *= 0.62;
        b *= 0.62;
      }
    }
    if (k > 0.35)
      fn(
        cx - 1.6,
        cz - 1.6,
        cx + 1.6,
        cz + 1.6,
        14 + crnd() * 30,
        LAYER.METAL,
        false,
        true,
      );
    curBase = s;
  };
  const towerMass = (fn, cx, cz, w, d, H, layer, glass) => {
    const q = rnd(),
      sB = curBase;
    if (H < 60 || q < 0.3) {
      fn(
        cx - w / 2,
        cz - d / 2,
        cx + w / 2,
        cz + d / 2,
        H,
        layer,
        glass,
        false,
      );
      crown(fn, cx, cz, w, d, sB + H, layer, glass);
      return;
    }
    if (q < 0.72) {
      const n = H > 120 && rnd() < 0.5 ? 3 : 2;
      let rem = H,
        ww = w,
        dd = d,
        ox = 0,
        oz = 0;
      for (let i = 0; i < n; i++) {
        const hh = i === n - 1 ? rem : rem * (0.55 + rnd() * 0.2);
        fn(
          cx + ox - ww / 2,
          cz + oz - dd / 2,
          cx + ox + ww / 2,
          cz + oz + dd / 2,
          hh,
          layer,
          glass,
          i < n - 1,
        );
        curBase += hh;
        rem -= hh;
        const kw = 0.68 + rnd() * 0.16,
          kd = 0.68 + rnd() * 0.16;
        ox += (rnd() - 0.5) * ww * (1 - kw) * 0.8;
        oz += (rnd() - 0.5) * dd * (1 - kd) * 0.8;
        ww *= kw;
        dd *= kd;
      }
      curBase = sB;
      crown(fn, cx + ox, cz + oz, ww, dd, sB + H, layer, glass);
      return;
    }
    // slab + a lower wing along the long side
    const alongX = w > d;
    if (alongX) {
      fn(
        cx - w / 2,
        cz - d / 2,
        cx + w * 0.1,
        cz + d / 2,
        H,
        layer,
        glass,
        false,
      );
      fn(
        cx + w * 0.1,
        cz - d * 0.4,
        cx + w / 2,
        cz + d * 0.35,
        H * (0.45 + rnd() * 0.3),
        layer,
        glass,
        false,
      );
    } else {
      fn(
        cx - w / 2,
        cz - d / 2,
        cx + w / 2,
        cz + d * 0.1,
        H,
        layer,
        glass,
        false,
      );
      fn(
        cx - w * 0.4,
        cz + d * 0.1,
        cx + w * 0.35,
        cz + d / 2,
        H * (0.45 + rnd() * 0.3),
        layer,
        glass,
        false,
      );
    }
  };
  // (round 9) yard towers: own rng + a single-shaft / 2-tier massing that never touches the layout stream
  const trnd = mulberry32(60606);
  const towerMassT = (fn, cx, cz, w, d, H, layer, glass) => {
    if (trnd() < 0.55) {
      fn(
        cx - w / 2,
        cz - d / 2,
        cx + w / 2,
        cz + d / 2,
        H,
        layer,
        glass,
        false,
      );
      return;
    }
    const sB = curBase,
      h1 = H * (0.6 + trnd() * 0.2);
    fn(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h1, layer, glass, true);
    curBase += h1;
    fn(
      cx - w * 0.36,
      cz - d * 0.36,
      cx + w * 0.36,
      cz + d * 0.36,
      H - h1,
      layer,
      glass,
      false,
    );
    curBase = sB;
  };
  // New-Jersey 'Gold Coast': a band of 12-45 storey waterfront towers along Hoboken / Newport / Jersey City
  const GOLD = { h: [35, 150], glass: 0.45, name: "Gold Coast" };
  // (round 12) signature far towers (critic: 'generic grey boxes, a single spire, no landmarks'): the tower block that
  // contains one of these points gets a single tower of this height / material instead of the random pick
  const SIG_T = [
    { x: -1930, z: 2250, h: 262, glass: true, lay: LAYER.METAL }, // 99-Hudson-like glass supertall
    { x: -1905, z: 2700, h: 238, glass: false, lay: LAYER.LIME }, // Goldman-Sachs-tower-like pale stone shaft
    { x: -2060, z: 2050, h: 205, glass: false, lay: LAYER.RED }, // brick-clad residential tower
    { x: 1330, z: -780, h: 212, glass: true, lay: LAYER.METAL }, // Citigroup-LIC-like green glass slab
    { x: 1560, z: 2440, h: 190, glass: false, lay: LAYER.BUFF }, // Williamsburgh-Savings-Bank-like
  ];
  const FAR_PARKS = [
    [2480, 3900, 3120, 4750],
    [2150, -1950, 2650, -1450],
    [-3050, 2550, -2650, 3000],
  ];
  const sigIn = (x0, z0, x1, z1) =>
    SIG_T.find((t) => t.x > x0 && t.x < x1 && t.z > z0 && t.z < z1);
  // roof values: mostly mid / dark (tar, gravel, weathered membrane), a few bright white membranes and rusty tones
  const roofTint = () => {
    const r = rnd(),
      k =
        r < 0.36
          ? 0.28 + rnd() * 0.1
          : r < 0.8
            ? 0.42 + rnd() * 0.14
            : r < 0.93
              ? [0.58, 0.48, 0.4]
              : 0.74 + rnd() * 0.1;
    if (Array.isArray(k)) return k.map((v) => v * (0.85 + rnd() * 0.2));
    return [
      k * (0.97 + rnd() * 0.06),
      k * (0.97 + rnd() * 0.05),
      k * (0.95 + rnd() * 0.06),
    ];
  };
  const tintJ = () => {
    const k = 0.48 + rnd() * 0.4; // (round 5) wider value spread: the far shore read as one pale carpet; (r14: 0.56..0.98 -> 0.48..0.88, critic 'pale light-blue-grey boxes')
    return [
      k * (0.97 + rnd() * 0.06),
      k * (0.96 + rnd() * 0.05),
      k * (0.95 + rnd() * 0.06),
    ];
  };
  const nearBox = (
    x0,
    z0,
    x1,
    z1,
    h,
    kind,
    layer,
    glass = false,
    noKit = false,
  ) => {
    if (x1 - x0 < 3 || z1 - z0 < 3 || h < 3) return;
    const y0 = curBase,
      y1 = curBase + h;
    const P = glass
      ? {
          floorH: 3.9,
          bayW: 1.55,
          winW: 0.97,
          winH: 0.74,
          layer: LAYER.METAL,
          base: LAYER.GRANITE,
          seed: rnd() * 100,
          margin: 0,
          depth: 0.04,
          tint: [0.9 + rnd() * 0.12, 0.95 + rnd() * 0.08, 1],
          topY: y1,
          baseY: y0,
        }
      : {
          floorH: kind === "ind" ? 4.6 : 3.1 + rnd() * 0.5,
          bayW: kind === "ind" ? 5.5 : 2.0 + rnd() * 0.8,
          winW: kind === "ind" ? 0.7 : 0.48 + rnd() * 0.1,
          winH: kind === "ind" ? 0.35 : 0.52 + rnd() * 0.1,
          layer,
          base: rnd() < 0.5 ? LAYER.LIME : layer,
          seed: rnd() * 100,
          margin: 0.6,
          depth: 0.2,
          tint: kind === "ind" ? tintJ().map((v) => v * 0.7) : tintJ(),
          topY: y1,
          baseY: y0, // (r14) darker waterfront sheds / warehouses (critic: 'no darker waterfront warehouses')
          lintel: kind === "row" ? 2 : 0,
        };
    const st = glass
      ? STYLE.CURTAIN
      : kind === "ind" && rnd() < 0.5
        ? STYLE.RIBBON
        : STYLE.PUNCHED;
    const f = { style: st, gH: -0.01 };
    const roofL = ROOFS[Math.floor(rnd() * ROOFS.length)];
    F.box(
      x0,
      y0,
      z0,
      x1,
      y1,
      z1,
      P,
      { px: f, nx: f, pz: f, nz: f },
      true,
      false,
      { ...P, style: STYLE.BLANK, layer: roofL, tint: roofTint() },
    );
    solids?.box(x0, y0, z0, x1, y1, z1, "wall");
    nNear++;
    if (y0 < FAR_Y + 3 || y0 === PAL_Y) foot.push(x0, z0, x1, z1); // (r14) ground footprints (waterfront shed pass)
    // (round 4) rooftop kit, varied per roof: stair / elevator bulkheads, a wooden water tank on a steel stand,
    // mechanical penthouses on the towers, parapet lips (all exact collision boxes / cylinders)
    if (kind !== "ind" && !noKit && x1 - x0 > 9 && z1 - z0 > 9 && h > 10) {
      const W = x1 - x0,
        D = z1 - z0,
        q = rnd();
      const blank = (layer, tint) => ({
        ...P,
        style: STYLE.BLANK,
        layer,
        tint,
        topY: y1 + 12,
        baseY: y1,
      });
      const rbox = (a0, b0, a1, b1, hh, layer, tint, k = "bulkhead") => {
        FR.box(
          a0,
          y1,
          b0,
          a1,
          y1 + hh,
          b1,
          blank(layer, tint),
          {},
          true,
          false,
          blank(LAYER.ROOF, roofTint()),
        );
        solids?.box(a0, y1, b0, a1, y1 + hh, b1, k);
      };
      if (!glass && h < 70 && W > 12 && D > 12) {
        // parapet lip
        const t = 0.35,
          ph = 0.9,
          pp = blank(layer, P.tint);
        for (const [a0, b0, a1, b1] of [
          [x0, z0, x1, z0 + t],
          [x0, z1 - t, x1, z1],
          [x0, z0 + t, x0 + t, z1 - t],
          [x1 - t, z0 + t, x1, z1 - t],
        ]) {
          FR.box(a0, y1, b0, a1, y1 + ph, b1, pp, {}, true, false, pp);
          solids?.box(a0, y1, b0, a1, y1 + ph, b1, "parapet");
        }
      }
      if (glass || h > 60) {
        // mechanical penthouse (+ a second, smaller tier on some)
        const a = W * (0.25 + rnd() * 0.15),
          b = D * (0.25 + rnd() * 0.15),
          cx = (x0 + x1) / 2 + (rnd() - 0.5) * W * 0.2,
          cz = (z0 + z1) / 2 + (rnd() - 0.5) * D * 0.2;
        rbox(
          cx - a,
          cz - b,
          cx + a,
          cz + b,
          4 + rnd() * 4,
          glass ? LAYER.METAL : LAYER.CONCRETE,
          [0.8, 0.8, 0.8],
          "equipment",
        );
      } else {
        // stair bulkhead near a corner
        const bw = 3 + rnd() * 2.5,
          bd = 3.5 + rnd() * 3,
          bx =
            rnd() < 0.5
              ? x0 + 1.5 + rnd() * (W * 0.3)
              : x1 - 1.5 - bw - rnd() * (W * 0.3),
          bz = rnd() < 0.5 ? z0 + 1.5 : z1 - 1.5 - bd;
        rbox(bx, bz, bx + bw, bz + bd, 2.8 + rnd() * 1.2, layer, P.tint);
        if (q < 0.45) {
          // wooden water tank on a stand
          const r = 1.9 + rnd() * 0.9,
            tx = x0 + 3 + r + rnd() * (W - 6 - 2 * r),
            tz = z0 + 3 + r + rnd() * (D - 6 - 2 * r),
            leg = 2.2 + rnd() * 1.5;
          if (
            !(
              tx + r > bx - 0.5 &&
              tx - r < bx + bw + 0.5 &&
              tz + r > bz - 0.5 &&
              tz - r < bz + bd + 0.5
            )
          ) {
            rbox(
              tx - r * 0.8,
              tz - r * 0.8,
              tx + r * 0.8,
              tz + r * 0.8,
              leg,
              LAYER.METAL,
              [0.45, 0.45, 0.45],
              "watertower",
            );
            const tp = {
              ...P,
              style: STYLE.BLANK,
              layer: LAYER.BROWN,
              tint: [0.55 + rnd() * 0.15, 0.45, 0.36],
              topY: y1 + leg + 8,
              baseY: y1 + leg,
            };
            FR.cyl(
              tx,
              tz,
              r,
              y1 + leg,
              y1 + leg + 3.8 + rnd() * 1.5,
              10,
              tp,
              STYLE.BLANK,
              true,
              r * 0.92,
            );
            solids?.cyl(tx, tz, y1 + leg, y1 + leg + 3.8, r, r, "watertower");
          }
        } else if (q < 0.7 && W > 16 && D > 16) {
          // HVAC bank
          const n = 2 + Math.floor(rnd() * 3),
            ux = x0 + W * (0.3 + rnd() * 0.3),
            uz = z0 + D * (0.25 + rnd() * 0.3);
          for (let i = 0; i < n; i++)
            rbox(
              ux + i * 2.6,
              uz,
              ux + i * 2.6 + 2,
              uz + 2.4,
              1.4,
              LAYER.CONCRETE,
              [0.72, 0.72, 0.7],
              "equipment",
            );
        }
      }
    }
  };
  const farBox = (x0, z0, x1, z1, h, layer, glass = false) => {
    if (x1 - x0 < 3 || z1 - z0 < 3) return;
    const y0 = curBase,
      y1 = curBase + h,
      c0 = glass
        ? FAR_GLASS[Math.floor(rnd() * FAR_GLASS.length)]
        : (FAR_COL[layer] ?? FAR_COL[LAYER.BUFF]);
    const k = 0.42 + rnd() * 0.42,
      c = [c0[0] * k, c0[1] * k, c0[2] * k],
      r = roofTint().map((v) => v * 0.58); // (r14: 0.5..0.9 -> 0.42..0.84) // (round 6: darker, the far boroughs read as a bleached carpet)
    const quad = (pts, n, col, win) => {
      for (const p of pts) {
        M.P.push(...p);
        M.N.push(...n);
        M.C.push(col[0], col[1], win ? col[2] + (glass ? 20 : 10) : col[2]);
      }
      M.I.push(M.n, M.n + 1, M.n + 2, M.n, M.n + 2, M.n + 3);
      M.n += 4;
    };
    quad(
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      [0, 0, 1],
      c,
      1,
    );
    quad(
      [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
      [0, 0, -1],
      c,
      1,
    );
    quad(
      [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      [1, 0, 0],
      c,
      1,
    );
    quad(
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
      [-1, 0, 0],
      c,
      1,
    );
    quad(
      [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      [0, 1, 0],
      r,
      0,
    );
    nFar++;
    if (y0 < FAR_Y + 3 || y0 === PAL_Y) foot.push(x0, z0, x1, z1);
    // silhouette: mechanical penthouse / water tank / setback crown on the taller massed boxes (round 3)
    if (h > 24 && x1 - x0 > 12 && z1 - z0 > 12 && !farBox._in) {
      farBox._in = true;
      const cx = (x0 + x1) / 2 + (rnd() - 0.5) * (x1 - x0) * 0.3,
        cz = (z0 + z1) / 2 + (rnd() - 0.5) * (z1 - z0) * 0.3,
        q = rnd();
      const sBase = curBase;
      curBase = y1;
      if (glass && h > 80 && q < 0.6) {
        // stepped glass crown
        const a = 0.36 * (x1 - x0),
          b = 0.36 * (z1 - z0);
        farBox(cx - a, cz - b, cx + a, cz + b, 8 + rnd() * 14, layer, true);
      } else if (q < 0.55) {
        const a = 3 + rnd() * Math.min(9, (x1 - x0) * 0.22),
          b = 3 + rnd() * Math.min(9, (z1 - z0) * 0.22);
        farBox(cx - a, cz - b, cx + a, cz + b, 3.5 + rnd() * 3, LAYER.CONCRETE);
      } else if (q < 0.8 && !glass) {
        // wooden water tank on legs (a small dark box reads as one at this range)
        farBox(
          cx - 2.2,
          cz - 2.2,
          cx + 2.2,
          cz + 2.2,
          6 + rnd() * 2,
          LAYER.BROWN,
        );
      }
      curBase = sBase;
      farBox._in = false;
    }
  };
  // (round 4) container terminal: rows of stacked containers (muted liveries) with straddle lanes, and ship-to-shore
  // gantry cranes on the side facing the water (booms reaching out toward the river). Exact collision boxes.
  const CONT = [
    [0.5, 0.2, 0.15],
    [0.2, 0.3, 0.42],
    [0.55, 0.45, 0.3],
    [0.3, 0.4, 0.3],
    [0.6, 0.58, 0.55],
    [0.45, 0.28, 0.18],
    [0.25, 0.25, 0.27],
    [0.62, 0.36, 0.12],
  ];
  const steelP = (tint, y0, y1) => ({
    style: STYLE.BLANK,
    layer: LAYER.CONCRETE,
    tint,
    seed: 5,
    topY: y1,
    baseY: y0,
    floorH: 4,
    bayW: 4,
    winW: 0,
    winH: 0,
    margin: 0,
    depth: 0,
  });
  const sbox = (a0, y0, b0, a1, y1, b1, tint, k = "equipment") => {
    const p = steelP(tint, y0, y1);
    FR.box(a0, y0, b0, a1, y1, b1, p, {}, true, true, p);
    solids?.box(a0, y0, b0, a1, y1, b1, k);
  };
  const containerYard = (x0, z0, x1, z1, cx, cz, L, dW, nCranes = 0) => {
    rectPx(x0 + 2, z0 + 2, x1 - 2, z1 - 2, "#5a5956");
    const alongZ = z1 - z0 > x1 - x0;
    const y = curBase;
    // rows of stacks: 12.2 m long containers, 2.5 m wide, 1-4 high; each row a run of stacks with its own heights
    if (alongZ) {
      for (let x = x0 + 6; x < x1 - 8; x += 7.5)
        for (let z = z0 + 6; z < z1 - 16; z += 13.2) {
          if (rnd() < 0.18) continue;
          const n = 1 + Math.floor(rnd() * 4),
            c = CONT[Math.floor(rnd() * CONT.length)],
            k = 0.8 + rnd() * 0.3;
          sbox(
            x,
            y,
            z,
            x + 5.0,
            y + 2.6 * n,
            z + 12.2,
            c.map((v) => v * k),
            "roof",
          );
        }
    } else {
      for (let z = z0 + 6; z < z1 - 8; z += 7.5)
        for (let x = x0 + 6; x < x1 - 16; x += 13.2) {
          if (rnd() < 0.18) continue;
          const n = 1 + Math.floor(rnd() * 4),
            c = CONT[Math.floor(rnd() * CONT.length)],
            k = 0.8 + rnd() * 0.3;
          sbox(
            x,
            y,
            z,
            x + 12.2,
            y + 2.6 * n,
            z + 5.0,
            c.map((v) => v * k),
            "roof",
          );
        }
    }
    if (dW > 170) return;
    // direction toward the water (edge distance falls fastest)
    const d = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
      .map(([dx, dz]) => [dx, dz, edgeDist(L.pts, cx + dx * 40, cz + dz * 40)])
      .sort((a, b) => a[2] - b[2])[0];
    const [dx, dz] = d;
    const nCr = nCranes || 1 + Math.floor(rnd() * 3),
      red = rnd() < 0.5,
      col = red ? [0.52, 0.2, 0.14] : [0.32, 0.38, 0.44];
    for (let i = 0; i < nCr; i++) {
      const t = (i + 0.5) / nCr;
      // crane base on the block edge facing the water; frame axis u (toward water), v (along the quay)
      const ex = dx > 0 ? x1 - 4 : dx < 0 ? x0 + 4 : x0 + (x1 - x0) * t,
        ez = dz > 0 ? z1 - 4 : dz < 0 ? z0 + 4 : z0 + (z1 - z0) * t;
      const P2 = (u, v) => [ex + dx * u + dz * v, ez + dz * u + dx * v];
      const bx = (u0, v0, u1, v1, ya, yb) => {
        const [a0, b0] = P2(u0, v0),
          [a1, b1] = P2(u1, v1);
        sbox(
          Math.min(a0, a1),
          ya,
          Math.min(b0, b1),
          Math.max(a0, a1),
          yb,
          Math.max(b0, b1),
          col,
        );
      };
      const H = 34 + rnd() * 6;
      for (const u of [-16, 0])
        for (const v of [-7, 6]) bx(u, v, u + 1.2, v + 1.2, y, y + H); // legs
      bx(-16, -7, 1.2, -5.8, y + H, y + H + 2.2);
      bx(-16, 6, 1.2, 7.2, y + H, y + H + 2.2); // side girders
      bx(-16, -7, -14.8, 7.2, y + H, y + H + 2.2);
      bx(0, -7, 1.2, 7.2, y + H, y + H + 2.2); // portal beams
      bx(-12, -6, -5, 6.2, y + H + 2.2, y + H + 6.5); // machinery house
      bx(-30, -1.2, 58, 1.4, y + H + 6.5, y + H + 8.5); // boom + back reach
      bx(-9, -1.8, -6.5, 2.0, y + H + 8.5, y + H + 20); // A-frame apex
      bx(-2, -2.2, 2, 2.4, y + 8, y + 10); // sill beam
    }
  };
  // the land's usable area: all four corners of a rect on the land polygon, off Manhattan, away from the water's edge
  let nearTrees = 0;
  const canopy = new CanopyBatch(4711);
  // (coast r2) user: 'no low-poly blobs' on the far shores seen from Manhattan. Crowns within ~560 m of the island
  // (Roosevelt, the LIC / Williamsburg / Brooklyn / Hoboken waterfronts) become real trees.js trees (leaf cards, trunks,
  // LOD / impostor tiers) via COAST.trees; the rest stay cheap canopy blobs in the haze. The canopy rng is still drawn.
  // (bridges r3) and every crown round a bridge's far landing (the approach viaduct down to the far ground, seen from
  // the mid-span): real trees there too, not blobs
  const landingR = bridgeSpans().map((B) => [
    B.xB0 - 40,
    B.z - 260,
    B.rampX1 + 260,
    B.z + 260,
  ]);
  const nearLanding = (x, z) =>
    landingR.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
  {
    const add0 = canopy.add.bind(canopy);
    canopy.add = (x, y, z, r, autumn = 0.25, sq = null) => {
      add0(x, y, z, r, autumn, sq);
      if (islandDist(x, z) < 560 || nearLanding(x, z)) {
        canopy.M.pop();
        canopy.C.length -= 3;
        COAST.trees.push({
          x,
          z,
          kind: "street",
          y,
          sc: Math.max(0.6, Math.min(1.35, r / 4.2)),
        });
        nearTrees++;
      }
    };
  }
  const yardTrees = (x0, z0, x1, z1, per) => {
    // back-yard / courtyard trees: count by area
    if (x1 - x0 < 5 || z1 - z0 < 5) return;
    const n = Math.min(28, Math.floor(((x1 - x0) * (z1 - z0)) / per + rnd()));
    for (let i = 0; i < n; i++)
      canopy.add(
        x0 + 2 + rnd() * (x1 - x0 - 4),
        curBase,
        z0 + 2 + rnd() * (z1 - z0 - 4),
        3.2 + rnd() * 2.8,
        0.3,
      );
  };
  const onFar = (L, x0, z0, x1, z1) =>
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ].every(([x, z]) => pointInPoly(L.pts, x, z) && !onLand(x, z));
  // bridge approach corridors (ramps + anchorages) stay free of buildings
  const corridors = bridgeSpans().map((B) => [
    B.xB0 - 10,
    B.z - B.width / 2 - 8,
    B.rampX1 + 20,
    B.z + B.width / 2 + 8,
  ]);
  const inCorridor = (x0, z0, x1, z1) =>
    corridors.some((c) => x1 > c[0] && x0 < c[2] && z1 > c[1] && z0 < c[3]);
  // (round 7) far-shore landmark sites (the far boroughs were one carpet of blocks): a Ravenswood-like power station with
  // four banded smokestacks opposite the Roosevelt-like islet, a Newtown-Creek-like tank farm on the Queens / Brooklyn
  // waterfront, a Bayonne-like tank farm on the NJ side of the Upper Bay. Blocks skip these rects; built after the grid.
  const SITES = [
    { kind: "power", x0: 1180, z0: -1400, x1: 1345, z1: -1080 },
    { kind: "tanks", x0: 1200, z0: 300, x1: 1420, z1: 600 },
    { kind: "power", x0: -1880, z0: -1060, x1: -1745, z1: -760 }, // Weehawken-like, below the Palisades
    { kind: "tanks", x0: -3470, z0: 4010, x1: -3160, z1: 4480 },
    // (round 12) critic (ref 05 has cranes, stacks, piers across the Hudson): a Hudson-Generating-Station-like plant on
    // the Jersey City waterfront and a Port-Jersey-like container terminal with a row of gantry cranes south of it
    { kind: "power", x0: -2010, z0: 1650, x1: -1850, z1: 1960 },
    { kind: "port", x0: -2230, z0: 3030, x1: -2030, z1: 3420 },
    // (r14) critic (ref 05 / 07: 'no piers, waterfront industry or cranes'): a second NJ container quay opposite Midtown,
    // a Red-Hook-like terminal on the Brooklyn harbour front, and high-rise construction sites (open floor-slab
    // skeleton on a concrete core + a tower crane) in the tower clusters so the far skylines get crane silhouettes
    { kind: "port", x0: -1960, z0: 1150, x1: -1800, z1: 1480 },
    { kind: "port", x0: 2010, z0: 3720, x1: 2220, z1: 4040 },
    { kind: "build", x0: -2160, z0: 2480, x1: -2090, z1: 2550, h: 168 },
    { kind: "build", x0: -1905, z0: 560, x1: -1850, z1: 615, h: 96 },
    { kind: "build", x0: 1450, z0: -620, x1: 1510, z1: -560, h: 150 },
    { kind: "build", x0: 1630, z0: 2690, x1: 1690, z1: 2750, h: 128 },
    { kind: "build", x0: -2300, z0: 1980, x1: -2240, z1: 2040, h: 118 },
  ].filter((S) => {
    const L = nearLand((S.x0 + S.x1) / 2, (S.z0 + S.z1) / 2);
    return (
      L &&
      [
        [S.x0, S.z0],
        [S.x1, S.z0],
        [S.x1, S.z1],
        [S.x0, S.z1],
      ].every(([x, z]) => pointInPoly(L.pts, x, z) && !inPalisades(x, z))
    );
  });
  const inSite = (x0, z0, x1, z1) =>
    SITES.some(
      (S) => x1 > S.x0 - 8 && x0 < S.x1 + 8 && z1 > S.z0 - 8 && z0 < S.z1 + 8,
    );
  // (round 7) elevated rail (Flushing-Line-like) on the median of the Queens arterial x = 1450
  const RAIL = { x: 1450, z0: -2450, z1: 640 };

  // (round 10) Liberty-like statue: fort walls (granite box ring), stepped pedestal, verdigris copper figure with a raised
  // torch arm. Exact collision boxes for the boxes; cylinders use the same collision cylinders as the water tanks.
  function libertyStatue() {
    const cx = -1545,
      cz = 3965,
      y = FAR_Y;
    g2.fillStyle = "#4c5a3c";
    g2.beginPath();
    FAR_LANDS.find((l) => l.name === "lib").pts.forEach(([x, z], i) =>
      i ? g2.lineTo(mx(x), mz(z)) : g2.moveTo(mx(x), mz(z)),
    );
    g2.closePath();
    g2.fill();
    const gran = (y0, y1) => ({
      ...steelP([0.62, 0.6, 0.56], y0, y1),
      layer: LAYER.GRANITE,
    });
    const cu = (y0, y1) => ({ ...steelP([0.34, 0.52, 0.46], y0, y1) });
    const bx = (a0, y0, b0, a1, y1, b1, P, k = "wall") => {
      FR.box(a0, y0, b0, a1, y1, b1, P, {}, true, false, P);
      solids?.box(a0, y0, b0, a1, y1, b1, k);
    };
    // fort: a square ring of 7 m walls with corner bastions
    const R = 34,
      t = 6,
      fh = 7;
    bx(cx - R, y, cz - R, cx + R, y + fh, cz - R + t, gran(y, y + fh));
    bx(cx - R, y, cz + R - t, cx + R, y + fh, cz + R, gran(y, y + fh));
    bx(cx - R, y, cz - R + t, cx - R + t, y + fh, cz + R - t, gran(y, y + fh));
    bx(cx + R - t, y, cz - R + t, cx + R, y + fh, cz + R - t, gran(y, y + fh));
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ])
      bx(
        cx + sx * R - 7,
        y,
        cz + sz * R - 7,
        cx + sx * R + 7,
        y + fh,
        cz + sz * R + 7,
        gran(y, y + fh),
      );
    bx(
      cx - R + t,
      y,
      cz - R + t,
      cx + R - t,
      y + fh - 0.4,
      cz + R - t,
      gran(y, y + fh),
      "roof",
    ); // fort terrace fill
    // pedestal: three stepped granite tiers
    let py = y + fh - 0.4;
    for (const [w, h] of [
      [26, 6],
      [19, 16],
      [16, 7],
    ]) {
      bx(
        cx - w / 2,
        py,
        cz - w / 2,
        cx + w / 2,
        py + h,
        cz + w / 2,
        gran(py, py + h),
      );
      py += h;
    }
    // figure: robe (tapered), shoulders, head, raised arm + torch, tablet
    FR.cyl(
      cx,
      cz,
      5.2,
      py,
      py + 24,
      12,
      cu(py, py + 24),
      STYLE.BLANK,
      true,
      3.4,
    );
    solids?.cyl(cx, cz, py, py + 24, 5.2, 3.4, "wall");
    const sy = py + 24;
    bx(cx - 3.6, sy, cz - 2.4, cx + 3.6, sy + 3, cz + 2.4, cu(sy, sy + 3));
    FR.cyl(
      cx,
      cz,
      1.7,
      sy + 3,
      sy + 7,
      10,
      cu(sy + 3, sy + 7),
      STYLE.BLANK,
      true,
      1.5,
    );
    solids?.cyl(cx, cz, sy + 3, sy + 7, 1.7, 1.5, "wall");
    bx(
      cx - 2.3,
      sy + 6.2,
      cz - 2.3,
      cx + 2.3,
      sy + 6.9,
      cz + 2.3,
      cu(sy + 6.2, sy + 6.9),
    ); // crown band
    bx(
      cx + 2.4,
      sy + 1.5,
      cz - 0.9,
      cx + 4.1,
      sy + 14,
      cz + 0.9,
      cu(sy + 1.5, sy + 14),
    ); // raised right arm (+x, toward the city... roughly SE facing)
    FR.cyl(
      cx + 3.25,
      cz,
      1.1,
      sy + 14,
      sy + 16.5,
      10,
      cu(sy + 14, sy + 16.5),
      STYLE.BLANK,
      true,
      1.5,
    );
    solids?.cyl(cx + 3.25, cz, sy + 14, sy + 16.5, 1.1, 1.5, "wall");
    FR.cyl(
      cx + 3.25,
      cz,
      1.0,
      sy + 16.5,
      sy + 18.2,
      8,
      { ...steelP([0.78, 0.62, 0.3], sy + 16.5, sy + 18.2) },
      STYLE.BLANK,
      true,
      0.3,
    );
    solids?.cyl(cx + 3.25, cz, sy + 16.5, sy + 18.2, 1.0, 0.3, "wall");
    bx(
      cx - 5.4,
      sy - 7,
      cz - 1.8,
      cx - 3.2,
      sy - 0.5,
      cz + 1.8,
      cu(sy - 7, sy - 0.5),
    ); // tablet arm
    // trees on the lawn around the fort
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2,
        r = 46 + rnd() * 14;
      const x = cx + Math.cos(a) * r,
        z = cz + Math.sin(a) * r;
      if (
        pointInPoly(FAR_LANDS.find((l) => l.name === "lib").pts, x, z) &&
        edgeDist(FAR_LANDS.find((l) => l.name === "lib").pts, x, z) > 5
      )
        canopy.add(x, FAR_Y, z, 2.6 + rnd() * 1.4, 0.3);
    }
  }
  for (const L of FAR_LANDS) {
    if (L.name === "lib") {
      libertyStatue();
      continue;
    }
    if (L.name === "roos") {
      // Roosevelt-like: a spine of residential slabs / towers along the island with a promenade
      curBase = FAR_Y;
      const rrnd = mulberry32(5150);
      for (let z = -1690; z < -470; ) {
        const len = 34 + rnd() * 40,
          [xa, xb] = [0, 1].map((k) => {
            // island x-extent at this z (tightest over the lot)
            let lo = -Infinity,
              hi = Infinity;
            for (const zz of [z, z + len]) {
              const xs = [];
              for (let i = 0; i < L.pts.length; i++) {
                const [ax, az] = L.pts[i],
                  [bx, bz] = L.pts[(i + 1) % L.pts.length];
                if (az > zz !== bz > zz)
                  xs.push(ax + ((bx - ax) * (zz - az)) / (bz - az));
              }
              if (xs.length >= 2) {
                lo = Math.max(lo, Math.min(...xs));
                hi = Math.min(hi, Math.max(...xs));
              }
            }
            return k ? hi : lo;
          });
        if (xb - xa > 40 && !inCorridor(xa, z, xb, z + len)) {
          const w = Math.min(xb - xa - 38, 20 + rnd() * 14),
            cx = (xa + xb) / 2 + (rnd() - 0.5) * 4;
          const tall = rnd() < 0.25; // (round 4) mostly 5-12 storey slabs like the real island, a few 12-18 storey
          // (round 11) critic: 'Roosevelt Island strip = a row of identical white boxes'. Varied lot types (own rng):
          // red-brick courtyard pairs, stepped towers, low wide blocks, and lawn gaps with tree clumps
          const q = rrnd(),
            room = xb - xa - 30;
          if (q < 0.18) {
            canopy.clump(
              cx,
              FAR_Y,
              z + len / 2,
              Math.max(8, room * 0.35),
              4 + Math.floor(rrnd() * 4),
              3.2,
              6,
              0.3,
            );
          } else if (q < 0.5 && room > 30) {
            // two offset brick slabs around a small court
            const sw = Math.min(14, room * 0.4),
              h1 = 20 + rrnd() * 22,
              bl = rrnd() < 0.6 ? LAYER.RED : LAYER.BROWN;
            nearBox(
              cx - room / 2,
              z,
              cx - room / 2 + sw,
              z + len * (0.7 + rrnd() * 0.3),
              h1,
              "mid",
              bl,
              false,
            );
            nearBox(
              cx + room / 2 - sw,
              z + len * rrnd() * 0.3,
              cx + room / 2,
              z + len,
              h1 * (0.7 + rrnd() * 0.5),
              "mid",
              rrnd() < 0.5 ? bl : LAYER.BUFF,
              false,
            );
          } else if (q < 0.72 || tall) {
            // stepped apartment tower on a low podium
            nearBox(
              cx - w / 2 - 3,
              z,
              cx + w / 2 + 3,
              z + len,
              5 + rrnd() * 4,
              "mid",
              LAYER.CONCRETE,
              false,
              true,
            );
            curBase = FAR_Y + 6;
            towerMass(
              (a0, b0, a1, b1, hh, lay, g, up) =>
                nearBox(a0, b0, a1, b1, hh, "tower", lay, g, up),
              cx,
              z + len / 2,
              w * 0.85,
              Math.min(len - 6, 26 + rrnd() * 10),
              34 + rrnd() * 34,
              [LAYER.BUFF, LAYER.CONCRETE, LAYER.BROWN, LAYER.LIME][
                Math.floor(rrnd() * 4)
              ],
              rrnd() < 0.2,
            );
            curBase = FAR_Y;
          } else
            nearBox(
              cx - w / 2 - 4,
              z,
              cx + w / 2 + 4,
              z + len,
              10 + rrnd() * 8,
              "mid",
              [LAYER.LIME, LAYER.BUFF, LAYER.RED, LAYER.GRANITE][
                Math.floor(rrnd() * 4)
              ],
              false,
            );
          rectPx(xa + 4, z - 6, xb - 4, z + len + 6, "#6c6a64");
        }
        z += len + 9 + rnd() * 20; // (round 12: denser, was 14 + 30 -- critic 'Roosevelt strip: blocky boxes on a lawn')
      }
      // (round 4) the island reads as land, not boxes in the river: lawns + a riverside promenade ring on the ground map,
      // tree rows along both esplanades and parkland clumps at the tips (Four-Freedoms-like south point, lighthouse north)
      g2.fillStyle = "#4b5638";
      g2.beginPath();
      L.pts.forEach(([x, z], i) =>
        i ? g2.lineTo(mx(x), mz(z)) : g2.moveTo(mx(x), mz(z)),
      );
      g2.closePath();
      g2.fill();
      g2.strokeStyle = "#64615a";
      g2.lineWidth = 6 / MAP.px;
      g2.stroke(); // (r13: darker esplanade ring)
      // (round 12) critic: 'a regular fringe of identical round trees lined up like beads'. Esplanade trees now come in
      // irregular groups (value-noise gaps), with jittered inset / spacing / crown size, a second inner row in places
      // and occasional clumps; own rng (5151)
      const ernd = mulberry32(5151);
      for (const side of [0, 1])
        for (let z = -1740 + ernd() * 8; z < -390; z += 6 + ernd() * 11) {
          let lo = Infinity,
            hi = -Infinity;
          for (let i = 0; i < L.pts.length; i++) {
            const [ax, az] = L.pts[i],
              [bx, bz] = L.pts[(i + 1) % L.pts.length];
            if (az > z !== bz > z) {
              const x = ax + ((bx - ax) * (z - az)) / (bz - az);
              lo = Math.min(lo, x);
              hi = Math.max(hi, x);
            }
          }
          if (!(hi - lo > 16)) continue;
          if (inCorridor(lo, z - 4, hi, z + 4)) continue;
          const gp = vn(z + side * 977, side * 311, 70, 41); // grove / gap field along the esplanade
          if (gp < 0.38 && !(z > -560 || z < -1640)) continue;
          const inset = 5 + ernd() * 6,
            x = side ? hi - inset : lo + inset;
          canopy.add(
            x + (ernd() - 0.5) * 2.5,
            FAR_Y,
            z + (ernd() - 0.5) * 3,
            2.4 + ernd() * 2.6 + (gp > 0.7 ? 1.2 : 0),
            0.3,
          );
          if (gp > 0.62 && ernd() < 0.55)
            canopy.add(
              x + (side ? -1 : 1) * (6 + ernd() * 4),
              FAR_Y,
              z + (ernd() - 0.5) * 6,
              2.2 + ernd() * 2.4,
              0.3,
            );
          if (side === 0 && (z > -560 || z < -1640) && ernd() < 0.6)
            canopy.clump(
              (lo + hi) / 2,
              FAR_Y,
              z,
              Math.max(4, (hi - lo) * 0.3),
              1 + Math.floor(ernd() * 3),
              3.2,
              6.5,
              0.3,
            );
        }
      // (r13) critic: 'Roosevelt Island: a hard vertical side wall into the water'. A broken riprap toe along the
      // seawall: dark schist boulders (1.5-4 m, jumbled heights) piled against the wall foot in runs with gaps, plus
      // a timber fender line in places; exact collision boxes. Own rng (5152).
      {
        const qr = mulberry32(5152);
        const rockP = { style: STYLE.BLANK, layer: LAYER.GRANITE, seed: 7 };
        for (let i = 0; i < L.pts.length; i++) {
          if (farCoastOwns(L.name, i)) continue; // (coast r1) riprap / seawall by waterfront.js
          const [ax, az] = L.pts[i],
            [bx2, bz2] = L.pts[(i + 1) % L.pts.length];
          const Lh = Math.hypot(bx2 - ax, bz2 - az),
            tx = (bx2 - ax) / Lh,
            tz = (bz2 - az) / Lh;
          let nx = tz,
            nz = -tx;
          if (
            pointInPoly(
              L.pts,
              ax + (tx * Lh) / 2 + nx * 3,
              az + (tz * Lh) / 2 + nz * 3,
            )
          ) {
            nx = -nx;
            nz = -nz;
          }
          for (let u = qr() * 3; u < Lh - 1; u += 1.6 + qr() * 2.2) {
            if (vn(ax + tx * u, az + tz * u, 45, 61) < 0.33) {
              u += 4;
              continue;
            } // gaps between the runs
            const s = 0.8 + qr() * 1.3,
              off = 0.3 + s + qr() * 1.6,
              px = ax + tx * u + nx * off,
              pz = az + tz * u + nz * off;
            const y1 = G.WATER_Y + 0.2 + qr() * (1.2 + s * 0.4),
              k = 0.22 + qr() * 0.12;
            const sz = s * (0.7 + qr() * 0.3);
            bulk.box(
              px - s,
              G.WATER_Y - 1.2,
              pz - sz,
              px + s,
              y1,
              pz + sz,
              { ...rockP, tint: [k, k * 0.97, k * 0.93] },
              {},
              true,
              false,
            );
            solids?.box(
              px - s,
              G.WATER_Y - 1.2,
              pz - sz,
              px + s,
              y1,
              pz + sz,
              "pier",
            );
          }
        }
      }
      continue;
    }
    const b = L.bb;
    const X0 = Math.max(b[0], -5800),
      X1 = Math.min(b[2], 5800),
      Z0 = Math.max(b[1], -7400),
      Z1 = Math.min(b[3], 8800);
    // iterate grid cells of the region's (piecewise) grid
    for (let zc = Z0; zc < Z1; ) {
      const gd = gridFor(L.name, zc);
      const pz = gd.lz + gd.st,
        rowZ0 = Math.floor((zc - gd.oz) / pz) * pz + gd.oz,
        rowZ1 = rowZ0 + pz;
      const px = gd.lx + gd.st;
      for (
        let xc = Math.floor((X0 - gd.ox) / px) * px + gd.ox;
        xc < X1;
        xc += px
      ) {
        let x0 = xc + gd.st / 2,
          x1 = xc + px - gd.st / 2,
          z0 = rowZ0 + gd.st / 2,
          z1 = rowZ1 - gd.st / 2;
        let cx = (x0 + x1) / 2,
          cz = (z0 + z1) / 2;
        const dI = islandDist(cx, cz);
        if (dI > FAR + 1500) continue;
        if (
          !onFar(
            L,
            x0 - gd.st / 2,
            z0 - gd.st / 2,
            x1 + gd.st / 2,
            z1 + gd.st / 2,
          )
        )
          continue;
        const dW = edgeDist(L.pts, cx, cz);
        if (dW < 35) continue;
        {
          // blocks sit either fully on the Palisades plateau or fully below it (none straddle the cliff)
          const pc = [
            [x0 - 8, z0 - 8],
            [x1 + 8, z0 - 8],
            [x1 + 8, z1 + 8],
            [x0 - 8, z1 + 8],
          ].map(([x, z]) => L.name === "nj" && inPalisades(x, z));
          if (pc.some((v) => v !== pc[0])) {
            rectPx(x0 - 6, z0 - 6, x1 + 6, z1 + 6, "#556048");
            continue;
          } // wooded cliff edge
          curBase = pc[0] ? PAL_Y : FAR_Y;
        }
        if (L.name === "nj" || L.name === "east") {
          // (round 6) arterial boulevards: blocks step back from them
          const ax = artX(cx),
            az = artZ(cz);
          if (x1 > ax - ART_H && x0 < ax + ART_H) {
            if (cx < ax) x1 = ax - ART_H;
            else x0 = ax + ART_H;
          }
          if (z1 > az - ART_H && z0 < az + ART_H) {
            if (cz < az) z1 = az - ART_H;
            else z0 = az + ART_H;
          }
          if (x1 - x0 < 30 || z1 - z0 < 30) continue;
          cx = (x0 + x1) / 2;
          cz = (z0 + z1) / 2;
        }
        // ---- zone
        let cl = null;
        for (const C of FAR_CLUSTERS)
          if (Math.hypot(cx - C.x, cz - C.z) < C.r) {
            cl = C;
            break;
          }
        const nPark = hash2(Math.floor(cx / 420) + 7, Math.floor(cz / 420) - 3),
          r0 = rnd();
        let zone = "row";
        if (L.name === "gov") zone = r0 < 0.5 ? "park" : "mid";
        else if (
          cl &&
          r0 <
            (0.75 * (1 - Math.hypot(cx - cl.x, cz - cl.z) / cl.r) + 0.2) *
              (cl.dens ?? 1)
        )
          zone = "tower";
        else if (
          L.name === "nj" &&
          curBase === FAR_Y &&
          dW < 430 &&
          cz > -1800 &&
          cz < 3000 &&
          r0 < 0.22
        ) {
          zone = "tower";
          cl = GOLD;
        } // (round 12: 0.34 -> 0.22, a lower waterfront with fewer same-height slabs)
        else if (
          nPark > (dI > NEAR ? 0.85 : 0.9) &&
          !(L.name === "nj" && curBase === PAL_Y && cliffDist(cx, cz) < 900)
        )
          zone = "park"; // (round 11) more green patches in the massed band; (r13) never on the Palisades brow facing Manhattan (critic: 'flat light patch with a fine grid'), that is built up
        else if (
          L.name === "nj" &&
          curBase === FAR_Y &&
          dW < 300 &&
          cz > -3200 &&
          cz < 700 &&
          r0 < 0.7
        )
          zone = r0 < 0.08 ? "park" : "mid"; // (round 11) Port-Imperial-like condo rows under the cliffs (the strip read as empty paving)
        else if (dW < 300 && r0 < 0.55) zone = r0 < 0.12 ? "park" : "ind";
        else if (
          L.name === "nj" &&
          curBase === PAL_Y &&
          cliffDist(cx, cz) < 420 &&
          r0 < 0.8
        )
          zone = "cliff"; // towers along the cliff top (round 4: deeper band, more)
        else if (r0 < 0.05) zone = "proj";
        else if (r0 < 0.3 || (L.name === "nj" && r0 < 0.38)) zone = "mid";
        else if (r0 < 0.4) zone = "ind";
        // (round 12) large far-shore parks (critic: 'far shores: no hierarchy, no green'): Prospect-Park-like (Brooklyn),
        // Sunnyside-Gardens / Calvary-like (Queens), Lincoln-Park-like (Jersey City): every block inside becomes park
        if (
          FAR_PARKS.some(
            (P) => cx > P[0] && cx < P[2] && cz > P[1] && cz < P[3],
          )
        )
          zone = "park";
        const sig = zone === "park" ? null : sigIn(x0, z0, x1, z1);
        if (sig) {
          zone = "tower";
          cl = cl ?? GOLD;
        }
        // ---- ground map: asphalt ring (streets), sidewalk, yard / lot interior
        const s = gd.st / 2;
        rectPx(x0 - s, z0 - s, x1 + s, z1 + s, "#3f4043");
        rectPx(x0, z0, x1, z1, "#5f5c56"); // (r14) critic: 'pale, almost untextured ground'. Sidewalks / lots darker (was #76736c)
        const yard = {
          row: "#44463a",
          mid: "#4d4c46",
          ind: "#4a4947",
          tower: "#55534e",
          proj: "#46513a",
          park: "#46563a",
        }[zone];
        rectPx(x0 + 3, z0 + 3, x1 - 3, z1 - 3, yard);
        // (r13) cell parks (nPark) are one park too: no streets / kerb rings through them, so they stop reading as a grid
        const bigP =
          zone === "park" &&
          (FAR_PARKS.some(
            (P) => cx > P[0] && cx < P[2] && cz > P[1] && cz < P[3],
          ) ||
            nPark > (dI > NEAR ? 0.85 : 0.9));
        if (bigP)
          rectPx(
            x0 - s - 1,
            z0 - s - 1,
            x1 + s + 1,
            z1 + s + 1,
            hash2(Math.floor(cx / 60), Math.floor(cz / 60)) < 0.5
              ? "#46563a"
              : "#4d5c3d",
          ); // (round 12) big park: no streets inside
        for (const S of SITES) {
          // (round 7) landmark site: clip the block to its largest part beside the site (or drop it)
          if (
            !(x1 > S.x0 - 8 && x0 < S.x1 + 8 && z1 > S.z0 - 8 && z0 < S.z1 + 8)
          )
            continue;
          const opts = [
            [x0, z0, x1, S.z0 - 10],
            [x0, S.z1 + 10, x1, z1],
            [x0, z0, S.x0 - 10, z1],
            [S.x1 + 10, z0, x1, z1],
          ]
            .filter(([a, b, c, d]) => c - a >= 30 && d - b >= 30)
            .sort(
              (P, Q) =>
                (Q[2] - Q[0]) * (Q[3] - Q[1]) - (P[2] - P[0]) * (P[3] - P[1]),
            );
          if (!opts.length) {
            x1 = x0;
            break;
          }
          [x0, z0, x1, z1] = opts[0];
          cx = (x0 + x1) / 2;
          cz = (z0 + z1) / 2;
        }
        if (x1 - x0 < 30) {
          rectPx(x0 + 3, z0 + 3, x1 - 3, z1 - 3, "#4b4a45");
          continue;
        }
        {
          // bridge approach corridor: keep the part of the block beside the ramp instead of dropping the whole block
          const cor = corridors.find(
            (c) => x1 > c[0] && x0 < c[2] && z1 > c[1] && z0 < c[3],
          );
          if (cor) {
            const nA = cor[1] - 3 - z0,
              nB = z1 - cor[3] - 3;
            if (Math.max(nA, nB) < 24) continue;
            if (nA >= nB) z1 = cor[1] - 3;
            else z0 = cor[3] + 3;
            cx = (x0 + x1) / 2;
            cz = (z0 + z1) / 2;
          }
        }
        if (zone === "park") {
          // trees in clumps around a lawn, a loop path
          g2.strokeStyle = "#7d7a70";
          g2.lineWidth = 0.8;
          if (!bigP) {
            g2.beginPath();
            g2.ellipse(
              mx(cx),
              mz(cz),
              ((x1 - x0) * 0.3) / MAP.px,
              ((z1 - z0) * 0.3) / MAP.px,
              0,
              0,
              Math.PI * 2,
            );
            g2.stroke();
          }
          if (dI < FAR + 800) {
            // (round 4) wooded park: dense groves with a smaller open lawn, edge rows along the park streets
            const nC = Math.round(
              ((x1 - x0) * (z1 - z0)) /
                (dI < 2000 ? 950 : dI < 3200 ? 1700 : 2600),
            );
            for (let i = 0; i < nC; i++) {
              const tx = x0 + 6 + rnd() * (x1 - x0 - 12),
                tz = z0 + 6 + rnd() * (z1 - z0 - 12);
              if (bigP) {
                if (vn(tx, tz, 170, 57) > 0.56 && rnd() < 0.9) continue;
              } // (r13) park-scale meadows / woods (no per-block lawn grid)
              else if (
                ((tx - cx) / ((x1 - x0) * 0.2)) ** 2 +
                  ((tz - cz) / ((z1 - z0) * 0.2)) ** 2 <
                  1 &&
                rnd() < 0.85
              )
                continue; // central lawn
              canopy.clump(
                tx,
                curBase,
                tz,
                8,
                2 + Math.floor(rnd() * 4),
                3.2,
                7,
                0.3,
              );
            }
            if (dI < 2200 && !bigP)
              for (const [a0, b0, a1, b1] of [
                [x0 + 3, z0 + 3, x1 - 3, z0 + 3],
                [x0 + 3, z1 - 3, x1 - 3, z1 - 3],
                [x0 + 3, z0 + 3, x0 + 3, z1 - 3],
                [x1 - 3, z0 + 3, x1 - 3, z1 - 3],
              ]) {
                const L2 = Math.hypot(a1 - a0, b1 - b0);
                for (let u = 4; u < L2; u += 9 + rnd() * 4)
                  canopy.add(
                    a0 + ((a1 - a0) * u) / L2,
                    curBase,
                    b0 + ((b1 - b0) * u) / L2,
                    2.8 + rnd() * 1.5,
                    0.3,
                  );
              }
          }
          continue;
        }
        if (dI > FAR) continue; // ground map only
        const near = dI < NEAR;
        const alongZ = z1 - z0 > x1 - x0;
        if (
          near &&
          (zone === "row" || zone === "mid") &&
          rnd() < (zone === "mid" ? 0.1 : 0.06) &&
          !inCorridor(x0, z0, x1, z1)
        ) {
          // (round 5) scattered 12-30 storey towers: skyline hierarchy
          const tw = Math.min(x1 - x0 - 8, 20 + rnd() * 10),
            td = Math.min(z1 - z0 - 8, 22 + rnd() * 14),
            tcx = x0 + 4 + tw / 2 + rnd() * (x1 - x0 - 8 - tw),
            tcz = z0 + 4 + td / 2 + rnd() * (z1 - z0 - 8 - td);
          if (tw > 12 && td > 12)
            towerMass(
              (a0, b0, a1, b1, hh, lay, g, up) =>
                nearBox(a0, b0, a1, b1, hh, "tower", lay, g, up),
              tcx,
              tcz,
              tw,
              td,
              40 + rnd() * rnd() * 60,
              LAY_MID[Math.floor(rnd() * LAY_MID.length)],
              rnd() < 0.25,
            );
          continue;
        }
        if (near && zone === "row" && rnd() < 0.07) {
          // a post-war apartment slab replacing part of the row
          const h = 28 + rnd() * 30,
            lay = LAY_MID[Math.floor(rnd() * LAY_MID.length)];
          if (alongZ)
            nearBox(
              x0 + 2,
              z0 + 2,
              x0 + 22,
              z0 + 2 + Math.min(70, (z1 - z0) * 0.5),
              h,
              "mid",
              lay,
            );
          else
            nearBox(
              x0 + 2,
              z0 + 2,
              x0 + 2 + Math.min(70, (x1 - x0) * 0.5),
              z0 + 22,
              h,
              "mid",
              lay,
            );
          if (alongZ) {
            z0 += Math.min(70, (z1 - z0) * 0.5) + 2;
          } else {
            x0 += Math.min(70, (x1 - x0) * 0.5) + 2;
          }
        }
        // ---- buildings
        if (!near) {
          // massed: 1-3 boxes per block
          if (zone === "tower" && cl) {
            const fat = vrnd() < 0.35; // (round 10) broad slabs / squat towers among the shafts
            const h =
                (cl.h[0] + rnd() * rnd() * (cl.h[1] - cl.h[0]) * 1.2) *
                (fat ? 0.55 + vrnd() * 0.3 : 0.8 + vrnd() * 0.45),
              w = Math.min(
                x1 - x0 - 14,
                fat ? 40 + vrnd() * 24 : 18 + rnd() * 22,
              ),
              dd = Math.min(
                z1 - z0 - 14,
                fat ? 40 + vrnd() * 30 : 18 + rnd() * 26,
              ),
              gl = rnd() < cl.glass;
            farBox(
              x0 + 2,
              z0 + 2,
              x1 - 2,
              z1 - 2,
              12 + rnd() * 8,
              LAY_MID[Math.floor(rnd() * LAY_MID.length)],
            );
            const pb = curBase;
            curBase += 10;
            towerMass(
              (a0, b0, a1, b1, hh, lay, g) =>
                farBox(a0, b0, a1, b1, hh, lay, g),
              cx + (rnd() - 0.5) * 10,
              cz + (rnd() - 0.5) * 10,
              w,
              dd,
              Math.min(h, cl.h[1]) - 10,
              gl ? LAYER.CONCRETE : LAY_MID[Math.floor(rnd() * LAY_MID.length)],
              gl,
            );
            curBase = pb;
          } else if (zone === "ind") {
            farBox(
              x0 + 4,
              z0 + 4,
              x1 - 4 - rnd() * 20,
              z1 - 4 - rnd() * 20,
              7 + rnd() * 7,
              rnd() < 0.5 ? LAYER.CONCRETE : LAYER.BUFF,
            );
          } else {
            const hB =
              (zone === "row"
                ? 10 + rnd() * 7
                : zone === "proj"
                  ? 38 + rnd() * 25
                  : 16 + rnd() * 22) * (zone === "proj" ? 1 : hoodH(cx, cz)); // (round 11) quarter heights
            const lay = (zone === "row" ? LAY_ROW : LAY_MID)[
              Math.floor(rnd() * 7) %
                (zone === "row" ? LAY_ROW.length : LAY_MID.length)
            ];
            if (zone === "proj") {
              farBox(x0 + 12, cz - 9, x1 - 12, cz + 9, hB, LAYER.RED);
              continue;
            }
            // (round 4) scattered 15-30 storey mid-rises break the flat massed band (skyline rhythm across the river)
            if (rnd() < (zone === "mid" ? 0.14 : 0.05)) {
              const tw = 16 + rnd() * 12,
                td = 18 + rnd() * 16,
                th = 45 + rnd() * rnd() * 70;
              farBox(
                cx - tw / 2,
                cz - td / 2,
                cx + tw / 2,
                cz + td / 2,
                th,
                LAY_MID[Math.floor(rnd() * LAY_MID.length)],
                rnd() < 0.2,
              );
            }
            const d = 16;
            // each side strip in 2-5 segments of their own height / colour (no long uniform 'shelves')
            const seg = (a0, a1, fn) => {
              let a = a0;
              while (a < a1 - 4) {
                let l = 25 + rnd() * 45;
                if (a1 - a - l < 15) l = a1 - a;
                fn(
                  a,
                  Math.min(a1, a + l),
                  hB * (0.65 + rnd() * 0.7) +
                    (rnd() < 0.1 ? 15 + rnd() * 20 : 0),
                  hoodLay(zone === "row" ? LAY_ROW : LAY_MID, cx, cz),
                );
                a += l + (rnd() < 0.3 ? 3 : 0);
              }
            };
            if (alongZ) {
              seg(z0 + 1, z1 - 1, (a, b2, h, l) =>
                farBox(x0 + 1, a, x0 + d, b2, h, l),
              );
              seg(z0 + 1, z1 - 1, (a, b2, h, l) =>
                farBox(x1 - d, a, x1 - 1, b2, h, l),
              );
            } else {
              seg(x0 + 1, x1 - 1, (a, b2, h, l) =>
                farBox(a, z0 + 1, b2, z0 + d, h, l),
              );
              seg(x0 + 1, x1 - 1, (a, b2, h, l) =>
                farBox(a, z1 - d, b2, z1 - 1, h, l),
              );
            }
            // (r14) critic: 'far boroughs: no trees, pale ground'. Denser back-yard canopy, now also in the mid-rise blocks
            if (dI < 3900) {
              const per = (dI < 3000 ? 300 : 470) * (zone === "row" ? 1 : 1.7);
              if (alongZ)
                yardTrees(x0 + d + 2, z0 + 3, x1 - d - 2, z1 - 3, per);
              else yardTrees(x0 + 3, z0 + d + 2, x1 - 3, z1 - d - 2, per);
            }
            void lay;
          }
          continue;
        }
        if (zone === "tower" && cl) {
          const podH = 10 + rnd() * 12,
            lay = LAY_MID[Math.floor(rnd() * LAY_MID.length)];
          nearBox(x0 + 4, z0 + 4, x1 - 4, z1 - 4, podH, "mid", lay);
          // (round 10) street trees round the tower blocks (foliage between the towers; critic: 'stamped silhouette card')
          for (const [a0, b0, a1, b1] of [
            [x0 + 1.8, z0 + 1.8, x1 - 1.8, z0 + 1.8],
            [x0 + 1.8, z1 - 1.8, x1 - 1.8, z1 - 1.8],
            [x0 + 1.8, z0 + 1.8, x0 + 1.8, z1 - 1.8],
            [x1 - 1.8, z0 + 1.8, x1 - 1.8, z1 - 1.8],
          ]) {
            const Ls = Math.hypot(a1 - a0, b1 - b0),
              nn = Math.floor(Ls / 11);
            for (let i = 1; i < nn; i++)
              if (vrnd() < 0.8)
                canopy.add(
                  a0 + ((a1 - a0) * i) / nn,
                  curBase,
                  b0 + ((b1 - b0) * i) / nn,
                  2.4 + vrnd() * 1.3,
                  0.3,
                );
          }
          // (round 10) varied massing: 1-2 towers, or a single broad slab / fat tower (not always twin thin shafts)
          const fat = vrnd() < 0.35;
          const nT =
            !sig && !fat && alongZ && z1 - z0 > 120 && vrnd() < 0.6 ? 2 : 1;
          for (let t = 0; t < nT; t++) {
            let h =
                (cl.h[0] + rnd() * rnd() * (cl.h[1] - cl.h[0]) * 1.3) *
                (fat ? 0.55 + vrnd() * 0.3 : 0.8 + vrnd() * 0.45),
              w = Math.min(
                x1 - x0 - 20,
                fat ? 44 + vrnd() * 26 : 20 + rnd() * 22,
              ),
              dd = Math.min(
                z1 - z0 - 20,
                fat ? 48 + vrnd() * 40 : 22 + rnd() * 24,
              );
            const tcz = nT === 2 ? (t ? z1 - 8 - dd / 2 : z0 + 8 + dd / 2) : cz,
              tcx = cx + (rnd() - 0.5) * 8;
            let gl = rnd() < cl.glass,
              tl = gl
                ? LAYER.METAL
                : LAY_MID[Math.floor(rnd() * LAY_MID.length)];
            if (sig) {
              // signature tower: slender, tall, its own material; a crown step on the stone ones
              h = sig.h;
              gl = sig.glass;
              tl = sig.lay;
              w = Math.min(x1 - x0 - 20, 34);
              dd = Math.min(z1 - z0 - 20, 40);
              nearBox(
                tcx - w / 2,
                tcz - dd / 2,
                tcx + w / 2,
                tcz + dd / 2,
                h * (gl ? 0.86 : 0.8),
                "tower",
                tl,
                gl,
                true,
              );
              const sb = curBase;
              curBase += h * (gl ? 0.86 : 0.8);
              nearBox(
                tcx - w * 0.36,
                tcz - dd * 0.36,
                tcx + w * 0.36,
                tcz + dd * 0.36,
                h * (gl ? 0.14 : 0.2),
                "tower",
                tl,
                gl,
              );
              curBase = sb;
              continue;
            }
            towerMass(
              (a0, b0, a1, b1, hh, lay, g, up) =>
                nearBox(a0, b0, a1, b1, hh, "tower", lay, g, up),
              tcx,
              tcz,
              w,
              dd,
              Math.min(h, cl.h[1]),
              tl,
              gl,
            );
            if (!gl && h > 90 && rnd() < 0.3) {
              // setback crown
              const sw = w * 0.7,
                sd = dd * 0.7;
              nearBox(
                tcx - sw / 2,
                tcz - sd / 2,
                tcx + sw / 2,
                tcz + sd / 2,
                Math.min(h, cl.h[1]) + 8 + rnd() * 10,
                "tower",
                LAYER.LIME,
              );
            }
          }
        } else if (zone === "ind" && dW < 260 && rnd() < 0.45) {
          containerYard(x0, z0, x1, z1, cx, cz, L, dW);
        } else if (zone === "ind") {
          const n = rnd() < 0.5 ? 1 : 2,
            lay =
              rnd() < 0.5
                ? LAYER.CONCRETE
                : rnd() < 0.5
                  ? LAYER.BUFF
                  : LAYER.RED;
          if (n === 1)
            nearBox(
              x0 + 3,
              z0 + 3,
              x1 - 3 - rnd() * 15,
              z1 - 3 - rnd() * 30,
              7 + rnd() * 8,
              "ind",
              lay,
            );
          else if (alongZ) {
            const zm = z0 + (z1 - z0) * (0.35 + rnd() * 0.3);
            nearBox(x0 + 3, z0 + 3, x1 - 3, zm - 4, 7 + rnd() * 8, "ind", lay);
            nearBox(
              x0 + 3,
              zm + 4,
              x1 - 3,
              z1 - 3,
              6 + rnd() * 10,
              "ind",
              LAYER.CONCRETE,
            );
          } else {
            const xm = x0 + (x1 - x0) * (0.35 + rnd() * 0.3);
            nearBox(x0 + 3, z0 + 3, xm - 4, z1 - 3, 7 + rnd() * 8, "ind", lay);
            nearBox(
              xm + 4,
              z0 + 3,
              x1 - 3,
              z1 - 3,
              6 + rnd() * 10,
              "ind",
              LAYER.CONCRETE,
            );
          }
          // water tank / silo on some industrial lots
          if (rnd() < 0.2) {
            const r = 5 + rnd() * 5,
              sh = 10 + rnd() * 14;
            F.cyl(
              x1 - 4 - r,
              z1 - 4 - r,
              r,
              curBase,
              curBase + sh,
              12,
              {
                style: STYLE.BLANK,
                layer: LAYER.CONCRETE,
                tint: [0.75, 0.74, 0.72],
                seed: 1,
              },
              STYLE.BLANK,
              true,
            );
            solids?.cyl(
              x1 - 4 - r,
              z1 - 4 - r,
              curBase,
              curBase + sh,
              r,
              r,
              "roof",
            );
          }
        } else if (zone === "cliff") {
          // Palisades-top apartment towers facing Manhattan + a lower wing
          const w = 24 + rnd() * 14,
            dd = 30 + rnd() * 40,
            tx0 = x1 - 6 - w;
          nearBox(
            tx0,
            cz - dd / 2,
            tx0 + w,
            cz + dd / 2,
            50 + rnd() * rnd() * 110,
            "mid",
            rnd() < 0.5
              ? LAYER.WHITE
              : LAY_MID[Math.floor(rnd() * LAY_MID.length)],
            rnd() < 0.25,
          );
          nearBox(
            x0 + 4,
            z0 + 4,
            tx0 - 8,
            z1 - 4,
            10 + rnd() * 10,
            "mid",
            LAY_MID[Math.floor(rnd() * LAY_MID.length)],
          );
        } else if (zone === "proj") {
          // housing project slabs on a lawn
          const n = 2,
            lay = LAYER.RED;
          for (let t = 0; t < n; t++) {
            if (alongZ) {
              const zz = z0 + ((z1 - z0) * (t + 0.5)) / n;
              nearBox(
                cx - 9,
                zz - 28,
                cx + 9,
                zz + 28,
                36 + rnd() * 24,
                "mid",
                lay,
              );
            } else {
              const xx = x0 + ((x1 - x0) * (t + 0.5)) / n;
              nearBox(
                xx - 28,
                cz - 9,
                xx + 28,
                cz + 9,
                36 + rnd() * 24,
                "mid",
                lay,
              );
            }
          }
        } else {
          // perimeter block: attached buildings along both long sides (and short ends), yard in the middle
          const midZ = zone === "mid";
          const d = midZ ? 20 + rnd() * 6 : 13 + rnd() * 5;
          const base =
            (midZ ? 18 + rnd() * 20 : 10 + rnd() * 5) *
            (L.name === "nj" && curBase === FAR_Y && cz < 1200 ? 1.6 : 1) *
            Math.min(2.1, hoodH(cx, cz)); // (round 11) quarter heights
          const lays = midZ ? LAY_MID : LAY_ROW;
          const runs = (a0, a1, fn) => {
            // split [a0,a1] into lots of 8..40 m with their own height/material
            let a = a0;
            while (a < a1 - 2) {
              let len = midZ ? 14 + rnd() * 30 : 8 + rnd() * 26;
              if (a1 - (a + len) < 8) len = a1 - a;
              const h = Math.max(
                6,
                base * (0.7 + rnd() * 0.6) +
                  (rnd() < 0.14 ? 10 + rnd() * 26 : 0),
              );
              fn(a, a + len, h, hoodLay(lays, cx, cz));
              a += len;
            }
          };
          if (alongZ) {
            runs(z0 + 1, z1 - 1, (a, b2, h, l) =>
              nearBox(x0 + 1, a, x0 + d, b2, h, zone, l),
            );
            runs(z0 + 1, z1 - 1, (a, b2, h, l) =>
              nearBox(x1 - d, a, x1 - 1, b2, h, zone, l),
            );
            if (x1 - x0 - 2 * d > 12) {
              nearBox(
                x0 + d,
                z0 + 1,
                x1 - d,
                z0 + d * 0.8,
                base,
                zone,
                lays[0],
              );
              nearBox(
                x0 + d,
                z1 - d * 0.8,
                x1 - d,
                z1 - 1,
                base * 0.9,
                zone,
                lays[1],
              );
            }
          } else {
            runs(x0 + 1, x1 - 1, (a, b2, h, l) =>
              nearBox(a, z0 + 1, b2, z0 + d, h, zone, l),
            );
            runs(x0 + 1, x1 - 1, (a, b2, h, l) =>
              nearBox(a, z1 - d, b2, z1 - 1, h, zone, l),
            );
            if (z1 - z0 - 2 * d > 12) {
              nearBox(
                x0 + 1,
                z0 + d,
                x0 + d * 0.8,
                z1 - d,
                base,
                zone,
                lays[0],
              );
              nearBox(
                x1 - d * 0.8,
                z0 + d,
                x1 - 1,
                z1 - d,
                base * 0.9,
                zone,
                lays[1],
              );
            }
          }
          // (round 9) scattered slender 14-38 storey apartment towers rising out of the courtyards (NYCHA / new-build
          // rentals), so the Brooklyn / Queens carpet gets a mid-rise layer instead of a uniform mat. Own rng.
          if (
            trnd() < (midZ ? 0.075 : 0.03) &&
            x1 - x0 - 2 * d > 26 &&
            z1 - z0 - 2 * d > 26
          ) {
            const tw = 17 + trnd() * 9,
              td = 20 + trnd() * 14,
              th = 44 + trnd() * trnd() * 80,
              tcx = cx + (trnd() - 0.5) * 8,
              tcz = cz + (trnd() - 0.5) * 8;
            towerMassT(
              (a0, b0, a1, b1, hh, lay, g, up) =>
                nearBox(a0, b0, a1, b1, hh, "mid", lay, g, up),
              tcx,
              tcz,
              tw,
              td,
              th,
              trnd() < 0.5
                ? LAYER.RED
                : LAY_MID[Math.floor(trnd() * LAY_MID.length)],
              trnd() < 0.2,
            );
          } else
            yardTrees(
              x0 + d + 2,
              z0 + d + 2,
              x1 - d - 2,
              z1 - d - 2,
              zone === "row" ? 120 : 260,
            );
        }
      }
      zc = rowZ1;
    }
  }

  // ---- (round 7) landmark sites + elevated rail (exact collision boxes / cylinders)
  curBase = FAR_Y;
  for (const S of SITES) {
    const y = FAR_Y,
      W = S.x1 - S.x0,
      D = S.z1 - S.z0;
    rectPx(S.x0, S.z0, S.x1, S.z1, "#4b4a45");
    const cylP = (tint) => ({
      style: STYLE.BLANK,
      layer: LAYER.CONCRETE,
      tint,
      seed: 7,
    });
    if (S.kind === "power") {
      // turbine hall + taller boiler house (long axis z), a lower annex, transformer yard, 4 banded stacks in a row
      nearBox(
        S.x0 + 8,
        S.z0 + 30,
        S.x0 + 70,
        S.z1 - 30,
        30,
        "ind",
        LAYER.RED,
        false,
        true,
      );
      nearBox(
        S.x0 + 70,
        S.z0 + 40,
        S.x0 + 112,
        S.z1 - 40,
        44,
        "ind",
        LAYER.BROWN,
        false,
        true,
      );
      nearBox(
        S.x0 + 8,
        S.z0 + 6,
        S.x0 + 60,
        S.z0 + 26,
        14,
        "ind",
        LAYER.CONCRETE,
        false,
        true,
      );
      for (let i = 0; i < 12; i++) {
        const tx = S.x0 + 14 + (i % 6) * 8,
          tz = S.z1 - 24 + Math.floor(i / 6) * 9;
        sbox(tx, y, tz, tx + 4, y + 4.5, tz + 3.2, [0.46, 0.47, 0.46]);
      }
      const RED = [0.56, 0.2, 0.15],
        WHITE = [0.8, 0.79, 0.76];
      for (let k = 0; k < 4; k++) {
        const cx = S.x1 - 13,
          cz = S.z0 + 45 + (k * (D - 90)) / 3,
          H = 148 + (k % 2) * 6,
          r0 = 5.6,
          r1 = 4.1,
          nB = 10;
        for (let b = 0; b < nB; b++) {
          const ya = y + (H * b) / nB,
            yb = y + (H * (b + 1)) / nB,
            ra = r0 + ((r1 - r0) * b) / nB,
            rb = r0 + ((r1 - r0) * (b + 1)) / nB;
          F.cyl(
            cx,
            cz,
            ra,
            ya,
            yb,
            14,
            cylP(
              b >= nB - 3
                ? b % 2
                  ? WHITE
                  : RED
                : b % 2
                  ? [0.7, 0.66, 0.6]
                  : [0.62, 0.3, 0.24],
            ),
            STYLE.BLANK,
            b === nB - 1,
            rb,
          );
        }
        solids?.cyl(cx, cz, y, y + H, r0, r1, "pole");
      }
      continue;
    }
    if (S.kind === "build") {
      // (r14) high-rise under construction + tower crane (exact collision boxes)
      const cx = (S.x0 + S.x1) / 2,
        cz = (S.z0 + S.z1) / 2,
        hw = Math.min(W, D) / 2 - 4,
        H = S.h,
        done = H * (0.35 + rnd() * 0.2);
      rectPx(S.x0, S.z0, S.x1, S.z1, "#57544c");
      curBase = y; // clad lower part (glass curtain wall) ...
      nearBox(
        cx - hw,
        cz - hw,
        cx + hw,
        cz + hw,
        done,
        "tower",
        LAYER.METAL,
        true,
        true,
      );
      const core = [0.56, 0.55, 0.52],
        slab = [0.5, 0.49, 0.47],
        col = [0.44, 0.43, 0.41];
      sbox(cx - 6, y + done, cz - 6, cx + 6, y + H + 6, cz + 6, core, "wall"); // ... concrete core above it
      for (let fy = y + done + 4.2; fy < y + H; fy += 4.2) {
        // open floor slabs + perimeter columns
        sbox(cx - hw, fy - 0.45, cz - hw, cx + hw, fy, cz + hw, slab, "roof");
        if (fy + 4.2 < y + H)
          for (const [px, pz] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ]) {
            const ax = cx + px * (hw - 0.8),
              az = cz + pz * (hw - 0.8);
            sbox(
              ax - 0.5,
              fy,
              az - 0.5,
              ax + 0.5,
              fy + 3.75,
              az + 0.5,
              col,
              "pole",
            );
          }
      }
      // tower crane on the side: lattice mast (a slim box at this range), slewing cab, jib + counter-jib, counterweight, cat head
      const yel = [0.66, 0.5, 0.14],
        mx0 = cx + hw + 2.5,
        mz0 = cz - 1.2,
        top = y + H + 22,
        dirZ = rnd() < 0.5 ? 1 : -1;
      sbox(mx0, y, mz0, mx0 + 2.4, top, mz0 + 2.4, yel, "pole");
      sbox(
        mx0 - 0.6,
        top,
        mz0 - 0.6,
        mx0 + 3,
        top + 3.2,
        mz0 + 3,
        [0.6, 0.58, 0.55],
        "equipment",
      );
      const jz = mz0 + 1.2,
        jy = top + 3.2;
      if (dirZ > 0)
        sbox(
          mx0 + 0.2,
          jy,
          jz - 18,
          mx0 + 2.2,
          jy + 2.2,
          jz + 58,
          yel,
          "ledge",
        );
      else
        sbox(
          mx0 + 0.2,
          jy,
          jz - 58,
          mx0 + 2.2,
          jy + 2.2,
          jz + 18,
          yel,
          "ledge",
        );
      sbox(
        mx0 - 0.3,
        jy - 3.2,
        jz - dirZ * 16 - 2,
        mx0 + 2.7,
        jy + 0.2,
        jz - dirZ * 16 + 2,
        [0.46, 0.45, 0.43],
        "equipment",
      ); // counterweight
      sbox(
        mx0 + 0.6,
        jy + 2.2,
        jz - 0.6,
        mx0 + 1.8,
        jy + 10,
        jz + 0.6,
        yel,
        "pole",
      ); // cat head
      continue;
    }
    if (S.kind === "port") {
      containerYard(
        S.x0,
        S.z0,
        S.x1,
        S.z1,
        (S.x0 + S.x1) / 2,
        (S.z0 + S.z1) / 2,
        nearLand((S.x0 + S.x1) / 2, (S.z0 + S.z1) / 2),
        0,
        5,
      );
      continue;
    }
    // tank farm: rows of squat storage tanks (pale / grey / a few rusty), each in its dark earthen dike
    const TK = [
      [0.6, 0.59, 0.56],
      [0.54, 0.54, 0.52],
      [0.48, 0.48, 0.47],
      [0.5, 0.4, 0.31],
      [0.64, 0.63, 0.6],
    ]; // (r14: darker, the white discs popped out of the haze)
    for (let zz = S.z0 + 14; zz < S.z1 - 14; ) {
      const r = 11 + rnd() * 9;
      if (zz + 2 * r > S.z1 - 8) break;
      for (
        let xx = S.x0 + 12;
        xx + 2 * r < S.x1 - 8;
        xx += 2 * r + 12 + rnd() * 6
      ) {
        if (rnd() < 0.12) continue;
        const cx = xx + r,
          cz = zz + r,
          h = 10 + rnd() * 8;
        rectPx(cx - r - 5, cz - r - 5, cx + r + 5, cz + r + 5, "#4a4943");
        F.cyl(
          cx,
          cz,
          r,
          y,
          y + h,
          20,
          cylP(TK[Math.floor(rnd() * TK.length)]),
          STYLE.BLANK,
          true,
        );
        solids?.cyl(cx, cz, y, y + h, r, r, "roof");
      }
      zz += 2 * r + 14;
    }
  }
  {
    // Flushing-Line-like el: steel deck on bents in the boulevard median, two tracks, a couple of parked trains
    const X = RAIL.x,
      y0 = FAR_Y,
      yd = FAR_Y + 7.4,
      yt = yd + 1.3,
      girder = [0.3, 0.31, 0.3],
      rust = [0.36, 0.3, 0.25];
    const clearOK = (za, zb) =>
      !bridgeSpans().some((B) => {
        if (
          zb < B.z - B.width / 2 - 6 ||
          za > B.z + B.width / 2 + 6 ||
          X < B.xB1 ||
          X > B.rampX1
        )
          return false;
        const yR =
          B.deckY +
          2.5 +
          ((FAR_Y - B.deckY - 2.5) * (X - B.xB1)) / (B.rampX1 - B.xB1) -
          1.2;
        return yR < yt + 5;
      });
    const onEast = (z) => {
      const L = nearLand(X, z);
      return (
        L && L.name === "east" && !onLand(X, z) && edgeDist(L.pts, X, z) > 60
      );
    };
    for (let z = RAIL.z0; z < RAIL.z1; z += 30) {
      const zb = Math.min(RAIL.z1, z + 30);
      if (!onEast(z) || !onEast(zb) || !clearOK(z, zb)) continue;
      sbox(X - 4.6, yd, z, X + 4.6, yt, zb, girder, "roof"); // deck
      sbox(X - 4.9, yd - 1.4, z, X - 4.2, yt + 1.0, zb, rust, "ledge"); // side plate girders
      sbox(X + 4.2, yd - 1.4, z, X + 4.9, yt + 1.0, zb, rust, "ledge");
      if (clearOK(z - 2, z + 2)) {
        // bent: column + cap beam
        sbox(X - 0.8, y0, z - 0.8, X + 0.8, yd - 1.4, z + 0.8, rust, "pole");
        sbox(X - 5.2, yd - 1.4, z - 0.7, X + 5.2, yd, z + 0.7, rust, "ledge");
      }
    }
    // two parked trains (11 x 15.5 m cars, brushed steel), one per track
    for (const [tx, tz0] of [
      [X - 2.2, -1900],
      [X + 2.2, 150],
    ]) {
      for (let c = 0; c < 11; c++) {
        const za = tz0 + c * 16,
          zb = za + 15.4;
        if (!onEast(za) || !onEast(zb) || !clearOK(za, zb)) continue;
        sbox(
          tx - 1.5,
          yt,
          za,
          tx + 1.5,
          yt + 3.6,
          zb,
          [0.64, 0.65, 0.66],
          "roof",
        );
      }
    }
  }

  // ---- (round 6) arterial boulevards (Queens-Boulevard / Kennedy-Boulevard-like): 26 m dark asphalt bands every
  // ~1 km across the far grids, lane paint, median / kerb tree rows near Manhattan -> the far shores read as a city
  // with a road hierarchy from the air instead of a uniform speckle of blocks
  {
    g2.save();
    const lines = [];
    for (let x = artX(MAP.x0); x < MAP.x1; x += ART_SX)
      lines.push([x, MAP.z0, x, MAP.z1]);
    for (let z = artZ(MAP.z0); z < MAP.z1; z += ART_SZ)
      lines.push([MAP.x0, z, MAP.x1, z]);
    g2.lineCap = "butt";
    for (const [ax, az, bx, bz] of lines) {
      g2.strokeStyle = "#2e2f31";
      g2.lineWidth = (2 * ART_H - 2) / MAP.px;
      g2.beginPath();
      g2.moveTo(mx(ax), mz(az));
      g2.lineTo(mx(bx), mz(bz));
      g2.stroke();
      g2.strokeStyle = "#3d4535";
      g2.lineWidth = 3 / MAP.px;
      g2.beginPath();
      g2.moveTo(mx(ax), mz(az));
      g2.lineTo(mx(bx), mz(bz));
      g2.stroke(); // planted median
      const Lh = Math.hypot(bx - ax, bz - az),
        dx = (bx - ax) / Lh,
        dz = (bz - az) / Lh;
      for (let u = 0; u < Lh; u += 15 + rnd() * 6) {
        const tx = ax + dx * u,
          tz = az + dz * u;
        if (
          islandDist(tx, tz) > 3400 ||
          inCorridor(tx - 6, tz - 6, tx + 6, tz + 6)
        )
          continue;
        for (const o of [-ART_H + 2.5, 0, ART_H - 2.5]) {
          if (o !== 0 && rnd() < 0.35) continue;
          if (
            o === 0 &&
            Math.abs(tx - RAIL.x) < 1 &&
            tz > RAIL.z0 - 10 &&
            tz < RAIL.z1 + 10
          )
            continue; // (round 7) el structure
          const px2 = tx - dz * o,
            pz2 = tz + dx * o,
            hgt = farShoreHeight(px2, pz2);
          const Lx =
            hgt === null || onLand(px2, pz2) ? null : nearLand(px2, pz2);
          if (!Lx || edgeDist(Lx.pts, px2, pz2) < 40) continue;
          canopy.add(
            px2,
            hgt,
            pz2,
            o === 0 ? 3.0 + rnd() * 1.6 : 2.6 + rnd() * 1.4,
            0.2,
          );
        }
      }
    }
    g2.restore();
  }

  // ---- (round 5) waterfront greenways: darker tree bands along the far bulkheads facing Manhattan (Hudson River
  // Walkway / Brooklyn-Bridge-Park-like), in groups with gaps, so the far shore line reads as vegetation + city, not a
  // hard grey edge. No collision (like the other far canopies).
  for (const L of FAR_LANDS) {
    if (L.name !== "nj" && L.name !== "east") continue;
    let area = 0;
    for (let j = 0; j < L.pts.length; j++) {
      const p = L.pts[j],
        q = L.pts[(j + 1) % L.pts.length];
      area += p[0] * q[1] - q[0] * p[1];
    }
    for (let i = 0; i < L.pts.length; i++) {
      const [ax, az] = L.pts[i],
        [bx, bz] = L.pts[(i + 1) % L.pts.length];
      if (
        Math.max(Math.abs(ax), Math.abs(bx)) > 11000 ||
        Math.max(Math.abs(az), Math.abs(bz)) > 11000
      )
        continue;
      const Lh = Math.hypot(bx - ax, bz - az);
      let nx = (bz - az) / Lh,
        nz = -(bx - ax) / Lh;
      if (area < 0) {
        nx = -nx;
        nz = -nz;
      } // outward (toward the water)
      for (let u = 4; u < Lh; u += 7 + rnd() * 5) {
        const ex = ax + ((bx - ax) * u) / Lh,
          ez = az + ((bz - az) * u) / Lh;
        if (islandDist(ex, ez) > 2600) continue;
        if (
          Math.sin(ex * 0.011 + ez * 0.007) +
            0.6 * Math.sin(ez * 0.023 - ex * 0.004) <
          0.15
        )
          continue; // gaps between groups (round 6: wider, irregular park patches)
        for (const inset of [9, 17, 26]) {
          if (inset > 9 && rnd() < 0.45) continue;
          const tx = ex - nx * (inset + (rnd() - 0.5) * 3),
            tz = ez - nz * (inset + (rnd() - 0.5) * 3);
          const hgt = farShoreHeight(tx, tz);
          if (
            hgt === null ||
            onLand(tx, tz) ||
            inCorridor(tx - 4, tz - 4, tx + 4, tz + 4)
          )
            continue;
          canopy.add(tx, hgt, tz, 3.4 + rnd() * 2.6, 0.2);
        }
      }
    }
  }

  // ---- (round 5) Palisades: wooded talus clinging to the lower cliff face + an irregular wooded rim on the plateau
  // edge, so the cliff stops reading as one long flat grey wall across the Hudson
  for (let i = 0; i + 1 < PAL_N; i++) {
    const [ax, az] = PALISADES[i],
      [bx, bz] = PALISADES[i + 1],
      Lh = Math.hypot(bx - ax, bz - az);
    let nx = (bz - az) / Lh,
      nz = -(bx - ax) / Lh;
    if (inPalisades((ax + bx) / 2 + nx * 20, (az + bz) / 2 + nz * 20)) {
      nx = -nx;
      nz = -nz;
    } // outward (toward the river)
    for (let u = 3; u < Lh; u += 5 + rnd() * 4) {
      const ex = ax + ((bx - ax) * u) / Lh,
        ez = az + ((bz - az) * u) / Lh;
      if (
        islandDist(ex, ez) > 3200 ||
        inCorridor(ex - 10, ez - 10, ex + 10, ez + 10)
      )
        continue;
      const band =
        0.5 + 0.5 * Math.sin(ez * 0.013 + 1.7) * Math.sin(ez * 0.041); // wooded / bare rock stretches
      const nT = 1 + Math.floor(band * 3.5);
      for (let k = 0; k < nT; k++) {
        // talus: crowns stacked up the lower part of the face
        const off = 3 + rnd() * 6,
          y = FAR_Y + rnd() * (PAL_Y - FAR_Y) * (0.25 + 0.35 * band);
        canopy.add(ex + nx * off, y, ez + nz * off, 3.4 + rnd() * 2.8, 0.25);
      }
      if (rnd() < 0.08 + 0.55 * band * band) {
        // rim: irregular clumps on the plateau edge (round 6: sparser, clustered)
        const off = 2 + rnd() * 18;
        canopy.clump(
          ex - nx * off,
          PAL_Y,
          ez - nz * off,
          5,
          1 + Math.floor(rnd() * 3),
          3.2,
          6.5,
          0.25,
        );
      }
    }
  }

  // ---- piers along the far waterfronts (perpendicular to the shore, into the river), some with sheds
  const pierP = {
    style: STYLE.BLANK,
    layer: LAYER.CONCRETE,
    tint: [0.45, 0.44, 0.42],
    seed: 11,
  }; // (round 6: darker)
  const pierTop = {
    ...pierP,
    layer: LAYER.ROOF_GRAVEL,
    tint: [0.37, 0.36, 0.34],
  };
  const pileP = { ...pierP, layer: LAYER.BROWN, tint: [0.4, 0.36, 0.32] };
  const shoreXOf = (L, z, side) => {
    // x where the horizontal line at z crosses the polygon edge facing Manhattan
    let best = null;
    for (let i = 0; i < L.pts.length; i++) {
      const [ax, az] = L.pts[i],
        [bx, bz] = L.pts[(i + 1) % L.pts.length];
      if (az > z === bz > z || Math.abs(ax) > 11000 || Math.abs(bx) > 11000)
        continue;
      const x = ax + ((bx - ax) * (z - az)) / (bz - az);
      if (best === null || (side > 0 ? x > best : x < best)) best = x;
    }
    return best;
  };
  const piers = [];
  curBase = FAR_Y;
  const pierRun = (L, z0, z1, side, len0, len1, step) => {
    // side: +1 pier grows toward +x
    for (let z = z0; z < z1; z += step * (0.7 + rnd() * 0.6)) {
      if (rnd() < 0.3) continue;
      const w = 18 + rnd() * 22,
        za = z,
        zb = z + w;
      const sa = shoreXOf(L, za, side),
        sb = shoreXOf(L, zb, side);
      if (sa === null || sb === null) continue;
      const root = side > 0 ? Math.min(sa, sb) - 6 : Math.max(sa, sb) + 6,
        len = len0 + rnd() * (len1 - len0);
      const xa = side > 0 ? root : root - len,
        xb = side > 0 ? root + len : root;
      if (onLand(xa, za) || onLand(xb, za) || onLand(xa, zb) || onLand(xb, zb))
        continue;
      if (inCorridor(xa, za - 20, xb, zb + 20)) continue;
      piers.push([xa, za, xb, zb]);
      // deck slab on piles: an open, shadowed gap above the water instead of a solid block
      const yD = FAR_Y - 0.85,
        xr = side > 0 ? xa + 6 : xb - 6; // (the root end stays tucked into the bulkhead)
      bulk.box(
        xa,
        yD,
        za,
        xb,
        FAR_Y - 0.05,
        zb,
        pierP,
        {},
        true,
        true,
        pierTop,
      );
      solids?.box(xa, yD, za, xb, FAR_Y - 0.05, zb, "pier");
      for (
        let x = (side > 0 ? xr : xa) + 1;
        x < (side > 0 ? xb : xr) - 1;
        x += 7
      )
        for (const zz of [za + 0.8, (za + zb) / 2 - 0.3, zb - 1.4]) {
          bulk.box(
            x,
            G.WATER_Y - 1.5,
            zz,
            x + 0.6,
            yD,
            zz + 0.6,
            pileP,
            {},
            false,
          );
          solids?.box(x, G.WATER_Y - 1.5, zz, x + 0.6, yD, zz + 0.6, "pier");
        }
      rectPx(xa, za, xb, zb, "#625f59");
      if (rnd() < 0.82) {
        // shed (round 6: most piers carry one; some split into two with a gap)
        const m = 3,
          sxa = xa + (side > 0 ? 8 : m),
          sxb = xb - (side > 0 ? m : 8),
          lay = [LAYER.CONCRETE, LAYER.METAL, LAYER.BROWN, LAYER.RED][
            Math.floor(rnd() * 4)
          ];
        if (sxb - sxa > 110 && rnd() < 0.45) {
          const cut = sxa + (sxb - sxa) * (0.45 + rnd() * 0.15);
          nearBox(sxa, za + m, cut - 5, zb - m, 7 + rnd() * 6, "ind", lay);
          nearBox(cut + 5, za + m, sxb, zb - m, 6 + rnd() * 5, "ind", lay);
        } else nearBox(sxa, za + m, sxb, zb - m, 7 + rnd() * 6, "ind", lay);
      }
    }
  };
  const nj = FAR_LANDS[0],
    east = FAR_LANDS[1];
  pierRun(nj, -2600, 2300, +1, 90, 210, 130); // Hoboken / Jersey City piers into the Hudson
  pierRun(east, 1750, 3400, -1, 45, 110, 150); // Brooklyn piers (Brooklyn-Bridge-Park-like)
  pierRun(east, -2300, -1900, -1, 35, 60, 150);
  pierRun(east, -330, 1700, -1, 30, 55, 140); // (r14) LIC / Williamsburg waterfront (critic: 'far shore: no piers')

  // ---- (r14) waterfront warehouse row: critic 'far shore waterfront = a thin pale strip, no darker warehouses / industry'.
  // Long low sheds, warehouses and terminal buildings (dark brick / concrete / rusty metal, 6-16 m) set 5-10 m back from
  // the bulkhead on the N-S running banks facing Manhattan, in runs with gaps; skipped where a block building, pier root,
  // bridge corridor or landmark site already stands. Facade-shader boxes in the existing farCity batch (no new draw
  // call), exact collision boxes. Own rng for the layout (nearBox still draws its tints from the main stream).
  {
    const wr = mulberry32(14017);
    const hit = (a0, b0, a1, b1) => {
      for (let i = 0; i < foot.length; i += 4)
        if (
          a1 > foot[i] - 2 &&
          a0 < foot[i + 2] + 2 &&
          b1 > foot[i + 1] - 2 &&
          b0 < foot[i + 3] + 2
        )
          return true;
      return piers.some(
        (P) => a1 > P[0] - 3 && a0 < P[2] + 3 && b1 > P[1] - 3 && b0 < P[3] + 3,
      );
    };
    const LAYS = [
      LAYER.RED,
      LAYER.CONCRETE,
      LAYER.BROWN,
      LAYER.CONCRETE,
      LAYER.RED,
      LAYER.BUFF,
    ];
    let nW = 0;
    for (const L of [nj, east]) {
      for (let i = 0; i < L.pts.length; i++) {
        const [ax, az] = L.pts[i],
          [bx, bz] = L.pts[(i + 1) % L.pts.length];
        if (
          Math.max(Math.abs(ax), Math.abs(bx)) > 11000 ||
          Math.max(Math.abs(az), Math.abs(bz)) > 11000
        )
          continue;
        const Lh = Math.hypot(bx - ax, bz - az);
        if (Lh < 60 || Math.abs(bz - az) / Lh < 0.85) continue; // N-S banks only
        const xAt = (z) => ax + ((bx - ax) * (z - az)) / (bz - az);
        const zlo = Math.min(az, bz),
          zhi = Math.max(az, bz);
        // inland side: the side of the edge that is on this land polygon
        const zm = (zlo + zhi) / 2,
          sIn = pointInPoly(L.pts, xAt(zm) + 20, zm) ? 1 : -1;
        for (let z = zlo + 10 + wr() * 30; z < zhi - 30; ) {
          const len = 35 + wr() * 85,
            za = z,
            zb = Math.min(zhi - 8, z + len);
          z = zb + 12 + wr() * 55;
          if (zb - za < 25 || islandDist(xAt(za), za) > 3200 || wr() < 0.15)
            continue;
          const set = 5 + wr() * 5,
            dep = 16 + wr() * 16;
          const xe =
            sIn > 0
              ? Math.max(xAt(za), xAt(zb)) + set
              : Math.min(xAt(za), xAt(zb)) - set;
          const x0 = sIn > 0 ? xe : xe - dep,
            x1 = sIn > 0 ? xe + dep : xe;
          const ok = [
            [x0, za],
            [x1, za],
            [x0, zb],
            [x1, zb],
          ].every(
            ([x, zz]) =>
              pointInPoly(L.pts, x, zz) &&
              !onLand(x, zz) &&
              farShoreHeight(x, zz) === FAR_Y,
          );
          if (
            !ok ||
            inCorridor(x0, za, x1, zb) ||
            inSite(x0, za, x1, zb) ||
            hit(x0, za, x1, zb)
          )
            continue;
          curBase = FAR_Y;
          const h = 6 + wr() * wr() * 12,
            lay = LAYS[Math.floor(wr() * LAYS.length)];
          if (zb - za > 70 && wr() < 0.5) {
            // two buildings of different height with a loading gap
            const zc = za + (zb - za) * (0.4 + wr() * 0.2);
            nearBox(x0, za, x1, zc - 3, h, "ind", lay);
            nearBox(
              x0 + (sIn > 0 ? 0 : dep * 0.3),
              zc + 3,
              x1 - (sIn > 0 ? dep * 0.3 : 0),
              zb,
              h * (0.7 + wr() * 0.6),
              "ind",
              LAYS[Math.floor(wr() * LAYS.length)],
            );
          } else nearBox(x0, za, x1, zb, h, "ind", lay);
          rectPx(x0 - 3, za - 3, x1 + 3, zb + 3, "#45443f"); // dark yard / truck apron round them
          foot.push(x0, za, x1, zb);
          nW++;
        }
      }
    }
    void nW;
  }

  // Palisades: plateau slab (same ground map) + cliff faces along its river side
  {
    const sh = new THREE.Shape(
      PALISADES.map(([x, z]) => new THREE.Vector2(x, -z)),
    );
    const g = new THREE.ShapeGeometry(sh, 1)
      .rotateX(-Math.PI / 2)
      .translate(0, PAL_Y, 0);
    const pos = g.attributes.position,
      uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++)
      uv.setXY(
        i,
        (pos.getX(i) - MAP.x0) / (MAP.x1 - MAP.x0),
        1 - (pos.getZ(i) - MAP.z0) / (MAP.z1 - MAP.z0),
      );
    palGeo = g;
    // cliff faces: one vertical face exactly on the plateau edge (= the terrain step, collision-exact), detail from a
    // basalt shader (columnar jointing, ledges, moss / scrub, talus-darkened foot)
    const CP = [],
      CN = [],
      CI = [];
    for (let i = 0; i < PALISADES.length - 1; i++) {
      const [ax, az] = PALISADES[i],
        [bx, bz] = PALISADES[i + 1];
      if (ax < -6000 || bx < -6000) continue;
      // face toward +x (the river): outward normal = (dz, -dx) normalised, oriented to +x
      const L = Math.hypot(bx - ax, bz - az);
      let nx = (bz - az) / L,
        nz = -(bx - ax) / L;
      if (nx < 0) {
        nx = -nx;
        nz = -nz;
      }
      const Tx = nz,
        Tz = -nx;
      const sx = (ax - bx) * Tx + (az - bz) * Tz > 0 ? bx : ax,
        sz = sx === bx ? bz : az;
      const v = CP.length / 3,
        ex = sx + Tx * L,
        ez = sz + Tz * L;
      CP.push(
        sx,
        FAR_Y - 0.5,
        sz,
        ex,
        FAR_Y - 0.5,
        ez,
        ex,
        PAL_Y,
        ez,
        sx,
        PAL_Y,
        sz,
      );
      for (let k = 0; k < 4; k++) CN.push(nx, 0, nz);
      CI.push(v, v + 1, v + 2, v, v + 2, v + 3); // (T x up = n: counter-clockwise seen from the river)
      // woods: along the cliff top (plateau edge) and on the talus at its foot
      for (let u = 0; u < L; u += 9 + rnd() * 6) {
        const px = sx + Tx * u,
          pz = sz + Tz * u;
        // (round 6) clustered, not a continuous hedge: wooded stretches alternate with open lawns / cliff-edge buildings
        const wb =
          Math.sin(pz * 0.019 + 0.4) +
          0.7 * Math.sin(pz * 0.047 + 2.2) +
          0.4 * Math.sin(pz * 0.11);
        if (rnd() < (wb > 0.35 ? 0.9 : wb > -0.4 ? 0.3 : 0.04))
          canopy.clump(
            px - nx * (12 + rnd() * 34),
            PAL_Y,
            pz - nz * (12 + rnd() * 34),
            9,
            wb > 0.35 ? 3 : 1,
            3.5,
            7,
            0.3,
          );
        for (let k = 0; k < 2; k++)
          if (rnd() < 0.8)
            canopy.add(
              px + nx * (2 + rnd() * 14),
              FAR_Y,
              pz + nz * (2 + rnd() * 14),
              4 + rnd() * 3.5,
              0.35,
            );
      }
      // talus / wooded strip at the foot: darker ground map band
      g2.strokeStyle = "#4c5540";
      g2.lineWidth = 36 / MAP.px;
      g2.beginPath();
      g2.moveTo(mx(ax + 18), mz(az));
      g2.lineTo(mx(bx + 18), mz(bz));
      g2.stroke();
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.Float32BufferAttribute(CP, 3));
    cg.setAttribute("normal", new THREE.Float32BufferAttribute(CN, 3));
    cg.setIndex(CI);
    cg.computeBoundingSphere();
    const cm = new THREE.Mesh(cg, createCliffMaterial());
    cm.name = "palisadesCliff";
    cm.castShadow = true;
    cm.receiveShadow = true;
    cm.layers.enable(REFL_LAYER);
    group.add(cm);
  }
  for (const c of corridors) rectPx(c[0], c[1] + 6, c[2], c[3] - 6, "#434447"); // approach roads
  // ---- meshes
  canopy.build(group, "farCanopy", true, { tile: 1400, smallCasters: true }); // (perf) 700 -> 1400 m tiles: ~90 -> ~25 draws (far cascades skip smallCasters now)
  // tiled: frustum + cascade culling; crowns sub-texel in far cascades
  const bm = new THREE.Mesh(bulk.build(), facadeMat);
  bm.name = "farBulkheads";
  bm.receiveShadow = true;
  bm.layers.enable(REFL_LAYER);
  group.add(bm);
  const fg = F.build();
  if (fg) {
    const fm = new THREE.Mesh(fg, facadeMat);
    fm.name = "farCity";
    fm.castShadow = true;
    fm.receiveShadow = true;
    fm.layers.enable(REFL_LAYER);
    group.add(fm);
  }
  const frg = FR.build();
  if (frg) {
    const fm = new THREE.Mesh(frg, facadeMat);
    fm.name = "farCityRoofs";
    fm.castShadow = true;
    fm.receiveShadow = true;
    fm.userData.smallCasters = true;
    group.add(fm);
  }
  if (M.n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(M.P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(M.N, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(M.C, 3));
    g.setIndex(new THREE.Uint32BufferAttribute(M.I, 1));
    g.computeBoundingSphere();
    const mm = new THREE.Mesh(g, createMassMaterial());
    mm.name = "farCityMass";
    mm.castShadow = true;
    mm.receiveShadow = true;
    mm.layers.enable(REFL_LAYER);
    group.add(mm);
  }
  let palGeo0 = palGeo;
  // land slabs with the baked ground map
  const mapTex = new THREE.CanvasTexture(cv);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  mapTex.anisotropy = 8;
  mapTex.minFilter = THREE.LinearMipmapLinearFilter;
  mapTex.generateMipmaps = true;
  const landMat = new THREE.MeshStandardMaterial({
    map: mapTex,
    roughness: 0.95,
  });
  landMat.defines = { NO_CITYLIGHT: "" }; // (lighting2 r3) no Manhattan street-light fill on the far shores
  // beyond the baked map (and blended into its edge): procedural urban fabric (street grid, block tones, parks) that
  // averages out once sub-pixel, so the hinterland out to the horizon never reads as one flat slab
  landMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>",__shaderPatch1)
      .replace(
        "#include <fog_vertex>",__shaderPatch2,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",__shaderPatch3,
      )
      .replace(
        "#include <map_fragment>",__shaderPatch4,
      );
  };
  landMat.customProgramCacheKey = () => "far-land-v5";
  for (const L of FAR_LANDS) {
    const sh = new THREE.Shape(L.pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ShapeGeometry(sh, 1)
      .rotateX(-Math.PI / 2)
      .translate(0, FAR_Y, 0);
    const pos = g.attributes.position,
      uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++)
      uv.setXY(
        i,
        (pos.getX(i) - MAP.x0) / (MAP.x1 - MAP.x0),
        1 - (pos.getZ(i) - MAP.z0) / (MAP.z1 - MAP.z0),
      );
    const m = new THREE.Mesh(g, landMat);
    m.receiveShadow = true;
    m.name = "farLand-" + L.name;
    m.layers.enable(REFL_LAYER);
    group.add(m);
  }
  if (palGeo0) {
    const m = new THREE.Mesh(palGeo0, landMat);
    m.receiveShadow = true;
    m.name = "farLand-palisades";
    m.layers.enable(REFL_LAYER);
    group.add(m);
  }
  console.log("[city] (coast r2) far-shore crowns -> trees.js", nearTrees);
  return {
    group,
    count: nNear + nFar,
    near: nNear,
    far: nFar,
    trees: canopy.count,
    piers,
    wetSegs,
  };
}

// Palisades basalt: vertical columnar jointing (irregular column widths), horizontal ledges, rust / grey banding,
// moss and scrub on ledges and toward the top, darker damp talus at the foot. World-space (no UVs needed).
function createCliffMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.93,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>",__shaderPatch5)
      .replace(
        "#include <fog_vertex>",__shaderPatch6,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",__shaderPatch7,
      )
      .replace(
        "#include <map_fragment>",injectShader(__shaderPatch8, (PAL_Y - 12).toFixed(1), PAL_Y.toFixed(1), (FAR_Y + 16).toFixed(1)),
      );
  };
  mat.customProgramCacheKey = () => "palisades-cliff-v1";
  return mat;
}

// far massed blocks: vertex colour albedo; colour.b > 10 marks wall faces, which get a procedural floor / bay pattern
function createMassMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
  });
  mat.defines = { NO_CITYLIGHT: "" }; // (lighting2 r3) the Manhattan street-light fill (surface.js) lit the far-shore masses as a pale band
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNightK = nightK; // (daynight)
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",__shaderPatch9,
      )
      .replace(
        "#include <color_vertex>",__shaderPatch10,
      )
      .replace(
        "#include <fog_vertex>",__shaderPatch11,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",__shaderPatch12,
      )
      .replace(
        "#include <color_fragment>",injectShader(__shaderPatch13, FAR_Y.toFixed(1)),
      )
      .replace(
        "#include <emissivemap_fragment>",__shaderPatch14,
      );
  };
  mat.customProgramCacheKey = () => "far-mass-v3-night";
  return mat;
}
