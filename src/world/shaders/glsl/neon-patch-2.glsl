
      int nSide = int(aS.x + 0.5);
      float nW = iD.x, nH = iD.y, nR = iD.z; int nMask = int(iD.w + 0.5);
      vec3 nT = iT, nV = iV, nN = normalize(cross(iT, iV));
      float nDist = length(iO + nT * nW * 0.5 + nV * nH * 0.5 - cameraPosition);
      float nRe = max(nR, nDist * 0.00062); // ~0.6 px at 1080p / 55 deg: no sub-pixel shimmer, energy kept below
      vNeonDim = nR / nRe;
      vNeonC = iC;
      vec2 p0 = nSide == 0 ? vec2(0.0) : nSide == 1 ? vec2(nW, 0.0) : nSide == 2 ? vec2(nW, nH) : vec2(0.0, nH);
      vec2 dr = nSide == 0 ? vec2(1.0, 0.0) : nSide == 1 ? vec2(0.0, 1.0) : nSide == 2 ? vec2(-1.0, 0.0) : vec2(0.0, -1.0);
      float nLen = (nSide == 0 || nSide == 2) ? nW : nH;
      float nS = mix(-nRe, nLen + nRe, aS.y);                            // run past the corners: closed joints / end caps
      vec3 nAx = nT * dr.x + nV * dr.y, nPerp = nT * abs(dr.y) + nV * abs(dr.x);
      float nFlat = iC.w >= 1.0 ? 0.35 : 1.0;                               // LED strips: a flat ribbon
      vec3 objectNormal = normalize(nPerp * aS.z + nN * aS.w);
      neonPos = iO + nT * p0.x + nV * p0.y + nAx * nS + (nPerp * aS.z * nFlat + nN * aS.w) * nRe;
      if (((nMask >> nSide) & 1) == 0 || nDist > 700.0) neonPos = iO;       // masked side / far: degenerate
      #ifdef USE_TANGENT
      vec3 objectTangent = vec3(tangent.xyz);
      #endif