// Shared material for props and vehicles. Vertex part IDs select surface
// properties; instance attributes provide paint tint and traffic-light state.
import * as THREE from "three";
import { nightK } from "../render/dayNight.ts";
import { injectShader } from "../render/shaderInjection.ts";
import { lazyShaderSections } from "../shaderSections.ts";
import partMaterialShaderSource from "./shaders/glsl/part-materials.glsl?raw";

type PartMaterialOptions = {
  name?: string;
  instanceTint?: boolean;
  instanceState?: boolean;
  physical?: boolean;
  extraVertexDeclarations?: string;
  extraVertexSetup?: string;
  map?: object | null;
};

type ShaderProgram = {
  uniforms: Record<string, unknown>;
  vertexShader: string;
  fragmentShader: string;
};

const partMaterialShader = lazyShaderSections<
  | "vertexCommon"
  | "vertexBeginVertex"
  | "fragmentCommon"
  | "fragmentColor"
  | "fragmentRoughness"
  | "fragmentMetalness"
  | "fragmentEmissive"
>(
  () => partMaterialShaderSource,
);

export const MATERIAL_PART = {
  BASE: 0,
  PAINT: 1,
  METAL: 2,
  GLASS: 3,
  LAMP: 4,
  RUBBER: 5,
  PLASTIC: 6,
  HEADLIGHT: 7,
  TAILLIGHT: 8,
  FABRIC: 9,
  RED_SIGNAL: 10,
  YELLOW_SIGNAL: 11,
  GREEN_SIGNAL: 12,
  PEDESTRIAN: 13,
  SCREEN: 14,
  TAXI: 15,
  SKIN: 16,
  SHIRT: 17,
  PANTS: 18,
  HAIR: 19,
  LEAF: 20,
  WOOD: 21,
  CONCRETE: 22,
} as const;

export function createPartMaterial({
  name = "part",
  instanceTint = true,
  instanceState = false,
  physical = false,
  extraVertexDeclarations = "",
  extraVertexSetup = "",
  map = null,
}: PartMaterialOptions = {}) {
  const materialOptions = {
    vertexColors: !map,
    map,
    roughness: 0.7,
    metalness: 0,
  };
  const material = physical
    ? new THREE.MeshPhysicalMaterial(materialOptions)
    : new THREE.MeshStandardMaterial(materialOptions);

  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.clearcoat = 0;
  }

  material.onBeforeCompile = (shader: ShaderProgram) => {
    shader.uniforms.uNightK = nightK;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        injectShader(
          partMaterialShader.vertexCommon,
          instanceTint ? "attribute vec3 aTint;" : "",
          instanceState ? "attribute float aState;" : "",
          extraVertexDeclarations,
        ),
      )
      .replace(
        "#include <begin_vertex>",
        injectShader(
          partMaterialShader.vertexBeginVertex,
          instanceTint ? "aTint" : "vec3(1.0)",
          instanceState ? "aState" : "0.0",
          extraVertexSetup,
        ),
      );

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", partMaterialShader.fragmentCommon)
      .replace("#include <color_fragment>", partMaterialShader.fragmentColor)
      .replace(
        "#include <roughnessmap_fragment>",
        partMaterialShader.fragmentRoughness,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        partMaterialShader.fragmentMetalness,
      )
      .replace(
        "#include <emissivemap_fragment>",
        partMaterialShader.fragmentEmissive,
      );
  };

  material.customProgramCacheKey = () =>
    `city-part-${name}-${instanceTint}-${instanceState}`;
  return material;
}
