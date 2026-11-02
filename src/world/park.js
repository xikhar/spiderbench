// OWNER: park agent (city remake). Central Park set pieces beyond the ground / trees:
//   - PARK_SITES: lots inside the park kept clear of trees / paths (trees.js, ground.js via adjustParkPaths)
//   - a Met-like museum on the Fifth-Avenue edge (~80th-84th): limestone Beaux-Arts front with a colonnaded central
//     pavilion and grand stairs, long wings, darker modern rear wings with big skylights and a glass court (ref 10)
//   - Manhattan-schist rock outcrops (stacked pale-grey slabs) at meadow edges and in the woods (refs 08 / 09)
// Everything is drawn with the city facade material (one FacadeBuilder mesh) and has exact box / cylinder collision.
import * as THREE from "three";
import { G, mulberry32, parkWaterAt, PARK_WATER } from "./layout.js";
import { FacadeBuilder, STYLE, LAYER } from "./facade.js";
import { MB } from "./geom.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { nightK } from "../render/daynight.js"; // (night) lamp globes glow at night
import { cityLights } from "../render/citylights.js"; // (night) park lamps are real lights
import { PARK_MEADOWS, meadowDist } from "./trees.js"; // (park r3) ball-field positions (runtime use only: no init-order cycle)

const GRASS_Y = G.CURB_H + 0.02;
const GY_PATH = G.CURB_H + 0.02; // ground.js GY.PATH
// Met-like museum: its lot runs from the East-Drive side (x0) to just behind the 5th-Av perimeter walk (x1)
export const PARK_SITES = {
  met: { x0: 136, x1: 227, z0: -1378, z1: -1204 },
};
// (park r6) schist outcrops placed by buildPark ([x, z, R]); trees.js keeps trunks off their cores (buildPark runs first)
export const PARK_ROCKS = [];
export const PARK_CROWD_SPOTS = []; // (peds r6) lawn + park-edge people -> npc/crowd.js statics (detailed skinned models, was ~40-tri box figures)

// Hook for ground.js (called right after the park paths are generated, before anything uses them): the East Drive
// swings west around the museum lot, and footpaths crossing the lot are cut (their ends stay as dead-end spurs).
export function adjustParkPaths(paths) {
  const S = PARK_SITES.met;
  const resample = (pts, step) => {
    const o = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1],
        [bx, bz] = pts[i],
        L = Math.hypot(bx - ax, bz - az),
        n = Math.max(1, Math.ceil(L / step));
      for (let k = 1; k <= n; k++)
        o.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    return o;
  };
  const out = [];
  for (const p of paths) {
    if (p.drive) {
      const pts = resample(p.pts, 6),
        tx = S.x0 - 9;
      for (const q of pts) {
        if (q[0] < tx) continue;
        const dz = Math.max(S.z0 - 4 - q[1], q[1] - (S.z1 + 4), 0);
        const w = dz >= 55 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * dz) / 55);
        q[0] += (tx - q[0]) * w;
      }
      out.push({ ...p, pts });
      continue;
    }
    const pts = resample(p.pts, 3),
      m = 2.5 + p.w / 2;
    let run = [];
    const flush = () => {
      if (run.length >= 3) out.push({ ...p, pts: run });
      run = [];
    };
    for (const q of pts) {
      if (
        q[0] > S.x0 - m &&
        q[0] < S.x1 + m &&
        q[1] > S.z0 - m &&
        q[1] < S.z1 + m
      )
        flush();
      else run.push(q);
    }
    flush();
  }
  paths.length = 0;
  paths.push(...out);
  addWoodlandPaths(paths);
  return paths;
}

// (park r8) critic r7: 'no meandering path network density'. Central Park's woods are laced with narrow footpaths
// that branch off the walks and drives and rejoin another one. Each new path starts on an existing path, wanders
// (curvature noise, steering off water, the lawns' interiors and the museum lot) and is kept only if it reaches another
// path (a few dead-end spurs survive). Tagged `minor`: trees.js lets crowns overhang them (trunks keep clear).
function addWoodlandPaths(paths) {
  const P = G.PARK,
    M = PARK_SITES.met,
    rnd = mulberry32(8088);
  const C = 10,
    grid = new Map();
  const put = (x, z, id) => {
    const k = Math.floor(x / C) * 100003 + Math.floor(z / C);
    let c = grid.get(k);
    if (!c) grid.set(k, (c = []));
    c.push([x, z, id]);
  };
  paths.forEach((p, id) => {
    for (let i = 1; i < p.pts.length; i++) {
      const [ax, az] = p.pts[i - 1],
        [bx, bz] = p.pts[i],
        n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
      for (let k = 0; k <= n; k++)
        put(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, id);
    }
  });
  const hit = (x, z, d, skip) => {
    let best = null,
      bd = d * d;
    for (let i = Math.floor((x - d) / C); i <= Math.floor((x + d) / C); i++)
      for (let j = Math.floor((z - d) / C); j <= Math.floor((z + d) / C); j++) {
        for (const q of grid.get(i * 100003 + j) ?? []) {
          if (q[2] === skip) continue;
          const e = (q[0] - x) ** 2 + (q[1] - z) ** 2;
          if (e < bd) {
            bd = e;
            best = q;
          }
        }
      }
    return best;
  };
  const wet = (x, z, m) =>
    parkWaterAt(x, z) ||
    parkWaterAt(x + m, z) ||
    parkWaterAt(x - m, z) ||
    parkWaterAt(x, z + m) ||
    parkWaterAt(x, z - m);
  const bad = (x, z) =>
    x < P.x0 + 12 ||
    x > P.x1 - 12 ||
    z < P.z0 + 12 ||
    z > P.z1 - 12 ||
    (x > M.x0 - 8 && x < M.x1 + 8 && z > M.z0 - 8 && z < M.z1 + 8);
  const lawn = (x, z) => meadowDist(x, z) < 0.9;
  let added = 0;
  for (let n = 0; n < 160 && added < 46; n++) {
    const src = paths[Math.floor(rnd() * paths.length)],
      sid = paths.indexOf(src);
    if (src.pts.length < 3) continue;
    const i = 1 + Math.floor(rnd() * (src.pts.length - 2));
    const [ax, az] = src.pts[i - 1],
      [bx, bz] = src.pts[i + 1];
    let ang =
      Math.atan2(bz - az, bx - ax) +
      (rnd() < 0.5 ? 1 : -1) * (Math.PI / 2 + (rnd() - 0.5) * 1.1);
    let [x, z] = src.pts[i];
    if (lawn(x, z) || wet(x, z, 10)) continue;
    const pts = [[x, z]],
      step = 5;
    let turn = (rnd() - 0.5) * 0.12,
      joined = false;
    for (let k = 0; k < 70; k++) {
      turn = turn * 0.85 + (rnd() - 0.5) * 0.16;
      ang += turn;
      let nx = x + Math.cos(ang) * step,
        nz = z + Math.sin(ang) * step,
        t = 0;
      while ((wet(nx, nz, 7) || bad(nx, nz) || lawn(nx, nz)) && t++ < 10) {
        ang += (turn >= 0 ? 1 : -1) * 0.4;
        nx = x + Math.cos(ang) * step;
        nz = z + Math.sin(ang) * step;
      }
      if (t >= 10) break;
      x = nx;
      z = nz;
      pts.push([x, z]);
      if (k > 5) {
        const q = hit(x, z, 4.5, sid);
        if (q && !(q[2] === sid)) {
          pts.push([q[0], q[1]]);
          joined = true;
          break;
        }
      }
    }
    if (pts.length < 8 || (!joined && (pts.length < 22 || rnd() < 0.6)))
      continue;
    const id = paths.length;
    paths.push({ pts, w: 2.3 + rnd() * 0.9, minor: true });
    for (let k = 1; k < pts.length; k++) put(pts[k][0], pts[k][1], id);
    added++;
  }
}

