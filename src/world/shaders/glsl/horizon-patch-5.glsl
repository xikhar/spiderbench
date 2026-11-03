{
        vec3 c = vHC;
        if (vTop < 0.5) {
          // floor bands + bays, averaged out once they get sub-pixel
          float fl = fract(vHP.y / 3.4), u = fract((vHP.x + vHP.z) / 2.6);
          float w = step(0.35, fl) * step(fl, 0.85) * step(0.3, u) * step(u, 0.75);
          vec2 fw = fwidth(vec2(vHP.y / 3.4, (vHP.x + vHP.z) / 2.6));
          w = mix(w, 0.3, clamp(max(fw.x, fw.y) * 1.5, 0.0, 1.0));
          c = mix(c, vec3(0.08, 0.09, 0.1), w * 0.85);
          c *= 0.65 + 0.35 * smoothstep(0.0, 12.0, vHP.y); // grimy base / contact darkening
        }
        diffuseColor.rgb = c * (1.0 - 0.85 * uNightK); // (night) dark masses
      }