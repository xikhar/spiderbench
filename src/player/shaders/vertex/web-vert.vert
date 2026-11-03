
  in vec3 nextPos; in float side; in float along; in float strandW; in float dist;
  uniform vec2 uRes; uniform float uWidth; uniform float uMinPx;
  out float vSide; out float vAlpha; out float vAlong; out float vDist; out float vPx;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position,1.0);
    vec4 c0 = projectionMatrix * mv;
    vec4 c1 = projectionMatrix * modelViewMatrix * vec4(nextPos,1.0);
    vec2 s0 = c0.xy / c0.w * uRes * 0.5, s1 = c1.xy / c1.w * uRes * 0.5;
    vec2 d = s1 - s0; float L = length(d); d = L > 1e-4 ? d / L : vec2(1.0,0.0);
    vec2 n = vec2(-d.y, d.x);
    // world width -> pixels
    float px = uWidth * strandW * projectionMatrix[1][1] * uRes.y * 0.5 / max(0.05, -mv.z);
    float w = max(px, uMinPx);
    vAlpha = clamp(px / uMinPx, 0.35, 1.0);
    vec2 off = n * side * (w * 0.5 + 1.0);
    c0.xy += off / (uRes * 0.5) * c0.w;
    gl_Position = c0; vSide = side * (w * 0.5 + 1.0) / (w * 0.5); vAlong = along; vDist = dist; vPx = w;
  }
