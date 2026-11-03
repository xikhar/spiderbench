{
        float n = texture(alphaMap, vPuv).g * 0.55 + texture(alphaMap, vPuv * 2.7 + 0.37).r * 0.45;
        float r = length(vAlphaMapUv - 0.5) * 2.0;
        float disc = 1.0 - smoothstep(0.1, 1.0, r);
        disc *= disc;
        diffuseColor.a *= vFade * 0.3 * disc * smoothstep(0.25, 0.75, n + disc * 0.2 - vAge * 0.15);
        if (diffuseColor.a < 0.008) discard;
      }