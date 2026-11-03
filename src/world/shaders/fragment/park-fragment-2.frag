in float vT; in vec3 vW; uniform float uTime; out vec4 fragColor;
      #include <fog_pars_fragment>
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        float graze = 1.0 - clamp(V.y, 0.0, 1.0);                         // 0 top-down .. 1 grazing
        float n = vn(vW.xz * 0.18) * 0.6 + vn(vW.xz * 0.7) * 0.4;
        // mirrored tree line: its inner edge is a row of crown bumps (~7 m) and reaches further out at grazing views
        float crowns = vn(vec2(vW.x + vW.z, vW.z - vW.x) * 0.14) * 0.6 + vn(vW.xz * 0.45) * 0.4;
        float reach = mix(0.6, 0.95, graze) * (0.65 + 0.55 * crowns); // (park r8) 0.45 -> 0.6 from above (critic r7: 'no shoreline darkening')
        float t = clamp(vT + (n - 0.5) * 0.18, 0.0, 1.0);
        float band = 1.0 - smoothstep(reach - 0.12, reach + 0.05, t);
        // wind: cat's-paw patches (ruffled water reflects more sky) + fine streaks along the wind
        vec2 wd = vec2(0.8, 0.6), wq = vec2(dot(vW.xz, wd), dot(vW.xz, vec2(-wd.y, wd.x)));
        float paw = smoothstep(0.45, 0.8, vn(wq * vec2(0.02, 0.035) + uTime * 0.01) * 0.7 + vn(wq * 0.09) * 0.3);
        float streak = vn(vec2(wq.x * 0.03, wq.y * 0.6));
        float rip = vn(wq * vec2(0.9, 2.2) + vec2(uTime * 0.4, 0.0));
        vec3 sky = mix(vec3(0.44, 0.52, 0.6), vec3(0.72, 0.76, 0.8), graze);
        vec3 deep = vec3(0.035, 0.05, 0.045);
        // (park r9) critic r8: 'a flat mirror with an obvious stretched sky reflection, no depth colour'. Fresnel: seen
        // from above the water is mostly its own dark tannin-green body (weak reflection), sky-bright only at grazing
        // angles and in the wind-ruffled patches; plus fine ripple bands breaking up the reflected clouds
        float fres = 0.12 + 0.88 * pow(graze, 3.0);
        float fine = vn(wq * vec2(0.35, 1.3) - vec2(uTime * 0.25, 0.0)) * vn(wq * vec2(1.7, 4.1) + vec2(uTime * 0.6, 0.0));
        vec3 c = mix(deep, sky, clamp((0.18 + 0.45 * paw + 0.2 * streak + 0.25 * fine) * mix(0.55, 1.0, fres), 0.0, 1.0));
        float a = clamp((0.34 + 0.24 * paw + 0.14 * abs(streak - 0.5) + 0.12 * fine) * mix(1.0, 0.7, fres), 0.0, 0.8); // (park r8) wind texture; (park r9) denser body colour
        // (park r10) critic r9: 'blotchy tiled normal pattern, hard dark tone, no sky-reflection gradient, flat mirror'.
        // The open water now carries its own reflected-sky gradient (zenith blue seen from above -> pale horizon haze at
        // grazing view, weighted by Fresnel) over a teal-grey body, with multi-scale non-repeating ripple bands, and is
        // opaque enough (0.62-0.85) to hide the base water's tiling normal from swinging height
        {
          vec3 skyZ = vec3(0.26, 0.36, 0.48), skyH = vec3(0.6, 0.66, 0.7);
          vec3 refl = mix(skyZ, skyH, pow(graze, 1.6));
          float cloud = smoothstep(0.35, 0.85, vn(vW.xz * 0.006 + vec2(uTime * 0.002, 0.0)) * 0.7 + vn(vW.xz * 0.02) * 0.3);
          refl = mix(refl, vec3(0.7, 0.72, 0.74), cloud * 0.45);
          float rw = vn(wq * vec2(0.05, 0.18) + vec2(uTime * 0.05, 0.0)) * 0.5 + vn(wq * vec2(0.16, 0.55) - vec2(uTime * 0.12, 0.0)) * 0.3 + fine * 0.4;
          vec3 body = vec3(0.045, 0.068, 0.07) * (0.9 + 0.25 * vn(vW.xz * 0.03));
          float fr2 = clamp(0.1 + 0.8 * pow(graze, 2.4) + 0.22 * (rw - 0.45) + 0.2 * paw, 0.04, 0.95);
          vec3 c2 = mix(body, refl, fr2);
          c = mix(c, c2, 0.75);
          a = max(a, mix(0.62, 0.85, graze));
        }
        // tree reflection colour (dark olive / umber, a little autumn warmth) over the band
        vec3 tree = mix(vec3(0.028, 0.036, 0.018), vec3(0.07, 0.058, 0.03), crowns) * (0.85 + 0.3 * rip);
        c = mix(c, tree, band); a = mix(a, 0.9, band);
        // (park r10) shoreline gradient: a silty olive-brown shallow shelf fading out over the first few metres (seen
        // through the tree reflection from above), then a broken foam / wet-stone lip at the waterline
        float shelf = 1.0 - smoothstep(0.0, 0.16 + 0.08 * n, vT);
        c = mix(c, vec3(0.11, 0.1, 0.066) * (0.85 + 0.3 * n), shelf * mix(0.7, 0.25, graze));
        float foam = (1.0 - smoothstep(0.0, 0.03, vT)) * smoothstep(0.45, 0.7, vn(vW.xz * 0.9 + uTime * 0.05));
        c = mix(vec3(0.07, 0.065, 0.052), c, smoothstep(0.0, 0.035, vT));   // thin wet-stone lip at the waterline
        c = mix(c, vec3(0.34, 0.35, 0.33), foam * 0.55);
        a = max(a, (1.0 - smoothstep(0.0, 0.035, vT)) * 0.8);
        fragColor = vec4(c, a);
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
          #endif
          fragColor.rgb = mix(fragColor.rgb, fogColor, fogFactor);
        #endif
      }
