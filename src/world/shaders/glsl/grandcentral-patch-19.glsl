#include <map_fragment>
      {
        vec3 n = normalize(vPN), tW = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4));
        float u = dot(vPW, tW), fl = (vPW.y - __SHADER_INJECT_0__) / __SHADER_INJECT_1__;
        float fy = fract(fl), fu = fract(u / __SHADER_INJECT_2__);
        vec2 id = vec2(floor(u / __SHADER_INJECT_3__) + n.x * 17.0 + n.z * 31.0, floor(fl));
        pH = ph(id); pH2 = ph(id + 7.3); pH3 = ph(vec2(floor(u / (__SHADER_INJECT_4__ * 3.0)), id.y) + 3.1);   // pane / room hashes
        float fwU = fwidth(u / __SHADER_INJECT_5__) + 1e-4, fwY = fwidth(fl) + 1e-4;
        float mull = max(1.0 - smoothstep(0.025, 0.025 + fwU * 1.5, min(fu, 1.0 - fu)), 1.0 - smoothstep(0.012, 0.012 + fwY * 1.5, abs(fy - 0.235)));
        float span = 1.0 - smoothstep(0.215, 0.215 + fwY, fy);                    // opaque spandrel band at the slab
        pOpq = max(span, mull);
        // interior: room box behind the pane (back wall 6 m in, floor at the sill, ceiling 2.9 m up)
        vec3 V = normalize(vPW - cameraPosition);
        float cv = max(dot(V, -n), 0.06);
        float yF = __SHADER_INJECT_6__ + floor(fl) * __SHADER_INJECT_7__ + 0.95, yC = yF + 2.85;
        float tB = 6.0 / cv, tC = V.y > 0.001 ? (yC - vPW.y) / V.y : 1e5, tF = V.y < -0.001 ? (yF - vPW.y) / V.y : 1e5;
        float lit = step(0.35, pH3);
        vec3 col;
        if (tC < tB && tC < tF) { vec3 h = vPW + V * tC; float lx = abs(fract(dot(h, tW) / 1.5) - 0.5), lz = abs(fract(dot(h, n) / 2.4) - 0.5);
          col = vec3(0.1) + lit * vec3(0.95, 0.97, 1.0) * 0.55 * (1.0 - smoothstep(0.12, 0.16, lx)) * (1.0 - smoothstep(0.3, 0.34, lz)); }
        else if (tF < tB) { vec3 h = vPW + V * tF; col = vec3(0.06, 0.06, 0.065) * (0.7 + 0.6 * exp(-tF * 0.2)); }
        else { vec3 h = vPW + V * tB; float hy = h.y - yF; float bx = dot(h, tW);
          col = mix(vec3(0.16, 0.16, 0.15), vec3(0.24, 0.22, 0.19), ph(vec2(floor(bx / 4.0), id.y)));
          float desk = step(0.0, hy) * step(hy, 0.78) * step(0.25, fract(bx / 2.6)); col = mix(col, vec3(0.05), desk * 0.8);
          col *= 0.5 + 0.5 * lit; }
        col *= 0.35 + 0.65 * lit;
        // blinds: some bays drawn part-way down from the head
        // (street r12) critic: 'randomly scattered bright white window cells (missing-texture flicker)'. Blinds are now
        // set per 3-bay office (one tenant, one drop height, quantised to thirds) and are a dusty dark bronze, not cream
        float bl = pH3 > 0.62 ? 0.2 + 0.25 * floor(ph(vec2(floor(u / (__SHADER_INJECT_8__ * 3.0)), id.y) + 1.9) * 3.0) : 0.0;
        float wy = (fy - 0.235) / 0.765;
        float blind = step(1.0 - bl, wy);
        float slat = mix(0.92, 0.85 + 0.15 * step(0.5, fract(vPW.y * 18.0)), 1.0 - smoothstep(0.15, 0.4, fwidth(vPW.y * 18.0)));
        pInt = mix(col, vec3(0.0), blind);
        diffuseColor.rgb = mix(diffuseColor.rgb * (0.75 + 0.5 * pH), vec3(0.17, 0.155, 0.13) * slat * (0.9 + 0.15 * pH2), blind * 0.85); // (street r12) darker blinds
        pOpq = max(pOpq, blind * 0.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, span > 0.5 ? vec3(0.075, 0.068, 0.058) : vec3(0.1, 0.09, 0.075), max(span, mull));
      }