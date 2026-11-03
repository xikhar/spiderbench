// suits shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
out vec3 vSysRestP;
out vec3 vSysRestN;
// @section vertexBeginVertex
#include <begin_vertex>
vSysRestP = position;
vSysRestN = normal;
// @section fragmentCommon
#include <common>
uniform float uSuitOn;
uniform vec3 uSuitR, uSuitB, uSuitW, uSuitK, uSuitER, uSuitEB, uSuitEW, uSuitEK;
uniform vec4 uSuitRough, uSuitMetal;
uniform float uEmbMode;
uniform vec3 uEmbFront, uEmbBack;
uniform float uEmbBackOn;
uniform vec2 uEmbScale;
in vec3 vSysRestP;
in vec3 vSysRestN;
float sysSeg(vec2 p, vec2 a, vec2 b) {
vec2 pa = p - a, ba = b - a;
float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
return length(pa - ba * h);
}
float sysEll(vec2 p, vec2 c, vec2 r) {
return (length((p - c) / r) - 1.0) * min(r.x, r.y);
}
// spider emblem SDF in the bind-pose body plane (metres). c = body centre, s = scale, w = leg width
float sysSpider(vec2 p, vec2 c, float s, float w) {
vec2 q = (p - c) / s;
q.x = abs(q.x);
float d = min(sysEll(q, vec2(0.0, 0.36), vec2(0.16, 0.2)), sysEll(q, vec2(0.0, - 0.12), vec2(0.23, 0.36)));
float lw = w / s;
d = min(d, sysSeg(q, vec2(0.08, 0.40), vec2(0.42, 0.78)) - lw);
d = min(d, sysSeg(q, vec2(0.42, 0.78), vec2(0.36, 1.30)) - lw * 0.8);
d = min(d, sysSeg(q, vec2(0.12, 0.30), vec2(0.62, 0.46)) - lw);
d = min(d, sysSeg(q, vec2(0.62, 0.46), vec2(0.92, 0.90)) - lw * 0.8);
d = min(d, sysSeg(q, vec2(0.12, 0.14), vec2(0.64, 0.02)) - lw);
d = min(d, sysSeg(q, vec2(0.64, 0.02), vec2(0.96, - 0.52)) - lw * 0.8);
d = min(d, sysSeg(q, vec2(0.10, 0.04), vec2(0.46, - 0.40)) - lw);
d = min(d, sysSeg(q, vec2(0.46, - 0.40), vec2(0.44, - 1.05)) - lw * 0.8);
return d * s;
}
// ---- symbiote suit (user r-symbiote)
uniform float uSym, uSymBump;
uniform vec3 uSymW;
uniform sampler2D uSymMask;
// emblem mask (built on a canvas by buildSymMask): planar bind-pose projection, x -0.32..0.32 m, y 0.92..1.56 m;
// R = front spider, G = back spider
vec2 sysSymUV(vec2 p) {
return vec2((p.x + 0.32) / 0.64, (p.y - 0.92) / 0.64);
}
vec3 sysH3(vec3 p) {
p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
return - 1.0 + 2.0 * fract(sin(p) * 43758.5453);
}
float sysNoise(vec3 p) {
vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
return mix(mix(mix(dot(sysH3(i), f), dot(sysH3(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x), mix(dot(sysH3(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), dot(sysH3(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y), mix(mix(dot(sysH3(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), dot(sysH3(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x), mix(dot(sysH3(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), dot(sysH3(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y), u.z);
}
// organic raised veins (0..1): the zero-set of gradient noise (a branching network) turned into even-width ridges
// by dividing by the noise gradient; stretched along the limbs (A-pose arms / vertical legs + torso) so they follow
// the muscles, broken up by a low-frequency mask; weaker on the emblem area; faded out once sub-pixel.
float sysRidge(vec3 q, float w, float fw) {
float n = sysNoise(q), e = 0.03;
vec3 g = vec3(sysNoise(q + vec3(e, 0, 0)), sysNoise(q + vec3(0, e, 0)), sysNoise(q + vec3(0, 0, e))) - n;
float d = abs(n) / max(length(g) / e, 0.15);
return exp(- (d * d) / (w * w)) * (1.0 - smoothstep(w * 0.8, w * 2.5, fw));
}
float sysVeins(vec3 P) {
float armW = smoothstep(0.19, 0.27, abs(P.x)) * smoothstep(0.8, 0.95, P.y);
vec3 ax = normalize(mix(vec3(0.0, 1.0, 0.0), vec3(sign(P.x) * 0.66, - 0.75, 0.0), armW));
float al = dot(P, ax);
vec3 q = (P - ax * al + ax * al * 0.33) * 13.0;
float fw = length(fwidth(q));
float m1 = smoothstep(- 0.4, - 0.05, sysNoise(q * 0.35 + 11.0)), m2 = smoothstep(- 0.2, 0.15, sysNoise(q * 0.6 - 5.0));
float v = max(sysRidge(q + 3.1, 0.075, fw) * m1, 0.6 * sysRidge(q * 2.3 + 7.7, 0.07, fw * 2.3) * m2);
v = max(v, 0.85 * sysRidge(q * 0.5 + 1.7, 0.065, fw * 0.5) * smoothstep(- 0.3, 0.0, sysNoise(q * 0.2 - 3.0))); // coarse tendrils: still read at gameplay distance
float mid = (1.0 - smoothstep(0.06, 0.13, abs(P.x))) * smoothstep(1.02, 1.1, P.y) * (1.0 - smoothstep(1.46, 1.52, P.y));
return v * (1.0 - 0.7 * mid);
}
// @section fragmentMap
#include <map_fragment>
vec4 sysW = vec4(0.0);
float sysH = 0.0, sysGloss = 1.0;
if(uSuitOn > 0.5) {
vec3 c = diffuseColor.rgb;
float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
float sat = (mx - mn) / max(mx, 1e-4);
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
if(uEmbMode > 0.5) {
vec3 P = vSysRestP, N = normalize(vSysRestN);
float aa = 0.0015;
float front = step(0.02, P.z) * smoothstep(0.15, 0.45, N.z) * step(abs(P.x), 0.2);
float dF = sysSpider(P.xy, vec2(0.0, 1.345 - (uEmbScale.x - 0.075) * 0.4), uEmbScale.x, 0.0048 * uEmbScale.x / 0.075);
float mF = front * (1.0 - smoothstep(- aa, aa, dF));
o = mix(o, uEmbFront, mF);
sysW = mix(sysW, vec4(0.0, 0.0, 0.0, 1.0), mF);
float back = step(P.z, - 0.0) * smoothstep(0.15, 0.45, - N.z) * uEmbBackOn;
float dB = sysSpider(vec2(P.x, P.y), vec2(0.0, 1.24), uEmbScale.y, 0.009 * uEmbScale.y / 0.15);
float mB = back * (1.0 - smoothstep(- aa, aa, dB));
o = mix(o, uEmbBack, mB);
sysW = mix(sysW, vec4(1.0, 0.0, 0.0, 0.0), mB);
}
if(uSym > 0.5) { // symbiote: wet black (texture detail discarded) + white emblem + vein relief
vec3 P = vSysRestP;
float front = smoothstep(- 0.012, 0.012, P.z);
vec2 uv = sysSymUV(P.xy);
float inR = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    // keep the emblem off the hanging arms: torso half-width grows from the waist to the shoulders
inR *= step(abs(P.x), mix(0.16, 0.27, smoothstep(1.24, 1.46, P.y)));
vec4 mk = texture(uSymMask, uv), mkS = texture(uSymMask, uv, 1.5);
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
}
// @section fragmentRoughness
#include <roughnessmap_fragment>
if(uSuitOn > 0.5) {
vec4 rr = mix(vec4(roughnessFactor), uSuitRough, step(0.0, uSuitRough));
float ws = dot(sysW, vec4(1.0));
roughnessFactor = mix(roughnessFactor, dot(rr, sysW) / max(ws, 1e-3), clamp(ws, 0.0, 1.0));
}
// @section fragmentMetalness
#include <metalnessmap_fragment>
if(uSuitOn > 0.5) {
vec4 mm = mix(vec4(metalnessFactor), uSuitMetal, step(0.0, uSuitMetal));
float ws = dot(sysW, vec4(1.0));
metalnessFactor = mix(metalnessFactor, dot(mm, sysW) / max(ws, 1e-3), clamp(ws, 0.0, 1.0));
}
// @section fragmentNormalMaps
#include <normal_fragment_maps>
if(uSuitOn > 0.5 && uSym > 0.5) { // bump from the symbiote height field (Mikkelsen surface-gradient, view space)
vec3 sp = - vViewPosition, dpx = dFdx(sp), dpy = dFdy(sp);
float hx = dFdx(sysH), hy = dFdy(sysH);
vec3 R1 = cross(dpy, normal), R2 = cross(normal, dpx);
float det = dot(dpx, R1);
normal = normalize(abs(det) * normal - sign(det) * (hx * R1 + hy * R2) * uSymBump);
}
// @section fragmentLightsMaps
#include <lights_fragment_maps>
if(uSuitOn > 0.5 && uSym > 0.5) radiance *= mix(1.0 / 1.6, 1.0, sysGloss); // env boost (S.env) only on the wet patches (r10k)
// @section fragmentEmissive
#include <emissivemap_fragment>
if(uSuitOn > 0.5) totalEmissiveRadiance += uSuitER * sysW.x + uSuitEB * sysW.y + uSuitEW * sysW.z + uSuitEK * sysW.w;
