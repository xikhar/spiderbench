#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.6, iMask.y);
metalnessFactor = mix(metalnessFactor, 0.0, iMask.x);