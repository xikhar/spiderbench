// OWNER: citylife engineer. Pedestrian crowd: Blender-modelled people (tools/blender/city_npc.py ->
// public/assets/city/npc/people.{json,bin}) rendered as instanced meshes with GPU skinning from a baked animation
// texture (18 bones, 14 clips, per-instance clip cross-fades + head look-at), 3 LODs, per-instance outfit colours.
//
// Simulation (camera-streamed, deterministic per block):
//  * sidewalk walkers circle their block at a personal lane inset, pick a direction at every corner, cross streets
//    and avenues on the crosswalks only when their walk signal is on (props.phase), wait at the curb otherwise
//    (they register on the crosswalk so turning cars yield);
//  * chatting groups at storefronts, phone-starers, food-cart vendors, bench sitters, park-path and promenade walkers;
//  * reactions to Spider-Man (world.setPlayerState): heads turn to track him, people stop to take photos (phone flash),
//    wave, cheer, point, clap; they step back when he lands close, dodge when he walks into them; world.alarm()
//    makes them cower/flee.
import * as THREE from 'three';
import { G, mulberry32, streetsAt, inPark, shoreX, VMAP, MAPS, vmapAt } from '../layout.js'; // (layout2 r3) VMAP, vmapAt: Village walkers
import { PARK_MEADOWS, meadowDist } from '../trees.js';
import { tsCrowdSpots } from '../timessq.js'; // + timessq: static Times Square plaza crowd
import { PLAZA_CROWD_SPOTS } from '../props.js'; // (street r7) forecourt-plaza people
import { PARK_CROWD_SPOTS } from '../park.js'; // (peds r6) lawn + park-edge people (were box figures in park.js)
import { GC_CROWD_SPOTS } from '../grandcentral.js'; // (street r7) Park Av podium roof garden + colonnade people
import { perf2Off } from '../tilebatch.js'; // (perf r2) A/B switch
import { cityLights } from '../../render/citylights.js'; // (night) people cast city-light shadows

const RP = 270;                 // sidewalk population radius around the camera
const RNEAR = [120, 160]; /* (street r10) 95/135 -> 120/160 (director: 'many more pedestrians') */        // (street r8) 70/110 -> 95/135: denser sidewalks seen from swing height. near tier (extra walkers + crosswalk corner crowds): populate / release block distance
const NEAR_KILL = 175; /* (street r10) */ /* (street r8) 125 -> 150 */          // near-tier agents despawn beyond this camera distance
const PCELL = 48;               // park streaming cell size
const RPARK = [210, 250];       // park cell populate / release distance; park agents despawn beyond RPARK[1]
const LOD_D = [24, 70, 300];    // LOD0 / LOD1 / LOD2 max distance
const LOD_MAX = [110, 320, 1100];
const SLICE2 = !perf2Off('nocrowdopt'); // (perf r2) finer sim time-slicing + cached heights (?nocrowdopt: old path)
const SPEED_WALK = [0.95, 1.4]; // (peds r2) with the measured clip strides: playback 0.85-1.25 (critic: lockstep / sliding)
const STRIDE = 1.5;             // metres per walk cycle at scale 1 (clip 'walk' is 32 frames @30fps)
const RUN_STRIDE = 2.6;         // clip 'run' (19 frames)

const SKIN = [0.62, 0.52, 0.38, 0.24, 0.13, 0.08];
// (peds r1) photo faces: public/assets/city/tex/peds_atlas.webp (tools/imagegen/peds/build_atlas.py) holds 32 frontal
// faces (4 cols x 8 rows of 128 px; men in cols 0/2, women in 1/3), hair strand tiles and fabric swatches. FACE_SKIN is
// each face's clear-cheek colour (linear): the body skin uses it so neck / hands match the face. FACE_HAIR: d = dark hair
// only, a = any natural colour, g = grey (older people)
const FACE_SKIN = [[0.5520, 0.3231, 0.2623], [0.5583, 0.3419, 0.2961], [0.4125, 0.2086, 0.1500], [0.2918, 0.1441, 0.1022], [0.5149, 0.2874, 0.2502], [0.5711, 0.3325, 0.2705], [0.4397, 0.2122, 0.1620], [0.5333, 0.2983, 0.2384], [0.1981, 0.0999, 0.0782], [0.5583, 0.3231, 0.2789], [0.5271, 0.3005, 0.2423], [0.4397, 0.2270, 0.1559], [0.4735, 0.2195, 0.1878], [0.5029, 0.2664, 0.2122], [0.4342, 0.2232, 0.1651], [0.5395, 0.2961, 0.2384], [0.1683, 0.0823, 0.0675], [0.4910, 0.2582, 0.1845], [0.5271, 0.2918, 0.2232], [0.6105, 0.3813, 0.3095], [0.1779, 0.0887, 0.0648], [0.4969, 0.2705, 0.1912], [0.2122, 0.0999, 0.0723], [0.4508, 0.2307, 0.1470], [0.5029, 0.2789, 0.2232], [0.2086, 0.0999, 0.0762], [0.5089, 0.2747, 0.2346], [0.5841, 0.3278, 0.2582], [0.1144, 0.0666, 0.0648], [0.6038, 0.3663, 0.3278], [0.4233, 0.2122, 0.1470], [0.1559, 0.0742, 0.0561]]; // (peds r2) re-measured on the delit faces
const FACE_HAIR = 'daddadddgaddgddd' + 'ddddgdddddgddadd';
const FACES_M = [], FACES_F = [], FACES_OLD = []; // (peds r3) FACES_OLD: the grey-haired (older) faces
for (let i = 0; i < 32; i++) { (i % 2 ? FACES_F : FACES_M).push(i); if (FACE_HAIR[i] === 'g') FACES_OLD.push(i); }
const HAIR_TEX = { long: [0, 1], bob: [0, 1], ponytail: [0, 1], bun: [0, 1], curly: [2], short: [3], buzz: [3], bald: [3] }; // atlas strand tile: 0 straight 1 wavy 2 coily 3 cropped
const pack = (c) => { const q = (v) => Math.round(Math.sqrt(Math.max(0, Math.min(1, v))) * 255); return q(c[0]) * 65536 + q(c[1]) * 256 + q(c[2]); };
const lin = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map(s => Math.pow(s, 2.2));
// (citylife r1) coherent outfits instead of independent random colours (critic: 'repeated tan outfits'): a muted NYC
// palette (mostly black / charcoal / navy / grey / denim, some camel + beige coats, a few accents), chosen per garment
// type, plus a per-person pattern / tie code painted by the shader (see outfitFor)
// (peds r2) critic: 'saturated primaries', 'rendered brighter than their surroundings': 25 % toward grey, 8 % darker
// (peds r3) critic: 'palette almost all black / charcoal', 'add colour: denim, beige trench, bright jackets, hoodies':
// only 10 % toward grey, no global darkening, and every palette below gained light neutrals + real colours
const P_ = (a) => a.map(h => { const c = lin(h), l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return c.map(v => 0.02 + (v * 0.9 + l * 0.1) * 0.95); }); // black cloth still reflects ~3-4% (pure 0x15 read as holes in shade)
const SUIT = P_([0x1c1d21, 0x2d3036, 0x1d2536, 0x252f45, 0x4b4e53, 0x6b6f75, 0x8e9196, 0x2e2a27, 0x3e4a5e, 0x5a4a3a, 0xa89a80, 0x34466a]);
const SUIT_F = P_([0x1c1d21, 0x2d3036, 0x1d2536, 0x6b6f75, 0x2f4a3c, 0x8a7a62, 0x5a2a30, 0xb9b09c, 0x3d5a78, 0xd9d2c4, 0x9c3a30, 0xc4a57a, 0x6a2e4a]); // (citylife r2) women's suits: ref 13's green suit etc.
const SHIRT = P_([0xe6e6e2, 0xdfe3e8, 0xc9d4e2, 0xe8e2d6, 0xb9c7d9, 0xd8cfd2, 0xeeeeea, 0x9aa4b0, 0xe8d8c8, 0xa9c4dc]);
// (citylife r2) fewer near-blacks, more mid-values (camel / grey / navy / olive / oxblood / cream): crowds read as a black mass otherwise
const COAT = P_([0x1a1b1e, 0x2b2c30, 0x23293a, 0x6b5641, 0x8a6a48, 0xa4815a, 0xc2a57c, 0x5a5d61, 0x8e9094, 0x7a2a28, 0x2c4a3e, 0x4f5238, 0xb8ad98, 0x2b3a66, 0x9a3a2e, 0x6e5a7a, 0xd6cdbb, 0x3a5a78]);
const TRENCH = P_([0xa8906a, 0xc0a57e, 0x8f7d5e, 0x2a2b2e, 0x3a3f4a, 0x55585c, 0x1f2430, 0x7a7466, 0xb9ae96, 0x5c6a4a, 0x7a3a2e]); // (peds r2) fewer camels (clone tell)
const JACKET = P_([0x151515, 0x2a211b, 0x4a3526, 0x7a5a3c, 0x35506e, 0x4a6a9a, 0x2b3a55, 0x55583e, 0x707275, 0x9a2a24, 0xc49a3a, 0x2f6a58, 0xd8d2c2, 0x5a8ab0, 0xb8582a, 0x3a3a3c]);
const PUFFER = P_([0x121214, 0x1d2638, 0x3b4030, 0x6a6d70, 0xa42a24, 0x2d5a9a, 0xd8d4c8, 0xc2842a, 0x2f6a5a, 0xe0c23a, 0x6a3a7a, 0x1a1a1c, 0xd86a3a]);
const TEE = P_([0xe8e6e0, 0x141416, 0x2b2c30, 0x8e9196, 0x1f2b44, 0x8a2a2e, 0xc49a3a, 0x2f5a44, 0x7c93ad, 0xc4633a, 0xcfc8b8, 0x4a6a9e, 0x9a4f7e, 0xd8d0b0, 0xe06a5a, 0x3a8a8a, 0xf0ece0, 0xb03030, 0x6a8a4a, 0xe8a0b0]);
const JEANS = P_([0x1b2436, 0x223049, 0x2d3f5e, 0x3f5577, 0x5b7091, 0x7a90b0, 0x1a1a1c, 0x26324a, 0x9aaec8, 0xd8d4c8]);
const TROUSERS = P_([0x151517, 0x1f2023, 0x2b2d31, 0x4a4c50, 0x1d2536, 0x5a5448, 0x9a8a68, 0xb8a888, 0x4a4c3e, 0x6a6e74, 0xc8c0b0, 0x5a3a2a]);
const TIGHTS = P_([0x121213, 0x17171a, 0x1d1b1c, 0x2a2426, 0x1b1f2b, 0x3a2a24]);
const SHORTS = P_([0x8f8363, 0x3a3c40, 0x1d2536, 0x151517, 0x55606e, 0x9a8f70, 0x5b7091, 0xc8c0a8]);
const DRESS = P_([0x141416, 0x1d2536, 0x6a1c24, 0x2f5a44, 0x8a5a7e, 0xa89a68, 0xa82a2a, 0x3d6a98, 0xd8d2c4, 0xd8a03a, 0xe89a8a, 0x3a8a7a]);
const SKIRT = P_([0x141416, 0x2b2d31, 0x1d2536, 0x7a5a3a, 0x6a1c24, 0x8e9196, 0xc8b89a, 0x2f5a44]);
const BAGS = P_([0x111111, 0x1a1614, 0x3a2416, 0x5a3a22, 0x8a6034, 0x6a1a1e, 0x1d2b45, 0xb89a72, 0xd8cfc0, 0x9a2a24, 0x2b2b2b]);
const PACKS = P_([0x141416, 0x22252b, 0x2d4f7e, 0x4f5a32, 0x8a2a2d, 0x6d7075, 0xc05a24, 0xd0b040, 0x3a7a7a, 0x1d1d20]);
const SCARF = P_([0xa82a24, 0x3a3d42, 0xc8b08a, 0x2d4f7e, 0x7a3a5a, 0xe0d0b0, 0x1c1d21, 0xc08a2a, 0x3a7a5a, 0xd88a9a]);
const UMB = P_([0x111111, 0x16181d, 0x1d2638, 0x7a1a1e, 0x2b2b2b, 0x2d4f7e]);
// variant pick weights (office wear dominates midtown, refs 12/13); unknown names weigh 1
const VWEIGHT = { m_suit: 1.4, m_suit2: 1.8, f_blazer: 1.7, m_overcoat: 1.5, m_coat: 1.3, f_coat: 1.3, f_trench: 1.2, f_umbrella: 0.45, m_rain: 0.45,
  m_shorts: 0.35, m_heavy: 0.55, f_puffer: 0.6, f_dress: 0.8, f_skirt: 0.75, m_tee: 0.8, m_hoodie: 0.9, f_tote: 1.0, m_vest: 0.7 };
const OUTER_CODE = { jacket: 1, coat: 2, puffer: 3, suit: 4, vest: 5 };
const pick = (a, r) => a[Math.floor(r() * a.length)];
function outfitFor(v, r) {
  const o = v.outer, fem = v.female;
  let top, bot, outer = pick(COAT, r), acc = pick(BAGS, r), pat = 0, tie = 0;
  const rp = r();
  pat = rp < 0.5 ? 0 : rp < 0.64 ? 3 : rp < 0.75 ? 1 : rp < 0.84 ? 2 : rp < 0.93 ? 4 : 5; // plain / heather / stripes / check / (peds r3) print / breton on the top
  if (o === 'suit') {
    outer = pick(fem ? SUIT_F : SUIT, r);
    bot = r() < 0.75 ? outer : pick(TROUSERS.slice(0, 5), r);
    top = fem && r() < 0.45 ? pick([TEE[1], TEE[11], TEE[15], TEE[5]], r) : pick(SHIRT, r);
    if (!fem && r() < 0.8) tie = 1 + Math.floor(r() * 6);
    pat = r() < 0.85 ? 0 : 1;
  } else if (o === 'coat') {
    outer = v.belt ? pick(TRENCH, r) : pick(COAT, r);
    top = r() < 0.5 ? pick(SHIRT, r) : pick(TEE, r);
    bot = v.legs === 'tights' ? pick(TIGHTS, r) : (r() < 0.6 ? pick(TROUSERS.slice(0, 5), r) : pick(JEANS, r));
    if (!fem && r() < 0.35) tie = 1 + Math.floor(r() * 6);
    if (!v.belt) { const q = r(); if (q < 0.14) pat = 6; else if (q < 0.3) pat = 7; } // (peds r3) plaid / tweed coats
  } else if (o === 'jacket') {
    outer = pick(JACKET, r); top = pick(TEE, r); bot = r() < 0.7 ? pick(JEANS, r) : pick(TROUSERS, r);
    if (r() < 0.22) pat = 6;                                          // (peds r3) plaid overshirt / flannel jacket
  } else if (o === 'puffer' || o === 'vest') {
    outer = pick(PUFFER, r); top = pick(TEE, r); bot = v.legs === 'tights' ? pick(TIGHTS, r) : (r() < 0.6 ? pick(JEANS, r) : pick(TROUSERS, r));
  } else {
    top = v.skirt === 'dress' ? pick(DRESS, r) : pick(TEE, r);
    bot = v.skirt === 'skirt' ? pick(SKIRT, r) : v.legs === 'shorts' ? pick(SHORTS, r) : (r() < 0.62 ? pick(JEANS, r) : pick(TROUSERS, r));
    if (v.skirt === 'dress') pat = r() < 0.55 ? 0 : r() < 0.7 ? 4 : 1;   // (peds r3) printed / striped dresses
  }
  if (v.acc === 'backpack' || v.hat) acc = pick(PACKS, r);
  if (v.scarf) acc = pick(SCARF, r);
  if (v.acc === 'umbrella') acc = pick(UMB, r);
  const jit = (c) => { const k = 0.8 + r() * 0.36, t = (r() - 0.5) * 0.12; return [c[0] * k * (1 + t), c[1] * k, c[2] * k * (1 - t)]; }; // (peds r2) per-person dye / wear
  return { cols: new Float32Array([pack(jit(top)), pack(jit(bot)), pack(jit(outer)), pack(jit(acc))]), code: (OUTER_CODE[o] || 0) + 8 * pat + 64 * tie };
}

// ------------------------------------------------------------------ material (skinning from the anim texture)
function skinningGLSL(nb) {
  return `
    attribute vec4 aSI; attribute vec4 aSW; attribute vec3 aRA;   // aRA: region, vertex AO, (peds r2) option bit (16-attribute limit)
    attribute vec4 iA; attribute vec4 iB; attribute vec4 iX; attribute vec4 iM;
    // (peds r3) body type (critic: 'no body-type variety: heavy, short, slim'): girth g = 0.8 + floor(iM.z) / 100 reshapes
    // the rest pose before skinning, per bone group: torso wider / deeper (belly for g > 1), neck thicker, arms pushed
    // out with the shoulders + thicker, legs apart + thicker (fading to the ankles). Head, hair, hat and phone keep
    // their size, so heavy people don't get bobble heads (the old instance x-scale widened the head too)
    vec3 bodyShape(vec3 p) {
      float d = floor(iM.z) * 0.01 - 0.2;
      if (abs(d) < 0.004) return p;
      float wT = 0.0, wN = 0.0, wA = 0.0, wL = 0.0, wF = 0.0;
      for (int k = 0; k < 4; k++) {
        float w = aSW[k]; int b = int(aSI[k] + 0.5);
        if (b <= 2) wT += w; else if (b == 3) wN += w; else if (b >= 5 && b <= 10) wA += w;
        else if (b == 11 || b == 12 || b == 14 || b == 15) wL += w; else if (b == 13 || b == 16) wF += w;
      }
      float sx = p.x < 0.0 ? -1.0 : 1.0;
      float bz = p.z + 0.005, belly = exp(-pow((p.y - 1.04) / 0.13, 2.0)) * step(0.0, d);
      vec3 t = vec3(p.x * (1.0 + d), p.y, -0.005 + bz * (1.0 + d * (bz > 0.0 ? 1.0 + 1.4 * belly : 0.6)));
      vec3 n = vec3(p.x * (1.0 + 0.6 * d), p.y, p.z * (1.0 + 0.6 * d));
      vec3 a = vec3(sx * (0.2 + 0.16 * d) + (p.x - sx * 0.2) * (1.0 + 0.45 * d), p.y, p.z * (1.0 + 0.45 * d));
      float kl = smoothstep(0.12, 0.65, p.y);
      vec3 l = vec3(sx * (0.097 + 0.075 * d) + (p.x - sx * 0.097) * (1.0 + 0.85 * d * kl), p.y, p.z * (1.0 + 0.85 * d * kl));
      vec3 f = vec3(p.x + sx * 0.075 * d, p.y, p.z);
      return t * wT + n * wN + a * wA + l * wL + f * wF + p * max(0.0, 1.0 - wT - wN - wA - wL - wF);
    }
    // (peds r2) optional parts (hairstyles, hat, glasses, bag, scarf): bit aOpt of the instance mask (iX.w / 512)
    bool optHidden() { return aRA.z > 0.5 && mod(floor(floor(iX.w / 512.0) / aRA.z), 2.0) < 0.5; }
    uniform sampler2D uAnim; uniform float uTime; uniform vec3 uNeck; uniform vec3 uHead;
    mat4 bmRow(int row, int b) {
      ivec2 c = ivec2(b * 3, row);
      vec4 r0 = texelFetch(uAnim, c, 0), r1 = texelFetch(uAnim, c + ivec2(1, 0), 0), r2 = texelFetch(uAnim, c + ivec2(2, 0), 0);
      return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
    }
    mat4 clipBone(vec4 C, int b) {
      float len = C.y;
      float fr = mod((uTime - C.w) * C.z * 30.0, len);
      if (fr < 0.0) fr += len;
      int f0 = int(floor(fr)); int f1 = f0 + 1; if (float(f1) >= len) f1 = 0;
      float t = fract(fr);
      int r = int(C.x + 0.5);
      return bmRow(r + f0, b) * (1.0 - t) + bmRow(r + f1, b) * t;
    }
    mat4 lookRot(vec3 p, float yaw, float pitch) {
      float cy = cos(yaw), sy = sin(yaw), cp = cos(pitch), sp = sin(pitch);
      mat4 Ry = mat4(cy, 0.0, -sy, 0.0, 0.0, 1.0, 0.0, 0.0, sy, 0.0, cy, 0.0, 0.0, 0.0, 0.0, 1.0);
      mat4 Rx = mat4(1.0, 0.0, 0.0, 0.0, 0.0, cp, sp, 0.0, 0.0, -sp, cp, 0.0, 0.0, 0.0, 0.0, 1.0);
      mat4 T = mat4(1.0); T[3] = vec4(p, 1.0);
      mat4 Ti = mat4(1.0); Ti[3] = vec4(-p, 1.0);
      return T * Ry * Rx * Ti;
    }
    mat4 boneM(int b, float w) {
      mat4 m = clipBone(iA, b);
      if (w < 0.999) m = clipBone(iB, b) * (1.0 - w) + m * w;
      if (b == 4) m = m * lookRot(uHead, iX.y * 0.6, iX.z * 0.7);
      else if (b == 3) m = m * lookRot(uNeck, iX.y * 0.4, iX.z * 0.3);
      return m;
    }
    mat4 skinMatrix() {
      float w = clamp((uTime - iX.x) / 0.3, 0.0, 1.0);
      mat4 m = boneM(int(aSI.x + 0.5), w) * aSW.x;
      if (aSW.y > 0.0) m += boneM(int(aSI.y + 0.5), w) * aSW.y;
      if (aSW.z > 0.0) m += boneM(int(aSI.z + 0.5), w) * aSW.z;
      if (aSW.w > 0.0) m += boneM(int(aSI.w + 0.5), w) * aSW.w;
      return m;
    }`;
}

