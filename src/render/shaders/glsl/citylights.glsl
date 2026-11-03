// citylights shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexBeginVertex
#include <begin_vertex>
#ifdef USE_INSTANCING
transformed -= normalize(normal) * 0.2;
#endif

// @section lightDeclarations

// (r11) fallbacks set per material by fixPrograms() on GPUs with 16 fragment texture units (Apple / ANGLE D3D11):
// CITYL_NOSH drops the shadow-map sampler, CITYL_OFF the city lights entirely (the program would not link)
#ifdef CITYL_OFF
#undef USE_CITYL
#endif
// (r13) CITYL_UNIF: no city-light textures at all: the CL_UN lights that light the player most arrive as a uniform array
// (cityLU, same 4-texel records; count in cityLU[ CL_UN * 4 ].x). For materials that are over the unit limit even without
// the shadow sampler (the suit on the Mac: 16 of its own), so Spider-Man is still lit by the lamps / cars / screens
#ifdef CITYL_UNIF
#define CITYL_NOSH
#endif
#ifdef USE_CITYL
#ifndef CITYL_PARS
#define CITYL_PARS
#ifdef CITYL_UNIF
struct CityL {
vec4 origin;
vec4 misc;
mat4 shM[__SHADER_INJECT_0__];
vec4 shW;
};
uniform vec4 cityLU[__SHADER_INJECT_1__];
#elif defined( CITYL_NOSH )
struct CityL {
sampler2D data;
highp usampler2D grid;
vec4 origin;
vec4 misc;
mat4 shM[__SHADER_INJECT_2__];
vec4 shW;
};
#else
struct CityL {
sampler2D data;
highp usampler2D grid;
vec4 origin;
vec4 misc;
mat4 shM[__SHADER_INJECT_3__];
sampler2D shMap;
vec4 shW;
};
#endif
uniform CityL cityL;
#ifdef CITYL_UNIF
vec4 cityLTex(int li, int k) {
return cityLU[li * 4 + k];
}
#else
vec4 cityLTex(int li, int k) {
return texelFetch(cityL.data, ivec2((li & 255) * 4 + k, li >> 8), 0);
}
#endif
// shadow of slot s at wp (dist: distance to the light, range: its range): 3x3 PCF of the distance map, faded by shW
float cityLShadow(int s, vec3 wp, float dist, float range) {
#ifdef CITYL_NOSH
return 1.0;
#else
vec4 cp = cityL.shM[s] * vec4(wp, 1.0);
if(cp.w <= 0.0) return 1.0;
vec2 uv = cp.xy / cp.w * 0.5 + 0.5;
if(any(lessThan(uv, vec2(0.004))) || any(greaterThan(uv, vec2(0.996)))) return 1.0;
vec2 tile = vec2(float(s & 1), float(s >> 1)) * 0.5;
vec2 tuv = tile + uv * 0.5;
const float tx = 1.0 / float(__SHADER_INJECT_4__);
float fd = dist / range - (0.05 + dist * 0.02) / range; // receiver bias grows with the texel footprint
float vis = 0.0;
// 3x3 taps on a rotated grid (breaks up texel stair-steps), footprint ~2.5 texels
const mat2 R = mat2(0.866, 0.5, - 0.5, 0.866);
for(int j = - 1;
j <= 1;
j ++) for(int i = - 1;
i <= 1;
i ++) {
vec2 q = clamp(tuv + R * vec2(float(i), float(j)) * tx * 1.25, tile + tx, tile + 0.5 - tx);
vis += step(fd, textureLod(cityL.shMap, q, 0.0).r);
}
float w = s == 0 ? cityL.shW.x : s == 1 ? cityL.shW.y : s == 2 ? cityL.shW.z : cityL.shW.w;
return mix(1.0, vis / 9.0, w);
#endif
}
// incident light of city light li at world point wp: returns the colour (0 if none), world direction to the light and
// the source-size roughness widening
// (night r10) specular representative point (Karis 2013): cityLSpecDir = direction to the point of the emitter closest to
// the reflection ray cityLRefl (set by the caller, world space; zero = unused), cityLAng = the emitter's angular size
// (for the energy normalisation (a / a')^2 in the caller)
vec3 cityLRefl = vec3(0.0), cityLSpecDir = vec3(0.0, 1.0, 0.0);
float cityLAng = 0.0;
vec3 cityLIncident2(int li, vec3 wp, out vec3 Ldir, out float widen, out float specK) {
vec4 a = cityLTex(li, 0);
Ldir = vec3(0.0, 1.0, 0.0);
widen = 0.0;
specK = 1.0;
cityLAng = 0.0;
vec3 lp = a.xyz, L0 = lp - wp;
float dc2 = dot(L0, L0);
if(dc2 > a.w * a.w) return vec3(0.0); // out of range (rects: a.w = range + half diagonal, from the centre): skip the other 3 fetches
vec4 b = cityLTex(li, 1), c = cityLTex(li, 2), d = cityLTex(li, 3);
float type = floor(b.w);
if(type > 1.5) { // rect emitter (screen / lit window): representative point = closest point of the rectangle
vec3 rel = wp - lp;
float side = dot(rel, c.xyz);
if(side <= 0.02) return vec3(0.0);
vec3 v = cross(c.xyz, d.xyz);
float du = clamp(dot(rel, d.xyz), - c.w, c.w), dv = clamp(dot(rel, v), - d.w, d.w);
vec3 L = lp + d.xyz * du + v * dv - wp;
float d2 = dot(L, L);
float dist = sqrt(d2);
Ldir = L / max(dist, 1e-4);
float area = 4.0 * c.w * d.w;
float cosE = mix(side / max(length(rel), 1e-3), max(dot(c.xyz, - Ldir), 0.0), 0.6); // emitter cosine: centre (smooth) blended with the closest point (floors / ledges at the foot of a big screen get their light)
float win = 1.0 - dc2 / (a.w * a.w);
win *= win;
widen = min(0.15, min(c.w, d.w) / (2.0 * dist + 0.5)); // (night r10) wrap capped at 0.15: near big screens it lit faces turned away evenly (flat, self-lit look)
cityLSpecDir = Ldir;
cityLAng = min(1.0, sqrt(area) / (dist + 0.5));
float rn = dot(cityLRefl, c.xyz);
if(rn < - 1e-3) { // the reflection ray heads toward the emitter's lit face: its hit point on the plane, clamped into the rect
float t = dot(lp - wp, c.xyz) / rn;
if(t > 0.0) {
vec3 h = wp + cityLRefl * t - lp;
vec3 hp = lp + d.xyz * clamp(dot(h, d.xyz), - c.w, c.w) + v * clamp(dot(h, v), - d.w, d.w) - wp;
cityLSpecDir = normalize(hp);
}
}
return b.rgb * (area * cosE / (d2 + area * 0.3183)) * win;
}
vec3 L = L0;
float d2 = dc2;
float dist = sqrt(d2);
Ldir = L / max(dist, 1e-4);
float x = d2 / (a.w * a.w);
float win = 1.0 - x * x;
win *= win;
float att = win / (d2 + d.x * d.x + 0.25);
if(type > 0.5) att *= smoothstep(c.w, d.w, dot(- Ldir, c.xyz)); // spot cone
if(d.y > 0.5 && att > 0.0) att *= cityLShadow(int(d.y) - 1, wp, dist, a.w); // (night) real-time shadow slot
widen = d.x / (2.0 * dist + 0.5);
specK = d.z;
{ // sphere light: the point of the sphere closest to the reflection ray (Karis 2013). d.x is a softness radius for the
// diffuse near field (headlights 3.5 m, neon ~1 m); the real emitters (lamp heads, bulbs, tubes) are small: <= 0.25 m
float rs = min(d.x, 0.25);
cityLAng = min(1.0, rs / (dist + 0.25));
vec3 ctr = dot(L, cityLRefl) * cityLRefl - L;
cityLSpecDir = normalize(L + ctr * clamp(rs / max(length(ctr), 1e-4), 0.0, 1.0));
}
return b.rgb * att;
}
vec3 cityLIncident(int li, vec3 wp, out vec3 Ldir, out float widen) {
float specK;
return cityLIncident2(li, wp, Ldir, widen, specK);
}
// light list of the grid cell holding wp: returns the count (0: outside the grid / above every light in the cell)
int cityLCell(vec3 wp, out int bx, out int by, out uvec4 h0) {
#ifdef CITYL_UNIF
bx = 0;
by = 0;
h0 = uvec4(0u);
return cityL.origin.w > 0.0 ? int(cityLU[__SHADER_INJECT_5__].x) : 0;
#else
vec2 cg = (wp.xz - cityL.origin.xy) / cityL.origin.z;
#ifndef CITYL_NODITHER
{ // (night r9) dithered cell lookup (+-0.3 cell, rotating per frame): where neighbouring cells' lists differ (slot overflow, far LOD) the
// boundary is a TAA-resolved blend instead of a straight edge
vec2 q = gl_FragCoord.xy + cityL.misc.y * 7.13;
cg += (vec2(fract(52.9829189 * fract(dot(q, vec2(0.06711056, 0.00583715)))), fract(52.9829189 * fract(dot(q.yx, vec2(0.06711056, 0.00583715))))) - 0.5) * 0.6;
}
#endif
bx = 0;
by = 0;
h0 = uvec4(0u);
if(cityL.origin.w <= 0.0 || any(lessThan(cg, vec2(0.0))) || any(greaterThanEqual(cg, vec2(float(__SHADER_INJECT_6__))))) return 0;
ivec2 cc = ivec2(cg);
bx = cc.x * __SHADER_INJECT_7__;
by = cc.y + (wp.y >= float(__SHADER_INJECT_8__) ? __SHADER_INJECT_9__ : 0); // height layer
h0 = texelFetch(cityL.grid, ivec2(bx, by), 0);
if(wp.y > float(h0.y) - 1000.0) return 0;
return int(h0.x);
#endif
}
int cityLIndex(int i, int bx, int by, uvec4 h0) {
#ifdef CITYL_UNIF
return i;
#else
if(i < 2) return int(i == 0 ? h0.z : h0.w);
uvec4 hh = texelFetch(cityL.grid, ivec2(bx + 1 + (i - 2) / 4, by), 0);
return int(hh[(i - 2) & 3]);
#endif
}
// fade toward the grid border (lights hand over to the far-field city glow in surface.ts)
float cityLEdge(vec3 wp) {
vec2 q = abs((wp.xz - cityL.origin.xy) / (cityL.origin.z * float(__SHADER_INJECT_10__)) * 2.0 - 1.0);
return 1.0 - smoothstep(0.8, 0.98, max(q.x, q.y));
}
// diffuse irradiance (Lambert, N.L) for custom shaders (trees, crowd): multiply by albedo / PI
vec3 cityLightIrradiance(vec3 wp, vec3 wn) {
int bx, by;
uvec4 h0;
int n = cityLCell(wp, bx, by, h0);
vec3 E = vec3(0.0);
for(int i = 0;
i < __SHADER_INJECT_11__;
i ++) {
if(i >= n) break;
vec3 Ld;
float wd;
vec3 c = cityLIncident(cityLIndex(i, bx, by, h0), wp, Ld, wd);
E += c * max(dot(wn, Ld), 0.0);
}
return E * cityL.misc.x * cityLEdge(wp);
}
#endif
#endif

// @section applyLights

#if defined( USE_CITYL ) && defined( RE_Direct )
if(cityL.origin.w > 0.0) {
vec3 clWP = cameraPosition + geometryPosition * mat3(viewMatrix);
int clBx, clBy;
uvec4 clH0;
int clN = cityLCell(clWP, clBx, clBy, clH0);
if(clN > 0) {
#if defined( STANDARD ) && !( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
material.multiScatteringCompensation = vec3(1.0);
#endif
#if defined( STANDARD ) && !defined( USE_CLEARCOAT ) && !defined( USE_SHEEN ) && !defined( USE_IRIDESCENCE ) && !defined( USE_ANISOTROPY )
#define CL_FAST
#endif
float clK = cityL.misc.x * cityLEdge(clWP);
mat3 clVM = mat3(viewMatrix);
vec3 clE = vec3(0.0);
cityLRefl = normalize(reflect(- geometryViewDir, geometryNormal) * clVM); // world-space reflection ray (spec representative point)
#ifdef CL_FAST
bool clSpec = material.roughness < 0.75;
#ifdef CITYL_NOSPEC
clSpec = false; // (night r11) material opt-out (LED screens: matte louvred panels; a neighbour's light smeared a long glossy streak across the TS perch screen)
#endif
float clR = material.roughness, clRorig = material.roughness;
{ // (night r10) specular anti-aliasing for the local lights: normal-map detail (asphalt aggregate) under a lamp or
// headlight broke into glitter; widen the lobe by the screen-space normal variation (flat puddles keep their mirror)
vec3 clDn = fwidth(geometryNormal);
float clV = dot(clDn, clDn);
clR = min(1.0, sqrt(clR * clR + 0.6 * clV));
}
#endif
// (perf) lights are sorted strongest first: far surfaces and alpha-tested foliage only take the dominant ones
int clMax = clN;
#if defined( USE_ALPHATEST ) || defined( USE_ALPHAHASH )
clMax = min(clMax, 6);
#endif
clMax = min(clMax, int(mix(float(__SHADER_INJECT_0__), 8.0, smoothstep(30.0, 160.0, length(geometryPosition))))); // (perf r5) screens + signs raised TS to ~870 lights
for(int i = 0;
i < __SHADER_INJECT_1__;
i ++) {
if(i >= clMax) break;
vec3 clL;
float clWd;
float clSk;
vec3 clC = cityLIncident2(cityLIndex(i, clBx, clBy, clH0), clWP, clL, clWd, clSk);
if(clC.r + clC.g + clC.b <= 1e-5) continue;
vec3 clLv = normalize(clVM * clL);
#ifdef CL_FAST
float clNL = saturate((dot(geometryNormal, clLv) + clWd) / (1.0 + clWd)); // (night r9) wrap by the source's angular size: big screens light faces at grazing angles softly (no crisp reveal edges)
#if defined( USE_ALPHATEST ) && defined( DOUBLE_SIDED )
{ // (night r9) foliage (alpha-tested, double-sided leaf cards): leaves transmit and scatter light, so a lamp lights a
// canopy as a soft glowing volume, not leaf-by-leaf cut-outs (the blotchy 'grid-like' texture around lamp heads)
float clNd = dot(geometryNormal, clLv);
clNL = 0.22 + 0.55 * saturate(clNd) + 0.28 * saturate(- clNd); // front lit + light transmitted from behind
// leaves a metre from a lamp head would be 30x the pool below and clip in patches: smooth compression
clC *= 1.1 / (1.1 + max(clC.r, max(clC.g, clC.b)));
}
#endif
if(clNL <= 0.0) continue;
vec3 clIrr = clC * (clK * clNL);
clE += clIrr;
if(clSpec) { // (night r10) representative point along the reflection ray + energy normalisation (a / a')^2 (Karis 2013):
// a mirror-like surface shows the emitter's shape at its real brightness instead of a clipped disc
vec3 clLs = normalize(clVM * cityLSpecDir);
float clNLs = saturate(dot(geometryNormal, clLs));
float clA = clR * clR, clA2 = min(1.0, clA + 0.5 * cityLAng), clNorm = (clA * clA) / max(clA2 * clA2, 1e-8);
material.roughness = clR;
reflectedLight.directSpecular += clC * (clK * clNLs * clSk * clNorm) * BRDF_GGX(clLs, geometryViewDir, geometryNormal, material) * material.multiScatteringCompensation;
}
#else
IncidentLight clI;
clI.direction = clLv;
clI.color = clC * clK;
clI.visible = true;
#ifdef STANDARD
float clR0 = material.roughness;
material.roughness = min(1.0, clR0 + clWd);
RE_Direct(clI, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
material.roughness = clR0;
#else
RE_Direct(clI, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
#endif
#endif
}
#ifdef CL_FAST
material.roughness = clRorig;
reflectedLight.directDiffuse += clE * BRDF_Lambert(material.diffuseContribution) * (1.0 - material.specularColorBlended * 0.5);
#undef CL_FAST
#endif
}
}
#endif

// @section enableDirective
#define USE_CITYL
