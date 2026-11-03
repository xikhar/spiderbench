#include <color_fragment>
        vec3 dnE = vec3(0.0); // (daynight) lit windows at night
        if (vWin > 0.5) {
          // (round 3) readable facades at 1-5 km: dark glazing with a per-window sky / blind variation, spandrels,
          // a pale parapet / cornice line, grimy darker base. Averages to the same tone once sub-pixel (no shimmer).
          float along = vWPm.x + vWPm.z;
          vec2 fw = fwidth(vec2(vWPm.y / 3.3, along / 2.4));
          float sub = clamp(max(fw.x, fw.y) * 1.3, 0.0, 1.0);
          vec3 base = diffuseColor.rgb;
          if (vGl > 0.5) {
            float mul = fract(along / 1.6), fl = fract(vWPm.y / 3.9);
            float frame = max(1.0 - step(0.1, mul), 1.0 - step(0.12, fl));
            vec3 gl = mix(vec3(0.1, 0.13, 0.16), vec3(0.34, 0.4, 0.46), smoothstep(0.0, 180.0, vWPm.y) * 0.6 + 0.25 * mh(floor(vec2(along / 1.6, vWPm.y / 3.9))));
            vec3 c = mix(gl, base * 0.9, frame * 0.8);
            diffuseColor.rgb = mix(c, mix(vec3(0.14, 0.17, 0.2), vec3(0.28, 0.33, 0.37), smoothstep(0.0, 200.0, vWPm.y)), sub);
            dnE = mix(vec3(0.8, 0.88, 1.0) * (1.0 - frame) * step(0.8, mh(floor(vec2(along / 1.6, vWPm.y / 3.9)) + 5.3)) * 0.5, vec3(0.009, 0.01, 0.012), sub); // (night) sparser, dimmer // (daynight, lighting2 r3) sub-pixel mean was 0.3 (x1.4 x night exposure ~3.6): the far shores glowed as a pale band
          } else {
            float fl = fract((vWPm.y - 1.2) / 3.3), u = fract(along / 2.4);
            float w = step(0.3, fl) * step(fl, 0.82) * step(0.28, u) * step(u, 0.74);
            vec2 wid = floor(vec2(along / 2.4, (vWPm.y - 1.2) / 3.3));
            vec3 wc = vec3(0.07, 0.08, 0.095) * (0.7 + 0.9 * mh(wid)) + vec3(0.1, 0.09, 0.07) * step(0.93, mh(wid + 3.1));
            vec3 c = mix(base, wc, w);
            c = mix(c, mix(base, wc, 0.33), sub);
            diffuseColor.rgb = c;
            dnE = mix(vec3(1.0, 0.72, 0.42) * w * step(0.85, mh(wid + 7.7)) * (0.2 + 0.5 * mh(wid + 2.9)), vec3(0.012, 0.0085, 0.005), sub); // (night) sparse warm sparkle; the sub-pixel mean (was 0.026: x1.4 x4.5 exposure = the tan band) matches it
          }
          diffuseColor.rgb *= 0.62 + 0.38 * smoothstep(0.0, 14.0, vWPm.y - __SHADER_INJECT_0__);   // contact darkening
        }
        diffuseColor.rgb *= 1.0 - 0.85 * uNightK; // (night) dark silhouettes at night (critic r1, r3)