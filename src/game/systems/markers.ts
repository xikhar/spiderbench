// @ts-nocheck
import { lazyShaderSections } from "../../shaderSections.ts";
import markersShaderSource from "./shaders/glsl/markers.glsl?raw";
import markerVertex from "./shaders/vertex/markers.vert?raw";
import towerBeamFragment from "./shaders/fragment/tower-beam.frag?raw";
import waypointPillarFragment from "./shaders/fragment/waypoint-pillar.frag?raw";
// 3D world objects for open-world systems (all procedural, merged / instanced):
//   research towers (lattice mast + dish + beacon), backpacks (webbed to walls / roofs), subway entrances,
//   waypoint light pillar, tower "district scan" pulse. ~12 draw calls total.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const markersShader = lazyShaderSections(() => markersShaderSource);


const _up = new THREE.Vector3(0, 1, 0),
  _z = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------------ geometry builder with vertex colours
class Builder {
  constructor() {
    this.parts = [];
  }
  add(geo, color, m) {
    geo = geo.toNonIndexed ? (geo.index ? geo.toNonIndexed() : geo) : geo;
    for (const k of Object.keys(geo.attributes))
      if (!["position", "normal", "uv"].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv)
      geo.setAttribute(
        "uv",
        new THREE.BufferAttribute(
          new Float32Array(geo.attributes.position.count * 2),
          2,
        ),
      );
    if (m) geo.applyMatrix4(m);
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = c.r;
      a[i * 3 + 1] = c.g;
      a[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(a, 3));
    this.parts.push(geo);
    return this;
  }
  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1),
    );
    return this.add(new THREE.BoxGeometry(w, h, d), color, m);
  }
  rod(a, b, r, color, seg = 6) {
    // cylinder between two points
    const d = new THREE.Vector3().subVectors(b, a);
    const L = d.length();
    const g = new THREE.CylinderGeometry(r, r, L, seg, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(_up, d.normalize());
    const m = new THREE.Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      q,
      new THREE.Vector3(1, 1, 1),
    );
    return this.add(g, color, m);
  }
  geo(g, color, pos, quat, scale) {
    return this.add(
      g,
      color,
      new THREE.Matrix4().compose(
        pos || new THREE.Vector3(),
        quat || new THREE.Quaternion(),
        scale || new THREE.Vector3(1, 1, 1),
      ),
    );
  }
  build() {
    const g = mergeGeometries(this.parts, false);
    g.computeBoundingSphere();
    return g;
  }
}

