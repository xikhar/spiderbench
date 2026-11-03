// csm shader sections.

// @section cascadeDeclarations

#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
struct CSMData {
  vec4 params;
};
uniform CSMData csmData;
  #define CSM_TAPS __SHADER_INJECT_0__
  #if defined( SHADOWMAP_TYPE_PCF )
float csmPCF(sampler2DShadow map, vec2 size, float bias, float radius, vec4 sc, float phi) {
  vec3 c = sc.xyz / sc.w;
  c.z += bias;
  float r = radius / size.x;
  float s = 0.0;
  for(int k = 0; k < CSM_TAPS; k++) s += textureLod(map, vec3(c.xy + vogelDiskSample(k, CSM_TAPS, phi) * r, c.z), 0.0);
  return s / float(CSM_TAPS);
}
  #endif
float csmShadow() {
  float n0 = interleavedGradientNoise(gl_FragCoord.xy);
  float phi = fract(n0 + csmData.params.x) * PI2;
  float s = 1.0;
  bool done = false;
  __SHADER_INJECT_1__ return s;
}
#endif

// @section cascadeBlock

#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )

DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
DirectionalLightShadow directionalLightShadow;
	#endif

	// CSM sun: light 0 carries radiance; cascades 0..__SHADER_INJECT_0__ provide shadow maps
directionalLight = directionalLights[0];
getDirectionalLightInfo(directionalLight, directLight);
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
directLight.color *= (directLight.visible && receiveShadow) ? csmShadow() : 1.0;
	#endif
	#if defined( STANDARD ) || defined( LAMBERT )
{ // (night r6) moon on up-facing roofs / ground x shape.y^2 (1 by day): pale roofs read frosted from above (critic)
float csmUp = saturate(dot(geometryNormal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));
directLight.color *= mix(1.0, ambData.shape.y * ambData.shape.y, csmUp);
}
	#endif
{ // the sun is a disc, not a point: widen the specular lobe of very smooth surfaces for the key light only
	#ifdef STANDARD
float csmR = material.roughness;
material.roughness = max(csmR, 0.09);
RE_Direct(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
material.roughness = csmR;
	#else
RE_Direct(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
	#endif
}

	#if NUM_DIR_LIGHTS > __SHADER_INJECT_1__
	#pragma unroll_loop_start
for(int i = 0;
i < NUM_DIR_LIGHTS;
i ++) {
		#if ( UNROLLED_LOOP_INDEX >= __SHADER_INJECT_2__ )
directionalLight = directionalLights[i];
getDirectionalLightInfo(directionalLight, directLight);
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
directionalLightShadow = directionalLightShadows[i];
directLight.color *= (directLight.visible && receiveShadow) ? getShadow(directionalShadowMap[i], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[i]) : 1.0;
		#endif
RE_Direct(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
		#endif
}
	#pragma unroll_loop_end
	#endif

#endif

// @section cascadeTest

  #if NUM_DIR_LIGHT_SHADOWS > __SHADER_INJECT_0__
if(! done) {
vec4 sc = vDirectionalShadowCoord[__SHADER_INJECT_0__];
vec3 c = sc.xyz / sc.w;
vec2 e = min(c.xy, 1.0 - c.xy);
float edge = min(e.x, e.y);
    // world-anchored dither (hash of the light-space texel): the cascade choice in the blend band does not crawl
    // when the camera moves, and does not change from frame to frame
float rnd = fract(sin(dot(floor(c.xy * 1024.0), vec2(12.9898, 78.233))) * 43758.5453);
if(edge > csmData.params.y * rnd && c.z <= 1.0 && c.z >= 0.0) {
DirectionalLightShadow dls = directionalLightShadows[__SHADER_INJECT_0__];
      #if defined( SHADOWMAP_TYPE_PCF )
s = csmPCF(directionalShadowMap[__SHADER_INJECT_0__], dls.shadowMapSize, dls.shadowBias, dls.shadowRadius, sc, phi);
      #else
s = getShadow(directionalShadowMap[__SHADER_INJECT_0__], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, sc);
      #endif
done = true;
}
}
  #endif

// @section characterCascadeTest

  #if NUM_DIR_LIGHT_SHADOWS > __SHADER_INJECT_0__
{
vec4 sc = vDirectionalShadowCoord[__SHADER_INJECT_0__];
vec3 c = sc.xyz / sc.w;
vec2 e = min(c.xy, 1.0 - c.xy);
if(min(e.x, e.y) > 0.02 && c.z <= 1.0 && c.z >= 0.0) {
DirectionalLightShadow dls = directionalLightShadows[__SHADER_INJECT_0__];
      #if defined( SHADOWMAP_TYPE_PCF )
s = min(s, csmPCF(directionalShadowMap[__SHADER_INJECT_0__], dls.shadowMapSize, dls.shadowBias, dls.shadowRadius, sc, phi));
      #endif
}
}
  #endif
