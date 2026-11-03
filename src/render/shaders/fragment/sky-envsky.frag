
precision highp float; precision highp sampler3D;
in vec3 vDir; out vec4 fragColor;
uniform vec3 uCamPos; uniform vec3 uGround; uniform float uEnvSat; uniform vec3 uEnvFacade;
__SHADER_INJECT_0__
__SHADER_INJECT_1__
void main() {
  vec3 dir = normalize(vDir);
  vec3 horizon = skyLUT(normalize(vec3(dir.x, 0.02, dir.z)));
  float el = asin(clamp(dir.y, -1.0, 1.0));
  vec3 c;
  float top = skylineTop(dir) * 1.8 + 0.02;
  if (el < top) {
    // city: facades near horizon, ground below
    vec3 fac = skylineColor(dir, top, 0.35, uEnvFacade);
    float gl = 1.0 - smoothstep(-0.5, -0.05, el);
    vec3 zen = skyLUT(vec3(0.0, 1.0, 0.0));
    vec3 E = uSunColor * max(uSunDir.y, 0.0) * 0.55 + zen * PI_ * 0.5;
    vec3 ground = uGround * E / PI_;
    c = mix(fac, ground, gl) * 0.68; // (lighting2 r4, vehicles agent) darker city / ground under a bright sky: glossy paint, glass and wet streets show a readable reflected horizon line
  } else {
    vec3 sky = skyLUT(dir);
    vec4 ci = cirrusLayer(uCamPos, dir);
    vec4 cl = marchClouds(uCamPos, dir, 0.5);
    c = (sky * ci.a + ci.rgb) * cl.a + cl.rgb;
  }
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  fragColor = vec4(mix(vec3(l), c, uEnvSat), 1.0);
}