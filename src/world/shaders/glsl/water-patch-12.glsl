{
        float u = vWetUv.x, y = vWetUv.y;
        vec3 nz = texture(tWetN, vec2(u / 9.0, 0.37)).rgb, nz2 = texture(tWetN, vec2(u / 2.1, y * 0.4 + 0.1)).rgb;
        float top = 0.45 + 0.35 * nz.r + 0.15 * nz2.g;            // ragged high-water line
        float a = 1.0 - smoothstep(top - 0.12, top + 0.04, y);
        float algae = 1.0 - smoothstep(0.1, 0.35, y);              // green-black slime right at the water line
        vec3 c = mix(vec3(0.07, 0.065, 0.055), vec3(0.04, 0.06, 0.035), algae);
        c *= 0.8 + 0.4 * nz2.b;
        // streaks running down from the high-water line
        a = max(a, (1.0 - smoothstep(0.0, 0.9, y)) * smoothstep(0.62, 0.8, texture(tWetN, vec2(u / 0.9, 0.71)).r) * 0.6);
        diffuseColor = vec4(c, a * 0.88);
      }