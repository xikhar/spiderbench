precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uColor, uDepth, uSky, uSceneA, uSSR, uShafts;
uniform sampler2D uCVol;
uniform float uCVolOn;
uniform vec2 uQuarterPx; // (night)
uniform sampler2D uGI;
uniform float uGIOn, uGIAbs, uGIAlb; // (lighting2 r1) SSGI
uniform vec3 uMoonDir;
uniform float uMoonK; // (daynight)
uniform vec3 uNightHaze, uNightHazeHi;
uniform float uNightFog; // (night)
uniform vec3 uGlowCol;
uniform float uGlowH, uGlowK;
uniform vec3 uNightMid, uTsGlow, uNightMidLevel;
// (night r14) path length through an exponential height layer: int_a^b exp(-(y0 + t dy) / H) dt (density 1 at y = 0)
float hazeInt(float y0, float dy, float a, float b, float H) {
  float e0 = exp(-(y0 + a * dy) / H);
  if(abs(dy) < 1e-3)
    return (b - a) * e0;
  return H / dy * (e0 - exp(-(y0 + b * dy) / H));
}
// (foundation agent) projected cloud shadows: the sky's cumulus coverage field sampled where the sun ray from a surface
// point crosses the cloud layer (same noise / coverage as sky.ts cloudDensity, lower cloud band)
uniform sampler3D uNoise;
uniform float uCloudCoverage, uCloudBottom, uCloudTop, uCloudShadow, uCloudScale;
uniform vec3 uCloudOffset;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform vec2 uPx, uHalfPx;
uniform float uFogDensity, uFogFalloff, uFogSun, uFogStart, uSSROn, uShaftOn;
uniform vec3 uFogTint;
__SHADER_INJECT_0__ __SHADER_INJECT_1__ vec3 fogColor(vec3 dir, float sunVis) {
  // (atmosphere r2) looking down from altitude the haze in-scatter picks up more of the blue sky above (not the pale
  // horizon), and it warms toward the sun (forward Mie)
vec3 c = skyLUT(normalize(vec3(dir.x, max(dir.y * 0.3, 0.012) + 0.05 * clamp(- dir.y * 2.0, 0.0, 1.0), dir.z))) * uFogTint;
float mu = dot(dir, uSunDir);
c *= mix(vec3(1.0), vec3(1.1, 1.0, 0.86), smoothstep(0.2, 0.95, mu) * 0.6);
c += uSunColor * phaseHG(mu, 0.7) * uFogSun * 0.05 * sunVis;
  // (night) the night haze is lit by the city below (light pollution), not by the black sky: a purple-grey veil,
  // brighter / warmer toward the horizon and the street glow, cooler and dimmer looking up (refs/night esb + haze)
if(uNightFog > 0.0) c = mix(c, mix(uNightHaze, uNightHazeHi, smoothstep(- 0.05, 0.35, dir.y)), uNightFog);
return c;
}
float cloudShadowAt(vec3 wp) {
if(uSunDir.y < 0.06 || uCloudShadow <= 0.0) return 0.0;
vec3 p = wp * 0.001;
float sh = 0.0;
for(int k = 0;
k < 2;
k ++) {
float hf = k == 0 ? 0.08 : 0.22;
float h = mix(uCloudBottom, uCloudTop, hf);
float t = (h - p.y) / uSunDir.y;
vec3 q = vec3(p.x + uSunDir.x * t, RG + h, p.z + uSunDir.z * t) + uCloudOffset;
    // This loop can continue based on per-pixel coverage, so use explicit LOD for the non-mipmapped noise volume.
float wx = textureLod(uNoise, vec3(q.xz * 0.018, 0.31), 0.0).r;
float wy = textureLod(uNoise, vec3(q.xz * 0.05 + 0.5, 0.71), 0.0).r;
float cov = clamp(uCloudCoverage * (0.55 + 0.8 * smoothstep(0.1, 0.8, wx)) * (0.8 + 0.4 * wy), 0.0, 1.0);
if(cov < 0.02) continue;
vec4 nb = textureLod(uNoise, q * vec3(uCloudScale, 0.2, uCloudScale), 0.0); // (atmosphere r1) same shape as sky.ts cloudDensity
float base = clamp((nb.r + (1.0 - (nb.g * 0.625 + nb.b * 0.25 + nb.a * 0.125)) * 0.6) / (1.0 + (1.0 - (nb.g * 0.625 + nb.b * 0.25 + nb.a * 0.125)) * 0.6), 0.0, 1.0);
float top = mix(0.35, 1.0, cov);
float grad = smoothstep(0.0, 0.07, hf) * (1.0 - smoothstep(top * 0.4, top, hf));
float d = (base * grad - (1.0 - cov)) / max(cov, 1e-3);
sh = max(sh, smoothstep(0.0, 0.3, d));
}
return sh * uCloudShadow * smoothstep(0.06, 0.2, uSunDir.y);
}
// depth-aware upsample of a half-res buffer whose alpha holds linear distance
vec3 upsampleHalf(sampler2D tex, vec2 uv, float dist, vec2 hp) {
vec2 base = (floor(uv / hp - 0.5) + 0.5) * hp;
vec2 f = (uv - base) / hp;
vec3 acc = vec3(0.0);
float ws = 0.0;
for(int j = 0;
j < 2;
j ++) for(int i = 0;
i < 2;
i ++) {
vec2 o = vec2(float(i), float(j));
vec4 s = textureLod(tex, base + o * hp, 0.0);
float bw = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
float dw = 1.0 / (1e-3 + abs(s.a - dist) / max(dist, 1.0) * 20.0);
float w = bw * dw + 1e-5;
acc += s.rgb * w;
ws += w;
}
return acc / ws;
}
vec3 upsampleShafts(vec2 uv, float dist) {
return upsampleHalf(uShafts, uv, dist, uHalfPx);
}
// (lighting2 r1) depth-aware 3x3 blur-upsample of the half-res SSGI ratio (a = distance)
vec3 upsampleGI(vec2 uv, float dist) {
vec3 acc = vec3(0.0);
float ws = 0.0;
for(int j = - 1;
j <= 1;
j ++) for(int i = - 1;
i <= 1;
i ++) {
vec4 s = textureLod(uGI, uv + vec2(float(i), float(j)) * uHalfPx * 1.5, 0.0);
float w = exp(- abs(s.a - dist) / max(dist, 1.0) * 30.0) * (i == 0 && j == 0 ? 2.0 : 1.0) + 1e-5;
acc += s.rgb * w;
ws += w;
}
return acc / ws;
}
void main() {
float d = texture(uDepth, vUv).r;
vec3 vd = viewDirFromUv(vUv);
vec3 dir = normalize((uCamWorld * vec4(vd, 0.0)).xyz);
if(isSky(d)) {
vec4 s = texture(uSky, vUv);
vec3 c = s.rgb;
    // sun disk with limb darkening, occluded by clouds (s.a = cloud transmittance)
float ct = dot(dir, uSunDir);
float ang = acos(clamp(ct, - 1.0, 1.0));
float R = 0.0052;
if(ang < R * 1.5) {
float x = clamp(ang / R, 0.0, 1.0);
float limb = 1.0 - 0.6 * (1.0 - sqrt(max(1.0 - x * x, 0.0)));
float disk = 1.0 - smoothstep(0.85, 1.0, ang / R);
c += uSunColor * 90.0 * limb * disk * s.a;
}
if(uMoonK > 0.0) { // (daynight) moon disc: mottled maria, soft halo (bloom picks it up at night exposure)
float ma = acos(clamp(dot(dir, uMoonDir), - 1.0, 1.0));
float Rm = 0.0078;
if(ma < Rm * 12.0) {
vec3 mt = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)) + 1e-5);
vec3 mb = cross(mt, uMoonDir);
vec2 mq = vec2(dot(dir - uMoonDir, mt), dot(dir - uMoonDir, mb)) / Rm;
float maria = 0.72 + 0.28 * smoothstep(0.1, 0.5, length(mq - vec2(0.3, 0.25))) * smoothstep(0.05, 0.35, length(mq + vec2(0.35, - 0.1)));
float mdisk = 1.0 - smoothstep(0.88, 1.0, ma / Rm);
c += (vec3(0.9, 0.92, 1.0) * 1.8 * maria * mdisk + vec3(0.45, 0.55, 0.8) * 0.05 * exp(- ma / Rm * 0.9)) * uMoonK * s.a;
}
}
if(uShaftOn > 0.5) c += upsampleShafts(vUv, 1e5);
if(uCVolOn > 0.5) c += upsampleHalf(uCVol, vUv, 1e5, uQuarterPx);
fragColor = vec4(c, 1.0);
return;
}
vec3 col = texture(uColor, vUv).rgb;
if(uGIOn > 0.5) {
float gd = length(viewPosFromDepth(vUv, d));
vec3 gi = upsampleGI(vUv, gd);
col = mix(col * (1.0 + gi), col + gi * uGIAlb, uGIAbs); // (night) additive emissive bounce (albedo proxy)
}
if(uSSROn > 0.5) {
float w = texture(uSceneA, vUv).a - 1.0;
if(w > 0.01) {
vec3 r = vec3(0.0);
r += texture(uSSR, vUv + uHalfPx * vec2(- 0.5, - 0.5)).rgb;
r += texture(uSSR, vUv + uHalfPx * vec2(0.5, - 0.5)).rgb;
r += texture(uSSR, vUv + uHalfPx * vec2(- 0.5, 0.5)).rgb;
r += texture(uSSR, vUv + uHalfPx * vec2(0.5, 0.5)).rgb;
col = max(col + w * r * 0.25, vec3(0.0));
      // reflection floor: glossy glass never collapses to black when it reflects a shadowed street / SSR miss.
      // Stylised like the refs: at least ~60% of the (horizon-ish) sky radiance times the Fresnel weight.
vec3 skyH = skyLUT(normalize(vec3(dir.x, 0.12, dir.z)));
col = max(col, w * mix(skyH * 0.35, (uNightHaze * 1.1 + uGlowCol * 0.7) * smoothstep(0.25, 0.6, w), uNightFog)); // only true mirrors (puddles, glass), not glossy paint stripes // (night) SSR misses on wet ground mirror the light-polluted street haze, not a black sky (critic r1: puddles = dark holes)
}
}
vec3 pv = viewPosFromDepth(vUv, d);
float dist = length(pv);
  // (foundation agent) cloud shadows darken the lit scene before the aerial perspective (so haze stays bright)
