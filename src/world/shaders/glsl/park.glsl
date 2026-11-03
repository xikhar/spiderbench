// park shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
out vec2 vGU; in float aGV; out float vGV;
// @section vertexUvVertex
#include <uv_vertex>
vGU = uv; vGV = aGV;
// @section fragmentCommon
#include <common>
      in vec2 vGU; in float vGV; float gH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// @section fragmentMap

        // (park r6) critic r5: 'solar-panel grid textures'. Pale frosted panes (ref 10) in a finer, thinner mullion grid
        // (park r8) per-skylight family + pitch (vGV): no two neighbouring skylights share a look
        vec2 pitch = vGV < 0.33 ? vec2(1.6, 1.1) : (vGV < 0.66 ? vec2(2.4, 1.5) : vec2(1.2, 2.2));
        vec2 gc = vGU / pitch, gf = fract(gc), gi = floor(gc);
        vec2 fw = fwidth(gc) * 1.2;
        vec2 bar = vec2(0.03, 0.045);
        float fr = 1.0 - (smoothstep(bar.x, bar.x + fw.x, gf.x) * smoothstep(bar.x, bar.x + fw.x, 1.0 - gf.x)
                        * smoothstep(bar.y, bar.y + fw.y, gf.y) * smoothstep(bar.y, bar.y + fw.y, 1.0 - gf.y));
        float h = gH(gi), h2 = gH(gi + 17.3);
        vec3 pane = mix(vec3(0.25, 0.29, 0.33), vec3(0.32, 0.35, 0.38), step(0.8, h)) /* (park r9) critic r8: 'bright blue-white skylights look pasted on' */ * (0.92 + 0.1 * h2); // (park r8) less pane-to-pane checker
        float fam = fract(vGV * 7.13);
        if (fam < 0.34) pane = mix(vec3(0.16, 0.2, 0.25), vec3(0.24, 0.28, 0.32), step(0.85, h)) * (0.9 + 0.2 * h2);   // dark reflective
        else if (fam < 0.58) pane = mix(vec3(0.36, 0.38, 0.37), vec3(0.44, 0.45, 0.42), step(0.75, h)) * (0.9 + 0.12 * h2); // milky, weathered
        pane *= 0.82 + 0.3 * smoothstep(0.0, 1.0, fract(vGU.x * 0.021 + vGV * 3.0)) ; // broad grime / reflection gradient across the skylight
        pane *= 1.0 - 0.18 * smoothstep(0.3, 1.0, fract(vGU.y * 0.07 + h * 0.3));   // dirt washes down the panes
        { // (park r10) critic r9: 'add dirt'. Blotchy soot / bird-lime / leaf-litter grime per pane cluster, darker in the
          // bottom corners where rain water pools against the bars
          float gd = gH(floor(vGU / 5.0) + vGV * 31.0), gd2 = gH(gi * 0.5 + 3.7);
          pane *= 1.0 - 0.28 * smoothstep(0.55, 0.95, gd * 0.6 + gd2 * 0.5);
          pane *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.22, gf.y)) * (0.5 + 0.5 * h2);
          pane = mix(pane, vec3(0.2, 0.18, 0.14), 0.18 * step(0.9, gd2));
        }
        diffuseColor.rgb = mix(pane, vec3(0.3, 0.31, 0.32), fr * 0.6);
        float gRough = mix(mix(0.36, 0.5, step(0.8, h)), 0.6, fr);
        if (fam < 0.34) gRough = mix(0.5, 0.6, fr); else if (fam < 0.58) gRough = mix(0.72, 0.8, fr);   // (park r8) dark = matte wired glass, milky = frosted
      
