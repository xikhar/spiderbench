// props shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
in vec4 aPuff;
uniform float uTime;
out float vFade;
out vec2 vPuv;
out float vAge;
// @section vertexBeginNormalVertex
vec3 objectNormal = normalize(vec3(0.0, 0.8, 0.0) + normalize(cameraPosition - aPuff.xyz));
#ifdef USE_TANGENT
vec3 objectTangent = vec3(1.0, 0.0, 0.0);
#endif
// @section vertexBeginVertex

float ph = fract(uTime * 0.11 + aPuff.w);
float lowV = aPuff.y < -1.0 ? 1.0 : 0.0;                  // (street r7) manhole wisp (vent y = -2.5): thinner, lower
float h = 5.5 * (1.0 - (1.0 - ph) * (1.0 - ph)) * (1.0 - 0.35 * lowV); // decelerating rise (~5.5 m)
float rad = mix(0.5, 3.0, sqrt(ph)) * (1.0 - 0.45 * lowV);
vec2 wind = vec2(0.8, 0.35) * (ph * ph * 3.2);
vec3 c = aPuff.xyz + vec3(wind.x + sin(aPuff.w * 40.0 + uTime * 0.6) * 0.35 * ph, 2.55 + h, wind.y + sin(aPuff.w * 23.0 + uTime * 0.4) * 0.5 * ph);
vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
float rot = aPuff.w * 17.0 + uTime * 0.12;
vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;
vec3 transformed = c + (camR * q.x * 1.25 + camU * q.y) * rad;
float dCam = length(cameraPosition - c);
vFade = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.25, 1.0, ph)) * (1.0 - smoothstep(160.0, 320.0, dCam)) * smoothstep(0.6, 2.5, dCam);                              // fade out when the lens is inside a puff
vAge = ph;
vPuv = uv * 0.45 + fract(vec2(aPuff.w * 3.1, aPuff.w * 7.7) + vec2(uTime * 0.01, - uTime * 0.03));
// @section vertexProjectVertex
vec4 mvPosition = viewMatrix * vec4(transformed, 1.0);
gl_Position = projectionMatrix * mvPosition;
// @section vertexWorldPositionVertex
vec4 worldPosition = vec4(transformed, 1.0);
// @section fragmentCommon
#include <common>
in float vFade;
in vec2 vPuv;
in float vAge;
// @section fragmentAlphaMap
{
float n = texture(alphaMap, vPuv).g * 0.55 + texture(alphaMap, vPuv * 2.7 + 0.37).r * 0.45;
float r = length(vAlphaMapUv - 0.5) * 2.0;
float disc = 1.0 - smoothstep(0.1, 1.0, r);
disc *= disc;
diffuseColor.a *= vFade * 0.3 * disc * smoothstep(0.25, 0.75, n + disc * 0.2 - vAge * 0.15);
if(diffuseColor.a < 0.008) discard;
}
// @section fragmentEmissive
#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * 0.06;
// @section vertexCommonByFaceUv
#include <common>
in vec4 aCell;
out vec2 vFaceUv;
// @section vertexUvVertex
#include <uv_vertex>
vFaceUv = uv;
vMapUv = aCell.xy + vec2(uv.y, 1.0 - uv.x) * aCell.zw; // text runs up the face
// @section vertexProjectVertexGrassFarCull
#include <project_vertex>
{
vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec2 dd = ip.xz - cameraPosition.xz;
if(dot(dd, dd) > 90000.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
} // beyond the blade frames' far cull (300 m)
// @section fragmentCommonByFaceUv
#include <common>
in vec2 vFaceUv;
uniform float uScreenK;
uniform float uNightK;
// @section fragmentEmissiveByFaceUv
#include <emissivemap_fragment>
{ // lit from inside: centre brightest, rim ~55 % (tubes behind the face); ~day level by day, x2.2 at night (screenK
          // cancels the preset exposure): a white board tops out ~0.13 pre-exposure = ~170 sRGB at night
float ex = min(vFaceUv.x, 1.0 - vFaceUv.x) * 2.0, ey = min(vFaceUv.y, 1.0 - vFaceUv.y) * 2.0 * 2.3;
float lit = 0.55 + 0.45 * smoothstep(0.0, 0.8, min(ex, ey));
          // (night r6) at night the board colour is lifted by a power curve on its peak channel (m^0.45): dark navy / green
          // boards glow ~110-150 sRGB while white glyphs stay ~0.75 of clip (critic r6: 'unlit painted boards' at x2.2 linear)
vec3 bt = diffuseColor.rgb;
float bm = max(max(bt.r, bt.g), bt.b) + 1e-4;
vec3 bNight = bt / bm * pow(bm, 0.45) * 2.0;
totalEmissiveRadiance += mix(bt * 0.5, bNight, uNightK) * lit * uScreenK;
}
// @section vertexCommonByGain
#include <common>
in vec4 aCell;
in float aGain;
out float vGain;
// @section vertexFogVertex
#include <fog_vertex>
vGain = aGain;
// @section vertexUvVertexByEmissiveMapUv
#include <uv_vertex>
#ifdef USE_MAP
vMapUv = aCell.xy + uv * aCell.zw;
#endif
#ifdef USE_EMISSIVEMAP
vEmissiveMapUv = vMapUv;
#endif
// @section fragmentCommonByGain
#include <common>
in float vGain;
uniform float uNightK;
// @section fragmentEmissiveByGain
#include <emissivemap_fragment>
totalEmissiveRadiance *= mix(vGain, max(vGain, 0.25), uNightK) / 0.06; // (night r9) rooftop prints floodlit at night
// @section fragmentMap
#include <map_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), 0.18) * 0.9 + 0.012;
// @section vertexCommonByPitCameraPosition
#include <common>
out vec3 vPitL;
out vec3 vPitCam;
// @section vertexProjectVertexByPitCameraPosition
#include <project_vertex>
vPitL = position;
        #ifdef USE_INSTANCING
vPitCam = (inverse(modelMatrix * instanceMatrix) * vec4(cameraPosition, 1.0)).xyz;
        #else
vPitCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
        #endif
// @section fragmentCommonByPitCameraPosition
#include <common>
uniform mat4 projectionMatrix;
in vec3 vPitL;
in vec3 vPitCam;
// @section fragmentClipping
#include <clipping_planes_fragment>
{
float h = vPitCam.y;
if(h < 0.04) discard;
float den = max(h - vPitL.y, 1e-3);
float tA = (h - 0.035) / den, tB = (h - 0.006) / den;
vec3 Q = vPitCam + (vPitL - vPitCam) * tB;
if(abs(Q.x) > 2.27 || abs(Q.z) > 0.83) discard;
float k = clamp(- vPitL.y / 4.0, 0.0, 1.0);
vec3 Pv = - vViewPosition;
vec4 cq = projectionMatrix * vec4(Pv * mix(tA, tB, k), 1.0);
vec4 cp = projectionMatrix * vec4(Pv, 1.0);
float nz = cq.z / cq.w, pz = cp.z / cp.w;
bool zeroOne = abs(gl_FragCoord.z - pz) < abs(gl_FragCoord.z - (0.5 * pz + 0.5));
gl_FragDepth = zeroOne ? nz : 0.5 * nz + 0.5;
}
