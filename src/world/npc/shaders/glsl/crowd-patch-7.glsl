#include <normal_fragment_maps>
        if (uBakeOn > 0.5) { vec3 bn = gBake.rgb * 2.0 - 1.0; float bl = length(bn);   // (peds r2) baked object-space (rest pose) normal, skinned
          if (bl > 0.6) { vec3 nb = normalize(mat3(vB0, vB1, vB2) * (bn / bl)); normal = normalize(mix(normal, nb, smoothstep(-0.25, 0.35, dot(nb, normal)))); } }
        if (gH != 0.0) normal = bumpN(-vViewPosition, normal, gH);