
        float gk = 1.0 - smoothstep(0.16, 0.5, vVehY);              // (vehicles) grime band on the lower panels ((vehicles r3) lower + lighter: sills / arches only)
        float vehCC = 0.0;
        if (P == 1 || P == 0) { diffuseColor.rgb *= mix(vec3(1.0), vec3(0.72, 0.68, 0.62), gk * 0.7); pR = mix(P == 1 ? 0.26 : 0.45, 0.65, gk * 0.7); vehCC = (P == 1 ? 1.0 : 0.7) * (1.0 - gk * 0.6); }
        else if (P == 15) vehCC = 0.8;
        else if (P == 3) vehCC = 0.0;                                  // (vehicles r3) one glossy layer on glass (two layers = blown double sun glint)
        else if (P == 7 || P == 8) vehCC = 0.9;
        float vAOe = (P == 2 || P == 5) ? mix(vVehAO, 1.0, 0.65) : vVehAO; // (vehicles r2) baked AO (wheels sit deep in the wells: softened)
        diffuseColor.rgb *= mix(1.0, vAOe, 0.55);                    // cavities / wheel wells / under-body
        roughnessFactor = pR;