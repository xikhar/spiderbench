// OWNER: city agent. Autumn trees: branching trunks + dense alpha-tested leaf-cluster cards with spherical normals,
// per-instance two-tone autumn tint, canopy self-occlusion. Two LODs per kind, instanced through distance pools.
import * as THREE from "three";
import { G, mulberry32, PARK_WATER, parkWaterAt } from "./layout.js";
import { PARK_SITES, PARK_ROCKS } from "./park.js";
import { Pool } from "./pool.js";
import { csmShared } from "../render/csm.js";
import {
  trunkSkeleton,
  trunkMesh,
  TRUNK_LOD,
  barkMaterial,
  BARK,
} from "./treetrunk.js"; // (veg r1) natural trunks + bark

// Canopy = leaf-spray cards grouped in clumps (a few per lobe), like real crowns: every clump is a small dome of cards
// whose vertex normals blend the clump radial, the lobe radial and the card's own normal, so light wraps around each
// clump (clump-scale self-shadowing) as well as the whole crown. aLeaf.x = exposure (0 = deep inside / underneath,
// 1 = outer sun-side shell), varying per vertex for soft gradients; aLeaf.y = per-clump (+ per-card) variation.
function canopyGeometry({
  lobes,
  cards,
  size,
  seed,
  core = 0,
  coreLobes = 9,
  coreDetail = 1,
}) {
  const rnd = mulberry32(seed);
  const P = [],
    N = [],
    UV = [],
    R = [],
    I = [];
  if (core > 0)
    addCore(P, N, UV, R, I, lobes, core, seed + 5, coreLobes, coreDetail);
  let v = P.length / 3;
  let minY = Infinity,
    maxY = -Infinity;
  for (const L of lobes) {
    minY = Math.min(minY, L.y - L.r * (L.sy ?? 0.8));
    maxY = Math.max(maxY, L.y + L.r * (L.sy ?? 0.8));
  }
  const tmp = new THREE.Vector3(),
    ax = new THREE.Vector3(),
    ay = new THREE.Vector3(),
    nrm = new THREE.Vector3();
  const lc = new THREE.Vector3(),
    cc = new THREE.Vector3(),
    p = new THREE.Vector3(),
    rl = new THREE.Vector3(),
    rc = new THREE.Vector3();
  const tot = lobes.reduce((a, l) => a + l.r ** 2, 0);
  const sphere = () => {
    const u = rnd(),
      w = rnd(),
      th = u * Math.PI * 2,
      ph = Math.acos(2 * w - 1);
    return new THREE.Vector3(
      Math.sin(ph) * Math.cos(th),
      Math.cos(ph),
      Math.sin(ph) * Math.sin(th),
    );
  };
  for (const L of lobes) {
    const sy = L.sy ?? 0.8;
    lc.set(L.x, L.y, L.z);
    const n = Math.round((cards * L.r ** 2) / tot);
    const nClumps = Math.max(3, Math.round(n / 11));
    for (let k = 0; k < nClumps; k++) {
      const d = sphere();
      if (d.y < -0.6) d.y = -0.6 + rnd() * 0.25;
      const rr = 0.58 + 0.38 * Math.sqrt(rnd()); // (park r8) clumps pushed to the shell: gaps between them show limbs / sky (critic r7: 'blobby cards')
      cc.set(
        L.x + d.x * L.r * rr,
        L.y + d.y * L.r * rr * sy,
        L.z + d.z * L.r * rr,
      );
      const cr = L.r * (0.3 + rnd() * 0.16);
      const clumpVar = rnd();
      const m = Math.round((n / nClumps) * (0.8 + rnd() * 0.4));
      for (let i = 0; i < m; i++) {
        const e = sphere();
        const r2 = Math.pow(rnd(), 0.45);
        // clumps are domes: few cards on their inner (lobe-centre) side
        rl.copy(cc).sub(lc).normalize();
        if (e.dot(rl) < -0.3) e.addScaledVector(rl, 0.8).normalize();
        const c = new THREE.Vector3(
          cc.x + e.x * cr * r2,
          cc.y + e.y * cr * r2 * 0.85,
          cc.z + e.z * cr * r2,
        );
        // card orientation: mostly facing out of the clump, random roll
        nrm.copy(e).multiplyScalar(0.6).addScaledVector(rl, 0.4).normalize();
        tmp
          .set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5)
          .multiplyScalar(1.1)
          .add(nrm)
          .normalize();
        ax.set(0, 1, 0).cross(tmp);
        if (ax.lengthSq() < 1e-3) ax.set(1, 0, 0);
        ax.normalize();
        ay.copy(tmp).cross(ax).normalize();
        const rot = rnd() * Math.PI * 2;
        const ca = Math.cos(rot),
          sa = Math.sin(rot);
        const ex = ax.clone().multiplyScalar(ca).addScaledVector(ay, sa);
        const ey = ay.clone().multiplyScalar(ca).addScaledVector(ax, -sa);
        const s = (size * (0.75 + rnd() * 0.5)) / 2;
        const tile = Math.floor(rnd() * 4);
        const tu = (tile % 2) * 0.5,
          tv = Math.floor(tile / 2) * 0.5;
        const vr = clumpVar * 0.75 + rnd() * 0.25;
        for (const [a, b] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          p.copy(c)
            .addScaledVector(ex, a * s)
            .addScaledVector(ey, b * s);
          P.push(p.x, p.y, p.z);
          rl.copy(p).sub(lc);
          const dl = Math.min(
            1.2,
            Math.hypot(rl.x / L.r, rl.y / (L.r * sy), rl.z / L.r),
          );
          rl.normalize();
          rc.copy(p).sub(cc).normalize();
          const nn = rc
            .clone()
            .multiplyScalar(0.45)
            .addScaledVector(rl, 0.4)
            .addScaledVector(tmp, 0.15)
            .normalize();
          N.push(nn.x, nn.y, nn.z);
          UV.push(tu + (a + 1) * 0.25, 1 - (tv + (1 - b) * 0.25));
          // exposure: lobe depth + clump-outer side + height in the crown (undersides are dark)
          const hy = Math.min(1, Math.max(0, (p.y - minY) / (maxY - minY)));
          const ex2 =
            0.08 +
            0.42 * Math.pow(Math.min(1, dl), 1.3) +
            0.25 * Math.max(0, rc.dot(rl) * 0.5 + 0.5) +
            0.3 * hy -
            (rl.y < -0.3 ? 0.12 : 0);
          R.push(Math.min(1, Math.max(0, ex2)), vr);
        }
        I.push(v, v + 1, v + 2, v, v + 2, v + 3);
        v += 4;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute("aLeaf", new THREE.Float32BufferAttribute(R, 2));
  g.setIndex(new THREE.Uint32BufferAttribute(I, 1));
  g.computeBoundingSphere();
  return g;
}

// Lumpy solid canopy core (displaced icospheres) so canopies read dense from above; flagged with aLeaf.x >= 2
function addCore(P, N, UV, R, I, lobes, scale, seed, maxLobes = 9, detail = 1) {
  const rnd = mulberry32(seed);
  let v0 = P.length / 3;
  for (const L of lobes.slice(0, maxLobes)) {
    const ico = new THREE.IcosahedronGeometry(1, detail);
    const pos = ico.attributes.position;
    const map = new Map();
    const idx = [];
    const verts = [];
    for (let i = 0; i < pos.count; i++) {
      const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
      if (!map.has(k)) {
        map.set(k, verts.length);
        verts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      }
      idx.push(map.get(k));
    }
    const ph = [rnd() * 10, rnd() * 10, rnd() * 10];
    for (const d of verts) {
      const n =
        0.82 +
        0.18 *
          Math.sin(d.x * 4.1 + ph[0]) *
          Math.sin(d.y * 3.7 + ph[1]) *
          Math.sin(d.z * 4.3 + ph[2]);
      const p = new THREE.Vector3(
        L.x + d.x * L.r * scale * n,
        L.y + d.y * L.r * scale * n * (L.sy ?? 0.8),
        L.z + d.z * L.r * scale * n,
      );
      P.push(p.x, p.y, p.z);
      N.push(d.x, d.y, d.z);
      // box projection in metres (leaf-cluster texture tiles ~every 2.4 m)
      const ax = Math.abs(d.x),
        ay = Math.abs(d.y),
        az = Math.abs(d.z);
      const q =
        ay > ax && ay > az ? [p.x, p.z] : ax > az ? [p.z, p.y] : [p.x, p.y];
      UV.push(q[0] / 2.4, q[1] / 2.4);
      R.push(2.0 + Math.min(1, 0.6 + 0.4 * (d.y * 0.5 + 0.5)), rnd());
    }
    for (let i = 0; i < idx.length; i += 3)
      I.push(v0 + idx[i], v0 + idx[i + 1], v0 + idx[i + 2]);
    v0 += verts.length;
  }
}

// (veg r1) trunkGeometry (cylinders butted together) replaced by treetrunk.js: one swept, tapered, leaning trunk with a
// root flare and limbs that peel off their parent (smooth forks), textured with the image-generated bark array

// Leaf atlas (tools/blender/city_props_leaves.py): R value, G hue selector (>= .97 twig), B depth in spray, A coverage;
// + tangent-space normal atlas (every leaf tilted + folded along its midrib).
let LEAF_TEX = null;
function leafTextures() {
  if (LEAF_TEX) return LEAF_TEX;
  const ld = new THREE.TextureLoader();
  const mk = (f) => {
    const t = ld.load("/assets/city/props/" + f);
    t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    return t;
  };
  LEAF_TEX = { col: mk("leaves_col.png"), nrm: mk("leaves_nrm.png") };
  return LEAF_TEX;
}

function leafMaterial(T) {
  const LT = leafTextures();
  const mat = new THREE.MeshStandardMaterial({
    map: LT.col,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.78,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = mat.userData.uTime;
    sh.uniforms.uLeafN = { value: LT.nrm };
    sh.uniforms.uLeafFrame = { value: csmShared.params };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      attribute vec2 aLeaf; attribute vec3 aTintA; attribute vec3 aTintB; attribute float aSway;
      varying vec2 vLeaf; varying vec3 vTA; varying vec3 vTB; uniform float uTime;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      vLeaf = aLeaf; vTA = aTintA; vTB = aTintB;
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
        float ph = dot(ip, vec3(0.13, 0.0, 0.17));
        // crown sway (slow) + leaf-spray flutter (fast, outer cards only)
        transformed.xz += vec2(sin(uTime * 1.3 + ph + position.y * 0.4), cos(uTime * 1.1 + ph)) * 0.05 * position.y * 0.12;
        if (aLeaf.x < 1.5) transformed += vec3(sin(uTime * 4.1 + dot(position, vec3(3.1, 1.7, 2.3))), sin(uTime * 3.3 + dot(position, vec3(1.9, 2.9, 1.3))), 0.0).xzy * 0.035 * aLeaf.x;
      #endif`,
      );
    // capture the (CSM-shadowed) sun radiance + direction right after the key light is evaluated -> leaf translucency
    let lf = THREE.ShaderChunk.lights_fragment_begin;
    const k = lf.indexOf("csmShadow()");
    const e =
      k >= 0
        ? lf.indexOf("#endif", k) + 6
        : lf.indexOf(
            "getDirectionalLightInfo( directionalLight, directLight );",
          ) + 57;
    const cap =
      "\n\tleafSun = directLight.color; leafSunDir = directLight.direction;\n";
    lf = e > 60 ? lf.slice(0, e) + cap + lf.slice(e) : lf;
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec2 vLeaf; varying vec3 vTA; varying vec3 vTB; uniform sampler2D uLeafN; uniform vec4 uLeafFrame;
      float leafIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`,
      )
      .replace(
        "#include <map_fragment>",
        `
        bool core = vLeaf.x >= 1.5;
        vec2 luv = core ? fract(vMapUv) : vMapUv;
        vec2 gx = dFdx(vMapUv), gy = dFdy(vMapUv);
        vec4 tx = textureGrad(map, luv, gx, gy);
        float expo = core ? (vLeaf.x - 2.0) : vLeaf.x;
        if (core) { // solid inner mass: leaf texture where it has coverage, otherwise deep shade
          vec4 t2 = textureGrad(map, fract(vMapUv * 0.7 + 0.31), gx * 0.7, gy * 0.7);
          float cov = max(tx.a, t2.a);
          tx = tx.a > 0.5 ? tx : t2;
          tx.r = tx.g > 0.96 ? 0.55 : (tx.a > 0.5 ? tx.r * 0.85 : 0.45); tx.b = 0.0; tx.g = min(tx.g, 0.94);
          // grazing core surface (its silhouette) takes the leaf coverage, so the solid mass never shows a faceted edge
          float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
          tx.a = facing > 0.45 ? 1.0 : cov;
        }
        if (!core) { // cards seen edge-on smear the texture: dissolve them (the neighbouring cards fill in)
          vec3 fn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
          tx.a *= smoothstep(0.12, 0.4, abs(dot(fn, normalize(vViewPosition))));
        }
        diffuseColor.a *= tx.a;
        float twig = step(0.97, tx.g);
        float hsel = tx.g * 0.8 + vLeaf.y * 0.55 - 0.18;
        vec3 leaf = mix(vTA, vTB, smoothstep(0.15, 0.85, hsel));
        // a scatter of dry brown / still-green-ish leaves
        float odd = fract(tx.g * 13.7 + vLeaf.y * 5.3);
        leaf = odd > 0.93 ? vec3(0.13, 0.06, 0.025) : (odd < 0.035 ? vec3(0.16, 0.14, 0.035) : leaf);
        leaf *= 0.42 + 0.72 * tx.r;
        // self-occlusion: deep / underside leaves and the back of each spray fall into shade
        float occ = mix(0.4, 1.0, pow(clamp(expo, 0.0, 1.0), 1.4)) * mix(0.62, 1.0, tx.b);
        if (core) occ = mix(0.24, 0.42, clamp(expo, 0.0, 1.0));
        vec3 c = twig > 0.5 ? vec3(0.085, 0.06, 0.042) : leaf;
        diffuseColor.rgb *= c * occ;
        float leafExpo = core ? 0.0 : clamp(expo, 0.0, 1.0);
      `,
      )
      .replace(
        "#include <alphatest_fragment>",
        `
        // alpha-to-coverage for the TAA pipeline: stochastic threshold per pixel/frame -> TAA resolves soft, density-
        // preserving edges (distant sprays keep their filtered coverage instead of thinning out)
        { float n = fract(leafIGN(gl_FragCoord.xy + 17.0) + uLeafFrame.x * 2.618034);
          if (diffuseColor.a < mix(0.2, 0.7, n)) discard; diffuseColor.a = 1.0; }`,
      )
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
        normal = normalize(vNormal);
        { // per-leaf normals from the atlas, in the derivative tangent frame (the core: strong, so it never shades as a ball)
          vec3 mapN = texture2D(uLeafN, core ? fract(vMapUv) : vMapUv).xyz * 2.0 - 1.0;
          if (core) mapN.xy *= 2.2;
          vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
          vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);
          vec3 Tt = q1p * gx.x + q0p * gy.x, Bt = q1p * gx.y + q0p * gy.y;
          float det = max(dot(Tt, Tt), dot(Bt, Bt));
          float sc = det == 0.0 ? 0.0 : inversesqrt(det);
          normal = normalize(normal * max(mapN.z, 0.3) + (Tt * mapN.x + Bt * mapN.y) * sc * 0.9);
        }`,
      )
      .replace(
        "#include <lights_fragment_begin>",
        "vec3 leafSun = vec3(0.0); vec3 leafSunDir = vec3(0.0, 1.0, 0.0);\n" +
          lf,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        { // thin-leaf translucency: sun shining through the outer leaves toward the camera, plus wrapped back-light
          vec3 V = normalize(vViewPosition);
          float thr = pow(clamp(dot(-V, leafSunDir), 0.0, 1.0), 4.0);
          float back = clamp(dot(-normal, leafSunDir), 0.0, 1.0);
          float k = leafExpo * leafExpo * (1.0 - twig);
          reflectedLight.directDiffuse += diffuseColor.rgb * leafSun * RECIPROCAL_PI * k * (thr * 2.2 + back * 0.6);
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(0.13, 0.1, 0.06) * ambData.vert.x * ambData.bounce.w; // skylight transmitted through the leaves (warm) (lighting2 r6: x vertical-fill gain, off at night: canopies in shade read dark)",
      );
  };
  mat.userData.uTime = { value: 0 };
  mat.customProgramCacheKey = () => "city-leaf-v6";
  return mat;
}

// autumn palette (linear, sampled from refs 1-4 and pulled ~30% toward grey: muted rusts, ochres, golds; no summer
// greens). Each tree: tint A -> B mixed per leaf/clump, per-tree value + slight hue jitter.
const desat = (c, k = 0.15) => {
  const l = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  return c.map((v) => v + (l - v) * k);
};
// (park round 2) critic: 'candy orange / yellow / lime lollipops'. Street + park palettes rebuilt from refs 08-11:
// mostly muted olive / yellow-green / dusty green crowns; gold, ochre-orange and rust only as accents (~18%).
const PAL = [
  [
    [0.3, 0.3, 0.08],
    [0.17, 0.19, 0.05],
  ], // yellow-olive
  [
    [0.2, 0.23, 0.07],
    [0.12, 0.15, 0.05],
  ], // olive green
  [
    [0.5, 0.38, 0.08],
    [0.32, 0.25, 0.06],
  ], // dull gold
  [
    [0.52, 0.29, 0.06],
    [0.34, 0.17, 0.04],
  ], // ochre-orange
  [
    [0.4, 0.33, 0.08],
    [0.23, 0.21, 0.06],
  ], // ochre-olive (turning)
  [
    [0.26, 0.27, 0.08],
    [0.15, 0.17, 0.05],
  ], // yellow-green
  [
    [0.36, 0.14, 0.04],
    [0.24, 0.09, 0.03],
  ], // rust
].map((p) => p.map((c) => desat(c, 0.15).map((v) => v * 1.2)));

const PAL_SMALL = [
  [
    [0.4, 0.13, 0.04],
    [0.26, 0.08, 0.03],
  ], // crabapple red-orange
  [
    [0.28, 0.06, 0.04],
    [0.17, 0.04, 0.03],
  ], // dogwood crimson
  [
    [0.46, 0.34, 0.07],
    [0.3, 0.22, 0.05],
  ], // ginkgo gold
  [
    [0.18, 0.21, 0.07],
    [0.11, 0.14, 0.05],
  ], // green understory
  [
    [0.24, 0.25, 0.08],
    [0.14, 0.16, 0.05],
  ], // yellow-green understory
].map((p) => p.map((c) => desat(c, 0.15)));
// (park round 2) Central Park canopy palette: ~82% greens (dark olive, olive, yellow-green, dusty blue-green,
// green-turning-gold), ~18% autumn accents (gold, ochre-orange, rust) -- weighted [tintA, tintB, weight]
const PAL_PARK_W = [
  [[0.1, 0.13, 0.045], [0.065, 0.085, 0.035], 0.19], // dark olive (oaks)
  [[0.16, 0.19, 0.06], [0.1, 0.13, 0.045], 0.2], // olive green
  [[0.24, 0.26, 0.07], [0.14, 0.17, 0.05], 0.17], // yellow-green (lindens, locusts)
  [[0.12, 0.15, 0.085], [0.08, 0.1, 0.06], 0.11], // dusty blue-green (planes)
  [[0.3, 0.28, 0.07], [0.15, 0.17, 0.05], 0.14], // green turning gold
  [[0.44, 0.33, 0.07], [0.28, 0.22, 0.05], 0.09], // gold accent
  [[0.46, 0.22, 0.045], [0.3, 0.13, 0.03], 0.06], // ochre-orange accent
  [[0.33, 0.1, 0.03], [0.21, 0.07, 0.025], 0.04], // rust-red accent
].map(([a, b, w]) => [
  desat(a, 0.1).map((v) => v * 1.28),
  desat(b, 0.1).map((v) => v * 1.28),
  w,
]); // (r2: x1.28 sunlit refs)
function pickPark(rnd) {
  let u = rnd();
  for (const p of PAL_PARK_W) {
    u -= p[2];
    if (u <= 0) return p;
  }
  return PAL_PARK_W[0];
}
// (park r3) species groves (critic r2: 'autumn tint is random per-tree confetti'): colour comes from low-frequency
// fields, so neighbouring trees share a species and a turning stage. Tones measured from refs 08-10: dusty khaki-olive
// (R ~ G, low saturation), darker oak olive, grey-green planes; autumn accents only where the 'turning' field peaks.
// (park r4) critic r3: 'autumn clusters in unnatural blobs' + 'dark muddy clumps'. Refs 09 / 10 read as sunlit
// yellow-olive and gold crowns with orange / rust trees scattered ONE BY ONE through them. Greens keep a gentle
// low-frequency drift (species groves), autumn colour is a per-tree draw whose odds a broad field only modulates.
const PARK_GREENS = [
  [
    [0.17, 0.168, 0.066],
    [0.098, 0.1, 0.045],
  ], // dark oak olive
  [
    [0.232, 0.222, 0.082],
    [0.135, 0.132, 0.055],
  ], // khaki olive (the refs' dominant tone)
  [
    [0.292, 0.266, 0.082],
    [0.172, 0.158, 0.054],
  ], // yellow-olive (lindens, honey locusts)
  [
    [0.19, 0.196, 0.1],
    [0.11, 0.118, 0.064],
  ], // grey-green (London planes)
  [
    [0.33, 0.278, 0.08],
    [0.195, 0.165, 0.052],
  ], // green-gold (turning)
];
// (park r7) evergreens: dark blue-green pines / spruces / hemlocks
const PARK_PINE = [
  [
    [0.075, 0.1, 0.06],
    [0.04, 0.058, 0.04],
  ],
  [
    [0.09, 0.115, 0.07],
    [0.05, 0.068, 0.045],
  ],
  [
    [0.065, 0.085, 0.07],
    [0.035, 0.05, 0.042],
  ],
].map((p) => p.map((c) => c.map((v, k) => v * 2.05 * [1.08, 1.02, 0.9][k]))); // (read as black holes from the air at x1) // (park r11) x1.55 still read as near-black blobs on the Great Lawn from the aerial: x2.05, a touch warmer
const PARK_TURN = [
  [
    [0.36, 0.29, 0.085],
    [0.21, 0.17, 0.055],
  ],
  [
    [0.3, 0.25, 0.08],
    [0.18, 0.15, 0.052],
  ],
]; // green-gold
const PARK_AUTUMN = [
  [
    [0.44, 0.32, 0.075],
    [0.26, 0.19, 0.05],
  ], // gold (ginkgo, hickory)
  [
    [0.43, 0.215, 0.055],
    [0.26, 0.125, 0.04],
  ], // ochre-orange (maple)
  [
    [0.4, 0.165, 0.07],
    [0.25, 0.105, 0.05],
  ], // rust-red (oak, sweetgum) (park r11: was 0.31/0.11 -> read as near-black maroon blots from the aerial)
].map((p, i) =>
  (i
    ? p.map((c) => desat(c, 0.2).map((v, k) => v * [1.0, 1.06, 1.1][k]))
    : p
  ).map((c) => desat(c, 0.22).map((v) => v * 0.94)),
); // (park r10) critic r9: 'saturated yellow / orange patches look painted on' -> a further 22 % toward grey; (park r8) critic r7: 'saturated orange clumps' -> muted
// smooth 0..1 fields from a few sines (cheap, deterministic, mirrored in ground.js' lawn shader for parkOpen)
const fld = (x, z, f, ph) =>
  0.5 +
  0.5 *
    (0.55 * Math.sin(x * f + ph) * Math.cos(z * f * 0.83 - ph * 1.7) +
      0.3 * Math.sin((x * 0.6 - z * 0.8) * f * 2.1 + ph * 2.3) +
      0.15 * Math.sin((x * 0.9 + z * 0.4) * f * 4.3 + ph * 0.7));
// open woodland (scattered trees on lawn, ref 09 / 10) where > ~0.64; ground.js lightens the woodland floor there
export function parkOpen(x, z) {
  return fld(x, z, 1 / 55, 4.1);
}
// (park r5) smooth value noise on a square lattice (cell = 1/f metres): stand-sized patches (3-12 trees), not the
// r3 600 m sine blobs nor the r4 per-tree confetti
const vh = (i, j, s) => {
  let h =
    Math.imul(i, 374761393) ^
    Math.imul(j, 668265263) ^
    Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export function vnoise(x, z, cell, s = 1) {
  const u = x / cell,
    v = z / cell,
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j;
  const sx = fx * fx * (3 - 2 * fx),
    sz = fz * fz * (3 - 2 * fz);
  const a = vh(i, j, s),
    b = vh(i + 1, j, s),
    c = vh(i, j + 1, s),
    d = vh(i + 1, j + 1, s);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function pickParkField(x, z, rnd) {
  const turn = fld(x, z, 1 / 95, 1.7);
  const u = rnd();
  // (park r5) critic r4: 'autumn tints scattered like confetti -- cluster the species and colours'. A stand field
  // (~34 m cells, 2 octaves) decides where a maple / ginkgo / oak stand has turned: inside a stand ~75% of the crowns
  // share its hue, outside only ~4% are coloured (single specimen trees). The hue itself is per stand (another noise).
  // (park r7) critic r6: 'orange blobs scattered evenly -- vary autumn colour in larger coherent groves'. Stands are
  // now ~65 m (+ 24 m detail) patches, ~85% of their crowns share the stand hue, and the lone accents drop to 1.5%
  const st = 0.72 * vnoise(x, z, 65, 11) + 0.28 * vnoise(x, z, 24, 12);
  const stand = Math.max(0, Math.min(1, (st - 0.63 + 0.1 * turn) / 0.12));
  const pA = 0.03 + 0.48 * stand; // (park r10) 0.6 -> 0.48 // (park r8) critic r7: 'let autumn tones scatter more naturally': stands share less, more lone accents
  if (u < pA) {
    const hq = vnoise(x, z, 90, 13) * 0.9 + rnd() * 0.1;
    return PARK_AUTUMN[hq < 0.64 ? 0 : hq < 0.9 ? 1 : 2];
  }
  if (u < pA + 0.08 + 0.2 * stand + 0.06 * turn)
    return PARK_TURN[rnd() < 0.6 ? 0 : 1];
  let sp =
    fld(x, z, 1 / 70, 2.9) * 0.25 + vnoise(x, z, 26, 14) * 0.6 + rnd() * 0.15; // (park r5) green species stands
  const i = Math.max(
    0,
    Math.min(
      PARK_GREENS.length - 1,
      Math.floor(((sp - 0.15) / 0.8) * PARK_GREENS.length),
    ),
  );
  return PARK_GREENS[i];
}

// (park round 1) Mid / far LOD of the park trees: a solid, lumpy 'cauliflower' crown (a few displaced icospheres,
// one per main lobe) whose shader box-projects the same leaf atlas + a clump noise and dissolves the grazing
// silhouette into leaf coverage -> from 130 m out the woods read as one fluffy, fine-grained canopy roof instead of
// separate faceted blobs. aLeaf.x = exposure (top / outer = 1), aLeaf.y = per-lobe variation.
function crownGeometry(
  lobes,
  { detail = 1, maxLobes = 3, scale = 1.12, seed = 1, envelope = false },
) {
  const rnd = mulberry32(seed);
  let L = [...lobes].sort((a, b) => b.r - a.r);
  const tot = L.reduce((a, l) => a + l.r ** 2, 0);
  const C = L.reduce(
    (a, l) => [
      a[0] + (l.x * l.r ** 2) / tot,
      a[1] + (l.y * l.r ** 2) / tot,
      a[2] + (l.z * l.r ** 2) / tot,
    ],
    [0, 0, 0],
  );
  let minY = Infinity,
    maxY = -Infinity;
  for (const l of L) {
    minY = Math.min(minY, l.y - l.r * (l.sy ?? 0.8));
    maxY = Math.max(maxY, l.y + l.r * (l.sy ?? 0.8));
  }
  if (envelope) {
    // one lobe enclosing the crown (radius to the farthest lobe edge, horizontally)
    let R = 0;
    for (const l of L)
      R = Math.max(R, Math.hypot(l.x - C[0], l.z - C[2]) + l.r * 0.85);
    L = [
      {
        x: C[0],
        y: (minY + maxY) / 2 + (maxY - minY) * 0.06,
        z: C[2],
        r: R,
        sy: ((maxY - minY) / 2 / R) * 1.02,
      },
    ];
  } else L = L.slice(0, maxLobes);
  const P = [],
    N = [],
    UV = [],
    A = [],
    I = [];
  let v0 = 0;
  for (const l of L) {
    const ico = new THREE.IcosahedronGeometry(1, detail);
    const pos = ico.attributes.position;
    const map = new Map(),
      idx = [],
      verts = [];
    for (let i = 0; i < pos.count; i++) {
      const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
      if (!map.has(k)) {
        map.set(k, verts.length);
        verts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
      }
      idx.push(map.get(k));
    }
    const ph = [rnd() * 10, rnd() * 10, rnd() * 10],
      lv = rnd();
    const sy = l.sy ?? 0.8;
    for (const d of verts) {
      // lumps (clumps of foliage) + a flatter, tucked-in underside
      const n =
        0.8 +
        0.2 *
          Math.sin(d.x * 3.3 + ph[0]) *
          Math.sin(d.y * 2.9 + ph[1]) *
          Math.sin(d.z * 3.1 + ph[2]) +
        0.08 * Math.sin(d.x * 7.1 + d.z * 6.3 + ph[1]); // (park r2) lumpier
      const dy = d.y < 0 ? d.y * 1.18 : d.y; // deeper skirt: hides the long bare trunks from afar
      const p = new THREE.Vector3(
        l.x + d.x * l.r * scale * n,
        l.y + dy * l.r * scale * n * sy,
        l.z + d.z * l.r * scale * n,
      );
      P.push(p.x, p.y, p.z);
      const rc = new THREE.Vector3(
        p.x - C[0],
        (p.y - C[1]) * 1.3,
        p.z - C[2],
      ).normalize();
      const nn = d
        .clone()
        .multiplyScalar(0.5)
        .addScaledVector(rc, 0.5)
        .normalize();
      N.push(nn.x, nn.y, nn.z);
      UV.push(0, 0);
      const hy = Math.min(1, Math.max(0, (p.y - minY) / (maxY - minY)));
      A.push(
        Math.min(
          1,
          Math.max(
            0,
            0.12 +
              0.5 * hy +
              0.38 * Math.max(0, rc.dot(d)) -
              (d.y < -0.4 ? 0.15 : 0),
          ),
        ),
        lv,
      );
    }
    for (let i = 0; i < idx.length; i += 3)
      I.push(v0 + idx[i], v0 + idx[i + 1], v0 + idx[i + 2]);
    v0 += verts.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute("aLeaf", new THREE.Float32BufferAttribute(A, 2));
  g.setIndex(new THREE.Uint32BufferAttribute(I, 1));
  g.computeBoundingSphere();
  return g;
}

function crownMaterial() {
  const LT = leafTextures();
  const mat = new THREE.MeshStandardMaterial({ map: LT.col, roughness: 0.85 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLeafN = { value: LT.nrm };
    sh.uniforms.uLeafFrame = { value: csmShared.params };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      attribute vec2 aLeaf; attribute vec3 aTintA; attribute vec3 aTintB;
      varying vec2 vLeaf; varying vec3 vTA; varying vec3 vTB; varying vec3 vCW; varying vec3 vCN; varying vec3 vCI;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      vLeaf = aLeaf; vTA = aTintA; vTB = aTintB;
      #ifdef USE_INSTANCING
        vCW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        vCN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vCI = instanceMatrix[3].xyz;
      #else
        vCW = (modelMatrix * vec4(position, 1.0)).xyz; vCN = normal; vCI = vec3(0.0);
      #endif`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec2 vLeaf; varying vec3 vTA; varying vec3 vTB; varying vec3 vCW; varying vec3 vCN; varying vec3 vCI;
      uniform sampler2D uLeafN; uniform vec4 uLeafFrame; float crClump;
      float crIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
      float crH3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float crVn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(crH3(i), crH3(i + vec3(1, 0, 0)), f.x), mix(crH3(i + vec3(0, 1, 0)), crH3(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(crH3(i + vec3(0, 0, 1)), crH3(i + vec3(1, 0, 1)), f.x), mix(crH3(i + vec3(0, 1, 1)), crH3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`,
      )
      .replace(
        "#include <map_fragment>",
        `
        // procedural foliage (no texture: a tiled leaf atlas reads as a checker from afar): clumps (~2.4 m) of
        // sub-clumps (~0.7 m) of leaf speckle (~0.25 m), per-crown phase; dark gaps between the clumps
        vec3 cp = vCW + vCI * 0.37;
        float n1 = crVn(cp * 0.62), n2 = crVn(cp * 2.1 + 3.1), n3 = crVn(cp * 5.3 + 7.7); // (park r2) finer clumps
        crClump = n1 * 0.65 + n2 * 0.35;
        vec4 tx = vec4(n3, n2, 0.0, 1.0);
        float cov = smoothstep(0.18, 0.55, crClump * 0.8 + n3 * 0.35);
        float expo = clamp(vLeaf.x, 0.0, 1.0);
        float hsel = 0.5 + (n2 - 0.5) * 0.7 + (vLeaf.y - 0.5) * 0.35 + (n1 - 0.5) * 0.4;
        vec3 leaf = mix(vTA, vTB, smoothstep(0.1, 0.9, hsel));
        leaf *= 0.74 + 0.34 * n3;
        leaf = fract(n3 * 17.3 + vLeaf.y * 3.1) > 0.97 ? leaf * vec3(0.55, 0.4, 0.3) : leaf; // dry leaves
        vec3 c = mix(vTB * 0.42, leaf, smoothstep(0.3, 0.62, crClump + n3 * 0.22)); // (park r2) deeper gaps between clumps
        c *= mix(vec3(1.0), vec3(1.12, 1.1, 0.8), smoothstep(0.62, 0.9, n2) * 0.6); // sunlit yellowing leaf tips
        float occ = mix(0.3, 1.14, pow(expo, 1.25)) * mix(0.66, 1.1, smoothstep(0.3, 0.75, crClump)); // (park r4) crowns separate: dark skirts, sunlit domes
        diffuseColor.rgb *= c * occ;
        // silhouette: grazing faces keep only the leaf coverage -> ragged, see-through crown edges
        float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
        float alpha = mix(cov * 1.25, 1.0, smoothstep(0.3, 0.72, facing));
        { float n = fract(crIGN(gl_FragCoord.xy + 5.0) + uLeafFrame.x * 2.618034); if (alpha < mix(0.25, 0.75, n)) discard; }
      `,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        { vec3 sx = normalize(dFdx(-vViewPosition)), sy2 = normalize(dFdy(-vViewPosition));
          vec2 dh = vec2(dFdx(crClump), dFdy(crClump)) * 3.0 + (vec2(dFdx(tx.r), dFdy(tx.r)) * 0.5);
          vec3 r1 = cross(sy2, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
          if (det != 0.0) normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2)); }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(0.11, 0.095, 0.06) * expo * expo * ambData.vert.x * ambData.bounce.w; // (lighting2 r6)",
      );
  };
  mat.customProgramCacheKey = () => "park-crown-v6";
  return mat;
}
// ground.js skips its CanopyBatch grove fill: the park woodland + its crown LODs live here (park round 1)
export const PARK_CANOPY_EXTERNAL = true;
// Open lawns inside the park (Sheep-Meadow / Great-Lawn / North-Meadow-like + small glades). Shared with the crowd
// (people sunbathing, playing, chatting) — keep in sync by importing, never copy.
// (positions are fractions of the park: fx across west->east, fz from the south edge (0) to the north edge (1))
const _PK = G.PARK,
  _pm = (fx, fz, rx, rz, a) => ({
    x: _PK.x0 + fx * (_PK.x1 - _PK.x0),
    z: _PK.z1 - fz * (_PK.z1 - _PK.z0),
    rx,
    rz,
    a,
  });
export const PARK_MEADOWS = [
  _pm(0.36, 0.12, 100, 58, 0.1),
  _pm(0.52, 0.44, 95, 80, -0.15),
  _pm(0.6, 0.8, 110, 75, 0.2), // Sheep Meadow, Great Lawn, North Meadow
  _pm(0.8, 0.1, 45, 32, 0.5),
  _pm(0.16, 0.2, 42, 30, -0.4),
  _pm(0.84, 0.36, 40, 36, 0.3),
  _pm(0.2, 0.47, 38, 50, 0.2),
  _pm(0.25, 0.72, 55, 36, -0.3),
  _pm(0.82, 0.22, 34, 26, 0),
  _pm(0.3, 0.9, 50, 34, 0.1),
  _pm(0.82, 0.68, 40, 50, -0.2),
];
// normalised elliptical distance to the nearest meadow (with a wobbly edge): <1 inside
export function meadowDist(x, z) {
  let best = 9;
  for (const m of PARK_MEADOWS) {
    const dx = x - m.x,
      dz = z - m.z,
      c = Math.cos(m.a),
      s = Math.sin(m.a);
    const u = (dx * c - dz * s) / m.rx,
      v = (dx * s + dz * c) / m.rz;
    const ang = Math.atan2(v, u);
    const wob =
      1 + 0.09 * Math.sin(ang * 3 + m.x) + 0.06 * Math.sin(ang * 5 + m.z);
    best = Math.min(best, Math.hypot(u, v) / wob);
  }
  return best;
}
// 0..1 grove density: dense woods (Ramble-like) vs scattered specimen trees on open lawn
function groveDensity(x, z) {
  const n =
    Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.7) +
    0.6 * Math.sin(x * 0.047 - z * 0.031 + 2.1) +
    0.35 * Math.sin(z * 0.083 + x * 0.012);
  return Math.max(0.06, Math.min(1, 0.45 + n * 0.45));
}

// (park round 2) canopy shade decals: every park tree gets (a) a soft ambient-occlusion disc under its crown and (b)
// beyond the CSM tree-shadow range (~130 m) a soft elliptical cast shadow offset along the live sun direction, as
// multiply-blended ground decals (one instanced draw). Without them the grass between crowns stays sunlit and the
// woods read as bright blobs on a lawn (critic r1: 'lollipop field'); with them each crown sits in its own shadow.
function canopyShade(pts) {
  const seg = 14,
    P = [0, 0, 0],
    K = [0],
    I = [];
  for (const kind of [0, 1]) {
    const c = P.length / 3;
    if (kind === 1) {
      P.push(0, 0, 0);
      K.push(1);
    }
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      P.push(Math.cos(a), 0, Math.sin(a));
      K.push(kind);
    }
    const c0 = kind === 0 ? 0 : c;
    for (let i = 0; i < seg; i++)
      I.push(c0, c0 + 1 + ((i + 1) % seg), c0 + 1 + i);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(K, 1));
  g.setIndex(I);
  const n = pts.length,
    D = new Float32Array(n * 4);
  pts.forEach((q, i) => D.set([q.x, q.z, q.cr ?? q.r * 0.8, q.h || 9], i * 4));
  g.setAttribute("aTree", new THREE.InstancedBufferAttribute(D, 4));
  g.instanceCount = n;
  const sun = new THREE.Vector3(0.5, 0.5, 0.5);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sun }, uY: { value: G.CURB_H + 0.03 } },
    vertexShader: `attribute float aKind; attribute vec4 aTree; uniform vec3 uSun; uniform float uY;
      varying float vR; varying float vK; varying float vS;
      void main() {
        vK = aKind; vR = length(position.xz);
        vec3 p;
        float dCam = length(aTree.xy - cameraPosition.xz);
        if (aKind < 0.5) { p = vec3(aTree.x + position.x * aTree.z * 1.15, uY, aTree.y + position.z * aTree.z * 1.15); vS = 1.0; }
        else {
          float el = max(asin(clamp(uSun.y, 0.0, 1.0)), 0.2);
          vec2 d = -normalize(uSun.xz + vec2(1e-4));
          vec2 c = aTree.xy + d * aTree.w / tan(el) * 0.92;
          float st = min(1.0 / sin(el), 2.4);
          vec2 u = position.x * d * st + position.z * vec2(-d.y, d.x);
          p = vec3(c.x + u.x * aTree.z * 0.95, uY + 0.004, c.y + u.y * aTree.z * 0.95);
          vS = smoothstep(145.0, 180.0, dCam) * smoothstep(0.02, 0.12, uSun.y);   // near trees cast real CSM shadows
        }
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `varying float vR; varying float vK; varying float vS;
      void main() {
        float a = vK < 0.5 ? (1.0 - smoothstep(0.15, 1.0, vR)) * 0.32 : (1.0 - smoothstep(0.45, 1.0, vR)) * 0.5 * vS;
        gl_FragColor = vec4(vec3(1.0 - a), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.MultiplyBlending,
    premultipliedAlpha: true,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.name = "park-canopy-shade";
  const tmp = new THREE.Vector3(),
    tmp2 = new THREE.Vector3();
  return {
    mesh,
    setSun(L) {
      L.getWorldPosition(tmp);
      L.target.getWorldPosition(tmp2);
      const v = tmp.sub(tmp2);
      if (v.lengthSq() > 1e-6) sun.copy(v.normalize());
    },
  };
}

export function buildTrees({ scene, T, spots, parkPaths }) {
  const rnd = mulberry32(99);
  const leafMat = leafMaterial(T);
  const barkMat = barkMaterial(); // (veg r1) bark array (plane / oak / dark) per instance (aBark)
  const colliders = {}; // (veg r1) per-kind trunk collision capsule (local)
  const kinds = {
    street: {
      lobes: [
        { x: 0, y: 6.5, z: 0, r: 3.3, sy: 0.85 },
        { x: 1.6, y: 7.6, z: 0.8, r: 2.1 },
        { x: -1.4, y: 7.3, z: -1.2, r: 2.2 },
        { x: 0.3, y: 5.6, z: 1.8, r: 1.8 },
      ],
      trunk: { h: 3.6, r: 0.21, branches: 5, spread: 1.7 },
    },
    park: {
      lobes: [
        { x: 0, y: 9, z: 0, r: 5.0, sy: 0.8 },
        { x: 3, y: 10.5, z: 1.5, r: 3.4 },
        { x: -2.8, y: 10, z: -1.8, r: 3.6 },
        { x: 1, y: 12, z: -2.6, r: 3 },
        { x: -1.5, y: 7.2, z: 3, r: 2.8 },
      ],
      trunk: { h: 5.5, r: 0.34, branches: 6, spread: 2.6 },
    },
    // American elm: tall vase — trunk forks high, canopy is a wide umbrella well above head height
    elm: {
      lobes: [
        { x: 0, y: 13.2, z: 0, r: 4.6, sy: 0.6 },
        { x: 3.8, y: 12.2, z: 1.2, r: 3.3, sy: 0.75 },
        { x: -3.6, y: 12.6, z: -1.4, r: 3.4, sy: 0.75 },
        { x: 0.8, y: 12.0, z: 3.6, r: 3.0, sy: 0.8 },
        { x: -1.0, y: 12.4, z: -3.8, r: 3.0, sy: 0.8 },
        { x: 0.2, y: 15.2, z: 0.4, r: 2.8, sy: 0.7 },
      ],
      trunk: { h: 7.8, r: 0.37, branches: 7, spread: 3.4 },
    },
    // ornamental / young (cherry, dogwood, crabapple): small rounded crown low to the ground
    small: {
      lobes: [
        { x: 0, y: 4.4, z: 0, r: 2.5, sy: 0.85 },
        { x: 1.2, y: 5.2, z: 0.6, r: 1.7 },
        { x: -1.1, y: 5.0, z: -0.8, r: 1.7 },
      ],
      trunk: { h: 2.2, r: 0.14, branches: 4, spread: 1.3 },
    },
    // (park r7) critic r6: 'add conifers and dark evergreen masses'. Pine / spruce: a narrow stacked cone
    conifer: {
      lobes: [
        { x: 0, y: 4.2, z: 0, r: 3.3, sy: 0.62 },
        { x: 0.2, y: 6.6, z: -0.1, r: 2.75, sy: 0.62 },
        { x: -0.1, y: 8.9, z: 0.2, r: 2.1, sy: 0.66 },
        { x: 0.1, y: 11.0, z: 0, r: 1.45, sy: 0.72 },
        { x: 0, y: 12.7, z: 0, r: 0.8, sy: 0.9 },
      ],
      trunk: { h: 4.0, r: 0.2, branches: 3, spread: 1.0 },
    },
  };
  const CARDS = {
    street: [180, 2.45, 16, 2.4],
    park: [220, 2.9, 22, 2.8],
    elm: [240, 3.0, 24, 3.0],
    small: [120, 2.1, 12, 2.1],
    conifer: [200, 2.0, 18, 2.0],
  };
  const pools = [];
  const out = { pools };
  const crownMat = crownMaterial();
  const PARK_NEAR = 165; // (park round 1) park trees: leaf cards to 130 m, then solid fluffy crowns (crownMaterial)
  for (const [name, K] of Object.entries(kinds)) {
    const parkKind = name !== "street";
    const near = canopyGeometry({
      lobes: K.lobes,
      cards: CARDS[name][0],
      size: CARDS[name][1],
      seed: 7 + name.length,
      core: 0.27,
      coreDetail: parkKind ? 1 : 2,
    }); // (park r8) core 0.34 -> 0.27: airier near crowns
    // (veg r1) near (<60 m, ~0.7-2k tris, bark ridges) / mid / far trunk LODs from one skeleton
    const skel = trunkSkeleton({
      ...K.trunk,
      seed: 3,
      lobes: K.lobes,
      kind: name,
    });
    colliders[name] = skel.collider;
    const trunk = trunkMesh(skel, TRUNK_LOD.near),
      trunkMid = trunkMesh(skel, TRUNK_LOD.mid);
    const TNEAR = 60,
      bextra = { aBark: 4 };
    const items = [];
    const extra = { aTintA: 3, aTintB: 3 };
    if (parkKind) {
      // LOD0 leaf cards (<130 m, shadows) -> LOD1 3-lobe cauliflower crown (130-520 m) -> LOD2 one-lobe envelope crown
      // (park r2) mid: 4 lumpy lobes (irregular clustered crowns, not one ball); far: every lobe as a cheap 20-tri blob
      const mid = crownGeometry(K.lobes, {
        detail: 1,
        maxLobes: name === "conifer" ? 5 : 4,
        seed: 31 + name.length,
      });
      const fr = crownGeometry(K.lobes, {
        detail: 0,
        maxLobes: 5,
        scale: 1.18,
        seed: 41 + name.length,
      });
      const pN = new Pool(near, leafMat, {
        max: 3000,
        far: PARK_NEAR,
        shadowFar: PARK_NEAR,
        extra,
        name: "trees-" + name + "-near",
      });
      const pM = new Pool(mid, crownMat, {
        max: 12000,
        near: PARK_NEAR,
        far: 520,
        extra,
        name: "trees-" + name + "-crown",
        castShadow: false,
      });
      const pF = new Pool(fr, crownMat, {
        max: 16000,
        near: 520,
        far: 3200,
        extra,
        name: "trees-" + name + "-crownfar",
        castShadow: false,
      });
      const pT = new Pool(trunk, barkMat, {
        max: 1500,
        far: TNEAR,
        shadowFar: TNEAR,
        extra: bextra,
        name: "trunks-" + name,
      });
      const pTm = new Pool(trunkMid, barkMat, {
        max: 3000,
        near: TNEAR,
        far: PARK_NEAR + 20,
        shadowFar: PARK_NEAR,
        extra: bextra,
        name: "trunks-" + name + "-mid",
      });
      const pT2 = new Pool(trunkMesh(skel, TRUNK_LOD.far), barkMat, {
        max: 8000,
        near: PARK_NEAR + 20,
        far: 420,
        castShadow: false,
        extra: bextra,
        name: "trunks-" + name + "-far",
      });
      for (const p of [pN, pM, pF, pT, pTm, pT2]) {
        p.items = items;
        scene.add(p.mesh);
        pools.push(p);
      }
      out[name] = items;
      continue;
    }
    const far = canopyGeometry({
      lobes: K.lobes,
      cards: CARDS[name][2],
      size: CARDS[name][3],
      seed: 17 + name.length,
      core: 0.85,
      coreLobes: 4,
      coreDetail: 0,
    });
    // LOD0 leaf-spray canopy (shadows to 170 m) -> LOD1 16-24 cards + solid core -> LOD2 one lumpy core blob (20 tris)
    const xfar = canopyGeometry({
      lobes: [
        {
          ...K.lobes[0],
          r: K.lobes[0].r * 1.3,
          y: K.lobes[0].y + K.lobes[0].r * 0.15,
        },
      ],
      cards: 0,
      size: 1,
      seed: 27 + name.length,
      core: 0.95,
      coreLobes: 1,
      coreDetail: 0,
    });
    const pN = new Pool(near, leafMat, {
      max: 3000,
      far: 170,
      shadowFar: 170,
      extra,
      name: "trees-" + name + "-near",
    });
    const pF = new Pool(far, leafMat, {
      max: 9000,
      near: 170,
      far: 650,
      extra,
      name: "trees-" + name + "-far",
      castShadow: false,
    });
    const pX = new Pool(xfar, leafMat, {
      max: 9000,
      near: 650,
      far: 2000,
      extra,
      name: "trees-" + name + "-xfar",
      castShadow: false,
    });
    const pT = new Pool(trunk, barkMat, {
      max: 1500,
      far: TNEAR,
      shadowFar: TNEAR,
      extra: bextra,
      name: "trunks-" + name,
    });
    const pTm = new Pool(trunkMid, barkMat, {
      max: 3000,
      near: TNEAR,
      far: 240,
      shadowFar: 170,
      extra: bextra,
      name: "trunks-" + name + "-mid",
    });
    for (const p of [pN, pF, pX, pT, pTm]) {
      p.items = items;
      scene.add(p.mesh);
      pools.push(p);
    }
    out[name] = items;
  }
  const add = (kind, x, z, s, pal = PAL, y = G.CURB_H, s3 = null) => {
    // street r3: optional y (roof-garden trees); r4: s3 crown shape
    const c = pal[Math.floor(rnd() * pal.length)];
    const val = 0.9 + rnd() * 0.3; // per-tree value
    const j = () => val * (0.92 + rnd() * 0.16); // + slight per-channel hue jitter
    out[kind].push({
      x,
      y,
      z,
      ry: rnd() * Math.PI * 2,
      s,
      scale3: s3,
      extra: {
        aTintA: c[0].map((v) => v * j()),
        aTintB: c[1].map((v) => v * j()),
      },
    });
  };
  // street trees: scale so the canopy (radius ~4.4 m at s = 1, incl. leaf cards) stays clear of nearby fire escapes
  for (const s of spots) {
    const sc = s.sc ?? 0.8 + rnd() * 0.45;
    if (s.sc) rnd();
    if (s.kind === "small") {
      add("small", s.x, s.z, sc, s.pal ?? PAL_SMALL, s.y);
      continue;
    }
    add(
      "street",
      s.x,
      s.z,
      Math.max(0.55, Math.min(sc, (s.clear ?? 99) / 4.4)),
      s.pal ?? PAL,
      s.y,
      s.s3,
    );
  } // street agent r2: per-frontage species pal / size
  // park edge trees on the sidewalk ring outside the wall
  const P = G.PARK;
  // (park r3) a denser row of mature elms / planes along CPW and Fifth (critic r2: 'no street trees along the park wall')
  // (colour from the park's grove fields, a touch brighter: sunlit avenue elms turning gold in stretches, ref 11)
  const edgePal = (x, z) => {
    const c = pickParkField(x, z * 0.7, rnd),
      k = 1.12;
    return [[c[0].map((v) => v * k), c[1].map((v) => v * k)]];
  };
  // (park r7) critic r6: 'park edge avenues read as empty pale strips: add a continuous planted tree line'. A dense
  // 6.5-8.5 m row of big crowns that meet over the sidewalk, plus a second row of park trees just inside the wall
  for (let z = P.z1 - 4; z > P.z0 + 4; z -= 6.5 + rnd() * 2) {
    add("street", P.x0 - 2.3, z, 1.25 + rnd() * 0.4, edgePal(P.x0, z));
    add("street", P.x1 + 2.3, z, 1.25 + rnd() * 0.4, edgePal(P.x1, z));
  } // (park r8) 1.1-1.45 -> 1.25-1.65: a boulevard of mature elms (critic r7: 'trees on the avenue too small')
  for (let x = P.x0 + 4; x < P.x1 - 4; x += 7 + rnd() * 2) {
    add("street", x, P.z1 + 2.3, 1.0 + rnd() * 0.35);
    add("street", x, P.z0 - 2.3, 1.0 + rnd() * 0.35);
  }
  // (park round 1) park interior: one dense, continuous woodland (the same grove field the lawn shader darkens under,
  // ground.js) around the open meadows, glades and path lanes; trees crowd up to the banks; the Met-like museum's lot
  // (park.js PARK_SITES) stays clear. Crowns overlap (~40%) so from the air the canopy is closed, not a lollipop field.
  const meadows = PARK_MEADOWS;
  const segs = [];
  for (const p of parkPaths)
    for (let i = 1; i < p.pts.length; i++)
      segs.push([
        p.pts[i - 1],
        p.pts[i],
        p.w / 2 + (p.drive ? 2.2 : p.minor ? 0.9 : 1.4),
        p.minor ? 0.25 : 1,
      ]); // (park r8) minor woodland paths: crowns may overhang
  // segment grid (16 m cells) -> constant-time path clearance tests
  const SG = 16,
    sgrid = new Map();
  for (const sg of segs) {
    const [a, b, w] = sg;
    for (
      let i = Math.floor((Math.min(a[0], b[0]) - w) / SG);
      i <= Math.floor((Math.max(a[0], b[0]) + w) / SG);
      i++
    )
      for (
        let j = Math.floor((Math.min(a[1], b[1]) - w) / SG);
        j <= Math.floor((Math.max(a[1], b[1]) + w) / SG);
        j++
      ) {
        const k = i * 100003 + j;
        let c = sgrid.get(k);
        if (!c) sgrid.set(k, (c = []));
        c.push(sg);
      }
  }
  const nearPath = (x, z, ex = 0) => {
    const ks = new Set();
    for (const ox of [-ex, 0, ex])
      for (const oz of [-ex, 0, ex])
        ks.add(Math.floor((x + ox) / SG) * 100003 + Math.floor((z + oz) / SG));
    for (const k of ks) {
      const c = sgrid.get(k);
      if (!c) continue;
      for (const [a, b, w, k] of c) {
        const dx = b[0] - a[0],
          dz = b[1] - a[1];
        const t = Math.max(
          0,
          Math.min(
            1,
            ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
          ),
        );
        if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < w + ex * k)
          return true;
      }
    }
    return false;
  };
  const grove = (x, z) => {
    const n =
      Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.7) +
      0.6 * Math.sin(x * 0.047 - z * 0.031 + 2.1) +
      0.35 * Math.sin(z * 0.083 + x * 0.012);
    return Math.max(0, Math.min(1, 0.45 + n * 0.45));
  };
  const wet = (x, z, m) =>
    parkWaterAt(x, z) ||
    parkWaterAt(x + m, z) ||
    parkWaterAt(x - m, z) ||
    parkWaterAt(x, z + m) ||
    parkWaterAt(x, z - m);
  const sites = Object.values(PARK_SITES);
  const inSite = (x, z, m) =>
    sites.some(
      (r) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m,
    );
  const H = 6,
    hash = new Map(),
    pts = [];
  const key = (x, z) => Math.floor(x / H) * 100003 + Math.floor(z / H);
  // (park r10) critic r9: 'evenly spaced round blobs / obvious instancing'. A clump field packs crowns tighter
  // (heavily overlapping masses) where it peaks and looser between, so the woods read as massed clusters of mixed
  // sizes rather than a blue-noise field of equal lollipops
  const clump = (x, z) => {
    const v = vnoise(x, z, 30, 93) * 0.7 + vnoise(x, z, 12, 94) * 0.3;
    return Math.max(0, Math.min(1, (v - 0.4) / 0.32));
  };
  let sepK = 0.43;
  const tooClose = (x, z, r) => {
    const cx = Math.floor(x / H),
      cz = Math.floor(z / H),
      k = 2;
    for (let i = cx - k; i <= cx + k; i++)
      for (let j = cz - k; j <= cz + k; j++) {
        const c = hash.get(i * 100003 + j);
        if (!c) continue;
        for (const q of c)
          if ((q.x - x) ** 2 + (q.z - z) ** 2 < ((q.r + r) * sepK) ** 2)
            return true;
      }
    return false;
  };
  let tries = 0;
  const tP0 = performance.now();
  const cnt = { park: 0, elm: 0, small: 0, conifer: 0 };
  // candidates: two shuffled jittered grids (canopy trees every ~6.5 m, then understory every ~4.5 m) -> an even,
  // closed canopy in the woods without the gaps of pure dart throwing, in one fast pass
  const cands = [];
  for (const [step, under] of [
    [5.2, false],
    [4.2, true],
  ]) {
    const L = cands.length;
    for (let x = P.x0 + 3; x < P.x1 - 3; x += step)
      for (let z = P.z0 + 3; z < P.z1 - 3; z += step)
        cands.push([x + rnd() * step, z + rnd() * step, under]);
    for (let i = cands.length - 1; i > L; i--) {
      const j = L + Math.floor(rnd() * (i - L + 1));
      const t = cands[i];
      cands[i] = cands[j];
      cands[j] = t;
    }
  }
  for (const [x, z, under] of cands) {
    tries++;
    if (x > P.x1 - 3 || z > P.z1 - 3) continue;
    const cl = clump(x, z);
    sepK = 0.47 - 0.17 * cl; // (park r10) tight inside clumps, looser between
    if (cl < 0.12 && rnd() < 0.3) continue; // (park r10) the odd dark gap between clusters
    if (tooClose(x, z, under ? 3.0 : 5.5)) continue;
    const m = meadowDist(x, z);
    // a few specimen trees stand out on the lawns' edges; the lawns themselves stay open
    // (park r6) critic r5: 'lollipops dotted singly on the lawn': lawn-edge specimens now stand in small groves of 2-6
    // where a 14 m noise field peaks, instead of a uniform 5% scatter
    if (
      m < 1.04 &&
      !(m > 0.8 && vnoise(x, z, 14, 77) > 0.72 && rnd() < (under ? 0.35 : 0.75))
    )
      continue;
    const gl =
      Math.sin(x * 0.061 + 0.4) * Math.sin(z * 0.053 - 1.1) +
      0.5 * Math.sin(x * 0.13 + z * 0.11 + 2.1 + 0.2);
    const g =
      m < 1.04
        ? 1
        : Math.min(1, grove(x, z) + 0.5) *
          Math.min(1, (m - 1.04) / 0.2 + 0.15) *
          (gl > 0.85 ? 0.2 : 1);
    if (rnd() > g * (under ? 0.6 : 1.4)) continue;
    // (park r3) open woodland / glades: scattered specimen trees over lawn (ragged canopy edges, visible ground)
    const op = parkOpen(x, z);
    if (
      op > 0.66 &&
      rnd() < Math.min(0.85, (op - 0.66) * 4.5) * (under ? 1 : 0.8)
    )
      continue; // (park r7) 0.56 -> 0.66: denser, continuous woods (critic r6)
    // (park r5) small clearings / crown gaps between stands (critic r4: 'shadowed gaps between crowns'): the dark
    // woodland floor shows through in 8-20 m holes instead of one closed, evenly packed roof
    {
      const gp = vnoise(x, z, 19, 31);
      if (gp > 0.8 && rnd() < (gp - 0.8) * 5) continue;
    } // (park r7) 0.7 -> 0.8: fewer holes ('visible gaps', critic r6)
    if (inSite(x, z, 3)) continue;
    if (
      PARK_ROCKS.some(
        ([rx, rz, R]) => (rx - x) ** 2 + (rz - z) ** 2 < (R * 0.85) ** 2,
      )
    )
      continue; // (park r8) 0.6 -> 0.85: outcrops read as clearings (critic r7) // (park r6) bare schist whalebacks
    if (wet(x, z, 1.2)) continue; // (park r2) crowns overhang the banks (natural, wooded shorelines)
    if (
      [
        [13.5, 0],
        [-13.5, 0],
        [0, 13.5],
        [0, -13.5],
        [9.5, 9.5],
        [-9.5, 9.5],
        [9.5, -9.5],
        [-9.5, -9.5],
      ].some(([dx, dz]) => parkWaterAt(x + dx, z + dz)?.name === "reservoir")
    )
      continue; // keep the track open
    const sp = rnd();
    // (park r7) evergreen stands: dark pine / spruce masses where a 70 m field peaks (+ a rare lone pine elsewhere)
    const pine = vnoise(x, z, 70, 55);
    let kind = under
      ? sp < 0.7
        ? "small"
        : "park"
      : sp < 0.58
        ? "park"
        : sp < 0.94
          ? "elm"
          : "small";
    if (m > 1.25 && ((pine > 0.7 && rnd() < 0.75) || rnd() < 0.025))
      kind = "conifer"; // woods only (no lone dark blobs on lawns)
    // (park r3) size hierarchy (critic r2: 'one height, one size'): ~10% big emergent elms / oaks (1.5-2.0x) over a
    // mixed 0.75-1.35x canopy and a 0.5-0.8x understory
    const emerg =
      !under &&
      kind !== "small" &&
      kind !== "conifer" &&
      rnd() < 0.07 + 0.2 * cl; // (park r9) 11 -> 15 %; (park r10) big crowns crown the clumps
    // (park r5) stand ages: whole groups of old tall trees next to young low stands (height layering in refs 09 / 10)
    const age = kind === "small" ? 1 : 0.64 + 0.74 * vnoise(x, z, 42, 21); // (park r9) critic r8: 'same-size puffballs': wider stand-age spread (was 0.74-1.29)
    const s =
      kind === "conifer"
        ? (0.8 + rnd() * 0.6) * age
        : (kind === "small"
            ? 0.6 + rnd() * 0.6
            : under
              ? 0.5 + rnd() * 0.3
              : emerg
                ? 1.5 + rnd() * 0.55
                : 0.75 + rnd() * rnd() * 0.6) * age;
    const r =
      (kind === "small"
        ? 3.8
        : kind === "elm"
          ? 7.2
          : kind === "conifer"
            ? 4.2
            : 6.6) * s;
    if (tooClose(x, z, r)) continue;
    // (park r11) ON HOLD 'floating crown over the reservoir': big emergent crowns (r up to ~15 m) cleared the fixed 13.5 m
    // probe but spread out over the water; the reservoir keeps its open rim for the crown's real reach
    if (r * 1.3 > 13.5) {
      const R = r * 1.3,
        D = R * 0.707;
      if (
        [
          [R, 0],
          [-R, 0],
          [0, R],
          [0, -R],
          [D, D],
          [-D, D],
          [D, -D],
          [-D, -D],
        ].some(([dx, dz]) => parkWaterAt(x + dx, z + dz)?.name === "reservoir")
      )
        continue;
    }
    // (park r2) crowns keep ~55% of their radius off the drives / walks: the path network reads as open lanes from the air
    if (nearPath(x, z) || nearPath(x, z, r * 0.75 - 1.4)) continue;
    const q = { x, z, r, h: 0 };
    pts.push(q);
    const k = key(x, z);
    let c = hash.get(k);
    if (!c) hash.set(k, (c = []));
    c.push(q);
    const pc =
      kind === "conifer"
        ? PARK_PINE[Math.floor(rnd() * PARK_PINE.length)]
        : kind === "small" && rnd() < 0.25
          ? PAL_SMALL[Math.floor(rnd() * PAL_SMALL.length)]
          : pickParkField(x, z, rnd); // (park r3) groves
    // (park r11) an autumn accent on a 1.5-2x emergent crown read as one huge brown puffball (Met view): accents stay
    // canopy-sized (maples / sweetgums are understory-to-canopy trees, the emergents are the green oaks / elms)
    const sA = emerg && PARK_AUTUMN.includes(pc) ? s * 0.68 : s;
    add(kind, x, z, sA, [pc]);
    const it = out[kind][out[kind].length - 1];
    {
      const v = 0.93 + rnd() * 0.14;
      it.extra = {
        aTintA: pc[0].map((c) => c * v * (0.975 + rnd() * 0.05)),
        aTintB: pc[1].map((c) => c * v * (0.975 + rnd() * 0.05)),
      };
    } // (park r3) grove colour, no per-tree speckle
    it.rx = (rnd() - 0.5) * 0.07;
    it.rz = (rnd() - 0.5) * 0.07; // slight lean
    it.y = G.CURB_H + 0.02;
    // broad, flat-topped crowns (open-grown park trees spread wider than they are tall)
    // (park r2) growth forms per tree (distinct silhouettes from the same crown meshes): spreading / flat-topped,
    // round, tall-columnar (lindens, pin oaks) and lopsided (edge trees leaning into the light)
    const f = rnd();
    // (park r4) critic r3: 'flat umbrella clones'. Rounder / taller crowns (refs 10-11: tall domed oaks, elms), with a
    // wider spread of forms; only a minority stays flat-topped
    let wd = kind === "small" ? 1.0 + rnd() * 0.2 : 0.98 + rnd() * 0.3,
      ht = 1;
    if (kind === "conifer") {
      wd = 0.85 + rnd() * 0.3;
      ht = 0.9 + rnd() * 0.4;
    } else if (kind !== "small") {
      if (f < 0.14) {
        wd *= 1.15;
        ht = 0.86 + rnd() * 0.1;
      } else if (f < 0.4) {
        wd *= 0.8;
        ht = 1.25 + rnd() * 0.25;
      } else ht = 1.02 + rnd() * 0.26;
      if (emerg) {
        ht = 1.0 + rnd() * 0.15;
        wd *= 1.05;
      } else if (under) ht *= 0.9;
    }
    const lop = 0.85 + rnd() * 0.3;
    it.scale3 = [wd * lop, ht, wd / lop];
    // crown-centre height (for the far canopy shadow decal) and the crown's footprint radius
    q.h =
      (kind === "small"
        ? 4.8
        : kind === "elm"
          ? 13
          : kind === "conifer"
            ? 8
            : 10) *
      sA *
      ht;
    q.cr =
      (kind === "small"
        ? 3.0
        : kind === "elm"
          ? 6.5
          : kind === "conifer"
            ? 3.2
            : 5.6) *
      sA *
      wd;
    cnt[kind]++;
  }
  // (park r10) critic r9: 'park edge is a razor-straight cut with no stone wall / bench line reading at this height'.
  // A ragged shrub border (yew / privet / viburnum lumps of 'small' crowns squashed low, 0.7-2 m tall) runs just inside
  // the perimeter wall, broken at the entrances and path mouths, so the wall line reads as a planted green edge
  {
    let nh = 0;
    const hedge = (x, z) => {
      if (inSite(x, z, 2) || wet(x, z, 1) || nearPath(x, z, 0.6)) return;
      const pc =
        rnd() < 0.8
          ? PARK_GREENS[Math.floor(rnd() * 2)]
          : PAL_SMALL[3 + Math.floor(rnd() * 2)];
      const v = 0.72 + rnd() * 0.2;
      out.small.push({
        hedge: true,
        x,
        y: G.CURB_H + 0.02,
        z,
        ry: rnd() * Math.PI * 2,
        s: 0.34 + rnd() * 0.14,
        scale3: [1.45 + rnd() * 0.4, 0.62 + rnd() * 0.22, 1.45 + rnd() * 0.4],
        extra: {
          aTintA: pc[0].map((c) => c * v),
          aTintB: pc[1].map((c) => c * v),
        },
      });
      nh++;
    };
    for (let z = P.z1 - 3; z > P.z0 + 3; z -= 1.9 + rnd() * 1.6) {
      if (rnd() > 0.1) hedge(P.x0 + 1.5 + rnd() * 0.8, z);
      if (rnd() > 0.1) hedge(P.x1 - 1.5 - rnd() * 0.8, z);
    }
    for (let x = P.x0 + 3; x < P.x1 - 3; x += 1.9 + rnd() * 1.6) {
      if (rnd() > 0.1) hedge(x, P.z1 - 1.5 - rnd() * 0.8);
      if (rnd() > 0.1) hedge(x, P.z0 + 1.5 + rnd() * 0.8);
    }
    cnt.hedge = nh;
  }
  out.parkTrees = pts.length;
  // (veg r1) bark species per tree: street trees mostly London plane (+ honey locust / pear dark bark, some oaks), park
  // oaks / planes in stands, elms + ornamentals dark furrowed, conifers the oak layer tinted red-brown (pine plates)
  {
    const br = mulberry32(4242);
    for (const kind of Object.keys(kinds))
      for (const it of out[kind]) {
        const u = br();
        const L =
          kind === "street"
            ? u < 0.6
              ? BARK.PLANE
              : u < 0.84
                ? BARK.DARK
                : BARK.OAK
            : kind === "park"
              ? vnoise(it.x, it.z, 38, 61) * 0.75 + u * 0.25 < 0.4
                ? BARK.PLANE
                : BARK.OAK
              : kind === "elm"
                ? u < 0.7
                  ? BARK.DARK
                  : BARK.OAK
                : kind === "small"
                  ? u < 0.65
                    ? BARK.DARK
                    : u < 0.85
                      ? BARK.OAK
                      : BARK.PLANE
                  : BARK.OAK;
        const v = (0.7 + br() * 0.22) * (L === BARK.PLANE ? 0.86 : 1);
        const t =
          kind === "conifer"
            ? [1.12, 0.84, 0.7]
            : [1, 0.97 + br() * 0.05, 0.93 + br() * 0.07];
        it.extra = {
          ...(it.extra ?? {}),
          aBark: [L, t[0] * v, t[1] * v, t[2] * v],
        };
      }
  }
  // (veg r1) trunk collision: one vertical frustum (CYL) per tree, about the trunk radius, from just under the base to
  // <= 4 m (static, in the collision grid: no per-frame cost). The shrub border is walk-through. city.js calls this
  // after the props refit (fitInstancedSolids may cull solids inside a prop footprint).
  out.addSolids = (S) => {
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      p = new THREE.Vector3(),
      sc = new THREE.Vector3(),
      v = new THREE.Vector3();
    let n = 0;
    for (const kind of Object.keys(kinds)) {
      const C = colliders[kind];
      for (const it of out[kind]) {
        if (it.hedge) continue;
        e.set(it.rx || 0, it.ry, it.rz || 0, "YXZ");
        q.setFromEuler(e);
        const s3 = it.scale3 ?? [1, 1, 1];
        sc.set(s3[0] * it.s, s3[1] * it.s, s3[2] * it.s);
        m.compose(p.set(it.x, it.y, it.z), q, sc);
        v.set(C.x, 0, C.z).applyMatrix4(m);
        const rs = (sc.x + sc.z) / 2,
          r0 = C.r0 * rs,
          r1 = C.r1 * rs;
        if (r0 < 0.05) continue;
        S.cyl(
          v.x,
          v.z,
          it.y - 0.2,
          it.y + Math.min(4, C.y1 * sc.y),
          r0,
          r1,
          "trunk",
          8,
        ); // (veg r1) BLOCKONLY: walking only (no wall-run / perch / camera / webs)
        n++;
      }
    }
    console.log(`[trees] (veg r1) ${n} trunk colliders`);
    return n;
  };
  if (typeof window !== "undefined") window.__trees = out; // (veg r1) debug / playtest probes (tree positions)
  const shade = canopyShade(pts);
  scene.add(shade.mesh);
  console.log(
    `[trees] park ${pts.length} (${cnt.park}/${cnt.elm}/${cnt.small}/${cnt.conifer}) hedge ${cnt.hedge} in ${tries} tries, ${(performance.now() - tP0).toFixed(0)} ms`,
  );
  out.meadows = meadows;
  let t = 0;
  let rr = 0;
  let sunL = null;
  out.update = (dt, cam) => {
    t += dt;
    leafMat.userData.uTime.value = t;
    // sun direction for the canopy shadow decals (the CSM's light 0; found once in the top-level scene)
    if (!sunL) {
      let top = scene;
      while (top.parent) top = top.parent;
      top.traverse((o) => {
        if (!sunL && o.isDirectionalLight && o.castShadow) sunL = o;
      });
    }
    if (sunL) shade.setSun(sunL);
    const t0 = performance.now(); // repack budget (~0.5 ms), round-robin over the due pools
    for (let i = 0; i < pools.length; i++) {
      const p = pools[(rr + i) % pools.length];
      if (!p.due(cam)) continue;
      p.update(cam);
      if (performance.now() - t0 > 0.5) {
        rr = (rr + i + 1) % pools.length;
        break;
      }
    }
  };
  return out;
}