if(dist < 20000.0) col *= 1.0 - cloudShadowAt(uCamPos + dir * dist) * (1.0 - smoothstep(9000.0, 20000.0, dist));
float dd = max(dist - uFogStart, 0.0);
float h0 = uCamPos.y;
float k = uFogFalloff;
float ry = dir.y;
float od;
float a = uFogDensity * exp(- k * max(h0, 0.0));
if(abs(ry * k * dd) < 1e-3) od = a * dd;
else od = a * (1.0 - exp(- k * ry * dd)) / (k * ry);
  // (atmosphere r2) tighter distance curve: the near / mid range (< ~400 m) keeps its saturation and contrast, the
  // 1-4 km band hazes faster (mid-distance tower clusters get aerial perspective), and the optical depth saturates
  // softly so far silhouettes never vanish into a uniform white wall (critic: 'milky at 500 m', 'flat white band')
od *= mix(0.45, 1.3, smoothstep(150.0, 2600.0, dist)); // (lighting2 r2) 0.3 -> 0.45: street-level haze down the avenues
od = od / (1.0 + od * 0.22);
vec3 T = exp(- od * vec3(0.86, 1.0, 1.16));
  // (foundation agent) the horizon skirt (water.ts, ~140 km) is fully in-scattered even for level rays from altitude,
  // where the height-falloff optical depth stays small -> no dark line on the geometric horizon
