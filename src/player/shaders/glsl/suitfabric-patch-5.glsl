#include <roughnessmap_fragment>
if (uFabOn > 0.5) {
  float fabMetal = 0.0;
  #ifdef USE_METALNESSMAP
  fabMetal = texture(metalnessMap, vMetalnessMapUv).b;
  #endif
  // red rubberised fabric / navy knit: matte-satin, grooves rougher; emblem + web lines slightly glossier rubber
  vec4 rr = vec4(0.58 + 0.12 * (1.0 - fabHx.b) + 0.03 * fabN1,
                 0.64 + 0.10 * (1.0 - fabKn.b) + 0.03 * fabN1,
                 0.42 + 0.06 * (1.0 - fabHx.b),
                 0.40);
  float ws = dot(fabW, vec4(1.0)) * (1.0 - smoothstep(0.2, 0.5, fabMetal));   // leave the metal web-shooter parts alone
  roughnessFactor = mix(roughnessFactor, dot(rr, fabW) / max(dot(fabW, vec4(1.0)), 1e-3), clamp(ws, 0.0, 1.0));
}