// @ts-nocheck
import { lazyShaderSections } from "../shaderSections.ts";
import facadeShaderSource from "./shaders/glsl/facade.glsl?raw";
import { injectShader } from "../render/shaderInjection.ts";
import facadeVertexDeclarations from "./shaders/vertex/facade-vert_decl.vert?raw";
import facadeVertexMain from "./shaders/vertex/facade-vert_main.vert?raw";
import facadeFragmentShaderDeclarations from "./shaders/fragment/facade-frag_decl.frag?raw";
// Facade material + merged-geometry builder for all building masses.
// One MeshStandardMaterial (extended via onBeforeCompile) draws every wall / roof / trim of a tile in ONE draw call.
// Per-vertex attributes carry the facade parameters; the fragment shader generates windows procedurally with
//  - parallax window reveals (real-looking recess depth),
//  - interior mapping (fake rooms with back-wall atlas, floor, ceiling lights, blinds),
//  - reflective glass (low roughness / curtain-wall metalness so scene.environment reflections apply),
//  - ground-floor storefronts (piers, lit shop interiors, signage band from atlas, roll-down shutters),
//  - sills / lintels / belt courses / rain streaks, distance-based anti-aliasing to average colour.
import { nightK, dnTime } from "../render/daynight.ts"; // (daynight)
import {
  glassMirrorShared,
  GLSL_GLASS_MIRROR_DECL,
} from "../render/glassmirror.ts"; // (render r-refl) player / web / near peds in the glass
import * as THREE from "three";
import { cityLights } from "../render/citylights.ts";

const facadeShader = lazyShaderSections(() => facadeShaderSource);
// (night) shop fronts light the sidewalk

export const STYLE = {
  BLANK: 0,
  PUNCHED: 1,
  CURTAIN: 2,
  RIBBON: 3,
  DECO: 4,
  PARTY: 5,
  ARCH: 6,
}; // ARCH: Chrysler-like crown tier (skyline)
export const LAYER = {
  RED: 0,
  BROWN: 1,
  BUFF: 2,
  LIME: 3,
  CONCRETE: 4,
  METAL: 5,
  GRANITE: 6,
  WHITE: 7,
  ROOF: 8,
  ROOF_GRAVEL: 9,
  ROOF_MEMBRANE: 10,
  ROOF_PAVERS: 11,
  ROOF_GREEN: 12,
  TERRA: 13,
  STUCCO: 14,
  RED2: 15,
}; // (textures r2) 13-15: terracotta, stucco, 2nd red brick (hao layer 16 = grime/leak decal sheet)

// (skyline r5) growable typed-array store: the city's facade builders hold ~2 M vertices x 27 attributes while the city
// is generated; plain JS number arrays cost 2-3x the memory (8-byte doubles + growth slack) and pushed the page's heap
// past Chromium's limit (renderer OOM crashes). Same push() API as an Array.
class GrowBuf {
  constructor(T = Float32Array, n = 2048) {
    this.T = T;
    this.a = new T(n);
    this.length = 0;
  }
  push(...v) {
    const L = this.length + v.length;
    if (L > this.a.length) {
      const b = new this.T(Math.max(this.a.length * 2, L));
      b.set(this.a.subarray(0, this.length));
      this.a = b;
    }
    for (let i = 0; i < v.length; i++) this.a[this.length + i] = v[i];
    this.length = L;
  }
  take() {
    return this.a.slice(0, this.length);
  }
}
// (night) every storefront frontage (facade shader 'storefront zone') is a real warm rect light facing the street
// (cityLights.ts), so lit shops light the sidewalk, people and parked cars. One rect per frontage spanning its open
// (unshuttered, not closed-for-the-night) bays, radiance x their share; same per-bay hash as the shader (fh1 in float32).
const f32 = Math.fround,
  fr = (x) => f32(x - Math.floor(x));
function fh1js(x, y) {
  let px = fr(f32(f32(x) * f32(123.34))),
    py = fr(f32(f32(y) * f32(456.21)));
  const d = f32(
    f32(px * f32(px + f32(45.32))) + f32(py * f32(py + f32(45.32))),
  );
  px = f32(px + d);
  py = f32(py + d);
  return fr(f32(px * py));
}
// (night) mirror of the shader's integer hash (nhu / nh3 / nh01)
const nhu = (x) => {
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
};
const nh3 = (a, b, c) =>
  nhu(
    (Math.imul(a >>> 0, 73856093) ^
      nhu(
        (Math.imul(b >>> 0, 19349663) ^
          nhu(Math.imul(c >>> 0, 83492791) >>> 0)) >>>
          0,
      )) >>>
      0,
  );