export function buildPark({
  scene,
  facadeMat,
  solids = null,
  zips = null,
  meadowDist = null,
  parkPaths = [],
}) {
  const F = new FacadeBuilder();
  const S = solids;
  const glaze = []; // (park r2) skylight glass planes [x0, z0, x1, z1, y]
  const glazeP = []; // (park r3) sloped glazing polygons (gable / pyramid faces): [[x, y, z], ...] (3 or 4 corners)
  const box = (
    x0,
    y0,
    z0,
    x1,
    y1,
    z1,
    p,
    faces = {},
    top = true,
    roofP = null,
    kind = "wall",
  ) => {
    F.box(x0, y0, z0, x1, y1, z1, p, faces, top, false, roofP);
    S?.box(x0, y0, z0, x1, y1, z1, kind);
  };
  const out = { count: 0 };
  const spray = []; // (park r7) fountain jets [x, y, z]

  // ------------------------------------------------------------------ Met-like museum
  {
    const lime = {
      style: STYLE.BLANK,
      layer: LAYER.LIME,
      tint: [0.93, 0.9, 0.84],
      seed: 11,
      floorH: 7,
      bayW: 5.6,
      winW: 0.46,
      winH: 0.72,
      margin: 1.4,
      depth: 0.6,
      glass: 1,
    }; // (park r3) taller, deeper-set windows
    const limeWin = { ...lime };
    const pav = {
      ...lime,
      floorH: 12.5,
      bayW: 7.2,
      winW: 0.52,
      winH: 0.74,
      depth: 0.6,
      seed: 12,
    };
    const dark = {
      style: STYLE.BLANK,
      layer: LAYER.GRANITE,
      tint: [0.42, 0.41, 0.4],
      seed: 13,
      floorH: 4.5,
      bayW: 3,
      winW: 0.8,
      winH: 0.5,
      margin: 0.4,
      depth: 0.2,
    };
    const glass = {
      style: STYLE.BLANK,
      layer: LAYER.METAL,
      tint: [0.72, 0.8, 0.86],
      seed: 14,
      floorH: 4.0,
      bayW: 1.6,
      winW: 0.96,
      winH: 0.9,
      margin: 0,
      depth: 0.04,
      glass: 2,
    };
    const roof = {
      style: STYLE.BLANK,
      layer: LAYER.ROOF_MEMBRANE,
      tint: [0.11, 0.11, 0.115],
      seed: 15,
    }; // (park r6) darker roofs (ref 10: near-black membranes)
    const roofG = {
      style: STYLE.BLANK,
      layer: LAYER.ROOF_GRAVEL,
      tint: [0.14, 0.14, 0.14],
      seed: 16,
    };
    const sky = {
      style: STYLE.BLANK,
      layer: LAYER.WHITE,
      tint: [0.27, 0.32, 0.37],
      seed: 17,
    }; // frosted, pale skylight glass (ref 10)
    const P_ = (s) => ({ style: s, gH: 0 });
    const W = P_(STYLE.PUNCHED),
      C = P_(STYLE.CURTAIN),
      B = P_(STYLE.BLANK);
    const HW = 19.5,
      HP = 25.5,
      HR = 15.5;
    // front wings (5th Av facade: tall windows between pilasters)
    box(
      196,
      0,
      -1362,
      222,
      HW,
      -1298,
      limeWin,
      { px: W, nz: W, pz: null, nx: W },
      true,
      roof,
    );
    box(
      196,
      0,
      -1274,
      222,
      HW,
      -1208,
      limeWin,
      { px: W, pz: W, nz: null, nx: W },
      true,
      roof,
    );
    // wing end pavilions project 1.2 m (corner pavilions of the Hunt facade)
    box(
      222,
      0,
      -1362,
      223.2,
      HW + 1.2,
      -1348,
      lime,
      { px: W, nz: B, pz: B, nx: B },
      true,
      lime,
    );
    box(
      222,
      0,
      -1222,
      223.2,
      HW + 1.2,
      -1208,
      lime,
      { px: W, nz: B, pz: B, nx: B },
      true,
      lime,
    );
    // attic / balustrade band on the wings
    box(
      221.4,
      HW,
      -1348,
      222,
      HW + 1.1,
      -1298,
      lime,
      { px: B, nz: null, pz: null, nx: B },
      true,
      lime,
    );
    box(
      221.4,
      HW,
      -1274,
      222,
      HW + 1.1,
      -1222,
      lime,
      { px: B, nz: null, pz: null, nx: B },
      true,
      lime,
    );
    // central pavilion (three great arched bays) + attic
    box(
      196,
      0,
      -1298,
      224,
      HP,
      -1274,
      pav,
      { px: W, nz: B, pz: B, nx: B },
      true,
      roof,
    );
    box(
      222.5,
      HP,
      -1296,
      224,
      HP + 2.4,
      -1276,
      lime,
      { px: B, nz: B, pz: B, nx: B },
      true,
      lime,
    );
    // colonnade: 4 pairs of columns on a plinth, entablature above them
    const colP = { ...lime, tint: [0.95, 0.92, 0.86] };
    box(
      224,
      0,
      -1296.5,
      226.6,
      3.0,
      -1275.5,
      lime,
      { px: B, nz: B, pz: B, nx: null },
      true,
      lime,
    );
    for (const zc of [
      -1294.8, -1293.0, -1289.5, -1287.7, -1284.3, -1282.5, -1279.0, -1277.2,
    ]) {
      F.cyl(225.3, zc, 0.52, 3.0, 20.6, 8, colP, STYLE.BLANK, false);
      S?.cyl(
        225.3,
        zc,
        3.0,
        20.6,
        (0.52 * (1 + Math.cos(Math.PI / 8))) / 2,
        (0.52 * (1 + Math.cos(Math.PI / 8))) / 2,
        "wall",
      );
      box(
        224.55,
        20.6,
        zc - 0.75,
        226.05,
        21.2,
        zc + 0.75,
        colP,
        { nx: null },
        false,
      );
    }
    box(
      224,
      21.2,
      -1296.5,
      226.6,
      23.8,
      -1275.5,
      lime,
      { px: B, nz: B, pz: B, nx: null },
      true,
      lime,
    );
    // (park r10) critic r9: 'museum is a clean untextured box; add banners'. The Met's exhibition banners: three tall
    // cloth banners (muted crimson, slate, ochre) hung between the column pairs against the pavilion front
    for (const [zc, t] of [
      [-1291.25, [0.5, 0.13, 0.1]],
      [-1285.9, [0.2, 0.26, 0.36]],
      [-1280.65, [0.62, 0.46, 0.2]],
    ]) {
      box(
        224.0,
        7.6,
        zc - 1.0,
        224.07,
        19.4,
        zc + 1.0,
        { style: STYLE.BLANK, layer: LAYER.WHITE, tint: t, seed: 75 },
        { px: B, nz: B, pz: B, nx: null },
        true,
        null,
        "awning",
      );
      box(
        223.95,
        19.4,
        zc - 1.1,
        224.14,
        19.55,
        zc + 1.1,
        {
          style: STYLE.BLANK,
          layer: LAYER.METAL,
          tint: [0.3, 0.3, 0.3],
          seed: 76,
        },
        { px: B, nz: B, pz: B, nx: null },
        true,
        null,
        "awning",
      );
    }
    // grand stairs down to the plaza (6 treads up to the plinth; side faces offset 2 cm per tread: never coplanar)
    for (let k = 0; k < 6; k++) {
      const x1 = 231.5 - k * 0.8,
        e = k * 0.02;
      box(
        226.6,
        0,
        -1306 + e,
        x1,
        GRASS_Y + (k + 1) * 0.47,
        -1266 - e,
        lime,
        { nx: null },
        true,
        { ...lime, tint: [0.8, 0.78, 0.74] },
      );
    }
    // (park r7) critic r6: 'museum is a plain box; needs a Beaux-Arts front on Fifth, steps and fountains'. Paired
    // pilasters between the window bays of both wings (the facade shader's bay grid: margin 1.4, bays ~5.6 m), a deep
    // projecting cornice + balustrade band under the attic, a paved plaza and two round fountains flanking the stairs
    {
      const pil = { ...lime, tint: [0.97, 0.94, 0.88] };
      for (const [za, zb, skip] of [
        [-1362, -1298, (z) => z < -1347],
        [-1274, -1208, (z) => z > -1223],
      ]) {
        const W = zb - za,
          us = W - 2 * lime.margin,
          nb = Math.max(1, Math.round(us / lime.bayW)),
          bw = us / nb;
        for (let i = 0; i <= nb; i++) {
          const z = zb - (lime.margin + i * bw);
          if (skip(z)) continue;
          box(
            222,
            GRASS_Y,
            z - 0.5,
            222.42,
            HW - 1.45,
            z + 0.5,
            pil,
            { px: B, nz: B, pz: B, nx: null },
            false,
          );
          box(
            221.95,
            GRASS_Y,
            z - 0.62,
            222.55,
            1.6,
            z + 0.62,
            pil,
            { px: B, nz: B, pz: B, nx: null },
            true,
            pil,
          ); // plinth
          box(
            221.95,
            HW - 1.75,
            z - 0.62,
            222.55,
            HW - 1.45,
            z + 0.62,
            pil,
            { px: B, nz: B, pz: B, nx: null },
            true,
            pil,
          ); // capital
        }
        // cornice: a 0.9 m deep moulded ledge (two stepped boxes) and a dentil course under it
        box(
          222,
          HW - 1.45,
          za + (za < -1300 ? 14 : 0),
          222.95,
          HW - 0.95,
          zb - (za < -1300 ? 0 : 14),
          pil,
          { px: B, nz: B, pz: B, nx: null },
          true,
          pil,
          "cornice",
        );
        box(
          222,
          HW - 0.95,
          za + (za < -1300 ? 14 : 0),
          223.25,
          HW - 0.55,
          zb - (za < -1300 ? 0 : 14),
          pil,
          { px: B, nz: B, pz: B, nx: null },
          true,
          pil,
          "cornice",
        );
      }
      // (park r8) critic r7: 'a huge beige box'. The wings' end faces (seen from Fifth Av south / north) get the same
      // two-step cornice, a string course over the rusticated ground storey and a plinth course, so every visible face
      // of the limestone block is banded, not a flat wall
      for (const [zf, dir] of [
        [-1362, -1],
        [-1208, 1],
      ]) {
        const zo = (d) => (dir < 0 ? [zf - d, zf] : [zf, zf + d]);
        let [a0, a1] = zo(0.95);
        box(
          196,
          HW - 1.45,
          a0,
          223.2,
          HW - 0.95,
          a1,
          pil,
          { all: B },
          true,
          pil,
          "cornice",
        );
        [a0, a1] = zo(1.25);
        box(
          196,
          HW - 0.95,
          a0,
          223.2 + 0.3,
          HW - 0.55,
          a1,
          pil,
          { all: B },
          true,
          pil,
          "cornice",
        );
        [a0, a1] = zo(0.22);
        box(
          196,
          6.0,
          a0,
          223.2,
          6.45,
          a1,
          pil,
          { all: B },
          true,
          pil,
          "cornice",
        );
        [a0, a1] = zo(0.3);
        box(
          196,
          GRASS_Y,
          a0,
          223.2,
          1.2,
          a1,
          { ...lime, tint: [0.78, 0.76, 0.72] },
          { all: B },
          true,
          pil,
        );
      }
      // central pavilion: cornice over the colonnade's entablature + three great arched windows' keystones band
      box(
        224,
        HP - 1.2,
        -1297.5,
        227.2,
        HP - 0.6,
        -1274.5,
        pil,
        { px: B, nz: B, pz: B, nx: null },
        true,
        pil,
        "cornice",
      );
      // plaza: pale granite pavers from the facade to the park's Fifth-Av edge, with a darker border
      F.horiz(223.4, -1340, 233.3, -1232, GRASS_Y + 0.006, {
        style: STYLE.BLANK,
        layer: LAYER.CONCRETE,
        tint: [0.86, 0.84, 0.8],
        seed: 71,
      });
      for (const zc of [-1321, -1251]) {
        const cx = 228.6,
          R = 3.4;
        const stone = { ...lime, tint: [0.84, 0.81, 0.76] };
        const rc = (r, n) => (r * (1 + Math.cos(Math.PI / n))) / 2;
        F.cyl(cx, zc, R, GRASS_Y, GRASS_Y + 0.62, 28, stone, STYLE.BLANK, true);
        S?.cyl(cx, zc, GRASS_Y, GRASS_Y + 0.62, rc(R, 28), rc(R, 28), "wall");
        F.cyl(
          cx,
          zc,
          R - 0.35,
          GRASS_Y + 0.62,
          GRASS_Y + 0.626,
          28,
          {
            style: STYLE.BLANK,
            layer: LAYER.METAL,
            tint: [0.42, 0.52, 0.56],
            seed: 73,
          },
          STYLE.BLANK,
          true,
        ); // water
        F.cyl(
          cx,
          zc,
          0.7,
          GRASS_Y + 0.62,
          GRASS_Y + 1.25,
          12,
          stone,
          STYLE.BLANK,
          true,
        ); // pedestal
        S?.cyl(
          cx,
          zc,
          GRASS_Y + 0.62,
          GRASS_Y + 1.25,
          rc(0.7, 12),
          rc(0.7, 12),
          "wall",
        );
        spray.push([cx, GRASS_Y + 1.25, zc]);
      }
    }
    const metB = new MB();
    metB.setColor([0.05, 0.055, 0.06]); // skylight steel: gable ends, ridge caps, pyramid ribs
    // rear wings: darker modern galleries (1970s-80s additions)
    // (park r3) stepped roof masses (critic r2: 'one flat slab with 7 copy-pasted skylight grids'): a lower north
    // gallery with a row of gabled ridge skylights, a taller central court crowned by a glass pyramid, a low south
    // gallery with one big flat laylight; front wings get a flat lantern + a gabled one; varied roofing per block
    const HN = 15.5,
      HM = 19.0,
      HS = 13.5;
    const roofN = { ...roofG, tint: [0.15, 0.148, 0.142] },
      roofM = { ...roof, tint: [0.1, 0.1, 0.108] },
      roofS = {
        ...roof,
        layer: LAYER.ROOF_MEMBRANE,
        tint: [0.2, 0.196, 0.188],
      };
    // (park r7) critic r6: 'blank walls'. The galleries' park faces get ribbon clerestories (RIBBON style bands)
    const R_ = P_(STYLE.RIBBON);
    box(
      150,
      0,
      -1356,
      196,
      HN,
      -1310,
      dark,
      { nx: R_, nz: R_, pz: null, px: null },
      true,
      roofN,
    );
    box(
      150,
      0,
      -1310,
      196,
      HM,
      -1262,
      dark,
      { nx: R_, nz: B, pz: B, px: null },
      true,
      roofM,
    );
    box(
      150,
      0,
      -1262,
      196,
      HS,
      -1214,
      dark,
      { nx: R_, nz: null, pz: R_, px: null },
      true,
      roofS,
    );
    box(
      160,
      0,
      -1376,
      196,
      13.5,
      -1356,
      glass,
      { nx: C, nz: C, px: C, pz: null },
      true,
      roof,
    ); // glass wing (Sackler-like)
    // west glass court (Lehman-like): (park r8) critic r7: 'add a sculptural facade on the park side'. A 64 m long
    // glass lean-to rises from 8.5 m on the park side to 13.2 m against the galleries (exact wedge collision), with
    // steel rafters every 3.2 m and a ridge flashing
    box(
      138,
      0,
      -1318,
      150,
      8.5,
      -1254,
      glass,
      { nx: C, nz: C, pz: C, px: null },
      false,
    );
    {
      const ya = 8.5,
        yb = 13.2,
        za = -1318,
        zb = -1254;
      const sl = [
        [138, ya, za],
        [138, ya, zb],
        [150, yb, zb],
        [150, yb, za],
      ];
      sl.v = 0.1;
      glazeP.push(sl);
      const e0 = [
          [150, ya, za],
          [138, ya, za],
          [150, yb, za],
        ],
        e1 = [
          [138, ya, zb],
          [150, ya, zb],
          [150, yb, zb],
        ];
      e0.v = e1.v = 0.1;
      glazeP.push(e0, e1);
      S?.ramp(138, ya - 0.02, za, 150, zb, 0, ya, yb, "skylight");
      for (let z = za; z <= zb + 0.01; z += 3.2)
        metB.tube([138, ya + 0.01, z], [150, yb + 0.01, z], 0.02, 4);
      metB.box(137.8, ya - 0.3, za, 138.1, ya + 0.02, zb);
      S?.box(137.8, ya - 0.3, za, 138.1, ya + 0.02, zb, "skylight"); // eaves gutter
      metB.box(149.7, yb - 0.02, za, 150, yb + 0.24, zb);
      S?.box(149.7, yb - 0.02, za, 150, yb + 0.24, zb, "skylight"); // ridge flashing
    }
    const curbP = {
      style: STYLE.BLANK,
      layer: LAYER.METAL,
      tint: [0.32, 0.33, 0.34],
      seed: 18,
    };
    // flat lantern (glazed top on a dark curb, steel ribs)
    const lantern = (x0, z0, x1, z1, y, h) => {
      box(
        x0,
        y,
        z0,
        x1,
        y + h,
        z1,
        curbP,
        { all: B },
        false,
        null,
        "equipment",
      );
      glaze.push([x0, z0, x1, z1, y + h]);
      const lx = x1 - x0 > z1 - z0,
        L = lx ? x1 - x0 : z1 - z0,
        n = Math.max(1, Math.round(L / 3.2));
      // (park r10) critic r9: 'skylights are flat white rectangles pasted on'. Real steel glazing bars 12 cm proud of the
      // glass (rafters every ~3.2 m + a ridge spine), and a 0.22 m raised frame lip all round, so the glass reads set
      // into a framed lantern with depth and shadow lines (exact box collision)
      const fp = { ...curbP, tint: [0.2, 0.21, 0.22] };
      for (let i = 1; i < n; i++) {
        const u = (lx ? x0 : z0) + (L * i) / n;
        if (lx)
          box(
            u - 0.07,
            y + h,
            z0,
            u + 0.07,
            y + h + 0.12,
            z1,
            fp,
            { all: B },
            true,
            fp,
            "skylight",
          );
        else
          box(
            x0,
            y + h,
            u - 0.07,
            x1,
            y + h + 0.12,
            u + 0.07,
            fp,
            { all: B },
            true,
            fp,
            "skylight",
          );
      }
      const Sw = lx ? z1 - z0 : x1 - x0;
      if (Sw > 7) {
        const m = (lx ? z0 + z1 : x0 + x1) / 2;
        if (lx)
          box(
            x0,
            y + h,
            m - 0.08,
            x1,
            y + h + 0.14,
            m + 0.08,
            fp,
            { all: B },
            true,
            fp,
            "skylight",
          );
        else
          box(
            m - 0.08,
            y + h,
            z0,
            m + 0.08,
            y + h + 0.14,
            z1,
            fp,
            { all: B },
            true,
            fp,
            "skylight",
          );
      }
      const q = 0.24,
        yl = y + h + 0.22;
      box(x0, y + h, z0, x1, yl, z0 + q, fp, { all: B }, true, fp, "skylight");
      box(x0, y + h, z1 - q, x1, yl, z1, fp, { all: B }, true, fp, "skylight");
      box(
        x0,
        y + h,
        z0 + q,
        x0 + q,
        yl,
        z1 - q,
        fp,
        { all: B },
        true,
        fp,
        "skylight",
      );
      box(
        x1 - q,
        y + h,
        z0 + q,
        x1,
        yl,
        z1 - q,
        fp,
        { all: B },
        true,
        fp,
        "skylight",
      );
    };
    // gabled ridge skylight: curb + two glazed slopes (exact ramp collision) + steel gable ends and ridge cap
    const gable = (x0, z0, x1, z1, y, rise, alongX) => {
      const yc = y + 0.5,
        yr = yc + rise;
      box(x0, y, z0, x1, yc, z1, curbP, { all: B }, false, null, "equipment");
      if (alongX) {
        const zm = (z0 + z1) / 2;
        glazeP.push(
          [
            [x0, yc, z0],
            [x1, yc, z0],
            [x1, yr, zm],
            [x0, yr, zm],
          ],
          [
            [x0, yr, zm],
            [x1, yr, zm],
            [x1, yc, z1],
            [x0, yc, z1],
          ],
        );
        S?.ramp(x0, yc - 0.02, z0, x1, zm, 2, yc, yr, "skylight");
        S?.ramp(x0, yc - 0.02, zm, x1, z1, 2, yr, yc, "skylight");
        for (const x of [x0, x1]) {
          const v = metB.v;
          metB.vert(x, yc, z0, x === x0 ? -1 : 1, 0, 0);
          metB.vert(x, yc, z1, x === x0 ? -1 : 1, 0, 0);
          metB.vert(x, yr, zm, x === x0 ? -1 : 1, 0, 0);
          metB.tri(v, v + 1, v + 2);
          metB.tri(v, v + 2, v + 1);
        }
        metB.box(x0, yr - 0.04, zm - 0.12, x1, yr + 0.1, zm + 0.12);
        S?.box(x0, yr - 0.04, zm - 0.12, x1, yr + 0.1, zm + 0.12, "skylight");
      } else {
        const xm = (x0 + x1) / 2;
        glazeP.push(
          [
            [x0, yc, z0],
            [x0, yc, z1],
            [xm, yr, z1],
            [xm, yr, z0],
          ],
          [
            [xm, yr, z0],
            [xm, yr, z1],
            [x1, yc, z1],
            [x1, yc, z0],
          ],
        );
        S?.ramp(x0, yc - 0.02, z0, xm, z1, 0, yc, yr, "skylight");
        S?.ramp(xm, yc - 0.02, z0, x1, z1, 0, yr, yc, "skylight");
        for (const z of [z0, z1]) {
          const v = metB.v;
          metB.vert(x0, yc, z, 0, 0, z === z0 ? -1 : 1);
          metB.vert(x1, yc, z, 0, 0, z === z0 ? -1 : 1);
          metB.vert(xm, yr, z, 0, 0, z === z0 ? -1 : 1);
          metB.tri(v, v + 1, v + 2);
          metB.tri(v, v + 2, v + 1);
        }
        metB.box(xm - 0.12, yr - 0.04, z0, xm + 0.12, yr + 0.1, z1);
        S?.box(xm - 0.12, yr - 0.04, z0, xm + 0.12, yr + 0.1, z1, "skylight");
      }
    };
    // glass pyramid (Louvre-like court roof): 4 glazed faces, steel hip ribs; collision = a 4 cm height field
    const pyramid = (cx, cz, h2, y, ht) => {
      const yc = y + 0.7;
      box(
        cx - h2 - 0.4,
        y,
        cz - h2 - 0.4,
        cx + h2 + 0.4,
        yc,
        cz + h2 + 0.4,
        { ...lime, tint: [0.7, 0.68, 0.64] },
        { all: B },
        true,
        { ...lime, tint: [0.66, 0.64, 0.6] },
        "equipment",
      );
      const A = [cx, yc + ht, cz],
        c = [
          [cx - h2, yc, cz - h2],
          [cx + h2, yc, cz - h2],
          [cx + h2, yc, cz + h2],
          [cx - h2, yc, cz + h2],
        ];
      for (let i = 0; i < 4; i++) glazeP.push([c[i], c[(i + 1) % 4], A]);
      for (const q of c) metB.tube(q, A, 0.02, 4); // thin hip ribs (within the 2 cm collision tolerance)
      if (S) {
        const cell = 0.04,
          n = Math.ceil((2 * h2) / cell),
          hArr = new Float32Array(n * n),
          lo = new Float32Array(n * n);
        for (let j = 0; j < n; j++)
          for (let i = 0; i < n; i++) {
            const dx = Math.abs((i + 0.5) * cell - h2),
              dz = Math.abs((j + 0.5) * cell - h2);
            hArr[j * n + i] = Math.max(0, ht * (1 - Math.max(dx, dz) / h2));
          }
        const fid = S.addField({
          nx: n,
          nz: n,
          cell,
          h: hArr,
          lo,
          hMax: ht,
          loMin: 0,
        });
        S.hfield(cx - h2, yc, cz - h2, fid, "skylight");
      }
    };
    // north gallery: a row of three gabled ridge skylights of different lengths
    gable(156, -1350, 190, -1345, HN, 1.5, true);
    gable(158, -1340, 186, -1335, HN, 1.5, true);
    gable(156, -1330, 176, -1325, HN, 1.5, true);
    // central court: (park r7) critic r6: 'a crude pyramid'. A big raised laylight lantern instead (ref 10's roofs carry
    // large flat glazed boxes on dark curbs), with a smaller lantern beside it
    void pyramid;
    lantern(161, -1298, 185, -1276, HM, 2.2);
    lantern(188, -1296, 194, -1280, HM, 1.0);
    // south gallery: one big flat laylight + a small one
    lantern(155, -1254, 183, -1231, HS, 1.2);
    lantern(187, -1249, 193, -1238, HS, 0.9);
    // front wings: north = flat lantern + a gabled lantern, south = one long gabled lantern
    lantern(202, -1354, 216, -1335, HW, 1.2);
    gable(203, -1326, 215, -1305, HW, 1.8, false);
    gable(204, -1266, 214, -1216, HW, 2.0, false);
    // central pavilion: a small raised lantern
    lantern(205, -1292, 217, -1280, HP, 1.5);
    {
      const rr = mulberry32(606);
      // (park r4) critic r3: 'identical black vent boxes' -> galvanised / painted units in several tones and heights
      const hv = {
        style: STYLE.BLANK,
        layer: LAYER.METAL,
        tint: [1.9, 1.92, 1.95],
        seed: 19,
      };
      const hvD = { ...hv, tint: [1.1, 1.12, 1.12] };
      const HVT = [
        [1.9, 1.92, 1.95],
        [2.2, 2.1, 1.95],
        [1.5, 1.52, 1.5],
        [2.0, 1.9, 1.7],
        [1.2, 1.24, 1.28],
        [0.9, 0.86, 0.8],
      ]; // (park r9) darker, weathered (critic r8: 'identical bright HVAC boxes')
      const unit = (x, z, w, d, y) => {
        const h = 1.1 + rr() * 1.3,
          t = HVT[Math.floor(rr() * HVT.length)];
        box(
          x,
          y,
          z,
          x + w,
          y + h,
          z + d,
          { ...hv, tint: t },
          { all: B },
          true,
          { ...hv, tint: t.map((c) => c * 0.9) },
          "equipment",
        );
        const nf = Math.max(1, Math.floor(Math.max(w, d) / 2.2));
        for (let i = 0; i < nf; i++) {
          const t = (i + 0.5) / nf,
            cx = w > d ? x + w * t : x + w / 2,
            cz = w > d ? z + d / 2 : z + d * t,
            r = Math.min(w, d) * 0.3;
          F.cyl(cx, cz, r, y + h, y + h + 0.35, 10, hvD, STYLE.BLANK, true);
          S?.cyl(
            cx,
            cz,
            y + h,
            y + h + 0.35,
            (r * (1 + Math.cos(Math.PI / 10))) / 2,
            (r * (1 + Math.cos(Math.PI / 10))) / 2,
            "equipment",
          );
        }
      };
      // north gallery (HN): units between / beside the ridges, a bulkhead, duct runs
      unit(151.2, -1353, 3.4, 6.5, HN);
      unit(177.5, -1323, 7, 3, HN);
      unit(151.2, -1328, 3.2, 5, HN);
      unit(191.5, -1352, 3.6, 5.5, HN);
      box(
        189,
        HN,
        -1321,
        195,
        HN + 3.4,
        -1312,
        dark,
        { all: B },
        true,
        roof,
        "equipment",
      ); // stair / elevator bulkhead
      box(
        152.2,
        HN,
        -1321,
        188,
        HN + 0.8,
        -1319.8,
        hvD,
        { all: B },
        true,
        hvD,
        "equipment",
      ); // duct run
      // central court (HM): plant rooms at the corners around the pyramid
      box(
        151,
        HM,
        -1308,
        159,
        HM + 2.6,
        -1300,
        dark,
        { all: B },
        true,
        roof,
        "equipment",
      );
      unit(186, -1307, 7.5, 3.2, HM);
      unit(152, -1272, 3.4, 7, HM);
      unit(187.5, -1274, 3.6, 8, HM);
      box(
        160,
        HM,
        -1266.5,
        185,
        HM + 0.7,
        -1265.3,
        hvD,
        { all: B },
        true,
        hvD,
        "equipment",
      );
      // south gallery (HS)
      unit(151.5, -1228, 3.4, 5, HS);
      unit(160, -1226, 6.5, 2.6, HS);
      unit(172, -1226, 5, 2.6, HS);
      unit(187, -1232, 3.6, 6, HS);
      // front wings (HW)
      unit(197, -1360, 3.2, 4.5, HW);
      unit(217.6, -1350, 3.2, 5.5, HW);
      unit(197, -1318, 3.4, 5, HW);
      unit(197, -1262, 3.2, 4.2, HW);
      unit(217.6, -1244, 3.2, 6, HW);
      unit(197, -1228, 3.2, 5.5, HW);
      // parapet copings on the museum's roof edges
      const cop = { ...lime, tint: [0.82, 0.8, 0.76] };
      const par = (x0, z0, x1, z1, y) =>
        box(x0, y, z0, x1, y + 0.75, z1, cop, { all: B }, true, cop, "parapet");
      par(196, -1362, 196.5, -1298, HW);
      par(196, -1274, 196.5, -1208, HW);
      par(196.5, -1362, 221.4, -1361.5, HW);
      par(196.5, -1208.5, 221.4, -1208, HW);
      par(150, -1356, 150.5, -1310, HN);
      par(150, -1310, 150.5, -1262, HM);
      par(150, -1262, 150.5, -1214, HS);
      par(150.5, -1356, 196, -1355.5, HN);
      par(150.5, -1214.5, 196, -1214, HS);
      par(150.5, -1310.5, 196, -1310, HM);
      par(150.5, -1262, 196, -1261.5, HM);
      // roofing variety: gravel-ballast fields, newer membrane sheets, tar patches and dark water stains (8 mm proud)
      const pat = (x0, z0, x1, z1, y, L, t) =>
        F.horiz(x0, z0, x1, z1, y + 0.008, {
          style: STYLE.BLANK,
          layer: L,
          tint: t,
          seed: 60 + Math.floor(x0 + z0),
        });
      pat(151, -1353, 155, -1331, HN, LAYER.ROOF_MEMBRANE, [0.15, 0.15, 0.16]);
      pat(177, -1333, 195, -1322, HN, LAYER.ROOF_MEMBRANE, [0.34, 0.34, 0.33]);
      pat(160, -1308, 186, -1298, HM, LAYER.ROOF_GRAVEL, [0.3, 0.29, 0.27]);
      pat(151, -1296, 162, -1276, HM, LAYER.ROOF_MEMBRANE, [0.27, 0.27, 0.26]);
      pat(184, -1298, 195, -1276, HM, LAYER.ROOF_GRAVEL, [0.22, 0.215, 0.2]);
      pat(151, -1260, 196, -1256, HS, LAYER.ROOF_MEMBRANE, [0.22, 0.22, 0.22]);
      pat(185, -1236, 195.5, -1216, HS, LAYER.ROOF_GRAVEL, [0.28, 0.27, 0.25]);
      pat(
        196.6,
        -1296,
        201.5,
        -1276,
        HP,
        LAYER.ROOF_MEMBRANE,
        [0.17, 0.17, 0.18],
      );
      pat(
        216.5,
        -1300,
        221,
        -1286,
        HW,
        LAYER.ROOF_MEMBRANE,
        [0.28, 0.27, 0.26],
      );
      pat(197, -1332, 201.5, -1320, HW, LAYER.ROOF_GRAVEL, [0.3, 0.29, 0.27]);
      pat(
        215.5,
        -1272,
        221,
        -1250,
        HW,
        LAYER.ROOF_MEMBRANE,
        [0.15, 0.15, 0.155],
      );
      // (park r4) membrane seams (lapped sheets every ~2 m, 12 cm dark lines, 4 mm proud), roof drains, vent stacks
      const seam = (x0, z0, x1, z1, y, alongX) => {
        const st = {
          style: STYLE.BLANK,
          layer: LAYER.ROOF_MEMBRANE,
          tint: [0.1, 0.1, 0.1],
          seed: 90,
        };
        if (alongX)
          for (let z = z0 + 1.1; z < z1 - 0.5; z += 1.9 + rr() * 0.3)
            F.horiz(x0, z, x1, z + 0.12, y + 0.012, st);
        else
          for (let x = x0 + 1.1; x < x1 - 0.5; x += 1.9 + rr() * 0.3)
            F.horiz(x, z0, x + 0.12, z1, y + 0.012, st);
      };
      seam(151, -1355, 196, -1311, HN, false);
      seam(151, -1261, 196, -1215, HS, false);
      seam(197, -1361, 221, -1209, HW, true);
      const pipe = {
        style: STYLE.BLANK,
        layer: LAYER.METAL,
        tint: [1.6, 1.6, 1.6],
        seed: 91,
      };
      for (const [x0, z0, x1, z1, y] of [
        [151, -1355, 196, -1311, HN],
        [151, -1309, 196, -1262, HM],
        [151, -1261, 196, -1215, HS],
        [197, -1361, 221, -1209, HW],
      ]) {
        for (let i = 0; i < 10; i++) {
          const x = x0 + 1 + rr() * (x1 - x0 - 2),
            z = z0 + 1 + rr() * (z1 - z0 - 2);
          if (rr() < 0.5)
            F.horiz(x - 0.3, z - 0.3, x + 0.3, z + 0.3, y + 0.014, {
              style: STYLE.BLANK,
              layer: LAYER.ROOF_MEMBRANE,
              tint: [0.05, 0.05, 0.05],
              seed: 92,
            }); // drain + stain
          else {
            const r = 0.1 + rr() * 0.12,
              h = 0.6 + rr() * 0.9;
            F.cyl(x, z, r, y, y + h, 8, pipe, STYLE.BLANK, true);
            S?.cyl(x, z, y, y + h, r * 0.95, r * 0.95, "equipment");
          }
        }
        // (park r5) critic r4: 'flat brown membrane, clean'. Ponding stains (irregular clusters of overlapping dark
        // blotches around low spots, 2-10 mm proud), pale patched sheets, and low pipe runs on sleepers with hatches
        for (let i = 0; i < 7; i++) {
          const cx = x0 + 3 + rr() * (x1 - x0 - 6),
            cz = z0 + 3 + rr() * (z1 - z0 - 6),
            R = 1.2 + rr() * 3.2,
            v = 0.06 + rr() * 0.07;
          for (let k = 0; k < 6; k++) {
            const ox = (rr() - 0.5) * R * 1.4,
              oz = (rr() - 0.5) * R * 1.4,
              hx = R * (0.25 + rr() * 0.45),
              hz = R * (0.25 + rr() * 0.45);
            F.horiz(
              Math.max(x0, cx + ox - hx),
              Math.max(z0, cz + oz - hz),
              Math.min(x1, cx + ox + hx),
              Math.min(z1, cz + oz + hz),
              y + 0.016 + k * 0.0015,
              {
                style: STYLE.BLANK,
                layer: LAYER.ROOF_MEMBRANE,
                tint: [
                  v * (1 + k * 0.12),
                  v * (1 + k * 0.12),
                  v * (1.02 + k * 0.12),
                ],
                seed: 93 + k,
              },
            );
          }
        }
        for (let i = 0; i < 4; i++) {
          // newer patch sheets (lighter grey)
          const px = x0 + 2 + rr() * (x1 - x0 - 8),
            pz = z0 + 2 + rr() * (z1 - z0 - 8),
            t = 0.38 + rr() * 0.12;
          F.horiz(px, pz, px + 2 + rr() * 4, pz + 1.5 + rr() * 3, y + 0.011, {
            style: STYLE.BLANK,
            layer: LAYER.ROOF_MEMBRANE,
            tint: [t, t, t * 0.97],
            seed: 97,
          });
        }
        for (let i = 0; i < 2; i++) {
          // pipe run on sleepers (conduit / gas line), 0.35 m off the deck
          // hugging a parapet (0.75 m in), clear of the skylights and the plant, which all sit >= 1.2 m inside
          const alongX = i === 0,
            L = 8 + rr() * 14;
          const sx = alongX
            ? x0 + 2 + rr() * Math.max(1, x1 - x0 - 4 - L)
            : rr() < 0.5
              ? x0 + 0.75
              : x1 - 0.75;
          const sz = alongX
            ? rr() < 0.5
              ? z0 + 0.75
              : z1 - 0.75
            : z0 + 2 + rr() * Math.max(1, z1 - z0 - 4 - L);
          const ex = alongX ? Math.min(x1 - 1, sx + L) : sx,
            ez = alongX ? sz : Math.min(z1 - 1, sz + L),
            r = 0.09;
          metB.tube([sx, y + 0.35, sz], [ex, y + 0.35, ez], r, 8);
          S?.box(
            Math.min(sx, ex) - r,
            y + 0.26,
            Math.min(sz, ez) - r,
            Math.max(sx, ex) + r,
            y + 0.44,
            Math.max(sz, ez) + r,
            "equipment",
          );
          const n = Math.max(2, Math.floor(L / 2.5));
          for (let k = 0; k <= n; k++) {
            const f = k / n,
              qx = sx + (ex - sx) * f,
              qz = sz + (ez - sz) * f;
            box(
              qx - 0.18,
              y,
              qz - 0.18,
              qx + 0.18,
              y + 0.26,
              qz + 0.18,
              hvD,
              { all: B },
              true,
              hvD,
              "equipment",
            );
          }
        }
      }
    }
    const mb = metB.build();
    if (mb) {
      const m = new THREE.Mesh(
        mb,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.5,
          metalness: 0.5,
        }),
      );
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = "park-met-steel";
      scene.add(m);
    }
    if (zips) {
      zips.edge(223.2, -1362, 223.2, -1208, HW + 1.2, 1, 0);
      zips.edge(196, -1362, 222, -1362, HW, 0, -1);
      zips.edge(196, -1208, 222, -1208, HW, 0, 1);
      zips.edge(150, -1356, 150, -1310, HN, -1, 0);
      zips.edge(150, -1310, 150, -1262, HM, -1, 0);
      zips.edge(150, -1262, 150, -1214, HS, -1, 0);
    }
    out.met = PARK_SITES.met;
  }

  // ------------------------------------------------------------------ schist outcrops
  if (meadowDist) {
    const rnd = mulberry32(4242);
    const P = G.PARK;
    const segs = [];
    for (const p of parkPaths)
      for (let i = 1; i < p.pts.length; i++)
        segs.push([p.pts[i - 1], p.pts[i], p.w / 2 + 2]);
    const nearPath = (x, z, R) =>
      segs.some(([a, b, w0]) => {
        const w = w0 + R;
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
    const S0 = PARK_SITES.met;
    const placed = [];
    let n = 0;
    // (park r6) critic r5: 'no schist rock outcrops, no clearings'. More (70 -> 125) and bigger whalebacks, also deeper
    // in the woods (trees.js keeps trunks off them, so they read as pale bare clearings in the canopy)
    for (let t = 0; t < 12000 && n < 125; t++) {
      const x = P.x0 + 15 + rnd() * (P.x1 - P.x0 - 30),
        z = P.z0 + 15 + rnd() * (P.z1 - P.z0 - 30);
      const m = meadowDist(x, z);
      if (m < 0.95 || m > 2.4) continue; // meadow rims and the woods behind them
      const R = 6 + rnd() * 9;
      if (
        x > S0.x0 - R - 4 &&
        x < S0.x1 + R &&
        z > S0.z0 - R - 4 &&
        z < S0.z1 + R + 4
      )
        continue;
      if (placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < 32)) continue;
      let wet = false;
      for (let a = 0; a < 8 && !wet; a++)
        wet = !!parkWaterAt(
          x + Math.cos(a) * (R + 3),
          z + Math.sin(a) * (R + 3),
        );
      if (wet || parkWaterAt(x, z) || nearPath(x, z, R)) continue;
      placed.push([x, z]);
      PARK_ROCKS.push([x, z, R]);
      n++;
      // a tilted, stepped shelf: slabs shrink and climb toward one side (glacier-scoured whaleback)
      const ang = rnd() * Math.PI * 2,
        ux = Math.cos(ang),
        uz = Math.sin(ang);
      // (park r2) pale, lichen-grey weathered schist (the dark granite layer read as black slabs from the air), built as
      // many thin ledges (contour-like terraces) so the outcrop reads as a low glacier-polished whaleback, not a box
      // (park r9) critic r8: 'a flat beige quad on the lawn, looks unfinished'. Darker grey-brown schist with lichen /
      // weathering per slab, and every ledge is 3 overlapping offset slabs of different proportions, so the outline is
      // ragged rock, not a rectangular pad
      const tone = 0.44 + rnd() * 0.1;
      const k = 5 + Math.floor(rnd() * 4);
      let y = GRASS_Y - 0.25;
      for (let i = 0; i < k; i++) {
        const f = i / k,
          cx = x + ux * R * f * 0.45 + (rnd() - 0.5) * 1.5,
          cz = z + uz * R * f * 0.45 + (rnd() - 0.5) * 1.5;
        const hx = R * (0.72 - f * 0.55) * (0.75 + rnd() * 0.4),
          hz = R * (0.52 - f * 0.38) * (0.75 + rnd() * 0.4);
        const hh = 0.22 + rnd() * 0.26 + (i === 0 ? 0.15 : 0);
        const top = y + hh + 0.013 * i;
        for (let j = 0; j < 3; j++) {
          const sx = (rnd() - 0.5) * hx * 0.7,
            sz = (rnd() - 0.5) * hz * 0.7,
            ex = hx * (0.45 + rnd() * 0.4),
            ez = hz * (0.45 + rnd() * 0.4);
          const t = tone * (0.8 + rnd() * 0.32),
            wc =
              rnd() < 0.3
                ? [0.96, 1.0, 0.9]
                : rnd() < 0.5
                  ? [1.04, 0.98, 0.92]
                  : [0.97, 0.97, 0.97];
          const rp = {
            style: STYLE.BLANK,
            layer: LAYER.LIME,
            tint: [t * 0.9 * wc[0], t * 0.88 * wc[1], t * 0.84 * wc[2]],
            seed: 30 + n,
          };
          box(
            cx + sx - ex,
            i === 0 ? GRASS_Y - 0.3 : y - 0.1,
            cz + sz - ez,
            cx + sx + ex,
            top - rnd() * 0.12 + 0.004 * j,
            cz + sz + ez,
            rp,
            {},
            true,
            null,
            "park",
          );
        }
        const rp = {
          style: STYLE.BLANK,
          layer: LAYER.LIME,
          tint: [tone * 0.8, tone * 0.78, tone * 0.74],
          seed: 30 + n,
        };
        y = top - 0.12;
        // a few loose boulders at the foot
        if (rnd() < 0.5) {
          const bx = cx + (rnd() - 0.5) * hx * 3,
            bz = cz + (rnd() - 0.5) * hz * 3,
            bs = 0.5 + rnd() * 0.8;
          if (!parkWaterAt(bx, bz))
            box(
              bx - bs,
              GRASS_Y - 0.2,
              bz - bs * 0.8,
              bx + bs,
              GRASS_Y + bs * 0.9 + 0.017 * i,
              bz + bs * 0.8,
              rp,
              {},
              true,
              null,
              "park",
            );
        }
      }
    }
    out.rocks = placed;
  }

  if (glaze.length || glazeP.length) {
    const P = [],
      N = [],
      UV = [],
      I = [],
      V = [];
    // (park r8) critic r7: 'tiled skylight panels copied across the roof'. Every skylight draws its own glass family
    // (pale frosted, dark reflective, milky / dirty) and mullion pitch through a per-skylight variant attribute
    let gk = 0;
    const gv = () => {
      const h = Math.sin(++gk * 91.345 + 3.1) * 43758.5453;
      return h - Math.floor(h);
    };
    // sloped faces: uv = metres along the first edge / up the slope (mullion grid follows the face)
    for (const poly of glazeP) {
      const b = P.length / 3,
        [a0, a1] = poly,
        vv = poly.v ?? gv();
      for (let k = 0; k < poly.length; k++) V.push(vv);
      const e = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]],
        eL = Math.hypot(...e),
        eu = e.map((v) => v / eL);
      const c2 = poly[2],
        f = [c2[0] - a0[0], c2[1] - a0[1], c2[2] - a0[2]];
      let n = [
        eu[1] * f[2] - eu[2] * f[1],
        eu[2] * f[0] - eu[0] * f[2],
        eu[0] * f[1] - eu[1] * f[0],
      ];
      const nl = Math.hypot(...n);
      n = n.map((v) => v / nl);
      let flip = n[1] < 0;
      if (flip) n = n.map((v) => -v);
      const w = [
        n[1] * eu[2] - n[2] * eu[1],
        n[2] * eu[0] - n[0] * eu[2],
        n[0] * eu[1] - n[1] * eu[0],
      ];
      for (const q of poly) {
        const d = [q[0] - a0[0], q[1] - a0[1], q[2] - a0[2]];
        P.push(...q);
        N.push(...n);
        UV.push(
          d[0] * eu[0] + d[1] * eu[1] + d[2] * eu[2],
          Math.abs(d[0] * w[0] + d[1] * w[1] + d[2] * w[2]),
        );
      }
      const tri = (i0, i1, i2) =>
        flip ? I.push(b + i0, b + i2, b + i1) : I.push(b + i0, b + i1, b + i2);
      tri(0, 1, 2);
      if (poly.length === 4) tri(0, 2, 3);
    }
    for (const [x0, z0, x1, z1, y] of glaze) {
      const b = P.length / 3,
        vv = gv();
      V.push(vv, vv, vv, vv);
      P.push(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0);
      N.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      const lx = x1 - x0 > z1 - z0;
      for (const [x, z] of [
        [x0, z1],
        [x1, z1],
        [x1, z0],
        [x0, z0],
      ])
        UV.push(lx ? x : z, lx ? z : x);
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    gg.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    gg.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
    gg.setAttribute("aGV", new THREE.Float32BufferAttribute(V, 1));
    gg.setIndex(I);
    const gm = new THREE.Mesh(gg, glassRoofMaterial());
    gm.receiveShadow = true;
    gm.name = "park-skylights";
    scene.add(gm);
  }
  if (spray.length) {
    // (park r7) fountain jets: translucent white water columns + foam discs (decor, no collision), 1 draw
    const parts = [];
    for (const [x, y, z] of spray) {
      parts.push(
        new THREE.CylinderGeometry(0.06, 0.55, 2.8, 12, 1, true).translate(
          x,
          y + 1.4,
          z,
        ),
      );
      parts.push(
        new THREE.CircleGeometry(2.2, 24)
          .rotateX(-Math.PI / 2)
          .translate(x, y - 0.6 + 0.01, z),
      );
    }
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe6ecf0,
      roughness: 0.35,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(
      mergeGeometries(parts.map((g) => g.toNonIndexed())),
      mat,
    );
    m.name = "park-met-fountains";
    scene.add(m);
  }
  buildBallfields(scene, S, box);
  buildReservoirRiprap(box); // (park r7) rock riprap along the reservoir's waterline
  buildPathFurniture(scene, S, parkPaths); // (park r7) lamps + benches along the walks, darker drives
  buildReservoirEdge(scene, S);
  buildWaterShallows(scene); // (park r5) dark wet band / bank reflection on every pond
  buildParkWall(scene, F, S);
  buildShoreRocks(box); // (park r4)
  buildReeds(scene); // (park r6) reed beds / tall grass along the pond banks
  buildParkEdge(scene, S); // (park r4) lamps + hex-paver band along the wall
  if (meadowDist) out.people = buildParkPeople(scene, parkPaths); // (park r4) people on the lawns and walks
  const g = F.build();
  if (g) {
    const mesh = new THREE.Mesh(g, facadeMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = "park-setpieces";
    scene.add(mesh);
    out.mesh = mesh;
  }
  return out;
}

