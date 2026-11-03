in vec3 vP;
out vec4 fragColor;

void main() {
  float height = clamp((vP.y + 1.0) / 9.0, 0.0, 1.0);
  vec3 topColor = vec3(0.004, 0.008, 0.03);
  vec3 middleColor = vec3(0.03, 0.06, 0.16);
  vec3 horizonGlow = vec3(0.25, 0.45, 1.1);

  vec3 color = mix(middleColor, topColor, smoothstep(0.1, 0.9, height));
  color += horizonGlow * exp(-pow((vP.y - 1.2) / 0.9, 2.0)) * 0.35;

  float grid = step(0.985, fract(atan(vP.z, vP.x) * 14.3)) +
    step(0.97, fract(vP.y * 1.2));
  color += vec3(0.025, 0.045, 0.11) * grid * (1.0 - height) *
    smoothstep(0.0, 0.25, height);

  fragColor = vec4(color, 1.0);
}
