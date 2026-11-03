#include <common>
uniform float uSuitOn; uniform vec3 uSuitR, uSuitB, uSuitW, uSuitK, uSuitER, uSuitEB, uSuitEW, uSuitEK; uniform vec4 uSuitRough, uSuitMetal;
uniform float uEmbMode; uniform vec3 uEmbFront, uEmbBack; uniform float uEmbBackOn; uniform vec2 uEmbScale;
in vec3 vSysRestP; in vec3 vSysRestN;
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
}