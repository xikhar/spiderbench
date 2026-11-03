bool oHid = optHidden();
        mat4 sk = oHid ? mat4(0.0) : skinMatrix();   // hidden option: collapse to a point (degenerate triangles)
        vec3 objectNormal = oHid ? vec3(0.0, 1.0, 0.0) : normalize(mat3(sk) * normal);
        { mat3 bnm = normalMatrix * mat3(instanceMatrix) * mat3(sk); vB0 = bnm[0]; vB1 = bnm[1]; vB2 = bnm[2]; vBUv = aUV; vOptF = aRA.z; }
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3(1.0, 0.0, 0.0);
        #endif