import{B as e,Dt as t,Gt as n,Ha as r,Hn as i,Lt as a,Ma as o,Qi as s,Qt as c,Rn as l,U as u,Va as d,Wi as f,Wr as p,an as m,ar as h,ct as g,dt as _,in as v,ir as y,j as b,ja as x,jt as S,mr as C,pr as w,qa as T,ro as E,sn as D,ta as O,wr as k,z as A}from"./three~index~combat~screenshotPresets~gameSystems~GLTFLoader-BF58tRDi.js";import{i as j,n as ee}from"./three~index~screenshotPresets~gameSystems-BymyXT8A.js";import{n as M,o as N,s as P}from"./world~index~screenshotPresets~gameSystems-Dd9PBWOO.js";import{i as F}from"./vehicleLighting-CSwID43I.js";import{D as I,E as L,N as R,k as z}from"./world~index~gameSystems-BSmpxLKb.js";import{n as B,t as te}from"./layoutConstants-CRt9OKpB.js";import{D as ne,ct as V,o as H,pt as U,v as re}from"./world~index~gameSystems-BR_3eHIy.js";import{t as ie}from"./world~index~combat~screenshotPresets~gameSystems-eJmDYCna.js";import{t as ae}from"./performanceFlags-Cybz3NnI.js";import{r as oe}from"./three~index~screenshotPresets~gameSystems~GLTFLoader-B3wE3Q6h.js";var se=`// farshore shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
out vec3 vLWP;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vLWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
// @section fragmentCommon\r
#include <common>\r
in vec3 vLWP;\r
float lh(vec2 p) {\r
return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);\r
}\r
// @section fragmentMap\r
#include <map_fragment>\r
{\r
vec2 p = vLWP.xz;\r
vec2 cell = vec2(96.0, 210.0);\r
vec2 q = p / cell, id = floor(q), f = fract(q);\r
float r = lh(id), nb = lh(floor(p / 1400.0));\r
vec3 blk = mix(vec3(0.29, 0.27, 0.25), vec3(0.4, 0.36, 0.32), r); // (r14: darker, warmer)\r
if(r > 0.93 || nb < 0.1) blk = vec3(0.26, 0.31, 0.22);             // parks / cemeteries\r
else if(nb > 0.8) blk *= vec3(1.05, 1.0, 0.95);                     // industrial / lighter\r
// (round 3) street-tree / back-yard canopy mottling: the hinterland reads as leafy boroughs, not a grey slab\r
float tc = lh(floor(p / 38.0)) * 0.6 + lh(floor(p / 330.0)) * 0.4;\r
blk = mix(blk, vec3(0.16, 0.19, 0.12), smoothstep(0.45, 0.8, tc) * 0.75);\r
vec2 e = min(f, 1.0 - f) * cell;\r
float st = 1.0 - smoothstep(5.0, 8.0, min(e.x, e.y));\r
vec3 c = mix(blk, vec3(0.2, 0.2, 0.21), st);\r
// (round 6) arterial boulevards (same grid as the baked map) keep the road hierarchy readable to the horizon\r
float art = min(abs(mod(p.x - 350.0 + 550.0, 1100.0) - 550.0), abs(mod(p.y - 180.0 + 475.0, 950.0) - 475.0));\r
c = mix(c, vec3(0.15, 0.15, 0.16), 1.0 - smoothstep(11.0, 14.0, art));\r
vec2 fw = fwidth(q);\r
c = mix(c, vec3(0.33, 0.33, 0.31), clamp(max(fw.x * 4.0, fw.y * 8.0), 0.0, 1.0));\r
vec2 uvm = vMapUv;\r
float inMap = step(0.0, uvm.x) * step(uvm.x, 1.0) * step(0.0, uvm.y) * step(uvm.y, 1.0);\r
float edge = inMap * smoothstep(0.0, 0.03, min(min(uvm.x, 1.0 - uvm.x), min(uvm.y, 1.0 - uvm.y)));\r
diffuseColor.rgb = mix(c, diffuseColor.rgb, edge);\r
}\r
// @section vertexCommonByCliffWorldPosition\r
#include <common>\r
out vec3 vCW;\r
// @section vertexFogVertexByCliffWorldPosition\r
#include <fog_vertex>\r
vCW = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
// @section fragmentCommonByCliffWorldPosition\r
#include <common>\r
in vec3 vCW;\r
float ch(float x) {\r
return fract(sin(x * 91.7) * 43758.5453);\r
}\r
float vn(float x) {\r
float i = floor(x), f = fract(x);\r
f = f * f * (3.0 - 2.0 * f);\r
return mix(ch(i), ch(i + 1.0), f);\r
}\r
// @section fragmentMapByCliffWorldPosition\r
{\r
float u = vCW.z * 0.97 + vCW.x * 0.24, y = vCW.y;\r
float cu = u / (3.5 + 2.0 * vn(u * 0.05)), cid = floor(cu), cf = fract(cu);\r
float joint = 1.0 - smoothstep(0.0, 0.12, min(cf, 1.0 - cf));\r
vec3 c = mix(vec3(0.15, 0.14, 0.13), vec3(0.23, 0.2, 0.17), ch(cid)) * (0.85 + 0.3 * vn(y * 0.3 + cid));\r
c = mix(c, vec3(0.36, 0.25, 0.18), smoothstep(0.55, 0.9, vn(u * 0.013 + y * 0.02)) * 0.5);   // iron staining\r
c *= 1.0 - 0.55 * joint;\r
float ledge = smoothstep(0.82, 0.97, fract(y / (9.0 + 3.0 * vn(u * 0.02))));\r
vec3 moss = mix(vec3(0.12, 0.15, 0.07), vec3(0.2, 0.19, 0.09), vn(u * 0.2));\r
float veg = max(ledge * 0.7, smoothstep(__SHADER_INJECT_0__, __SHADER_INJECT_1__, y + 6.0 * vn(u * 0.07))) * step(0.35, vn(u * 0.11 + y * 0.05));\r
c = mix(c, moss, veg * 0.85);\r
// wooded talus slope over the lower third (scrub and trees climbing the scree), ragged upper edge\r
float talus = 1.0 - smoothstep(0.0, 4.0, y - (__SHADER_INJECT_2__ + 12.0 * vn(u * 0.031) + 5.0 * vn(u * 0.17)));\r
vec3 wood = mix(vec3(0.07, 0.085, 0.045), vec3(0.14, 0.12, 0.06), vn(u * 0.4 + y * 0.3)) * (0.7 + 0.5 * vn(u * 1.3 + y * 0.9));\r
c = mix(c, wood, talus);\r
diffuseColor.rgb = c;\r
}\r
// @section vertexCommonByGlassMask\r
#include <common>\r
out vec3 vWPm;\r
out float vWin;\r
out float vGl;\r
out vec3 vBx;\r
// @section vertexColorVertex\r
#include <color_vertex>\r
vWin = color.b > 5.0 ? 1.0 : 0.0;\r
vGl = color.b > 15.0 ? 1.0 : 0.0;\r
vColor.b = color.b > 15.0 ? color.b - 20.0 : color.b > 5.0 ? color.b - 10.0 : color.b;\r
// @section vertexFogVertexByMountainWorldPosition\r
#include <fog_vertex>\r
vWPm = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
// @section fragmentCommonByGlassMask\r
#include <common>\r
in vec3 vWPm;\r
in float vWin;\r
in float vGl;\r
uniform float uNightK;\r
float mh(vec2 p) {\r
return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);\r
}\r
// @section fragmentColor\r
#include <color_fragment>\r
vec3 dnE = vec3(0.0); // (daynight) lit windows at night\r
if(vWin > 0.5) {\r
// (round 3) readable facades at 1-5 km: dark glazing with a per-window sky / blind variation, spandrels,\r
// a pale parapet / cornice line, grimy darker base. Averages to the same tone once sub-pixel (no shimmer).\r
float along = vWPm.x + vWPm.z;\r
vec2 fw = fwidth(vec2(vWPm.y / 3.3, along / 2.4));\r
float sub = clamp(max(fw.x, fw.y) * 1.3, 0.0, 1.0);\r
vec3 base = diffuseColor.rgb;\r
if(vGl > 0.5) {\r
float mul = fract(along / 1.6), fl = fract(vWPm.y / 3.9);\r
float frame = max(1.0 - step(0.1, mul), 1.0 - step(0.12, fl));\r
vec3 gl = mix(vec3(0.1, 0.13, 0.16), vec3(0.34, 0.4, 0.46), smoothstep(0.0, 180.0, vWPm.y) * 0.6 + 0.25 * mh(floor(vec2(along / 1.6, vWPm.y / 3.9))));\r
vec3 c = mix(gl, base * 0.9, frame * 0.8);\r
diffuseColor.rgb = mix(c, mix(vec3(0.14, 0.17, 0.2), vec3(0.28, 0.33, 0.37), smoothstep(0.0, 200.0, vWPm.y)), sub);\r
dnE = mix(vec3(0.8, 0.88, 1.0) * (1.0 - frame) * step(0.8, mh(floor(vec2(along / 1.6, vWPm.y / 3.9)) + 5.3)) * 0.5, vec3(0.009, 0.01, 0.012), sub); // (night) sparser, dimmer // (daynight, lighting2 r3) sub-pixel mean was 0.3 (x1.4 x night exposure ~3.6): the far shores glowed as a pale band\r
} else {\r
float fl = fract((vWPm.y - 1.2) / 3.3), u = fract(along / 2.4);\r
float w = step(0.3, fl) * step(fl, 0.82) * step(0.28, u) * step(u, 0.74);\r
vec2 wid = floor(vec2(along / 2.4, (vWPm.y - 1.2) / 3.3));\r
vec3 wc = vec3(0.07, 0.08, 0.095) * (0.7 + 0.9 * mh(wid)) + vec3(0.1, 0.09, 0.07) * step(0.93, mh(wid + 3.1));\r
vec3 c = mix(base, wc, w);\r
c = mix(c, mix(base, wc, 0.33), sub);\r
diffuseColor.rgb = c;\r
dnE = mix(vec3(1.0, 0.72, 0.42) * w * step(0.85, mh(wid + 7.7)) * (0.2 + 0.5 * mh(wid + 2.9)), vec3(0.012, 0.0085, 0.005), sub); // (night) sparse warm sparkle; the sub-pixel mean (was 0.026: x1.4 x4.5 exposure = the tan band) matches it\r
}\r
diffuseColor.rgb *= 0.62 + 0.38 * smoothstep(0.0, 14.0, vWPm.y - __SHADER_INJECT_0__);   // contact darkening\r
}\r
diffuseColor.rgb *= 1.0 - 0.85 * uNightK; // (night) dark silhouettes at night (critic r1, r3)\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
totalEmissiveRadiance += dnE * uNightK * 1.4;\r
`,ce=`// facade shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
__SHADER_INJECT_0__\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
__SHADER_INJECT_0__\r
// @section fragmentCommon\r
#include <common>\r
__SHADER_INJECT_0____SHADER_INJECT_1__\r
// @section fragmentMap\r
Surf FS;\r
facade(FS);\r
#ifdef FAR_NIGHT\r
FS.alb *= 1.0 - 0.8 * uNightK; // (night) far shores: dark silhouettes at night (critic r1: beige-peach masses read like dusk)\r
#endif\r
diffuseColor.rgb = FS.alb;\r
// @section fragmentRoughness\r
float roughnessFactor = FS.rough;\r
// @section fragmentMetalness\r
float metalnessFactor = FS.metal;\r
// @section fragmentNormalMaps\r
\r
{\r
vec3 Nw = normalize(vWN);\r
vec3 Tw = Nw.y > 0.5 ? vec3(1.0, 0.0, 0.0) : (Nw.y < - 0.5 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), Nw)));\r
vec3 Bw = Nw.y > 0.5 ? vec3(0.0, 0.0, - 1.0) : (Nw.y < - 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0));\r
vec3 nw = normalize(Tw * FS.n.x + Bw * FS.n.y + Nw * FS.n.z);\r
normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);\r
}\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
totalEmissiveRadiance += FS.emis;\r
if(uNightK > 0.0) totalEmissiveRadiance += FS.alb / max(1.0 - gAoT, 0.4) * (1.0 - 0.6 * FS.metal) * crownFlood(vWPos, normalize(vWN)) * uNightK; // (night) crown floods\r
// @section fragmentPhysicalLights\r
#include <lights_physical_fragment>\r
material.specularColor = mix(material.specularColor, vec3(gF0) * gSpecTint, clamp(gGlass, 0.0, 1.0));\r
material.specularF90 = mix(material.specularF90, 0.55, clamp(gGlass, 0.0, 1.0) * gSash); // (textures r4) 0.3 -> 0.55\r
// @section fragmentLightsMaps\r
#include <lights_fragment_maps>\r
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV ) && defined( RE_IndirectSpecular )\r
{\r
float cg = clamp(gGlass, 0.0, 1.0);\r
// (render r-refl) the player / web / near peds mirrored about this glass plane (render/glassmirror.ts), laid over the\r
// glass's own (procedural city) reflection below, before the sash dimming and the Fresnel / specular BRDF\r
vec4 gmS = cg > 0.001 ? glassMirror(vWPos, normalize(vWN)) : vec4(0.0);\r
if(cg > 0.001 && vWPos.y <= 2.0) radiance = mix(radiance, gmS.rgb, gmS.a);\r
if(cg > 0.001 && vWPos.y > 2.0) {\r
vec3 Rw = inverseTransformDirection(reflect(- geometryViewDir, normal), viewMatrix);\r
float az = atan(Rw.z, Rw.x) * 7.0 + vS.y * 3.1;\r
float bk = floor(az), fa = fract(az);\r
float h1 = fh1(vec2(bk, 3.7)), h2 = fh1(vec2(bk, 9.1)), h3 = fh1(vec2(bk + 0.5, 1.3));\r
// skyline elevation seen from this window: lower windows see taller neighbours\r
float hsky = mix(0.03, 0.36, h1 * h1) * (1.0 + 0.8 * (1.0 - smoothstep(20.0, 260.0, vWPos.y))); // (skyline r4) more sky in mid-height glass\r
hsky *= step(0.12, h3) * (0.85 + 0.3 * step(abs(fa - 0.5), 0.3 * h2)); // gaps + narrower upper shafts\r
if(vX.z > 3.5 && vX.z < 4.5) hsky *= 0.35; // (skyline r3) the supertall low-iron glass stands above its neighbours: mostly sky\r
float fwR = fwidth(Rw.y) + 0.004;\r
float bldg = 1.0 - smoothstep(hsky - fwR, hsky + fwR, Rw.y);\r
vec3 hz = textureCubeUV(envMap, envMapRotation * normalize(vec3(Rw.x, 0.06, Rw.z)), 0.7).rgb * envMapIntensity;\r
float sunF = h2 > 0.55 ? 0.58 : 0.27;                          // sunlit vs shaded neighbour face\r
float rows = 0.8 + 0.2 * step(0.5, fract(Rw.y * 180.0 / max(0.4, 1.0 + 60.0 * fwR)));\r
vec3 cityC = hz * mix(vec3(0.95, 0.9, 0.82), vec3(0.75, 0.82, 0.95), h3) * sunF * rows;\r
vec3 streetC = hz * vec3(0.16, 0.17, 0.19);\r
// (skyline r7) critic: 'right-edge tower is a flat black checkerboard, no reflection'. A high window's steep\r
// downward ray does not reach the street: it sees the roofscape / lower facades (mid grey, broken up into\r
// sunlit roofs, shaded canyons and pale parapets) -> dark-but-structured glass instead of a black grid\r
{\r
vec2 rq = Rw.xz / max(- Rw.y, 0.2) * (0.6 + 0.5 * vS.y) * 9.0;\r
float rb = fh1(floor(rq)), rb2 = fh1(floor(rq * 0.37) + 4.1);\r
vec3 roofC = hz * mix(vec3(0.34, 0.36, 0.39), vec3(0.6, 0.6, 0.59), rb) * (0.75 + 0.35 * rb2); // (skyline r10) lighter: glass seen from above picks up the pale city\r
streetC = mix(streetC, roofC, smoothstep(35.0, 160.0, vWPos.y));\r
}\r
// (skyline r6) critic: 'glass is a matte dark grid, no reflections'. A shallow downward ray (tower seen from above\r
// or from far away) mirrors the hazy far city / horizon, not the street: bright, cool, with the neighbours'\r
// lit / shaded faces; only steep rays reach the dark street floor\r
vec3 farC = hz * mix(vec3(0.62, 0.66, 0.72), vec3(0.9, 0.92, 0.96), h2) * (0.9 + 0.1 * rows);\r
float dn = smoothstep(0.0, - 0.06, Rw.y);\r
cityC = mix(cityC, farC, dn * (1.0 - smoothstep(- 0.12, - 0.4, Rw.y)));\r
cityC = mix(cityC, streetC, smoothstep(- 0.4, - 0.85, Rw.y));\r
cityC *= 1.0 - 0.85 * uNightK; // (night) the reflected neighbours / streets are dark masses at night (the horizon-glow tint turned far glass towers pale)\r
cityC = mix(cityC, radiance, 0.24); // keep a hint of sky / haze in the reflected city (stylised, like the refs)\r
radiance = mix(radiance, cityC, bldg * cg * (1.0 - 0.5 * smoothstep(0.35, 0.8, material.roughness)));\r
radiance = mix(radiance, gmS.rgb, gmS.a); // (render r-refl)\r
radiance *= (1.0 - 0.4 * cg * gSash) /* (textures r4) 0.72 -> 0.4 */ * mix(1.0, gSashV, cg * gSash); // (street r11) per-window reflectance // (street r10) old sash glass in a canyon: dim, dusty reflections (dark holes, not pale panes)\r
}\r
}\r
#endif\r
`,le=`in vec4 aF;\r
in vec4 aS;\r
in vec4 aW;\r
in vec4 aX;\r
in vec3 aTint;\r
out vec2 vFac;\r
flat out vec4 vF;\r
flat out vec4 vS;\r
flat out vec4 vW;\r
flat out vec4 vX;\r
flat out vec3 vTint;\r
out vec3 vWPos;\r
out vec3 vWN;\r
`,ue=`vFac = uv;\r
vF = aF;\r
vS = aS;\r
vW = aW;\r
vX = aX;\r
vTint = aTint;\r
vec4 fwp = modelMatrix * vec4(transformed, 1.0);\r
vWPos = fwp.xyz;\r
vWN = normalize(mat3(modelMatrix) * objectNormal);\r
`,de=`uniform highp sampler2DArray tWallC;\r
uniform highp sampler2DArray tWallN;\r
uniform highp sampler2DArray tWallH;\r
uniform sampler2D tDetail;\r
uniform sampler2D tInterior;\r
uniform sampler2D tSigns;\r
uniform sampler2D tNoise;\r
uniform float uInteriorGain;\r
uniform float uShopGain;\r
uniform float uNightK;\r
uniform float uDnTime; // (daynight)\r
// (night) landmark crown floodlights (addCrownFlood): per flood A = lit box x0,z0,x1,z1; B = y0 (terrace), y1, reach\r
// (m), pad; C = rgb x gain. uFlBB: union box (x0, z0, x1, z1), uFlY: lowest y0, count\r
uniform vec4 uFl[__SHADER_INJECT_0__];\r
uniform vec4 uFlBB;\r
uniform vec2 uFlY;\r
vec3 crownFlood(vec3 p, vec3 n) {\r
  vec3 E = vec3(0.0);\r
  if(uFlY.y < 0.5 || p.y < uFlY.x - 0.5 || p.x < uFlBB.x || p.z < uFlBB.y || p.x > uFlBB.z || p.z > uFlBB.w)\r
    return E;\r
  for(int i = 0; i < __SHADER_INJECT_1__; i++) {\r
    if(float(i) >= uFlY.y)\r
      break;\r
    vec4 A = uFl[i * 3], B = uFl[i * 3 + 1], C = uFl[i * 3 + 2];\r
    if(p.y < B.x - 0.3 || p.y > B.y || p.x < A.x - B.w || p.x > A.z + B.w || p.z < A.y - B.w || p.z > A.w + B.w)\r
      continue;\r
    float h = B.z > 0.0 ? p.y - B.x : B.y - p.y; // reach < 0: spill falling off DOWNWARD from y1 (under a lit lip)\r
    float rz = abs(B.z);\r
    // fixtures on the terrace aimed up the face: brightest just above the setback, a long soft falloff, a scallop per\r
    // fixture along the face (4 m pitch); soffits / ledge undersides catch it, terrace floors a little\r
    float along = abs(n.x) > 0.5 ? p.z : p.x;\r
    float sc = 0.8 + 0.2 * cos(along * 1.5708) * exp(-h / (0.6 * rz));\r
    float f = (0.01 + 0.99 * exp(-h / rz)) * smoothstep(-0.3, 0.4, h) * sc; // (critic r1/r3) a 3-4 m up-light band at each setback lip, ~20 % by the next setback\r
    if(C.w > 0.0) {\r
      float sp = max(cos(along * 6.2832 / C.w), 0.0);\r
      f *= 0.25 + 0.75 * sp * sp;\r
    } // (night) vertical flood streaks on the piers, dark mullions between (C.w = pitch m)\r
    E += C.rgb * f * (abs(n.y) < 0.5 ? 1.0 : (n.y < 0.0 ? 0.9 : 0.3));\r
  }\r
  return E;\r
}\r
in vec2 vFac;\r
flat in vec4 vF;\r
flat in vec4 vS;\r
flat in vec4 vW;\r
flat in vec4 vX;\r
flat in vec3 vTint;\r
in vec3 vWPos;\r
in vec3 vWN;\r
\r
float fh1(vec2 p) {\r
  p = fract(p * vec2(123.34, 456.21));\r
  p += dot(p, p + 45.32);\r
  return fract(p.x * p.y);\r
}\r
float fh1b(vec3 p) {\r
  return fh1(p.xy + p.z * 17.13);\r
}\r
// (night) integer hash (lowbias32), mirrored bit-exactly in JS (nh3js): lit-window decisions shared with the window-light provider\r
uint nhu(uint x) {\r
  x ^= x >> 16;\r
  x *= 0x7feb352du;\r
  x ^= x >> 15;\r
  x *= 0x846ca68bu;\r
  x ^= x >> 16;\r
  return x;\r
}\r
uint nh3(uint a, uint b, uint c) {\r
  return nhu(a * 73856093u ^ nhu(b * 19349663u ^ nhu(c * 83492791u)));\r
}\r
float nh01(uint h) {\r
  return float(h >> 8) / 16777216.0;\r
}\r
float layerScale(float L) {\r
  if(L > 12.5)\r
    return L < 13.5 ? 3.0 : (L < 14.5 ? 3.0 : 1.8); // (textures r2) terracotta 8 rows / 3 m, stucco, red brick 2 (24 courses)\r
  return L < 2.5 ? 1.8 /* (street r10) 2.4 -> 1.8: finer brick (director: 'brick texel scale reads too big') */ : (L < 3.5 ? 3.0 : (L < 4.5 ? 4.0 : (L < 5.5 ? 3.0 : (L < 6.5 ? 2.0 : (L < 7.5 ? 2.4 : (L < 8.5 ? 8.0 : (L < 9.5 ? 4.0 : (L < 10.5 ? 8.0 : (L < 11.5 ? 8.0 : 4.0)))))))));\r
}\r
// relief depth (m) of each layer's height map, for parallax\r
float layerDepth(float L) {\r
  if(L > 12.5)\r
    return L < 13.5 ? 0.008 : (L < 14.5 ? 0.004 : 0.014); /* (textures r2) */ \r
  return L < 2.5 ? 0.014 : (L < 3.5 ? 0.01 : (L < 4.5 ? 0.008 : (L < 7.5 ? 0.004 : (L < 8.5 ? 0.006 : (L < 9.5 ? 0.02 : (L < 10.5 ? 0.004 : (L < 11.5 ? 0.008 : 0.02)))))));\r
}\r
vec3 gVt = vec3(0.0, 0.0, 1.0);\r
float gPar = 0.0;\r
float gDet = 0.0;\r
vec2 gOff = vec2(0.0);\r
struct Surf {\r
  vec3 alb;\r
  float rough;\r
  float metal;\r
  vec3 n;\r
  vec3 emis;\r
};\r
vec2 gDx, gDy;\r
float gLodI;\r
float gGlass = 0.0;\r
float gF0 = 0.04; // coated-glass reflectance weight/value // screen-space UV gradients (computed in uniform control flow)\r
float gWeather = 0.0;\r
Surf wallSurf(vec2 uvm, float L, vec3 tint) {\r
  float s = layerScale(L);\r
  vec2 uv = (uvm + gOff) / s;\r
  vec2 dx = gDx / s, dy = gDy / s;\r
  // (textures r3) limestone ashlar (L3): the 3 m tile's 6 courses repeat block-for-block on close walls. Each course\r
  // (bed joints measured in walls_col layer 3: v' = fract(v - 0.1455) at 0/.1694/.3398/.5097/.6797/.8301) gets its own\r
  // random slide along the wall (the seam hides in the bed joint) and each block (head joints: even courses 0.6367, odd\r
  // 0.3174 / 0.955) its own tone, so no two courses or blocks line up across tiles. Pure UV math, no texture tap.\r
  float lsTone = 1.0;\r
  vec3 lsHue = vec3(1.0);\r
  if(L > 2.5 && L < 3.5) {\r
    float vp = uv.y - 0.1455, fy = fract(vp);\r
    float ri = fy < 0.1694 ? 0.0 : (fy < 0.3398 ? 1.0 : (fy < 0.5097 ? 2.0 : (fy < 0.6797 ? 3.0 : (fy < 0.8301 ? 4.0 : 5.0))));\r
    float g = floor(vp) * 6.0 + ri;\r
    vec2 bs = gOff * 3.17 + vec2(g * 0.713, g * 1.37);\r
    uv.x += fh1(bs);\r
    float odd = mod(ri, 2.0);\r
    float tx = uv.x - (odd > 0.5 ? 0.3174 : 0.6367);\r
    float bk = odd > 0.5 ? floor(tx) * 2.0 + step(0.6376, fract(tx)) : floor(tx);\r
    float h1 = fh1(bs + vec2(bk * 0.917, 3.3)), h2 = fh1(bs + vec2(5.1, bk * 1.31));\r
    lsTone = 0.86 + 0.2 * h1;\r
    lsHue = mix(vec3(1.0), h2 > 0.5 ? vec3(1.04, 1.0, 0.93) : vec3(0.95, 0.97, 1.0), abs(h2 - 0.5) * 1.6);\r
  }\r
  // parallax offset from the baked height (close range only; 2 taps: coarse + refine)\r
  vec3 hao = textureGrad(tWallH, vec3(uv, L), dx, dy).rgb;\r
  if(gPar > 0.0) {\r
    vec2 pv = gVt.xy / max(gVt.z, 0.35) * layerDepth(L) / s * gPar;\r
    vec2 uv1 = uv + pv * (hao.r - 0.55);\r
    hao = textureGrad(tWallH, vec3(uv1, L), dx, dy).rgb;\r
    uv = uv + pv * (hao.r - 0.55);\r
  }\r
  // footprint (texels per pixel): when the mortar / gravel period nears 2-4 px, pre-filter a little harder, lower the\r
  // pattern contrast toward the layer average and convert lost normal variance into roughness (Toksvig-style)\r
  float tpp = min(length(dx), length(dy)) * 1024.0; // minor footprint axis: the major axis at grazing angles is anisotropic filtering's job\r
  float fl = smoothstep(3.0, 10.0, tpp);\r
  dx *= 1.0 + 0.3 * fl;\r
  dy *= 1.0 + 0.3 * fl;\r
  vec3 c = textureGrad(tWallC, vec3(uv, L), dx, dy).rgb;\r
  vec3 d = textureGrad(tWallN, vec3(uv, L), dx, dy).rgb;\r
  vec3 cAvg = textureLod(tWallC, vec3(0.5, 0.5, L), 10.0).rgb;\r
  c = mix(c, cAvg, 0.15 * fl); // light touch: the mips already average the mortar\r
  // one coherent, weathered-muted palette (user feedback): pull every layer toward its own average (-15 % contrast)\r
  // and desaturate 18 %, keeping the layer's brightness\r
  c = mix(cAvg, c, 0.85);\r
  c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 0.82);\r
  c *= lsTone * lsHue; // (textures r3) per-block limestone tone\r
  // (textures) building-scale weathering the 1.8 m brick tile cannot carry without repeating (refs/city3 street_curvedcurb):\r
  // peeling whitewash / old paint left on the brick faces (mortar shows through), darker re-pointed / patched brick areas,\r
  // and blotchy stains on stone + concrete. World-space macro noise per building (gOff), no extra texture fetch but two\r
  // lod-0 noise taps.\r
  if(L < 4.5 || L > 12.5 || (L > 6.5 && L < 7.5)) { // (textures r2) + terracotta / stucco / red brick 2 / white brick (critic: 'white brick clean')\r
    vec2 wq = uvm + gOff * 13.0;\r
    vec3 n1 = textureLod(tNoise, wq / vec2(17.0, 11.0), 0.0).rgb;\r
    vec3 n2 = textureLod(tNoise, wq / vec2(2.3, 1.7) + 0.37, 0.0).rgb;\r
    float face = smoothstep(0.3, 0.62, hao.r);\r
    if(L < 2.5 || L > 14.5) {\r
      float bsel = fract(gOff.x * 7.13 + gOff.y * 3.1); // only ~1 in 3 brick buildings carries old paint\r
      float pAmt = (L < 0.5 || L > 14.5 ? 1.0 : (L < 1.5 ? 0.6 : 0.4)) * step(bsel, 0.25); // (textures r2) 0.35 -> 0.25 of brick buildings\r
      float paint = smoothstep(0.76, 0.86, n1.r + 0.05 * (n2.g - 0.5)) * pAmt; // (textures r5) softer, fewer: 'noisy white speckle' // (textures r2) 0.7 -> 0.74: read as leprous speckle\r
      vec3 pc = vec3(0.68, 0.66, 0.62) * (0.88 + 0.16 * n2.b);\r
      c = mix(c, mix(pc, c, 0.3), paint * mix(0.5, 1.0, face) * 0.42); // (textures r5) 0.6 -> 0.42\r
      float rep = smoothstep(0.7, 0.76, n1.g + 0.15 * (n2.r - 0.5));\r
      c *= mix(vec3(1.0), vec3(1.02, 0.9, 0.86) * 0.86, rep * face);\r
      c *= 1.0 - 0.1 * smoothstep(0.55, 0.8, n1.b) * (1.0 - face * 0.5); // dirty mortar patches\r
    } else {\r
      float st = smoothstep(0.55, 0.85, n1.g * 0.8 + n2.r * 0.35);\r
      c *= 1.0 - 0.16 * st;\r
      c = mix(c, c * vec3(1.03, 1.0, 0.94), smoothstep(0.6, 0.8, n1.r) * 0.6);\r
    }\r
  }\r
  // (textures r4) critic: 'brick washed out, too much sheen, weak mortar'. Brick: darker recessed mortar (height-driven,\r
  // fades once the joints are sub-pixel), matte faces with per-brick roughness breakup; all masonry gets a stronger relief\r
  // normal at close / mid range so walls stop reading as printed images\r
  bool brickL = L < 2.5 || L > 14.5 || (L > 6.5 && L < 7.5);\r
  bool masonL = L < 4.5 || L > 5.5 && L < 8.0 || L > 12.5;\r
  if(brickL)\r
    c *= mix(mix(0.62, 0.8, fl), 1.0, smoothstep(0.28, 0.55, hao.r));\r
  float rbk = textureLod(tNoise, uv * vec2(9.0, 22.0) + 0.3, 0.0).g; // per-brick-ish roughness breakup\r
  Surf o;\r
  o.alb = c * tint * mix(1.0, hao.g, 0.7 * (1.0 - 0.3 * fl));\r
  o.rough = min(1.0, d.b + 0.12 * fl);\r
  o.metal = (L > 4.5 && L < 5.5) ? 0.6 : 0.0;\r
  if(masonL)\r
    o.rough = clamp(max(o.rough, 0.74) + 0.18 * (rbk - 0.5), 0.6, 1.0);\r
  vec2 nxy = (d.rg * 2.0 - 1.0) * (1.0 - 0.5 * fl) * (masonL ? 1.0 + 0.7 * (1.0 - fl) : 1.0); // (textures r4) x1.7 relief\r
  if(gDet > 0.0) { // micro detail normal (0.5 m tile) close to the camera\r
    vec2 dn = textureGrad(tDetail, uvm * 2.0, gDx * 2.0, gDy * 2.0).rg * 2.0 - 1.0;\r
    nxy += dn * gDet * (L > 4.5 && L < 7.5 ? 0.25 : 0.6);\r
  }\r
  o.n = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));\r
  o.emis = vec3(0.0);\r
  gWeather = hao.b;\r
  return o;\r
}\r
// (textures r2) grime / leak decal sheet ($imagegen, walls_hao layer 16): R, G, B each hold 8 columns of vertical\r
// streak masks (1 = soot) whose source is at the top. q.x 0..1 across the decal, q.y 0 (source) .. 1 (fade end); g = dq\r
// per unit of vFac (screen gradients come from gDx / gDy, computed in uniform control flow)\r
float grimeDecal(vec2 q, vec2 g, float id) {\r
  if(q.x <= 0.0 || q.x >= 1.0 || q.y <= 0.0 || q.y >= 1.0)\r
    return 0.0;\r
  float col = mod(id, 8.0), ch = floor(id / 8.0);\r
  vec2 k = vec2(g.x / 8.0, -g.y);\r
  vec3 m = textureGrad(tWallH, vec3((col + clamp(q.x, 0.02, 0.98)) / 8.0, 1.0 - q.y, 16.0), gDx * k, gDy * k).rgb;\r
  return ch < 0.5 ? m.r : (ch < 1.5 ? m.g : m.b);\r
}\r
// AA box mask: 1 inside [a,b] with filter width w\r
// box-filtered coverage of [a,b] over the pixel footprint [x - w/2, x + w/2]: features thinner than a pixel fade to\r
// their true coverage instead of popping between 0 and >= 0.5 (mullion / frame crawl)\r
float boxAA(float x, float a, float b, float w) {\r
  w *= 1.2;\r
  return clamp((min(b, x + 0.5 * w) - max(a, x - 0.5 * w)) / w, 0.0, 1.0);\r
}\r
// skyline: box-filtered coverage of the PERIODIC interval [a,b] + k*p over [x - w/2, x + w/2] (exact integral of the\r
// periodic step). Resolves window rows / piers at any distance and converges to the true average (b-a)/p once the\r
// period is sub-pixel -> distant towers keep their floor bands and pier lines instead of turning into flat boxes.\r
float pInt(float x, float p, float a, float b) {\r
  float k = floor(x / p);\r
  return k * (b - a) + clamp(x - k * p - a, 0.0, b - a);\r
}\r
float pbox(float x, float p, float a, float b, float w) {\r
  w = max(w, 1e-4);\r
  return clamp((pInt(x + 0.5 * w, p, a, b) - pInt(x - 0.5 * w, p, a, b)) / w, 0.0, 1.0);\r
}\r
vec3 gSpecTint = vec3(1.0); // coated-glass reflection tint (curtain walls)\r
float gSash = 0.0; // (street r9) old masonry sash glass: lower grazing (F90) reflectance\r
float gSashV = 1.0; // (street r11) per-window reflection strength of old sash glass (wavy / dusty / cleaned panes)\r
float gAoT = 0.0; // (night) setback contact shade: the crown flood lights the un-shaded albedo (its band sits right there)\r
float gBlN = 0.0, gCurN = 0.0, gAcN = 0.0, gCovN = 0.0; // (night) blind / curtain / AC-unit masks, far-LOD glass coverage\r
vec2 gWob = vec2(0.0); // (skyline r5) low-frequency curtain-wall panel deflection (wavy, broken reflections at any range)\r
\r
// Interior mapping into a room box [0,rw]x[0,rh]x[-rd,0], entering at p (z=0) along dir (dir.z<0)\r
vec3 interior(vec2 p, vec3 dir, float rw, float rh, float rd, float tile, float lit, float shop) {\r
  vec3 invd = 1.0 / dir;\r
  float tx = dir.x > 0.0 ? (rw - p.x) * invd.x : -p.x * invd.x;\r
  float ty = dir.y > 0.0 ? (rh - p.y) * invd.y : -p.y * invd.y;\r
  float tz = -rd * invd.z;\r
  float t = min(min(tx, ty), tz);\r
  vec3 h = vec3(p, 0.0) + dir * t;\r
  float depth = clamp(-h.z / rd, 0.0, 1.0);\r
  vec2 tileUV = vec2(mod(tile, 4.0), floor(tile / 4.0));\r
  vec3 col;\r
  if(t == tz) {\r
    vec2 q = vec2(h.x / rw, h.y / rh);\r
    if(shop > 0.5 && rw > 4.5) {\r
      float nT = floor(rw / 3.2 + 0.5);\r
      q.x = fract(h.x / rw * nT);\r
    } // (night) wide shop room: the shelving wall tiles every ~3 m\r
    q = clamp(q, 0.01, 0.99);\r
    col = textureLod(tInterior, vec2((tileUV.x + q.x) / 4.0, 1.0 - (tileUV.y + 1.0 - q.y) / 4.0), gLodI).rgb;\r
  } else if(t == ty) {\r
    if(dir.y > 0.0) { // ceiling\r
      vec2 c = vec2(h.x / rw, -h.z / rd);\r
      float panel = step(abs(c.x - 0.5), 0.22) * step(abs(fract(c.y * 2.0) - 0.5), 0.18);\r
      // ceiling tiles + recessed troffers (dim in daylight, soft-edged, fading with room depth so they sit on the ceiling)\r
      float pe = smoothstep(0.26, 0.2, abs(c.x - 0.5)) * smoothstep(0.22, 0.15, abs(fract(c.y * 2.0) - 0.5));\r
      col = vec3(0.72, 0.72, 0.7) * (0.75 + 0.25 * lit) + pe * lit * vec3(0.55, 0.53, 0.48) * (1.0 + shop) * (1.0 - 0.6 * c.y);\r
      if(shop > 0.5)\r
        col *= mix(1.0, 0.5, uNightK); // (night) critic r3: shop ceilings clipped to white panels\r
    } else { // floor\r
      col = shop > 0.5 ? vec3(0.55, 0.52, 0.48) : (tile < 5.5 ? vec3(0.23, 0.24, 0.26) : vec3(0.36, 0.25, 0.17));\r
    }\r
  } else {\r
    col = textureLod(tInterior, vec2((tileUV.x + 0.5) / 4.0, 1.0 - (tileUV.y + 0.6) / 4.0), 7.0).rgb * (dir.x > 0.0 ? 0.8 : 0.7);\r
    if(shop > 0.5)\r
      col *= mix(1.0, 0.5, uNightK); // (night) shop side walls: flat mip colour, keep them subordinate to the lit shelving\r
    if(uNightK > 0.5) { // (night) side walls seen through lit windows at a grazing angle: real content (the tile's furniture /\r
      // shelving mapped along the room depth, darker, mirrored) and a lamp-light falloff from the window wall, not a flat mip\r
      vec2 sq2 = clamp(vec2(fract(-h.z / max(rd, 0.1) * 1.3), h.y / rh), 0.02, 0.98);\r
      vec3 sc2 = textureLod(tInterior, vec2((tileUV.x + (dir.x > 0.0 ? sq2.x : 1.0 - sq2.x)) / 4.0, 1.0 - (tileUV.y + 1.0 - sq2.y) / 4.0), gLodI + 1.0).rgb;\r
      col = sc2 * (dir.x > 0.0 ? 0.62 : 0.55) * (shop > 0.5 ? 0.8 : 1.0) * (0.75 + 0.35 * smoothstep(0.0, 1.0, h.y / rh));\r
    }\r
    col *= mix(0.7, 1.0, clamp(h.y / rh, 0.0, 1.0));\r
  }\r
  col *= mix(1.0, 0.55, depth);\r
  return col * mix(0.55, 1.0, lit);\r
}\r
\r
void facade(out Surf o) {\r
  vec3 N = normalize(vWN);\r
  gDx = dFdx(vFac);\r
  gDy = dFdy(vFac);\r
  o.alb = vec3(0.0);\r
  o.rough = 1.0;\r
  o.metal = 0.0;\r
  o.n = N;\r
  o.emis = vec3(0.0);\r
  float roofL = 8.0;\r
  float Lw = mod(vS.x, 16.0);\r
  float Lb = mod(floor(vS.x / 16.0 + 0.01), 16.0);\r
  float tierY = floor(vS.x / 256.0 + 0.001); // (skyline r12) base height of this set-back tier (0 = street mass)\r
  float style = vS.w + 0.01;\r
  float seed = vS.y;\r
  vec3 tint = vTint;\r
  // (textures r2) extra wall materials without touching the zoning code: a per-building hash re-skins some walls\r
  // (texture layer only; Lw keeps driving the zoning logic): ~45 % of red brick -> orange-red common-bond tenement brick,\r
  // the warm 'ochre' limestone + some buff brick -> terracotta ashlar, some low concrete / white-brick walls -> stucco\r
  float LwT = Lw;\r
  {\r
    float vq = fract(seed * 9.271 + 0.137);\r
    if(Lw < 0.5 && vq < 0.45)\r
      LwT = 15.0;\r
    else if((Lw > 2.5 && Lw < 3.5 && vTint.r - vTint.b > 0.18 && vq < 0.8) || (Lw > 1.5 && Lw < 2.5 && vq < 0.18))\r
      LwT = 13.0;\r
    else if(((Lw > 3.5 && Lw < 4.5) || (Lw > 6.5 && Lw < 7.5)) && vW.y - vW.z < 30.0 && vq < 0.4)\r
      LwT = 14.0;\r
    // (textures r4) critic: 'pale buff brick on every building; push brick reds / browns'. Some buff walls become\r
    // sooty brown or orange-red common brick (texture only; the zoning family / tint is kept)\r
    else if(Lw > 1.5 && Lw < 2.5 && vq >= 0.18 && vq < 0.36)\r
      LwT = 1.0;\r
    else if(Lw > 1.5 && Lw < 2.5 && vq >= 0.36 && vq < 0.5)\r
      LwT = 15.0;\r
  }\r
  // large-scale grime/tone variation\r
  vec3 nz = textureLod(tNoise, vWPos.xz / 180.0 + vWPos.y / 300.0, 0.0).rgb;\r
  vec3 nz2 = textureLod(tNoise, vWPos.xz / 23.0 + vWPos.y / 41.0 + 0.5, 0.0).rgb; // mid-scale macro variation (kills tiling)\r
  float camD = length(cameraPosition - vWPos);\r
  gPar = 1.0 - smoothstep(12.0, 35.0, camD);\r
  gDet = 1.0 - smoothstep(6.0, 22.0, camD);\r
  gOff = vec2(fract(seed * 0.618), fract(seed * 0.377)) * 8.0; // per-building texture offset: neighbours never tile in lockstep\r
  vec3 V = normalize(cameraPosition - vWPos);\r
  if(N.y > 0.5) {\r
    gVt = vec3(V.x, -V.z, V.y);\r
    vec3 rt = tint * (0.8 + 0.4 * nz.r) * (0.9 + 0.2 * nz2.g);\r
    // (textures r5) critic: 'flat pale-grey roof slabs' (uncovered roofs on the membrane layer 10: mean 0.71, almost no\r
    // detail) and 'untextured black box' (metal-panel bulkhead tops, layer 5). Per-building roof family: seamed dark\r
    // mod-bit, warm gravel ballast, buff pavers, or a dirtier grey membrane; metal bulkhead tops get rolled roofing.\r
    {\r
      float rq = fract(seed * 7.13 + 0.41);\r
      if(Lw > 9.5 && Lw < 10.5) {\r
        if(rq < 0.3) {\r
          Lw = 8.0;\r
          rt *= 1.3;\r
        } else if(rq < 0.52) {\r
          Lw = 9.0;\r
          rt *= vec3(1.08, 0.98, 0.86);\r
        } else if(rq < 0.64) {\r
          Lw = 11.0;\r
          rt *= vec3(1.02, 0.93, 0.84);\r
        } else\r
          rt *= 0.66 * vec3(1.0, 0.97, 0.93);\r
      } else if(Lw > 4.5 && Lw < 5.5) {\r
        Lw = 8.0;\r
        rt = vec3(1.25, 1.24, 1.2) * (0.9 + 0.2 * nz2.g);\r
      }\r
    }\r
    o = wallSurf(vFac, Lw, rt);\r
    // roofs: dirt collects near parapets/edges is handled by AO; add broad wet/dirty patches\r
    if(Lw > 7.5) {\r
      o.alb *= 1.0 - 0.25 * smoothstep(0.55, 0.85, nz2.b);\r
      o.rough = mix(o.rough, 0.55, smoothstep(0.6, 0.9, nz2.b) * gWeather);\r
    }\r
    if(Lw > 7.5 && gDet > 0.0) { // close range: 3.7x rotated re-sample of the same roof layer sharpens granules / gravel\r
      float sc = layerScale(Lw) / 3.7;\r
      mat2 R = mat2(0.8, -0.6, 0.6, 0.8);\r
      vec3 dcol = textureGrad(tWallC, vec3(R * vFac / sc + 0.31, Lw), R * gDx / sc, R * gDy / sc).rgb;\r
      float la = dot(textureLod(tWallC, vec3(0.5, 0.5, Lw), 10.0).rgb, vec3(0.333));\r
      o.alb *= mix(1.0, clamp(dot(dcol, vec3(0.333)) / max(la, 0.02), 0.6, 1.5), 0.45 * gDet);\r
    }\r
    // (textures r3) critic: 'flat roofs uniform dark grey with fine noise, no seams, tar patches, flashing, drains'.\r
    // World-space roof wear, all analytic (no texture tap), box-filtered by the pixel footprint so it resolves from the\r
    // rooftops to the aerial view: rolled-roofing lap seams (bitumen / membrane, 0.95 m strips, staggered end laps),\r
    // sharp-edged glossy tar repairs, roof drains with a dark silt ring, and ponding tide-lines in the low spots.\r
    if(Lw > 7.5 && Lw < 11.5) {\r
      vec2 rp = vFac + gOff * 7.0;\r
      float fw = max(length(gDx), length(gDy)) + 1e-4;\r
      bool rot = fract(seed * 3.71) > 0.5;\r
      vec2 sp = rot ? rp.yx : rp;\r
      if(Lw < 8.5 || (Lw > 9.5 && Lw < 10.5)) {\r
        float sw = 0.95, si = floor(sp.y / sw), sf = sp.y - si * sw;\r
        float lap = pbox(sp.y, sw, 0.0, 0.05, fw);\r
        float bleed = pbox(sp.y, sw, 0.05, 0.13, fw);\r
        float endL = 9.0 + 3.0 * fh1(vec2(si, seed)), ex = sp.x + fh1(vec2(seed, si)) * endL;\r
        float endLap = pbox(ex, endL, 0.0, 0.06, fw) * boxAA(sf, 0.05, sw, fw);\r
        float stripT = 0.94 + 0.12 * fh1(vec2(si, floor(ex / endL) + seed));\r
        float fade = 1.0 - smoothstep(0.06, 0.25, fw); // seams dissolve into the average once sub-pixel\r
        o.alb *= mix(1.0, stripT, fade);\r
        o.alb *= 1.0 - (Lw < 8.5 ? 0.3 : 0.2) * max(lap, endLap) * fade;\r
        o.alb *= 1.0 + (Lw < 8.5 ? 0.12 : -0.06) * bleed * fade;\r
        o.rough = mix(o.rough, 0.45, lap * fade * 0.6);\r
      }\r
      // tar repairs: ~1 per 3 cells of 6 x 7 m, 0.5-2.4 m, jagged-ish edges from the noise\r
      vec2 cg = vec2(6.0, 7.0), ci = floor(rp / cg), cf = rp - ci * cg;\r
      float h1 = fh1(ci + seed * 0.13), h2 = fract(h1 * 71.3 + 0.2), h3 = fract(h1 * 13.7 + 0.6);\r
      if(h1 < 0.36) {\r
        vec2 hs = vec2(0.25 + 1.0 * h2, 0.25 + 0.9 * h3), cc = vec2(1.3 + 3.4 * h3, 1.3 + 4.4 * h2);\r
        vec2 dq = abs(cf - cc) - hs;\r
        float dd = max(dq.x, dq.y) + 0.12 * (nz2.r - 0.5);\r
        float inT = 1.0 - smoothstep(-fw, fw, dd);\r
        o.alb = mix(o.alb, vec3(0.055, 0.052, 0.05) * (0.8 + 0.4 * nz2.g), inT * 0.85);\r
        o.rough = mix(o.rough, 0.32, inT);\r
      }\r
      // drains: one per 12 x 11 m cell (inset from the cell edge), dark grate + silt ring\r
      vec2 dg = vec2(12.0, 11.0), di = floor(rp / dg), df = rp - di * dg;\r
      vec2 dc = vec2(3.0, 3.0) + vec2(fh1(di + 7.1), fh1(di + 3.3)) * vec2(6.0, 5.0);\r
      float dr = length(df - dc);\r
      float silt = 1.0 - smoothstep(0.15, 1.1 + 0.4 * nz2.b, dr);\r
      o.alb *= 1.0 - 0.3 * silt;\r
      o.alb = mix(o.alb, vec3(0.03), 1.0 - smoothstep(0.13 - fw, 0.13 + fw, dr));\r
      o.rough = mix(o.rough, 0.4, silt * 0.7);\r
      // ponding: darker damp low spots with a pale dried tide-line at their edge\r
      float pn = textureLod(tNoise, rp / 9.0 + 0.71, 0.0).g * 0.7 + nz2.b * 0.3;\r
      float pond = smoothstep(0.62, 0.7, pn);\r
      float tide = (1.0 - smoothstep(0.0, 0.012 + fw * 0.05, abs(pn - 0.62))) * (1.0 - smoothstep(0.1, 0.4, fw));\r
      o.alb *= (1.0 - 0.18 * pond) * (1.0 + 0.25 * tide);\r
      o.rough = mix(o.rough, 0.5, pond * 0.5);\r
    }\r
    return;\r
  }\r
  if(N.y < -0.5) {\r
    o = wallSurf(vFac, LwT, tint * 0.6);\r
    return;\r
  } // (textures r2) LwT\r
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));\r
  vec3 Vt = vec3(dot(V, T), V.y, max(dot(V, N), 0.06));\r
  gVt = vec3(Vt.x, Vt.y, dot(V, N));\r
  vec3 dirIn = vec3(-Vt.x, -Vt.y, -Vt.z);\r
  float u = vFac.x;\r
  float y = vFac.y - vW.z;\r
  float faceW = vW.x;\r
  float topY = vW.y - vW.z;\r
  float aw = max(fwidth(u), 1e-4);\r
  float ah = max(fwidth(vFac.y), 1e-4);\r
  gLodI = clamp(log2(max(aw, ah) * 512.0 / max(vF.y, 2.0)) + 0.5, 0.0, 9.0);\r
  float gHs = vS.z;\r
  float gH = abs(gHs);\r
  // base wall\r
  // (skyline r5) per-building colour identity (value +-9 %, warm / cool shift) + broad soot blotches, so neighbouring\r
  // blocks of the same layer never read as one repeated atlas\r
  float bv = fract(seed * 13.73 + 0.29), bh = fract(seed * 5.91 + 0.61) * 2.0 - 1.0;\r
  vec3 bTone = (0.91 + 0.18 * bv) * vec3(1.0 + 0.045 * bh, 1.0 + 0.008 * bh, 1.0 - 0.05 * bh);\r
  // (textures r4) per-building masonry identity: brick walls get one of cream / buff / grey / tan / red-brown casts and a\r
  // -10..-25 % value drop (critic: 'brick bright, washed-out, the same on every building')\r
  bool brickW = LwT < 2.5 || LwT > 14.5 || (LwT > 6.5 && LwT < 7.5);\r
  if(brickW) {\r
    float pq = fract(seed * 17.31 + 0.53);\r
    vec3 bCast = pq < 0.2 ? vec3(0.9, 0.9, 0.92) : (pq < 0.4 ? vec3(1.04, 0.95, 0.84) : (pq < 0.55 ? vec3(1.08, 0.9, 0.8) : (pq < 0.7 ? vec3(0.96, 0.97, 0.98) * 0.92 : vec3(1.0))));\r
    bTone *= bCast * (0.95 - 0.13 * fract(seed * 29.7));\r
  } else if(LwT < 4.5 || LwT > 12.5)\r
    bTone *= 0.93 - 0.08 * fract(seed * 29.7);\r
  o = wallSurf(vec2(u, vFac.y), LwT /* (textures r2) */, tint * bTone * (0.88 + 0.24 * nz.g) * (0.93 + 0.14 * nz2.r) * (1.0 - 0.14 * smoothstep(0.5, 0.85, nz.b)));\r
  // ground grime & soot, dark drip band under the coping / cornice, wet-looking streak roughness\r
  o.alb *= mix(0.72, 1.0, smoothstep(0.0, 2.5, y));\r
  if(style < 1.5 || style > 2.5) {\r
    // (textures r4) heavy large-scale weathering (critic: 'repeating AO smudges, clean facades'):\r
    //  - street grime: sooty value + desaturation rising 4-12 m from the pavement, ragged top edge\r
    //  - water staining under the coping / cornice: long dark streak columns 3-14 m, some greenish\r
    //  - soot: per-building amount; big blotches weighted to the upper floors and the building corners\r
    vec3 wn = textureGrad(tNoise, vec2(u * 0.08 + seed * 0.71, y * 0.05), gDx * vec2(0.08, 0.0), gDy * vec2(0.0, 0.05)).rgb;\r
    float gTop = 4.0 + 8.0 * fract(seed * 3.77) + 3.0 * (wn.r - 0.5);\r
    float sg = (1.0 - smoothstep(0.0, gTop, y)) * (0.6 + 0.4 * wn.g);\r
    vec3 sootC = vec3(0.34, 0.32, 0.3);\r
    o.alb = mix(o.alb, o.alb * sootC * 1.5, 0.55 * sg);\r
    float colN = textureGrad(tNoise, vec2(u * 0.55 + seed * 1.3, 0.37), gDx * vec2(0.55, 0.0), gDy * vec2(0.55, 0.0)).b;\r
    float runL = 3.0 + 11.0 * colN;\r
    float dTop = topY - y;\r
    float stain = smoothstep(0.45, 0.75, colN) * (1.0 - smoothstep(0.0, runL, dTop)) * (0.65 + 0.35 * wn.b);\r
    vec3 stC = mix(vec3(0.5, 0.48, 0.46), vec3(0.46, 0.5, 0.45), step(0.7, fract(seed * 5.5)));\r
    o.alb = mix(o.alb, o.alb * stC, stain * 0.8);\r
    o.rough = mix(o.rough, 0.55, stain * 0.5);\r
    float sootAmt = fract(seed * 41.3);\r
    sootAmt = sootAmt * sootAmt;\r
    vec3 sn = textureGrad(tNoise, vec2(u, y) * 0.035 + seed * 0.19, gDx * 0.035, gDy * 0.035).rgb;\r
    float corner = 1.0 - smoothstep(0.0, 3.0, min(u, faceW - u));\r
    float soot = smoothstep(0.45, 0.8, sn.r + 0.25 * corner + 0.2 * smoothstep(0.3, 1.0, y / max(topY, 1.0))) * (0.3 + 0.7 * sootAmt);\r
    o.alb *= 1.0 - 0.24 * soot; // (textures r5) 0.38 -> 0.24: under lighting2 r3's contrast the blotches read as camouflage\r
  }\r
  if(style < 1.5 || style > 2.5) { // (textures r2) decal-sheet splash grime rising from the pavement + leaks from the coping\r
    float gs = 2.6, gi = floor(u / gs), gr = fh1(vec2(gi + seed * 1.7, seed * 5.3));\r
    float gSp = grimeDecal(vec2(u / gs - gi, y / (0.9 + 1.6 * gr)), vec2(1.0 / gs, 1.0 / (0.9 + 1.6 * gr)), floor(gr * 24.0));\r
    o.alb *= 1.0 - 0.3 * gSp;\r
    float gLen = 3.0 + 10.0 * fract(gr * 7.3);\r
    float gCo = grimeDecal(vec2(u / gs - gi, (topY - 0.2 - y) / gLen), vec2(1.0 / gs, 1.0 / gLen), floor(fract(gr * 3.7) * 24.0));\r
    o.alb *= 1.0 - 0.34 * gCo * step(0.3, fract(gr * 11.1));\r
  }\r
  float drip = (1.0 - smoothstep(0.0, 3.0, topY - y)) * (0.5 + 0.5 * textureGrad(tNoise, vec2(u * 0.35, 0.3 * seed), gDx * vec2(0.35, 0.0), gDy * vec2(0.35, 0.0)).g);\r
  o.alb *= 1.0 - 0.22 * drip;\r
  o.rough = clamp(o.rough - 0.08 * gWeather, 0.05, 1.0);\r
  // (skyline r2) long vertical rain / soot streaks (0.5-3 m wide, tens of metres long), strongest under the coping and\r
  // setback ledges, plus a soft value gradient (tall walls darken toward the street, the top floors wash out slightly)\r
  if(style < 1.5 || style > 2.5) {\r
    vec2 sq = vec2(u * 0.0045 + seed * 0.37, vFac.y * 0.0009);\r
    float stk = textureGrad(tNoise, sq, gDx * vec2(0.0045, 0.0009), gDy * vec2(0.0045, 0.0009)).g;\r
    float stk2 = textureGrad(tNoise, sq * vec2(3.1, 1.3) + 0.21, gDx * vec2(0.014, 0.0012), gDy * vec2(0.014, 0.0012)).b;\r
    float under = 0.45 + 0.55 * (1.0 - smoothstep(0.0, 26.0, topY - y));\r
    o.alb *= 1.0 - (0.2 * smoothstep(0.52, 0.8, stk) + 0.1 * smoothstep(0.55, 0.85, stk2)) * under;\r
    o.alb *= mix(0.86, 1.04, smoothstep(0.0, 70.0, y));\r
    // (skyline r9) critic: 'hero tower reads as a clean smooth extrusion, no weathering / grime streaks'. Pier-scale soot\r
    // runs (2-6 m wide, 60-200 m long) washing down from every coping / setback, and a sooty band just under each ledge\r
    if(topY > 40.0) {\r
      vec2 gq9 = vec2(u * 0.19 + seed * 0.53, vFac.y * 0.006);\r
      vec2 gd9 = vec2(0.19, 0.006);\r
      float g1 = textureGrad(tNoise, gq9, gDx * gd9, gDy * gd9).r;\r
      float g2 = textureGrad(tNoise, gq9 * vec2(2.3, 0.6) + 0.37, gDx * gd9 * vec2(2.3, 0.6), gDy * gd9 * vec2(2.3, 0.6)).g;\r
      float under2 = 0.35 + 0.65 * (1.0 - smoothstep(0.0, 45.0, topY - y));\r
      o.alb *= 1.0 - 0.2 * smoothstep(0.42, 0.78, 0.6 * g1 + 0.4 * g2) * under2;\r
      o.alb *= 1.0 - 0.14 * (1.0 - smoothstep(0.0, 5.0, topY - y));\r
    }\r
  }\r
  if(style > 5.5) { // ---- skyline: stainless crown tier with a sunburst arch of triangular windows (Chrysler-like)\r
    float h = max(topY, 1.0);\r
    float ex = (u - 0.5 * faceW) / (0.5 * faceW), ey = (y + 0.3 * h) / (1.25 * h);\r
    float e = length(vec2(ex, ey)), fw = fwidth(e) + 1e-4;\r
    float ray = fract(atan(max(ey, 0.0), ex) / 3.14159265 * 9.0);\r
    float band = smoothstep(0.6 - fw, 0.6 + fw, e) * (1.0 - smoothstep(0.98 - fw, 0.98 + fw, e));\r
    float tw = clamp((0.95 - e) / 0.32, 0.0, 1.0) * 0.75;\r
    float tri = band * (1.0 - smoothstep(tw - 0.06, tw + 0.06, abs(ray - 0.5) * 2.0)) * smoothstep(0.62, 0.66, e);\r
    float rim = 1.0 - smoothstep(0.0, 2.5 * fw, abs(e - 0.99));\r
    Surf s = o;\r
    // (skyline r2) true stainless (Nirosta) reflectance: bright F0 ~0.55, brushed, so the crown flashes sky / sun\r
    vec3 ss = vec3(0.56, 0.575, 0.6) * (0.9 + 0.2 * nz2.r);\r
    s.alb = ss * mix(0.82, 1.1, band) * (1.0 - 0.35 * rim);\r
    s.metal = 0.95;\r
    s.rough = 0.2 + 0.1 * nz2.g;\r
    s.alb = mix(s.alb, vec3(0.03, 0.034, 0.04), tri);\r
    s.rough = mix(s.rough, 0.08, tri);\r
    s.metal = mix(s.metal, 0.0, tri);\r
    s.emis = vec3(0.0);\r
    s.n = normalize(vec3(0.0, 0.3 * band - 0.4 * rim, 1.0));\r
    s.emis = tri * vec3(0.85, 0.92, 1.0) * 1.6 * uNightK;\r
    gGlass = tri;\r
    gF0 = 0.1; // (night) the sunburst's triangular windows glow white (Chrysler crown)\r
    o = s;\r
    return;\r
  }\r
  if(style > 4.5) { // ---- party wall: common brick (whatever the street face is), weathering, demolished-neighbour\r
    // parge coat + flashing line, faded ghost-sign paint\r
    float r1 = fract(seed * 3.713), r2 = fract(seed * 7.137), r3 = fract(seed * 11.31);\r
    float Lp = r3 < 0.3 ? 0.0 : (r3 < 0.6 ? 15.0 : 1.0); // (textures r2) + common-bond red brick 2\r
    o = wallSurf(vec2(u, vFac.y), Lp, vec3(0.9, 0.88, 0.86) * (0.86 + 0.28 * nz.g) * (0.92 + 0.16 * nz2.r));\r
    vec3 st = textureGrad(tNoise, vec2(u * 0.23 + seed, vFac.y * 0.021), gDx * vec2(0.23, 0.0), gDy * vec2(0.0, 0.021)).rgb;\r
    o.alb *= 1.0 - 0.28 * smoothstep(0.5, 0.85, st.g) * (0.4 + 0.6 * (1.0 - smoothstep(0.0, 30.0, topY - y)));   // rain streaks from the top\r
    { // (textures r2) leak decals from the coping, 3.5 m apart, 4-16 m runs\r
      float gs = 3.5, gi = floor(u / gs), gr = fh1(vec2(gi + seed * 2.9, seed * 1.9)), gL = 4.0 + 12.0 * gr;\r
      o.alb *= 1.0 - 0.4 * grimeDecal(vec2(u / gs - gi, (topY - 0.3 - y) / gL), vec2(1.0 / gs, 1.0 / gL), floor(fract(gr * 5.3) * 24.0)) * step(0.25, fract(gr * 9.7));\r
    }\r
    o.alb *= mix(0.72, 1.0, smoothstep(0.0, 3.0, y));                                                              // street grime\r
    if(r1 < 0.6 && topY > 14.0) { // former low neighbour: parged (cement-rendered) area below its roof line, stepped profile\r
      float hN = 5.0 + r2 * min(topY - 9.0, 18.0);\r
      float stepU = faceW * (0.35 + 0.3 * r3);\r
      float hL = u < stepU ? hN : hN - 2.5 - 2.0 * r1;\r
      float parge = boxAA(y, -1.0, hL, ah) * boxAA(u, 0.4, faceW - 0.4, aw);\r
      vec3 pc = vec3(0.56, 0.54, 0.5) * (0.8 + 0.35 * st.b) * (0.85 + 0.2 * nz2.g);\r
      float flash = boxAA(y, hL - 0.08, hL + 0.05, ah) * boxAA(u, 0.4, faceW - 0.4, aw);\r
      o.alb = mix(o.alb, pc, parge * (0.75 + 0.25 * st.r));\r
      o.rough = mix(o.rough, 0.92, parge);\r
      o.n = normalize(mix(o.n, vec3(0.0, 0.0, 1.0), parge * 0.8));\r
      o.alb = mix(o.alb, vec3(0.08, 0.08, 0.085), flash);\r
      o.metal = mix(o.metal, 0.4, flash);\r
    }\r
    if(r2 > 0.5 && faceW > 9.0 && topY > 16.0) { // ghost sign painted on the brick, high on the wall\r
      float y1 = topY - 2.0 - 2.0 * r1, u0 = faceW * 0.12, u1 = faceW * 0.88, y0 = y1 - min(min(8.0, (topY - 6.0) * 0.35), (u1 - u0) * 0.25); // (billboards r3) one 4:1 sign cell, unstretched\r
      float inS = boxAA(u, u0, u1, aw) * boxAA(y, y0, y1, ah);\r
      if(inS > 0.0) {\r
        vec2 suv = vec2((u - u0) / (u1 - u0), (y - y0) / (y1 - y0));\r
        float row = floor(r3 * 16.0), col = floor(r1 * 4.0); // (billboards r3) one cell (was: the whole 4-cell atlas row squeezed in)\r
        vec2 suv2 = vec2((col + clamp(suv.x, 0.01, 0.99)) / 4.0, 1.0 - (row + 1.0 - clamp(suv.y, 0.04, 0.96)) / 16.0);\r
        vec3 sc = textureGrad(tSigns, suv2, gDx / (u1 - u0) / 4.0, gDy / (y1 - y0) / 16.0).rgb;\r
        vec3 bd = textureGrad(tSigns, suv2, vec2(0.06, 0.0), vec2(0.0, 0.03)).rgb; // blurred cell ~ board colour\r
        float lum = dot(sc, vec3(0.3, 0.55, 0.15)), let = smoothstep(0.1, 0.24, abs(lum - dot(bd, vec3(0.3, 0.55, 0.15))));\r
        vec3 paint = mix(vec3(0.2, 0.19, 0.2), vec3(0.74, 0.68, 0.55), let); // (billboards r3) cream lettering, the dark board mostly weathered off\r
        float wear = smoothstep(0.25, 0.75, st.r + 0.3 * nz2.b) * (1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.3, fract(vFac.y / 0.075)))); // paint gone at mortar / worn\r
        o.alb = mix(o.alb, paint * (0.9 + 0.2 * nz.g), inS * mix(0.12, 0.5, let) * wear);\r
      }\r
    }\r
    // (street r11) critic: 'a completely flat, windowless brown slab'. Tall exposed lot-line walls get a few columns of\r
    // small lot-line windows (dark glass, stone sill, some bricked-up) above the old neighbour's roof line\r
    if(r1 > 0.3 && topY > 22.0 && faceW > 8.0) {\r
      float pfh = 3.2, pfl = floor(y / pfh), pfy = y - pfl * pfh;\r
      float nC = faceW > 24.0 ? 4.0 : (faceW > 14.0 ? 3.0 : 2.0), cwid = faceW / nC;\r
      float ci = floor(u / cwid), cu = u - (ci + 0.5) * cwid;\r
      float hMin = 8.0 + 10.0 * r2;\r
      float colOn = step(0.28, fract(sin(ci * 12.9 + seed * 3.1) * 437.5)) * step(hMin, y) * step(y, topY - 2.5);\r
      float wm = boxAA(cu, -0.55, 0.55, aw) * boxAA(pfy, 0.9, 2.5, ah) * colOn;\r
      float brk = step(0.8, fract(sin(ci * 7.1 + pfl * 3.7 + seed) * 911.3));             // bricked-up\r
      float sillM = boxAA(cu, -0.7, 0.7, aw) * boxAA(pfy, 0.75, 0.9, ah) * colOn;\r
      vec3 wc = mix(vec3(0.035, 0.04, 0.045) * (0.8 + 0.5 * fract(pfl * 0.37 + ci)), o.alb * 0.8, brk);\r
      o.alb = mix(o.alb, wc, wm);\r
      o.rough = mix(o.rough, mix(0.2, o.rough, brk), wm);\r
      o.metal = mix(o.metal, 0.0, wm);\r
      o.alb = mix(o.alb, vec3(0.62, 0.6, 0.55) * (0.85 + 0.2 * nz2.r), sillM);\r
      o.n = normalize(mix(o.n, vec3(0.0, 0.6, 1.0), sillM));\r
    }\r
    return;\r
  }\r
  if(style < 0.5)\r
    return;\r
\r
  bool curtain = abs(style - 2.0) < 0.5;\r
  bool ribbon = abs(style - 3.0) < 0.5;\r
  bool deco = abs(style - 4.0) < 0.5;\r
\r
  // ----------------------------------------------------------- storefront zone\r
  if(y < gH && gHs > 0.0) {\r
    float nb2 = max(1.0, floor(faceW / 6.5 + 0.5));\r
    float bw2 = faceW / nb2;\r
    float bi2 = floor(u / bw2);\r
    float fx2 = u - bi2 * bw2;\r
    float rnd = fh1(vec2(bi2 + seed * 13.1, seed * 7.7 + faceW));\r
    Surf base = wallSurf(vec2(u, vFac.y), Lb, Lb > 5.5 && Lb < 6.5 ? vec3(1.0) : tint * 0.0 + vec3(1.0));\r
    float pier = 0.35;\r
    float signY0 = gH - 1.55, signY1 = gH - 0.55;\r
    float inner = boxAA(fx2, pier, bw2 - pier, aw);\r
    o = base;\r
    if(inner <= 0.0)\r
      return;\r
    Surf s;\r
    float glassY0 = 0.55;\r
    if(y > signY1) { // cornice band\r
      s = base;\r
      s.alb *= 1.12;\r
      s.n = vec3(0.0, 0.45, 0.9);\r
    } else if(y > signY0) { // sign band\r
      float row = floor(fh1(vec2(rnd * 91.0, seed)) * 16.0);\r
      vec2 suv = vec2((fx2 - pier) / (bw2 - 2.0 * pier), (y - signY0) / (signY1 - signY0));\r
      vec3 sc = textureLod(tSigns, vec2(suv.x, 1.0 - (row + 1.0 - suv.y) / 16.0), clamp(log2(max(aw * 1024.0 / (bw2 - 2.0 * pier), ah * 128.0 / 1.0)), 0.0, 9.0)).rgb;\r
      s.alb = sc;\r
      s.rough = 0.45;\r
      s.metal = 0.0;\r
      s.n = vec3(0.0, 0.0, 1.0);\r
      s.emis = sc * 0.25 * uShopGain;\r
#ifdef FAR_NIGHT\r
      s.emis *= 1.0 - 0.8 * uNightK; // (night)\r
#endif\r
      if(rnd > 0.8) {\r
        s = base;\r
        s.alb *= 0.8;\r
      } // no sign\r
    } else if(y < glassY0) { // bulkhead\r
      s = base;\r
      s.alb *= 0.55;\r
      s.rough = 0.4;\r
    } else {\r
      float shutter = step(0.78, rnd);\r
      float gx = fx2 - pier, gw = bw2 - 2.0 * pier;\r
      if(shutter > 0.5 && y > signY0 - 0.24) { // shutter box (coil housing) closes the shutter up to the sign band\r
        float lip = boxAA(y, signY0 - 0.24, signY0 - 0.2, ah);\r
        s.alb = vec3(0.3, 0.31, 0.32) * (0.85 + 0.15 * nz.b) * (1.0 - 0.35 * lip);\r
        s.rough = 0.45;\r
        s.metal = 0.6;\r
        s.n = normalize(vec3(0.0, 0.35 * (1.0 - lip) - 0.6 * lip, 1.0));\r
        s.emis = vec3(0.0);\r
      } else if(shutter > 0.5) {\r
        // roll-down shutter: 7.5 cm curved slats with dark interlock grooves; the relief fades out once a slat spans\r
        // < ~3 px (no stripe aliasing), bottom rail, grime rising from the pavement\r
        float P = 0.075, sy = y / P, fs = fract(sy);\r
        float amp = 1.0 - smoothstep(0.012, 0.03, ah);\r
        float slope = cos(fs * 6.2831) * amp;                               // convex slat profile\r
        float groove = (1.0 - boxAA(fs, 0.08, 0.92, ah / P)) * amp;           // interlock gap\r
        float rail = boxAA(y, glassY0 - 0.02, glassY0 + 0.1, ah);\r
        vec3 sc = vec3(0.58, 0.59, 0.6) * (0.85 + 0.15 * nz.b) * (1.0 - 0.45 * groove) * mix(0.6, 1.0, smoothstep(0.0, 1.2, y));\r
        float graf = smoothstep(0.58, 0.66, textureGrad(tNoise, vec2(u, y) / 3.0 + seed, gDx / 3.0, gDy / 3.0).g) * step(y, 2.2);\r
        sc = mix(sc, vec3(0.25 + 0.5 * rnd, 0.2, 0.6 - 0.4 * rnd), graf * 0.7);\r
        sc = mix(sc, vec3(0.2, 0.21, 0.22), rail);\r
        s.alb = sc;\r
        s.rough = 0.5 + 0.2 * groove;\r
        s.metal = 0.5 * (1.0 - graf);\r
        s.n = normalize(vec3(0.0, slope * 0.45, 1.0));\r
        s.emis = vec3(0.0);\r
      } else {\r
        // recessed shop glass with mullions\r
        float d = 0.18;\r
        vec2 gp = vec2(gx, y) + vec2(-Vt.x, -Vt.y) / Vt.z * d;\r
        float inG = boxAA(gp.x, 0.0, gw, aw) * boxAA(gp.y, glassY0, signY0, ah);\r
        float nm = max(1.0, floor(gw / 1.8 + 0.5));\r
        float mw = gw / nm;\r
        float mx = mod(gp.x, mw);\r
        float mull = max(1.0 - boxAA(mx, 0.05, mw - 0.05, aw), 1.0 - boxAA(gp.y, glassY0 + 0.06, signY0 - 0.06, ah));\r
        mull = max(mull, 1.0 - boxAA(abs(gp.y - (signY0 - 0.9)), 0.04, 9.0, ah));\r
        float door = step(rnd, 0.5) * boxAA(gp.x, 0.4, 1.5, aw) * step(gp.y, 2.6);\r
        bool wideR = uNightK > 0.35; // (night) one room behind the whole shop window (the per-mullion 1.8 m rooms read as flat tan corridor walls)\r
        vec3 room = interior(wideR ? vec2(gp.x, gp.y - glassY0) : vec2(mod(gp.x, mw), gp.y - glassY0), dirIn, wideR ? gw : mw, signY0 - glassY0 + 0.6, 5.0, 12.0 + floor(rnd * 4.0), 1.0, 1.0);\r
        float F = 0.04 + 0.96 * pow(1.0 - Vt.z, 5.0);\r
        Surf gl;\r
        gl.alb = vec3(0.02);\r
        gl.rough = 0.04;\r
        gl.metal = 0.0;\r
        gl.n = vec3(0.0, 0.0, 1.0);\r
        gl.emis = room * uShopGain * (1.0 - F);\r
        // (night) warm lit shop interiors, not blown panels: x0.3 against the x4.5 night exposure, 3000-3500 K tint, and\r
        // ~20 % of the open (unshuttered) shops closed for the night (dim security light). Same rule as registerShop()\r
        // (JS), which lights the sidewalk with a rect light per frontage.\r
        if(uNightK > 0.0)\r
          gl.emis *= mix(vec3(1.0), fract(rnd * 37.1) < 0.2 ? vec3(0.03, 0.032, 0.036) : vec3(0.24, 0.2, 0.15), uNightK); // (critic r3) -35 %\r
#ifdef FAR_NIGHT\r
        gl.emis *= 1.0 - 0.8 * uNightK; // (night) far shores: 1-3 km of lit shop bands summed into a warm tan haze band\r
#endif\r
        Surf fr;\r
        fr.alb = rnd > 0.4 ? vec3(0.05, 0.05, 0.055) : vec3(0.35, 0.28, 0.18);\r
        fr.rough = 0.35;\r
        fr.metal = 0.8;\r
        fr.n = vec3(0, 0, 1);\r
        fr.emis = vec3(0.0);\r
        float fm = max(mull, door * 0.0);\r
        Surf rv = base;\r
        rv.alb *= 0.6;\r
        rv.n = vec3(gp.x < 0.0 ? 1.0 : (gp.x > gw ? -1.0 : 0.0), gp.y < glassY0 ? 1.0 : (gp.y > signY0 ? -1.0 : 0.0), 0.3);\r
        rv.n = normalize(rv.n);\r
        s.alb = mix(gl.alb, fr.alb, fm);\r
        s.rough = mix(gl.rough, fr.rough, fm);\r
        s.metal = mix(gl.metal, fr.metal, fm);\r
        s.n = vec3(0, 0, 1);\r
        s.emis = gl.emis * (1.0 - fm);\r
        // reveal where the glass point falls outside the opening\r
        s.alb = mix(rv.alb, s.alb, inG);\r
        s.rough = mix(rv.rough, s.rough, inG);\r
        s.metal = mix(0.0, s.metal, inG);\r
        s.n = normalize(mix(rv.n, s.n, inG));\r
        s.emis *= inG;\r
        gGlass = inG * (1.0 - fm);\r
        gF0 = 0.07;\r
      }\r
    }\r
    o.alb = mix(o.alb, s.alb, inner);\r
    o.rough = mix(o.rough, s.rough, inner);\r
    o.metal = mix(o.metal, s.metal, inner);\r
    o.n = normalize(mix(o.n, s.n, inner));\r
    o.emis = s.emis * inner;\r
    gGlass *= inner;\r
    return;\r
  }\r
\r
  // ----------------------------------------------------------- upper floors\r
  float fh = vF.x;\r
  float yy = y - gH;\r
  float fl = floor(yy / fh);\r
  float fy = yy - fl * fh;\r
  float margin = vW.w;\r
  float usable = faceW - 2.0 * margin;\r
  float nb = max(1.0, floor(usable / vF.y + 0.5));\r
  float bw = usable / nb;\r
  float ux = u - margin;\r
  float bi = floor(ux / bw);\r
  float fx = ux - bi * bw;\r
  float ww = bw * vF.z;\r
  float wh = fh * vF.w;\r
  float wx0 = (bw - ww) * 0.5;\r
  float wy0 = (fh - wh) * (curtain ? 0.72 : 0.42);\r
  // ==================== (street r9) STREET-LEVEL ZONING of punched masonry facades (street agent, additive) ====================\r
  // critic: 'one tiled brick texture with identical window modules, no base / belt courses / cornice zone / bays / AC units'.\r
  // Classic NYC tripartite facade: a rusticated stone BASE (1-2 floors over the shops), a brick SHAFT broken into bays\r
  // (pilasters every K windows, paired sash windows on some buildings, continuous sill courses every N floors, stone\r
  // quoins), a CAP zone (1-2 floors, stone or brick with arched heads) under the cornice, belt courses between zones.\r
  // All per-building choices hash the building seed; buildings.ts emits real projecting belt ledges at the same heights.\r
  bool zOK = !curtain && !ribbon && !deco && style < 1.5 && Lw < 3.5; // masonry (brick / limestone) walls only\r
  bool pOK = !curtain && !ribbon && !deco && style < 1.5; // (street r10) every punched wall: dark window treatment\r
  float zH1 = fract(seed * 2.37 + 0.11), zH2 = fract(seed * 4.73 + 0.59), zH3 = fract(seed * 8.19 + 0.27), zH4 = fract(seed * 1.61 + 0.83);\r
  float zNf = floor((topY - gH) / fh + 0.01);\r
  float zBase = (zOK && zNf >= 5.0) ? 1.0 + step(0.55, zH1) * step(9.0, zNf) : 0.0;\r
  float zCap = (zOK && zNf >= 6.0) ? 1.0 + step(0.6, zH2) * step(11.0, zNf) : 0.0;\r
  float zCapY = (zNf - zCap) * fh;                       // yy where the cap zone starts\r
  bool zInBase = zOK && fl < zBase;\r
  bool zInCap = zOK && zCap > 0.0 && yy >= zCapY;\r
  bool zPaired = zOK && bw > 2.15 && zH4 < 0.42 && !zInBase && !zInCap;\r
  float zBayK = 3.0 + floor(zH4 * 3.0);                    // pilaster every K windows\r
  float zH5 = fract(seed * 3.31 + 0.47);                     // (street r11) mid-shaft belt courses every zMidK floors\r
  float zMidK = (pOK && zNf - zBase - zCap >= 11.0) ? 6.0 + floor(zH5 * 3.0) : 0.0; // zOK: + projecting ledges (buildings.ts); other punched walls: shader belt only\r
  bool zMidF = zMidK > 0.5 && !zInCap && fl > zBase + 0.5 && mod(fl - zBase, zMidK) < 0.5 && fl <= zNf - zCap - 3.0; // floor just above a mid belt\r
  if(zPaired) { // two sash windows share one masonry opening group, a narrow brick mullion between them\r
    float hb = bw * 0.5;\r
    float bi2 = floor(ux / hb);\r
    float par = mod(bi2, 2.0);\r
    bw = hb;\r
    bi = bi2;\r
    fx = ux - bi2 * hb;\r
    ww = min(hb * 0.8, ww * 0.62);\r
    wx0 = par < 0.5 ? hb - ww - 0.09 : 0.09;\r
  }\r
  if(zInBase) {\r
    wh = min(fh - 0.5, wh * 1.14);\r
    wy0 = (fh - wh) * 0.5;\r
  }\r
  if(zInCap && zH2 > 0.3) {\r
    wh = min(fh - 0.45, wh * 1.08);\r
    wy0 = (fh - wh) * 0.4;\r
  }\r
  // ==================== end street r9 zoning (window geometry); wall treatment below ====================\r
  float valid = boxAA(ux, 0.0, usable, aw) * boxAA(yy, 0.0, topY - gH - (curtain ? 0.2 : 1.2), ah);\r
  float cellR = fh1(vec2(bi + seed * 3.7, fl + seed * 1.3));\r
  float cellR2 = fh1(vec2(fl * 1.7 + seed, bi * 2.3 - seed));\r
  float lod = clamp(max(aw / bw, ah / fh) * 3.0 - 0.6, 0.0, 1.0);\r
  // (skyline r8) per-window variation survives into the far LOD while a window cell still spans >= ~1.5 px\r
  // (critic: 'one tiled window pattern per tower, no per-window light / blind variation, reads as wallpaper')\r
  float wv = 1.0 - smoothstep(0.5, 0.9, max(aw / bw, ah / fh));\r
  // (night) window occupancy (refs/night esb_perch_night): a sparse, irregular mix. Office / deco towers light whole\r
  // floors or one tenant's bay group (fluorescent / neutral LED / some warm), most floors dark with a few stray lights;\r
  // homes / masonry a sparse per-window scatter of warm tungsten at very varied brightness (curtains, lamps deep in the\r
  // room), a few blue TV glows. nOn / nCol: this window; nFlM / nBdM: the floor's / building's expected emission factor\r
  // (used once windows / floors go sub-pixel: the far city averages out instead of shimmering)\r
  float nOn = 0.0;\r
  vec3 nCol = vec3(1.0), nFlM = vec3(0.0), nBdM = vec3(0.0);\r
  if(uNightK > 0.0) {\r
    float busy = 0.5 + fract(seed * 3.77 + 0.21);                        // per-building activity 0.5 .. 1.5\r
    // integer hashes (exactly reproducible in JS: the window-light provider emits light for the same lit windows); the\r
    // bay index ignores the paired-sash split (a pair shares one bay: both lit or both dark)\r
    uint sdI = uint(floor(seed * 1000.0 + 0.5)), flI = uint(int(fl)), biI = uint(int(floor(ux / (usable / nb))));\r
    float flR = nh01(nh3(flI, sdI, 11u));\r
    float wR = nh01(nh3(biI, flI, sdI + 23u)), wR2 = nh01(nh3(biI, flI, sdI + 57u));\r
    if(curtain || ribbon || deco) {\r
      float pF = (deco ? 0.42 : 0.36) * busy, pP = 0.18 * busy; // (critic r1) office towers ~45-60 % lit          // floor fully lit / one tenant's bays lit\r
      uint gBI = biI / uint(3.0 + floor(fract(seed * 5.3) * 6.0));\r
      float gR = nh01(nh3(gBI, flI, sdI + 91u));\r
      float full = step(flR, pF), part = (1.0 - full) * step(flR, pF + pP);\r
      float fOn = full > 0.5 ? 0.66 : (part > 0.5 ? 0.4 : 0.03);\r
      nOn = step(wR, full > 0.5 ? (gR < 0.18 ? 0.1 : 0.8) : (part > 0.5 ? step(gR, 0.45) * 0.85 : 0.03)); // full floors: an odd dark bay group\r
      float fq = fract(flR * 53.7);\r
      vec3 fc = (fq < 0.5 ? vec3(0.8, 0.92, 1.0) : (fq < 0.84 ? vec3(1.0, 0.93, 0.8) : vec3(1.0, 0.74, 0.48))) * (deco ? 1.0 : 0.7); // half cool-white LED, the rest neutral / warm // (night) office floors: bright but not blown\r
      if(deco)\r
        fc = mix(fc, vec3(1.0, 0.9, 0.74), 0.35);                // deco towers: warmer (ESB ref)\r
      float flB = 0.55 + 0.45 * fract(flR * 29.3); // per-floor brightness\r
      nCol = fc * flB * (0.6 + 0.4 * wR2);\r
      nFlM = fc * flB * fOn * 0.8;\r
      nBdM = vec3(0.93, 0.9, 0.84) * (pF * 0.66 + pP * 0.4 + 0.03) * 0.62;\r
    } else {\r
      float pw = 0.25 * busy * (0.6 + 0.8 * fract(flR * 3.3));\r
      nOn = step(wR, pw);\r
      float tv = step(0.9, wR2);\r
      nCol = tv > 0.5 ? vec3(0.42, 0.56, 1.0) * 0.4 : mix(vec3(1.0, 0.58, 0.28), vec3(1.0, 0.8, 0.56), fract(wR2 * 7.9)) * mix(0.12, 1.0, pow(fract(wR2 * 3.7), 1.4));\r
      nFlM = vec3(1.0, 0.68, 0.4) * pw * 0.5;\r
      nBdM = vec3(1.0, 0.68, 0.4) * 0.25 * busy * 0.5;\r
    }\r
    float nsw = fract(sin(floor(uDnTime / (45.0 + 60.0 * cellR2) + cellR * 17.0) * 91.7 + cellR * 311.0) * 4375.5); // rooms switch on / off every ~1-2 min\r
    if(nsw < 0.03)\r
      nOn = 1.0 - nOn;\r
  }\r
  float cBl = step(0.72, cellR2) * min(1.0, (cellR2 - 0.72) * 4.0); // curtain wall: blinds drawn (fraction of the pane)\r
  // (skyline r12) critic: 'glass slab = one even grid top to bottom'. Tenant zones of 8-15 floors: each zone gets its own\r
  // glass body tone / reflectance and its own share of drawn blinds (different tenants, re-glazed floors)\r
  float zR = 0.5;\r
  if(curtain) {\r
    float zF = 8.0 + floor(fract(seed * 3.91 + 0.13) * 8.0);\r
    zR = fh1(vec2(floor(fl / zF) + seed * 0.37, seed * 5.1 + 0.7));\r
    float bt = 0.58 + 0.3 * zR;\r
    cBl = step(bt, cellR2) * min(1.0, (cellR2 - bt) * 4.0);\r
  }\r
  float depth = vX.w;\r
  if(zOK)\r
    depth = max(depth, 0.16) * 1.3; // (street r9) deeper masonry reveals (critic: 'windows read as flat decals')\r
  if(pOK && !zOK)\r
    o.alb *= 0.955 + 0.09 * fh1(vec2(fl * 0.37 + seed, floor(bi / 3.0) + seed * 2.1)); // (street r11) per-floor / per-bay-group panel tone (critic: 'uniform grids, identical spacing top to bottom')\r
  if(pOK) { // (street r10) large-scale brick tonal patches (street r11: all punched walls) (re-pointing, replaced brick, soot washes) so the fine\r
    // pattern never reads as one tile: 3-10 m mottling +-14 %, a slight hue drift\r
    vec2 mq = vec2(u * 0.085 + seed * 0.71, vFac.y * 0.11);\r
    float m1 = textureGrad(tNoise, mq, gDx * 0.085, gDy * 0.11).r, m2 = textureGrad(tNoise, mq * 2.7 + 0.43, gDx * 0.23, gDy * 0.3).g;\r
    float mt = 0.62 * m1 + 0.38 * m2;\r
    o.alb *= (0.86 + 0.28 * smoothstep(0.2, 0.8, mt)) * mix(vec3(1.0), vec3(1.04, 0.99, 0.95), smoothstep(0.55, 0.8, m2));\r
  }\r
  if(zOK) { // (street r9) zone walls: rusticated stone base, stone (or lighter brick) cap\r
    if(zInBase) {\r
      float Lz = Lb < 5.5 && Lb > 2.5 ? Lb : 3.0;\r
      Surf bs = wallSurf(vec2(u, vFac.y), Lz, vec3(0.9, 0.88, 0.84) * (0.9 + 0.2 * nz2.r) * mix(0.72, 1.0, smoothstep(0.0, 2.5, y)));\r
      float rH = 0.56, ry = mod(y, rH), row = floor(y / rH);\r
      float jy = 1.0 - boxAA(ry, 0.035, rH, ah);                                   // deep horizontal rustication joint\r
      float jx = 1.0 - boxAA(mod(u + mod(row, 2.0) * 0.6, 1.2), 0.02, 1.2, aw);     // staggered head joints\r
      bs.alb *= (1.0 - 0.55 * jy) * (1.0 - 0.3 * jx) * (0.94 + 0.12 * fh1(vec2(floor((u + mod(row, 2.0) * 0.6) / 1.2), row + seed)));\r
      bs.n = normalize(vec3(0.0, jy * (ry < 0.02 ? -0.8 : 0.8), 1.0));\r
      o = bs;\r
    } else if(zInCap) {\r
      if(zH2 > 0.5) {\r
        Surf cs = wallSurf(vec2(u, vFac.y), 3.0, vec3(0.86, 0.84, 0.79) * (0.9 + 0.2 * nz2.g));\r
        cs.alb *= 1.0 - 0.18 * smoothstep(0.5, 0.85, nz.b);\r
        o = cs;\r
      } else\r
        o.alb *= vec3(1.06, 1.04, 1.02);\r
    }\r
    // stone quoins at the face corners (alternating long / short blocks)\r
    if(zH1 > 0.4 && !zInBase && faceW > 6.0) {\r
      float qr = floor(y / 0.62), qw = mod(qr, 2.0) < 0.5 ? 0.95 : 0.55;\r
      float qm = max(1.0 - boxAA(u, qw, faceW - qw, aw), 0.0) * step(0.0, yy);\r
      if(qm > 0.0) {\r
        Surf qs = wallSurf(vec2(u, vFac.y), 3.0, vec3(0.84, 0.82, 0.77) * (0.9 + 0.2 * nz2.b));\r
        float qj = 1.0 - boxAA(mod(y, 0.62), 0.03, 0.62, ah);\r
        qs.alb *= 1.0 - 0.45 * qj;\r
        qs.n = normalize(vec3(0.0, 0.5 * qj, 1.0));\r
        o.alb = mix(o.alb, qs.alb, qm);\r
        o.n = normalize(mix(o.n, qs.n, qm));\r
        o.rough = mix(o.rough, qs.rough, qm);\r
      }\r
    }\r
    // bay pilasters in the shaft: the pier between window groups is a slightly proud strip with a lit / shaded edge\r
    if(!zPaired && !zInBase && !zInCap && zH3 > 0.25) {\r
      bool pR = mod(bi + 1.0, zBayK) < 0.5 && fx > wx0 + ww, pL = mod(bi, zBayK) < 0.5 && bi > 0.5 && fx < wx0;\r
      if(pR || pL) {\r
        float e0 = pR ? fx - (wx0 + ww) : fx + (bw - wx0 - ww), pw2 = bw - ww;       // position across the pier\r
        float edgeL = 1.0 - boxAA(e0, 0.07, 99.0, aw), edgeR = 1.0 - boxAA(e0, -99.0, pw2 - 0.07, aw);\r
        if(zH3 > 0.62) { // stone pilaster (light, jointed every 0.62 m)\r
          Surf ps = wallSurf(vec2(u, vFac.y), 3.0, vec3(0.84, 0.82, 0.77) * (0.9 + 0.2 * nz2.b));\r
          ps.alb *= 1.0 - 0.4 * (1.0 - boxAA(mod(y, 0.62), 0.03, 0.62, ah));\r
          o.alb = ps.alb;\r
          o.rough = ps.rough;\r
        } else\r
          o.alb *= 0.8 + 0.07 * fract(seed * 3.3); // brick pier in a darker header bond\r
        o.alb *= 1.0 + 0.3 * edgeL - 0.4 * edgeR;\r
        o.n = normalize(o.n + vec3(0.8 * edgeL - 0.8 * edgeR, 0.0, 0.0));\r
      }\r
    }\r
  }\r
\r
  // window opening mask (at facade plane)\r
  float inWx = boxAA(fx, wx0, wx0 + ww, aw);\r
  float inWy = boxAA(fy, wy0, wy0 + wh, ah);\r
  // (street r9) arched heads on cap-zone windows of some buildings\r
  float zArch = zInCap && zH2 > 0.3 && zH2 < 0.8 ? 1.0 : 0.0;\r
  float archO = 1.0;\r
  if(zArch > 0.5) {\r
    float ar = ww * 0.5, acy = wy0 + wh - ar;\r
    vec2 dq = vec2(fx - wx0 - ar, max(fy - acy, 0.0));\r
    archO = 1.0 - smoothstep(ar - aw, ar + aw, length(dq));\r
  }\r
  float open = inWx * inWy * valid * archO;\r
  // glass plane point (parallax into recess)\r
  vec2 off = vec2(-Vt.x, -Vt.y) / Vt.z * depth;\r
  vec2 gp = vec2(fx, fy) + off;\r
  float inG = boxAA(gp.x, wx0, wx0 + ww, aw) * boxAA(gp.y, wy0, wy0 + wh, ah);\r
  if(zArch > 0.5) {\r
    float ar = ww * 0.5, acy = wy0 + wh - ar;\r
    vec2 dq = vec2(gp.x - wx0 - ar, max(gp.y - acy, 0.0));\r
    inG *= 1.0 - smoothstep(ar - aw, ar + aw, length(dq));\r
  }\r
  vec2 gq = vec2((gp.x - wx0) / ww, (gp.y - wy0) / wh);\r
\r
  // glass & interior\r
  bool resid = vX.x > 0.5;\r
  float tile = resid ? 6.0 + floor(cellR2 * 6.0) : floor(cellR2 * 6.0);\r
  float lit = step(0.55, fract(cellR * 7.13));\r
  if(uNightK > 0.5)\r
    lit = nOn; // (night) lit rooms show their ceiling lights, the rest stay dark\r
  vec3 room = interior(vec2(gp.x, gp.y), dirIn, bw, fh, curtain ? 6.0 : 4.0, tile, lit, 0.0);\r
  float F = 0.04 + 0.96 * pow(1.0 - Vt.z, 5.0);\r
  Surf gl;\r
  float gsel = vX.z;\r
  vec3 gt = gsel < 0.5 ? vec3(0.5, 0.61, 0.72) : (gsel < 1.5 ? vec3(0.4, 0.57, 0.58) : (gsel < 2.5 ? vec3(0.5, 0.56, 0.6) : (gsel < 3.5 ? vec3(0.55, 0.5, 0.42) : vec3(0.66, 0.74, 0.82))));\r
  // (skyline r12) critic: 'no reflective glass / green / dark-glass towers'. 5 = deep green-grey (Lever / Seagram-era\r
  // tinted glass), 6 = high-reflectance silver-blue mirror coating, 7 = gold-bronze reflective coating\r
  bool lowIron = gsel > 3.5 && gsel < 4.5;\r
  if(gsel > 4.5)\r
    gt = gsel < 5.5 ? vec3(0.36, 0.55, 0.46) : (gsel < 6.5 ? vec3(0.6, 0.72, 0.86) : vec3(0.78, 0.64, 0.42));\r
  // skyline: per-tower spandrel treatment (dark shadow-box glass / light metal panel / stone band) -> floor banding\r
  float sv = fract(seed * 5.31 + 0.17);\r
  vec3 spC = sv < 0.25 ? gt * 0.08 : (sv < 0.72 ? vec3(0.27, 0.285, 0.3) * (0.8 + 0.4 * fract(seed * 2.71)) : vec3(0.42, 0.405, 0.37) * (0.85 + 0.3 * fract(seed * 1.93)));\r
  float spGl = sv < 0.25 ? 1.0 : 0.2; // (skyline r10) dark shadow-box spandrels 40 -> 25 % (director: city reads too dark)\r
  if(sv > 0.88)\r
    spC = vec3(0.3, 0.24, 0.17) * (0.8 + 0.4 * fract(seed * 2.71)); // (skyline r3) bronze-anodised panels\r
  if(curtain)\r
    spC *= 0.88 + 0.24 * zR; // (skyline r12) per-zone spandrel tone\r
  // (skyline r3) per-tower mullion cap width (4-13 cm) and finish: silver / dark bronze / black / white-painted\r
  float cw = 0.04 + 0.09 * fract(seed * 7.77);\r
  float cq = fract(seed * 4.39 + 0.5);\r
  vec3 capC = cq < 0.4 ? vec3(0.42, 0.44, 0.46) : (cq < 0.62 ? vec3(0.13, 0.11, 0.09) : (cq < 0.82 ? vec3(0.05, 0.055, 0.06) : vec3(0.68, 0.69, 0.68)));\r
  if(lowIron)\r
    capC = vec3(0.56, 0.58, 0.61); // (skyline r7) low-iron supertalls: bright stainless caps (One WTC / CPT, not a black grid)\r
  if(curtain) {\r
    float glum = dot(gt, vec3(0.2126, 0.7152, 0.0722));\r
    gSpecTint = pow(gt / glum, vec3(1.7));\r
    gSpecTint *= mix(0.86 + 0.28 * cellR2, 1.0, 1.0 - wv); /* (skyline r9) +-26 % -> +-14 %: read as a pixel mosaic */ \r
  } // (r8) per-IGU reflectance held to the far LOD (wv) // per-IGU reflectance variation (fades before it can shimmer)\r
  if(curtain) {\r
    vec3 sm = textureGrad(tNoise, vWPos.xz * 0.05 + vec2(u, y) * 0.11, gDx * 0.11, gDy * 0.11).rgb;\r
    gl.alb = gt * (0.035 + 0.02 * cellR); // (user r-glass) deeper tint: darker glass body\r
    if(lowIron)\r
      gl.alb = gt * (0.13 + 0.03 * cellR); // (skyline r7) low-iron glass: pale ceilings / blinds lift the body tone\r
    if(vX.y > 2.5)\r
      gl.alb = vec3(0.05, 0.052, 0.055) * (0.75 + 0.5 * step(0.5, fract(gq.y * 6.0))); // (street r11) louvre band: dark blades\r
    gl.alb = mix(gl.alb, vec3(0.3, 0.3, 0.28), 0.75 * cBl * step(1.0 - cBl, gq.y)); // (skyline r8) roller blinds behind some panes\r
    gl.metal = 0.0;\r
    // (user r-glass) "remove the frosted effect, keep it deep tinted but reflective": the smudge speckle (noise texture\r
    // sampled at ~5 cm texel scale in roughness + albedo) read as frosted / crumpled foil -> clean polished glass, only a\r
    // faint per-IGU roughness difference\r
    gl.rough = 0.02 + 0.025 * cellR2 * (1.0 - lod);\r
\r
    // slight per-panel tilt -> broken reflections like real IGUs\r
    gl.n = normalize(vec3(vec2(cellR - 0.5, cellR2 - 0.5) * 0.016 * (1.0 - smoothstep(0.02, 0.12, max(aw / bw, ah / fh))), 1.0)); // per-IGU tilt fades before panels get sub-10px (reflection moire)\r
    gl.emis = room * uInteriorGain * 0.3 * (1.0 - F);\r
    // (skyline r5) panel deflection / heat-strengthened glass roller wave: ~10 m-scale normal wobble + reflectance\r
    // mottling. Low frequency, box-filtered by the mips -> it survives to the far LOD, where the per-IGU jitter is gone\r
    vec2 ws = vec2(0.07, 0.16);\r
    vec3 wob = textureGrad(tNoise, vec2(u, y) * ws + fract(seed * 0.73) * 7.0, gDx * ws, gDy * ws).rgb;\r
    // (user r-glass) the wobble texture is noise at texel scale (~5 cm at this frequency), which crinkled every\r
    // reflection like frosted glass. Panels stay flat mirrors; only the per-IGU tilt above breaks the reflection\r
    gWob = vec2(0.0);\r
    gSpecTint *= 0.94 + 0.12 * zR;\r
    gl.alb *= 0.75 + 0.5 * zR;\r
    gSpecTint *= 0.86 + 0.28 * zR; // (skyline r12) per-zone glass tone / reflectance\r
  } else {\r
    gl.alb = vec3(0.015);\r
    gl.metal = 0.0;\r
    gl.rough = 0.05 + 0.05 * cellR;\r
    gl.n = normalize(vec3(vec2(cellR - 0.5, cellR2 - 0.5) * 0.02 * (1.0 - smoothstep(0.02, 0.12, max(aw / bw, ah / fh))), 1.0));\r
    // daylit rooms seen through clear sash glass: furniture / back walls readable (not a flat dark pane), the\r
    // Fresnel sky reflection takes over at grazing angles\r
    gl.emis = room * uInteriorGain * 2.0 * (1.0 - F);\r
    if(deco)\r
      gl.emis *= 0.5; // (skyline r11) deco towers: darker window stripes -> the light stone piers read (ESB, ref 01)\r
    // (street r10) director: 'masonry windows read as pale panes in a crisp grid; the ref's are DARK holes'. Old sash\r
    // windows: deep dim rooms (most unlit), only the occasional lit room; blinds on ~20 % of windows, drawn partway\r
    float bThr = deco ? 0.86 : (pOK ? 0.7 : 0.55); // (street r11) pOK 0.8 -> 0.7: ~30 % of sash windows have a blind down\r
    if(pOK)\r
      gl.emis *= (0.42 + 0.6 * lit * step(0.55, cellR2)) * (0.7 + 0.6 * cellR2); // (textures r4) 0.26 -> 0.42: rooms read through the glass (critic: 'flat black holes')\r
    {\r
      float hs = smoothstep(0.55, 1.0, gq.y);\r
      gl.emis *= 1.0 - 0.5 * hs;\r
    } // (textures r4) lintel / soffit shadow over the upper glass: the opening reads recessed\r
    // blinds / curtains\r
    float blind = cellR > bThr ? (cellR - bThr) * (pOK ? 2.6 : 1.8) : 0.0;\r
    blind *= mix(1.0, 0.45, uNightK); // (night) blinds mostly up: lit rooms show their interior, not a flat card\r
    float bl = step(1.0 - blind, gq.y);\r
    gBlN = bl; // (night)\r
    vec3 bc = resid ? mix(vec3(0.85, 0.8, 0.7), vec3(0.6, 0.35, 0.3), step(0.8, cellR2)) : vec3(0.82, 0.82, 0.8);\r
    float slats = 0.85 + 0.15 * step(0.5, fract(gp.y * 25.0));\r
    if(pOK)\r
      bc *= 0.5; // (street r10) dusty blinds in shade, not glowing white\r
    // (street r11) critic: 'window + AC module stamped identically; vary blinds, curtains and interior lighting per\r
    // window'. Masonry sash windows: blind colour per window (paper white / cream / tan / grey-green / dark roller),\r
    // side curtains on ~20 % (one or both sides, muted fabric colours), per-window glass reflectance (gSashV)\r
    float cR4 = fh1(vec2(bi * 5.3 + seed * 1.9, fl * 3.1 + seed * 0.37));\r
    if(pOK) {\r
      float bq = fract(cellR * 23.7);\r
      bc = (bq < 0.3 ? vec3(0.8, 0.78, 0.72) : (bq < 0.55 ? vec3(0.78, 0.7, 0.55) : (bq < 0.72 ? vec3(0.55, 0.58, 0.54) : (bq < 0.86 ? vec3(0.2, 0.2, 0.21) : vec3(0.7, 0.66, 0.6))))) * 0.55;\r
      float cSide = cR4 < 0.2 ? (cR4 < 0.08 ? 2.0 : 1.0) : 0.0;           // 1: one side (left / right by hash), 2: both\r
      float cw2 = 0.18 + 0.2 * fract(cR4 * 41.0);\r
      float onL = gq.x < cw2 ? 1.0 : 0.0, onR = gq.x > 1.0 - cw2 ? 1.0 : 0.0;\r
      float cur = cSide > 1.5 ? max(onL, onR) : (cSide > 0.5 ? (fract(cR4 * 13.0) < 0.5 ? onL : onR) : 0.0);\r
      gCurN = cur; // (night)\r
      vec3 cc = fract(cR4 * 7.7) < 0.35 ? vec3(0.62, 0.52, 0.4) : (fract(cR4 * 7.7) < 0.6 ? vec3(0.5, 0.22, 0.18) : (fract(cR4 * 7.7) < 0.8 ? vec3(0.3, 0.36, 0.42) : vec3(0.75, 0.72, 0.64)));\r
      float fold = 0.8 + 0.2 * sin(gp.x * 38.0);\r
      gl.alb = mix(gl.alb, cc * 0.5 * fold, cur);\r
      gl.rough = mix(gl.rough, 0.9, cur);\r
      gl.emis *= 1.0 - cur;\r
      gl.emis += cur * cc * 0.1 * lit * uInteriorGain;\r
      gSashV = 0.45 + 1.15 * fract(cR4 * 3.3 + cellR2);\r
    }\r
    gl.alb = mix(gl.alb, bc * slats * 0.8, bl);\r
    gl.rough = mix(gl.rough, 0.8, bl);\r
    gl.emis *= (1.0 - bl);\r
    gl.emis += bl * bc * 0.12 * lit * uInteriorGain;\r
    // reflection floor: real sash glass always mirrors some sky / opposite facade (brighter toward the head, where it\r
    // sees more sky); keeps unlit windows from reading as black holes at mid range\r
    gl.emis += (1.0 - bl) * vec3(0.035, 0.042, 0.052) * (0.55 + 0.45 * gq.y) * (0.8 + 0.4 * cellR2) * (pOK ? 0.8 : 1.0); // (textures r4) pOK 0.45 -> 0.8\r
  }\r
  // mullions / sash\r
  float mullW = curtain ? 0.0 : 0.05;\r
  float frame = 0.0;\r
  if(!curtain) {\r
    float fwm = mullW;\r
    frame = 1.0 - boxAA(gp.x, wx0 + fwm, wx0 + ww - fwm, aw) * boxAA(gp.y, wy0 + fwm, wy0 + wh - fwm, ah);\r
    if(!ribbon)\r
      frame = max(frame, 1.0 - boxAA(abs(gq.y - 0.52) * wh, 0.03, 99.0, ah));\r
    if(ww > 1.5 || ribbon) {\r
      float nmx = max(2.0, floor(ww / 1.2 + 0.5));\r
      frame = max(frame, 1.0 - boxAA(abs(fract(gq.x * nmx + 0.5) - 0.5) * ww / nmx, 0.025, 99.0, aw));\r
    }\r
  }\r
  vec3 frameC = vX.y > 1.5 ? vec3(0.9, 0.9, 0.87) : (vX.y > 0.5 ? vec3(0.1, 0.1, 0.1) : vec3(0.28, 0.2, 0.14));\r
  if(zOK) { // (street r9) per-building sash paint (muted: no glowing white grid) + ~18 % replacement aluminium windows\r
    float fq = fract(seed * 3.97 + 0.41);\r
    frameC = fq < 0.3 ? vec3(0.66, 0.65, 0.61) : (fq < 0.5 ? vec3(0.1, 0.15, 0.12) : (fq < 0.7 ? vec3(0.07, 0.07, 0.075) : (fq < 0.85 ? vec3(0.3, 0.21, 0.15) : vec3(0.55, 0.52, 0.45))));\r
    if(fract(cellR * 17.3) < 0.18)\r
      frameC = vec3(0.42, 0.43, 0.44);\r
  }\r
  Surf win;\r
  win.alb = mix(gl.alb, frameC, frame);\r
  win.rough = mix(gl.rough, 0.45, frame);\r
  win.metal = mix(gl.metal, 0.3, frame);\r
  win.n = normalize(mix(gl.n, vec3(0, 0, 1), frame));\r
  win.emis = gl.emis * (1.0 - frame);\r
  // reveal (jambs, head, sill) when the glass point leaves the opening\r
  Surf rv = o;\r
  vec3 rn = vec3(0.0);\r
  if(gp.x < wx0)\r
    rn.x = 1.0;\r
  else if(gp.x > wx0 + ww)\r
    rn.x = -1.0;\r
  if(gp.y < wy0)\r
    rn.y = 1.0;\r
  else if(gp.y > wy0 + wh)\r
    rn.y = -1.0;\r
  rv.n = normalize(rn + vec3(0.0, 0.0, 0.15));\r
  rv.alb *= curtain ? 0.9 : 0.72;\r
  if(curtain) {\r
    rv.alb = vec3(0.62, 0.64, 0.66);\r
    rv.metal = 0.9;\r
    rv.rough = 0.3;\r
  }\r
  win.alb = mix(rv.alb, win.alb, inG);\r
  win.rough = mix(rv.rough, win.rough, inG);\r
  win.metal = mix(rv.metal, win.metal, inG);\r
  win.n = normalize(mix(rv.n, win.n, inG));\r
  win.emis *= inG;\r
\r
  // wall decoration between openings\r
  Surf wall = o;\r
  if(curtain) {\r
    // spandrel panels + aluminium mullions (protruding caps)\r
    float capX = 1.0 - boxAA(fx, cw, bw - cw, aw);\r
    float capY = 1.0 - boxAA(fy, cw, fh - cw, ah);\r
    float cap = max(capX, capY);\r
    Surf sp = o;\r
    sp.alb = spC;\r
    sp.metal = spGl > 0.5 ? 0.3 : 0.5;\r
    sp.rough = spGl > 0.5 ? 0.12 : 0.38;\r
    sp.n = vec3(0.0, 0.0, 1.0); // (user r-glass) flat panel: the inherited masonry bump read as frosted speckle on reflective spandrels\r
    Surf al;\r
    al.alb = capC * (0.9 + 0.2 * nz2.r);\r
    al.metal = 0.85;\r
    al.rough = 0.42; // anodised aluminium: mid grey, satin\r
    // rounded cap profile: normal follows the position across the 6 cm cap (shading gradient, not a flat bright strip)\r
    float cxp = fx < bw * 0.5 ? fx / cw : (bw - fx) / cw, cyp = fy < fh * 0.5 ? fy / cw : (fh - fy) / cw;\r
    al.n = normalize(vec3(capX > 0.5 ? (fx < bw * 0.5 ? -1.0 : 1.0) * (1.0 - clamp(cxp, 0.0, 1.0)) * 0.7 : 0.0, capY > 0.5 ? (fy < fh * 0.5 ? -1.0 : 1.0) * (1.0 - clamp(cyp, 0.0, 1.0)) * 0.35 : 0.0, 1.0));\r
    al.rough = capY > 0.5 && capX < 0.5 ? 0.5 : al.rough; // transoms face the sky/sun: brushed, no blown highlight band\r
    al.emis = vec3(0.0);\r
    wall.alb = mix(sp.alb, al.alb, cap);\r
    wall.metal = mix(sp.metal, al.metal, cap);\r
    wall.rough = mix(sp.rough, al.rough, cap);\r
    wall.n = normalize(mix(sp.n, al.n, cap));\r
    // also cap over glass\r
    win.alb = mix(win.alb, al.alb, cap);\r
    win.metal = mix(win.metal, al.metal, cap);\r
    win.rough = mix(win.rough, al.rough, cap);\r
    win.n = normalize(mix(win.n, al.n, cap));\r
    win.emis *= 1.0 - cap;\r
  } else if(deco) {\r
    // dark recessed spandrels between stacked windows -> vertical pier emphasis\r
    // (skyline r2) cast-aluminium / dark-painted spandrel panels (ESB-like): with the dark glass they read as continuous\r
    // recessed vertical stripes between the light stone piers; a raised chevron rib every panel catches the light\r
    float sp = inWx * (1.0 - inWy) * valid;\r
    float spRib = boxAA(abs(fy - (fy < wy0 ? wy0 * 0.5 : (wy0 + wh + fh) * 0.5)), 0.0, 0.07, ah);\r
    Surf sps = o;\r
    sps.alb = mix(vec3(0.075, 0.078, 0.082), vec3(0.2, 0.2, 0.19), 0.35 * fract(seed * 3.3)) * (0.85 + 0.3 * nz2.r) * (1.0 + 0.9 * spRib);\r
    sps.metal = 0.22;\r
    sps.rough = 0.62;\r
    sps.n = normalize(vec3(0.0, -0.18, 1.0)); // (skyline r9) was metal 0.55 + up-tilt: mirrored the sky as blue louvre bands from the street\r
    wall.alb = mix(o.alb, sps.alb, sp);\r
    wall.n = normalize(mix(o.n, sps.n, sp));\r
    wall.metal = mix(o.metal, sps.metal, sp);\r
    wall.rough = mix(o.rough, sps.rough, sp);\r
    // pier edge shading: piers read as proud of the recessed window/spandrel stripe (light edge / dark edge)\r
    float pe = boxAA(fx, wx0 - 0.12, wx0, aw) - boxAA(fx, wx0 + ww, wx0 + ww + 0.12, aw);\r
    wall.alb *= 1.0 + 0.12 * pe * valid;\r
  } else {\r
    // sills & lintels (stone), belt courses, rain streaks\r
    vec3 stone = vec3(0.78, 0.75, 0.68);\r
    float lint = vX.y;\r
    float ext = 0.1;\r
    float inX = boxAA(fx, wx0 - ext, wx0 + ww + ext, aw) * valid;\r
    float sill = inX * boxAA(fy, wy0 - 0.12, wy0, ah);\r
    float head = inX * boxAA(fy, wy0 + wh, wy0 + wh + (lint > 1.5 ? 0.35 : 0.22), ah);\r
    if(zArch > 0.5) { // (street r9) arched head: stone voussoir ring + keystone instead of a flat lintel\r
      float ar = ww * 0.5, acy = wy0 + wh - ar;\r
      vec2 dq = vec2(fx - wx0 - ar, fy - acy);\r
      float rr = length(dq);\r
      head = step(0.0, dq.y) * (smoothstep(ar - aw, ar + aw, rr) - smoothstep(ar + 0.26 - aw, ar + 0.26 + aw, rr));\r
      head = max(head, boxAA(abs(dq.x), -1.0, 0.13, aw) * boxAA(fy, wy0 + wh - 0.05, wy0 + wh + 0.36, ah));\r
      head *= valid;\r
      lint = max(lint, 1.0);\r
    }\r
    if(zMidF) {\r
      head = inX * boxAA(fy, wy0 + wh, wy0 + wh + 0.42, ah);\r
      sill = inX * boxAA(fy, wy0 - 0.2, wy0, ah);\r
      lint = max(lint, 2.0);\r
    } // (street r11) dressed floor over a mid belt\r
    if(zInBase)\r
      head = 0.0; // rusticated base: the stone joints frame the openings\r
    // (textures r2) under-sill soot / rain runs from the $imagegen grime decal sheet (was a 1.4 m gradient box): each window\r
    // picks one of 24 streak shapes and a 0.8-3 m run; above the window head the run of the floor above continues\r
    float gdy = wy0 - 0.12 - fy, gcr = cellR;\r
    if(gdy < 0.0) {\r
      gdy += fh;\r
      gcr = fh1(vec2(bi + seed * 3.7, fl + 1.0 + seed * 1.3));\r
    }\r
    float gLn = 0.8 + 2.2 * fract(gcr * 3.3), gWd = ww + 0.35;\r
    float streak = grimeDecal(vec2((fx - wx0 + 0.175) / gWd, gdy / gLn), vec2(1.0 / gWd, 1.0 / gLn), floor(fract(gcr * 5.1) * 24.0)) * valid * 0.42;\r
    if(pOK)\r
      streak *= 0.45 + 1.1 * fract(gcr * 5.1); // (street r11) grime under sills varies per window (some heavy runs)\r
    wall.alb *= 1.0 - streak;\r
    float belt = 0.0;\r
    if(fl < 0.5)\r
      belt = boxAA(fy, -0.01, 0.35, ah); // belt course above storefront\r
    belt = max(belt, boxAA(yy - (topY - gH - 1.2), 0.0, 0.4, ah)) * boxAA(ux, -margin - 1.0, usable + margin + 1.0, aw);\r
    if(zOK) { // (street r9) zone belt courses (base top / cap bottom) with a shadow line under each, sill courses every N floors\r
      float zb = 0.0, zs = 0.0;\r
      if(zBase > 0.0) {\r
        zb = max(zb, boxAA(yy, zBase * fh - 0.02, zBase * fh + 0.46, ah));\r
        zs = max(zs, boxAA(yy, zBase * fh - 0.2, zBase * fh - 0.02, ah));\r
      }\r
      if(zCap > 0.0) {\r
        zb = max(zb, boxAA(yy, zCapY - 0.38, zCapY + 0.02, ah));\r
        zs = max(zs, boxAA(yy, zCapY - 0.52, zCapY - 0.38, ah));\r
      }\r
      float strN = zH3 < 0.3 ? 0.0 : 2.0 + floor(zH3 * 4.0);\r
      if(strN > 0.5 && !zInBase && !zInCap && mod(fl, strN) < 0.5)\r
        zb = max(zb, boxAA(fy, wy0 - 0.15, wy0, ah));\r
      // (street r11) critic: 'a single window module tiled over 15+ floors, no mid-cornice'. Tall shafts get a heavy\r
      // stone belt course every zMidK (6-8) floors (buildings.ts zoneBelts emits the matching projecting ledge), with a\r
      // cast shadow under it and the floor above it in stone-dressed windows (lintel + sill, see zMidF)\r
      if(zMidK > 0.5 && !zInBase && !zInCap) {\r
        float bj = floor((yy / fh - zBase) / zMidK + 0.5), bF = zBase + bj * zMidK;\r
        if(bj >= 1.0 && bF <= zNf - zCap - 3.0) {\r
          zb = max(zb, boxAA(yy, bF * fh - 0.02, bF * fh + 0.5, ah));\r
          zs = max(zs, boxAA(yy, bF * fh - 0.34, bF * fh - 0.02, ah));\r
        }\r
      }\r
      wall.alb *= 1.0 - 0.45 * zs * (1.0 - zb);\r
      belt = max(belt, zb);\r
    } else if(zMidK > 0.5) { // (street r11) mid-shaft belt courses on the other punched walls (concrete / granite / white)\r
      float bj = floor(yy / fh / zMidK + 0.5), bF = bj * zMidK, zb = 0.0, zs = 0.0;\r
      if(bj >= 1.0 && bF <= zNf - 3.0) {\r
        zb = boxAA(yy, bF * fh - 0.02, bF * fh + 0.5, ah);\r
        zs = boxAA(yy, bF * fh - 0.34, bF * fh - 0.02, ah);\r
      }\r
      wall.alb *= 1.0 - 0.45 * zs * (1.0 - zb);\r
      belt = max(belt, zb);\r
    }\r
    float st = max(max(sill, head), belt);\r
    Surf ss = wallSurf(vec2(u, vFac.y), 3.0, vec3(1.0));\r
    ss.alb *= stone * 1.25;\r
    ss.n = normalize(vec3(0.0, sill > 0.5 ? 0.7 : (head > 0.5 ? -0.25 : 0.2), 1.0));\r
    if(lint > 0.5 || belt > 0.5) {\r
      wall.alb = mix(wall.alb, ss.alb, st);\r
      wall.n = normalize(mix(wall.n, ss.n, st));\r
      wall.rough = mix(wall.rough, 0.8, st);\r
    } else { // soldier course (darker brick header)\r
      wall.alb *= 1.0 - 0.18 * head;\r
      wall.alb = mix(wall.alb, ss.alb, sill);\r
    }\r
  }\r
  // AO-ish darkening around openings\r
  wall.alb *= 1.0 - 0.1 * (inWx * boxAA(fy, wy0 - 0.3, wy0 + wh + 0.3, ah)) * (1.0 - open);\r
\r
  Surf r;\r
  r.alb = mix(wall.alb, win.alb, open);\r
  r.rough = mix(wall.rough, win.rough, open);\r
  r.metal = mix(wall.metal, win.metal, open);\r
  r.n = normalize(mix(wall.n, win.n, open));\r
  r.emis = win.emis * open;\r
  float capW = 0.0;\r
  if(curtain)\r
    capW = max(1.0 - boxAA(fx, cw, bw - cw, aw), 1.0 - boxAA(fy, cw, fh - cw, ah));\r
  gGlass = open * inG * (1.0 - frame) * (1.0 - capW);\r
  if(curtain)\r
    gGlass = max(gGlass, (1.0 - open) * (1.0 - capW) * spGl * 0.8); // shadow-box spandrel glass reflects too\r
  gF0 = curtain ? (lowIron ? 0.46 : (gsel > 5.5 ? 0.62 : (gsel > 4.5 ? 0.2 : 0.25))) * (0.85 + 0.3 * fract(seed * 6.83 + 0.37)) : 0.12; // (skyline r12) per-tower coating: mirror 0.62, tinted 0.2, +-15 % per tower // (skyline r7) low-iron supertall glass 0.34 -> 0.46 (One WTC reads bright) // (skyline r6) 0.2 -> 0.25: glass reads as glass\r
  if(pOK && !zOK) {\r
    gF0 = 0.085;\r
    gSash = 1.0;\r
  } // (textures r4) 0.05 -> 0.085: sash glass mirrors the sky / street opposite // (street r10) all punched walls: dusty, dim sash glass\r
  if(curtain && vX.y > 2.5) {\r
    gF0 = 0.03;\r
    gSash = 1.0;\r
    gSashV = 0.5;\r
  } // (street r11) lintel 3 on a curtain wall = dark mechanical louvre band (MetLife plant floors)\r
  if(zOK) {\r
    // (street r9) old sash glass: dusty, lower grazing reflectance (critic: 'windows read as flat bright white-grey planes')\r
    gF0 = 0.085;\r
    gSash = 1.0; // (street r10) 0.07 -> 0.05 // (textures r4) -> 0.085 (critic r3: 'windows flat black holes, no glass')\r
    // (street r9) through-window AC units: a 0.28 m deep box sitting on the sill (front face / top / side by ray-marching\r
    // the view segment through the box at 3 depths), a shadow + condensate drip stain on the wall below\r
    float acRate = (resid ? 0.2 : 0.09) * (zInBase ? 0.3 : 1.0) * step(0.15, fract(seed * 6.61));\r
    float cR3 = fh1(vec2(bi * 3.1 + seed * 0.71, fl * 5.7 - seed * 0.3));\r
    if(cR3 < acRate && valid > 0.5 && lod < 0.99) {\r
      float acW = min(0.72, ww - 0.1), acH = 0.42, acD = 0.3, cx = wx0 + 0.5 * ww + (fract(cR3 * 37.0) - 0.5) * max(ww - acW - 0.1, 0.0);\r
      vec2 sh = vec2(Vt.x, Vt.y) / Vt.z * acD;\r
      vec2 p0 = vec2(fx, fy), p1 = p0 + sh, pm = p0 + 0.5 * sh;\r
      float m0 = boxAA(p0.x, cx - 0.5 * acW, cx + 0.5 * acW, aw) * boxAA(p0.y, wy0, wy0 + acH, ah);\r
      float mm = boxAA(pm.x, cx - 0.5 * acW, cx + 0.5 * acW, aw) * boxAA(pm.y, wy0, wy0 + acH, ah);\r
      float m1 = boxAA(p1.x, cx - 0.5 * acW, cx + 0.5 * acW, aw) * boxAA(p1.y, wy0, wy0 + acH, ah);\r
      float hit = max(max(m0, mm), m1);\r
      if(hit > 0.0) {\r
        float gy = (p1.y - wy0) / acH;\r
        vec3 acC = mix(vec3(0.62, 0.61, 0.57), vec3(0.5, 0.52, 0.52), step(0.5, fract(cR3 * 91.0))) * (0.85 + 0.2 * nz2.r);\r
        float gr = step(0.5, fract(gy * 7.0)) * step(0.35, gy) * step(gy, 0.92);   // front grille slots\r
        Surf ac;\r
        ac.metal = 0.3;\r
        ac.rough = 0.55;\r
        ac.emis = vec3(0.0);\r
        if(m1 > 0.5) {\r
          ac.alb = acC * (1.0 - 0.3 * gr);\r
          ac.n = vec3(0.0, 0.0, 1.0);\r
        } else if(p1.y > wy0 + acH) {\r
          ac.alb = acC * 1.1;\r
          ac.n = vec3(0.0, 1.0, 0.15);\r
        }           // top face\r
        else if(p1.y < wy0) {\r
          ac.alb = acC * 0.4;\r
          ac.n = vec3(0.0, -1.0, 0.15);\r
        }                // underside\r
        else {\r
          ac.alb = acC * 0.8;\r
          ac.n = vec3(p1.x < cx ? -1.0 : 1.0, 0.0, 0.2);\r
        }               // side\r
        ac.n = normalize(ac.n);\r
        float k = hit * (1.0 - lod);\r
        r.alb = mix(r.alb, ac.alb, k);\r
        r.rough = mix(r.rough, ac.rough, k);\r
        r.metal = mix(r.metal, ac.metal, k);\r
        r.n = normalize(mix(r.n, ac.n, k));\r
        r.emis *= 1.0 - k;\r
        gGlass *= 1.0 - k;\r
        gAcN = k; // (night)\r
      }\r
      // cast shadow on the sill / wall below and a thin condensate stain\r
      float shd = boxAA(fx, cx - 0.5 * acW, cx + 0.5 * acW + 0.1, aw) * boxAA(fy, wy0 - 0.45, wy0, ah) * (1.0 - hit);\r
      float drip = boxAA(fx, cx + 0.12, cx + 0.2, aw) * step(fy, wy0) * (1.0 - smoothstep(0.0, 2.2, wy0 - fy));\r
      r.alb *= (1.0 - 0.45 * shd * (1.0 - smoothstep(0.0, 0.45, wy0 - fy))) * (1.0 - 0.3 * drip);\r
    }\r
  }\r
  // far LOD (skyline): exactly box-filtered window pattern (pbox) instead of a flat average: floor bands, deco pier\r
  // lines, spandrel stripes and mullion grids stay readable on distant towers and fade to the true mean (no moire)\r
  if(lod > 0.0) {\r
    float wf = 1.8; // (skyline r4) wider box filter: kills the micro-grid moire seen from altitude\r
    float cxw = pbox(ux, bw, wx0, wx0 + ww, aw * wf);\r
    float cyw = pbox(yy, fh, wy0, wy0 + wh, ah * wf);\r
    float cov = cxw * cyw * valid;\r
    vec3 roomAvg = textureLod(tInterior, vec2((mod(tile, 4.0) + 0.5) / 4.0, 1.0 - (floor(tile / 4.0) + 0.5) / 4.0), 9.0).rgb;\r
    Surf a;\r
    a.n = vec3(0, 0, 1);\r
    a.metal = 0.0;\r
    if(curtain) {\r
      float capx = 1.0 - pbox(fx, bw, cw, bw - cw, aw * wf);\r
      float capy = 1.0 - pbox(yy, fh, cw, fh - cw, ah * wf);\r
      float cap = clamp(capx + capy - capx * capy, 0.0, 1.0);\r
      vec3 glc = gt * ((lowIron ? 0.13 : 0.05) + 0.03 * cellR); // (skyline r7) low-iron glass body tone (as near LOD)\r
      glc *= 0.75 + 0.5 * zR; // (skyline r12) per-zone tone (as near LOD)\r
      if(vX.y > 2.5)\r
        glc = vec3(0.05, 0.052, 0.055); // (street r11) louvre band\r
      glc = mix(glc, vec3(0.3, 0.3, 0.28), 0.75 * cBl * cBl * mix(0.5, 1.0, wv)); // (skyline r8) blinds (pane-average of the near LOD)\r
      vec3 capc = capC * (0.9 + 0.2 * nz2.r);\r
      float vis = cyw * valid;\r
      a.alb = mix(mix(spC, glc, vis), capc, cap);\r
      a.rough = mix(mix(spGl > 0.5 ? 0.1 : 0.38, 0.06, vis), 0.42, cap);\r
      a.metal = cap * 0.85 + (1.0 - cap) * (1.0 - vis) * (spGl > 0.5 ? 0.3 : 0.5);\r
      gGlass = mix(gGlass, (1.0 - cap) * mix(spGl * 0.8, 1.0, vis), lod);\r
      a.emis = roomAvg * uInteriorGain * 0.25 * vis * (1.0 - cap) * (0.6 + 0.8 * lit);\r
      gCovN = vis * (1.0 - cap) * (1.0 - 0.6 * cBl); // (night)\r
    } else {\r
      vec3 avgGlass = vec3(0.035, 0.038, 0.042);\r
      { // (skyline r8) per-window variation in the far LOD: blinds / curtains (same cellR rule as the near LOD), lit vs\r
        // dark rooms, pane tone; fades to the mean once a window cell is sub-1.5 px\r
        float thr = deco ? 0.86 : (pOK ? 0.8 : 0.55), bf = cellR > thr ? min(1.0, (cellR - thr) * 1.8) : 0.0; // (street r10) zOK: fewer blinds\r
        vec3 bcF = resid ? mix(vec3(0.85, 0.8, 0.7), vec3(0.6, 0.35, 0.3), step(0.8, cellR2)) : vec3(0.82, 0.82, 0.8);\r
        vec3 wvC = avgGlass * (0.55 + 0.9 * cellR2) + roomAvg * 0.08 * lit;\r
        wvC = mix(wvC, bcF * 0.55, bf);\r
        float meanB = deco ? 0.02 : (pOK ? 0.06 : 0.2); // (street r10) masonry: fewer blinds -> darker window mean\r
        avgGlass = mix(mix(avgGlass, bcF * 0.55, meanB), wvC, wv);\r
      }\r
      vec3 wallC = o.alb;\r
      if(deco) { // recessed dark spandrels stacked between the windows: vertical pier lines\r
        vec3 spd = mix(vec3(0.075, 0.078, 0.082), vec3(0.2, 0.2, 0.19), 0.35 * fract(seed * 3.3)) * (0.85 + 0.3 * nz2.r);\r
        wallC = mix(o.alb, mix(spd, avgGlass, cyw), cxw * valid);\r
        a.alb = wallC;\r
        a.metal = 0.2 * cxw * valid * (1.0 - cyw);\r
      } else {\r
        a.alb = mix(wallC, avgGlass, cov);\r
      }\r
      a.alb *= 1.0 - 0.1 * cxw * valid * (1.0 - cyw); // reveals / sills shading\r
      a.rough = mix(o.rough, 0.12, cov);\r
      gGlass = mix(gGlass, cov, lod);\r
      a.emis = (roomAvg * 0.25 * (0.4 + 1.2 * lit) + vec3(0.03, 0.036, 0.045)) * uInteriorGain * cov * (pOK ? 0.7 : (deco ? 0.5 : 1.0)); // (textures r4) pOK 0.45 -> 0.7 // (street r10) darker masonry windows; (skyline r11) deco too\r
      gCovN = cov * (pOK ? 0.85 : 1.0); // (night)\r
    }\r
    r.alb = mix(r.alb, a.alb, lod);\r
    r.rough = mix(r.rough, a.rough, lod);\r
    r.metal = mix(r.metal, a.metal, lod);\r
    r.n = normalize(mix(r.n, a.n, lod));\r
    r.emis = mix(r.emis, a.emis, lod);\r
  }\r
  // (night) lit windows replace the day emission (whose fake sky-reflection floor + x4.5 night exposure turned every\r
  // window into a lit pane). Near: the room seen through the glass (interior mapping with lit = nOn: ceiling lights,\r
  // back wall), backlit blinds / curtains glow dimmer; dark rooms are nearly black glass. Far: exact glass coverage x\r
  // this window's state, then the floor / building mean once windows / floors get sub-pixel (no shimmer).\r
  if(uNightK > 0.0) {\r
    const float nG = 0.5; // lit-room radiance scale (the night exposure is x4.5)\r
    float glassM = open * inG * (1.0 - frame) * (1.0 - gAcN) * (1.0 - capW);\r
    float bc2 = clamp(gBlN + gCurN, 0.0, 1.0);\r
    // backlit blinds / curtains: slats + a glow gradient toward the lamp side, not a flat card\r
    float slatN = 0.3 + 0.12 * step(0.5, fract(gp.y * 25.0)) + 0.18 * clamp(gq.y, 0.0, 1.0);\r
    vec3 nearE = nOn > 0.5 ? (room * (1.0 - bc2) + vec3(slatN) * gBlN + vec3(0.2 * (0.8 + 0.2 * sin(gp.x * 38.0))) * gCurN) * nCol : room * 0.012;\r
    vec3 perW = nOn > 0.5 ? nCol : vec3(0.012);\r
    vec3 kM = mix(perW, mix(nFlM, nBdM, smoothstep(0.35, 0.8, ah / fh)), 1.0 - wv);\r
    vec3 nE = mix(nearE * glassM, gCovN * 0.42 * kM, lod) * nG;\r
    r.emis = mix(r.emis, nE, uNightK);\r
    // (night) the lit room lights its own opening: jambs / head (the faked reveal inside the opening outline), the sill\r
    // and the frame get ~20-30 % of the window radiance, a short falloff onto the sill course / wall under the opening\r
    // (the rect lights of the provider sit on the wall plane: they light what stands in front, not this faked relief)\r
    if(nOn > 0.5 && lod < 1.0) {\r
      float sillM = inWx * boxAA(fy, wy0 - 0.45, wy0 + 0.02, ah) * (0.35 + 0.65 * smoothstep(wy0 - 0.45, wy0, fy)) * valid;\r
      float halo = inWx * boxAA(fy, wy0 - 1.2, wy0 + wh + 0.3, ah) * valid * 0.04;\r
      float revM = open * (1.0 - inG) + 0.6 * frame * open;\r
      r.emis += r.alb * nCol * nG * 0.25 * (revM + 0.8 * sillM + halo) * (1.0 - lod) * uNightK; // ~20 % of the window radiance\r
    }\r
  }\r
  if(uNightK > 0.0 && abs(vWN.y) > 0.6)\r
    r.emis *= 1.0 - uNightK; // (lighting2 r3) no 'windows' on roofs / flat tops (far-shore roofs glowed as a pale band at night)\r
  // (skyline r4) large-scale facade breakup on towers (not deco: those carry piers + tier cornices): a louvred\r
  // mechanical floor every M floors, a louvred plant band under the top of every mass (reads as a mechanical crown /\r
  // penthouse at each setback) and, on curtain walls, a heavier vertical pier / fin every K bays. All terms are\r
  // box-filtered (pbox) so they survive at any distance and never shimmer.\r
  if(!deco && topY - gH > 36.0) {\r
    float hM = fract(seed * 2.93 + 0.41), hK = fract(seed * 6.17 + 0.23);\r
    float M = 9.0 + floor(hM * 5.0) * 4.0; // 9..25 floors\r
    float mech = pbox(yy + 0.5 * fh, M * fh, (M - 1.0) * fh, M * fh, ah * 1.3) * step(0.5, hK) * step(3.0 * fh, topY - gH - yy) * (curtain && lowIron ? 0.0 : 1.0); // (skyline r5) 50 % of towers (was 72 %)\r
    float crownH = (curtain ? 1.0 : 1.4) * fh + (hM > 0.55 ? fh : 0.0);\r
    float crownB = boxAA(yy, topY - gH - crownH, topY - gH + 2.0, ah) * step(0.2, fract(seed * 3.17)) * ((curtain || ribbon || topY - gH > 70.0) ? 1.0 : 0.0) /* (skyline r9) not on masonry mid-rises (bands under cornices) */ * (curtain && lowIron ? 0.0 : 1.0); // (skyline r6) no plant band per tier on the low-iron supertalls (One WTC read as striped)\r
    float band = max(mech, crownB) * boxAA(ux, -0.05, usable + 0.05, aw) * step(0.0, yy);\r
    if(zOK)\r
      band = 0.0; // (street r9) masonry walls: no louvred plant floors mid-shaft (read as translucent stripes on brick); the cap zone crowns them\r
    float pierM = 0.0, finN = 0.0;\r
    bool roundT = gHs < -0.015 && gHs > -0.03; // (skyline r9) round tower tiers (FacadeBuilder.cyl wrap)\r
    if((curtain && hK > 0.45) || roundT) { // vertical pier fin every K bays (0.3-0.5 m), lit / shaded edge\r
      float K = roundT ? 1.0 + floor(fract(seed * 9.31) * 2.0) : 2.0 + floor(fract(seed * 9.31) * 4.0), pw = (roundT ? 0.34 : 0.3) + 0.2 * fract(seed * 1.77);\r
      pierM = pbox(ux + 0.5 * pw, K * bw, 0.0, pw, aw * 1.3) * valid;\r
      float ft = mod(ux + 0.5 * pw, K * bw) / pw; // across the fin: rounded profile -> lit / shaded edges (near range)\r
      finN = step(ft, 1.0) * (ft * 2.0 - 1.0) * 0.85 * (1.0 - lod);\r
    }\r
    if(band > 0.001 || pierM > 0.001) {\r
      float sl = pbox(yy, 0.32, 0.0, 0.13, ah * 1.2); // louvre blades: converge to their mean when sub-pixel\r
      vec3 louv = (curtain ? mix(capC, vec3(0.2, 0.21, 0.22), 0.78) : mix(o.alb * 0.55, vec3(0.2, 0.21, 0.22), 0.6)) * (1.0 - 0.45 * sl) * (0.9 + 0.2 * nz2.g);\r
      // louvre floors keep the pier / mullion rhythm (thin stiles every bay)\r
      float stile = 1.0 - pbox(fx, bw, cw + 0.03, bw - cw - 0.03, aw * 1.3);\r
      louv = mix(louv, curtain ? capC : o.alb * 1.05, stile * 0.8);\r
      r.alb = mix(r.alb, louv, band);\r
      r.rough = mix(r.rough, 0.55, band);\r
      r.metal = mix(r.metal, curtain ? 0.6 : 0.2, band);\r
      r.n = normalize(mix(r.n, vec3(0.0, -0.3 * (1.0 - lod), 1.0), band)); // (skyline r9) blades slope down-out: no sky-blue glint from the street r.emis *= 1.0 - band; gGlass *= 1.0 - band;\r
      r.emis *= 1.0 - band * uNightK; // (night) the line above only comments this out: no lit rooms behind louvre floors\r
      vec3 pc = mix(capC, vec3(0.62, 0.63, 0.63), step(0.62, fract(seed * 4.39 + 0.5)) * 0.4) * (0.85 + 0.3 * nz2.r);\r
      if(roundT && !curtain)\r
        pc = o.alb * vec3(1.1, 1.09, 1.07); // (skyline r9) cast-stone / concrete fins on masonry drums\r
      float pm = pierM * (1.0 - band);\r
      r.n = normalize(mix(r.n, vec3(finN, 0.0, 1.0), pm * (1.0 - lod)));\r
      r.alb = mix(r.alb, pc, pm);\r
      r.rough = mix(r.rough, 0.38, pm);\r
      r.metal = mix(r.metal, 0.8, pm);\r
      r.emis *= 1.0 - pm;\r
      gGlass *= 1.0 - pm;\r
    }\r
  }\r
  if(curtain)\r
    r.n = normalize(r.n + vec3(gWob, 0.0) * clamp(gGlass, 0.0, 1.0));\r
  // (skyline r12) critic: 'no ambient occlusion at setback ledges'. Contact shade at the foot of every set-back tier\r
  // (the terrace roof + parapet occlude the lower wall), plus a long soft falloff; box-filtered by construction (no tex)\r
  if(tierY > 1.0) {\r
    float dyT = vFac.y - tierY;\r
    float aoT = 0.36 * (1.0 - smoothstep(0.0, 4.5, dyT)) + 0.14 * (1.0 - smoothstep(0.0, 20.0, dyT));\r
    r.alb *= 1.0 - aoT;\r
    r.emis *= 1.0 - 0.6 * aoT;\r
    gGlass *= 1.0 - 0.5 * aoT;\r
    gAoT = aoT; // (night)\r
  }\r
  o = r;\r
}\r
`,fe=`// bridges shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
out vec3 vWPs;\r
out vec3 vWNs;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vWPs = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vWNs = normalize(mat3(modelMatrix) * objectNormal);\r
// @section fragmentCommon\r
#include <common>\r
uniform sampler2D tSN;\r
in vec3 vWPs;\r
in vec3 vWNs;\r
// @section fragmentMap\r
{\r
vec3 an = abs(vWNs);\r
vec2 q = an.x > an.z ? vWPs.zy : vWPs.xy;\r
if(an.y > 0.7) q = vWPs.xz;\r
vec3 nz = texture(tSN, q / 17.0).rgb, nz2 = texture(tSN, q / 3.1).rgb;\r
// ashlar coursing: 0.9 m courses, 1.8 m blocks (offset every other course), thin dark joints\r
float cy = q.y / 0.9, row = floor(cy), cx = q.x / 1.8 + 0.5 * mod(row, 2.0);\r
vec2 f = vec2(fract(cx), fract(cy));\r
vec2 fw = fwidth(vec2(cx, cy)) * 1.5 + 1e-4;\r
float joint = max(1.0 - smoothstep(0.0, 0.03 + fw.x, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, 0.04 + fw.y, min(f.y, 1.0 - f.y)));\r
joint *= 1.0 - smoothstep(0.2, 0.6, max(fw.x, fw.y));\r
float blk = fract(sin(dot(floor(vec2(cx, cy)), vec2(12.9898, 78.233))) * 43758.5453);\r
vec3 c = diffuseColor.rgb * (0.86 + 0.16 * blk) * (0.8 + 0.3 * nz.r) * (0.93 + 0.1 * nz2.g);\r
c *= 1.0 - 0.35 * joint;\r
c *= mix(0.72, 1.0, smoothstep(- 1.0, 6.0, vWPs.y)); // wet / algae band at the water line\r
c *= 1.0 - 0.18 * smoothstep(0.55, 0.85, nz.b) * (0.5 + 0.5 * an.x + 0.5 * an.z); // grime streaks\r
diffuseColor.rgb = c;\r
}\r
// @section vertexCommonByCableGlow\r
#include <common>\r
in vec3 aEx;\r
out float vGlow;\r
// @section vertexBeginVertex\r
#include <begin_vertex>\r
vGlow = aEx.x;\r
// @section fragmentCommonByCableGlow\r
#include <common>\r
in float vGlow;\r
uniform float uNightK;\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
totalEmissiveRadiance += vec3(1.0, 0.82, 0.55) * vGlow * (0.15 + 7.0 * uNightK);\r
// @section vertexCommonByCableNeck\r
#include <common>\r
in vec3 aEx;\r
out vec3 vWPc;\r
out float vNeck, vFat;\r
// @section vertexBeginVertexCableBend\r
#include <begin_vertex>\r
vNeck = aEx.x;\r
{\r
vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vFat = max(0.0, length(wp - cameraPosition) * 0.0011 - 0.15);\r
transformed += objectNormal * vFat;\r
vWPc = wp;\r
}\r
// @section fragmentCommonCableLighting\r
#include <common>\r
in vec3 vWPc;\r
in float vNeck, vFat;\r
uniform float uNightK;\r
// @section fragmentMetalness\r
#include <metalnessmap_fragment>\r
metalnessFactor *= 1.0 - 0.85 * uNightK;\r
diffuseColor.rgb *= 1.0 - 0.7 * uNightK;\r
// @section fragmentEmissiveCableLighting\r
#include <emissivemap_fragment>\r
if(uNightK > 0.0 && vNeck > 0.5) {\r
float q = (vWPc.x + vWPc.z) * 0.18;\r
float fq = fwidth(q) + 1e-4;\r
// (night) small bright bulbs, not a glowing bar: each bulb stays >= ~1.5 px long at any distance (never averaged\r
// into a continuous line); once bulbs crowd to < ~3.5 px apart only every 2nd / 4th / ... bulb is drawn (stable\r
// world-space subset), so far bridges keep a dotted necklace of points. Bloom does the glow\r
float st = exp2(ceil(log2(max(1.0, fq * 6.0)))); // (night r11) 3.5: far necklaces read as dashed white bars\r
float hw = max(0.05, fq * 0.75), dd = abs(fract(q) - 0.5);\r
float dot1 = (1.0 - smoothstep(hw - 0.5 * fq, hw + 0.5 * fq, dd)) * step(mod(floor(q), st), 0.5);\r
// (night r11) the cable is fattened with distance (~1.5 m at 1.5 km): the bulb's emission is scaled back by the\r
// fattening, so far necklaces read as fine warm points instead of thick white dashes (esb view)\r
totalEmissiveRadiance += vec3(1.0, 0.9, 0.72) * dot1 * 3.5 * uNightK / (1.0 + vFat * 6.0);\r
}\r
// @section vertexCommonByTubeUv\r
#include <common>\r
out vec2 vTU;\r
// @section vertexBeginVertexByTubeUv\r
#include <begin_vertex>\r
vTU = uv;\r
// @section fragmentCommonByTubeUv\r
#include <common>\r
in vec2 vTU;\r
// @section fragmentClipping\r
#include <clipping_planes_fragment>\r
if(vTU.y < 1.5) {\r
float u = fract(vTU.x), v = vTU.y;\r
vec2 fw = fwidth(vTU) + 1e-4;\r
float chord = step(v, 0.08 + fw.y) + step(0.92 - fw.y, v);\r
float post = step(min(u, 1.0 - u), 0.05 + fw.x);\r
float d1 = abs(u - v), d2 = abs(u - (1.0 - v));\r
float diag = step(min(d1, d2), 0.06 + fw.x + fw.y);\r
          // far away the web is sub-pixel: keep it solid (dithered holes would read as polka dots)\r
if(chord + post + diag < 0.5 && max(fw.x, fw.y) < 0.09) discard;\r
} else {\r
float v = vTU.y - 2.0, u = vTU.x;\r
vec2 fw = fwidth(vec2(u * 16.0, v)) + 1e-4;\r
float rail = step(0.9 - fw.y, v) + step(v, 0.07 + fw.y) + step(abs(v - 0.5), 0.035 + fw.y);\r
float post = step(min(fract(u), 1.0 - fract(u)), 0.04 + fw.x / 16.0);\r
float pick = step(abs(fract(u * 16.0) - 0.5), 0.12 + fw.x);\r
if(rail + post + pick < 0.5 && fw.x < 0.6) discard;\r
}\r
// @section vertexCommonByDeckExtras\r
#include <common>\r
in vec3 aEx;\r
out vec3 vWPd;\r
out vec3 vWNd;\r
out vec2 vUD;\r
out vec3 vEx;\r
// @section vertexFogVertexByDeckUv\r
#include <fog_vertex>\r
vWPd = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vWNd = normalize(mat3(modelMatrix) * objectNormal);\r
vUD = uv;\r
vEx = aEx;\r
// @section fragmentCommonDeckMaterial\r
#include <common>\r
uniform sampler2D tDC;\r
uniform sampler2D tSN;\r
in vec3 vWPd;\r
in vec3 vWNd;\r
in vec2 vUD;\r
in vec3 vEx;\r
float bandL(float l, float c, float w, float fw) {\r
return 1.0 - smoothstep(w * 0.5 - fw, w * 0.5 + fw, abs(l - c));\r
}\r
// @section fragmentMapByDeckUv\r
{\r
vec3 c = texture(tDC, vWPd.xz / 6.0).rgb * 1.1;\r
float md = floor(vEx.z + 0.5);\r
vec3 nz = texture(tSN, vWPd.xz / 23.0).rgb;\r
if(vWNd.y < 0.5) c = vec3(0.42, 0.42, 0.41) * (0.85 + 0.25 * nz.r); // slab edges / fascia / kerbs: concrete\r
else if(md == 1.0) {\r
float l = abs(vUD.y), a = vUD.x, inner = vEx.x, outer = vEx.y;\r
float fw = fwidth(vUD.y) + 1e-3;\r
float fade = 1.0 - smoothstep(0.08, 0.3, fw); // lines fade to the asphalt tone before they alias\r
float w = bandL(l, outer - 0.45, 0.15, fw);\r
if(inner > 0.3) w = max(w, bandL(l, inner + 0.45, 0.15, fw));\r
float n = floor((outer - inner - 1.0) / __SHADER_INJECT_0__ + 0.5);\r
float k = floor((l - inner - 0.5) / __SHADER_INJECT_1__ + 0.5);\r
if(k >= 1.0 && k <= n - 1.0) w = max(w, bandL(l, inner + 0.5 + k * __SHADER_INJECT_2__, 0.13, fw) * step(fract(a / 12.0), 0.27));\r
float y = inner < 0.3 ? max(bandL(l, 0.2, 0.12, fw), 0.0) : 0.0;\r
          // tyre-polished wheel paths (darker, smoother) in every lane\r
float ln = fract((l - inner - 0.5) / __SHADER_INJECT_3__);\r
float wear = (1.0 - smoothstep(0.08, 0.16, abs(ln - 0.27))) + (1.0 - smoothstep(0.08, 0.16, abs(ln - 0.73)));\r
c *= 1.0 - 0.13 * wear * step(l, outer - 0.5) * step(inner + 0.5, l);\r
          // expansion joints every 30 m (steel strip)\r
c = mix(c, vec3(0.32, 0.31, 0.3), (1.0 - smoothstep(0.05, 0.12 + fwidth(a), abs(fract(a / 30.0) - 0.5) * 30.0)) * fade);\r
c = mix(c, vec3(0.84, 0.83, 0.78) * (0.8 + 0.25 * nz.g), w * 0.85 * fade);\r
c = mix(c, vec3(0.78, 0.6, 0.17), y * 0.85 * fade);\r
} else if(md == 2.0) { // timber planks across the promenade, grey-brown, worn\r
float a = vUD.x / 0.32, pl = fract(a), id = floor(a);\r
float h = fract(sin(id * 12.9898) * 43758.5453);\r
          // (bridges r2) weathered timber: warm brown boards greyed by the sun, darker grime patches and a\r
          // foot-polished centre band, dark gaps between the boards\r
vec3 wood = vec3(0.43, 0.33, 0.24) * (0.72 + 0.34 * h);\r
vec3 grey = vec3(0.4, 0.38, 0.35) * (0.8 + 0.2 * h);\r
c = mix(wood, grey, 0.35 + 0.4 * nz.g);\r
float grain = texture(tSN, vec2(vWPd.x * 0.9, vUD.y * 11.0 + id * 3.1)).r;\r
c *= 0.82 + 0.3 * grain;\r
c *= 1.0 - 0.32 * smoothstep(0.52, 0.8, texture(tSN, vWPd.xz / 7.0).b);       // grime / wet-rot patches\r
c *= 1.0 - 0.18 * smoothstep(1.2, 3.2, abs(vUD.y));                            // edges darker (less foot traffic)\r
c *= 1.0 - 0.55 * (1.0 - smoothstep(0.0, 0.07 + fwidth(a), min(pl, 1.0 - pl))) * (1.0 - smoothstep(0.2, 0.5, fwidth(a)));\r
} else if(md == 3.0) { // ballast + timber ties every 0.62 m\r
vec3 bal = vec3(0.36, 0.34, 0.31) * (0.7 + 0.5 * texture(tSN, vWPd.xz / 1.3).r);\r
float t = fract(vUD.x / 0.62), tie = step(abs(t - 0.5), 0.2) * step(abs(abs(vUD.y) - 2.3), 1.35);\r
c = mix(bal, vec3(0.22, 0.18, 0.15), tie * (1.0 - smoothstep(0.2, 0.5, fwidth(vUD.x / 0.62))));\r
} else if(md == 4.0) {\r
c = vec3(0.56, 0.55, 0.52) * (0.8 + 0.3 * nz.r);\r
}\r
diffuseColor.rgb *= c;\r
}\r
`,pe=`// canopy shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
out float vCy;\r
out vec3 vCn;\r
out vec3 vCi;\r
// @section vertexBeginVertex\r
#include <begin_vertex>\r
vCy = position.y;\r
vCn = normal;\r
vCi = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;\r
__SHADER_INJECT_0__\r
// @section fragmentCommon\r
#include <common>\r
in float vCy;\r
in vec3 vCn;\r
in vec3 vCi;\r
float cClump;\r
float cH3(vec3 p) {\r
return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);\r
}\r
float cVn(vec3 p) {\r
vec3 i = floor(p), f = fract(p);\r
f = f * f * (3.0 - 2.0 * f);\r
return mix(mix(mix(cH3(i), cH3(i + vec3(1, 0, 0)), f.x), mix(cH3(i + vec3(0, 1, 0)), cH3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(cH3(i + vec3(0, 0, 1)), cH3(i + vec3(1, 0, 1)), f.x), mix(cH3(i + vec3(0, 1, 1)), cH3(i + vec3(1, 1, 1)), f.x), f.y), f.z);\r
}\r
// @section fragmentColor\r
#include <color_fragment>\r
diffuseColor.rgb *= mix(0.45, 1.05, smoothstep(- 0.9, 0.7, vCy));   // dark underside / inner crown\r
diffuseColor.rgb *= 0.92 + 0.16 * fract(sin(dot(floor(vCn * 2.0 + 0.5), vec3(12.9, 78.2, 37.7))) * 4375.5); // clump tone breakup\r
// (round 7) cauliflower foliage clusters: leaf-mass lumps with dark gaps between them (per-crown phase), so the\r
// crowns read as trees, not smooth cotton balls / lollipops\r
cClump = cVn(vCn * 3.3 + vCi * 0.137) * 0.62 + cVn(vCn * 7.9 + vCi * 0.291) * 0.38;\r
diffuseColor.rgb *= mix(0.58, 1.1, smoothstep(0.28, 0.72, cClump));\r
// @section fragmentNormalMaps\r
#include <normal_fragment_maps>\r
{\r
vec3 sx = normalize(dFdx(- vViewPosition)), sy = normalize(dFdy(- vViewPosition));\r
vec2 dh = vec2(dFdx(cClump), dFdy(cClump)) * 2.2;\r
vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);\r
float det = dot(sx, r1);\r
vec3 bn = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));\r
if(det != 0.0) normal = bn;\r
}\r
\r
// @section distanceFade\r
{\r
vec3 ic = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;\r
float fs = smoothstep(__SHADER_INJECT_0__, __SHADER_INJECT_1__, length(ic - cameraPosition));\r
transformed *= max(fs, 1e-3);\r
}\r
`,me=`// waterfront shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in float aTile;\r
out float vTile;\r
out vec2 vCuv;\r
out vec3 vCwp;\r
out float vCny;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vTile = aTile;\r
vCuv = uv;\r
vCwp = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vCny = normal.y;\r
// @section fragmentCommon\r
#include <common>\r
uniform sampler2D tAtlas;\r
uniform sampler2D tNoise;\r
uniform sampler2D tPave;\r
in float vTile;\r
in vec2 vCuv;\r
in vec3 vCwp;\r
in float vCny;\r
float cR;\r
vec3 atlasTile(float t, vec2 q) {\r
vec2 off = vec2(mod(t, 2.0) * 0.5, 0.5 - floor(t / 2.0) * 0.5);\r
return textureGrad(tAtlas, off + 0.002 + fract(q) * 0.496, dFdx(q) * 0.496, dFdy(q) * 0.496).rgb;\r
}\r
vec3 coast() {\r
float t = floor(vTile + 0.5);\r
vec3 p = vCwp;\r
cR = 0.9;\r
vec3 nz = texture(tNoise, p.xz / 47.0 + p.y * 0.01).rgb;\r
vec3 c;\r
if(t < 3.5) {\r
c = atlasTile(t, vCuv);\r
c = pow(c, vec3(0.92)) * 1.05;\r
// soot / rust streaks running down from the coping, broken by noise along the wall\r
float sk = texture(tNoise, vec2(vCuv.x * 0.37 + p.x * 0.003, 0.2 + p.y * 0.006)).r;\r
c *= 1.0 - 0.28 * smoothstep(0.55, 0.85, sk) * (1.0 - abs(vCny));\r
c *= 0.86 + 0.28 * nz.g;\r
} else if(t < 4.5) {\r
c = vec3(1.0);\r
cR = 0.55;\r
} else if(t < 5.5) { // lawn: mown turf, darker clover patches, worn edges\r
float n2 = texture(tNoise, p.xz / 9.0).g;\r
c = mix(vec3(0.085, 0.115, 0.045), vec3(0.14, 0.15, 0.065), n2) * (0.85 + 0.3 * nz.r);\r
c *= 0.94 + 0.06 * step(0.5, fract(p.x / 3.0 + p.z / 7.0));\r
cR = 0.95;\r
} else if(t < 6.5) { // promenade pavers (hex / running bond like the esplanade fill in ground.ts)\r
c = texture(tPave, p.xz / 6.0).rgb;\r
vec2 hp = p.xz / vec2(0.9, 0.78);\r
float row = floor(hp.y), cu = fract(hp.x + 0.5 * mod(row, 2.0)), cv = fract(hp.y);\r
float jn = 1.0 - smoothstep(0.0, 0.07, min(min(cu, 1.0 - cu), min(cv, 1.0 - cv)));\r
float fwp = clamp(fwidth(hp.x) * 2.0, 0.0, 1.0);\r
c *= vec3(0.8, 0.77, 0.73) * (1.0 - 0.2 * jn * (1.0 - fwp)) * (0.9 + 0.2 * nz.r);\r
cR = 0.86;\r
} else if(t > 7.5) { // (r2) ribbed / slatted sheet metal: ribs along u (roofs, every 0.3 m) or v (roll-up doors, 0.12 m)\r
float q = t < 8.5 ? vCuv.x / 0.3 : vCuv.y / 0.12, f = fract(q), aa = clamp(fwidth(q), 0.0, 1.0);\r
float rib = mix(0.82 + 0.3 * smoothstep(0.35, 0.5, f) * (1.0 - smoothstep(0.5, 0.65, f)), 1.0, aa);\r
c = vec3(rib) * (0.85 + 0.25 * nz.r) * (1.0 - 0.25 * smoothstep(0.6, 0.9, texture(tNoise, p.xz / 9.0 + p.y * 0.05).g));\r
cR = 0.6;\r
} else { // picket card: vertical steel bars every 11.5 cm\r
float f = fract(vCuv.x / 0.115), aa = fwidth(vCuv.x / 0.115);\r
if(aa < 0.35 && abs(f - 0.5) > 0.09 + aa) discard;\r
c = vec3(1.0);\r
cR = 0.55;\r
}\r
// water line: wet dark band + green-black algae up to ~1 m above the water, darker still below it\r
float yw = p.y - __SHADER_INJECT_0__;\r
float wetTop = 0.75 + 0.45 * nz.b;\r
float wet = 1.0 - smoothstep(wetTop - 0.35, wetTop, yw);\r
c = mix(c, c * vec3(0.42, 0.47, 0.36), wet * 0.85);\r
c *= mix(1.0, 0.45, 1.0 - smoothstep(- 0.6, 0.05, yw));\r
cR = mix(cR, 0.35, wet * 0.8);\r
c *= mix(1.0, 0.82, smoothstep(250.0, 1100.0, length(p - cameraPosition)));\r
return c;\r
}\r
// @section fragmentMap\r
diffuseColor.rgb = coast();\r
// @section fragmentRoughness\r
float roughnessFactor = cR;\r
`,he=`// ground shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in vec3 aRoad;\r
out vec3 vWP;\r
out vec3 vRoad;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vRoad = aRoad;\r
// @section fragmentCommon\r
#include <common>\r
uniform sampler2D tCol;\r
uniform sampler2D tNrm;\r
uniform sampler2D tMacro;\r
uniform sampler2D tNoise;\r
in vec3 vWP;\r
in vec3 vRoad;\r
uniform sampler2D tDec;\r
vec3 aN;\r
float aR;\r
float gDecR = 0.0; // (textures r3)\r
vec3 asphalt() {\r
vec2 p = vWP.xz;\r
vec3 c = texture(tCol, p / 6.0).rgb * 0.88; // (textures r4) critic: 'street asphalt light grey and clean' -> darker binder\r
vec3 c2 = texture(tCol, vec2(p.y, - p.x) / 7.3 + 0.37).rgb * 0.88;\r
c = mix(c, c2, 0.35);\r
vec3 nd = texture(tNrm, p / 6.0).rgb;\r
vec3 m = texture(tMacro, p / 64.0).rgb;\r
vec3 m2 = texture(tMacro, vec2(- p.y, p.x) / 151.0 + 0.5).rgb;\r
vec3 nz = texture(tNoise, p / 97.0).rgb;\r
float bright = (0.8 + 0.4 * m.r) * (0.88 + 0.24 * m2.r) * (0.94 + 0.12 * nz.r); // gentle macro variation (was blotchy)\r
c *= bright;\r
// (no crack lines: user feedback - roads read as uniform, softly worn asphalt; refs/road)\r
// lanes / tyre grime\r
// road rect kind (vRoad.x: 0 avenue, 1 street, 2 intersection) + centre line (vRoad.y) from the geometry\r
int rk = int(vRoad.x + 0.5);\r
float ax = p.x - vRoad.y, sz = p.y - vRoad.z;\r
bool onAv = rk != 1, onSt = rk != 0;\r
float track = 0.0, oil = 0.0, gutter = 0.0;\r
if(onAv && ! onSt) {\r
float l = mod(ax + 10.8, 3.6) - 1.8;\r
track = exp(- pow((abs(l) - 0.85) / 0.3, 2.0));\r
oil = exp(- pow(l / 0.45, 2.0));\r
gutter = 1.0 - smoothstep(0.0, 0.8, 11.0 - abs(ax));\r
} else if(onSt && ! onAv) {\r
float l = sz;\r
track = exp(- pow((abs(l) - 0.9) / 0.35, 2.0)) * 0.8;\r
oil = exp(- pow(l / 0.5, 2.0));\r
float sh = 5.0 + (vRoad.x - 1.0) * 100.0; // (layout2 r9) per-street half width\r
if(sh > 6.0) {\r
float l2 = mod(abs(sz), 3.3) - 1.65;\r
track = exp(- pow((abs(l2) - 0.85) / 0.3, 2.0)) * 0.8;\r
oil = exp(- pow(l2 / 0.45, 2.0));\r
} // two lanes each way\r
gutter = 1.0 - smoothstep(0.0, 0.7, sh - abs(sz));\r
} else if(onSt && onAv) {\r
track = 0.25;\r
oil = 0.3;\r
}\r
float tv = 0.6 + 0.4 * nz.g;\r
c *= 1.0 - 0.2 * track * tv; // soft tyre-wear lanes (street r6: 0.14 -> 0.2)\r
float stain = m.b * oil;\r
c *= 1.0 - 0.2 * stain - 0.05 * oil * nz.b; // faint, broad (no dark lane-centre streaks)\r
c *= 1.0 - 0.36 * gutter * (0.6 + 0.4 * nz.b); // (street r6) darker wet kerb gutter\r
c = mix(c, c * vec3(0.95, 0.93, 0.9), gutter);\r
// patches: soft, broad darker areas only (low-frequency noise, no hard edges or seams)\r
float patchN = smoothstep(0.62, 0.78, texture(tNoise, p / 41.0 + 0.23).b) * 0.6;\r
c *= 1.0 - 0.14 * patchN;\r
// (street r6) critic: 'road too clean'. Mid-scale blotches: parked-car oil drips + dried spill stains (irregular,\r
// 0.5-2 m, from two noise octaves), strongest in the parking / curb lanes (gutter side), faint mid-road.\r
{\r
float s1 = texture(tNoise, p / 3.7 + 0.61).g, s2 = texture(tNoise, p / 1.3 + 0.17).r;\r
float blot = smoothstep(0.66, 0.8, s1 * 0.75 + s2 * 0.35);\r
float curbLane = rk == 0 ? smoothstep(6.5, 8.5, abs(ax)) : (rk == 1 ? smoothstep(2.0, 3.2, abs(sz)) : 0.3);\r
c *= 1.0 - blot * (0.1 + 0.2 * curbLane);\r
}\r
// (street r3) lane-by-lane repaving: whole-lane sections milled + resurfaced at different times (crisp straight\r
// edges on the lane lines, lighter older / darker fresher asphalt) like the refs' patchwork avenues. No cracks.\r
{\r
float li, lane0, along, cw;\r
if(rk == 0) {\r
li = floor((ax + 10.8) / 3.6);\r
along = p.y;\r
cw = 3.6;\r
lane0 = ax + 10.8 - li * 3.6;\r
} else if(rk == 1) {\r
li = sz < 0.0 ? 30.0 : 31.0;\r
along = p.x;\r
cw = 5.0;\r
lane0 = abs(sz);\r
} else {\r
li = 40.0 + floor(p.x / 9.0);\r
along = p.y;\r
cw = 9.0;\r
lane0 = mod(p.x, 9.0);\r
}\r
float seg = floor(along / 23.0 + li * 0.37);\r
float hh = fract(sin(dot(vec3(li, seg, vRoad.y * 0.013 + vRoad.z * 0.007), vec3(12.9898, 78.233, 37.719))) * 43758.5453);\r
float fu = fract(along / 23.0 + li * 0.37);\r
float edge = smoothstep(0.0, 0.004, fu) * smoothstep(1.0, 0.996, fu) * smoothstep(0.0, 0.04, lane0) * smoothstep(cw, cw - 0.04, lane0);\r
float rp = hh < 0.16 ? 1.13 : hh < 0.3 ? 0.84 : hh < 0.36 ? 1.22 : 1.0;\r
c *= mix(1.0, rp, edge * (0.75 + 0.25 * nz.r));\r
}\r
// (street r11) critic: 'road clean, no patches / stains'. Utility-cut restorations: sharp-edged rectangles of\r
// fresher (darker) or older (paler) tar, 1-4 m, ~1 per 3 cells of 11 m; a thin sealant rim; plus broad dark\r
// oil pools in the stop lanes approaching the intersections (no crack lines: user rule)\r
{\r
vec2 cg = vec2(11.0, 13.0), cid2 = floor(p / cg), cf = p - cid2 * cg;\r
float h1 = fract(sin(dot(cid2, vec2(41.31, 17.77))) * 23758.54), h2 = fract(h1 * 73.1 + 0.3), h3 = fract(h1 * 11.7 + 0.61);\r
float fwp = fwidth(p.x) * 1.2 + 1e-3;\r
if(h1 < 0.34 && rk != 2) {\r
vec2 hs = vec2(0.6 + 1.6 * h2, 0.5 + 1.1 * h3), cc2 = vec2(2.0 + h3 * 7.0, 2.0 + h2 * 9.0);\r
vec2 dq = abs(cf - cc2) - hs;\r
float inP = 1.0 - smoothstep(- fwp, fwp, max(dq.x, dq.y));\r
float rim = (1.0 - smoothstep(0.0, 0.07 + fwp, abs(max(dq.x, dq.y))));\r
c *= mix(1.0, h2 < 0.6 ? 0.72 : 1.18, inP * (0.85 + 0.3 * nz.g)); // (street r12) 0.8 / 1.12 -> 0.72 / 1.18: readable from rooftop height\r
c *= 1.0 - 0.22 * rim;\r
}\r
// (street r12) critic (ref 16): 'road is uniform dark asphalt; add patching'. Long utility trench restorations:\r
// 0.9-1.4 m wide strips running 4-11 m across or along the lanes, a few per block, crisp sealed edges\r
if(rk != 2) {\r
vec2 tg = vec2(29.0, 37.0), tid = floor(p / tg), tf2 = p - tid * tg;\r
float t1 = fract(sin(dot(tid, vec2(12.71, 91.37))) * 43758.55), t2 = fract(t1 * 57.3 + 0.21), t3 = fract(t1 * 19.9 + 0.77);\r
if(t1 < 0.42) {\r
bool acr = t2 < 0.5;\r
vec2 hs2 = acr ? vec2(2.0 + 3.5 * t3, 0.45 + 0.25 * t2) : vec2(0.45 + 0.25 * t3, 2.0 + 3.5 * t2);\r
vec2 c3 = vec2(6.0 + t3 * 17.0, 6.0 + t2 * 25.0);\r
vec2 dq2 = abs(tf2 - c3) - hs2;\r
float dd = max(dq2.x, dq2.y);\r
float inT = 1.0 - smoothstep(- fwp, fwp, dd);\r
c *= mix(1.0, t3 < 0.55 ? 0.66 : 1.2, inT * (0.8 + 0.4 * nz.b));\r
c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.06 + fwp, abs(dd)));\r
}\r
}\r
vec2 op = p / 2.3 + 0.17;\r
float pool = smoothstep(0.62, 0.82, texture(tNoise, op).r * 0.7 + texture(tNoise, op * 2.9).g * 0.4) * (rk == 2 ? 0.3 : oil);\r
c *= 1.0 - 0.25 * pool;\r
}\r
// (textures r3) critic: 'asphalt uniform noise, no patches, cracks, tyre marks'. Photographic repair decals\r
// ($imagegen sheet, asphalt_decals.webp: 8 cells of colour ratio vs plain asphalt): fresh / old sealed utility cuts,\r
// trench strips, pothole fills, oil stains, skid marks, manholes in a new-asphalt collar, patch clusters. One\r
// candidate per 8 m cell (~55 % used), random size / quarter-turn / mirror, jittered inside the cell. One texture\r
// tap with explicit gradients (no mip seams at the cell borders).\r
{\r
vec2 dcg = p / 8.0, dci = floor(dcg), dcf = dcg - dci;\r
vec2 dqx = dFdx(p), dqy = dFdy(p); // uniform control flow\r
float e1 = fract(sin(dot(dci, vec2(27.17, 61.93))) * 43758.5453), e2 = fract(e1 * 43.7 + 0.13), e3 = fract(e1 * 7.31 + 0.71);\r
if(e1 < 0.55) {\r
float k = e1 < 0.03 ? 6.0 : floor(e2 * 7.999);\r
if(k > 5.5) k = e1 < 0.03 ? 6.0 : 7.0; // manholes rarer (street decals have them)\r
float sz = (k > 5.5 && k < 6.5) ? 1.5 : (1.3 + 1.4 * e3); // decal cell = sz x 2 sz (m)\r
vec2 ctr = 0.5 + (vec2(e2, e3) - 0.5) * (1.0 - vec2(2.0 * sz, 2.0 * sz) / 8.0);\r
vec2 q = (dcf - ctr) * 8.0; // metres from the decal centre\r
if(e3 < 0.5) {\r
q = q.yx;\r
dqx = dqx.yx;\r
dqy = dqy.yx;\r
}\r
if(fract(e1 * 91.1) < 0.5) {\r
q.x = - q.x;\r
dqx.x = - dqx.x;\r
dqy.x = - dqy.x;\r
}\r
vec2 du = q / vec2(sz, 2.0 * sz) + 0.5;\r
if(all(greaterThan(du, vec2(0.0))) && all(lessThan(du, vec2(1.0)))) {\r
vec2 cc = vec2(mod(k, 4.0), floor(k / 4.0));\r
vec2 duv = vec2((cc.x + du.x) / 4.0, 1.0 - (cc.y + 1.0 - du.y) / 2.0);\r
vec2 gs = vec2(1.0 / (4.0 * sz), 1.0 / (4.0 * sz));\r
vec3 dr = textureGrad(tDec, duv, dqx * gs, dqy * gs).rgb * 2.0;\r
c *= mix(vec3(1.0), dr, 0.9);\r
gDecR = clamp(1.0 - dot(dr, vec3(0.333)), 0.0, 0.6);\r
}\r
}\r
}\r
c *= vec3(0.97, 0.99, 1.03); // slightly blue-grey, faded\r
// aerial LOD tone: seen from afar, grime, oil, parked cars and kerb shadows aggregate -> the road reads darker than\r
// the sidewalks (the street grid stays legible from the rooftops instead of washing into pale strips)\r
float adist = length(vWP - cameraPosition);\r
c *= mix(1.0, 0.74, smoothstep(80.0, 600.0, adist)); // (round 7: 0.66 -> 0.52; round 10: 0.74 -- critic: streets read as dark trenches, not grey asphalt)\r
// (street agent r1) street-level tone: up close the refs' asphalt is a dark blue-grey, about half the sidewalk's\r
// value; fades out by 260 m so the rooftop / aerial read (above) is unchanged\r
c *= mix(0.8, 1.0, smoothstep(110.0, 260.0, adist)); // (street r3: 0.64 -> 0.7; r4: 0.8, refs 16 / 04 sunlit asphalt reads mid-grey so the wear decals show)\r
// (round 10) aerial traffic impostor: beyond the simulated-traffic radius the lanes carry static car-sized\r
// shapes (muted liveries, yellow cabs, a dark cast-shadow sliver), so the grid reads busy from altitude like the\r
// refs instead of empty trenches. Fades in past 260 m (the real vehicles cover the near field).\r
float tf = smoothstep(240.0, 420.0, adist);\r
if(tf > 0.0 && rk != 2) {\r
float lane, along, lw, gap;\r
vec2 cid;\r
if(rk == 0) {\r
float li = floor((ax + 10.8) / 3.6);\r
lane = ax - (li * 3.6 - 9.0);\r
along = p.y;\r
gap = 8.5;\r
cid = vec2(li, vRoad.y);\r
lw = 1.0;\r
} else {\r
float li = sz < 0.0 ? 0.0 : 1.0;\r
lane = sz - (li < 0.5 ? - 2.3 : 2.3);\r
along = p.x;\r
gap = 7.6;\r
cid = vec2(li + 20.0, vRoad.z);\r
lw = 0.8;\r
}\r
float cell = floor(along / gap), u = along - cell * gap - gap * 0.5;\r
float h1 = fract(sin(dot(vec3(cid, cell), vec3(12.9898, 78.233, 37.719))) * 43758.5453);\r
float h2 = fract(h1 * 91.3171 + 0.123);\r
// denser bunching (platoons at lights): block-scale density wave along the road\r
float dens = (rk == 0 ? 0.5 : 0.32) * lw * (0.55 + 0.9 * texture(tNoise, vec2(along / 260.0, cid.x * 0.13 + cid.y * 0.001)).r);\r
if(h1 < dens) {\r
float L = h2 < 0.12 ? 3.4 : (h2 > 0.92 ? 3.9 : 2.25), Wd = h2 > 0.92 ? 1.25 : 0.92; // half extents (bus / van / car)\r
float du = abs(u + (h2 - 0.5) * 1.6) - L, dv = abs(lane) - Wd;\r
float inside = 1.0 - smoothstep(- 0.25, 0.25, max(du, dv));\r
float shadowS = 1.0 - smoothstep(- 0.3, 0.4, max(du, abs(lane - 0.9) - Wd));\r
float hc = fract(h2 * 37.77);\r
vec3 cc = hc < 0.22 ? vec3(0.62, 0.48, 0.12) : hc < 0.42 ? vec3(0.55, 0.55, 0.54) : hc < 0.6 ? vec3(0.05, 0.05, 0.055) : hc < 0.72 ? vec3(0.34, 0.35, 0.36) : hc < 0.8 ? vec3(0.36, 0.1, 0.08) : hc < 0.88 ? vec3(0.12, 0.17, 0.26) : vec3(0.46, 0.45, 0.42);\r
if(h2 > 0.92) cc = vec3(0.5, 0.52, 0.55); // buses / box vans: pale roofs\r
c = mix(c, c * 0.55, shadowS * tf * 0.8);\r
c = mix(c, cc, inside * tf);\r
}\r
}\r
aR = clamp(nd.b + 0.05 - 0.25 * stain - 0.08 * track, 0.35, 1.0);\r
aR = clamp(aR - 0.45 * gDecR, 0.35, 1.0); // (textures r3) fresh tar / oil decals are glossier\r
// (foundation r13) critic: 'avenue to the horizon is a thin bright white line'. Far away the grazing view of the\r
// worn, oily surface glared as a mirror-bright strip against the sun: from ~0.3 km the aggregate (cars, grime,\r
// kerb shadows, repairs) goes fully matte and a step darker, so avenues read as dark cuts to the horizon\r
aR = mix(aR, 1.0, smoothstep(300.0, 1100.0, adist));\r
c *= mix(1.0, 0.8, smoothstep(700.0, 2200.0, adist));\r
vec2 nxy = nd.rg * 2.0 - 1.0;\r
aN = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));\r
return c;\r
}\r
// @section fragmentMap\r
diffuseColor.rgb = asphalt();\r
// @section fragmentRoughness\r
float roughnessFactor = aR;\r
// @section fragmentNormalMaps\r
{\r
vec3 nw = normalize(vec3(aN.x, aN.z, aN.y));\r
normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);\r
}\r
// @section vertexCommonByWorldPosition\r
#include <common>\r
in vec4 aRect;\r
out vec4 vRect;\r
out vec3 vWP;\r
out vec3 vWN;\r
// @section vertexFogVertexByWorldPosition\r
#include <fog_vertex>\r
vRect = aRect;\r
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vWN = normal;\r
// @section fragmentCommonByWorldPosition\r
#include <common>\r
uniform sampler2D tCol;\r
uniform sampler2D tNrm;\r
uniform sampler2D tNoise;\r
uniform sampler2D tCurb;\r
in vec4 vRect;\r
in vec3 vWP;\r
in vec3 vWN;\r
vec3 sN = vec3(0.0, 0.0, 1.0);\r
float sR = 0.85;\r
float curbJ(float a, float fw) {\r
float x = abs(fract(a / 2.4) - 0.5) * 2.4, w = max(0.012, fw * 1.5);\r
return 0.45 * smoothstep(1.2 - w, 1.2, x) * (0.012 / w);\r
} // (textures r2) curbstone joints, AA\r
void walk(out vec3 walkColor) {\r
vec2 p = vWP.xz;\r
vec2 fwP = fwidth(p); // (textures r2) uniform control flow\r
vec3 nz = texture(tNoise, p / 53.0).rgb;\r
float d = min(min(p.x - vRect.x, vRect.z - p.x), min(p.y - vRect.y, vRect.w - p.y));\r
if(vWN.y < 0.5) {\r
          // curb face: weathered concrete/granite, dirtier near the gutter\r
vec2 q = vec2(p.x + p.y, vWP.y) / 1.3;\r
vec3 c = texture(tCurb, q).rgb * 0.92; // (textures r2) $imagegen granite curbstone (was the sidewalk sheet)\r
c *= 1.0 - curbJ(p.x + p.y, fwP.x + fwP.y); // 2.4 m stone joints\r
c *= mix(0.55, 1.0, smoothstep(- 0.02, 0.14, vWP.y));\r
sR = 0.85;\r
sN = vec3(0.0, 0.0, 1.0);\r
walkColor = c;\r
return;\r
}\r
vec2 uv = p / 6.0; // (textures) imagegen sidewalk sheet holds 4 x 4 slabs -> 1.5 m (5 ft) NYC slabs\r
vec3 c = texture(tCol, uv).rgb;\r
vec3 n = texture(tNrm, uv).rgb;\r
float curb = 1.0 - smoothstep(0.26, 0.3, d);\r
if(curb > 0.0) {\r
vec3 cc = texture(tCurb, p / 1.1 + 0.3).rgb * 0.97; // (textures r2) granite curb top + 2.4 m joints\r
float cAl = (min(p.x - vRect.x, vRect.z - p.x) < min(p.y - vRect.y, vRect.w - p.y)) ? p.y : p.x;\r
cc *= 1.0 - curbJ(cAl, max(fwP.x, fwP.y));\r
c = mix(c, cc, curb);\r
n = mix(n, vec3(0.5, 0.5, 0.7), curb);\r
}\r
c *= 0.93 + 0.14 * nz.r; // subtle slab-to-slab variation (refs/road/road_2_sidewalk)\r
c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 1.2, abs(d - 0.3))) * nz.b;\r
// (foundation r13) critic: 'streets from altitude read as blank white stripes', 'riverfront edges are ruler-\r
// straight white strips'. Aerial LOD tone: grime, tree pits, street furniture and kerb shadows aggregate, so from\r
// the rooftops / the air the sidewalks sit a step darker (no change within 150 m). Promenade / plaza fill pieces\r
// (vRect unset) are laid in warmer, darker hex / brick pavers like the East River + Hudson esplanades.\r
{\r
float adist = length(vWP - cameraPosition);\r
c *= mix(1.0, 0.78, smoothstep(150.0, 900.0, adist));\r
if(vRect.x < - 5e4) {\r
vec2 hp = p / vec2(0.9, 0.78);\r
float row = floor(hp.y), cu = fract(hp.x + 0.5 * mod(row, 2.0)), cv = fract(hp.y);\r
float jn = 1.0 - smoothstep(0.0, 0.07, min(min(cu, 1.0 - cu), min(cv, 1.0 - cv)));\r
float fwp = clamp(fwidth(hp.x) * 2.0, 0.0, 1.0);\r
c *= vec3(0.86, 0.82, 0.77) * (1.0 - 0.18 * jn * (1.0 - fwp));\r
c *= mix(1.0, 0.9, smoothstep(120.0, 600.0, adist));\r
}\r
}\r
sR = mix(n.b, 1.0, smoothstep(300.0, 1100.0, length(vWP - cameraPosition))); // (r13) matte from afar (no grazing glare strips)\r
vec2 nxy = n.rg * 2.0 - 1.0;\r
sN = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));\r
walkColor = c;\r
}\r
// @section fragmentMapWalkingSurface\r
vec3 walkColor;\r
walk(walkColor);\r
diffuseColor.rgb = walkColor;\r
// @section fragmentRoughnessWalkingSurface\r
float roughnessFactor = sR;\r
// @section fragmentNormalMapsByWorldNormal\r
if(vWN.y > 0.5) {\r
vec3 nw = normalize(vec3(sN.x, sN.z, sN.y));\r
normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);\r
}\r
// @section vertexCommonDistantGrass\r
#include <common>\r
out vec3 vWP;\r
// @section vertexFogVertexDistantGrass\r
#include <fog_vertex>\r
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
// @section fragmentCommonGrassSurface\r
#include <common>\r
uniform sampler2D tCol;\r
uniform sampler2D tNoise;\r
in vec3 vWP;\r
uniform vec4 uMd[__SHADER_INJECT_0__];\r
uniform float uMa[__SHADER_INJECT_1__];\r
uniform vec4 uPw[__SHADER_INJECT_2__];\r
uniform float uPa[__SHADER_INJECT_3__];\r
uniform vec4 uPh[__SHADER_INJECT_4__];\r
uniform float uPq[__SHADER_INJECT_5__];\r
float pondD(vec2 p, vec4 e, float a, vec4 h, float wq) { // same outline function as layout.ts PARK_WATER\r
vec2 d = p - e.xy;\r
float c = cos(a), s = sin(a);\r
vec2 q = vec2((d.x * c - d.y * s) / e.z, (d.x * s + d.y * c) / e.w);\r
float t = atan(q.y, q.x);\r
float k = 1.0 + 0.08 * sin(t * 3.0 + e.x) + 0.05 * sin(t * 5.0 + e.y * 0.1) + h.x * sin(t * 2.0 + 0.7) + h.y * sin(t * 3.0 + 2.1) + h.z * cos(t * 4.0) + h.w * sin(t * 5.0 + 4.2) + wq * (sin(t * 7.0 + e.x * 0.05) + 0.7 * sin(t * 11.0 + e.y * 0.03) + 0.45 * sin(t * 17.0 + 1.9)); // (round 7)\r
return length(q) / k;\r
}\r
float pkFld(vec2 p, float f, float ph) { // (park r3) = trees.ts fld(): open-woodland field\r
return 0.5 + 0.5 * (0.55 * sin(p.x * f + ph) * cos(p.y * f * 0.83 - ph * 1.7) + 0.3 * sin((p.x * 0.6 - p.y * 0.8) * f * 2.1 + ph * 2.3) + 0.15 * sin((p.x * 0.9 + p.y * 0.4) * f * 4.3 + ph * 0.7));\r
}\r
float ellD(vec2 p, vec4 e, float a, float w1, float w2, float ph2) {\r
vec2 d = p - e.xy;\r
float c = cos(a), s = sin(a);\r
vec2 q = vec2((d.x * c - d.y * s) / e.z, (d.x * s + d.y * c) / e.w);\r
float ang = atan(q.y, q.x);\r
return length(q) / (1.0 + w1 * sin(ang * 3.0 + e.x) + w2 * sin(ang * 5.0 + e.y * ph2));\r
}\r
// @section fragmentMapGrassSurface\r
{\r
vec2 p = vWP.xz;\r
vec3 c = texture(tCol, p / 6.0).rgb;\r
vec3 c2 = texture(tCol, p.yx / 23.0).rgb;\r
vec3 nz = texture(tNoise, p / 140.0).rgb, nz2 = texture(tNoise, p / 37.0).rgb;\r
c = mix(c, c2, 0.4) * (0.78 + 0.4 * nz.r);\r
c = mix(c, vec3(dot(c, vec3(0.3, 0.55, 0.15))), 0.32) * vec3(0.84, 0.84, 0.74); // muted, late-season\r
// meadows: mowed, lighter, a faint mowing stripe; outside: shaded woodland floor (leaf litter, moss) under groves\r
float m = 9.0;\r
for(int i = 0;\r
i < __SHADER_INJECT_0__;\r
i ++) m = min(m, ellD(p, uMd[i], uMa[i], 0.09, 0.06, 1.0));\r
float grove = sin(p.x * 0.021 + 1.3) * cos(p.y * 0.017 - 0.7) + 0.6 * sin(p.x * 0.047 - p.y * 0.031 + 2.1) + 0.35 * sin(p.y * 0.083 + p.x * 0.012);\r
grove = clamp(0.75 + grove * 0.45, 0.0, 1.0) * smoothstep(1.0, 1.3, m); // (round 6: +0.3, matches the denser fill canopy)\r
grove *= 1.0 - 0.8 * smoothstep(0.56, 0.7, pkFld(p, 1.0 / 55.0, 4.1)); // (park r3) open woodland: lawn between scattered trees\r
vec3 floorC = mix(vec3(0.19, 0.18, 0.09), vec3(0.26, 0.2, 0.11), nz2.g) * (0.8 + 0.25 * nz.b); // (park r9) was near-black (0.1,0.1,0.05): read as holes on the Great Lawn where no crowns cover it\r
c = mix(c, floorC, smoothstep(0.25, 0.65, grove) * __SHADER_INJECT_1__);\r
float meadow = __SHADER_INJECT_2__;\r
{ // (park r3) mowing stripes (alternating direction per ~60 m patch) + brown wear patches on the lawns\r
float dirSel = step(0.5, texture(tNoise, p / 900.0).g);\r
float sf = fract(mix(p.x, p.y, dirSel) / 6.5 + 0.1 * nz.r);\r
float strp = smoothstep(0.42, 0.5, sf) * (1.0 - smoothstep(0.92, 1.0, sf)); // (park r10) critic r9: 'no mowing stripes' -> stronger, soft-edged\r
c = mix(c, c * vec3(1.1, 1.14, 1.0) * (0.88 + 0.22 * strp), meadow);\r
float wear = smoothstep(0.6, 0.78, texture(tNoise, p / 29.0 + vec2(0.33, 0.77)).r) * smoothstep(0.35, 0.65, nz2.b);\r
c = mix(c, vec3(0.3, 0.26, 0.17) * (0.85 + 0.3 * nz2.g), wear * 0.55 * meadow);\r
}\r
// (round 10) lawn texture at mid range (critic: 'large flat blurry green'): trodden desire lines, clover / weed\r
// patches, dry spots and soft mower-turn arcs, all low-contrast\r
{\r
vec3 q1 = texture(tNoise, p / 11.0 + vec2(0.19, 0.53)).rgb, q2 = texture(tNoise, p / 3.3 + vec2(0.61, 0.07)).rgb;\r
float clover = smoothstep(0.55, 0.75, q1.r) * 0.5 + smoothstep(0.6, 0.8, q2.g) * 0.25;\r
c = mix(c, c * vec3(0.8, 0.9, 0.78), clover * meadow);\r
float dry = smoothstep(0.62, 0.8, q1.b) * smoothstep(0.4, 0.7, nz2.r);\r
c = mix(c, vec3(0.34, 0.31, 0.2) * (0.8 + 0.3 * q2.r), dry * 0.45 * meadow);\r
float trod = 1.0 - smoothstep(0.0, 1.2, abs(sin(p.x * 0.011 + p.y * 0.019 + 3.0 * nz.g) * 60.0));\r
c = mix(c, vec3(0.3, 0.28, 0.2), trod * 0.35 * meadow * smoothstep(0.45, 0.6, nz.b));\r
c *= 0.93 + 0.14 * q2.b;\r
}\r
// worn / leaf-covered patches (fewer on the lawns)\r
c = mix(c, vec3(0.4, 0.28, 0.13), smoothstep(0.58, 0.82, nz.g) * 0.5 * (1.0 - meadow));\r
// (round 5) broad tonal variation: dry straw-olive swathes vs lush darker grass (never one flat green plane)\r
vec3 nzL = texture(tNoise, p / 420.0 + vec2(0.37, 0.11)).rgb;\r
c *= mix(vec3(0.86, 0.9, 0.84), vec3(1.12, 1.04, 0.86), smoothstep(0.3, 0.75, nzL.r));\r
c *= 0.85 + 0.3 * smoothstep(0.2, 0.8, nzL.b);\r
// (round 5) Manhattan-schist outcrops: grey-brown rock shelves with dark joints, at meadow edges and in the woods\r
float ro = texture(tNoise, p / 55.0 + vec2(0.71, 0.29)).g * 0.7 + texture(tNoise, p / 17.0).b * 0.3;\r
float rock = smoothstep(0.66, 0.7, ro) * smoothstep(0.95, 1.25, m) * __SHADER_INJECT_3__;\r
vec3 rc = mix(vec3(0.3, 0.29, 0.27), vec3(0.44, 0.42, 0.39), nz2.r) * (0.8 + 0.3 * texture(tNoise, p / 3.0).r);\r
rc *= 1.0 - 0.45 * smoothstep(0.55, 0.62, fract((p.x * 0.8 + p.y * 0.6) / 2.3 + nz2.g)); // foliation joints\r
c = mix(c, rc, rock * 0.9);\r
// ball-field infields (skinned fan-shaped infields with a grass diamond) on the Great-Lawn / North-Meadow-like meadows\r
for(int i = 1;\r
i < __SHADER_INJECT_4__;\r
i ++) {\r
for(int k = 0;\r
k < 4;\r
k ++) {\r
if(i == 2 && (k == 1 || k == 2)) continue;                 // (round 4) fewer, varied fields: 4 + 2\r
float fk = float(i * 4 + k);\r
vec2 hp = uMd[i].xy + vec2(float(k & 1) * 2.0 - 1.0, float(k >> 1) * 2.0 - 1.0) * uMd[i].zw * vec2(0.55 + 0.08 * sin(fk * 2.3), 0.5 + 0.08 * cos(fk * 1.7));\r
vec2 dir = normalize(uMd[i].xy - hp);                      // outfield points toward the meadow centre\r
float ra = 0.35 * sin(fk * 3.1 + 0.4);\r
dir = vec2(dir.x * cos(ra) - dir.y * sin(ra), dir.x * sin(ra) + dir.y * cos(ra));\r
float R = 22.0 + 5.0 * fract(fk * 0.618);\r
vec2 d = p - hp;\r
float r = length(d), ca = dot(d, dir) / max(r, 1e-3);\r
float fan = (1.0 - smoothstep(R, R + 1.5, r)) * smoothstep(0.66, 0.72, ca);\r
vec2 q = vec2(dot(d, dir), dot(d, vec2(- dir.y, dir.x)));  // along / across the foul-line bisector\r
vec2 qd = vec2(q.x + q.y, q.x - q.y) * 0.7071;             // diamond axes (foul lines)\r
float gs = R * 0.64;\r
float grassSq = step(1.5, qd.x) * step(1.5, qd.y) * step(qd.x, gs) * step(qd.y, gs);\r
float sand = max(fan * (1.0 - grassSq), 1.0 - smoothstep(2.5, 3.2, length(q - vec2(R * 0.48, 0.0)))); // + pitcher's mound\r
// (park r3) worn infield: darker scuffed base paths / home circle, raked lighter centre, patchy edge into the turf\r
float bp = max(1.0 - smoothstep(0.8, 1.6, abs(qd.x - 1.0)), 1.0 - smoothstep(0.8, 1.6, abs(qd.y - 1.0))) * step(qd.x, gs + 2.0) * step(qd.y, gs + 2.0) * step(- 1.0, min(qd.x, qd.y));\r
vec3 dirt = mix(vec3(0.38, 0.27, 0.18), vec3(0.46, 0.34, 0.23), texture(tNoise, p / 4.0).r) * (0.8 + 0.25 * nz2.r); // (park r7) darker compacted clay (critic r6: 'pale decals')\r
dirt = mix(dirt, vec3(0.27, 0.2, 0.14), max(bp * fan, 1.0 - smoothstep(3.0, 4.5, r)) * 0.65);\r
sand *= smoothstep(0.25, 0.6, texture(tNoise, p / 2.2).g + smoothstep(R - 3.0, R - 0.5, r) * - 0.5 + 0.45);\r
// (park r10) critic r9: 'ballfields are flat decals': a dark lip where the turf edge stands over the skinned\r
// infield + a worn, lighter outfield ring in front of it (depth / wear instead of a pasted shape)\r
float lip = (1.0 - smoothstep(0.0, 0.9, abs(r - R - 0.4))) * smoothstep(0.64, 0.72, ca);\r
float worn = (1.0 - smoothstep(R, R + 9.0, r)) * smoothstep(R - 0.5, R + 1.5, r) * smoothstep(0.55, 0.75, ca);\r
c = mix(c, c * vec3(1.08, 1.03, 0.86), worn * 0.6);\r
c *= 1.0 - 0.3 * lip;\r
c = mix(c, dirt, clamp(sand, 0.0, 1.0) * (0.78 + 0.16 * fract(fk * 0.37))); // (round 6: worn, not stamped; park r2: sand infields read from the air, refs 08 / 09)\r
}\r
}\r
// pond banks: mud / wet stone ring, then damp dark grass\r
float pd = 9.0;\r
for(int i = 0;\r
i < __SHADER_INJECT_5__;\r
i ++) pd = min(pd, (pondD(p, uPw[i], uPa[i], uPh[i], uPq[i]) - 1.0) * max(uPw[i].z, uPw[i].w));\r
float bank = __SHADER_INJECT_6__;\r
vec3 mud = mix(vec3(0.2, 0.17, 0.13), vec3(0.34, 0.32, 0.29), step(0.62, nz2.r)); // mud with stones\r
c = mix(c * (1.0 - 0.35 * (1.0 - smoothstep(3.0, 9.0, pd))), mud, bank);\r
// (round 5) reeds / shrubby shore vegetation: a patchy dark band a few metres back from the waterline\r
float reed = (1.0 - smoothstep(4.0, 11.0 + 5.0 * nz.g, pd)) * smoothstep(1.5, 3.5, pd) * smoothstep(0.35, 0.6, nz2.b);\r
c = mix(c, vec3(0.09, 0.1, 0.045) * (0.8 + 0.4 * nz2.g), reed * __SHADER_INJECT_7__);\r
// (round 6) the Reservoir's running track: a cinder / gravel loop ~5-9 m outside the bank, with its iron fence line\r
{\r
float rd = (pondD(p, uPw[3], uPa[3], uPh[3], uPq[3]) - 1.0) * max(uPw[3].z, uPw[3].w);\r
float eg = 0.9 * (texture(tNoise, p / 7.0).r - 0.5);  // (park r9) ragged grass edges, not a clean ruled band\r
float trk = smoothstep(4.2 + eg, 5.2 + eg, rd) * (1.0 - smoothstep(8.2 - eg, 9.2 - eg, rd));\r
vec3 cin = mix(vec3(0.31, 0.26, 0.21), vec3(0.37, 0.31, 0.25), texture(tNoise, p / 1.7).g) * (0.82 + 0.26 * nz2.r); // darker cinder (critic r8: 'clean white band')\r
cin *= 1.0 - 0.14 * (1.0 - smoothstep(0.3, 1.1, abs(rd - 6.7 + 0.4 * nz.g)));      // worn, compacted running line\r
cin = mix(cin, vec3(0.2, 0.18, 0.15), smoothstep(0.68, 0.8, texture(tNoise, p / 13.0 + vec2(0.4, 0.1)).b) * 0.6); // damp patches\r
c = mix(c, cin, trk * __SHADER_INJECT_8__);\r
c = mix(c, vec3(0.1, 0.1, 0.09), (1.0 - smoothstep(0.2, 0.7, abs(rd - 3.6))) * __SHADER_INJECT_9__);\r
}\r
diffuseColor.rgb = c;\r
}\r
// @section fragmentNormalMapsGrassSurface\r
#include <normal_fragment_maps>\r
{\r
vec2 p = vWP.xz;\r
float e = 3.0;\r
#define GH(q) (texture(tNoise, (q) / 160.0 + vec2(0.27, 0.61)).g * 1.5 + texture(tNoise, (q) / 45.0 + vec2(0.83, 0.13)).r * 0.6)\r
float dx = (GH(p + vec2(e, 0.0)) - GH(p - vec2(e, 0.0))) / (2.0 * e), dz = (GH(p + vec2(0.0, e)) - GH(p - vec2(0.0, e))) / (2.0 * e);\r
#undef GH\r
vec3 nW = normalize(vec3(- dx * 6.0, 1.0, - dz * 6.0));\r
normal = normalize(mix(normal, (viewMatrix * vec4(nW, 0.0)).xyz, 0.85));\r
}\r
// @section vertexCommonByMountainWorldPosition\r
#include <common>\r
out vec3 vWPm;\r
// @section vertexFogVertexByMountainWorldPosition\r
#include <fog_vertex>\r
vWPm = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
// @section fragmentCommonByMountainWorldPosition\r
#include <common>\r
uniform sampler2D tNoiseW;\r
in vec3 vWPm;\r
// @section fragmentMapByMountainWorldPosition\r
#include <map_fragment>\r
{\r
vec3 w1 = texture(tNoiseW, vWPm.xz / 2.3).rgb, w2 = texture(tNoiseW, vWPm.xz / 0.37).rgb;\r
float wear = smoothstep(0.35, 0.8, w1.g * 0.7 + w2.r * 0.5);\r
diffuseColor.a *= 1.0 - 0.45 * wear; // (street r6: 0.25 -> 0.45) critic: 'lane markings perfect and crisp'\r
float chip = smoothstep(0.58, 0.72, texture(tNoiseW, vWPm.xz / 0.11 + 0.37).g);   // chipped thermoplastic\r
diffuseColor.a *= 1.0 - 0.6 * chip * (0.4 + 0.6 * wear);\r
diffuseColor.rgb *= (0.86 + 0.1 * w2.b) * vec3(1.0, 0.985, 0.95); // grimy, slightly yellowed paint\r
// (street r9) critic: 'crosswalks crisp painted stripes with no wear': tyre-grime streaks along both travel\r
// axes (thin in the cross direction, long along it), broad scuffed blotches where the paint is nearly gone\r
float skZ = texture(tNoiseW, vec2(vWPm.x / 0.5, vWPm.z / 14.0) + 0.21).g, skX = texture(tNoiseW, vec2(vWPm.x / 14.0, vWPm.z / 0.5) + 0.63).b;\r
diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.45, 0.8, max(skZ, skX));\r
diffuseColor.a *= 1.0 - 0.5 * smoothstep(0.55, 0.75, texture(tNoiseW, vWPm.xz / 5.3 + 0.11).r);\r
}\r
// @section vertexCommonByPavementWorldPosition\r
#include <common>\r
out vec2 vPU;\r
out vec3 vPW;\r
// @section vertexUvVertex\r
#include <uv_vertex>\r
vPU = uv;\r
// @section vertexFogVertexByPavementWorldPosition\r
#include <fog_vertex>\r
vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
// @section fragmentCommonByPavementWorldPosition\r
#include <common>\r
uniform sampler2D tPN;\r
in vec2 vPU;\r
in vec3 vPW;\r
// @section fragmentMapByPavementUv\r
#include <map_fragment>\r
{\r
vec3 n = texture(tPN, vPW.xz / 9.0).rgb, n2 = texture(tPN, vPW.xz / 2.3).rgb;\r
float e = min(vPU.x, 1.0 - vPU.x);\r
float edge = smoothstep(0.02, 0.2 + 0.12 * n.r, e + 0.08 * (n2.g - 0.5));\r
diffuseColor.a *= edge;\r
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.08, 1.0, 0.86), n.b) * (0.9 + 0.2 * n2.r);\r
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.38, 0.34) * (0.9 + 0.2 * n.r), 0.45);\r
} // park r2: paler walks read from the air (refs 08 / 09)\r
`,ge=`// water shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
out vec3 vWPw;\r
uniform mat4 uTexMat;\r
out vec4 vRefl;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vWPw = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vRefl = uTexMat * vec4(vWPw, 1.0);\r
// @section fragmentCommon\r
#include <common>\r
uniform sampler2D tWN;\r
uniform sampler2D tWNoise;\r
uniform float uWTime;\r
in vec3 vWPw;\r
uniform sampler2D tRefl;\r
uniform float uReflOn;\r
in vec4 vRefl;\r
uniform sampler2D tShore;\r
uniform vec4 uShoreBox;\r
vec3 wN;\r
float wR;\r
float wDist;\r
float wSh = 1.0;\r
vec2 wDisp;\r
float wSlick;\r
float wShore;\r
float wNearS;\r
float wStreak;\r
vec2 wn(vec2 uv) {\r
return texture(tWN, uv).rg * 2.0 - 1.0;\r
}\r
vec3 river() {\r
vec2 p = vWPw.xz;\r
float dist = length(vWPw - cameraPosition);\r
wDist = dist;\r
float t = uWTime;\r
// broad structure: wind slicks (smooth bands) and current streaks along the rivers (z axis)\r
vec3 m1 = texture(tWNoise, p / 900.0 + vec2(0.0, t * 0.0015)).rgb;\r
vec3 m2 = texture(tWNoise, vec2(p.x / 260.0, p.y / 1400.0) + vec2(0.31, t * 0.004)).rgb;\r
float slick = smoothstep(0.52, 0.72, m1.g) * 0.8 + smoothstep(0.62, 0.8, m2.r) * 0.35;\r
// distance to the nearest shore (m, baked 8 m/px map): sheltered, silty water along the bulkheads\r
wShore = 400.0;\r
#ifdef HAS_SHORE\r
wShore = texture(tShore, (p - uShoreBox.xy) / uShoreBox.zw).r * 400.0;\r
#endif\r
float nearS = 1.0 - smoothstep(6.0, 70.0, wShore);\r
// cat's paws: gusts roughen large patches (they read as brighter / hazier sheen from the air)\r
vec3 m3 = texture(tWNoise, p / 520.0 + vec2(t * 0.003, - t * 0.002)).rgb;\r
float gust = smoothstep(0.45, 0.75, m3.b) * (1.0 - slick);\r
slick = clamp(slick + nearS * 0.35, 0.0, 1.0);\r
wSlick = slick;\r
wNearS = nearS;\r
// (round 5) wind rows / current streaks: long thin bands along the rivers (z) that break the sheet into\r
// brighter, rougher lines (the refs' rivers are never one uniform glassy surface)\r
float s1 = texture(tWNoise, vec2(p.x / 34.0, p.y / 520.0) + vec2(t * 0.0008, t * 0.003)).g;\r
float s2 = texture(tWNoise, vec2(p.x / 11.0 + p.y / 900.0, p.y / 260.0) + vec2(0.57, t * 0.005)).r;\r
float streak = smoothstep(0.58, 0.8, s1) * 0.7 + smoothstep(0.66, 0.86, s2) * 0.45;\r
streak *= (1.0 - 0.7 * nearS);\r
wStreak = streak;\r
// wave normals: chop (two directions) + swell, faded with distance and in slicks\r
// (atmosphere r2) the two broad layers are rotated off-axis and amplitude-modulated by the wind field, so their\r
// repeat does not read as a tiling ripple across the whole East River from the air\r
vec2 pr1 = mat2(0.829, - 0.559, 0.559, 0.829) * p, pr2 = mat2(0.438, 0.899, - 0.899, 0.438) * p;\r
float amp = 0.55 + 0.9 * m3.g;\r
vec2 n = wn(p / 9.0 + vec2(t * 0.021, t * 0.013)) * 0.55 + wn(vec2(- p.y, p.x) / 14.0 + vec2(t * - 0.012, t * 0.017)) * 0.45 + wn(pr1 / 53.0 + vec2(t * 0.004, - t * 0.006)) * 0.7 * amp + wn(pr2 / 173.0 + vec2(- t * 0.002, t * 0.003)) * 0.5 * (1.5 - amp * 0.7);\r
float fade = mix(1.0, 0.45, smoothstep(60.0, 2500.0, dist));\r
n *= 0.34 * fade * (1.0 - 0.55 * slick) * (1.0 + 0.8 * gust + 0.6 * streak);\r
// (round 8) far-field wave groups: long swell / wind-row undulation that fades IN with distance, where the chop is\r
// sub-pixel -- the far river breaks into broad mottled sheen bands instead of one flat glossy plate\r
n += (wn(vec2(p.x / 380.0, p.y / 170.0) + vec2(t * 0.0012, - t * 0.002)) * 0.7 + wn(p / 95.0 + vec2(- t * 0.003, t * 0.002)) * 0.45) * 0.15 * smoothstep(300.0, 1800.0, dist) * (1.0 - 0.5 * slick);\r
wN = normalize(vec3(n.x, 1.0, n.y));\r
// mirror distortion: waves smear the reflection vertically (screen space), less in the slicks; (round 5) plus a\r
// mid-scale ripple field that does NOT fade with distance, so far reflections break into wobbly bands\r
vec2 rip = wn(vec2(p.x / 26.0, p.y / 7.0) + vec2(t * 0.011, - t * 0.019)) + 0.6 * wn(p / 61.0 + vec2(- t * 0.006, t * 0.009));\r
wDisp = n * (0.9 - 0.5 * slick) + rip * 0.09 * (1.0 - 0.5 * slick);\r
// roughness (round 5: ~0.1-0.3 like real wind-blown river water): calm slicks, rougher chop / gusts / streaks,\r
// far water rougher to integrate sub-pixel waves\r
wR = clamp(0.09 + 0.08 * (1.0 - slick) + 0.1 * gust + 0.07 * streak + 0.07 * smoothstep(300.0, 5000.0, dist), 0.07, 0.32);\r
// (round 8) far wind fields: broad rough / glassy patches that stay visible at 1-4 km (hazier vs mirror sheen)\r
wR = clamp(wR + (texture(tWNoise, p / 1500.0 + vec2(0.13, t * 0.0006)).g - 0.5) * 0.22 * smoothstep(400.0, 1500.0, dist), 0.06, 0.34);\r
#ifndef NO_SSR\r
wR = max(wR + 0.05, 0.13); // (atmosphere r2) ponds / reservoir: wind-ruffled, the cloud reflection is never a crisp cubemap\r
#endif\r
// body colour: deep muted green-grey, turbid variation; silty olive-brown along the shores, a little deeper /\r
// bluer mid-channel (depth), current streaks along the rivers\r
vec3 c = vec3(__SHADER_INJECT_0__);\r
c *= 0.85 + 0.3 * m1.r;\r
c = mix(c, vec3(0.07, 0.085, 0.075), smoothstep(0.4, 0.8, m2.b) * 0.5);\r
c = mix(c, vec3(0.06, 0.066, 0.055), nearS * 0.55);\r
c = mix(c, c * vec3(0.8, 0.9, 1.05), smoothstep(150.0, 400.0, wShore));\r
c *= 1.0 + 0.25 * streak;\r
// (round 7) wash line: a broken pale band of churned water / flotsam hugging bulkheads and pier edges, and a\r
// brown-olive silt plume a little further out (the rivers change colour toward every shore)\r
#ifdef HAS_SHORE\r
{\r
float fn = texture(tWNoise, p / 23.0 + vec2(t * 0.002, - t * 0.003)).g, fn2 = texture(tWNoise, p / 6.0 + vec2(- t * 0.004, t * 0.002)).b;\r
float wash = (1.0 - smoothstep(1.0, 9.0 + 6.0 * fn, wShore)) * smoothstep(0.35, 0.65, fn * 0.6 + fn2 * 0.6);\r
c = mix(c, vec3(0.2, 0.205, 0.19), wash * 0.55);\r
float silt = (1.0 - smoothstep(10.0, 120.0, wShore)) * (0.55 + 0.45 * fn);\r
c = mix(c, vec3(0.085, 0.08, 0.058), silt * 0.4);\r
}\r
#endif\r
return c;\r
}\r
// @section fragmentMap\r
diffuseColor.rgb = river();\r
// @section fragmentRoughness\r
float roughnessFactor = wR;\r
// @section fragmentNormalMaps\r
normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);\r
// @section fragmentLightsBegin\r
__SHADER_INJECT_0__\r
// (round 7) sun glitter: sparse sub-pixel facets on a finer, faster chop catch the sun (a sparkling glint path\r
// toward the sun instead of one smooth lobe); fades with distance into the broad specular sheen\r
#if ( NUM_DIR_LIGHTS > 0 )\r
{\r
vec2 gp = vWPw.xz;\r
vec2 gn = wn(gp / 2.3 + vec2(uWTime * 0.05, uWTime * 0.034)) + 0.8 * wn(vec2(- gp.y, gp.x) / 3.7 + vec2(- uWTime * 0.041, uWTime * 0.02));\r
vec3 nG = normalize(wN + vec3(gn.x, 0.0, gn.y) * 0.22 * (1.0 - 0.6 * wSlick));\r
vec3 nGv = normalize((viewMatrix * vec4(nG, 0.0)).xyz);\r
vec3 Hh = normalize(directLight.direction + geometryViewDir);\r
float gl = pow(clamp(dot(nGv, Hh), 0.0, 1.0), 700.0);\r
float spark = smoothstep(0.62, 0.9, texture(tWNoise, gp / 5.0 + vec2(uWTime * 0.02, 0.0)).r);\r
float gfade = 1.0 - smoothstep(900.0, 4000.0, wDist);\r
reflectedLight.directSpecular += directLight.color * gl * spark * gfade * 14.0 * wSh;\r
}\r
#endif\r
// @section fragmentLightsMaps\r
#include <lights_fragment_maps>\r
// (atmosphere r2) sky reflection: the env map's lowest ~6 deg hold a generic city band (for the towers' IBL);\r
// open water at grazing angles must mirror the horizon SKY instead (critic: 'flat grey sheet, no fresnel sky\r
// gradient'). Re-fetch the env with the reflection lifted above that band; the planar mirror adds the real\r
// skyline on top. Grazing view -> brighter, paler horizon sky; looking down -> deep body colour + zenith blue.\r
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )\r
{\r
vec3 rvW = transformDirectionByInverseViewMatrix(reflect(- geometryViewDir, normal), viewMatrix);\r
rvW.y = abs(rvW.y) * 0.8 + 0.1;\r
radiance = textureCubeUV(envMap, envMapRotation * normalize(rvW), material.roughness).rgb * envMapIntensity;\r
radiance *= mix(0.3, 1.0, ambData.bounce.w); // (night) the night sky mirror stays dim: dark water with the city's light streaks (critic r2: rivers brighter than the city)\r
}\r
#endif\r
if(uReflOn > 0.5 && vRefl.w > 0.0) {\r
vec2 ruv = vRefl.xy / vRefl.w;\r
// (round 4) ripple distortion that survives distance (sheared horizontally by the chop) + a vertical smear:\r
// real river reflections are stretched / broken toward the viewer, never a crisp mirror\r
vec2 d = vec2(wDisp.x * 0.7, wDisp.y * 1.6) * 0.22 / (1.0 + wDist * 0.00025);\r
float spread = (0.004 + 0.034 * wR) * (1.0 - 0.5 * wSlick);\r
float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\r
vec4 pr = vec4(0.0);\r
for(int k = 0;\r
k < 8;\r
k ++) {\r
float o = (float(k) + jit) / 8.0 - 0.35;\r
pr += texture(tRefl, ruv + d * (1.0 + 0.12 * float(k)) + vec2(o * spread * 0.25, o * spread));\r
}\r
pr /= 8.0;\r
vec2 e = smoothstep(0.0, 0.03, ruv) * smoothstep(1.0, 0.97, ruv);\r
// the mirror render has no aerial perspective: haze it toward the sky radiance with distance (round 5: faster,\r
// so far reflections are soft ghosts, never a crisp second skyline)\r
vec3 mir = mix(pr.rgb, radiance, 0.28 + 0.52 * smoothstep(200.0, 3500.0, wDist));\r
// rough water (gusts / streaks) scatters the image: the mirror gives way to the blurred sky IBL\r
float mw = mix(0.7, 0.9, wSlick) * mix(1.0, 0.5, smoothstep(0.12, 0.3, wR)) * (1.0 - 0.3 * wNearS);\r
radiance = mix(radiance, mir, clamp(pr.a, 0.0, 1.0) * e.x * e.y * mw);\r
}\r
// a weaker sky mirror: the refs' rivers read as a deep grey-blue body, not a white sheet; wind rows catch a\r
// little more sheen\r
radiance *= (0.8 + 0.12 * wStreak); // (atmosphere r2) no far dimming: fresnel brightening toward the horizon\r
// (atmosphere r1) critic: 'river reads flat'. Wind fields modulate the sky sheen at every distance: glassy slicks\r
// mirror more of the (bright) sky, gust / ruffled patches scatter it into a duller, bluer grey -> visible large-\r
// scale mottling and streaks like the refs' Hudson / East River, instead of one even grey-blue sheet\r
radiance *= mix(0.82, 1.22, wSlick) * (1.0 + 0.18 * wStreak) * mix(1.0, 0.86, smoothstep(0.14, 0.3, wR));\r
// @section vertexCommonByWetSurfaceUv\r
#include <common>\r
out vec2 vWetUv;\r
// @section vertexUvVertex\r
#include <uv_vertex>\r
vWetUv = uv;\r
// @section fragmentCommonByWetSurfaceUv\r
#include <common>\r
uniform sampler2D tWetN;\r
in vec2 vWetUv;\r
// @section fragmentMapByWetSurfaceUv\r
{\r
float u = vWetUv.x, y = vWetUv.y;\r
vec3 nz = texture(tWetN, vec2(u / 9.0, 0.37)).rgb, nz2 = texture(tWetN, vec2(u / 2.1, y * 0.4 + 0.1)).rgb;\r
float top = 0.45 + 0.35 * nz.r + 0.15 * nz2.g;            // ragged high-water line\r
float a = 1.0 - smoothstep(top - 0.12, top + 0.04, y);\r
float algae = 1.0 - smoothstep(0.1, 0.35, y);              // green-black slime right at the water line\r
vec3 c = mix(vec3(0.07, 0.065, 0.055), vec3(0.04, 0.06, 0.035), algae);\r
c *= 0.8 + 0.4 * nz2.b;\r
// streaks running down from the high-water line\r
a = max(a, (1.0 - smoothstep(0.0, 0.9, y)) * smoothstep(0.62, 0.8, texture(tWetN, vec2(u / 0.9, 0.71)).r) * 0.6);\r
diffuseColor = vec4(c, a * 0.88);\r
}\r
`,_e=`// trees shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in vec2 aLeaf;\r
in vec3 aTintA;\r
in vec3 aTintB;\r
in float aSway;\r
out vec2 vLeaf;\r
out vec3 vTA;\r
out vec3 vTB;\r
uniform float uTime;\r
// @section vertexBeginVertex\r
#include <begin_vertex>\r
vLeaf = aLeaf;\r
vTA = aTintA;\r
vTB = aTintB;\r
#ifdef USE_INSTANCING\r
vec3 ip = instanceMatrix[3].xyz;\r
float ph = dot(ip, vec3(0.13, 0.0, 0.17));\r
// crown sway (slow) + leaf-spray flutter (fast, outer cards only)\r
transformed.xz += vec2(sin(uTime * 1.3 + ph + position.y * 0.4), cos(uTime * 1.1 + ph)) * 0.05 * position.y * 0.12;\r
if(aLeaf.x < 1.5) transformed += vec3(sin(uTime * 4.1 + dot(position, vec3(3.1, 1.7, 2.3))), sin(uTime * 3.3 + dot(position, vec3(1.9, 2.9, 1.3))), 0.0).xzy * 0.035 * aLeaf.x;\r
#endif\r
// @section fragmentCommon\r
#include <common>\r
in vec2 vLeaf;\r
in vec3 vTA;\r
in vec3 vTB;\r
uniform sampler2D uLeafN;\r
uniform vec4 uLeafFrame;\r
float leafIGN(vec2 p) {\r
return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));\r
}\r
// @section fragmentMap\r
\r
bool core = vLeaf.x >= 1.5;\r
vec2 luv = core ? fract(vMapUv) : vMapUv;\r
vec2 gx = dFdx(vMapUv), gy = dFdy(vMapUv);\r
vec4 tx = textureGrad(map, luv, gx, gy);\r
float expo = core ? (vLeaf.x - 2.0) : vLeaf.x;\r
if(core) { // solid inner mass: leaf texture where it has coverage, otherwise deep shade\r
vec4 t2 = textureGrad(map, fract(vMapUv * 0.7 + 0.31), gx * 0.7, gy * 0.7);\r
float cov = max(tx.a, t2.a);\r
tx = tx.a > 0.5 ? tx : t2;\r
tx.r = tx.g > 0.96 ? 0.55 : (tx.a > 0.5 ? tx.r * 0.85 : 0.45);\r
tx.b = 0.0;\r
tx.g = min(tx.g, 0.94);\r
          // grazing core surface (its silhouette) takes the leaf coverage, so the solid mass never shows a faceted edge\r
float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));\r
tx.a = facing > 0.45 ? 1.0 : cov;\r
}\r
if(! core) { // cards seen edge-on smear the texture: dissolve them (the neighbouring cards fill in)\r
vec3 fn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));\r
tx.a *= smoothstep(0.12, 0.4, abs(dot(fn, normalize(vViewPosition))));\r
}\r
diffuseColor.a *= tx.a;\r
float twig = step(0.97, tx.g);\r
float hsel = tx.g * 0.8 + vLeaf.y * 0.55 - 0.18;\r
vec3 leaf = mix(vTA, vTB, smoothstep(0.15, 0.85, hsel));\r
// a scatter of dry brown / still-green-ish leaves\r
float odd = fract(tx.g * 13.7 + vLeaf.y * 5.3);\r
leaf = odd > 0.93 ? vec3(0.13, 0.06, 0.025) : (odd < 0.035 ? vec3(0.16, 0.14, 0.035) : leaf);\r
leaf *= 0.42 + 0.72 * tx.r;\r
// self-occlusion: deep / underside leaves and the back of each spray fall into shade\r
float occ = mix(0.4, 1.0, pow(clamp(expo, 0.0, 1.0), 1.4)) * mix(0.62, 1.0, tx.b);\r
if(core) occ = mix(0.24, 0.42, clamp(expo, 0.0, 1.0));\r
vec3 c = twig > 0.5 ? vec3(0.085, 0.06, 0.042) : leaf;\r
diffuseColor.rgb *= c * occ;\r
float leafExpo = core ? 0.0 : clamp(expo, 0.0, 1.0);\r
\r
// @section fragmentAlphaTest\r
\r
// alpha-to-coverage for the TAA pipeline: stochastic threshold per pixel/frame -> TAA resolves soft, density-\r
// preserving edges (distant sprays keep their filtered coverage instead of thinning out)\r
{\r
float n = fract(leafIGN(gl_FragCoord.xy + 17.0) + uLeafFrame.x * 2.618034);\r
if(diffuseColor.a < mix(0.2, 0.7, n)) discard;\r
diffuseColor.a = 1.0;\r
}\r
// @section fragmentNormalBegin\r
#include <normal_fragment_begin>\r
normal = normalize(vNormal);\r
{ // per-leaf normals from the atlas, in the derivative tangent frame (the core: strong, so it never shades as a ball)\r
vec3 mapN = texture(uLeafN, core ? fract(vMapUv) : vMapUv).xyz * 2.0 - 1.0;\r
if(core) mapN.xy *= 2.2;\r
vec3 q0 = dFdx(- vViewPosition), q1 = dFdy(- vViewPosition);\r
vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);\r
vec3 Tt = q1p * gx.x + q0p * gy.x, Bt = q1p * gx.y + q0p * gy.y;\r
float det = max(dot(Tt, Tt), dot(Bt, Bt));\r
float sc = det == 0.0 ? 0.0 : inversesqrt(det);\r
normal = normalize(normal * max(mapN.z, 0.3) + (Tt * mapN.x + Bt * mapN.y) * sc * 0.9);\r
}\r
// @section fragmentLightsBegin\r
vec3 leafSun = vec3(0.0);\r
vec3 leafSunDir = vec3(0.0, 1.0, 0.0);\r
__SHADER_INJECT_0__\r
// @section fragmentLightsEnd\r
#include <lights_fragment_end>\r
{ // thin-leaf translucency: sun shining through the outer leaves toward the camera, plus wrapped back-light\r
vec3 V = normalize(vViewPosition);\r
float thr = pow(clamp(dot(- V, leafSunDir), 0.0, 1.0), 4.0);\r
float back = clamp(dot(- normal, leafSunDir), 0.0, 1.0);\r
float k = leafExpo * leafExpo * (1.0 - twig);\r
reflectedLight.directDiffuse += diffuseColor.rgb * leafSun * RECIPROCAL_PI * k * (thr * 2.2 + back * 0.6);\r
}\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
totalEmissiveRadiance += diffuseColor.rgb * vec3(0.13, 0.1, 0.06) * ambData.vert.x * ambData.bounce.w; // skylight transmitted through the leaves (warm) (lighting2 r6: x vertical-fill gain, off at night: canopies in shade read dark)\r
// @section vertexCommonLeafCanopyData\r
#include <common>\r
in vec2 aLeaf;\r
in vec3 aTintA;\r
in vec3 aTintB;\r
out vec2 vLeaf;\r
out vec3 vTA;\r
out vec3 vTB;\r
out vec3 vCW;\r
out vec3 vCN;\r
out vec3 vCI;\r
// @section vertexBeginVertexLeafCanopyData\r
#include <begin_vertex>\r
vLeaf = aLeaf;\r
vTA = aTintA;\r
vTB = aTintB;\r
      #ifdef USE_INSTANCING\r
vCW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;\r
vCN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);\r
vCI = instanceMatrix[3].xyz;\r
      #else\r
vCW = (modelMatrix * vec4(position, 1.0)).xyz;\r
vCN = normal;\r
vCI = vec3(0.0);\r
      #endif\r
// @section fragmentCommonLeafCanopyData\r
#include <common>\r
in vec2 vLeaf;\r
in vec3 vTA;\r
in vec3 vTB;\r
in vec3 vCW;\r
in vec3 vCN;\r
in vec3 vCI;\r
uniform sampler2D uLeafN;\r
uniform vec4 uLeafFrame;\r
float crClump;\r
float crIGN(vec2 p) {\r
return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));\r
}\r
float crH3(vec3 p) {\r
return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);\r
}\r
float crVn(vec3 p) {\r
vec3 i = floor(p), f = fract(p);\r
f = f * f * (3.0 - 2.0 * f);\r
return mix(mix(mix(crH3(i), crH3(i + vec3(1, 0, 0)), f.x), mix(crH3(i + vec3(0, 1, 0)), crH3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(crH3(i + vec3(0, 0, 1)), crH3(i + vec3(1, 0, 1)), f.x), mix(crH3(i + vec3(0, 1, 1)), crH3(i + vec3(1, 1, 1)), f.x), f.y), f.z);\r
}\r
// @section fragmentMapByLeafTintB\r
\r
// procedural foliage (no texture: a tiled leaf atlas reads as a checker from afar): clumps (~2.4 m) of\r
// sub-clumps (~0.7 m) of leaf speckle (~0.25 m), per-crown phase; dark gaps between the clumps\r
vec3 cp = vCW + vCI * 0.37;\r
float n1 = crVn(cp * 0.62), n2 = crVn(cp * 2.1 + 3.1), n3 = crVn(cp * 5.3 + 7.7); // (park r2) finer clumps\r
crClump = n1 * 0.65 + n2 * 0.35;\r
vec4 tx = vec4(n3, n2, 0.0, 1.0);\r
float cov = smoothstep(0.18, 0.55, crClump * 0.8 + n3 * 0.35);\r
float expo = clamp(vLeaf.x, 0.0, 1.0);\r
float hsel = 0.5 + (n2 - 0.5) * 0.7 + (vLeaf.y - 0.5) * 0.35 + (n1 - 0.5) * 0.4;\r
vec3 leaf = mix(vTA, vTB, smoothstep(0.1, 0.9, hsel));\r
leaf *= 0.74 + 0.34 * n3;\r
leaf = fract(n3 * 17.3 + vLeaf.y * 3.1) > 0.97 ? leaf * vec3(0.55, 0.4, 0.3) : leaf; // dry leaves\r
vec3 c = mix(vTB * 0.42, leaf, smoothstep(0.3, 0.62, crClump + n3 * 0.22)); // (park r2) deeper gaps between clumps\r
c *= mix(vec3(1.0), vec3(1.12, 1.1, 0.8), smoothstep(0.62, 0.9, n2) * 0.6); // sunlit yellowing leaf tips\r
float occ = mix(0.3, 1.14, pow(expo, 1.25)) * mix(0.66, 1.1, smoothstep(0.3, 0.75, crClump)); // (park r4) crowns separate: dark skirts, sunlit domes\r
diffuseColor.rgb *= c * occ;\r
// silhouette: grazing faces keep only the leaf coverage -> ragged, see-through crown edges\r
float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));\r
float alpha = mix(cov * 1.25, 1.0, smoothstep(0.3, 0.72, facing));\r
{\r
float n = fract(crIGN(gl_FragCoord.xy + 5.0) + uLeafFrame.x * 2.618034);\r
if(alpha < mix(0.25, 0.75, n)) discard;\r
}\r
\r
// @section fragmentNormalMaps\r
#include <normal_fragment_maps>\r
{\r
vec3 sx = normalize(dFdx(- vViewPosition)), sy2 = normalize(dFdy(- vViewPosition));\r
vec2 dh = vec2(dFdx(crClump), dFdy(crClump)) * 3.0 + (vec2(dFdx(tx.r), dFdy(tx.r)) * 0.5);\r
vec3 r1 = cross(sy2, normal), r2 = cross(normal, sx);\r
float det = dot(sx, r1);\r
if(det != 0.0) normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));\r
}\r
// @section fragmentEmissiveLeafLightTransmission\r
#include <emissivemap_fragment>\r
totalEmissiveRadiance += diffuseColor.rgb * vec3(0.11, 0.095, 0.06) * expo * expo * ambData.vert.x * ambData.bounce.w; // (lighting2 r6)\r
`,ve=`in float aKind;\r
in vec4 aTree;\r
\r
uniform vec3 uSun;\r
uniform float uY;\r
\r
out float vShadowRadius;\r
out float vTreeKind;\r
out float vShadowStrength;\r
\r
void main() {\r
  vTreeKind = aKind;\r
  vShadowRadius = length(position.xz);\r
\r
  vec3 worldPosition;\r
  float cameraDistance = length(aTree.xy - cameraPosition.xz);\r
\r
  if(aKind < 0.5) {\r
    worldPosition = vec3(aTree.x + position.x * aTree.z * 1.15, uY, aTree.y + position.z * aTree.z * 1.15);\r
    vShadowStrength = 1.0;\r
  } else {\r
    float sunElevation = max(asin(clamp(uSun.y, 0.0, 1.0)), 0.2);\r
    vec2 shadowDirection = -normalize(uSun.xz + vec2(1e-4));\r
    vec2 shadowCenter = aTree.xy + shadowDirection * aTree.w / tan(sunElevation) * 0.92;\r
    float shadowStretch = min(1.0 / sin(sunElevation), 2.4);\r
    vec2 shadowOffset = position.x * shadowDirection * shadowStretch +\r
      position.z * vec2(-shadowDirection.y, shadowDirection.x);\r
\r
    worldPosition = vec3(shadowCenter.x + shadowOffset.x * aTree.z * 0.95, uY + 0.004, shadowCenter.y + shadowOffset.y * aTree.z * 0.95);\r
    // Nearby trees already cast real cascaded shadow-map shadows.\r
    vShadowStrength = smoothstep(145.0, 180.0, cameraDistance) *\r
      smoothstep(0.02, 0.12, uSun.y);\r
  }\r
\r
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);\r
}\r
`,ye=`in float vShadowRadius;\r
in float vTreeKind;\r
in float vShadowStrength;\r
\r
out vec4 fragColor;\r
\r
void main() {\r
  float shadowOpacity;\r
  if(vTreeKind < 0.5) {\r
    shadowOpacity = (1.0 - smoothstep(0.15, 1.0, vShadowRadius)) * 0.32;\r
  } else {\r
    shadowOpacity = (1.0 - smoothstep(0.45, 1.0, vShadowRadius)) *\r
      0.5 *\r
      vShadowStrength;\r
  }\r
\r
  fragColor = vec4(vec3(1.0 - shadowOpacity), 1.0);\r
}\r
`,be={met:{x0:136,x1:227,z0:-1378,z1:-1204}},xe=[],W=(e,t,n,r,i)=>({x:B.x0+e*(B.x1-B.x0),z:B.z1-t*(B.z1-B.z0),rx:n,rz:r,a:i}),Se=[W(.36,.12,100,58,.1),W(.52,.44,95,80,-.15),W(.6,.8,110,75,.2),W(.8,.1,45,32,.5),W(.16,.2,42,30,-.4),W(.84,.36,40,36,.3),W(.2,.47,38,50,.2),W(.25,.72,55,36,-.3),W(.82,.22,34,26,0),W(.3,.9,50,34,.1),W(.82,.68,40,50,-.2)];function Ce(e,t){let n=9;for(let r of Se){let i=e-r.x,a=t-r.z,o=Math.cos(r.a),s=Math.sin(r.a),c=(i*o-a*s)/r.rx,l=(i*s+a*o)/r.rz,u=Math.atan2(l,c),d=1+.09*Math.sin(u*3+r.x)+.06*Math.sin(u*5+r.z);n=Math.min(n,Math.hypot(c,l)/d)}return n}var we=`// pool shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>
__SHADER_INJECT_0__\r
// @section vertexProjectVertex\r
#include <project_vertex>
__SHADER_INJECT_0__\r
// @section fragmentCommon\r
#include <common>
__SHADER_INJECT_0__\r
// @section fragmentClipping\r
#include <clipping_planes_fragment>
__SHADER_INJECT_0__\r
// @section vertexCommonByDistanceFade\r
#include <common>
out float vDistFade;\r
// @section vertexProjectVertexByDistanceFade\r
#include <project_vertex>\r
        { vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz; vDistFade = clamp((__SHADER_INJECT_0__ - length(wp.xz - cameraPosition.xz)) / __SHADER_INJECT_1__, 0.0, 1.0); }\r
// @section fragmentCommonByDistanceFade\r
#include <common>\r
      in float vDistFade; uniform vec4 uLodFrame;\r
      float dfIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }\r
// @section fragmentClippingByDistanceFade\r
#include <clipping_planes_fragment>\r
        if (vDistFade < 0.999 && fract(dfIGN(gl_FragCoord.xy + 7.0) + uLodFrame.x * 1.618034) >= vDistFade) discard;\r
\r
// @section lodVertexDeclarations\r
in vec4 aLod; out float vLodIn; out float vLodOut;\r
\r
// @section lodVertexFade\r

  #ifdef USE_INSTANCING
  {
    vec3 lodP = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
    float lodD = length(lodP.xz - cameraPosition.xz);
    vLodIn = aLod.y > aLod.x ? clamp((lodD - aLod.x) / (aLod.y - aLod.x), 0.0, 1.0) : 1.0;
    vLodOut = aLod.w > aLod.z ? clamp((aLod.w - lodD) / (aLod.w - aLod.z), 0.0, 1.0) : 1.0;
  }
  #else
  vLodIn = 1.0; vLodOut = 1.0;
  #endif\r
\r
// @section lodFragmentDeclarations\r
in float vLodIn; in float vLodOut; uniform vec4 uLodFrame;
  float lodIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }\r
\r
// @section lodFragmentFade\r
{
    float lodN = fract(lodIGN(gl_FragCoord.xy) + uLodFrame.x * 1.618034);
    if (lodN >= vLodOut || lodN < 1.0 - vLodIn) discard;
  }\r
`,G=N(()=>we),Te=ae(`nowedge`),Ee=G.lodVertexDeclarations,De=G.lodVertexFade,Oe=G.lodFragmentDeclarations,ke=G.lodFragmentFade;function Ae(e){if(!e||e.userData.lodFade)return e;e.userData.lodFade=!0;let t=e.onBeforeCompile,n=e.customProgramCacheKey;return e.onBeforeCompile=(n,r)=>{t?.call(e,n,r),n.uniforms.uLodFrame={value:R.params},n.vertexShader=n.vertexShader.replace(`#include <common>`,P(G.vertexCommon,Ee)).replace(`#include <project_vertex>`,P(G.vertexProjectVertex,De)),n.fragmentShader=n.fragmentShader.replace(`#include <common>`,P(G.fragmentCommon,Oe)).replace(`#include <clipping_planes_fragment>`,P(G.fragmentClipping,ke))},e.customProgramCacheKey=()=>(n?n.call(e):``)+`|lodfade1`,e.needsUpdate=!0,e}var je=new y,Me=new p,Ne=new E,Pe=new E,Fe=new S,Ie=new WeakMap,K=class e{static sortF2B=!new URLSearchParams(location.search).has(`nof2b`);static sortMax=2e4;constructor(e,n,{max:r=1024,near:i=0,far:a=400,castShadow:o=!0,receiveShadow:s=!0,extra:c={},color:l=!1,name:u=``,fadeIn:d=0,fadeOut:f=null,isStatic:p=!1,shadowFar:m=null,smallCasters:h=!1}={}){this.geo=e,this.mat=n,this.max=r,this.near=i,this.far=a,this.fadeIn=i>0?d||Math.max(10,i*.08):0,this.fadeOut=f??Math.max(10,a*.08),this.isStatic=p,this.shadowFar=Math.min(a,m??160),this.nShadow=0,c={...c,aLod:4},Ae(n),this.items=[],this.extraDefs=c,this.mesh=new D(e,n,r),this.mesh.name=u,this.mesh.count=0,this.mesh.frustumCulled=!1,this.mesh.castShadow=o,this.mesh.receiveShadow=s,h&&(this.mesh.userData.smallCasters=!0);let g=0;this.mesh.onBeforeShadow=()=>{g=this.mesh.count,this.mesh.count=Math.min(g,this.nShadow)},this.mesh.onAfterShadow=()=>{this.mesh.count=g},this.mesh.instanceMatrix.setUsage(t),l&&(this.mesh.instanceColor=new v(new Float32Array(r*3),3),this.mesh.instanceColor.setUsage(t)),this.extra={};for(let[n,i]of Object.entries(c)){let a=new v(new Float32Array(r*i),i);a.setUsage(t),e.setAttribute(n,a),this.extra[n]=a}this.last=new E(1e9,0,0),this.sel=new Int32Array(r)}add(e,t,n,r=0,i=1,a=null,o=null,s=null){let c={x:e,y:t,z:n,ry:r,s:i,color:a,extra:o,scale3:s};return this.items.push(c),c}hide(e){e.hidden=!0,this.last.set(1e9,0,0),this.written=-1}show(e){e.hidden=!1,this.last.set(1e9,0,0),this.written=-1}write(e,t){let n=this.extra.aLod;if(n&&n.setXYZW(e,this.near-this.fadeIn,this.near,this.far-this.fadeOut,this.far),Ne.set(t.x,t.y,t.z),Me.setFromAxisAngle(k.DEFAULT_UP,t.ry),(t.rx||t.rz)&&(Fe.set(t.rx||0,t.ry,t.rz||0,`YXZ`),Me.setFromEuler(Fe)),t.scale3?Pe.set(t.scale3[0]*t.s,t.scale3[1]*t.s,t.scale3[2]*t.s):Pe.set(t.s,t.s,t.s),t.hidden&&Pe.set(0,0,0),je.compose(Ne,Me,Pe),this.mesh.setMatrixAt(e,je),t.color&&this.mesh.instanceColor&&this.mesh.instanceColor.setXYZ(e,t.color[0],t.color[1],t.color[2]),t.extra)for(let n in t.extra){let r=this.extra[n];if(!r)continue;let i=t.extra[n];r.itemSize===1?r.setX(e,i):r.array.set(i,e*r.itemSize)}}buildGrid(){let e=Ie.get(this.items);if(e&&e.n===this.items.length&&!this.dirty){this.grid=e.g,this.gridN=e.n;return}let t=new Map;for(let e=0;e<this.items.length;e++){let n=this.items[e],r=Math.floor(n.x/64)*100003+Math.floor(n.z/64),i=t.get(r);i||t.set(r,i=[]),i.push(e)}this.grid=t,this.gridN=this.items.length,this.dirty=!1,Ie.set(this.items,{g:t,n:this.items.length})}due(e){return this.isStatic?this.written!==this.items.length||this.dirty:e.distanceToSquared(this.last)>=this.thresh()**2||this.viewDue()}viewDue(){let e=R.view;if(Te||!e||!this.far||this.far<=this.shadowFar)return!1;let t=e.cos>-1;return t!==!!this.vOn||t&&e.x*this.vx+e.z*this.vz<.94}thresh(){return Math.max(6,Math.min(40,this.far*.02))}update(t,n=!1,r=this.thresh()){if(this.isStatic){if(this.written===this.items.length&&!n&&!this.dirty)return;let e=Math.min(this.max,this.items.length);for(let t=0;t<e;t++)this.write(t,this.items[t]);this.mesh.count=e,this.nShadow=this.shadowFar>=this.far?e:0,this.written=this.items.length,this.dirty=!1,this.mesh.visible=e>0,this.upload(e);return}if(!n&&t.distanceToSquared(this.last)<r*r&&!this.viewDue())return;this.last.copy(t);let i=R.view,a=!Te&&!!i&&i.cos>-1&&this.far>this.shadowFar;this.vOn=a,a&&(this.vx=i.x,this.vz=i.z);let o=a?i.cos:-2,s=a?i.x:0,c=a?i.z:0,l=(this.shadowFar+r)**2;(!this.grid||this.dirty||this.gridN!==this.items.length)&&this.buildGrid();let u=Math.max(0,this.near-this.fadeIn-r),d=this.far+r,f=u*u,p=d*d,m=0,h=this.items,g=[],_=Math.ceil(d/64),v=Math.floor(t.x/64),y=Math.floor(t.z/64);for(let e=v-_;e<=v+_;e++)for(let n=y-_;n<=y+_;n++){let r=this.grid.get(e*100003+n);if(r)for(let e of r){let n=h[e],r=n.x-t.x,i=n.z-t.z,a=r*r+i*i;a>=f&&a<p&&(a<l||r*s+i*c>=o*Math.sqrt(a))&&g.push(e,a)}}let b=(this.shadowFar+r)**2;if(g.length/2>this.max){let e=[];for(let t=0;t<g.length;t+=2)e.push(t);e.sort((e,t)=>g[e+1]-g[t+1]);let t=0;for(let n=0;n<this.max;n++)g[e[n]+1]<b&&(t=n+1),this.write(m++,h[g[e[n]]]);this.nShadow=t}else if(e.sortF2B&&g.length/2<=e.sortMax){let t=g.length>>1,n=e._key&&e._key.length>=t?e._key:e._key=new Float64Array(Math.max(t,4096)),r=0;for(let e=0;e<t;e++){let t=g[2*e+1],i=t<b;i&&r++,n[e]=(Math.floor(t)*2+ +!i)*1048576+e}let i=n.subarray(0,t).sort();for(let e=0;e<t;e++)this.write(m++,h[g[2*(i[e]%1048576)]]);this.nShadow=r}else{for(let e=0;e<g.length;e+=2)g[e+1]<b&&this.write(m++,h[g[e]]);this.nShadow=m;for(let e=0;e<g.length;e+=2)g[e+1]>=b&&this.write(m++,h[g[e]])}this.mesh.count=m,this.mesh.visible=m>0,this.upload(m)}upload(e){if(!e)return;let t=(t,n)=>{t.clearUpdateRanges(),t.addUpdateRange(0,e*n),t.needsUpdate=!0};t(this.mesh.instanceMatrix,16),this.mesh.instanceColor&&t(this.mesh.instanceColor,3);for(let e of Object.values(this.extra))t(e,e.itemSize)}};function Le(e,t,n){if(!e||e.userData.distFade)return e;e.userData.distFade=!0;let r=e.onBeforeCompile,i=e.customProgramCacheKey;return e.onBeforeCompile=(i,a)=>{r?.call(e,i,a),i.uniforms.uLodFrame=i.uniforms.uLodFrame||{value:R.params},i.vertexShader=i.vertexShader.replace(`#include <common>`,G.vertexCommonByDistanceFade).replace(`#include <project_vertex>`,P(G.vertexProjectVertexByDistanceFade,n.toFixed(1),(n-t).toFixed(1))),i.fragmentShader=i.fragmentShader.replace(`#include <common>`,G.fragmentCommonByDistanceFade).replace(`#include <clipping_planes_fragment>`,G.fragmentClippingByDistanceFade)},e.customProgramCacheKey=()=>(i?i.call(e):``)+`|distfade${t}-${n}`,e.needsUpdate=!0,e}var Re=`// treetrunk shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in vec4 aBark;\r
out vec4 vBark;\r
out vec2 vBUv;\r
// @section vertexBeginVertex\r
#include <begin_vertex>\r
vBark = aBark;\r
vBUv = uv;\r
// @section fragmentCommon\r
#include <common>\r
uniform highp sampler2DArray tBarkC;\r
uniform highp sampler2DArray tBarkN;\r
in vec4 vBark;\r
in vec2 vBUv;\r
// @section fragmentMap\r
\r
vec3 bkUv = vec3(vBUv, floor(vBark.x + 0.5));\r
vec4 bkC = texture(tBarkC, bkUv);\r
diffuseColor.rgb *= bkC.rgb * vBark.yzw;\r
// @section fragmentNormalMaps\r
#include <normal_fragment_maps>\r
{ // bark normal map in the derivative tangent frame (no tangent attribute)\r
vec3 mapN = texture(tBarkN, bkUv).xyz * 2.0 - 1.0;\r
mapN.xy *= 1.35;\r
vec3 q0 = dFdx(- vViewPosition), q1 = dFdy(- vViewPosition);\r
vec2 st0 = dFdx(vBUv), st1 = dFdy(vBUv);\r
vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);\r
vec3 Tt = q1p * st0.x + q0p * st1.x, Bt = q1p * st0.y + q0p * st1.y;\r
float det = max(dot(Tt, Tt), dot(Bt, Bt));\r
float sc = det == 0.0 ? 0.0 : inversesqrt(det);\r
normal = normalize(Tt * (mapN.x * sc) + Bt * (mapN.y * sc) + normal * mapN.z);\r
}\r
`,ze=N(()=>Re),q={PLANE:0,OAK:1,DARK:2},Be=.85,Ve={near:{sides:[12,6,4,3],step:[.5,1.05,1.5,9],levels:4,ridges:!0,flare:[0,.12,.3,.55,.9,1.3]},mid:{sides:[6,3,3,3],step:[1.2,2.2,9,9],levels:3,ridges:!1,flare:[0,.25,.7]},far:{sides:[4,3,3,3],step:[3.2,9,9,9],levels:1,ridges:!1,flare:[0]}};function He({h:e,r:t,branches:n,spread:r,lobes:i=[],seed:a=3,kind:o=``}){let s=V(a*7919+17),c=[],l=s()*Math.PI*2,u=e*(.03+s()*.05),d=t*(.5+s()*.7),f=s()*6.28,p=[Math.cos(l),Math.sin(l)],m=[-p[1],p[0]],h=[];for(let t=0;t<=4;t++){let n=t/4,r=-.3+(e+.3)*n,i=u*n**1.4,a=d*Math.sin(Math.PI*n*1.2+f)*n;h.push(new E(p[0]*i+m[0]*a,r,p[1]*i+m[1]*a))}let g=h[4],_=i[0]??{x:0,y:e*1.6,z:0,r:e*.5},v=new E(_.x,_.y-_.r*(_.sy??.8)*.15,_.z),y=o===`conifer`;if(y){let e=i[i.length-1];v.set(e.x,e.y,e.z)}h.push(new E((g.x*2+v.x)/3,g.y+(v.y-g.y)*.4,(g.z*2+v.z)/3),v),c.push({pts:h,r0:t,r1:t*(y?.12:.26),level:0,flare:!0,h:e});let b=e=>{for(let t=1;t<h.length;t++)if(h[t].y>=e||t===h.length-1){let n=h[t-1],r=h[t],i=Math.max(0,Math.min(1,(e-n.y)/Math.max(.001,r.y-n.y)));return[n.clone().lerp(r,i),r.clone().sub(n).normalize()]}},x=n=>t*(1-.22*Math.min(1,n/e))*(n>e?Math.max(.4,1-(n-e)/Math.max(1,v.y-e)*.6):1),S=(e,t,n,r,i,a,o)=>{let s=n[0].clone().sub(e),l=s.length(),u=o??new E(s.x,0,s.z).normalize(),d=e.clone().addScaledVector(t,Math.min(l*.28,r*5+.4)).addScaledVector(u,r*1.6);return c.push({pts:[e.clone(),d,...n],r0:r,r1:i,level:a}),c.length-1},C=(e,t,n)=>new E(e.x+Math.cos(t)*e.r*.86,e.y+n*e.r*.5*(e.sy??.8),e.z+Math.sin(t)*e.r*.86),w=y?[]:i.slice(1);for(let n of w){let r=e*(.62+s()*.3),[a,o]=b(r);D(S(a,o,[new E(n.x*.62,n.y-n.r*.3,n.z*.62),C(n,Math.atan2(n.z,n.x)+(s()-.5)*.8,.1+s()*.3)],x(r)*.64,t*.1,1),n,i.length>5?2:3)}y||D(0,_,3,.62);let T=y?n+5:Math.round(n*.5);for(let n=0;n<T;n++){let i=n/Math.max(1,T)*Math.PI*2+s()*.9,a=y?e*.7+(v.y-e*.7)*(n+s()*.6)/T:e*(.72+s()*.26),[o,c]=b(a),l=y?r*1.7*(1-.7*(a-e*.7)/(v.y-e*.7)):r*(.6+s()*.5),u=new E(o.x+Math.cos(i)*l,a+l*(y?-.1:.7+s()*.5),o.z+Math.sin(i)*l),d=o.clone().lerp(u,.5);d.y+=l*(y?.12:.05);let f=S(o,c,[d,u],x(a)*(y?.3:.45),t*.06,1,new E(Math.cos(i),0,Math.sin(i)));if(!y){let e=i+(s()-.5)*1.4;O(f,.7,new E(u.x+Math.cos(e)*l*.3,u.y+l*.35,u.z+Math.sin(e)*l*.3),t*.2,2)}}function D(e,t,n,r=.45){for(let i=0;i<n;i++){let n=s()*Math.PI*2,i=.15+s()*.6,a=C(t,n,i),o=O(e,r+s()*(.9-r),a,null,2),c=n+.8*(s()<.5?1:-1);O(o,.55+s()*.3,new E(a.x+Math.cos(c)*t.r*.25,a.y+t.r*.2,a.z+Math.sin(c)*t.r*.25),null,3)}}function O(e,t,n,r,i){let a=c[e],o=a.pts,s=t*(o.length-1),l=Math.min(o.length-2,Math.floor(s)),u=s-l,d=o[l].clone().lerp(o[l+1],u),f=o[l+1].clone().sub(o[l]).normalize(),p=a.r0+(a.r1-a.r0)*t,m=d.clone().lerp(n,.5);return m.y+=n.distanceTo(d)*.08,S(d,f,[m,n],r??p*.62,i>=3?.012:.02,i)}let k=Math.min(3.8,e),[A]=b(.4),[j]=b(k);return{branches:c,h:e,r:t,collider:{x:(A.x+j.x)/2,z:(A.z+j.z)/2,y1:k,r0:t*1.22,r1:x(k)+Math.hypot(j.x-A.x,j.z-A.z)/2}}}var J=new E,Ue=new E,We=new E,Ge=new E,Ke=new p;function qe(e,t=Ve.near){let n=[],i=[],o=[],s=[],c=[],{h:l,r:u}=e;for(let r of e.branches){if(r.level>=t.levels)continue;let e=t.sides[r.level],a=t.step[r.level],d=new A(r.pts,!1,`centripetal`,.5),f=d.getLength(),p=[];if(r.flare){let e=t.flare.filter(e=>e<f*.5);for(let t of e)p.push(t/f)}{let e=f/Math.max(2,Math.ceil(f/a));for(let t=0;t<=f+1e-6;){let n=t/f;(!p.length||n>p[p.length-1]+.3/f)&&p.push(Math.min(1,n)),t+=r.level===0&&r.pts[0].y+t>l*1.05?e*2:e}p[p.length-1]<1-.2/f?p.push(1):p[p.length-1]=1}let m=Math.max(1,Math.round(2*Math.PI*r.r0/Be)),h=n.length/3;d.getTangentAt(0,J),Ue.set(1,0,0),Math.abs(J.x)>.9&&Ue.set(0,0,1),We.crossVectors(J,Ue).normalize(),Ue.crossVectors(We,J).normalize();let g=J.clone(),_=0,v=null,y=V(r.level*131+Math.round(r.r0*1e4)),b=y()*6.28,x=y()*6.28,S=4+Math.floor(y()*2);for(let a=0;a<p.length;a++){let y=p[a],C=d.getPointAt(y);d.getTangentAt(y,J),Ke.setFromUnitVectors(g,J),Ue.applyQuaternion(Ke),We.applyQuaternion(Ke),g.copy(J),v&&(_+=C.distanceTo(v)),v=C;let w;if(r.level===0){let e=Math.max(0,C.y);w=e<=l?u*(1-.22*e/l):u*.78+(r.r1-u*.78)*Math.min(1,(e-l)/Math.max(1,r.pts[r.pts.length-1].y-l))}else w=r.r0+(r.r1-r.r0)*y**.75;r.level>0&&(w*=1+.18*Math.exp(-y*f/(r.r0*4+.05)));let T=r.level===0?.62+.38*Math.min(1,Math.max(0,C.y+.1)/1.2):.78+.22*Math.min(1,y*f/(r.r0*6+.1));for(let a=0;a<=e;a++){let c=a/e*Math.PI*2,l=Math.cos(c),u=Math.sin(c),d=w;if(r.flare){let e=Math.max(0,C.y),t=Math.exp(-e/.38);d*=1+t*(.42+.5*Math.max(0,Math.cos(c*S+b))**3)}if(t.ridges&&r.level<=1){let e=.5+.5*Math.sin(c*Math.max(5,Math.round(w*38))+1.7*Math.sin(C.y*1.9+c*2+x)+b);d*=1+.07*(e*e-.35)*(r.level===0?1:.6)}Ge.copy(C).addScaledVector(Ue,l*d).addScaledVector(We,u*d),n.push(Ge.x,Ge.y,Ge.z),i.push(0,0,0),o.push(a/e*m,_/Be),s.push(T,T,T)}if(a>0){let t=h+(a-1)*(e+1),n=h+a*(e+1);for(let r=0;r<e;r++)c.push(t+r,n+r,t+r+1,t+r+1,n+r,n+r+1)}}{let t=h+(p.length-1)*(e+1),r=d.getPointAt(1);for(let i=0;i<=e;i++)n[(t+i)*3]=r.x,n[(t+i)*3+1]=r.y,n[(t+i)*3+2]=r.z}r._v0=h,r._sides=e,r._rings=p.length}let f=new b;f.setAttribute(`position`,new a(n,3)),f.setAttribute(`normal`,new a(i,3)),f.setAttribute(`uv`,new a(o,2)),f.setAttribute(`color`,new a(s,3)),f.setIndex(n.length/3>65535?new r(c,1):new d(c,1)),f.computeVertexNormals();let p=f.attributes.normal;for(let n of e.branches)if(!(n._v0===void 0||n.level>=t.levels)){for(let e=0;e<n._rings;e++){let t=n._v0+e*(n._sides+1),r=t+n._sides;J.set(p.getX(t)+p.getX(r),p.getY(t)+p.getY(r),p.getZ(t)+p.getZ(r)).normalize(),p.setXYZ(t,J.x,J.y,J.z),p.setXYZ(r,J.x,J.y,J.z)}delete n._v0}return f.computeBoundingSphere(),f.computeBoundingBox(),f}var Je=null;function Ye(e,t,n){let r=(e,n,r,a)=>{let o=new _(e,n,r,a);return o.colorSpace=t?s:``,o.wrapS=o.wrapT=f,o.generateMipmaps=!0,o.minFilter=i,o.magFilter=l,o.anisotropy=4,o.needsUpdate=!0,o},a={value:r(new Uint8Array(192).fill(n),4,4,3)};if(typeof Image>`u`)return a;let o=new Image;return o.onload=()=>{let e=o.width,t=Math.round(o.height/o.width),n=document.createElement(`canvas`);n.width=e,n.height=o.height;let i=n.getContext(`2d`,{willReadFrequently:!0});i.drawImage(o,0,0);let s=i.getImageData(0,0,e,o.height).data,c=new Uint8Array(e*e*4*t);for(let n=0;n<t;n++)for(let t=0;t<e;t++){let r=(n*e+(e-1-t))*e*4;c.set(s.subarray(r,r+e*4),(n*e*e+t*e)*4)}let l=a.value;a.value=r(c,e,e,t),l.dispose()},o.src=e,a}function Xe(){return Je??={col:Ye(ie(`city/tex/bark_col.webp`),!0,110),nrm:Ye(ie(`city/tex/bark_nrm.webp`),!1,128)},Je}function Ze(){let e=Xe(),t=new C({vertexColors:!0,roughness:.93,metalness:0});return t.onBeforeCompile=t=>{t.uniforms.tBarkC=e.col,t.uniforms.tBarkN=e.nrm,t.vertexShader=t.vertexShader.replace(`#include <common>`,ze.vertexCommon).replace(`#include <begin_vertex>`,ze.vertexBeginVertex),t.fragmentShader=t.fragmentShader.replace(`#include <common>`,ze.fragmentCommon).replace(`#include <map_fragment>`,ze.fragmentMap).replace(`#include <normal_fragment_maps>`,ze.fragmentNormalMaps)},t.customProgramCacheKey=()=>`bark-v1`,t}var Y=N(()=>_e);function Qe({lobes:e,cards:t,size:n,seed:i,core:o=0,coreLobes:s=9,coreDetail:c=1}){let l=V(i),u=[],d=[],f=[],p=[],m=[];o>0&&$e(u,d,f,p,m,e,o,i+5,s,c);let h=u.length/3,g=1/0,_=-1/0;for(let t of e)g=Math.min(g,t.y-t.r*(t.sy??.8)),_=Math.max(_,t.y+t.r*(t.sy??.8));let v=new E,y=new E,x=new E,S=new E,C=new E,w=new E,T=new E,D=new E,O=new E,k=e.reduce((e,t)=>e+t.r**2,0),A=()=>{let e=l(),t=l(),n=e*Math.PI*2,r=Math.acos(2*t-1);return new E(Math.sin(r)*Math.cos(n),Math.cos(r),Math.sin(r)*Math.sin(n))};for(let r of e){let e=r.sy??.8;C.set(r.x,r.y,r.z);let i=Math.round(t*r.r**2/k),a=Math.max(3,Math.round(i/11));for(let t=0;t<a;t++){let t=A();t.y<-.6&&(t.y=-.6+l()*.25);let o=.58+.38*Math.sqrt(l());w.set(r.x+t.x*r.r*o,r.y+t.y*r.r*o*e,r.z+t.z*r.r*o);let s=r.r*(.3+l()*.16),c=l(),b=Math.round(i/a*(.8+l()*.4));for(let t=0;t<b;t++){let t=A(),i=l()**.45;D.copy(w).sub(C).normalize(),t.dot(D)<-.3&&t.addScaledVector(D,.8).normalize();let a=new E(w.x+t.x*s*i,w.y+t.y*s*i*.85,w.z+t.z*s*i);S.copy(t).multiplyScalar(.6).addScaledVector(D,.4).normalize(),v.set(l()-.5,l()-.5,l()-.5).multiplyScalar(1.1).add(S).normalize(),y.set(0,1,0).cross(v),y.lengthSq()<.001&&y.set(1,0,0),y.normalize(),x.copy(v).cross(y).normalize();let o=l()*Math.PI*2,b=Math.cos(o),k=Math.sin(o),j=y.clone().multiplyScalar(b).addScaledVector(x,k),ee=x.clone().multiplyScalar(b).addScaledVector(y,-k),M=n*(.75+l()*.5)/2,N=Math.floor(l()*4),P=N%2*.5,F=Math.floor(N/2)*.5,I=c*.75+l()*.25;for(let[t,n]of[[-1,-1],[1,-1],[1,1],[-1,1]]){T.copy(a).addScaledVector(j,t*M).addScaledVector(ee,n*M),u.push(T.x,T.y,T.z),D.copy(T).sub(C);let i=Math.min(1.2,Math.hypot(D.x/r.r,D.y/(r.r*e),D.z/r.r));D.normalize(),O.copy(T).sub(w).normalize();let o=O.clone().multiplyScalar(.45).addScaledVector(D,.4).addScaledVector(v,.15).normalize();d.push(o.x,o.y,o.z),f.push(P+(t+1)*.25,1-(F+(1-n)*.25));let s=Math.min(1,Math.max(0,(T.y-g)/(_-g))),c=.08+.42*Math.min(1,i)**1.3+.25*Math.max(0,O.dot(D)*.5+.5)+.3*s-(D.y<-.3?.12:0);p.push(Math.min(1,Math.max(0,c)),I)}m.push(h,h+1,h+2,h,h+2,h+3),h+=4}}}let j=new b;return j.setAttribute(`position`,new a(u,3)),j.setAttribute(`normal`,new a(d,3)),j.setAttribute(`uv`,new a(f,2)),j.setAttribute(`aLeaf`,new a(p,2)),j.setIndex(new r(m,1)),j.computeBoundingSphere(),j}function $e(e,t,n,r,i,a,o,s,l=9,u=1){let d=V(s),f=e.length/3;for(let s of a.slice(0,l)){let a=new c(1,u).attributes.position,l=new Map,p=[],m=[];for(let e=0;e<a.count;e++){let t=`${a.getX(e).toFixed(4)},${a.getY(e).toFixed(4)},${a.getZ(e).toFixed(4)}`;l.has(t)||(l.set(t,m.length),m.push(new E(a.getX(e),a.getY(e),a.getZ(e)))),p.push(l.get(t))}let h=[d()*10,d()*10,d()*10];for(let i of m){let a=.82+.18*Math.sin(i.x*4.1+h[0])*Math.sin(i.y*3.7+h[1])*Math.sin(i.z*4.3+h[2]),c=new E(s.x+i.x*s.r*o*a,s.y+i.y*s.r*o*a*(s.sy??.8),s.z+i.z*s.r*o*a);e.push(c.x,c.y,c.z),t.push(i.x,i.y,i.z);let l=Math.abs(i.x),u=Math.abs(i.y),f=Math.abs(i.z),p=u>l&&u>f?[c.x,c.z]:l>f?[c.z,c.y]:[c.x,c.y];n.push(p[0]/2.4,p[1]/2.4),r.push(2+Math.min(1,.6+.4*(i.y*.5+.5)),d())}for(let e=0;e<p.length;e+=3)i.push(f+p[e],f+p[e+1],f+p[e+2]);f+=m.length}}var et=null;function tt(){if(et)return et;let e=new o,t=t=>{let n=e.load(ie(`city/props/`+t));return n.anisotropy=4,n.wrapS=n.wrapT=f,n.colorSpace=``,n};return et={col:t(`leaves_col.png`),nrm:t(`leaves_nrm.png`)},et}function nt(e){let t=tt(),n=new C({map:t.col,alphaTest:.42,side:2,roughness:.78});return n.onBeforeCompile=e=>{e.uniforms.uTime=n.userData.uTime,e.uniforms.uLeafN={value:t.nrm},e.uniforms.uLeafFrame={value:R.params},e.vertexShader=e.vertexShader.replace(`#include <common>`,Y.vertexCommon).replace(`#include <begin_vertex>`,Y.vertexBeginVertex);let r=ee.lights_fragment_begin,i=r.indexOf(`csmShadow()`),a=i>=0?r.indexOf(`#endif`,i)+6:r.indexOf(`getDirectionalLightInfo( directionalLight, directLight );`)+57;r=a>60?r.slice(0,a)+`
	leafSun = directLight.color; leafSunDir = directLight.direction;
`+r.slice(a):r,e.fragmentShader=e.fragmentShader.replace(`#include <common>`,Y.fragmentCommon).replace(`#include <map_fragment>`,Y.fragmentMap).replace(`#include <alphatest_fragment>`,Y.fragmentAlphaTest).replace(`#include <normal_fragment_begin>`,Y.fragmentNormalBegin).replace(`#include <lights_fragment_begin>`,P(Y.fragmentLightsBegin,r)).replace(`#include <lights_fragment_end>`,Y.fragmentLightsEnd).replace(`#include <emissivemap_fragment>`,Y.fragmentEmissive)},n.userData.uTime={value:0},n.customProgramCacheKey=()=>`city-leaf-v6`,n}var rt=(e,t=.15)=>{let n=e[0]*.2126+e[1]*.7152+e[2]*.0722;return e.map(e=>e+(n-e)*t)},it=[[[.3,.3,.08],[.17,.19,.05]],[[.2,.23,.07],[.12,.15,.05]],[[.5,.38,.08],[.32,.25,.06]],[[.52,.29,.06],[.34,.17,.04]],[[.4,.33,.08],[.23,.21,.06]],[[.26,.27,.08],[.15,.17,.05]],[[.36,.14,.04],[.24,.09,.03]]].map(e=>e.map(e=>rt(e,.15).map(e=>e*1.2))),at=[[[.4,.13,.04],[.26,.08,.03]],[[.28,.06,.04],[.17,.04,.03]],[[.46,.34,.07],[.3,.22,.05]],[[.18,.21,.07],[.11,.14,.05]],[[.24,.25,.08],[.14,.16,.05]]].map(e=>e.map(e=>rt(e,.15)));[[[.1,.13,.045],[.065,.085,.035],.19],[[.16,.19,.06],[.1,.13,.045],.2],[[.24,.26,.07],[.14,.17,.05],.17],[[.12,.15,.085],[.08,.1,.06],.11],[[.3,.28,.07],[.15,.17,.05],.14],[[.44,.33,.07],[.28,.22,.05],.09],[[.46,.22,.045],[.3,.13,.03],.06],[[.33,.1,.03],[.21,.07,.025],.04]].map(([e,t,n])=>[rt(e,.1).map(e=>e*1.28),rt(t,.1).map(e=>e*1.28),n]);var ot=[[[.17,.168,.066],[.098,.1,.045]],[[.232,.222,.082],[.135,.132,.055]],[[.292,.266,.082],[.172,.158,.054]],[[.19,.196,.1],[.11,.118,.064]],[[.33,.278,.08],[.195,.165,.052]]],st=[[[.075,.1,.06],[.04,.058,.04]],[[.09,.115,.07],[.05,.068,.045]],[[.065,.085,.07],[.035,.05,.042]]].map(e=>e.map(e=>e.map((e,t)=>e*2.05*[1.08,1.02,.9][t]))),ct=[[[.36,.29,.085],[.21,.17,.055]],[[.3,.25,.08],[.18,.15,.052]]],lt=[[[.44,.32,.075],[.26,.19,.05]],[[.43,.215,.055],[.26,.125,.04]],[[.4,.165,.07],[.25,.105,.05]]].map((e,t)=>(t?e.map(e=>rt(e,.2).map((e,t)=>e*[1,1.06,1.1][t])):e).map(e=>rt(e,.22).map(e=>e*.94))),ut=(e,t,n,r)=>.5+.5*(.55*Math.sin(e*n+r)*Math.cos(t*n*.83-r*1.7)+.3*Math.sin((e*.6-t*.8)*n*2.1+r*2.3)+.15*Math.sin((e*.9+t*.4)*n*4.3+r*.7));function dt(e,t){return ut(e,t,1/55,4.1)}var ft=(e,t,n)=>{let r=Math.imul(e,374761393)^Math.imul(t,668265263)^Math.imul(n,2147483647);return r=Math.imul(r^r>>>13,1274126177),((r^r>>>16)>>>0)/4294967296};function X(e,t,n,r=1){let i=e/n,a=t/n,o=Math.floor(i),s=Math.floor(a),c=i-o,l=a-s,u=c*c*(3-2*c),d=l*l*(3-2*l),f=ft(o,s,r),p=ft(o+1,s,r),m=ft(o,s+1,r),h=ft(o+1,s+1,r);return f+(p-f)*u+(m-f)*d+(f-p-m+h)*u*d}function pt(e,t,n){let r=ut(e,t,1/95,1.7),i=n(),a=.72*X(e,t,65,11)+.28*X(e,t,24,12),o=Math.max(0,Math.min(1,(a-.63+.1*r)/.12)),s=.03+.48*o;if(i<s){let r=X(e,t,90,13)*.9+n()*.1;return lt[r<.64?0:r<.9?1:2]}if(i<s+.08+.2*o+.06*r)return ct[n()<.6?0:1];let c=ut(e,t,1/70,2.9)*.25+X(e,t,26,14)*.6+n()*.15;return ot[Math.max(0,Math.min(ot.length-1,Math.floor((c-.15)/.8*ot.length)))]}function mt(e,{detail:t=1,maxLobes:n=3,scale:i=1.12,seed:o=1,envelope:s=!1}){let l=V(o),u=[...e].sort((e,t)=>t.r-e.r),d=u.reduce((e,t)=>e+t.r**2,0),f=u.reduce((e,t)=>[e[0]+t.x*t.r**2/d,e[1]+t.y*t.r**2/d,e[2]+t.z*t.r**2/d],[0,0,0]),p=1/0,m=-1/0;for(let e of u)p=Math.min(p,e.y-e.r*(e.sy??.8)),m=Math.max(m,e.y+e.r*(e.sy??.8));if(s){let e=0;for(let t of u)e=Math.max(e,Math.hypot(t.x-f[0],t.z-f[2])+t.r*.85);u=[{x:f[0],y:(p+m)/2+(m-p)*.06,z:f[2],r:e,sy:(m-p)/2/e*1.02}]}else u=u.slice(0,n);let h=[],g=[],_=[],v=[],y=[],x=0;for(let e of u){let n=new c(1,t).attributes.position,r=new Map,a=[],o=[];for(let e=0;e<n.count;e++){let t=`${n.getX(e).toFixed(4)},${n.getY(e).toFixed(4)},${n.getZ(e).toFixed(4)}`;r.has(t)||(r.set(t,o.length),o.push(new E(n.getX(e),n.getY(e),n.getZ(e)))),a.push(r.get(t))}let s=[l()*10,l()*10,l()*10],u=l(),d=e.sy??.8;for(let t of o){let n=.8+.2*Math.sin(t.x*3.3+s[0])*Math.sin(t.y*2.9+s[1])*Math.sin(t.z*3.1+s[2])+.08*Math.sin(t.x*7.1+t.z*6.3+s[1]),r=t.y<0?t.y*1.18:t.y,a=new E(e.x+t.x*e.r*i*n,e.y+r*e.r*i*n*d,e.z+t.z*e.r*i*n);h.push(a.x,a.y,a.z);let o=new E(a.x-f[0],(a.y-f[1])*1.3,a.z-f[2]).normalize(),c=t.clone().multiplyScalar(.5).addScaledVector(o,.5).normalize();g.push(c.x,c.y,c.z),_.push(0,0);let l=Math.min(1,Math.max(0,(a.y-p)/(m-p)));v.push(Math.min(1,Math.max(0,.12+.5*l+.38*Math.max(0,o.dot(t))-(t.y<-.4?.15:0))),u)}for(let e=0;e<a.length;e+=3)y.push(x+a[e],x+a[e+1],x+a[e+2]);x+=o.length}let S=new b;return S.setAttribute(`position`,new a(h,3)),S.setAttribute(`normal`,new a(g,3)),S.setAttribute(`uv`,new a(_,2)),S.setAttribute(`aLeaf`,new a(v,2)),S.setIndex(new r(y,1)),S.computeBoundingSphere(),S}function ht(){let e=tt(),t=new C({map:e.col,roughness:.85});return t.onBeforeCompile=t=>{t.uniforms.uLeafN={value:e.nrm},t.uniforms.uLeafFrame={value:R.params},t.vertexShader=t.vertexShader.replace(`#include <common>`,Y.vertexCommonLeafCanopyData).replace(`#include <begin_vertex>`,Y.vertexBeginVertexLeafCanopyData),t.fragmentShader=t.fragmentShader.replace(`#include <common>`,Y.fragmentCommonLeafCanopyData).replace(`#include <map_fragment>`,Y.fragmentMapByLeafTintB).replace(`#include <normal_fragment_maps>`,Y.fragmentNormalMaps).replace(`#include <emissivemap_fragment>`,Y.fragmentEmissiveLeafLightTransmission)},t.customProgramCacheKey=()=>`park-crown-v6`,t}function gt(e){let t=[0,0,0],r=[0],i=[];for(let e of[0,1]){let n=t.length/3;e===1&&(t.push(0,0,0),r.push(1));for(let n=0;n<14;n++){let i=n/14*Math.PI*2;t.push(Math.cos(i),0,Math.sin(i)),r.push(e)}let a=e===0?0:n;for(let e=0;e<14;e++)i.push(a,a+1+(e+1)%14,a+1+e)}let o=new m;o.setAttribute(`position`,new a(t,3)),o.setAttribute(`aKind`,new a(r,1)),o.setIndex(i);let s=e.length,c=new Float32Array(s*4);e.forEach((e,t)=>c.set([e.x,e.z,e.cr??e.r*.8,e.h||9],t*4)),o.setAttribute(`aTree`,new v(c,4)),o.instanceCount=s;let l=new E(.5,.5,.5),u=new O({glslVersion:n,uniforms:{uSun:{value:l},uY:{value:re.CURB_H+.03}},vertexShader:ve,fragmentShader:ye,transparent:!0,depthWrite:!1,blending:4,premultipliedAlpha:!0,toneMapped:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4}),d=new h(o,u);d.frustumCulled=!1,d.renderOrder=2,d.name=`park-canopy-shade`;let f=new E,p=new E;return{mesh:d,setSun(e){e.getWorldPosition(f),e.target.getWorldPosition(p);let t=f.sub(p);t.lengthSq()>1e-6&&l.copy(t.normalize())}}}function _t({scene:e,T:t,spots:n,parkPaths:r}){let i=V(99),a=nt(t),o=Ze(),s={},c={street:{lobes:[{x:0,y:6.5,z:0,r:3.3,sy:.85},{x:1.6,y:7.6,z:.8,r:2.1},{x:-1.4,y:7.3,z:-1.2,r:2.2},{x:.3,y:5.6,z:1.8,r:1.8}],trunk:{h:3.6,r:.21,branches:5,spread:1.7}},park:{lobes:[{x:0,y:9,z:0,r:5,sy:.8},{x:3,y:10.5,z:1.5,r:3.4},{x:-2.8,y:10,z:-1.8,r:3.6},{x:1,y:12,z:-2.6,r:3},{x:-1.5,y:7.2,z:3,r:2.8}],trunk:{h:5.5,r:.34,branches:6,spread:2.6}},elm:{lobes:[{x:0,y:13.2,z:0,r:4.6,sy:.6},{x:3.8,y:12.2,z:1.2,r:3.3,sy:.75},{x:-3.6,y:12.6,z:-1.4,r:3.4,sy:.75},{x:.8,y:12,z:3.6,r:3,sy:.8},{x:-1,y:12.4,z:-3.8,r:3,sy:.8},{x:.2,y:15.2,z:.4,r:2.8,sy:.7}],trunk:{h:7.8,r:.37,branches:7,spread:3.4}},small:{lobes:[{x:0,y:4.4,z:0,r:2.5,sy:.85},{x:1.2,y:5.2,z:.6,r:1.7},{x:-1.1,y:5,z:-.8,r:1.7}],trunk:{h:2.2,r:.14,branches:4,spread:1.3}},conifer:{lobes:[{x:0,y:4.2,z:0,r:3.3,sy:.62},{x:.2,y:6.6,z:-.1,r:2.75,sy:.62},{x:-.1,y:8.9,z:.2,r:2.1,sy:.66},{x:.1,y:11,z:0,r:1.45,sy:.72},{x:0,y:12.7,z:0,r:.8,sy:.9}],trunk:{h:4,r:.2,branches:3,spread:1}}},l={street:[180,2.45,16,2.4],park:[220,2.9,22,2.8],elm:[240,3,24,3],small:[120,2.1,12,2.1],conifer:[200,2,18,2]},u=[],d={pools:u},f=ht();for(let[t,n]of Object.entries(c)){let r=t!==`street`,i=Qe({lobes:n.lobes,cards:l[t][0],size:l[t][1],seed:7+t.length,core:.27,coreDetail:r?1:2}),c=He({...n.trunk,seed:3,lobes:n.lobes,kind:t});s[t]=c.collider;let p=qe(c,Ve.near),m=qe(c,Ve.mid),h={aBark:4},g=[],_={aTintA:3,aTintB:3};if(r){let r=mt(n.lobes,{detail:1,maxLobes:t===`conifer`?5:4,seed:31+t.length}),s=mt(n.lobes,{detail:0,maxLobes:5,scale:1.18,seed:41+t.length}),l=new K(i,a,{max:3e3,far:165,shadowFar:165,extra:_,name:`trees-`+t+`-near`}),v=new K(r,f,{max:12e3,near:165,far:520,extra:_,name:`trees-`+t+`-crown`,castShadow:!1}),y=new K(s,f,{max:16e3,near:520,far:3200,extra:_,name:`trees-`+t+`-crownfar`,castShadow:!1}),b=new K(p,o,{max:1500,far:60,shadowFar:60,extra:h,name:`trunks-`+t}),x=new K(m,o,{max:3e3,near:60,far:185,shadowFar:165,extra:h,name:`trunks-`+t+`-mid`}),S=new K(qe(c,Ve.far),o,{max:8e3,near:185,far:420,castShadow:!1,extra:h,name:`trunks-`+t+`-far`});for(let t of[l,v,y,b,x,S])t.items=g,e.add(t.mesh),u.push(t);d[t]=g;continue}let v=Qe({lobes:n.lobes,cards:l[t][2],size:l[t][3],seed:17+t.length,core:.85,coreLobes:4,coreDetail:0}),y=Qe({lobes:[{...n.lobes[0],r:n.lobes[0].r*1.3,y:n.lobes[0].y+n.lobes[0].r*.15}],cards:0,size:1,seed:27+t.length,core:.95,coreLobes:1,coreDetail:0}),b=new K(i,a,{max:3e3,far:170,shadowFar:170,extra:_,name:`trees-`+t+`-near`}),x=new K(v,a,{max:9e3,near:170,far:650,extra:_,name:`trees-`+t+`-far`,castShadow:!1}),S=new K(y,a,{max:9e3,near:650,far:2e3,extra:_,name:`trees-`+t+`-xfar`,castShadow:!1}),C=new K(p,o,{max:1500,far:60,shadowFar:60,extra:h,name:`trunks-`+t}),w=new K(m,o,{max:3e3,near:60,far:240,shadowFar:170,extra:h,name:`trunks-`+t+`-mid`});for(let t of[b,x,S,C,w])t.items=g,e.add(t.mesh),u.push(t);d[t]=g}let m=(e,t,n,r,a=it,o=re.CURB_H,s=null)=>{let c=a[Math.floor(i()*a.length)],l=.9+i()*.3,u=()=>l*(.92+i()*.16);d[e].push({x:t,y:o,z:n,ry:i()*Math.PI*2,s:r,scale3:s,extra:{aTintA:c[0].map(e=>e*u()),aTintB:c[1].map(e=>e*u())}})};for(let e of n){let t=e.sc??.8+i()*.45;e.sc&&i(),e.kind===`small`?m(`small`,e.x,e.z,t,e.pal??at,e.y):m(`street`,e.x,e.z,Math.max(.55,Math.min(t,(e.clear??99)/4.4)),e.pal??it,e.y,e.s3)}let h=re.PARK,g=(e,t)=>{let n=pt(e,t*.7,i),r=1.12;return[[n[0].map(e=>e*r),n[1].map(e=>e*r)]]};for(let e=h.z1-4;e>h.z0+4;e-=6.5+i()*2)m(`street`,h.x0-2.3,e,1.25+i()*.4,g(h.x0,e)),m(`street`,h.x1+2.3,e,1.25+i()*.4,g(h.x1,e));for(let e=h.x0+4;e<h.x1-4;e+=7+i()*2)m(`street`,e,h.z1+2.3,1+i()*.35),m(`street`,e,h.z0-2.3,1+i()*.35);let _=Se,v=[];for(let e of r)for(let t=1;t<e.pts.length;t++)v.push([e.pts[t-1],e.pts[t],e.w/2+(e.drive?2.2:e.minor?.9:1.4),e.minor?.25:1]);let b=new Map;for(let e of v){let[t,n,r]=e;for(let i=Math.floor((Math.min(t[0],n[0])-r)/16);i<=Math.floor((Math.max(t[0],n[0])+r)/16);i++)for(let a=Math.floor((Math.min(t[1],n[1])-r)/16);a<=Math.floor((Math.max(t[1],n[1])+r)/16);a++){let t=i*100003+a,n=b.get(t);n||b.set(t,n=[]),n.push(e)}}let x=(e,t,n=0)=>{let r=new Set;for(let i of[-n,0,n])for(let a of[-n,0,n])r.add(Math.floor((e+i)/16)*100003+Math.floor((t+a)/16));for(let i of r){let r=b.get(i);if(r)for(let[i,a,o,s]of r){let r=a[0]-i[0],c=a[1]-i[1],l=Math.max(0,Math.min(1,((e-i[0])*r+(t-i[1])*c)/(r*r+c*c||1)));if(Math.hypot(e-i[0]-r*l,t-i[1]-c*l)<o+n*s)return!0}}return!1},C=(e,t)=>{let n=Math.sin(e*.021+1.3)*Math.cos(t*.017-.7)+.6*Math.sin(e*.047-t*.031+2.1)+.35*Math.sin(t*.083+e*.012);return Math.max(0,Math.min(1,.45+n*.45))},w=(e,t,n)=>U(e,t)||U(e+n,t)||U(e-n,t)||U(e,t+n)||U(e,t-n),T=Object.values(be),D=(e,t,n)=>T.some(r=>e>r.x0-n&&e<r.x1+n&&t>r.z0-n&&t<r.z1+n),O=new Map,k=[],A=(e,t)=>Math.floor(e/6)*100003+Math.floor(t/6),j=(e,t)=>{let n=X(e,t,30,93)*.7+X(e,t,12,94)*.3;return Math.max(0,Math.min(1,(n-.4)/.32))},ee=.43,M=(e,t,n)=>{let r=Math.floor(e/6),i=Math.floor(t/6);for(let a=r-2;a<=r+2;a++)for(let r=i-2;r<=i+2;r++){let i=O.get(a*100003+r);if(i){for(let r of i)if((r.x-e)**2+(r.z-t)**2<((r.r+n)*ee)**2)return!0}}return!1},N=0,P=performance.now(),F={park:0,elm:0,small:0,conifer:0},I=[];for(let[e,t]of[[5.2,!1],[4.2,!0]]){let n=I.length;for(let n=h.x0+3;n<h.x1-3;n+=e)for(let r=h.z0+3;r<h.z1-3;r+=e)I.push([n+i()*e,r+i()*e,t]);for(let e=I.length-1;e>n;e--){let t=n+Math.floor(i()*(e-n+1)),r=I[e];I[e]=I[t],I[t]=r}}for(let[e,t,n]of I){if(N++,e>h.x1-3||t>h.z1-3)continue;let r=j(e,t);if(ee=.47-.17*r,r<.12&&i()<.3||M(e,t,n?3:5.5))continue;let a=Ce(e,t);if(a<1.04&&!(a>.8&&X(e,t,14,77)>.72&&i()<(n?.35:.75)))continue;let o=Math.sin(e*.061+.4)*Math.sin(t*.053-1.1)+.5*Math.sin(e*.13+t*.11+2.1+.2),s=a<1.04?1:Math.min(1,C(e,t)+.5)*Math.min(1,(a-1.04)/.2+.15)*(o>.85?.2:1);if(i()>s*(n?.6:1.4))continue;let c=dt(e,t);if(c>.66&&i()<Math.min(.85,(c-.66)*4.5)*(n?1:.8))continue;{let n=X(e,t,19,31);if(n>.8&&i()<(n-.8)*5)continue}if(D(e,t,3)||xe.some(([n,r,i])=>(n-e)**2+(r-t)**2<(i*.85)**2)||w(e,t,1.2)||[[13.5,0],[-13.5,0],[0,13.5],[0,-13.5],[9.5,9.5],[-9.5,9.5],[9.5,-9.5],[-9.5,-9.5]].some(([n,r])=>U(e+n,t+r)?.name===`reservoir`))continue;let l=i(),u=X(e,t,70,55),f=n?l<.7?`small`:`park`:l<.58?`park`:l<.94?`elm`:`small`;a>1.25&&(u>.7&&i()<.75||i()<.025)&&(f=`conifer`);let p=!n&&f!==`small`&&f!==`conifer`&&i()<.07+.2*r,g=f===`small`?1:.64+.74*X(e,t,42,21),_=f===`conifer`?(.8+i()*.6)*g:(f===`small`?.6+i()*.6:n?.5+i()*.3:p?1.5+i()*.55:.75+i()*i()*.6)*g,v=(f===`small`?3.8:f===`elm`?7.2:f===`conifer`?4.2:6.6)*_;if(M(e,t,v))continue;if(v*1.3>13.5){let n=v*1.3,r=n*.707;if([[n,0],[-n,0],[0,n],[0,-n],[r,r],[-r,r],[r,-r],[-r,-r]].some(([n,r])=>U(e+n,t+r)?.name===`reservoir`))continue}if(x(e,t)||x(e,t,v*.75-1.4))continue;let y={x:e,z:t,r:v,h:0};k.push(y);let b=A(e,t),S=O.get(b);S||O.set(b,S=[]),S.push(y);let T=f===`conifer`?st[Math.floor(i()*st.length)]:f===`small`&&i()<.25?at[Math.floor(i()*at.length)]:pt(e,t,i),E=p&&lt.includes(T)?_*.68:_;m(f,e,t,E,[T]);let P=d[f][d[f].length-1];{let e=.93+i()*.14;P.extra={aTintA:T[0].map(t=>t*e*(.975+i()*.05)),aTintB:T[1].map(t=>t*e*(.975+i()*.05))}}P.rx=(i()-.5)*.07,P.rz=(i()-.5)*.07,P.y=re.CURB_H+.02;let I=i(),L=f===`small`?1+i()*.2:.98+i()*.3,R=1;f===`conifer`?(L=.85+i()*.3,R=.9+i()*.4):f!==`small`&&(I<.14?(L*=1.15,R=.86+i()*.1):I<.4?(L*=.8,R=1.25+i()*.25):R=1.02+i()*.26,p?(R=1+i()*.15,L*=1.05):n&&(R*=.9));let z=.85+i()*.3;P.scale3=[L*z,R,L/z],y.h=(f===`small`?4.8:f===`elm`?13:f===`conifer`?8:10)*E*R,y.cr=(f===`small`?3:f===`elm`?6.5:f===`conifer`?3.2:5.6)*E*L,F[f]++}{let e=0,t=(t,n)=>{if(D(t,n,2)||w(t,n,1)||x(t,n,.6))return;let r=i()<.8?ot[Math.floor(i()*2)]:at[3+Math.floor(i()*2)],a=.72+i()*.2;d.small.push({hedge:!0,x:t,y:re.CURB_H+.02,z:n,ry:i()*Math.PI*2,s:.34+i()*.14,scale3:[1.45+i()*.4,.62+i()*.22,1.45+i()*.4],extra:{aTintA:r[0].map(e=>e*a),aTintB:r[1].map(e=>e*a)}}),e++};for(let e=h.z1-3;e>h.z0+3;e-=1.9+i()*1.6)i()>.1&&t(h.x0+1.5+i()*.8,e),i()>.1&&t(h.x1-1.5-i()*.8,e);for(let e=h.x0+3;e<h.x1-3;e+=1.9+i()*1.6)i()>.1&&t(e,h.z1-1.5-i()*.8),i()>.1&&t(e,h.z0+1.5+i()*.8);F.hedge=e}d.parkTrees=k.length;{let e=V(4242);for(let t of Object.keys(c))for(let n of d[t]){let r=e(),i=t===`street`?r<.6?q.PLANE:r<.84?q.DARK:q.OAK:t===`park`?X(n.x,n.z,38,61)*.75+r*.25<.4?q.PLANE:q.OAK:t===`elm`?r<.7?q.DARK:q.OAK:t===`small`?r<.65?q.DARK:r<.85?q.OAK:q.PLANE:q.OAK,a=(.7+e()*.22)*(i===q.PLANE?.86:1),o=t===`conifer`?[1.12,.84,.7]:[1,.97+e()*.05,.93+e()*.07];n.extra={...n.extra??{},aBark:[i,o[0]*a,o[1]*a,o[2]*a]}}}d.addSolids=e=>{let t=new y,n=new p,r=new S,i=new E,a=new E,o=new E,l=0;for(let u of Object.keys(c)){let c=s[u];for(let s of d[u]){if(s.hedge)continue;r.set(s.rx||0,s.ry,s.rz||0,`YXZ`),n.setFromEuler(r);let u=s.scale3??[1,1,1];a.set(u[0]*s.s,u[1]*s.s,u[2]*s.s),t.compose(i.set(s.x,s.y,s.z),n,a),o.set(c.x,0,c.z).applyMatrix4(t);let d=(a.x+a.z)/2,f=c.r0*d,p=c.r1*d;f<.05||(e.cyl(o.x,o.z,s.y-.2,s.y+Math.min(4,c.y1*a.y),f,p,`trunk`,8),l++)}}return console.log(`[trees] (veg r1) ${l} trunk colliders`),l},typeof window<`u`&&(window.__trees=d);let L=gt(k);e.add(L.mesh),console.log(`[trees] park ${k.length} (${F.park}/${F.elm}/${F.small}/${F.conifer}) hedge ${F.hedge} in ${N} tries, ${(performance.now()-P).toFixed(0)} ms`),d.meadows=_;let R=0,z=0,B=null;return d.update=(t,n)=>{if(R+=t,a.userData.uTime.value=R,!B){let t=e;for(;t.parent;)t=t.parent;t.traverse(e=>{!B&&e.isDirectionalLight&&e.castShadow&&(B=e)})}B&&L.setSun(B);let r=performance.now();for(let e=0;e<u.length;e++){let t=u[(z+e)%u.length];if(t.due(n)&&(t.update(n),performance.now()-r>.5)){z=(z+e+1)%u.length;break}}},d}var vt=`// park shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>
out vec2 vGU; in float aGV; out float vGV;\r
// @section vertexUvVertex\r
#include <uv_vertex>
vGU = uv; vGV = aGV;\r
// @section fragmentCommon\r
#include <common>\r
      in vec2 vGU; in float vGV; float gH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\r
// @section fragmentMap\r
\r
        // (park r6) critic r5: 'solar-panel grid textures'. Pale frosted panes (ref 10) in a finer, thinner mullion grid\r
        // (park r8) per-skylight family + pitch (vGV): no two neighbouring skylights share a look\r
        vec2 pitch = vGV < 0.33 ? vec2(1.6, 1.1) : (vGV < 0.66 ? vec2(2.4, 1.5) : vec2(1.2, 2.2));\r
        vec2 gc = vGU / pitch, gf = fract(gc), gi = floor(gc);\r
        vec2 fw = fwidth(gc) * 1.2;\r
        vec2 bar = vec2(0.03, 0.045);\r
        float fr = 1.0 - (smoothstep(bar.x, bar.x + fw.x, gf.x) * smoothstep(bar.x, bar.x + fw.x, 1.0 - gf.x)\r
                        * smoothstep(bar.y, bar.y + fw.y, gf.y) * smoothstep(bar.y, bar.y + fw.y, 1.0 - gf.y));\r
        float h = gH(gi), h2 = gH(gi + 17.3);\r
        vec3 pane = mix(vec3(0.25, 0.29, 0.33), vec3(0.32, 0.35, 0.38), step(0.8, h)) /* (park r9) critic r8: 'bright blue-white skylights look pasted on' */ * (0.92 + 0.1 * h2); // (park r8) less pane-to-pane checker\r
        float fam = fract(vGV * 7.13);\r
        if (fam < 0.34) pane = mix(vec3(0.16, 0.2, 0.25), vec3(0.24, 0.28, 0.32), step(0.85, h)) * (0.9 + 0.2 * h2);   // dark reflective\r
        else if (fam < 0.58) pane = mix(vec3(0.36, 0.38, 0.37), vec3(0.44, 0.45, 0.42), step(0.75, h)) * (0.9 + 0.12 * h2); // milky, weathered\r
        pane *= 0.82 + 0.3 * smoothstep(0.0, 1.0, fract(vGU.x * 0.021 + vGV * 3.0)) ; // broad grime / reflection gradient across the skylight\r
        pane *= 1.0 - 0.18 * smoothstep(0.3, 1.0, fract(vGU.y * 0.07 + h * 0.3));   // dirt washes down the panes\r
        { // (park r10) critic r9: 'add dirt'. Blotchy soot / bird-lime / leaf-litter grime per pane cluster, darker in the\r
          // bottom corners where rain water pools against the bars\r
          float gd = gH(floor(vGU / 5.0) + vGV * 31.0), gd2 = gH(gi * 0.5 + 3.7);\r
          pane *= 1.0 - 0.28 * smoothstep(0.55, 0.95, gd * 0.6 + gd2 * 0.5);\r
          pane *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.22, gf.y)) * (0.5 + 0.5 * h2);\r
          pane = mix(pane, vec3(0.2, 0.18, 0.14), 0.18 * step(0.9, gd2));\r
        }\r
        diffuseColor.rgb = mix(pane, vec3(0.3, 0.31, 0.32), fr * 0.6);\r
        float gRough = mix(mix(0.36, 0.5, step(0.8, h)), 0.6, fr);\r
        if (fam < 0.34) gRough = mix(0.5, 0.6, fr); else if (fam < 0.58) gRough = mix(0.72, 0.8, fr);   // (park r8) dark = matte wired glass, milky = frosted\r
      \r
// @section fragmentRoughness\r
#include <roughnessmap_fragment>
roughnessFactor = gRough;\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.018, 0.017, 0.015) * (1.0 - fr) * step(h2, 0.7);\r
// @section fragmentMapByCopingUv\r
#include <map_fragment>\r
        { float blk = fract(vCopUV.y / 1.8); float j = smoothstep(0.0, 0.04, blk) * smoothstep(1.0, 0.96, blk);\r
          float h = fract(sin(floor(vCopUV.y / 1.8) * 91.7) * 4375.5);\r
          diffuseColor.rgb *= (0.55 + 0.45 * j) * (0.85 + 0.25 * h) * mix(0.8, 1.0, smoothstep(0.0, 0.25, vCopUV.x)); }\r
// @section fragmentCommonByCopingUv\r
#include <common>
in vec2 vCopUV;\r
// @section vertexCommonByCopingUv\r
#include <common>
out vec2 vCopUV;\r
// @section vertexUvVertexByCopingUv\r
#include <uv_vertex>
vCopUV = uv;\r
// @section vertexCommonByFountainUv\r
#include <common>
out vec2 vFU;\r
// @section vertexUvVertexByFountainUv\r
#include <uv_vertex>
vFU = uv;\r
// @section fragmentCommonByFountainUv\r
#include <common>
in vec2 vFU;\r
// @section fragmentAlphaTest\r
\r
        { vec2 q = vec2(vFU.x + vFU.y, vFU.x - vFU.y) / 0.06; vec2 f = abs(fract(q) - 0.5); float w = min(f.x, f.y);\r
          vec2 fw = fwidth(q); float cov = 1.0 - smoothstep(0.06, 0.06 + max(fw.x, fw.y), w);\r
          float far = smoothstep(0.15, 0.6, max(fw.x, fw.y));\r
          diffuseColor.a = mix(cov, 0.42, far);\r
          float rail = step(abs(vFU.y - 0.03), 0.03) + step(abs(vFU.y - floor(vFU.y / 5.0 + 0.5) * 5.0), 0.04);\r
          diffuseColor.a = max(diffuseColor.a, min(rail, 1.0)); if (diffuseColor.a < 0.02) discard; }\r
        #include <alphatest_fragment>\r
// @section vertexCommonByHexWorldPosition\r
#include <common>
out vec2 vHexW;\r
// @section vertexBeginVertex\r
#include <begin_vertex>
vHexW = (modelMatrix * vec4(position, 1.0)).xz;\r
// @section fragmentCommonByHexWorldPosition\r
#include <common>\r
      in vec2 vHexW;\r
      float hxH(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }\r
// @section fragmentMapByHexWorldPosition\r
#include <map_fragment>\r
      { vec2 p = vHexW / 0.23; // hexagon cells (~0.4 m across)\r
        vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;\r
        vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;\r
        vec2 g = dot(a, a) < dot(b, b) ? a : b;\r
        vec2 id = p - g;\r
        vec2 q = abs(g); float edge = 0.5 - max(dot(q, normalize(r)), q.x);\r
        float fw = fwidth(p.x) * 1.2;\r
        float mortar = 1.0 - smoothstep(0.02, 0.02 + fw, edge);\r
        float far = smoothstep(0.08, 0.35, fw);\r
        float tone = 0.86 + 0.2 * hxH(floor(id * 10.0 + 0.5));\r
        float gr = 0.9 + 0.1 * sin(vHexW.x * 0.37 + vHexW.y * 0.21) * sin(vHexW.y * 0.13);\r
        diffuseColor.rgb *= mix(tone * mix(1.0, 0.55, mortar), 0.9, far) * gr; }\r
// @section vertexCommonByWalkwayWorldPosition\r
#include <common>
out vec2 vDW;\r
// @section vertexBeginVertexByWalkwayWorldPosition\r
#include <begin_vertex>
vDW = (modelMatrix * vec4(position, 1.0)).xz;\r
// @section fragmentCommonByWalkwayWorldPosition\r
#include <common>\r
        in vec2 vDW;\r
        float dH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\r
        float dN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\r
          return mix(mix(dH(i), dH(i + vec2(1, 0)), f.x), mix(dH(i + vec2(0, 1)), dH(i + vec2(1, 1)), f.x), f.y); }\r
// @section fragmentMapByWalkwayWorldPosition\r
#include <map_fragment>\r
        { float n = dN(vDW * 0.35) * 0.6 + dN(vDW * 1.7) * 0.4;\r
          diffuseColor.rgb *= 0.82 + 0.3 * n;                                  // patched / sealed asphalt\r
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.2, 0.19), smoothstep(0.72, 0.8, dN(vDW * 0.12 + 3.0)) * 0.5); }\r
`,yt=`in float aT;\r
\r
out float vT;\r
out vec3 vW;\r
\r
#include <fog_pars_vertex>\r
\r
void main() {\r
  vT = aT;\r
\r
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);\r
  vW = worldPosition.xyz;\r
\r
  vec4 viewPosition = viewMatrix * worldPosition;\r
  gl_Position = projectionMatrix * viewPosition;\r
\r
  #include <fog_vertex>\r
}\r
`,bt=`in float vT;\r
in vec3 vW;\r
\r
uniform float uTime;\r
out vec4 fragColor;\r
\r
#include <fog_pars_fragment>\r
\r
float hash2D(vec2 position) {\r
  return fract(sin(dot(position, vec2(127.1, 311.7))) * 43758.5453);\r
}\r
\r
float valueNoise(vec2 position) {\r
  vec2 gridCell = floor(position);\r
  vec2 cellBlend = fract(position);\r
  cellBlend = cellBlend * cellBlend * (3.0 - 2.0 * cellBlend);\r
\r
  return mix(mix(hash2D(gridCell), hash2D(gridCell + vec2(1.0, 0.0)), cellBlend.x), mix(hash2D(gridCell + vec2(0.0, 1.0)), hash2D(gridCell + vec2(1.0, 1.0)), cellBlend.x), cellBlend.y);\r
}\r
\r
void main() {\r
  vec3 viewDirection = normalize(cameraPosition - vW);\r
  float grazingAngle = 1.0 - clamp(viewDirection.y, 0.0, 1.0);\r
  float shorelineNoise = valueNoise(vW.xz * 0.18) * 0.6 + valueNoise(vW.xz * 0.7) * 0.4;\r
\r
  // The reflected tree line has a bumpy inner edge and extends farther at grazing angles.\r
  float treeCrowns = valueNoise(vec2(vW.x + vW.z, vW.z - vW.x) * 0.14) * 0.6 +\r
    valueNoise(vW.xz * 0.45) * 0.4;\r
  float reflectionReach = mix(0.6, 0.95, grazingAngle) * (0.65 + 0.55 * treeCrowns);\r
  float shorelinePosition = clamp(vT + (shorelineNoise - 0.5) * 0.18, 0.0, 1.0);\r
  float treeReflectionBand = 1.0 - smoothstep(reflectionReach - 0.12, reflectionReach + 0.05, shorelinePosition);\r
\r
  // Wind adds sky-reflecting patches and fine streaks to the water surface.\r
  vec2 windDirection = vec2(0.8, 0.6);\r
  vec2 windPosition = vec2(dot(vW.xz, windDirection), dot(vW.xz, vec2(-windDirection.y, windDirection.x)));\r
  float windPatches = smoothstep(0.45, 0.8, valueNoise(windPosition * vec2(0.02, 0.035) + uTime * 0.01) * 0.7 +\r
    valueNoise(windPosition * 0.09) * 0.3);\r
  float windStreaks = valueNoise(vec2(windPosition.x * 0.03, windPosition.y * 0.6));\r
  float rippleNoise = valueNoise(windPosition * vec2(0.9, 2.2) + vec2(uTime * 0.4, 0.0));\r
\r
  vec3 skyColor = mix(vec3(0.44, 0.52, 0.6), vec3(0.72, 0.76, 0.8), grazingAngle);\r
  vec3 deepWaterColor = vec3(0.035, 0.05, 0.045);\r
\r
  // From above, show mostly dark water; reflections strengthen toward the horizon.\r
  float fresnelWeight = 0.12 + 0.88 * pow(grazingAngle, 3.0);\r
  float fineRipples = valueNoise(windPosition * vec2(0.35, 1.3) - vec2(uTime * 0.25, 0.0)) *\r
    valueNoise(windPosition * vec2(1.7, 4.1) + vec2(uTime * 0.6, 0.0));\r
  vec3 color = mix(deepWaterColor, skyColor, clamp((0.18 + 0.45 * windPatches + 0.2 * windStreaks + 0.25 * fineRipples) *\r
    mix(0.55, 1.0, fresnelWeight), 0.0, 1.0));\r
  float opacity = clamp((0.34 + 0.24 * windPatches + 0.14 * abs(windStreaks - 0.5) +\r
    0.12 * fineRipples) * mix(1.0, 0.7, fresnelWeight), 0.0, 0.8);\r
\r
  // Layer a reflected sky gradient and broad ripples over the teal water body.\r
  {\r
    vec3 zenithSkyColor = vec3(0.26, 0.36, 0.48);\r
    vec3 horizonSkyColor = vec3(0.6, 0.66, 0.7);\r
    vec3 reflectedSky = mix(zenithSkyColor, horizonSkyColor, pow(grazingAngle, 1.6));\r
    float cloudiness = smoothstep(0.35, 0.85, valueNoise(vW.xz * 0.006 + vec2(uTime * 0.002, 0.0)) * 0.7 +\r
      valueNoise(vW.xz * 0.02) * 0.3);\r
    reflectedSky = mix(reflectedSky, vec3(0.7, 0.72, 0.74), cloudiness * 0.45);\r
\r
    float broadRipples = valueNoise(windPosition * vec2(0.05, 0.18) + vec2(uTime * 0.05, 0.0)) *\r
      0.5 +\r
      valueNoise(windPosition * vec2(0.16, 0.55) - vec2(uTime * 0.12, 0.0)) *\r
      0.3 +\r
      fineRipples * 0.4;\r
    vec3 waterBodyColor = vec3(0.045, 0.068, 0.07) *\r
      (0.9 + 0.25 * valueNoise(vW.xz * 0.03));\r
    float reflectedSkyWeight = clamp(0.1 + 0.8 * pow(grazingAngle, 2.4) + 0.22 * (broadRipples - 0.45) +\r
      0.2 * windPatches, 0.04, 0.95);\r
    vec3 layeredWaterColor = mix(waterBodyColor, reflectedSky, reflectedSkyWeight);\r
\r
    color = mix(color, layeredWaterColor, 0.75);\r
    opacity = max(opacity, mix(0.62, 0.85, grazingAngle));\r
  }\r
\r
  // Dark olive and umber tones form the reflection of the tree line.\r
  vec3 treeColor = mix(vec3(0.028, 0.036, 0.018), vec3(0.07, 0.058, 0.03), treeCrowns) * (0.85 + 0.3 * rippleNoise);\r
  color = mix(color, treeColor, treeReflectionBand);\r
  opacity = mix(opacity, 0.9, treeReflectionBand);\r
\r
  // A silty shelf fades into the water, followed by a thin wet-stone lip and foam.\r
  float shallowShelf = 1.0 - smoothstep(0.0, 0.16 + 0.08 * shorelineNoise, vT);\r
  color = mix(color, vec3(0.11, 0.1, 0.066) * (0.85 + 0.3 * shorelineNoise), shallowShelf * mix(0.7, 0.25, grazingAngle));\r
  float shorelineFoam = (1.0 - smoothstep(0.0, 0.03, vT)) *\r
    smoothstep(0.45, 0.7, valueNoise(vW.xz * 0.9 + uTime * 0.05));\r
  color = mix(vec3(0.07, 0.065, 0.052), color, smoothstep(0.0, 0.035, vT));\r
  color = mix(color, vec3(0.34, 0.35, 0.33), shorelineFoam * 0.55);\r
  opacity = max(opacity, (1.0 - smoothstep(0.0, 0.035, vT)) * 0.8);\r
\r
  fragColor = vec4(color, opacity);\r
\r
  #ifdef USE_FOG\r
    #ifdef FOG_EXP2\r
  float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);\r
    #else\r
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);\r
    #endif\r
  fragColor.rgb = mix(fragColor.rgb, fogColor, fogFactor);\r
  #endif\r
}\r
`,Z=N(()=>vt),Q=te+.02,xt=te+.02,St=[];function Ct(e){let t=be.met,n=(e,t)=>{let n=[e[0]];for(let r=1;r<e.length;r++){let[i,a]=e[r-1],[o,s]=e[r],c=Math.hypot(o-i,s-a),l=Math.max(1,Math.ceil(c/t));for(let e=1;e<=l;e++)n.push([i+(o-i)*e/l,a+(s-a)*e/l])}return n},r=[];for(let i of e){if(i.drive){let e=n(i.pts,6),a=t.x0-9;for(let n of e){if(n[0]<a)continue;let e=Math.max(t.z0-4-n[1],n[1]-(t.z1+4),0),r=e>=55?0:.5+.5*Math.cos(Math.PI*e/55);n[0]+=(a-n[0])*r}r.push({...i,pts:e});continue}let e=n(i.pts,3),a=2.5+i.w/2,o=[],s=()=>{o.length>=3&&r.push({...i,pts:o}),o=[]};for(let n of e)n[0]>t.x0-a&&n[0]<t.x1+a&&n[1]>t.z0-a&&n[1]<t.z1+a?s():o.push(n);s()}return e.length=0,e.push(...r),wt(e),e}function wt(e){let t=B,n=be.met,r=V(8088),i=new Map,a=(e,t,n)=>{let r=Math.floor(e/10)*100003+Math.floor(t/10),a=i.get(r);a||i.set(r,a=[]),a.push([e,t,n])};e.forEach((e,t)=>{for(let n=1;n<e.pts.length;n++){let[r,i]=e.pts[n-1],[o,s]=e.pts[n],c=Math.max(1,Math.ceil(Math.hypot(o-r,s-i)/3));for(let e=0;e<=c;e++)a(r+(o-r)*e/c,i+(s-i)*e/c,t)}});let o=(e,t,n,r)=>{let a=null,o=n*n;for(let s=Math.floor((e-n)/10);s<=Math.floor((e+n)/10);s++)for(let c=Math.floor((t-n)/10);c<=Math.floor((t+n)/10);c++)for(let n of i.get(s*100003+c)??[]){if(n[2]===r)continue;let i=(n[0]-e)**2+(n[1]-t)**2;i<o&&(o=i,a=n)}return a},s=(e,t,n)=>U(e,t)||U(e+n,t)||U(e-n,t)||U(e,t+n)||U(e,t-n),c=(e,r)=>e<t.x0+12||e>t.x1-12||r<t.z0+12||r>t.z1-12||e>n.x0-8&&e<n.x1+8&&r>n.z0-8&&r<n.z1+8,l=(e,t)=>Ce(e,t)<.9,u=0;for(let t=0;t<160&&u<46;t++){let t=e[Math.floor(r()*e.length)],n=e.indexOf(t);if(t.pts.length<3)continue;let i=1+Math.floor(r()*(t.pts.length-2)),[d,f]=t.pts[i-1],[p,m]=t.pts[i+1],h=Math.atan2(m-f,p-d)+(r()<.5?1:-1)*(Math.PI/2+(r()-.5)*1.1),[g,_]=t.pts[i];if(l(g,_)||s(g,_,10))continue;let v=[[g,_]],y=(r()-.5)*.12,b=!1;for(let e=0;e<70;e++){y=y*.85+(r()-.5)*.16,h+=y;let t=g+Math.cos(h)*5,i=_+Math.sin(h)*5,a=0;for(;(s(t,i,7)||c(t,i)||l(t,i))&&a++<10;)h+=(y>=0?1:-1)*.4,t=g+Math.cos(h)*5,i=_+Math.sin(h)*5;if(a>=10)break;if(g=t,_=i,v.push([g,_]),e>5){let e=o(g,_,4.5,n);if(e&&e[2]!==n){v.push([e[0],e[1]]),b=!0;break}}}if(v.length<8||!b&&(v.length<22||r()<.6))continue;let x=e.length;e.push({pts:v,w:2.3+r()*.9,minor:!0});for(let e=1;e<v.length;e++)a(v[e][0],v[e][1],x);u++}}function Tt({scene:t,facadeMat:n,solids:r=null,zips:i=null,meadowDist:o=null,parkPaths:s=[]}){let c=new L,l=r,u=[],d=[],f=(e,t,n,r,i,a,o,s={},u=!0,d=null,f=`wall`)=>{c.box(e,t,n,r,i,a,o,s,u,!1,d),l?.box(e,t,n,r,i,a,f)},p={count:0},m=[];{let e={style:z.BLANK,layer:I.LIME,tint:[.93,.9,.84],seed:11,floorH:7,bayW:5.6,winW:.46,winH:.72,margin:1.4,depth:.6,glass:1},n={...e},r={...e,floorH:12.5,bayW:7.2,winW:.52,winH:.74,depth:.6,seed:12},a={style:z.BLANK,layer:I.GRANITE,tint:[.42,.41,.4],seed:13,floorH:4.5,bayW:3,winW:.8,winH:.5,margin:.4,depth:.2},o={style:z.BLANK,layer:I.METAL,tint:[.72,.8,.86],seed:14,floorH:4,bayW:1.6,winW:.96,winH:.9,margin:0,depth:.04,glass:2},s={style:z.BLANK,layer:I.ROOF_MEMBRANE,tint:[.11,.11,.115],seed:15},g={style:z.BLANK,layer:I.ROOF_GRAVEL,tint:[.14,.14,.14],seed:16};z.BLANK,I.WHITE;let _=e=>({style:e,gH:0}),v=_(z.PUNCHED),y=_(z.CURTAIN),b=_(z.BLANK),x=19.5,S=25.5;f(196,0,-1362,222,x,-1298,n,{px:v,nz:v,pz:null,nx:v},!0,s),f(196,0,-1274,222,x,-1208,n,{px:v,pz:v,nz:null,nx:v},!0,s),f(222,0,-1362,223.2,20.7,-1348,e,{px:v,nz:b,pz:b,nx:b},!0,e),f(222,0,-1222,223.2,20.7,-1208,e,{px:v,nz:b,pz:b,nx:b},!0,e),f(221.4,x,-1348,222,20.6,-1298,e,{px:b,nz:null,pz:null,nx:b},!0,e),f(221.4,x,-1274,222,20.6,-1222,e,{px:b,nz:null,pz:null,nx:b},!0,e),f(196,0,-1298,224,S,-1274,r,{px:v,nz:b,pz:b,nx:b},!0,s),f(222.5,S,-1296,224,27.9,-1276,e,{px:b,nz:b,pz:b,nx:b},!0,e);let w={...e,tint:[.95,.92,.86]};f(224,0,-1296.5,226.6,3,-1275.5,e,{px:b,nz:b,pz:b,nx:null},!0,e);for(let e of[-1294.8,-1293,-1289.5,-1287.7,-1284.3,-1282.5,-1279,-1277.2])c.cyl(225.3,e,.52,3,20.6,8,w,z.BLANK,!1),l?.cyl(225.3,e,3,20.6,.52*(1+Math.cos(Math.PI/8))/2,.52*(1+Math.cos(Math.PI/8))/2,`wall`),f(224.55,20.6,e-.75,226.05,21.2,e+.75,w,{nx:null},!1);f(224,21.2,-1296.5,226.6,23.8,-1275.5,e,{px:b,nz:b,pz:b,nx:null},!0,e);for(let[e,t]of[[-1291.25,[.5,.13,.1]],[-1285.9,[.2,.26,.36]],[-1280.65,[.62,.46,.2]]])f(224,7.6,e-1,224.07,19.4,e+1,{style:z.BLANK,layer:I.WHITE,tint:t,seed:75},{px:b,nz:b,pz:b,nx:null},!0,null,`awning`),f(223.95,19.4,e-1.1,224.14,19.55,e+1.1,{style:z.BLANK,layer:I.METAL,tint:[.3,.3,.3],seed:76},{px:b,nz:b,pz:b,nx:null},!0,null,`awning`);for(let t=0;t<6;t++){let n=231.5-t*.8,r=t*.02;f(226.6,0,-1306+r,n,Q+(t+1)*.47,-1266-r,e,{nx:null},!0,{...e,tint:[.8,.78,.74]})}{let t={...e,tint:[.97,.94,.88]};for(let[n,r,i]of[[-1362,-1298,e=>e<-1347],[-1274,-1208,e=>e>-1223]]){let a=r-n-2*e.margin,o=Math.max(1,Math.round(a/e.bayW)),s=a/o;for(let n=0;n<=o;n++){let a=r-(e.margin+n*s);i(a)||(f(222,Q,a-.5,222.42,18.05,a+.5,t,{px:b,nz:b,pz:b,nx:null},!1),f(221.95,Q,a-.62,222.55,1.6,a+.62,t,{px:b,nz:b,pz:b,nx:null},!0,t),f(221.95,17.75,a-.62,222.55,18.05,a+.62,t,{px:b,nz:b,pz:b,nx:null},!0,t))}f(222,18.05,n+(n<-1300?14:0),222.95,18.55,r-(n<-1300?0:14),t,{px:b,nz:b,pz:b,nx:null},!0,t,`cornice`),f(222,18.55,n+(n<-1300?14:0),223.25,18.95,r-(n<-1300?0:14),t,{px:b,nz:b,pz:b,nx:null},!0,t,`cornice`)}for(let[n,r]of[[-1362,-1],[-1208,1]]){let i=e=>r<0?[n-e,n]:[n,n+e],[a,o]=i(.95);f(196,18.05,a,223.2,18.55,o,t,{all:b},!0,t,`cornice`),[a,o]=i(1.25),f(196,18.55,a,223.5,18.95,o,t,{all:b},!0,t,`cornice`),[a,o]=i(.22),f(196,6,a,223.2,6.45,o,t,{all:b},!0,t,`cornice`),[a,o]=i(.3),f(196,Q,a,223.2,1.2,o,{...e,tint:[.78,.76,.72]},{all:b},!0,t)}f(224,24.3,-1297.5,227.2,24.9,-1274.5,t,{px:b,nz:b,pz:b,nx:null},!0,t,`cornice`),c.horiz(223.4,-1340,233.3,-1232,Q+.006,{style:z.BLANK,layer:I.CONCRETE,tint:[.86,.84,.8],seed:71});for(let t of[-1321,-1251]){let n=228.6,r=3.4,i={...e,tint:[.84,.81,.76]},a=(e,t)=>e*(1+Math.cos(Math.PI/t))/2;c.cyl(n,t,r,Q,Q+.62,28,i,z.BLANK,!0),l?.cyl(n,t,Q,Q+.62,a(r,28),a(r,28),`wall`),c.cyl(n,t,3.05,Q+.62,Q+.626,28,{style:z.BLANK,layer:I.METAL,tint:[.42,.52,.56],seed:73},z.BLANK,!0),c.cyl(n,t,.7,Q+.62,Q+1.25,12,i,z.BLANK,!0),l?.cyl(n,t,Q+.62,Q+1.25,a(.7,12),a(.7,12),`wall`),m.push([n,Q+1.25,t])}}let T=new H;T.setColor([.05,.055,.06]);let E=15.5,D=13.5,O={...g,tint:[.15,.148,.142]},k={...s,tint:[.1,.1,.108]},A={...s,layer:I.ROOF_MEMBRANE,tint:[.2,.196,.188]},j=_(z.RIBBON);f(150,0,-1356,196,E,-1310,a,{nx:j,nz:j,pz:null,px:null},!0,O),f(150,0,-1310,196,19,-1262,a,{nx:j,nz:b,pz:b,px:null},!0,k),f(150,0,-1262,196,D,-1214,a,{nx:j,nz:null,pz:j,px:null},!0,A),f(160,0,-1376,196,13.5,-1356,o,{nx:y,nz:y,px:y,pz:null},!0,s),f(138,0,-1318,150,8.5,-1254,o,{nx:y,nz:y,pz:y,px:null},!1);{let e=8.5,t=13.2,n=-1318,r=-1254,i=[[138,e,n],[138,e,r],[150,t,r],[150,t,n]];i.v=.1,d.push(i);let a=[[150,e,n],[138,e,n],[150,t,n]],o=[[138,e,r],[150,e,r],[150,t,r]];a.v=o.v=.1,d.push(a,o),l?.ramp(138,8.48,n,150,r,0,e,t,`skylight`);for(let e=n;e<=-1253.99;e+=3.2)T.tube([138,8.51,e],[150,13.209999999999999,e],.02,4);T.box(137.8,8.2,n,138.1,8.52,r),l?.box(137.8,8.2,n,138.1,8.52,r,`skylight`),T.box(149.7,13.18,n,150,13.44,r),l?.box(149.7,13.18,n,150,13.44,r,`skylight`)}let ee={style:z.BLANK,layer:I.METAL,tint:[.32,.33,.34],seed:18},M=(e,t,n,r,i,a)=>{f(e,i,t,n,i+a,r,ee,{all:b},!1,null,`equipment`),u.push([e,t,n,r,i+a]);let o=n-e>r-t,s=o?n-e:r-t,c=Math.max(1,Math.round(s/3.2)),l={...ee,tint:[.2,.21,.22]};for(let u=1;u<c;u++){let d=(o?e:t)+s*u/c;o?f(d-.07,i+a,t,d+.07,i+a+.12,r,l,{all:b},!0,l,`skylight`):f(e,i+a,d-.07,n,i+a+.12,d+.07,l,{all:b},!0,l,`skylight`)}if((o?r-t:n-e)>7){let s=(o?t+r:e+n)/2;o?f(e,i+a,s-.08,n,i+a+.14,s+.08,l,{all:b},!0,l,`skylight`):f(s-.08,i+a,t,s+.08,i+a+.14,r,l,{all:b},!0,l,`skylight`)}let d=.24,p=i+a+.22;f(e,i+a,t,n,p,t+d,l,{all:b},!0,l,`skylight`),f(e,i+a,r-d,n,p,r,l,{all:b},!0,l,`skylight`),f(e,i+a,t+d,e+d,p,r-d,l,{all:b},!0,l,`skylight`),f(n-d,i+a,t+d,n,p,r-d,l,{all:b},!0,l,`skylight`)},N=(e,t,n,r,i,a,o)=>{let s=i+.5,c=s+a;if(f(e,i,t,n,s,r,ee,{all:b},!1,null,`equipment`),o){let i=(t+r)/2;d.push([[e,s,t],[n,s,t],[n,c,i],[e,c,i]],[[e,c,i],[n,c,i],[n,s,r],[e,s,r]]),l?.ramp(e,s-.02,t,n,i,2,s,c,`skylight`),l?.ramp(e,s-.02,i,n,r,2,c,s,`skylight`);for(let a of[e,n]){let n=T.v;T.vert(a,s,t,a===e?-1:1,0,0),T.vert(a,s,r,a===e?-1:1,0,0),T.vert(a,c,i,a===e?-1:1,0,0),T.tri(n,n+1,n+2),T.tri(n,n+2,n+1)}T.box(e,c-.04,i-.12,n,c+.1,i+.12),l?.box(e,c-.04,i-.12,n,c+.1,i+.12,`skylight`)}else{let i=(e+n)/2;d.push([[e,s,t],[e,s,r],[i,c,r],[i,c,t]],[[i,c,t],[i,c,r],[n,s,r],[n,s,t]]),l?.ramp(e,s-.02,t,i,r,0,s,c,`skylight`),l?.ramp(i,s-.02,t,n,r,0,c,s,`skylight`);for(let a of[t,r]){let r=T.v;T.vert(e,s,a,0,0,a===t?-1:1),T.vert(n,s,a,0,0,a===t?-1:1),T.vert(i,c,a,0,0,a===t?-1:1),T.tri(r,r+1,r+2),T.tri(r,r+2,r+1)}T.box(i-.12,c-.04,t,i+.12,c+.1,r),l?.box(i-.12,c-.04,t,i+.12,c+.1,r,`skylight`)}};N(156,-1350,190,-1345,E,1.5,!0),N(158,-1340,186,-1335,E,1.5,!0),N(156,-1330,176,-1325,E,1.5,!0),M(161,-1298,185,-1276,19,2.2),M(188,-1296,194,-1280,19,1),M(155,-1254,183,-1231,D,1.2),M(187,-1249,193,-1238,D,.9),M(202,-1354,216,-1335,x,1.2),N(203,-1326,215,-1305,x,1.8,!1),N(204,-1266,214,-1216,x,2,!1),M(205,-1292,217,-1280,S,1.5);{let t=V(606),n={style:z.BLANK,layer:I.METAL,tint:[1.9,1.92,1.95],seed:19},r={...n,tint:[1.1,1.12,1.12]},i=[[1.9,1.92,1.95],[2.2,2.1,1.95],[1.5,1.52,1.5],[2,1.9,1.7],[1.2,1.24,1.28],[.9,.86,.8]],o=(e,a,o,s,u)=>{let d=1.1+t()*1.3,p=i[Math.floor(t()*i.length)];f(e,u,a,e+o,u+d,a+s,{...n,tint:p},{all:b},!0,{...n,tint:p.map(e=>e*.9)},`equipment`);let m=Math.max(1,Math.floor(Math.max(o,s)/2.2));for(let t=0;t<m;t++){let n=(t+.5)/m,i=o>s?e+o*n:e+o/2,f=o>s?a+s/2:a+s*n,p=Math.min(o,s)*.3;c.cyl(i,f,p,u+d,u+d+.35,10,r,z.BLANK,!0),l?.cyl(i,f,u+d,u+d+.35,p*(1+Math.cos(Math.PI/10))/2,p*(1+Math.cos(Math.PI/10))/2,`equipment`)}};o(151.2,-1353,3.4,6.5,E),o(177.5,-1323,7,3,E),o(151.2,-1328,3.2,5,E),o(191.5,-1352,3.6,5.5,E),f(189,E,-1321,195,18.9,-1312,a,{all:b},!0,s,`equipment`),f(152.2,E,-1321,188,16.3,-1319.8,r,{all:b},!0,r,`equipment`),f(151,19,-1308,159,21.6,-1300,a,{all:b},!0,s,`equipment`),o(186,-1307,7.5,3.2,19),o(152,-1272,3.4,7,19),o(187.5,-1274,3.6,8,19),f(160,19,-1266.5,185,19.7,-1265.3,r,{all:b},!0,r,`equipment`),o(151.5,-1228,3.4,5,D),o(160,-1226,6.5,2.6,D),o(172,-1226,5,2.6,D),o(187,-1232,3.6,6,D),o(197,-1360,3.2,4.5,x),o(217.6,-1350,3.2,5.5,x),o(197,-1318,3.4,5,x),o(197,-1262,3.2,4.2,x),o(217.6,-1244,3.2,6,x),o(197,-1228,3.2,5.5,x);let u={...e,tint:[.82,.8,.76]},d=(e,t,n,r,i)=>f(e,i,t,n,i+.75,r,u,{all:b},!0,u,`parapet`);d(196,-1362,196.5,-1298,x),d(196,-1274,196.5,-1208,x),d(196.5,-1362,221.4,-1361.5,x),d(196.5,-1208.5,221.4,-1208,x),d(150,-1356,150.5,-1310,E),d(150,-1310,150.5,-1262,19),d(150,-1262,150.5,-1214,D),d(150.5,-1356,196,-1355.5,E),d(150.5,-1214.5,196,-1214,D),d(150.5,-1310.5,196,-1310,19),d(150.5,-1262,196,-1261.5,19);let p=(e,t,n,r,i,a,o)=>c.horiz(e,t,n,r,i+.008,{style:z.BLANK,layer:a,tint:o,seed:60+Math.floor(e+t)});p(151,-1353,155,-1331,E,I.ROOF_MEMBRANE,[.15,.15,.16]),p(177,-1333,195,-1322,E,I.ROOF_MEMBRANE,[.34,.34,.33]),p(160,-1308,186,-1298,19,I.ROOF_GRAVEL,[.3,.29,.27]),p(151,-1296,162,-1276,19,I.ROOF_MEMBRANE,[.27,.27,.26]),p(184,-1298,195,-1276,19,I.ROOF_GRAVEL,[.22,.215,.2]),p(151,-1260,196,-1256,D,I.ROOF_MEMBRANE,[.22,.22,.22]),p(185,-1236,195.5,-1216,D,I.ROOF_GRAVEL,[.28,.27,.25]),p(196.6,-1296,201.5,-1276,S,I.ROOF_MEMBRANE,[.17,.17,.18]),p(216.5,-1300,221,-1286,x,I.ROOF_MEMBRANE,[.28,.27,.26]),p(197,-1332,201.5,-1320,x,I.ROOF_GRAVEL,[.3,.29,.27]),p(215.5,-1272,221,-1250,x,I.ROOF_MEMBRANE,[.15,.15,.155]);let m=(e,n,r,i,a,o)=>{let s={style:z.BLANK,layer:I.ROOF_MEMBRANE,tint:[.1,.1,.1],seed:90};if(o)for(let o=n+1.1;o<i-.5;o+=1.9+t()*.3)c.horiz(e,o,r,o+.12,a+.012,s);else for(let o=e+1.1;o<r-.5;o+=1.9+t()*.3)c.horiz(o,n,o+.12,i,a+.012,s)};m(151,-1355,196,-1311,E,!1),m(151,-1261,196,-1215,D,!1),m(197,-1361,221,-1209,x,!0);let h={style:z.BLANK,layer:I.METAL,tint:[1.6,1.6,1.6],seed:91};for(let[e,n,i,a,o]of[[151,-1355,196,-1311,E],[151,-1309,196,-1262,19],[151,-1261,196,-1215,D],[197,-1361,221,-1209,x]]){for(let r=0;r<10;r++){let r=e+1+t()*(i-e-2),s=n+1+t()*(a-n-2);if(t()<.5)c.horiz(r-.3,s-.3,r+.3,s+.3,o+.014,{style:z.BLANK,layer:I.ROOF_MEMBRANE,tint:[.05,.05,.05],seed:92});else{let e=.1+t()*.12,n=.6+t()*.9;c.cyl(r,s,e,o,o+n,8,h,z.BLANK,!0),l?.cyl(r,s,o,o+n,e*.95,e*.95,`equipment`)}}for(let r=0;r<7;r++){let r=e+3+t()*(i-e-6),s=n+3+t()*(a-n-6),l=1.2+t()*3.2,u=.06+t()*.07;for(let d=0;d<6;d++){let f=(t()-.5)*l*1.4,p=(t()-.5)*l*1.4,m=l*(.25+t()*.45),h=l*(.25+t()*.45);c.horiz(Math.max(e,r+f-m),Math.max(n,s+p-h),Math.min(i,r+f+m),Math.min(a,s+p+h),o+.016+d*.0015,{style:z.BLANK,layer:I.ROOF_MEMBRANE,tint:[u*(1+d*.12),u*(1+d*.12),u*(1.02+d*.12)],seed:93+d})}}for(let r=0;r<4;r++){let r=e+2+t()*(i-e-8),s=n+2+t()*(a-n-8),l=.38+t()*.12;c.horiz(r,s,r+2+t()*4,s+1.5+t()*3,o+.011,{style:z.BLANK,layer:I.ROOF_MEMBRANE,tint:[l,l,l*.97],seed:97})}for(let s=0;s<2;s++){let c=s===0,u=8+t()*14,d=c?e+2+t()*Math.max(1,i-e-4-u):t()<.5?e+.75:i-.75,p=c?t()<.5?n+.75:a-.75:n+2+t()*Math.max(1,a-n-4-u),m=c?Math.min(i-1,d+u):d,h=c?p:Math.min(a-1,p+u),g=.09;T.tube([d,o+.35,p],[m,o+.35,h],g,8),l?.box(Math.min(d,m)-g,o+.26,Math.min(p,h)-g,Math.max(d,m)+g,o+.44,Math.max(p,h)+g,`equipment`);let _=Math.max(2,Math.floor(u/2.5));for(let e=0;e<=_;e++){let t=e/_,n=d+(m-d)*t,i=p+(h-p)*t;f(n-.18,o,i-.18,n+.18,o+.26,i+.18,r,{all:b},!0,r,`equipment`)}}}}let P=T.build();if(P){let e=new h(P,new C({vertexColors:!0,roughness:.5,metalness:.5}));e.castShadow=!0,e.receiveShadow=!0,e.name=`park-met-steel`,t.add(e)}i&&(i.edge(223.2,-1362,223.2,-1208,20.7,1,0),i.edge(196,-1362,222,-1362,x,0,-1),i.edge(196,-1208,222,-1208,x,0,1),i.edge(150,-1356,150,-1310,E,-1,0),i.edge(150,-1310,150,-1262,19,-1,0),i.edge(150,-1262,150,-1214,D,-1,0)),p.met=be.met}if(o){let e=V(4242),t=B,n=[];for(let e of s)for(let t=1;t<e.pts.length;t++)n.push([e.pts[t-1],e.pts[t],e.w/2+2]);let r=(e,t,r)=>n.some(([n,i,a])=>{let o=a+r;if(Math.min(n[0],i[0])-o>e||Math.max(n[0],i[0])+o<e||Math.min(n[1],i[1])-o>t||Math.max(n[1],i[1])+o<t)return!1;let s=i[0]-n[0],c=i[1]-n[1],l=Math.max(0,Math.min(1,((e-n[0])*s+(t-n[1])*c)/(s*s+c*c||1)));return Math.hypot(e-n[0]-s*l,t-n[1]-c*l)<o}),i=be.met,a=[],c=0;for(let n=0;n<12e3&&c<125;n++){let n=t.x0+15+e()*(t.x1-t.x0-30),s=t.z0+15+e()*(t.z1-t.z0-30),l=o(n,s);if(l<.95||l>2.4)continue;let u=6+e()*9;if(n>i.x0-u-4&&n<i.x1+u&&s>i.z0-u-4&&s<i.z1+u+4||a.some(e=>Math.hypot(e[0]-n,e[1]-s)<32))continue;let d=!1;for(let e=0;e<8&&!d;e++)d=!!U(n+Math.cos(e)*(u+3),s+Math.sin(e)*(u+3));if(d||U(n,s)||r(n,s,u))continue;a.push([n,s]),xe.push([n,s,u]),c++;let p=e()*Math.PI*2,m=Math.cos(p),h=Math.sin(p),g=.44+e()*.1,_=5+Math.floor(e()*4),v=Q-.25;for(let t=0;t<_;t++){let r=t/_,i=n+m*u*r*.45+(e()-.5)*1.5,a=s+h*u*r*.45+(e()-.5)*1.5,o=u*(.72-r*.55)*(.75+e()*.4),l=u*(.52-r*.38)*(.75+e()*.4),d=.22+e()*.26+(t===0?.15:0),p=v+d+.013*t;for(let n=0;n<3;n++){let r=(e()-.5)*o*.7,s=(e()-.5)*l*.7,u=o*(.45+e()*.4),d=l*(.45+e()*.4),m=g*(.8+e()*.32),h=e()<.3?[.96,1,.9]:e()<.5?[1.04,.98,.92]:[.97,.97,.97],_={style:z.BLANK,layer:I.LIME,tint:[m*.9*h[0],m*.88*h[1],m*.84*h[2]],seed:30+c};f(i+r-u,t===0?Q-.3:v-.1,a+s-d,i+r+u,p-e()*.12+.004*n,a+s+d,_,{},!0,null,`park`)}let y={style:z.BLANK,layer:I.LIME,tint:[g*.8,g*.78,g*.74],seed:30+c};if(v=p-.12,e()<.5){let n=i+(e()-.5)*o*3,r=a+(e()-.5)*l*3,s=.5+e()*.8;U(n,r)||f(n-s,Q-.2,r-s*.8,n+s,Q+s*.9+.017*t,r+s*.8,y,{},!0,null,`park`)}}}p.rocks=a}if(u.length||d.length){let e=[],n=[],r=[],i=[],o=[],s=0,c=()=>{let e=Math.sin(++s*91.345+3.1)*43758.5453;return e-Math.floor(e)};for(let t of d){let a=e.length/3,[s,l]=t,u=t.v??c();for(let e=0;e<t.length;e++)o.push(u);let d=[l[0]-s[0],l[1]-s[1],l[2]-s[2]],f=Math.hypot(...d),p=d.map(e=>e/f),m=t[2],h=[m[0]-s[0],m[1]-s[1],m[2]-s[2]],g=[p[1]*h[2]-p[2]*h[1],p[2]*h[0]-p[0]*h[2],p[0]*h[1]-p[1]*h[0]],_=Math.hypot(...g);g=g.map(e=>e/_);let v=g[1]<0;v&&(g=g.map(e=>-e));let y=[g[1]*p[2]-g[2]*p[1],g[2]*p[0]-g[0]*p[2],g[0]*p[1]-g[1]*p[0]];for(let i of t){let t=[i[0]-s[0],i[1]-s[1],i[2]-s[2]];e.push(...i),n.push(...g),r.push(t[0]*p[0]+t[1]*p[1]+t[2]*p[2],Math.abs(t[0]*y[0]+t[1]*y[1]+t[2]*y[2]))}let b=(e,t,n)=>v?i.push(a+e,a+n,a+t):i.push(a+e,a+t,a+n);b(0,1,2),t.length===4&&b(0,2,3)}for(let[t,a,s,l,d]of u){let u=e.length/3,f=c();o.push(f,f,f,f),e.push(t,d,l,s,d,l,s,d,a,t,d,a),n.push(0,1,0,0,1,0,0,1,0,0,1,0);let p=s-t>l-a;for(let[e,n]of[[t,l],[s,l],[s,a],[t,a]])r.push(p?e:n,p?n:e);i.push(u,u+1,u+2,u,u+2,u+3)}let l=new b;l.setAttribute(`position`,new a(e,3)),l.setAttribute(`normal`,new a(n,3)),l.setAttribute(`uv`,new a(r,2)),l.setAttribute(`aGV`,new a(o,1)),l.setIndex(i);let f=new h(l,Et());f.receiveShadow=!0,f.name=`park-skylights`,t.add(f)}if(m.length){let n=[];for(let[t,r,i]of m)n.push(new g(.06,.55,2.8,12,1,!0).translate(t,r+1.4,i)),n.push(new e(2.2,24).rotateX(-Math.PI/2).translate(t,r-.6+.01,i));let r=new C({color:15133936,roughness:.35,transparent:!0,opacity:.5,depthWrite:!1,side:2}),i=new h(oe(n.map(e=>e.toNonIndexed())),r);i.name=`park-met-fountains`,t.add(i)}kt(t,l,f),It(f),Vt(t,l,s),Dt(t,l),Ft(t),Ot(t,c,l),At(f),Mt(t),Nt(t,l),o&&(p.people=Pt(t,s));let _=c.build();if(_){let e=new h(_,n);e.castShadow=!0,e.receiveShadow=!0,e.name=`park-setpieces`,t.add(e),p.mesh=e}return p}function Et(){let e=new C({color:9413296,roughness:.1,metalness:.2});return e.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,Z.vertexCommon).replace(`#include <uv_vertex>`,Z.vertexUvVertex),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,Z.fragmentCommon).replace(`#include <map_fragment>`,Z.fragmentMap).replace(`#include <roughnessmap_fragment>`,Z.fragmentRoughness).replace(`#include <emissivemap_fragment>`,Z.fragmentEmissive)},e.customProgramCacheKey=()=>`park-glassroof-v4`,e}function Dt(e,t){let n=ne.find(e=>e.name===`reservoir`);if(!n)return;let r=n.pts.length,i=n.pts.map(([e,t],i)=>{let[a,o]=n.pts[(i+r-1)%r],[s,c]=n.pts[(i+1)%r],l=s-a,u=c-o,d=Math.hypot(l,u)||1;l/=d,u/=d;let f=u,p=-l;return f*(e-n.cx)+p*(t-n.cz)<0&&(f=-f,p=-p),[f,p]}),o=(e,t)=>[n.pts[e][0]+i[e][0]*t,n.pts[e][1]+i[e][1]*t];{let t=[],i=[],s=[],c=[],l=Q+.008,u=0;for(let e=0;e<=r;e++){let a=e%r,d=o(a,0),f=o(a,1.1);if(e&&(u+=Math.hypot(n.pts[a][0]-n.pts[e-1][0],n.pts[a][1]-n.pts[e-1][1])),t.push(d[0],l,d[1],f[0],l,f[1]),i.push(0,1,0,0,1,0),s.push(0,u,1,u),e){let t=e*2;c.push(t-2,t-1,t+1,t-2,t+1,t)}}let d=new b;d.setAttribute(`position`,new a(t,3)),d.setAttribute(`normal`,new a(i,3)),d.setAttribute(`uv`,new a(s,2)),d.setIndex(c);let f=d.index.array,p=d.attributes.position.array;for(let e=0;e<f.length;e+=3){let t=f[e]*3,n=f[e+1]*3,r=f[e+2]*3;if((p[n+2]-p[t+2])*(p[r]-p[t])-(p[n]-p[t])*(p[r+2]-p[t+2])<0){let t=f[e+1];f[e+1]=f[e+2],f[e+2]=t}}let m=new C({color:6907487,roughness:.9,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-2});m.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <map_fragment>`,Z.fragmentMapByCopingUv).replace(`#include <common>`,Z.fragmentCommonByCopingUv),e.vertexShader=e.vertexShader.replace(`#include <common>`,Z.vertexCommonByCopingUv).replace(`#include <uv_vertex>`,Z.vertexUvVertexByCopingUv)},m.customProgramCacheKey=()=>`park-coping-v1`;let g=new h(d,m);g.receiveShadow=!0,g.name=`reservoir-coping`,e.add(g)}{let n=[];for(let e=0;e<r;e++)n.push(o(e,3.6));let i=[],s=0;for(let e=0;e<r;e++){let t=n[e],a=n[(e+1)%r],o=Math.hypot(a[0]-t[0],a[1]-t[1]);for(;s<o;s+=2.6)i.push([t[0]+(a[0]-t[0])*s/o,t[1]+(a[1]-t[1])*s/o]);s-=o}let c=[],l=[],u=(e,t,n,r,i)=>{let a=c.length/3;c.push(e[0],n,e[1],t[0],n,t[1],t[0],r,t[1],e[0],r,e[1]),l.push(a,a+1,a+2,a,a+2,a+3)},d=1.9;for(let e=0;e<i.length;e++){let[n,r]=i[e],a=.045,o=[[n-a,r-a],[n+a,r-a],[n+a,r+a],[n-a,r+a]];for(let e=0;e<4;e++)u(o[e],o[(e+1)%4],Q,Q+d+.08,0);t?.cyl(n,r,Q,Q+d+.08,a,a,`equipment`);let[s,c]=i[(e+1)%i.length];for(let[e,t]of[[Q+.05,Q+.11],[Q+.95,Q+1],[Q+d-.06,Q+d]])u([n,r],[s,c],e,t,0);for(let e=1;e<6;e++){let t=e/6,i=n+(s-n)*t,a=r+(c-r)*t;u([i-.012,a],[i+.012,a],Q+.08,Q+d-.03,0),u([i,a-.012],[i,a+.012],Q+.08,Q+d-.03,0)}}let f=new b;f.setAttribute(`position`,new a(c,3)),f.setIndex(l),f.computeVertexNormals();let p=new C({color:1776924,roughness:.6,metalness:.4,side:2}),m=new h(f,p);m.castShadow=!0,m.receiveShadow=!0,m.name=`reservoir-fence`,e.add(m)}}function Ot(e,t,n){let r=B,i=.45,a=te,o=.1,s={style:z.BLANK,layer:I.GRANITE,tint:[.5,.48,.45],seed:41},c={style:z.BLANK,layer:I.LIME,tint:[.84,.82,.77],seed:42},l=(e,r,i,l,u)=>{let d=a+1+u,f=d+.12;t.box(e-o,a,r-o,i+o,d,l+o,s,{},!1),t.box(e-o-.06,d,r-o-.06,i+o+.06,f,l+o+.06,c,{},!0,!0),n?.box(e-o,a,r-o,i+o,d,l+o,`park`),n?.box(e-o-.06,d,r-o-.06,i+o+.06,f,l+o+.06,`park`)},u=[-150,-60,60,150];for(let[e,t]of[[r.z1-i,r.z1],[r.z0,r.z0+i]]){let n=r.x0;for(let i of[...u,r.x1+100]){let a=Math.min(i-3,r.x1);a>n&&l(n,e,a,t,0),n=i+3}}let d=[];for(let e of[r.x0,r.x1-i])for(let t=r.z1-i;t>r.z0+i+1;t-=160){let n=Math.max(r.z0+i,t-150);l(e,n,e+i,t,.014),d.push([e,n,t])}let f=new H,p=V(911);for(let[e,t,s]of d){let c=e===r.x0,l=c?e-o:e+i+o,u=c?-1:1;for(let e=t+6;e+2<s-4;e+=6.5+p()*3){if(p()<.3)continue;let t=e,r=e+1.9,i=e=>l+u*e,o=(e,t)=>[Math.min(i(e),i(t)),Math.max(i(e),i(t))],s=a;f.setColor([.02,.022,.02]);for(let e of[t,r-.06]){let[t,r]=o(.08,.66);f.box(t,s,e,r,s+.47,e+.06),n?.box(t,s,e,r,s+.47,e+.06,`equipment`);let[i,a]=o(.05,.14);f.box(i,s+.47,e,a,s+.92,e+.06),n?.box(i,s+.47,e,a,s+.92,e+.06,`equipment`)}f.setColor([.05,.075,.045]);for(let e=0;e<4;e++){let[n,i]=o(.16+e*.125,.26+e*.125);f.box(n,s+.42,t+.06,i,s+.46,r-.06)}{let[e,i]=o(.14,.66);n?.box(e,s+.42,t+.06,i,s+.46,r-.06,`equipment`)}for(let e=0;e<3;e++){let[n,i]=o(.08,.12);f.box(n,s+.55+e*.13,t+.06,i,s+.64+e*.13,r-.06)}{let[e,i]=o(.08,.12);n?.box(e,s+.55,t+.06,i,s+.9,r-.06,`equipment`)}}}let m=f.build();if(m){let t=new h(m,new C({vertexColors:!0,roughness:.7}));t.castShadow=!0,t.receiveShadow=!0,t.name=`park-wall-benches`,e.add(t)}}function kt(e,t,n=null){let r=[],i=[],o=[],s=new H;s.setColor([.05,.05,.05]);let c=Q,l=(e,n,a)=>{let l=Math.hypot(n[0]-e[0],n[1]-e[1]);if(l<.1)return;let u=r.length/3;r.push(e[0],c,e[1],n[0],c,n[1],n[0],c+a,n[1],e[0],c+a,e[1]),i.push(0,0,l,0,l,a,0,a),o.push(u,u+1,u+2,u,u+2,u+3),s.tube([e[0],c+a-.02,e[1]],[n[0],c+a-.02,n[1]],.02,4);let d=Math.max(1,Math.round(l/.25));for(let r=0;r<=d;r++){let i=r/d;t?.cyl(e[0]+(n[0]-e[0])*i,e[1]+(n[1]-e[1])*i,c,c+a,.02,.02,`pole`)}},u=(e,n,r)=>{s.cyl(e,c,n,.045,.045,r+.08,6,!0,!1),t?.cyl(e,n,c,c+r+.08,.045,.045,`pole`)};for(let e=1;e<3;e++)for(let t=0;t<4;t++){if(e===2&&(t===1||t===2))continue;let r=Se[e],i=e*4+t,a=[r.x+((t&1)*2-1)*r.rx*(.55+.08*Math.sin(i*2.3)),r.z+((t>>1)*2-1)*r.rz*(.5+.08*Math.cos(i*1.7))],o=r.x-a[0],s=r.z-a[1],c=Math.hypot(o,s);o/=c,s/=c;let d=.35*Math.sin(i*3.1+.4),f=Math.cos(d),p=Math.sin(d);[o,s]=[o*f-s*p,o*p+s*f];let m=Math.atan2(s,o)+Math.PI,h=[];for(let e=0;e<=8;e++){let t=m+(e/8-.5)*2.3;h.push([a[0]+Math.cos(t)*7,a[1]+Math.sin(t)*7])}for(let e=0;e<8;e++)l(h[e],h[e+1],5);for(let e of h)u(e[0],e[1],5);if(n){let e=m+(i&1?1:-1)*1.55,t=a[0]+Math.cos(e)*10.5,r=a[1]+Math.sin(e)*10.5,o=Math.abs(Math.cos(e))<Math.abs(Math.sin(e)),s=o?0:Math.sign(Math.cos(e)),c=o?Math.sign(Math.sin(e)):0,l={style:z.BLANK,layer:I.METAL,tint:[1.55,1.57,1.6],seed:62},u=3.6;for(let e=0;e<3;e++){let i=e*.7,a=Q+.42+e*.38,d=t+s*i,f=r+c*i,[p,m]=o?[u,.36]:[.36,u];n(d-p,Q-.05,f-m,d+p,a,f+m,e?l:{...l,tint:[1.2,1.22,1.25]},{},!0,null,`park`)}}for(let e of[-1,1]){let t=Math.atan2(s,o)+e*Math.PI/4,r=Math.cos(t),c=Math.sin(t),d=-c*e,f=r*e,p=[a[0]+r*2+d*6,a[1]+c*2+f*6],m=[a[0]+r*22+d*6,a[1]+c*22+f*6],g=h[e<0?8:0];l(g,p,1.3);for(let e=0;e<4;e++)l([p[0]+(m[0]-p[0])*e/4,p[1]+(m[1]-p[1])*e/4],[p[0]+(m[0]-p[0])*(e+1)/4,p[1]+(m[1]-p[1])*(e+1)/4],1.3);for(let e=0;e<=4;e++)u(p[0]+(m[0]-p[0])*e/4,p[1]+(m[1]-p[1])*e/4,1.3);if(n){let e=a[0]+r*10+d*8.2,t=a[1]+c*10+f*8.2,o=Math.abs(r)>Math.abs(c),s=3.2,l=.9,u={style:z.BLANK,layer:I.CONCRETE,tint:[.8,.79,.76],seed:60+i},p={style:z.BLANK,layer:I.METAL,tint:[.55,.62,.58],seed:61},[m,h]=o?[s,l]:[l,s],g=o?0:(d>0?1:-1)*.75,_=o?(f>0?1:-1)*.75:0;n(e+g-(o?m:.15),Q-.05,t+_-(o?.15:h),e+g+(o?m:.15),Q+2.1,t+_+(o?.15:h),u,{},!0,null,`park`),n(e-m-.2,Q+2.1,t-h-.2,e+m+.2,Q+2.26,t+h+.2,p,{},!0,null,`park`);for(let r of[-1,1])n(o?e+r*m-.12:e-m,Q-.05,o?t-h:t+r*h-.12,o?e+r*m+.12:e+m,Q+2.1,o?t+h:t+r*h+.12,u,{},!0,null,`park`);n(e-m*(o?.9:.4),Q+.4,t-h*(o?.4:.9),e+m*(o?.9:.4),Q+.46,t+h*(o?.4:.9),{...u,tint:[.42,.3,.2]},{},!0,null,`park`)}}}let d=new b;d.setAttribute(`position`,new a(r,3)),d.setAttribute(`uv`,new a(i,2)),d.setIndex(o),d.computeVertexNormals();let f=new C({color:9080206,roughness:.5,metalness:.6,side:2,transparent:!0,depthWrite:!1});f.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,Z.vertexCommonByFountainUv).replace(`#include <uv_vertex>`,Z.vertexUvVertexByFountainUv),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,Z.fragmentCommonByFountainUv).replace(`#include <alphatest_fragment>`,Z.fragmentAlphaTest)},f.customProgramCacheKey=()=>`park-chainlink-v1`;let p=new h(d,f);p.name=`park-ballfield-fences`,p.renderOrder=3,e.add(p);let m=s.build();if(m){let t=new h(m,new C({vertexColors:!0,roughness:.6,metalness:.4}));t.castShadow=!0,t.receiveShadow=!0,t.name=`park-ballfield-posts`,e.add(t)}}function At(e){let t=V(5151);for(let n of ne){if(n.name===`reservoir`)continue;let r=n.pts.length,i=0;for(let a=0;a<r;a++){let[o,s]=n.pts[a],[c,l]=n.pts[(a+1)%r];if(i+=Math.hypot(c-o,l-s),i<5+t()*7||(i=0,t()<.35||jt(n,o,s)>.62))continue;let u=l-s,d=-(c-o),f=Math.hypot(u,d)||1;u/=f,d/=f,U(o+u*3,s+d*3)&&(u=-u,d=-d);let p=.4+t()*.14,m={style:z.BLANK,layer:I.LIME,tint:[p*.9,p*.9,p*.86],seed:70+a},h=2+Math.floor(t()*4);for(let r=0;r<h;r++){let i=-1.2+r*.9+t()*.8,a=(t()-.5)*3.5,c=o+u*i-d*a,l=s+d*i+u*a,f=.5+t()*.9,p=.25+t()*.55-r*.06;e(c-f,n.y-.4,l-f*(.6+t()*.4),c+f,Q+p,l+f*(.6+t()*.4),m,{},!0,null,`park`)}}}}function jt(e,t,n){return .5+.32*Math.sin(t*.045+n*.031+e.cx)+.22*Math.sin(t*.11-n*.093+1.7)+.12*Math.sin(n*.27+t*.05)}function Mt(e){let t=V(6262),n=[],r=[],i=[],o=[[.46,.42,.24],[.36,.37,.2],[.55,.47,.28],[.3,.33,.19],[.5,.38,.2],[.42,.44,.27]],s=(e,t,a,o,s,c,l,u)=>{let d=Math.cos(c),f=Math.sin(c),p=e+Math.cos(c+1.57)*s,m=a+Math.sin(c+1.57)*s,h=-f,g=d,_=u.map(e=>e*.55),v=u.map(e=>e*1.08);n.push(e-d*l,t,a-f*l,e+d*l,t,a+f*l,p,t+o,m),r.push(h,.35,g,h,.35,g,h,.6,g),i.push(..._,..._,...v)},c=0;for(let e of ne){if(e.name===`reservoir`)continue;let a=e.pts.length,l=0;for(let t=0;t<a;t++){let[n,r]=e.pts[t],[i,o]=e.pts[(t+1)%a];l+=n*o-i*r}let u=l>0?1:-1;for(let l=0;l<a;l++){let[d,f]=e.pts[l],[p,m]=e.pts[(l+1)%a],h=Math.hypot(p-d,m-f);if(h<.01)continue;let g=(p-d)/h,_=(m-f)/h,v=-_*u,y=g*u;for(let a=t()*.5;a<h;a+=.35+t()*.4){let l=d+g*a,u=f+_*a,p=jt(e,l,u);if(p<.4||t()>(p-.3)*2.2)continue;let m=.8+(p-.4)*7,h=-1.5+t()*(m+1.5),b=l+v*h+(t()-.5)*.6,x=u+y*h+(t()-.5)*.6,S=!!U(b,x),C=S?e.y-.05:Q-.05,w=o[Math.floor(t()*o.length)].map(e=>e*(.85+t()*.3)),T=(S?1.4:.9)+t()*.9,E=18+Math.floor(t()*14);for(let e=0;e<E;e++){let e=T*(.55+t()*.55),n=w.map(e=>e*(.85+t()*.3));s(b+(t()-.5)*1.1,C,x+(t()-.5)*1.1,e,(t()-.5)*e*.5,t()*Math.PI,.07+t()*.07,n)}if(S&&t()<.3){let e=b+(t()-.5)*.2,a=x+(t()-.5)*.2,o=C+T*1.05;for(let t of[0,1.57]){let s=Math.cos(t)*.03,c=Math.sin(t)*.03;n.push(e-s,o,a-c,e+s,o,a+c,e+s,o+.22,a+c,e-s,o,a-c,e+s,o+.22,a+c,e-s,o+.22,a-c);for(let e=0;e<6;e++)r.push(Math.sin(t),.2,-Math.cos(t)),i.push(.2,.12,.07)}}c++}}}if(!n.length)return 0;let l=new b;l.setAttribute(`position`,new a(n,3)),l.setAttribute(`normal`,new a(r,3)),l.setAttribute(`color`,new a(i,3)),l.computeBoundingSphere();let u=new C({vertexColors:!0,roughness:.85,side:2}),d=new h(l,u);return d.name=`park-reeds`,d.castShadow=!0,d.receiveShadow=!0,e.add(d),c}function Nt(e,t){let n=B,r=.1,i=te,o=V(7373),s=new H,c=new H,l=(e,n)=>{s.setColor([.03,.045,.035]),s.cyl(e,i,n,.2,.16,.55,8,!0,!1),s.cyl(e,i+.55,n,.085,.065,3.1,8,!1,!0),s.cyl(e,i+3.62,n,.13,.09,.14,8,!0,!1),s.cyl(e,i+4.3,n,.26,.05,.18,8,!0,!1),c.setColor([1,.9,.72]),c.cyl(e,i+3.76,n,.16,.24,.54,10,!0,!0),t?.cyl(e,n,i,i+4.48,.2,.2,`pole`),Lt(e,i,n)},u=[];for(let e of[n.x0-r,n.x1+r])u.push({x:e+(e<0?-1.35:1.35),a:n.z0+6,b:n.z1-6,alongX:!1});for(let e of[n.z0-r,n.z1+r])u.push({z:e+(e<-1e3?-1.35:1.35),a:n.x0+6,b:n.x1-6,alongX:!0});for(let e of u)for(let t=e.a+o()*6;t<e.b;t+=17+o()*4)e.alongX?l(t,e.z):l(e.x,t);let d=s.build();if(d){let t=new h(d,new C({vertexColors:!0,roughness:.55,metalness:.5}));t.castShadow=!0,t.receiveShadow=!0,t.name=`park-lamps`,e.add(t)}let f=c.build();if(f){let t=new h(f,Rt());t.name=`park-lamp-globes`,e.add(zt(t))}let p=1.95,m=i+.004,g=[],_=[],v=(e,t,n,r)=>{let i=g.length/3;g.push(e,m,t,e,m,r,n,m,r,n,m,t),_.push(i,i+1,i+2,i,i+2,i+3)};v(n.x0-r-p,n.z0-r-p,n.x0-r,n.z1+r+p),v(n.x1+r,n.z0-r-p,n.x1+r+p,n.z1+r+p),v(n.x0-r,n.z0-r-p,n.x1+r,n.z0-r),v(n.x0-r,n.z1+r,n.x1+r,n.z1+r+p);let y=new b;y.setAttribute(`position`,new a(g,3)),y.setAttribute(`normal`,new a(Array(g.length/3).fill([0,1,0]).flat(),3)),y.setIndex(_);let x=new C({color:5723988,roughness:.9,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4});x.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,Z.vertexCommonByHexWorldPosition).replace(`#include <begin_vertex>`,Z.vertexBeginVertex),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,Z.fragmentCommonByHexWorldPosition).replace(`#include <map_fragment>`,Z.fragmentMapByHexWorldPosition)},x.customProgramCacheKey=()=>`park-hexpaver-v1`;let S=new h(y,x);S.receiveShadow=!0,S.name=`park-hexpavers`,S.renderOrder=1,e.add(S)}function Pt(e,t){let n=V(8181),r=new H;r.setColor([.32,.33,.38]),r.box(-.17,0,-.1,-.02,.84,.1),r.box(.02,0,-.1,.17,.84,.1),r.setColor([1,1,1]),r.box(-.22,.84,-.13,.22,1.45,.13),r.box(-.27,.9,-.07,-.22,1.42,.07),r.box(.22,.9,-.07,.27,1.42,.07);let i=new H;i.setColor([1,1,1]),i.box(-.1,1.47,-.11,.1,1.7,.11),i.box(-.035,1.43,-.035,.035,1.48,.035);let a=new H;a.setColor([1,1,1]),a.box(-.9,0,-.75,.9,.025,.75,63);let o=[15262940,1842982,3886970,9054756,6056778,13218426,8028038,13658682,3104623,12103844,4864604,14729280],s=[14727322,13146232,10119756,6964786,15781296],c=[10130566,8010288,3820138,10126416,4872778,11052186,5917274],l=[],d=[],f=Q,m=(e,t,n,r,i=`lawn`)=>l.push({x:e,z:t,pose:n,ry:r,kind:i}),h=[400,150,120,60,50,50,40,60,40,50,50];Se.forEach((e,t)=>{let r=h[t]??30,i=0;for(let t=0;t<r*4&&i<r;t++){let t=n()*2-1,r=n()*2-1;if(t*t+r*r>.72)continue;let a=Math.cos(e.a),o=Math.sin(e.a),s=t*e.rx,l=r*e.rz,u=e.x+s*a+l*o,f=e.z-s*o+l*a;if(U(u,f))continue;let p=1+Math.floor(n()*n()*5),h=n()*Math.PI*2;n()<.7&&d.push({x:u,z:f,ry:h,c:c[Math.floor(n()*c.length)]});for(let e=0;e<p;e++){let t=h+e*2.1+n()*.6,r=p>1?.7+n()*.4:0,i=n();m(u+Math.cos(t)*r,f+Math.sin(t)*r,i<.45?1:i<.8?2:0,t+Math.PI+(n()-.5))}i+=p}});let g=[],_=0;for(let e of t)for(let t=1;t<e.pts.length;t++){let n=Math.hypot(e.pts[t][0]-e.pts[t-1][0],e.pts[t][1]-e.pts[t-1][1]);g.push([e.pts[t-1],e.pts[t],e.w,!!e.drive,n]),_+=n}let v=Math.min(1400,Math.floor(_/14));for(let e=0;e<v&&g.length;e++){let e=n()*_,t=g[0];for(let n of g)if(e-=n[4],e<=0){t=n;break}let[r,i,a,o]=t,s=n(),c=i[0]-r[0],l=i[1]-r[1],u=Math.hypot(c,l)||1,d=o?(n()<.5?-1:1)*(a/2-.8):(n()-.5)*Math.max(0,a-1),f=r[0]+c*s-l/u*d,p=r[1]+l*s+c/u*d;if(U(f,p))continue;let h=Math.atan2(c,l)+(n()<.5?0:Math.PI);m(f,p,0,h,`path`),n()<.3&&m(f-Math.cos(h)*.6,p+Math.sin(h)*.6,0,h,`path`)}{let e=B,t=(e,t,r,i,a)=>{for(let o=e+n()*6;o<t;o+=3+n()*9){let e=r+a*(.6+n()*3.6),t=(i?Math.PI/2:0)+(n()<.5?0:Math.PI)+(n()-.5)*.3,s=n()<.62?1:n()<.8?2:3;for(let r=0;r<s;r++){let a=r*.65,c=r?(n()-.5)*.8:0,u=i?o+a:e+c,d=i?e+c:o+a;l.push({x:u,z:d,pose:0,ry:t+(r===2?Math.PI:0),y:te,kind:`edge`,g:s,j:r,alongX:i})}}};t(e.z0+5,e.z1-5,e.x0-.2,!1,-1),t(e.z0+5,e.z1-5,e.x1+.2,!1,1),t(e.x0+5,e.x1-5,e.z0-.2,!0,-1),t(e.x0+5,e.x1-5,e.z1+.2,!0,1)}let b=(t,n,r,i,a)=>{let o=new C({vertexColors:!0,roughness:.85}),s=new D(t,o,n.length),c=new y,l=new p,d=new S,f=new E,m=new E,h=new u;n.forEach((e,t)=>{a(e,d,f,m),l.setFromEuler(d),c.compose(f,l,m),s.setMatrixAt(t,c),h.setHex(i(e)),h.convertSRGBToLinear?.(),s.setColorAt(t,h)}),s.instanceMatrix.needsUpdate=!0,s.instanceColor&&(s.instanceColor.needsUpdate=!0),s.computeBoundingSphere(),s.castShadow=!0,s.receiveShadow=!0,s.name=r,e.add(s)};l.forEach(e=>{e.sh=o[Math.floor(n()*o.length)],e.sk=s[Math.floor(n()*s.length)]}),St.length=0;for(let e of l)e.kind!==`path`&&St.push({x:e.x,z:e.z,ry:e.ry,pose:e.pose,kind:e.kind,g:e.g,alongX:e.alongX,y:e.y??f});return d.length&&b(a.build(),d,`park-blankets`,e=>e.c,(e,t,n,r)=>{t.set(0,e.ry,0),n.set(e.x,f+.005,e.z),r.set(1,1,1)}),l.length}function Ft(e){let t=[],r=[],i=[];for(let e of ne){let n=e.pts.length,a=0;for(let t=0;t<n;t++){let[r,i]=e.pts[t],[o,s]=e.pts[(t+1)%n];a+=r*s-o*i}let o=a>0?1:-1,s=e.y+.012,c=0,l=t.length/3;for(let a=0;a<=n;a++){let l=a%n,[u,d]=e.pts[l],[f,p]=e.pts[(l+n-1)%n],[m,h]=e.pts[(l+1)%n],g=m-f,_=h-p,v=Math.hypot(g,_)||1;g/=v,_/=v,-_*o,g*o,a&&(c+=Math.hypot(u-e.pts[a-1][0],d-e.pts[a-1][1]));let y=Math.hypot(e.cx-u,e.cz-d)||1,b=Math.min(y*.5,(e.name===`reservoir`?12:11)+12*(.5+.5*Math.sin(c*.037+e.cx*.01)*Math.cos(c*.091+1.3)));if(t.push(u,s,d,u+(e.cx-u)/y*b,s,d+(e.cz-d)/y*b),r.push(0,1),a){let e=t.length/3-4;i.push(e,e+1,e+3,e,e+3,e+2)}}let u=t.length/3;t.push(e.cx,s,e.cz),r.push(1);for(let e=0;e<n;e++)i.push(l+e*2+1,l+(e+1)*2+1,u)}let o=new b;o.setAttribute(`position`,new a(t,3)),o.setAttribute(`aT`,new a(r,1)),o.setIndex(i);let s=new O({glslVersion:n,transparent:!0,depthWrite:!1,side:2,fog:!0,uniforms:T.merge([j.fog,{uTime:{value:0}}]),vertexShader:yt,fragmentShader:bt});s.userData.tick=e=>{s.uniforms.uTime.value+=e};let c=new h(o,s);c.name=`park-water-shallows`,c.renderOrder=2,e.add(c)}function It(e){let t=ne.find(e=>e.name===`reservoir`);if(!t)return;let n=V(7171),r=t.pts.length,i=0;for(let e=0;e<r;e++){let[n,a]=t.pts[e],[o,s]=t.pts[(e+1)%r];i+=n*s-o*a}let a=i>0?1:-1;for(let i=0;i<r;i++){let[o,s]=t.pts[i],[c,l]=t.pts[(i+1)%r],u=Math.hypot(c-o,l-s);if(u<.01)continue;let d=(c-o)/u,f=(l-s)/u,p=-f*a,m=d*a;for(let r=n()*1.2;r<u;r+=1+n()*1.1){if(Math.sin((o+d*r)*.05)*Math.cos((s+f*r)*.043)+.4*Math.sin((o+s)*.13+r)<-.55&&n()<.8)continue;let a=1+Math.floor(n()*2);for(let c=0;c<a;c++){let a=.2+n()*1.6,c=(n()-.5)*.8,l=o+d*(r+c)+p*a,u=s+f*(r+c)+m*a,h=.35+n()*.45,g=t.y+.1+n()*.5-a*.08,_=.36+n()*.16;e(l-h,t.y-.5,u-h*(.6+n()*.4),l+h,Math.min(g,Q-.08),u+h*(.6+n()*.4),{style:z.BLANK,layer:I.LIME,tint:[_*.92,_*.92,_*.9],seed:80+(i&7)},{},!0,null,`park`)}}}}function Lt(e,t,n){M.add({type:`point`,pos:[e,t+4.03,n],color:16766624,intensity:20,range:14,radius:.35,volume:.35})}function Rt(){return new C({vertexColors:!0,roughness:.2,emissive:16769712,emissiveIntensity:.35,transparent:!0,opacity:.9})}var zt=e=>(e.onBeforeRender=()=>{e.material.emissiveIntensity=.35+1.6*F.value},e);function Bt(e,t,n,r,i,a){Lt(r,i,a),e.setColor([.03,.045,.035]),e.cyl(r,i,a,.2,.16,.55,8,!0,!1),e.cyl(r,i+.55,a,.085,.065,3.1,8,!1,!0),e.cyl(r,i+3.62,a,.13,.09,.14,8,!0,!1),e.cyl(r,i+4.3,a,.26,.05,.18,8,!0,!1),t.setColor([1,.9,.72]),t.cyl(r,i+3.76,a,.16,.24,.54,10,!0,!0),n?.cyl(r,a,i,i+4.48,.2,.2,`pole`)}function Vt(e,t,n){let r=V(9393),i=new H,o=new H,s=Q,c=(e,t)=>U(e,t)||U(e+1.5,t)||U(e-1.5,t)||U(e,t+1.5)||U(e,t-1.5),l=(e,t)=>xe.some(([n,r,i])=>(n-e)**2+(r-t)**2<(i+1.5)**2),u=be.met,d=(e,t)=>e>u.x0-3&&e<u.x1+8&&t>u.z0-3&&t<u.z1+3,f=0,p=0,m=(e,n,r,a)=>{let o=1.9,c=r?o/2:.33,l=r?.33:o/2;i.setColor([.02,.022,.02]);for(let a of[-1,1]){let u=r?e+a*(o/2-.05):e,d=r?n:n+a*(o/2-.05),f=r?[u-.03,d-l]:[u-c,d-.03],p=r?[u+.03,d+l]:[u+c,d+.03];i.box(f[0],s,f[1],p[0],s+.45,p[1]),t?.box(f[0],s,f[1],p[0],s+.45,p[1],`equipment`)}i.setColor([.05,.075,.045]),i.box(e-c,s+.42,n-l,e+c,s+.47,n+l),t?.box(e-c,s+.42,n-l,e+c,s+.47,n+l,`equipment`);let u=r?[e-c,e+c]:a>0?[e+c-.06,e+c]:[e-c,e-c+.06],d=r?a>0?[n+l-.06,n+l]:[n-l,n-l+.06]:[n-l,n+l];i.box(u[0],s+.47,d[0],u[1],s+.92,d[1]),t?.box(u[0],s+.47,d[0],u[1],s+.92,d[1],`equipment`),p++},g=[],_=[];for(let e of n){let n=e.pts;if(e.drive){let t=e.w/2-.3,r=xt+.004;for(let e=0;e<n.length;e++){let i=n[Math.max(0,e-1)],a=n[Math.min(n.length-1,e+1)],o=a[0]-i[0],s=a[1]-i[1],c=Math.hypot(o,s)||1;o/=c,s/=c;let l=g.length/3;g.push(n[e][0]-s*t,r,n[e][1]+o*t,n[e][0]+s*t,r,n[e][1]-o*t),e&&_.push(l-2,l-1,l+1,l-2,l+1,l)}}let a=r()*20,u=r()*30;for(let p=1;p<n.length;p++){let[h,g]=n[p-1],[_,v]=n[p],y=Math.hypot(_-h,v-g);if(y<.01)continue;let b=(_-h)/y,x=(v-g)/y;for(let n=0;n<y;n+=2){a+=Math.min(2,y-n),u+=Math.min(2,y-n);let p=h+b*n,_=g+x*n;if(a>(e.drive?46:e.minor?70:32)+r()*8){let n=r()<.5?-1:1,u=e.w/2+.75,m=p-x*u*n,h=_+b*u*n;c(m,h)||l(m,h)||d(m,h)||(Bt(i,o,t,m,s,h),f++,a=0)}if(!e.drive&&u>40+r()*20){let t=Math.abs(b)>.97,n=Math.abs(x)>.97;if(t||n){let i=r()<.5?-1:1,a=e.w/2+.55,o=p-x*a*i,s=_+b*a*i,f=Math.sign(t?b*i:-x*i);if(!c(o,s)&&!l(o,s)&&!d(o,s)){m(o,s,t,f);let e=o+(t?2.6:0),i=s+(n?2.6:0);r()<.6&&!c(e,i)&&m(e,i,t,f),u=0}}}}}}let v=ne.find(e=>e.name===`reservoir`);if(v){let e=v.pts.length,n=0;for(let r=0;r<e;r++){let[a,l]=v.pts[r],[u,d]=v.pts[(r+1)%e];if(n+=Math.hypot(u-a,d-l),n<30)continue;n=0;let p=a-v.cx,m=l-v.cz,h=Math.hypot(p,m)||1;p/=h,m/=h;let g=a+p*12.5,_=l+m*12.5;c(g,_)||(Bt(i,o,t,g,s,_),f++)}}let y=i.build();if(y){let t=new h(y,new C({vertexColors:!0,roughness:.6,metalness:.4}));t.castShadow=!0,t.receiveShadow=!0,t.name=`park-path-furniture`,e.add(t)}let x=o.build();if(x){let t=new h(x,Rt());t.name=`park-path-globes`,e.add(zt(t))}if(g.length){let t=new b;t.setAttribute(`position`,new a(g,3)),t.setAttribute(`normal`,new a(Array(g.length/3).fill([0,1,0]).flat(),3)),t.setIndex(_);let n=t.index.array,r=t.attributes.position.array;for(let e=0;e<n.length;e+=3){let t=n[e]*3,i=n[e+1]*3,a=n[e+2]*3;if((r[i+2]-r[t+2])*(r[a]-r[t])-(r[i]-r[t])*(r[a+2]-r[t+2])<0){let t=n[e+1];n[e+1]=n[e+2],n[e+2]=t}}let i=new C({color:5065544,roughness:.92,transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4});i.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,Z.vertexCommonByWalkwayWorldPosition).replace(`#include <begin_vertex>`,Z.vertexBeginVertexByWalkwayWorldPosition),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,Z.fragmentCommonByWalkwayWorldPosition).replace(`#include <map_fragment>`,Z.fragmentMapByWalkwayWorldPosition)},i.customProgramCacheKey=()=>`park-drive-v1`;let o=new h(t,i);o.receiveShadow=!0,o.renderOrder=1,o.name=`park-drives`,e.add(o)}return{lamps:f,benches:p}}var Ht=`// highway shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in vec2 aHw;\r
out vec2 vHw;\r
out vec3 vHwP;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vHw = aHw;\r
vHwP = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
// @section fragmentCommon\r
#include <common>\r
uniform sampler2D tCol;\r
uniform sampler2D tNoise;\r
uniform sampler2D tMacro;\r
in vec2 vHw;\r
in vec3 vHwP;\r
float hwR = 0.85;\r
float band(float u, float c, float hw, float aa) {\r
return 1.0 - smoothstep(hw - aa, hw + aa, abs(u - c));\r
}\r
void highway(out vec3 highwayColor) {\r
float u = vHw.x, v = vHw.y;\r
float lineAA = max(fwidth(u), 1e-3);\r
vec2 p = vHwP.xz;\r
vec3 c = texture(tCol, p / 6.0).rgb * 0.92;\r
vec3 m = texture(tMacro, p / 70.0).rgb;\r
vec3 nz = texture(tNoise, p / 53.0).rgb;\r
c *= (0.84 + 0.3 * m.r) * (0.93 + 0.14 * nz.r);\r
float dist = length(vHwP - cameraPosition);\r
// tyre tracks per lane (darker), slightly lighter lane centres\r
float l = mod(u - __SHADER_INJECT_0__, __SHADER_INJECT_1__) - __SHADER_INJECT_2__;\r
c *= 1.0 - 0.12 * exp(- pow((abs(l) - 0.85) / 0.3, 2.0));\r
c *= mix(1.0, 0.7, smoothstep(90.0, 700.0, dist)); // aerial LOD tone like the street asphalt\r
hwR = 0.85;\r
float W = __SHADER_INJECT_3__, SH = __SHADER_INJECT_4__, LN = __SHADER_INJECT_5__, MD = __SHADER_INJECT_6__;\r
float m0 = SH + 3.0 * LN, m1 = m0 + MD;\r
// planted median: kerbed strip with grass / soil\r
if(u > m0 + 0.25 && u < m1 - 0.25) {\r
vec3 g = mix(vec3(0.16, 0.18, 0.1), vec3(0.2, 0.18, 0.13), texture(tNoise, p / 7.0).g);\r
hwR = 0.95;\r
highwayColor = g * (0.85 + 0.3 * nz.b);\r
return;\r
}\r
if(u > m0 && u < m1) {\r
hwR = 0.8;\r
highwayColor = vec3(0.46, 0.45, 0.42) * (0.9 + 0.2 * nz.g);\r
return;\r
} // kerb\r
float wear = 0.75 + 0.25 * smoothstep(0.3, 0.7, texture(tNoise, p / 3.1).r);\r
float paint = 0.0;\r
vec3 pc = vec3(0.86, 0.86, 0.83);\r
// solid white edge lines\r
paint += band(u, SH - 0.1, 0.075, lineAA) + band(u, W - SH + 0.1, 0.075, lineAA);\r
// dashed lane lines (3 m dash, 9 m gap)\r
float dash = step(mod(v, 12.0), 3.0);\r
for(int j = 1;\r
j < 3;\r
j ++) {\r
paint += dash * (band(u, SH + float(j) * LN, 0.06, lineAA) + band(u, m1 + float(j) * LN, 0.06, lineAA));\r
}\r
paint = clamp(paint, 0.0, 1.0);\r
// double yellow along the median kerbs\r
float yl = band(u, m0 - 0.2, 0.055, lineAA) + band(u, m1 + 0.2, 0.055, lineAA);\r
c = mix(c, pc * 0.85, paint * wear * 0.85);\r
c = mix(c, vec3(0.72, 0.55, 0.16) * 0.85, clamp(yl, 0.0, 1.0) * wear * 0.85);\r
hwR = mix(0.9, 0.6, paint);\r
// gutters\r
c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.6, u)) - 0.2 * (1.0 - smoothstep(0.0, 0.6, W - u));\r
highwayColor = c;\r
}\r
// @section fragmentMap\r
vec3 highwayColor;\r
highway(highwayColor);\r
diffuseColor.rgb = highwayColor;\r
// @section fragmentRoughness\r
float roughnessFactor = hwR;\r
`,Ut=`// vehicles shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section fragmentCommon\r
#include <common>\r
in float vVehY;\r
in float vVehAO;\r
// @section fragmentPaintBaseColor\r
diffuseColor.rgb = min(diffuseColor.rgb * vec3(0.27, 0.285, 0.3), vec3(0.12));\r
pR = 0.07;\r
// @section fragmentPhysicalLightDeclarations\r
#include <lights_physical_pars_fragment>\r
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )\r
vec3 vehHorizon(vec3 viewDir, vec3 n, float rough) {\r
vec3 r = transformDirectionByInverseViewMatrix(reflect(- viewDir, n), viewMatrix);\r
float h = r.y;\r
vec3 sky = textureCubeUV(envMap, envMapRotation * normalize(vec3(r.x, max(h, 0.1), r.z)), max(rough, 0.03)).rgb * envMapIntensity;\r
vec3 hor = textureCubeUV(envMap, envMapRotation * normalize(vec3(r.x, 0.35, r.z)), 0.5).rgb * envMapIntensity;\r
float id = floor(atan(r.z, r.x) * 11.0);\r
float bt = 0.03 + 0.24 * fract(sin(id * 12.9898) * 43758.5453);   // building tops (elevation, ~2-15 deg)\r
float e = 0.006 + rough * 0.4;\r
float bld = 1.0 - smoothstep(bt - e, bt + e, h);\r
float gnd = 1.0 - smoothstep(- 0.04 - e, 0.0 + e, h);\r
vec3 c = sky * 1.25;\r
c = mix(c, hor * (0.24 + 0.1 * fract(id * 0.618)), bld);\r
c = mix(c, hor * 0.04, gnd);\r
return c;\r
}\r
#endif\r
// @section fragmentLightsMaps\r
#include <lights_fragment_maps>\r
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV ) && defined( RE_IndirectSpecular )\r
if(P == 3) radiance = min(mix(radiance, vehHorizon(geometryViewDir, geometryNormal, material.roughness) * 0.7, 0.85), vec3(1.1)); // (vehicles r4) no blown white sky blocks on glass from above\r
#ifdef USE_CLEARCOAT\r
else if(P == 1 || P == 0 || P == 15 || P == 7 || P == 8) clearcoatRadiance = mix(clearcoatRadiance, vehHorizon(geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness) * (P == 1 ? 2.1 : P == 0 ? 1.5 : 1.0), 0.9); // (vehicles r3) paint: stronger reflection read ((vehicles r4) x2.1 paint, x1.5 white bodies: director 'weak on yellow/white')\r
#else\r
else if(P == 1) radiance = mix(radiance, vehHorizon(geometryViewDir, geometryNormal, material.roughness), 0.5);\r
#endif\r
#endif\r
// @section fragmentRoughnessFromVehicleMaterial\r
\r
float gk = 1.0 - smoothstep(0.16, 0.5, vVehY);              // (vehicles) grime band on the lower panels ((vehicles r3) lower + lighter: sills / arches only)\r
float vehCC = 0.0;\r
if(P == 1 || P == 0) {\r
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.72, 0.68, 0.62), gk * 0.7);\r
pR = mix(P == 1 ? 0.26 : 0.45, 0.65, gk * 0.7);\r
vehCC = (P == 1 ? 1.0 : 0.7) * (1.0 - gk * 0.6);\r
} else if(P == 15) vehCC = 0.8;\r
else if(P == 3) vehCC = 0.0;                                  // (vehicles r3) one glossy layer on glass (two layers = blown double sun glint)\r
else if(P == 7 || P == 8) vehCC = 0.9;\r
float vAOe = (P == 2 || P == 5) ? mix(vVehAO, 1.0, 0.65) : vVehAO; // (vehicles r2) baked AO (wheels sit deep in the wells: softened)\r
diffuseColor.rgb *= mix(1.0, vAOe, 0.55);                    // cavities / wheel wells / under-body\r
roughnessFactor = pR;\r
// @section fragmentAmbientOcclusion\r
#include <aomap_fragment>\r
{                                                             // (vehicles r2) baked AO occludes sky light + reflections\r
float vAOk = clamp(vAOe * 1.08, 0.0, 1.0);\r
reflectedLight.indirectDiffuse *= vAOk;\r
reflectedLight.indirectSpecular *= vAOk * vAOk;\r
if(P == 3) reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(0.7)); // (vehicles r4) no blown sun glint on (rear) glass\r
#if defined( USE_CLEARCOAT )\r
clearcoatSpecularIndirect *= vAOk * vAOk;\r
#endif\r
}\r
// @section fragmentPhysicalLights\r
#include <lights_physical_fragment>\r
#ifdef USE_CLEARCOAT\r
material.clearcoat = vehCC;\r
#endif\r
\r
// @section vertexAttributeDeclarations\r
out float vVehY;\r
in float aAO;\r
out float vVehAO;\r
in float aSeed;\r
\r
// @section vertexMain\r
vVehY = position.y;\r
vVehAO = aAO;\r
#ifdef USE_MAP\r
if(aPart > 14.5 && aPart < 15.5 && uv.x > 0.499) {\r
const float AH = 170.0 / 2048.0;\r
float k = floor(fract(aSeed * 7.31 + 0.13) * 8.0);\r
vMapUv = vec2(0.5 + mod(k, 2.0) * 0.25, floor(k / 2.0) * AH) + (uv - vec2(0.5, 0.0));\r
}\r
#endif\r
`,Wt=`// partmat shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in float aPart;\r
flat out float vPart;\r
out vec3 vTintP;\r
out float vStateP;\r
__SHADER_INJECT_0__ __SHADER_INJECT_1__ __SHADER_INJECT_2__\r
// @section vertexBeginVertex\r
#include <begin_vertex>\r
vPart = aPart;\r
vTintP = __SHADER_INJECT_0__;\r
vStateP = __SHADER_INJECT_1__;\r
__SHADER_INJECT_2__\r
// @section fragmentCommon\r
#include <common>\r
flat in float vPart;\r
in vec3 vTintP;\r
in float vStateP;\r
uniform float uNightK;\r
// @section fragmentColor\r
#include <color_fragment>\r
int P = int(vPart + 0.5);\r
float pR = 0.7, pM = 0.0;\r
vec3 pE = vec3(0.0);\r
if(P == 1) {\r
diffuseColor.rgb *= vTintP;\r
pR = 0.32;\r
} else if(P == 2) {\r
pR = 0.28;\r
pM = 1.0;\r
} else if(P == 3) {\r
diffuseColor.rgb = vec3(0.012, 0.014, 0.016);\r
pR = 0.04;\r
} else if(P == 4) {\r
pR = 0.2;\r
pE = diffuseColor.rgb * 0.4;\r
} else if(P == 5) {\r
pR = 0.92;\r
} else if(P == 6) {\r
pR = 0.55;\r
} else if(P == 7) {\r
pR = 0.08;\r
pM = 0.6;\r
pE = vec3(0.12);\r
} else if(P == 8) {\r
pR = 0.2;\r
pE = diffuseColor.rgb * (0.3 + max(vStateP, 0.0) * 7.0);\r
} // (night) state -1 = parked car, lamps off\r
else if(P == 9) {\r
pR = 0.85;\r
} else if(P >= 10 && P <= 12) {\r
float on = abs(float(P - 10) - vStateP) < 0.5 ? 1.0 : 0.0;\r
vec3 lc = P == 10 ? vec3(1.0, 0.06, 0.03) : (P == 11 ? vec3(1.0, 0.5, 0.02) : vec3(0.05, 1.0, 0.45));\r
diffuseColor.rgb = lc * 0.05;\r
pR = 0.15;\r
pE = lc * on * 30.0;\r
} else if(P == 13) {\r
vec3 lc = vStateP > 1.5 ? vec3(0.9, 0.95, 1.0) : vec3(1.0, 0.45, 0.05);\r
diffuseColor.rgb = lc * 0.05;\r
pE = lc * 10.0;\r
} else if(P == 14) {\r
pR = 0.1;\r
pE = diffuseColor.rgb * 3.0;\r
} else if(P == 15) {\r
pR = 0.3;\r
pE = diffuseColor.rgb * 0.25;\r
} else if(P == 16) {\r
diffuseColor.rgb *= vTintP.r > - 1.0 ? vec3(1.0) : vec3(1.0);\r
pR = 0.6;\r
} else if(P == 17 || P == 18 || P == 19) {\r
pR = 0.8;\r
} else if(P == 20) {\r
pR = 0.85;\r
} else if(P == 21) {\r
pR = 0.78;\r
} else if(P == 22) {\r
pR = 0.92;\r
}\r
// (daynight) lamps, headlights, tail lights, screens and taxi signs light up at night\r
if(uNightK > 0.0) {\r
float lampOn = vStateP < - 0.5 ? 0.0 : 1.0; // (night) parked cars (traffic.ts state -1): head / tail lamps dark\r
if(P == 4) pE += (vStateP > 0.5 ? vec3(1.0, 0.56, 0.2) : vec3(1.0, 0.85, 0.66)) * 3.2 * uNightK; // (night r3) warm-white LED / sodium amber ((night r4) 9 -> 3.2: the core just clips, a small halo, not a 60 px disc) (street lamps: props.ts aState)\r
// (night r12) user: 'car lights from distance are very bright big circles, with reflections below'. The bloom halo\r
// is a fixed size on screen while the lamp shrinks: head / tail lamps dim with distance (~1/d past 16 m), so far\r
// cars read as small bright points (was a flat 7.0: every car a clipped disc + halo at any range)\r
float hk = clamp(12.0 / max(length(vViewPosition), 1.0), 0.1, 1.0);\r
if(P == 7) pE += vec3(1.0, 0.95, 0.88) * 3.5 * hk * uNightK * lampOn;\r
else if(P == 8) pE += diffuseColor.rgb * 2.2 * max(hk, 0.35) * uNightK * lampOn;\r
else if(P == 14 || P == 15) pE *= 1.0 + 1.5 * uNightK;\r
}\r
\r
// @section fragmentRoughness\r
#include <roughnessmap_fragment>\r
roughnessFactor = pR;\r
// @section fragmentMetalness\r
#include <metalnessmap_fragment>\r
metalnessFactor = pM;\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
totalEmissiveRadiance += pE;\r
`,Gt=N(()=>Wt),Kt={BASE:0,PAINT:1,METAL:2,GLASS:3,LAMP:4,RUBBER:5,PLASTIC:6,HEADLIGHT:7,TAILLIGHT:8,FABRIC:9,RED_SIGNAL:10,YELLOW_SIGNAL:11,GREEN_SIGNAL:12,PEDESTRIAN:13,SCREEN:14,TAXI:15,SKIN:16,SHIRT:17,PANTS:18,HAIR:19,LEAF:20,WOOD:21,CONCRETE:22};function qt({name:e=`part`,instanceTint:t=!0,instanceState:n=!1,physical:r=!1,extraVertexDeclarations:i=``,extraVertexSetup:a=``,map:o=null}={}){let s={vertexColors:!o,map:o,roughness:.7,metalness:0},c=r?new w(s):new C(s);return c instanceof w&&(c.clearcoat=0),c.onBeforeCompile=e=>{e.uniforms.uNightK=F,e.vertexShader=e.vertexShader.replace(`#include <common>`,P(Gt.vertexCommon,t?`attribute vec3 aTint;`:``,n?`attribute float aState;`:``,i)).replace(`#include <begin_vertex>`,P(Gt.vertexBeginVertex,t?`aTint`:`vec3(1.0)`,n?`aState`:`0.0`,a)),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,Gt.fragmentCommon).replace(`#include <color_fragment>`,Gt.fragmentColor).replace(`#include <roughnessmap_fragment>`,Gt.fragmentRoughness).replace(`#include <metalnessmap_fragment>`,Gt.fragmentMetalness).replace(`#include <emissivemap_fragment>`,Gt.fragmentEmissive)},c.customProgramCacheKey=()=>`city-part-${e}-${t}-${n}`,c}var Jt=ie(`city/tex/`);function Yt(e,t=5){return new Promise((n,r)=>{let i=0,a=()=>{let o=new Image;o.onload=()=>n(o),o.onerror=()=>++i<t?setTimeout(a,250*2**i):r(Error(`texture failed to load: `+e)),o.src=e};a()})}function Xt(e){return Yt(Jt+e)}function $(e,{srgb:t=!1,repeat:n=!0,aniso:r=8}={}){let a=new x(e);return a.colorSpace=t?s:``,n&&(a.wrapS=a.wrapT=f),a.anisotropy=r,a.generateMipmaps=!0,a.minFilter=i,a.magFilter=l,a.needsUpdate=!0,a}function Zt(e,t,{srgb:n,aniso:r}){let a=e.reduce((e,t)=>e+Math.round(t.height/t.width),0),o=new Uint8Array(t*t*4*a),c=document.createElement(`canvas`);c.width=t,c.height=t;let u=c.getContext(`2d`,{willReadFrequently:!0}),d=0;for(let n of e){let e=Math.round(n.height/n.width);for(let r=0;r<e;r++){u.clearRect(0,0,t,t),u.drawImage(n,0,r*n.width,n.width,n.width,0,0,t,t);let e=u.getImageData(0,0,t,t).data;for(let n=0;n<t;n++){let r=(t-1-n)*t*4;o.set(e.subarray(r,r+t*4),(d*t*t+n*t)*4)}d++}}let p=new _(o,t,t,a);return p.colorSpace=n?s:``,p.wrapS=p.wrapT=f,p.generateMipmaps=!0,p.minFilter=i,p.magFilter=l,p.anisotropy=r,p.needsUpdate=!0,p}async function Qt(e){let t=Math.min(16,e.capabilities.getMaxAnisotropy()),n=Object.fromEntries(await Promise.all([`asphalt_col`,`asphalt_nrm`,`asphalt_macro`,`sidewalk_col`,`sidewalk_nrm`,`walls_col.jpg`,`walls_nrm.webp`,`walls_hao.jpg`,`curb_col.webp`,`asphalt_decals.webp`,`interiors`,`signs`,`markings`,`leaves`,`grass_col`,`grass_nrm`,`water_nrm`,`noise`,`detail_nrm`].map(async e=>[e.replace(/\..*/,``),await Xt(e.includes(`.`)?e:e+`.png`)]))),r=await(await fetch(Jt+`markings.json`)).json(),i={asphaltCol:$(n.asphalt_col,{srgb:!0,aniso:t}),asphaltNrm:$(n.asphalt_nrm,{aniso:t}),asphaltMacro:$(n.asphalt_macro,{aniso:t}),sidewalkCol:$(n.sidewalk_col,{srgb:!0,aniso:t}),sidewalkNrm:$(n.sidewalk_nrm,{aniso:t}),interiors:$(n.interiors,{srgb:!0,repeat:!1,aniso:4}),signs:$(n.signs,{srgb:!0,repeat:!1,aniso:t}),markings:$(n.markings,{srgb:!0,repeat:!1,aniso:t}),leaves:$(n.leaves,{repeat:!1,aniso:4}),grassCol:$(n.grass_col,{srgb:!0,aniso:t}),grassNrm:$(n.grass_nrm,{aniso:t}),detailNrm:$(n.detail_nrm,{aniso:t}),waterNrm:$(n.water_nrm,{aniso:t}),noise:$(n.noise,{aniso:4}),markRects:r};return i.wallsCol=Zt([n.walls_col],1024,{srgb:!0,aniso:t}),i.wallsNrm=Zt([n.walls_nrm],512,{srgb:!1,aniso:t}),i.asphaltDecals=$(n.asphalt_decals,{repeat:!1,aniso:t}),i.curbCol=$(n.curb_col,{srgb:!0,aniso:t}),i.wallsHao=Zt([n.walls_hao],512,{srgb:!1,aniso:t}),i}export{ce as C,le as S,me as _,Ut as a,de as b,Ct as c,K as d,Le as f,he as g,ge as h,qt as i,Tt as l,Ce as m,Yt as n,Ht as o,Se as p,Kt as r,St as s,Qt as t,_t as u,pe as v,se as w,ue as x,fe as y};
//# sourceMappingURL=world~index~gameSystems-8QjusU9i.js.map