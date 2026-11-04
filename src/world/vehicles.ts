// @ts-nocheck
// Procedural low-poly vehicles (lofted bodies, glass cabins, pillars, wheels, lights) +
// cheap lane-following traffic with IDM car-following and traffic-light stops. All instanced (1 draw per model).
// Model frame: +x forward, y up, wheels on y=0.
import { lazyShaderSections } from "../shaderSections.ts";
import vehiclesShaderSource from "./shaders/glsl/vehicles.glsl?raw";
import * as THREE from "three";
import { assetUrl } from "../assets.ts";
import { loadKTX2TextureAsync } from "../render/ktx2.ts";

import { MeshBuilder } from "./meshBuilder.ts";
import { createPartMaterial, MATERIAL_PART } from "./partMaterials.ts";
import { buildRoads } from "./npc/roads.ts";
import { createTraffic } from "./npc/traffic.ts";

const vehiclesShader = lazyShaderSections(() => vehiclesShaderSource);


// loft of rounded-rectangle sections. st: [{x, yb, yt, w, r}] from rear to front
function loft(b, st, seg = 3, caps = true) {
  const rings = [];
  for (const s of st) {
    const ring = [];
    const hw = s.w / 2,
      r = Math.min(s.r ?? 0.12, hw * 0.9, (s.yt - s.yb) * 0.45);
    // rounded rectangle in (z,y) plane, CCW starting bottom-center
    const corners = [
      [hw - r, s.yb + r, -Math.PI / 2],
      [hw - r, s.yt - r, 0],
      [-hw + r, s.yt - r, Math.PI / 2],
      [-hw + r, s.yb + r, Math.PI],
    ];
    for (const [cz, cy, a0] of corners) {
      for (let k = 0; k <= seg; k++) {
        const a = a0 + ((k / seg) * Math.PI) / 2;
        ring.push([
          s.x,
          cy + Math.sin(a) * r,
          cz + Math.cos(a) * r,
          Math.cos(a),
          Math.sin(a),
        ]);
      }
    }
    rings.push(ring);
  }
  const n = rings[0].length;
  const idx = rings.map((ring) =>
    ring.map(([x, y, z, nz, ny]) => b.vert(x, y, z, 0, ny, nz)),
  );
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      b.quad(idx[i][k], idx[i + 1][k], idx[i + 1][k2], idx[i][k2]);
    }
  }
  if (caps) {
    for (const [ri, sgn] of [
      [0, -1],
      [rings.length - 1, 1],
    ]) {
      const ring = rings[ri];
      const c = ring.reduce(
        (a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n],
        [0, 0, 0],
      );
      const ci = b.vert(c[0], c[1], c[2], sgn, 0, 0);
      const vs = ring.map((p) => b.vert(p[0], p[1], p[2], sgn, 0, 0));
      for (let k = 0; k < n; k++) {
        if (sgn > 0) b.tri(ci, vs[k], vs[(k + 1) % n]);
        else b.tri(ci, vs[(k + 1) % n], vs[k]);
      }
    }
  }
}
// winding check helper: our ring goes CCW in (z,y) seen from +x -> quads (i,k)->(i+1,k)->(i+1,k2) face outward
function wheel(b, x, z, r, w) {
  const side = Math.sign(z);
  b.setPart(MATERIAL_PART.RUBBER).setColor(0x151515);
  b.with(
    new THREE.Matrix4()
      .makeRotationX((side * Math.PI) / 2)
      .setPosition(x, r, z - (side * w) / 2),
    (d) => d.cyl(0, 0, 0, r, r, w, 9, true),
  );
  b.setPart(MATERIAL_PART.METAL).setColor(0x9a9ea2);
  b.with(
    new THREE.Matrix4()
      .makeRotationX((side * Math.PI) / 2)
      .setPosition(x, r, z + (side * w) / 2 - side * 0.005),
    (d) => d.cyl(0, 0, 0, r * 0.6, r * 0.55, 0.02, 8, true),
  );
}

