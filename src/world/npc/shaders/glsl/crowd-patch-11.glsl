#include <common>
      __SHADER_INJECT_0__
      in vec2 aRA; out vec3 vDCol; out vec3 vDP;
      vec3 unpackD(float f) { float r = floor(f / 65536.0); float g = floor((f - r * 65536.0) / 256.0); float b = f - r * 65536.0 - g * 256.0; vec3 c = vec3(r, g, b) / 255.0; return c * c; }