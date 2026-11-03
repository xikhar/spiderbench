// @ts-nocheck
import __shaderRaw1 from "./shaders/glsl/surface-wet.glsl?raw";
import __shaderRaw2 from "./shaders/glsl/surface-add.glsl?raw";
import __shaderRaw3 from "./shaders/glsl/surface-glsl-3.glsl?raw";
import __shaderRaw4 from "./shaders/glsl/surface-glsl-4.glsl?raw";
import { injectShader } from "./shader.ts";
// OWNER: render agent.
// Global shader-chunk extension that encodes a per-pixel "screen-space reflection weight" into the ALPHA channel
// of the HDR scene target (no extra G-buffer / MRT needed):
//     alpha = 1 + w,   w = luminance of the split-sum specular reflectance (F0/F90 * DFG) of the surface,
//                      faded out for rough surfaces (SSR only applies to smooth glass, car paint, polished stone).
// Every opaque MeshStandardMaterial / MeshPhysicalMaterial (incl. onBeforeCompile-extended city materials) gets it
// automatically. Materials that already do their own reflections can opt out with `material.defines.NO_SSR = ''`.
// Non-standard materials (Basic / Lambert / custom ShaderMaterials) keep alpha = 1 -> no SSR.
//
// It also grades the diffuse IBL irradiance (getIBLIrradiance) so the environment map can stay a faithful,
// saturated sky for REFLECTIONS while the ambient fill of diffuse surfaces is controlled separately:
//     irradiance' = mix(luma, irr, sat) * tint + bounce * (0.5 - 0.5 * n.y)^1.5-ish   (GI approximation:
//     warm light bounced from the sunlit street and facades onto down/side-facing surfaces)
// Parameters live in the shared `ambShared` object (lighting.js updates it per time of day).
import * as THREE from "three";
import {
  avenues,
  G,
  WIDE_ROADS,
  NARROW_STREETS,
  WIDE_ST_HALF,
  NARROW_ST_HALF,
  VREG,
  FREG,
} from "../world/layout.ts"; // (zfix) kerb-gutter puddles

export const ambShared = {
  grade: new THREE.Vector4(1, 1, 1, 0.6), // rgb: ambient tint, w: ambient saturation
  bounce: new THREE.Vector4(0, 0, 0, 1), // rgb: bounce irradiance (already x PI), w: daylight factor (1 day .. ~0 night)
  vert: new THREE.Vector4(1, 1, 0, 0), // (lighting2 r6) x: sky-fill gain on VERTICAL / side-facing surfaces (facades, cars, props, trees in shade), y: street-bounce gain on them
  wx: new THREE.Vector4(0, 0, 0, 1), // (lighting2 r3) weather: x wet amount (overcast rain: whole city wet + puddles), y clock (s), z rain intensity, w dry-weather puddles on/off (user r-nopuddles, Settings)
  cgrid: new THREE.Vector4(0, 0, 512, 0), // (night) city-light grid (citylights.js): xy origin (world x, z), z span, w on
  city: new THREE.Vector4(0, 0, 0, 0), // (lighting2 r3) night city light: rgb sodium street-light irradiance (x PI) near the ground, w: Times Square screen spill
  shape: new THREE.Vector4(0.25, 1, 0, 0), // w: (atmosphere r3) extra street-level bounce near the ground (x(1+w) at y=0, fades over ~26 m)  // x: bounce weight on up-facing surfaces (street canyon inter-reflection), y: skylight weight on up-facing,
  // z: (atmosphere r2) diffuse-only IBL gain (0 = 1): sky fill decoupled from the specular sky reflections
};

let _installed = false;
export function installSurfaceChunks(quality = {}) {
  if (_installed) return;
  _installed = true;
  const SC = THREE.ShaderChunk;
  // (lighting2 r1) wet patches: world-anchored puddle mask on flat, up-facing, low-chroma (asphalt / concrete / tar roof)
  // surfaces of every lit standard material -> near-mirror roughness + darker wet albedo, so SSR + the env map show sharp
  // sky / sun / building reflections in patches (rooftop golden-hour ref). Grass, foliage, paint and the character
  // (skinned) are excluded. ?q=low or ?nowet turns it off.
  let wetOn = quality.wet !== false;
  try {
    if (new URLSearchParams(location.search).has("nowet")) wetOn = false;
  } catch (e) {
    /* non-browser */
  }
  let oldPud = false;
  try {
    oldPud = new URLSearchParams(location.search).has("oldpuddles");
  } catch (e) {
    /* non-browser */
  } // (zfix) puddle A/B
  const wet = injectShader(
    __shaderRaw1,
    oldPud ? "0.0" : "1.0",
    FREG.z0.toFixed(1),
    VREG.x0.toFixed(1),
    VREG.x1.toFixed(1),
    VREG.z0.toFixed(1),
    VREG.z1.toFixed(1),
    avenues
      .map(
        (a) =>
          `dk = min( dk, ${G.AV_HALF.toFixed(2)} - abs( wetP.x - ${a.toFixed(1)} ) + step( ${G.AV_HALF.toFixed(2)}, abs( wetP.x - ${a.toFixed(1)} ) ) * 99.0 );`,
      )
      .join(" "),
    G.ST_SP.toFixed(1),
    G.ST_SP.toFixed(1),
    G.ST_HALF.toFixed(2),
    WIDE_ROADS.map(
      (z) =>
        `hw = abs( zc - ${z.toFixed(1)} ) < 1.0 ? ${WIDE_ST_HALF.toFixed(2)} : hw;`,
    ).join(" "),
    NARROW_STREETS.map(
      (z) =>
        `hw = abs( zc - ${z.toFixed(1)} ) < 1.0 ? ${NARROW_ST_HALF.toFixed(2)} : hw;`,
    ).join(" "),
  );
  if (wetOn && !SC.lights_physical_fragment.includes("wetFlat"))
    SC.lights_physical_fragment = SC.lights_physical_fragment + wet;
  const add = __shaderRaw2;
  if (!SC.opaque_fragment.includes("ssrW"))
    SC.opaque_fragment = SC.opaque_fragment + add;

  // ---- ambient (diffuse IBL) grading + bounce GI approximation
  const env = SC.envmap_physical_pars_fragment;
  const target = "return PI * envMapColor.rgb * envMapIntensity;";
  if (env.includes(target) && !env.includes("ambData")) {
    SC.envmap_physical_pars_fragment =
      __shaderRaw3 +
      env.replace(
        target,
        __shaderRaw4,
      );
    for (const k of ["standard", "physical", "lambert", "phong", "toon"]) {
      const lib = THREE.ShaderLib[k];
      if (lib) lib.uniforms.ambData = { value: ambShared };
    }
  } else if (!env.includes("ambData")) {
    console.warn(
      "[render/surface] could not patch envmap_physical_pars_fragment",
    );
  }
}
