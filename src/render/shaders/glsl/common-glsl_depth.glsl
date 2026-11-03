
uniform mat4 uProjInv;
uniform float uReversed; // 1.0 when renderer uses reversed depth (EXT_clip_control, [0,1] NDC z)
bool isSky(float d) { return uReversed > 0.5 ? d <= 0.0 : d >= 1.0; }
vec3 viewPosFromDepth(vec2 uv, float d) {
  float z = uReversed > 0.5 ? d : d * 2.0 - 1.0;
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, z, 1.0);
  return p.xyz / p.w;
}
vec3 viewDirFromUv(vec2 uv) {
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, 0.5, 1.0);
  return normalize(p.xyz / p.w);
}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
