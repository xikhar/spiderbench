#include <map_fragment>
        { float n = dN(vDW * 0.35) * 0.6 + dN(vDW * 1.7) * 0.4;
          diffuseColor.rgb *= 0.82 + 0.3 * n;                                  // patched / sealed asphalt
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.2, 0.19), smoothstep(0.72, 0.8, dN(vDW * 0.12 + 3.0)) * 0.5); }