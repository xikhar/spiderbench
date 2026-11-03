#include <common>
      in vec3 vCW;
      float ch(float x) { return fract(sin(x * 91.7) * 43758.5453); }
      float vn(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(ch(i), ch(i + 1.0), f); }