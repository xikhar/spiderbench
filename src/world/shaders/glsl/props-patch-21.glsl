#include <project_vertex>
        vPitL = position;
        #ifdef USE_INSTANCING
        vPitCam = (inverse(modelMatrix * instanceMatrix) * vec4(cameraPosition, 1.0)).xyz;
        #else
        vPitCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
        #endif