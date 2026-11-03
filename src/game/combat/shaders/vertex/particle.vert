in vec3 iPos;
in vec3 iDir;
in vec2 iSize;
in vec4 iCol;
in float iTile;
out vec2 vUv;
out vec4 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  vec3 dv = (modelViewMatrix * vec4(iDir, 0.0)).xyz;
  float L = length(dv.xy);
  vec2 ax = L > 1e-5 ? dv.xy / L : vec2(1.0, 0.0);
  vec2 ay = vec2(-ax.y, ax.x);
  float len = iSize.x * (1.0 + iSize.y);
  mv.xy += ax * position.x * len + ay * position.y * iSize.x;
  gl_Position = projectionMatrix * mv;
  float tx = mod(iTile, 2.0), ty = floor(iTile / 2.0);
  vUv = (uv + vec2(tx, 1.0 - ty)) * 0.5;
  vCol = iCol;
}
