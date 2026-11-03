#include <common>
      in vec3 vWPm; in float vWin; in float vGl; uniform float uNightK;
      float mh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }