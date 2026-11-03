#include <common>
      uniform sampler2D tCol; uniform sampler2D tNrm; uniform sampler2D tNoise; uniform sampler2D tCurb; in vec4 vRect; in vec3 vWP; in vec3 vWN;
      vec3 sN = vec3(0.0, 0.0, 1.0); float sR = 0.85;
      float curbJ(float a, float fw) { float x = abs(fract(a / 2.4) - 0.5) * 2.4, w = max(0.012, fw * 1.5); return 0.45 * smoothstep(1.2 - w, 1.2, x) * (0.012 / w); } // (textures r2) curbstone joints, AA
      void walk(out vec3 walkColor) {
        vec2 p = vWP.xz;
        vec2 fwP = fwidth(p); // (textures r2) uniform control flow
        vec3 nz = texture(tNoise, p / 53.0).rgb;
        float d = min(min(p.x - vRect.x, vRect.z - p.x), min(p.y - vRect.y, vRect.w - p.y));
        if (vWN.y < 0.5) {
          // curb face: weathered concrete/granite, dirtier near the gutter
          vec2 q = vec2(p.x + p.y, vWP.y) / 1.3;
          vec3 c = texture(tCurb, q).rgb * 0.92; // (textures r2) $imagegen granite curbstone (was the sidewalk sheet)
          c *= 1.0 - curbJ(p.x + p.y, fwP.x + fwP.y); // 2.4 m stone joints
          c *= mix(0.55, 1.0, smoothstep(-0.02, 0.14, vWP.y));
          sR = 0.85; sN = vec3(0.0, 0.0, 1.0);
          walkColor = c; return;
        }
        vec2 uv = p / 6.0; // (textures) imagegen sidewalk sheet holds 4 x 4 slabs -> 1.5 m (5 ft) NYC slabs
        vec3 c = texture(tCol, uv).rgb;
        vec3 n = texture(tNrm, uv).rgb;
        float curb = 1.0 - smoothstep(0.26, 0.3, d);
        if (curb > 0.0) {
          vec3 cc = texture(tCurb, p / 1.1 + 0.3).rgb * 0.97; // (textures r2) granite curb top + 2.4 m joints
          float cAl = (min(p.x - vRect.x, vRect.z - p.x) < min(p.y - vRect.y, vRect.w - p.y)) ? p.y : p.x;
          cc *= 1.0 - curbJ(cAl, max(fwP.x, fwP.y));
          c = mix(c, cc, curb);
          n = mix(n, vec3(0.5, 0.5, 0.7), curb);
        }
        c *= 0.93 + 0.14 * nz.r; // subtle slab-to-slab variation (refs/road/road_2_sidewalk)
        c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 1.2, abs(d - 0.3))) * nz.b;
        // (foundation r13) critic: 'streets from altitude read as blank white stripes', 'riverfront edges are ruler-
        // straight white strips'. Aerial LOD tone: grime, tree pits, street furniture and kerb shadows aggregate, so from
        // the rooftops / the air the sidewalks sit a step darker (no change within 150 m). Promenade / plaza fill pieces
        // (vRect unset) are laid in warmer, darker hex / brick pavers like the East River + Hudson esplanades.
        {
          float adist = length(vWP - cameraPosition);
          c *= mix(1.0, 0.78, smoothstep(150.0, 900.0, adist));
          if (vRect.x < -5e4) {
            vec2 hp = p / vec2(0.9, 0.78);
            float row = floor(hp.y), cu = fract(hp.x + 0.5 * mod(row, 2.0)), cv = fract(hp.y);
            float jn = 1.0 - smoothstep(0.0, 0.07, min(min(cu, 1.0 - cu), min(cv, 1.0 - cv)));
            float fwp = clamp(fwidth(hp.x) * 2.0, 0.0, 1.0);
            c *= vec3(0.86, 0.82, 0.77) * (1.0 - 0.18 * jn * (1.0 - fwp));
            c *= mix(1.0, 0.9, smoothstep(120.0, 600.0, adist));
          }
        }
        sR = mix(n.b, 1.0, smoothstep(300.0, 1100.0, length(vWP - cameraPosition))); // (r13) matte from afar (no grazing glare strips)
        vec2 nxy = n.rg * 2.0 - 1.0; sN = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));
        walkColor = c;
      }