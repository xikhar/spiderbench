// pool shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
__SHADER_INJECT_0__
// @section vertexProjectVertex
#include <project_vertex>
__SHADER_INJECT_0__
// @section fragmentCommon
#include <common>
__SHADER_INJECT_0__
// @section fragmentClipping
#include <clipping_planes_fragment>
__SHADER_INJECT_0__
// @section vertexCommonByDistanceFade
#include <common>
out float vDistFade;
// @section vertexProjectVertexByDistanceFade
#include <project_vertex>
        { vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz; vDistFade = clamp((__SHADER_INJECT_0__ - length(wp.xz - cameraPosition.xz)) / __SHADER_INJECT_1__, 0.0, 1.0); }
// @section fragmentCommonByDistanceFade
#include <common>
      in float vDistFade; uniform vec4 uLodFrame;
      float dfIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
// @section fragmentClippingByDistanceFade
#include <clipping_planes_fragment>
        if (vDistFade < 0.999 && fract(dfIGN(gl_FragCoord.xy + 7.0) + uLodFrame.x * 1.618034) >= vDistFade) discard;

// @section lodVertexDeclarations
in vec4 aLod; out float vLodIn; out float vLodOut;

// @section lodVertexFade

  #ifdef USE_INSTANCING
  {
    vec3 lodP = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
    float lodD = length(lodP.xz - cameraPosition.xz);
    vLodIn = aLod.y > aLod.x ? clamp((lodD - aLod.x) / (aLod.y - aLod.x), 0.0, 1.0) : 1.0;
    vLodOut = aLod.w > aLod.z ? clamp((aLod.w - lodD) / (aLod.w - aLod.z), 0.0, 1.0) : 1.0;
  }
  #else
  vLodIn = 1.0; vLodOut = 1.0;
  #endif

// @section lodFragmentDeclarations
in float vLodIn; in float vLodOut; uniform vec4 uLodFrame;
  float lodIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

// @section lodFragmentFade
{
    float lodN = fract(lodIGN(gl_FragCoord.xy) + uLodFrame.x * 1.618034);
    if (lodN >= vLodOut || lodN < 1.0 - vLodIn) discard;
  }
