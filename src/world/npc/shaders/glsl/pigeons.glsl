// pigeons shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
      in float aTag; in vec4 iF; in vec3 iT; uniform float uTime;
// @section vertexBeginVertex
vec3 transformed = position;
      {
        int T = int(aTag + 0.5);
        if (T >= 2) {
          float s = T == 2 ? 1.0 : -1.0;
          float fold = iF.w;
          // folded: wing tucked along the body; open: flapping about the body axis
          float a = s * (iF.x * sin(uTime * 17.0 + iF.y * 6.28) + 0.15 * iF.x);
          vec2 p = vec2(transformed.x - s * 0.03, transformed.y - 0.15);
          p.x *= mix(1.0, 0.18, fold);
          transformed.z = mix(transformed.z, transformed.z - abs(p.x) * 1.2 - 0.02, fold);
          float c = cos(a), sn = sin(a);
          transformed.xy = vec2(s * 0.03, 0.15) + vec2(c * p.x - sn * p.y, sn * p.x + c * p.y);
        } else if (T == 1) {
          float pk = iF.z * max(0.0, sin(uTime * 7.0 + iF.y * 40.0));
          vec2 q = transformed.zy - vec2(0.08, 0.14);
          float c = cos(pk * 1.1), sn = sin(pk * 1.1);
          transformed.zy = vec2(0.08, 0.14) + vec2(c * q.x + sn * q.y, -sn * q.x + c * q.y);
          transformed.z += 0.012 * sin(uTime * 9.0 + iF.y * 20.0) * (1.0 - iF.z) * (1.0 - step(0.01, iF.x));
        }
      }
// @section vertexColorVertex
#include <color_vertex>
 vColor.rgb *= iT;
