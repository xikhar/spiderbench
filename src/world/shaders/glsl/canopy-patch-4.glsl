#include <color_fragment>
          diffuseColor.rgb *= mix(0.45, 1.05, smoothstep(-0.9, 0.7, vCy));   // dark underside / inner crown
          diffuseColor.rgb *= 0.92 + 0.16 * fract(sin(dot(floor(vCn * 2.0 + 0.5), vec3(12.9, 78.2, 37.7))) * 4375.5); // clump tone breakup
          // (round 7) cauliflower foliage clusters: leaf-mass lumps with dark gaps between them (per-crown phase), so the
          // crowns read as trees, not smooth cotton balls / lollipops
          cClump = cVn(vCn * 3.3 + vCi * 0.137) * 0.62 + cVn(vCn * 7.9 + vCi * 0.291) * 0.38;
          diffuseColor.rgb *= mix(0.58, 1.1, smoothstep(0.28, 0.72, cClump));