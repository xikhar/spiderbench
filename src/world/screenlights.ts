// @ts-nocheck
// (night) LED screens / billboards / neon as REAL light sources (render/cityLights.ts).
//   screenLightSet() -> { rect(c, n, u, w, h, avg, k, opt), point(p, col, I, range), halo(...), commit(tag, opt) }
//     (night r9) opt.uv = the panel's atlas rect [u0, v0, u1, v1] (ts_ads.webp; image u along +u, v up): the panel is lit as
//       2-4+ tiles (halves / quadrants, <= SL.split m), each with the average colour of ITS part of the image (a red-and-blue
//       ad throws red on one side, blue on the other). opt.printed: a floodlit print (reflects, SL.printed x an LED's light).
//       Tile colours come from advertisingTextures.ts getAdvertisingColorGrid() (async: the set registers once the atlas image is decoded).
//     rect: one LED panel (centre c, facing normal n, width axis u, size w x h m, linear average colour avg, relative
//       brightness k). commit() merges small coplanar neighbours into one emitter (flux-preserving: radiance x area is
//       summed, the colour is the flux-weighted mean) so dense screen walls stay inside the 18 lights / cell budget,
//       and registers everything with cityLights (night only: the lights scale with nightK, nothing by day).
//   scrUniforms() / SCR_GLSL_PARS / SCR_GAIN_GLSL: night brightness of screen emissives (see the bottom of the file).
//   Tunables live in SL (window.__screenLights for A/B: SL.gain / SL.sat then __screenLights.refresh()).
import { lazyShaderSections } from "../shaderSections.ts";
import screenlightsShaderSource from "./shaders/glsl/screenlights.glsl?raw";
import { injectShader } from "../render/shaderInjection.ts";
import * as THREE from "three";
import { cityLights } from "../render/cityLights.ts";
import { nightK, screenK } from "../render/dayNight.ts";
import {
  getAdvertisingColorGrid,
  type AtlasColorGrid,
} from "./advertisingTextures.ts";

const screenlightsShader = lazyShaderSections(() => screenlightsShaderSource);
// (night r9) per-region ad colours

export const SL = {
  gain: 1.0, // (r3: 1.9 -> 1.0, critic 'spill reads as sunlight') light radiance scale (x lightDrive(): bright full-bleed ads are compressed, see there)
  sat: 2.0, // chroma boost of the light colour (LED primaries: an ad's mean colour is greyer than its light reads)
  minL: 0.06, // floor so near-black ads still glow a little
  mergeA: 40, // (night r9 110 -> 40: keep each ad its own colours) panels smaller than this (m^2) merge with coplanar neighbours
  mergeGap: 5.0, // max gap between merged panels (m)
  mergeMax: 26, // max merged emitter extent (m)
  volume: 0.28, // haze in-scatter weight
  point: 1.0, // neon / marquee point light gain
  split: 10, // (r3 14 -> 10: floors at the foot of big screens) big panels split into tiles of at most this size (m)
  halo: 0.3, // gap point intensity per m^2 of panel (x gain x drive) -- see halo()
  printed: 0.8, // (night r9) floodlit printed board: light x this (reflected lamp light; the print itself reads ~as bright as a screen at night)
  lodNear: 45, // (night r9) boards nearer than this + their size emit their tiles, farther ones one whole-panel light
  tileMin: 3, // (night r9) panels at least this wide / tall (m) split into halves / quadrants by image region
};
const all = []; // every registered emitter: { id, src, base }
export function refreshScreenLights() {
  for (const e of all) {
    if (e.sync) e.sync();
    else if (e.col)
      cityLights.update(e.id, { color: e.col(), intensity: e.I() });
    else cityLights.update(e.id, { intensity: e.I() });
  }
}
if (typeof window !== "undefined")
  window.__screenLights = { SL, refresh: refreshScreenLights, all };

const _c = new THREE.Color();
// (night r2) radiance drive from the ad's (saturated) peak channel m: m / (1 + m) compresses bright full-bleed ads (a wall
// 6 m from a 40 m skin-tone screen clipped to white) while dark / mid ads keep their spill on the plaza
const lightDrive = (m) =>
  (1.5 * Math.max(m, SL.minL)) / (1 + Math.max(m, SL.minL));
