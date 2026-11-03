
        vec3 bkUv = vec3(vBUv, floor(vBark.x + 0.5));
        vec4 bkC = texture(tBarkC, bkUv);
        diffuseColor.rgb *= bkC.rgb * vBark.yzw;