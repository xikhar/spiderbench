// farshore shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
out vec3 vLWP;
// @section vertexFogVertex
#include <fog_vertex>
vLWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
// @section fragmentCommon
#include <common>
in vec3 vLWP;
float lh(vec2 p) {
return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
// @section fragmentMap
#include <map_fragment>
{
vec2 p = vLWP.xz;
vec2 cell = vec2(96.0, 210.0);
vec2 q = p / cell, id = floor(q), f = fract(q);
float r = lh(id), nb = lh(floor(p / 1400.0));
vec3 blk = mix(vec3(0.29, 0.27, 0.25), vec3(0.4, 0.36, 0.32), r); // (r14: darker, warmer)
if(r > 0.93 || nb < 0.1) blk = vec3(0.26, 0.31, 0.22);             // parks / cemeteries
else if(nb > 0.8) blk *= vec3(1.05, 1.0, 0.95);                     // industrial / lighter
// (round 3) street-tree / back-yard canopy mottling: the hinterland reads as leafy boroughs, not a grey slab
float tc = lh(floor(p / 38.0)) * 0.6 + lh(floor(p / 330.0)) * 0.4;
blk = mix(blk, vec3(0.16, 0.19, 0.12), smoothstep(0.45, 0.8, tc) * 0.75);
vec2 e = min(f, 1.0 - f) * cell;
float st = 1.0 - smoothstep(5.0, 8.0, min(e.x, e.y));
vec3 c = mix(blk, vec3(0.2, 0.2, 0.21), st);
// (round 6) arterial boulevards (same grid as the baked map) keep the road hierarchy readable to the horizon
float art = min(abs(mod(p.x - 350.0 + 550.0, 1100.0) - 550.0), abs(mod(p.y - 180.0 + 475.0, 950.0) - 475.0));
c = mix(c, vec3(0.15, 0.15, 0.16), 1.0 - smoothstep(11.0, 14.0, art));
vec2 fw = fwidth(q);
c = mix(c, vec3(0.33, 0.33, 0.31), clamp(max(fw.x * 4.0, fw.y * 8.0), 0.0, 1.0));
vec2 uvm = vMapUv;
float inMap = step(0.0, uvm.x) * step(uvm.x, 1.0) * step(0.0, uvm.y) * step(uvm.y, 1.0);
float edge = inMap * smoothstep(0.0, 0.03, min(min(uvm.x, 1.0 - uvm.x), min(uvm.y, 1.0 - uvm.y)));
diffuseColor.rgb = mix(c, diffuseColor.rgb, edge);
}
// @section vertexCommonByCliffWorldPosition
#include <common>
out vec3 vCW;
// @section vertexFogVertexByCliffWorldPosition
#include <fog_vertex>
vCW = (modelMatrix * vec4(transformed, 1.0)).xyz;
// @section fragmentCommonByCliffWorldPosition
#include <common>
in vec3 vCW;
float ch(float x) {
return fract(sin(x * 91.7) * 43758.5453);
}
float vn(float x) {
float i = floor(x), f = fract(x);
f = f * f * (3.0 - 2.0 * f);
return mix(ch(i), ch(i + 1.0), f);
}
// @section fragmentMapByCliffWorldPosition
{
float u = vCW.z * 0.97 + vCW.x * 0.24, y = vCW.y;
float cu = u / (3.5 + 2.0 * vn(u * 0.05)), cid = floor(cu), cf = fract(cu);
float joint = 1.0 - smoothstep(0.0, 0.12, min(cf, 1.0 - cf));
vec3 c = mix(vec3(0.15, 0.14, 0.13), vec3(0.23, 0.2, 0.17), ch(cid)) * (0.85 + 0.3 * vn(y * 0.3 + cid));
c = mix(c, vec3(0.36, 0.25, 0.18), smoothstep(0.55, 0.9, vn(u * 0.013 + y * 0.02)) * 0.5);   // iron staining
c *= 1.0 - 0.55 * joint;
float ledge = smoothstep(0.82, 0.97, fract(y / (9.0 + 3.0 * vn(u * 0.02))));
vec3 moss = mix(vec3(0.12, 0.15, 0.07), vec3(0.2, 0.19, 0.09), vn(u * 0.2));
float veg = max(ledge * 0.7, smoothstep(__SHADER_INJECT_0__, __SHADER_INJECT_1__, y + 6.0 * vn(u * 0.07))) * step(0.35, vn(u * 0.11 + y * 0.05));
c = mix(c, moss, veg * 0.85);
// wooded talus slope over the lower third (scrub and trees climbing the scree), ragged upper edge
float talus = 1.0 - smoothstep(0.0, 4.0, y - (__SHADER_INJECT_2__ + 12.0 * vn(u * 0.031) + 5.0 * vn(u * 0.17)));
vec3 wood = mix(vec3(0.07, 0.085, 0.045), vec3(0.14, 0.12, 0.06), vn(u * 0.4 + y * 0.3)) * (0.7 + 0.5 * vn(u * 1.3 + y * 0.9));
c = mix(c, wood, talus);
diffuseColor.rgb = c;
}
// @section vertexCommonByGlassMask
#include <common>
out vec3 vWPm;
out float vWin;
out float vGl;
out vec3 vBx;
// @section vertexColorVertex
#include <color_vertex>
vWin = color.b > 5.0 ? 1.0 : 0.0;
vGl = color.b > 15.0 ? 1.0 : 0.0;
vColor.b = color.b > 15.0 ? color.b - 20.0 : color.b > 5.0 ? color.b - 10.0 : color.b;
// @section vertexFogVertexByMountainWorldPosition
#include <fog_vertex>
vWPm = (modelMatrix * vec4(transformed, 1.0)).xyz;
// @section fragmentCommonByGlassMask
#include <common>
in vec3 vWPm;
in float vWin;
in float vGl;
uniform float uNightK;
float mh(vec2 p) {
return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
// @section fragmentColor
#include <color_fragment>
vec3 dnE = vec3(0.0); // (daynight) lit windows at night
if(vWin > 0.5) {
// (round 3) readable facades at 1-5 km: dark glazing with a per-window sky / blind variation, spandrels,
// a pale parapet / cornice line, grimy darker base. Averages to the same tone once sub-pixel (no shimmer).
float along = vWPm.x + vWPm.z;
vec2 fw = fwidth(vec2(vWPm.y / 3.3, along / 2.4));
float sub = clamp(max(fw.x, fw.y) * 1.3, 0.0, 1.0);
vec3 base = diffuseColor.rgb;
if(vGl > 0.5) {
float mul = fract(along / 1.6), fl = fract(vWPm.y / 3.9);
float frame = max(1.0 - step(0.1, mul), 1.0 - step(0.12, fl));
vec3 gl = mix(vec3(0.1, 0.13, 0.16), vec3(0.34, 0.4, 0.46), smoothstep(0.0, 180.0, vWPm.y) * 0.6 + 0.25 * mh(floor(vec2(along / 1.6, vWPm.y / 3.9))));
vec3 c = mix(gl, base * 0.9, frame * 0.8);
diffuseColor.rgb = mix(c, mix(vec3(0.14, 0.17, 0.2), vec3(0.28, 0.33, 0.37), smoothstep(0.0, 200.0, vWPm.y)), sub);
dnE = mix(vec3(0.8, 0.88, 1.0) * (1.0 - frame) * step(0.8, mh(floor(vec2(along / 1.6, vWPm.y / 3.9)) + 5.3)) * 0.5, vec3(0.009, 0.01, 0.012), sub); // (night) sparser, dimmer // (daynight, lighting2 r3) sub-pixel mean was 0.3 (x1.4 x night exposure ~3.6): the far shores glowed as a pale band
} else {
float fl = fract((vWPm.y - 1.2) / 3.3), u = fract(along / 2.4);
float w = step(0.3, fl) * step(fl, 0.82) * step(0.28, u) * step(u, 0.74);
vec2 wid = floor(vec2(along / 2.4, (vWPm.y - 1.2) / 3.3));
vec3 wc = vec3(0.07, 0.08, 0.095) * (0.7 + 0.9 * mh(wid)) + vec3(0.1, 0.09, 0.07) * step(0.93, mh(wid + 3.1));
vec3 c = mix(base, wc, w);
c = mix(c, mix(base, wc, 0.33), sub);
diffuseColor.rgb = c;
dnE = mix(vec3(1.0, 0.72, 0.42) * w * step(0.85, mh(wid + 7.7)) * (0.2 + 0.5 * mh(wid + 2.9)), vec3(0.012, 0.0085, 0.005), sub); // (night) sparse warm sparkle; the sub-pixel mean (was 0.026: x1.4 x4.5 exposure = the tan band) matches it
}
diffuseColor.rgb *= 0.62 + 0.38 * smoothstep(0.0, 14.0, vWPm.y - __SHADER_INJECT_0__);   // contact darkening
}
diffuseColor.rgb *= 1.0 - 0.85 * uNightK; // (night) dark silhouettes at night (critic r1, r3)
// @section fragmentEmissive
#include <emissivemap_fragment>
totalEmissiveRadiance += dnE * uNightK * 1.4;
