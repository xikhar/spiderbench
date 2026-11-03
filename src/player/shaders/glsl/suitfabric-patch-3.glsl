#include <common>
uniform float uFabOn, uFabNightK; uniform sampler2D uFabHex, uFabKnit; uniform vec4 uFabP; uniform vec3 uCityAmbLo, uCityAmbHi;
in vec3 vFabP;
float fabHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fabNoise(vec3 x) { // value noise, -1..1
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return 2.0 * mix(mix(mix(fabHash(i), fabHash(i + vec3(1, 0, 0)), f.x), mix(fabHash(i + vec3(0, 1, 0)), fabHash(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(fabHash(i + vec3(0, 0, 1)), fabHash(i + vec3(1, 0, 1)), f.x), mix(fabHash(i + vec3(0, 1, 1)), fabHash(i + vec3(1, 1, 1)), f.x), f.y), f.z) - 1.0;
}