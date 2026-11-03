// @ts-nocheck
import { lazyShaderSections } from "../shaderSections.ts";
import citylightsShaderSource from "./shaders/glsl/citylights.glsl?raw";
import { injectShader } from "./shaderInjection.ts";
// CITY LIGHTS: real local lighting for the night city (street lamps, shop fronts, car
// lights, LED screens / billboards, floodlights). Every lit built-in material (Standard / Physical / Lambert / Phong /
// Toon, incl. onBeforeCompile-extended city materials) gets them through a global lights_fragment_begin patch: each
// light goes through the material's own RE_Direct (diffuse + GGX specular), so lamps light the asphalt, facades, cars
// and people with the right albedo, and wet / glossy surfaces show real highlights -- not an additive colour decal.
//
// Clustering: a world-space XZ grid (N x N cells of CELL m) centred on the camera. Each cell lists up to SLOTS light
// indices (the strongest at the cell centre win) and the highest point any of them reaches (fragments above skip the
// loop). Light records live in a float texture (4 texels each). Both textures are rebuilt every frame on the CPU
// (only while nightK > 0; by day every fragment skips the block on one uniform branch).
//
// API (window.__ctx.cityLights, also imported by world modules):
//   const id = cityLights.add({ type: 'point'|'spot'|'rect', pos, color, intensity, range, dir, angle, penumbra,
//                               u, width, height, radius, volume, day })
//      pos / dir / u: THREE.Vector3 or [x, y, z]; color: hex (sRGB), THREE.Color or [r, g, b] (sRGB 0..1)
//      intensity: irradiance at 1 m in scene units (a street lamp is ~ 170; night exposure is x4.5); rect: the emitted radiance (a screen ~ 1.5)
//      range: m (hard cut-off, windowed); spot: dir (axis), angle (outer half-angle, rad), penumbra 0..1
//      rect (screens / lit shop windows): pos = centre, dir = facing normal, u = width axis, width / height in m
//      radius: source size in m (softens GGX highlights); volume: 0..1 haze in-scatter weight (lit fog around it)
//      day: also lit by day (default false: lights scale with nightK); spec: 0..1 specular scale (point / spot); key: stable id
//      of a dynamic light (shadow slots); shadow: false = never shadowed. Narrow horizontal spots are cone-culled per cell
//   cityLights.update(id, partial) / cityLights.remove(id)
//   cityLights.addProvider(fn(emit, camera))  dynamic lights (cars ...): called once per frame, emit(record) with the
//      same fields as add() (plain objects; reuse them, they are copied)
//   cityLights.gain  global multiplier; cityLights.enabled; cityLights.stats
//   cityLightsGLSL: pars + eval function for custom ShaderMaterials (define USE_CITYL, add uniform cityL:
//      { value: cityLightsShared }), then `cityLightIrradiance(worldPos, worldNormal)` returns the diffuse irradiance
// ?nocl disables the whole system (A/B).
import * as THREE from "three";
import { nightK } from "./dayNight.ts";

const citylightsShader = lazyShaderSections(() => citylightsShaderSource);

export const CL_LAYER_Y = 14; // (night r9) two height layers: street level (< 14 m) and above (walls, roofs): lamps / cars no longer crowd window lights out of the cells the player climbs through
export const CL_CELL = 8,
  CL_N = 64,
  CL_SLOTS = 26,
  CL_TPC = 7,
  CL_MAXL = 2048; // (night r9) 1024: twin headlights + neon + billboard regions hit the cap // (night) 18 / 5: Times Square cells saturated (screens + lamps + cars); texel 0 holds 2 indices, texels 1..6 four each
const SPAN = CL_CELL * CL_N;
export const CL_UN = 16; // (r13) uniform-array fallback: lights per frame around the player
const unifArr = new Float32Array(CL_UN * 16 + 4);
let unifUsed = false;

const dataArr = new Float32Array(CL_MAXL * 16);
const dataTex = new THREE.DataTexture(
  dataArr,
  1024,
  CL_MAXL / 256,
  THREE.RGBAFormat,
  THREE.FloatType,
);
dataTex.minFilter = dataTex.magFilter = THREE.NearestFilter;
dataTex.generateMipmaps = false;
dataTex.needsUpdate = true;
const gridArr = new Uint16Array(CL_N * CL_TPC * CL_N * 2 * 4);
const gridTex = new THREE.DataTexture(
  gridArr,
  CL_N * CL_TPC,
  CL_N * 2,
  THREE.RGBAIntegerFormat,
  THREE.UnsignedShortType,
);
gridTex.internalFormat = "RGBA16UI";
gridTex.minFilter = gridTex.magFilter = THREE.NearestFilter;
gridTex.generateMipmaps = false;
gridTex.needsUpdate = true;

// shared uniform value (plain object: shared by reference across material clones)
//   origin: xy grid origin (world x, z), z cell size, w on (0/1)
//   misc: x global gain, y volumetric density, z count, w night factor
// (night) real-time shadows: the SH_N spot lights that matter most around the player (street lamps, headlights) render a
// distance map of the dynamic casters (the player on CHAR_LAYER, cars' shadow stand-ins on SHADOW_PROXY_LAYER) into one
// tile of a 2 x 2 atlas every frame; lights carrying a slot (record texel 3 .y = slot + 1) are shadowed for every
// receiver, including the lit haze (the player's shadow volume in the lamp cone). shW: per-slot fade-in weight.
export const CL_SH_N = 4,
  CL_SH_TILE = 1024; // (night) 512: critic 'blocky ~15 px stair-steps' on the player's lamp shadow
const shadowRT = new THREE.WebGLRenderTarget(CL_SH_TILE * 2, CL_SH_TILE * 2, {
  type: THREE.HalfFloatType,
  format: THREE.RedFormat,
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  depthBuffer: true,
  generateMipmaps: false,
});
shadowRT.texture.name = "cityLightShadows";
export const cityLightsShared = {
  data: dataTex,
  grid: gridTex,
  origin: new THREE.Vector4(0, 0, CL_CELL, 0),
  misc: new THREE.Vector4(1, 0, 0, 0),
  shM: Array.from({ length: CL_SH_N }, () => new THREE.Matrix4()),
  shMap: shadowRT.texture,
  shW: new THREE.Vector4(),
};

