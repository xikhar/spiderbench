in vec3 vP; out vec4 fragColor; void main(){ float h = clamp((vP.y + 1.0) / 9.0, 0.0, 1.0);
        vec3 top = vec3(0.004, 0.008, 0.03), mid = vec3(0.03, 0.06, 0.16), glow = vec3(0.25, 0.45, 1.1);
        vec3 c = mix(mid, top, smoothstep(0.1, 0.9, h));
        c += glow * exp(-pow((vP.y - 1.2) / 0.9, 2.0)) * 0.35;           // horizon light band (rim source)
        float grid = step(0.985, fract(atan(vP.z, vP.x) * 14.3)) + step(0.97, fract(vP.y * 1.2));
        c += vec3(0.025, 0.045, 0.11) * grid * (1.0 - h) * smoothstep(0.0, 0.25, h);
        fragColor = vec4(c, 1.0); }
