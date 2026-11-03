// roofplants shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
in vec4 aPlant; out vec3 vPTint; out float vPY;
// @section vertexUvVertex
#include <uv_vertex>
#ifdef USE_INSTANCING
{ float t = floor(aPlant.x + 0.5), d = floor(aPlant.x / 4.0 + 0.001); // aPlant.x = tile + 4 * geometry default tile
t = t - d * 4.0;
vec2 off = vec2(mod(t, 2.0), floor(t / 2.0)) * 0.5 - vec2(mod(d, 2.0), floor(d / 2.0)) * 0.5;
vMapUv += off; }
#endif
vPTint = aPlant.yzw; vPY = position.y;
// @section fragmentCommon
#include <common>
      in vec3 vPTint; in float vPY;
// @section fragmentMap
#include <map_fragment>
      diffuseColor.rgb *= vPTint * mix(0.55, 1.0, smoothstep(0.0, 0.6, vPY)); // tint + darker at the soil (self-shade)
