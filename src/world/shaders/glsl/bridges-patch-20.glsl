#include <common>
      uniform sampler2D tDC; uniform sampler2D tSN; in vec3 vWPd; in vec3 vWNd; in vec2 vUD; in vec3 vEx;
      float bandL(float l, float c, float w, float fw) { return 1.0 - smoothstep(w * 0.5 - fw, w * 0.5 + fw, abs(l - c)); }