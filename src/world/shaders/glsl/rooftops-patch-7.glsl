#include <normal_fragment_maps>
      { vec3 Nw = normalize(vRWN); vec3 Tw, Bw;
        if (abs(Nw.y) > 0.5) { Tw = vec3(1.0, 0.0, 0.0); Bw = vec3(0.0, 0.0, -1.0); } else { Tw = normalize(cross(vec3(0.0, 1.0, 0.0), Nw)); Bw = vec3(0.0, 1.0, 0.0); }
        vec3 nw = normalize(Tw * rN.x + Bw * rN.y + Nw * rN.z);
        if (rN.z < 0.9999) normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz); }