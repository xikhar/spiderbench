// @ts-nocheck
// Streets (asphalt shader w/ lane grime), sidewalks + curbs, road markings, park ground, water.
import { lazyShaderSections } from "../shaderSections.ts";
import groundShaderSource from "./shaders/glsl/ground.glsl?raw";
import { injectShader } from "../render/shaderInjection.ts";
import * as THREE from "three";
import {
  G,
  avenues,
  streets,
  inPark,
  mulberry32,
  closedAt,
  streetsAt,
  onLand,
  avActive,
  isActive,
  stRange,
  roadRects,
  NCOL,
  NROW,
  colRange,
  rowRange,
  blockCell,
  SHORE_Z,
  SHORE_W,
  SHORE_E,
  PARK_WATER,
  parkWaterAt,
  BRIDGES,
  blockPieces,
  DIAG_SEGS,
  VMAP,
  MAPS,
  FMAP,
  BATTERY, // (layout2 r4) MAPS / FMAP / BATTERY: FiDi street map + Battery Park
  islands,
  parkMedianAt,
  PARK_AV_I,
  PARK_MEDIAN,
  BIKE_LANES,
  BUS_LANES,
  hash2,
  ROUNDABOUT,
  nearRoundabout,
  cornerCuts,
  roundCorners,
  stHalf,
  stWide,
  stNarrow,
  ZFIX,
} from "./layout.ts"; // (layout2 r3) curb islands, Park Av median, bike lanes // (layout2) blockPieces, DIAG_SEGS (+ r2: VMAP)
import { GORE_HATCH } from "./junctionGoreHatching.ts"; // (layout2 r6) baked gore hatching (tools/gen_islands.mjs)
import { farShoreHeight } from "./farshore.ts";
import { buildWaterfront, coastHeight } from "./waterfront.ts"; // (coast r1) waterfront edge + shoreline fill
import { FacadeBuilder, STYLE, LAYER } from "./facade.ts";
import { OVERHANG } from "./collision.ts";
import { buildWater, createRiverMaterial } from "./water.ts";
import { PARK_CANOPY_EXTERNAL } from "./trees.ts";
import { PARK_MEADOWS, meadowDist } from "./parkData.ts";
import { adjustParkPaths } from "./park.ts"; // park agent: East Drive / paths clear the museum lot
import { CanopyBatch } from "./canopy.ts";
import { getQuality } from "../render/quality.ts";

const groundShader = lazyShaderSections(() => groundShaderSource);


// Heights of the rendered ground surfaces (single source of truth for geometry AND terrainHeight())
export const GY = {
  ROAD: 0,
  WALK: G.CURB_H,
  GRASS: G.CURB_H + 0.02,
  PATH: G.CURB_H + 0.02,
  OUTER: -0.05,
  FAR_SHORE: 1.2,
  WATER: G.WATER_Y,
};
export const PIERS = [];
export const PILE_FIELDS = []; // (coast r1) remnant pile fields {side, z0, z1}: the shoreline fill stays out of them

// Analytic terrain height matching the rendered asphalt / curbs / promenade / park / water / far shores exactly (C4).
export function terrainHeight(x, z) {
  if (!onLand(x, z))
    return coastHeight(x, z) ?? farShoreHeight(x, z) ?? GY.WATER; // (coast r1) + shoreline fill (waterfront.ts)
  const s = streetsAt(x, z).type;
  if (s === "park") {
    const w = parkWaterAt(x, z);
    return w ? w.y : GY.GRASS;
  }
  if (s === "avenue" || s === "street" || s === "intersection") return GY.ROAD;
  return GY.WALK;
}

// ------------------------------------------------------------------ asphalt
export function createAsphaltMaterial(T) {
  const quality = getQuality();
  const roadDetailLevel = quality.name === "low" ? 0 : quality.name === "med" ? 1 : 2;
  const roadDetailDistance = quality.name === "low" ? 0 : quality.name === "med" ? 190 : 700;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    defines: { ROAD_DETAIL_LEVEL: roadDetailLevel },
  });
  const uni = {
    tCol: { value: T.asphaltCol },
    tNrm: { value: T.asphaltNrm },
    tMacro: { value: T.asphaltMacro },
    tNoise: { value: T.noise },
    tDec: { value: T.asphaltDecals },
    uRoadDetailDist: { value: roadDetailDistance },
  }; // (textures r3) tDec
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",groundShader.vertexCommon,
      )
      .replace(
        "#include <fog_vertex>",groundShader.vertexFogVertex,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",groundShader.fragmentCommon,
      )
      .replace("#include <map_fragment>",groundShader.fragmentMap)
      .replace(
        "#include <roughnessmap_fragment>",groundShader.fragmentRoughness,
      )
      .replace(
        "#include <normal_fragment_maps>",groundShader.fragmentNormalMaps,
      );
  };
  mat.customProgramCacheKey = () => `city-asphalt-v10-${quality.name}`;
  return mat;
}

// ------------------------------------------------------------------ sidewalk (top: slabs + granite curb edge ; sides: curb face)
export function createSidewalkMaterial(T) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
  });
  const uni = {
    tCol: { value: T.sidewalkCol },
    tNrm: { value: T.sidewalkNrm },
    tNoise: { value: T.noise },
    tCurb: { value: T.curbCol ?? T.sidewalkCol },
  }; // (textures r2) tCurb: granite curb
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",groundShader.vertexCommonByWorldPosition,
      )
      .replace(
        "#include <fog_vertex>",groundShader.vertexFogVertexByWorldPosition,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",groundShader.fragmentCommonByWorldPosition,
      )
      .replace("#include <map_fragment>",groundShader.fragmentMapWalkingSurface)
      .replace(
        "#include <roughnessmap_fragment>",groundShader.fragmentRoughnessWalkingSurface,
      )
      .replace(
        "#include <normal_fragment_maps>",groundShader.fragmentNormalMapsByWorldNormal,
      );
  };
  mat.customProgramCacheKey = () => "city-sidewalk-v3"; // (foundation r13) (textures r2: v3 granite curb)
  return mat;
}

// rects: {x0,z0,x1,z1, y0?} axis-aligned curb boxes, or {poly:[[x,z],...] convex, shore:[bool per edge], rect?} promenade
// pieces (top + curb faces on the inland edges; shore edges get the seawall from buildGround)
function sidewalkGeometry(rects) {
  const P = [],
    N = [],
    R = [],
    I = [];
  let v = 0;
  const h = G.CURB_H;
  const quad = (pts, n, r) => {
    for (const p of pts) {
      P.push(...p);
      N.push(...n);
      R.push(...r);
    }
    const [a, b, c] = pts;
    const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0)
      I.push(v, v + 1, v + 2, v, v + 2, v + 3);
    else I.push(v, v + 2, v + 1, v, v + 3, v + 2);
    v += 4;
  };
  const NOR = [-1e5, -1e5, 1e5, 1e5];
  for (const r of rects) {
    if (r.poly) {
      const pts = r.poly,
        rr = r.rect ?? NOR,
        y0 = r.y0 ?? 0;
      const h = G.CURB_H + (r.lift ?? 0); // (zfix) r.lift: a piece that overlaps another sidewalk piece sits a few mm above it
      const base = v;
      for (const [x, z] of pts) {
        P.push(x, h, z);
        N.push(0, 1, 0);
        R.push(...rr);
      }
      for (let i = 1; i + 1 < pts.length; i++) {
        const [ax, az] = pts[0],
          [bx, bz] = pts[i],
          [cx, cz] = pts[i + 1];
        const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az); // y of (b-a)x(c-a)
        if (up >= 0) I.push(base, base + i, base + i + 1);
        else I.push(base, base + i + 1, base + i);
      }
      v += pts.length;
      // outward side faces on inland edges (polygon is convex: outward = away from the centroid)
      let mx = 0,
        mz = 0;
      for (const [x, z] of pts) {
        mx += x;
        mz += z;
      }
      mx /= pts.length;
      mz /= pts.length;
      for (let i = 0; i < pts.length; i++) {
        if (r.shore?.[i]) continue;
        const [ax, az] = pts[i],
          [bx, bz] = pts[(i + 1) % pts.length];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 1e-3) continue;
        let nx = (bz - az) / L,
          nz = -(bx - ax) / L;
        if (
          ((ax + bx) / 2) * nx + ((az + bz) / 2) * nz - (mx * nx + mz * nz) <
          0
        ) {
          nx = -nx;
          nz = -nz;
        }
        quad(
          [
            [ax, y0, az],
            [bx, y0, bz],
            [bx, h, bz],
            [ax, h, az],
          ],
          [nx, 0, nz],
          rr,
        );
      }
      continue;
    }
    const { x0, z0, x1, z1 } = r;
    const rr = [x0, z0, x1, z1];
    const y0 = r.y0 ?? 0;
    quad(
      [
        [x0, h, z1],
        [x1, h, z1],
        [x1, h, z0],
        [x0, h, z0],
      ],
      [0, 1, 0],
      rr,
    );
    quad(
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, h, z1],
        [x0, h, z1],
      ],
      [0, 0, 1],
      rr,
    );
    quad(
      [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, h, z0],
        [x1, h, z0],
      ],
      [0, 0, -1],
      rr,
    );
    quad(
      [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, h, z0],
        [x1, h, z1],
      ],
      [1, 0, 0],
      rr,
    );
    quad(
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, h, z1],
        [x0, h, z0],
      ],
      [-1, 0, 0],
      rr,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("aRect", new THREE.Float32BufferAttribute(R, 4));
  g.setIndex(new THREE.Uint32BufferAttribute(I, 1));
  g.computeBoundingSphere();
  return g;
}

// clip rect [x0,x1] x [z0,z1] (inside one shore row) against the land trapezoid -> convex polygon + shore-edge flags
function clipToLand(x0, x1, z0, z1, extra = null) {
  // (layout2 r4) extra: optional linear clip f(x, z) >= 0 (FiDi map edges)
  const [wa, ea] = shoreAt(z0),
    [wb, eb] = shoreAt(z1);
  let poly = [
    [x0, z0, 0],
    [x1, z0, 0],
    [x1, z1, 0],
    [x0, z1, 0],
  ]; // 3rd = edge flag of the edge starting at this vertex
  const clip = (P, f, tag) => {
    // keep f(x,z) >= 0
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const A = P[i],
        B = P[(i + 1) % P.length],
        fa = f(A[0], A[1]),
        fb = f(B[0], B[1]);
      if (fa >= 0) out.push(A);
      if (fa >= 0 !== fb >= 0) {
        const t = fa / (fa - fb);
        out.push([
          A[0] + (B[0] - A[0]) * t,
          A[1] + (B[1] - A[1]) * t,
          fa >= 0 ? tag : A[2],
        ]);
      }
    }
    // an edge created by this clip: from the entry vertex (tag) ... mark the edge that runs ALONG the clip line
    return out;
  };
  const lineW = (x, z) => x - (wa + ((wb - wa) * (z - z0)) / (z1 - z0));
  const lineE = (x, z) => ea + ((eb - ea) * (z - z0)) / (z1 - z0) - x;
  poly = clip(poly, lineW, 1);
  if (poly.length < 3) return null;
  poly = clip(poly, lineE, 1);
  if (poly.length < 3) return null;
  if (extra) {
    poly = clip(poly, extra, 0);
    if (poly.length < 3) return null;
  }
  // shore flag: both ends on a shore line
  const onW = (p) => Math.abs(lineW(p[0], p[1])) < 1e-4,
    onE = (p) => Math.abs(lineE(p[0], p[1])) < 1e-4;
  const shore = poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return (onW(p) && onW(q)) || (onE(p) && onE(q));
  });
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  if (Math.abs(area) < 0.5) return null;
  return { poly: poly.map((p) => [p[0], p[1]]), shore };
}
function shoreAt(z) {
  let lo = 0,
    hi = SHORE_Z.length - 1;
  if (z <= SHORE_Z[0]) return [SHORE_W[0], SHORE_E[0]];
  if (z >= SHORE_Z[hi]) return [SHORE_W[hi], SHORE_E[hi]];
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (SHORE_Z[m] <= z) lo = m;
    else hi = m;
  }
  const t = (z - SHORE_Z[lo]) / (SHORE_Z[hi] - SHORE_Z[lo]);
  return [
    SHORE_W[lo] + (SHORE_W[hi] - SHORE_W[lo]) * t,
    SHORE_E[lo] + (SHORE_E[hi] - SHORE_E[lo]) * t,
  ];
}

