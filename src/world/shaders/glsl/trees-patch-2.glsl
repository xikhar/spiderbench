#include <begin_vertex>
      vLeaf = aLeaf; vTA = aTintA; vTB = aTintB;
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
        float ph = dot(ip, vec3(0.13, 0.0, 0.17));
        // crown sway (slow) + leaf-spray flutter (fast, outer cards only)
        transformed.xz += vec2(sin(uTime * 1.3 + ph + position.y * 0.4), cos(uTime * 1.1 + ph)) * 0.05 * position.y * 0.12;
        if (aLeaf.x < 1.5) transformed += vec3(sin(uTime * 4.1 + dot(position, vec3(3.1, 1.7, 2.3))), sin(uTime * 3.3 + dot(position, vec3(1.9, 2.9, 1.3))), 0.0).xzy * 0.035 * aLeaf.x;
      #endif