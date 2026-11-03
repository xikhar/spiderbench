// sky shader sections.

// @section commonAtmosphere

uniform sampler2D uSkyLUT;
uniform vec3 uSunDir;
uniform vec3 uSunColor;   // sun illuminance (scaled) at ground
uniform float uSkyScale;
uniform vec3 uSkyTint;    // day: 1; night: dim blue (moonlit sky)
uniform vec3 uSkyGlow;    // additive horizon glow (city light pollution at night / warm dusk band)
uniform vec3 uHzK;        // (atmosphere r1) horizon-band radiance multiplier
uniform vec4 uSunGlow;    // (lighting2 r2) golden aureole: rgb warm tint, w strength (0 = off)
uniform float uOvercast;  // (lighting2 r4) overcast deck: 0 = clear .. 1 = fully grey, low, heavy sky
__SHADER_INJECT_0__ vec3 skyLUT(vec3 dir) {
float el = asin(clamp(dir.y, - 1.0, 1.0));
vec2 dh = dir.xz;
vec2 sh = uSunDir.xz;
float ca = dot(normalize(dh + vec2(1e-6, 0.0)), normalize(sh + vec2(1e-6, 0.0)));
float u = acos(clamp(ca, - 1.0, 1.0)) / PI_;
float v = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / (PI_ * 0.5));
u = clamp(u, 0.5 / float(__SHADER_INJECT_1__), 1.0 - 0.5 / float(__SHADER_INJECT_2__));
// (foundation agent, round 10) horizon deepening: the LUT's last few degrees saturate to a near-white band that
// everything far (fog in-scatter, sky, horizon skirt) converges to -> critic: 'over-bright white haze band'. A soft
// blue-grey multiplier on the low sky (applied here, so fog / sky / reflections all converge to the same value)
// (atmosphere r1) stronger: the refs' horizon haze is a light grey-blue a little DARKER than the upper sky, never
// the brightest thing in frame (measured: refs 07 / 09 horizon ~0.55-0.68 sRGB vs our old ~0.95 cream-white band)
vec3 hzK = mix(vec3(uHzK), vec3(1.0), smoothstep(0.0, 0.3, abs(dir.y)));
vec3 sc = texture(uSkyLUT, vec2(u, v)).rgb * uSkyScale * uSkyTint * hzK + uSkyGlow * exp(- max(dir.y, 0.0) * 7.0);
// (lighting2 r2) golden-hour aureole: warm forward-scattering haze around a low sun (the single-scattering LUT stays
// blue-white there). De-saturates the blue toward the sun and adds a warm glow, strongest near the horizon. Fog,
// env reflections and cloud ambient all read skyLUT, so the golden haze carries through the whole frame.
if(uSunGlow.w > 0.0) {
float mu = max(dot(dir, uSunDir), 0.0);
float hzw = exp(- max(dir.y, 0.0) * 2.2);
float lobe = (0.7 * pow(mu, 5.0) + 0.45 * pow(mu, 1.5) * hzw + 0.18 * hzw + 1.6 * pow(mu, 48.0)) * uSunGlow.w;
float sl = dot(sc, vec3(0.2126, 0.7152, 0.0722));
sc = mix(sc, vec3(sl), clamp(lobe * 0.9, 0.0, 0.9)) + uSunGlow.rgb * sl * lobe;
}
if(uOvercast > 0.0) { // (lighting2 r4) director: 'overcast still shows a clear BLUE sky'. A grey storm deck: the sky
// (and so fog in-scatter, env reflections and cloud ambient) becomes a flat grey, brightest at the zenith
float ol = dot(sc, vec3(0.2126, 0.7152, 0.0722));
vec3 deck = vec3(0.86, 0.88, 0.91) * ol * mix(0.55, 1.0, smoothstep(- 0.05, 0.6, dir.y));
sc = mix(sc, deck, uOvercast);
}
return sc;
}

// @section clouds

