
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform float uZ; uniform vec2 uPW;
vec3 hash33(vec3 p) { p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float worley(vec3 p, float per) {
  vec3 id = floor(p), f = fract(p); float md = 1.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(x, y, z); vec3 h = hash33(mod(id + o, per) + 0.5);
    vec3 r = o + h - f; md = min(md, dot(r, r));
  }
  return 1.0 - sqrt(md);
}
float gnoise(vec3 p, float per) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n[8];
  for (int k = 0; k < 8; k++) {
    vec3 o = vec3(k & 1, (k >> 1) & 1, (k >> 2) & 1);
    vec3 g = normalize(hash33(mod(i + o, per) + 0.5) * 2.0 - 1.0);
    n[k] = dot(g, f - o);
  }
  return mix(mix(mix(n[0], n[1], u.x), mix(n[2], n[3], u.x), u.y), mix(mix(n[4], n[5], u.x), mix(n[6], n[7], u.x), u.y), u.z);
}
float perlinFbm(vec3 p, float per) {
  float s = 0.0, a = 1.0, w = 0.0;
  for (int i = 0; i < 6; i++) { s += gnoise(p, per) * a; w += a; a *= 0.5; p *= 2.0; per *= 2.0; }
  return s / w * 0.5 + 0.5;
}
float worleyFbm(vec3 p, float per) {
  return worley(p, per) * 0.625 + worley(p * 2.0, per * 2.0) * 0.25 + worley(p * 4.0, per * 4.0) * 0.125;
}
float remap(float v, float a, float b, float c, float d) { return c + (v - a) / (b - a) * (d - c); }
void main() {
  vec3 p = vec3(vUv, uZ);
  float pf = perlinFbm(p * 4.0, 4.0);
  float wf = worleyFbm(p * 4.0, 4.0);
  float pw = (0.6 * pf + 0.4 * wf - uPW.x) / uPW.y;
  fragColor = vec4(clamp(pw, 0.0, 1.0), wf, worleyFbm(p * 8.0, 8.0), worleyFbm(p * 16.0, 16.0));
}