
#if defined( USE_CITYL ) && defined( RE_Direct )
if ( cityL.origin.w > 0.0 ) {
  vec3 clWP = cameraPosition + geometryPosition * mat3( viewMatrix );
  int clBx, clBy; uvec4 clH0;
  int clN = cityLCell( clWP, clBx, clBy, clH0 );
  if ( clN > 0 ) {
    #if defined( STANDARD ) && !( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
    material.multiScatteringCompensation = vec3( 1.0 );
    #endif
    #if defined( STANDARD ) && !defined( USE_CLEARCOAT ) && !defined( USE_SHEEN ) && !defined( USE_IRIDESCENCE ) && !defined( USE_ANISOTROPY )
      #define CL_FAST
    #endif
    float clK = cityL.misc.x * cityLEdge( clWP );
    mat3 clVM = mat3( viewMatrix );
    vec3 clE = vec3( 0.0 );
    cityLRefl = normalize( reflect( - geometryViewDir, geometryNormal ) * clVM ); // world-space reflection ray (spec representative point)
    #ifdef CL_FAST
    bool clSpec = material.roughness < 0.75;
    #ifdef CITYL_NOSPEC
    clSpec = false; // (night r11) material opt-out (LED screens: matte louvred panels; a neighbour's light smeared a long glossy streak across the TS perch screen)
    #endif
    float clR = material.roughness, clRorig = material.roughness;
    { // (night r10) specular anti-aliasing for the local lights: normal-map detail (asphalt aggregate) under a lamp or
      // headlight broke into glitter; widen the lobe by the screen-space normal variation (flat puddles keep their mirror)
      vec3 clDn = fwidth( geometryNormal ); float clV = dot( clDn, clDn );
      clR = min( 1.0, sqrt( clR * clR + 0.6 * clV ) );
    }
    #endif
    // (perf) lights are sorted strongest first: far surfaces and alpha-tested foliage only take the dominant ones
    int clMax = clN;
    #if defined( USE_ALPHATEST ) || defined( USE_ALPHAHASH )
    clMax = min( clMax, 6 );
    #endif
    clMax = min( clMax, int( mix( __SHADER_INJECT_0__.0, 8.0, smoothstep( 30.0, 160.0, length( geometryPosition ) ) ) ) ); // (perf r5) screens + signs raised TS to ~870 lights
    for ( int i = 0; i < __SHADER_INJECT_1__; i ++ ) {
      if ( i >= clMax ) break;
      vec3 clL; float clWd;
      float clSk;
      vec3 clC = cityLIncident2( cityLIndex( i, clBx, clBy, clH0 ), clWP, clL, clWd, clSk );
      if ( clC.r + clC.g + clC.b <= 1e-5 ) continue;
      vec3 clLv = normalize( clVM * clL );
      #ifdef CL_FAST
      float clNL = saturate( ( dot( geometryNormal, clLv ) + clWd ) / ( 1.0 + clWd ) ); // (night r9) wrap by the source's angular size: big screens light faces at grazing angles softly (no crisp reveal edges)
      #if defined( USE_ALPHATEST ) && defined( DOUBLE_SIDED )
      { // (night r9) foliage (alpha-tested, double-sided leaf cards): leaves transmit and scatter light, so a lamp lights a
        // canopy as a soft glowing volume, not leaf-by-leaf cut-outs (the blotchy 'grid-like' texture around lamp heads)
        float clNd = dot( geometryNormal, clLv );
        clNL = 0.22 + 0.55 * saturate( clNd ) + 0.28 * saturate( - clNd ); // front lit + light transmitted from behind
        // leaves a metre from a lamp head would be 30x the pool below and clip in patches: smooth compression
        clC *= 1.1 / ( 1.1 + max( clC.r, max( clC.g, clC.b ) ) );
      }
      #endif
      if ( clNL <= 0.0 ) continue;
      vec3 clIrr = clC * ( clK * clNL );
      clE += clIrr;
      if ( clSpec ) { // (night r10) representative point along the reflection ray + energy normalisation (a / a')^2 (Karis 2013):
        // a mirror-like surface shows the emitter's shape at its real brightness instead of a clipped disc
        vec3 clLs = normalize( clVM * cityLSpecDir );
        float clNLs = saturate( dot( geometryNormal, clLs ) );
        float clA = clR * clR, clA2 = min( 1.0, clA + 0.5 * cityLAng ), clNorm = ( clA * clA ) / max( clA2 * clA2, 1e-8 );
        material.roughness = clR;
        reflectedLight.directSpecular += clC * ( clK * clNLs * clSk * clNorm ) * BRDF_GGX( clLs, geometryViewDir, geometryNormal, material ) * material.multiScatteringCompensation;
      }
      #else
      IncidentLight clI; clI.direction = clLv; clI.color = clC * clK; clI.visible = true;
        #ifdef STANDARD
        float clR0 = material.roughness; material.roughness = min( 1.0, clR0 + clWd );
        RE_Direct( clI, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
        material.roughness = clR0;
        #else
        RE_Direct( clI, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
        #endif
      #endif
    }
    #ifdef CL_FAST
    material.roughness = clRorig;
    reflectedLight.directDiffuse += clE * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - material.specularColorBlended * 0.5 );
    #undef CL_FAST
    #endif
  }
}
#endif
