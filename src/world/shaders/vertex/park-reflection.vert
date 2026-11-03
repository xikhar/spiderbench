in float aT;

out float vT;
out vec3 vW;

#include <fog_pars_vertex>

void main() {
  vT = aT;

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vW = worldPosition.xyz;

  vec4 viewPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * viewPosition;

  #include <fog_vertex>
}
