#include <aomap_fragment>
        {                                                             // (vehicles r2) baked AO occludes sky light + reflections
          float vAOk = clamp(vAOe * 1.08, 0.0, 1.0);
          reflectedLight.indirectDiffuse *= vAOk;
          reflectedLight.indirectSpecular *= vAOk * vAOk;
          if (P == 3) reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(0.7)); // (vehicles r4) no blown sun glint on (rear) glass
          #if defined( USE_CLEARCOAT )
          clearcoatSpecularIndirect *= vAOk * vAOk;
          #endif
        }