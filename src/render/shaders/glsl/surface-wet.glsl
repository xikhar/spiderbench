
#if defined( STANDARD ) && !defined( USE_SKINNING ) && !defined( NO_WET ) && !defined( USE_TRANSMISSION )
{
  vec3 wetUp = ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz;
  float wetFlat = smoothstep( 0.93, 0.985, dot( normalize( normal ), wetUp ) );
  vec3 wetDc = material.diffuseColor;
  float wetMx = max( wetDc.r, max( wetDc.g, wetDc.b ) ), wetMn = min( wetDc.r, min( wetDc.g, wetDc.b ) );
  float wetGrey = 1.0 - smoothstep( 0.18, 0.4, ( wetMx - wetMn ) / max( wetMx, 1e-3 ) );
  float wetRain = ambData.wx.x; // (lighting2 r3) overcast rain: the whole city is wet
  if ( ambData.city.w > 0.0 ) { // (lighting2 r5) Times Square at night: glossy, damp asphalt / pavers mirror the screens (ts_night ref)
    vec3 twp = cameraPosition + ( - vViewPosition ) * mat3( viewMatrix );
    float tsM = smoothstep( 112.0, 80.0, abs( twp.x ) ) * smoothstep( -352.0, -325.0, twp.z ) * smoothstep( 22.0, 0.0, twp.z ) * step( twp.y, 1.0 );
    wetRain = max( wetRain, 0.75 * tsM * clamp( ambData.city.w * 8.0, 0.0, 1.0 ) );
  }
  if ( wetRain > 0.0 ) {
    // rain-soaked everything: darker, glossier (walls, cars, paint); flat ground: a continuous water film
    material.diffuseColor *= 1.0 - 0.22 * wetRain;
    material.roughness = mix( material.roughness, material.roughness * 0.45, wetRain );
    wetGrey = mix( wetGrey, 1.0, wetRain * 0.85 );
  }
  // (lighting2 r3) no puddles past ~1 km: far flat grey plates (hinterland, far shores) at grazing angles turned into
  // mirrors of the horizon glow (a pale band along the night horizon)
  wetFlat *= 1.0 - smoothstep( 700.0, 1300.0, length( vViewPosition ) );
  wetFlat *= max( ambData.wx.w, clamp( wetRain * 4.0, 0.0, 1.0 ) ); // (user r-nopuddles) Settings > Puddles off: no water on the ground in dry weather (rain still wets it)
  if ( wetFlat * wetGrey > 0.01 ) {
    vec3 wetP = cameraPosition + ( - vViewPosition ) * mat3( viewMatrix );
    vec2 q = wetP.xz;
    // cheap value noise, 2 octaves (big puddle fields + ragged edges)
    vec2 i0 = floor( q / 7.0 ), f0 = fract( q / 7.0 ); f0 = f0 * f0 * ( 3.0 - 2.0 * f0 );
    #define WH(v) fract( sin( dot( v, vec2( 127.1, 311.7 ) ) ) * 43758.5453 )
    float n0 = mix( mix( WH( i0 ), WH( i0 + vec2( 1, 0 ) ), f0.x ), mix( WH( i0 + vec2( 0, 1 ) ), WH( i0 + vec2( 1, 1 ) ), f0.x ), f0.y );
    vec2 i1 = floor( q / 1.9 ), f1 = fract( q / 1.9 ); f1 = f1 * f1 * ( 3.0 - 2.0 * f1 );
    float n1 = mix( mix( WH( i1 ), WH( i1 + vec2( 1, 0 ) ), f1.x ), mix( WH( i1 + vec2( 0, 1 ) ), WH( i1 + vec2( 1, 1 ) ), f1.x ), f1.y );
    #undef WH
    float wetN = n0 * 0.72 + n1 * 0.28;
    float wetH = mix( 0.4, 1.0, smoothstep( 4.0, 10.0, wetP.y ) ); // streets: fewer / smaller puddles than roofs
    float wetT = 0.3 * wetRain; // rain: puddles grow, the rest of the ground is a damp film
    // (zfix) dry presets (no rain): ~35-40 % fewer / smaller puddles, pooled mostly in the kerb gutters of the grid
    // roads, in low spots (a 23 m noise field) and around the roof drains; the rain look (wetRain > 0) is unchanged
    float wetSh = 0.0, wetDry = max( __SHADER_INJECT_0__ - clamp( wetRain * 4.0, 0.0, 1.0 ), 0.0 ); // ?oldpuddles: the previous dry look (A/B)
    if ( wetDry > 0.0 ) {
      vec2 lq = q / 23.0 + vec2( 5.3, 9.01 ), li = floor( lq ), lf = fract( lq ); lf = lf * lf * ( 3.0 - 2.0 * lf );
      #define WL(v) fract( sin( dot( v, vec2( 269.5, 183.3 ) ) ) * 43758.5453 )
      float wetL = mix( mix( WL( li ), WL( li + vec2( 1, 0 ) ), lf.x ), mix( WL( li + vec2( 0, 1 ) ), WL( li + vec2( 1, 1 ) ), lf.x ), lf.y );
      #undef WL
      float wetLow = smoothstep( 0.45, 0.8, wetL ) * ( wetP.y > 4.0 ? 1.0 : 0.45 ), wetGut = 0.0;
      if ( wetP.y < 0.1 && wetP.z < __SHADER_INJECT_1__ && !( wetP.x > __SHADER_INJECT_2__ && wetP.x < __SHADER_INJECT_3__ && wetP.z > __SHADER_INJECT_4__ && wetP.z < __SHADER_INJECT_5__ ) ) {
        float dk = 9.0; // distance inside the roadway to the nearest kerb line (grid avenues + streets)
        __SHADER_INJECT_6__
        float zc = floor( wetP.z / __SHADER_INJECT_7__ + 0.5 ) * __SHADER_INJECT_8__, hw = __SHADER_INJECT_9__;
        __SHADER_INJECT_10__
        __SHADER_INJECT_11__
        float dz = abs( wetP.z - zc ); if ( dz < hw ) dk = min( dk, hw - dz );
        wetGut = 1.0 - smoothstep( 0.4, 1.6, dk );
      }
      wetSh = wetDry * ( 0.095 - 0.13 * max( wetGut, wetLow ) );
    }
    float wetM = smoothstep( 0.63 + 0.05 * ( 1.0 - wetH ) - wetT + wetSh, 0.7 + 0.05 * ( 1.0 - wetH ) - wetT + wetSh - 0.01 * wetDry, wetN ) * wetFlat * wetGrey;
    float damp = max( smoothstep( 0.48 + wetSh + 0.02 * wetDry, 0.62 + wetSh + 0.02 * wetDry, wetN ), wetRain ) * wetFlat * wetGrey; // damp rim: darker, semi-glossy
    if ( wetRain * wetM > 0.01 ) { // rain ripples on the puddles: expanding rings in two jittered cell layers
      vec2 rg = vec2( 0.0 );
      for ( int k = 0; k < 2; k++ ) {
        vec2 rq = q / ( 0.55 + 0.3 * float( k ) ) + float( k ) * 7.31;
        vec2 rc = floor( rq ), rf = fract( rq ) - 0.5;
        float rh = fract( sin( dot( rc, vec2( 12.99, 78.23 ) ) ) * 43758.55 );
        vec2 ro = rf - ( vec2( fract( rh * 7.1 ), fract( rh * 13.7 ) ) - 0.5 ) * 0.5;
        float rt = fract( ambData.wx.y * 1.1 + rh ), rd = length( ro );
        float ring = sin( ( rd - rt * 0.5 ) * 45.0 ) * exp( - pow( ( rd - rt * 0.5 ) * 14.0, 2.0 ) ) * ( 1.0 - rt );
        rg += ro / max( rd, 1e-3 ) * ring;
      }
      normal = normalize( normal + ( viewMatrix * vec4( rg.x, 0.0, rg.y, 0.0 ) ).xyz * 0.35 * wetM * wetRain );
    }
    material.roughness = mix( material.roughness, 0.3, damp * 0.6 );
    material.roughness = mix( material.roughness, 0.045, wetM );
    material.diffuseColor *= 1.0 - 0.28 * damp - 0.22 * wetM;
    material.specularColor = mix( material.specularColor, vec3( 0.02 ), wetM ); // a water film: dielectric F0 whatever lies below
    material.specularF90 = mix( material.specularF90, 1.0, wetM );
  }
}
#endif
