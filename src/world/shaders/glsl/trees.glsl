// trees shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
in vec2 aLeaf;
in vec3 aTintA;
in vec3 aTintB;
in float aSway;
out vec2 vLeaf;
out vec3 vTA;
out vec3 vTB;
uniform float uTime;
// @section vertexBeginVertex
#include <begin_vertex>
vLeaf = aLeaf;
vTA = aTintA;
vTB = aTintB;
#ifdef USE_INSTANCING
vec3 ip = instanceMatrix[3].xyz;
float ph = dot(ip, vec3(0.13, 0.0, 0.17));
// crown sway (slow) + leaf-spray flutter (fast, outer cards only)
transformed.xz += vec2(sin(uTime * 1.3 + ph + position.y * 0.4), cos(uTime * 1.1 + ph)) * 0.05 * position.y * 0.12;
if(aLeaf.x < 1.5) transformed += vec3(sin(uTime * 4.1 + dot(position, vec3(3.1, 1.7, 2.3))), sin(uTime * 3.3 + dot(position, vec3(1.9, 2.9, 1.3))), 0.0).xzy * 0.035 * aLeaf.x;
#endif
// @section fragmentCommon
#include <common>
in vec2 vLeaf;
in vec3 vTA;
in vec3 vTB;
uniform sampler2D uLeafN;
uniform vec4 uLeafFrame;
float leafIGN(vec2 p) {
return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
// @section fragmentMap

bool core = vLeaf.x >= 1.5;
vec2 luv = core ? fract(vMapUv) : vMapUv;
vec2 gx = dFdx(vMapUv), gy = dFdy(vMapUv);
vec4 tx = textureGrad(map, luv, gx, gy);
float expo = core ? (vLeaf.x - 2.0) : vLeaf.x;
if(core) { // solid inner mass: leaf texture where it has coverage, otherwise deep shade
vec4 t2 = textureGrad(map, fract(vMapUv * 0.7 + 0.31), gx * 0.7, gy * 0.7);
float cov = max(tx.a, t2.a);
tx = tx.a > 0.5 ? tx : t2;
tx.r = tx.g > 0.96 ? 0.55 : (tx.a > 0.5 ? tx.r * 0.85 : 0.45);
tx.b = 0.0;
tx.g = min(tx.g, 0.94);
          // grazing core surface (its silhouette) takes the leaf coverage, so the solid mass never shows a faceted edge
float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
tx.a = facing > 0.45 ? 1.0 : cov;
}
if(! core) { // cards seen edge-on smear the texture: dissolve them (the neighbouring cards fill in)
vec3 fn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
tx.a *= smoothstep(0.12, 0.4, abs(dot(fn, normalize(vViewPosition))));
}
diffuseColor.a *= tx.a;
float twig = step(0.97, tx.g);
float hsel = tx.g * 0.8 + vLeaf.y * 0.55 - 0.18;
vec3 leaf = mix(vTA, vTB, smoothstep(0.15, 0.85, hsel));
// a scatter of dry brown / still-green-ish leaves
float odd = fract(tx.g * 13.7 + vLeaf.y * 5.3);
leaf = odd > 0.93 ? vec3(0.13, 0.06, 0.025) : (odd < 0.035 ? vec3(0.16, 0.14, 0.035) : leaf);
leaf *= 0.42 + 0.72 * tx.r;
// self-occlusion: deep / underside leaves and the back of each spray fall into shade
float occ = mix(0.4, 1.0, pow(clamp(expo, 0.0, 1.0), 1.4)) * mix(0.62, 1.0, tx.b);
if(core) occ = mix(0.24, 0.42, clamp(expo, 0.0, 1.0));
vec3 c = twig > 0.5 ? vec3(0.085, 0.06, 0.042) : leaf;
diffuseColor.rgb *= c * occ;
float leafExpo = core ? 0.0 : clamp(expo, 0.0, 1.0);

// @section fragmentAlphaTest

// alpha-to-coverage for the TAA pipeline: stochastic threshold per pixel/frame -> TAA resolves soft, density-
// preserving edges (distant sprays keep their filtered coverage instead of thinning out)
{
float n = fract(leafIGN(gl_FragCoord.xy + 17.0) + uLeafFrame.x * 2.618034);
if(diffuseColor.a < mix(0.2, 0.7, n)) discard;
diffuseColor.a = 1.0;
}
// @section fragmentNormalBegin
#include <normal_fragment_begin>
normal = normalize(vNormal);
{ // per-leaf normals from the atlas, in the derivative tangent frame (the core: strong, so it never shades as a ball)
vec3 mapN = texture(uLeafN, core ? fract(vMapUv) : vMapUv).xyz * 2.0 - 1.0;
if(core) mapN.xy *= 2.2;
vec3 q0 = dFdx(- vViewPosition), q1 = dFdy(- vViewPosition);
vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);
vec3 Tt = q1p * gx.x + q0p * gy.x, Bt = q1p * gx.y + q0p * gy.y;
float det = max(dot(Tt, Tt), dot(Bt, Bt));
float sc = det == 0.0 ? 0.0 : inversesqrt(det);
normal = normalize(normal * max(mapN.z, 0.3) + (Tt * mapN.x + Bt * mapN.y) * sc * 0.9);
}
// @section fragmentLightsBegin
vec3 leafSun = vec3(0.0);
vec3 leafSunDir = vec3(0.0, 1.0, 0.0);
__SHADER_INJECT_0__
// @section fragmentLightsEnd
#include <lights_fragment_end>
{ // thin-leaf translucency: sun shining through the outer leaves toward the camera, plus wrapped back-light
vec3 V = normalize(vViewPosition);
float thr = pow(clamp(dot(- V, leafSunDir), 0.0, 1.0), 4.0);
float back = clamp(dot(- normal, leafSunDir), 0.0, 1.0);
float k = leafExpo * leafExpo * (1.0 - twig);
reflectedLight.directDiffuse += diffuseColor.rgb * leafSun * RECIPROCAL_PI * k * (thr * 2.2 + back * 0.6);
}
// @section fragmentEmissive
#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * vec3(0.13, 0.1, 0.06) * ambData.vert.x * ambData.bounce.w; // skylight transmitted through the leaves (warm) (lighting2 r6: x vertical-fill gain, off at night: canopies in shade read dark)
// @section vertexCommonLeafCanopyData
#include <common>
in vec2 aLeaf;
in vec3 aTintA;
in vec3 aTintB;
out vec2 vLeaf;
out vec3 vTA;
out vec3 vTB;
out vec3 vCW;
out vec3 vCN;
out vec3 vCI;
// @section vertexBeginVertexLeafCanopyData
#include <begin_vertex>
vLeaf = aLeaf;
vTA = aTintA;
vTB = aTintB;
      #ifdef USE_INSTANCING
