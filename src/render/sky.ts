/**
 * Procedural sky, atmosphere, cloud, and environment-map rendering system.
 *
 * @module render-sky
 * @version 1.0.0
 * @file src/render/sky.ts
 * @since 0.0.1
 * @description Exports sky shader helpers and createSky, which builds LUT-based atmospheric scattering, volumetric-style clouds, skyline silhouettes, and environment rendering passes.
 */

import * as THREE from "three";
import { FSPass, makeRT, GLSL_DEPTH } from "./common.ts";
import { GLSL_ATMOS, sunTransmittance } from "./atmosphere.ts";

const LUT_W = 256,
    LUT_H = 128;

const LUT_FRAG = `
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

const NOISE_FRAG = `
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

export const GLSL_SKY_COMMON = `
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

const GLSL_CLOUDS = `
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
      tw += hf * T * (1.0 - Ts); ws += T * (1.0 - Ts);
      T *= Ts;
      if (T < 0.01) break;
    }
    t += dt;
  }
  // approximate cirrus veil
  vec3 cp = ro + rd * t0;
  float cph = (asin(clamp(rd.y, -1.0, 1.0)) / 1.5708);
  float cir = smoothstep(0.5, 0.7, texture(uNoise, cp * vec3(0.4, 1.0, 0.4) + vec3(0.2, 0.9, 0.1)).g) * uCirrus * 0.55 * smoothstep(0.02, 0.25, rd.y);
  if (cir > 0.0) {
    vec3 ambTop = skyLUT(normalize(vec3(0.3, 1.0, 0.2)));
    vec3 cirCol = (uSunColor * (phaseHG(mu, 0.7) * 0.8 + 0.2) * 0.15 + ambTop * 0.7) * cir;
    L += T * cirCol; T *= 1.0 - cir * 0.4;
  }
  return vec4(L, T);
}

// high cirrus layer (thin sheet, advection)
float cirrusLayer(vec3 camM, vec3 rd) {
  if (uCirrus < 0.01 || rd.y < 0.02) return 0.0;
  vec3 ro = camM * 0.001; float t = (10.0 - max(ro.y, 0.0)) / rd.y; if (t < 0.0 || t > 200.0) return 0.0;
  vec3 q = ro + rd * t + uCloudOffset * vec3(0.3, 0.0, 0.35);
  float c = texture(uNoise, q * vec3(0.05, 0.1, 0.05) + vec3(0.2, 0.1, 0.5)).g;
  float c2 = texture(uNoise, q * vec3(0.12, 0.1, 0.12) + vec3(0.7, 0.3, 0.2)).b;
  return smoothstep(0.52, 0.75, c * 0.6 + c2 * 0.5) * uCirrus * smoothstep(0.02, 0.2, rd.y);
}

