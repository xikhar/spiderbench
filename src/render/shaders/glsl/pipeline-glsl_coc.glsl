
uniform float uFocus, uBokeh, uMaxCoc, uFar;
float cocAt(float d, vec2 uv) { // signed CoC in half-res pixels (background side scaled by uFar)
  if (isSky(d)) return min(uMaxCoc, uBokeh * 0.5 * uFar);
  float z = -viewPosFromDepth(uv, d).z;
  float c = uBokeh * 0.5 * (z - uFocus) / max(z, 1e-3);
  if (c > 0.0) c *= uFar;
  return clamp(c, -uMaxCoc, uMaxCoc);
}