// ------------------------------------------------------------------------------------------------ GLSL
const GLSL_PARS = injectShader(
  citylightsShader.lightDeclarations,
  CL_SH_N,
  CL_UN * 4 + 1,
  CL_SH_N,
  CL_SH_N,
  CL_SH_TILE * 2,
  CL_UN * 4,
  CL_N,
  CL_TPC,
  CL_LAYER_Y,
  CL_N,
  CL_N,
  CL_SLOTS,
);
// Fast path (plain Standard / Physical without clearcoat / sheen / iridescence: city surfaces, peds, trees): the
// diffuse of all lights is summed and shaded once; GGX specular is evaluated per light only on surfaces smooth enough
// to show it (roughness < 0.75: wet asphalt, glass, polished stone). Clearcoat / sheen materials (car paint, the suit)
// and Lambert / Phong go through the full RE_Direct per light.
const GLSL_APPLY = injectShader(
  citylightsShader.applyLights,
  CL_SLOTS,
  CL_SLOTS,
);
export const cityLightsGLSL = GLSL_PARS;

// (r11) texture-unit fallback: with 16 fragment units (Apple Metal, ANGLE D3D11) the 3 city-light samplers pushed the
// texture-heavy materials (suit, facades) over the limit, the programs failed to link and those meshes vanished, by day
// too. After new programs appear, every failed one is looked up and its materials recompiled without the shadow sampler,
// then (if that still fails) without city lights.
let _rnd = null,
  _scn = null,
  _progN = -1,
  _progT = 0;
const _failed = new WeakSet();
function fixPrograms() {
  const progs = _rnd?.info.programs;
  if (!progs) return;
  if (progs.length === _progN && ++_progT % 10) return;
  _progN = progs.length; // diagnostics appear on a program's first use, not at compile
  const bad = new Set(
    progs.filter(
      (p) => p.diagnostics && !p.diagnostics.runnable && !_failed.has(p),
    ),
  );
  if (!bad.size) return;
  bad.forEach((p) => _failed.add(p));
  const seen = new Set(); // shared materials: one fallback step per pass
  _scn.traverse((o) => {
    for (const m of Array.isArray(o.material)
      ? o.material
      : o.material
        ? [o.material]
        : []) {
      if (seen.has(m) || m.isShaderMaterial) continue;
      const pr = _rnd.properties.get(m); // any program variant of the material (instanced / fog / ... ), not only the last one used
      if (
        !bad.has(pr.currentProgram) &&
        !(pr.programs && [...pr.programs.values()].some((p) => bad.has(p)))
      )
        continue;
      seen.add(m);
      const d = m.defines || (m.defines = {});
      if (!("CITYL_NOSH" in d)) d.CITYL_NOSH = "";
      else if (!("CITYL_UNIF" in d)) {
        d.CITYL_UNIF = "";
        unifUsed = true;
      } else if (!("CITYL_OFF" in d)) d.CITYL_OFF = "";
      else continue;
      m.needsUpdate = true;
      console.warn(
        `[citylights] ${m.name || m.type}: program failed to link, retry with ${"CITYL_OFF" in d ? "no city lights" : "CITYL_UNIF" in d ? `the ${CL_UN} lights nearest the player (no textures)` : "no city-light shadows"}`,
      );
    }
  });
}
let _installed = false;
export function installCityLightChunks(renderer = null, scene = null) {
  _rnd = renderer;
  _scn = scene;
  if (_installed) return;
  _installed = true;
  const uniformPath = _rnd?.capabilities?.maxTextures <= 16;
  if (uniformPath) {
    // Avoid the three city-light samplers up front. On 16-unit GPUs, texture-heavy
    // materials can exceed the hardware limit before the retry-based fallback runs.
    unifUsed = true;
    cityLights.shadows = false;
  }
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("nocl")) cityLights.enabled = false;
    if (q.has("noclsh")) cityLights.shadows = false;
    if (q.has("noclvol")) cityLights.volume = 0;
  } catch (e) {
    /* non-browser */
  } // A/B: ?nocl all, ?noclsh shadows, ?noclvol lit haze
  const SC = THREE.ShaderChunk;
  if (!SC.lights_pars_begin.includes("CITYL_PARS"))
    SC.lights_pars_begin =
      SC.lights_pars_begin +
      (uniformPath ? "\n#define CITYL_UNIF\n" : "") +
      GLSL_PARS;
  const src = SC.lights_fragment_begin,
    at = src.indexOf("#if defined( RE_IndirectDiffuse )");
  if (at < 0) {
    console.error("[citylights] could not patch lights_fragment_begin");
    return;
  }
  if (!src.includes("clWP"))
    SC.lights_fragment_begin = src.slice(0, at) + GLSL_APPLY + src.slice(at);
  for (const k of ["standard", "physical", "lambert", "phong", "toon"]) {
    const lib = THREE.ShaderLib[k];
    if (!lib) continue;
    lib.uniforms.cityL = { value: cityLightsShared };
    lib.uniforms.cityLU = { value: unifArr }; // (r13) shared by reference (typed arrays are not cloned per material)
    if (!lib.fragmentShader.startsWith(citylightsShader.enableDirective))
      lib.fragmentShader =
        citylightsShader.enableDirective + lib.fragmentShader;
  }
}

// ------------------------------------------------------------------------------------------------ registry
const TYPE = { point: 0, spot: 1, rect: 2 };
const _c = new THREE.Color();
const BUCKET = 64;
const statics = []; // records (null = removed)
const buckets = new Map(); // bucket key -> [record]
const providers = [];
const bkey = (bx, bz) => (bx + 4096) * 8192 + (bz + 4096);

