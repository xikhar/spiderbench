#include <common>
in vec2 vDetailUv; uniform sampler2D uDetailNormal; uniform float uDetailScale, uDetailStrength;
vec3 detailPerturb(vec3 n, vec3 viewPos, vec2 uv) {
  vec3 q0 = dFdx(viewPos), q1 = dFdy(viewPos); vec2 st0 = dFdx(uv), st1 = dFdy(uv);
  vec3 q1perp = cross(q1, n), q0perp = cross(n, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x; vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B)); float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  vec3 d = texture(uDetailNormal, uv).xyz * 2.0 - 1.0; d.xy *= uDetailStrength;
  return normalize(T * (d.x * sc) + B * (d.y * sc) + n * d.z);
}