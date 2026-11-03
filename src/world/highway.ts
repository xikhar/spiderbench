// @ts-nocheck
// Waterfront highways: a West-Side-Highway-like boulevard along the
// Hudson and an FDR-Drive-like road along the East River, both at grade on the widened promenade (layout.SHORE_PUSH):
//   seawall | esplanade (railing, lamps, benches, trees: props.ts, 0..12 m) | highway (HW.W m) | sidewalk | grid
// 3 lanes each way, shoulders, a planted median with trees, shader-drawn markings (solid edge lines, dashed lane lines,
// double yellow along the median) and a stream of instanced cars / trucks per lane (1 draw call per kit, CPU moved).
// Collision (C4): the road surface is flat at promenade height (GY.WALK) so terrainHeight() is unchanged; the
// markings / median paint are coplanar decals (polygon offset). Median tree trunks get exact cylinders; crowns (foliage)
// are not solid, like trees.ts.
import { lazyShaderSections } from "../shaderSections.ts";
import highwayShaderSource from "./shaders/glsl/highway.glsl?raw";
import { injectShader } from "../render/shaderInjection.ts";
import * as THREE from "three";
import {
  G,
  shoreX,
  onLand,
  inPark,
  buildBlocks,
  roadRects,
  mulberry32,
  vmapAt,
  batteryAt,
  BATTERY,
  ZFIX,
} from "./layout.ts"; // (layout2 r4) vmapAt / batteryAt
import {
  createVehicleSet,
  getVehiclePaint,
  pickVehicle,
} from "./vehicleInstancing.ts";

const highwayShader = lazyShaderSections(() => highwayShaderSource);
// (bridges r3) real vehicles (was box kits); trees -> trees.ts (was CanopyBatch)

export const HW = { INSET: 12.5, SH: 1.2, LANE: 3.5, MED: 3.0 };
HW.W = HW.SH * 2 + HW.LANE * 6 + HW.MED; // 26.4 m
const Y = G.CURB_H; // promenade / sidewalk top
// (zfix) the road skin was coplanar with the promenade sidewalk (polygon offset only: with the reversed depth buffer three
// flips the offset factor but not the units, so seen from above the pavement flickered through the asphalt). 1.5 cm up
// (collision: flat at GY.WALK, within the 2 cm render tolerance).
const YR = Y + (ZFIX ? 0.015 : 0);

// runs of highway centre-line samples per side: [{pts: [{x, z, nx, nz, tx, tz, s}], len}]
let _runs = null; // (coast r2) memoized: waterfront.ts reads the strip too (plaza lawns stay off it)
export function highwayRuns() {
  if (_runs) return _runs;
  const runs = (_runs = []);
  const STEP = 6;
  // the grid's curb rects (blocks incl. their sidewalk rings) and road rects near either shore: the highway strip must
  // stay clear of them (streetsAt() reports the promenade in street rows as a non-fill sidewalk, so test rects directly)
  const near = (r) => {
    const [w, e] = shoreX((r.z0 + r.z1) / 2);
    return w < e && Math.min(r.x0 - w, e - r.x1) < 140;
  };
  const rects = [...buildBlocks(), ...roadRects()].filter(near);
  const clear = (x, z) =>
    onLand(x, z) &&
    !inPark(x, z) &&
    !rects.some(
      (r) => x > r.x0 - 1 && x < r.x1 + 1 && z > r.z0 - 1 && z < r.z1 + 1,
    ) &&
    !vmapAt(x, z) &&
    !vmapAt(x + 1, z) &&
    !vmapAt(x - 1, z) &&
    !(z > BATTERY.z0 - 1 && batteryAt(x, z)); // (layout2 r4) street maps (FiDi) + Battery Park lawns
  for (const side of [0, 1]) {
    let cur = null;
    const flush = () => {
      if (cur && cur.len > 260) runs.push(cur);
      cur = null;
    };
    for (let z = G.Z_MIN + 20; z < G.Z_MAX - 20; z += STEP) {
      const [w, e] = shoreX(z);
      if (w >= e) {
        flush();
        continue;
      }
      const [w2, e2] = shoreX(z + 1),
        [w0, e0] = shoreX(z - 1);
      const sx = side ? e : w,
        dx = ((side ? e2 : w2) - (side ? e0 : w0)) / 2;
      let tx = dx,
        tz = 1;
      const L = Math.hypot(tx, tz);
      tx /= L;
      tz /= L;
      let nx = tz,
        nz = -tx;
      if ((side ? -1 : 1) * nx < 0) {
        nx = -nx;
        nz = -nz;
      } // inward (toward the land)
      let ok = true;
      for (let u = -1.5; u <= HW.W + 3; u += 1.5)
        if (!clear(sx + nx * (HW.INSET + u), z + nz * (HW.INSET + u))) {
          ok = false;
          break;
        }
      if (!ok) {
        flush();
        continue;
      }
      const p = {
        x: sx + nx * HW.INSET,
        z: z + nz * HW.INSET,
        nx,
        nz,
        tx,
        tz,
        s: 0,
        side,
      };
      if (!cur) cur = { pts: [], len: 0, side };
      const last = cur.pts[cur.pts.length - 1];
      if (last) {
        cur.len += Math.hypot(p.x - last.x, p.z - last.z);
      }
      p.s = cur.len;
      cur.pts.push(p);
    }
    flush();
  }
  return runs;
}

