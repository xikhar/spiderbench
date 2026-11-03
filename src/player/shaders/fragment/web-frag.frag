
  uniform vec3 uColor; uniform float uOpacity; uniform float uVenom;
  in float vSide; in float vAlpha; in float vAlong; in float vDist; in float vPx;
  out vec4 fragColor;
  float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
  float vn(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
  void main(){
    if (uVenom > 0.5) {
      float t = vDist;
      // envelope radius (fraction of the ribbon half-width): slow bulges + knots; thin strands (few px) stay solid
      float bulge = vn(t * 1.7 + 3.1), knot = smoothstep(0.72, 1.0, vn(t * 3.9 + 1.7));
      float R = 0.5 + 0.36 * bulge + 0.2 * knot + 0.06 * vn(t * 11.0);
      float detail = smoothstep(3.0, 9.0, vPx);
      R = mix(0.95, R, detail);
      // three twisted sub-cords (braided / ropy symbiote mass), faded to one solid cord when the twist is sub-pixel
      float pitchPx = vPx * 0.9 / max(fwidth(t) * 3.4 * vPx, 1e-4); // ~ one twist period in pixels
      float braid = detail * smoothstep(6.0, 14.0, pitchPx);
      float y = vSide / R;            // -1..1 across the envelope
      float aa = 1.6 / max(vPx * R * 0.5, 1.0);
      // each covering cord contributes its shading, weighted toward the one nearest the viewer (soft, no seams)
      float cov = 0.0, wsum = 0.0, depB = 0.0; vec3 col = vec3(0.0);
      float mott = vn(t * 4.3 + 11.0);
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float ph = t * 13.0 + 9.0 * vn(t * 0.9 + 2.0) + fk * 2.0944 + 2.2 * vn(t * 2.6 + fk * 5.0); // uneven, organic twist
        float c = (0.36 + 0.14 * vn(t * 5.0 + fk)) * sin(ph) * braid, dep = cos(ph);   // lateral centre, depth (toward viewer +)
        float rs = mix(1.0, 0.5 + 0.22 * vn(t * 6.0 + fk * 3.3), braid);
        float xl = (y - c) / rs;
        float ck = 1.0 - smoothstep(1.0 - aa / rs, 1.0 + aa / rs, abs(xl));
        if (ck < 0.001) continue;
        cov = max(cov, ck);
        float nz = sqrt(max(0.0, 1.0 - xl * xl)), fib = vn(t * 38.0 + xl * 1.5 + fk * 7.0);
        float occl = mix(1.0, 0.5 + 0.5 * (dep * 0.5 + 0.5), braid);                // cords behind read darker
        vec3 cc = uColor * (0.5 + 0.5 * nz) * (0.8 + 0.3 * fib) * (0.85 + 0.3 * mott) * occl;
        // wet specular streak (light from above-left in screen space) + faint cool rim
        float spec = pow(max(0.0, 1.0 - abs(xl + 0.4) * 1.7), 3.0) * (0.45 + 0.55 * fib) * (0.55 + 0.45 * mott) * (0.6 + 0.4 * occl);
        cc += vec3(0.26, 0.28, 0.32) * spec + vec3(0.035, 0.04, 0.05) * pow(1.0 - nz, 3.0);
        float w = ck * exp(dep * 7.0 * braid) * nz + 1e-4;
        col += cc * w; wsum += w;
      }
      if (cov * uOpacity < 0.004) discard;
      col /= max(wsum, 1e-4);
      fragColor = vec4(col, cov * uOpacity * max(vAlpha, 0.8));
      fragColor = linearToOutputTexel(fragColor);
      return;
    }
    float edge = 1.0 - smoothstep(0.55, 1.0 + 0.35, abs(vSide));
    float core = 1.0 - smoothstep(0.0, 0.9, abs(vSide));
    vec3 col = mix(uColor * 0.82, uColor * 1.15, core);   // slight cylindrical shading / glow core
    float a = edge * vAlpha * uOpacity * (0.75 + 0.25 * core);
    if (a < 0.004) discard;
    fragColor = vec4(col, a);
    fragColor = linearToOutputTexel(fragColor);
  }