function car({
  L = 4.9,
  W = 1.84,
  H = 1.46,
  belt = 0.95,
  hood = 0.9,
  cab0 = -1.35,
  cab1 = 1.05,
  roof0 = -0.8,
  roof1 = 0.35,
  wr = 0.33,
  taxi = false,
  wagon = false,
} = {}) {
  const b = new MeshBuilder();
  const h2 = L / 2;
  // lower body
  b.setPart(MATERIAL_PART.PAINT).setColor(0xffffff);
  loft(b, [
    { x: -h2, yb: 0.34, yt: belt - 0.2, w: W - 0.14, r: 0.12 },
    { x: -h2 + 0.12, yb: 0.28, yt: belt - 0.02, w: W - 0.04, r: 0.14 },
    { x: -h2 + 0.9, yb: 0.24, yt: belt, w: W, r: 0.14 },
    { x: cab1, yb: 0.24, yt: belt - 0.02, w: W, r: 0.14 },
    { x: h2 - 0.45, yb: 0.26, yt: hood - 0.08, w: W - 0.04, r: 0.14 },
    { x: h2 - 0.05, yb: 0.32, yt: hood - 0.28, w: W - 0.18, r: 0.12 },
  ]);
  // cabin glass
  b.setPart(MATERIAL_PART.GLASS).setColor(0x000000);
  const cw = W - 0.14,
    rw = W - 0.34;
  loft(
    b,
    wagon
      ? [
          { x: cab0, yb: belt - 0.05, yt: belt + 0.02, w: cw, r: 0.05 },
          { x: cab0 + 0.08, yb: belt - 0.05, yt: H - 0.04, w: rw, r: 0.1 },
          { x: roof1, yb: belt - 0.05, yt: H, w: rw, r: 0.1 },
          { x: cab1, yb: belt - 0.05, yt: belt + 0.02, w: cw, r: 0.05 },
        ]
      : [
          { x: cab0, yb: belt - 0.05, yt: belt + 0.02, w: cw, r: 0.05 },
          { x: roof0, yb: belt - 0.05, yt: H - 0.03, w: rw, r: 0.1 },
          { x: roof1, yb: belt - 0.05, yt: H, w: rw, r: 0.1 },
          { x: cab1, yb: belt - 0.05, yt: belt + 0.02, w: cw, r: 0.05 },
        ],
    2,
  );
  // roof skin + pillars (paint)
  b.setPart(MATERIAL_PART.PAINT).setColor(0xffffff);
  const r0 = wagon ? cab0 + 0.12 : roof0 + 0.06,
    r1 = roof1 - 0.04;
  loft(
    b,
    [
      { x: r0, yb: H - 0.07, yt: H - 0.01, w: rw - 0.02, r: 0.03 },
      { x: r1, yb: H - 0.06, yt: H + 0.01, w: rw - 0.02, r: 0.03 },
    ],
    1,
  );
  for (const s of [-1, 1]) {
    const zb = s * (cw / 2 - 0.02),
      zt = s * (rw / 2 - 0.02);
    b.tube([cab1 - 0.04, belt, zb], [roof1 - 0.02, H - 0.02, zt], 0.045, 4); // A
    b.tube(
      [(roof0 + roof1) / 2 - 0.1, belt, zb],
      [(roof0 + roof1) / 2 - 0.1, H - 0.02, zt],
      0.05,
      4,
    ); // B
    if (!wagon)
      b.tube([cab0 + 0.04, belt, zb], [roof0 + 0.02, H - 0.02, zt], 0.07, 4); // C
    else {
      b.tube([cab0 + 0.06, belt, zb], [cab0 + 0.1, H - 0.02, zt], 0.07, 4);
      b.tube([cab0 + 0.9, belt, zb], [cab0 + 0.9, H - 0.02, zt], 0.05, 4);
    }
    // mirrors
    b.box(
      cab1 - 0.25,
      belt + 0.02,
      s * (W / 2 + 0.02) - 0.08,
      cab1 - 0.1,
      belt + 0.14,
      s * (W / 2 + 0.02) + 0.08,
    );
  }
  // bumpers, grille, rockers
  b.setPart(MATERIAL_PART.PLASTIC).setColor(0x1a1a1a);
  b.box(h2 - 0.12, 0.28, -W / 2 + 0.12, h2 + 0.02, 0.5, W / 2 - 0.12);
  b.box(-h2 - 0.02, 0.28, -W / 2 + 0.12, -h2 + 0.12, 0.5, W / 2 - 0.12);
  b.box(h2 - 0.06, 0.52, -0.45, h2 - 0.02, 0.66, 0.45);
  b.box(-h2 + 0.9, 0.2, -W / 2 - 0.005, h2 - 0.9, 0.3, W / 2 + 0.005, 0b110011);
  // lights
  for (const s of [-1, 1]) {
    b.setPart(MATERIAL_PART.HEADLIGHT)
      .setColor(0xc8ccd0)
      .box(
        h2 - 0.16,
        hood - 0.36,
        s * (W / 2 - 0.16) - 0.16,
        h2 - 0.03,
        hood - 0.27,
        s * (W / 2 - 0.16) + 0.16,
      );
    b.setPart(MATERIAL_PART.TAILLIGHT)
      .setColor(0xb01010)
      .box(
        -h2 - 0.03,
        belt - 0.32,
        s * (W / 2 - 0.12) - 0.22,
        -h2 + 0.1,
        belt - 0.18,
        s * (W / 2 - 0.12) + 0.22,
      );
  }
  // plates
  b.setPart(MATERIAL_PART.BASE)
    .setColor(taxi ? 0xe6d27a : 0xe9e4d4)
    .box(-h2 - 0.04, 0.55, -0.26, -h2 - 0.02, 0.7, 0.26);
  b.box(h2 + 0.02, 0.36, -0.26, h2 + 0.04, 0.5, 0.26);
  if (taxi) {
    b.setPart(MATERIAL_PART.PLASTIC)
      .setColor(0x151515)
      .box(-0.3, H, -0.28, 0.14, H + 0.04, 0.28);
    b.setPart(MATERIAL_PART.TAXI)
      .setColor(0xd8d2b0)
      .box(-0.26, H + 0.04, -0.26, 0.1, H + 0.3, 0.26);
    b.setPart(MATERIAL_PART.PLASTIC)
      .setColor(0x2a2a2a)
      .box(-0.24, H + 0.08, -0.265, 0.08, H + 0.26, 0.265, 0b110000);
    // checker stripe
    b.setPart(MATERIAL_PART.BASE)
      .setColor(0x111111)
      .box(
        -1.2,
        belt - 0.24,
        -W / 2 - 0.006,
        1.0,
        belt - 0.2,
        W / 2 + 0.006,
        0b110000,
      );
  }
  for (const x of [-(h2 - 0.95), h2 - 0.85])
    for (const s of [-1, 1]) wheel(b, x, s * (W / 2 - 0.12), wr, 0.24);
  return b.build({ part: true });
}

