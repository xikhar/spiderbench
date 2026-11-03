#include <common>
      in vec2 vLeaf; in vec3 vTA; in vec3 vTB; uniform sampler2D uLeafN; uniform vec4 uLeafFrame;
      float leafIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }