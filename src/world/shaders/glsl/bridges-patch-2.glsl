#include <fog_vertex>
vWPs = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNs = normalize(mat3(modelMatrix) * objectNormal);