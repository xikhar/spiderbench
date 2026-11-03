// partmat shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
in float aPart;
flat out float vPart;
out vec3 vTintP;
out float vStateP;
__SHADER_INJECT_0__ __SHADER_INJECT_1__ __SHADER_INJECT_2__
// @section vertexBeginVertex
#include <begin_vertex>
vPart = aPart;
vTintP = __SHADER_INJECT_0__;
vStateP = __SHADER_INJECT_1__;
__SHADER_INJECT_2__
// @section fragmentCommon
#include <common>
flat in float vPart;
in vec3 vTintP;
in float vStateP;
uniform float uNightK;
// @section fragmentColor
#include <color_fragment>
int P = int(vPart + 0.5);
float pR = 0.7, pM = 0.0;
vec3 pE = vec3(0.0);
if(P == 1) {
diffuseColor.rgb *= vTintP;
pR = 0.32;
} else if(P == 2) {
pR = 0.28;
pM = 1.0;
} else if(P == 3) {
diffuseColor.rgb = vec3(0.012, 0.014, 0.016);
pR = 0.04;
} else if(P == 4) {
pR = 0.2;
pE = diffuseColor.rgb * 0.4;
} else if(P == 5) {
pR = 0.92;
} else if(P == 6) {
pR = 0.55;
} else if(P == 7) {
pR = 0.08;
pM = 0.6;
pE = vec3(0.12);
} else if(P == 8) {
pR = 0.2;
pE = diffuseColor.rgb * (0.3 + max(vStateP, 0.0) * 7.0);
} // (night) state -1 = parked car, lamps off
else if(P == 9) {
pR = 0.85;
} else if(P >= 10 && P <= 12) {
float on = abs(float(P - 10) - vStateP) < 0.5 ? 1.0 : 0.0;
vec3 lc = P == 10 ? vec3(1.0, 0.06, 0.03) : (P == 11 ? vec3(1.0, 0.5, 0.02) : vec3(0.05, 1.0, 0.45));
diffuseColor.rgb = lc * 0.05;
pR = 0.15;
pE = lc * on * 30.0;
} else if(P == 13) {
vec3 lc = vStateP > 1.5 ? vec3(0.9, 0.95, 1.0) : vec3(1.0, 0.45, 0.05);
diffuseColor.rgb = lc * 0.05;
pE = lc * 10.0;
} else if(P == 14) {
pR = 0.1;
pE = diffuseColor.rgb * 3.0;
} else if(P == 15) {
pR = 0.3;
pE = diffuseColor.rgb * 0.25;
} else if(P == 16) {
diffuseColor.rgb *= vTintP.r > - 1.0 ? vec3(1.0) : vec3(1.0);
pR = 0.6;
} else if(P == 17 || P == 18 || P == 19) {
pR = 0.8;
} else if(P == 20) {
pR = 0.85;
} else if(P == 21) {
pR = 0.78;
} else if(P == 22) {
pR = 0.92;
}
// (daynight) lamps, headlights, tail lights, screens and taxi signs light up at night
if(uNightK > 0.0) {
float lampOn = vStateP < - 0.5 ? 0.0 : 1.0; // (night) parked cars (traffic.ts state -1): head / tail lamps dark
if(P == 4) pE += (vStateP > 0.5 ? vec3(1.0, 0.56, 0.2) : vec3(1.0, 0.85, 0.66)) * 3.2 * uNightK; // (night r3) warm-white LED / sodium amber ((night r4) 9 -> 3.2: the core just clips, a small halo, not a 60 px disc) (street lamps: props.ts aState)
// (night r12) user: 'car lights from distance are very bright big circles, with reflections below'. The bloom halo
// is a fixed size on screen while the lamp shrinks: head / tail lamps dim with distance (~1/d past 16 m), so far
// cars read as small bright points (was a flat 7.0: every car a clipped disc + halo at any range)
float hk = clamp(12.0 / max(length(vViewPosition), 1.0), 0.1, 1.0);
if(P == 7) pE += vec3(1.0, 0.95, 0.88) * 3.5 * hk * uNightK * lampOn;
else if(P == 8) pE += diffuseColor.rgb * 2.2 * max(hk, 0.35) * uNightK * lampOn;
else if(P == 14 || P == 15) pE *= 1.0 + 1.5 * uNightK;
}

// @section fragmentRoughness
#include <roughnessmap_fragment>
roughnessFactor = pR;
// @section fragmentMetalness
#include <metalnessmap_fragment>
metalnessFactor = pM;
// @section fragmentEmissive
#include <emissivemap_fragment>
totalEmissiveRadiance += pE;
