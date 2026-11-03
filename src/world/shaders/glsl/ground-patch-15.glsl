#include <common>
      uniform sampler2D tCol; uniform sampler2D tNoise; in vec3 vWP;
      uniform vec4 uMd[__SHADER_INJECT_0__]; uniform float uMa[__SHADER_INJECT_1__]; uniform vec4 uPw[__SHADER_INJECT_2__]; uniform float uPa[__SHADER_INJECT_3__]; uniform vec4 uPh[__SHADER_INJECT_4__]; uniform float uPq[__SHADER_INJECT_5__];
      float pondD(vec2 p, vec4 e, float a, vec4 h, float wq) { // same outline function as layout.js PARK_WATER
        vec2 d = p - e.xy; float c = cos(a), s = sin(a);
        vec2 q = vec2((d.x * c - d.y * s) / e.z, (d.x * s + d.y * c) / e.w);
        float t = atan(q.y, q.x);
        float k = 1.0 + 0.08 * sin(t * 3.0 + e.x) + 0.05 * sin(t * 5.0 + e.y * 0.1)
          + h.x * sin(t * 2.0 + 0.7) + h.y * sin(t * 3.0 + 2.1) + h.z * cos(t * 4.0) + h.w * sin(t * 5.0 + 4.2)
          + wq * (sin(t * 7.0 + e.x * 0.05) + 0.7 * sin(t * 11.0 + e.y * 0.03) + 0.45 * sin(t * 17.0 + 1.9)); // (round 7)
        return length(q) / k;
      }
      float pkFld(vec2 p, float f, float ph) { // (park r3) = trees.js fld(): open-woodland field
        return 0.5 + 0.5 * (0.55 * sin(p.x * f + ph) * cos(p.y * f * 0.83 - ph * 1.7) + 0.3 * sin((p.x * 0.6 - p.y * 0.8) * f * 2.1 + ph * 2.3) + 0.15 * sin((p.x * 0.9 + p.y * 0.4) * f * 4.3 + ph * 0.7)); }
      float ellD(vec2 p, vec4 e, float a, float w1, float w2, float ph2) {
        vec2 d = p - e.xy; float c = cos(a), s = sin(a);
        vec2 q = vec2((d.x * c - d.y * s) / e.z, (d.x * s + d.y * c) / e.w);
        float ang = atan(q.y, q.x);
        return length(q) / (1.0 + w1 * sin(ang * 3.0 + e.x) + w2 * sin(ang * 5.0 + e.y * ph2));
      }