vCW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
vCN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
vCI = instanceMatrix[3].xyz;
      #else
vCW = (modelMatrix * vec4(position, 1.0)).xyz;
vCN = normal;
vCI = vec3(0.0);
      #endif
// @section fragmentCommonLeafCanopyData
#include <common>
in vec2 vLeaf;
in vec3 vTA;
in vec3 vTB;
in vec3 vCW;
in vec3 vCN;
in vec3 vCI;
uniform sampler2D uLeafN;
uniform vec4 uLeafFrame;
float crClump;
float crIGN(vec2 p) {
return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
float crH3(vec3 p) {
return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float crVn(vec3 p) {
vec3 i = floor(p), f = fract(p);
f = f * f * (3.0 - 2.0 * f);
return mix(mix(mix(crH3(i), crH3(i + vec3(1, 0, 0)), f.x), mix(crH3(i + vec3(0, 1, 0)), crH3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(crH3(i + vec3(0, 0, 1)), crH3(i + vec3(1, 0, 1)), f.x), mix(crH3(i + vec3(0, 1, 1)), crH3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// @section fragmentMapByLeafTintB

// procedural foliage (no texture: a tiled leaf atlas reads as a checker from afar): clumps (~2.4 m) of
// sub-clumps (~0.7 m) of leaf speckle (~0.25 m), per-crown phase; dark gaps between the clumps
vec3 cp = vCW + vCI * 0.37;
float n1 = crVn(cp * 0.62), n2 = crVn(cp * 2.1 + 3.1), n3 = crVn(cp * 5.3 + 7.7); // (park r2) finer clumps
crClump = n1 * 0.65 + n2 * 0.35;
vec4 tx = vec4(n3, n2, 0.0, 1.0);
float cov = smoothstep(0.18, 0.55, crClump * 0.8 + n3 * 0.35);
float expo = clamp(vLeaf.x, 0.0, 1.0);
float hsel = 0.5 + (n2 - 0.5) * 0.7 + (vLeaf.y - 0.5) * 0.35 + (n1 - 0.5) * 0.4;
vec3 leaf = mix(vTA, vTB, smoothstep(0.1, 0.9, hsel));
leaf *= 0.74 + 0.34 * n3;
leaf = fract(n3 * 17.3 + vLeaf.y * 3.1) > 0.97 ? leaf * vec3(0.55, 0.4, 0.3) : leaf; // dry leaves
vec3 c = mix(vTB * 0.42, leaf, smoothstep(0.3, 0.62, crClump + n3 * 0.22)); // (park r2) deeper gaps between clumps
c *= mix(vec3(1.0), vec3(1.12, 1.1, 0.8), smoothstep(0.62, 0.9, n2) * 0.6); // sunlit yellowing leaf tips
float occ = mix(0.3, 1.14, pow(expo, 1.25)) * mix(0.66, 1.1, smoothstep(0.3, 0.75, crClump)); // (park r4) crowns separate: dark skirts, sunlit domes
diffuseColor.rgb *= c * occ;
// silhouette: grazing faces keep only the leaf coverage -> ragged, see-through crown edges
float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
float alpha = mix(cov * 1.25, 1.0, smoothstep(0.3, 0.72, facing));
{
float n = fract(crIGN(gl_FragCoord.xy + 5.0) + uLeafFrame.x * 2.618034);
if(alpha < mix(0.25, 0.75, n)) discard;
}

// @section fragmentNormalMaps
#include <normal_fragment_maps>
{
vec3 sx = normalize(dFdx(- vViewPosition)), sy2 = normalize(dFdy(- vViewPosition));
vec2 dh = vec2(dFdx(crClump), dFdy(crClump)) * 3.0 + (vec2(dFdx(tx.r), dFdy(tx.r)) * 0.5);
vec3 r1 = cross(sy2, normal), r2 = cross(normal, sx);
float det = dot(sx, r1);
if(det != 0.0) normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
}
// @section fragmentEmissiveLeafLightTransmission
#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * vec3(0.11, 0.095, 0.06) * expo * expo * ambData.vert.x * ambData.bounce.w; // (lighting2 r6)
