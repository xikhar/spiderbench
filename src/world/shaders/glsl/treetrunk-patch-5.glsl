#include <normal_fragment_maps>
        { // bark normal map in the derivative tangent frame (no tangent attribute)
          vec3 mapN = texture(tBarkN, bkUv).xyz * 2.0 - 1.0; mapN.xy *= 1.35;
          vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
          vec2 st0 = dFdx(vBUv), st1 = dFdy(vBUv);
          vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);
          vec3 Tt = q1p * st0.x + q0p * st1.x, Bt = q1p * st0.y + q0p * st1.y;
          float det = max(dot(Tt, Tt), dot(Bt, Bt));
          float sc = det == 0.0 ? 0.0 : inversesqrt(det);
          normal = normalize(Tt * (mapN.x * sc) + Bt * (mapN.y * sc) + normal * mapN.z);
        }