import{$ as e,$n as t,$r as n,Dr as r,Gt as i,Ja as a,Lt as o,O as s,Qa as c,Qi as l,Rn as u,Rt as d,U as f,V as p,Wi as m,Wr as h,Yt as g,_r as _,ar as v,bt as y,co as b,do as x,ea as S,io as C,ir as w,j as T,no as E,or as D,ro as O,ta as ee,tr as k,vt as A}from"./three~index~combat~screenshotPresets~gameSystems~GLTFLoader-BF58tRDi.js";import{a as j,n as M,r as N,t as te}from"./three~index~screenshotPresets~gameSystems-BymyXT8A.js";import{a as P,i as F,n as I,o as L,r as ne,s as R}from"./world~index~screenshotPresets~gameSystems-Dd9PBWOO.js";import{t as z}from"./n8ao~index-Ds_3QF9i.js";import{c as re,i as B,o as ie,r as ae,s as oe}from"./vehicleLighting-CSwID43I.js";import{L as se,M as ce,P as le}from"./world~index~gameSystems-Di6GBX7w.js";import{B as ue,C as de,N as fe,P as pe,S as me,_ as he,v as ge}from"./world~index~gameSystems-C6JAaHma.js";var _e=`\r
precision highp float; in vec2 vUv; out vec4 fragColor;\r
uniform sampler2D uDepth, uScene, uPrev; uniform mat4 uProj, uCamWorld, uPrevViewProj; uniform vec2 uRes;\r
uniform float uFrame, uEnvI, uHavePrev, uMaxDist, uFloor;\r
__SHADER_INJECT_0__\r
#define saturate(a) clamp(a, 0.0, 1.0)\r
uniform sampler2D envMap;\r
__SHADER_INJECT_1__\r
float linZ(vec2 uv) { float d = textureLod(uDepth, uv, 0.0).r; return isSky(d) ? 1e7 : -viewPosFromDepth(uv, d).z; }
vec3 vpos(vec2 uv) { return viewPosFromDepth(uv, texture(uDepth, uv).r); }\r
void main() {\r
  // pick one full-res pixel of the 2x2 block (rotating per frame; TAA integrates the rest)\r
  vec2 px = 1.0 / uRes;\r
  int k = int(uFrame) & 3;\r
  vec2 fp = floor(vUv * uRes * 0.5) * 2.0 + vec2(float(k & 1), float(k >> 1)) + 0.5;\r
  vec2 uv = fp * px;\r
  float w = texture(uScene, uv).a - 1.0;\r
  float d0 = texture(uDepth, uv).r;\r
  if (w < 0.01 || isSky(d0)) { fragColor = vec4(0.0); return; }\r
  vec3 P = viewPosFromDepth(uv, d0);\r
  // normal from depth: pick the smaller-difference neighbours on each axis (robust at silhouettes)\r
  vec3 pr = vpos(uv + vec2(px.x, 0.0)), pl = vpos(uv - vec2(px.x, 0.0));\r
  vec3 pu = vpos(uv + vec2(0.0, px.y)), pd = vpos(uv - vec2(0.0, px.y));\r
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;\r
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;\r
  vec3 N = normalize(cross(dx, dy));\r
  vec3 V = normalize(P);\r
  if (dot(N, V) > 0.0) N = -N;\r
  vec3 R = reflect(V, N);\r
  vec3 Rw = normalize((uCamWorld * vec4(R, 0.0)).xyz);\r
  vec3 env = textureCubeUV(envMap, Rw, 0.04).rgb * uEnvI;\r
  // --- screen-space march (perspective-correct via 1/z interpolation)\r
  float len = uMaxDist;\r
  if (R.z > 0.0) len = min(len, (-P.z - 0.12) / R.z * 0.98); // don't cross the near plane\r
  vec3 E = P + R * len;\r
  vec4 h0 = uProj * vec4(P, 1.0), h1 = uProj * vec4(E, 1.0);\r
  float k0 = 1.0 / h0.w, k1 = 1.0 / h1.w;\r
  vec2 s0 = h0.xy * k0 * 0.5 + 0.5, s1 = h1.xy * k1 * 0.5 + 0.5;\r
  // clip the screen segment to the viewport\r
  vec2 dS = s1 - s0; float tMax = 1.0;\r
  if (s1.x > 1.0) tMax = min(tMax, (1.0 - s0.x) / dS.x); if (s1.x < 0.0) tMax = min(tMax, -s0.x / dS.x);\r
  if (s1.y > 1.0) tMax = min(tMax, (1.0 - s0.y) / dS.y); if (s1.y < 0.0) tMax = min(tMax, -s0.y / dS.y);\r
  float jit = ign(gl_FragCoord.xy + uFrame * 5.588);\r
  float hitT = -1.0; float tPrev = 0.0;\r
  // nonlinear step distribution (denser near the start)\r
  for (int i = 1; i <= STEPS; i++) {\r
    float f = (float(i) - 0.5 + jit) / float(STEPS);\r
    float t = tMax * f * f;\r
    vec2 s = s0 + dS * t;\r
    float rz = 1.0 / mix(k0, k1, t);        // ray view depth (positive)\r
    float sz = linZ(s);\r
    float dz = rz - sz;\r
    float thick = max(0.35, rz * 0.035) + abs(rz - 1.0 / mix(k0, k1, tPrev));\r
    if (dz > 0.02 && dz < thick) { hitT = t; break; }\r
    tPrev = t;\r
  }\r
  if (hitT < 0.0 || uHavePrev < 0.5) { fragColor = vec4(0.0); return; }\r
  // binary refinement\r
  float a = tPrev, b = hitT;\r
  for (int i = 0; i < 5; i++) {\r
    float m = 0.5 * (a + b); vec2 s = s0 + dS * m;\r
    float rz = 1.0 / mix(k0, k1, m);\r
    if (rz > linZ(s)) b = m; else a = m;\r
  }\r
  vec2 hs = s0 + dS * b;\r
  vec3 hv = vpos(hs);\r
  // --- hit validation\r
  float rzH = 1.0 / mix(k0, k1, b);\r
  if (abs(rzH - (-hv.z)) > max(0.35, rzH * 0.03)) { fragColor = vec4(0.0); return; }         // thickness at refined hit\r
  if (abs(dot(hv - P, N)) < 0.25 + 0.01 * length(hv - P)) { fragColor = vec4(0.0); return; } // self-plane (grazing streaks)\r
  vec2 hp = 1.0 / uRes;\r
  vec3 hx = vpos(hs + vec2(hp.x, 0.0)) - hv, hy = vpos(hs + vec2(0.0, hp.y)) - hv;\r
  vec3 NH = normalize(cross(hx, hy)); if (dot(NH, hv) > 0.0) NH = -NH;\r
  float facing = clamp(-dot(NH, R) * 4.0, 0.0, 1.0);                                         // back-facing hits invalid\r
  vec3 hw = (uCamWorld * vec4(hv, 1.0)).xyz;\r
  vec4 pc = uPrevViewProj * vec4(hw, 1.0);\r
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;\r
  if (pc.w <= 0.0 || any(lessThan(puv, vec2(0.002))) || any(greaterThan(puv, vec2(0.998)))) { fragColor = vec4(0.0); return; }\r
  if (length((puv - hs) * uRes) > 0.08 * uRes.x) { fragColor = vec4(0.0); return; }           // implausible reprojection\r
  vec3 hit = texture(uPrev, puv).rgb;\r
  // firefly / blow-out guard: never more than a few times brighter than the env reflection it replaces\r
  float le = dot(env, vec3(0.2126, 0.7152, 0.0722)), lh = dot(hit, vec3(0.2126, 0.7152, 0.0722));\r
  hit *= min(1.0, (le * 3.0 + uFloor) / max(lh, 1e-4)); // (night r12) uFloor 0.5 by day, ~0.06 at night: half-res mirrored headlights / lamps were bright blocky patches on the wet road (the city-light specular already draws their real reflection)\r
  // confidence: screen edges, rays toward the camera, grazing incidence (depth normals unreliable), distance\r
  vec2 e = smoothstep(0.0, 0.1, hs) * smoothstep(1.0, 0.9, hs);\r
  float graze = smoothstep(0.02, 0.12, -dot(V, N));\r
  float conf = e.x * e.y * smoothstep(0.7, 0.2, R.z) * facing * graze * (1.0 - smoothstep(0.6, 1.0, b / max(tMax, 1e-4)) * step(0.999, tMax));\r
  fragColor = vec4((hit - env) * conf, conf);\r
}`,ve=`precision highp float;\r
precision highp sampler2DShadow;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uDepth;\r
uniform mat4 uCamWorld;\r
uniform vec3 uCamPos, uCamFwd;\r
uniform vec2 uRes;\r
uniform float uFrame;\r
uniform sampler2DShadow uSM0, uSM1, uSM2, uSM3;\r
uniform mat4 uSMat[4];\r
uniform vec4 uSplits;\r
uniform float uDensity, uHeightFall, uMaxT, uStrength;\r
__SHADER_INJECT_0__ __SHADER_INJECT_1__ float vis(vec3 p, float vz) {\r
vec4 sc;\r
if(vz < uSplits.x) {\r
sc = uSMat[0] * vec4(p, 1.0);\r
return textureLod(uSM0, sc.xyz, 0.0);\r
}\r
#if NC > 1\r
if(vz < uSplits.y) {\r
sc = uSMat[1] * vec4(p, 1.0);\r
return textureLod(uSM1, sc.xyz, 0.0);\r
}\r
#endif\r
#if NC > 2\r
if(vz < uSplits.z) {\r
sc = uSMat[2] * vec4(p, 1.0);\r
return textureLod(uSM2, sc.xyz, 0.0);\r
}\r
#endif\r
#if NC > 3\r
sc = uSMat[3] * vec4(p, 1.0);\r
if(all(greaterThan(sc.xyz, vec3(0.0))) && all(lessThan(sc.xyz, vec3(1.0)))) return textureLod(uSM3, sc.xyz, 0.0);\r
#endif\r
return 1.0;\r
}\r
void main() {\r
  // nearest-depth of the 2x2 footprint keeps foreground silhouettes clean for the bilateral upsample\r
vec2 px = 1.0 / uRes;\r
float d = texture(uDepth, vUv).r;\r
vec3 vd = viewDirFromUv(vUv);\r
vec3 dir = normalize((uCamWorld * vec4(vd, 0.0)).xyz);\r
float dist = isSky(d) ? 1e5 : length(viewPosFromDepth(vUv, d));\r
float tEnd = min(dist, uMaxT);\r
float cosF = max(dot(dir, uCamFwd), 1e-3);\r
float jit = ign(gl_FragCoord.xy + uFrame * 7.137);\r
float mu = dot(dir, uSunDir);\r
float ph = phaseHG(mu, 0.62) * 0.8 + phaseHG(mu, - 0.2) * 0.2;\r
float acc = 0.0;\r
float od = 0.0;\r
float dt = tEnd / float(STEPS);\r
for(int i = 0;\r
i < STEPS;\r
i ++) {\r
float t = (float(i) + jit) * dt;\r
vec3 p = uCamPos + dir * t;\r
float sig = uDensity * exp(- max(p.y, 0.0) * uHeightFall);\r
float v = vis(p, t * cosF);\r
acc += v * sig * exp(- od) * dt;\r
od += sig * dt;\r
}\r
vec3 L = uSunColor * ph * acc * uStrength;\r
fragColor = vec4(L, isSky(d) ? 1e5 : dist);\r
}\r
`,ye=`precision highp float;\r
precision highp int;\r
precision highp usampler2D;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uDepth;\r
uniform mat4 uCamWorld;\r
uniform vec3 uCamPos;\r
uniform float uFrame;\r
uniform float uDensity, uHeightFall, uMaxT, uStrength, uG;\r
__SHADER_INJECT_0__ __SHADER_INJECT_1__ float phaseHG2(float mu, float g) {\r
float g2 = g * g;\r
return (1.0 - g2) / (12.566 * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));\r
}\r
// light li's factors (cone x window x emitter cosine) at point p, and the phase toward it\r
float lightShape(vec4 a, vec4 b, vec4 c, vec4 d, float type, vec3 p, vec3 dir, out float ph) {\r
vec3 L = a.xyz - p;\r
float d2 = dot(L, L);\r
float x = d2 / (a.w * a.w);\r
if(x >= 1.0) {\r
ph = 0.0;\r
return 0.0;\r
}\r
float win = 1.0 - x * x;\r
win *= win;\r
vec3 Ld = L * inversesqrt(max(d2, 1e-6));\r
ph = phaseHG2(dot(Ld, dir), uG) * 0.7 + 0.3 * 0.0796;\r
if(type > 1.5) return win * max(dot(- Ld, c.xyz), 0.0);          // rect: emitter cosine (area folded into the colour)\r
if(type > 0.5) return win * smoothstep(c.w, d.w, dot(- Ld, c.xyz)); // spot cone\r
return win;\r
}\r
void main() {\r
float dd = texture(uDepth, vUv).r;\r
vec3 vd = viewDirFromUv(vUv);\r
vec3 dir = normalize((uCamWorld * vec4(vd, 0.0)).xyz);\r
float dist = isSky(dd) ? 1e5 : length(viewPosFromDepth(vUv, dd));\r
float tEnd = min(dist, uMaxT);\r
vec3 acc = vec3(0.0);\r
for(int sI = 0;\r
sI < NSEG;\r
sI ++) {\r
float s0 = float(sI) / float(NSEG), s1 = float(sI + 1) / float(NSEG);\r
float t0 = tEnd * s0 * s0, t1 = tEnd * s1 * s1;\r
vec3 pm = uCamPos + dir * (0.5 * (t0 + t1));\r
float sig = uDensity * exp(- max(pm.y, 0.0) * uHeightFall);\r
int bx, by;\r
uvec4 h0;\r
int n = cityLCell(pm, bx, by, h0);\r
for(int j = 0;\r
j < VSLOTS;\r
j ++) {\r
if(j >= n) break;\r
int li = cityLIndex(j, bx, by, h0);\r
vec4 a = cityLTex(li, 0);\r
vec3 lo = a.xyz - uCamPos;\r
float tc = dot(lo, dir);\r
      // skip lights whose range sphere misses this segment\r
float tcl = clamp(tc, t0, t1);\r
vec3 pc = uCamPos + dir * tcl;\r
if(dot(a.xyz - pc, a.xyz - pc) > a.w * a.w) continue;\r
vec4 b = cityLTex(li, 1);\r
float vol = fract(b.w);\r
if(vol <= 0.02) continue;\r
vec4 c = cityLTex(li, 2), d = cityLTex(li, 3);\r
float type = floor(b.w);\r
      // (night r11) point / spot haze core capped at a lamp head (0.9 m): headlights carry a 3.5 m diffuse softness\r
      // radius, which as the haze core made a 3-4 m glare ball in front of every car facing the camera (street view);\r
      // pk keeps the peak brightness, the glow is just compact\r
float rc = min(d.x, 0.9), core = type > 1.5 ? c.w * d.w : rc * rc + 0.25; // rect: its half-size as the soft core\r
float pk = type > 1.5 ? 1.0 : sqrt(core / (d.x * d.x + 0.25));\r
float h2 = max(dot(lo, lo) - tc * tc, 0.0) + core, h = sqrt(h2);\r
float I = pk * (atan((t1 - tc) / h) - atan((t0 - tc) / h)) / h;\r
if(I <= 0.0) continue;\r
      // shape at the closest point of the segment and at the segment middle (the cone of a spot is crossed smoothly)\r
float ph0, ph1;\r
float sh = 0.6 * lightShape(a, b, c, d, type, pc, dir, ph0) + 0.4 * lightShape(a, b, c, d, type, pm, dir, ph1);\r
float ph = 0.6 * ph0 + 0.4 * ph1;\r
vec3 col = b.rgb * (type > 1.5 ? 4.0 * c.w * d.w : 1.0);\r
acc += col * (vol * I * sh * ph * sig);\r
}\r
}\r
fragColor = vec4(acc * uStrength * cityL.misc.x * cityLEdge(uCamPos), isSky(dd) ? 1e5 : dist);\r
}`,be=`precision highp float;\r
precision highp sampler2DShadow;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform float uAbs, uAbsK;\r
uniform sampler2D uDepth, uPrevRad;\r
uniform mat4 uProj, uCamWorld, uPrevViewProj;\r
uniform vec2 uRes;\r
uniform float uFrame, uEnvI, uHavePrev, uStrength;\r
uniform vec3 uAmbBounce;\r
uniform sampler2DShadow uSM0, uSM1, uSM2, uSM3;\r
uniform mat4 uSMat[4];\r
uniform vec4 uSplits;\r
__SHADER_INJECT_0__ __SHADER_INJECT_1__\r
#define saturate(a) clamp(a, 0.0, 1.0)\r
uniform sampler2D envMap;\r
__SHADER_INJECT_2__ float linZ(vec2 uv) {\r
float d = textureLod(uDepth, uv, 0.0).r;\r
return isSky(d) ? 1e7 : - viewPosFromDepth(uv, d).z;\r
}\r
vec3 vpos(vec2 uv) {\r
return viewPosFromDepth(uv, textureLod(uDepth, uv, 0.0).r);\r
}\r
float sunVis(vec3 p, float vz) {\r
vec4 sc;\r
if(vz < uSplits.x) {\r
sc = uSMat[0] * vec4(p, 1.0);\r
return texture(uSM0, sc.xyz);\r
}\r
#if NC > 1\r
if(vz < uSplits.y) {\r
sc = uSMat[1] * vec4(p, 1.0);\r
return texture(uSM1, sc.xyz);\r
}\r
#endif\r
#if NC > 2\r
if(vz < uSplits.z) {\r
sc = uSMat[2] * vec4(p, 1.0);\r
return texture(uSM2, sc.xyz);\r
}\r
#endif\r
#if NC > 3\r
sc = uSMat[3] * vec4(p, 1.0);\r
if(all(greaterThan(sc.xyz, vec3(0.0))) && all(lessThan(sc.xyz, vec3(1.0)))) return texture(uSM3, sc.xyz);\r
#endif\r
return 1.0;\r
}\r
void main() {\r
vec2 px = 1.0 / uRes;\r
int k = int(uFrame) & 3;\r
vec2 fp = floor(vUv * uRes * 0.5) * 2.0 + vec2(float(k & 1), float(k >> 1)) + 0.5;\r
vec2 uv = fp * px;\r
float d0 = texture(uDepth, uv).r;\r
if(isSky(d0) || uHavePrev < 0.5) {\r
fragColor = vec4(0.0, 0.0, 0.0, 1e5);\r
return;\r
}\r
vec3 P = viewPosFromDepth(uv, d0);\r
float dist = length(P);\r
if(dist > 1500.0) {\r
fragColor = vec4(0.0, 0.0, 0.0, dist);\r
return;\r
}\r
vec3 pr = vpos(uv + vec2(px.x, 0.0)), pl = vpos(uv - vec2(px.x, 0.0));\r
vec3 pu = vpos(uv + vec2(0.0, px.y)), pd = vpos(uv - vec2(0.0, px.y));\r
vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;\r
vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;\r
vec3 N = normalize(cross(dx, dy));\r
if(dot(N, P) > 0.0) N = - N;\r
  // tangent frame\r
vec3 T = normalize(abs(N.y) < 0.9 ? cross(N, vec3(0.0, 1.0, 0.0)) : cross(N, vec3(1.0, 0.0, 0.0)));\r
vec3 B = cross(N, T);\r
float jit = ign(gl_FragCoord.xy + uFrame * 5.588);\r
float jit2 = ign(gl_FragCoord.yx * 1.37 + uFrame * 3.17);\r
float R = clamp(dist * 0.06, 4.0, 40.0); // gather radius (m): local bounce near, block-scale bounce far\r
vec3 acc = vec3(0.0);\r
for(int i = 0;\r
i < DIRS;\r
i ++) {\r
    // cosine-weighted hemisphere (stratified spiral, rotated per pixel / frame)\r
float u1 = (float(i) + jit) / float(DIRS);\r
float phi = 6.2831853 * (float(i) * 0.618034 + jit2);\r
float r = sqrt(u1);\r
vec3 dir = T * (r * cos(phi)) + B * (r * sin(phi)) + N * sqrt(max(1.0 - u1, 0.0));\r
for(int s = 1;\r
s <= STEPS;\r
s ++) {\r
float f = (float(s) - 0.5 * jit) / float(STEPS);\r
float t = max(R * f * f, 0.25);\r
vec3 S = P + N * 0.08 + dir * t;\r
if(S.z > - 0.1) break;\r
vec4 h = uProj * vec4(S, 1.0);\r
vec2 su = h.xy / h.w * 0.5 + 0.5;\r
if(any(lessThan(su, vec2(0.0))) || any(greaterThan(su, vec2(1.0)))) break;\r
float sz = linZ(su);\r
float dz = - S.z - sz;\r
if(dz > 0.05 && dz < max(1.5, t * 0.8)) {\r
vec3 hv = vpos(su);\r
vec3 hw = (uCamWorld * vec4(hv, 1.0)).xyz;\r
vec4 pc = uPrevViewProj * vec4(hw, 1.0);\r
vec2 puv = pc.xy / pc.w * 0.5 + 0.5;\r
if(pc.w > 0.0 && all(greaterThan(puv, vec2(0.0))) && all(lessThan(puv, vec2(1.0)))) {\r
vec3 L = textureLod(uPrevRad, puv, 0.0).rgb;\r
L *= min(1.0, 8.0 / max(dot(L, vec3(0.2126, 0.7152, 0.0722)), 1e-4));\r
acc += L;\r
}\r
break;\r
}\r
}\r
}\r
vec3 Egi = 3.14159265 * acc / float(DIRS);\r
  // irradiance this pixel already receives: sun (real shadow maps) + sky fill + the analytic bounce approximation\r
vec3 Pw = (uCamWorld * vec4(P, 1.0)).xyz;\r
vec3 Nw = normalize((uCamWorld * vec4(N, 0.0)).xyz);\r
float ndl = max(dot(Nw, uSunDir), 0.0);\r
float vis = ndl > 0.0 ? sunVis(Pw + Nw * 0.25 + uSunDir * 0.1, - P.z) : 0.0;\r
vec3 Eamb = 3.14159265 * textureCubeUV(envMap, Nw, 1.0).rgb * uEnvI + uAmbBounce;\r
float Ed = dot(uSunColor * ndl * vis + Eamb, vec3(0.2126, 0.7152, 0.0722));\r
vec3 ratio = Egi * uStrength / max(Ed, 1e-3);\r
ratio = min(ratio, vec3(1.6));\r
  // (night) emissive bounce: lit windows, screens, signs, neon, headlights light the surfaces around them. At night the\r
  // pixel's own irradiance is ~0, so the ratio form cannot add light; output the absolute irradiance instead (composite\r
  // adds it with an albedo proxy)\r
vec3 gAbs = Egi * uAbsK;\r
gAbs *= 0.9 / (0.9 + max(gAbs.r, max(gAbs.g, gAbs.b))); // (r10) soft cap: colour bleed kept, no amber wash\r
fragColor = vec4(mix(ratio, gAbs, uAbs), dist);\r
}`,xe=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uDepth, uSky;\r
uniform vec2 uSunUv;\r
uniform float uAspect;\r
__SHADER_INJECT_0__ void main() {\r
float v = 0.0;\r
float n = 0.0;\r
for(int y = - 4;\r
y <= 4;\r
y ++) for(int x = - 4;\r
x <= 4;\r
x ++) {\r
vec2 uv = uSunUv + vec2(float(x) / uAspect, float(y)) * 0.0022;\r
float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);\r
float s = isSky(texture(uDepth, uv).r) ? texture(uSky, uv).a : 0.0;\r
v += s * inside;\r
n += 1.0;\r
}\r
fragColor = vec4(v / n, 0.0, 0.0, 1.0);\r
}`,Se=`precision highp float;\r
precision highp sampler3D;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uColor, uDepth, uSky, uSceneA, uSSR, uShafts;\r
uniform sampler2D uCVol;\r
uniform float uCVolOn;\r
uniform vec2 uQuarterPx; // (night)\r
uniform sampler2D uGI;\r
uniform float uGIOn, uGIAbs, uGIAlb; // (lighting2 r1) SSGI\r
uniform vec3 uMoonDir;\r
uniform float uMoonK; // (daynight)\r
uniform vec3 uNightHaze, uNightHazeHi;\r
uniform float uNightFog; // (night)\r
uniform vec3 uGlowCol;\r
uniform float uGlowH, uGlowK;\r
uniform vec3 uNightMid, uTsGlow, uNightMidLevel;\r
// (night r14) path length through an exponential height layer: int_a^b exp(-(y0 + t dy) / H) dt (density 1 at y = 0)\r
float hazeInt(float y0, float dy, float a, float b, float H) {\r
  float e0 = exp(-(y0 + a * dy) / H);\r
  if(abs(dy) < 1e-3)\r
    return (b - a) * e0;\r
  return H / dy * (e0 - exp(-(y0 + b * dy) / H));\r
}\r
// (foundation agent) projected cloud shadows: the sky's cumulus coverage field sampled where the sun ray from a surface\r
// point crosses the cloud layer (same noise / coverage as sky.ts cloudDensity, lower cloud band)\r
uniform sampler3D uNoise;\r
uniform float uCloudCoverage, uCloudBottom, uCloudTop, uCloudShadow, uCloudScale;\r
uniform vec3 uCloudOffset;\r
uniform mat4 uCamWorld;\r
uniform vec3 uCamPos;\r
uniform vec2 uPx, uHalfPx;\r
uniform float uFogDensity, uFogFalloff, uFogSun, uFogStart, uSSROn, uShaftOn;\r
uniform vec3 uFogTint;\r
__SHADER_INJECT_0__ __SHADER_INJECT_1__ vec3 fogColor(vec3 dir, float sunVis) {\r
  // (atmosphere r2) looking down from altitude the haze in-scatter picks up more of the blue sky above (not the pale\r
  // horizon), and it warms toward the sun (forward Mie)\r
vec3 c = skyLUT(normalize(vec3(dir.x, max(dir.y * 0.3, 0.012) + 0.05 * clamp(- dir.y * 2.0, 0.0, 1.0), dir.z))) * uFogTint;\r
float mu = dot(dir, uSunDir);\r
c *= mix(vec3(1.0), vec3(1.1, 1.0, 0.86), smoothstep(0.2, 0.95, mu) * 0.6);\r
c += uSunColor * phaseHG(mu, 0.7) * uFogSun * 0.05 * sunVis;\r
  // (night) the night haze is lit by the city below (light pollution), not by the black sky: a purple-grey veil,\r
  // brighter / warmer toward the horizon and the street glow, cooler and dimmer looking up (refs/night esb + haze)\r
if(uNightFog > 0.0) c = mix(c, mix(uNightHaze, uNightHazeHi, smoothstep(- 0.05, 0.35, dir.y)), uNightFog);\r
return c;\r
}\r
float cloudShadowAt(vec3 wp) {\r
if(uSunDir.y < 0.06 || uCloudShadow <= 0.0) return 0.0;\r
vec3 p = wp * 0.001;\r
float sh = 0.0;\r
for(int k = 0;\r
k < 2;\r
k ++) {\r
float hf = k == 0 ? 0.08 : 0.22;\r
float h = mix(uCloudBottom, uCloudTop, hf);\r
float t = (h - p.y) / uSunDir.y;\r
vec3 q = vec3(p.x + uSunDir.x * t, RG + h, p.z + uSunDir.z * t) + uCloudOffset;\r
    // This loop can continue based on per-pixel coverage, so use explicit LOD for the non-mipmapped noise volume.\r
float wx = textureLod(uNoise, vec3(q.xz * 0.018, 0.31), 0.0).r;\r
float wy = textureLod(uNoise, vec3(q.xz * 0.05 + 0.5, 0.71), 0.0).r;\r
float cov = clamp(uCloudCoverage * (0.55 + 0.8 * smoothstep(0.1, 0.8, wx)) * (0.8 + 0.4 * wy), 0.0, 1.0);\r
if(cov < 0.02) continue;\r
vec4 nb = textureLod(uNoise, q * vec3(uCloudScale, 0.2, uCloudScale), 0.0); // (atmosphere r1) same shape as sky.ts cloudDensity\r
float base = clamp((nb.r + (1.0 - (nb.g * 0.625 + nb.b * 0.25 + nb.a * 0.125)) * 0.6) / (1.0 + (1.0 - (nb.g * 0.625 + nb.b * 0.25 + nb.a * 0.125)) * 0.6), 0.0, 1.0);\r
float top = mix(0.35, 1.0, cov);\r
float grad = smoothstep(0.0, 0.07, hf) * (1.0 - smoothstep(top * 0.4, top, hf));\r
float d = (base * grad - (1.0 - cov)) / max(cov, 1e-3);\r
sh = max(sh, smoothstep(0.0, 0.3, d));\r
}\r
return sh * uCloudShadow * smoothstep(0.06, 0.2, uSunDir.y);\r
}\r
// depth-aware upsample of a half-res buffer whose alpha holds linear distance\r
vec3 upsampleHalf(sampler2D tex, vec2 uv, float dist, vec2 hp) {\r
vec2 base = (floor(uv / hp - 0.5) + 0.5) * hp;\r
vec2 f = (uv - base) / hp;\r
vec3 acc = vec3(0.0);\r
float ws = 0.0;\r
for(int j = 0;\r
j < 2;\r
j ++) for(int i = 0;\r
i < 2;\r
i ++) {\r
vec2 o = vec2(float(i), float(j));\r
vec4 s = texture(tex, base + o * hp);\r
float bw = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);\r
float dw = 1.0 / (1e-3 + abs(s.a - dist) / max(dist, 1.0) * 20.0);\r
float w = bw * dw + 1e-5;\r
acc += s.rgb * w;\r
ws += w;\r
}\r
return acc / ws;\r
}\r
vec3 upsampleShafts(vec2 uv, float dist) {\r
return upsampleHalf(uShafts, uv, dist, uHalfPx);\r
}\r
// (lighting2 r1) depth-aware 3x3 blur-upsample of the half-res SSGI ratio (a = distance)\r
vec3 upsampleGI(vec2 uv, float dist) {\r
vec3 acc = vec3(0.0);\r
float ws = 0.0;\r
for(int j = - 1;\r
j <= 1;\r
j ++) for(int i = - 1;\r
i <= 1;\r
i ++) {\r
vec4 s = texture(uGI, uv + vec2(float(i), float(j)) * uHalfPx * 1.5);\r
float w = exp(- abs(s.a - dist) / max(dist, 1.0) * 30.0) * (i == 0 && j == 0 ? 2.0 : 1.0) + 1e-5;\r
acc += s.rgb * w;\r
ws += w;\r
}\r
return acc / ws;\r
}\r
void main() {\r
float d = texture(uDepth, vUv).r;\r
vec3 vd = viewDirFromUv(vUv);\r
vec3 dir = normalize((uCamWorld * vec4(vd, 0.0)).xyz);\r
if(isSky(d)) {\r
vec4 s = texture(uSky, vUv);\r
vec3 c = s.rgb;\r
    // sun disk with limb darkening, occluded by clouds (s.a = cloud transmittance)\r
float ct = dot(dir, uSunDir);\r
float ang = acos(clamp(ct, - 1.0, 1.0));\r
float R = 0.0052;\r
if(ang < R * 1.5) {\r
float x = clamp(ang / R, 0.0, 1.0);\r
float limb = 1.0 - 0.6 * (1.0 - sqrt(max(1.0 - x * x, 0.0)));\r
float disk = 1.0 - smoothstep(0.85, 1.0, ang / R);\r
c += uSunColor * 90.0 * limb * disk * s.a;\r
}\r
if(uMoonK > 0.0) { // (daynight) moon disc: mottled maria, soft halo (bloom picks it up at night exposure)\r
float ma = acos(clamp(dot(dir, uMoonDir), - 1.0, 1.0));\r
float Rm = 0.0078;\r
if(ma < Rm * 12.0) {\r
vec3 mt = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)) + 1e-5);\r
vec3 mb = cross(mt, uMoonDir);\r
vec2 mq = vec2(dot(dir - uMoonDir, mt), dot(dir - uMoonDir, mb)) / Rm;\r
float maria = 0.72 + 0.28 * smoothstep(0.1, 0.5, length(mq - vec2(0.3, 0.25))) * smoothstep(0.05, 0.35, length(mq + vec2(0.35, - 0.1)));\r
float mdisk = 1.0 - smoothstep(0.88, 1.0, ma / Rm);\r
c += (vec3(0.9, 0.92, 1.0) * 1.8 * maria * mdisk + vec3(0.45, 0.55, 0.8) * 0.05 * exp(- ma / Rm * 0.9)) * uMoonK * s.a;\r
}\r
}\r
if(uShaftOn > 0.5) c += upsampleShafts(vUv, 1e5);\r
if(uCVolOn > 0.5) c += upsampleHalf(uCVol, vUv, 1e5, uQuarterPx);\r
fragColor = vec4(c, 1.0);\r
return;\r
}\r
vec3 col = texture(uColor, vUv).rgb;\r
if(uGIOn > 0.5) {\r
float gd = length(viewPosFromDepth(vUv, d));\r
vec3 gi = upsampleGI(vUv, gd);\r
col = mix(col * (1.0 + gi), col + gi * uGIAlb, uGIAbs); // (night) additive emissive bounce (albedo proxy)\r
}\r
if(uSSROn > 0.5) {\r
float w = texture(uSceneA, vUv).a - 1.0;\r
if(w > 0.01) {\r
vec3 r = vec3(0.0);\r
r += texture(uSSR, vUv + uHalfPx * vec2(- 0.5, - 0.5)).rgb;\r
r += texture(uSSR, vUv + uHalfPx * vec2(0.5, - 0.5)).rgb;\r
r += texture(uSSR, vUv + uHalfPx * vec2(- 0.5, 0.5)).rgb;\r
r += texture(uSSR, vUv + uHalfPx * vec2(0.5, 0.5)).rgb;\r
col = max(col + w * r * 0.25, vec3(0.0));\r
      // reflection floor: glossy glass never collapses to black when it reflects a shadowed street / SSR miss.\r
      // Stylised like the refs: at least ~60% of the (horizon-ish) sky radiance times the Fresnel weight.\r
vec3 skyH = skyLUT(normalize(vec3(dir.x, 0.12, dir.z)));\r
col = max(col, w * mix(skyH * 0.35, (uNightHaze * 1.1 + uGlowCol * 0.7) * smoothstep(0.25, 0.6, w), uNightFog)); // only true mirrors (puddles, glass), not glossy paint stripes // (night) SSR misses on wet ground mirror the light-polluted street haze, not a black sky (critic r1: puddles = dark holes)\r
}\r
}\r
vec3 pv = viewPosFromDepth(vUv, d);\r
float dist = length(pv);\r
  // (foundation agent) cloud shadows darken the lit scene before the aerial perspective (so haze stays bright)\r
