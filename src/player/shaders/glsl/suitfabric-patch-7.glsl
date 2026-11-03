#include <normal_fragment_maps>
#ifdef USE_NORMALMAP_TANGENTSPACE
if (uFabOn > 0.5) {
  // tbn = (dP/du, dP/dv) of the glTF UVs. Hex texture x runs along -v, y along +u -> rotate into (u, v).
  vec2 hx = fabHx.xy * 2.0 - 1.0;
  vec2 dn = vec2(hx.y, -hx.x) * (fabW.x + 0.45 * fabW.z) + (fabKn.xy * 2.0 - 1.0) * fabW.y;
  dn *= uFabP.z * fabFade;
  normal = normalize(tbn * vec3(mapN.xy + dn, mapN.z));
}
#endif