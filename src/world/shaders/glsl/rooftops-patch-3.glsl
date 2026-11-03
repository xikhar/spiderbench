#include <common>
      uniform highp sampler2DArray tRoofC; uniform highp sampler2DArray tRoofN; uniform sampler2D tNoiseR;
      in vec2 vRUv; flat in vec4 vM; flat in vec4 vE; in vec3 vRWP; in vec3 vRWN;
      float rR; float rM; vec3 rN;
      const float ROUGH[__SHADER_INJECT_0__] = float[__SHADER_INJECT_1__](__SHADER_INJECT_2__);
      const float PONDS[__SHADER_INJECT_3__] = float[__SHADER_INJECT_4__](__SHADER_INJECT_5__);
      const float SEAM[__SHADER_INJECT_6__] = float[__SHADER_INJECT_7__](__SHADER_INJECT_8__);
      const float TARP[__SHADER_INJECT_9__] = float[__SHADER_INJECT_10__](__SHADER_INJECT_11__);
      float rHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }