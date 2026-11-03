// materials shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
out vec2 vDetailUv;
// @section vertexUvVertex
#include <uv_vertex>
#ifdef USE_UV
vDetailUv = uv;
#else
vDetailUv = vec2(0.0);
#endif
// @section fragmentCommon
#include <common>
in vec2 vDetailUv;
uniform sampler2D uDetailNormal;
uniform float uDetailScale, uDetailStrength;
vec3 detailPerturb(vec3 n, vec3 viewPos, vec2 uv) {
vec3 q0 = dFdx(viewPos), q1 = dFdy(viewPos);
vec2 st0 = dFdx(uv), st1 = dFdy(uv);
vec3 q1perp = cross(q1, n), q0perp = cross(n, q0);
vec3 T = q1perp * st0.x + q0perp * st1.x;
vec3 B = q1perp * st0.y + q0perp * st1.y;
float det = max(dot(T, T), dot(B, B));
float sc = det == 0.0 ? 0.0 : inversesqrt(det);
vec3 d = texture(uDetailNormal, uv).xyz * 2.0 - 1.0;
d.xy *= uDetailStrength;
return normalize(T * (d.x * sc) + B * (d.y * sc) + n * d.z);
}
// @section fragmentNormalMaps
#include <normal_fragment_maps>
normal = detailPerturb(normal, - vViewPosition, vDetailUv * uDetailScale);
// @section vertexCommonInteriorWindowPosition
#include <common>
out vec3 vIWPos;
out vec3 vIWNrm;
// @section vertexProjectVertex
#include <project_vertex>
{
vec4 ip = vec4(transformed, 1.0);
vec3 inr = objectNormal;
#ifdef USE_INSTANCING
ip = instanceMatrix * ip;
inr = mat3(instanceMatrix) * inr;
#endif
vIWPos = (modelMatrix * ip).xyz;
vIWNrm = normalize(mat3(modelMatrix) * inr);
}
// @section fragmentCommonInteriorWindow
#include <common>
in vec3 vIWPos;
in vec3 vIWNrm;
uniform vec3 uRoom, uWin;
uniform float uLit, uSeed;
uniform vec3 uFrame, uGlass;
float iHash(vec3 p) {
p = fract(p * 0.3183099 + 0.1);
p *= 17.0;
return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
// returns window mask (x), frame mask (y); writes interior radiance
vec2 interiorWindow(out vec3 interior, out float fres) {
interior = vec3(0.0);
fres = 0.0;
vec3 N = normalize(vIWNrm);
if(abs(N.y) > 0.3) return vec2(0.0);
vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
vec3 B = vec3(0.0, 1.0, 0.0);
vec2 wp = vec2(dot(vIWPos, T), vIWPos.y);
vec2 cell = floor(wp / uRoom.xy);
vec2 f = fract(wp / uRoom.xy);
vec3 cid = vec3(cell, floor(dot(vIWPos, N) * 0.5) + uSeed);
float r0 = iHash(cid), r1 = iHash(cid + 7.1), r2 = iHash(cid + 13.7);
  // window rectangle in the cell
vec2 lo = vec2(0.5 - uWin.x * 0.5, uWin.z), hi = vec2(0.5 + uWin.x * 0.5, uWin.z + uWin.y);
vec2 aa = fwidth(f) * 1.0;
vec2 m2 = smoothstep(lo - aa, lo + aa, f) * (1.0 - smoothstep(hi - aa, hi + aa, f));
float win = m2.x * m2.y;
  // frame band around the glass
vec2 flo = lo - 0.035, fhi = hi + 0.035;
vec2 fm = step(flo, f) * (1.0 - step(fhi, f));
float frameM = fm.x * fm.y * (1.0 - win);
if(win <= 0.0) return vec2(0.0, frameM);
  // ray into the room (tangent space: x=T, y=up, z=into building)
vec3 V = normalize(vIWPos - cameraPosition);
vec3 rd = vec3(dot(V, T), dot(V, B), dot(V, - N));
vec3 p = vec3(f, 0.0);
vec3 sz = vec3(1.0, 1.0, uRoom.z / uRoom.x);
rd.z *= uRoom.x / uRoom.z * 1.0; // normalise depth
rd.y *= uRoom.x / uRoom.y;
vec3 tt = (step(0.0, rd) - p) / (rd + sign(rd) * 1e-5 + 1e-6);
tt.z = (1.0 - p.z) / max(rd.z, 1e-4);
float t = min(min(tt.x, tt.y), tt.z);
vec3 h = p + rd * t;
float depth = clamp(h.z, 0.0, 1.0);
vec3 wallC = mix(vec3(0.55, 0.52, 0.47), vec3(0.62, 0.6, 0.58), r1);
if(r2 > 0.7) wallC = mix(wallC, vec3(0.45, 0.5, 0.55), 0.5);
vec3 c;
if(t == tt.z) { // back wall
c = wallC * 0.8;
float desk = step(h.y, 0.3) * step(0.15, h.x) * step(h.x, 0.75);
c = mix(c, vec3(0.12, 0.1, 0.09), desk * step(0.5, r0));
} else if(t == tt.y) { // floor / ceiling
c = rd.y < 0.0 ? vec3(0.22, 0.19, 0.16) : vec3(0.75);
if(rd.y > 0.0) c += step(0.45, abs(fract(h.z * 2.0) - 0.5)) * 1.5 * step(0.5, r1); // ceiling lights
} else { // side walls
c = wallC * 0.65;
}
float light = step(1.0 - uLit, r0);
float amb = 0.10 + 0.06 * r1;
c *= mix(amb, 0.9, light) * mix(1.0, 0.45, depth);
  // blinds
float blind = step(0.55, r2) * (r2 - 0.55) * 2.2;
if(f.y > hi.y - (hi.y - lo.y) * blind) c = vec3(0.55, 0.53, 0.5) * (0.16 + 0.2 * light) * (0.85 + 0.15 * step(0.5, fract(f.y * 60.0)));
interior = c * 3.0;
float cosv = clamp(dot(- V, N), 0.0, 1.0);
fres = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
return vec2(win, frameM);
}
// @section fragmentMap
#include <map_fragment>
vec3 iInterior;
float iFres;
vec2 iMask = interiorWindow(iInterior, iFres);
diffuseColor.rgb = mix(diffuseColor.rgb, uFrame, iMask.y);
diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, iMask.x);
// @section fragmentRoughness
#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.5, iMask.y);
roughnessFactor = mix(roughnessFactor, 0.04, iMask.x);
// @section fragmentMetalness
#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.6, iMask.y);
metalnessFactor = mix(metalnessFactor, 0.0, iMask.x);
// @section fragmentEmissive
#include <emissivemap_fragment>
totalEmissiveRadiance += iInterior * iMask.x * (1.0 - iFres);