function vec(v, out) {
  if (!v) return out;
  if (Array.isArray(v)) {
    out[0] = v[0];
    out[1] = v[1];
    out[2] = v[2];
  } else {
    out[0] = v.x;
    out[1] = v.y;
    out[2] = v.z;
  }
  return out;
}
// normalise an add() / emit() description into a flat record
function toRecord(o, r = {}) {
  r.type = TYPE[o.type ?? "point"] ?? 0;
  r.p = vec(o.pos, r.p || [0, 0, 0]);
  if (o.color == null) _c.setRGB(1, 1, 1);
  else if (Array.isArray(o.color))
    _c.setRGB(o.color[0], o.color[1], o.color[2], THREE.SRGBColorSpace);
  else if (o.color.isColor) _c.copy(o.color);
  else _c.set(o.color);
  const I = o.intensity ?? 1;
  r.c = [_c.r * I, _c.g * I, _c.b * I];
  r.lum = (_c.r * 0.2126 + _c.g * 0.7152 + _c.b * 0.0722) * I;
  r.range = o.range ?? 20;
  r.d = vec(o.dir, r.d || [0, -1, 0]);
  {
    const l = Math.hypot(r.d[0], r.d[1], r.d[2]) || 1;
    r.d[0] /= l;
    r.d[1] /= l;
    r.d[2] /= l;
  }
  r.u = vec(o.u, r.u || [1, 0, 0]);
  {
    const l = Math.hypot(r.u[0], r.u[1], r.u[2]) || 1;
    r.u[0] /= l;
    r.u[1] /= l;
    r.u[2] /= l;
  }
  const ang = o.angle ?? 0.9,
    pen = o.penumbra ?? 0.4;
  r.cosO = Math.cos(ang);
  r.cosI = Math.cos(ang * (1 - pen));
  r.hw = (o.width ?? 1) / 2;
  r.hh = (o.height ?? 1) / 2;
  r.radius = o.radius ?? 0.2;
  r.spec = Math.max(0, Math.min(1, o.spec ?? 1)); // specular scale (point / spot): e.g. headlight glints on wet asphalt
  r.hcos =
    r.type === 1 && Math.abs(r.d[1]) < 0.7
      ? Math.cos(
          Math.min(
            Math.PI,
            Math.acos(Math.max(-1, Math.min(1, r.cosO))) + 0.35,
          ),
        )
      : -2; // horizontal-ish spot: cone test for grid cells (+0.35 rad margin)
  r.rEff = r.type === 2 ? r.range + Math.hypot(r.hw, r.hh) : r.range; // (rect) reach measured from the centre
  r.vol = Math.min(0.99, Math.max(0, o.volume ?? 0.5));
  r.day = !!o.day;
  r.key = o.key ?? null;
  r.shSlot = 0;
  r.noShadow = o.shadow === false; // key: stable identity of a dynamic light (shadow slots)
  if (r.type === 2) r.lum *= 4 * r.hw * r.hh; // rect: radiance x area ~ intensity
  // highest point the light can reach (fragments above skip the cell): down-facing spots barely light upward
  r.top =
    r.type === 1 && r.d[1] < -0.5
      ? r.p[1] + 0.6
      : r.type === 2
        ? r.p[1] + r.hh + r.range
        : r.type === 1
          ? r.p[1] +
            r.range *
              Math.max(
                0.05,
                Math.sin(
                  Math.asin(Math.max(-1, Math.min(1, r.d[1]))) +
                    Math.acos(Math.max(-1, Math.min(1, r.cosO))),
                ),
              )
          : r.p[1] + r.range; // spots: the cone's highest reach
  r.bot = r.type === 2 ? r.p[1] - r.hh - r.range : r.p[1] - r.range; // (night r9) full reach: a cut at 0.7-0.8 range left horizontal edges where the light was still visible
  return r;
}

const cityLights = {
  enabled: true,
  gain: 1,
  volume: 1,
  incremental: true,
  stats: { lights: 0, cand: 0, cells: 0, maxCell: 0, ms: 0 },
  add(o) {
    const r = toRecord(o);
    r.id = statics.length;
    statics.push(r);
    version++;
    const bx = Math.floor(r.p[0] / BUCKET),
      bz = Math.floor(r.p[2] / BUCKET),
      k = bkey(bx, bz);
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = []));
    b.push(r);
    r.bk = k;
    return r.id;
  },
  update(id, o) {
    const r = statics[id];
    if (!r) return;
    const merged = { ...r.src, ...o };
    r.src = merged;
    version++;
    const k0 = r.bk;
    toRecord(merged, r);
    const k = bkey(Math.floor(r.p[0] / BUCKET), Math.floor(r.p[2] / BUCKET));
    if (k !== k0) {
      const b0 = buckets.get(k0);
      b0?.splice(b0.indexOf(r), 1);
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push(r);
      r.bk = k;
    }
  },
  remove(id) {
    const r = statics[id];
    if (!r) return;
    const b = buckets.get(r.bk);
    if (b) {
      const i = b.indexOf(r);
      if (i >= 0) b.splice(i, 1);
    }
    statics[id] = null;
    version++;
  },
  // opts.moving: its lights move every frame (cars): between full grid rebuilds they are updated in place (matched by key)
  addProvider(fn, opts = {}) {
    const e = { fn, moving: !!opts.moving };
    providers.push(e);
    version++;
    return () => {
      const i = providers.indexOf(e);
      if (i >= 0) providers.splice(i, 1);
      version++;
    };
  },
  invalidate() {
    version++;
  }, // force a full grid rebuild next frame (provider settings changed: the incremental path would keep the old lights)
  get count() {
    return statics.reduce((n, r) => n + (r ? 1 : 0), 0);
  },
  frame: null, // (camera) -> set by update: last grid origin (debug)
  get ambient() {
    return cityAmbient;
  }, // (user r-amb) area ambient around the player (gain: 0 = off, A/B)
};
// keep the source description for update(): add() stores it lazily
{
  const add = cityLights.add;
  cityLights.add = function (o) {
    const id = add.call(this, o);
    statics[id].src = { ...o };
    return id;
  };
}

