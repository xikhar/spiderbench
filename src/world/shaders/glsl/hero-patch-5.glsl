#include <lights_fragment_maps>
        if (uReflOn > 0.5) { vec2 ruv = vRefl.xy / vRefl.w; vec2 o1 = uTexel * vec2(0.75, 0.35), o2 = uTexel * vec2(-0.35, 0.75); vec4 pr = 0.25 * (texture(tRefl, ruv + o1, 0.6) + texture(tRefl, ruv - o1, 0.6) + texture(tRefl, ruv + o2, 0.6) + texture(tRefl, ruv - o2, 0.6)); vec2 e = smoothstep(0.0, 0.04, ruv) * smoothstep(1.0, 0.96, ruv);
          // the mirror render carries no aerial perspective: pull it toward the sky/env radiance (haze), and keep a
          // share of the sky reflection even over the reflected geometry (coated glass reads sky-bright, as in ref 2)
          vec3 mirrored = mix(pr.rgb, radiance, 0.25);
          radiance = mix(radiance, mirrored, 0.75 * clamp(pr.a, 0.0, 1.0) * e.x * e.y * step(0.0, vRefl.w)); }