#include <emissivemap_fragment>
        { // lit from inside: centre brightest, rim ~55 % (tubes behind the face); ~day level by day, x2.2 at night (screenK
          // cancels the preset exposure): a white board tops out ~0.13 pre-exposure = ~170 sRGB at night
          float ex = min(vFaceUv.x, 1.0 - vFaceUv.x) * 2.0, ey = min(vFaceUv.y, 1.0 - vFaceUv.y) * 2.0 * 2.3;
          float lit = 0.55 + 0.45 * smoothstep(0.0, 0.8, min(ex, ey));
          // (night r6) at night the board colour is lifted by a power curve on its peak channel (m^0.45): dark navy / green
          // boards glow ~110-150 sRGB while white glyphs stay ~0.75 of clip (critic r6: 'unlit painted boards' at x2.2 linear)
          vec3 bt = diffuseColor.rgb; float bm = max(max(bt.r, bt.g), bt.b) + 1e-4;
          vec3 bNight = bt / bm * pow(bm, 0.45) * 2.0;
          totalEmissiveRadiance += mix(bt * 0.5, bNight, uNightK) * lit * uScreenK; }