function boxTruck() {
  const b = new MeshBuilder();
  const W = 2.3;
  // cab
  b.setPart(MATERIAL_PART.BASE).setColor(0xe8e8e6);
  loft(b, [
    { x: 1.6, yb: 0.45, yt: 2.5, w: W, r: 0.1 },
    { x: 2.6, yb: 0.45, yt: 2.45, w: W, r: 0.15 },
    { x: 3.2, yb: 0.5, yt: 1.45, w: W - 0.1, r: 0.15 },
    { x: 3.5, yb: 0.55, yt: 1.1, w: W - 0.2, r: 0.12 },
  ]);
  b.setPart(MATERIAL_PART.GLASS)
    .setColor(0)
    .box(2.62, 1.55, -W / 2 + 0.1, 3.08, 2.3, W / 2 - 0.1, 0b000001);
  b.box(1.9, 1.5, -W / 2 - 0.01, 2.55, 2.25, W / 2 + 0.01, 0b110000);
  // cargo box
  b.setPart(MATERIAL_PART.PAINT)
    .setColor(0xffffff)
    .box(-3.6, 0.9, -W / 2 - 0.05, 1.55, 3.5, W / 2 + 0.05);
  b.setPart(MATERIAL_PART.PLASTIC)
    .setColor(0x222222)
    .box(-3.62, 0.5, -1.0, 1.6, 0.9, 1.0);
  b.box(-3.7, 0.6, -W / 2, -3.55, 0.8, W / 2);
  for (const s of [-1, 1]) {
    b.setPart(MATERIAL_PART.HEADLIGHT)
      .setColor(0xf0f0f0)
      .box(3.45, 0.85, s * 0.9 - 0.15, 3.52, 1.0, s * 0.9 + 0.15);
    b.setPart(MATERIAL_PART.TAILLIGHT)
      .setColor(0xb01010)
      .box(-3.72, 1.0, s * 1.0 - 0.1, -3.65, 1.2, s * 1.0 + 0.1);
  }
  for (const x of [-2.4, 2.4])
    for (const s of [-1, 1]) wheel(b, x, s * (W / 2 - 0.2), 0.48, 0.3);
  return b.build({ part: true });
}

function bus({ tour = false } = {}) {
  const b = new MeshBuilder();
  const L = tour ? 11 : 12.2,
    W = 2.55,
    H = tour ? 4.3 : 3.1;
  const h2 = L / 2;
  const body = tour ? MATERIAL_PART.PAINT : MATERIAL_PART.BASE;
  b.setPart(body).setColor(tour ? 0xffffff : 0xeeeeea);
  loft(
    b,
    [
      { x: -h2, yb: 0.35, yt: H - 0.05, w: W - 0.05, r: 0.2 },
      { x: -h2 + 0.1, yb: 0.3, yt: H, w: W, r: 0.25 },
      { x: h2 - 0.15, yb: 0.3, yt: H, w: W, r: 0.25 },
      { x: h2, yb: 0.35, yt: H - 0.1, w: W - 0.05, r: 0.2 },
    ],
    3,
  );
  // window bands (glass slightly proud of the body)
  b.setPart(MATERIAL_PART.GLASS).setColor(0);
  const bands = tour
    ? [
        [1.25, 2.1],
        [2.55, 3.65],
      ]
    : [[1.2, 2.55]];
  for (const [y0, y1] of bands) {
    b.box(-h2 + 0.6, y0, -W / 2 - 0.012, h2 - 1.2, y1, W / 2 + 0.012, 0b110000);
    b.box(
      h2 + 0.005,
      y0 - 0.2,
      -W / 2 + 0.12,
      h2 + 0.015,
      y1,
      W / 2 - 0.12,
      0b000001,
    );
  }
  if (!tour) {
    // MTA blue stripe
    b.setPart(MATERIAL_PART.BASE)
      .setColor(0x1f4fa3)
      .box(
        -h2 + 0.05,
        1.0,
        -W / 2 - 0.014,
        h2 - 0.05,
        1.15,
        W / 2 + 0.014,
        0b110011,
      );
    b.setPart(MATERIAL_PART.SCREEN)
      .setColor(0xff9a20)
      .box(h2 + 0.016, 2.62, -0.8, h2 + 0.02, 2.9, 0.8, 0b000001);
  } else {
    b.setPart(MATERIAL_PART.BASE)
      .setColor(0xd9b34a)
      .box(
        -h2 + 0.05,
        2.2,
        -W / 2 - 0.014,
        h2 - 0.05,
        2.35,
        W / 2 + 0.014,
        0b110011,
      );
  }
  b.setPart(MATERIAL_PART.PLASTIC)
    .setColor(0x1a1a1a)
    .box(-h2 - 0.03, 0.3, -W / 2, h2 + 0.03, 0.6, W / 2, 0b000011);
  for (const s of [-1, 1]) {
    b.setPart(MATERIAL_PART.HEADLIGHT)
      .setColor(0xf0f0f0)
      .box(h2 + 0.01, 0.7, s * 1.0 - 0.15, h2 + 0.03, 0.85, s * 1.0 + 0.15);
    b.setPart(MATERIAL_PART.TAILLIGHT)
      .setColor(0xb01010)
      .box(-h2 - 0.03, 0.8, s * 1.1 - 0.08, -h2 - 0.01, 1.3, s * 1.1 + 0.08);
  }
  for (const x of [-h2 + 2.6, h2 - 2.4])
    for (const s of [-1, 1]) wheel(b, x, s * (W / 2 - 0.15), 0.5, 0.3);
  return b.build({ part: true });
}

