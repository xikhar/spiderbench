precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uDepth, uSky;
uniform vec2 uSunUv;
uniform float uAspect;
__SHADER_INJECT_0__ void main() {
float v = 0.0;
float n = 0.0;
for(int y = - 4;
y <= 4;
y ++) for(int x = - 4;
x <= 4;
x ++) {
vec2 uv = uSunUv + vec2(float(x) / uAspect, float(y)) * 0.0022;
float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
float s = isSky(texture(uDepth, uv).r) ? texture(uSky, uv).a : 0.0;
v += s * inside;
n += 1.0;
}
fragColor = vec4(v / n, 0.0, 0.0, 1.0);
}