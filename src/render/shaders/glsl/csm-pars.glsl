
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  struct CSMData { vec4 params; };
  uniform CSMData csmData;
  #define CSM_TAPS __SHADER_INJECT_0__
  #if defined( SHADOWMAP_TYPE_PCF )
  float csmPCF( sampler2DShadow map, vec2 size, float bias, float radius, vec4 sc, float phi ) {
    vec3 c = sc.xyz / sc.w; c.z += bias;
    float r = radius / size.x; float s = 0.0;
    for (int k = 0; k < CSM_TAPS; k++) s += textureLod( map, vec3( c.xy + vogelDiskSample( k, CSM_TAPS, phi ) * r, c.z ), 0.0 );
    return s / float( CSM_TAPS );
  }
  #endif
  float csmShadow() {
    float n0 = interleavedGradientNoise( gl_FragCoord.xy );
    float phi = fract( n0 + csmData.params.x ) * PI2;
    float s = 1.0; bool done = false;
    __SHADER_INJECT_1__
    return s;
  }
#endif
