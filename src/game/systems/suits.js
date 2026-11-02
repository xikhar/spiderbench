// OWNER: systems engineer. Suit variants applied to the character's `SpiderSuit` material via a shader patch
// (render/materials.js addShaderPatch chaining). The base-colour texture is split into soft classes
// (red rubber / navy fabric / white emblem+palms / black web lines) and each class is re-coloured with a
// luminance-preserving remap, plus per-class roughness / metalness / emissive. Lenses get tinted / emissive too.
// Uniform-only updates after the first compile: switching suits never recompiles.
import * as THREE from 'three';
import { addShaderPatch } from '../../render/materials.js';
import { setSuitFabric } from '../../player/suitfabric.js';
import { setWebVenom } from '../../player/web.js';

const C = (r, g, b) => new THREE.Vector3(r, g, b);
// colours are LINEAR albedo; rough/metal: -1 = keep original
export const SUITS = [
  { id: 'advanced', name: 'Advanced Suit', level: 1, desc: 'Peter\'s own design. Lighter, tougher, and the emblem finally glows white.',
    swatch: ['#b3121b', '#16234d', '#f2f2f2'], strength: 0 },
  { id: 'iron', name: 'Iron Spider', level: 5, desc: 'Stark nanotech armour plating in crimson and gold.',
    swatch: ['#a01010', '#d9a52b', '#e8c05a'], strength: 1, emblem: 'iron',
    red: C(0.5, 0.02, 0.018), blue: C(0.78, 0.46, 0.1), white: C(0.95, 0.7, 0.25), black: C(0.12, 0.012, 0.01),
    rough: [0.22, 0.28, 0.22, 0.3], metal: [0.85, 1, 1, 0.7], lens: { color: 0xffffff, emissive: 0xdde8ff, intensity: 0.6 } },
  // user r-symbiote: Insomniac SM2 black suit (refs/suit/symbiote_ref.jpg). Whole baked texture -> wet black (web lines
  // and the Advanced emblem vanish; its normal-map relief is switched off), big white jagged spider drawn procedurally
  // front + back (canvas mask, buildSymMask / SYM; r10i) and procedural raised veins via bump (sysVeins).
  { id: 'symbiote', name: 'Symbiote Suit', level: 1, desc: 'A living black suit that bonded to Peter. Stronger, faster, angrier. It wants more.',
    swatch: ['#0a0b0e', '#16181d', '#f0f0f2'], strength: 1, symbiote: 1, normalScale: 0, env: 1.6,
    red: C(0.009, 0.009, 0.011), blue: C(0.009, 0.009, 0.011), white: C(0.009, 0.009, 0.011), black: C(0.009, 0.009, 0.011),
    rough: [0.18, 0.16, 0.42, 0.58], metal: [0, 0, 0, 0], lens: { color: 0xffffff, emissive: 0xffffff, intensity: 0.12 } },
];