if(dist < 20000.0) col *= 1.0 - cloudShadowAt(uCamPos + dir * dist) * (1.0 - smoothstep(9000.0, 20000.0, dist));\r
float dd = max(dist - uFogStart, 0.0);\r
float h0 = uCamPos.y;\r
float k = uFogFalloff;\r
float ry = dir.y;\r
float od;\r
float a = uFogDensity * exp(- k * max(h0, 0.0));\r
if(abs(ry * k * dd) < 1e-3) od = a * dd;\r
else od = a * (1.0 - exp(- k * ry * dd)) / (k * ry);\r
  // (atmosphere r2) tighter distance curve: the near / mid range (< ~400 m) keeps its saturation and contrast, the\r
  // 1-4 km band hazes faster (mid-distance tower clusters get aerial perspective), and the optical depth saturates\r
  // softly so far silhouettes never vanish into a uniform white wall (critic: 'milky at 500 m', 'flat white band')\r
od *= mix(0.45, 1.3, smoothstep(150.0, 2600.0, dist)); // (lighting2 r2) 0.3 -> 0.45: street-level haze down the avenues\r
od = od / (1.0 + od * 0.22);\r
vec3 T = exp(- od * vec3(0.86, 1.0, 1.16));\r
  // (foundation agent) the horizon skirt (water.ts, ~140 km) is fully in-scattered even for level rays from altitude,\r
  // where the height-falloff optical depth stays small -> no dark line on the geometric horizon\r
T *= 1.0 - smoothstep(25000.0, 60000.0, dist);\r
vec3 fogC = fogColor(dir, uShaftOn > 0.5 ? 0.35 : 1.0);\r
  // (foundation agent) far-field in-scatter converges to the untinted horizon sky: the fogged hinterland meets the sky\r
  // without a darker seam at the horizon (the tint only deepens the near/mid-distance haze)\r
  // (round 4) converge later: the near / mid distance keeps the blue-grey tinted in-scatter (graded aerial perspective\r
  // instead of a milky-white wall), only the far hinterland / horizon skirt melts into the horizon sky\r
fogC = mix(fogC, skyLUT(normalize(vec3(dir.x, 0.012, dir.z))), smoothstep(9000.0, 45000.0, dist));\r
if(uNightFog > 0.0) fogC = mix(fogC, uNightMid, uNightFog * smoothstep(120.0, 350.0, dist) * (1.0 - smoothstep(900.0, 2200.0, dist))); // (night r6) moonlit blue atmosphere in the 150-900 m band (rooftop_haze ref), purple light-pollution haze beyond\r
col = col * T + fogC * (1.0 - T);\r
if(uShaftOn > 0.5) col += upsampleShafts(vUv, dist);\r
if(uCVolOn > 0.5) col += upsampleHalf(uCVol, vUv, dist, uQuarterPx);\r
  // (night) street-level glow: the low haze layer (y < uGlowH) in the street canyons scatters the lamp / shop / car\r
  // light, so from above the avenues read as warm glowing lines and at street level distant blocks sit in a warm veil\r