// Research tower (Insomniac-style): ~34 m tapered steel lattice on a concrete plinth with equipment cabinets, three
// service platforms, red/white day-marker bands, a big dish, panel antennas, and a crown ring that carries the beacon
// (the crown + sky beam are separate emissive meshes, see addTower). Local origin = roof surface.
export const TOWER_H = 30;
function towerGeometry() {
  const B = new Builder(),
    V = (x, y, z) => new THREE.Vector3(x, y, z);
  const steel = 0x9aa1aa,
    dark = 0x23272e,
    red = 0xb3141d,
    white = 0xeceef2,
    conc = 0x7a7c80;
  B.box(5.2, 0.6, 5.2, 0, 0.3, 0, conc);
  B.box(1.6, 2.1, 0.9, 1.5, 1.65, -1.7, dark);
  B.box(1.4, 0.12, 0.7, 1.5, 2.76, -1.7, steel);
  B.box(1.0, 1.5, 0.8, -1.7, 1.35, -1.6, dark);
  B.box(0.9, 1.1, 0.7, -1.8, 1.15, 1.6, 0x3a3f47);
  const H = TOWER_H,
    levels = 12;
  const half = (y) => THREE.MathUtils.lerp(1.55, 0.42, Math.pow(y / H, 0.8));
  const corners = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ];
  for (const [sx, sz] of corners)
    B.rod(
      V(sx * half(0.6), 0.6, sz * half(0.6)),
      V(sx * half(H), H, sz * half(H)),
      0.1,
      steel,
      6,
    );
  for (let l = 0; l < levels; l++) {
    const y0 = 0.6 + ((H - 0.6) * l) / levels,
      y1 = 0.6 + ((H - 0.6) * (l + 1)) / levels;
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c],
        [bx, bz] = corners[(c + 1) % 4];
      B.rod(
        V(ax * half(y0), y0, az * half(y0)),
        V(bx * half(y1), y1, bz * half(y1)),
        0.045,
        steel,
        4,
      );
      B.rod(
        V(bx * half(y0), y0, bz * half(y0)),
        V(ax * half(y1), y1, az * half(y1)),
        0.045,
        steel,
        4,
      );
      B.rod(
        V(ax * half(y1), y1, az * half(y1)),
        V(bx * half(y1), y1, bz * half(y1)),
        0.05,
        steel,
        4,
      );
    }
  }
  // ladder up one face
  B.rod(
    V(0.18, 0.6, half(0.6) + 0.05),
    V(0.18, H - 2, half(H - 2) + 0.05),
    0.02,
    dark,
    4,
  );
  B.rod(
    V(-0.18, 0.6, half(0.6) + 0.05),
    V(-0.18, H - 2, half(H - 2) + 0.05),
    0.02,
    dark,
    4,
  );
  // service platforms with railings
  for (const y of [10, 19, 26]) {
    const r = half(y) + 0.9;
    B.box(r * 2, 0.1, r * 2, 0, y, 0, dark);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      B.rod(
        V(Math.cos(a) * r * 0.98, y, Math.sin(a) * r * 0.98),
        V(Math.cos(a) * r * 0.98, y + 1.0, Math.sin(a) * r * 0.98),
        0.025,
        steel,
        3,
      );
    }
    B.geo(
      new THREE.TorusGeometry(r * 0.98, 0.035, 4, 32),
      steel,
      V(0, y + 1.0, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
    );
  }
  // red/white day-marker bands on the upper mast
  for (let i = 0; i < 4; i++) {
    const y = 20.5 + i * 1.3,
      w = half(y) * 2 + 0.12;
    B.box(w, 1.3, w, 0, y + 0.65, 0, i % 2 ? white : red);
  }
  // big dish + small dish
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const r = (i / 10) * 2.0;
    prof.push(new THREE.Vector2(r, r * r * 0.2));
  }
  const dq = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2 + 0.3, 0.7, 0),
  );
  B.geo(new THREE.LatheGeometry(prof, 28), white, V(1.6, 20.8, 1.1), dq);
  B.rod(V(0.6, 19.3, 0.4), V(1.6, 20.8, 1.1), 0.08, dark);
  B.geo(
    new THREE.ConeGeometry(0.12, 0.9, 6),
    dark,
    V(1.6, 20.8, 1.1).add(new THREE.Vector3(0, 0.4, 0).applyQuaternion(dq)),
    dq,
  );
  const dq2 = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2 + 0.2, -2.1, 0),
  );
  B.geo(
    new THREE.LatheGeometry(
      prof.map((p) => p.clone().multiplyScalar(0.55)),
      20,
    ),
    white,
    V(-1.2, 11.2, -0.9),
    dq2,
  );
  // panel antennas + top whip
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    B.box(
      0.36,
      1.9,
      0.12,
      Math.cos(a) * 0.75,
      27.6,
      Math.sin(a) * 0.75,
      white,
      -a + Math.PI / 2,
    );
  }
  B.rod(V(0, H, 0), V(0, H + 4.5, 0), 0.05, steel, 4);
  return B.build();
}

