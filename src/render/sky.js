// OWNER: render agent.
// Physically based sky: single-scattering atmosphere (Rayleigh + Mie + ozone, approx multiple scattering)
// baked into a small sky-view LUT, raymarched cumulus cloud layer (Perlin-Worley 3D noise), procedural distant
// skyline, PMREM environment generation for IBL.
import * as THREE from "three";
import { FSPass, makeRT, GLSL_DEPTH } from "./common.js";
import { GLSL_ATMOS, sunTransmittance } from "./atmosphere.js";

const LUT_W = 256,
    LUT_H = 128;

// ---------------------------------------------------------------------------------------------------------
// GLSL: sky LUT generation (radiance for unit sun illuminance), parameterised relative to the sun azimuth.
const LUT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform float uSunEl; uniform float uMie; uniform float uViewH; uniform float uMS; uniform vec3 uGroundAlbedo;
${GLSL_ATMOS}
vec3 extinctionAt(float h, out vec3 scatR, out float scatM) {
  float dr = exp(-h / 8.0), dm = exp(-h / 1.2) * uMie, dO = max(0.0, 1.0 - abs(h - 25.0) / 15.0);
  scatR = BETA_R * dr; scatM = BETA_MS * dm;
  return BETA_R * dr + BETA_ME * dm + BETA_O * dO;
}
vec3 sunT(vec3 p, vec3 s) {
  if (raySphere(p, s, RG).x > 0.0) return vec3(0.0);
  float t = raySphere(p, s, RT).y; float dt = t / 12.0; vec3 od = vec3(0.0); vec3 a; float b;
  for (int i = 0; i < 12; i++) { vec3 q = p + s * (float(i) + 0.5) * dt; od += extinctionAt(length(q) - RG, a, b) * dt; }
  return exp(-od);
}
void main() {
  float az = vUv.x * PI_;
  float v = vUv.y * 2.0 - 1.0;
  float el = sign(v) * v * v * PI_ * 0.5;
  vec3 rd = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
  vec3 sd = vec3(cos(uSunEl), sin(uSunEl), 0.0);
  vec3 ro = vec3(0.0, RG + uViewH, 0.0);
  float tTop = raySphere(ro, rd, RT).y;
  vec2 tg = raySphere(ro, rd, RG);
  bool ground = tg.x > 0.0;
  float tMax = ground ? tg.x : tTop;
  float mu = dot(rd, sd);
  float pR = phaseR(mu), pM = phaseCS(mu, 0.8);
  const int N = 40;
  vec3 L = vec3(0.0), T = vec3(1.0);
  float tPrev = 0.0;
  for (int i = 0; i < N; i++) {
    float f = (float(i) + 1.0) / float(N);
    float t = tMax * f * f; float dt = t - tPrev; float tm = (t + tPrev) * 0.5; tPrev = t;
    vec3 p = ro + rd * tm; float h = length(p) - RG;
    vec3 sR; float sM; vec3 ext = extinctionAt(h, sR, sM);
    vec3 st = sunT(p, sd);
    vec3 S = st * (sR * pR + sM * pM) + (sR + vec3(sM)) * uMS * (0.25 / PI_) * (0.2 + 0.8 * st);
    vec3 Te = exp(-ext * dt);
    L += T * S * (1.0 - Te) / max(ext, 1e-7);
    T *= Te;
  }
  if (ground) {
    vec3 p = ro + rd * tMax; vec3 n = normalize(p);
    vec3 st = sunT(p, sd);
    L += T * uGroundAlbedo / PI_ * (st * max(dot(n, sd), 0.0) + 0.25);
  }
  fragColor = vec4(L, 1.0);
}`;

// ---------------------------------------------------------------------------------------------------------
// GLSL: tileable Perlin-Worley 3D noise generation (R = perlin-worley, GBA = worley fbm at increasing freqs)
const NOISE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform float uZ; uniform vec2 uPW;
vec3 hash33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float worley(vec3 p, float per) {
  vec3 id = floor(p), f = fract(p); float md = 1.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(x, y, z); vec3 h = hash33(mod(id + o, per) + 0.5);
    vec3 r = o + h - f; md = min(md, dot(r, r));
  }
  return 1.0 - sqrt(md);
}
float gnoise(vec3 p, float per) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n[8];
  for (int k = 0; k < 8; k++) {
    vec3 o = vec3(k & 1, (k >> 1) & 1, (k >> 2) & 1);
    vec3 g = normalize(hash33(mod(i + o, per) + 0.5) * 2.0 - 1.0);
    n[k] = dot(g, f - o);
  }
  return mix(mix(mix(n[0], n[1], u.x), mix(n[2], n[3], u.x), u.y), mix(mix(n[4], n[5], u.x), mix(n[6], n[7], u.x), u.y), u.z);
}
float perlinFbm(vec3 p, float per) {
  float s = 0.0, a = 1.0, w = 0.0;
  for (int i = 0; i < 6; i++) { s += gnoise(p, per) * a; w += a; a *= 0.5; p *= 2.0; per *= 2.0; }
  return s / w * 0.5 + 0.5;
}
float worleyFbm(vec3 p, float per) {
  return worley(p, per) * 0.625 + worley(p * 2.0, per * 2.0) * 0.25 + worley(p * 4.0, per * 4.0) * 0.125;
}
float remap(float v, float a, float b, float c, float d) { return c + (v - a) / (b - a) * (d - c); }
void main() {
  vec3 p = vec3(vUv, uZ);
  float pf = perlinFbm(p * 4.0, 4.0);
  float wf = worleyFbm(p * 4.0, 4.0);
  float pw = (0.6 * pf + 0.4 * wf - uPW.x) / uPW.y;
  fragColor = vec4(clamp(pw, 0.0, 1.0), wf, worleyFbm(p * 8.0, 8.0), worleyFbm(p * 16.0, 16.0));
}`;

