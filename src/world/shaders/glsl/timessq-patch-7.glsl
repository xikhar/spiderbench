#include <project_vertex>
{ vec3 hwp = (modelMatrix * vec4(transformed, 1.0)).xyz; vHaloF = 1.0 - smoothstep(0.3, 0.65, -normalize(hwp - cameraPosition).y); }