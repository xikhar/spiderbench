#include <fog_vertex>
      vRUv = uv; vM = aM; vE = aE; vRWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vRWN = normalize(mat3(modelMatrix) * objectNormal);