// ---------------------------------------------------------------------------------------------------------
// GLSL: shared sky evaluation (LUT lookup, clouds, skyline). Requires uniforms declared in SKY_UNIFORMS.
export const GLSL_SKY_COMMON = /* glsl */ `
uniform sampler2D uSkyLUT;
uniform vec3 uSunDir;
uniform vec3 uSunColor;   // sun illuminance (scaled) at ground
uniform float uSkyScale;
uniform vec3 uSkyTint;    // day: 1; night: dim blue (moonlit sky)
uniform vec3 uSkyGlow;    // additive horizon glow (city light pollution at night / warm dusk band)
uniform vec3 uHzK;        // (atmosphere r1) horizon-band radiance multiplier
uniform vec4 uSunGlow;    // (lighting2 r2) golden aureole: rgb warm tint, w strength (0 = off)
uniform float uOvercast;  // (lighting2 r4) overcast deck: 0 = clear .. 1 = fully grey, low, heavy sky
${GLSL_ATMOS}
vec3 skyLUT(vec3 dir) {
  float el = asin(clamp(dir.y, -1.0, 1.0));
  vec2 dh = dir.xz; vec2 sh = uSunDir.xz;
  float ca = dot(normalize(dh + vec2(1e-6, 0.0)), normalize(sh + vec2(1e-6, 0.0)));
  float u = acos(clamp(ca, -1.0, 1.0)) / PI_;
  float v = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / (PI_ * 0.5));
  u = clamp(u, 0.5 / ${LUT_W}.0, 1.0 - 0.5 / ${LUT_W}.0);
  // (foundation agent, round 10) horizon deepening: the LUT's last few degrees saturate to a near-white band that
  // everything far (fog in-scatter, sky, horizon skirt) converges to -> critic: 'over-bright white haze band'. A soft
  // blue-grey multiplier on the low sky (applied here, so fog / sky / reflections all converge to the same value)
  // (atmosphere r1) stronger: the refs' horizon haze is a light grey-blue a little DARKER than the upper sky, never
  // the brightest thing in frame (measured: refs 07 / 09 horizon ~0.55-0.68 sRGB vs our old ~0.95 cream-white band)
  vec3 hzK = mix(vec3(uHzK), vec3(1.0), smoothstep(0.0, 0.3, abs(dir.y)));
  vec3 sc = texture(uSkyLUT, vec2(u, v)).rgb * uSkyScale * uSkyTint * hzK + uSkyGlow * exp(-max(dir.y, 0.0) * 7.0);
  // (lighting2 r2) golden-hour aureole: warm forward-scattering haze around a low sun (the single-scattering LUT stays
  // blue-white there). Desaturates the blue toward the sun and adds a warm glow, strongest near the horizon. Fog,
  // env reflections and cloud ambient all read skyLUT, so the golden haze carries through the whole frame.
  if (uSunGlow.w > 0.0) {
    float mu = max(dot(dir, uSunDir), 0.0);
    float hzw = exp(-max(dir.y, 0.0) * 2.2);
    float lobe = (0.7 * pow(mu, 5.0) + 0.45 * pow(mu, 1.5) * hzw + 0.18 * hzw + 1.6 * pow(mu, 48.0)) * uSunGlow.w;
    float sl = dot(sc, vec3(0.2126, 0.7152, 0.0722));
    sc = mix(sc, vec3(sl), clamp(lobe * 0.9, 0.0, 0.9)) + uSunGlow.rgb * sl * lobe;
  }
  if (uOvercast > 0.0) { // (lighting2 r4) director: 'overcast still shows a clear BLUE sky'. A grey storm deck: the sky
    // (and so fog in-scatter, env reflections and cloud ambient) becomes a flat grey, brightest at the zenith
    float ol = dot(sc, vec3(0.2126, 0.7152, 0.0722));
    vec3 deck = vec3(0.86, 0.88, 0.91) * ol * mix(0.55, 1.0, smoothstep(-0.05, 0.6, dir.y));
    sc = mix(sc, deck, uOvercast);
  }
  return sc;
}
`;

