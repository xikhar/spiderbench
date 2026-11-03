
precision highp float; in vec2 vUv; out vec4 fragColor;
uniform sampler2D uDepth, uScene, uPrev; uniform mat4 uProj, uCamWorld, uPrevViewProj; uniform vec2 uRes;
uniform float uFrame, uEnvI, uHavePrev, uMaxDist, uFloor;
__SHADER_INJECT_0__
#define saturate(a) clamp(a, 0.0, 1.0)
uniform sampler2D envMap;
__SHADER_INJECT_1__
float linZ(vec2 uv) { float d = textureLod(uDepth, uv, 0.0).r; return isSky(d) ? 1e7 : -viewPosFromDepth(uv, d).z; }
vec3 vpos(vec2 uv) { return viewPosFromDepth(uv, texture(uDepth, uv).r); }
void main() {
  // pick one full-res pixel of the 2x2 block (rotating per frame; TAA integrates the rest)
  vec2 px = 1.0 / uRes;
  int k = int(uFrame) & 3;
  vec2 fp = floor(vUv * uRes * 0.5) * 2.0 + vec2(float(k & 1), float(k >> 1)) + 0.5;
  vec2 uv = fp * px;
  float w = texture(uScene, uv).a - 1.0;
  float d0 = texture(uDepth, uv).r;
  if (w < 0.01 || isSky(d0)) { fragColor = vec4(0.0); return; }
  vec3 P = viewPosFromDepth(uv, d0);
  // normal from depth: pick the smaller-difference neighbours on each axis (robust at silhouettes)
  vec3 pr = vpos(uv + vec2(px.x, 0.0)), pl = vpos(uv - vec2(px.x, 0.0));
  vec3 pu = vpos(uv + vec2(0.0, px.y)), pd = vpos(uv - vec2(0.0, px.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));
  vec3 V = normalize(P);
  if (dot(N, V) > 0.0) N = -N;
  vec3 R = reflect(V, N);
  vec3 Rw = normalize((uCamWorld * vec4(R, 0.0)).xyz);
  vec3 env = textureCubeUV(envMap, Rw, 0.04).rgb * uEnvI;
  // --- screen-space march (perspective-correct via 1/z interpolation)
  float len = uMaxDist;
  if (R.z > 0.0) len = min(len, (-P.z - 0.12) / R.z * 0.98); // don't cross the near plane
  vec3 E = P + R * len;
  vec4 h0 = uProj * vec4(P, 1.0), h1 = uProj * vec4(E, 1.0);
  float k0 = 1.0 / h0.w, k1 = 1.0 / h1.w;
  vec2 s0 = h0.xy * k0 * 0.5 + 0.5, s1 = h1.xy * k1 * 0.5 + 0.5;
  // clip the screen segment to the viewport
  vec2 dS = s1 - s0; float tMax = 1.0;
  if (s1.x > 1.0) tMax = min(tMax, (1.0 - s0.x) / dS.x); if (s1.x < 0.0) tMax = min(tMax, -s0.x / dS.x);
  if (s1.y > 1.0) tMax = min(tMax, (1.0 - s0.y) / dS.y); if (s1.y < 0.0) tMax = min(tMax, -s0.y / dS.y);
  float jit = ign(gl_FragCoord.xy + uFrame * 5.588);
  float hitT = -1.0; float tPrev = 0.0;
  // nonlinear step distribution (denser near the start)
  for (int i = 1; i <= STEPS; i++) {
    float f = (float(i) - 0.5 + jit) / float(STEPS);
    float t = tMax * f * f;
    vec2 s = s0 + dS * t;
    float rz = 1.0 / mix(k0, k1, t);        // ray view depth (positive)
    float sz = linZ(s);
    float dz = rz - sz;
    float thick = max(0.35, rz * 0.035) + abs(rz - 1.0 / mix(k0, k1, tPrev));
    if (dz > 0.02 && dz < thick) { hitT = t; break; }
    tPrev = t;
  }
  if (hitT < 0.0 || uHavePrev < 0.5) { fragColor = vec4(0.0); return; }
  // binary refinement
  float a = tPrev, b = hitT;
  for (int i = 0; i < 5; i++) {
    float m = 0.5 * (a + b); vec2 s = s0 + dS * m;
    float rz = 1.0 / mix(k0, k1, m);
    if (rz > linZ(s)) b = m; else a = m;
  }
  vec2 hs = s0 + dS * b;
  vec3 hv = vpos(hs);
  // --- hit validation
  float rzH = 1.0 / mix(k0, k1, b);
  if (abs(rzH - (-hv.z)) > max(0.35, rzH * 0.03)) { fragColor = vec4(0.0); return; }         // thickness at refined hit
  if (abs(dot(hv - P, N)) < 0.25 + 0.01 * length(hv - P)) { fragColor = vec4(0.0); return; } // self-plane (grazing streaks)
  vec2 hp = 1.0 / uRes;
  vec3 hx = vpos(hs + vec2(hp.x, 0.0)) - hv, hy = vpos(hs + vec2(0.0, hp.y)) - hv;
  vec3 NH = normalize(cross(hx, hy)); if (dot(NH, hv) > 0.0) NH = -NH;
  float facing = clamp(-dot(NH, R) * 4.0, 0.0, 1.0);                                         // back-facing hits invalid
  vec3 hw = (uCamWorld * vec4(hv, 1.0)).xyz;
  vec4 pc = uPrevViewProj * vec4(hw, 1.0);
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
  if (pc.w <= 0.0 || any(lessThan(puv, vec2(0.002))) || any(greaterThan(puv, vec2(0.998)))) { fragColor = vec4(0.0); return; }
  if (length((puv - hs) * uRes) > 0.08 * uRes.x) { fragColor = vec4(0.0); return; }           // implausible reprojection
  vec3 hit = texture(uPrev, puv).rgb;
  // firefly / blow-out guard: never more than a few times brighter than the env reflection it replaces
  float le = dot(env, vec3(0.2126, 0.7152, 0.0722)), lh = dot(hit, vec3(0.2126, 0.7152, 0.0722));
  hit *= min(1.0, (le * 3.0 + uFloor) / max(lh, 1e-4)); // (night r12) uFloor 0.5 by day, ~0.06 at night: half-res mirrored headlights / lamps were bright blocky patches on the wet road (the city-light specular already draws their real reflection)
  // confidence: screen edges, rays toward the camera, grazing incidence (depth normals unreliable), distance
  vec2 e = smoothstep(0.0, 0.1, hs) * smoothstep(1.0, 0.9, hs);
  float graze = smoothstep(0.02, 0.12, -dot(V, N));
  float conf = e.x * e.y * smoothstep(0.7, 0.2, R.z) * facing * graze * (1.0 - smoothstep(0.6, 1.0, b / max(tMax, 1e-4)) * step(0.999, tMax));
  fragColor = vec4((hit - env) * conf, conf);
}