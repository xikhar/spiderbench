{
        float u = vCW.z * 0.97 + vCW.x * 0.24, y = vCW.y;
        float cu = u / (3.5 + 2.0 * vn(u * 0.05)), cid = floor(cu), cf = fract(cu);
        float joint = 1.0 - smoothstep(0.0, 0.12, min(cf, 1.0 - cf));
        vec3 c = mix(vec3(0.15, 0.14, 0.13), vec3(0.23, 0.2, 0.17), ch(cid)) * (0.85 + 0.3 * vn(y * 0.3 + cid));
        c = mix(c, vec3(0.36, 0.25, 0.18), smoothstep(0.55, 0.9, vn(u * 0.013 + y * 0.02)) * 0.5);   // iron staining
        c *= 1.0 - 0.55 * joint;
        float ledge = smoothstep(0.82, 0.97, fract(y / (9.0 + 3.0 * vn(u * 0.02))));
        vec3 moss = mix(vec3(0.12, 0.15, 0.07), vec3(0.2, 0.19, 0.09), vn(u * 0.2));
        float veg = max(ledge * 0.7, smoothstep(__SHADER_INJECT_0__, __SHADER_INJECT_1__, y + 6.0 * vn(u * 0.07))) * step(0.35, vn(u * 0.11 + y * 0.05));
        c = mix(c, moss, veg * 0.85);
        // wooded talus slope over the lower third (scrub and trees climbing the scree), ragged upper edge
        float talus = 1.0 - smoothstep(0.0, 4.0, y - (__SHADER_INJECT_2__ + 12.0 * vn(u * 0.031) + 5.0 * vn(u * 0.17)));
        vec3 wood = mix(vec3(0.07, 0.085, 0.045), vec3(0.14, 0.12, 0.06), vn(u * 0.4 + y * 0.3)) * (0.7 + 0.5 * vn(u * 1.3 + y * 0.9));
        c = mix(c, wood, talus);
        diffuseColor.rgb = c;
      }