// Promenade / plaza fill: every part of every grid cell on land that is neither road, block nor park.
export function fillPieces(blocks) {
  const out = [];
  const P = G.PARK,
    PC = {
      x0: P.x0 - G.AV_WALK,
      x1: P.x1 + G.AV_WALK,
      z0: P.z0 - G.ST_WALK,
      z1: P.z1 + G.ST_WALK,
    };
  // blocks by row/col (merged T-junction blocks also cover the closed street row)
  const bAt = new Map();
  for (const b of blocks) {
    bAt.set(b.rj * 1000 + b.col, b);
    if (b.split) bAt.set((b.rj + 1) * 1000 + b.col, b);
  }
  for (let r = 0; r < NROW; r++) {
    let [z0, z1] = rowRange(r);
    z0 = Math.max(z0, G.Z_MIN);
    z1 = Math.min(z1, G.Z_MAX);
    if (z1 - z0 < 1e-3) continue;
    if (z0 >= FMAP.z0 + G.ST_HALF - 0.01) {
      // (layout2 r4) FiDi map rows: fill only outside the map's waterfront edge lines
      const cuts = [
        z0,
        ...FMAP.zs.filter((z) => z > z0 + 1e-6 && z < z1 - 1e-6),
        z1,
      ];
      for (let q = 0; q + 1 < cuts.length; q++) {
        const za = cuts[q],
          zb = cuts[q + 1];
        if (za >= FMAP.z1 - 1e-6) {
          const pc = clipToLand(G.X_MIN - 50, G.X_MAX + 50, za, zb);
          if (pc) out.push({ ...pc, cell: [0, r] });
          continue;
        }
        const lA = FMAP.lx(FMAP.left, za),
          lB = FMAP.lx(FMAP.left, zb),
          rA = FMAP.lx(FMAP.right, za),
          rB = FMAP.lx(FMAP.right, zb);
        const fl = (x, z) => lA + ((lB - lA) * (z - za)) / (zb - za) - x,
          fr = (x, z) => x - (rA + ((rB - rA) * (z - za)) / (zb - za));
        for (const f of [fl, fr]) {
          const pc = clipToLand(G.X_MIN - 50, G.X_MAX + 50, za, zb, f);
          if (pc) out.push({ ...pc, cell: [0, r] });
        }
      }
      continue;
    }
    for (let c = 0; c < NCOL; c++) {
      let [x0, x1] = colRange(c);
      x0 = Math.max(x0, G.X_MIN - 50);
      x1 = Math.min(x1, G.X_MAX + 50);
      // occupied x-intervals of this cell (spanning its full z-range)
      const occ = [];
      if (
        x0 >= PC.x0 - 0.01 &&
        x1 <= PC.x1 + 0.01 &&
        z0 >= PC.z0 - 0.01 &&
        z1 <= PC.z1 + 0.01
      )
        continue; // park region (own geometry)
      if (
        x0 >= VMAP.x0 + G.AV_HALF - 0.01 &&
        x1 <= VMAP.x1 - G.AV_HALF + 0.01 &&
        z0 >= VMAP.z0 + G.ST_HALF - 0.01 &&
        z1 <= VMAP.z1 - G.ST_HALF + 0.01
      )
        continue; // (layout2 r2) Village map (own geometry)
      const i = (c - 1) >> 1;
      if (c & 1) {
        if (r & 1) {
          if (isActive(i, (r - 1) >> 1)) occ.push([x0, x1]);
        } else if (r > 0 && avActive(i, r / 2 - 1)) occ.push([x0, x1]);
      } else if (r & 1) {
        const k = (r - 1) >> 1,
          s = stRange(k, c);
        if (s) occ.push(s);
        const b = bAt.get((k - 1) * 1000 + c);
        if (b && b.split === streets[k]) occ.push([b.x0, b.x1]);
      } else if (r > 0) {
        const b = bAt.get((r / 2 - 1) * 1000 + c);
        if (b) occ.push([b.x0, b.x1]);
      }
      occ.sort((a, b) => a[0] - b[0]);
      let x = x0;
      const free = [];
      for (const [a, b] of occ) {
        if (a > x + 1e-3) free.push([x, a]);
        x = Math.max(x, b);
      }
      if (x < x1 - 1e-3) free.push([x, x1]);
      for (const [a, b] of free) {
        const pc = clipToLand(a, b, z0, z1);
        if (pc) out.push({ ...pc, cell: [c, r] });
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ road markings (decals)
class DecalBuilder {
  constructor(rects) {
    this.R = rects;
    this.P = [];
    this.UV = [];
    this.C = [];
    this.I = [];
    this.v = 0;
  }
  // axis-aligned decal centred at (x,z), size sx (x) by sz (z), `rot` = 0: texture v runs along -z (north), 1: along +x, 2: +z, 3: -x
  add(name, x, z, sx, sz, rot = 0, color = [1, 1, 1], y = 0.012) {
    const [u0, v0, du, dv] = this.R[name];
    const hx = sx / 2,
      hz = sz / 2;
    const corners = [
      [x - hx, z + hz],
      [x + hx, z + hz],
      [x + hx, z - hz],
      [x - hx, z - hz],
    ]; // SW? (bl, br, tr, tl) when looking north
    let uvs = [
      [u0, v0],
      [u0 + du, v0],
      [u0 + du, v0 + dv],
      [u0, v0 + dv],
    ];
    for (let k = 0; k < rot; k++) uvs = [uvs[3], uvs[0], uvs[1], uvs[2]];
    for (let k = 0; k < 4; k++) {
      this.P.push(corners[k][0], y, corners[k][1]);
      this.UV.push(...uvs[k]);
      this.C.push(...color);
    }
    this.I.push(this.v, this.v + 1, this.v + 2, this.v, this.v + 2, this.v + 3);
    this.v += 4;
  }
  // (layout2) oriented decal: texture v runs along the unit direction (ux, uz); w across, l along
  addDir(name, x, z, w, l, ux, uz, color = [1, 1, 1], y = 0.012) {
    const [u0, v0, du, dv] = this.R[name];
    const rx = (-uz * w) / 2,
      rz = (ux * w) / 2,
      fx = (ux * l) / 2,
      fz = (uz * l) / 2;
    const corners = [
      [x - rx - fx, z - rz - fz],
      [x + rx - fx, z + rz - fz],
      [x + rx + fx, z + rz + fz],
      [x - rx + fx, z - rz + fz],
    ];
    const uvs = [
      [u0, v0],
      [u0 + du, v0],
      [u0 + du, v0 + dv],
      [u0, v0 + dv],
    ];
    for (let k = 0; k < 4; k++) {
      this.P.push(corners[k][0], y, corners[k][1]);
      this.UV.push(...uvs[k]);
      this.C.push(...color);
    }
    this.I.push(this.v, this.v + 1, this.v + 2, this.v, this.v + 2, this.v + 3);
    this.v += 4;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(
        new Array(this.v).fill(0).flatMap(() => [0, 1, 0]),
        3,
      ),
    );
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.UV, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.C, 3));
    g.setIndex(new THREE.Uint32BufferAttribute(this.I, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const YELLOW = [0.85, 0.62, 0.12];
const WHITE = [0.92, 0.92, 0.9];

function buildMarkings(T, rnd) {
  const D = new DecalBuilder(T.markRects);
  const zeb = () => "zebra" + Math.floor(rnd() * 4);
  const NS = streets.length;
  // does street k have a road leg touching avenue i on its west (-1) / east (+1) side?
  const leg = (i, k, side) => {
    const c = 2 * i + 1 + side,
      s = stRange(k, c);
    if (!s) return false;
    const e = avenues[i] + side * G.AV_HALF;
    return Math.abs((side < 0 ? s[1] : s[0]) - e) < 1e-3;
  };
  const crossed = (i, k) => isActive(i, k) && (leg(i, k, -1) || leg(i, k, 1));
  // --- avenues
  for (let i = 0; i < avenues.length; i++) {
    const a = avenues[i];
    for (let k = 0; k + 1 < NS; k++) {
      if (!avActive(i, k)) continue;
      const zA = streets[k] + stHalf(k),
        zB = streets[k + 1] - stHalf(k + 1); // segment z range (zA north end); (layout2 r9) per-street widths
      const xN = crossed(i, k),
        xS = crossed(i, k + 1);
      // crosswalks across the avenue at both ends
      for (const [zc, on] of [
        [zA + 2.3, xN],
        [zB - 2.3, xS],
      ]) {
        if (!on) continue;
        for (let x = a - G.AV_HALF + 0.9; x < a + G.AV_HALF - 0.5; x += 1.25)
          D.add(zeb(), x, zc, 0.62, 3.0, 0, WHITE);
        for (const xe of [a - G.AV_HALF - 0.35, a + G.AV_HALF + 0.35])
          if (streetsAt(xe, zc).cut) D.add(zeb(), xe, zc, 0.62, 3.0, 0, WHITE); // (layout2 r4) up to the curved ramp (hidden under the curb elsewhere)
      }
      // stop lines (NB on east half approaching zA, SB on west half approaching zB)
      if (xN)
        D.add(
          "line",
          a + G.AV_HALF / 2,
          zA + 4.6,
          G.AV_HALF - 0.4,
          0.45,
          1,
          WHITE,
        );
      if (xS)
        D.add(
          "line",
          a - G.AV_HALF / 2,
          zB - 4.6,
          G.AV_HALF - 0.4,
          0.45,
          1,
          WHITE,
        );
      // double yellow
      const y0 = zA + 5.2,
        y1 = zB - 5.2;
      D.add("line", a - 0.16, (y0 + y1) / 2, 0.12, y1 - y0, 0, YELLOW);
      D.add("line", a + 0.16, (y0 + y1) / 2, 0.12, y1 - y0, 0, YELLOW);
      const med = i === PARK_AV_I && parkMedianAt(k); // (layout2 r3) Park Av median: 2 lanes each way shifted outward
      const bike = BIKE_LANES.find((B) => B.i === i && zA > B.z0 && zB < B.z1); // (layout2 r3) curb-side bike lane
      if (bike) {
        const xs = a + bike.side * (G.AV_HALF - 0.95),
          xb = a + bike.side * (G.AV_HALF - 2.3);
        D.add(
          "line",
          xs,
          (y0 + y1) / 2,
          1.8,
          y1 - y0,
          0,
          [0.3, 0.52, 0.34],
          0.011,
        ); // green lane
        D.add(
          "line",
          xb + bike.side * 0.45,
          (y0 + y1) / 2,
          0.13,
          y1 - y0,
          0,
          WHITE,
        ); // buffer lines
        D.add(
          "line",
          xb - bike.side * 0.45,
          (y0 + y1) / 2,
          0.13,
          y1 - y0,
          0,
          WHITE,
        );
        for (let z = y0 + 3; z < y1 - 3; z += 4.5)
          D.add("line", xb, z, 0.9, 0.16, 0, WHITE); // buffer hatching
        for (let z = y0 + 10; z < y1 - 8; z += 26)
          D.add("arrow", xs, z, 0.9, 2.6, bike.side < 0 ? 2 : 0, WHITE, 0.013); // direction arrows
      }
      // (layout2 r8) red bus lane in the curb lane (BUS ONLY every ~45 m, solid white edge line; the last 14 m before each
      // stop line stay plain asphalt for the right turns). Paint only: the traffic lanes are unchanged.
      const busS = med
        ? []
        : BUS_LANES.filter(
            (B) => B.i === i && B.side !== bike?.side && zA > B.z0 && zB < B.z1,
          ).map((B) => B.side);
      for (const sd of busS) {
        const xs = a + sd * 9.05,
          b0 = y0 + 14,
          b1 = y1 - 14;
        if (b1 - b0 < 8) continue;
        D.add(
          "line",
          xs,
          (b0 + b1) / 2,
          3.4,
          b1 - b0,
          0,
          [0.62, 0.2, 0.15],
          0.0115,
        );
        D.add(
          "line",
          a + sd * 7.25,
          (b0 + b1) / 2,
          0.15,
          b1 - b0,
          0,
          WHITE,
          0.012,
        );
        for (let z = b0 + 8; z < b1 - 6; z += 45) {
          const r = sd > 0 ? 0 : 2;
          D.add("bus", xs, z + (sd < 0 ? 0 : 2.2), 2.6, 1.6, r, WHITE, 0.0125);
          D.add("only", xs, z + (sd < 0 ? 2.2 : 0), 2.8, 1.6, r, WHITE, 0.0125);
        }
      }
      // lane dashes (3 m dash, 9 m gap); (layout2 r8) per-segment paint age: fresh / worn / nearly gone
      const fade = ((h) => (h < 0.3 ? 0.55 : h < 0.75 ? 0.8 : 1))(
          hash2(i * 7 + 3, k * 13 + 5),
        ),
        WL = WHITE.map((c) => c * fade);
      for (const off of med
        ? [
            -(PARK_MEDIAN.lane0 + PARK_MEDIAN.lane1) / 2,
            (PARK_MEDIAN.lane0 + PARK_MEDIAN.lane1) / 2,
          ]
        : [-7.2, -3.6, 3.6, 7.2]) {
        if (busS.includes(Math.sign(off)) && Math.abs(off) > 7) continue; // the bus lane has its solid edge line
        for (let z = y0 + 4; z < y1 - 4; z += 12)
          D.add("line", a + off, z, 0.13, 3.0, 0, WL);
      }
      // turn arrows 7 m behind stop lines
      if (med) {
        // (layout2 r3) turn arrows in the shifted lanes (after the rnd draws below stay in step: none consumed here)
        if (xN) {
          D.add("arrowL", a + PARK_MEDIAN.lane0, zA + 12, 1.7, 4.8, 0, WHITE);
          D.add("arrow", a + PARK_MEDIAN.lane1, zA + 12, 1.3, 4.8, 0, WHITE);
        }
        if (xS) {
          D.add("arrowL", a - PARK_MEDIAN.lane0, zB - 12, 1.7, 4.8, 2, WHITE);
          D.add("arrow", a - PARK_MEDIAN.lane1, zB - 12, 1.3, 4.8, 2, WHITE);
        }
      } else if (xN && rnd() < 0.75) {
        D.add("arrowL", a + 1.8, zA + 12, 1.7, 4.8, 0, WHITE);
        D.add("arrow", a + 5.4, zA + 12, 1.3, 4.8, 0, WHITE);
        D.add("arrow", a + 9.0, zA + 12, 1.3, 4.8, 0, WHITE);
      }
      if (!med && xS && rnd() < 0.75) {
        D.add("arrowL", a - 1.8, zB - 12, 1.7, 4.8, 2, WHITE);
        D.add("arrow", a - 5.4, zB - 12, 1.3, 4.8, 2, WHITE);
        D.add("arrow", a - 9.0, zB - 12, 1.3, 4.8, 2, WHITE);
      }
      // bus lane text in the curb lanes
      if (rnd() < 0.45 && !med && bike?.side !== 1 && !busS.includes(1)) {
        D.add("bus", a + 9.0, zA + 22, 2.6, 1.6, 0, YELLOW);
        D.add("stop", a + 9.0, zA + 19.6, 2.8, 1.6, 0, YELLOW);
      }
      if (rnd() < 0.45 && !med && bike?.side !== -1 && !busS.includes(-1)) {
        D.add("bus", a - 9.0, zB - 22, 2.6, 1.6, 2, YELLOW);
        D.add("stop", a - 9.0, zB - 19.6, 2.8, 1.6, 2, YELLOW);
      }
      // manholes / plates
      const n = 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const lane = Math.floor(rnd() * 6);
        const x = a - 9 + lane * 3.6 + (rnd() - 0.5) * 1.2;
        const z = y0 + 8 + rnd() * (y1 - y0 - 16);
        if (rnd() < 0.75) D.add("manhole", x, z, 0.85, 0.85, 0, WHITE, 0.014);
        else
          D.add("plate", x, z, 2.4, 1.3, Math.floor(rnd() * 2), WHITE, 0.014);
      }
      // storm grates at the curbs near corners
      D.add("grate", a - G.AV_HALF + 0.3, zA + 8, 0.5, 1.0, 1, WHITE, 0.014);
      D.add("grate", a + G.AV_HALF - 0.3, zB - 8, 0.5, 1.0, 1, WHITE, 0.014);
    }
  }
  // --- streets (one-way, alternating direction)
  for (let k = 0; k < NS; k++) {
    const z = streets[k],
      hk = stHalf(k),
      wide = stWide(k),
      narrow = stNarrow(k); // (layout2 r9) per-street widths
    const dir = k % 2 === 0 ? 1 : -1; // +1 eastbound
    for (let c = 0; c < 2 * avenues.length + 1; c += 2) {
      const sg = stRange(k, c);
      if (!sg) continue;
      const [xA, xB] = sg;
      const iW = c / 2 - 1,
        iE = c / 2;
      const wOn =
        iW >= 0 &&
        isActive(iW, k) &&
        Math.abs(xA - (avenues[iW] + G.AV_HALF)) < 1e-3;
      const eOn =
        iE < avenues.length &&
        isActive(iE, k) &&
        Math.abs(xB - (avenues[iE] - G.AV_HALF)) < 1e-3;
      for (const [xc, on] of [
        [xA + 2.3, wOn],
        [xB - 2.3, eOn],
      ]) {
        if (!on) continue;
        // (layout2 r8) critic r7: 'crosswalks everywhere are identical zebra stripes' -> ~1 in 4 side-street crossings are
        // the older two-line kind, ~1 in 6 zebras are worn half-gone
        const hs = hash2(Math.round(xc * 3) + 11, k * 31 + 7);
        if (hs < 0.26 && !wide) {
          for (const o of [-1.45, 1.45])
            D.add(
              "line",
              xc + o,
              z,
              0.3,
              2 * hk - 0.5,
              0,
              WHITE.map((c) => c * (0.7 + hs)),
            );
          continue;
        }
        const ZC = hs > 0.83 ? WHITE.map((c) => c * 0.6) : WHITE;
        for (let zz = z - hk + 0.9; zz < z + hk - 0.5; zz += 1.25)
          D.add(zeb(), xc, zz, 3.0, 0.62, 1, ZC);
        for (const ze of [z - hk - 0.35, z + hk + 0.35])
          if (streetsAt(xc, ze).cut) D.add(zeb(), xc, ze, 3.0, 0.62, 1, WHITE); // (layout2 r4)
      }
      if (wide) {
        // (layout2 r9) wide two-way street: double yellow, lane dashes, a stop line on each approach half, turn arrows
        const x0 = xA + (wOn ? 5.2 : 1),
          x1 = xB - (eOn ? 5.2 : 1),
          fade = ((h) => (h < 0.3 ? 0.55 : h < 0.75 ? 0.8 : 1))(
            hash2(k * 7 + 5, c * 13 + 3),
          ),
          WL = WHITE.map((q) => q * fade);
        if (x1 - x0 > 8) {
          D.add("line", (x0 + x1) / 2, z - 0.16, x1 - x0, 0.12, 0, YELLOW);
          D.add("line", (x0 + x1) / 2, z + 0.16, x1 - x0, 0.12, 0, YELLOW);
          for (const off of [-3.25, 3.25])
            for (let x = x0 + 4; x < x1 - 4; x += 12)
              D.add("line", x, z + off, 3.0, 0.13, 0, WL);
        }
        if (eOn) {
          D.add("line", xB - 4.6, z + hk / 2, 0.45, hk - 0.4, 0, WHITE);
          D.add("arrowL", xB - 12, z + 1.6, 4.8, 1.7, 3, WHITE);
          D.add("arrow", xB - 12, z + 4.9, 4.8, 1.3, 3, WHITE);
        }
        if (wOn) {
          D.add("line", xA + 4.6, z - hk / 2, 0.45, hk - 0.4, 0, WHITE);
          D.add("arrowL", xA + 12, z - 1.6, 4.8, 1.7, 1, WHITE);
          D.add("arrow", xA + 12, z - 4.9, 4.8, 1.3, 1, WHITE);
        }
      } else if (dir > 0 && eOn)
        D.add("line", xB - 4.6, z, 0.45, 2 * hk - 0.4, 0, WHITE);
      else if (dir < 0 && wOn)
        D.add("line", xA + 4.6, z, 0.45, 2 * hk - 0.4, 0, WHITE);
      if (rnd() < 0.5 && xB - xA > 40 && !wide)
        D.add(
          "arrow",
          dir > 0 ? xB - 11 : xA + 11,
          narrow ? z - dir : z,
          4.8,
          1.3,
          dir > 0 ? 3 : 1,
          WHITE,
        );
      const n = 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < n && xB - xA > 30; j++)
        D.add(
          "manhole",
          xA + 10 + rnd() * (xB - xA - 20),
          z + (rnd() - 0.5) * (2 * hk - 6),
          0.85,
          0.85,
          0,
          WHITE,
          0.014,
        );
    }
  }
  // --- (layout2) Broadway / angled streets: runs of their own asphalt between the grid roads they cross get a double
  // yellow (two-way), lane dashes, stop lines and zebra crosswalks at both mouths (the block sidewalks' walkers cross there)
  const r2 = mulberry32(4242);
  for (const s of DIAG_SEGS) {
    const runs = [];
    let t0 = null;
    for (let t = 0; t <= s.len; t += 0.5) {
      const on = streetsAt(s.ax + s.ux * t, s.az + s.uz * t).diag === s;
      if (on && t0 === null) t0 = t;
      if ((!on || t + 0.5 > s.len) && t0 !== null) {
        runs.push([t0, on ? t : t - 0.5]);
        t0 = null;
      }
    }
    const P = (t, v) => [
      s.ax + s.ux * t + s.nx * v,
      s.az + s.uz * t + s.nz * v,
    ];
    // (citylife junctions r3) Broadway south of Columbus Circle is one-way southbound (npc/roads.ts: lanes 1.2 m left and
    // 2.4 m right of the centre line, parking at both curbs): white lane dashes, one stop line, straight arrows
    const oneWay =
      s.name === "BROADWAY" && Math.min(s.az, s.bz) >= ROUNDABOUT.z - 1;
    const twoWay = s.kind === "broadway" && !oneWay;
    for (const [a, b] of runs) {
      if (b - a < 6) continue;
      const cw = 3.0,
        xw = a + 0.8 + cw / 2,
        xe = b - 0.8 - cw / 2; // crosswalk centres
      for (const tc of [xw, xe])
        for (let v = -s.hw + 0.9; v < s.hw - 0.5; v += 1.25) {
          const [x, z] = P(tc, v);
          D.addDir(zeb(), x, z, 0.62, cw, s.ux, s.uz, WHITE);
        }
      const y0 = a + 5.2,
        y1 = b - 5.2;
      if (y1 - y0 < 2) continue;
      if (twoWay) {
        for (const v of [-0.16, 0.16]) {
          const [x, z] = P((y0 + y1) / 2, v);
          D.addDir("line", x, z, 0.12, y1 - y0, s.ux, s.uz, YELLOW);
        }
        {
          const [x, z] = P(y1 - 0.2, s.hw / 2);
          D.addDir("line", x, z, 0.45, s.hw - 0.4, s.nx, s.nz, WHITE);
        } // stop lines
        {
          const [x, z] = P(y0 + 0.2, -s.hw / 2);
          D.addDir("line", x, z, 0.45, s.hw - 0.4, s.nx, s.nz, WHITE);
        }
        for (const v of [-s.hw / 2, s.hw / 2])
          for (let t = y0 + 4; t < y1 - 4; t += 12) {
            const [x, z] = P(t + 1.5, v);
            D.addDir("line", x, z, 0.13, 3.0, s.ux, s.uz, WHITE);
          }
      } else if (oneWay) {
        // travel along +u (the segments run north -> south)
        for (let t = y0 + 4; t < y1 - 4; t += 12) {
          const [x, z] = P(t + 1.5, 0.6);
          D.addDir("line", x, z, 0.13, 3.0, s.ux, s.uz, WHITE);
        } // lane dashes
        for (const v of [-3.0, 4.2]) {
          const [x, z] = P((y0 + y1) / 2, v);
          D.addDir("line", x, z, 0.12, y1 - y0, s.ux, s.uz, WHITE);
        } // parking-lane edges
        {
          const [x, z] = P(y1 - 0.2, 0.6);
          D.addDir("line", x, z, 0.45, 7.4, s.nx, s.nz, WHITE);
        } // stop line across both lanes
        if (y1 - y0 > 30)
          for (const v of [-1.2, 2.4]) {
            const [x, z] = P(y1 - 12, v);
            D.addDir("arrow", x, z, 1.3, 4.8, s.ux, s.uz, WHITE);
          }
        if (y1 - y0 > 70)
          for (const v of [-1.2, 2.4]) {
            const [x, z] = P(y0 + 14, v);
            D.addDir("arrow", x, z, 1.3, 4.8, s.ux, s.uz, WHITE);
          }
      }
      for (
        let j = 0, n = 1 + Math.floor(r2() * 2);
        j < n && y1 - y0 > 16;
        j++
      ) {
        const [x, z] = P(y0 + 8 + r2() * (y1 - y0 - 16), (r2() - 0.5) * s.hw);
        D.add("manhole", x, z, 0.85, 0.85, 0, WHITE, 0.014);
      }
    }
  }
  // --- (layout2 r6) critic r5: 'huge undifferentiated asphalt at the diagonal crossings, no channelization'. The asphalt
  // that no traffic lane or turn connector uses (baked by tools/gen_islands.mjs) gets painted gore hatching
  for (const [x, z, l, dx, dz] of GORE_HATCH)
    D.addDir("line", x, z, 0.35, l, dx, dz, WHITE);
  // --- (layout2 r2) Village street map: between the junction boxes (where both curbs are present) a double yellow,
  // stop lines and zebra crosswalks at both ends, a manhole or two
  for (const s of MAPS.flatMap((M) => M.segs)) {
    // (layout2 r4) every street map
    const P = (t, v) => [
      s.ax + s.ux * t + s.nx * v,
      s.az + s.uz * t + s.nz * v,
    ];
    // (layout2 r4) a rounded kerb return (cut) counts as curb: the crosswalks sit at the corner, on the curved ramps
    const isC = (q) => q.cut || ["sidewalk", "block", "park"].includes(q.type),
      curbs = (t) =>
        isC(streetsAt(...P(t, s.hw + 1))) && isC(streetsAt(...P(t, -s.hw - 1)));
    let a = null,
      b = null;
    for (let t = 0; t <= s.len; t += 0.5)
      if (curbs(t)) {
        if (a === null) a = t;
        b = t;
      }
    if (a === null || b - a < 8) continue;
    const cw = 3.0,
      xw = a + 0.6 + cw / 2,
      xe = b - 0.6 - cw / 2;
    for (const tc of [xw, xe])
      for (let v = -s.hw + 0.8; v < s.hw - 0.5; v += 1.25) {
        const [x, z] = P(tc, v);
        D.addDir(zeb(), x, z, 0.62, cw, s.ux, s.uz, WHITE);
      }
    const y0 = a + 4.6,
      y1 = b - 4.6;
    if (y1 - y0 < 2) continue;
    if (s.oneway) {
      // (layout2 r4) one-lane one-way street: no centre line, a full-width stop bar at the exit end
      const [x, z] = P(s.oneway > 0 ? y1 - 0.2 : y0 + 0.2, 0);
      D.addDir("line", x, z, 0.4, 2 * s.hw - 0.8, s.nx, s.nz, WHITE);
    } else {
      for (const v of [-0.14, 0.14]) {
        const [x, z] = P((y0 + y1) / 2, v);
        D.addDir("line", x, z, 0.11, y1 - y0, s.ux, s.uz, YELLOW);
      }
      {
        const [x, z] = P(y1 - 0.2, s.hw / 2);
        D.addDir("line", x, z, 0.4, s.hw - 0.4, s.nx, s.nz, WHITE);
      }
      {
        const [x, z] = P(y0 + 0.2, -s.hw / 2);
        D.addDir("line", x, z, 0.4, s.hw - 0.4, s.nx, s.nz, WHITE);
      }
    }
    for (let j = 0, n = 1 + Math.floor(r2() * 2); j < n && y1 - y0 > 16; j++) {
      const [x, z] = P(y0 + 8 + r2() * (y1 - y0 - 16), (r2() - 0.5) * s.hw);
      D.add("manhole", x, z, 0.85, 0.85, 0, WHITE, 0.014);
    }
  }
  // (layout2 r3) tactile warning pads (yellow) at the crossing ramps of every rounded kerb return, following the curve
  // (layout2 r4) each pad sits where a crosswalk (centred 2.3 m from the corner along the curb line) meets the curved
  // curb, squared to the crossing direction, so crosswalk, ramp and pad line up
  for (const K of cornerCuts()) {
    if (K.r < 2.2) continue;
    const tl = Math.hypot(K.T1[0] - K.V[0], K.T1[1] - K.V[1]);
    for (const [e, f] of [
      [K.a, K.b],
      [K.b, K.a],
    ]) {
      const d = e[0] * f[0] + e[1] * f[1];
      let ox = -(f[0] - d * e[0]),
        oz = -(f[1] - d * e[1]);
      const ol = Math.hypot(ox, oz) || 1;
      ox /= ol;
      oz /= ol; // toward the road
      const sC = Math.min(2.3, tl - 0.4),
        dt = sC - tl;
      if (Math.abs(dt) >= K.r) continue;
      const t = K.r - Math.sqrt(K.r * K.r - dt * dt),
        px = K.V[0] + e[0] * sC - ox * t,
        pz = K.V[1] + e[1] * sC - oz * t; // on the arc
      D.addDir(
        "line",
        px - ox * 0.9,
        pz - oz * 0.9,
        1.2,
        0.75,
        ox,
        oz,
        [0.86, 0.66, 0.12],
        G.CURB_H + 0.012,
      ); // inset so no corner overhangs the curve
    }
  }
  return D.build();
}

// ------------------------------------------------------------------ park ground & water
// +1 when the outline's edge normal (dz, -dx) points inward (toward the water), -1 otherwise
function pondWind(w) {
  if (w._wind) return w._wind;
  let a = 0;
  const P = w.pts;
  for (let i = 0; i < P.length; i++) {
    const [x0, z0] = P[i],
      [x1, z1] = P[(i + 1) % P.length];
    a += x0 * z1 - x1 * z0;
  }
  // test with the first edge against the centre (the first edge of every outline faces the centre squarely)
  const [ax, az] = P[0],
    [bx, bz] = P[1],
    L = Math.hypot(bx - ax, bz - az);
  const ok = ((w.cx - ax) * (bz - az)) / L + ((w.cz - az) * -(bx - ax)) / L > 0;
  w._wind = ok ? 1 : -1;
  void a;
  return w._wind;
}

export function createGrassMaterial(T, opts = {}) {
  // (coast r2) opts.lawn: the same lawn shader for plain lawns outside Central Park (meadow everywhere, no ball fields / ponds / woodland floor)
  const quality = getQuality();
  const grassDetailLevel = quality.name === "low" ? 0 : 1;
  const grassDetailDistance = quality.name === "med" ? 360 : 900;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    defines: { GRASS_DETAIL_LEVEL: grassDetailLevel },
  });
  // meadows (mowed lawns, shared layout with trees.ts / the crowd) and ponds as uniforms: the lawn shader paints
  // mowed meadows, darker shaded woodland floor under the groves, sandy ball-field infields on the big lawns and a
  // muddy / rocky bank ring around every water body (no hard grass-to-water line)
  const md = PARK_MEADOWS.map((m) => new THREE.Vector4(m.x, m.z, m.rx, m.rz)),
    ma = PARK_MEADOWS.map((m) => m.a);
  const pw = PARK_WATER.map((w) => new THREE.Vector4(w.cx, w.cz, w.rx, w.rz)),
    pa = PARK_WATER.map((w) => w.a);
  const ph = PARK_WATER.map((w) => new THREE.Vector4(...(w.h ?? [0, 0, 0, 0]))); // outline harmonics (layout.ts)
  const uni = {
    tCol: { value: T.grassCol },
    tNoise: { value: T.noise },
    uGrassDetailDist: { value: grassDetailDistance },
    uMd: { value: md },
    uMa: { value: ma },
    uPw: { value: pw },
    uPa: { value: pa },
    uPh: { value: ph },
    uPq: { value: PARK_WATER.map((w) => w.q ?? 0) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>",groundShader.vertexCommonDistantGrass)
      .replace(
        "#include <fog_vertex>",groundShader.vertexFogVertexDistantGrass,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",injectShader(groundShader.fragmentCommonGrassSurface, md.length, md.length, pw.length, pw.length, pw.length, pw.length),
      )
      .replace(
        "#include <map_fragment>",injectShader(groundShader.fragmentMapGrassSurface, md.length, opts.lawn ? "0.0" : "0.72", opts.lawn ? "1.0" : "1.0 - smoothstep(0.92, 1.05, m)", opts.lawn ? "0.0" : "1.0", opts.lawn ? 1 : 3, pw.length, opts.lawn ? "0.0" : "1.0 - smoothstep(1.0, 3.5 + 2.5 * nz2.b, pd)", opts.lawn ? "0.0" : "0.85", opts.lawn ? "0.0" : "0.92", opts.lawn ? "0.0" : "0.7"),
      )
      // (park r10) critic r9: 'one flat green plane, no terrain undulation'. Gentle rolling ground as a shading height
      // field (knolls / hollows of 0.6-1.5 m over 40-160 m): the lawn normal follows it, so the sun models the meadows
      .replace(
        "#include <normal_fragment_maps>",groundShader.fragmentNormalMapsGrassSurface,
      );
  };
  mat.customProgramCacheKey = () =>
    `city-grass-v11-${quality.name}` + (opts.lawn ? "-lawn" : "");
  return mat;
}

function parkPaths(rnd) {
  // loop drive + meandering paths + perimeter walk; returns polylines [[x,z],...] with widths. Paths steer around the
  // park's water bodies (their ribbons are decals on the grass plane, which has holes there).
  const P = G.PARK;
  const paths = [];
  const cx = (P.x0 + P.x1) / 2,
    hx = (P.x1 - P.x0) / 2 - 30,
    za = P.z0 + 45,
    zb = P.z1 - 45,
    R = 70;
  // loop drive (asphalt, 8 m): rounded rectangle just inside the park, with a gentle wobble
  const loop = [];
  const seg = (x0, z0, x1, z1, n) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      loop.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
    }
  };
  // (explicit ordering: east side north-bound, NE corner, north side west-bound, NW, west side south-bound, SW, south side, SE)
  seg(cx + hx, zb - R, cx + hx, za + R, 28);
  for (let i = 0; i < 8; i++) {
    const a = ((i / 8) * Math.PI) / 2;
    loop.push([cx + hx - R + Math.cos(-a) * R, za + R + Math.sin(-a) * R]);
  }
  seg(cx + hx - R, za, cx - hx + R, za, 6);
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 - ((i / 8) * Math.PI) / 2;
    loop.push([cx - hx + R + Math.cos(a) * R, za + R + Math.sin(a) * R]);
  }
  seg(cx - hx, za + R, cx - hx, zb - R, 28);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI - ((i / 8) * Math.PI) / 2;
    loop.push([cx - hx + R + Math.cos(a) * R, zb - R + Math.sin(a) * R]);
  }
  seg(cx - hx + R, zb, cx + hx - R, zb, 6);
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI / 2 - ((i / 8) * Math.PI) / 2;
    loop.push([cx + hx - R + Math.cos(a) * R, zb - R + Math.sin(a) * R]);
  }
  for (const q of loop) {
    q[0] += Math.sin(q[1] * 0.011) * 5;
  }
  paths.push({ pts: loop, w: 8, drive: true });
  const wet = (x, z, m) =>
    PARK_WATER.some(
      (w) =>
        Math.hypot(
          (x - w.cx) / (w.rx * 1.15 + m),
          (z - w.cz) / (w.rz * 1.15 + m),
        ) < 1,
    );
  const z1 = P.z1 - 6;
  for (let i = 0; i < 13; i++) {
    const pts = [];
    let x = P.x0 + 20 + rnd() * (P.x1 - P.x0 - 40),
      z = i < 7 ? z1 + 5 : P.z0 + 10 + rnd() * (P.z1 - P.z0 - 20);
    if (wet(x, z, 8)) continue;
    let ang =
      -Math.PI / 2 +
      (rnd() - 0.5) * 1.2 +
      (i >= 7 && rnd() < 0.5 ? Math.PI : 0);
    for (let k = 0; k < 110; k++) {
      pts.push([x, z]);
      ang += (rnd() - 0.5) * 0.35;
      let nx = x + Math.cos(ang) * 8,
        nz = z + Math.sin(ang) * 8,
        tries = 0;
      while (wet(nx, nz, 7) && tries++ < 12) {
        ang += 0.45;
        nx = x + Math.cos(ang) * 8;
        nz = z + Math.sin(ang) * 8;
      }
      if (tries >= 12) break;
      x = nx;
      z = nz;
      if (x < P.x0 + 8 || x > P.x1 - 8)
        ang = z > (P.z0 + P.z1) / 2 ? -Math.PI / 2 : Math.PI / 2;
      x = Math.max(P.x0 + 8, Math.min(P.x1 - 8, x));
      if (z < P.z0 + 10 || z > P.z1 - 4) break;
    }
    if (pts.length > 4) paths.push({ pts, w: 3.5 + rnd() * 1.5 });
  }
  // perimeter walkway just inside the wall
  paths.push({
    pts: [
      [P.x0 + 5, P.z0 + 5],
      [P.x0 + 5, z1 + 1],
      [P.x1 - 5, z1 + 1],
      [P.x1 - 5, P.z0 + 5],
      [P.x0 + 5, P.z0 + 5],
    ],
    w: 4,
  });
  // reservoir running track
  const rs = PARK_WATER.find((w) => w.name === "reservoir");
  if (rs) {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2,
        c = Math.cos(rs.a),
        s2 = Math.sin(rs.a);
      const u = Math.cos(t) * (rs.rx * 1.13 + 5),
        v = Math.sin(t) * (rs.rz * 1.13 + 5);
      pts.push([rs.cx + u * c + v * s2, rs.cz - u * s2 + v * c]);
    }
    paths.push({ pts, w: 3.2 });
  }
  return paths;
}

