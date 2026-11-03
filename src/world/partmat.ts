// @ts-nocheck
// OWNER: city agent. Shared material for props & vehicles: vertex colours + per-vertex "part" id selecting
// roughness / metalness / emission, per-instance tint (aTint, for paint parts) and state (aState, traffic lights).
import __shaderPatch1 from "./shaders/glsl/partmat-patch-1.glsl?raw";
import __shaderPatch2 from "./shaders/glsl/partmat-patch-2.glsl?raw";
import __shaderPatch3 from "./shaders/glsl/partmat-patch-3.glsl?raw";
import __shaderPatch4 from "./shaders/glsl/partmat-patch-4.glsl?raw";
import __shaderPatch5 from "./shaders/glsl/partmat-patch-5.glsl?raw";
import __shaderPatch6 from "./shaders/glsl/partmat-patch-6.glsl?raw";
import __shaderPatch7 from "./shaders/glsl/partmat-patch-7.glsl?raw";
import { injectShader } from "../render/shader.ts";
import * as THREE from "three";
import { nightK } from "../render/daynight.ts"; // (daynight)

export const PART = {
  BASE: 0,
  PAINT: 1,
  METAL: 2,
  GLASS: 3,
  LAMP: 4,
  RUBBER: 5,
  PLASTIC: 6,
  HEAD: 7,
  TAIL: 8,
  FABRIC: 9,
  SIG_R: 10,
  SIG_Y: 11,
  SIG_G: 12,
  PED: 13,
  SCREEN: 14,
  TAXI: 15,
  SKIN: 16,
  SHIRT: 17,
  PANTS: 18,
  HAIR: 19,
  LEAF: 20,
  WOOD: 21,
  CONCRETE: 22,
};

export function createPartMaterial({
  name = "part",
  instTint = true,
  instState = false,
  physical = false,
  extraVert = "",
  extraVertMain = "",
  map = null,
} = {}) {
  const Mat = physical
    ? THREE.MeshPhysicalMaterial
    : THREE.MeshStandardMaterial;
  const mat = new Mat({
    vertexColors: !map,
    map,
    roughness: 0.7,
    metalness: 0,
  });
  if (physical) {
    mat.clearcoat = 0.0;
  }
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNightK = nightK; // (daynight)
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",injectShader(__shaderPatch1, instTint ? "attribute vec3 aTint;" : "", instState ? "attribute float aState;" : "", extraVert),
      )
      .replace(
        "#include <begin_vertex>",injectShader(__shaderPatch2, instTint ? "aTint" : "vec3(1.0)", instState ? "aState" : "0.0", extraVertMain),
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",__shaderPatch3,
      )
      .replace(
        "#include <color_fragment>",__shaderPatch4,
      )
      .replace(
        "#include <roughnessmap_fragment>",__shaderPatch5,
      )
      .replace(
        "#include <metalnessmap_fragment>",__shaderPatch6,
      )
      .replace(
        "#include <emissivemap_fragment>",__shaderPatch7,
      );
  };
  mat.customProgramCacheKey = () =>
    `city-part-${name}-${instTint}-${instState}`;
  return mat;
}
