
uniform sampler2D tGM; uniform mat4 uGMMat; uniform vec4 uGMPlane; uniform float uGMOn;
// mirror image (rgb) + coverage (a) at this facade point, or 0 when it is not on the mirrored plane
vec4 glassMirror(vec3 wp, vec3 wn) {
  if (uGMOn < 0.5) return vec4(0.0);
  float pd = dot(wp, uGMPlane.xyz) - uGMPlane.w;
  float pm = smoothstep(0.96, 0.99, dot(wn, uGMPlane.xyz)) * (1.0 - smoothstep(0.2, 0.45, abs(pd)));
  if (pm <= 0.0) return vec4(0.0);
  vec4 rp = uGMMat * vec4(wp, 1.0);
  if (rp.w <= 0.0) return vec4(0.0);
  vec2 ruv = rp.xy / rp.w;
  vec2 e = smoothstep(0.0, 0.03, ruv) * smoothstep(1.0, 0.97, ruv);
  vec4 m = texture(tGM, ruv);
  return vec4(m.rgb, clamp(m.a, 0.0, 1.0) * pm * e.x * e.y);
}
