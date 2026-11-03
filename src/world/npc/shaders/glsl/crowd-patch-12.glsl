vec3 transformed = dogPose(position);
        { int R = int(aRA.x + 0.5); vec3 fur = unpackD(iD.z); vec3 c = fur;
          if (R == 7) c = vec3(0.012); else if (R == 6) c = vec3(0.3, 0.03, 0.03); else if (R == 8) c = mix(fur, vec3(0.6, 0.55, 0.48), 0.5);
          vDCol = c * (0.35 + 0.65 * aRA.y / 255.0); vDP = position; }