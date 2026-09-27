// OWNER: rooftops agent. Rooftop fabric seen from swinging altitude (refs/city/manhattan_02/03/06):
//  - roof "skins": a textured surface (tar, ballast gravel, white/grey membrane, red / silver coatings, black EPDM, pavers,
//    timber deck, sedum, lawn) laid 6 mm over every exposed roof of every building (incl. setback terraces), with
//    parapet-edge grime, world-space stains + ponding (never tiles), repair patches and per-roof colour families;
//  - rooftop structures in the facade material (written into the city's per-tile facade + far-LOD builders, so they
//    cost no draw calls): residential penthouse additions, stair bulkheads, brick chimneys;
//  - a rooftop prop KIT merged per 256 m tile in ONE vertex-coloured, atlas-textured material, placed in CLUSTERS by
//    roof type: louvred mechanical penthouses + elevator machine rooms, cooling-tower cells, air handlers with ducts,
//    packaged HVAC of several shapes, mushroom / gooseneck vents, timber water tanks on steel stands, steel tanks,
//    satellite-dish clusters, TV antennas, lattice masts, solar arrays, skylights (flat + pyramid), greenhouses,
//    roof gardens (lawn, raised beds, trees, pergolas), deck furniture, rooftop pools, guard rails;
//  - rear-yard dressing in the block interiors (lawn / patio / gravel yards, fences, sheds, yard trees);
//  - louvre cladding over the buildings.js glass-tower mechanical screen (was a white untextured cube);
//  - exact collision (collision.js Solids) for every solid piece + roofCorner zip points on the big structures.
// Contract: buildRooftops({ scene, gen, facadeMat, T, progress? }) -> Promise<{ update(camera), stats }>. Must run BEFORE the tile
// facade meshes are built (it appends to gen.tiles' builders) and before props (props avoid our solids).
import * as THREE from 'three';
import { mulberry32, district, blockAt, ZFIX } from './layout.js';
import { STYLE, LAYER } from './facade.js';
import { KIND } from './collision.js';
import { CanopyBatch } from './canopy.js';
import { RoofPlants, PLANT } from './roofplants.js'; // (veg r1) leaf-card shrubs / grasses / perennials
import { GY } from './ground.js';
import { batchTiles } from './tilebatch.js'; // (perf)
import { loadImageRetry } from './textures.js'; // retrying loader (ERR_INSUFFICIENT_RESOURCES must not abort the city)

const TILE = 256;
// atlas cells (tools/roof_textures.py layer order) and metres per texture repeat
export const CELL = { TAR: 0, GRAVEL: 1, TAN: 2, MEMBRANE: 3, BITUMEN: 4, PAVERS: 5, DECK: 6, GREEN: 7, METAL: 8, PADS: 9,
  RED: 10, SILVER: 11, EPDM: 12, LAWN: 13, LOUVRE: 14, SOLAR: 15, STAVES: 16, GLASS: 17, FAN: 18 };
const CELL_M = [12, 8, 8, 18, 10, 4.8, 4.2, 10, 3, 3.6, 10, 12, 15, 6, 3, 2, 3, 3, 1];
const CELL_ROUGH = [0.92, 0.95, 0.95, 0.6, 0.85, 0.85, 0.8, 0.95, 0.55, 0.9, 0.8, 0.5, 0.75, 0.95, 0.6, 0.22, 0.85, 0.12, 0.6];
const PONDS = [1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]; // flat membranes hold water (dark glossy ponding)
// r4: sheet / roll width in metres (0 = seamless): single-ply membrane 3 m, mod-bit / silver-coated rolls 1 m, EPDM 6 m
const SEAM = [0, 0, 0, 3.0, 1.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // (textures r4) EPDM (12): the $imagegen sheet carries its own taped seam grid // (textures r3) RED / SILVER: the $imagegen coatings carry their own 1 m roll seams
// r4: cells that take dark tar-patch blotches (hot-mopped repairs)
const TARP = [1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0];
// far-LOD stand-in (facade roof layers) for each roof cell: [layer, tint]
const FAR = {
  [CELL.TAR]: [LAYER.ROOF, [0.95, 0.95, 0.93]], [CELL.GRAVEL]: [LAYER.ROOF_GRAVEL, [1.0, 0.98, 0.95]], [CELL.TAN]: [LAYER.ROOF_GRAVEL, [1.0, 0.85, 0.7]],
  [CELL.MEMBRANE]: [LAYER.ROOF_MEMBRANE, [0.92, 0.92, 0.9]], [CELL.BITUMEN]: [LAYER.ROOF, [1.1, 1.1, 1.08]], [CELL.PAVERS]: [LAYER.ROOF_PAVERS, [1, 0.98, 0.94]],
  [CELL.DECK]: [LAYER.ROOF_PAVERS, [0.8, 0.62, 0.48]], [CELL.GREEN]: [LAYER.ROOF_GREEN, [0.8, 0.85, 0.75]],
  [CELL.RED]: [LAYER.ROOF, [1.35, 0.85, 0.72]], [CELL.SILVER]: [LAYER.ROOF_MEMBRANE, [0.8, 0.8, 0.8]], [CELL.EPDM]: [LAYER.ROOF, [0.62, 0.62, 0.62]],
  [CELL.LAWN]: [LAYER.ROOF_GREEN, [0.85, 0.95, 0.8]],
};

const srgb = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map(s => Math.pow(s, 2.2));
const jit = (c, r, a = 0.08) => { const k = 1 + (r() - 0.5) * 2 * a; return c.map(v => v * k); };
const pick = (a, r) => a[Math.floor(r() * a.length)];

// ------------------------------------------------------------------------------------------ textures
function loadImage(src) {
  return loadImageRetry(src);
}
function arrayTex(im, srgbSpace, aniso) {
  const size = im.width, layers = Math.round(im.height / im.width);
  const cv = document.createElement('canvas'); cv.width = size; cv.height = im.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(im, 0, 0);
  const d = cx.getImageData(0, 0, size, im.height).data;
  const data = new Uint8Array(size * size * 4 * layers);
  for (let L = 0; L < layers; L++) for (let y = 0; y < size; y++) { // flip Y per layer (v = 0 at the bottom)
    const src = ((L * size) + (size - 1 - y)) * size * 4;
    data.set(d.subarray(src, src + size * 4), (L * size * size + y * size) * 4);
  }
  const t = new THREE.DataArrayTexture(data, size, size, layers);
  t.colorSpace = srgbSpace ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = aniso; t.needsUpdate = true;
  return t;
}

function createRoofMaterial(tc, tn, noise) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const uni = { tRoofC: { value: tc }, tRoofN: { value: tn }, tNoiseR: { value: noise } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 aM; attribute vec4 aE; varying vec2 vRUv; flat varying vec4 vM; flat varying vec4 vE; varying vec3 vRWP; varying vec3 vRWN;`)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
      vRUv = uv; vM = aM; vE = aE; vRWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vRWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform highp sampler2DArray tRoofC; uniform highp sampler2DArray tRoofN; uniform sampler2D tNoiseR;
      varying vec2 vRUv; flat varying vec4 vM; flat varying vec4 vE; varying vec3 vRWP; varying vec3 vRWN;
      float rR; float rM; vec3 rN;
      const float ROUGH[${CELL_ROUGH.length}] = float[${CELL_ROUGH.length}](${CELL_ROUGH.map(v => v.toFixed(2)).join(', ')});
      const float PONDS[${PONDS.length}] = float[${PONDS.length}](${PONDS.map(v => v.toFixed(1)).join(', ')});
      const float SEAM[${SEAM.length}] = float[${SEAM.length}](${SEAM.map(v => v.toFixed(1)).join(', ')});
      const float TARP[${TARP.length}] = float[${TARP.length}](${TARP.map(v => v.toFixed(1)).join(', ')});
      float rHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 N = normalize(vRWN);
        rR = 0.85; rM = 0.0; rN = vec3(0.0, 0.0, 1.0);
        float cell = vM.x;
        vec2 tuv = vRUv * vM.y;
        vec3 nz = texture(tNoiseR, vRWP.xz / 70.0 + vRWP.y / 130.0).rgb;
        vec3 nz2 = texture(tNoiseR, vRWP.xz / 13.0 + 0.37).rgb;
        int ci = int(cell + 0.5);
        if (cell > -0.5) {
          vec3 tc = texture(tRoofC, vec3(tuv, cell)).rgb;
          diffuseColor.rgb *= tc;
          rR = ROUGH[ci];
          rN = texture(tRoofN, vec3(tuv, cell)).xyz * 2.0 - 1.0;
          rN.xy *= 0.8;
        }
        if (vM.w > 0.5) { // rooftop pool water: dark teal, glossy, gentle ripples
          float rip = texture(tNoiseR, vRWP.xz / 3.0).g;
          diffuseColor.rgb = vec3(0.09, 0.3, 0.34) * (0.85 + 0.3 * rip); rR = 0.08; // r4: lighter pool blue (ref 02 / 03) rN = normalize(vec3((rip - 0.5) * 0.15, 0.0, 1.0));
        }
        if (ci == ${CELL.EPDM}) diffuseColor.rgb *= 1.5; // r4: dusty, weathered rubber (pure black read as holes)
        // macro tone variation (kills repetition across a roof)
        diffuseColor.rgb *= (0.86 + 0.26 * nz.r) * (0.94 + 0.12 * nz2.g);
        if (vM.z > 0.0) { // roof skin
          // parapet grime: dark wet band at the base of the parapet, streaky, fading into the field
          float d = min(min(vRUv.x - vE.x, vE.z - vRUv.x), min(vRUv.y - vE.y, vE.w - vRUv.y));
          float ed = d + (nz2.b - 0.5) * 0.9;
          diffuseColor.rgb *= mix(0.4, 1.0, smoothstep(0.0, vM.z * 2.2, ed)); // r4: deeper soot band
          diffuseColor.rgb *= mix(vec3(0.93, 0.9, 0.84), vec3(1.0), smoothstep(0.0, vM.z * 4.0, ed)); // dust / rust-brown drift toward the walls
          // r6: per-roof dirt gradient (roofs drain / collect soot toward one side) + drain sumps: dark wet blotches
          {
            vec2 rsz = max(vE.zw - vE.xy, vec2(1.0)), rc = (vRUv - vE.xy) / rsz;
            float ang = rHash(floor(vE.xy * 0.37)) * 6.2832;
            float gdt = dot(rc - 0.5, vec2(cos(ang), sin(ang)));
            diffuseColor.rgb *= 1.0 - (0.08 + 0.12 * rHash(floor(vE.zw))) * smoothstep(-0.55, 0.55, gdt);
            vec2 dp = vE.xy + rsz * vec2(0.25 + 0.5 * rHash(floor(vE.xy) + 1.7), 0.25 + 0.5 * rHash(floor(vE.zw) + 2.9));
            float dd = length(vRUv - dp) + (nz2.r - 0.5) * 1.6;
            float sump = 1.0 - smoothstep(0.4, 2.6 + 1.5 * rHash(floor(vE.xy) + 4.1), dd);
            diffuseColor.rgb *= 1.0 - 0.3 * sump; rR = mix(rR, 0.35, sump * 0.6);
          }
          // r4: sheets / rolls: per-sheet tone + dark lap seams (antialiased), end laps every ~12 m
          if (ci >= 0 && ci < ${SEAM.length} && SEAM[ci] > 0.0) {
            float su = vRUv.x / SEAM[ci], sid = floor(su);
            diffuseColor.rgb *= 0.92 + 0.16 * rHash(vec2(sid, floor(vE.x * 0.7)));
            float fu = fract(su), fwu = max(fwidth(su), 1e-4);
            float seam = 1.0 - smoothstep(0.0, fwu * 1.2 + 0.02, min(fu, 1.0 - fu));
            float sv = (vRUv.y + rHash(vec2(sid, 3.7)) * 12.0) / 12.0, fv = fract(sv), fwv = max(fwidth(sv), 1e-4);
            seam = max(seam, 0.7 * (1.0 - smoothstep(0.0, fwv * 1.2 + 0.004, min(fv, 1.0 - fv))));
            diffuseColor.rgb *= 1.0 - 0.3 * seam * smoothstep(0.6, 0.15, fwu);
          }
          // r4: hot-mopped tar patches (dark, semi-glossy blotches with crisp edges)
          if (ci >= 0 && ci < ${TARP.length} && TARP[ci] > 0.5) {
            float tpn = texture(tNoiseR, vRWP.xz / 7.0 + vec2(0.23, 0.71)).r * 0.65 + texture(tNoiseR, vRWP.zx / 29.0 + 0.5).g * 0.35;
            float tp = smoothstep(0.64, 0.66, tpn);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.28 + vec3(0.012), tp * 0.85); rR = mix(rR, 0.5, tp);
          }
          // world-space stains at three scales (non-repeating) : soot / algae / dust drifts
          vec3 w1 = texture(tNoiseR, vRWP.xz / 41.0 + 0.13).rgb;
          vec3 w2 = texture(tNoiseR, vRWP.zx / 17.0 + 0.71).rgb;
          float stain = smoothstep(0.52, 0.8, w1.g * 0.55 + w2.r * 0.45);
          diffuseColor.rgb *= 1.0 - 0.26 * stain;
          diffuseColor.rgb *= mix(vec3(1.0), vec3(1.03, 1.0, 0.95), smoothstep(0.55, 0.85, w2.b)); // rust / tannin tinge (r4: weaker, read green on grey)
          // repair patches: rectangles on a per-roof grid (uv already carries a per-roof random offset)
          // r4: only on membranes / coatings (not ballast or pavers), rarer and bigger (the small ones read as camo squares)
          vec2 pg = vec2(6.0 + 3.0 * rHash(floor(vE.xy)), 4.5 + 3.0 * rHash(floor(vE.zw)));
          vec2 pc = floor(vRUv / pg), pf = fract(vRUv / pg);
          float ph = fract(sin(dot(pc, vec2(12.9898, 78.233)) + dot(floor(vE.xy), vec2(0.0137, 0.0291))) * 43758.5453);
          vec2 pa = vec2(0.05 + 0.3 * rHash(pc + 3.1), 0.05 + 0.3 * rHash(pc + 7.7)), pb = vec2(0.6 + 0.35 * rHash(pc + 1.3), 0.55 + 0.4 * rHash(pc + 5.9));
          if (ci >= 0 && ci < ${TARP.length} && TARP[ci] > 0.5 && ph < 0.07 && pf.x > pa.x && pf.y > pa.y && pf.x < pb.x && pf.y < pb.y) { diffuseColor.rgb *= 0.7 + ph * 5.0; rR = min(1.0, rR + 0.05); }
          // ponding on flat membranes: dark, glossy puddle stains with a dried rim
          if (ci >= 0 && ci < ${PONDS.length} && PONDS[ci] > 0.5) {
            float pw = texture(tNoiseR, vRWP.xz / 9.0 + vec2(0.61, 0.27)).b * 0.7 + w1.r * 0.3;
            float pond = smoothstep(0.66, 0.72, pw), rim = smoothstep(0.6, 0.66, pw) - pond;
            diffuseColor.rgb *= (1.0 - 0.32 * pond) * (1.0 + 0.1 * rim);
            rR = mix(rR, 0.18, pond); rN = normalize(mix(rN, vec3(0.0, 0.0, 1.0), pond));
          }
        } else { // clutter: grime + contact darkening near the base, rain streaks on the sides
          float hb = vRWP.y - vE.x;
          diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.45, hb));
          if (abs(N.y) < 0.5) {
            diffuseColor.rgb *= 1.0 - 0.22 * smoothstep(0.55, 0.9, texture(tNoiseR, vec2((vRWP.x + vRWP.z) * 0.7, vRWP.y * 0.06)).g);
            // r8: rust runs + weathering on sheet-metal housings (critic: "boxes look like primitive cubes, add rust")
            if (ci == ${CELL.METAL} || ci == ${CELL.LOUVRE}) {
              float rn = texture(tNoiseR, vec2((vRWP.x - vRWP.z) * 1.7 + 0.13, vRWP.y * 0.09 + 0.41)).r * 0.7 + nz2.b * 0.3;
              diffuseColor.rgb *= mix(vec3(1.0), vec3(0.86, 0.7, 0.55), smoothstep(0.58, 0.82, rn) * 0.75);
            }
          } else if (vM.w < 0.5) { // tops: dusty, blotchy, a rust bloom here and there (sun-lit clean tops read as white dice)
            float tb = texture(tNoiseR, vRWP.xz / 2.3 + 0.57).g;
            diffuseColor.rgb *= (0.9 + 0.16 * tb) * mix(vec3(1.0), vec3(0.9, 0.8, 0.68), smoothstep(0.66, 0.86, nz2.r) * 0.6);
          }
          if (ci == ${CELL.SOLAR} || ci == ${CELL.GLASS}) rM = 0.2;
        }
        diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.64); // muted (r3: 0.82 -> 0.64, critic: saturated colour cards)
      }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rR;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = rM;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec3 Nw = normalize(vRWN); vec3 Tw, Bw;
        if (abs(Nw.y) > 0.5) { Tw = vec3(1.0, 0.0, 0.0); Bw = vec3(0.0, 0.0, -1.0); } else { Tw = normalize(cross(vec3(0.0, 1.0, 0.0), Nw)); Bw = vec3(0.0, 1.0, 0.0); }
        vec3 nw = normalize(Tw * rN.x + Bw * rN.y + Nw * rN.z);
        if (rN.z < 0.9999) normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz); }`);
  };
  mat.customProgramCacheKey = () => 'city-rooftops-v8';
  return mat;
}