// (user r-vanrear) "the white van's back panel is white at medium distance and has texture when I get near": every
// LOD's rear doors sampled one flat atlas texel (plain paint; up close only the grime / reflections gave it any detail).
// Planar-project the rear faces (paint + rear glass, all LODs) onto the imagegen rear-door card (atlas VAN_REAR px rect,
// packed by tools/imagegen/vehicles/pack_atlas.py) so windows, handles, hinges, tail lights and bumper read at every
// distance; the plate moves up into the card's plate recess. Rear = faces facing -x (incl. the rounded corners) within 0.6 m of the back.
const VAN_REAR = {
  x: 448,
  y: 1680,
  w: 320,
  h: 352,
  S: 2048,
  z0: -0.98,
  z1: 0.98,
  y0: 0.38,
  y1: 2.54,
};
function vanRear(g0) {
  const g = g0.index ? g0.toNonIndexed() : g0;
  const P = g.attributes.position,
    U = g.attributes.uv,
    part = g.attributes.aPart;
  if (!U || !part) return g0;
  const R = VAN_REAR,
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    n = new THREE.Vector3();
  let xmin = Infinity;
  for (let i = 0; i < P.count; i++) xmin = Math.min(xmin, P.getX(i));
  for (let t = 0; t < P.count; t += 3) {
    a.fromBufferAttribute(P, t);
    b.fromBufferAttribute(P, t + 1);
    c.fromBufferAttribute(P, t + 2);
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    if (n.x > -0.25 || (a.x + b.x + c.x) / 3 > xmin + 0.6) continue; // incl. the rounded rear corners (tail-light strips)
    const pt = part.getX(t);
    if (pt === 0) {
      for (let k = 0; k < 3; k++) P.setY(t + k, P.getY(t + k) + 0.33);
      continue;
    } // plate -> recess
    if (pt !== 1 && pt !== 3 && pt !== 6 && pt !== 8) continue;
    for (let k = 0; k < 3; k++) {
      const z = P.getZ(t + k),
        y = P.getY(t + k);
      const u = THREE.MathUtils.clamp((z - R.z0) / (R.z1 - R.z0), 0.004, 0.996),
        v = THREE.MathUtils.clamp((R.y1 - y) / (R.y1 - R.y0), 0.004, 0.996);
      U.setXY(t + k, (R.x + u * R.w) / R.S, (R.y + v * R.h) / R.S);
      part.setX(t + k, 1); // painted (instance-tinted off-white, clearcoat, grime band): the card carries the detail
    }
  }
  g.computeBoundingSphere();
  return g;
}

