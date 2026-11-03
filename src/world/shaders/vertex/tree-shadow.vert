in float aKind;
in vec4 aTree;

uniform vec3 uSun;
uniform float uY;

out float vShadowRadius;
out float vTreeKind;
out float vShadowStrength;

void main() {
  vTreeKind = aKind;
  vShadowRadius = length(position.xz);

  vec3 worldPosition;
  float cameraDistance = length(aTree.xy - cameraPosition.xz);

  if(aKind < 0.5) {
    worldPosition = vec3(aTree.x + position.x * aTree.z * 1.15, uY, aTree.y + position.z * aTree.z * 1.15);
    vShadowStrength = 1.0;
  } else {
    float sunElevation = max(asin(clamp(uSun.y, 0.0, 1.0)), 0.2);
    vec2 shadowDirection = -normalize(uSun.xz + vec2(1e-4));
    vec2 shadowCenter = aTree.xy + shadowDirection * aTree.w / tan(sunElevation) * 0.92;
    float shadowStretch = min(1.0 / sin(sunElevation), 2.4);
    vec2 shadowOffset = position.x * shadowDirection * shadowStretch +
      position.z * vec2(-shadowDirection.y, shadowDirection.x);

    worldPosition = vec3(shadowCenter.x + shadowOffset.x * aTree.z * 0.95, uY + 0.004, shadowCenter.y + shadowOffset.y * aTree.z * 0.95);
    // Nearby trees already cast real cascaded shadow-map shadows.
    vShadowStrength = smoothstep(145.0, 180.0, cameraDistance) *
      smoothstep(0.02, 0.12, uSun.y);
  }

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
}