// dynamic records (providers): a pool reused every frame
const dyn = [];
let dynN = 0;
// (perf r9) incremental frames: full rebuilds only when the view / light set changed; moving lights (cars) in place
let version = 0,
  lastVersion = -1,
  lastK = -1,
  sinceFull = 99;
const lastCam = new THREE.Vector3(1e9, 0, 0),
  lastDir = new THREE.Vector3(),
  _cd = new THREE.Vector3();
const movKeys = new Set(),
  movIdx = new Map(),
  movTmp = {};
function emit(o) {
  const r = dyn[dynN] || (dyn[dynN] = {});
  toRecord(o, r);
  dynN++;
}

const cand = [];
const NC2 = CL_N * CL_N * 2; // cells x 2 height layers
const cellN = new Uint8Array(NC2),
  cellIdx = new Uint16Array(NC2 * CL_SLOTS),
  cellW = new Float32Array(NC2 * CL_SLOTS);
const cellTop = new Float32Array(NC2);
const cellMinW = new Float32Array(NC2),
  cellMinS = new Uint8Array(NC2); // (perf) weakest slot of a full cell
function cellMinFind(c) {
  const b = c * CL_SLOTS;
  let m = 0,
    mw = cellW[b];
  for (let s = 1; s < CL_SLOTS; s++) {
    const ws = cellW[b + s];
    if (ws < mw) {
      mw = ws;
      m = s;
    }
  }
  cellMinW[c] = mw;
  cellMinS[c] = m;
}
const srt = new Uint8Array(CL_SLOTS);
const _gd = new THREE.Vector3();
const _frustum = new THREE.Frustum(),
  _pm = new THREE.Matrix4(),
  _sph = new THREE.Sphere();

function writeRecord(i, r, k) {
  const D = dataArr,
    o = i * 16,
    f = r.day ? 1 : k;
  D[o] = r.p[0];
  D[o + 1] = r.p[1];
  D[o + 2] = r.p[2];
  D[o + 3] = r.rEff; // rect: cut-off measured from the centre
  D[o + 4] = r.c[0] * f;
  D[o + 5] = r.c[1] * f;
  D[o + 6] = r.c[2] * f;
  D[o + 7] = r.type + r.vol;
  D[o + 8] = r.d[0];
  D[o + 9] = r.d[1];
  D[o + 10] = r.d[2];
  if (r.type === 2) {
    D[o + 11] = r.hw;
    D[o + 12] = r.u[0];
    D[o + 13] = r.u[1];
    D[o + 14] = r.u[2];
    D[o + 15] = r.hh;
  } else {
    D[o + 11] = r.cosO;
    D[o + 12] = r.radius;
    D[o + 13] = r.shSlot;
    D[o + 14] = r.spec;
    D[o + 15] = r.cosI;
  }
}
// between full rebuilds: re-run the moving providers and update their lights in place (same grid cells; a car moves
// < 1 m between full rebuilds, well inside its lights' range margins). Returns false (-> full rebuild) when a light
// appeared that the last full build did not know
let movOk = true;
const movEmit = (o) => {
  if (!movOk) return;
  const key = o.key;
  if (key == null || !movKeys.has(key)) {
    movOk = false;
    return;
  }
  const i = movIdx.get(key);
  if (i === undefined) return; // culled at the last full build (outside the view / grid)
  toRecord(o, movTmp);
  const r = cand[i];
  r.p[0] = movTmp.p[0];
  r.p[1] = movTmp.p[1];
  r.p[2] = movTmp.p[2];
  r.d[0] = movTmp.d[0];
  r.d[1] = movTmp.d[1];
  r.d[2] = movTmp.d[2];
  r.c[0] = movTmp.c[0];
  r.c[1] = movTmp.c[1];
  r.c[2] = movTmp.c[2];
  writeRecord(i, r, lastK);
};
function updateMoving(camera, k) {
  movOk = true;
  for (const p of providers)
    if (p.moving) {
      try {
        p.fn(movEmit, camera);
      } catch (e) {
        movOk = false;
      }
      if (!movOk) return false;
    }
  selectShadows(camera, k);
  for (let i = 0; i < cand.length; i++) {
    const r = cand[i];
    if (r.type === 1) dataArr[i * 16 + 13] = r.shSlot;
  }
  dataTex.needsUpdate = true;
  return true;
}
// (r13) CITYL_UNIF materials: the CL_UN records of this frame's list that light the player most (luminance / distance^2,
// inside their reach), copied into the shared uniform array. Records are already final (writeRecord / updateMoving)
const _uP = new THREE.Vector3(),
  uPick = new Int32Array(CL_UN),
  uW = new Float32Array(CL_UN);
