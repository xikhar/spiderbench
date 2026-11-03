in float vShadowRadius;
in float vTreeKind;
in float vShadowStrength;

out vec4 fragColor;

void main() {
  float shadowOpacity;
  if(vTreeKind < 0.5) {
    shadowOpacity = (1.0 - smoothstep(0.15, 1.0, vShadowRadius)) * 0.32;
  } else {
    shadowOpacity = (1.0 - smoothstep(0.45, 1.0, vShadowRadius)) *
      0.5 *
      vShadowStrength;
  }

  fragColor = vec4(vec3(1.0 - shadowOpacity), 1.0);
}
