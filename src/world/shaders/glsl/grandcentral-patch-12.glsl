#include <map_fragment>
      {
        // fine muntins on the outer skin (the heavy bars are real geometry)
        float mull = gGrid(vGU, vec2(0.5, 0.65), vec2(0.1, 0.08));
        vec3 V = normalize(vGWp - cameraPosition), n = normalize(vGNp);
        float cv = max(dot(V, -n), 0.08);
        vec3 tW = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4));
        // inner skin 1.2 m in
        vec3 h1 = vGWp + V * (1.2 / cv);
        float m1 = gGrid(vec2(dot(h1, tW), h1.y), vec2(1.0, 1.3), vec2(0.12, 0.1));
        // concourse: far wall 30 m in, floor at y = 1
        float tb = 30.0 / cv, tf = V.y < -0.01 ? (vGWp.y - 1.0) / -V.y : 1e5;
        vec3 col;
        if (tf < tb) {
          vec3 hf = vGWp + V * tf;
          vec2 fq = vec2(dot(hf, tW), dot(hf, n));
          float tile = gGrid(fq, vec2(1.6, 1.6), vec2(0.04, 0.04));
          col = vec3(0.34, 0.28, 0.2) * (0.85 + 0.15 * sin(fq.x * 0.37) * sin(fq.y * 0.29)) * (1.0 - 0.3 * tile);
          col *= 0.55 + 0.45 * exp(-tf * 0.02);
        } else {
          vec3 hb = vGWp + V * tb;
          vec2 bq = vec2(dot(hb, tW), hb.y);
          col = vec3(0.2, 0.15, 0.1) * (0.7 + 0.3 * smoothstep(20.0, 4.0, bq.y));            // warm stone hall, lit low
          float ax = mod(bq.x + 7.5, 15.0) - 7.5;                                            // the far wall's arched windows
          float arch = step(abs(ax), 4.0) * step(9.0, bq.y) * step(bq.y, 21.0 + sqrt(max(0.0, 16.0 - ax * ax)));
          col = mix(col, vec3(0.34, 0.36, 0.38), arch * (1.0 - 0.6 * gGrid(bq, vec2(1.0, 1.3), vec2(0.14, 0.12))));
          vec2 ch = vec2(mod(bq.x, 7.5) - 3.75, bq.y - 12.5);                                  // chandelier glows
          col += vec3(1.0, 0.72, 0.4) * 0.9 * exp(-dot(ch, ch) * 0.9);
          col += vec3(0.45, 0.4, 0.3) * smoothstep(24.0, 30.0, bq.y) * 0.4;                    // barrel ceiling (painted sky)
        }
        col *= 1.0 - 0.55 * m1;
        gInt = col;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.47, 0.44), mull * 0.45); // (street r5) pale painted muntins, faint (read as glazing, not a dark grid decal)
        vGMull = mull;
      }