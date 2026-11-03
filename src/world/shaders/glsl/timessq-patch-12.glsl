{
          vec3 V = normalize(vWP - cameraPosition), Nn = normalize(vNW), Tt = normalize(vTanW);
          float dx = dot(V, Tt), dy = V.y, dz = max(-dot(V, Nn), 1e-3);
          vec2 sz = vRoom.zw, p = vRoom.xy * sz; const float D = 5.5;
          float tx = dx > 1e-4 ? (sz.x - p.x) / dx : (dx < -1e-4 ? -p.x / dx : 1e5);
          float ty = dy > 1e-4 ? (sz.y + 0.6 - p.y) / dy : (dy < -1e-4 ? -(p.y + 0.5) / dy : 1e5);
          float tz = D / dz, t = min(min(tx, ty), tz);
          vec3 h = vec3(p.x + dx * t, p.y + dy * t, dz * t);
          vec2 cs = vec2(0.242, 0.49), c0 = vEmissiveMapUv - vRoom.xy * cs;
          float fall = 1.0 - 0.4 * h.z / D;
          vec3 col;
          if (t >= tz - 1e-3) col = texture(emissiveMap, c0 + clamp(h.xy / sz, 0.02, 0.98) * cs).rgb;
          else if (t >= tx - 1e-3) { float s = 0.3 * h.z / D; // side walls: the outer strips of the shop picture run down the wall
            col = texture(emissiveMap, c0 + vec2(dx > 0.0 ? 0.98 - s : 0.02 + s, clamp(h.y / sz.y, 0.02, 0.98)) * cs).rgb * 0.6 * fall; }
          else if (dy > 0.0) { float lp = step(0.62, fract(h.z / 1.5 + 0.2)) * step(0.3, fract(h.x / 1.8 + 0.15));
            col = vec3(0.3, 0.29, 0.27) * fall + vec3(1.7, 1.6, 1.4) * lp; }
          else { vec2 q = vec2(h.x, h.z) / 0.6; float tl = step(0.05, fract(q.x)) * step(0.05, fract(q.y));
            col = vec3(0.36, 0.33, 0.3) * (0.7 + 0.3 * tl) * fall; }
          totalEmissiveRadiance = emissive * col * vColor.r;
        }