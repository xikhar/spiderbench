precision highp float;
precision highp int;
precision highp usampler2D;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uDepth;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform float uFrame;
uniform float uDensity, uHeightFall, uMaxT, uStrength, uG;
__SHADER_INJECT_0__ __SHADER_INJECT_1__ float phaseHG2(float mu, float g) {
float g2 = g * g;
return (1.0 - g2) / (12.566 * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));
}
// light li's factors (cone x window x emitter cosine) at point p, and the phase toward it
float lightShape(vec4 a, vec4 b, vec4 c, vec4 d, float type, vec3 p, vec3 dir, out float ph) {
vec3 L = a.xyz - p;
float d2 = dot(L, L);
float x = d2 / (a.w * a.w);
if(x >= 1.0) {
ph = 0.0;
return 0.0;
}
float win = 1.0 - x * x;
win *= win;
vec3 Ld = L * inversesqrt(max(d2, 1e-6));
ph = phaseHG2(dot(Ld, dir), uG) * 0.7 + 0.3 * 0.0796;
if(type > 1.5) return win * max(dot(- Ld, c.xyz), 0.0);          // rect: emitter cosine (area folded into the colour)
if(type > 0.5) return win * smoothstep(c.w, d.w, dot(- Ld, c.xyz)); // spot cone
return win;
}
void main() {
float dd = texture(uDepth, vUv).r;
vec3 vd = viewDirFromUv(vUv);
vec3 dir = normalize((uCamWorld * vec4(vd, 0.0)).xyz);
float dist = isSky(dd) ? 1e5 : length(viewPosFromDepth(vUv, dd));
float tEnd = min(dist, uMaxT);
vec3 acc = vec3(0.0);
for(int sI = 0;
sI < NSEG;
sI ++) {
float s0 = float(sI) / float(NSEG), s1 = float(sI + 1) / float(NSEG);
float t0 = tEnd * s0 * s0, t1 = tEnd * s1 * s1;
vec3 pm = uCamPos + dir * (0.5 * (t0 + t1));
float sig = uDensity * exp(- max(pm.y, 0.0) * uHeightFall);
int bx, by;
uvec4 h0;
int n = cityLCell(pm, bx, by, h0);
for(int j = 0;
j < VSLOTS;
j ++) {
if(j >= n) break;
int li = cityLIndex(j, bx, by, h0);
vec4 a = cityLTex(li, 0);
vec3 lo = a.xyz - uCamPos;
float tc = dot(lo, dir);
      // skip lights whose range sphere misses this segment
float tcl = clamp(tc, t0, t1);
vec3 pc = uCamPos + dir * tcl;
if(dot(a.xyz - pc, a.xyz - pc) > a.w * a.w) continue;
vec4 b = cityLTex(li, 1);
float vol = fract(b.w);
if(vol <= 0.02) continue;
vec4 c = cityLTex(li, 2), d = cityLTex(li, 3);
float type = floor(b.w);
      // (night r11) point / spot haze core capped at a lamp head (0.9 m): headlights carry a 3.5 m diffuse softness
      // radius, which as the haze core made a 3-4 m glare ball in front of every car facing the camera (street view);
      // pk keeps the peak brightness, the glow is just compact
float rc = min(d.x, 0.9), core = type > 1.5 ? c.w * d.w : rc * rc + 0.25; // rect: its half-size as the soft core
float pk = type > 1.5 ? 1.0 : sqrt(core / (d.x * d.x + 0.25));
float h2 = max(dot(lo, lo) - tc * tc, 0.0) + core, h = sqrt(h2);
float I = pk * (atan((t1 - tc) / h) - atan((t0 - tc) / h)) / h;
if(I <= 0.0) continue;
      // shape at the closest point of the segment and at the segment middle (the cone of a spot is crossed smoothly)
float ph0, ph1;
float sh = 0.6 * lightShape(a, b, c, d, type, pc, dir, ph0) + 0.4 * lightShape(a, b, c, d, type, pm, dir, ph1);
float ph = 0.6 * ph0 + 0.4 * ph1;
vec3 col = b.rgb * (type > 1.5 ? 4.0 * c.w * d.w : 1.0);
acc += col * (vol * I * sh * ph * sig);
}
}
fragColor = vec4(acc * uStrength * cityL.misc.x * cityLEdge(uCamPos), isSky(dd) ? 1e5 : dist);
}