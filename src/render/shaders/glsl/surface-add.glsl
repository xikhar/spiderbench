
#if defined( STANDARD ) && defined( OPAQUE ) && !defined( NO_SSR ) && !defined( USE_TRANSMISSION )
{
  float ssrRough = material.roughness;
  vec3 ssrF = EnvironmentBRDF( normal, geometryViewDir, material.specularColor, material.specularF90, ssrRough );
  float ssrW = dot( ssrF, vec3( 0.2126, 0.7152, 0.0722 ) ) * ( 1.0 - smoothstep( 0.16, 0.36, ssrRough ) );
  #ifdef USE_CLEARCOAT
    vec3 ssrC = EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
    ssrW = max( ssrW, material.clearcoat * dot( ssrC, vec3( 0.2126, 0.7152, 0.0722 ) ) * ( 1.0 - smoothstep( 0.16, 0.36, material.clearcoatRoughness ) ) );
  #endif
  pc_fragColor.a = 1.0 + clamp( ssrW, 0.0, 0.98 );
}
#endif