// (park r2) skylight glazing: reflective panes in a steel mullion grid (1.6 m x 3.2 m), a few frosted / dirty panes,
// faint interior glow; uv = metres along (long axis, short axis)
function glassRoofMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8fa2b0,
    roughness: 0.1,
    metalness: 0.2,
  }); // (park r9) 0.35 -> 0.2
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vGU; attribute float aGV; varying float vGV;",
      )
      .replace(
        "#include <uv_vertex>",
        "#include <uv_vertex>\nvGU = uv; vGV = aGV;",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec2 vGU; varying float vGV; float gH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        "#include <map_fragment>",
        `
        // (park r6) critic r5: 'solar-panel grid textures'. Pale frosted panes (ref 10) in a finer, thinner mullion grid
        // (park r8) per-skylight family + pitch (vGV): no two neighbouring skylights share a look
        vec2 pitch = vGV < 0.33 ? vec2(1.6, 1.1) : (vGV < 0.66 ? vec2(2.4, 1.5) : vec2(1.2, 2.2));
        vec2 gc = vGU / pitch, gf = fract(gc), gi = floor(gc);
        vec2 fw = fwidth(gc) * 1.2;
        vec2 bar = vec2(0.03, 0.045);
        float fr = 1.0 - (smoothstep(bar.x, bar.x + fw.x, gf.x) * smoothstep(bar.x, bar.x + fw.x, 1.0 - gf.x)
                        * smoothstep(bar.y, bar.y + fw.y, gf.y) * smoothstep(bar.y, bar.y + fw.y, 1.0 - gf.y));
        float h = gH(gi), h2 = gH(gi + 17.3);
        vec3 pane = mix(vec3(0.25, 0.29, 0.33), vec3(0.32, 0.35, 0.38), step(0.8, h)) /* (park r9) critic r8: 'bright blue-white skylights look pasted on' */ * (0.92 + 0.1 * h2); // (park r8) less pane-to-pane checker
        float fam = fract(vGV * 7.13);
        if (fam < 0.34) pane = mix(vec3(0.16, 0.2, 0.25), vec3(0.24, 0.28, 0.32), step(0.85, h)) * (0.9 + 0.2 * h2);   // dark reflective
        else if (fam < 0.58) pane = mix(vec3(0.36, 0.38, 0.37), vec3(0.44, 0.45, 0.42), step(0.75, h)) * (0.9 + 0.12 * h2); // milky, weathered
        pane *= 0.82 + 0.3 * smoothstep(0.0, 1.0, fract(vGU.x * 0.021 + vGV * 3.0)) ; // broad grime / reflection gradient across the skylight
        pane *= 1.0 - 0.18 * smoothstep(0.3, 1.0, fract(vGU.y * 0.07 + h * 0.3));   // dirt washes down the panes
        { // (park r10) critic r9: 'add dirt'. Blotchy soot / bird-lime / leaf-litter grime per pane cluster, darker in the
          // bottom corners where rain water pools against the bars
          float gd = gH(floor(vGU / 5.0) + vGV * 31.0), gd2 = gH(gi * 0.5 + 3.7);
          pane *= 1.0 - 0.28 * smoothstep(0.55, 0.95, gd * 0.6 + gd2 * 0.5);
          pane *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.22, gf.y)) * (0.5 + 0.5 * h2);
          pane = mix(pane, vec3(0.2, 0.18, 0.14), 0.18 * step(0.9, gd2));
        }
        diffuseColor.rgb = mix(pane, vec3(0.3, 0.31, 0.32), fr * 0.6);
        float gRough = mix(mix(0.36, 0.5, step(0.8, h)), 0.6, fr);
        if (fam < 0.34) gRough = mix(0.5, 0.6, fr); else if (fam < 0.58) gRough = mix(0.72, 0.8, fr);   // (park r8) dark = matte wired glass, milky = frosted
      `,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = gRough;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.018, 0.017, 0.015) * (1.0 - fr) * step(h2, 0.7);",
      );
  };
  mat.customProgramCacheKey = () => "park-glassroof-v4";
  return mat;
}

