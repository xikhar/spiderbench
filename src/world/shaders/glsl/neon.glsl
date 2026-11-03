// neon shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
      in vec4 aS; in vec3 iO; in vec3 iT; in vec3 iV; in vec4 iD; in vec4 iC;
      out vec4 vNeonC; out float vNeonDim; vec3 neonPos;
// @section vertexBeginNormalVertex

      int nSide = int(aS.x + 0.5);
      float nW = iD.x, nH = iD.y, nR = iD.z; int nMask = int(iD.w + 0.5);
      vec3 nT = iT, nV = iV, nN = normalize(cross(iT, iV));
      float nDist = length(iO + nT * nW * 0.5 + nV * nH * 0.5 - cameraPosition);
      float nRe = max(nR, nDist * 0.00062); // ~0.6 px at 1080p / 55 deg: no sub-pixel shimmer, energy kept below
      vNeonDim = nR / nRe;
      vNeonC = iC;
      vec2 p0 = nSide == 0 ? vec2(0.0) : nSide == 1 ? vec2(nW, 0.0) : nSide == 2 ? vec2(nW, nH) : vec2(0.0, nH);
      vec2 dr = nSide == 0 ? vec2(1.0, 0.0) : nSide == 1 ? vec2(0.0, 1.0) : nSide == 2 ? vec2(-1.0, 0.0) : vec2(0.0, -1.0);
      float nLen = (nSide == 0 || nSide == 2) ? nW : nH;
      float nS = mix(-nRe, nLen + nRe, aS.y);                            // run past the corners: closed joints / end caps
      vec3 nAx = nT * dr.x + nV * dr.y, nPerp = nT * abs(dr.y) + nV * abs(dr.x);
      float nFlat = iC.w >= 1.0 ? 0.35 : 1.0;                               // LED strips: a flat ribbon
      vec3 objectNormal = normalize(nPerp * aS.z + nN * aS.w);
      neonPos = iO + nT * p0.x + nV * p0.y + nAx * nS + (nPerp * aS.z * nFlat + nN * aS.w) * nRe;
      if (((nMask >> nSide) & 1) == 0 || nDist > 700.0) neonPos = iO;       // masked side / far: degenerate
      #ifdef USE_TANGENT
      vec3 objectTangent = vec3(tangent.xyz);
      #endif
// @section vertexBeginVertex
vec3 transformed = neonPos;
// @section fragmentCommon
#include <common>
      in vec4 vNeonC; in float vNeonDim; uniform float uNeonK, uNeonT, uNeonS; uniform vec4 uNeon;
// @section fragmentColor
#include <color_fragment>
      diffuseColor.rgb = mix(vec3(0.55), vNeonC.rgb, 0.35) * uNeon.z; // unlit glass tube (pale tint) by day
// @section fragmentEmissive
#include <emissivemap_fragment>
      if (uNeonK > 0.0) {
        float led = step(1.0, vNeonC.w), seed = fract(vNeonC.w);
        float face = abs(dot(normalize(normal), normalize(vViewPosition)));
        vec3 col = vNeonC.rgb;
        // bright saturated core, dimmer + deeper colour toward the tube's silhouette; LED ribbons flat and even
        vec3 e = col * mix(mix(0.4, 1.0, pow(face, 1.5)), 0.85, led);
        e = mix(e, vec3(max(max(col.r, col.g), col.b)), 0.18 * pow(face, 6.0) * (1.0 - led));
        float fl = 1.0;
        if (seed < 0.034 && led < 0.5) { // ~1 in 30 tubes buzz: brief dips, cheap hash of time
          float h = fract(sin(floor(uNeonT * 13.0 + seed * 977.0) * 12.9898) * 43758.5453);
          fl = h > 0.82 ? 0.25 + 0.5 * h * h : 1.0;
        }
        totalEmissiveRadiance += e * uNeon.x * mix(1.0, uNeon.y, led) * uNeonS * uNeonK * vNeonDim * fl;
      }
// @section vertexCommonByNeonUvScale
#include <common>
      in vec3 iO; in vec3 iT; in vec4 iD; in vec4 iC; out vec2 vNeonUv, vNeonQ; out vec4 vNeonC; out float vNeonDim;
// @section vertexBeginVertexByNeonDimmer

      vec3 nN = vec3(-iT.z, 0.0, iT.x);
      vec3 transformed = iO + iT * position.x * iD.x + vec3(0.0, 1.0, 0.0) * position.y * iD.y;
      float cell = iD.z, asp = iD.x / iD.y;
      // the cell holds the item centred at its own aspect (90 % x 78 % of 512 x 256): map the quad onto that box
      float ca = __SHADER_INJECT_0__;
      vec2 sz = asp > ca ? vec2(0.9, 0.9 / asp * 2.0) : vec2(0.78 * asp * 0.5, 0.78);
      if (cell > 23.5) sz = vec2(0.5, 1.0) / 1.12; // icons: drawn in the cell's centre square
      vec2 cuv = 0.5 + position.xy * min(sz * 1.12, vec2(0.995));
      vNeonUv = vec2((mod(cell, 4.0) + cuv.x) / 4.0, 1.0 - (floor(cell / 4.0) + 1.0 - cuv.y) / 8.0);
      vNeonC = iC; vNeonQ = position.xy + 0.5;
      float d = length(iO - cameraPosition);
      vNeonDim = 1.0 - smoothstep(420.0, 600.0, d);
      if (d > 600.0) transformed = iO;
// @section fragmentCommonByNeonColor
#include <common>
      in vec2 vNeonUv, vNeonQ; in vec4 vNeonC; in float vNeonDim; uniform float uNeonK, uNeonT, uNeonS; uniform sampler2D uNeonTex; uniform vec4 uNeonW;
// @section fragmentMap

      vec2 nt = max(texture(uNeonTex, vNeonUv).rg - 0.02, 0.0) / 0.98; // webp noise floor
      vec2 eq = min(vNeonQ, 1.0 - vNeonQ); nt.g *= smoothstep(0.0, 0.12, min(eq.x, eq.y * 2.0)); // halo fades out before the quad edge
      float seed = fract(vNeonC.w), fl = 1.0;
      if (seed < 0.034) { float h = fract(sin(floor(uNeonT * 11.0 + seed * 613.0) * 12.9898) * 43758.5453); fl = h > 0.8 ? 0.2 + 0.4 * h : 1.0; }
      vec3 col = vNeonC.rgb;
      vec3 e = col * nt.r + mix(col, vec3(max(max(col.r, col.g), col.b)), 0.25) * nt.r * nt.r * 0.2 + col * nt.g * uNeonW.y;
      diffuseColor.rgb = e * uNeonW.x * uNeonS * uNeonK * fl * vNeonDim;
