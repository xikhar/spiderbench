precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uColor, uBloom;
uniform vec2 uPx;
uniform sampler2D uStreakSrc, uStreakLo;
uniform float uStreak, uStreakT; // (night)
uniform float uExposure, uBloomStr, uSat, uContrast, uVignette, uCA, uSharpen, uGrain, uFrame, uAspect;
uniform vec3 uLift, uGamma, uGain, uWB;
uniform float uPivot, uSatKnee;
uniform sampler2D uSunVis;
uniform vec2 uSunUv;
uniform float uFlare;
uniform vec3 uSunCol;
uniform sampler2D uAE;
uniform float uAEOn, uAEKey, uAEStr, uAERange;
uniform vec3 uSplitSh, uSplitHi;
uniform float uSplitBal;
uniform float uWarmGuard;
uniform sampler2D uDepthS;
uniform mat4 uProjInvS;
uniform float uRevS;
bool isSkyD(float d) {
  return uRevS > 0.5 ? d <= 0.0 : d >= 1.0;
}
vec3 viewPosFromDepthS(vec2 uv, float d) {
  float z = uRevS > 0.5 ? d : d * 2.0 - 1.0;
  vec4 p = uProjInvS * vec4(uv * 2.0 - 1.0, z, 1.0);
  return p.xyz / p.w;
}
float viewDepthAt(vec2 uv) {
  float d = texture(uDepthS, uv).r;
  return isSkyD(d) ? 1e4 : -viewPosFromDepthS(uv, d).z;
}
// subtle camera-lens response to the sun: soft glare, a few chromatic ghosts mirrored through the centre, halo ring
vec3 lensFlare(vec2 uv) {
  float vis = texture(uSunVis, vec2(0.5)).r * uFlare;
  if(vis < 1e-3)
    return vec3(0.0);
  vec2 asp = vec2(uAspect, 1.0);
  vec2 sp = uSunUv;
  vec2 toC = vec2(0.5) - sp;
  vec3 acc = vec3(0.0);
  // glare around the sun (wide, soft)
  float ds = length((uv - sp) * asp);
  acc += vec3(1.0, 0.86, 0.66) * (0.022 / (ds * ds * 40.0 + 0.02)) * 0.02;
  // (lighting2 r1) physically-motivated veiling glare: a tight hot core + a wide warm halo (sun glow of the golden-hour ref)
  acc += vec3(1.0, 0.86, 0.66) * (0.22 * exp(-ds * 13.0) + 0.05 * exp(-ds * 3.5)); // (lighting2 r2) brighter core + wider warm halo (golden-hour ref sun bloom)
  // ghosts
  const float gpos[5] = float[](0.55, 0.9, 1.25, 1.6, 2.1);
  const float gsize[5] = float[](0.035, 0.018, 0.06, 0.025, 0.09);
  const vec3 gcol[5] = vec3[](vec3(0.45, 0.6, 1.0), vec3(1.0, 0.7, 0.35), vec3(0.4, 1.0, 0.6), vec3(1.0, 0.45, 0.3), vec3(0.5, 0.55, 1.0));
  for(int i = 0; i < 5; i++) {
    vec2 gp = sp + toC * gpos[i];
    float r = length((uv - gp) * asp) / gsize[i];
    float disk = smoothstep(1.0, 0.75, r) * (0.55 + 0.45 * smoothstep(0.2, 1.0, r));
    acc += gcol[i] * disk * 0.012;
  }
  // halo ring centred on the screen, brightest on the sun side
  vec2 hv = (uv - vec2(0.5)) * asp;
  float hr = length(hv);
  float ring = exp(-pow((hr - 0.42) / 0.018, 2.0)) * max(dot(normalize(hv + 1e-5), normalize(-toC * asp + 1e-5)), 0.0);
  acc += vec3(0.55, 0.7, 1.0) * ring * 0.01;
  // fade as the sun leaves the frame
  vec2 e = smoothstep(-0.25, 0.1, sp) * smoothstep(1.25, 0.9, sp);
  return acc * vis * e.x * e.y * uSunCol;
}
__SHADER_INJECT_0__ float ignf(vec2 p) {
return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
// ACES fitted (Stephen Hill)
const mat3 ACESIn = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
const mat3 ACESOut = mat3(1.60475, - 0.10208, - 0.00327, - 0.53108, 1.10813, - 0.07276, - 0.07367, - 0.00605, 1.07602);
vec3 RRTAndODTFit(vec3 v) {
vec3 a = v * (v + 0.0245786) - 0.000090537;
vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
return a / b;
}
// (lighting2 r1) softer toe: the fitted RRT crushes the darks ~6x at 0.02 (shade went black while sunlit faces were fine);
// a smooth max with a linear segment (slope uToe) keeps shaded walls / streets readable, mid-tones and highlights unchanged
uniform float uToe;
uniform float uRain;
vec3 aces(vec3 c) {
c = ACESIn * c;
vec3 r = RRTAndODTFit(c);
vec3 l = c * uToe;
r = 0.5 * (r + l + sqrt((r - l) * (r - l) + 0.01 * (r + l) * (r + l)));
return clamp(ACESOut * r, 0.0, 1.0);
}
vec3 tmS(vec3 c) {
return c / (1.0 + luma(c));
}
vec3 itmS(vec3 c) {
return c / max(1.0 - luma(c), 1e-4);
}
void main() {
vec2 d = vUv - 0.5;
  // sharpen (in a compressed domain to avoid halos on HDR edges)
vec3 c0 = tmS(texture(uColor, vUv).rgb);
vec3 n = tmS(texture(uColor, vUv + vec2(0.0, uPx.y)).rgb), s = tmS(texture(uColor, vUv - vec2(0.0, uPx.y)).rgb);
vec3 e = tmS(texture(uColor, vUv + vec2(uPx.x, 0.0)).rgb), w = tmS(texture(uColor, vUv - vec2(uPx.x, 0.0)).rgb);
  // luma-only adaptive sharpen (no chroma fringes / colour noise), weaker with distance (TAA already resolves far detail)
float l0 = luma(c0), ln = luma(n), ls = luma(s), le_ = luma(e), lw = luma(w);
float mnl = min(l0, min(min(ln, ls), min(le_, lw))), mxl = max(l0, max(max(ln, ls), max(le_, lw)));
float amp = sqrt(clamp(min(mnl, 1.0 - mxl) / max(mxl, 1e-4), 0.0, 1.0));
float dz = texture(uDepthS, vUv).r;
float zv = isSkyD(dz) ? 1e4 : - viewPosFromDepthS(vUv, dz).z;
float distK = mix(1.0, 0.35, smoothstep(15.0, 120.0, zv));
  // Do not sharpen across foreground silhouettes: the luma kernel otherwise makes a bright fringe on the character.
float zn = viewDepthAt(vUv + vec2(0.0, uPx.y)), zs = viewDepthAt(vUv - vec2(0.0, uPx.y));
float ze = viewDepthAt(vUv + vec2(uPx.x, 0.0)), zw = viewDepthAt(vUv - vec2(uPx.x, 0.0));
float depthEdge = max(max(abs(zv - zn), abs(zv - zs)), max(abs(zv - ze), abs(zv - zw)));
float edgeLo = max(0.035, zv * 0.02);
float edgeHi = max(edgeLo + 0.04, zv * 0.06);
float edgeSharpen = 1.0 - smoothstep(edgeLo, edgeHi, depthEdge);
float dl = (4.0 * l0 - ln - ls - le_ - lw) * uSharpen * amp * 0.25 * distK * edgeSharpen;
vec3 c = itmS(clamp(c0 * (1.0 + dl / max(l0, 1e-4)), 0.0, 0.999));
  // chromatic aberration (radial, very subtle)
vec2 cao = d * dot(d, d) * uCA * 4.0 * smoothstep(0.3, 0.7, length(d * vec2(uAspect, 1.0))); // edges only
c.r = mix(c.r, texture(uColor, vUv - cao).r, 0.85);
c.b = mix(c.b, texture(uColor, vUv + cao).b, 0.85);
  // bloom (energy-conserving mix)
vec3 b = texture(uBloom, vUv).rgb;
c += b * uBloomStr; // (lighting2 r1) additive thresholded bloom
  // (night) anamorphic streak (street ref: thin cool horizontal streaks through lamp heads / headlights): the half-res
  // radiance above a high threshold, smeared horizontally with an exponential falloff
if(uStreak > 0.0) {
vec3 st = vec3(0.0);
for(int k = 1;
k <= 12;
k ++) {
float o = float(k * k) * 0.0012, w = exp(- float(k) * 0.28);
      // (night r11) point sources only: minus 1.5x the 1/16-res local mean, so big bright screens (whose mean ~ their
      // radiance) don't smear a long pink bar across the frame; lamp heads / headlights (a few px) keep their streak
vec2 ua = vUv + vec2(o, 0.0), ub = vUv - vec2(o, 0.0);
vec3 a = textureLod(uStreakSrc, ua, 0.0).rgb - 1.5 * textureLod(uStreakLo, ua, 0.0).rgb, bb = textureLod(uStreakSrc, ub, 0.0).rgb - 1.5 * textureLod(uStreakLo, ub, 0.0).rgb;
st += (max(a - uStreakT, 0.0) + max(bb - uStreakT, 0.0)) * w;
}
c += dot(st, vec3(0.3, 0.5, 0.2)) * vec3(0.45, 0.62, 1.0) * uStreak;
}
c += lensFlare(vUv);
float ev = 0.0;
if(uAEOn > 0.5) ev = clamp(- (texture(uAE, vec2(0.5)).r - uAEKey) * uAEStr, - uAERange, uAERange);
c *= uExposure * exp2(ev) * uWB;
  // vignette
vec2 dv = d * vec2(uAspect, 1.0);
c *= mix(1.0, 1.0 - smoothstep(0.25, 1.05, length(dv)), uVignette);
c = aces(c);
{ // (atmosphere r2) split toning: cool shade, warm sunlit highlights (keeps luma)
float sl = luma(c);
vec3 tt = mix(uSplitSh, uSplitHi, smoothstep(uSplitBal * 0.25, uSplitBal * 2.2, sl));
tt = mix(tt, uSplitHi, uWarmGuard * smoothstep(0.02, 0.2, (c.r - c.b) / max(sl, 1e-3))); // (night r9) warm lamp / sodium / shop light keeps its warmth: no cool shift on warm pixels (critic: lavender lamp pools)
tt /= dot(tt, vec3(0.2126, 0.7152, 0.0722));
c *= tt;
}
if(uRain > 0.0) { // (lighting2 r3) overcast preset: cheap screen-space rain streaks (2 layers, slanted, falling)
float rr = 0.0, tt = uFrame / 60.0;
for(int i = 0;
i < 2;
i ++) {
float sc = i == 0 ? 1.0 : 1.9;
vec2 p = vec2(vUv.x * uAspect * 70.0 * sc + vUv.y * 5.0 * sc, vUv.y * 2.2 * sc + tt * (3.2 + 1.4 * float(i)));
float col = floor(p.x), h = fract(sin(col * 91.3 + float(i) * 17.0) * 43758.5);
float y = fract(p.y + h * 10.0 + tt * h);
float st = smoothstep(0.0, 0.04, y) * smoothstep(0.3 + 0.2 * h, 0.04, y) * step(0.5, h);
st *= smoothstep(0.35, 0.0, abs(fract(p.x) - 0.5));
rr += st * (i == 0 ? 0.7 : 0.4);
}
c = mix(c, vec3(0.72, 0.75, 0.8), clamp(rr * 0.11 * uRain, 0.0, 1.0));
}
  // grade (display-linear): lift/gamma/gain, contrast, saturation
c = max(uGain * (c + uLift * (1.0 - c)), 0.0);
c = pow(max(c, 0.0), 1.0 / uGamma);
float l = luma(c);
c = mix(vec3(l), c, uSat);
c = clamp(c, 0.0, 1.0);
{ // chroma soft-clip
float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
float st = (mx - mn) / max(mx, 1e-4);
if(st > uSatKnee) {
float t = uSatKnee + (1.0 - uSatKnee) * (1.0 - exp(- (st - uSatKnee) / (1.0 - uSatKnee) * 1.6)) / 1.6 * 1.25;
float k = clamp(t / st, 0.0, 1.0);
c = mx - (mx - c) * k;
}
}
vec3 lc = log2(c + 1e-4);
c = exp2((lc - log2(uPivot)) * uContrast + log2(uPivot)) - 1e-4;
  // highlight shoulder: roll off above 0.72 instead of clipping (sky, white paint, speculars keep detail)
  // shoulder from 0.8 that still reaches 1.0 (~1% of pixels: speculars, white paint, sun-lit clouds may clip like the refs)
  // (lighting2 r3) day refs (measured): p95 0.44-0.77, p99 <= 0.83 display-linear, < 1 % clipped; ours had p95 0.85-0.9
  // and 2-11 % clipped (sunlit cream walls, sky). Softer shoulder from 0.62 (asymptote ~0.99): sunlit faces stay bright
  // + warm with texture instead of white
vec3 hs = 0.62 + 0.37 * (1.0 - exp(- max(c - 0.62, 0.0) / 0.37));
c = mix(c, hs, step(0.62, c));
vec3 o = linearToSRGB(clamp(c, 0.0, 1.0));
  // grain + dither
float g = ignf(gl_FragCoord.xy + fract(uFrame * 0.618) * 113.0) - 0.5;
o += g * (1.0 / 255.0 + uGrain * (1.0 - o) * 0.5);
fragColor = vec4(o, 1.0);
}
