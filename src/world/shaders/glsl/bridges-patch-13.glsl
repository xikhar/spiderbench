#include <emissivemap_fragment>
      if (uNightK > 0.0 && vNeck > 0.5) { float q = (vWPc.x + vWPc.z) * 0.18; float fq = fwidth(q) + 1e-4;
        // (night) small bright bulbs, not a glowing bar: each bulb stays >= ~1.5 px long at any distance (never averaged
        // into a continuous line); once bulbs crowd to < ~3.5 px apart only every 2nd / 4th / ... bulb is drawn (stable
        // world-space subset), so far bridges keep a dotted necklace of points. Bloom does the glow
        float st = exp2(ceil(log2(max(1.0, fq * 6.0)))); // (night r11) 3.5: far necklaces read as dashed white bars
        float hw = max(0.05, fq * 0.75), dd = abs(fract(q) - 0.5);
        float dot1 = (1.0 - smoothstep(hw - 0.5 * fq, hw + 0.5 * fq, dd)) * step(mod(floor(q), st), 0.5);
        // (night r11) the cable is fattened with distance (~1.5 m at 1.5 km): the bulb's emission is scaled back by the
        // fattening, so far necklaces read as fine warm points instead of thick white dashes (esb view)
        totalEmissiveRadiance += vec3(1.0, 0.9, 0.72) * dot1 * 3.5 * uNightK / (1.0 + vFat * 6.0); }