// OWNER: foundation agent (city remake). Distant hinterland beyond the modelled far shores (farshore.js ends its
// massed blocks ~4.3 km from Manhattan): New Jersey plains + Newark-like cluster to the west, the Bronx / Westchester
// to the north, Queens / Brooklyn / Long-Island-like sprawl to the east, Staten-Island-like hills to the south-west.
// One InstancedMesh of 5-sided boxes (no bottoms) sized and spaced by distance (the far the coarser), with a cheap
// shader: roof tones per instance (tar, gravel, membrane, rust), walls darker with floor bands that dissolve into an
// average with distance (no shimmer). Read through the aerial-perspective fog they give the horizon a real, uneven
// city silhouette instead of a flat band. No shadows, no collision (unreachable); ~1 draw call.
import * as THREE from "three";
import { mulberry32, hash2, onLand, G } from "./layout.js";
import { farShoreHeight } from "./farshore.js";

import { REFL_LAYER } from "./water.js";
import { nightK } from "../render/daynight.js"; // (night)

// skyline clusters on the hinterland: centre, radius, max height
const CLUSTERS = [
  { x: -14500, z: 1500, r: 1700, h: 150, n: 90 }, // Newark-like
  { x: -5200, z: 4200, r: 900, h: 70, n: 30 }, // Bayonne / Journal Square
  { x: 9800, z: -2600, r: 1300, h: 80, n: 40 }, // Flushing-like
  { x: 6200, z: 3600, r: 1500, h: 60, n: 40 }, // central Brooklyn mid-rises
  { x: 900, z: -9000, r: 1600, h: 85, n: 45 }, // Bronx / Co-op-City-like slabs
  { x: -3600, z: -12500, r: 1400, h: 70, n: 30 }, // Fort-Lee / Palisades-top
  { x: 3800, z: 7600, r: 1100, h: 55, n: 20 }, // Bay Ridge
];

function islandDist(x, z) {
  const zc = Math.max(G.Z_MIN, Math.min(G.Z_MAX, z));
  const dx = x < G.X_MIN ? G.X_MIN - x : x > G.X_MAX ? x - G.X_MAX : 0;
  return Math.hypot(dx, z - zc);
}