function selectUnif(camera) {
  const po =
    typeof window !== "undefined" ? window.__ctx?.player?.object : null;
  if (po) po.getWorldPosition(_uP);
  else _uP.copy(camera.position);
  _uP.y += 1.0;
  let n = 0;
  const N = cityLightsShared.misc.z,
    D = dataArr;
  for (let i = 0; i < N; i++) {
    const o = i * 16,
      dx = D[o] - _uP.x,
      dy = D[o + 1] - _uP.y,
      dz = D[o + 2] - _uP.z,
      d2 = dx * dx + dy * dy + dz * dz,
      R = D[o + 3] + 1.5;
    if (d2 > R * R) continue;
    const lum = D[o + 4] * 0.3 + D[o + 5] * 0.55 + D[o + 6] * 0.15,
      w = (D[o + 7] >= 2 ? lum * 4 * D[o + 11] * D[o + 15] : lum) / (d2 + 1); // rects: radiance x area
    if (n < CL_UN) {
      uPick[n] = i;
      uW[n++] = w;
      continue;
    }
    let m = 0;
    for (let j = 1; j < CL_UN; j++) if (uW[j] < uW[m]) m = j;
    if (w > uW[m]) {
      uPick[m] = i;
      uW[m] = w;
    }
  }
  for (let j = 0; j < n; j++)
    unifArr.set(D.subarray(uPick[j] * 16, uPick[j] * 16 + 16), j * 16);
  unifArr[CL_UN * 16] = n;
}
// (user r-amb: "even in the well lighted areas when i am not directly near the light, suit is dark like normal. shouldn't
// there be an ambient light effect created by all the lights which should cover a wider area") AREA AMBIENT: the light
// that bounces off the lit streets / facades around the player. Every city light within AMB_R m adds a share of its output
// with a soft, wide falloff (AMB_GAIN x flux / (d^2 + AMB_SOFT^2), faded out by ~2.5x its own range), split into a lower
// hemisphere (street bounce) and an upper one. Not frustum-culled (static buckets + all provider lights), smoothed over
// ~0.5 s, so turning the camera or a light switching never pops it. Uniforms only (no texture unit): the suit adds it as
// ambient irradiance on every GPU path (suitFabric.ts), a lit block lifts the whole suit, a dark side street does not.
export const AMB_R = 70,
  AMB_SOFT = 6,
  AMB_GAIN = 0.16;
export const cityAmbient = {
  lo: { value: new THREE.Vector3() },
  hi: { value: new THREE.Vector3() },
  gain: 1,
};
const _aP = new THREE.Vector3(),
  _aLo = new THREE.Vector3(),
  _aHi = new THREE.Vector3();