uniform sampler3D uNoise;
uniform float uCloudCoverage, uCloudDensity, uCloudBottom, uCloudTop, uCloudFade;
uniform vec3 uCloudOffset;
uniform float uSkyline;
// (atmosphere r1) cloud look controls: sun-scatter gain, ambient gain, base-noise scale (1/km), cirrus amount
uniform float uCloudSun, uCloudAmb, uCloudScale, uCirrus, uCloudErode, uCloudDetailScale;
uniform float uCloudBaseDark; // (atmosphere r2) 0..1 how much darker the flat cloud bases are than the tops
uniform vec3 uFacadeAlb;
uniform float uNight;
float hash11(float p) {
p = fract(p * .1031);
p *= p + 33.33;
p *= p + p;
return fract(p);
}
float remap(float v, float a, float b, float c, float d) {
return c + (v - a) / (b - a) * (d - c);
}
float cloudDensity(vec3 p, float hf, bool detail) {
vec3 q = p + uCloudOffset;
  // Cloud density is evaluated inside a raymarch that exits at a pixel-dependent point. Explicit level-zero
  // sampling avoids undefined implicit derivatives there; uNoise has no mipmaps, so this matches texture().
float wx = textureLod(uNoise, vec3(q.xz * 0.018, 0.31), 0.0).r;
float wy = textureLod(uNoise, vec3(q.xz * 0.05 + 0.5, 0.71), 0.0).r;
float cov = clamp(uCloudCoverage * (0.55 + 0.8 * smoothstep(0.1, 0.8, wx)) * (0.8 + 0.4 * wy), 0.0, 1.0); // (atmosphere r1: flatter weather mask, clouds everywhere like the refs)
if(cov < 0.02) return 0.0;
vec4 n = textureLod(uNoise, q * vec3(uCloudScale, 0.2, uCloudScale), 0.0);
  // (atmosphere r1) Nubis-style base shape: the perlin-worley eroded by the low-frequency worley fbm -> lumpy cumulus
  // towers instead of smooth blobs
float lf = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
float base = clamp(remap(n.r, - (1.0 - lf) * 0.6, 1.0, 0.0, 1.0), 0.0, 1.0);
  // cumulus height profile: flat-ish base, rounded tops, taller where coverage is high
float top = mix(0.35, 1.0, cov);
float grad = smoothstep(0.0, 0.07, hf) * (1.0 - smoothstep(top * 0.4, top, hf));
float d = remap(base * grad, 1.0 - cov, 1.0, 0.0, 1.0);
if(d <= 0.0) return 0.0;
if(detail) {
vec4 dn = textureLod(uNoise, q * uCloudDetailScale + vec3(0.0, hf * 0.3, 0.0), 0.0);
float df = dn.g * 0.625 + dn.b * 0.25 + dn.a * 0.125;
df = mix(df, 1.0 - df, clamp(hf * 4.0, 0.0, 1.0));
d = remap(d, df * uCloudErode, 1.0, 0.0, 1.0);
    // (atmosphere r2) second, finer billow octave on the thin outer shell only: cauliflower lumps on the sunlit
    // tops / edges instead of airbrushed blobs (cheap: skipped in the dense core)
if(d > 0.0 && d < 0.45) {
vec4 dn2 = textureLod(uNoise, q * uCloudDetailScale * 3.1 + vec3(0.37, hf * 0.6, 0.11), 0.0);
float df2 = 1.0 - (dn2.g * 0.6 + dn2.b * 0.4);
d = remap(d, df2 * 0.35 * (1.0 - d / 0.45), 1.0, 0.0, 1.0);
}
}
return clamp(d, 0.0, 1.0) * uCloudDensity;
}
float cloudPhase(float mu, float k) {
return mix(phaseHG(mu, 0.78 * k), phaseHG(mu, - 0.25 * k), 0.3) * 4.0 * PI_ * 0.25 + 0.75;
}
// returns premultiplied cloud radiance (rgb) and transmittance (a)
vec4 marchClouds(vec3 camM, vec3 rd, float jitter) {
vec3 ro = vec3(camM.x * 0.001, RG + max(camM.y, 1.0) * 0.001, camM.z * 0.001);
if(rd.y < - 0.03) return vec4(0.0, 0.0, 0.0, 1.0);
if(raySphere(ro, rd, RG).x > 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
float t0 = raySphere(ro, rd, RG + uCloudBottom).y;
float t1 = raySphere(ro, rd, RG + uCloudTop).y;
if(t0 > 160.0) return vec4(0.0, 0.0, 0.0, 1.0);
t1 = min(t1, t0 + 14.0);
float len = t1 - t0;
float dt = len / float(CLOUD_STEPS);
float mu = dot(rd, uSunDir);
vec3 ambTop = skyLUT(normalize(vec3(0.3, 1.0, 0.2))) * 1.1 * uCloudAmb;
vec3 ambBot = skyLUT(normalize(vec3(- 0.9, 0.08, 0.3))) * 0.55 * uCloudAmb;
vec3 L = vec3(0.0);
float T = 1.0;
float tw = 0.0, ws = 0.0;
float t = t0 + dt * jitter;
const float SIGMA = 45.0; // extinction per km at density 1
for(int i = 0;
i < CLOUD_STEPS;
i ++) {
vec3 p = ro + rd * t;
float hf = (length(p) - RG - uCloudBottom) / (uCloudTop - uCloudBottom);
float d = cloudDensity(p, hf, true);
if(d > 0.002) {
float od = 0.0;
float lt = 0.0;
for(int j = 0;
j < CLOUD_LIGHT_STEPS;
j ++) {
float sl = 0.06 * pow(3.0, float(j));
vec3 lp = p + uSunDir * (lt + sl * 0.5);
float lhf = (length(lp) - RG - uCloudBottom) / (uCloudTop - uCloudBottom);
// (atmosphere r3) the first (short) light step sees the detail erosion: the billows self-shadow each other, so
// the cloud has internal lit / shaded lumps instead of one smooth airbrushed gradient
od += cloudDensity(lp, lhf, j == 0) * sl;
lt += sl;
}
// multiple-scattering octaves (Wrenninge)
float ms = 0.0, a = 1.0, b = 1.0, c = 1.0;
for(int k = 0;
k < 3;
k ++) {
ms += a * cloudPhase(mu, c) * exp(- SIGMA * od * b);
a *= 0.5;
b *= 0.4;
c *= 0.5;
} // (atmosphere r2: 0.55/0.35 -> 0.5/0.4, deeper self-shadow)
float powder = 1.0 - 0.55 * exp(- d * 6.0);
vec3 sunL = uSunColor * ms * powder * (0.25 / PI_) * uCloudSun;
// (atmosphere r2) dark flat bases (little skylight reaches the underside, city below is dark), bright tops
vec3 amb = mix(ambBot, ambTop, clamp(hf, 0.0, 1.0)) * mix(1.0, 0.25 + 0.75 * smoothstep(0.0, 0.6, hf), uCloudBaseDark) + uSkyGlow * uNight * 1.1 * (1.0 - clamp(hf, 0.0, 1.0)); // (night) r3: undersides lit by the city, brighter than the sky (critic: dark cloud blobs) // (lighting2 r5) city glow lights the cloud undersides at night (orange underlit deck)
float sig = d * SIGMA;
vec3 S = sunL + amb;
float Ts = exp(- sig * dt);
L += T * S * (1.0 - Ts);
tw += t * T * (1.0 - Ts);
ws += T * (1.0 - Ts);
T *= Ts;
if(T < 0.02) break;
}
t += dt;
}
float tAvg = ws > 0.0 ? tw / ws : t0;
// (atmosphere r1) aerial perspective on the clouds: distant clouds do not vanish (that left a cloudless milky band
// above the horizon), they take on the hazy horizon radiance -- a soft, slightly brighter-than-haze cloud bank
// like the refs; only the very farthest ones dissolve completely
float fade = exp(- tAvg / uCloudFade);
float keep = exp(- tAvg / (uCloudFade * 3.5));
vec3 hzC = skyLUT(normalize(vec3(rd.x, 0.03, rd.z)));
float a = (1.0 - T) * keep;
return vec4(L * fade * keep + hzC * a * (1.0 - fade) * 1.12, 1.0 - a);
}
// (atmosphere r1) high cirrus / cirrostratus veil at ~8 km: one wind-stretched noise layer, thin and bright, sheared
// into streaks (cheap: 2 lookups). Returns premultiplied radiance (rgb) and transmittance (a).
vec4 cirrusLayer(vec3 camM, vec3 rd) {
if(uCirrus <= 0.0 || rd.y < 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
vec3 ro = vec3(camM.x * 0.001, RG + max(camM.y, 1.0) * 0.001, camM.z * 0.001);
float t = raySphere(ro, rd, RG + 8.0).y;
vec3 p = ro + rd * t;
vec2 q = p.xz + uCloudOffset.xz * 0.4;
vec2 w = vec2(q.x * 0.9 + q.y * 0.35, q.y * 0.25 - q.x * 0.1); // wind-stretched (long streaks)
float big = texture(uNoise, vec3(q * 0.006, 0.43)).r;
float n1 = texture(uNoise, vec3(w * 0.035, 0.17)).g;
float n2 = texture(uNoise, vec3(w * 0.11 + n1 * 0.2, 0.61)).b;
float d = smoothstep(0.35, 0.9, big) * smoothstep(0.45, 0.85, n1 * 0.75 + n2 * 0.45) * uCirrus;
d *= smoothstep(0.0, 0.06, rd.y) * exp(- t / 160.0);
float mu = dot(rd, uSunDir);
vec3 c = uSunColor * (0.05 + 0.25 * phaseHG(mu, 0.6)) * 0.55 + skyLUT(vec3(0.0, 1.0, 0.0)) * 1.1;
float a = clamp(d * 0.55, 0.0, 0.6);
return vec4(c * a, 1.0 - a);
}
// Procedural distant skyline (infinitely far city silhouettes), returns elevation of skyline top (radians).
float skylineTop(vec3 dir) {
float az = atan(dir.z, dir.x) + PI_;
float h = 0.0;
for(int o = 0;
o < 3;
o ++) {
float f = 45.0 * pow(2.3, float(o));
float c = floor(az * f);
float r = hash11(c + float(o) * 91.7);
float amp = 0.030 / (1.0 + float(o) * 0.9);
h = max(h, r > 0.25 ? amp * (0.35 + r) : 0.0);
}
float c = floor(az * 22.0);
float r = hash11(c * 3.1 + 7.0);
if(r > 0.82) h = max(h, 0.045 + 0.04 * hash11(c + 1.3));
return h * uSkyline;
}
vec3 skylineColor(vec3 dir, float top, float haze, vec3 facade) {
vec3 horizon = skyLUT(normalize(vec3(dir.x, 0.02, dir.z)));
float el = asin(clamp(dir.y, - 1.0, 1.0));
vec2 hd = normalize(dir.xz + 1e-5);
vec2 sd = normalize(uSunDir.xz + 1e-5);
float lit = clamp(dot(- hd, sd) * 0.8 + 0.3, 0.05, 1.0);
vec3 E = uSunColor * lit * sqrt(max(1.0 - uSunDir.y * uSunDir.y, 0.0)) * 0.5 + horizon * PI_ * 0.5;
vec3 c = facade * E / PI_;
// window rows
float row = fract(el * 900.0);
c *= 0.6 + 0.4 * step(0.45, row);
if(uNight > 0.0) { // lit windows on the distant skyline
float az = atan(dir.z, dir.x);
vec2 cell = floor(vec2(az * 1400.0, el * 900.0));
float r = hash11(cell.x * 1.37 + cell.y * 57.1);
c += vec3(1.0, 0.72, 0.42) * step(0.72, r) * step(0.45, row) * uNight * 0.35 * (0.5 + r);
}
float k = haze * (0.7 + 0.3 * smoothstep(0.0, top + 1e-3, el));
return mix(c, horizon, k);
}
