#include <map_fragment>
vec3 iInterior; float iFres; vec2 iMask = interiorWindow(iInterior, iFres);
diffuseColor.rgb = mix(diffuseColor.rgb, uFrame, iMask.y);
diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, iMask.x);