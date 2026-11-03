#include <emissivemap_fragment>
      totalEmissiveRadiance *= __SHADER_INJECT_0__; // (night)
      { vec2 px = vEmissiveMapUv * vec2(4096.0) * 0.5; vec2 fw = fwidth(px);
        float k = clamp(1.0 - max(fw.x, fw.y) * 1.6, 0.0, 1.0);
        vec2 g = abs(fract(px) - 0.5); float m = smoothstep(0.5, 0.36, max(g.x, g.y));
        // RGB sub-pixel triads (visible up close only) + the dark pixel grid between the LEDs
        float sp = fract(px.x * 3.0); vec3 tri = vec3(smoothstep(0.0, 0.12, sp) * smoothstep(0.36, 0.24, sp), smoothstep(0.3, 0.42, sp) * smoothstep(0.7, 0.58, sp), smoothstep(0.64, 0.76, sp) * smoothstep(1.0, 0.88, sp));
        float k2 = clamp(1.0 - max(fw.x, fw.y) * 4.0, 0.0, 1.0);
        totalEmissiveRadiance *= mix(vec3(1.0), (0.4 + 0.75 * m) * mix(vec3(1.0), 0.35 + 1.9 * tri, k2), k);
        // (r6) a touch less chroma (critic: 'over-saturated, too clean')
        totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(dot(totalEmissiveRadiance, vec3(0.3, 0.55, 0.15))), mix(0.26, uScrDesat, uNightK)); // (night) vivid LED colour at night (ts_perch_night) // (billboards r6) 0.14 -> 0.26 (critic r5: 'uniformly saturated poster imagery')
        // (r7) LED cabinet modules (16 x 16 LEDs): thin dark seams that survive much farther than the LED grid, plus faint
        // horizontal scan rows (critic r6: 'flat glowing cards with no LED pixel grid or scanline')
        vec2 cb = vEmissiveMapUv * vec2(4096.0) / 32.0; vec2 fc = fwidth(cb);
        float kc = clamp(1.0 - max(fc.x, fc.y) * 14.0, 0.0, 1.0);
        vec2 gc = 0.5 - abs(fract(cb) - 0.5);
        float seam = max(1.0 - smoothstep(0.006, 0.006 + fc.x, gc.x), 1.0 - smoothstep(0.006, 0.006 + fc.y, gc.y));
        totalEmissiveRadiance *= 1.0 - 0.09 * seam * kc; // (r9) 0.2 -> 0.09 (critic r8: 'visible grid tiling pattern' up close)
        float kr = clamp(1.0 - fw.y * 1.4, 0.0, 1.0);
        totalEmissiveRadiance *= mix(1.0, 0.8 + 0.2 * cos(px.y * 6.2831853), kr * 0.8);
        // (r7) LED viewing cone: panels seen off-axis dim + shift slightly cool, so screens at different angles differ
        float ca = abs(dot(normalize(normal), normalize(vViewPosition)));
        totalEmissiveRadiance *= mix(vec3(0.5, 0.54, 0.6), vec3(1.0), smoothstep(0.08, 0.7, ca));
        // (r7) soft highlight shoulder: whites roll off instead of clipping to a flat near-white card
        float mx = max(totalEmissiveRadiance.r, max(totalEmissiveRadiance.g, totalEmissiveRadiance.b));
        if (mx > 1.0) totalEmissiveRadiance *= (1.0 + (mx - 1.0) / (1.0 + (mx - 1.0) * 1.1)) / mx;
        __SHADER_INJECT_1__ }