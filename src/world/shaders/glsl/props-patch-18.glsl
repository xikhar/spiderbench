#include <emissivemap_fragment>
 totalEmissiveRadiance *= mix(vGain, max(vGain, 0.25), uNightK) / 0.06; // (night r9) rooftop prints floodlit at night