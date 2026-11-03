import{$r as e,Ht as t,Qi as n,Rt as r,U as i,Yt as a,_r as o,cr as s,do as c,ei as l,fa as u,ft as d,io as f,ir as p,kr as ee,ro as m,to as h,tr as g,zi as te}from"./three~index~combat~screenshotPresets~gameSystems~GLTFLoader-BF58tRDi.js";import{n as _,r as v}from"./three~index~screenshotPresets~gameSystems-BymyXT8A.js";import{i as ne}from"./vehicleLighting-CSwID43I.js";function y(e,...t){let n=e;for(let e=0;e<t.length;e++)n=n.replaceAll(`__SHADER_INJECT_${e}__`,String(t[e]));return n}function b(e){if(typeof e!=`string`)throw TypeError(`Shader source is missing; check that the GLSL ?raw import resolves to a string.`);let t=[...e.matchAll(/^\/\/ @section ([A-Za-z][A-Za-z0-9_]*)\r?$/gm)],n=Object.create(null);for(let r=0;r<t.length;r+=1){let i=t[r];if(!i||i.index===void 0)throw Error(`Invalid GLSL section marker.`);let a=i[0],o=i[1];if(!a||!o||Object.hasOwn(n,o))throw Error(`Duplicate or invalid GLSL section name: ${o??`<empty>`}`);let s=i.index+a.length,c=t[r+1]?.index??e.length;n[o]=e.slice(s,c).replace(/^\r?\n/,``)}if(t.length===0)throw Error("Combined GLSL file has no `// @section name` markers.");return n}function re(e){let t;return new Proxy(Object.create(null),{get(n,r,i){return typeof r==`string`?(t??=b(e()),t[r]):Reflect.get(n,r,i)}})}var ie=`// citylights shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexBeginVertex\r
#include <begin_vertex>\r
#ifdef USE_INSTANCING\r
transformed -= normalize(normal) * 0.2;\r
#endif\r
\r
// @section lightDeclarations\r
\r
// (r11) fallbacks set per material by fixPrograms() on GPUs with 16 fragment texture units (Apple / ANGLE D3D11):\r
// CITYL_NOSH drops the shadow-map sampler, CITYL_OFF the city lights entirely (the program would not link)\r
#ifdef CITYL_OFF\r
#undef USE_CITYL\r
#endif\r
// (r13) CITYL_UNIF: no city-light textures at all: the CL_UN lights that light the player most arrive as a uniform array\r
// (cityLU, same 4-texel records; count in cityLU[ CL_UN * 4 ].x). For materials that are over the unit limit even without\r
// the shadow sampler (the suit on the Mac: 16 of its own), so Spider-Man is still lit by the lamps / cars / screens\r
#ifdef CITYL_UNIF\r
#define CITYL_NOSH\r
#endif\r
#ifdef USE_CITYL\r
#ifndef CITYL_PARS\r
#define CITYL_PARS\r
#ifdef CITYL_UNIF\r
struct CityL {\r
vec4 origin;\r
vec4 misc;\r
mat4 shM[__SHADER_INJECT_0__];\r
vec4 shW;\r
};\r
uniform vec4 cityLU[__SHADER_INJECT_1__];\r
#elif defined( CITYL_NOSH )\r
struct CityL {\r
sampler2D data;\r
highp usampler2D grid;\r
vec4 origin;\r
vec4 misc;\r
mat4 shM[__SHADER_INJECT_2__];\r
vec4 shW;\r
};\r
#else\r
struct CityL {\r
sampler2D data;\r
highp usampler2D grid;\r
vec4 origin;\r
vec4 misc;\r
mat4 shM[__SHADER_INJECT_3__];\r
sampler2D shMap;\r
vec4 shW;\r
};\r
#endif\r
uniform CityL cityL;\r
#ifdef CITYL_UNIF\r
vec4 cityLTex(int li, int k) {\r
return cityLU[li * 4 + k];\r
}\r
#else\r
vec4 cityLTex(int li, int k) {\r
return texelFetch(cityL.data, ivec2((li & 255) * 4 + k, li >> 8), 0);\r
}\r
#endif\r
// shadow of slot s at wp (dist: distance to the light, range: its range): 3x3 PCF of the distance map, faded by shW\r
float cityLShadow(int s, vec3 wp, float dist, float range) {\r
#ifdef CITYL_NOSH\r
return 1.0;\r
#else\r
vec4 cp = cityL.shM[s] * vec4(wp, 1.0);\r
if(cp.w <= 0.0) return 1.0;\r
vec2 uv = cp.xy / cp.w * 0.5 + 0.5;\r
if(any(lessThan(uv, vec2(0.004))) || any(greaterThan(uv, vec2(0.996)))) return 1.0;\r
vec2 tile = vec2(float(s & 1), float(s >> 1)) * 0.5;\r
vec2 tuv = tile + uv * 0.5;\r
const float tx = 1.0 / float(__SHADER_INJECT_4__);\r
float fd = dist / range - (0.05 + dist * 0.02) / range; // receiver bias grows with the texel footprint\r
float vis = 0.0;\r
// 3x3 taps on a rotated grid (breaks up texel stair-steps), footprint ~2.5 texels\r
const mat2 R = mat2(0.866, 0.5, - 0.5, 0.866);\r
for(int j = - 1;\r
j <= 1;\r
j ++) for(int i = - 1;\r
i <= 1;\r
i ++) {\r
vec2 q = clamp(tuv + R * vec2(float(i), float(j)) * tx * 1.25, tile + tx, tile + 0.5 - tx);\r
vis += step(fd, textureLod(cityL.shMap, q, 0.0).r);\r
}\r
float w = s == 0 ? cityL.shW.x : s == 1 ? cityL.shW.y : s == 2 ? cityL.shW.z : cityL.shW.w;\r
return mix(1.0, vis / 9.0, w);\r
#endif\r
}\r
// incident light of city light li at world point wp: returns the colour (0 if none), world direction to the light and\r
// the source-size roughness widening\r
// (night r10) specular representative point (Karis 2013): cityLSpecDir = direction to the point of the emitter closest to\r
// the reflection ray cityLRefl (set by the caller, world space; zero = unused), cityLAng = the emitter's angular size\r
// (for the energy normalisation (a / a')^2 in the caller)\r
vec3 cityLRefl = vec3(0.0), cityLSpecDir = vec3(0.0, 1.0, 0.0);\r
float cityLAng = 0.0;\r
vec3 cityLIncident2(int li, vec3 wp, out vec3 Ldir, out float widen, out float specK) {\r
vec4 a = cityLTex(li, 0);\r
Ldir = vec3(0.0, 1.0, 0.0);\r
widen = 0.0;\r
specK = 1.0;\r
cityLAng = 0.0;\r
vec3 lp = a.xyz, L0 = lp - wp;\r
float dc2 = dot(L0, L0);\r
if(dc2 > a.w * a.w) return vec3(0.0); // out of range (rects: a.w = range + half diagonal, from the centre): skip the other 3 fetches\r
vec4 b = cityLTex(li, 1), c = cityLTex(li, 2), d = cityLTex(li, 3);\r
float type = floor(b.w);\r
if(type > 1.5) { // rect emitter (screen / lit window): representative point = closest point of the rectangle\r
vec3 rel = wp - lp;\r
float side = dot(rel, c.xyz);\r
if(side <= 0.02) return vec3(0.0);\r
vec3 v = cross(c.xyz, d.xyz);\r
float du = clamp(dot(rel, d.xyz), - c.w, c.w), dv = clamp(dot(rel, v), - d.w, d.w);\r
vec3 L = lp + d.xyz * du + v * dv - wp;\r
float d2 = dot(L, L);\r
float dist = sqrt(d2);\r
Ldir = L / max(dist, 1e-4);\r
float area = 4.0 * c.w * d.w;\r
float cosE = mix(side / max(length(rel), 1e-3), max(dot(c.xyz, - Ldir), 0.0), 0.6); // emitter cosine: centre (smooth) blended with the closest point (floors / ledges at the foot of a big screen get their light)\r
float win = 1.0 - dc2 / (a.w * a.w);\r
win *= win;\r
widen = min(0.15, min(c.w, d.w) / (2.0 * dist + 0.5)); // (night r10) wrap capped at 0.15: near big screens it lit faces turned away evenly (flat, self-lit look)\r
cityLSpecDir = Ldir;\r
cityLAng = min(1.0, sqrt(area) / (dist + 0.5));\r
float rn = dot(cityLRefl, c.xyz);\r
if(rn < - 1e-3) { // the reflection ray heads toward the emitter's lit face: its hit point on the plane, clamped into the rect\r
float t = dot(lp - wp, c.xyz) / rn;\r
if(t > 0.0) {\r
vec3 h = wp + cityLRefl * t - lp;\r
vec3 hp = lp + d.xyz * clamp(dot(h, d.xyz), - c.w, c.w) + v * clamp(dot(h, v), - d.w, d.w) - wp;\r
cityLSpecDir = normalize(hp);\r
}\r
}\r
return b.rgb * (area * cosE / (d2 + area * 0.3183)) * win;\r
}\r
vec3 L = L0;\r
float d2 = dc2;\r
float dist = sqrt(d2);\r
Ldir = L / max(dist, 1e-4);\r
float x = d2 / (a.w * a.w);\r
float win = 1.0 - x * x;\r
win *= win;\r
float att = win / (d2 + d.x * d.x + 0.25);\r
if(type > 0.5) att *= smoothstep(c.w, d.w, dot(- Ldir, c.xyz)); // spot cone\r
if(d.y > 0.5 && att > 0.0) att *= cityLShadow(int(d.y) - 1, wp, dist, a.w); // (night) real-time shadow slot\r
widen = d.x / (2.0 * dist + 0.5);\r
specK = d.z;\r
{ // sphere light: the point of the sphere closest to the reflection ray (Karis 2013). d.x is a softness radius for the\r
// diffuse near field (headlights 3.5 m, neon ~1 m); the real emitters (lamp heads, bulbs, tubes) are small: <= 0.25 m\r
float rs = min(d.x, 0.25);\r
cityLAng = min(1.0, rs / (dist + 0.25));\r
vec3 ctr = dot(L, cityLRefl) * cityLRefl - L;\r
cityLSpecDir = normalize(L + ctr * clamp(rs / max(length(ctr), 1e-4), 0.0, 1.0));\r
}\r
return b.rgb * att;\r
}\r
vec3 cityLIncident(int li, vec3 wp, out vec3 Ldir, out float widen) {\r
float specK;\r
return cityLIncident2(li, wp, Ldir, widen, specK);\r
}\r
// light list of the grid cell holding wp: returns the count (0: outside the grid / above every light in the cell)\r
int cityLCell(vec3 wp, out int bx, out int by, out uvec4 h0) {\r
#ifdef CITYL_UNIF\r
bx = 0;\r
by = 0;\r
h0 = uvec4(0u);\r
return cityL.origin.w > 0.0 ? int(cityLU[__SHADER_INJECT_5__].x) : 0;\r
#else\r
vec2 cg = (wp.xz - cityL.origin.xy) / cityL.origin.z;\r
#ifndef CITYL_NODITHER\r
{ // (night r9) dithered cell lookup (+-0.3 cell, rotating per frame): where neighbouring cells' lists differ (slot overflow, far LOD) the\r
// boundary is a TAA-resolved blend instead of a straight edge\r
vec2 q = gl_FragCoord.xy + cityL.misc.y * 7.13;\r
cg += (vec2(fract(52.9829189 * fract(dot(q, vec2(0.06711056, 0.00583715)))), fract(52.9829189 * fract(dot(q.yx, vec2(0.06711056, 0.00583715))))) - 0.5) * 0.6;\r
}\r
#endif\r
bx = 0;\r
by = 0;\r
h0 = uvec4(0u);\r
if(cityL.origin.w <= 0.0 || any(lessThan(cg, vec2(0.0))) || any(greaterThanEqual(cg, vec2(float(__SHADER_INJECT_6__))))) return 0;\r
ivec2 cc = ivec2(cg);\r
bx = cc.x * __SHADER_INJECT_7__;\r
by = cc.y + (wp.y >= float(__SHADER_INJECT_8__) ? __SHADER_INJECT_9__ : 0); // height layer\r
h0 = texelFetch(cityL.grid, ivec2(bx, by), 0);\r
if(wp.y > float(h0.y) - 1000.0) return 0;\r
return int(h0.x);\r
#endif\r
}\r
int cityLIndex(int i, int bx, int by, uvec4 h0) {\r
#ifdef CITYL_UNIF\r
return i;\r
#else\r
if(i < 2) return int(i == 0 ? h0.z : h0.w);\r
uvec4 hh = texelFetch(cityL.grid, ivec2(bx + 1 + (i - 2) / 4, by), 0);\r
return int(hh[(i - 2) & 3]);\r
#endif\r
}\r
// fade toward the grid border (lights hand over to the far-field city glow in surface.ts)\r
float cityLEdge(vec3 wp) {\r
vec2 q = abs((wp.xz - cityL.origin.xy) / (cityL.origin.z * float(__SHADER_INJECT_10__)) * 2.0 - 1.0);\r
return 1.0 - smoothstep(0.8, 0.98, max(q.x, q.y));\r
}\r
// diffuse irradiance (Lambert, N.L) for custom shaders (trees, crowd): multiply by albedo / PI\r
vec3 cityLightIrradiance(vec3 wp, vec3 wn) {\r
int bx, by;\r
uvec4 h0;\r
int n = cityLCell(wp, bx, by, h0);\r
vec3 E = vec3(0.0);\r
for(int i = 0;\r
i < __SHADER_INJECT_11__;\r
i ++) {\r
if(i >= n) break;\r
vec3 Ld;\r
float wd;\r
vec3 c = cityLIncident(cityLIndex(i, bx, by, h0), wp, Ld, wd);\r
E += c * max(dot(wn, Ld), 0.0);\r
}\r
return E * cityL.misc.x * cityLEdge(wp);\r
}\r
#endif\r
#endif\r
\r
// @section applyLights\r
\r
#if defined( USE_CITYL ) && defined( RE_Direct )\r
if(cityL.origin.w > 0.0) {\r
vec3 clWP = cameraPosition + geometryPosition * mat3(viewMatrix);\r
int clBx, clBy;\r
uvec4 clH0;\r
int clN = cityLCell(clWP, clBx, clBy, clH0);\r
if(clN > 0) {\r
#if defined( STANDARD ) && !( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )\r
material.multiScatteringCompensation = vec3(1.0);\r
#endif\r
#if defined( STANDARD ) && !defined( USE_CLEARCOAT ) && !defined( USE_SHEEN ) && !defined( USE_IRIDESCENCE ) && !defined( USE_ANISOTROPY )\r
#define CL_FAST\r
#endif\r
float clK = cityL.misc.x * cityLEdge(clWP);\r
mat3 clVM = mat3(viewMatrix);\r
vec3 clE = vec3(0.0);\r
cityLRefl = normalize(reflect(- geometryViewDir, geometryNormal) * clVM); // world-space reflection ray (spec representative point)\r
#ifdef CL_FAST\r
bool clSpec = material.roughness < 0.75;\r
#ifdef CITYL_NOSPEC\r
clSpec = false; // (night r11) material opt-out (LED screens: matte louvred panels; a neighbour's light smeared a long glossy streak across the TS perch screen)\r
#endif\r
float clR = material.roughness, clRorig = material.roughness;\r
{ // (night r10) specular anti-aliasing for the local lights: normal-map detail (asphalt aggregate) under a lamp or\r
// headlight broke into glitter; widen the lobe by the screen-space normal variation (flat puddles keep their mirror)\r
vec3 clDn = fwidth(geometryNormal);\r
float clV = dot(clDn, clDn);\r
clR = min(1.0, sqrt(clR * clR + 0.6 * clV));\r
}\r
#endif\r
// (perf) lights are sorted strongest first: far surfaces and alpha-tested foliage only take the dominant ones\r
int clMax = clN;\r
#if defined( USE_ALPHATEST ) || defined( USE_ALPHAHASH )\r
clMax = min(clMax, 6);\r
#endif\r
clMax = min(clMax, int(mix(float(__SHADER_INJECT_0__), 8.0, smoothstep(30.0, 160.0, length(geometryPosition))))); // (perf r5) screens + signs raised TS to ~870 lights\r
for(int i = 0;\r
i < __SHADER_INJECT_1__;\r
i ++) {\r
if(i >= clMax) break;\r
vec3 clL;\r
float clWd;\r
float clSk;\r
vec3 clC = cityLIncident2(cityLIndex(i, clBx, clBy, clH0), clWP, clL, clWd, clSk);\r
if(clC.r + clC.g + clC.b <= 1e-5) continue;\r
vec3 clLv = normalize(clVM * clL);\r
#ifdef CL_FAST\r
float clNL = saturate((dot(geometryNormal, clLv) + clWd) / (1.0 + clWd)); // (night r9) wrap by the source's angular size: big screens light faces at grazing angles softly (no crisp reveal edges)\r
#if defined( USE_ALPHATEST ) && defined( DOUBLE_SIDED )\r
{ // (night r9) foliage (alpha-tested, double-sided leaf cards): leaves transmit and scatter light, so a lamp lights a\r
// canopy as a soft glowing volume, not leaf-by-leaf cut-outs (the blotchy 'grid-like' texture around lamp heads)\r
float clNd = dot(geometryNormal, clLv);\r
clNL = 0.22 + 0.55 * saturate(clNd) + 0.28 * saturate(- clNd); // front lit + light transmitted from behind\r
// leaves a metre from a lamp head would be 30x the pool below and clip in patches: smooth compression\r
clC *= 1.1 / (1.1 + max(clC.r, max(clC.g, clC.b)));\r
}\r
#endif\r
if(clNL <= 0.0) continue;\r
vec3 clIrr = clC * (clK * clNL);\r
clE += clIrr;\r
if(clSpec) { // (night r10) representative point along the reflection ray + energy normalisation (a / a')^2 (Karis 2013):\r
// a mirror-like surface shows the emitter's shape at its real brightness instead of a clipped disc\r
vec3 clLs = normalize(clVM * cityLSpecDir);\r
float clNLs = saturate(dot(geometryNormal, clLs));\r
float clA = clR * clR, clA2 = min(1.0, clA + 0.5 * cityLAng), clNorm = (clA * clA) / max(clA2 * clA2, 1e-8);\r
material.roughness = clR;\r
reflectedLight.directSpecular += clC * (clK * clNLs * clSk * clNorm) * BRDF_GGX(clLs, geometryViewDir, geometryNormal, material) * material.multiScatteringCompensation;\r
}\r
#else\r
IncidentLight clI;\r
clI.direction = clLv;\r
clI.color = clC * clK;\r
clI.visible = true;\r
#ifdef STANDARD\r
float clR0 = material.roughness;\r
material.roughness = min(1.0, clR0 + clWd);\r
RE_Direct(clI, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);\r
material.roughness = clR0;\r
#else\r
RE_Direct(clI, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);\r
#endif\r
#endif\r
}\r
#ifdef CL_FAST\r
material.roughness = clRorig;\r
reflectedLight.directDiffuse += clE * BRDF_Lambert(material.diffuseContribution) * (1.0 - material.specularColorBlended * 0.5);\r
#undef CL_FAST\r
#endif\r
}\r
}\r
#endif\r
\r
// @section enableDirective\r
#define USE_CITYL\r
`,x=re(()=>ie),ae=2048,S=512,oe=new Float32Array(260),se=!1,ce=new Float32Array(ae*16),C=new d(ce,1024,ae/256,e,r);C.minFilter=C.magFilter=o,C.generateMipmaps=!1,C.needsUpdate=!0;var le=new Uint16Array(229376),w=new d(le,448,128,l,h);w.internalFormat=`RGBA16UI`,w.minFilter=w.magFilter=o,w.generateMipmaps=!1,w.needsUpdate=!0;var T=1024,E=new c(T*2,T*2,{type:a,format:te,minFilter:o,magFilter:o,depthBuffer:!0,generateMipmaps:!1});E.texture.name=`cityLightShadows`;var D={data:C,grid:w,origin:new f(0,0,8,0),misc:new f(1,0,0,0),shM:Array.from({length:4},()=>new p),shMap:E.texture,shW:new f},ue=y(x.lightDeclarations,4,65,4,4,T*2,64,64,7,14,64,64,26),de=y(x.applyLights,26,26),fe=ue,O=null,pe=null,me=-1,he=0,ge=new WeakSet;function _e(){let e=O?.info.programs;if(!e||e.length===me&&++he%10)return;me=e.length;let t=new Set(e.filter(e=>e.diagnostics&&!e.diagnostics.runnable&&!ge.has(e)));if(!t.size)return;t.forEach(e=>ge.add(e));let n=new Set;pe.traverse(e=>{for(let r of Array.isArray(e.material)?e.material:e.material?[e.material]:[]){if(n.has(r)||r.isShaderMaterial)continue;let e=O.properties.get(r);if(!t.has(e.currentProgram)&&!(e.programs&&[...e.programs.values()].some(e=>t.has(e))))continue;n.add(r);let i=r.defines||={};if(!(`CITYL_NOSH`in i))i.CITYL_NOSH=``;else if(!(`CITYL_UNIF`in i))i.CITYL_UNIF=``,se=!0;else if(!(`CITYL_OFF`in i))i.CITYL_OFF=``;else continue;r.needsUpdate=!0,console.warn(`[citylights] ${r.name||r.type}: program failed to link, retry with ${`CITYL_OFF`in i?`no city lights`:`CITYL_UNIF`in i?`the 16 lights nearest the player (no textures)`:`no city-light shadows`}`)}})}var ve=!1;function ye(e=null,t=null){if(O=e,pe=t,ve)return;ve=!0;let n=O?.capabilities?.maxTextures<=16;n&&(se=!0,P.shadows=!1);try{let e=new URLSearchParams(location.search);e.has(`nocl`)&&(P.enabled=!1),e.has(`noclsh`)&&(P.shadows=!1),e.has(`noclvol`)&&(P.volume=0)}catch{}let r=_;r.lights_pars_begin.includes(`CITYL_PARS`)||(r.lights_pars_begin=r.lights_pars_begin+(n?`
#define CITYL_UNIF
`:``)+ue);let i=r.lights_fragment_begin,a=i.indexOf(`#if defined( RE_IndirectDiffuse )`);if(a<0)console.error(`[citylights] could not patch lights_fragment_begin`);else{i.includes(`clWP`)||(r.lights_fragment_begin=i.slice(0,a)+de+i.slice(a));for(let e of[`standard`,`physical`,`lambert`,`phong`,`toon`]){let t=v[e];t&&(t.uniforms.cityL={value:D},t.uniforms.cityLU={value:oe},t.fragmentShader.startsWith(x.enableDirective)||(t.fragmentShader=x.enableDirective+t.fragmentShader))}}}var be={point:0,spot:1,rect:2},k=new i,A=64,j=[],M=new Map,N=[],xe=(e,t)=>(e+4096)*8192+(t+4096);function Se(e,t){return e&&(Array.isArray(e)?(t[0]=e[0],t[1]=e[1],t[2]=e[2]):(t[0]=e.x,t[1]=e.y,t[2]=e.z)),t}function Ce(e,t={}){t.type=be[e.type??`point`]??0,t.p=Se(e.pos,t.p||[0,0,0]),e.color==null?k.setRGB(1,1,1):Array.isArray(e.color)?k.setRGB(e.color[0],e.color[1],e.color[2],n):e.color.isColor?k.copy(e.color):k.set(e.color);let r=e.intensity??1;t.c=[k.r*r,k.g*r,k.b*r],t.lum=(k.r*.2126+k.g*.7152+k.b*.0722)*r,t.range=e.range??20,t.d=Se(e.dir,t.d||[0,-1,0]);{let e=Math.hypot(t.d[0],t.d[1],t.d[2])||1;t.d[0]/=e,t.d[1]/=e,t.d[2]/=e}t.u=Se(e.u,t.u||[1,0,0]);{let e=Math.hypot(t.u[0],t.u[1],t.u[2])||1;t.u[0]/=e,t.u[1]/=e,t.u[2]/=e}let i=e.angle??.9,a=e.penumbra??.4;return t.cosO=Math.cos(i),t.cosI=Math.cos(i*(1-a)),t.hw=(e.width??1)/2,t.hh=(e.height??1)/2,t.radius=e.radius??.2,t.spec=Math.max(0,Math.min(1,e.spec??1)),t.hcos=t.type===1&&Math.abs(t.d[1])<.7?Math.cos(Math.min(Math.PI,Math.acos(Math.max(-1,Math.min(1,t.cosO)))+.35)):-2,t.rEff=t.type===2?t.range+Math.hypot(t.hw,t.hh):t.range,t.vol=Math.min(.99,Math.max(0,e.volume??.5)),t.day=!!e.day,t.key=e.key??null,t.shSlot=0,t.noShadow=e.shadow===!1,t.type===2&&(t.lum*=4*t.hw*t.hh),t.top=t.type===1&&t.d[1]<-.5?t.p[1]+.6:t.type===2?t.p[1]+t.hh+t.range:t.type===1?t.p[1]+t.range*Math.max(.05,Math.sin(Math.asin(Math.max(-1,Math.min(1,t.d[1])))+Math.acos(Math.max(-1,Math.min(1,t.cosO))))):t.p[1]+t.range,t.bot=t.type===2?t.p[1]-t.hh-t.range:t.p[1]-t.range,t}var P={enabled:!0,gain:1,volume:1,incremental:!0,stats:{lights:0,cand:0,cells:0,maxCell:0,ms:0},add(e){let t=Ce(e);t.id=j.length,j.push(t),L++;let n=xe(Math.floor(t.p[0]/A),Math.floor(t.p[2]/A)),r=M.get(n);return r||M.set(n,r=[]),r.push(t),t.bk=n,t.id},update(e,t){let n=j[e];if(!n)return;let r={...n.src,...t};n.src=r,L++;let i=n.bk;Ce(r,n);let a=xe(Math.floor(n.p[0]/A),Math.floor(n.p[2]/A));if(a!==i){let e=M.get(i);e?.splice(e.indexOf(n),1);let t=M.get(a);t||M.set(a,t=[]),t.push(n),n.bk=a}},remove(e){let t=j[e];if(!t)return;let n=M.get(t.bk);if(n){let e=n.indexOf(t);e>=0&&n.splice(e,1)}j[e]=null,L++},addProvider(e,t={}){let n={fn:e,moving:!!t.moving};return N.push(n),L++,()=>{let e=N.indexOf(n);e>=0&&N.splice(e,1),L++}},invalidate(){L++},get count(){return j.reduce((e,t)=>e+ +!!t,0)},frame:null,get ambient(){return q}};{let e=P.add;P.add=function(t){let n=e.call(this,t);return j[n].src={...t},n}}var F=[],I=0,L=0,we=-1,Te=-1,Ee=99,De=new m(1e9,0,0),Oe=new m,ke=new m,Ae=new Set,je=new Map,R={};function Me(e){Ce(e,F[I]||(F[I]={})),I++}var z=[],B=8192,Ne=new Uint8Array(B),Pe=new Uint16Array(B*26),V=new Float32Array(B*26),Fe=new Float32Array(B),Ie=new Float32Array(B),Le=new Uint8Array(B);function Re(e){let t=e*26,n=0,r=V[t];for(let e=1;e<26;e++){let i=V[t+e];i<r&&(r=i,n=e)}Ie[e]=r,Le[e]=n}var H=new Uint8Array(26),U=new m,ze=new t,Be=new p,Ve=new u;function He(e,t,n){let r=ce,i=e*16,a=t.day?1:n;r[i]=t.p[0],r[i+1]=t.p[1],r[i+2]=t.p[2],r[i+3]=t.rEff,r[i+4]=t.c[0]*a,r[i+5]=t.c[1]*a,r[i+6]=t.c[2]*a,r[i+7]=t.type+t.vol,r[i+8]=t.d[0],r[i+9]=t.d[1],r[i+10]=t.d[2],t.type===2?(r[i+11]=t.hw,r[i+12]=t.u[0],r[i+13]=t.u[1],r[i+14]=t.u[2],r[i+15]=t.hh):(r[i+11]=t.cosO,r[i+12]=t.radius,r[i+13]=t.shSlot,r[i+14]=t.spec,r[i+15]=t.cosI)}var W=!0,Ue=e=>{if(!W)return;let t=e.key;if(t==null||!Ae.has(t)){W=!1;return}let n=je.get(t);if(n===void 0)return;Ce(e,R);let r=z[n];r.p[0]=R.p[0],r.p[1]=R.p[1],r.p[2]=R.p[2],r.d[0]=R.d[0],r.d[1]=R.d[1],r.d[2]=R.d[2],r.c[0]=R.c[0],r.c[1]=R.c[1],r.c[2]=R.c[2],He(n,r,Te)};function We(e,t){W=!0;for(let t of N)if(t.moving){try{t.fn(Ue,e)}catch{W=!1}if(!W)return!1}at(e,t);for(let e=0;e<z.length;e++){let t=z[e];t.type===1&&(ce[e*16+13]=t.shSlot)}return C.needsUpdate=!0,!0}var G=new m,Ge=new Int32Array(16),K=new Float32Array(16);function Ke(e){let t=typeof window<`u`?window.__ctx?.player?.object:null;t?t.getWorldPosition(G):G.copy(e.position),G.y+=1;let n=0,r=D.misc.z,i=ce;for(let e=0;e<r;e++){let t=e*16,r=i[t]-G.x,a=i[t+1]-G.y,o=i[t+2]-G.z,s=r*r+a*a+o*o,c=i[t+3]+1.5;if(s>c*c)continue;let l=i[t+4]*.3+i[t+5]*.55+i[t+6]*.15,u=(i[t+7]>=2?l*4*i[t+11]*i[t+15]:l)/(s+1);if(n<16){Ge[n]=e,K[n++]=u;continue}let d=0;for(let e=1;e<16;e++)K[e]<K[d]&&(d=e);u>K[d]&&(Ge[d]=e,K[d]=u)}for(let e=0;e<n;e++)oe.set(i.subarray(Ge[e]*16,Ge[e]*16+16),e*16);oe[256]=n}var qe=.16,q={lo:{value:new m},hi:{value:new m},gain:1},J=new m,Y=new m,X=new m,Je=0;function Ye(e,t){let n=e.p[0]-J.x,r=e.p[1]-J.y,i=e.p[2]-J.z,a=n*n+r*r+i*i,o=Math.min(70,Math.max(25,e.rEff*2.5));if(a>o*o)return;let s=Math.sqrt(a),c=1-g.smoothstep(s,.55*o,o),l=(e.day?1:t)*qe*c*(e.type===2?4*e.hw*e.hh:1)/(a+36),u=g.clamp(r/(s+1),-1,1),d=.62+.18*Math.max(0,u);Y.x+=e.c[0]*l*d,Y.y+=e.c[1]*l*d,Y.z+=e.c[2]*l*d,X.x+=e.c[0]*l*(1-d),X.y+=e.c[1]*l*(1-d),X.z+=e.c[2]*l*(1-d)}function Xe(e){let t=performance.now(),n=t,r=Je?Math.min((t-Je)/1e3,.25):1;Je=t,Y.set(0,0,0),X.set(0,0,0);let i=typeof window<`u`?window.__ctx?.player?.object:null;if(i&&P.enabled&&e>=.01){i.getWorldPosition(J),J.y+=1;let t=Math.floor((J.x-70)/A),n=Math.floor((J.x+70)/A),r=Math.floor((J.z-70)/A),a=Math.floor((J.z+70)/A);for(let i=t;i<=n;i++)for(let t=r;t<=a;t++){let n=M.get(xe(i,t));if(n)for(let t of n)Ye(t,e)}for(let t=0;t<I;t++)Ye(F[t],e);let o=q.gain*P.gain;Y.multiplyScalar(o),X.multiplyScalar(o)}let a=1-Math.exp(-r/.5);q.lo.value.lerp(Y,a),q.hi.value.lerp(X,a),P.stats.ambMs=+(performance.now()-n).toFixed(3),P.stats.amb=[+q.lo.value.x.toFixed(4),+q.lo.value.y.toFixed(4),+q.lo.value.z.toFixed(4),+q.hi.value.y.toFixed(4)]}function Ze(e){let t=performance.now();O&&_e();let n=D,r=ne.value;if(Xe(r),!P.enabled||r<.01){n.origin.w=0,P.stats.lights=0;return}if(e.getWorldDirection(ke),Ee++,P.incremental&&L===we&&Math.abs(r-Te)<.005&&Ee<6&&e.position.distanceToSquared(De)<2.25&&ke.dot(Oe)>.9995&&We(e,r)){se&&Ke(e),P.stats.ms=performance.now()-t,P.stats.partial=!0;return}Ee=0,we=L,Te=r,De.copy(e.position),Oe.copy(ke),P.stats.partial=!1,e.getWorldDirection(U);let i=Math.hypot(U.x,U.z)||1,a=Math.min(210,70+.6*Math.max(0,e.position.y))*Math.min(1,i*1.5),o=e.position.x+U.x/i*a,s=e.position.z+U.z/i*a,c=Math.floor(o/8)*8-S/2,l=Math.floor(s/8)*8-S/2;n.origin.set(c,l,8,1),n.misc.x=P.gain,n.misc.w=r,n.misc.y=(n.misc.y+1)%64,e.updateMatrixWorld(),Be.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),ze.setFromProjectionMatrix(Be),z.length=0;let u=Math.floor(c/A),d=Math.floor((c+S)/A),f=Math.floor(l/A),p=Math.floor((l+S)/A),ee=t=>{let n=t.rEff;if(t.p[0]+n<c||t.p[0]-n>c+S||t.p[2]+n<l||t.p[2]-n>l+S||(Ve.center.set(t.p[0],t.p[1],t.p[2]),Ve.radius=n,!ze.intersectsSphere(Ve)))return;let i=t.p[0]-e.position.x,a=t.p[2]-e.position.z,o=t.p[1]-e.position.y;t.pri=t.lum*(t.day?1:r)/(i*i+o*o+a*a+400),z.push(t)};for(let e=u;e<=d;e++)for(let t=f;t<=p;t++){let n=M.get(xe(e,t));if(n)for(let e of n)ee(e)}let m=performance.now();I=0,Ae.clear(),je.clear();for(let t of N){let n=I;try{t.fn(Me,e)}catch(e){console.warn(`[citylights] provider`,e)}if(t.moving)for(let e=n;e<I;e++)F[e].mov=!0,F[e].key!=null&&Ae.add(F[e].key);else for(let e=n;e<I;e++)F[e].mov=!1}for(let e=0;e<I;e++)ee(F[e]);let h=performance.now();P.stats.cand=z.length,z.length>2048&&(z.sort((e,t)=>t.pri-e.pri),z.length=ae),at(e,r);for(let e=0;e<z.length;e++){let t=z[e];t.mov&&t.key!=null&&je.set(t.key,e)}for(let e=0;e<z.length;e++)He(e,z[e],r);let g=performance.now();Ne.fill(0),Fe.fill(-1e3);let te=0,_=0;for(let e=0;e<z.length;e++){let t=z[e],n=t.rEff,r=t.p[0],i=t.p[2],a=n*n,o=Math.max(0,Math.floor((r-n-c)/8)),s=Math.min(63,Math.floor((r+n-c)/8)),u=Math.max(0,Math.floor((i-n-l)/8)),d=Math.min(63,Math.floor((i+n-l)/8)),f=t.bot<14,p=t.top>=14,ee=t.type===2,m=t.hcos>-2,h=t.top,g=t.lum,_=t.d[0],v=t.d[2],ne=m?1/(Math.sqrt(_*_+v*v)||1):0,y=t.hcos;for(let t=u;t<=d;t++){let n=l+t*8,u=n>i?n-i:i>n+8?i-n-8:0,d=u*u;if(!(d>a))for(let l=o;l<=s;l++){let o=c+l*8,s=o>r?o-r:r>o+8?r-o-8:0,u=s*s+d;if(u>a)continue;if(m&&u>16){let e=o+4-r,t=n+4-i,a=Math.sqrt(e*e+t*t),s=(e*_+t*v)*ne/a,c=6/a;if(s<y-(c<1?c:1))continue}if(ee&&(o+4-r)*_+(n+4-i)*v<-6)continue;let b=g/(u+4),re=t*64+l;for(let t=0;t<2;t++){if(t===0?!f:!p)continue;let n=t*64*64+re,r=Ne[n];if(r<26)Pe[n*26+r]=e,V[n*26+r]=b,Ne[n]=r+1,r+1>te&&(te=r+1),r+1===26&&Re(n);else{if(b<=Ie[n])continue;let t=Le[n];Pe[n*26+t]=e,V[n*26+t]=b,Re(n)}h>Fe[n]&&(Fe[n]=h)}}}}let v=performance.now(),y=le;for(let e=0;e<B;e++){let t=Ne[e],n=e/64|0,r=e-n*64,i=(n*64*7+r*7)*4;if(y[i]=t,!t)continue;_++,y[i+1]=Math.min(65535,Math.max(0,Math.ceil(Fe[e]+1e3)));let a=e*26;if(t>5){for(let e=0;e<t;e++){let t=V[a+e],n=e;for(;n>0&&V[a+H[n-1]]<t;)H[n]=H[n-1],n--;H[n]=e}for(let e=0;e<t;e++)y[i+2+e]=Pe[a+H[e]]}else for(let e=0;e<t;e++)y[i+2+e]=Pe[a+e]}C.needsUpdate=!0,w.needsUpdate=!0,n.misc.z=z.length,se&&Ke(e);let b=P.stats;b.lights=z.length,b.cells=_,b.maxCell=te,b.ms=performance.now()-t;let re=performance.now();b.split={static:+(m-t).toFixed(2),providers:+(h-m).toFixed(2),records:+(g-h).toFixed(2),bin:+(v-g).toFixed(2),texture:+(re-v).toFixed(2)}}var Qe=Array.from({length:4},()=>new ee(90,1,.1,30)),$e=Array.from({length:4},()=>{let e=new s;return e.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,x.vertexBeginVertex)},e.customProgramCacheKey=()=>`clShrink`,e}),et=Array.from({length:4},()=>({matrixWorld:new p,shadow:{camera:{near:.1,far:30}}})),Z=Array.from({length:4},()=>({id:null,rec:null,w:0})),Q=[],tt=0,$=new m,nt=new m,rt=new m,it=e=>e.key==null?e.id==null?null:`s`+e.id:`k`+e.key;function at(e,t){let n=performance.now(),r=tt?Math.min((n-tt)/1e3,.1):0;tt=n;let i=typeof window<`u`?window.__ctx?.player?.object:null;i?i.getWorldPosition($):$.copy(e.position),(!i||$.distanceToSquared(e.position)>22500)&&(e.getWorldDirection(rt),$.copy(e.position).addScaledVector(rt,12)),$.y+=.9,Q.length=0;for(let e of z)e.shSlot=0;if(P.shadows)for(let e of z){if(e.type!==1||e.noShadow)continue;let t=it(e);if(!t)continue;let n=$.x-e.p[0],r=$.y-e.p[1],i=$.z-e.p[2],a=n*n+r*r+i*i;if(a>e.range*e.range)continue;let o=Math.sqrt(a)||1,s=(n*e.d[0]+r*e.d[1]+i*e.d[2])/o,c=Math.min(1,Math.max(0,(s-e.cosO)/Math.max(e.cosI-e.cosO,.001))),l=c*c*(3-2*c);if(l<=0)continue;let u=e.lum*l/(a+1);Z.some(e=>e.id===t)&&(u*=1.6),e._imp=u,e._id=t,Q.push(e)}Q.sort((e,t)=>t._imp-e._imp),Q.length>4&&(Q.length=4);for(let e of Z){let t=Q.find(t=>t._id===e.id);t?(e.rec=t,e.w=Math.min(1,e.w+r*3)):(e.id=null,e.rec=null,e.w=0)}for(let e of Q)if(!Z.some(t=>t.id===e._id)){let t=Z.find(e=>!e.id);t&&(t.id=e._id,t.rec=e,t.w=+!r,t.fresh=!0)}let a=D.shW;Z.forEach((e,t)=>{if(a.setComponent(t,e.rec?e.w:0),!e.rec)return;let n=e.rec;n.shSlot=t+1;let r=Qe[t];r.position.set(n.p[0],n.p[1],n.p[2]),nt.set(0,1,0),Math.abs(n.d[1])>.95&&nt.set(0,0,1),r.up.copy(nt),r.lookAt(rt.set(n.p[0]+n.d[0],n.p[1]+n.d[1],n.p[2]+n.d[2])),r.fov=Math.min(150,g.radToDeg(Math.acos(Math.max(-.99,n.cosO)))*2+4),r.near=.1,r.far=n.range,r.updateProjectionMatrix(),r.updateMatrixWorld(),et[t].matrixWorld.copy(r.matrixWorld),et[t].shadow.camera.far=n.range})}var ot=new i,st=0;function ct(e,t){if(D.origin.w<=0||!Z.some(e=>e.rec))return;let n=e.shadowMap.autoUpdate,r=t.overrideMaterial,i=e.getRenderTarget();e.getClearColor(ot);let a=e.getClearAlpha();e.shadowMap.autoUpdate=!1;let o=e.autoClear;e.autoClear=!1,e.setClearColor(16777215,1),st++,E.scissorTest=!0;let s=typeof window<`u`?window.__ctx?.player?.object:null,c=window.__ctx?.camera,l=!!(s&&c&&s.position.distanceToSquared(c.position)<6.25);Z.forEach((n,r)=>{if(!n.rec||!n.fresh&&st+r&1)return;n.fresh=!1;let i=(r&1)*T,a=(r>>1)*T;E.viewport.set(i,a,T,T),E.scissor.set(i,a,T,T),e.setRenderTarget(E),e.clear(!0,!0,!1),D.shM[r].multiplyMatrices(Qe[r].projectionMatrix,Qe[r].matrixWorldInverse);let o=Qe[r];if(o.layers.set(l?29:30),o.layers.enable(29),e.properties.get($e[r]).light=et[r],t.overrideMaterial=$e[r],e.render(t,o),lt.length){t.overrideMaterial=null,o.layers.enableAll();for(let t of lt){let n=t.mesh;if(!n.visible||n.count===0)continue;let i=n.material;n.material=t.material,e.properties.get(t.material).light=et[r],e.render(n,o),n.material=i}}}),E.scissorTest=!1,E.viewport.set(0,0,T*2,T*2),t.overrideMaterial=r,e.autoClear=o,e.setClearColor(ot,a),e.shadowMap.autoUpdate=n,e.setRenderTarget(i)}P.renderShadows=ct;var lt=[];P.addCaster=(e,t)=>{let n={mesh:e,material:t};return lt.push(n),()=>{let e=lt.indexOf(n);e>=0&&lt.splice(e,1)}},P.shadows=!0,P.shadowSlots=Z,P.shadowRT=E,P.build=Ze,P.shared=D;export{ye as a,D as i,P as n,re as o,fe as r,y as s,q as t};
//# sourceMappingURL=world~index~screenshotPresets~gameSystems-Dd9PBWOO.js.map