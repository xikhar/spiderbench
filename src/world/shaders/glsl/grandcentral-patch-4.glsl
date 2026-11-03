#include <map_fragment>
      {
        vec3 an = abs(vGN);
        vec2 q = an.x > an.z ? vGW.zy : vGW.xy; if (an.y > 0.7) q = vGW.xz;
        vec3 nz = texture(tGN, q / 13.0).rgb, nz2 = texture(tGN, q / 2.7 + 0.31).rgb;
        int part = int(vGP + 0.5);
        vec3 c = diffuseColor.rgb;
        if (part == 0) {
          // limestone ashlar: 0.75 m courses, 1.5 m blocks, thin joints; per-block tone; grime washing down
          float cy = q.y / 0.62, row = floor(cy), cx = q.x / 1.25 + 0.5 * mod(row, 2.0);
          vec2 f = vec2(fract(cx), fract(cy)); vec2 fw = fwidth(vec2(cx, cy)) * 1.5 + 1e-4;
          float joint = max(1.0 - smoothstep(0.0, 0.025 + fw.x, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, 0.035 + fw.y, min(f.y, 1.0 - f.y)));
          joint *= (1.0 - smoothstep(0.15, 0.5, max(fw.x, fw.y))) * (1.0 - an.y);
          float blk = gh(floor(vec2(cx, cy)));
          c *= (0.94 + 0.07 * blk) * (0.86 + 0.22 * nz.r) * (0.94 + 0.08 * nz2.g);
          c *= 1.0 - 0.17 * joint;
          // channelled rustication on the ground storey (below the terrace string course): deep horizontal joints
          float rus = (1.0 - smoothstep(8.4, 8.8, vGW.y)) * (1.0 - an.y);
          float jr = 1.0 - smoothstep(0.0, 0.07 + fw.y, min(f.y, 1.0 - f.y));
          c *= 1.0 - 0.22 * jr * rus;
          gH = -0.018 * joint - 0.05 * jr * rus;
          // rain streaks washing down from sills / cornices
          float stk = texture(tGN, vec2(q.x / 1.9, vGW.y / 34.0) + 0.17).r;
          c *= 1.0 - 0.22 * smoothstep(0.45, 0.8, stk) * (1.0 - an.y); // (street r8) 0.13 -> 0.22
        } else if (part == 1 || part == 3 || part == 7) {
          c *= (0.88 + 0.2 * nz.r) * (0.94 + 0.08 * nz2.g);
          if (part == 7) { // (street r6) fluted column shafts: 24 flutes from the normal's azimuth (bump + cavity shade)
            float az = atan(vGN.z, vGN.x) * 12.0 / 3.14159265;
            float fl = abs(fract(az) - 0.5) * 2.0;           // 0 at the arris, 1 mid-flute
            float cav = smoothstep(0.15, 0.95, fl);
            gH = -0.06 * cav;
            c *= 1.0 - 0.2 * cav * (1.0 - an.y);
          }
        } else if (part == 8) {
          // (street r8) patinated bronze statuary: dark oily bronze, verdigris washing over up-facing surfaces, runs below
          float up = clamp(vGN.y * 0.5 + 0.5, 0.0, 1.0);
          float n1 = texture(tGN, vGW.xy / 0.9 + vGW.z * 0.31).g, n2 = texture(tGN, vec2(vGW.x / 0.35 + vGW.z * 0.2, vGW.y / 3.0) + 0.21).r;
          gV = clamp(smoothstep(0.45, 0.95, up) * 0.75 + smoothstep(0.5, 0.78, n2) * 0.55 + (n1 - 0.5) * 0.5, 0.0, 1.0);
          c = mix(c * (0.75 + 0.45 * n1), vec3(0.33, 0.45, 0.38) * (0.85 + 0.3 * n2), gV * 0.8);
        } else if (part == 2) {
          // weathered copper: verdigris streaks running down the slope, darker seams
          float st = texture(tGN, vec2(q.x / 3.0, vGW.y / 40.0)).g;
          float st2 = texture(tGN, vec2(q.x / 0.9, q.y / 14.0) + 0.5).b;
          c *= (0.72 + 0.34 * st) * (0.85 + 0.25 * st2) * (0.9 + 0.15 * nz2.r);
          c = mix(c, vec3(dot(c, vec3(0.33))), 0.25);   // chalky, desaturated verdigris
          float sw = fwidth(q.x / 1.2) * 1.5 + 1e-4;
          float seam = smoothstep(0.9 - sw, 0.9, abs(fract(q.x / 1.2) - 0.5) * 2.0) * (1.0 - smoothstep(0.1, 0.4, sw));
          c *= 1.0 - 0.12 * seam;
          // (street r11) critic: 'copper roof is a flat saturated mint plane'. Old weathered copper: dark brown-bronze
          // base showing through in broad blotches and long rain runs down the slope, the verdigris only as a
          // streaky chalky crust (paler where the water washes), soot-dark near the eaves. gV carries the crust amount
          // into the roughness (crust matte, bare metal satiny).
          float cb = texture(tGN, q / 9.0 + 0.37).r, cr = texture(tGN, vec2(q.x / 1.6, vGW.y / 22.0) + 0.61).g;
          float crust = clamp(smoothstep(0.3, 0.72, cb) * 0.7 + smoothstep(0.35, 0.8, cr) * 0.55 - 0.1, 0.0, 1.0);
          vec3 bare = vec3(0.24, 0.2, 0.15) * (0.8 + 0.4 * st2);
          vec3 verd = vec3(0.43, 0.52, 0.46) * (0.82 + 0.3 * st) * (0.9 + 0.2 * cr);
          c = mix(bare, verd, crust) * (0.9 + 0.12 * nz2.r);
          c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 3.5, vGW.y - __SHADER_INJECT_0__));   // soot at the eaves
          c *= 1.0 - 0.12 * seam;
          gV = crust;
        } else if (part == 6) {
          c *= (0.7 + 0.5 * texture(tGN, vGW.xz / 1.3 + vGW.y * 0.3).g) * (0.8 + 0.3 * nz2.r);
        } else if (part == 4) {
          c *= (0.85 + 0.25 * nz.r) * (0.92 + 0.12 * nz2.b);
          // (street r5) deck wear: rectangular utility patches (darker fresh tar / paler old), oil blotches, sealed joints
          vec2 pc = floor(vGW.xz / vec2(3.1, 4.3)); float ph = gh(pc), ph2 = gh(pc + 7.0);
          vec2 pf = fract(vGW.xz / vec2(3.1, 4.3));
          float pm = step(0.84, ph) * step(0.12, pf.x) * step(pf.x, 0.88) * step(0.1, pf.y) * step(pf.y, 0.82);
          c *= mix(1.0, ph2 > 0.5 ? 0.78 : 1.12, pm);
          c *= 1.0 - 0.22 * smoothstep(0.62, 0.8, texture(tGN, vGW.xz / 5.3 + 0.21).b);
          float jn = abs(fract(vGW.z / 9.0) - 0.5) * 2.0; c *= 1.0 - 0.3 * smoothstep(0.975, 0.995, jn);
          // (street r6) critic: 'smooth grey slab, no tyre wear / oil'. On the Park Av ramp (two lanes along z): polished
          // darker wheel paths, an oil-drip stripe down each lane centre, and a dark wet gutter line at both parapets.
          float lx = vGW.x - __SHADER_INJECT_1__;
          if (abs(lx) < 3.7) {
            float lc = abs(abs(lx) - 1.8);                       // distance from the lane centre
            float wn = texture(tGN, vec2(lx * 0.5, vGW.z / 23.0) + 0.43).r;
            float wheel = 1.0 - smoothstep(0.18, 0.5, abs(lc - 0.85));
            c *= 1.0 - 0.14 * wheel * (0.6 + 0.6 * wn);
            float drip = (1.0 - smoothstep(0.1, 0.35, lc)) * smoothstep(0.45, 0.75, texture(tGN, vec2(lx * 0.9, vGW.z / 3.1) + 0.11).g);
            c *= 1.0 - 0.28 * drip;
            float gut = 1.0 - smoothstep(0.0, 0.45, 3.6 - abs(lx));
            c *= 1.0 - 0.35 * gut * (0.7 + 0.3 * wn);
          }
        }
        // grime: soot collecting under projections + dark wash near the ground (stone only)
        if (part == 0 || part == 1 || part == 3 || part == 7) {
          c *= 1.0 - 0.2 * smoothstep(0.55, 0.85, nz.b) * (1.0 - an.y);
          c *= mix(0.78, 1.0, smoothstep(0.0, 4.0, vGW.y));
          // (street r5) critic: 'no weathering / staining under ledges, no AO where the cornice meets the wall'.
          // Contact shadow bands under the big projections + soot streaks washing down from them (walls only).
          float wall = 1.0 - an.y;
          float dC = __SHADER_INJECT_2__ - vGW.y, dA = __SHADER_INJECT_3__ - vGW.y, dT = __SHADER_INJECT_4__ - vGW.y;
          float ao = 0.34 * step(0.0, dC) * exp(-max(dC, 0.0) * 1.1) + 0.26 * step(0.0, dA) * step(vGW.y, __SHADER_INJECT_5__) * exp(-max(dA, 0.0) * 1.4) + 0.3 * step(0.0, dT) * exp(-max(dT, 0.0) * 0.9); // (skyline r6) max(): exp overflowed to inf at y ~250 (MetLife cap) -> 0*inf = NaN = black
          float colS = texture(tGN, vec2(q.x / 0.55, 0.37)).g, colS2 = texture(tGN, vec2(q.x / 2.3, 0.71)).b;
          float streak = smoothstep(0.52, 0.8, colS) * (0.6 + 0.6 * colS2);
          float run = step(0.0, dC) * exp(-max(dC, 0.0) / 7.0) + step(0.0, dA) * step(vGW.y, __SHADER_INJECT_6__) * exp(-max(dA, 0.0) / 3.0);
          c *= (1.0 - ao * wall) * (1.0 - 0.3 * streak * run * wall);
          c = mix(c, c * vec3(0.93, 0.95, 0.98), 0.5 * smoothstep(12.0, 30.0, vGW.y) * wall);   // cooler, cleaner stone higher up
          // (textures r5) critic: 'Grand Central reads as pale clean plaster'. Real stone grain from the $imagegen stucco /
          // limestone layer (luminance ratio, so the part colours stay), soot streak masks (walls_hao layer 16) washing
          // down 3-14 m from the cornice / attic between the piers, and an overall aged value drop.
          vec3 gs = texture(tGWC, vec3(q / 2.4 + 0.13, 14.0)).rgb, gm = textureLod(tGWC, vec3(0.5, 0.5, 14.0), 10.0).rgb;
          c *= mix(1.0, clamp(dot(gs, vec3(0.333)) / max(dot(gm, vec3(0.333)), 0.05), 0.7, 1.3), 0.65);
          float sc = floor(q.x / 1.7), sr = gh(vec2(sc, 3.1)), sLen = 3.0 + 11.0 * sr;
          float sy = (vGW.y > __SHADER_INJECT_7__ ? __SHADER_INJECT_8__ : __SHADER_INJECT_9__) - vGW.y;
          vec2 sq = vec2(fract(q.x / 1.7), sy / sLen);
          float sm = (sq.y > 0.0 && sq.y < 1.0) ? texture(tGWH, vec3((mod(sc, 8.0) + clamp(sq.x, 0.02, 0.98)) / 8.0, 1.0 - sq.y, 16.0)).r : 0.0;
          c *= 1.0 - 0.38 * sm * wall * step(0.35, sr);
          c *= 0.86 * mix(vec3(1.0), vec3(1.0, 0.97, 0.92), 0.5 * (1.0 - smoothstep(2.0, 12.0, vGW.y)));
        }
        diffuseColor.rgb = c;
      }