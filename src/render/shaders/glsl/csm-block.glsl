
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )

	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif

	// CSM sun: light 0 carries radiance; cascades 0..__SHADER_INJECT_0__ provide shadow maps
	directionalLight = directionalLights[ 0 ];
	getDirectionalLightInfo( directionalLight, directLight );
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	directLight.color *= ( directLight.visible && receiveShadow ) ? csmShadow() : 1.0;
	#endif
	#if defined( STANDARD ) || defined( LAMBERT )
	{ // (night r6) moon on up-facing roofs / ground x shape.y^2 (1 by day): pale roofs read frosted from above (critic)
		float csmUp = saturate( dot( geometryNormal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ) );
		directLight.color *= mix( 1.0, ambData.shape.y * ambData.shape.y, csmUp );
	}
	#endif
	{ // the sun is a disc, not a point: widen the specular lobe of very smooth surfaces for the key light only
	#ifdef STANDARD
	float csmR = material.roughness; material.roughness = max( csmR, 0.09 );
	RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	material.roughness = csmR;
	#else
	RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	#endif
	}

	#if NUM_DIR_LIGHTS > __SHADER_INJECT_1__
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		#if ( UNROLLED_LOOP_INDEX >= __SHADER_INJECT_2__ )
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
		#endif
	}
	#pragma unroll_loop_end
	#endif

#endif

