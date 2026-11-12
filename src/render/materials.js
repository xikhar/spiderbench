// OWNER: render agent. Shared material helpers for the city / character agents.
//
// USAGE (all functions return standard three.js materials, so shadows/IBL/fog/AO all just work):
//
//   import { makeGlassMaterial, makeInteriorWindowMaterial, enhanceStandard, makeSuitRubber } from '../render/materials.js';
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
import * as THREE from "three";

// ------------------------------------------------------------------------------------------ patch chaining
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
                prevKey &&
                prevKey !== THREE.Material.prototype.customProgramCacheKey
                    ? prevKey.call(material)
                    : "";
            return base + "|" + [...ud.__patches.keys()].join(",");
        };
    }
    ud.__patches.set(key, fn);
    material.needsUpdate = true;
    return material;
}

// ------------------------------------------------------------------------------------------ glass
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

// ------------------------------------------------------------------------------------------ suit rubber
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

// ------------------------------------------------------------------------------------------ detail normal
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
                .replace(
                    "#include <common>",
                    "#include <common>\nvarying vec2 vDetailUv;",
                )
                .replace(
                    "#include <uv_vertex>",
                    "#include <uv_vertex>\n#ifdef USE_UV\nvDetailUv = uv;\n#else\nvDetailUv = vec2(0.0);\n#endif",
                );
        }
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
varying vec2 vDetailUv; uniform sampler2D uDetailNormal; uniform float uDetailScale, uDetailStrength;
vec3 detailPerturb(vec3 n, vec3 viewPos, vec2 uv) {
  vec3 q0 = dFdx(viewPos), q1 = dFdy(viewPos); vec2 st0 = dFdx(uv), st1 = dFdy(uv);
  vec3 q1perp = cross(q1, n), q0perp = cross(n, q0);
  vec3 T = q1perp * st0.x + q0perp * st1.x; vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B)); float sc = det == 0.0 ? 0.0 : inversesqrt(det);
  vec3 d = texture2D(uDetailNormal, uv).xyz * 2.0 - 1.0; d.xy *= uDetailStrength;
  return normalize(T * (d.x * sc) + B * (d.y * sc) + n * d.z);
}`,
            )
            .replace(
                "#include <normal_fragment_maps>",
                `#include <normal_fragment_maps>
