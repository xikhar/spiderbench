#include <fog_vertex>
vWPd = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNd = normalize(mat3(modelMatrix) * objectNormal); vUD = uv; vEx = aEx;