// ------------------------------------------------------------------------------------------ merged builder
// growable typed buffer (plain JS number arrays for ~3M roof tris cost > 1 GB of heap and crashed the page)
class FBuf {
  constructor(T = Float32Array, n = 1024) { this.T = T; this.a = new T(n); this.length = 0; }
  push(...v) {
    if (this.length + v.length > this.a.length) { const b = new this.T(Math.max(this.a.length * 2, this.length + v.length)); b.set(this.a); this.a = b; }
    for (let k = 0; k < v.length; k++) this.a[this.length++] = v[k];
  }
  out(T = this.T) { return T === this.T ? this.a.slice(0, this.length) : T.from(this.a.subarray(0, this.length)); }
}
class RB {
  constructor() { this.p = new FBuf(); this.n = new FBuf(); this.uv = new FBuf(); this.c = new FBuf(); this.m = new FBuf(); this.e = new FBuf(); this.i = new FBuf(Uint32Array); this.v = 0; }
  _v(x, y, z, nx, ny, nz, u, v, col, M, E) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(col[0], col[1], col[2]);
    this.m.push(M[0], M[1], M[2], M[3]); this.e.push(E[0], E[1], E[2], E[3]); return this.v++;
  }
  // roof skin: rect at y, uv = (x, -z) + offset (metres), rot swaps the texture axes; edge dirt within `ew` m of the rect
  skin(x0, z0, x1, z1, y, cell, col, ou, ov, rot, ew = 1.2) {
    const s = 1 / CELL_M[cell];
    const U = (x, z) => (rot ? [-z + ou, -x + ov] : [x + ou, -z + ov]);
    const a = U(x0, z0), b = U(x1, z1);
    const E = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    const M = [cell, s, ew, 0];
    const ids = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]].map(([x, z]) => { const [u, v] = U(x, z); return this._v(x, y, z, 0, 1, 0, u, v, col, M, E); });
    this.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    return { x0, z0, x1, z1, y, U, M, E, col };
  }
  // axis-aligned box without bottom face; uv in metres per face; `top` optional separate top colour / cell
  box(x0, y0, z0, x1, y1, z1, cell, col, topCol = null, topCell = null, water = 0) {
    const s = 1 / CELL_M[cell >= 0 ? cell : 8];
    const M = [cell, s, 0, 0], E = [y0, 0, 0, 0];
    const F = [
      [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], (x, y, z) => [-z, y]],
      [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], (x, y, z) => [z, y]],
      [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], (x, y, z) => [x, y]],
      [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], (x, y, z) => [-x, y]],
    ];
    for (const [nn, q, uvf] of F) {
      const ids = q.map(([x, y, z]) => { const [u, v] = uvf(x, y, z); return this._v(x, y, z, nn[0], nn[1], nn[2], u, v, col, M, E); });
      this.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    }
    if (topCol === false) return;
    const tc = topCell ?? cell, Mt = [tc, 1 / CELL_M[tc >= 0 ? tc : 8], 0, water];
    const ids = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]].map(([x, z]) => this._v(x, y1, z, 0, 1, 0, x, -z, topCol ?? col, Mt, E));
    this.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
  }
  // oriented box (centre c, half sizes h, basis ux / uy / uz unit vectors) with all 6 faces
  obox(c, h, ux, uy, uz, cell, col, topCol = null, base = null) {
    const s = 1 / CELL_M[cell >= 0 ? cell : 8];
    const M = [cell, s, 0, 0], E = [base ?? (c[1] - Math.abs(h[1] * uy[1]) - Math.abs(h[0] * ux[1]) - Math.abs(h[2] * uz[1])), 0, 0, 0];
    const P = (a, b, d) => [c[0] + ux[0] * a * h[0] + uy[0] * b * h[1] + uz[0] * d * h[2], c[1] + ux[1] * a * h[0] + uy[1] * b * h[1] + uz[1] * d * h[2], c[2] + ux[2] * a * h[0] + uy[2] * b * h[1] + uz[2] * d * h[2]];
    // faces: normal axis, sign, the two in-plane axes (for uv)
    const faces = [[ux, 1, 'yz'], [ux, -1, 'yz'], [uy, 1, 'xz'], [uy, -1, 'xz'], [uz, 1, 'xy'], [uz, -1, 'xy']];
    for (const [nv, sg, pl] of faces) {
      let q;
      if (pl === 'yz') q = [[sg, -1, sg], [sg, -1, -sg], [sg, 1, -sg], [sg, 1, sg]];
      else if (pl === 'xz') q = [[-1, sg, sg], [1, sg, sg], [1, sg, -sg], [-1, sg, -sg]];
      else q = [[-sg, -1, sg], [sg, -1, sg], [sg, 1, sg], [-sg, 1, sg]];
      const col2 = pl === 'xz' && sg > 0 && topCol ? topCol : col;
      const ids = q.map(([a, b, d]) => {
        const p = P(a, b, d);
        const u = pl === 'yz' ? d * h[2] : a * h[0], v = pl === 'xz' ? d * h[2] : b * h[1];
        return this._v(p[0], p[1], p[2], nv[0] * sg, nv[1] * sg, nv[2] * sg, u, v, col2, M, E);
      });
      this.i.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    }
  }
  // flat disc (fan grille) lying on a surface
  // r7: a C_DARK disc is a fan: textured with the FAN atlas cell (blades, hub, wire guard rings; uv 0..1 across the disc)
  disc(cx, y, cz, r, col, seg = 10) {
    const fan = col === C_DARK, M = fan ? [CELL.FAN, 1, 0, 0] : [-1, 1, 0, 0], E = [y - 1, 0, 0, 0], fc = fan ? [0.42, 0.42, 0.42] : col;
    if (fan) seg = Math.max(seg, 12);
    const c = this._v(cx, y, cz, 0, 1, 0, 0.5, 0.5, fc, M, E);
    const ring = [];
    for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; ring.push(this._v(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, 0, 1, 0, 0.5 + Math.cos(a) * 0.5, 0.5 - Math.sin(a) * 0.5, fc, M, E)); }
    for (let k = 0; k < seg; k++) this.i.push(c, ring[k + 1], ring[k]);
  }
  // vertical cylinder (tanks, vent stacks, cooling-tower fan shrouds)
  cyl(cx, cz, r, y0, y1, col, seg = 10, cell = CELL.METAL, topCol = null) {
    // r7: a fan shroud (dark cap on a unit) gets a raised shroud lip + the textured fan disc sunk just under the lip
    if (topCol === C_DARK && seg >= 6) {
      const h = y1 - y0;
      this.lathe([cx, y0, cz], [0, 1, 0], [[r, 0], [r, h + 0.08], [r * 0.9, h + 0.08], [r * 0.9, h * 0.5]], 12, col, cell, { base: y0 - 0.5 });
      this.disc(cx, y0 + h * 0.5, cz, r * 0.9, C_DARK, 12);
      return;
    }
    this.lathe([cx, y0, cz], [0, 1, 0], [[r, 0], [r, y1 - y0]], seg, col, cell, { cap: topCol ?? col, base: y0 });
  }
  // surface of revolution around axis `ax` through origin `o`; prof = [[radius, height], ...] from the bottom up.
  // opts: cap (colour of a flat top cap at the last profile point), back (also emit reversed faces), rot0, base, uvScale
  lathe(o, ax, prof, seg, col, cell, opts = {}) {
    const M = [cell, 1 / CELL_M[cell >= 0 ? cell : 8], 0, 0], E = [opts.base ?? o[1], 0, 0, 0];
    // basis perpendicular to the axis
    const a = new THREE.Vector3(...ax).normalize();
    const t0 = Math.abs(a.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const b1 = new THREE.Vector3().crossVectors(a, t0).normalize(), b2 = new THREE.Vector3().crossVectors(b1, a);
    const rows = [];
    for (let j = 0; j < prof.length; j++) {
      const [r, h] = prof[j];
      const jp = prof[Math.max(0, j - 1)], jn = prof[Math.min(prof.length - 1, j + 1)];
      const dr = jn[0] - jp[0], dh = jn[1] - jp[1]; // profile tangent -> normal (dh, -dr) in (radial, axial)
      const L = Math.hypot(dr, dh) || 1, nr = dh / L, nh = -dr / L;
      const row = [];
      for (let k = 0; k <= seg; k++) {
        const ang = (opts.rot0 ?? 0) + k / seg * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const rx = b1.x * ca + b2.x * sa, ry = b1.y * ca + b2.y * sa, rz = b1.z * ca + b2.z * sa;
        const p = [o[0] + rx * r + a.x * h, o[1] + ry * r + a.y * h, o[2] + rz * r + a.z * h];
        const n = [rx * nr + a.x * nh, ry * nr + a.y * nh, rz * nr + a.z * nh];
        row.push(this._v(p[0], p[1], p[2], n[0], n[1], n[2], ang * Math.max(r, 0.3), h, col, M, E));
      }
      rows.push(row);
    }
    for (let j = 0; j + 1 < rows.length; j++) for (let k = 0; k < seg; k++) {
      const A0 = rows[j][k], A1 = rows[j][k + 1], B0 = rows[j + 1][k], B1 = rows[j + 1][k + 1];
      this.i.push(A1, A0, B0, A1, B0, B1);
      if (opts.back) this.i.push(A1, B0, A0, A1, B1, B0);
    }
    if (opts.back) { // back faces need flipped normals: duplicate the rows with negated normals
      // (cheap approximation: shading of the back side uses the front normal; acceptable for thin dishes seen at range)
    }
    if (opts.cap) {
      const [r, h] = prof[prof.length - 1];
      if (r > 0.001) {
        const cc = [o[0] + a.x * h, o[1] + a.y * h, o[2] + a.z * h];
        const c = this._v(cc[0], cc[1], cc[2], a.x, a.y, a.z, cc[0], -cc[2], opts.cap, M, E);
        const ring = [];
        for (let k = 0; k <= seg; k++) {
          const ang = (opts.rot0 ?? 0) + k / seg * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
          const p = [cc[0] + (b1.x * ca + b2.x * sa) * r, cc[1] + (b1.y * ca + b2.y * sa) * r, cc[2] + (b1.z * ca + b2.z * sa) * r];
          ring.push(this._v(p[0], p[1], p[2], a.x, a.y, a.z, p[0], -p[2], opts.cap, M, E));
        }
        for (let k = 0; k < seg; k++) this.i.push(c, ring[k + 1], ring[k]);
      }
    }
  }
  build() {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p.out(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.n.out(), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.out(), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.c.out(), 3));
    g.setAttribute('aM', new THREE.BufferAttribute(this.m.out(), 4));
    g.setAttribute('aE', new THREE.BufferAttribute(this.e.out(), 4));
    g.setIndex(new THREE.BufferAttribute(this.i.out(this.v > 65535 ? Uint32Array : Uint16Array), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// ------------------------------------------------------------------------------------------ contact AO
// Soft contact shadows where props / structures / parapets meet a roof: rings of quads (dark at the footprint, white
// `w` metres out) drawn 1 cm over the roof in a MULTIPLY-blended overlay (one mesh per tile, no depth write), so
// overlapping rings compound like real occlusion and the roof texture underneath is untouched.
class AOB {
  constructor() { this.p = new FBuf(); this.c = new FBuf(); this.i = new FBuf(Uint32Array); this.v = 0; }
  _v(x, y, z, k) { this.p.push(x, y, z); this.c.push(Math.pow(k, 0.92), k, Math.pow(k, 1.12)); return this.v++; } // r4: faintly rust / dirt brown contact grime
  ring(y, x0, z0, x1, z1, w, dark, clip = null) {
    let X0 = x0 - w, Z0 = z0 - w, X1 = x1 + w, Z1 = z1 + w;
    if (clip) { X0 = Math.max(X0, clip.x0); Z0 = Math.max(Z0, clip.z0); X1 = Math.min(X1, clip.x1); Z1 = Math.min(Z1, clip.z1); }
    const yy = y + 0.02;
    const i0 = this._v(x0, yy, z0, dark), i1 = this._v(x1, yy, z0, dark), i2 = this._v(x1, yy, z1, dark), i3 = this._v(x0, yy, z1, dark);
    const o0 = this._v(X0, yy, Z0, 1), o1 = this._v(X1, yy, Z0, 1), o2 = this._v(X1, yy, Z1, 1), o3 = this._v(X0, yy, Z1, 1);
    this.i.push(o0, i0, i1, o0, i1, o1, o1, i1, i2, o1, i2, o2, o2, i2, i3, o2, i3, o3, o3, i3, i0, o3, i0, o0);
  }
  // inner band along the four walls of a rect (parapet AO): dark at the wall, white `w` metres in
  band(y, x0, z0, x1, z1, w, dark) {
    if (x1 - x0 < 2 * w + 0.5 || z1 - z0 < 2 * w + 0.5) w = Math.min(x1 - x0, z1 - z0) * 0.3;
    const yy = y + 0.02;
    const o0 = this._v(x0, yy, z0, dark), o1 = this._v(x1, yy, z0, dark), o2 = this._v(x1, yy, z1, dark), o3 = this._v(x0, yy, z1, dark);
    const i0 = this._v(x0 + w, yy, z0 + w, 1), i1 = this._v(x1 - w, yy, z0 + w, 1), i2 = this._v(x1 - w, yy, z1 - w, 1), i3 = this._v(x0 + w, yy, z1 - w, 1);
    this.i.push(o0, i0, i1, o0, i1, o1, o1, i1, i2, o1, i2, o2, o2, i2, i3, o2, i3, o3, o3, i3, i0, o3, i0, o0);
  }
  build() {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p.out(), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c.out(), 3));
    g.setIndex(new THREE.BufferAttribute(this.i.out(this.v > 65535 ? Uint32Array : Uint16Array), 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------------------------------------ r6: facade rain streaks
// Dark water / soot staining running down the walls from the parapet caps and cornices (critic: "clean CAD boxes, add
// dark water-staining streaks down the facade from the caps"). One quad per exposed wall, 3 cm proud of the wall plane,
// drawn in a MULTIPLY-blended overlay (one mesh per tile, no depth write): streak columns + lengths come from the noise
// texture in wall-local metres (never tile), the top gets a darker drip band, the strength fades out with distance.
class StreakB {
  constructor() { this.p = new FBuf(); this.s = new FBuf(); this.t = new FBuf(); this.i = new FBuf(Uint32Array); this.v = 0; }
  // wall from (ax, az) to (bx, bz) (outward normal n), from `top` down `h` metres; k = strength, u0 = streak-column offset
  // r7: tint (multiplied rgb) + w = blank-party-wall weathering amount (large blotches, patched brick, tar ghost lines)
  wall(ax, az, bx, bz, nx, nz, top, h, k, u0, tint = [1, 1, 1], w = 0) {
    const o = 0.03, L = Math.hypot(bx - ax, bz - az);
    if (L < 1 || h < 1) return;
    const X0 = ax + nx * o, Z0 = az + nz * o, X1 = bx + nx * o, Z1 = bz + nz * o;
    const V = [[X0, top, Z0, u0, 0], [X1, top, Z1, u0 + L, 0], [X1, top - h, Z1, u0 + L, h], [X0, top - h, Z0, u0, h]];
    const b = this.v;
    for (const [x, y, z, u, d] of V) { this.p.push(x, y, z); this.s.push(u, d, h, k); this.t.push(tint[0], tint[1], tint[2], w); this.v++; }
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  build() {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p.out(), 3));
    g.setAttribute('aS', new THREE.BufferAttribute(this.s.out(), 4));
    g.setAttribute('aT', new THREE.BufferAttribute(this.t.out(), 4));
    g.setIndex(new THREE.BufferAttribute(this.i.out(this.v > 65535 ? Uint32Array : Uint16Array), 1));
    g.computeBoundingSphere();
    return g;
  }
}
function createStreakMaterial(noise) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true,
    depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tNoiseS = { value: noise };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aS; attribute vec4 aT; varying vec4 vS; varying vec4 vT; varying float vSD;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvS = aS; vT = aT; vSD = length((modelViewMatrix * vec4(transformed, 1.0)).xyz);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tNoiseS; varying vec4 vS; varying vec4 vT; varying float vSD;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float u = vS.x, d = vS.y, H = vS.z, k = vS.w;
        float n1 = texture(tNoiseS, vec2(u / 11.0, 0.37)).r * 0.6 + texture(tNoiseS, vec2(u / 3.1, 0.71)).g * 0.4; // per-column run length
        float n2 = texture(tNoiseS, vec2(u / 0.9, d / 70.0 + 0.13)).b * 0.7 + texture(tNoiseS, vec2(u / 0.37, d / 30.0 + 0.61)).r * 0.3; // fine streak columns
        float len = H * (0.2 + 1.1 * smoothstep(0.3, 0.75, n1));
        float fall = 1.0 - smoothstep(0.0, len, d);
        float streak = smoothstep(0.44, 0.62, n2) * fall;
        float band = (1.0 - smoothstep(0.0, 0.3 + 0.6 * n1, d));                                                  // drip line under the cap
        float wash = (1.0 - smoothstep(0.0, H * 0.8, d));                                                          // general soiling under the cap
        float dark = k * clamp(streak * 0.75 + band * 0.5 + wash * 0.2, 0.0, 0.8) * smoothstep(820.0, 450.0, vSD)
          * mix(0.35, 1.0, smoothstep(45.0, 200.0, vSD)); // (park r10) near walls: soot was crushing shaded facades to black at swing range
        diffuseColor.rgb = vec3(1.0) - dark * vec3(0.8, 0.85, 0.93);                                               // brownish soot (multiplied)
        // r7: blank party walls (the big salmon brick slabs seen from above): per-wall hue, big weathering blotches,
        // patched / repointed brick rectangles and old tar roof-lines of demolished neighbours
        if (vT.w > 0.0) {
          float fd = smoothstep(900.0, 500.0, vSD);
          vec3 tint = mix(vec3(1.0), vT.rgb, fd);
          float b1 = texture(tNoiseS, vec2(u / 19.0 + 0.21, d / 23.0 + 0.47)).g, b2 = texture(tNoiseS, vec2(u / 6.0 + 0.6, d / 7.5 + 0.1)).r;
          float blot = smoothstep(0.45, 0.8, b1 * 0.7 + b2 * 0.3);
          vec2 pc = floor(vec2(u / 4.3, d / 3.1)), pf = fract(vec2(u / 4.3, d / 3.1));
          float ph = fract(sin(dot(pc, vec2(12.9898, 78.233)) + vT.w * 17.0) * 43758.5453);
          float patchv = (ph < 0.12 && pf.x > 0.1 && pf.y > 0.15 && pf.x < 0.9 && pf.y < 0.85) ? (0.8 + ph * 1.2) : 1.0;
          float gl = fract(sin(vT.w * 91.7) * 4375.5) * H * 0.7 + 2.0;
          float ghost = (1.0 - smoothstep(0.0, 0.25, abs(d - gl))) * step(0.5, fract(vT.w * 7.3));
          diffuseColor.rgb *= tint * (1.0 - vT.w * fd * (0.28 * blot + 0.3 * ghost)) * mix(1.0, patchv, fd);
        }
        // r8: canyon occlusion at the foot of street walls (vT.w < 0: quad from the ground up H metres): sky and bounce
        // light fall off toward the street, so the street gaps read as deep canyons from swinging altitude
        if (vT.w < 0.0) {
          float g = clamp(d / max(H, 1.0), 0.0, 1.0);
          float wn = texture(tNoiseS, vec2(u / 9.0 + 0.3, d / 5.0 + 0.8)).g;
          diffuseColor.rgb = vec3(1.0) - k * g * g * (0.85 + 0.3 * wn) * vec3(0.52, 0.54, 0.58) * smoothstep(1100.0, 500.0, vSD) * mix(0.45, 1.0, smoothstep(45.0, 200.0, vSD)); // (park r10) softer up close
        }
      }`);
  };
  m.customProgramCacheKey = () => 'city-roof-streaks-v3';
  return m;
}

// ------------------------------------------------------------------------------------------ occupancy
// Spatial hash of every solid that could stand on a roof (bulkheads, water towers, equipment, neighbouring walls), so
// nothing we add intersects existing geometry. Query: anything intersecting the vertical band [y + 0.05, y + hb].
const K_WT = KIND.indexOf('watertower'), K_BH = KIND.indexOf('bulkhead'), K_EQ = KIND.indexOf('equipment');
class Occ {
  constructor(S, minTop = 2.5) {
    this.C = 16; this.h = new Map();
    const b = S.b;
    for (let i = 0; i < S.t.length; i++) {
      const j = i * 6;
      if (b[j + 4] < minTop) continue; // street-level stuff can't touch a roof
      this._ins(b[j], b[j + 1], b[j + 2], b[j + 3], b[j + 4], b[j + 5], S.k[i], S.t[i]);
    }
  }
  _ins(x0, y0, z0, x1, y1, z1, k = -1, t = 0) {
    const C = this.C, a = [x0, y0, z0, x1, y1, z1, k, t];
    for (let gx = Math.floor(x0 / C); gx <= Math.floor(x1 / C); gx++) for (let gz = Math.floor(z0 / C); gz <= Math.floor(z1 / C); gz++) {
      const kk = gx * 100003 + gz; let l = this.h.get(kk); if (!l) this.h.set(kk, (l = [])); l.push(a);
    }
  }
  hit(x0, z0, x1, z1, y, hb = 4) {
    const C = this.C;
    for (let gx = Math.floor(x0 / C); gx <= Math.floor(x1 / C); gx++) for (let gz = Math.floor(z0 / C); gz <= Math.floor(z1 / C); gz++) {
      const l = this.h.get(gx * 100003 + gz); if (!l) continue;
      for (const a of l) if (a[4] > y + 0.05 && a[1] < y + hb && x1 > a[0] && x0 < a[3] && z1 > a[2] && z0 < a[5]) return true;
    }
    return false;
  }
  // solids standing on the roof plane y (bottom within 0.3 m) inside the rect
  on(x0, z0, x1, z1, y) {
    const C = this.C, out = new Set();
    for (let gx = Math.floor(x0 / C); gx <= Math.floor(x1 / C); gx++) for (let gz = Math.floor(z0 / C); gz <= Math.floor(z1 / C); gz++) {
      const l = this.h.get(gx * 100003 + gz); if (!l) continue;
      for (const a of l) if (Math.abs(a[1] - y) < 0.3 && a[0] >= x0 - 0.5 && a[3] <= x1 + 0.5 && a[2] >= z0 - 0.5 && a[5] <= z1 + 0.5) out.add(a);
    }
    return [...out];
  }
  add(x0, y0, z0, x1, y1, z1, k = -1) { this._ins(x0, y0, z0, x1, y1, z1, k); }
}

// ------------------------------------------------------------------------------------------ palette
const C_HVAC = [0x8a8b87, 0x7c7f7d, 0x96938b, 0x747a7a, 0x8c8676, 0x6d7274, 0x9e9e98, 0x7f877f, 0xa49c8a, 0x5f6668, 0x83908a, 0x8a7f70].map(srgb);
const C_DARK = srgb(0x3c3e40); // fan grilles: mid-dark (pure black read as dice pips from above)
const C_DUCT = srgb(0xa8aaa9);
const C_GLASS = srgb(0x2b3438);
const C_FRAME = srgb(0x6f716f);
const C_PLANT = [0x4d5a33, 0x5c6638, 0x6b5a34, 0x455431, 0x76603a].map(srgb);
const C_PLANTER = srgb(0x8a8479);
const C_WOODF = srgb(0x7a6048);
const C_UMB = [0xd8d2c2, 0x2f4a3c, 0x7d2e25, 0x2c3a52].map(srgb);
const C_STEEL = [0x5a5e60, 0x4a4d4f, 0x6b6660, 0x3f4446].map(srgb);
const C_TANKROOF = [0x3c3a38, 0x4a4540, 0x5b6a62, 0x6e5a48].map(srgb); // tar / weathered copper-green / rust
const C_TANKSTEEL = [0xb8b6ae, 0x9ea4a2, 0x8e968c, 0xc4bfb2].map(srgb);
const C_BRICK = srgb(0x6e4a3c);
const C_FENCE = [0x6a5440, 0x5a5048, 0x7a6a58, 0x8a8a86].map(srgb);
const C_LOUV = [0x858887, 0x747978, 0x8f8b82, 0x676e6f].map(srgb); // r3: darker (light louvres read as white boxes)
// roof colour families (vertex tint over the atlas cell), so neighbours differ
const C_PIPE = [0x8a8c8c, 0x7a4a36, 0xa89448, 0xb4b2aa, 0x5d6b72, 0x6b6e70].map(srgb);
const C_GEN = [0x9c9888, 0x6e7468, 0x8a8f8c, 0xb5ae96, 0x7d7f78].map(srgb);
const C_COPE = [0x4f5456, 0x3c3d3c, 0x6e4636, 0x7a5442, 0x66625c, 0x5e6260, 0x56685e, 0x6e6a62, 0x48443f].map(srgb); // r7: darker (sunlit light caps read as outlines)
// r7: weathered ledge tops (sooty stone / tarred / lead flashing) laid over the buildings.js cornice crowns + tier bands
const C_LEDGE = [0x5c5954, 0x4e4c48, 0x66615a, 0x575550, 0x6a6660, 0x4a4744].map(srgb);
const faceT = (m, lot) => { const e = 0.3, t = { nx: Math.abs(m.x0 - lot.x0) < e ? lot.sides.nx : 'setback', px: Math.abs(m.x1 - lot.x1) < e ? lot.sides.px : 'setback',
  nz: Math.abs(m.z0 - lot.z0) < e ? lot.sides.nz : 'setback', pz: Math.abs(m.z1 - lot.z1) < e ? lot.sides.pz : 'setback' }; if (m.sides) Object.assign(t, m.sides); return t; }; // = buildings.js faceTypes
const TIER_BAND = { deco: 1, postwar: 1, apt: 1, loft: 1 }; // = buildings.js
// r4: second-zone surfaces for sectioned big roofs, per main cell
const ZONE_ALT = { [CELL.GRAVEL]: [CELL.MEMBRANE, CELL.BITUMEN, CELL.EPDM, CELL.SILVER], [CELL.PAVERS]: [CELL.GRAVEL, CELL.BITUMEN, CELL.MEMBRANE],
  [CELL.TAN]: [CELL.GRAVEL, CELL.BITUMEN, CELL.SILVER], [CELL.BITUMEN]: [CELL.GRAVEL, CELL.SILVER, CELL.MEMBRANE, CELL.TAR],
  [CELL.MEMBRANE]: [CELL.GRAVEL, CELL.BITUMEN, CELL.EPDM], [CELL.EPDM]: [CELL.MEMBRANE, CELL.GRAVEL, CELL.BITUMEN],
  [CELL.TAR]: [CELL.SILVER, CELL.BITUMEN, CELL.GRAVEL], [CELL.SILVER]: [CELL.TAR, CELL.BITUMEN, CELL.MEMBRANE], [CELL.RED]: [CELL.TAR, CELL.SILVER] };
const FAM_WARM = [1.02, 0.99, 0.94], FAM_COOL = [0.92, 0.96, 1.0], FAM_N = [1, 1, 1];

// ------------------------------------------------------------------------------------------ main
export async function buildRooftops({ scene, gen, facadeMat, T, renderer, extraRoofs = [], progress }) {
  void facadeMat;
  const aniso = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);
  const [imC, imN] = await Promise.all([loadImage('/assets/city/tex/roof_col.png'), loadImage('/assets/city/tex/roof_nrm.png')]);
  const mat = createRoofMaterial(arrayTex(imC, true, aniso), arrayTex(imN, false, aniso), T.noise);
  const aoMat = new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, transparent: true,
    depthWrite: false, toneMapped: false, fog: false });
  const skMat = createStreakMaterial(T.noise); // r6: facade rain streaks under the caps
  const S = gen.solids, Z = gen.zips;
  const occ = new Occ(S);
  const tiles = new Map();
  const tileOf = (x, z) => {
    const k = `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;
    let t = tiles.get(k);
    if (!t) { t = { rb: new RB(), ao: new AOB(), sk: new StreakB(), key: k, cx: (Math.floor(x / TILE) + 0.5) * TILE, cz: (Math.floor(z / TILE) + 0.5) * TILE }; tiles.set(k, t); }
    return t;
  };
  const crowns = new CanopyBatch(4242, { squash: 0.8 }); // yard trees (lumpy blobs, shadows)
  // (veg r1) roof gardens: beds / planters get soil + instanced leaf-card plants (roofplants.js); their small trees and
  // potted trees go to trees.js (leaf-card crowns, bark trunks, trunk collision) via city.js -> props.treeSpots
  const plants = new RoofPlants(), roofTrees = [], prnd = mulberry32(9133);
  const SOIL = [0.085, 0.062, 0.045]; // dark loam / mulch (linear)
  const PT = { // species: [radius range, height range, tint]
    [PLANT.SHRUB]: [0.32, 0.6, 0.55, 1.05], [PLANT.GRASS]: [0.28, 0.45, 0.8, 1.4], [PLANT.FLOWER]: [0.28, 0.45, 0.45, 0.75], [PLANT.BROAD]: [0.3, 0.5, 0.35, 0.65] };
  const plant = (x, y, z, sp, k = 1) => {
    const d = PT[sp], v = 0.82 + prnd() * 0.3;
    plants.add(x, y, z, (d[0] + prnd() * (d[1] - d[0])) * k, (d[2] + prnd() * (d[3] - d[2])) * k, sp,
      [v * (0.95 + prnd() * 0.1), v * (0.95 + prnd() * 0.1), v * (0.9 + prnd() * 0.1)], prnd() * Math.PI * 2);
  };
  const pickSp = (w) => { let u = prnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { u -= w[i]; if (u <= 0) return i; } return 0; };
  // fill a rectangle of soil (top at y) with a planting mix; weights over [SHRUB, GRASS, FLOWER, BROAD]
  const plantBed = (x0, z0, x1, z1, y, w, dens = 1.9, k = 1) => {
    const bw = x1 - x0, bd = z1 - z0, n = Math.max(1, Math.min(18, Math.round(bw * bd * dens)));
    const nx = Math.max(1, Math.round(Math.sqrt(n * bw / bd))), nz = Math.max(1, Math.ceil(n / nx));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const px = x0 + (i + 0.2 + prnd() * 0.6) / nx * bw, pz = z0 + (j + 0.2 + prnd() * 0.6) / nz * bd;
      plant(px, y - 0.04, pz, pickSp(w), k * Math.min(1, 0.55 + 0.5 * Math.min(bw / nx, bd / nz)));
    }
  };
  const st = { roofs: 0, pent: 0, mech: 0, hvac: 0, sky: 0, chim: 0, terr: 0, pool: 0, ct: 0, wt: 0, dish: 0, ant: 0, solar: 0, garden: 0, green: 0, yard: 0, clad: 0, rail: 0, arch: {} };
  const archLast = new Map(); // r8: last roof archetype per block (neighbours differ)

  // extra roofs built outside buildings.js (the hero tower): dressed like a tall office roof
  const extra = extraRoofs.map(({ rect, H }) => ({
    hero: true, H, A: { type: 'postwar', floorH: 4 },
    lot: { x0: rect.x0, z0: rect.z0, x1: rect.x1, z1: rect.z1, cx: (rect.x0 + rect.x1) / 2, cz: (rect.z0 + rect.z1) / 2, sides: {} },
    masses: [{ x0: rect.x0, z0: rect.z0, x1: rect.x1, z1: rect.z1, y0: 0, y1: H, parapet: 0,
      p: { floorH: 4, bayW: 1.55, winW: 0.97, winH: 0.74, layer: LAYER.CONCRETE, base: LAYER.GRANITE, seed: 42, margin: 0, depth: 0.04, tint: [1, 1, 1], style: STYLE.BLANK } }],
  }));
  const blds = [...gen.buildings, ...extra]; let nBld = 0;
  for (const bld of blds) {
    await progress?.(nBld++ / blds.length); // loading-screen progress (0..1)
    const A = bld.A, masses = bld.masses;
    if (!masses?.length) continue;
    bld.roofKit = true; // props.js: this roof is dressed here (it then skips its generic HVAC / garden stamps)
    const lot = bld.lot;
    const r = mulberry32(Math.floor(Math.abs(lot.x0 * 73.1 + lot.z0 * 19.7 + lot.x1 * 3.3)) + 11);
    const gt = gen.tile(lot.cx, lot.cz);           // city facade tile builders (near + far LOD)
    const tl = tileOf(lot.cx, lot.cz), rb = tl.rb;  // our merged clutter
    const nonCrown = masses.filter(m => !m.crown);
    const topMass = (nonCrown.length ? nonCrown : masses).reduce((a, m) => (m.y1 > a.y1 ? m : a), (nonCrown.length ? nonCrown : masses)[0]); // r4: crowns never own the roof
    const dist = district(lot.cx, lot.cz);
    const type = A.type;
    const resid = type === 'apt' || type === 'walkup';
    const tall = bld.H > 85;
    // building roof character (shared by all its roofs)
    const cellMain = pickCell(type, r, dist, bld.H);
    const fam = r() < 0.3 ? FAM_WARM : r() < 0.4 ? FAM_COOL : FAM_N;
    const tintMain = jit(fam, r, 0.13).map((v, i, a) => v * (i === 0 ? (a.k = 0.66 + r() * 0.4) : a.k)); // r4: wider per-building brightness (neighbours differ)
    const ou = r() * 50, ov = r() * 50, rot = r() < 0.5;
    // service side: the roof corner away from the streets (stairs / plant cluster there, terraces on the street side)
    const sd = lot.sides || {};
    const backX = sd.px === 'street' && sd.nx !== 'street' ? -1 : sd.nx === 'street' && sd.px !== 'street' ? 1 : (r() < 0.5 ? -1 : 1);
    const backZ = sd.pz === 'street' && sd.nz !== 'street' ? -1 : sd.nz === 'street' && sd.pz !== 'street' ? 1 : (r() < 0.5 ? -1 : 1);
    // r6: own random stream for the facade streaks (the roof stream r stays as it was)
    const rs = mulberry32(Math.floor(Math.abs(lot.x0 * 17.3 + lot.z0 * 41.9 + lot.z1 * 5.1)) + 977);
    const kStreak = (type === 'glass' ? 0.4 : type === 'walkup' || type === 'loft' ? 1.0 : type === 'apt' ? 0.9 : 0.8) * (0.6 + rs() * 0.5);
    // r8: roof ARCHETYPE per lot (critic r7: "4-6 roof archetypes rotated per lot"): service (default kit), tar (patched
    // hot-mopped tar), garden (terrace garden with planted beds / shrubs / trees), pool (pool deck), tank (timber water
    // towers), sign (rooftop billboard frame). Own stream `ra`; neighbours in a block never repeat the same archetype.
    const ra = mulberry32(Math.floor(Math.abs(lot.x0 * 29.3 + lot.z1 * 61.7 + lot.x1 * 7.9)) + 4049);
    let arch = 'svc';
    if (!bld.hero && bld.H > 12 && bld.H <= 85 && type !== 'glass') {
      const W = type === 'postwar' || type === 'deco' ? [['garden', 0.13], ['pool', 0.13], ['tank', 0.1], ['tar', 0.17], ['sign', 0.05]]
        : [['garden', 0.17], ['pool', 0.09], ['tank', 0.22], ['tar', 0.2], ['sign', 0.07]];
      const roll = () => { let x = ra(); for (const [k, w] of W) { if (x < w) return k; x -= w; } return 'svc'; };
      const bk = blockAt(lot.cx, lot.cz), key = bk ? `${bk.x0.toFixed(0)},${bk.z0.toFixed(0)}` : '';
      arch = roll();
      if (key && archLast.get(key) === arch) arch = roll();
      if (key) archLast.set(key, arch);
      if (arch === 'sign' && bld.H > 55) arch = 'tar';
    }
    st.arch[arch] = (st.arch[arch] ?? 0) + 1;
    const archTop = (m) => m === topMass && arch !== 'svc';

    for (const m of masses) {
      if (m.crown) {
        // r7: stepped copper hip roofs (buildings.js addCrown, pale treads + saturated green risers: critic "garish green
        // stripe lines"): clad each tier 1.2 cm proud in weathered standing-seam copper, muted grey-green, with a finial
        const tn = m.p?.tint;
        if (tn && m.p.layer === LAYER.CONCRETE && tn[1] > tn[0] * 1.25 && m.y1 - m.y0 < 2.5) {
          const k = 0.78 + rs() * 0.22, e = 0.012;
          const side = jit(srgb(0x4f5f56), rs, 0.05).map(v => v * k), topc = jit(srgb(0x6b7970), rs, 0.05).map(v => v * k);
          rb.box(m.x0 - e, m.y0, m.z0 - e, m.x1 + e, m.y1 + e, m.z1 + e, CELL.METAL, side, topc);
          if (m.y1 >= Math.max(...masses.map(o => o.y1)) - 0.01) { // top tier: lantern plinth + finial mast
            const cx = (m.x0 + m.x1) / 2, cz = (m.z0 + m.z1) / 2, fh = 3 + rs() * 5;
            rb.box(cx - 0.8, m.y1, cz - 0.8, cx + 0.8, m.y1 + 1.2, cz + 0.8, CELL.METAL, side, topc);
            rb.cyl(cx, cz, 0.09, m.y1 + 1.2, m.y1 + 1.2 + fh, srgb(0x5a5c5c), 6);
            S.box(cx - 0.8, m.y1, cz - 0.8, cx + 0.8, m.y1 + 1.2, cz + 0.8, 'equipment');
            S.cyl(cx, cz, m.y1 + 1.2, m.y1 + 1.2 + fh, 0.09, 0.09, 'antenna');
          }
          st.copper = (st.copper ?? 0) + 1;
        } else if (m.y1 - m.y0 > 2.5 && (m.x1 - m.x0) > 3 && (m.z1 - m.z0) > 3 && !m.round && !m.pyr
          && !masses.some(o => o !== m && o.y0 >= m.y1 - 0.1 && o.x0 < m.x1 && o.x1 > m.x0 && o.z0 < m.z1 && o.z1 > m.z0)) {
          // r7: flat-topped crown blocks (lantern plinths, sawtooth steps) read as plain pale boxes (critic: "plain box
          // roof: add a crown, bulkheads and an antenna"): dark metal coping rim, tarred top, an exhaust / beacon mast
          const cc = jit(pick(C_COPE, rs), rs, 0.06), e = 0.03;
          for (const [a0, b0, a1, b1] of [[m.x0 - e, m.z0 - e, m.x1 + e, m.z0 + 0.35], [m.x0 - e, m.z1 - 0.35, m.x1 + e, m.z1 + e], [m.x0 - e, m.z0 + 0.35, m.x0 + 0.35, m.z1 - 0.35], [m.x1 - 0.35, m.z0 + 0.35, m.x1 + e, m.z1 - 0.35]]) {
            rb.box(a0, m.y1 - 0.45, b0, a1, m.y1 + 0.35, b1, CELL.METAL, cc.map(v => v * 0.8), cc);
            S.box(a0, m.y1 - 0.45, b0, a1, m.y1 + 0.35, b1, 'coping');
          }
          rb.skin(m.x0 + 0.35, m.z0 + 0.35, m.x1 - 0.35, m.z1 - 0.35, m.y1 + 0.006, rs() < 0.5 ? CELL.TAR : CELL.GRAVEL, jit([0.8, 0.8, 0.8], rs, 0.08), 0, 0, false, 0.4);
          const cx = (m.x0 + m.x1) / 2, cz = (m.z0 + m.z1) / 2, k = rs();
          if (k < 0.45 && Math.min(m.x1 - m.x0, m.z1 - m.z0) > 4) { mast(rb, S, Z, cx, m.y1, cz, 5 + rs() * 8, rs); }
          else if (k < 0.8) { // small machine room / exhaust stack pair
            const bw = Math.min(3, (m.x1 - m.x0) * 0.4), bd = Math.min(3, (m.z1 - m.z0) * 0.4), bh = 1.6 + rs() * 1.2, lc = pick(C_LOUV, rs);
            rb.box(cx - bw / 2, m.y1, cz - bd / 2, cx + bw / 2, m.y1 + bh, cz + bd / 2, CELL.LOUVRE, lc, lc.map(v => v * 0.6), CELL.METAL);
            S.box(cx - bw / 2, m.y1, cz - bd / 2, cx + bw / 2, m.y1 + bh, cz + bd / 2, 'equipment');
            rb.cyl(cx + bw / 2 + 0.5, cz, 0.3, m.y1, m.y1 + bh + 1.5, srgb(0x6a6c6c), 8);
            S.cyl(cx + bw / 2 + 0.5, cz, m.y1, m.y1 + bh + 1.5, 0.3, 0.3, 'equipment');
          }
          st.crownDress = (st.crownDress ?? 0) + 1;
        }
        continue;
      }
      // r8: canyon occlusion (critic: "street canyons under-lit, the block field reads as a solid carpet"): darkening
      // at the foot of every non-party wall of a ground mass + a soft AO ring on the sidewalk / yard along its base
      if (m.y0 < 0.5 && m.y1 > 6 && lot.sides) {
        const ft = faceT(m, lot), yg = GY.WALK, hb = Math.min(m.y1 - 1, 9 + Math.min(12, m.y1 * 0.12)), kb = 0.55;
        const fw = (ax, az, bx, bz, nx, nz) => tl.sk.wall(ax, az, bx, bz, nx, nz, yg + hb, hb, kb, (ax + az) * 0.37, [1, 1, 1], -1);
        if (ft.nz !== 'party') fw(m.x0, m.z0, m.x1, m.z0, 0, -1);
        if (ft.pz !== 'party') fw(m.x1, m.z1, m.x0, m.z1, 0, 1);
        if (ft.nx !== 'party') fw(m.x0, m.z1, m.x0, m.z0, -1, 0);
        if (ft.px !== 'party') fw(m.x1, m.z0, m.x1, m.z1, 1, 0);
        tl.ao.ring(yg, m.x0, m.z0, m.x1, m.z1, 2.4, 0.62);
      }
      const covered = masses.some(o => o !== m && o.x0 <= m.x0 + 0.2 && o.x1 >= m.x1 - 0.2 && o.z0 <= m.z0 + 0.2 && o.z1 >= m.z1 - 0.2 && o.y0 <= m.y1 + 0.1 && o.y1 > m.y1 + 0.1);
      if (covered) continue;
      const w = m.x1 - m.x0, d = m.z1 - m.z0;
      if (w < 3 || d < 3) continue;
      const t = m.parapet > 0 ? 0.3 : 0;
      const R = { x0: m.x0 + t, z0: m.z0 + t, x1: m.x1 - t, z1: m.z1 - t };
      const y = m.y1, top = m.y1 + m.parapet;
      const isTop = m === topMass;
      // r4: any glass roof carrying the buildings.js mechanical screen is a glass top (crowned towers used to miss it:
      // their top roof lost `isTop` to the crown masses and the screen roof stayed a bare pale slab)
      const scrPre = (type === 'glass' || (type === 'postwar' && bld.H > 70)) ? occ.on(m.x0, m.z0, m.x1, m.z1, m.y1).find(a => a[6] === K_EQ && a[7] === 0 && a[3] - a[0] > 5 && a[5] - a[2] > 5 && a[4] - a[1] > 4) : null;
      const glassTop = (type === 'glass' && isTop && m.parapet === 0) || !!scrPre;
      const lower = !isTop;                                    // setback terrace / podium roof
      st.roofs++;
      const skins = []; // this roof's skins
      let aoDeck = null; // plant-room roof (contact AO clip rect)
      // ---- terrace zone (deck / pavers / sedum / lawn) on residential and setback roofs, on the street-facing end
      let terr = null;
      const aT = archTop(m) ? arch : ''; // r8: this roof carries the building's archetype
      const wantTerr = aT === 'garden' || aT === 'pool' || (!glassTop && (lower ? r() < 0.6 : ((type === 'apt' && r() < 0.45) || ((type === 'walkup' || type === 'loft') && r() < 0.22))));
      const xt = r();
      const bigR = tall || (R.x1 - R.x0) * (R.z1 - R.z0) > 380; // r6: no big flat lawn / sedum cards on tall or large roofs (read as a colour card)
      let cellTerr = xt < 0.42 ? CELL.DECK : xt < 0.84 ? CELL.PAVERS : bigR ? (xt < 0.92 ? CELL.PAVERS : CELL.DECK) : xt < 0.94 ? CELL.GREEN : CELL.LAWN; // greens always get beds
      if (aT === 'garden') cellTerr = ra() < 0.55 ? CELL.PAVERS : CELL.DECK; // the planted beds carry the green (volumes, not a flat card)
      if (aT === 'pool') cellTerr = ra() < 0.7 ? CELL.DECK : CELL.PAVERS;
      let cellR = cellMain;
      if (lower) { const x = r(); cellR = (resid || dist.upper > 0.5 || dist.harlem > 0.5) // r7: residential podiums / setbacks: darker, tarred (park agent: 'big pale slabs')
        ? (x < 0.3 ? CELL.TAR : x < 0.5 ? CELL.BITUMEN : x < 0.68 ? CELL.GRAVEL : x < 0.8 ? CELL.EPDM : x < 0.9 ? CELL.PAVERS : CELL.SILVER)
        : (x < 0.32 ? CELL.GRAVEL : x < 0.52 ? CELL.PAVERS : x < 0.66 ? CELL.TAN : x < 0.8 ? CELL.BITUMEN : x < 0.9 ? CELL.EPDM : CELL.SILVER); }
      if (glassTop) cellR = r() < 0.5 ? CELL.GRAVEL : r() < 0.6 ? CELL.PAVERS : CELL.BITUMEN;
      if (aT === 'tar') cellR = pick([CELL.TAR, CELL.TAR, CELL.EPDM, CELL.BITUMEN], ra);
      // r8: wings of multi-mass buildings (courtyard rings, L / U blocks, podium + slab) re-roofed separately: own surface
      // + tone per wing (critic: "courtyard ring roof one flat beige material, vary roof material between wings")
      let wingK = 1;
      if (!glassTop && masses.length > 1 && m !== topMass) {
        const rw_ = mulberry32(Math.floor(Math.abs(m.x0 * 13.7 + m.z0 * 71.3 + m.y1 * 3.1)) + 61);
        if (rw_() < 0.7) cellR = pick(ZONE_ALT[cellR] ?? [CELL.GRAVEL, CELL.BITUMEN, CELL.TAR], rw_);
        wingK = 0.74 + rw_() * 0.34;
      }
      // green roof: whole roof sedum (a few lofts / apartments / podiums, ref 02 / 03)
      const greenRoof = !glassTop && !tall && (lower ? false : (type === 'loft' || type === 'apt' || type === 'postwar') && r() < 0.06) && false; // round 3: off (read as flat colour cards)
      if (greenRoof) { cellR = CELL.GREEN; st.green++; }
      // ---- skins (near) + far-LOD stand-in on top of the bare mass
      const skinCol = tintMain.map(v => v * wingK * (lower ? 0.97 : 1) * (cellR === CELL.MEMBRANE ? 0.76 : 1) * (tall ? 0.86 : 1)); // r8: tall tops darker (critic: 'too clean pale caps')
      if (wantTerr && !greenRoof && Math.min(R.x1 - R.x0, R.z1 - R.z0) > 6) {
        // split along the longer axis: terrace gets 30-55% on the street end (r8: garden / pool archetypes 55-80%)
        const alongX = R.x1 - R.x0 >= R.z1 - R.z0;
        const f0 = r(), f = aT ? 0.55 + ra() * 0.25 : 0.3 + f0 * 0.25, endHi = alongX ? backX < 0 : backZ < 0;
        if (alongX) { const xs = endHi ? R.x1 - (R.x1 - R.x0) * f : R.x0 + (R.x1 - R.x0) * f; terr = endHi ? { x0: xs, z0: R.z0, x1: R.x1, z1: R.z1 } : { x0: R.x0, z0: R.z0, x1: xs, z1: R.z1 }; }
        else { const zs = endHi ? R.z1 - (R.z1 - R.z0) * f : R.z0 + (R.z1 - R.z0) * f; terr = endHi ? { x0: R.x0, z0: zs, x1: R.x1, z1: R.z1 } : { x0: R.x0, z0: R.z0, x1: R.x1, z1: zs }; }
        const rest = alongX ? (endHi ? { ...R, x1: terr.x0 } : { ...R, x0: terr.x1 }) : (endHi ? { ...R, z1: terr.z0 } : { ...R, z0: terr.z1 });
        const terrCol = jit(cellTerr === CELL.GREEN || cellTerr === CELL.LAWN ? [0.86, 0.86, 0.8] : cellTerr === CELL.PAVERS ? [0.84, 0.83, 0.81] : [1, 1, 1], r, 0.07); // r7: pavers darker
        skins.push(rb.skin(terr.x0, terr.z0, terr.x1, terr.z1, y + 0.006, cellTerr, terrCol, ou, ov, rot, 0.8));
        skins.push(rb.skin(rest.x0, rest.z0, rest.x1, rest.z1, y + 0.006, cellR, skinCol, ou, ov, rot));
        terr.cell = cellTerr;
        st.terr++;
      } else if (!lower && !glassTop && (R.x1 - R.x0) * (R.z1 - R.z0) > 320 && Math.min(R.x1 - R.x0, R.z1 - R.z0) > 12 && r() < 0.75) {
        // r4: big roofs are re-roofed in sections (different eras / systems): 2-3 zones along the long axis, split by
        // an expansion-joint curb (exact box collision), each zone its own surface + tone
        const alongX = R.x1 - R.x0 >= R.z1 - R.z0, L0 = alongX ? R.x0 : R.z0, L1 = alongX ? R.x1 : R.z1;
        const nz = (L1 - L0) > 45 && r() < 0.5 ? 3 : 2;
        const cuts = [L0];
        for (let i = 1; i < nz; i++) cuts.push(L0 + (L1 - L0) * (i / nz + (r() - 0.5) * 0.18));
        cuts.push(L1);
        const alt = ZONE_ALT[cellR] ?? [CELL.GRAVEL, CELL.BITUMEN];
        for (let i = 0; i < nz; i++) {
          const c = i === 0 ? cellR : (r() < 0.3 ? cellR : pick(alt, r));
          const zc = skinCol.map(v => v * (0.86 + r() * 0.24) * (c === CELL.MEMBRANE ? 0.86 : 1));
          const [a, b] = [cuts[i], cuts[i + 1]];
          skins.push(alongX ? rb.skin(a, R.z0, b, R.z1, y + 0.006, c, zc, ou, ov, rot) : rb.skin(R.x0, a, R.x1, b, y + 0.006, c, zc, ou, ov, rot));
          if (i > 0) { // expansion joint curb (metal-capped), skipped where it would cross existing equipment
            const [x0, z0, x1, z1] = alongX ? [a - 0.14, R.z0, a + 0.14, R.z1] : [R.x0, a - 0.14, R.x1, a + 0.14];
            if (!occ.hit(x0, z0, x1, z1, y, 0.4)) {
              rb.box(x0, y, z0, x1, y + 0.2, z1, CELL.METAL, jit(srgb(0x6e706e), r, 0.08));
              S.box(x0, y, z0, x1, y + 0.2, z1, 'equipment'); occ.add(x0, y, z0, x1, y + 0.2, z1);
            }
          }
        }
        st.zoned = (st.zoned ?? 0) + 1;
      } else {
        skins.push(rb.skin(R.x0, R.z0, R.x1, R.z1, y + 0.006, cellR, skinCol, ou, ov, rot));
      }
      // r8: patched roofs (critic: "no tar-patch variation"): re-roofed rectangles of fresh / old tar, black EPDM and the
      // odd aluminium-coated patch laid over the field (3 mm steps, below the collision tolerance)
      if (!glassTop && (aT === 'tar' || ((cellR === CELL.TAR || cellR === CELL.BITUMEN || cellR === CELL.EPDM || cellR === CELL.MEMBRANE) && ra() < 0.3))) {
        const Ar = (R.x1 - R.x0) * (R.z1 - R.z0), np = Math.min(aT === 'tar' ? 14 : 5, 1 + Math.floor(Ar / (aT === 'tar' ? 45 : 110)));
        for (let i = 0; i < np; i++) {
          const pw = Math.min(R.x1 - R.x0 - 0.4, 1.2 + ra() * 5.5), pd = Math.min(R.z1 - R.z0 - 0.4, 0.8 + ra() * 4);
          if (pw < 0.8 || pd < 0.6) break;
          const x0 = R.x0 + 0.2 + ra() * (R.x1 - R.x0 - 0.4 - pw), z0 = R.z0 + 0.2 + ra() * (R.z1 - R.z0 - 0.4 - pd);
          if (terr && x0 + pw > terr.x0 && x0 < terr.x1 && z0 + pd > terr.z0 && z0 < terr.z1) continue;
          const k = ra(), pc = k < 0.62 ? CELL.TAR : k < 0.85 ? CELL.EPDM : CELL.SILVER;
          const tn = pc === CELL.SILVER ? jit([0.85, 0.85, 0.83], ra, 0.06) : jit([0.5, 0.49, 0.47], ra, 0.2);
          rb.skin(x0, z0, x0 + pw, z0 + pd, y + 0.009 + i * 0.0004, pc, tn, ra() * 30, ra() * 30, ra() < 0.5, 0.18);
        }
        st.patched = (st.patched ?? 0) + 1;
      }
      // r4: coping recolour (the buildings.js coping is one light limestone rim on every roof): dark metal flashing,
      // tarred, brick, terracotta, stone, the odd copper, laid 1.2 cm over its top (within the collision tolerance)
      if (m.parapet > 0 && r() < 0.97) { // r6: 0.7 -> 0.88 (critic: uniform cream caps); r7: 0.97 (critic: 'bright parapet line reads as a cartoon outline')
        // (z-fight fix) the cap fully encloses the buildings.js coping (4 cm drip out / t+3 cm in / top+cH) with >= 1.5 cm
        // clearance on every face: the old 5 mm side offsets, flush party sides and 'sunken' pieces sat coplanar with it
        const cH = (A.cornice && m.y0 < 0.1) ? 0.1 : 0.08, yc = top + cH + 0.015, ti = t + 0.03 + 0.018;
        const ccol = jit(pick(C_COPE, r), r, 0.07);
        const sdm = { nx: Math.abs(m.x0 - lot.x0) < 0.1 && sd.nx === 'party', px: Math.abs(m.x1 - lot.x1) < 0.1 && sd.px === 'party',
          nz: Math.abs(m.z0 - lot.z0) < 0.1 && sd.nz === 'party', pz: Math.abs(m.z1 - lot.z1) < 0.1 && sd.pz === 'party' };
        const ovs = (k) => (sdm[k] ? 0.018 : 0.04 + 0.018);
        const cx0 = m.x0 - ovs('nx'), cx1 = m.x1 + ovs('px'), cz0 = m.z0 - ovs('nz'), cz1 = m.z1 + ovs('pz');
        for (const [a0, b0, a1, b1] of [[cx0, cz0, cx1, m.z0 + ti], [cx0, m.z1 - ti, cx1, cz1], [cx0, m.z0 + ti, m.x0 + ti, m.z1 - ti], [m.x1 - ti, m.z0 + ti, cx1, m.z1 - ti]])
        { // r6: laid in pieces (1.2-4 m) with per-piece tone, the odd tarred / rusted / missing piece (the limestone shows)
          const alx = a1 - a0 >= b1 - b0, L0 = alx ? a0 : b0, L1 = alx ? a1 : b1;
          for (let q = L0; q < L1 - 0.01;) {
            const q1 = Math.min(L1, q + 1.2 + rs() * 2.8), kr = rs();
            if (kr > 0.06) {
              const pc = kr < 0.16 ? jit(srgb(0x2e2d2b), rs, 0.1) : kr < 0.22 ? jit(srgb(0x6a4a36), rs, 0.1) : ccol.map(v => v * (0.84 + rs() * 0.3));
              rs(); // (z-fight fix) keep the random stream; the flush 'sunken' piece variant is gone
              const yb = yc - 0.015 - cH - 0.012; // skirt drops just below the coping underside
              if (alx) rb.box(q, yb, b0, q1, yc, b1, CELL.METAL, pc.map(v => v * 0.85), pc);
              else rb.box(a0, yb, q, a1, yc, q1, CELL.METAL, pc.map(v => v * 0.85), pc);
            }
            q = q1;
          }
        }
        st.cope = (st.cope ?? 0) + 1;
      }
      // r7: sooty ledge tops over the light stone cornice crown (street faces of corniced ground masses) and the set-back
      // tier bands (buildings.js): from above they were bright cream outlines round every roof. 1.2 cm over the stone, in
      // pieces with per-piece tone (below the 2 cm collision tolerance, so no extra solids)
      if (m.parapet > 0 && lot.sides) {
        const ft = faceT(m, lot);
        const ledge = (s, o, yTop, ext) => {
          const lc = jit(pick(C_LEDGE, rs), rs, 0.08);
          let bx;
          if (s === 'nz') bx = [m.x0 - ext.nx, m.z0 - o, m.x1 + ext.px, m.z0];
          else if (s === 'pz') bx = [m.x0 - ext.nx, m.z1, m.x1 + ext.px, m.z1 + o];
          else if (s === 'nx') bx = [m.x0 - o, m.z0, m.x0, m.z1];
          else bx = [m.x1, m.z0, m.x1 + o, m.z1];
          // (z-fight fix) 1.8 cm clear of the stone on the top, the outer face and the run ends (was 1.2 cm / flush ends)
          const E = 0.018, alx = s === 'nz' || s === 'pz', L0 = (alx ? bx[0] : bx[1]) - E, L1 = (alx ? bx[2] : bx[3]) + E;
          for (let q = L0; q < L1 - 0.01;) {
            const q1 = Math.min(L1, q + 2 + rs() * 5), pc = lc.map(v => v * (0.82 + rs() * 0.3));
            if (alx) rb.box(q, yTop - 0.03, bx[1] - (s === 'nz' ? E : 0), q1, yTop + E, bx[3] + (s === 'pz' ? E : 0), CELL.METAL, pc.map(v => v * 0.8), pc);
            else rb.box(bx[0] - (s === 'nx' ? E : 0), yTop - 0.03, q, bx[2] + (s === 'px' ? E : 0), yTop + E, q1, CELL.METAL, pc.map(v => v * 0.8), pc);
            q = q1;
          }
        };
        if (A.cornice && m.y0 < 0.1) { // cornice crown: o = 0.55, top = parapet top + 0.1
          const ext = {}; for (const s of ['nx', 'px', 'nz', 'pz']) ext[s] = ft[s] === 'street' ? 0.55 : 0;
          for (const s of ['nz', 'pz', 'nx', 'px']) if (ft[s] === 'street') ledge(s, 0.55, top + 0.1, ext);
          st.ledge = (st.ledge ?? 0) + 1;
        } else if (!m.crown && top > 28 && TIER_BAND[type] && Math.min(m.x1 - m.x0, m.z1 - m.z0) > 8) { // tier band: o1, top = parapet top - 0.12
          const o1 = 0.34 * (top > 110 ? 1.45 : top > 60 ? 1 : 0.7);
          const ext = {}; for (const s of ['nx', 'px', 'nz', 'pz']) ext[s] = ft[s] !== 'party' ? o1 : 0;
          for (const s of ['nz', 'pz', 'nx', 'px']) if (ft[s] !== 'party') ledge(s, o1, top - 0.12, ext);
          st.ledge = (st.ledge ?? 0) + 1;
        }
      }
      // r4: raised parapet panel (stepped / pedimented name-plate parapet) centred on a street face of old walk-ups,
      // lofts and apartment houses: breaks the flat roof line from above and in the oblique skyline
      if (isTop && m.parapet > 0 && (type === 'walkup' || type === 'loft' || type === 'apt') && r() < 0.35) {
        const faces = ['nz', 'pz', 'nx', 'px'].filter(k => sd[k] === 'street' && Math.abs((k === 'nx' ? m.x0 - lot.x0 : k === 'px' ? lot.x1 - m.x1 : k === 'nz' ? m.z0 - lot.z0 : lot.z1 - m.z1)) < 0.1);
        if (faces.length) {
          const k = pick(faces, r), alongXf = k === 'nz' || k === 'pz', L = alongXf ? m.x1 - m.x0 : m.z1 - m.z0;
          const pw = Math.min(L * 0.55, 3.5 + r() * 6), ph = 0.7 + r() * 0.9, cH = (A.cornice && m.y0 < 0.1) ? 0.1 : 0.08, yb = top + cH, yt2 = yb + ph;
          const c0 = (alongXf ? (m.x0 + m.x1) : (m.z0 + m.z1)) / 2 + (r() < 0.3 ? (r() - 0.5) * (L - pw) * 0.6 : 0);
          const [x0, z0, x1, z1] = alongXf ? [c0 - pw / 2, k === 'nz' ? m.z0 : m.z1 - t, c0 + pw / 2, k === 'nz' ? m.z0 + t : m.z1]
            : [k === 'nx' ? m.x0 : m.x1 - t, c0 - pw / 2, k === 'nx' ? m.x0 + t : m.x1, c0 + pw / 2];
          if (pw > 2.5 && !occ.hit(x0, z0, x1, z1, yb - 0.04, ph)) {
            const pp = { ...m.p, style: STYLE.BLANK, topY: yt2 };
            gt.fac.box(x0, yb, z0, x1, yt2, z1, pp, {}, false);
            const cc = jit(pick(C_COPE, r), r, 0.06);
            rb.box(x0 - 0.04, yt2, z0 - 0.04, x1 + 0.04, yt2 + 0.08, z1 + 0.04, CELL.METAL, cc.map(v => v * 0.85), cc);
            S.box(x0, yb, z0, x1, yt2, z1, 'parapet'); S.box(x0 - 0.04, yt2, z0 - 0.04, x1 + 0.04, yt2 + 0.08, z1 + 0.04, 'coping');
            occ.add(x0, yb, z0, x1, yt2 + 0.08, z1);
            st.ppanel = (st.ppanel ?? 0) + 1;
          }
        }
      }
      // r6: rain / soot streaks down every wall of this mass from its cap (skipped on stubby masses)
      if (m.y1 - m.y0 > 3) {
        const capY = top + 0.1, hs = Math.min(m.y1 - m.y0, (lower ? 2.5 : 3.5) + rs() * (tall ? 30 : 10));
        const kk = () => kStreak * (0.7 + rs() * 0.5), uo = () => rs() * 200;
        tl.sk.wall(m.x0, m.z0, m.x1, m.z0, 0, -1, capY, hs * (0.7 + rs() * 0.5), kk(), uo());
        tl.sk.wall(m.x1, m.z1, m.x0, m.z1, 0, 1, capY, hs * (0.7 + rs() * 0.5), kk(), uo());
        tl.sk.wall(m.x0, m.z1, m.x0, m.z0, -1, 0, capY, hs * (0.7 + rs() * 0.5), kk(), uo());
        tl.sk.wall(m.x1, m.z0, m.x1, m.z1, 1, 0, capY, hs * (0.7 + rs() * 0.5), kk(), uo());
        // r7: blank party walls rising over lower neighbours read as flat salmon slabs from above (critic): weather them
        if (lot.sides) {
          const ft = faceT(m, lot), H2 = capY - m.y0;
          const PT = [[0.8, 0.84, 0.9], [0.86, 0.84, 0.82], [0.74, 0.73, 0.72], [0.9, 0.9, 0.92], [0.82, 0.86, 0.86], [0.7, 0.72, 0.76]];
          const pw = (ax, az, bx, bz, nx, nz) => tl.sk.wall(ax, az, bx, bz, nx, nz, capY, H2, kk() * 0.8, uo(), pick(PT, rs), 0.55 + rs() * 0.45);
          if (ft.nz === 'party') pw(m.x0, m.z0, m.x1, m.z0, 0, -1);
          if (ft.pz === 'party') pw(m.x1, m.z1, m.x0, m.z1, 0, 1);
          if (ft.nx === 'party') pw(m.x0, m.z1, m.x0, m.z0, -1, 0);
          if (ft.px === 'party') pw(m.x1, m.z0, m.x1, m.z1, 1, 0);
        }
      }
      const fl = FAR[cellR] ?? FAR[CELL.TAR];
      gt.lod.horiz(m.x0, m.z0, m.x1, m.z1, top + 0.01, { ...m.p, style: STYLE.BLANK, layer: fl[0], tint: fl[1].map((v, i) => v * skinCol[i] * 0.95), topY: top });

      // far LOD (> ~650 m): bare masses only -> mirror the silhouette of the busy roof tops as cheap boxes
      const lodP = { ...m.p, style: STYLE.BLANK, layer: LAYER.METAL, tint: [2.0, 2.05, 2.1], topY: top + 6 };
      const lodBox = (x0, z0, x1, z1, y1, y0 = top) => { if (y1 > y0 + 0.25) gt.lod.box(x0, y0, z0, x1, y1, z1, lodP, {}, true, false, { ...lodP, layer: LAYER.ROOF, tint: [0.62, 0.62, 0.6] }); };
      if (m.y1 < 3) continue; // podium at street level only
      // ---- placement helpers on this roof
      const pin = t + 0.7;
      const P0 = { x0: m.x0 + pin, z0: m.z0 + pin, x1: m.x1 - pin, z1: m.z1 - pin };
      const inTerr = (x0, z0, x1, z1) => terr && x1 > terr.x0 - 0.4 && x0 < terr.x1 + 0.4 && z1 > terr.z0 - 0.4 && z0 < terr.z1 + 0.4;
      const tryAt = (x0, z0, w2, d2, hb, allowTerr = false, yy = y, zone = P0) => {
        const x1 = x0 + w2, z1 = z0 + d2;
        if (x0 < zone.x0 || z0 < zone.z0 || x1 > zone.x1 || z1 > zone.z1) return false;
        if (!allowTerr && inTerr(x0, z0, x1, z1)) return false;
        if (occ.hit(x0 - 0.35, z0 - 0.35, x1 + 0.35, z1 + 0.35, yy, hb)) return false;
        return true;
      };
      const place = (w2, d2, hb, tries = 10, zone = P0, allowTerr = false) => {
        for (let i = 0; i < tries; i++) {
          const zw = zone.x1 - zone.x0 - w2, zd = zone.z1 - zone.z0 - d2;
          if (zw < 0 || zd < 0) return null;
          const x0 = zone.x0 + r() * zw, z0 = zone.z0 + r() * zd;
          if (tryAt(x0, z0, w2, d2, hb, allowTerr, y, zone)) return [x0, z0];
        }
        return null;
      };
      // clustered placement: gaussian-ish scatter around an anchor (the service corner / plant room)
      let anchor = [backX > 0 ? P0.x1 - 3 : P0.x0 + 3, backZ > 0 ? P0.z1 - 3 : P0.z0 + 3];
      const near = (w2, d2, hb, spread = 5, tries = 12) => {
        for (let i = 0; i < tries; i++) {
          const g1 = (r() + r() + r() - 1.5) * spread * 1.2, g2 = (r() + r() + r() - 1.5) * spread * 1.2;
          const x0 = Math.min(Math.max(anchor[0] + g1 - w2 / 2, P0.x0), P0.x1 - w2), z0 = Math.min(Math.max(anchor[1] + g2 - d2 / 2, P0.z0), P0.z1 - d2);
          if (tryAt(x0, z0, w2, d2, hb)) return [x0, z0];
        }
        return null;
      };
      const ao = (x0, z0, x1, z1, y0, h) => { // contact shadow on whichever skin this footprint stands on (AO grows with height)
        if (h < 0.25) return;
        const clip = Math.abs(y0 - y) < 0.05 ? R : (aoDeck && Math.abs(y0 - aoDeck.y) < 0.05 ? aoDeck : null);
        if (clip) tl.ao.ring(y0, x0, z0, x1, z1, Math.min(2.4, 0.35 + h * 0.32), h > 3 ? 0.42 : h > 1.2 ? 0.52 : 0.62, clip);
      };
      const solid = (x0, y0, z0, x1, y1, z1, kind = 'equipment') => { S.box(x0, y0, z0, x1, y1, z1, kind); occ.add(x0, y0, z0, x1, y1, z1); ao(x0, z0, x1, z1, y0, y1 - y0); };
      const corners = (x0, z0, x1, z1, yy) => {
        for (const [cx, cz, nx, nz] of [[x0, z0, -1, -1], [x1, z0, 1, -1], [x0, z1, -1, 1], [x1, z1, 1, 1]]) Z.add(cx - nx * 0.15, yy, cz - nz * 0.15, nx * Math.SQRT1_2, 0, nz * Math.SQRT1_2, 'roofCorner');
      };
      const rw = P0.x1 - P0.x0, rd = P0.z1 - P0.z0, area = Math.max(0, rw * rd);
      if (rw < 2 || rd < 2) continue;
      // existing buildings.js pieces on this roof: bulkhead = the anchor of the service cluster; glass-tower screen = clad it
      const existing = occ.on(m.x0, m.z0, m.x1, m.z1, y);
      const bh0 = existing.find(a => a[6] === K_BH && a[3] - a[0] > 1.8 && a[5] - a[2] > 1.8);
      if (bh0) anchor = [(bh0[0] + bh0[3]) / 2, (bh0[2] + bh0[5]) / 2];
      const hasWT = existing.some(a => a[6] === K_WT);
      // contact AO: parapet walls + everything buildings.js already stood on this roof
      if (m.parapet > 0.3) tl.ao.band(y, R.x0, R.z0, R.x1, R.z1, Math.min(1.4, 0.5 + m.parapet), 0.62);
      for (const a of existing) if (a[4] - a[1] > 0.3 && a[3] - a[0] < rw + 1 && a[5] - a[2] < rd + 1) ao(a[0], a[2], a[3], a[5], y, a[4] - a[1]);
      // r7: buildings.js stair bulkheads (light membrane top on limestone / brick walls read as bright white dice from
      // above): tarred / coated top skin, a dark metal coping rim 1.2 cm proud, soot streaks down the walls
      for (const a of existing) {
        if (a[6] !== K_BH || a[3] - a[0] < 1.8 || a[5] - a[2] < 1.8 || a[4] - a[1] < 2) continue;
        const e = 0.012, bt = a[4], cc = jit(pick(C_COPE, rs), rs, 0.06);
        rb.skin(a[0], a[2], a[3], a[5], bt + 0.006, pick([CELL.TAR, CELL.BITUMEN, CELL.EPDM, CELL.SILVER], rs), jit([0.78, 0.78, 0.78], rs, 0.08), ou, ov, rot, 0.4);
        for (const [a0, b0, a1, b1] of [[a[0] - e, a[2] - e, a[3] + e, a[2] + 0.2], [a[0] - e, a[5] - 0.2, a[3] + e, a[5] + e], [a[0] - e, a[2] + 0.2, a[0] + 0.2, a[5] - 0.2], [a[3] - 0.2, a[2] + 0.2, a[3] + e, a[5] - 0.2]])
          rb.box(a0, bt - 0.2, b0, a1, bt + 0.012, b1, CELL.METAL, cc.map(v => v * 0.8), cc);
        const hh = a[4] - a[1];
        tl.sk.wall(a[0], a[2], a[3], a[2], 0, -1, bt, hh, 0.9, rs() * 99); tl.sk.wall(a[3], a[5], a[0], a[5], 0, 1, bt, hh, 0.9, rs() * 99);
        tl.sk.wall(a[0], a[5], a[0], a[2], -1, 0, bt, hh, 0.9, rs() * 99); tl.sk.wall(a[3], a[2], a[3], a[5], 1, 0, bt, hh, 0.9, rs() * 99);
        st.bhDress = (st.bhDress ?? 0) + 1;
      }

      // ---- 0. glass tower: louvre cladding over the mechanical screen (+ its top as dark ballast), perimeter rail
      if (glassTop) {
        const scr = scrPre;
        st.scrMiss = (st.scrMiss ?? 0) + (scr ? 0 : 1);
        if (scr) {
          const e = 0.015, lc = pick(C_LOUV, r);
          rb.box(scr[0] - e, scr[1], scr[2] - e, scr[3] + e, scr[4] - 0.05, scr[5] + e, CELL.LOUVRE, lc, false);
          // cap band + dark ballast top
          rb.box(scr[0] - e - 0.04, scr[4] - 0.35, scr[2] - e - 0.04, scr[3] + e + 0.04, scr[4] + 0.012, scr[5] + e + 0.04, CELL.METAL, srgb(0x6c6f70), false);
          rb.skin(scr[0], scr[2], scr[3], scr[5], scr[4] + 0.021, r() < 0.5 ? CELL.GRAVEL : CELL.EPDM, jit([0.85, 0.85, 0.85], r, 0.06), ou, ov, rot, 0.6);
          lodBox(scr[0], scr[2], scr[3], scr[5], scr[4], y);
          st.clad++;
          // plant boxes / cooling cells standing on the screen roof: louvre them too
          for (const a of occ.on(scr[0], scr[2], scr[3], scr[5], scr[4])) {
            if (a[6] !== K_EQ || a[7] !== 0 || a[4] - a[1] < 2.3 || a[3] - a[0] < 3.5 || a[5] - a[2] < 2.8) continue;
            { const lc2 = jit(pick(C_LOUV, r), r, 0.06); // r3: with a weathered dark top 1.2 cm over the unit's light paint top (fans stay proud)
              rb.box(a[0] - e, a[1], a[2] - e, a[3] + e, a[4] + 0.012, a[5] + e, CELL.LOUVRE, lc2, lc2.map(v => v * 0.62), CELL.METAL); }
            lodBox(a[0], a[2], a[3], a[5], a[4], a[1]);
          }
          // round 3: the screen roof read as a big empty dark cap -> fill it: packaged units, tanks, cabinets, a duct run
          const yS = scr[4] + 0.012, zS = { x0: scr[0] + 0.7, z0: scr[2] + 0.7, x1: scr[3] - 0.7, z1: scr[5] - 0.7 };
          const aS = (zS.x1 - zS.x0) * (zS.z1 - zS.z0);
          for (let i = 0, n = Math.min(22, Math.floor(aS / 28)); i < n; i++) { // r4: denser (was aS / 45, max 12)
            const kk = r(), ax = r() < 0.5;
            if (kk > 0.82) { // r4: chillers on the screen roof
              const L = 5 + r() * 4, Wd = 2.1 + r() * 0.4, hh = 1.9 + r() * 0.4, w2 = ax ? L : Wd, d2 = ax ? Wd : L;
              let at = null;
              for (let tt = 0; tt < 8 && !at; tt++) { const x0 = zS.x0 + r() * Math.max(0, zS.x1 - zS.x0 - w2), z0 = zS.z0 + r() * Math.max(0, zS.z1 - zS.z0 - d2); if (tryAt(x0, z0, w2, d2, hh + 0.6, true, yS, zS)) at = [x0, z0]; }
              if (!at) continue;
              const hc = jit(pick(C_HVAC, r), r, 0.06);
              chiller(rb, S, at[0], at[1], at[0] + w2, at[1] + d2, yS, hh, ax, hc, hc.map(v => v * 0.72));
              S.box(at[0], yS, at[1], at[0] + w2, yS + hh, at[1] + d2, 'equipment');
              occ.add(at[0], yS, at[1], at[0] + w2, yS + hh + 0.3, at[1] + d2);
              tl.ao.ring(yS, at[0], at[1], at[0] + w2, at[1] + d2, Math.min(2, 0.35 + hh * 0.32), 0.5, zS);
              continue;
            }
            const w0 = kk < 0.5 ? 1.8 + r() * 2 : kk < 0.75 ? 1.2 + r() * 0.8 : 1.2 + r() * 1.2, d0 = kk < 0.5 ? 1.1 + r() * 0.6 : kk < 0.75 ? 1.2 + r() * 0.8 : 0.5;
            const w2 = ax ? w0 : d0, d2 = ax ? d0 : w0, hh = kk < 0.5 ? 0.9 + r() * 0.6 : kk < 0.75 ? 1.4 + r() * 1.2 : 1.6;
            let at = null;
            for (let tt = 0; tt < 8 && !at; tt++) { const x0 = zS.x0 + r() * Math.max(0, zS.x1 - zS.x0 - w2), z0 = zS.z0 + r() * Math.max(0, zS.z1 - zS.z0 - d2); if (tryAt(x0, z0, w2, d2, hh + 0.4, true, yS, zS)) at = [x0, z0]; }
            if (!at) continue;
            const [x0, z0] = at, x1 = x0 + w2, z1 = z0 + d2, hc = jit(pick(C_HVAC, r), r, 0.06), tc = hc.map(v => v * 0.72);
            if (kk < 0.5) {
              rb.box(x0, yS, z0, x1, yS + hh, z1, CELL.METAL, hc, tc);
              const nf = Math.max(1, Math.floor(w0 / 1.6));
              for (let f = 0; f < nf; f++) { const q = (f + 0.5) / nf, fx = ax ? x0 + w2 * q : (x0 + x1) / 2, fz = ax ? (z0 + z1) / 2 : z0 + d2 * q; rb.cyl(fx, fz, Math.min(d0 * 0.34, w0 / nf * 0.36), yS + hh, yS + hh + 0.1, tc, 10, CELL.METAL, C_DARK); }
              S.box(x0, yS, z0, x1, yS + hh, z1, 'equipment');
            } else if (kk < 0.75) {
              const tr = Math.min(w2, d2) / 2 * 0.9, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, tk = jit(pick(C_TANKSTEEL, r), r, 0.05).map(v => v * 0.75);
              rb.lathe([cx, yS, cz], [0, 1, 0], [[tr, 0], [tr, hh], [tr * 0.3, hh + tr * 0.3]], 12, tk, CELL.METAL, { cap: tk });
              S.cyl(cx, cz, yS, yS + hh, tr, tr, 'equipment'); S.cyl(cx, cz, yS + hh, yS + hh + tr * 0.3, tr, tr * 0.3, 'equipment');
            } else {
              rb.box(x0, yS, z0, x1, yS + hh, z1, CELL.METAL, jit(srgb(0x8a8e88), r, 0.05), jit(srgb(0x6a6d68), r, 0.05));
              S.box(x0, yS, z0, x1, yS + hh, z1, 'equipment');
            }
            occ.add(x0, yS, z0, x1, yS + hh + 0.3, z1);
            tl.ao.ring(yS, x0, z0, x1, z1, Math.min(2, 0.35 + hh * 0.32), 0.5, zS);
          }
        }
        // r9: metal parapet + projecting cap round the glass top (critic r7: "dark towers' tops lack parapets / cornices
        //     with depth and read as flat black caps"): a 0.9-1.4 m aluminium-clad upstand, a lighter coping 8 cm proud
        if (m.parapet === 0 && Math.min(w, d) > 8) {
          const r9g = mulberry32(Math.floor(Math.abs(m.x0 * 11.3 + m.z0 * 23.9 + m.y1)) + 313);
          const ph = 0.9 + r9g() * 0.5, th = 0.35, o = 0.08;
          const pc = jit(pick([srgb(0x5d6264), srgb(0x6e7072), srgb(0x4c5153), srgb(0x7a7a74)], r9g), r9g, 0.05);
          const cap = pc.map(v => v * 1.35);
          for (const [a0, b0, a1, b1] of [[m.x0, m.z0, m.x1, m.z0 + th], [m.x0, m.z1 - th, m.x1, m.z1], [m.x0, m.z0 + th, m.x0 + th, m.z1 - th], [m.x1 - th, m.z0 + th, m.x1, m.z1 - th]]) {
            if (occ.hit(a0 + 0.05, b0 + 0.05, a1 - 0.05, b1 - 0.05, y + 0.02, ph)) continue;
            rb.box(a0, y, b0, a1, y + ph - 0.12, b1, CELL.METAL, pc, false);
            rb.box(a0 - (a0 === m.x0 ? o : 0), y + ph - 0.12, b0 - (b0 === m.z0 ? o : 0), a1 + (a1 === m.x1 ? o : 0), y + ph, b1 + (b1 === m.z1 ? o : 0), CELL.METAL, pc.map(v => v * 0.8), cap);
            S.box(a0, y, b0, a1, y + ph, b1, 'parapet');
            occ.add(a0, y, b0, a1, y + ph, b1);
          }
          tl.ao.band(y, m.x0 + th, m.z0 + th, m.x1 - th, m.z1 - th, 1.1, 0.6);
          tl.sk.wall(m.x0, m.z0, m.x1, m.z0, 0, -1, y + ph, 3 + r9g() * 6, 0.5, r9g() * 99); tl.sk.wall(m.x1, m.z1, m.x0, m.z1, 0, 1, y + ph, 3 + r9g() * 6, 0.5, r9g() * 99);
          tl.sk.wall(m.x0, m.z1, m.x0, m.z0, -1, 0, y + ph, 3 + r9g() * 6, 0.5, r9g() * 99); tl.sk.wall(m.x1, m.z0, m.x1, m.z1, 1, 0, y + ph, 3 + r9g() * 6, 0.5, r9g() * 99);
          st.gpar = (st.gpar ?? 0) + 1;
        }
        // dish cluster + lattice mast on the ring
        dishes(rb, S, occ, tryAt, r, P0, y, 2 + Math.floor(r() * 3), st);
        continue;
      }

      // ---- 0b. helipad on big tall roofs (and the hero tower): raised steel deck, painted ring + H, corner lights
      if (isTop && tall && area > 650 && (bld.hero || r() < 0.13)) { // r4: rarer (two in one aerial frame read as a stamp)
        const ps = Math.min(15, Math.min(rw, rd) * 0.55);
        const nt = 1.4; // r4: safety-net apron around the deck
        const at0 = place(ps + 2 * nt, ps + 2 * nt, 3, 12);
        const at = at0 && [at0[0] + nt, at0[1] + nt];
        if (at) {
          const [x0, z0] = at, x1 = x0 + ps, z1 = z0 + ps, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, py = y + 0.6;
          // safety net: dark mesh apron just below the deck edge on posts (exact thin boxes) + perimeter edge lights
          const nc = srgb(0x2f3232), ny = py - 0.18;
          for (const [a0, b0, a1, b1] of [[x0 - nt, z0 - nt, x1 + nt, z0], [x0 - nt, z1, x1 + nt, z1 + nt], [x0 - nt, z0, x0, z1], [x1, z0, x1 + nt, z1]]) {
            rb.box(a0, ny - 0.03, b0, a1, ny, b1, CELL.LOUVRE, nc, nc.map(v => v * 1.3));
            S.box(a0, ny - 0.03, b0, a1, ny, b1, 'awning', 1);
          }
          for (const [a0, b0] of [[x0 - nt, z0 - nt], [x1 + nt - 0.08, z0 - nt], [x0 - nt, z1 + nt - 0.08], [x1 + nt - 0.08, z1 + nt - 0.08]]) {
            rb.box(a0, y, b0, a0 + 0.08, ny - 0.03, b0 + 0.08, CELL.METAL, C_FRAME, false); S.box(a0, y, b0, a0 + 0.08, ny - 0.03, b0 + 0.08, 'pole');
          }
          for (let q = 1.5; q < ps - 1; q += 3) for (const [lx, lz] of [[x0 + q, z0 + 0.25], [x0 + q, z1 - 0.25], [x0 + 0.25, z0 + q], [x1 - 0.25, z0 + q]]) {
            rb.cyl(lx, lz, 0.07, py, py + 0.1, srgb(0x8a9a70), 6); S.cyl(lx, lz, py, py + 0.1, 0.07, 0.07, 'equipment');
          }
          rb.box(x0, y, z0, x1, py, z1, CELL.METAL, srgb(0x5a5d5f), srgb(0x6a6c6b), CELL.EPDM);
          const pc = srgb(0xa8a080), R0 = ps * 0.42;
          rb.lathe([cx, py + 0.006, cz], [0, 1, 0], [[R0, 0], [R0 - 0.45, 0]], 28, pc, CELL.METAL, { back: true, base: y });
          const hc = srgb(0xc4c0b2), hh = ps * 0.22, hw = ps * 0.13;
          rb.box(cx - hw - 0.25, py, cz - hh, cx - hw + 0.25, py + 0.008, cz + hh, CELL.METAL, hc, null, null);
          rb.box(cx + hw - 0.25, py, cz - hh, cx + hw + 0.25, py + 0.008, cz + hh, CELL.METAL, hc, null, null);
          rb.box(cx - hw + 0.25, py, cz - 0.25, cx + hw - 0.25, py + 0.008, cz + 0.25, CELL.METAL, hc, null, null);
          for (const [lx, lz] of [[x0 + 0.3, z0 + 0.3], [x1 - 0.3, z0 + 0.3], [x0 + 0.3, z1 - 0.3], [x1 - 0.3, z1 - 0.3]]) {
            rb.cyl(lx, lz, 0.1, py, py + 0.18, srgb(0x9a9460), 6);
            S.cyl(lx, lz, py, py + 0.18, 0.1, 0.1, 'equipment');
          }
          solid(x0, y, z0, x1, py, z1, 'roof');
          corners(x0, z0, x1, z1, py);
          st.heli = (st.heli ?? 0) + 1;
        }
      }
      // ---- 0c. r7: long narrow slab tops (critic: "trench-like roof with a few isolated boxes"): a spine of mechanical
      //      penthouse segments along the long axis (brick / concrete machine rooms, louvred plant rooms, a cooling-tower
      //      cell), different heights, with gaps; stepped massing from above and in the skyline
      if (isTop && bld.H > 40 && Math.max(rw, rd) > 24 && Math.max(rw, rd) / Math.min(rw, rd) > 3 && Math.min(rw, rd) < 16) {
        const ax = rw >= rd, L0 = ax ? P0.x0 : P0.z0, L1 = ax ? P0.x1 : P0.z1, W0 = ax ? P0.z0 : P0.x0, W1 = ax ? P0.z1 : P0.x1;
        const inset = Math.min(0.6, (W1 - W0) * 0.08);
        let q = L0 + 1 + rs() * 4, nseg = 0;
        while (q < L1 - 5) {
          const len = Math.min(L1 - q, 7 + rs() * 14), kind = rs(), hh = kind < 0.35 ? 5 + rs() * 4 : kind < 0.8 ? 3.2 + rs() * 2.5 : 2.4 + rs() * 1.2;
          const a0 = W0 + inset + (rs() < 0.3 ? (W1 - W0) * 0.2 : 0), a1 = W1 - inset - (rs() < 0.3 ? (W1 - W0) * 0.2 : 0);
          const [x0, z0, x1, z1] = ax ? [q, a0, q + len, a1] : [a0, q, a1, q + len];
          if (len > 3.5 && a1 - a0 > 2.5 && !occ.hit(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, y, hh + 1)) {
            const yt = y + hh;
            if (kind < 0.35) { // machine room in the building's own wall material (reads as massing, not clutter)
              const pe = { ...m.p, style: STYLE.BLANK, tint: (m.p.tint ?? [1, 1, 1]).map(v => v * (0.82 + rs() * 0.14)), topY: yt };
              gt.fac.box(x0, y, z0, x1, yt, z1, pe, {}, true, false, { ...pe, layer: LAYER.ROOF, tint: [0.62, 0.62, 0.6] });
              gt.lod.box(x0, top, z0, x1, yt, z1, pe, {}, true, false, { ...pe, layer: LAYER.ROOF, tint: [0.62, 0.62, 0.6] });
              rb.skin(x0, z0, x1, z1, yt + 0.006, rs() < 0.5 ? CELL.BITUMEN : CELL.GRAVEL, jit([0.85, 0.85, 0.85], rs, 0.06), ou, ov, rot, 0.5);
              rb.box(x0 - 0.04, yt - 0.25, z0 - 0.04, x1 + 0.04, yt + 0.05, z1 + 0.04, CELL.METAL, jit(pick(C_COPE, rs), rs, 0.06), false);
              // a louvre band on one long face
              const lc = pick(C_LOUV, rs);
              if (ax) rb.box(x0 + 1, y + 1, z0 - 0.03, Math.min(x1 - 1, x0 + 1 + len * 0.5), y + hh * 0.6, z0, CELL.LOUVRE, lc, false);
              else rb.box(x0 - 0.03, y + 1, z0 + 1, x0, y + hh * 0.6, Math.min(z1 - 1, z0 + 1 + len * 0.5), CELL.LOUVRE, lc, false);
            } else if (kind < 0.8) { // louvred plant room
              const baseH = 0.9 + rs() * 0.8, lc = pick(C_LOUV, rs), baseCol = jit(srgb(0x8e8a82), rs, 0.06);
              rb.box(x0, y, z0, x1, y + baseH, z1, CELL.PAVERS, baseCol, false);
              rb.box(x0, y + baseH, z0, x1, yt, z1, CELL.LOUVRE, lc, false);
              rb.box(x0 - 0.05, yt - 0.3, z0 - 0.05, x1 + 0.05, yt + 0.012, z1 + 0.05, CELL.METAL, srgb(0x656868), false);
              rb.skin(x0 - 0.05, z0 - 0.05, x1 + 0.05, z1 + 0.05, yt + 0.021, rs() < 0.5 ? CELL.EPDM : CELL.GRAVEL, jit([0.9, 0.9, 0.9], rs, 0.06), ou, ov, rot, 0.5);
              lodBox(x0, z0, x1, z1, yt);
            } else { // cooling-tower cell block: fan deck with shrouded fans
              const hc = jit(pick(C_HVAC, rs), rs, 0.06);
              rb.box(x0, y, z0, x1, yt, z1, CELL.LOUVRE, hc, hc.map(v => v * 0.7), CELL.METAL);
              const nf = Math.max(1, Math.floor(len / 3.2)), fr = Math.min(1.3, (a1 - a0) * 0.36, len / nf * 0.4);
              for (let f = 0; f < nf; f++) {
                const c0 = q + len * (f + 0.5) / nf, cw = (a0 + a1) / 2;
                rb.cyl(ax ? c0 : cw, ax ? cw : c0, fr, yt, yt + 0.5, hc.map(v => v * 0.8), 12, CELL.METAL, C_DARK);
                S.cyl(ax ? c0 : cw, ax ? cw : c0, yt, yt + 0.5, fr, fr, 'equipment');
              }
              lodBox(x0, z0, x1, z1, yt);
            }
            solid(x0, y, z0, x1, yt, z1, 'bulkhead');
            corners(x0, z0, x1, z1, yt);
            nseg++;
          }
          q += len + 2.5 + rs() * 6;
        }
        if (nseg && rs() < 0.6) { // a whip antenna / mast at one end
          const mx = ax ? L1 - 2 : (W0 + W1) / 2, mz = ax ? (W0 + W1) / 2 : L1 - 2;
          if (!occ.hit(mx - 0.8, mz - 0.8, mx + 0.8, mz + 0.8, y, 4)) { mast(rb, S, Z, mx, y, mz, 8 + rs() * 10, rs); occ.add(mx - 0.8, y, mz - 0.8, mx + 0.8, y + 10, mz + 0.8); }
        }
        st.spine = (st.spine ?? 0) + nseg;
      }
      // ---- 1. big structures: mechanical penthouse (louvred, clutter material) / residential penthouse (facade)
      let deck = null; // a structure's roof we can also dress
      if (isTop && area > 110 && bld.H > 22) {
        const pent = (type === 'apt' || type === 'loft' || type === 'walkup') && bld.H < 95 && r() < 0.3;
        const mech = !pent && (tall || ((type === 'postwar' || type === 'loft' || type === 'deco' || type === 'apt') && r() < (type === 'postwar' ? 0.85 : 0.6)));
        if (pent || mech) {
          const fw = pent ? 0.45 + r() * 0.3 : (tall ? 0.3 + r() * 0.16 : 0.28 + r() * 0.22), fd = pent ? 0.45 + r() * 0.3 : (tall ? 0.3 + r() * 0.16 : 0.28 + r() * 0.22);
          const bw = Math.max(4, rw * fw), bd = Math.max(4, rd * fd);
          const floors = pent ? 1 + (r() < 0.45 ? 1 : 0) : 1;
          const fh = A.floorH ?? 3.4;
          const bh = pent ? floors * fh : (tall ? 5.5 + r() * 3.5 : 4.0 + r() * 2.6);
          let at = null, bw2 = bw, bd2 = bd;
          for (let k = 0; k < 5 && !at; k++) { at = pent ? place(bw2, bd2, bh + 1, 12) : (near(bw2, bd2, bh + 1, 3, 8) ?? place(bw2, bd2, bh + 1, 10)); if (!at) { bw2 = Math.max(3.5, bw2 * 0.8); bd2 = Math.max(3.5, bd2 * 0.8); } }
          if (at) {
            const [bx, bz] = at, x1 = bx + bw2, z1 = bz + bd2, yt = y + bh;
            if (pent) {
              const glassy = r() < 0.4;
              const p = glassy ? { ...m.p, style: STYLE.CURTAIN, layer: LAYER.METAL, bayW: 1.6, winW: 0.95, winH: 0.8, floorH: fh, margin: 0, depth: 0.04, tint: [1, 1, 1], topY: yt }
                : { ...m.p, topY: yt };
              const sty = glassy ? STYLE.CURTAIN : (m.p.style ?? A.style ?? STYLE.PUNCHED);
              const faces = { all: { style: sty, gH: -(A.gH ?? 4) } };
              gt.fac.box(bx, y, bz, x1, yt, z1, p, faces, false);
              gt.lod.box(bx, top, bz, x1, yt, z1, p, faces, true, false, { ...p, style: STYLE.BLANK, layer: LAYER.ROOF, tint: [0.85, 0.85, 0.85] });
              gt.fac.horiz(bx, bz, x1, z1, yt, { ...p, style: STYLE.BLANK, layer: LAYER.ROOF, tint: [0.8, 0.8, 0.8] });
              rb.skin(bx, bz, x1, z1, yt + 0.006, r() < 0.5 ? CELL.BITUMEN : CELL.SILVER, jit([1, 1, 1], r, 0.06), ou, ov, rot, 0.6);
              st.pent++;
            } else {
              // louvred plant room: concrete / brick base band, louvre wall above, dark roof with a coping
              const baseH = Math.min(1.2 + r() * 1.4, bh * 0.4), lc = pick(C_LOUV, r);
              const baseCol = r() < 0.5 ? jit(srgb(0x9a958b), r, 0.06) : jit(C_BRICK, r, 0.1);
              rb.box(bx, y, bz, x1, y + baseH, z1, CELL.PAVERS, baseCol, false);
              rb.box(bx, y + baseH, bz, x1, yt, z1, CELL.LOUVRE, lc, false);
              rb.box(bx - 0.05, yt - 0.3, bz - 0.05, x1 + 0.05, yt + 0.012, z1 + 0.05, CELL.METAL, srgb(0x707372), false);
              rb.skin(bx - 0.05, bz - 0.05, x1 + 0.05, z1 + 0.05, yt + 0.021, r() < 0.5 ? CELL.EPDM : CELL.GRAVEL, jit([0.9, 0.9, 0.9], r, 0.06), ou, ov, rot, 0.5);
              lodBox(bx, bz, x1, z1, yt);
              st.mech++;
            }
            solid(bx, y, bz, x1, yt, z1, 'bulkhead');
            corners(bx, bz, x1, z1, yt);
            if (!bh0) anchor = [(bx + x1) / 2, (bz + z1) / 2];
            if (Math.min(bw2, bd2) > 3) deck = { x0: bx + 0.5, z0: bz + 0.5, x1: x1 - 0.5, z1: z1 - 0.5, y: yt };
            aoDeck = { x0: bx, z0: bz, x1, z1, y: yt };
            if (pent && !terr) terr = { x0: R.x0, z0: R.z0, x1: R.x1, z1: R.z1, cell: CELL.DECK };
            // elevator overrun next to a mechanical penthouse (brick / concrete, facade material)
            if (mech && r() < 0.65) {
              const ew = 2.6 + r() * 1.4, ed = 2.6 + r() * 1.4, eh = bh + 1.6 + r() * 1.8;
              const at2 = near(ew, ed, eh + 1, 4, 10);
              if (at2) {
                const [ex, ez] = at2, ey = y + eh;
                const pe = { ...m.p, style: STYLE.BLANK, layer: r() < 0.5 ? (m.p.layer ?? LAYER.CONCRETE) : LAYER.CONCRETE, tint: (m.p.tint ?? [1, 1, 1]).map(v => v * 0.9), topY: ey };
                gt.fac.box(ex, y, ez, ex + ew, ey, ez + ed, pe, {}, true, false, { ...pe, layer: LAYER.ROOF, tint: [0.7, 0.7, 0.7] });
                gt.lod.box(ex, top, ez, ex + ew, ey, ez + ed, pe, {}, true, false, { ...pe, layer: LAYER.ROOF, tint: [0.7, 0.7, 0.7] });
                solid(ex, y, ez, ex + ew, ey, ez + ed, 'bulkhead');
                corners(ex, ez, ex + ew, ez + ed, ey);
              }
            }
          }
        }
      }
      // ---- 1c. r9: mass-scale plant on big tall / office slab roofs (critic r7: "tower tops too clean, near-empty flat
      //      caps: mechanical penthouses, cooling towers, stained membranes"; "huge flat grey plane with a couple of tiny
      //      boxes"). Big cooling-tower banks on steel dunnage (cells, casings, fan stacks, deck rail, ladder, pipe runs)
      //      and second machine rooms in the wall material. Own stream `r9` (the roof layout stream r is unchanged).
      if (isTop && !greenRoof && aT !== 'garden' && aT !== 'pool' && area > 380
        && (tall || bld.hero || ((type === 'postwar' || type === 'deco' || type === 'loft') && area > 700))) {
        const r9 = mulberry32(Math.floor(Math.abs(m.x0 * 31.7 + m.z1 * 13.1 + m.y1 * 7.3)) + 9091);
        const place9 = (w2, d2, hb) => {
          for (let i = 0; i < 14; i++) {
            const zw = P0.x1 - P0.x0 - w2, zd = P0.z1 - P0.z0 - d2;
            if (zw < 0 || zd < 0) return null;
            const x0 = P0.x0 + r9() * zw, z0 = P0.z0 + r9() * zd;
            if (tryAt(x0, z0, w2, d2, hb)) return [x0, z0];
          }
          return null;
        };
        const nBig = Math.min(3, (tall ? 1 : 0) + (area > 900 ? 2 : 1));
        for (let b = 0; b < nBig; b++) {
          const kind = b === 0 ? (r9() < 0.65 ? 0 : 1) : (r9() < 0.5 ? 0 : 1);
          if (kind === 0) { // cooling-tower bank: nA x nB cells on a steel dunnage frame
            const cs = 3.4 + r9() * 1.2, nA = 1 + Math.floor(r9() * (area > 900 ? 4 : 3)), nB = r9() < 0.45 ? 2 : 1;
            const ax = r9() < 0.5, w2 = (ax ? nA : nB) * cs, d2 = (ax ? nB : nA) * cs;
            const dun = 0.8 + r9() * 0.5, ch = 3.6 + r9() * 2.4, stack = 1.0 + r9() * 0.9;
            const at = place9(w2 + 1.2, d2 + 1.2, dun + ch + stack + 0.5);
            if (!at) continue;
            const x0 = at[0] + 0.6, z0 = at[1] + 0.6, x1 = x0 + w2, z1 = z0 + d2, yb = y + dun, yt = yb + ch;
            // dunnage: I-beams across + posts
            const stc = jit(pick(C_STEEL, r9), r9, 0.06);
            for (let q = 0; q <= (ax ? nA : nB); q++) {
              const a = (ax ? x0 : z0) + q * cs - (q ? 0.15 : 0);
              if (ax) rb.box(a, yb - 0.35, z0 - 0.3, a + 0.15, yb, z1 + 0.3, CELL.METAL, stc);
              else rb.box(x0 - 0.3, yb - 0.35, a, x1 + 0.3, yb, a + 0.15, CELL.METAL, stc);
              for (const e of [0, 1]) {
                const px = ax ? a : (e ? x1 + 0.1 : x0 - 0.3), pz = ax ? (e ? z1 + 0.1 : z0 - 0.3) : a;
                rb.box(px, y, pz, px + 0.2, yb - 0.35, pz + 0.2, CELL.METAL, stc.map(v => v * 0.85), false);
                S.box(px, y, pz, px + 0.2, yb - 0.35, pz + 0.2, 'pole');
              }
              if (ax) S.box(a, yb - 0.35, z0 - 0.3, a + 0.15, yb, z1 + 0.3, 'equipment');
              else S.box(x0 - 0.3, yb - 0.35, a, x1 + 0.3, yb, a + 0.15, 'equipment');
            }
            // casing: louvred air-inlet lower band, sheet-metal upper casing, fan deck
            const cc = jit(pick([srgb(0x8d9290), srgb(0x7f8784), srgb(0x9a968c), srgb(0x6f7775)], r9), r9, 0.06);
            rb.box(x0, yb, z0, x1, yb + ch * 0.5, z1, CELL.LOUVRE, cc.map(v => v * 0.92), false);
            rb.box(x0, yb + ch * 0.5, z0, x1, yt, z1, CELL.METAL, cc, cc.map(v => v * 0.7));
            // cell partition ribs on the casing
            for (let q = 1; q < nA; q++) {
              const a = (ax ? x0 : z0) + q * cs;
              if (ax) rb.box(a - 0.06, yb, z0 - 0.05, a + 0.06, yt + 0.05, z1 + 0.05, CELL.METAL, cc.map(v => v * 0.75), false);
              else rb.box(x0 - 0.05, yb, a - 0.06, x1 + 0.05, yt + 0.05, a + 0.06, CELL.METAL, cc.map(v => v * 0.75), false);
            }
            // fan stacks (velocity-recovery cylinders) + dark fan discs
            for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) {
              const fx = ax ? x0 + (i + 0.5) * cs : x0 + (j + 0.5) * cs, fz = ax ? z0 + (j + 0.5) * cs : z0 + (i + 0.5) * cs, fr = cs * 0.4;
              rb.lathe([fx, yt, fz], [0, 1, 0], [[fr, 0], [fr * 1.02, stack * 0.6], [fr * 1.1, stack]], 12, cc.map(v => v * 0.86), CELL.METAL, { back: true });
              rb.disc(fx, yt + stack * 0.45, fz, fr * 1.01, C_DARK, 12);
              S.cyl(fx, fz, yt, yt + stack, fr, fr * 1.1, 'equipment');
            }
            // deck handrail on two sides + caged ladder
            const rc = srgb(0xa8a45a).map(v => v * 0.8);
            rb.box(x0, yt + 1.0, z0, x1, yt + 1.06, z0 + 0.05, CELL.METAL, rc, false);
            rb.box(x0, yt + 1.0, z1 - 0.05, x1, yt + 1.06, z1, CELL.METAL, rc, false);
            for (let q = x0; q <= x1 + 0.01; q += Math.max(1.5, w2 / Math.ceil(w2 / 2))) for (const zz of [z0, z1 - 0.05]) rb.box(Math.min(q, x1 - 0.05), yt, zz, Math.min(q, x1 - 0.05) + 0.05, yt + 1.0, zz + 0.05, CELL.METAL, rc, false);
            rb.box(x1, y, z0 + 0.4, x1 + 0.12, yt + 1.0, z0 + 1.0, CELL.METAL, rc, false);
            // condenser-water pipes: two runs from the base across the roof on stands
            const pl = 4 + r9() * 10, pc = jit(pick(C_PIPE, r9), r9, 0.06), dir = ax ? (backZ > 0 ? -1 : 1) : (backX > 0 ? -1 : 1);
            for (const o of [0.5, 1.3]) {
              const [a0, b0, a1, b1] = ax ? [x0 + o, dir > 0 ? z1 + 0.3 : z0 - 0.3 - pl, x0 + o + 0.4, dir > 0 ? z1 + 0.3 + pl : z0 - 0.3]
                : [dir > 0 ? x1 + 0.3 : x0 - 0.3 - pl, z0 + o, dir > 0 ? x1 + 0.3 + pl : x0 - 0.3, z0 + o + 0.4];
              if (a0 < P0.x0 || b0 < P0.z0 || a1 > P0.x1 || b1 > P0.z1 || occ.hit(a0, b0, a1, b1, y, 1.2)) continue;
              rb.box(a0, y + 0.55, b0, a1, y + 0.95, b1, CELL.METAL, pc, pc.map(v => v * 1.08));
              S.box(a0, y + 0.55, b0, a1, y + 0.95, b1, 'equipment');
              occ.add(a0, y, b0, a1, y + 0.95, b1);
            }
            S.box(x0, yb, z0, x1, yt, z1, 'equipment'); S.box(x1, y, z0 + 0.4, x1 + 0.12, yt + 1.0, z0 + 1.0, 'pole');
            occ.add(x0 - 0.3, y, z0 - 0.3, x1 + 0.3, yt + stack, z1 + 0.3); ao(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, y, yt - y);
            lodBox(x0, z0, x1, z1, yt + stack * 0.6);
            corners(x0, z0, x1, z1, yt);
            st.ct9 = (st.ct9 ?? 0) + 1;
          } else { // second machine room in the building's wall material, louvre band, coping, gravel top + units
            const bw = Math.min(rw * 0.5, 7 + r9() * 9), bd = Math.min(rd * 0.5, 5 + r9() * 7), bh = 4.5 + r9() * 4;
            const at = place9(bw, bd, bh + 1);
            if (!at) continue;
            const [x0, z0] = at, x1 = x0 + bw, z1 = z0 + bd, yt = y + bh;
            const pe = { ...m.p, style: STYLE.BLANK, tint: (m.p.tint ?? [1, 1, 1]).map(v => v * (0.78 + r9() * 0.16)), topY: yt };
            gt.fac.box(x0, y, z0, x1, yt, z1, pe, {}, true, false, { ...pe, layer: LAYER.ROOF, tint: [0.6, 0.6, 0.58] });
            gt.lod.box(x0, top, z0, x1, yt, z1, pe, {}, true, false, { ...pe, layer: LAYER.ROOF, tint: [0.6, 0.6, 0.58] });
            rb.skin(x0, z0, x1, z1, yt + 0.006, r9() < 0.5 ? CELL.GRAVEL : CELL.BITUMEN, jit([0.82, 0.82, 0.82], r9, 0.06), ou, ov, rot, 0.5);
            const cc = jit(pick(C_COPE, r9), r9, 0.06);
            rb.box(x0 - 0.05, yt - 0.3, z0 - 0.05, x1 + 0.05, yt + 0.05, z1 + 0.05, CELL.METAL, cc.map(v => v * 0.85), cc);
            const lc = pick(C_LOUV, r9), lb = 1 + r9() * 1.5;
            rb.box(x0 + 0.8, y + lb, z0 - 0.03, x1 - 0.8, y + lb + (bh - lb) * 0.55, z0, CELL.LOUVRE, lc, false);
            rb.box(x1, y + lb, z0 + 0.8, x1 + 0.03, y + lb + (bh - lb) * 0.55, z1 - 0.8, CELL.LOUVRE, lc, false);
            tl.sk.wall(x0, z0, x1, z0, 0, -1, yt, bh, 0.9, r9() * 99); tl.sk.wall(x1, z1, x0, z1, 0, 1, yt, bh, 0.9, r9() * 99);
            tl.sk.wall(x0, z1, x0, z0, -1, 0, yt, bh, 0.9, r9() * 99); tl.sk.wall(x1, z0, x1, z1, 1, 0, yt, bh, 0.9, r9() * 99);
            solid(x0, y, z0, x1, yt, z1, 'bulkhead');
            corners(x0, z0, x1, z1, yt);
            // packaged units + an exhaust stack on its roof
            for (let i = 0, n = 1 + Math.floor(r9() * 3); i < n; i++) {
              const uw = 1.6 + r9() * 1.6, ud = 1.1 + r9() * 0.9, uh = 0.9 + r9() * 0.8;
              const ux = x0 + 0.5 + r9() * Math.max(0, bw - uw - 1), uz = z0 + 0.5 + r9() * Math.max(0, bd - ud - 1);
              if (ux + uw > x1 - 0.4 || uz + ud > z1 - 0.4 || occ.hit(ux, uz, ux + uw, uz + ud, yt, uh)) continue;
              const hc = pick(C_HVAC, r9);
              rb.box(ux, yt, uz, ux + uw, yt + uh, uz + ud, CELL.METAL, hc);
              rb.cyl(ux + uw / 2, uz + ud / 2, Math.min(uw, ud) * 0.33, yt + uh, yt + uh + 0.1, hc.map(v => v * 0.8), 10, CELL.METAL, C_DARK);
              S.box(ux, yt, uz, ux + uw, yt + uh, uz + ud, 'equipment'); occ.add(ux, yt, uz, ux + uw, yt + uh, uz + ud);
            }
            if (r9() < 0.6) { const sx = x0 + 0.8, sz = z1 - 0.8, sh = 2 + r9() * 3;
              rb.cyl(sx, sz, 0.35, yt, yt + sh, srgb(0x5e6060), 8, CELL.METAL, C_DARK); S.cyl(sx, sz, yt, yt + sh, 0.35, 0.35, 'equipment'); }
            st.pent9 = (st.pent9 ?? 0) + 1;
          }
        }
        // stained membrane: big ponding / tar-bleed stains + re-roof patches over the field
        for (let i = 0, n = 3 + Math.floor(r9() * 6); i < n; i++) {
          const pw = Math.min(R.x1 - R.x0 - 0.4, 2 + r9() * 9), pd = Math.min(R.z1 - R.z0 - 0.4, 1.5 + r9() * 7);
          if (pw < 1 || pd < 1) break;
          const x0 = R.x0 + 0.2 + r9() * (R.x1 - R.x0 - 0.4 - pw), z0 = R.z0 + 0.2 + r9() * (R.z1 - R.z0 - 0.4 - pd);
          if (inTerr(x0, z0, x0 + pw, z0 + pd)) continue;
          const k = r9(), pc = k < 0.5 ? CELL.TAR : k < 0.8 ? CELL.EPDM : CELL.BITUMEN;
          rb.skin(x0, z0, x0 + pw, z0 + pd, y + 0.0105 + i * 0.0004, pc, jit([0.46, 0.45, 0.43], r9, 0.25), r9() * 30, r9() * 30, r9() < 0.5, 0.18);
        }
      }
      // ---- 1b. open-top louvred equipment screen on big / tall roofs: four louvre walls around a group of units
      if (isTop && (tall || (area > 500 && (type === 'postwar' || type === 'loft'))) && r() < (tall ? 0.75 : 0.35)) {
        const sw = 6 + r() * 7, sd = 5 + r() * 5, sh = 2.4 + r() * 1.0, wt = 0.15;
        const at = place(sw, sd, sh + 0.5, 12);
        if (at) {
          const [x0, z0] = at, x1 = x0 + sw, z1 = z0 + sd, lc = jit(pick(C_LOUV, r), r, 0.05);
          const walls = [[x0, z0, x1, z0 + wt], [x0, z1 - wt, x1, z1], [x0, z0 + wt, x0 + wt, z1 - wt], [x1 - wt, z0 + wt, x1, z1 - wt]];
          for (const [a0, b0, a1, b1] of walls) {
            rb.box(a0, y + 0.1, b0, a1, y + sh, b1, CELL.LOUVRE, lc, lc.map(v => v * 0.7), CELL.METAL);
            for (let q = (a1 - a0 > b1 - b0 ? a0 : b0) + 0.05; q < (a1 - a0 > b1 - b0 ? a1 : b1); q += 2.4) { // posts
              if (a1 - a0 > b1 - b0) rb.box(q, y, b0 - 0.03, q + 0.1, y + sh, b1 + 0.03, CELL.METAL, C_FRAME, null); else rb.box(a0 - 0.03, y, q, a1 + 0.03, y + sh, q + 0.1, CELL.METAL, C_FRAME, null);
            }
            S.box(a0 - 0.03, y, b0 - 0.03, a1 + 0.03, y + sh, b1 + 0.03, 'equipment');
            ao(a0, b0, a1, b1, y, sh * 0.6);
          }
          occ.add(x0, y, z0, x1, y + sh, z1);
          // units inside (condensers / RTUs), their tops just below the screen top
          const inner = [];
          for (let i = 0, n = Math.floor(sw * sd / 14); i < n; i++) {
            const uw = 1.4 + r() * 1.6, ud = 1.1 + r() * 0.9, uh = Math.min(sh - 0.4, 1.1 + r() * 0.8);
            const ux0 = x0 + 0.5 + r() * Math.max(0, sw - 1 - uw), uz0 = z0 + 0.5 + r() * Math.max(0, sd - 1 - ud);
            const clash = inner.some(u => ux0 < u[2] + 0.4 && ux0 + uw > u[0] - 0.4 && uz0 < u[3] + 0.4 && uz0 + ud > u[1] - 0.4);
            if (clash) continue;
            inner.push([ux0, uz0, ux0 + uw, uz0 + ud]);
            const hc = jit(pick(C_HVAC, r), r, 0.06), tc = hc.map(v => v * 0.72);
            rb.box(ux0, y, uz0, ux0 + uw, y + uh, uz0 + ud, CELL.METAL, hc, tc);
            rb.cyl(ux0 + uw / 2, uz0 + ud / 2, Math.min(uw, ud) * 0.34, y + uh, y + uh + 0.1, tc, 10, CELL.METAL, C_DARK);
            S.box(ux0, y, uz0, ux0 + uw, y + uh, uz0 + ud, 'equipment');
            tl.ao.ring(y, ux0, uz0, ux0 + uw, uz0 + ud, 0.6, 0.55, { x0: x0 + wt, z0: z0 + wt, x1: x1 - wt, z1: z1 - wt });
          }
          lodBox(x0, z0, x1, z1, y + sh);
          corners(x0, z0, x1, z1, y + sh);
          st.screen = (st.screen ?? 0) + 1;
        }
      }
      // stair bulkhead on roofs that have none (lower terraces with access, deco towers): brick box + door
      if (!bh0 && !deck && isTop && area > 40 && bld.H > 12 && r() < 0.75) {
        const bw = 2.4 + r() * 1.4, bd = 3.2 + r() * 1.4, bhh = 2.8 + r() * 0.6, sw = r() < 0.5;
        const at = near(sw ? bd : bw, sw ? bw : bd, bhh + 0.5, 2, 10);
        if (at) {
          const [bx, bz] = at, x1 = bx + (sw ? bd : bw), z1 = bz + (sw ? bw : bd), yt = y + bhh;
          const pb = { ...m.p, style: STYLE.BLANK, layer: r() < 0.6 ? (m.p.layer ?? LAYER.RED) : LAYER.RED, tint: (m.p.tint ?? [1, 1, 1]).map(v => v * 0.88), topY: yt };
          gt.fac.box(bx, y, bz, x1, yt, z1, pb, {}, true, false, { ...pb, layer: LAYER.ROOF, tint: [0.7, 0.7, 0.7] });
          gt.lod.box(bx, top, bz, x1, yt, z1, pb, {}, true, false, { ...pb, layer: LAYER.ROOF, tint: [0.7, 0.7, 0.7] });
          rb.skin(bx, bz, x1, z1, yt + 0.006, r() < 0.5 ? CELL.TAR : CELL.SILVER, jit([1, 1, 1], r, 0.06), ou, ov, rot, 0.4);
          // steel door on the face toward the roof centre
          const cxm = (P0.x0 + P0.x1) / 2, dz = (bz + z1) / 2 < (P0.z0 + P0.z1) / 2;
          if (dz) rb.box((bx + x1) / 2 - 0.45, y, z1, (bx + x1) / 2 + 0.45, y + 2.05, z1 + 0.03, CELL.METAL, srgb(0x3d4246));
          else rb.box((bx + x1) / 2 - 0.45, y, bz - 0.03, (bx + x1) / 2 + 0.45, y + 2.05, bz, CELL.METAL, srgb(0x3d4246));
          void cxm;
          solid(bx, y, bz, x1, yt, z1, 'bulkhead');
          corners(bx, bz, x1, z1, yt);
          anchor = [(bx + x1) / 2, (bz + z1) / 2];
        }
      }

      // ---- 9b. r4: painted sports court (basketball / tennis-ish) on big low roofs + podiums, chain-link fence posts + rail
      if (!greenRoof && !tall && area > 380 && (lower || type === 'loft' || type === 'postwar' || type === 'apt') && r() < 0.14) {
        const cl = 11 + r() * 6, cw = 7 + r() * 3, ax = rw > rd;
        const w2 = ax ? cl : cw, d2 = ax ? cw : cl;
        const at = place(w2, d2, 3.4, 10, P0, true);
        if (at) {
          const [x0, z0] = at, x1 = x0 + w2, z1 = z0 + d2, yy = y + 0.012;
          const cc = pick([srgb(0x4d6a5c), srgb(0x5a6a7a), srgb(0x8a5a48), srgb(0x55705e)], r), lc = srgb(0xd8d6cc);
          rb.skin(x0, z0, x1, z1, yy, CELL.EPDM, cc.map(v => v * 1.1), 0, 0, false, 0.25);
          const ln = (a0, b0, a1, b1) => rb.skin(a0, b0, a1, b1, yy + 0.003, CELL.METAL, lc, 0, 0, false, 0.01);
          const q = 0.6, lw = 0.07;
          ln(x0 + q, z0 + q, x1 - q, z0 + q + lw); ln(x0 + q, z1 - q - lw, x1 - q, z1 - q); ln(x0 + q, z0 + q, x0 + q + lw, z1 - q); ln(x1 - q - lw, z0 + q, x1 - q, z1 - q);
          if (ax) ln((x0 + x1) / 2 - lw / 2, z0 + q, (x0 + x1) / 2 + lw / 2, z1 - q); else ln(x0 + q, (z0 + z1) / 2 - lw / 2, x1 - q, (z0 + z1) / 2 + lw / 2);
          // fence: posts every 2.5 m + top rail (exact boxes); the mesh itself is left out (reads as a thin grey line from above)
          const fh = 3.0, fc = srgb(0x5a5d5e);
          for (const [a0, b0, a1, b1] of [[x0, z0, x1, z0 + 0.05], [x0, z1 - 0.05, x1, z1], [x0, z0, x0 + 0.05, z1], [x1 - 0.05, z0, x1, z1]]) {
            rb.box(a0, y + fh - 0.06, b0, a1, y + fh, b1, CELL.METAL, fc); S.box(a0, y + fh - 0.06, b0, a1, y + fh, b1, 'pole');
            rb.box(a0, y, b0, a1, y + 0.25, b1, CELL.METAL, fc.map(v => v * 0.8)); S.box(a0, y, b0, a1, y + 0.25, b1, 'wall');
            const L = Math.max(a1 - a0, b1 - b0), alx = a1 - a0 > b1 - b0;
            for (let u = 0; u <= L; u += 2.5) { const px = alx ? Math.min(a0 + u, a1 - 0.05) : a0, pz = alx ? b0 : Math.min(b0 + u, b1 - 0.05);
              rb.box(px, y, pz, px + 0.05, y + fh, pz + 0.05, CELL.METAL, fc, false); S.box(px, y, pz, px + 0.05, y + fh, pz + 0.05, 'pole'); }
          }
          occ.add(x0, y, z0, x1, y + fh, z1);
          st.court2 = (st.court2 ?? 0) + 1;
        }
      }
      // ---- 12. light courts / air shafts (the light well of a deep apartment, loft or office block). r6: most are OPEN
      //      shafts (a brick shaft wall rising 1-1.5 m above the roof around a near-black well floor + deep contact AO,
      //      so from swinging altitude it reads as a void cut into the block, critic: "blocks packed solid"); the rest are
      //      glazed (dark wired glass on a brick curb). Big roofs get two; half of them sit against the rear parapet (a
      //      notch in the back of the building). Exact walkable collision.
      const nCourt = isTop && !glassTop && !tall && area > 150 && rw > 9 && rd > 9 && (resid || type === 'loft' || type === 'postwar' || type === 'deco') && r() < (resid || type === 'loft' ? 0.72 : 0.45)
        ? (area > 520 && r() < 0.5 ? 2 : 1) : 0;
      for (let ci = 0; ci < nCourt; ci++) {
        const open = r() < 0.7;
        const cw = open ? 3.2 + r() * 3.0 : 2.8 + r() * 2.4, cd = open ? 4 + r() * 5.5 : 3.5 + r() * 4.5, sw = r() < 0.5;
        const w2 = sw ? cd : cw, d2 = sw ? cw : cd;
        let at = null;
        if (r() < 0.5) { // notch against the rear parapet
          const zone = backZ > 0 ? { x0: P0.x0, z0: P0.z1 - d2, x1: P0.x1, z1: P0.z1 } : { x0: P0.x0, z0: P0.z0, x1: P0.x1, z1: P0.z0 + d2 };
          at = place(w2, d2, 1.6, 8, zone);
        }
        at ??= place(w2, d2, 1.6, 10);
        if (!at) continue;
        const [x0, z0] = at, x1 = x0 + w2, z1 = z0 + d2;
        if (open) {
          const wt = 0.3, ch = 1.0 + r() * 0.5;
          const pw = { ...m.p, style: STYLE.BLANK, layer: (m.p.layer === LAYER.RED || m.p.layer === LAYER.BROWN) ? m.p.layer : (r() < 0.6 ? LAYER.RED : LAYER.BROWN), tint: (m.p.tint ?? [1, 1, 1]).map(v => v * 0.8), topY: y + ch, baseY: y };
          gt.fac.box(x0, y, z0, x1, y + ch, z1, pw, {}, false);           // outer faces of the shaft wall
          gt.fac.innerRing(x0 + wt, z0 + wt, x1 - wt, z1 - wt, y, y + ch, { ...pw, tint: pw.tint.map(v => v * 0.55) }); // shaded inner faces
          const cc = jit(pick(C_COPE, r), r, 0.06);
          for (const [a0, b0, a1, b1] of [[x0, z0, x1, z0 + wt], [x0, z1 - wt, x1, z1], [x0, z0 + wt, x0 + wt, z1 - wt], [x1 - wt, z0 + wt, x1, z1 - wt]]) {
            rb.box(a0 - 0.03, y + ch, b0 - 0.03, a1 + 0.03, y + ch + 0.07, b1 + 0.03, CELL.METAL, cc.map(v => v * 0.85), cc);
            S.box(a0, y, b0, a1, y + ch, b1, 'parapet'); S.box(a0 - 0.03, y + ch, b0 - 0.03, a1 + 0.03, y + ch + 0.07, b1 + 0.03, 'coping');
          }
          // the well: near-black soot / tar floor (1 cm over the roof skin), deep AO toward the shaft walls
          rb.skin(x0 + wt, z0 + wt, x1 - wt, z1 - wt, y + 0.01, CELL.TAR, [0.07, 0.068, 0.065], 0, 0, false, 1.5);
          tl.ao.band(y + 0.01, x0 + wt, z0 + wt, x1 - wt, z1 - wt, Math.min(1.6, (Math.min(w2, d2) - 2 * wt) * 0.45), 0.25);
          tl.ao.ring(y, x0, z0, x1, z1, 0.9, 0.5, R);
          lodBox(x0, z0, x1, z1, y + ch);
          occ.add(x0, y, z0, x1, y + ch + 0.1, z1);
          st.shaft = (st.shaft ?? 0) + 1;
        } else {
          const ch = 0.55 + r() * 0.3;
          rb.box(x0, y, z0, x1, y + ch, z1, CELL.PAVERS, jit(C_BRICK, r, 0.08), false);
          rb.box(x0 - 0.04, y + ch, z0 - 0.04, x1 + 0.04, y + ch + 0.06, z1 + 0.04, CELL.METAL, srgb(0x6a6c6a), false);
          rb.box(x0 + 0.06, y + ch - 0.1, z0 + 0.06, x1 - 0.06, y + ch + 0.02, z1 - 0.06, CELL.GLASS, [0.4, 0.43, 0.45]);
          for (let q = x0 + 1.1; q < x1 - 0.5; q += 1.1) rb.box(q - 0.03, y + ch + 0.02, z0 + 0.06, q + 0.03, y + ch + 0.05, z1 - 0.06, CELL.METAL, C_FRAME, false);
          solid(x0 - 0.04, y, z0 - 0.04, x1 + 0.04, y + ch + 0.06, z1 + 0.04, 'skylight');
          st.court = (st.court ?? 0) + 1;
        }
      }
      // ---- 4. (r4: placed before the mechanical rows so they keep their spot) water tank (a second tower style: timber tank on a steel stand, or a painted steel tank)
      for (let wi = 0, wn = aT === 'tank' ? (hasWT ? (area > 250 ? 1 : 0) : (area > 220 && ra() < 0.55 ? 2 : 1)) : !hasWT && isTop && !greenRoof && bld.H > 16 && bld.H < 130 && (resid || type === 'loft' || type === 'postwar' || type === 'deco') && r() < (resid || type === 'loft' ? (bld.H < 60 ? 0.64 : 0.46) : 0.3) /* r7: critic wants the signature NYC tanks back */ /* skyline r6: fewer cloned tanks (critic); rooftops r6: ~1 in 3 pre-war low-rises overall */ ? (area > 450 && r() < 0.35 ? 2 : 1) : 0; wi < wn; wi++) {
        const rad = 1.5 + r() * 1.3;
        const at = near(rad * 2 + 0.6, rad * 2 + 0.6, 9, 5, 12) ?? place(rad * 2 + 0.6, rad * 2 + 0.6, 9, 8);
        if (at) {
          const tx = at[0] + rad + 0.3, tz = at[1] + rad + 0.3;
          waterTank(rb, S, Z, occ, tx, y, tz, rad, r);
          // r6: far LOD reads as a water tower (octagonal timber tank + cone on a stand), not a box
          const tp = { ...m.p, style: STYLE.BLANK, layer: LAYER.BROWN, tint: [0.85, 0.72, 0.6], baseY: y };
          gt.lod.box(tx - rad * 0.7, top, tz - rad * 0.7, tx + rad * 0.7, y + rad * 1.3, tz + rad * 0.7, { ...lodP, topY: y + rad * 1.3 }, {}, false);
          gt.lod.cyl(tx, tz, rad, y + rad * 1.3, y + rad * 3.2, 8, { ...tp, topY: y + rad * 3.2 }, STYLE.BLANK, false);
          gt.lod.cyl(tx, tz, rad * 1.04, y + rad * 3.2, y + rad * 3.8, 8, { ...tp, layer: LAYER.ROOF, tint: [0.55, 0.52, 0.5], topY: y + rad * 3.8 }, STYLE.BLANK, false, 0.05);
          st.wt++;
        }
      }
      // ---- 4b. r8: rooftop billboard ('sign' archetype, ref 02: sign frames on the low roofs): steel columns + rear posts
      //      and kickers, a catwalk, the sign panel (steel back, faded painted face in 2-3 bands) facing the street
      if (aT === 'sign') {
        const faces = ['nz', 'pz', 'nx', 'px'].filter(k => sd[k] === 'street' && Math.abs((k === 'nx' ? m.x0 - lot.x0 : k === 'px' ? lot.x1 - m.x1 : k === 'nz' ? m.z0 - lot.z0 : lot.z1 - m.z1)) < 0.1);
        if (faces.length) {
          const k = pick(faces, ra), alx = k === 'nz' || k === 'pz', sgn = k === 'nz' || k === 'nx' ? -1 : 1;
          const A0 = alx ? P0.x0 : P0.z0, A1 = alx ? P0.x1 : P0.z1, L = A1 - A0;
          const bw = Math.min(L - 1, 8 + ra() * 7), bhh = 3.2 + ra() * 2.6, leg = 2.0 + ra() * 2.0, depth = 2.4;
          const c0 = (A0 + A1) / 2 + (ra() - 0.5) * Math.max(0, L - bw) * 0.7, a0 = c0 - bw / 2, a1 = c0 + bw / 2;
          const front = k === 'nz' ? P0.z0 : k === 'pz' ? P0.z1 : k === 'nx' ? P0.x0 : P0.x1; // panel front face (street side)
          const D = (d) => front - sgn * d;                                                        // d metres back from the front
          const bx = (b0, b1, d0, d1, y0, y1, cell, col, topCol = null, kind = 'equipment') => {
            const da = D(d0), db = D(d1), [x0, x1, z0, z1] = alx ? [b0, b1, Math.min(da, db), Math.max(da, db)] : [Math.min(da, db), Math.max(da, db), b0, b1];
            rb.box(x0, y0, z0, x1, y1, z1, cell, col, topCol); if (kind) S.box(x0, y0, z0, x1, y1, z1, kind);
            return [x0, z0, x1, z1];
          };
          const fp = alx ? [a0, Math.min(D(0), D(depth)), a1, Math.max(D(0), D(depth))] : [Math.min(D(0), D(depth)), a0, Math.max(D(0), D(depth)), a1];
          if (bw > 5 && !occ.hit(fp[0], fp[1], fp[2], fp[3], y, leg + bhh + 0.3)) {
            const stc = jit(pick(C_STEEL, ra), ra, 0.06), yb = y + leg, yt = yb + bhh;
            bx(a0, a1, 0.02, 0.4, yb, yt, CELL.METAL, stc, stc.map(v => v * 0.8));                      // panel (steel back)
            const AD = [0x8a3a30, 0x2f4a6a, 0xc0a468, 0x3a5a40, 0xd4ccbc, 0x2a2a2c, 0x9a5a2a, 0x5a3a5a].map(srgb);
            const nb = 2 + Math.floor(ra() * 2), cuts = [yb + 0.15];
            for (let i = 1; i < nb; i++) cuts.push(yb + 0.15 + (bhh - 0.3) * (i / nb + (ra() - 0.5) * 0.2));
            cuts.push(yt - 0.15);
            // (billboards r2) the face is a real ad from the ts_ads atlas, drawn by signage.js (gen.roofSignPanels); the
            // plain colour bands stay only as the ?nosignage fallback
            const adFace = typeof location !== 'undefined' && !location.search.includes('nosignage');
            if (adFace) (gen.roofSignPanels ??= []).push({ k, alx, a0: a0 + 0.12, a1: a1 - 0.12, y0: yb + 0.12, y1: yt - 0.12, plane: D(-0.004) });
            for (let i = 0; i < nb; i++) { const fc = jit(pick(AD, ra), ra, 0.08).map(v => v * 0.8); if (!adFace) bx(a0 + 0.15, a1 - 0.15, 0.008, 0.03, cuts[i], cuts[i + 1], CELL.MEMBRANE, fc, null, null); }
            bx(a0 - 0.08, a1 + 0.08, -0.03, 0.43, yt, yt + 0.12, CELL.METAL, stc.map(v => v * 0.7), null, 'coping');      // cap
            const nc = Math.max(2, Math.ceil(bw / 3.2) + 1);
            for (let i = 0; i < nc; i++) {
              const ca = a0 + 0.2 + (bw - 0.4 - 0.22) * (i / (nc - 1));
              bx(ca, ca + 0.22, 0.4, 0.62, y, yt, CELL.METAL, stc, null, 'pole');                             // column behind the panel
              bx(ca + 0.03, ca + 0.19, depth - 0.18, depth, y, yb + bhh * 0.55, CELL.METAL, stc, null, 'pole'); // rear post
              bx(ca + 0.05, ca + 0.17, 0.62, depth - 0.18, yb + bhh * 0.55 - 0.16, yb + bhh * 0.55, CELL.METAL, stc, null, 'pole'); // kicker
            }
            bx(a0, a1, 0.62, 1.5, yb - 0.08, yb, CELL.LOUVRE, srgb(0x4a4c4c), srgb(0x5a5c5c), 'awning');            // catwalk grating
            for (let q = a0 + 0.6; q < a1 - 0.3; q += 2.4) bx(q, q + 0.12, 0.5, 0.62, yt + 0.12, yt + 0.5, CELL.METAL, srgb(0x3a3c3c), null, 'equipment'); // lamp arms
            occ.add(fp[0], y, fp[1], fp[2], yt + 0.5, fp[3]);
            ao(fp[0], fp[1], fp[2], fp[3], y, 1.2);
            lodBox(...(alx ? [a0, Math.min(D(0), D(0.4)), a1, Math.max(D(0), D(0.4))] : [Math.min(D(0), D(0.4)), a0, Math.max(D(0), D(0.4)), a1]), yt, yb);
            st.sign = (st.sign ?? 0) + 1;
          }
        }
      }
      // ---- 2c. r6: big flat slabs broken up (critic: "big slab roofs too clean and large-scale flat: mechanical
      //      penthouses, louvred enclosures and ductwork runs"): louvred equipment enclosures, cooling-tower cells straight
      //      on the roof and long insulated duct runs on stands, placed before the unit rows so those fill around them
      if (!glassTop && !greenRoof && area > 320 && (tall || bld.hero || type === 'postwar' || type === 'deco' || type === 'loft' || (lower && area > 500))) {
        const nE = Math.min(4, 1 + Math.floor(area / 520 + r() * 1.5));
        for (let i = 0; i < nE; i++) {
          const ew = 3.5 + r() * 4, ed = 3 + r() * 3, eh = 2.2 + r() * 1.5, ax = r() < 0.5;
          const w2 = ax ? ew : ed, d2 = ax ? ed : ew;
          const at = (i === 0 ? near(w2, d2, eh + 0.8, 7, 10) : null) ?? place(w2, d2, eh + 0.8, 10);
          if (!at) continue;
          const [x0, z0] = at, x1 = x0 + w2, z1 = z0 + d2, lc = jit(pick(C_LOUV, r), r, 0.06), kind = r();
          if (kind < 0.55) { // louvred enclosure: base curb, louvre walls, coping band, dark top with an exhaust or two
            rb.box(x0, y, z0, x1, y + 0.3, z1, CELL.PAVERS, jit(srgb(0x8c877d), r, 0.06), false);
            rb.box(x0, y + 0.3, z0, x1, y + eh, z1, CELL.LOUVRE, lc, false);
            rb.box(x0 - 0.04, y + eh - 0.25, z0 - 0.04, x1 + 0.04, y + eh + 0.012, z1 + 0.04, CELL.METAL, lc.map(v => v * 0.8), false);
            rb.skin(x0 - 0.04, z0 - 0.04, x1 + 0.04, z1 + 0.04, y + eh + 0.021, r() < 0.5 ? CELL.EPDM : CELL.BITUMEN, jit([0.8, 0.8, 0.8], r, 0.08), ou, ov, rot, 0.4);
            for (let f = 0, nf = 1 + Math.floor(r() * 2); f < nf; f++) {
              const fx = x0 + w2 * (0.3 + 0.4 * r()), fz = z0 + d2 * (0.3 + 0.4 * r()), fr = 0.35 + r() * 0.3;
              rb.lathe([fx, y + eh, fz], [0, 1, 0], [[fr * 0.6, 0], [fr * 0.6, 0.3], [fr, 0.4], [fr * 0.9, 0.55], [fr * 0.2, 0.7]], 10, lc.map(v => v * 0.75), CELL.METAL);
              S.cyl(fx, fz, y + eh, y + eh + 0.7, fr * 0.6, fr * 0.2, 'equipment');
            }
          } else { // cooling-tower cells on a steel dunnage frame
            const nc = Math.max(1, Math.round((ax ? w2 : d2) / 3)), cwd = (ax ? w2 : d2) / nc, cc = jit(srgb(0x8d9290), r, 0.06);
            rb.box(x0, y, z0, x1, y + 0.5, z1, CELL.METAL, C_FRAME, false);
            rb.box(x0, y + 0.5, z0, x1, y + 0.5 + (eh - 0.5) * 0.55, z1, CELL.LOUVRE, cc, false);
            rb.box(x0, y + 0.5 + (eh - 0.5) * 0.55, z0, x1, y + eh, z1, CELL.METAL, cc, cc.map(v => v * 0.78));
            for (let c = 0; c < nc; c++) {
              const fx = ax ? x0 + (c + 0.5) * cwd : (x0 + x1) / 2, fz = ax ? (z0 + z1) / 2 : z0 + (c + 0.5) * cwd, fr = Math.min(cwd, ax ? d2 : w2) * 0.38;
              rb.lathe([fx, y + eh, fz], [0, 1, 0], [[fr, 0], [fr * 1.06, 0.45], [fr * 1.1, 0.7]], 10, cc.map(v => v * 0.9), CELL.METAL, { back: true });
              rb.disc(fx, y + eh + 0.28, fz, fr * 1.02, C_DARK, 12);
              S.cyl(fx, fz, y + eh, y + eh + 0.7, fr * 0.985, fr * 1.09, 'equipment');
            }
            st.ct++;
          }
          solid(x0, y, z0, x1, y + eh, z1); lodBox(x0, z0, x1, z1, y + eh); corners(x0, z0, x1, z1, y + eh);
          st.encl = (st.encl ?? 0) + 1;
        }
        // insulated supply / return duct runs on stands (with a drop into the roof at the far end)
        for (let i = 0, n = 1 + Math.floor(r() * Math.min(3, area / 400)); i < n; i++) {
          const L = 7 + r() * Math.min(16, Math.max(rw, rd) * 0.5), dw = 0.8 + r() * 0.5, dh = 0.7 + r() * 0.4, ax = r() < 0.5, dy0 = y + 0.35 + r() * 0.3;
          const w2 = ax ? L : dw, d2 = ax ? dw : L;
          const at = place(w2, d2, dh + 1, 8);
          if (!at) continue;
          const [x0, z0] = at, x1 = x0 + w2, z1 = z0 + d2, dc = jit(r() < 0.6 ? C_DUCT : srgb(0x8a8c86), r, 0.05);
          rb.box(x0, dy0, z0, x1, dy0 + dh, z1, CELL.METAL, dc, dc.map(v => v * 0.9));
          for (let q = 0.4; q < L - 0.2; q += 2.2) { // stands
            const [sx, sz] = ax ? [x0 + q, (z0 + z1) / 2] : [(x0 + x1) / 2, z0 + q];
            rb.box(sx - 0.05, y, sz - 0.05, sx + 0.05, dy0, sz + 0.05, CELL.METAL, C_FRAME, false);
            S.box(sx - 0.05, y, sz - 0.05, sx + 0.05, dy0, sz + 0.05, 'pole');
          }
          // seams / flanges every 1.5 m
          for (let q = 1.5; q < L - 0.3; q += 1.5) {
            if (ax) rb.box(x0 + q - 0.03, dy0 - 0.02, z0 - 0.02, x0 + q + 0.03, dy0 + dh + 0.02, z1 + 0.02, CELL.METAL, dc.map(v => v * 0.8), false);
            else rb.box(x0 - 0.02, dy0 - 0.02, z0 + q - 0.03, x1 + 0.02, dy0 + dh + 0.02, z0 + q + 0.03, CELL.METAL, dc.map(v => v * 0.8), false);
          }
          const [ex0, ez0, ex1, ez1] = ax ? [x1 - dw, z0, x1, z1] : [x0, z1 - dw, x1, z1];
          rb.box(ex0, y, ez0, ex1, dy0, ez1, CELL.METAL, dc.map(v => v * 0.9), false); // drop
          S.box(x0, dy0, z0, x1, dy0 + dh, z1, 'equipment'); S.box(ex0, y, ez0, ex1, dy0, ez1, 'equipment');
          occ.add(x0, y, z0, x1, dy0 + dh, z1); ao(x0, z0, x1, z1, y, 0.8);
          st.duct = (st.duct ?? 0) + 1;
        }
      }
      // ---- 2a. air-handling units with duct runs (offices / lofts / podiums / towers), clustered at the plant
      if ((area > 200 && (type === 'postwar' || type === 'loft' || type === 'deco' || lower || tall) && r() < 0.75)) {
        for (let i = 0, n = 1 + Math.floor(r() * Math.min(3, area / 300)); i < n; i++) {
          const L = 4 + r() * 5, Wd = 1.8 + r() * 0.9, Hh = 1.6 + r() * 0.9, ax = r() < 0.5;
          const at = near(ax ? L : Wd, ax ? Wd : L, Hh + 0.4, 6); if (!at) continue;
          const [x0, z0] = at, x1 = x0 + (ax ? L : Wd), z1 = z0 + (ax ? Wd : L);
          const hc = jit(pick(C_HVAC, r), r, 0.05);
          rb.box(x0, y, z0, x1, y + Hh, z1, CELL.METAL, hc);
          // louvred intake end + fans on top
          if (ax) rb.box(x0 - 0.02, y + 0.2, z0 + 0.1, x0, y + Hh - 0.2, z1 - 0.1, CELL.LOUVRE, hc.map(v => v * 0.9), false);
          else rb.box(x0 + 0.1, y + 0.2, z0 - 0.02, x1 - 0.1, y + Hh - 0.2, z0, CELL.LOUVRE, hc.map(v => v * 0.9), false);
          for (let f = 0, nf = Math.max(1, Math.floor(L / 2.4)); f < nf; f++) {
            const u = (f + 0.5) / nf;
            const fx = ax ? x0 + (x1 - x0) * u : (x0 + x1) / 2, fz = ax ? (z0 + z1) / 2 : z0 + (z1 - z0) * u;
            rb.cyl(fx, fz, Wd * 0.32, y + Hh, y + Hh + 0.25, hc.map(v => v * 0.85), 10, CELL.METAL, C_DARK);
          }
          solid(x0, y, z0, x1, y + Hh, z1); lodBox(x0, z0, x1, z1, y + Hh);
          // raised duct: from the AHU end over stands, turning down into the roof / toward the plant room
          if (r() < 0.8) {
            const dw = 0.7 + r() * 0.4, dl = 3 + r() * 8, dy0 = y + 0.5;
            const [bx0, bz0, bx1, bz1] = ax ? (backX > 0 ? [x1, (z0 + z1) / 2 - dw / 2, x1 + dl, (z0 + z1) / 2 + dw / 2] : [x0 - dl, (z0 + z1) / 2 - dw / 2, x0, (z0 + z1) / 2 + dw / 2])
              : (backZ > 0 ? [(x0 + x1) / 2 - dw / 2, z1, (x0 + x1) / 2 + dw / 2, z1 + dl] : [(x0 + x1) / 2 - dw / 2, z0 - dl, (x0 + x1) / 2 + dw / 2, z0]);
            if (tryAt(bx0 - (ax ? 0 : 0), bz0, bx1 - bx0, bz1 - bz0, dw + 0.8)) {
              rb.box(bx0, dy0, bz0, bx1, dy0 + dw, bz1, CELL.METAL, C_DUCT);
              // stands
              for (let s = 0.5; s < dl; s += 2.5) {
                const [sx, sz] = ax ? [bx0 + s, (bz0 + bz1) / 2] : [(bx0 + bx1) / 2, bz0 + s];
                rb.box(sx - 0.05, y, sz - 0.05, sx + 0.05, dy0, sz + 0.05, CELL.METAL, C_FRAME, false);
              }
              solid(bx0, dy0, bz0, bx1, dy0 + dw, bz1);
            }
          }
          st.ahu = (st.ahu ?? 0) + 1;
        }
      }
      // ---- 2b. packaged mechanical kit (round 3: 8 unit families, per-unit size / offset jitter, darker weathered tops,
      //      rows grouped around the plant anchor or lined up along a parapet, conduits / cable trays tying them in)
      const svc = []; // r4: serviced rows (walkway pads run to them)
      const nRows = greenRoof ? 0 : (aT === 'garden' || aT === 'pool' ? 0.5 : 1) * Math.min(tall ? 22 : area > 600 ? 12 : 6, Math.floor(area / (lower ? (tall ? 110 : resid ? 130 : 200) : resid ? 150 : 85) + r() * 1.6)); // r4: denser on big roofs; r7: residential / podium roofs denser (park agent: 'big pale near-empty slabs')

      for (let k = 0; k < nRows; k++) {
        const fam = r();
        // r4: 12 families (chillers, pipe racks, generators, hooded exhausts added; the plain condenser is now 1 in 8)
        let kind = fam < 0.12 ? 0 : fam < 0.2 ? 1 : fam < 0.28 ? 2 : fam < 0.39 ? 3 : fam < 0.47 ? 4 : fam < 0.54 ? 5 : fam < 0.62 ? 6 : fam < 0.69 ? 7 : fam < 0.8 ? 8 : fam < 0.89 ? 9 : fam < 0.94 ? 10 : 11;
        if (resid && (kind === 8 || kind === 10)) kind = r() < 0.5 ? 4 : 11;
        // footprint of one unit (along the row = uw, across = ud) and its height
        const DIM = [[1.3 + r() * 1.5, 1.0 + r() * 1.0, 0.9 + r() * 0.9], [0.9 + r() * 0.6, 1.0 + r() * 0.8, 1.3 + r() * 0.6], [1.0 + r() * 0.5, 1.0 + r() * 0.5, 1.0],
          [3.2 + r() * 2.8, 1.7 + r() * 0.6, 1.2 + r() * 0.5], [0.9 + r() * 0.3, 0.45 + r() * 0.15, 0.75 + r() * 0.2], [1.0 + r() * 0.6, 1.0 + r() * 0.5, 1.2 + r() * 0.8],
          [1.6 + r() * 1.0, 1.4 + r() * 0.8, 1.2 + r() * 0.8], [0.7 + r() * 0.3, 0.45 + r() * 0.1, 1.5 + r() * 0.4],
          [5 + r() * 4, 2.1 + r() * 0.5, 1.9 + r() * 0.5], [6 + r() * 8, 1.1 + r() * 0.6, 0.8 + r() * 0.6], [3 + r() * 1.8, 1.5 + r() * 0.5, 2.0 + r() * 0.4],
          [0.9 + r() * 0.4, 0.9 + r() * 0.4, 0.45 + r() * 0.2]][kind];
        const [uw0, ud0, uh0] = DIM;
        const maxN = [4, 4, 3, 2, 6, 3, 1, 5, 2, 1, 1, 4][kind];
        const n = 1 + Math.floor(r() * (resid ? Math.min(2, maxN) : maxN)), gap = kind === 7 ? 0.05 : kind === 4 ? 0.35 + r() * 0.3 : 0.5 + r() * 0.7;
        const alongX = r() < 0.5;
        const Wt = n * uw0 * 1.1 + (n - 1) * gap, Dt = ud0 * 1.25;
        // along a parapet (split units, cabinets, condensers) or clustered at the plant
        let at = null;
        if ((kind === 4 || kind === 7 || (kind === 0 && r() < 0.3)) && r() < 0.7) {
          const side = Math.floor(r() * 4), ww = alongX ? Wt : Dt, dd = alongX ? Dt : Wt;
          for (let tt = 0; tt < 5 && !at; tt++) {
            const x0 = side === 0 ? P0.x0 : side === 1 ? P0.x1 - ww : P0.x0 + r() * Math.max(0, rw - ww);
            const z0 = side === 2 ? P0.z0 : side === 3 ? P0.z1 - dd : P0.z0 + r() * Math.max(0, rd - dd);
            if (tryAt(x0, z0, ww, dd, uh0 + 0.5)) at = [x0, z0];
          }
        }
        at ??= near(alongX ? Wt : Dt, alongX ? Dt : Wt, uh0 + 0.5, resid ? 4 : (k > 5 ? 11 : 7), 10) ?? (!resid ? place(alongX ? Wt : Dt, alongX ? Dt : Wt, uh0 + 0.5, 8) : null); // r4: spill over the whole roof once the plant cluster is full
        if (!at) continue;
        const base = jit(pick(C_HVAC, r), r, 0.06);
        let u = 0;
        for (let i = 0; i < n; i++) {
          const s = 0.9 + r() * 0.2, uw = uw0 * s, ud = ud0 * (0.92 + r() * 0.16), uh = uh0 * (0.9 + r() * 0.2);
          const off = (Dt - ud) * r();                  // ragged front line, never a perfect grid
          const colJ = r() < 0.15 ? jit(pick(C_HVAC, r), r, 0.06) : jit(base, r, 0.04); // odd replacement unit
          const topC = colJ.map(v => v * 0.72);          // weathered, dusty top (sun-lit tops read white otherwise)
          const x0 = at[0] + (alongX ? u : off), z0 = at[1] + (alongX ? off : u);
          const x1 = x0 + (alongX ? uw : ud), z1 = z0 + (alongX ? ud : uw);
          u += uw + gap;
          if (x1 > P0.x1 || z1 > P0.z1) break;
          const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, mn = Math.min(x1 - x0, z1 - z0);
          if (kind === 0) { // condensing unit: box + top fan shroud
            rb.box(x0, y, z0, x1, y + uh, z1, CELL.METAL, colJ, topC);
            const nf = uw > 2.2 ? 2 : 1;
            for (let f = 0; f < nf; f++) {
              const q = (f + 0.5) / nf, fx = alongX ? x0 + (x1 - x0) * q : cx, fz = alongX ? cz : z0 + (z1 - z0) * q;
              const fr = Math.min(mn * 0.36, (alongX ? x1 - x0 : z1 - z0) / nf * 0.38);
              rb.cyl(fx, fz, fr, y + uh, y + uh + 0.1, topC, 10, CELL.METAL, C_DARK);
            }
            solid(x0, y, z0, x1, y + uh, z1);
          } else if (kind === 1) { // vertical unit: louvred sides, low hood
            rb.box(x0, y, z0, x1, y + uh, z1, CELL.LOUVRE, colJ, topC, CELL.METAL);
            rb.box(x0 - 0.05, y + uh, z0 - 0.05, x1 + 0.05, y + uh + 0.1, z1 + 0.05, CELL.METAL, topC);
            solid(x0, y, z0, x1, y + uh, z1); S.box(x0 - 0.05, y + uh, z0 - 0.05, x1 + 0.05, y + uh + 0.1, z1 + 0.05, 'equipment');
          } else if (kind === 2) { // exhaust fan: curb + mushroom cap
            const rr = mn * 0.45;
            rb.box(x0 + 0.05, y, z0 + 0.05, x1 - 0.05, y + 0.35, z1 - 0.05, CELL.METAL, colJ.map(v => v * 0.85));
            rb.lathe([cx, y + 0.35, cz], [0, 1, 0], [[rr * 0.55, 0], [rr * 0.55, 0.35], [rr, 0.45], [rr * 0.9, 0.62], [rr * 0.2, 0.78]], 10, topC, CELL.METAL);
            solid(x0 + 0.05, y, z0 + 0.05, x1 - 0.05, y + 0.35, z1 - 0.05);
            S.cyl(cx, cz, y + 0.35, y + 0.8, rr * 0.55, rr * 0.2, 'equipment');
          } else if (kind === 3) { // packaged rooftop unit: tall return section + low condenser section with 2 fans, gas flue
            const split = alongX ? x0 + (x1 - x0) * 0.42 : z0 + (z1 - z0) * 0.42, lowH = uh * 0.72;
            const [ax0, az0, ax1, az1] = alongX ? [x0, z0, split, z1] : [x0, z0, x1, split];
            const [bx0, bz0, bx1, bz1] = alongX ? [split, z0, x1, z1] : [x0, split, x1, z1];
            rb.box(ax0, y, az0, ax1, y + uh, az1, CELL.METAL, colJ, topC);
            rb.box(bx0, y, bz0, bx1, y + lowH, bz1, CELL.LOUVRE, colJ.map(v => v * 0.95), topC, CELL.METAL);
            for (let f = 0; f < 2; f++) {
              const q = (f + 0.5) / 2, fx = alongX ? bx0 + (bx1 - bx0) * q : (bx0 + bx1) / 2, fz = alongX ? (bz0 + bz1) / 2 : bz0 + (bz1 - bz0) * q;
              const fr = Math.min(mn * 0.34, (alongX ? bx1 - bx0 : bz1 - bz0) * 0.2);
              rb.cyl(fx, fz, fr, y + lowH, y + lowH + 0.12, topC, 10, CELL.METAL, C_DARK);
            }
            const flx = alongX ? ax0 + 0.35 : ax1 - 0.35, flz = alongX ? az1 - 0.35 : az0 + 0.35;
            rb.cyl(flx, flz, 0.045, y + uh, y + uh + 0.55, srgb(0x4a4c4d), 6);
            S.cyl(flx, flz, y + uh, y + uh + 0.55, 0.044, 0.044, 'equipment');
            solid(ax0, y, az0, ax1, y + uh, az1); solid(bx0, y, bz0, bx1, y + lowH, bz1);
          } else if (kind === 4) { // split-system condenser: small cabinet, fan on the long face (grille disc)
            rb.box(x0, y + 0.15, z0, x1, y + uh, z1, CELL.METAL, jit(srgb(0xb3b0a6), r, 0.05), jit(srgb(0x8e8c85), r, 0.05));
            rb.box(x0 + 0.05, y, z0 + 0.05, x1 - 0.05, y + 0.15, z1 - 0.05, CELL.METAL, C_FRAME, false);
            const fr = Math.min(uh * 0.36, uw * 0.3), fy = y + 0.15 + (uh - 0.15) / 2;
            if (alongX) rb.lathe([x0 + (x1 - x0) * 0.4, fy, z1], [0, 0, 1], [[fr, 0], [0.001, 0.005]], 10, C_DARK, CELL.METAL);
            else rb.lathe([x1, fy, z0 + (z1 - z0) * 0.4], [1, 0, 0], [[fr, 0], [0.001, 0.005]], 10, C_DARK, CELL.METAL);
            solid(x0, y + 0.15, z0, x1, y + uh, z1); S.box(x0 + 0.05, y, z0 + 0.05, x1 - 0.05, y + 0.15, z1 - 0.05, 'equipment');
          } else if (kind === 5) { // vertical tanks (expansion / fuel / hot water) on a plinth, cone-capped: exact cylinders
            const tr = Math.min(ud, uw) / 2 * 0.9, tc = jit(pick(C_TANKSTEEL, r), r, 0.05).map(v => v * 0.8), th = uh + r() * 0.6;
            rb.box(x0, y, z0, x1, y + 0.2, z1, CELL.PAVERS, srgb(0x8a857b));
            solid(x0, y, z0, x1, y + 0.2, z1);
            rb.lathe([cx, y + 0.2, cz], [0, 1, 0], [[tr, 0], [tr, th], [tr * 0.3, th + tr * 0.3]], 12, tc, CELL.METAL, { cap: tc.map(v => v * 0.8) });
            S.cyl(cx, cz, y + 0.2, y + 0.2 + th, tr, tr, 'equipment');
            S.cyl(cx, cz, y + 0.2 + th, y + 0.2 + th + tr * 0.3, tr, tr * 0.3, 'equipment');
            occ.add(x0, y, z0, x1, y + 0.2 + th + tr * 0.3, z1); ao(x0, z0, x1, z1, y, th);
          } else if (kind === 6) { // dog-house (pipe / duct penthouse): small box with a sloped cap
            const hc = r() < 0.5 ? jit(srgb(0x8c867a), r, 0.06) : jit(C_BRICK, r, 0.08);
            rb.box(x0, y, z0, x1, y + uh, z1, CELL.PAVERS, hc, false);
            const rise = 0.35, c = [cx, y + uh + rise / 2, cz];
            const lx = (alongX ? x1 - x0 : z1 - z0) / 2, lz = (alongX ? z1 - z0 : x1 - x0) / 2, tl2 = Math.atan2(rise, 2 * lz);
            const along = alongX ? [1, 0, 0] : [0, 0, 1], perp = alongX ? [0, 0, 1] : [1, 0, 0];
            rb.obox(c, [lx + 0.05, 0.03, Math.hypot(lz, rise / 2) + 0.05], along, [perp[0] * -Math.sin(tl2), Math.cos(tl2), perp[2] * -Math.sin(tl2)],
              [perp[0] * Math.cos(tl2), Math.sin(tl2), perp[2] * Math.cos(tl2)], CELL.METAL, srgb(0x55595b), null, y);
            solid(x0, y, z0, x1, y + uh, z1);
            S.ramp(alongX ? x0 - 0.05 : x0 - 0.05, y + uh - 0.05, alongX ? z0 - 0.05 : z0 - 0.05, alongX ? x1 + 0.05 : x1 + 0.05, alongX ? z1 + 0.05 : z1 + 0.05, alongX ? 2 : 0,
              y + uh + 0.03, y + uh + rise + 0.03, 'equipment', 0, 0.06);
          } else if (kind === 8) { // air-cooled chiller: louvred coil section, fan deck with 1-2 rows of shrouded fans
            chiller(rb, S, x0, z0, x1, z1, y, uh, alongX, colJ, topC);
            solid(x0, y, z0, x1, y + uh, z1);
          } else if (kind === 9) { // pipe rack: H-frame stands carrying 2-4 pipes (steam / gas / condenser water, insulated)
            const L = alongX ? x1 - x0 : z1 - z0, Wd = alongX ? z1 - z0 : x1 - x0, np = 2 + Math.floor(r() * 3);
            const at2 = (a, b) => (alongX ? [x0 + a, z0 + b] : [x0 + b, z0 + a]);
            for (let a = 0.3; a < L - 0.1; a += 2.4) {
              for (const b of [0.1, Wd - 0.1]) { const [px, pz] = at2(Math.min(a, L - 0.1), b); rb.box(px - 0.05, y, pz - 0.05, px + 0.05, y + uh, pz + 0.05, CELL.METAL, C_FRAME, false); S.box(px - 0.05, y, pz - 0.05, px + 0.05, y + uh, pz + 0.05, 'pole'); }
              const [bx0, bz0] = at2(Math.min(a, L - 0.1) - 0.05, 0.05), [bx1, bz1] = at2(Math.min(a, L - 0.1) + 0.05, Wd - 0.05);
              rb.box(bx0, y + uh - 0.1, bz0, bx1, y + uh, bz1, CELL.METAL, C_FRAME); S.box(bx0, y + uh - 0.1, bz0, bx1, y + uh, bz1, 'pole');
            }
            let b = 0.2;
            for (let i = 0; i < np; i++) {
              const pr = 0.07 + r() * 0.13; if (b + 2 * pr > Wd - 0.15) break;
              const pcol = jit(pick(C_PIPE, r), r, 0.06), bc = b + pr, yc = y + uh + pr;
              const o = alongX ? [x0, yc, z0 + bc] : [x0 + bc, yc, z0];
              rb.lathe(o, alongX ? [1, 0, 0] : [0, 0, 1], [[pr, 0], [pr, L]], 8, pcol, CELL.METAL, { cap: pcol, base: y });
              const h2 = pr * 0.92;
              if (alongX) S.box(x0, yc - h2, z0 + bc - h2, x1, yc + h2, z0 + bc + h2, 'pole'); else S.box(x0 + bc - h2, yc - h2, z0, x0 + bc + h2, yc + h2, z1, 'pole');
              b += 2 * pr + 0.08 + r() * 0.15;
            }
            occ.add(x0, y, z0, x1, y + uh + 0.5, z1); ao(x0, z0, x1, z1, y, 0.4);
          } else if (kind === 10) { // standby generator enclosure: box, exhaust stack + muffler on top
            const gc = jit(pick(C_GEN, r), r, 0.05);
            rb.box(x0, y, z0, x1, y + uh, z1, CELL.LOUVRE, gc, gc.map(v => v * 0.74), CELL.METAL);
            const sx = alongX ? x1 - 0.5 : cx, sz = alongX ? cz : z1 - 0.5;
            rb.cyl(sx, sz, 0.13, y + uh, y + uh + 1.4, srgb(0x3f3d3a), 8);
            S.cyl(sx, sz, y + uh, y + uh + 1.4, 0.13, 0.13, 'equipment');
            const [mx0, mz0, mx1, mz1] = alongX ? [x0 + 0.4, cz - 0.28, x0 + 1.8, cz + 0.28] : [cx - 0.28, z0 + 0.4, cx + 0.28, z0 + 1.8];
            rb.box(mx0, y + uh, mz0, mx1, y + uh + 0.5, mz1, CELL.METAL, srgb(0x5a5754), srgb(0x4a4744));
            S.box(mx0, y + uh, mz0, mx1, y + uh + 0.5, mz1, 'equipment');
            solid(x0, y, z0, x1, y + uh, z1);
          } else if (kind === 11) { // hooded relief / exhaust: curb + flat weather hood on a short neck
            const hc = jit(srgb(0x9a9c98), r, 0.08);
            rb.box(x0 + 0.1, y, z0 + 0.1, x1 - 0.1, y + uh, z1 - 0.1, CELL.METAL, hc.map(v => v * 0.85));
            rb.box(cx - 0.18, y + uh, cz - 0.18, cx + 0.18, y + uh + 0.3, cz + 0.18, CELL.METAL, C_FRAME, false);
            rb.box(x0, y + uh + 0.3, z0, x1, y + uh + 0.38, z1, CELL.METAL, hc, hc.map(v => v * 0.78));
            solid(x0 + 0.1, y, z0 + 0.1, x1 - 0.1, y + uh, z1 - 0.1);
            S.box(cx - 0.18, y + uh, cz - 0.18, cx + 0.18, y + uh + 0.3, cz + 0.18, 'equipment');
            S.box(x0, y + uh + 0.3, z0, x1, y + uh + 0.38, z1, 'equipment'); occ.add(x0, y, z0, x1, y + uh + 0.4, z1);
          } else { // electrical / telecom cabinets in a tight row
            const cc = r() < 0.5 ? jit(srgb(0x8a8e88), r, 0.05) : jit(srgb(0xa29c8c), r, 0.05);
            rb.box(x0, y, z0, x1, y + uh, z1, CELL.METAL, cc, cc.map(v => v * 0.78));
            solid(x0, y, z0, x1, y + uh, z1);
          }
          st.hvac++;
        }

        const ex1 = Math.min(at[0] + (alongX ? u : Dt), P0.x1), ez1 = Math.min(at[1] + (alongX ? Dt : u), P0.z1);
        svc.push([(at[0] + ex1) / 2, (at[1] + ez1) / 2, at[0], at[1], ex1, ez1]);
        lodBox(at[0], at[1], ex1, ez1, y + uh0);
        // conduit / cable tray from the row back toward the plant anchor (rectangular, exact box collision)
        if (r() < 0.45) {
          const tw2 = 0.18 + r() * 0.2, th = 0.12, ty = y + 0.18;
          const sx = (at[0] + ex1) / 2, sz = (at[1] + ez1) / 2;
          const run = (a0, b0, a1, b1) => {
            const x0 = Math.min(a0, a1) - tw2 / 2, x1 = Math.max(a0, a1) + tw2 / 2, z0 = Math.min(b0, b1) - tw2 / 2, z1 = Math.max(b0, b1) + tw2 / 2;
            if (Math.max(x1 - x0, z1 - z0) < 1.5 || x0 < P0.x0 || z0 < P0.z0 || x1 > P0.x1 || z1 > P0.z1) return;
            if (occ.hit(x0 + 0.05, z0 + 0.05, x1 - 0.05, z1 - 0.05, y, 0.4)) return;
            rb.box(x0, ty, z0, x1, ty + th, z1, CELL.METAL, srgb(0x77797a));
            S.box(x0, ty, z0, x1, ty + th, z1, 'equipment');
            const L = Math.max(x1 - x0, z1 - z0);
            for (let q = 0.4; q < L; q += 2.2) { const px = x1 - x0 > z1 - z0 ? x0 + q : (x0 + x1) / 2, pz = x1 - x0 > z1 - z0 ? (z0 + z1) / 2 : z0 + q; rb.box(px - 0.04, y, pz - 0.04, px + 0.04, ty, pz + 0.04, CELL.METAL, C_FRAME, false); S.box(px - 0.04, y, pz - 0.04, px + 0.04, ty, pz + 0.04, 'equipment'); }
            occ.add(x0, y, z0, x1, ty + th, z1);
          };
          if (alongX) run(sx, sz + (sz < anchor[1] ? Dt / 2 + 0.3 : -Dt / 2 - 0.3), sx, anchor[1]);
          else run(sx + (sx < anchor[0] ? Dt / 2 + 0.3 : -Dt / 2 - 0.3), sz, anchor[0], sz);
        }
      }
      // ---- 3. cooling towers + roof-top units on the penthouse / mech-room roof
      if (deck) {
        const dA = (deck.x1 - deck.x0) * (deck.z1 - deck.z0);
        if (dA > 40 && (tall || r() < 0.45)) { // cooling tower: louvred cell block with 1-3 fan shrouds
          const nc = 1 + Math.floor(r() * (dA > 120 ? 3 : 2)), cwd = 3 + r() * 0.6, ax = deck.x1 - deck.x0 > deck.z1 - deck.z0;
          const cw = ax ? nc * cwd : cwd, cd = ax ? cwd : nc * cwd, ch = 2.4 + r() * 1.0;
          let x0 = 0, z0 = 0, ok = false;
          for (let tt = 0; tt < 6 && !ok; tt++) {
            x0 = deck.x0 + r() * Math.max(0, deck.x1 - deck.x0 - cw); z0 = deck.z0 + r() * Math.max(0, deck.z1 - deck.z0 - cd);
            ok = x0 + cw <= deck.x1 + 0.01 && z0 + cd <= deck.z1 + 0.01 && !occ.hit(x0 - 0.3, z0 - 0.3, x0 + cw + 0.3, z0 + cd + 0.3, deck.y, ch + 0.6);
          }
          if (ok) {
            const cc = jit(srgb(0x8d9290), r, 0.06);
            rb.box(x0, deck.y, z0, x0 + cw, deck.y + ch * 0.55, z0 + cd, CELL.LOUVRE, cc, false);
            rb.box(x0, deck.y + ch * 0.55, z0, x0 + cw, deck.y + ch, z0 + cd, CELL.METAL, cc, cc.map(v => v * 0.8));
            for (let i = 0; i < nc; i++) {
              const fx = ax ? x0 + (i + 0.5) * cwd : x0 + cw / 2, fz = ax ? z0 + cd / 2 : z0 + (i + 0.5) * cwd, fr = cwd * 0.4;
              rb.lathe([fx, deck.y + ch, fz], [0, 1, 0], [[fr, 0], [fr * 1.06, 0.5], [fr * 1.1, 0.75]], 10, cc.map(v => v * 0.9), CELL.METAL, { back: true });
              rb.disc(fx, deck.y + ch + 0.3, fz, fr * 1.02, C_DARK, 12);
              S.cyl(fx, fz, deck.y + ch, deck.y + ch + 0.75, fr * 0.985, fr * 1.09, 'equipment');
            }
            solid(x0, deck.y, z0, x0 + cw, deck.y + ch, z0 + cd);
            lodBox(x0, z0, x0 + cw, z0 + cd, deck.y + ch, deck.y);
            st.ct++;
          }
        }
        for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
          const uw = 1.4 + r() * 1.4, ud = 1.0 + r() * 0.9, uh = 0.9 + r() * 0.7;
          const zw = deck.x1 - deck.x0 - uw, zd = deck.z1 - deck.z0 - ud; if (zw < 0 || zd < 0) break;
          const x0 = deck.x0 + r() * zw, z0 = deck.z0 + r() * zd;
          if (occ.hit(x0 - 0.3, z0 - 0.3, x0 + uw + 0.3, z0 + ud + 0.3, deck.y, uh + 0.3)) continue;
          const hc = pick(C_HVAC, r);
          rb.box(x0, deck.y, z0, x0 + uw, deck.y + uh, z0 + ud, CELL.METAL, hc);
          rb.cyl(x0 + uw / 2, z0 + ud / 2, Math.min(uw, ud) * 0.33, deck.y + uh, deck.y + uh + 0.1, hc.map(v => v * 0.8), 10, CELL.METAL, C_DARK);
          solid(x0, deck.y, z0, x0 + uw, deck.y + uh, z0 + ud);
        }
        // lattice mast / antenna on tall plant roofs
        if (tall && r() < 0.6) {
          const mx = deck.x0 + (deck.x1 - deck.x0) * (0.2 + r() * 0.6), mz = deck.z0 + (deck.z1 - deck.z0) * (0.2 + r() * 0.6);
          if (!occ.hit(mx - 0.8, mz - 0.8, mx + 0.8, mz + 0.8, deck.y, 12)) { mast(rb, S, Z, mx, deck.y, mz, 7 + r() * 10, r); occ.add(mx - 0.6, deck.y, mz - 0.6, mx + 0.6, deck.y + 17, mz + 0.6); st.ant++; }
        }
      }
      // ---- 5. satellite dishes (a cluster along one parapet) + TV antennas on residential roofs
      if (!greenRoof && (resid ? r() < 0.42 : r() < 0.3)) dishes(rb, S, occ, tryAt, r, P0, y, 1 + Math.floor(r() * 3), st); // r6: fewer (rows of them read as a stamped grid)
      for (let ai = 0, an = resid && isTop ? (r() < 0.6 ? 1 + (r() < 0.3 ? 1 : 0) : 0) : 0; ai < an; ai++) { // r6: more TV antennas, scattered
        const at = r() < 0.5 ? near(0.4, 0.4, 5, 5, 8) : place(0.4, 0.4, 5, 6);
        if (at) { tvAntenna(rb, S, at[0] + 0.2, y, at[1] + 0.2, 2.5 + r() * 2.5, r); occ.add(at[0], y, at[1], at[0] + 0.4, y + 5, at[1] + 0.4); st.ant++; }
      }
      // ---- 6. solar array: rows of tilted panels facing south (-z) on low / mid roofs with open area
      if (!greenRoof && !tall && area > 110 && (resid || type === 'loft' || lower) && r() < 0.2) {
        const rowsN = 2 + Math.floor(r() * 4), pw = Math.min(rw * 0.6, 4 + r() * 8), pd = 1.7, tilt = 0.35, pitch = 2.4;
        const Wt = pw, Dt = rowsN * pitch;
        const at = place(Wt, Dt, 1.4, 10);
        if (at) {
          for (let i = 0; i < rowsN; i++) {
            const z0 = at[1] + i * pitch, zc = z0 + pd * Math.cos(tilt) / 2, h0 = y + 0.35, h1 = h0 + pd * Math.sin(tilt);
            const c = [at[0] + pw / 2, (h0 + h1) / 2 + 0.03, zc], ux = [1, 0, 0], uy = [0, Math.cos(tilt), -Math.sin(tilt)], uz = [0, Math.sin(tilt), Math.cos(tilt)];
            rb.obox(c, [pw / 2, 0.03, pd / 2], ux, uy, uz, CELL.SOLAR, [1, 1, 1], null, y);
            for (const sx of [at[0] + 0.3, at[0] + pw - 0.3]) rb.box(sx - 0.04, y, zc + 0.3, sx + 0.04, h1 - 0.1, zc + 0.38, CELL.METAL, C_FRAME, false);
            S.ramp(at[0], h0 - 0.05, z0, at[0] + pw, z0 + pd * Math.cos(tilt), 2, h0 + 0.06, h1 + 0.06, 'equipment', 0, 0.12);
          }
          occ.add(at[0], y, at[1], at[0] + Wt, y + 1.4, at[1] + Dt);
          st.solar++;
        }
      }
      // ---- 7. skylights (flat glazed frames / pyramids) on lofts / walk-ups / apartments / podiums
      if (!greenRoof && (type === 'loft' || type === 'walkup' || type === 'apt' || lower) && r() < 0.6) {
        const pyr = r() < 0.4;
        const n = 1 + Math.floor(r() * (area > 200 ? 4 : 2));
        const sw0 = 1.6 + r() * 2.2, sd0 = 1.4 + r() * 1.2;
        let prev = null;
        for (let i = 0; i < n; i++) {
          const sw = pyr ? sd0 : sw0, sd = sd0, sh = 0.35 + r() * 0.2;
          // skylights come in lines (same size, evenly spaced) like the refs
          let at = prev ? [prev[0] + sw + 1.2, prev[1]] : place(sw, sd, sh + 0.9, 8);
          if (prev && !tryAt(at[0], at[1], sw, sd, sh + 0.9)) break;
          if (!at) break;
          prev = at;
          const [x0, z0] = at;
          rb.box(x0, y, z0, x0 + sw, y + sh, z0 + sd, CELL.METAL, C_FRAME, false);
          if (pyr) {
            const rr = Math.min(sw, sd) / 2 * Math.SQRT2, hh = Math.min(sw, sd) * 0.4;
            rb.lathe([x0 + sw / 2, y + sh, z0 + sd / 2], [0, 1, 0], [[rr, 0], [0.001, hh]], 4, [1, 1, 1], CELL.GLASS, { rot0: Math.PI / 4 });
            S.box(x0, y, z0, x0 + sw, y + sh, z0 + sd, 'skylight');
          } else {
            rb.box(x0 + 0.08, y + sh, z0 + 0.08, x0 + sw - 0.08, y + sh + 0.02, z0 + sd - 0.08, CELL.GLASS, [1, 1, 1]);
            S.box(x0, y, z0, x0 + sw, y + sh + 0.02, z0 + sd, 'skylight');
          }
          occ.add(x0, y, z0, x0 + sw, y + sh + 0.5, z0 + sd);
          st.sky++;
        }
      }
      // ---- 8. brick chimneys along the party walls (walk-ups, apartments, old lofts)
      if (isTop && (type === 'walkup' || type === 'apt' || (type === 'loft' && r() < 0.4))) {
        const ft = lot.sides || {};
        const sides = ['nx', 'px', 'nz', 'pz'].filter(s => ft[s] === 'party' && Math.abs((s === 'nx' ? m.x0 - lot.x0 : s === 'px' ? lot.x1 - m.x1 : s === 'nz' ? m.z0 - lot.z0 : lot.z1 - m.z1)) < 0.3);
        const lay = r() < 0.6 ? LAYER.RED : LAYER.BROWN;
        for (const s of sides) {
          if (r() < 0.35) continue;
          for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
            const cw = 0.7 + r() * 0.8, cd = 0.5 + r() * 0.4, ch = 1.2 + r() * 1.4;
            const along = s === 'nx' || s === 'px' ? 'z' : 'x';
            const u = r();
            let x0, z0, w2, d2;
            if (along === 'z') { w2 = cd; d2 = cw; x0 = s === 'nx' ? m.x0 + t + 0.02 : m.x1 - t - 0.02 - cd; z0 = P0.z0 + u * Math.max(0, rd - cw); }
            else { w2 = cw; d2 = cd; z0 = s === 'nz' ? m.z0 + t + 0.02 : m.z1 - t - 0.02 - cd; x0 = P0.x0 + u * Math.max(0, rw - cw); }
            if (occ.hit(x0 + 0.01, z0 + 0.01, x0 + w2 - 0.01, z0 + d2 - 0.01, y, ch)) continue;
            const pc = { ...m.p, style: STYLE.BLANK, layer: lay, tint: [0.85, 0.8, 0.78], topY: y + ch };
            gt.fac.box(x0, y, z0, x0 + w2, y + ch, z0 + d2, pc, {}, true, false, { ...pc, layer: LAYER.CONCRETE, tint: [0.45, 0.44, 0.42] });
            solid(x0, y, z0, x0 + w2, y + ch, z0 + d2, 'bulkhead');
            // flue pots
            if (i === 0) rb.cyl(x0 + w2 / 2, z0 + d2 / 2, Math.min(w2, d2) * 0.22, y + ch, y + ch + 0.3, srgb(0x6a5a50), 5, CELL.METAL, C_DARK);
            st.chim++;
          }
        }
      }
      // ---- 9. terrace / roof garden dressing: planters, lawn beds, trees, pergola, furniture, rails, rare pool
      if (terr) {
        const tw = terr.x1 - terr.x0, td = terr.z1 - terr.z0;
        const e = 0.25;
        const Tz = { x0: Math.max(terr.x0, P0.x0 - 0.45), z0: Math.max(terr.z0, P0.z0 - 0.45), x1: Math.min(terr.x1, P0.x1 + 0.45), z1: Math.min(terr.z1, P0.z1 + 0.45) };
        // planter runs along the terrace's roof-edge sides
        const runs = [];
        if (Math.abs(terr.x0 - R.x0) < 0.1) runs.push(['x', Tz.x0 + e, Tz.z0 + e, Tz.z1 - e]);
        if (Math.abs(terr.x1 - R.x1) < 0.1) runs.push(['x', Tz.x1 - e - 0.8, Tz.z0 + e, Tz.z1 - e]);
        if (Math.abs(terr.z0 - R.z0) < 0.1) runs.push(['z', Tz.z0 + e, Tz.x0 + e, Tz.x1 - e]);
        if (Math.abs(terr.z1 - R.z1) < 0.1) runs.push(['z', Tz.z1 - e - 0.8, Tz.x0 + e, Tz.x1 - e]);
        for (const [ax, c0, a0, a1] of runs) {
          let a = a0 + r() * 1.5;
          while (a < a1 - 1.2) {
            const L = Math.min(a1 - a, 1.6 + r() * 2.2);
            if (r() < 0.75) {
              const ph = 0.55 + r() * 0.2, sh = ph + 0.35 + r() * 0.5;
              const [x0, z0, x1, z1] = ax === 'x' ? [c0, a, c0 + 0.8, a + L] : [a, c0, a + L, c0 + 0.8];
              if (!occ.hit(x0, z0, x1, z1, y, sh)) {
                rb.box(x0, y, z0, x1, y + ph, z1, CELL.PAVERS, C_PLANTER, jit(SOIL, r, 0.15), CELL.GRAVEL); // (veg r1) soil top
                // (veg r1) planting along the run: a clipped hedge, a grass row or a mixed border (was a green box)
                const th = prnd(), w = th < 0.4 ? [1, 0, 0, 0.12] : th < 0.65 ? [0, 1, 0.15, 0] : [0.3, 0.35, 0.5, 0.4];
                plantBed(x0 + 0.1, z0 + 0.1, x1 - 0.1, z1 - 0.1, y + ph, w, 2.4, 0.9);
                r(); // (veg r1) keep the roof rng stream (the old green-box colour pick)
                solid(x0, y, z0, x1, y + ph, z1);
              }
            }
            a += L + 0.4 + r() * 1.2;
          }
        }
        // pool (big terraces of apartment / glass podium roofs)
        const poolR = r();
        if ((aT === 'pool' && tw * td > 40) || (tw * td > 70 && poolR < 0.36 && (type === 'apt' || type === 'glass' || type === 'postwar' || lower))) { // r4: 0.12 -> 0.28; r7: placed before the bed grid (it used to fill the centre first: 15 pools city-wide), 0.36; r8: always on 'pool' archetype roofs
          const big = aT === 'pool';
          const pw = Math.min(tw - 3, big ? 6 + r() * 7 : 4 + r() * 5), pd = Math.min(td - 3, big ? 3.5 + r() * 2.5 : 3 + r() * 3);
          const x0 = terr.x0 + (tw - pw) / 2, z0 = terr.z0 + (td - pd) / 2;
          if (pw > 2.5 && pd > 2 && !occ.hit(x0 - 0.3, z0 - 0.3, x0 + pw + 0.3, z0 + pd + 0.3, y, 1)) {
            rb.box(x0 - 0.3, y, z0 - 0.3, x0 + pw + 0.3, y + 0.45, z0 + pd + 0.3, CELL.PAVERS, srgb(0xc9c4b8), srgb(0xffffff), -1, 1);
            solid(x0 - 0.3, y, z0 - 0.3, x0 + pw + 0.3, y + 0.45, z0 + pd + 0.3, 'roof');
            // r7: timber deck surround + a row of loungers along one long side
            rb.skin(x0 - 1.4, z0 - 1.4, x0 + pw + 1.4, z0 + pd + 1.4, y + 0.009, CELL.DECK, jit([0.95, 0.9, 0.85], r, 0.06), 0, 0, false, 0.2);
            for (let lx = x0 + 0.2; lx < x0 + pw - 0.6; lx += 1.1) {
              const lz = z0 + pd + 0.45;
              if (lz + 1.8 > terr.z1 - 0.2 || occ.hit(lx, lz, lx + 0.65, lz + 1.8, y, 0.5)) break;
              rb.box(lx, y, lz, lx + 0.65, y + 0.35, lz + 1.8, CELL.METAL, jit(pick(C_UMB, r), r, 0.05).map(v => v * 0.9));
              solid(lx, y, lz, lx + 0.65, y + 0.35, lz + 1.8);
            }
            if (big) { // r8: pool-deck archetype: loungers on the far side too, umbrellas, a cabana / bar kiosk, planter pots
              for (let lx = x0 + 0.4; lx < x0 + pw - 0.6; lx += 1.3) {
                const lz = z0 - 0.45 - 1.8;
                if (lz < terr.z0 + 0.2 || occ.hit(lx, lz, lx + 0.65, lz + 1.8, y, 0.5)) break;
                rb.box(lx, y, lz, lx + 0.65, y + 0.35, lz + 1.8, CELL.METAL, jit(pick(C_UMB, ra), ra, 0.05).map(v => v * 0.9));
                solid(lx, y, lz, lx + 0.65, y + 0.35, lz + 1.8);
              }
              const Tin = { x0: terr.x0 + 1.2, z0: terr.z0 + 1.2, x1: terr.x1 - 1.2, z1: terr.z1 - 1.2 };
              for (let i = 0, n = 2 + Math.floor(ra() * 3); i < n; i++) {
                const at = place(2.2, 2.2, 2.6, 6, Tin, true); if (!at) break;
                const cx = at[0] + 1.1, cz = at[1] + 1.1, uc = jit(pick(C_UMB, ra), ra, 0.05);
                rb.cyl(cx, cz, 0.03, y, y + 2.2, C_FRAME, 5);
                rb.lathe([cx, y + 2.05, cz], [0, 1, 0], [[1.05, 0], [0.05, 0.38]], 8, uc, CELL.METAL, { back: true, base: y });
                S.cyl(cx, cz, y, y + 2.05, 0.03, 0.03, 'pole'); S.cyl(cx, cz, y + 2.05, y + 2.43, 1.05, 0.05, 'awning');
                occ.add(cx - 1.05, y, cz - 1.05, cx + 1.05, y + 2.45, cz + 1.05);
              }
              const kat = place(3.2, 2.2, 3, 8, Tin, true);
              if (kat) { // cabana: timber hut with a flat striped awning roof
                const [kx, kz] = kat, kc = jit(pick(C_UMB, ra), ra, 0.05);
                rb.box(kx, y, kz, kx + 3.2, y + 2.3, kz + 2.2, CELL.DECK, jit(C_WOODF, ra, 0.1), false);
                rb.box(kx - 0.25, y + 2.3, kz - 0.25, kx + 3.45, y + 2.45, kz + 2.45, CELL.METAL, kc.map(v => v * 0.85), kc);
                solid(kx, y, kz, kx + 3.2, y + 2.3, kz + 2.2); S.box(kx - 0.25, y + 2.3, kz - 0.25, kx + 3.45, y + 2.45, kz + 2.45, 'awning', 1);
              }
            }
            st.pool++;
          }
        }
        // garden: raised lawn / vegetable beds in a grid + trees in the lumpy canopy batch
        if (aT === 'garden') { // r8: terrace-garden archetype: irregular raised beds (timber / concrete curbs) planted with
          // shrub masses (lumpy crowns) and small trees; the deck / paver terrace between them is the path network
          const Tin = { x0: terr.x0 + 0.9, z0: terr.z0 + 0.9, x1: terr.x1 - 0.9, z1: terr.z1 - 0.9 };
          for (let i = 0, nb = Math.min(10, 2 + Math.floor(tw * td / 20)); i < nb; i++) {
            const bw = 1.6 + ra() * 3.6, bd = 1.4 + ra() * 2.8, bh = 0.35 + ra() * 0.35;
            const at = place(bw, bd, 2.5, 6, Tin, true); if (!at) continue;
            const [x0, z0] = at, x1 = x0 + bw, z1 = z0 + bd;
            const curb = ra() < 0.5 ? jit(C_WOODF, ra, 0.1) : jit(C_PLANTER, ra, 0.08);
            rb.box(x0, y, z0, x1, y + bh, z1, ra() < 0.5 ? CELL.DECK : CELL.PAVERS, curb, jit(SOIL, ra, 0.15), CELL.GRAVEL); // (veg r1) soil / mulch top (was a green slab)
            solid(x0, y, z0, x1, y + bh, z1);
            ra(); ra(); // (veg r1) keep the archetype rng stream (the green-slab picks)
            for (let q = 0, ns = Math.min(10, 3 + Math.floor(bw * bd / 1.8)); q < ns * 3; q++) ra(); // (veg r1) (old shrub-blob draws)
            // (veg r1) bed planting: each bed has its own mix (shrub border, grass bed, perennial bed, shade bed)
            const mix = [[1, 0.3, 0.3, 0.4], [0.3, 1, 0.5, 0.1], [0.3, 0.4, 1, 0.3], [0.6, 0.1, 0.3, 1]][Math.floor(prnd() * 4)];
            const tree = bw * bd > 6 && ra() < 0.5;
            plantBed(x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, y + bh, mix, tree ? 1.5 : 1.9);
            if (tree) { // a small tree in the bed (trees.js 'small': leaf cards + bark trunk + trunk collision)
              const tx = (x0 + x1) / 2, tz = (z0 + z1) / 2, th = 1.4 + ra() * 1.2, cr = 1.0 + ra() * 0.8; void th;
              roofTrees.push({ x: tx, z: tz, y: y + bh - 0.02, kind: 'small', sc: cr / 2.6 });
            }
            occ.add(x0, y, z0, x1, y + bh + 1.5, z1);
          }
          st.gardenArch = (st.gardenArch ?? 0) + 1;
        }
        if (!aT && tw * td > 50 && r() < 0.4 && !A.noBedGrid) { // r6: rarer + irregular (a regular bed grid read as a stamp) // park agent (residential.js noBedGrid): no raised-bed grid on most UES / UWS roofs
          const bw = 1.4 + r() * 0.8, bl = 2.5 + r() * 2.5, gx = bw + 1.0, gz = bl + 1.0;
          for (let x = terr.x0 + 1.4; x + bw < terr.x1 - 1.2; x += gx) for (let z = terr.z0 + 1.4; z + bl < terr.z1 - 1.2; z += gz) {
            if (r() < 0.4) continue;
            const bl2 = bl * (0.5 + r() * 0.5), zj = z + r() * (bl - bl2);
            if (occ.hit(x - 0.2, zj - 0.2, x + bw + 0.2, zj + bl2 + 0.2, y, 1)) continue;
            const bh = 0.4 + r() * 0.2;
            rb.box(x, y, zj, x + bw, y + bh, zj + bl2, CELL.DECK, jit(C_WOODF, r, 0.1), jit(r() < 0.5 ? SOIL : SOIL.map(v => v * 1.25), r, 0.12), CELL.GRAVEL); // (veg r1) soil
            solid(x, y, zj, x + bw, y + bh, zj + bl2);
            plantBed(x + 0.12, zj + 0.12, x + bw - 0.12, zj + bl2 - 0.12, y + bh, prnd() < 0.5 ? [0.1, 0.1, 0.5, 1] : [0.2, 0.3, 1, 0.5], 1.6, 0.8); // (veg r1) veg / cutting-flower rows
          }
          st.garden++;
        }
        // pergola (timber frame, open top) on decks
        if (terr.cell === CELL.DECK && tw * td > 40 && r() < 0.35) {
          const pw = 3 + r() * 2, pd = 2.5 + r() * 1.5, ph = 2.5;
          const at = place(pw, pd, ph + 0.3, 6, { x0: terr.x0 + 0.8, z0: terr.z0 + 0.8, x1: terr.x1 - 0.8, z1: terr.z1 - 0.8 }, true);
          if (at) {
            const [x0, z0] = at, x1 = x0 + pw, z1 = z0 + pd;
            for (const [px, pz] of [[x0, z0], [x1 - 0.12, z0], [x0, z1 - 0.12], [x1 - 0.12, z1 - 0.12]]) { rb.box(px, y, pz, px + 0.12, y + ph, pz + 0.12, CELL.DECK, C_WOODF); S.box(px, y, pz, px + 0.12, y + ph, pz + 0.12, 'pole'); }
            for (let u = x0; u < x1; u += 0.5) rb.box(u, y + ph, z0 - 0.1, u + 0.07, y + ph + 0.14, z1 + 0.1, CELL.DECK, C_WOODF);
            S.box(x0, y + ph, z0 - 0.1, x1, y + ph + 0.14, z1 + 0.1, 'awning', 1);
            occ.add(x0, y, z0, x1, y + ph + 0.2, z1);
          }
        }
        // tables / umbrellas / loungers / potted trees
        for (let i = 0, n = Math.floor(tw * td / 30); i < Math.min(n, 12); i++) { // r6: 5 -> 12 (big terraces read empty)
          const Tin = { x0: terr.x0 + 1.3, z0: terr.z0 + 1.3, x1: terr.x1 - 1.3, z1: terr.z1 - 1.3 };
          const at = place(1.8, 1.8, 2.6, 5, Tin, true); if (!at) break;
          const cx = at[0] + 0.9, cz = at[1] + 0.9;
          const tr = r();
          if (tr < 0.4) { // potted tree: square pot, trunk, lumpy crown (canopy batch)
            rb.box(cx - 0.45, y, cz - 0.45, cx + 0.45, y + 0.7, cz + 0.45, CELL.PAVERS, C_PLANTER);
            const cr = 0.8 + r() * 0.4; // (veg r1) the tree itself: trees.js 'small' (leaf cards, bark, trunk collision)
            roofTrees.push({ x: cx, z: cz, y: y + 0.68, kind: 'small', sc: cr / 2.9 });
            if (prnd() < 0.5) plant(cx + 0.18, y + 0.68, cz - 0.15, prnd() < 0.5 ? PLANT.BROAD : PLANT.FLOWER, 0.7); // underplanting
            solid(cx - 0.45, y, cz - 0.45, cx + 0.45, y + 0.7, cz + 0.45);
            occ.add(cx - cr, y, cz - cr, cx + cr, y + 3.2, cz + cr);
          } else if (tr < 0.7) { // umbrella: pole + square canopy (flat top, canvas)
            rb.box(cx - 0.03, y, cz - 0.03, cx + 0.03, y + 2.2, cz + 0.03, CELL.METAL, C_FRAME);
            rb.box(cx - 1.0, y + 2.2, cz - 1.0, cx + 1.0, y + 2.32, cz + 1.0, CELL.METAL, jit(pick(C_UMB, r), r, 0.05));
            S.box(cx - 0.03, y, cz - 0.03, cx + 0.03, y + 2.2, cz + 0.03, 'pole'); S.box(cx - 1.0, y + 2.2, cz - 1.0, cx + 1.0, y + 2.32, cz + 1.0, 'awning', 1);
            occ.add(cx - 1, y, cz - 1, cx + 1, y + 2.32, cz + 1);
          } else { // lounger pair (timber)
            rb.box(cx - 0.9, y, cz - 0.35, cx + 0.9, y + 0.35, cz + 0.35, CELL.DECK, C_WOODF);
            solid(cx - 0.9, y, cz - 0.35, cx + 0.9, y + 0.35, cz + 0.35);
          }
        }
        // guard rail along the terrace's open (non-parapet) edges of setback roofs: posts + top rail
        if (m.parapet < 0.5) {
          const rail = (x0, z0, x1, z1) => {
            const L = Math.hypot(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0), hr = 1.05;
            if (L < 2) return;
            const [a0, b0] = ax ? [Math.min(x0, x1), z0] : [x0, Math.min(z0, z1)];
            if (ax) { rb.box(a0, y + hr - 0.05, b0 - 0.03, a0 + L, y + hr, b0 + 0.03, CELL.METAL, C_FRAME); S.box(a0, y + hr - 0.05, b0 - 0.03, a0 + L, y + hr, b0 + 0.03, 'pole'); }
            else { rb.box(a0 - 0.03, y + hr - 0.05, b0, a0 + 0.03, y + hr, b0 + L, CELL.METAL, C_FRAME); S.box(a0 - 0.03, y + hr - 0.05, b0, a0 + 0.03, y + hr, b0 + L, 'pole'); }
            for (let s = 0; s <= L; s += 1.5) {
              const px = ax ? a0 + Math.min(s, L - 0.04) : a0, pz = ax ? b0 : b0 + Math.min(s, L - 0.04);
              rb.box(px - 0.02, y, pz - 0.02, px + 0.02, y + hr - 0.05, pz + 0.02, CELL.METAL, C_FRAME, false);
            }
            st.rail++;
          };
          const q = 0.15;
          if (Math.abs(terr.x0 - m.x0) < 0.2) rail(m.x0 + q, terr.z0 + q, m.x0 + q, terr.z1 - q);
          if (Math.abs(terr.x1 - m.x1) < 0.2) rail(m.x1 - q, terr.z0 + q, m.x1 - q, terr.z1 - q);
          if (Math.abs(terr.z0 - m.z0) < 0.2) rail(terr.x0 + q, m.z0 + q, terr.x1 - q, m.z0 + q);
          if (Math.abs(terr.z1 - m.z1) < 0.2) rail(terr.x0 + q, m.z1 - q, terr.x1 - q, m.z1 - q);
        }
      }
      // ---- 10. greenhouse (rare, lofts / apartments)
      if (!greenRoof && !tall && isTop && (type === 'loft' || type === 'apt') && area > 150 && r() < 0.08) {
        const gw = 4 + r() * 4, gd = 3 + r() * 2, gh = 2.4;
        const at = place(gw, gd, gh + 0.5, 8);
        if (at) {
          const [x0, z0] = at, x1 = x0 + gw, z1 = z0 + gd;
          rb.box(x0, y, z0, x1, y + 0.5, z1, CELL.PAVERS, C_PLANTER, false);
          rb.box(x0, y + 0.5, z0, x1, y + gh, z1, CELL.GLASS, [1, 1, 1]);
          solid(x0, y, z0, x1, y + gh, z1, 'skylight');
          lodBox(x0, z0, x1, z1, y + gh);
        }
      }
      // ---- 10b. r6: low-rise roof life (critic: "same kit on every low-rise roof"): timber / corrugated storage sheds with
      //      a mono-pitch roof, pigeon coops, stacked junk (old units, pallets) and fire-escape goosenecks over the
      //      street parapet (the ladder top of the facade fire escape)
      if (!greenRoof && !tall && isTop && (resid || type === 'loft') && area > 45) {
        if (r() < 0.32) { // shed
          const sw2 = 1.8 + r() * 2.2, sd2 = 1.5 + r() * 1.4, sh = 2.0 + r() * 0.5, rise = 0.35, ax = r() < 0.5;
          const w2 = ax ? sw2 : sd2, d2 = ax ? sd2 : sw2;
          const at = r() < 0.5 ? near(w2, d2, sh + rise + 0.3, 6, 8) : place(w2, d2, sh + rise + 0.3, 8);
          if (at) {
            const [x0, z0] = at, x1 = x0 + w2, z1 = z0 + d2, timber = r() < 0.5;
            const wc = timber ? jit(pick(C_FENCE, r), r, 0.1) : jit(pick([srgb(0x8a8e8a), srgb(0x7a6a58), srgb(0x6b7470)], r), r, 0.08);
            rb.box(x0, y, z0, x1, y + sh, z1, timber ? CELL.DECK : CELL.METAL, wc, false);
            const lx = (ax ? w2 : d2) / 2 + 0.12, lz = (ax ? d2 : w2) / 2 + 0.12, tl2 = Math.atan2(rise, 2 * lz);
            const along = ax ? [1, 0, 0] : [0, 0, 1], perp = ax ? [0, 0, 1] : [1, 0, 0];
            rb.obox([(x0 + x1) / 2, y + sh + rise / 2, (z0 + z1) / 2], [lx, 0.03, Math.hypot(lz, rise / 2)], along, [perp[0] * -Math.sin(tl2), Math.cos(tl2), perp[2] * -Math.sin(tl2)],
              [perp[0] * Math.cos(tl2), Math.sin(tl2), perp[2] * Math.cos(tl2)], CELL.METAL, jit(pick([srgb(0x5a5d5e), srgb(0x6e5a48), srgb(0x4a4c48), srgb(0x7c7a72)], r), r, 0.08), null, y);
            solid(x0, y, z0, x1, y + sh, z1);
            S.ramp(x0 - 0.12, y + sh - 0.05, z0 - 0.12, x1 + 0.12, z1 + 0.12, ax ? 2 : 0, y + sh + 0.03, y + sh + rise + 0.03, 'equipment', 0, 0.06);
            st.shed = (st.shed ?? 0) + 1;
          }
        }
        if (r() < 0.1) { // pigeon coop: raised timber box on legs, wire-mesh flight cage
          const at = place(3.2, 2.2, 2.6, 6);
          if (at) {
            const [x0, z0] = at, x1 = x0 + 3.2, z1 = z0 + 2.2;
            for (const [px, pz] of [[x0, z0], [x1 - 0.1, z0], [x0, z1 - 0.1], [x1 - 0.1, z1 - 0.1]]) { rb.box(px, y, pz, px + 0.1, y + 0.7, pz + 0.1, CELL.DECK, C_WOODF, false); S.box(px, y, pz, px + 0.1, y + 0.7, pz + 0.1, 'pole'); }
            rb.box(x0, y + 0.7, z0, x0 + 1.8, y + 2.2, z1, CELL.DECK, jit([0.85, 0.8, 0.72], r, 0.1), srgb(0x4a4a48), CELL.EPDM);
            rb.box(x0 + 1.8, y + 0.7, z0 + 0.1, x1, y + 2.0, z1 - 0.1, CELL.LOUVRE, srgb(0x55585a), srgb(0x5a5d5e), CELL.LOUVRE);
            S.box(x0, y + 0.7, z0, x1, y + 2.2, z1, 'equipment'); occ.add(x0, y, z0, x1, y + 2.2, z1); ao(x0, z0, x1, z1, y, 1.2);
          }
        }
        if (r() < 0.25) { // junk pile: pallets / a retired condenser / buckets by the bulkhead
          for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) {
            const jw = 0.5 + r() * 0.9, jd = 0.5 + r() * 0.9, jh = 0.15 + r() * 0.7;
            const at = near(jw, jd, jh + 0.2, 3, 5); if (!at) continue;
            const jc = jit(pick([C_WOODF, srgb(0x8a8c88), srgb(0x5a5d5e), srgb(0x7a6048), srgb(0x6e7468)], r), r, 0.1);
            rb.box(at[0], y, at[1], at[0] + jw, y + jh, at[1] + jd, jh < 0.3 ? CELL.DECK : CELL.METAL, jc);
            solid(at[0], y, at[1], at[0] + jw, y + jh, at[1] + jd);
          }
        }
        // fire-escape gooseneck: two rails rising over the street parapet and arching back down onto the roof
        if (m.parapet > 0.3 && r() < 0.45) {
          const faces = ['nz', 'pz', 'nx', 'px'].filter(k => sd[k] === 'street' && Math.abs((k === 'nx' ? m.x0 - lot.x0 : k === 'px' ? lot.x1 - m.x1 : k === 'nz' ? m.z0 - lot.z0 : lot.z1 - m.z1)) < 0.1);
          if (faces.length) {
            const k = pick(faces, r), alongXf = k === 'nz' || k === 'pz', L = alongXf ? m.x1 - m.x0 : m.z1 - m.z0;
            const c0 = (alongXf ? m.x0 : m.z0) + L * (0.15 + r() * 0.7), gc = srgb(0x2e2f30), hy = top + 1.0, e0 = t + 0.9;
            const sgn = k === 'nz' || k === 'nx' ? -1 : 1, edge = k === 'nz' ? m.z0 : k === 'pz' ? m.z1 : k === 'nx' ? m.x0 : m.x1;
            for (const o of [-0.25, 0.25]) {
              const a = c0 + o;
              // outer leg (outside the wall face), top bar over the parapet, inner leg down to the roof
              const bxz = (p0, p1, y0, y1) => {
                const [x0, z0, x1, z1] = alongXf ? [a - 0.025, Math.min(p0, p1), a + 0.025, Math.max(p0, p1)] : [Math.min(p0, p1), a - 0.025, Math.max(p0, p1), a + 0.025];
                rb.box(x0, y0, z0, x1, y1, z1, CELL.METAL, gc); S.box(x0, y0, z0, x1, y1, z1, 'fireescape');
              };
              bxz(edge + sgn * 0.35, edge + sgn * 0.4, top - 1.5, hy);
              bxz(edge + sgn * 0.4, edge - sgn * e0, hy - 0.05, hy);
              bxz(edge - sgn * (e0 - 0.05), edge - sgn * e0, y, hy);
            }
            st.goose = (st.goose ?? 0) + 1;
          }
        }
      }
      // ---- 11. roof hatch + vent stacks / goosenecks (small, near the plant)
      if (r() < 0.5) {
        const at = near(0.9, 0.9, 0.7, 4, 6);
        if (at) { rb.box(at[0], y, at[1], at[0] + 0.9, y + 0.55, at[1] + 0.9, CELL.METAL, srgb(0x8a8c8a)); solid(at[0], y, at[1], at[0] + 0.9, y + 0.55, at[1] + 0.9); }
      }
      for (let i = 0, n = Math.floor(r() * (resid ? 5 : 4)); i < n; i++) {
        const at = near(0.4, 0.4, 1.4, 6, 4); if (!at) continue;
        const vr = 0.08 + r() * 0.1, vh = 0.5 + r() * 0.8, cx = at[0] + 0.2, cz = at[1] + 0.2, vc = r() < 0.5 ? srgb(0x8f9294) : srgb(0x3a3b3c);
        if (r() < 0.5) { rb.lathe([cx, y, cz], [0, 1, 0], [[vr, 0], [vr, vh], [vr * 2.2, vh + 0.02], [vr * 2.0, vh + 0.12], [0.01, vh + 0.2]], 7, vc, CELL.METAL); // capped stack
          S.cyl(cx, cz, y + vh, y + vh + 0.12, vr * 2.2, vr * 2.0, 'equipment'); }
        else rb.cyl(cx, cz, vr, y, y + vh, vc, 7);
        S.cyl(cx, cz, y, y + vh, vr * 0.95, vr * 0.95, 'equipment'); occ.add(at[0], y, at[1], at[0] + 0.4, y + vh + 0.2, at[1] + 0.4);
      }
      // ---- 13. window-washing davit track on tall roofs: a steel rail loop inside the parapet (+ davit sockets)
      if (isTop && tall && (m.parapet > 0.3 || bld.hero) && rw > 10 && rd > 10) {
        const q = 1.3, tw2 = 0.14, th = 0.12, dc = srgb(0x6d7072);
        const L = [[P0.x0 + q, P0.z0 + q, P0.x1 - q, P0.z0 + q + tw2], [P0.x0 + q, P0.z1 - q - tw2, P0.x1 - q, P0.z1 - q],
          [P0.x0 + q, P0.z0 + q + tw2, P0.x0 + q + tw2, P0.z1 - q - tw2], [P0.x1 - q - tw2, P0.z0 + q + tw2, P0.x1 - q, P0.z1 - q - tw2]];
        for (const [x0, z0, x1, z1] of L) {
          if (occ.hit(x0, z0, x1, z1, y, 0.5)) continue;
          rb.box(x0, y, z0, x1, y + th, z1, CELL.METAL, dc);
          S.box(x0, y, z0, x1, y + th, z1, 'equipment'); occ.add(x0, y, z0, x1, y + th, z1);
        }
        st.davit = (st.davit ?? 0) + 1;
      }
      // ---- 13b. r7: galvanised safety guardrail clamped on the parapet coping of tall roofs (critic: "parapets thin, no
      //      railings"): top + mid rail on posts every 2.4 m, exact boxes (posts too)
      if (isTop && tall && m.parapet > 0.3 && m.parapet < 1.3 && rs() < 0.55) {
        // freestanding 0.5 m inside the parapet (the coping stays clear for perching: capsule R 0.36 + edge zips at 0.1 m)
        const yc = y, hr = top - y + 1.0, gc = jit(srgb(0x8c8e8c), rs, 0.05), c = t + 0.5;
        const runs = [[m.x0 + c, m.z0 + c, m.x1 - c, m.z0 + c], [m.x0 + c, m.z1 - c, m.x1 - c, m.z1 - c], [m.x0 + c, m.z0 + c, m.x0 + c, m.z1 - c], [m.x1 - c, m.z0 + c, m.x1 - c, m.z1 - c]];
        for (const [ax0, az0, ax1, az1] of runs) {
          const alx = Math.abs(ax1 - ax0) > Math.abs(az1 - az0), L = alx ? ax1 - ax0 : az1 - az0;
          if (L < 2 || occ.hit(Math.min(ax0, ax1) - 0.05, Math.min(az0, az1) - 0.05, Math.max(ax0, ax1) + 0.05, Math.max(az0, az1) + 0.05, yc, hr)) continue;
          occ.add(Math.min(ax0, ax1) - 0.03, yc, Math.min(az0, az1) - 0.03, Math.max(ax0, ax1) + 0.03, yc + hr, Math.max(az0, az1) + 0.03);
          for (const yy of [yc + hr - 0.05, top + 0.45]) {
            const b = alx ? [ax0, yy, az0 - 0.025, ax1, yy + 0.05, az0 + 0.025] : [ax0 - 0.025, yy, az0, ax0 + 0.025, yy + 0.05, az1];
            rb.box(...b, CELL.METAL, gc); S.box(...b, 'pole');
          }
          for (let q = 0; q <= L; q += 2.4) {
            const px = alx ? ax0 + Math.min(q, L - 0.03) : ax0, pz = alx ? az0 : az0 + Math.min(q, L - 0.03);
            rb.box(px - 0.025, yc, pz - 0.025, px + 0.025, yc + hr - 0.05, pz + 0.025, CELL.METAL, gc, false);
            S.box(px - 0.025, yc, pz - 0.025, px + 0.025, yc + hr - 0.05, pz + 0.025, 'pole');
          }
        }
        st.grail = (st.grail ?? 0) + 1;
      }
      // ---- 13c. r7: roof drains (dark sump + cast dome) on the field of every sizeable roof skin
      if (area > 60) {
        for (let i = 0, n = Math.min(4, 1 + Math.floor(area / 300)); i < n; i++) {
          const dx = P0.x0 + 1 + rs() * Math.max(0, rw - 2), dz = P0.z0 + 1 + rs() * Math.max(0, rd - 2);
          if (occ.hit(dx - 0.5, dz - 0.5, dx + 0.5, dz + 0.5, y, 0.3) || inTerr(dx - 0.3, dz - 0.3, dx + 0.3, dz + 0.3)) continue;
          rb.disc(dx, y + 0.012, dz, 0.42, srgb(0x2a2a28), 8);
          rb.cyl(dx, dz, 0.16, y, y + 0.11, srgb(0x4a4a46), 8);
          S.cyl(dx, dz, y, y + 0.11, 0.16, 0.16, 'equipment');
        }
      }
      // ---- 14. r4: walkway pads (light concrete pavers, 1.5 cm) from the access door / plant anchor to the serviced
      //      equipment: L-shaped runs, the light lines that make a real service roof read from above
      if (svc.length && !greenRoof && area > 90) {
        const pw = 0.75, pc = jit([1.25, 1.22, 1.15], r, 0.05), hy = y + 0.015;
        // (zfix) every run starts at the same anchor: the strips overlapped at one height with different paver extents
        // (aE) -> z-fight. A run now lays only the part no earlier run of this roof covers (axis-aligned rect difference).
        const laid = [];
        const minus = (R, q) => {
          if (q[0] >= R[2] || q[2] <= R[0] || q[1] >= R[3] || q[3] <= R[1]) return [R];
          const o = [], z0 = Math.max(R[1], q[1]), z1 = Math.min(R[3], q[3]);
          if (q[1] > R[1]) o.push([R[0], R[1], R[2], q[1]]);
          if (q[3] < R[3]) o.push([R[0], q[3], R[2], R[3]]);
          if (q[0] > R[0]) o.push([R[0], z0, q[0], z1]);
          if (q[2] < R[2]) o.push([q[2], z0, R[2], z1]);
          return o;
        };
        const run = (a0, b0, a1, b1, alongXr) => {
          let x0 = alongXr ? Math.min(a0, a1) : a0 - pw / 2, x1 = alongXr ? Math.max(a0, a1) : a0 + pw / 2;
          let z0 = alongXr ? b0 - pw / 2 : Math.min(b0, b1), z1 = alongXr ? b0 + pw / 2 : Math.max(b0, b1);
          x0 = Math.max(x0, P0.x0 - 0.3); z0 = Math.max(z0, P0.z0 - 0.3); x1 = Math.min(x1, P0.x1 + 0.3); z1 = Math.min(z1, P0.z1 + 0.3);
          const L = alongXr ? x1 - x0 : z1 - z0;
          if (L < 1.2 || x1 <= x0 || z1 <= z0) return;
          // one strip of 0.6 m concrete pavers (the atlas joints), 1.5 cm over the roof: below the collision tolerance
          let pcs = [[x0, z0, x1, z1]];
          if (ZFIX) for (const q of laid) pcs = pcs.flatMap(R => minus(R, q));
          laid.push([x0, z0, x1, z1]);
          for (const [qx0, qz0, qx1, qz1] of pcs) if (qx1 - qx0 > 0.05 && qz1 - qz0 > 0.05) rb.skin(qx0, qz0, qx1, qz1, hy, CELL.PAVERS, pc, 0, 0, false, 0.12);
        };
        const [ax0, az0] = anchor;
        for (const [sx, sz, rx0, rz0, rx1, rz1] of svc.slice(0, 6)) {
          // go along x at the anchor's z, then along z to the row's near edge
          const tz = sz < az0 ? rz1 + 0.5 : rz0 - 0.5;
          run(ax0, az0, sx, az0, true);
          run(sx, az0, sx, tz, false);
        }
        st.pads = (st.pads ?? 0) + 1;
      }
    }
  }

  // ---- rear yards (block interiors): ground cover, fences, sheds, trees
  yards(gen, occ, S, tileOf, crowns, st);

  // ---- meshes: one per tile, shown with the full-detail facade tiles (same nearest-point distance + hysteresis)
  // (perf) roof AO / streak decals grouped into 2x2 super-tiles (tilebatch.js): one draw per super-tile while all its
  // tiles are in range. Same per-tile visibility ranges. Roof skins stay one mesh per tile (big geometry: peak memory).
  const meshes = [], rbG = [], aoG = [], skG = [];
  let roofTris = 0;
  for (const t of tiles.values()) {
    const g = t.rb.build(); if (!g) continue;
    const i = meshes.length;
    rbG[i] = g; roofTris += g.index.count / 3;
    aoG[i] = t.ao.build(); skG[i] = t.sk.build();
    t.rb = t.ao = t.sk = null; // free the builders
    if (skG[i]) st.streakTris = (st.streakTris ?? 0) + skG[i].index.count / 3;
    meshes.push({ i, ao: !!aoG[i], sk: !!skG[i], cx: t.cx, cz: t.cz, near: true });
  }
  const ctr = meshes.map(t => [t.cx, t.cz]);
  const rbB = batchTiles(rbG, mat, 'roofs', { castShadow: true, receiveShadow: true, smallCasters: true, merge: false }, ctr); // csm: keep out of the far cascades
  const aoB = batchTiles(aoG, aoMat, 'roofAO', { renderOrder: 1 }, ctr);
  const skB = batchTiles(skG, skMat, 'roofStreaks', { renderOrder: 1 }, ctr);
  for (const b of [rbB, aoB, skB]) for (const m of b.meshes) scene.add(m);
  if (crowns.count) crowns.build(scene, 'roof-trees', true, { tile: TILE * 2, smallCasters: true }); // (perf) 512 m batches: ~65 -> ~20 draws per pass
  plants.build(scene); st.plants = plants.count; st.roofTrees = roofTrees.length; // (veg r1)
  if (typeof window !== 'undefined') window.__roofPlants = plants; // (veg r1) debug / shot framing
  const stats = { ...st, tiles: meshes.length, crowns: crowns.count, tris: roofTris };
  console.log('[rooftops]', JSON.stringify(stats));
  // r7 debug aid (tools/city_shot.mjs --eval): which building / masses stand at a point
  if (typeof window !== 'undefined') window.__roofAt = (x, z) => gen.buildings.filter(b => b.masses?.some(m => x >= m.x0 && x <= m.x1 && z >= m.z0 && z <= m.z1))
    .map(b => ({ type: b.A.type, H: b.H, lot: [b.lot.x0, b.lot.z0, b.lot.x1, b.lot.z1].map(Math.round), sides: b.lot.sides,
      masses: b.masses.map(m => [m.x0, m.z0, m.x1, m.z1, m.y0, m.y1, m.parapet, m.crown ? 'C' : '', m.p?.layer].map(v => typeof v === 'number' ? +v.toFixed(1) : v)) }));
  let fr = null, pm = null, sp = null; // (perf r2) roof tile pre-upload
  return {
    stats,
    roofTrees, // (veg r1) city.js -> props.treeSpots (trees.js 'small')
    update(camera) {
      if (!camera) return;
      const p = camera.position;
      plants.update(p); // (veg r1)
      rbB.endWarm(); // (perf r2) pre-upload the next roof tile before it appears (see city.js / tilebatch.js warm)
      let warmed = false; if (!fr) { fr = new THREE.Frustum(); pm = new THREE.Matrix4(); sp = new THREE.Sphere(); }
      pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
      for (const tm of meshes) {
        const d = Math.hypot(Math.max(0, Math.abs(p.x - tm.cx) - 128), Math.max(0, Math.abs(p.z - tm.cz) - 128));
        const near = tm.near ? d < 690 : d < 650; tm.near = near;
        rbB.setVisible(tm.i, near); rbB.setShadow(tm.i, d < 230); // (perf) batched tiles
        if (!warmed && !near && !tm.warm && d < 850) { sp.center.set(tm.cx, 60, tm.cz); sp.radius = 200; if (fr.intersectsSphere(sp)) { if (rbB.warm(tm.i)) warmed = true; else tm.warm = true; } }
        if (tm.ao) aoB.setVisible(tm.i, d < 520);
        if (tm.sk) skB.setVisible(tm.i, d < 690);
      }
    },
  };
}

