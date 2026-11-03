precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uColor, uDepth;
uniform mat4 uCamWorld, uPrevViewProj;
uniform float uScale, uMask, uFrame;
uniform vec2 uRes;
__SHADER_INJECT_0__ float linZ(vec2 uv) {
float d = textureLod(uDepth, uv, 0.0).r;
return isSky(d) ? 1e6 : - viewPosFromDepth(uv, d).z;
}
void main() {
float d = texture(uDepth, vUv).r;
vec3 world = isSky(d) ? (uCamWorld * vec4(viewDirFromUv(vUv) * 1e5, 1.0)).xyz : (uCamWorld * vec4(viewPosFromDepth(vUv, d), 1.0)).xyz;
vec4 pc = uPrevViewProj * vec4(world, 1.0);
vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
vec2 v = (vUv - puv) * uScale;
float z = isSky(d) ? 1e6 : - viewPosFromDepth(vUv, d).z;
v *= smoothstep(uMask, uMask + 5.0, z); // near-field (foliage beside the lens, the character) stays crisp
float lp = length(v * uRes);
float maxL = 0.1 * uRes.x; // (user r10e: room for the High / Very High settings)
if(lp > maxL) v *= maxL / lp;
vec3 c = texture(uColor, vUv).rgb;
if(lp < 0.5) {
fragColor = vec4(c, 1.0);
return;
}
float j = ign(gl_FragCoord.xy + uFrame * 5.588238) - 0.5;
vec3 acc = c;
float ws = 1.0;
int n = lp > 20.0 ? SAMPLES * 2 : SAMPLES; // long streaks: more taps (no discrete ghost copies)
for(int i = 0;
i < SAMPLES * 2;
i ++) {
if(i >= n) break;
float t = (float(i) + 0.5 + j) / float(n) - 0.5;
vec2 uv = vUv + v * t;
float sz = linZ(uv);
float w = smoothstep(uMask, uMask + 5.0, sz); // don't smear the sharp foreground (character) over bg
acc += textureLod(uColor, uv, 0.0).rgb * w;
ws += w;
}
fragColor = vec4(acc / ws, 1.0);
}