function ribbon(paths, y0) {
  const P = [],
    N = [],
    UV = [],
    I = [];
  let v = 0;
  paths.forEach(({ pts, w, drive }, pi) => {
    // every ribbon gets its own height (1 mm apart) so crossings never produce coplanar overlapping faces
    const y = y0;
    void drive;
    void pi;
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)],
        b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0],
        dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const nx = -dz,
        nz = dx;
      if (i > 0)
        acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const ww = drive
        ? w
        : w *
          (0.8 +
            0.2 * Math.sin(acc * 0.043 + pi) +
            0.12 * Math.sin(acc * 0.17 + pi * 3)); // uneven path width
      P.push(
        pts[i][0] + (nx * ww) / 2,
        y,
        pts[i][1] + (nz * ww) / 2,
        pts[i][0] - (nx * ww) / 2,
        y,
        pts[i][1] - (nz * ww) / 2,
      );
      N.push(0, 1, 0, 0, 1, 0);
      UV.push(0, acc, 1, acc);
      if (i > 0) I.push(v - 2, v, v + 1, v - 2, v + 1, v - 1);
      v += 2;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(new THREE.Uint32BufferAttribute(I, 1));
  g.computeBoundingSphere();
  return g;
}

// fix winding of ribbons (they must face up)
function faceUp(g) {
  const idx = g.index.array,
    pos = g.attributes.position.array;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3,
      b = idx[i + 1] * 3,
      c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a],
      uz = pos[b + 2] - pos[a + 2],
      vx = pos[c] - pos[a],
      vz = pos[c + 2] - pos[a + 2];
    const ny = uz * vx - ux * vz;
    if (ny < 0) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
  }
  return g;
}

