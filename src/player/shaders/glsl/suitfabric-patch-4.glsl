#include <map_fragment>
vec4 fabW = vec4(0.0); vec3 fabHx = vec3(0.5, 0.5, 0.5), fabKn = vec3(0.5, 0.5, 0.5); float fabFade = 0.0, fabN1 = 0.0;
#ifdef USE_MAP
if (uFabOn > 0.5) {
  vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); float sat = (mx - mn) / max(mx, 1e-4);
  float wR = smoothstep(0.03, 0.12, c.r - max(c.g, c.b));
  float wB = smoothstep(0.015, 0.05, c.b - max(c.r, c.g)) * (1.0 - wR);
  float wW = smoothstep(0.22, 0.42, lum) * (1.0 - smoothstep(0.18, 0.4, sat)) * (1.0 - wR) * (1.0 - wB);
  float wK = (1.0 - wR) * (1.0 - wB) * (1.0 - wW);                                   // web lines, piping, emblem outline
  fabW = vec4(wR, wB, wW, wK);
  // hex tile registered onto the honeycomb already baked into suit_normal (character_tex.py: 3 cosines, 5 px period on
  // the 4096 map -> cells 5.77 px apart, neighbours along v): same pitch, orientation and phase, so the two reinforce
  // instead of beating into moire. Tile = 4 x 4*sqrt3 cells = 23.094 x 40 texels (texture x runs along Blender v).
  vec2 fabPx = vec2(vMapUv.x, 1.0 - vMapUv.y) * uFabP.x - 0.5;
  vec2 uvH = vec2(fabPx.y / 23.094, fabPx.x / 40.0), uvK = vMapUv * uFabP.y;
  fabHx = texture(uFabHex, uvH).rgb; fabKn = texture(uFabKnit, uvK).rgb;
  // detail fades out once a hex cell (1/4 tile) covers < ~2 px (mips already average it; this stops the residual shimmer)
  float cellPx = 5.7735 / max(length(fwidth(fabPx)), 1e-6);   // hex cell = 5.77 baked texels
  fabFade = smoothstep(1.6, 4.0, cellPx);
  // tonal variation in bind-pose space (sticks to the body): slow patches + a finer mottling
  fabN1 = fabNoise(vFabP * 5.0 + 1.7); float n2 = fabNoise(vFabP * 16.0 - 4.2);
  vec3 red = c * vec3(0.78, 0.84, 0.98) * (1.0 + 0.16 * fabN1 + 0.06 * n2);             // deeper crimson, gentle shifts
  red.b += 0.0035 * (0.5 + 0.5 * fabN1) * lum / 0.07;                                    // a hint of magenta in the lighter patches
  float cob = 0.5 + 0.5 * fabN1;                                                        // navy <-> cobalt
  vec3 blue = c * mix(vec3(0.78, 0.76, 0.8), vec3(1.05, 1.3, 1.2), cob) * (1.0 + 0.06 * n2);
  vec3 o = c * (1.0 + 0.04 * n2) * mix(1.0, 0.86, wW);                                  // emblem: off-white, never blown out
  o = mix(o, red, wR); o = mix(o, blue, wB);
  // woven cavities: grooves darker, crests a touch lighter (mips average to a constant tone at distance)
  float cav = dot(vec2(wR + 0.5 * wW, wB), vec2(fabHx.b - 0.62, fabKn.b - 0.55));
  o *= 1.0 + uFabP.w * cav;
  #ifdef USE_AOMAP
  float fabAO = texture(aoMap, vAoMapUv).r; o *= mix(1.0, fabAO * fabAO, 0.5);   // light crease AO on the albedo too
  #endif
  diffuseColor.rgb = o;
}
#endif