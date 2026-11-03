#include <common>
      uniform sampler2D tAtlas; uniform sampler2D tNoise; uniform sampler2D tPave; in float vTile; in vec2 vCuv; in vec3 vCwp; in float vCny;
      float cR;
      vec3 atlasTile(float t, vec2 q) {
        vec2 off = vec2(mod(t, 2.0) * 0.5, 0.5 - floor(t / 2.0) * 0.5);
        return textureGrad(tAtlas, off + 0.002 + fract(q) * 0.496, dFdx(q) * 0.496, dFdy(q) * 0.496).rgb;
      }
      vec3 coast() {
        float t = floor(vTile + 0.5);
        vec3 p = vCwp; cR = 0.9;
        vec3 nz = texture(tNoise, p.xz / 47.0 + p.y * 0.01).rgb;
        vec3 c;
        if (t < 3.5) {
          c = atlasTile(t, vCuv);
          c = pow(c, vec3(0.92)) * 1.05;
          // soot / rust streaks running down from the coping, broken by noise along the wall
          float sk = texture(tNoise, vec2(vCuv.x * 0.37 + p.x * 0.003, 0.2 + p.y * 0.006)).r;
          c *= 1.0 - 0.28 * smoothstep(0.55, 0.85, sk) * (1.0 - abs(vCny));
          c *= 0.86 + 0.28 * nz.g;
        } else if (t < 4.5) { c = vec3(1.0); cR = 0.55; }
        else if (t < 5.5) { // lawn: mown turf, darker clover patches, worn edges
          float n2 = texture(tNoise, p.xz / 9.0).g;
          c = mix(vec3(0.085, 0.115, 0.045), vec3(0.14, 0.15, 0.065), n2) * (0.85 + 0.3 * nz.r);
          c *= 0.94 + 0.06 * step(0.5, fract(p.x / 3.0 + p.z / 7.0));
          cR = 0.95;
        } else if (t < 6.5) { // promenade pavers (hex / running bond like the esplanade fill in ground.js)
          c = texture(tPave, p.xz / 6.0).rgb;
          vec2 hp = p.xz / vec2(0.9, 0.78);
          float row = floor(hp.y), cu = fract(hp.x + 0.5 * mod(row, 2.0)), cv = fract(hp.y);
          float jn = 1.0 - smoothstep(0.0, 0.07, min(min(cu, 1.0 - cu), min(cv, 1.0 - cv)));
          float fwp = clamp(fwidth(hp.x) * 2.0, 0.0, 1.0);
          c *= vec3(0.8, 0.77, 0.73) * (1.0 - 0.2 * jn * (1.0 - fwp)) * (0.9 + 0.2 * nz.r);
          cR = 0.86;
        } else if (t > 7.5) { // (r2) ribbed / slatted sheet metal: ribs along u (roofs, every 0.3 m) or v (roll-up doors, 0.12 m)
          float q = t < 8.5 ? vCuv.x / 0.3 : vCuv.y / 0.12, f = fract(q), aa = clamp(fwidth(q), 0.0, 1.0);
          float rib = mix(0.82 + 0.3 * smoothstep(0.35, 0.5, f) * (1.0 - smoothstep(0.5, 0.65, f)), 1.0, aa);
          c = vec3(rib) * (0.85 + 0.25 * nz.r) * (1.0 - 0.25 * smoothstep(0.6, 0.9, texture(tNoise, p.xz / 9.0 + p.y * 0.05).g)); cR = 0.6;
        } else { // picket card: vertical steel bars every 11.5 cm
          float f = fract(vCuv.x / 0.115), aa = fwidth(vCuv.x / 0.115);
          if (aa < 0.35 && abs(f - 0.5) > 0.09 + aa) discard;
          c = vec3(1.0); cR = 0.55;
        }
        // water line: wet dark band + green-black algae up to ~1 m above the water, darker still below it
        float yw = p.y - __SHADER_INJECT_0__;
        float wetTop = 0.75 + 0.45 * nz.b;
        float wet = 1.0 - smoothstep(wetTop - 0.35, wetTop, yw);
        c = mix(c, c * vec3(0.42, 0.47, 0.36), wet * 0.85);
        c *= mix(1.0, 0.45, 1.0 - smoothstep(-0.6, 0.05, yw));
        cR = mix(cR, 0.35, wet * 0.8);
        c *= mix(1.0, 0.82, smoothstep(250.0, 1100.0, length(p - cameraPosition)));
        return c;
      }