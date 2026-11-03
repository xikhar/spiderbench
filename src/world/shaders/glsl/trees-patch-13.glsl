
        // procedural foliage (no texture: a tiled leaf atlas reads as a checker from afar): clumps (~2.4 m) of
        // sub-clumps (~0.7 m) of leaf speckle (~0.25 m), per-crown phase; dark gaps between the clumps
        vec3 cp = vCW + vCI * 0.37;
        float n1 = crVn(cp * 0.62), n2 = crVn(cp * 2.1 + 3.1), n3 = crVn(cp * 5.3 + 7.7); // (park r2) finer clumps
        crClump = n1 * 0.65 + n2 * 0.35;
        vec4 tx = vec4(n3, n2, 0.0, 1.0);
        float cov = smoothstep(0.18, 0.55, crClump * 0.8 + n3 * 0.35);
        float expo = clamp(vLeaf.x, 0.0, 1.0);
        float hsel = 0.5 + (n2 - 0.5) * 0.7 + (vLeaf.y - 0.5) * 0.35 + (n1 - 0.5) * 0.4;
        vec3 leaf = mix(vTA, vTB, smoothstep(0.1, 0.9, hsel));
        leaf *= 0.74 + 0.34 * n3;
        leaf = fract(n3 * 17.3 + vLeaf.y * 3.1) > 0.97 ? leaf * vec3(0.55, 0.4, 0.3) : leaf; // dry leaves
        vec3 c = mix(vTB * 0.42, leaf, smoothstep(0.3, 0.62, crClump + n3 * 0.22)); // (park r2) deeper gaps between clumps
        c *= mix(vec3(1.0), vec3(1.12, 1.1, 0.8), smoothstep(0.62, 0.9, n2) * 0.6); // sunlit yellowing leaf tips
        float occ = mix(0.3, 1.14, pow(expo, 1.25)) * mix(0.66, 1.1, smoothstep(0.3, 0.75, crClump)); // (park r4) crowns separate: dark skirts, sunlit domes
        diffuseColor.rgb *= c * occ;
        // silhouette: grazing faces keep only the leaf coverage -> ragged, see-through crown edges
        float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
        float alpha = mix(cov * 1.25, 1.0, smoothstep(0.3, 0.72, facing));
        { float n = fract(crIGN(gl_FragCoord.xy + 5.0) + uLeafFrame.x * 2.618034); if (alpha < mix(0.25, 0.75, n)) discard; }
      