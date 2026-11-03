#include <begin_vertex>
      vLeaf = aLeaf; vTA = aTintA; vTB = aTintB;
      #ifdef USE_INSTANCING
        vCW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        vCN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vCI = instanceMatrix[3].xyz;
      #else
        vCW = (modelMatrix * vec4(position, 1.0)).xyz; vCN = normal; vCI = vec3(0.0);
      #endif