// ------------------------------------------------------------------------------------------ prop kit
// satellite dishes: a cluster along one side of the roof, all aimed the same way (south, like real ones)
function dishes(rb, S, occ, tryAt, r, P0, y, n, st) {
  const side = Math.floor(r() * 4), u0 = r();
  const along = side < 2 ? P0.x1 - P0.x0 : P0.z1 - P0.z0;
  for (let i = 0; i < n; i++) {
    const rad = 0.35 + r() * (r() < 0.2 ? 0.8 : 0.3), s = 2 * rad + 0.4;
    const u = (u0 * (along - s * n) + i * (s + 0.3 + r() * 0.8));
    if (u < 0 || u + s > along) continue;
    const x0 = side < 2 ? P0.x0 + u : (side === 2 ? P0.x0 : P0.x1 - s), z0 = side < 2 ? (side === 0 ? P0.z0 : P0.z1 - s) : P0.z0 + u;
    if (!tryAt(x0, z0, s, s, 2.2)) continue;
    const cx = x0 + s / 2, cz = z0 + s / 2, el = 0.55 + r() * 0.25, hc = y + 0.5 + rad * 0.8;
    const ax = [0, Math.sin(el), -Math.cos(el)]; // face -z (south), elevated
    rb.box(cx - 0.35, y, cz - 0.35, cx + 0.35, y + 0.12, cz + 0.35, CELL.METAL, srgb(0x55585a)); // ballast sled
    rb.box(cx - 0.04, y + 0.12, cz - 0.04, cx + 0.04, hc, cz + 0.04, CELL.METAL, srgb(0x6a6d70), false);
    const col = r() < 0.7 ? srgb(0xc8c6c0) : srgb(0x8c8e8e), dep = rad * 0.28;
    rb.lathe([cx, hc, cz], ax, [[0.001, 0], [rad * 0.5, dep * 0.25], [rad, dep]], 8, col, CELL.METAL, { back: true, base: y });
    // feed arm
    const fl = rad * 0.9;
    rb.obox([cx + ax[0] * fl * 0.5, hc + ax[1] * fl * 0.5, cz + ax[2] * fl * 0.5], [0.015, fl * 0.5, 0.015], [1, 0, 0], ax, [0, -ax[2], ax[1]], CELL.METAL, srgb(0x444648), null, y);
    S.box(cx - 0.35, y, cz - 0.35, cx + 0.35, y + 0.12, cz + 0.35, 'equipment');
    S.box(cx - 0.04, y + 0.12, cz - 0.04, cx + 0.04, hc, cz + 0.04, 'antenna');
    // dish plate: ramp over the disc's inscribed square (plane tilted about x)
    const q = rad * 0.7, cz0 = cz - q * Math.sin(el) + ax[2] * dep * 0.5, cz1 = cz + q * Math.sin(el) + ax[2] * dep * 0.5;
    S.ramp(cx - q, hc - q * Math.cos(el) - 0.05, Math.min(cz0, cz1), cx + q, Math.max(cz0, cz1), 2, hc + q * Math.cos(el) + ax[1] * dep * 0.5, hc - q * Math.cos(el) + ax[1] * dep * 0.5, 'antenna', 0, 0.06);
    occ.add(x0, y, z0, x0 + s, hc + rad, z0 + s);
    st.dish++;
  }
}

