// buildings shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
in float aPart;
flat out float vPart;
out vec3 vWP;
out vec3 vWN;
out vec2 vUv2;
// @section vertexFogVertex
#include <fog_vertex>
vPart = aPart;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);
vUv2 = uv;
// @section fragmentCommon
#include <common>
uniform sampler2D tNoise;
__SHADER_INJECT_0__ flat in float vPart;
in vec3 vWP;
in vec3 vWN;
in vec2 vUv2;
float dR;
float dM;
vec3 dN;
// @section fragmentColor
#include <color_fragment>
{
int P = int(vPart + 0.5);
vec3 N = normalize(vWN);
vec2 tp = abs(N.y) > 0.6 ? vWP.xz : (abs(N.x) > abs(N.z) ? vWP.zy : vWP.xy);
vec3 nz = texture(tNoise, tp / 7.0).rgb, nz2 = texture(tNoise, tp / 1.3).rgb;
dR = 0.7;
dM = 0.0;
dN = vec3(0.0, 0.0, 1.0);
float grime = smoothstep(0.35, 0.8, nz.r) * 0.35 + (1.0 - smoothstep(0.0, 0.6, fract(vWP.y) + nz2.g * 0.2)) * 0.0;
if(P == 0) {
dR = 0.45 + 0.3 * nz2.g;
dM = 0.2;
diffuseColor.rgb *= 1.0 - grime * 0.5;
          // rain streaks on painted sheet metal
if(abs(N.y) < 0.5) diffuseColor.rgb *= 1.0 - 0.25 * smoothstep(0.55, 0.9, texture(tNoise, vec2(tp.x * 0.9, tp.y * 0.05)).g);
} else if(P == 1) { // timber staves (vertical boards) weathered
float st = fract(vUv2.x * 48.0);
float seam = smoothstep(0.0, 0.06, st) * smoothstep(1.0, 0.94, st);
float board = fract(sin(floor(vUv2.x * 48.0) * 91.7) * 4375.5);
diffuseColor.rgb *= (0.75 + 0.35 * board) * mix(0.55, 1.0, seam) * (0.8 + 0.4 * nz2.b);
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.88, 0.9, 0.88), smoothstep(0.4, 0.9, nz.g));
dR = 0.85;
dN = normalize(vec3((1.0 - seam) * sign(st - 0.5) * 0.6, 0.0, 1.0));
} else if(P == 2) {
dR = 0.5 + 0.3 * nz2.r;
dM = 0.7;
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.25, 0.92, 0.75), smoothstep(0.55, 0.85, nz2.g) * 0.5);
} else if(P == 3) {
dR = 0.06 + 0.25 * smoothstep(0.5, 0.9, nz2.g);
dM = 0.0;
diffuseColor.rgb = mix(vec3(0.02, 0.025, 0.03), vec3(0.2), smoothstep(0.6, 0.95, nz2.g) * 0.5);
} else if(P == 4) {
dR = 0.9;
diffuseColor.rgb *= 0.9 + 0.2 * nz2.b;
} else if(P == 5) {
dR = 0.85;
diffuseColor.rgb *= 0.9 + 0.15 * nz2.r;
} else if(P == 6) {
dR = 0.35 + 0.25 * nz2.g;
dM = 0.85;
} else if(P == 7) {
dR = 0.8;
diffuseColor.rgb *= 0.9 + 0.2 * nz2.b;
diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.5, 0.9, nz.g);
} else if(P == 8) {
dR = 0.85;
} else if(P == 10) { // thin steel (rails, masts, bracing): dithered fade 90-170 m (TAA resolves it; no sub-pixel crawl)
dR = 0.5 + 0.3 * nz2.r;
dM = 0.7;
float fd = smoothstep(90.0, 170.0, length(cameraPosition - vWP));
if(fd > 0.0 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < fd) discard;
} else if(P == 9) { // steel bar grating (fire-escape decks): 3 mm bearing bars every 3 cm, cross rods every 10 cm
dM = 0.6;
dR = 0.55 + 0.25 * nz2.r;
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.2, 0.92, 0.75), smoothstep(0.55, 0.85, nz2.g) * 0.4);
if(abs(N.y) > 0.6) {
vec2 q = vWP.xz;
vec2 fw = fwidth(q);
vec2 pitch = vec2(0.03, 0.10);
// bars along the longer deck axis: pick the axis with more variation of the part... use world x
float bx = abs(fract(q.x / pitch.x) - 0.5) * pitch.x, bz = abs(fract(q.y / pitch.y) - 0.5) * pitch.y;
float onBar = max(step(pitch.x * 0.5 - 0.004, bx), step(pitch.y * 0.5 - 0.004, bz));
float fine = max(fw.x / pitch.x, fw.y / pitch.y);
if(fine < 0.25) {
if(onBar < 0.5) discard;
} else { // (textures r4) critic: 'fire escapes are solid black slabs'. Past the bar resolution the deck stays
// see-through: dithered coverage at the grating's true open fraction (~65 %), resolved by TAA
float dth = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
if(dth < 0.62 * (1.0 - smoothstep(1.5, 4.0, fine) * 0.4)) discard;
}
}
}
diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.85); // muted palette
}
// @section fragmentRoughness
float roughnessFactor = dR;
// @section fragmentMetalness
float metalnessFactor = dM;
// @section fragmentNormalMaps
#include <normal_fragment_maps>
{
vec3 Nw = normalize(vWN);
vec3 Tw = abs(Nw.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), Nw));
vec3 Bw = cross(Nw, Tw);
vec3 nw = normalize(Tw * dN.x + Bw * dN.y + Nw * dN.z);
if(dN.z < 0.999) normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
}