const nh01 = (h) => (h >>> 8) / 16777216;
const shopSeen = new Set();
export const SHOP_FRONTS = []; // (night) every storefront frontage (neon.ts places signs from it; same bays / hash as the shader)
export const SHOP_LIGHT = {
  radiance: 0.2,
  /* (night r10) 0.35: with the additive night GI the sidewalks overshot 2x (critic r9) */ range: 12,
  n: 0,
  pos: [],
  ids: [],
}; // pos / ids: debug (x, y, z per rect; city-light ids)
function registerShop(corner, T, W, N, p, gH) {
  if (gH < 3.2 || W < 2.5) return;
  const key = `${Math.round(corner[0] * 10)},${Math.round(corner[2] * 10)},${Math.round(T[0] * 100)},${Math.round(T[2] * 100)},${Math.round(W * 10)}`;
  if (shopSeen.has(key)) return;
  shopSeen.add(key);
  SHOP_FRONTS.push({
    corner,
    T,
    N,
    W,
    gH,
    baseY: p.baseY ?? 0,
    seed: p.seed ?? 0,
    resid: !!p.resid,
    topY: p.topY ?? 0,
  }); // (night) read-only frontage list for neon.ts
  const seed = f32(p.seed ?? 0),
    fw = f32(W);
  const nb = Math.max(1, Math.floor(W / 6.5 + 0.5)),
    bw = W / nb;
  let u0 = -1,
    u1 = -1,
    on = 0;
  for (let i = 0; i < nb; i++) {
    const rnd = fh1js(
      f32(i + f32(seed * f32(13.1))),
      f32(f32(seed * f32(7.7)) + fw),
    );
    if (rnd >= 0.78 || fr(f32(rnd * f32(37.1))) < 0.2) continue; // shutter / closed
    if (u0 < 0) u0 = i * bw;
    u1 = (i + 1) * bw;
    on++;
  }
  if (!on) return;
  const span = u1 - u0,
    share = (on * bw) / span,
    uc = (u0 + u1) / 2;
  const y0 = (p.baseY ?? 0) + 0.55,
    y1 = (p.baseY ?? 0) + gH - 1.55;
  const h = y1 - y0;
  if (h < 1) return;
  SHOP_LIGHT.ids.push(
    cityLights.add({
      type: "rect",
      pos: [
        corner[0] + T[0] * uc + N[0] * 0.08,
        (y0 + y1) / 2,
        corner[2] + T[2] * uc + N[2] * 0.08,
      ],
      dir: N,
      u: T,
      width: span - 0.7,
      height: h,
      color: [1.0, 0.8, 0.6],
      intensity: SHOP_LIGHT.radiance * Math.min(1, share),
      range: SHOP_LIGHT.range,
      radius: 0.5,
      volume: 0.15,
    }),
  );
  SHOP_LIGHT.n++;
  SHOP_LIGHT.pos.push(
    Math.round(corner[0] + T[0] * uc),
    Math.round(((y0 + y1) / 2) * 10) / 10,
    Math.round(corner[2] + T[2] * uc),
  );
}
// (night) landmark crown floodlights, evaluated in the facade shader at every distance (the city-light grid only spans
// +-256 m around the camera): addCrownFlood(box {x0,z0,x1,z1}, y0 terrace, y1 top, color [r,g,b], gain, reach m)
const NFLOOD = 12;
const floodU = {
  uFl: { value: Array.from({ length: NFLOOD * 3 }, () => new THREE.Vector4()) },
  uFlBB: { value: new THREE.Vector4(0, 0, 0, 0) },
  uFlY: { value: new THREE.Vector2(1e9, 0) },
};
export function addCrownFlood(
  b,
  y0,
  y1,
  color,
  gain,
  reach = 10,
  pad = 1.2,
  streak = 0,
) {
  const n = floodU.uFlY.value.y;
  if (n >= NFLOOD) return;
  const V = floodU.uFl.value;
  V[n * 3].set(b.x0, b.z0, b.x1, b.z1);
  V[n * 3 + 1].set(y0, y1, reach, pad);
  V[n * 3 + 2].set(color[0] * gain, color[1] * gain, color[2] * gain, streak);
  const B = floodU.uFlBB.value;
  if (!n) B.set(b.x0 - pad, b.z0 - pad, b.x1 + pad, b.z1 + pad);
  else
    B.set(
      Math.min(B.x, b.x0 - pad),
      Math.min(B.y, b.z0 - pad),
      Math.max(B.z, b.x1 + pad),
      Math.max(B.w, b.z1 + pad),
    );
  floodU.uFlY.value.set(Math.min(floodU.uFlY.value.x, y0), n + 1);
}
// (night) LIGHT FROM INSIDE THE BUILDINGS (user: 'light coming from inside buildings doesn't illuminate external
// objects'). Every window facade quad is recorded at build time (16 floats, 64 m buckets). A city-light provider picks
// the faces within WL.R of the camera and emits rect lights for their LIT windows with the same night window model as
// the facade shader (same per-floor / per-window hashes -> same lit windows, colours, brightness): near the camera one
// rect per run of adjacent lit windows on a floor (sills, fire escapes, AC units, the player on the wall, the facade
// across a narrow street get the light of the actual windows), further out one rect per 3-floor band carrying that
// band's mean window emission. Dark floors emit nothing. Candidate list rebuilt when the camera moves > 2.5 m; <= WL.max.
export const WL = {
  max: 320,
  R: 170,
  near: 38,
  K: 2.0 /* (night r10) 0.8: the light was far dimmer than the visible window (sills / reveals barely lit, critic r9) */,
  range: 11,
  faces: 0,
  emitted: 0,
  enabled: true,
};
const WF = new GrowBuf(Float32Array, 1 << 16),
  WB = new Map();
