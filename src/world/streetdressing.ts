// @ts-nocheck
// OWNER: street agent. Extra street-level dressing that is not a prop: asphalt repair patches / utility trench cuts
// (dark, tar-sealed rectangles like the refs' avenues), drawn as one decal mesh under the road markings.
// buildRoadPatches({scene}) -> Mesh
import * as THREE from "three";
import {
  G,
  avenues,
  streets,
  avActive,
  stRange,
  mulberry32,
  streetsAt,
  stHalf,
  ZFIX,
} from "./layout.ts"; // (layout2 r9) stHalf: per-street widths
import { PARK_VIADUCT } from "./grandcentral.ts";

// 2 x 2 atlas of patch variants: darker fresh asphalt, a black tar seam along the cut edge, faint aggregate speckle
function patchAtlas() {
  const S = 256,
    N = 2,
    cv = document.createElement("canvas");
  cv.width = cv.height = S * N;
  const g = cv.getContext("2d");
  const rnd = mulberry32(777);
  for (let k = 0; k < N * N; k++) {
    const ox = (k % N) * S,
      oy = Math.floor(k / N) * S,
      m = 10;
    // irregular (hand-cut) outline
    const pts = [];
    const jag = k === 3 ? 7 : 3;
    for (let i = 0; i <= 12; i++)
      pts.push([ox + m + ((S - 2 * m) * i) / 12, oy + m + (rnd() - 0.5) * jag]);
    for (let i = 1; i <= 12; i++)
      pts.push([
        ox + S - m + (rnd() - 0.5) * jag,
        oy + m + ((S - 2 * m) * i) / 12,
      ]);
    for (let i = 11; i >= 0; i--)
      pts.push([
        ox + m + ((S - 2 * m) * i) / 12,
        oy + S - m + (rnd() - 0.5) * jag,
      ]);
    for (let i = 11; i >= 1; i--)
      pts.push([ox + m + (rnd() - 0.5) * jag, oy + m + ((S - 2 * m) * i) / 12]);
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    const tone = [0.36, 0.62, 0.34, 0.6][k]; // (street r5) stronger patch contrast (critic: 'road too clean') ((night r9) fresh-tar cells 0.5 / 0.46 -> 0.36 / 0.34: the tar seam outlines them, the fill no longer reads as a shadow)
    // (street r4) cells 1 / 3: older, sun-bleached patches (lighter than the road, like ref 16's patchwork); 0 / 2 fresh tar
    g.fillStyle =
      k === 1
        ? "rgba(132,132,130,0.36)"
        : k === 3
          ? "rgba(116,116,114,0.3)"
          : `rgba(22,24,27,${tone})`;
    g.fill();
    // speckle / wear inside
    g.save();
    g.clip();
    for (let i = 0; i < 900; i++) {
      const x = ox + rnd() * S,
        y = oy + rnd() * S,
        r = 0.6 + rnd() * 1.6;
      g.fillStyle =
        rnd() < 0.5
          ? `rgba(120,120,118,${0.08 + rnd() * 0.1})`
          : `rgba(10,10,12,${0.1 + rnd() * 0.15})`;
      g.fillRect(x, y, r, r);
    }
    // worn lighter blotches (older patches fade)
    for (let i = 0; i < 6; i++) {
      const gr = g.createRadialGradient(
        ox + rnd() * S,
        oy + rnd() * S,
        2,
        ox + rnd() * S,
        oy + rnd() * S,
        40 + rnd() * 60,
      );
      gr.addColorStop(0, "rgba(140,140,138,0.10)");
      gr.addColorStop(1, "rgba(140,140,138,0)");
      g.fillStyle = gr;
      g.fillRect(ox, oy, S, S);
    }
    g.restore();
    // tar seal along the cut
    g.lineWidth = 5;
    g.strokeStyle = "rgba(8,8,9,0.55)";
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = "rgba(150,150,146,0.22)";
    g.stroke(); // (night r9) a thin glossy sealant sheen on the seam: reads as a cut edge, not a shadow edge
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildRoadPatches({ scene }) {
  const rnd = mulberry32(9011);
  const P = [],
    UV = [],
    I = [];
  let v = 0;
  const add = (x0, z0, x1, z1, cell, rot) => {
    const u0 = (cell % 2) / 2,
      v0 = Math.floor(cell / 2) / 2,
      d = 0.5;
    let uv = [
      [u0, v0],
      [u0 + d, v0],
      [u0 + d, v0 + d],
      [u0, v0 + d],
    ];
    if (rot) uv = [uv[1], uv[2], uv[3], uv[0]];
    const c = [
      [x0, z1],
      [x1, z1],
      [x1, z0],
      [x0, z0],
    ];
    for (let k = 0; k < 4; k++) {
      P.push(c[k][0], 0.008, c[k][1]);
      UV.push(...uv[k]);
    }
    I.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  };
  const V = PARK_VIADUCT;
  // avenues: lane-long trench cuts, square utility cuts, the odd transverse trench across a couple of lanes
  for (let i = 0; i < avenues.length; i++) {
    const a = avenues[i];
    for (let k = 0; k + 1 < streets.length; k++) {
      if (!avActive(i, k)) continue;
      const zA = streets[k] + stHalf(k) + 9,
        zB = streets[k + 1] - stHalf(k + 1) - 9;
      const n = 7 + Math.floor(rnd() * 6); // (street r8) 7-12 per block (critic: road too clean / uniform) (r5: 4-8)
      for (let j = 0; j < n; j++) {
        const kind = rnd();
        let x0, x1, z0, z1;
        if (kind > 0.62 && kind < 0.78) {
          // (street r7) critic: 'repeated square patch decals' -> L-shaped / stepped
          // utility cuts: two overlapping rects of one patch cell (a main cut plus an offset extension)
          const cx = a + (rnd() - 0.5) * 16,
            w = 1.2 + rnd() * 2.2,
            h = 3 + rnd() * 6,
            z = zA + rnd() * Math.max(1, zB - zA - h - 3),
            cell = Math.floor(rnd() * 4);
          const ex = (rnd() < 0.5 ? -1 : 1) * (1.4 + rnd() * 2.2),
            ew = 1.0 + rnd() * 1.4,
            ez = z + rnd() * h * 0.6,
            eh = 1.2 + rnd() * 2;
          for (const [p0, q0, p1, q1] of [
            [cx - w / 2, z, cx + w / 2, z + h],
            [
              Math.min(cx, cx + ex) - ew / 2,
              ez,
              Math.max(cx, cx + ex) + ew / 2,
              ez + eh,
            ],
          ]) {
            const X0 = Math.max(p0, a - G.AV_HALF + 0.2),
              X1 = Math.min(p1, a + G.AV_HALF - 0.2);
            if (
              X1 - X0 < 0.5 ||
              (X1 > V.x0 && X0 < V.x1 && q1 > V.z0 && q0 < V.z1)
            )
              continue;
            add(X0, q0, X1, q1, cell, q1 - q0 > X1 - X0);
          }
          continue;
        }
        if (kind < 0.5) {
          // along a lane (street r7: 0.45 -> 0.5)
          const lane = Math.floor(rnd() * 6),
            cx = a - 9 + lane * 3.6 + (rnd() - 0.5) * 0.8,
            w = 0.9 + rnd() * 1.6,
            L = 4 + rnd() * 9; // (night r9) critic: long dark lane strips read as shadows at night: 4-20 -> 4-13 m
          const z = zA + rnd() * Math.max(1, zB - zA - L);
          x0 = cx - w / 2;
          x1 = cx + w / 2;
          z0 = z;
          z1 = z + L;
        } else if (kind < 0.8) {
          // square-ish cut (street r7: 0.5-0.62 only, smaller, more oblong)
          const cx = a + (rnd() - 0.5) * 18,
            w = 1.0 + rnd() * 1.8,
            h = 1.8 + rnd() * 4.2,
            z = zA + rnd() * (zB - zA - h);
          x0 = cx - w / 2;
          x1 = cx + w / 2;
          z0 = z;
          z1 = z + h;
        } else if (kind < 0.88) {
          // (street r5) milled + repaved section spanning 2-3 lanes (ref 16's big dark rectangles)
          const nl = 2 + Math.floor(rnd() * 2),
            l0 = Math.floor(rnd() * (7 - nl)),
            L = 7 + rnd() * 9,
            /* (night r9) 7-23 -> 7-16 m */ z =
              zA + rnd() * Math.max(1, zB - zA - L);
          x0 = a - G.AV_HALF + 0.5 + l0 * 3.5;
          x1 = x0 + nl * 3.5;
          z0 = z;
          z1 = z + L;
        } else {
          // transverse trench across part of the roadway
          const side = rnd() < 0.5 ? -1 : 1,
            w = 5 + rnd() * 5,
            h = 0.9 + rnd() * 0.8,
            z = zA + rnd() * (zB - zA - h);
          x0 = side < 0 ? a - G.AV_HALF + 0.3 : a + G.AV_HALF - 0.3 - w;
          x1 = x0 + w;
          z0 = z;
          z1 = z + h;
        }
        x0 = Math.max(x0, a - G.AV_HALF + 0.2);
        x1 = Math.min(x1, a + G.AV_HALF - 0.2);
        if (x1 - x0 < 0.5 || z1 <= z0) continue;
        if (x1 > V.x0 && x0 < V.x1 && z1 > V.z0 && z0 < V.z1) continue;
        let cell = Math.floor(rnd() * 4);
        // (night r9) long lane strips / milled sections: mostly older, lighter patches (cells 1 / 3) so their straight edges read as a repair, not a cast shadow
        if (
          (kind < 0.5 || (kind >= 0.8 && kind < 0.88)) &&
          !(cell & 1) &&
          Math.abs(Math.sin(x0 * 12.9898 + z0 * 78.233) * 43758.5453) % 1 < 0.65
        )
          cell++;
        add(x0, z0, x1, z1, cell, z1 - z0 > x1 - x0);
      }
    }
  }
  // streets: fewer, mostly square cuts and short trenches toward the curb
  for (let k = 0; k < streets.length; k++) {
    const z = streets[k];
    for (let c = 0; c < 2 * avenues.length + 1; c += 2) {
      const sg = stRange(k, c);
      if (!sg) continue;
      const [xA, xB] = sg;
      if (xB - xA < 30 || rnd() < 0.15) continue;
      for (let j = 0, m = 2 + Math.floor(rnd() * 3); j < m; j++) {
        const w = 1.5 + rnd() * 6,
          h = 1.0 + rnd() * 2.8,
          x = xA + 8 + rnd() * (xB - xA - 16 - w),
          zz = z - stHalf(k) + 0.3 + rnd() * (2 * stHalf(k) - 0.6 - h);
        add(x, zz, x + w, zz + h, Math.floor(rnd() * 4), false);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      new Array(v).fill(0).flatMap(() => [0, 1, 0]),
      3,
    ),
  );
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(new THREE.Uint32BufferAttribute(I, 1));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({
    map: patchAtlas(),
    transparent: true,
    depthWrite: false,
    roughness: 0.8,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "roadPatches";
  mesh.receiveShadow = true;
  mesh.renderOrder = 0;
  scene.add(mesh);
  return mesh;
}

// ------------------------------------------------------------------------------------------------------------------
// (street r2) road + sidewalk grime pass: manhole covers, steel road plates, catch-basin grates, idling-car oil stains
// before the stop lines, oil-drip bands down the travel lanes, tar-snake crack sealant, gutter grime along every curb,
// contact-shadow (AO) strips on the sidewalk at every building base, sidewalk stains. One decal mesh, one 4x4 atlas.
const GC = {
  MH_A: 0,
  MH_B: 1,
  PLATE: 2,
  GRATE: 3,
  OIL_A: 4,
  OIL_B: 5,
  TAR_A: 6,
  TAR_B: 7,
  DRIP: 8,
  GUTTER: 9,
  AO: 10,
  STAIN: 11,
  BLOT: 12,
};
function grimeAtlas() {
  const S = 256,
    N = 4,
    cv = document.createElement("canvas");
  cv.width = cv.height = S * N;
  const g = cv.getContext("2d");
  const rnd = mulberry32(4711);
  const cell = (k, fn) => {
    g.save();
    g.translate((k % N) * S, Math.floor(k / N) * S);
    g.beginPath();
    g.rect(0, 0, S, S);
    g.clip();
    fn();
    g.restore();
  };
  const speck = (n, a0, a1, light = 0.5, x0 = 0, y0 = 0, w = S, h = S) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * w,
        y = y0 + rnd() * h,
        r = 0.6 + rnd() * 1.8;
      g.fillStyle =
        rnd() < light
          ? `rgba(150,145,138,${a0 + rnd() * (a1 - a0)})`
          : `rgba(8,8,9,${a0 + rnd() * (a1 - a0)})`;
      g.fillRect(x, y, r, r);
    }
  };
  const blotch = (x, y, r, a, col = "10,10,12") => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${col},${a})`);
    gr.addColorStop(0.6, `rgba(${col},${a * 0.5})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  };
  // manhole covers: cast iron disc, worn bright raised pattern, rusty rim, tar seal ring
  for (const [k, radial] of [
    [GC.MH_A, false],
    [GC.MH_B, true],
  ])
    cell(k, () => {
      const c = S / 2;
      g.fillStyle = "rgba(12,12,13,0.55)";
      g.beginPath();
      g.arc(c, c, 124, 0, 7);
      g.fill();
      g.fillStyle = "rgba(52,48,44,0.97)";
      g.beginPath();
      g.arc(c, c, 112, 0, 7);
      g.fill();
      g.strokeStyle = "rgba(96,74,52,0.9)";
      g.lineWidth = 7;
      g.beginPath();
      g.arc(c, c, 109, 0, 7);
      g.stroke();
      g.save();
      g.beginPath();
      g.arc(c, c, 100, 0, 7);
      g.clip();
      g.strokeStyle = "rgba(120,116,108,0.75)";
      g.lineWidth = 3;
      if (radial) {
        for (let r = 22; r < 100; r += 17) {
          g.beginPath();
          g.arc(c, c, r, 0, 7);
          g.stroke();
        }
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          g.beginPath();
          g.moveTo(c + Math.cos(a) * 22, c + Math.sin(a) * 22);
          g.lineTo(c + Math.cos(a) * 100, c + Math.sin(a) * 100);
          g.stroke();
        }
        g.fillStyle = "rgba(40,38,35,0.95)";
        g.fillRect(c - 60, c - 12, 120, 24);
        g.fillStyle = "rgba(130,125,115,0.7)";
        for (let i = 0; i < 9; i++) g.fillRect(c - 54 + i * 12.5, c - 7, 8, 14);
      } else {
        for (let x = -100; x < 100; x += 13)
          for (let y = -100; y < 100; y += 13)
            if ((x / 13 + y / 13) % 2 === 0) {
              g.fillStyle = `rgba(118,114,106,${0.45 + rnd() * 0.3})`;
              g.fillRect(c + x, c + y, 9, 9);
            }
      }
      blotch(
        c + (rnd() - 0.5) * 80,
        c + (rnd() - 0.5) * 80,
        70,
        0.35,
        "70,48,30",
      );
      speck(500, 0.1, 0.3, 0.4);
      g.restore();
    });
  // steel road plate: diamond tread, dark worn edges, rust
  cell(GC.PLATE, () => {
    g.fillStyle = "rgba(58,56,53,0.96)";
    g.fillRect(6, 6, S - 12, S - 12);
    g.strokeStyle = "rgba(105,100,92,0.55)";
    g.lineWidth = 2;
    for (let y = 10; y < S - 10; y += 10)
      for (let x = 10 + (y % 20 ? 5 : 0); x < S - 10; x += 10) {
        g.beginPath();
        g.moveTo(x - 3, y - 3);
        g.lineTo(x + 3, y + 3);
        g.stroke();
      }
    for (let i = 0; i < 5; i++)
      blotch(
        20 + rnd() * 216,
        20 + rnd() * 216,
        30 + rnd() * 50,
        0.35,
        "92,58,32",
      );
    g.strokeStyle = "rgba(15,15,16,0.85)";
    g.lineWidth = 6;
    g.strokeRect(6, 6, S - 12, S - 12);
    speck(600, 0.1, 0.3);
  });
  // catch-basin grate (curb inlet): bars in a frame
  cell(GC.GRATE, () => {
    g.fillStyle = "rgba(30,29,28,0.97)";
    g.fillRect(10, 60, S - 20, S - 120);
    g.fillStyle = "rgba(5,5,6,0.95)";
    for (let x = 26; x < S - 26; x += 16) g.fillRect(x, 74, 8, S - 148);
    g.strokeStyle = "rgba(88,80,70,0.8)";
    g.lineWidth = 6;
    g.strokeRect(12, 62, S - 24, S - 124);
    blotch(S / 2, S / 2, 120, 0.3);
  });
  // oil stains
  cell(GC.OIL_A, () => {
    for (let i = 0; i < 14; i++)
      blotch(
        128 + (rnd() - 0.5) * 120,
        128 + (rnd() - 0.5) * 170,
        18 + rnd() * 45,
        0.16 + rnd() * 0.14,
      );
    speck(300, 0.05, 0.15, 0.2, 40, 30, 176, 196);
  });
  cell(GC.OIL_B, () => {
    for (let i = 0; i < 26; i++)
      blotch(
        30 + rnd() * 196,
        30 + rnd() * 196,
        6 + rnd() * 22,
        0.18 + rnd() * 0.2,
      );
  });
  // tar snakes (crack sealant): meandering glossy black bands
  for (const k of [GC.TAR_A, GC.TAR_B])
    cell(k, () => {
      g.strokeStyle = "rgba(6,6,7,0.62)";
      g.lineCap = "round";
      g.lineJoin = "round";
      const n = k === GC.TAR_A ? 2 : 5;
      for (let j = 0; j < n; j++) {
        let x = rnd() * S,
          y = 0,
          a = Math.PI / 2 + (rnd() - 0.5) * 0.6;
        g.lineWidth = 4 + rnd() * 4;
        g.beginPath();
        g.moveTo(x, y);
        if (k === GC.TAR_B) {
          x = rnd() * S;
          y = rnd() * S;
          g.moveTo(x, y);
          a = rnd() * 7;
        }
        for (let i = 0; i < 40; i++) {
          a += (rnd() - 0.5) * 0.7;
          x += Math.cos(a) * 8;
          y += Math.sin(a) * 8;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    });
  // oil-drip band down a lane (v along the lane): dark centre streak with drips, fading to both ends
  cell(GC.DRIP, () => {
    const gr = g.createLinearGradient(0, 0, S, 0);
    gr.addColorStop(0, "rgba(10,10,12,0)");
    gr.addColorStop(0.3, "rgba(10,10,12,0.1)");
    gr.addColorStop(0.5, "rgba(10,10,12,0.22)");
    gr.addColorStop(0.7, "rgba(10,10,12,0.1)");
    gr.addColorStop(1, "rgba(10,10,12,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++)
      blotch(
        S / 2 + (rnd() - 0.5) * 70,
        rnd() * S,
        3 + rnd() * 9,
        0.15 + rnd() * 0.2,
      );
    // tyre polish either side (slightly lighter, smoother)
    for (const x of [S * 0.12, S * 0.88]) {
      const g2 = g.createLinearGradient(x - 20, 0, x + 20, 0);
      g2.addColorStop(0, "rgba(120,120,122,0)");
      g2.addColorStop(0.5, "rgba(120,120,122,0.07)");
      g2.addColorStop(1, "rgba(120,120,122,0)");
      g.fillStyle = g2;
      g.fillRect(x - 20, 0, 40, S);
    }
    const fade = g.createLinearGradient(0, 0, 0, S);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(0.15, "rgba(0,0,0,0)");
    fade.addColorStop(0.85, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = fade;
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = "source-over";
  });
  // gutter grime (u = 0 at the curb): dark wet band, leaves / litter specks, soft outer edge
  cell(GC.GUTTER, () => {
    const gr = g.createLinearGradient(0, 0, S, 0);
    gr.addColorStop(0, "rgba(14,13,12,0.5)");
    gr.addColorStop(0.25, "rgba(14,13,12,0.32)");
    gr.addColorStop(0.7, "rgba(14,13,12,0.08)");
    gr.addColorStop(1, "rgba(14,13,12,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 40; i++)
      blotch(rnd() * S * 0.5, rnd() * S, 8 + rnd() * 24, 0.12 + rnd() * 0.12);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * S * 0.35,
        y = rnd() * S;
      g.fillStyle =
        rnd() < 0.5
          ? `rgba(${110 + rnd() * 40},${80 + rnd() * 30},${40 + rnd() * 20},0.5)`
          : `rgba(170,165,155,${0.2 + rnd() * 0.3})`;
      g.fillRect(x, y, 1 + rnd() * 3, 1 + rnd() * 3);
    }
  });
  // contact shadow / splash grime at a building base (u = 0 at the wall)
  cell(GC.AO, () => {
    const gr = g.createLinearGradient(0, 0, S, 0);
    gr.addColorStop(0, "rgba(10,9,8,0.62)");
    gr.addColorStop(0.12, "rgba(10,9,8,0.4)");
    gr.addColorStop(0.45, "rgba(10,9,8,0.12)");
    gr.addColorStop(1, "rgba(10,9,8,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 30; i++)
      blotch(rnd() * S * 0.25, rnd() * S, 6 + rnd() * 18, 0.1);
  });
  // sidewalk stains: gum dots, drip blotches, dark wet patch
  cell(GC.STAIN, () => {
    for (let i = 0; i < 10; i++)
      blotch(
        30 + rnd() * 196,
        30 + rnd() * 196,
        15 + rnd() * 40,
        0.08 + rnd() * 0.08,
      );
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(20,20,20,${0.25 + rnd() * 0.3})`;
      g.beginPath();
      g.arc(rnd() * S, rnd() * S, 1 + rnd() * 2, 0, 7);
      g.fill();
    }
  });
  cell(GC.BLOT, () => {
    for (let i = 0; i < 8; i++)
      blotch(
        64 + rnd() * 128,
        64 + rnd() * 128,
        30 + rnd() * 60,
        0.1 + rnd() * 0.08,
        "22,20,18",
      );
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export const MANHOLES = []; // (street r7) road manhole positions (props.js puts steam on some of them)
export function buildStreetGrime({ scene, buildings = null }) {
  MANHOLES.length = 0;
  const rnd = mulberry32(31337);
  const P = [],
    UV = [],
    I = [];
  let v = 0;
  const E = 1 / 256; // half-texel-ish inset (4x4 atlas of 256 px cells on 1024)
  // quad centred (x, z), half extents along the local axes: `ax` = unit direction of the texture's v axis (x, z)
  const add = (cellId, x, z, hu, hv, ax = [0, -1], y = 0.01) => {
    const u0 = (cellId % 4) / 4 + E,
      v0 = 1 - (Math.floor(cellId / 4) + 1) / 4 + E,
      d = 0.25 - 2 * E;
    const [vx, vz] = ax,
      ux = -vz,
      uz = vx;
    const c = [
      [-hu, -hv],
      [hu, -hv],
      [hu, hv],
      [-hu, hv],
    ];
    const uv = [
      [u0, v0],
      [u0 + d, v0],
      [u0 + d, v0 + d],
      [u0, v0 + d],
    ];
    for (let k = 0; k < 4; k++) {
      P.push(
        x + ux * c[k][0] + vx * c[k][1],
        y,
        z + uz * c[k][0] + vz * c[k][1],
      );
      UV.push(...uv[k]);
    }
    // winding: keep the face up
    I.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  };
  const V = PARK_VIADUCT;
  const inVia = (x, z) =>
    x > V.x0 - 0.5 && x < V.x1 + 0.5 && z > V.z0 - 0.5 && z < V.z1 + 0.5;
  const roadOk = (x, z) => {
    const t = streetsAt(x, z).type;
    return (
      (t === "avenue" || t === "street" || t === "intersection") && !inVia(x, z)
    );
  };
  const chain = (
    cellId,
    x,
    z0,
    z1,
    hu,
    seg,
    ax = [0, -1],
    gap = 0.3,
    y = 0.01,
  ) => {
    // strip of quads along z
    for (let z = z0; z < z1 - 2; ) {
      const L = Math.min(seg * (0.7 + rnd() * 0.6), z1 - z);
      if (rnd() > gap && roadOk(x, z + L / 2))
        add(cellId, x, z + L / 2, hu, L / 2, ax, y);
      z += L + rnd() * 3;
    }
  };
  // ---- avenues
  for (let i = 0; i < avenues.length; i++) {
    const a = avenues[i];
    for (let k = 0; k + 1 < streets.length; k++) {
      if (!avActive(i, k)) continue;
      const zA = streets[k] + stHalf(k) + 1.5,
        zB = streets[k + 1] - stHalf(k + 1) - 1.5;
      if (zB - zA < 10) continue;
      // oil-drip bands down the 4 travel lanes (+ a fainter one in the parking lanes)
      for (const s of [-1, 1])
        for (let l = 0; l < 3; l++) {
          const x =
            a + s * (0.2 + G.AV_LANE * l + G.AV_LANE / 2) + (rnd() - 0.5) * 0.3;
          chain(
            GC.DRIP,
            x,
            zA + 2,
            zB - 2,
            l === 2 ? 0.7 : 0.8,
            11,
            [0, -1],
            l === 2 ? 0.55 : 0.3,
          ); // (night r9) critic: a 2.3 m band running to the camera read as a long shadow: narrower (1.15 -> 0.8), shorter, broken
          // idling stains before both stop lines
          if (l < 2)
            for (const [z0, dir] of [
              [zA + 3, 1],
              [zB - 3, -1],
            ])
              if (rnd() < 0.75) {
                const z = z0 + dir * (1.5 + rnd() * 4);
                add(
                  rnd() < 0.5 ? GC.OIL_A : GC.OIL_B,
                  x + (rnd() - 0.5) * 0.4,
                  z,
                  0.9 + rnd() * 0.4,
                  1.6 + rnd() * 0.8,
                );
              }
        }
      // gutter grime along both curbs
      for (const s of [-1, 1]) {
        const x = a + s * (G.AV_HALF - 0.4);
        chain(GC.GUTTER, x, zA - 1, zB + 1, 0.4, 16, [0, s], 0.05, 0.0095);
        // catch basins by the corners
        for (const z of [zA + 1.5, zB - 1.5])
          if (rnd() < 0.7)
            add(
              GC.GRATE,
              a + s * (G.AV_HALF - 0.35),
              z,
              0.5,
              0.35,
              [s, 0],
              0.011,
            );
      }
      // manholes, steel plates, tar snakes
      const n = 2 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const x = a + (rnd() - 0.5) * 16,
          z = zA + 4 + rnd() * (zB - zA - 8);
        if (roadOk(x, z)) {
          add(
            rnd() < 0.6 ? GC.MH_A : GC.MH_B,
            x,
            z,
            0.48,
            0.48,
            [Math.cos(j), Math.sin(j)],
            0.0105,
          );
          MANHOLES.push([x, z]);
        }
      }
      if (rnd() < 0.3) {
        const x = a + (rnd() - 0.5) * 12,
          z = zA + 6 + rnd() * (zB - zA - 12);
        if (roadOk(x, z))
          add(GC.PLATE, x, z, 1.2, 0.8 + rnd() * 0.6, [0, -1], 0.0105);
      }
      // (street r4) crosswalk scuffs: tyre-worn grime bands across the zebra bars in the travel lanes (drawn above the
      // markings, y 0.013 > 0.012) so the crossings are not pristine white
      for (const zc of [
        streets[k] + stHalf(k) + 2.3,
        streets[k + 1] - stHalf(k + 1) - 2.3,
      ])
        for (const s2 of [-1, 1])
          for (let l = 0; l < 3; l++) {
            if (rnd() < 0.3) continue;
            const x =
              a +
              s2 * (0.2 + G.AV_LANE * l + G.AV_LANE / 2) +
              (rnd() - 0.5) * 0.4;
            if (roadOk(x, zc))
              add(GC.DRIP, x, zc, 1.1 + rnd() * 0.3, 2.4, [0, -1], 0.013);
          }
      for (let j = 0, m = 1 + Math.floor(rnd() * 3); j < m; j++) {
        const x = a + (rnd() - 0.5) * 18,
          z = zA + 5 + rnd() * (zB - zA - 10);
        if (roadOk(x, z))
          add(
            rnd() < 0.5 ? GC.TAR_A : GC.TAR_B,
            x,
            z,
            2 + rnd() * 2,
            3 + rnd() * 4,
            rnd() < 0.5 ? [0, -1] : [1, 0],
          );
      }
    }
  }
  // ---- streets (x-running): centre drip band, curb gutters, a manhole, idling stains at the avenue ends
  for (let k = 0; k < streets.length; k++) {
    const z = streets[k];
    for (let c = 0; c < 2 * avenues.length + 1; c += 2) {
      const sg = stRange(k, c);
      if (!sg) continue;
      const [xA0, xB0] = sg,
        xA = xA0 + 1.5,
        xB = xB0 - 1.5;
      if (xB - xA < 12) continue;
      for (let x = xA + 2; x < xB - 2; ) {
        const L = Math.min(18 * (0.7 + rnd() * 0.6), xB - x);
        if (rnd() > 0.15 && roadOk(x + L / 2, z))
          add(GC.DRIP, x + L / 2, z + (rnd() - 0.5) * 0.4, 1.1, L / 2, [1, 0]);
        for (const s of [-1, 1])
          if (rnd() > 0.05 && roadOk(x + L / 2, z + s * (stHalf(k) - 0.4)))
            add(
              GC.GUTTER,
              x + L / 2,
              z + s * (stHalf(k) - 0.4),
              0.4,
              L / 2,
              [-s, 0],
              0.0095,
            );
        x += L + rnd() * 2;
      }
      for (const [x0, dir] of [
        [xA + 2, 1],
        [xB - 2, -1],
      ])
        if (rnd() < 0.6)
          add(
            rnd() < 0.5 ? GC.OIL_A : GC.OIL_B,
            x0 + dir * (2 + rnd() * 4),
            z + (rnd() - 0.5),
            1.6 + rnd() * 0.8,
            0.9 + rnd() * 0.3,
            [1, 0],
          );
      if (rnd() < 0.8) {
        const x = xA + 6 + rnd() * (xB - xA - 12),
          zz = z + (rnd() - 0.5) * 4;
        if (roadOk(x, zz)) {
          add(
            rnd() < 0.5 ? GC.MH_A : GC.MH_B,
            x,
            zz,
            0.48,
            0.48,
            [0, -1],
            0.0105,
          );
          MANHOLES.push([x, zz]);
        }
      }
      if (rnd() < 0.35) {
        const x = xA + 6 + rnd() * (xB - xA - 12);
        if (roadOk(x, z))
          add(GC.TAR_B, x, z + (rnd() - 0.5) * 3, 2.5, 4, [1, 0]);
      }
    }
  }
  // ---- (street r4) intersection boxes: broad tyre-polish / oil blotches where turning traffic idles (ref 16)
  for (let i = 0; i < avenues.length; i++)
    for (let k = 0; k < streets.length; k++) {
      const a = avenues[i],
        z = streets[k];
      if (streetsAt(a, z).type !== "intersection") continue;
      for (let j = 0, m = 3 + Math.floor(rnd() * 4); j < m; j++) {
        const x = a + (rnd() - 0.5) * (G.AV_HALF * 1.6),
          zz = z + (rnd() - 0.5) * (stHalf(k) * 1.4);
        if (!roadOk(x, zz)) continue;
        const r = 1.6 + rnd() * 2.2,
          ang = rnd() * 6.28;
        add(
          rnd() < 0.6 ? GC.BLOT : GC.OIL_A,
          x,
          zz,
          r,
          r * (0.7 + rnd() * 0.5),
          [Math.cos(ang), Math.sin(ang)],
          0.0102,
        );
      }
    }
  // ---- sidewalks: contact-shadow strip along the base of every street-facing ground mass + stains
  const walkY = G.CURB_H + 0.006;
  const onWalk = (x, z) => streetsAt(x, z).type === "sidewalk";
  if (buildings)
    for (const b of buildings)
      for (const m of b.masses || []) {
        if (m.y0 > 0.2) continue;
        const sides = [
          [m.x0, m.z0, m.x0, m.z1, -1, 0],
          [m.x1, m.z0, m.x1, m.z1, 1, 0],
          [m.x0, m.z0, m.x1, m.z0, 0, -1],
          [m.x0, m.z1, m.x1, m.z1, 0, 1],
        ];
        for (const [ax0, az0, ax1, az1, nx, nz] of sides) {
          const L = Math.hypot(ax1 - ax0, az1 - az0);
          if (L < 2) continue;
          const n = Math.max(1, Math.round(L / 12)),
            sl = L / n,
            tx = (ax1 - ax0) / L,
            tz = (az1 - az0) / L;
          for (let j = 0; j < n; j++) {
            const cx = ax0 + tx * sl * (j + 0.5),
              cz = az0 + tz * sl * (j + 0.5);
            if (!onWalk(cx + nx * 0.6, cz + nz * 0.6)) continue;
            // texture u = 0 at the wall, u axis = outward normal (u = (-vz, vx) => v = (nz, -nx))
            add(
              GC.AO,
              cx + nx * 0.55,
              cz + nz * 0.55,
              0.55,
              sl / 2 + 0.02,
              [nz, -nx],
              walkY,
            );
            if (rnd() < 0.18)
              add(
                GC.STAIN,
                cx + nx * (1.2 + rnd() * 1.6),
                cz + nz * (1.2 + rnd() * 1.6),
                1.2,
                1.2,
                [tx, tz],
                walkY + 0.001,
              );
            else if (rnd() < 0.12)
              add(
                GC.BLOT,
                cx + nx * (1.5 + rnd() * 1.5),
                cz + nz * (1.5 + rnd() * 1.5),
                1.5,
                1.5,
                [tx, tz],
                walkY + 0.001,
              );
          }
        }
      }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      new Float32Array(v * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(new THREE.Uint32BufferAttribute(I, 1));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({
    map: grimeAtlas(),
    transparent: true,
    depthWrite: false,
    roughness: 0.78,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "streetGrime";
  mesh.receiveShadow = true;
  mesh.renderOrder = 0;
  scene.add(mesh);
  return mesh;
}

// ------------------------------------------------------------------------------------------------------------------
// (street r3) tower forecourt plazas (buildings.js 'plaza' / 'slab' forms set the tower back 5-16 m from the street):
// critic: 'the corner plaza is a flat checkerboard tile with visible repetition, token planters, no people'.
// plazaStrips(buildings) -> [{x0,z0,x1,z1, nx,nz (outward = toward the street), L, W}] forecourt rects inside the lot;
// buildPlazaPaving() lays a granite-slab paving (running bond, per-slab tone, joints, grime) over them.
export function plazaStrips(buildings) {
  const out = [];
  if (!buildings) return out;
  for (const b of buildings) {
    const lot = b.lot;
    if (!lot || !lot.sides) continue;
    const gm = (b.masses || []).filter((m) => m.y0 < 0.2);
    if (!gm.length) continue;
    const m = {
      x0: Math.min(...gm.map((q) => q.x0)),
      x1: Math.max(...gm.map((q) => q.x1)),
      z0: Math.min(...gm.map((q) => q.z0)),
      z1: Math.max(...gm.map((q) => q.z1)),
    };
    const cand = [
      ["nx", lot.x0, lot.z0, m.x0, lot.z1, -1, 0],
      ["px", m.x1, lot.z0, lot.x1, lot.z1, 1, 0],
      ["nz", lot.x0, lot.z0, lot.x1, m.z0, 0, -1],
      ["pz", lot.x0, m.z1, lot.x1, lot.z1, 0, 1],
    ];
    for (const [s, x0, z0, x1, z1, nx, nz] of cand) {
      if (lot.sides[s] !== "street") continue;
      const W = nx ? x1 - x0 : z1 - z0,
        L = nx ? z1 - z0 : x1 - x0;
      if (W < 4.5 || L < 10) continue;
      if (
        Math.abs((x0 + x1) / 2) < 110 &&
        (z0 + z1) / 2 > -335 &&
        (z0 + z1) / 2 < 10
      )
        continue; // Times Square (own paving)
      out.push({ x0, z0, x1, z1, nx, nz, W, L });
    }
  }
  return out;
}
function pavingTexture() {
  const S = 1024,
    cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d"),
    rnd = mulberry32(3131);
  // 8 m x 8 m tile: 1.6 x 0.8 m granite slabs in running bond (128 px / m)
  g.fillStyle = "#6d6a64";
  g.fillRect(0, 0, S, S);
  const PX = S / 8,
    sw = 1.6 * PX,
    sh = 0.8 * PX;
  for (let r = 0; r < 10; r++)
    for (let c = -1; c < 6; c++) {
      const x = c * sw + ((r % 2) * sw) / 2,
        y = r * sh;
      const base = 136 + (rnd() - 0.5) * 30,
        warm = (rnd() - 0.5) * 10,
        dark = rnd() < 0.08 ? 0.78 : 1;
      const R = (base + warm) * dark,
        Gc = (base + warm * 0.4) * dark,
        B = (base - warm * 0.6 - 4) * dark;
      const draw = (ox) => {
        g.fillStyle = `rgb(${R | 0},${Gc | 0},${B | 0})`;
        g.fillRect(x + ox + 2, y + 2, sw - 4, sh - 4);
      };
      draw(0);
      draw(S);
      draw(-S);
    }
  // flecks (granite), wear, gum spots, grime blotches
  for (let i = 0; i < 26000; i++) {
    const v = rnd() < 0.5 ? 40 : 220;
    g.fillStyle = `rgba(${v},${v},${v},${0.05 + rnd() * 0.08})`;
    g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(35,33,30,${0.25 + rnd() * 0.3})`;
    const r = 1.5 + rnd() * 3;
    g.beginPath();
    g.arc(rnd() * S, rnd() * S, r, 0, 7);
    g.fill();
  }
  for (let i = 0; i < 22; i++) {
    const x = rnd() * S,
      y = rnd() * S,
      r = 40 + rnd() * 140,
      gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, `rgba(40,36,30,${0.1 + rnd() * 0.12})`);
    gr.addColorStop(1, "rgba(40,36,30,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export function buildPlazaPaving({ scene, strips }) {
  if (!strips.length) return null;
  const P = [],
    UV = [],
    I = [];
  let v = 0;
  const y = G.CURB_H + 0.004;
  // (zfix) a corner lot's two frontage strips (and a Grand Central forecourt) overlap at the lot corner: both slabs were
  // drawn at the same height with differently rotated slab patterns -> z-fight. Each strip now paves only the part not
  // already paved by an earlier strip (axis-aligned rect difference).
  const done = [];
  const minus = (r, q) => {
    // r - q -> up to 4 rects
    if (q.x0 >= r.x1 || q.x1 <= r.x0 || q.z0 >= r.z1 || q.z1 <= r.z0)
      return [r];
    const out = [];
    if (q.z0 > r.z0) out.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: q.z0 });
    if (q.z1 < r.z1) out.push({ x0: r.x0, x1: r.x1, z0: q.z1, z1: r.z1 });
    const z0 = Math.max(r.z0, q.z0),
      z1 = Math.min(r.z1, q.z1);
    if (q.x0 > r.x0) out.push({ x0: r.x0, x1: q.x0, z0, z1 });
    if (q.x1 < r.x1) out.push({ x0: q.x1, x1: r.x1, z0, z1 });
    return out;
  };
  for (const s of strips) {
    let pieces = [{ x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1 }];
    if (ZFIX) for (const q of done) pieces = pieces.flatMap((r) => minus(r, q));
    done.push(s);
    const rot = s.nx !== 0; // slabs run along the frontage
    for (const r of pieces) {
      if (r.x1 - r.x0 < 0.01 || r.z1 - r.z0 < 0.01) continue;
      const c = [
        [r.x0, r.z1],
        [r.x1, r.z1],
        [r.x1, r.z0],
        [r.x0, r.z0],
      ];
      for (const [x, z] of c) {
        P.push(x, y, z);
        UV.push(rot ? z / 8 : x / 8, rot ? -x / 8 : -z / 8);
      }
      I.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      new Float32Array(v * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(new THREE.Uint32BufferAttribute(I, 1));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({
    map: pavingTexture(),
    roughness: 0.86,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "plazaPaving";
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
