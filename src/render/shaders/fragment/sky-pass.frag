precision highp float;
precision highp sampler3D;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uDepth;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform vec2 uFullRes;
uniform float uStars;
__SHADER_INJECT_0__ __SHADER_INJECT_1__ __SHADER_INJECT_2__ vec3 starField(vec3 d) {
  // cube-ish cell hashing on the direction; each cell holds at most one star (smooth gaussian so TAA is stable)
vec3 p = d * 260.0;
vec3 id = floor(p);
vec3 f = fract(p) - 0.5;
float h = hash11(dot(id, vec3(1.0, 57.0, 113.0)));
if(h < 0.93) return vec3(0.0);
vec3 o = vec3(hash11(h * 91.3), hash11(h * 17.9), hash11(h * 43.1)) - 0.5;
float r = length(f - o * 0.6);
float b = exp(- r * r * 90.0) * pow((h - 0.93) / 0.07, 3.0);
return mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash11(h * 7.7)) * b * 0.9;
}
void main() {
  // skip texels whose 2x2 (+1 ring) full-res footprint contains no sky
vec2 px = 1.0 / uFullRes;
bool any = false;
for(int y = 0;
y < 4;
y ++) for(int x = 0;
x < 4;
x ++) {
float d = textureLod(uDepth, vUv + (vec2(x, y) - 1.5) * px, 0.0).r;
any = any || isSky(d);
}
if(! any) {
fragColor = vec4(0.0, 0.0, 0.0, 1.0);
return;
}
vec3 vd = viewDirFromUv(vUv);
vec3 dir = normalize((uCamWorld * vec4(vd, 0.0)).xyz);
vec3 sky = skyLUT(dir);
float top = skylineTop(dir);
float el = asin(clamp(dir.y, - 1.0, 1.0));
if(top > 0.0 && el < top) {
fragColor = vec4(skylineColor(dir, top, 0.75, uFacadeAlb), 0.0);
return;
}
  // (foundation agent) skyline off (city world has real geometry to the horizon): the thin sliver between the
  // geometric horizon and the far edge of the world takes the same horizon radiance the fog converges to
if(el < 0.0) {
fragColor = vec4(skyLUT(normalize(vec3(dir.x, 0.012, dir.z))), 1.0);
return;
}
// Keep the raymarch sample anchored to the pixel. Animated jitter made the cloud detail shimmer between frames.
float j = ign(gl_FragCoord.xy);
if(uStars > 0.0) sky += starField(dir) * uStars * smoothstep(0.0, 0.15, dir.y);
vec4 ci = cirrusLayer(uCamPos, dir);
sky = sky * ci.a + ci.rgb;
vec4 cl = marchClouds(uCamPos, dir, j);
  // (foundation agent) clouds dissolve into the horizon haze: at grazing angles they are tens of km away, so their
  // aerial perspective converges on the clear-sky horizon radiance the fogged far land also converges to -> no seam
  // (atmosphere r1: marchClouds now does the aerial perspective itself; only the last half degree fades)
float hz = smoothstep(0.0, 0.012, dir.y);
fragColor = vec4(mix(sky, sky * cl.a + cl.rgb, hz), mix(1.0, cl.a * ci.a, hz));
}
