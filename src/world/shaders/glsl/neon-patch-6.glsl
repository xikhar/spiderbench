#include <emissivemap_fragment>
      if (uNeonK > 0.0) {
        float led = step(1.0, vNeonC.w), seed = fract(vNeonC.w);
        float face = abs(dot(normalize(normal), normalize(vViewPosition)));
        vec3 col = vNeonC.rgb;
        // bright saturated core, dimmer + deeper colour toward the tube's silhouette; LED ribbons flat and even
        vec3 e = col * mix(mix(0.4, 1.0, pow(face, 1.5)), 0.85, led);
        e = mix(e, vec3(max(max(col.r, col.g), col.b)), 0.18 * pow(face, 6.0) * (1.0 - led));
        float fl = 1.0;
        if (seed < 0.034 && led < 0.5) { // ~1 in 30 tubes buzz: brief dips, cheap hash of time
          float h = fract(sin(floor(uNeonT * 13.0 + seed * 977.0) * 12.9898) * 43758.5453);
          fl = h > 0.82 ? 0.25 + 0.5 * h * h : 1.0;
        }
        totalEmissiveRadiance += e * uNeon.x * mix(1.0, uNeon.y, led) * uNeonS * uNeonK * vNeonDim * fl;
      }