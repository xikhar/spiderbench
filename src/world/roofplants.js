// OWNER: rooftops agent (veg r1). Roof-garden planting: instanced shrubs, perennials and ornamental grasses made of
// alpha-cut cards textured with the image-generated foliage atlas (public/city/tex/roofplants.webp, 2x2 tiles:
// 0 boxwood / privet shrub, 1 fountain grass, 2 sedum + rudbeckia perennials, 3 hosta / fern / hydrangea leaves).
// Two pools (mound cards, grass cards) = 2 draws; distance-culled with a dithered fade out to ~200 m, shadows only in
// the near cascade (<= 55 m). Replaces rooftops.js' lumpy CanopyBatch blobs in beds / planters.
import * as THREE from "three";
import { assetUrl } from "../assets.js";
import { Pool } from "./pool.js";

export const PLANT = { SHRUB: 0, GRASS: 1, FLOWER: 2, BROAD: 3 };
const TILE_UV = (i) => [(i % 2) * 0.5, Math.floor(i / 2) * 0.5];
const M = 0.006; // atlas tile inset (uv)

// a card: centre c, half-extents along ex / ey; normals bent toward the spherical `nc` direction (soft, round shading)
function card(P, N, UV, I, c, ex, ey, tile, nc, bend = 0.65) {
  const v = P.length / 3,
    [tu, tv] = TILE_UV(tile);
  const fn = new THREE.Vector3().crossVectors(ex, ey).normalize();
  for (const [a, b] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const p = c.clone().addScaledVector(ex, a).addScaledVector(ey, b);
    P.push(p.x, p.y, p.z);
    const n = p
      .clone()
      .sub(nc)
      .normalize()
      .multiplyScalar(bend)
      .addScaledVector(
        fn,
        (1 - bend) * Math.sign(fn.dot(p.clone().sub(nc)) || 1),
      )
      .normalize();
    N.push(n.x, n.y, n.z);
    UV.push(
      tu + M + ((a + 1) / 2) * (0.5 - 2 * M),
      tv + M + ((b + 1) / 2) * (0.5 - 2 * M),
    );
  }
  I.push(v, v + 1, v + 2, v, v + 2, v + 3);
}
function geo(P, N, UV, I) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
}
// mound (unit: radius 1, ~1 tall): 3 crossed upright cards + a domed top card + 6 smaller rim cards tilted outward,
// each showing the whole plant -> a clumpy, leafy bush from any angle (22 tris). Default tile 0 (shadow silhouette).
function moundGeometry() {
  const P = [],
    N = [],
    UV = [],
    I = [],
    V = (x, y, z) => new THREE.Vector3(x, y, z);
  const nc = V(0, 0.15, 0);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI + 0.3;
    card(
      P,
      N,
      UV,
      I,
      V(0, 0.42, 0),
      V(Math.cos(a), 0, Math.sin(a)),
      V(0, 0.62, 0),
      0,
      nc,
    );
  }
  card(
    P,
    N,
    UV,
    I,
    V(0, 0.72, 0),
    V(0.95, 0.06, 0),
    V(0, 0.08, 0.95),
    0,
    nc,
    0.8,
  );
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.5,
      ca = Math.cos(a),
      sa = Math.sin(a);
    const c = V(ca * 0.55, 0.38 + (k % 2) * 0.1, sa * 0.55);
    const out = V(ca, 0.9, sa).normalize(),
      tang = V(-sa, 0, ca);
    const up = new THREE.Vector3().crossVectors(out, tang).normalize();
    card(
      P,
      N,
      UV,
      I,
      c,
      tang.multiplyScalar(0.5),
      up.multiplyScalar(-0.5),
      0,
      nc,
    );
  }
  return geo(P, N, UV, I);
}
// grass fountain (unit: 1 wide, 1 tall): 4 crossed upright cards from the base, leaning out a little (8 tris), tile 1
function grassGeometry() {
  const P = [],
    N = [],
    UV = [],
    I = [],
    V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI + 0.2,
      lean = k % 2 ? 0.08 : -0.08;
    card(
      P,
      N,
      UV,
      I,
      V(Math.sin(a) * lean, 0.5, -Math.cos(a) * lean),
      V(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5),
      V(0, 0.5, 0),
      1,
      V(0, -0.2, 0),
      0.5,
    );
  }
  return geo(P, N, UV, I);
}

function plantMaterial(tex) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.85,
    metalness: 0,
  });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      attribute vec4 aPlant; varying vec3 vPTint; varying float vPY;`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
      #ifdef USE_INSTANCING
        { float t = floor(aPlant.x + 0.5), d = floor(aPlant.x / 4.0 + 0.001); // aPlant.x = tile + 4 * geometry default tile
          t = t - d * 4.0;
          vec2 off = vec2(mod(t, 2.0), floor(t / 2.0)) * 0.5 - vec2(mod(d, 2.0), floor(d / 2.0)) * 0.5;
          vMapUv += off; }
      #endif
      vPTint = aPlant.yzw; vPY = position.y;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec3 vPTint; varying float vPY;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
      diffuseColor.rgb *= vPTint * mix(0.55, 1.0, smoothstep(0.0, 0.6, vPY)); // tint + darker at the soil (self-shade)`,
      );
  };
  mat.customProgramCacheKey = () => "roofplant-v1";
  return mat;
}

export class RoofPlants {
  constructor() {
    this.items = [[], []];
  }
  // add one plant: base (x, y, z), radius r (m), height hgt (m), species tile, tint [r,g,b]
  add(x, y, z, r, hgt, tile, tint, ry) {
    const grass = tile === PLANT.GRASS ? 1 : 0;
    const d = grass ? 1 : 0; // geometry default tile (shadow silhouette)
    this.items[grass].push({
      x,
      y,
      z,
      ry,
      s: 1,
      scale3: grass ? [r * 2, hgt, r * 2] : [r, hgt, r],
      extra: { aPlant: [tile + 4 * d, ...tint] },
    });
  }
  get count() {
    return this.items[0].length + this.items[1].length;
  }
  build(scene) {
    if (!this.count) return;
    const tex = new THREE.TextureLoader().load(
      assetUrl("city/tex/roofplants.webp"),
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = plantMaterial(tex);
    this.pools = [moundGeometry(), grassGeometry()].map((g, i) => {
      const p = new Pool(g, mat, {
        max: 9000,
        far: 210,
        shadowFar: 55,
        extra: { aPlant: 4 },
        name: "roofplants-" + (i ? "grass" : "mound"),
      });
      p.items = this.items[i];
      p.mesh.userData.maxCascade = 0; // shadows: near cascade only
      p.mesh.userData.smallCasters = true;
      scene.add(p.mesh);
      return p;
    });
  }
  update(cam) {
    if (this.pools) for (const p of this.pools) if (p.due(cam)) p.update(cam);
  }
}