if(uNightFog > 0.0) {\r
    // (night r7) moonlit blue atmosphere: additive in-scatter in the 150 m - 2 km band (lifts the dark city between the\r
    // avenues to a deep blue like the rooftop_haze ref; a tint of the thin fog alone could not lift the blacks)\r
float bandA = (1.0 - exp(- dist * 0.0011)) * smoothstep(120.0, 350.0, dist) * (1.0 - smoothstep(1800.0, 3500.0, dist));\r
col += mix(uNightMidLevel, uNightMid, smoothstep(0.25, 0.6, - dir.y)) * bandA * 0.45 * uNightFog; // (night r8) blue when looking down (rooftop_haze ref), grey-violet near level (esb ref)\r
    // (night r7) Times Square: the air between the towers glows with the screens (ray segment inside the square's box)\r
{\r
      // (night r14) no 90 m ceiling (a flat lid over the square seen while swinging): the glow thins out with height (H 70 m)\r
vec3 bmin = vec3(- 80.0, 0.0, - 245.0), bmax = vec3(82.0, 400.0, - 78.0);\r
vec3 inv = 1.0 / (dir + vec3(1e-6));\r
vec3 t0 = (bmin - uCamPos) * inv, t1 = (bmax - uCamPos) * inv;\r
vec3 tn = min(t0, t1), tf = max(t0, t1);\r
float ta = max(max(tn.x, tn.y), max(tn.z, 0.0)), tb = min(min(tf.x, tf.y), min(tf.z, min(dist, 3000.0)));\r
if(tb > ta) col += uTsGlow * (1.0 - exp(- hazeInt(uCamPos.y, dir.y, ta, tb, 70.0) * 0.0084)) * uNightFog;\r
}\r
    // (night r14) user: 'a clear separation of the street level lights and the darkness above, like a plane'. The warm\r
    // street glow was a slab (full density below uGlowH = 22 m, none above): its top read as a flat lid across the\r
    // facades. Now an exponential layer (density 1 at the street, 1/e at uGlowH * 1.5 = 33 m): same glow in the canyons,\r
    // fading out gradually up the walls\r
float y0 = uCamPos.y, dl = min(dist, 700.0); // (night r4) only the street canyons near the view glow: grazing rays to far water / shores crossed km of the layer (critic: water glows brighter than the city)\r
float lin = hazeInt(max(y0, 0.0), dir.y, 0.0, dl, uGlowH * 1.5);\r
col += uGlowCol * (1.0 - exp(- lin * uGlowK)) * uNightFog * mix(0.6, 1.0, smoothstep(20.0, 120.0, y0)); // (night r7) street-level cameras: less amber canyon tint (critic: warm dusk, ref is blue night)\r
}\r
fragColor = vec4(col, 1.0);\r
}\r
`,Ce=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uCurrent, uHistory, uDepth;\r
uniform mat4 uCamWorld, uPrevViewProj;\r
uniform vec2 uRes, uJitter;\r
uniform float uBlend, uReset;\r
uniform sampler2D uMask;\r
uniform float uMaskOn;\r
uniform mat4 uObjDelta;\r
uniform mat4 uProjInvU;\r
__SHADER_INJECT_0__ __SHADER_INJECT_1__\r
// view position with the UN-jittered projection (history lives in the unjittered frame)\r
vec3 viewPosU(vec2 uv, float d) {\r
float z = uReversed > 0.5 ? d : d * 2.0 - 1.0;\r
vec4 p = uProjInvU * vec4(uv * 2.0 - 1.0, z, 1.0);\r
return p.xyz / p.w;\r
}\r
vec3 toYC(vec3 c) {\r
return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, - 0.25 * c.r + 0.5 * c.g - 0.25 * c.b);\r
}\r
vec3 fromYC(vec3 y) {\r
return vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z);\r
}\r
vec3 tm(vec3 c) {\r
return c / (1.0 + luma(c));\r
}\r
vec3 itm(vec3 c) {\r
return c / max(1.0 - luma(c), 1e-4);\r
}\r
vec3 sampleCR(sampler2D t, vec2 uv) {\r
vec2 sp = uv * uRes;\r
vec2 tc = floor(sp - 0.5) + 0.5;\r
vec2 f = sp - tc;\r
vec2 w0 = f * (- 0.5 + f * (1.0 - 0.5 * f));\r
vec2 w1 = 1.0 + f * f * (- 2.5 + 1.5 * f);\r
vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));\r
vec2 w3 = f * f * (- 0.5 + 0.5 * f);\r
vec2 w12 = w1 + w2;\r
vec2 tc0 = (tc - 1.0) / uRes;\r
vec2 tc3 = (tc + 2.0) / uRes;\r
vec2 tc12 = (tc + w2 / w12) / uRes;\r
vec3 r = texture(t, vec2(tc12.x, tc0.y)).rgb * (w12.x * w0.y) + texture(t, vec2(tc0.x, tc12.y)).rgb * (w0.x * w12.y) + texture(t, vec2(tc12.x, tc12.y)).rgb * (w12.x * w12.y) + texture(t, vec2(tc3.x, tc12.y)).rgb * (w3.x * w12.y) + texture(t, vec2(tc12.x, tc3.y)).rgb * (w12.x * w3.y);\r
float ws = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;\r
return max(r / ws, 0.0);\r
}\r
void main() {\r
vec2 px = 1.0 / uRes;\r
  // un-jitter the current frame: content that belongs at vUv was rendered at vUv + uJitter (uv units)\r
vec3 cur = sampleCR(uCurrent, vUv + uJitter);\r
vec3 m1 = vec3(0.0), m2 = vec3(0.0);\r
float closest = uReversed > 0.5 ? 0.0 : 1.0;\r
vec2 cuv = vUv;\r
vec3 cmin = vec3(1e9), cmax = vec3(- 1e9);\r
for(int y = - 1;\r
y <= 1;\r
y ++) for(int x = - 1;\r
x <= 1;\r
x ++) {\r
vec2 o = vec2(x, y) * px;\r
vec3 c = toYC(tm(texture(uCurrent, vUv + o).rgb));\r
m1 += c;\r
m2 += c * c;\r
cmin = min(cmin, c);\r
cmax = max(cmax, c);\r
float d = texture(uDepth, vUv + o).r;\r
bool nearer = uReversed > 0.5 ? d > closest : d < closest;\r
if(nearer) {\r
closest = d;\r
cuv = vUv + o;\r
}\r
}\r
vec3 world;\r
if(isSky(closest)) world = (uCamWorld * vec4(viewDirFromUv(vUv) * 1e5, 1.0)).xyz;\r
else world = (uCamWorld * vec4(viewPosU(vUv, closest), 1.0)).xyz;\r
  // character pixel? (mask depth == scene depth) -> reproject with the character's rigid motion\r
bool isChar = false;\r
if(uMaskOn > 0.5) {\r
float md = texture(uMask, cuv).r;\r
if(! isSky(md)) {\r
float zs = - viewPosFromDepth(cuv, closest).z, zm = - viewPosFromDepth(cuv, md).z;\r
isChar = abs(zs - zm) < 0.03 + 0.004 * zs;\r
}\r
}\r
if(isChar) world = (uObjDelta * vec4(world, 1.0)).xyz;\r
vec4 pc = uPrevViewProj * vec4(world, 1.0);\r
vec2 puv = pc.xy / pc.w * 0.5 + 0.5;\r
if(uReset > 0.5 || any(lessThan(puv, vec2(0.0))) || any(greaterThan(puv, vec2(1.0))) || pc.w <= 0.0) {\r
fragColor = vec4(cur, 1.0);\r
return;\r
}\r
vec3 hist = toYC(tm(sampleCR(uHistory, puv)));\r
vec3 mu = m1 / 9.0;\r
vec3 sig = sqrt(max(m2 / 9.0 - mu * mu, 0.0));\r
float vel = length((puv - vUv) * uRes);\r
  // static / slow: wide box (no edge flicker from the neighbourhood itself moving with the jitter); fast: tight\r
float g = vel < 0.5 ? 1.9 : mix(1.4, 0.9, clamp((vel - 0.5) / 8.0, 0.0, 1.0));\r
if(isChar) g = min(g, 1.0);\r
vec3 bmin = max(cmin, mu - g * sig), bmax = min(cmax, mu + g * sig);\r
  // clip toward the mean\r
vec3 pc0 = 0.5 * (bmax + bmin), e = 0.5 * (bmax - bmin) + 1e-5;\r
vec3 v = hist - pc0;\r
vec3 a = abs(v / e);\r
float ma = max(a.x, max(a.y, a.z));\r
if(ma > 1.0) hist = pc0 + v / ma;\r
vec3 curT = toYC(tm(cur));\r
float blend = mix(uBlend, 0.25, clamp(vel / 20.0, 0.0, 1.0));\r
  // where the history had to be clipped hard (edge flips between frames) trust the stable history a bit more\r
if(vel < 0.5) blend *= mix(1.0, 0.6, clamp(ma - 1.0, 0.0, 1.0));\r
if(isChar) blend = max(blend, 0.14);\r
vec3 res = mix(hist, curT, blend);\r
fragColor = vec4(itm(fromYC(res)), 1.0);\r
}`,we=`uniform float uFocus, uBokeh, uMaxCoc, uFar;\r
float cocAt(float d, vec2 uv) { // signed CoC in half-res pixels (background side scaled by uFar)\r
  if(isSky(d))\r
    return min(uMaxCoc, uBokeh * 0.5 * uFar);\r
  float z = -viewPosFromDepth(uv, d).z;\r
  float c = uBokeh * 0.5 * (z - uFocus) / max(z, 1e-3);\r
  if(c > 0.0)\r
    c *= uFar;\r
  return clamp(c, -uMaxCoc, uMaxCoc);\r
}`,Te=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uColor, uDepth;\r
uniform vec2 uPx;\r
__SHADER_INJECT_0__ __SHADER_INJECT_1__ __SHADER_INJECT_2__ void main() {\r
vec2 o[4] = vec2[](vec2(- 0.5, - 0.5), vec2(0.5, - 0.5), vec2(- 0.5, 0.5), vec2(0.5, 0.5));\r
vec3 c = vec3(0.0);\r
float ws = 0.0;\r
float cmin = 1e9, cmax = - 1e9;\r
for(int i = 0;\r
i < 4;\r
i ++) {\r
vec2 uv = vUv + o[i] * uPx;\r
vec3 s = texture(uColor, uv).rgb;\r
float w = 1.0 / (1.0 + luma(s));\r
c += s * w;\r
ws += w;\r
float k = cocAt(texture(uDepth, uv).r, uv);\r
cmin = min(cmin, k);\r
cmax = max(cmax, k);\r
}\r
float coc = cmin < 0.0 ? cmin : cmax;\r
fragColor = vec4(c / ws, coc);\r
}`,Ee=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uSrc;\r
uniform vec2 uKernel[TAPS];\r
uniform float uMaxCoc;\r
uniform vec2 uPx;\r
float weigh(float coc, float r) {\r
  return clamp((coc - r + 2.0) / 2.0, 0.0, 1.0);\r
}\r
void main() {\r
  vec4 ctr = texture(uSrc, vUv);\r
  vec3 bg = vec3(0.0), fg = vec3(0.0);\r
  float bw = 0.0, fw = 0.0;\r
  for(int i = 0; i < TAPS; i++) {\r
    vec2 o = uKernel[i] * uMaxCoc;\r
    float r = length(o);\r
    vec4 s = texture(uSrc, vUv + o * uPx);\r
    float w = weigh(max(0.0, min(s.a, ctr.a)), r);\r
    bg += s.rgb * w;\r
    bw += w;\r
    float f = weigh(-s.a, r);\r
    fg += s.rgb * f;\r
    fw += f;\r
  }\r
  bg /= bw + (bw == 0.0 ? 1.0 : 0.0);\r
  fg /= fw + (fw == 0.0 ? 1.0 : 0.0);\r
  float a = min(1.0, fw * 3.14159 / float(TAPS));\r
  fragColor = vec4(mix(bg, fg, a), a);\r
}`,De=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uSrc;\r
uniform vec2 uPx;\r
void main() {\r
  vec4 o = vec4(uPx.xy, -uPx.xy) * 0.5;\r
  fragColor = 0.25 * (texture(uSrc, vUv + o.xy) + texture(uSrc, vUv + o.zy) + texture(uSrc, vUv + o.xw) + texture(uSrc, vUv + o.zw));\r
}`,Oe=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uColor, uDof, uDepth;\r
__SHADER_INJECT_0__ __SHADER_INJECT_1__ void main() {\r
vec3 src = texture(uColor, vUv).rgb;\r
vec4 dof = texture(uDof, vUv);\r
float coc = cocAt(texture(uDepth, vUv).r, vUv);\r
float s = smoothstep(0.25, 1.2, abs(coc));\r
vec3 c = mix(src, dof.rgb, s + dof.a - s * dof.a);\r
fragColor = vec4(c, 1.0);\r
}`,ke=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uColor, uDepth;\r
uniform mat4 uCamWorld, uPrevViewProj;\r
uniform float uScale, uMask, uFrame;\r
uniform vec2 uRes;\r
__SHADER_INJECT_0__ float linZ(vec2 uv) {\r
float d = textureLod(uDepth, uv, 0.0).r;\r
return isSky(d) ? 1e6 : - viewPosFromDepth(uv, d).z;\r
}\r
void main() {\r
float d = texture(uDepth, vUv).r;\r
vec3 world = isSky(d) ? (uCamWorld * vec4(viewDirFromUv(vUv) * 1e5, 1.0)).xyz : (uCamWorld * vec4(viewPosFromDepth(vUv, d), 1.0)).xyz;\r
vec4 pc = uPrevViewProj * vec4(world, 1.0);\r
vec2 puv = pc.xy / pc.w * 0.5 + 0.5;\r
vec2 v = (vUv - puv) * uScale;\r
float z = isSky(d) ? 1e6 : - viewPosFromDepth(vUv, d).z;\r
v *= smoothstep(uMask, uMask + 5.0, z); // near-field (foliage beside the lens, the character) stays crisp\r
float lp = length(v * uRes);\r
float maxL = 0.1 * uRes.x; // (user r10e: room for the High / Very High settings)\r
if(lp > maxL) v *= maxL / lp;\r
vec3 c = texture(uColor, vUv).rgb;\r
if(lp < 0.5) {\r
fragColor = vec4(c, 1.0);\r
return;\r
}\r
float j = ign(gl_FragCoord.xy + uFrame * 5.588238) - 0.5;\r
vec3 acc = c;\r
float ws = 1.0;\r
int n = lp > 20.0 ? SAMPLES * 2 : SAMPLES; // long streaks: more taps (no discrete ghost copies)\r
for(int i = 0;\r
i < SAMPLES * 2;\r
i ++) {\r
if(i >= n) break;\r
float t = (float(i) + 0.5 + j) / float(n) - 0.5;\r
vec2 uv = vUv + v * t;\r
float sz = linZ(uv);\r
float w = smoothstep(uMask, uMask + 5.0, sz); // don't smear the sharp foreground (character) over bg\r
acc += textureLod(uColor, uv, 0.0).rgb * w;\r
ws += w;\r
}\r
fragColor = vec4(acc / ws, 1.0);\r
}`,Ae=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uSrc;\r
uniform vec2 uPx;\r
uniform float uFirst;\r
__SHADER_INJECT_0__ vec3 s(vec2 o) {\r
return texture(uSrc, vUv + o * uPx).rgb;\r
}\r
vec3 kw(vec3 a, vec3 b, vec3 c, vec3 d) {\r
if(uFirst < 0.5) return (a + b + c + d) * 0.25;\r
float wa = 1.0 / (1.0 + luma(a)), wb = 1.0 / (1.0 + luma(b)), wc = 1.0 / (1.0 + luma(c)), wd = 1.0 / (1.0 + luma(d));\r
return (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);\r
}\r
void main() {\r
vec3 A = s(vec2(- 2, - 2)), B = s(vec2(0, - 2)), C = s(vec2(2, - 2)), D = s(vec2(- 1, - 1)), E = s(vec2(1, - 1));\r
vec3 F = s(vec2(- 2, 0)), G = s(vec2(0, 0)), H_ = s(vec2(2, 0)), I = s(vec2(- 1, 1)), J = s(vec2(1, 1));\r
vec3 K = s(vec2(- 2, 2)), L = s(vec2(0, 2)), M = s(vec2(2, 2));\r
vec3 c = kw(D, E, I, J) * 0.5 + kw(A, B, F, G) * 0.125 + kw(B, C, G, H_) * 0.125 + kw(F, G, K, L) * 0.125 + kw(G, H_, L, M) * 0.125;\r
float lc = luma(c);\r
c *= min(1.0, 48.0 / max(lc, 1e-4)); // clamp bloom input (tiny sun glints must not bloom into blobs) (lighting2 r1: 16 -> 48, the sun disk glows)\r
fragColor = vec4(c, 1.0);\r
}`,je=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uSrc, uCur;\r
uniform vec2 uPx;\r
uniform float uRadius;\r
uniform float uT, uK, uThrSrc;\r
vec3 thr(vec3 c) {\r
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));\r
  float s = clamp(l - uT + uK, 0.0, 2.0 * uK);\r
  s = s * s / (4.0 * uK + 1e-4);\r
  return c * max(s, l - uT) / max(l, 1e-4);\r
}\r
vec3 src(vec2 uv) {\r
  vec3 c = texture(uSrc, uv).rgb;\r
  return uThrSrc > 0.5 ? thr(c) : c;\r
}\r
void main() {\r
  vec4 d = vec4(uPx, -uPx.x, 0.0) * uRadius;\r
  vec3 s = src(vUv - d.xy) + 2.0 * src(vUv - d.wy) + src(vUv - d.zy) + 2.0 * src(vUv + d.zw) + 4.0 * src(vUv) + 2.0 * src(vUv + d.xw) + src(vUv + d.zy) + 2.0 * src(vUv + d.wy) + src(vUv + d.xy);\r
  fragColor = vec4(thr(texture(uCur, vUv).rgb) + s / 16.0, 1.0);\r
}`,Me=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uSrc, uPrev;\r
uniform float uRate, uReset;\r
// weighted MEDIAN of log2 luminance (32-bin histogram over [-12, 4] EV): robust to a bright sky or a dark glass wall\r
void main() {\r
  float h[32];\r
  for(int i = 0; i < 32; i++) h[i] = 0.0;\r
  float ws = 0.0;\r
  for(int y = 0; y < 24; y++) for(int x = 0; x < 40; x++) {\r
      vec2 uv = (vec2(float(x), float(y)) + 0.5) / vec2(40.0, 24.0);\r
      vec3 c = texture(uSrc, uv).rgb;\r
      float l = clamp(log2(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-5)), -12.0, 3.99);\r
      vec2 d = (uv - 0.5) * vec2(1.6, 1.8);\r
      float w = exp(-dot(d, d) * 2.2) + 0.15;                 // centre weighted (subject), some frame-wide influence\r
      h[int((l + 12.0) * 2.0)] += w;\r
      ws += w;\r
    }\r
  // average of the 40..60th percentile band (smooth, stable)\r
  float cum = 0.0, acc = 0.0, aw = 0.0;\r
  for(int i = 0; i < 32; i++) {\r
    float lo = cum / ws;\r
    cum += h[i];\r
    float hi = cum / ws;\r
    float ov = max(0.0, min(hi, 0.6) - max(lo, 0.4));\r
    acc += ov * (float(i) + 0.5) * 0.5;\r
    aw += ov;\r
  }\r
  float cur = acc / max(aw, 1e-5) - 12.0;\r
  float prev = texture(uPrev, vec2(0.5)).r;\r
  float a = uReset > 0.5 ? 1.0 : uRate;\r
  fragColor = vec4(mix(prev, cur, a), cur, 0.0, 1.0);\r
}`,Ne=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uColor, uBloom;\r
uniform vec2 uPx;\r
uniform sampler2D uStreakSrc, uStreakLo;\r
uniform float uStreak, uStreakT; // (night)\r
uniform float uExposure, uBloomStr, uSat, uContrast, uVignette, uCA, uSharpen, uGrain, uFrame, uAspect;\r
uniform vec3 uLift, uGamma, uGain, uWB;\r
uniform float uPivot, uSatKnee;\r
uniform sampler2D uSunVis;\r
uniform vec2 uSunUv;\r
uniform float uFlare;\r
uniform vec3 uSunCol;\r
uniform sampler2D uAE;\r
uniform float uAEOn, uAEKey, uAEStr, uAERange;\r
uniform vec3 uSplitSh, uSplitHi;\r
uniform float uSplitBal;\r
uniform float uWarmGuard;\r
uniform sampler2D uDepthS;\r
uniform mat4 uProjInvS;\r
uniform float uRevS;\r
bool isSkyD(float d) {\r
  return uRevS > 0.5 ? d <= 0.0 : d >= 1.0;\r
}\r
vec3 viewPosFromDepthS(vec2 uv, float d) {\r
  float z = uRevS > 0.5 ? d : d * 2.0 - 1.0;\r
  vec4 p = uProjInvS * vec4(uv * 2.0 - 1.0, z, 1.0);\r
  return p.xyz / p.w;\r
}\r
// subtle camera-lens response to the sun: soft glare, a few chromatic ghosts mirrored through the centre, halo ring\r
vec3 lensFlare(vec2 uv) {\r
  float vis = texture(uSunVis, vec2(0.5)).r * uFlare;\r
  if(vis < 1e-3)\r
    return vec3(0.0);\r
  vec2 asp = vec2(uAspect, 1.0);\r
  vec2 sp = uSunUv;\r
  vec2 toC = vec2(0.5) - sp;\r
  vec3 acc = vec3(0.0);\r
  // glare around the sun (wide, soft)\r
  float ds = length((uv - sp) * asp);\r
  acc += vec3(1.0, 0.86, 0.66) * (0.022 / (ds * ds * 40.0 + 0.02)) * 0.02;\r
  // (lighting2 r1) physically-motivated veiling glare: a tight hot core + a wide warm halo (sun glow of the golden-hour ref)\r
  acc += vec3(1.0, 0.86, 0.66) * (0.22 * exp(-ds * 13.0) + 0.05 * exp(-ds * 3.5)); // (lighting2 r2) brighter core + wider warm halo (golden-hour ref sun bloom)\r
  // ghosts\r
  const float gpos[5] = float[](0.55, 0.9, 1.25, 1.6, 2.1);\r
  const float gsize[5] = float[](0.035, 0.018, 0.06, 0.025, 0.09);\r
  const vec3 gcol[5] = vec3[](vec3(0.45, 0.6, 1.0), vec3(1.0, 0.7, 0.35), vec3(0.4, 1.0, 0.6), vec3(1.0, 0.45, 0.3), vec3(0.5, 0.55, 1.0));\r
  for(int i = 0; i < 5; i++) {\r
    vec2 gp = sp + toC * gpos[i];\r
    float r = length((uv - gp) * asp) / gsize[i];\r
    float disk = smoothstep(1.0, 0.75, r) * (0.55 + 0.45 * smoothstep(0.2, 1.0, r));\r
    acc += gcol[i] * disk * 0.012;\r
  }\r
  // halo ring centred on the screen, brightest on the sun side\r
  vec2 hv = (uv - vec2(0.5)) * asp;\r
  float hr = length(hv);\r
  float ring = exp(-pow((hr - 0.42) / 0.018, 2.0)) * max(dot(normalize(hv + 1e-5), normalize(-toC * asp + 1e-5)), 0.0);\r
  acc += vec3(0.55, 0.7, 1.0) * ring * 0.01;\r
  // fade as the sun leaves the frame\r
  vec2 e = smoothstep(-0.25, 0.1, sp) * smoothstep(1.25, 0.9, sp);\r
  return acc * vis * e.x * e.y * uSunCol;\r
}\r
__SHADER_INJECT_0__ float ignf(vec2 p) {\r
return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));\r
}\r
// ACES fitted (Stephen Hill)\r
const mat3 ACESIn = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);\r
const mat3 ACESOut = mat3(1.60475, - 0.10208, - 0.00327, - 0.53108, 1.10813, - 0.07276, - 0.07367, - 0.00605, 1.07602);\r
vec3 RRTAndODTFit(vec3 v) {\r
vec3 a = v * (v + 0.0245786) - 0.000090537;\r
vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;\r
return a / b;\r
}\r
// (lighting2 r1) softer toe: the fitted RRT crushes the darks ~6x at 0.02 (shade went black while sunlit faces were fine);\r
// a smooth max with a linear segment (slope uToe) keeps shaded walls / streets readable, mid-tones and highlights unchanged\r
uniform float uToe;\r
uniform float uRain;\r
vec3 aces(vec3 c) {\r
c = ACESIn * c;\r
vec3 r = RRTAndODTFit(c);\r
vec3 l = c * uToe;\r
r = 0.5 * (r + l + sqrt((r - l) * (r - l) + 0.01 * (r + l) * (r + l)));\r
return clamp(ACESOut * r, 0.0, 1.0);\r
}\r
vec3 tmS(vec3 c) {\r
return c / (1.0 + luma(c));\r
}\r
vec3 itmS(vec3 c) {\r
return c / max(1.0 - luma(c), 1e-4);\r
}\r
void main() {\r
vec2 d = vUv - 0.5;\r
  // sharpen (in a compressed domain to avoid halos on HDR edges)\r
vec3 c0 = tmS(texture(uColor, vUv).rgb);\r
vec3 n = tmS(texture(uColor, vUv + vec2(0.0, uPx.y)).rgb), s = tmS(texture(uColor, vUv - vec2(0.0, uPx.y)).rgb);\r
vec3 e = tmS(texture(uColor, vUv + vec2(uPx.x, 0.0)).rgb), w = tmS(texture(uColor, vUv - vec2(uPx.x, 0.0)).rgb);\r
  // luma-only adaptive sharpen (no chroma fringes / colour noise), weaker with distance (TAA already resolves far detail)\r
float l0 = luma(c0), ln = luma(n), ls = luma(s), le_ = luma(e), lw = luma(w);\r
float mnl = min(l0, min(min(ln, ls), min(le_, lw))), mxl = max(l0, max(max(ln, ls), max(le_, lw)));\r
float amp = sqrt(clamp(min(mnl, 1.0 - mxl) / max(mxl, 1e-4), 0.0, 1.0));\r
float dz = texture(uDepthS, vUv).r;\r
float zv = isSkyD(dz) ? 1e4 : - viewPosFromDepthS(vUv, dz).z;\r
float distK = mix(1.0, 0.35, smoothstep(15.0, 120.0, zv));\r
float dl = (4.0 * l0 - ln - ls - le_ - lw) * uSharpen * amp * 0.25 * distK;\r
vec3 c = itmS(clamp(c0 * (1.0 + dl / max(l0, 1e-4)), 0.0, 0.999));\r
  // chromatic aberration (radial, very subtle)\r
vec2 cao = d * dot(d, d) * uCA * 4.0 * smoothstep(0.3, 0.7, length(d * vec2(uAspect, 1.0))); // edges only\r
c.r = mix(c.r, texture(uColor, vUv - cao).r, 0.85);\r
c.b = mix(c.b, texture(uColor, vUv + cao).b, 0.85);\r
  // bloom (energy-conserving mix)\r
vec3 b = texture(uBloom, vUv).rgb;\r
c += b * uBloomStr; // (lighting2 r1) additive thresholded bloom\r
  // (night) anamorphic streak (street ref: thin cool horizontal streaks through lamp heads / headlights): the half-res\r
  // radiance above a high threshold, smeared horizontally with an exponential falloff\r
if(uStreak > 0.0) {\r
vec3 st = vec3(0.0);\r
for(int k = 1;\r
k <= 12;\r
k ++) {\r
float o = float(k * k) * 0.0012, w = exp(- float(k) * 0.28);\r
      // (night r11) point sources only: minus 1.5x the 1/16-res local mean, so big bright screens (whose mean ~ their\r
      // radiance) don't smear a long pink bar across the frame; lamp heads / headlights (a few px) keep their streak\r
vec2 ua = vUv + vec2(o, 0.0), ub = vUv - vec2(o, 0.0);\r
vec3 a = texture(uStreakSrc, ua).rgb - 1.5 * texture(uStreakLo, ua).rgb, bb = texture(uStreakSrc, ub).rgb - 1.5 * texture(uStreakLo, ub).rgb;\r
st += (max(a - uStreakT, 0.0) + max(bb - uStreakT, 0.0)) * w;\r
}\r
c += dot(st, vec3(0.3, 0.5, 0.2)) * vec3(0.45, 0.62, 1.0) * uStreak;\r
}\r
c += lensFlare(vUv);\r
float ev = 0.0;\r
if(uAEOn > 0.5) ev = clamp(- (texture(uAE, vec2(0.5)).r - uAEKey) * uAEStr, - uAERange, uAERange);\r
c *= uExposure * exp2(ev) * uWB;\r
  // vignette\r
vec2 dv = d * vec2(uAspect, 1.0);\r
c *= mix(1.0, 1.0 - smoothstep(0.25, 1.05, length(dv)), uVignette);\r
c = aces(c);\r
{ // (atmosphere r2) split toning: cool shade, warm sunlit highlights (keeps luma)\r
float sl = luma(c);\r
vec3 tt = mix(uSplitSh, uSplitHi, smoothstep(uSplitBal * 0.25, uSplitBal * 2.2, sl));\r
tt = mix(tt, uSplitHi, uWarmGuard * smoothstep(0.02, 0.2, (c.r - c.b) / max(sl, 1e-3))); // (night r9) warm lamp / sodium / shop light keeps its warmth: no cool shift on warm pixels (critic: lavender lamp pools)\r
tt /= dot(tt, vec3(0.2126, 0.7152, 0.0722));\r
c *= tt;\r
}\r
if(uRain > 0.0) { // (lighting2 r3) overcast preset: cheap screen-space rain streaks (2 layers, slanted, falling)\r
float rr = 0.0, tt = uFrame / 60.0;\r
for(int i = 0;\r
i < 2;\r
i ++) {\r
float sc = i == 0 ? 1.0 : 1.9;\r
vec2 p = vec2(vUv.x * uAspect * 70.0 * sc + vUv.y * 5.0 * sc, vUv.y * 2.2 * sc + tt * (3.2 + 1.4 * float(i)));\r
float col = floor(p.x), h = fract(sin(col * 91.3 + float(i) * 17.0) * 43758.5);\r
float y = fract(p.y + h * 10.0 + tt * h);\r
float st = smoothstep(0.0, 0.04, y) * smoothstep(0.3 + 0.2 * h, 0.04, y) * step(0.5, h);\r
st *= smoothstep(0.35, 0.0, abs(fract(p.x) - 0.5));\r
rr += st * (i == 0 ? 0.7 : 0.4);\r
}\r
c = mix(c, vec3(0.72, 0.75, 0.8), clamp(rr * 0.11 * uRain, 0.0, 1.0));\r
}\r
  // grade (display-linear): lift/gamma/gain, contrast, saturation\r
c = max(uGain * (c + uLift * (1.0 - c)), 0.0);\r
c = pow(max(c, 0.0), 1.0 / uGamma);\r
float l = luma(c);\r
c = mix(vec3(l), c, uSat);\r
c = clamp(c, 0.0, 1.0);\r
{ // chroma soft-clip\r
float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));\r
float st = (mx - mn) / max(mx, 1e-4);\r
if(st > uSatKnee) {\r
float t = uSatKnee + (1.0 - uSatKnee) * (1.0 - exp(- (st - uSatKnee) / (1.0 - uSatKnee) * 1.6)) / 1.6 * 1.25;\r
float k = clamp(t / st, 0.0, 1.0);\r
c = mx - (mx - c) * k;\r
}\r
}\r
vec3 lc = log2(c + 1e-4);\r
c = exp2((lc - log2(uPivot)) * uContrast + log2(uPivot)) - 1e-4;\r
  // highlight shoulder: roll off above 0.72 instead of clipping (sky, white paint, speculars keep detail)\r
  // shoulder from 0.8 that still reaches 1.0 (~1% of pixels: speculars, white paint, sun-lit clouds may clip like the refs)\r
  // (lighting2 r3) day refs (measured): p95 0.44-0.77, p99 <= 0.83 display-linear, < 1 % clipped; ours had p95 0.85-0.9\r
  // and 2-11 % clipped (sunlit cream walls, sky). Softer shoulder from 0.62 (asymptote ~0.99): sunlit faces stay bright\r
  // + warm with texture instead of white\r
