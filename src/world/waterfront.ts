// @ts-nocheck
// The whole waterfront edge: Manhattan's seawall all round the island and the near far
// shores (NJ, Queens / Brooklyn / Bronx, the islets) seen across the rivers.
//
// User (coast r1): 'city borders on most places are not made yet, they are low poly and bad, fix it, and make all the
// coasts proper with right assets'. Before: one flat untextured quad per street row along a straight row-sampled
// shoreline, a 2-bar pipe rail (props.ts), flat slab bump-outs (ground.ts r13) the rail cut off, and far banks that were
// one dark quad per 0.5-1.5 km polygon edge.
//
// Now the island outline (layout.LAND_POLY, which the street grid is laid out against) is left untouched and a band of
// shoreline FILL is built outward from it: an offset profile d(s) around the ring (smoothed normals, so the tips round
// out: Battery Park gets a rounded point, Harlem a rough rocky one) made of plain esplanade runs, bump-out overlooks with
// square / chamfered ends, coves, bulkheads at the pier roots and bridge anchorages, capped by the river width. Every
// edge run has a style:
//   WALL  granite ashlar seawall + projecting granite coping + NYC esplanade rail (steel posts, timber handrail, pickets)
//   PLAT  relieving platform: concrete deck edge on piles over a dark void, the real bulkhead set back under it
//   RIP   riprap bank: a sloped boulder toe (image-gen riprap texture + instanced-style merged rocks), pipe rail
//   BULK  timber-capped concrete bulkhead with fender piles, a waler, cast-iron bollards (working edge, no rail)
// plus ladders, lamps / benches (props.ts pools via COAST.lamps / .benches), lawns and trees on the wide bump-outs,
// grime / wet / algae bands in the shader. The far banks get the same system (lighter: no pickets, rails on parks only).
// Textures: tools/imagegen/coast/ (granite / riprap / planks / bulkhead, Codex imagegen) packed by pack.py into
// public/city/tex/coast_atlas.webp (2 x 2 tiles). One material; geometry merged per 1024 m cell (2048 m far) into
// a main mesh + a picket-card mesh (alpha pattern by discard, no shadow, hidden beyond 320 m).
// Collision (C4): coastHeight(x, z) (ground.terrainHeight) is exact over the fill quads (promenade height), so the player
// stands / runs on the new esplanade; off the outer edge it is water again and traversal's waterBounce still works.
import { lazyShaderSections } from "../shaderSections.ts";
import waterfrontShaderSource from "./shaders/glsl/waterfront.glsl?raw";
import { injectShader } from "../render/shaderInjection.ts";
import * as THREE from "three";
import { assetUrl } from "../assets.ts";
import { loadKTX2TextureAsync } from "../render/ktx2.ts";
import {
  G,
  LAND_POLY,
  onLand,
  mulberry32,
  hash2,
  BRIDGES,
  pointInPoly,
  streetsAt,
  distToShore,
  shoreX,
  batteryAt,
  BATTERY,
  clipPoly,
  polyArea,
  inConvexPoly,
} from "./layout.ts";
import { createGrassMaterial } from "./ground.ts"; // (r2) the park lawn shader (lawn variant) for every coast / plaza / Battery lawn
import { STYLE, LAYER } from "./facade.ts";
import { nightK, nightOnly } from "../render/daynight.ts"; // (r2) esplanade lamp pools at night
import { cityLights } from "../render/citylights.ts"; // (night) the esplanade lamps are real lights (props.ts lamp pool items)
import { approachRects } from "./bridges.ts";
import { highwayRuns, HW } from "./highway.ts";
import { FAR_LANDS, FAR_Y, farShoreHeight } from "./farshore.ts";

const waterfrontShader = lazyShaderSections(() => waterfrontShaderSource);


const WALK = G.CURB_H,
  WY = G.WATER_Y;
export const ST = { WALL: 0, PLAT: 1, RIP: 2, BULK: 3 };
// props.ts reads the dressing spots (lamps / benches / trees) after buildWaterfront (city build order: ground -> props)
export const COAST = {
  lamps: [],
  benches: [],
  trees: [],
  built: false,
  stats: null,
  probes: [],
}; // probes: a few edge points per style (shot tools)

// ------------------------------------------------------------------ terrain lookup (fill quads, exact)
const QC = 16,
  _qIdx = new Map(),
  QX = [],
  QZ = [],
  QH = [];
const qKey = (i, j) => (i + 4096) * 8192 + (j + 4096);
function addFillQuad(pts, h) {
  const id = QH.length;
  QH.push(h);
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  for (const [x, z] of pts) {
    QX.push(x);
    QZ.push(z);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  for (let i = Math.floor(x0 / QC); i <= Math.floor(x1 / QC); i++)
    for (let j = Math.floor(z0 / QC); j <= Math.floor(z1 / QC); j++) {
      const k = qKey(i, j);
      let a = _qIdx.get(k);
      if (!a) _qIdx.set(k, (a = []));
      a.push(id);
    }
}
function inQuad(id, x, z) {
  let c = false;
  const o = id * 4;
  for (let a = 0, b = 3; a < 4; b = a++) {
    const za = QZ[o + a],
      zb = QZ[o + b];
    if (
      za > z !== zb > z &&
      x < QX[o + b] + ((QX[o + a] - QX[o + b]) * (z - zb)) / (za - zb)
    )
      c = !c;
  }
  return c;
}
// promenade height on the shoreline fill (Manhattan WALK, far banks FAR_Y), null elsewhere
export function coastHeight(x, z) {
  const a = _qIdx.get(qKey(Math.floor(x / QC), Math.floor(z / QC)));
  if (!a) return null;
  for (const id of a) if (inQuad(id, x, z)) return QH[id];
  return null;
}

// ------------------------------------------------------------------ far-shore edges owned by this module
const FAR_BOX = { x0: -2800, x1: 2600, z0: -5200, z1: 5600 };
let _farOwn = null;
function farOwned() {
  if (_farOwn) return _farOwn;
  _farOwn = new Set();
  const inBox = ([x, z]) =>
    x > FAR_BOX.x0 && x < FAR_BOX.x1 && z > FAR_BOX.z0 && z < FAR_BOX.z1;
  for (const L of FAR_LANDS) {
    if (L.name === "si") continue;
    for (let i = 0; i < L.pts.length; i++)
      if (inBox(L.pts[i]) && inBox(L.pts[(i + 1) % L.pts.length]))
        _farOwn.add(L.name + ":" + i);
  }
  return _farOwn;
}
// farshore.ts: skip its own flat bulkhead quad / wet band / riprap toe on the edges rebuilt here
export function farCoastOwns(name, i) {
  return farOwned().has(name + ":" + i);
}

// ------------------------------------------------------------------ geometry builder (one per cell and mesh)
class CB {
  constructor() {
    this.P = [];
    this.N = [];
    this.U = [];
    this.C = [];
    this.T = [];
    this.I = [];
    this.v = 0;
  }
  // convex planar polygon (3-4 pts [x,y,z]) with face normal n, per-vertex uv [[u,v],...], colour, tile
  poly(pts, n, uv, col, tile) {
    const b = this.v;
    for (let k = 0; k < pts.length; k++) {
      this.P.push(...pts[k]);
      this.N.push(...n);
      this.U.push(...uv[k]);
      this.C.push(...col);
      this.T.push(tile);
    }
    const [a, p1, p2] = pts;
    const cx =
      (p1[1] - a[1]) * (p2[2] - a[2]) - (p1[2] - a[2]) * (p2[1] - a[1]);
    const cy =
      (p1[2] - a[2]) * (p2[0] - a[0]) - (p1[0] - a[0]) * (p2[2] - a[2]);
    const cz =
      (p1[0] - a[0]) * (p2[1] - a[1]) - (p1[1] - a[1]) * (p2[0] - a[0]);
    const fw = cx * n[0] + cy * n[1] + cz * n[2] >= 0;
    for (let k = 1; k + 1 < pts.length; k++)
      if (fw) this.I.push(b, b + k, b + k + 1);
      else this.I.push(b, b + k + 1, b + k);
    this.v += pts.length;
  }
  // vertical wall quad along (ax,az)->(bx,bz), facing (nx,nz), y0..y1; uv: u = s0.. along (m) / ts, v = y / ts
  wall(ax, az, bx, bz, nx, nz, y0, y1, s0, col, tile, ts = 1) {
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-3 || y1 - y0 < 1e-3) return;
    this.poly(
      [
        [ax, y0, az],
        [bx, y0, bz],
        [bx, y1, bz],
        [ax, y1, az],
      ],
      [nx, 0, nz],
      [
        [s0 / ts, y0 / ts],
        [(s0 + L) / ts, y0 / ts],
        [(s0 + L) / ts, y1 / ts],
        [s0 / ts, y1 / ts],
      ],
      col,
      tile,
    );
  }
  // oriented box: centre (cx, cz), unit axis (ux, uz), half length hl (along u), half width hw, y0..y1; no bottom
  obox(cx, cz, ux, uz, hl, hw, y0, y1, col, tile, ts = 1) {
    const vx = -uz,
      vz = ux;
    const c = (a, b) => [cx + ux * a + vx * b, cz + uz * a + vz * b];
    const q = [c(-hl, -hw), c(hl, -hw), c(hl, hw), c(-hl, hw)];
    const top = q.map(([x, z]) => [x, y1, z]);
    this.poly(
      top,
      [0, 1, 0],
      q.map(([x, z]) => [x / ts, z / ts]),
      col,
      tile,
    );
    const nrm = [
      [-vx, -vz],
      [ux, uz],
      [vx, vz],
      [-ux, -uz],
    ];
    for (let k = 0; k < 4; k++) {
      const [ax, az] = q[k],
        [bx, bz] = q[(k + 1) % 4];
      this.wall(
        ax,
        az,
        bx,
        bz,
        nrm[k][0],
        nrm[k][1],
        y0,
        y1,
        (k & 1 ? hw : hl) * k,
        col,
        tile,
        ts,
      );
    }
  }
  // vertical n-gon prism (timber piles, bollards): centre, radius, y0..y1, with a top cap
  cyl(cx, cz, r, y0, y1, n, col, tile, ts = 1) {
    const q = [];
    for (let k = 0; k < n; k++) {
      const a = ((k + 0.5) / n) * 6.2832;
      q.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    for (let k = 0; k < n; k++) {
      const [ax, az] = q[k],
        [bx, bz] = q[(k + 1) % n],
        a = ((k + 1) / n) * 6.2832;
      this.wall(
        bx,
        bz,
        ax,
        az,
        Math.cos(a),
        Math.sin(a),
        y0,
        y1,
        k * r,
        col,
        tile,
        ts,
      );
    }
    const top = q.map(([x, z]) => [x, y1, z]);
    this.poly(
      top,
      [0, 1, 0],
      q.map(([x, z]) => [x / ts, z / ts]),
      col,
      tile,
    );
  }
  // rail strip between two points (a box along the segment), y0..y1, half width hw
  bar(ax, az, bx, bz, hw, y0, y1, col, tile, ts = 1) {
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-3) return;
    const ux = (bx - ax) / L,
      uz = (bz - az) / L,
      vx = -uz * hw,
      vz = ux * hw;
    this.poly(
      [
        [ax + vx, y1, az + vz],
        [bx + vx, y1, bz + vz],
        [bx - vx, y1, bz - vz],
        [ax - vx, y1, az - vz],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [L / ts, 0],
        [L / ts, 0.1],
        [0, 0.1],
      ],
      col,
      tile,
    );
    this.wall(
      ax + vx,
      az + vz,
      bx + vx,
      bz + vz,
      -uz,
      ux,
      y0,
      y1,
      0,
      col,
      tile,
      ts,
    );
    this.wall(
      bx - vx,
      bz - vz,
      ax - vx,
      az - vz,
      uz,
      -ux,
      y0,
      y1,
      0,
      col,
      tile,
      ts,
    );
  }
  build() {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute("aTile", new THREE.Float32BufferAttribute(this.T, 1));
    g.setIndex(
      this.v > 65535
        ? new THREE.Uint32BufferAttribute(this.I, 1)
        : new THREE.Uint16BufferAttribute(this.I, 1),
    );
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
// tiles: 0 granite ashlar, 1 riprap, 2 timber planks, 3 bulkhead concrete (atlas); 4 paint / solid (vertex colour),
// 5 lawn, 6 promenade pavers, 7 picket card (discard pattern)
const TL = {
  GRANITE: 0,
  RIPRAP: 1,
  PLANK: 2,
  CONC: 3,
  SOLID: 4,
  LAWN: 5,
  PAVE: 6,
  PICKET: 7,
  RIB: 8,
  ROLL: 9,
}; // (r2) 8 ribbed roof metal, 9 roll-up door slats
const TS = { GRANITE: 4.8, RIPRAP: 5, PLANK: 4, CONC: 6 }; // metres per atlas tile
const COL = {
  granite: [0.62, 0.6, 0.57],
  coping: [0.8, 0.78, 0.74],
  conc: [0.74, 0.72, 0.68],
  concDark: [0.36, 0.35, 0.33],
  steel: [0.035, 0.042, 0.04],
  timber: [0.58, 0.44, 0.32],
  pile: [0.42, 0.36, 0.3],
  iron: [0.05, 0.05, 0.05],
  rust: [0.14, 0.09, 0.06],
  hedge: [0.62, 0.72, 0.5],
  fascia: [0.46, 0.39, 0.31],
  white: [1, 1, 1],
  rock: [0.62, 0.6, 0.57],
  void: [0.12, 0.12, 0.12],
};

function createCoastMaterial(T, atlas) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0,
    vertexColors: true,
  });
  const uni = {
    tAtlas: { value: atlas },
    tNoise: { value: T.noise },
    tPave: { value: T.sidewalkCol },
  };
  mat.userData.uni = uni;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",waterfrontShader.vertexCommon,
      )
      .replace(
        "#include <fog_vertex>",waterfrontShader.vertexFogVertex,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",injectShader(waterfrontShader.fragmentCommon, WY.toFixed(2)),
      )
      .replace("#include <map_fragment>",waterfrontShader.fragmentMap)
      .replace(
        "#include <roughnessmap_fragment>",waterfrontShader.fragmentRoughness,
      );
  };
  mat.customProgramCacheKey = () => "coast-v1";
  return mat;
}

