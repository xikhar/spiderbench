
precision highp float; precision highp sampler2DShadow; in vec2 vUv; out vec4 fragColor;
uniform sampler2D uDepth; uniform mat4 uCamWorld; uniform vec3 uCamPos, uCamFwd; uniform vec2 uRes; uniform float uFrame;
uniform sampler2DShadow uSM0, uSM1, uSM2, uSM3; uniform mat4 uSMat[4]; uniform vec4 uSplits;
uniform float uDensity, uHeightFall, uMaxT, uStrength;
__SHADER_INJECT_0__
__SHADER_INJECT_1__
float vis(vec3 p, float vz) {
  vec4 sc;
  if (vz < uSplits.x) { sc = uSMat[0] * vec4(p, 1.0); return texture(uSM0, sc.xyz); }
#if NC > 1
  if (vz < uSplits.y) { sc = uSMat[1] * vec4(p, 1.0); return texture(uSM1, sc.xyz); }
#endif
#if NC > 2
  if (vz < uSplits.z) { sc = uSMat[2] * vec4(p, 1.0); return texture(uSM2, sc.xyz); }
#endif
#if NC > 3
  sc = uSMat[3] * vec4(p, 1.0);
  if (all(greaterThan(sc.xyz, vec3(0.0))) && all(lessThan(sc.xyz, vec3(1.0)))) return texture(uSM3, sc.xyz);
#endif
  return 1.0;
}
void main() {
  // nearest-depth of the 2x2 footprint keeps foreground silhouettes clean for the bilateral upsample
  vec2 px = 1.0 / uRes;
  float d = texture(uDepth, vUv).r;
  vec3 vd = viewDirFromUv(vUv);
  vec3 dir = normalize((uCamWorld * vec4(vd, 0.0)).xyz);
  float dist = isSky(d) ? 1e5 : length(viewPosFromDepth(vUv, d));
  float tEnd = min(dist, uMaxT);
  float cosF = max(dot(dir, uCamFwd), 1e-3);
  float jit = ign(gl_FragCoord.xy + uFrame * 7.137);
  float mu = dot(dir, uSunDir);
  float ph = phaseHG(mu, 0.62) * 0.8 + phaseHG(mu, -0.2) * 0.2;
  float acc = 0.0; float od = 0.0;
  float dt = tEnd / float(STEPS);
  for (int i = 0; i < STEPS; i++) {
    float t = (float(i) + jit) * dt;
    vec3 p = uCamPos + dir * t;
    float sig = uDensity * exp(-max(p.y, 0.0) * uHeightFall);
    float v = vis(p, t * cosF);
    acc += v * sig * exp(-od) * dt;
    od += sig * dt;
  }
  vec3 L = uSunColor * ph * acc * uStrength;
  fragColor = vec4(L, isSky(d) ? 1e5 : dist);
}