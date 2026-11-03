#include <clipping_planes_fragment>
      {
        float h = vPitCam.y;
        if (h < 0.04) discard;
        float den = max(h - vPitL.y, 1e-3);
        float tA = (h - 0.035) / den, tB = (h - 0.006) / den;
        vec3 Q = vPitCam + (vPitL - vPitCam) * tB;
        if (abs(Q.x) > 2.27 || abs(Q.z) > 0.83) discard;
        float k = clamp(-vPitL.y / 4.0, 0.0, 1.0);
        vec3 Pv = -vViewPosition;
        vec4 cq = projectionMatrix * vec4(Pv * mix(tA, tB, k), 1.0);
        vec4 cp = projectionMatrix * vec4(Pv, 1.0);
        float nz = cq.z / cq.w, pz = cp.z / cp.w;
        bool zeroOne = abs(gl_FragCoord.z - pz) < abs(gl_FragCoord.z - (0.5 * pz + 0.5));
        gl_FragDepth = zeroOne ? nz : 0.5 * nz + 0.5;
      }