float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 evalSkyline(vec3 dir) {
  if (uSkyline < 0.01 || dir.y < 0.0) return vec3(0.0);
  float az = atan(dir.z, dir.x);
  float sec = floor(az * 16.0 / PI_ + 24.0);
  float r = hash3(vec3(sec, 7.3, 1.0));
  float h = 0.006 + r * 0.045 * (0.5 + 0.5 * hash3(vec3(sec, 3.1, 2.0)));
  float base = 0.003;
  float t = max(dir.y - base, 0.0) / max(h, 1e-4);
  if (t > 1.0) return vec3(0.0);
  float edge = smoothstep(1.0, 0.85, t);
  float win = smoothstep(0.35, 0.45, hash3(vec3(floor(dir.y * 1800.0), sec, 5.0))) * smoothstep(0.6, 1.0, 1.0 - t);
  float d2f = edge;
  vec3 col = mix(vec3(0.02, 0.022, 0.026), vec3(0.07, 0.075, 0.085), r) * (0.3 + 0.7 * d2f);
  col += vec3(0.9, 0.82, 0.6) * win * 0.04;
  // distant haze toward the skyline
  col = mix(uSkyGlow * 0.5 + skyLUT(vec3(dir.x, 0.002, dir.z)) * 0.15, col, edge);
  return col * uSkyline;
}
`;

const SKY_FRAG = `
precision highp float;
precision highp sampler3D;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uDepth;
uniform mat4 uProjInv; uniform mat4 uCamWorld; uniform vec3 uCamPos; uniform float uFrame; uniform float uReversed;
${GLSL_DEPTH}
${GLSL_SKY_COMMON}
${GLSL_CLOUDS}
void main() {
  float d = texture(uDepth, vUv).r;
  vec3 vd = viewDirFromUv(vUv);
  vec3 dir = normalize((uCamWorld * vec4(vd, 0.0)).xyz);
  vec3 sky = skyLUT(dir);
  vec4 cl = marchClouds(uCamPos, dir, ign(gl_FragCoord.xy + uFrame * 5.588));
  sky = sky * cl.a + cl.rgb;
  // cirrus are part of the alpha for sun-disc occlusion
  float cir = cirrusLayer(uCamPos, dir);
  if (cir > 0.0) sky += (uSunColor * 0.15 + skyLUT(vec3(dir.x, 0.2, dir.z)) * 0.8) * cir;
  sky += evalSkyline(dir);
  fragColor = vec4(sky, clamp(cl.a * (1.0 - cir), 0.0, 1.0));
}`;

const ENV_FRAG = `
precision highp float;
precision highp sampler3D;
in vec2 vUv; out vec4 fragColor;
uniform vec3 uCamPos, uFwd, uRight, uUp; uniform float uTan; uniform float uFrame;
${GLSL_SKY_COMMON}
${GLSL_CLOUDS}
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 dir = normalize(uFwd + ndc.x * uTan * uRight + ndc.y * uTan * uUp);
  vec3 sky = skyLUT(dir);
  vec4 cl = marchClouds(uCamPos, dir, 0.5);
  sky = sky * cl.a + cl.rgb;
  sky += evalSkyline(dir);
  // tonemap a little for PMREM (keeps energy bounded)
  fragColor = vec4(sky, 1.0);
}`;

interface SkyParams {
    elevation: number;
    azimuth: number;
    exposure: number;
    skyScale: number;
    lightScale: number;
    lightTint: number[];
    envSaturation: number;
    mie: number;
    cloudCoverage: number;
    cloudDensity: number;
    skyline: number;
    skylineProfile: string;
    cloudSpeed: number;
    wind: number;
    cloudBottom: number;
    cloudTop: number;
    overcast: number;
    cloudSun: number;
    cloudAmb: number;
    cloudScale: number;
    cirrus: number;
    cloudErode: number;
    cloudDetailScale: number;
    cloudBaseDark: number;
    stars: number;
    night: number;
    skyTint: number[];
    skyGlow: number[];
    sunGlow: number[];
    [k: string]: unknown;
}

export function createSky(
    renderer: THREE.WebGLRenderer,
    quality: import("./quality.ts").QualityPreset,
) {
    const params: SkyParams = {
        elevation: 35,
        azimuth: 220,
        exposure: 1.0,
        skyScale: 10.0,
        lightScale: 1.0,
        lightTint: [1, 1, 1],
        envSaturation: 0.82,
        mie: 0.75,
        cloudCoverage: 0.55,
        cloudDensity: 0.7,
        skyline: 0.0,
        skylineProfile: "newyork",
        cloudSpeed: 0.5,
        wind: 18,
        cloudBottom: 1.1,
        cloudTop: 2.6,
        overcast: 0.0,
        cloudSun: 1.0,
        cloudAmb: 1.0,
        cloudScale: 0.045,
        cirrus: 0.25,
        cloudErode: 0.35,
        cloudDetailScale: 0.3,
        cloudBaseDark: 0.45,
        stars: 0.0,
        night: 0.0,
        skyTint: [1, 1, 1],
        skyGlow: [0, 0, 0],
        sunGlow: [1.05, 0.5, 0.08, 0],
    };

    const lut = makeRT(LUT_W, LUT_H, { filter: THREE.LinearFilter });

    const noiseSize = 64;
    const noiseData = new Uint8Array(noiseSize * noiseSize * noiseSize * 4);
    const noiseTex = new THREE.Data3DTexture(
        noiseData,
        noiseSize,
        noiseSize,
        noiseSize,
    );
    noiseTex.format = THREE.RGBAFormat;
    noiseTex.type = THREE.UnsignedByteType;
    noiseTex.minFilter = noiseTex.magFilter = THREE.LinearFilter;
    noiseTex.wrapS = noiseTex.wrapT = noiseTex.wrapR = THREE.RepeatWrapping;
    noiseTex.needsUpdate = true;
    let noiseReady = false;

    const noisePass = new FSPass({
        fragmentShader: NOISE_FRAG,
        uniforms: {
            uZ: { value: 0 },
            uPW: { value: new THREE.Vector2(0.25, 0.55) },
        },
    });
    const sliceRT = makeRT(noiseSize, noiseSize, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
    });
    let noiseSlice = 0;
    let noiseFrameDelay = 1;
    void renderer.outputColorSpace;

    function renderNoiseSlices(maxSlices = 4): void {
        if (noiseReady) return;
        if (noiseFrameDelay-- > 0) return;
        const prevRT = renderer.getRenderTarget();
        const prevCS = renderer.outputColorSpace;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        const buf = new Uint8Array(noiseSize * noiseSize * 4);
        for (
            let n = 0;
            n < maxSlices && noiseSlice < noiseSize;
            n++, noiseSlice++
        ) {
            noisePass.uniforms.uZ.value = (noiseSlice + 0.5) / noiseSize;
            noisePass.render(renderer, sliceRT);
            renderer.readRenderTargetPixels(
                sliceRT,
                0,
                0,
                noiseSize,
                noiseSize,
                buf,
            );
            noiseData.set(buf, noiseSlice * noiseSize * noiseSize * 4);
        }
        renderer.setRenderTarget(prevRT);
        renderer.outputColorSpace = prevCS;
        noiseTex.needsUpdate = true;
        if (noiseSlice >= noiseSize) {
            noiseReady = true;
            sliceRT.dispose();
        }
    }

    const skyUniforms = {
        uSkyLUT: { value: lut.texture },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Vector3(1, 1, 1) },
        uSkyScale: { value: params.skyScale },
        uSkyTint: { value: new THREE.Vector3(1, 1, 1) },
        uSkyGlow: { value: new THREE.Vector3(0, 0, 0) },
        uHzK: { value: new THREE.Vector3(0.32, 0.42, 0.66) },
        uSunGlow: { value: new THREE.Vector4(1.05, 0.5, 0.08, 0) },
        uOvercast: { value: 0.0 },
        uNoise: { value: noiseTex },
        uCloudCoverage: { value: params.cloudCoverage },
        uCloudDensity: { value: params.cloudDensity },
        uCloudBottom: { value: params.cloudBottom },
        uCloudTop: { value: params.cloudTop },
        uCloudFade: { value: 0.6 },
        uCloudOffset: { value: new THREE.Vector3(0, 0, 0) },
        uSkyline: { value: params.skyline },
        uFacadeAlb: { value: new THREE.Vector3(0.23, 0.22, 0.2) },
        uNight: { value: 0.0 },
        uCloudSun: { value: params.cloudSun },
        uCloudAmb: { value: params.cloudAmb },
        uCloudScale: { value: params.cloudScale },
        uCirrus: { value: params.cirrus },
        uCloudErode: { value: params.cloudErode },
        uCloudDetailScale: { value: params.cloudDetailScale },
        uCloudBaseDark: { value: params.cloudBaseDark },
    } as Record<string, THREE.IUniform>;

    const lutPass = new FSPass({
        fragmentShader: LUT_FRAG,
        uniforms: {
            uSunEl: { value: 0 },
            uMie: { value: 1 },
            uViewH: { value: 0.05 },
            uMS: { value: 0.35 },
            uGroundAlbedo: { value: new THREE.Vector3(0.23, 0.22, 0.2) },
        },
    });

    const skyPass = new FSPass({
        fragmentShader: SKY_FRAG,
        defines: {
            CLOUD_STEPS: quality.cloudSteps,
            CLOUD_LIGHT_STEPS: quality.cloudLightSteps,
        },
        uniforms: {
            ...skyUniforms,
            uDepth: { value: null },
            uProjInv: { value: new THREE.Matrix4() },
            uCamWorld: { value: new THREE.Matrix4() },
            uCamPos: { value: new THREE.Vector3() },
            uFrame: { value: 0 },
            uReversed: { value: 0 },
        },
    });

    const envPass = new FSPass({
        fragmentShader: ENV_FRAG,
        defines: { CLOUD_STEPS: 16, CLOUD_LIGHT_STEPS: 3 },
        uniforms: {
            ...skyUniforms,
            uCamPos: { value: new THREE.Vector3(0, 200, 0) },
            uFwd: { value: new THREE.Vector3(0, 0, -1) },
            uRight: { value: new THREE.Vector3(1, 0, 0) },
            uUp: { value: new THREE.Vector3(0, 1, 0) },
            uTan: { value: 1 },
            uFrame: { value: 0 },
        },
    });

    const envCube = new THREE.WebGLCubeRenderTarget(quality.envSize, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        generateMipmaps: false,
    });
    const pmrem = new THREE.PMREMGenerator(renderer);
    const cubeCam = new THREE.CubeCamera(1, 10000, envCube);

    const sunDir = skyUniforms.uSunDir.value as THREE.Vector3;
    const sunColor = skyUniforms.uSunColor.value as THREE.Vector3;
    const lutU = lutPass.uniforms as Record<string, THREE.IUniform>;

    let prevEl = NaN,
        prevAz = NaN,
        prevMie = NaN;
    function bakeLUT(): void {
        const el = THREE.MathUtils.degToRad(params.elevation);
        lutU.uSunEl.value = el;
        lutU.uMie.value = params.mie;
        const prevRT = renderer.getRenderTarget();
        const prevCS = renderer.outputColorSpace;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        lutPass.render(renderer, lut);
        renderer.setRenderTarget(prevRT);
        renderer.outputColorSpace = prevCS;
    }

    function updateSun(): void {
        const el = THREE.MathUtils.degToRad(params.elevation);
        const az = THREE.MathUtils.degToRad(params.azimuth);
        sunDir
            .set(
                Math.cos(el) * Math.cos(az),
                Math.sin(el),
                Math.cos(el) * Math.sin(az),
            )
            .normalize();

        const t = sunTransmittance(el, params.mie);
        const s = params.skyScale * params.lightScale;
        const lt = params.lightTint;
        sunColor.set(t[0] * s * lt[0], t[1] * s * lt[1], t[2] * s * lt[2]);
        skyUniforms.uSkyScale.value = params.skyScale;
        (skyUniforms.uSkyTint.value as THREE.Vector3).set(
            ...(params.skyTint as [number, number, number]),
        );
        (skyUniforms.uSkyGlow.value as THREE.Vector3).set(
            ...(params.skyGlow as [number, number, number]),
        );
        (skyUniforms.uSunGlow.value as THREE.Vector4).set(
            ...(params.sunGlow as [number, number, number, number]),
        );
        skyUniforms.uOvercast.value = params.overcast ?? 0;
        skyUniforms.uCloudCoverage.value = params.cloudCoverage;
        skyUniforms.uCloudDensity.value = params.cloudDensity;
        skyUniforms.uCloudBottom.value = params.cloudBottom;
        skyUniforms.uCloudTop.value = params.cloudTop;
        skyUniforms.uSkyline.value = params.skyline;
        skyUniforms.uCloudSun.value = params.cloudSun;
        skyUniforms.uCloudAmb.value = params.cloudAmb;
        skyUniforms.uCloudScale.value = params.cloudScale;
        skyUniforms.uCirrus.value = params.cirrus;
        skyUniforms.uCloudErode.value = params.cloudErode;
        skyUniforms.uCloudDetailScale.value = params.cloudDetailScale;
        skyUniforms.uCloudBaseDark.value = params.cloudBaseDark;
        skyUniforms.uNight.value = params.night ?? 0;
    }

    function update(): void {
        renderNoiseSlices();

        const t = performance.now() / 1000;
        (skyUniforms.uCloudOffset.value as THREE.Vector3).set(
            t * params.cloudSpeed * params.wind * 0.001,
            0,
            t * params.cloudSpeed * params.wind * 0.0004,
        );
        updateSun();
        if (
            params.elevation !== prevEl ||
            params.azimuth !== prevAz ||
            params.mie !== prevMie
        ) {
            prevEl = params.elevation;
            prevAz = params.azimuth;
            prevMie = params.mie;
            bakeLUT();
        }
    }

    function renderSkyPass(
        target: THREE.WebGLRenderTarget,
        camera: THREE.Camera,
        depthTex: THREE.DepthTexture,
        _w: number,
        _h: number,
        frame: number,
        reversed = false,
    ): void {
        const u = skyPass.uniforms as Record<string, THREE.IUniform>;
        u.uDepth.value = depthTex;
        u.uProjInv.value.copy(camera.projectionMatrixInverse);
        u.uCamWorld.value.copy(camera.matrixWorld);
        (u.uCamPos.value as THREE.Vector3).setFromMatrixPosition(
            camera.matrixWorld,
        );
        u.uFrame.value = frame % 64;
        u.uReversed.value = reversed ? 1 : 0;
        skyPass.render(renderer, target);
    }

    const _dirs = [
        [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)],
        [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0)],
        [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
        [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)],
        [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0)],
        [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, -1, 0)],
    ] as [THREE.Vector3, THREE.Vector3][];
    const _fwd = new THREE.Vector3(),
        _right = new THREE.Vector3(),
        _up = new THREE.Vector3();
    function renderEnvFace(i: number): void {
        const [fwd0, up0] = _dirs[i];
        (envPass.uniforms.uCamPos.value as THREE.Vector3).copy(
            cubeCam.position,
        );
        _fwd.copy(fwd0);
        _up.copy(up0);
        _right.crossVectors(_fwd, _up).normalize();
        _up.crossVectors(_right, _fwd).normalize();
        (envPass.uniforms.uFwd.value as THREE.Vector3).copy(_fwd);
        (envPass.uniforms.uRight.value as THREE.Vector3).copy(_right);
        (envPass.uniforms.uUp.value as THREE.Vector3).copy(_up);
        envPass.uniforms.uTan.value = 1.0;
        envPass.uniforms.uFrame.value = 0;
        renderer.setRenderTarget(envCube, i);
        envPass.render(renderer, envCube);
    }
    function finishEnv(): THREE.Texture {
        const rt = pmrem.fromCubemap(envCube as unknown as THREE.CubeTexture);
        return rt.texture;
    }
    function renderEnv(): THREE.Texture {
        const prevCS = renderer.outputColorSpace;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        for (let i = 0; i < 6; i++) renderEnvFace(i);
        const tex = finishEnv();
        renderer.setRenderTarget(null);
        renderer.outputColorSpace = prevCS;
        return tex;
    }

    return {
        params,
        sunDir,
        sunColor,
        lut,
        skyUniforms,
        update,
        renderSkyPass,
        renderEnv,
        renderEnvFace,
        finishEnv,
        get ready() {
            return noiseReady;
        },
    };
}
