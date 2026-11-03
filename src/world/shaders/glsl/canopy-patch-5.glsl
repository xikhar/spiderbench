#include <normal_fragment_maps>
          { vec3 sx = normalize(dFdx(-vViewPosition)), sy = normalize(dFdy(-vViewPosition));
            vec2 dh = vec2(dFdx(cClump), dFdy(cClump)) * 2.2;
            vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
            vec3 bn = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
            if (det != 0.0) normal = bn; }