const WFN = 17;
function recordWinFace(corner, T, W, y0, y1, N, p, style, gH, uOff) {
  const i = WF.length / WFN;
  WF.push(
    corner[0],
    corner[2],
    T[0],
    T[2],
    W,
    y0,
    y1,
    p.floorH ?? 3.3,
    p.bayW ?? 2.4,
    p.winW ?? 0.5,
    p.winH ?? 0.55,
    p.margin ?? 0.6,
    p.seed ?? 0,
    style + 8 * (p.resid ? 1 : 0),
    Math.abs(gH),
    p.baseY ?? 0,
    (p.topY ?? 100) + 1e4 * uOff,
  );
  const cx = corner[0] + (T[0] * W) / 2,
    cz = corner[2] + (T[2] * W) / 2,
    k = (Math.floor(cx / 64) + 4096) * 8192 + Math.floor(cz / 64) + 4096;
  let b = WB.get(k);
  if (!b) WB.set(k, (b = []));
  b.push(i);
  WL.faces++;
}
// per-face cache: [bands] each { y0, y1, d? , band: [u0,u1,y,h,r,g,b] | null, runs: Float32Array(7 * n) }
const wCache = new Map();
const LIN = (r, g, b, o) => {
  o[0] = r;
  o[1] = g;
  o[2] = b;
  return o;
};
function faceBands(fi) {
  let c = wCache.get(fi);
  if (c) return c;
  const o = fi * WFN,
    A = WF.a;
  const W = A[o + 4],
    qy0 = A[o + 5],
    qy1 = A[o + 6],
    fh = A[o + 7],
    bayW = A[o + 8],
    winW = A[o + 9],
    winH = A[o + 10];
  const margin = A[o + 11],
    seed = f32(A[o + 12]),
    st = A[o + 13] % 8,
    resid = A[o + 13] >= 8,
    gH = A[o + 14],
    baseY = A[o + 15];
  const uOff = Math.round(A[o + 16] / 1e4),
    topYa = A[o + 16] - 1e4 * uOff;
  const curtain = st === 2,
    ribbon = st === 3,
    deco = st === 4,
    office = curtain || ribbon || deco;
  const usable = W - 2 * margin; // (the shader's u spans the whole face; chunks of one face share it via uOff)
  const nbAll = Math.max(1, Math.floor(usable / bayW + 0.5)),
    bw = usable / nbAll,
    ww = bw * winW,
    wh = fh * winH;
  const wy0 = (fh - wh) * (curtain ? 0.72 : 0.42),
    topY = topYa - baseY,
    maxYY = topY - gH - (curtain ? 0.2 : 1.2);
  const busy = 0.5 + fr(seed * 3.77 + 0.21),
    gdiv = 3 + Math.floor(fr(seed * 5.3) * 6);
  const fl0 = Math.max(0, Math.floor((qy0 - baseY - gH) / fh)),
    fl1 = Math.floor((qy1 - baseY - gH) / fh);
  const bands = [],
    col = [0, 0, 0];
  for (let b0 = fl0; b0 <= fl1; b0 += 3) {
    const runs = [];
    let sr = 0,
      sg = 0,
      sb = 0,
      nLit = 0,
      yb0 = 1e9,
      yb1 = -1e9;
    for (let fl = b0; fl < Math.min(b0 + 3, fl1 + 1); fl++) {
      const yyc = fl * fh + wy0 + wh / 2,
        yc = baseY + gH + yyc; // window centre
      if (yc < qy0 || yc >= qy1 || fl * fh + wy0 + wh > maxYY + 0.01 || yyc < 0)
        continue;
      yb0 = Math.min(yb0, yc - wh / 2);
      yb1 = Math.max(yb1, yc + wh / 2);
      const sdI = Math.floor(seed * 1000 + 0.5) >>> 0,
        flR = nh01(nh3(fl, sdI, 11));
      let pF = 0,
        pP = 0,
        full = false,
        part = false,
        fc = null,
        flB = 1,
        pwR = 0;
      if (office) {
        pF = (deco ? 0.42 : 0.36) * busy;
        pP = 0.18 * busy;
        full = flR <= pF;
        part = !full && flR <= pF + pP;
        const fq = fr(flR * 53.7),
          k = deco ? 1 : 0.7;
        fc =
          fq < 0.5
            ? [0.8, 0.92, 1]
            : fq < 0.84
              ? [1, 0.93, 0.8]
              : [1, 0.74, 0.48];
        fc = fc.map((v) => v * k);
        if (deco) fc = fc.map((v, j) => v + ([1, 0.9, 0.74][j] - v) * 0.35);
        flB = 0.55 + 0.45 * fr(flR * 29.3);
        if (!full && !part && busy < 2) {
          /* dark floor: only ~3 % strays */
        }
      } else pwR = 0.25 * busy * (0.6 + 0.8 * fr(flR * 3.3));
      let run = null;
      const flush = () => {
        if (run) {
          runs.push(run);
          run = null;
        }
      };
      for (let bi = 0; bi < nbAll; bi++) {
        const u = margin + (bi + 0.5) * bw - uOff; // centre in this quad's local u (the shader's u = local + uOff)
        if (u < 0 || u > W) {
          flush();
          continue;
        }
        const wR = nh01(nh3(bi, fl, sdI + 23)),
          wR2 = nh01(nh3(bi, fl, sdI + 57));
        let on = false;
        if (office) {
          const gR = nh01(nh3(Math.floor(bi / gdiv), fl, sdI + 91));
          on =
            wR <=
            (full
              ? gR < 0.18
                ? 0.1
                : 0.8
              : part
                ? gR <= 0.45
                  ? 0.85
                  : 0
                : 0.03);
          if (on) {
            const m = flB * (0.6 + 0.4 * wR2);
            LIN(fc[0] * m, fc[1] * m, fc[2] * m, col);
          }
        } else {
          on = wR <= pwR;
          if (on) {
            if (wR2 >= 0.9) LIN(0.42 * 0.4, 0.56 * 0.4, 0.4, col);
            else {
              const t = fr(wR2 * 7.9),
                m = 0.12 + 0.88 * Math.pow(fr(wR2 * 3.7), 1.4);
              LIN(m, (0.58 + 0.22 * t) * m, (0.28 + 0.28 * t) * m, col);
            }
          }
        }
        if (!on) {
          flush();
          continue;
        }
        sr += col[0];
        sg += col[1];
        sb += col[2];
        nLit++;
        if (run) {
          run[1] = u + ww / 2;
          run[4] += col[0];
          run[5] += col[1];
          run[6] += col[2];
          run[7]++;
        } else
          run = [u - ww / 2, u + ww / 2, yc, wh, col[0], col[1], col[2], 1];
      }
      flush();
    }
    if (!nLit) continue;
    // run rect radiance: mean window colour x glass share of the run; band: summed window emission over the band
    const R = new Float32Array(runs.length * 7);
    runs.forEach((r, j) => {
      const n = r[7],
        share = (n * ww) / Math.max(r[1] - r[0], ww);
      R.set(
        [
          r[0],
          r[1],
          r[2],
          r[3],
          (r[4] / n) * share,
          (r[5] / n) * share,
          (r[6] / n) * share,
        ],
        j * 7,
      );
    });
    const bh = Math.max(yb1 - yb0, wh),
      a = (ww * wh) / (usable * bh);
    bands.push({
      y: (yb0 + yb1) / 2,
      band: [margin, W - margin, (yb0 + yb1) / 2, bh, sr * a, sg * a, sb * a],
      runs: R,
    });
  }
  if (wCache.size > 30000) wCache.clear();
  wCache.set(fi, bands);
  return bands;
}
// candidate rects (rebuilt when the camera moves): flat pool of plain records, re-emitted every frame
const wPool = [],
  wCand = [];