// ------------------------------------------------------------------ riprap boulder shapes (jittered icosahedra)
const rockSet = (det) => {
  const out = [];
  for (let k = 0; k < 6; k++) {
    let g = new THREE.IcosahedronGeometry(1, det);
    if (g.index) g = g.toNonIndexed();
    const p = g.attributes.position; // (r2: 80 tris, detail 0 read as low-poly blobs)
    const tris = [];
    const jit = (x, y, z) => {
      const h = hash2(
        Math.round(x * 100) + k * 977,
        Math.round(y * 100) * 31 + Math.round(z * 100),
      );
      return 0.78 + 0.36 * h;
    };
    for (let i = 0; i < p.count; i += 3) {
      const t = [];
      for (let j = 0; j < 3; j++) {
        const x = p.getX(i + j),
          y = p.getY(i + j),
          z = p.getZ(i + j),
          s = jit(x, y, z);
        t.push([x * s * 1.1, y * s * 0.62, z * s * 0.9]);
      }
      tris.push(t);
    }
    out.push(tris);
  }
  return out;
};
const ROCKS = rockSet(1),
  ROCKS0 = rockSet(0); // far banks: 20-tri boulders (sub-pixel detail there)

// ------------------------------------------------------------------ the builder
// Battery Park ferry terminal footprint (Whitehall-like, at the rounded south point) and its slips (r2)
const TERM = { x0: -90, x1: -30, z0: 3318, z1: 3346 };
const inTerm = (x, z, pad = 0) =>
  x > TERM.x0 - pad &&
  x < TERM.x1 + pad &&
  z > TERM.z0 - pad &&
  z < TERM.z1 + 60 + pad;
