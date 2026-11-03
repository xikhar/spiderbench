// timessq shader sections. Use parseShaderSections() to select an injection chunk.
// @section fragmentCommon
#include <common>
__SHADER_INJECT_0__
// @section fragmentEmissive
#include <emissivemap_fragment>
totalEmissiveRadiance *= __SHADER_INJECT_0__; // (night)
{
vec2 px = vEmissiveMapUv * vec2(4096.0) * 0.5;
vec2 fw = fwidth(px);
float k = clamp(1.0 - max(fw.x, fw.y) * 1.6, 0.0, 1.0);
vec2 g = abs(fract(px) - 0.5);
float m = smoothstep(0.5, 0.36, max(g.x, g.y));
// RGB sub-pixel triads (visible up close only) + the dark pixel grid between the LEDs
float sp = fract(px.x * 3.0);
vec3 tri = vec3(smoothstep(0.0, 0.12, sp) * smoothstep(0.36, 0.24, sp), smoothstep(0.3, 0.42, sp) * smoothstep(0.7, 0.58, sp), smoothstep(0.64, 0.76, sp) * smoothstep(1.0, 0.88, sp));
float k2 = clamp(1.0 - max(fw.x, fw.y) * 4.0, 0.0, 1.0);
totalEmissiveRadiance *= mix(vec3(1.0), (0.4 + 0.75 * m) * mix(vec3(1.0), 0.35 + 1.9 * tri, k2), k);
// (r6) a touch less chroma (critic: 'over-saturated, too clean')
totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(dot(totalEmissiveRadiance, vec3(0.3, 0.55, 0.15))), mix(0.26, uScrDesat, uNightK)); // (night) vivid LED colour at night (ts_perch_night) // (billboards r6) 0.14 -> 0.26 (critic r5: 'uniformly saturated poster imagery')
// (r7) LED cabinet modules (16 x 16 LEDs): thin dark seams that survive much farther than the LED grid, plus faint
// horizontal scan rows (critic r6: 'flat glowing cards with no LED pixel grid or scanline')
vec2 cb = vEmissiveMapUv * vec2(4096.0) / 32.0;
vec2 fc = fwidth(cb);
float kc = clamp(1.0 - max(fc.x, fc.y) * 14.0, 0.0, 1.0);
vec2 gc = 0.5 - abs(fract(cb) - 0.5);
float seam = max(1.0 - smoothstep(0.006, 0.006 + fc.x, gc.x), 1.0 - smoothstep(0.006, 0.006 + fc.y, gc.y));
totalEmissiveRadiance *= 1.0 - 0.09 * seam * kc; // (r9) 0.2 -> 0.09 (critic r8: 'visible grid tiling pattern' up close)
float kr = clamp(1.0 - fw.y * 1.4, 0.0, 1.0);
totalEmissiveRadiance *= mix(1.0, 0.8 + 0.2 * cos(px.y * 6.2831853), kr * 0.8);
// (r7) LED viewing cone: panels seen off-axis dim + shift slightly cool, so screens at different angles differ
float ca = abs(dot(normalize(normal), normalize(vViewPosition)));
totalEmissiveRadiance *= mix(vec3(0.5, 0.54, 0.6), vec3(1.0), smoothstep(0.08, 0.7, ca));
// (r7) soft highlight shoulder: whites roll off instead of clipping to a flat near-white card
float mx = max(totalEmissiveRadiance.r, max(totalEmissiveRadiance.g, totalEmissiveRadiance.b));
if(mx > 1.0) totalEmissiveRadiance *= (1.0 + (mx - 1.0) / (1.0 + (mx - 1.0) * 1.1)) / mx;
__SHADER_INJECT_1__ }
// @section fragmentMap
#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), 0.2) * 0.92 + 0.012;
// @section fragmentColor
diffuseColor.a *= vColor.r;
diffuseColor.rgb = vec3(0.0);
// @section fragmentEmissiveSignLetterCutout
{
vec3 c = texture(emissiveMap, vEmissiveMapUv).rgb, b = textureLod(emissiveMap, vEmissiveMapUv, 5.0).rgb;
float m = smoothstep(0.1, 0.3, length(c - b));
if(m < 0.4) discard;
totalEmissiveRadiance = emissive * mix(vColor.rgb, vec3(1.0, 0.96, 0.92), 0.45 * smoothstep(0.65, 1.0, m)) * m;
}
// @section vertexCommon
#include <common>
out float vHaloF;
// @section vertexProjectVertex
#include <project_vertex>
{
vec3 hwp = (modelMatrix * vec4(transformed, 1.0)).xyz;
vHaloF = 1.0 - smoothstep(0.3, 0.65, - normalize(hwp - cameraPosition).y);
}
// @section fragmentCommonByHaloFade
#include <common>
in float vHaloF;
// @section fragmentOpaque
outgoingLight *= vHaloF;
#include <opaque_fragment>
// @section vertexProjectVertexStorefront
#include <project_vertex>
vTanW = aTan;
vRoom = aRoom;
vNW = normal;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
// @section fragmentMapStorefrontGlass
#include <map_fragment>
diffuseColor.rgb = vec3(0.03);
// @section fragmentEmissiveStorefrontInterior
{
vec3 V = normalize(vWP - cameraPosition), Nn = normalize(vNW), Tt = normalize(vTanW);
float dx = dot(V, Tt), dy = V.y, dz = max(- dot(V, Nn), 1e-3);
vec2 sz = vRoom.zw, p = vRoom.xy * sz;
const float D = 5.5;
float tx = dx > 1e-4 ? (sz.x - p.x) / dx : (dx < - 1e-4 ? - p.x / dx : 1e5);
float ty = dy > 1e-4 ? (sz.y + 0.6 - p.y) / dy : (dy < - 1e-4 ? - (p.y + 0.5) / dy : 1e5);
float tz = D / dz, t = min(min(tx, ty), tz);
vec3 h = vec3(p.x + dx * t, p.y + dy * t, dz * t);
vec2 cs = vec2(0.242, 0.49), c0 = vEmissiveMapUv - vRoom.xy * cs;
float fall = 1.0 - 0.4 * h.z / D;
vec3 col;
if(t >= tz - 1e-3) col = texture(emissiveMap, c0 + clamp(h.xy / sz, 0.02, 0.98) * cs).rgb;
else if(t >= tx - 1e-3) {
float s = 0.3 * h.z / D; // side walls: the outer strips of the shop picture run down the wall
col = texture(emissiveMap, c0 + vec2(dx > 0.0 ? 0.98 - s : 0.02 + s, clamp(h.y / sz.y, 0.02, 0.98)) * cs).rgb * 0.6 * fall;
} else if(dy > 0.0) {
float lp = step(0.62, fract(h.z / 1.5 + 0.2)) * step(0.3, fract(h.x / 1.8 + 0.15));
col = vec3(0.3, 0.29, 0.27) * fall + vec3(1.7, 1.6, 1.4) * lp;
} else {
vec2 q = vec2(h.x, h.z) / 0.6;
float tl = step(0.05, fract(q.x)) * step(0.05, fract(q.y));
col = vec3(0.36, 0.33, 0.3) * (0.7 + 0.3 * tl) * fall;
}
totalEmissiveRadiance = emissive * col * vColor.r;
}
// @section fragmentMapPaverGrime
#include <map_fragment>
{
vec2 wp = vec2(vMapUv.x, - vMapUv.y) * 9.6;
// (r7) large-scale colour variance (warm red-brown <-> cooler grey-pink fields), lighter polished walking lines,
// darker grime along the building frontage
float h1 = texture(tMacro, wp * 0.0071 + 0.53).b, h2 = texture(tMacro, wp * 0.021 + 0.21).r;
diffuseColor.rgb *= mix(vec3(1.07, 0.97, 0.9), vec3(0.9, 0.96, 1.05), smoothstep(0.3, 0.72, h1));
float path = smoothstep(0.55, 0.8, h2) * (0.6 + 0.4 * texture(tMacro, wp * 0.13).g);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + vec3(0.012, 0.011, 0.01), path * 0.7);
float ex = abs(wp.x);
diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(uEdgeX - 4.0, uEdgeX - 0.5, ex) * (0.6 + 0.4 * h2);
// painted discs: worn, blotchy, paver texture multiplied through
float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
// The loop skips discs per pixel. Compute the scaled mip levels before that divergent control flow;
// textureLod avoids executing a gradient instruction in the loop on ANGLE/D3D backends.
vec2 wpDx = dFdx(wp), wpDy = dFdy(wp);
vec2 macroTexelSize = vec2(textureSize(tMacro, 0));
float paintMacroLod = paverMipLevel(wpDx * 0.31, wpDy * 0.31, macroTexelSize);
float grainMacroLod = paverMipLevel(wpDx * 1.9, wpDy * 1.9, macroTexelSize);
for(int i = 0;
i < 24;
i ++) {
vec4 C = uCirc[i];
if(C.z < 0.0) continue;
float d = length(wp - C.xy) - C.z;
if(d > 0.05) continue;
float m = 1.0 - smoothstep(- 0.04, 0.03, d);
float rim = (1.0 - smoothstep(- 0.34, - 0.3, d)) * smoothstep(- 0.46, - 0.42, d); // pale inner ring line
vec3 pc = C.w < 0.5 ? vec3(0.07, 0.2, 0.3) : C.w < 1.5 ? vec3(0.09, 0.22, 0.24) : C.w < 2.5 ? vec3(0.16, 0.17, 0.2) : vec3(0.06, 0.12, 0.26);
float wr = textureLod(tMacro, wp * 0.31 + C.xy * 0.01, paintMacroLod).g * 0.6 + textureLod(tMacro, wp * 1.9, grainMacroLod).r * 0.5;
float keep = smoothstep(0.34, 0.62, wr);
vec3 painted = pc * clamp(lum / 0.16, 0.45, 1.5);
painted = mix(painted, vec3(0.5, 0.52, 0.52) * clamp(lum / 0.16, 0.45, 1.5), rim * 0.8);
diffuseColor.rgb = mix(diffuseColor.rgb, painted, m * keep * 0.5); // (r8) fainter, worn (critic: 'cheap flat circles')
}
}
{
float a = texture(tMacro, vMapUv * 0.061).r, b = texture(tMacro, vMapUv * 0.23 + 0.37).g, c = texture(tMacro, vMapUv * 0.9 + 0.11).b;
diffuseColor.rgb *= 0.74 + 0.42 * a * (0.7 + 0.6 * b);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))), 0.12 + 0.25 * smoothstep(0.55, 0.8, c));
diffuseColor.rgb *= mix(1.0, texture(roughnessMap, vRoughnessMapUv).r, 0.8);
diffuseColor.rgb = diffuseColor.rgb * 1.2 + vec3(0.014, 0.012, 0.011); // (r8) paler, sunlit pavers (director r7)
// (r11) critic r9: 'pavers flat and too saturated, no grime' -> less chroma + a sooty film in the macro noise lows
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.2);
diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(0.5, 0.2, a) * (0.5 + 0.5 * b);
}
// @section fragmentMapCrosswalkWear
{
vec4 n1 = texture(map, vMapUv), n2 = texture(map, vMapUv * 4.3 + 0.37), n3 = texture(map, vMapUv * 17.0 + 0.71);
float pale = smoothstep(0.72, 0.9, n1.g) * smoothstep(0.45, 0.75, n2.b);
diffuseColor = vec4(mix(diffuse * (0.75 + 0.4 * n3.b), vec3(0.62, 0.61, 0.58), pale), clamp((0.26 + 0.34 * smoothstep(0.2, 0.8, n1.r)) * (0.65 + 0.7 * n2.g) + 0.25 * pale, 0.0, 0.68));
vec2 wq = vMapUv * float(__SHADER_INJECT_0__);
// (r11) worn crosswalk paint (critic r9: 'stripes too clean and uniformly white'): denser grime film + chipped
// spots over the avenue crossings (z = street +- 7.4) and the side-street crossings (|x| = 13.4)
{
float zz = mod(wq.y, float(__SHADER_INJECT_1__)), ax = abs(wq.x);
float cw = (1.0 - smoothstep(2.2, 3.0, abs(zz - __SHADER_INJECT_2__))) + (1.0 - smoothstep(2.2, 3.0, abs(zz - __SHADER_INJECT_3__)));
cw *= 1.0 - smoothstep(__SHADER_INJECT_4__, __SHADER_INJECT_5__, ax);
cw += (1.0 - smoothstep(__SHADER_INJECT_6__, __SHADER_INJECT_7__, min(zz, float(__SHADER_INJECT_8__) - zz))) * (1.0 - smoothstep(1.8, 2.6, abs(ax - __SHADER_INJECT_9__)));
float chip = smoothstep(0.55, 0.72, n3.r) * (0.6 + 0.4 * n2.b);
diffuseColor.a = __SHADER_INJECT_10__;
}
diffuseColor.a *= smoothstep(float(__SHADER_INJECT_11__), float(__SHADER_INJECT_12__), abs(wq.x)) * smoothstep(- 326.0, - 306.0, wq.y) * smoothstep(6.0, - 8.0, wq.y);
}

// @section storefrontVertexPrefix
in vec3 aTan;
in vec4 aRoom;
out vec3 vTanW;
out vec4 vRoom;
out vec3 vWP;
out vec3 vNW;

// @section storefrontFragmentPrefix
in vec3 vTanW;
in vec4 vRoom;
in vec3 vWP;
in vec3 vNW;

// @section paversFragmentPrefix
uniform sampler2D tMacro;
uniform vec4 uCirc[24];
uniform float uEdgeX;
float paverMipLevel(vec2 uvDx, vec2 uvDy, vec2 textureSizeInTexels) {
float footprint = max(length(uvDx * textureSizeInTexels), length(uvDy * textureSizeInTexels));
return log2(max(footprint, 1.0));
}
