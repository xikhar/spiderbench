#include <color_fragment>
      {
        float u = vS.x, d = vS.y, H = vS.z, k = vS.w;
        float n1 = texture(tNoiseS, vec2(u / 11.0, 0.37)).r * 0.6 + texture(tNoiseS, vec2(u / 3.1, 0.71)).g * 0.4; // per-column run length
        float n2 = texture(tNoiseS, vec2(u / 0.9, d / 70.0 + 0.13)).b * 0.7 + texture(tNoiseS, vec2(u / 0.37, d / 30.0 + 0.61)).r * 0.3; // fine streak columns
        float len = H * (0.2 + 1.1 * smoothstep(0.3, 0.75, n1));
        float fall = 1.0 - smoothstep(0.0, len, d);
        float streak = smoothstep(0.44, 0.62, n2) * fall;
        float band = (1.0 - smoothstep(0.0, 0.3 + 0.6 * n1, d));                                                  // drip line under the cap
        float wash = (1.0 - smoothstep(0.0, H * 0.8, d));                                                          // general soiling under the cap
        float dark = k * clamp(streak * 0.75 + band * 0.5 + wash * 0.2, 0.0, 0.8) * smoothstep(820.0, 450.0, vSD)
          * mix(0.35, 1.0, smoothstep(45.0, 200.0, vSD)); // (park r10) near walls: soot was crushing shaded facades to black at swing range
        diffuseColor.rgb = vec3(1.0) - dark * vec3(0.8, 0.85, 0.93);                                               // brownish soot (multiplied)
        // r7: blank party walls (the big salmon brick slabs seen from above): per-wall hue, big weathering blotches,
        // patched / repointed brick rectangles and old tar roof-lines of demolished neighbours
        if (vT.w > 0.0) {
          float fd = smoothstep(900.0, 500.0, vSD);
          vec3 tint = mix(vec3(1.0), vT.rgb, fd);
          float b1 = texture(tNoiseS, vec2(u / 19.0 + 0.21, d / 23.0 + 0.47)).g, b2 = texture(tNoiseS, vec2(u / 6.0 + 0.6, d / 7.5 + 0.1)).r;
          float blot = smoothstep(0.45, 0.8, b1 * 0.7 + b2 * 0.3);
          vec2 pc = floor(vec2(u / 4.3, d / 3.1)), pf = fract(vec2(u / 4.3, d / 3.1));
          float ph = fract(sin(dot(pc, vec2(12.9898, 78.233)) + vT.w * 17.0) * 43758.5453);
          float patchv = (ph < 0.12 && pf.x > 0.1 && pf.y > 0.15 && pf.x < 0.9 && pf.y < 0.85) ? (0.8 + ph * 1.2) : 1.0;
          float gl = fract(sin(vT.w * 91.7) * 4375.5) * H * 0.7 + 2.0;
          float ghost = (1.0 - smoothstep(0.0, 0.25, abs(d - gl))) * step(0.5, fract(vT.w * 7.3));
          diffuseColor.rgb *= tint * (1.0 - vT.w * fd * (0.28 * blot + 0.3 * ghost)) * mix(1.0, patchv, fd);
        }
        // r8: canyon occlusion at the foot of street walls (vT.w < 0: quad from the ground up H metres): sky and bounce
        // light fall off toward the street, so the street gaps read as deep canyons from swinging altitude
        if (vT.w < 0.0) {
          float g = clamp(d / max(H, 1.0), 0.0, 1.0);
          float wn = texture(tNoiseS, vec2(u / 9.0 + 0.3, d / 5.0 + 0.8)).g;
          diffuseColor.rgb = vec3(1.0) - k * g * g * (0.85 + 0.3 * wn) * vec3(0.52, 0.54, 0.58) * smoothstep(1100.0, 500.0, vSD) * mix(0.45, 1.0, smoothstep(45.0, 200.0, vSD)); // (park r10) softer up close
        }
      }