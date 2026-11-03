// crowd shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
__SHADER_INJECT_0__ in vec4 iC;
in vec2 aUV;
out vec2 vBUv;
out vec3 vB0;
out vec3 vB1;
out vec3 vB2;
out float vOptF;   // (peds r2) baked cloth normal / AO
vec3 unpackC(float f) {
float r = floor(f / 65536.0);
float g = floor((f - r * 65536.0) / 256.0);
float b = f - r * 65536.0 - g * 256.0;
vec3 c = vec3(r, g, b) / 255.0;
return c * c;
}
out vec3 vCol;
out float vRough;
out float vEmis;
out vec3 vRest;
out float vReg;
out float vAOm;
out vec3 vShirt;
out float vCode;
uniform vec3 uFaceSkin[32];
out vec4 vPed;
out vec3 vRestN;
out vec3 vHairC;   // (peds r1) face, tone, hair tile, view dist
vec3 faceSkin() {
return uFaceSkin[int(clamp(iM.x, 0.0, 31.99))] * mix(0.7, 1.08, fract(iM.x));
}
vec3 skinTone(float k) {
vec3 a = vec3(0.64, 0.44, 0.33), b = vec3(0.42, 0.26, 0.16), c = vec3(0.16, 0.09, 0.055);
return k < 0.5 ? mix(a, b, k * 2.0) : mix(b, c, k * 2.0 - 1.0);
}
vec3 hairTone(float k) {
vec3 a = vec3(0.015, 0.011, 0.008), b = vec3(0.12, 0.065, 0.03), c = vec3(0.45, 0.32, 0.16);
return k < 0.7 ? mix(a, b, k / 0.7) : (k < 0.93 ? mix(b, c, (k - 0.7) / 0.23) : vec3(0.45, 0.44, 0.42));
}
// @section vertexBeginNormalVertex
bool oHid = optHidden();
mat4 sk = oHid ? mat4(0.0) : skinMatrix();   // hidden option: collapse to a point (degenerate triangles)
vec3 objectNormal = oHid ? vec3(0.0, 1.0, 0.0) : normalize(mat3(sk) * normal);
{
mat3 bnm = normalMatrix * mat3(instanceMatrix) * mat3(sk);
vB0 = bnm[0];
vB1 = bnm[1];
vB2 = bnm[2];
vBUv = aUV;
vOptF = aRA.z;
}
        #ifdef USE_TANGENT
vec3 objectTangent = vec3(1.0, 0.0, 0.0);
        #endif