// Load the Blender-built models (tools/blender/city_vehicles.py). Returns {geos: {name: BufferGeometry}, atlas} or null.
// (vehicles r1) 13 models x 3 LODs: <name> (LOD0), <name>_l1, <name>_l2; atlas = vehicles_atlas2.webp (imagegen pack).
let _vehLoad = null; // one fetch/parse shared by the city traffic and systems/crimes.ts (car chase)
export function loadVehicleModels(renderer) {
  if (_vehLoad) return _vehLoad;
  _vehLoad = (async () => {
    try {
      const { GLTFLoader } =
        await import("three/examples/jsm/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync(
        assetUrl("city/vehicles.glb"),
      );
      const geos = {};
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry;
        const uv1 = g.attributes.uv1;
        const part = new Float32Array(g.attributes.position.count);
        for (let i = 0; i < part.length; i++) part[i] = Math.round(uv1.getX(i));
        g.setAttribute("aPart", new THREE.BufferAttribute(part, 1));
        g.deleteAttribute("uv1");
        // (vehicles r2) Cycles-baked AO (COLOR_0.r, ground plane included) -> aAO; 1.0 when a mesh has none
        const col = g.attributes.color,
          ao = new Float32Array(part.length).fill(1);
        if (col) {
          for (let i = 0; i < ao.length; i++)
            ao[i] = Math.pow(col.getX(i), 1 / 2.2);
          g.deleteAttribute("color");
        } // COLOR_0 is linear, the bake sRGB
        g.setAttribute("aAO", new THREE.BufferAttribute(ao, 1));
        g.applyMatrix4(o.matrixWorld);
        g.computeBoundingSphere();
        geos[o.name] = /^van(_l\d)?$/.test(o.name) ? vanRear(g) : g;
      });
      const atlasUrl = assetUrl("city/tex/vehicles_atlas2.webp");
      let atlas;
      try {
        atlas = await loadKTX2TextureAsync(atlasUrl);
        console.info("[city] vehicles_atlas2 loaded (KTX2)");
      } catch (ktxError) {
        console.warn(
          "[city] vehicles_atlas2 KTX2 failed; loading the WebP source",
          ktxError,
        );
        atlas = await new THREE.TextureLoader().loadAsync(atlasUrl);
        console.info("[city] vehicles_atlas2 loaded (WebP fallback)");
      }
      atlas.colorSpace = THREE.SRGBColorSpace;
      atlas.flipY = false;
      atlas.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      atlas.needsUpdate = true;
      return { geos, atlas };
    } catch (e) {
      console.warn(
        "[city] vehicles.glb not available, using procedural vehicles",
        e,
      );
      return null;
    }
  })();
  return _vehLoad;
}

// (vehicles) car-paint material: the shared part material (partMaterials.ts) + clearcoat over paint / taxi / glass (crisp env
// reflections from scene.environment), tinted glass that shows the imagegen interior cards (seats, driver) darkened
// under the reflections, and road grime + dull paint on the lower panels (model-space height). physical=false for LOD2.
export function createVehicleMaterial({ name, map, physical = true }) {
  const mat = createPartMaterial({
    name,
    instanceTint: true,
    instanceState: true,
    physical,
    map,
    extraVertexDeclarations: vehiclesShader.vertexAttributeDeclarations,
    // (vehicles r2) taxi toppers map ad slot 0 (atlas2 u 0.5-0.75, v 0-170/2048); re-target one of 8 ad tiles per car
    extraVertexSetup: vehiclesShader.vertexMain,
  });
  if (physical) {
    mat.clearcoat = 1.0;
    mat.clearcoatRoughness = 0.06;
  }
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base(sh, r);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", vehiclesShader.fragmentCommon)
      .replace(
        "diffuseColor.rgb = vec3(0.012, 0.014, 0.016); pR = 0.04;",
        vehiclesShader.fragmentPaintBaseColor,
      ) // (vehicles r3) brighter interior, softer sun glint
      // (vehicles r3) studio-style "horizon line" reflection: the scene env is a near-uniform sky/facade mix, so paint
      // and glass reflected almost nothing readable. vehHorizon() keeps the env's sky above the horizon, darkens a
      // blocky skyline band + the street below it -> the classic bright-over-dark reflection line on doors / hood / glass.
      .replace("#include <lights_physical_pars_fragment>", vehiclesShader.fragmentPhysicalLightDeclarations)
      .replace("#include <lights_fragment_maps>", vehiclesShader.fragmentLightsMaps)
      .replace("roughnessFactor = pR;", vehiclesShader.fragmentRoughnessFromVehicleMaterial)
      .replace("#include <aomap_fragment>", vehiclesShader.fragmentAmbientOcclusion)
      .replace("#include <lights_physical_fragment>", vehiclesShader.fragmentPhysicalLights);
  };
  mat.customProgramCacheKey = () => `city-veh-${name}-${physical}`;
  return mat;
}

