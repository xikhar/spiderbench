precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uColor, uDepth;
uniform vec2 uPx;
__SHADER_INJECT_0__ __SHADER_INJECT_1__ __SHADER_INJECT_2__ void main() {
vec2 o[4] = vec2[](vec2(- 0.5, - 0.5), vec2(0.5, - 0.5), vec2(- 0.5, 0.5), vec2(0.5, 0.5));
vec3 c = vec3(0.0);
float ws = 0.0;
float cmin = 1e9, cmax = - 1e9;
for(int i = 0;
i < 4;
i ++) {
vec2 uv = vUv + o[i] * uPx;
vec3 s = texture(uColor, uv).rgb;
float w = 1.0 / (1.0 + luma(s));
c += s * w;
ws += w;
float k = cocAt(texture(uDepth, uv).r, uv);
cmin = min(cmin, k);
cmax = max(cmax, k);
}
float coc = cmin < 0.0 ? cmin : cmax;
fragColor = vec4(c / ws, coc);
}