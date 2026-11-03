// highway shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
in vec2 aHw;
out vec2 vHw;
out vec3 vHwP;
// @section vertexFogVertex
#include <fog_vertex>
vHw = aHw;
vHwP = (modelMatrix * vec4(transformed, 1.0)).xyz;
// @section fragmentCommon
#include <common>
uniform sampler2D tCol;
uniform sampler2D tNoise;
uniform sampler2D tMacro;
in vec2 vHw;
in vec3 vHwP;
float hwR = 0.85;
float band(float u, float c, float hw, float aa) {
return 1.0 - smoothstep(hw - aa, hw + aa, abs(u - c));
}
void highway(out vec3 highwayColor) {
float u = vHw.x, v = vHw.y;
float lineAA = max(fwidth(u), 1e-3);
vec2 p = vHwP.xz;
vec3 c = texture(tCol, p / 6.0).rgb * 0.92;
vec3 m = texture(tMacro, p / 70.0).rgb;
vec3 nz = texture(tNoise, p / 53.0).rgb;
c *= (0.84 + 0.3 * m.r) * (0.93 + 0.14 * nz.r);
float dist = length(vHwP - cameraPosition);
// tyre tracks per lane (darker), slightly lighter lane centres
float l = mod(u - __SHADER_INJECT_0__, __SHADER_INJECT_1__) - __SHADER_INJECT_2__;
c *= 1.0 - 0.12 * exp(- pow((abs(l) - 0.85) / 0.3, 2.0));
c *= mix(1.0, 0.7, smoothstep(90.0, 700.0, dist)); // aerial LOD tone like the street asphalt
hwR = 0.85;
float W = __SHADER_INJECT_3__, SH = __SHADER_INJECT_4__, LN = __SHADER_INJECT_5__, MD = __SHADER_INJECT_6__;
float m0 = SH + 3.0 * LN, m1 = m0 + MD;
// planted median: kerbed strip with grass / soil
if(u > m0 + 0.25 && u < m1 - 0.25) {
vec3 g = mix(vec3(0.16, 0.18, 0.1), vec3(0.2, 0.18, 0.13), texture(tNoise, p / 7.0).g);
hwR = 0.95;
highwayColor = g * (0.85 + 0.3 * nz.b);
return;
}
if(u > m0 && u < m1) {
hwR = 0.8;
highwayColor = vec3(0.46, 0.45, 0.42) * (0.9 + 0.2 * nz.g);
return;
} // kerb
float wear = 0.75 + 0.25 * smoothstep(0.3, 0.7, texture(tNoise, p / 3.1).r);
float paint = 0.0;
vec3 pc = vec3(0.86, 0.86, 0.83);
// solid white edge lines
paint += band(u, SH - 0.1, 0.075, lineAA) + band(u, W - SH + 0.1, 0.075, lineAA);
// dashed lane lines (3 m dash, 9 m gap)
float dash = step(mod(v, 12.0), 3.0);
for(int j = 1;
j < 3;
j ++) {
paint += dash * (band(u, SH + float(j) * LN, 0.06, lineAA) + band(u, m1 + float(j) * LN, 0.06, lineAA));
}
paint = clamp(paint, 0.0, 1.0);
// double yellow along the median kerbs
float yl = band(u, m0 - 0.2, 0.055, lineAA) + band(u, m1 + 0.2, 0.055, lineAA);
c = mix(c, pc * 0.85, paint * wear * 0.85);
c = mix(c, vec3(0.72, 0.55, 0.16) * 0.85, clamp(yl, 0.0, 1.0) * wear * 0.85);
hwR = mix(0.9, 0.6, paint);
// gutters
c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.6, u)) - 0.2 * (1.0 - smoothstep(0.0, 0.6, W - u));
highwayColor = c;
}
// @section fragmentMap
vec3 highwayColor;
highway(highwayColor);
diffuseColor.rgb = highwayColor;
// @section fragmentRoughness
float roughnessFactor = hwR;