function lightColour(avg) {
  // linear avg -> saturated linear colour normalised to max 1, plus its luminance
  const l = 0.2126 * avg[0] + 0.7152 * avg[1] + 0.0722 * avg[2];
  const r = Math.max(0, l + (avg[0] - l) * SL.sat),
    g = Math.max(0, l + (avg[1] - l) * SL.sat),
    b = Math.max(0, l + (avg[2] - l) * SL.sat);
  const m = Math.max(r, g, b, 1e-4);
  return { rgb: [r / m, g / m, b / m], lum: l, m };
}

export function screenLightSet() {
  const rects = [],
    points = [],
    halos = [];
  return {
    rects,
    points,
    halos,
    rect(c, n, u, w, h, avg, k = 1, o = {}) {
      if ((avg || o.uv) && w > 0.3 && h > 0.3)
        rects.push({
          c: [...c],
          n: [...n],
          u: [...u],
          w,
          h,
          avg: avg ? [...avg] : null,
          k,
          uv: o.uv ? [o.uv[0], o.uv[1], o.uv[2], o.uv[3]] : null,
          pr: !!o.printed,
          range: o.range,
          whole: !!o.whole,
          gain: o.gain ?? 1,
        });
    },
    point(p, col, I, range = 8, volume = 0.2) {
      points.push({ p: [...p], col, I, range, volume });
    },
    // (night r3) wall glow around a cabinet: the facade it hangs on lies BEHIND the panel's emitting plane (a rect can never
    // light it), so a point light sits in the stand-off gap between wall and cabinet (c), intensity ~ panel area: the wall
    // around the cabinet gets a grazing glow falling off with distance (edge / bezel leakage), unoccluded like the panel
    halo(c, n, u, w, h, avg) {
      if (avg)
        halos.push({ c: [...c], n: [...n], u: [...u], w, h, avg: [...avg] });
    },
    commit(tag = "", opt = {}) {
      // opt: overrides of SL.mergeA / mergeGap / mergeMax for this set; opt.grid: atlas grid promise (default ads)
      const st = {
        tag,
        panels: rects.length,
        emitters: 0,
        halos: halos.length,
        points: points.length,
        pending: true,
      };
      if (typeof window !== "undefined")
        (window.__screenLightStats ??= []).push(st);
      const need = rects.some((r) => r.uv);
      const go = (G) => {
        try {
          register(G, tag, opt, st);
        } catch (e) {
          console.warn("[screenlights]", tag, e);
        }
        st.pending = false;
      };
      if (need)
        (opt.grid ?? getAdvertisingColorGrid()).then(go, () => go(null));
      else go(null);
      return st;
    },
  };
  function register(G, tag, opt, st) {
    const mA = opt.mergeA ?? SL.mergeA,
      mG = opt.mergeGap ?? SL.mergeGap,
      mM = opt.mergeMax ?? SL.mergeMax;
    for (const r of rects) {
      // whole-panel colour from the atlas (the crop actually shown), else the given average
      const a = r.uv && G ? regionAvg(G, r.uv, 0, 1, 0, 1) : null;
      if (a) r.avg = a;
      else if (!r.avg) r.avg = [0.15, 0.15, 0.15];
    }
    // ---- merge small coplanar panels (greedy: sorted by plane, then position along u / y)
    const small = rects.filter((r) => r.w * r.h < mA),
      big = rects.filter((r) => r.w * r.h >= mA);
    const groups = [];
    for (const r of small) {
      const t = r.c[0] * r.u[0] + r.c[2] * r.u[2],
        d = r.c[0] * r.n[0] + r.c[2] * r.n[2];
      let g = null;
      for (const G of groups) {
        if (G.n[0] !== r.n[0] || G.n[2] !== r.n[2] || Math.abs(G.d - d) > 2.0)
          continue;
        const t0 = Math.min(G.t0, t - r.w / 2),
          t1 = Math.max(G.t1, t + r.w / 2),
          y0 = Math.min(G.y0, r.c[1] - r.h / 2),
          y1 = Math.max(G.y1, r.c[1] + r.h / 2);
        const gapT = Math.max(G.t0 - (t + r.w / 2), t - r.w / 2 - G.t1),
          gapY = Math.max(G.y0 - (r.c[1] + r.h / 2), r.c[1] - r.h / 2 - G.y1);
        if (gapT > mG || gapY > mG || t1 - t0 > mM || y1 - y0 > mM) continue;
        g = G;
        Object.assign(G, { t0, t1, y0, y1 });
        break;
      }
      if (!g)
        groups.push(
          (g = {
            n: r.n,
            u: r.u,
            d,
            t0: t - r.w / 2,
            t1: t + r.w / 2,
            y0: r.c[1] - r.h / 2,
            y1: r.c[1] + r.h / 2,
            list: [],
          }),
        );
      g.list.push(r);
    }
    // big panels split into <= SL.split m tiles: the representative-point rect evaluates the emitter cosine from the
    // centre, which under-lights ledges / floors at the foot of a 40 m screen; tiles keep the near field right
    // (night r9) panels with an image (uv) also split into halves / quadrants by image region, each tile its own colour
    // (night r9) LOD: every panel is a BOARD = one whole-panel emitter (far) + its tiles (near); a single provider picks
    // per frame by distance (boardProvider below), so thousands of city boards fit the 1024-light frame budget
    const out = [],
      bl = [];
    const tiles = (r) => {
      let nu = Math.max(1, Math.ceil(r.w / SL.split - 0.15)),
        nv = Math.max(1, Math.ceil(r.h / SL.split - 0.15));
      if (r.uv && G && !r.whole) {
        if (r.w >= SL.tileMin && r.w >= 0.6 * r.h) nu = Math.max(nu, 2);
        if (r.h >= SL.tileMin && r.h >= 0.6 * r.w) nv = Math.max(nv, 2);
      }
      const tw = r.w / nu,
        th = r.h / nv;
      for (let i = 0; i < nu; i++)
        for (let j = 0; j < nv; j++) {
          const du = (i + 0.5) * tw - r.w / 2,
            dv = (j + 0.5) * th - r.h / 2;
          const t = {
            ...r,
            c: [r.c[0] + r.u[0] * du, r.c[1] + dv, r.c[2] + r.u[2] * du],
            w: tw,
            h: th,
          };
          if (r.uv && G && !r.whole)
            t.avg =
              regionAvg(G, r.uv, i / nu, (i + 1) / nu, j / nv, (j + 1) / nv) ??
              r.avg;
          t.list = [t];
          out.push(t);
          T.push(t);
        }
      if (T.length === 1) {
        out.pop();
        T.length = 0;
      } // one tile = the whole panel
      const W = { ...r, list: [r] };
      out.push(W);
      bl.push({ whole: W, tiles: T.length > 1 ? T : null, T });
    };
    let T;
    const tilesB = (r) => {
      T = [];
      tiles(r);
    };
    for (const r of big) tilesB(r);
    for (const Q of groups) {
      if (Q.list.length === 1) {
        tilesB(Q.list[0]);
        continue;
      }
      const w = Q.t1 - Q.t0,
        h = Q.y1 - Q.y0,
        tc = (Q.t0 + Q.t1) / 2,
        dd =
          Q.list.reduce((a, r) => a + r.c[0] * r.n[0] + r.c[2] * r.n[2], 0) /
          Q.list.length;
      // centre from the plane (n . p = dd) and the u coordinate: p = n dd + u tc (both horizontal, orthonormal)
      const W = {
        c: [
          Q.n[0] * dd + Q.u[0] * tc,
          (Q.y0 + Q.y1) / 2,
          Q.n[2] * dd + Q.u[2] * tc,
        ],
        n: Q.n,
        u: Q.u,
        w,
        h,
        list: Q.list,
        pr: Q.list.every((r) => r.pr),
      };
      out.push(W);
      bl.push({ whole: W, tiles: null });
    }
    // ---- register
    for (const E of out) {
      // flux-weighted colour / radiance over the emitter area
      let fr = 0,
        fg = 0,
        fb = 0;
      for (const r of E.list) {
        const a = r.w * r.h * r.k;
        fr += r.avg[0] * a;
        fg += r.avg[1] * a;
        fb += r.avg[2] * a;
      }
      const A = E.w * E.h,
        avg = [fr / A, fg / A, fb / A];
      const e = {
        kind: "rect",
        avg,
        c: E.c,
        n: E.n,
        w: E.w,
        h: E.h,
        tag,
        pr: !!E.pr,
        g: E.gain ?? 1,
      }; // (debug: positions for shots)
      e.col = () => {
        const q = lightColour(e.avg);
        return _c
          .setRGB(q.rgb[0], q.rgb[1], q.rgb[2], THREE.LinearSRGBColorSpace)
          .clone();
      };
      e.I = () => {
        const q = lightColour(e.avg);
        return SL.gain * e.g * lightDrive(q.m) * (e.pr ? SL.printed : 1);
      };
      const size = Math.sqrt(A);
      const range =
        E.range ??
        Math.min(60, Math.max(E.pr ? 12 : 18, size * (E.pr ? 3.5 : 4.5))); // near field strong, distant facades fall off (1/d^2 x window)
      // emit() record (plain object, reused every frame; the colour already carries the intensity: intensity 1)
      e.rec = {
        type: "rect",
        pos: E.c,
        dir: E.n,
        u: E.u,
        width: E.w,
        height: E.h,
        color: new THREE.Color(),
        intensity: 1,
        range,
        radius: Math.min(E.w, E.h) / 2,
        volume: SL.volume,
      };
      e.sync = () => {
        e.rec.color.copy(e.col()).multiplyScalar(e.I());
      };
      e.sync();
      E.e = e;
      all.push(e);
    }
    for (const b of bl) {
      const W = b.whole.e,
        sz = Math.max(W.w, W.h);
      boards.push({
        x: W.c[0],
        z: W.c[2],
        R: W.rec.range + sz,
        lod: SL.lodNear + sz,
        far: W.pr ? 160 : 70 + 5 * (W.rec.range + sz),
        /* (night r10) printed boards: not from aerial distances (their big-rect GGX glint in facing glass read as a white flare, sc_r10_aerial) */ whole:
          W.rec,
        tiles: b.tiles ? b.tiles.map((t) => t.e.rec) : null,
      });
    }
    for (const H of halos) {
      // (night r3) point in the cabinet's stand-off gap (see halo())
      const e = {
        kind: "rect",
        avg: H.avg,
        c: H.c,
        n: H.n,
        w: H.w,
        h: H.h,
        tag: tag + "Halo",
      };
      e.col = () => {
        const q = lightColour(e.avg);
        return _c
          .setRGB(q.rgb[0], q.rgb[1], q.rgb[2], THREE.LinearSRGBColorSpace)
          .clone();
      };
      e.I = () => {
        const q = lightColour(e.avg);
        return SL.gain * SL.halo * lightDrive(q.m) * H.w * H.h;
      };
      e.id = cityLights.add({
        type: "point",
        pos: H.c,
        color: e.col(),
        intensity: e.I(),
        range: Math.min(22, 3 + 0.8 * Math.max(H.w, H.h)),
        radius: 0.3 * Math.min(H.w, H.h),
        volume: 0,
      });
      all.push(e);
    }
    for (const P of points) {
      const e = { kind: "point", I: () => P.I * SL.point };
      e.id = cityLights.add({
        type: "point",
        pos: P.p,
        color: P.col,
        intensity: e.I(),
        range: P.range,
        radius: 0.3,
        volume: P.volume,
      });
      all.push(e);
    }
    st.emitters = out.length;
    st.boards = bl.length;
  }
}
// (night r9) all boards: one provider, allocation-free per frame; far boards emit their whole-panel light, near ones tiles
const boards = [];
cityLights.addProvider((emit, camera) => {
  if (nightK.value < 0.01 || !boards.length) return;
  const cx = camera.position.x,
    cz = camera.position.z,
    W = 256;
  let n = 0;
  for (let i = 0; i < boards.length; i++) {
    const b = boards[i],
      dx = b.x - cx,
      dz = b.z - cz;
    if (Math.abs(dx) > W + b.R || Math.abs(dz) > W + b.R) continue;
    const d2 = dx * dx + dz * dz;
    if (d2 > b.far * b.far) continue; // small boards far away: sub-pixel light, not worth a slot
    if (b.tiles && d2 < b.lod * b.lod) {
      for (let k = 0; k < b.tiles.length; k++) emit(b.tiles[k]);
      n += b.tiles.length;
    } else {
      emit(b.whole);
      n++;
    }
  }
  SL.emitted = n;
});
// (night r9) linear average colour of the part [fx0..fx1] x [fy0..fy1] (fractions, y up) of atlas rect uv in grid G
export function regionAvg(
  grid: AtlasColorGrid,
  uv: readonly [number, number, number, number],
  startU = 0,
  endU = 1,
  startV = 0,
  endV = 1,
): [number, number, number] | null {
  const minU = uv[0] + (uv[2] - uv[0]) * startU;
  const maxU = uv[0] + (uv[2] - uv[0]) * endU;
  const minV = uv[1] + (uv[3] - uv[1]) * startV;
  const maxV = uv[1] + (uv[3] - uv[1]) * endV;

  const xStart = Math.max(0, Math.floor(Math.min(minU, maxU) * grid.width));
  const xEnd = Math.min(
    grid.width,
    Math.max(xStart + 1, Math.round(Math.max(minU, maxU) * grid.width)),
  );
  const yStart = Math.max(
    0,
    Math.floor((1 - Math.max(minV, maxV)) * grid.height),
  );
  const yEnd = Math.min(
    grid.height,
    Math.max(
      yStart + 1,
      Math.round((1 - Math.min(minV, maxV)) * grid.height),
    ),
  );

  let red = 0;
  let green = 0;
  let blue = 0;
  let sampleCount = 0;

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const colorOffset = (y * grid.width + x) * 3;
      red += grid.linearRgb[colorOffset] ?? 0;
      green += grid.linearRgb[colorOffset + 1] ?? 0;
      blue += grid.linearRgb[colorOffset + 2] ?? 0;
      sampleCount += 1;
    }
  }

  return sampleCount
    ? [red / sampleCount, green / sampleCount, blue / sampleCount]
    : null;
}

