// boats shader sections. Use parseShaderSections() to select an injection chunk.
// @section fragmentCommon
#include <common>
uniform float uNightK;
// @section fragmentColor
#include <color_fragment>
diffuseColor.rgb *= mix(1.0, 0.025, uNightK);
