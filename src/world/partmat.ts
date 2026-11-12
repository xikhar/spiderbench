/**
 * Defines part categories and shared part material utilities.
 *
 * @module world-partmat
 * @version 1.0.0
 * @file src/world/partmat.ts
 * @since 0.0.1
 * @description Exports material/part identifiers and helpers used to assign and manage materials for world object parts.
 */
import * as THREE from "three";
import { nightK } from "@/render/daynight.ts";

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
} as const;

export function createPartMaterial({
    name = "part",
    instTint = true,
    instState = false,
    physical = false,
    extraVert = "",
    extraVertMain = "",
    map = null as THREE.Texture | null,
} = {}): THREE.Material {
    const Mat = physical
        ? THREE.MeshPhysicalMaterial
        : THREE.MeshStandardMaterial;
    const mat: any = new Mat({
        vertexColors: !map,
        map,
        roughness: 0.7,
        metalness: 0,
    });
    if (physical) {
        mat.clearcoat = 0.0;
    }
    mat.onBeforeCompile = (sh: any) => {
        sh.uniforms.uNightK = nightK;
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
      attribute float aPart; flat varying float vPart; varying vec3 vTintP; varying float vStateP;
      ${instTint ? "attribute vec3 aTint;" : ""} ${instState ? "attribute float aState;" : ""}
      ${extraVert}`,
            )
            .replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
      vPart = aPart; vTintP = ${instTint ? "aTint" : "vec3(1.0)"}; vStateP = ${instState ? "aState" : "0.0"};
      ${extraVertMain}`,
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      flat varying float vPart; varying vec3 vTintP; varying float vStateP; uniform float uNightK;`,
            )
            .replace(
                "#include <color_fragment>",
                `#include <color_fragment>
      int P = int(vPart + 0.5);
      float pR = 0.7, pM = 0.0; vec3 pE = vec3(0.0);
      if (P == 1) { diffuseColor.rgb *= vTintP; pR = 0.32; }
      else if (P == 2) { pR = 0.28; pM = 1.0; }
      else if (P == 3) { diffuseColor.rgb = vec3(0.012, 0.014, 0.016); pR = 0.04; }
      else if (P == 4) { pR = 0.2; pE = diffuseColor.rgb * 0.4; }
      else if (P == 5) { pR = 0.92; }
      else if (P == 6) { pR = 0.55; }
      else if (P == 7) { pR = 0.08; pM = 0.6; pE = vec3(0.12); }
      else if (P == 8) { pR = 0.2; pE = diffuseColor.rgb * (0.3 + max(vStateP, 0.0) * 7.0); }
      else if (P == 9) { pR = 0.85; }
      else if (P >= 10 && P <= 12) {
        float on = abs(float(P - 10) - vStateP) < 0.5 ? 1.0 : 0.0;
        vec3 lc = P == 10 ? vec3(1.0, 0.06, 0.03) : (P == 11 ? vec3(1.0, 0.5, 0.02) : vec3(0.05, 1.0, 0.45));
        diffuseColor.rgb = lc * 0.05; pR = 0.15; pE = lc * on * 30.0;
      }
      else if (P == 13) { vec3 lc = vStateP > 1.5 ? vec3(0.9, 0.95, 1.0) : vec3(1.0, 0.45, 0.05); diffuseColor.rgb = lc * 0.05; pE = lc * 10.0; }
      else if (P == 14) { pR = 0.1; pE = diffuseColor.rgb * 3.0; }
      else if (P == 15) { pR = 0.3; pE = diffuseColor.rgb * 0.25; }
      else if (P == 16) { diffuseColor.rgb *= vTintP.r > -1.0 ? vec3(1.0) : vec3(1.0); pR = 0.6; }
      else if (P == 17 || P == 18 || P == 19) { pR = 0.8; }
      else if (P == 20) { pR = 0.85; }
      else if (P == 21) { pR = 0.78; }
      else if (P == 22) { pR = 0.92; }
      if (uNightK > 0.0) {
        float lampOn = vStateP < -0.5 ? 0.0 : 1.0;
        if (P == 4) pE += (vStateP > 0.5 ? vec3(1.0, 0.56, 0.2) : vec3(1.0, 0.85, 0.66)) * 3.2 * uNightK;
        float hk = clamp(12.0 / max(length(vViewPosition), 1.0), 0.1, 1.0);
        if (P == 7) pE += vec3(1.0, 0.95, 0.88) * 3.5 * hk * uNightK * lampOn;
        else if (P == 8) pE += diffuseColor.rgb * 2.2 * max(hk, 0.35) * uNightK * lampOn;
        else if (P == 14 || P == 15) pE *= 1.0 + 1.5 * uNightK;
      }
      `,
            )
            .replace(
                "#include <roughnessmap_fragment>",
                "#include <roughnessmap_fragment>\nroughnessFactor = pR;",
            )
            .replace(
                "#include <metalnessmap_fragment>",
                "#include <metalnessmap_fragment>\nmetalnessFactor = pM;",
            )
            .replace(
                "#include <emissivemap_fragment>",
                "#include <emissivemap_fragment>\ntotalEmissiveRadiance += pE;",
            );
    };
    mat.customProgramCacheKey = () =>
        `city-part-${name}-${instTint}-${instState}`;
    return mat;
}