let wN = 0,
  wCx = 1e9,
  wCy = 1e9,
  wCz = 1e9;
const wRec = (i) =>
  wPool[i] ||
  (wPool[i] = {
    type: "rect",
    pos: [0, 0, 0],
    dir: [0, 0, 1],
    u: [1, 0, 0],
    width: 1,
    height: 1,
    color: new THREE.Color(),
    intensity: 1,
    range: 10,
    radius: 0.4,
    volume: 0,
  });
function setRect(i, fo, u0, u1, y, h, r, g, b) {
  const A = WF.a,
    cx = A[fo],
    cz = A[fo + 1],
    tx = A[fo + 2],
    tz = A[fo + 3],
    uc = (u0 + u1) / 2,
    w = Math.max(0.3, u1 - u0);
  const nx = -tz,
    nz = tx; // outward normal (FacadeBuilder: the face seen from outside runs along T: N = (-T.z, T.x))
  const R = wRec(i);
  R.pos[0] = cx + tx * uc + nx * 0.05;
  R.pos[1] = y;
  R.pos[2] = cz + tz * uc + nz * 0.05; // (night) just outside the wall plane (the core culls fragments behind a rect: a rect at the recessed glass lit nothing); the reveal / sill get the shader's own term
  R.dir[0] = nx;
  R.dir[1] = 0;
  R.dir[2] = nz;
  R.u[0] = tx;
  R.u[1] = 0;
  R.u[2] = tz;
  R.width = w;
  R.height = h;
  R.color.setRGB(r, g, b);
  R.intensity = WL.K;
  R.radius = 1.6; // soft source: no specular sparkle on the brick joints
  R.range = Math.min(22, WL.range + 0.35 * Math.sqrt(w * h));
}
function rebuildWinCands(cam) {
  const px = cam.position.x,
    py = cam.position.y,
    pz = cam.position.z,
    R = WL.R,
    A = WF.a;
  wCand.length = 0;
  for (
    let bx = Math.floor((px - R) / 64);
    bx <= Math.floor((px + R) / 64);
    bx++
  )
    for (
      let bz = Math.floor((pz - R) / 64);
      bz <= Math.floor((pz + R) / 64);
      bz++
    ) {
      const L = WB.get((bx + 4096) * 8192 + bz + 4096);
      if (!L) continue;
      for (const fi of L) {
        const o = fi * WFN,
          cx = A[o],
          cz = A[o + 1],
          tx = A[o + 2],
          tz = A[o + 3],
          W = A[o + 4];
        // camera in front of the face? (lights only reach the outside)
        const t = Math.max(0, Math.min(W, (px - cx) * tx + (pz - cz) * tz)),
          qx = cx + tx * t - px,
          qz = cz + tz * t - pz;
        const front = -(px - cx) * tz + (pz - cz) * tx; // n = (-tz, tx)
        const dh = Math.hypot(qx, qz);
        if (dh > R || (front < -WL.range && dh > 4)) continue;
        const dyf = Math.max(0, A[o + 5] - py, py - A[o + 6]);
        if (dh * dh + dyf * dyf > R * R) continue;
        for (const b of faceBands(fi)) {
          const dy = b.y - py,
            d = Math.sqrt(dh * dh + dy * dy);
          if (d < R) wCand.push(Math.floor(d) * 1e7 + fi, b);
        }
      }
    }
  // sort band candidates by distance (pairs: key, band)
  const idx = [];
  for (let i = 0; i < wCand.length; i += 2) idx.push(i);
  idx.sort((a, b) => wCand[a] - wCand[b]);
  wN = 0;
  for (const i of idx) {
    if (wN >= WL.max) break;
    const key = wCand[i],
      b = wCand[i + 1],
      d = Math.floor(key / 1e7),
      fi = key - d * 1e7,
      fo = fi * WFN;
    if (d < WL.near && b.runs.length / 7 <= WL.max - wN) {
      for (let j = 0; j < b.runs.length; j += 7) {
        const q = b.runs;
        setRect(
          wN++,
          fo,
          q[j],
          q[j + 1],
          q[j + 2],
          q[j + 3],
          q[j + 4],
          q[j + 5],
          q[j + 6],
        );
      }
    } else {
      const q = b.band;
      setRect(wN++, fo, q[0], q[1], q[2], q[3], q[4], q[5], q[6]);
    }
  }
  wCx = px;
  wCy = py;
  wCz = pz;
  WL.emitted = wN;
}
cityLights.addProvider((emit, cam) => {
  if (WL.enabled !== WL._en) {
    WL._en = WL.enabled;
    cityLights.invalidate?.();
  } // (night r10) toggles take effect with the incremental light grid
  if (!WL.enabled || !WL.faces) return;
  const p = cam.position;
  if (WL.dirty) cityLights.invalidate?.();
  if (
    WL.dirty ||
    Math.abs(p.x - wCx) + Math.abs(p.y - wCy) + Math.abs(p.z - wCz) > 2.5
  ) {
    WL.dirty = false;
    rebuildWinCands(cam);
  } // dirty: re-read WL.K / range (tuning)
  for (let i = 0; i < wN; i++) emit(wPool[i]);
});
WL.list = (n = 8) =>
  wPool
    .slice(0, Math.min(n, wN))
    .map((r) => ({
      p: r.pos.map((v) => +v.toFixed(1)),
      d: r.dir.map((v) => +v.toFixed(2)),
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      c: r.color.toArray().map((v) => +v.toFixed(2)),
      rg: +r.range.toFixed(1),
    }));