const GLSL_CLOUDS = /* glsl */ `
uniform sampler3D uNoise;
uniform float uCloudCoverage, uCloudDensity, uCloudBottom, uCloudTop, uCloudFade;
uniform vec3 uCloudOffset;
uniform float uSkyline;
// (atmosphere r1) cloud look controls: sun-scatter gain, ambient gain, base-noise scale (1/km), cirrus amount
uniform float uCloudSun, uCloudAmb, uCloudScale, uCirrus, uCloudErode, uCloudDetailScale;
uniform float uCloudBaseDark; // (atmosphere r2) 0..1 how much darker the flat cloud bases are than the tops
uniform vec3 uFacadeAlb; uniform float uNight;
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float remap(float v, float a, float b, float c, float d) { return c + (v - a) / (b - a) * (d - c); }
float cloudDensity(vec3 p, float hf, bool detail) {
  vec3 q = p + uCloudOffset;
  float wx = texture(uNoise, vec3(q.xz * 0.018, 0.31)).r;
  float wy = texture(uNoise, vec3(q.xz * 0.05 + 0.5, 0.71)).r;
  float cov = clamp(uCloudCoverage * (0.55 + 0.8 * smoothstep(0.1, 0.8, wx)) * (0.8 + 0.4 * wy), 0.0, 1.0); // (atmosphere r1: flatter weather mask, clouds everywhere like the refs)
  if (cov < 0.02) return 0.0;
  vec4 n = texture(uNoise, q * vec3(uCloudScale, 0.2, uCloudScale));
  // (atmosphere r1) Nubis-style base shape: the perlin-worley eroded by the low-frequency worley fbm -> lumpy cumulus
  // towers instead of smooth blobs
  float lf = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
  float base = clamp(remap(n.r, -(1.0 - lf) * 0.6, 1.0, 0.0, 1.0), 0.0, 1.0);
  // cumulus height profile: flat-ish base, rounded tops, taller where coverage is high
  float top = mix(0.35, 1.0, cov);
  float grad = smoothstep(0.0, 0.07, hf) * (1.0 - smoothstep(top * 0.4, top, hf));
  float d = remap(base * grad, 1.0 - cov, 1.0, 0.0, 1.0);
  if (d <= 0.0) return 0.0;
  if (detail) {
    vec4 dn = texture(uNoise, q * uCloudDetailScale + vec3(0.0, hf * 0.3, 0.0));
    float df = dn.g * 0.625 + dn.b * 0.25 + dn.a * 0.125;
    df = mix(df, 1.0 - df, clamp(hf * 4.0, 0.0, 1.0));
    d = remap(d, df * uCloudErode, 1.0, 0.0, 1.0);
    // (atmosphere r2) second, finer billow octave on the thin outer shell only: cauliflower lumps on the sunlit
    // tops / edges instead of airbrushed blobs (cheap: skipped in the dense core)
    if (d > 0.0 && d < 0.45) {
      vec4 dn2 = texture(uNoise, q * uCloudDetailScale * 3.1 + vec3(0.37, hf * 0.6, 0.11));
      float df2 = 1.0 - (dn2.g * 0.6 + dn2.b * 0.4);
      d = remap(d, df2 * 0.35 * (1.0 - d / 0.45), 1.0, 0.0, 1.0);
    }
  }
  return clamp(d, 0.0, 1.0) * uCloudDensity;
}
float cloudPhase(float mu, float k) {
  return mix(phaseHG(mu, 0.78 * k), phaseHG(mu, -0.25 * k), 0.3) * 4.0 * PI_ * 0.25 + 0.75;
}
// returns premultiplied cloud radiance (rgb) and transmittance (a)
vec4 marchClouds(vec3 camM, vec3 rd, float jitter) {
  vec3 ro = vec3(camM.x * 0.001, RG + max(camM.y, 1.0) * 0.001, camM.z * 0.001);
  if (rd.y < -0.03) return vec4(0.0, 0.0, 0.0, 1.0);
  if (raySphere(ro, rd, RG).x > 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float t0 = raySphere(ro, rd, RG + uCloudBottom).y;
  float t1 = raySphere(ro, rd, RG + uCloudTop).y;
  if (t0 > 160.0) return vec4(0.0, 0.0, 0.0, 1.0);
  t1 = min(t1, t0 + 14.0);
  float len = t1 - t0;
  float dt = len / float(CLOUD_STEPS);
  float mu = dot(rd, uSunDir);
  vec3 ambTop = skyLUT(normalize(vec3(0.3, 1.0, 0.2))) * 1.1 * uCloudAmb;
  vec3 ambBot = skyLUT(normalize(vec3(-0.9, 0.08, 0.3))) * 0.55 * uCloudAmb;
  vec3 L = vec3(0.0); float T = 1.0; float tw = 0.0, ws = 0.0;
  float t = t0 + dt * jitter;
  const float SIGMA = 45.0; // extinction per km at density 1
  for (int i = 0; i < CLOUD_STEPS; i++) {
    vec3 p = ro + rd * t;
    float hf = (length(p) - RG - uCloudBottom) / (uCloudTop - uCloudBottom);
    float d = cloudDensity(p, hf, true);
    if (d > 0.002) {
      float od = 0.0; float lt = 0.0;
      for (int j = 0; j < CLOUD_LIGHT_STEPS; j++) {
        float sl = 0.06 * pow(3.0, float(j));
        vec3 lp = p + uSunDir * (lt + sl * 0.5);
        float lhf = (length(lp) - RG - uCloudBottom) / (uCloudTop - uCloudBottom);
        // (atmosphere r3) the first (short) light step sees the detail erosion: the billows self-shadow each other, so
        // the cloud has internal lit / shaded lumps instead of one smooth airbrushed gradient
        od += cloudDensity(lp, lhf, j == 0) * sl; lt += sl;
      }
      // multiple-scattering octaves (Wrenninge)
      float ms = 0.0, a = 1.0, b = 1.0, c = 1.0;
      for (int k = 0; k < 3; k++) { ms += a * cloudPhase(mu, c) * exp(-SIGMA * od * b); a *= 0.5; b *= 0.4; c *= 0.5; } // (atmosphere r2: 0.55/0.35 -> 0.5/0.4, deeper self-shadow)
      float powder = 1.0 - 0.55 * exp(-d * 6.0);
      vec3 sunL = uSunColor * ms * powder * (0.25 / PI_) * uCloudSun;
      // (atmosphere r2) dark flat bases (little skylight reaches the underside, city below is dark), bright tops
      vec3 amb = mix(ambBot, ambTop, clamp(hf, 0.0, 1.0)) * mix(1.0, 0.25 + 0.75 * smoothstep(0.0, 0.6, hf), uCloudBaseDark)
        + uSkyGlow * uNight * 1.1 * (1.0 - clamp(hf, 0.0, 1.0)); // (night) r3: undersides lit by the city, brighter than the sky (critic: dark cloud blobs) // (lighting2 r5) city glow lights the cloud undersides at night (orange underlit deck)
      float sig = d * SIGMA;
      vec3 S = sunL + amb;
      float Ts = exp(-sig * dt);
      L += T * S * (1.0 - Ts);
      tw += t * T * (1.0 - Ts); ws += T * (1.0 - Ts);
      T *= Ts;
      if (T < 0.02) break;
    }
    t += dt;
  }
  float tAvg = ws > 0.0 ? tw / ws : t0;
  // (atmosphere r1) aerial perspective on the clouds: distant clouds do not vanish (that left a cloudless milky band
  // above the horizon), they take on the hazy horizon radiance -- a soft, slightly brighter-than-haze cloud bank
  // like the refs; only the very farthest ones dissolve completely
  float fade = exp(-tAvg / uCloudFade);
  float keep = exp(-tAvg / (uCloudFade * 3.5));
  vec3 hzC = skyLUT(normalize(vec3(rd.x, 0.03, rd.z)));
  float a = (1.0 - T) * keep;
  return vec4(L * fade * keep + hzC * a * (1.0 - fade) * 1.12, 1.0 - a);
}
// (atmosphere r1) high cirrus / cirrostratus veil at ~8 km: one wind-stretched noise layer, thin and bright, sheared
// into streaks (cheap: 2 lookups). Returns premultiplied radiance (rgb) and transmittance (a).
vec4 cirrusLayer(vec3 camM, vec3 rd) {
  if (uCirrus <= 0.0 || rd.y < 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec3 ro = vec3(camM.x * 0.001, RG + max(camM.y, 1.0) * 0.001, camM.z * 0.001);
  float t = raySphere(ro, rd, RG + 8.0).y;
  vec3 p = ro + rd * t; vec2 q = p.xz + uCloudOffset.xz * 0.4;
  vec2 w = vec2(q.x * 0.9 + q.y * 0.35, q.y * 0.25 - q.x * 0.1); // wind-stretched (long streaks)
  float big = texture(uNoise, vec3(q * 0.006, 0.43)).r;
  float n1 = texture(uNoise, vec3(w * 0.035, 0.17)).g;
  float n2 = texture(uNoise, vec3(w * 0.11 + n1 * 0.2, 0.61)).b;
  float d = smoothstep(0.35, 0.9, big) * smoothstep(0.45, 0.85, n1 * 0.75 + n2 * 0.45) * uCirrus;
  d *= smoothstep(0.0, 0.06, rd.y) * exp(-t / 160.0);
  float mu = dot(rd, uSunDir);
  vec3 c = uSunColor * (0.05 + 0.25 * phaseHG(mu, 0.6)) * 0.55 + skyLUT(vec3(0.0, 1.0, 0.0)) * 1.1;
  float a = clamp(d * 0.55, 0.0, 0.6);
  return vec4(c * a, 1.0 - a);
}
// Procedural distant skyline (infinitely far city silhouettes), returns elevation of skyline top (radians).
float skylineTop(vec3 dir) {
  float az = atan(dir.z, dir.x) + PI_;
  float h = 0.0;
  for (int o = 0; o < 3; o++) {
    float f = 45.0 * pow(2.3, float(o));
    float c = floor(az * f);
    float r = hash11(c + float(o) * 91.7);
    float amp = 0.030 / (1.0 + float(o) * 0.9);
    h = max(h, r > 0.25 ? amp * (0.35 + r) : 0.0);
  }
  float c = floor(az * 22.0); float r = hash11(c * 3.1 + 7.0);
  if (r > 0.82) h = max(h, 0.045 + 0.04 * hash11(c + 1.3));
  return h * uSkyline;
}
vec3 skylineColor(vec3 dir, float top, float haze, vec3 facade) {
  vec3 horizon = skyLUT(normalize(vec3(dir.x, 0.02, dir.z)));
  float el = asin(clamp(dir.y, -1.0, 1.0));
  vec2 hd = normalize(dir.xz + 1e-5); vec2 sd = normalize(uSunDir.xz + 1e-5);
  float lit = clamp(dot(-hd, sd) * 0.8 + 0.3, 0.05, 1.0);
  vec3 E = uSunColor * lit * sqrt(max(1.0 - uSunDir.y * uSunDir.y, 0.0)) * 0.5 + horizon * PI_ * 0.5;
  vec3 c = facade * E / PI_;
  // window rows
  float row = fract(el * 900.0);
  c *= 0.6 + 0.4 * step(0.45, row);
  if (uNight > 0.0) { // lit windows on the distant skyline
    float az = atan(dir.z, dir.x);
    vec2 cell = floor(vec2(az * 1400.0, el * 900.0));
    float r = hash11(cell.x * 1.37 + cell.y * 57.1);
    c += vec3(1.0, 0.72, 0.42) * step(0.72, r) * step(0.45, row) * uNight * 0.35 * (0.5 + r);
  }
  float k = haze * (0.7 + 0.3 * smoothstep(0.0, top + 1e-3, el));
  return mix(c, horizon, k);
}
`;

