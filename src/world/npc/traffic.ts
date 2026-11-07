// @ts-nocheck
// Camera-centred streaming traffic over the whole road network (npc/roads.ts):
//  * every lane link within RA metres of the camera is "active": it is populated when it enters the radius
//    (always at the fogged edge once play starts) and its cars are dropped when it leaves; boundary links spawn
//    inflow, cars leaving the radius are retired. No wrap-around teleports.
//  * IDM car following across links + turn connectors, NYC signal phases (props.phase), left turns yield to
//    oncoming traffic, turning cars yield to pedestrians on crosswalks, cars brake + honk for Spider-Man.
//  * parked cars along every curb of active links, collidable (C3 world.collideDynamic) like moving traffic.
//  * rendering: 3 instanced tiers per vehicle type (Blender model < 90 m, procedural low-poly < 250 m, proxy box
//    beyond), CPU frustum culling, brake lights via per-instance state.
import * as THREE from "three";
import {
  G,
  mulberry32,
  hash2,
  islandNear,
  bikeLaneAt,
  DIAG_SEGS,
  diagD,
} from "../layout.ts"; // (layout2 r3) islandNear, bikeLaneAt
import { connector, connAt, mapPhase, bridgeJunctions } from "./roads.ts";
import { createJunctions } from "./junctions.ts"; // (citylife junctions) conflict / reservation model
import { registry, curbBlocked } from "./registry.ts";
import { createVehicleContactShadows, createHeadlightPools } from "../vehicleLighting.ts"; // (daynight) + headlight pools // (street r7) contact AO decals under cars
import { cascadedShadowState, SHADOW_PROXY_LAYER } from "../../render/cascadedShadows.ts"; // (perf r2) shadow proxies
import { isPerformanceFeatureDisabled } from "../performanceFlags.ts"; // (perf r2) A/B switch
import { cityLights } from "../../render/citylights.ts"; // (night) real headlight / tail-light lighting
import { nightK } from "../../render/daynight.ts"; // (night)
import { getQuality } from "../../render/quality.ts";

const MAX_CARS = 2600;
const A = 2.0,
  B = 3.2,
  S0 = 2.0,
  TH = 1.1;
const PLAYER_R = 0.5; // player body half-width used by drivers (arms + stance), metres
// (citylife junctions) user: 'reduce car density by a bit' -> open gaps between platoons x1.3 (~-18 % cars); the authored
// street maps (Village / FiDi: short links, many junctions) a further x1.35 (their queues were locking up whole districts)
// (citylife junctions r3) density is a steady-state target: cars per km of lane by road kind = 85 % of what the original
// populate put down (measured: av 36, st 45, wide st 23, Broadway 48, street maps 54). The streamed area used to drain
// (the edge inflow can't replace the cars driving out of the 640 m radius: ~1000 cars at load -> ~320 after 5 min with the
// camera parked), so a stationary view emptied out whatever the spawn gaps were. The refill below tops links up out of view.
const DENSITY = { av: 31, st: 44, ws: 20, dg: 41, dg1: 80, map: 27, br: 31 }; // br: bridge decks (roads.ts BRIDGE_DENSITY) // dg1: one-way lower Broadway (2 lanes carry what 4 did)

