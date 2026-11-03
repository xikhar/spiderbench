precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uSunEl;
uniform float uMie;
uniform float uViewH;
uniform float uMS;
uniform vec3 uGroundAlbedo;
__SHADER_INJECT_0__ vec3 extinctionAt(float h, out vec3 scatR, out float scatM) {
float dr = exp(- h / 8.0), dm = exp(- h / 1.2) * uMie, dO = max(0.0, 1.0 - abs(h - 25.0) / 15.0);
scatR = BETA_R * dr;
scatM = BETA_MS * dm;
return BETA_R * dr + BETA_ME * dm + BETA_O * dO;
}
vec3 sunT(vec3 p, vec3 s) {
if(raySphere(p, s, RG).x > 0.0) return vec3(0.0);
float t = raySphere(p, s, RT).y;
float dt = t / 12.0;
vec3 od = vec3(0.0);
vec3 a;
float b;
for(int i = 0;
i < 12;
i ++) {
vec3 q = p + s * (float(i) + 0.5) * dt;
od += extinctionAt(length(q) - RG, a, b) * dt;
}
return exp(- od);
}
void main() {
float az = vUv.x * PI_;
float v = vUv.y * 2.0 - 1.0;
float el = sign(v) * v * v * PI_ * 0.5;
vec3 rd = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
vec3 sd = vec3(cos(uSunEl), sin(uSunEl), 0.0);
vec3 ro = vec3(0.0, RG + uViewH, 0.0);
float tTop = raySphere(ro, rd, RT).y;
vec2 tg = raySphere(ro, rd, RG);
bool ground = tg.x > 0.0;
float tMax = ground ? tg.x : tTop;
float mu = dot(rd, sd);
float pR = phaseR(mu), pM = phaseCS(mu, 0.8);
const int N = 40;
vec3 L = vec3(0.0), T = vec3(1.0);
float tPrev = 0.0;
for(int i = 0;
i < N;
i ++) {
float f = (float(i) + 1.0) / float(N);
float t = tMax * f * f;
float dt = t - tPrev;
float tm = (t + tPrev) * 0.5;
tPrev = t;
vec3 p = ro + rd * tm;
float h = length(p) - RG;
vec3 sR;
float sM;
vec3 ext = extinctionAt(h, sR, sM);
vec3 st = sunT(p, sd);
vec3 S = st * (sR * pR + sM * pM) + (sR + vec3(sM)) * uMS * (0.25 / PI_) * (0.2 + 0.8 * st);
vec3 Te = exp(- ext * dt);
L += T * S * (1.0 - Te) / max(ext, 1e-7);
T *= Te;
}
if(ground) {
vec3 p = ro + rd * tMax;
vec3 n = normalize(p);
vec3 st = sunT(p, sd);
L += T * uGroundAlbedo / PI_ * (st * max(dot(n, sd), 0.0) + 0.25);
}
fragColor = vec4(L, 1.0);
}