vec3 hs = 0.62 + 0.37 * (1.0 - exp(- max(c - 0.62, 0.0) / 0.37));\r
c = mix(c, hs, step(0.62, c));\r
vec3 o = linearToSRGB(clamp(c, 0.0, 1.0));\r
  // grain + dither\r
float g = ignf(gl_FragCoord.xy + fract(uFrame * 0.618) * 113.0) - 0.5;\r
o += g * (1.0 / 255.0 + uGrain * (1.0 - o) * 0.5);\r
fragColor = vec4(o, 1.0);\r
}`,Pe=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uSrc;\r
uniform float uScale, uMode;\r
void main() {\r
  vec4 t = texture(uSrc, vUv);\r
  vec3 c = uMode > 0.5 ? vec3(t.a - 1.0) : t.rgb;\r
  c = abs(c) * uScale;\r
  fragColor = vec4(pow(c / (1.0 + c), vec3(1.0 / 2.2)), 1.0);\r
}`,V=`// common shader sections.\r
\r
// @section depthReconstruction\r
\r
uniform mat4 uProjInv;\r
uniform float uReversed; // 1.0 when renderer uses reversed depth (EXT_clip_control, [0,1] NDC z)\r
bool isSky(float d) {\r
  return uReversed > 0.5 ? d <= 0.0 : d >= 1.0;\r
}\r
vec3 viewPosFromDepth(vec2 uv, float d) {\r
  float z = uReversed > 0.5 ? d : d * 2.0 - 1.0;\r
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, z, 1.0);\r
  return p.xyz / p.w;\r
}\r
vec3 viewDirFromUv(vec2 uv) {\r
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, 0.5, 1.0);\r
  return normalize(p.xyz / p.w);\r
}\r
float ign(vec2 p) {\r
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));\r
}\r
\r
// @section colorSpaceConversion\r
\r
float luma(vec3 c) {\r
  return dot(c, vec3(0.2126, 0.7152, 0.0722));\r
}\r
vec3 linearToSRGB(vec3 c) {\r
  c = max(c, 0.0);\r
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));\r
}\r
`,Fe=`out vec2 vUv;\r
void main() {\r
    vUv = uv;\r
    gl_Position = vec4(position.xy, 0.0, 1.0);\r
}`,Ie=L(()=>V),H=new T;H.setAttribute(`position`,new o([-1,-1,0,3,-1,0,-1,3,0],3)),H.setAttribute(`uv`,new o([0,0,2,0,0,2],2));var U=new r(-1,1,1,-1,0,1),Le=Fe,W=class e{static registeredPasses=[];static camera=U;material;mesh;uniforms;constructor({uniforms:t={},fragmentShader:n,defines:r={},blending:a=0,name:o=`pass`}){e.registeredPasses.push(this),this.material=new ee({name:o,uniforms:t,defines:r,glslVersion:i,vertexShader:Le,fragmentShader:n,depthTest:!1,depthWrite:!1,blending:a,toneMapped:!1}),this.mesh=new v(H,this.material),this.mesh.frustumCulled=!1,this.uniforms=this.material.uniforms}render(e,t=null){e.setRenderTarget(t??null),e.render(this.mesh,U)}};function G(e,t,n={}){let r=new x(Math.max(1,e|0),Math.max(1,t|0),{type:n.type??1016,format:n.format??1023,minFilter:n.filter??1006,magFilter:n.filter??1006,depthBuffer:n.depthBuffer??!1,stencilBuffer:!1,generateMipmaps:!1,wrapS:p,wrapT:p,colorSpace:``,count:n.count??1});return n.depthTexture&&(r.depthTexture=n.depthTexture),r}var K=Ie.depthReconstruction,Re=Ie.colorSpaceConversion;function ze(e,t){let n=1,r=0;for(;e>0;)n/=t,r+=e%t*n,e=Math.floor(e/t);return r}var Be=`// sky shader sections.\r
\r
// @section commonAtmosphere\r
\r
uniform sampler2D uSkyLUT;\r
uniform vec3 uSunDir;\r
uniform vec3 uSunColor;   // sun illuminance (scaled) at ground\r
uniform float uSkyScale;\r
uniform vec3 uSkyTint;    // day: 1; night: dim blue (moonlit sky)\r
uniform vec3 uSkyGlow;    // additive horizon glow (city light pollution at night / warm dusk band)\r
uniform vec3 uHzK;        // (atmosphere r1) horizon-band radiance multiplier\r
uniform vec4 uSunGlow;    // (lighting2 r2) golden aureole: rgb warm tint, w strength (0 = off)\r
uniform float uOvercast;  // (lighting2 r4) overcast deck: 0 = clear .. 1 = fully grey, low, heavy sky\r
__SHADER_INJECT_0__ vec3 skyLUT(vec3 dir) {\r
float el = asin(clamp(dir.y, - 1.0, 1.0));\r
vec2 dh = dir.xz;\r
vec2 sh = uSunDir.xz;\r
float ca = dot(normalize(dh + vec2(1e-6, 0.0)), normalize(sh + vec2(1e-6, 0.0)));\r
float u = acos(clamp(ca, - 1.0, 1.0)) / PI_;\r
float v = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / (PI_ * 0.5));\r
u = clamp(u, 0.5 / float(__SHADER_INJECT_1__), 1.0 - 0.5 / float(__SHADER_INJECT_2__));\r
// (foundation agent, round 10) horizon deepening: the LUT's last few degrees saturate to a near-white band that\r
// everything far (fog in-scatter, sky, horizon skirt) converges to -> critic: 'over-bright white haze band'. A soft\r
// blue-grey multiplier on the low sky (applied here, so fog / sky / reflections all converge to the same value)\r
// (atmosphere r1) stronger: the refs' horizon haze is a light grey-blue a little DARKER than the upper sky, never\r
// the brightest thing in frame (measured: refs 07 / 09 horizon ~0.55-0.68 sRGB vs our old ~0.95 cream-white band)\r
vec3 hzK = mix(vec3(uHzK), vec3(1.0), smoothstep(0.0, 0.3, abs(dir.y)));\r
vec3 sc = texture(uSkyLUT, vec2(u, v)).rgb * uSkyScale * uSkyTint * hzK + uSkyGlow * exp(- max(dir.y, 0.0) * 7.0);\r
// (lighting2 r2) golden-hour aureole: warm forward-scattering haze around a low sun (the single-scattering LUT stays\r
// blue-white there). De-saturates the blue toward the sun and adds a warm glow, strongest near the horizon. Fog,\r
// env reflections and cloud ambient all read skyLUT, so the golden haze carries through the whole frame.\r
if(uSunGlow.w > 0.0) {\r
float mu = max(dot(dir, uSunDir), 0.0);\r
float hzw = exp(- max(dir.y, 0.0) * 2.2);\r
float lobe = (0.7 * pow(mu, 5.0) + 0.45 * pow(mu, 1.5) * hzw + 0.18 * hzw + 1.6 * pow(mu, 48.0)) * uSunGlow.w;\r
float sl = dot(sc, vec3(0.2126, 0.7152, 0.0722));\r
sc = mix(sc, vec3(sl), clamp(lobe * 0.9, 0.0, 0.9)) + uSunGlow.rgb * sl * lobe;\r
}\r
if(uOvercast > 0.0) { // (lighting2 r4) director: 'overcast still shows a clear BLUE sky'. A grey storm deck: the sky\r
// (and so fog in-scatter, env reflections and cloud ambient) becomes a flat grey, brightest at the zenith\r
float ol = dot(sc, vec3(0.2126, 0.7152, 0.0722));\r
vec3 deck = vec3(0.86, 0.88, 0.91) * ol * mix(0.55, 1.0, smoothstep(- 0.05, 0.6, dir.y));\r
sc = mix(sc, deck, uOvercast);\r
}\r
return sc;\r
}\r
\r
// @section clouds\r
\r
uniform sampler3D uNoise;\r
uniform float uCloudCoverage, uCloudDensity, uCloudBottom, uCloudTop, uCloudFade;\r
uniform vec3 uCloudOffset;\r
uniform float uSkyline;\r
// (atmosphere r1) cloud look controls: sun-scatter gain, ambient gain, base-noise scale (1/km), cirrus amount\r
uniform float uCloudSun, uCloudAmb, uCloudScale, uCirrus, uCloudErode, uCloudDetailScale;\r
uniform float uCloudBaseDark; // (atmosphere r2) 0..1 how much darker the flat cloud bases are than the tops\r
uniform vec3 uFacadeAlb;\r
uniform float uNight;\r
float hash11(float p) {\r
p = fract(p * .1031);\r
p *= p + 33.33;\r
p *= p + p;\r
return fract(p);\r
}\r
float remap(float v, float a, float b, float c, float d) {\r
return c + (v - a) / (b - a) * (d - c);\r
}\r
float cloudDensity(vec3 p, float hf, bool detail) {\r
vec3 q = p + uCloudOffset;\r
  // Cloud density is evaluated inside a raymarch that exits at a pixel-dependent point. Explicit level-zero\r
  // sampling avoids undefined implicit derivatives there; uNoise has no mipmaps, so this matches texture().\r
float wx = textureLod(uNoise, vec3(q.xz * 0.018, 0.31), 0.0).r;\r
float wy = textureLod(uNoise, vec3(q.xz * 0.05 + 0.5, 0.71), 0.0).r;\r
float cov = clamp(uCloudCoverage * (0.55 + 0.8 * smoothstep(0.1, 0.8, wx)) * (0.8 + 0.4 * wy), 0.0, 1.0); // (atmosphere r1: flatter weather mask, clouds everywhere like the refs)\r
if(cov < 0.02) return 0.0;\r
vec4 n = textureLod(uNoise, q * vec3(uCloudScale, 0.2, uCloudScale), 0.0);\r
  // (atmosphere r1) Nubis-style base shape: the perlin-worley eroded by the low-frequency worley fbm -> lumpy cumulus\r
  // towers instead of smooth blobs\r
float lf = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;\r
float base = clamp(remap(n.r, - (1.0 - lf) * 0.6, 1.0, 0.0, 1.0), 0.0, 1.0);\r
  // cumulus height profile: flat-ish base, rounded tops, taller where coverage is high\r
float top = mix(0.35, 1.0, cov);\r
float grad = smoothstep(0.0, 0.07, hf) * (1.0 - smoothstep(top * 0.4, top, hf));\r
float d = remap(base * grad, 1.0 - cov, 1.0, 0.0, 1.0);\r
if(d <= 0.0) return 0.0;\r
if(detail) {\r
vec4 dn = textureLod(uNoise, q * uCloudDetailScale + vec3(0.0, hf * 0.3, 0.0), 0.0);\r
float df = dn.g * 0.625 + dn.b * 0.25 + dn.a * 0.125;\r
df = mix(df, 1.0 - df, clamp(hf * 4.0, 0.0, 1.0));\r
d = remap(d, df * uCloudErode, 1.0, 0.0, 1.0);\r
    // (atmosphere r2) second, finer billow octave on the thin outer shell only: cauliflower lumps on the sunlit\r
    // tops / edges instead of airbrushed blobs (cheap: skipped in the dense core)\r
if(d > 0.0 && d < 0.45) {\r
vec4 dn2 = textureLod(uNoise, q * uCloudDetailScale * 3.1 + vec3(0.37, hf * 0.6, 0.11), 0.0);\r
float df2 = 1.0 - (dn2.g * 0.6 + dn2.b * 0.4);\r
d = remap(d, df2 * 0.35 * (1.0 - d / 0.45), 1.0, 0.0, 1.0);\r
}\r
}\r
return clamp(d, 0.0, 1.0) * uCloudDensity;\r
}\r
float cloudPhase(float mu, float k) {\r
return mix(phaseHG(mu, 0.78 * k), phaseHG(mu, - 0.25 * k), 0.3) * 4.0 * PI_ * 0.25 + 0.75;\r
}\r
// returns premultiplied cloud radiance (rgb) and transmittance (a)\r
vec4 marchClouds(vec3 camM, vec3 rd, float jitter) {\r
vec3 ro = vec3(camM.x * 0.001, RG + max(camM.y, 1.0) * 0.001, camM.z * 0.001);\r
if(rd.y < - 0.03) return vec4(0.0, 0.0, 0.0, 1.0);\r
if(raySphere(ro, rd, RG).x > 0.0) return vec4(0.0, 0.0, 0.0, 1.0);\r
float t0 = raySphere(ro, rd, RG + uCloudBottom).y;\r
float t1 = raySphere(ro, rd, RG + uCloudTop).y;\r
if(t0 > 160.0) return vec4(0.0, 0.0, 0.0, 1.0);\r
t1 = min(t1, t0 + 14.0);\r
float len = t1 - t0;\r
float dt = len / float(CLOUD_STEPS);\r
float mu = dot(rd, uSunDir);\r
vec3 ambTop = skyLUT(normalize(vec3(0.3, 1.0, 0.2))) * 1.1 * uCloudAmb;\r
vec3 ambBot = skyLUT(normalize(vec3(- 0.9, 0.08, 0.3))) * 0.55 * uCloudAmb;\r
vec3 L = vec3(0.0);\r
float T = 1.0;\r
float tw = 0.0, ws = 0.0;\r
float t = t0 + dt * jitter;\r
const float SIGMA = 45.0; // extinction per km at density 1\r
for(int i = 0;\r
i < CLOUD_STEPS;\r
i ++) {\r
vec3 p = ro + rd * t;\r
float hf = (length(p) - RG - uCloudBottom) / (uCloudTop - uCloudBottom);\r
float d = cloudDensity(p, hf, true);\r
if(d > 0.002) {\r
float od = 0.0;\r
float lt = 0.0;\r
for(int j = 0;\r
j < CLOUD_LIGHT_STEPS;\r
j ++) {\r
float sl = 0.06 * pow(3.0, float(j));\r
vec3 lp = p + uSunDir * (lt + sl * 0.5);\r
float lhf = (length(lp) - RG - uCloudBottom) / (uCloudTop - uCloudBottom);\r
// (atmosphere r3) the first (short) light step sees the detail erosion: the billows self-shadow each other, so\r
// the cloud has internal lit / shaded lumps instead of one smooth airbrushed gradient\r
od += cloudDensity(lp, lhf, j == 0) * sl;\r
lt += sl;\r
}\r
// multiple-scattering octaves (Wrenninge)\r
float ms = 0.0, a = 1.0, b = 1.0, c = 1.0;\r
for(int k = 0;\r
k < 3;\r
k ++) {\r
ms += a * cloudPhase(mu, c) * exp(- SIGMA * od * b);\r
a *= 0.5;\r
b *= 0.4;\r
c *= 0.5;\r
} // (atmosphere r2: 0.55/0.35 -> 0.5/0.4, deeper self-shadow)\r
float powder = 1.0 - 0.55 * exp(- d * 6.0);\r
vec3 sunL = uSunColor * ms * powder * (0.25 / PI_) * uCloudSun;\r
// (atmosphere r2) dark flat bases (little skylight reaches the underside, city below is dark), bright tops\r
vec3 amb = mix(ambBot, ambTop, clamp(hf, 0.0, 1.0)) * mix(1.0, 0.25 + 0.75 * smoothstep(0.0, 0.6, hf), uCloudBaseDark) + uSkyGlow * uNight * 1.1 * (1.0 - clamp(hf, 0.0, 1.0)); // (night) r3: undersides lit by the city, brighter than the sky (critic: dark cloud blobs) // (lighting2 r5) city glow lights the cloud undersides at night (orange underlit deck)\r
float sig = d * SIGMA;\r
vec3 S = sunL + amb;\r
float Ts = exp(- sig * dt);\r
L += T * S * (1.0 - Ts);\r
tw += t * T * (1.0 - Ts);\r
ws += T * (1.0 - Ts);\r
T *= Ts;\r
if(T < 0.02) break;\r
}\r
t += dt;\r
}\r
float tAvg = ws > 0.0 ? tw / ws : t0;\r
// (atmosphere r1) aerial perspective on the clouds: distant clouds do not vanish (that left a cloudless milky band\r
// above the horizon), they take on the hazy horizon radiance -- a soft, slightly brighter-than-haze cloud bank\r
// like the refs; only the very farthest ones dissolve completely\r
float fade = exp(- tAvg / uCloudFade);\r
float keep = exp(- tAvg / (uCloudFade * 3.5));\r
vec3 hzC = skyLUT(normalize(vec3(rd.x, 0.03, rd.z)));\r
float a = (1.0 - T) * keep;\r
return vec4(L * fade * keep + hzC * a * (1.0 - fade) * 1.12, 1.0 - a);\r
}\r
// (atmosphere r1) high cirrus / cirrostratus veil at ~8 km: one wind-stretched noise layer, thin and bright, sheared\r
// into streaks (cheap: 2 lookups). Returns premultiplied radiance (rgb) and transmittance (a).\r
vec4 cirrusLayer(vec3 camM, vec3 rd) {\r
if(uCirrus <= 0.0 || rd.y < 0.0) return vec4(0.0, 0.0, 0.0, 1.0);\r
vec3 ro = vec3(camM.x * 0.001, RG + max(camM.y, 1.0) * 0.001, camM.z * 0.001);\r
float t = raySphere(ro, rd, RG + 8.0).y;\r
vec3 p = ro + rd * t;\r
vec2 q = p.xz + uCloudOffset.xz * 0.4;\r
vec2 w = vec2(q.x * 0.9 + q.y * 0.35, q.y * 0.25 - q.x * 0.1); // wind-stretched (long streaks)\r
float big = texture(uNoise, vec3(q * 0.006, 0.43)).r;\r
float n1 = texture(uNoise, vec3(w * 0.035, 0.17)).g;\r
float n2 = texture(uNoise, vec3(w * 0.11 + n1 * 0.2, 0.61)).b;\r
float d = smoothstep(0.35, 0.9, big) * smoothstep(0.45, 0.85, n1 * 0.75 + n2 * 0.45) * uCirrus;\r
d *= smoothstep(0.0, 0.06, rd.y) * exp(- t / 160.0);\r
float mu = dot(rd, uSunDir);\r
vec3 c = uSunColor * (0.05 + 0.25 * phaseHG(mu, 0.6)) * 0.55 + skyLUT(vec3(0.0, 1.0, 0.0)) * 1.1;\r
float a = clamp(d * 0.55, 0.0, 0.6);\r
return vec4(c * a, 1.0 - a);\r
}\r
// Procedural distant skyline (infinitely far city silhouettes), returns elevation of skyline top (radians).\r
float skylineTop(vec3 dir) {\r
float az = atan(dir.z, dir.x) + PI_;\r
float h = 0.0;\r
for(int o = 0;\r
o < 3;\r
o ++) {\r
float f = 45.0 * pow(2.3, float(o));\r
float c = floor(az * f);\r
float r = hash11(c + float(o) * 91.7);\r
float amp = 0.030 / (1.0 + float(o) * 0.9);\r
h = max(h, r > 0.25 ? amp * (0.35 + r) : 0.0);\r
}\r
float c = floor(az * 22.0);\r
float r = hash11(c * 3.1 + 7.0);\r
if(r > 0.82) h = max(h, 0.045 + 0.04 * hash11(c + 1.3));\r
return h * uSkyline;\r
}\r
vec3 skylineColor(vec3 dir, float top, float haze, vec3 facade) {\r
vec3 horizon = skyLUT(normalize(vec3(dir.x, 0.02, dir.z)));\r
float el = asin(clamp(dir.y, - 1.0, 1.0));\r
vec2 hd = normalize(dir.xz + 1e-5);\r
vec2 sd = normalize(uSunDir.xz + 1e-5);\r
float lit = clamp(dot(- hd, sd) * 0.8 + 0.3, 0.05, 1.0);\r
vec3 E = uSunColor * lit * sqrt(max(1.0 - uSunDir.y * uSunDir.y, 0.0)) * 0.5 + horizon * PI_ * 0.5;\r
vec3 c = facade * E / PI_;\r
// window rows\r
float row = fract(el * 900.0);\r
c *= 0.6 + 0.4 * step(0.45, row);\r
if(uNight > 0.0) { // lit windows on the distant skyline\r
float az = atan(dir.z, dir.x);\r
vec2 cell = floor(vec2(az * 1400.0, el * 900.0));\r
float r = hash11(cell.x * 1.37 + cell.y * 57.1);\r
c += vec3(1.0, 0.72, 0.42) * step(0.72, r) * step(0.45, row) * uNight * 0.35 * (0.5 + r);\r
}\r
float k = haze * (0.7 + 0.3 * smoothstep(0.0, top + 1e-3, el));\r
return mix(c, horizon, k);\r
}\r
`,Ve=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform float uSunEl;\r
uniform float uMie;\r
uniform float uViewH;\r
uniform float uMS;\r
uniform vec3 uGroundAlbedo;\r
__SHADER_INJECT_0__ vec3 extinctionAt(float h, out vec3 scatR, out float scatM) {\r
float dr = exp(- h / 8.0), dm = exp(- h / 1.2) * uMie, dO = max(0.0, 1.0 - abs(h - 25.0) / 15.0);\r
scatR = BETA_R * dr;\r
scatM = BETA_MS * dm;\r
return BETA_R * dr + BETA_ME * dm + BETA_O * dO;\r
}\r
vec3 sunT(vec3 p, vec3 s) {\r
if(raySphere(p, s, RG).x > 0.0) return vec3(0.0);\r
float t = raySphere(p, s, RT).y;\r
float dt = t / 12.0;\r
vec3 od = vec3(0.0);\r
vec3 a;\r
float b;\r
for(int i = 0;\r
i < 12;\r
i ++) {\r
vec3 q = p + s * (float(i) + 0.5) * dt;\r
od += extinctionAt(length(q) - RG, a, b) * dt;\r
}\r
return exp(- od);\r
}\r
void main() {\r
float az = vUv.x * PI_;\r
float v = vUv.y * 2.0 - 1.0;\r
float el = sign(v) * v * v * PI_ * 0.5;\r
vec3 rd = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));\r
vec3 sd = vec3(cos(uSunEl), sin(uSunEl), 0.0);\r
vec3 ro = vec3(0.0, RG + uViewH, 0.0);\r
float tTop = raySphere(ro, rd, RT).y;\r
vec2 tg = raySphere(ro, rd, RG);\r
bool ground = tg.x > 0.0;\r
float tMax = ground ? tg.x : tTop;\r
float mu = dot(rd, sd);\r
float pR = phaseR(mu), pM = phaseCS(mu, 0.8);\r
const int N = 40;\r
vec3 L = vec3(0.0), T = vec3(1.0);\r
float tPrev = 0.0;\r
for(int i = 0;\r
i < N;\r
i ++) {\r
float f = (float(i) + 1.0) / float(N);\r
float t = tMax * f * f;\r
float dt = t - tPrev;\r
float tm = (t + tPrev) * 0.5;\r
tPrev = t;\r
vec3 p = ro + rd * tm;\r
float h = length(p) - RG;\r
vec3 sR;\r
float sM;\r
vec3 ext = extinctionAt(h, sR, sM);\r
vec3 st = sunT(p, sd);\r
vec3 S = st * (sR * pR + sM * pM) + (sR + vec3(sM)) * uMS * (0.25 / PI_) * (0.2 + 0.8 * st);\r
vec3 Te = exp(- ext * dt);\r
L += T * S * (1.0 - Te) / max(ext, 1e-7);\r
T *= Te;\r
}\r
if(ground) {\r
vec3 p = ro + rd * tMax;\r
vec3 n = normalize(p);\r
vec3 st = sunT(p, sd);\r
L += T * uGroundAlbedo / PI_ * (st * max(dot(n, sd), 0.0) + 0.25);\r
}\r
fragColor = vec4(L, 1.0);\r
}`,He=`precision highp float;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform float uZ;\r
uniform vec2 uPW;\r
vec3 hash33(vec3 p) {\r
  p = fract(p * vec3(.1031, .1030, .0973));\r
  p += dot(p, p.yxz + 33.33);\r
  return fract((p.xxy + p.yxx) * p.zyx);\r
}\r
float worley(vec3 p, float per) {\r
  vec3 id = floor(p), f = fract(p);\r
  float md = 1.0;\r
  for(int x = -1; x <= 1; x++) for(int y = -1; y <= 1; y++) for(int z = -1; z <= 1; z++) {\r
        vec3 o = vec3(x, y, z);\r
        vec3 h = hash33(mod(id + o, per) + 0.5);\r
        vec3 r = o + h - f;\r
        md = min(md, dot(r, r));\r
      }\r
  return 1.0 - sqrt(md);\r
}\r
float gnoise(vec3 p, float per) {\r
  vec3 i = floor(p), f = fract(p);\r
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);\r
  float n[8];\r
  for(int k = 0; k < 8; k++) {\r
    vec3 o = vec3(k & 1, (k >> 1) & 1, (k >> 2) & 1);\r
    vec3 g = normalize(hash33(mod(i + o, per) + 0.5) * 2.0 - 1.0);\r
    n[k] = dot(g, f - o);\r
  }\r
  return mix(mix(mix(n[0], n[1], u.x), mix(n[2], n[3], u.x), u.y), mix(mix(n[4], n[5], u.x), mix(n[6], n[7], u.x), u.y), u.z);\r
}\r
float perlinFbm(vec3 p, float per) {\r
  float s = 0.0, a = 1.0, w = 0.0;\r
  for(int i = 0; i < 6; i++) {\r
    s += gnoise(p, per) * a;\r
    w += a;\r
    a *= 0.5;\r
    p *= 2.0;\r
    per *= 2.0;\r
  }\r
  return s / w * 0.5 + 0.5;\r
}\r
float worleyFbm(vec3 p, float per) {\r
  return worley(p, per) * 0.625 + worley(p * 2.0, per * 2.0) * 0.25 + worley(p * 4.0, per * 4.0) * 0.125;\r
}\r
float remap(float v, float a, float b, float c, float d) {\r
  return c + (v - a) / (b - a) * (d - c);\r
}\r
void main() {\r
  vec3 p = vec3(vUv, uZ);\r
  float pf = perlinFbm(p * 4.0, 4.0);\r
  float wf = worleyFbm(p * 4.0, 4.0);\r
  float pw = (0.6 * pf + 0.4 * wf - uPW.x) / uPW.y;\r
  fragColor = vec4(clamp(pw, 0.0, 1.0), wf, worleyFbm(p * 8.0, 8.0), worleyFbm(p * 16.0, 16.0));\r
}`,Ue=`precision highp float;\r
precision highp sampler3D;\r
in vec2 vUv;\r
out vec4 fragColor;\r
uniform sampler2D uDepth;\r
uniform mat4 uCamWorld;\r
uniform vec3 uCamPos;\r
uniform vec2 uFullRes;\r
uniform float uFrame;\r
uniform float uStars;\r
__SHADER_INJECT_0__ __SHADER_INJECT_1__ __SHADER_INJECT_2__ vec3 starField(vec3 d) {\r
  // cube-ish cell hashing on the direction; each cell holds at most one star (smooth gaussian so TAA is stable)\r
vec3 p = d * 260.0;\r
vec3 id = floor(p);\r
vec3 f = fract(p) - 0.5;\r
float h = hash11(dot(id, vec3(1.0, 57.0, 113.0)));\r
if(h < 0.93) return vec3(0.0);\r
vec3 o = vec3(hash11(h * 91.3), hash11(h * 17.9), hash11(h * 43.1)) - 0.5;\r
float r = length(f - o * 0.6);\r
float b = exp(- r * r * 90.0) * pow((h - 0.93) / 0.07, 3.0);\r
return mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash11(h * 7.7)) * b * 0.9;\r
}\r
void main() {\r
  // skip texels whose 2x2 (+1 ring) full-res footprint contains no sky\r
vec2 px = 1.0 / uFullRes;\r
bool any = false;\r
for(int y = 0;\r
y < 4;\r
y ++) for(int x = 0;\r
x < 4;\r
x ++) {\r
float d = texture(uDepth, vUv + (vec2(x, y) - 1.5) * px).r;\r
any = any || isSky(d);\r
}\r
if(! any) {\r
fragColor = vec4(0.0, 0.0, 0.0, 1.0);\r
return;\r
}\r
vec3 vd = viewDirFromUv(vUv);\r
vec3 dir = normalize((uCamWorld * vec4(vd, 0.0)).xyz);\r
vec3 sky = skyLUT(dir);\r
float top = skylineTop(dir);\r
float el = asin(clamp(dir.y, - 1.0, 1.0));\r
if(top > 0.0 && el < top) {\r
fragColor = vec4(skylineColor(dir, top, 0.75, uFacadeAlb), 0.0);\r
return;\r
}\r
  // (foundation agent) skyline off (city world has real geometry to the horizon): the thin sliver between the\r
  // geometric horizon and the far edge of the world takes the same horizon radiance the fog converges to\r
if(el < 0.0) {\r
fragColor = vec4(skyLUT(normalize(vec3(dir.x, 0.012, dir.z))), 1.0);\r
return;\r
}\r
float j = ign(gl_FragCoord.xy + mod(uFrame, 64.0) * 5.588238); // IGN temporal offsets: TAA resolves the march banding\r
if(uStars > 0.0) sky += starField(dir) * uStars * smoothstep(0.0, 0.15, dir.y);\r
vec4 ci = cirrusLayer(uCamPos, dir);\r
sky = sky * ci.a + ci.rgb;\r
vec4 cl = marchClouds(uCamPos, dir, j);\r
  // (foundation agent) clouds dissolve into the horizon haze: at grazing angles they are tens of km away, so their\r
  // aerial perspective converges on the clear-sky horizon radiance the fogged far land also converges to -> no seam\r
  // (atmosphere r1: marchClouds now does the aerial perspective itself; only the last half degree fades)\r
float hz = smoothstep(0.0, 0.012, dir.y);\r
fragColor = vec4(mix(sky, sky * cl.a + cl.rgb, hz), mix(1.0, cl.a * ci.a, hz));\r
}`,We=`out vec3 vDir;\r
void main() {\r
    vDir = position;\r
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\r
}`,Ge=`precision highp float;\r
precision highp sampler3D;\r
in vec3 vDir;\r
out vec4 fragColor;\r
uniform vec3 uCamPos;\r
uniform vec3 uGround;\r
uniform float uEnvSat;\r
uniform vec3 uEnvFacade;\r
__SHADER_INJECT_0__ __SHADER_INJECT_1__ void main() {\r
vec3 dir = normalize(vDir);\r
vec3 horizon = skyLUT(normalize(vec3(dir.x, 0.02, dir.z)));\r
float el = asin(clamp(dir.y, - 1.0, 1.0));\r
vec3 c;\r
float top = skylineTop(dir) * 1.8 + 0.02;\r
if(el < top) {\r
    // city: facades near horizon, ground below\r
vec3 fac = skylineColor(dir, top, 0.35, uEnvFacade);\r
float gl = 1.0 - smoothstep(- 0.5, - 0.05, el);\r
vec3 zen = skyLUT(vec3(0.0, 1.0, 0.0));\r
vec3 E = uSunColor * max(uSunDir.y, 0.0) * 0.55 + zen * PI_ * 0.5;\r
vec3 ground = uGround * E / PI_;\r
c = mix(fac, ground, gl) * 0.68; // (lighting2 r4, vehicles agent) darker city / ground under a bright sky: glossy paint, glass and wet streets show a readable reflected horizon line\r
} else {\r
vec3 sky = skyLUT(dir);\r
vec4 ci = cirrusLayer(uCamPos, dir);\r
vec4 cl = marchClouds(uCamPos, dir, 0.5);\r
c = (sky * ci.a + ci.rgb) * cl.a + cl.rgb;\r
}\r
float l = dot(c, vec3(0.2126, 0.7152, 0.0722));\r
fragColor = vec4(mix(vec3(l), c, uEnvSat), 1.0);\r
}`,Ke=`\r
#define RG 6360.0\r
#define RT 6460.0\r
const vec3 BETA_R = vec3(5.802e-3, 13.558e-3, 33.1e-3);\r
const float BETA_MS = 3.996e-3;\r
const float BETA_ME = 4.40e-3;\r
const vec3 BETA_O = vec3(0.650e-3, 1.881e-3, 0.085e-3);\r
const float PI_ = 3.14159265359;\r
\r
vec2 raySphere(vec3 ro, vec3 rd, float r) {\r
  float b = dot(ro, rd);\r
  float c = dot(ro, ro) - r * r;\r
  float d = b * b - c;\r
  if(d < 0.0)\r
    return vec2(-1.0);\r
  d = sqrt(d);\r
  return vec2(-b - d, -b + d);\r
}\r
float phaseR(float mu) {\r
  return 3.0 / (16.0 * PI_) * (1.0 + mu * mu);\r
}\r
float phaseHG(float mu, float g) {\r
  float g2 = g * g;\r
  return (1.0 - g2) / (4.0 * PI_ * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));\r
}\r
// Cornette-Shanks (better Mie shape)\r
float phaseCS(float mu, float g) {\r
  float g2 = g * g;\r
  return 3.0 / (8.0 * PI_) * (1.0 - g2) * (1.0 + mu * mu) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));\r
}\r
`,qe={RG:6360,RT:6460,betaR:[.005802,.013558,.0331],betaMs:.003996,betaMe:.0044,betaO:[65e-5,.001881,85e-6],HR:8,HM:1.2},Je=Ke;function Ye(e,t=1,n=.05){let{RG:r,RT:i,betaR:a,betaMe:o,betaO:s,HR:c,HM:l}=qe,u=new O(0,r+n,0),d=new O(Math.cos(e),Math.sin(e),0),f=u.dot(d),p=u.dot(u)-i*i,m=(-f+Math.sqrt(f*f-p))/64,h=[0,0,0],g=new O;for(let e=0;e<64;e++){g.copy(d).multiplyScalar((e+.5)*m).add(u);let n=g.length()-r;if(n<0)return[0,0,0];let i=Math.exp(-n/c),f=Math.exp(-n/l),p=Math.max(0,1-Math.abs(n-25)/15);for(let e=0;e<3;e++)h[e]+=(a[e]*i+o*t*f+s[e]*p)*m}return h.map(e=>Math.exp(-e))}var Xe=L(()=>Be),Ze=256,q=128,Qe=R(Ve,Je),$e=He,et=R(Xe.commonAtmosphere,Je,Ze,Ze),tt=Xe.clouds;function nt(t,o){let c=G(Ze,q,{type:g}),l=new W({name:`skyLUT`,fragmentShader:Qe,uniforms:{uSunEl:{value:.6},uMie:{value:2.2},uViewH:{value:.05},uMS:{value:2.2},uGroundAlbedo:{value:new O(.12,.12,.11)}}}),d=new b(128,128,128,{type:a,format:n,depthBuffer:!1}),p=d.texture;p.wrapS=p.wrapT=p.wrapR=m,p.minFilter=u,p.magFilter=u,p.generateMipmaps=!1;let h=new W({name:`cloudNoise`,fragmentShader:$e,uniforms:{uZ:{value:0},uPW:{value:new E(.4,.22)}}}),_=new r(-1,1,1,-1,0,1);function y(e,n){h.uniforms.uPW.value.set(e,n);for(let e=0;e<128;e++)h.uniforms.uZ.value=(e+.5)/128,t.setRenderTarget(d,e),t.render(h.mesh,_);t.setRenderTarget(null)}y(.4,.22);let x={elevation:44,azimuth:70,mie:1.4,ms:2.2,skyScale:16,envSaturation:.62,cloudCoverage:.52,cloudDensity:.7,cloudBottom:1.25,cloudTop:2.8,cloudFade:28,cloudSun:4.3,cloudAmb:.8,cloudScale:.13,cirrus:.6,cloudErode:.88,cloudDetailScale:2.4,cloudBaseDark:.9,skylineVisible:1,lightScale:1,lightTint:[1,1,1],skyTint:[1,1,1],skyGlow:[0,0,0],night:0,stars:0,groundAlbedo:[.2,.18,.155],envFacadeAlbedo:[.34,.29,.23]},T=new O,D=new f,A={uSkyLUT:{value:c.texture},uSunDir:{value:T},uSunColor:{value:new O},uSkyScale:{value:x.skyScale},uNoise:{value:p},uCloudCoverage:{value:x.cloudCoverage},uCloudDensity:{value:x.cloudDensity},uCloudBottom:{value:x.cloudBottom},uCloudTop:{value:x.cloudTop},uCloudFade:{value:x.cloudFade},uCloudOffset:{value:new O(3.1,0,7.7)},uSkyline:{value:1},uSkyTint:{value:new O(1,1,1)},uSkyGlow:{value:new O(0,0,0)},uFacadeAlb:{value:new O(.2,.185,.165)},uNight:{value:0},uCloudSun:{value:x.cloudSun},uCloudAmb:{value:x.cloudAmb},uCloudScale:{value:x.cloudScale},uHzK:{value:new O(.56,.63,.78)},uCirrus:{value:x.cirrus},uCloudErode:{value:x.cloudErode},uCloudDetailScale:{value:x.cloudDetailScale},uCloudBaseDark:{value:x.cloudBaseDark},uSunGlow:{value:new C(0,0,0,0)},uOvercast:{value:0}};function M(){let e=k.degToRad(x.elevation),n=k.degToRad(x.azimuth);T.set(Math.cos(e)*Math.cos(n),Math.sin(e),Math.cos(e)*Math.sin(n)).normalize();let r=Ye(Math.max(e,.009),x.mie),i=x.skyScale*.62*x.lightScale,a=x.lightTint;D.setRGB(r[0]*i*a[0],r[1]*i*a[1],r[2]*i*a[2]),A.uSkyTint.value.fromArray(x.skyTint),A.uSkyGlow.value.fromArray(x.skyGlow),A.uSunGlow.value.fromArray(x.sunGlow??[0,0,0,0]),A.uOvercast.value=x.overcast??0,A.uNight.value=x.night,A.uSunColor.value.set(D.r,D.g,D.b),A.uSkyScale.value=x.skyScale,l.uniforms.uSunEl.value=e,l.uniforms.uMie.value=x.mie,l.uniforms.uMS.value=x.ms,l.render(t,c),t.setRenderTarget(null)}function N(){A.uCloudCoverage.value=x.cloudCoverage,A.uCloudDensity.value=x.cloudDensity,A.uCloudBottom.value=x.cloudBottom,A.uCloudTop.value=x.cloudTop,A.uCloudFade.value=x.cloudFade,A.uCloudSun.value=x.cloudSun,A.uCloudAmb.value=x.cloudAmb,A.uCloudScale.value=x.cloudScale,A.uCirrus.value=x.cirrus,A.uCloudErode.value=x.cloudErode,A.uCloudDetailScale.value=x.cloudDetailScale,A.uCloudBaseDark.value=x.cloudBaseDark}let P=new W({name:`skyPass`,defines:{CLOUD_STEPS:o.cloudSteps,CLOUD_LIGHT_STEPS:o.cloudLightSteps},uniforms:{...A,uDepth:{value:null},uProjInv:{value:new w},uReversed:{value:0},uCamWorld:{value:new w},uCamPos:{value:new O},uFullRes:{value:new E(1,1)},uFrame:{value:0},uStars:{value:0}},fragmentShader:R(Ue,K,et,tt)}),F=new S,I=new ee({name:`envSky`,glslVersion:i,side:1,depthWrite:!1,depthTest:!1,defines:{CLOUD_STEPS:48,CLOUD_LIGHT_STEPS:4},uniforms:{...A,uCamPos:{value:new O(0,60,0)},uGround:{value:new O(.2,.18,.155)},uEnvSat:{value:.62},uEnvFacade:{value:new O(.34,.29,.23)}},vertexShader:We,fragmentShader:R(Ge,et,tt)}),L=new v(new s(10,10,10),I);L.frustumCulled=!1,F.add(L);let ne=new j(256,{type:g,generateMipmaps:!1}),z=new e(.1,100,ne);F.add(z);let re=new te(t),B=null;function ie(){let e=t.getRenderTarget(),n=t.toneMapping;return t.toneMapping=0,z.update(t,F),B=re.fromCubemap(ne.texture,B??void 0),t.toneMapping=n,t.setRenderTarget(e),B.texture}function ae(e){let n=t.getRenderTarget(),r=t.getActiveCubeFace(),i=t.getActiveMipmapLevel(),a=t.toneMapping;t.toneMapping=0,z.coordinateSystem!==t.coordinateSystem&&(z.coordinateSystem=t.coordinateSystem,z.updateCoordinateSystem()),t.setRenderTarget(ne,e),t.render(F,z.children[e]),t.toneMapping=a,t.setRenderTarget(n,r,i)}function oe(){let e=t.getRenderTarget();return B=re.fromCubemap(ne.texture,B??void 0),t.setRenderTarget(e),B.texture}return M(),N(),{params:x,sunDir:T,sunColor:D,lut:c,noise:p,noiseRT:d,skyUniforms:A,skyPass:P,genNoise:y,update(){N(),M(),A.uSkyline.value=x.skylineVisible,I.uniforms.uEnvSat.value=x.envSaturation,I.uniforms.uGround.value.fromArray(x.groundAlbedo),I.uniforms.uEnvFacade.value.fromArray(x.envFacadeAlbedo),P.uniforms.uStars.value=x.stars},renderEnv:ie,renderEnvFace:ae,finishEnv:oe,renderSkyPass(e,n,r,i,a,o,s){let c=P.uniforms;c.uDepth.value=r,c.uProjInv.value.copy(n.projectionMatrixInverse),c.uCamWorld.value.copy(n.matrixWorld),c.uCamPos.value.setFromMatrixPosition(n.matrixWorld),c.uFullRes.value.set(i,a),c.uFrame.value=o%64,c.uReversed.value=+!!s,c.uSkyline.value=x.skylineVisible,P.render(t,e)}}}var rt=class{gl;ext;enabled;pending=[];free=[];current=null;acc={};constructor(e,t){this.gl=e.getContext(),this.ext=t?this.gl.getExtension(`EXT_disjoint_timer_query_webgl2`):null,this.enabled=this.ext!==null}begin(e){if(!this.ext)return;this.end();let t=this.gl,n=this.free.pop()??t.createQuery();n&&(t.beginQuery(this.ext.TIME_ELAPSED_EXT,n),this.current={name:e,query:n})}end(){this.ext&&this.current&&(this.gl.endQuery(this.ext.TIME_ELAPSED_EXT),this.pending.push(this.current),this.current=null)}poll(){if(!this.ext)return;let e=this.gl,t=e.getParameter(this.ext.GPU_DISJOINT_EXT);for(;this.pending.length;){let n=this.pending[0];if(!n||!e.getQueryParameter(n.query,e.QUERY_RESULT_AVAILABLE))break;this.pending.shift();let r=e.getQueryParameter(n.query,e.QUERY_RESULT);if(this.free.push(n.query),t)continue;let i=this.acc[n.name]||(this.acc[n.name]={sum:0,n:0});i.sum+=r/1e6,i.n++}}report(e=!1){let t={},n=0;for(let e in this.acc){let r=this.acc[e];r&&(t[e]=+(r.sum/Math.max(1,r.n)).toFixed(3),n+=r.sum/Math.max(1,r.n))}return t.total=+n.toFixed(3),e&&(this.acc={}),t}};function it({renderer:e,scene:t,camera:n,lighting:r}){let i=r.quality,o=!!e.capabilities.reversedDepthBuffer,s=new URLSearchParams(location.search),p=new rt(e,s.has(`prof`)),m={calls:0,triangles:0,cCalls:0,cTris:0};if(p.enabled){let t=e.shadowMap,n=t.render;t.render=function(...t){let r=e.info.render.calls,i=e.info.render.triangles,a=performance.now();p.begin(`shadows`),n.apply(this,t),p.begin(`scene`),m.cCalls+=e.info.render.calls-r,m.cTris+=e.info.render.triangles-i,m.cCpu=(m.cCpu||0)+performance.now()-a}}e.toneMapping=0,e.outputColorSpace=l,e.autoClear=!0;let g=new E;e.getDrawingBufferSize(g);let v=g.x,b=g.y,x=new y(v,b,o?d:c);x.format=A,x.minFilter=x.magFilter=_;let S=G(v,b,{depthBuffer:!0,depthTexture:x});S.texture.minFilter=S.texture.magFilter=u;let T=G(v,b),ee=G(v/2,b/2),j=G(v,b),N=[G(v,b),G(v,b)],te=G(v,b),P=G(v,b),L=G(v/2,b/2),re=G(v/2,b/2),B=G(v/2,b/2),ie=G(v/2,b/2),ae=G(v/4,b/4),oe=G(1,1,{filter:_}),ce=[G(1,1,{filter:_,type:d}),G(1,1,{filter:_,type:d})],le=0,ue=new y(v,b,o?d:c);ue.format=A,ue.minFilter=ue.magFilter=_;let de=G(v,b,{depthBuffer:!0,depthTexture:ue,type:a,filter:_}),fe=new D({colorWrite:!1}),pe=new w,me=new w,he=new w,ge=!1,V=[],Fe=[];function Ie(){let e=v,t=b;for(let n=0;n<i.bloomLevels;n++)e=Math.max(1,e>>1),t=Math.max(1,t>>1),V[n]?V[n].setSize(e,t):V.push(G(e,t)),Fe[n]?Fe[n].setSize(e,t):Fe.push(G(e,t));for(;V.length>i.bloomLevels;)V.pop().dispose(),Fe.pop().dispose()}Ie();let H=null;if(i.ao){H=new z(t,n,v,b),H.autoDetectTransparency=!1,H.configuration.transparencyAware=!1,H.configuration.gammaCorrection=!1,H.configuration.halfRes=i.aoHalfRes;let e=H.depthDownsampleTarget;e&&Array.isArray(e.texture)&&Object.defineProperty(e,"texture",{configurable:!0,get(){return this.textures[0]},set(e){this.textures[0]=e}}),H.setQualityMode(i.aoQuality),i.aoHalfRes||(H.configuration.aoSamples=4,H.configuration.denoiseSamples=4,H.configuration.denoiseRadius=5),H.configuration.aoRadius=3,H.configuration.distanceFalloff=.9,H.configuration.intensity=3.4,H.configuration.color=new f(920329),H.setDepthTexture(x),H.renderToScreen=!1}let U=r.sky,Le=r.cascadedShadows,Be=!!i.ssr&&!s.has(`nossr`),Ve=i.ssr?se(e,t):null,He=new W({name:`ssr`,defines:{STEPS:i.ssrSteps||24,ENVMAP_TYPE_CUBE_UV:``,CUBEUV_TEXEL_WIDTH:.0013,CUBEUV_TEXEL_HEIGHT:.001953125,CUBEUV_MAX_MIP:`7.0`},uniforms:{uDepth:{value:x},uScene:{value:S.texture},uPrev:{value:null},envMap:{value:null},uProj:{value:new w},uProjInv:{value:new w},uReversed:{value:+!!o},uCamWorld:{value:new w},uPrevViewProj:{value:new w},uRes:{value:new E(v,b)},uFrame:{value:0},uEnvI:{value:1},uHavePrev:{value:0},uMaxDist:{value:220},uFloor:{value:.5}},fragmentShader:R(_e,K,M.cube_uv_reflection_fragment)}),Ue=Le.N,We=!!i.shafts&&!s.has(`noshafts`),Ge=new W({name:`shafts`,defines:{STEPS:i.shaftSteps||12,NC:Ue},uniforms:{...U.skyUniforms,uDepth:{value:x},uProjInv:{value:new w},uReversed:{value:+!!o},uCamWorld:{value:new w},uCamPos:{value:new O},uCamFwd:{value:new O},uSM0:{value:null},uSM1:{value:null},uSM2:{value:null},uSM3:{value:null},uSMat:{value:[new w,new w,new w,new w]},uSplits:{value:new C(1e9,1e9,1e9,1e9)},uRes:{value:new E(v,b)},uFrame:{value:0},uDensity:{value:8e-4},uHeightFall:{value:1/70},uMaxT:{value:180},uStrength:{value:1}},fragmentShader:R(ve,K,et)}),Ke=new W({name:`cityVolume`,defines:{NSEG:i.cityVolSteps||16,VSLOTS:10,USE_CITYL:``,CITYL_NODITHER:``},uniforms:{cityL:{value:F},uDepth:{value:x},uProjInv:{value:new w},uReversed:{value:+!!o},uCamWorld:{value:new w},uCamPos:{value:new O},uFrame:{value:0},uDensity:{value:.012},uHeightFall:{value:1/40},uMaxT:{value:120},uStrength:{value:1},uG:{value:.55}},fragmentShader:R(ye,K,ne)});i.ssgi!==!1&&s.has(`nossgi`);let qe=G(v/2,b/2),Je=new W({name:`ssgi`,defines:{DIRS:i.ssgiDirs||6,STEPS:i.ssgiSteps||4,NC:Ue,ENVMAP_TYPE_CUBE_UV:``,CUBEUV_TEXEL_WIDTH:.0013,CUBEUV_TEXEL_HEIGHT:.001953125,CUBEUV_MAX_MIP:`7.0`},uniforms:{...U.skyUniforms,uDepth:{value:x},uPrevRad:{value:null},envMap:{value:null},uEnvI:{value:1},uAmbBounce:{value:new O},uProj:{value:new w},uProjInv:{value:new w},uReversed:{value:+!!o},uCamWorld:{value:new w},uPrevViewProj:{value:new w},uSM0:{value:null},uSM1:{value:null},uSM2:{value:null},uSM3:{value:null},uSMat:{value:[new w,new w,new w,new w]},uSplits:{value:new C(1e9,1e9,1e9,1e9)},uRes:{value:new E(v,b)},uFrame:{value:0},uHavePrev:{value:0},uStrength:{value:1},uAbs:{value:0},uAbsK:{value:1}},fragmentShader:R(be,K,et,M.cube_uv_reflection_fragment)}),Ye=new W({name:`sunVis`,uniforms:{uDepth:{value:x},uSky:{value:ee.texture},uSunUv:{value:new E},uReversed:{value:+!!o},uProjInv:{value:new w},uAspect:{value:1}},fragmentShader:R(xe,K)}),Xe=new W({name:`composite`,uniforms:{...U.skyUniforms,uColor:{value:null},uDepth:{value:x},uSky:{value:ee.texture},uProjInv:{value:new w},uReversed:{value:+!!o},uCamWorld:{value:new w},uCamPos:{value:new O},uFogDensity:{value:0},uFogFalloff:{value:0},uFogSun:{value:0},uFogTint:{value:new f},uFogStart:{value:0},uPx:{value:new E},uSceneA:{value:S.texture},uSSR:{value:B.texture},uSSROn:{value:0},uShafts:{value:ie.texture},uShaftOn:{value:0},uHalfPx:{value:new E},uCVol:{value:ae.texture},uCVolOn:{value:0},uQuarterPx:{value:new E},uCloudShadow:{value:.4},uGI:{value:qe.texture},uGIOn:{value:0},uGIAbs:{value:0},uGIAlb:{value:.09},uMoonDir:{value:new O(0,1,0)},uMoonK:{value:0},uNightHaze:{value:new O},uNightHazeHi:{value:new O},uNightFog:{value:0},uGlowCol:{value:new O},uGlowH:{value:22},uGlowK:{value:.004},uNightMid:{value:new O(.0035,.0088,.0215)},uTsGlow:{value:new O(.0056,.0045,.004)},uNightMidLevel:{value:new O(.0062,.0068,.0105)}},fragmentShader:R(Se,K,et)}),Ze=new W({name:`taa`,uniforms:{uCurrent:{value:j.texture},uHistory:{value:null},uDepth:{value:x},uProjInv:{value:new w},uReversed:{value:+!!o},uCamWorld:{value:new w},uPrevViewProj:{value:new w},uRes:{value:new E(v,b)},uBlend:{value:.1},uReset:{value:1},uJitter:{value:new E},uProjInvU:{value:new w},uMask:{value:ue},uMaskOn:{value:0},uObjDelta:{value:new w}},fragmentShader:R(Ce,K,Re)}),q={focus:10,aperture:0,maxBlur:14,auto:null,far:1},Qe=()=>({uFocus:{value:10},uBokeh:{value:0},uMaxCoc:{value:12},uFar:{value:1}}),$e=we,tt=new W({name:`dofPrefilter`,uniforms:{...Qe(),uColor:{value:null},uDepth:{value:x},uProjInv:{value:new w},uReversed:{value:+!!o},uPx:{value:new E}},fragmentShader:R(Te,K,Re,$e)});function nt(e){let t=[];for(let n=0;n<e;n++){let r=Math.sqrt((n+.5)/e),i=n*2.39996323;t.push(new E(Math.cos(i)*r,Math.sin(i)*r))}return t}let it=new W({name:`dofBokeh`,defines:{TAPS:i.dofTaps},uniforms:{uSrc:{value:L.texture},uKernel:{value:nt(i.dofTaps)},uMaxCoc:{value:12},uPx:{value:new E}},fragmentShader:Ee}),at=new W({name:`dofTent`,uniforms:{uSrc:{value:re.texture},uPx:{value:new E}},fragmentShader:De}),ot=new W({name:`dofCombine`,uniforms:{...Qe(),uColor:{value:null},uDof:{value:L.texture},uDepth:{value:x},uProjInv:{value:new w},uReversed:{value:+!!o}},fragmentShader:R(Oe,K,$e)}),J={strength:0,velocity:null,angular:null,maskDistance:null,prevViewProj:new w,have:!1},Y=new W({name:`motionBlur`,defines:{SAMPLES:i.motionBlurSamples},uniforms:{uColor:{value:null},uDepth:{value:x},uProjInv:{value:new w},uReversed:{value:+!!o},uCamWorld:{value:new w},uPrevViewProj:{value:new w},uScale:{value:.5},uMask:{value:3},uRes:{value:new E(v,b)},uFrame:{value:0}},fragmentShader:R(ke,K)}),st=new W({name:`bloomDown`,uniforms:{uSrc:{value:null},uPx:{value:new E},uFirst:{value:0}},fragmentShader:R(Ae,Re)}),ct=new W({name:`bloomUp`,uniforms:{uSrc:{value:null},uCur:{value:null},uPx:{value:new E},uRadius:{value:1},uT:{value:1.2},uK:{value:.8},uThrSrc:{value:0}},fragmentShader:je}),lt=new W({name:`autoExposure`,uniforms:{uSrc:{value:null},uPrev:{value:null},uRate:{value:.1},uReset:{value:1}},fragmentShader:Me}),X={autoExposure:!0,aeKey:-2.05,aeStrength:.42,aeRange:1.25,aeSpeedUp:2.5,aeSpeedDown:1.4,exposure:.8,bloom:.11,bloomThreshold:.9,bloomKnee:.7,saturation:1.14,contrast:1.18,pivot:.18,satKnee:.72,lift:new O(-.004,-.004,-.003),gamma:new O(1,1,1),gain:new O(1.015,1,.975),whiteBalance:new O(1,1,1),splitShadow:new O(.95,1,1.07),splitHigh:new O(1.035,1,.95),splitBalance:.3,vignette:.28,ca:9e-4,sharpen:i.sharpen,grain:.012,shafts:1,nightSplitShadow:new O(.93,1,1.1),nightSplitStreet:new O(.8,.96,1.3),nightLift:new O(.0074,.0068,.0078),cityVol:1,giNight:.35,giNightAlbedo:.3,streak:.012,flare:1,gi:.5,toe:.34},ut=new W({name:`final`,uniforms:{uColor:{value:null},uBloom:{value:null},uPx:{value:new E},uStreakSrc:{value:null},uStreakLo:{value:null},uStreak:{value:0},uStreakT:{value:2.5},uExposure:{value:1},uBloomStr:{value:.04},uSat:{value:1},uContrast:{value:1},uLift:{value:X.lift},uGamma:{value:X.gamma},uGain:{value:X.gain},uWB:{value:X.whiteBalance},uVignette:{value:.3},uCA:{value:.001},uSharpen:{value:.3},uGrain:{value:0},uFrame:{value:0},uAspect:{value:1},uSunVis:{value:oe.texture},uSunUv:{value:new E},uFlare:{value:0},uSunCol:{value:new O},uPivot:{value:.18},uSatKnee:{value:.72},uDepthS:{value:x},uProjInvS:{value:new w},uRevS:{value:+!!o},uAE:{value:null},uAEOn:{value:0},uAEKey:{value:0},uAEStr:{value:.6},uAERange:{value:1.25},uSplitSh:{value:X.splitShadow},uSplitHi:{value:X.splitHigh},uSplitBal:{value:.3},uWarmGuard:{value:0},uToe:{value:.45},uRain:{value:0}},fragmentShader:R(Ne,Re)}),dt=new W({name:`debugBlit`,uniforms:{uSrc:{value:null},uScale:{value:1},uMode:{value:0}},fragmentShader:Pe}),ft=0,pt=0,mt=!0,ht=!0,Z=new w,gt=new w,Q=new w,$=new O,_t=new O,vt=new O,yt=new O,bt=new h,xt=new h,St=new w,Ct=new O,wt=new O,Tt={sunUv:new E,onScreen:!1},Et=new w;function Dt(t,n){let r=e.getPixelRatio(),i=Math.max(1,Math.floor(t*r)),a=Math.max(1,Math.floor(n*r));i===v&&a===b||(v=i,b=a,S.setSize(v,b),x.image.width=v,x.image.height=b,T.setSize(v,b),j.setSize(v,b),N[0].setSize(v,b),N[1].setSize(v,b),te.setSize(v,b),P.setSize(v,b),ee.setSize(v>>1,b>>1),L.setSize(v>>1,b>>1),re.setSize(v>>1,b>>1),B.setSize(v>>1,b>>1),ie.setSize(v>>1,b>>1),ae.setSize(v>>2,b>>2),qe.setSize(v>>1,b>>1),Ve?.setSize(v,b),de.setSize(v,b),ue.image.width=v,ue.image.height=b,Ie(),H&&H.setSize(v,b)),mt=!0}function Ot(e,t){e.uFocus.value=q.focus,e.uBokeh.value=q.aperture,e.uMaxCoc.value=q.maxBlur,e.uFar.value=q.far,e.uProjInv&&e.uProjInv.value.copy(t.projectionMatrixInverse)}let kt=new WeakSet;function At(){t.traverse(e=>{let t=e.material;if(!t||Array.isArray(t)||kt.has(t))return;kt.add(t);let n=``;try{n=t.customProgramCacheKey?.()??``}catch{}(t.userData?.noSSR||n.includes(`hero-glass`))&&(t.defines={...t.defines||{},NO_SSR:``},t.needsUpdate=!0)})}e.info.autoReset=!1;let jt={calls:0,triangles:0};function Mt(a=1/60){ft++,jt.calls=e.info.render.calls,jt.triangles=e.info.render.triangles,jt.shadowCalls=m.cCalls,jt.shadowTris=m.cTris,jt.shadowCpu=m.cCpu||0,m.cCalls=m.cTris=m.cCpu=0,e.info.reset(),Be&&ft%120==1&&At(),p.poll();let s=n;s.updateMatrixWorld(),q.auto&&(q.auto.getWorldPosition(Ct),q.focus=Ct.distanceTo(Ct.clone().setFromMatrixPosition(s.matrixWorld))),yt.setFromMatrixPosition(s.matrixWorld),xt.setFromRotationMatrix(s.matrixWorld),(yt.distanceTo($)>60||xt.angleTo(bt)>.6)&&(mt=!0),J.fade=mt?0:Math.min(1,(J.fade??1)+a/.3),o&&s.reversedDepth!==!0&&(s._reversedDepth=!0,s.updateProjectionMatrix()),Z.copy(s.projectionMatrix),gt.multiplyMatrices(Z,s.matrixWorldInverse);let c=ft%16+1,l=i.taa?ze(c,2)-.5:0,u=i.taa?ze(c,3)-.5:0;i.taa&&(s.projectionMatrix.elements[8]+=2*l/v,s.projectionMatrix.elements[9]+=2*u/b,s.projectionMatrixInverse.copy(s.projectionMatrix).invert()),Ve&&(p.begin(`glassMirror`),Ve.render(s)),F.origin.w>0&&(p.begin(`cityShadows`),I.renderShadows(e,t)),p.begin(`scene+shadows`),e.setRenderTarget(S),e.setClearColor(0,1),e.clear(!0,!0,!1),e.render(t,s);let d=window.__ctx?.player?.object,f=!1;if(i.taa&&d&&d.visible){p.begin(`charMask`),d.updateMatrixWorld(),me.copy(d.matrixWorld);let t=[];d.traverse(e=>{e.material&&(e.isMesh||e.isSkinnedMesh)&&e.visible?(t.push([e,e.material]),e.material=fe):e.visible&&(e.isLine||e.isPoints||e.isSprite)&&(t.push([e,null]),e.visible=!1)});let n=e.shadowMap.autoUpdate;e.shadowMap.autoUpdate=!1,e.setRenderTarget(de),e.clear(!1,!0,!1),e.render(d,s),e.shadowMap.autoUpdate=n;for(let[e,n]of t)n?e.material=n:e.visible=!0;he.copy(pe).multiply(St.copy(me).invert()),f=ge,pe.copy(me),ge=!0}p.begin(`sky`),U.renderSkyPass(ee,s,x,v,b,ft,o);let g=Ct.copy(U.sunDir).multiplyScalar(1e4).add(yt).project(s).clone(),_=Math.abs(g.x)<1.3&&Math.abs(g.y)<1.3&&Ct.copy(U.sunDir).dot(wt.set(0,0,-1).applyQuaternion(xt))>0;Tt.sunUv.set(g.x*.5+.5,g.y*.5+.5),Tt.onScreen=_,_&&X.flare>0&&(Ye.uniforms.uSunUv.value.copy(Tt.sunUv),Ye.uniforms.uAspect.value=v/b,Ye.render(e,oe));let y=We&&r.fog.shafts>0&&U.sunDir.y>0;if(y){p.begin(`shafts`);let t=Ge.uniforms;for(let e=0;e<Math.min(Ue,4);e++){let n=Le.lights[e];t[`uSM`+e].value=n.shadow.map?.depthTexture??null,t.uSMat.value[e].copy(n.shadow.matrix)}for(let e=Ue;e<4;e++)t[`uSM`+e].value=t.uSM0.value;let n=Le.splits;t.uSplits.value.set(n[1]??1e9,n[2]??1e9,n[3]??1e9,n[4]??1e9),t.uProjInv.value.copy(s.projectionMatrixInverse),t.uCamWorld.value.copy(s.matrixWorld),t.uCamPos.value.copy(yt),s.getWorldDirection(t.uCamFwd.value),t.uRes.value.set(v,b),t.uFrame.value=ft%64,t.uStrength.value=X.shafts*r.fog.shafts,t.uSM0.value&&Ge.render(e,ie)}let C=F.origin.w>0&&X.cityVol>0&&I.volume>0&&i.shafts!==!1;if(C){p.begin(`cityVolume`);let t=Ke.uniforms;t.uProjInv.value.copy(s.projectionMatrixInverse),t.uCamWorld.value.copy(s.matrixWorld),t.uCamPos.value.copy(yt),t.uFrame.value=ft%64,t.uStrength.value=X.cityVol*(r.cityVol?.strength??1),t.uDensity.value=r.cityVol?.density??.012,t.uHeightFall.value=1/(r.cityVol?.height??40),Ke.render(e,ae)}let w=S.texture;H&&(p.begin(`ao`),H.render(e,S,T),w=T.texture),p.begin(`composite`);{let t=Xe.uniforms;t.uColor.value=w,t.uProjInv.value.copy(s.projectionMatrixInverse),t.uCamWorld.value.copy(s.matrixWorld),t.uCamPos.value.copy(yt);let n=r.fog;t.uMoonDir.value.copy(r.moon?.dir??t.uMoonDir.value),t.uMoonK.value=r.moon?.k??0;{let e=r.nightHaze;t.uNightFog.value=e?e.k:0,e&&(t.uNightHaze.value.fromArray(e.low),t.uNightHazeHi.value.fromArray(e.high),t.uGlowCol.value.fromArray(e.cfg.glowCol),t.uGlowH.value=e.cfg.glowH,t.uGlowK.value=e.cfg.glowK)}t.uFogDensity.value=n.density,t.uFogFalloff.value=n.heightFalloff,t.uFogSun.value=n.sunScatter,t.uFogTint.value.copy(n.tint),t.uFogStart.value=n.startDistance,t.uSSROn.value=0,t.uGIOn.value=0,t.uGIAbs.value=r.nightHaze?.k??0,t.uGIAlb.value=X.giNightAlbedo/Math.PI,t.uShaftOn.value=y&&Ge.uniforms.uSM0.value?1:0,t.uCVolOn.value=+!!C,t.uQuarterPx.value.set(1/ae.width,1/ae.height),t.uHalfPx.value.set(1/ie.width,1/ie.height),Xe.render(e,j)}let E=j;if(i.taa){p.begin(`taa`);let t=Ze.uniforms,n=N[pt],r=N[1-pt];t.uCurrent.value=j.texture,t.uHistory.value=r.texture,t.uProjInv.value.copy(s.projectionMatrixInverse),t.uCamWorld.value.copy(s.matrixWorld),t.uPrevViewProj.value.copy(Q),t.uRes.value.set(v,b),t.uReset.value=+!!mt,t.uBlend.value=.08,t.uJitter.value.set(-l/v,-u/b),t.uProjInvU.value.copy(Z).invert(),t.uMaskOn.value=+!!f,t.uObjDelta.value.copy(he),Ze.render(e,n),pt=1-pt,E=n}mt=!1,s.projectionMatrix.copy(Z),s.projectionMatrixInverse.copy(Z).invert();let D=[te,P],A=0;if(q.aperture>.01&&(p.begin(`dof`),Ot(tt.uniforms,s),tt.uniforms.uColor.value=E.texture,tt.uniforms.uPx.value.set(1/v,1/b),tt.render(e,L),it.uniforms.uSrc.value=L.texture,it.uniforms.uMaxCoc.value=q.maxBlur,it.uniforms.uPx.value.set(2/v,2/b),it.render(e,re),at.uniforms.uSrc.value=re.texture,at.uniforms.uPx.value.set(2/v,2/b),at.render(e,L),Ot(ot.uniforms,s),ot.uniforms.uColor.value=E.texture,ot.uniforms.uDof.value=L.texture,ot.render(e,D[A]),E=D[A],A=1-A),J.strength>.001&&(J.fade>.001||J.velocity||J.angular)){let t=Q;if(J.velocity||J.angular){let e=yt.clone();J.velocity&&e.addScaledVector(J.velocity,-.016666666666666666);let n=xt.clone();if(J.angular){let e=J.angular.length()*.016666666666666666;e>0&&n.premultiply(new h().setFromAxisAngle(J.angular.clone().normalize(),-e))}Et.compose(e,n,new O(1,1,1)).invert(),t=St.multiplyMatrices(Z,Et)}if(J.have||J.velocity||J.angular){p.begin(`motionBlur`);let n=Y.uniforms;n.uColor.value=E.texture,n.uProjInv.value.copy(s.projectionMatrixInverse),n.uCamWorld.value.copy(s.matrixWorld),n.uPrevViewProj.value.copy(t);let r=J.velocity||J.angular?1:Math.min(2,1/60/Math.max(a,.001));n.uScale.value=J.strength*r*(J.velocity||J.angular?1:J.fade??1),n.uMask.value=J.maskDistance??(q.auto||q.focus<30?q.focus+1.5:3),n.uRes.value.set(v,b),n.uFrame.value=ft%64,Y.render(e,D[A]),E=D[A],A=1-A}}p.begin(`bloom`);let M=E.texture,ne=v,R=b;for(let t=0;t<V.length;t++)st.uniforms.uSrc.value=M,st.uniforms.uPx.value.set(1/ne,1/R),st.uniforms.uFirst.value=+(t===0),st.render(e,V[t]),M=V[t].texture,ne=V[t].width,R=V[t].height;let z=V[V.length-1];for(let t=V.length-2;t>=0;t--)ct.uniforms.uSrc.value=z.texture,ct.uniforms.uCur.value=V[t].texture,ct.uniforms.uPx.value.set(1/z.width,1/z.height),ct.uniforms.uThrSrc.value=+(t===V.length-2),ct.uniforms.uT.value=X.bloomThreshold,ct.uniforms.uK.value=X.bloomKnee,ct.render(e,Fe[t]),z=Fe[t];if(X.autoExposure){p.begin(`autoExposure`);let t=lt.uniforms,n=ce[le],r=ce[1-le];t.uSrc.value=V[Math.min(3,V.length-1)].texture,t.uPrev.value=n.texture,t.uReset.value=+!!ht,ht=!1;let i=.5*(X.aeSpeedUp+X.aeSpeedDown);t.uRate.value=1-Math.exp(-Math.max(a,1/240)*i),lt.render(e,r),le=1-le}p.begin(`final`);{let t=ut.uniforms;t.uColor.value=E.texture,t.uBloom.value=z.texture,t.uStreakSrc.value=V[0].texture,t.uStreakLo.value=V[Math.min(3,V.length-1)].texture,t.uStreak.value=X.streak*(r.nightHaze?.k??0),t.uPx.value.set(1/v,1/b);let n=r.tod||{};t.uRain.value=n.rain??0,t.uExposure.value=X.exposure*(n.exposure??1),t.uBloomStr.value=X.bloom*(n.bloom??1),t.uSat.value=X.saturation,t.uFlare.value=Tt.onScreen?X.flare*(r.tod.sunK??1):0,t.uSunCol.value.copy(U.skyUniforms.uSunColor.value),t.uContrast.value=X.contrast,t.uPivot.value=X.pivot,t.uSatKnee.value=X.satKnee,t.uVignette.value=X.vignette,t.uCA.value=X.ca,t.uSharpen.value=X.sharpen,t.uGrain.value=X.grain,t.uFrame.value=ft%36e3,t.uAspect.value=v/b,t.uProjInvS.value.copy(s.projectionMatrixInverse),t.uAE.value=ce[le].texture,t.uAEOn.value=+!!X.autoExposure,t.uAEKey.value=X.aeKey,t.uAEStr.value=X.aeStrength,t.uAERange.value=X.aeRange,t.uLift.value=_t.copy(X.lift).addScaledVector(X.nightLift,r.nightHaze?.k??0),t.uToe.value=X.toe,t.uSplitSh.value=vt.copy(X.nightSplitStreet).lerp(X.nightSplitShadow,k.smoothstep(yt.y,25,120)).lerp(X.splitShadow,1-(r.nightHaze?.k??0)),t.uSplitHi.value=X.splitHigh,t.uWarmGuard.value=r.nightHaze?.k??0,t.uSplitBal.value=k.lerp(X.splitBalance,.14,r.nightHaze?.k??0),ut.render(e,null)}if(Nt.debug){let t=Nt.debug,n={ssr:B,ssgi:qe,shafts:ie,cvol:ae,ao:T,scene:S,lit:j,ssrw:S}[t.tex];n&&(dt.uniforms.uSrc.value=n.texture,dt.uniforms.uScale.value=t.scale??1,dt.uniforms.uMode.value=+(t.tex===`ssrw`),dt.render(e,null))}p.begin(`external`),Q.copy(gt),$.copy(yt),bt.copy(xt),J.have=!0}let Nt={debug:null,render:Mt,setSize:Dt,grade:X,get ao(){return H},passes:{ssr:He,ssgi:Je,shafts:Ge,composite:Xe,taa:Ze,final:ut},gmirror:Ve,setFocus(e){q.focus=Math.max(.1,e)},setAperture(e){q.aperture=Math.max(0,e)},setDofFar(e){q.far=Math.max(0,e)},setDof({focus:e,aperture:t,maxBlur:n,far:r}={}){r!==void 0&&(q.far=r),e!==void 0&&(q.focus=e),t!==void 0&&(q.aperture=t),n!==void 0&&(q.maxBlur=n)},setAutoFocus(e){q.auto=e||null},setMotionBlur(e,t={}){J.strength=e,J.velocity=t.cameraVelocity?t.cameraVelocity.clone():null,J.angular=t.angularVelocity?t.angularVelocity.clone():null,J.maskDistance=t.maskDistance??null},resetHistory(){mt=!0},resetExposure(){ht=!0},readExposure(){let t=new Float32Array(4);return e.readRenderTargetPixels(ce[le],0,0,1,1,t),{adapted:t[0],current:t[1]}},timings(e){return p.report(e)},prepareMaterials(){Be&&At()},get size(){return{W:v,H:b}},get stats(){return{...jt}}};return Nt}var at=`// lighting shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section emissiveNightGain\r
totalEmissiveRadiance += diffuseColor.rgb * 1 * ambData.bounce.w;\r
`,ot=`// surface shader sections.\r
\r
// @section wetSurface\r
\r
#if defined( STANDARD ) && !defined( USE_SKINNING ) && !defined( NO_WET ) && !defined( USE_TRANSMISSION )\r
{\r
  vec3 wetUp = ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz;\r
  float wetFlat = smoothstep( 0.93, 0.985, dot( normalize( normal ), wetUp ) );\r
  vec3 wetDc = material.diffuseColor;\r
  float wetMx = max( wetDc.r, max( wetDc.g, wetDc.b ) ), wetMn = min( wetDc.r, min( wetDc.g, wetDc.b ) );\r
  float wetGrey = 1.0 - smoothstep( 0.18, 0.4, ( wetMx - wetMn ) / max( wetMx, 1e-3 ) );\r
  float wetRain = ambData.wx.x; // (lighting2 r3) overcast rain: the whole city is wet\r
  if ( ambData.city.w > 0.0 ) { // (lighting2 r5) Times Square at night: glossy, damp asphalt / pavers mirror the screens (ts_night ref)\r
    vec3 twp = cameraPosition + ( - vViewPosition ) * mat3( viewMatrix );\r
    float tsM = smoothstep( 112.0, 80.0, abs( twp.x ) ) * smoothstep( -352.0, -325.0, twp.z ) * smoothstep( 22.0, 0.0, twp.z ) * step( twp.y, 1.0 );\r
    wetRain = max( wetRain, 0.75 * tsM * clamp( ambData.city.w * 8.0, 0.0, 1.0 ) );\r
  }\r
  if ( wetRain > 0.0 ) {\r
    // rain-soaked everything: darker, glossier (walls, cars, paint); flat ground: a continuous water film\r
    material.diffuseColor *= 1.0 - 0.22 * wetRain;\r
    material.roughness = mix( material.roughness, material.roughness * 0.45, wetRain );\r
    wetGrey = mix( wetGrey, 1.0, wetRain * 0.85 );\r
  }\r
  // (lighting2 r3) no puddles past ~1 km: far flat grey plates (hinterland, far shores) at grazing angles turned into\r
  // mirrors of the horizon glow (a pale band along the night horizon)\r
  wetFlat *= 1.0 - smoothstep( 700.0, 1300.0, length( vViewPosition ) );\r
  wetFlat *= max( ambData.wx.w, clamp( wetRain * 4.0, 0.0, 1.0 ) ); // (user r-nopuddles) Settings > Puddles off: no water on the ground in dry weather (rain still wets it)\r
  if ( wetFlat * wetGrey > 0.01 ) {\r
    vec3 wetP = cameraPosition + ( - vViewPosition ) * mat3( viewMatrix );\r
    vec2 q = wetP.xz;\r
    // cheap value noise, 2 octaves (big puddle fields + ragged edges)\r
    vec2 i0 = floor( q / 7.0 ), f0 = fract( q / 7.0 ); f0 = f0 * f0 * ( 3.0 - 2.0 * f0 );\r
    #define WH(v) fract( sin( dot( v, vec2( 127.1, 311.7 ) ) ) * 43758.5453 )\r
    float n0 = mix( mix( WH( i0 ), WH( i0 + vec2( 1, 0 ) ), f0.x ), mix( WH( i0 + vec2( 0, 1 ) ), WH( i0 + vec2( 1, 1 ) ), f0.x ), f0.y );\r
    vec2 i1 = floor( q / 1.9 ), f1 = fract( q / 1.9 ); f1 = f1 * f1 * ( 3.0 - 2.0 * f1 );\r
    float n1 = mix( mix( WH( i1 ), WH( i1 + vec2( 1, 0 ) ), f1.x ), mix( WH( i1 + vec2( 0, 1 ) ), WH( i1 + vec2( 1, 1 ) ), f1.x ), f1.y );\r
    #undef WH\r
    float wetN = n0 * 0.72 + n1 * 0.28;\r
    float wetH = mix( 0.4, 1.0, smoothstep( 4.0, 10.0, wetP.y ) ); // streets: fewer / smaller puddles than roofs\r
    float wetT = 0.3 * wetRain; // rain: puddles grow, the rest of the ground is a damp film\r
    // (zfix) dry presets (no rain): ~35-40 % fewer / smaller puddles, pooled mostly in the kerb gutters of the grid\r
    // roads, in low spots (a 23 m noise field) and around the roof drains; the rain look (wetRain > 0) is unchanged\r
    float wetSh = 0.0, wetDry = max( __SHADER_INJECT_0__ - clamp( wetRain * 4.0, 0.0, 1.0 ), 0.0 ); // ?oldpuddles: the previous dry look (A/B)\r
    if ( wetDry > 0.0 ) {\r
      vec2 lq = q / 23.0 + vec2( 5.3, 9.01 ), li = floor( lq ), lf = fract( lq ); lf = lf * lf * ( 3.0 - 2.0 * lf );\r
      #define WL(v) fract( sin( dot( v, vec2( 269.5, 183.3 ) ) ) * 43758.5453 )\r
      float wetL = mix( mix( WL( li ), WL( li + vec2( 1, 0 ) ), lf.x ), mix( WL( li + vec2( 0, 1 ) ), WL( li + vec2( 1, 1 ) ), lf.x ), lf.y );\r
      #undef WL\r
      float wetLow = smoothstep( 0.45, 0.8, wetL ) * ( wetP.y > 4.0 ? 1.0 : 0.45 ), wetGut = 0.0;\r
      if ( wetP.y < 0.1 && wetP.z < __SHADER_INJECT_1__ && !( wetP.x > __SHADER_INJECT_2__ && wetP.x < __SHADER_INJECT_3__ && wetP.z > __SHADER_INJECT_4__ && wetP.z < __SHADER_INJECT_5__ ) ) {\r
        float dk = 9.0; // distance inside the roadway to the nearest kerb line (grid avenues + streets)\r
        __SHADER_INJECT_6__\r
        float zc = floor( wetP.z / __SHADER_INJECT_7__ + 0.5 ) * __SHADER_INJECT_8__, hw = __SHADER_INJECT_9__;\r
        __SHADER_INJECT_10__\r
        __SHADER_INJECT_11__\r
        float dz = abs( wetP.z - zc ); if ( dz < hw ) dk = min( dk, hw - dz );\r
        wetGut = 1.0 - smoothstep( 0.4, 1.6, dk );\r
      }\r
      wetSh = wetDry * ( 0.095 - 0.13 * max( wetGut, wetLow ) );\r
    }\r
    float wetM = smoothstep( 0.63 + 0.05 * ( 1.0 - wetH ) - wetT + wetSh, 0.7 + 0.05 * ( 1.0 - wetH ) - wetT + wetSh - 0.01 * wetDry, wetN ) * wetFlat * wetGrey;\r
    float damp = max( smoothstep( 0.48 + wetSh + 0.02 * wetDry, 0.62 + wetSh + 0.02 * wetDry, wetN ), wetRain ) * wetFlat * wetGrey; // damp rim: darker, semi-glossy\r
    if ( wetRain * wetM > 0.01 ) { // rain ripples on the puddles: expanding rings in two jittered cell layers\r
      vec2 rg = vec2( 0.0 );\r
      for ( int k = 0; k < 2; k++ ) {\r
        vec2 rq = q / ( 0.55 + 0.3 * float( k ) ) + float( k ) * 7.31;\r
        vec2 rc = floor( rq ), rf = fract( rq ) - 0.5;\r
        float rh = fract( sin( dot( rc, vec2( 12.99, 78.23 ) ) ) * 43758.55 );\r
        vec2 ro = rf - ( vec2( fract( rh * 7.1 ), fract( rh * 13.7 ) ) - 0.5 ) * 0.5;\r
        float rt = fract( ambData.wx.y * 1.1 + rh ), rd = length( ro );\r
        float ring = sin( ( rd - rt * 0.5 ) * 45.0 ) * exp( - pow( ( rd - rt * 0.5 ) * 14.0, 2.0 ) ) * ( 1.0 - rt );\r
        rg += ro / max( rd, 1e-3 ) * ring;\r
      }\r
      normal = normalize( normal + ( viewMatrix * vec4( rg.x, 0.0, rg.y, 0.0 ) ).xyz * 0.35 * wetM * wetRain );\r
    }\r
    material.roughness = mix( material.roughness, 0.3, damp * 0.6 );\r
    material.roughness = mix( material.roughness, 0.045, wetM );\r
    material.diffuseColor *= 1.0 - 0.28 * damp - 0.22 * wetM;\r
    material.specularColor = mix( material.specularColor, vec3( 0.02 ), wetM ); // a water film: dielectric F0 whatever lies below\r
    material.specularF90 = mix( material.specularF90, 1.0, wetM );\r
  }\r
}\r
#endif\r
\r
// @section additiveOutput\r
\r
#if defined( STANDARD ) && defined( OPAQUE ) && !defined( NO_SSR ) && !defined( USE_TRANSMISSION )\r
{\r
  float ssrRough = material.roughness;\r
  vec3 ssrF = EnvironmentBRDF( normal, geometryViewDir, material.specularColor, material.specularF90, ssrRough );\r
  float ssrW = dot( ssrF, vec3( 0.2126, 0.7152, 0.0722 ) ) * ( 1.0 - smoothstep( 0.16, 0.36, ssrRough ) );\r
  #ifdef USE_CLEARCOAT\r
    vec3 ssrC = EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );\r
    ssrW = max( ssrW, material.clearcoat * dot( ssrC, vec3( 0.2126, 0.7152, 0.0722 ) ) * ( 1.0 - smoothstep( 0.16, 0.36, material.clearcoatRoughness ) ) );\r
  #endif\r
  pc_fragColor.a = 1.0 + clamp( ssrW, 0.0, 0.98 );\r
}\r
#endif\r
\r
// @section environmentDeclarations\r
\r
struct AmbData { vec4 grade; vec4 bounce; vec4 shape; vec4 city; vec4 wx; vec4 vert; vec4 cgrid; };\r
uniform AmbData ambData;\r
\r
// @section environmentLighting\r
vec3 irr = PI * envMapColor.rgb * envMapIntensity;\r
			float irrL = dot( irr, vec3( 0.2126, 0.7152, 0.0722 ) );\r
			irr = mix( vec3( irrL ), irr, ambData.grade.w ) * ambData.grade.rgb;\r
			float down = clamp( 0.5 - 0.5 * worldNormal.y, 0.0, 1.0 );\r
			irr *= mix( 1.0, ambData.shape.y, clamp( worldNormal.y, 0.0, 1.0 ) );\r
			// (atmosphere r3) street-level inter-reflection: in the canyons the sunlit asphalt, sidewalks and facades\r
			// bounce a lot of warm light onto everything standing in shade (people, cars, shop fronts, lower walls).\r
			// Stronger near the ground, fading with height (so tower shade sides seen from the air keep their contrast)\r
			float bGround = 1.0;\r
			#ifndef FLAT_SHADED\r
			{\r
				float wy = cameraPosition.y + dot( viewMatrix[ 1 ].xyz, - vViewPosition );\r
				// (lighting2 r2) + a long-range tail: tall shaded facades still see sunlit roofs / facades across the street\r
				// (off-screen for SSGI), so walls keep some warm fill tens of metres up\r
				irr *= 1.0 - ambData.vert.z * ( 1.0 - smoothstep( 2.0, 30.0, wy ) ); // (lighting2 r6) street-canyon skylight occlusion: cars / props / people in the canyon see a slot of sky\r
				bGround += ambData.shape.w * ( exp( - max( wy, 0.0 ) / 26.0 ) + 0.3 * exp( - max( wy, 0.0 ) / 150.0 ) ) * ( 1.0 - 0.7 * clamp( worldNormal.y, 0.0, 1.0 ) )\r
					* mix( 1.0, ambData.vert.y, 1.0 - abs( worldNormal.y ) ); // (lighting2 r6) user: walls / objects in shade too bright\r
			}\r
			#endif\r
			irr += ambData.bounce.rgb * mix( ambData.shape.x, 1.0, down * sqrt( down ) ) * bGround * envMapIntensity;\r
			irr *= ( ambData.shape.z > 0.0 ? ambData.shape.z : 1.0 ); // (atmosphere r2) diffuse-only IBL gain\r
			irr *= mix( 1.0, ambData.vert.x, smoothstep( 0.2, 0.85, 1.0 - abs( worldNormal.y ) ) ); // (lighting2 r6) vertical-surface fill: shaded facades / objects read dark (refs: 5-8:1 sun : shade on walls)\r
			// (lighting2 r3) NIGHT CITY LIGHT (night_aerial / ts_night refs): sodium street lighting fills the street level\r
			// (orange lines seen from above, lit sidewalks / lower facades / cars / people), and Times Square is bathed in\r
			// the coloured light of its screens (projected colour field: magenta / blue / cyan / warm, fading with height)\r
			#if !defined( FLAT_SHADED ) && !defined( NO_CITYLIGHT ) // NO_CITYLIGHT: far shores / other boroughs (farshore.ts)\r
			if ( ambData.city.r + ambData.city.w > 0.0 ) {\r
				vec3 cwp = cameraPosition + ( - vViewPosition ) * mat3( viewMatrix );\r
				float cy = max( cwp.y, 0.0 ), cup = clamp( worldNormal.y, 0.0, 1.0 );\r
				// lamp rhythm along the streets (~30 m) so the light is not a flat wash\r
				float lr = 0.7 + 0.3 * sin( cwp.x * 0.21 + 1.3 ) * sin( cwp.z * 0.19 );\r
				// only the modelled city (the far shores / hinterland ground plates would light up as one glowing band)\r
				float cfar = smoothstep( 2600.0, 1300.0, length( cwp.xz - cameraPosition.xz ) );\r
				if ( ambData.cgrid.w > 0.0 ) { vec2 gq = abs( ( cwp.xz - ambData.cgrid.xy ) / ambData.cgrid.z * 2.0 - 1.0 ); cfar *= max( smoothstep( 0.8, 0.98, max( gq.x, gq.y ) ), 0.6 * smoothstep( 220.0, 420.0, length( cwp - cameraPosition ) ) ); } // far inside the grid only ~5 lights per pixel (LOD): keep part of the analytic glow (critic r2: only one avenue glows from above) // (night) inside the local-light grid the real lamps light the street (cityLights.ts); the analytic glow takes over at its edge\r
				irr += ambData.city.rgb * ( exp( - cy / 4.5 ) * ( 0.45 + 0.55 * cup ) * lr + 0.12 * exp( - cy / 18.0 ) ) * cfar;\r
				if ( ambData.city.w > 0.0 ) {\r
					vec2 tq = cwp.xz;\r
					float inTS = smoothstep( 112.0, 70.0, abs( tq.x ) ) * smoothstep( -352.0, -318.0, tq.y ) * smoothstep( 22.0, -6.0, tq.y );\r
					if ( inTS > 0.0 ) {\r
						float ph = tq.y * 0.021 + tq.x * 0.013 + 0.35 * sin( tq.y * 0.047 + tq.x * 0.03 );\r
						vec3 c1 = mix( vec3( 1.0, 0.25, 0.7 ), vec3( 0.25, 0.45, 1.0 ), 0.5 + 0.5 * sin( ph * 6.2831 ) );\r
						vec3 c2 = mix( vec3( 0.2, 0.9, 1.0 ), vec3( 1.0, 0.7, 0.35 ), 0.5 + 0.5 * sin( ph * 4.1 + 1.7 ) );\r
						vec3 tc = mix( c1, c2, 0.5 + 0.5 * sin( tq.x * 0.05 - tq.y * 0.031 ) );\r
						tc = max( tc - 0.55 * min( tc.r, min( tc.g, tc.b ) ), 0.0 ) * 1.4; // (lighting2 r4) saturated magenta / cyan / amber spill, not white\r
						float th = exp( - cy / 22.0 ) * ( 0.55 + 0.45 * cup ) + 0.35 * exp( - cy / 70.0 ) * ( 1.0 - cup );\r
						th += ambData.vert.w * 0.9 * smoothstep( 12.0, 35.0, cy ) * exp( - max( cy - 35.0, 0.0 ) / 60.0 ); /* (night r9) 1.6: upper facades read lavender, ref walls between screens are near-black */ // (night r5) roofs / ledges around the square bathed in the screens' colour (ts_perch ref: pink ledge)\r
						irr += tc * ( ambData.city.w * inTS * th ) * ( 1.0 - ambData.vert.w * ( 1.0 - mix( 0.4, 0.35, smoothstep( 18.0, 40.0, cy ) ) ) ); /* (night r6) 40 % at street level too: warm-magenta plaza fill (critic: plazas ~45 % under the ref) */ // (night r5) above the street the analytic screen-colour field stays at 60%: roofs / upper facades around the square pick up the magenta glow (critic r4: TS perch roof black) // (night) real screen lights (screenlights.ts) replace this analytic spill; city.w still drives the damp TS asphalt\r
					}\r
				}\r
			}\r
			#endif\r
			return irr;\r
