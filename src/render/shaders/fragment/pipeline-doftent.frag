
precision highp float; in vec2 vUv; out vec4 fragColor; uniform sampler2D uSrc; uniform vec2 uPx;
void main() { vec4 o = vec4(uPx.xy, -uPx.xy) * 0.5;
  fragColor = 0.25 * (texture(uSrc, vUv + o.xy) + texture(uSrc, vUv + o.zy) + texture(uSrc, vUv + o.xw) + texture(uSrc, vUv + o.zw)); }