function createHighwayMaterial(T) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  const uni = {
    tCol: { value: T.asphaltCol },
    tNoise: { value: T.noise },
    tMacro: { value: T.asphaltMacro },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",highwayShader.vertexCommon,
      )
      .replace(
        "#include <fog_vertex>",highwayShader.vertexFogVertex,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",injectShader(highwayShader.fragmentCommon, HW.SH.toFixed(2), HW.LANE.toFixed(2), (HW.LANE / 2).toFixed(2), HW.W.toFixed(2), HW.SH.toFixed(2), HW.LANE.toFixed(2), HW.MED.toFixed(2)),
      )
      .replace("#include <map_fragment>",highwayShader.fragmentMap)
      .replace(
        "#include <roughnessmap_fragment>",highwayShader.fragmentRoughness,
      );
  };
  mat.customProgramCacheKey = () => "city-highway-v1";
  return mat;
}

// car / truck kits: boxes [x0, y0, z0, x1, y1, z1, shade] (+z forward); shade 1 = paint (instance colour), <1 = dark
export const KITS = {
  car: [
    [-0.88, 0.28, -2.2, 0.88, 0.95, 2.2, 1],
    [-0.8, 0.95, -1.2, 0.8, 1.42, 0.85, 0.12],
    [-0.72, 1.42, -1.05, 0.72, 1.47, 0.7, 1],
    [-0.9, 0.0, -1.7, 0.9, 0.34, -1.1, 0.05],
    [-0.9, 0.0, 1.1, 0.9, 0.34, 1.7, 0.05],
  ],
  truck: [
    [-1.2, 0.5, -4.6, 1.2, 3.4, 2.2, 1],
    [-1.15, 0.5, 2.2, 1.15, 2.6, 4.3, 0.85],
    [-1.1, 1.7, 3.5, 1.1, 2.4, 4.32, 0.1],
    [-1.2, 0.0, -4.0, 1.2, 0.55, 3.8, 0.05],
  ],
};
export function kitGeometry(parts) {
  const P = [],
    N = [],
    C = [],
    I = [];
  let n = 0;
  const F = [
    [
      [1, 0, 0],
      [
        [1, 0, 1],
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
    ],
    [
      [0, 1, 0],
      [
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
        [0, 1, 0],
      ],
    ],
    [
      [0, 0, 1],
      [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
    ],
    [
      [0, 0, -1],
      [
        [1, 0, 0],
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
    ],
  ];
  for (const [x0, y0, z0, x1, y1, z1, k] of parts) {
    for (const [nrm, cs] of F) {
      for (const [a, b, c] of cs) {
        P.push(a ? x1 : x0, b ? y1 : y0, c ? z1 : z0);
        N.push(...nrm);
        C.push(k, k, k);
      }
      I.push(n, n + 1, n + 2, n, n + 2, n + 3);
      n += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  return g;
}
// muted NYC traffic palette: white / silver / greys / black / navy / maroon + yellow cabs
export const PAINT = [
  [0.8, 0.8, 0.78],
  [0.62, 0.63, 0.64],
  [0.4, 0.41, 0.42],
  [0.06, 0.06, 0.065],
  [0.12, 0.15, 0.24],
  [0.33, 0.08, 0.07],
  [0.72, 0.72, 0.7],
  [0.2, 0.2, 0.2],
];
export const CAB = [0.85, 0.6, 0.08];

export function buildHighways({ scene, T, solids = null, models = null }) {
  const runs = highwayRuns();
  const group = new THREE.Group();
  group.name = "highways";
  scene.add(group);
  // ---- road surface strips
  const P = [],
    N = [],
    A = [],
    I = [];
  let v = 0;
  for (const R of runs) {
    for (let i = 0; i < R.pts.length; i++) {
      const p = R.pts[i];
      P.push(p.x, YR, p.z, p.x + p.nx * HW.W, YR, p.z + p.nz * HW.W);
      N.push(0, 1, 0, 0, 1, 0);
      A.push(0, p.s, HW.W, p.s);
      if (i) I.push(v - 2, v, v - 1, v - 1, v, v + 1);
      v += 2;
    }
  }
  // (r14) critic: 'the West Side / FDR edge is a thin grey strip, no park or greenery'. Hudson-River-Park-like lawn
  // bands on the esplanade between the benches and the highway (inset 4.5..11 m off the seawall, around the promenade
  // street trees at 8.5 m), broken by paved cross paths every 50-110 m. Drawn in the highway road mesh itself with the
  // median-grass branch of its shader (aHw.x = median centre): no new draw call / program. 1 cm above the walk (no
  // collision needed, within the 2 cm tolerance).
  {
    const lr = mulberry32(14014),
      uMed = HW.SH + 3 * HW.LANE + HW.MED / 2;
    for (const R of runs) {
      let next = 10 + lr() * 30,
        on = true;
      for (let i = 0; i < R.pts.length; i++) {
        const p = R.pts[i];
        if (p.s > next) {
          on = !on;
          next = p.s + (on ? 50 + lr() * 60 : 5 + lr() * 4);
        }
        const q = R.pts[i + 1];
        if (!q || !on) continue;
        const a0 = -8.0,
          a1 = -1.5,
          y = Y + (ZFIX ? 0.02 : 0.01); // (zfix) was 1 cm: 5 mm clear of the lifted road skin
        const vv = v;
        P.push(
          p.x + p.nx * a0,
          y,
          p.z + p.nz * a0,
          p.x + p.nx * a1,
          y,
          p.z + p.nz * a1,
          q.x + q.nx * a0,
          y,
          q.z + q.nz * a0,
          q.x + q.nx * a1,
          y,
          q.z + q.nz * a1,
        );
        N.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        A.push(uMed, p.s, uMed, p.s, uMed, q.s, uMed, q.s);
        I.push(vv, vv + 2, vv + 1, vv + 1, vv + 2, vv + 3);
        v += 4;
      }
    }
  }
  // (winding: make every quad face up)
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i] * 3,
      b = I[i + 1] * 3,
      c = I[i + 2] * 3;
    const ux = P[b] - P[a],
      uz = P[b + 2] - P[a + 2],
      wx = P[c] - P[a],
      wz = P[c + 2] - P[a + 2];
    if (uz * wx - ux * wz < 0) {
      const t = I[i + 1];
      I[i + 1] = I[i + 2];
      I[i + 2] = t;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("aHw", new THREE.Float32BufferAttribute(A, 2));
  g.setIndex(new THREE.Uint32BufferAttribute(I, 1));
  g.computeBoundingSphere();
  const road = new THREE.Mesh(g, createHighwayMaterial(T));
  road.receiveShadow = true;
  road.name = "highwayRoad";
  road.renderOrder = 1;
  group.add(road);

  // ---- median trees (bridges r3: real trees.ts street trees instead of CanopyBatch blobs + stick trunks; returned as
  // tree spots, city.ts plants them with the other street trees: same LODs / impostors / bark / trunk collision)
  const rnd = mulberry32(5150);
  const treeSpots = [];
  const mc = HW.SH + 3 * HW.LANE + HW.MED / 2;
  for (const R of runs) {
    let next = 8;
    for (const p of R.pts) {
      if (p.s < next) continue;
      next = p.s + 13 + rnd() * 6;
      if (rnd() < 0.15) continue;
      treeSpots.push({
        x: p.x + p.nx * mc,
        z: p.z + p.nz * mc,
        kind: rnd() < 0.3 ? "small" : "street",
        sc: 0.7 + rnd() * 0.25,
      });
    }
  }
  // (r14) esplanade groves over the lawn bands (bridges r3: real trees, sparser, instead of the far-only blob fill):
  // irregular groups with open lawn stretches between them
  {
    const er = mulberry32(14015);
    for (const R of runs) {
      let next = er() * 10;
      for (const p of R.pts) {
        if (p.s < next) continue;
        next = p.s + 10 + er() * 10;
        const grove =
          Math.sin(p.s * 0.021 + R.side * 2.1) +
          0.6 * Math.sin(p.s * 0.057 + 1.3);
        if (grove < -0.1 && er() < 0.9) continue; // open lawn stretches between the groves
        const off = -(4.8 + er() * 2.6);
        treeSpots.push({
          x: p.x + p.nx * off + p.tx * (er() - 0.5) * 3,
          z: p.z + p.nz * off + p.tz * (er() - 0.5) * 3,
          kind: er() < 0.35 ? "small" : "street",
          sc: 0.75 + er() * 0.35,
        });
      }
    }
  }

  // ---- traffic: per run, per lane, cars at random gaps moving at lane speed, wrapping at the run's ends (they sink
  // into the 'tunnel portals' over the last 25 m)
  const cars = [];
  for (const R of runs) {
    for (let lane = 0; lane < 6; lane++) {
      const inner = lane >= 3,
        j = lane % 3;
      const u = inner
        ? HW.SH + 3 * HW.LANE + HW.MED + (j + 0.5) * HW.LANE
        : HW.SH + (j + 0.5) * HW.LANE;
      // direction: drive on the right. +1 = along increasing z (south). right(t) = (-tz, tx); seawall side when right.n < 0
      const t0 = R.pts[Math.floor(R.pts.length / 2)],
        rn = -t0.tz * t0.nx + t0.tx * t0.nz;
      const dir = rn < 0 !== inner ? 1 : -1;
      const speed =
        (j === 0 ? 22 : j === 1 ? 19 : 16) *
        (inner ? 1 : 1) *
        (0.9 + rnd() * 0.15);
      // dense stretches / gaps (traffic waves)
      for (let s = rnd() * 30; s < R.len; ) {
        const truck = rnd() < 0.1;
        cars.push({
          R,
          u,
          dir,
          s,
          v: speed * (0.95 + rnd() * 0.1),
          truck,
          col:
            rnd() < 0.16 && !truck
              ? CAB
              : PAINT[Math.floor(rnd() * PAINT.length)],
          seg: 0,
        });
        const wave = 0.5 + 0.5 * Math.sin(s / 170 + lane * 1.7 + R.len);
        s += (truck ? 16 : 10) + (8 + 60 * wave) * (0.4 + rnd());
      }
    }
  }
  // Reuse the street-traffic vehicle models (vehicleInstancing.ts: LOD0 / LOD1 / grouped LOD2, shared materials
  // programs, paint mix, taxi toppers) instead of the box kits; small per-car lane offsets
  for (const c of cars) {
    const vehicleType = pickVehicle(rnd());
    c.t = vehicleType.type;
    c.col = getVehiclePaint(vehicleType.type, rnd());
    c.seed = rnd();
    c.off = (rnd() - 0.5) * 0.5;
  }
  const counts = {};
  for (const c of cars) counts[c.t] = (counts[c.t] || 0) + 1;
  const vehicleSet = createVehicleSet({
    models,
    group,
    counts,
    name: "highwayVeh",
    maxLow: 600,
    maxFar: 2500,
  });
  const place = (c) => {
    const pts = c.R.pts;
    // advance the cached segment index to s
    let k = c.seg;
    while (k + 1 < pts.length - 1 && pts[k + 1].s <= c.s) k++;
    while (k > 0 && pts[k].s > c.s) k--;
    c.seg = k;
    const a = pts[k],
      b = pts[Math.min(k + 1, pts.length - 1)],
      t = b.s > a.s ? (c.s - a.s) / (b.s - a.s) : 0;
    const nx = a.nx + (b.nx - a.nx) * t,
      nz = a.nz + (b.nz - a.nz) * t,
      u = c.u + c.off;
    const x = a.x + (b.x - a.x) * t + nx * u,
      z = a.z + (b.z - a.z) * t + nz * u;
    let hx = (b.x - a.x) * c.dir,
      hz = (b.z - a.z) * c.dir;
    if (!(hx || hz)) hz = c.dir;
    const edge = Math.min(c.s, c.R.len - c.s),
      k2 = Math.min(1, Math.max(0, edge / 25));
    vehicleSet.addVehicle(
      c.t,
      x,
      Y - (1 - k2) * 2.6,
      z,
      Math.atan2(-hz, hx),
      0,
      c.col,
      c.seed,
    ); // sink into the 'tunnel portals' at the run ends
  };
  let acc = 0,
    acc0 = false;
  return {
    group,
    runs,
    cars: cars.length,
    treeSpots,
    update(dt, camera) {
      // stream only while the waterfront can be on screen (aerial, or near a river)
      acc += dt;
      if (camera && camera.position.y < 60) {
        const [w, e] = shoreX(camera.position.z);
        if (
          w < e &&
          Math.min(camera.position.x - w, e - camera.position.x) > 300
        ) {
          if (vehicleSet && !acc0) {
            vehicleSet.hide();
            acc0 = true;
          }
          return;
        }
      }
      acc0 = false;
      if (!vehicleSet || !camera) return;
      const d = Math.min(acc, 0.25);
      acc = 0;
      vehicleSet.beginFrame(camera, 1400);
      for (const c of cars) {
        c.s += c.v * d * c.dir;
        if (c.s > c.R.len) c.s -= c.R.len;
        else if (c.s < 0) c.s += c.R.len;
        place(c);
      }
      vehicleSet.endFrame();
    },
  };
}
