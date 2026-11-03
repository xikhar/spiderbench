
        // alpha-to-coverage for the TAA pipeline: stochastic threshold per pixel/frame -> TAA resolves soft, density-
        // preserving edges (distant sprays keep their filtered coverage instead of thinning out)
        { float n = fract(leafIGN(gl_FragCoord.xy + 17.0) + uLeafFrame.x * 2.618034);
          if (diffuseColor.a < mix(0.2, 0.7, n)) discard; diffuseColor.a = 1.0; }