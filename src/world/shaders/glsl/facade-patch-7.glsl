
        {
          vec3 Nw = normalize(vWN);
          vec3 Tw = Nw.y > 0.5 ? vec3(1.0, 0.0, 0.0) : (Nw.y < -0.5 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), Nw)));
          vec3 Bw = Nw.y > 0.5 ? vec3(0.0, 0.0, -1.0) : (Nw.y < -0.5 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0));
          vec3 nw = normalize(Tw * FS.n.x + Bw * FS.n.y + Nw * FS.n.z);
          normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
        }