// r4: air-cooled chiller: louvred coil section, fan deck with 1-2 rows of shrouded fans (exact box + fan cylinders)
function chiller(rb, S, x0, z0, x1, z1, y, uh, alongX, colJ, topC) {
  rb.box(x0, y, z0, x1, y + uh * 0.8, z1, CELL.LOUVRE, colJ, false);
  rb.box(x0, y + uh * 0.8, z0, x1, y + uh, z1, CELL.METAL, colJ.map(v => v * 0.92), topC);
  const L = alongX ? x1 - x0 : z1 - z0, Wd = alongX ? z1 - z0 : x1 - x0;
  const nf = Math.max(2, Math.floor(L / 1.3)), nr = Wd > 2.3 ? 2 : 1;
  for (let f = 0; f < nf; f++) for (let q2 = 0; q2 < nr; q2++) {
    const a1 = (f + 0.5) / nf * L, b1 = (q2 + 0.5) / nr * Wd, fr = Math.min(L / nf, Wd / nr) * 0.4;
    const fx = alongX ? x0 + a1 : x0 + b1, fz = alongX ? z0 + b1 : z0 + a1;
    rb.lathe([fx, y + uh, fz], [0, 1, 0], [[fr, 0], [fr, 0.26]], 10, topC.map(v => v * 0.85), CELL.METAL, { back: true });
    rb.disc(fx, y + uh + 0.1, fz, fr * 0.98, C_DARK, 10);
    S.cyl(fx, fz, y + uh, y + uh + 0.26, fr, fr, 'equipment');
  }
}