export function createSky(renderer, quality) {
    // LUT target
    const lut = makeRT(LUT_W, LUT_H, { type: THREE.HalfFloatType });
    const lutPass = new FSPass({
        name: "skyLUT",
        fragmentShader: LUT_FRAG,
        uniforms: {
            uSunEl: { value: 0.6 },
            uMie: { value: 2.2 },
            uViewH: { value: 0.05 },
            uMS: { value: 2.2 },
            uGroundAlbedo: { value: new THREE.Vector3(0.12, 0.12, 0.11) },
        },
    });

    // 3D noise (generated on GPU once)
    const NS = 128;
    const noiseRT = new THREE.WebGL3DRenderTarget(NS, NS, NS, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        depthBuffer: false,
    });
    const nt = noiseRT.texture;
    nt.wrapS = nt.wrapT = nt.wrapR = THREE.RepeatWrapping;
    nt.minFilter = THREE.LinearFilter;
    nt.magFilter = THREE.LinearFilter;
    nt.generateMipmaps = false;
    const noisePass = new FSPass({
        name: "cloudNoise",
        fragmentShader: NOISE_FRAG,
        uniforms: {
            uZ: { value: 0 },
            uPW: { value: new THREE.Vector2(0.4, 0.22) },
        },
    });
    const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    function genNoise(pwx, pwy) {
        // (atmosphere r1) re-callable (tuning): perlin-worley remap offset / range
        noisePass.uniforms.uPW.value.set(pwx, pwy);
        for (let z = 0; z < NS; z++) {
            noisePass.uniforms.uZ.value = (z + 0.5) / NS;
            renderer.setRenderTarget(noiseRT, z);
            renderer.render(noisePass.mesh, oc);
        }
        renderer.setRenderTarget(null);
    }
    genNoise(0.4, 0.22);

    const params = {
        elevation: 44,
        azimuth: 70, // degrees; azimuth measured from +X toward +Z
        mie: 1.4,
        ms: 2.2,
        skyScale: 16.0,
        envSaturation: 0.62,
        cloudCoverage: 0.52,
        cloudDensity: 0.7,
        cloudBottom: 1.25,
        cloudTop: 2.8,
        cloudFade: 28.0,
        cloudSun: 4.3,
        cloudAmb: 0.8,
        cloudScale: 0.13,
        cirrus: 0.6,
        cloudErode: 0.88,
        cloudDetailScale: 2.4, // (atmosphere r2) sun 6 -> 4.3 (key light x1.4), finer cauliflower detail
        // (atmosphere r1) brighter, larger cumulus + cirrus veil
        cloudBaseDark: 0.9,
        skylineVisible: 1.0,
        // time-of-day controls (set by lighting.js presets)
        lightScale: 1.0,
        lightTint: [1, 1, 1], // scale/tint of the key light (sun, or moon at night)
        skyTint: [1, 1, 1],
        skyGlow: [0, 0, 0], // sky radiance multiplier / additive horizon glow
        night: 0,
        stars: 0,
        groundAlbedo: [0.2, 0.18, 0.155], // env-map ground (sunlit street/sidewalk bounce)
        envFacadeAlbedo: [0.34, 0.29, 0.23], // env-map city band (sunlit limestone/brick bounce)
    };

    const sunDir = new THREE.Vector3();
    const sunColor = new THREE.Color();
    const skyUniforms = {
        uSkyLUT: { value: lut.texture },
        uSunDir: { value: sunDir },
        uSunColor: { value: new THREE.Vector3() },
        uSkyScale: { value: params.skyScale },
        uNoise: { value: nt },
        uCloudCoverage: { value: params.cloudCoverage },
        uCloudDensity: { value: params.cloudDensity },
        uCloudBottom: { value: params.cloudBottom },
        uCloudTop: { value: params.cloudTop },
        uCloudFade: { value: params.cloudFade },
        uCloudOffset: { value: new THREE.Vector3(3.1, 0, 7.7) },
        uSkyline: { value: 1.0 },
        uSkyTint: { value: new THREE.Vector3(1, 1, 1) },
        uSkyGlow: { value: new THREE.Vector3(0, 0, 0) },
        uFacadeAlb: { value: new THREE.Vector3(0.2, 0.185, 0.165) },
        uNight: { value: 0 },
        uCloudSun: { value: params.cloudSun },
        uCloudAmb: { value: params.cloudAmb },
        uCloudScale: { value: params.cloudScale },
        uHzK: { value: new THREE.Vector3(0.56, 0.63, 0.78) },
        uCirrus: { value: params.cirrus },
        uCloudErode: { value: params.cloudErode },
        uCloudDetailScale: { value: params.cloudDetailScale },
        uCloudBaseDark: { value: params.cloudBaseDark },
        uSunGlow: { value: new THREE.Vector4(0, 0, 0, 0) }, // (lighting2 r2)
        uOvercast: { value: 0 }, // (lighting2 r4)
    };

    function updateSun() {
        const el = THREE.MathUtils.degToRad(params.elevation),
            az = THREE.MathUtils.degToRad(params.azimuth);
        sunDir
            .set(
                Math.cos(el) * Math.cos(az),
                Math.sin(el),
                Math.cos(el) * Math.sin(az),
            )
            .normalize();
        const T = sunTransmittance(Math.max(el, 0.009), params.mie); // (daynight) the LUT follows the sun below the horizon; the key light colour is faded by lightScale
        // "white" sun above the atmosphere, times transmittance, times global scale (lux-ish arbitrary units)
        const E = params.skyScale * 0.62 * params.lightScale;
        const lt = params.lightTint;
        sunColor.setRGB(T[0] * E * lt[0], T[1] * E * lt[1], T[2] * E * lt[2]);
        skyUniforms.uSkyTint.value.fromArray(params.skyTint);
        skyUniforms.uSkyGlow.value.fromArray(params.skyGlow);
        skyUniforms.uSunGlow.value.fromArray(params.sunGlow ?? [0, 0, 0, 0]); // (lighting2 r2)
        skyUniforms.uOvercast.value = params.overcast ?? 0; // (lighting2 r4)
        skyUniforms.uNight.value = params.night;
        skyUniforms.uSunColor.value.set(sunColor.r, sunColor.g, sunColor.b);
        skyUniforms.uSkyScale.value = params.skyScale;
        lutPass.uniforms.uSunEl.value = el;
        lutPass.uniforms.uMie.value = params.mie;
        lutPass.uniforms.uMS.value = params.ms;
        lutPass.render(renderer, lut);
        renderer.setRenderTarget(null);
    }
    function syncCloudUniforms() {
        skyUniforms.uCloudCoverage.value = params.cloudCoverage;
        skyUniforms.uCloudDensity.value = params.cloudDensity;
        skyUniforms.uCloudBottom.value = params.cloudBottom;
        skyUniforms.uCloudTop.value = params.cloudTop;
        skyUniforms.uCloudFade.value = params.cloudFade;
        skyUniforms.uCloudSun.value = params.cloudSun;
        skyUniforms.uCloudAmb.value = params.cloudAmb;
        skyUniforms.uCloudScale.value = params.cloudScale;
        skyUniforms.uCirrus.value = params.cirrus;
        skyUniforms.uCloudErode.value = params.cloudErode;
        skyUniforms.uCloudDetailScale.value = params.cloudDetailScale;
        skyUniforms.uCloudBaseDark.value = params.cloudBaseDark;
    }

    // ---------------- half-res sky pass (screen) ----------------
    const skyPass = new FSPass({
        name: "skyPass",
        defines: {
            CLOUD_STEPS: quality.cloudSteps,
            CLOUD_LIGHT_STEPS: quality.cloudLightSteps,
        },
        uniforms: {
            ...skyUniforms,
            uDepth: { value: null },
            uProjInv: { value: new THREE.Matrix4() },
            uReversed: { value: 0 },
            uCamWorld: { value: new THREE.Matrix4() },
            uCamPos: { value: new THREE.Vector3() },
            uFullRes: { value: new THREE.Vector2(1, 1) },
            uFrame: { value: 0 },
            uStars: { value: 0 },
        },
        fragmentShader: /* glsl */ `
precision highp float;
precision highp sampler3D;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uDepth; uniform mat4 uCamWorld; uniform vec3 uCamPos; uniform vec2 uFullRes; uniform float uFrame;
uniform float uStars;
${GLSL_DEPTH}
${GLSL_SKY_COMMON}
${GLSL_CLOUDS}
vec3 starField(vec3 d) {
  // cube-ish cell hashing on the direction; each cell holds at most one star (smooth gaussian so TAA is stable)
  vec3 p = d * 260.0; vec3 id = floor(p); vec3 f = fract(p) - 0.5;
  float h = hash11(dot(id, vec3(1.0, 57.0, 113.0)));
  if (h < 0.93) return vec3(0.0);
  vec3 o = vec3(hash11(h * 91.3), hash11(h * 17.9), hash11(h * 43.1)) - 0.5;
  float r = length(f - o * 0.6);
  float b = exp(-r * r * 90.0) * pow((h - 0.93) / 0.07, 3.0);
  return mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash11(h * 7.7)) * b * 0.9;
}
void main() {
  // skip texels whose 2x2 (+1 ring) full-res footprint contains no sky
  vec2 px = 1.0 / uFullRes;
  bool any = false;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
    float d = texture(uDepth, vUv + (vec2(x, y) - 1.5) * px).r;
    any = any || isSky(d);
  }
  if (!any) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 vd = viewDirFromUv(vUv);
  vec3 dir = normalize((uCamWorld * vec4(vd, 0.0)).xyz);
  vec3 sky = skyLUT(dir);
  float top = skylineTop(dir);
  float el = asin(clamp(dir.y, -1.0, 1.0));
  if (top > 0.0 && el < top) { fragColor = vec4(skylineColor(dir, top, 0.75, uFacadeAlb), 0.0); return; }
  // (foundation agent) skyline off (city world has real geometry to the horizon): the thin sliver between the
  // geometric horizon and the far edge of the world takes the same horizon radiance the fog converges to
  if (el < 0.0) { fragColor = vec4(skyLUT(normalize(vec3(dir.x, 0.012, dir.z))), 1.0); return; }
  float j = ign(gl_FragCoord.xy + mod(uFrame, 64.0) * 5.588238); // IGN temporal offsets: TAA resolves the march banding
  if (uStars > 0.0) sky += starField(dir) * uStars * smoothstep(0.0, 0.15, dir.y);
  vec4 ci = cirrusLayer(uCamPos, dir);
  sky = sky * ci.a + ci.rgb;
  vec4 cl = marchClouds(uCamPos, dir, j);
  // (foundation agent) clouds dissolve into the horizon haze: at grazing angles they are tens of km away, so their
  // aerial perspective converges on the clear-sky horizon radiance the fogged far land also converges to -> no seam
  // (atmosphere r1: marchClouds now does the aerial perspective itself; only the last half degree fades)
  float hz = smoothstep(0.0, 0.012, dir.y);
  fragColor = vec4(mix(sky, sky * cl.a + cl.rgb, hz), mix(1.0, cl.a * ci.a, hz));
}`,
    });

    // ---------------- env cubemap ----------------
    const envScene = new THREE.Scene();
    const envMat = new THREE.ShaderMaterial({
        name: "envSky",
        glslVersion: THREE.GLSL3,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        defines: { CLOUD_STEPS: 48, CLOUD_LIGHT_STEPS: 4 },
        uniforms: {
            ...skyUniforms,
            uCamPos: { value: new THREE.Vector3(0, 60, 0) },
            uGround: { value: new THREE.Vector3(0.2, 0.18, 0.155) },
            uEnvSat: { value: 0.62 },
            uEnvFacade: { value: new THREE.Vector3(0.34, 0.29, 0.23) },
        },
        vertexShader: /* glsl */ `out vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
precision highp float; precision highp sampler3D;
in vec3 vDir; out vec4 fragColor;
uniform vec3 uCamPos; uniform vec3 uGround; uniform float uEnvSat; uniform vec3 uEnvFacade;
${GLSL_SKY_COMMON}
${GLSL_CLOUDS}
void main() {
  vec3 dir = normalize(vDir);
  vec3 horizon = skyLUT(normalize(vec3(dir.x, 0.02, dir.z)));
  float el = asin(clamp(dir.y, -1.0, 1.0));
  vec3 c;
  float top = skylineTop(dir) * 1.8 + 0.02;
  if (el < top) {
    // city: facades near horizon, ground below
    vec3 fac = skylineColor(dir, top, 0.35, uEnvFacade);
    float gl = 1.0 - smoothstep(-0.5, -0.05, el);
    vec3 zen = skyLUT(vec3(0.0, 1.0, 0.0));
    vec3 E = uSunColor * max(uSunDir.y, 0.0) * 0.55 + zen * PI_ * 0.5;
    vec3 ground = uGround * E / PI_;
    c = mix(fac, ground, gl) * 0.68; // (lighting2 r4, vehicles agent) darker city / ground under a bright sky: glossy paint, glass and wet streets show a readable reflected horizon line
  } else {
    vec3 sky = skyLUT(dir);
    vec4 ci = cirrusLayer(uCamPos, dir);
    vec4 cl = marchClouds(uCamPos, dir, 0.5);
    c = (sky * ci.a + ci.rgb) * cl.a + cl.rgb;
  }
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  fragColor = vec4(mix(vec3(l), c, uEnvSat), 1.0);
}`,
    });
    const envMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), envMat);
    envMesh.frustumCulled = false;
    envScene.add(envMesh);
    const cubeRT = new THREE.WebGLCubeRenderTarget(256, {
        type: THREE.HalfFloatType,
        generateMipmaps: false,
    });
    const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
    envScene.add(cubeCam);
    const pmrem = new THREE.PMREMGenerator(renderer);
    let envRT = null;

    function renderEnv() {
        const oldTarget = renderer.getRenderTarget();
        const oldTM = renderer.toneMapping;
        renderer.toneMapping = THREE.NoToneMapping;
        cubeCam.update(renderer, envScene);
        const next = pmrem.fromCubemap(cubeRT.texture, envRT ?? undefined);
        envRT = next;
        renderer.toneMapping = oldTM;
        renderer.setRenderTarget(oldTarget);
        return envRT.texture;
    }

    // (daynight) env re-bake spread over frames (day-night cycle): one cube face per call, then the PMREM pre-filter
    function renderEnvFace(i) {
        const ot = renderer.getRenderTarget(),
            of = renderer.getActiveCubeFace(),
            om = renderer.getActiveMipmapLevel();
        const oldTM = renderer.toneMapping;
        renderer.toneMapping = THREE.NoToneMapping;
        if (cubeCam.coordinateSystem !== renderer.coordinateSystem) {
            cubeCam.coordinateSystem = renderer.coordinateSystem;
            cubeCam.updateCoordinateSystem();
        }
        renderer.setRenderTarget(cubeRT, i);
        renderer.render(envScene, cubeCam.children[i]);
        renderer.toneMapping = oldTM;
        renderer.setRenderTarget(ot, of, om);
    }
    function finishEnv() {
        const ot = renderer.getRenderTarget();
        envRT = pmrem.fromCubemap(cubeRT.texture, envRT ?? undefined);
        renderer.setRenderTarget(ot);
        return envRT.texture;
    }

    updateSun();
    syncCloudUniforms();

    return {
        params,
        sunDir,
        sunColor,
        lut,
        noise: nt,
        noiseRT,
        skyUniforms,
        skyPass,
        genNoise,
        /** call after changing params.elevation/azimuth/mie/... ; re-bakes LUT (cheap). returns true */
        update() {
            syncCloudUniforms();
            updateSun();
            skyUniforms.uSkyline.value = params.skylineVisible;
            envMat.uniforms.uEnvSat.value = params.envSaturation;
            envMat.uniforms.uGround.value.fromArray(params.groundAlbedo);
            envMat.uniforms.uEnvFacade.value.fromArray(params.envFacadeAlbedo);
            skyPass.uniforms.uStars.value = params.stars;
        },
        renderEnv,
        renderEnvFace,
        finishEnv,
        /** Evaluate horizon/zenith colors on the CPU is not supported; use GLSL_SKY_COMMON in shaders. */
        renderSkyPass(target, camera, depthTex, fullW, fullH, frame, reversed) {
            const u = skyPass.uniforms;
            u.uDepth.value = depthTex;
            u.uProjInv.value.copy(camera.projectionMatrixInverse);
            u.uCamWorld.value.copy(camera.matrixWorld);
            u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
            u.uFullRes.value.set(fullW, fullH);
            u.uFrame.value = frame % 64;
            u.uReversed.value = reversed ? 1 : 0;
            u.uSkyline.value = params.skylineVisible;
            skyPass.render(renderer, target);
        },
    };
}
