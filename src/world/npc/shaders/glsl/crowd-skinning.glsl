
    in vec4 aSI; in vec4 aSW; in vec3 aRA;   // aRA: region, vertex AO, (peds r2) option bit (16-attribute limit)
    in vec4 iA; in vec4 iB; in vec4 iX; in vec4 iM;
    // (peds r3) body type (critic: 'no body-type variety: heavy, short, slim'): girth g = 0.8 + floor(iM.z) / 100 reshapes
    // the rest pose before skinning, per bone group: torso wider / deeper (belly for g > 1), neck thicker, arms pushed
    // out with the shoulders + thicker, legs apart + thicker (fading to the ankles). Head, hair, hat and phone keep
    // their size, so heavy people don't get bobble heads (the old instance x-scale widened the head too)
    vec3 bodyShape(vec3 p) {
      float d = floor(iM.z) * 0.01 - 0.2;
      if (abs(d) < 0.004) return p;
      float wT = 0.0, wN = 0.0, wA = 0.0, wL = 0.0, wF = 0.0;
      for (int k = 0; k < 4; k++) {
        float w = aSW[k]; int b = int(aSI[k] + 0.5);
        if (b <= 2) wT += w; else if (b == 3) wN += w; else if (b >= 5 && b <= 10) wA += w;
        else if (b == 11 || b == 12 || b == 14 || b == 15) wL += w; else if (b == 13 || b == 16) wF += w;
      }
      float sx = p.x < 0.0 ? -1.0 : 1.0;
      float bz = p.z + 0.005, belly = exp(-pow((p.y - 1.04) / 0.13, 2.0)) * step(0.0, d);
      vec3 t = vec3(p.x * (1.0 + d), p.y, -0.005 + bz * (1.0 + d * (bz > 0.0 ? 1.0 + 1.4 * belly : 0.6)));
      vec3 n = vec3(p.x * (1.0 + 0.6 * d), p.y, p.z * (1.0 + 0.6 * d));
      vec3 a = vec3(sx * (0.2 + 0.16 * d) + (p.x - sx * 0.2) * (1.0 + 0.45 * d), p.y, p.z * (1.0 + 0.45 * d));
      float kl = smoothstep(0.12, 0.65, p.y);
      vec3 l = vec3(sx * (0.097 + 0.075 * d) + (p.x - sx * 0.097) * (1.0 + 0.85 * d * kl), p.y, p.z * (1.0 + 0.85 * d * kl));
      vec3 f = vec3(p.x + sx * 0.075 * d, p.y, p.z);
      return t * wT + n * wN + a * wA + l * wL + f * wF + p * max(0.0, 1.0 - wT - wN - wA - wL - wF);
    }
    // (peds r2) optional parts (hairstyles, hat, glasses, bag, scarf): bit aOpt of the instance mask (iX.w / 512)
    bool optHidden() { return aRA.z > 0.5 && mod(floor(floor(iX.w / 512.0) / aRA.z), 2.0) < 0.5; }
    uniform sampler2D uAnim; uniform float uTime; uniform vec3 uNeck; uniform vec3 uHead;
    mat4 bmRow(int row, int b) {
      ivec2 c = ivec2(b * 3, row);
      vec4 r0 = texelFetch(uAnim, c, 0), r1 = texelFetch(uAnim, c + ivec2(1, 0), 0), r2 = texelFetch(uAnim, c + ivec2(2, 0), 0);
      return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
    }
    mat4 clipBone(vec4 C, int b) {
      float len = C.y;
      float fr = mod((uTime - C.w) * C.z * 30.0, len);
      if (fr < 0.0) fr += len;
      int f0 = int(floor(fr)); int f1 = f0 + 1; if (float(f1) >= len) f1 = 0;
      float t = fract(fr);
      int r = int(C.x + 0.5);
      return bmRow(r + f0, b) * (1.0 - t) + bmRow(r + f1, b) * t;
    }
    mat4 lookRot(vec3 p, float yaw, float pitch) {
      float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
      mat4 Ry = mat4(cy, 0.0, -sy, 0.0, 0.0, 1.0, 0.0, 0.0, sy, 0.0, cy, 0.0, 0.0, 0.0, 0.0, 1.0);
      mat4 Rx = mat4(1.0, 0.0, 0.0, 0.0, 0.0, cp, sp, 0.0, 0.0, -sp, cp, 0.0, 0.0, 0.0, 0.0, 1.0);
      mat4 T = mat4(1.0); T[3] = vec4(p, 1.0);
      mat4 Ti = mat4(1.0); Ti[3] = vec4(-p, 1.0);
      return T * Ry * Rx * Ti;
    }
    mat4 boneM(int b, float w) {
      mat4 m = clipBone(iA, b);
      if (w < 0.999) m = clipBone(iB, b) * (1.0 - w) + m * w;
      if (b == 4) m = m * lookRot(uHead, iX.y * 0.6, iX.z * 0.7);
      else if (b == 3) m = m * lookRot(uNeck, iX.y * 0.4, iX.z * 0.3);
      return m;
    }
    mat4 skinMatrix() {
      float w = clamp((uTime - iX.x) / 0.3, 0.0, 1.0);
      mat4 m = boneM(int(aSI.x + 0.5), w) * aSW.x;
      if (aSW.y > 0.0) m += boneM(int(aSI.y + 0.5), w) * aSW.y;
      if (aSW.z > 0.0) m += boneM(int(aSI.z + 0.5), w) * aSW.z;
      if (aSW.w > 0.0) m += boneM(int(aSI.w + 0.5), w) * aSW.w;
      return m;
    }
