#include <lights_fragment_maps>
      #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV ) && defined( RE_IndirectSpecular )
      {
        float cg = clamp(gGlass, 0.0, 1.0);
        // (render r-refl) the player / web / near peds mirrored about this glass plane (render/glassmirror.js), laid over the
        // glass's own (procedural city) reflection below, before the sash dimming and the Fresnel / specular BRDF
        vec4 gmS = cg > 0.001 ? glassMirror(vWPos, normalize(vWN)) : vec4(0.0);
        if (cg > 0.001 && vWPos.y <= 2.0) radiance = mix(radiance, gmS.rgb, gmS.a);
        if (cg > 0.001 && vWPos.y > 2.0) {
          vec3 Rw = inverseTransformDirection(reflect(-geometryViewDir, normal), viewMatrix);
          float az = atan(Rw.z, Rw.x) * 7.0 + vS.y * 3.1;
          float bk = floor(az), fa = fract(az);
          float h1 = fh1(vec2(bk, 3.7)), h2 = fh1(vec2(bk, 9.1)), h3 = fh1(vec2(bk + 0.5, 1.3));
          // skyline elevation seen from this window: lower windows see taller neighbours
          float hsky = mix(0.03, 0.36, h1 * h1) * (1.0 + 0.8 * (1.0 - smoothstep(20.0, 260.0, vWPos.y))); // (skyline r4) more sky in mid-height glass
          hsky *= step(0.12, h3) * (0.85 + 0.3 * step(abs(fa - 0.5), 0.3 * h2)); // gaps + narrower upper shafts
          if (vX.z > 3.5 && vX.z < 4.5) hsky *= 0.35; // (skyline r3) the supertall low-iron glass stands above its neighbours: mostly sky
          float fwR = fwidth(Rw.y) + 0.004;
          float bldg = 1.0 - smoothstep(hsky - fwR, hsky + fwR, Rw.y);
          vec3 hz = textureCubeUV(envMap, envMapRotation * normalize(vec3(Rw.x, 0.06, Rw.z)), 0.7).rgb * envMapIntensity;
          float sunF = h2 > 0.55 ? 0.58 : 0.27;                          // sunlit vs shaded neighbour face
          float rows = 0.8 + 0.2 * step(0.5, fract(Rw.y * 180.0 / max(0.4, 1.0 + 60.0 * fwR)));
          vec3 cityC = hz * mix(vec3(0.95, 0.9, 0.82), vec3(0.75, 0.82, 0.95), h3) * sunF * rows;
          vec3 streetC = hz * vec3(0.16, 0.17, 0.19);
          // (skyline r7) critic: 'right-edge tower is a flat black checkerboard, no reflection'. A high window's steep
          // downward ray does not reach the street: it sees the roofscape / lower facades (mid grey, broken up into
          // sunlit roofs, shaded canyons and pale parapets) -> dark-but-structured glass instead of a black grid
          {
            vec2 rq = Rw.xz / max(-Rw.y, 0.2) * (0.6 + 0.5 * vS.y) * 9.0;
            float rb = fh1(floor(rq)), rb2 = fh1(floor(rq * 0.37) + 4.1);
            vec3 roofC = hz * mix(vec3(0.34, 0.36, 0.39), vec3(0.6, 0.6, 0.59), rb) * (0.75 + 0.35 * rb2); // (skyline r10) lighter: glass seen from above picks up the pale city
            streetC = mix(streetC, roofC, smoothstep(35.0, 160.0, vWPos.y));
          }
          // (skyline r6) critic: 'glass is a matte dark grid, no reflections'. A shallow downward ray (tower seen from above
          // or from far away) mirrors the hazy far city / horizon, not the street: bright, cool, with the neighbours'
          // lit / shaded faces; only steep rays reach the dark street floor
          vec3 farC = hz * mix(vec3(0.62, 0.66, 0.72), vec3(0.9, 0.92, 0.96), h2) * (0.9 + 0.1 * rows);
          float dn = smoothstep(0.0, -0.06, Rw.y);
          cityC = mix(cityC, farC, dn * (1.0 - smoothstep(-0.12, -0.4, Rw.y)));
          cityC = mix(cityC, streetC, smoothstep(-0.4, -0.85, Rw.y));
          cityC *= 1.0 - 0.85 * uNightK; // (night) the reflected neighbours / streets are dark masses at night (the horizon-glow tint turned far glass towers pale)
          cityC = mix(cityC, radiance, 0.24); // keep a hint of sky / haze in the reflected city (stylised, like the refs)
          radiance = mix(radiance, cityC, bldg * cg * (1.0 - 0.5 * smoothstep(0.35, 0.8, material.roughness)));
          radiance = mix(radiance, gmS.rgb, gmS.a); // (render r-refl)
          radiance *= (1.0 - 0.4 * cg * gSash) /* (textures r4) 0.72 -> 0.4 */ * mix(1.0, gSashV, cg * gSash); // (street r11) per-window reflectance // (street r10) old sash glass in a canyon: dim, dusty reflections (dark holes, not pale panes)
        }
      }
      #endif