export function buildGround({
  scene,
  T,
  blocks,
  facadeMat,
  solids = null,
  zips = null,
  renderer = null,
}) {
  const rnd = mulberry32(777);
  const out = { meshes: [], parkPaths: null, update: () => {} };
  const asphalt = createAsphaltMaterial(T);
  // ---- asphalt: one quad per active road rect (avenue segments, street segments, intersections)
  {
    const P = [],
      N = [],
      A = [],
      I = [];
    let v = 0;
    for (const r of roadRects()) {
      const kind =
        r.kind === "avenue"
          ? 0
          : r.kind === "street"
            ? 1 + (r.hw - G.ST_HALF) * 0.01
            : 2; // (layout2 r9) street half width folded into the kind (shader: sh)
      for (const [x, z] of [
        [r.x0, r.z1],
        [r.x1, r.z1],
        [r.x1, r.z0],
        [r.x0, r.z0],
      ]) {
        P.push(x, GY.ROAD, z);
        N.push(0, 1, 0);
        A.push(kind, r.cx ?? 0, r.cz ?? 0);
      }
      I.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
    // (layout2) Broadway / angled streets: the asphalt cells of every block they cross (kind 2: no grid-aligned lane grime)
    for (const b of blocks) {
      if (!b.diag?.length) continue;
      for (const Q of blockPieces(b).road) {
        const s0 = b.diag[0];
        for (const [x, z] of Q) {
          P.push(x, GY.ROAD, z);
          N.push(0, 1, 0);
          A.push(2, s0.ax, s0.az);
        }
        for (let i = 1; i + 1 < Q.length; i++) {
          const up =
            (Q[i][1] - Q[0][1]) * (Q[i + 1][0] - Q[0][0]) -
            (Q[i][0] - Q[0][0]) * (Q[i + 1][1] - Q[0][1]);
          if (up >= 0) I.push(v, v + i, v + i + 1);
          else I.push(v, v + i + 1, v + i);
        }
        v += Q.length;
      }
    }
    // (layout2 r3) kerb returns: asphalt fans filling the cut-off sidewalk corners (the Village has its asphalt sheet already)
    for (const K of cornerCuts()) {
      if (K.vmap) continue;
      for (const [x, z] of [K.V, ...K.arc]) {
        P.push(x, GY.ROAD, z);
        N.push(0, 1, 0);
        A.push(2, K.V[0], K.V[1]);
      }
      for (let i = 1; i + 1 <= K.arc.length; i++) {
        const Q0 = K.V,
          Q1 = K.arc[i - 1],
          Q2 = K.arc[i];
        const up =
          (Q1[1] - Q0[1]) * (Q2[0] - Q0[0]) - (Q1[0] - Q0[0]) * (Q2[1] - Q0[1]);
        if (up >= 0) I.push(v, v + i, v + i + 1);
        else I.push(v, v + i + 1, v + i);
      }
      v += K.arc.length + 1;
    }
    {
      // (layout2 r3) Columbus Circle: the asphalt disc, 2 mm up (no z-fight with the intersection quad; terrain tol 2 cm)
      const Q = ROUNDABOUT.poly,
        yR = GY.ROAD + 0.002;
      for (const [x, z] of Q) {
        P.push(x, yR, z);
        N.push(0, 1, 0);
        A.push(2, ROUNDABOUT.x, ROUNDABOUT.z);
      }
      for (let i = 1; i + 1 < Q.length; i++) {
        const up =
          (Q[i][1] - Q[0][1]) * (Q[i + 1][0] - Q[0][0]) -
          (Q[i][0] - Q[0][0]) * (Q[i + 1][1] - Q[0][1]);
        if (up >= 0) I.push(v, v + i, v + i + 1);
        else I.push(v, v + i + 1, v + i);
      }
      v += Q.length;
    }
    {
      // (layout2 r2) Village street map: one asphalt sheet inside the seam roads (the raised block curbs sit on it)
      const x0 = VMAP.x0 + G.AV_HALF,
        x1 = VMAP.x1 - G.AV_HALF,
        z0 = VMAP.z0 + G.ST_HALF,
        z1 = VMAP.z1 - G.ST_HALF;
      for (const [x, z] of [
        [x0, z1],
        [x1, z1],
        [x1, z0],
        [x0, z0],
      ]) {
        P.push(x, GY.ROAD, z);
        N.push(0, 1, 0);
        A.push(2, 0, 0);
      }
      I.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
    for (const Q of FMAP.asphalt) {
      // (layout2 r4) FiDi street map: one asphalt trapezoid per band between the waterfront edges
      for (const [x, z] of Q) {
        P.push(x, GY.ROAD, z);
        N.push(0, 1, 0);
        A.push(2, 0, 0);
      }
      I.push(v, v + 2, v + 1, v, v + 3, v + 2);
      v += 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute("aRoad", new THREE.Float32BufferAttribute(A, 3));
    g.setIndex(new THREE.Uint32BufferAttribute(I, 1));
    g.computeBoundingSphere();
    const am = new THREE.Mesh(g, asphalt);
    am.receiveShadow = true;
    am.name = "asphalt";
    scene.add(am);
  }

  // ---- sidewalks: block rings + park perimeter ring + promenade / plaza fill (clipped to the shoreline)
  const rects = blocks.flatMap((b) =>
    b.diag?.length || nearRoundabout(b) // (layout2) blocks cut by an off-grid road (+ r3: Columbus Circle): convex sidewalk cells + curbs
      ? blockPieces(b).walk.map((poly) => ({
          poly: roundCorners(poly),
          rect: [b.x0, b.z0, b.x1, b.z1],
        })) // (layout2 r3) + kerb returns
      : (() => {
          // (layout2 r3) rounded kerb returns: a block with any rounded corner becomes a polygon (curb faces follow the arcs)
          const R = [
              [b.x0, b.z0],
              [b.x1, b.z0],
              [b.x1, b.z1],
              [b.x0, b.z1],
            ],
            Q = roundCorners(R);
          return Q.length > 4
            ? [{ poly: Q, rect: [b.x0, b.z0, b.x1, b.z1] }]
            : [{ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 }];
        })(),
  );
  const P = G.PARK;
  rects.push({
    x0: P.x0 - G.AV_WALK,
    z0: P.z0 - G.ST_WALK,
    x1: P.x0,
    z1: P.z1 + G.ST_WALK,
  });
  rects.push({
    x0: P.x1,
    z0: P.z0 - G.ST_WALK,
    x1: P.x1 + G.AV_WALK,
    z1: P.z1 + G.ST_WALK,
  });
  rects.push({ x0: P.x0, z0: P.z1, x1: P.x1, z1: P.z1 + G.ST_WALK });
  rects.push({ x0: P.x0, z0: P.z0 - G.ST_WALK, x1: P.x1, z1: P.z0 });
  for (const c of MAPS.flatMap((M) => M.cells)) {
    const q = roundCorners(c.curb);
    rects.push({
      poly: q,
      rect: [c.block.x0, c.block.z0, c.block.x1, c.block.z1],
    });
  } // (layout2 r2) Village blocks (+ r3 kerb returns)
  // (zfix) the baked refuge islands (junctionIsles.ts) reach onto the rounded block corners / Broadway walks: the overlap was two
  // coplanar sidewalk tops with different kerb-band rects (aRect) -> flicker. Refuges sit 4 mm up (collision tol 2 cm).
  for (const I of islands())
    rects.push({
      poly: I.poly,
      rect: [I.x0, I.z0, I.x1, I.z1],
      lift: ZFIX && I.kind === "refuge" ? 0.004 : 0,
    }); // (layout2 r3) median, bulb-outs, refuge islands
  const fills = fillPieces(blocks);
  out.fills = fills;
  const sw = new THREE.Mesh(
    sidewalkGeometry([...rects, ...fills]),
    createSidewalkMaterial(T),
  );
  sw.receiveShadow = true;
  sw.name = "sidewalks";
  scene.add(sw);

  // ---- seawall: granite faces along every shore edge of the promenade, down into the water
  const wall = new FacadeBuilder();
  {
    // (layout2 r3) Columbus Circle monument on the roundabout island: granite drum steps, pedestal, rostral column, statue
    const { x, z } = ROUNDABOUT,
      y = GY.WALK;
    const gr = {
        style: STYLE.BLANK,
        layer: LAYER.GRANITE,
        tint: [0.66, 0.64, 0.6],
        seed: 23,
      },
      mb = { ...gr, layer: LAYER.LIME, tint: [0.86, 0.84, 0.79] };
    const br = { ...gr, layer: LAYER.METAL, tint: [0.3, 0.36, 0.3] };
    const parts = [
      [3.4, y, y + 0.45, gr],
      [2.6, y + 0.45, y + 0.9, gr],
      [1.7, y + 0.9, y + 4.6, mb],
      [2.0, y + 4.6, y + 5.1, gr],
      [0.75, y + 5.1, y + 20.5, mb],
      [1.05, y + 20.5, y + 21.2, gr],
      [0.45, y + 21.2, y + 23.6, br],
    ];
    for (const [h, a, b, P] of parts) {
      wall.box(x - h, a, z - h, x + h, b, z + h, P, {}, true);
      solids?.box(x - h, a, z - h, x + h, b, z + h, "wall");
    }
  }
  if (false) {
    // (coast r2) replaced by waterfront.ts' open fort ring with gun ports (the solid drum read as a black disc)
    // (layout2 r4) Castle-Clinton-like round sandstone fort in Battery Park: drum + granite coping (exact n-gon collision)
    const C = BATTERY.castle,
      y = GY.WALK,
      n = 64,
      pr = (r) => (r * (1 + Math.cos(Math.PI / n))) / 2;
    const sp = {
        style: STYLE.BLANK,
        layer: LAYER.BROWN,
        tint: [0.66, 0.5, 0.42],
        seed: 31,
      },
      cp = {
        style: STYLE.BLANK,
        layer: LAYER.GRANITE,
        tint: [0.7, 0.68, 0.64],
        seed: 32,
      };
    wall.cyl(C.x, C.z, C.r, y, y + C.h, n, sp, STYLE.BLANK, false);
    wall.cyl(
      C.x,
      C.z,
      C.r + 0.35,
      y + C.h,
      y + C.h + 0.7,
      n,
      cp,
      STYLE.BLANK,
      true,
    );
    wall.cyl(C.x, C.z, C.r + 0.25, y, y + 0.9, n, cp, STYLE.BLANK, false); // plinth
    solids?.cyl(C.x, C.z, y, y + C.h, pr(C.r), pr(C.r), "wall");
    solids?.cyl(
      C.x,
      C.z,
      y + C.h,
      y + C.h + 0.7,
      pr(C.r + 0.35),
      pr(C.r + 0.35),
      "wall",
    );
    solids?.cyl(C.x, C.z, y, y + 0.9, pr(C.r + 0.25), pr(C.r + 0.25), "wall");
  }
  const seaP = {
    style: STYLE.BLANK,
    layer: LAYER.GRANITE,
    tint: [0.44, 0.43, 0.41],
    seed: 5,
  }; // (foundation r13: 0.62 -> 0.44, darker weathered waterline)
  const yBot = G.WATER_Y - 2.5;
  out.shoreEdges = [];
  out.wetSegs = [];
  for (const f of fills) {
    for (let i = 0; i < f.poly.length; i++) {
      if (!f.shore[i]) continue;
      const [ax, az] = f.poly[i],
        [bx, bz] = f.poly[(i + 1) % f.poly.length];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-3) continue;
      // outward normal points to the water: away from the polygon centroid
      let mx = 0,
        mz = 0;
      for (const [x, z] of f.poly) {
        mx += x;
        mz += z;
      }
      mx /= f.poly.length;
      mz /= f.poly.length;
      let nx = (bz - az) / L,
        nz = -(bx - ax) / L;
      if ((ax - mx) * nx + (az - mz) * nz < 0) {
        nx = -nx;
        nz = -nz;
      }
      // FacadeBuilder.quad: corner + tangent T (face seen from outside runs left->right along T), normal N
      const Tx = nz,
        Tz = -nx; // quad() winding: N = T x up
      const sx = (ax - bx) * Tx + (az - bz) * Tz > 0 ? bx : ax,
        sz = sx === bx ? bz : az;
      // (coast r1) the flat seawall quad along the row-sampled shore is gone: waterfront.ts builds the real edge (fill,
      // granite / platform / riprap / bulkhead faces, coping, rails) outward from here; the wet bands follow that edge
      out.shoreEdges.push({ ax, az, bx, bz, nx, nz, L });
    }
  }

  // ---- Hudson piers (Chelsea-Piers-like): concrete decks on the river side of the west seawall, some carrying long
  // sheds. Deck top 3 cm below the promenade and tucked 1.5 m under it (no coplanar seam); collision boxes (kind pier).
  {
    const prnd = mulberry32(4242);
    const deckP = {
      style: STYLE.BLANK,
      layer: LAYER.CONCRETE,
      tint: [0.46, 0.45, 0.43],
      seed: 13,
    }; // (round 6: darker, weathered)
    const deckTop = {
      ...deckP,
      layer: LAYER.ROOF_GRAVEL,
      tint: [0.4, 0.39, 0.37],
    }; // weathered concrete / tar deck
    const yTop = GY.WALK - 0.03,
      yB = G.WATER_Y - 1.5;
    for (let z = -2150; z < 1750; ) {
      const w = 24 + prnd() * 22,
        za = z,
        zb = z + w;
      z += w + 70 + prnd() * 110;
      if (prnd() < 0.2) {
        // (round 7) remnant pile field of a demolished pier: rows of rotten timber piles in the water
        const [wa0] = shoreAt(za),
          [wb0] = shoreAt(zb),
          xr = Math.min(wa0, wb0) - 3,
          L0 = 60 + prnd() * 90;
        const pileR = {
          style: STYLE.BLANK,
          layer: LAYER.BROWN,
          tint: [0.3, 0.27, 0.23],
          seed: 17,
        };
        for (let x = xr - L0; x < xr - 2; x += 4.5)
          for (let zz = za + 1; zz < zb - 1; zz += 4.2) {
            if (prnd() < 0.3) continue;
            const top = G.WATER_Y + 0.3 + prnd() * 1.6;
            wall.box(
              x,
              G.WATER_Y - 1.5,
              zz,
              x + 0.45,
              top,
              zz + 0.45,
              pileR,
              {},
              true,
            );
            solids?.box(
              x,
              G.WATER_Y - 1.5,
              zz,
              x + 0.45,
              top,
              zz + 0.45,
              "pier",
            );
          }
        PILE_FIELDS.push({ side: 0, z0: za, z1: zb }); // (coast r1)
        continue;
      }
      const [wa] = shoreAt(za),
        [wb] = shoreAt(zb);
      const root = Math.max(wa, wb) + 1.5,
        len = 140 + prnd() * 110;
      const xa = Math.min(wa, wb) - len,
        xb = root;
      // deck: a 0.75 m slab on timber/concrete piles (open, shadowed underside above the water, not a solid block)
      const yD = yTop - 0.75,
        xw = Math.min(wa, wb);
      const shed = prnd() < 0.72,
        lawn = !shed || prnd() < 0.25; // (round 6) Hudson-River-Park-like lawn piers
      wall.box(
        xa,
        yD,
        za,
        xb,
        yTop,
        zb,
        deckP,
        {},
        true,
        true,
        lawn ? { ...deckTop, tint: [0.5, 0.49, 0.46] } : deckTop,
      ); // (round 12: paved deck, the lawns are separate turf panels)
      solids?.box(xa, yD, za, xb, yTop, zb, "pier");
      const pileP = { ...deckP, layer: LAYER.BROWN, tint: [0.42, 0.38, 0.34] };
      for (let x = xa + 1.2; x < xw - 1; x += 6.5)
        for (const zz of [za + 0.9, (za + zb) / 2 - 0.25, zb - 1.4]) {
          wall.box(x, yB, zz, x + 0.5, yD, zz + 0.5, pileP, {}, false);
          solids?.box(x, yB, zz, x + 0.5, yD, zz + 0.5, "pier");
        }
      const PE = {
        x0: xa,
        z0: za,
        x1: xb,
        z1: zb,
        y: yTop,
        lawns: [],
        shade: [],
      };
      PIERS.push(PE); // (coast r2) + lawns / shade / shed for waterfront.ts' dressing
      // (round 12) critic: 'piers are thin flat grey slabs'. Park-pier dressing on the open deck (Hudson-River-Park-like):
      // green lawn panels with a paved ring, a perimeter rail, lamp posts, steel shade pergolas and a pier-head pavilion.
      // Own rng (the pier layout stream is unchanged); exact collision boxes for every solid part.
      {
        const lrnd = mulberry32(4300 + Math.round(za)),
          xOpen1 = shed ? Math.min(wa, wb) - 12 : xb - 6; // open deck [xa, xOpen1]
        const xOpen0 = shed ? Math.min(wa, wb) - (lawn ? 70 : 12) + 4 : xa;
        const bx = (a0, y0, b0, a1, y1, b1, P, k, topP = P) => {
          wall.box(a0, y0, b0, a1, y1, b1, P, {}, true, false, topP);
          solids?.box(a0, y0, b0, a1, y1, b1, k);
        };
        const railP = { ...deckP, layer: LAYER.METAL, tint: [0.3, 0.32, 0.33] };
        // rail along both long sides + the head
        // (coast r2) the rails are drawn by waterfront.ts (posts, timber handrail, pickets: the solid 1.1 m box read as a
        // black wall); the collision boxes stay
        for (const zr of [za + 0.15, zb - 0.27])
          solids?.box(
            xa + 0.3,
            yTop,
            zr,
            xb - 2,
            yTop + 1.1,
            zr + 0.12,
            "ledge",
          );
        solids?.box(
          xa + 0.15,
          yTop,
          za + 0.3,
          xa + 0.27,
          yTop + 1.1,
          zb - 0.3,
          "ledge",
        );
        // lamp posts along both sides
        for (let x = xa + 8; x < xb - 6; x += 24 + lrnd() * 6)
          for (const zl of [za + 1.2, zb - 1.5])
            bx(x, yTop, zl, x + 0.22, yTop + 5.2, zl + 0.22, railP, "pole");
        if (lawn && xOpen1 - xOpen0 > 50) {
          // lawn panels (6 cm turf slabs) in 1-3 pieces with paved paths between, 3.5 m paved ring along the rails
          const lawnP = {
            ...deckTop,
            layer: LAYER.ROOF_GREEN,
            tint: [0.4, 0.62, 0.26],
          };
          const x0l = xOpen0 + 30,
            x1l = xOpen1 - 4,
            n = x1l - x0l > 110 ? 3 : x1l - x0l > 60 ? 2 : 1,
            gap = 5;
          const pw = (x1l - x0l - gap * (n - 1)) / n;
          for (let i = 0; i < n; i++) {
            const a = x0l + i * (pw + gap);
            if (pw > 12) PE.lawns.push([a, za + 3.5, a + pw, zb - 3.5]);
            if (pw > 12)
              bx(
                a,
                yTop,
                za + 3.5,
                a + pw,
                yTop + 0.06,
                zb - 3.5,
                lawnP,
                "roof",
                {
                  ...lawnP,
                  tint: lawnP.tint.map((v) => v * (0.9 + lrnd() * 0.16)),
                },
              );
          }
          // pier-head pavilion: slim steel posts under a flat pale roof, glazed kiosk inside
          const pvx0 = xOpen0 + 4,
            pvx1 = pvx0 + 20,
            pz0 = za + 4,
            pz1 = zb - 4;
          const roofP = {
            ...deckP,
            layer: LAYER.WHITE,
            tint: [0.84, 0.84, 0.82],
          };
          for (const [px, pz] of [
            [pvx0, pz0],
            [pvx1 - 0.3, pz0],
            [pvx0, pz1 - 0.3],
            [pvx1 - 0.3, pz1 - 0.3],
          ])
            bx(px, yTop, pz, px + 0.3, yTop + 4.2, pz + 0.3, railP, "pole");
          bx(
            pvx0 - 1.5,
            yTop + 4.2,
            pz0 - 1,
            pvx1 + 1.5,
            yTop + 4.7,
            pz1 + 1,
            roofP,
            "roof",
          );
          PE.shade.push([pvx0 - 1.5, pz0 - 1, pvx1 + 1.5, pz1 + 1]);
          const kP = {
            floorH: 4.2,
            bayW: 1.6,
            winW: 0.9,
            winH: 0.75,
            layer: LAYER.METAL,
            base: LAYER.GRANITE,
            seed: lrnd() * 100,
            margin: 0,
            depth: 0.04,
            tint: [0.85, 0.9, 0.95],
            topY: yTop + 3.4,
            baseY: yTop,
          };
          const cw = { style: STYLE.CURTAIN, gH: -0.01 },
            kz = (pz0 + pz1) / 2;
          wall.box(
            pvx0 + 5,
            yTop,
            kz - 3.5,
            pvx1 - 7,
            yTop + 3.4,
            kz + 3.5,
            kP,
            { px: cw, nx: cw, pz: cw, nz: cw },
            true,
            false,
            roofP,
          );
          solids?.box(
            pvx0 + 5,
            yTop,
            kz - 3.5,
            pvx1 - 7,
            yTop + 3.4,
            kz + 3.5,
            "wall",
          );
          // steel shade pergolas over the lawns (posts + a slatted flat roof read as one slab from the air)
          const pgP = { ...deckP, layer: LAYER.METAL, tint: [0.38, 0.42, 0.4] };
          for (let i = 0; i < (x1l - x0l > 90 ? 2 : 1); i++) {
            const gx =
                x0l + ((i + 0.5) * (x1l - x0l)) / 2 - 7 + (lrnd() - 0.5) * 10,
              gz = lrnd() < 0.5 ? za + 3.8 : zb - 11.8;
            for (const [px, pz] of [
              [gx, gz],
              [gx + 13.7, gz],
              [gx, gz + 7.7],
              [gx + 13.7, gz + 7.7],
            ])
              bx(
                px,
                yTop + 0.06,
                pz,
                px + 0.3,
                yTop + 3.6,
                pz + 0.3,
                pgP,
                "pole",
              );
            bx(
              gx - 0.5,
              yTop + 3.6,
              gz - 0.5,
              gx + 14.5,
              yTop + 3.9,
              gz + 8.5,
              pgP,
              "roof",
            );
            PE.shade.push([gx - 0.5, gz - 0.5, gx + 14.5, gz + 8.5]);
          }
        }
      }
      if (shed) {
        // long shed with a clerestory roof
        const sx0 = xa + 6,
          sx1 = Math.min(wa, wb) - (lawn ? 70 + prnd() * 40 : 12),
          sz0 = za + 3,
          sz1 = zb - 3,
          h = 8 + prnd() * 6;
        if (sx1 - sx0 > 40) {
          const shP = {
            floorH: 4.5,
            bayW: 6,
            winW: 0.75,
            winH: 0.35,
            layer: prnd() < 0.5 ? LAYER.CONCRETE : LAYER.BUFF,
            base: LAYER.CONCRETE,
            seed: prnd() * 100,
            margin: 0.8,
            depth: 0.15,
            tint: [
              0.62 + prnd() * 0.2,
              0.6 + prnd() * 0.18,
              0.56 + prnd() * 0.16,
            ],
            topY: yTop + h,
            baseY: yTop,
          };
          const rT = [
            [0.34, 0.37, 0.36],
            [0.42, 0.33, 0.28],
            [0.3, 0.33, 0.3],
            [0.46, 0.45, 0.43],
          ][Math.floor(prnd() * 4)]; // (round 6) weathered metal roofs
          const f = { style: STYLE.RIBBON, gH: -0.01 };
          wall.box(
            sx0,
            yTop,
            sz0,
            sx1,
            yTop + h,
            sz1,
            shP,
            { px: f, nx: f, pz: f, nz: f },
            true,
            false,
            {
              ...shP,
              style: STYLE.BLANK,
              layer: LAYER.ROOF_MEMBRANE,
              tint: rT,
            },
          );
          solids?.box(sx0, yTop, sz0, sx1, yTop + h, sz1, "wall");
          PE.shed = { x0: sx0, x1: sx1, z0: sz0, z1: sz1, y: yTop, h, rT }; // (coast r2)
          const c = 2.2; // clerestory ridge
          wall.box(
            sx0 + 2,
            yTop + h,
            (sz0 + sz1) / 2 - (sz1 - sz0) * 0.2,
            sx1 - 2,
            yTop + h + c,
            (sz0 + sz1) / 2 + (sz1 - sz0) * 0.2,
            shP,
            { px: f, nx: f, pz: f, nz: f },
            true,
            false,
            {
              ...shP,
              style: STYLE.BLANK,
              layer: LAYER.ROOF_MEMBRANE,
              tint: rT.map((v) => v * 0.72),
            },
          );
          solids?.box(
            sx0 + 2,
            yTop + h,
            (sz0 + sz1) / 2 - (sz1 - sz0) * 0.2,
            sx1 - 2,
            yTop + h + c,
            (sz0 + sz1) / 2 + (sz1 - sz0) * 0.2,
            "roof",
          );
          zips?.add(
            sx0 + 0.2,
            yTop + h,
            sz0 + 0.2,
            -0.7,
            0,
            -0.7,
            "roofCorner",
          );
          zips?.add(sx0 + 0.2, yTop + h, sz1 - 0.2, -0.7, 0, 0.7, "roofCorner");
        }
      }
    }
  }

  // ---- (round 11) East River piers: the critic read the East River shore as 'ruler-straight, no piers, no pilings'.
  // Seaport-like downtown piers (long sheds / a glassy pavilion), ferry landings (pier + floating barge + canopy),
  // short esplanade piers with lawn decks up the east side. Deck on timber piles, tucked 1.5 m under the promenade like
  // the Hudson piers; exact collision boxes (kind pier / wall / roof). Bridge approaches + the Roosevelt narrows stay free.
  {
    const ernd = mulberry32(5757);
    // (r14) critic: 'the long piers are identical dark sticks'. Paler weathered-concrete decks (per-pier tone below)
    const deckP = {
      style: STYLE.BLANK,
      layer: LAYER.CONCRETE,
      tint: [0.56, 0.55, 0.52],
      seed: 19,
    };
    const deckTop = {
      ...deckP,
      layer: LAYER.ROOF_GRAVEL,
      tint: [0.6, 0.58, 0.55],
    };
    const woodTop = { ...deckP, layer: LAYER.BROWN, tint: [0.5, 0.43, 0.36] }; // seaport timber decking
    const pileP = { ...deckP, layer: LAYER.BROWN, tint: [0.36, 0.33, 0.3] };
    const yTop = GY.WALK - 0.03,
      yB = G.WATER_Y - 1.5,
      yD = yTop - 0.75;
    const avoid = [
      ...BRIDGES.map((b) => [b.z - b.width / 2 - 50, b.z + b.width / 2 + 50]),
      [-1830, -310],
    ];
    const RUNS = [
      [-2300, -1880, 38, 30],
      [-260, 1380, 40, 34],
      [1560, 2190, 48, 40],
      [2340, 2540, 70, 40],
      [2670, 3010, 72, 44],
    ];
    for (const [z0r, z1r, len0, lenR] of RUNS)
      for (let z = z0r + ernd() * 40; z < z1r; ) {
        const w = 15 + ernd() * 17,
          za = z,
          zb = z + w;
        z += w + 80 + ernd() * 140;
        if (zb > z1r || avoid.some(([a, b]) => zb > a && za < b)) continue;
        const ea = shoreAt(za)[1],
          eb = shoreAt(zb)[1],
          xe = Math.max(ea, eb);
        const x0 = Math.min(ea, eb) - 1.5,
          x1 = xe + len0 + ernd() * lenR;
        const kind = ernd(),
          seaport = za > 2300;
        const tk = 0.86 + ((((za * 0.137) % 1) + 1) % 1) * 0.3; // per-pier deck tone (no rng draw: layouts unchanged)
        const top =
          seaport && kind < 0.55
            ? woodTop
            : kind > 0.75 && !seaport
              ? { ...deckTop, layer: LAYER.ROOF_GREEN, tint: [0.42, 0.56, 0.3] }
              : { ...deckTop, tint: deckTop.tint.map((v) => v * tk) };
        wall.box(x0, yD, za, x1, yTop, zb, deckP, {}, true, true, top);
        solids?.box(x0, yD, za, x1, yTop, zb, "pier");
        for (let x = xe + 1.5; x < x1 - 0.8; x += 6)
          for (const zz of [za + 0.8, (za + zb) / 2 - 0.25, zb - 1.3]) {
            wall.box(x, yB, zz, x + 0.5, yD, zz + 0.5, pileP, {}, false);
            solids?.box(x, yB, zz, x + 0.5, yD, zz + 0.5, "pier");
          }
        // timber fender piles in a loose row off the pier head
        for (let zz = za + 1; zz < zb - 0.5; zz += 3.2) {
          const ht = G.WATER_Y + 1.6 + ernd() * 0.8;
          wall.box(x1 + 0.6, yB, zz, x1 + 1.05, ht, zz + 0.45, pileP, {}, true);
          solids?.box(x1 + 0.6, yB, zz, x1 + 1.05, ht, zz + 0.45, "pier");
        }
        const PE = { x0, z0: za, x1, z1: zb, y: yTop, lawns: [], shade: [] };
        PIERS.push(PE); // (coast r2)
        const f = { style: STYLE.RIBBON, gH: -0.01 };
        if (kind < 0.45 && x1 - xe > 40) {
          // shed / pavilion
          const glassy = seaport && ernd() < 0.5,
            h = glassy ? 11 + ernd() * 5 : 7 + ernd() * 5;
          const sx0 = xe + 6,
            sx1 = x1 - 5 - ernd() * 10,
            sz0 = za + 2.5,
            sz1 = zb - 2.5;
          const shP = glassy
            ? {
                floorH: 4.2,
                bayW: 1.6,
                winW: 0.9,
                winH: 0.7,
                layer: LAYER.METAL,
                base: LAYER.GRANITE,
                seed: ernd() * 100,
                margin: 0,
                depth: 0.04,
                tint: [0.85, 0.9, 0.95],
                topY: yTop + h,
                baseY: yTop,
              }
            : {
                floorH: 4.5,
                bayW: 5.5,
                winW: 0.7,
                winH: 0.35,
                layer: [LAYER.RED, LAYER.CONCRETE, LAYER.BUFF][
                  Math.floor(ernd() * 3)
                ],
                base: LAYER.CONCRETE,
                seed: ernd() * 100,
                margin: 0.8,
                depth: 0.15,
                tint: [
                  0.66 + ernd() * 0.18,
                  0.62 + ernd() * 0.16,
                  0.58 + ernd() * 0.14,
                ],
                topY: yTop + h,
                baseY: yTop,
              };
          const g2 = glassy ? { style: STYLE.CURTAIN, gH: -0.01 } : f,
            rT = [
              [0.34, 0.37, 0.36],
              [0.44, 0.34, 0.28],
              [0.3, 0.32, 0.31],
            ][Math.floor(ernd() * 3)];
          if (sx1 - sx0 > 18) {
            wall.box(
              sx0,
              yTop,
              sz0,
              sx1,
              yTop + h,
              sz1,
              shP,
              { px: g2, nx: g2, pz: g2, nz: g2 },
              true,
              false,
              {
                ...shP,
                style: STYLE.BLANK,
                layer: LAYER.ROOF_MEMBRANE,
                tint: rT,
              },
            );
            solids?.box(sx0, yTop, sz0, sx1, yTop + h, sz1, "wall");
            if (!glassy)
              PE.shed = {
                x0: sx0,
                x1: sx1,
                z0: sz0,
                z1: sz1,
                y: yTop,
                h,
                rT,
                east: true,
              }; // (coast r2)
            zips?.add(
              sx1 - 0.2,
              yTop + h,
              sz0 + 0.2,
              0.7,
              0,
              -0.7,
              "roofCorner",
            );
            zips?.add(
              sx1 - 0.2,
              yTop + h,
              sz1 - 0.2,
              0.7,
              0,
              0.7,
              "roofCorner",
            );
          }
        } else if (kind < 0.75) {
          // ferry landing: floating barge off the pier head with a steel canopy
          const bx0 = x1 + 1.4,
            bx1 = bx0 + 14 + ernd() * 8,
            bz0 = (za + zb) / 2 - 7,
            bz1 = (za + zb) / 2 + 7,
            by1 = G.WATER_Y + 1.1;
          const bP = { ...deckP, layer: LAYER.METAL, tint: [0.36, 0.4, 0.44] };
          wall.box(bx0, G.WATER_Y - 1, bz0, bx1, by1, bz1, bP, {}, true, true, {
            ...deckTop,
            tint: [0.44, 0.44, 0.43],
          });
          solids?.box(bx0, G.WATER_Y - 1, bz0, bx1, by1, bz1, "pier");
          const cP = { ...deckP, layer: LAYER.METAL, tint: [0.3, 0.42, 0.48] }; // blue-grey canopy roof on 4 posts
          for (const [px, pz] of [
            [bx0 + 1, bz0 + 1],
            [bx1 - 1.4, bz0 + 1],
            [bx0 + 1, bz1 - 1.4],
            [bx1 - 1.4, bz1 - 1.4],
          ]) {
            wall.box(px, by1, pz, px + 0.4, by1 + 3.6, pz + 0.4, cP, {}, false);
            solids?.box(px, by1, pz, px + 0.4, by1 + 3.6, pz + 0.4, "pole");
          }
          wall.box(
            bx0,
            by1 + 3.6,
            bz0,
            bx1,
            by1 + 4.1,
            bz1,
            cP,
            {},
            true,
            true,
            cP,
          );
          solids?.box(bx0, by1 + 3.6, bz0, bx1, by1 + 4.1, bz1, "roof");
        }
      }
  }

  // ---- (foundation r13) esplanade overlooks: the critic still read both riverfronts as 'ruler-straight white strips /
  // a hard straight edge' between the piers. Shoreline fill outside the street grid (layout blocks untouched): stepped
  // bump-outs of the seawall, 40-170 m long, 6-24 m into the river, tapering in 1-2 steps at their ends so the outline
  // wobbles. Dark granite faces down into the water, a darker paved top with lawn panels and planted hedge beds, a
  // perimeter rail, lamp posts and the odd shade pavilion. Deck top 3 cm under the promenade, tucked 1.5 m under it
  // (no seam); every part is an exact collision box. Own rng (layouts of piers / boats unchanged); not in PIERS (no
  // moored boats), clear of pier + bridge corridors, shallower in the Roosevelt narrows (no boat lane there).
  // (coast r1) superseded: waterfront.ts builds the bump-outs as part of the shoreline profile (the rail no longer cuts
  // them off from the promenade). Kept behind a switch for A/B (?coastOld).
  if (
    typeof location !== "undefined" &&
    /[?&]coastOld\b/.test(location.search)
  ) {
    const ornd = mulberry32(13013);
    const topP = {
      style: STYLE.BLANK,
      layer: LAYER.CONCRETE,
      tint: [0.4, 0.385, 0.36],
      seed: 23,
    };
    const lawnP = { ...topP, layer: LAYER.ROOF_GREEN, tint: [0.34, 0.5, 0.22] };
    const hedgeP = {
      ...topP,
      layer: LAYER.ROOF_GREEN,
      tint: [0.16, 0.24, 0.1],
    };
    const railP = { ...topP, layer: LAYER.METAL, tint: [0.26, 0.28, 0.29] };
    const roofP = { ...topP, layer: LAYER.METAL, tint: [0.34, 0.4, 0.38] };
    const yTop = GY.WALK - 0.03,
      yB = G.WATER_Y - 2.5;
    const bx = (a0, y0, b0, a1, y1, b1, P, k, tp = P) => {
      wall.box(a0, y0, b0, a1, y1, b1, P, {}, true, false, tp);
      solids?.box(a0, y0, b0, a1, y1, b1, k);
    };
    const busy = [
      ...BRIDGES.map((b) => [b.z - b.width / 2 - 70, b.z + b.width / 2 + 70]),
      ...PIERS.map((p) => [p.z0 - 25, p.z1 + 25]),
    ];
    let nOv = 0;
    for (const side of [1, -1]) {
      for (let z = G.Z_MIN + 380 + ornd() * 60; z < G.Z_MAX - 380; ) {
        const len = 40 + ornd() * 130,
          za = z,
          zb = z + len;
        z += len + 30 + ornd() * 120;
        if (busy.some(([a, b]) => zb > a && za < b)) continue;
        if (ornd() < 0.12) continue; // plain seawall stretches between
        const sa = shoreAt(za)[side > 0 ? 1 : 0],
          sb = shoreAt(zb)[side > 0 ? 1 : 0];
        const narrows = side > 0 && zb > -1830 && za < -310;
        const out = narrows ? 8 + ornd() * 8 : 12 + ornd() * 22;
        const sIn = side > 0 ? Math.min(sa, sb) - 1.5 : Math.max(sa, sb) + 1.5; // root, tucked under the promenade
        const sOut = side > 0 ? Math.max(sa, sb) : Math.min(sa, sb); // seaward-most shore point of the run
        const X = (d) => sOut + side * d; // x at distance d off the shore
        const seg = (z0, z1, d) => {
          const a = Math.min(sIn, X(d)),
            b = Math.max(sIn, X(d));
          bx(a, yB, z0, b, yTop, z1, seaP, "pier", topP);
        };
        // stepped ends: 1-2 shallower steps (irregular lengths) at each end
        const s0 = 6 + ornd() * 14,
          s1 = 6 + ornd() * 14,
          two = len > 90 && ornd() < 0.6;
        const zi0 = za + s0 * (two ? 2 : 1),
          zi1 = zb - s1 * (two ? 2 : 1);
        if (zi1 - zi0 < 20) continue;
        seg(zi0, zi1, out);
        if (two) {
          seg(za + s0, zi0, out * 0.66);
          seg(zb - 2 * s1, zb - s1, out * 0.7);
          seg(za, za + s0, out * 0.34);
          seg(zb - s1, zb, out * 0.36);
        } else {
          seg(za, zi0, out * 0.5);
          seg(zi1, zb, out * 0.45);
        }
        nOv++;
        // dressing on the main segment: rail on the seaward edge + ends, lamp posts, lawn panels / hedge beds
        const xo = X(out),
          xr = xo - side * 0.3,
          rA = Math.min(xr, xr - side * 0.12),
          rB = Math.max(xr, xr - side * 0.12);
        bx(rA, yTop, zi0, rB, yTop + 1.1, zi1, railP, "ledge");
        for (
          let zl = zi0 + 6 + ornd() * 6;
          zl < zi1 - 4;
          zl += 22 + ornd() * 8
        ) {
          const lx = xo - side * 1.2;
          bx(
            Math.min(lx, lx - side * 0.2),
            yTop,
            zl,
            Math.max(lx, lx - side * 0.2),
            yTop + 5.2,
            zl + 0.2,
            railP,
            "pole",
          );
        }
        if (out > 11) {
          const l0 = X(2.5),
            l1 = X(out - 3.2),
            q = ornd();
          if (q < 0.7) {
            // lawn panels (6 cm turf slabs) split by paths, with a dark hedge bed on the landward side
            const n = zi1 - zi0 > 90 ? 3 : zi1 - zi0 > 45 ? 2 : 1,
              gap = 4,
              pw = (zi1 - zi0 - 6 - gap * (n - 1)) / n;
            for (let i = 0; i < n; i++) {
              const c0 = zi0 + 3 + i * (pw + gap);
              if (pw > 8)
                bx(
                  Math.min(l0, l1),
                  yTop,
                  c0,
                  Math.max(l0, l1),
                  yTop + 0.06,
                  c0 + pw,
                  lawnP,
                  "roof",
                  {
                    ...lawnP,
                    tint: lawnP.tint.map((v) => v * (0.86 + ornd() * 0.2)),
                  },
                );
              if (pw > 8 && ornd() < 0.75) {
                const h0 = X(2.5),
                  h1 = X(4.3);
                bx(
                  Math.min(h0, h1),
                  yTop + 0.06,
                  c0 + 1,
                  Math.max(h0, h1),
                  yTop + 0.06 + 0.7 + ornd() * 0.4,
                  c0 + pw - 1,
                  hedgeP,
                  "ledge",
                  {
                    ...hedgeP,
                    tint: hedgeP.tint.map((v) => v * (0.85 + ornd() * 0.3)),
                  },
                );
              }
            }
          } else {
            // paved overlook with a slim shade pavilion (posts + flat roof)
            const pz0 = (zi0 + zi1) / 2 - 8,
              pz1 = pz0 + 16,
              p0 = X(3),
              p1 = X(Math.min(out - 3.5, 12));
            for (const [px, pz] of [
              [p0, pz0],
              [p1, pz0],
              [p0, pz1],
              [p1, pz1],
            ])
              bx(
                px - 0.15,
                yTop,
                pz - 0.15,
                px + 0.15,
                yTop + 3.8,
                pz + 0.15,
                railP,
                "pole",
              );
            bx(
              Math.min(p0, p1) - 1,
              yTop + 3.8,
              pz0 - 1,
              Math.max(p0, p1) + 1,
              yTop + 4.2,
              pz1 + 1,
              roofP,
              "roof",
            );
          }
        }
      }
    }
    out.overlooks = nOv;
  }

  // ---- markings
  const mm = new THREE.MeshStandardMaterial({
    map: T.markings,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    roughness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  // worn paint: tyre paths and weathering eat the thermoplastic (world-space noise, stronger in the wheel tracks)
  mm.onBeforeCompile = (sh) => {
    sh.uniforms.tNoiseW = { value: T.noise };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>",groundShader.vertexCommonByMountainWorldPosition)
      .replace(
        "#include <fog_vertex>",groundShader.vertexFogVertexByMountainWorldPosition,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",groundShader.fragmentCommonByMountainWorldPosition,
      )
      .replace(
        "#include <map_fragment>",groundShader.fragmentMapByMountainWorldPosition,
      );
  };
  mm.customProgramCacheKey = () => "city-markings-wear-v3";
  const mk = new THREE.Mesh(buildMarkings(T, rnd), mm);
  mk.receiveShadow = true;
  mk.renderOrder = 1;
  mk.name = "markings";
  scene.add(mk);

  // ---- park ground (with holes for the Pond / Lake / Reservoir / Meer) + paths + low stone wall
  const shape = new THREE.Shape([
    new THREE.Vector2(P.x0, -P.z0),
    new THREE.Vector2(P.x1, -P.z0),
    new THREE.Vector2(P.x1, -P.z1),
    new THREE.Vector2(P.x0, -P.z1),
  ]);
  for (const w of PARK_WATER)
    shape.holes.push(
      new THREE.Path(w.pts.map(([x, z]) => new THREE.Vector2(x, -z))),
    );
  const gg = new THREE.ShapeGeometry(shape, 1)
    .rotateX(-Math.PI / 2)
    .translate(0, GY.GRASS, 0);
  const grass = new THREE.Mesh(gg, createGrassMaterial(T));
  grass.receiveShadow = true;
  grass.name = "park";
  scene.add(grass);
  {
    // (layout2 r4) City Hall Park / Bowling Green (FiDi map park cells) + Battery Park lawns: muted grass at GY.GRASS (1 draw)
    const polys = [
      ...MAPS.flatMap((M) => M.cells)
        .filter((c) => c.park && c.prop)
        .map((c) => c.prop),
      ...BATTERY.lawns,
    ];
    const Pp = [],
      Nn = [],
      Uu = [],
      Ii = [];
    let v = 0;
    for (const Q of polys) {
      for (const [x, z] of Q) {
        Pp.push(x, GY.GRASS, z);
        Nn.push(0, 1, 0);
        Uu.push(x / 7, z / 7);
      }
      for (let i = 1; i + 1 < Q.length; i++) {
        const up =
          (Q[i][1] - Q[0][1]) * (Q[i + 1][0] - Q[0][0]) -
          (Q[i][0] - Q[0][0]) * (Q[i + 1][1] - Q[0][1]);
        if (up >= 0) Ii.push(v, v + i, v + i + 1);
        else Ii.push(v, v + i + 1, v + i);
      }
      v += Q.length;
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(Pp, 3));
    lg.setAttribute("normal", new THREE.Float32BufferAttribute(Nn, 3));
    lg.setAttribute("uv", new THREE.Float32BufferAttribute(Uu, 2));
    lg.setIndex(Ii);
    lg.computeBoundingSphere();
    const lawn = new THREE.Mesh(
      lg,
      new THREE.MeshStandardMaterial({
        map: T.grassCol,
        color: 0xb4b89a,
        roughness: 0.95,
      }),
    );
    lawn.receiveShadow = true;
    lawn.name = "mapLawns";
    scene.add(lawn);
  }
  // water bodies: surface + stone-edged banks from the water line up to the lawn
  const bankP = {
    style: STYLE.BLANK,
    layer: LAYER.GRANITE,
    tint: [0.36, 0.34, 0.3],
    seed: 9,
  }; // (round 8) wet dark stone, no pale vector rim
  const pondGeo = [];
  for (const w of PARK_WATER) {
    const sh = new THREE.Shape(w.pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    pondGeo.push(
      new THREE.ShapeGeometry(sh, 1).rotateX(-Math.PI / 2).translate(0, w.y, 0),
    );
    for (let i = 0; i < w.pts.length; i++) {
      const [ax, az] = w.pts[i],
        [bx, bz] = w.pts[(i + 1) % w.pts.length];
      const L = Math.hypot(bx - ax, bz - az);
      // bank faces point INTO the pond (toward the centre)
      let nx = (bz - az) / L,
        nz = -(bx - ax) / L;
      if (pondWind(w) * 1 < 0) {
        nx = -nx;
        nz = -nz;
      } // by winding (lobed outlines: the centre test flips some faces)
      const Tx = nz,
        Tz = -nx;
      const sx = (ax - bx) * Tx + (az - bz) * Tz > 0 ? bx : ax,
        sz = sx === bx ? bz : az;
      wall.quad(
        [sx, 0, sz],
        [Tx, 0, Tz],
        L,
        w.y - 0.6,
        GY.GRASS,
        [nx, 0, nz],
        bankP,
        STYLE.BLANK,
        0,
      );
    }
  }
  // (round 8) natural shores: reed / shrub clumps overhanging the waterline in broken runs, and grey Manhattan-schist
  // outcrops (stacked slabs, exact box collision) on the points of the Lake / Pond / Meer -- the banks stop reading as
  // razor-cut vector outlines from the air. The Reservoir keeps its clean stone edge (it is a built basin).
  {
    const srnd = mulberry32(2718);
    const reeds = new CanopyBatch(3141, {
      squash: 0.55,
      palette: [
        [0.09, 0.1, 0.045],
        [0.12, 0.12, 0.055],
        [0.075, 0.09, 0.045],
        [0.14, 0.13, 0.065],
        [0.1, 0.11, 0.05],
        [0.2, 0.17, 0.09],
        [0.17, 0.14, 0.07],
      ],
    });
    const rockP = {
      style: STYLE.BLANK,
      layer: LAYER.GRANITE,
      tint: [0.44, 0.42, 0.39],
      seed: 21,
    };
    for (const w of PARK_WATER) {
      if (w.name === "reservoir") continue;
      const n = w.pts.length;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        const [ax, az] = w.pts[i],
          [bx, bz] = w.pts[(i + 1) % n];
        const L = Math.hypot(bx - ax, bz - az);
        acc += L;
        // broken runs: clumps along ~55% of the shore
        const run =
          Math.sin(acc * 0.045 + w.cx) + 0.6 * Math.sin(acc * 0.13 + w.cz);
        for (let u = srnd() * 2.2; u < L; u += 2.2 + srnd() * 1.6) {
          const x = ax + ((bx - ax) * u) / L,
            z = az + ((bz - az) * u) / L;
          if (run > -0.2 && srnd() < 0.85)
            reeds.add(
              x + (srnd() - 0.5) * 1.5,
              w.y - 0.55,
              z + (srnd() - 0.5) * 1.5,
              1.1 + srnd() * 1.3,
              0.25,
            );
        }
        // schist outcrops on the convex points (outline radius above the local mean) every ~35-60 m
        const t = Math.atan2(az - w.cz, ax - w.cx),
          rr = Math.hypot(ax - w.cx, az - w.cz);
        const [px, pz] = w.pts[(i + n - 3) % n],
          [qx, qz] = w.pts[(i + 3) % n];
        const conv =
          rr -
          0.5 *
            (Math.hypot(px - w.cx, pz - w.cz) +
              Math.hypot(qx - w.cx, qz - w.cz));
        if (conv > 0.4 && (i * 7919 + n) % 5 === 0) {
          const ox = Math.cos(t),
            oz = Math.sin(t);
          for (let k = 0; k < 2 + Math.floor(srnd() * 3); k++) {
            const d = (srnd() - 0.35) * 5,
              cx = ax - ox * d + (srnd() - 0.5) * 4,
              cz = az - oz * d + (srnd() - 0.5) * 4;
            const hx = 0.9 + srnd() * 2.2,
              hz = 0.9 + srnd() * 2.2,
              top = GY.GRASS + 0.15 + srnd() * (k ? 0.8 : 1.4);
            const y0 = w.y - 0.35;
            wall.box(
              cx - hx,
              y0,
              cz - hz,
              cx + hx,
              top,
              cz + hz,
              rockP,
              {},
              true,
            );
            solids?.box(cx - hx, y0, cz - hz, cx + hx, top, cz + hz, "park");
          }
        }
      }
    }
    const rm = reeds.build(scene, "parkReeds", true);
    if (rm) rm.userData.smallCasters = true;
  }
  const waterMat = createRiverMaterial(T, null, {
    ssr: true,
    body: [0.045, 0.06, 0.05],
  }); // still, dark, tannin-green pond water
  for (const g of pondGeo) {
    const m = new THREE.Mesh(g, waterMat);
    m.name = "parkWater";
    m.receiveShadow = true;
    scene.add(m);
  }
  const paths = adjustParkPaths(parkPaths(rnd));
  out.parkPaths = paths;
  // ---- grove canopy 'far fill' (HLOD): crowns filling the groves between trees.ts' trees, grown in only beyond
  // ~230 m, so from the rooftops / the air the park reads as dense woodland around open meadows, not a lawn with dots
  // (park agent: replaced by trees.ts' dense park woodland + crown LODs when PARK_CANOPY_EXTERNAL)
  if (!PARK_CANOPY_EXTERNAL) {
    // (round 5) mostly olive / dusty late-summer greens with ~30% ochre / rust turning crowns (ref 08), not an orange carpet
    // (round 6) deeper, cooler summer-into-autumn greens; crowns flattened (squash) so overlapping crowns merge into one
    // continuous, lumpy forest roof instead of separate lollipop spheres
    // (round 8) broader species palette: olive oaks, yellow-green lindens / honey locusts, blue-grey-green planes, and
    // turning maples / oaks (ochre, rust, dull gold) -- plus a separate conifer batch (dark spires) below
    // (round 9) ref 08: from the air the woods are a fine-grained, sunlit olive / yellow-green speckle, not big dark lumps:
    // lighter main tones, fewer rust accents (autumn share 0.2 -> 0.1), smaller crowns (x0.72) and ~1.6x as many
    const fill = new CanopyBatch(515, {
      fade: [230, 330],
      squash: 0.62,
      palette: [
        [0.088, 0.112, 0.045],
        [0.13, 0.15, 0.052],
        [0.075, 0.098, 0.046],
        [0.15, 0.155, 0.06],
        [0.085, 0.108, 0.07],
        [0.17, 0.13, 0.045],
        [0.2, 0.18, 0.065],
        [0.12, 0.105, 0.042],
        [0.16, 0.155, 0.06],
        [0.165, 0.145, 0.052],
      ],
    }); // (round 10: rust / orange accents toned to olive-gold, critic: noisy orange speckle)
    const pines = new CanopyBatch(5151, {
      fade: [230, 330],
      palette: [
        [0.035, 0.055, 0.035],
        [0.045, 0.062, 0.04],
        [0.04, 0.05, 0.035],
        [0.05, 0.068, 0.045],
        [0.038, 0.058, 0.042],
      ],
      shape: "cone",
    });
    const segs = [];
    for (const p of paths)
      for (let i = 1; i < p.pts.length; i++)
        segs.push([p.pts[i - 1], p.pts[i], p.w / 2 + 2.5]);
    const nearPath = (x, z, ex = 0) =>
      segs.some(([a, b, w0]) => {
        const w = w0 + ex;
        if (
          Math.min(a[0], b[0]) - w > x ||
          Math.max(a[0], b[0]) + w < x ||
          Math.min(a[1], b[1]) - w > z ||
          Math.max(a[1], b[1]) + w < z
        )
          return false;
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          t = Math.max(
            0,
            Math.min(
              1,
              ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
            ),
          );
        return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < w;
      });
    const grove = (x, z) => {
      const n =
        Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.7) +
        0.6 * Math.sin(x * 0.047 - z * 0.031 + 2.1) +
        0.35 * Math.sin(z * 0.083 + x * 0.012);
      return Math.max(0, Math.min(1, 0.45 + n * 0.45));
    };
    const frnd = mulberry32(8181);
    for (let i = 0; i < 160000 && fill.count < 21000; i++) {
      const x = P.x0 + 6 + frnd() * (P.x1 - P.x0 - 12),
        z = P.z0 + 6 + frnd() * (P.z1 - P.z0 - 12);
      const m = meadowDist(x, z);
      if (m < 1.08) continue;
      // (round 6) woodland covers most of the non-meadow ground (the Ramble / North Woods read as one forest mass),
      // thinning to scattered crowns only in the grove noise's low spots
      const g = Math.min(1, grove(x, z) + 0.3) * Math.min(1, (m - 1.08) / 0.22);
      if (frnd() > g * 1.4) continue;
      // (round 5) crowns may crowd right up to (and overhang) the banks: test the exact outline, 4 m back
      if (
        parkWaterAt(x, z) ||
        parkWaterAt(x + 4, z) ||
        parkWaterAt(x - 4, z) ||
        parkWaterAt(x, z + 4) ||
        parkWaterAt(x, z - 4)
      )
        continue;
      // (round 7) mixed-age woodland: understory / young trees, the common mid crowns and a few big old oaks / elms
      const u = frnd(),
        r =
          0.72 *
          (u < 0.28
            ? 3.0 + frnd() * 2.4
            : u < 0.86
              ? 5.2 + frnd() * 3.6
              : 9.0 + frnd() * 4.2);
      // (round 8) crowns keep ~half their radius off the paths (the drives / walks read as open lanes through the woods)
      if (nearPath(x, z, r * 0.45)) continue;
      if (
        [
          [16, 0],
          [-16, 0],
          [0, 16],
          [0, -16],
          [11, 11],
          [-11, 11],
          [11, -11],
          [-11, -11],
        ].some(([dx, dz]) => parkWaterAt(x + dx, z + dz)?.name === "reservoir")
      )
        continue; // keep the track open
      // (round 8) glades: small irregular clearings (lawn / rock) scattered through the woods
      const gl =
        Math.sin(x * 0.061 + 0.4) * Math.sin(z * 0.053 - 1.1) +
        0.5 * Math.sin(x * 0.13 + z * 0.11 + 2.3);
      if (gl > 0.78) continue;
      const v = frnd();
      if (v < 0.04) {
        pines.add(
          x,
          GY.GRASS,
          z,
          (0.7 + frnd() * 0.5) * Math.min(r, 7) + 1.5,
          0,
          1.0 + frnd() * 0.5,
        );
        continue;
      }
      // umbrella elms / wide planes (flat, spreading), round oaks, and narrow columnar crowns
      const sq =
        v < 0.22 ? 0.42 + frnd() * 0.1 : v < 0.33 ? 1.05 + frnd() * 0.3 : null;
      fill.add(x, GY.GRASS, z, sq !== null && sq > 1 ? r * 0.7 : r, 0.1, sq);
    }
    fill.build(scene, "parkCanopyFill");
    pines.build(scene, "parkPinesFill");
    out.parkFill = fill.count + pines.count;
  }
  // paths are decals on the grass plane: same height, polygon offset, no depth write -> crossings never z-fight
  const pathMat = new THREE.MeshStandardMaterial({
    map: T.asphaltCol,
    color: 0xdcd3c2, // (round 8) paler gravel / asphalt: the path network reads from the air
    roughness: 0.9,
    depthWrite: false,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  // soft, worn edges (grass creeping in, gravel spill) instead of vector-drawn ribbons; slightly warmer gravel / asphalt mix
  pathMat.onBeforeCompile = (sh) => {
    sh.uniforms.tPN = { value: T.noise };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",groundShader.vertexCommonByPavementWorldPosition,
      )
      .replace("#include <uv_vertex>",groundShader.vertexUvVertex)
      .replace(
        "#include <fog_vertex>",groundShader.vertexFogVertexByPavementWorldPosition,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",groundShader.fragmentCommonByPavementWorldPosition,
      )
      .replace(
        "#include <map_fragment>",groundShader.fragmentMapByPavementUv,
      );
  };
  pathMat.customProgramCacheKey = () => "park-path-v2p";
  const pathGeo = faceUp(ribbon(paths, GY.PATH));
  const uv = pathGeo.attributes.uv.array;
  for (let i = 0; i < uv.length; i++) uv[i] *= i % 2 ? 1 / 6 : 1;
  const pm = new THREE.Mesh(pathGeo, pathMat);
  pm.receiveShadow = true;
  pm.renderOrder = 1;
  pm.name = "parkPaths";
  scene.add(pm);
  const wp = {
    style: STYLE.BLANK,
    layer: LAYER.LIME,
    tint: [0.78, 0.76, 0.72],
    seed: 3,
  };
  const wy = G.CURB_H,
    wh = 0.85,
    t = 0.45;
  const gaps = [-150, -60, 60, 150];
  // south + north walls with entrance gaps
  for (const [za, zb] of [
    [P.z1 - t, P.z1],
    [P.z0, P.z0 + t],
  ]) {
    let x = P.x0;
    for (const gx of [...gaps, P.x1 + 100]) {
      const e = Math.min(gx - 3, P.x1);
      if (e > x) {
        wall.box(x, wy, za, e, wy + wh, zb, wp, {}, true);
        solids?.box(x, wy, za, e, wy + wh, zb, "park");
      }
      x = gx + 3;
    }
  }
  // side walls (between the north and south walls; the corner squares belong to them), gaps every 160 m
  for (const sx of [P.x0, P.x1 - t]) {
    for (let z = P.z1 - t; z > P.z0 + t + 1; z -= 160) {
      const z0 = Math.max(P.z0 + t, z - 150);
      wall.box(sx, wy, z0, sx + t, wy + wh, z, wp, {}, true);
      solids?.box(sx, wy, z0, sx + t, wy + wh, z, "park");
    }
  }
  // ---- (coast r1) the waterfront edge all round the island + the near far banks (waterfront.ts)
  const coast = buildWaterfront({
    scene,
    T,
    piers: PIERS,
    pileFields: PILE_FIELDS,
    solids,
    zips,
    fills,
    wall,
  });
  out.wetSegs = coast.wetSegs;
  out.coast = coast;
  const wg = wall.build();
  const wm = new THREE.Mesh(wg, facadeMat);
  wm.castShadow = true;
  wm.receiveShadow = true;
  wm.name = "seawall+parkwall";
  scene.add(wm);

  // ---- water: harbour / rivers everywhere below the land (water.ts: PBR river material, SSR + sky Fresnel)
  const river = buildWater({ scene, T, renderer });
  out.water = river;
  out.update = (dt, camera) => {
    river.update(dt, camera);
    coast.update(camera);
  };
  return out;
}
