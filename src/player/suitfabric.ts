// @ts-nocheck
// OWNER: systems / character. Advanced-suit fabric look (user r-suitfabric: "the spiderman main suit is shiny, flat red
// and blue colours, make them rougher, and with good textures"). Target: Insomniac PS4/SM2 Advanced suit
// (refs/suit/suit_closeup.png): matte-to-satin technical fabric, raised rubbery web lines + emblem a little glossier,
// fine hex / knit micro-texture, subtle tonal colour variation, light crease AO, no plastic highlights.
//
// A runtime shader patch on the GLB's `SpiderSuit` material (no mesh / UV / weight change; the baked 4096² maps stay):
//  - classes from the baked base colour (red panels / navy panels / white emblem+palms / dark web lines + piping),
//  - tiled detail normal maps in the suit's own UVs (~1.76 m per UV unit, near uniform): honeycomb cells on red + white
//    (suit_weave_hex.png), basket weave on navy (suit_weave_knit.png); built by tools/suit_weave.py, seamless, mipmapped,
//    faded out once a cell is under ~2 px so it never sparkles at gameplay distance,
//  - roughness per class (red 0.58-0.70, navy 0.64-0.74, grooves rougher; white 0.42, web lines 0.40) + cavity darkening,
//  - low-frequency bind-pose noise for crimson / navy-cobalt tonal shifts, and baked AO also darkening the direct light
//    a little (creases).
// Only active for the Advanced suit: game/systems/suits.js turns it off for Iron / Symbiote (setSuitFabric).
import __shaderPatch1 from "./shaders/glsl/suitfabric-patch-1.glsl?raw";
import __shaderPatch2 from "./shaders/glsl/suitfabric-patch-2.glsl?raw";
import __shaderPatch3 from "./shaders/glsl/suitfabric-patch-3.glsl?raw";
import __shaderPatch4 from "./shaders/glsl/suitfabric-patch-4.glsl?raw";
import __shaderPatch5 from "./shaders/glsl/suitfabric-patch-5.glsl?raw";
import __shaderPatch6 from "./shaders/glsl/suitfabric-patch-6.glsl?raw";
import __shaderPatch7 from "./shaders/glsl/suitfabric-patch-7.glsl?raw";
import * as THREE from "three";
import { assetUrl } from "../assets.ts";
import { addShaderPatch } from "../render/materials.ts";
import { nightK } from "../render/daynight.ts";
import { cityAmbient } from "../render/citylights.ts";

const uniforms = {
  uFabOn: { value: 0 },
  uFabHex: { value: null },
  uFabKnit: { value: null },
  // x: baked-map texels per UV unit (hex registration, cell pitch ~2.5 mm), y: knit tiles per UV unit (tile = 10 threads, ~1.2 mm),
  // z: detail normal strength, w: cavity (albedo) strength
  uFabP: { value: new THREE.Vector4(4096, 147, 0.85, 0.18) },
  uFabNightK: nightK, // (night r12)
  uCityAmbLo: cityAmbient.lo,
  uCityAmbHi: cityAmbient.hi, // (user r-amb) area ambient of the lit blocks around the player
};
let want = true,
  loaded = 0,
  readyRes;
const fabOff =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("fabric") === "0"; // A/B: ?fabric=0 = raw GLB material
/** resolves once both detail textures are in (screenshots wait on it) */
export const suitFabricReady = new Promise((r) => {
  readyRes = r;
});
const sync = () => {
  uniforms.uFabOn.value = want && !fabOff && loaded === 2 ? 1 : 0;
  if (loaded === 2) readyRes();
};
/** Advanced suit on/off (suits.js). Off = the material renders exactly as the GLB (other suits do their own thing). */
export function setSuitFabric(on) {
  want = !!on;
  sync();
}

function loadDetail(url, key) {
  new THREE.TextureLoader().load(
    url,
    (t) => {
      t.colorSpace = THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      uniforms[key].value = t;
      loaded++;
      sync();
    },
    undefined,
    (e) => console.warn("[suitfabric] detail texture failed", url, e),
  );
}

export function applySuitFabric(root) {
  let mat = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material))
      if (m?.name === "SpiderSuit") mat = m;
  });
  if (!mat || mat.userData.__patches?.has("suitFabric")) return mat;
  if (!uniforms.uFabHex.value && loaded === 0) {
    loadDetail(assetUrl("tex/suit_weave_hex.png"), "uFabHex");
    loadDetail(assetUrl("tex/suit_weave_knit.png"), "uFabKnit");
  }
  addShaderPatch(mat, "suitFabric", (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>",__shaderPatch1)
      .replace(
        "#include <begin_vertex>",__shaderPatch2,
      ); // bind-pose position: sticks to the body
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",__shaderPatch3,
      )
      .replace(
        "#include <map_fragment>",__shaderPatch4,
      )
      .replace(
        "#include <roughnessmap_fragment>",__shaderPatch5,
      )
      // (night r12) user: 'none of the lights affect the player suit at all'. The night preset's sky fill (env x3, tuned
      // so facades read) lit the suit evenly from every side and drowned the lamps / headlights / screens (city lights
      // off changed the suit by ~15 %). At night the suit keeps ~35 % of that fill (any suit: outside uFabOn), so the
      // local lights model it; the moon key and city lights are unchanged, by day nothing changes
      // (only where the city lights compiled in: on 16-texture-unit GPUs the suit falls back without them, citylights.js)
      // (user r-amb) + the AREA AMBIENT of the lit blocks around him (citylights.js cityAmbient: street bounce from below,
      // a weaker share from above), on every GPU path (uniforms, no texture): a bright avenue lifts the whole suit even
      // away from the nearest lamp, a dark side street adds ~nothing
      .replace(
        "#include <lights_fragment_maps>",__shaderPatch6,
      )
      .replace(
        "#include <normal_fragment_maps>",__shaderPatch7,
      );
  });
  sync();
  return mat;
}