let ambT = 0;
function ambAdd(r, k) {
  const dx = r.p[0] - _aP.x,
    dy = r.p[1] - _aP.y,
    dz = r.p[2] - _aP.z,
    d2 = dx * dx + dy * dy + dz * dz;
  const Rw = Math.min(AMB_R, Math.max(25, r.rEff * 2.5));
  if (d2 > Rw * Rw) return;
  const d = Math.sqrt(d2),
    win = 1 - THREE.MathUtils.smoothstep(d, 0.55 * Rw, Rw);
  const f =
    ((r.day ? 1 : k) * AMB_GAIN * win * (r.type === 2 ? 4 * r.hw * r.hh : 1)) /
    (d2 + AMB_SOFT * AMB_SOFT);
  // lights above the player bounce off the street (lower hemisphere); lights at / below eye level reach him from the side
  const up = THREE.MathUtils.clamp(dy / (d + 1), -1, 1),
    lo = 0.62 + 0.18 * Math.max(0, up);
  _aLo.x += r.c[0] * f * lo;
  _aLo.y += r.c[1] * f * lo;
  _aLo.z += r.c[2] * f * lo;
  _aHi.x += r.c[0] * f * (1 - lo);
  _aHi.y += r.c[1] * f * (1 - lo);
  _aHi.z += r.c[2] * f * (1 - lo);
}
function updateAmbient(k) {
  const now = performance.now(),
    t0 = now,
    dt = ambT ? Math.min((now - ambT) / 1000, 0.25) : 1;
  ambT = now;
  _aLo.set(0, 0, 0);
  _aHi.set(0, 0, 0);
  const po =
    typeof window !== "undefined" ? window.__ctx?.player?.object : null;
  if (po && cityLights.enabled && k >= 0.01) {
    po.getWorldPosition(_aP);
    _aP.y += 1.0;
    const bx0 = Math.floor((_aP.x - AMB_R) / BUCKET),
      bx1 = Math.floor((_aP.x + AMB_R) / BUCKET),
      bz0 = Math.floor((_aP.z - AMB_R) / BUCKET),
      bz1 = Math.floor((_aP.z + AMB_R) / BUCKET);
    for (let bx = bx0; bx <= bx1; bx++)
      for (let bz = bz0; bz <= bz1; bz++) {
        const b = buckets.get(bkey(bx, bz));
        if (b) for (const r of b) ambAdd(r, k);
      }
    for (let i = 0; i < dynN; i++) ambAdd(dyn[i], k);
    const g = cityAmbient.gain * cityLights.gain;
    _aLo.multiplyScalar(g);
    _aHi.multiplyScalar(g);
  }
  const a = 1 - Math.exp(-dt / 0.5);
  cityAmbient.lo.value.lerp(_aLo, a);
  cityAmbient.hi.value.lerp(_aHi, a);
  cityLights.stats.ambMs = +(performance.now() - t0).toFixed(3);
  cityLights.stats.amb = [
    +cityAmbient.lo.value.x.toFixed(4),
    +cityAmbient.lo.value.y.toFixed(4),
    +cityAmbient.lo.value.z.toFixed(4),
    +cityAmbient.hi.value.y.toFixed(4),
  ];
}
function build(camera) {
  const t0 = performance.now();
  if (_rnd) fixPrograms();
  const S = cityLightsShared,
    k = nightK.value;
  updateAmbient(k);
  if (!cityLights.enabled || k < 0.01) {
    S.origin.w = 0;
    cityLights.stats.lights = 0;
    return;
  }
  camera.getWorldDirection(_cd);
  sinceFull++;
  if (
    cityLights.incremental &&
    version === lastVersion &&
    Math.abs(k - lastK) < 0.005 &&
    sinceFull < 6 &&
    camera.position.distanceToSquared(lastCam) < 1.5 * 1.5 &&
    _cd.dot(lastDir) > 0.9995 &&
    updateMoving(camera, k)
  ) {
    if (unifUsed) selectUnif(camera);
    cityLights.stats.ms = performance.now() - t0;
    cityLights.stats.partial = true;
    return;
  }
  sinceFull = 0;
  lastVersion = version;
  lastK = k;
  lastCam.copy(camera.position);
  lastDir.copy(_cd);
  cityLights.stats.partial = false;
  // grid centre pushed ahead along the view (more so from altitude, where the visible streets are far ahead)
  camera.getWorldDirection(_gd);
  const gl = Math.hypot(_gd.x, _gd.z) || 1;
  const ahead =
    Math.min(210, 70 + 0.6 * Math.max(0, camera.position.y)) *
    Math.min(1, gl * 1.5);
  const cx = camera.position.x + (_gd.x / gl) * ahead,
    cz = camera.position.z + (_gd.z / gl) * ahead;
  const ox = Math.floor(cx / CL_CELL) * CL_CELL - SPAN / 2,
    oz = Math.floor(cz / CL_CELL) * CL_CELL - SPAN / 2;
  S.origin.set(ox, oz, CL_CELL, 1);
  S.misc.x = cityLights.gain;
  S.misc.w = k;
  S.misc.y = (S.misc.y + 1) % 64; // y: frame index (cell-lookup dither)
  camera.updateMatrixWorld();
  _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_pm);
  // gather candidates inside the grid window and the view frustum (by their range sphere)
  cand.length = 0;
  const bx0 = Math.floor(ox / BUCKET),
    bx1 = Math.floor((ox + SPAN) / BUCKET),
    bz0 = Math.floor(oz / BUCKET),
    bz1 = Math.floor((oz + SPAN) / BUCKET);
  const consider = (r) => {
    const R = r.rEff;
    if (
      r.p[0] + R < ox ||
      r.p[0] - R > ox + SPAN ||
      r.p[2] + R < oz ||
      r.p[2] - R > oz + SPAN
    )
      return;
    _sph.center.set(r.p[0], r.p[1], r.p[2]);
    _sph.radius = R;
    if (!_frustum.intersectsSphere(_sph)) return;
    const dx = r.p[0] - camera.position.x,
      dz = r.p[2] - camera.position.z,
      dy = r.p[1] - camera.position.y;
    r.pri = (r.lum * (r.day ? 1 : k)) / (dx * dx + dy * dy + dz * dz + 400);
    cand.push(r);
  };
  for (let bx = bx0; bx <= bx1; bx++)
    for (let bz = bz0; bz <= bz1; bz++) {
      const b = buckets.get(bkey(bx, bz));
      if (b) for (const r of b) consider(r);
    }
  const tG = performance.now();
  dynN = 0;
  movKeys.clear();
  movIdx.clear();
  for (const p of providers) {
    const d0 = dynN;
    try {
      p.fn(emit, camera);
    } catch (e) {
      console.warn("[citylights] provider", e);
    }
    if (p.moving)
      for (let i = d0; i < dynN; i++) {
        dyn[i].mov = true;
        if (dyn[i].key != null) movKeys.add(dyn[i].key);
      }
    else for (let i = d0; i < dynN; i++) dyn[i].mov = false;
  }
  for (let i = 0; i < dynN; i++) consider(dyn[i]);
  const tP = performance.now();
  cityLights.stats.cand = cand.length;
  if (cand.length > CL_MAXL) {
    cand.sort((a, b) => b.pri - a.pri);
    cand.length = CL_MAXL;
  }
  selectShadows(camera, k);
  for (let i = 0; i < cand.length; i++) {
    const r = cand[i];
    if (r.mov && r.key != null) movIdx.set(r.key, i);
  }
  // light records
  for (let i = 0; i < cand.length; i++) writeRecord(i, cand[i], k);
  // bin into cells: each cell keeps its SLOTS strongest lights (weight = luminance at the cell centre)
  const tR = performance.now();
  cellN.fill(0);
  cellTop.fill(-1e3);
  let maxCell = 0,
    used = 0;
  for (let i = 0; i < cand.length; i++) {
    const r = cand[i];
    const R = r.rEff,
      px = r.p[0],
      pz = r.p[2],
      R2 = R * R;
    const i0 = Math.max(0, Math.floor((px - R - ox) / CL_CELL)),
      i1 = Math.min(CL_N - 1, Math.floor((px + R - ox) / CL_CELL));
    const j0 = Math.max(0, Math.floor((pz - R - oz) / CL_CELL)),
      j1 = Math.min(CL_N - 1, Math.floor((pz + R - oz) / CL_CELL));
    const l0 = r.bot < CL_LAYER_Y,
      l1 = r.top >= CL_LAYER_Y; // height layers this light reaches
    const isRect = r.type === 2,
      isCone = r.hcos > -2,
      top = r.top,
      lum = r.lum;
    const dx0 = r.d[0],
      dz0 = r.d[2],
      hl = isCone ? 1 / (Math.sqrt(dx0 * dx0 + dz0 * dz0) || 1) : 0,
      hcos = r.hcos;
    for (let j = j0; j <= j1; j++) {
      const z0 = oz + j * CL_CELL,
        qz = z0 > pz ? z0 - pz : pz > z0 + CL_CELL ? pz - z0 - CL_CELL : 0,
        qz2 = qz * qz;
      if (qz2 > R2) continue;
      for (let ii = i0; ii <= i1; ii++) {
        // distance from the light to the cell rectangle (xz)
        const x0 = ox + ii * CL_CELL,
          qx = x0 > px ? x0 - px : px > x0 + CL_CELL ? px - x0 - CL_CELL : 0;
        const q2 = qx * qx + qz2;
        if (q2 > R2) continue;
        if (isCone && q2 > 16) {
          // narrow horizontal spot (headlights): skip cells outside its cone (xz, with a margin for the cell size)
          const ex = x0 + CL_CELL / 2 - px,
            ez = z0 + CL_CELL / 2 - pz,
            el = Math.sqrt(ex * ex + ez * ez);
          const ca = ((ex * dx0 + ez * dz0) * hl) / el,
            marg = (CL_CELL * 0.75) / el;
          if (ca < hcos - (marg < 1 ? marg : 1)) continue;
        }
        if (
          isRect &&
          (x0 + CL_CELL / 2 - px) * dx0 + (z0 + CL_CELL / 2 - pz) * dz0 <
            -CL_CELL * 0.75
        )
          continue; // rect: cell entirely behind the emitter
        const w = lum / (q2 + 4),
          cb = j * CL_N + ii;
        for (let ly = 0; ly < 2; ly++) {
          if (ly === 0 ? !l0 : !l1) continue;
          const c = ly * CL_N * CL_N + cb;
          const n = cellN[c];
          if (n < CL_SLOTS) {
            cellIdx[c * CL_SLOTS + n] = i;
            cellW[c * CL_SLOTS + n] = w;
            cellN[c] = n + 1;
            if (n + 1 > maxCell) maxCell = n + 1;
            if (n + 1 === CL_SLOTS) cellMinFind(c);
          } else {
            // full: quick reject against the tracked weakest, else replace it and find the new weakest
            if (w <= cellMinW[c]) continue;
            const m = cellMinS[c];
            cellIdx[c * CL_SLOTS + m] = i;
            cellW[c * CL_SLOTS + m] = w;
            cellMinFind(c);
          }
          if (top > cellTop[c]) cellTop[c] = top;
        }
      }
    }
  }
  const tB = performance.now();
  // grid texture: texel 0 = (count, maxY + 1000, idx0, idx1), texels 1..4 = 4 indices each
  const G = gridArr;
  for (let c = 0; c < NC2; c++) {
    const n0 = cellN[c],
      j = (c / CL_N) | 0,
      ii = c - j * CL_N,
      o = (j * CL_N * CL_TPC + ii * CL_TPC) * 4;
    G[o] = n0;
    if (!n0) continue; // empty cell: count 0 (the shader never reads its slots)
    used++;
    G[o + 1] = Math.min(65535, Math.max(0, Math.ceil(cellTop[c] + 1000)));
    const cw = c * CL_SLOTS;
    if (n0 > 5) {
      // (perf) strongest first only matters where the shader's far / foliage LOD cuts the list (>= 5 kept)
      for (let s = 0; s < n0; s++) {
        // insertion sort, no allocation
        const wv = cellW[cw + s];
        let k = s;
        while (k > 0 && cellW[cw + srt[k - 1]] < wv) {
          srt[k] = srt[k - 1];
          k--;
        }
        srt[k] = s;
      }
      for (let s = 0; s < n0; s++) G[o + 2 + s] = cellIdx[cw + srt[s]];
    } else for (let s = 0; s < n0; s++) G[o + 2 + s] = cellIdx[cw + s];
  }
  dataTex.needsUpdate = true;
  gridTex.needsUpdate = true;
  S.misc.z = cand.length;
  if (unifUsed) selectUnif(camera);
  const st = cityLights.stats;
  st.lights = cand.length;
  st.cells = used;
  st.maxCell = maxCell;
  st.ms = performance.now() - t0;
  const tE = performance.now();
  st.split = {
    static: +(tG - t0).toFixed(2),
    providers: +(tP - tG).toFixed(2),
    records: +(tR - tP).toFixed(2),
    bin: +(tB - tR).toFixed(2),
    texture: +(tE - tB).toFixed(2),
  };
}

