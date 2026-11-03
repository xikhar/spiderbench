#include <emissivemap_fragment>
totalEmissiveRadiance += FS.emis;
if (uNightK > 0.0) totalEmissiveRadiance += FS.alb / max(1.0 - gAoT, 0.4) * (1.0 - 0.6 * FS.metal) * crownFlood(vWPos, normalize(vWN)) * uNightK; // (night) crown floods