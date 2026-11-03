
      in vec4 iP; in vec4 iS; in vec4 iA;
      uniform sampler2D uAnim; uniform float uTime; uniform vec3 uHip; uniform vec3 uFL; uniform vec3 uFR;
      out vec2 vQ; out float vA; out float vP;
      mat4 bmRow(int row, int b) {
        ivec2 c = ivec2(b * 3, row);
        vec4 r0 = texelFetch(uAnim, c, 0), r1 = texelFetch(uAnim, c + ivec2(1, 0), 0), r2 = texelFetch(uAnim, c + ivec2(2, 0), 0);
        return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
      }
      void main() {
        int part = int(position.z + 0.5);
        float fr = mod((uTime - iA.w) * iA.z * 30.0, iA.y); if (fr < 0.0) fr += iA.y;
        int f0 = int(floor(fr)); int f1 = f0 + 1; if (float(f1) >= iA.y) f1 = 0; float t = fract(fr);
        int b = part == 0 ? 0 : part == 1 ? 13 : 16; vec3 j = part == 0 ? uHip : part == 1 ? uFL : uFR; int r = int(iA.x + 0.5);
        vec3 wp = ((bmRow(r + f0, b) * (1.0 - t) + bmRow(r + f1, b) * t) * vec4(j, 1.0)).xyz;
        float h = part == 0 ? 0.0 : max(0.0, wp.y - uFL.y);
        vec2 rad = part == 0 ? vec2(0.36, 0.32) : vec2(0.085, 0.17) * (1.0 + h * 2.5); // (peds r4) 0.3/0.27, 0.075/0.15
        vec2 lp = (part == 0 ? wp.xz * 0.5 : wp.xz + vec2(0.0, 0.045)) + position.xy * rad;
        float c = cos(iP.w), s = sin(iP.w);
        vec2 xz = vec2(c * lp.x * iS.y + s * lp.y, -s * lp.x * iS.y + c * lp.y) * iS.x;
        vQ = position.xy;
        // (peds r4) critic r3 still saw 'floating' peds under the darker grade: stronger, tighter contact (feet 0.9 with a
        // hard core, hip 0.62 wide soft halo) -- was 0.48 / 0.62 (contactAO, lighting2 r3)
        vA = (part == 0 ? 0.72 : 0.95 * (1.0 - smoothstep(0.03, 0.18, h))) * iS.z; vP = float(part);
        gl_Position = projectionMatrix * viewMatrix * vec4(iP.x + xz.x, iP.y + 0.015, iP.z + xz.y, 1.0);
      }
