#include <map_fragment>
      {
        vec2 p = vLWP.xz;
        vec2 cell = vec2(96.0, 210.0);
        vec2 q = p / cell, id = floor(q), f = fract(q);
        float r = lh(id), nb = lh(floor(p / 1400.0));
        vec3 blk = mix(vec3(0.29, 0.27, 0.25), vec3(0.4, 0.36, 0.32), r); // (r14: darker, warmer)
        if (r > 0.93 || nb < 0.1) blk = vec3(0.26, 0.31, 0.22);             // parks / cemeteries
        else if (nb > 0.8) blk *= vec3(1.05, 1.0, 0.95);                     // industrial / lighter
        // (round 3) street-tree / back-yard canopy mottling: the hinterland reads as leafy boroughs, not a grey slab
        float tc = lh(floor(p / 38.0)) * 0.6 + lh(floor(p / 330.0)) * 0.4;
        blk = mix(blk, vec3(0.16, 0.19, 0.12), smoothstep(0.45, 0.8, tc) * 0.75);
        vec2 e = min(f, 1.0 - f) * cell;
        float st = 1.0 - smoothstep(5.0, 8.0, min(e.x, e.y));
        vec3 c = mix(blk, vec3(0.2, 0.2, 0.21), st);
        // (round 6) arterial boulevards (same grid as the baked map) keep the road hierarchy readable to the horizon
        float art = min(abs(mod(p.x - 350.0 + 550.0, 1100.0) - 550.0), abs(mod(p.y - 180.0 + 475.0, 950.0) - 475.0));
        c = mix(c, vec3(0.15, 0.15, 0.16), 1.0 - smoothstep(11.0, 14.0, art));
        vec2 fw = fwidth(q);
        c = mix(c, vec3(0.33, 0.33, 0.31), clamp(max(fw.x * 4.0, fw.y * 8.0), 0.0, 1.0));
        vec2 uvm = vMapUv;
        float inMap = step(0.0, uvm.x) * step(uvm.x, 1.0) * step(0.0, uvm.y) * step(uvm.y, 1.0);
        float edge = inMap * smoothstep(0.0, 0.03, min(min(uvm.x, 1.0 - uvm.x), min(uvm.y, 1.0 - uvm.y)));
        diffuseColor.rgb = mix(c, diffuseColor.rgb, edge);
      }