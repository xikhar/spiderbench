#include <color_fragment>
      {
        vec3 N = normalize(vRWN);
        rR = 0.85; rM = 0.0; rN = vec3(0.0, 0.0, 1.0);
        float cell = vM.x;
        vec2 tuv = vRUv * vM.y;
        vec3 nz = texture(tNoiseR, vRWP.xz / 70.0 + vRWP.y / 130.0).rgb;
        vec3 nz2 = texture(tNoiseR, vRWP.xz / 13.0 + 0.37).rgb;
        int ci = int(cell + 0.5);
        if (cell > -0.5) {
          vec3 tc = texture(tRoofC, vec3(tuv, cell)).rgb;
          diffuseColor.rgb *= tc;
          rR = ROUGH[ci];
          rN = texture(tRoofN, vec3(tuv, cell)).xyz * 2.0 - 1.0;
          rN.xy *= 0.8;
        }
        if (vM.w > 0.5) { // rooftop pool water: dark teal, glossy, gentle ripples
          float rip = texture(tNoiseR, vRWP.xz / 3.0).g;
          diffuseColor.rgb = vec3(0.09, 0.3, 0.34) * (0.85 + 0.3 * rip); rR = 0.08; // r4: lighter pool blue (ref 02 / 03) rN = normalize(vec3((rip - 0.5) * 0.15, 0.0, 1.0));
        }
        if (ci == __SHADER_INJECT_0__) diffuseColor.rgb *= 1.5; // r4: dusty, weathered rubber (pure black read as holes)
        // macro tone variation (kills repetition across a roof)
        diffuseColor.rgb *= (0.86 + 0.26 * nz.r) * (0.94 + 0.12 * nz2.g);
        if (vM.z > 0.0) { // roof skin
          // parapet grime: dark wet band at the base of the parapet, streaky, fading into the field
          float d = min(min(vRUv.x - vE.x, vE.z - vRUv.x), min(vRUv.y - vE.y, vE.w - vRUv.y));
          float ed = d + (nz2.b - 0.5) * 0.9;
          diffuseColor.rgb *= mix(0.4, 1.0, smoothstep(0.0, vM.z * 2.2, ed)); // r4: deeper soot band
          diffuseColor.rgb *= mix(vec3(0.93, 0.9, 0.84), vec3(1.0), smoothstep(0.0, vM.z * 4.0, ed)); // dust / rust-brown drift toward the walls
          // r6: per-roof dirt gradient (roofs drain / collect soot toward one side) + drain sumps: dark wet blotches
          {
            vec2 rsz = max(vE.zw - vE.xy, vec2(1.0)), rc = (vRUv - vE.xy) / rsz;
            float ang = rHash(floor(vE.xy * 0.37)) * 6.2832;
            float gdt = dot(rc - 0.5, vec2(cos(ang), sin(ang)));
            diffuseColor.rgb *= 1.0 - (0.08 + 0.12 * rHash(floor(vE.zw))) * smoothstep(-0.55, 0.55, gdt);
            vec2 dp = vE.xy + rsz * vec2(0.25 + 0.5 * rHash(floor(vE.xy) + 1.7), 0.25 + 0.5 * rHash(floor(vE.zw) + 2.9));
            float dd = length(vRUv - dp) + (nz2.r - 0.5) * 1.6;
            float sump = 1.0 - smoothstep(0.4, 2.6 + 1.5 * rHash(floor(vE.xy) + 4.1), dd);
            diffuseColor.rgb *= 1.0 - 0.3 * sump; rR = mix(rR, 0.35, sump * 0.6);
          }
          // r4: sheets / rolls: per-sheet tone + dark lap seams (antialiased), end laps every ~12 m
          if (ci >= 0 && ci < __SHADER_INJECT_1__ && SEAM[ci] > 0.0) {
            float su = vRUv.x / SEAM[ci], sid = floor(su);
            diffuseColor.rgb *= 0.92 + 0.16 * rHash(vec2(sid, floor(vE.x * 0.7)));
            float fu = fract(su), fwu = max(fwidth(su), 1e-4);
            float seam = 1.0 - smoothstep(0.0, fwu * 1.2 + 0.02, min(fu, 1.0 - fu));
            float sv = (vRUv.y + rHash(vec2(sid, 3.7)) * 12.0) / 12.0, fv = fract(sv), fwv = max(fwidth(sv), 1e-4);
            seam = max(seam, 0.7 * (1.0 - smoothstep(0.0, fwv * 1.2 + 0.004, min(fv, 1.0 - fv))));
            diffuseColor.rgb *= 1.0 - 0.3 * seam * smoothstep(0.6, 0.15, fwu);
          }
          // r4: hot-mopped tar patches (dark, semi-glossy blotches with crisp edges)
          if (ci >= 0 && ci < __SHADER_INJECT_2__ && TARP[ci] > 0.5) {
            float tpn = texture(tNoiseR, vRWP.xz / 7.0 + vec2(0.23, 0.71)).r * 0.65 + texture(tNoiseR, vRWP.zx / 29.0 + 0.5).g * 0.35;
            float tp = smoothstep(0.64, 0.66, tpn);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.28 + vec3(0.012), tp * 0.85); rR = mix(rR, 0.5, tp);
          }
          // world-space stains at three scales (non-repeating) : soot / algae / dust drifts
          vec3 w1 = texture(tNoiseR, vRWP.xz / 41.0 + 0.13).rgb;
          vec3 w2 = texture(tNoiseR, vRWP.zx / 17.0 + 0.71).rgb;
          float stain = smoothstep(0.52, 0.8, w1.g * 0.55 + w2.r * 0.45);
          diffuseColor.rgb *= 1.0 - 0.26 * stain;
          diffuseColor.rgb *= mix(vec3(1.0), vec3(1.03, 1.0, 0.95), smoothstep(0.55, 0.85, w2.b)); // rust / tannin tinge (r4: weaker, read green on grey)
          // repair patches: rectangles on a per-roof grid (uv already carries a per-roof random offset)
          // r4: only on membranes / coatings (not ballast or pavers), rarer and bigger (the small ones read as camo squares)
          vec2 pg = vec2(6.0 + 3.0 * rHash(floor(vE.xy)), 4.5 + 3.0 * rHash(floor(vE.zw)));
          vec2 pc = floor(vRUv / pg), pf = fract(vRUv / pg);
          float ph = fract(sin(dot(pc, vec2(12.9898, 78.233)) + dot(floor(vE.xy), vec2(0.0137, 0.0291))) * 43758.5453);
          vec2 pa = vec2(0.05 + 0.3 * rHash(pc + 3.1), 0.05 + 0.3 * rHash(pc + 7.7)), pb = vec2(0.6 + 0.35 * rHash(pc + 1.3), 0.55 + 0.4 * rHash(pc + 5.9));
          if (ci >= 0 && ci < __SHADER_INJECT_3__ && TARP[ci] > 0.5 && ph < 0.07 && pf.x > pa.x && pf.y > pa.y && pf.x < pb.x && pf.y < pb.y) { diffuseColor.rgb *= 0.7 + ph * 5.0; rR = min(1.0, rR + 0.05); }
          // ponding on flat membranes: dark, glossy puddle stains with a dried rim
          if (ci >= 0 && ci < __SHADER_INJECT_4__ && PONDS[ci] > 0.5) {
            float pw = texture(tNoiseR, vRWP.xz / 9.0 + vec2(0.61, 0.27)).b * 0.7 + w1.r * 0.3;
            float pond = smoothstep(0.66, 0.72, pw), rim = smoothstep(0.6, 0.66, pw) - pond;
            diffuseColor.rgb *= (1.0 - 0.32 * pond) * (1.0 + 0.1 * rim);
            rR = mix(rR, 0.18, pond); rN = normalize(mix(rN, vec3(0.0, 0.0, 1.0), pond));
          }
        } else { // clutter: grime + contact darkening near the base, rain streaks on the sides
          float hb = vRWP.y - vE.x;
          diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.45, hb));
          if (abs(N.y) < 0.5) {
            diffuseColor.rgb *= 1.0 - 0.22 * smoothstep(0.55, 0.9, texture(tNoiseR, vec2((vRWP.x + vRWP.z) * 0.7, vRWP.y * 0.06)).g);
            // r8: rust runs + weathering on sheet-metal housings (critic: "boxes look like primitive cubes, add rust")
            if (ci == __SHADER_INJECT_5__ || ci == __SHADER_INJECT_6__) {
              float rn = texture(tNoiseR, vec2((vRWP.x - vRWP.z) * 1.7 + 0.13, vRWP.y * 0.09 + 0.41)).r * 0.7 + nz2.b * 0.3;
              diffuseColor.rgb *= mix(vec3(1.0), vec3(0.86, 0.7, 0.55), smoothstep(0.58, 0.82, rn) * 0.75);
            }
          } else if (vM.w < 0.5) { // tops: dusty, blotchy, a rust bloom here and there (sun-lit clean tops read as white dice)
            float tb = texture(tNoiseR, vRWP.xz / 2.3 + 0.57).g;
            diffuseColor.rgb *= (0.9 + 0.16 * tb) * mix(vec3(1.0), vec3(0.9, 0.8, 0.68), smoothstep(0.66, 0.86, nz2.r) * 0.6);
          }
          if (ci == __SHADER_INJECT_7__ || ci == __SHADER_INJECT_8__) rM = 0.2;
        }
        diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.64); // muted (r3: 0.82 -> 0.64, critic: saturated colour cards)
      }