
precision highp float; in vec2 vUv; out vec4 fragColor; uniform sampler2D uSrc; uniform float uScale, uMode;
void main() { vec4 t = texture(uSrc, vUv); vec3 c = uMode > 0.5 ? vec3(t.a - 1.0) : t.rgb;
  c = abs(c) * uScale; fragColor = vec4(pow(c / (1.0 + c), vec3(1.0 / 2.2)), 1.0); }