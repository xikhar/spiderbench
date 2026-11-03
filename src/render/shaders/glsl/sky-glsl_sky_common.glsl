
uniform sampler2D uSkyLUT;
uniform vec3 uSunDir;
uniform vec3 uSunColor;   // sun illuminance (scaled) at ground
uniform float uSkyScale;
uniform vec3 uSkyTint;    // day: 1; night: dim blue (moonlit sky)
uniform vec3 uSkyGlow;    // additive horizon glow (city light pollution at night / warm dusk band)
uniform vec3 uHzK;        // (atmosphere r1) horizon-band radiance multiplier
uniform vec4 uSunGlow;    // (lighting2 r2) golden aureole: rgb warm tint, w strength (0 = off)
uniform float uOvercast;  // (lighting2 r4) overcast deck: 0 = clear .. 1 = fully grey, low, heavy sky
__SHADER_INJECT_0__
vec3 skyLUT(vec3 dir) {
  float el = asin(clamp(dir.y, -1.0, 1.0));
  vec2 dh = dir.xz; vec2 sh = uSunDir.xz;
  float ca = dot(normalize(dh + vec2(1e-6, 0.0)), normalize(sh + vec2(1e-6, 0.0)));
  float u = acos(clamp(ca, -1.0, 1.0)) / PI_;
  float v = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / (PI_ * 0.5));
  u = clamp(u, 0.5 / __SHADER_INJECT_1__.0, 1.0 - 0.5 / __SHADER_INJECT_2__.0);
  // (foundation agent, round 10) horizon deepening: the LUT's last few degrees saturate to a near-white band that
  // everything far (fog in-scatter, sky, horizon skirt) converges to -> critic: 'over-bright white haze band'. A soft
  // blue-grey multiplier on the low sky (applied here, so fog / sky / reflections all converge to the same value)
  // (atmosphere r1) stronger: the refs' horizon haze is a light grey-blue a little DARKER than the upper sky, never
  // the brightest thing in frame (measured: refs 07 / 09 horizon ~0.55-0.68 sRGB vs our old ~0.95 cream-white band)
  vec3 hzK = mix(vec3(uHzK), vec3(1.0), smoothstep(0.0, 0.3, abs(dir.y)));
  vec3 sc = texture(uSkyLUT, vec2(u, v)).rgb * uSkyScale * uSkyTint * hzK + uSkyGlow * exp(-max(dir.y, 0.0) * 7.0);
  // (lighting2 r2) golden-hour aureole: warm forward-scattering haze around a low sun (the single-scattering LUT stays
  // blue-white there). Desaturates the blue toward the sun and adds a warm glow, strongest near the horizon. Fog,
  // env reflections and cloud ambient all read skyLUT, so the golden haze carries through the whole frame.
  if (uSunGlow.w > 0.0) {
    float mu = max(dot(dir, uSunDir), 0.0);
    float hzw = exp(-max(dir.y, 0.0) * 2.2);
    float lobe = (0.7 * pow(mu, 5.0) + 0.45 * pow(mu, 1.5) * hzw + 0.18 * hzw + 1.6 * pow(mu, 48.0)) * uSunGlow.w;
    float sl = dot(sc, vec3(0.2126, 0.7152, 0.0722));
    sc = mix(sc, vec3(sl), clamp(lobe * 0.9, 0.0, 0.9)) + uSunGlow.rgb * sl * lobe;
  }
  if (uOvercast > 0.0) { // (lighting2 r4) director: 'overcast still shows a clear BLUE sky'. A grey storm deck: the sky
    // (and so fog in-scatter, env reflections and cloud ambient) becomes a flat grey, brightest at the zenith
    float ol = dot(sc, vec3(0.2126, 0.7152, 0.0722));
    vec3 deck = vec3(0.86, 0.88, 0.91) * ol * mix(0.55, 1.0, smoothstep(-0.05, 0.6, dir.y));
    sc = mix(sc, deck, uOvercast);
  }
  return sc;
}
