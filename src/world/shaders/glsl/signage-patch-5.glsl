#include <color_fragment>
      int K = int(vSig.x + 0.5);
      vec4 tx = vec4(1.0);
      sgR = 0.55; sgM = 0.0; sgE = vec3(0.0);
      vec2 ledF = vec2(0.0); float ledAA = 0.0;
      if (K == 3) { // (r2) LED pixel grid: 1 diode per 4 atlas texels (~10 cm on a 12 m screen), image sampled per diode
        vec2 lp = vMapUv * 1024.0; ledF = fract(lp) - 0.5;
        ledAA = clamp(1.6 - 2.2 * max(fwidth(lp.x), fwidth(lp.y)), 0.0, 1.0);
        tx = texture(map, mix(vMapUv, (floor(lp) + 0.5) / 1024.0, ledAA));
      } else if (K > 0 && K != 6 && K != 7) tx = vMapUv.x > 3.5 ? texture(tArt, vMapUv - vec2(4.0, 0.0)) : vMapUv.x > 1.5 ? texture(tSigns, vMapUv - vec2(2.0, 0.0)) : texture(map, vMapUv);
      vec3 nzA = texture(tNoiseS, (vWPs.xz + vWPs.yy * vec2(0.7, -0.4)) / 9.0).rgb;
      vec3 nzB = texture(tNoiseS, (vWPs.xz * 0.6 + vWPs.yy * vec2(-0.5, 0.8)) / 1.7).rgb;
      float lum = dot(tx.rgb, vec3(0.2126, 0.7152, 0.0722));
      if (K == 0) { sgR = 0.5 + 0.3 * nzB.r; sgM = 0.35; diffuseColor.rgb *= 0.85 + 0.3 * nzA.g; }
      else if (K == 1) { // printed vinyl (r3: ~30% desaturated, uneven sun fade, rain streaks from the top rail, grimy curling edges)
        tx.rgb = mix(tx.rgb, vec3(lum), 0.32) * 0.86 + 0.02;
        tx.rgb = mix(tx.rgb, vec3(lum * 0.85 + 0.1), smoothstep(0.35, 0.8, nzA.b) * 0.16 + 0.08 * vLoc.y);
        float stk = smoothstep(0.55, 0.9, texture(tNoiseS, vec2(vWPs.x + vWPs.z, vWPs.y * 0.08) * 0.35).g) * (0.35 + 0.65 * vLoc.y);
        tx.rgb *= 1.0 - 0.24 * stk;
        vec2 ed = min(vLoc, 1.0 - vLoc);
        float edg = 1.0 - smoothstep(0.004, 0.035, min(ed.x, ed.y * 0.5) + 0.018 * (nzB.r - 0.5));
        tx.rgb = mix(tx.rgb, tx.rgb * 0.5 + vec3(0.035, 0.032, 0.028), edg * 0.75);
        diffuseColor.rgb *= tx.rgb; sgR = 0.48 + 0.34 * nzB.g;
      } else if (K == 2) { // painted on brick (vertex colour = the wall): chalky, faded, mortar courses, flaking paint
        // (textures r5) critic: 'painted wall ads crisp / fresh'. Sun-bleached, chalky, soaked into the brick: stronger
        // desaturation + value cap, brick colour bleeding through, a paler top (sun fade), more and wider flaking.
        tx.rgb = mix(tx.rgb, vec3(lum), 0.45) * 0.66 + 0.05;
        tx.rgb = min(tx.rgb, vec3(0.6)) * mix(vec3(1.0), diffuseColor.rgb / max(dot(diffuseColor.rgb, vec3(0.333)), 0.05), 0.18);
        tx.rgb = mix(tx.rgb, vec3(dot(tx.rgb, vec3(0.333))) * 1.08 + 0.02, 0.35 * smoothstep(0.3, 1.0, vLoc.y));
        float course = abs(fract(vWPs.y / 0.0762) - 0.5), fw = fwidth(vWPs.y / 0.0762);
        tx.rgb *= 1.0 - 0.2 * smoothstep(0.4, 0.5, course) * clamp(1.0 - fw * 3.0, 0.0, 1.0);
        float peel = smoothstep(0.6, 0.76, nzA.r * 0.7 + nzB.g * 0.45 + 0.08 * (vLoc.y - 0.5));
        diffuseColor.rgb = mix(tx.rgb, diffuseColor.rgb, min(1.0, peel * 0.9 + 0.1));
        sgR = 0.88;
      } else if (K == 3) { // LED screen: dark glass, image emitted through a diode grid (dark louvre lines between)
        float dio = 1.0 - smoothstep(0.26, 0.42, max(abs(ledF.x), abs(ledF.y)));
        float grid = mix(1.0, dio * 1.55, ledAA);
        sgE = tx.rgb * vSig.y * grid; diffuseColor.rgb *= tx.rgb * 0.12; sgR = 0.25;
      } else if (K == 6) { // (r2) marquee bulbs: uv = bulb index (x, y), warm incandescent dots on the dark trim
        vec2 bf = fract(vMapUv) - 0.5; float bw = max(fwidth(vMapUv.x), fwidth(vMapUv.y));
        float bulb = 1.0 - smoothstep(0.2, 0.34, length(bf));
        bulb = mix(bulb, 0.3, clamp(bw * 1.5 - 0.3, 0.0, 1.0));
        float flick = 0.85 + 0.15 * fract(sin(dot(floor(vMapUv) + vWPs.xz, vec2(12.9898, 78.233))) * 43758.5453);
        sgE = vec3(1.0, 0.78, 0.46) * vSig.y * bulb * flick; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.8, 0.6), bulb); sgR = mix(0.5, 0.15, bulb);
      } else if (K == 4) { // back-lit sign box face
        sgE = tx.rgb * vSig.y; diffuseColor.rgb *= tx.rgb * 0.85; sgR = 0.35;
      } else if (K == 7) { // (r3) awning / canopy fabric: vertex colour, optional stripes (vSig.y = stripe count), soiling
        float st = vSig.y > 0.5 ? step(0.5, fract(vLoc.x * vSig.y)) : 0.0;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.58, 0.5), st * 0.85) * (0.82 + 0.3 * nzB.g) * (1.0 - 0.18 * smoothstep(0.5, 0.85, nzA.r));
        sgR = 0.88;
      } else if (K == 8) { // (r3) cut brass building-name letters (light lettering of a sign cell; board discarded)
        if (smoothstep(0.3, 0.5, lum) < 0.5) discard;
        diffuseColor.rgb *= 0.8 + 0.3 * nzB.r; sgM = 0.85; sgR = 0.32 + 0.2 * nzA.g;
      } else if (K == 9) { // (r4) second-floor window lettering: gold-leaf / white vinyl letters on the glass (board discarded)
        if (smoothstep(0.28, 0.42, lum) < 0.5) discard;
        diffuseColor.rgb = tx.rgb * (0.78 + 0.25 * nzB.r); sgM = tx.r > tx.b * 1.4 ? 0.6 : 0.0; sgR = 0.38 + 0.2 * nzA.g;
        sgE = tx.rgb * 0.35 * uNightK; // back-lit by the room at night
      } else { // (r3) ghost sign: world-space flaking paint (per brick + patches, mortar joints break it), uneven fade; no screen dither
        vec3 brd = vMapUv.x > 3.5 ? texture(tArt, vMapUv - vec2(4.0, 0.0), 5.0).rgb : texture(tSigns, vMapUv - vec2(2.0, 0.0), 5.0).rgb; // heavily blurred cell ~ the board colour
        float lumL = smoothstep(0.1, 0.24, abs(lum - dot(brd, vec3(0.2126, 0.7152, 0.0722)))); // lettering = contrast vs board (light or dark boards)
        tx.rgb = mix(tx.rgb, vec3(lum), 0.5);
        float bc = vWPs.y / 0.0762, row = floor(bc);
        float hx = (vWPs.x + vWPs.z) / 0.2032 + 0.5 * mod(row, 2.0);
        float bh = fract(sin(dot(vec2(floor(hx), row), vec2(12.9898, 78.233))) * 43758.5453);
        float nearB = clamp(1.4 - 3.0 * max(fwidth(bc), fwidth(hx) * 0.4), 0.0, 1.0);
        float wear = smoothstep(0.3, 0.85, nzA.r * 0.6 + nzB.b * 0.5 + 0.2 * (0.5 - vLoc.y));
        float cov = mix(0.04, 0.97, lumL) /* (textures r5) 0.16 -> 0.04: board-paint speckle read as white grunge */ * (1.0 - 0.7 * wear) * clamp(vSig.y * 1.7, 0.0, 1.2);
        float val = mix(nzB.g, 0.5 * nzB.g + 0.5 * bh, nearB);
        float fb = fract(bc), fh = fract(hx);
        float mj = max(1.0 - smoothstep(0.035, 0.07, min(fb, 1.0 - fb)), 1.0 - smoothstep(0.012, 0.025, min(fh, 1.0 - fh)));
        if (val > cov || mj * nearB > 0.6) discard;
        // (textures r3) ghost paint read as white blobs at grazing angles / mid range: soaked-in, darker paint (letters cap
        // ~0.5 albedo, tinted by the brick), fading further toward the wall once the bricks go sub-pixel
        // (textures r4) critic: 'ghost sign too crisp / high-contrast; fade it, brick bleed-through': more of the brick
        // colour in the paint and a higher floor of wall show-through
        vec3 gp = min(tx.rgb * 0.58 + 0.04, vec3(0.46)) * mix(vec3(1.0), diffuseColor.rgb / max(dot(diffuseColor.rgb, vec3(0.333)), 0.05), 0.45);
        diffuseColor.rgb = mix(gp, diffuseColor.rgb, min(0.94, 0.5 + 0.35 * wear + 0.15 * bh * nearB + 0.2 * (1.0 - nearB))); sgR = 0.92;
      }