export function buildHinterland({ scene, R0 = 4300, R1 = 17000 }) {
  const rnd = mulberry32(5150);
  const M = [],
    C = [];
  const m4 = new THREE.Matrix4(),
    col = new THREE.Color();
  const ROOF = [
    [0.32, 0.31, 0.3],
    [0.42, 0.4, 0.37],
    [0.25, 0.25, 0.26],
    [0.5, 0.49, 0.46],
    [0.38, 0.3, 0.26],
    [0.58, 0.57, 0.55],
    [0.3, 0.33, 0.3],
  ];
  const WALL = [
    [0.42, 0.27, 0.21],
    [0.36, 0.29, 0.24],
    [0.54, 0.48, 0.4],
    [0.5, 0.5, 0.49],
    [0.6, 0.57, 0.52],
    [0.33, 0.37, 0.41],
  ];
  const land = (x, z) => {
    const y = farShoreHeight(x, z);
    return y === null || onLand(x, z) ? null : y;
  };
  const push = (x0, z0, x1, z1, y0, h, roof, wall) => {
    m4.makeScale(x1 - x0, h, z1 - z0).setPosition(
      (x0 + x1) / 2,
      y0,
      (z0 + z1) / 2,
    );
    M.push(m4.clone());
    C.push([...wall, ...roof]);
  };
  const place = (x, z, w, d, h) => {
    const ys = [
      land(x - w / 2, z - d / 2),
      land(x + w / 2, z - d / 2),
      land(x + w / 2, z + d / 2),
      land(x - w / 2, z + d / 2),
    ];
    if (ys.some((y) => y === null) || ys.some((y) => y !== ys[0])) return false;
    const r = ROOF[Math.floor(rnd() * ROOF.length)],
      wl = WALL[Math.floor(rnd() * WALL.length)],
      k = 0.85 + rnd() * 0.3;
    push(
      x - w / 2,
      z - d / 2,
      x + w / 2,
      z + d / 2,
      ys[0] - 0.5,
      h + 0.5,
      r.map((v) => v * k * 0.8),
      wl.map((v) => v * (0.68 + rnd() * 0.2)),
    );
    return true;
  };
  // ---- sprawl: cells grow with distance (120 m near the modelled band .. ~420 m at 20 km)
  for (let z = -R1; z < R1; ) {
    const dz = Math.abs(z) < 6000 ? 0 : Math.abs(z) - 6000;
    const cz = 120 + dz * 0.02;
    for (let x = -R1; x < R1; ) {
      const d = islandDist(x, z);
      const cs = 120 + Math.max(0, d - R0) * 0.016;
      if (d > R0 && d < R1) {
        const nb = hash2(Math.floor(x / 900), Math.floor(z / 900)); // neighbourhood character
        if (nb > 0.2) {
          // (some neighbourhoods are parks / cemeteries / rail yards: nothing)
          const n = 1 + (rnd() < 0.55 ? 1 : 0) + (rnd() < 0.25 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const w = cs * (0.25 + rnd() * 0.45),
              dd = cz * (0.25 + rnd() * 0.45);
            const px = x + rnd() * (cs - w) + w / 2,
              pz = z + rnd() * (cz - dd) + dd / 2;
            const tall = rnd() < 0.05 + 0.1 * nb;
            // (round 3) the sprawl flattens with distance: the far horizon settles into a low, hazy, tree-broken
            // band instead of an endless field of boxes
            const fl = 1 - 0.65 * Math.min(1, Math.max(0, (d - 7000) / 8000));
            const h =
              (tall
                ? 25 + rnd() * 35
                : 7 + rnd() * rnd() * 22 + (nb > 0.7 ? 6 : 0)) * fl;
            if (d > 9000 && rnd() < 0.35) continue;
            place(px, pz, w, dd, h);
          }
        }
      }
      x += cs;
    }
    z += cz;
  }
  // ---- clusters: towers / slabs rising out of the sprawl
  for (const K of CLUSTERS) {
    for (let i = 0; i < K.n; i++) {
      const a = rnd() * Math.PI * 2,
        r = K.r * Math.sqrt(rnd()) * 0.9;
      const x = K.x + Math.cos(a) * r,
        z = K.z + Math.sin(a) * r;
      const f = 1 - r / K.r,
        h = K.h * (0.3 + 0.7 * f * rnd() + 0.2 * rnd());
      const w = 22 + rnd() * 30,
        dd = 22 + rnd() * 40;
      place(x, z, w, dd, h);
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  // drop the bottom face (-y: group index 3 -> indices 18..23)
  const idx = geo.index.array,
    keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    if (i >= 18 && i < 24) continue;
    keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(keep);
  geo.clearGroups();
  const mat = createHinterlandMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, M.length);
  const wallA = new Float32Array(M.length * 3),
    roofA = new Float32Array(M.length * 3);
  for (let i = 0; i < M.length; i++) {
    mesh.setMatrixAt(i, M[i]);
    wallA.set(C[i].slice(0, 3), i * 3);
    roofA.set(C[i].slice(3, 6), i * 3);
  }
  geo.setAttribute("aWall", new THREE.InstancedBufferAttribute(wallA, 3));
  geo.setAttribute("aRoof", new THREE.InstancedBufferAttribute(roofA, 3));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = "hinterland";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.layers.enable(REFL_LAYER);
  scene.add(mesh);
  return { mesh, count: M.length };
}

function createHinterlandMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNightK = nightK; // (night)
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      attribute vec3 aWall; attribute vec3 aRoof; varying vec3 vHC; varying vec3 vHP; varying float vTop; varying float vLit;`,
      )
      .replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>
      vTop = normal.y > 0.5 ? 1.0 : 0.0; vHC = vTop > 0.5 ? aRoof : aWall;
      vHP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      { vec3 io = instanceMatrix[3].xyz; float lh = fract(sin(dot(io.xz, vec2(12.9898, 78.233))) * 43758.5453); // (night) per-building lit share
        vLit = lh < 0.35 ? 0.0 : (lh < 0.93 ? (lh - 0.35) * 0.35 : 0.6 + (lh - 0.93) * 4.0); }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec3 vHC; varying vec3 vHP; varying float vTop; varying float vLit; uniform float uNightK;`,
      )
      // (night) distant boroughs: dark masses with a sparse warm window sparkle (per-building lit share: most dim, a
      // few bright), no light on the roofs; sub-pixel by construction (per-instance constant), so it never shimmers
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
      if (uNightK > 0.0 && vTop < 0.5) totalEmissiveRadiance += vec3(1.0, 0.7, 0.42) * vLit * 0.06 * smoothstep(3.0, 9.0, vHP.y) * uNightK;`,
      )
      .replace(
        "#include <map_fragment>",
        `{
        vec3 c = vHC;
        if (vTop < 0.5) {
          // floor bands + bays, averaged out once they get sub-pixel
          float fl = fract(vHP.y / 3.4), u = fract((vHP.x + vHP.z) / 2.6);
          float w = step(0.35, fl) * step(fl, 0.85) * step(0.3, u) * step(u, 0.75);
          vec2 fw = fwidth(vec2(vHP.y / 3.4, (vHP.x + vHP.z) / 2.6));
          w = mix(w, 0.3, clamp(max(fw.x, fw.y) * 1.5, 0.0, 1.0));
          c = mix(c, vec3(0.08, 0.09, 0.1), w * 0.85);
          c *= 0.65 + 0.35 * smoothstep(0.0, 12.0, vHP.y); // grimy base / contact darkening
        }
        diffuseColor.rgb = c * (1.0 - 0.85 * uNightK); // (night) dark masses
      }`,
      );
  };
  mat.customProgramCacheKey = () => "hinterland-v3-night";
  return mat;
}
