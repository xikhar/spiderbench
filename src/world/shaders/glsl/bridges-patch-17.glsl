#include <clipping_planes_fragment>
        if (vTU.y < 1.5) { float u = fract(vTU.x), v = vTU.y; vec2 fw = fwidth(vTU) + 1e-4;
          float chord = step(v, 0.08 + fw.y) + step(0.92 - fw.y, v);
          float post = step(min(u, 1.0 - u), 0.05 + fw.x);
          float d1 = abs(u - v), d2 = abs(u - (1.0 - v));
          float diag = step(min(d1, d2), 0.06 + fw.x + fw.y);
          // far away the web is sub-pixel: keep it solid (dithered holes would read as polka dots)
          if (chord + post + diag < 0.5 && max(fw.x, fw.y) < 0.09) discard;
        } else { float v = vTU.y - 2.0, u = vTU.x; vec2 fw = fwidth(vec2(u * 16.0, v)) + 1e-4;
          float rail = step(0.9 - fw.y, v) + step(v, 0.07 + fw.y) + step(abs(v - 0.5), 0.035 + fw.y);
          float post = step(min(fract(u), 1.0 - fract(u)), 0.04 + fw.x / 16.0);
          float pick = step(abs(fract(u * 16.0) - 0.5), 0.12 + fw.x);
          if (rail + post + pick < 0.5 && fw.x < 0.6) discard; }