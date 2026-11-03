#include <map_fragment>
      { vec2 wp = vec2(vMapUv.x, -vMapUv.y) * 9.6;
        // (r7) large-scale colour variance (warm red-brown <-> cooler grey-pink fields), lighter polished walking lines,
        // darker grime along the building frontage
        float h1 = texture(tMacro, wp * 0.0071 + 0.53).b, h2 = texture(tMacro, wp * 0.021 + 0.21).r;
        diffuseColor.rgb *= mix(vec3(1.07, 0.97, 0.9), vec3(0.9, 0.96, 1.05), smoothstep(0.3, 0.72, h1));
        float path = smoothstep(0.55, 0.8, h2) * (0.6 + 0.4 * texture(tMacro, wp * 0.13).g);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + vec3(0.012, 0.011, 0.01), path * 0.7);
        float ex = abs(wp.x);
        diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(uEdgeX - 4.0, uEdgeX - 0.5, ex) * (0.6 + 0.4 * h2);
        // painted discs: worn, blotchy, paver texture multiplied through
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        for (int i = 0; i < 24; i++) {
          vec4 C = uCirc[i]; if (C.z < 0.0) continue;
          float d = length(wp - C.xy) - C.z;
          if (d > 0.05) continue;
          float m = 1.0 - smoothstep(-0.04, 0.03, d);
          float rim = (1.0 - smoothstep(-0.34, -0.3, d)) * smoothstep(-0.46, -0.42, d); // pale inner ring line
          vec3 pc = C.w < 0.5 ? vec3(0.07, 0.2, 0.3) : C.w < 1.5 ? vec3(0.09, 0.22, 0.24) : C.w < 2.5 ? vec3(0.16, 0.17, 0.2) : vec3(0.06, 0.12, 0.26);
          float wr = texture(tMacro, wp * 0.31 + C.xy * 0.01).g * 0.6 + texture(tMacro, wp * 1.9).r * 0.5;
          float keep = smoothstep(0.34, 0.62, wr);
          vec3 painted = pc * clamp(lum / 0.16, 0.45, 1.5);
          painted = mix(painted, vec3(0.5, 0.52, 0.52) * clamp(lum / 0.16, 0.45, 1.5), rim * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, painted, m * keep * 0.5); // (r8) fainter, worn (critic: 'cheap flat circles')
        } }
      { float a = texture(tMacro, vMapUv * 0.061).r, b = texture(tMacro, vMapUv * 0.23 + 0.37).g, c = texture(tMacro, vMapUv * 0.9 + 0.11).b;
        diffuseColor.rgb *= 0.74 + 0.42 * a * (0.7 + 0.6 * b);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))), 0.12 + 0.25 * smoothstep(0.55, 0.8, c));
        diffuseColor.rgb *= mix(1.0, texture(roughnessMap, vRoughnessMapUv).r, 0.8);
        diffuseColor.rgb = diffuseColor.rgb * 1.2 + vec3(0.014, 0.012, 0.011); // (r8) paler, sunlit pavers (director r7)
        // (r11) critic r9: 'pavers flat and too saturated, no grime' -> less chroma + a sooty film in the macro noise lows
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.2);
        diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(0.5, 0.2, a) * (0.5 + 0.5 * b); }