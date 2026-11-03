#include <lights_fragment_end>
        { // thin-leaf translucency: sun shining through the outer leaves toward the camera, plus wrapped back-light
          vec3 V = normalize(vViewPosition);
          float thr = pow(clamp(dot(-V, leafSunDir), 0.0, 1.0), 4.0);
          float back = clamp(dot(-normal, leafSunDir), 0.0, 1.0);
          float k = leafExpo * leafExpo * (1.0 - twig);
          reflectedLight.directDiffuse += diffuseColor.rgb * leafSun * RECIPROCAL_PI * k * (thr * 2.2 + back * 0.6);
        }