vec3 transformed = (sk * vec4(bodyShape(position), 1.0)).xyz;   // (peds r3) body type
        {
          int R = int(aRA.x + 0.5); float aAO = aRA.y / 255.0;
          vec3 c = vec3(0.5); float rg = 0.85; float em = 0.0;
          if (R == 0) { c = faceSkin(); rg = 0.64; }   // (peds r4) 0.55 -> 0.64: critic 'plastic' skin
          else if (R == 1) c = unpackC(iC.x);
          else if (R == 2) { c = unpackC(iC.y); rg = c.b > c.r * 1.25 ? 0.93 : 0.82; }
          else if (R == 3) { float sh_ = fract(iM.z); c = mix(vec3(0.012), vec3(0.2, 0.12, 0.07), sh_); c = sh_ > 0.85 ? vec3(0.7) : c; rg = 0.5; }
          else if (R == 4) { c = hairTone(fract(iM.y)); rg = 0.46; }   // (peds r4) 0.55 -> 0.46: strand sheen
          else if (R == 5) { c = unpackC(iC.z); float oc_ = mod(mod(iX.w, 512.0), 8.0);   // (peds r3) material separation (critic: 'wool vs leather vs denim all same roughness')
            rg = oc_ > 2.5 && oc_ < 3.5 || oc_ > 4.5 ? 0.42 : oc_ > 1.5 && oc_ < 2.5 ? 0.93 : oc_ > 3.5 ? 0.72 : dot(c, vec3(0.33)) < 0.03 ? 0.4 : 0.82; }
          else if (R == 6) { c = unpackC(iC.w); rg = 0.5; }
          else if (R == 7) { c = vec3(0.012); rg = 0.5; }
          else if (R == 8) { c = vec3(0.72); rg = 0.6; }
          else if (R == 9) { c = vec3(0.05, 0.08, 0.12); rg = 0.15; float fl = iM.w > 0.0 ? step(fract(uTime * 0.37 + iM.w), 0.035) : 0.0; em = 0.6 + fl * 60.0; }
          else if (R == 10) { c = vec3(0.02); rg = 0.3; }
          else if (R == 11) { c = faceSkin() * vec3(0.8, 0.56, 0.54); rg = 0.45; }       // lips
          else if (R == 12) { c = vec3(0.62, 0.6, 0.57); rg = 0.2; }                         // eye whites
          else if (R >= 13) { c = hairTone(fract(iM.y)); rg = 0.46; }                        // (peds r5) hair locks / fuzz shell (alpha-cut)
          vAOm = 0.35 + 0.65 * aAO;
          vCol = c * vAOm; vRough = rg; vEmis = em;
          vRest = position; vReg = float(R);
          // (peds r1) undo the leg-proportion remap (city_npc.py LEG_K / LEG_Y): all painting constants are in the modelling frame
          vRest.y = position.y < __SHADER_INJECT_0__ ? position.y / __SHADER_INJECT_1__ : position.y + __SHADER_INJECT_2__; vShirt = unpackC(iC.x); vCode = mod(iX.w, 512.0);   // (citylife r1) garment detail inputs ((peds r2) mask above 512)
          vRestN = normal; vHairC = hairTone(fract(iM.y)) * vAOm;
          vec4 mvq = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
          vPed = vec4(floor(clamp(iM.x, 0.0, 31.99)), mix(0.7, 1.08, fract(iM.x)), floor(iM.y * 0.5), -mvq.z);
        }