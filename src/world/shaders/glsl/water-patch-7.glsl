__SHADER_INJECT_0__
        // (round 7) sun glitter: sparse sub-pixel facets on a finer, faster chop catch the sun (a sparkling glint path
        // toward the sun instead of one smooth lobe); fades with distance into the broad specular sheen
        #if ( NUM_DIR_LIGHTS > 0 )
        {
          vec2 gp = vWPw.xz;
          vec2 gn = wn(gp / 2.3 + vec2(uWTime * 0.05, uWTime * 0.034)) + 0.8 * wn(vec2(-gp.y, gp.x) / 3.7 + vec2(-uWTime * 0.041, uWTime * 0.02));
          vec3 nG = normalize(wN + vec3(gn.x, 0.0, gn.y) * 0.22 * (1.0 - 0.6 * wSlick));
          vec3 nGv = normalize((viewMatrix * vec4(nG, 0.0)).xyz);
          vec3 Hh = normalize(directLight.direction + geometryViewDir);
          float gl = pow(clamp(dot(nGv, Hh), 0.0, 1.0), 700.0);
          float spark = smoothstep(0.62, 0.9, texture(tWNoise, gp / 5.0 + vec2(uWTime * 0.02, 0.0)).r);
          float gfade = 1.0 - smoothstep(900.0, 4000.0, wDist);
          reflectedLight.directSpecular += directLight.color * gl * spark * gfade * 14.0 * wSh;
        }
        #endif