// ------------------------------------------------------------------------------------------------ shadow slots
const shCams = Array.from(
  { length: CL_SH_N },
  () => new THREE.PerspectiveCamera(90, 1, 0.1, 30),
);
const shMats = Array.from({ length: CL_SH_N }, () => {
  const m = new THREE.MeshDistanceMaterial();
  // the cars' shadow stand-ins (instanced, coarse) are shrunk 0.2 m along their normals: the real car body always sits
  // outside its caster (no saw-tooth self-shadowing on roofs / doors); the shadow on the road is barely smaller
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      "#include <begin_vertex>",
      citylightsShader.vertexBeginVertex,
    );
  };
  m.customProgramCacheKey = () => "clShrink";
  return m;
});
const shFake = Array.from({ length: CL_SH_N }, () => ({
  matrixWorld: new THREE.Matrix4(),
  shadow: { camera: { near: 0.1, far: 30 } },
}));
const shSlots = Array.from({ length: CL_SH_N }, () => ({
  id: null,
  rec: null,
  w: 0,
}));
const shPick = [];
let shT = 0;
const _f = new THREE.Vector3(),
  _up = new THREE.Vector3(),
  _tg = new THREE.Vector3();
const shId = (r) =>
  r.key != null ? "k" + r.key : r.id != null ? "s" + r.id : null;