`,J=L(()=>ot),Y={grade:new C(1,1,1,.6),bounce:new C(0,0,0,1),vert:new C(1,1,0,0),wx:new C(0,0,0,1),cgrid:new C(0,0,512,0),city:new C(0,0,0,0),shape:new C(.25,1,0,0)},st=!1;function ct(e={}){if(st)return;st=!0;let t=M,n=e.wet!==!1;try{new URLSearchParams(location.search).has(`nowet`)&&(n=!1)}catch{}let r=!1;try{r=new URLSearchParams(location.search).has(`oldpuddles`)}catch{}let i=R(J.wetSurface,r?`0.0`:`1.0`,he.z0.toFixed(1),fe.x0.toFixed(1),fe.x1.toFixed(1),fe.z0.toFixed(1),fe.z1.toFixed(1),ue.map(e=>`dk = min( dk, ${ge.AV_HALF.toFixed(2)} - abs( wetP.x - ${e.toFixed(1)} ) + step( ${ge.AV_HALF.toFixed(2)}, abs( wetP.x - ${e.toFixed(1)} ) ) * 99.0 );`).join(` `),ge.ST_SP.toFixed(1),ge.ST_SP.toFixed(1),ge.ST_HALF.toFixed(2),pe.map(e=>`hw = abs( zc - ${e.toFixed(1)} ) < 1.0 ? ${9 .toFixed(2)} : hw;`).join(` `),me.map(e=>`hw = abs( zc - ${e.toFixed(1)} ) < 1.0 ? ${de.toFixed(2)} : hw;`).join(` `));n&&!t.lights_physical_fragment.includes(`wetFlat`)&&(t.lights_physical_fragment+=i);let a=J.additiveOutput;t.opaque_fragment.includes(`ssrW`)||(t.opaque_fragment+=a);let o=t.envmap_physical_pars_fragment,s=`return PI * envMapColor.rgb * envMapIntensity;`;if(o.includes(s)&&!o.includes(`ambData`)){t.envmap_physical_pars_fragment=J.environmentDeclarations+o.replace(s,J.environmentLighting);for(let e of[`standard`,`physical`,`lambert`,`phong`,`toon`]){let t=N[e];t&&(t.uniforms.ambData={value:Y})}}else o.includes(`ambData`)||console.warn(`[render/surface] could not patch envmap_physical_pars_fragment`)}var lt=L(()=>at),X=29,ut=40.75*Math.PI/180,dt=6*Math.PI/180,ft=12.95;function pt(e){let t=(((e-ft)%24+36)%24-12)*15*Math.PI/180,n=Math.sin(ut)*Math.sin(dt)+Math.cos(ut)*Math.cos(dt)*Math.cos(t),r=Math.asin(n),i=(Math.sin(dt)-n*Math.sin(ut))/(Math.cos(r)*Math.cos(ut)),a=Math.acos(k.clamp(i,-1,1));return t>0&&(a=2*Math.PI-a),{elevation:r*180/Math.PI,azimuth:a*180/Math.PI-90-X}}var mt=[{el:-14,env:1,envSpec:1,envSat:.7,sun:1,warm:0,fog:.55,mie:1.2,clouds:.14,exposure:1,bounce:.1,groundBounce:0,glow:0,fogTint:[.84,.9,1]},{el:-4.5,env:1,envSpec:1,envSat:.75,sun:1,warm:.3,fog:1.2,mie:1.3,clouds:.45,exposure:1.45,bounce:.3,groundBounce:1.2,glow:.7,fogTint:[.88,.85,.95]},{el:3,env:.72,envSpec:1,envSat:.75,sun:1.15,warm:.85,fog:1.35,mie:1.4,clouds:.55,exposure:1.5,bounce:.5,groundBounce:2.2,glow:1.5,fogTint:[1,.86,.74]},{el:10,env:.8,envSpec:.95,envSat:.8,sun:1.3,warm:.75,fog:1.3,mie:1.05,clouds:.55,exposure:1.2,bounce:.62,groundBounce:2.6,glow:1.45,fogTint:[1,.9,.8]},{el:24,env:1.5,envSpec:.85,envSat:.85,sun:1.55,warm:.48,fog:1.45,mie:.75,clouds:.62,exposure:.74,bounce:.95,groundBounce:2.6,glow:1.25,fogTint:[.9,.9,.96]},{el:45,env:1,envSpec:.8,envSat:.6,sun:1.45,warm:.32,fog:1,mie:.35,clouds:.8,exposure:.72,bounce:.55,groundBounce:2.4,glow:.3,fogTint:[.72,.83,1]}];function ht(e){let t=mt;if(e<=t[0].el)return{...t[0],fogTint:[...t[0].fogTint]};for(let n=1;n<t.length;n++)if(e<t[n].el){let r=t[n-1],i=t[n],a=(e-r.el)/(i.el-r.el),o=a*a*(3-2*a),s={};for(let e in r)s[e]=Array.isArray(r[e])?r[e].map((t,n)=>t+(i[e][n]-t)*o):r[e]+(i[e]-r[e])*o;return s}let n=t[t.length-1];return{...n,fogTint:[...n.fogTint]}}var Z={day:{elevation:65,azimuth:118,look:{vertFill:.55,vertBounce:.25,warm:.22,env:1,envSpec:.9,envSat:.9,sun:1.75,exposure:.9,clouds:.55,fog:.9,mie:.35,bounce:.4,groundBounce:1.25,glow:.15,fogTint:[.74,.84,1]}},morning:{elevation:16,azimuth:342,look:{vertFill:.6,vertBounce:.3,warm:.22,env:.58,envSat:.8,sun:1.65,exposure:1,clouds:.5,fog:1.2,mie:.9,bounce:.24,groundBounce:.8,glow:.45,fogTint:[.78,.86,1]}},sunrise:{elevation:4,azimuth:330,look:{vertFill:.65,vertBounce:.35,warm:.8,env:.5,bounce:.26,groundBounce:.9,glow:1.4,clouds:.5,skyDusk:1}},sunset:{elevation:7,azimuth:160,look:{vertFill:.65,vertBounce:.35,warm:.85,env:.52,bounce:.3,groundBounce:1,glow:1.5,clouds:.55,skyDusk:1.25}},dusk:{elevation:-4.5,azimuth:172,look:{vertFill:.8,vertBounce:.5,windows:.7,env:1.5,bounce:.2,groundBounce:.6,skyDusk:1.1,fogTint:[.78,.7,.72]}},night:{elevation:-14,azimuth:190,look:{windows:1,env:3,moonEl:36,moonAz:15,fogTint:[.38,.33,.32]}},overcast:{elevation:38,azimuth:125,look:{vertFill:.75,vertBounce:.5,sun:.18,env:1.6,envSpec:1,envSat:.4,warm:0,clouds:1,fog:2.6,mie:1.7,fogTint:[.82,.85,.88],exposure:.82,bounce:.1,groundBounce:.4,glow:0,wet:1,rain:1,windows:.3,flare:0,overcast:1}}};Z.dayB={elevation:55,azimuth:58,look:{...Z.day.look}},Z.dayC={elevation:44,azimuth:160,look:{...Z.day.look}};var gt={default:`day`,noon:`day`,afternoon:`day`,golden:`sunset`,dawn:`sunrise`,rain:`overcast`,cycle:`day`},Q=k.lerp,$=(e,t,n)=>{let r=k.clamp((n-e)/(t-e),0,1);return r*r*(3-2*r)};function _t({renderer:e,scene:n}){let r=le(e);ct(r);let i=!!e.capabilities.reversedDepthBuffer;e.shadowMap.enabled=!0,e.shadowMap.type=1,e.shadowMap.autoUpdate=!0;let a=nt(e,r),o=new ce({scene:n,quality:r,reversed:i,renderer:e});P(e,n);let s=o.sun;n.background=null;let c={density:13e-5,heightFalloff:1/300},l={density:c.density,heightFalloff:c.heightFalloff,sunScatter:.6,tint:new f(.84,.9,1),startDistance:35,shafts:1},u={name:`default`,hour:14.5,elevation:47,azimuth:118,night:0,exposure:1,bloom:1,windows:0},d={envDirty:!0,envTexture:null,envIntensity:.95,envTimer:0,nightMats:null,nightScan:0},p={street:.5,ts:.13},m=new WeakMap,h={low:[.0125,.0115,.0165],high:[.008,.008,.012],glow:[.012,.009,.011],fog:4,start:120,glowCol:[.022,.013,.0075],glowH:22,glowK:.004},g={k:0,low:h.low,high:h.high,cfg:h},_=new O,v=new O;new f;let y={moon:!1,dir:v,color:new f,lastDir:new O(0,1,0)},b={dir:_,k:0};function x({elevation:e,azimuth:t,hour:r=null,name:i=`custom`,look:o=null},s=!1){u.name=i,u.hour=r??u.hour,u.elevation=e,u.azimuth=t;let f=e,m=$(-1,-8,f);u.night=m;let v=o??ht(f),x=a.params,C=$(-3,2,f),w=$(-3,-10,f),T=$(-10,1,f)**2;x.elevation=Math.max(f,-14),x.azimuth=t,x.lightScale=C*(v.sun??1);let D=v.warm;x.lightTint=[1+.1*D,1-.04*D,1-.3*D],x.skyTint=[.066*w+.01,.042*w+.007,.027*w+.005].map((e,t)=>Q(e,1,T)*(v.rain?[.95,.9,.7][t]:1));let O=$(10,1,f)*$(-9,-1.5,f)*(v.skyDusk??1);x.skyGlow=[.35*O+h.glow[0]*m,.16*O+h.glow[1]*m,.06*O+h.glow[2]*m],a.skyUniforms.uHzK.value.set(Q(.56,.38,m),Q(.63,.38,m),Q(.78,.5,m)),x.night=m,x.stars=m*(1-T)*.04,x.sunGlow=[1.05,.5,.08,(v.glow??1)*$(-4,1,f)];let ee=v.moonEl==null?pt(((u.hour??22)+12)%24):{elevation:v.moonEl,azimuth:v.moonAz},A=k.degToRad(Math.max(ee.elevation,14)),j=k.degToRad(ee.azimuth);if(_.set(Math.cos(A)*Math.cos(j),Math.sin(A),Math.cos(A)*Math.sin(j)).normalize(),b.k=w,y.moon=C<.001,y.moon){let e=Ye(A,1.2),t=x.skyScale*.62*(.047*w+5e-4);y.color.setRGB(e[0]*t*.45,e[1]*t*.7,e[2]*t*1.4)}x.mie=v.mie,x.envSaturation=.92,x.cloudCoverage=v.clouds,x.overcast=v.overcast??0,x.cloudDensity=.7*(1+1.5*x.overcast);let M=v.envSpec??v.env;d.envIntensity=M,Y.shape.z=v.env/M,l.density=c.density*Q(v.fog,h.fog,m),g.k=m,l.startDistance=Q(35,h.start,m),l.tint.setRGB(...v.fogTint),l.sunScatter=Q(.25,.6+.6*$(20,3,f),C),l.shafts=Q(.35,1,C)*(v.flare??1),u.exposure=v.exposure*Q(1,4.5,m),u.bloom=1+1.6*m,u.windows=v.windows??$(3,-7,f),u.sunK=C*(v.flare??1),u.moonK=w,u.rain=v.rain??0,Y.wx.x=v.wet??0,Y.wx.z=u.rain,B.value=u.windows,oe(),ie.value=Math.min(1.2,.9*Q(1,.5,u.windows)/Math.max(u.exposure,.3)),S({env:!s});let N=a.sunColor,te=Math.max(a.sunDir.y,0);Y.grade.set(Q(.98,.72,m),Q(1,.93,m),Q(1.03,1.36,m),v.envSat);let P=(v.bounce??.4)*Math.max(te,.3*Math.min(1,te*8));Y.bounce.set(N.r*P*1.08,N.g*P,N.b*P*.8,Q(1,.04,m)),Y.shape.w=(v.groundBounce??2.4)*(1-m),Y.shape.y=Q(1,.62,m),Y.vert.set(v.vertFill??1,v.vertBounce??1,(1-(v.vertFill??1))*.8,+!!I.enabled);let F=u.windows;Y.city.set(p.street*F,p.street*.72*F,p.street*.45*F,p.ts*F),n.environmentIntensity=d.envIntensity,E()}new O;function S({env:e=!0}={}){if(a.update(),y.moon)v.copy(_),s.color.copy(y.color);else{let e=k.degToRad(Math.max(a.params.elevation,2)),t=k.degToRad(a.params.azimuth);v.set(Math.cos(e)*Math.cos(t),Math.sin(e),Math.cos(e)*Math.sin(t)).normalize(),s.color.copy(a.sunColor)}(y.lastDir.angleTo(v)>.0012||e)&&(o.setSunDirection(v),y.lastDir.copy(v)),s.intensity=1;let t=Math.max(s.color.r,s.color.g,s.color.b,1e-6);s.color.multiplyScalar(1/t),s.intensity=t,e&&(d.envDirty=!0)}function C(){let e=new Set;n.traverse(t=>{let n=t.material;if(n)for(let t of Array.isArray(n)?n:[n])e.add(t)});let t=[];for(let n of e){let e=m.get(n);if(!e){let t=n.userData?.uniforms;e=n.userData?.nightGain!=null&&n.emissive?{kind:`emis`,ei:n.emissiveIntensity??1,gain:n.userData.nightGain}:n.userData?.nightLit?{kind:`emis`,ei:n.userData.nightLit,base0:!0}:t?.uInteriorGain||t?.uShopGain?{kind:`facade`,gi:t.uInteriorGain?.value??0,gs:t.uShopGain?.value??0}:n.emissive&&n.emissive.r+n.emissive.g+n.emissive.b>.05&&!n.map?{kind:`emis`,ei:n.emissiveIntensity??1}:n.emissive&&n.emissiveMap&&(n.emissiveIntensity??0)>.3?{kind:`emis`,ei:n.emissiveIntensity,gain:.1,screen:!0}:{kind:`none`},m.set(n,e)}e.kind!==`none`&&t.push({m:n,...e}),T(n)}d.nightMats=t}let w=new WeakSet;function T(e){if(w.has(e))return;w.add(e);let n=e.onBeforeCompile;if(!n||n===t.prototype.onBeforeCompile)return;let r=``;try{r=n.toString()}catch{return}if(!/totalEmissiveRadiance \+= diffuseColor\.rgb \*/.test(r))return;e.onBeforeCompile=function(e,t){n.call(this,e,t),e.fragmentShader=e.fragmentShader.replace(/totalEmissiveRadiance \+= diffuseColor\.rgb \* ([0-9.]+);/g,lt.emissiveNightGain)};let i=e.customProgramCacheKey;e.customProgramCacheKey=function(){return(i?i.call(this):``)+`|dayTrans`},e.needsUpdate=!0}function E(){let e=u.windows;if(!d.nightMats){if(e<=0)return;C()}for(let t of d.nightMats)if(t.kind===`facade`){let n=t.m.userData.uniforms;n.uInteriorGain&&(n.uInteriorGain.value=t.gi*Q(1,5,e)),n.uShopGain&&(n.uShopGain.value=t.gs*Q(1,1.5,e))}else t.screen?t.m.emissiveIntensity=t.ei*ie.value:t.m.emissiveIntensity=t.base0?t.ei*e:t.ei*Q(1,t.gain??3,e)}let D=[`vertFill`,`vertBounce`,`overcast`,`env`,`envSpec`,`envSat`,`sun`,`warm`,`fog`,`mie`,`clouds`,`exposure`,`bounce`,`groundBounce`,`glow`,`windows`,`wet`,`rain`,`flare`,`skyDusk`,`moonEl`,`moonAz`];function ee(e){let t=Z[e]?e:gt[e]??`day`,n=Z[t],r=ht(n.elevation),i={windows:$(3,-7,n.elevation),wet:0,rain:0,overcast:0,vertFill:1,vertBounce:1,flare:1,skyDusk:1,moonEl:36,moonAz:n.azimuth+180,...r,...n.look};return i.fogTint=[...n.look.fogTint??r.fogTint],{elevation:n.elevation,azimuth:n.azimuth,name:t,look:i}}let A={on:!1,t:0,dur:2.5,from:null,to:null,envStep:-1,envTail:0},j=!1;function M(){return{elevation:u.elevation,azimuth:u.azimuth,name:u.name,look:{...u.look,fogTint:[...u.look.fogTint]}}}function N(e,{instant:t=!1}={}){let n=ee(e);return t||!u.look?(A.on=!1,x(n),u.look=n.look,n.name):((A.on?A.to.name===n.name:u.name===n.name)||(A.from=M(),A.to=n,A.t=0,A.on=!0),n.name)}function te(e=`day`){return j?u.name:N(e,{instant:(d.upT||0)<3})}function F(e){A.t=Math.min(1,A.t+e/A.dur);let t=A.t*A.t*(3-2*A.t),n=A.from,r=A.to,i={...r.look};for(let e of D)n.look[e]!=null&&r.look[e]!=null&&(i[e]=Q(n.look[e],r.look[e],t));i.fogTint=n.look.fogTint.map((e,n)=>Q(e,r.look.fogTint[n],t));let a=((r.azimuth-n.azimuth)%360+540)%360-180;x({elevation:Q(n.elevation,r.elevation,t),azimuth:n.azimuth+a*t,name:t<1?n.name+`>`+r.name:r.name,look:i},!0),u.look=i,A.t>=1&&(A.on=!1,A.envTail=1),A.envStep<0&&(A.envStep=0)}function L(){A.envStep<0||(A.envStep<6?a.renderEnvFace(A.envStep++):(d.envTexture=a.finishEnv(),n.environment=d.envTexture,A.envStep=A.on||A.envTail-->0?0:-1))}let ne=`day`;try{let e=new URLSearchParams(location.search),t=e.get(`tod`);t!=null&&(ne=t),j=t!=null||e.has(`shot`)||e.has(`playtest`)}catch{}N(ne,{instant:!0});let R=new O,z={sun:s,cascadedShadows:o,sky:a,fog:l,quality:r,reversed:i,tod:u,amb:Y,city:p,cityLights:I,cityVol:{strength:1,density:.0045,height:30},nightHaze:g,get timeOfDay(){return u.name},get envIntensity(){return d.envIntensity},set envIntensity(e){d.envIntensity=e,n.environmentIntensity=e},setSun({elevation:e,azimuth:t}={}){A.on=!1,x({elevation:e??u.elevation,azimuth:t??u.azimuth,name:`custom`,look:u.look})},refresh(){S()},setupMaterial(){},get preset(){return u.name},setTimeOfDay(e){return N(e,{instant:!0})},setPreset(e){return N(e)},setTimeMode:te,nightK:B,moon:b,setDryPuddles(e=!0){Y.wx.w=+!!e},get cycle(){return{on:!1,hour:u.hour??12,minutes:0}},presets:Object.keys(Z),update(e,t=1/60){let r=performance.now()/1e3,i=d.lastT?Math.min(r-d.lastT,.1):t;d.lastT=r,A.on&&F(i),L(),n.environmentIntensity=d.envIntensity,Y.wx.y=performance.now()/1e3,re(),ae.value=performance.now()/1e3,d.upT=(d.upT||0)+t,u.windows>0&&(d.nightScan+=t)>(d.upT<20?1:6)&&(d.nightScan=0,C(),E()),d.envDirty&&=(d.envTexture=a.renderEnv(),n.environment=d.envTexture,console.log(`PMREM texture diagnostics:`,{mapping:d.envTexture.mapping,width:d.envTexture.image?.width,height:d.envTexture.image?.height,isTexture:d.envTexture.isTexture,isRenderTargetTexture:d.envTexture.isRenderTargetTexture,image:d.envTexture.image}),n.environmentIntensity=d.envIntensity,!1),e.updateMatrixWorld();let s=typeof window<`u`?window.__ctx?.player?.object:null;s?(s.getWorldPosition(R),o.setFocus(R),(d.charScan=(d.charScan||0)+1)%30==1&&o.setCharacter(s)):o.setFocus(null),o.update(e,n),I.build(e);{let e=I.shared.origin;Y.cgrid.set(e.x,e.y,e.z*64,e.w)}}};return typeof window<`u`&&(window.setTOD=e=>N(e),window.__nightK=B,window.__cityLights=I),z}var vt=e=>({traverse(t){for(let n of e)t(n)},traverseVisible:()=>{}}),yt=e=>(e.isMesh||e.isPoints||e.isLine||e.isSprite)&&e.material;function bt(e,t,n,{mirrorLayers:r=null,maxProgramsPerStep:i=4,compileBudgetMs:a=2}={}){let o=new x(1,1,{type:g}),s=new WeakSet,c=new WeakSet,l=[],u=[],d=0,f=0,p=n.clone();if(p.layers.disableAll(),r)for(let e of r)p.layers.enable(e);let m=W.camera,h={rescan(){d||=performance.now(),t.traverse(e=>{yt(e)&&(s.has(e)||(s.add(e),l.push(0,e)),r&&!c.has(e)&&(e.layers.test(p.layers)||e.isMesh&&(e.castShadow||/^(facade|roofs|facadeLod)\b/.test(e.name||``))&&!/^detail\b/.test(e.name||``)&&!e.userData?.smallCasters)&&(c.add(e),l.push(1,e)))});for(let e of W.registeredPasses)s.has(e.mesh)||(s.add(e.mesh),l.push(2,e.mesh))},get pending(){return l.length/2},settle(e=null,t=25e3){let n=u.slice(),r=n.length,i=performance.now();return new Promise(a=>{let o=n.slice(),s=0,c=()=>{let n=performance.now(),l=0;for(;s<o.length&&l<32&&performance.now()-n<3;)o[s].isReady?.()??!0?(o[s]=o[o.length-1],o.pop()):s++,l++;e?.(r?(r-o.length)/r:1);let u=s>=o.length,d=performance.now()-i>t;o.length===0||d&&u?(console.log(`[warmup] ${r-o.length}/${r} programs linked before the first frame (${((performance.now()-i)/1e3).toFixed(1)} s)`),a()):u?(s=0,setTimeout(c,d?0:60)):setTimeout(c,0)};c()})},flush(){let e=i,t=a;i=1/0,a=1/0,u.length=0;try{h.step(!0)}finally{i=e,a=t}},step(r=!1){if(!l.length)return!1;if(u=u.filter(e=>!(e.isReady?.()??!0)),u.length&&!r)return!0;let s=e.info.programs,c=s.length,h=e.getRenderTarget(),g=e.shadowMap.enabled;e.setRenderTarget(o);try{let r=0,o=performance.now();for(;r<l.length&&s.length-c<i&&performance.now()-o<a;){let i=l[r],a=l[r+1];r+=2,i===1?(e.shadowMap.enabled=!1,e.compile(vt([a]),p,t),e.shadowMap.enabled=g):i===2?e.compile(vt([a]),m,vt([])):e.compile(vt([a]),n,t)}l=l.slice(r)}catch(e){console.warn(`[warmup]`,e),l=[]}finally{e.shadowMap.enabled=g,e.setRenderTarget(h)}for(let e=c;e<s.length;e+=1)u.push(s[e]);return f+=s.length-c,l.length||console.log(`[warmup] ${f} programs queued so far (${s.length} total), ${((performance.now()-d)/1e3).toFixed(1)} s`),l.length>0}};return h}export{_t as n,it as r,bt as t};
//# sourceMappingURL=render~index-KNPrkHIq.js.map