// TV antenna: thin mast + 3 cross elements (Yagi-ish)
function tvAntenna(rb, S, x, y, z, h, r) {
  const c = srgb(0x5d6062);
  rb.box(x - 0.025, y, z - 0.025, x + 0.025, y + h, z + 0.025, CELL.METAL, c);
  const yaw = r() * Math.PI;
  for (let k = 0; k < 3; k++) {
    const yy = y + h - 0.2 - k * 0.35, L = 0.9 - k * 0.15;
    rb.obox([x, yy, z], [L, 0.012, 0.012], [Math.cos(yaw), 0, Math.sin(yaw)], [0, 1, 0], [-Math.sin(yaw), 0, Math.cos(yaw)], CELL.METAL, c, null, y);
  }
  S.box(x - 0.025, y, z - 0.025, x + 0.025, y + h, z + 0.025, 'antenna');
}

// lattice mast: 3 legs + bracing rings + whip on top
function mast(rb, S, Z, x, y, z, h, r) {
  const c = r() < 0.5 ? srgb(0x9ea0a0) : srgb(0x8a4a3a), w = 0.5;
  const legs = [0, 1, 2].map(k => [x + Math.cos(k * 2.094) * w, z + Math.sin(k * 2.094) * w]);
  for (const [lx, lz] of legs) { rb.box(lx - 0.04, y, lz - 0.04, lx + 0.04, y + h, lz + 0.04, CELL.METAL, c); S.box(lx - 0.04, y, lz - 0.04, lx + 0.04, y + h, lz + 0.04, 'antenna'); }
  for (let yy = y + 1.2; yy < y + h; yy += 1.2) rb.lathe([x, yy, z], [0, 1, 0], [[w, 0], [w, 0.05]], 3, c, CELL.METAL, { back: true, rot0: 0 });
  const wh = 3 + r() * 3; // r7: collision matches the drawn whip
  rb.cyl(x, z, 0.05, y + h, y + h + wh, c, 5);
  S.cyl(x, z, y + h, y + h + wh, 0.05, 0.05, 'antenna');
  Z.add(x, y + h, z, 0, 1, 0, 'pole');
}