// @section fragmentRoughness
#include <roughnessmap_fragment>
roughnessFactor = gRough;
// @section fragmentEmissive
#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.018, 0.017, 0.015) * (1.0 - fr) * step(h2, 0.7);
// @section fragmentMapByCopingUv
#include <map_fragment>
        { float blk = fract(vCopUV.y / 1.8); float j = smoothstep(0.0, 0.04, blk) * smoothstep(1.0, 0.96, blk);
          float h = fract(sin(floor(vCopUV.y / 1.8) * 91.7) * 4375.5);
          diffuseColor.rgb *= (0.55 + 0.45 * j) * (0.85 + 0.25 * h) * mix(0.8, 1.0, smoothstep(0.0, 0.25, vCopUV.x)); }
// @section fragmentCommonByCopingUv
#include <common>
in vec2 vCopUV;
// @section vertexCommonByCopingUv
#include <common>
out vec2 vCopUV;
// @section vertexUvVertexByCopingUv
#include <uv_vertex>
vCopUV = uv;
// @section vertexCommonByFountainUv
#include <common>
out vec2 vFU;
// @section vertexUvVertexByFountainUv
#include <uv_vertex>
vFU = uv;
// @section fragmentCommonByFountainUv
#include <common>
in vec2 vFU;
// @section fragmentAlphaTest

        { vec2 q = vec2(vFU.x + vFU.y, vFU.x - vFU.y) / 0.06; vec2 f = abs(fract(q) - 0.5); float w = min(f.x, f.y);
          vec2 fw = fwidth(q); float cov = 1.0 - smoothstep(0.06, 0.06 + max(fw.x, fw.y), w);
          float far = smoothstep(0.15, 0.6, max(fw.x, fw.y));
          diffuseColor.a = mix(cov, 0.42, far);
          float rail = step(abs(vFU.y - 0.03), 0.03) + step(abs(vFU.y - floor(vFU.y / 5.0 + 0.5) * 5.0), 0.04);
          diffuseColor.a = max(diffuseColor.a, min(rail, 1.0)); if (diffuseColor.a < 0.02) discard; }
        #include <alphatest_fragment>
// @section vertexCommonByHexWorldPosition
#include <common>
out vec2 vHexW;
// @section vertexBeginVertex
#include <begin_vertex>
vHexW = (modelMatrix * vec4(position, 1.0)).xz;
// @section fragmentCommonByHexWorldPosition
#include <common>
      in vec2 vHexW;
      float hxH(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
// @section fragmentMapByHexWorldPosition
#include <map_fragment>
      { vec2 p = vHexW / 0.23; // hexagon cells (~0.4 m across)
        vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;
        vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        vec2 id = p - g;
        vec2 q = abs(g); float edge = 0.5 - max(dot(q, normalize(r)), q.x);
        float fw = fwidth(p.x) * 1.2;
        float mortar = 1.0 - smoothstep(0.02, 0.02 + fw, edge);
        float far = smoothstep(0.08, 0.35, fw);
        float tone = 0.86 + 0.2 * hxH(floor(id * 10.0 + 0.5));
        float gr = 0.9 + 0.1 * sin(vHexW.x * 0.37 + vHexW.y * 0.21) * sin(vHexW.y * 0.13);
        diffuseColor.rgb *= mix(tone * mix(1.0, 0.55, mortar), 0.9, far) * gr; }
// @section vertexCommonByWalkwayWorldPosition
#include <common>
out vec2 vDW;
// @section vertexBeginVertexByWalkwayWorldPosition
#include <begin_vertex>
vDW = (modelMatrix * vec4(position, 1.0)).xz;
// @section fragmentCommonByWalkwayWorldPosition
#include <common>
        in vec2 vDW;
        float dH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float dN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(dH(i), dH(i + vec2(1, 0)), f.x), mix(dH(i + vec2(0, 1)), dH(i + vec2(1, 1)), f.x), f.y); }
// @section fragmentMapByWalkwayWorldPosition
#include <map_fragment>
        { float n = dN(vDW * 0.35) * 0.6 + dN(vDW * 1.7) * 0.4;
          diffuseColor.rgb *= 0.82 + 0.3 * n;                                  // patched / sealed asphalt
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.2, 0.19), smoothstep(0.72, 0.8, dN(vDW * 0.12 + 3.0)) * 0.5); }
