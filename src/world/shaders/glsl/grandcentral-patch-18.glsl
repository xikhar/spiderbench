#include <common>
      in vec3 vPW; in vec3 vPN; float pOpq = 0.0; float pH = 0.0, pH2 = 0.0, pH3 = 0.0; vec3 pInt = vec3(0.0);
      float ph(vec2 p) { return fract(sin(dot(p, vec2(41.37, 289.11))) * 23758.5453); }