function backpackGeometry() {
  const B = new Builder(),
    V = (x, y, z) => new THREE.Vector3(x, y, z);
  // local frame: +Z = away from the mount surface, +Y = pack "up". Charcoal canvas pack, red accents, grey zips.
  const body = 0x33373f,
    pocket = 0x8e1d24,
    strap = 0x15171b,
    web = 0xe9ecf2,
    zip = 0xa9aeb8,
    trim = 0x23262c;
  const rb = (w, h, d, r, x, y, z, c, rx = 0) =>
    B.geo(
      new RoundedBoxGeometry(w, h, d, 3, r),
      c,
      V(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)),
    );
  rb(0.36, 0.46, 0.2, 0.06, 0, 0, 0.1, body); // main compartment
  rb(0.35, 0.14, 0.215, 0.05, 0, 0.19, 0.105, trim, -0.12); // top flap
  rb(0.27, 0.2, 0.09, 0.035, 0, -0.08, 0.215, pocket); // front pocket
  B.box(0.24, 0.012, 0.012, 0, 0.022, 0.26, zip); // pocket zip
  B.box(0.012, 0.36, 0.012, 0.172, 0.0, 0.18, zip);
  B.box(0.012, 0.36, 0.012, -0.172, 0.0, 0.18, zip);
  B.rod(V(-0.06, 0.24, 0.06), V(0, 0.285, 0.06), 0.012, strap, 5);
  B.rod(V(0, 0.285, 0.06), V(0.06, 0.24, 0.06), 0.012, strap, 5); // grab handle
  rb(0.06, 0.4, 0.03, 0.012, -0.1, -0.01, 0.008, strap);
  rb(0.06, 0.4, 0.03, 0.012, 0.1, -0.01, 0.008, strap); // shoulder straps
  rb(0.07, 0.14, 0.06, 0.02, 0.2, -0.08, 0.1, pocket);
  rb(0.07, 0.14, 0.06, 0.02, -0.2, -0.08, 0.1, pocket); // side pockets
  // web splat pinning it to the surface: radial strands + two rings of sagging cross threads
  const c = V(0, 0.0, 0.27);
  const tips = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const r = 0.4 + ((i * 7) % 3) * 0.07;
    tips.push(V(Math.cos(a) * r, Math.sin(a) * r, 0.005));
  }
  for (const t of tips) B.rod(c, t, 0.0055, web, 3);
  for (const k of [0.45, 0.72]) {
    const pts = tips.map((t) =>
      c
        .clone()
        .lerp(t, k)
        .add(V(0, 0, 0.02 * (1 - k))),
    );
    for (let i = 0; i < pts.length; i++)
      B.rod(pts[i], pts[(i + 1) % pts.length], 0.0045, web, 3);
  }
  return B.build();
}

function stationGeometry() {
  // entrance footprint 1.7 x 3.4 m along local Z, stairs going "down" toward -Z, opening at +Z
  const B = new Builder(),
    V = (x, y, z) => new THREE.Vector3(x, y, z);
  const green = 0x1f4d33,
    dark = 0x0b0c0e,
    step = 0x3a3b3e,
    curb = 0x8a8a86;
  B.box(1.9, 0.04, 3.6, 0, 0.0, 0, curb);
  B.box(1.5, 0.05, 3.3, 0, 0.012, 0, dark);
  for (let i = 0; i < 9; i++)
    B.box(1.46, 0.02, 0.06, 0, 0.04, 1.45 - i * 0.34, step);
  // railings on 3 sides (open at +Z)
  const rail = (a, b) => {
    B.rod(a.clone().setY(1.0), b.clone().setY(1.0), 0.03, green, 6);
    B.rod(a.clone().setY(0.5), b.clone().setY(0.5), 0.015, green, 4);
  };
  const P = [
    V(-0.9, 0, 1.75),
    V(-0.9, 0, -1.75),
    V(0.9, 0, -1.75),
    V(0.9, 0, 1.75),
  ];
  rail(P[0], P[1]);
  rail(P[1], P[2]);
  rail(P[2], P[3]);
  for (const [a, b] of [
    [P[0], P[1]],
    [P[1], P[2]],
    [P[2], P[3]],
  ]) {
    const L = a.distanceTo(b),
      n = Math.round(L / 0.14);
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      B.rod(
        p.clone().setY(0.02),
        p.clone().setY(1.0),
        i % 6 === 0 ? 0.025 : 0.009,
        green,
        4,
      );
    }
  }
  // lamp posts at the opening
  for (const sx of [-1, 1]) {
    B.rod(V(sx * 0.9, 0, 1.75), V(sx * 0.9, 2.3, 1.75), 0.045, green, 8);
    B.geo(
      new THREE.CylinderGeometry(0.1, 0.07, 0.14, 8),
      green,
      V(sx * 0.9, 2.34, 1.75),
    );
  }
  // sign board frame
  B.box(1.7, 0.36, 0.06, 0, 1.36, -1.78, dark);
  return B.build();
}