// water tank: timber staved tank on a steel stand (conical roof) or a painted steel tank on a low stand
function waterTank(rb, S, Z, occ, x, y, z, rad, r) {
  const steel = r() < 0.3;
  const legH = steel ? 0.8 + r() * 1.2 : 2.6 + r() * 2.2, tankH = rad * (steel ? 1.8 : 2.0 + r() * 0.4);
  const sc = pick(C_STEEL, r);
  // stand: 4 legs at the tank rim + cross beams + platform
  const q = rad * 0.72;
  for (const [px, pz] of [[x - q, z - q], [x + q, z - q], [x - q, z + q], [x + q, z + q]]) {
    rb.box(px - 0.1, y, pz - 0.1, px + 0.1, y + legH, pz + 0.1, CELL.METAL, sc);
    S.box(px - 0.1, y, pz - 0.1, px + 0.1, y + legH, pz + 0.1, 'watertower');
  }
  if (legH > 1.5) { // X bracing on two faces (thin, visual)
    const mid = y + legH * 0.5;
    rb.box(x - q, mid - 0.04, z - q - 0.03, x + q, mid + 0.04, z - q + 0.03, CELL.METAL, sc, false);
    rb.box(x - q, mid - 0.04, z + q - 0.03, x + q, mid + 0.04, z + q + 0.03, CELL.METAL, sc, false);
    rb.box(x - q - 0.03, mid - 0.04, z - q, x - q + 0.03, mid + 0.04, z + q, CELL.METAL, sc, false);
    rb.box(x + q - 0.03, mid - 0.04, z - q, x + q + 0.03, mid + 0.04, z + q, CELL.METAL, sc, false);
  }
  const yb = y + legH;
  rb.box(x - rad * 1.05, yb - 0.25, z - rad * 1.05, x + rad * 1.05, yb, z + rad * 1.05, CELL.DECK, sc.map(v => v * 1.1));
  S.box(x - rad * 1.05, yb - 0.25, z - rad * 1.05, x + rad * 1.05, yb, z + rad * 1.05, 'watertower', 1);
  if (steel) {
    const tc = pick(C_TANKSTEEL, r);
    rb.lathe([x, yb, z], [0, 1, 0], [[rad, 0], [rad, tankH], [rad * 0.97, tankH + 0.05], [rad * 0.3, tankH + rad * 0.3], [0.01, tankH + rad * 0.34]], 12, tc, CELL.METAL);
    S.cyl(x, z, yb, yb + tankH, rad * 0.99, rad * 0.99, 'watertower');
    S.cyl(x, z, yb + tankH, yb + tankH + rad * 0.3, rad * 0.97 * 0.98, rad * 0.3, 'watertower');
  } else {
    const wc = jit([1, 1, 1], r, 0.12), rc = pick(C_TANKROOF, r);
    rb.lathe([x, yb, z], [0, 1, 0], [[rad, 0], [rad * 0.96, tankH]], 12, wc, CELL.STAVES);
    rb.lathe([x, yb + tankH, z], [0, 1, 0], [[rad * 1.04, 0], [rad * 0.12, rad * 0.7], [0.01, rad * 0.75]], 12, rc, CELL.METAL, { back: true });
    rb.cyl(x, z, 0.06, yb + tankH + rad * 0.7, yb + tankH + rad * 0.7 + 0.5, srgb(0x3a3a3a), 5);
    S.cyl(x, z, yb, yb + tankH, rad * 0.99, rad * 0.96 * 0.99, 'watertower');
    S.cyl(x, z, yb + tankH, yb + tankH + rad * 0.7, rad * 1.02, rad * 0.12, 'watertower', 1);
  }
  const yTop = yb + tankH + (steel ? rad * 0.3 : rad * 0.7);
  Z.add(x, yTop, z, 0, 1, 0, 'waterTower');
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; Z.add(x + Math.cos(a) * (rad + 0.05), yb + tankH * 0.6, z + Math.sin(a) * (rad + 0.05), Math.cos(a), 0, Math.sin(a), 'waterTower'); }
  occ.add(x - rad * 1.1, y, z - rad * 1.1, x + rad * 1.1, yTop + 0.5, z + rad * 1.1, K_WT);
}