// choose the spot lights that light the player (or the view centre) the most; keep current ones (hysteresis) so the
// player's shadows don't flicker between lamps; new slots fade in
function selectShadows(camera, k) {
  const now = performance.now(),
    dt = shT ? Math.min((now - shT) / 1000, 0.1) : 0;
  shT = now;
  const po =
    typeof window !== "undefined" ? window.__ctx?.player?.object : null;
  if (po) po.getWorldPosition(_f);
  else _f.copy(camera.position);
  if (!po || _f.distanceToSquared(camera.position) > 150 * 150) {
    camera.getWorldDirection(_tg);
    _f.copy(camera.position).addScaledVector(_tg, 12);
  }
  _f.y += 0.9;
  shPick.length = 0;
  for (const r of cand) r.shSlot = 0;
  if (cityLights.shadows)
    for (const r of cand) {
      if (r.type !== 1 || r.noShadow) continue;
      const id = shId(r);
      if (!id) continue;
      const dx = _f.x - r.p[0],
        dy = _f.y - r.p[1],
        dz = _f.z - r.p[2],
        d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r.range * r.range) continue;
      const dd = Math.sqrt(d2) || 1,
        ca = (dx * r.d[0] + dy * r.d[1] + dz * r.d[2]) / dd;
      const t = Math.min(
          1,
          Math.max(0, (ca - r.cosO) / Math.max(r.cosI - r.cosO, 1e-3)),
        ),
        cone = t * t * (3 - 2 * t);
      if (cone <= 0) continue;
      let imp = (r.lum * cone) / (d2 + 1);
      if (shSlots.some((s) => s.id === id)) imp *= 1.6;
      r._imp = imp;
      r._id = id;
      shPick.push(r);
    }
  shPick.sort((a, b) => b._imp - a._imp);
  if (shPick.length > CL_SH_N) shPick.length = CL_SH_N;
  // keep slots whose light is still picked, then fill the free ones
  for (const s of shSlots) {
    const r = shPick.find((q) => q._id === s.id);
    if (r) {
      s.rec = r;
      s.w = Math.min(1, s.w + dt * 3);
    } else {
      s.id = null;
      s.rec = null;
      s.w = 0;
    }
  }
  for (const r of shPick)
    if (!shSlots.some((s) => s.id === r._id)) {
      const s = shSlots.find((q) => !q.id);
      if (s) {
        s.id = r._id;
        s.rec = r;
        s.w = dt ? 0 : 1;
        s.fresh = true;
      }
    }
  const W = cityLightsShared.shW;
  shSlots.forEach((s, i) => {
    W.setComponent(i, s.rec ? s.w : 0);
    if (!s.rec) return;
    const r = s.rec;
    r.shSlot = i + 1;
    const cam = shCams[i];
    cam.position.set(r.p[0], r.p[1], r.p[2]);
    _up.set(0, 1, 0);
    if (Math.abs(r.d[1]) > 0.95) _up.set(0, 0, 1);
    cam.up.copy(_up);
    cam.lookAt(_tg.set(r.p[0] + r.d[0], r.p[1] + r.d[1], r.p[2] + r.d[2]));
    cam.fov = Math.min(
      150,
      THREE.MathUtils.radToDeg(Math.acos(Math.max(-0.99, r.cosO))) * 2 + 4,
    );
    cam.near = 0.1;
    cam.far = r.range;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    shFake[i].matrixWorld.copy(cam.matrixWorld);
    shFake[i].shadow.camera.far = r.range;
    // (the receiver matrix shM[i] is set when the tile is rendered: round-robin, see renderShadows)
  });
}
const _cc = new THREE.Color();
let shFrame = 0;
// render the distance maps of the active slots (pipeline, before the scene pass). Casters: the player (CHAR_LAYER 30)
// and the cars' shadow stand-ins (SHADOW_PROXY_LAYER 29)
function renderShadows(renderer, scene) {
  if (cityLightsShared.origin.w <= 0 || !shSlots.some((s) => s.rec)) return;
  const oldAuto = renderer.shadowMap.autoUpdate,
    oldOv = scene.overrideMaterial,
    oldRT = renderer.getRenderTarget();
  renderer.getClearColor(_cc);
  const oldA = renderer.getClearAlpha();
  renderer.shadowMap.autoUpdate = false;
  const oldAC = renderer.autoClear;
  renderer.autoClear = false; // tiles are cleared once below; caster passes add to them
  renderer.setClearColor(0xffffff, 1);
  // (perf r5) round-robin: 2 of the 4 tiles per frame (moving casters update at ~30 Hz), a newly assigned slot at once;
  // each tile keeps the receiver matrix it was rendered with, so a moving headlight's stale tile still lines up
  shFrame++;
  shadowRT.scissorTest = true;
  // the player right at the camera (fixed-camera shots / clipping) would throw a huge shadow from the camera position
  const po =
      typeof window !== "undefined" ? window.__ctx?.player?.object : null,
    cam0 = window.__ctx?.camera;
  const skipChar = !!(
    po &&
    cam0 &&
    po.position.distanceToSquared(cam0.position) < 2.5 * 2.5
  );
  shSlots.forEach((s, i) => {
    if (!s.rec || !(s.fresh || ((shFrame + i) & 1) === 0)) return;
    s.fresh = false;
    const x = (i & 1) * CL_SH_TILE,
      y = (i >> 1) * CL_SH_TILE;
    shadowRT.viewport.set(x, y, CL_SH_TILE, CL_SH_TILE);
    shadowRT.scissor.set(x, y, CL_SH_TILE, CL_SH_TILE);
    renderer.setRenderTarget(shadowRT);
    renderer.clear(true, true, false); // scissored: this tile only
    cityLightsShared.shM[i].multiplyMatrices(
      shCams[i].projectionMatrix,
      shCams[i].matrixWorldInverse,
    );
    const cam = shCams[i];
    cam.layers.set(skipChar ? 29 : 30);
    cam.layers.enable(29);
    renderer.properties.get(shMats[i]).light = shFake[i];
    scene.overrideMaterial = shMats[i];
    renderer.render(scene, cam);
    // extra casters with their own distance material (custom vertex animation, e.g. pedestrians)
    if (casters.length) {
      scene.overrideMaterial = null;
      cam.layers.enableAll();
      for (const c of casters) {
        const m = c.mesh;
        if (!m.visible || m.count === 0) continue;
        const m0 = m.material;
        m.material = c.material;
        renderer.properties.get(c.material).light = shFake[i];
        renderer.render(m, cam);
        m.material = m0;
      }
    }
  });
  shadowRT.scissorTest = false;
  shadowRT.viewport.set(0, 0, CL_SH_TILE * 2, CL_SH_TILE * 2);
  scene.overrideMaterial = oldOv;
  renderer.autoClear = oldAC;
  renderer.setClearColor(_cc, oldA);
  renderer.shadowMap.autoUpdate = oldAuto;
  renderer.setRenderTarget(oldRT);
}
cityLights.renderShadows = renderShadows;
// cityLights.addCaster(mesh, distanceMaterial): mesh also casts city-light shadows, rendered with its own
// MeshDistanceMaterial (patched like its depth material, e.g. the crowd's skinning); returns a remove function
const casters = [];
cityLights.addCaster = (mesh, material) => {
  const c = { mesh, material };
  casters.push(c);
  return () => {
    const i = casters.indexOf(c);
    if (i >= 0) casters.splice(i, 1);
  };
};
cityLights.shadows = true;
cityLights.shadowSlots = shSlots;
cityLights.shadowRT = shadowRT; // debug
cityLights.build = build;
cityLights.shared = cityLightsShared;
export { cityLights };
