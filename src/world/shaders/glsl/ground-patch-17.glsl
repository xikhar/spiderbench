#include <normal_fragment_maps>
      {
        vec2 p = vWP.xz; float e = 3.0;
        #define GH(q) (texture(tNoise, (q) / 160.0 + vec2(0.27, 0.61)).g * 1.5 + texture(tNoise, (q) / 45.0 + vec2(0.83, 0.13)).r * 0.6)
        float dx = (GH(p + vec2(e, 0.0)) - GH(p - vec2(e, 0.0))) / (2.0 * e), dz = (GH(p + vec2(0.0, e)) - GH(p - vec2(0.0, e))) / (2.0 * e);
        #undef GH
        vec3 nW = normalize(vec3(-dx * 6.0, 1.0, -dz * 6.0));
        normal = normalize(mix(normal, (viewMatrix * vec4(nW, 0.0)).xyz, 0.85));
      }