#include <fog_vertex>
vGWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vGNp = normalize(mat3(modelMatrix) * objectNormal);