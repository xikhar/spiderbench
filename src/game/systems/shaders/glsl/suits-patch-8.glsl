#include <lights_fragment_maps>
if (uSuitOn > 0.5 && uSym > 0.5) radiance *= mix(1.0 / 1.6, 1.0, sysGloss); // env boost (S.env) only on the wet patches (r10k)