T *= 1.0 - smoothstep(25000.0, 60000.0, dist);
vec3 fogC = fogColor(dir, uShaftOn > 0.5 ? 0.35 : 1.0);
  // (foundation agent) far-field in-scatter converges to the untinted horizon sky: the fogged hinterland meets the sky
  // without a darker seam at the horizon (the tint only deepens the near/mid-distance haze)
  // (round 4) converge later: the near / mid distance keeps the blue-grey tinted in-scatter (graded aerial perspective
  // instead of a milky-white wall), only the far hinterland / horizon skirt melts into the horizon sky
fogC = mix(fogC, skyLUT(normalize(vec3(dir.x, 0.012, dir.z))), smoothstep(9000.0, 45000.0, dist));
if(uNightFog > 0.0) fogC = mix(fogC, uNightMid, uNightFog * smoothstep(120.0, 350.0, dist) * (1.0 - smoothstep(900.0, 2200.0, dist))); // (night r6) moonlit blue atmosphere in the 150-900 m band (rooftop_haze ref), purple light-pollution haze beyond
col = col * T + fogC * (1.0 - T);
if(uShaftOn > 0.5) col += upsampleShafts(vUv, dist);
if(uCVolOn > 0.5) col += upsampleHalf(uCVol, vUv, dist, uQuarterPx);
  // (night) street-level glow: the low haze layer (y < uGlowH) in the street canyons scatters the lamp / shop / car
  // light, so from above the avenues read as warm glowing lines and at street level distant blocks sit in a warm veil