// far-LOD proxy (~60 tris): body + cabin boxes, dark glass band, wheels as dark boxes
function proxy(type) {
  const b = new MeshBuilder();
  const big = type === "truck" || type === "bus" || type === "tour";
  if (!big) {
    const L = type === "suv" ? 5.0 : 4.9,
      W = type === "suv" ? 1.95 : 1.84,
      H = type === "suv" ? 1.8 : 1.46,
      belt = type === "suv" ? 1.12 : 0.95;
    b.setPart(MATERIAL_PART.PAINT)
      .setColor(0xffffff)
      .box(-L / 2, 0.28, -W / 2, L / 2, belt, W / 2);
    b.setPart(MATERIAL_PART.GLASS)
      .setColor(0)
      .box(
        type === "suv" ? -2.2 : -1.3,
        belt,
        -W / 2 + 0.08,
        1.0,
        H - 0.06,
        W / 2 - 0.08,
        0b110111,
      );
    b.setPart(MATERIAL_PART.PAINT)
      .setColor(0xffffff)
      .box(
        type === "suv" ? -2.15 : -0.8,
        H - 0.06,
        -W / 2 + 0.12,
        0.3,
        H,
        W / 2 - 0.12,
        0b000100,
      );
    b.setPart(MATERIAL_PART.TAILLIGHT)
      .setColor(0xb01010)
      .box(
        -L / 2 - 0.02,
        belt - 0.3,
        -W / 2 + 0.1,
        -L / 2,
        belt - 0.15,
        W / 2 - 0.1,
        0b000010,
      );
    if (type === "taxi")
      b.setPart(MATERIAL_PART.TAXI)
        .setColor(0xd8d2b0)
        .box(-0.26, H, -0.26, 0.1, H + 0.28, 0.26);
    b.setPart(MATERIAL_PART.RUBBER)
      .setColor(0x111111)
      .box(
        -L / 2 + 0.6,
        0,
        -W / 2 + 0.05,
        L / 2 - 0.6,
        0.3,
        W / 2 - 0.05,
        0b110011,
      );
  } else if (type === "truck") {
    b.setPart(MATERIAL_PART.BASE)
      .setColor(0xe8e8e6)
      .box(1.6, 0.45, -1.15, 3.5, 2.45, 1.15);
    b.setPart(MATERIAL_PART.GLASS)
      .setColor(0)
      .box(2.62, 1.55, -1.05, 3.1, 2.3, 1.05, 0b000001);
    b.setPart(MATERIAL_PART.PAINT)
      .setColor(0xffffff)
      .box(-3.6, 0.9, -1.2, 1.55, 3.5, 1.2);
    b.setPart(MATERIAL_PART.RUBBER)
      .setColor(0x111111)
      .box(-3.0, 0, -1.0, 3.0, 0.9, 1.0, 0b110011);
  } else {
    const L = type === "tour" ? 11 : 12.2,
      H = type === "tour" ? 4.3 : 3.1;
    b.setPart(type === "tour" ? MATERIAL_PART.PAINT : MATERIAL_PART.BASE)
      .setColor(type === "tour" ? 0xffffff : 0xeeeeea)
      .box(-L / 2, 0.3, -1.27, L / 2, H, 1.27);
    b.setPart(MATERIAL_PART.GLASS)
      .setColor(0)
      .box(
        -L / 2 + 0.6,
        1.2,
        -1.285,
        L / 2 - 1.2,
        type === "tour" ? 3.65 : 2.55,
        1.285,
        0b110001,
      );
    if (type !== "tour")
      b.setPart(MATERIAL_PART.BASE)
        .setColor(0x1f4fa3)
        .box(-L / 2, 1.0, -1.29, L / 2, 1.15, 1.29, 0b110011);
  }
  return b.build({ part: true });
}

