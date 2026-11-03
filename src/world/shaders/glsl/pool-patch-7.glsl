#include <common>
      in float vDistFade; uniform vec4 uLodFrame;
      float dfIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }