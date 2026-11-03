precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uColor, uDof, uDepth;
__SHADER_INJECT_0__ __SHADER_INJECT_1__ void main() {
vec3 src = texture(uColor, vUv).rgb;
vec4 dof = texture(uDof, vUv);
float coc = cocAt(texture(uDepth, vUv).r, vUv);
float s = smoothstep(0.25, 1.2, abs(coc));
vec3 c = mix(src, dof.rgb, s + dof.a - s * dof.a);
fragColor = vec4(c, 1.0);
}