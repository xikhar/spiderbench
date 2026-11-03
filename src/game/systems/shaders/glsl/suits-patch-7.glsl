#include <normal_fragment_maps>
if (uSuitOn > 0.5 && uSym > 0.5) { // bump from the symbiote height field (Mikkelsen surface-gradient, view space)
  vec3 sp = -vViewPosition, dpx = dFdx(sp), dpy = dFdy(sp); float hx = dFdx(sysH), hy = dFdy(sysH);
  vec3 R1 = cross(dpy, normal), R2 = cross(normal, dpx); float det = dot(dpx, R1);
  normal = normalize(abs(det) * normal - sign(det) * (hx * R1 + hy * R2) * uSymBump);
}