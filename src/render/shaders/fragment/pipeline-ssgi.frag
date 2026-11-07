precision highp float;
precision highp sampler2DShadow;
in vec2 vUv;
out vec4 fragColor;
uniform float uAbs, uAbsK;
uniform sampler2D uDepth, uPrevRad;
uniform mat4 uProj, uCamWorld, uPrevViewProj;
uniform vec2 uRes;
uniform float uFrame, uEnvI, uHavePrev, uStrength;
uniform vec3 uAmbBounce;
uniform sampler2DShadow uSM0, uSM1, uSM2, uSM3;
uniform mat4 uSMat[4];
uniform vec4 uSplits;
__SHADER_INJECT_0__ __SHADER_INJECT_1__
#define saturate(a) clamp(a, 0.0, 1.0)
uniform sampler2D envMap;
__SHADER_INJECT_2__ float linZ(vec2 uv) {
float d = textureLod(uDepth, uv, 0.0).r;
return isSky(d) ? 1e7 : - viewPosFromDepth(uv, d).z;
}
vec3 vpos(vec2 uv) {
return viewPosFromDepth(uv, textureLod(uDepth, uv, 0.0).r);
}
float sunVis(vec3 p, float vz) {
vec4 sc;
if(vz < uSplits.x) {
sc = uSMat[0] * vec4(p, 1.0);
return textureLod(uSM0, sc.xyz, 0.0);
}
#if NC > 1
if(vz < uSplits.y) {
sc = uSMat[1] * vec4(p, 1.0);
return textureLod(uSM1, sc.xyz, 0.0);
}
#endif
#if NC > 2
if(vz < uSplits.z) {
sc = uSMat[2] * vec4(p, 1.0);
return textureLod(uSM2, sc.xyz, 0.0);
}
#endif
#if NC > 3
sc = uSMat[3] * vec4(p, 1.0);
if(all(greaterThan(sc.xyz, vec3(0.0))) && all(lessThan(sc.xyz, vec3(1.0)))) return textureLod(uSM3, sc.xyz, 0.0);
#endif
return 1.0;
}
void main() {
vec2 px = 1.0 / uRes;
int k = int(uFrame) & 3;
vec2 fp = floor(vUv * uRes * 0.5) * 2.0 + vec2(float(k & 1), float(k >> 1)) + 0.5;
vec2 uv = fp * px;
float d0 = texture(uDepth, uv).r;
if(isSky(d0) || uHavePrev < 0.5) {
fragColor = vec4(0.0, 0.0, 0.0, 1e5);
return;
}
vec3 P = viewPosFromDepth(uv, d0);
float dist = length(P);
if(dist > 1500.0) {
fragColor = vec4(0.0, 0.0, 0.0, dist);
return;
}
vec3 pr = vpos(uv + vec2(px.x, 0.0)), pl = vpos(uv - vec2(px.x, 0.0));
vec3 pu = vpos(uv + vec2(0.0, px.y)), pd = vpos(uv - vec2(0.0, px.y));
vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
vec3 N = normalize(cross(dx, dy));
if(dot(N, P) > 0.0) N = - N;
  // tangent frame
vec3 T = normalize(abs(N.y) < 0.9 ? cross(N, vec3(0.0, 1.0, 0.0)) : cross(N, vec3(1.0, 0.0, 0.0)));
vec3 B = cross(N, T);
float jit = ign(gl_FragCoord.xy + uFrame * 5.588);
float jit2 = ign(gl_FragCoord.yx * 1.37 + uFrame * 3.17);
float R = clamp(dist * 0.06, 4.0, 40.0); // gather radius (m): local bounce near, block-scale bounce far
vec3 acc = vec3(0.0);
for(int i = 0;
i < DIRS;
i ++) {
    // cosine-weighted hemisphere (stratified spiral, rotated per pixel / frame)
float u1 = (float(i) + jit) / float(DIRS);
float phi = 6.2831853 * (float(i) * 0.618034 + jit2);
float r = sqrt(u1);
vec3 dir = T * (r * cos(phi)) + B * (r * sin(phi)) + N * sqrt(max(1.0 - u1, 0.0));
for(int s = 1;
s <= STEPS;
s ++) {
float f = (float(s) - 0.5 * jit) / float(STEPS);
float t = max(R * f * f, 0.25);
vec3 S = P + N * 0.08 + dir * t;
if(S.z > - 0.1) break;
vec4 h = uProj * vec4(S, 1.0);
vec2 su = h.xy / h.w * 0.5 + 0.5;
if(any(lessThan(su, vec2(0.0))) || any(greaterThan(su, vec2(1.0)))) break;
float sz = linZ(su);
float dz = - S.z - sz;
if(dz > 0.05 && dz < max(1.5, t * 0.8)) {
vec3 hv = vpos(su);
vec3 hw = (uCamWorld * vec4(hv, 1.0)).xyz;
vec4 pc = uPrevViewProj * vec4(hw, 1.0);
vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
if(pc.w > 0.0 && all(greaterThan(puv, vec2(0.0))) && all(lessThan(puv, vec2(1.0)))) {
vec3 L = textureLod(uPrevRad, puv, 0.0).rgb;
L *= min(1.0, 8.0 / max(dot(L, vec3(0.2126, 0.7152, 0.0722)), 1e-4));
acc += L;
}
break;
}
}
}
vec3 Egi = 3.14159265 * acc / float(DIRS);
  // irradiance this pixel already receives: sun (real shadow maps) + sky fill + the analytic bounce approximation
vec3 Pw = (uCamWorld * vec4(P, 1.0)).xyz;
vec3 Nw = normalize((uCamWorld * vec4(N, 0.0)).xyz);
float ndl = max(dot(Nw, uSunDir), 0.0);
float vis = ndl > 0.0 ? sunVis(Pw + Nw * 0.25 + uSunDir * 0.1, - P.z) : 0.0;
vec3 Eamb = 3.14159265 * textureCubeUV(envMap, Nw, 1.0).rgb * uEnvI + uAmbBounce;
float Ed = dot(uSunColor * ndl * vis + Eamb, vec3(0.2126, 0.7152, 0.0722));
vec3 ratio = Egi * uStrength / max(Ed, 1e-3);
ratio = min(ratio, vec3(1.6));
  // (night) emissive bounce: lit windows, screens, signs, neon, headlights light the surfaces around them. At night the
  // pixel's own irradiance is ~0, so the ratio form cannot add light; output the absolute irradiance instead (composite
  // adds it with an albedo proxy)
vec3 gAbs = Egi * uAbsK;
gAbs *= 0.9 / (0.9 + max(gAbs.r, max(gAbs.g, gAbs.b))); // (r10) soft cap: colour bleed kept, no amber wash
fragColor = vec4(mix(ratio, gAbs, uAbs), dist);
}
