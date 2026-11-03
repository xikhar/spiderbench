// treetrunk shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
in vec4 aBark;
out vec4 vBark;
out vec2 vBUv;
// @section vertexBeginVertex
#include <begin_vertex>
vBark = aBark;
vBUv = uv;
// @section fragmentCommon
#include <common>
uniform highp sampler2DArray tBarkC;
uniform highp sampler2DArray tBarkN;
in vec4 vBark;
in vec2 vBUv;
// @section fragmentMap

vec3 bkUv = vec3(vBUv, floor(vBark.x + 0.5));
vec4 bkC = texture(tBarkC, bkUv);
diffuseColor.rgb *= bkC.rgb * vBark.yzw;
// @section fragmentNormalMaps
#include <normal_fragment_maps>
{ // bark normal map in the derivative tangent frame (no tangent attribute)
vec3 mapN = texture(tBarkN, bkUv).xyz * 2.0 - 1.0;
mapN.xy *= 1.35;
vec3 q0 = dFdx(- vViewPosition), q1 = dFdy(- vViewPosition);
vec2 st0 = dFdx(vBUv), st1 = dFdy(vBUv);
vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);
vec3 Tt = q1p * st0.x + q0p * st1.x, Bt = q1p * st0.y + q0p * st1.y;
float det = max(dot(Tt, Tt), dot(Bt, Bt));
float sc = det == 0.0 ? 0.0 : inversesqrt(det);
normal = normalize(Tt * (mapN.x * sc) + Bt * (mapN.y * sc) + normal * mapN.z);
}
