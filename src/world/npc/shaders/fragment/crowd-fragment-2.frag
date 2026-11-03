
      in vec2 vQ; in float vA; in float vP; out vec4 fragColor;
      void main() {
        float d = length(vQ);
        // (peds r4) hip: gaussian-ish halo; feet: dark core right under the sole + soft rim
        float a = vP < 0.5 ? vA * exp(-d * d * 2.2) * (1.0 - smoothstep(0.75, 1.0, d)) : vA * (1.0 - smoothstep(0.05, 1.0, d)) * (1.0 - 0.35 * smoothstep(0.3, 1.0, d));
        if (a < 0.004) discard; fragColor = vec4(0.0, 0.0, 0.0, a); }
