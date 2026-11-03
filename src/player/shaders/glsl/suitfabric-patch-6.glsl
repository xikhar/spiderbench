#include <lights_fragment_maps>
#ifdef USE_CITYL
iblIrradiance *= mix(1.0, 0.35, uFabNightK); radiance *= mix(1.0, 0.6, uFabNightK);
#endif
{ vec3 fabWN = transformDirectionByInverseViewMatrix(normal, viewMatrix);
  irradiance += mix(uCityAmbLo, uCityAmbHi, 0.5 + 0.5 * fabWN.y) * (0.75 + 0.25 * (1.0 - abs(fabWN.y))); }