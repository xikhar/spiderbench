#include <emissivemap_fragment>
if (uSuitOn > 0.5) totalEmissiveRadiance += uSuitER * sysW.x + uSuitEB * sysW.y + uSuitEW * sysW.z + uSuitEK * sysW.w;