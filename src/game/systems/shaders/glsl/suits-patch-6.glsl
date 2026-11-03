#include <metalnessmap_fragment>
if (uSuitOn > 0.5) { vec4 mm = mix(vec4(metalnessFactor), uSuitMetal, step(0.0, uSuitMetal)); float ws = dot(sysW, vec4(1.0));
  metalnessFactor = mix(metalnessFactor, dot(mm, sysW) / max(ws, 1e-3), clamp(ws, 0.0, 1.0)); }