precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSrc, uPrev;
uniform float uRate, uReset;
// weighted MEDIAN of log2 luminance (32-bin histogram over [-12, 4] EV): robust to a bright sky or a dark glass wall
void main() {
  float h[32];
  for(int i = 0; i < 32; i++) h[i] = 0.0;
  float ws = 0.0;
  for(int y = 0; y < 24; y++) for(int x = 0; x < 40; x++) {
      vec2 uv = (vec2(float(x), float(y)) + 0.5) / vec2(40.0, 24.0);
      vec3 c = textureLod(uSrc, uv, 0.0).rgb;
      float l = clamp(log2(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-5)), -12.0, 3.99);
      vec2 d = (uv - 0.5) * vec2(1.6, 1.8);
      float w = exp(-dot(d, d) * 2.2) + 0.15;                 // centre weighted (subject), some frame-wide influence
      h[int((l + 12.0) * 2.0)] += w;
      ws += w;
    }
  // average of the 40..60th percentile band (smooth, stable)
  float cum = 0.0, acc = 0.0, aw = 0.0;
  for(int i = 0; i < 32; i++) {
    float lo = cum / ws;
    cum += h[i];
    float hi = cum / ws;
    float ov = max(0.0, min(hi, 0.6) - max(lo, 0.4));
    acc += ov * (float(i) + 0.5) * 0.5;
    aw += ov;
  }
  float cur = acc / max(aw, 1e-5) - 12.0;
  float prev = texture(uPrev, vec2(0.5)).r;
  float a = uReset > 0.5 ? 1.0 : uRate;
  fragColor = vec4(mix(prev, cur, a), cur, 0.0, 1.0);
}
