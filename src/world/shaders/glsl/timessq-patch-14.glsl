{
      vec4 n1 = texture(map, vMapUv), n2 = texture(map, vMapUv * 4.3 + 0.37), n3 = texture(map, vMapUv * 17.0 + 0.71);
      float pale = smoothstep(0.72, 0.9, n1.g) * smoothstep(0.45, 0.75, n2.b);
      diffuseColor = vec4(mix(diffuse * (0.75 + 0.4 * n3.b), vec3(0.62, 0.61, 0.58), pale), clamp((0.26 + 0.34 * smoothstep(0.2, 0.8, n1.r)) * (0.65 + 0.7 * n2.g) + 0.25 * pale, 0.0, 0.68));
      vec2 wq = vMapUv * __SHADER_INJECT_0__.0;
      // (r11) worn crosswalk paint (critic r9: 'stripes too clean and uniformly white'): denser grime film + chipped
      // spots over the avenue crossings (z = street +- 7.4) and the side-street crossings (|x| = 13.4)
      { float zz = mod(wq.y, __SHADER_INJECT_1__.0), ax = abs(wq.x);
        float cw = (1.0 - smoothstep(2.2, 3.0, abs(zz - __SHADER_INJECT_2__))) + (1.0 - smoothstep(2.2, 3.0, abs(zz - __SHADER_INJECT_3__)));
        cw *= 1.0 - smoothstep(__SHADER_INJECT_4__, __SHADER_INJECT_5__, ax);
        cw += (1.0 - smoothstep(__SHADER_INJECT_6__, __SHADER_INJECT_7__, min(zz, __SHADER_INJECT_8__.0 - zz))) * (1.0 - smoothstep(1.8, 2.6, abs(ax - __SHADER_INJECT_9__)));
        float chip = smoothstep(0.55, 0.72, n3.r) * (0.6 + 0.4 * n2.b);
        diffuseColor.a = __SHADER_INJECT_10__; }
      diffuseColor.a *= smoothstep(__SHADER_INJECT_11__.0, __SHADER_INJECT_12__.0, abs(wq.x)) * smoothstep(-326.0, -306.0, wq.y) * smoothstep(6.0, -8.0, wq.y); }