// @section vertexBeginVertex
vec3 transformed = (sk * vec4(bodyShape(position), 1.0)).xyz;   // (peds r3) body type
{
int R = int(aRA.x + 0.5);
float aAO = aRA.y / 255.0;
vec3 c = vec3(0.5);
float rg = 0.85;
float em = 0.0;
if(R == 0) {
c = faceSkin();
rg = 0.64;
}   // (peds r4) 0.55 -> 0.64: critic 'plastic' skin
else if(R == 1) c = unpackC(iC.x);
else if(R == 2) {
c = unpackC(iC.y);
rg = c.b > c.r * 1.25 ? 0.93 : 0.82;
} else if(R == 3) {
float sh_ = fract(iM.z);
c = mix(vec3(0.012), vec3(0.2, 0.12, 0.07), sh_);
c = sh_ > 0.85 ? vec3(0.7) : c;
rg = 0.5;
} else if(R == 4) {
c = hairTone(fract(iM.y));
rg = 0.46;
}   // (peds r4) 0.55 -> 0.46: strand sheen
else if(R == 5) {
c = unpackC(iC.z);
float oc_ = mod(mod(iX.w, 512.0), 8.0);   // (peds r3) material separation (critic: 'wool vs leather vs denim all same roughness')
rg = oc_ > 2.5 && oc_ < 3.5 || oc_ > 4.5 ? 0.42 : oc_ > 1.5 && oc_ < 2.5 ? 0.93 : oc_ > 3.5 ? 0.72 : dot(c, vec3(0.33)) < 0.03 ? 0.4 : 0.82;
} else if(R == 6) {
c = unpackC(iC.w);
rg = 0.5;
} else if(R == 7) {
c = vec3(0.012);
rg = 0.5;
} else if(R == 8) {
c = vec3(0.72);
rg = 0.6;
} else if(R == 9) {
c = vec3(0.05, 0.08, 0.12);
rg = 0.15;
float fl = iM.w > 0.0 ? step(fract(uTime * 0.37 + iM.w), 0.035) : 0.0;
em = 0.6 + fl * 60.0;
} else if(R == 10) {
c = vec3(0.02);
rg = 0.3;
} else if(R == 11) {
c = faceSkin() * vec3(0.8, 0.56, 0.54);
rg = 0.45;
}       // lips
else if(R == 12) {
c = vec3(0.62, 0.6, 0.57);
rg = 0.2;
}                         // eye whites
else if(R >= 13) {
c = hairTone(fract(iM.y));
rg = 0.46;
}                        // (peds r5) hair locks / fuzz shell (alpha-cut)
vAOm = 0.35 + 0.65 * aAO;
vCol = c * vAOm;
vRough = rg;
vEmis = em;
vRest = position;
vReg = float(R);
          // (peds r1) undo the leg-proportion remap (city_npc.py LEG_K / LEG_Y): all painting constants are in the modelling frame
vRest.y = position.y < __SHADER_INJECT_0__ ? position.y / __SHADER_INJECT_1__ : position.y + __SHADER_INJECT_2__;
vShirt = unpackC(iC.x);
vCode = mod(iX.w, 512.0);   // (citylife r1) garment detail inputs ((peds r2) mask above 512)
vRestN = normal;
vHairC = hairTone(fract(iM.y)) * vAOm;
vec4 mvq = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
vPed = vec4(floor(clamp(iM.x, 0.0, 31.99)), mix(0.7, 1.08, fract(iM.x)), floor(iM.y * 0.5), - mvq.z);
}
// @section fragmentCommon
#include <common>
in vec3 vCol;
in float vRough;
in float vEmis;
in vec3 vRest;
in float vReg;
in float vAOm;
in vec3 vShirt;
in float vCode;
uniform sampler2D uPed;
uniform vec3 uFaceSkin[32];
in vec4 vPed;
in vec3 vRestN;
in vec3 vHairC;
uniform sampler2D uBake;
uniform float uBakeOn;
in vec2 vBUv;
in vec3 vB0;
in vec3 vB1;
in vec3 vB2;
in float vOptF;
vec4 gBake = vec4(0.5, 0.5, 0.5, 1.0);
      // (peds r1) atlas sampling. Tiles repeat with fract(); textureGrad with the gradient of the continuous coordinate
      // keeps the mip level right across the wrap (no seam lines). o/sz: tile origin / size in atlas uv (y down: flipY off)
vec3 tileTex(vec2 q, vec2 o, float sz) {
return textureGrad(uPed, o + fract(q) * sz, dFdx(q) * sz, dFdy(q) * sz).rgb;
}
      // triplanar over the rest pose (garments have no uv): 3 taps blended by the rest normal
float gH = 0.0;
vec3 triTex(vec3 p, float scale, int k) {
vec2 o = vec2(0.5 + float(k - (k / 4) * 4) * 0.125, 0.5 + float(k / 4) * 0.125);
vec3 w = pow(abs(normalize(vRestN)), vec3(4.0));
w /= (w.x + w.y + w.z);
vec3 t = vec3(0.0);
if(w.x > 0.02) t += tileTex(p.zy / scale, o, 0.125) * w.x;
if(w.y > 0.02) t += tileTex(p.xz / scale, o, 0.125) * w.y;
if(w.z > 0.02) t += tileTex(p.xy / scale, o, 0.125) * w.z;
return t / 0.2158;   // sRGB 128 (tile mean) -> 1.0
}
      // (peds r1) photo face projected onto the head front (rest pose): 0.144 m wide cell, eyes at y 1.643 = v 0.33