if (typeof window !== "undefined") window.__winLights = WL;
// debug / shot framing: a lit window run (>= minN windows) on a face within R of (x, z), centre height y0..y1
export function findLitWindowRun(x, z, R = 120, y0 = 6, y1 = 30, minN = 2) {
  const A = WF.a;
  let best = null;
  for (let bx = Math.floor((x - R) / 64); bx <= Math.floor((x + R) / 64); bx++)
    for (
      let bz = Math.floor((z - R) / 64);
      bz <= Math.floor((z + R) / 64);
      bz++
    ) {
      for (const fi of WB.get((bx + 4096) * 8192 + bz + 4096) ?? []) {
        const o = fi * WFN,
          d = Math.hypot(A[o] - x, A[o + 1] - z);
        if (d > R || (best && d > best.d)) continue;
        for (const b of faceBands(fi))
          for (let j = 0; j < b.runs.length; j += 7) {
            const q = b.runs,
              n = Math.round((q[j + 1] - q[j]) / 1.2);
            if (q[j + 2] < y0 || q[j + 2] > y1 || n < minN) continue;
            const uc = (q[j] + q[j + 1]) / 2;
            best = {
              d,
              pos: [A[o] + A[o + 2] * uc, q[j + 2], A[o + 1] + A[o + 3] * uc],
              n: [-A[o + 3], 0, A[o + 2]],
              t: [A[o + 2], 0, A[o + 3]],
              w: q[j + 1] - q[j],
              style: A[o + 13] % 8,
            };
          }
      }
    }
  return best;
}
export class FacadeBuilder {
  constructor() {
    this.pos = new GrowBuf();
    this.nrm = new GrowBuf();
    this.uv = new GrowBuf();
    this.aF = new GrowBuf();
    this.aS = new GrowBuf();
    this.aW = new GrowBuf();
    this.aX = new GrowBuf();
    this.tint = new GrowBuf();
    this.idx = new GrowBuf(Uint32Array);
    this.n = 0;
  }
  // p: {floorH,bayW,winW,winH, layer, base, seed, gH, style, margin, resid, lintel, glass, tint:[r,g,b], baseY, topY}
  quad(corner, T, W, y0, y1, N, p, style, gH, uOff = 0) {
    const b = this.n;
    const up = [0, 1, 0];
    const pts = [
      [0, y0],
      [W, y0],
      [W, y1],
      [0, y1],
    ];
    for (const [u, y] of pts) {
      this.pos.push(corner[0] + T[0] * u, y, corner[2] + T[2] * u);
      this.nrm.push(N[0], N[1], N[2]);
      this.uv.push(u + uOff, y);
      this.pushAttrs(p, style, gH, W);
    }
    if (gH > 0 && style >= 1 && y0 <= (p.baseY ?? 0) + 0.6)
      registerShop(corner, T, W, N, p, gH); // (night)
    if (!this.noLights && style >= 1 && style <= 4 && W > 2 && y1 - y0 > 2)
      recordWinFace(corner, T, W, y0, y1, N, p, style, gH, uOff); // (night) window light
    void up;
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.n += 4;
  }
  pushAttrs(p, style, gH, W) {
    this.aF.push(p.floorH ?? 3.3, p.bayW ?? 2.4, p.winW ?? 0.5, p.winH ?? 0.55);
    this.aS.push(
      (p.layer ?? 0) +
        16 * (p.base ?? 3) +
        256 * Math.max(0, Math.min(2000, Math.round(p.tierY ?? 0))),
      p.seed ?? 0,
      gH,
      style,
    ); // (skyline r12) + tier base height (setback contact shade)
    this.aW.push(W, p.topY ?? 100, p.baseY ?? 0, p.margin ?? 0.6);
    this.aX.push(p.resid ?? 0, p.lintel ?? 0, p.glass ?? 0, p.depth ?? 0.22);
    const t = p.tint ?? [1, 1, 1];
    this.tint.push(t[0], t[1], t[2]);
  }
  horiz(x0, z0, x1, z1, y, p, down = false) {
    const b = this.n;
    const c = down
      ? [
          [x0, z0],
          [x1, z0],
          [x1, z1],
          [x0, z1],
        ]
      : [
          [x0, z1],
          [x1, z1],
          [x1, z0],
          [x0, z0],
        ];
    for (const [x, z] of c) {
      this.pos.push(x, y, z);
      this.nrm.push(0, down ? -1 : 1, 0);
      this.uv.push(x, -z);
      this.pushAttrs(p, 0, 0, 1);
    }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.n += 4;
  }
  // Axis-aligned box. faces: {px,nx,pz,nz: {style,gH} | null}, top: bool, bottom: bool
  box(
    x0,
    y0,
    z0,
    x1,
    y1,
    z1,
    p,
    faces = {},
    top = true,
    bottom = false,
    roofP = null,
  ) {
    const def = { style: STYLE.BLANK, gH: 0 };
    const f = (k) =>
      faces[k] === null ? null : (faces[k] ?? faces.all ?? def);
    // (zfix) F.y0: per-face bottom override (a face flush with the parapet of the mass below starts at its top); the
    // face runs from max(y0, F.y0) and is skipped when that leaves nothing
    const f0 = f;
    const f2 = (k) => {
      const F = f0(k);
      return F && F.y0 != null && Math.max(y0, F.y0) >= y1 - 1e-4 ? null : F;
    };
    let F;
    if ((F = f2("pz")))
      this.quad(
        [x0, 0, z1],
        [1, 0, 0],
        x1 - x0,
        Math.max(y0, F.y0 ?? y0),
        y1,
        [0, 0, 1],
        p,
        F.style,
        F.gH,
      );
    if ((F = f2("nz")))
      this.quad(
        [x1, 0, z0],
        [-1, 0, 0],
        x1 - x0,
        Math.max(y0, F.y0 ?? y0),
        y1,
        [0, 0, -1],
        p,
        F.style,
        F.gH,
      );
    if ((F = f2("px")))
      this.quad(
        [x1, 0, z1],
        [0, 0, -1],
        z1 - z0,
        Math.max(y0, F.y0 ?? y0),
        y1,
        [1, 0, 0],
        p,
        F.style,
        F.gH,
      );
    if ((F = f2("nx")))
      this.quad(
        [x0, 0, z0],
        [0, 0, 1],
        z1 - z0,
        Math.max(y0, F.y0 ?? y0),
        y1,
        [-1, 0, 0],
        p,
        F.style,
        F.gH,
      );
    if (top) this.horiz(x0, z0, x1, z1, y1, roofP ?? p);
    if (bottom) this.horiz(x0, z0, x1, z1, y0, p, true);
  }
  // convex polygon cap [[x,z],...] at height y (roof of round / polygonal masses), facing up (or down)
  fan(pts, y, p, down = false) {
    const b = this.n;
    for (const [x, z] of pts) {
      this.pos.push(x, y, z);
      this.nrm.push(0, down ? -1 : 1, 0);
      this.uv.push(x, -z);
      this.pushAttrs(p, 0, 0, 1);
    }
    for (let i = 1; i + 1 < pts.length; i++) {
      const [ax, az] = pts[0],
        [bx, bz] = pts[i],
        [cx, cz] = pts[i + 1];
      const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az) > 0;
      if (up !== down) this.idx.push(b, b + i, b + i + 1);
      else this.idx.push(b, b + i + 1, b + i);
    }
    this.n += pts.length;
  }
  // (skyline r9) flat n-gon annulus between radii r0 < r1 at height y (cornice lip tops / soffits), facing up or down
  ring(cx, cz, r0, r1, y, n, p, down = false) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        c = ((i + 1) / n) * Math.PI * 2,
        b = this.n;
      for (const [x, z] of [
        [Math.cos(a) * r0, Math.sin(a) * r0],
        [Math.cos(a) * r1, Math.sin(a) * r1],
        [Math.cos(c) * r1, Math.sin(c) * r1],
        [Math.cos(c) * r0, Math.sin(c) * r0],
      ]) {
        this.pos.push(cx + x, y, cz + z);
        this.nrm.push(0, down ? -1 : 1, 0);
        this.uv.push(cx + x, -(cz + z));
        this.pushAttrs(p, 0, 0, 1);
      }
      // (a0 -> a1 -> c1) winds clockwise seen from above (angle grows from +x toward +z) -> front face up
      if (down) this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      else this.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
      this.n += 4;
    }
  }
  // vertical n-gon prism (round tiers, masts): side quads with the facade style + top cap
  cyl(cx, cz, r, y0, y1, n, p, style = 0, top = true, r1 = r) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.cos(a), Math.sin(a)]);
    }
    for (let i = 0; i < n; i++) {
      const [ax, az] = pts[i],
        [bx, bz] = pts[(i + 1) % n];
      if (r1 === r && p.wrap) {
        // (skyline r9) round tower tier: u runs continuously around the circumference (the window grid, per-window
        // variation and fins no longer restart on every facet -> no identical-floor banding), smooth radial normals, and
        // the face width attribute is the full circumference; gH -0.02 flags 'round' to the shader (vertical fins)
        const b = this.n,
          W = Math.hypot(ax - bx, az - bz) * r,
          C = W * n;
        const V = [
          [bx, 0, y0],
          [ax, W, y0],
          [ax, W, y1],
          [bx, 0, y1],
        ];
        for (const [dx, du, y] of V) {
          const dz = dx === bx ? bz : az;
          this.pos.push(cx + dx * r, y, cz + dz * r);
          this.nrm.push(dx, 0, dz);
          this.uv.push((n - 1 - i) * W + du, y);
          this.pushAttrs(p, style, -0.02, C);
        }
        this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        this.n += 4;
      } else if (r1 === r) {
        // quad(corner, T, W, ...): face seen from outside runs from corner along T; outward normal = mid direction
        const x0 = cx + bx * r,
          z0 = cz + bz * r,
          x1 = cx + ax * r,
          z1 = cz + az * r;
        const W = Math.hypot(x1 - x0, z1 - z0),
          T = [(x1 - x0) / W, 0, (z1 - z0) / W];
        const mx = (ax + bx) / 2,
          mz = (az + bz) / 2,
          ml = Math.hypot(mx, mz);
        this.quad(
          [x0, 0, z0],
          T,
          W,
          y0,
          y1,
          [mx / ml, 0, mz / ml],
          p,
          style,
          -0.01,
        );
      } else {
        // tapered: explicit quad
        const b = this.n,
          mx = (ax + bx) / 2,
          mz = (az + bz) / 2,
          ml = Math.hypot(mx, mz),
          k = (r - r1) / (y1 - y0);
        const nl = Math.hypot(1, k),
          N = [mx / ml / nl, k / nl, mz / ml / nl];
        const V = [
          [cx + bx * r, y0, cz + bz * r, 0],
          [cx + ax * r, y0, cz + az * r, 1],
          [cx + ax * r1, y1, cz + az * r1, 1],
          [cx + bx * r1, y1, cz + bz * r1, 0],
        ];
        const W = Math.hypot(ax - bx, az - bz) * r;
        for (const [x, y, z, u] of V) {
          this.pos.push(x, y, z);
          this.nrm.push(...N);
          this.uv.push(u * W, y);
          this.pushAttrs(p, style, -0.01, W);
        }
        this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        this.n += 4;
      }
    }
    if (top && r1 > 0.01)
      this.fan(
        pts.map(([x, z]) => [cx + x * r1, cz + z * r1]),
        y1,
        p,
      );
  }
  // inward-facing walls of a rectangle (parapet inner faces, courtyards)
  innerRing(x0, z0, x1, z1, y0, y1, p) {
    this.quad([x0, 0, z0], [1, 0, 0], x1 - x0, y0, y1, [0, 0, 1], p, 0, 0);
    this.quad([x1, 0, z1], [-1, 0, 0], x1 - x0, y0, y1, [0, 0, -1], p, 0, 0);
    this.quad([x0, 0, z1], [0, 0, -1], z1 - z0, y0, y1, [1, 0, 0], p, 0, 0);
    this.quad([x1, 0, z0], [0, 0, 1], z1 - z0, y0, y1, [-1, 0, 0], p, 0, 0);
  }
  build() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    const A = (b, k) => new THREE.BufferAttribute(b.take(), k);
    g.setAttribute("position", A(this.pos, 3));
    g.setAttribute("normal", A(this.nrm, 3));
    g.setAttribute("uv", A(this.uv, 2));
    g.setAttribute("aF", A(this.aF, 4));
    g.setAttribute("aS", A(this.aS, 4));
    g.setAttribute("aW", A(this.aW, 4));
    g.setAttribute("aX", A(this.aX, 4));
    g.setAttribute("aTint", A(this.tint, 3));
    const ix = this.idx.take();
    g.setIndex(
      this.n > 65535
        ? new THREE.BufferAttribute(ix, 1)
        : new THREE.BufferAttribute(Uint16Array.from(ix), 1),
    );
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

