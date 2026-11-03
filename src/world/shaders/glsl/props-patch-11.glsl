#include <project_vertex>
        { vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vec2 dd = ip.xz - cameraPosition.xz;
          if (dot(dd, dd) > 90000.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); } // beyond the blade frames' far cull (300 m)