vec4 faceTex(vec3 p) {
vec2 fuv = vec2(0.5 + p.x / 0.144, (1.684 - p.y) / 0.125);
        // (peds r2) softer chin / jaw edge (the photo's jaw shadow + the modelled jaw read as a mask seam): fade from the lip line
float w = smoothstep(0.012, 0.05, p.z) * (1.0 - smoothstep(0.042, 0.064, abs(p.x) + max(0.0, fuv.y - 0.7) * 0.05)) * (1.0 - smoothstep(0.8, 0.98, fuv.y));
float f = vPed.x;
vec2 cell = vec2(f - floor(f / 4.0) * 4.0, floor(f / 4.0));
vec2 q = clamp(fuv, vec2(0.03, 0.04), vec2(0.97, 0.985));
vec3 t = texture(uPed, (cell + q) * 0.125).rgb;
return vec4(t * vPed.y, w);
}
vec3 bumpN(vec3 sp, vec3 n, float h) {   // screen-space bump (fold height in metres)
vec3 dx = dFdx(sp), dy = dFdy(sp);
float hx = dFdx(h), hy = dFdy(h);
vec3 r1 = cross(dy, n), r2 = cross(n, dx);
float det = dot(dx, r1);
vec3 g = sign(det) * (hx * r1 + hy * r2);
return normalize(abs(det) * n - g);
}
float ph3(vec3 p) {
p = fract(p * 0.3183099 + 0.1);
p *= 17.0;
return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float pvn(vec3 x) {
vec3 i = floor(x), f = fract(x);
f = f * f * (3.0 - 2.0 * f);
return mix(mix(mix(ph3(i), ph3(i + vec3(1, 0, 0)), f.x), mix(ph3(i + vec3(0, 1, 0)), ph3(i + vec3(1, 1, 0)), f.x), f.y), mix(mix(ph3(i + vec3(0, 0, 1)), ph3(i + vec3(1, 0, 1)), f.x), mix(ph3(i + vec3(0, 1, 1)), ph3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
vec3 tieCol(int k) {
return k == 1 ? vec3(0.018, 0.03, 0.09) : k == 2 ? vec3(0.13, 0.015, 0.025) : k == 3 ? vec3(0.03, 0.03, 0.035) : k == 4 ? vec3(0.05, 0.1, 0.24) : k == 5 ? vec3(0.25, 0.03, 0.03) : vec3(0.1, 0.09, 0.05);
}
      // (citylife r1) garment detail painted from the rest-pose position (every LOD): suit / jacket / coat fronts with the
      // shirt V, tie, lapel edges, button placket, buttons and pocket flaps; quilted puffers with a zip; striped / check /
      // heather tops; denim grain + fading, trouser creases; hair strands; low-frequency cloth folds everywhere
bool gCut = false, gHairCut = false;
void garment(vec3 c, out vec3 garmentColor) {
garmentColor = c;
gHairCut = false;
int R = int(vReg + 0.5);
vec3 p = vRest;
float ax = abs(p.x);
if(R >= 13) {   // (peds r5) hair locks / fuzz shells: strand gaps cut out, wider toward the tip (region 13 -> 14
          // interpolates across the triangle); fewer gaps with distance so the outline doesn't shimmer
float tip = clamp(vReg - 13.0, 0.0, 1.0), a_ = atan(p.x, p.z - 0.01);
float st = pvn(vec3(a_ * 60.0, p.y * 10.0, 0.0)) * 0.55 + pvn(vec3(a_ * 150.0 + 3.0, p.y * 20.0, 1.7)) * 0.45;
if(st < (0.2 + 0.78 * tip) * mix(1.0, 0.5, smoothstep(12.0, 35.0, vPed.w))) gHairCut = true;
R = 4;
}
int oc = int(mod(vCode, 8.0));
int pat = int(mod(floor(vCode / 8.0), 8.0));
int tie = int(floor(vCode / 64.0));
bool cloth = R == 1 || R == 2 || R == 5;
if(cloth) c *= 0.9 + 0.16 * pvn(p * vec3(11.0, 6.0, 11.0)) - 0.02;   // (no sub-cm noise: it aliased into glitter)
float gNear = 1.0 - smoothstep(14.0, 40.0, vPed.w);
if((cloth || R == 6) && gNear > 0.0) {   // (peds r1) woven / knit fabric detail + drape folds (bump), fading out with distance
int k = 3;
float sc = 0.07, amt = 0.35;
if(R == 2) {
bool dn = c.b > c.r * 1.25;
k = dn ? 0 : 2;
sc = dn ? 0.09 : 0.08;
amt = dn ? 0.5 : 0.3;
} else if(R == 5) {
k = oc == 4 ? (pat == 1 ? 8 : 2) : oc == 2 ? 1 : oc == 1 ? (c.b > c.r * 1.2 ? 0 : 1) : 3;
sc = oc == 2 ? 0.2 : 0.1;
amt = oc == 3 || oc == 5 ? 0.0 : 0.4;
} else if(R == 1) {
k = pat == 3 ? 4 : (oc == 1 || oc == 2 || oc == 4) ? 2 : 3;
sc = pat == 3 ? 0.16 : 0.06;
amt = pat == 3 ? 0.55 : 0.3;
} else if(R == 6) {
k = p.y > 1.4 ? 5 : 10;
sc = 0.1;
amt = 0.35;
}
if(amt > 0.0) {
vec3 t = triTex(p, sc, k);
c *= mix(vec3(1.0), t, amt * 0.55 * gNear);
gH += (t.r - 1.0) * 0.0004 * amt;
}
float jn = exp(- pow(p.y - 0.52, 2.0) / 0.006) * step(p.y, 0.95) + exp(- pow(p.y - 1.15, 2.0) / 0.006) * step(0.16, ax) + exp(- pow(p.y - 0.93, 2.0) / 0.004) * 0.6;
float fold = triTex(p * vec3(1.0, 1.3, 1.0), 0.55, 11).r - 1.0;
gH += fold * (0.0015 + 0.0035 * jn) * gNear * (1.0 - 0.85 * uBakeOn);   // (peds r2) folds now come from the Cycles bake
c *= 1.0 + fold * 0.035 * gNear * (1.0 - uBakeOn);
}
bool front = p.z > 0.035;
if(R == 5) {
if(pat == 6) {   // (peds r3) plaid: two crossing stripe sets + thin light overcheck
float u = fract(p.y * 6.5), w = fract((p.x + p.z * 0.7) * 6.5);
float a = smoothstep(0.3, 0.36, u) * smoothstep(0.62, 0.56, u), b = smoothstep(0.3, 0.36, w) * smoothstep(0.62, 0.56, w);
c *= 0.62 + 0.26 * a + 0.26 * b;
c = mix(c, c * 1.6 + 0.03, (1.0 - smoothstep(0.0, 0.03, abs(u - 0.8))) * 0.5 + (1.0 - smoothstep(0.0, 0.03, abs(w - 0.8))) * 0.5);
} else if(pat == 7) c *= 0.84 + 0.3 * pvn(p * vec3(70.0, 48.0, 70.0)) * gNear + 0.15 * (1.0 - gNear);   // tweed
if(oc == 1 || oc == 2 || oc == 4) {
float yV = oc == 2 ? 1.21 : oc == 1 ? 1.24 : 1.14, yT = 1.5;
float w = clamp((p.y - yV) / (yT - yV), 0.0, 1.0) * (oc == 1 ? 0.07 : 0.088);
if(front && p.y > yV && p.y < 1.53) {
if(ax < w) {
gCut = true;   // open front: the shirt torso underneath shows (painting it on the shell z-fought with it)
} else if(ax < w + 0.034 && oc != 1) {
c *= ax - w < 0.003 ? 0.72 : 0.95;                                            // lapel roll edge ((peds r5) modelled lapel now)
} else if(ax < w + 0.006) c *= 0.55;                                          // jacket zip edge
}
float hemY = oc == 2 ? 0.5 : 0.84;
if(front && p.y <= yV + 0.002 && p.y > hemY) {
if(ax < 0.0035) c *= 0.55;                                                     // placket / closure
float by = yV - 0.055;
for(int k = 0;
k < 4;
k ++) {
float d = length(vec2(p.x - (oc == 2 ? 0.05 : 0.012), p.y - by));
if(d < 0.009) c = mix(c, vec3(0.02), 0.75);
by -= oc == 2 ? 0.12 : 0.1;
}
if(abs(p.y - (oc == 2 ? 0.98 : 0.95)) < 0.005 && ax > 0.05 && ax < 0.135) c *= 0.5;   // pocket flaps
}
if(p.y > 1.44 && ! front) c *= 0.88;                                                 // back of the collar
} else if(oc == 3 || oc == 5) {
float q = fract(p.y / 0.07);
c *= 0.7 + 0.3 * smoothstep(0.0, 0.25, q) * smoothstep(1.0, 0.7, q);             // quilting
if(front && ax < 0.005 && p.y > 0.86) c *= 0.4;                                  // zip
}
} else if(R == 1) {
if(tie > 0 && front && p.y < 1.455 && p.y > 1.12 && ax < 0.011 + (1.455 - p.y) * 0.028) {
garmentColor = tieCol(tie) * vAOm;
return;
}
if(oc == 1 || oc == 2 || oc == 4) {
if(p.y > 1.43 && front) c *= 0.85;
garmentColor = c;
return;
}   // shirt under a jacket: plain, collar shade
if(pat == 1) c = mix(c, vec3(0.6, 0.59, 0.56), 0.55 * smoothstep(0.45, 0.6, fract(p.y * 14.0)));
else if(pat == 2) {
float a = smoothstep(0.4, 0.6, fract(p.y * 9.0)), b = smoothstep(0.4, 0.6, fract(p.x * 9.0));
c *= 0.78 + 0.13 * (a + b);
} else if(pat == 3) c *= 0.88 + 0.24 * pvn(p * vec3(45.0, 20.0, 45.0));
else if(pat == 4) {   // (peds r3) bold print (florals / graphic prints): light motif on the base colour
float m = smoothstep(0.6, 0.68, pvn(p * vec3(26.0, 22.0, 26.0) + 3.1)) + 0.6 * smoothstep(0.66, 0.72, pvn(p * vec3(52.0, 44.0, 52.0)));
vec3 c2 = dot(c, vec3(0.33)) > 0.25 ? c * vec3(0.25, 0.3, 0.4) : mix(vec3(0.75, 0.7, 0.6), c.bgr * 3.0 + 0.1, 0.35);
c = mix(c, c2, clamp(m, 0.0, 1.0));
} else if(pat == 5) c = mix(c, vec3(0.74, 0.73, 0.7), step(0.55, fract(p.y * 11.0)) * step(1.0, p.y));   // breton stripe
if(p.y > 1.455 && p.y < 1.49) c *= 0.82;                                          // neckline rib
if(p.y < 1.0 && p.y > 0.975) c *= 0.85;                                           // hem
} else if(R == 2) {
bool denim = c.b > c.r * 1.25 && c.b > 0.012;
if(denim) {
c *= 0.9 + 0.16 * pvn(vec3(p.x * 60.0, p.y * 14.0, p.z * 60.0));
float fade = smoothstep(0.55, 0.78, p.y) * smoothstep(0.93, 0.8, p.y) * step(0.0, p.z);
c = mix(c, c * 1.7 + 0.01, fade * 0.45);
if(abs(ax - 0.1) < 0.004 && front && p.y > 0.5) c *= 1.0;
} else if(front && abs(ax - 0.1) < 0.005 && p.y < 0.84) c *= 1.25;               // trouser crease
if(p.y < 0.14 && p.y > 0.1) c *= 0.8;                                             // cuff
} else if(R == 4) {
          // (peds r1) photo hair strands (atlas 2x2 of 256 at (0.5, 0)): cylindrical about the head axis, 12 cm tiles
float a = atan(p.x, p.z - 0.01);
float hk = vPed.z;
vec2 o = vec2(0.5 + (hk - floor(hk / 2.0) * 2.0) * 0.25, floor(hk / 2.0) * 0.25);
vec3 t = tileTex(vec2(a * 0.09 / 0.12, (1.8 - p.y) / 0.12), o, 0.25) / 0.2158;
c *= mix(vec3(1.0), t, 0.72) * (0.9 + 0.12 * smoothstep(1.6, 1.76, p.y));   // (peds r4) 0.5 -> 0.72 strand contrast
          // (peds r4) critic 'hair painted on, plastic': clumps (dark partings between locks along the fall direction) and
          // darker roots at the crown / nape, lighter sun-bleached ends; reads as locks at 5-15 m
{
float cl = pvn(vec3(a * 7.0, p.y * 3.0, 0.0));
c *= 0.72 + 0.5 * smoothstep(0.25, 0.75, cl);
c *= mix(0.8, 1.0, smoothstep(0.03, 0.09, abs(ax) + max(0.0, - p.z) * 0.4)) * (1.0 + 0.18 * smoothstep(1.62, 1.35, p.y));
}
if(p.y < 1.675 && p.z > 0.07) {
vec4 ft = faceTex(p);
c = mix(c, ft.rgb * vAOm, ft.a);
}   // brows: from the photo
} else if(R == 0 || R == 11 || R == 12 || (R == 7 && p.y > 1.6 && p.z < 0.084)) {
if(p.y > 1.52 && p.z > 0.0) {
vec4 ft = faceTex(p);   // (peds r5) blended edge: toward the rim keep the skin colour and take only the photo's shading (no mask outline)
vec3 ph = ft.rgb * vAOm;
float lp = dot(ph, vec3(0.3, 0.59, 0.11)), lc = dot(c, vec3(0.3, 0.59, 0.11));
vec3 mt = c * clamp(lp / max(lc, 1e-4), 0.6, 1.3);
c = mix(c, mix(mt, ph, smoothstep(0.45, 0.9, ft.a)), ft.a);
}
if(p.y > 1.655) {   // soft hairline: the scalp just under the hair shell edge takes the hair colour
float hl = smoothstep(1.668, 1.688, p.y + (pvn(p * 160.0) - 0.5) * 0.012) * (1.0 - smoothstep(0.075, 0.09, p.z));
c = mix(c, vHairC * 0.9, hl * 0.85);
}
if(R != 0) {
garmentColor = c;
return;
}
c *= 0.96 + 0.08 * pvn(p * 25.0);
if(p.y > 1.45) c *= mix(0.7, 1.0, smoothstep(1.53, 1.572, p.y + max(0.0, p.z) * 0.45));   // under the jaw / neck
if(p.y > 1.5 && p.z < 0.03) { // (citylife r2) face modelling in paint ((peds r1) now only off the photo area) (heads read as smooth mannequin eggs): eye sockets, cheek /
            // nose-tip warmth, shade under the jaw and at the hairline, so the face reads at street distance
float fr = smoothstep(0.03, 0.08, p.z);
vec2 e = vec2(ax - 0.031, p.y - 1.645);
c *= 1.0 - 0.28 * fr * exp(- dot(e * e, vec2(1.0 / 0.0005, 1.0 / 0.00022)));
vec2 k = vec2(ax - 0.047, p.y - 1.605);
c *= mix(vec3(1.0), vec3(1.07, 0.93, 0.9), fr * exp(- dot(k * k, vec2(1.0 / 0.0007, 1.0 / 0.0006))));
c *= mix(vec3(1.0), vec3(1.05, 0.94, 0.92), smoothstep(0.09, 0.1, p.z) * step(p.y, 1.625));
c *= 1.0 - 0.18 * smoothstep(1.7, 1.73, p.y);                                 // hairline shadow
}
}
garmentColor = c;
}
// @section fragmentColor
#include <color_fragment>
vec3 garmentColor;
garment(vCol, garmentColor);
diffuseColor.rgb = garmentColor;
if(gCut || gHairCut) discard;
if(uBakeOn > 0.5) {
gBake = texture(uBake, vBUv);   // (peds r2) baked occlusion replaces the per-vertex AO on base parts
if(vOptF < 0.5) diffuseColor.rgb *= clamp((0.3 + 0.7 * gBake.a) / max(vAOm, 0.3), 0.35, 1.5);
}
// @section fragmentRoughness
#include <roughnessmap_fragment>
roughnessFactor = vRough;
// @section fragmentNormalMaps
#include <normal_fragment_maps>
if(uBakeOn > 0.5) {
vec3 bn = gBake.rgb * 2.0 - 1.0;
float bl = length(bn);   // (peds r2) baked object-space (rest pose) normal, skinned
if(bl > 0.6) {
vec3 nb = normalize(mat3(vB0, vB1, vB2) * (bn / bl));
normal = normalize(mix(normal, nb, smoothstep(- 0.25, 0.35, dot(nb, normal))));
}
}
if(gH != 0.0) normal = bumpN(- vViewPosition, normal, gH);
// @section fragmentEmissive
#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.55, 0.75, 1.0) * vEmis * 0.25;
// @section vertexCommonCrowdSkinningFunctions
#include <common>
__SHADER_INJECT_0__
// @section vertexBeginVertexCrowdBodyPose
vec3 transformed = optHidden() ? vec3(0.0) : (skinMatrix() * vec4(bodyShape(position), 1.0)).xyz;
// @section vertexCommonDogPoseDeclarations
#include <common>
__SHADER_INJECT_0__ in vec2 aRA;
out vec3 vDCol;
out vec3 vDP;
vec3 unpackD(float f) {
float r = floor(f / 65536.0);
float g = floor((f - r * 65536.0) / 256.0);
float b = f - r * 65536.0 - g * 256.0;
vec3 c = vec3(r, g, b) / 255.0;
return c * c;
}
// @section vertexBeginVertexDogPose
vec3 transformed = dogPose(position);
{
int R = int(aRA.x + 0.5);
vec3 fur = unpackD(iD.z);
vec3 c = fur;
if(R == 7) c = vec3(0.012);
else if(R == 6) c = vec3(0.3, 0.03, 0.03);
else if(R == 8) c = mix(fur, vec3(0.6, 0.55, 0.48), 0.5);
vDCol = c * (0.35 + 0.65 * aRA.y / 255.0);
vDP = position;
}
// @section fragmentCommonByDogPosition
#include <common>
in vec3 vDCol;
in vec3 vDP;
float dh(vec3 p) {
p = fract(p * 0.3183099 + 0.1);
p *= 17.0;
return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
// @section fragmentColorByDogPosition
#include <color_fragment>
diffuseColor.rgb = vDCol * (0.9 + 0.2 * dh(floor(vDP * 140.0)));
// @section vertexCommonDogSkinningFunctions
#include <common>
__SHADER_INJECT_0__
// @section vertexBeginVertexDogPoseDepth
vec3 transformed = dogPose(position);

// @section dogPoseFunctions

in vec4 aSI;
in vec4 iD;
vec3 dogPose(vec3 p) {
int part = int(aSI.x + 0.5);
float ph = iD.x, amp = iD.y;
if(part == __SHADER_INJECT_0__ || part == __SHADER_INJECT_1__ || part == __SHADER_INJECT_2__ || part == __SHADER_INJECT_3__) {
vec3 pv = part == __SHADER_INJECT_0__ ? vec3(__SHADER_INJECT_4__) : part == __SHADER_INJECT_1__ ? vec3(__SHADER_INJECT_5__) : part == __SHADER_INJECT_2__ ? vec3(__SHADER_INJECT_6__) : vec3(__SHADER_INJECT_7__);
float o = (part == __SHADER_INJECT_0__ || part == __SHADER_INJECT_3__) ? 0.0 : 3.14159;
float a = sin(ph + o) * 0.5 * amp;
vec3 q = p - pv;
float c = cos(a), s = sin(a);
q = vec3(q.x, c * q.y - s * q.z, s * q.y + c * q.z);
q.y += max(0.0, cos(ph + o)) * 0.03 * amp;          // lift the swinging paw
return pv + q;
}
if(part == __SHADER_INJECT_8__) {
vec3 pv = vec3(__SHADER_INJECT_9__);
vec3 q = p - pv;
float a = sin(iD.w * 9.0) * 0.45;
float c = cos(a), s = sin(a);
q = vec3(c * q.x + s * q.z, q.y, - s * q.x + c * q.z);
return pv + q;
}
p.y += sin(ph * 2.0) * 0.012 * amp;
if(part == __SHADER_INJECT_10__) {
vec3 pv = vec3(__SHADER_INJECT_11__);
vec3 q = p - pv;
float a = sin(iD.w * 0.7) * 0.25 * (1.0 - amp);
float c = cos(a), s = sin(a);
q = vec3(c * q.x + s * q.z, q.y, - s * q.x + c * q.z);
p = pv + q;
}
return p;
}

// @section pedestrianSkinningFunctions

in vec4 aSI;
in vec4 aSW;
in vec3 aRA;   // aRA: region, vertex AO, (peds r2) option bit (16-attribute limit)
in vec4 iA;
in vec4 iB;
in vec4 iX;
in vec4 iM;
    // (peds r3) body type (critic: 'no body-type variety: heavy, short, slim'): girth g = 0.8 + floor(iM.z) / 100 reshapes
    // the rest pose before skinning, per bone group: torso wider / deeper (belly for g > 1), neck thicker, arms pushed
    // out with the shoulders + thicker, legs apart + thicker (fading to the ankles). Head, hair, hat and phone keep
    // their size, so heavy people don't get bobble heads (the old instance x-scale widened the head too)
vec3 bodyShape(vec3 p) {
float d = floor(iM.z) * 0.01 - 0.2;
if(abs(d) < 0.004) return p;
float wT = 0.0, wN = 0.0, wA = 0.0, wL = 0.0, wF = 0.0;
for(int k = 0;
k < 4;
k ++) {
float w = aSW[k];
int b = int(aSI[k] + 0.5);
if(b <= 2) wT += w;
else if(b == 3) wN += w;
else if(b >= 5 && b <= 10) wA += w;
else if(b == 11 || b == 12 || b == 14 || b == 15) wL += w;
else if(b == 13 || b == 16) wF += w;
}
float sx = p.x < 0.0 ? - 1.0 : 1.0;
float bz = p.z + 0.005, belly = exp(- pow((p.y - 1.04) / 0.13, 2.0)) * step(0.0, d);
vec3 t = vec3(p.x * (1.0 + d), p.y, - 0.005 + bz * (1.0 + d * (bz > 0.0 ? 1.0 + 1.4 * belly : 0.6)));
vec3 n = vec3(p.x * (1.0 + 0.6 * d), p.y, p.z * (1.0 + 0.6 * d));
vec3 a = vec3(sx * (0.2 + 0.16 * d) + (p.x - sx * 0.2) * (1.0 + 0.45 * d), p.y, p.z * (1.0 + 0.45 * d));
float kl = smoothstep(0.12, 0.65, p.y);
vec3 l = vec3(sx * (0.097 + 0.075 * d) + (p.x - sx * 0.097) * (1.0 + 0.85 * d * kl), p.y, p.z * (1.0 + 0.85 * d * kl));
vec3 f = vec3(p.x + sx * 0.075 * d, p.y, p.z);
return t * wT + n * wN + a * wA + l * wL + f * wF + p * max(0.0, 1.0 - wT - wN - wA - wL - wF);
}
    // (peds r2) optional parts (hairstyles, hat, glasses, bag, scarf): bit aOpt of the instance mask (iX.w / 512)
bool optHidden() {
return aRA.z > 0.5 && mod(floor(floor(iX.w / 512.0) / aRA.z), 2.0) < 0.5;
}
uniform sampler2D uAnim;
uniform float uTime;
uniform vec3 uNeck;
uniform vec3 uHead;
mat4 bmRow(int row, int b) {
ivec2 c = ivec2(b * 3, row);
vec4 r0 = texelFetch(uAnim, c, 0), r1 = texelFetch(uAnim, c + ivec2(1, 0), 0), r2 = texelFetch(uAnim, c + ivec2(2, 0), 0);
return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
mat4 clipBone(vec4 C, int b) {
float len = C.y;
float fr = mod((uTime - C.w) * C.z * 30.0, len);
if(fr < 0.0) fr += len;
int f0 = int(floor(fr));
int f1 = f0 + 1;
if(float(f1) >= len) f1 = 0;
float t = fract(fr);
int r = int(C.x + 0.5);
return bmRow(r + f0, b) * (1.0 - t) + bmRow(r + f1, b) * t;
}
mat4 lookRot(vec3 p, float yaw, float pitch) {
float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
mat4 Ry = mat4(cy, 0.0, - sy, 0.0, 0.0, 1.0, 0.0, 0.0, sy, 0.0, cy, 0.0, 0.0, 0.0, 0.0, 1.0);
mat4 Rx = mat4(1.0, 0.0, 0.0, 0.0, 0.0, cp, sp, 0.0, 0.0, - sp, cp, 0.0, 0.0, 0.0, 0.0, 1.0);
mat4 T = mat4(1.0);
T[3] = vec4(p, 1.0);
mat4 Ti = mat4(1.0);
Ti[3] = vec4(- p, 1.0);
return T * Ry * Rx * Ti;
}
mat4 boneM(int b, float w) {
mat4 m = clipBone(iA, b);
if(w < 0.999) m = clipBone(iB, b) * (1.0 - w) + m * w;
if(b == 4) m = m * lookRot(uHead, iX.y * 0.6, iX.z * 0.7);
else if(b == 3) m = m * lookRot(uNeck, iX.y * 0.4, iX.z * 0.3);
return m;
}
mat4 skinMatrix() {
float w = clamp((uTime - iX.x) / 0.3, 0.0, 1.0);
mat4 m = boneM(int(aSI.x + 0.5), w) * aSW.x;
if(aSW.y > 0.0) m += boneM(int(aSI.y + 0.5), w) * aSW.y;
if(aSW.z > 0.0) m += boneM(int(aSI.z + 0.5), w) * aSW.z;
if(aSW.w > 0.0) m += boneM(int(aSI.w + 0.5), w) * aSW.w;
return m;
}
