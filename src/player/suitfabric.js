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
import * as THREE from "three";
import { assetUrl } from "../assets.js";
import { addShaderPatch } from "../render/materials.js";
import { nightK } from "../render/daynight.js";
import { cityAmbient } from "../render/citylights.js";

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
      .replace("#include <common>", "#include <common>\nvarying vec3 vFabP;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvFabP = position;",
      ); // bind-pose position: sticks to the body
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uFabOn, uFabNightK; uniform sampler2D uFabHex, uFabKnit; uniform vec4 uFabP; uniform vec3 uCityAmbLo, uCityAmbHi;
varying vec3 vFabP;
float fabHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fabNoise(vec3 x) { // value noise, -1..1
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return 2.0 * mix(mix(mix(fabHash(i), fabHash(i + vec3(1, 0, 0)), f.x), mix(fabHash(i + vec3(0, 1, 0)), fabHash(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(fabHash(i + vec3(0, 0, 1)), fabHash(i + vec3(1, 0, 1)), f.x), mix(fabHash(i + vec3(0, 1, 1)), fabHash(i + vec3(1, 1, 1)), f.x), f.y), f.z) - 1.0;
}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
vec4 fabW = vec4(0.0); vec3 fabHx = vec3(0.5, 0.5, 0.5), fabKn = vec3(0.5, 0.5, 0.5); float fabFade = 0.0, fabN1 = 0.0;
#ifdef USE_MAP
if (uFabOn > 0.5) {
  vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); float sat = (mx - mn) / max(mx, 1e-4);
  float wR = smoothstep(0.03, 0.12, c.r - max(c.g, c.b));
  float wB = smoothstep(0.015, 0.05, c.b - max(c.r, c.g)) * (1.0 - wR);
  float wW = smoothstep(0.22, 0.42, lum) * (1.0 - smoothstep(0.18, 0.4, sat)) * (1.0 - wR) * (1.0 - wB);
  float wK = (1.0 - wR) * (1.0 - wB) * (1.0 - wW);                                   // web lines, piping, emblem outline
  fabW = vec4(wR, wB, wW, wK);
  // hex tile registered onto the honeycomb already baked into suit_normal (character_tex.py: 3 cosines, 5 px period on
  // the 4096 map -> cells 5.77 px apart, neighbours along v): same pitch, orientation and phase, so the two reinforce
  // instead of beating into moire. Tile = 4 x 4*sqrt3 cells = 23.094 x 40 texels (texture x runs along Blender v).
  vec2 fabPx = vec2(vMapUv.x, 1.0 - vMapUv.y) * uFabP.x - 0.5;
  vec2 uvH = vec2(fabPx.y / 23.094, fabPx.x / 40.0), uvK = vMapUv * uFabP.y;
  fabHx = texture2D(uFabHex, uvH).rgb; fabKn = texture2D(uFabKnit, uvK).rgb;
  // detail fades out once a hex cell (1/4 tile) covers < ~2 px (mips already average it; this stops the residual shimmer)
  float cellPx = 5.7735 / max(length(fwidth(fabPx)), 1e-6);   // hex cell = 5.77 baked texels
  fabFade = smoothstep(1.6, 4.0, cellPx);
  // tonal variation in bind-pose space (sticks to the body): slow patches + a finer mottling
  fabN1 = fabNoise(vFabP * 5.0 + 1.7); float n2 = fabNoise(vFabP * 16.0 - 4.2);
  vec3 red = c * vec3(0.78, 0.84, 0.98) * (1.0 + 0.16 * fabN1 + 0.06 * n2);             // deeper crimson, gentle shifts
  red.b += 0.0035 * (0.5 + 0.5 * fabN1) * lum / 0.07;                                    // a hint of magenta in the lighter patches
  float cob = 0.5 + 0.5 * fabN1;                                                        // navy <-> cobalt
  vec3 blue = c * mix(vec3(0.78, 0.76, 0.8), vec3(1.05, 1.3, 1.2), cob) * (1.0 + 0.06 * n2);
  vec3 o = c * (1.0 + 0.04 * n2) * mix(1.0, 0.86, wW);                                  // emblem: off-white, never blown out
  o = mix(o, red, wR); o = mix(o, blue, wB);
  // woven cavities: grooves darker, crests a touch lighter (mips average to a constant tone at distance)
  float cav = dot(vec2(wR + 0.5 * wW, wB), vec2(fabHx.b - 0.62, fabKn.b - 0.55));
  o *= 1.0 + uFabP.w * cav;
  #ifdef USE_AOMAP
  float fabAO = texture2D(aoMap, vAoMapUv).r; o *= mix(1.0, fabAO * fabAO, 0.5);   // light crease AO on the albedo too
  #endif
  diffuseColor.rgb = o;
}
#endif`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
if (uFabOn > 0.5) {
  float fabMetal = 0.0;
  #ifdef USE_METALNESSMAP
  fabMetal = texture2D(metalnessMap, vMetalnessMapUv).b;
  #endif
  // red rubberised fabric / navy knit: matte-satin, grooves rougher; emblem + web lines slightly glossier rubber
  vec4 rr = vec4(0.58 + 0.12 * (1.0 - fabHx.b) + 0.03 * fabN1,
                 0.64 + 0.10 * (1.0 - fabKn.b) + 0.03 * fabN1,
                 0.42 + 0.06 * (1.0 - fabHx.b),
                 0.40);
  float ws = dot(fabW, vec4(1.0)) * (1.0 - smoothstep(0.2, 0.5, fabMetal));   // leave the metal web-shooter parts alone
  roughnessFactor = mix(roughnessFactor, dot(rr, fabW) / max(dot(fabW, vec4(1.0)), 1e-3), clamp(ws, 0.0, 1.0));
}`,
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
        "#include <lights_fragment_maps>",
        `#include <lights_fragment_maps>
#ifdef USE_CITYL
iblIrradiance *= mix(1.0, 0.35, uFabNightK); radiance *= mix(1.0, 0.6, uFabNightK);
#endif
{ vec3 fabWN = transformDirectionByInverseViewMatrix(normal, viewMatrix);
  irradiance += mix(uCityAmbLo, uCityAmbHi, 0.5 + 0.5 * fabWN.y) * (0.75 + 0.25 * (1.0 - abs(fabWN.y))); }`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
#ifdef USE_NORMALMAP_TANGENTSPACE
if (uFabOn > 0.5) {
  // tbn = (dP/du, dP/dv) of the glTF UVs. Hex texture x runs along -v, y along +u -> rotate into (u, v).
  vec2 hx = fabHx.xy * 2.0 - 1.0;
  vec2 dn = vec2(hx.y, -hx.x) * (fabW.x + 0.45 * fabW.z) + (fabKn.xy * 2.0 - 1.0) * fabW.y;
  dn *= uFabP.z * fabFade;
  normal = normalize(tbn * vec3(mapN.xy + dn, mapN.z));
}
#endif`,
      );
  });
  sync();
  return mat;
}
