in float vR; in float vK; in float vS; out vec4 fragColor;
      void main() {
        float a = vK < 0.5 ? (1.0 - smoothstep(0.15, 1.0, vR)) * 0.32 : (1.0 - smoothstep(0.45, 1.0, vR)) * 0.5 * vS;
        fragColor = vec4(vec3(1.0 - a), 1.0);
      }
