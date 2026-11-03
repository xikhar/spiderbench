#include <lights_physical_fragment>
material.specularColor = mix(material.specularColor, vec3(gF0) * gSpecTint, clamp(gGlass, 0.0, 1.0));
material.specularF90 = mix(material.specularF90, 0.55, clamp(gGlass, 0.0, 1.0) * gSash); // (textures r4) 0.3 -> 0.55