let _fragDecl: string | undefined;
function facadeFragmentDeclarations() {
  return (_fragDecl ??= injectShader(facadeFragmentShaderDeclarations, NFLOOD * 3, NFLOOD));
}

export function createFacadeMaterial(T) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0,
  });
  const uniforms = {
    tWallC: { value: T.wallsCol },
    tWallN: { value: T.wallsNrm },
    tWallH: { value: T.wallsHao },
    tDetail: { value: T.detailNrm },
    tInterior: { value: T.interiors },
    tSigns: { value: T.signs },
    tNoise: { value: T.noise },
    uInteriorGain: { value: 0.5 },
    uShopGain: { value: 0.7 },
    uNightK: nightK,
    uDnTime: dnTime, // (daynight) shared night factor + clock (src/render/dayNight.ts)
    ...floodU, // (night) crown floodlights
    ...glassMirrorShared, // (render r-refl)
  };
  mat.userData.uniforms = uniforms;
  // (skyline r2) facades do their own city reflection (see lights_fragment_maps below); the pipeline SSR's sky-radiance
  // reflection floor turned every glass tower pale sky-blue from above, so the facade opts out of SSR
  mat.userData.noSSR = true;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>",injectShader(facadeShader.vertexCommon, facadeVertexDeclarations))
      .replace("#include <fog_vertex>",injectShader(facadeShader.vertexFogVertex, facadeVertexMain));
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",injectShader(facadeShader.fragmentCommon, facadeFragmentDeclarations(), GLSL_GLASS_MIRROR_DECL),
      )
      .replace(
        "#include <map_fragment>",facadeShader.fragmentMap,
      )
      .replace(
        "#include <roughnessmap_fragment>",facadeShader.fragmentRoughness,
      )
      .replace(
        "#include <metalnessmap_fragment>",facadeShader.fragmentMetalness,
      )
      .replace(
        "#include <normal_fragment_maps>",facadeShader.fragmentNormalMaps,
      )
      .replace(
        "#include <emissivemap_fragment>",facadeShader.fragmentEmissive,
      )
      .replace(
        "#include <lights_physical_fragment>",facadeShader.fragmentPhysicalLights,
      )
      // (skyline r2) glass reflects the CITY, not only the sky: the IBL cube is sky-only, so reflection rays that leave a
      // window below the local skyline hit a procedural reflected cityscape (per-tower hashed silhouette of neighbouring
      // towers with sunlit / shaded faces and faint window rows, the streets below). Glass towers seen from above turn
      // dark and structured instead of mirroring bright sky.
      .replace(
        "#include <lights_fragment_maps>",facadeShader.fragmentLightsMaps,
      );
  };
  mat.customProgramCacheKey = () => "city-facade-v19-night"; // (render r-refl) v18: glass mirror
  return mat;
}
// (night) a variant of the facade material sharing its uniforms / shader but with extra defines, e.g. NO_CITYLIGHT for
// the far shores (surface.ts: the Manhattan street-light fill lit their facades as a flat tan band at night)
export function deriveFacadeMaterial(base, defines) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0,
  });
  // own userData without the uniform handles: lighting.ts scales uInteriorGain / uShopGain per material from a remembered
  // base (a second material sharing the uniforms would re-read the boosted value and compound the night gain)
  m.userData = { ...base.userData, uniforms: undefined };
  m.onBeforeCompile = base.onBeforeCompile;
  m.defines = { ...(base.defines || {}), ...defines };
  const key =
    base.customProgramCacheKey() + "|" + Object.keys(defines).join(",");
  m.customProgramCacheKey = () => key;
  return m;
}
