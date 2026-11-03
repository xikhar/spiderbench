#include <normal_fragment_begin>
        normal = normalize(vNormal);
        { // per-leaf normals from the atlas, in the derivative tangent frame (the core: strong, so it never shades as a ball)
          vec3 mapN = texture(uLeafN, core ? fract(vMapUv) : vMapUv).xyz * 2.0 - 1.0;
          if (core) mapN.xy *= 2.2;
          vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
          vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);
          vec3 Tt = q1p * gx.x + q0p * gy.x, Bt = q1p * gx.y + q0p * gy.y;
          float det = max(dot(Tt, Tt), dot(Bt, Bt));
          float sc = det == 0.0 ? 0.0 : inversesqrt(det);
          normal = normalize(normal * max(mapN.z, 0.3) + (Tt * mapN.x + Bt * mapN.y) * sc * 0.9);
        }