// (night) displayed brightness of LED screens: by day the lighting.ts exposure compensation (screenK); at night
// uScrBoost x brighter than that (the screens are the brightest emitters of the night city; lighting2 kept them at ~half
// their day level). Materials opt out of the lighting.ts scan with userData.nightGain = 1 (emissiveIntensity stays at
// its base) and multiply their emissive by SCR_GAIN_GLSL (no per-frame JS: screenK / nightK are uniform-shaped).
export const uScrBoost = { value: 2.0 },
  uScrDesat = { value: -0.18 }; // desat < 0: LED primaries a touch more saturated at night
export const scrUniforms = () => ({
  uScreenK: screenK,
  uNightK: nightK,
  uScrBoost,
  uScrDesat,
  uScrKnee,
  uScrTop,
});
export const SCR_GLSL_PARS = screenlightsShader.uniformDeclarations;
export const SCR_GAIN_GLSL = screenlightsShader.gainExpression;
// night highlight shoulder: the brightest channel (normalised to the panel's full drive = emissive x gain) rolls off from
// SCR_KNEE toward SCR_TOP, the whole colour scaled together (hue / saturation kept): whites land just under clip after
// the x4.5 night exposure + ACES, bloom carries the glow (critic r2: 'screen whites clip at 242+')
export const uScrKnee = { value: 0.28 },
  uScrTop = { value: 0.46 };
if (typeof window !== "undefined")
  Object.assign(window.__screenLights, { uScrBoost, uScrKnee, uScrTop }); // (debug A/B)
export const SCR_SHOULDER_GLSL = injectShader(screenlightsShader.highlightShoulder, SCR_GAIN_GLSL);
// wrap a lit emissive material (sign bands, neon, tickers): night gain applied to its final emissive (after any custom
// emissive code of its own onBeforeCompile)
export function screenNightMat(m, key) {
  m.userData.nightGain = 1;
  const obc = m.onBeforeCompile;
  m.onBeforeCompile = function (sh, r) {
    if (obc && obc !== THREE.Material.prototype.onBeforeCompile)
      obc.call(this, sh, r);
    Object.assign(sh.uniforms, scrUniforms());
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>",injectShader(screenlightsShader.fragmentCommon, SCR_GLSL_PARS))
      .replace(
        "#include <lights_fragment_begin>",injectShader(screenlightsShader.fragmentLightsBegin, SCR_GAIN_GLSL, SCR_SHOULDER_GLSL),
      );
  };
  const ck = m.customProgramCacheKey;
  m.customProgramCacheKey = function () {
    return (ck ? ck.call(this) : "") + "|scrNight|" + key;
  };
  return m;
}
