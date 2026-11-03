// bridges shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
out vec3 vWPs;
out vec3 vWNs;
// @section vertexFogVertex
#include <fog_vertex>
vWPs = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNs = normalize(mat3(modelMatrix) * objectNormal);
// @section fragmentCommon
#include <common>
uniform sampler2D tSN;
in vec3 vWPs;
in vec3 vWNs;
// @section fragmentMap
{
vec3 an = abs(vWNs);
vec2 q = an.x > an.z ? vWPs.zy : vWPs.xy;
if(an.y > 0.7) q = vWPs.xz;
vec3 nz = texture(tSN, q / 17.0).rgb, nz2 = texture(tSN, q / 3.1).rgb;
// ashlar coursing: 0.9 m courses, 1.8 m blocks (offset every other course), thin dark joints
float cy = q.y / 0.9, row = floor(cy), cx = q.x / 1.8 + 0.5 * mod(row, 2.0);
vec2 f = vec2(fract(cx), fract(cy));
vec2 fw = fwidth(vec2(cx, cy)) * 1.5 + 1e-4;
float joint = max(1.0 - smoothstep(0.0, 0.03 + fw.x, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, 0.04 + fw.y, min(f.y, 1.0 - f.y)));
joint *= 1.0 - smoothstep(0.2, 0.6, max(fw.x, fw.y));
float blk = fract(sin(dot(floor(vec2(cx, cy)), vec2(12.9898, 78.233))) * 43758.5453);
vec3 c = diffuseColor.rgb * (0.86 + 0.16 * blk) * (0.8 + 0.3 * nz.r) * (0.93 + 0.1 * nz2.g);
c *= 1.0 - 0.35 * joint;
c *= mix(0.72, 1.0, smoothstep(- 1.0, 6.0, vWPs.y)); // wet / algae band at the water line
c *= 1.0 - 0.18 * smoothstep(0.55, 0.85, nz.b) * (0.5 + 0.5 * an.x + 0.5 * an.z); // grime streaks
diffuseColor.rgb = c;
}
// @section vertexCommonByCableGlow
#include <common>
in vec3 aEx;
out float vGlow;
// @section vertexBeginVertex
#include <begin_vertex>
vGlow = aEx.x;
// @section fragmentCommonByCableGlow
#include <common>
in float vGlow;
uniform float uNightK;
// @section fragmentEmissive
#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.82, 0.55) * vGlow * (0.15 + 7.0 * uNightK);
// @section vertexCommonByCableNeck
#include <common>
in vec3 aEx;
out vec3 vWPc;
out float vNeck, vFat;
// @section vertexBeginVertexCableBend
#include <begin_vertex>
vNeck = aEx.x;
{
vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
vFat = max(0.0, length(wp - cameraPosition) * 0.0011 - 0.15);
transformed += objectNormal * vFat;
vWPc = wp;
}
// @section fragmentCommonCableLighting
#include <common>
in vec3 vWPc;
in float vNeck, vFat;
uniform float uNightK;
// @section fragmentMetalness
#include <metalnessmap_fragment>
metalnessFactor *= 1.0 - 0.85 * uNightK;
diffuseColor.rgb *= 1.0 - 0.7 * uNightK;
// @section fragmentEmissiveCableLighting
#include <emissivemap_fragment>
if(uNightK > 0.0 && vNeck > 0.5) {
float q = (vWPc.x + vWPc.z) * 0.18;
float fq = fwidth(q) + 1e-4;
// (night) small bright bulbs, not a glowing bar: each bulb stays >= ~1.5 px long at any distance (never averaged
// into a continuous line); once bulbs crowd to < ~3.5 px apart only every 2nd / 4th / ... bulb is drawn (stable
// world-space subset), so far bridges keep a dotted necklace of points. Bloom does the glow
float st = exp2(ceil(log2(max(1.0, fq * 6.0)))); // (night r11) 3.5: far necklaces read as dashed white bars
float hw = max(0.05, fq * 0.75), dd = abs(fract(q) - 0.5);
float dot1 = (1.0 - smoothstep(hw - 0.5 * fq, hw + 0.5 * fq, dd)) * step(mod(floor(q), st), 0.5);
// (night r11) the cable is fattened with distance (~1.5 m at 1.5 km): the bulb's emission is scaled back by the
// fattening, so far necklaces read as fine warm points instead of thick white dashes (esb view)
totalEmissiveRadiance += vec3(1.0, 0.9, 0.72) * dot1 * 3.5 * uNightK / (1.0 + vFat * 6.0);
}
// @section vertexCommonByTubeUv
#include <common>
out vec2 vTU;
// @section vertexBeginVertexByTubeUv
#include <begin_vertex>
vTU = uv;
// @section fragmentCommonByTubeUv
#include <common>
in vec2 vTU;
// @section fragmentClipping
#include <clipping_planes_fragment>
if(vTU.y < 1.5) {
float u = fract(vTU.x), v = vTU.y;
vec2 fw = fwidth(vTU) + 1e-4;
float chord = step(v, 0.08 + fw.y) + step(0.92 - fw.y, v);
float post = step(min(u, 1.0 - u), 0.05 + fw.x);
float d1 = abs(u - v), d2 = abs(u - (1.0 - v));
float diag = step(min(d1, d2), 0.06 + fw.x + fw.y);
          // far away the web is sub-pixel: keep it solid (dithered holes would read as polka dots)
if(chord + post + diag < 0.5 && max(fw.x, fw.y) < 0.09) discard;
} else {
float v = vTU.y - 2.0, u = vTU.x;
vec2 fw = fwidth(vec2(u * 16.0, v)) + 1e-4;
float rail = step(0.9 - fw.y, v) + step(v, 0.07 + fw.y) + step(abs(v - 0.5), 0.035 + fw.y);
float post = step(min(fract(u), 1.0 - fract(u)), 0.04 + fw.x / 16.0);
float pick = step(abs(fract(u * 16.0) - 0.5), 0.12 + fw.x);
if(rail + post + pick < 0.5 && fw.x < 0.6) discard;
}
// @section vertexCommonByDeckExtras
#include <common>
in vec3 aEx;
out vec3 vWPd;
out vec3 vWNd;
out vec2 vUD;
out vec3 vEx;
// @section vertexFogVertexByDeckUv
#include <fog_vertex>
vWPd = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNd = normalize(mat3(modelMatrix) * objectNormal);
vUD = uv;
vEx = aEx;
// @section fragmentCommonDeckMaterial
#include <common>
uniform sampler2D tDC;
uniform sampler2D tSN;
in vec3 vWPd;
in vec3 vWNd;
in vec2 vUD;
in vec3 vEx;
float bandL(float l, float c, float w, float fw) {
return 1.0 - smoothstep(w * 0.5 - fw, w * 0.5 + fw, abs(l - c));
}
// @section fragmentMapByDeckUv
{
vec3 c = texture(tDC, vWPd.xz / 6.0).rgb * 1.1;
float md = floor(vEx.z + 0.5);
vec3 nz = texture(tSN, vWPd.xz / 23.0).rgb;
if(vWNd.y < 0.5) c = vec3(0.42, 0.42, 0.41) * (0.85 + 0.25 * nz.r); // slab edges / fascia / kerbs: concrete
else if(md == 1.0) {
float l = abs(vUD.y), a = vUD.x, inner = vEx.x, outer = vEx.y;
float fw = fwidth(vUD.y) + 1e-3;
float fade = 1.0 - smoothstep(0.08, 0.3, fw); // lines fade to the asphalt tone before they alias
float w = bandL(l, outer - 0.45, 0.15, fw);
if(inner > 0.3) w = max(w, bandL(l, inner + 0.45, 0.15, fw));
float n = floor((outer - inner - 1.0) / __SHADER_INJECT_0__ + 0.5);
float k = floor((l - inner - 0.5) / __SHADER_INJECT_1__ + 0.5);
if(k >= 1.0 && k <= n - 1.0) w = max(w, bandL(l, inner + 0.5 + k * __SHADER_INJECT_2__, 0.13, fw) * step(fract(a / 12.0), 0.27));
float y = inner < 0.3 ? max(bandL(l, 0.2, 0.12, fw), 0.0) : 0.0;
          // tyre-polished wheel paths (darker, smoother) in every lane
float ln = fract((l - inner - 0.5) / __SHADER_INJECT_3__);
float wear = (1.0 - smoothstep(0.08, 0.16, abs(ln - 0.27))) + (1.0 - smoothstep(0.08, 0.16, abs(ln - 0.73)));
c *= 1.0 - 0.13 * wear * step(l, outer - 0.5) * step(inner + 0.5, l);
          // expansion joints every 30 m (steel strip)
c = mix(c, vec3(0.32, 0.31, 0.3), (1.0 - smoothstep(0.05, 0.12 + fwidth(a), abs(fract(a / 30.0) - 0.5) * 30.0)) * fade);
c = mix(c, vec3(0.84, 0.83, 0.78) * (0.8 + 0.25 * nz.g), w * 0.85 * fade);
c = mix(c, vec3(0.78, 0.6, 0.17), y * 0.85 * fade);
} else if(md == 2.0) { // timber planks across the promenade, grey-brown, worn
float a = vUD.x / 0.32, pl = fract(a), id = floor(a);
float h = fract(sin(id * 12.9898) * 43758.5453);
          // (bridges r2) weathered timber: warm brown boards greyed by the sun, darker grime patches and a
          // foot-polished centre band, dark gaps between the boards
vec3 wood = vec3(0.43, 0.33, 0.24) * (0.72 + 0.34 * h);
vec3 grey = vec3(0.4, 0.38, 0.35) * (0.8 + 0.2 * h);
c = mix(wood, grey, 0.35 + 0.4 * nz.g);
float grain = texture(tSN, vec2(vWPd.x * 0.9, vUD.y * 11.0 + id * 3.1)).r;
c *= 0.82 + 0.3 * grain;
c *= 1.0 - 0.32 * smoothstep(0.52, 0.8, texture(tSN, vWPd.xz / 7.0).b);       // grime / wet-rot patches
c *= 1.0 - 0.18 * smoothstep(1.2, 3.2, abs(vUD.y));                            // edges darker (less foot traffic)
c *= 1.0 - 0.55 * (1.0 - smoothstep(0.0, 0.07 + fwidth(a), min(pl, 1.0 - pl))) * (1.0 - smoothstep(0.2, 0.5, fwidth(a)));
} else if(md == 3.0) { // ballast + timber ties every 0.62 m
vec3 bal = vec3(0.36, 0.34, 0.31) * (0.7 + 0.5 * texture(tSN, vWPd.xz / 1.3).r);
float t = fract(vUD.x / 0.62), tie = step(abs(t - 0.5), 0.2) * step(abs(abs(vUD.y) - 2.3), 1.35);
c = mix(bal, vec3(0.22, 0.18, 0.15), tie * (1.0 - smoothstep(0.2, 0.5, fwidth(vUD.x / 0.62))));
} else if(md == 4.0) {
c = vec3(0.56, 0.55, 0.52) * (0.8 + 0.3 * nz.r);
}
diffuseColor.rgb *= c;
}