// (vehicles r1) model set: base = procedural fallback type (no glb), grp = LOD2 / shadow-proxy group (1 draw per group)
export const VMODELS = {
  taxi: { base: "taxi", grp: "car" },
  taxi_hy: { base: "taxi", grp: "car" },
  taxi_mv: { base: "taxi", grp: "tall" },
  taxi_gr: { base: "taxi", grp: "car" },
  sedan: { base: "sedan", grp: "car" },
  hatch: { base: "sedan", grp: "car" },
  sedan2: { base: "sedan", grp: "car" },
  cross: { base: "suv", grp: "tall" }, // (vehicles r3) +2 variants
  suv: { base: "suv", grp: "tall" },
  suv2: { base: "suv", grp: "tall" },
  pickup: { base: "suv", grp: "tall" },
  van: { base: "truck", grp: "van" },
  truck: { base: "truck", grp: "truck" },
  bus: { base: "bus", grp: "bus" },
  tour: { base: "tour", grp: "tour" },
};
const GRP_REP = {
  car: "sedan",
  tall: "suv",
  van: "van",
  truck: "truck",
  bus: "bus",
  tour: "tour",
};

// Streaming traffic over the whole road network (see npc/traffic.ts). `phase` = shared signal phase (props.phase).
export function buildTraffic({ scene, phase, models = null }) {
  const proc = {
    taxi: car({ taxi: true }),
    sedan: car({}),
    suv: car({
      L: 5.0,
      W: 1.95,
      H: 1.8,
      belt: 1.12,
      hood: 1.08,
      cab0: -2.2,
      cab1: 0.95,
      roof0: -1.9,
      roof1: 0.3,
      wr: 0.38,
      wagon: true,
    }),
    truck: boxTruck(),
    bus: bus(),
    tour: bus({ tour: true }),
  };
  const G = models ? models.geos : {};
  const glb = !!(models && G.sedan && G.sedan_l1 && G.sedan_l2);
  // hi = LOD0 (< HI_D), low = LOD1 (< LOW_D) or the procedural body, far[grp] = LOD2 (or procedural proxy)
  const hi = {},
    low = {},
    far = {};
  for (const t of Object.keys(VMODELS)) {
    const b = VMODELS[t].base;
    if (glb && G[t] && G[t + "_l1"]) {
      hi[t] = G[t];
      low[t] = G[t + "_l1"];
    } else {
      low[t] = proc[b].clone();
      if (G[b]) hi[t] = G[b].clone();
    }
  }
  for (const [g, rep] of Object.entries(GRP_REP))
    far[g] = glb && G[rep + "_l2"] ? G[rep + "_l2"] : proxy(VMODELS[rep].base);
  const map = models ? models.atlas : null;
  const mats = glb
    ? {
        hi: createVehicleMaterial({ name: "veh0", map }),
        mid: createVehicleMaterial({ name: "veh1", map }),
        far: createVehicleMaterial({ name: "veh2", map, physical: false }),
      }
    : {
        hi: createPartMaterial({
          name: "vehglb",
          instanceTint: true,
          instanceState: true,
          map,
        }),
        mid: null,
        far: null,
      };
  if (!glb) {
    mats.low = createPartMaterial({
      name: "veh",
      instanceTint: true,
      instanceState: true,
    });
    mats.mid = mats.low;
    mats.far = mats.low;
  }
  const roads = buildRoads();
  const sim = createTraffic({
    scene,
    roads,
    phase,
    geos: { hi, low, far, glb },
    mats,
    models: VMODELS,
  });
  let cam = null;
  return {
    sim,
    roads,
    // update(dt, camera | cameraPosition, time, clear)
    update(dt, camOrPos, t, clear = null) {
      if (camOrPos && camOrPos.isCamera) cam = camOrPos;
      else if (!cam)
        cam = (typeof window !== "undefined" && window.__ctx?.camera) || null;
      if (!cam) return;
      sim.update(dt, cam, t, clear);
    },
  };
}
