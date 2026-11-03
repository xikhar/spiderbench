precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uCurrent, uHistory, uDepth;
uniform mat4 uCamWorld, uPrevViewProj;
uniform vec2 uRes, uJitter;
uniform float uBlend, uReset;
uniform sampler2D uMask;
uniform float uMaskOn;
uniform mat4 uObjDelta;
uniform mat4 uProjInvU;
__SHADER_INJECT_0__ __SHADER_INJECT_1__
// view position with the UN-jittered projection (history lives in the unjittered frame)
vec3 viewPosU(vec2 uv, float d) {
float z = uReversed > 0.5 ? d : d * 2.0 - 1.0;
vec4 p = uProjInvU * vec4(uv * 2.0 - 1.0, z, 1.0);
return p.xyz / p.w;
}
vec3 toYC(vec3 c) {
return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, - 0.25 * c.r + 0.5 * c.g - 0.25 * c.b);
}
vec3 fromYC(vec3 y) {
return vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z);
}
vec3 tm(vec3 c) {
return c / (1.0 + luma(c));
}
vec3 itm(vec3 c) {
return c / max(1.0 - luma(c), 1e-4);
}
vec3 sampleCR(sampler2D t, vec2 uv) {
vec2 sp = uv * uRes;
vec2 tc = floor(sp - 0.5) + 0.5;
vec2 f = sp - tc;
vec2 w0 = f * (- 0.5 + f * (1.0 - 0.5 * f));
vec2 w1 = 1.0 + f * f * (- 2.5 + 1.5 * f);
vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
vec2 w3 = f * f * (- 0.5 + 0.5 * f);
vec2 w12 = w1 + w2;
vec2 tc0 = (tc - 1.0) / uRes;
vec2 tc3 = (tc + 2.0) / uRes;
vec2 tc12 = (tc + w2 / w12) / uRes;
vec3 r = texture(t, vec2(tc12.x, tc0.y)).rgb * (w12.x * w0.y) + texture(t, vec2(tc0.x, tc12.y)).rgb * (w0.x * w12.y) + texture(t, vec2(tc12.x, tc12.y)).rgb * (w12.x * w12.y) + texture(t, vec2(tc3.x, tc12.y)).rgb * (w3.x * w12.y) + texture(t, vec2(tc12.x, tc3.y)).rgb * (w12.x * w3.y);
float ws = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
return max(r / ws, 0.0);
}
void main() {
vec2 px = 1.0 / uRes;
  // un-jitter the current frame: content that belongs at vUv was rendered at vUv + uJitter (uv units)
vec3 cur = sampleCR(uCurrent, vUv + uJitter);
vec3 m1 = vec3(0.0), m2 = vec3(0.0);
float closest = uReversed > 0.5 ? 0.0 : 1.0;
vec2 cuv = vUv;
vec3 cmin = vec3(1e9), cmax = vec3(- 1e9);
for(int y = - 1;
y <= 1;
y ++) for(int x = - 1;
x <= 1;
x ++) {
vec2 o = vec2(x, y) * px;
vec3 c = toYC(tm(texture(uCurrent, vUv + o).rgb));
m1 += c;
m2 += c * c;
cmin = min(cmin, c);
cmax = max(cmax, c);
float d = texture(uDepth, vUv + o).r;
bool nearer = uReversed > 0.5 ? d > closest : d < closest;
if(nearer) {
closest = d;
cuv = vUv + o;
}
}
vec3 world;
if(isSky(closest)) world = (uCamWorld * vec4(viewDirFromUv(vUv) * 1e5, 1.0)).xyz;
else world = (uCamWorld * vec4(viewPosU(vUv, closest), 1.0)).xyz;
  // character pixel? (mask depth == scene depth) -> reproject with the character's rigid motion
bool isChar = false;
if(uMaskOn > 0.5) {
float md = texture(uMask, cuv).r;
if(! isSky(md)) {
float zs = - viewPosFromDepth(cuv, closest).z, zm = - viewPosFromDepth(cuv, md).z;
isChar = abs(zs - zm) < 0.03 + 0.004 * zs;
}
}
if(isChar) world = (uObjDelta * vec4(world, 1.0)).xyz;
vec4 pc = uPrevViewProj * vec4(world, 1.0);
vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
if(uReset > 0.5 || any(lessThan(puv, vec2(0.0))) || any(greaterThan(puv, vec2(1.0))) || pc.w <= 0.0) {
fragColor = vec4(cur, 1.0);
return;
}
vec3 hist = toYC(tm(sampleCR(uHistory, puv)));
vec3 mu = m1 / 9.0;
vec3 sig = sqrt(max(m2 / 9.0 - mu * mu, 0.0));
float vel = length((puv - vUv) * uRes);
  // static / slow: wide box (no edge flicker from the neighbourhood itself moving with the jitter); fast: tight
float g = vel < 0.5 ? 1.9 : mix(1.4, 0.9, clamp((vel - 0.5) / 8.0, 0.0, 1.0));
if(isChar) g = min(g, 1.0);
vec3 bmin = max(cmin, mu - g * sig), bmax = min(cmax, mu + g * sig);
  // clip toward the mean
vec3 pc0 = 0.5 * (bmax + bmin), e = 0.5 * (bmax - bmin) + 1e-5;
vec3 v = hist - pc0;
vec3 a = abs(v / e);
float ma = max(a.x, max(a.y, a.z));
if(ma > 1.0) hist = pc0 + v / ma;
vec3 curT = toYC(tm(cur));
float blend = mix(uBlend, 0.25, clamp(vel / 20.0, 0.0, 1.0));
  // where the history had to be clipped hard (edge flips between frames) trust the stable history a bit more
if(vel < 0.5) blend *= mix(1.0, 0.6, clamp(ma - 1.0, 0.0, 1.0));
if(isChar) blend = max(blend, 0.14);
vec3 res = mix(hist, curT, blend);
fragColor = vec4(itm(fromYC(res)), 1.0);
}