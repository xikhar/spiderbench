
      vec3 nN = vec3(-iT.z, 0.0, iT.x);
      vec3 transformed = iO + iT * position.x * iD.x + vec3(0.0, 1.0, 0.0) * position.y * iD.y;
      float cell = iD.z, asp = iD.x / iD.y;
      // the cell holds the item centred at its own aspect (90 % x 78 % of 512 x 256): map the quad onto that box
      float ca = __SHADER_INJECT_0__;
      vec2 sz = asp > ca ? vec2(0.9, 0.9 / asp * 2.0) : vec2(0.78 * asp * 0.5, 0.78);
      if (cell > 23.5) sz = vec2(0.5, 1.0) / 1.12; // icons: drawn in the cell's centre square
      vec2 cuv = 0.5 + position.xy * min(sz * 1.12, vec2(0.995));
      vNeonUv = vec2((mod(cell, 4.0) + cuv.x) / 4.0, 1.0 - (floor(cell / 4.0) + 1.0 - cuv.y) / 8.0);
      vNeonC = iC; vNeonQ = position.xy + 0.5;
      float d = length(iO - cameraPosition);
      vNeonDim = 1.0 - smoothstep(420.0, 600.0, d);
      if (d > 600.0) transformed = iO;