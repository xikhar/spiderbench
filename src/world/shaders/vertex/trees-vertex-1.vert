in float aKind; in vec4 aTree; uniform vec3 uSun; uniform float uY;
      out float vR; out float vK; out float vS;
      void main() {
        vK = aKind; vR = length(position.xz);
        vec3 p;
        float dCam = length(aTree.xy - cameraPosition.xz);
        if (aKind < 0.5) { p = vec3(aTree.x + position.x * aTree.z * 1.15, uY, aTree.y + position.z * aTree.z * 1.15); vS = 1.0; }
        else {
          float el = max(asin(clamp(uSun.y, 0.0, 1.0)), 0.2);
          vec2 d = -normalize(uSun.xz + vec2(1e-4));
          vec2 c = aTree.xy + d * aTree.w / tan(el) * 0.92;
          float st = min(1.0 / sin(el), 2.4);
          vec2 u = position.x * d * st + position.z * vec2(-d.y, d.x);
          p = vec3(c.x + u.x * aTree.z * 0.95, uY + 0.004, c.y + u.y * aTree.z * 0.95);
          vS = smoothstep(145.0, 180.0, dCam) * smoothstep(0.02, 0.12, uSun.y);   // near trees cast real CSM shadows
        }
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