export const VTYPES = {
  // (vehicles r1) real-world sizes of the Blender models (tools/blender/city_vehicles.py SPECS)
  taxi: { len: 5.39, wid: 1.99, h: 1.5, big: false }, // Crown-Vic-style yellow cab
  taxi_hy: { len: 4.54, wid: 1.76, h: 1.52, big: false }, // Prius-style hybrid cab
  taxi_mv: { len: 5.08, wid: 1.99, h: 1.8, big: false }, // minivan cab
  taxi_gr: { len: 4.86, wid: 1.84, h: 1.48, big: false }, // green boro cab
  sedan: { len: 4.85, wid: 1.84, h: 1.46, big: false },
  hatch: { len: 4.26, wid: 1.79, h: 1.46, big: false },
  sedan2: { len: 4.9, wid: 1.85, h: 1.46, big: false }, // (vehicles r3) Altima/Accord-style sedan
  cross: { len: 4.6, wid: 1.86, h: 1.7, big: false }, // (vehicles r3) CR-V-style crossover
  suv: { len: 4.9, wid: 1.95, h: 1.77, big: false },
  suv2: { len: 5.35, wid: 2.03, h: 1.92, big: false },
  pickup: { len: 5.9, wid: 2.03, h: 1.95, big: false },
  van: { len: 5.98, wid: 2.06, h: 2.55, big: false },
  truck: { len: 7.3, wid: 2.3, h: 3.5, big: true },
  bus: { len: 12.2, wid: 2.55, h: 3.1, big: true },
  tour: { len: 11, wid: 2.55, h: 4.3, big: true },
};
// (vehicles r3) realistic NYC paint mix (weights ~ market share): black, white, silver, greys, dark blue, dark red, a few beige / green / light blue / brown
const CAR_COLORS = [
  0x0e0e0f, 0x151517, 0x1b1c1f, 0x101418, 0xe2e2df, 0xd8d8d4, 0xcfcfca,
  0xe6e3da, 0xa9adb1, 0x9c9fa3, 0xb7b9bb, 0x8e9296, 0x6d7074, 0x55585c,
  0x44474b, 0x1b2a4a, 0x223a63, 0x2f4c7a, 0x5a1216, 0x6e1a1a, 0x8a1f1f,
  0xb3a98f, 0x9b8f75, 0x2c3d2e, 0x44563f, 0x6b86a0, 0x4a3a2c, 0x3b4450,
  0x7c8a8f, 0x2a2d33,
];
const lin = (c) =>
  [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map((s) =>
    Math.pow(s, 2.2),
  );
const TAXI = lin(0xf5a900);
const TAXI_GR = lin(0x9aae4c); // (vehicles r1) boro-taxi apple green ((vehicles r2) less saturated: critic "garish lime")
const VANC = [0xd6d6d2, 0xcfccc4, 0xc9c9c7, 0xd9d7d0].map(lin); // (vehicles r1) vans carry a printed livery: off-white bodies
const PAL = CAR_COLORS.map(lin);
const LIVERY = [0x0b0b0c, 0x0e0e10, 0x121315, 0x0d1014].map(lin); // (vehicles r4) black-car service paints
const TRUCKC = [
  0xdcdcd8, 0xd2d2cc, 0xc8c2b4, 0xe2e0da, 0x2a4f8a, 0x8a1c1c, 0x3c4a3a,
  0xb8b4aa,
].map(lin); // (citylife r2) no pure-white albedo: box vans read as flat blown-out slabs

// ------------------------------------------------------------------ instanced writer
class Inst {
  constructor(geo, mat, max, { shadow = true, name = "" } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.name = name;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(
      new Float32Array(max * 3),
      3,
    ).setUsage(THREE.DynamicDrawUsage);
    this.state = new THREE.InstancedBufferAttribute(
      new Float32Array(max),
      1,
    ).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aTint", this.tint);
    geo.setAttribute("aState", this.state);
    this.seed = new THREE.InstancedBufferAttribute(
      new Float32Array(max),
      1,
    ).setUsage(THREE.DynamicDrawUsage); // (vehicles r2) per-car seed (topper ad)
    geo.setAttribute("aSeed", this.seed);
    this.max = max;
    this.n = 0;
  }
  push(x, y, z, ry, tint, state, pitch = 0, seed = 0) {
    if (this.n >= this.max) return;
    const k = this.n++,
      e = this.mesh.instanceMatrix.array,
      o = k * 16;
    const c = Math.cos(ry),
      s = Math.sin(ry);
    if (pitch) {
      // small nose-dive when braking: rotate about the car's local z (lateral) axis
      const cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      e[o] = c * cp;
      e[o + 1] = sp;
      e[o + 2] = -s * cp;
      e[o + 3] = 0;
      e[o + 4] = -c * sp;
      e[o + 5] = cp;
      e[o + 6] = s * sp;
      e[o + 7] = 0;
    } else {
      e[o] = c;
      e[o + 1] = 0;
      e[o + 2] = -s;
      e[o + 3] = 0;
      e[o + 4] = 0;
      e[o + 5] = 1;
      e[o + 6] = 0;
      e[o + 7] = 0;
    }
    e[o + 8] = s;
    e[o + 9] = 0;
    e[o + 10] = c;
    e[o + 11] = 0;
    e[o + 12] = x;
    e[o + 13] = y;
    e[o + 14] = z;
    e[o + 15] = 1;
    this.tint.array[k * 3] = tint[0];
    this.tint.array[k * 3 + 1] = tint[1];
    this.tint.array[k * 3 + 2] = tint[2];
    this.state.array[k] = state;
    this.seed.array[k] = seed;
  }
  begin() {
    this.n = 0;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0; // (perf) empty tiers: no zero-instance draw in the main pass + every cascade
    if (!this.n) return; // (never pass a 0-length update range: WebGL2 would upload the whole buffer)
    const im = this.mesh.instanceMatrix;
    im.clearUpdateRanges();
    im.addUpdateRange(0, this.n * 16);
    im.needsUpdate = true;
    this.tint.clearUpdateRanges();
    this.tint.addUpdateRange(0, this.n * 3);
    this.tint.needsUpdate = true;
    this.state.clearUpdateRanges();
    this.state.addUpdateRange(0, this.n);
    this.state.needsUpdate = true;
    this.seed.clearUpdateRanges();
    this.seed.addUpdateRange(0, this.n);
    this.seed.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ honk: (audio r1) routed to the game's audio system
// (tonal, distance-filtered horn samples through an HRTF panner at the car; window.__audio from systems/audio.ts)
function makeHorn() {
  let last = -1;
  return (dist, big, x, z, y = 1) => {
    const A = window.__audio;
    if (!A?.ready || dist > 120) return;
    const t = performance.now() / 1000;
    if (t - last < 0.35) return;
    last = t;
    A.sfx.hornAt(x, y + 1.2, z, big);
  };
}

export function createTraffic({
  scene,
  roads,
  phase,
  geos,
  mats,
  models = null,
}) {
  // Resolve the preset when the traffic system is created, after the renderer
  // and application modules have finished initializing. Avoid reading it at
  // module evaluation time, which can run while the module graph is loading.
  const quality = getQuality();
  let densityScale = quality.populationScale ?? 1; // preset scales moving and parked vehicle counts
  let RA = quality.trafficRadius; // moving-car simulation / draw radius (m)
  let PARK_R = quality.parkedCarRadius;
  let HI_D = quality.vehicleHighDetailDistance,
    LOW_D = quality.vehicleLowDetailDistance; // LOD0 -> LOD1 -> grouped LOD2
  const { links, nodes } = roads;
  const tiers = {};
  const all = [];
  // (vehicles r1) per type: hi = LOD0 (cascades 0-1), low = LOD1 (cascade 0-1 too once proxies are on); per LOD2 group
  // (models[t].grp, 6 groups): far = LOD2 (no shadow) + a shadow-only stand-in on SHADOW_PROXY_LAYER (cascade 2) that
  // takes the far-cascade shadows of the hi and low cars. Empty tiers hide themselves (Inst.end).
  const groups = {};
  const grpOf = (t) => models?.[t]?.grp ?? t;
  for (const t of Object.keys(VTYPES)) {
    const g = grpOf(t);
    if (!groups[g]) {
      const big = VTYPES[t].big;
      groups[g] = {
        far: new Inst(geos.far[g], mats.far, big ? 500 : 2400, {
          shadow: false,
          name: "veh-far-" + g,
        }),
      };
      groups[g].far.farTier = true;
      scene.add(groups[g].far.mesh);
      all.push(groups[g].far);
      if (geos.glb || geos.hi[t]) {
        const px = new Inst(geos.far[g].clone(), mats.far, big ? 200 : 700, {
          name: "veh-shadowProxy-" + g,
        });
        px.mesh.layers.set(SHADOW_PROXY_LAYER);
        px.mesh.userData.smallCasters = true;
        px.mesh.receiveShadow = false;
        scene.add(px.mesh);
        all.push(px);
        groups[g].proxy = px;
      }
    }
  }
  for (const t of Object.keys(VTYPES)) {
    const hiMax = VTYPES[t].big ? 60 : 120;
    tiers[t] = {
      hi: new Inst(
        geos.hi[t] || geos.low[t],
        geos.hi[t] ? mats.hi : mats.mid,
        hiMax,
        { name: "veh-hi-" + t },
      ),
      low: new Inst(geos.low[t], mats.mid, VTYPES[t].big ? 200 : 500, {
        name: "veh-low-" + t,
      }),
      far: groups[grpOf(t)].far,
      proxy: groups[grpOf(t)].proxy,
    };
    for (const k of ["hi", "low"]) {
      scene.add(tiers[t][k].mesh);
      all.push(tiers[t][k]);
    }
  }
  const cao = createVehicleContactShadows(scene, 1600); // (street r7)
  const hlp = createHeadlightPools(scene, 600); // (daynight, lighting2 r4) headlight pools on the road at night (fallback: ?nocl)
  // (night) car lights (cityLights.ts): every moving car (and a parked one on hazards / at the bus stop) within CL_R of
  // the camera whose beam can reach the view is a candidate; the CL_MAX nearest get a real forward headlight spot
  // (cool white, lights the road ahead, the car in front, pedestrians, with a little lit haze) and the nearer ones a
  // weak red tail-light point at the rear (brighter while braking). Parked cars are dark (instance state -1: partMaterials.ts
  // keeps their head / tail lamps off). Gathered in render() (after placeCar), emitted from the provider below
  // (cityLights.build runs after world.update). No allocation per frame; nothing by day.
  const CL_MAX = 50,
    CL_R = 200,
    CL_TAIL = 45,
    CL_CAP = 2048; // (night r9) twin lamps: fewer cars / tails so the core 1024-light cap is not hit
  const clCar = new Array(CL_CAP).fill(null),
    clD = new Float32Array(CL_CAP),
    clSort = new Float32Array(CL_CAP);
  let clN = 0;
  // (night r9) user: 'one single light coming out of their front, should be a mix of light from both headlights, same for
  // taillights; more diffused, not a thin streak going and expanding forwards'. The CL_TWIN nearest cars get two spots at
  // the real lamp positions (+-(half width - 0.25) m, 0.72 m up, just ahead of the bumper), each half the car's light, so
  // the pools overlap into one broad mixed pool with two soft lobes near the car; farther cars (up to CL_MAX) one merged
  // spot at the car's centre line (same total). Wide soft low beam: half-angle 0.5, penumbra 0.9, aimed 0.1 rad down ->
  // a broad fan on the asphalt ~2-12 m ahead (~1.2 at 2-3 m, ~0.35 at 5 m for the pair); radius 3.5 flattens the 1/d^2
  // near field; volume 0.18 (the old thin expanding streak was mostly the lit-haze beam); spec 0.35 (wet-road glints).
  // Twin tail lights: two small red points at the rear corners (brighter while braking).
  const CL_TWIN = 30,
    CL_TILT = 0.1;
  const clH = {
    type: "spot",
    pos: [0, 0, 0],
    dir: [1, 0, 0],
    color: 0xffd8b0,
    intensity: 45,
    range: 20,
    angle: 0.5,
    penumbra: 0.9,
    radius: 3.5,
    volume: 0.18,
    key: 0,
    spec: 0,
  }; // (night r12) spec 0.35 (and even 0.06): an oncoming car's beam mirrored on the wet asphalt / puddles as big glare pools under it (user: 'reflections below ... double bad'); the beams only light diffusely
  const clT = {
    type: "point",
    pos: [0, 0, 0],
    color: 0xff1c0c,
    intensity: 0.75,
    range: 4.5,
    radius: 0.2,
    volume: 0.04,
    shadow: false,
  };
  const clOff =
    typeof location !== "undefined" && /[?&]nohl\b/.test(location.search); // (night) ?nohl: car lights off (A/B)
  cityLights.addProvider(
    (emitL) => {
      const n = clN;
      if (!n || clOff) return;
      let lim = Infinity,
        limT = Infinity;
      if (n > CL_TWIN) {
        clSort.set(clD);
        for (let i = n; i < CL_CAP; i++) clSort[i] = 1e12;
        clSort.sort();
        limT = clSort[CL_TWIN - 1];
        if (n > CL_MAX) lim = clSort[CL_MAX - 1];
      }
      for (let i = 0; i < n; i++) {
        if (clD[i] > lim) continue;
        const c = clCar[i],
          cy = c.parked ? 0 : c.y,
          p = c.parked ? 0 : c.pitch + c.gp,
          cs = Math.cos(c.ry),
          sn = Math.sin(c.ry),
          sp = Math.sin(p);
        const h = c.len / 2 + 0.1,
          ly = cy + 0.72,
          twin = clD[i] <= limT;
        const cq = Math.cos(p - CL_TILT),
          sq = Math.sin(p - CL_TILT);
        clH.dir[0] = cs * cq;
        clH.dir[1] = sq;
        clH.dir[2] = -sn * cq;
        const I = c.x > -112 && c.x < 112 && c.z > -352 && c.z < 22 ? 14 : 38; // (night r10) 25 / 45: wide twin beams from many cars over-lit the TS road (critic r9: 90 vs ref 42) // per lamp; (night r5) Times Square: the screens light the district
        const id2 =
          (c.parked ? 1e6 + Math.round(c.x * 3 + c.z * 7919) : c.id) * 2; // (night) stable identities for the shadow slots
        const fx = c.x + cs * h,
          fy = ly + sp * h,
          fz = c.z - sn * h,
          w = twin ? Math.max(0.5, c.wid / 2 - 0.25) : 0;
        // lateral axis (right of travel): (sin ry, cos ry)
        for (
          let k = twin ? -1 : 0;
          k <= (twin ? 1 : 0);
          k += 2 - (twin ? 0 : 1)
        ) {
          clH.pos[0] = fx + sn * w * k;
          clH.pos[1] = fy;
          clH.pos[2] = fz + cs * w * k;
          clH.intensity = twin ? I : 2 * I;
          clH.key = id2 + (k > 0 ? 1 : 0);
          emitL(clH);
        }
        if (clD[i] < CL_TAIL * CL_TAIL) {
          const t = c.len / 2 + 0.2,
            br = c.parked
              ? c.haz && (time * 1.5 + c.x * 0.01) % 1 < 0.5
              : c.brake > 0;
          const bx = c.x - cs * t,
            by = cy + 0.85 - sp * t,
            bz = c.z + sn * t,
            tw = Math.max(0.5, c.wid / 2 - 0.2);
          clT.intensity = br ? 2 : 0.75;
          for (let k = -1; k <= 1; k += 2) {
            clT.pos[0] = bx + sn * tw * k;
            clT.pos[1] = by;
            clT.pos[2] = bz + cs * tw * k;
            clT.key = 4e7 + id2 + (k > 0 ? 1 : 0);
            emitL(clT);
          }
        }
      }
    },
    { moving: true },
  ); // (perf r9) moving lights: updated in place between full light-grid rebuilds (keys identify them)
  // lane obstacles (steam stacks): the lane link is blocked from blockS on; cars avoid routing into it
  for (const L of links) {
    L.blockS = Infinity;
    for (const o of registry.laneObstacles) {
      const px = o.x - L.ax,
        pz = o.z - L.az,
        s = px * L.dx + pz * L.dz,
        lat = Math.abs(px * L.dz - pz * L.dx);
      if (s > -2 && s < L.len + 2 && lat < 1.6)
        L.blockS = Math.min(L.blockS, s - 2.5);
    }
    // lane closures (street agent: Park Av viaduct ramp): blocked from where the lane enters the rect, never populated
    for (const c of registry.laneClosures ?? []) {
      for (let s = 0; s <= L.len; s += 1) {
        const x = L.ax + L.dx * s,
          z = L.az + L.dz * s;
        if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) {
          L.blockS = Math.min(L.blockS, s - 2.5);
          L.noSpawn = true;
          break;
        }
      }
    }
  }
  const horn = makeHorn();
  let cars = [];
  let serial = 1;
  const rnd = mulberry32(globalThis.__trafficSeed ?? 99); // (probe: 2 seeds)
  const player = {
    pos: new THREE.Vector3(1e9, 0, 0),
    vel: new THREE.Vector3(),
    t: -1,
    ground: 0,
  };

  const pickType = (L, r) => {
    const big = L.kind !== "st" && L.lane === 1;
    if (big && r < 0.07) return "bus"; // (street r9) more MTA buses / box trucks in the mix
    if (big && r < 0.09) return "tour";
    // (vehicles r4) Midtown mix (director): cabs ~23% split Prius / NV200-ish minivan / Camry (taxi_gr body, mostly yellow)
    // / few Crown Vics; more delivery vans + box trucks; many black livery SUVs / sedans (colorOf)
    if (r < 0.13) return "truck";
    if (r < 0.21) return "van";
    if (r < 0.28) return "taxi_hy";
    if (r < 0.34) return "taxi_mv";
    if (r < 0.41) return "taxi_gr";
    if (r < 0.44) return "taxi";
    if (r < 0.52) return "sedan";
    if (r < 0.6) return "sedan2";
    if (r < 0.66) return "hatch";
    if (r < 0.74) return "suv";
    if (r < 0.82) return "cross";
    if (r < 0.93) return "suv2";
    return "pickup";
  };
  const colorOf = (type, r) =>
    type === "taxi_gr"
      ? r < 0.3
        ? TAXI_GR
        : TAXI
      : type.startsWith("taxi")
        ? TAXI // (vehicles r4) Camry-body cabs: mostly yellow, some boro green
        : (type === "suv2" && r < 0.7) ||
            (type === "sedan2" && r < 0.4) ||
            (type === "suv" && r < 0.3)
          ? LIVERY[Math.floor(r * 97) % LIVERY.length] // (vehicles r4) black livery / black-car SUVs + sedans
          : type === "truck" || type === "van"
            ? VANC[Math.floor(r * VANC.length)] // (vehicles r1) printed liveries: off-white
            : type === "tour"
              ? lin(0xb3121a)
              : type === "bus"
                ? lin(0xe4e4e0)
                : PAL[Math.floor(r * PAL.length)];
  const chooseNext = (c, L, avoid = null) => {
    const opts = L.out;
    if (!opts || !opts.length) return null;
    const big = VTYPES[c.type].big;
    let tot = 0;
    const w = opts.map((o) => {
      let x =
        o.turn === "S"
          ? 0.66
          : o.turn === "U"
            ? 0.05
            : big && o.turn === "L"
              ? 0.02
              : 0.17;
      if (o.link.blockS < Infinity) x *= 0.001;
      if (avoid && o.link === avoid) x *= 0.02;
      if (
        c.len > 7 &&
        o.link.vmap &&
        ((o.link.diag?.w ?? 10) < 12 || c.len > 10)
      )
        x *= 0.002;
      if (c.len > 10 && o.turn !== "S" && (L.diag || o.link.diag)) x *= 0.01; // (r3) buses stay on their route through the Broadway / map junctions (their 12 m bodies sweep the neighbouring paths) // (r3) buses / box trucks keep out of the narrow map streets (their turns sweep the corners)
      {
        // (citylife junctions) drivers avoid a street that is backed up to the corner (breaks gridlock rings in the dense maps)
        const N = o.link;
        let tail = N.len;
        for (let k = 0; k < N.cars.length; k++) {
          const q = N.cars[k];
          tail = q.s - q.len / 2 - (q.conn ? q.len : 0);
          break;
        }
        if (N.active && tail < c.len + 8)
          x *= 0.08 + (0.92 * Math.max(0, tail)) / (c.len + 8);
      }
      tot += x;
      return x;
    });
    let r = c.rng() * tot;
    for (let i = 0; i < opts.length; i++)
      if ((r -= w[i]) <= 0) {
        const o = opts[i];
        if (o.link.blockS < Infinity && o.turn === "S" && o.link.alt)
          return o.link.alt; // change lanes through the box
        return o;
      }
    return opts[opts.length - 1];
  };
  const newCar = (L, s, v, seed) => {
    const rng = mulberry32(seed);
    const type = pickType(L, rng());
    const T = VTYPES[type];
    const c = {
      id: serial++,
      type,
      len: T.len,
      wid: T.wid,
      h: T.h,
      link: L,
      s,
      v,
      v0: (L.kind === "st" ? 9 : 12.5) + rng() * 3.5,
      conn: null,
      next: null,
      rng,
      color: colorOf(type, rng()),
      brake: 0,
      blockT: 0,
      honkT: 0,
      x: 0,
      z: 0,
      ry: 0,
      pitch: 0,
      acc: 0,
      dead: false,
      // (citylife junctions) junction state (declared up front: one hidden class for every car keeps the step loop monomorphic)
      reg: null,
      chain: null,
      via: null,
      pre: null,
      wait: null,
      wM: null,
      wT0: 0,
      wAcc: 0,
      wLast: 0,
      _req: null,
      _red: false,
      _why: "",
      _whyC: null,
      creepT: 0,
      _tM: null,
      _tN: null,
      stuckT: 0,
      stillT: 0,
      regT: 0,
      _pAlong: null,
      _pLat: 0,
      _pSoft: false,
      inZone: false,
      adSeed: undefined,
      _vis: false,
      // (citylife junctions) user: 'don't make all of them nice clean lines': per-driver headway / gap / pull-away, a slow
      // lateral drift about the lane centre (some sit a little off-centre in wide lanes), a faint heading wander
      dA: 1.6 + rng() * 0.8,
      dTH: 0.8 + rng() * 0.6,
      dS0: 1.5 + rng() * 1.0,
      latB: 0,
      latA: 0.1 + rng() * 0.25,
      latK: (2 * Math.PI) / (60 + rng() * 100),
      latP: rng() * 6.283,
      odo: 0,
      lat: 0,
      latV: 0,
      lc: 0,
      lc0: 0,
      lcFrom: null,
      lcT: 0,
      lcDur: 0,
      lcCool: 4 + rng() * 10,
      wob: rng() * 100,
      yaw: 0,
      y: 0,
      gp: 0,
    };
    {
      const r = rng();
      c.latB = (r < 0.25 ? 0.25 : 0.08) * (rng() < 0.5 ? -1 : 1);
    } // a quarter drive noticeably off-centre
    c.next = chooseNext(c, L);
    return c;
  };
  const insertSorted = (arr, c) => {
    let i = arr.length;
    while (i > 0 && arr[i - 1].s > c.s) i--;
    arr.splice(i, 0, c);
  };

  // ------------------------------------------------------------------ streaming
  const lastCam = new THREE.Vector3(1e9, 0, 0);
  let streamT = 0;
  const segDist2 = (L, x, z) => {
    const px = x - L.ax,
      pz = z - L.az;
    const t = Math.max(0, Math.min(L.len, px * L.dx + pz * L.dz));
    const qx = px - L.dx * t,
      qz = pz - L.dz * t;
    return qx * qx + qz * qz;
  };
  const populate = (L, first) => {
    if (L.noSpawn) return;
    const rng = mulberry32(
      (L.id * 7919 + (L.gen = (L.gen || 0) + 1) * 104729) >>> 0,
    );
    const spacing =
      L.kind === "st" ? [8, 38] : L.kind === "dr" ? [10, 38] : [6, 27]; // (street r2: denser avenues / streets)
    let s = 3 + rng() * 12 + (L.blockS < Infinity ? L.blockS + 6 : 0);
    const light = L.signal ? phase(time, L.axis) : 2;
    const list = [];
    while (s < L.len - 3 && cars.length < MAX_CARS) {
      const c = newCar(L, 0, 0, (L.id * 131 + s * 17 + L.gen * 7) >>> 0);
      c.s = s + c.len / 2;
      if (c.s + c.len / 2 > L.len - 1) break;
      {
        // never spawn a car on / right in front of the player
        const cx = L.ax + L.dx * c.s,
          cz = L.az + L.dz * c.s;
        const pa = (player.pos.x - cx) * L.dx + (player.pos.z - cz) * L.dz,
          pl = Math.abs(
            (player.pos.x - cx) * L.dz - (player.pos.z - cz) * L.dx,
          );
        if (
          pl < c.wid / 2 + PLAYER_R + 0.7 &&
          pa > -c.len / 2 - 2 &&
          pa < c.len / 2 + 25
        ) {
          s += c.len + 4;
          continue;
        }
        let inZ = false;
        for (const z of zones.values())
          if (
            z.until > time &&
            (z.x - cx) ** 2 + (z.z - cz) ** 2 < (z.r + 8) ** 2
          )
            inZ = true;
        if (inZ) {
          s += c.len + 4;
          continue;
        }
      }
      const dStop = L.stopS - (c.s + c.len / 2);
      c.v = c.v0 * (0.55 + rng() * 0.35);
      if (light !== 2 && dStop > -0.5)
        c.v = Math.min(c.v, Math.sqrt(2 * 2.5 * Math.max(0, dStop - 1.5)));
      list.push(c);
      cars.push(c);
      // (street r9, street agent) platoons released by the upstream light: tight bunches of 2-6 cars, then open road
      // (critic: 'evenly spaced traffic'); mean density about the same as the old uniform [s0, s1] spacing
      // (street r10) director: 'avenue reads as a traffic jam' -> avenues: smaller platoons (1-4), ~2.3x longer open gaps
      const avL = L.kind !== "st";
      if (L.plat === undefined || L.plat <= 0)
        L.plat = (avL ? 1 : 2) + Math.floor(rng() * (avL ? 4 : 5)); // (street r11) avenues 1-4 (critic x3: 'traffic sparse')
      s +=
        c.len +
        (--L.plat > 0
          ? 2.4 + rng() * 5.5
          : (spacing[0] * 2 + rng() * (spacing[1] * 2.6)) * (avL ? 2.3 : 1)); // (street r11) 3.2 -> 2.3: between r9's jam and r10's empty avenue
    }
    // queue cars at a red light: compact the front of the list toward the stop line
    if (light !== 2 && list.length) {
      let lim = L.stopS;
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        if (c.s + c.len / 2 > lim - 0.3 || lim - (c.s + c.len / 2) < 25) {
          c.s = Math.min(c.s, lim - c.len / 2 - 0.3);
          if (lim - (c.s + c.len / 2) < 3) c.v = 0;
        }
        lim = c.s - c.len / 2 - (S0 + 0.3 + rng() * 1.5);
      }
    }
    // (citylife junctions r2) a spawned platoon starts at speeds it can stop from behind its leader (its head may meet a
    // junction that is not free yet)
    {
      const stop = Math.min(L.stopS, L.xst ? L.xst[0] : Infinity);
      for (const c of list)
        if (c.s + c.len / 2 < stop)
          c.v = Math.min(
            c.v,
            Math.sqrt(2 * 3 * Math.max(0, stop - (c.s + c.len / 2) - 1)),
          );
    }
    for (let i = list.length - 2; i >= 0; i--) {
      const a = list[i],
        b = list[i + 1],
        g = b.s - b.len / 2 - (a.s + a.len / 2);
      a.v = Math.min(a.v, b.v + Math.max(0, g - 1.5) * 0.9);
    }
    {
      // (citylife junctions r3) thin the populated platoons to this link's target (85 % of the original on average)
      const tgt = linkTarget(L) * (0.8 + rng() * 0.4);
      while (list.length > Math.ceil(tgt) || (list.length && rng() < 0.03)) {
        const k = Math.floor(rng() * list.length);
        list[k].dead = true;
        list.splice(k, 1);
      }
    }
    L.cars = list.concat(L.cars).sort((a, b) => a.s - b.s);
    L.spawnGap =
      (spacing[0] + rng() * (spacing[1] - spacing[0])) /
      Math.max(0.05, densityScale);
    void first;
  };
  // (citylife junctions) a curb spot inside Broadway's roadway (where it crosses a street / avenue) is no parking spot
  // (citylife bridges) the bridge T mouths: no parking, double-parking, taxi or bus stops (roads.ts bridgeJunctions)
  const inBJ = (x, z) =>
    bridgeJunctions().some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  const onDiag = (x, z, pad, own = null) => {
    for (const g of DIAG_SEGS) {
      if (g === own) continue;
      const u = (x - g.ax) * g.ux + (z - g.az) * g.uz;
      if (u > -pad && u < g.len + pad && Math.abs(diagD(g, x, z)) < g.hw + pad)
        return true;
    }
    return false;
  };
  const parkedFor = (L) => {
    L.dbl = null;
    if (L.kind === "dr" || L.noPark || (L.kind !== "st" && L.lane !== 1))
      return []; // (layout2) noPark: off-grid links
    const rng = mulberry32((L.id * 48271 + 11) >>> 0);
    const out = [];
    const sides =
      L.parkSides || (L.kind === "st" ? [3.9, -3.9] : [9.2 * 0 + 3.8]); // lateral offset right of the lane centre; (layout2 r9) parkSides: per-link (wide / narrow streets)
    for (const lat of sides) {
      if (rng() < 0.12) continue;
      // lateral: to the right of travel (right normal = (-dz, dx))
      const rx = -L.dz,
        rz = L.dx;
      const off = L.parkSides ? lat : L.kind === "st" ? lat - 0.6 : lat;
      // (citylife r1) curb life: a delivery truck double-parked on hazards, a taxi pulled over to drop a fare, an MTA bus
      // at its stop. Their own RNG stream (the regular parked-car layout stays as it was); regular cars keep clear of them.
      const special = [];
      {
        const r2 = mulberry32((L.id * 69621 + (lat > 0 ? 7 : 3)) >>> 0);
        const av = L.kind !== "st";
        const put = (type, sAt, latOff, haz) => {
          const T = VTYPES[type];
          if (sAt < 8 || sAt > L.len - 10) return;
          const x = L.ax + L.dx * sAt + rx * latOff,
            z = L.az + L.dz * sAt + rz * latOff;
          if (
            curbBlocked(x, z, 1.5) ||
            islandNear(x, z, 2.8) ||
            bikeLaneAt(x, z) ||
            onDiag(x, z, T.len / 2 + 3, L.oneWayBway ? L.diag : null) ||
            inBJ(x, z) ||
            jx.nearTurn(x, z, T.len / 2 + 1.6)
          )
            return; // (layout2 r3) bulb-outs, bike lanes
          (L.dbl ??= []).push({
            s: sAt,
            lat: latOff,
            hw: T.wid / 2,
            hl: T.len / 2,
          }); // (citylife junctions) passing cars ease away from it
          special.push({
            type,
            len: T.len,
            wid: T.wid,
            h: T.h,
            x,
            z,
            ry: -L.heading + (r2() - 0.5) * 0.05,
            color: colorOf(type, r2()),
            v: 0,
            parked: true,
            haz,
            s: sAt,
          });
        };
        // (citylife junctions) half in the lane, but never closer than 2.45 m to the lane centre: a bus still gets by
        const inset = (d, min) =>
          Math.sign(off) * Math.max(Math.abs(off) - d, min);
        if (r2() < (av ? 0.2 : 0.26) && !L.narrow)
          put("truck", 12 + r2() * (L.len - 30), inset(1.05, 2.45), true); // double-parked, half in the lane
        if (r2() < 0.16 && !L.narrow)
          put(
            ["taxi_hy", "taxi_mv", "taxi_gr", "taxi_hy"][
              (L.id * 7 + (lat > 0 ? 1 : 0)) % 4
            ],
            10 + r2() * (L.len - 25),
            inset(0.35, 2.35),
            true,
          ); // pulled over
        if (av && r2() < 0.14 && L.stopS > 30)
          put("bus", L.stopS - 12 - r2() * 8, inset(0.4, 2.65), false); // at the stop, near side
      }
      for (const q of special) out.push(q);
      for (let s = 9 + rng() * 5; s < L.len - 12; s += 5.9 + rng() * 2.4) {
        if (rng() < (L.kind === "st" ? 0.16 : 0.28)) continue;
        if (special.some((q) => Math.abs(q.s - s) < q.len / 2 + 3.4)) continue; // (street r10) fewer parked cars on avenues (street r11: 0.45 -> 0.28, critic 'parked cars along curbs')
        let r = rng();
        let type =
          r < 0.08 ? "taxi" : r < 0.52 ? "sedan" : r < 0.93 ? "suv" : "truck";
        {
          // (vehicles r1) model variety from a position hash (keeps the parked-car RNG stream / layout unchanged)
          const h =
            Math.abs(Math.sin(L.id * 12.9898 + s * 78.233) * 43758.5453) % 1;
          if (type === "taxi")
            type =
              h < 0.15
                ? "taxi"
                : h < 0.55
                  ? "taxi_hy"
                  : h < 0.8
                    ? "taxi_mv"
                    : "taxi_gr"; // (vehicles r4) fewer Crown Vics
          else if (type === "sedan")
            type = h < 0.42 ? "sedan" : h < 0.74 ? "sedan2" : "hatch"; // (vehicles r3) + sedan2 / cross
          else if (type === "suv")
            type =
              h < 0.32
                ? "suv"
                : h < 0.6
                  ? "cross"
                  : h < 0.88
                    ? "suv2"
                    : "pickup";
          else if (type === "truck") type = h < 0.45 ? "van" : "truck";
        }
        const T = VTYPES[type];
        if (type === "truck" || type === "van" || type === "pickup") s += 1.3;
        const x = L.ax + L.dx * s + rx * off + (rng() - 0.5) * 0.2,
          z = L.az + L.dz * s + rz * off + (rng() - 0.5) * 0.2;
        if (
          curbBlocked(x, z, 1.5) ||
          islandNear(x, z, 2.8) ||
          bikeLaneAt(x, z) ||
          onDiag(x, z, T.len / 2 + 3, L.oneWayBway ? L.diag : null) ||
          inBJ(x, z) ||
          jx.nearTurn(x, z, T.len / 2 + 1.6)
        )
          continue; // (layout2 r3) bulb-outs, bike lanes; (citylife junctions) not on Broadway's crossing / a turning path
        // same side as travel: park facing the travel direction (streets: both curbs face the one-way direction)
        const ry = -L.heading + (rng() - 0.5) * 0.04;
        out.push({
          type,
          len: T.len,
          wid: T.wid,
          h: T.h,
          x,
          z,
          ry,
          color: colorOf(type, rng()),
          v: 0,
          parked: true,
        });
        if (type === "truck") s += 2.5;
        else if (type === "van" || type === "pickup") s += 0.6;
      }
    }
    if (densityScale < 1) {
      let kept = 0;
      for (const vehicle of out)
        if (rng() < densityScale) out[kept++] = vehicle;
      out.length = kept;
    }
    return out;
  };
  const stream = (cam) => {
    const R2 = RA * RA,
      R2o = (RA + 60) ** 2,
      P2 = PARK_R * PARK_R,
      P2o = (PARK_R + 50) ** 2;
    for (const L of links) {
      const d2 = segDist2(L, cam.x, cam.z) * (L.bridge ? 0.75 : 1); // (citylife bridges) decks stream to 1.15x the radius (seen from afar; LOD2 beyond 230 m)
      L.far = d2 > 330 * 330 ? 2 : d2 > 200 * 200 ? 1 : 0; // (citylife bridges) step tiers: every frame / 2nd / 4th
      if (!L.active && d2 < R2) {
        L.active = true;
        populate(L);
      } else if (L.active && d2 > R2o) {
        L.active = false;
        for (const c of L.cars) c.dead = true;
        L.cars = [];
      }
      if (!L.parked && d2 < P2) L.parked = parkedFor(L);
      else if (L.parked && d2 > P2o) L.parked = null;
    }
    cars = cars.filter((c) => !c.dead);
    refill(cam);
  };
  const kindOf = (L) =>
    L.bridge
      ? "br"
      : L.vmap
        ? "map"
        : L.oneWayBway
          ? "dg1"
          : L.diag && L.kind === "dg"
            ? "dg"
            : L.kind === "ws"
              ? "ws"
              : L.kind === "st"
                ? "st"
                : "av";
  const linkTarget = (L) =>
    L.noSpawn || L.blockS < Infinity
      ? 0
      : (L.len / 1000) *
        DENSITY[kindOf(L)] *
        densityScale *
        (L.vmap && L.cz > 2400 ? 0.6 : 1) *
        (L.bridge && L.dx < 0 ? (L.lane === 2 ? 0 : 0.35) : 1); // FiDi saturates first; westbound decks feed the avenue T (it merges into the avenue's gaps) // FiDi's crooked one-lane grid saturates first
  // top the streamed area up to its target: spawn on links that nobody can see (outside the last frame's frustum or
  // > 260 m away), at a free spot clear of the junction stretches, at a speed it can stop from
  let refillT = 0;
  const refill = (cam) => {
    let want = 0,
      have = 0;
    const cand = [];
    for (const L of links) {
      if (!L.active) continue;
      const t = linkTarget(L);
      want += t;
      have += L.cars.length;
      if (t - L.cars.length > 0.6) cand.push(L);
    }
    jStats.want = Math.round(want);
    jStats.have = have;
    // (citylife bridges) and drain: a link holding far more than its target (bridge traffic pouring into FiDi, a queue that
    // keeps growing) loses a standing car nobody can see, so the density knob bounds both ways and queues can't grow forever
    let drained = 0;
    for (const L of links) {
      if (
        !L.active ||
        drained >= 6 ||
        L.cars.length < 3 ||
        L.cars.length <= linkTarget(L) * 1.5 + 2
      )
        continue;
      const dx = L.cx - cam.x,
        dz = L.cz - cam.z;
      sph.center.set(L.cx, 2, L.cz);
      sph.radius = L.len / 2 + 6;
      if (
        dx * dx + dz * dz < 260 * 260 &&
        frustumOk &&
        frustum.intersectsSphere(sph)
      )
        continue;
      for (const q of L.cars)
        if (!q.conn && q.v < 0.5 && !q._vis && !(q.reg && q.reg.length)) {
          q.dead = true;
          drained++;
          jStats.drain++;
          break;
        }
    }
    if (drained) {
      for (const L of links)
        if (L.active && L.cars.some((q) => q.dead))
          L.cars = L.cars.filter((q) => !q.dead);
      cars = cars.filter((q) => !q.dead);
    }
    const deficit = Math.min(want - have, MAX_CARS - cars.length);
    if (deficit < 1 || !cand.length) return;
    let budget = Math.min(24, Math.ceil(deficit * 0.1)); // ~10 % of the gap per 0.3 s tick
    for (let tries = 0; tries < 60 && budget > 0; tries++) {
      const L = cand[Math.floor(rnd() * cand.length)];
      const dx = L.cx - cam.x,
        dz = L.cz - cam.z;
      sph.center.set(L.cx, 2, L.cz);
      sph.radius = L.len / 2 + 6;
      if (
        dx * dx + dz * dz < 260 * 260 &&
        frustumOk &&
        frustum.intersectsSphere(sph)
      )
        continue;
      const lo = Math.max(6, (L.xEarly ?? 0) + 4),
        hi = Math.min(L.stopS, L.len) - 10;
      if (hi - lo < 8) continue;
      const s0 = lo + rnd() * (hi - lo);
      if (L.xcr && L.xcr.some((x) => s0 > x.stop - 12 && s0 < x.s1 + 6))
        continue;
      let ok = true,
        lead = null,
        vs = 0;
      for (const q of L.cars) {
        vs += q.v;
        if (Math.abs(q.s - s0) < q.len / 2 + 9) {
          ok = false;
          break;
        }
        if (q.s > s0 && !lead) lead = q;
      }
      if (
        !ok ||
        (L.cars.length > 1 && vs / L.cars.length < 1.5) ||
        (lead && lead.v < 1 && lead.s - s0 < 40)
      )
        continue; // never feed a standing queue (gridlock rings)
      {
        const px = L.ax + L.dx * s0,
          pz = L.az + L.dz * s0; // nobody else there either (lane changers, turning cars, other links)
        const py = L.y0 !== undefined ? L.y0 + ((L.y1 - L.y0) * s0) / L.len : 0;
        for (const q of cars)
          if (
            (q.x - px) ** 2 + (q.z - pz) ** 2 < 100 &&
            Math.abs(q.y - py) < 3
          ) {
            ok = false;
            break;
          }
      }
      if (!ok) continue;
      const c = newCar(L, s0, 0, (L.id * 2654435761 + serial * 97) >>> 0);
      const room = (lead ? lead.s - lead.len / 2 : L.stopS) - (s0 + c.len / 2);
      if (room < 4) continue;
      c.v = Math.min(
        c.v0 * 0.7,
        Math.sqrt(2 * 3 * Math.max(0, room - 2)),
        lead ? lead.v + room * 0.5 : 99,
      );
      insertSorted(L.cars, c);
      cars.push(c);
      budget--;
      jStats.refill++;
    }
  };

  // ------------------------------------------------------------------ simulation
  let time = 0;
  const tmp3 = [0, 0, 0];
  const playerObstacle = (c) => {
    const p = player.pos;
    const dx = p.x - c.x,
      dz = p.z - c.z;
    if (dx * dx + dz * dz > 2500) return null;
    if (p.y > player.ground + 2.6 || Math.abs(player.ground - c.y) > 3)
      return null; // (citylife bridges) not on this car's level
    const fx = Math.cos(c.ry),
      fz = -Math.sin(c.ry);
    const along = dx * fx + dz * fz,
      lat = Math.abs(dx * fz - dz * fx);
    const look = Math.max(12, c.v * 2.8 + 9);
    // the player's body (arms, stance) is ~PLAYER_R wide; drivers keep a further lateral berth and stop well short
    if (
      along > 0 &&
      along < c.len / 2 + look &&
      lat < c.wid / 2 + PLAYER_R + 0.8
    ) {
      c._pAlong = along;
      c._pLat = lat;
      // in the car's path (with a 0.3 m berth): stop well short. Beside the path: creep past at walking pace.
      if (lat < c.wid / 2 + PLAYER_R + 0.3)
        return along - c.len / 2 - PLAYER_R - 1.4;
      c._pSoft = true;
    }
    return null;
  };
  // mask: which links to advance this call (time slicing: far links step every 2nd frame with a doubled dt)
  // danger zones (active crimes / fights / alarms): approaching cars stop short of the circle, cars inside freeze with
  // flashing hazards; lanes reopen when the zone is cleared (or its ttl runs out)
  const zones = new Map();
  const zoneObstacle = (c) => {
    if (!zones.size) return null;
    let best = null;
    const fx = Math.cos(c.ry),
      fz = -Math.sin(c.ry);
    for (const z of zones.values()) {
      if (z.until < time) continue;
      const dx = z.x - c.x,
        dz = z.z - c.z;
      const along = dx * fx + dz * fz,
        lat = Math.abs(dx * fz - dz * fx);
      if (dx * dx + dz * dz < (z.r + c.len * 0.3) ** 2 && along < z.r * 0.6) {
        c.inZone = true;
        return 0;
      } // inside: freeze
      if (
        along > 0 &&
        lat < z.r + c.wid / 2 &&
        along < z.r + Math.max(25, c.v * 3 + 12)
      ) {
        const g =
          along -
          Math.sqrt(Math.max(0, (z.r + c.wid / 2) ** 2 - lat * lat)) -
          c.len / 2 -
          1.5;
        if (best === null || g < best) best = g;
      }
    }
    return best;
  };
  // ------------------------------------------------------------------ (citylife junctions) natural lane keeping
  // lateral room each side of the lane centre (m, before the vehicle's extra width): adjacent lanes are 3.3-3.6 m apart,
  // so two buses drifting toward each other still clear; curb lanes keep off the parked row
  for (const L of links) {
    const w = L.diag?.w ?? 0;
    if (L.kind === "av" || L.kind === "dg") {
      L.latL = 0.3;
      L.latR = L.lane === 1 ? (L.kind === "dg" ? 0.45 : 0.25) : 0.35;
    } else if (L.kind === "ws") {
      L.latL = 0.22;
      L.latR = 0.22;
    } else if (L.narrow) {
      L.latL = 0.2;
      L.latR = 0.2;
    } else if (L.bridge) {
      L.latL = 0.25;
      L.latR = 0.25;
    } // (citylife bridges) 3.4 m lanes
    else if (L.diag) {
      const one = !!L.diag.oneway || (w < 12 && !L.vmap);
      L.latL = one
        ? Math.min(0.35, Math.max(0, w / 2 - 1.6))
        : Math.min(0.3, Math.max(0, (w / 2 - 2.55) / 2));
      L.latR = one ? L.latL : Math.min(0.3, Math.max(0, w / 4 - 1.5));
    } else {
      L.latL = 0.4;
      L.latR = 0.3;
    }
  }
  const lateral = (c, L, dt) => {
    c.odo += c.v * dt;
    const dS = c.s - c.len / 2,
      dE = L.len - c.s - c.len / 2;
    let f = Math.min(dS, dE) / 10;
    f = f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f); // centred through the junctions
    const shrink = Math.max(0, (c.wid - 1.9) / 2);
    const hi = Math.max(0, L.latR - shrink),
      lo = -Math.max(0, L.latL - shrink);
    let tgt =
      Math.max(
        lo,
        Math.min(hi, c.latB + c.latA * Math.sin(c.odo * c.latK + c.latP)),
      ) * f;
    if (L.dbl)
      for (const o of L.dbl) {
        // give the double-parked truck / pulled-over cab / bus at the stop some room
        const d = Math.abs(o.s - c.s),
          w = o.hl + c.len / 2;
        if (d > w + 10) continue;
        const ramp = d < w + 1 ? 1 : 1 - (d - w - 1) / 9,
          need = o.hw + c.wid / 2 + 0.35;
        if (o.lat > 0) {
          const cap = o.lat - need;
          if (cap < tgt) tgt += (cap - tgt) * ramp;
        } else {
          const cap = o.lat + need;
          if (cap > tgt) tgt += (cap - tgt) * ramp;
        }
      }
    const d = tgt - c.lat,
      st = Math.sign(d) * Math.min(Math.abs(d), 0.8 * dt);
    c.lat += st;
    c.latV = st / Math.max(dt, 1e-4);
    c.wob += dt * 0.45;
    if (c.lcDur > 0) {
      // lane change: the offset from the old lane eases out
      c.lcT += dt;
      const u = Math.min(1, c.lcT / c.lcDur),
        sm = u * u * (3 - 2 * u),
        n = c.lc0 * (1 - sm);
      c.latV += (n - c.lc) / Math.max(dt, 1e-4);
      c.lc = n;
      if (u >= 1) {
        c.lc = 0;
        c.lcDur = 0;
      }
    }
    c.yaw =
      Math.max(-0.2, Math.min(0.2, c.latV / Math.max(c.v, 2.5))) +
      0.004 * Math.sin(c.wob) * f; // heading follows the drift + a faint wander
  };
  // occasional lane change on a multi-lane road (behind a slow car, or just because): gap acceptance in the target lane,
  // enough room behind in the old one, never near a junction / crossing or while holding a reservation
  const laneChange = (c, L, arr, i) => {
    c.lcCool = 2.5 + c.rng() * 5;
    if (
      L.kind === "st" ||
      c.lcDur > 0 ||
      (c.reg && c.reg.length) ||
      c.wait ||
      c.s < 20 ||
      L.len - c.s < 45 ||
      c.v < 3
    )
      return false;
    for (const X of L.xm)
      if (X.base > c.s - 25 && X.base < c.s + 50) return false;
    const A2 = L.alt.link;
    if (!A2.active || A2.blockS < Infinity || A2.noSpawn) return false;
    const lead = arr[i + 1],
      slow = lead && lead.v < c.v0 * 0.6 && lead.s - c.s < 40;
    if (!slow && c.rng() > 0.12) return false;
    let nl = null,
      nf = null;
    for (const q of A2.cars) {
      if (q.s >= c.s) {
        nl = q;
        break;
      }
      nf = q;
    }
    if (
      nl &&
      (nl.s - nl.len / 2 - (c.s + c.len / 2) < Math.max(14, c.v * 1.5 + 6) ||
        (slow && nl.v < c.v))
    )
      return false;
    if (
      nf &&
      (nf.conn ||
        c.s - c.len / 2 - (nf.s + nf.len / 2) <
          Math.max(12, nf.v * 1.7 + 6 + Math.max(0, nf.v - c.v) * 2.5))
    )
      return false;
    const of = arr[i - 1];
    if (
      of &&
      c.s - c.len / 2 - (of.s + of.len / 2) < 10 + Math.max(0, of.v - c.v) * 3
    )
      return false;
    if (A2.dbl)
      for (const o of A2.dbl)
        if (o.s > c.s - 15 && o.s < c.s + 60) return false;
    arr.splice(i, 1);
    insertSorted(A2.cars, c);
    c.lc0 = c.lc = (L.ax - A2.ax) * -A2.dz + (L.az - A2.az) * A2.dx; // old lane centre on the new lane's right normal
    c.lcT = 0;
    c.lcDur = 3.2 + c.rng() * 1.6;
    c.lcFrom = L;
    c.link = A2;
    (L.lcOut ??= []).push(c);
    c.pre = null;
    c.next = chooseNext(c, A2);
    jStats.lc++;
    return true;
  };
  const step = (dt, far = null) => {
    const lightAv = phase(time, "av"),
      lightSt = phase(time, "st");
    for (const L of links) {
      if (!L.active || (far !== null && L.far !== far)) continue;
      const arr = L.cars;
      for (let i = 1; i < arr.length; i++) {
        // insertion sort (nearly sorted)
        const c = arr[i];
        let j = i - 1;
        while (j >= 0 && arr[j].s > c.s) {
          arr[j + 1] = arr[j];
          j--;
        }
        arr[j + 1] = c;
      }
    }
    for (const L of links) {
      if (!L.active || (far !== null && L.far !== far)) continue;
      const arr = L.cars,
        n = arr.length;
      const light = L.signal
        ? L.mapSig
          ? mapPhase(time, L.axis)
          : L.axis === "av"
            ? lightAv
            : lightSt
        : 2;
      for (let i = n - 1; i >= 0; i--) {
        const c = arr[i];
        const front = c.s + c.len / 2;
        let gap = 1e4,
          vL = c.v;
        // (citylife junctions) list leader: cars still on a *different* connector into this link are not in our lane yet;
        // the junction model follows them where the paths actually meet (jx follow conflicts), consistently both ways
        let li = i + 1;
        if (c.conn)
          while (li < n && arr[li].conn && arr[li].conn !== c.conn) li++;
        let why = "free",
          whyC = null; // (citylife junctions) binding constraint, for the probes
        if (li < n) {
          const l = arr[li];
          gap = l.s - l.len / 2 - front;
          vL = l.v;
          why = "lead";
          whyC = l;
        } else if (c.next && c.next.link.active && !c.conn) {
          const N = c.next.link,
            C = getConn(L, c.next);
          for (let k = 0; k < N.cars.length; k++) {
            const l = N.cars[k];
            if (l.conn && l.conn !== C) continue;
            gap = L.len - front + C.len + (l.s - l.len / 2);
            vL = l.v;
            why = "next";
            whyC = l;
            break;
          }
        }
        let v0 = c.v0;
        c._red = false;
        if (c.lcDur > 0 && Math.abs(c.lc) > 1.2 && c.lcFrom) {
          // (citylife junctions) still half in the old lane: keep clear of its cars too
          for (const q of c.lcFrom.cars)
            if (q.s > c.s) {
              const g = q.s - q.len / 2 - front;
              if (g < gap) {
                gap = g;
                vL = q.v;
                why = "lcold";
                whyC = q;
              }
              break;
            }
        }
        if (L.lcOut)
          for (let k = L.lcOut.length - 1; k >= 0; k--) {
            // ...and the old lane's cars keep clear of it
            const q = L.lcOut[k];
            if (
              q.dead ||
              q.lcDur <= 0 ||
              Math.abs(q.lc) <= 1.2 ||
              q.lcFrom !== L
            ) {
              L.lcOut.splice(k, 1);
              continue;
            }
            if (q !== c && q.s > c.s) {
              const g = q.s - q.len / 2 - front;
              if (g < gap) {
                gap = g;
                vL = q.v;
                why = "lcnew";
                whyC = q;
              }
            }
          }
        if (L.blockS < Infinity && c.s < L.blockS + 3) {
          const d = L.blockS - front;
          if (d > -2 && d < gap) {
            gap = Math.max(0.05, d);
            vL = 0;
          }
        }
        if (!c.conn) {
          const dEnd = L.len - front;
          if (c.next && c.next.turn !== "S")
            v0 = Math.min(v0, 4.8 + 0.3 * Math.max(0, dEnd));
          const dStop = L.stopS - front;
          if (L.signal && dStop > -0.4) {
            let stop = light === 0 || (light === 1 && dStop > c.v * 1.3 + 1.5);
            if (!stop && c.next) {
              // (citylife junctions) left turns yield via the junction model (jx: approach yield), not L.opp
              const xw = c.next.link.xwStart,
                xe = L.xwEnd;
              if ((xw && xw.peds > 0) || (xe && xe.peds > 0)) stop = true; // pedestrians still on the crosswalk
            }
            if (stop && c.next && c.reg && jx.holds(c, jx.moveFor(L, c.next)))
              stop = false; // (citylife junctions) granted + kept (inside the box): clear it
            if (stop) {
              if (dStop < gap) {
                gap = dStop;
                vL = 0;
                why = "red";
              }
            }
            c._red = stop && dStop < 30;
          }
          if (L.xst) {
            // (layout2) mid-link crossing of an off-grid road (Broadway / Village): stop unless our axis is green
            const xl = L.axis === "av" ? lightAv : lightSt;
            if (xl !== 2)
              for (let xi = 0; xi < L.xst.length; xi++) {
                const xs = L.xst[xi],
                  d = xs - front;
                if (d <= -0.4) continue;
                if (c.reg && L.xm[xi] && jx.holds(c, L.xm[xi])) break; // (citylife junctions) granted + kept: clear the crossing
                if ((xl === 0 || d > c.v * 1.3 + 1.5) && d < gap) {
                  gap = Math.max(0.05, d);
                  vL = 0;
                  why = "xred";
                }
                break;
              }
          }
          if (!c.next && dEnd < 30) {
            /* map edge / despawn: keep going */
          }
        } else if (c.conn.turn !== "S") v0 = Math.min(v0, 5.5);
        {
          // (citylife junctions) reservation at the stop point + following cars that share our path through the box
          const jr = jx.car(
            c,
            front,
            i + 1 < n ? arr[i + 1] : null,
            time,
            sigStop,
            redFor,
            chooseNext,
          );
          if (jr.gap < gap) {
            gap = Math.max(0.05, jr.gap);
            vL = jr.vL;
            why = jr.why;
            whyC = jr.whyC;
          }
        }
        c._why = why;
        c._whyC = whyC;
        // (citylife junctions r3) deadlock breaker, in view too: a car standing > 12 s whose chain of constraints loops back
        // to itself (a ring of holders / followers in a gore) and has the lowest id in that ring creeps (<= 2 m/s) as far
        // as its own body can move without touching any car, which lets the ring unwind. Never a despawn, never an overlap.
        if (
          c.creepT > 0 ||
          (c.stillT > 12 && whyC && !c._red && (c.creepT = inCycle(c)))
        ) {
          c.creepT -= dt;
          const free = freeAhead(c);
          if (free > 0.3) {
            gap = free;
            vL = 0;
            v0 = Math.min(v0, 2);
            why = "creep";
            whyC = null;
            c._why = why;
            c._whyC = null;
          }
        }
        c._pAlong = null;
        c._pSoft = false;
        c.inZone = false;
        const zo = zoneObstacle(c);
        if (zo !== null && zo < gap) {
          gap = Math.max(0.05, zo);
          vL = 0;
        }
        const po = playerObstacle(c);
        if (c._pSoft)
          v0 = Math.min(
            v0,
            2.2 + Math.max(0, c._pAlong - c.len / 2 - 6) * 0.35,
          );
        let blocked = false;
        if (po !== null && po < gap) {
          gap = Math.max(0.05, po);
          vL = 0;
          blocked = true;
        }
        const dv = c.v - vL;
        const sStar =
          c.dS0 +
          Math.max(0, c.v * c.dTH + (c.v * dv) / (2 * Math.sqrt(c.dA * B))); // (citylife junctions) per-driver IDM
        let acc =
          c.dA * (1 - (c.v / v0) ** 4 - (sStar / Math.max(gap, 0.1)) ** 2);
        // emergency stop for the player (a car that only now sees Spider-Man stands on the brakes)
        acc = Math.max(
          blocked && po < (c.v * c.v) / 12 + 1 ? -13 : -9,
          Math.min(c.dA, acc),
        );
        c.acc = acc;
        c.v = Math.max(0, c.v + acc * dt);
        // hard constraint: the front bumper never advances into the player's body (collideDynamic keeps pushing the
        // player out of a car that is already overlapping; a car must not drive/stop into him)
        if (c._pAlong !== null && c._pLat < c.wid / 2 + PLAYER_R + 0.1) {
          const room = c._pAlong - c.len / 2 - PLAYER_R - 0.25;
          if (c.v * dt > room) {
            c.v = 0;
            c.acc = -9;
          }
        }
        c.s += c.v * dt;
        if (!c.conn) {
          if (!L.far || c.lcDur > 0) lateral(c, L, dt);
        } // (perf) links > 280 m away: drift frozen
        else {
          c.lat = 0;
          c.lc = 0;
          c.latV = 0;
          c.yaw = 0;
        }
        // (citylife junctions) last-resort deadlock breaker: a car standing > 60 s (not at a red light) is retired, never
        // while it is drawn (in view the junction model's reroute / starvation priority resolves jams)
        if (c.v < 0.1 && !c._red) {
          c.stuckT += dt;
          if (c.stuckT > 60 && !c._vis) {
            c.dead = true;
            jStats.broken++;
          }
        } else c.stuckT = 0;
        c.stillT = c.v < 0.3 ? c.stillT + dt : 0;
        c.brake = acc < -0.6 || c.v < 0.4 ? 1 : 0;
        if (c.inZone) {
          c.v = Math.max(0, c.v - 12 * dt);
          c.brake = (time * 1.6) % 1 < 0.5 ? 1 : 0;
        } // hazards
        c.pitch +=
          ((acc < -1.5 ? Math.min(0.025, -acc * 0.004) : 0) - c.pitch) *
          Math.min(1, dt * 6);
        // honk when Spider-Man is standing in the way
        if (blocked && c.v < 1.0 && gap < 6) {
          c.blockT += dt;
          if (c.blockT > 0.7 && time > c.honkT) {
            c.honkT = time + 2.2 + c.rng() * 3;
            const d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
            horn(d, VTYPES[c.type].big, c.x, c.z, c.y ?? 0);
            events.push({ type: "honk", x: c.x, z: c.z, t: time });
          }
        } else c.blockT = Math.max(0, c.blockT - dt);
      }
    }
    // link / connector transitions
    for (const L of links) {
      if (!L.active || (far !== null && L.far !== far)) continue;
      const arr = L.cars;
      for (let i = arr.length - 1; i >= 0; i--) {
        const c = arr[i];
        if (c.dead) {
          arr.splice(i, 1);
          continue;
        } // (citylife junctions) retired by the stuck breaker
        if (
          L.alt &&
          !L.far &&
          !c.conn &&
          (c.lcCool -= dt) < 0 &&
          laneChange(c, L, arr, i)
        )
          continue;
        if (c.conn && c.s >= 0) {
          c.conn = null;
          c.next = c.pre && c.pre.L === L ? c.pre.opt : chooseNext(c, L);
          c.pre = null;
        } // (citylife junctions) pre: picked for a chained grant
        if (!c.conn && c.s > L.len) {
          arr.splice(i, 1);
          const nx = c.next;
          if (!nx || !nx.link.active || (nodes[L.to].deadEnd && !c._vis)) {
            c.dead = true;
            continue;
          } // (citylife bridges) the far shore's dead end is a sink (the westbound decks are topped up by the refill)
          const C = getConn(L, nx);
          const M = jx.moveFor(L, nx);
          c.via = M;
          jx.register(c, M); // (citylife junctions) (no-op when already granted)
          c.conn = C;
          c.link = nx.link;
          c.s = c.s - L.len - C.len;
          insertSorted(nx.link.cars, c);
        }
      }
    }
    // inflow at the edge of the streamed area
    for (const L of links) {
      if (
        !L.active ||
        (far !== null && L.far !== far) ||
        cars.length >= MAX_CARS
      )
        continue;
      const fromN = nodes[L.from];
      let fed = false;
      for (const I of fromN.inLinks)
        if (I.active) {
          fed = true;
          break;
        }
      if (fed) continue;
      if (L.blockS < Infinity) continue;
      const first = L.cars[0];
      if (!first || first.s - first.len / 2 > (L.spawnGap || 20) + 7.5) {
        // (citylife bridges) + room for the new car's own body
        const c = newCar(L, 0, 0, (L.id * 2654435761 + serial * 97) >>> 0);
        c.s = c.len / 2;
        c.v = c.v0 * 0.8;
        if (first)
          c.v = Math.min(
            c.v,
            first.v + Math.max(0, first.s - first.len / 2 - c.len - 2) * 0.6,
          ); // (citylife bridges) never faster than it can stop behind the car ahead
        L.cars.unshift(c);
        cars.push(c);
        L.spawnGap =
          ((L.kind === "st" ? 12 : 8) + c.rng() * 35) /
          Math.max(0.05, densityScale);
        {
          // (street r9, street agent) inflow in platoons too: short headways inside a bunch, long gaps between bunches
          if (!(L.plat > 0))
            L.plat =
              (L.kind === "st" ? 2 : 1) +
              Math.floor(c.rng() * (L.kind === "st" ? 5 : 4));
          L.spawnGap =
            --L.plat > 0
              ? 2.5 + c.rng() * 5
              : (L.kind === "st"
                  ? 30 + c.rng() * 70
                  : 50 + c.rng() * 140) / Math.max(0.05, densityScale); /* (street r11) 70-260 -> 50-190 */ // (street r10) avenues ~half density
        }
      }
    }
    if (cars.some((c) => c.dead)) cars = cars.filter((c) => !c.dead);
    jx.tick(time); // (citylife junctions) release holders that left their movement
  };
  const getConn = (L, o) => {
    let C = L.conn.get(o.link.id);
    if (!C) {
      C = connector(L, o.link, o.turn);
      L.conn.set(o.link.id, C);
    }
    return C;
  };
  // (citylife junctions) movements + conflict table (npc/junctions.ts); signal hooks: may c go now? is o's light red?
  const jx = createJunctions(roads, getConn);
  const jStats = { broken: 0, lc: 0, refill: 0, drain: 0 };
  const camPos = new THREE.Vector3(1e9, 0, 0);
  const axisLight = (ax, L = null) =>
    L && L.mapSig ? mapPhase(time, ax) : phase(time, ax);
  const sigStop = (c, M, d) => {
    const L = M.kind === "x" ? M.L : M.inL;
    if (M.kind === "x" || L.signal) {
      const l = axisLight(L.axis, L);
      if (l === 0 || (l === 1 && d > c.v * 1.3 + 1.5)) return true;
    }
    if (M.kind === "c" && L.signal) {
      const xw = M.outL.xwStart,
        xe = L.xwEnd;
      if ((xw && xw.peds > 0) || (xe && xe.peds > 0)) return true;
    }
    return false;
  };
  const redFor = (o, M) =>
    (M.kind === "x" || M.inL.signal) &&
    axisLight(
      (M.kind === "x" ? M.L : M.inL).axis,
      M.kind === "x" ? M.L : M.inL,
    ) === 0;
  // (citylife junctions r2) the street-map junctions (no crosswalks) run roads.ts mapPhase: the grid's 22 / 11 s split starved their streets
  // (citylife bridges) the bridge T's run the same even split: the bridge gets half the cycle to empty into the city
  for (const L of links)
    L.mapSig = !!(
      L.signal &&
      ((L.vmap && !nodes[L.to].av) || nodes[L.to].bridgeT)
    );
  const tmpA = [0, 0, 0],
    tmpB = [0, 0, 0];
  // ring detection over the binding-constraint chain; returns seconds of creep for the ring's lowest id, else 0
  const inCycle = (c) => {
    let q = c._whyC,
      k = 0,
      lo = c.id;
    while (q && k++ < 16) {
      if (q === c) return lo === c.id ? 3 : 0;
      if (q.id < lo) lo = q.id;
      q = q._whyC;
    }
    return 0;
  };
  // how far c can advance (<= 4 m) along its path before its body would touch any other car (OBB test on the future pose)
  const freeAhead = (c) => {
    const near = [];
    for (const o of cars)
      if (o !== c && Math.abs(o.x - c.x) < 20 && Math.abs(o.z - c.z) < 20)
        near.push(o);
    const L = c.link,
      C = c.conn;
    let ok = 0;
    for (let d = 0.5; d <= 4; d += 0.5) {
      let x, z, h;
      if (C) {
        const u = c.s + d + C.len;
        if (u > C.len) break;
        connAt(C, u, tmpA);
        x = tmpA[0];
        z = tmpA[1];
        h = tmpA[2];
      } else {
        const s2 = c.s + d;
        if (s2 > L.len) break;
        x = L.ax + L.dx * s2;
        z = L.az + L.dz * s2;
        h = L.heading;
      }
      const fx = Math.cos(h),
        fz = Math.sin(h);
      let hit = false;
      for (const o of near) {
        const ofx = Math.cos(o.ry),
          ofz = -Math.sin(o.ry),
          dx = o.x - x,
          dz = o.z - z;
        for (const [ax, az] of [
          [fx, fz],
          [-fz, fx],
          [ofx, ofz],
          [-ofz, ofx],
        ]) {
          const ra =
            (c.len / 2 + 0.3) * Math.abs(fx * ax + fz * az) +
            (c.wid / 2 + 0.2) * Math.abs(-fz * ax + fx * az);
          const rb =
            (o.len / 2) * Math.abs(ofx * ax + ofz * az) +
            (o.wid / 2) * Math.abs(-ofz * ax + ofx * az);
          if (Math.abs(dx * ax + dz * az) > ra + rb) {
            hit = false;
            break;
          }
          hit = true;
        }
        if (hit) break;
      }
      if (hit) break;
      ok = d;
    }
    return ok;
  };
  const pathPt = (C, Lin, Lout, q, out) => {
    // point at arc length q along connector C, extended straight onto its links
    if (q < 0 && Lin) {
      const s = Lin.len + q;
      out[0] = Lin.ax + Lin.dx * s;
      out[1] = Lin.az + Lin.dz * s;
      return out;
    }
    if (q > C.len) {
      const s = q - C.len;
      out[0] = Lout.ax + Lout.dx * s;
      out[1] = Lout.az + Lout.dz * s;
      return out;
    }
    return connAt(C, Math.max(0, q), out);
  };
  const placeCar = (c) => {
    const L = c.link;
    if (c.conn) {
      const C = c.conn,
        u = c.s + C.len;
      connAt(C, u, tmp3);
      c.x = tmp3[0];
      c.z = tmp3[1];
      // (citylife junctions r3) heading = the chord between the axles' points on the path (not the tangent at the centre):
      // a bus on a tight curve no longer swings its rear straight out over the next lane
      const h = c.len * 0.3,
        Lin = c.via && c.via.C === C ? c.via.inL : null;
      pathPt(C, Lin, L, u - h, tmpA);
      pathPt(C, Lin, L, u + h, tmpB);
      c.ry = -Math.atan2(tmpB[1] - tmpA[1], tmpB[0] - tmpA[0]);
      const ya = Lin && Lin.y1 !== undefined ? Lin.y1 : 0,
        yb = L.y0 !== undefined ? L.y0 : 0; // (citylife bridges)
      c.y = ya + (yb - ya) * Math.max(0, Math.min(1, u / C.len));
      c.gp = Math.atan((yb - ya) / Math.max(1, C.len));
    } else {
      // (citylife junctions) lateral drift / lane-change offset along the right normal (-dz, dx), yaw from its rate
      const o = c.lat + c.lc;
      c.x = L.ax + L.dx * c.s - L.dz * o;
      c.z = L.az + L.dz * c.s + L.dx * o;
      c.ry = -L.heading - c.yaw;
      if (L.y0 !== undefined) {
        c.y = L.y0 + (L.y1 - L.y0) * Math.max(0, Math.min(1, c.s / L.len));
        c.gp = Math.atan(L.grade);
      } else {
        c.y = 0;
        c.gp = 0;
      }
    }
  };

  // ------------------------------------------------------------------ collision (C3)
  const near = []; // cars (moving + parked) within 40 m of the player, refreshed each frame
  const refreshNear = () => {
    near.length = 0;
    const p = player.pos;
    for (const c of cars)
      if (Math.abs(c.x - p.x) < 40 && Math.abs(c.z - p.z) < 40) near.push(c);
    for (const L of links) {
      if (!L.parked || !L.parked.length) continue;
      if (
        Math.abs(L.cx - p.x) > L.len / 2 + 50 ||
        Math.abs(L.cz - p.z) > L.len / 2 + 50
      )
        continue;
      for (const c of L.parked)
        if (Math.abs(c.x - p.x) < 40 && Math.abs(c.z - p.z) < 40) near.push(c);
    }
  };
  const _push = new THREE.Vector3(),
    _vel = new THREE.Vector3();
  const collideDynamic = (pos, radius = 0.4, height = 1.8) => {
    let hit = false,
      grounded = false,
      groundY = -Infinity,
      vel = null;
    let px = pos.x,
      pz = pos.z;
    const list = near.length
      ? near
      : cars.filter(
          (c) => Math.abs(c.x - pos.x) < 20 && Math.abs(c.z - pos.z) < 20,
        );
    for (const c of list) {
      const dx = px - c.x,
        dz = pz - c.z;
      if (dx * dx + dz * dz > (c.len / 2 + radius + 1) ** 2) continue;
      const fx = Math.cos(c.ry),
        fz = -Math.sin(c.ry);
      const lx = dx * fx + dz * fz,
        lz = -dx * fz + dz * fx; // local: lx along the car, lz lateral
      const hl = c.len / 2 - 0.05,
        hw = c.wid / 2;
      const base = c.parked ? 0 : c.y,
        roof = base + c.h; // (citylife bridges) cars on a deck stand at its height
      if (
        pos.y > roof - 0.35 &&
        pos.y < roof + 0.7 &&
        Math.abs(lx) < hl + radius * 0.3 &&
        Math.abs(lz) < hw + radius * 0.3
      ) {
        if (roof > groundY) {
          groundY = roof;
          grounded = true;
          vel = c.parked ? null : _vel.set(fx * c.v, 0, fz * c.v);
        }
        hit = true;
        continue;
      }
      if (pos.y >= roof - 0.35 || pos.y + height < base + 0.1) continue;
      const cx = Math.max(-hl, Math.min(hl, lx)),
        cz = Math.max(-hw, Math.min(hw, lz));
      let ox = lx - cx,
        oz = lz - cz;
      const d = Math.hypot(ox, oz);
      let pushL = 0,
        nlx = 0,
        nlz = 0;
      if (d > 1e-4) {
        if (d >= radius) continue;
        pushL = radius - d;
        nlx = ox / d;
        nlz = oz / d;
      } else {
        // centre inside the box: shortest way out
        const ex = hl - Math.abs(lx),
          ez = hw - Math.abs(lz);
        if (ex < ez) {
          pushL = ex + radius;
          nlx = Math.sign(lx) || 1;
        } else {
          pushL = ez + radius;
          nlz = Math.sign(lz) || 1;
        }
      }
      const wx = (nlx * fx - nlz * fz) * pushL,
        wz = (nlx * fz + nlz * fx) * pushL;
      px += wx;
      pz += wz;
      hit = true;
      if (!c.parked && c.v > 0.5) vel = _vel.set(fx * c.v, 0, fz * c.v);
    }
    if (!hit) return null;
    _push.set(px - pos.x, 0, pz - pos.z);
    const out = { push: _push };
    if (grounded) {
      out.grounded = true;
      out.groundY = groundY;
    }
    if (vel) out.velocity = vel;
    return out;
  };

  // ------------------------------------------------------------------ render
  const frustum = new THREE.Frustum(),
    pv = new THREE.Matrix4(),
    sph = new THREE.Sphere();
  let frustumOk = false,
    renderN = 0;
  const events = [];
  let proxyOn = false; // (perf r2) csm hides the hi cars from cascades >= 2 (userData.maxCascade) once proxies can cast
  const render = (camera, clear) => {
    if (
      !proxyOn &&
      cascadedShadowState.proxyShadows &&
      !isPerformanceFeatureDisabled("noproxy")
    ) {
      proxyOn = true;
      for (const t in tiers)
        if (tiers[t].proxy) {
          tiers[t].hi.mesh.userData.maxCascade = 1;
          tiers[t].low.mesh.userData.maxCascade = 1;
        }
    } // (vehicles r1) LOD1 too
    // (citylife bridges perf) the grouped LOD2 far tier (> 230 m) is rebuilt / uploaded every 2nd frame only
    const farSkip = (renderN++ & 1) === 1;
    for (const k of all) if (!(farSkip && k.farTier)) k.begin();
    cao.begin();
    hlp.begin(); // (street r7) (daynight)
    const clOn = cityLights.enabled && nightK.value > 0.01;
    clN = 0; // (night) car lights
    const cp = camera.position;
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    frustumOk = true;
    const emit = (c, moving) => {
      const dx = c.x - cp.x,
        dz = c.z - cp.z,
        d2 = dx * dx + dz * dz;
      if (clear) {
        const along = dx * clear.dir.x + dz * clear.dir.z,
          lat = Math.abs(dx * clear.dir.z - dz * clear.dir.x);
        if (along > -6 && along < clear.len && lat < clear.half + c.len * 0.3)
          return;
      }
      const lit = moving || c.haz !== undefined; // (night) parked cars: lights off (hazard trucks / taxis / buses at the stop: on)
      if (clOn && lit && d2 < CL_R * CL_R && clN < CL_CAP) {
        // (night) headlight candidate: the beam (sphere ahead of the car) reaches the view
        const f = c.len * 0.5 + 15;
        sph.center.set(
          c.x + Math.cos(c.ry) * f,
          1.5 + (moving ? c.y : 0),
          c.z - Math.sin(c.ry) * f,
        );
        sph.radius = 18;
        if (d2 < 400 || frustum.intersectsSphere(sph)) {
          clCar[clN] = c;
          clD[clN++] = d2;
        }
      }
      const tier = d2 < HI_D * HI_D ? "hi" : d2 < LOW_D * LOW_D ? "low" : "far";
      if (farSkip && tier === "far") {
        if (moving) c._vis = true;
        return;
      }
      if (moving) c._vis = false;
      if (d2 > 1600) {
        sph.center.set(c.x, 1.5 + (moving ? c.y : 0), c.z);
        sph.radius = c.len * 0.6 + 1;
        if (!frustum.intersectsSphere(sph)) return;
      }
      if (moving) c._vis = true; // (citylife junctions) the stuck breaker only retires cars nobody is looking at
      const cy = moving ? c.y : 0,
        cpitch = moving ? c.pitch + c.gp : 0; // (citylife bridges) deck height + grade
      tiers[c.type][tier].push(
        c.x,
        cy,
        c.z,
        c.ry,
        c.color,
        moving
          ? c.brake
          : c.haz
            ? (time * 1.5 + c.x * 0.01) % 1 < 0.5
              ? 1
              : 0
            : lit
              ? 0
              : -1,
        cpitch,
        (c.adSeed ??= Math.random()),
      ); // (night) -1: parked, lamps off // (citylife r1) hazards ((vehicles r2) + per-car seed)
      if (tier !== "far" && proxyOn)
        tiers[c.type].proxy?.push(c.x, cy, c.z, c.ry, c.color, 0, cpitch); // (perf r2) (vehicles r1: LOD1 cars too)
      if (cy > 0.5) return; // on a bridge deck: no street-level contact AO / headlight pool
      if (tier !== "far")
        cao.push(c.x, c.z, c.ry, VTYPES[c.type].len, VTYPES[c.type].wid); // (street r7)
      if (moving && d2 < 250 * 250 && !clOn)
        hlp.push(c.x, c.z, c.ry, VTYPES[c.type].len); // (daynight) headlight pool ((night) replaced by real headlights when cityLights is on)
    };
    for (const c of cars) {
      placeCar(c);
      emit(c, true);
    }
    for (const L of links) {
      if (!L.parked || !L.parked.length) continue;
      const dx = L.cx - cp.x,
        dz = L.cz - cp.z;
      if (dx * dx + dz * dz > (PARK_R + L.len / 2) ** 2) continue;
      for (const c of L.parked) emit(c, false);
    }
    for (const k of all) if (!(farSkip && k.farTier)) k.end();
    cao.end();
    hlp.end(); // (street r7) (daynight)
  };

  let frameN = 0,
    lastDt = 0,
    acc4 = 0;
  const api = {
    cars: () => cars,
    nearby(x, z, radius, out = []) {
      out.length = 0;
      const addIfNear = (c) => {
        if (
          Math.abs(c.x - x) < radius + Math.max(c.len, c.wid) * 0.5 &&
          Math.abs(c.z - z) < radius + Math.max(c.len, c.wid) * 0.5
        )
          out.push(c);
      };
      for (const c of cars) addIfNear(c);
      for (const L of links) {
        if (
          !L.parked?.length ||
          Math.abs(L.cx - x) > L.len * 0.5 + radius + 4 ||
          Math.abs(L.cz - z) > L.len * 0.5 + radius + 4
        )
          continue;
        for (const c of L.parked) addIfNear(c);
      }
      return out;
    },
    links,
    roads,
    events,
    VTYPES,
    _dbg: { player, playerObstacle },
    _jx: jx,
    _time: () => time,
    ms: {
      step: 0,
      render: 0,
      stream: 0,
      streamMax: 0,
      stepMax: 0,
      renderMax: 0,
    },
    setPlayer(pos, vel, groundY) {
      player.pos.copy(pos);
      if (vel) player.vel.copy(vel);
      player.t = time;
      player.ground = groundY ?? 0;
    },
    collideDynamic,
    // danger/alarm hook: cars in the radius slam on the brakes and honk
    zone(key, pos, r = 18, active = true, ttl = 1e9) {
      if (!active) {
        zones.delete(key);
        return;
      }
      zones.set(key, { x: pos.x, z: pos.z, r, until: time + ttl });
    },
    zones,
    setDensity(k) {
      densityScale = Math.max(0, k);
    }, // (citylife junctions r3) 1 = 85 % of the original traffic
    alarm(pos, radius = 30) {
      zones.set(
        "alarm:" + Math.round(pos.x / 10) + "," + Math.round(pos.z / 10),
        { x: pos.x, z: pos.z, r: Math.min(radius, 22), until: time + 8 },
      );
      for (const c of cars) {
        if (Math.hypot(c.x - pos.x, c.z - pos.z) < radius) {
          c.v *= 0.3;
          if (time > c.honkT) {
            c.honkT = time + 3;
            horn(
              Math.hypot(player.pos.x - c.x, player.pos.z - c.z),
              VTYPES[c.type].big,
              c.x,
              c.z,
              c.y ?? 0,
            );
          }
        }
      }
    },
    update(dt, camera, t, clear = null) {
      RA = quality.trafficRadius;
      PARK_R = quality.parkedCarRadius;
      HI_D = quality.vehicleHighDetailDistance;
      LOW_D = quality.vehicleLowDetailDistance;
      time = t;
      const cp = camera.position;
      camPos.copy(cp);
      streamT -= dt;
      if (streamT <= 0 || cp.distanceToSquared(lastCam) > 225) {
        const ts0 = performance.now();
        stream(cp);
        lastCam.copy(cp);
        streamT = 0.3;
        const d = performance.now() - ts0;
        api.ms.stream += (d - api.ms.stream) * 0.2;
        if (d > api.ms.streamMax) api.ms.streamMax = d;
      }
      const sub = dt > 1 / 24 ? 2 : 1;
      const tp0 = performance.now(); // (citylife junctions) per-frame cost of the sim step vs the instance writer
      for (let i = 0; i < sub; i++) step(dt / sub, 0); // links near the camera: every frame
      frameN++;
      if (frameN % 2 === 0) step(Math.min(0.1, dt + lastDt), 1); // far links (> 280 m): every 2nd frame
      acc4 += dt;
      if (frameN % 4 === 0) {
        step(Math.min(0.2, acc4), 2);
        acc4 = 0;
      } // very far (> 600 m: bridge spans): every 4th
      lastDt = dt;
      const tp1 = performance.now();
      render(camera, clear);
      api.ms.step += (tp1 - tp0 - api.ms.step) * 0.05;
      api.ms.render += (performance.now() - tp1 - api.ms.render) * 0.05;
      api.ms.stepMax = Math.max(api.ms.stepMax, tp1 - tp0);
      api.ms.renderMax = Math.max(api.ms.renderMax, performance.now() - tp1); // (perf r3)
      refreshNear();
      while (events.length && time - events[0].t > 3) events.shift();
    },
    stats() {
      let active = 0;
      for (const L of links) if (L.active) active++;
      let drawn = 0;
      for (const k of all) if (!k.mesh.userData.smallCasters) drawn += k.n; // (perf r2) not the shadow proxies
      let highLod = 0,
        lowLod = 0,
        farLod = 0;
      const farMeshes = new Set();
      for (const t of Object.values(tiers)) {
        highLod += t.hi.n;
        lowLod += t.low.n;
        farMeshes.add(t.far);
      }
      for (const mesh of farMeshes) farLod += mesh.n;
      return {
        quality: quality.name,
        lodDistances: { high: HI_D, low: LOW_D, stream: RA, parked: PARK_R },
        vehicleLod: { high: highLod, low: lowLod, far: farLod },
        cars: cars.length,
        activeLinks: active,
        drawn,
        junction: {
          ...jx.stats(),
          broken: jStats.broken,
          laneChanges: jStats.lc,
          refill: jStats.refill,
          drain: jStats.drain,
          want: jStats.want,
          have: jStats.have,
        },
      };
    },
  };
  void rnd;
  void hash2;
  void G;
  void TRUCKC;
  return api;
}
