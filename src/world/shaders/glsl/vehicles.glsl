// vehicles shader sections. Use parseShaderSections() to select an injection chunk.
// @section fragmentCommon
#include <common>
in float vVehY;
in float vVehAO;
// @section fragmentPaintBaseColor
diffuseColor.rgb = min(diffuseColor.rgb * vec3(0.27, 0.285, 0.3), vec3(0.12));
pR = 0.07;
// @section fragmentPhysicalLightDeclarations
#include <lights_physical_pars_fragment>
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
vec3 vehHorizon(vec3 viewDir, vec3 n, float rough) {
vec3 r = transformDirectionByInverseViewMatrix(reflect(- viewDir, n), viewMatrix);
float h = r.y;
vec3 sky = textureCubeUV(envMap, envMapRotation * normalize(vec3(r.x, max(h, 0.1), r.z)), max(rough, 0.03)).rgb * envMapIntensity;
vec3 hor = textureCubeUV(envMap, envMapRotation * normalize(vec3(r.x, 0.35, r.z)), 0.5).rgb * envMapIntensity;
float id = floor(atan(r.z, r.x) * 11.0);
float bt = 0.03 + 0.24 * fract(sin(id * 12.9898) * 43758.5453);   // building tops (elevation, ~2-15 deg)
float e = 0.006 + rough * 0.4;
float bld = 1.0 - smoothstep(bt - e, bt + e, h);
float gnd = 1.0 - smoothstep(- 0.04 - e, 0.0 + e, h);
vec3 c = sky * 1.25;
c = mix(c, hor * (0.24 + 0.1 * fract(id * 0.618)), bld);
c = mix(c, hor * 0.04, gnd);
return c;
}
#endif
// @section fragmentLightsMaps
#include <lights_fragment_maps>
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV ) && defined( RE_IndirectSpecular )
if(P == 3) radiance = min(mix(radiance, vehHorizon(geometryViewDir, geometryNormal, material.roughness) * 0.7, 0.85), vec3(1.1)); // (vehicles r4) no blown white sky blocks on glass from above
#ifdef USE_CLEARCOAT
else if(P == 1 || P == 0 || P == 15 || P == 7 || P == 8) clearcoatRadiance = mix(clearcoatRadiance, vehHorizon(geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness) * (P == 1 ? 2.1 : P == 0 ? 1.5 : 1.0), 0.9); // (vehicles r3) paint: stronger reflection read ((vehicles r4) x2.1 paint, x1.5 white bodies: director 'weak on yellow/white')
#else
else if(P == 1) radiance = mix(radiance, vehHorizon(geometryViewDir, geometryNormal, material.roughness), 0.5);
#endif
#endif
// @section fragmentRoughnessFromVehicleMaterial

float gk = 1.0 - smoothstep(0.16, 0.5, vVehY);              // (vehicles) grime band on the lower panels ((vehicles r3) lower + lighter: sills / arches only)
float vehCC = 0.0;
if(P == 1 || P == 0) {
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.72, 0.68, 0.62), gk * 0.7);
pR = mix(P == 1 ? 0.26 : 0.45, 0.65, gk * 0.7);
vehCC = (P == 1 ? 1.0 : 0.7) * (1.0 - gk * 0.6);
} else if(P == 15) vehCC = 0.8;
else if(P == 3) vehCC = 0.0;                                  // (vehicles r3) one glossy layer on glass (two layers = blown double sun glint)
else if(P == 7 || P == 8) vehCC = 0.9;
float vAOe = (P == 2 || P == 5) ? mix(vVehAO, 1.0, 0.65) : vVehAO; // (vehicles r2) baked AO (wheels sit deep in the wells: softened)
diffuseColor.rgb *= mix(1.0, vAOe, 0.55);                    // cavities / wheel wells / under-body
roughnessFactor = pR;
// @section fragmentAmbientOcclusion
#include <aomap_fragment>
{                                                             // (vehicles r2) baked AO occludes sky light + reflections
float vAOk = clamp(vAOe * 1.08, 0.0, 1.0);
reflectedLight.indirectDiffuse *= vAOk;
reflectedLight.indirectSpecular *= vAOk * vAOk;
if(P == 3) reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(0.7)); // (vehicles r4) no blown sun glint on (rear) glass
#if defined( USE_CLEARCOAT )
clearcoatSpecularIndirect *= vAOk * vAOk;
#endif
}
// @section fragmentPhysicalLights
#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoat = vehCC;
#endif

// @section vertexAttributeDeclarations
out float vVehY;
in float aAO;
out float vVehAO;
in float aSeed;

// @section vertexMain
vVehY = position.y;
vVehAO = aAO;
#ifdef USE_MAP
if(aPart > 14.5 && aPart < 15.5 && uv.x > 0.499) {
const float AH = 170.0 / 2048.0;
float k = floor(fract(aSeed * 7.31 + 0.13) * 8.0);
vMapUv = vec2(0.5 + mod(k, 2.0) * 0.25, floor(k / 2.0) * AH) + (uv - vec2(0.5, 0.0));
}
#endif
