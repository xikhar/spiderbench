if ( uNightK > 0.0 ) {
  float scrN = max( max( emissive.r, emissive.g ), emissive.b ) * __SHADER_INJECT_0__ + 1e-4;
  float scrM = max( max( totalEmissiveRadiance.r, totalEmissiveRadiance.g ), totalEmissiveRadiance.b ) / scrN;
  if ( scrM > uScrKnee ) { float scrW = uScrTop - uScrKnee; float scrY = uScrKnee + scrW * ( 1.0 - exp( - ( scrM - uScrKnee ) / scrW ) );
    totalEmissiveRadiance *= mix( 1.0, scrY / scrM, uNightK ); } }
