
    in vec4 aSI; in vec4 iD;
    vec3 dogPose(vec3 p) {
      int part = int(aSI.x + 0.5);
      float ph = iD.x, amp = iD.y;
      if (part == __SHADER_INJECT_0__ || part == __SHADER_INJECT_1__ || part == __SHADER_INJECT_2__ || part == __SHADER_INJECT_3__) {
        vec3 pv = part == __SHADER_INJECT_0__ ? vec3(__SHADER_INJECT_4__) : part == __SHADER_INJECT_1__ ? vec3(__SHADER_INJECT_5__)
          : part == __SHADER_INJECT_2__ ? vec3(__SHADER_INJECT_6__) : vec3(__SHADER_INJECT_7__);
        float o = (part == __SHADER_INJECT_0__ || part == __SHADER_INJECT_3__) ? 0.0 : 3.14159;
        float a = sin(ph + o) * 0.5 * amp;
        vec3 q = p - pv; float c = cos(a), s = sin(a);
        q = vec3(q.x, c * q.y - s * q.z, s * q.y + c * q.z);
        q.y += max(0.0, cos(ph + o)) * 0.03 * amp;          // lift the swinging paw
        return pv + q;
      }
      if (part == __SHADER_INJECT_8__) {
        vec3 pv = vec3(__SHADER_INJECT_9__); vec3 q = p - pv;
        float a = sin(iD.w * 9.0) * 0.45; float c = cos(a), s = sin(a);
        q = vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z);
        return pv + q;
      }
      p.y += sin(ph * 2.0) * 0.012 * amp;
      if (part == __SHADER_INJECT_10__) { vec3 pv = vec3(__SHADER_INJECT_11__); vec3 q = p - pv; float a = sin(iD.w * 0.7) * 0.25 * (1.0 - amp);
        float c = cos(a), s = sin(a); q = vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z); p = pv + q; }
      return p;
    }
