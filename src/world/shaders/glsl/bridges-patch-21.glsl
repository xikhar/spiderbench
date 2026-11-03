{
        vec3 c = texture(tDC, vWPd.xz / 6.0).rgb * 1.1;
        float md = floor(vEx.z + 0.5);
        vec3 nz = texture(tSN, vWPd.xz / 23.0).rgb;
        if (vWNd.y < 0.5) c = vec3(0.42, 0.42, 0.41) * (0.85 + 0.25 * nz.r); // slab edges / fascia / kerbs: concrete
        else if (md == 1.0) {
          float l = abs(vUD.y), a = vUD.x, inner = vEx.x, outer = vEx.y;
          float fw = fwidth(vUD.y) + 1e-3;
          float fade = 1.0 - smoothstep(0.08, 0.3, fw); // lines fade to the asphalt tone before they alias
          float w = bandL(l, outer - 0.45, 0.15, fw);
          if (inner > 0.3) w = max(w, bandL(l, inner + 0.45, 0.15, fw));
          float n = floor((outer - inner - 1.0) / __SHADER_INJECT_0__ + 0.5);
          float k = floor((l - inner - 0.5) / __SHADER_INJECT_1__ + 0.5);
          if (k >= 1.0 && k <= n - 1.0) w = max(w, bandL(l, inner + 0.5 + k * __SHADER_INJECT_2__, 0.13, fw) * step(fract(a / 12.0), 0.27));
          float y = inner < 0.3 ? max(bandL(l, 0.2, 0.12, fw), 0.0) : 0.0;
          // tyre-polished wheel paths (darker, smoother) in every lane
          float ln = fract((l - inner - 0.5) / __SHADER_INJECT_3__);
          float wear = (1.0 - smoothstep(0.08, 0.16, abs(ln - 0.27))) + (1.0 - smoothstep(0.08, 0.16, abs(ln - 0.73)));
          c *= 1.0 - 0.13 * wear * step(l, outer - 0.5) * step(inner + 0.5, l);
          // expansion joints every 30 m (steel strip)
          c = mix(c, vec3(0.32, 0.31, 0.3), (1.0 - smoothstep(0.05, 0.12 + fwidth(a), abs(fract(a / 30.0) - 0.5) * 30.0)) * fade);
          c = mix(c, vec3(0.84, 0.83, 0.78) * (0.8 + 0.25 * nz.g), w * 0.85 * fade);
          c = mix(c, vec3(0.78, 0.6, 0.17), y * 0.85 * fade);
        } else if (md == 2.0) { // timber planks across the promenade, grey-brown, worn
          float a = vUD.x / 0.32, pl = fract(a), id = floor(a);
          float h = fract(sin(id * 12.9898) * 43758.5453);
          // (bridges r2) weathered timber: warm brown boards greyed by the sun, darker grime patches and a
          // foot-polished centre band, dark gaps between the boards
          vec3 wood = vec3(0.43, 0.33, 0.24) * (0.72 + 0.34 * h);
          vec3 grey = vec3(0.4, 0.38, 0.35) * (0.8 + 0.2 * h);
          c = mix(wood, grey, 0.35 + 0.4 * nz.g);
          float grain = texture(tSN, vec2(vWPd.x * 0.9, vUD.y * 11.0 + id * 3.1)).r;
          c *= 0.82 + 0.3 * grain;
          c *= 1.0 - 0.32 * smoothstep(0.52, 0.8, texture(tSN, vWPd.xz / 7.0).b);       // grime / wet-rot patches
          c *= 1.0 - 0.18 * smoothstep(1.2, 3.2, abs(vUD.y));                            // edges darker (less foot traffic)
          c *= 1.0 - 0.55 * (1.0 - smoothstep(0.0, 0.07 + fwidth(a), min(pl, 1.0 - pl))) * (1.0 - smoothstep(0.2, 0.5, fwidth(a)));
        } else if (md == 3.0) { // ballast + timber ties every 0.62 m
          vec3 bal = vec3(0.36, 0.34, 0.31) * (0.7 + 0.5 * texture(tSN, vWPd.xz / 1.3).r);
          float t = fract(vUD.x / 0.62), tie = step(abs(t - 0.5), 0.2) * step(abs(abs(vUD.y) - 2.3), 1.35);
          c = mix(bal, vec3(0.22, 0.18, 0.15), tie * (1.0 - smoothstep(0.2, 0.5, fwidth(vUD.x / 0.62))));
        } else if (md == 4.0) { c = vec3(0.56, 0.55, 0.52) * (0.8 + 0.3 * nz.r); }
        diffuseColor.rgb *= c;
      }