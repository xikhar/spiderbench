#include <normal_fragment_maps>
      { vec3 Nw = normalize(vWN); vec3 Tw = abs(Nw.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), Nw)); vec3 Bw = cross(Nw, Tw);
        vec3 nw = normalize(Tw * dN.x + Bw * dN.y + Nw * dN.z); if (dN.z < 0.999) normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz); }