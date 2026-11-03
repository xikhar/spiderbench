
  #if NUM_DIR_LIGHT_SHADOWS > __SHADER_INJECT_0__
  {
    vec4 sc = vDirectionalShadowCoord[ __SHADER_INJECT_0__ ];
    vec3 c = sc.xyz / sc.w;
    vec2 e = min(c.xy, 1.0 - c.xy);
    if (min(e.x, e.y) > 0.02 && c.z <= 1.0 && c.z >= 0.0) {
      DirectionalLightShadow dls = directionalLightShadows[ __SHADER_INJECT_0__ ];
      #if defined( SHADOWMAP_TYPE_PCF )
        s = min( s, csmPCF( directionalShadowMap[ __SHADER_INJECT_0__ ], dls.shadowMapSize, dls.shadowBias, dls.shadowRadius, sc, phi ) );
      #endif
    }
  }
  #endif