if(uNightFog > 0.0) {
    // (night r7) moonlit blue atmosphere: additive in-scatter in the 150 m - 2 km band (lifts the dark city between the
    // avenues to a deep blue like the rooftop_haze ref; a tint of the thin fog alone could not lift the blacks)
float bandA = (1.0 - exp(- dist * 0.0011)) * smoothstep(120.0, 350.0, dist) * (1.0 - smoothstep(1800.0, 3500.0, dist));
col += mix(uNightMidLevel, uNightMid, smoothstep(0.25, 0.6, - dir.y)) * bandA * 0.45 * uNightFog; // (night r8) blue when looking down (rooftop_haze ref), grey-violet near level (esb ref)
    // (night r7) Times Square: the air between the towers glows with the screens (ray segment inside the square's box)
{
      // (night r14) no 90 m ceiling (a flat lid over the square seen while swinging): the glow thins out with height (H 70 m)
vec3 bmin = vec3(- 80.0, 0.0, - 245.0), bmax = vec3(82.0, 400.0, - 78.0);
vec3 inv = 1.0 / (dir + vec3(1e-6));
vec3 t0 = (bmin - uCamPos) * inv, t1 = (bmax - uCamPos) * inv;
vec3 tn = min(t0, t1), tf = max(t0, t1);
float ta = max(max(tn.x, tn.y), max(tn.z, 0.0)), tb = min(min(tf.x, tf.y), min(tf.z, min(dist, 3000.0)));
if(tb > ta) col += uTsGlow * (1.0 - exp(- hazeInt(uCamPos.y, dir.y, ta, tb, 70.0) * 0.0084)) * uNightFog;
}
    // (night r14) user: 'a clear separation of the street level lights and the darkness above, like a plane'. The warm
    // street glow was a slab (full density below uGlowH = 22 m, none above): its top read as a flat lid across the
    // facades. Now an exponential layer (density 1 at the street, 1/e at uGlowH * 1.5 = 33 m): same glow in the canyons,
    // fading out gradually up the walls
float y0 = uCamPos.y, dl = min(dist, 700.0); // (night r4) only the street canyons near the view glow: grazing rays to far water / shores crossed km of the layer (critic: water glows brighter than the city)
float lin = hazeInt(max(y0, 0.0), dir.y, 0.0, dl, uGlowH * 1.5);
col += uGlowCol * (1.0 - exp(- lin * uGlowK)) * uNightFog * mix(0.6, 1.0, smoothstep(20.0, 120.0, y0)); // (night r7) street-level cameras: less amber canyon tint (critic: warm dusk, ref is blue night)
}
fragColor = vec4(col, 1.0);
}
