#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.5, iMask.y);
roughnessFactor = mix(roughnessFactor, 0.04, iMask.x);