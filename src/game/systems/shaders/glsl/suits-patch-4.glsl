#include <map_fragment>
vec4 sysW = vec4(0.0); float sysH = 0.0, sysGloss = 1.0;
if (uSuitOn > 0.5) {
  vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); float sat = (mx - mn) / max(mx, 1e-4);
  float wR = smoothstep(0.03, 0.12, c.r - max(c.g, c.b));
  float wB = smoothstep(0.015, 0.05, c.b - max(c.r, c.g)) * (1.0 - wR);
  float wW = smoothstep(0.22, 0.42, lum) * (1.0 - smoothstep(0.18, 0.4, sat)) * (1.0 - wR) * (1.0 - wB);
  float wK = (1.0 - smoothstep(0.035, 0.12, lum)) * (1.0 - wR) * (1.0 - wB) * (1.0 - wW);
  sysW = vec4(wR, wB, wW, wK);
  vec3 o = c;
  o = mix(o, uSuitR * clamp(lum / 0.066, 0.0, 2.5), wR);
  o = mix(o, uSuitB * clamp(lum / 0.025, 0.0, 2.5), wB);
  o = mix(o, uSuitW * clamp(lum / 0.67, 0.0, 1.5), wW);
  o = mix(o, uSuitK * clamp(lum / 0.035, 0.3, 2.0), wK);
  // suit-specific emblem, drawn procedurally on the bind-pose body (independent of the UV layout)
  if (uEmbMode > 0.5) {
    vec3 P = vSysRestP, N = normalize(vSysRestN); float aa = 0.0015;
    float front = step(0.02, P.z) * smoothstep(0.15, 0.45, N.z) * step(abs(P.x), 0.2);
    float dF = sysSpider(P.xy, vec2(0.0, 1.345 - (uEmbScale.x - 0.075) * 0.4), uEmbScale.x, 0.0048 * uEmbScale.x / 0.075);
    float mF = front * (1.0 - smoothstep(-aa, aa, dF));
    o = mix(o, uEmbFront, mF); sysW = mix(sysW, vec4(0.0, 0.0, 0.0, 1.0), mF);
    float back = step(P.z, -0.0) * smoothstep(0.15, 0.45, -N.z) * uEmbBackOn;
    float dB = sysSpider(vec2(P.x, P.y), vec2(0.0, 1.24), uEmbScale.y, 0.009 * uEmbScale.y / 0.15);
    float mB = back * (1.0 - smoothstep(-aa, aa, dB));
    o = mix(o, uEmbBack, mB); sysW = mix(sysW, vec4(1.0, 0.0, 0.0, 0.0), mB);
  }
  if (uSym > 0.5) { // symbiote: wet black (texture detail discarded) + white emblem + vein relief
    vec3 P = vSysRestP;
    float front = smoothstep(-0.012, 0.012, P.z);
    vec2 uv = sysSymUV(P.xy); float inR = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    // keep the emblem off the hanging arms: torso half-width grows from the waist to the shoulders
    inR *= step(abs(P.x), mix(0.16, 0.27, smoothstep(1.24, 1.46, P.y)));
    vec4 mk = texture(uSymMask, uv), mkS = texture(uSymMask, uv, 1.5);
    float mE = mix(mk.g, mk.r, front) * inR, mS = mix(mkS.g, mkS.r, front) * inR;
    float v = sysVeins(P) * (1.0 - smoothstep(0.2, 0.5, mS));
    float fwP = length(fwidth(P)) * 70.0;
    float micro = (sysNoise(P * 70.0) + 0.5 * sysNoise(P * 150.0 + 4.0)) * (1.0 - smoothstep(0.3, 1.0, fwP)); // wet organic breakup
    sysH = v * 0.005 + mS * 0.0014 + mE * 0.0006 + micro * 0.00035 * (1.0 - mE);
    float sheen = sysNoise(P * 5.0 + 2.0);                          // slow dark sheen variation (subsurface-ish)
    o = uSuitK * (0.75 + 0.6 * sheen) * vec3(0.95, 0.97, 1.08) + vec3(0.035, 0.038, 0.048) * v;
    o = mix(o, uSymW * (0.82 + 0.18 * smoothstep(0.6, 1.0, mS)), mE); // slightly greyer rim, like the ref
    // user r10k: not uniformly wet. Multi-octave noise with a sharp threshold picks distinct glossy wet blotches
    // (~30 % of the surface) + the vein crests; everything else is satin/matte (rough slots: gloss/vein/emblem/matte)
    float gn = sysNoise(P * 5.5 + 9.0) + 0.5 * sysNoise(P * 12.0 - 2.0) + 0.25 * sysNoise(P * 26.0 + 5.0);
    float gp = smoothstep(0.17, 0.23, gn) * (1.0 - mE);
    float vc = smoothstep(0.5, 0.85, v) * (1.0 - mE);
    sysGloss = max(gp, vc);
    sysW = vec4(gp * (1.0 - vc), vc, mE, (1.0 - gp) * (1.0 - vc) * (1.0 - mE));
  }
  diffuseColor.rgb = o;
}