normal = detailPerturb(normal, -vViewPosition, vDetailUv * uDetailScale);`,
            );
    });
    return material;
}

// ------------------------------------------------------------------------------------------ interior mapping
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
                "#include <common>\nvarying vec3 vIWPos; varying vec3 vIWNrm;",
            )
            .replace(
                "#include <project_vertex>",
                `#include <project_vertex>
{ vec4 ip = vec4(transformed, 1.0); vec3 inr = objectNormal;
#ifdef USE_INSTANCING
  ip = instanceMatrix * ip; inr = mat3(instanceMatrix) * inr;
#endif
  vIWPos = (modelMatrix * ip).xyz; vIWNrm = normalize(mat3(modelMatrix) * inr); }`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
varying vec3 vIWPos; varying vec3 vIWNrm;
uniform vec3 uRoom, uWin; uniform float uLit, uSeed; uniform vec3 uFrame, uGlass;
float iHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
// returns window mask (x), frame mask (y); writes interior radiance
vec2 interiorWindow(out vec3 interior, out float fres) {
  interior = vec3(0.0); fres = 0.0;
  vec3 N = normalize(vIWNrm);
  if (abs(N.y) > 0.3) return vec2(0.0);
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N)); vec3 B = vec3(0.0, 1.0, 0.0);
  vec2 wp = vec2(dot(vIWPos, T), vIWPos.y);
  vec2 cell = floor(wp / uRoom.xy); vec2 f = fract(wp / uRoom.xy);
  vec3 cid = vec3(cell, floor(dot(vIWPos, N) * 0.5) + uSeed);
  float r0 = iHash(cid), r1 = iHash(cid + 7.1), r2 = iHash(cid + 13.7);
  // window rectangle in the cell
  vec2 lo = vec2(0.5 - uWin.x * 0.5, uWin.z), hi = vec2(0.5 + uWin.x * 0.5, uWin.z + uWin.y);
  vec2 aa = fwidth(f) * 1.0;
  vec2 m2 = smoothstep(lo - aa, lo + aa, f) * (1.0 - smoothstep(hi - aa, hi + aa, f));
  float win = m2.x * m2.y;
  // frame band around the glass
  vec2 flo = lo - 0.035, fhi = hi + 0.035;
  vec2 fm = step(flo, f) * (1.0 - step(fhi, f));
  float frameM = fm.x * fm.y * (1.0 - win);
  if (win <= 0.0) return vec2(0.0, frameM);
  // ray into the room (tangent space: x=T, y=up, z=into building)
  vec3 V = normalize(vIWPos - cameraPosition);
  vec3 rd = vec3(dot(V, T), dot(V, B), dot(V, -N));
  vec3 p = vec3(f, 0.0);
  vec3 sz = vec3(1.0, 1.0, uRoom.z / uRoom.x);
  rd.z *= uRoom.x / uRoom.z * 1.0; // normalise depth
  rd.y *= uRoom.x / uRoom.y;
  vec3 tt = (step(0.0, rd) - p) / (rd + sign(rd) * 1e-5 + 1e-6);
  tt.z = (1.0 - p.z) / max(rd.z, 1e-4);
  float t = min(min(tt.x, tt.y), tt.z);
  vec3 h = p + rd * t;
  float depth = clamp(h.z, 0.0, 1.0);
  vec3 wallC = mix(vec3(0.55, 0.52, 0.47), vec3(0.62, 0.6, 0.58), r1);
  if (r2 > 0.7) wallC = mix(wallC, vec3(0.45, 0.5, 0.55), 0.5);
  vec3 c;
  if (t == tt.z) { // back wall
    c = wallC * 0.8;
    float desk = step(h.y, 0.3) * step(0.15, h.x) * step(h.x, 0.75);
    c = mix(c, vec3(0.12, 0.1, 0.09), desk * step(0.5, r0));
  } else if (t == tt.y) { // floor / ceiling
    c = rd.y < 0.0 ? vec3(0.22, 0.19, 0.16) : vec3(0.75);
    if (rd.y > 0.0) c += step(0.45, abs(fract(h.z * 2.0) - 0.5)) * 1.5 * step(0.5, r1); // ceiling lights
  } else { // side walls
    c = wallC * 0.65;
  }
  float light = step(1.0 - uLit, r0);
  float amb = 0.10 + 0.06 * r1;
  c *= mix(amb, 0.9, light) * mix(1.0, 0.45, depth);
  // blinds
  float blind = step(0.55, r2) * (r2 - 0.55) * 2.2;
  if (f.y > hi.y - (hi.y - lo.y) * blind) c = vec3(0.55, 0.53, 0.5) * (0.16 + 0.2 * light) * (0.85 + 0.15 * step(0.5, fract(f.y * 60.0)));
  interior = c * 3.0;
  float cosv = clamp(dot(-V, N), 0.0, 1.0);
  fres = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
  return vec2(win, frameM);
}`,
            )
            .replace(
                "#include <map_fragment>",
                `#include <map_fragment>
vec3 iInterior; float iFres; vec2 iMask = interiorWindow(iInterior, iFres);
diffuseColor.rgb = mix(diffuseColor.rgb, uFrame, iMask.y);
diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, iMask.x);`,
            )
            .replace(
                "#include <roughnessmap_fragment>",
                `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.5, iMask.y);
roughnessFactor = mix(roughnessFactor, 0.04, iMask.x);`,
            )
            .replace(
                "#include <metalnessmap_fragment>",
                `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.6, iMask.y);
metalnessFactor = mix(metalnessFactor, 0.0, iMask.x);`,
            )
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>
totalEmissiveRadiance += iInterior * iMask.x * (1.0 - iFres);`,
            );
    });
    return m;
}
