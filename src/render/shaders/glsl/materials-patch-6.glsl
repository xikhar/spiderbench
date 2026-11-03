#include <project_vertex>
{ vec4 ip = vec4(transformed, 1.0); vec3 inr = objectNormal;
#ifdef USE_INSTANCING
  ip = instanceMatrix * ip; inr = mat3(instanceMatrix) * inr;
#endif
  vIWPos = (modelMatrix * ip).xyz; vIWNrm = normalize(mat3(modelMatrix) * inr); }