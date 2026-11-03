#include <color_fragment>
        vec3 garmentColor;
        garment(vCol, garmentColor);
        diffuseColor.rgb = garmentColor; if (gCut || gHairCut) discard;
        if (uBakeOn > 0.5) { gBake = texture(uBake, vBUv);   // (peds r2) baked occlusion replaces the per-vertex AO on base parts
          if (vOptF < 0.5) diffuseColor.rgb *= clamp((0.3 + 0.7 * gBake.a) / max(vAOm, 0.3), 0.35, 1.5); }