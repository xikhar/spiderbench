in vec2 vShadowCoordinates;
in float vOpacity;
in float vShadowPart;

out vec4 fragColor;

void main() {
  float distanceFromCenter = length(vShadowCoordinates);
  float shadowOpacity;

  // Hips use a soft halo; feet use a stronger core under the sole with a soft edge.
  if(vShadowPart < 0.5) {
    shadowOpacity = vOpacity * exp(-distanceFromCenter * distanceFromCenter * 2.2) *
      (1.0 - smoothstep(0.75, 1.0, distanceFromCenter));
  } else {
    shadowOpacity = vOpacity *
      (1.0 - smoothstep(0.05, 1.0, distanceFromCenter)) *
      (1.0 - 0.35 * smoothstep(0.3, 1.0, distanceFromCenter));
  }

  if(shadowOpacity < 0.004)
    discard;
  fragColor = vec4(0.0, 0.0, 0.0, shadowOpacity);
}
