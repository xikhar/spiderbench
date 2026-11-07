// water shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
out vec3 vWPw;
uniform mat4 uTexMat;
out vec4 vRefl;
// @section vertexFogVertex
#include <fog_vertex>
vWPw = (modelMatrix * vec4(transformed, 1.0)).xyz;
vRefl = uTexMat * vec4(vWPw, 1.0);
// @section fragmentCommon
#include <common>
uniform sampler2D tWN;
uniform sampler2D tWNoise;
uniform float uWTime;
in vec3 vWPw;
uniform sampler2D tRefl;
uniform float uReflOn;
in vec4 vRefl;
uniform sampler2D tShore;
uniform vec4 uShoreBox;
vec3 wN;
float wR;
float wDist;
float wSh = 1.0;
vec2 wDisp;
float wSlick;
float wShore;
float wNearS;
float wStreak;
vec2 wn(vec2 uv) {
return texture(tWN, uv).rg * 2.0 - 1.0;
}
vec3 river() {
vec2 p = vWPw.xz;
float dist = length(vWPw - cameraPosition);
wDist = dist;
float t = uWTime;
// broad structure: wind slicks (smooth bands) and current streaks along the rivers (z axis)
vec3 m1 = texture(tWNoise, p / 900.0 + vec2(0.0, t * 0.0015)).rgb;
vec3 m2 = texture(tWNoise, vec2(p.x / 260.0, p.y / 1400.0) + vec2(0.31, t * 0.004)).rgb;
float slick = smoothstep(0.52, 0.72, m1.g) * 0.8 + smoothstep(0.62, 0.8, m2.r) * 0.35;
// distance to the nearest shore (m, baked 8 m/px map): sheltered, silty water along the bulkheads
wShore = 400.0;
#ifdef HAS_SHORE
wShore = texture(tShore, (p - uShoreBox.xy) / uShoreBox.zw).r * 400.0;
#endif
float nearS = 1.0 - smoothstep(6.0, 70.0, wShore);
// cat's paws: gusts roughen large patches (they read as brighter / hazier sheen from the air)
vec3 m3 = texture(tWNoise, p / 520.0 + vec2(t * 0.003, - t * 0.002)).rgb;
float gust = smoothstep(0.45, 0.75, m3.b) * (1.0 - slick);
slick = clamp(slick + nearS * 0.35, 0.0, 1.0);
wSlick = slick;
wNearS = nearS;
// (round 5) wind rows / current streaks: long thin bands along the rivers (z) that break the sheet into
// brighter, rougher lines (the refs' rivers are never one uniform glassy surface)
float s1 = texture(tWNoise, vec2(p.x / 34.0, p.y / 520.0) + vec2(t * 0.0008, t * 0.003)).g;
float s2 = texture(tWNoise, vec2(p.x / 11.0 + p.y / 900.0, p.y / 260.0) + vec2(0.57, t * 0.005)).r;
float streak = smoothstep(0.58, 0.8, s1) * 0.7 + smoothstep(0.66, 0.86, s2) * 0.45;
streak *= (1.0 - 0.7 * nearS);
wStreak = streak;
// wave normals: chop (two directions) + swell, faded with distance and in slicks
// (atmosphere r2) the two broad layers are rotated off-axis and amplitude-modulated by the wind field, so their
// repeat does not read as a tiling ripple across the whole East River from the air
vec2 pr1 = mat2(0.829, - 0.559, 0.559, 0.829) * p, pr2 = mat2(0.438, 0.899, - 0.899, 0.438) * p;
float amp = 0.55 + 0.9 * m3.g;
vec2 n = wn(p / 9.0 + vec2(t * 0.021, t * 0.013)) * 0.55 + wn(vec2(- p.y, p.x) / 14.0 + vec2(t * - 0.012, t * 0.017)) * 0.45 + wn(pr1 / 53.0 + vec2(t * 0.004, - t * 0.006)) * 0.7 * amp + wn(pr2 / 173.0 + vec2(- t * 0.002, t * 0.003)) * 0.5 * (1.5 - amp * 0.7);
float fade = mix(1.0, 0.45, smoothstep(60.0, 2500.0, dist));
n *= 0.34 * fade * (1.0 - 0.55 * slick) * (1.0 + 0.8 * gust + 0.6 * streak);
// (round 8) far-field wave groups: long swell / wind-row undulation that fades IN with distance, where the chop is
// sub-pixel -- the far river breaks into broad mottled sheen bands instead of one flat glossy plate
n += (wn(vec2(p.x / 380.0, p.y / 170.0) + vec2(t * 0.0012, - t * 0.002)) * 0.7 + wn(p / 95.0 + vec2(- t * 0.003, t * 0.002)) * 0.45) * 0.15 * smoothstep(300.0, 1800.0, dist) * (1.0 - 0.5 * slick);
wN = normalize(vec3(n.x, 1.0, n.y));
// mirror distortion: waves smear the reflection vertically (screen space), less in the slicks; (round 5) plus a
// mid-scale ripple field that does NOT fade with distance, so far reflections break into wobbly bands
vec2 rip = wn(vec2(p.x / 26.0, p.y / 7.0) + vec2(t * 0.011, - t * 0.019)) + 0.6 * wn(p / 61.0 + vec2(- t * 0.006, t * 0.009));
wDisp = n * (0.9 - 0.5 * slick) + rip * 0.09 * (1.0 - 0.5 * slick);
// roughness (round 5: ~0.1-0.3 like real wind-blown river water): calm slicks, rougher chop / gusts / streaks,
// far water rougher to integrate sub-pixel waves
wR = clamp(0.09 + 0.08 * (1.0 - slick) + 0.1 * gust + 0.07 * streak + 0.07 * smoothstep(300.0, 5000.0, dist), 0.07, 0.32);
// (round 8) far wind fields: broad rough / glassy patches that stay visible at 1-4 km (hazier vs mirror sheen)
wR = clamp(wR + (texture(tWNoise, p / 1500.0 + vec2(0.13, t * 0.0006)).g - 0.5) * 0.22 * smoothstep(400.0, 1500.0, dist), 0.06, 0.34);
#ifndef NO_SSR
wR = max(wR + 0.05, 0.13); // (atmosphere r2) ponds / reservoir: wind-ruffled, the cloud reflection is never a crisp cubemap
#endif
// body colour: deep muted green-grey, turbid variation; silty olive-brown along the shores, a little deeper /
// bluer mid-channel (depth), current streaks along the rivers
vec3 c = vec3(__SHADER_INJECT_0__);
c *= 0.85 + 0.3 * m1.r;
c = mix(c, vec3(0.07, 0.085, 0.075), smoothstep(0.4, 0.8, m2.b) * 0.5);
c = mix(c, vec3(0.06, 0.066, 0.055), nearS * 0.55);
c = mix(c, c * vec3(0.8, 0.9, 1.05), smoothstep(150.0, 400.0, wShore));
c *= 1.0 + 0.25 * streak;
// (round 7) wash line: a broken pale band of churned water / flotsam hugging bulkheads and pier edges, and a
// brown-olive silt plume a little further out (the rivers change colour toward every shore)
#ifdef HAS_SHORE
{
float fn = texture(tWNoise, p / 23.0 + vec2(t * 0.002, - t * 0.003)).g, fn2 = texture(tWNoise, p / 6.0 + vec2(- t * 0.004, t * 0.002)).b;
float wash = (1.0 - smoothstep(1.0, 9.0 + 6.0 * fn, wShore)) * smoothstep(0.35, 0.65, fn * 0.6 + fn2 * 0.6);
c = mix(c, vec3(0.2, 0.205, 0.19), wash * 0.55);
float silt = (1.0 - smoothstep(10.0, 120.0, wShore)) * (0.55 + 0.45 * fn);
c = mix(c, vec3(0.085, 0.08, 0.058), silt * 0.4);
}
#endif
return c;
}
// @section fragmentMap
diffuseColor.rgb = river();
// @section fragmentRoughness
float roughnessFactor = wR;
// @section fragmentNormalMaps
normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
// @section fragmentLightsBegin
__SHADER_INJECT_0__
// (round 7) sun glitter: sparse sub-pixel facets on a finer, faster chop catch the sun (a sparkling glint path
// toward the sun instead of one smooth lobe); fades with distance into the broad specular sheen
#if ( NUM_DIR_LIGHTS > 0 )
{
vec2 gp = vWPw.xz;
vec2 gn = wn(gp / 2.3 + vec2(uWTime * 0.05, uWTime * 0.034)) + 0.8 * wn(vec2(- gp.y, gp.x) / 3.7 + vec2(- uWTime * 0.041, uWTime * 0.02));
vec3 nG = normalize(wN + vec3(gn.x, 0.0, gn.y) * 0.22 * (1.0 - 0.6 * wSlick));
vec3 nGv = normalize((viewMatrix * vec4(nG, 0.0)).xyz);
vec3 Hh = normalize(directLight.direction + geometryViewDir);
float gl = pow(clamp(dot(nGv, Hh), 0.0, 1.0), 700.0);
float spark = smoothstep(0.62, 0.9, texture(tWNoise, gp / 5.0 + vec2(uWTime * 0.02, 0.0)).r);
float gfade = 1.0 - smoothstep(900.0, 4000.0, wDist);
reflectedLight.directSpecular += directLight.color * gl * spark * gfade * 14.0 * wSh;
}
#endif
// @section fragmentLightsMaps
#include <lights_fragment_maps>
// (atmosphere r2) sky reflection: the env map's lowest ~6 deg hold a generic city band (for the towers' IBL);
// open water at grazing angles must mirror the horizon SKY instead (critic: 'flat grey sheet, no fresnel sky
// gradient'). Re-fetch the env with the reflection lifted above that band; the planar mirror adds the real
// skyline on top. Grazing view -> brighter, paler horizon sky; looking down -> deep body colour + zenith blue.
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
{
vec3 rvW = transformDirectionByInverseViewMatrix(reflect(- geometryViewDir, normal), viewMatrix);
rvW.y = abs(rvW.y) * 0.8 + 0.1;
radiance = textureCubeUV(envMap, envMapRotation * normalize(rvW), material.roughness).rgb * envMapIntensity;
radiance *= mix(0.3, 1.0, ambData.bounce.w); // (night) the night sky mirror stays dim: dark water with the city's light streaks (critic r2: rivers brighter than the city)
}
#endif
if(uReflOn > 0.5 && vRefl.w > 0.0) {
vec2 ruv = vRefl.xy / vRefl.w;
// (round 4) ripple distortion that survives distance (sheared horizontally by the chop) + a vertical smear:
// real river reflections are stretched / broken toward the viewer, never a crisp mirror
vec2 d = vec2(wDisp.x * 0.7, wDisp.y * 1.6) * 0.22 / (1.0 + wDist * 0.00025);
float spread = (0.004 + 0.034 * wR) * (1.0 - 0.5 * wSlick);
float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
vec4 pr = vec4(0.0);
for(int k = 0;
k < 8;
k ++) {
float o = (float(k) + jit) / 8.0 - 0.35;
// The reflection target has no mip chain; explicit LOD avoids undefined implicit derivatives inside this loop.
pr += textureLod(tRefl, ruv + d * (1.0 + 0.12 * float(k)) + vec2(o * spread * 0.25, o * spread), 0.0);
}
pr /= 8.0;
vec2 e = smoothstep(0.0, 0.03, ruv) * smoothstep(1.0, 0.97, ruv);
// the mirror render has no aerial perspective: haze it toward the sky radiance with distance (round 5: faster,
// so far reflections are soft ghosts, never a crisp second skyline)
vec3 mir = mix(pr.rgb, radiance, 0.28 + 0.52 * smoothstep(200.0, 3500.0, wDist));
// rough water (gusts / streaks) scatters the image: the mirror gives way to the blurred sky IBL
float mw = mix(0.7, 0.9, wSlick) * mix(1.0, 0.5, smoothstep(0.12, 0.3, wR)) * (1.0 - 0.3 * wNearS);
radiance = mix(radiance, mir, clamp(pr.a, 0.0, 1.0) * e.x * e.y * mw);
}
// a weaker sky mirror: the refs' rivers read as a deep grey-blue body, not a white sheet; wind rows catch a
// little more sheen
radiance *= (0.8 + 0.12 * wStreak); // (atmosphere r2) no far dimming: fresnel brightening toward the horizon
// (atmosphere r1) critic: 'river reads flat'. Wind fields modulate the sky sheen at every distance: glassy slicks
// mirror more of the (bright) sky, gust / ruffled patches scatter it into a duller, bluer grey -> visible large-
// scale mottling and streaks like the refs' Hudson / East River, instead of one even grey-blue sheet
radiance *= mix(0.82, 1.22, wSlick) * (1.0 + 0.18 * wStreak) * mix(1.0, 0.86, smoothstep(0.14, 0.3, wR));
// @section vertexCommonByWetSurfaceUv
#include <common>
out vec2 vWetUv;
// @section vertexUvVertex
#include <uv_vertex>
vWetUv = uv;
// @section fragmentCommonByWetSurfaceUv
#include <common>
uniform sampler2D tWetN;
in vec2 vWetUv;
// @section fragmentMapByWetSurfaceUv
{
float u = vWetUv.x, y = vWetUv.y;
vec3 nz = texture(tWetN, vec2(u / 9.0, 0.37)).rgb, nz2 = texture(tWetN, vec2(u / 2.1, y * 0.4 + 0.1)).rgb;
float top = 0.45 + 0.35 * nz.r + 0.15 * nz2.g;            // ragged high-water line
float a = 1.0 - smoothstep(top - 0.12, top + 0.04, y);
float algae = 1.0 - smoothstep(0.1, 0.35, y);              // green-black slime right at the water line
vec3 c = mix(vec3(0.07, 0.065, 0.055), vec3(0.04, 0.06, 0.035), algae);
c *= 0.8 + 0.4 * nz2.b;
// streaks running down from the high-water line
a = max(a, (1.0 - smoothstep(0.0, 0.9, y)) * smoothstep(0.62, 0.8, texture(tWetN, vec2(u / 0.9, 0.71)).r) * 0.6);
diffuseColor = vec4(c, a * 0.88);
}