// ------------------------------------------------------------------------------------------ rear yards
// Every 'row' lot whose rear line is open ('rear' side) gets the yard behind it (half way to the facing building or to
// the block's middle): lawn / patio / gravel ground cover, a timber / chain fence on the lot lines, sometimes a shed,
// a yard tree (lumpy canopy) or patio furniture. Ground-level solids (fences, sheds) are exact boxes.
function yards(gen, occ, S, tileOf, crowns, st) {
  const occG = new Occ(S, 0.6); // everything above ~knee height (building masses at ground)
  const yG = GY.WALK;
  for (const bld of gen.buildings) {
    const lot = bld.lot, sd = lot.sides || {};
    const dir = sd.pz === 'rear' ? 1 : sd.nz === 'rear' ? -1 : 0;
    if (!dir) continue;
    const b = blockAt(lot.cx, lot.cz); if (!b) continue;
    const r = mulberry32(Math.floor(Math.abs(lot.x0 * 31.7 + lot.z0 * 7.3)) + 5);
    const zr = dir > 0 ? lot.z1 : lot.z0;
    // scan for the facing building (or the block's property line) along the lot centre
    let dz = 0;
    const lim = dir > 0 ? b.pz1 - zr : zr - b.pz0;
    while (dz < lim && !occG.hit(lot.x0 + 0.5, dir > 0 ? zr + dz : zr - dz - 0.5, lot.x1 - 0.5, dir > 0 ? zr + dz + 0.5 : zr - dz, yG - 0.5, 3)) dz += 0.5;
    if (dz < 2) continue;
    const depth = dz >= lim - 0.1 ? dz : dz / 2; // share with the facing yard
    const x0 = lot.x0 + 0.05, x1 = lot.x1 - 0.05, z0 = dir > 0 ? zr + 0.05 : zr - depth + 0.02, z1 = dir > 0 ? zr + depth - 0.02 : zr - 0.05;
    if (x1 - x0 < 2 || z1 - z0 < 1.5) continue;
    if (occG.hit(x0 + 0.1, z0 + 0.1, x1 - 0.1, z1 - 0.1, yG - 0.5, 3)) continue;
    const rb = tileOf(lot.cx, lot.cz).rb;
    const k = r();
    const cell = k < 0.45 ? CELL.LAWN : k < 0.7 ? CELL.PAVERS : k < 0.85 ? CELL.GRAVEL : CELL.TAR;
    rb.skin(x0, z0, x1, z1, yG + 0.012, cell, jit(cell === CELL.LAWN ? [0.95, 0.95, 0.9] : [0.92, 0.92, 0.9], r, 0.1), r() * 40, r() * 40, false, 0.6);
    // fences on the side lot lines + back line
    const fc = pick(C_FENCE, r), fh = 1.6 + r() * 0.4, ft = 0.05;
    const fence = (a0, b0, a1, b1) => {
      if (Math.abs(a1 - a0) < 0.3 && Math.abs(b1 - b0) < 0.3) return;
      const fx0 = Math.min(a0, a1) - ft / 2, fx1 = Math.max(a0, a1) + ft / 2, fz0 = Math.min(b0, b1) - ft / 2, fz1 = Math.max(b0, b1) + ft / 2;
      if (occG.hit(fx0 + 0.06, fz0 + 0.06, fx1 - 0.06, fz1 - 0.06, yG - 0.5, 2)) return;
      rb.box(fx0, yG, fz0, fx1, yG + fh, fz1, CELL.DECK, fc, fc);
      S.box(fx0, yG, fz0, fx1, yG + fh, fz1, 'wall');
    };
    fence(lot.x0 + 0.03, z0, lot.x0 + 0.03, z1);
    fence(lot.x1 - 0.03, z0, lot.x1 - 0.03, z1);
    if (depth < dz - 0.2 || dz >= lim - 0.1) fence(x0, dir > 0 ? z1 : z0, x1, dir > 0 ? z1 : z0);
    // shed / AC pad / tree / patio set
    const inner = { x0: x0 + 0.5, z0: z0 + 0.5, x1: x1 - 0.5, z1: z1 - 0.5 };
    if (r() < 0.25 && inner.x1 - inner.x0 > 2.5 && inner.z1 - inner.z0 > 2.2) {
      const sw = 1.8 + r() * 0.8, sdp = 1.6 + r() * 0.6, sh = 2.1;
      const sx = r() < 0.5 ? inner.x0 : inner.x1 - sw, sz = dir > 0 ? inner.z1 - sdp : inner.z0;
      const scol = pick(C_FENCE, r).map(v => v * 1.1);
      rb.box(sx, yG, sz, sx + sw, yG + sh, sz + sdp, CELL.DECK, scol, srgb(0x4a4a48), CELL.EPDM);
      S.box(sx, yG, sz, sx + sw, yG + sh, sz + sdp, 'equipment');
    }
    // r4: yard trees (ailanthus / London plane / honey locust): most yards get one, big ones two; tall trunks so the
    // crowns top the fences and read (and cast shadows) from swinging altitude
    for (let ti = 0, tn = r() < 0.8 ? ((x1 - x0) * (z1 - z0) > 90 && r() < 0.5 ? 2 : 1) : 0; ti < tn; ti++) {
      if (inner.x1 - inner.x0 < 2 || inner.z1 - inner.z0 < 2) break;
      const tx = inner.x0 + r() * (inner.x1 - inner.x0), tz = inner.z0 + r() * (inner.z1 - inner.z0);
      const room = Math.min(tx - x0, x1 - tx, tz - z0, z1 - tz) + 1.6;
      const cr = Math.min(room, 2.4 + r() * 2.4), th = 3 + r() * 4;
      rb.cyl(tx, tz, 0.15, yG, yG + th, srgb(0x4a3e34), 6, CELL.DECK);
      S.cyl(tx, tz, yG, yG + th, 0.14, 0.14, 'pole');
      crowns.add(tx, yG + th - cr * 0.55, tz, cr, 0.3);
    }
    st.yard++;
  }
}

