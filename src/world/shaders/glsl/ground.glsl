// ground shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
in vec3 aRoad;
out vec3 vWP;
out vec3 vRoad;
// @section vertexFogVertex
#include <fog_vertex>
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vRoad = aRoad;
// @section fragmentCommon
#include <common>
uniform sampler2D tCol;
uniform sampler2D tNrm;
uniform sampler2D tMacro;
uniform sampler2D tNoise;
in vec3 vWP;
in vec3 vRoad;
uniform sampler2D tDec;
vec3 aN;
float aR;
float gDecR = 0.0; // (textures r3)
vec3 asphalt() {
vec2 p = vWP.xz;
vec3 c = texture(tCol, p / 6.0).rgb * 0.88; // (textures r4) critic: 'street asphalt light grey and clean' -> darker binder
vec3 c2 = texture(tCol, vec2(p.y, - p.x) / 7.3 + 0.37).rgb * 0.88;
c = mix(c, c2, 0.35);
vec3 nd = texture(tNrm, p / 6.0).rgb;
vec3 m = texture(tMacro, p / 64.0).rgb;
vec3 m2 = texture(tMacro, vec2(- p.y, p.x) / 151.0 + 0.5).rgb;
vec3 nz = texture(tNoise, p / 97.0).rgb;
float bright = (0.8 + 0.4 * m.r) * (0.88 + 0.24 * m2.r) * (0.94 + 0.12 * nz.r); // gentle macro variation (was blotchy)
c *= bright;
// (no crack lines: user feedback - roads read as uniform, softly worn asphalt; refs/road)
// lanes / tyre grime
// road rect kind (vRoad.x: 0 avenue, 1 street, 2 intersection) + centre line (vRoad.y) from the geometry
int rk = int(vRoad.x + 0.5);
float ax = p.x - vRoad.y, sz = p.y - vRoad.z;
bool onAv = rk != 1, onSt = rk != 0;
float track = 0.0, oil = 0.0, gutter = 0.0;
if(onAv && ! onSt) {
float l = mod(ax + 10.8, 3.6) - 1.8;
track = exp(- pow((abs(l) - 0.85) / 0.3, 2.0));
oil = exp(- pow(l / 0.45, 2.0));
gutter = 1.0 - smoothstep(0.0, 0.8, 11.0 - abs(ax));
} else if(onSt && ! onAv) {
float l = sz;
track = exp(- pow((abs(l) - 0.9) / 0.35, 2.0)) * 0.8;
oil = exp(- pow(l / 0.5, 2.0));
float sh = 5.0 + (vRoad.x - 1.0) * 100.0; // (layout2 r9) per-street half width
if(sh > 6.0) {
float l2 = mod(abs(sz), 3.3) - 1.65;
track = exp(- pow((abs(l2) - 0.85) / 0.3, 2.0)) * 0.8;
oil = exp(- pow(l2 / 0.45, 2.0));
} // two lanes each way
gutter = 1.0 - smoothstep(0.0, 0.7, sh - abs(sz));
} else if(onSt && onAv) {
track = 0.25;
oil = 0.3;
}
float tv = 0.6 + 0.4 * nz.g;
c *= 1.0 - 0.2 * track * tv; // soft tyre-wear lanes (street r6: 0.14 -> 0.2)
float stain = m.b * oil;
c *= 1.0 - 0.2 * stain - 0.05 * oil * nz.b; // faint, broad (no dark lane-centre streaks)
c *= 1.0 - 0.36 * gutter * (0.6 + 0.4 * nz.b); // (street r6) darker wet kerb gutter
c = mix(c, c * vec3(0.95, 0.93, 0.9), gutter);
// patches: soft, broad darker areas only (low-frequency noise, no hard edges or seams)
float patchN = smoothstep(0.62, 0.78, texture(tNoise, p / 41.0 + 0.23).b) * 0.6;
c *= 1.0 - 0.14 * patchN;
// (street r6) critic: 'road too clean'. Mid-scale blotches: parked-car oil drips + dried spill stains (irregular,
// 0.5-2 m, from two noise octaves), strongest in the parking / curb lanes (gutter side), faint mid-road.
{
float s1 = texture(tNoise, p / 3.7 + 0.61).g, s2 = texture(tNoise, p / 1.3 + 0.17).r;
float blot = smoothstep(0.66, 0.8, s1 * 0.75 + s2 * 0.35);
float curbLane = rk == 0 ? smoothstep(6.5, 8.5, abs(ax)) : (rk == 1 ? smoothstep(2.0, 3.2, abs(sz)) : 0.3);
c *= 1.0 - blot * (0.1 + 0.2 * curbLane);
}
// (street r3) lane-by-lane repaving: whole-lane sections milled + resurfaced at different times (crisp straight
// edges on the lane lines, lighter older / darker fresher asphalt) like the refs' patchwork avenues. No cracks.
{
float li, lane0, along, cw;
if(rk == 0) {
li = floor((ax + 10.8) / 3.6);
along = p.y;
cw = 3.6;
lane0 = ax + 10.8 - li * 3.6;
} else if(rk == 1) {
li = sz < 0.0 ? 30.0 : 31.0;
along = p.x;
cw = 5.0;
lane0 = abs(sz);
} else {
li = 40.0 + floor(p.x / 9.0);
along = p.y;
cw = 9.0;
lane0 = mod(p.x, 9.0);
}
float seg = floor(along / 23.0 + li * 0.37);
float hh = fract(sin(dot(vec3(li, seg, vRoad.y * 0.013 + vRoad.z * 0.007), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
float fu = fract(along / 23.0 + li * 0.37);
float edge = smoothstep(0.0, 0.004, fu) * smoothstep(1.0, 0.996, fu) * smoothstep(0.0, 0.04, lane0) * smoothstep(cw, cw - 0.04, lane0);
float rp = hh < 0.16 ? 1.13 : hh < 0.3 ? 0.84 : hh < 0.36 ? 1.22 : 1.0;
c *= mix(1.0, rp, edge * (0.75 + 0.25 * nz.r));
}
// (street r11) critic: 'road clean, no patches / stains'. Utility-cut restorations: sharp-edged rectangles of
// fresher (darker) or older (paler) tar, 1-4 m, ~1 per 3 cells of 11 m; a thin sealant rim; plus broad dark
// oil pools in the stop lanes approaching the intersections (no crack lines: user rule)
{
vec2 cg = vec2(11.0, 13.0), cid2 = floor(p / cg), cf = p - cid2 * cg;
float h1 = fract(sin(dot(cid2, vec2(41.31, 17.77))) * 23758.54), h2 = fract(h1 * 73.1 + 0.3), h3 = fract(h1 * 11.7 + 0.61);
float fwp = fwidth(p.x) * 1.2 + 1e-3;
if(h1 < 0.34 && rk != 2) {
vec2 hs = vec2(0.6 + 1.6 * h2, 0.5 + 1.1 * h3), cc2 = vec2(2.0 + h3 * 7.0, 2.0 + h2 * 9.0);
vec2 dq = abs(cf - cc2) - hs;
float inP = 1.0 - smoothstep(- fwp, fwp, max(dq.x, dq.y));
float rim = (1.0 - smoothstep(0.0, 0.07 + fwp, abs(max(dq.x, dq.y))));
c *= mix(1.0, h2 < 0.6 ? 0.72 : 1.18, inP * (0.85 + 0.3 * nz.g)); // (street r12) 0.8 / 1.12 -> 0.72 / 1.18: readable from rooftop height
c *= 1.0 - 0.22 * rim;
}
// (street r12) critic (ref 16): 'road is uniform dark asphalt; add patching'. Long utility trench restorations:
// 0.9-1.4 m wide strips running 4-11 m across or along the lanes, a few per block, crisp sealed edges
if(rk != 2) {
vec2 tg = vec2(29.0, 37.0), tid = floor(p / tg), tf2 = p - tid * tg;
float t1 = fract(sin(dot(tid, vec2(12.71, 91.37))) * 43758.55), t2 = fract(t1 * 57.3 + 0.21), t3 = fract(t1 * 19.9 + 0.77);
if(t1 < 0.42) {
bool acr = t2 < 0.5;
vec2 hs2 = acr ? vec2(2.0 + 3.5 * t3, 0.45 + 0.25 * t2) : vec2(0.45 + 0.25 * t3, 2.0 + 3.5 * t2);
vec2 c3 = vec2(6.0 + t3 * 17.0, 6.0 + t2 * 25.0);
vec2 dq2 = abs(tf2 - c3) - hs2;
float dd = max(dq2.x, dq2.y);
float inT = 1.0 - smoothstep(- fwp, fwp, dd);
c *= mix(1.0, t3 < 0.55 ? 0.66 : 1.2, inT * (0.8 + 0.4 * nz.b));
c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.06 + fwp, abs(dd)));
}
}
vec2 op = p / 2.3 + 0.17;
float pool = smoothstep(0.62, 0.82, texture(tNoise, op).r * 0.7 + texture(tNoise, op * 2.9).g * 0.4) * (rk == 2 ? 0.3 : oil);
c *= 1.0 - 0.25 * pool;
}
// (textures r3) critic: 'asphalt uniform noise, no patches, cracks, tyre marks'. Photographic repair decals
// ($imagegen sheet, asphalt_decals.webp: 8 cells of colour ratio vs plain asphalt): fresh / old sealed utility cuts,
// trench strips, pothole fills, oil stains, skid marks, manholes in a new-asphalt collar, patch clusters. One
// candidate per 8 m cell (~55 % used), random size / quarter-turn / mirror, jittered inside the cell. One texture
// tap with explicit gradients (no mip seams at the cell borders).
{
vec2 dcg = p / 8.0, dci = floor(dcg), dcf = dcg - dci;
vec2 dqx = dFdx(p), dqy = dFdy(p); // uniform control flow
float e1 = fract(sin(dot(dci, vec2(27.17, 61.93))) * 43758.5453), e2 = fract(e1 * 43.7 + 0.13), e3 = fract(e1 * 7.31 + 0.71);
if(e1 < 0.55) {
float k = e1 < 0.03 ? 6.0 : floor(e2 * 7.999);
if(k > 5.5) k = e1 < 0.03 ? 6.0 : 7.0; // manholes rarer (street decals have them)
float sz = (k > 5.5 && k < 6.5) ? 1.5 : (1.3 + 1.4 * e3); // decal cell = sz x 2 sz (m)
vec2 ctr = 0.5 + (vec2(e2, e3) - 0.5) * (1.0 - vec2(2.0 * sz, 2.0 * sz) / 8.0);
vec2 q = (dcf - ctr) * 8.0; // metres from the decal centre
if(e3 < 0.5) {
q = q.yx;
dqx = dqx.yx;
dqy = dqy.yx;
}
if(fract(e1 * 91.1) < 0.5) {
q.x = - q.x;
dqx.x = - dqx.x;
dqy.x = - dqy.x;
}
vec2 du = q / vec2(sz, 2.0 * sz) + 0.5;
if(all(greaterThan(du, vec2(0.0))) && all(lessThan(du, vec2(1.0)))) {
vec2 cc = vec2(mod(k, 4.0), floor(k / 4.0));
vec2 duv = vec2((cc.x + du.x) / 4.0, 1.0 - (cc.y + 1.0 - du.y) / 2.0);
vec2 gs = vec2(1.0 / (4.0 * sz), 1.0 / (4.0 * sz));
vec3 dr = textureGrad(tDec, duv, dqx * gs, dqy * gs).rgb * 2.0;
c *= mix(vec3(1.0), dr, 0.9);
gDecR = clamp(1.0 - dot(dr, vec3(0.333)), 0.0, 0.6);
}
}
}
c *= vec3(0.97, 0.99, 1.03); // slightly blue-grey, faded
// aerial LOD tone: seen from afar, grime, oil, parked cars and kerb shadows aggregate -> the road reads darker than
// the sidewalks (the street grid stays legible from the rooftops instead of washing into pale strips)
float adist = length(vWP - cameraPosition);
c *= mix(1.0, 0.74, smoothstep(80.0, 600.0, adist)); // (round 7: 0.66 -> 0.52; round 10: 0.74 -- critic: streets read as dark trenches, not grey asphalt)
// (street agent r1) street-level tone: up close the refs' asphalt is a dark blue-grey, about half the sidewalk's
// value; fades out by 260 m so the rooftop / aerial read (above) is unchanged
c *= mix(0.8, 1.0, smoothstep(110.0, 260.0, adist)); // (street r3: 0.64 -> 0.7; r4: 0.8, refs 16 / 04 sunlit asphalt reads mid-grey so the wear decals show)
// (round 10) aerial traffic impostor: beyond the simulated-traffic radius the lanes carry static car-sized
// shapes (muted liveries, yellow cabs, a dark cast-shadow sliver), so the grid reads busy from altitude like the
// refs instead of empty trenches. Fades in past 260 m (the real vehicles cover the near field).
float tf = smoothstep(240.0, 420.0, adist);
if(tf > 0.0 && rk != 2) {
float lane, along, lw, gap;
vec2 cid;
if(rk == 0) {
float li = floor((ax + 10.8) / 3.6);
lane = ax - (li * 3.6 - 9.0);
along = p.y;
gap = 8.5;
cid = vec2(li, vRoad.y);
lw = 1.0;
} else {
float li = sz < 0.0 ? 0.0 : 1.0;
lane = sz - (li < 0.5 ? - 2.3 : 2.3);
along = p.x;
gap = 7.6;
cid = vec2(li + 20.0, vRoad.z);
lw = 0.8;
}
float cell = floor(along / gap), u = along - cell * gap - gap * 0.5;
float h1 = fract(sin(dot(vec3(cid, cell), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
float h2 = fract(h1 * 91.3171 + 0.123);
// denser bunching (platoons at lights): block-scale density wave along the road
float dens = (rk == 0 ? 0.5 : 0.32) * lw * (0.55 + 0.9 * texture(tNoise, vec2(along / 260.0, cid.x * 0.13 + cid.y * 0.001)).r);
if(h1 < dens) {
float L = h2 < 0.12 ? 3.4 : (h2 > 0.92 ? 3.9 : 2.25), Wd = h2 > 0.92 ? 1.25 : 0.92; // half extents (bus / van / car)
float du = abs(u + (h2 - 0.5) * 1.6) - L, dv = abs(lane) - Wd;
float inside = 1.0 - smoothstep(- 0.25, 0.25, max(du, dv));
float shadowS = 1.0 - smoothstep(- 0.3, 0.4, max(du, abs(lane - 0.9) - Wd));
float hc = fract(h2 * 37.77);
vec3 cc = hc < 0.22 ? vec3(0.62, 0.48, 0.12) : hc < 0.42 ? vec3(0.55, 0.55, 0.54) : hc < 0.6 ? vec3(0.05, 0.05, 0.055) : hc < 0.72 ? vec3(0.34, 0.35, 0.36) : hc < 0.8 ? vec3(0.36, 0.1, 0.08) : hc < 0.88 ? vec3(0.12, 0.17, 0.26) : vec3(0.46, 0.45, 0.42);
if(h2 > 0.92) cc = vec3(0.5, 0.52, 0.55); // buses / box vans: pale roofs
c = mix(c, c * 0.55, shadowS * tf * 0.8);
c = mix(c, cc, inside * tf);
}
}
aR = clamp(nd.b + 0.05 - 0.25 * stain - 0.08 * track, 0.35, 1.0);
aR = clamp(aR - 0.45 * gDecR, 0.35, 1.0); // (textures r3) fresh tar / oil decals are glossier
// (foundation r13) critic: 'avenue to the horizon is a thin bright white line'. Far away the grazing view of the
// worn, oily surface glared as a mirror-bright strip against the sun: from ~0.3 km the aggregate (cars, grime,
// kerb shadows, repairs) goes fully matte and a step darker, so avenues read as dark cuts to the horizon
aR = mix(aR, 1.0, smoothstep(300.0, 1100.0, adist));
c *= mix(1.0, 0.8, smoothstep(700.0, 2200.0, adist));
vec2 nxy = nd.rg * 2.0 - 1.0;
aN = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));
return c;
}
// @section fragmentMap
diffuseColor.rgb = asphalt();
// @section fragmentRoughness
float roughnessFactor = aR;
// @section fragmentNormalMaps
{
vec3 nw = normalize(vec3(aN.x, aN.z, aN.y));
normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
}
// @section vertexCommonByWorldPosition
#include <common>
in vec4 aRect;
out vec4 vRect;
out vec3 vWP;
out vec3 vWN;
// @section vertexFogVertexByWorldPosition
#include <fog_vertex>
vRect = aRect;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normal;
// @section fragmentCommonByWorldPosition
#include <common>
uniform sampler2D tCol;
uniform sampler2D tNrm;
uniform sampler2D tNoise;
uniform sampler2D tCurb;
in vec4 vRect;
in vec3 vWP;
in vec3 vWN;
vec3 sN = vec3(0.0, 0.0, 1.0);
float sR = 0.85;
float curbJ(float a, float fw) {
float x = abs(fract(a / 2.4) - 0.5) * 2.4, w = max(0.012, fw * 1.5);
return 0.45 * smoothstep(1.2 - w, 1.2, x) * (0.012 / w);
} // (textures r2) curbstone joints, AA
void walk(out vec3 walkColor) {
vec2 p = vWP.xz;
vec2 fwP = fwidth(p); // (textures r2) uniform control flow
vec3 nz = texture(tNoise, p / 53.0).rgb;
float d = min(min(p.x - vRect.x, vRect.z - p.x), min(p.y - vRect.y, vRect.w - p.y));
if(vWN.y < 0.5) {
          // curb face: weathered concrete/granite, dirtier near the gutter
vec2 q = vec2(p.x + p.y, vWP.y) / 1.3;
vec3 c = texture(tCurb, q).rgb * 0.92; // (textures r2) $imagegen granite curbstone (was the sidewalk sheet)
c *= 1.0 - curbJ(p.x + p.y, fwP.x + fwP.y); // 2.4 m stone joints
c *= mix(0.55, 1.0, smoothstep(- 0.02, 0.14, vWP.y));
sR = 0.85;
sN = vec3(0.0, 0.0, 1.0);
walkColor = c;
return;
}
vec2 uv = p / 6.0; // (textures) imagegen sidewalk sheet holds 4 x 4 slabs -> 1.5 m (5 ft) NYC slabs
vec3 c = texture(tCol, uv).rgb;
vec3 n = texture(tNrm, uv).rgb;
float curb = 1.0 - smoothstep(0.26, 0.3, d);
if(curb > 0.0) {
vec3 cc = texture(tCurb, p / 1.1 + 0.3).rgb * 0.97; // (textures r2) granite curb top + 2.4 m joints
float cAl = (min(p.x - vRect.x, vRect.z - p.x) < min(p.y - vRect.y, vRect.w - p.y)) ? p.y : p.x;
cc *= 1.0 - curbJ(cAl, max(fwP.x, fwP.y));
c = mix(c, cc, curb);
n = mix(n, vec3(0.5, 0.5, 0.7), curb);
}
c *= 0.93 + 0.14 * nz.r; // subtle slab-to-slab variation (refs/road/road_2_sidewalk)
c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 1.2, abs(d - 0.3))) * nz.b;
// (foundation r13) critic: 'streets from altitude read as blank white stripes', 'riverfront edges are ruler-
// straight white strips'. Aerial LOD tone: grime, tree pits, street furniture and kerb shadows aggregate, so from
// the rooftops / the air the sidewalks sit a step darker (no change within 150 m). Promenade / plaza fill pieces
// (vRect unset) are laid in warmer, darker hex / brick pavers like the East River + Hudson esplanades.
{
float adist = length(vWP - cameraPosition);
c *= mix(1.0, 0.78, smoothstep(150.0, 900.0, adist));
if(vRect.x < - 5e4) {
vec2 hp = p / vec2(0.9, 0.78);
float row = floor(hp.y), cu = fract(hp.x + 0.5 * mod(row, 2.0)), cv = fract(hp.y);
float jn = 1.0 - smoothstep(0.0, 0.07, min(min(cu, 1.0 - cu), min(cv, 1.0 - cv)));
float fwp = clamp(fwidth(hp.x) * 2.0, 0.0, 1.0);
c *= vec3(0.86, 0.82, 0.77) * (1.0 - 0.18 * jn * (1.0 - fwp));
c *= mix(1.0, 0.9, smoothstep(120.0, 600.0, adist));
}
}
sR = mix(n.b, 1.0, smoothstep(300.0, 1100.0, length(vWP - cameraPosition))); // (r13) matte from afar (no grazing glare strips)
vec2 nxy = n.rg * 2.0 - 1.0;
sN = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));
walkColor = c;
}
// @section fragmentMapWalkingSurface
vec3 walkColor;
walk(walkColor);
diffuseColor.rgb = walkColor;
// @section fragmentRoughnessWalkingSurface
float roughnessFactor = sR;
// @section fragmentNormalMapsByWorldNormal
if(vWN.y > 0.5) {
vec3 nw = normalize(vec3(sN.x, sN.z, sN.y));
normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
}
// @section vertexCommonDistantGrass
#include <common>
out vec3 vWP;
// @section vertexFogVertexDistantGrass
#include <fog_vertex>
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
// @section fragmentCommonGrassSurface
#include <common>
uniform sampler2D tCol;
uniform sampler2D tNoise;
in vec3 vWP;
uniform vec4 uMd[__SHADER_INJECT_0__];
uniform float uMa[__SHADER_INJECT_1__];
uniform vec4 uPw[__SHADER_INJECT_2__];
uniform float uPa[__SHADER_INJECT_3__];
uniform vec4 uPh[__SHADER_INJECT_4__];
uniform float uPq[__SHADER_INJECT_5__];
float pondD(vec2 p, vec4 e, float a, vec4 h, float wq) { // same outline function as layout.ts PARK_WATER
vec2 d = p - e.xy;
float c = cos(a), s = sin(a);
vec2 q = vec2((d.x * c - d.y * s) / e.z, (d.x * s + d.y * c) / e.w);
float t = atan(q.y, q.x);
float k = 1.0 + 0.08 * sin(t * 3.0 + e.x) + 0.05 * sin(t * 5.0 + e.y * 0.1) + h.x * sin(t * 2.0 + 0.7) + h.y * sin(t * 3.0 + 2.1) + h.z * cos(t * 4.0) + h.w * sin(t * 5.0 + 4.2) + wq * (sin(t * 7.0 + e.x * 0.05) + 0.7 * sin(t * 11.0 + e.y * 0.03) + 0.45 * sin(t * 17.0 + 1.9)); // (round 7)
return length(q) / k;
}
float pkFld(vec2 p, float f, float ph) { // (park r3) = trees.ts fld(): open-woodland field
return 0.5 + 0.5 * (0.55 * sin(p.x * f + ph) * cos(p.y * f * 0.83 - ph * 1.7) + 0.3 * sin((p.x * 0.6 - p.y * 0.8) * f * 2.1 + ph * 2.3) + 0.15 * sin((p.x * 0.9 + p.y * 0.4) * f * 4.3 + ph * 0.7));
}
float ellD(vec2 p, vec4 e, float a, float w1, float w2, float ph2) {
vec2 d = p - e.xy;
float c = cos(a), s = sin(a);
vec2 q = vec2((d.x * c - d.y * s) / e.z, (d.x * s + d.y * c) / e.w);
float ang = atan(q.y, q.x);
return length(q) / (1.0 + w1 * sin(ang * 3.0 + e.x) + w2 * sin(ang * 5.0 + e.y * ph2));
}
// @section fragmentMapGrassSurface
{
vec2 p = vWP.xz;
vec3 c = texture(tCol, p / 6.0).rgb;
vec3 c2 = texture(tCol, p.yx / 23.0).rgb;
vec3 nz = texture(tNoise, p / 140.0).rgb, nz2 = texture(tNoise, p / 37.0).rgb;
c = mix(c, c2, 0.4) * (0.78 + 0.4 * nz.r);
c = mix(c, vec3(dot(c, vec3(0.3, 0.55, 0.15))), 0.32) * vec3(0.84, 0.84, 0.74); // muted, late-season
// meadows: mowed, lighter, a faint mowing stripe; outside: shaded woodland floor (leaf litter, moss) under groves
float m = 9.0;
for(int i = 0;
i < __SHADER_INJECT_0__;
i ++) m = min(m, ellD(p, uMd[i], uMa[i], 0.09, 0.06, 1.0));
float grove = sin(p.x * 0.021 + 1.3) * cos(p.y * 0.017 - 0.7) + 0.6 * sin(p.x * 0.047 - p.y * 0.031 + 2.1) + 0.35 * sin(p.y * 0.083 + p.x * 0.012);
grove = clamp(0.75 + grove * 0.45, 0.0, 1.0) * smoothstep(1.0, 1.3, m); // (round 6: +0.3, matches the denser fill canopy)
grove *= 1.0 - 0.8 * smoothstep(0.56, 0.7, pkFld(p, 1.0 / 55.0, 4.1)); // (park r3) open woodland: lawn between scattered trees
vec3 floorC = mix(vec3(0.19, 0.18, 0.09), vec3(0.26, 0.2, 0.11), nz2.g) * (0.8 + 0.25 * nz.b); // (park r9) was near-black (0.1,0.1,0.05): read as holes on the Great Lawn where no crowns cover it
c = mix(c, floorC, smoothstep(0.25, 0.65, grove) * __SHADER_INJECT_1__);
float meadow = __SHADER_INJECT_2__;
{ // (park r3) mowing stripes (alternating direction per ~60 m patch) + brown wear patches on the lawns
float dirSel = step(0.5, texture(tNoise, p / 900.0).g);
float sf = fract(mix(p.x, p.y, dirSel) / 6.5 + 0.1 * nz.r);
float strp = smoothstep(0.42, 0.5, sf) * (1.0 - smoothstep(0.92, 1.0, sf)); // (park r10) critic r9: 'no mowing stripes' -> stronger, soft-edged
c = mix(c, c * vec3(1.1, 1.14, 1.0) * (0.88 + 0.22 * strp), meadow);
float wear = smoothstep(0.6, 0.78, texture(tNoise, p / 29.0 + vec2(0.33, 0.77)).r) * smoothstep(0.35, 0.65, nz2.b);
c = mix(c, vec3(0.3, 0.26, 0.17) * (0.85 + 0.3 * nz2.g), wear * 0.55 * meadow);
}
// (round 10) lawn texture at mid range (critic: 'large flat blurry green'): trodden desire lines, clover / weed
// patches, dry spots and soft mower-turn arcs, all low-contrast
{
vec3 q1 = texture(tNoise, p / 11.0 + vec2(0.19, 0.53)).rgb, q2 = texture(tNoise, p / 3.3 + vec2(0.61, 0.07)).rgb;
float clover = smoothstep(0.55, 0.75, q1.r) * 0.5 + smoothstep(0.6, 0.8, q2.g) * 0.25;
c = mix(c, c * vec3(0.8, 0.9, 0.78), clover * meadow);
float dry = smoothstep(0.62, 0.8, q1.b) * smoothstep(0.4, 0.7, nz2.r);
c = mix(c, vec3(0.34, 0.31, 0.2) * (0.8 + 0.3 * q2.r), dry * 0.45 * meadow);
float trod = 1.0 - smoothstep(0.0, 1.2, abs(sin(p.x * 0.011 + p.y * 0.019 + 3.0 * nz.g) * 60.0));
c = mix(c, vec3(0.3, 0.28, 0.2), trod * 0.35 * meadow * smoothstep(0.45, 0.6, nz.b));
c *= 0.93 + 0.14 * q2.b;
}
// worn / leaf-covered patches (fewer on the lawns)
c = mix(c, vec3(0.4, 0.28, 0.13), smoothstep(0.58, 0.82, nz.g) * 0.5 * (1.0 - meadow));
// (round 5) broad tonal variation: dry straw-olive swathes vs lush darker grass (never one flat green plane)
vec3 nzL = texture(tNoise, p / 420.0 + vec2(0.37, 0.11)).rgb;
c *= mix(vec3(0.86, 0.9, 0.84), vec3(1.12, 1.04, 0.86), smoothstep(0.3, 0.75, nzL.r));
c *= 0.85 + 0.3 * smoothstep(0.2, 0.8, nzL.b);
// (round 5) Manhattan-schist outcrops: grey-brown rock shelves with dark joints, at meadow edges and in the woods
float ro = texture(tNoise, p / 55.0 + vec2(0.71, 0.29)).g * 0.7 + texture(tNoise, p / 17.0).b * 0.3;
float rock = smoothstep(0.66, 0.7, ro) * smoothstep(0.95, 1.25, m) * __SHADER_INJECT_3__;
vec3 rc = mix(vec3(0.3, 0.29, 0.27), vec3(0.44, 0.42, 0.39), nz2.r) * (0.8 + 0.3 * texture(tNoise, p / 3.0).r);
rc *= 1.0 - 0.45 * smoothstep(0.55, 0.62, fract((p.x * 0.8 + p.y * 0.6) / 2.3 + nz2.g)); // foliation joints
c = mix(c, rc, rock * 0.9);
// ball-field infields (skinned fan-shaped infields with a grass diamond) on the Great-Lawn / North-Meadow-like meadows
for(int i = 1;
i < __SHADER_INJECT_4__;
i ++) {
for(int k = 0;
k < 4;
k ++) {
if(i == 2 && (k == 1 || k == 2)) continue;                 // (round 4) fewer, varied fields: 4 + 2
float fk = float(i * 4 + k);
vec2 hp = uMd[i].xy + vec2(float(k & 1) * 2.0 - 1.0, float(k >> 1) * 2.0 - 1.0) * uMd[i].zw * vec2(0.55 + 0.08 * sin(fk * 2.3), 0.5 + 0.08 * cos(fk * 1.7));
vec2 dir = normalize(uMd[i].xy - hp);                      // outfield points toward the meadow centre
float ra = 0.35 * sin(fk * 3.1 + 0.4);
dir = vec2(dir.x * cos(ra) - dir.y * sin(ra), dir.x * sin(ra) + dir.y * cos(ra));
float R = 22.0 + 5.0 * fract(fk * 0.618);
vec2 d = p - hp;
float r = length(d), ca = dot(d, dir) / max(r, 1e-3);
float fan = (1.0 - smoothstep(R, R + 1.5, r)) * smoothstep(0.66, 0.72, ca);
vec2 q = vec2(dot(d, dir), dot(d, vec2(- dir.y, dir.x)));  // along / across the foul-line bisector
vec2 qd = vec2(q.x + q.y, q.x - q.y) * 0.7071;             // diamond axes (foul lines)
float gs = R * 0.64;
float grassSq = step(1.5, qd.x) * step(1.5, qd.y) * step(qd.x, gs) * step(qd.y, gs);
float sand = max(fan * (1.0 - grassSq), 1.0 - smoothstep(2.5, 3.2, length(q - vec2(R * 0.48, 0.0)))); // + pitcher's mound
// (park r3) worn infield: darker scuffed base paths / home circle, raked lighter centre, patchy edge into the turf
float bp = max(1.0 - smoothstep(0.8, 1.6, abs(qd.x - 1.0)), 1.0 - smoothstep(0.8, 1.6, abs(qd.y - 1.0))) * step(qd.x, gs + 2.0) * step(qd.y, gs + 2.0) * step(- 1.0, min(qd.x, qd.y));
vec3 dirt = mix(vec3(0.38, 0.27, 0.18), vec3(0.46, 0.34, 0.23), texture(tNoise, p / 4.0).r) * (0.8 + 0.25 * nz2.r); // (park r7) darker compacted clay (critic r6: 'pale decals')
dirt = mix(dirt, vec3(0.27, 0.2, 0.14), max(bp * fan, 1.0 - smoothstep(3.0, 4.5, r)) * 0.65);
sand *= smoothstep(0.25, 0.6, texture(tNoise, p / 2.2).g + smoothstep(R - 3.0, R - 0.5, r) * - 0.5 + 0.45);
// (park r10) critic r9: 'ballfields are flat decals': a dark lip where the turf edge stands over the skinned
// infield + a worn, lighter outfield ring in front of it (depth / wear instead of a pasted shape)
float lip = (1.0 - smoothstep(0.0, 0.9, abs(r - R - 0.4))) * smoothstep(0.64, 0.72, ca);
float worn = (1.0 - smoothstep(R, R + 9.0, r)) * smoothstep(R - 0.5, R + 1.5, r) * smoothstep(0.55, 0.75, ca);
c = mix(c, c * vec3(1.08, 1.03, 0.86), worn * 0.6);
c *= 1.0 - 0.3 * lip;
c = mix(c, dirt, clamp(sand, 0.0, 1.0) * (0.78 + 0.16 * fract(fk * 0.37))); // (round 6: worn, not stamped; park r2: sand infields read from the air, refs 08 / 09)
}
}
// pond banks: mud / wet stone ring, then damp dark grass
float pd = 9.0;
for(int i = 0;
i < __SHADER_INJECT_5__;
i ++) pd = min(pd, (pondD(p, uPw[i], uPa[i], uPh[i], uPq[i]) - 1.0) * max(uPw[i].z, uPw[i].w));
float bank = __SHADER_INJECT_6__;
vec3 mud = mix(vec3(0.2, 0.17, 0.13), vec3(0.34, 0.32, 0.29), step(0.62, nz2.r)); // mud with stones
c = mix(c * (1.0 - 0.35 * (1.0 - smoothstep(3.0, 9.0, pd))), mud, bank);
// (round 5) reeds / shrubby shore vegetation: a patchy dark band a few metres back from the waterline
float reed = (1.0 - smoothstep(4.0, 11.0 + 5.0 * nz.g, pd)) * smoothstep(1.5, 3.5, pd) * smoothstep(0.35, 0.6, nz2.b);
c = mix(c, vec3(0.09, 0.1, 0.045) * (0.8 + 0.4 * nz2.g), reed * __SHADER_INJECT_7__);
// (round 6) the Reservoir's running track: a cinder / gravel loop ~5-9 m outside the bank, with its iron fence line
{
float rd = (pondD(p, uPw[3], uPa[3], uPh[3], uPq[3]) - 1.0) * max(uPw[3].z, uPw[3].w);
float eg = 0.9 * (texture(tNoise, p / 7.0).r - 0.5);  // (park r9) ragged grass edges, not a clean ruled band
float trk = smoothstep(4.2 + eg, 5.2 + eg, rd) * (1.0 - smoothstep(8.2 - eg, 9.2 - eg, rd));
vec3 cin = mix(vec3(0.31, 0.26, 0.21), vec3(0.37, 0.31, 0.25), texture(tNoise, p / 1.7).g) * (0.82 + 0.26 * nz2.r); // darker cinder (critic r8: 'clean white band')
cin *= 1.0 - 0.14 * (1.0 - smoothstep(0.3, 1.1, abs(rd - 6.7 + 0.4 * nz.g)));      // worn, compacted running line
cin = mix(cin, vec3(0.2, 0.18, 0.15), smoothstep(0.68, 0.8, texture(tNoise, p / 13.0 + vec2(0.4, 0.1)).b) * 0.6); // damp patches
c = mix(c, cin, trk * __SHADER_INJECT_8__);
c = mix(c, vec3(0.1, 0.1, 0.09), (1.0 - smoothstep(0.2, 0.7, abs(rd - 3.6))) * __SHADER_INJECT_9__);
}
diffuseColor.rgb = c;
}
// @section fragmentNormalMapsGrassSurface
#include <normal_fragment_maps>
{
vec2 p = vWP.xz;
float e = 3.0;
#define GH(q) (texture(tNoise, (q) / 160.0 + vec2(0.27, 0.61)).g * 1.5 + texture(tNoise, (q) / 45.0 + vec2(0.83, 0.13)).r * 0.6)
float dx = (GH(p + vec2(e, 0.0)) - GH(p - vec2(e, 0.0))) / (2.0 * e), dz = (GH(p + vec2(0.0, e)) - GH(p - vec2(0.0, e))) / (2.0 * e);
#undef GH
vec3 nW = normalize(vec3(- dx * 6.0, 1.0, - dz * 6.0));
normal = normalize(mix(normal, (viewMatrix * vec4(nW, 0.0)).xyz, 0.85));
}
// @section vertexCommonByMountainWorldPosition
#include <common>
out vec3 vWPm;
// @section vertexFogVertexByMountainWorldPosition
#include <fog_vertex>
vWPm = (modelMatrix * vec4(transformed, 1.0)).xyz;
// @section fragmentCommonByMountainWorldPosition
#include <common>
uniform sampler2D tNoiseW;
in vec3 vWPm;
// @section fragmentMapByMountainWorldPosition
#include <map_fragment>
{
vec3 w1 = texture(tNoiseW, vWPm.xz / 2.3).rgb, w2 = texture(tNoiseW, vWPm.xz / 0.37).rgb;
float wear = smoothstep(0.35, 0.8, w1.g * 0.7 + w2.r * 0.5);
diffuseColor.a *= 1.0 - 0.45 * wear; // (street r6: 0.25 -> 0.45) critic: 'lane markings perfect and crisp'
float chip = smoothstep(0.58, 0.72, texture(tNoiseW, vWPm.xz / 0.11 + 0.37).g);   // chipped thermoplastic
diffuseColor.a *= 1.0 - 0.6 * chip * (0.4 + 0.6 * wear);
diffuseColor.rgb *= (0.86 + 0.1 * w2.b) * vec3(1.0, 0.985, 0.95); // grimy, slightly yellowed paint
// (street r9) critic: 'crosswalks crisp painted stripes with no wear': tyre-grime streaks along both travel
// axes (thin in the cross direction, long along it), broad scuffed blotches where the paint is nearly gone
float skZ = texture(tNoiseW, vec2(vWPm.x / 0.5, vWPm.z / 14.0) + 0.21).g, skX = texture(tNoiseW, vec2(vWPm.x / 14.0, vWPm.z / 0.5) + 0.63).b;
diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.45, 0.8, max(skZ, skX));
diffuseColor.a *= 1.0 - 0.5 * smoothstep(0.55, 0.75, texture(tNoiseW, vWPm.xz / 5.3 + 0.11).r);
}
// @section vertexCommonByPavementWorldPosition
#include <common>
out vec2 vPU;
out vec3 vPW;
// @section vertexUvVertex
#include <uv_vertex>
vPU = uv;
// @section vertexFogVertexByPavementWorldPosition
#include <fog_vertex>
vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;
// @section fragmentCommonByPavementWorldPosition
#include <common>
uniform sampler2D tPN;
in vec2 vPU;
in vec3 vPW;
// @section fragmentMapByPavementUv
#include <map_fragment>
{
vec3 n = texture(tPN, vPW.xz / 9.0).rgb, n2 = texture(tPN, vPW.xz / 2.3).rgb;
float e = min(vPU.x, 1.0 - vPU.x);
float edge = smoothstep(0.02, 0.2 + 0.12 * n.r, e + 0.08 * (n2.g - 0.5));
diffuseColor.a *= edge;
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.08, 1.0, 0.86), n.b) * (0.9 + 0.2 * n2.r);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.38, 0.34) * (0.9 + 0.2 * n.r), 0.45);
} // park r2: paler walks read from the air (refs 08 / 09)
