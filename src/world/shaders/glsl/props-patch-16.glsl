#include <uv_vertex>
#ifdef USE_MAP
 vMapUv = aCell.xy + uv * aCell.zw;
#endif
#ifdef USE_EMISSIVEMAP
 vEmissiveMapUv = vMapUv;
#endif