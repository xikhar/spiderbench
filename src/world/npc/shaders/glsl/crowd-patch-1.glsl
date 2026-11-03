#include <common>
      __SHADER_INJECT_0__
      in vec4 iC; in vec2 aUV;
      out vec2 vBUv; out vec3 vB0; out vec3 vB1; out vec3 vB2; out float vOptF;   // (peds r2) baked cloth normal / AO
      vec3 unpackC(float f) { float r = floor(f / 65536.0); float g = floor((f - r * 65536.0) / 256.0); float b = f - r * 65536.0 - g * 256.0; vec3 c = vec3(r, g, b) / 255.0; return c * c; }
      out vec3 vCol; out float vRough; out float vEmis;
      out vec3 vRest; out float vReg; out float vAOm; out vec3 vShirt; out float vCode;
      uniform vec3 uFaceSkin[32]; out vec4 vPed; out vec3 vRestN; out vec3 vHairC;   // (peds r1) face, tone, hair tile, view dist
      vec3 faceSkin() { return uFaceSkin[int(clamp(iM.x, 0.0, 31.99))] * mix(0.7, 1.08, fract(iM.x)); }
      vec3 skinTone(float k) {
        vec3 a = vec3(0.64, 0.44, 0.33), b = vec3(0.42, 0.26, 0.16), c = vec3(0.16, 0.09, 0.055);
        return k < 0.5 ? mix(a, b, k * 2.0) : mix(b, c, k * 2.0 - 1.0);
      }
      vec3 hairTone(float k) {
        vec3 a = vec3(0.015, 0.011, 0.008), b = vec3(0.12, 0.065, 0.03), c = vec3(0.45, 0.32, 0.16);
        return k < 0.7 ? mix(a, b, k / 0.7) : (k < 0.93 ? mix(b, c, (k - 0.7) / 0.23) : vec3(0.45, 0.44, 0.42));
      }