in float aT; out float vT; out vec3 vW;
      #include <fog_pars_vertex>
      void main() { vT = aT; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }
