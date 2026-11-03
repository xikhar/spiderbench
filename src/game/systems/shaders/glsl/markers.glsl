// markers shader sections. Use parseShaderSections() to select an injection chunk.
// @section fragmentCommon
#include <common>
uniform float uGlow;
// @section fragmentEmissive
#include <emissivemap_fragment>
if(vColor.r > 0.7) totalEmissiveRadiance += vec3(0.75, 0.85, 1.0) * uGlow;
// @section crimeOverlayColor
vec3(2.2, 0.12, 0.1)
