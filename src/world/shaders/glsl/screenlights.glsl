// screenlights shader sections. Use parseShaderSections() to select an injection chunk.
// @section fragmentCommon
#include <common>
__SHADER_INJECT_0__
// @section fragmentLightsBegin
totalEmissiveRadiance *= __SHADER_INJECT_0__; // (night)
__SHADER_INJECT_1__
#include <lights_fragment_begin>

// @section uniformDeclarations
uniform float uScreenK;
uniform float uNightK;
uniform float uScrBoost;
uniform float uScrDesat;
uniform float uScrKnee;
uniform float uScrTop;

// @section gainExpression
(uScreenK * (1.0 + (uScrBoost - 1.0) * uNightK))

// @section highlightShoulder
if(uNightK > 0.0) {
float scrN = max(max(emissive.r, emissive.g), emissive.b) * __SHADER_INJECT_0__ + 1e-4;
float scrM = max(max(totalEmissiveRadiance.r, totalEmissiveRadiance.g), totalEmissiveRadiance.b) / scrN;
if(scrM > uScrKnee) {
float scrW = uScrTop - uScrKnee;
float scrY = uScrKnee + scrW * (1.0 - exp(- (scrM - uScrKnee) / scrW));
totalEmissiveRadiance *= mix(1.0, scrY / scrM, uNightK);
}
}