// (park r2) the Reservoir's built edge (critic: 'flat blue cutout with a hard edge'): a granite coping band on the
// lawn side of the bank, and the iron perimeter fence between the coping and the running track (posts with exact
// cylinder collision; rails / mesh are thin and decorative). One merged mesh per material.
function buildReservoirEdge(scene, S) {
  const w = PARK_WATER.find((q) => q.name === "reservoir");
  if (!w) return;
  const n = w.pts.length;
  // outward unit normals per outline vertex (the outline is star-shaped about its centre)
  const nrm = w.pts.map(([x, z], i) => {
    const [ax, az] = w.pts[(i + n - 1) % n],
      [bx, bz] = w.pts[(i + 1) % n];
    let tx = bx - ax,
      tz = bz - az;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    let nx = tz,
      nz = -tx;
    if (nx * (x - w.cx) + nz * (z - w.cz) < 0) {
      nx = -nx;
      nz = -nz;
    }
    return [nx, nz];
  });
  const off = (i, d) => [
    w.pts[i][0] + nrm[i][0] * d,
    w.pts[i][1] + nrm[i][1] * d,
  ];
  // coping: 0 -> 1.1 m out, 8 mm above the lawn (collision = lawn height, within tolerance)
  {
    const P = [],
      N = [],
      UV = [],
      I = [],
      y = GRASS_Y + 0.008;
    let acc = 0;
    for (let i = 0; i <= n; i++) {
      const k = i % n,
        a = off(k, 0),
        b = off(k, 1.1);
      if (i)
        acc += Math.hypot(
          w.pts[k][0] - w.pts[i - 1][0],
          w.pts[k][1] - w.pts[i - 1][1],
        );
      P.push(a[0], y, a[1], b[0], y, b[1]);
      N.push(0, 1, 0, 0, 1, 0);
      UV.push(0, acc, 1, acc);
      if (i) {
        const v = i * 2;
        I.push(v - 2, v - 1, v + 1, v - 2, v + 1, v);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
    g.setIndex(I);
    // make every triangle face up
    const ix = g.index.array,
      ps = g.attributes.position.array;
    for (let t = 0; t < ix.length; t += 3) {
      const A = ix[t] * 3,
        B = ix[t + 1] * 3,
        C = ix[t + 2] * 3;
      if (
        (ps[B + 2] - ps[A + 2]) * (ps[C] - ps[A]) -
          (ps[B] - ps[A]) * (ps[C + 2] - ps[A + 2]) <
        0
      ) {
        const q = ix[t + 1];
        ix[t + 1] = ix[t + 2];
        ix[t + 2] = q;
      }
    }
    const m = new THREE.MeshStandardMaterial({
      color: 0x69665f,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
        { float blk = fract(vCopUV.y / 1.8); float j = smoothstep(0.0, 0.04, blk) * smoothstep(1.0, 0.96, blk);
          float h = fract(sin(floor(vCopUV.y / 1.8) * 91.7) * 4375.5);
          diffuseColor.rgb *= (0.55 + 0.45 * j) * (0.85 + 0.25 * h) * mix(0.8, 1.0, smoothstep(0.0, 0.25, vCopUV.x)); }`,
        )
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec2 vCopUV;",
        );
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vCopUV;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvCopUV = uv;");
    };
    m.customProgramCacheKey = () => "park-coping-v1";
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.name = "reservoir-coping";
    scene.add(mesh);
  }
  // fence: 3.6 m out; posts every ~2.6 m, top / mid / bottom rails
  {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(off(i, 3.6));
    const ring = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i],
        b = pts[(i + 1) % n],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (; acc < L; acc += 2.6)
        ring.push([
          a[0] + ((b[0] - a[0]) * acc) / L,
          a[1] + ((b[1] - a[1]) * acc) / L,
        ]);
      acc -= L;
    }
    const P = [],
      I = [];
    const quad = (a, b, y0, y1, t) => {
      // thin double-sided strip between a and b (t: thickness offset)
      const v = P.length / 3;
      P.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y1, a[1]);
      I.push(v, v + 1, v + 2, v, v + 2, v + 3);
      void t;
    };
    const H = 1.9;
    for (let i = 0; i < ring.length; i++) {
      const [x, z] = ring[i],
        r = 0.045;
      // post: a 4-sided prism
      const c = [
        [x - r, z - r],
        [x + r, z - r],
        [x + r, z + r],
        [x - r, z + r],
      ];
      for (let k = 0; k < 4; k++)
        quad(c[k], c[(k + 1) % 4], GRASS_Y, GRASS_Y + H + 0.08, 0);
      S?.cyl(x, z, GRASS_Y, GRASS_Y + H + 0.08, r, r, "equipment");
      const [bx, bz] = ring[(i + 1) % ring.length];
      for (const [y0, y1] of [
        [GRASS_Y + 0.05, GRASS_Y + 0.11],
        [GRASS_Y + 0.95, GRASS_Y + 1.0],
        [GRASS_Y + H - 0.06, GRASS_Y + H],
      ])
        quad([x, z], [bx, bz], y0, y1, 0);
      // pickets (mesh infill read at distance): 5 thin bars per bay
      for (let k = 1; k < 6; k++) {
        const u = k / 6,
          px = x + (bx - x) * u,
          pz = z + (bz - z) * u;
        quad(
          [px - 0.012, pz],
          [px + 0.012, pz],
          GRASS_Y + 0.08,
          GRASS_Y + H - 0.03,
          0,
        );
        quad(
          [px, pz - 0.012],
          [px, pz + 0.012],
          GRASS_Y + 0.08,
          GRASS_Y + H - 0.03,
          0,
        );
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setIndex(I);
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({
      color: 0x1b1d1c,
      roughness: 0.6,
      metalness: 0.4,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = "reservoir-fence";
    scene.add(mesh);
  }
}

// (park r2) Central-Park-West / Fifth-Avenue perimeter wall (critic: 'the park simply stops at the road'): a 1.0 m
// rough-stone wall with a pale projecting coping, enclosing ground.js' low wall (same runs and entrance gaps, 10 cm
// larger all round), plus World's-Fair benches backed against it along the avenue sidewalks. Exact box collision.
function buildParkWall(scene, F, S) {
  const P = G.PARK,
    t = 0.45,
    wy = G.CURB_H,
    e = 0.1;
  const body = {
    style: STYLE.BLANK,
    layer: LAYER.GRANITE,
    tint: [0.5, 0.48, 0.45],
    seed: 41,
  }; // (park r11) critic r9: 'no stone wall reads at this height': darker rough granite body under the pale coping (was pale limestone = the sidewalk's tone)
  const cap = {
    style: STYLE.BLANK,
    layer: LAYER.LIME,
    tint: [0.84, 0.82, 0.77],
    seed: 42,
  };
  const run = (x0, z0, x1, z1, dy) => {
    const yb = wy + 1.0 + dy,
      yc = yb + 0.12;
    F.box(x0 - e, wy, z0 - e, x1 + e, yb, z1 + e, body, {}, false);
    F.box(
      x0 - e - 0.06,
      yb,
      z0 - e - 0.06,
      x1 + e + 0.06,
      yc,
      z1 + e + 0.06,
      cap,
      {},
      true,
      true,
    );
    S?.box(x0 - e, wy, z0 - e, x1 + e, yb, z1 + e, "park");
    S?.box(
      x0 - e - 0.06,
      yb,
      z0 - e - 0.06,
      x1 + e + 0.06,
      yc,
      z1 + e + 0.06,
      "park",
    );
  };
  const gaps = [-150, -60, 60, 150];
  for (const [za, zb] of [
    [P.z1 - t, P.z1],
    [P.z0, P.z0 + t],
  ]) {
    let x = P.x0;
    for (const gx of [...gaps, P.x1 + 100]) {
      const x1 = Math.min(gx - 3, P.x1);
      if (x1 > x) run(x, za, x1, zb, 0);
      x = gx + 3;
    }
  }
  const sideRuns = [];
  for (const sx of [P.x0, P.x1 - t]) {
    for (let z = P.z1 - t; z > P.z0 + t + 1; z -= 160) {
      const z0 = Math.max(P.z0 + t, z - 150);
      run(sx, z0, sx + t, z, 0.014);
      sideRuns.push([sx, z0, z]);
    }
  }
  // benches on the avenue side of the side walls
  const B = new MB(),
    rnd = mulberry32(911);
  for (const [sx, z0, z1] of sideRuns) {
    const west = sx === P.x0,
      face = west ? sx - e : sx + t + e,
      dir = west ? -1 : 1;
    for (let z = z0 + 6; z + 2 < z1 - 4; z += 6.5 + rnd() * 3) {
      if (rnd() < 0.3) continue;
      const L = 1.9,
        za = z,
        zb = z + L;
      const bx = (u) => face + dir * u; // distance out from the wall face
      const X = (u0, u1) => [
        Math.min(bx(u0), bx(u1)),
        Math.max(bx(u0), bx(u1)),
      ];
      const y0 = wy;
      // cast-iron end frames (solid side panels), slat seat and back (painted dark green)
      B.setColor([0.02, 0.022, 0.02]);
      for (const zz of [za, zb - 0.06]) {
        const [a, b] = X(0.08, 0.66);
        B.box(a, y0, zz, b, y0 + 0.47, zz + 0.06);
        S?.box(a, y0, zz, b, y0 + 0.47, zz + 0.06, "equipment");
        const [c, d] = X(0.05, 0.14);
        B.box(c, y0 + 0.47, zz, d, y0 + 0.92, zz + 0.06);
        S?.box(c, y0 + 0.47, zz, d, y0 + 0.92, zz + 0.06, "equipment");
      }
      B.setColor([0.05, 0.075, 0.045]);
      for (let k = 0; k < 4; k++) {
        const [a, b] = X(0.16 + k * 0.125, 0.26 + k * 0.125);
        B.box(a, y0 + 0.42, za + 0.06, b, y0 + 0.46, zb - 0.06);
      }
      {
        const [a, b] = X(0.14, 0.66);
        S?.box(a, y0 + 0.42, za + 0.06, b, y0 + 0.46, zb - 0.06, "equipment");
      }
      for (let k = 0; k < 3; k++) {
        const [a, b] = X(0.08, 0.12);
        B.box(
          a,
          y0 + 0.55 + k * 0.13,
          za + 0.06,
          b,
          y0 + 0.64 + k * 0.13,
          zb - 0.06,
        );
      }
      {
        const [a, b] = X(0.08, 0.12);
        S?.box(a, y0 + 0.55, za + 0.06, b, y0 + 0.9, zb - 0.06, "equipment");
      }
    }
  }
  const bg = B.build();
  if (bg) {
    const m = new THREE.Mesh(
      bg,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
    );
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = "park-wall-benches";
    scene.add(m);
  }
}

// (park r3) ball-field furniture (critic r2: 'flat decals with perfect white diamonds, no backstops / fences'): a 5 m
// chain-link backstop arc behind each home plate and 1.2 m fences along both foul lines, on dark steel posts. Home plates
// mirror ground.js' infield placement (same formula). Collision: posts + a 25 cm comb of thin rods along every fence
// run (the mesh is see-through; a body can't pass), so render and collision stay within 2 cm.
function buildBallfields(scene, S, box = null) {
  const P = [],
    UV = [],
    I = [],
    posts = new MB();
  posts.setColor([0.05, 0.05, 0.05]);
  const y0 = GRASS_Y;
  const fence = (a, b, h) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.1) return;
    const v = P.length / 3;
    P.push(
      a[0],
      y0,
      a[1],
      b[0],
      y0,
      b[1],
      b[0],
      y0 + h,
      b[1],
      a[0],
      y0 + h,
      a[1],
    );
    UV.push(0, 0, L, 0, L, h, 0, h);
    I.push(v, v + 1, v + 2, v, v + 2, v + 3);
    posts.tube(
      [a[0], y0 + h - 0.02, a[1]],
      [b[0], y0 + h - 0.02, b[1]],
      0.02,
      4,
    ); // top rail
    const n = Math.max(1, Math.round(L / 0.25));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      S?.cyl(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        y0,
        y0 + h,
        0.02,
        0.02,
        "pole",
      );
    }
  };
  const post = (x, z, h) => {
    posts.cyl(x, y0, z, 0.045, 0.045, h + 0.08, 6, true, false);
    S?.cyl(x, z, y0, y0 + h + 0.08, 0.045, 0.045, "pole");
  };
  for (let i = 1; i < 3; i++)
    for (let k = 0; k < 4; k++) {
      if (i === 2 && (k === 1 || k === 2)) continue;
      const m = PARK_MEADOWS[i],
        fk = i * 4 + k;
      const hp = [
        m.x + ((k & 1) * 2 - 1) * m.rx * (0.55 + 0.08 * Math.sin(fk * 2.3)),
        m.z + ((k >> 1) * 2 - 1) * m.rz * (0.5 + 0.08 * Math.cos(fk * 1.7)),
      ];
      let dx = m.x - hp[0],
        dz = m.z - hp[1];
      const dl = Math.hypot(dx, dz);
      dx /= dl;
      dz /= dl;
      const ra = 0.35 * Math.sin(fk * 3.1 + 0.4),
        c = Math.cos(ra),
        s = Math.sin(ra);
      [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
      const ang0 = Math.atan2(dz, dx) + Math.PI;
      // backstop: 8 panels on an arc of radius 7 m behind the plate, 5 m high
      const arc = [];
      for (let j = 0; j <= 8; j++) {
        const a = ang0 + (j / 8 - 0.5) * 2.3;
        arc.push([hp[0] + Math.cos(a) * 7, hp[1] + Math.sin(a) * 7]);
      }
      for (let j = 0; j < 8; j++) fence(arc[j], arc[j + 1], 5);
      for (const q of arc) post(q[0], q[1], 5);
      // (park r5) critic r4: 'no bleachers'. A 3-row aluminium bleacher beside the backstop (behind the 1st / 3rd base
      // side), axis-aligned stepped boxes (exact collision)
      if (box) {
        const sg = fk & 1 ? 1 : -1,
          ba = ang0 + sg * 1.55,
          bxc = hp[0] + Math.cos(ba) * 10.5,
          bzc = hp[1] + Math.sin(ba) * 10.5;
        const alongX = Math.abs(Math.cos(ba)) < Math.abs(Math.sin(ba)),
          fx = alongX ? 0 : Math.sign(Math.cos(ba)),
          fz = alongX ? Math.sign(Math.sin(ba)) : 0;
        const al = {
            style: STYLE.BLANK,
            layer: LAYER.METAL,
            tint: [1.55, 1.57, 1.6],
            seed: 62,
          },
          L = 3.6;
        for (let r = 0; r < 3; r++) {
          const o = r * 0.7,
            top = GRASS_Y + 0.42 + r * 0.38; // rows step up away from the field
          const cx = bxc + fx * o,
            cz = bzc + fz * o,
            [hx, hz] = alongX ? [L, 0.36] : [0.36, L];
          box(
            cx - hx,
            GRASS_Y - 0.05,
            cz - hz,
            cx + hx,
            top,
            cz + hz,
            r ? al : { ...al, tint: [1.2, 1.22, 1.25] },
            {},
            true,
            null,
            "park",
          );
        }
      }
      // foul-line fences: parallel to each foul line, 6 m outside it, from the backstop's ends out 20 m
      for (const sg of [-1, 1]) {
        const fa = Math.atan2(dz, dx) + (sg * Math.PI) / 4,
          ux = Math.cos(fa),
          uz = Math.sin(fa),
          ox = -uz * sg,
          oz = ux * sg; // outward (foul side)
        const a = [hp[0] + ux * 2 + ox * 6, hp[1] + uz * 2 + oz * 6],
          b = [hp[0] + ux * 22 + ox * 6, hp[1] + uz * 22 + oz * 6];
        const end = arc[sg < 0 ? 8 : 0];
        fence(end, a, 1.3);
        for (let j = 0; j < 4; j++)
          fence(
            [a[0] + ((b[0] - a[0]) * j) / 4, a[1] + ((b[1] - a[1]) * j) / 4],
            [
              a[0] + ((b[0] - a[0]) * (j + 1)) / 4,
              a[1] + ((b[1] - a[1]) * (j + 1)) / 4,
            ],
            1.3,
          );
        for (let j = 0; j <= 4; j++)
          post(
            a[0] + ((b[0] - a[0]) * j) / 4,
            a[1] + ((b[1] - a[1]) * j) / 4,
            1.3,
          );
        // (park r4) dugout: a low block bench shelter behind the fence (axis-aligned so render = collision exactly)
        if (box) {
          const cx = hp[0] + ux * 10 + ox * 8.2,
            cz = hp[1] + uz * 10 + oz * 8.2,
            alongX = Math.abs(ux) > Math.abs(uz);
          const L = 3.2,
            D = 0.9,
            blk = {
              style: STYLE.BLANK,
              layer: LAYER.CONCRETE,
              tint: [0.8, 0.79, 0.76],
              seed: 60 + fk,
            };
          const roof = {
            style: STYLE.BLANK,
            layer: LAYER.METAL,
            tint: [0.55, 0.62, 0.58],
            seed: 61,
          };
          const [hx, hz] = alongX ? [L, D] : [D, L];
          const bx = alongX ? 0 : (ox > 0 ? 1 : -1) * (D - 0.15),
            bz = alongX ? (oz > 0 ? 1 : -1) * (D - 0.15) : 0; // back wall on the outer side
          box(
            cx + bx - (alongX ? hx : 0.15),
            GRASS_Y - 0.05,
            cz + bz - (alongX ? 0.15 : hz),
            cx + bx + (alongX ? hx : 0.15),
            GRASS_Y + 2.1,
            cz + bz + (alongX ? 0.15 : hz),
            blk,
            {},
            true,
            null,
            "park",
          );
          box(
            cx - hx - 0.2,
            GRASS_Y + 2.1,
            cz - hz - 0.2,
            cx + hx + 0.2,
            GRASS_Y + 2.26,
            cz + hz + 0.2,
            roof,
            {},
            true,
            null,
            "park",
          );
          for (const e of [-1, 1])
            box(
              alongX ? cx + e * hx - 0.12 : cx - hx,
              GRASS_Y - 0.05,
              alongX ? cz - hz : cz + e * hz - 0.12,
              alongX ? cx + e * hx + 0.12 : cx + hx,
              GRASS_Y + 2.1,
              alongX ? cz + hz : cz + e * hz + 0.12,
              blk,
              {},
              true,
              null,
              "park",
            );
          box(
            cx - hx * (alongX ? 0.9 : 0.4),
            GRASS_Y + 0.4,
            cz - hz * (alongX ? 0.4 : 0.9),
            cx + hx * (alongX ? 0.9 : 0.4),
            GRASS_Y + 0.46,
            cz + hz * (alongX ? 0.4 : 0.9),
            { ...blk, tint: [0.42, 0.3, 0.2] },
            {},
            true,
            null,
            "park",
          );
        }
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a8d8e,
    roughness: 0.5,
    metalness: 0.6,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vFU;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvFU = uv;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vFU;")
      .replace(
        "#include <alphatest_fragment>",
        `
        { vec2 q = vec2(vFU.x + vFU.y, vFU.x - vFU.y) / 0.06; vec2 f = abs(fract(q) - 0.5); float w = min(f.x, f.y);
          vec2 fw = fwidth(q); float cov = 1.0 - smoothstep(0.06, 0.06 + max(fw.x, fw.y), w);
          float far = smoothstep(0.15, 0.6, max(fw.x, fw.y));
          diffuseColor.a = mix(cov, 0.42, far);
          float rail = step(abs(vFU.y - 0.03), 0.03) + step(abs(vFU.y - floor(vFU.y / 5.0 + 0.5) * 5.0), 0.04);
          diffuseColor.a = max(diffuseColor.a, min(rail, 1.0)); if (diffuseColor.a < 0.02) discard; }
        #include <alphatest_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => "park-chainlink-v1";
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = "park-ballfield-fences";
  mesh.renderOrder = 3;
  scene.add(mesh);
  const pg = posts.build();
  if (pg) {
    const pm = new THREE.Mesh(
      pg,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.6,
        metalness: 0.4,
      }),
    );
    pm.castShadow = true;
    pm.receiveShadow = true;
    pm.name = "park-ballfield-posts";
    scene.add(pm);
  }
}

// (park r4) rocky banks (critic r3: 'smooth pasted shorelines, no rocks'): clusters of stacked pale schist blocks along
// the Lake, the Pond, Turtle Pond and the Meer -- half in the water, a lichen-grey ledge or two stepping onto the lawn.
// Axis-aligned boxes (exact collision), in the park facade mesh (no extra draw call).
function buildShoreRocks(box) {
  const rnd = mulberry32(5151);
  for (const w of PARK_WATER) {
    if (w.name === "reservoir") continue;
    const n = w.pts.length;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const [ax, az] = w.pts[i],
        [bx, bz] = w.pts[(i + 1) % n];
      acc += Math.hypot(bx - ax, bz - az);
      if (acc < 5 + rnd() * 7) continue; // (park r6) denser (was 7-16 m)
      acc = 0;
      if (rnd() < 0.35 || reedBed(w, ax, az) > 0.62) continue; // plain bank / reed beds between the rock clusters
      let nx = bz - az,
        nz = -(bx - ax);
      const l = Math.hypot(nx, nz) || 1;
      nx /= l;
      nz /= l;
      if (parkWaterAt(ax + nx * 3, az + nz * 3)) {
        nx = -nx;
        nz = -nz;
      } // outward = onto the land
      const tone = 0.4 + rnd() * 0.14,
        rp = {
          style: STYLE.BLANK,
          layer: LAYER.LIME,
          tint: [tone * 0.9, tone * 0.9, tone * 0.86],
          seed: 70 + i,
        }; // (park r6) darker, wet-looking schist
      const k = 2 + Math.floor(rnd() * 4);
      for (let j = 0; j < k; j++) {
        const o = -1.2 + j * 0.9 + rnd() * 0.8,
          t = (rnd() - 0.5) * 3.5;
        const cx = ax + nx * o - nz * t,
          cz = az + nz * o + nx * t,
          hs = 0.5 + rnd() * 0.9,
          hh = 0.25 + rnd() * 0.55 - j * 0.06;
        box(
          cx - hs,
          w.y - 0.4,
          cz - hs * (0.6 + rnd() * 0.4),
          cx + hs,
          GRASS_Y + hh,
          cz + hs * (0.6 + rnd() * 0.4),
          rp,
          {},
          true,
          null,
          "park",
        );
      }
    }
  }
}

// (park r6) reed-bed field along a shoreline (0..1): long beds on the sheltered stretches, gaps for rocks / open bank
function reedBed(w, x, z) {
  return (
    0.5 +
    0.32 * Math.sin(x * 0.045 + z * 0.031 + w.cx) +
    0.22 * Math.sin(x * 0.11 - z * 0.093 + 1.7) +
    0.12 * Math.sin(z * 0.27 + x * 0.05)
  );
}
// (park r6) critic r5: 'pond shorelines are perfect splines with a hard cut, no reeds, no vegetation transition'.
// Reeds / cattails / tall sedge in beds along the Pond, Lake, Turtle Pond and the Meer: clumps of tapered two-sided
// blades from 2 m out in the water to 1.5 m up the bank, straw / olive / rust tones. Decor (no collision), one draw.
function buildReeds(scene) {
  const rnd = mulberry32(6262);
  const P = [],
    N = [],
    C = [];
  const COL = [
    [0.46, 0.42, 0.24],
    [0.36, 0.37, 0.2],
    [0.55, 0.47, 0.28],
    [0.3, 0.33, 0.19],
    [0.5, 0.38, 0.2],
    [0.42, 0.44, 0.27],
  ];
  const blade = (x, y, z, h, lean, ang, w, c) => {
    const dx = Math.cos(ang),
      dz = Math.sin(ang); // blade plane: width along (dx, dz)
    const tx = x + Math.cos(ang + 1.57) * lean,
      tz = z + Math.sin(ang + 1.57) * lean;
    const nx = -dz,
      nz = dx;
    const c0 = c.map((v) => v * 0.55),
      c1 = c.map((v) => v * 1.08);
    P.push(x - dx * w, y, z - dz * w, x + dx * w, y, z + dz * w, tx, y + h, tz);
    N.push(nx, 0.35, nz, nx, 0.35, nz, nx, 0.6, nz);
    C.push(...c0, ...c0, ...c1);
  };
  let n = 0;
  for (const w of PARK_WATER) {
    if (w.name === "reservoir") continue;
    const m = w.pts.length;
    let ar = 0;
    for (let i = 0; i < m; i++) {
      const [ax, az] = w.pts[i],
        [bx, bz] = w.pts[(i + 1) % m];
      ar += ax * bz - bx * az;
    }
    const sg = ar > 0 ? 1 : -1;
    for (let i = 0; i < m; i++) {
      const [ax, az] = w.pts[i],
        [bx, bz] = w.pts[(i + 1) % m];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.01) continue;
      const tx = (bx - ax) / L,
        tz = (bz - az) / L,
        inx = -tz * sg,
        inz = tx * sg; // inward (into the water)
      for (let s = rnd() * 0.5; s < L; s += 0.35 + rnd() * 0.4) {
        const x0 = ax + tx * s,
          z0 = az + tz * s;
        const f = reedBed(w, x0, z0);
        if (f < 0.4 || rnd() > (f - 0.3) * 2.2) continue;
        const depth = 0.8 + (f - 0.4) * 7; // beds widen where the field is strong
        const o = -1.5 + rnd() * (depth + 1.5);
        const x = x0 + inx * o + (rnd() - 0.5) * 0.6,
          z = z0 + inz * o + (rnd() - 0.5) * 0.6;
        const inWater = !!parkWaterAt(x, z);
        const y = inWater ? w.y - 0.05 : GRASS_Y - 0.05;
        const c = COL[Math.floor(rnd() * COL.length)].map(
          (v) => v * (0.85 + rnd() * 0.3),
        );
        const hk = (inWater ? 1.4 : 0.9) + rnd() * 0.9;
        const nb = 18 + Math.floor(rnd() * 14);
        for (let b = 0; b < nb; b++) {
          const h = hk * (0.55 + rnd() * 0.55),
            cc = c.map((v) => v * (0.85 + rnd() * 0.3));
          blade(
            x + (rnd() - 0.5) * 1.1,
            y,
            z + (rnd() - 0.5) * 1.1,
            h,
            (rnd() - 0.5) * h * 0.5,
            rnd() * Math.PI,
            0.07 + rnd() * 0.07,
            cc,
          );
        }
        if (inWater && rnd() < 0.3) {
          // cattail heads
          const hx = x + (rnd() - 0.5) * 0.2,
            hz = z + (rnd() - 0.5) * 0.2,
            hy = y + hk * 1.05;
          for (const a of [0, 1.57]) {
            const dx = Math.cos(a) * 0.03,
              dz = Math.sin(a) * 0.03;
            P.push(
              hx - dx,
              hy,
              hz - dz,
              hx + dx,
              hy,
              hz + dz,
              hx + dx,
              hy + 0.22,
              hz + dz,
              hx - dx,
              hy,
              hz - dz,
              hx + dx,
              hy + 0.22,
              hz + dz,
              hx - dx,
              hy + 0.22,
              hz - dz,
            );
            for (let k = 0; k < 6; k++) {
              N.push(Math.sin(a), 0.2, -Math.cos(a));
              C.push(0.2, 0.12, 0.07);
            }
          }
        }
        n++;
      }
    }
  }
  if (!P.length) return 0;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = "park-reeds";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return n;
}

// (park r4) Fifth Av / CPW perimeter (critic r3: 'no lamp posts, no hex pavers along the park wall'): Central-Park
// cast-iron lamp posts (dark green, fluted base, lantern globe) every ~19 m just outside the wall, and the grey
// hexagonal asphalt-paver band (the park's signature sidewalk) from the wall face ~2 m out.
function buildParkEdge(scene, S) {
  const P = G.PARK,
    e = 0.1,
    y = G.CURB_H,
    rnd = mulberry32(7373);
  const L = new MB(),
    glow = new MB();
  const lamp = (x, z) => {
    L.setColor([0.03, 0.045, 0.035]);
    L.cyl(x, y, z, 0.2, 0.16, 0.55, 8, true, false); // base
    L.cyl(x, y + 0.55, z, 0.085, 0.065, 3.1, 8, false, true); // shaft
    L.cyl(x, y + 3.62, z, 0.13, 0.09, 0.14, 8, true, false); // collar
    L.cyl(x, y + 4.3, z, 0.26, 0.05, 0.18, 8, true, false); // cap
    glow.setColor([1, 0.9, 0.72]);
    glow.cyl(x, y + 3.76, z, 0.16, 0.24, 0.54, 10, true, true); // globe
    S?.cyl(x, z, y, y + 4.48, 0.2, 0.2, "pole");
    parkLampLight(x, y, z); // (night)
  };
  const runs = [];
  for (const sx of [P.x0 - e, P.x1 + e])
    runs.push({
      x: sx + (sx < 0 ? -1.35 : 1.35),
      a: P.z0 + 6,
      b: P.z1 - 6,
      alongX: false,
    });
  for (const sz of [P.z0 - e, P.z1 + e])
    runs.push({
      z: sz + (sz < -1000 ? -1.35 : 1.35),
      a: P.x0 + 6,
      b: P.x1 - 6,
      alongX: true,
    });
  for (const R of runs)
    for (let s = R.a + rnd() * 6; s < R.b; s += 17 + rnd() * 4)
      R.alongX ? lamp(s, R.z) : lamp(R.x, s);
  const lg = L.build();
  if (lg) {
    const m = new THREE.Mesh(
      lg,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        metalness: 0.5,
      }),
    );
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = "park-lamps";
    scene.add(m);
  }
  const gg = glow.build();
  if (gg) {
    const m = new THREE.Mesh(gg, parkGlobeMaterial());
    m.name = "park-lamp-globes";
    scene.add(nightGlow(m));
  } // (night) brighter at night
  // hex-paver band: 4 quads, a world-space hexagon shader (mortar lines, per-paver tone, grime near the wall)
  const W = 1.95,
    yy = y + 0.004,
    Pq = [],
    I = [];
  const quad = (x0, z0, x1, z1) => {
    const v = Pq.length / 3;
    Pq.push(x0, yy, z0, x0, yy, z1, x1, yy, z1, x1, yy, z0);
    I.push(v, v + 1, v + 2, v, v + 2, v + 3);
  };
  quad(P.x0 - e - W, P.z0 - e - W, P.x0 - e, P.z1 + e + W);
  quad(P.x1 + e, P.z0 - e - W, P.x1 + e + W, P.z1 + e + W);
  quad(P.x0 - e, P.z0 - e - W, P.x1 + e, P.z0 - e);
  quad(P.x0 - e, P.z1 + e, P.x1 + e, P.z1 + e + W);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(Pq, 3));
  g.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      new Array(Pq.length / 3).fill([0, 1, 0]).flat(),
      3,
    ),
  );
  g.setIndex(I);
  const m = new THREE.MeshStandardMaterial({
    color: 0x575754,
    roughness: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vHexW;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvHexW = (modelMatrix * vec4(position, 1.0)).xz;",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec2 vHexW;
      float hxH(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
      { vec2 p = vHexW / 0.23; // hexagon cells (~0.4 m across)
        vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
        vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        vec2 id = p - g;
        vec2 q = abs(g); float edge = 0.5 - max(dot(q, normalize(r)), q.x);
        float fw = fwidth(p.x) * 1.2;
        float mortar = 1.0 - smoothstep(0.02, 0.02 + fw, edge);
        float far = smoothstep(0.08, 0.35, fw);
        float tone = 0.86 + 0.2 * hxH(floor(id * 10.0 + 0.5));
        float gr = 0.9 + 0.1 * sin(vHexW.x * 0.37 + vHexW.y * 0.21) * sin(vHexW.y * 0.13);
        diffuseColor.rgb *= mix(tone * mix(1.0, 0.55, mortar), 0.9, far) * gr; }`,
      );
  };
  m.customProgramCacheKey = () => "park-hexpaver-v1"; // (park r8) charcoal asphalt hex blocks (the real CP pavers), so the band reads against the pale concrete walk
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  mesh.name = "park-hexpavers";
  mesh.renderOrder = 1;
  scene.add(mesh);
}

// (park r4) people (critic r3: 'lawn is empty, no people'): sunbathers / sitters in loose groups on blankets on Sheep
// Meadow, the Great Lawn and the smaller lawns, and walkers on the footpaths. Instanced low-poly figures (~40 tris),
// four draws; decor only (like the street peds, no collision).
function buildParkPeople(scene, parkPaths) {
  const rnd = mulberry32(8181);
  const fig = new MB();
  fig.setColor([0.32, 0.33, 0.38]);
  fig.box(-0.17, 0, -0.1, -0.02, 0.84, 0.1);
  fig.box(0.02, 0, -0.1, 0.17, 0.84, 0.1); // legs
  fig.setColor([1, 1, 1]);
  fig.box(-0.22, 0.84, -0.13, 0.22, 1.45, 0.13); // torso (instance colour = shirt)
  fig.box(-0.27, 0.9, -0.07, -0.22, 1.42, 0.07);
  fig.box(0.22, 0.9, -0.07, 0.27, 1.42, 0.07); // arms
  const head = new MB();
  head.setColor([1, 1, 1]);
  head.box(-0.1, 1.47, -0.11, 0.1, 1.7, 0.11);
  head.box(-0.035, 1.43, -0.035, 0.035, 1.48, 0.035);
  const blanket = new MB();
  blanket.setColor([1, 1, 1]);
  blanket.box(-0.9, 0, -0.75, 0.9, 0.025, 0.75, 0b111111);
  const SHIRT = [
    0xe8e4dc, 0x1c1f26, 0x3b4f7a, 0x8a2a24, 0x5c6b4a, 0xc9b27a, 0x7a7f86,
    0xd06a3a, 0x2f5f6f, 0xb8b0a4, 0x4a3a5c, 0xe0c040,
  ];
  const SKIN = [0xe0b89a, 0xc89878, 0x9a6a4c, 0x6a4632, 0xf0cdb0];
  const BLK = [
    0x9a9486, 0x7a3a30, 0x3a4a6a, 0x9a8450, 0x4a5a4a, 0xa8a49a, 0x5a4a5a,
  ]; // (park r9) muted: white specks read as noise (critic r8)
  const people = [],
    blankets = [];
  const y0 = GRASS_Y;
  const pushP = (x, z, pose, ry, kind = "lawn") =>
    people.push({ x, z, pose, ry, kind }); // (peds r6) kind
  // lawns: groups of 1-5 around a blanket; density by lawn (Sheep Meadow busiest)
  const dens = [400, 150, 120, 60, 50, 50, 40, 60, 40, 50, 50];
  PARK_MEADOWS.forEach((m, mi) => {
    const n = dens[mi] ?? 30;
    let placed = 0;
    for (let t = 0; t < n * 4 && placed < n; t++) {
      const u = rnd() * 2 - 1,
        v = rnd() * 2 - 1;
      if (u * u + v * v > 0.72) continue;
      const c = Math.cos(m.a),
        s = Math.sin(m.a);
      const lx = u * m.rx,
        lz = v * m.rz,
        x = m.x + lx * c + lz * s,
        z = m.z - lx * s + lz * c;
      if (parkWaterAt(x, z)) continue;
      const gsz = 1 + Math.floor(rnd() * rnd() * 5),
        ry = rnd() * Math.PI * 2;
      if (rnd() < 0.7)
        blankets.push({ x, z, ry, c: BLK[Math.floor(rnd() * BLK.length)] });
      for (let k = 0; k < gsz; k++) {
        const a = ry + k * 2.1 + rnd() * 0.6,
          rr = gsz > 1 ? 0.7 + rnd() * 0.4 : 0;
        const q = rnd();
        pushP(
          x + Math.cos(a) * rr,
          z + Math.sin(a) * rr,
          q < 0.45 ? 1 : q < 0.8 ? 2 : 0,
          a + Math.PI + (rnd() - 0.5),
        );
      }
      placed += gsz;
    }
  });
  // walkers on the footpaths (and a few on the drives' edges)
  const segs = [];
  let tot = 0;
  for (const p of parkPaths)
    for (let i = 1; i < p.pts.length; i++) {
      const L = Math.hypot(
        p.pts[i][0] - p.pts[i - 1][0],
        p.pts[i][1] - p.pts[i - 1][1],
      );
      segs.push([p.pts[i - 1], p.pts[i], p.w, !!p.drive, L]);
      tot += L;
    }
  const nW = Math.min(1400, Math.floor(tot / 14));
  for (let k = 0; k < nW && segs.length; k++) {
    let u = rnd() * tot,
      sg = segs[0];
    for (const q of segs) {
      u -= q[4];
      if (u <= 0) {
        sg = q;
        break;
      }
    }
    const [a, b, w, drive] = sg,
      t = rnd(),
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz) || 1;
    const off = drive
      ? (rnd() < 0.5 ? -1 : 1) * (w / 2 - 0.8)
      : (rnd() - 0.5) * Math.max(0, w - 1.0);
    const x = a[0] + dx * t - (dz / L) * off,
      z = a[1] + dz * t + (dx / L) * off;
    if (parkWaterAt(x, z)) continue;
    const ry = Math.atan2(dx, dz) + (rnd() < 0.5 ? 0 : Math.PI);
    pushP(x, z, 0, ry, "path");
    if (rnd() < 0.3)
      pushP(x - Math.cos(ry) * 0.6, z + Math.sin(ry) * 0.6, 0, ry, "path"); // (peds r6) kind   // walking in pairs
  }
  // (park r7) critic r6: 'barely any pedestrians on the park-edge avenues'. People strolling / standing on the four
  // perimeter sidewalks (the hex-paver walk and the curb side), singles, pairs and small knots, ~1 per 6 m
  {
    const PK = G.PARK;
    const edge = (a0, a1, fixed, alongX, out) => {
      for (let s = a0 + rnd() * 6; s < a1; s += 3 + rnd() * 9) {
        const off = fixed + out * (0.6 + rnd() * 3.6),
          ry =
            (alongX ? Math.PI / 2 : 0) +
            (rnd() < 0.5 ? 0 : Math.PI) +
            (rnd() - 0.5) * 0.3;
        const k = rnd() < 0.62 ? 1 : rnd() < 0.8 ? 2 : 3;
        for (let j = 0; j < k; j++) {
          const ds = j * 0.65,
            dn = j ? (rnd() - 0.5) * 0.8 : 0;
          const x = alongX ? s + ds : off + dn,
            z = alongX ? off + dn : s + ds;
          people.push({
            x,
            z,
            pose: 0,
            ry: ry + (j === 2 ? Math.PI : 0),
            y: G.CURB_H,
            kind: "edge",
            g: k,
            j,
            alongX,
          }); // (peds r6) kind / group
        }
      }
    };
    edge(PK.z0 + 5, PK.z1 - 5, PK.x0 - 0.2, false, -1);
    edge(PK.z0 + 5, PK.z1 - 5, PK.x1 + 0.2, false, 1);
    edge(PK.x0 + 5, PK.x1 - 5, PK.z0 - 0.2, true, -1);
    edge(PK.x0 + 5, PK.x1 - 5, PK.z1 + 0.2, true, 1);
  }
  const mk = (geo, list, name, colFn, xf) => {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
    });
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const M = new THREE.Matrix4(),
      Q = new THREE.Quaternion(),
      E = new THREE.Euler(),
      V = new THREE.Vector3(),
      Sc = new THREE.Vector3(),
      C = new THREE.Color();
    list.forEach((it, i) => {
      xf(it, E, V, Sc);
      Q.setFromEuler(E);
      M.compose(V, Q, Sc);
      im.setMatrixAt(i, M);
      C.setHex(colFn(it));
      C.convertSRGBToLinear?.();
      im.setColorAt(i, C);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = true;
    im.receiveShadow = true;
    im.name = name;
    scene.add(im);
  };
  const pose = (it, E, V, Sc) => {
    // 0 standing / walking, 1 sitting (folded: 0.55 high), 2 lying (rotated flat, head along the facing direction)
    if (it.pose === 2) {
      E.set(-Math.PI / 2, it.ry, 0, "YXZ");
      V.set(it.x, y0 + 0.14, it.z);
      Sc.set(1, 1, 1);
    } else if (it.pose === 1) {
      E.set(0, it.ry, 0);
      V.set(it.x, y0 - 0.02, it.z);
      Sc.set(1, 0.58, 1.3);
    } else {
      E.set(0, it.ry, 0);
      V.set(it.x, it.y ?? y0, it.z);
      Sc.set(1, 0.95 + ((((it.x * 7.1) % 1) + 1) % 1) * 0.12, 1);
    }
  };
  people.forEach((p) => {
    p.sh = SHIRT[Math.floor(rnd() * SHIRT.length)];
    p.sk = SKIN[Math.floor(rnd() * SKIN.length)];
  });
  // (peds r6) user: 'in the park we still have block people'. The box figures are gone: lawn + park-edge people are
  // handed to the street crowd (npc/crowd.js statics: same skinned models, LODs and anti-clone as the streets); the
  // footpath walkers are dropped (crowd.js streams its own park-path walkers / joggers / couples)
  PARK_CROWD_SPOTS.length = 0;
  for (const p of people)
    if (p.kind !== "path")
      PARK_CROWD_SPOTS.push({
        x: p.x,
        z: p.z,
        ry: p.ry,
        pose: p.pose,
        kind: p.kind,
        g: p.g,
        alongX: p.alongX,
        y: p.y ?? y0,
      });
  void fig;
  void head;
  void pose;
  if (blankets.length)
    mk(
      blanket.build(),
      blankets,
      "park-blankets",
      (b) => b.c,
      (b, E, V, Sc) => {
        E.set(0, b.ry, 0);
        V.set(b.x, y0 + 0.005, b.z);
        Sc.set(1, 1, 1);
      },
    );
  return people.length;
}

// (park r5) critic r4: 'water with clean vector edges, flat dark plane'. A transparent band on the water surface of every
// park water body, from the shoreline 5-11 m inward (width wanders along the shore): the bank's shadow + mirrored trees /
// wet stone darken the margin, then fade out into the open-water sky reflection, broken by a wind-streak noise. Visual
// only (no collision: it lies 1 cm over the water surface). One mesh, one draw.
function buildWaterShallows(scene) {
  // (park r7) critic r6: 'water is a flat tinted plane with no reflections of the sky or trees; hard edges'. The band is
  // now the mirrored tree line: 10-26 m of dark olive / umber reflection with a ragged crown-shaped inner edge (wider
  // at grazing angles, as a mirror image of 15-20 m crowns is), and an inner fan covers the open water with wind
  // 'cat's-paw' ripple patches, sky-bright streaks and sun glints, so the ponds read as water, not a painted plane.
  const P = [],
    A = [],
    I = [];
  for (const w of PARK_WATER) {
    const n = w.pts.length;
    let ar = 0;
    for (let i = 0; i < n; i++) {
      const [ax, az] = w.pts[i],
        [bx, bz] = w.pts[(i + 1) % n];
      ar += ax * bz - bx * az;
    }
    const sg = ar > 0 ? 1 : -1;
    const y = w.y + 0.012;
    let acc = 0;
    const b0 = P.length / 3;
    for (let i = 0; i <= n; i++) {
      const k = i % n,
        [x, z] = w.pts[k],
        [px, pz] = w.pts[(k + n - 1) % n],
        [qx, qz] = w.pts[(k + 1) % n];
      let tx = qx - px,
        tz = qz - pz;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      const nx = -tz * sg,
        nz = tx * sg; // inward (left of the travel direction for CCW in x/z)
      if (i) acc += Math.hypot(x - w.pts[i - 1][0], z - w.pts[i - 1][1]);
      const dc = Math.hypot(w.cx - x, w.cz - z) || 1;
      const W = Math.min(
        dc * 0.5,
        (w.name === "reservoir" ? 12 : 11) +
          12 *
            (0.5 +
              0.5 *
                Math.sin(acc * 0.037 + w.cx * 0.01) *
                Math.cos(acc * 0.091 + 1.3)),
      );
      void nx;
      void nz; // (park r7) radial inset (the outlines are star-shaped about the centre): the fan never folds over
      P.push(x, y, z, x + ((w.cx - x) / dc) * W, y, z + ((w.cz - z) / dc) * W);
      A.push(0, 1);
      if (i) {
        const b = P.length / 3 - 4;
        I.push(b, b + 1, b + 3, b, b + 3, b + 2);
      }
    }
    // open water: a fan from the band's inner edge to the centre (aT = 1: no band shading, ripples only)
    const c = P.length / 3;
    P.push(w.cx, y, w.cz);
    A.push(1.0);
    for (let i = 0; i < n; i++) I.push(b0 + i * 2 + 1, b0 + (i + 1) * 2 + 1, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("aT", new THREE.Float32BufferAttribute(A, 1));
  g.setIndex(I);
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 } },
    ]),
    vertexShader: `attribute float aT; varying float vT; varying vec3 vW;
      #include <fog_pars_vertex>
      void main() { vT = aT; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying float vT; varying vec3 vW; uniform float uTime;
      #include <fog_pars_fragment>
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        float graze = 1.0 - clamp(V.y, 0.0, 1.0);                         // 0 top-down .. 1 grazing
        float n = vn(vW.xz * 0.18) * 0.6 + vn(vW.xz * 0.7) * 0.4;
        // mirrored tree line: its inner edge is a row of crown bumps (~7 m) and reaches further out at grazing views
        float crowns = vn(vec2(vW.x + vW.z, vW.z - vW.x) * 0.14) * 0.6 + vn(vW.xz * 0.45) * 0.4;
        float reach = mix(0.6, 0.95, graze) * (0.65 + 0.55 * crowns); // (park r8) 0.45 -> 0.6 from above (critic r7: 'no shoreline darkening')
        float t = clamp(vT + (n - 0.5) * 0.18, 0.0, 1.0);
        float band = 1.0 - smoothstep(reach - 0.12, reach + 0.05, t);
        // wind: cat's-paw patches (ruffled water reflects more sky) + fine streaks along the wind
        vec2 wd = vec2(0.8, 0.6), wq = vec2(dot(vW.xz, wd), dot(vW.xz, vec2(-wd.y, wd.x)));
        float paw = smoothstep(0.45, 0.8, vn(wq * vec2(0.02, 0.035) + uTime * 0.01) * 0.7 + vn(wq * 0.09) * 0.3);
        float streak = vn(vec2(wq.x * 0.03, wq.y * 0.6));
        float rip = vn(wq * vec2(0.9, 2.2) + vec2(uTime * 0.4, 0.0));
        vec3 sky = mix(vec3(0.44, 0.52, 0.6), vec3(0.72, 0.76, 0.8), graze);
        vec3 deep = vec3(0.035, 0.05, 0.045);
        // (park r9) critic r8: 'a flat mirror with an obvious stretched sky reflection, no depth colour'. Fresnel: seen
        // from above the water is mostly its own dark tannin-green body (weak reflection), sky-bright only at grazing
        // angles and in the wind-ruffled patches; plus fine ripple bands breaking up the reflected clouds
        float fres = 0.12 + 0.88 * pow(graze, 3.0);
        float fine = vn(wq * vec2(0.35, 1.3) - vec2(uTime * 0.25, 0.0)) * vn(wq * vec2(1.7, 4.1) + vec2(uTime * 0.6, 0.0));
        vec3 c = mix(deep, sky, clamp((0.18 + 0.45 * paw + 0.2 * streak + 0.25 * fine) * mix(0.55, 1.0, fres), 0.0, 1.0));
        float a = clamp((0.34 + 0.24 * paw + 0.14 * abs(streak - 0.5) + 0.12 * fine) * mix(1.0, 0.7, fres), 0.0, 0.8); // (park r8) wind texture; (park r9) denser body colour
        // (park r10) critic r9: 'blotchy tiled normal pattern, hard dark tone, no sky-reflection gradient, flat mirror'.
        // The open water now carries its own reflected-sky gradient (zenith blue seen from above -> pale horizon haze at
        // grazing view, weighted by Fresnel) over a teal-grey body, with multi-scale non-repeating ripple bands, and is
        // opaque enough (0.62-0.85) to hide the base water's tiling normal from swinging height
        {
          vec3 skyZ = vec3(0.26, 0.36, 0.48), skyH = vec3(0.6, 0.66, 0.7);
          vec3 refl = mix(skyZ, skyH, pow(graze, 1.6));
          float cloud = smoothstep(0.35, 0.85, vn(vW.xz * 0.006 + vec2(uTime * 0.002, 0.0)) * 0.7 + vn(vW.xz * 0.02) * 0.3);
          refl = mix(refl, vec3(0.7, 0.72, 0.74), cloud * 0.45);
          float rw = vn(wq * vec2(0.05, 0.18) + vec2(uTime * 0.05, 0.0)) * 0.5 + vn(wq * vec2(0.16, 0.55) - vec2(uTime * 0.12, 0.0)) * 0.3 + fine * 0.4;
          vec3 body = vec3(0.045, 0.068, 0.07) * (0.9 + 0.25 * vn(vW.xz * 0.03));
          float fr2 = clamp(0.1 + 0.8 * pow(graze, 2.4) + 0.22 * (rw - 0.45) + 0.2 * paw, 0.04, 0.95);
          vec3 c2 = mix(body, refl, fr2);
          c = mix(c, c2, 0.75);
          a = max(a, mix(0.62, 0.85, graze));
        }
        // tree reflection colour (dark olive / umber, a little autumn warmth) over the band
        vec3 tree = mix(vec3(0.028, 0.036, 0.018), vec3(0.07, 0.058, 0.03), crowns) * (0.85 + 0.3 * rip);
        c = mix(c, tree, band); a = mix(a, 0.9, band);
        // (park r10) shoreline gradient: a silty olive-brown shallow shelf fading out over the first few metres (seen
        // through the tree reflection from above), then a broken foam / wet-stone lip at the waterline
        float shelf = 1.0 - smoothstep(0.0, 0.16 + 0.08 * n, vT);
        c = mix(c, vec3(0.11, 0.1, 0.066) * (0.85 + 0.3 * n), shelf * mix(0.7, 0.25, graze));
        float foam = (1.0 - smoothstep(0.0, 0.03, vT)) * smoothstep(0.45, 0.7, vn(vW.xz * 0.9 + uTime * 0.05));
        c = mix(vec3(0.07, 0.065, 0.052), c, smoothstep(0.0, 0.035, vT));   // thin wet-stone lip at the waterline
        c = mix(c, vec3(0.34, 0.35, 0.33), foam * 0.55);
        a = max(a, (1.0 - smoothstep(0.0, 0.035, vT)) * 0.8);
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
      }`,
  });
  m.userData.tick = (dt) => {
    m.uniforms.uTime.value += dt;
  };
  const mesh = new THREE.Mesh(g, m);
  mesh.name = "park-water-shallows";
  mesh.renderOrder = 2;
  scene.add(mesh);
}

// (park r7) critic r6: 'the reservoir is a perfect smooth blob with a hard grey rim'. Granite riprap: tumbled dark
// blocks along the waterline inside the coping (half submerged), in runs with gaps, so the rim reads ragged and
// stony from the air. Axis-aligned boxes in the park facade mesh (exact collision, no extra draw).
function buildReservoirRiprap(box) {
  const w = PARK_WATER.find((q) => q.name === "reservoir");
  if (!w) return;
  const rnd = mulberry32(7171),
    n = w.pts.length;
  let ar = 0;
  for (let i = 0; i < n; i++) {
    const [ax, az] = w.pts[i],
      [bx, bz] = w.pts[(i + 1) % n];
    ar += ax * bz - bx * az;
  }
  const sg = ar > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const [ax, az] = w.pts[i],
      [bx, bz] = w.pts[(i + 1) % n];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.01) continue;
    const tx = (bx - ax) / L,
      tz = (bz - az) / L,
      inx = -tz * sg,
      inz = tx * sg;
    for (let s = rnd() * 1.2; s < L; s += 1.0 + rnd() * 1.1) {
      const run =
        Math.sin((ax + tx * s) * 0.05) * Math.cos((az + tz * s) * 0.043) +
        0.4 * Math.sin((ax + az) * 0.13 + s);
      if (run < -0.55 && rnd() < 0.8) continue; // short gaps: plain granite edge
      const k = 1 + Math.floor(rnd() * 2);
      for (let j = 0; j < k; j++) {
        const o = 0.2 + rnd() * 1.6,
          t = (rnd() - 0.5) * 0.8;
        const cx = ax + tx * (s + t) + inx * o,
          cz = az + tz * (s + t) + inz * o;
        const hs = 0.35 + rnd() * 0.45,
          top = w.y + 0.1 + rnd() * 0.5 - o * 0.08;
        const tone = 0.36 + rnd() * 0.16;
        box(
          cx - hs,
          w.y - 0.5,
          cz - hs * (0.6 + rnd() * 0.4),
          cx + hs,
          Math.min(top, GRASS_Y - 0.08),
          cz + hs * (0.6 + rnd() * 0.4),
          {
            style: STYLE.BLANK,
            layer: LAYER.LIME,
            tint: [tone * 0.92, tone * 0.92, tone * 0.9],
            seed: 80 + (i & 7),
          },
          {},
          true,
          null,
          "park",
        );
      }
    }
  }
}

// (night) a Central-Park lantern globe: a soft warm point light at the globe (citylights.js) + a globe material whose
// glow rises from a dim day value to a bright bulb at night
function parkLampLight(x, y, z) {
  cityLights.add({
    type: "point",
    pos: [x, y + 4.03, z],
    color: 0xffd6a0,
    intensity: 20,
    range: 14,
    radius: 0.35,
    volume: 0.35,
  });
}
function parkGlobeMaterial() {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.2,
    emissive: 0xffe2b0,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.9,
  });
  return m;
}
const nightGlow = (mesh) => {
  mesh.onBeforeRender = () => {
    mesh.material.emissiveIntensity = 0.35 + 1.6 * nightK.value;
  };
  return mesh;
};

// Central-Park cast-iron lamp post (dark green, base, fluted shaft, lantern globe): MB L (post) + MB glow (globe)
function lampPost(L, glow, S, x, y, z) {
  parkLampLight(x, y, z); // (night)
  L.setColor([0.03, 0.045, 0.035]);
  L.cyl(x, y, z, 0.2, 0.16, 0.55, 8, true, false); // base
  L.cyl(x, y + 0.55, z, 0.085, 0.065, 3.1, 8, false, true); // shaft
  L.cyl(x, y + 3.62, z, 0.13, 0.09, 0.14, 8, true, false); // collar
  L.cyl(x, y + 4.3, z, 0.26, 0.05, 0.18, 8, true, false); // cap
  glow.setColor([1, 0.9, 0.72]);
  glow.cyl(x, y + 3.76, z, 0.16, 0.24, 0.54, 10, true, true); // globe
  S?.cyl(x, z, y, y + 4.48, 0.2, 0.2, "pole");
}

// (park r7) critic r6: 'paths are uniform-width beige lines with no lamps, benches or edging'. Lamp posts every
// ~30-40 m along the footpaths and around the reservoir track, World's-Fair benches in pairs where a walk runs
// near-axis-aligned (so the bench boxes = exact collision), and the drives as a wider darker asphalt carriageway
// (path hierarchy: drives > walks). Two draws for posts + benches, one for the globes, one for the drive decal.
function buildPathFurniture(scene, S, parkPaths) {
  const rnd = mulberry32(9393),
    L = new MB(),
    glow = new MB();
  const y = GRASS_Y;
  const wet = (x, z) =>
    parkWaterAt(x, z) ||
    parkWaterAt(x + 1.5, z) ||
    parkWaterAt(x - 1.5, z) ||
    parkWaterAt(x, z + 1.5) ||
    parkWaterAt(x, z - 1.5);
  const nearRock = (x, z) =>
    PARK_ROCKS.some(
      ([rx, rz, R]) => (rx - x) ** 2 + (rz - z) ** 2 < (R + 1.5) ** 2,
    );
  const M = PARK_SITES.met,
    inMet = (x, z) =>
      x > M.x0 - 3 && x < M.x1 + 8 && z > M.z0 - 3 && z < M.z1 + 3;
  let nl = 0,
    nb = 0;
  const bench = (x, z, alongX, side) => {
    // seat along the path axis, backrest on the far side (side = +1 / -1 across the path)
    const len = 1.9,
      hx = alongX ? len / 2 : 0.33,
      hz = alongX ? 0.33 : len / 2;
    L.setColor([0.02, 0.022, 0.02]);
    for (const e of [-1, 1]) {
      const ex = alongX ? x + e * (len / 2 - 0.05) : x,
        ez = alongX ? z : z + e * (len / 2 - 0.05);
      const b0 = alongX ? [ex - 0.03, ez - hz] : [ex - hx, ez - 0.03],
        b1 = alongX ? [ex + 0.03, ez + hz] : [ex + hx, ez + 0.03];
      L.box(b0[0], y, b0[1], b1[0], y + 0.45, b1[1]);
      S?.box(b0[0], y, b0[1], b1[0], y + 0.45, b1[1], "equipment");
    }
    L.setColor([0.05, 0.075, 0.045]);
    L.box(x - hx, y + 0.42, z - hz, x + hx, y + 0.47, z + hz);
    S?.box(x - hx, y + 0.42, z - hz, x + hx, y + 0.47, z + hz, "equipment");
    const bx = alongX
      ? [x - hx, x + hx]
      : side > 0
        ? [x + hx - 0.06, x + hx]
        : [x - hx, x - hx + 0.06];
    const bz = alongX
      ? side > 0
        ? [z + hz - 0.06, z + hz]
        : [z - hz, z - hz + 0.06]
      : [z - hz, z + hz];
    L.box(bx[0], y + 0.47, bz[0], bx[1], y + 0.92, bz[1]);
    S?.box(bx[0], y + 0.47, bz[0], bx[1], y + 0.92, bz[1], "equipment");
    nb++;
  };
  const DP = [],
    DI = [];
  for (const p of parkPaths) {
    const pts = p.pts;
    if (p.drive) {
      // drive carriageway decal (w - 0.6 m wide), 4 mm over the path ribbon
      const hw = p.w / 2 - 0.3,
        yy = GY_PATH + 0.004;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)],
          b = pts[Math.min(pts.length - 1, i + 1)];
        let tx = b[0] - a[0],
          tz = b[1] - a[1];
        const l = Math.hypot(tx, tz) || 1;
        tx /= l;
        tz /= l;
        const v = DP.length / 3;
        DP.push(
          pts[i][0] - tz * hw,
          yy,
          pts[i][1] + tx * hw,
          pts[i][0] + tz * hw,
          yy,
          pts[i][1] - tx * hw,
        );
        if (i) DI.push(v - 2, v - 1, v + 1, v - 2, v + 1, v);
      }
    }
    let acc = rnd() * 20,
      bacc = rnd() * 30;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1],
        [bx, bz] = pts[i],
        sl = Math.hypot(bx - ax, bz - az);
      if (sl < 0.01) continue;
      const tx = (bx - ax) / sl,
        tz = (bz - az) / sl;
      for (let s = 0; s < sl; s += 2) {
        acc += Math.min(2, sl - s);
        bacc += Math.min(2, sl - s);
        const cx = ax + tx * s,
          cz = az + tz * s;
        if (acc > (p.drive ? 46 : p.minor ? 70 : 32) + rnd() * 8) {
          const side = rnd() < 0.5 ? -1 : 1,
            off = p.w / 2 + 0.75;
          const x = cx - tz * off * side,
            z = cz + tx * off * side;
          if (!wet(x, z) && !nearRock(x, z) && !inMet(x, z)) {
            lampPost(L, glow, S, x, y, z);
            nl++;
            acc = 0;
          }
        }
        if (!p.drive && bacc > 40 + rnd() * 20) {
          const ax2 = Math.abs(tx) > 0.97,
            az2 = Math.abs(tz) > 0.97;
          if (ax2 || az2) {
            const side = rnd() < 0.5 ? -1 : 1,
              off = p.w / 2 + 0.55;
            const x = cx - tz * off * side,
              z = cz + tx * off * side;
            // backrest away from the path: across-path direction = (-tz, tx) * side
            const back = ax2 ? Math.sign(tx * side) : Math.sign(-tz * side);
            if (!wet(x, z) && !nearRock(x, z) && !inMet(x, z)) {
              bench(x, z, ax2, back);
              const x2 = x + (ax2 ? 2.6 : 0),
                z2 = z + (az2 ? 2.6 : 0);
              if (rnd() < 0.6 && !wet(x2, z2)) bench(x2, z2, ax2, back);
              bacc = 0;
            }
          }
        }
      }
    }
  }
  // reservoir track: lamps along the outer edge of the running track
  const rs = PARK_WATER.find((q) => q.name === "reservoir");
  if (rs) {
    const n = rs.pts.length;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const [ax, az] = rs.pts[i],
        [bx, bz] = rs.pts[(i + 1) % n];
      acc += Math.hypot(bx - ax, bz - az);
      if (acc < 30) continue;
      acc = 0;
      let nx = ax - rs.cx,
        nz = az - rs.cz;
      const l = Math.hypot(nx, nz) || 1;
      nx /= l;
      nz /= l;
      const x = ax + nx * 12.5,
        z = az + nz * 12.5;
      if (!wet(x, z)) {
        lampPost(L, glow, S, x, y, z);
        nl++;
      }
    }
  }
  const lg = L.build();
  if (lg) {
    const m = new THREE.Mesh(
      lg,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.6,
        metalness: 0.4,
      }),
    );
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = "park-path-furniture";
    scene.add(m);
  }
  const gg = glow.build();
  if (gg) {
    const m = new THREE.Mesh(gg, parkGlobeMaterial());
    m.name = "park-path-globes";
    scene.add(nightGlow(m));
  } // (night) brighter at night
  if (DP.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(DP, 3));
    g.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(
        new Array(DP.length / 3).fill([0, 1, 0]).flat(),
        3,
      ),
    );
    g.setIndex(DI);
    const ix = g.index.array,
      ps = g.attributes.position.array;
    for (let t = 0; t < ix.length; t += 3) {
      // every triangle faces up
      const A = ix[t] * 3,
        B = ix[t + 1] * 3,
        C = ix[t + 2] * 3;
      if (
        (ps[B + 2] - ps[A + 2]) * (ps[C] - ps[A]) -
          (ps[B] - ps[A]) * (ps[C + 2] - ps[A + 2]) <
        0
      ) {
        const q = ix[t + 1];
        ix[t + 1] = ix[t + 2];
        ix[t + 2] = q;
      }
    }
    const m = new THREE.MeshStandardMaterial({
      color: 0x4d4b48,
      roughness: 0.92,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vDW;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvDW = (modelMatrix * vec4(position, 1.0)).xz;",
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
        varying vec2 vDW;
        float dH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float dN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(dH(i), dH(i + vec2(1, 0)), f.x), mix(dH(i + vec2(0, 1)), dH(i + vec2(1, 1)), f.x), f.y); }`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
        { float n = dN(vDW * 0.35) * 0.6 + dN(vDW * 1.7) * 0.4;
          diffuseColor.rgb *= 0.82 + 0.3 * n;                                  // patched / sealed asphalt
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.2, 0.19), smoothstep(0.72, 0.8, dN(vDW * 0.12 + 3.0)) * 0.5); }`,
        );
    };
    m.customProgramCacheKey = () => "park-drive-v1";
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    mesh.name = "park-drives";
    scene.add(mesh);
  }
  return { lamps: nl, benches: nb };
}