export function createSuits(ctx) {
  const uniforms = {
    uSuitOn: { value: 0 }, uSuitR: { value: C(1, 0, 0) }, uSuitB: { value: C(0, 0, 1) }, uSuitW: { value: C(1, 1, 1) }, uSuitK: { value: C(0, 0, 0) },
    uSuitRough: { value: new THREE.Vector4(-1, -1, -1, -1) }, uSuitMetal: { value: new THREE.Vector4(-1, -1, -1, -1) },
    uSuitER: { value: C(0, 0, 0) }, uSuitEB: { value: C(0, 0, 0) }, uSuitEW: { value: C(0, 0, 0) }, uSuitEK: { value: C(0, 0, 0) },
    uEmbMode: { value: 0 }, uEmbFront: { value: C(0, 0, 0) }, uEmbBack: { value: C(0, 0, 0) }, uEmbBackOn: { value: 0 }, uEmbScale: { value: new THREE.Vector2(0.075, 0.15) },
    uSym: { value: 0 }, uSymBump: { value: 1 }, uSymW: { value: C(0.72, 0.72, 0.75) }, uSymMask: { value: null },
  };
  let suitMat = null, lensMat = null, lensOrig = null, current = null, nrmOrig = null;
  let placeholderMats = [];

  function patch(mat) {
    addShaderPatch(mat, 'systemsSuit', sh => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSysRestP; varying vec3 vSysRestN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSysRestP = position; vSysRestN = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uSuitOn; uniform vec3 uSuitR, uSuitB, uSuitW, uSuitK, uSuitER, uSuitEB, uSuitEW, uSuitEK; uniform vec4 uSuitRough, uSuitMetal;
uniform float uEmbMode; uniform vec3 uEmbFront, uEmbBack; uniform float uEmbBackOn; uniform vec2 uEmbScale;
varying vec3 vSysRestP; varying vec3 vSysRestN;
float sysSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float sysEll(vec2 p, vec2 c, vec2 r) { return (length((p - c) / r) - 1.0) * min(r.x, r.y); }
// spider emblem SDF in the bind-pose body plane (metres). c = body centre, s = scale, w = leg width
float sysSpider(vec2 p, vec2 c, float s, float w) {
  vec2 q = (p - c) / s; q.x = abs(q.x);
  float d = min(sysEll(q, vec2(0.0, 0.36), vec2(0.16, 0.2)), sysEll(q, vec2(0.0, -0.12), vec2(0.23, 0.36)));
  float lw = w / s;
  d = min(d, sysSeg(q, vec2(0.08, 0.40), vec2(0.42, 0.78)) - lw); d = min(d, sysSeg(q, vec2(0.42, 0.78), vec2(0.36, 1.30)) - lw * 0.8);
  d = min(d, sysSeg(q, vec2(0.12, 0.30), vec2(0.62, 0.46)) - lw); d = min(d, sysSeg(q, vec2(0.62, 0.46), vec2(0.92, 0.90)) - lw * 0.8);
  d = min(d, sysSeg(q, vec2(0.12, 0.14), vec2(0.64, 0.02)) - lw); d = min(d, sysSeg(q, vec2(0.64, 0.02), vec2(0.96, -0.52)) - lw * 0.8);
  d = min(d, sysSeg(q, vec2(0.10, 0.04), vec2(0.46, -0.40)) - lw); d = min(d, sysSeg(q, vec2(0.46, -0.40), vec2(0.44, -1.05)) - lw * 0.8);
  return d * s;
}
// ---- symbiote suit (user r-symbiote)
uniform float uSym, uSymBump; uniform vec3 uSymW; uniform sampler2D uSymMask;
// emblem mask (built on a canvas by buildSymMask): planar bind-pose projection, x -0.32..0.32 m, y 0.92..1.56 m;
// R = front spider, G = back spider
vec2 sysSymUV(vec2 p) { return vec2((p.x + 0.32) / 0.64, (p.y - 0.92) / 0.64); }
vec3 sysH3(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
float sysNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(sysH3(i), f), dot(sysH3(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
                 mix(dot(sysH3(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), dot(sysH3(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
             mix(mix(dot(sysH3(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), dot(sysH3(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
                 mix(dot(sysH3(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), dot(sysH3(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y), u.z);
}
// organic raised veins (0..1): the zero-set of gradient noise (a branching network) turned into even-width ridges
// by dividing by the noise gradient; stretched along the limbs (A-pose arms / vertical legs + torso) so they follow
// the muscles, broken up by a low-frequency mask; weaker on the emblem area; faded out once sub-pixel.
float sysRidge(vec3 q, float w, float fw) {
  float n = sysNoise(q), e = 0.03;
  vec3 g = vec3(sysNoise(q + vec3(e, 0, 0)), sysNoise(q + vec3(0, e, 0)), sysNoise(q + vec3(0, 0, e))) - n;
  float d = abs(n) / max(length(g) / e, 0.15);
  return exp(-(d * d) / (w * w)) * (1.0 - smoothstep(w * 0.8, w * 2.5, fw));
}
float sysVeins(vec3 P) {
  float armW = smoothstep(0.19, 0.27, abs(P.x)) * smoothstep(0.8, 0.95, P.y);
  vec3 ax = normalize(mix(vec3(0.0, 1.0, 0.0), vec3(sign(P.x) * 0.66, -0.75, 0.0), armW));
  float al = dot(P, ax); vec3 q = (P - ax * al + ax * al * 0.33) * 13.0;
  float fw = length(fwidth(q));
  float m1 = smoothstep(-0.4, -0.05, sysNoise(q * 0.35 + 11.0)), m2 = smoothstep(-0.2, 0.15, sysNoise(q * 0.6 - 5.0));
  float v = max(sysRidge(q + 3.1, 0.075, fw) * m1, 0.6 * sysRidge(q * 2.3 + 7.7, 0.07, fw * 2.3) * m2);
  v = max(v, 0.85 * sysRidge(q * 0.5 + 1.7, 0.065, fw * 0.5) * smoothstep(-0.3, 0.0, sysNoise(q * 0.2 - 3.0))); // coarse tendrils: still read at gameplay distance
  float mid = (1.0 - smoothstep(0.06, 0.13, abs(P.x))) * smoothstep(1.02, 1.1, P.y) * (1.0 - smoothstep(1.46, 1.52, P.y));
  return v * (1.0 - 0.7 * mid);
}`)
        .replace('#include <map_fragment>', `#include <map_fragment>
vec4 sysW = vec4(0.0); float sysH = 0.0, sysGloss = 1.0;
if (uSuitOn > 0.5) {
  vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); float sat = (mx - mn) / max(mx, 1e-4);
  float wR = smoothstep(0.03, 0.12, c.r - max(c.g, c.b));
  float wB = smoothstep(0.015, 0.05, c.b - max(c.r, c.g)) * (1.0 - wR);
  float wW = smoothstep(0.22, 0.42, lum) * (1.0 - smoothstep(0.18, 0.4, sat)) * (1.0 - wR) * (1.0 - wB);
  float wK = (1.0 - smoothstep(0.035, 0.12, lum)) * (1.0 - wR) * (1.0 - wB) * (1.0 - wW);
  sysW = vec4(wR, wB, wW, wK);
  vec3 o = c;
  o = mix(o, uSuitR * clamp(lum / 0.066, 0.0, 2.5), wR);
  o = mix(o, uSuitB * clamp(lum / 0.025, 0.0, 2.5), wB);
  o = mix(o, uSuitW * clamp(lum / 0.67, 0.0, 1.5), wW);
  o = mix(o, uSuitK * clamp(lum / 0.035, 0.3, 2.0), wK);
  // suit-specific emblem, drawn procedurally on the bind-pose body (independent of the UV layout)
  if (uEmbMode > 0.5) {
    vec3 P = vSysRestP, N = normalize(vSysRestN); float aa = 0.0015;
    float front = step(0.02, P.z) * smoothstep(0.15, 0.45, N.z) * step(abs(P.x), 0.2);
    float dF = sysSpider(P.xy, vec2(0.0, 1.345 - (uEmbScale.x - 0.075) * 0.4), uEmbScale.x, 0.0048 * uEmbScale.x / 0.075);
    float mF = front * (1.0 - smoothstep(-aa, aa, dF));
    o = mix(o, uEmbFront, mF); sysW = mix(sysW, vec4(0.0, 0.0, 0.0, 1.0), mF);
    float back = step(P.z, -0.0) * smoothstep(0.15, 0.45, -N.z) * uEmbBackOn;
    float dB = sysSpider(vec2(P.x, P.y), vec2(0.0, 1.24), uEmbScale.y, 0.009 * uEmbScale.y / 0.15);
    float mB = back * (1.0 - smoothstep(-aa, aa, dB));
    o = mix(o, uEmbBack, mB); sysW = mix(sysW, vec4(1.0, 0.0, 0.0, 0.0), mB);
  }
  if (uSym > 0.5) { // symbiote: wet black (texture detail discarded) + white emblem + vein relief
    vec3 P = vSysRestP;
    float front = smoothstep(-0.012, 0.012, P.z);
    vec2 uv = sysSymUV(P.xy); float inR = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    // keep the emblem off the hanging arms: torso half-width grows from the waist to the shoulders
    inR *= step(abs(P.x), mix(0.16, 0.27, smoothstep(1.24, 1.46, P.y)));
    vec4 mk = texture2D(uSymMask, uv), mkS = texture2D(uSymMask, uv, 1.5);
    float mE = mix(mk.g, mk.r, front) * inR, mS = mix(mkS.g, mkS.r, front) * inR;
    float v = sysVeins(P) * (1.0 - smoothstep(0.2, 0.5, mS));
    float fwP = length(fwidth(P)) * 70.0;
    float micro = (sysNoise(P * 70.0) + 0.5 * sysNoise(P * 150.0 + 4.0)) * (1.0 - smoothstep(0.3, 1.0, fwP)); // wet organic breakup
    sysH = v * 0.005 + mS * 0.0014 + mE * 0.0006 + micro * 0.00035 * (1.0 - mE);
    float sheen = sysNoise(P * 5.0 + 2.0);                          // slow dark sheen variation (subsurface-ish)
    o = uSuitK * (0.75 + 0.6 * sheen) * vec3(0.95, 0.97, 1.08) + vec3(0.035, 0.038, 0.048) * v;
    o = mix(o, uSymW * (0.82 + 0.18 * smoothstep(0.6, 1.0, mS)), mE); // slightly greyer rim, like the ref
    // user r10k: not uniformly wet. Multi-octave noise with a sharp threshold picks distinct glossy wet blotches
    // (~30 % of the surface) + the vein crests; everything else is satin/matte (rough slots: gloss/vein/emblem/matte)
    float gn = sysNoise(P * 5.5 + 9.0) + 0.5 * sysNoise(P * 12.0 - 2.0) + 0.25 * sysNoise(P * 26.0 + 5.0);
    float gp = smoothstep(0.17, 0.23, gn) * (1.0 - mE);
    float vc = smoothstep(0.5, 0.85, v) * (1.0 - mE);
    sysGloss = max(gp, vc);
    sysW = vec4(gp * (1.0 - vc), vc, mE, (1.0 - gp) * (1.0 - vc) * (1.0 - mE));
  }
  diffuseColor.rgb = o;
}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
if (uSuitOn > 0.5) { vec4 rr = mix(vec4(roughnessFactor), uSuitRough, step(0.0, uSuitRough)); float ws = dot(sysW, vec4(1.0));
  roughnessFactor = mix(roughnessFactor, dot(rr, sysW) / max(ws, 1e-3), clamp(ws, 0.0, 1.0)); }`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
if (uSuitOn > 0.5) { vec4 mm = mix(vec4(metalnessFactor), uSuitMetal, step(0.0, uSuitMetal)); float ws = dot(sysW, vec4(1.0));
  metalnessFactor = mix(metalnessFactor, dot(mm, sysW) / max(ws, 1e-3), clamp(ws, 0.0, 1.0)); }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (uSuitOn > 0.5 && uSym > 0.5) { // bump from the symbiote height field (Mikkelsen surface-gradient, view space)
  vec3 sp = -vViewPosition, dpx = dFdx(sp), dpy = dFdy(sp); float hx = dFdx(sysH), hy = dFdy(sysH);
  vec3 R1 = cross(dpy, normal), R2 = cross(normal, dpx); float det = dot(dpx, R1);
  normal = normalize(abs(det) * normal - sign(det) * (hx * R1 + hy * R2) * uSymBump);
}`)
        .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
if (uSuitOn > 0.5 && uSym > 0.5) radiance *= mix(1.0 / 1.6, 1.0, sysGloss); // env boost (S.env) only on the wet patches (r10k)`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uSuitOn > 0.5) totalEmissiveRadiance += uSuitER * sysW.x + uSuitEB * sysW.y + uSuitEW * sysW.z + uSuitEK * sysW.w;`);
    });
  }

  function find() {
    const obj = ctx.player?.object; if (!obj) return;
    let s = null, l = null; const all = [];
    obj.traverse(o => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (!m) continue;
        if (m.name === 'SpiderSuit' || (!s && o.name === 'SpiderMan')) s = m;
        else if (m.name === 'Lens') l = m;
        all.push(m);
      }
    });
    if (s && s !== suitMat) { suitMat = s; nrmOrig = s.normalScale?.clone() || null; if (!s.userData.__patches?.has('systemsSuit')) patch(s); }
    if (l && l !== lensMat) { lensMat = l; lensOrig = { color: l.color.clone(), emissive: l.emissive.clone(), intensity: l.emissiveIntensity }; }
    if (!s) placeholderMats = all.filter(m => m.color && !m.userData.__sysOrig && (m.userData.__sysOrig = m.color.clone()));
  }

  // ---------------------------------------------------------------- per-suit base texture
  // Suits with their own emblem (Iron) use a "clean" copy of the loaded SpiderSuit basecolor: every white
  // area (Advanced emblem + its dark outline, glove palms, forearm stripes) is in-painted from the surrounding suit
  // colour with a boundary-inward flood fill (works for any UV layout; no hard-coded UV regions). The new emblem is
  // then drawn procedurally in the shader on the bind-pose body (see sysSpider), so it always lands on the chest/back.
  let origMap = null, cleanMap = null;
  function buildClean() {
    const img = origMap?.image; if (!img || !img.width) return null;
    const N = 2048, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, N, N);
    const id = g.getImageData(0, 0, N, N), px = id.data, NN = N * N;
    const M = new Uint8Array(NN); // 1 = to fill
    const lum = i => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    for (let k = 0; k < NN; k++) { const i = k * 4, r = px[i], gg = px[i + 1], b = px[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); if (mx > 196 && mx - mn < 45) M[k] = 1; }
    // swallow the emblem's anti-aliased rim + leg tips unconditionally (3 px), then its dark outline (3 px more)
    for (let it = 0; it < 3; it++) {
      const add = []; for (let k = 0; k < NN; k++) { if (M[k]) continue; const x = k % N; if ((x > 0 && M[k - 1]) || (x < N - 1 && M[k + 1]) || (k >= N && M[k - N]) || (k < NN - N && M[k + N])) add.push(k); }
      for (const k of add) M[k] = 1;
    }
    for (let it = 0; it < 3; it++) {
      const add = [];
      for (let k = 0; k < NN; k++) { if (M[k]) continue; const x = k % N; if ((x > 0 && M[k - 1]) || (x < N - 1 && M[k + 1]) || (k >= N && M[k - N]) || (k < NN - N && M[k + N])) { const i = k * 4; const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]); if (lum(i) < 70 || lum(i) > 82 || (mx - mn) < 60) add.push(k); } } // dark outline or light anti-aliased rim
      for (const k of add) M[k] = 1;
    }
    const isBg = i => Math.abs(px[i] - 78) < 18 && Math.abs(px[i + 1] - 38) < 18 && Math.abs(px[i + 2] - 62) < 18;
    const src = k => !M[k] && !isBg(k * 4) && lum(k * 4) > 45; // sample suit colour, not web lines / padding
    // boundary-inward fill
    let front = [];
    for (let k = 0; k < NN; k++) if (M[k]) { const x = k % N; if ((x > 0 && src(k - 1)) || (x < N - 1 && src(k + 1)) || (k >= N && src(k - N)) || (k < NN - N && src(k + N))) front.push(k); }
    const filled = new Uint8Array(NN);
    for (let pass = 0; pass < 400 && front.length; pass++) {
      const next = [];
      for (const k of front) {
        if (!M[k]) continue; const x = k % N; let r = 0, gg = 0, b = 0, n = 0;
        for (const j of [x > 0 ? k - 1 : -1, x < N - 1 ? k + 1 : -1, k - N, k + N]) { if (j < 0 || j >= NN || M[j] || isBg(j * 4)) continue; if (!filled[j] && lum(j * 4) <= 45) continue; const i = j * 4; r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++; }
        if (!n) { next.push(k); continue; }
        const i = k * 4; px[i] = r / n; px[i + 1] = gg / n; px[i + 2] = b / n; M[k] = 0; filled[k] = 1;
        for (const j of [x > 0 ? k - 1 : -1, x < N - 1 ? k + 1 : -1, k - N, k + N]) if (j >= 0 && j < NN && M[j]) next.push(j);
      }
      front = next;
    }
    g.putImageData(id, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.flipY = origMap.flipY; t.colorSpace = origMap.colorSpace; t.wrapS = origMap.wrapS; t.wrapT = origMap.wrapT;
    t.anisotropy = origMap.anisotropy; t.channel = origMap.channel; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  const EMB = {
    iron: { mode: 1, front: C(0.95, 0.66, 0.2), back: C(0.95, 0.66, 0.2), backOn: 1, scale: [0.105, 0.16] },
  };
  // ---------------------------------------------------------------- symbiote emblem mask (user r10i)
  // Traced from refs/suit/symbiote_ref.jpg in bind-pose body metres (right half, mirrored). Every limb is a tapered
  // polygon (half-widths per point, last point = sharp tip). Front: head + mandibles at the sternum, body widest at the
  // chest tapering to a point above the navel; top legs sweep up over the collarbones onto the deltoids; the others
  // fan across the pecs / ribs as jagged lightning claws that wrap the torso sides. Back: same spider between the
  // shoulder blades, body down the spine, legs over the traps / scapulae.
  const SYM = {
    front: {
      head: [0, 1.463, 0.02, 0.019],
      body: [[0, 1.445, 0.014], [0, 1.415, 0.028], [0, 1.36, 0.04], [0, 1.29, 0.042], [0, 1.21, 0.036], [0, 1.13, 0.026], [0, 1.09, 0.016], [0, 1.055, 0]],
      legs: [
        [[0.008, 1.475, 0.005], [0.018, 1.492, 0.0035], [0.026, 1.502, 0]],                                   // mandible
        [[0.012, 1.455, 0.011], [0.04, 1.482, 0.011], [0.09, 1.497, 0.0105], [0.15, 1.5, 0.01], [0.2, 1.478, 0.009], [0.226, 1.42, 0.007], [0.232, 1.35, 0]],
        [[0.018, 1.425, 0.014], [0.12, 1.412, 0.013], [0.162, 1.38, 0.011], [0.188, 1.395, 0.009], [0.2, 1.31, 0]],
        [[0.022, 1.39, 0.014], [0.115, 1.305, 0.013], [0.155, 1.33, 0.011], [0.172, 1.23, 0.0095], [0.19, 1.25, 0.0075], [0.195, 1.15, 0]],
        [[0.026, 1.355, 0.014], [0.085, 1.24, 0.012], [0.12, 1.265, 0.011], [0.135, 1.15, 0.009], [0.155, 1.168, 0.007], [0.15, 1.06, 0]],
      ],
    },
    back: {
      head: [0, 1.458, 0.024, 0.023],
      body: [[0, 1.44, 0.014], [0, 1.41, 0.025], [0, 1.35, 0.034], [0, 1.26, 0.039], [0, 1.16, 0.037], [0, 1.07, 0.03], [0, 1.02, 0.019], [0, 0.985, 0]],
      legs: [
        [[0.01, 1.47, 0.0055], [0.02, 1.488, 0.004], [0.03, 1.5, 0]],
        [[0.014, 1.452, 0.012], [0.05, 1.495, 0.012], [0.1, 1.52, 0.011], [0.165, 1.52, 0.0105], [0.212, 1.49, 0.009], [0.238, 1.43, 0.007], [0.242, 1.36, 0]],
        [[0.02, 1.415, 0.0125], [0.12, 1.445, 0.012], [0.17, 1.47, 0.011], [0.192, 1.39, 0.009], [0.188, 1.3, 0]],
        [[0.022, 1.375, 0.0125], [0.105, 1.27, 0.012], [0.145, 1.3, 0.011], [0.168, 1.19, 0.0095], [0.19, 1.21, 0.0075], [0.19, 1.1, 0]],
        [[0.024, 1.335, 0.012], [0.085, 1.18, 0.011], [0.12, 1.205, 0.011], [0.14, 1.08, 0.009], [0.16, 1.095, 0.007], [0.155, 0.99, 0]],
      ],
    },
  };
  let symMask = null;
  function buildSymMask() {
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
    const X = x => (x + 0.32) / 0.64 * N, Y = y => (1.56 - y) / 0.64 * N, W = w => w / 0.64 * N;
    function limb(pts, sx) {    // tapered polygon with mitred joints
      const L = [], R = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const n1 = i > 0 ? [-(p[1] - a[1]), p[0] - a[0]] : null, n2 = i < pts.length - 1 ? [-(b[1] - p[1]), b[0] - p[0]] : null;
        const nz = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
        let n = n1 && n2 ? nz([nz(n1)[0] + nz(n2)[0], nz(n1)[1] + nz(n2)[1]]) : nz(n1 || n2);
        const m = n1 && n2 ? Math.min(2, 1 / Math.max(0.3, n[0] * nz(n1)[0] + n[1] * nz(n1)[1])) : 1;
        L.push([X(sx * (p[0] + n[0] * p[2] * m)), Y(p[1] + n[1] * p[2] * m)]); R.push([X(sx * (p[0] - n[0] * p[2] * m)), Y(p[1] - n[1] * p[2] * m)]);
      }
      g.beginPath(); [...L, ...R.reverse()].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
    }
    function spider(E, col) {
      g.fillStyle = col;
      for (const sx of [1, -1]) { limb(E.body, sx); for (const l of E.legs) limb(l, sx); }
      const [hx, hy, rx, ry] = E.head; g.beginPath(); g.ellipse(X(hx), Y(hy), W(rx), W(ry), 0, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'lighter';
    spider(SYM.front, '#ff0000'); spider(SYM.back, '#00ff00');
    if (typeof window !== 'undefined' && window.__symGrid) { // debug: 5 cm grid (blue channel is unused by the shader -> draw into both)
      g.fillStyle = '#404000'; for (let v = -0.3; v <= 0.3001; v += 0.05) g.fillRect(X(v) - 1, 0, 2, N); for (let v = 0.95; v <= 1.5501; v += 0.05) g.fillRect(0, Y(v) - 1, N, 2);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  function suitMap(S) {
    if (!suitMat) return;
    if (!origMap) origMap = suitMat.map; if (!origMap) return;
    const E = EMB[S.emblem];
    uniforms.uEmbMode.value = E ? E.mode : 0;
    if (E) { uniforms.uEmbFront.value.copy(E.front); uniforms.uEmbBack.value.copy(E.back); uniforms.uEmbBackOn.value = E.backOn; uniforms.uEmbScale.value.set(...E.scale); }
    let want = origMap;
    if (E) { if (cleanMap === null) { try { cleanMap = buildClean() || false; } catch (e) { console.warn('[suits] clean texture failed', e); cleanMap = false; } } want = cleanMap || origMap; }
    if (suitMat.map !== want) suitMat.map = want;
  }

  function apply(id) {
    const S = SUITS.find(s => s.id === id) || SUITS[0]; current = S.id;
    find();
    uniforms.uSuitOn.value = S.strength ? 1 : 0;
    setSuitFabric(!S.strength); // Advanced suit: rough fabric + weave detail (player/suitfabric.js); Iron / Symbiote untouched
    if (S.strength) {
      uniforms.uSuitR.value.copy(S.red); uniforms.uSuitB.value.copy(S.blue); uniforms.uSuitW.value.copy(S.white); uniforms.uSuitK.value.copy(S.black);
      uniforms.uSuitRough.value.set(...(S.rough || [-1, -1, -1, -1])); uniforms.uSuitMetal.value.set(...(S.metal || [-1, -1, -1, -1]));
      const e = S.emissive || [C(0, 0, 0), C(0, 0, 0), C(0, 0, 0), C(0, 0, 0)];
      uniforms.uSuitER.value.copy(e[0]); uniforms.uSuitEB.value.copy(e[1]); uniforms.uSuitEW.value.copy(e[2]); uniforms.uSuitEK.value.copy(e[3]);
    }
    uniforms.uSym.value = S.symbiote ? 1 : 0;
    setWebVenom(!!S.symbiote); // user r-venomweb: Symbiote suit shoots thick black lumpy webs (player/web.js)
    if (S.symbiote && !symMask) uniforms.uSymMask.value = symMask = buildSymMask();
    if (suitMat) { if (suitMat.userData.__envOrig == null) suitMat.userData.__envOrig = suitMat.envMapIntensity; suitMat.envMapIntensity = suitMat.userData.__envOrig * (S.env ?? 1); }
    if (suitMat?.normalScale && nrmOrig) { if (S.normalScale != null) suitMat.normalScale.copy(nrmOrig).multiplyScalar(S.normalScale); else suitMat.normalScale.copy(nrmOrig); }
    suitMap(S);
    if (lensMat && lensOrig) {
      if (S.lens) { lensMat.color.set(S.lens.color); lensMat.emissive.set(S.lens.emissive); lensMat.emissiveIntensity = S.lens.intensity; }
      else { lensMat.color.copy(lensOrig.color); lensMat.emissive.copy(lensOrig.emissive); lensMat.emissiveIntensity = lensOrig.intensity; }
    }
    if (!suitMat) { // placeholder character: simple tint
      const tint = new THREE.Color(S.swatch[0]);
      for (const m of placeholderMats) { if (m.userData.__sysOrig.r > m.userData.__sysOrig.b) m.color.copy(S.strength ? tint : m.userData.__sysOrig); }
    }
    return S;
  }

  let check = 0;
  return {
    SUITS, apply, get current() { return current; },
    update(dt) { check += dt; if (check > 2) { check = 0; const prev = suitMat; find(); if (suitMat !== prev && current) apply(current); } },
  };
}
