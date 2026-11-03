
        float ph = fract(uTime * 0.11 + aPuff.w);
        float lowV = aPuff.y < -1.0 ? 1.0 : 0.0;                  // (street r7) manhole wisp (vent y = -2.5): thinner, lower
        float h = 5.5 * (1.0 - (1.0 - ph) * (1.0 - ph)) * (1.0 - 0.35 * lowV); // decelerating rise (~5.5 m)
        float rad = mix(0.5, 3.0, sqrt(ph)) * (1.0 - 0.45 * lowV);
        vec2 wind = vec2(0.8, 0.35) * (ph * ph * 3.2);
        vec3 c = aPuff.xyz + vec3(wind.x + sin(aPuff.w * 40.0 + uTime * 0.6) * 0.35 * ph, 2.55 + h, wind.y + sin(aPuff.w * 23.0 + uTime * 0.4) * 0.5 * ph);
        vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float rot = aPuff.w * 17.0 + uTime * 0.12;
        vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;
        vec3 transformed = c + (camR * q.x * 1.25 + camU * q.y) * rad;
        float dCam = length(cameraPosition - c);
        vFade = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.25, 1.0, ph)) * (1.0 - smoothstep(160.0, 320.0, dCam))
          * smoothstep(0.6, 2.5, dCam);                              // fade out when the lens is inside a puff
        vAge = ph;
        vPuv = uv * 0.45 + fract(vec2(aPuff.w * 3.1, aPuff.w * 7.7) + vec2(uTime * 0.01, -uTime * 0.03));