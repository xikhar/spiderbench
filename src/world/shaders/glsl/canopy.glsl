// canopy shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
out float vCy;
out vec3 vCn;
out vec3 vCi;
// @section vertexBeginVertex
#include <begin_vertex>
vCy = position.y;
vCn = normal;
vCi = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
__SHADER_INJECT_0__
// @section fragmentCommon
#include <common>
in float vCy;
in vec3 vCn;
in vec3 vCi;
float cClump;
float cH3(vec3 p) {
return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float cVn(vec3 p) {
vec3 i = floor(p), f = fract(p);
f = f * f * (3.0 - 2.0 * f);
return mix(mix(mix(cH3(i), cH3(i + vec3(1, 0, 0)), f.x), mix(cH3(i + vec3(0, 1, 0)), cH3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(cH3(i + vec3(0, 0, 1)), cH3(i + vec3(1, 0, 1)), f.x), mix(cH3(i + vec3(0, 1, 1)), cH3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// @section fragmentColor
#include <color_fragment>
diffuseColor.rgb *= mix(0.45, 1.05, smoothstep(- 0.9, 0.7, vCy));   // dark underside / inner crown
diffuseColor.rgb *= 0.92 + 0.16 * fract(sin(dot(floor(vCn * 2.0 + 0.5), vec3(12.9, 78.2, 37.7))) * 4375.5); // clump tone breakup
// (round 7) cauliflower foliage clusters: leaf-mass lumps with dark gaps between them (per-crown phase), so the
// crowns read as trees, not smooth cotton balls / lollipops
cClump = cVn(vCn * 3.3 + vCi * 0.137) * 0.62 + cVn(vCn * 7.9 + vCi * 0.291) * 0.38;
diffuseColor.rgb *= mix(0.58, 1.1, smoothstep(0.28, 0.72, cClump));
// @section fragmentNormalMaps
#include <normal_fragment_maps>
{
vec3 sx = normalize(dFdx(- vViewPosition)), sy = normalize(dFdy(- vViewPosition));
vec2 dh = vec2(dFdx(cClump), dFdy(cClump)) * 2.2;
vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
float det = dot(sx, r1);
vec3 bn = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
if(det != 0.0) normal = bn;
}

// @section distanceFade
{
vec3 ic = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
float fs = smoothstep(__SHADER_INJECT_0__, __SHADER_INJECT_1__, length(ic - cameraPosition));
transformed *= max(fs, 1e-3);
}
