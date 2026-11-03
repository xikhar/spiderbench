#include <common>
      in vec3 vLWP;
      float lh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }