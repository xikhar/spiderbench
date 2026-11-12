/**
 * Suit fabric material patching and detail texture loading.
 *
 * @module player-suitfabric
 * @version 1.0.0
 * @file src/player/suitfabric.ts
 * @since 0.0.1
 * @description Applies shader patches and hex/knit detail textures to the Spider-Man suit material for fabric rendering.
 */

import * as THREE from "three";
import { addShaderPatch } from "@/render/materials";
import { nightK } from "@/render/daynight";
import { cityAmbient } from "@/render/citylights";

const uniforms = {
    uFabOn: { value: 0 },
    uFabHex: { value: null as THREE.Texture | null },
    uFabKnit: { value: null as THREE.Texture | null },

    uFabP: { value: new THREE.Vector4(4096, 147, 0.85, 0.18) },
    uFabNightK: nightK,
    uCityAmbLo: cityAmbient.lo,
    uCityAmbHi: cityAmbient.hi,
};
let want = true,
    loaded = 0,
    readyRes: (() => void) | undefined;
const fabOff =
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).get("fabric") === "0";
/** resolves once both detail textures are in (screenshots wait on it) */
export const suitFabricReady = new Promise<void>((r) => {
    readyRes = r;
});
const sync = () => {
    uniforms.uFabOn.value = want && !fabOff && loaded === 2 ? 1 : 0;
    if (loaded === 2) readyRes?.();
};
/** Advanced suit on/off (suits.js). Off = the material renders exactly as the GLB. */
export function setSuitFabric(on: boolean) {
    want = !!on;
    sync();
}

function loadDetail(url: string, key: "uFabHex" | "uFabKnit") {
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

export function applySuitFabric(root: THREE.Object3D): THREE.Material | null {
    let mat: THREE.Material | null = null;
    root.traverse((o: any) => {
        if (!o.isMesh) return;
        for (const m of ([] as THREE.Material[]).concat(o.material))
            if ((m as any)?.name === "SpiderSuit") mat = m;
    });
    if (!mat || (mat as any).userData?.__patches?.has?.("suitFabric"))
        return mat;
    const hexUrl = new URL(
        "../assets/textures/characters/spiderman/suit_weave_hex.png",
        import.meta.url,
    ).href;
    const knitUrl = new URL(
        "../assets/textures/characters/spiderman/suit_weave_knit.png",
        import.meta.url,
    ).href;
    if (!uniforms.uFabHex.value && loaded === 0) {
        loadDetail(hexUrl, "uFabHex");
        loadDetail(knitUrl, "uFabKnit");
    }
    addShaderPatch(mat, "suitFabric", (sh: any) => {
        Object.assign(sh.uniforms, uniforms);
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying vec3 vFabP;",
            )
            .replace(
                "#include <begin_vertex>",
                "#include <begin_vertex>\nvFabP = position;",
            );
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
  float wK = (1.0 - wR) * (1.0 - wB) * (1.0 - wW);
  fabW = vec4(wR, wB, wW, wK);
  vec2 fabPx = vec2(vMapUv.x, 1.0 - vMapUv.y) * uFabP.x - 0.5;
  vec2 uvH = vec2(fabPx.y / 23.094, fabPx.x / 40.0), uvK = vMapUv * uFabP.y;
  fabHx = texture2D(uFabHex, uvH).rgb; fabKn = texture2D(uFabKnit, uvK).rgb;
  float cellPx = 5.7735 / max(length(fwidth(fabPx)), 1e-6);
  fabFade = smoothstep(1.6, 4.0, cellPx);
  fabN1 = fabNoise(vFabP * 5.0 + 1.7); float n2 = fabNoise(vFabP * 16.0 - 4.2);
  vec3 red = c * vec3(0.78, 0.84, 0.98) * (1.0 + 0.16 * fabN1 + 0.06 * n2);
  red.b += 0.0035 * (0.5 + 0.5 * fabN1) * lum / 0.07;
  float cob = 0.5 + 0.5 * fabN1;
  vec3 blue = c * mix(vec3(0.78, 0.76, 0.8), vec3(1.05, 1.3, 1.2), cob) * (1.0 + 0.06 * n2);
  vec3 o = c * (1.0 + 0.04 * n2) * mix(1.0, 0.86, wW);
  o = mix(o, red, wR); o = mix(o, blue, wB);
  float cav = dot(vec2(wR + 0.5 * wW, wB), vec2(fabHx.b - 0.62, fabKn.b - 0.55));
  o *= 1.0 + uFabP.w * cav;
  #ifdef USE_AOMAP
  float fabAO = texture2D(aoMap, vAoMapUv).r; o *= mix(1.0, fabAO * fabAO, 0.5);
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
  vec4 rr = vec4(0.58 + 0.12 * (1.0 - fabHx.b) + 0.03 * fabN1,
                 0.64 + 0.10 * (1.0 - fabKn.b) + 0.03 * fabN1,
                 0.42 + 0.06 * (1.0 - fabHx.b),
                 0.40);
  float ws = dot(fabW, vec4(1.0)) * (1.0 - smoothstep(0.2, 0.5, fabMetal));
  roughnessFactor = mix(roughnessFactor, dot(rr, fabW) / max(dot(fabW, vec4(1.0)), 1e-3), clamp(ws, 0.0, 1.0));
}`,
            )
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
