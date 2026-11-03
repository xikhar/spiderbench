{
      vec3 c = texture(emissiveMap, vEmissiveMapUv).rgb, b = textureLod(emissiveMap, vEmissiveMapUv, 5.0).rgb;
      float m = smoothstep(0.1, 0.3, length(c - b));
      if (m < 0.4) discard;
      totalEmissiveRadiance = emissive * mix(vColor.rgb, vec3(1.0, 0.96, 0.92), 0.45 * smoothstep(0.65, 1.0, m)) * m; }