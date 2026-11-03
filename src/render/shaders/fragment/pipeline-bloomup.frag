precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSrc, uCur;
uniform vec2 uPx;
uniform float uRadius;
uniform float uT, uK, uThrSrc;
vec3 thr(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float s = clamp(l - uT + uK, 0.0, 2.0 * uK);
  s = s * s / (4.0 * uK + 1e-4);
  return c * max(s, l - uT) / max(l, 1e-4);
}
vec3 src(vec2 uv) {
  vec3 c = texture(uSrc, uv).rgb;
  return uThrSrc > 0.5 ? thr(c) : c;
}
void main() {
  vec4 d = vec4(uPx, -uPx.x, 0.0) * uRadius;
  vec3 s = src(vUv - d.xy) + 2.0 * src(vUv - d.wy) + src(vUv - d.zy) + 2.0 * src(vUv + d.zw) + 4.0 * src(vUv) + 2.0 * src(vUv + d.xw) + src(vUv + d.zy) + 2.0 * src(vUv + d.wy) + src(vUv + d.xy);
  fragColor = vec4(thr(texture(uCur, vUv).rgb) + s / 16.0, 1.0);
}