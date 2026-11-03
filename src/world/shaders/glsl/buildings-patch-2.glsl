#include <fog_vertex>
vPart = aPart; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vUv2 = uv;