function makeMaterials(animTex, meta, pedTex, bakeTex) {
  const uni = { uAnim: { value: animTex }, uTime: { value: 0 }, uPed: { value: pedTex }, uBake: { value: bakeTex }, uBakeOn: { value: bakeTex ? 1 : 0 }, uFaceSkin: { value: FACE_SKIN.map(c => new THREE.Vector3(...c)) }, uNeck: { value: new THREE.Vector3(...meta.bones[3].head) },
    uHead: { value: new THREE.Vector3(...meta.bones[4].head) } };
  const common = skinningGLSL(meta.nb);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      ${common}
      attribute vec4 iC; attribute vec2 aUV;
      varying vec2 vBUv; varying vec3 vB0; varying vec3 vB1; varying vec3 vB2; varying float vOptF;   // (peds r2) baked cloth normal / AO
      vec3 unpackC(float f) { float r = floor(f / 65536.0); float g = floor((f - r * 65536.0) / 256.0); float b = f - r * 65536.0 - g * 256.0; vec3 c = vec3(r, g, b) / 255.0; return c * c; }
      varying vec3 vCol; varying float vRough; varying float vEmis;
      varying vec3 vRest; varying float vReg; varying float vAOm; varying vec3 vShirt; varying float vCode;
      uniform vec3 uFaceSkin[32]; varying vec4 vPed; varying vec3 vRestN; varying vec3 vHairC;   // (peds r1) face, tone, hair tile, view dist
      vec3 faceSkin() { return uFaceSkin[int(clamp(iM.x, 0.0, 31.99))] * mix(0.7, 1.08, fract(iM.x)); }
      vec3 skinTone(float k) {
        vec3 a = vec3(0.64, 0.44, 0.33), b = vec3(0.42, 0.26, 0.16), c = vec3(0.16, 0.09, 0.055);
        return k < 0.5 ? mix(a, b, k * 2.0) : mix(b, c, k * 2.0 - 1.0);
      }
      vec3 hairTone(float k) {
        vec3 a = vec3(0.015, 0.011, 0.008), b = vec3(0.12, 0.065, 0.03), c = vec3(0.45, 0.32, 0.16);
        return k < 0.7 ? mix(a, b, k / 0.7) : (k < 0.93 ? mix(b, c, (k - 0.7) / 0.23) : vec3(0.45, 0.44, 0.42));
      }`)
      .replace('#include <beginnormal_vertex>', `bool oHid = optHidden();
        mat4 sk = oHid ? mat4(0.0) : skinMatrix();   // hidden option: collapse to a point (degenerate triangles)
        vec3 objectNormal = oHid ? vec3(0.0, 1.0, 0.0) : normalize(mat3(sk) * normal);
        { mat3 bnm = normalMatrix * mat3(instanceMatrix) * mat3(sk); vB0 = bnm[0]; vB1 = bnm[1]; vB2 = bnm[2]; vBUv = aUV; vOptF = aRA.z; }
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3(1.0, 0.0, 0.0);
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = (sk * vec4(bodyShape(position), 1.0)).xyz;   // (peds r3) body type
        {
          int R = int(aRA.x + 0.5); float aAO = aRA.y / 255.0;
          vec3 c = vec3(0.5); float rg = 0.85; float em = 0.0;
          if (R == 0) { c = faceSkin(); rg = 0.64; }   // (peds r4) 0.55 -> 0.64: critic 'plastic' skin
          else if (R == 1) c = unpackC(iC.x);
          else if (R == 2) { c = unpackC(iC.y); rg = c.b > c.r * 1.25 ? 0.93 : 0.82; }
          else if (R == 3) { float sh_ = fract(iM.z); c = mix(vec3(0.012), vec3(0.2, 0.12, 0.07), sh_); c = sh_ > 0.85 ? vec3(0.7) : c; rg = 0.5; }
          else if (R == 4) { c = hairTone(fract(iM.y)); rg = 0.46; }   // (peds r4) 0.55 -> 0.46: strand sheen
          else if (R == 5) { c = unpackC(iC.z); float oc_ = mod(mod(iX.w, 512.0), 8.0);   // (peds r3) material separation (critic: 'wool vs leather vs denim all same roughness')
            rg = oc_ > 2.5 && oc_ < 3.5 || oc_ > 4.5 ? 0.42 : oc_ > 1.5 && oc_ < 2.5 ? 0.93 : oc_ > 3.5 ? 0.72 : dot(c, vec3(0.33)) < 0.03 ? 0.4 : 0.82; }
          else if (R == 6) { c = unpackC(iC.w); rg = 0.5; }
          else if (R == 7) { c = vec3(0.012); rg = 0.5; }
          else if (R == 8) { c = vec3(0.72); rg = 0.6; }
          else if (R == 9) { c = vec3(0.05, 0.08, 0.12); rg = 0.15; float fl = iM.w > 0.0 ? step(fract(uTime * 0.37 + iM.w), 0.035) : 0.0; em = 0.6 + fl * 60.0; }
          else if (R == 10) { c = vec3(0.02); rg = 0.3; }
          else if (R == 11) { c = faceSkin() * vec3(0.8, 0.56, 0.54); rg = 0.45; }       // lips
          else if (R == 12) { c = vec3(0.62, 0.6, 0.57); rg = 0.2; }                         // eye whites
          else if (R >= 13) { c = hairTone(fract(iM.y)); rg = 0.46; }                        // (peds r5) hair locks / fuzz shell (alpha-cut)
          vAOm = 0.35 + 0.65 * aAO;
          vCol = c * vAOm; vRough = rg; vEmis = em;
          vRest = position; vReg = float(R);
          // (peds r1) undo the leg-proportion remap (city_npc.py LEG_K / LEG_Y): all painting constants are in the modelling frame
          vRest.y = position.y < ${((meta.legY ?? 0.98) * (meta.legK ?? 1)).toFixed(5)} ? position.y / ${(meta.legK ?? 1).toFixed(5)} : position.y + ${((meta.legY ?? 0.98) * (1 - (meta.legK ?? 1))).toFixed(5)}; vShirt = unpackC(iC.x); vCode = mod(iX.w, 512.0);   // (citylife r1) garment detail inputs ((peds r2) mask above 512)
          vRestN = normal; vHairC = hairTone(fract(iM.y)) * vAOm;
          vec4 mvq = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
          vPed = vec4(floor(clamp(iM.x, 0.0, 31.99)), mix(0.7, 1.08, fract(iM.x)), floor(iM.y * 0.5), -mvq.z);
        }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vCol; varying float vRough; varying float vEmis;
      varying vec3 vRest; varying float vReg; varying float vAOm; varying vec3 vShirt; varying float vCode;
      uniform sampler2D uPed; uniform vec3 uFaceSkin[32]; varying vec4 vPed; varying vec3 vRestN; varying vec3 vHairC;
      uniform sampler2D uBake; uniform float uBakeOn; varying vec2 vBUv; varying vec3 vB0; varying vec3 vB1; varying vec3 vB2; varying float vOptF; vec4 gBake = vec4(0.5, 0.5, 0.5, 1.0);
      // (peds r1) atlas sampling. Tiles repeat with fract(); textureGrad with the gradient of the continuous coordinate
      // keeps the mip level right across the wrap (no seam lines). o/sz: tile origin / size in atlas uv (y down: flipY off)
      vec3 tileTex(vec2 q, vec2 o, float sz) { return textureGrad(uPed, o + fract(q) * sz, dFdx(q) * sz, dFdy(q) * sz).rgb; }
      // triplanar over the rest pose (garments have no uv): 3 taps blended by the rest normal
      float gH = 0.0;
      vec3 triTex(vec3 p, float scale, int k) {
        vec2 o = vec2(0.5 + float(k - (k / 4) * 4) * 0.125, 0.5 + float(k / 4) * 0.125);
        vec3 w = pow(abs(normalize(vRestN)), vec3(4.0)); w /= (w.x + w.y + w.z);
        vec3 t = vec3(0.0);
        if (w.x > 0.02) t += tileTex(p.zy / scale, o, 0.125) * w.x;
        if (w.y > 0.02) t += tileTex(p.xz / scale, o, 0.125) * w.y;
        if (w.z > 0.02) t += tileTex(p.xy / scale, o, 0.125) * w.z;
        return t / 0.2158;   // sRGB 128 (tile mean) -> 1.0
      }
      // (peds r1) photo face projected onto the head front (rest pose): 0.144 m wide cell, eyes at y 1.643 = v 0.33
      vec4 faceTex(vec3 p) {
        vec2 fuv = vec2(0.5 + p.x / 0.144, (1.684 - p.y) / 0.125);
        // (peds r2) softer chin / jaw edge (the photo's jaw shadow + the modelled jaw read as a mask seam): fade from the lip line
        float w = smoothstep(0.012, 0.05, p.z) * (1.0 - smoothstep(0.042, 0.064, abs(p.x) + max(0.0, fuv.y - 0.7) * 0.05)) * (1.0 - smoothstep(0.8, 0.98, fuv.y));
        float f = vPed.x; vec2 cell = vec2(f - floor(f / 4.0) * 4.0, floor(f / 4.0));
        vec2 q = clamp(fuv, vec2(0.03, 0.04), vec2(0.97, 0.985));
        vec3 t = texture(uPed, (cell + q) * 0.125).rgb;
        return vec4(t * vPed.y, w);
      }
      vec3 bumpN(vec3 sp, vec3 n, float h) {   // screen-space bump (fold height in metres)
        vec3 dx = dFdx(sp), dy = dFdy(sp); float hx = dFdx(h), hy = dFdy(h);
        vec3 r1 = cross(dy, n), r2 = cross(n, dx); float det = dot(dx, r1);
        vec3 g = sign(det) * (hx * r1 + hy * r2);
        return normalize(abs(det) * n - g);
      }
      float ph3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float pvn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(ph3(i), ph3(i + vec3(1, 0, 0)), f.x), mix(ph3(i + vec3(0, 1, 0)), ph3(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(ph3(i + vec3(0, 0, 1)), ph3(i + vec3(1, 0, 1)), f.x), mix(ph3(i + vec3(0, 1, 1)), ph3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
      vec3 tieCol(int k) { return k == 1 ? vec3(0.018, 0.03, 0.09) : k == 2 ? vec3(0.13, 0.015, 0.025) : k == 3 ? vec3(0.03, 0.03, 0.035)
        : k == 4 ? vec3(0.05, 0.1, 0.24) : k == 5 ? vec3(0.25, 0.03, 0.03) : vec3(0.1, 0.09, 0.05); }
      // (citylife r1) garment detail painted from the rest-pose position (every LOD): suit / jacket / coat fronts with the
      // shirt V, tie, lapel edges, button placket, buttons and pocket flaps; quilted puffers with a zip; striped / check /
      // heather tops; denim grain + fading, trouser creases; hair strands; low-frequency cloth folds everywhere
      bool gCut = false;
      vec3 garment(vec3 c) {
        int R = int(vReg + 0.5); vec3 p = vRest; float ax = abs(p.x);
        if (R >= 13) {   // (peds r5) hair locks / fuzz shells: strand gaps cut out, wider toward the tip (region 13 -> 14
          // interpolates across the triangle); fewer gaps with distance so the outline doesn't shimmer
          float tip = clamp(vReg - 13.0, 0.0, 1.0), a_ = atan(p.x, p.z - 0.01);
          float st = pvn(vec3(a_ * 60.0, p.y * 10.0, 0.0)) * 0.55 + pvn(vec3(a_ * 150.0 + 3.0, p.y * 20.0, 1.7)) * 0.45;
          if (st < (0.2 + 0.78 * tip) * mix(1.0, 0.5, smoothstep(12.0, 35.0, vPed.w))) discard;
          R = 4;
        }
        int oc = int(mod(vCode, 8.0)); int pat = int(mod(floor(vCode / 8.0), 8.0)); int tie = int(floor(vCode / 64.0));
        bool cloth = R == 1 || R == 2 || R == 5;
        if (cloth) c *= 0.9 + 0.16 * pvn(p * vec3(11.0, 6.0, 11.0)) - 0.02;   // (no sub-cm noise: it aliased into glitter)
        float gNear = 1.0 - smoothstep(14.0, 40.0, vPed.w);
        if ((cloth || R == 6) && gNear > 0.0) {   // (peds r1) woven / knit fabric detail + drape folds (bump), fading out with distance
          int k = 3; float sc = 0.07, amt = 0.35;
          if (R == 2) { bool dn = c.b > c.r * 1.25; k = dn ? 0 : 2; sc = dn ? 0.09 : 0.08; amt = dn ? 0.5 : 0.3; }
          else if (R == 5) { k = oc == 4 ? (pat == 1 ? 8 : 2) : oc == 2 ? 1 : oc == 1 ? (c.b > c.r * 1.2 ? 0 : 1) : 3; sc = oc == 2 ? 0.2 : 0.1; amt = oc == 3 || oc == 5 ? 0.0 : 0.4; }
          else if (R == 1) { k = pat == 3 ? 4 : (oc == 1 || oc == 2 || oc == 4) ? 2 : 3; sc = pat == 3 ? 0.16 : 0.06; amt = pat == 3 ? 0.55 : 0.3; }
          else if (R == 6) { k = p.y > 1.4 ? 5 : 10; sc = 0.1; amt = 0.35; }
          if (amt > 0.0) { vec3 t = triTex(p, sc, k); c *= mix(vec3(1.0), t, amt * 0.55 * gNear); gH += (t.r - 1.0) * 0.0004 * amt; }
          float jn = exp(-pow(p.y - 0.52, 2.0) / 0.006) * step(p.y, 0.95) + exp(-pow(p.y - 1.15, 2.0) / 0.006) * step(0.16, ax) + exp(-pow(p.y - 0.93, 2.0) / 0.004) * 0.6;
          float fold = triTex(p * vec3(1.0, 1.3, 1.0), 0.55, 11).r - 1.0;
          gH += fold * (0.0015 + 0.0035 * jn) * gNear * (1.0 - 0.85 * uBakeOn);   // (peds r2) folds now come from the Cycles bake
          c *= 1.0 + fold * 0.035 * gNear * (1.0 - uBakeOn);
        }
        bool front = p.z > 0.035;
        if (R == 5) {
          if (pat == 6) {   // (peds r3) plaid: two crossing stripe sets + thin light overcheck
            float u = fract(p.y * 6.5), w = fract((p.x + p.z * 0.7) * 6.5);
            float a = smoothstep(0.3, 0.36, u) * smoothstep(0.62, 0.56, u), b = smoothstep(0.3, 0.36, w) * smoothstep(0.62, 0.56, w);
            c *= 0.62 + 0.26 * a + 0.26 * b;
            c = mix(c, c * 1.6 + 0.03, (1.0 - smoothstep(0.0, 0.03, abs(u - 0.8))) * 0.5 + (1.0 - smoothstep(0.0, 0.03, abs(w - 0.8))) * 0.5);
          } else if (pat == 7) c *= 0.84 + 0.3 * pvn(p * vec3(70.0, 48.0, 70.0)) * gNear + 0.15 * (1.0 - gNear);   // tweed
          if (oc == 1 || oc == 2 || oc == 4) {
            float yV = oc == 2 ? 1.21 : oc == 1 ? 1.24 : 1.14, yT = 1.5;
            float w = clamp((p.y - yV) / (yT - yV), 0.0, 1.0) * (oc == 1 ? 0.07 : 0.088);
            if (front && p.y > yV && p.y < 1.53) {
              if (ax < w) {
                gCut = true;   // open front: the shirt torso underneath shows (painting it on the shell z-fought with it)
              } else if (ax < w + 0.034 && oc != 1) {
                c *= ax - w < 0.003 ? 0.72 : 0.95;                                            // lapel roll edge ((peds r5) modelled lapel now)
              } else if (ax < w + 0.006) c *= 0.55;                                          // jacket zip edge
            }
            float hemY = oc == 2 ? 0.5 : 0.84;
            if (front && p.y <= yV + 0.002 && p.y > hemY) {
              if (ax < 0.0035) c *= 0.55;                                                     // placket / closure
              float by = yV - 0.055;
              for (int k = 0; k < 4; k++) { float d = length(vec2(p.x - (oc == 2 ? 0.05 : 0.012), p.y - by)); if (d < 0.009) c = mix(c, vec3(0.02), 0.75); by -= oc == 2 ? 0.12 : 0.1; }
              if (abs(p.y - (oc == 2 ? 0.98 : 0.95)) < 0.005 && ax > 0.05 && ax < 0.135) c *= 0.5;   // pocket flaps
            }
            if (p.y > 1.44 && !front) c *= 0.88;                                                 // back of the collar
          } else if (oc == 3 || oc == 5) {
            float q = fract(p.y / 0.07);
            c *= 0.7 + 0.3 * smoothstep(0.0, 0.25, q) * smoothstep(1.0, 0.7, q);             // quilting
            if (front && ax < 0.005 && p.y > 0.86) c *= 0.4;                                  // zip
          }
        } else if (R == 1) {
          if (tie > 0 && front && p.y < 1.455 && p.y > 1.12 && ax < 0.011 + (1.455 - p.y) * 0.028) return tieCol(tie) * vAOm;
          if (oc == 1 || oc == 2 || oc == 4) { if (p.y > 1.43 && front) c *= 0.85; return c; }   // shirt under a jacket: plain, collar shade
          if (pat == 1) c = mix(c, vec3(0.6, 0.59, 0.56), 0.55 * smoothstep(0.45, 0.6, fract(p.y * 14.0)));
          else if (pat == 2) { float a = smoothstep(0.4, 0.6, fract(p.y * 9.0)), b = smoothstep(0.4, 0.6, fract(p.x * 9.0)); c *= 0.78 + 0.13 * (a + b); }
          else if (pat == 3) c *= 0.88 + 0.24 * pvn(p * vec3(45.0, 20.0, 45.0));
          else if (pat == 4) {   // (peds r3) bold print (florals / graphic prints): light motif on the base colour
            float m = smoothstep(0.6, 0.68, pvn(p * vec3(26.0, 22.0, 26.0) + 3.1)) + 0.6 * smoothstep(0.66, 0.72, pvn(p * vec3(52.0, 44.0, 52.0)));
            vec3 c2 = dot(c, vec3(0.33)) > 0.25 ? c * vec3(0.25, 0.3, 0.4) : mix(vec3(0.75, 0.7, 0.6), c.bgr * 3.0 + 0.1, 0.35);
            c = mix(c, c2, clamp(m, 0.0, 1.0));
          } else if (pat == 5) c = mix(c, vec3(0.74, 0.73, 0.7), step(0.55, fract(p.y * 11.0)) * step(1.0, p.y));   // breton stripe
          if (p.y > 1.455 && p.y < 1.49) c *= 0.82;                                          // neckline rib
          if (p.y < 1.0 && p.y > 0.975) c *= 0.85;                                           // hem
        } else if (R == 2) {
          bool denim = c.b > c.r * 1.25 && c.b > 0.012;
          if (denim) {
            c *= 0.9 + 0.16 * pvn(vec3(p.x * 60.0, p.y * 14.0, p.z * 60.0));
            float fade = smoothstep(0.55, 0.78, p.y) * smoothstep(0.93, 0.8, p.y) * step(0.0, p.z);
            c = mix(c, c * 1.7 + 0.01, fade * 0.45);
            if (abs(ax - 0.1) < 0.004 && front && p.y > 0.5) c *= 1.0;
          } else if (front && abs(ax - 0.1) < 0.005 && p.y < 0.84) c *= 1.25;               // trouser crease
          if (p.y < 0.14 && p.y > 0.1) c *= 0.8;                                             // cuff
        } else if (R == 4) {
          // (peds r1) photo hair strands (atlas 2x2 of 256 at (0.5, 0)): cylindrical about the head axis, 12 cm tiles
          float a = atan(p.x, p.z - 0.01);
          float hk = vPed.z; vec2 o = vec2(0.5 + (hk - floor(hk / 2.0) * 2.0) * 0.25, floor(hk / 2.0) * 0.25);
          vec3 t = tileTex(vec2(a * 0.09 / 0.12, (1.8 - p.y) / 0.12), o, 0.25) / 0.2158;
          c *= mix(vec3(1.0), t, 0.72) * (0.9 + 0.12 * smoothstep(1.6, 1.76, p.y));   // (peds r4) 0.5 -> 0.72 strand contrast
          // (peds r4) critic 'hair painted on, plastic': clumps (dark partings between locks along the fall direction) and
          // darker roots at the crown / nape, lighter sun-bleached ends; reads as locks at 5-15 m
          { float cl = pvn(vec3(a * 7.0, p.y * 3.0, 0.0)); c *= 0.72 + 0.5 * smoothstep(0.25, 0.75, cl);
            c *= mix(0.8, 1.0, smoothstep(0.03, 0.09, abs(ax) + max(0.0, -p.z) * 0.4)) * (1.0 + 0.18 * smoothstep(1.62, 1.35, p.y)); }
          if (p.y < 1.675 && p.z > 0.07) { vec4 ft = faceTex(p); c = mix(c, ft.rgb * vAOm, ft.a); }   // brows: from the photo
        } else if (R == 0 || R == 11 || R == 12 || (R == 7 && p.y > 1.6 && p.z < 0.084)) {
          if (p.y > 1.52 && p.z > 0.0) { vec4 ft = faceTex(p);   // (peds r5) blended edge: toward the rim keep the skin colour and take only the photo's shading (no mask outline)
            vec3 ph = ft.rgb * vAOm; float lp = dot(ph, vec3(0.3, 0.59, 0.11)), lc = dot(c, vec3(0.3, 0.59, 0.11));
            vec3 mt = c * clamp(lp / max(lc, 1e-4), 0.6, 1.3);
            c = mix(c, mix(mt, ph, smoothstep(0.45, 0.9, ft.a)), ft.a); }
          if (p.y > 1.655) {   // soft hairline: the scalp just under the hair shell edge takes the hair colour
            float hl = smoothstep(1.668, 1.688, p.y + (pvn(p * 160.0) - 0.5) * 0.012) * (1.0 - smoothstep(0.075, 0.09, p.z));
            c = mix(c, vHairC * 0.9, hl * 0.85);
          }
          if (R != 0) return c;
          c *= 0.96 + 0.08 * pvn(p * 25.0);
          if (p.y > 1.45) c *= mix(0.7, 1.0, smoothstep(1.53, 1.572, p.y + max(0.0, p.z) * 0.45));   // under the jaw / neck
          if (p.y > 1.5 && p.z < 0.03) { // (citylife r2) face modelling in paint ((peds r1) now only off the photo area) (heads read as smooth mannequin eggs): eye sockets, cheek /
            // nose-tip warmth, shade under the jaw and at the hairline, so the face reads at street distance
            float fr = smoothstep(0.03, 0.08, p.z);
            vec2 e = vec2(ax - 0.031, p.y - 1.645);
            c *= 1.0 - 0.28 * fr * exp(-dot(e * e, vec2(1.0 / 0.0005, 1.0 / 0.00022)));
            vec2 k = vec2(ax - 0.047, p.y - 1.605);
            c *= mix(vec3(1.0), vec3(1.07, 0.93, 0.9), fr * exp(-dot(k * k, vec2(1.0 / 0.0007, 1.0 / 0.0006))));
            c *= mix(vec3(1.0), vec3(1.05, 0.94, 0.92), smoothstep(0.09, 0.1, p.z) * step(p.y, 1.625));
            c *= 1.0 - 0.18 * smoothstep(1.7, 1.73, p.y);                                 // hairline shadow
          }
        }
        return c;
      }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = garment(vCol); if (gCut) discard;
        if (uBakeOn > 0.5) { gBake = texture(uBake, vBUv);   // (peds r2) baked occlusion replaces the per-vertex AO on base parts
          if (vOptF < 0.5) diffuseColor.rgb *= clamp((0.3 + 0.7 * gBake.a) / max(vAOm, 0.3), 0.35, 1.5); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = vRough;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (uBakeOn > 0.5) { vec3 bn = gBake.rgb * 2.0 - 1.0; float bl = length(bn);   // (peds r2) baked object-space (rest pose) normal, skinned
          if (bl > 0.6) { vec3 nb = normalize(mat3(vB0, vB1, vB2) * (bn / bl)); normal = normalize(mix(normal, nb, smoothstep(-0.25, 0.35, dot(nb, normal)))); } }
        if (gH != 0.0) normal = bumpN(-vViewPosition, normal, gH);`) // (peds r1) cloth folds
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(0.55, 0.75, 1.0) * vEmis * 0.25;');
  };
  mat.customProgramCacheKey = () => 'city-people-v8';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${common}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = optHidden() ? vec3(0.0) : (skinMatrix() * vec4(bodyShape(position), 1.0)).xyz;');
  };
  depth.customProgramCacheKey = () => 'city-people-depth-v2';
  // (night) city-light shadows (citylights.js addCaster): a distance material patched like the depth one (skinning +
  // body shape animate), so people near a street lamp / headlight cast a real shadow on the sidewalk
  const dist = new THREE.MeshDistanceMaterial();
  dist.onBeforeCompile = depth.onBeforeCompile;
  dist.customProgramCacheKey = () => 'city-people-dist-v1';
  return { mat, depth, dist, uni };
}

// ------------------------------------------------------------------ instanced pool per (variant, LOD)
class PeoplePool {
  constructor(geo, mat, depth, max, shadow, name) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.customDepthMaterial = depth;
    this.mesh.name = name; this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow; this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // (perf r2) per-frame bounds of the live instances: three culls the whole pool per camera (main + each shadow
    // cascade) instead of drawing all ~23 variants x LODs in every cascade. userData.dynamic: csm must not cache its box
    this.mesh.frustumCulled = true; this.mesh.userData.dynamic = true;
    this.mesh.boundingSphere = new THREE.Sphere(); this.bb = new Float32Array(6);
    // (perf r2) the 5 per-instance vec4s share ONE interleaved buffer (stride 20): 2 uploads per pool per frame, not 6
    this.ib = new THREE.InstancedInterleavedBuffer(new Float32Array(max * 20), 20).setUsage(THREE.DynamicDrawUsage);
    ['iA', 'iB', 'iX', 'iC', 'iM'].forEach((k, j) => geo.setAttribute(k, new THREE.InterleavedBufferAttribute(this.ib, 4, j * 4)));
    this.max = max; this.n = 0;
  }
  push(p, x, y, z) {
    if (this.n >= this.max) return;
    const k = this.n++, e = this.mesh.instanceMatrix.array, o = k * 16;
    const c = Math.cos(p.ry) * p.scale, s = Math.sin(p.ry) * p.scale, wx = 1, wz = 1; // (peds r3) build is now the shader's girth (bodyShape), not a width scale
    e[o] = c * wx; e[o + 1] = 0; e[o + 2] = -s * wx; e[o + 3] = 0;
    e[o + 4] = 0; e[o + 5] = p.scale; e[o + 6] = 0; e[o + 7] = 0;
    e[o + 8] = s * wz; e[o + 9] = 0; e[o + 10] = c * wz; e[o + 11] = 0;
    e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
    const b = this.bb; // (perf r2) bounds
    if (k === 0) { b[0] = b[3] = x; b[1] = b[4] = y; b[2] = b[5] = z; }
    else { if (x < b[0]) b[0] = x; else if (x > b[3]) b[3] = x; if (y < b[1]) b[1] = y; else if (y > b[4]) b[4] = y; if (z < b[2]) b[2] = z; else if (z > b[5]) b[5] = z; }
    const I = this.ib.array, q = k * 20, pA = p.A, pB = p.B, pc = p.cols; // (perf r2) iA iB iX iC iM, interleaved
    I[q] = pA[0]; I[q + 1] = pA[1]; I[q + 2] = pA[2]; I[q + 3] = pA[3];
    I[q + 4] = pB[0]; I[q + 5] = pB[1]; I[q + 6] = pB[2]; I[q + 7] = pB[3];
    I[q + 8] = p.blend; I[q + 9] = p.lookYaw; I[q + 10] = p.lookPitch; I[q + 11] = p.code || 0;
    I[q + 12] = pc[0]; I[q + 13] = pc[1]; I[q + 14] = pc[2]; I[q + 15] = pc[3];
    I[q + 16] = p.skin; I[q + 17] = p.hair; I[q + 18] = p.shoe; I[q + 19] = p.flash;
  }
  begin() { this.n = 0; }
  end() {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;   // (citylife r1) empty pools cost no draw call / shadow pass
    // upload only the live instances. NB: a 0-length range must never reach bufferSubData (WebGL2 treats srcLength 0
    // as "to the end of the array" -> the whole buffer would upload every frame for empty pools)
    if (!this.n) return;
    { const b = this.bb, sp = this.mesh.boundingSphere; // (perf r2) + 2 m: body height (scaled), stride, dog / umbrella
      sp.center.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2 + 0.9, (b[2] + b[5]) / 2);
      sp.radius = 0.5 * Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) + 2.0; }
    this.mesh.instanceMatrix.clearUpdateRanges(); this.mesh.instanceMatrix.addUpdateRange(0, this.n * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.ib.clearUpdateRanges(); this.ib.addUpdateRange(0, this.n * 20); this.ib.needsUpdate = true; // (perf r2)
  }
}

function buildGeometry(bin, L) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, L.pos, L.nv * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bin, L.nrm, L.nv * 3), 3));
  const reg = new Uint8Array(bin, L.reg, L.nv), ao = new Uint8Array(bin, L.ao, L.nv), ra = new Uint8Array(L.nv * 3);
  const opt = L.opt !== undefined ? new Uint8Array(bin, L.opt, L.nv) : null; // (peds r2) optional-part bit
  for (let i = 0; i < L.nv; i++) { ra[i * 3] = reg[i]; ra[i * 3 + 1] = ao[i]; ra[i * 3 + 2] = opt ? opt[i] : 0; }
  g.setAttribute('aRA', new THREE.BufferAttribute(ra, 3));
  g.setAttribute('aSI', new THREE.BufferAttribute(new Uint8Array(bin, L.si, L.nv * 4), 4));
  g.setAttribute('aSW', new THREE.BufferAttribute(new Uint8Array(bin, L.sw, L.nv * 4), 4, true));
  // (peds r2) bake-atlas uv + optional-part bit (older assets: zeros)
  g.setAttribute('aUV', L.uv !== undefined ? new THREE.BufferAttribute(new Uint16Array(bin, L.uv, L.nv * 2), 2, true) : new THREE.BufferAttribute(new Uint16Array(L.nv * 2), 2, true));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(bin, L.idx, L.nt * 3), 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1.2);
  return g;
}

// ------------------------------------------------------------------ dogs (citylife r1)
// Rigid-part dog mesh (tools/blender/city_npc.py build_dog) animated in the vertex shader: diagonal leg pairs swing about
// their hip / shoulder pivots with the gait phase, the tail wags, the head bobs. Each dog follows its owner at the
// owner's left side; a thin instanced leash runs from the owner's left hand to the collar.
function createDogs(scene, bin, D) {
  const PV = D.pivots, PT = D.parts;
  const glsl = `
    attribute vec4 aSI; attribute vec4 iD;
    vec3 dogPose(vec3 p) {
      int part = int(aSI.x + 0.5);
      float ph = iD.x, amp = iD.y;
      if (part == ${PT.legFL} || part == ${PT.legFR} || part == ${PT.legBL} || part == ${PT.legBR}) {
        vec3 pv = part == ${PT.legFL} ? vec3(${PV.legFL.join(',')}) : part == ${PT.legFR} ? vec3(${PV.legFR.join(',')})
          : part == ${PT.legBL} ? vec3(${PV.legBL.join(',')}) : vec3(${PV.legBR.join(',')});
        float o = (part == ${PT.legFL} || part == ${PT.legBR}) ? 0.0 : 3.14159;
        float a = sin(ph + o) * 0.5 * amp;
        vec3 q = p - pv; float c = cos(a), s = sin(a);
        q = vec3(q.x, c * q.y - s * q.z, s * q.y + c * q.z);
        q.y += max(0.0, cos(ph + o)) * 0.03 * amp;          // lift the swinging paw
        return pv + q;
      }
      if (part == ${PT.tail}) {
        vec3 pv = vec3(${PV.tail.join(',')}); vec3 q = p - pv;
        float a = sin(iD.w * 9.0) * 0.45; float c = cos(a), s = sin(a);
        q = vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z);
        return pv + q;
      }
      p.y += sin(ph * 2.0) * 0.012 * amp;
      if (part == ${PT.head}) { vec3 pv = vec3(${PV.head.join(',')}); vec3 q = p - pv; float a = sin(iD.w * 0.7) * 0.25 * (1.0 - amp);
        float c = cos(a), s = sin(a); q = vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z); p = pv + q; }
      return p;
    }`;
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      ${glsl}
      attribute vec2 aRA; varying vec3 vDCol; varying vec3 vDP;
      vec3 unpackD(float f) { float r = floor(f / 65536.0); float g = floor((f - r * 65536.0) / 256.0); float b = f - r * 65536.0 - g * 256.0; vec3 c = vec3(r, g, b) / 255.0; return c * c; }`)
      .replace('#include <begin_vertex>', `vec3 transformed = dogPose(position);
        { int R = int(aRA.x + 0.5); vec3 fur = unpackD(iD.z); vec3 c = fur;
          if (R == 7) c = vec3(0.012); else if (R == 6) c = vec3(0.3, 0.03, 0.03); else if (R == 8) c = mix(fur, vec3(0.6, 0.55, 0.48), 0.5);
          vDCol = c * (0.35 + 0.65 * aRA.y / 255.0); vDP = position; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vDCol; varying vec3 vDP;
      float dh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = vDCol * (0.9 + 0.2 * dh(floor(vDP * 140.0)));');
  };
  mat.customProgramCacheKey = () => 'city-dog-v1';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${glsl}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = dogPose(position);');
  };
  depth.customProgramCacheKey = () => 'city-dog-depth-v1';
  const dist = new THREE.MeshDistanceMaterial(); // (night) city-light shadows (LOD0)
  dist.onBeforeCompile = depth.onBeforeCompile; dist.customProgramCacheKey = () => 'city-dog-dist-v1';
  const MAXD = [60, 200];
  const pools = D.lods.map((L, li) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, L.pos, L.nv * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bin, L.nrm, L.nv * 3), 3));
    const reg = new Uint8Array(bin, L.reg, L.nv), ao = new Uint8Array(bin, L.ao, L.nv), ra = new Uint8Array(L.nv * 2);
    for (let i = 0; i < L.nv; i++) { ra[i * 2] = reg[i]; ra[i * 2 + 1] = ao[i]; }
    g.setAttribute('aRA', new THREE.BufferAttribute(ra, 2));
    g.setAttribute('aSI', new THREE.BufferAttribute(new Uint8Array(bin, L.si, L.nv * 4), 4));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(bin, L.idx, L.nt * 3), 1));
    const iD = new THREE.InstancedBufferAttribute(new Float32Array(MAXD[li] * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iD', iD);
    const m = new THREE.InstancedMesh(g, mat, MAXD[li]);
    m.customDepthMaterial = depth; m.name = 'dogs-L' + li; m.count = 0; m.frustumCulled = false; m.castShadow = li === 0; m.receiveShadow = true;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
    if (li === 0) cityLights.addCaster(m, dist); // (night)
    return { m, iD, n: 0, max: MAXD[li] };
  });
  // leash: unit cylinder along +y, stretched between hand and collar
  const lg = new THREE.CylinderGeometry(0.006, 0.006, 1, 4, 1, true); lg.translate(0, 0.5, 0);
  const leash = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 }), 60);
  leash.name = 'dog-leash'; leash.count = 0; leash.frustumCulled = false; leash.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(leash);
  let nl = 0;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V0 = new THREE.Vector3(), V1 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), SC = new THREE.Vector3();
  return {
    begin() { for (const p of pools) p.n = 0; nl = 0; },
    push(a, y, lod, time) {
      const P = pools[lod], d = a.dog;
      if (P.n >= P.max) return;
      const moving = a.clip.startsWith('walk') || a.clip === 'run' || a.clip === 'flee';
      const dt = d.t < 0 ? 0 : Math.min(0.25, time - d.t); d.t = time;
      const sp = moving ? a.speed : 0;   // owner ground speed
      d.amp = (d.amp ?? 0) + ((moving ? 1 : 0) - (d.amp ?? 0)) * Math.min(1, dt * 4);
      d.ph += dt * (sp / (0.62 * d.s)) * 6.2832;
      const c = Math.cos(a.ry), s = Math.sin(a.ry), k = P.n++;
      const lx = 0.5, lz = 0.95 + 0.1 * Math.sin(time * 0.6 + d.col);   // owner-local: left side, a leash length ahead
      const x = a.x + lx * c + lz * s, z = a.z - lx * s + lz * c;
      const ds = d.s;
      const e = P.m.instanceMatrix.array, o = k * 16;
      e[o] = c * ds; e[o + 1] = 0; e[o + 2] = -s * ds; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = ds; e[o + 6] = 0; e[o + 7] = 0;
      e[o + 8] = s * ds; e[o + 9] = 0; e[o + 10] = c * ds; e[o + 11] = 0; e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
      const D4 = P.iD.array; D4[k * 4] = d.ph; D4[k * 4 + 1] = d.amp; D4[k * 4 + 2] = d.col; D4[k * 4 + 3] = time + d.col * 1e-7;
      if (nl < 60) { // hand (owner-local 0.25, 0.86, 0.12) -> collar (dog-local 0, 0.6, 0.3)
        const hx = 0.25 * a.scale, hz = 0.12 * a.scale;
        V0.set(a.x + hx * c + hz * s, y + 0.81 * a.scale, a.z - hx * s + hz * c); // (peds r1) 0.86 -> 0.81: shorter legs
        V1.set(x + 0.3 * ds * s, y + 0.6 * ds, z + 0.3 * ds * c);
        V1.sub(V0); const len = V1.length(); V1.divideScalar(len || 1);
        Q.setFromUnitVectors(UP, V1); SC.set(1, len, 1); M4.compose(V0, Q, SC); M4.toArray(leash.instanceMatrix.array, nl * 16); nl++;
      }
    },
    end() {
      for (const P of pools) {
        P.m.count = P.n; P.m.visible = P.n > 0;
        if (!P.n) continue;
        P.m.instanceMatrix.clearUpdateRanges(); P.m.instanceMatrix.addUpdateRange(0, P.n * 16); P.m.instanceMatrix.needsUpdate = true;
        P.iD.clearUpdateRanges(); P.iD.addUpdateRange(0, P.n * 4); P.iD.needsUpdate = true;
      }
      leash.count = nl; leash.visible = nl > 0;
      if (nl) { leash.instanceMatrix.clearUpdateRanges(); leash.instanceMatrix.addUpdateRange(0, nl * 16); leash.instanceMatrix.needsUpdate = true; }
    },
  };
}

// ------------------------------------------------------------------ contact shadows (peds r2)
// Critic: 'no contact shadows, figures look pasted on'. One instanced draw for every person within BLOB_D m: a soft
// ellipse under the hips plus one under each foot. The feet are placed on the GPU from the same baked animation rows
// as the body (clip A, bones footL / footR) and fade as a foot lifts, so the dark patch follows the planted foot.
const BLOB_D = 62, BLOB_MAX = 700;
function createBlobs(scene, animTex, meta) {
  const q = [], idx = [];
  for (let part = 0; part < 3; part++) {
    const o = part * 4; q.push(-1, -1, part, 1, -1, part, 1, 1, part, -1, 1, part); idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(q, 3)); g.setIndex(idx);
  const ib = new THREE.InstancedInterleavedBuffer(new Float32Array(BLOB_MAX * 12), 12).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iP', new THREE.InterleavedBufferAttribute(ib, 4, 0));
  g.setAttribute('iS', new THREE.InterleavedBufferAttribute(ib, 4, 4));
  g.setAttribute('iA', new THREE.InterleavedBufferAttribute(ib, 4, 8));
  g.instanceCount = 0;
  const H = (i) => new THREE.Vector3(...meta.bones[i].head);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uAnim: { value: animTex }, uTime: { value: 0 }, uHip: { value: H(0) }, uFL: { value: H(13) }, uFR: { value: H(16) } },
    vertexShader: `
      attribute vec4 iP; attribute vec4 iS; attribute vec4 iA;
      uniform sampler2D uAnim; uniform float uTime; uniform vec3 uHip; uniform vec3 uFL; uniform vec3 uFR;
      varying vec2 vQ; varying float vA; varying float vP;
      mat4 bmRow(int row, int b) {
        ivec2 c = ivec2(b * 3, row);
        vec4 r0 = texelFetch(uAnim, c, 0), r1 = texelFetch(uAnim, c + ivec2(1, 0), 0), r2 = texelFetch(uAnim, c + ivec2(2, 0), 0);
        return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
      }
      void main() {
        int part = int(position.z + 0.5);
        float fr = mod((uTime - iA.w) * iA.z * 30.0, iA.y); if (fr < 0.0) fr += iA.y;
        int f0 = int(floor(fr)); int f1 = f0 + 1; if (float(f1) >= iA.y) f1 = 0; float t = fract(fr);
        int b = part == 0 ? 0 : part == 1 ? 13 : 16; vec3 j = part == 0 ? uHip : part == 1 ? uFL : uFR; int r = int(iA.x + 0.5);
        vec3 wp = ((bmRow(r + f0, b) * (1.0 - t) + bmRow(r + f1, b) * t) * vec4(j, 1.0)).xyz;
        float h = part == 0 ? 0.0 : max(0.0, wp.y - uFL.y);
        vec2 rad = part == 0 ? vec2(0.36, 0.32) : vec2(0.085, 0.17) * (1.0 + h * 2.5); // (peds r4) 0.3/0.27, 0.075/0.15
        vec2 lp = (part == 0 ? wp.xz * 0.5 : wp.xz + vec2(0.0, 0.045)) + position.xy * rad;
        float c = cos(iP.w), s = sin(iP.w);
        vec2 xz = vec2(c * lp.x * iS.y + s * lp.y, -s * lp.x * iS.y + c * lp.y) * iS.x;
        vQ = position.xy;
        // (peds r4) critic r3 still saw 'floating' peds under the darker grade: stronger, tighter contact (feet 0.9 with a
        // hard core, hip 0.62 wide soft halo) -- was 0.48 / 0.62 (contactAO, lighting2 r3)
        vA = (part == 0 ? 0.72 : 0.95 * (1.0 - smoothstep(0.03, 0.18, h))) * iS.z; vP = float(part);
        gl_Position = projectionMatrix * viewMatrix * vec4(iP.x + xz.x, iP.y + 0.015, iP.z + xz.y, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vQ; varying float vA; varying float vP;
      void main() {
        float d = length(vQ);
        // (peds r4) hip: gaussian-ish halo; feet: dark core right under the sole + soft rim
        float a = vP < 0.5 ? vA * exp(-d * d * 2.2) * (1.0 - smoothstep(0.75, 1.0, d)) : vA * (1.0 - smoothstep(0.05, 1.0, d)) * (1.0 - 0.35 * smoothstep(0.3, 1.0, d));
        if (a < 0.004) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'people-contact'; mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.castShadow = false; mesh.receiveShadow = false;
  scene.add(mesh);
  let n = 0;
  return {
    mat, mesh,
    begin() { n = 0; },
    push(a, y, d) {
      if (n >= BLOB_MAX) return;
      const I = ib.array, k = n++ * 12;
      I[k] = a.x; I[k + 1] = y; I[k + 2] = a.z; I[k + 3] = a.ry;
      I[k + 4] = a.scale; I[k + 5] = a.wid || 1; I[k + 6] = 1 - Math.max(0, (d - BLOB_D + 14) / 14); I[k + 7] = 0;
      I[k + 8] = a.A[0]; I[k + 9] = a.A[1]; I[k + 10] = a.A[2]; I[k + 11] = a.A[3];
    },
    end() {
      g.instanceCount = n; mesh.visible = n > 0;
      if (n) { ib.clearUpdateRanges(); ib.addUpdateRange(0, n * 12); ib.needsUpdate = true; }
    },
  };
}

// ------------------------------------------------------------------ crowd
export async function createCrowd({ scene, blocks, parkPaths, props, roads, phase }) {
  const [meta, bin, pedTex, bakeTex] = await Promise.all([
    fetch('/assets/city/npc/people.json').then(r => r.json()),
    fetch('/assets/city/npc/people.bin').then(r => r.arrayBuffer()),
    new THREE.TextureLoader().loadAsync('/assets/city/tex/peds_atlas.webp').catch(() => null), // (peds r1) faces / hair / fabric
    new THREE.TextureLoader().loadAsync('/assets/city/npc/people_bake.webp').catch(() => null), // (peds r2) Cycles cloth normal + AO
  ]);
  if (!meta || typeof meta !== 'object' || !Number.isInteger(meta.anim) || meta.anim < 0 ||
      !Number.isInteger(meta.frames) || meta.frames <= 0 || !Number.isInteger(meta.nb) || meta.nb <= 0 ||
      !Array.isArray(meta.variants) || typeof meta.clips !== 'object' ||
      !(bin instanceof ArrayBuffer) || meta.anim + meta.frames * meta.nb * 12 * 4 > bin.byteLength) {
    throw new Error('Invalid or corrupted NPC crowd data');
  }
  if (bakeTex) { bakeTex.flipY = false; bakeTex.colorSpace = THREE.NoColorSpace; bakeTex.anisotropy = 4; bakeTex.needsUpdate = true; }
  const useBake = !!bakeTex && !!meta.bake && meta.variants[0]?.lods[0]?.uv !== undefined;
  const animData = new Float32Array(bin, meta.anim, meta.frames * meta.nb * 12);
  const animTex = new THREE.DataTexture(animData, meta.nb * 3, meta.frames, THREE.RGBAFormat, THREE.FloatType);
  animTex.minFilter = animTex.magFilter = THREE.NearestFilter; animTex.needsUpdate = true;
  const ped = pedTex || new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  ped.flipY = false; ped.colorSpace = THREE.SRGBColorSpace; ped.anisotropy = 4; ped.needsUpdate = true;
  const { mat, depth, dist, uni } = makeMaterials(animTex, meta, ped, useBake ? bakeTex : null);
  const CL = {};
  for (const [k, c] of Object.entries(meta.clips)) CL[k] = c;
  const variants = meta.variants;
  const pools = variants.map((v, vi) => v.lods.map((L, li) => {
    const p = new PeoplePool(buildGeometry(bin, L), mat, depth, LOD_MAX[li], li < 2, `people-${v.name}-L${li}`);
    // (perf r2) 23 variants x 2 LODs = 46 shadow draws per cascade -> 23: LOD0 (< 24 m) casts into cascades 0-1 only,
    // LOD1 (24-70 m) into 1-2 only (cascade 0 covers < ~14 m, cascade 2 > ~50 m: only very long low-sun shadows differ)
    if (!perf2Off('nocrowdopt')) { if (li === 0) p.mesh.userData.maxCascade = 1; else if (li === 1) p.mesh.userData.minCascade = 1; }
    scene.add(p.mesh);
    if (li === 0) cityLights.addCaster(p.mesh, dist); // (night) LOD0 (< 24 m) people cast city-light (lamp / headlight) shadows
    return p;
  }));
  const allPools = pools.flat();
  const dogs = meta.dog ? createDogs(scene, bin, meta.dog) : null;   // (citylife r1) dog walkers
  const blobs = /[?&]noblob/.test(typeof location !== 'undefined' ? location.search : '') ? null : createBlobs(scene, animTex, meta); // (peds r2) contact shadows
  const femaleV = [], maleV = [];
  variants.forEach((v, i) => (v.female ? femaleV : maleV).push(i));
  const wsum = (L) => L.reduce((t, i) => t + (VWEIGHT[variants[i].name] ?? 1), 0);
  const wF = wsum(femaleV), wM = wsum(maleV);
  const HSCALE = meta.legK ? 1 / (1 - (1 - meta.legK) * 0.52) : 1; // (peds r1) shorter legs: keep the overall height
  const pickV = (L, tot, r) => { let x = r() * tot; for (const i of L) if ((x -= VWEIGHT[variants[i].name] ?? 1) <= 0) return i; return L[L.length - 1]; };

  let time = 0;
  const agents = [];           // all live agents
  const player = { pos: new THREE.Vector3(1e9, 0, 0), vel: new THREE.Vector3(), air: false, ground: 0, landT: -9, landPos: null, t: 0 };
  let alarms = [];
  const zones = new Map();      // persistent danger zones (active crimes): key -> {x, z, r, active}

  // ---- agent factory
  const newAgent = (seed, extra) => {
    const r = mulberry32(seed);
    const vi = r() < 0.5 ? pickV(femaleV, wF, r) : pickV(maleV, wM, r);
    const v = variants[vi];
    const fit = outfitFor(v, r);
    const skin = Math.min(0.999, SKIN[Math.floor(r() * SKIN.length)] * 0 + Math.pow(r(), 1.3)); // (kept: preserves the RNG stream)
    // (peds r1) face from the photo atlas (by sex) + tone jitter; hair strand tile by hairstyle, colour plausible for the face
    const rf = mulberry32(Math.imul(seed ^ 0x5bd1e995, 2246822519) >>> 0), FL = v.female ? FACES_F : FACES_M;
    let face = FL[Math.floor(rf() * FL.length)]; if (v.old) face = FACES_OLD[Math.floor(rf() * FACES_OLD.length)]; // (peds r3) elder variant: grey-haired face
    const fh = FACE_HAIR[face];
    const hk = fh === 'g' ? 0.95 + rf() * 0.04 : fh === 'a' ? rf() * 0.92 : rf() * 0.55;
    // (peds r2) optional parts: one of the variant's 3 hairstyles, hat / glasses / bag / scarf toggles (own RNG stream)
    const r3 = mulberry32(Math.imul(seed ^ 0x27d4eb2f, 1597334677) >>> 0), hs = v.hairs || [v.hair || (v.female ? 'long' : 'short')];
    const xh = r3(); let hi = xh < 0.46 ? 0 : xh < 0.76 ? 1 : 2; if (hi >= hs.length) hi = 0;
    let mask = hs[hi] === 'bald' || (!v.female && r3() < 0.05) ? 0 : 1 << hi;
    if (r3() < (v.hat ? 0.5 : v.female ? 0.1 : 0.16)) mask |= 8;
    if (r3() < (v.glasses ? 0.7 : 0.09)) mask |= 16;
    if (v.optBag && r3() < 0.5) mask |= 32;
    if (v.optScarf && r3() < 0.28) mask |= 64;
    // (peds r3) body type + age + gait (own stream r4, so the draws above keep their values). Critic: 'no body-type
    // variety (heavy, short, elderly)', 'everyone walks the same', 'no props (coffee)'
    const r4 = mulberry32(Math.imul(seed ^ 0x165667b1, 2654435761) >>> 0), bt = r4();
    let girth, htk;
    if (bt < 0.17) { girth = 1.12 + r4() * 0.22; htk = 0.97 + r4() * 0.06; }         // heavy
    else if (bt < 0.3) { girth = 0.84 + r4() * 0.07; htk = 1.04 + r4() * 0.05; }     // tall + slim
    else if (bt < 0.44) { girth = 0.95 + r4() * 0.13; htk = 0.87 + r4() * 0.05; }    // short
    else { girth = 0.93 + r4() * 0.14; htk = 0.96 + r4() * 0.08; }                  // average
    const old = !!v.old || (fh === 'g' && r4() < 0.75);
    if (old) htk *= 0.97;
    const gstyle = r4(), cup = !!v.optCup && r4() < 0.13;
    if (cup) mask |= 128;
    const ht = HAIR_TEX[hs[hi]] || HAIR_TEX[v.hair] || [3];
    const hairT = ht[Math.floor(rf() * ht.length)];
    r3(); // (peds r2 build width draw, kept for the stream; (peds r3) body type below)
    const a = {
      rng: r, vi, slot: (seed * 7) % 12, x: 0, y: G.CURB_H, z: 0, ry: r() * 6.28, scale: ((v.female ? 0.93 : 0.99) + (r() - 0.5) * 0.04) * htk * HSCALE, wid: girth, girth, old, // (peds r3) body types
      speed: SPEED_WALK[0] + r() * (SPEED_WALK[1] - SPEED_WALK[0]),
      A: [0, 1, 1, 0], B: [0, 1, 1, 0], blend: -10, lookYaw: 0, lookPitch: 0, flash: 0, clip: '',
      cols: fit.cols, code: fit.code + 512 * mask, mask, wc: CL[v.walk] ? v.walk : 'walk', skin: face + (0.25 + 0.7 * skin) * 0.999, hair: hairT * 2 + hk + 0 * r(), shoe: Math.round((girth - 0.8) * 100) + Math.min(0.999, r() < 0.3 ? 0.9 + r() * 0.1 : r() * 0.8), // (peds r3) iM.z: girth code + shoe tone
      mode: 'walk', dead: false, interest: r(), reactKind: null, reactT: 0, react: null, dodgeX: 0, dodgeZ: 0, lookW: 0,
      ...extra,
    };
    a.A = new Float32Array(a.A); a.B = new Float32Array(a.B); a.seed = seed; a.hi = hi;
    { // (citylife r2) per-person standing idle (hands in pockets / arms crossed / hand on hip) and phone-reading walkers;
      // own RNG stream so the outfit / speed draws above stay as they were
      const r2 = mulberry32(Math.imul(seed, 2654435761) >>> 0), carry = a.wc === 'walkCarry', x = r2();
      a.ic = carry || x < 0.34 ? (x < 0.24 ? 'idleShift' : 'idle') : x < (v.female ? 0.55 : 0.66) ? 'idlePockets' : x < (v.female ? 0.75 : 0.88) ? 'idleCrossed' : 'idleHip';
      if (cup && a.ic !== 'idle') a.ic = 'idleShift';   // (peds r3) the cup hand stays out of pockets / crossed arms
      if (!CL[a.ic]) a.ic = 'idle';
      if (!carry && !cup && CL.walkPhone && r2() < 0.13) { a.wc = 'walkPhone'; a.speed *= 0.85; } // (peds r4) 0.08 -> 0.13 (critic: 'no phone users')
      // (peds r3) gait by pace: strollers (short steps, loose arms), brisk commuters (long stride, big arm swing), and
      // older people (stooped, short shuffling steps, hands behind the back when waiting). walkRate follows each
      // clip's measured stride, so the feet stay planted at every speed
      else if (old && CL.walkOld) { a.wc = 'walkOld'; a.speed = 0.6 + gstyle * 0.25; if (CL.idleOld && x < 0.7) a.ic = 'idleOld'; }
      else if ((a.wc === 'walk' || (a.wc === 'walkF' && gstyle > 0.5)) && CL.walkBrisk) {
        const g2 = a.wc === 'walkF' ? (gstyle - 0.5) * 2 : gstyle;
        if (g2 < 0.22) { a.wc = 'walkStroll'; a.speed = 0.75 + g2 * 0.8; }
        else if (g2 < 0.5) { a.wc = 'walkBrisk'; a.speed = 1.35 + (g2 - 0.22) * 0.9; }
      }
    }
    { // (peds r4) sidewalk behaviours (critic: 'no tourists taking photos / pointing, nobody stops'): tourists stop every
      // 15-45 s to photograph / point / look up at the buildings; a few locals stop to answer a text. Own RNG stream.
      const r5 = mulberry32(Math.imul(seed ^ 0x2c1b3c6d, 3266489917) >>> 0), q = r5();
      a.stopper = a.old ? 0 : q < 0.13 ? 1 : q < 0.21 ? 2 : 0; a.nextStop = 4 + r5() * 40; a.stopT = 0;
    }
    return a;
  };
  // (peds r2) anti-clone: nobody shares variant + hairstyle with anyone within DECLONE_R m (critic: 'the same camel
  // trench-coat woman 4-5 times'); clashing newcomers are re-dressed from a derived seed (up to 5 tries)
  const DECLONE_R = 20, LOOK = ['vi', 'wid', 'girth', 'old', 'cols', 'code', 'mask', 'skin', 'hair', 'shoe', 'wc', 'ic', 'hi'];
  const redress = (a, salt) => {
    const b = newAgent((Math.imul(a.seed, 31) + salt * 7919 + 13) >>> 0, {});
    for (const k of LOOK) a[k] = b[k];
    a.scale = b.scale; a.clip = '';
    if (!a.jog && (a.mode === 'walk' || a.mode === 'path' || a.mode === 'prom' || a.mode === 'wander')) a.speed = b.speed; // (peds r3) gait speed goes with the clip
  };
  const dgrid = new Map(), dkey = (x, z) => (Math.floor(x / DECLONE_R) + 4096) * 8192 + (Math.floor(z / DECLONE_R) + 4096);
  const declone = (list) => {
    if (!list.length) return;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const a of list) { x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); z0 = Math.min(z0, a.z); z1 = Math.max(z1, a.z); }
    x0 -= DECLONE_R; x1 += DECLONE_R; z0 -= DECLONE_R; z1 += DECLONE_R;
    dgrid.clear();
    const add = (b) => { const k = dkey(b.x, b.z); let c = dgrid.get(k); if (!c) dgrid.set(k, c = []); c.push(b); };
    for (const L of [agents, statics]) for (const b of L) if (b.x > x0 && b.x < x1 && b.z > z0 && b.z < z1 && !b.dead) add(b);
    const clash = (a) => {
      const ix = Math.floor(a.x / DECLONE_R), iz = Math.floor(a.z / DECLONE_R);
      for (let i = ix - 1; i <= ix + 1; i++) for (let j = iz - 1; j <= iz + 1; j++) {
        const c = dgrid.get((i + 4096) * 8192 + (j + 4096)); if (!c) continue;
        for (const b of c) if (b !== a && b.vi === a.vi && b.hi === a.hi && (b.x - a.x) ** 2 + (b.z - a.z) ** 2 < DECLONE_R * DECLONE_R) return true;
      }
      return false;
    };
    for (const a of list) {
      if (a.dog) continue;
      let t = 0; while (t < 5 && clash(a)) redress(a, ++t);
      if (t) initPose(a);
    }
  };
  // (citylife r1) some walkers have a dog on a leash (left hand, so they use the 'walkCarry' clip)
  const DOGC = [0xb88a4a, 0x151412, 0x4a2e1e, 0xd8cdb8, 0x6d6a66, 0x9a6e44, 0x2a211a, 0xc9a26a].map(lin);
  const maybeDog = (a, p) => {
    if (!dogs || a.rng() > p) return;
    a.dog = { col: pack(DOGC[Math.floor(a.rng() * DOGC.length)]), s: 0.72 + a.rng() * 0.4, ph: a.rng() * 6.28, t: -1 };
    if (CL.walkCarry) a.wc = 'walkCarry';
    a.speed *= 0.88;
  };
  const setClip = (a, name, rate = 1, phase0 = null) => {
    if (name === 'walk' && a.wc !== 'walk') { name = a.wc; if (!CL[name].stride) { if (name === 'walkF') rate *= 1.04; else if (name === 'walkPhone') rate *= 1.33; } } // (citylife r1) per-variant walk style ((peds r2) measured strides: walkRate)
    else if (name === 'idle' && a.ic) name = a.ic; // (citylife r2) personal idle
    if (a.clip === name && Math.abs(a.A[2] - rate) < 0.05) return;
    const c = CL[name];
    const t0 = phase0 === null ? time - a.rng() * 10 : phase0;
    if (a.clip) { a.B.set(a.A); a.blend = time; } else a.blend = -10;
    if (a.clip === name) { // same clip, new rate: keep the phase continuous
      const fr = ((time - a.A[3]) * a.A[2] * 30) % c.len;
      a.A[2] = rate; a.A[3] = time - fr / (rate * 30 || 1); a.blend = -10; return;
    }
    a.A[0] = c.row; a.A[1] = c.len; a.A[2] = rate; a.A[3] = t0;
    a.clip = name;
  };
  // (peds r3) conversation roles (critic: 'chat pairs facing each other with gestures'): the first member of a group
  // talks with both hands, the others mostly listen (nods, hands clasped) or chip in; loners check phones / wait
  const clipOr = (x, fb) => CL[x] ? x : fb;
  const chatClip = (k, n, r) => n === 1 ? (r() < 0.6 ? 'phone' : 'idle')
    : k === 0 ? (r() < 0.65 ? clipOr('talk2', 'talk') : 'talk')
    : (r() < 0.55 ? clipOr('listen', 'idle') : r() < 0.45 ? 'talk' : r() < 0.4 ? 'phone' : 'idle');
  // (peds r2) playback rate from the clip's measured stride (city_npc.py clip_stride): the planted foot stays put
  const walkRate = (a, v) => { const c = CL[a.wc]; return c && c.stride ? v / (c.stride * a.scale) * (c.len / 30) : v / (STRIDE * a.scale) * (32 / 30); };
  const runRate = (a, v) => v / (RUN_STRIDE * a.scale) * (19 / 30);

  // ---- blocks: indexing, rings, neighbours
  // (block grid indices come from layout.buildBlocks: ci = avenue index to the west, rj = street index to the north)
  const bmap = new Map();
  for (const b of blocks) {
    b.rj0 = b.rj; b.rj1 = b.rj + (b.split ? 2 : 1);
    b.cx = (b.x0 + b.x1) / 2; b.cz = (b.z0 + b.z1) / 2;
    b.hx = (b.x1 - b.x0) / 2; b.hz = (b.z1 - b.z0) / 2;
    b.drive = false;
    for (let j = b.rj0; j < b.rj1; j++) bmap.set(b.ci * 1000 + j, b);
    b.agents = null;
  }
  const blockAt = (ci, j) => bmap.get(ci * 1000 + j) || null;
  const ringOf = (b, e) => ({ x0: b.x0 + e, z0: b.z0 + e, x1: b.x1 - e, z1: b.z1 - e, w: b.x1 - b.x0 - 2 * e, h: b.z1 - b.z0 - 2 * e });
  // (peds r4) walking together (critic: 'isolated singles, add groups of 2-4 walking together'): a ring walker gets a
  // companion (sometimes two) side by side at the same pace; stepWalker keeps the mate's speed in sync
  const mates = (a, b, seed, r, tier) => {
    if (a.dog || a.stopper === 1 || r() > (b.core ? 0.2 : 0.14)) return [];
    const out = [], k = r() < 0.25 ? 2 : 1;
    for (let j = 1; j <= k; j++) {
      const e = a.e + (a.e < 2.55 ? 0.58 : -0.58) * (j === 2 ? -0.9 : 1);
      const m = newAgent(seed + j * 97, { mode: 'walk', block: b, e, R: ringOf(b, e), p: a.p + (r() - 0.5) * 0.5 + (j === 2 ? 0.6 : 0), dir: a.dir, ...(tier ? { tier } : {}) });
      m.R.per = 2 * (m.R.w + m.R.h); m.mate = a; m.stopper = 0; if (m.wc === 'walkOld' || m.wc === 'walkPhone') m.wc = 'walk'; m.speed = a.speed;
      out.push(m);
    }
    a.stopper = 0; return out;
  };
  // (layout2 r3) Greenwich / West Village map (VMAP): its blocks are convex curb polygons (quads / trapezoids /
  // triangles), not grid rects. Each cell with a lot becomes a pseudo-block whose walkers circle a polygon ring: every
  // curb edge offset inward by the walker's lane (fraction `e` of that edge's sidewalk width, 1.95 m .. walk - 1.2 m), so
  // the ring always lies between the curb and the lot polygon (both are insets of the same cell). They cross the Village
  // streets near the corners (straight across the curb edge to the next cell) on the red phase of that street's traffic.
  const vblocks = [], vOfCell = new Map();
  for (const c of MAPS.flatMap(M => M.cells)) { // (layout2 r4) every street map (Village, FiDi)
    if (!c.prop) continue;
    const Q = c.curb, n = Q.length;
    let mx = 0, mz = 0; for (const [x, z] of Q) { mx += x; mz += z; } mx /= n; mz /= n;
    const E = Q.map((A, i) => {
      const B = Q[(i + 1) % n], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1e-6, tx = (B[0] - A[0]) / L, tz = (B[1] - A[1]) / L;
      let nx = -tz, nz = tx; if ((A[0] - mx) * nx + (A[1] - mz) * nz < 0) { nx = -nx; nz = -nz; }
      let walk = 99; for (const [px, pz] of c.prop) walk = Math.min(walk, (A[0] - px) * nx + (A[1] - pz) * nz);
      return { ax: A[0], az: A[1], bx: B[0], bz: B[1], tx, tz, nx, nz, L, walk };
    });
    const bb = c.block;
    const vb = { id: bb.id, vmap: true, cell: c, E, core: true, x0: bb.x0, x1: bb.x1, z0: bb.z0, z1: bb.z1,
      cx: (bb.x0 + bb.x1) / 2, cz: (bb.z0 + bb.z1) / 2, hx: (bb.x1 - bb.x0) / 2, hz: (bb.z1 - bb.z0) / 2, agents: null, near: false, xc: new Map() };
    vb.per = E.reduce((t, e) => t + e.L, 0);
    vblocks.push(vb); vOfCell.set(c, vb);
  }
  const sblocks = [...blocks, ...vblocks]; // streamed set
  const vRing = (b, f) => {
    const E = b.E, n = E.length, off = E.map(e => { const lo = Math.min(1.95, e.walk * 0.5), hi = Math.max(lo, e.walk - 1.2); return lo + f * (hi - lo); });
    const pts = [];
    for (let j = 0; j < n; j++) {
      const a = E[(j + n - 1) % n], c = E[j], oa = off[(j + n - 1) % n], oc = off[j];
      const px = a.ax - a.nx * oa, pz = a.az - a.nz * oa, qx = c.ax - c.nx * oc, qz = c.az - c.nz * oc;
      const cr = a.tx * c.tz - a.tz * c.tx;
      if (Math.abs(cr) < 0.03) { pts.push([qx, qz]); continue; }
      const t = ((qx - px) * c.tz - (qz - pz) * c.tx) / cr;
      pts.push([px + a.tx * t, pz + a.tz * t]);
    }
    const cum = [0];
    for (let j = 0; j < n; j++) {
      const p = pts[j], q = pts[(j + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1];
      if (dx * E[j].tx + dz * E[j].tz < -0.05) return null; // edge collapsed (tiny cell)
      cum.push(cum[j] + Math.hypot(dx, dz));
    }
    if (cum[n] < 12) return null;
    return { pts, cum, per: cum[n], poly: true };
  };
  const vRingNearest = (R, x, z) => {
    let best = Infinity, bp = 0;
    for (let j = 0; j + 1 < R.cum.length; j++) {
      const p = R.pts[j], q = R.pts[(j + 1) % R.pts.length], L = R.cum[j + 1] - R.cum[j]; if (L < 1e-6) continue;
      const tx = (q[0] - p[0]) / L, tz = (q[1] - p[1]) / L, u = Math.max(0, Math.min(L, (x - p[0]) * tx + (z - p[1]) * tz));
      const d = Math.hypot(p[0] + tx * u - x, p[1] + tz * u - z); if (d < best) { best = d; bp = R.cum[j] + u; }
    }
    return bp;
  };
  // crossing from corner k of Village block b across the street of edge k (which 0) or edge k-1 (which 1): curb start
  // (t), landing on the next cell's curb (f), the traffic axis to wait for, the block across. Cached; null if none.
  const vCross = (b, k, which) => {
    const key = k * 2 + which; if (b.xc.has(key)) return b.xc.get(key);
    const n = b.E.length, e = b.E[which ? (k + n - 1) % n : k];
    let res = null;
    if (e.L > 8) {
      const cx = which ? e.bx - e.tx * 2.4 : e.ax + e.tx * 2.4, cz = which ? e.bz - e.tz * 2.4 : e.az + e.tz * 2.4;
      const sx = cx - e.nx * 0.45, sz = cz - e.nz * 0.45;
      for (let d = 0.8; d < 30; d += 0.25) {
        const x = cx + e.nx * d, z = cz + e.nz * d, q = vmapAt(x, z);
        if (!q) break;
        if (q.type === 'street') continue;
        if (q.type !== 'sidewalk' || !q.vcell || q.vcell === b.cell) break;
        const nb = vOfCell.get(q.vcell); if (!nb) break;
        const fx = x + e.nx * 0.45, fz = z + e.nz * 0.45, q2 = vmapAt(fx, fz);
        if (!q2 || q2.type !== 'sidewalk') break;
        res = { nb, tx: sx, tz: sz, fx, fz, ux: e.tx, uz: e.tz, xw: { axis: Math.abs(e.tz) >= Math.abs(e.tx) ? 'av' : 'st', peds: 0 } };
        break;
      }
    }
    b.xc.set(key, res);
    return res;
  };
  const ringPos = (R, p, out) => {
    if (R.poly) { // (layout2 r3) Village polygon ring
      const per = R.per, n = R.pts.length;
      p = ((p % per) + per) % per;
      let j = 0; while (j < n - 1 && R.cum[j + 1] <= p) j++;
      const a = R.pts[j], c = R.pts[(j + 1) % n], L = R.cum[j + 1] - R.cum[j] || 1e-6, f = (p - R.cum[j]) / L;
      out[0] = a[0] + (c[0] - a[0]) * f; out[1] = a[1] + (c[1] - a[1]) * f; out[2] = (c[0] - a[0]) / L; out[3] = (c[1] - a[1]) / L;
      return out;
    }
    const per = 2 * (R.w + R.h);
    p = ((p % per) + per) % per;
    if (p < R.w) { out[0] = R.x0 + p; out[1] = R.z0; out[2] = 1; out[3] = 0; return out; }
    p -= R.w; if (p < R.h) { out[0] = R.x1; out[1] = R.z0 + p; out[2] = 0; out[3] = 1; return out; }
    p -= R.h; if (p < R.w) { out[0] = R.x1 - p; out[1] = R.z1; out[2] = -1; out[3] = 0; return out; }
    p -= R.w; out[0] = R.x0; out[1] = R.z1 - p; out[2] = 0; out[3] = -1; return out;
  };
  const cornerP = (R, k) => [0, R.w, R.w + R.h, 2 * R.w + R.h][k];            // 0 NW, 1 NE, 2 SE, 3 SW
  const CORNER_SIDE = [[0, 0], [1, 0], [1, 1], [0, 1]];                        // [x1 side?, z1 side?]
  const crosswalkFor = (b, k, across) => {
    const [sx, sz] = CORNER_SIDE[k];
    const i = b.ci + sx, j = sz ? b.rj1 : b.rj0;
    const node = roads.nodes[roads.nodeId(i, j)];
    if (!node) return null;
    const leg = across === 'av' ? (sz ? 'N' : 'S') : (sx ? 'W' : 'E');
    const xw = roads.crosswalks.get(node.id + leg);
    if (!xw) return null;
    // the block on the other side
    const nb = across === 'av' ? blockAt(b.ci + (sx ? 1 : -1), sz ? b.rj1 - 1 : b.rj0) : blockAt(b.ci, sz ? b.rj1 : b.rj0 - 1);
    if (!nb) return null;
    return { xw, nb, k2: across === 'av' ? [1, 0, 3, 2][k] : [3, 2, 1, 0][k] };
  };

  // curb waiting spot (t) and the matching spot across the street (f); back = metres back from the curb
  const curbSpots = (a, b, k, across, cw, jit, back) => {
    const xw = cw.xw, [sx, sz] = CORNER_SIDE[k];
    if (across === 'av') { a.tx = sx ? b.x1 - 0.45 : b.x0 + 0.45; a.tz = xw.z + jit; a.fx = sx ? cw.nb.x0 + 0.45 : cw.nb.x1 - 0.45; a.fz = a.tz; }
    else { a.tx = xw.x + jit; a.tz = sz ? b.z1 - 0.45 : b.z0 + 0.45; a.fz = sz ? cw.nb.z0 + 0.45 : cw.nb.z1 - 0.45; a.fx = a.tx; }
    if (back) {
      const dx = a.fx - a.tx, dz = a.fz - a.tz, l = Math.hypot(dx, dz) || 1;
      a.tx -= dx / l * back; a.tz -= dz / l * back; a.fx += dx / l * back; a.fz += dz / l * back;
    }
    a.xw = xw; a.cw = cw;
  };

  // ---- walk signal: may start crossing if the crossing traffic stays red long enough
  const redLeft = { av: 0, st: 0 };
  const computeRedLeft = () => {
    for (const ax of ['av', 'st']) {
      if (phase(time, ax) !== 0) { redLeft[ax] = 0; continue; }
      let t = 0; while (t < 40 && phase(time + t, ax) === 0) t += 0.5;
      redLeft[ax] = t;
    }
  };

  // ---- populate a block
  // (peds r1) user: 'reduce pedestrian density a bit' -> ~30 % fewer people on ordinary blocks, Times Square area stays busy
  let tsx = 0, tsz = 0; for (const sp of tsCrowdSpots) { tsx += sp.x; tsz += sp.z; } if (tsCrowdSpots.length) { tsx /= tsCrowdSpots.length; tsz /= tsCrowdSpots.length; }
  // (peds r6) user: 'reduce people by 10 % more' -> x0.9 everywhere (TS stays proportionally busier)
  const densAt = (x, z) => 0.9 * (0.66 + 0.3 * (tsCrowdSpots.length ? Math.exp(-(((x - tsx) ** 2 + (z - tsz) ** 2) / (260 * 260))) : 0));
  const populate = (b) => {
    if (b.vmap) { populateV(b); declone(b.agents); return; } // (layout2 r3) ((peds r2) anti-clone)
    const r = mulberry32(b.id * 7349 + 17);
    const dens = (b.core ? 1.0 : 0.7) * densAt(b.cx, b.cz);
    const per = 2 * (b.x1 - b.x0 + b.z1 - b.z0);
    const list = [];
    const nW = Math.round(per / 3.2 /* (street r10) 3.9 -> 3.2 */ * dens * (0.85 + r() * 0.3)); // (street r8: 4.8 -> 3.9) (street r2: 6.2 -> 4.8 m per walker, denser sidewalks)
    for (let i = 0; i < nW; i++) {
      const e = 2.2 + r() * 0.75;
      // (peds r3) stratified along the block (critic: 'dense knots next to empty sidewalks'): even spacing + jitter
      const a = newAgent(b.id * 1000 + i * 7 + 1, { mode: 'walk', block: b, e, R: ringOf(b, e), p: (i + 0.15 + r() * 0.7) / Math.max(1, nW) * per, dir: r() < 0.5 ? 1 : -1 });
      a.R.per = 2 * (a.R.w + a.R.h);
      maybeDog(a, b.core ? 0.03 : 0.06);
      list.push(a);
      if (r() < 0.5) list.push(...mates(a, b, b.id * 1000 + 600 + i * 11, mulberry32(b.id * 131 + i), null)); // (peds r4)
    }
    // storefront groups + phone-starers on each frontage (against the buildings)
    const fronts = [
      [b.px0 - 0.2, b.pz0 - 1.1, b.px1 + 0.2, b.pz0 - 1.1, 0, -1], [b.px1 + 1.1, b.pz0, b.px1 + 1.1, b.pz1, 1, 0],
      [b.px1, b.pz1 + 1.1, b.px0, b.pz1 + 1.1, 0, 1], [b.px0 - 1.1, b.pz1, b.px0 - 1.1, b.pz0, -1, 0],
    ];
    let gi = 0;
    for (const [x0, z0, x1, z1, nx, nz] of fronts) {
      const L = Math.hypot(x1 - x0, z1 - z0), tx = (x1 - x0) / L, tz = (z1 - z0) / L;
      for (let s = 8 + r() * 12; s < L - 8; s += ((b.core ? 11 : 18) + r() * 16) / dens) { // (street r7) 16/24+22r -> 11/18+16r ((peds r1) / dens)
        const cx = x0 + tx * s, cz = z0 + tz * s;
        const n = r() < 0.3 ? 1 : 2 + Math.floor(r() * r() * 3);
        const R0 = n === 2 ? 0.45 : 0.55 + n * 0.07, a0 = r() * 6.28;
        for (let k = 0; k < n; k++) {
          const ang = a0 + (k / n) * 6.28 + (r() - 0.5) * 0.5;
          const px = n === 1 ? cx : cx + Math.cos(ang) * R0, pz = n === 1 ? cz : cz + Math.sin(ang) * R0 * 0.8;
          const face = n === 1 ? Math.atan2(nx, nz) + Math.PI + (r() - 0.5) * 1.2 : Math.atan2(cx - px, cz - pz);
          const a = newAgent(b.id * 1000 + 500 + gi++, { mode: 'stand', block: b, hx: px, hz: pz, hry: face });
          a.x = px; a.z = pz; a.ry = face;
          a.idleClip = chatClip(k, n, r); // (peds r3)
          list.push(a);
        }
      }
    }
    b.agents = list;
    for (const a of list) { initPose(a); agents.push(a); }
    declone(list); // (peds r2)
  };
  // near tier: the blocks around the camera get twice the foot traffic plus crowds at every crosswalk corner that
  // wait through the red phase and cross together on the walk signal (then wait on the far corner for the next one).
  // (layout2 r3) Village cell: ring walkers at grid density + storefront groups along the lot polygon's edges
  const vWalkers = (b, r, spacing, seed0, tier) => {
    const nW = Math.round(b.per / spacing * (0.85 + r() * 0.3));
    for (let i = 0; i < nW; i++) {
      const e = r(), R = vRing(b, e); if (!R) continue;
      const a = newAgent(b.id * 1000 + seed0 + i * 7, { mode: 'walk', block: b, e, R, p: (i + 0.15 + r() * 0.7) / Math.max(1, nW) * R.per, dir: r() < 0.5 ? 1 : -1, ...(tier ? { tier } : {}) });
      maybeDog(a, 0.05);
      initPose(a); agents.push(a); b.agents.push(a);
    }
  };
  const populateV = (b) => {
    const r = mulberry32(b.id * 7349 + 17);
    b.agents = [];
    vWalkers(b, r, 3.2 / densAt(b.cx, b.cz), 1, null); // (peds r1) density
    const P = b.cell.prop, n = P.length;
    let mx = 0, mz = 0; for (const [x, z] of P) { mx += x; mz += z; } mx /= n; mz /= n;
    let gi = 0;
    for (let i = 0; i < n; i++) {
      const [x0, z0] = P[i], [x1, z1] = P[(i + 1) % n], L = Math.hypot(x1 - x0, z1 - z0); if (L < 20) continue;
      const tx = (x1 - x0) / L, tz = (z1 - z0) / L; let nx = -tz, nz = tx; if ((x0 - mx) * nx + (z0 - mz) * nz < 0) { nx = -nx; nz = -nz; }
      for (let s = 8 + r() * 12; s < L - 8; s += (13 + r() * 16) / 0.7) { // (peds r1) density
        const cx = x0 + tx * s + nx * 1.1, cz = z0 + tz * s + nz * 1.1;
        if (streetsAt(cx, cz).type !== 'sidewalk') continue;
        const k = r() < 0.3 ? 1 : 2 + Math.floor(r() * r() * 3), R0 = k === 2 ? 0.45 : 0.55 + k * 0.07, a0 = r() * 6.28;
        for (let j = 0; j < k; j++) {
          const ang = a0 + (j / k) * 6.28 + (r() - 0.5) * 0.5;
          const px = k === 1 ? cx : cx + Math.cos(ang) * R0 * (Math.abs(nx) > 0.7 ? 0.8 : 1), pz = k === 1 ? cz : cz + Math.sin(ang) * R0 * (Math.abs(nz) > 0.7 ? 0.8 : 1);
          const face = k === 1 ? Math.atan2(nx, nz) + Math.PI + (r() - 0.5) * 1.2 : Math.atan2(cx - px, cz - pz);
          const a = newAgent(b.id * 1000 + 500 + gi++, { mode: 'stand', block: b, hx: px, hz: pz, hry: face });
          a.x = px; a.z = pz; a.ry = face;
          a.idleClip = chatClip(j, k, r); // (peds r3)
          initPose(a); agents.push(a); b.agents.push(a);
        }
      }
    }
  };
  const populateNear = (b) => { const n0 = agents.length; populateNear0(b); declone(agents.slice(n0)); }; // (peds r2) anti-clone
  const populateNear0 = (b) => {
    if (b.vmap) { vWalkers(b, mulberry32(b.id * 9173 + 5), 2.2 / densAt(b.cx, b.cz), 300, 'near'); b.near = true; return; } // (layout2 r3) ((peds r1) density)
    const r = mulberry32(b.id * 9173 + 5);
    const per = 2 * (b.x1 - b.x0 + b.z1 - b.z0), dens = (b.core ? 1.0 : 0.75) * densAt(b.cx, b.cz); // (peds r1) density
    const nW = Math.round(per / 2.2 * dens); // (street r10) 2.7 -> 2.2 // (street r7) 3.4 -> 2.7 m (critic: 'streets nearly empty of pedestrians')
    for (let i = 0; i < nW; i++) {
      const e = 2.1 + r() * 0.9;
      const a = newAgent(b.id * 1000 + 300 + i * 3, { mode: 'walk', tier: 'near', block: b, e, R: ringOf(b, e), p: (i + 0.5 + (r() - 0.5) * 0.7) / Math.max(1, nW) * per, dir: r() < 0.5 ? 1 : -1 }); // (peds r3) stratified
      a.R.per = 2 * (a.R.w + a.R.h);
      maybeDog(a, b.core ? 0.025 : 0.05);
      initPose(a); agents.push(a); b.agents.push(a);
      if (r() < 0.5) for (const m of mates(a, b, b.id * 1000 + 900 + i * 11, mulberry32(b.id * 173 + i), 'near')) { initPose(m); agents.push(m); b.agents.push(m); } // (peds r4)
    }
    let gi = 0;
    for (let k = 0; k < 4; k++) for (const across of ['av', 'st']) {
      const cw = crosswalkFor(b, k, across);
      if (!cw) continue;
      // (citylife r2) loose clusters of 1-5 (was 3-10 packed in 3 x 2.5 m: read as a black wall at every corner)
      // (peds r3) critic: 'curb group of ~10 in a tight spawn pile', 'nobody crossing the huge crosswalks': 1-3 per
      // crosswalk corner, spread along the curb; while the walk signal is on, part of them spawn already on the crosswalk
      // (steady state: a still frame shows people mid-crossing in both directions)
      const n = 1 + Math.floor(r() * (b.core ? 2.7 : 2.1) * dens);
      const walkOn = redLeft[cw.xw.axis] > 4;
      for (let i = 0; i < n; i++) {
        const a = newAgent(b.id * 1000 + 800 + gi++, { mode: 'wait', tier: 'near', ping: true, block: b, sawRed: true, waitT: 0 });
        curbSpots(a, b, k, across, cw, (i % 2 ? 1 : -1) * (0.4 + i * 0.75 + r() * 0.7), 0.2 + r() * 1.8 + (i > 1 ? 0.7 : 0));
        a.x = a.tx; a.z = a.tz; a.ry = Math.atan2(a.fx - a.tx, a.fz - a.tz) + (r() - 0.5) * 0.8;
        a.waitClip = r() < 0.3 ? 'phone' : 'idle';
        if (walkOn && r() < 0.6) {
          if (r() < 0.5) { const ox = a.tx, oz = a.tz; a.tx = a.fx; a.tz = a.fz; a.fx = ox; a.fz = oz; }
          const u = 0.1 + r() * 0.75; a.x = a.tx + (a.fx - a.tx) * u; a.z = a.tz + (a.fz - a.tz) * u;
          a.ry = Math.atan2(a.fx - a.tx, a.fz - a.tz); a.mode = 'cross'; a.xspd = 1.45 + r() * 0.4;
          initPose(a); setClip(a, 'walk', walkRate(a, a.xspd));
        } else initPose(a);
        agents.push(a); b.agents.push(a);
      }
    }
    b.near = true;
  };
  const initPose = (a) => {
    if (a.mode === 'walk') { ringPos(a.R, a.p, _rp); a.x = _rp[0]; a.z = _rp[1]; a.ry = Math.atan2(_rp[2] * a.dir, _rp[3] * a.dir); setClip(a, 'walk', walkRate(a, a.speed)); }
    else if (a.mode === 'stand') setClip(a, a.idleClip);
    else if (a.mode === 'sit') setClip(a, 'sit');
    else if (a.mode === 'wait') setClip(a, a.waitClip || 'idle');
    else if (a.mode === 'wander') setClip(a, 'walk', walkRate(a, a.speed));
    else if (a.mode === 'path' || a.mode === 'prom') setClip(a, a.jog ? 'run' : 'walk', a.jog ? runRate(a, a.speed) : walkRate(a, a.speed));
  };
  const _rp = [0, 0, 0, 0];

  // ---- static populations: park paths, promenade, bench sitters, vendors (simulated only when near)
  const statics = [];
  const thin = (x, z) => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return h - Math.floor(h) < 0.1; }; // (peds r6) position hash: drop ~10 %
  {
    const r = mulberry32(4711);
    let n = 0;
    // promenade along the river (between the drive and the seawall railing)
    for (let i = 0; i < 700; i++) {
      const jog = r() < 0.15;
      if (i % 10 >= 7 || i % 100 >= 90) { r(); r(); r(); r(); continue; } // (peds r6) i % 100 >= 90: 10 % fewer // (peds r1) 30 % fewer promenade walkers (same draws for the rest)
      // promenade along either river: a.side 0 west / 1 east, a.px = inset from the seawall railing
      const a = newAgent(95000 + i, { mode: 'prom', side: r() < 0.5 ? 0 : 1, px: 2.5 + r() * 7, p: -3150 + r() * 6200, dir: r() < 0.5 ? 1 : -1, jog });
      if (jog) a.speed = 2.8 + r() * 0.8; else maybeDog(a, 0.08);
      statics.push(a);
    }
    // bench sitters + cart vendors from the props
    for (const bn of props?.benches?.() || []) {
      if (r() > 0.56) continue; // (peds r6) 0.62 -> 0.56 (peds r4) 0.42 -> 0.62: critic 'nobody sitting'
      const k = r() < 0.4 ? 2 : 1;
      for (let i = 0; i < k; i++) {
        const off = k === 2 ? (i ? 0.45 : -0.45) : (r() - 0.5) * 1.0;
        const fx = Math.sin(bn.ry), fz = Math.cos(bn.ry);
        const a = newAgent(97000 + n++, { mode: 'sit' });
        a.x = bn.x + fz * off + fx * 0.14; a.z = bn.z - fx * off + fz * 0.14; a.ry = bn.ry; a.y = bn.y ?? G.CURB_H;
        statics.push(a);
      }
    }
    for (const c of props?.carts?.() || []) {
      const a = newAgent(99000 + n++, { mode: 'stand', idleClip: 'idle', vendor: true });
      const fx = Math.sin(c.ry), fz = Math.cos(c.ry);
      a.x = c.x - fx * 0.95; a.z = c.z - fz * 0.95; a.ry = c.ry; a.hx = a.x; a.hz = a.z; a.hry = a.ry;
      statics.push(a);
      // (peds r4) a queue at the window (critic: 'nobody queuing at the halal cart'): 1-4 in a loose line along the
      // sidewalk, the first one ordering (talk), the rest on phones / waiting; + sometimes someone eating off to the side
      const nq = r() < 0.2 ? 0 : 1 + Math.floor(r() * r() * 4.2), qs = r() < 0.5 ? 1 : -1;
      for (let i = 0; i < nq; i++) {
        if (i > 0 && thin(c.x + i, c.z)) continue; // (peds r6) 10 % fewer (the one ordering stays)
        const b2 = newAgent(99500 + n++, { mode: 'stand', idleClip: i === 0 ? clipOr('talk2', 'talk') : r() < 0.45 ? 'phone' : 'idle' });
        const along = i === 0 ? (r() - 0.5) * 0.4 : qs * (0.35 + i * 0.78 + (r() - 0.5) * 0.2), out = 1.05 + (i ? 0.25 + r() * 0.3 : 0);
        b2.x = c.x + fx * out + fz * along; b2.z = c.z + fz * out - fx * along;
        b2.ry = Math.atan2(c.x - b2.x, c.z - b2.z) + (r() - 0.5) * 0.35; b2.hx = b2.x; b2.hz = b2.z; b2.hry = b2.ry;
        statics.push(b2);
      }
      if (r() < 0.35) {
        const e2 = newAgent(99500 + n++, { mode: 'stand', idleClip: r() < 0.5 ? 'idle' : 'phone' }), along = -qs * (1.6 + r());
        e2.x = c.x + fx * 1.5 + fz * along; e2.z = c.z + fz * 1.5 - fx * along; e2.ry = r() * 6.28; e2.hx = e2.x; e2.hz = e2.z; e2.hry = e2.ry;
        statics.push(e2);
      }
    }
    // (peds r4) bus-stop waits: a loose knot of 1-4 near the sign / under the shelter, facing up the avenue (looking for
    // the bus) or the street, phones out; they stay put (no static corner knot: the corner crowds cycle, see 'wait')
    for (const bs of props?.busStops?.() || []) {
      if (r() < 0.25) continue;
      if (thin(bs.x, bs.z)) continue; // (peds r6) 10 % fewer
      const fx = Math.sin(bs.ry), fz = Math.cos(bs.ry), k = 1 + Math.floor(r() * r() * 4.5), up = r() < 0.5 ? 1 : -1;
      for (let i = 0; i < k; i++) {
        const along = (bs.kind === 'shelter' ? (r() - 0.5) * 3.6 : up * (0.5 + i * 0.9 + r() * 0.5)), inw = bs.kind === 'shelter' ? -0.25 - r() * 0.45 : 0.4 + r() * 1.3;
        const q = r(), b2 = newAgent(99800 + n++, { mode: 'stand', idleClip: q < 0.45 ? 'phone' : q < 0.6 ? clipOr('idleShift', 'idle') : 'idle' });
        b2.x = bs.x - fx * inw + fz * along; b2.z = bs.z - fz * inw - fx * along;
        b2.ry = bs.ry + (r() < 0.55 ? up * -1.2 : 0) + (r() - 0.5) * 0.7; b2.hx = b2.x; b2.hz = b2.z; b2.hry = b2.ry;
        statics.push(b2);
      }
    }
    // + timessq: Times Square plaza crowd (standing groups, cafe + TKTS-step sitters) from timessq.js
    for (const sp of (typeof location !== 'undefined' && /[?&]notscrowd/.test(location.search)) ? [] : tsCrowdSpots) { // ?notscrowd: debug off
      if (thin(sp.x, sp.z)) continue; // (peds r6) 10 % fewer
      const a = sp.mode === 'sit' ? newAgent(120000 + n++, { mode: 'sit' }) : newAgent(120000 + n++, { mode: 'stand', idleClip: CL[sp.clip] ? sp.clip : 'idle' });
      a.x = sp.x; a.z = sp.z; a.ry = sp.ry; if (sp.y !== undefined) a.y = sp.y;
      if (sp.mode !== 'sit') { a.hx = a.x; a.hz = a.z; a.hry = a.ry; }
      statics.push(a);
    }
    // (street r7) Grand Central / Park Av podium people (elevated: a.elev keeps their own y)
    for (const sp of [...GC_CROWD_SPOTS, ...PLAZA_CROWD_SPOTS]) {
      if (thin(sp.x, sp.z)) continue; // (peds r6) 10 % fewer
      const a = sp.mode === 'sit' ? newAgent(126000 + n++, { mode: 'sit' }) : newAgent(126000 + n++, { mode: 'stand', idleClip: CL[sp.clip] ? sp.clip : 'idle' });
      a.x = sp.x; a.z = sp.z; a.ry = sp.ry; if (sp.y !== undefined) a.y = sp.y; a.elev = !!sp.elev;
      if (sp.mode !== 'sit') { a.hx = a.x; a.hz = a.z; a.hry = a.ry; }
      statics.push(a);
    }
    // (peds r6) Central Park lawn + park-edge people (user: 'in the park thing, we still have block people'): park.js used to
    // draw ~3.7k instanced 40-tri box figures at every distance; they are now crowd statics with the real models / LODs.
    // Lawn: sunbathers sit on the grass (bench 'sit' clip sunk so the hips rest on the lawn, shins under the grass),
    // standers chat. Edge sidewalks: singles walk the perimeter walk (a straight 'path'), knots stand and talk.
    // ~55 % of the old lawn count and ~90 % of the edge count (the crowd also streams its own lawn groups / path walkers).
    {
      const PK = G.PARK, edgeP = new Map();
      const edgePath = (alongX, off) => {
        const key = (alongX ? 'x' : 'z') + Math.round(off * 2);
        let P = edgeP.get(key);
        if (!P) {
          const a0 = (alongX ? PK.x0 : PK.z0) + 4, a1 = (alongX ? PK.x1 : PK.z1) - 4;
          const pts = alongX ? [[a0, off], [a1, off]] : [[off, a0], [off, a1]];
          P = { pts, lens: [0, a1 - a0], total: a1 - a0, w: 1 }; edgeP.set(key, P);
        }
        return P;
      };
      const r = mulberry32(6262);
      for (const sp of PARK_CROWD_SPOTS) {
        if (sp.kind === 'lawn') {
          if (r() > 0.55) continue;
          const sit = sp.pose !== 0;
          const a = sit ? newAgent(130000 + n++, { mode: 'sit' }) : newAgent(130000 + n++, { mode: 'stand', idleClip: r() < 0.5 ? clipOr('talk2', 'talk') : r() < 0.5 ? 'phone' : clipOr('listen', 'idle') });
          a.x = sp.x; a.z = sp.z; a.ry = sp.ry; a.y = sit ? sp.y - 0.38 : sp.y; a.park = true; // park: heightAt keeps a.y
          if (!sit) { a.hx = a.x; a.hz = a.z; a.hry = a.ry; }
          statics.push(a);
        } else if (sp.kind === 'edge') {
          if (thin(sp.x, sp.z)) continue;
          if (sp.g === 1) {
            const off = sp.alongX ? sp.z : sp.x, P = edgePath(sp.alongX, off);
            const a = newAgent(134000 + n++, { mode: 'path', path: P, p: (sp.alongX ? sp.x : sp.z) - (sp.alongX ? PK.x0 : PK.z0) - 4, dir: r() < 0.5 ? 1 : -1, side: 0, jog: false, y: sp.y });
            maybeDog(a, 0.06);
            statics.push(a);
          } else {
            const a = newAgent(134000 + n++, { mode: 'stand', idleClip: sp.j === 0 ? clipOr('talk2', 'talk') : r() < 0.6 ? clipOr('listen', 'idle') : 'phone' });
            a.x = a.hx = sp.x; a.z = a.hz = sp.z; a.ry = a.hry = sp.ry; a.y = sp.y; a.park = true;
            statics.push(a);
          }
        }
      }
    }
    for (const a of statics) { initPose(a); a.static = true; }
    for (let i = 0; i < statics.length; i += 64) declone(statics.slice(i, i + 64)); // (peds r2) TS / plaza crowds: no clone pairs
  }

  // ---- park: streamed cells (path walkers/joggers/couples, lawn groups and strollers on the meadows)
  const pPaths = [];
  for (const path of parkPaths || []) {
    if (path.drive) continue;
    const pts = path.pts, lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    pPaths.push({ pts, lens, total: lens[lens.length - 1], w: path.w });
  }
  const pathXZ = (P, p, out) => {
    let i = 1; while (i < P.lens.length - 1 && P.lens[i] < p) i++;
    const p0 = P.pts[i - 1], p1 = P.pts[i], f = (p - P.lens[i - 1]) / Math.max(1e-3, P.lens[i] - P.lens[i - 1]);
    out[0] = p0[0] + (p1[0] - p0[0]) * f; out[1] = p0[1] + (p1[1] - p0[1]) * f; return out;
  };
  const pcells = new Map();
  const PK = G.PARK;
  const pcell = (x, z) => {
    const i = Math.floor((x - PK.x0) / PCELL), j = Math.floor((z - PK.z0) / PCELL), id = i * 1000 + j;
    let c = pcells.get(id);
    if (!c) { c = { id, i, j, cx: PK.x0 + (i + 0.5) * PCELL, cz: PK.z0 + (j + 0.5) * PCELL, samples: [], live: false }; pcells.set(id, c); }
    return c;
  };
  for (let x = PK.x0 + PCELL / 2; x < PK.x1; x += PCELL) for (let z = PK.z0 + PCELL / 2; z < PK.z1; z += PCELL) pcell(x, z);
  pPaths.forEach((P, pi) => { for (let p = 2; p < P.total - 2; p += 5) { pathXZ(P, p, _rp); pcell(_rp[0], _rp[1]).samples.push(pi, p); } });
  const meadowAt = (x, z) => PARK_MEADOWS.find(m => {
    const dx = x - m.x, dz = z - m.z, c = Math.cos(m.a), s = Math.sin(m.a);
    return ((dx * c - dz * s) / m.rx) ** 2 + ((dx * s + dz * c) / m.rz) ** 2 < 0.8;
  });
  const meadowPoint = (m, r, out) => {
    const ang = r() * 6.283, rad = Math.sqrt(r()) * 0.82, u = Math.cos(ang) * rad * m.rx, v = Math.sin(ang) * rad * m.rz;
    const c = Math.cos(m.a), s = Math.sin(m.a);
    out[0] = m.x + u * c + v * s; out[1] = m.z - u * s + v * c; return out;
  };
  const populatePark = (c) => {
    const nPark0 = agents.length;
    const r = mulberry32(c.id * 131 + 77);
    let n = 0;
    const seed = () => 200000 + c.id * 400 + n++;
    const S = c.samples;
    for (let q = 0; q < S.length; q += 2) {
      if (r() > 0.405) continue; // (peds r6) 0.45 -> 0.405 (peds r1) 0.62 -> 0.45: park paths ~30 % quieter
      const P = pPaths[S[q]], jog = r() < 0.16;
      const a = newAgent(seed(), { mode: 'path', park: true, path: P, p: S[q + 1] + r() * 5, dir: r() < 0.5 ? 1 : -1, side: (r() - 0.5) * P.w * 0.55, jog, y: G.CURB_H + 0.02 });
      if (jog) a.speed = 2.6 + r() * 0.9; else maybeDog(a, 0.1);
      agents.push(a); initPose(a);
      if (!jog && r() < 0.28) { // walking together
        const b = newAgent(seed(), { mode: 'path', park: true, path: P, p: a.p + (r() - 0.5) * 0.4, dir: a.dir, side: a.side + (a.side > 0 ? -0.65 : 0.65), jog: false, y: a.y });
        b.speed = a.speed; agents.push(b); initPose(b); b.A.set(a.A); b.A[3] -= 0.25 + a.rng() * 0.4; // (peds r2) own step phase (was lockstep)
      }
    }
    const m = meadowAt(c.cx, c.cz);
    if (m) {
      const nG = 1 + Math.floor(r() * 3);
      for (let g = 0; g < nG; g++) {
        meadowPoint(m, r, _rp); if (Math.abs(_rp[0] - c.cx) > PCELL / 2 + 8 || Math.abs(_rp[1] - c.cz) > PCELL / 2 + 8) { _rp[0] = c.cx + (r() - 0.5) * PCELL; _rp[1] = c.cz + (r() - 0.5) * PCELL; }
        const gx = _rp[0], gz = _rp[1], k = 1 + Math.floor(r() * 4), R0 = 0.5 + k * 0.1, a0 = r() * 6.28;
        if (thin(gx, gz)) continue; // (peds r6) 10 % fewer
        for (let i = 0; i < k; i++) {
          const ang = a0 + (i / k) * 6.28 + (r() - 0.5) * 0.4;
          const px = k === 1 ? gx : gx + Math.cos(ang) * R0, pz = k === 1 ? gz : gz + Math.sin(ang) * R0;
          const a = newAgent(seed(), { mode: 'stand', park: true, y: G.CURB_H + 0.02 });
          a.x = a.hx = px; a.z = a.hz = pz; a.ry = a.hry = k === 1 ? r() * 6.28 : Math.atan2(gx - px, gz - pz);
          a.idleClip = k > 1 && r() < 0.15 ? 'clap' : chatClip(i, k, r); // (peds r3)
          agents.push(a); initPose(a);
        }
      }
      const nWd = Math.floor(r() * 2.7 + 0.9); // (peds r6) 10 % fewer strollers (avg 2 -> 1.8)
      for (let i = 0; i < nWd; i++) {
        const a = newAgent(seed(), { mode: 'wander', park: true, meadow: m, y: G.CURB_H + 0.02, pause: 0 });
        a.speed *= 0.85; a.x = c.cx + (r() - 0.5) * PCELL; a.z = c.cz + (r() - 0.5) * PCELL;
        meadowPoint(m, a.rng, _rp); a.tx = _rp[0]; a.tz = _rp[1];
        agents.push(a); initPose(a);
      }
    }
    c.live = true;
    declone(agents.slice(nPark0)); // (peds r2)
  };
  const stepWander = (a, dt) => {
    if (a.pause > 0) { a.pause -= dt; setClip(a, a.pauseClip); if (a.pause <= 0) { meadowPoint(a.meadow, a.rng, _rp); a.tx = _rp[0]; a.tz = _rp[1]; } return; }
    if (moveTo(a, a.tx, a.tz, a.speed, dt)) { a.pause = 3 + a.rng() * 10; a.pauseClip = a.rng() < 0.5 ? 'phone' : a.rng() < 0.5 ? 'lookUp' : 'idle'; }
  };

  // ---- streaming
  const lastCam = new THREE.Vector3(1e9, 0, 0);
  let backlog = false; // (perf r2) blocks left unpopulated by the per-call budget -> stream again next frame
  const stream = (cp) => {
    computeRedLeft(); // (peds r3) corner crowds spawn mid-crossing while the walk signal is on
    let budget = SLICE2 ? 3 : 1e9; backlog = false; // (perf r2) <= 3 block populates per frame: no 10+ ms spikes when swinging
    for (const b of sblocks) { // (layout2 r3) + Village cells
      if (inPark(b.cx, b.cz)) continue;
      const dx = Math.max(0, Math.abs(cp.x - b.cx) - b.hx), dz = Math.max(0, Math.abs(cp.z - b.cz) - b.hz);
      const d2 = dx * dx + dz * dz;
      if (!b.agents && d2 < RP * RP) { if (budget-- > 0) populate(b); else backlog = true; }
      else if (b.agents && d2 > (RP + 40) ** 2) {
        for (const a of agents) if (a.block === b && !a.static) a.dead = true;
        b.agents = null; b.near = false;
      }
      if (b.agents && !b.near && d2 < RNEAR[0] * RNEAR[0]) { if (budget-- > 0) populateNear(b); else backlog = true; }
      else if (b.near && d2 > RNEAR[1] * RNEAR[1]) b.near = false;
    }
    for (const c of pcells.values()) {
      const dx = Math.max(0, Math.abs(cp.x - c.cx) - PCELL / 2), dz = Math.max(0, Math.abs(cp.z - c.cz) - PCELL / 2), d2 = dx * dx + dz * dz;
      if (!c.live && d2 < RPARK[0] * RPARK[0]) { if (budget-- > 0) populatePark(c); else backlog = true; }
      else if (c.live && d2 > RPARK[1] * RPARK[1]) c.live = false;
    }
    for (const a of agents) {
      const d2 = (a.x - cp.x) ** 2 + (a.z - cp.z) ** 2;
      if (a.park && d2 > (RPARK[1] + 20) ** 2) a.dead = true;
      else if (a.tier === 'near' && d2 > NEAR_KILL * NEAR_KILL) a.dead = true;
    }
    compact();
  };
  const compact = () => { let k = 0; for (const a of agents) if (!a.dead) agents[k++] = a; agents.length = k; };

  // ---- per-agent behaviour
  const toPlayer = (a) => Math.hypot(player.pos.x - a.x, player.pos.z - a.z);
  const faceAngle = (a, tx, tz) => Math.atan2(tx - a.x, tz - a.z);
  const turnTo = (a, ang, rate, dt) => {
    let d = ang - a.ry; d = Math.atan2(Math.sin(d), Math.cos(d));
    a.ry += Math.max(-rate * dt, Math.min(rate * dt, d));
    return Math.abs(d);
  };
  // Spider-Man at street level: most people just stop and watch or film him; a few wave / point / clap, rare cheers.
  // (people further than ~16 m or with low interest only turn their heads and keep walking)
  const REACT = [['watch', 0.3], ['photo', 0.27], ['wave', 0.12], ['point', 0.1], ['clap', 0.08], ['cheer', 0.06], ['talk', 0.07]];
  const REACT_UP = [['lookUp', 0.4], ['point', 0.3], ['photo', 0.2], ['cheer', 0.1]];
  const pickFrom = (a, L) => { let x = a.rng(); for (const [k, p] of L) if ((x -= p) <= 0) return k; return L[0][0]; };
  const pickReact = (a) => pickFrom(a, player.pos.y - player.ground > 3 ? REACT_UP : REACT);
  const CLIP_OF = { watch: 'idle', talk: 'talk' };
  const startReact = (a, kind, delay = 0) => {
    if (a.react) return;
    a.react = { kind, t: -delay, until: 7 + a.rng() * 9, prevMode: a.mode };
  };
  const endReact = (a) => {
    a.react = null; a.flash = 0;
    if (a.mode === 'walk') setClip(a, 'walk', walkRate(a, a.speed));
    else if (a.mode === 'path' || a.mode === 'prom') setClip(a, a.jog ? 'run' : 'walk', a.jog ? runRate(a, a.speed) : walkRate(a, a.speed));
    else if (a.mode === 'stand') setClip(a, a.idleClip);
    else if (a.mode === 'sit') setClip(a, 'sit');
    else if (a.mode === 'wait' || a.mode === 'toCurb') setClip(a, a.waitClip || 'idle');
    else if (a.mode === 'wander') { a.pause = 0; setClip(a, 'walk', walkRate(a, a.speed)); }
  };
  const onRoad = (x, z) => { const t = streetsAt(x, z).type; return t === 'avenue' || t === 'street' || t === 'intersection'; };

  // returns true when the agent is held in place by a reaction this frame
  const reactions = (a, dt, d) => {
    const P = player;
    const hAbove = P.pos.y - P.ground;
    // alarm -> flee / cower
    for (const al of alarms) {
      const da = Math.hypot(al.x - a.x, al.z - a.z);
      if (da < al.r && !(a.react && (a.react.kind === 'flee' || a.react.kind === 'cower'))) {
        a.react = { kind: a.rng() < 0.2 ? 'cower' : 'flee', t: 0, until: 6 + a.rng() * 5, fx: al.x, fz: al.z, prevMode: a.mode };
      }
    }
    // landing close by: step back, then react
    if (P.landT > time - 0.3 && P.landPos && !a.react) {
      const dl = Math.hypot(P.landPos.x - a.x, P.landPos.z - a.z);
      if (dl < 5.5 && a.mode !== 'sit') a.react = { kind: 'backoff', t: 0, until: 1.1 + a.rng() * 0.4, fx: P.landPos.x, fz: P.landPos.z, prevMode: a.mode };
      else if (dl < 16) startReact(a, pickReact(a), 0.2 + a.rng() * 0.6);
    }
    // danger zones (active crimes / fights): flee or cower, vendors + bench sitters duck; walkers avoid entering
    for (const z of zones.values()) {
      if (!z.active) continue;
      const dz = Math.hypot(z.x - a.x, z.z - a.z);
      if (dz < z.r) {
        const hold = a.vendor || a.mode === 'sit';
        if (!a.react || !(a.react.kind === 'flee' || a.react.kind === 'cower')) {
          a.react = { kind: hold || a.rng() < 0.25 ? 'cower' : 'flee', t: 0, until: 4, fx: z.x, fz: z.z, prevMode: a.mode, zone: true, hold };
        } else { a.react.until = Math.max(a.react.until, a.react.t + 1.5); a.react.fx = z.x; a.react.fz = z.z; }
      } else if (dz < z.r + 6 && a.mode === 'walk' && !a.react && a.R) {
        ringPos(a.R, a.p + a.dir * 2, _rp);
        if (Math.hypot(z.x - _rp[0], z.z - _rp[1]) < dz) a.dir = -a.dir;   // turn back instead of walking into the fight
      }
    }
    // Spider-Man on the ground / low nearby -> about half the people stop and react (the rest glance and walk on)
    if (!a.react && d < 16 && hAbove < 5 && a.interest < 0.55 && a.mode !== 'cross') startReact(a, pickReact(a), 0.3 + a.rng() * 1.6);
    // swinging overhead: some stop and point / look up / film
    if (!a.react && d < 26 && hAbove > 4 && hAbove < 45 && P.vel.lengthSq() > 64 && a.interest < 0.3 && a.mode !== 'cross')
      startReact(a, pickFrom(a, REACT_UP), 0.1 + a.rng() * 0.5);
    const R = a.react;
    if (!R) return false;
    R.t += dt;
    if (R.kind === 'flee' || R.kind === 'cower') {
      if (R.kind === 'cower' && (R.hold || R.t < 2.5)) { if (R.t > R.until) { endReact(a); return false; } setClip(a, 'cower'); return true; }
      if (R.t > R.until) { endReact(a); return false; }
      // run away from the danger along the sidewalk (ring agents) or radially
      const ax = a.x - R.fx, az = a.z - R.fz;
      if (a.mode === 'walk') { ringPos(a.R, a.p, _rp); a.dir = (_rp[2] * ax + _rp[3] * az) >= 0 ? 1 : -1; a.p += a.dir * 4.2 * dt; ringPos(a.R, a.p, _rp); a.x = _rp[0]; a.z = _rp[1]; a.ry = Math.atan2(_rp[2] * a.dir, _rp[3] * a.dir); }
      else if (a.mode !== 'sit') {
        // run away radially; at a curb slide along the sidewalk instead of running on the spot; boxed in -> cower
        const l = Math.hypot(ax, az) || 1, ux = ax / l, uz = az / l, st = 4.2 * dt;
        let moved = false;
        for (const [dx, dz] of [[ux, uz], [uz, -ux], [-uz, ux], [(ux + uz) * 0.7, (uz - ux) * 0.7], [(ux - uz) * 0.7, (uz + ux) * 0.7]]) {
          if (dx * ux + dz * uz < -0.05) continue;
          const nx = a.x + dx * st, nz = a.z + dz * st;
          if (!onRoad(nx, nz)) { a.x = nx; a.z = nz; a.ry = Math.atan2(dx, dz); moved = true; break; }
        }
        if (!moved) { R.kind = 'cower'; R.hold = true; setClip(a, 'cower'); return true; }
      }
      setClip(a, 'flee', 4.2 / (RUN_STRIDE * a.scale) * (19 / 30));
      return true;
    }
    if (R.kind === 'backoff') {
      const ax = a.x - R.fx, az = a.z - R.fz, l = Math.hypot(ax, az) || 1;
      turnTo(a, Math.atan2(-ax, -az), 8, dt);          // face him while stepping back
      const nx = a.x + ax / l * 1.5 * dt, nz = a.z + az / l * 1.5 * dt;
      if (!onRoad(nx, nz)) { a.x = nx; a.z = nz; if (a.mode === 'walk') a.detached = true; }
      setClip(a, 'walk', -1.1);
      if (R.t > R.until) { a.react = null; startReact(a, pickReact(a), 0.1); }
      return true;
    }
    // generic "watch him" reactions
    const gone = d > 32 || hAbove > 60;
    if (gone) R.goneT = (R.goneT || 0) + dt; else R.goneT = 0;
    if (R.goneT > 2.5 || R.t > R.until + (d < 8 ? 6 : 0)) { endReact(a); return false; }
    if (R.t < 0) return false; // reaction delay: keep doing what they were doing
    turnTo(a, faceAngle(a, P.pos.x, P.pos.z), 3.5, dt);
    setClip(a, CLIP_OF[R.kind] || R.kind, R.kind === 'wave' || R.kind === 'cheer' ? 0.9 + a.interest * 0.3 : 1);
    a.flash = R.kind === 'photo' ? 0.05 + a.interest : 0;
    return true;
  };

  const leaveRing = (a) => { // back onto the ring after being pushed around: nearest ring position
    const R = a.R;
    if (R.poly) { a.p = vRingNearest(R, a.x, a.z); a.target = null; a.tx = null; return; } // (layout2 r3)
    const cx = Math.max(R.x0, Math.min(R.x1, a.x)), cz = Math.max(R.z0, Math.min(R.z1, a.z));
    const dxs = [Math.abs(cz - R.z0), Math.abs(a.x - R.x1), Math.abs(cz - R.z1), Math.abs(a.x - R.x0)];
    const k = dxs.indexOf(Math.min(...dxs));
    a.p = k === 0 ? cx - R.x0 : k === 1 ? R.w + (cz - R.z0) : k === 2 ? R.w + R.h + (R.x1 - cx) : 2 * R.w + R.h + (R.z1 - cz);
    a.target = null;
    a.tx = null;
  };

  const stepWalker = (a, dt) => {
    if (a.detached) { a.mode = 'rejoin'; a.detached = false; leaveRing(a); }
    const R = a.R;
    if (a.mode === 'rejoin') {
      ringPos(R, a.p, _rp);
      if (moveTo(a, _rp[0], _rp[1], a.speed, dt)) { a.mode = 'walk'; setClip(a, 'walk', walkRate(a, a.speed)); }
      return;
    }
    if (a.mode === 'walk' && R.poly) { // (layout2 r3) Village polygon ring: corners = ring vertices
      const per = R.per, prev = ((a.p % per) + per) % per, p2 = prev + a.dir * a.speed * dt;
      a.p = ((p2 % per) + per) % per;
      for (let k = 0; k < R.pts.length; k++) {
        const c = R.cum[k];
        const hit = a.dir > 0 ? (prev < c && p2 >= c) || (prev < c + per && p2 >= c + per) : (prev > c && p2 <= c) || (prev > c - per && p2 <= c - per);
        if (!hit) continue;
        const r = a.rng();
        if (r < 0.55) break;
        const x = vCross(a.block, k, r < 0.775 ? 0 : 1);
        if (!x || !x.nb.agents) break;
        const jit = (a.rng() - 0.5) * 1.6, back = 0.1 + a.rng() * a.rng() * 1.2, dx = x.fx - x.tx, dz = x.fz - x.tz, l = Math.hypot(dx, dz) || 1;
        a.tx = x.tx + x.ux * jit - dx / l * back; a.tz = x.tz + x.uz * jit - dz / l * back; a.fx = x.fx + x.ux * jit; a.fz = x.fz + x.uz * jit;
        a.xw = x.xw; a.cw = x; a.mode = 'toCurb'; a.p = c; break;
      }
      ringPos(R, a.p, _rp);
      a.x = _rp[0] + a.dodgeX; a.z = _rp[1] + a.dodgeZ;
      turnTo(a, Math.atan2(_rp[2] * a.dir, _rp[3] * a.dir), 6, dt);
      setClip(a, 'walk', walkRate(a, a.speed));
      return;
    }
    if (a.mode === 'walk') {
      if (a.mate) { const m = a.mate; if (m.dead || m.mode !== 'walk' || m.block !== a.block) a.mate = null; else a.speed = m.speed * (m.stopT > 0 ? 0.25 : 1); } // (peds r4)
      if (a.stopT > 0) { // (peds r4) stopped: photo / point / look up / text, facing the buildings or across the street
        a.stopT -= dt; turnTo(a, a.stopRy, 2.5, dt); setClip(a, a.stopClip);
        if (a.stopT <= 0) { a.nextStop = time + 15 + a.rng() * 30; setClip(a, 'walk', walkRate(a, a.speed)); }
        return;
      }
      if (a.stopper && time > a.nextStop && !a.dog) {
        const q = a.rng();
        a.stopClip = a.stopper === 2 ? 'phone' : q < 0.4 ? 'photo' : q < 0.65 ? 'point' : 'lookUp';
        a.stopT = a.stopper === 2 ? 3 + a.rng() * 5 : 4 + a.rng() * 6;
        a.stopRy = a.ry + (a.rng() < 0.5 ? 1 : -1) * (1.2 + a.rng() * 0.8);
        if (a.stopper === 2) a.stopRy = a.ry + (a.rng() - 0.5);
        a.nextStop = Infinity; return;
      }
      const per = R.per;
      const prev = ((a.p % per) + per) % per;
      const p2 = prev + a.dir * a.speed * dt;
      a.p = ((p2 % per) + per) % per;
      // corner reached?
      for (let k = 0; k < 4; k++) {
        const c = cornerP(R, k);
        const hit = a.dir > 0 ? (prev < c && p2 >= c) || (prev < c + per && p2 >= c + per) : (prev > c && p2 <= c) || (prev > c - per && p2 <= c - per);
        if (!hit) continue;
        const r = a.rng();
        if (r < 0.52) break; // keep circling
        const across = r < 0.76 ? 'av' : 'st';
        const cw = crosswalkFor(a.block, k, across);
        if (!cw || !cw.nb.agents) break;
        // walk to the curb at the crosswalk
        curbSpots(a, a.block, k, across, cw, (a.rng() - 0.5) * 3.4, 0.1 + a.rng() * a.rng() * 1.8); // (citylife r2) not all toeing one line
        a.mode = 'toCurb';
        a.p = c; break;
      }
      ringPos(R, a.p, _rp);
      a.x = _rp[0] + a.dodgeX; a.z = _rp[1] + a.dodgeZ;
      turnTo(a, Math.atan2(_rp[2] * a.dir, _rp[3] * a.dir), 6, dt);
      setClip(a, 'walk', walkRate(a, a.speed));
      return;
    }
    if (a.mode === 'toCurb') {
      if (moveTo(a, a.tx, a.tz, a.speed, dt)) { a.mode = 'wait'; a.waitClip = a.waitClip || (a.rng() < 0.3 ? 'phone' : 'idle'); setClip(a, a.waitClip); a.waitT = 0; }
      return;
    }
    if (a.mode === 'wait') {
      a.waitT += dt;
      turnTo(a, Math.atan2(a.fx - a.x, a.fz - a.z), 3, dt);
      setClip(a, a.waitClip || 'idle');
      const need = Math.hypot(a.fx - a.x, a.fz - a.z) / 1.75 + 1;
      if (redLeft[a.xw.axis] <= need) a.sawRed = true;
      if (redLeft[a.xw.axis] > need && a.waitT > 0.3 + a.interest * 1.2 && (!a.ping || a.sawRed)) { a.mode = 'cross'; a.xspd = 1.55 + a.rng() * 0.35; }
      // (peds r4) no static knots: nobody waits more than ~45-70 s (a corner whose signal never turns): give up and walk on
      else if (a.waitT > 45 + a.interest * 25 && a.block && a.R && !a.ping) { a.mode = 'rejoin'; a.waitClip = null; }
      else if (a.waitT > 45 + a.interest * 25 && a.ping) { a.mode = 'cross'; a.xspd = 1.7 + a.rng() * 0.4; } // late jaywalk
      return;
    }
    if (a.mode === 'cross') {
      const done = moveTo(a, a.fx, a.fz, a.xspd, dt);
      if (onRoad(a.x, a.z)) a.xw.peds++;
      if (done && a.ping && a.cw && a.cw.nb && a.cw.nb.agents && a.rng() < 0.4) { a.ping = false; if (a.e === undefined) a.e = 2.2 + a.rng() * 0.75; } // (peds r4) corner crowds disperse into the next block's walkers (refilled by arrivals): no fixed knot
      if (done && a.ping) { // corner crowd: wait on this corner for the next walk signal, then cross back
        const ox = a.tx, oz = a.tz; a.tx = a.fx; a.tz = a.fz; a.fx = ox; a.fz = oz;
        a.mode = 'wait'; a.waitT = 0; a.sawRed = false; setClip(a, a.waitClip || 'idle');
        return;
      }
      if (done) { // arrived on the other block: join its ring at the matching corner
        const nb = a.cw.nb;
        if (nb.vmap) { // (layout2 r3) Village: join the next cell's ring at the nearest point
          a.block = nb; a.R = vRing(nb, a.e); if (!a.R) { a.dead = true; return; }
          a.p = vRingNearest(a.R, a.x, a.z); a.dir = a.rng() < 0.5 ? 1 : -1;
        } else {
        a.block = nb; a.R = ringOf(nb, a.e); a.R.per = 2 * (a.R.w + a.R.h);
        a.p = cornerP(a.R, a.cw.k2); a.dir = a.rng() < 0.5 ? 1 : -1;
        }
        a.mode = 'rejoin';
        if (!nb.agents) a.dead = true; else nb.agents.push(a);
      }
    }
  };
  const moveTo = (a, tx, tz, v, dt) => {
    const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    if (d < 0.08) { a.x = tx; a.z = tz; return true; }
    const s = Math.min(d, v * dt);
    a.x += dx / d * s; a.z += dz / d * s;
    turnTo(a, Math.atan2(dx, dz), 7, dt);
    setClip(a, 'walk', walkRate(a, v));
    return false;
  };
  const stepPath = (a, dt) => {
    const P = a.path;
    a.p += a.dir * a.speed * dt;
    if (a.p > P.total) { a.p = P.total; a.dir = -1; }
    if (a.p < 0) { a.p = 0; a.dir = 1; }
    let i = 1; while (i < P.lens.length - 1 && P.lens[i] < a.p) i++;
    const p0 = P.pts[i - 1], p1 = P.pts[i];
    const f = (a.p - P.lens[i - 1]) / Math.max(1e-3, P.lens[i] - P.lens[i - 1]);
    let dx = p1[0] - p0[0], dz = p1[1] - p0[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const side = a.side * a.dir;
    a.x = p0[0] + (p1[0] - p0[0]) * f - dz * side; a.z = p0[1] + (p1[1] - p0[1]) * f + dx * side;
    turnTo(a, Math.atan2(dx * a.dir, dz * a.dir), 5, dt);
    setClip(a, a.jog ? 'run' : 'walk', a.jog ? runRate(a, a.speed) : walkRate(a, a.speed));
  };
  const stepProm = (a, dt) => {
    a.p += a.dir * a.speed * dt;
    if (a.p > 3050) a.dir = -1; if (a.p < -3150) a.dir = 1;
    const sx = shoreX(a.p), sx2 = shoreX(a.p + a.dir * 2);
    a.x = a.side ? sx[1] - a.px : sx[0] + a.px; a.z = a.p;
    const nx2 = a.side ? sx2[1] - a.px : sx2[0] + a.px;
    turnTo(a, Math.atan2(nx2 - a.x, a.dir * 2), 5, dt);
    setClip(a, a.jog ? 'run' : 'walk', a.jog ? runRate(a, a.speed) : walkRate(a, a.speed));
  };

  const NO_GLANCE = new Set(['phone', 'walkPhone', 'talk', 'talk2', 'listen', 'photo', 'sit', 'cower', 'flee', 'run']);
  // head look toward Spider-Man (and toward the waiting direction otherwise)
  const look = (a, dt, d) => {
    let yaw = 0, pitch = 0;
    if (d < 30 && (a.interest < 0.85 || a.react)) {
      let rel = faceAngle(a, player.pos.x, player.pos.z) - a.ry; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (Math.abs(rel) < 1.9) {
        yaw = Math.max(-1.2, Math.min(1.2, rel));
        pitch = -Math.max(-0.5, Math.min(0.9, Math.atan2(player.pos.y + 1.2 - (a.y + 1.6), Math.max(1, d))));
        if (a.clip === 'lookUp') pitch *= 0.35; else if (pitch < -0.62) pitch = -0.62; // (peds r4) lookUp + look pitch cranked heads ~95 deg back (lineup)
      }
    }
    // (peds r3) idle glances (critic: 'no head turns'): every ~20-40 s a 2-4 s look to one side (shop window, traffic,
    // someone passing); not while reading a phone or talking to someone
    if (!yaw && !a.react && !NO_GLANCE.has(a.clip)) {
      const ph = time * (0.16 + (a.seed % 13) * 0.008) + (a.seed % 101) * 0.61, g = Math.sin(ph);
      if (g > 0.82) yaw = (Math.sin(ph * 0.5 + a.seed) > 0 ? 1 : -1) * (0.45 + 0.35 * ((a.seed >> 4) % 5) / 4) * Math.min(1, (g - 0.82) * 12);
    }
    const k = Math.min(1, dt * 4);
    a.lookYaw += (yaw - a.lookYaw) * k; a.lookPitch += (pitch - a.lookPitch) * k;
  };

  // ---- player avoidance: people step aside when he walks into them
  const dodge = (a, d, dt) => {
    if (d < 1.25 && !player.air) {
      const ax = a.x - player.pos.x, az = a.z - player.pos.z, l = Math.hypot(ax, az) || 1;
      const push = (1.25 - d) * 4 * dt;
      if (a.mode === 'walk') { a.dodgeX += ax / l * push; a.dodgeZ += az / l * push; }
      else if (a.mode === 'stand' || a.mode === 'path' || a.mode === 'prom' || a.mode === 'wait' || a.mode === 'wander') { a.x += ax / l * push; a.z += az / l * push; }
    }
    a.dodgeX *= 1 - Math.min(1, dt * 0.6); a.dodgeZ *= 1 - Math.min(1, dt * 0.6);
  };

  // ---- (peds r2) personal space: critic 'figures overlap / interpenetrate'. People within SEP_D m of the camera push
  // apart to ~0.62 m (walkers through their lane offset, everyone else directly); 1 m hash grid, rebuilt per frame
  const SEP = 0.62, SEP_D = 55, sgrid = new Map(), snear = [];
  const skey = (ix, iz) => (ix & 0xffff) * 65536 + (iz & 0xffff);
  const sLists = [agents, statics], sUsed = []; // (perf r3) cell arrays are recycled (emptied), not re-allocated every frame
  const separate = (cp, dt) => {
    for (const c of sUsed) c.length = 0;
    sUsed.length = 0; snear.length = 0;
    if (sgrid.size > 4096) sgrid.clear(); // keep the recycled cell map bounded as the camera travels
    for (const L of sLists) for (const a of L) {
      if (a.mode === 'sit' || a.vendor || a.dead) continue;
      const dx = a.x - cp.x, dz = a.z - cp.z; if (dx * dx + dz * dz > SEP_D * SEP_D) continue;
      snear.push(a); const k = skey(Math.floor(a.x), Math.floor(a.z)); let c = sgrid.get(k); if (!c) sgrid.set(k, c = []); if (!c.length) sUsed.push(c); c.push(a);
    }
    const kk = Math.min(1, dt * 4);
    for (const a of snear) {
      const ix = Math.floor(a.x), iz = Math.floor(a.z); let px = 0, pz = 0;
      for (let i = ix - 1; i <= ix + 1; i++) for (let j = iz - 1; j <= iz + 1; j++) {
        const c = sgrid.get(skey(i, j)); if (!c) continue;
        for (const b of c) {
          if (b === a) continue;
          let dx = a.x - b.x, dz = a.z - b.z; const d2 = dx * dx + dz * dz; if (d2 >= SEP * SEP) continue;
          if (d2 < 1e-6) { dx = (a.seed & 1) - 0.5; dz = ((a.seed >> 1) & 1) - 0.5; }
          const d = Math.sqrt(dx * dx + dz * dz) || 1, f = (SEP - Math.sqrt(d2)) * 0.5;
          px += dx / d * f; pz += dz / d * f;
        }
      }
      if (!px && !pz) continue;
      px *= kk; pz *= kk;
      if (a.mode === 'walk') { a.dodgeX += px; a.dodgeZ += pz; }
      else if (a.mode === 'path' || a.mode === 'prom') { a.side = (a.side || 0); a.x += px; a.z += pz; }
      else { a.x += px; a.z += pz; if (a.hx !== undefined) { a.hx += px; a.hz += pz; } }
      a._hy = undefined;
    }
  };

  // ------------------------------------------------------------------ render
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sph = new THREE.Sphere();
  const heightAt = (a) => {
    if (a.park || a.elev || a.mode === 'path' || a.mode === 'sit' || a.mode === 'prom') return a.y ?? G.CURB_H; // (street r7) a.elev
    return onRoad(a.x, a.z) ? 0 : G.CURB_H;
  };
  let frame = 0;
  const api = {
    agents, statics, pools: allPools,
    setPlayer(st) {
      player.pos.copy(st.pos); player.vel.copy(st.vel); player.air = st.air; player.ground = st.ground ?? 0;
      player.landT = st.landT; player.landPos = st.landPos;
    },
    alarm(pos, r = 25) { alarms.push({ x: pos.x, z: pos.z, r, t: time }); },
    // combat / explosions: everyone within r runs (one-shot, like alarm but wider and always flee)
    scatter(pos, r = 20) { alarms.push({ x: pos.x, z: pos.z, r, t: time }); },
    // persistent danger zone (active crime / fight): set active=false to clear; people drift back afterwards
    danger(key, pos, r = 18, active = true) {
      if (!active) { zones.delete(key); return; }
      const z = zones.get(key) || {}; Object.assign(z, { x: pos.x, z: pos.z, r, active: true }); zones.set(key, z);
    },
    zones,
    update(dt, camera) {
      time += dt; frame++;
      uni.uTime.value = time;
      const cp = camera.position;
      const PF = api.prof, q0 = PF ? performance.now() : 0;
      if (backlog || cp.distanceToSquared(lastCam) > 100 || frame % 30 === 1) { stream(cp); lastCam.copy(cp); } // (perf r2) backlog
      const q1 = PF ? performance.now() : 0;
      if (!SLICE2 || frame % 6 === 1) computeRedLeft(); // (perf r2) 10 Hz: seconds-scale walk-signal lookahead
      alarms = alarms.filter(al => time - al.t < 0.5);
      for (const xw of roads.crosswalks.values()) xw.peds = 0;
      camera.updateMatrixWorld();
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
      for (const p of allPools) p.begin();
      dogs?.begin(); blobs?.begin(); if (blobs) blobs.mat.uniforms.uTime.value = time;
      separate(cp, dt); // (peds r2)
      const handle = (a) => {
        const dxc = a.x - cp.x, dzc = a.z - cp.z, dc2 = dxc * dxc + dzc * dzc;
        // time-sliced simulation: < 110 m every frame, 110-300 m (drawn) every 4th, beyond (not drawn) every 12th frame
        // (perf r2) 45-110 m every 2nd frame (was every frame): ~1 px steps at 30 Hz there; reactions / looks stay per frame
        const slice = SLICE2 ? (dc2 < 45 * 45 || a.react ? 1 : dc2 < 110 * 110 ? 2 : dc2 < 310 * 310 ? 4 : 12) : dc2 < 110 * 110 ? 1 : dc2 < 310 * 310 ? 4 : 12;
        const sdt = slice === 1 ? dt : ((frame + a.slot) % slice === 0 ? Math.min(dt * slice, 0.5) : 0);
        if (sdt > 0) {
          const d = toPlayer(a);
          let held = false;
          if (d < 45 || alarms.length || zones.size || a.react || (player.landT > time - 0.3)) held = reactions(a, sdt, d);
          if (!held) {
            if (a.mode === 'walk' || a.mode === 'toCurb' || a.mode === 'wait' || a.mode === 'cross' || a.mode === 'rejoin') stepWalker(a, sdt);
            else if (a.mode === 'path') stepPath(a, sdt);
            else if (a.mode === 'wander') stepWander(a, sdt);
            else if (a.mode === 'prom') stepProm(a, sdt);
            else if (a.mode === 'stand') { if (a.hx !== undefined) { a.x += (a.hx - a.x) * Math.min(1, sdt * 0.5); a.z += (a.hz - a.z) * Math.min(1, sdt * 0.5); turnTo(a, a.hry, 1.5, sdt); } setClip(a, a.idleClip); }
          } else if (a.mode === 'cross') { if (onRoad(a.x, a.z)) a.xw.peds++; }
          if (d < 40) { look(a, sdt, d); dodge(a, d, sdt); } else if (dc2 < 60 * 60) look(a, sdt, 99); // (peds r3) glances near the camera
          else if (a.lookYaw || a.lookPitch) { a.lookYaw *= 0.9; a.lookPitch *= 0.9; }
          a._hy = undefined; // (perf r2) moved: re-derive the cached height / on-road flag
        } else if (a.mode === 'cross' && (a._hy === undefined ? onRoad(a.x, a.z) : a._or)) a.xw.peds++; // (perf r2) cached
        if (dc2 > LOD_D[2] * LOD_D[2]) return;
        if (dc2 > 400) { sph.center.set(a.x, a.y + 0.9, a.z); sph.radius = 1.1; if (!frustum.intersectsSphere(sph)) return; }
        const lod = dc2 < LOD_D[0] * LOD_D[0] ? 0 : dc2 < LOD_D[1] * LOD_D[1] ? 1 : 2;
        if (a._hy === undefined) { a._hy = heightAt(a); a._or = a._hy === 0 && onRoad(a.x, a.z); } // (perf r2) only after a step
        const hy = a._hy;
        pools[a.vi][lod].push(a, a.x, hy, a.z);
        if (blobs && dc2 < BLOB_D * BLOB_D && a.mode !== 'sit') blobs.push(a, hy, Math.sqrt(dc2)); // (peds r2) contact shadow
        if (a.dog && lod < 2) dogs.push(a, hy, lod, time);
      };
      for (const a of agents) handle(a);
      const q2 = PF ? performance.now() : 0;
      for (const a of statics) {
        const dx = a.x - cp.x, dz = a.z - cp.z;
        if (dx * dx + dz * dz > (LOD_D[2] + 20) ** 2 && !(a.mode === 'path' || a.mode === 'prom')) continue;
        if (dx * dx + dz * dz > (LOD_D[2] + 20) ** 2) { // cheap far advance for moving statics
          if ((frame + a.vi) % 8 === 0) { if (a.mode === 'path') stepPath(a, dt * 8); else stepProm(a, dt * 8); a._hy = undefined; } // (perf r2)
          continue;
        }
        handle(a);
      }
      if (agents.some(a => a.dead)) compact();
      const q3 = PF ? performance.now() : 0;
      for (const p of allPools) p.end();
      dogs?.end(); blobs?.end();
      if (PF) { const q4 = performance.now(), a_ = (k, v) => { PF[k] = (PF[k] ?? v) * 0.95 + v * 0.05; PF[k + 'Max'] = Math.max(PF[k + 'Max'] || 0, v); }; a_('stream', q1 - q0); a_('agents', q2 - q1); a_('statics', q3 - q2); a_('upload', q4 - q3); PF.n = agents.length; PF.ns = statics.length; }
    },
    stats() {
      let drawn = 0; for (const p of allPools) drawn += p.n;
      let park = 0, near = 0; for (const a of agents) { if (a.park) park++; else if (a.tier === 'near') near++; }
      return { people: agents.length + statics.length, peopleDrawn: drawn, parkPeople: park, nearTier: near };
    },
    // everyone (streamed + static) within r metres of (x,z) — for critics / tools
    near(x, z, r = 80) {
      let n = 0; const r2 = r * r;
      for (const L of [agents, statics]) for (const a of L) if ((a.x - x) ** 2 + (a.z - z) ** 2 < r2) n++;
      return n;
    },
  };
  return api;
}