function pickCell(type, r, dist, H) {
  const x = r();
  if (type === 'glass') return x < 0.5 ? CELL.GRAVEL : x < 0.75 ? CELL.BITUMEN : CELL.PAVERS;
  if (H > 85) return x < 0.42 ? CELL.GRAVEL : x < 0.62 ? CELL.BITUMEN : x < 0.74 ? CELL.EPDM : x < 0.84 ? CELL.PAVERS : CELL.TAN; // tall towers: no white plates (r7: fewer pavers, critic: 'blotchy tiled concrete')
  if (type === 'postwar') return x < 0.3 ? CELL.GRAVEL : x < 0.5 ? CELL.BITUMEN : x < 0.65 ? CELL.MEMBRANE : x < 0.8 ? CELL.EPDM : x < 0.9 ? CELL.SILVER : CELL.TAR;
  if (type === 'deco') return x < 0.45 ? CELL.GRAVEL : x < 0.7 ? CELL.TAN : x < 0.92 ? CELL.PAVERS : CELL.RED;
  if (type === 'walkup' || dist.harlem > 0.5) return x < 0.32 ? CELL.TAR : x < 0.56 ? CELL.SILVER : x < 0.74 ? CELL.BITUMEN : x < 0.8 ? CELL.RED : x < 0.92 ? CELL.GRAVEL : CELL.EPDM;
  if (type === 'apt') return x < 0.26 ? CELL.TAR : x < 0.48 ? CELL.GRAVEL : x < 0.62 ? CELL.SILVER : x < 0.76 ? CELL.TAN : x < 0.81 ? CELL.RED : CELL.BITUMEN;
  return x < 0.25 ? CELL.TAR : x < 0.45 ? CELL.BITUMEN : x < 0.6 ? CELL.GRAVEL : x < 0.7 ? CELL.MEMBRANE : x < 0.82 ? CELL.SILVER : x < 0.87 ? CELL.RED : CELL.TAN; // loft / other
}
