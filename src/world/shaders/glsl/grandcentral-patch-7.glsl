#include <normal_fragment_maps>
        {
          vec2 dH = vec2(dFdx(gH) / max(length(dFdx(vViewPosition)), 1e-4), dFdy(gH) / max(length(dFdy(vViewPosition)), 1e-4));
          dH = clamp(dH, vec2(-0.8), vec2(0.8));
          if (abs(dH.x) + abs(dH.y) > 1e-4) normal = gcPerturb(-vViewPosition, normal, dH, faceDirection);
        }