// @ts-nocheck
// Shared material helpers for the city / character agents.
//
// USAGE (all functions return standard three.js materials, so shadows/IBL/fog/AO all just work):
//
//   import { makeGlassMaterial, makeInteriorWindowMaterial, enhanceStandard, makeSuitRubber } from '../render/materials.ts';
//
//   makeGlassMaterial({ tint, roughness, reflectivity })
//       Opaque curtain-wall glass (dark body + strong coated-glass Fresnel reflecting the sky/skyline env map).
//       Opaque on purpose: no sorting problems, works with SSAO/TAA. Use for glass towers and shop fronts.
//
//   makeInteriorWindowMaterial({ base: MeshStandardMaterial params, room: [w,h,d] metres,
//                                window: [fracW, fracH], sill: frac, lit: 0..1, seed })
//       Facade material with "interior mapping" windows computed in WORLD space (works for any vertical wall,
//       no UVs needed; flat roofs/non-vertical faces render as the plain base material). Each room cell gets
//       a window rectangle; through the glass you see a parallax room (back wall, side walls, floor, ceiling,
//       random blinds / lights). Frame/wall parts use the base material (map/normalMap etc. still work).
//       Works with InstancedMesh.  Params can be edited at runtime via material.userData.interior.uniforms.
//
//   enhanceStandard(material, { detailNormal: Texture, detailScale = 6, detailStrength = 0.4 })
//       Adds a tiling detail normal map (uses the mesh uv * detailScale) on top of the existing normal.
//
//   makeSuitRubber({ color, roughness, clearcoat, sheen })  - physical material preset for the suit
//
//   addShaderPatch(material, key, fn(shader))
//       Chains onBeforeCompile patches (several helpers can patch the same material). If you need your own
//       onBeforeCompile on a material that also uses these helpers, register it via addShaderPatch instead of
//       assigning onBeforeCompile directly.
//
// Notes for everyone:
//  * Lighting is physically based: sun illuminance ~10 (three units), sky IBL via scene.environment. Use
//    realistic albedos (asphalt ~0.06-0.1, concrete ~0.3-0.4, limestone ~0.45-0.55, brick ~0.2/0.1/0.07,
//    fresh white paint ~0.75). Don't compensate darkness with emissive; tell the render agent instead.
//  * Don't set scene.fog / scene.background / scene.environment / tone mapping: the render pipeline owns them.
//  * Shadows: set castShadow/receiveShadow on meshes; cascades are handled globally (no per-material setup).
import { lazyShaderSections } from "../shaderSections.ts";
import materialsShaderSource from "./shaders/glsl/materials.glsl?raw";
import * as THREE from "three";

const materialsShader = lazyShaderSections(() => materialsShaderSource);

//  patch chaining
export function addShaderPatch(material, key, fn) {
  const ud = material.userData;
  if (!ud.__patches) {
    ud.__patches = new Map();
    const prev = material.onBeforeCompile;
    const prevKey = material.customProgramCacheKey;
    material.onBeforeCompile = (shader, renderer) => {
      if (prev && prev !== THREE.Material.prototype.onBeforeCompile)
        prev.call(material, shader, renderer);
      for (const f of ud.__patches.values()) f(shader, renderer);
    };
    material.customProgramCacheKey = () => {
      const base =
        prevKey && prevKey !== THREE.Material.prototype.customProgramCacheKey
          ? prevKey.call(material)
          : "";
      return base + "|" + [...ud.__patches.keys()].join(",");
    };
  }
  ud.__patches.set(key, fn);
  material.needsUpdate = true;
  return material;
}

//  glass
export function makeGlassMaterial({
  tint = 0x1b2530,
  roughness = 0.04,
  reflectivity = 0.22,
  envIntensity = 1.0,
} = {}) {
  // ior chosen so that F0 ~= reflectivity (coated architectural glass reflects much more than 4%)
  const f0 = THREE.MathUtils.clamp(reflectivity, 0.02, 0.6);
  const s = Math.sqrt(f0);
  const ior = THREE.MathUtils.clamp((1 + s) / (1 - s), 1.0, 2.333);
  const m = new THREE.MeshPhysicalMaterial({
    color: tint,
    roughness,
    metalness: 0.0,
    ior,
    specularIntensity: 1.0,
    envMapIntensity: envIntensity,
  });
  m.name = "glass";
  return m;
}

//  suit rubber
export function makeSuitRubber({
  color = 0xa0141c,
  roughness = 0.42,
  clearcoat = 0.35,
  clearcoatRoughness = 0.35,
  sheen = 0.25,
} = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat,
    clearcoatRoughness,
    sheen,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), 0.3),
  });
}

//  detail normal
export function enhanceStandard(
  material,
  { detailNormal = null, detailScale = 6, detailStrength = 0.4 } = {},
) {
  if (!detailNormal) return material;
  detailNormal.wrapS = detailNormal.wrapT = THREE.RepeatWrapping;
  const uniforms = {
    uDetailNormal: { value: detailNormal },
    uDetailScale: { value: detailScale },
    uDetailStrength: { value: detailStrength },
  };
  material.userData.detail = { uniforms };
  addShaderPatch(material, "detailNormal", (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (!shader.vertexShader.includes("vDetailUv")) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", materialsShader.vertexCommon)
        .replace("#include <uv_vertex>", materialsShader.vertexUvVertex);
    }
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", materialsShader.fragmentCommon)
      .replace(
        "#include <normal_fragment_maps>",
        materialsShader.fragmentNormalMaps,
      );
  });
  return material;
}

// interior mapping
export function makeInteriorWindowMaterial({
  base = { color: 0x8a7a68, roughness: 0.85 },
  room = [3.8, 3.4, 5.0],
  window = [0.62, 0.58],
  sill = 0.22,
  lit = 0.22,
  frame = 0x2a2b2d,
  glassTint = 0x0c1116,
  seed = 0,
} = {}) {
  const m = base.isMaterial ? base : new THREE.MeshStandardMaterial(base);
  const uniforms = {
    uRoom: { value: new THREE.Vector3(...room) },
    uWin: { value: new THREE.Vector3(window[0], window[1], sill) },
    uLit: { value: lit },
    uSeed: { value: seed },
    uFrame: { value: new THREE.Color(frame) },
    uGlass: { value: new THREE.Color(glassTint) },
  };
  m.userData.interior = { uniforms };
  addShaderPatch(m, "interior", (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        materialsShader.vertexCommonInteriorWindowPosition,
      )
      .replace(
        "#include <project_vertex>",
        materialsShader.vertexProjectVertex,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        materialsShader.fragmentCommonInteriorWindow,
      )
      .replace("#include <map_fragment>", materialsShader.fragmentMap)
      .replace(
        "#include <roughnessmap_fragment>",
        materialsShader.fragmentRoughness,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        materialsShader.fragmentMetalness,
      )
      .replace(
        "#include <emissivemap_fragment>",
        materialsShader.fragmentEmissive,
      );
  });
  return m;
}