export function buildWaterfront({
  scene,
  T,
  piers = [],
  pileFields = [],
  solids = null,
  zips = null,
  fills = [],
  wall = null,
}) {
  const t0 = performance.now();
  // atlas: 1 px placeholder until the compressed texture arrives.
  const ph = new THREE.DataTexture(new Uint8Array([128, 126, 122, 255]), 1, 1);
  ph.needsUpdate = true;
  const mat = createCoastMaterial(T, ph);
  loadKTX2TextureAsync(assetUrl("city/tex/coast_atlas.webp"))
    .then((tx) => {
      tx.colorSpace = THREE.SRGBColorSpace;
      tx.anisotropy = 8;
      tx.needsUpdate = true;
      mat.userData.uni.tAtlas.value = tx;
    })
    .catch((e) => console.warn("[coast] atlas", e.message));

  const cells = new Map();
  const cellOf = (x, z, far) => {
    const S = far ? 2048 : 1024,
      k =
        (far ? "f" : "m") + // (r3) 512 / 1024 m cost ~30 main calls in the street view; csm culls merged casters per 256 m cell anyway
        Math.floor(x / S) +
        "," +
        Math.floor(z / S);
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { main: new CB(), pick: new CB(), far }));
    return c;
  };
  const wetSegs = [];
  const stats = { samples: 0, bumps: 0, far: 0, railBoxes: 0 };
  // (r2) lawns: the park lawn shader (ground.ts createGrassMaterial, lawn variant), one mesh per 4 km cell (flat, no shadow: few calls)
  const lawnMat = createGrassMaterial(T, { lawn: true }),
    lawnCells = new Map();
  const lawnPoly = (pts, y) => {
    // convex [[x, z], ...]
    let mx = 0,
      mz = 0;
    for (const [x, z] of pts) {
      mx += x;
      mz += z;
    }
    mx /= pts.length;
    mz /= pts.length;
    const k = Math.floor(mx / 4096) + "," + Math.floor(mz / 4096);
    let L = lawnCells.get(k);
    if (!L) lawnCells.set(k, (L = new CB()));
    L.poly(
      pts.map(([x, z]) => [x, y, z]),
      [0, 1, 0],
      pts.map(() => [0, 0]),
      COL.white,
      0,
    );
  };
  // (r2) coordinator: 'railings need collision (thin walls) so the player can vault or stand on them'. Solids are
  // axis-aligned boxes: an angled rail is cut into pieces whose box stays <= ~0.2 m thick (few pieces along the
  // mostly N-S / E-W runs, more on the diagonals); kind 'ledge' like the pier rails.
  const railSolid = (ax, az, bx, bz, y0, y1) => {
    if (!solids) return;
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.05) return;
    const ux = (bx - ax) / L,
      uz = (bz - az) / L,
      m = Math.min(Math.abs(ux), Math.abs(uz));
    const n = Math.max(1, Math.ceil(L / (m < 0.012 ? L : 0.14 / m)));
    for (let k = 0; k < n; k++) {
      const x0 = ax + (ux * L * k) / n,
        z0 = az + (uz * L * k) / n,
        x1 = ax + (ux * L * (k + 1)) / n,
        z1 = az + (uz * L * (k + 1)) / n;
      solids.box(
        Math.min(x0, x1) - 0.1,
        y0,
        Math.min(z0, z1) - 0.1,
        Math.max(x0, x1) + 0.1,
        y1,
        Math.max(z0, z1) + 0.1,
        "ledge",
      );
      stats.railBoxes++;
    }
  };

  // river clearance: distance from (x, z) along (nx, nz) to the next land (Manhattan or a far bank)
  const clearance = (x, z, nx, nz) => {
    for (let r = 6; r < 1600; r += 6) {
      const px = x + nx * r,
        pz = z + nz * r;
      if (onLand(px, pz) || farShoreHeight(px, pz) !== null) return r;
    }
    return 1600;
  };

  // ---- one run (closed ring or open polyline) of base points -> samples, offset profile, geometry
  const run = ({ pts, closed, far, yTop, profile, capsAt, rng, sideOf }) => {
    // resample
    const S = [];
    const step = far ? 6 : 3;
    const nE = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < nE; i++) {
      const [ax, az] = pts[i],
        [bx, bz] = pts[(i + 1) % pts.length],
        L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++)
        S.push({ x: ax + ((bx - ax) * k) / n, z: az + ((bz - az) * k) / n });
    }
    if (!closed)
      S.push({ x: pts[pts.length - 1][0], z: pts[pts.length - 1][1] });
    const N = S.length;
    if (N < 3) return;
    const at = (i) =>
      closed ? S[((i % N) + N) % N] : S[Math.max(0, Math.min(N - 1, i))];
    // smoothed outward normals (outward = (-tz, tx) for this orientation, flipped per run by the caller's sideOf test)
    const kN = far ? 3 : 5;
    for (let i = 0; i < N; i++) {
      const a = at(i - kN),
        b = at(i + kN);
      let tx = b.x - a.x,
        tz = b.z - a.z;
      const L = Math.hypot(tx, tz) || 1;
      tx /= L;
      tz /= L;
      S[i].nx = -tz;
      S[i].nz = tx;
    }
    let sgn = 1;
    {
      const m = S[Math.floor(N / 2)];
      if (sideOf(m.x + m.nx * 2, m.z + m.nz * 2)) sgn = -1;
    }
    for (const s of S) {
      s.nx *= sgn;
      s.nz *= sgn;
    }
    // arc length
    S[0].s = 0;
    for (let i = 1; i < N; i++)
      S[i].s =
        S[i - 1].s + Math.hypot(S[i].x - S[i - 1].x, S[i].z - S[i - 1].z);
    // profile + caps
    for (let i = 0; i < N; i++) {
      const s = S[i];
      Object.assign(s, profile(s));
    }
    for (let i = 0; i < N; i += 8) {
      const s = S[i];
      s.clr = clearance(s.x, s.z, s.nx, s.nz);
    }
    for (let i = 0; i < N; i++) {
      const s = S[i],
        a = S[i - (i % 8)],
        b = S[Math.min(N - 1, i - (i % 8) + 8)],
        f = (i % 8) / 8;
      const clr = (a.clr ?? 1600) * (1 - f) + (b.clr ?? a.clr ?? 1600) * f;
      let cap = Math.max(1.2, clr * 0.1 - 4);
      const c2 = capsAt(s);
      if (c2) {
        cap = Math.min(cap, c2.cap);
        if (c2.st !== undefined) s.st = c2.st;
        if (c2.noRail) s.noRail = true;
      }
      s.d = Math.max(1.2, Math.min(s.d, cap));
    }
    stats.samples += N;
    if (!far)
      stats.rip = (stats.rip || 0) + S.filter((q) => q.st === ST.RIP).length;
    for (let i = 0; i < N; i += 37) {
      const s = S[i];
      if (!far && s.d > 1.5)
        COAST.probes.push({
          st: s.st,
          d: +s.d.toFixed(1),
          x: +s.x.toFixed(1),
          z: +s.z.toFixed(1),
          nx: +s.nx.toFixed(3),
          nz: +s.nz.toFixed(3),
        });
    }
    // outer points
    for (const s of S) {
      s.ox = s.x + s.nx * s.d;
      s.oz = s.z + s.nz * s.d;
    }
    const nSeg = closed ? N : N - 1;
    const seg = [];
    for (let i = 0; i < nSeg; i++) {
      const a = S[i],
        b = S[(i + 1) % N];
      let tx = b.ox - a.ox,
        tz = b.oz - a.oz;
      const L = Math.hypot(tx, tz);
      if (L < 1e-4) {
        seg.push({ L: 0, nx: a.nx, nz: a.nz, tx: -a.nz, tz: a.nx });
        continue;
      }
      tx /= L;
      tz /= L;
      let nx = -tz * sgn,
        nz = tx * sgn;
      seg.push({ L, nx, nz, tx, tz });
    }
    // vertex miter normals of the outer polyline
    for (let i = 0; i < N; i++) {
      const pa = seg[closed ? (i - 1 + nSeg) % nSeg : Math.max(0, i - 1)],
        pb = seg[closed ? i % nSeg : Math.min(nSeg - 1, i)];
      let mx = pa.nx + pb.nx,
        mz = pa.nz + pb.nz;
      const L = Math.hypot(mx, mz);
      if (L < 0.3) {
        mx = S[i].nx;
        mz = S[i].nz;
      } else {
        mx /= L;
        mz /= L;
      }
      const cs = Math.max(0.5, mx * pb.nx + mz * pb.nz);
      S[i].mx = mx / cs;
      S[i].mz = mz / cs;
    }
    const P = (s, off) => [s.ox + s.mx * off, s.oz + s.mz * off];
    // along-edge arc length of the outer line
    S[0].os = 0;
    for (let i = 1; i < N; i++) S[i].os = S[i - 1].os + seg[i - 1].L;
    const COP = 0.55;
    let lastLamp = -1e9,
      lastBench = -1e9,
      lastTree = -1e9,
      lastLadder = -40,
      lastPost = -1e9,
      lastBoll = -1e9,
      lastRock = 0;
    for (let i = 0; i < nSeg; i++) {
      const a = S[i],
        b = S[(i + 1) % N],
        sg = seg[i],
        st = a.st;
      const mxm = (a.ox + b.ox) / 2,
        mzm = (a.oz + b.oz) / 2;
      const C = cellOf(mxm, mzm, far),
        M = C.main;
      const [iax, iaz] = P(a, -COP),
        [ibx, ibz] = P(b, -COP);
      // fill top: base -> coping inner edge (pavers), terrain quad base -> outer edge
      M.poly(
        [
          [a.x, yTop, a.z],
          [b.x, yTop, b.z],
          [ibx, yTop, ibz],
          [iax, yTop, iaz],
        ],
        [0, 1, 0],
        [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ],
        COL.white,
        TL.PAVE,
      );
      addFillQuad(
        [
          [a.x, a.z],
          [b.x, b.z],
          [b.ox, b.oz],
          [a.ox, a.oz],
        ],
        yTop,
      );
      if (sg.L < 1e-3) continue;
      const yC = yTop + 0.015,
        yBot = WY - 2.5;
      // coping band (top) + its outer face; overhang per style
      const ov =
        st === ST.WALL
          ? 0.2
          : st === ST.BULK
            ? 0.12
            : st === ST.PLAT
              ? 0.05
              : 0;
      const [oax, oaz] = P(a, ov),
        [obx, obz] = P(b, ov);
      const copT =
          st === ST.BULK ? TL.PLANK : st === ST.PLAT ? TL.CONC : TL.GRANITE,
        copC =
          st === ST.BULK ? COL.timber : st === ST.PLAT ? COL.conc : COL.coping;
      const cts = st === ST.BULK ? TS.PLANK : 1.8;
      M.poly(
        [
          [iax, yC, iaz],
          [ibx, yC, ibz],
          [obx, yC, obz],
          [oax, yC, oaz],
        ],
        [0, 1, 0],
        [
          [a.os / cts, 0],
          [b.os / cts, 0],
          [b.os / cts, 0.14],
          [a.os / cts, 0.14],
        ],
        copC,
        copT,
      );
      const copB =
        st === ST.BULK
          ? yTop - 0.25
          : st === ST.PLAT
            ? yTop - 0.72
            : yTop - 0.32;
      M.wall(oax, oaz, obx, obz, sg.nx, sg.nz, copB, yC, a.os, copC, copT, cts);
      if (ov > 0)
        M.poly(
          [
            [a.ox, copB, a.oz],
            [b.ox, copB, b.oz],
            [obx, copB, obz],
            [oax, copB, oaz],
          ],
          [0, -1, 0],
          [
            [0, 0],
            [1, 0],
            [1, 0.1],
            [0, 0.1],
          ],
          COL.concDark,
          TL.SOLID,
        );
      // the face down into the water
      if (st === ST.WALL) {
        M.wall(
          a.ox,
          a.oz,
          b.ox,
          b.oz,
          sg.nx,
          sg.nz,
          yBot,
          copB,
          a.os,
          COL.granite,
          TL.GRANITE,
          TS.GRANITE,
        );
        wetSegs.push({
          ax: a.ox,
          az: a.oz,
          bx: b.ox,
          bz: b.oz,
          nx: sg.nx,
          nz: sg.nz,
        });
      } else if (st === ST.BULK) {
        M.wall(
          a.ox,
          a.oz,
          b.ox,
          b.oz,
          sg.nx,
          sg.nz,
          yBot,
          copB,
          a.os,
          COL.conc,
          TL.CONC,
          TS.CONC,
        );
        wetSegs.push({
          ax: a.ox,
          az: a.oz,
          bx: b.ox,
          bz: b.oz,
          nx: sg.nx,
          nz: sg.nz,
        });
        // timber waler along the face
        const w0 = [a.ox + sg.nx * 0.16, a.oz + sg.nz * 0.16],
          w1 = [b.ox + sg.nx * 0.16, b.oz + sg.nz * 0.16];
        M.bar(
          w0[0],
          w0[1],
          w1[0],
          w1[1],
          0.16,
          yTop - 1.05,
          yTop - 0.7,
          COL.pile,
          TL.PLANK,
          TS.PLANK,
        );
        // fender piles + bollards
        for (let u = Math.ceil(a.os / 3.6) * 3.6; u < b.os; u += 3.6) {
          const f = (u - a.os) / sg.L,
            px = a.ox + (b.ox - a.ox) * f + sg.nx * 0.42,
            pz = a.oz + (b.oz - a.oz) * f + sg.nz * 0.42;
          M.cyl(
            px,
            pz,
            0.2,
            yBot,
            yTop + 0.02 + hash2(Math.round(u), 7) * 0.2,
            7,
            COL.pile,
            TL.PLANK,
            2,
          );
        }
        if (!far)
          for (
            let u = Math.max(lastBoll + 14, Math.ceil(a.os / 14) * 14);
            u < b.os;
            u += 14
          ) {
            lastBoll = u;
            const f = (u - a.os) / sg.L,
              px = a.ox + (b.ox - a.ox) * f - a.mx * 0.3,
              pz = a.oz + (b.oz - a.oz) * f - a.mz * 0.3;
            M.obox(
              px,
              pz,
              sg.tx,
              sg.tz,
              0.16,
              0.16,
              yC,
              yC + 0.5,
              COL.iron,
              TL.SOLID,
            );
            M.obox(
              px,
              pz,
              sg.tx,
              sg.tz,
              0.22,
              0.22,
              yC + 0.5,
              yC + 0.6,
              COL.iron,
              TL.SOLID,
            );
            solids?.cyl(px, pz, yC, yC + 0.6, 0.2, 0.2, "equipment");
          }
      } else if (st === ST.PLAT) {
        // relieving platform: deck fascia (coping face above), dark soffit back to the set-back bulkhead, piles
        const back = 3.8,
          [kax, kaz] = P(a, -back),
          [kbx, kbz] = P(b, -back);
        M.poly(
          [
            [a.ox, copB, a.oz],
            [b.ox, copB, b.oz],
            [kbx, copB, kbz],
            [kax, copB, kaz],
          ],
          [0, -1, 0],
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          COL.void,
          TL.SOLID,
        );
        M.wall(
          kax,
          kaz,
          kbx,
          kbz,
          sg.nx,
          sg.nz,
          yBot,
          copB,
          a.os,
          COL.concDark,
          TL.CONC,
          TS.CONC,
        );
        wetSegs.push({
          ax: kax,
          az: kaz,
          bx: kbx,
          bz: kbz,
          nx: sg.nx,
          nz: sg.nz,
        });
        for (let u = Math.ceil(a.os / 3.3) * 3.3; u < b.os; u += 3.3) {
          const f = (u - a.os) / sg.L,
            px = a.ox + (b.ox - a.ox) * f,
            pz = a.oz + (b.oz - a.oz) * f;
          for (const o of [0.7, 2.5])
            M.obox(
              px - a.mx * o,
              pz - a.mz * o,
              sg.tx,
              sg.tz,
              0.25,
              0.25,
              yBot,
              copB,
              COL.concDark,
              TL.CONC,
              2,
            );
        }
      } else {
        // riprap: sloped boulder bank from under the coping into the water + loose rocks on it
        const sl = 4.5 + 1.5 * hash2(Math.round(a.os), 3),
          yS = WY - 1.6;
        const [sax, saz] = P(a, sl),
          [sbx, sbz] = P(b, sl);
        const lenS = Math.hypot(sl, copB - yS),
          nUp = sl / lenS,
          nOut = (copB - yS) / lenS;
        M.poly(
          [
            [a.ox, copB, a.oz],
            [b.ox, copB, b.oz],
            [sbx, yS, sbz],
            [sax, yS, saz],
          ],
          [sg.nx * nOut, nUp, sg.nz * nOut],
          [
            [a.os / TS.RIPRAP, 0],
            [b.os / TS.RIPRAP, 0],
            [b.os / TS.RIPRAP, lenS / TS.RIPRAP],
            [a.os / TS.RIPRAP, lenS / TS.RIPRAP],
          ],
          COL.rock,
          TL.RIPRAP,
        );
        const rs = far ? 2.4 : 0.8;
        for (
          let u = Math.max(lastRock, a.os);
          u < b.os;
          u += rs * (0.7 + rng() * 0.6)
        ) {
          lastRock = u + 0.01;
          const f = (u - a.os) / sg.L,
            tt = 0.08 + rng() * 0.9,
            sz = (far ? 1.1 : 0.45) + rng() * rng() * (far ? 1.1 : 1.0);
          const px = a.ox + (b.ox - a.ox) * f + a.mx * sl * tt,
            pz = a.oz + (b.oz - a.oz) * f + a.mz * sl * tt,
            py = copB + (yS - copB) * tt;
          const R = (far ? ROCKS0 : ROCKS)[Math.floor(rng() * ROCKS.length)],
            ang = rng() * 6.283,
            ca = Math.cos(ang),
            sa = Math.sin(ang),
            k = 0.78 + rng() * 0.5;
          for (const tri of R) {
            const q = tri.map(([x, y, z]) => [
              px + (x * ca - z * sa) * sz,
              py + y * sz,
              pz + (x * sa + z * ca) * sz,
            ]);
            const ux = q[1][0] - q[0][0],
              uy = q[1][1] - q[0][1],
              uz = q[1][2] - q[0][2],
              vx = q[2][0] - q[0][0],
              vy = q[2][1] - q[0][1],
              vz = q[2][2] - q[0][2];
            let nx = uy * vz - uz * vy,
              ny = uz * vx - ux * vz,
              nz = ux * vy - uy * vx;
            const L = Math.hypot(nx, ny, nz) || 1;
            nx /= L;
            ny /= L;
            nz /= L;
            if (
              (q[0][0] - px) * nx + (q[0][1] - py) * ny + (q[0][2] - pz) * nz <
              0
            ) {
              nx = -nx;
              ny = -ny;
              nz = -nz;
            }
            M.poly(
              q,
              [nx, ny, nz],
              q.map(([x, y, z]) => [(x + y * 0.5) / 2.2, (z + y * 0.5) / 2.2]),
              COL.rock.map((v) => v * k),
              TL.RIPRAP,
            );
          }
        }
      }
      // ladders down the wall (WALL / BULK), every ~60 m
      if (
        !far &&
        (st === ST.WALL || st === ST.BULK) &&
        b.os - lastLadder > 60 &&
        sg.L > 1.2
      ) {
        lastLadder = b.os;
        const cx = (a.ox + b.ox) / 2 + sg.nx * (ov + 0.1),
          cz = (a.oz + b.oz) / 2 + sg.nz * (ov + 0.1);
        for (const s2 of [-0.24, 0.24])
          M.obox(
            cx + sg.tx * s2,
            cz + sg.tz * s2,
            sg.tx,
            sg.tz,
            0.025,
            0.035,
            WY - 1.3,
            yTop + 0.95,
            COL.rust,
            TL.SOLID,
          );
        for (let y = WY - 1.0; y < yTop - 0.3; y += 0.3)
          M.obox(
            cx,
            cz,
            sg.tx,
            sg.tz,
            0.24,
            0.018,
            y,
            y + 0.035,
            COL.rust,
            TL.SOLID,
          );
      }
      // rail (inside the coping), posts every 2.4 m on the outer arc length
      const rail = a.rail && !a.noRail && st !== ST.BULK && (!far || a.d > 8);
      if (rail) {
        const [rax, raz] = P(a, -0.26),
          [rbx, rbz] = P(b, -0.26);
        const style = a.rail,
          top = yC + (style === "pipe" ? 1.0 : 1.07);
        if (style === "picket") {
          M.bar(
            rax,
            raz,
            rbx,
            rbz,
            0.06,
            top,
            top + 0.07,
            COL.timber,
            TL.PLANK,
            TS.PLANK,
          ); // timber handrail
          M.bar(
            rax,
            raz,
            rbx,
            rbz,
            0.025,
            yC + 0.12,
            yC + 0.16,
            COL.steel,
            TL.SOLID,
          );
          if (!far)
            for (const sd of [1, -1]) {
              const ox = sg.nx * 0.012 * sd,
                oz = sg.nz * 0.012 * sd;
              C.pick.poly(
                [
                  [rax + ox, yC + 0.16, raz + oz],
                  [rbx + ox, yC + 0.16, rbz + oz],
                  [rbx + ox, top, rbz + oz],
                  [rax + ox, top, raz + oz],
                ],
                [sg.nx * sd, 0, sg.nz * sd],
                [
                  [a.os, 0],
                  [b.os, 0],
                  [b.os, 1],
                  [a.os, 1],
                ],
                COL.steel,
                TL.PICKET,
              );
            }
        } else {
          M.bar(rax, raz, rbx, rbz, 0.03, top, top + 0.06, COL.steel, TL.SOLID);
          for (const y of style === "bars" ? [0.36, 0.7] : [0.5])
            M.bar(
              rax,
              raz,
              rbx,
              rbz,
              0.022,
              yC + y,
              yC + y + 0.045,
              COL.steel,
              TL.SOLID,
            );
        }
        const pe = far ? 4.8 : style === "pipe" ? 2.0 : 2.4;
        for (
          let u = Math.max(lastPost + pe, Math.ceil(a.os / pe) * pe);
          u < b.os;
          u += pe
        ) {
          lastPost = u;
          const f = (u - a.os) / sg.L,
            px = rax + (rbx - rax) * f,
            pz = raz + (rbz - raz) * f;
          M.obox(
            px,
            pz,
            sg.tx,
            sg.tz,
            0.04,
            0.04,
            yC,
            top + 0.02,
            COL.steel,
            TL.SOLID,
          );
        }
        if (!far) railSolid(rax, raz, rbx, rbz, yC, top + 0.07);
      }
      if (far) continue;
      // lamps / benches (props.ts pools) along the edge, inward normal
      const inx = -a.mx,
        inz = -a.mz,
        iL = Math.hypot(inx, inz) || 1;
      if (a.os - lastLamp > 27 && sg.L > 0.5 && a.d > 1.9 && !a.noRail) {
        lastLamp = a.os;
        COAST.lamps.push({
          x: a.ox - a.mx * 1.1,
          z: a.oz - a.mz * 1.1,
          nx: inx / iL,
          nz: inz / iL,
        });
      }
      if (
        a.os - lastBench > 41 &&
        a.os - lastLamp > 9 &&
        a.d > 3.2 &&
        st !== ST.BULK &&
        !a.noRail
      ) {
        lastBench = a.os;
        COAST.benches.push({
          x: a.ox - a.mx * 2.3,
          z: a.oz - a.mz * 2.3,
          nx: inx / iL,
          nz: inz / iL,
        });
      }
    }
    // wide bump-outs: lawn panels between paved rings + a tree row (Hudson River Park / Battery Park City overlooks)
    for (let i = 0; i < nSeg; i++) {
      const a = S[i],
        b = S[(i + 1) % N];
      if (a.d < 15 || b.d < 15) continue;
      const tip = !far && (a.z > 3060 || a.z < -3260); // (r2) Battery / Harlem points: one continuous lawn ring, paths every 90 m
      const k = tip ? 40 : a.s % 36;
      if (!tip && k > 31) continue; // paths across the lawns
      const [l0x, l0z] = [a.x + a.nx * 2.5, a.z + a.nz * 2.5],
        [l1x, l1z] = [b.x + b.nx * 2.5, b.z + b.nz * 2.5];
      const [l2x, l2z] = [
          b.ox - b.nx * (far ? 3 : 5),
          b.oz - b.nz * (far ? 3 : 5),
        ],
        [l3x, l3z] = [a.ox - a.nx * (far ? 3 : 5), a.oz - a.nz * (far ? 3 : 5)];
      const M = cellOf((a.ox + b.ox) / 2, (a.oz + b.oz) / 2, far).main,
        y = yTop + 0.018;
      if (
        !far &&
        [
          [l0x, l0z],
          [l1x, l1z],
          [l2x, l2z],
          [l3x, l3z],
        ].some(([x, z]) => inTerm(x, z, 6))
      )
        continue;
      lawnPoly(
        [
          [l0x, l0z],
          [l1x, l1z],
          [l2x, l2z],
          [l3x, l3z],
        ],
        y,
      );
      if (!far && !tip && hash2(Math.floor(a.s / 36), 5) < 0.6)
        M.bar(l3x, l3z, l2x, l2z, 0.45, y, y + 0.8, COL.hedge, TL.LAWN); // (r2) clipped hedge on the river side
      if (a.s - lastTree > (far ? 15 : 10) && (tip || (k > 3 && k < 28))) {
        lastTree = a.s;
        const m = a.d * (0.45 + 0.2 * rng());
        COAST.trees.push({
          x: a.x + a.nx * m,
          z: a.z + a.nz * m,
          kind: "street",
          y: yTop,
        });
      }
    }
    stats.bumps += S.filter(
      (s, i) => s.d >= 15 && (i === 0 || S[i - 1].d < 15),
    ).length;
  };

  // ---- Manhattan: one closed ring (LAND_POLY: west side north -> south, east side south -> north)
  {
    const rng = mulberry32(88101);
    const ZN = (side, z) => {
      if (side === 0)
        return z < -2200
          ? {
              base: [3, 7],
              bump: 0.3,
              bh: [8, 22],
              cove: 0.14,
              st: [
                [ST.WALL, 0.5],
                [ST.RIP, 0.35],
                [ST.PLAT, 0.15],
              ],
              rail: "bars",
            }
          : z < -600
            ? {
                base: [3, 6],
                bump: 0.35,
                bh: [8, 24],
                cove: 0.06,
                st: [
                  [ST.WALL, 0.65],
                  [ST.PLAT, 0.35],
                ],
                rail: "picket",
              }
            : z < 1750
              ? {
                  base: [2.5, 5],
                  bump: 0.32,
                  bh: [8, 20],
                  cove: 0.05,
                  st: [
                    [ST.WALL, 0.55],
                    [ST.BULK, 0.25],
                    [ST.PLAT, 0.2],
                  ],
                  rail: "picket",
                }
              : {
                  base: [8, 14],
                  bump: 0.45,
                  bh: [10, 26],
                  cove: 0.1,
                  st: [
                    [ST.WALL, 0.85],
                    [ST.PLAT, 0.15],
                  ],
                  rail: "picket",
                };
      return z < -2700
        ? {
            base: [2, 7],
            bump: 0.15,
            bh: [6, 14],
            cove: 0.2,
            st: [
              [ST.RIP, 0.6],
              [ST.WALL, 0.4],
            ],
            rail: "pipe",
          }
        : z < -1830
          ? {
              base: [4, 8],
              bump: 0.22,
              bh: [6, 14],
              cove: 0.05,
              st: [
                [ST.PLAT, 0.6],
                [ST.WALL, 0.4],
              ],
              rail: "bars",
            }
          : z < -310
            ? {
                base: [2.5, 5],
                bump: 0.2,
                bh: [3, 7],
                cove: 0.05,
                st: [
                  [ST.WALL, 0.5],
                  [ST.PLAT, 0.5],
                ],
                rail: "bars",
              }
            : z < 1400
              ? {
                  base: [3, 7],
                  bump: 0.35,
                  bh: [8, 22],
                  cove: 0.15,
                  st: [
                    [ST.WALL, 0.6],
                    [ST.PLAT, 0.2],
                    [ST.RIP, 0.2],
                  ],
                  rail: "bars",
                }
              : {
                  base: [2.5, 5],
                  bump: 0.22,
                  bh: [6, 14],
                  cove: 0.05,
                  st: [
                    [ST.BULK, 0.35],
                    [ST.WALL, 0.65],
                  ],
                  rail: "picket",
                };
    };
    const pick = (A) => {
      let r = rng();
      for (const [v, p] of A) {
        if ((r -= p) <= 0) return v;
      }
      return A[0][0];
    };
    // keyframes per side along z: [{z, d, st, rail}] (d linear between keyframes; st / rail of the run starting there)
    const KF = [0, 1].map((side) => {
      const K = [];
      let z = G.Z_MIN,
        dPrev = 4;
      while (z < G.Z_MAX) {
        const Z = ZN(side, z),
          base = Z.base[0] + rng() * (Z.base[1] - Z.base[0]),
          r = rng();
        if (r < Z.bump) {
          // bump-out overlook: square (45%) or chamfered ends, a 2nd shallower step on long ones
          const len = 50 + rng() * 130,
            h = base + Z.bh[0] + rng() * (Z.bh[1] - Z.bh[0]);
          const t0 = rng() < 0.45 ? 1.5 : 7 + rng() * 14,
            t1 = rng() < 0.45 ? 1.5 : 7 + rng() * 14,
            st = rng() < 0.8 ? ST.WALL : pick(Z.st);
          K.push({ z, d: dPrev, st, rail: Z.rail });
          if (len > 110 && rng() < 0.5) {
            const m = h * (0.5 + rng() * 0.2),
              zs = z + 25 + rng() * 20;
            K.push(
              { z: z + t0, d: m, st, rail: Z.rail },
              { z: zs, d: m, st, rail: Z.rail },
              { z: zs + 1.5, d: h, st, rail: Z.rail },
            );
          } else K.push({ z: z + t0, d: h, st, rail: Z.rail });
          K.push({
            z: z + len - t1,
            d: h + (rng() - 0.5) * 3,
            st,
            rail: Z.rail,
          });
          z += len;
          dPrev = base;
        } else if (r < Z.bump + Z.cove) {
          // cove: the wall steps back to a riprap inlet
          const len = 30 + rng() * 45,
            t = 5 + rng() * 8;
          K.push(
            { z, d: dPrev, st: ST.RIP, rail: Z.rail },
            { z: z + t, d: 1.3, st: ST.RIP, rail: Z.rail },
            { z: z + len - t, d: 1.3, st: ST.RIP, rail: Z.rail },
          );
          z += len;
          dPrev = base;
        } else {
          // plain esplanade run with a gentle wobble
          const len = 40 + rng() * 130,
            t = 8 + rng() * 16,
            st = pick(Z.st);
          K.push(
            { z, d: dPrev, st, rail: Z.rail },
            { z: z + t, d: base, st, rail: Z.rail },
          );
          z += len;
          dPrev = base + (rng() - 0.5) * 2;
        }
      }
      K.push({ z: G.Z_MAX + 1, d: dPrev, st: ST.WALL, rail: "picket" });
      return K;
    });
    const kfAt = (K, z) => {
      let lo = 0,
        hi = K.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (K[m].z <= z) lo = m;
        else hi = m;
      }
      const a = K[lo],
        b = K[hi],
        t = Math.max(0, Math.min(1, (z - a.z) / Math.max(1e-6, b.z - a.z)));
      return { d: a.d + (b.d - a.d) * t, st: a.st, rail: a.rail };
    };
    const zMid = (G.Z_MIN + G.Z_MAX) / 2;
    const profile = (s) => {
      const side = s.nx < 0 ? 0 : 1; // outward normal west -> west side
      const q = kfAt(KF[side], s.z);
      // Battery: the south point rounds out into a broad granite promenade; Harlem / Inwood: a rough rocky point
      const wS = Math.max(0, Math.min(1, (s.z - 3040) / 250)),
        wN = Math.max(0, Math.min(1, (-3250 - s.z) / 190));
      if (wS > 0) {
        const e = wS * wS * (3 - 2 * wS);
        q.d = q.d * (1 - e) + 46 * e;
        if (e > 0.3) {
          q.st = ST.WALL;
          q.rail = "picket";
        }
      }
      if (wN > 0) {
        const e = wN * wN * (3 - 2 * wN);
        q.d = q.d * (1 - e) + (6 + 6 * hash2(Math.round(s.x / 20), 11)) * e;
        if (e > 0.3) {
          q.st = ST.RIP;
          q.rail = "pipe";
        }
      }
      return q;
    };
    const myPiers = piers.map((p) => ({
      side: p.x0 > 0 ? 1 : 0,
      z0: p.z0,
      z1: p.z1,
    }));
    const capsAt = (s) => {
      const side = s.nx < 0 ? 0 : 1;
      let out = null;
      const cap = (c, st, noRail) => {
        if (!out || c < out.cap) out = { cap: c, st, noRail };
      };
      if (side === 1)
        for (const B of BRIDGES) {
          const dz = Math.abs(s.z - B.z) - (B.width / 2 + 8);
          cap(1.2 + Math.max(0, dz), dz < 0 ? ST.BULK : undefined);
        }
      for (const p of myPiers)
        if (p.side === side) {
          const dz = Math.max(p.z0 - s.z, s.z - p.z1) - 6;
          cap(
            2.4 + Math.max(0, dz) * 0.9,
            dz < 0 ? ST.BULK : undefined,
            dz < -5.5,
          );
        }
      for (const f of pileFields)
        if (f.side === side) {
          const dz = Math.max(f.z0 - s.z, s.z - f.z1) - 4;
          cap(1.5 + Math.max(0, dz) * 0.9);
        }
      if (s.z > 3280 && Math.abs(s.x + 60) < 58) {
        if (out) out.noRail = true;
        else out = { cap: 1e9, noRail: true };
      } // (r2) ferry terminal apron: open to the slips
      return out;
    };
    run({
      pts: LAND_POLY,
      closed: true,
      far: false,
      yTop: WALK,
      profile,
      capsAt,
      rng,
      sideOf: (x, z) => onLand(x, z),
    });
  }

  // ---- (r2) Manhattan piers (ground.PIERS): timber fascia over the deck edges (the bare slab sides read black), timber
  // fender piles along the long sides (+ the head on the Hudson piers), ladders. The decks / sheds stay ground.ts'.
  for (const p of piers) {
    const east = p.x0 > 0,
      M = cellOf((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, false).main;
    const yT = p.y + 0.02,
      yD = p.y - 0.78,
      head = east ? p.x1 : p.x0,
      hx = east ? 1 : -1;
    M.wall(
      p.x0,
      p.z0 - 0.03,
      p.x1,
      p.z0 - 0.03,
      0,
      -1,
      yD,
      yT,
      0,
      COL.fascia,
      TL.PLANK,
      TS.PLANK,
    );
    M.wall(
      p.x0,
      p.z1 + 0.03,
      p.x1,
      p.z1 + 0.03,
      0,
      1,
      yD,
      yT,
      0,
      COL.fascia,
      TL.PLANK,
      TS.PLANK,
    );
    M.wall(
      head + hx * 0.03,
      p.z0,
      head + hx * 0.03,
      p.z1,
      hx,
      0,
      yD,
      yT,
      0,
      COL.fascia,
      TL.PLANK,
      TS.PLANK,
    );
    const x0 = Math.min(p.x0, p.x1) + 2,
      x1 = Math.max(p.x0, p.x1) - 2;
    for (let x = x0; x < x1; x += 4.5)
      for (const [zz, o] of [
        [p.z0, -0.3],
        [p.z1, 0.3],
      ])
        M.cyl(
          x,
          zz + o,
          0.19,
          WY - 2.2,
          yT + 0.12 + hash2(Math.round(x), Math.round(zz)) * 0.15,
          7,
          COL.pile,
          TL.PLANK,
          2,
        );
    if (!east) {
      // Hudson park piers: esplanade rail (ground.ts keeps the collision boxes) along both sides + the head
      const C2 = cellOf((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, false),
        yr = p.y,
        top = yr + 1.07;
      const rr = [
        [p.x1 - 2, p.z0 + 0.21, p.x0 + 0.3, p.z0 + 0.21, 0, -1],
        [p.x0 + 0.21, p.z0 + 0.3, p.x0 + 0.21, p.z1 - 0.3, -1, 0],
        [p.x0 + 0.3, p.z1 - 0.21, p.x1 - 2, p.z1 - 0.21, 0, 1],
      ];
      for (const [ax, az, bx, bz, nx, nz] of rr) {
        const L = Math.hypot(bx - ax, bz - az),
          ux = (bx - ax) / L,
          uz = (bz - az) / L;
        C2.main.bar(
          ax,
          az,
          bx,
          bz,
          0.06,
          top,
          top + 0.07,
          COL.timber,
          TL.PLANK,
          TS.PLANK,
        );
        C2.main.bar(
          ax,
          az,
          bx,
          bz,
          0.025,
          yr + 0.12,
          yr + 0.16,
          COL.steel,
          TL.SOLID,
        );
        for (let u = 0; u <= L; u += 2.4)
          C2.main.obox(
            ax + ux * u,
            az + uz * u,
            ux,
            uz,
            0.04,
            0.04,
            yr,
            top + 0.02,
            COL.steel,
            TL.SOLID,
          );
        for (const sd of [1, -1])
          C2.pick.poly(
            [
              [ax + nx * 0.012 * sd, yr + 0.16, az + nz * 0.012 * sd],
              [bx + nx * 0.012 * sd, yr + 0.16, bz + nz * 0.012 * sd],
              [bx + nx * 0.012 * sd, top, bz + nz * 0.012 * sd],
              [ax + nx * 0.012 * sd, top, az + nz * 0.012 * sd],
            ],
            [nx * sd, 0, nz * sd],
            [
              [0, 0],
              [L, 0],
              [L, 1],
              [0, 1],
            ],
            COL.steel,
            TL.PICKET,
          );
      }
    }
    if (!east)
      for (let z = p.z0 + 1.5; z < p.z1 - 1; z += 3)
        M.cyl(
          head - 0.3,
          z,
          0.19,
          WY - 2.2,
          yT + 0.15,
          7,
          COL.pile,
          TL.PLANK,
          2,
        );
    for (let x = x0 + 25; x < x1 - 10; x += 60)
      for (const [zz, o] of [
        [p.z0, -1],
        [p.z1, 1],
      ]) {
        const cz = zz + o * 0.12;
        for (const s2 of [-0.24, 0.24])
          M.obox(
            x + s2,
            cz,
            0,
            1,
            0.035,
            0.025,
            WY - 1.3,
            yT + 0.9,
            COL.rust,
            TL.SOLID,
          );
        for (let y = WY - 1.0; y < yT - 0.3; y += 0.3)
          M.obox(x, cz, 1, 0, 0.24, 0.018, y, y + 0.035, COL.rust, TL.SOLID);
      }
  }

  // ---- (r2) planted lawns on the big empty promenade / plaza fill (the island tips, the FiDi / Battery-Park-City
  // plazas, the Harlem point): coordinator r2 'polygon-clipped lawns, no 5 m stair steps, park grass not flat olive'.
  // Every promenade fill piece (ground.ts fillPieces: convex, one street row each) is inset 3 m from its curbs and cut
  // by half-planes at a distance from the seawall line of its row: 45 m where the waterfront highway runs (it keeps its
  // esplanade + roadway), 7 m where it does not (the tips: lawn right behind the rail walk). Trees in loose groves.
  {
    const apr = approachRects();
    const hwZ = [[], []];
    for (const R of highwayRuns()) for (const q of R.pts) hwZ[R.side].push(q.z);
    const hwOn = (side, za, zb) =>
      hwZ[side].some((z) => z > za - 10 && z < zb + 10);
    const cen = (P) => {
      let x = 0,
        z = 0;
      for (const q of P) {
        x += q[0];
        z += q[1];
      }
      return [x / P.length, z / P.length];
    };
    let nL = 0,
      lawnArea = 0;
    const lrnd = mulberry32(88404);
    for (const f of fills) {
      let P = f.poly;
      if (P.length < 3 || polyArea(P) < 60) continue;
      const [cx, cz] = cen(P);
      if (pointInPoly(BATTERY.poly, cx, cz) || cz > BATTERY.z0 - 2) continue; // Battery Park: its own lawns below
      const zs = P.map((q) => q[1]),
        za = Math.min(...zs),
        zb = Math.max(...zs),
        xs = P.map((q) => q[0]);
      if (
        apr.some(
          (r) =>
            Math.max(...xs) > r.x0 - 6 &&
            Math.min(...xs) < r.x1 + 6 &&
            zb > r.z0 - 6 &&
            za < r.z1 + 6,
        )
      )
        continue;
      const [wa, ea] = shoreX(za + 1e-3),
        [wb, eb] = shoreX(zb - 1e-3);
      if (Math.min(cx - (wa + wb) / 2, (ea + eb) / 2 - cx) > 260) continue;
      // curbs: inset 3 m from every non-shore edge
      for (let i = 0; i < f.poly.length && P.length >= 3; i++) {
        if (f.shore[i]) continue;
        const p0 = f.poly[i],
          p1 = f.poly[(i + 1) % f.poly.length],
          L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        if (L < 1e-3) continue;
        let nx = -(p1[1] - p0[1]) / L,
          nz = (p1[0] - p0[0]) / L;
        if ((cx - p0[0]) * nx + (cz - p0[1]) * nz < 0) {
          nx = -nx;
          nz = -nz;
        }
        P = clipPoly(P, (x, z) => (x - p0[0]) * nx + (z - p0[1]) * nz - 3);
      }
      // seawall lines of the row (both sides)
      for (const [side, A, B] of [
        [0, [wa, za], [wb, zb]],
        [1, [ea, za], [eb, zb]],
      ]) {
        if (P.length < 3) break;
        const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (L < 1e-3) continue;
        let nx = -(B[1] - A[1]) / L,
          nz = (B[0] - A[0]) / L;
        if (side === 0) {
          nx = -nx;
          nz = -nz;
        } // inward
        const D = hwOn(side, za, zb) ? 45 : 7;
        P = clipPoly(P, (x, z) => (x - A[0]) * nx + (z - A[1]) * nz - D);
      }
      if (P.length < 3 || polyArea(P) < 45) continue;
      lawnPoly(P, WALK + 0.018);
      nL++;
      lawnArea += polyArea(P);
      // loose groves: jittered 8.5 m grid, gaps from a slow field, kept 2 m inside the lawn
      const bx0 = Math.min(...P.map((q) => q[0])),
        bx1 = Math.max(...P.map((q) => q[0])),
        bz0 = Math.min(...P.map((q) => q[1])),
        bz1 = Math.max(...P.map((q) => q[1]));
      for (let x = bx0 + 3; x < bx1 - 2; x += 8.5)
        for (let z = bz0 + 3; z < bz1 - 2; z += 8.5) {
          const jx = x + (lrnd() - 0.5) * 4,
            jz = z + (lrnd() - 0.5) * 4,
            g =
              0.5 +
              0.5 * Math.sin(jx * 0.045 + 1.3) * Math.cos(jz * 0.037 - 0.4);
          if (lrnd() > 0.25 + 0.6 * g) continue;
          if (
            ![
              [0, 0],
              [2, 0],
              [-2, 0],
              [0, 2],
              [0, -2],
            ].every(([dx, dz]) => inConvexPoly(P, jx + dx, jz + dz))
          )
            continue;
          COAST.trees.push({
            x: jx,
            z: jz,
            kind: lrnd() < 0.2 ? "small" : "street",
            y: WALK,
          });
        }
    }
    stats.plazaLawns = nL;
    stats.plazaLawnM2 = Math.round(lawnArea);
  }

  // ---- (r2) Harlem / Inwood point (north tip): the promenade band is only ~16 m at the point (the grid is laid against
  // the un-pushed shoreline there), so no drive fits without moving blocks; it becomes a rough riverside park instead:
  // lawns (above), schist outcrops and boulders on the grass, planting beds, trees.
  {
    const hr = mulberry32(88505),
      M0 = (x, z) => cellOf(x, z, false).main;
    let nR = 0;
    for (let z = G.Z_MIN + 20; z < -3000; z += 9 + hr() * 10)
      for (const side of [0, 1]) {
        const [w, e] = shoreX(z);
        if (w >= e) continue;
        if (hwOnSide(side, z)) continue;
        const d = 7 + hr() * 9,
          x = side ? e - d : w + d;
        if (!onLand(x, z) || !streetsAt(x, z).fill || hr() < 0.35) continue;
        // an outcrop: 2-4 big schist boulders half sunk in the lawn, grey-brown
        const n = 2 + Math.floor(hr() * 3);
        for (let k = 0; k < n; k++) {
          const px = x + (hr() - 0.5) * 5,
            pz = z + (hr() - 0.5) * 5,
            sz = 0.9 + hr() * 1.3,
            R = ROCKS[Math.floor(hr() * ROCKS.length)],
            ang = hr() * 6.28,
            ca = Math.cos(ang),
            sa = Math.sin(ang),
            k2 = 0.62 + hr() * 0.25;
          const py = WALK - sz * 0.25;
          for (const tri of R) {
            const q = tri.map(([x0, y0, z0]) => [
              px + (x0 * ca - z0 * sa) * sz,
              py + y0 * sz,
              pz + (x0 * sa + z0 * ca) * sz,
            ]);
            const ux = q[1][0] - q[0][0],
              uy = q[1][1] - q[0][1],
              uz = q[1][2] - q[0][2],
              vx = q[2][0] - q[0][0],
              vy = q[2][1] - q[0][1],
              vz = q[2][2] - q[0][2];
            let nx = uy * vz - uz * vy,
              ny = uz * vx - ux * vz,
              nz = ux * vy - uy * vx;
            const L = Math.hypot(nx, ny, nz) || 1;
            nx /= L;
            ny /= L;
            nz /= L;
            if (
              (q[0][0] - px) * nx + (q[0][1] - py) * ny + (q[0][2] - pz) * nz <
              0
            ) {
              nx = -nx;
              ny = -ny;
              nz = -nz;
            }
            M0(px, pz).poly(
              q,
              [nx, ny, nz],
              q.map(([a, b, c]) => [(a + b * 0.5) / 2.2, (c + b * 0.5) / 2.2]),
              [0.66 * k2, 0.6 * k2, 0.52 * k2],
              TL.RIPRAP,
            );
          }
          solids?.box(
            px - sz * 0.75,
            WALK - 0.2,
            pz - sz * 0.65,
            px + sz * 0.75,
            py + sz * 0.5,
            pz + sz * 0.65,
            "ledge",
          );
          nR++;
        }
      }
    stats.harlemRocks = nR;
  }
  function hwOnSide(side, z) {
    for (const R of highwayRuns())
      if (
        R.side === side &&
        z > R.pts[0].z - 20 &&
        z < R.pts[R.pts.length - 1].z + 20
      )
        return true;
    return false;
  }

  // ---- (r2) Battery Park: coordinator 'a huge flat olive lawn with thin straight paths and a black disc'. One park lawn
  // (layout BATTERY.inner) with curving paver paths (Catmull-Rom ribbons, flush decals like Central Park's), tree-lined
  // walks and dense groves, planting beds, benches / lamps (props pools), a flagpole arc, a Castle-Clinton-like open
  // sandstone fort ring with gun ports, and a Whitehall-like ferry terminal with slips at the rounded point.
  {
    const br = mulberry32(88606),
      B = BATTERY,
      C = B.castle,
      yG = G.CURB_H + 0.02;
    const MB2 = (x, z) => cellOf(x, z, false).main;
    // lawn: the inner polygon minus the fort plaza circle (fan triangles clipped per wedge: exact, no stair steps)
    {
      const P = B.inner,
        R = B.plazaR,
        nW = 48;
      for (let k = 0; k < nW; k++) {
        // wedge k of the plane around the fort centre, clipped to the lawn and outside the circle
        const a0 = (k / nW) * 6.2832,
          a1 = ((k + 1) / nW) * 6.2832,
          c0 = [Math.cos(a0), Math.sin(a0)],
          c1 = [Math.cos(a1), Math.sin(a1)];
        let Q = clipPoly(P, (x, z) => c0[0] * (z - C.z) - c0[1] * (x - C.x));
        Q = clipPoly(Q, (x, z) => -(c1[0] * (z - C.z) - c1[1] * (x - C.x)));
        const cm = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2],
          cl = Math.hypot(...cm);
        Q = clipPoly(
          Q,
          (x, z) => ((x - C.x) * cm[0] + (z - C.z) * cm[1]) / cl - R,
        );
        if (Q.length >= 3 && polyArea(Q) > 0.5) lawnPoly(Q, yG - 0.001);
      }
      // the plaza ring itself stays fill; lawn wedges that the circle does not reach are whole (the clip is a no-op)
    }
    // curving paths (control points, metres), width
    const PATHS = [
      [
        [
          [-318, 3062],
          [-270, 3094],
          [-246, 3122],
          [-232, 3140],
        ],
        5,
      ],
      [
        [
          [-18, 3058],
          [-52, 3100],
          [-110, 3136],
          [-174, 3142],
        ],
        5,
      ],
      [
        [
          [150, 3060],
          [96, 3112],
          [30, 3168],
          [-30, 3230],
          [-58, 3281],
        ],
        4.2,
      ],
      [
        [
          [-205, 3171],
          [-196, 3212],
          [-150, 3256],
          [-100, 3278],
        ],
        4.2,
      ],
      [
        [
          [-96, 3122],
          [-40, 3160],
          [20, 3172],
          [70, 3150],
          [120, 3104],
        ],
        3.2,
      ],
      [
        [
          [-280, 3105],
          [-248, 3190],
          [-196, 3252],
          [-150, 3281],
        ],
        3.2,
      ],
    ];
    const cr = (Pts, step = 2) => {
      // Catmull-Rom sampled polyline
      const out = [];
      const n = Pts.length;
      for (let i = 0; i + 1 < n; i++) {
        const p0 = Pts[Math.max(0, i - 1)],
          p1 = Pts[i],
          p2 = Pts[i + 1],
          p3 = Pts[Math.min(n - 1, i + 2)],
          L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]),
          m = Math.max(2, Math.ceil(L / step));
        for (let k = 0; k < m; k++) {
          const t = k / m,
            t2 = t * t,
            t3 = t2 * t;
          out.push(
            [0, 1].map(
              (j) =>
                0.5 *
                (2 * p1[j] +
                  (-p0[j] + p2[j]) * t +
                  (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
                  (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3),
            ),
          );
        }
      }
      out.push(Pts[n - 1]);
      return out;
    };
    const lines = PATHS.map(([Pts, w]) => ({ pts: cr(Pts), hw: w / 2 }));
    const pathDist = (x, z) => {
      let best = Infinity;
      for (const L of lines)
        for (let i = 0; i + 1 < L.pts.length; i++) {
          const [ax, az] = L.pts[i],
            [bx, bz] = L.pts[i + 1],
            dx = bx - ax,
            dz = bz - az,
            l2 = dx * dx + dz * dz || 1,
            t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
          best = Math.min(
            best,
            Math.hypot(x - ax - dx * t, z - az - dz * t) - L.hw,
          );
        }
      return best;
    };
    const inLawn = (x, z, m = 0) =>
      inConvexPoly(B.inner, x, z) &&
      Math.hypot(x - C.x, z - C.z) > B.plazaR + m &&
      [
        [m, 0],
        [-m, 0],
        [0, m],
        [0, -m],
      ].every(([dx, dz]) => inConvexPoly(B.inner, x + dx, z + dz));
    const trees = [],
      far2 = (x, z, r) =>
        trees.every((t) => Math.hypot(t[0] - x, t[1] - z) > r);
    const addTree = (x, z, kind = "street", sc) => {
      trees.push([x, z]);
      COAST.trees.push({ x, z, kind, y: yG, ...(sc ? { sc } : {}) });
    };
    let nBench = 0,
      nLamp = 0;
    for (const L of lines) {
      const P = L.pts;
      let acc = 0,
        lastB = -8,
        lastL = -14,
        lastT = -3;
      for (let i = 0; i + 1 < P.length; i++) {
        const [ax, az] = P[i],
          [bx, bz] = P[i + 1],
          sl = Math.hypot(bx - ax, bz - az);
        if (sl < 1e-3) continue;
        const tx = (bx - ax) / sl,
          tz = (bz - az) / sl,
          nx = -tz,
          nz = tx;
        const pa = P[Math.max(0, i - 1)],
          pb = P[Math.min(P.length - 1, i + 2)]; // mitred ribbon via the neighbour tangents
        const tan = (u, v) => {
          const dx = v[0] - u[0],
            dz = v[1] - u[1],
            l = Math.hypot(dx, dz) || 1;
          return [-dz / l, dx / l];
        };
        const na = tan(pa, P[i + 1]),
          nb = tan(P[i], pb),
          y = yG + 0.006;
        MB2(ax, az).poly(
          [
            [ax + na[0] * L.hw, y, az + na[1] * L.hw],
            [bx + nb[0] * L.hw, y, bz + nb[1] * L.hw],
            [bx - nb[0] * L.hw, y, bz - nb[1] * L.hw],
            [ax - na[0] * L.hw, y, az - na[1] * L.hw],
          ],
          [0, 1, 0],
          [
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
          ],
          [0.9, 0.88, 0.86],
          TL.PAVE,
        );
        // granite edging strips along both sides (low: flush + 3 cm)
        for (const sd of [1, -1])
          MB2(ax, az).poly(
            [
              [ax + na[0] * sd * L.hw, y + 0.004, az + na[1] * sd * L.hw],
              [bx + nb[0] * sd * L.hw, y + 0.004, bz + nb[1] * sd * L.hw],
              [
                bx + nb[0] * sd * (L.hw + 0.3),
                y + 0.004,
                bz + nb[1] * sd * (L.hw + 0.3),
              ],
              [
                ax + na[0] * sd * (L.hw + 0.3),
                y + 0.004,
                az + na[1] * sd * (L.hw + 0.3),
              ],
            ],
            [0, 1, 0],
            [
              [acc / 1.8, 0],
              [(acc + sl) / 1.8, 0],
              [(acc + sl) / 1.8, 0.1],
              [acc / 1.8, 0.1],
            ],
            COL.coping,
            TL.GRANITE,
          );
        for (let u = 0; u < sl; u += 1) {
          const s2 = acc + u,
            x = ax + tx * u,
            z = az + tz * u;
          if (s2 - lastT > 8.5) {
            lastT = s2;
            for (const sd of [1, -1]) {
              const px = x + nx * sd * (L.hw + 2.4),
                pz = z + nz * sd * (L.hw + 2.4);
              if (
                inLawn(px, pz, 1.5) &&
                pathDist(px, pz) > 1.8 &&
                far2(px, pz, 5)
              )
                addTree(px, pz);
            }
          }
          if (s2 - lastB > 21) {
            lastB = s2;
            const sd = Math.floor(s2 / 21) & 1 ? 1 : -1,
              px = x + nx * sd * (L.hw + 0.9),
              pz = z + nz * sd * (L.hw + 0.9);
            if (inLawn(px, pz, 0.5) && pathDist(px, pz) > 0.5) {
              COAST.benches.push({
                x: px,
                z: pz,
                nx: nx * sd,
                nz: nz * sd,
                y: yG,
              });
              nBench++;
            }
          }
          if (s2 - lastL > 26) {
            lastL = s2;
            const sd = Math.floor(s2 / 26) & 1 ? -1 : 1,
              px = x + nx * sd * (L.hw + 0.7),
              pz = z + nz * sd * (L.hw + 0.7);
            if (inLawn(px, pz, 0.3)) {
              COAST.lamps.push({
                x: px,
                z: pz,
                nx: nx * sd,
                nz: nz * sd,
                y: yG,
              });
              nLamp++;
            }
          }
        }
        acc += sl;
      }
    }
    // dense groves between the walks (a slow field keeps a few open lawns), smaller understorey trees at the edges
    for (let x = B.x0 + 4; x < B.x1 - 3; x += 6.5)
      for (let z = B.z0 + 4; z < B.z1 - 3; z += 6.5) {
        const jx = x + (br() - 0.5) * 3.4,
          jz = z + (br() - 0.5) * 3.4,
          g =
            0.5 +
            0.5 * Math.sin(jx * 0.034 + 0.7) * Math.cos(jz * 0.041 + 1.9) +
            0.25 * Math.sin((jx + jz) * 0.09);
        if (g < 0.42 || br() > 0.85) continue;
        if (!inLawn(jx, jz, 2) || pathDist(jx, jz) < 2.6 || !far2(jx, jz, 4.2))
          continue;
        addTree(
          jx,
          jz,
          br() < 0.18 ? "small" : "street",
          g > 0.8 ? 1.2 + br() * 0.25 : undefined,
        );
      }
    // planting beds: granite-curbed beds of shrubs / flowers beside the walks
    const beds = [
      [0.55, 0.22, 0.24],
      [0.62, 0.5, 0.2],
      [0.42, 0.5, 0.3],
      [0.5, 0.3, 0.45],
    ];
    for (const L of lines)
      for (let i = 6; i + 6 < L.pts.length; i += 14 + Math.floor(br() * 10)) {
        const [ax, az] = L.pts[i],
          [bx, bz] = L.pts[i + 3],
          sl = Math.hypot(bx - ax, bz - az) || 1,
          tx = (bx - ax) / sl,
          tz = (bz - az) / sl,
          sd = br() < 0.5 ? 1 : -1;
        const cx = (ax + bx) / 2 - tz * sd * (L.hw + 1.9),
          cz = (az + bz) / 2 + tx * sd * (L.hw + 1.9);
        if (!inLawn(cx, cz, 3.2) || !far2(cx, cz, 3)) continue;
        const M = MB2(cx, cz);
        M.obox(
          cx,
          cz,
          tx,
          tz,
          3.2,
          1.2,
          yG - 0.05,
          yG + 0.38,
          COL.coping,
          TL.GRANITE,
          1.8,
        );
        M.obox(
          cx,
          cz,
          tx,
          tz,
          2.95,
          0.95,
          yG + 0.38,
          yG + 0.55,
          beds[Math.floor(br() * beds.length)],
          TL.LAWN,
        );
        M.obox(
          cx + tx * (br() - 0.5) * 3,
          cz + tz * (br() - 0.5) * 3,
          tx,
          tz,
          1.1,
          0.6,
          yG + 0.5,
          yG + 1.05,
          COL.hedge,
          TL.LAWN,
        );
        solids?.box(
          cx - 3.3,
          yG,
          cz - 3.3,
          cx + 3.3,
          yG + 0.38,
          cz + 3.3,
          "ledge",
        );
      }
    // Castle-Clinton-like fort: open sandstone ring (outer R, 2.4 m thick, 8.5 m), plinth, string course, gun ports,
    // granite coping, east entrance with pilasters. Collision: a chain of short cylinders along the wall (exact to ~0.2 m).
    {
      const R = C.r,
        Ri = R - 2.4,
        H = C.h,
        n = 72,
        gap = 0.16,
        y0 = G.CURB_H,
        sand = [0.72, 0.5, 0.4],
        cop = [0.78, 0.74, 0.68];
      const M = MB2(C.x, C.z),
        P = (r, a) => [C.x + Math.cos(a) * r, C.z + Math.sin(a) * r];
      const aOk = (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > gap; // east gap (angle 0 = +x)
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * 6.2832,
          a1 = ((k + 1) / n) * 6.2832,
          am = (a0 + a1) / 2;
        if (!aOk(a0) || !aOk(a1)) continue;
        const [o0x, o0z] = P(R, a0),
          [o1x, o1z] = P(R, a1),
          [i0x, i0z] = P(Ri, a0),
          [i1x, i1z] = P(Ri, a1),
          cm = Math.cos(am),
          sm = Math.sin(am),
          s0 = (k * R * 6.2832) / n;
        M.wall(
          o0x,
          o0z,
          o1x,
          o1z,
          cm,
          sm,
          y0,
          y0 + H,
          s0,
          sand,
          TL.GRANITE,
          3.2,
        );
        M.wall(
          i1x,
          i1z,
          i0x,
          i0z,
          -cm,
          -sm,
          y0,
          y0 + H,
          s0,
          sand,
          TL.GRANITE,
          3.2,
        );
        const [c0x, c0z] = P(R + 0.3, a0),
          [c1x, c1z] = P(R + 0.3, a1),
          [d0x, d0z] = P(Ri - 0.2, a0),
          [d1x, d1z] = P(Ri - 0.2, a1);
        M.poly(
          [
            [d0x, y0 + H + 0.5, d0z],
            [d1x, y0 + H + 0.5, d1z],
            [c1x, y0 + H + 0.5, c1z],
            [c0x, y0 + H + 0.5, c0z],
          ],
          [0, 1, 0],
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          cop,
          TL.GRANITE,
        );
        M.wall(
          c0x,
          c0z,
          c1x,
          c1z,
          cm,
          sm,
          y0 + H,
          y0 + H + 0.5,
          s0,
          cop,
          TL.GRANITE,
          1.8,
        );
        M.wall(
          d1x,
          d1z,
          d0x,
          d0z,
          -cm,
          -sm,
          y0 + H,
          y0 + H + 0.5,
          s0,
          cop,
          TL.GRANITE,
          1.8,
        );
        const [p0x, p0z] = P(R + 0.25, a0),
          [p1x, p1z] = P(R + 0.25, a1); // plinth
        M.wall(
          p0x,
          p0z,
          p1x,
          p1z,
          cm,
          sm,
          y0 - 0.1,
          y0 + 1.0,
          s0,
          cop,
          TL.GRANITE,
          1.8,
        );
        M.poly(
          [
            [o0x, y0 + 1.0, o0z],
            [o1x, y0 + 1.0, o1z],
            [p1x, y0 + 1.0, p1z],
            [p0x, y0 + 1.0, p0z],
          ],
          [0, 1, 0],
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          cop,
          TL.GRANITE,
        );
        const [q0x, q0z] = P(R + 0.12, a0),
          [q1x, q1z] = P(R + 0.12, a1); // string course
        M.wall(
          q0x,
          q0z,
          q1x,
          q1z,
          cm,
          sm,
          y0 + 5.9,
          y0 + 6.2,
          s0,
          cop,
          TL.GRANITE,
          1.8,
        );
        if (k % 3 === 1) {
          // gun port: dark embrasure with a pale stone surround
          const [g0x, g0z] = P(R + 0.03, am - 0.018),
            [g1x, g1z] = P(R + 0.03, am + 0.018),
            [h0x, h0z] = P(R + 0.02, am - 0.028),
            [h1x, h1z] = P(R + 0.02, am + 0.028);
          M.wall(
            h0x,
            h0z,
            h1x,
            h1z,
            cm,
            sm,
            y0 + 3.0,
            y0 + 4.75,
            0,
            cop,
            TL.GRANITE,
            1.8,
          );
          M.wall(
            g0x,
            g0z,
            g1x,
            g1z,
            cm,
            sm,
            y0 + 3.2,
            y0 + 4.5,
            0,
            [0.03, 0.03, 0.03],
            TL.SOLID,
          );
        }
      }
      for (const sg of [1, -1]) {
        // gap end faces + entrance pilasters
        const a = sg * gap,
          [ox, oz] = P(R, a),
          [ix, iz] = P(Ri, a),
          nx = -Math.sin(a) * sg,
          nz = Math.cos(a) * sg;
        M.wall(ix, iz, ox, oz, -nx, -nz, y0, y0 + H, 0, sand, TL.GRANITE, 3.2);
        const [px, pz] = P(R + 0.4, a + sg * 0.03);
        M.obox(
          px,
          pz,
          Math.cos(a),
          Math.sin(a),
          0.7,
          0.6,
          y0,
          y0 + H + 1.2,
          cop,
          TL.GRANITE,
          1.8,
        );
        solids?.box(
          px - 0.8,
          y0,
          pz - 0.8,
          px + 0.8,
          y0 + H + 1.2,
          pz + 0.8,
          "wall",
        );
      }
      const Rm = (R + Ri) / 2;
      for (let a = gap + 0.05; a < 6.2832 - gap - 0.05; a += 1.9 / Rm) {
        const [x, z] = P(Rm, a);
        solids?.cyl(x, z, y0, y0 + H + 0.5, 1.45, 1.45, "wall");
      }
      for (let a = gap + 0.3; a < 6.2832 - gap; a += 0.55) {
        const [x, z] = P(R, a);
        zips?.add(
          x,
          y0 + H + 0.5,
          z,
          Math.cos(a),
          0,
          Math.sin(a),
          "roofCorner",
        );
      }
    }
    // flagpole arc on the fort plaza's south side
    {
      const flagC = [
        [0.1, 0.12, 0.32],
        [0.55, 0.07, 0.07],
        [0.85, 0.85, 0.82],
        [0.1, 0.3, 0.2],
        [0.55, 0.07, 0.07],
        [0.1, 0.12, 0.32],
        [0.85, 0.7, 0.2],
      ];
      for (let i = 0; i < 7; i++) {
        const a = 0.95 + i * 0.2,
          x = C.x + Math.cos(a) * (B.plazaR - 2.5),
          z = C.z + Math.sin(a) * (B.plazaR - 2.5),
          top = G.CURB_H + 13 + (i === 3 ? 3 : 0),
          M = MB2(x, z);
        M.cyl(
          x,
          z,
          0.35,
          G.CURB_H,
          G.CURB_H + 0.5,
          8,
          COL.coping,
          TL.GRANITE,
          1.8,
        );
        M.cyl(x, z, 0.09, G.CURB_H + 0.5, top, 6, [0.78, 0.78, 0.76], TL.SOLID);
        M.cyl(x, z, 0.16, top, top + 0.3, 6, [0.7, 0.58, 0.25], TL.SOLID);
        const fx = Math.cos(a + 1.3),
          fz = Math.sin(a + 1.3); // flag hangs off the pole, drooping slightly downwind
        for (const sd of [1, -1])
          C &&
            M.poly(
              [
                [x, top - 0.3, z],
                [x + fx * 2.4, top - 0.45, z + fz * 2.4],
                [x + fx * 2.4, top - 1.95, z + fz * 2.4],
                [x, top - 1.8, z],
              ],
              [-fz * sd, 0, fx * sd],
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
              ],
              flagC[i],
              TL.SOLID,
            );
        solids?.cyl(x, z, G.CURB_H, top, 0.12, 0.12, "pole");
        zips?.add(x, top + 0.3, z, 0, 1, 0, "antenna");
      }
    }
    // Whitehall-like ferry terminal at the point: a tall glass hall under a deep canopy, slips with timber fender racks
    if (wall) {
      const { x0, x1, z0, z1 } = TERM,
        yT = G.CURB_H,
        h = 17;
      const gl = {
        floorH: 4.2,
        bayW: 3.2,
        winW: 0.92,
        winH: 0.84,
        layer: LAYER.METAL,
        base: LAYER.GRANITE,
        seed: 77,
        margin: 0,
        depth: 0.05,
        tint: [0.62, 0.78, 0.74],
        topY: yT + h,
        baseY: yT,
      };
      const cw = { style: STYLE.CURTAIN, gH: -0.01 },
        roof = {
          ...gl,
          style: STYLE.BLANK,
          layer: LAYER.ROOF_MEMBRANE,
          tint: [0.36, 0.4, 0.38],
        };
      wall.box(
        x0,
        yT,
        z0,
        x1,
        yT + h,
        z1,
        gl,
        { px: cw, nx: cw, pz: cw, nz: cw },
        true,
        false,
        roof,
      );
      solids?.box(x0, yT, z0, x1, yT + h, z1, "wall");
      const steel = {
        ...gl,
        style: STYLE.BLANK,
        layer: LAYER.METAL,
        tint: [0.22, 0.34, 0.3],
      };
      wall.box(
        x0 - 2,
        yT + h,
        z0 - 2,
        x1 + 2,
        yT + h + 1.2,
        z1 + 9,
        steel,
        {},
        true,
        true,
        { ...roof, tint: [0.3, 0.34, 0.33] },
      ); // deep canopy over the boarding apron
      solids?.box(x0 - 2, yT + h, z0 - 2, x1 + 2, yT + h + 1.2, z1 + 9, "roof");
      for (let x = x0; x <= x1 + 0.1; x += 10) {
        wall.box(
          x - 0.4,
          yT,
          z1 + 7.6,
          x + 0.4,
          yT + h,
          z1 + 8.4,
          steel,
          {},
          false,
        );
        solids?.box(x - 0.4, yT, z1 + 7.6, x + 0.4, yT + h, z1 + 8.4, "pole");
      }
      wall.box(
        x0 + 18,
        yT + h + 1.2,
        z0 + 6,
        x1 - 18,
        yT + h + 6,
        z0 + 16,
        gl,
        { px: cw, nx: cw, pz: cw, nz: cw },
        true,
        false,
        roof,
      ); // clerestory lantern
      solids?.box(
        x0 + 18,
        yT + h + 1.2,
        z0 + 6,
        x1 - 18,
        yT + h + 6,
        z0 + 16,
        "wall",
      );
      for (const [zx, zz, sx, sz] of [
        [x0 - 1.8, z0 - 1.8, -0.7, -0.7],
        [x1 + 1.8, z0 - 1.8, 0.7, -0.7],
        [x0 - 1.8, z1 + 8.8, -0.7, 0.7],
        [x1 + 1.8, z1 + 8.8, 0.7, 0.7],
      ])
        zips?.add(zx, yT + h + 1.2, zz, sx, 0, sz, "roofCorner");
      // slips: find the seawall edge south of the terminal, then 4 fender racks (3 slips) running 52 m out
      let zE = z1 + 9;
      while (zE < z1 + 80 && coastHeight(-60, zE + 0.5) !== null) zE += 0.5;
      for (const rx of [-86, -64, -42, -20]) {
        const Mx = MB2(rx, zE + 20);
        for (let z = zE + 1; z < zE + 52; z += 1.8)
          Mx.cyl(
            rx,
            z,
            0.22,
            WY - 2.2,
            G.CURB_H + 1.4 + hash2(Math.round(z), rx) * 0.3,
            7,
            COL.pile,
            TL.PLANK,
            2,
          );
        for (const sx of [-0.32, 0.32])
          for (const [y0, y1] of [
            [WY + 0.2, WY + 0.55],
            [G.CURB_H + 0.5, G.CURB_H + 0.85],
          ])
            Mx.bar(
              rx + sx,
              zE + 0.5,
              rx + sx,
              zE + 52,
              0.12,
              y0,
              y1,
              COL.fascia,
              TL.PLANK,
              TS.PLANK,
            );
        solids?.box(
          rx - 0.5,
          WY - 2.2,
          zE + 0.5,
          rx + 0.5,
          G.CURB_H + 1.4,
          zE + 52,
          "pier",
        );
        wetSegs.push(
          {
            ax: rx + 0.45,
            az: zE + 1,
            bx: rx + 0.45,
            bz: zE + 52,
            nx: 1,
            nz: 0,
          },
          {
            ax: rx - 0.45,
            az: zE + 52,
            bx: rx - 0.45,
            bz: zE + 1,
            nx: -1,
            nz: 0,
          },
        );
      }
      for (const [a, b] of [
        [-86, -64],
        [-64, -42],
        [-42, -20],
      ]) {
        // steel boarding aprons at the slip heads
        const Mx = MB2((a + b) / 2, zE);
        Mx.obox(
          (a + b) / 2,
          zE + 3,
          1,
          0,
          (b - a) / 2 - 3,
          3.2,
          G.CURB_H - 0.5,
          G.CURB_H + 0.05,
          [0.22, 0.3, 0.28],
          TL.SOLID,
        );
        solids?.box(
          a + 3,
          G.CURB_H - 0.5,
          zE - 0.2,
          b - 3,
          G.CURB_H + 0.05,
          zE + 6.2,
          "pier",
        );
        for (const sx of [a + 3.1, b - 3.1])
          Mx.bar(
            sx,
            zE,
            sx,
            zE + 6.2,
            0.04,
            G.CURB_H + 1.0,
            G.CURB_H + 1.07,
            COL.steel,
            TL.SOLID,
          );
      }
    }
    stats.battery = { trees: trees.length, benches: nBench, lamps: nLamp };
  }

  // ---- (r2) Manhattan piers: pitched corrugated roofs on the sheds (ridge + overhangs over the old flat top and
  // clerestory, exact ramp collision), roll-up doors along the long sides, park-grass lawns with a meandering walk
  // and trees on the lawn piers
  {
    const pr = mulberry32(88707),
      DOORS = [
        [0.46, 0.48, 0.47],
        [0.28, 0.36, 0.3],
        [0.52, 0.2, 0.16],
        [0.6, 0.58, 0.52],
        [0.24, 0.3, 0.4],
      ];
    for (const p of piers) {
      const S = p.shed;
      if (S) {
        const M = cellOf((S.x0 + S.x1) / 2, (S.z0 + S.z1) / 2, false).main,
          w = S.z1 - S.z0,
          rise = Math.max(3.8, Math.min(6, w * 0.2)),
          ye = S.y + S.h,
          zc = (S.z0 + S.z1) / 2;
        const ox = 0.9,
          oz = 0.7,
          xa = S.x0 - ox,
          xb = S.x1 + ox,
          za = S.z0 - oz,
          zb = S.z1 + oz,
          yr = ye + rise,
          ya = ye - (oz * rise) / (w / 2);
        const rc = S.rT.map((v) => Math.min(1, v * 1.5));
        const sl = Math.hypot(w / 2 + oz, rise),
          ny = (w / 2 + oz) / sl,
          nzz = rise / sl;
        M.poly(
          [
            [xa, ya, za],
            [xb, ya, za],
            [xb, yr, zc],
            [xa, yr, zc],
          ],
          [0, ny, -nzz],
          [
            [xa, 0],
            [xb, 0],
            [xb, sl],
            [xa, sl],
          ],
          rc,
          TL.RIB,
        );
        M.poly(
          [
            [xa, yr, zc],
            [xb, yr, zc],
            [xb, ya, zb],
            [xa, ya, zb],
          ],
          [0, ny, nzz],
          [
            [xa, 0],
            [xb, 0],
            [xb, sl],
            [xa, sl],
          ],
          rc,
          TL.RIB,
        );
        M.poly(
          [
            [xa, ya, za],
            [xb, ya, za],
            [xb, ya + 0.02, za - 0.01],
            [xa, ya + 0.02, za - 0.01],
          ],
          [0, -1, 0],
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          rc,
          TL.RIB,
        );
        for (const [x, nx] of [
          [S.x0, -1],
          [S.x1, 1],
        ]) {
          // gable ends (ribbed cladding) + ridge vent
          M.poly(
            [
              [x, ye, S.z0],
              [x, ye, S.z1],
              [x, yr - 0.2, zc],
            ],
            [nx, 0, 0],
            [
              [S.z0, ye],
              [S.z1, ye],
              [zc, yr],
            ],
            [0.6, 0.6, 0.57],
            TL.RIB,
          );
        }
        M.obox(
          (xa + xb) / 2,
          zc,
          1,
          0,
          (xb - xa) / 2 - 2,
          0.6,
          yr - 0.1,
          yr + 0.45,
          rc.map((v) => v * 0.8),
          TL.RIB,
        );
        solids?.ramp(xa, ye - 0.3, za, xb, zc, 2, ya, yr, "roof", 0, 0);
        solids?.ramp(xa, ye - 0.3, zc, xb, zb, 2, yr, ya, "roof", 0, 0);
        // roll-up doors on both long sides (+ one on the landward gable)
        const dh = Math.min(5.2, S.h - 1.6);
        for (const [z, nz] of [
          [S.z0 - 0.06, -1],
          [S.z1 + 0.06, 1],
        ])
          for (let x = S.x0 + 6 + pr() * 6; x < S.x1 - 8; x += 16 + pr() * 10) {
            const col = DOORS[Math.floor(pr() * DOORS.length)];
            M.wall(x, z, x + 4.6, z, 0, nz, S.y, S.y + dh, 0, col, TL.ROLL, 1);
            M.wall(
              x - 0.25,
              z + nz * 0.04,
              x + 4.85,
              z + nz * 0.04,
              0,
              nz,
              S.y + dh,
              S.y + dh + 0.45,
              0,
              [0.2, 0.2, 0.2],
              TL.SOLID,
            );
          }
      }
      for (const [a0, b0, a1, b1] of p.lawns ?? []) {
        // park-grass lawn over the pier lawn slab, a meandering walk, trees
        const y = p.y + 0.066,
          M = cellOf((a0 + a1) / 2, (b0 + b1) / 2, false).main;
        lawnPoly(
          [
            [a0 + 0.2, b0 + 0.2],
            [a1 - 0.2, b0 + 0.2],
            [a1 - 0.2, b1 - 0.2],
            [a0 + 0.2, b1 - 0.2],
          ],
          y,
        );
        const zm = (b0 + b1) / 2,
          amp = (b1 - b0) * 0.25,
          ph = pr() * 6;
        for (let x = a0; x < a1 - 0.1; x += 2) {
          const xb2 = Math.min(a1, x + 2),
            z0 = zm + amp * Math.sin(x * 0.05 + ph),
            z1 = zm + amp * Math.sin(xb2 * 0.05 + ph);
          M.poly(
            [
              [x, y + 0.005, z0 - 1.4],
              [xb2, y + 0.005, z1 - 1.4],
              [xb2, y + 0.005, z1 + 1.4],
              [x, y + 0.005, z0 + 1.4],
            ],
            [0, 1, 0],
            [
              [0, 0],
              [0, 0],
              [0, 0],
              [0, 0],
            ],
            [0.95, 0.92, 0.88],
            TL.PAVE,
          );
        }
        const shaded = (x, z) =>
          (p.shade ?? []).some(
            ([s0, t0, s1, t1]) =>
              x > s0 - 3 && x < s1 + 3 && z > t0 - 3 && z < t1 + 3,
          );
        for (let x = a0 + 4 + pr() * 4; x < a1 - 3; x += 10 + pr() * 5)
          for (const z of [b0 + 2.2, b1 - 2.2]) {
            if (
              shaded(x, z) ||
              Math.abs(z - (zm + amp * Math.sin(x * 0.05 + ph))) < 3.2 ||
              pr() < 0.2
            )
              continue;
            COAST.trees.push({
              x,
              z,
              kind: pr() < 0.3 ? "small" : "street",
              y,
            });
          }
      }
    }
  }

  // ---- far banks: every owned FAR_LANDS edge chain -> an open run at FAR_Y (lighter dressing)
  {
    const own = farOwned(),
      rng = mulberry32(88202);
    for (const L of FAR_LANDS) {
      const n = L.pts.length;
      if (L.name === "si") continue;
      const ok = (i) => own.has(L.name + ":" + ((i + n) % n));
      const all = [...Array(n).keys()].every(ok);
      const chains = [];
      if (all) chains.push({ pts: L.pts, closed: true });
      else
        for (let i = 0; i < n; i++) {
          if (!ok(i) || ok(i - 1)) continue; // chain start
          const pts = [L.pts[i]];
          let j = i;
          while (ok(j) && pts.length <= n) {
            pts.push(L.pts[(j + 1) % n]);
            j++;
          }
          chains.push({ pts, closed: false });
        }
      for (const ch of chains) {
        const K = [];
        let s0 = 0,
          dPrev = 3;
        while (s0 < 30000) {
          // keyframes along arc length
          const r = rng(),
            base = 2 + rng() * 4;
          if (r < 0.22) {
            const len = 60 + rng() * 140,
              h = base + 6 + rng() * 14;
            K.push(
              { s: s0, d: dPrev, st: ST.WALL },
              { s: s0 + 2 + rng() * 10, d: h, st: ST.WALL },
              { s: s0 + len - 8, d: h, st: ST.WALL },
            );
            s0 += len;
          } else if (r < 0.36) {
            const len = 40 + rng() * 60;
            K.push(
              { s: s0, d: dPrev, st: ST.RIP },
              { s: s0 + 8, d: 1.3, st: ST.RIP },
            );
            s0 += len;
          } else {
            const len = 60 + rng() * 160,
              st = [ST.BULK, ST.WALL, ST.PLAT, ST.RIP][Math.floor(rng() * 3.6)];
            K.push({ s: s0, d: dPrev, st }, { s: s0 + 10, d: base, st });
            s0 += len;
          }
          dPrev = base;
        }
        const profile = (s) => {
          let lo = 0,
            hi = K.length - 1;
          while (hi - lo > 1) {
            const m = (lo + hi) >> 1;
            if (K[m].s <= s.s) lo = m;
            else hi = m;
          }
          const a = K[lo],
            b = K[hi],
            t = Math.max(
              0,
              Math.min(1, (s.s - a.s) / Math.max(1e-6, b.s - a.s)),
            );
          return { d: a.d + (b.d - a.d) * t, st: a.st, rail: "pipe" };
        };
        const capsAt = (s) => {
          let out = null;
          for (const B of BRIDGES) {
            const dz = Math.abs(s.z - B.z) - (B.width / 2 + 10);
            const c = 1.2 + Math.max(0, dz);
            if (!out || c < out.cap)
              out = { cap: c, st: dz < 0 ? ST.BULK : undefined };
          }
          return out;
        };
        // (the profile needs s.s: runs compute arc length before calling profile)
        run({
          pts: ch.pts,
          closed: ch.closed,
          far: true,
          yTop: FAR_Y,
          profile,
          capsAt,
          rng,
          sideOf: (x, z) => pointInPoly(L.pts, x, z),
        });
        stats.far++;
      }
    }
  }

  // ---- meshes: one main (shadow-casting) + one picket-card mesh per cell
  const group = new THREE.Group();
  group.name = "coast";
  const picks = [],
    mains = [];
  let tris = 0,
    draws = 0;
  for (const [k, c] of cells) {
    const g = c.main.build();
    if (g) {
      const m = new THREE.Mesh(g, mat);
      m.name = "coast-" + k;
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.maxCascade = c.far ? 3 : 2;
      group.add(m);
      mains.push(m);
      tris += g.index.count / 3;
      draws++;
    }
    const gp = c.pick.build();
    if (gp) {
      const m = new THREE.Mesh(gp, mat);
      m.name = "coastPickets-" + k;
      m.receiveShadow = true;
      m.castShadow = false;
      m.userData.smallCasters = true;
      group.add(m);
      picks.push(m);
      tris += gp.index.count / 3;
      draws++;
    }
  }
  {
    // (r2) coordinator: 'lamp light pools along the esplanade at night'. The props lamp pool is dim (lighting2 r4 tuned it
    // for streets); the esplanade / Battery lamps get their own warmer, wider additive pools, night only (no draw by day),
    // one mesh per 2 km cell. Centred under the lamp head (the arm reaches ~1.9 m out along the lamp's facing).
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const g2 = cv.getContext("2d"),
      gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.3, "rgba(255,255,255,0.55)");
    gr.addColorStop(0.7, "rgba(255,255,255,0.12)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(1.0, 0.64, 0.32).multiplyScalar(0.6),
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      fog: false,
    });
    const pc = new Map();
    for (const L of COAST.lamps) {
      const cx = L.x - L.nx * 1.9,
        cz = L.z - L.nz * 1.9,
        y = (L.y ?? G.CURB_H) + 0.04,
        r = 6.5,
        k = Math.floor(cx / 2048) + "," + Math.floor(cz / 2048);
      let A = pc.get(k);
      if (!A) pc.set(k, (A = { P: [], U: [], I: [] }));
      const v = A.P.length / 3;
      A.P.push(
        cx - r,
        y,
        cz - r,
        cx + r,
        y,
        cz - r,
        cx + r,
        y,
        cz + r,
        cx - r,
        y,
        cz + r,
      );
      A.U.push(0, 0, 1, 0, 1, 1, 0, 1);
      A.I.push(v, v + 2, v + 1, v, v + 3, v + 2);
    }
    for (const [k, A] of pc) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(A.P, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(A.U, 2));
      g.setIndex(A.I);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, pm);
      m.name = "coastLampPools-" + k;
      m.renderOrder = 2;
      m.onBeforeRender = () => {
        pm.opacity = cityLights.enabled ? 0 : nightK.value;
      }; // (night) replaced by real lamp light
      group.add(nightOnly(m));
    }
  }
  for (const [k, L] of lawnCells) {
    const g = L.build();
    if (!g) continue;
    const m = new THREE.Mesh(g, lawnMat);
    m.name = "coastLawn-" + k;
    m.receiveShadow = true;
    group.add(m);
    tris += g.index.count / 3;
    draws++;
  }
  scene.add(group);
  const _c = new THREE.Vector3();
  const update = (camera) => {
    // pickets: sub-pixel beyond ~320 m -> hidden (the steel posts + rails stay)
    if (!camera) return;
    // (r3) from street level (camera below 45 m) cells more than 1.8 km away are behind the city / a hairline in the
    // haze: skip them (the street view saw ~13 coast cells up and down both rivers)
    const cp = camera.position,
      low = cp.y < 45;
    for (const m of mains) {
      const b = m.geometry.boundingBox;
      m.visible =
        !low ||
        Math.hypot(
          Math.max(b.min.x - cp.x, 0, cp.x - b.max.x),
          Math.max(b.min.z - cp.z, 0, cp.z - b.max.z),
        ) < 1800;
    }
    for (const m of picks) {
      m.geometry.boundingSphere.center &&
        _c.copy(m.geometry.boundingSphere.center);
      m.visible =
        camera.position.distanceTo(_c) - m.geometry.boundingSphere.radius < 320;
    }
  };
  COAST.built = true;
  if (typeof window !== "undefined") window.__coast = COAST;
  COAST.stats = {
    ...stats,
    cells: cells.size,
    meshes: draws,
    tris,
    quads: QH.length,
    lamps: COAST.lamps.length,
    benches: COAST.benches.length,
    trees: COAST.trees.length,
    ms: Math.round(performance.now() - t0),
  };
  console.log("[city] (coast r1) waterfront", JSON.stringify(COAST.stats));
  return { group, wetSegs, update };
}
