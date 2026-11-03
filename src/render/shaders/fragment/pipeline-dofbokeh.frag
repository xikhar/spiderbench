
precision highp float; in vec2 vUv; out vec4 fragColor;
uniform sampler2D uSrc; uniform vec2 uKernel[TAPS]; uniform float uMaxCoc; uniform vec2 uPx;
float weigh(float coc, float r) { return clamp((coc - r + 2.0) / 2.0, 0.0, 1.0); }
void main() {
  vec4 ctr = texture(uSrc, vUv);
  vec3 bg = vec3(0.0), fg = vec3(0.0); float bw = 0.0, fw = 0.0;
  for (int i = 0; i < TAPS; i++) {
    vec2 o = uKernel[i] * uMaxCoc; float r = length(o);
    vec4 s = texture(uSrc, vUv + o * uPx);
    float w = weigh(max(0.0, min(s.a, ctr.a)), r); bg += s.rgb * w; bw += w;
    float f = weigh(-s.a, r); fg += s.rgb * f; fw += f;
  }
  bg /= bw + (bw == 0.0 ? 1.0 : 0.0);
  fg /= fw + (fw == 0.0 ? 1.0 : 0.0);
  float a = min(1.0, fw * 3.14159 / float(TAPS));
  fragColor = vec4(mix(bg, fg, a), a);
}