#include <normal_fragment_maps>
        { vec3 sx = normalize(dFdx(-vViewPosition)), sy2 = normalize(dFdy(-vViewPosition));
          vec2 dh = vec2(dFdx(crClump), dFdy(crClump)) * 3.0 + (vec2(dFdx(tx.r), dFdy(tx.r)) * 0.5);
          vec3 r1 = cross(sy2, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
          if (det != 0.0) normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2)); }