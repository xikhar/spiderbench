vec3 objectNormal = normalize(vec3(0.0, 0.8, 0.0) + normalize(cameraPosition - aPuff.xyz));
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3(1.0, 0.0, 0.0);
      #endif