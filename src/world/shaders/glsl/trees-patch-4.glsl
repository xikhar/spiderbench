
        bool core = vLeaf.x >= 1.5;
        vec2 luv = core ? fract(vMapUv) : vMapUv;
        vec2 gx = dFdx(vMapUv), gy = dFdy(vMapUv);
        vec4 tx = textureGrad(map, luv, gx, gy);
        float expo = core ? (vLeaf.x - 2.0) : vLeaf.x;
        if (core) { // solid inner mass: leaf texture where it has coverage, otherwise deep shade
          vec4 t2 = textureGrad(map, fract(vMapUv * 0.7 + 0.31), gx * 0.7, gy * 0.7);
          float cov = max(tx.a, t2.a);
          tx = tx.a > 0.5 ? tx : t2;
          tx.r = tx.g > 0.96 ? 0.55 : (tx.a > 0.5 ? tx.r * 0.85 : 0.45); tx.b = 0.0; tx.g = min(tx.g, 0.94);
          // grazing core surface (its silhouette) takes the leaf coverage, so the solid mass never shows a faceted edge
          float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
          tx.a = facing > 0.45 ? 1.0 : cov;
        }
        if (!core) { // cards seen edge-on smear the texture: dissolve them (the neighbouring cards fill in)
          vec3 fn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
          tx.a *= smoothstep(0.12, 0.4, abs(dot(fn, normalize(vViewPosition))));
        }
        diffuseColor.a *= tx.a;
        float twig = step(0.97, tx.g);
        float hsel = tx.g * 0.8 + vLeaf.y * 0.55 - 0.18;
        vec3 leaf = mix(vTA, vTB, smoothstep(0.15, 0.85, hsel));
        // a scatter of dry brown / still-green-ish leaves
        float odd = fract(tx.g * 13.7 + vLeaf.y * 5.3);
        leaf = odd > 0.93 ? vec3(0.13, 0.06, 0.025) : (odd < 0.035 ? vec3(0.16, 0.14, 0.035) : leaf);
        leaf *= 0.42 + 0.72 * tx.r;
        // self-occlusion: deep / underside leaves and the back of each spray fall into shade
        float occ = mix(0.4, 1.0, pow(clamp(expo, 0.0, 1.0), 1.4)) * mix(0.62, 1.0, tx.b);
        if (core) occ = mix(0.24, 0.42, clamp(expo, 0.0, 1.0));
        vec3 c = twig > 0.5 ? vec3(0.085, 0.06, 0.042) : leaf;
        diffuseColor.rgb *= c * occ;
        float leafExpo = core ? 0.0 : clamp(expo, 0.0, 1.0);
      