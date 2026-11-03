vVehY = position.y; vVehAO = aAO;
      #ifdef USE_MAP
      if (aPart > 14.5 && aPart < 15.5 && uv.x > 0.499) {
        const float AH = 170.0 / 2048.0;
        float k = floor(fract(aSeed * 7.31 + 0.13) * 8.0);
        vMapUv = vec2(0.5 + mod(k, 2.0) * 0.25, floor(k / 2.0) * AH) + (uv - vec2(0.5, 0.0));
      }
      #endif
