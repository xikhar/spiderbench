import{$n as e}from"./three~index~combat~screenshotPresets~gameSystems~GLTFLoader-BF58tRDi.js";import{o as t}from"./world~index~screenshotPresets~gameSystems-Dd9PBWOO.js";var n=`// materials shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
out vec2 vDetailUv;\r
// @section vertexUvVertex\r
#include <uv_vertex>\r
#ifdef USE_UV\r
vDetailUv = uv;\r
#else\r
vDetailUv = vec2(0.0);\r
#endif\r
// @section fragmentCommon\r
#include <common>\r
in vec2 vDetailUv;\r
uniform sampler2D uDetailNormal;\r
uniform float uDetailScale, uDetailStrength;\r
vec3 detailPerturb(vec3 n, vec3 viewPos, vec2 uv) {\r
vec3 q0 = dFdx(viewPos), q1 = dFdy(viewPos);\r
vec2 st0 = dFdx(uv), st1 = dFdy(uv);\r
vec3 q1perp = cross(q1, n), q0perp = cross(n, q0);\r
vec3 T = q1perp * st0.x + q0perp * st1.x;\r
vec3 B = q1perp * st0.y + q0perp * st1.y;\r
float det = max(dot(T, T), dot(B, B));\r
float sc = det == 0.0 ? 0.0 : inversesqrt(det);\r
vec3 d = texture(uDetailNormal, uv).xyz * 2.0 - 1.0;\r
d.xy *= uDetailStrength;\r
return normalize(T * (d.x * sc) + B * (d.y * sc) + n * d.z);\r
}\r
// @section fragmentNormalMaps\r
#include <normal_fragment_maps>\r
normal = detailPerturb(normal, - vViewPosition, vDetailUv * uDetailScale);\r
// @section vertexCommonInteriorWindowPosition\r
#include <common>\r
out vec3 vIWPos;\r
out vec3 vIWNrm;\r
// @section vertexProjectVertex\r
#include <project_vertex>\r
{\r
vec4 ip = vec4(transformed, 1.0);\r
vec3 inr = objectNormal;\r
#ifdef USE_INSTANCING\r
ip = instanceMatrix * ip;\r
inr = mat3(instanceMatrix) * inr;\r
#endif\r
vIWPos = (modelMatrix * ip).xyz;\r
vIWNrm = normalize(mat3(modelMatrix) * inr);\r
}\r
// @section fragmentCommonInteriorWindow\r
#include <common>\r
in vec3 vIWPos;\r
in vec3 vIWNrm;\r
uniform vec3 uRoom, uWin;\r
uniform float uLit, uSeed;\r
uniform vec3 uFrame, uGlass;\r
float iHash(vec3 p) {\r
p = fract(p * 0.3183099 + 0.1);\r
p *= 17.0;\r
return fract(p.x * p.y * p.z * (p.x + p.y + p.z));\r
}\r
// returns window mask (x), frame mask (y); writes interior radiance\r
vec2 interiorWindow(out vec3 interior, out float fres) {\r
interior = vec3(0.0);\r
fres = 0.0;\r
vec3 N = normalize(vIWNrm);\r
if(abs(N.y) > 0.3) return vec2(0.0);\r
vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));\r
vec3 B = vec3(0.0, 1.0, 0.0);\r
vec2 wp = vec2(dot(vIWPos, T), vIWPos.y);\r
vec2 cell = floor(wp / uRoom.xy);\r
vec2 f = fract(wp / uRoom.xy);\r
vec3 cid = vec3(cell, floor(dot(vIWPos, N) * 0.5) + uSeed);\r
float r0 = iHash(cid), r1 = iHash(cid + 7.1), r2 = iHash(cid + 13.7);\r
  // window rectangle in the cell\r
vec2 lo = vec2(0.5 - uWin.x * 0.5, uWin.z), hi = vec2(0.5 + uWin.x * 0.5, uWin.z + uWin.y);\r
vec2 aa = fwidth(f) * 1.0;\r
vec2 m2 = smoothstep(lo - aa, lo + aa, f) * (1.0 - smoothstep(hi - aa, hi + aa, f));\r
float win = m2.x * m2.y;\r
  // frame band around the glass\r
vec2 flo = lo - 0.035, fhi = hi + 0.035;\r
vec2 fm = step(flo, f) * (1.0 - step(fhi, f));\r
float frameM = fm.x * fm.y * (1.0 - win);\r
if(win <= 0.0) return vec2(0.0, frameM);\r
  // ray into the room (tangent space: x=T, y=up, z=into building)\r
vec3 V = normalize(vIWPos - cameraPosition);\r
vec3 rd = vec3(dot(V, T), dot(V, B), dot(V, - N));\r
vec3 p = vec3(f, 0.0);\r
vec3 sz = vec3(1.0, 1.0, uRoom.z / uRoom.x);\r
rd.z *= uRoom.x / uRoom.z * 1.0; // normalise depth\r
rd.y *= uRoom.x / uRoom.y;\r
vec3 tt = (step(0.0, rd) - p) / (rd + sign(rd) * 1e-5 + 1e-6);\r
tt.z = (1.0 - p.z) / max(rd.z, 1e-4);\r
float t = min(min(tt.x, tt.y), tt.z);\r
vec3 h = p + rd * t;\r
float depth = clamp(h.z, 0.0, 1.0);\r
vec3 wallC = mix(vec3(0.55, 0.52, 0.47), vec3(0.62, 0.6, 0.58), r1);\r
if(r2 > 0.7) wallC = mix(wallC, vec3(0.45, 0.5, 0.55), 0.5);\r
vec3 c;\r
if(t == tt.z) { // back wall\r
c = wallC * 0.8;\r
float desk = step(h.y, 0.3) * step(0.15, h.x) * step(h.x, 0.75);\r
c = mix(c, vec3(0.12, 0.1, 0.09), desk * step(0.5, r0));\r
} else if(t == tt.y) { // floor / ceiling\r
c = rd.y < 0.0 ? vec3(0.22, 0.19, 0.16) : vec3(0.75);\r
if(rd.y > 0.0) c += step(0.45, abs(fract(h.z * 2.0) - 0.5)) * 1.5 * step(0.5, r1); // ceiling lights\r
} else { // side walls\r
c = wallC * 0.65;\r
}\r
float light = step(1.0 - uLit, r0);\r
float amb = 0.10 + 0.06 * r1;\r
c *= mix(amb, 0.9, light) * mix(1.0, 0.45, depth);\r
  // blinds\r
float blind = step(0.55, r2) * (r2 - 0.55) * 2.2;\r
if(f.y > hi.y - (hi.y - lo.y) * blind) c = vec3(0.55, 0.53, 0.5) * (0.16 + 0.2 * light) * (0.85 + 0.15 * step(0.5, fract(f.y * 60.0)));\r
interior = c * 3.0;\r
float cosv = clamp(dot(- V, N), 0.0, 1.0);\r
fres = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);\r
return vec2(win, frameM);\r
}\r
// @section fragmentMap\r
#include <map_fragment>\r
vec3 iInterior;\r
float iFres;\r
vec2 iMask = interiorWindow(iInterior, iFres);\r
diffuseColor.rgb = mix(diffuseColor.rgb, uFrame, iMask.y);\r
diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, iMask.x);\r
// @section fragmentRoughness\r
#include <roughnessmap_fragment>\r
roughnessFactor = mix(roughnessFactor, 0.5, iMask.y);\r
roughnessFactor = mix(roughnessFactor, 0.04, iMask.x);\r
// @section fragmentMetalness\r
#include <metalnessmap_fragment>\r
metalnessFactor = mix(metalnessFactor, 0.6, iMask.y);\r
metalnessFactor = mix(metalnessFactor, 0.0, iMask.x);\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
totalEmissiveRadiance += iInterior * iMask.x * (1.0 - iFres);\r
`;t(()=>n);function r(t,n,r){let i=t.userData;if(!i.__patches){i.__patches=new Map;let n=t.onBeforeCompile,r=t.customProgramCacheKey;t.onBeforeCompile=(r,a)=>{n&&n!==e.prototype.onBeforeCompile&&n.call(t,r,a);for(let e of i.__patches.values())e(r,a)},t.customProgramCacheKey=()=>(r&&r!==e.prototype.customProgramCacheKey?r.call(t):``)+`|`+[...i.__patches.keys()].join(`,`)}return i.__patches.set(n,r),t.needsUpdate=!0,t}export{r as t};
//# sourceMappingURL=render~index~screenshotPresets~gameSystems-CosUENL6.js.map