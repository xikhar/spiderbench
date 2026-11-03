in float vT;
in vec3 vW;

uniform float uTime;
out vec4 fragColor;

#include <fog_pars_fragment>

float hash2D(vec2 position) {
  return fract(sin(dot(position, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 position) {
  vec2 gridCell = floor(position);
  vec2 cellBlend = fract(position);
  cellBlend = cellBlend * cellBlend * (3.0 - 2.0 * cellBlend);

  return mix(mix(hash2D(gridCell), hash2D(gridCell + vec2(1.0, 0.0)), cellBlend.x), mix(hash2D(gridCell + vec2(0.0, 1.0)), hash2D(gridCell + vec2(1.0, 1.0)), cellBlend.x), cellBlend.y);
}

void main() {
  vec3 viewDirection = normalize(cameraPosition - vW);
  float grazingAngle = 1.0 - clamp(viewDirection.y, 0.0, 1.0);
  float shorelineNoise = valueNoise(vW.xz * 0.18) * 0.6 + valueNoise(vW.xz * 0.7) * 0.4;

  // The reflected tree line has a bumpy inner edge and extends farther at grazing angles.
  float treeCrowns = valueNoise(vec2(vW.x + vW.z, vW.z - vW.x) * 0.14) * 0.6 +
    valueNoise(vW.xz * 0.45) * 0.4;
  float reflectionReach = mix(0.6, 0.95, grazingAngle) * (0.65 + 0.55 * treeCrowns);
  float shorelinePosition = clamp(vT + (shorelineNoise - 0.5) * 0.18, 0.0, 1.0);
  float treeReflectionBand = 1.0 - smoothstep(reflectionReach - 0.12, reflectionReach + 0.05, shorelinePosition);

  // Wind adds sky-reflecting patches and fine streaks to the water surface.
  vec2 windDirection = vec2(0.8, 0.6);
  vec2 windPosition = vec2(dot(vW.xz, windDirection), dot(vW.xz, vec2(-windDirection.y, windDirection.x)));
  float windPatches = smoothstep(0.45, 0.8, valueNoise(windPosition * vec2(0.02, 0.035) + uTime * 0.01) * 0.7 +
    valueNoise(windPosition * 0.09) * 0.3);
  float windStreaks = valueNoise(vec2(windPosition.x * 0.03, windPosition.y * 0.6));
  float rippleNoise = valueNoise(windPosition * vec2(0.9, 2.2) + vec2(uTime * 0.4, 0.0));

  vec3 skyColor = mix(vec3(0.44, 0.52, 0.6), vec3(0.72, 0.76, 0.8), grazingAngle);
  vec3 deepWaterColor = vec3(0.035, 0.05, 0.045);

  // From above, show mostly dark water; reflections strengthen toward the horizon.
  float fresnelWeight = 0.12 + 0.88 * pow(grazingAngle, 3.0);
  float fineRipples = valueNoise(windPosition * vec2(0.35, 1.3) - vec2(uTime * 0.25, 0.0)) *
    valueNoise(windPosition * vec2(1.7, 4.1) + vec2(uTime * 0.6, 0.0));
  vec3 color = mix(deepWaterColor, skyColor, clamp((0.18 + 0.45 * windPatches + 0.2 * windStreaks + 0.25 * fineRipples) *
    mix(0.55, 1.0, fresnelWeight), 0.0, 1.0));
  float opacity = clamp((0.34 + 0.24 * windPatches + 0.14 * abs(windStreaks - 0.5) +
    0.12 * fineRipples) * mix(1.0, 0.7, fresnelWeight), 0.0, 0.8);

  // Layer a reflected sky gradient and broad ripples over the teal water body.
  {
    vec3 zenithSkyColor = vec3(0.26, 0.36, 0.48);
    vec3 horizonSkyColor = vec3(0.6, 0.66, 0.7);
    vec3 reflectedSky = mix(zenithSkyColor, horizonSkyColor, pow(grazingAngle, 1.6));
    float cloudiness = smoothstep(0.35, 0.85, valueNoise(vW.xz * 0.006 + vec2(uTime * 0.002, 0.0)) * 0.7 +
      valueNoise(vW.xz * 0.02) * 0.3);
    reflectedSky = mix(reflectedSky, vec3(0.7, 0.72, 0.74), cloudiness * 0.45);

    float broadRipples = valueNoise(windPosition * vec2(0.05, 0.18) + vec2(uTime * 0.05, 0.0)) *
      0.5 +
      valueNoise(windPosition * vec2(0.16, 0.55) - vec2(uTime * 0.12, 0.0)) *
      0.3 +
      fineRipples * 0.4;
    vec3 waterBodyColor = vec3(0.045, 0.068, 0.07) *
      (0.9 + 0.25 * valueNoise(vW.xz * 0.03));
    float reflectedSkyWeight = clamp(0.1 + 0.8 * pow(grazingAngle, 2.4) + 0.22 * (broadRipples - 0.45) +
      0.2 * windPatches, 0.04, 0.95);
    vec3 layeredWaterColor = mix(waterBodyColor, reflectedSky, reflectedSkyWeight);

    color = mix(color, layeredWaterColor, 0.75);
    opacity = max(opacity, mix(0.62, 0.85, grazingAngle));
  }

  // Dark olive and umber tones form the reflection of the tree line.
  vec3 treeColor = mix(vec3(0.028, 0.036, 0.018), vec3(0.07, 0.058, 0.03), treeCrowns) * (0.85 + 0.3 * rippleNoise);
  color = mix(color, treeColor, treeReflectionBand);
  opacity = mix(opacity, 0.9, treeReflectionBand);

  // A silty shelf fades into the water, followed by a thin wet-stone lip and foam.
  float shallowShelf = 1.0 - smoothstep(0.0, 0.16 + 0.08 * shorelineNoise, vT);
  color = mix(color, vec3(0.11, 0.1, 0.066) * (0.85 + 0.3 * shorelineNoise), shallowShelf * mix(0.7, 0.25, grazingAngle));
  float shorelineFoam = (1.0 - smoothstep(0.0, 0.03, vT)) *
    smoothstep(0.45, 0.7, valueNoise(vW.xz * 0.9 + uTime * 0.05));
  color = mix(vec3(0.07, 0.065, 0.052), color, smoothstep(0.0, 0.035, vT));
  color = mix(color, vec3(0.34, 0.35, 0.33), shorelineFoam * 0.55);
  opacity = max(opacity, (1.0 - smoothstep(0.0, 0.035, vT)) * 0.8);

  fragColor = vec4(color, opacity);

  #ifdef USE_FOG
    #ifdef FOG_EXP2
  float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
  fragColor.rgb = mix(fragColor.rgb, fogColor, fogFactor);
  #endif
}
