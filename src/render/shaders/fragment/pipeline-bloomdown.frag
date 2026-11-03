precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSrc;
uniform vec2 uPx;
uniform float uFirst;
__SHADER_INJECT_0__ vec3 s(vec2 o) {
return texture(uSrc, vUv + o * uPx).rgb;
}
vec3 kw(vec3 a, vec3 b, vec3 c, vec3 d) {
if(uFirst < 0.5) return (a + b + c + d) * 0.25;
float wa = 1.0 / (1.0 + luma(a)), wb = 1.0 / (1.0 + luma(b)), wc = 1.0 / (1.0 + luma(c)), wd = 1.0 / (1.0 + luma(d));
return (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
}
void main() {
vec3 A = s(vec2(- 2, - 2)), B = s(vec2(0, - 2)), C = s(vec2(2, - 2)), D = s(vec2(- 1, - 1)), E = s(vec2(1, - 1));
vec3 F = s(vec2(- 2, 0)), G = s(vec2(0, 0)), H_ = s(vec2(2, 0)), I = s(vec2(- 1, 1)), J = s(vec2(1, 1));
vec3 K = s(vec2(- 2, 2)), L = s(vec2(0, 2)), M = s(vec2(2, 2));
vec3 c = kw(D, E, I, J) * 0.5 + kw(A, B, F, G) * 0.125 + kw(B, C, G, H_) * 0.125 + kw(F, G, K, L) * 0.125 + kw(G, H_, L, M) * 0.125;
float lc = luma(c);
c *= min(1.0, 48.0 / max(lc, 1e-4)); // clamp bloom input (tiny sun glints must not bloom into blobs) (lighting2 r1: 16 -> 48, the sun disk glows)
fragColor = vec4(c, 1.0);
}