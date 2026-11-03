// horizon shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
      in vec3 aWall; in vec3 aRoof; out vec3 vHC; out vec3 vHP; out float vTop; out float vLit;
// @section vertexFogVertex
#include <fog_vertex>
      vTop = normal.y > 0.5 ? 1.0 : 0.0; vHC = vTop > 0.5 ? aRoof : aWall;
      vHP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      { vec3 io = instanceMatrix[3].xyz; float lh = fract(sin(dot(io.xz, vec2(12.9898, 78.233))) * 43758.5453); // (night) per-building lit share
        vLit = lh < 0.35 ? 0.0 : (lh < 0.93 ? (lh - 0.35) * 0.35 : 0.6 + (lh - 0.93) * 4.0); }
// @section fragmentCommon
#include <common>
      in vec3 vHC; in vec3 vHP; in float vTop; in float vLit; uniform float uNightK;
// @section fragmentEmissive
#include <emissivemap_fragment>
      if (uNightK > 0.0 && vTop < 0.5) totalEmissiveRadiance += vec3(1.0, 0.7, 0.42) * vLit * 0.06 * smoothstep(3.0, 9.0, vHP.y) * uNightK;
// @section fragmentMap
{
        vec3 c = vHC;
        if (vTop < 0.5) {
          // floor bands + bays, averaged out once they get sub-pixel
          float fl = fract(vHP.y / 3.4), u = fract((vHP.x + vHP.z) / 2.6);
          float w = step(0.35, fl) * step(fl, 0.85) * step(0.3, u) * step(u, 0.75);
          vec2 fw = fwidth(vec2(vHP.y / 3.4, (vHP.x + vHP.z) / 2.6));
          w = mix(w, 0.3, clamp(max(fw.x, fw.y) * 1.5, 0.0, 1.0));
          c = mix(c, vec3(0.08, 0.09, 0.1), w * 0.85);
          c *= 0.65 + 0.35 * smoothstep(0.0, 12.0, vHP.y); // grimy base / contact darkening
        }
        diffuseColor.rgb = c * (1.0 - 0.85 * uNightK); // (night) dark masses
      }