export function createMarkers(scene, renderer) {
  const root = new THREE.Group();
  root.name = "systems-markers";
  scene.add(root);
  const std = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    metalness: 0.35,
  });
  const packMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.75,
    metalness: 0.0,
    emissive: 0x5a6a80,
    emissiveIntensity: 0.0,
  });
  // make the web strands glow a touch (vertex colour > 0.85) so backpacks read from a distance
  packMat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = packMat.userData.uGlow = packMat.userData.uGlow || {
      value: 0.6,
    };
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", markersShader.fragmentCommon)
      .replace("#include <emissivemap_fragment>", markersShader.fragmentEmissive);
  };
  packMat.customProgramCacheKey = () => "sys-backpack";

  // ---------------- towers
  const towerGeo = towerGeometry();
  const towers = new Map();
  const beamMat = (col) =>
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uFade: { value: 1 }, uCol: { value: col } },
      vertexShader: markerVertex,
      fragmentShader: towerBeamFragment,
    });
  const beamGeo = new THREE.CylinderGeometry(0.5, 0.5, 360, 16, 1, true);
  beamGeo.translate(0, 180, 0);
  const crownGeo = (() => {
    const g = new THREE.TorusGeometry(1.35, 0.13, 8, 40);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  const RED = new THREE.Color(2.6, 0.12, 0.1),
    BLUE = new THREE.Color(0.25, 1.1, 2.6);
  function addTower(t) {
    const g = new THREE.Group();
    g.position.copy(t.pos);
    g.rotation.y = (t.pos.x * 0.013 + t.pos.z * 0.007) % (Math.PI * 2);
    const m = new THREE.Mesh(towerGeo, std);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    const bm = new THREE.MeshStandardMaterial({
      color: 0x220000,
      emissive: 0xff2020,
      emissiveIntensity: 30,
      roughness: 0.3,
    });
    // (perf r2) beacon + crown + the 3 status bands share material bm: one merged mesh (1 draw instead of 5). All parts
    // are rings / a sphere centred on the mast axis, so the crown's spin about y (update) looks the same.
    // status light bands on the three service platforms (red blinking = scrambled, steady cyan = online)
    const parts = [
      new THREE.SphereGeometry(0.34, 16, 10).translate(0, TOWER_H + 4.6, 0),
      crownGeo.clone().translate(0, TOWER_H + 0.4, 0),
    ];
    for (const [y, r] of [
      [10, 1.62],
      [19, 1.2],
      [26, 0.95],
    ])
      parts.push(
        new THREE.TorusGeometry(r + 0.9, 0.05, 6, 48)
          .rotateX(Math.PI / 2)
          .translate(0, y + 1.02, 0),
      );
    const crown = new THREE.Mesh(mergeGeometries(parts), bm);
    crown.name = "towerLights";
    g.add(crown);
    for (const q of parts) q.dispose();
    const beam = new THREE.Mesh(beamGeo, beamMat(RED.clone()));
    beam.position.y = TOWER_H + 4.6;
    beam.frustumCulled = false;
    beam.renderOrder = 4;
    g.add(beam);
    root.add(g);
    towers.set(t.id, { g, bm, beam, crown, active: false, t, flare: 0 });
    // collision boxes (tower-local AABBs): plinth, equipment cabinets, lattice mast (lower / upper), dish platform
    const ry = g.rotation.y,
      c = Math.cos(ry),
      sn = Math.sin(ry);
    for (const [cx, cy, cz, hx, hy, hz] of [
      [0, 0.3, 0, 2.6, 0.3, 2.6],
      [1.5, 1.65, -1.7, 0.8, 1.05, 0.45],
      [-1.7, 1.35, -1.6, 0.5, 0.75, 0.4],
      [-1.8, 1.15, 1.6, 0.45, 0.55, 0.35],
      [0, 5.3, 0, 1.55, 4.7, 1.55],
      [0, 20, 0, 1.25, 10, 1.25],
    ])
      colliders.push({
        o: t.pos,
        c,
        s: sn,
        min: [cx - hx, cy - hy, cz - hz],
        max: [cx + hx, cy + hy, cz + hz],
      });
  }
  // ---------------- extra colliders: ray / ground queries against the tower boxes (world-space API)
  const colliders = [];
  const _lo = new THREE.Vector3(),
    _ld = new THREE.Vector3();
  function toLocal(C, p, out) {
    const x = p.x - C.o.x,
      z = p.z - C.o.z;
    return out.set(x * C.c - z * C.s, p.y - C.o.y, x * C.s + z * C.c);
  } // inverse Y rotation
  function dirLocal(C, d, out) {
    return out.set(d.x * C.c - d.z * C.s, d.y, d.x * C.s + d.z * C.c);
  }
  function raycastExtra(origin, dir, max = 1000) {
    let best = null;
    for (const C of colliders) {
      if (
        Math.abs(origin.x - C.o.x) > max + 40 ||
        Math.abs(origin.z - C.o.z) > max + 40
      )
        continue;
      toLocal(C, origin, _lo);
      dirLocal(C, dir, _ld);
      let t0 = 0,
        t1 = max,
        axis = -1;
      const o = [_lo.x, _lo.y, _lo.z],
        d = [_ld.x, _ld.y, _ld.z];
      let ok = true;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(d[a]) < 1e-9) {
          if (o[a] < C.min[a] || o[a] > C.max[a]) {
            ok = false;
            break;
          }
          continue;
        }
        let ta = (C.min[a] - o[a]) / d[a],
          tb = (C.max[a] - o[a]) / d[a];
        if (ta > tb) {
          const q = ta;
          ta = tb;
          tb = q;
        }
        if (ta > t0) {
          t0 = ta;
          axis = a;
        }
        if (tb < t1) t1 = tb;
        if (t0 > t1) {
          ok = false;
          break;
        }
      }
      if (!ok || axis < 0 || (best && t0 >= best.distance)) continue; // axis<0: origin inside -> ignore (don't trap)
      const nl = [0, 0, 0];
      nl[axis] = d[axis] > 0 ? -1 : 1;
      const n = new THREE.Vector3(
        nl[0] * C.c + nl[2] * C.s,
        nl[1],
        -nl[0] * C.s + nl[2] * C.c,
      );
      best = {
        point: origin.clone().addScaledVector(dir, t0),
        normal: n,
        distance: t0,
        kind: "systems",
      };
    }
    return best;
  }
  function groundExtra(x, z, y = Infinity) {
    let top = -Infinity;
    const p = _lo;
    for (const C of colliders) {
      if (Math.abs(x - C.o.x) > 8 || Math.abs(z - C.o.z) > 8) continue;
      toLocal(C, _ld.set(x, 0, z), p);
      if (y === Infinity && C.max[1] > 3) continue;
      if (
        p.x >= C.min[0] &&
        p.x <= C.max[0] &&
        p.z >= C.min[2] &&
        p.z <= C.max[2]
      ) {
        const ty = C.o.y + C.max[1];
        if (ty <= y + 0.6 && ty > top) top = ty;
      }
    }
    return top;
  }
  function setTowerActive(id, on) {
    const T = towers.get(id);
    if (!T) return;
    T.active = on;
    T.bm.emissive.set(on ? 0x6fd3ff : 0xff2020);
    T.beam.material.uniforms.uCol.value.copy(on ? BLUE : RED);
  }
  function flareTower(id) {
    const T = towers.get(id);
    if (T) T.flare = 1;
  }

  // ---------------- tower scan pulses
  const pulses = [];
  // scan pulse: a thin cyan ring racing outward at roof level (low intensity, no tall additive walls: those flood the
  // HDR buffer and TAA/bloom turn them into colour blotches)
  const ringGeo = new THREE.RingGeometry(0.975, 1.0, 180, 1);
  ringGeo.rotateX(-Math.PI / 2);
  function pulse(pos) {
    for (const [delay, yOff] of [
      [0, 0.3],
      [0.35, 6],
    ]) {
      const m = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.6, 2.4, 3.6),
          transparent: true,
          opacity: 1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      m.position.copy(pos);
      m.position.y += yOff;
      m.frustumCulled = false;
      m.renderOrder = 5;
      m.visible = false;
      root.add(m);
      pulses.push({ m, t: -delay });
    }
  }

  // ---------------- backpacks (instanced)
  const packGeo = backpackGeometry();
  let packs = null,
    packList = [],
    packSlot = new Map();
  // (perf) one InstancedMesh per 400 m cell instead of one for the whole island: a single city-wide instanced mesh
  // has city-wide bounds, so every pack (~190k tris) was drawn in the main pass AND every shadow cascade
  function setBackpacks(list, collected) {
    packList = list;
    if (packs) {
      root.remove(packs);
      packs.traverse((o) => o.isInstancedMesh && o.dispose());
    }
    packs = new THREE.Group();
    packs.name = "backpacks";
    packSlot = new Map();
    const cells = new Map();
    list.forEach((b, i) => {
      const k = Math.floor(b.pos.x / 400) + "," + Math.floor(b.pos.z / 400);
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(i);
    });
    const q = new THREE.Quaternion(),
      qr = new THREE.Quaternion(),
      m = new THREE.Matrix4(),
      s = new THREE.Vector3(1, 1, 1),
      p = new THREE.Vector3();
    for (const idx of cells.values()) {
      const mesh = new THREE.InstancedMesh(packGeo, packMat, idx.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = "backpacks";
      idx.forEach((i, j) => {
        const b = list[i];
        q.setFromUnitVectors(_z, b.normal);
        if (b.mount === "wall") {
          // keep the pack upright on walls
          const right = new THREE.Vector3()
            .crossVectors(_up, b.normal)
            .normalize();
          const up = new THREE.Vector3().crossVectors(b.normal, right);
          q.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(right, up, b.normal),
          );
          qr.setFromAxisAngle(b.normal, ((i % 5) - 2) * 0.08);
          q.premultiply(qr);
        } else {
          qr.setFromAxisAngle(_z, i * 1.7);
          q.multiply(qr);
        }
        p.copy(b.pos).addScaledVector(b.normal, 0.01);
        m.compose(p, q, collected.has(b.id) ? new THREE.Vector3(0, 0, 0) : s);
        mesh.setMatrixAt(j, m);
        packSlot.set(b.id, [mesh, j]);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      packs.add(mesh);
    }
    root.add(packs);
  }
  function hideBackpack(id) {
    const sl = packSlot.get(id);
    if (!sl) return;
    const [mesh, i] = sl;
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(i, m);
    const p = new THREE.Vector3(),
      q = new THREE.Quaternion(),
      s = new THREE.Vector3();
    m.decompose(p, q, s);
    m.compose(p, q, s.set(0, 0, 0));
    mesh.setMatrixAt(i, m);
    mesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------- subway stations
  const stGeo = stationGeometry();
  const globeMat = new THREE.MeshStandardMaterial({
    color: 0x0a2010,
    emissive: 0x39ff7a,
    emissiveIntensity: 6,
    roughness: 0.2,
  });
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 512;
  signCanvas.height = 108;
  {
    const g = signCanvas.getContext("2d");
    g.fillStyle = "#111";
    g.fillRect(0, 0, 512, 108);
    g.fillStyle = "#fff";
    g.fillRect(0, 10, 512, 3);
    g.font = "700 52px Helvetica, Arial, sans-serif";
    g.textBaseline = "middle";
    g.fillText("Subway", 22, 60);
    [
      ["#ee352e", "1"],
      ["#00933c", "4"],
      ["#fccc0a", "N"],
      ["#0039a6", "A"],
    ].forEach(([c, t], i) => {
      const x = 300 + i * 52;
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, 60, 22, 0, 7);
      g.fill();
      g.fillStyle = c === "#fccc0a" ? "#000" : "#fff";
      g.font = "700 28px Helvetica, Arial";
      g.textAlign = "center";
      g.fillText(t, x, 61);
      g.textAlign = "left";
    });
  }
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = 4;
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.4,
    emissive: 0xffffff,
    emissiveMap: signTex,
    emissiveIntensity: 0.35,
  });
  let stMesh = null,
    globeMesh = null,
    signMesh = null;
  function setStations(list) {
    const n = list.length;
    stMesh = new THREE.InstancedMesh(stGeo, std, n);
    stMesh.castShadow = true;
    stMesh.receiveShadow = true;
    globeMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.19, 16, 12),
      globeMat,
      n * 2,
    );
    signMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.62, 0.3),
      signMat,
      n * 2,
    );
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      one = new THREE.Vector3(1, 1, 1);
    list.forEach((s, i) => {
      q.setFromAxisAngle(_up, s.dirZ > 0 ? 0 : Math.PI);
      m.compose(s.pos, q, one);
      stMesh.setMatrixAt(i, m);
      for (const k of [0, 1]) {
        const lp = new THREE.Vector3(k ? 0.9 : -0.9, 2.55, 1.75)
          .applyQuaternion(q)
          .add(s.pos);
        globeMesh.setMatrixAt(i * 2 + k, m.clone().compose(lp, q, one));
        const sp = new THREE.Vector3(0, 1.36, -1.78 + (k ? -0.035 : 0.035))
          .applyQuaternion(q)
          .add(s.pos);
        const sq = q.clone();
        if (k)
          sq.multiply(new THREE.Quaternion().setFromAxisAngle(_up, Math.PI));
        signMesh.setMatrixAt(i * 2 + k, m.clone().compose(sp, sq, one));
      }
    });
    for (const im of [stMesh, globeMesh, signMesh]) {
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      root.add(im);
    }
  }

  // ---------------- waypoint pillar
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 260, 24, 1, true),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uFade: { value: 1 } },
      vertexShader: markerVertex,
      fragmentShader: waypointPillarFragment,
    }),
  );
  pillar.visible = false;
  pillar.frustumCulled = false;
  pillar.renderOrder = 4;
  root.add(pillar);
  function setWaypoint(pos) {
    pillar.visible = !!pos;
    if (pos) {
      pillar.position.copy(pos);
      pillar.position.y += 130 - 0.5;
    }
  }

  // ---------------- crime scene: red light column + pulsing ground ring
  const crimeCol = pillar.clone();
  crimeCol.material = pillar.material.clone();
  crimeCol.material.fragmentShader = crimeCol.material.fragmentShader.replace(
    "vec3(1.6,1.05,0.25)",
    markersShader.crimeOverlayColor,
  );
  crimeCol.visible = false;
  root.add(crimeCol);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 64),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(3, 0.15, 0.1),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  ring.renderOrder = 4;
  root.add(ring);
  let colOn = true;
  function setCrime(pos) {
    ring.visible = !!pos;
    crimeCol.visible = !!pos && colOn;
    if (pos) {
      crimeCol.position.copy(pos);
      crimeCol.position.y += 129.5;
      ring.position.copy(pos);
      ring.position.y += 0.06;
    }
  }
  function setCrimeColumn(v) {
    colOn = v;
    crimeCol.visible = v && ring.visible;
  } // hidden once the player is at the scene

  let time = 0;
  return {
    root,
    addTower,
    setTowerActive,
    raycastExtra,
    groundExtra,
    colliders,
    pulse,
    setBackpacks,
    hideBackpack,
    setStations,
    setWaypoint,
    setCrime,
    setCrimeColumn,
    flareTower,
    towers,
    update(dt, camera) {
      time += dt;
      for (const T of towers.values()) {
        T.flare = Math.max(0, T.flare - dt / 2.5);
        if (T.active)
          T.bm.emissiveIntensity = 14 + Math.sin(time * 2) * 4 + T.flare * 120;
        else T.bm.emissiveIntensity = time % 1.4 < 0.35 ? 60 : 3;
        T.crown.rotation.y = time * (T.active ? 0.6 : 0.25) + T.flare * 8;
        const u = T.beam.material.uniforms;
        u.uT.value = time;
        const d = camera
          ? Math.hypot(
              camera.position.x - T.g.position.x,
              camera.position.z - T.g.position.z,
            )
          : 999;
        // beacon beam: reads from across the city, fades out up close; active towers keep a dimmer blue beam
        u.uFade.value =
          THREE.MathUtils.smoothstep(d, 40, 160) * (T.active ? 0.8 : 1) +
          T.flare * THREE.MathUtils.smoothstep(d, 15, 60);
        const bs = THREE.MathUtils.clamp(d / 260, 1, 5) * (1 + T.flare * 2);
        T.beam.scale.set(bs, 1, bs);
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const P = pulses[i];
        P.t += dt / 4.5;
        if (P.t < 0) continue;
        P.m.visible = true;
        const r = 3 + 480 * Math.pow(Math.min(1, P.t), 1.6);
        P.m.scale.set(r, 1, r);
        P.m.material.opacity = Math.pow(1 - Math.min(1, P.t), 1.5);
        if (P.t >= 1) {
          root.remove(P.m);
          P.m.material.dispose();
          pulses.splice(i, 1);
        }
      }
      if (pillar.visible) {
        pillar.material.uniforms.uT.value = time;
        const d = camera
          ? Math.hypot(
              camera.position.x - pillar.position.x,
              camera.position.z - pillar.position.z,
            )
          : 999;
        pillar.material.uniforms.uFade.value = THREE.MathUtils.smoothstep(
          d,
          15,
          60,
        );
        const s = THREE.MathUtils.clamp(d / 120, 1, 6);
        pillar.scale.set(s, 1, s);
      }
      if (crimeCol.visible) {
        crimeCol.material.uniforms.uT.value = time;
        const d = camera
          ? Math.hypot(
              camera.position.x - crimeCol.position.x,
              camera.position.z - crimeCol.position.z,
            )
          : 999;
        crimeCol.material.uniforms.uFade.value = THREE.MathUtils.smoothstep(
          d,
          45,
          130,
        );
        const s = THREE.MathUtils.clamp(d / 140, 0.6, 5);
        crimeCol.scale.set(s, 1, s);
      }
      if (ring.visible) {
        const k = (time * 0.7) % 1;
        ring.scale.setScalar(2 + k * 7);
        ring.material.opacity = 1 - k;
      }
      if (packMat.userData.uGlow)
        packMat.userData.uGlow.value =
          0.35 + 0.3 * (0.5 + 0.5 * Math.sin(time * 3));
    },
  };
}
