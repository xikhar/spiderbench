#include <roughnessmap_fragment>
if (uSuitOn > 0.5) { vec4 rr = mix(vec4(roughnessFactor), uSuitRough, step(0.0, uSuitRough)); float ws = dot(sysW, vec4(1.0));
  roughnessFactor = mix(roughnessFactor, dot(rr, sysW) / max(ws, 1e-3), clamp(ws, 0.0, 1.0)); }