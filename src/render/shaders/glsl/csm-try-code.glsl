
  #if NUM_DIR_LIGHT_SHADOWS > __SHADER_INJECT_0__
  if (!done) {
    vec4 sc = vDirectionalShadowCoord[ __SHADER_INJECT_0__ ];
    vec3 c = sc.xyz / sc.w;
    vec2 e = min(c.xy, 1.0 - c.xy);
    float edge = min(e.x, e.y);
    // world-anchored dither (hash of the light-space texel): the cascade choice in the blend band does not crawl
    // when the camera moves, and does not change from frame to frame
    float rnd = fract( sin( dot( floor( c.xy * 1024.0 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    if (edge > csmData.params.y * rnd && c.z <= 1.0 && c.z >= 0.0) {
      DirectionalLightShadow dls = directionalLightShadows[ __SHADER_INJECT_0__ ];
      #if defined( SHADOWMAP_TYPE_PCF )
        s = csmPCF( directionalShadowMap[ __SHADER_INJECT_0__ ], dls.shadowMapSize, dls.shadowBias, dls.shadowRadius, sc, phi );
      #else
        s = getShadow( directionalShadowMap[ __SHADER_INJECT_0__ ], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, sc );
      #endif
      done = true;
    }
  }
  #endif
