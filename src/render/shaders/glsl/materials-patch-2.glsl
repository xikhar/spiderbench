#include <uv_vertex>
#ifdef USE_UV
vDetailUv = uv;
#else
vDetailUv = vec2(0.0);
#endif