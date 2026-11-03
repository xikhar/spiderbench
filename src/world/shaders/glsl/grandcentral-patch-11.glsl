#include <common>
      in vec2 vGU; in vec3 vGWp; in vec3 vGNp; float vGMull = 0.0; vec3 gInt = vec3(0.0);
      float gGrid(vec2 q, vec2 per, vec2 w) { vec2 g = q / per; vec2 fw = fwidth(g) + 1e-4; vec2 d = abs(fract(g) - 0.5) * 2.0;
        return max(smoothstep(1.0 - w.x - fw.x * 2.0, 1.0 - w.x, d.x), smoothstep(1.0 - w.y - fw.y * 2.0, 1.0 - w.y, d.y)) * (1.0 - smoothstep(0.3, 0.7, max(fw.x, fw.y))); }