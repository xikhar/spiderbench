{
        vec3 an = abs(vWNs);
        vec2 q = an.x > an.z ? vWPs.zy : vWPs.xy; if (an.y > 0.7) q = vWPs.xz;
        vec3 nz = texture(tSN, q / 17.0).rgb, nz2 = texture(tSN, q / 3.1).rgb;
        // ashlar coursing: 0.9 m courses, 1.8 m blocks (offset every other course), thin dark joints
        float cy = q.y / 0.9, row = floor(cy), cx = q.x / 1.8 + 0.5 * mod(row, 2.0);
        vec2 f = vec2(fract(cx), fract(cy)); vec2 fw = fwidth(vec2(cx, cy)) * 1.5 + 1e-4;
        float joint = max(1.0 - smoothstep(0.0, 0.03 + fw.x, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, 0.04 + fw.y, min(f.y, 1.0 - f.y)));
        joint *= 1.0 - smoothstep(0.2, 0.6, max(fw.x, fw.y));
        float blk = fract(sin(dot(floor(vec2(cx, cy)), vec2(12.9898, 78.233))) * 43758.5453);
        vec3 c = diffuseColor.rgb * (0.86 + 0.16 * blk) * (0.8 + 0.3 * nz.r) * (0.93 + 0.1 * nz2.g);
        c *= 1.0 - 0.35 * joint;
        c *= mix(0.72, 1.0, smoothstep(-1.0, 6.0, vWPs.y)); // wet / algae band at the water line
        c *= 1.0 - 0.18 * smoothstep(0.55, 0.85, nz.b) * (0.5 + 0.5 * an.x + 0.5 * an.z); // grime streaks
        diffuseColor.rgb = c;
      }