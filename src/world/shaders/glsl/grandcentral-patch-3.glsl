#include <common>
      uniform sampler2D tGN; in float vGP; in vec3 vGW; in vec3 vGN;
      uniform highp sampler2DArray tGWC; uniform highp sampler2DArray tGWH; // (textures r5)
      float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float gV = 0.0;   // (street r8) verdigris amount (bronze part 8)
      float gH = 0.0;   // (street r2) carved height (m, <= 0 in joints) -> bump-mapped normal
      vec3 gcPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
        vec3 vSigmaX = normalize(dFdx(surf_pos)), vSigmaY = normalize(dFdy(surf_pos)), vN = surf_norm;
        vec3 R1 = cross(vSigmaY, vN), R2 = cross(vN, vSigmaX);
        float fDet = dot(vSigmaX, R1) * faceDir;
        vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
        return normalize(abs(fDet) * surf_norm - vGrad);
      }