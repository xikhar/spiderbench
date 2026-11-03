#include <map_fragment>
      { vec2 p = vHexW / 0.23; // hexagon cells (~0.4 m across)
        vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
        vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        vec2 id = p - g;
        vec2 q = abs(g); float edge = 0.5 - max(dot(q, normalize(r)), q.x);
        float fw = fwidth(p.x) * 1.2;
        float mortar = 1.0 - smoothstep(0.02, 0.02 + fw, edge);
        float far = smoothstep(0.08, 0.35, fw);
        float tone = 0.86 + 0.2 * hxH(floor(id * 10.0 + 0.5));
        float gr = 0.9 + 0.1 * sin(vHexW.x * 0.37 + vHexW.y * 0.21) * sin(vHexW.y * 0.13);
        diffuseColor.rgb *= mix(tone * mix(1.0, 0.55, mortar), 0.9, far) * gr; }