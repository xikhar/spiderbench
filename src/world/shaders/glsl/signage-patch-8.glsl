#include <emissivemap_fragment>
__SHADER_INJECT_0____SHADER_INJECT_1__if ((K == 3 || K == 4) && uNightK > 0.0) { float scrM = max(max(tx.r, tx.g), tx.b); if (scrM > uScrKnee) { float scrW = uScrTop - uScrKnee; float scrY = uScrKnee + scrW * (1.0 - exp(-(scrM - uScrKnee) / scrW)); sgE *= mix(1.0, scrY / scrM, uNightK); } }
if (uNightK > 0.0) { if (K == 1) sgE += diffuseColor.rgb * uNightK * 0.28 * (0.5 + 0.5 * smoothstep(0.2, 1.0, vLoc.y)); }
totalEmissiveRadiance += sgE;