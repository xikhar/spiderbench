// OWNER: animation agent.
// Animation layer driven by player.anim (contract C1, see src/main.js).
//
//  state machine  : select(anim) -> node key; a transition pushes a new layer that cross-fades in over a
//                   per-transition blend time (TRANS table) while the outgoing layers keep evaluating
//                   (no frozen pops). Nodes can be "sticky" (one-shots finish before yielding).
//  blend spaces   : locomotion walk/jog/run/sprint by speed (phase-aligned on left touchdown, cadence +
//                   stride-warped so feet never slide), air rise/apex/fall/dive by vertical velocity,
//                   swing low/bottom/high by swing.phase + corner-bank by swing.bank, crawl idle/slow/fast.
//  procedural     : visual-root frame (orientation per mode, lean into turns / acceleration, tricks),
//                   hand IK onto the web, legs reacting to swing acceleration, foot IK + pelvis adjust
//                   against world.raycast, look-at toward camera/aim, breathing, hips XZ lock (no drift).
import * as THREE from "three";
import { Skel, Pose, blendPoses } from "./skeleton.js";
import {
  PoseBuilder,
  frameRot,
  X,
  Y,
  Z,
  clamp,
  lerp,
  smooth,
  smoother,
  damp,
  remap,
  Spring,
  Spring3,
  TAU,
  noise1,
} from "./builder.js";
import { RigData, armTarget } from "./rigdata.js";
import { Gait } from "./gait.js";
import { ClipLib } from "./clips.js";
import { ropeGrip } from "../web.js";
import { ropePoint } from "../traversal/rope.js";

const UP = new THREE.Vector3(0, 1, 0),
  QI = new THREE.Quaternion();
const _sl = {
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  c: new THREE.Vector3(),
  d: new THREE.Vector3(),
  e: new THREE.Vector3(),
}; // swing life scratch
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _v3 = new THREE.Vector3(),
  _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion(),
  _m = new THREE.Matrix4();

// Per-transition blend times (seconds). Lookup: TRANS[from][to] ?? TRANS[from]['*'] ?? TRANS['*'][to] ?? 0.2
// Tuned for smoothness (user feedback #3/#6): nothing under ~0.1 s except where an impact must read instantly.
const TRANS = {
  "*": {
    land: 0.1,
    landHard: 0.08,
    landRoll: 0.1,
    jumpCharge: 0.16,
    jumpLaunch: 0.12,
    swing: 0.24,
    zip: 0.14,
    trick: 0.16,
    perch: 0.14,
    crawl: 0.28,
    wallRun: 0.28,
    wallJump: 0.12,
    vault: 0.14,
    corner: 0.16,
    pointLaunch: 0.12,
    air: 0.3,
    ground: 0.3,
  },
  ground: {
    runStart: 0.16,
    runStop: 0.16,
    turn180: 0.14,
    jumpCharge: 0.18,
    jumpLaunch: 0.2,
    air: 0.28,
    wallRun: 0.3,
    slingshot: 0.25,
  },
  slingshot: { pointLaunch: 0.18, ground: 0.35 },
  runStart: { ground: 0.26 },
  runStop: { ground: 0.34 },
  turn180: { ground: 0.22 },
  jumpCharge: { jumpLaunch: 0.14, ground: 0.24 },
  jumpLaunch: { air: 0.38, land: 0.12 },
  air: { ground: 0.2, land: 0.1, swing: 0.26, wallRun: 0.34, crawl: 0.32 }, // (anim r2) wall catches mid-air snapped in ~2 frames
  swing: { air: 0.34, trick: 0.18, swing: 0.3, wallRun: 0.34 },
  trick: { air: 0.4, wallRun: 0.36, crawl: 0.34, swing: 0.3 },
  land: { ground: 0.38, jumpCharge: 0.18, jumpLaunch: 0.14 },
  zip: { perch: 0.14, air: 0.34 },
  perch: { ground: 0.34, perchToStand: 0.18, rope: 0.12 },
  rope: {
    perch: 0.3,
    ground: 0.3,
    air: 0.3,
    jumpLaunch: 0.14,
    zip: 0.12,
    pointLaunch: 0.12,
  },
  perchToStand: { ground: 0.3 },
  crawl: {
    wallRun: 0.3,
    air: 0.32,
    jumpLaunch: 0.26,
    wallJump: 0.24,
    ledge: 0.12,
  },
  wallRun: {
    crawl: 0.36,
    air: 0.34,
    jumpLaunch: 0.26,
    wallJump: 0.24,
    vault: 0.2,
    ground: 0.3,
    ledge: 0.12,
  },
  ledge: { ground: 0.2 },
  wallJump: { air: 0.4 },
};
const C_HAS_LEDGE = (S) =>
  S.clips.has("ledgeGrab") || S.clips.has("ledgeClimbQuick");
const blendTime = (a, b) =>
  TRANS[a]?.[b] ?? TRANS[a]?.["*"] ?? TRANS["*"][b] ?? 0.2;

// Node traits: frame = visual-root type; foot = foot-IK weight; look = look-at weight; web = hand-on-web IK
const TRAITS = {
  ground: { frame: "upright", foot: 1, look: 0.8 },
  runStart: { frame: "upright", foot: 0.6, look: 0.4 },
  runStop: { frame: "upright", foot: 1, look: 0.5 },
  turn180: { frame: "upright", foot: 1, look: 0.2 },
  jumpCharge: { frame: "upright", foot: 1, look: 0.5 },
  jumpLaunch: { frame: "air", foot: 0, look: 0.3 },
  air: { frame: "air", foot: 0, look: 0.5 },
  trick: { frame: "air", foot: 0, look: 0 },
  land: { frame: "upright", foot: 0.9, look: 0.3 },
  perch: { frame: "upright", foot: 0.8, look: 1 },
  perchToStand: { frame: "upright", foot: 1, look: 0.5 },
  rope: { frame: "upright", foot: 0, look: 0.45 }, // web tightrope + standing perch at its ends: feet placed on the strand by the node
  swing: { frame: "swing", foot: 0, look: 0.45, web: 1 },
  zip: { frame: "zip", foot: 0, look: 0.3, web: 1 },
  pointLaunch: { frame: "air", foot: 0, look: 0 },
  slingshot: { frame: "upright", foot: 0.5, look: 0.3 },
  crawl: { frame: "wall", foot: 0, look: 0.6 },
  wallRun: { frame: "wallRun", foot: 0, look: 0.3 },
  wallJump: { frame: "wallOut", foot: 0, look: 0 },
  ledge: { frame: "ledge", foot: 0, look: 0 },
  vault: { frame: "uprightWall", foot: 0, look: 0.2 },
  corner: { frame: "wall", foot: 0, look: 0.2 },
};
// user r10: release tricks are procedural (PTRICK, trickPose/trickSpin); the tucked releaseTuck "crouch" is never used after a
// release. Legacy names (flip/backflip/twist/spin/airTrick) still map to the authored clips.
const PTRICK = { layout: 1.3, corkscrew: 0.78, tuckFlip: 0.9, scissor: 0.7 }; // durations = traversal TRICK_DEF
// user r10b: no 'fan' spins — the cartwheel and the authored releaseCorkscrew (twist/spin) mappings are removed
const TRICKS = {
  layout: "proc",
  corkscrew: "proc",
  tuckFlip: "proc",
  scissor: "proc",
  flip: "releaseFlip",
  frontflip: "releaseFlip",
  backflip: "releaseFlip",
  airTrick: "airTrick",
};
const WALL_Z = 0.3; // wall plane in wall-authored clips (character space +Z; SPIDERMAN.md conventions)
// documented natural speeds (m/s) of wall clips (SPIDERMAN.md); used for playback-rate sync
const NAT = {
  wallCrawl: 1.4,
  wallCrawlFast: 2.6,
  wallRun: 8.0,
  wallRunHorizontal: 7.0,
};

// Locomotion anchors: game speed (m/s) -> clip. Natural clip speed is measured; the difference is absorbed by
// playback rate and stride warping.
const LOCO = [
  ["walk", 1.6],
  ["jog", 4.5],
  ["run", 8.5],
  ["sprint", 14],
];
// web tightrope cadence (walk cycles / s) at speed v: quick short steps (~0.72 m), ~3.7 steps / s at the 2.7 m/s line
// speed -> the walk clip's own stride length (k ~1.1), not a lunge
const ROPE_HZ = (v) => 0.7 + 0.45 * v; // user r13b: quick light prowl, ~4.5 steps / s at 3.4 m/s (k ~1.15)

export class Animator {
  constructor(rig) {
    this.rig = rig;
    const B = { ...rig.bones };
    const find = (re) => {
      let f = null;
      rig.object.traverse((o) => {
        if (!f && (o.isBone || o.userData.isRigBone) && re.test(o.name)) f = o;
      });
      return f;
    };
    B.spine1 = B.spine1 || find(/^spine\.?0*1$|^spine_?01$|spine1$/i);
    if (B.spine1 === B.spine || B.spine1 === B.chest) B.spine1 = null;
    B.shoulderL = find(/^(shoulder|clavicle)\.?_?L$/i);
    B.shoulderR = find(/^(shoulder|clavicle)\.?_?R$/i);
    B.toeL = find(/^toe\.?_?L$|^toes?_?l$/i);
    B.toeR = find(/^toe\.?_?R$|^toes?_?r$/i);
    this.skel = new Skel(rig.object, B);
    this.rd = new RigData(this.skel);
    this.b = new PoseBuilder(this.skel);
    this.gait = new Gait(this.rd);
    this.clips = new ClipLib(this.skel, rig.allClips || []);
    const N = this.skel.N;
    this.pool = [];
    this.P = {};
    for (const k of [
      "a",
      "b",
      "c",
      "d",
      "e",
      "idle",
      "loco",
      "tmp",
      "mir",
      "out",
      "prev",
      "fi",
    ])
      this.P[k] = new Pose(N);
    this.P.out.copy(this.skel.rest);
    this.P.prev.copy(this.skel.rest);
    this.layers = [];
    // continuous state
    this.time = 0;
    this.idleT = 0;
    this.locoPhase = 0;
    this.airT = 0;
    this.swingT = 0;
    this.wallPhase = 0;
    this.yaw = 0;
    this.yawInit = false;
    this.speedH = 0;
    this.prevVel = new THREE.Vector3();
    this.accel = new THREE.Vector3();
    this.velS = new THREE.Vector3();
    this.frameQ = new THREE.Quaternion();
    this.frameInit = false;
    this.pivotW = 0;
    this.wallK = 0;
    this.wallKInit = false;
    this.lean = new Spring(0, 1.6, 0.8);
    this.pitchLean = new Spring(0, 1.5, 0.8);
    this.pelvisOff = 0;
    this.footOff = { L: 0, R: 0 };
    this.footN = {
      L: new THREE.Vector3(0, 1, 0),
      R: new THREE.Vector3(0, 1, 0),
    };
    this.look = {
      yaw: new Spring(0, 1.4, 0.9),
      pitch: new Spring(0, 1.4, 0.9),
    };
    this.legSpring = new Spring3(1.3, 0.35);
    this.armSpring = new Spring3(1.8, 0.3);
    this.webW = 0;
    this.webHand = "R";
    this.impact = new Spring(0, 2.2, 0.45);
    this.webWH = { L: 0, R: 0 }; // per-hand web IK weights (hand switches blend, never pop)
    // two-handed swing grip (refs/swing/twohand_*): per-hand ramps (0..1) for the free hand joining the line below the web hand
    this.two = {
      L: 0,
      R: 0,
      on: false,
      dropped: false,
      t: 0,
      anc: new THREE.Vector3(),
      hand: "",
      max: 0,
    };
    this.swingPh = 0;
    this.swingPhHand = "R";
    this.wrW = 0;
    this.wrOff = new THREE.Vector3();
    this.wrOffOk = false;
    this.wrHead = new THREE.Vector3(0, 1, 0);
    this.wallUp = new THREE.Vector3(0, 1, 0);
    this.lastWallN = new THREE.Vector3(0, 0, 1);
    this.prevMode = "";
    this.prevSub = "";
    this.lastTrick = null;
    this.trickSeq = 0;
    this.mirrorBank = -1; // swingCornerBank rolls to his right; C1 bank > 0 = turning left
    this.debug = { node: "", clip: "", layers: "" };
    this.enabled = true;
    // node implementations bound to this
    this.nodes = makeNodes(this);
  }

  // ---------------------------------------------------------------- selection
  select(A) {
    const mode = A.mode || "ground",
      sub = A.sub || "";
    const top = this.layers[this.layers.length - 1];
    // sticky one-shots finish unless the new mode forbids it
    if (top && top.node.hold && top.node.hold(top, A)) return top.key;
    const trick = A.trick && A.trick !== this.lastTrickDone ? A.trick : null;
    const hs = this.speedH;
    switch (mode) {
      case "ground":
      case "combat":
        if (sub === "slingshot") return "slingshot";
        if (sub === "jumpCharge") return "jumpCharge";
        if (sub === "jumpLaunch") return "jumpLaunch";
        if (sub === "landRoll" || sub === "landHard" || sub === "landMedium")
          return "land";
        if (sub === "vault") return "jumpLaunch"; // user r9: the old wallToRoofVault clip (hands behind the seat) is retired — vaults use the new jump
        if (top && top.key === "perch" && hs < 2) return "perchToStand";
        return this.groundVariant(top, A);
      case "land":
        if (
          (sub === "landLight" ||
            (!sub && (A.landing?.severity ?? 0.3) < 0.25)) &&
          hs > 3
        ) {
          this.kickImpact(A);
          return "ground";
        }
        return "land";
      case "air":
        if (trick && (TRICKS[trick] || trick === "spread")) {
          if (TRICKS[trick]) return "trick#" + this.trickKey(trick);
        }
        if (sub === "jumpLaunch") return "jumpLaunch";
        if (sub === "pointLaunch") return "pointLaunch";
        if (sub === "zipPull") return "zip"; // air web-dash
        if (sub === "wallJump") return "wallJump";
        if (sub === "vault") return "jumpLaunch"; // user r9: the old wallToRoofVault clip (hands behind the seat) is retired — vaults use the new jump
        if (sub === "trick" && trick) return "trick#" + this.trickKey(trick);
        return "air";
      case "swing":
        return sub === "release" ? "air" : "swing#" + (A.swing?.hand || "R");
      case "zip":
        return sub === "pointLaunch" ? "pointLaunch" : "zip";
      case "perch":
        return sub === "perchStand" ? "rope" : "perch"; // standing perch at a tightrope end: the rope balance stance
      case "rope":
        return "rope";
      case "wall":
        if (sub === "wallZip") return "zip"; // user r9w: wall zip up the facade — the zip flight only (no run legs)
        if (sub === "wallRun" || sub === "wallRunSide") return "wallRun";
        if (sub === "wallJump") return "wallJump";
        if (sub === "vault") return "jumpLaunch"; // user r9: the old wallToRoofVault clip (hands behind the seat) is retired — vaults use the new jump
        if (sub === "cornerWrap") return "corner";
        if (sub === "ledgeGrab" || sub === "ledgeClimb")
          return C_HAS_LEDGE(this) ? "ledge" : "jumpLaunch";
        return "crawl";
      default:
        return "ground";
    }
  }
  trickKey(trick) {
    if (trick !== this.lastTrick) {
      this.lastTrick = trick;
      this.trickSeq++;
    }
    return trick + ":" + this.trickSeq;
  }
  groundVariant(top, A) {
    const v = this.speedH,
      tk = top?.key;
    // one-shot transition clips never re-trigger right after they ran (no ground <-> runStop flip-flop)
    const T = this.lastOneShot || (this.lastOneShot = {});
    if (tk === "runStart" || tk === "runStop" || tk === "turn180")
      T[tk] = this.time;
    const ok = (k) => this.time - (T[k] ?? -9) > 0.7;
    if (!ok("runStart") || !ok("runStop") || !ok("turn180")) return "ground";
    // user feedback #14: stopping / reversing settles straight into idle (no runStop skid, no turn180 pivot)
    if (!this.allowStopTurn)
      return tk === "ground" &&
        this.clips.has("runStart") &&
        this.stillT > 0.25 &&
        v > 0.25 &&
        A.mode !== "combat" &&
        (A.sub === "run" || A.sub === "sprint") &&
        (this.moveIntent || 0) > 5
        ? "runStart"
        : "ground";
    // start: from (near) standstill into a run
    if (
      this.clips.has("runStart") &&
      (tk === "ground" || tk === "runStop") &&
      this.stillT > 0.25 &&
      v > 0.25 &&
      A.mode !== "combat" &&
      (A.sub === "run" || A.sub === "sprint") &&
      (this.moveIntent || 0) > 5
    )
      return "runStart";
    // stop: decelerating hard from a run
    if (
      this.clips.has("runStop") &&
      tk === "ground" &&
      this.runSpeedMem > 6.5 &&
      v < 3 &&
      this.decel > 6 &&
      (A.sub === "idle" || A.sub === "walk")
    )
      return "runStop";
    // 180 turn from slow/idle
    if (
      this.clips.has("turn180") &&
      tk === "ground" &&
      v > 0.6 &&
      v < 5 &&
      this.turnErr > 2.5 &&
      top.t > 0.15
    )
      return "turn180";
    return "ground";
  }
  kickImpact(A) {
    if (this._impactKicked) return;
    this._impactKicked = true;
    this.impact.v -= 1.2 + 2.2 * (A.landing?.severity ?? 0.2);
  }

  setTarget(key) {
    const top = this.layers[this.layers.length - 1];
    if (top && top.key === key) return top;
    const name = key.split("#")[0];
    const node = this.nodes[name] || this.nodes.ground;
    const bt = top ? blendTime(top.name, name) : 0;
    const L = {
      key,
      name,
      node,
      w: bt <= 0 ? 1 : 0,
      dur: Math.max(bt, 1e-3),
      t: 0,
      pose: this.pool.pop() || new Pose(this.skel.N),
      data: {},
    };
    node.enter?.(L, this.A, top);
    this.layers.push(L);
    if (this.layers.length > 6) {
      // collapse the two oldest into a frozen snapshot
      const [a, b] = this.layers;
      blendPoses(
        a.pose,
        b.pose,
        smooth(b.w),
        a.pose,
        null,
        this.bm("merge" + b.key),
      );
      this.pool.push(b.pose);
      a.node = this.nodes.frozen;
      a.key = "frozen";
      a.name = "frozen";
      a.w = 1;
      this.layers.splice(1, 1);
    }
    return L;
  }

  // ---------------------------------------------------------------- main update
  // io: { anim (C1), center: Vector3 capsule centre (world), world, camera, dt }
  update(dt, io) {
    const A = (this.A = io.anim);
    this.io = io;
    this.world = io.world;
    if (!A) return;
    dt = Math.min(dt, 1 / 15);
    this.time += dt;
    this.dt = dt;
    this._impactKicked =
      this._impactKicked && (A.mode === "land" || A.mode === this.prevMode);
    if (A.mode !== "land") this._impactKicked = false;
    // kinematics
    const vel = A.velocity || _v.set(0, 0, 0);
    this.velS.lerp(vel, 1 - Math.exp(-20 * dt));
    this.accel.lerp(
      _v2.copy(vel).sub(this.prevVel).divideScalar(Math.max(dt, 1e-3)),
      1 - Math.exp(-10 * dt),
    );
    this.prevVel.copy(vel);
    this.prevSpeed = this.speedH;
    const hs = Math.hypot(vel.x, vel.z);
    this.speedH = hs;
    this.stillT =
      hs < 0.2
        ? (this.stillT || 0) + dt
        : hs > 0.25 && this.prevSpeed <= 0.25
          ? this.stillT
          : 0;
    this.runSpeedMem = Math.max(hs, (this.runSpeedMem || 0) - dt * 8);
    this.decel = damp(
      this.decel || 0,
      (this.prevSpeed - hs) / Math.max(dt, 1e-3),
      12,
      dt,
    );
    this.moveIntent = A.sub === "sprint" ? 15 : A.sub === "run" ? 8.5 : hs;
    // facing (ground yaw)
    if (!this.yawInit) {
      this.yaw = Math.atan2(A.lookDir?.x ?? 0, A.lookDir?.z ?? 1);
      if (hs > 0.5) this.yaw = Math.atan2(vel.x, vel.z);
      this.yawInit = true;
    }
    const upMode =
      A.mode === "ground" ||
      A.mode === "land" ||
      A.mode === "combat" ||
      A.mode === "perch" ||
      A.mode === "rope";
    const wantYaw =
      upMode && A.facing != null
        ? A.facing
        : hs > 0.4
          ? Math.atan2(vel.x, vel.z)
          : this.yaw;
    this.wantYaw = wantYaw;
    this.turnErr = Math.abs(
      Math.atan2(Math.sin(wantYaw - this.yaw), Math.cos(wantYaw - this.yaw)),
    );
    // state machine
    const key = this.select(A);
    this.setTarget(key);
    // timers
    this.idleT += dt;
    this.airT = A.mode === "air" ? this.airT + dt : 0;
    // advance layers & evaluate
    for (const L of this.layers) {
      L.t += dt;
      L.w = Math.min(1, L.w + dt / L.dur);
    }
    let drop = 0;
    for (let i = this.layers.length - 1; i > 0; i--)
      if (this.layers[i].w >= 1) {
        drop = i;
        break;
      }
    if (drop) {
      for (const L of this.layers.splice(0, drop)) {
        L.node.exit?.(L);
        this.pool.push(L.pose);
      }
    }
    const top = this.layers[this.layers.length - 1];
    // yaw update after node choice (turn180 holds the yaw)
    if (!top.node.holdYaw) {
      const rate = top.name === "ground" ? lerp(7, 11, clamp(hs / 8, 0, 1)) : 9;
      let d = Math.atan2(
        Math.sin(wantYaw - this.yaw),
        Math.cos(wantYaw - this.yaw),
      );
      const yawRate = clamp(d * rate, -14, 14);
      this.yawRate = hs > 0.4 ? yawRate : 0;
      this.yaw += yawRate * dt;
    } else this.yawRate = 0;
    const out = this.P.out;
    let first = true;
    for (const L of this.layers) {
      L.node.eval(L, A, L.pose);
      if (first) {
        out.copy(L.pose);
        first = false;
      } else
        blendPoses(
          out,
          L.pose,
          smooth(L.w),
          out,
          null,
          this.bm("layer" + L.key),
        );
    }
    // trait weights (blended across layers)
    const tw = { foot: 0, look: 0, web: 0 };
    {
      let acc = 1;
      for (let i = this.layers.length - 1; i >= 0; i--) {
        const L = this.layers[i];
        const w = i === 0 ? acc : acc * smooth(L.w);
        const T = TRAITS[L.name] || {};
        tw.foot += (T.foot || 0) * w;
        tw.look += (T.look ?? 0.5) * w;
        tw.web += (T.web || 0) * w;
        acc -= w;
        if (acc <= 1e-4) break;
      }
    }
    this.tw = tw;
    this.applyOneShot(dt, out);
    // visual root
    this.updateFrame(dt, A, top, io);
    // procedural post layers (character space)
    this.b.begin(out);
    this.postWeb(dt, A, tw.web);
    this.postQuickYank(dt, A);
    this.postSecondary(dt, A, top);
    this.postLook(dt, A, tw.look * (1 - 0.8 * this.two.max)); // two-handed grip: torso stays square under the line
    this.postHeadLevel(dt, A, top);
    this.postBreath(dt, A, top);
    if (A.grounded && (A.mode === "land" || A.mode === "ground"))
      tw.foot = Math.max(tw.foot, 0.95);
    this.postFeet(dt, A, tw.foot);
    this.postAirLife(dt, A, top);
    this.postLimits(dt, A);
    // half-joint helper bones (deltoid/glute, SPIDERMAN.md v3): 50 % of the base bone's local rotation — clips bake this,
    // procedural IK / blends must keep it or the shoulder/hip skin collapses
    this.helpers(out);
    // NaN guard: a degenerate IK/blend must never blow the mesh up — keep the last good pose instead
    {
      const q = out.q,
        p = out.p;
      let bad = false;
      for (let i = 0; i < q.length; i++)
        if (q[i] !== q[i]) {
          bad = true;
          break;
        }
      if (!bad)
        for (let i = 0; i < p.length; i++)
          if (p[i] !== p[i]) {
            bad = true;
            break;
          }
      if (bad) {
        if (!this._nanWarned) {
          this._nanWarned = true;
          console.warn("[anim] NaN pose in", top.key, top.data.clip);
        }
        out.copy(this.P.prev);
      } else this.P.prev.copy(out);
    }
    // write to bones
    this.skel.apply(out);
    this.rig.object.updateMatrixWorld(true);
    this.ropeTail(A);
    this.wallContact(dt, A, top);
    this.prevMode = A.mode;
    this.prevSub = A.sub;
    if (top.name === "trick" && A.trick) this.lastTrickDone = A.trick;
    if (!A.trick) {
      this.lastTrickDone = null;
      this.lastTrick = null;
    }
    // debug / contract: expose current state for playtest logs
    this.debug.node = top.key;
    this.debug.clip = top.data.clip || top.name;
    this.debug.layers = this.layers
      .map((L) => `${L.key}:${L.w.toFixed(2)}`)
      .join(",");
    try {
      A.animNode = top.key;
      A.animClip = this.debug.clip;
      A.animLayers = this.debug.layers;
    } catch (e) {
      /* frozen object */
    }
  }

  // Wall-plane contact (critic: transitions sink 20-30 cm into the facade, crawl floats 10-22 cm): after the final pose,
  // measure every contact-relevant joint against the effective wall plane (C1 wall.dist) and shift the visual root along
  // the normal — push-out always (no penetration in any blend), pull-in while crawling (hands/feet stay on the wall).
  wallContact(dt, A, top) {
    const ledge = top.name === "ledge" && A.ledge?.active;
    const onWall =
      ledge ||
      (A.mode === "wall" &&
        A.sub !== "ledgeGrab" &&
        A.sub !== "ledgeClimb" &&
        top.name !== "vault");
    const wd = A.wall?.dist,
      C = this.io.center;
    let corr = 0;
    if (onWall && (ledge || (wd != null && isFinite(wd) && wd > 0.05)) && C) {
      const n = ledge ? _v3.copy(A.ledge.inward).negate() : A.wall.normal,
        B = this.rig.bones,
        v = _v4;
      const pd = ledge
        ? A.ledge.point.dot(n)
        : C.x * n.x + C.y * n.y + C.z * n.z - wd; // plane: p.n = pd
      const maxY = ledge ? A.ledge.point.y - 0.06 : Infinity; // ledge: only joints still below the lip (hands on top are fine)
      const J =
        this._wj ||
        (this._wj = [
          ["footL", 0.055, 1],
          ["footR", 0.055, 1],
          ["handL", 0.04, 1],
          ["handR", 0.04, 1],
          ["lowerLegL", 0.075, 0],
          ["lowerLegR", 0.075, 0],
          ["lowerArmL", 0.05, 0],
          ["lowerArmR", 0.05, 0],
          ["hips", 0.1, 0],
          ["chest", 0.1, 0],
          ["head", 0.1, 0],
        ]);
      let pen = 0,
        gap = Infinity;
      for (const [k, r, contact] of J) {
        const b = B[k];
        if (!b) continue;
        b.getWorldPosition(v);
        if (v.y > maxY) continue;
        const d = v.x * n.x + v.y * n.y + v.z * n.z - pd - r;
        pen = Math.max(pen, -d);
        if (contact) gap = Math.min(gap, d);
      }
      for (const S of ["L", "R"]) {
        const t = this.skel.bones[this.skel.idx("toe" + S)];
        if (t) {
          t.getWorldPosition(v);
          if (v.y > maxY) continue;
          const d = v.x * n.x + v.y * n.y + v.z * n.z - pd - 0.025;
          pen = Math.max(pen, -d);
          gap = Math.min(gap, d);
        }
      }
      corr =
        pen > 0
          ? pen
          : top.name === "crawl" && isFinite(gap) && gap > 0
            ? -Math.min(gap, 0.06)
            : 0; // never drag the torso onto the wall
    }
    const k = corr > (this.wallCorr || 0) ? 25 : 8;
    this.wallCorr = damp(this.wallCorr || 0, corr, k, dt);
    if (corr > 0) this.wallCorr = Math.max(this.wallCorr, corr * 0.9); // penetration: correct (nearly) instantly
    if (Math.abs(this.wallCorr) < 1e-4) return;
    const n = this.wallCorrN || (this.wallCorrN = new THREE.Vector3(0, 0, 1)),
      obj = this.rig.object;
    if (onWall)
      n.copy(
        ledge
          ? _v3.copy(A.ledge.inward).negate()
          : A.wall?.normal || this.lastWallN,
      );
    this.visP.addScaledVector(n, this.wallCorr);
    const parent = obj.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      const inv = (this.invParent ||= new THREE.Matrix4())
        .copy(parent.matrixWorld)
        .invert();
      _m.compose(this.visP, this.visQ, _v4.set(1, 1, 1)).premultiply(inv);
      _m.decompose(obj.position, obj.quaternion, obj.scale);
    } else obj.position.copy(this.visP);
    obj.updateMatrixWorld(true);
  }
  // Airborne secondary life (critic: glide/dive/fall frozen for seconds): wind flutter on the limbs scaled by speed,
  // slow alternating leg cycling in long falls, head-first pitch while diving.
  postAirLife(dt, A, top) {
    const air = A.mode === "air" && top.name === "air";
    this.airLifeW = damp(this.airLifeW || 0, air ? 1 : 0, 4, dt);
    const w = this.airLifeW;
    if (w < 0.01) return;
    const b = this.b,
      T = this.time,
      sp = A.velocity ? A.velocity.length() : 0;
    const fl = w * clamp((sp - 6) / 30, 0, 1);
    const fall =
      w *
      smooth((-(A.velocity?.y ?? 0) - 6) / 8) *
      smooth((this.airT - 0.5) / 0.5);
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1,
        ph = S === "L" ? 0 : Math.PI;
      b.rotE(
        "upperArm" + S,
        noise1(T * 3.1, sx * 3) * 0.12 * fl,
        0,
        noise1(T * 2.7, sx * 5 + 1) * 0.1 * fl,
      );
      b.rotE("lowerArm" + S, noise1(T * 4.3, sx * 7) * 0.1 * fl, 0, 0);
      b.rotE(
        "upperLeg" + S,
        Math.sin(T * TAU * 0.7 + ph) * 0.22 * fall +
          noise1(T * 2.3, sx * 9) * 0.06 * fl,
        0,
        0,
      );
      b.rotE(
        "lowerLeg" + S,
        (0.5 + 0.5 * Math.sin(T * TAU * 0.7 + ph + 1.2)) * 0.3 * fall,
        0,
        0,
      );
    }
    b.rotE(
      "head",
      noise1(T * 2, 11) * 0.05 * fl,
      noise1(T * 1.6, 12) * 0.08 * fl,
      0,
    );
  }
  helpers(pose) {
    if (this._help === undefined) {
      this._help = [];
      for (const [h, b] of [
        ["deltoidL", "upperArmL"],
        ["deltoidR", "upperArmR"],
        ["gluteL", "upperLegL"],
        ["gluteR", "upperLegR"],
      ]) {
        const hi = this.skel.byName.get(h),
          bi = this.skel.idx(b);
        if (
          hi != null &&
          bi >= 0 &&
          this.skel.parent[hi] === this.skel.parent[bi]
        )
          this._help.push([hi, bi]);
      }
      this._hq = [new THREE.Quaternion(), new THREE.Quaternion()];
    }
    const [qa, qb] = this._hq;
    for (const [hi, bi] of this._help) {
      this.skel.rest.getQ(hi, qa);
      pose.getQ(bi, qb);
      qa.slerp(qb, 0.5);
      pose.setQ(hi, qa);
    }
    // forearm twist helpers: half of the hand's roll about the forearm axis (swing-twist), on top of the rest rotation
    if (!this._tw) {
      this._tw = [];
      for (const S of ["L", "R"]) {
        const ti = this.skel.byName.get("forearmTwist" + S),
          hi = this.skel.idx("hand" + S);
        if (ti != null && hi >= 0) {
          const ax = new THREE.Vector3();
          this.skel.rest.getP(hi, ax);
          if (ax.lengthSq() > 1e-8) this._tw.push([ti, hi, ax.normalize()]);
        }
      }
    }
    for (const [ti, hi, ax] of this._tw) {
      pose.getQ(hi, qb);
      this.skel.rest.getQ(hi, qa);
      qb.premultiply(qa.invert()); // hand rotation relative to its rest (in forearm frame, approx)
      const d = qb.x * ax.x + qb.y * ax.y + qb.z * ax.z;
      qa.set(ax.x * d, ax.y * d, ax.z * d, qb.w);
      const l = Math.hypot(qa.x, qa.y, qa.z, qa.w);
      if (l < 1e-6) continue;
      qa.x /= l;
      qa.y /= l;
      qa.z /= l;
      qa.w /= l;
      qb.identity().slerp(qa, 0.5);
      this.skel.rest.getQ(ti, qa);
      qa.premultiply(qb);
      pose.setQ(ti, qa);
    }
  }
  widenStance(pose, w) {
    const b = this.b.begin(pose),
      rd = this.rd;
    b.moveHips(0, -0.025 * w, 0);
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1,
        a = b.pos("foot" + S, new THREE.Vector3());
      const fq = b.cq("foot" + S, new THREE.Quaternion()),
        knee = b.pos("lowerLeg" + S, new THREE.Vector3());
      a.x += sx * 0.045 * w;
      a.y = Math.max(a.y, rd.ankleH);
      b.ik("leg", S, a, knee.add(_v4.set(sx * 0.15, 0, 0.4)), 1, {
        absolute: false,
      });
      b.setCQ("foot" + S, fq);
    }
  }
  // Narrow-coping balance walk (anim.balance): arms out to the sides with a slow corrective sway, feet on one line.
  balance(pose, w) {
    if (w < 0.01) return;
    const b = this.b.begin(pose),
      rd = this.rd,
      T = this.time,
      v = _v4;
    const sway = noise1(T * 0.9, 7) * 0.25;
    b.moveHips(sway * 0.03 * w, 0, 0);
    b.rot("chest", Z, -sway * 0.12 * w);
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1;
      const sh = b.pos("upperArm" + S, new THREE.Vector3());
      const lift = 0.1 + (sx > 0 ? sway : -sway) * 0.25;
      const hand = sh.clone().add(v.set(sx * 0.55, -0.12 + lift, 0.06));
      b.ik("arm", S, hand, sh.clone().add(v.set(sx * 0.28, -0.05, -0.25)), w, {
        absolute: true,
      });
      this.rd.curl(pose, S, 0.25, w);
      // feet onto the coping line (x -> ~0), keeping the stride
      const a = b.pos("foot" + S, new THREE.Vector3());
      const fq = b.cq("foot" + S, new THREE.Quaternion());
      const knee = b.pos("lowerLeg" + S, new THREE.Vector3());
      b.ik(
        "leg",
        S,
        a.setX(lerp(a.x, sx * 0.03, w)),
        knee.add(v.set(0, 0, 0.4)),
        1,
        { absolute: false },
      );
      b.setCQ("foot" + S, fq);
    }
    b.dirty = true;
  }
  // ---------------------------------------------------------------- web tightrope (A.rope; node 'rope')
  // Procedural on the walk clip (no new clips, mesh untouched): the walk cycle at a tightrope cadence with the stride
  // warped so k * vN * dur * Hz == speed (the planted foot never slides along the strand), then every foot is moved onto
  // the strand centre line (swing foot passes a little outside the planted one and comes back in), toes turned along the
  // web, heights from the strand itself (slope + the V under his feet); the pelvis rises as far as the legs allow
  // (walkForm), slight forward lean with speed, arms out for balance with a slow corrective sway (+ A / D lean) and a
  // small counter-swing to the legs. Idle: one foot in front of the other on the line, knees soft, weight shifts.
  ropeY(R, u) {
    return ropePoint(R, u, this._ry || (this._ry = new THREE.Vector3())).y;
  }
  // idle balance stance: right foot in front, left behind, both on the line (heights / yaw fixed later by ropeFeet)
  ropeStance(pose) {
    const b = this.b.begin(pose),
      rd = this.rd,
      T = this.time,
      v = _v4;
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1,
        fq = b.cq("foot" + S, new THREE.Quaternion()),
        knee = b.pos("lowerLeg" + S, new THREE.Vector3());
      b.ik(
        "leg",
        S,
        v.set(-sx * 0.01, rd.ankleH, S === "R" ? 0.16 : -0.15),
        knee.add(_v3.set(sx * 0.2, 0, 0.4)),
        1,
        { absolute: false },
      );
      b.setCQ("foot" + S, fq);
    }
    // soft knees, slow weight shift between the feet and side to side
    b.moveHips(
      noise1(T * 0.37, 21) * 0.015,
      -0.03,
      noise1(T * 0.29, 5) * 0.035,
    );
    b.dirty = true;
  }
  // feet onto the strand. F = char-space foot positions / rotations / toe yaw sampled BEFORE the lean + sway.
  ropeFeet(pose, A, F) {
    const b = this.b.begin(pose),
      rd = this.rd,
      R = A.rope,
      on = A.mode === "rope" && R;
    const y0 = on ? this.ropeY(R, R.u) : 0,
      per = on ? R.face / Math.max(R.lenH, 0.5) : 0;
    const slope = on
      ? Math.atan(((R.b.y - R.a.y) / Math.max(R.lenH, 0.5)) * R.face)
      : 0;
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1,
        a = F.a[S];
      const lift = Math.max(0, a.y - rd.ankleH),
        lk = smooth((lift - 0.02) / 0.06);
      const tgt = _v4.set(
        lerp(-sx * 0.012, sx * 0.07, lk),
        a.y + lift * 0.5,
        a.z,
      ); // swing foot lifts higher (knee up, not a straight-leg swing)
      if (on) tgt.y += this.ropeY(R, R.u + a.z * per) - y0;
      const q = _q
        .setFromAxisAngle(Y, -F.yaw[S] * (1 - 0.4 * lk))
        .multiply(F.q[S]);
      if (slope) q.premultiply(_q2.setFromAxisAngle(X, -slope * (1 - lk)));
      const knee = b
        .pos("lowerLeg" + S, new THREE.Vector3())
        .add(_v3.set(sx * 0.16, 0, 0.5)); // knees forward + a little out (spider crouch)
      b.ik("leg", S, tgt, knee, 1, { absolute: false });
      b.setCQ("foot" + S, q);
    }
  }
  // user r13b (refs/rope/sm2_webline_walk_*): arms LOW and loose, hanging forward and a little out by the thighs / knees
  // (ready to grab), elbows bent out, relaxed wrists, loosely curled fingers; a small swing with the steps and an
  // asymmetric dip / rise from the balance wobble and the A / D lean. Not out to the sides.
  ropeArms(pose, sway, wl, w) {
    if (w < 0.01) return;
    const b = this.b.begin(pose),
      rd = this.rd,
      ph = this.locoPhase * TAU;
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1;
      const sh = b.pos("upperArm" + S, new THREE.Vector3());
      const swing = Math.cos(ph) * 0.1 * wl * -sx; // counter to the legs (R arm forward on the L step)
      const dip = -sx * sway * 0.1; // the side he tips toward drops, the other rises
      const hand = sh
        .clone()
        .add(
          _v4.set(
            sx * lerp(0.26, 0.3, wl),
            -0.5 + dip,
            lerp(0.26, 0.22, wl) + swing,
          ),
        );
      b.ik(
        "arm",
        S,
        hand,
        sh.clone().add(_v3.set(sx * 0.45, -0.15, -0.15)),
        w,
        { absolute: true },
      );
      const el = b.pos("lowerArm" + S, new THREE.Vector3()),
        fa = b
          .pos("hand" + S, new THREE.Vector3())
          .sub(el)
          .normalize();
      fa.y -= 0.2;
      b.aim("hand" + S, fa.normalize(), 0.8 * w);
      this.rd.curl(pose, S, 0.45, w);
      b.dirty = true;
    }
  }
  ropePose(out, L, A, crouch = 0) {
    const R = A.rope,
      D = L.data,
      C = this.clips,
      dt = this.dt,
      T = this.time;
    const on = A.mode === "rope" && R;
    const v = on && A.sub === "ropeWalk" ? R.speed : 0;
    const wm = this.locoMeta("walk");
    const wl = wm ? smooth((v - 0.08) / 0.7) : 0;
    if (wl < 0.999) {
      if (!C.sample(C.first("idle"), this.idleT, this.P.idle))
        this.fallback("idle", this.idleT, this.P.idle);
      this.ropeStance(this.P.idle);
    }
    if (wl > 0.001) {
      if ((D.wlPrev ?? 0) <= 0.001) this.locoPhase = wm.pass; // first step from the passing pose
      const hz = ROPE_HZ(Math.max(v, 0.6));
      const k = clamp(v / (wm.v * wm.dur * hz), 0.2, 1.6); // stride: planted foot moves back at exactly v (no slide)
      this.locoPose(this.P.loco, 1.2, { k, rate: hz, fc: hz });
      this.locoPhase = (this.locoPhase + dt * hz) % 1;
      if (wl < 0.999)
        blendPoses(this.P.idle, this.P.loco, wl, out, null, this.bm(2));
      else out.copy(this.P.loco);
      D.clip = `rope walk r${hz.toFixed(2)} k${k.toFixed(2)}`;
    } else {
      out.copy(this.P.idle);
      D.clip = on ? "rope idle" : "perchStand";
    }
    D.wlPrev = wl;
    // feet as the cycle placed them (before the crouch / lean), toe yaw from the toe bones
    const b = this.b.begin(out),
      F =
        D.F ||
        (D.F = {
          a: { L: new THREE.Vector3(), R: new THREE.Vector3() },
          q: { L: new THREE.Quaternion(), R: new THREE.Quaternion() },
          yaw: { L: 0, R: 0 },
        });
    for (const S of ["L", "R"]) {
      b.pos("foot" + S, F.a[S]);
      b.cq("foot" + S, F.q[S]);
      const ti = this.skel.idx("toe" + S);
      F.yaw[S] = 0;
      if (ti >= 0) {
        const d = b.pos(ti, _v3).sub(F.a[S]);
        if (d.x * d.x + d.z * d.z > 1e-4) F.yaw[S] = Math.atan2(d.x, d.z);
      }
    }
    // user r13b: low athletic prowl — pelvis ~22 % below standing, square (no hip roll / sway), torso pitched ~30 deg
    // forward with the back slightly rounded, head up looking ahead. Balance wobble / A-D lean only roll the chest.
    D.sway = damp(
      D.sway ?? 0,
      noise1(T * 0.8, 7) * 0.22 +
        noise1(T * 2.3, 3) * 0.07 * wl +
        (on ? R.lean : 0) * 0.6,
      10,
      dt,
    );
    const sw = D.sway,
      bob = wl * 0.012 * Math.cos(this.locoPhase * TAU * 2);
    {
      const hq = b.cq("hips", _q);
      const e = (this._re ||= new THREE.Euler()).setFromQuaternion(hq, "YXZ");
      b.rot("hips", Z, -e.z * 0.8);
    } // cancel the clip's pelvic roll
    b.moveHips(
      0,
      -lerp(0.2, 0.19, wl) - bob - 0.2 * crouch,
      -0.04 - 0.06 * crouch,
    );
    b.rot("hips", X, 0.3 + 0.05 * crouch);
    b.rot("spine", X, 0.2 + 0.3 * crouch);
    b.rot("chest", X, 0.12 + 0.2 * crouch);
    b.rot("neck", X, -0.26);
    b.rot("head", X, -0.28 - 0.1 * crouch);
    b.rot("spine", Z, -sw * 0.05);
    b.rot("chest", Z, -sw * 0.08);
    this.ropeFeet(out, A, F);
    this.ropeArms(out, sw, wl, (on ? 1 : 0.85) * (1 - 0.8 * crouch));
  }
  // T: right arm up and pointing at the target, thwip (small recoil), then the hand brings the near end down to the
  // perch point and pins it (timeline from traversal: rope.fireT / hitT / pinT, s since T)
  ropeShootArm(pose, A) {
    const R = A.rope,
      t = R.t,
      b = this.b.begin(pose),
      rd = this.rd;
    const aimW = smooth(t / 0.12) * (1 - smooth((t - R.hitT - 0.02) / 0.1));
    const pinW =
      smooth((t - R.hitT - 0.02) / 0.1) *
      (1 - smooth((t - R.pinT - 0.04) / 0.16));
    if (aimW + pinW < 0.005) return;
    const sh = b.pos("upperArmR", new THREE.Vector3());
    if (aimW > 0.005) {
      const d = this.worldToChar(R.b, new THREE.Vector3()).sub(sh).normalize();
      d.z = Math.max(d.z, 0.25);
      d.normalize();
      const kick =
        t > R.fireT
          ? Math.exp(-(t - R.fireT) * 16) * smooth((t - R.fireT) / 0.025)
          : 0;
      const hand = sh
        .clone()
        .addScaledVector(d, (rd.a1 + rd.a2) * (0.97 - 0.14 * kick));
      b.ik("arm", "R", hand, sh.clone().add(_v3.set(-0.3, -0.25, -0.2)), aimW, {
        absolute: true,
      });
      b.aim("handR", d, aimW * 0.8);
      rd.curl(pose, "R", 0.55, aimW);
      b.dirty = true; // web-shooter grip: middle / ring fingers in
      b.rot("chest", Y, -0.12 * aimW); // shoulder squares toward the shot
    }
    if (pinW > 0.005) {
      const p = this.worldToChar(R.a, new THREE.Vector3());
      p.y += 0.05;
      b.ik("arm", "R", p, sh.clone().add(_v3.set(-0.35, 0.1, -0.1)), pinW, {
        absolute: true,
      });
    }
  }
  // ---------------------------------------------------------------- visual root (orientation + placement)
  updateFrame(dt, A, top, io) {
    const T = TRAITS[top.name] || TRAITS.ground;
    const C = io.center,
      H = io.H ?? 0.95;
    const vel = this.velS;
    const fwd = _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    let up = _v2.copy(UP),
      rate = 12,
      pivot = 0,
      wall = false;
    const f = top.node.frame?.(top, A);
    const kind = f?.kind || T.frame;
    if (kind === "ledge") {
      fwd.copy(f.fwd);
      this.yaw = Math.atan2(fwd.x, fwd.z);
      rate = 30;
      pivot = 0;
    } else if (kind === "upright" || kind === "uprightWall") {
      if (kind === "uprightWall" && A.wall?.normal) {
        fwd.copy(A.wall.normal).setY(0).negate();
        if (fwd.lengthSq() < 1e-4)
          fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        fwd.normalize();
        this.yaw = Math.atan2(fwd.x, fwd.z);
      }
      rate = 16;
      pivot = 0;
    } else if (kind === "air") {
      const hv = Math.hypot(vel.x, vel.z);
      if (hv > 1)
        this.yaw = lerpAngle(
          this.yaw,
          Math.atan2(vel.x, vel.z),
          1 - Math.exp(-5 * dt),
        );
      fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      rate = 7;
      pivot = 1;
    } else if (kind === "swing") {
      const anc = A.swing?.anchor;
      if (anc) up.copy(anc).sub(C).normalize();
      const v = _v3.copy(vel);
      if (v.lengthSq() < 1) v.copy(fwd);
      fwd.copy(v).addScaledVector(up, -v.dot(up));
      if (fwd.lengthSq() < 1e-4)
        fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      fwd.normalize();
      this.yaw = Math.atan2(vel.x, vel.z) || this.yaw;
      rate = 10;
      pivot = 1;
    } else if (kind === "zip") {
      const tgt = A.zip?.dash || A.mode !== "zip" ? null : A.zip?.target;
      const useV = f?.useVel && vel.lengthSq() > 9;
      let dir = useV
        ? _v3.copy(vel)
        : tgt
          ? _v3.copy(tgt).sub(C)
          : _v3.copy(vel);
      // pointing straight at the anchor: freeze the direction in the last metre (target - centre gets tiny/noisy)
      const zf = this.zipDir || (this.zipDir = new THREE.Vector3(0, 0, 1));
      if (f?.aim && tgt) {
        if (dir.lengthSq() > 1.2) zf.copy(dir).normalize();
        dir = _v3.copy(zf);
      }
      if (dir.lengthSq() > 1e-3) {
        dir.normalize();
        const k = f?.tilt ?? 0.55;
        const dh = _v4.set(dir.x, 0, dir.z);
        const hd = dh.length();
        if (hd > 1e-3) dh.divideScalar(hd);
        up.copy(UP)
          .lerp(dir, k)
          .addScaledVector(dh, -(f?.back || 0))
          .normalize();
        if (up.y < -0.15) {
          up.y = -0.15;
          const hl = Math.hypot(up.x, up.z) || 1;
          const r = Math.sqrt(1 - 0.0225) / hl;
          up.x *= r;
          up.z *= r;
        }
        // heading: along the flight; during the catch turn toward the perch facing (outward normal) so he lands facing out
        // heading (user feedback #15): only follows the flight direction while it has a real horizontal component, and
        // slowly — near-vertical flight keeps the launch yaw, so the root never flips 180 deg over the top
        const yawT =
          A.mode === "zip" && A.facing != null
            ? A.facing
            : hd > 0.35
              ? Math.atan2(dir.x, dir.z)
              : this.yaw;
        const pn = f?.catchK > 0 ? window.__trav?.s?.zip?.normal : null;
        let yT = yawT;
        if (pn && Math.hypot(pn.x, pn.z) > 0.3)
          yT = lerpAngle(yawT, Math.atan2(pn.x, pn.z), smooth(f.catchK));
        this.yaw = lerpAngle(
          this.yaw,
          yT,
          1 -
            Math.exp(
              -(f?.catchK > 0 ? 8 : 6) *
                smooth((hd - 0.35) / 0.3 + (f?.catchK || 0)) *
                dt,
            ),
        );
        if (A.sub === "wallZip" && A.wall?.normal)
          this.yaw = lerpAngle(
            this.yaw,
            Math.atan2(-A.wall.normal.x, -A.wall.normal.z),
            1 - Math.exp(-14 * dt),
          ); // user r9w: chest to the wall
        const H = _v4.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        // chest: heading when upright, face-down (world down) when streamlined; both projected off the body axis
        const g = clamp(f?.lay ?? 0, 0, 1) * smooth((hd - 0.15) / 0.4);
        fwd
          .copy(H)
          .multiplyScalar(1 - g)
          .addScaledVector(UP, -g);
        fwd.addScaledVector(up, -fwd.dot(up));
        if (fwd.lengthSq() < 1e-3) {
          fwd.copy(H).addScaledVector(up, -H.dot(up));
          if (fwd.lengthSq() < 1e-4)
            fwd.set(0, -1, 0).addScaledVector(up, -up.y);
        }
        fwd.normalize();
      }
      rate = f?.useVel ? 12 : 10;
      pivot = f?.pivot ?? 1;
    } else if (kind === "wall" || kind === "wallOut") {
      const n = A.wall?.normal || A.perch?.normal || this.lastWallN;
      this.lastWallN.copy(n);
      fwd.copy(n).negate();
      // body "up" along the wall: crawl heading (movement), otherwise world-up projected into the wall
      const wu = _v3.copy(UP).addScaledVector(n, -UP.dot(n));
      if (wu.lengthSq() < 1e-3) wu.set(0, 0, 1).addScaledVector(n, -n.z);
      wu.normalize();
      if (kind === "wall" && f?.heading) {
        const h = f.heading;
        this.wallUp.lerp(h, 1 - Math.exp(-6 * dt));
      } else this.wallUp.lerp(wu, 1 - Math.exp(-4 * dt));
      this.wallUp.addScaledVector(n, -this.wallUp.dot(n)).normalize();
      if (this.wallUp.lengthSq() < 0.5) this.wallUp.copy(wu);
      up.copy(this.wallUp);
      rate = kind === "wallOut" ? 8 : 12;
      pivot = 1;
      wall = kind === "wall";
      this.yaw = Math.atan2(fwd.x, fwd.z);
    } else if (kind === "wallRun") {
      // user feedback #5: the normal run cycle rotated onto the wall — body "up" = wall normal, forward = run heading
      // along the wall, soles on the wall plane (placement below). Pivot about the feet so entry reads as a step onto
      // the wall.
      const n = A.wall?.normal || this.lastWallN;
      this.lastWallN.copy(n);
      up.copy(n);
      if (A.sub === "wallRunSide") up.lerp(UP, 0.42).normalize(); // horizontal run: leaning out, not a flag
      const h = f?.heading;
      if (h) this.wrHead.lerp(h, 1 - Math.exp(-8 * dt));
      else
        this.wrHead.lerp(
          _v3.copy(UP).addScaledVector(n, -UP.dot(n)),
          1 - Math.exp(-4 * dt),
        );
      this.wrHead.addScaledVector(n, -this.wrHead.dot(n));
      if (this.wrHead.lengthSq() < 1e-4)
        this.wrHead.copy(UP).addScaledVector(n, -UP.dot(n));
      this.wrHead.normalize();
      fwd.copy(this.wrHead);
      rate = 10;
      pivot = 0;
    }
    // root-orientation handover between frame kinds (e.g. wall run -> crawl, ground -> wall run) eases in over ~0.4 s
    // instead of snapping at the new kind's tracking rate (user feedback #3: no root orientation pops)
    if (kind !== this.frameKind) {
      this.frameKind = kind;
      this.kindT = 0;
    } else this.kindT = (this.kindT || 0) + dt;
    if (this.kindT < 0.45 && kind !== "swing" && kind !== "air")
      rate = lerp(Math.min(rate, 4.5), rate, smooth(this.kindT / 0.45));
    // basis: +Y = up, +Z = fwd
    const z = fwd.addScaledVector(up, -fwd.dot(up)).normalize(),
      x = _v4.crossVectors(up, z).normalize();
    _m.makeBasis(x, up, z);
    _q.setFromRotationMatrix(_m);
    if (!this.frameInit) {
      this.frameQ.copy(_q);
      this.frameInit = true;
    } else {
      if (this.frameQ.dot(_q) < 0) _q.set(-_q.x, -_q.y, -_q.z, -_q.w);
      this.frameQ.slerp(_q, 1 - Math.exp(-rate * dt));
    }
    this.pivotW = damp(this.pivotW, pivot, 10, dt);
    // lean into turns + acceleration (upright/air only)
    const upright = kind === "upright" || kind === "air" ? 1 : 0;
    const hs = this.speedH;
    const latA = hs * (this.yawRate || 0); // centripetal
    this.lean.step(
      upright *
        smooth((hs - 2.5) / 3) *
        clamp(-Math.atan(latA / 9.81) * 0.85, -0.3, 0.3),
      dt,
    ); // (anim r2) 0.6 / 0.2: he barely banked into run turns
    const fa =
      this.accel.x * Math.sin(this.yaw) + this.accel.z * Math.cos(this.yaw);
    this.pitchLean.step(
      upright *
        (kind === "upright" ? clamp((fa / 9.81) * 0.25, -0.08, 0.12) : 0),
      dt,
    );
    const R = this.visQ || (this.visQ = new THREE.Quaternion());
    R.copy(this.frameQ);
    R.multiply(_q2.setFromAxisAngle(Z, this.lean.x)).multiply(
      _q2.setFromAxisAngle(X, this.pitchLean.x),
    );
    const spin = top.node.spin?.(top, A);
    // root-spin handover: when the top node changes mid-rotation (a trick cut short by a swing / landing, trick -> air) the
    // last applied spin eases into the new node's spin over 0.25 s instead of snapping
    {
      const sp =
        this.spinS ||
        (this.spinS = {
          key: "",
          q: new THREE.Quaternion(),
          from: new THREE.Quaternion(),
          t: 9,
        });
      if (top.key !== sp.key) {
        sp.key = top.key;
        sp.from.copy(sp.q);
        sp.t = top.data?.noHandover ? 9 : 0;
      } else sp.t += dt; // seamless trick: its spin already starts from the last orientation
      const tgt = spin || QI;
      if (sp.t < 0.25) sp.q.slerpQuaternions(sp.from, tgt, smooth(sp.t / 0.25));
      else sp.q.copy(tgt);
      if (sp.q.w < 0.999999) R.multiply(sp.q);
    }
    // placement: feet pivot (O below centre along world up) vs centre pivot (O below centre along body up)
    const Of = _v3.copy(C).addScaledVector(UP, -H + (A.stepOffset || 0)); // traversal's curb-step smoothing
    const upB = _v.set(0, 1, 0).applyQuaternion(R);
    const Oc = _v2.copy(C).addScaledVector(upB, -H);
    const O = this.visP || (this.visP = new THREE.Vector3());
    O.lerpVectors(Of, Oc, this.pivotW);
    // wall: slide so the wall plane sits at char z = WALL_Z (clips authored against it)
    // wall run: soles on the wall plane (never inside the building). Blend weight damps so entry/exit glide.
    this.wrW = damp(
      this.wrW,
      kind === "wallRun" ? 1 : 0,
      kind === "wallRun" ? 9 : 6,
      dt,
    );
    if (this.wrW > 1e-3) {
      const n = this.lastWallN;
      if (kind === "wallRun") {
        // effective wall plane from traversal (most protruding facade surface over the body extent, C1 wall.dist):
        // soles 2 cm proud of it. Raycast from the centre only as a fallback.
        const wd = A.wall?.dist;
        if (wd != null && isFinite(wd) && wd > 0.05)
          this.wrOff.copy(n).multiplyScalar(-(wd - 0.02));
        else if (this.world?.raycast) {
          const h = this.world.raycast(_v4.copy(C), _v.copy(n).negate(), 3.0);
          if (h) this.wrOff.copy(h.point).sub(C).addScaledVector(n, 0.02);
          else if (!this.wrOffOk)
            this.wrOff.copy(n).multiplyScalar(-(io.wallDist ?? 0.44));
        }
        this.wrOffOk = true;
      }
      // keep the along-wall position of the capsule; only the normal offset comes from the wall hit
      const dn = this.wrOff.dot(n);
      const Ow = _v4.copy(C).addScaledVector(n, dn);
      O.lerp(Ow, this.wrW);
    } else this.wrOffOk = false;
    let kT = 0;
    if (wall || kind === "wallOut") {
      const n = this.lastWallN;
      let d0 = A.wall?.dist ?? io.wallDist ?? null;
      if (d0 == null && this.world?.raycast) {
        const h = this.world.raycast(_v4.copy(C), _v.copy(n).negate(), 2.5);
        if (h) d0 = h.distance;
      }
      if (d0 != null) kT = clamp(WALL_Z - d0, -1.2, 0.6);
      if (!this.wallKInit) {
        this.wallK = kT;
        this.wallKInit = true;
      }
    } else this.wallKInit = false;
    this.wallK = damp(this.wallK, kT, 10, dt);
    if (Math.abs(this.wallK) > 1e-4)
      O.addScaledVector(this.lastWallN, this.wallK);
    if (kind === "ledge" && f.O) O.lerp(f.O, f.w);
    // rig.object local = parentWorld^-1 * (O, R)
    const obj = this.rig.object,
      parent = obj.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      const inv = (this.invParent ||= new THREE.Matrix4())
        .copy(parent.matrixWorld)
        .invert();
      _m.compose(O, R, _v4.set(1, 1, 1)).premultiply(inv);
      _m.decompose(obj.position, obj.quaternion, obj.scale);
    } else {
      obj.position.copy(O);
      obj.quaternion.copy(R);
    }
    obj.updateMatrixWorld(true);
    this.charToWorld = obj.matrixWorld; // char space -> world
  }
  worldToChar(p, out) {
    if (!this._invT || this._invT !== this.time) {
      (this._inv ||= new THREE.Matrix4()).copy(this.charToWorld).invert();
      this._invT = this.time;
    }
    return out.copy(p).applyMatrix4(this._inv);
  }
  dirToChar(d, out) {
    _q.copy(this.visQ).invert();
    return out.copy(d).applyQuaternion(_q);
  }

  // ---------------------------------------------------------------- post layers
  postWeb(dt, A, w) {
    const anc =
      A.mode === "zip" || A.sub === "wallZip" ? A.zip?.target : A.swing?.anchor; // user r9w: wall zip web hand
    // release fade (air): keep the swing's hand — defaulting to 'R' pulled the right arm up to the dropped web after a
    // left-hand release (critic r1 #5 parity)
    const hand = (A.mode === "zip" ? "R" : A.swing?.hand) || "R";
    // web-zip proper: both arms are fully authored by zipPose (two webs, fire/yank/flight); only the air web-dash
    // (single web, clip-driven) uses the hand-on-web IK
    const zipOwn = A.mode === "zip" && !A.zip?.dash;
    const want = anc && w > 0.01 && !zipOwn ? w : 0;
    // per-hand weights: the gripping arm rises fast, the other one relaxes slowly (hand switches cross-blend)
    for (const S of ["L", "R"]) {
      const t = S === hand || A.sub === "wallZip" ? want : 0;
      this.webWH[S] = damp(this.webWH[S], t, t > this.webWH[S] ? 11 : 6, dt);
    }
    this.webW = Math.max(this.webWH.L, this.webWH.R);
    this.twoHandState(dt, A, A.mode === "swing" ? anc : null, hand);
    // legs together / pointed while on the web (fades out over the release); tuck at the bottom/upswing when two-handed
    this.swLegW = damp(
      this.swLegW || 0,
      A.mode === "swing" ? 1 : 0,
      A.mode === "swing" ? 12 : 5,
      dt,
    );
    if (this.swLegW > 0.005)
      (() => {
        // upswing tuck holds on after the let-go (refs 05-08: still balled up while rising), fading slowly
        const tt =
          A.mode === "swing"
            ? this.two.max * smooth(((this.twoPh ?? 0) + 0.2) / 0.4)
            : 0;
        this.tuckW = damp(
          this.tuckW || 0,
          tt,
          tt > (this.tuckW || 0)
            ? 8
            : A.mode === "swing" && (this.twoPh ?? 0) > 0.2
              ? 1.2
              : 4,
          dt,
        );
        this.swingLegs(
          smooth(this.swLegW) *
            lerp(0.92, 1, Math.max(this.two.max, this.tuckW)),
          this.tuckW,
          hand,
        );
        this.applySwingLife(smooth(this.swLegW)); // (anim r2) per-web style + leg / torso dynamics on top of the hang
      })();
    if (this.webW < 0.01 || !anc) return;
    const b = this.b,
      rd = this.rd;
    const Tsw = this.two.sw || { L: 0, R: 0 };
    const twoOk =
      A.mode !== "zip" &&
      (this.two.max > 0.005 || Tsw.L > 0.005 || Tsw.R > 0.005); // swing + release cross-fade
    if (twoOk && this.two.max > 0.005)
      this.twoHandBody(this.two.max * this.webW, hand);
    const a = this.worldToChar(
      anc,
      this._wa || (this._wa = new THREE.Vector3()),
    );
    const tension = clamp(A.swing?.tension ?? 1, 0, 1);
    let plan = null;
    for (const S of ["L", "R"]) {
      const ww = this.webWH[S];
      if (ww < 0.01) continue;
      const sx = S === "L" ? 1 : -1; // character left = +X
      const sh = b.pos("upperArm" + S, new THREE.Vector3());
      const dir = a.clone().sub(sh).normalize();
      // joint limits (user feedback #2): the arm may point up / forward / out, never far behind the back,
      // down past the hip or across the body midline -> no hyper-extension or twisted shoulders.
      dir.z = Math.max(dir.z, -0.45);
      dir.y = Math.max(dir.y, -0.15);
      dir.x = sx > 0 ? Math.max(dir.x, -0.3) : Math.min(dir.x, 0.3);
      dir.normalize();
      // body follows the pull: spine/chest roll toward the gripping side, clavicle shrugs toward the web
      const side = clamp(dir.x * sx, -1, 1),
        rise = clamp(dir.y, 0, 1);
      b.rot("spine", Z, -sx * 0.06 * rise * ww);
      b.rot("chest", Z, -sx * 0.1 * rise * ww);
      b.rot("chest", Y, sx * 0.08 * (1 - side) * ww);
      const cl = b.i("shoulder" + S);
      if (cl >= 0) {
        const cp = b.pos(cl, new THREE.Vector3()),
          up0 = b
            .pos("upperArm" + S, new THREE.Vector3())
            .sub(cp)
            .normalize();
        b.aim(
          cl,
          up0.clone().lerp(dir, 0.3).normalize(),
          ww * 0.6 * (1 - 0.6 * this.two.max),
        ); // two-handed: no shrug (critic r2 #4)
      }
      const sh2 = b.pos("upperArm" + S, new THREE.Vector3());
      const reach = (rd.a1 + rd.a2) * lerp(0.95, 0.995, tension);
      const tgt = sh2.clone().addScaledVector(dir, reach);
      // pole: elbow out to the side and slightly back (natural overhead grip), mirrored per side
      const pole = sh2
        .clone()
        .addScaledVector(dir, reach * 0.5)
        .add(new THREE.Vector3(sx * 0.35, -0.05, -0.25));
      // two-handed: this web fist moves to the stacked overhead grip (straight arm), see twoHandPlan
      if (twoOk && !plan) {
        plan = this.twoHandPlan(a);
        if (plan && plan.W !== S) plan = null;
      }
      if (plan) {
        tgt.lerp(plan.tW, plan.w);
        pole.lerp(plan.poleW, plan.w);
      }
      // user r17: solve the grip at FULL weight, then slerp the joint rotations from the current (free/jump) pose by ww, so
      // the grip twist unwinds continuously on release / hand switch. The arm leaving the web (release, hand switch) reuses
      // its last solved grip rotations — no re-solve against a web that is no longer held (the IK flipped the elbow there).
      const ids = ["upperArm" + S, "lowerArm" + S, "hand" + S].map((n) =>
          b.i(n),
        ),
        fing = this.rd.fingers[S].map((f) => f.i);
      const q0 = ids.map((i) => b.pose.getQ(i, new THREE.Quaternion())),
        f0 = fing.map((i) => b.pose.getQ(i, new THREE.Quaternion()));
      const G = this._webGrip || (this._webGrip = {});
      if (A.mode === "swing" && S === hand) {
        b.ik("arm", S, tgt, pole, 1, { absolute: true });
        b.aim("hand" + S, dir, 0.9); // fist grips the line: hand aims along the web
        this.fist(S, 1, 1); // closed fist on the line (critic r1 #3)
        if (plan) this.gripHand(S, plan.fW, plan.pnW, plan.w, 1.0);
        G[S] = {
          q: ids.map((i) => b.pose.getQ(i, new THREE.Quaternion())),
          f: fing.map((i) => b.pose.getQ(i, new THREE.Quaternion())),
        };
      }
      const g = G[S];
      if (g) {
        for (let j = 0; j < 3; j++) {
          const q = q0[j].clone().slerp(g.q[j], ww);
          b.pose.setQ(ids[j], q);
        }
        for (let j = 0; j < fing.length; j++)
          b.pose.setQ(fing[j], f0[j].clone().slerp(g.f[j], ww));
        b.dirty = true;
      }
    }
    // hand switch while a second grip is still letting go: plan for the fading side without moving the new web hand
    // free arm = the jump/air arm pose (user r16): one consistent free-arm pose swing -> join -> hold -> let-go -> air; the
    // two-hand reach starts from it and the let-go returns to it (twoHandIK reads this pose as its base). Mirrors with the hand.
    if (A.mode === "swing" || A.mode === "air") {
      const Fr = hand === "L" ? "R" : "L",
        wf = clamp(this.webW * 1.2, 0, 1) * (1 - this.webWH[Fr]);
      if (wf > 0.01) this.freeArmJump(Fr, wf);
    }
    if (!plan && twoOk) plan = this.twoHandPlan(a);
    if (plan) this.twoHandIK(plan);
  }
  // Quick web boost (Q, traversal quickBoostStart, anim.quick): ONE arm snaps out toward the far anchor while the web
  // flies (~0.05-0.11 s), then yanks the line back to the chest as the body is boosted, and springs back into the normal
  // air arms. Layered on top of whatever air pose plays (air node rise/apex/fall + jumpArms / jumpWings) — the body stays
  // in its mid-air animation, only a small chest pitch / twist toward the pull. Per-hand springs (weight + pull), so a
  // chained press with the other hand overlaps the first arm's recovery. Live tuning: window.__qy = {...}.
  postQuickYank(dt, A) {
    const Q = A.quick,
      K = Object.assign(
        {
          reach: 0.97,
          pullX: 0.17,
          pullY: -0.16,
          pullZ: 0.2,
          hold: 0.3,
          lean: 0.14,
          twist: 0.2,
        },
        globalThis.__qy || {},
      );
    const on = !!(Q && Q.active && A.mode === "air");
    const st =
      this._qy ||
      (this._qy = {
        L: {
          w: new Spring(0, 4.6, 0.72),
          p: new Spring(1, 5.2, 0.5),
          a: new THREE.Vector3(),
          has: false,
        },
        R: {
          w: new Spring(0, 4.6, 0.72),
          p: new Spring(1, 5.2, 0.5),
          a: new THREE.Vector3(),
          has: false,
        },
      });
    const b = this.b,
      rd = this.rd;
    for (const S of ["L", "R"]) {
      const H = st[S],
        mine = on && Q.hand === S;
      if (mine) {
        H.a.copy(Q.anchor);
        H.has = true;
      }
      // weight: in fast on the press, holds through the yank, springs out; pull: 0 = reaching out, 1 = fist at the chest
      const w = clamp(
        H.w.step(mine && Q.t < Q.hitT + K.hold ? 1 : 0, dt),
        0,
        1.05,
      );
      const p = clamp(H.p.step(mine && Q.t < Q.hitT ? 0 : 1, dt), -0.15, 1.12);
      if (w < 0.01 || !H.has || !this.charToWorld) continue;
      const sx = S === "L" ? 1 : -1,
        sh = b.pos("upperArm" + S, new THREE.Vector3());
      const a = this.worldToChar(H.a, _v4),
        dir = _v3.copy(a).sub(sh).normalize();
      dir.z = Math.max(dir.z, 0.25);
      dir.y = clamp(dir.y, -0.2, 0.8);
      dir.x = sx > 0 ? Math.max(dir.x, -0.25) : Math.min(dir.x, 0.25);
      dir.normalize(); // ahead, never across / behind
      const reach = (rd.a1 + rd.a2) * K.reach,
        ex = 1 - clamp(p, 0, 1);
      // body follows the pull: chest twists the reaching shoulder forward, then pitches / turns into the yank
      b.rot("spine", X, K.lean * 0.5 * w * clamp(p, 0, 1));
      b.rot("chest", X, K.lean * 0.5 * w * clamp(p, 0, 1));
      b.rot("chest", Y, sx * K.twist * w * (0.6 * clamp(p, 0, 1) - ex));
      b.rot("neck", X, -K.lean * 0.4 * w * clamp(p, 0, 1));
      const sh2 = b.pos("upperArm" + S, new THREE.Vector3());
      const out = sh2.clone().addScaledVector(dir, reach);
      const pulled = new THREE.Vector3(
        sx * K.pullX,
        sh2.y + K.pullY,
        sh2.z + K.pullZ,
      );
      const tgt = out.clone().lerp(pulled, p);
      const pole = sh2
        .clone()
        .addScaledVector(dir, reach * 0.5)
        .lerp(new THREE.Vector3(sx * 0.55, sh2.y - 0.3, sh2.z - 0.3), p)
        .add(new THREE.Vector3(sx * 0.25, -0.2, -0.2).multiplyScalar(ex));
      b.ik("arm", S, tgt, pole, Math.min(1, w), { absolute: true });
      b.aim("hand" + S, dir, Math.min(1, w) * ex * 0.8); // wrist along the line while reaching (web-shooter flick)
      this.fist(S, 0.35 + 0.6 * clamp(p, 0, 1), Math.min(1, w)); // fist closes on the line for the yank
      b.dirty = true;
    }
  }
  // single free arm in the jump/air pose (same targets as jumpArms at apex: spread, pulled back, hand ~shoulder height,
  // wrist continuing the forearm) — used for the swing's free arm so it matches the air node exactly
  freeArmJump(S, w) {
    const b = this.b,
      sk = this.skel,
      sx = S === "L" ? 1 : -1,
      ld = sx === (this.jumpLead ?? 1) ? 1 : 0;
    const sh = b.pos("upperArm" + S, new THREE.Vector3());
    // critic r7 #1: the jumpArms apex target bent the elbow enough that the forearm + hand hung down from the elbow (a
    // limp paw in front view). Same direction (spread, back, ~shoulder height) but reached at ~93 % so the arm is long
    // and the hand floats out level like the air pose after release; elbow bend points back/down (natural)
    const Rr = this.rd.a1 + this.rd.a2;
    const dir = new THREE.Vector3(
      sx * 0.6 - sh.x,
      -(ld ? 0.06 : 0.14),
      -0.24 - sh.z,
    ).normalize();
    const tgt = sh.clone().addScaledVector(dir, Rr * 0.93);
    const pole = sh
      .clone()
      .addScaledVector(dir, Rr * 0.5)
      .add(new THREE.Vector3(0, -0.2, -0.3));
    b.ik("arm", S, tgt, pole, w, { absolute: true });
    const iF = b.i("lowerArm" + S),
      iH = b.i("hand" + S);
    if (iF >= 0 && iH >= 0) {
      const fq = b.cq("lowerArm" + S, new THREE.Quaternion());
      b.setCQ(
        "hand" + S,
        fq
          .multiply(sk.bQ(iF, new THREE.Quaternion()).invert())
          .multiply(sk.bQ(iH, new THREE.Quaternion())),
        w,
      );
    }
    this.fist(S, 0.12, w * 0.9); // loose, slightly open hand (not a curled paw)
  }
  // ---- two-handed swing grip (user request + refs/swing/twohand_01..11). user r9v: two hands is the DEFAULT — the free hand
  // reaches up and joins the web fist as soon as a web connects and holds for the whole swing. The only exception: swerving
  // away from the web-hand side (web in the right hand + turning left, or vice versa) lets the second hand go, and it stays
  // off for the rest of that swing (latched per web; the next web starts two-handed again). Turning toward the web-hand
  // side keeps both hands on. Release / a new web / leaving the swing let go as before.
  twoHandState(dt, A, anc, hand) {
    const T = this.two,
      sw = A.swing || {};
    const swinging = A.mode === "swing" && A.sub !== "release" && !!anc;
    if (swinging) {
      if (T.hand !== hand || T.anc.distanceToSquared(anc) > 0.25) {
        T.t = 0;
        T.on = false;
        T.dropped = false;
        T.anc.copy(anc);
        T.hand = hand;
      }
      T.t += dt;
    } else {
      T.t = 0;
      T.hand = "";
    }
    const ph = this.swingPhHand === hand ? this.swingPh : 0;
    this.twoPh = ph;
    // signed turn toward the free-hand side: heading rate of travel + the swing bank (both > 0 = turning left, i.e. toward
    // char +x = the L side). Web in R -> free hand L -> a left turn (> 0) drops it; web in L -> a right turn (< 0).
    const v = A.velocity,
      hs = v ? Math.hypot(v.x, v.z) : 0,
      hdg = hs > 3 ? Math.atan2(v.x, v.z) : null;
    let hRate = 0;
    if (hdg != null && T.hdg != null && dt > 0) {
      let dh = hdg - T.hdg;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      hRate = dh / dt;
    }
    T.hdg = hdg;
    T.hRate = damp(T.hRate || 0, Math.abs(hRate) < 8 ? hRate : 0, 10, dt);
    const away = hand === "R" ? 1 : -1;
    const tBank = (sw.bank ?? 0) * away,
      tRate = T.hRate * away;
    // (the first 0.25 s on a web is ignored: the heading jumps while the new line takes the body's momentum)
    if (swinging && T.t > 0.25 && (tBank > 0.25 || tRate > 0.9))
      T.dropped = true;
    T.turning = !!T.dropped;
    T.on = swinging && !T.dropped;
    const F = hand === "L" ? "R" : "L";
    const Sw = T.sw || (T.sw = { L: 0, R: 0 });
    const Sp = T.sp || (T.sp = { L: { x: 0, v: 0 }, R: { x: 0, v: 0 } });
    for (const S of ["L", "R"]) {
      // (user r-anim7) after a hand switch the old second grip (now the web hand) is still letting go: the new free hand only
      // starts its reach once that has finished. Both weights up at once made twoHandPlan flip arms mid-blend (it plans for
      // the larger one): ~61 deg upper-arm pop at the crossover.
      const joining = S === F && T.on && (T[S === "L" ? "R" : "L"] || 0) < 0.02;
      // organic reach (user r11): a slightly under-damped spring (quick, elastic, small settle past the grip) instead of a
      // linear ramp; the let-go is critically damped. T[S] (0..1) is the clamped weight, T.sp[S].x the raw (overshooting) one.
      // user r14: slower, organic — join ~0.55 s with a ~3 % settle overshoot, let-go ~0.55 s critically damped (interruptible:
      // the spring keeps its position + velocity, so a reversal mid-way eases back from wherever the hand is)
      // critic r6 #2/#3: progress p runs linearly (join 0.45 s, let-go 0.5 s) and is eased with smootherstep (slow start,
      // even middle, soft settle) plus a ~3 % arrival overshoot; the output is lightly damped so a reversal mid-way
      // (a turn starting during the reach) turns around smoothly from wherever the hand is. Frame-rate independent.
      const sp = Sp[S];
      sp.p = clamp(
        (sp.p ?? 0) +
          (joining ? dt / 0.45 : -dt / (swinging && S === hand ? 0.15 : 0.5)),
        0,
        1,
      ); // (r-anim7) an ex-second grip that is now the web hand lets go fast
      const e =
        smoother(sp.p) +
        (joining
          ? 0.035 * Math.sin(Math.PI * clamp((sp.p - 0.75) / 0.25, 0, 1))
          : 0);
      sp.x = damp(sp.x, e, 22, dt);
      if (sp.p === 0 && sp.x < 0.002) sp.x = 0;
      T[S] = clamp(sp.x, 0, 1);
      // let-go sweep (critic r1 #7): the released arm swings out + back with an open hand, then hands back to the clip
      const Pk = T.pk || (T.pk = { L: 0, R: 0 });
      // user r16: no separate let-go / balance pose any more — the free arm is always the jump-arm pose (freeArmJump), and
      // the reach / let-go run between it and the grip
      Sw[S] = 0;
      Pk[S] = joining ? Math.max(Pk[S], T[S]) : T[S] > 0 ? Pk[S] : 0;
    }
    T.max = smooth(Math.max(T.L, T.R));
  }
  // two-handed hang (refs 05-08, critic r1 #4): torso square under the line, head tucked back between the upper arms, chin
  // slightly down. Applied before the arm IK so both grips solve against the final torso.
  twoHandBody(w, hand = "R") {
    const b = this.b,
      sxW = hand === "L" ? 1 : -1;
    // not a symmetric mannequin (critic r6 #5): slight twist toward the web-hand side, lean into the direction of travel
    // critic r7 #2: visible — ~13 deg torso twist, a lean along the line (pitch) and a side bend toward the web-hand side
    b.rotE("spine", 0.12 * w, sxW * 0.12 * w, sxW * 0.07 * w);
    b.rotE("chest", 0.06 * w, sxW * 0.1 * w, sxW * 0.03 * w);
    if (b.i("neck") >= 0) b.rotE("neck", -0.14 * w, 0, 0);
    b.rotE("head", 0.12 * w, 0, 0);
    // arms overhead: both clavicles lift (no collapsed shoulders under the straight-arm hang)
    for (const S of ["L", "R"]) {
      const cl = b.i("shoulder" + S);
      if (cl < 0) continue;
      const cp = b.pos(cl, new THREE.Vector3()),
        up0 = b
          .pos("upperArm" + S, new THREE.Vector3())
          .sub(cp)
          .normalize();
      b.aim(cl, up0.clone().lerp(Y, 0.2).normalize(), w * 0.25); // just enough to keep the deltoid off the neck
    }
  }
  // swing legs (critic r1 #1, refs 01-04): together, hanging below the hips, knees only slightly bent, toes pointed down so
  // fists-to-toes read as one long line; tucked (knees up) only at the bottom / upswing of a two-handed swing (refs 05-08).
  // Symmetric -> identical for both web hands. w: overall weight, tuck: 0..1
  swingLegs(w, tuck, hand = "R") {
    if (w < 0.005) return;
    const b = this.b,
      rd = this.rd,
      L = rd.legLen,
      l1 = rd.l1,
      l2 = rd.l2;
    // targets from the pelvis centre (not each hip) so a rolled pelvis still gives legs exactly together
    const hL = b.pos("upperLegL", new THREE.Vector3()),
      hR = b.pos("upperLegR", new THREE.Vector3());
    const mid = hL.clone().add(hR).multiplyScalar(0.5);
    // tuck: spine curls a little (ball, refs 05-08) before the legs are placed
    if (tuck > 0.01) {
      b.rotE("spine", 0.3 * tuck * w, 0, 0);
      if (b.i("spine1") >= 0) b.rotE("spine1", 0.12 * tuck * w, 0, 0);
      /* rounder back (refs 05-08) */ mid
        .copy(b.pos("upperLegL", hL))
        .add(b.pos("upperLegR", hR))
        .multiplyScalar(0.5);
    }
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1;
      const hip = b.pos("upperLeg" + S, new THREE.Vector3());
      // per-hip frame (critic r3 #5: with a rolled pelvis, pelvis-centre targets lifted one knee alone); feet 7.5 cm off centre
      const foot0 = hip.clone();
      foot0.x = mid.x + sx * 0.075;
      // hang (critic r2 #3, no rigid plank): slight hip break (~10 deg) + ~15 deg knees, legs together
      // small natural offset (critic r6 #5): the web-hand-side leg trails 6 cm / bends a bit more (mirrors with the hand)
      const lead = (S === hand ? -1 : 1) * 0.07;
      // polish: a touch more knee bend (~22 deg) and the feet trailing slightly behind
      const hang = foot0
        .clone()
        .add(
          new THREE.Vector3(
            0,
            -L * 0.94 + Math.abs(lead) * 0.3 + (lead < 0 ? 0.02 : 0),
            L * 0.1 + lead,
          ),
        );
      // tuck (critic r2 #5/#6): thighs forward-up toward the chest, shins folded back under — both legs identical
      // polish: knees pulled higher toward the chest on the upswing tuck
      const th = new THREE.Vector3(0, 0.62, 1).normalize().multiplyScalar(l1),
        sh = new THREE.Vector3(0, -1, -0.4)
          .normalize()
          .multiplyScalar(l2 * 0.98);
      const tk = foot0.clone().add(th).add(sh);
      const ank = hang.lerp(tk, tuck);
      const knee = hip
        .clone()
        .lerp(ank, 0.5)
        .add(new THREE.Vector3(0, 0.25 * tuck, 0.5 + 0.2 * tuck));
      b.ik("leg", S, ank, knee, w, { absolute: true });
      // toes: relaxed point (continues the shin, a little forward); tucked -> more pointed
      const kp = b.pos("lowerLeg" + S, new THREE.Vector3()),
        ap = b.pos("foot" + S, new THREE.Vector3());
      const shin = ap.sub(kp).normalize();
      b.aim(
        "foot" + S,
        shin
          .multiplyScalar(0.7)
          .add(new THREE.Vector3(0, 0, lerp(0.7, 0.45, tuck)))
          .normalize(),
        w * 0.85,
      );
    }
  }
  // bind-space finger roots of a hand (index / middle / pinky first segments) + palm length, for the grip frame
  handKids(S) {
    const H = this._hk || (this._hk = {});
    if (H[S] !== undefined) return H[S];
    const sk = this.skel,
      h = sk.idx("hand" + S);
    let r = null;
    if (h >= 0) {
      const nm = (i) => sk.bones[i].name.toLowerCase(),
        kids = [];
      for (let i = 0; i < sk.N; i++) if (sk.parent[i] === h) kids.push(i);
      const idx = kids.find((i) => /index/.test(nm(i))),
        mid = kids.find((i) => /middle/.test(nm(i))),
        pin =
          kids.find((i) => /pinky/.test(nm(i))) ??
          kids.find((i) => /ring/.test(nm(i)));
      if (idx != null && mid != null && pin != null)
        r = {
          idx,
          mid,
          pin,
          len: sk
            .bP(mid, new THREE.Vector3())
            .distanceTo(sk.bP(h, new THREE.Vector3())),
        };
    }
    return (H[S] = r);
  }
  // Stacked two-handed grip (user r11 + refs 03-09). Both fists wrap the SAME line with the rope running across the fist
  // (fingers angled up-and-in, wrist out to its own shoulder's side, palm forward / knuckles back), the web fist slides
  // down toward the top of the head as the second hand joins, and the second fist sits directly below it on the line,
  // one fist height lower (touching, not interpenetrating — enforced by a joint-distance probe in twoHandIK).
  gripFrame(S, g, d, sh, fwd, beta = 0.85) {
    const hl = this.handKids(S)?.len ?? 0.09;
    const m = g.clone().sub(sh);
    m.addScaledVector(d, -m.dot(d));
    if (m.lengthSq() < 1e-8) m.set(S === "L" ? -1 : 1, 0, 0);
    m.normalize(); // shoulder side -> line
    // beta: fingers off the line toward the middle (the line crosses the fist, the wrist sits beside it). The web fist tilts
    // more (its wrist/forearm further out), the lower fist less (its knuckles never poke into the web forearm)
    const f = d
      .clone()
      .multiplyScalar(Math.cos(beta))
      .addScaledVector(m, Math.sin(beta))
      .normalize();
    const n = fwd.clone().addScaledVector(f, -fwd.dot(f));
    if (n.lengthSq() < 1e-6) n.copy(m).cross(f);
    n.normalize(); // palm forward
    const wrist = g
      .clone()
      .addScaledVector(f, -hl * 0.55)
      .addScaledVector(n, -0.02); // palm socket (rig.palmWorld) on the line
    return { f, n, wrist };
  }
  // Double-fist grip (user r12, replaces the stacked fists): both hands on ONE spot of the line, centred above the head.
  // The web fist wraps the line (palm forward, fingers up-and-in, wrist out to its own side); the second hand closes over
  // the web fist's fingers: its palm lies on their backs (offset along the web palm normal by line radius + finger
  // thickness), palm facing back toward them, fingers curling over, wrist out to the other side.
  overlapFrame(S, g, fw) {
    // covering hand (user r13): the MIRROR image of the web hand's grip across the body's sagittal plane (char x -> -x):
    // same side of the line, same palm facing, wrist on its own side — both hands grab the same spot of the rope from the
    // same side. It sits one finger-thickness in front (along the shared palm normal) so its fingers lie over the web
    // fist's knuckles/fingers: touching, not interpenetrating (probe-corrected via twoOffAdd).
    const hl = this.handKids(S)?.len ?? 0.09;
    const f = new THREE.Vector3(-fw.f.x, fw.f.y, fw.f.z).normalize();
    const n = new THREE.Vector3(-fw.n.x, fw.n.y, fw.n.z);
    n.addScaledVector(f, -n.dot(f)).normalize();
    // one compact lump (critic r6): same palm plane as the web fist, 4.5 cm lower on the line so its fingers lie over the web
    // fist's lower fingers (probe pushes it out along the palm normal by at most 1 cm)
    const sock = g
      .clone()
      .addScaledVector(n, this.twoOffAdd || 0)
      .addScaledVector(this._dLine || Y, -0.045);
    const wrist = sock
      .clone()
      .addScaledVector(f, -hl * 0.55)
      .addScaledVector(n, -0.02);
    return { f, n, wrist };
  }
  twoHandPlan(a) {
    const b = this.b,
      rd = this.rd,
      T = this.two;
    const sw0 = T.sw || { L: 0, R: 0 },
      F = Math.max(T.L, sw0.L) >= Math.max(T.R, sw0.R) ? "L" : "R",
      W = F === "L" ? "R" : "L";
    const ww = clamp(this.webWH[W] * 1.1, 0, 1);
    const w = smooth(T[F]) * ww,
      raw = (T.sp?.[F]?.x ?? T[F]) * ww;
    const sw = (T.sw?.[F] || 0) * ww; // let-go sweep weight (arm still procedural)
    if (w < 0.005 && sw < 0.005) return null;
    const Rr = rd.a1 + rd.a2;
    const shW = b.pos("upperArm" + W, new THREE.Vector3()),
      shF = b.pos("upperArm" + F, new THREE.Vector3());
    const M = shW.clone().add(shF).multiplyScalar(0.5);
    const d = a.clone().sub(M).normalize();
    if (d.y < 0.5) {
      d.y = 0.5;
      d.normalize();
    } // anchor never below/behind the overhead grip (joint limits)
    const u = shW.clone().sub(shF);
    u.addScaledVector(d, -u.dot(d)).normalize(); // toward the web side
    const fwd = new THREE.Vector3().crossVectors(u, d);
    if (fwd.z < 0) fwd.negate();
    this._dLine = d;
    const g1 = new THREE.Vector3();
    const frames = (t) => {
      // grip point on the line over the head centre at height t
      const g = g1.copy(M).addScaledVector(d, t); // one spot of the line, centred over the head
      const fw = this.gripFrame(W, g, d, shW, fwd, 1.35); // fingers nearly across the line: the web runs through the fist
      const fo = this.overlapFrame(F, g, fw);
      return { g: g.clone(), fw, fo };
    };
    const bis = (fn, lo, hi) => {
      for (let i = 0; i < 20; i++) {
        const m = (lo + hi) / 2;
        if (fn(m)) hi = m;
        else lo = m;
      }
      return (lo + hi) / 2;
    };
    // height: both wrists at <= 0.9 R (elbows slightly bent, ~130 deg); then lifted until fists + forearms clear the head
    // (grip centre >= head radius + fist + 6 cm from the head centre), capped at 0.99 R
    const reach = (t) => {
      const fr = frames(t);
      return Math.max(fr.fw.wrist.distanceTo(shW), fr.fo.wrist.distanceTo(shF));
    };
    let t = bis((tt) => reach(tt) > 0.9 * Rr, 0, 1.4);
    const hc = this.headCentre(new THREE.Vector3()),
      clr = 0.12 + 0.05 + 0.06;
    const tHead = bis(
      (tt) => {
        const g = frames(tt).g;
        return g.distanceTo(hc) >= clr && g.clone().sub(hc).dot(d) > 0;
      },
      0,
      1.4,
    );
    if (tHead > t)
      t = Math.min(
        tHead,
        bis((tt) => reach(tt) > 0.99 * Rr, 0, 1.4),
      );
    const fr = frames(t),
      sxW = W === "L" ? 1 : -1;
    // symmetric elbows: slightly bent, drawn back and in toward the ears
    const poleW = shW
      .clone()
      .lerp(fr.fw.wrist, 0.5)
      .add(new THREE.Vector3(sxW * 0.35, 0.05, -0.3));
    const poleF = shF
      .clone()
      .lerp(fr.fo.wrist, 0.5)
      .add(new THREE.Vector3(-sxW * 0.35, 0.05, -0.3));
    return {
      F,
      W,
      joining: T.on && T.hand === W,
      w,
      raw,
      sw,
      d,
      g: fr.g,
      tW: fr.fw.wrist,
      tF: fr.fo.wrist,
      fW: fr.fw.f,
      fF: fr.fo.f,
      pnW: fr.fw.n,
      pnF: fr.fo.n,
      poleW,
      poleF,
      shF,
    };
  }
  // closed fist around the web line (critic r1: rd.curl reads as a claw — weak knuckle flexion, thumb sticking out):
  // stronger MCP flexion, thumb folded over the index/middle. amount 0 = relaxed/open .. 1 = tight fist; w blends.
  fist(S, amount, w) {
    if (w <= 0.001) return;
    const F = this._fist || (this._fist = {});
    if (!F[S]) {
      const sk = this.skel;
      F[S] = this.rd.fingers[S].map((f) => {
        const n = sk.bones[f.i].name.toLowerCase(),
          seg = Math.max(0, +(n.match(/(\d)/)?.[1] || 1) - 1),
          thumb = /thumb/.test(n);
        const m = n.match(/^(thumb|index|middle|ring|pinky)/)?.[1] || "middle";
        const sgn = S === "L" ? 1 : -1;
        const a = thumb
          ? [1.05, 1.0, 0.9][seg]
          : [2.6, 1.8, 1.1][seg] *
            (m === "index" ? 0.9 : m === "pinky" ? 1.1 : 1);
        return { i: f.i, axis: f.axis, a: a * sgn };
      });
    }
    const pose = this.b.pose,
      q = new THREE.Quaternion(),
      q2 = new THREE.Quaternion(),
      q3 = new THREE.Quaternion();
    for (const f of F[S]) {
      this.skel.rest.getQ(f.i, q);
      q2.setFromAxisAngle(f.axis, f.a * amount);
      q.multiply(q2);
      if (w < 1) {
        pose.getQ(f.i, q3);
        q3.slerp(q, w);
        pose.setQ(f.i, q3);
      } else pose.setQ(f.i, q);
    }
    this.b.dirty = true;
  }
  // orient a gripping fist: fingers along f (wrist bend capped ~55 deg off the forearm), palm normal pN, curled; weight w
  gripHand(S, f0, pN, w, curl) {
    const b = this.b,
      hk = this.handKids(S),
      sx = S === "L" ? 1 : -1;
    const el = b.pos("lowerArm" + S, new THREE.Vector3()),
      wr = b.pos("hand" + S, new THREE.Vector3());
    const fa = wr.clone().sub(el).normalize();
    let f = f0.clone();
    const ang = fa.angleTo(f),
      maxA = 0.95;
    if (ang > maxA) {
      const ax = new THREE.Vector3().crossVectors(fa, f);
      if (ax.lengthSq() > 1e-8)
        f = fa.clone().applyAxisAngle(ax.normalize(), maxA);
    }
    if (hk) {
      const fc = b.pos(hk.mid, new THREE.Vector3()).sub(wr),
        ac = b
          .pos(hk.pin, new THREE.Vector3())
          .sub(b.pos(hk.idx, new THREE.Vector3()));
      const pc = new THREE.Vector3().crossVectors(ac, fc).multiplyScalar(sx);
      const R = frameRot(fc, pc, f, pN);
      if (w < 0.999) R.slerp(new THREE.Quaternion(), 1 - w); // partial rotation (continuous), not a local-space slerp
      b.setCQ(
        "hand" + S,
        b.cq("hand" + S, new THREE.Quaternion()).premultiply(R),
      );
    } else b.aim("hand" + S, f, w);
    this.fist(S, curl, w);
  }
  // second (free) hand: join / hold / let-go as a slerp of the FULL joint rotations between the free-arm (jump) pose and
  // the IK-solved grip pose (user r17: the grip's inward twist — upper-arm roll, forearm pro/supination, wrist — unwinds
  // gradually and ends exactly at the jump-arm twist; no position-IK re-solve, so no roll flips near a straight arm).
  // Shoulder leads, elbow then wrist follow (lagged weights); the eased weight carries a ~3 % arrival overshoot; the grip
  // curls over the last 30 % of the reach and on let-go the fingers open first.
  twoHandIK(pl) {
    const b = this.b,
      sk = this.skel,
      F = pl.F,
      W = pl.W,
      w2 = pl.w;
    const k = clamp(pl.raw, 0, 1.04);
    if (k < 0.003 && w2 < 0.003) return;
    const ids = ["upperArm" + F, "lowerArm" + F, "hand" + F].map((n) => b.i(n)),
      fing = this.rd.fingers[F].map((f) => f.i);
    const q0 = ids.map((i) => b.pose.getQ(i, new THREE.Quaternion())),
      f0 = fing.map((i) => b.pose.getQ(i, new THREE.Quaternion()));
    const grip = (tF) => {
      for (let j = 0; j < 3; j++) b.pose.setQ(ids[j], q0[j]);
      b.dirty = true;
      b.ik("arm", F, tF, pl.poleF, 1, { absolute: true });
      this.gripHand(F, pl.fF, pl.pnF, 1, 1.15);
    };
    // the grip is re-solved only while swinging and joining / holding; on let-go (and after release, when a release flip
    // spins the body against the anchor) the last solved grip rotations are reused — re-solving against a web that is being
    // let go of flipped the arm in one frame (round-9 in-game scrub, release tuck-flip)
    const TG = this._twoGrip || (this._twoGrip = {});
    let q1, f1;
    if ((pl.joining && this.A?.mode === "swing") || !TG[F]) {
      grip(pl.tF);
      // contact probe on the full grip: touch the web fist without sinking in (push out along the palm normal, <= 1 cm)
      const pr = this.twoProbe(F, W);
      this.twoProbeD = pr;
      if (pr < -0.015) {
        const need = -pr - 0.012;
        this.twoOffAdd = Math.min(0.01, (this.twoOffAdd || 0) + need);
        grip(pl.tF.clone().addScaledVector(pl.pnW, need));
      } else if (pr > -0.006 && (this.twoOffAdd || 0) > 0)
        this.twoOffAdd = Math.max(0, this.twoOffAdd - 0.001);
      q1 = ids.map((i) => b.pose.getQ(i, new THREE.Quaternion()));
      f1 = fing.map((i) => b.pose.getQ(i, new THREE.Quaternion()));
      TG[F] = { q: q1.map((q) => q.clone()), f: f1.map((q) => q.clone()) };
    } else {
      q1 = TG[F].q.map((q) => q.clone());
      f1 = TG[F].f.map((q) => q.clone());
    }
    const kj = [
      Math.pow(k, 0.8),
      Math.min(k, 1) ** 1.25 * (k > 1 ? k : 1),
      Math.min(k, 1) ** 1.6,
    ]; // shoulder, elbow, wrist
    for (let j = 0; j < 3; j++) {
      const q = q0[j].clone();
      if (q.dot(q1[j]) < 0) q1[j].set(-q1[j].x, -q1[j].y, -q1[j].z, -q1[j].w);
      q.slerp(q1[j], kj[j]);
      b.pose.setQ(ids[j], q);
    }
    const cw = smooth((Math.min(k, 1) - 0.7) / 0.3);
    for (let j = 0; j < fing.length; j++)
      b.pose.setQ(fing[j], f0[j].clone().slerp(f1[j], cw));
    b.dirty = true;
  }
  // head sphere centre (char space): ~0.1 m up the head bone from the skull base
  headCentre(out) {
    const b = this.b,
      h = b.pos("head", out),
      hq = b
        .cq("head", new THREE.Quaternion())
        .multiply(this.skel.bQ(b.i("head"), new THREE.Quaternion()).invert());
    return h.add(new THREE.Vector3(0, 0.1, 0.02).applyQuaternion(hq));
  }
  // min distance (m) between the second hand (wrist, knuckles, finger joints) and the web hand + its forearm (segments),
  // minus rough bone radii (fist ~2 cm, forearm ~3 cm)
  twoProbe(F, W) {
    const b = this.b,
      sk = this.skel;
    const nm = (i) => sk.bones[i].name;
    const pts = [[b.pos("hand" + F, new THREE.Vector3()), "hand" + F, 0.025]];
    for (const f of this.rd.fingers[F])
      pts.push([b.pos(f.i, new THREE.Vector3()), nm(f.i), 0.009]);
    const segs = [
      [
        b.pos("lowerArm" + W, new THREE.Vector3()),
        b.pos("hand" + W, new THREE.Vector3()),
        0.03,
        "forearm" + W,
      ],
    ];
    for (const f of this.rd.fingers[W]) {
      const c = sk.child[f.i];
      segs.push([
        b.pos(f.i, new THREE.Vector3()),
        b.pos(c >= 0 ? c : f.i, new THREE.Vector3()),
        0.009,
        nm(f.i),
      ]);
    }
    segs.push([
      b.pos("hand" + W, new THREE.Vector3()),
      b.pos(this.handKids(W)?.mid ?? "hand" + W, new THREE.Vector3()),
      0.025,
      "palm" + W,
    ]);
    const ab = new THREE.Vector3(),
      ap = new THREE.Vector3(),
      c = new THREE.Vector3();
    let best = Infinity;
    for (const [p, pn, pr] of pts)
      for (const [s0, s1, r, sn] of segs) {
        ab.subVectors(s1, s0);
        const L2 = ab.lengthSq();
        const t =
          L2 > 1e-10 ? clamp(ap.subVectors(p, s0).dot(ab) / L2, 0, 1) : 0;
        c.copy(s0).addScaledVector(ab, t);
        const dd = p.distanceTo(c) - r - pr;
        if (dd < best) {
          best = dd;
          this.twoProbeWho = pn + "~" + sn;
        }
      }
    // head (critic r3 #1): reported separately (the plan keeps it clear; this is the check)
    const hc = this.headCentre(new THREE.Vector3());
    let hd = Infinity;
    for (const [p, , pr] of pts)
      hd = Math.min(hd, p.distanceTo(hc) - 0.12 - pr);
    for (const S of [W, F]) {
      // both fists + forearms (sampled) vs the head
      const e = b.pos("lowerArm" + S, new THREE.Vector3()),
        wr = b.pos("hand" + S, new THREE.Vector3());
      for (const k of [0, 0.33, 0.66, 1])
        hd = Math.min(
          hd,
          e.clone().lerp(wr, k).distanceTo(hc) - 0.12 - lerp(0.04, 0.03, k),
        );
      for (const f of this.rd.fingers[S])
        hd = Math.min(
          hd,
          b.pos(f.i, new THREE.Vector3()).distanceTo(hc) - 0.12 - 0.01,
        );
    }
    this.twoHeadD = hd;
    return best;
  }
  // world-space rope tail for web.js: the strand runs from the lower (second) fist up through the web fist to the anchor
  ropeTail(A) {
    const hand = A.swing?.hand || "R",
      F = hand === "L" ? "R" : "L",
      anc = A.swing?.anchor;
    const w =
      A.mode === "swing" && anc
        ? smooth(this.two[F]) * clamp(this.webWH[hand] * 1.1, 0, 1)
        : 0;
    if (w < 0.005 || !this.rig.palmWorld) {
      ropeGrip.w = 0;
      return;
    }
    const p1 = this.rig.palmWorld(hand, _v),
      p2 = this.rig.palmWorld(F, _v2);
    const d = _v3.copy(anc).sub(p1).normalize();
    const s = Math.min(0.03, Math.max(0, _v4.copy(p1).sub(p2).dot(d))); // double fist: both on one spot (no long tail)
    ropeGrip.off.copy(d).multiplyScalar(-s);
    ropeGrip.w = w;
  }
  postSecondary(dt, A, top) {
    // legs + free arm react to acceleration during swings / air (body-space inertia)
    const inAir = A.mode === "swing" || A.mode === "air" || A.mode === "zip";
    const acc = this.dirToChar(this.accel, _v).multiplyScalar(inAir ? 1 : 0);
    acc.clampLength(0, 40);
    const s = this.legSpring.step(
      _v2.set(-acc.x * 0.012, 0, -acc.z * 0.012),
      dt,
    );
    const a = this.armSpring.step(
      _v3.set(-acc.x * 0.018, 0, -acc.z * 0.02),
      dt,
    );
    if (!inAir && s.lengthSq() < 1e-6) return;
    const b = this.b;
    const lx = clamp(s.x, -0.35, 0.35),
      lz = clamp(s.z, -0.4, 0.4);
    for (const S of ["L", "R"]) {
      b.rotE("upperLeg" + S, -lz, 0, lx);
      b.rotE("lowerLeg" + S, lz * 0.4, 0, 0);
    }
    const free =
      A.mode === "swing" ? ((A.swing?.hand || "R") === "R" ? "L" : "R") : null;
    for (const S of free ? [free] : ["L", "R"]) {
      // arms still on the line (web grip / two-handed second grip, incl. the release fade) stay on it: no pop at release
      const fk =
        (1 - Math.max(smooth(this.two[S]), this.two.sw?.[S] || 0)) *
        (A.mode === "swing" ? 1 : 1 - this.webWH[S]);
      b.rotE(
        "upperArm" + S,
        -clamp(a.z, -0.5, 0.5) * fk,
        0,
        clamp(a.x, -0.4, 0.4) * fk,
      );
    }
  }
  postLook(dt, A, w) {
    let yaw = 0,
      pitch = 0;
    const ld = A.lookDir;
    if (ld && w > 0.01) {
      const d = this.dirToChar(ld, _v);
      // only look toward directions in front hemisphere; fade out behind
      yaw = Math.atan2(d.x, d.z);
      pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
      const behind = smooth((Math.abs(yaw) - 1.6) / 0.6);
      yaw = clamp(yaw, -1.2, 1.2) * (1 - behind);
      pitch = clamp(pitch, -0.6, 0.7) * (1 - behind);
    }
    const y = this.look.yaw.step(yaw * w, dt),
      p = this.look.pitch.step(pitch * w, dt);
    if (Math.abs(y) + Math.abs(p) < 1e-3) return;
    const b = this.b;
    // distribute: spine1 15%, chest 20%, neck 30%, head 35% (applied in character space about body-up)
    const upAxis = b.cq("chest", new THREE.Quaternion());
    const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(
      upAxis.multiply(
        this.skel.bQ(b.i("chest"), new THREE.Quaternion()).invert(),
      ),
    );
    for (const [k, f] of [
      ["spine1", 0.15],
      ["chest", 0.2],
      ["neck", 0.3],
      ["head", 0.35],
    ]) {
      if (b.i(k) < 0) continue;
      b.rot(k, ax, y * f);
      const hq = b
        .cq(k, new THREE.Quaternion())
        .multiply(this.skel.bQ(b.i(k), new THREE.Quaternion()).invert());
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(hq);
      if (k === "neck" || k === "head")
        b.rot(k, side, p * (k === "head" ? 0.6 : 0.4));
    }
  }
  postBreath(dt, A, top) {
    const exert = clamp((this.runSpeedMem || 0) / 12, 0, 1);
    const f = lerp(0.28, 0.55, exert),
      amp =
        lerp(0.012, 0.028, exert) *
        (top.name === "ground" && this.speedH < 1
          ? 1
          : top.name === "perch" || top.name === "rope"
            ? 1
            : 0.3);
    const s = Math.sin(this.time * TAU * f);
    this.b.rotE("chest", -s * amp, 0, 0);
    if (this.b.i("shoulderL") >= 0) {
      this.b.rotE("shoulderL", 0, 0, s * amp * 0.5);
      this.b.rotE("shoulderR", 0, 0, -s * amp * 0.5);
    }
    // landing impact spring (light landings without a clip switch): pelvis dip + knee bend via foot IK below
    this.impact.step(0, dt);
  }
  postFeet(dt, A, w) {
    const b = this.b,
      rd = this.rd;
    const dip = clamp(this.impact.x, -0.25, 0.05);
    if (w < 0.02 && Math.abs(dip) < 1e-3) {
      this.pelvisOff = damp(this.pelvisOff, 0, 10, dt);
      return;
    }
    const world = this.world;
    const O = this.visP,
      R = this.visQ;
    // world "up" in char space (to test uprightness)
    const upC = this.dirToChar(UP, _v4);
    const upright = upC.y > 0.85;
    const offs = { L: 0, R: 0 },
      ank = {},
      plantW = {};
    for (const S of ["L", "R"]) {
      const a = b.pos("foot" + S, new THREE.Vector3());
      ank[S] = a;
      const lift = Math.max(0, a.y - rd.ankleH);
      plantW[S] = 1 - smooth(lift / 0.25);
      let off = 0;
      if (upright && world?.raycast && w > 0.02) {
        const wp = _v.copy(a).applyMatrix4(this.charToWorld);
        const h = world.raycast(
          _v2.set(wp.x, O.y + 0.6, wp.z),
          _v3.set(0, -1, 0),
          1.6,
        );
        if (h && h.normal.y > 0.5) {
          let gy = h.point.y;
          if (h.normal.y < 0.995) {
            // sloped: heel/toe probes so the lower heel never sinks into the incline
            const fq = b.cq("foot" + S, _q),
              fw = _v3.set(0, 0, 1).applyQuaternion(fq);
            fw.y = 0;
            if (fw.lengthSq() > 1e-4) fw.normalize();
            else fw.set(0, 0, 1);
            for (const d of [0.14, -0.07]) {
              const pw = _v
                .copy(a)
                .addScaledVector(fw, d)
                .applyMatrix4(this.charToWorld);
              const h2 = world.raycast(
                _v2.set(pw.x, O.y + 0.6, pw.z),
                _v4.set(0, -1, 0),
                1.6,
              );
              if (h2 && h2.normal.y > 0.5)
                gy = Math.max(gy, h2.point.y - Math.abs(d) * 0.35); // tilted foot covers ~1/3 of the rise
            }
          }
          off = clamp(gy - O.y, -0.45, 0.35);
          this.footN[S].lerp(
            this.dirToChar(h.normal, _v2),
            1 - Math.exp(-15 * dt),
          ).normalize();
        } else this.footN[S].lerp(Y, 1 - Math.exp(-10 * dt)).normalize();
      } else this.footN[S].lerp(Y, 1 - Math.exp(-10 * dt)).normalize();
      this.footOff[S] = damp(this.footOff[S], off, 18, dt);
      offs[S] = this.footOff[S];
    }
    // pelvis goes down to let the lower foot reach, never up past the higher (small allowance)
    const pTarget = clamp(Math.min(offs.L, offs.R), -0.45, 0.08) * w;
    this.pelvisOff = damp(this.pelvisOff, pTarget, 12, dt);
    const pOff = this.pelvisOff + dip;
    if (Math.abs(pOff) > 1e-4) b.moveHips(0, pOff, 0);
    for (const S of ["L", "R"]) {
      const tgt = ank[S].clone();
      tgt.y += offs[S] * w;
      if (A.grounded) tgt.y = Math.max(tgt.y, rd.ankleH * 0.97 + offs[S] * w); // no sinking on impact frames
      // keep lifted feet lifted relative to their own ground (weight by plant)
      const knee = b.pos("lowerLeg" + S, new THREE.Vector3()),
        hip = b.pos("upperLeg" + S, new THREE.Vector3());
      const pole = knee
        .clone()
        .add(
          knee
            .clone()
            .sub(hip.clone().add(ank[S]).multiplyScalar(0.5))
            .normalize()
            .multiplyScalar(0.5),
        );
      const fq = b.cq("foot" + S, new THREE.Quaternion());
      b.ik("leg", S, tgt, pole, 1, { absolute: false });
      b.setCQ("foot" + S, fq);
      // align planted foot with the ground normal
      const n = this.footN[S];
      if (n.y < 0.9999) {
        _q.setFromUnitVectors(Y, n);
        const aq = fq.clone().premultiply(_q);
        b.setCQ("foot" + S, fq.slerp(aq, plantW[S] * w));
      }
    }
  }
  // ---------------------------------------------------------------- helpers for nodes
  // Procedural pose (rig.js POSES library) when a clip is missing: posed on the bones from rest, read back.
  fallback(kind, arg, out) {
    const fn = this.poses?.[kind];
    this.skel.apply(this.skel.rest);
    if (fn) {
      this.rig.object.updateMatrixWorld(true);
      this.rig.applyPose(fn(arg), 1);
    }
    this.skel.read(out);
    this.b.dirty = true;
    return out;
  }
  // One-shot full-body (or masked) clip overlay, e.g. combat moves: rig.play(name) routes here while the
  // animation layer owns the skeleton. opts: { fade=0.12, fadeOut=0.2, timeScale=1, mask:'upper'|'arms'|null, loop=false }
  playOneShot(
    name,
    {
      fade = 0.12,
      fadeOut = 0.2,
      timeScale = 1,
      mask = null,
      loop = false,
      restart = false,
    } = {},
  ) {
    if (!this.clips.has(name)) return false;
    // repeated calls (per-frame play()) keep a looping overlay alive and never restart a running one-shot
    if (this.shot && this.shot.name === name && !this.shot.stop && !restart) {
      this.shot.keep = this.time;
      this.shot.ts = timeScale;
      return true;
    }
    this.shot = {
      name,
      t: 0,
      fade,
      fadeOut,
      ts: timeScale,
      loop,
      keep: this.time,
      mask: mask ? this.maskFor(mask) : null,
      dur: this.clips.dur(name),
      stop: false,
    };
    return true;
  }
  stopOneShot() {
    if (this.shot) this.shot.stop = true;
  }
  // per-blend-site hemisphere memory (skeleton.blendPoses `mem`, user r-anim6: no instant arm / leg flips)
  bm(id) {
    const M = this._bm || (this._bm = new Map());
    let m = M.get(id);
    if (!m) M.set(id, (m = new Int8Array(this.skel.N)));
    return m;
  }
  maskFor(kind) {
    const m = new Float32Array(this.skel.N),
      S = this.skel;
    const under = (i, root) => {
      while (i >= 0) {
        if (i === root) return true;
        i = S.parent[i];
      }
      return false;
    };
    const roots =
      kind === "arms"
        ? ["shoulderL", "shoulderR", "upperArmL", "upperArmR"]
        : kind === "legs"
          ? ["upperLegL", "upperLegR"]
          : ["spine"];
    for (let i = 0; i < S.N; i++)
      for (const r of roots) {
        const ri = S.idx(r);
        if (ri >= 0 && under(i, ri)) m[i] = 1;
      }
    return m;
  }
  applyOneShot(dt, out) {
    const sh = this.shot;
    if (!sh) return;
    sh.t += dt * sh.ts;
    const end = sh.loop ? Infinity : sh.dur;
    if (sh.loop && this.time - sh.keep > 0.25) sh.stop = true; // looping overlays need a per-frame play() keep-alive
    if (sh.stop && sh.stopT == null) sh.stopT = sh.t;
    let w = smooth(sh.t / Math.max(sh.fade, 1e-3));
    if (!sh.loop)
      w *= 1 - smooth((sh.t - (end - sh.fadeOut)) / Math.max(sh.fadeOut, 1e-3));
    if (sh.stopT != null)
      w *= 1 - smooth((sh.t - sh.stopT) / Math.max(sh.fadeOut, 1e-3));
    if (sh.t >= end || (sh.stopT != null && sh.t - sh.stopT >= sh.fadeOut)) {
      this.shot = null;
      return;
    }
    this.clips.sample(sh.name, sh.t, this.P.e, { loop: sh.loop });
    blendPoses(out, this.P.e, w, out, sh.mask, this.bm(3));
    this.debug.shot = sh.name;
  }
  sample(n, t, out, opts) {
    return this.clips.sample(n, t, out, opts);
  }
  mirror(pose) {
    this.skel.mirrorPose(pose, this.P.mir);
    pose.copy(this.P.mir);
    this.b.dirty = true;
    return pose;
  }
  // phase-aligned locomotion blend space at the current loco phase
  locoPose(out, v, ovr = null) {
    const C = this.clips;
    const avail = LOCO.filter(([n]) => C.has(n));
    if (!avail.length) {
      // procedural fallback gait
      out.copy(this.skel.rest);
      this.b.begin(out);
      this.gait.phase = this.locoPhase;
      this.gait.advance(0, v);
      this.gait.build(this.b);
      this.rd.curl(out, "L", 0.45);
      this.rd.curl(out, "R", 0.45);
      this.locoInfo = { rate: this.gait.f, k: 1 };
      return out;
    }
    let i = 0;
    while (i < avail.length - 2 && v > avail[i + 1][1]) i++;
    const A0 = avail[i],
      A1 = avail[Math.min(i + 1, avail.length - 1)];
    const w = A0 === A1 ? 0 : smooth((v - A0[1]) / (A1[1] - A0[1]));
    const m0 = this.locoMeta(A0[0]),
      m1 = this.locoMeta(A1[0]);
    const ph = this.locoPhase;
    C.sample(A0[0], ((ph + m0.phase0) % 1) * m0.dur, this.P.a);
    if (w > 0.001) {
      C.sample(A1[0], ((ph + m1.phase0) % 1) * m1.dur, this.P.b);
      blendPoses(this.P.a, this.P.b, w, out, null, this.bm(4));
    } else out.copy(this.P.a);
    // cadence & stride: natural speed/cadence of the blend, then split the speed ratio between rate and stride
    const vN = lerp(m0.v, m1.v, w),
      fN = lerp(1 / m0.dur, 1 / m1.dur, w);
    const ratio = Math.max(v, 0.05) / Math.max(vN, 0.1);
    // user r9i: at running speeds split more of the speed into STRIDE and less into cadence -> the body cycles slower
    // (calmer, more powerful) at the same ground speed
    const runK = smooth((v - 5) / 3);
    let k = clamp(
      Math.pow(ratio, lerp(0.32, 0.6, runK)),
      0.75,
      lerp(1.2, 1.42, runK),
    ); // walk: mostly cadence
    let rate = clamp(ratio / k, 0.55, 2.2);
    // user r12: natural WALK cadence below ~1.8 m/s (human data: ~1.87 steps/s at 1.4 m/s, 1.65 at 1.0, ~1.4 at 0.6):
    // cycle Hz = 0.535 + 0.285 v, the rest of the speed goes into stride (short steps when slow). Blended in log space so
    // k * rate * vN == v always holds (the feet never slide), fading back into the jog/run split by ~3.4 m/s.
    const wkC = 1 - smooth((v - 1.8) / 1.6);
    if (wkC > 1e-3) {
      const kW = clamp(ratio / ((0.535 + 0.285 * v) / fN), 0.3, 1.3);
      k = Math.exp(lerp(Math.log(k), Math.log(kW), wkC));
      rate = ratio / k;
    }
    if (ovr) {
      k = ovr.k;
      rate = ovr.rate / fN;
    } // walk stop step: stride + cadence chosen by the ground node
    this.locoInfo = { rate: fN * rate, k, vN, clipA: A0[0], clipB: A1[0], w };
    if (Math.abs(k - 1) > 0.02) this.strideWarp(out, k);
    return out;
  }
  // loco clip analysis; the walk's natural speed is re-measured on the FLAT stance only (the heel-strike / toe-off roll moves
  // the ankle while the median window still counts it as planted -> ~9 % stance slide at 1.4 m/s before r12)
  locoMeta(n) {
    const m = this.clips.loco(n);
    if (n !== "walk" || !m) return m;
    if (this._walkMeta) return this._walkMeta;
    const C = this.clips,
      P = this.P.tmp,
      sk = this.skel,
      fl = sk.idx("footL"),
      N = 120,
      ys = [],
      zs = [];
    for (let j = 0; j < N; j++) {
      C.sample(n, (m.dur * j) / N, P);
      sk.fk(P);
      ys.push(sk.cp[fl * 3 + 1]);
      zs.push(sk.cp[fl * 3 + 2]);
    }
    const mn = Math.min(...ys),
      vs = [];
    for (let j = 0; j < N; j++) {
      const b = (j + 1) % N;
      if (ys[j] < mn + 0.006 && ys[b] < mn + 0.006)
        vs.push((zs[j] - zs[b]) / (m.dur / N));
    }
    vs.sort((x, y) => x - y);
    const v = vs.length > 4 ? Math.abs(vs[vs.length >> 1]) : m.v;
    // passing phases (feet side by side, one foot swinging through): the walk start / stop poses closest to idle
    let best = 0,
      bestE = 1e9;
    for (let j = 0; j < N; j++) {
      C.sample(n, (m.dur * j) / N, P);
      sk.fk(P);
      const dz = Math.abs(sk.cp[fl * 3 + 2] - sk.cp[sk.idx("footR") * 3 + 2]),
        up = sk.cp[fl * 3 + 1] - sk.cp[sk.idx("footR") * 3 + 1];
      if (up > 0.01 && dz < bestE) {
        bestE = dz;
        best = j / N;
      }
    }
    const pass = (((best - m.phase0) % 1) + 1) % 1; // in loco phase (0 = L touchdown): L swinging past R
    return (this._walkMeta = { ...m, v, pass });
  }
  // user r12: natural walk form on top of the walk clip (w = walk weight). The clip was authored for the pre-v7 legs (h0
  // 0.905, legs since +4.5 cm) and read as a crouched, bent-knee walk. The pelvis rises as far as the legs allow: capped
  // near the standing height, and per foot so the leg is at most ~98.7 % extended (slight knee bend on contact). That
  // is the inverted-pendulum walk: tall at mid-stance, lowest in double support -> the natural hip / head bob. Feet keep
  // their exact positions + orientations (heel strike / toe-off roll from the clip), so contacts and slide are unchanged.
  // Plus a soft lateral hip sway over the stance foot and a slight pelvic drop on the swing side.
  walkForm(pose, w) {
    if (w < 0.01) return;
    const b = this.b.begin(pose),
      rd = this.rd;
    const T =
      this._wf ||
      (this._wf = {
        a: { L: new THREE.Vector3(), R: new THREE.Vector3() },
        q: { L: new THREE.Quaternion(), R: new THREE.Quaternion() },
        h: new THREE.Vector3(),
        k: new THREE.Vector3(),
      });
    for (const S of ["L", "R"]) {
      b.pos("foot" + S, T.a[S]);
      b.cq("foot" + S, T.q[S]);
    }
    const hy = b.pos("hips", T.h).y;
    const cap = rd.hipY - 0.006 - hy; // ~standing hips height (mid-stance is the tallest point of a walk)
    const Lmax = rd.legLen * 0.99;
    const aMin = Math.min(T.a.L.y, T.a.R.y);
    const smin = (a, c, r = 0.02) => {
      const hh = clamp(0.5 + (0.5 * (c - a)) / r, 0, 1);
      return lerp(c, a, hh) - r * hh * (1 - hh);
    };
    let raise = cap;
    for (const S of ["L", "R"]) {
      const hp = b.pos("upperLeg" + S, T.h),
        a = T.a[S];
      const d2 = (hp.x - a.x) ** 2 + (hp.z - a.z) ** 2;
      // a trailing foot already rolling onto its toes (heel up, unloading) may be reached with a straighter knee / a
      // little extra heel rise: it must not pull the pelvis down (that read as a deep dip at every toe-off)
      const relax =
        a.z < hp.z ? 0.035 * smooth((a.y - aMin - 0.015) / 0.045) : 0;
      raise = smin(
        raise,
        a.y + Math.sqrt(Math.max(0, Lmax * Lmax - d2)) - hp.y + relax,
      );
    }
    raise = Math.max(0, raise) * w;
    // sway toward the stance foot (the lower one), pelvis drops slightly on the swing side
    const st = clamp((T.a.R.y - T.a.L.y) / 0.05, -1, 1); // + = left foot planted, right swinging
    const sway = 0.016 * st * w;
    b.moveHips(sway, raise, 0);
    b.rot("hips", Z, -0.035 * st * w);
    b.rot("spine", Z, 0.02 * st * w);
    b.rot("chest", Z, 0.015 * st * w);
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1,
        knee = b.pos("lowerLeg" + S, T.k);
      b.ik("leg", S, T.a[S], knee.add(_v4.set(sx * 0.02, 0, 0.4)), 1, {
        absolute: false,
      });
      b.setCQ("foot" + S, T.q[S]);
    }
    this.walkRaise = raise;
    if (globalThis.__wfdbg)
      console.log(
        "[lab] wf ph " +
          this.locoPhase.toFixed(2) +
          " hy " +
          hy.toFixed(3) +
          " cap " +
          cap.toFixed(3) +
          " raise " +
          raise.toFixed(3) +
          " hipY " +
          rd.hipY.toFixed(3) +
          " legLen " +
          rd.legLen.toFixed(3) +
          " ankL " +
          T.a.L.y.toFixed(3) +
          " " +
          T.a.L.z.toFixed(2) +
          " ankR " +
          T.a.R.y.toFixed(3) +
          " " +
          T.a.R.z.toFixed(2),
      );
  }
  // ---- web-zip phase weights (0..1, all continuous). Uses explicit traversal subs when present
  // (zipFire | zipYank | zipTravel/zipFlight | zipCatch), otherwise times the sequence off the zip clock.
  zipPhases(L, A) {
    const sub = A.sub || "",
      zt = clamp(A.zip?.t ?? 0, 0, 1);
    const travel =
      sub === "zipTravel" ||
      sub === "zipFlight" ||
      sub === "zipCatch" ||
      zt > 0.001;
    if (travel && L.data.travelT == null) L.data.travelT = L.t;
    const tt = L.t;
    const fire = smooth(tt / 0.07);
    // yank: starts once the webs have landed (~0.08 s); elastic snap with a slight overshoot
    let yu =
      sub === "zipYank"
        ? Math.max(clamp((A.t ?? 0) / 0.12, 0, 1), 0.2)
        : clamp((tt - 0.075) / 0.13, 0, 1);
    if (travel)
      yu = Math.max(yu, clamp((tt - L.data.travelT) / 0.08 + 0.6, 0, 1));
    const y =
      yu <= 0 ? 0 : 1 + 2.2 * Math.pow(yu - 1, 3) + 1.2 * Math.pow(yu - 1, 2); // easeOutBack
    const g = travel
      ? Math.max(
          smooth((tt - L.data.travelT - 0.02) / 0.16),
          smooth((zt - 0.04) / 0.16),
        )
      : 0;
    // user feedback #17: stay streamlined until right at the anchor, then a short catch (~0.2 s) into the perch
    const dT =
      A.zip?.target && this.io?.center
        ? Math.max(
            0,
            this.io.center.distanceTo(A.zip.target) - (this.io.H ?? 0.95),
          )
        : 99;
    const sp = Math.max(4, A.velocity ? A.velocity.length() : 10);
    const Zs = window.__trav?.s?.zip;
    const rem =
      Zs && Zs.dur > 0 && A.mode === "zip"
        ? (1 - clamp(Zs.u ?? zt, 0, 1)) * Zs.dur
        : dT / sp;
    let c = travel ? smooth(1 - rem / 0.22) : 0; // (r10: the fast flight lasts ~0.3-0.5 s: catch only in its last 0.22 s)
    c = L.data.cMax = Math.max(L.data.cMax || 0, c); // monotonic: never flips back to flight
    L.data.ph = { f: fire, y, g, c };
    L.data.clip =
      c > 0.5
        ? "zip:catch"
        : g > 0.5
          ? "zip:flight"
          : y > 0.5
            ? "zip:yank"
            : "zip:fire";
  }
  // Web-zip from the authored clips (webZipFire -> webZipYank -> zipFlight -> zipCatch -> perchLand), blended by the
  // continuous phase weights; the fire arms are re-aimed at the real target, grounded starts keep the feet planted.
  zipPose(out, L, A) {
    const C = this.clips;
    if (
      !(
        C.has("webZipFire") &&
        C.has("webZipYank") &&
        C.has("zipFlight") &&
        C.has("zipCatch")
      )
    )
      return this.zipProcPose(out, L, A);
    const Z = L.data.ph,
      D = L.data;
    if (A.sub === "zipYank" && D.yankT0 == null) D.yankT0 = L.t;
    if (A.sub === "zipCatch" && D.catchT0 == null) D.catchT0 = L.t;
    const P = this.P;
    C.sample(
      "webZipFire",
      Math.min(L.t + 0.04, C.dur("webZipFire") - 1e-3),
      out,
      { loop: false },
    );
    const y = clamp(Z.y, 0, 1);
    if (y > 1e-3) {
      C.sample(
        "webZipYank",
        Math.min(
          D.yankT0 != null ? L.t - D.yankT0 : 0.06 * y,
          C.dur("webZipYank") - 1e-3,
        ),
        P.c,
        { loop: false },
      );
      blendPoses(out, P.c, y, out, null, this.bm(5));
    }
    if (Z.g > 1e-3) {
      C.sample("zipFlight", D.travelT != null ? L.t - D.travelT : 0, P.c);
      // level variant (authored face-down for an upright frame) only matters when the frame is not fully tilted
      blendPoses(out, P.c, Z.g, out, null, this.bm(6));
    }
    if (Z.c > 1e-3) {
      const cd = C.dur("zipCatch");
      const u = Math.max(Z.c, A.mode !== "zip" ? 1 : 0);
      const cn = C.first("zipCatchLevel", "zipCatch"),
        cdd = C.dur(cn);
      C.sample(cn, Math.min(u, 1) * (cdd - 1e-3), P.c, { loop: false });
      blendPoses(out, P.c, Z.c, out, null, this.bm(7));
    }
    const b = this.b.begin(out),
      rd = this.rd;
    // fire: both arms thrust at the actual target (clip arms point along +Z)
    const wa = clamp(Z.f, 0, 1) * (1 - y) * (1 - Z.g);
    const tgt = A.zip?.target;
    if (wa > 0.01 && tgt && this.charToWorld) {
      const K =
        this._zk2 ||
        (this._zk2 = {
          t: new THREE.Vector3(),
          d: new THREE.Vector3(),
          h: new THREE.Vector3(),
          e: new THREE.Vector3(),
        });
      this.worldToChar(tgt, K.t);
      for (const S of ["L", "R"]) {
        const sx = S === "L" ? 1 : -1,
          sh = b.pos("upperArm" + S, new THREE.Vector3());
        const d = K.d.copy(K.t).sub(sh);
        d.z = Math.max(d.z, 0.3 * d.length());
        d.normalize();
        const hnd = K.h.copy(sh).addScaledVector(d, (rd.a1 + rd.a2) * 0.96);
        hnd.x = lerp(hnd.x, 0, 0.25);
        const el = K.e
          .copy(sh)
          .addScaledVector(d, 0.25)
          .add(_v4.set(sx * 0.25, -0.2, -0.1));
        b.ik("arm", S, hnd, el, wa, { absolute: true });
        b.aim("hand" + S, d, wa);
      }
    }
    // grounded start: planted staggered stance, coil = hips drop on the yank
    const gw = D.gw || 0;
    if (gw > 1e-3) {
      b.moveHips(0, -gw * (0.04 + 0.12 * y), -gw * 0.05 * y);
      for (const S of ["L", "R"]) {
        const sx = S === "L" ? 1 : -1,
          th = rd.thigh[S];
        const fq = b.cq("foot" + S, new THREE.Quaternion());
        b.ik(
          "leg",
          S,
          _v4.set(sx * 0.14, rd.ankleH, S === "L" ? 0.12 : -0.14),
          new THREE.Vector3(sx * 0.3, th.y - 0.2, 0.9),
          gw,
          { absolute: true },
        );
        b.setCQ("foot" + S, fq);
        b.fromBind("foot" + S, QI, gw);
      }
    }
    D.clip =
      Z.c > 0.5
        ? "zipCatch"
        : Z.g > 0.5
          ? "zipFlight"
          : y > 0.5
            ? "webZipYank"
            : "webZipFire";
  }
  zipProcPose(out, L, A) {
    const Z = L.data.ph,
      rd = this.rd,
      hy = rd.hipY,
      ll = rd.legLen;
    const K =
      this._zk ||
      (this._zk = {
        h: { L: new THREE.Vector3(), R: new THREE.Vector3() },
        e: { L: new THREE.Vector3(), R: new THREE.Vector3() },
        a: { L: new THREE.Vector3(), R: new THREE.Vector3() },
        k: { L: new THREE.Vector3(), R: new THREE.Vector3() },
        d: new THREE.Vector3(),
        t: new THREE.Vector3(),
        t2: new THREE.Vector3(),
        sh: new THREE.Vector3(),
      });
    // direction to the web target in character space (for the FIRE arms), kept in the front hemisphere
    const tgt = A.zip?.target;
    const d = K.d.set(0, 0.35, 1);
    if (tgt && this.charToWorld) {
      this.worldToChar(tgt, K.t);
      const sh = rd.shoulder.R;
      d.copy(K.t).sub(K.t2.set(0, sh.y, sh.z));
    }
    d.z = Math.max(d.z, 0.35);
    d.y = clamp(d.y, -0.4 * d.length(), 2 * d.length());
    d.normalize();
    const reach = (rd.a1 + rd.a2) * 0.97;
    const W = (a, b, c2, dd, e) =>
      lerp(lerp(lerp(a, b, Z.y), c2, Z.g), dd, Z.c) * (e ?? 1);
    const V = (o, a, b, c2, dd) =>
      o.copy(a).lerp(b, Z.y).lerp(c2, Z.g).lerp(dd, Z.c);
    const tv =
      this._zt || (this._zt = [0, 1, 2, 3].map(() => new THREE.Vector3()));
    out.copy(this.skel.rest);
    const b = this.b.begin(out);
    // hips / spine (pitch + = bend forward)
    const gw = L.data.gw || 0;
    b.moveHips(
      0,
      W(-0.02, -0.08, 0, -0.14) * (1 - gw) +
        gw * (-0.05 - 0.13 * clamp(Z.y, 0, 1.2)),
      W(0, -0.05, 0, 0.02) * (1 - gw) - gw * 0.06 * clamp(Z.y, 0, 1),
    );
    const sp = W(-0.04, 0.3, -0.1, 0.24),
      ch = W(-0.06, 0.18, -0.08, 0.12);
    b.rot("spine", X, sp * 0.55);
    if (b.i("spine1") >= 0) b.rot("spine1", X, sp * 0.45);
    b.rot("chest", X, ch);
    b.rot("neck", X, W(-0.05, -0.1, -0.18, -0.22));
    b.rot("head", X, W(-0.05, -0.12, -0.2, -0.2));
    // slight elastic body twist on the yank (right side leads) and a lazy roll in the flight
    b.rot("chest", Y, 0.12 * Math.sin(Math.PI * clamp(Z.y, 0, 1)) * (1 - Z.g));
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1;
      const sh = b.pos("upperArm" + S, K.sh);
      // FIRE: arm straight at the target, hands converge slightly toward the midline
      const fire = tv[0].copy(sh).addScaledVector(d, reach);
      fire.x = lerp(fire.x, sh.x * 0.35, 0.5);
      const yank = tv[1].set(sx * 0.2, hy + 0.3, 0.06); // fists pulled back to the lower ribs
      const fly = tv[2].set(sx * 0.27, hy - 0.04, -0.16); // swept back along the flanks
      const cat = tv[3].set(sx * 0.42, hy + 0.12, 0.32); // out in front for balance
      V(K.h[S], fire, yank, fly, cat);
      V(
        K.e[S],
        tv[0].set(sx * 0.35, sh.y - 0.35, sh.z - 0.05),
        tv[1].set(sx * 0.3, hy + 0.08, -0.5),
        tv[2].set(sx * 0.4, hy + 0.3, -0.4),
        tv[3].set(sx * 0.55, hy + 0.15, -0.15),
      );
      b.ik("arm", S, K.h[S], K.e[S], 1, { absolute: true });
      rdCurl(this, out, S, W(0.45, 1, 0.8, 0.55));
      // legs: FIRE loose split, YANK tucked (knees up), FLIGHT trailing straight together (one knee soft), CATCH knees up wide, feet forward
      const th = rd.thigh[S];
      const fl = tv[0].set(
        sx * 0.1,
        th.y - ll * (S === "L" ? 0.8 : 0.9),
        S === "L" ? 0.1 : -0.1,
      );
      const tk = tv[1].set(sx * 0.13, th.y - 0.5, 0.2);
      const tr = tv[2].set(
        sx * 0.07,
        th.y - ll * (S === "L" ? 0.97 : 0.84),
        S === "L" ? -0.12 : -0.3,
      );
      const ca = tv[3].set(sx * 0.14, th.y - 0.52, 0.34);
      V(K.a[S], fl, tk, tr, ca);
      V(
        K.k[S],
        tv[0].set(sx * 0.15, th.y - 0.3, 0.7),
        tv[1].set(sx * 0.25, th.y, 0.8),
        tv[2].set(sx * 0.05, th.y - 0.4, 0.7),
        tv[3].set(sx * 0.5, th.y, 0.6),
      );
      if (gw > 0.001) {
        // planted: staggered stance, feet flat on the ground, knees over the toes
        K.a[S].lerp(
          tv[0].set(sx * 0.14, rd.ankleH, S === "L" ? 0.12 : -0.14),
          gw,
        );
        K.k[S].lerp(tv[1].set(sx * 0.3, th.y - 0.2, 0.9), gw);
      }
      b.ik("leg", S, K.a[S], K.k[S], 1, { absolute: true });
      if (gw < 0.999) b.rot("foot" + S, X, W(0.3, 0.1, 0.75, -0.1) * (1 - gw)); // toes pointed in flight, flexed for the catch
      if (gw > 0.001) b.fromBind("foot" + S, QI, gw); // planted flat (bind orientation = sole on the ground)
    }
  }
  // Procedural arm pump (user feedback #1: the authored run/jog clips fold the hands onto the chest). Arms swing
  // opposite to the legs, phase read from the pose's own thigh angles (so it is always in sync with whatever blend /
  // stride warp / wall run produced the legs), expressed in the chest frame so torso lean + counter-rotation carry
  // through. Elbows ~70-100 deg, hands clear of the torso (abduction), forward hand at chest/chin height.
  // user r9g: masculine run — feet land on two tracks about hip width apart (no crossover onto one line, which read as
  // a catwalk), knees tracking over the feet; strength grows with speed.
  // lateral foot position (char x, m) of the idle stance incl. widenStance: the run uses the same track width
  idleFootX() {
    if (this._idleFX != null) return this._idleFX;
    const P = this.P.tmp,
      n = this.clips.first("idle");
    if (!n || !this.clips.sample(n, 0, P)) return (this._idleFX = 0.14);
    this.widenStance(P, 1);
    this.skel.fk(P);
    const i = this.skel.idx("footL");
    return (this._idleFX = Math.abs(this.skel.cp[i * 3]));
  }
  runTrack(pose, v) {
    const k = smooth((v - 2.5) / 3);
    if (k < 0.01) return;
    const b = this.b.begin(pose);
    // user r9i: run with the torso pitched forward a little more (from the hips up)
    const lean = k * lerp(0.08, 0.14, smooth((v - 8) / 5));
    b.rot("spine", X, lean * 0.45);
    b.rot("spine1", X, lean * 0.3);
    b.rot("chest", X, lean * 0.25);
    // (anim r2) athletic upper back: the run clip carried him chest-out (arched); round the shoulders a touch forward
    b.rot("chest", X, 0.07 * k);
    b.rot("neck", X, -0.03 * k);
    b.rot("head", X, -lean * 0.6 - 0.05 * k); // keep the gaze level
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1;
      const f = b.pos("foot" + S, new THREE.Vector3()),
        hip = b.pos("upperLeg" + S, new THREE.Vector3());
      const want =
        sx * Math.max(sx * f.x, lerp(Math.abs(hip.x), this.idleFootX(), 0.3)); // user r9h/r9k: 30% from the hip line toward the idle stance width
      const fq = b.cq("foot" + S, new THREE.Quaternion());
      f.x = lerp(f.x, want, k);
      // user r9i: the rear leg PUSHES from behind — when the foot is behind the hip and low (stance / toe-off), drive
      // it further back so the knee straightens into the push, and point the toes (plantar flex) at toe-off
      const behind =
        smooth((hip.z - f.z - 0.05) / 0.35) * (1 - smooth((f.y - 0.25) / 0.2));
      if (behind > 0.01) {
        f.z -= 0.12 * k * behind;
        f.y += 0.03 * k * behind;
        fq.premultiply(_q.setFromAxisAngle(X, 0.45 * k * behind));
      }
      const knee = b.pos("lowerLeg" + S, new THREE.Vector3());
      b.ik(
        "leg",
        S,
        f,
        knee.clone().add(new THREE.Vector3(sx * 0.03, 0, 0.3)),
        1,
        { absolute: true },
      );
      b.setCQ("foot" + S, fq);
    }
  }
  armPump(pose, v, w) {
    if (w < 0.01) return;
    const b = this.b.begin(pose),
      rd = this.rd;
    const T =
      this._pv ||
      (this._pv = {
        a: new THREE.Vector3(),
        b: new THREE.Vector3(),
        sh: new THREE.Vector3(),
        q: new THREE.Quaternion(),
        q2: new THREE.Quaternion(),
        at: { elbow: new THREE.Vector3(), hand: new THREE.Vector3() },
      });
    const th = {};
    for (const S of ["L", "R"]) {
      const h = b.pos("upperLeg" + S, T.a),
        k = b.pos("lowerLeg" + S, T.b);
      th[S] = Math.atan2(k.z - h.z, h.y - k.y);
    }
    const s0 = (th.L - th.R) * 0.5; // + = left leg forward
    // user r9h/r9j: organic, ELASTIC arm swing (no mechanical zig-zag): the arms are an under-damped spring driven by
    // the leg phase — they lag the legs a touch, carry momentum and ease into and out of each extreme with a slight
    // overshoot, then rebound. Spring frequency follows the stride cadence so the feel is the same at any speed.
    // Called once per frame per pose; the spring only advances when time moves (shared by ground/wall run callers).
    const as = this.armSpr || (this.armSpr = new Spring(s0, 3, 0.42));
    if (this._armT !== this.time) {
      this._armT = this.time;
      // user r9k: tighter — the target itself dwells at the extremes (|x|^0.7) and the spring is near-critical, so the
      // forward hand settles into a firm end position before swinging back (no floppy overshoot)
      this.armAmp = Math.max(
        damp(this.armAmp ?? 0.3, 0.05, 1.5, this.dt || 0.016),
        Math.abs(s0),
      );
      const sn = clamp(s0 / Math.max(this.armAmp, 0.05), -1, 1);
      const tgt = Math.sign(sn) * Math.pow(Math.abs(sn), 0.7) * this.armAmp;
      as.f = clamp((this.locoInfo?.rate || 1.8) * 3.6, 3, 9);
      as.z = 0.78;
      if (!(Math.abs(as.x - tgt) < 1.5)) {
        as.x = tgt;
        as.v = 0;
      }
      as.step(tgt, this.dt || 0.016);
    }
    const s = as.x * 0.9,
      sVel = as.v * 0.9; // elastic arm phase (resonant gain ~1.1 compensated) + velocity
    const u = smooth((v - 1.4) / 3.6),
      sp = smooth((v - 9) / 5); // walk -> run, run -> sprint
    // (anim r2) never two identical strides: the swing amplitude breathes a little (slow noise), like a real runner
    const vary = 1 + 0.07 * noise1(this.time * 0.55, 11) * u;
    const gain = lerp(0.8, 1.45, u) * lerp(1, 1.04, sp) * vary,
      bias = lerp(-0.02, 0.1, u),
      abd = lerp(0.1, 0.36, u); // r12: walk = looser, smaller swing // r9g: forward hand stays in front of its own shoulder (no crossing to the sternum) // (anim r2) sprint 1.1 -> 1.04: the back arm flung up behind him
    // user r9f: organic torso counter-rotation — the shoulders turn with the arms (forward arm's shoulder leads), the
    // pelvis turns the other way with the legs, the chest rolls slightly toward the forward-arm side; neck/head
    // counter-rotate so the gaze stays steady. s is continuous (from the thigh angles), so it alternates smoothly.
    {
      const tw = s * w * lerp(0.35, 0.55, u); // + = right arm forward (left leg forward)
      b.rot("hips", Y, -tw * 0.35);
      b.rot("spine", Y, tw * 0.3);
      b.rot("spine1", Y, tw * 0.35);
      b.rot("chest", Y, tw * 0.45);
      b.rot("chest", Z, tw * 0.18); // lean a touch into the forward-arm side
      b.rot("neck", Y, -tw * 0.45);
      b.rot("head", Y, -tw * 0.4);
    }
    const ci = b.i("chest");
    const chestD = b.cq(ci, T.q).multiply(this.skel.bQ(ci, T.q2).invert()); // torso rotation from bind (char space)
    for (const S of ["L", "R"]) {
      const sw = S === "L" ? -s : s; // arm opposite its leg
      const flex = clamp(
        bias + gain * sw,
        lerp(-0.5, lerp(-0.72, -0.62, sp), u),
        lerp(0.45, 0.85, u),
      ); // (anim r2) sprint back-swing capped (arm flung high behind)
      const fwdAmt = clamp((flex + 0.95) / 1.8, 0, 1);
      // user r9j: the forward arm stays fairly straight (slight bend, hand out in front — not folded to the chest)
      let elbow = lerp(lerp(0.3, 1.2, u), lerp(0.55, 0.85, u), fwdAmt);
      // elastic forearm: it trails the swing — opens a little while the arm drives forward, folds while it drives back
      const armV = S === "L" ? -sVel : sVel;
      elbow = clamp(elbow - armV * 0.08 * u, 0.2, 1.6);
      const at = armTarget(rd, S, flex, abd, elbow, T.at, lerp(0, 0.18, u));
      const sh = b.pos("upperArm" + S, T.sh);
      const el = at.elbow.applyQuaternion(chestD).add(sh);
      const hd = at.hand.applyQuaternion(chestD).add(sh);
      // pole just outside/behind the elbow target keeps the hinge plane stable at the extremes
      const sx = S === "L" ? 1 : -1;
      b.ik(
        "arm",
        S,
        hd,
        el.clone().add(_v4.set(sx * 0.05, 0, -0.08).applyQuaternion(chestD)),
        w,
        { absolute: true },
      );
      this.rd.curl(pose, S, lerp(0.5, 0.82, u), w);
      b.dirty = true; // (anim r2) 0.7: flared open fingers at speed; a loose runner's fist
    }
  }
  // (anim r2, user: "swinging ... repetitive, more Spider-Man like motions") SWING LIFE on top of the low / bottom / high
  // clip blend. Each web picks a body style (never the same twice in a row) and the legs / torso move through the arc
  // on springs, so they lag, swing through and overshoot instead of hanging off the rope as one rigid shape:
  //   drop-in (ph < 0): legs trail back, knees soft, a slight crunch   bottom: the legs sweep through, the back arches
  //   upswing (ph > 0): the legs kick forward and up ahead of the body
  //   styles: 'split' (lead knee up, trail leg long - the classic silhouette), 'tuck' (both knees drawn up), 'long'
  //   (legs together, extended, toes pointed), 'stride' (running in the air: slow alternating leg cycle)
  // The lead leg is the one opposite the web hand. w = layer weight (0 while the web is slack / kicking off a wall).
  swingLife(L, ph, sw, w) {
    const D = L.data;
    if (!D.life) {
      const order = ["split", "tuck", "long", "stride", "split"];
      let st;
      do {
        st = order[Math.floor(Math.random() * order.length)];
      } while (st === this._swLast && Math.random() < 0.9);
      if (globalThis.__swStyle) st = globalThis.__swStyle; // lab / review: force one style
      this._swLast = st;
      D.life = {
        style: st,
        side: Math.random() < 0.5 ? 1 : -1,
        t0: this.time,
        th: { L: new Spring(0, 2.1, 0.5), R: new Spring(0, 2.1, 0.5) },
        kn: { L: new Spring(0, 2.8, 0.55), R: new Spring(0, 2.8, 0.55) },
        arch: new Spring(0, 2.0, 0.6),
        stp: Math.random() * TAU,
      };
    }
    const F = D.life,
      dt = this.dt || 0.016;
    const bump = (x, c, s) => Math.exp(-(((x - c) / s) ** 2));
    // (a left grip without baked L clips is built as a right grip and mirrored at the end: its lead leg mirrors with it)
    const lead = D.hand === "L" && D.nat ? "R" : "L",
      trail = lead === "L" ? "R" : "L";
    // base sweep through the arc (thigh pitch: - = knee forward, + = back; knee: + = bend)
    // (anim r2 critic 1: the drop read as kneeling in the air - shins folded back) drop: legs trail LONG, knees soft
    const sweep =
      0.12 * smooth((-ph - 0.15) / 0.6) -
      0.5 * bump(ph, 0.3, 0.5) -
      0.2 * smooth((ph - 0.55) / 0.4);
    const kb = 0.18 + 0.35 * bump(ph, 0.15, 0.42); // absolute knee flexion (rad): soft ~10 deg on the drop
    const tgt = { th: { L: sweep, R: sweep }, kn: { L: kb, R: kb } };
    const s = F.style,
      mid = bump(ph, 0.08, 0.55),
      drop = smooth((-ph - 0.1) / 0.5); // (critic r5: straight 'standing' legs at the bottom: the sweep starts earlier)
    if (s === "split") {
      tgt.th[lead] += -0.6 * (0.2 + 0.8 * mid);
      tgt.kn[lead] += 1.1 * (0.12 + 0.88 * mid);
      tgt.th[trail] += 0.22 * mid;
      tgt.kn[trail] += -0.04;
    } else if (s === "tuck") {
      for (const k of ["L", "R"]) {
        tgt.th[k] += -0.5 * mid;
        tgt.kn[k] += 1.05 * (0.1 + 0.9 * mid);
      }
      tgt.th[lead] -= 0.08 * mid;
    } else if (s === "long") {
      for (const k of ["L", "R"]) {
        tgt.kn[k] = 0.06 + 0.12 * mid;
      }
    } else if (s === "stride") {
      // a slow run in the air through the bottom; legs long on the drop
      const p = F.stp + TAU * 0.85 * (this.time - F.t0),
        c = Math.sin(p),
        a = 1 - 0.7 * drop;
      tgt.th.L += (-0.38 * c - 0.1) * a;
      tgt.th.R += (0.38 * c - 0.1) * a;
      tgt.kn.L += (0.3 + 0.6 * Math.max(0, -Math.cos(p))) * a;
      tgt.kn.R += (0.3 + 0.6 * Math.max(0, Math.cos(p))) * a;
    }
    for (const k of ["L", "R"]) {
      F.th[k].step(tgt.th[k], dt);
      F.kn[k].step(tgt.kn[k], dt);
    }
    F.arch.step(
      -0.2 * bump(ph, 0.05, 0.45) + 0.1 * smooth((-ph - 0.4) / 0.4),
      dt,
    );
    F.k = w * smooth((this.time - F.t0) / 0.35); // eases in after the attach (the clip pose carries the first frames)
    F.mirror = D.hand === "L" && !D.nat; // the swing pose is mirrored later for this grip: swap the legs here
    this.swLife = F;
    F.tSeen = this.time;
    D.clip += " +" + s;
  }
  // applied on the final pose after swingLegs (postWeb), so the style layer rides on the ref-matched leg hang / tuck.
  // fade: swLegW (follows the swing in / out over the release)
  applySwingLife(fade) {
    const F = this.swLife;
    if (!F) return;
    if (this.time - F.tSeen > 0.05) F.k = damp(F.k, 0, 6, this.dt || 0.016); // off the web: the style fades with the release
    const k = F.k * fade;
    if (k < 0.01) return;
    const b = this.b;
    for (const S2 of ["L", "R"]) {
      const src = F.mirror ? (S2 === "L" ? "R" : "L") : S2;
      const thx = clamp(F.th[src].x, -1.1, 0.7);
      b.rot(
        "upperLeg" + S2,
        X,
        (thx < 0 ? thx * (1 - 0.65 * (this.tuckW || 0)) : thx) * k,
      ); // (user r-anim3) no extra fold on top of the two-handed tuck
      // knee = an ABSOLUTE flexion target (the clip + hang underneath came out ~70-90 deg bent on the drop: kneeling in
      // the air): measure the current bend and turn the shin to the spring's angle
      const hp = b.pos("upperLeg" + S2, _sl.a),
        kp = b.pos("lowerLeg" + S2, _sl.b),
        ap = b.pos("foot" + S2, _sl.c);
      const cur = _sl.d
        .copy(kp)
        .sub(hp)
        .normalize()
        .angleTo(_sl.e.copy(ap).sub(kp).normalize());
      const want = clamp(F.kn[src].x, 0.05, 2.0);
      b.rot(
        "lowerLeg" + S2,
        X,
        (lerp(want, Math.max(want, cur), this.tuckW || 0) - cur) * k,
      ); // the two-handed upswing tuck (refs 05-08) keeps its fold
      b.rot("foot" + S2, X, (F.style === "long" ? 0.3 : 0.15) * k); // toes pointed in flight
    }
    const a = F.arch.x * k;
    b.rot("spine", X, a * 0.45);
    b.rot("spine1", X, a * 0.35);
    b.rot("chest", X, a * 0.2);
    b.rot("head", X, -a * 0.5);
  }
  // Knee separation (m) of a clip at t=0.5 s: tells a frog-squat perch clip from the legacy hunched one.
  kneeSpread(name) {
    const m = this._ks || (this._ks = {});
    if (m[name] != null) return m[name];
    if (!this.clips.sample(name, 0.5, this.P.tmp)) return (m[name] = 0);
    this.skel.fk(this.P.tmp);
    const a = this.skel.idx("lowerLegL"),
      b = this.skel.idx("lowerLegR");
    return (m[name] = Math.abs(this.skel.cp[a * 3] - this.skel.cp[b * 3]));
  }
  // Perch pose (refs/perch/good_*): hips nearly on the heels, knees spread wide (thighs ~horizontal, pointing out
  // ~50 deg), feet together on the perch point (balls of the feet on the edge), torso pitched forward between the knees,
  // both hands gripping the surface between the feet with the elbows inside the knees, head up looking out.
  // `land` (0/1) adds the landing absorb (hips dip + recover) at the start of the perch.
  perchSquat(pose, L, land) {
    const clip = this.clips.first("perchIdle");
    const proc = clip && this.kneeSpread(clip) > 0.5 ? 0 : 1; // authored frog squat present -> keep it
    const b = this.b.begin(pose),
      rd = this.rd,
      t = L.t,
      T = this.time;
    const imp = this.A?.perch?.impact
      ? clamp(this.A.perch.impact.length() / 20, 0.4, 1.3)
      : 1;
    const absorb = land
      ? imp * Math.sin(Math.PI * clamp(t / 0.42, 0, 1)) * Math.exp(-t * 2.5)
      : 0; // 0..~0.6 bump
    if (!proc) {
      if (absorb > 1e-3) b.moveHips(0, -0.07 * absorb, 0.02 * absorb);
      return;
    }
    const K =
      this._pk ||
      (this._pk = {
        v: new THREE.Vector3(),
        p: new THREE.Vector3(),
        q: new THREE.Quaternion(),
      });
    // idle life: slow breathing bob, occasional weight shift from foot to foot
    const shift = noise1(T * 0.23, 3) * 0.035,
      bob = Math.sin(T * TAU * 0.3) * 0.008;
    b.setHipsChar(K.v.set(shift, 0.35 - 0.08 * absorb + bob, -0.08));
    // absolute torso line (char-space pitch from bind, + = forward): pelvis tipped, back rounded forward, head up
    const q = K.q,
      e = this._pe || (this._pe = new THREE.Euler());
    for (const [k, pitch, roll] of [
      ["hips", 0.62 + 0.1 * absorb, -shift * 2.2],
      ["spine", 0.86 + 0.1 * absorb, -shift],
      ["spine1", 0.96 + 0.1 * absorb, 0],
      ["chest", 1.02 + 0.08 * absorb, 0],
      ["neck", 0.5, 0],
      ["head", -0.12 - 0.06 * absorb, 0],
    ]) {
      if (b.i(k) < 0) continue;
      b.fromBind(k, q.setFromEuler(e.set(pitch, 0, roll, "YXZ")));
    }
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1;
      // feet together on the point, balls of the feet on the surface (heels slightly raised), toes turned out a little
      b.ik(
        "leg",
        S,
        K.v.set(sx * 0.13, rd.ankleH + 0.035, 0.0),
        K.p.set(sx * 1.3, 0.5, 0.3),
        1,
        { absolute: true },
      );
      b.aim("foot" + S, K.v.set(sx * 0.35, -0.42, 1).normalize(), 1);
      // hands grip the surface between/just in front of the feet, elbows inside the knees
      b.ik(
        "arm",
        S,
        K.v.set(sx * (0.06 + 0.02 * shift * sx), 0.06, 0.13),
        K.p.set(sx * 0.3, 0.6, -0.1),
        1,
        { absolute: true },
      );
      b.aim("hand" + S, K.v.set(-sx * 0.12, -0.75, 1).normalize(), 1);
      this.rd.curl(pose, S, 0.62, 1);
      b.dirty = true;
    }
  }
  // Ground contact for landing/recovery clips (roll, hard landing...): the lowest body point (soles, hands, knees,
  // back, head) must touch char-space y = 0 — clips authored with a floating/sinking pelvis are re-seated vertically.
  groundContact(pose, w = 1) {
    if (w < 0.01) return;
    const b = this.b.begin(pose),
      rd = this.rd;
    b.fk();
    const S = this.skel,
      cp = S.cp;
    let lo = Infinity;
    const probe = (k, r) => {
      const i = S.idx(k);
      if (i >= 0) lo = Math.min(lo, cp[i * 3 + 1] - r);
    };
    probe("footL", rd.ankleH * 0.85);
    probe("footR", rd.ankleH * 0.85);
    for (const S2 of ["L", "R"]) {
      const t = this.skel.idx("toe" + S2);
      if (t >= 0) lo = Math.min(lo, cp[t * 3 + 1] - 0.025);
    }
    probe("handL", 0.04);
    probe("handR", 0.04);
    probe("lowerLegL", 0.07);
    probe("lowerLegR", 0.07);
    probe("hips", 0.13);
    probe("spine", 0.14);
    probe("chest", 0.15);
    probe("head", 0.13);
    if (!isFinite(lo) || Math.abs(lo) < 0.005) return;
    b.moveHips(0, -lo * w, 0);
  }
  // Late-fall landing anticipation: as the ground approaches, legs reach down so the soles meet the ground at the
  // moment of contact (no "stop in mid-air, then snap into the crouch").
  groundReach(pose, A) {
    const vy = A.velocity?.y ?? 0,
      C = this.io?.center,
      W = this.world;
    const landed = A.mode === "land" || A.mode === "ground"; // outgoing air layer while the landing blends in: keep reaching
    let h = 0,
      w = 1;
    if (!landed) {
      if (vy > -2 || !C || !W?.groundHeight) return;
      const H = this.io.H ?? 0.95;
      const g = W.groundHeight(C.x, C.z, C.y);
      if (g == null || !isFinite(g)) return;
      h = C.y - H - g; // sole height above the ground (upright body)
      if (h < -0.2) return;
      const tti = h / Math.max(2, -vy); // time to impact
      if (tti > 0.3) return;
      w = smooth((0.3 - tti) / 0.22);
    }
    const b = this.b.begin(pose),
      rd = this.rd,
      v = _v4;
    for (const S of ["L", "R"]) {
      const a = b.pos("foot" + S, new THREE.Vector3());
      const maxY = rd.ankleH + Math.max(0, h) * 0.85;
      if (a.y <= maxY) continue;
      const tgt = a.clone();
      tgt.y = lerp(a.y, maxY, w);
      tgt.z = lerp(a.z, a.z * 0.6, w);
      const fq = b.cq("foot" + S, new THREE.Quaternion());
      const knee = b.pos("lowerLeg" + S, new THREE.Vector3());
      b.ik("leg", S, tgt, knee.add(v.set(0, 0, 0.4)), 1, { absolute: false });
      b.setCQ("foot" + S, fq);
    }
  }
  // Seat the balls of the feet exactly on the perch top (anim.perch.point, C1 extension): whole-body vertical correction
  // (smoothed), then the hands are kept on/above the same plane.
  perchSeat(pose, L, A) {
    const pt = A.perch?.point;
    if (!pt || !this.charToWorld || pt.lengthSq() < 1e-6) return;
    const b = this.b.begin(pose),
      S = this.skel;
    b.fk();
    const py = this.worldToChar(pt, _v4).y;
    let lo = Infinity;
    for (const k of ["toeL", "toeR"]) {
      const i = S.idx(k);
      if (i >= 0) lo = Math.min(lo, S.cp[i * 3 + 1] - 0.022);
    }
    if (!isFinite(lo))
      for (const k of ["footL", "footR"]) {
        const i = S.idx(k);
        if (i >= 0) lo = Math.min(lo, S.cp[i * 3 + 1] - this.rd.ankleH);
      }
    if (!isFinite(lo)) return;
    const d = clamp(py - lo, -0.6, 0.6);
    L.data.seat = L.data.seat == null ? d : damp(L.data.seat, d, 14, this.dt);
    if (Math.abs(L.data.seat) > 1e-3) b.moveHips(0, L.data.seat, 0);
    // feet pinned after the landing (idle weight shift must not slide the toes on the perch)
    if (L.t > 0.8) {
      const pin =
        L.data.pin ||
        (L.data.pin = {
          L: b.pos("footL", new THREE.Vector3()),
          R: b.pos("footR", new THREE.Vector3()),
        });
      for (const Sd of ["L", "R"]) {
        const fq = b.cq("foot" + Sd, new THREE.Quaternion()),
          knee = b.pos("lowerLeg" + Sd, new THREE.Vector3());
        b.ik(
          "leg",
          Sd,
          pin[Sd],
          knee.add(_v.set(Sd === "L" ? 0.3 : -0.3, 0.1, 0.3)),
          1,
          { absolute: false },
        );
        b.setCQ("foot" + Sd, fq);
      }
    }
    // hands never below the perch plane (they grip its top)
    for (const Sd of ["L", "R"]) {
      const h = b.pos("hand" + Sd, new THREE.Vector3()),
        min = py + 0.045;
      if (h.y < min) {
        const hq = b.cq("hand" + Sd, new THREE.Quaternion());
        const el = b.pos("lowerArm" + Sd, new THREE.Vector3());
        b.ik("arm", Sd, h.setY(min), el.add(_v.set(0, 0.1, -0.2)), 1, {
          absolute: false,
        });
        b.setCQ("hand" + Sd, hq);
      }
    }
  }
  // Superhero landing (user feedback #19): crouched 3-point — BOTH feet planted (staggered, knees over the toes, no
  // leg thrown back / knee on the ground), the clip's hand down. Fades out as the clip rises (hips above ~0.75 m).
  landHardNeedsFix() {
    if (this._lhf != null) return this._lhf;
    const C = this.clips,
      S = this.skel,
      rd = this.rd;
    let bad = false;
    for (const t of [0.35, 0.55]) {
      C.sample("landHard", t, this.P.tmp, { loop: false });
      this.groundContact(this.P.tmp, 1);
      S.fk(this.P.tmp);
      for (const k of ["footL", "footR"])
        if (S.cp[S.idx(k) * 3 + 1] > rd.ankleH + 0.12) bad = true;
      for (const k of ["lowerLegL", "lowerLegR"])
        if (S.cp[S.idx(k) * 3 + 1] < 0.1) bad = true;
    }
    return (this._lhf = bad);
  }
  threePoint(pose) {
    const b = this.b.begin(pose),
      rd = this.rd,
      v = _v4;
    const hy = b.pos("hips", new THREE.Vector3()).y;
    const w = 1 - smooth((hy - 0.62) / 0.25);
    if (w < 0.01) return;
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1,
        lead = S === "L";
      const tgt = new THREE.Vector3(
        sx * 0.2,
        rd.ankleH + (lead ? 0 : 0.03),
        lead ? 0.3 : -0.12,
      );
      const pole = new THREE.Vector3(sx * 0.45, 0.6, 1.0);
      b.ik("leg", S, tgt, pole, w, { absolute: true });
      // lead foot flat, rear foot on the ball (heel up)
      b.fromBind(
        "foot" + S,
        _q
          .setFromAxisAngle(X, lead ? 0 : 0.35)
          .premultiply(_q2.setFromAxisAngle(Y, sx * 0.25)),
        w,
      );
    }
    b.dirty = true;
  }
  // Clamp both feet so the ankle never goes below ankleH above char-space plane y = y0 (wall/ground penetration guard).
  solesAbove(pose, y0) {
    const b = this.b.begin(pose),
      rd = this.rd;
    for (const S of ["L", "R"]) {
      const a = b.pos("foot" + S, new THREE.Vector3());
      const min = y0 + rd.ankleH * 0.92;
      if (a.y >= min) continue;
      const fq = b.cq("foot" + S, new THREE.Quaternion());
      const knee = b.pos("lowerLeg" + S, new THREE.Vector3());
      b.ik(
        "leg",
        S,
        a.clone().setY(min),
        knee.clone().add(new THREE.Vector3(0, 0, 0.4)),
        1,
        { absolute: false },
      );
      b.setCQ("foot" + S, fq);
    }
  }
  strideWarp(pose, k) {
    const b = this.b.begin(pose);
    const hz = b.pos("hips", new THREE.Vector3()).z;
    for (const S of ["L", "R"]) {
      const a = b.pos("foot" + S, new THREE.Vector3());
      const tgt = a.clone();
      tgt.z = hz + (a.z - hz) * k;
      // extra lift for longer strides (swing feet only)
      const lift = Math.max(0, a.y - this.rd.ankleH);
      tgt.y += lift * (k - 1) * 0.5;
      const fq = b.cq("foot" + S, new THREE.Quaternion());
      const knee = b.pos("lowerLeg" + S, new THREE.Vector3());
      b.ik("leg", S, tgt, knee.clone().add(new THREE.Vector3(0, 0, 0.4)), 1, {
        absolute: false,
      });
      b.setCQ("foot" + S, fq);
    }
    // lower the pelvis slightly with long strides so the stance leg reaches
    if (k > 1) b.moveHips(0, -0.06 * (k - 1), 0);
  }
  // Low spider crawl (critic: crawl read as a vertical hang with straight dangling legs): pelvis pressed toward the wall
  // (char +Z), feet spread wider and knees splayed out sideways (frog legs), elbows out; hands/feet keep their contacts.
  spiderCrouch(pose) {
    const b = this.b.begin(pose),
      v = _v4;
    const ends = {};
    for (const k of ["footL", "footR", "handL", "handR"])
      ends[k] = b.pos(k, new THREE.Vector3());
    const rots = {};
    for (const k of ["footL", "footR", "handL", "handR"])
      rots[k] = b.cq(k, new THREE.Quaternion());
    b.moveHips(0, 0.04, -0.02);
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1;
      const f = ends["foot" + S];
      f.x = f.x * 1.25 + sx * 0.05;
      f.y += 0.08; // feet wider and higher (knees up)
      const hip = b.pos("upperLeg" + S, new THREE.Vector3());
      b.ik(
        "leg",
        S,
        f,
        hip
          .clone()
          .lerp(f, 0.5)
          .add(v.set(sx * 0.5, 0.1, -0.15)),
        1,
        { absolute: true },
      );
      b.setCQ("foot" + S, rots["foot" + S]);
      const sh = b.pos("upperArm" + S, new THREE.Vector3()),
        h = ends["hand" + S];
      b.ik(
        "arm",
        S,
        h,
        sh
          .clone()
          .lerp(h, 0.5)
          .add(v.set(sx * 0.35, 0, -0.2)),
        1,
        { absolute: true },
      );
      b.setCQ("hand" + S, rots["hand" + S]);
    }
  }
  // Jump / airborne arms (user r7/r9: hands went straight up, wrists snapped back): IK-driven, asymmetric like the
  // game's jump — rising: the lead arm reaches forward/up past the face, the other swings low and back (counter to the
  // lead leg); apex: both open out to the sides; fall: spread wider and slightly up for balance. Wrists always continue
  // the forearm line (relaxed, a touch of palm-down flex) — never the clip's bent-back hand. w = layer weight,
  // rise/fall = 0..1 blend of the vertical-velocity phase. this.jumpLead: +1 left arm leads, -1 right.
  jumpArms(pose, w, rise, fall) {
    if (w < 0.01) return;
    const b = this.b.begin(pose),
      T = this.time,
      sk = this.skel || b.s;
    const lead = this.jumpLead ?? 1;
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1,
        ld = sx === lead ? 1 : 0,
        sh = b.pos("upperArm" + S, new THREE.Vector3());
      const flut = Math.sin(T * 5.3 + (S === "L" ? 0 : 1.7)) * 0.025 * fall;
      // user r9c: both arms spread apart and pulled back (nothing in front of the chest), hands about shoulder height;
      // a touch of asymmetry (lead side a little higher) so it isn't a mirrored T-pose
      const aim = new THREE.Vector3(sx * 0.6, sh.y - (ld ? 0.04 : 0.12), -0.24);
      // fall: open a little wider / less far back for balance
      const tgt = aim.lerp(
        new THREE.Vector3(sx * 0.66, sh.y + flut, -0.12),
        fall * 0.7,
      );
      const pole = new THREE.Vector3(sx * 0.45, sh.y - 0.5, sh.z - 0.45);
      b.ik("arm", S, tgt, pole, w, { absolute: true });
      // wrist: follow the forearm (bind-relative), slight flex so the palm faces down/in
      const iF = b.i("lowerArm" + S),
        iH = b.i("hand" + S);
      if (iF >= 0 && iH >= 0) {
        const fq = b.cq("lowerArm" + S, new THREE.Quaternion());
        const bf = sk.bQ(iF, new THREE.Quaternion()).invert(),
          bh = sk.bQ(iH, new THREE.Quaternion());
        const hq = fq.multiply(bf).multiply(bh);
        b.setCQ("hand" + S, hq, w);
      }
    }
  }
  // Jump knee tuck (user r9b ref): knees drawn up in front, feet under the seat, one leg a little higher than the
  // other (the lead-arm side's opposite knee leads). w = weight (rise/apex; faded out as he falls toward a landing).
  jumpTuck(pose, w) {
    if (w < 0.01) return;
    const b = this.b.begin(pose),
      lead = this.jumpLead ?? 1;
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1,
        hi = sx !== lead ? 1 : 0;
      const hip = b.pos("upperLeg" + S, new THREE.Vector3());
      const fq = b.cq("foot" + S, new THREE.Quaternion());
      const tgt = new THREE.Vector3(
        sx * 0.13,
        hip.y - (hi ? 0.34 : 0.5),
        hi ? 0.1 : -0.06,
      );
      b.ik(
        "leg",
        S,
        tgt,
        new THREE.Vector3(sx * 0.2, hip.y - 0.1, hip.z + 0.8),
        w,
        { absolute: true },
      );
      b.setCQ("foot" + S, fq);
    }
  }
  // "Wings" jump variant (user r10 ref, Insomniac mid-air jump seen from behind): knees drawn up and TOGETHER, lower legs
  // folded back under the body (heels near the seat, feet pointing down and back, like kneeling in the air), torso upright
  // to slightly forward, BOTH arms spread wide straight out at shoulder height (elbows only softly bent, hands open), head
  // level. w = blend weight (springy, driven by jumpWingsW). Live tuning: window.__wings = {...}.
  jumpWings(pose, w) {
    if (w < 0.01) return;
    const b = this.b.begin(pose),
      rd = this.rd,
      T = this.time;
    const K = Object.assign(
      {
        kneeY: 0.26,
        kneeZ: 0.35,
        ankY: 0.34,
        ankZ: -0.14,
        kneeX: 0.08,
        ankX: 0.075,
        toe: 0.75,
        lean: 0.08,
        armY: -0.01,
        armZ: -0.04,
        reach: 0.93,
        asym: 0.035,
      },
      globalThis.__wings || {},
    );
    b.rot("spine", X, K.lean * 0.6 * w);
    b.rot("chest", X, K.lean * 0.4 * w);
    b.rot("neck", X, -K.lean * 0.5 * w);
    b.rot("head", X, -K.lean * 0.5 * w); // head level, looking ahead
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1;
      // legs: knees up in front, together; shins folded back so the heels sit under the seat
      const hip = b.pos("upperLeg" + S, new THREE.Vector3());
      const knee = new THREE.Vector3(
        sx * K.kneeX,
        hip.y - K.kneeY,
        hip.z + K.kneeZ,
      );
      b.ik(
        "leg",
        S,
        new THREE.Vector3(sx * K.ankX, hip.y - K.ankY, hip.z + K.ankZ),
        knee.add(new THREE.Vector3(0, 0.1, 0.5)),
        w,
        { absolute: true },
      );
      b.rot("foot" + S, X, K.toe * w);
      // arms: wide wings, straight out to the sides at shoulder height, a soft elbow, a slow breathing float
      const sh = b.pos("upperArm" + S, new THREE.Vector3()),
        reach = (rd.a1 + rd.a2) * K.reach;
      const fl = Math.sin(T * 4.1 + (S === "L" ? 0 : 1.3)) * 0.02;
      const hand = new THREE.Vector3(
        sh.x + sx * reach,
        sh.y + K.armY + fl + (sx === (this.jumpLead ?? 1) ? K.asym : -K.asym),
        sh.z + K.armZ,
      ); // lead side a touch higher
      b.ik(
        "arm",
        S,
        hand,
        new THREE.Vector3(sh.x + sx * reach * 0.5, sh.y - 0.1, sh.z - 0.45),
        w,
        { absolute: true },
      );
      // wrist continues the forearm (open palm facing down), fingers open
      const iF = b.i("lowerArm" + S),
        iH = b.i("hand" + S);
      if (iF >= 0 && iH >= 0) {
        const fq = b.cq("lowerArm" + S, new THREE.Quaternion());
        const bf = this.skel.bQ(iF, new THREE.Quaternion()).invert(),
          bh = this.skel.bQ(iH, new THREE.Quaternion());
        b.setCQ("hand" + S, fq.multiply(bf).multiply(bh), w);
      }
      rd.curl(pose, S, 0.05, w);
      b.dirty = true;
    }
  }
  // (user r-anim3: "legs bending when swinging extreme, go beyond 180 deg in the front ... the crouch is clipping back
  // in the body. put a restraint on both the hips and knees") JOINT LIMITS on the final pose while airborne / swinging:
  // hip flexion (thigh vs the pelvis' down axis, forward of it) <= HIP_MAX, knee flexion <= KNEE_MAX. The thigh / shin
  // is turned back toward the limit inside its own bending plane, so the limb never folds into the torso. Off on the
  // ground (perch, crouches and landings keep their deep squats).
  postLimits(dt, A) {
    const on = A.mode === "swing" || A.mode === "air" || A.mode === "zip";
    this.limW = damp(this.limW ?? 0, on ? 1 : 0, 8, dt);
    const w = this.limW;
    if (w < 0.01) return;
    const HIP_MAX = 1.95,
      KNEE_MAX = 2.35; // ~112 deg, ~135 deg
    const b = this.b,
      hi = b.i("hips");
    const hq = b.cq(hi, _q).multiply(this.skel.bQ(hi, _q2).invert()); // pelvis rotation from bind (char space)
    const down = _sl.d.set(0, -1, 0).applyQuaternion(hq),
      fwd = _sl.e.set(0, 0, 1).applyQuaternion(hq);
    for (const S of ["L", "R"]) {
      const hp = b.pos("upperLeg" + S, _sl.a),
        kp = b.pos("lowerLeg" + S, _sl.b);
      const th = kp.sub(hp).normalize();
      let flex = Math.atan2(th.dot(fwd), th.dot(down)); // 0 = hanging, + forward, pi = up the chest
      if (flex < -0.6 * Math.PI) flex += TAU; // folded past 180 deg over the front (the reported bug)
      if (flex > HIP_MAX)
        b.rot(
          "upperLeg" + S,
          _v4.crossVectors(down, fwd).normalize(),
          -(flex - HIP_MAX) * w,
        ); // back about the pelvis' side axis
      const k2 = b.pos("lowerLeg" + S, _sl.a),
        ap = b.pos("foot" + S, _sl.c);
      const t2 = new THREE.Vector3()
          .copy(k2)
          .sub(b.pos("upperLeg" + S, _sl.b))
          .normalize(),
        sh = ap.sub(k2).normalize();
      const kf = t2.angleTo(sh);
      if (kf > KNEE_MAX) {
        const ax = new THREE.Vector3().crossVectors(sh, t2);
        if (ax.lengthSq() > 1e-8)
          b.rot("lowerLeg" + S, ax.normalize(), (kf - KNEE_MAX) * w);
      }
    }
  }
  // (user r-anim4: "fix the head bending down in jump") the jump take-off / airborne jump keeps the head level: the
  // clip + look-at pitched the chin down. Pitch (from bind, + = looking down) is capped at HEAD_DOWN, split neck / head.
  postHeadLevel(dt, A, top) {
    const jump =
      top.name === "jumpLaunch" ||
      top.name === "jumpCharge" ||
      (top.name === "air" && (top.data.fromJump || top.data.hop));
    this.headLvW = damp(this.headLvW ?? 0, jump ? 1 : 0, 8, dt);
    if (this.headLvW < 0.01) return;
    const b = this.b,
      hi = b.i("head");
    if (hi < 0) return;
    const hq = b.cq(hi, _q).multiply(this.skel.bQ(hi, _q2).invert());
    const f = _v4.set(0, 0, 1).applyQuaternion(hq),
      pitch = Math.atan2(-f.y, Math.hypot(f.x, f.z)),
      HEAD_DOWN = 0.08;
    if (pitch <= HEAD_DOWN) return;
    const side = _v.set(1, 0, 0).applyQuaternion(hq),
      ex = (pitch - HEAD_DOWN) * this.headLvW;
    if (b.i("neck") >= 0) b.rot("neck", side, -ex * 0.4);
    b.rot("head", side, -ex * (b.i("neck") >= 0 ? 0.6 : 1));
  }
  // springy weight of the wings variant: rises on take-off, holds through the rise and apex, relaxes toward the landing
  jumpWingsW(target) {
    // user r9s: the "wings" jump variant is DISABLED for now (needs refining) — force it off unless explicitly enabled
    // for testing via window.__jumpWingsEnable = true; the normal jump arms/legs play as before
    if (!window.__jumpWingsEnable) {
      if (this._jwS) {
        this._jwS.x = 0;
        this._jwS.v = 0;
      }
      return 0;
    }
    const sp = this._jwS || (this._jwS = new Spring(0, 3.2, 0.62));
    if (this._jwT === this.time) return clamp(sp.x, 0, 1.08); // once per frame (cross-fading nodes both ask)
    if (this.time - (this._jwT ?? -9) > 0.1) {
      sp.x = 0;
      sp.v = 0;
    } // a new airborne stretch starts from rest
    this._jwT = this.time;
    return clamp(sp.step(target, this.dt || 1 / 60), 0, 1.08);
  }
  // Wall cling (user r9/r10, refs/wall/cling_ref_main + cling_1..4): the pose he holds when he stops on a wall. Body turned
  // OUT from the facade (chest to the street), one side against the wall, hips pushed out and leaning away from it.
  // Wall-side hand reaches back to the wall at head height, palm flat on the bricks, elbow slightly bent; the free hand
  // hangs relaxed low and a little in front; wall-side knee drawn up high with the foot planted flat on the wall; the
  // other leg extends down and back with the foot on the wall lower down; head turned to look out over the street.
  // side: 'L' = his left side on the wall (as in the reference), 'R' = mirrored. Char space = wall frame: +Y up the
  // wall, +Z into the wall (plane at WALL_Z), X = frame left. Limb targets are authored in HIS body frame for side 'L'
  // (x = his left = toward the wall, y = up, z = his front), mirrored for 'R', turned by the hips yaw and placed at the
  // hips; wall contacts are pinned to the plane. w = blend weight. Live tuning: window.__cling = {...}.
  clingPose(pose, w, side = "L") {
    if (w < 0.01) return;
    const b = this.b.begin(pose),
      T = this.time,
      sk = this.skel;
    // limb targets: [a, y, o] = along the wall toward his front (+), up from the hips (+), out from the wall plane (+)
    const K = Object.assign(
      {
        turn: 2.1,
        hipY: 0.6,
        hipO: 0.38,
        lean: 0.12,
        pitch: 0.14,
        fold: 0.2,
        chestLift: 0.15,
        reach: 0.0,
        chestTurn: -0.65,
        chestSide: -0.05,
        headTurn: 1.45,
        headTilt: -0.05,
        headRoll: 0.05,
        neckBack: 0.0,
        neckUp: 0.1,
        shDrop: 0.2,
        shDropF: 0.3,
        shBack: 0.0,
        hW: [0.44, 0.52, 0.015],
        hF: [-0.07, -0.06, 0.86],
        fW: [0.3, -0.12, 0.075],
        fF: [-0.08, -0.57, 0.075],
        pW: [-0.1, -0.45, 0.45],
        pF: [-0.35, 0.05, 0.85],
        kW: [0.4, 0.5, -0.05],
        kF: [0.6, -0.2, 0.6],
        toeW: [0.6, 1],
        toeF: [1, 0.3],
        fingW: [0.6, 0.9],
        curlF: 0.55,
        curlW: 0.15,
        spreadW: 1.1,
      },
      window.__cling || {},
    );
    const m = side === "R" ? -1 : 1,
      W_ = side === "R" ? "R" : "L",
      F_ = side === "R" ? "L" : "R";
    const th = -m * K.turn,
      c = Math.cos(th),
      sn = Math.sin(th);
    const br = Math.sin(T * 1.7) * 0.006,
      sway = Math.sin(T * 0.9) * 0.01;
    const D = (a) =>
      new THREE.Vector3(
        m * a[0] * c + a[2] * sn,
        a[1],
        -m * a[0] * sn + a[2] * c,
      ); // body frame -> wall frame dir
    const O = new THREE.Vector3(0, K.hipY + br, WALL_Z - K.hipO);
    const V = (a) => new THREE.Vector3(-m * a[0], O.y + a[1], WALL_Z - a[2]); // [along, up, out] -> wall frame point
    const Wd = (a) => new THREE.Vector3(-m * a[0], a[1], 0); // in-plane direction
    for (const k of ["spine", "spine1", "chest", "neck", "head"])
      b.fromBind(k, new THREE.Quaternion(), w);
    const hips = b.pos("hips", new THREE.Vector3());
    const hq = new THREE.Quaternion()
      .setFromAxisAngle(Y, th)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Z, m * (K.lean + sway))) // top leans away from the wall
      .multiply(new THREE.Quaternion().setFromAxisAngle(X, K.pitch));
    b.fromBind("hips", hq, w);
    b.moveHips(-hips.x * w, (O.y - hips.y) * w, (O.z - hips.z) * w);
    // torso: chest turns further out to the street and bends slightly back toward the wall-side arm; head looks out
    const fwd = D([0, 0, 1]),
      bodyX = D([1, 0, 0]).multiplyScalar(m);
    b.rot("spine", Y, -m * K.chestTurn * 0.4 * w);
    b.rot("chest", Y, -m * K.chestTurn * 0.6 * w);
    b.rot("chest", fwd, -m * K.chestSide * w);
    // coil: spine folds forward over the raised knee (rounded upper back)
    b.rot("spine", bodyX, K.fold * w);
    b.rot(
      "chest",
      bodyX.clone().applyAxisAngle(Y, -m * K.chestTurn),
      (K.fold - K.chestLift) * w,
    ); // upper spine lifts: open chest
    {
      const lat2 = bodyX.clone().applyAxisAngle(Y, -m * K.chestTurn);
      b.rot("neck", lat2, -K.neckUp * w);
      b.rot("head", lat2, K.neckUp * w);
    } // neck up out of the traps
    // upper body leans along the wall toward the wall hand (shoulder comes to the hand); head counter-rotates to stay level
    b.rot("spine1", Z, m * (K.reach ?? 0) * 0.5 * w);
    b.rot("chest", Z, m * (K.reach ?? 0) * 0.5 * w);
    b.rot("neck", Z, -m * (K.reach ?? 0) * 0.6 * w);
    b.rot("head", Y, -m * K.headTurn * w);
    b.rot(
      "head",
      bodyX.clone().applyAxisAngle(Y, -m * (K.chestTurn + K.headTurn)),
      K.headTilt * w,
    );
    b.rot("head", fwd, m * K.headRoll * w);
    // head sits back over the shoulders (neck extends back, head keeps its look); wall-side clavicle down (no hunch)
    const lat = bodyX.clone().applyAxisAngle(Y, -m * K.chestTurn);
    b.rot("neck", lat, -K.neckBack * w);
    b.rot("head", lat, K.neckBack * w);
    b.rot("shoulder" + W_, fwd, -m * K.shDrop * w);
    b.rot("shoulder" + W_, Y, m * (K.shBack ?? 0.5) * w); // wall clavicle retracts: the hand reaches further back along the wall
    b.rot("shoulder" + F_, fwd, m * K.shDropF * w);
    // limbs
    b.ik("arm", W_, V(K.hW), V(K.pW), w, { absolute: true });
    b.ik("arm", F_, V(K.hF), V(K.pF), w, { absolute: true });
    b.ik("leg", W_, V(K.fW), V(K.kW), w, { absolute: true });
    b.ik("leg", F_, V(K.fF), V(K.kF), w, { absolute: true });
    // wrists continue the forearm line; the wall hand then turns palm-flat onto the wall, fingers up and back
    for (const S of ["L", "R"]) {
      const iF = b.i("lowerArm" + S),
        iH = b.i("hand" + S);
      if (iF < 0 || iH < 0) continue;
      const q = b
        .cq("lowerArm" + S, new THREE.Quaternion())
        .multiply(sk.bQ(iF, new THREE.Quaternion()).invert())
        .multiply(sk.bQ(iH, new THREE.Quaternion()));
      b.setCQ("hand" + S, q, w);
    }
    this.palmToWall(b, W_, Wd(K.fingW), w);
    // soles flat on the wall
    this.soleToWall(b, W_, Wd(K.toeW), w);
    this.soleToWall(b, F_, Wd(K.toeF), w);
    if (window.__clingDbgOn) {
      // debug: joint angles (deg) and contact offsets from the wall plane (m, + = out)
      const P = (k) => b.pos(k, new THREE.Vector3()),
        ang = (a, m2, c2) =>
          +(
            P(a)
              .sub(P(m2))
              .angleTo(P(c2).sub(P(m2))) * 57.3
          ).toFixed(0);
      const out = (k) => +(WALL_Z - P(k).z).toFixed(3);
      window.__clingDbg = {
        elbowW: ang("upperArm" + W_, "lowerArm" + W_, "hand" + W_),
        elbowF: ang("upperArm" + F_, "lowerArm" + F_, "hand" + F_),
        kneeW: ang("upperLeg" + W_, "lowerLeg" + W_, "foot" + W_),
        kneeF: ang("upperLeg" + F_, "lowerLeg" + F_, "foot" + F_),
        handW: out("hand" + W_),
        footW: out("foot" + W_),
        footF: out("foot" + F_),
        hips: out("hips"),
        hipsY: +P("hips").y.toFixed(2),
        footFY: +P("foot" + F_).y.toFixed(2),
        palm: ["index1", "pinky1", "middle3", "index3", "pinky3"].map((n) => {
          const i = sk.byName.get(n + W_);
          return i == null
            ? null
            : +(WALL_Z - b.pos(i, new THREE.Vector3()).z).toFixed(3);
        }),
        J: Object.fromEntries(
          [
            "upperArm" + W_,
            "upperArm" + F_,
            "upperLeg" + W_,
            "upperLeg" + F_,
            "lowerLeg" + F_,
            "lowerLeg" + W_,
            "head",
          ].map((k) => {
            const v = P(k);
            return [
              k,
              [
                +(-m * v.x).toFixed(2),
                +(v.y - O.y).toFixed(2),
                +(WALL_Z - v.z).toFixed(2),
              ],
            ];
          }),
        ),
        headOut: out("head"),
        handWY: +P("hand" + W_).y.toFixed(2),
        headY: +P("head").y.toFixed(2),
      };
    }
    this.rd.curl(pose, W_, K.curlW, w, K.spreadW);
    {
      // splay the wall hand's fingers in the wall plane (fan away from the middle finger)
      const iH = b.i("hand" + W_),
        iM = sk.byName.get("middle1" + W_);
      this.b.dirty = true;
      if (iH >= 0 && iM != null) {
        const h = b.pos(iH, new THREE.Vector3()),
          md = b.pos(iM, new THREE.Vector3()).sub(h);
        for (const [n, k] of [
          ["index1", 1],
          ["ring1", 0.5],
          ["pinky1", 1],
          ["thumb1", 2.2],
        ]) {
          const i = sk.byName.get(n + W_);
          if (i == null) continue;
          const fd = b.pos(i, new THREE.Vector3()).sub(h),
            sg = Math.sign(md.x * fd.y - md.y * fd.x) || 1;
          b.rot(i, Z, sg * K.spreadW * 0.25 * k * w);
        }
      }
    }
    this.rd.curl(pose, F_, K.curlF, w);
    this.b.dirty = true;
  }
  // camera position relative to the character, in the wall frame: camera on the frame -X side -> left side on the wall
  pickClingSide(A, prev) {
    const f = window.__clingSide;
    if (f === "L" || f === "R") return f;
    const ld = A.lookDir;
    if (!ld || ld.lengthSq() < 1e-6) return prev || "L";
    const c = _v3
      .copy(ld)
      .negate()
      .applyQuaternion(_q2.copy(this.frameQ).invert());
    const h = Math.hypot(c.x, c.z) || 1,
      x = c.x / h;
    if (x < -0.2) return "L";
    if (x > 0.2) return "R";
    return prev || "L";
  }
  // rotate hand S so its palm faces +Z (into the wall) with the fingers along dir (projected onto the wall plane)
  palmToWall(b, S, dir, w) {
    const sk = this.skel,
      iH = b.i("hand" + S),
      iM = sk.byName.get("middle1" + S),
      iI = sk.byName.get("index1" + S),
      iP = sk.byName.get("pinky1" + S);
    if (iH < 0 || iM == null || iI == null || iP == null) return;
    const h = b.pos(iH, new THREE.Vector3()),
      d = b.pos(iM, new THREE.Vector3()).sub(h).normalize();
    const a = b
      .pos(iI, new THREE.Vector3())
      .sub(b.pos(iP, new THREE.Vector3()));
    const n = new THREE.Vector3().crossVectors(d, a).normalize();
    if (S === "R") n.negate(); // palm normal
    const d2 = dir.clone();
    d2.z = 0;
    if (d2.lengthSq() < 1e-4) d2.set(0, 1, 0);
    d2.normalize();
    const n2 = new THREE.Vector3(0, 0, 1);
    const R = basisQ(d, n).invert().premultiply(basisQ(d2, n2));
    const q = b.cq(iH, new THREE.Quaternion()).premultiply(R);
    b.setCQ(iH, q, w);
  }
  // rotate foot S so the sole faces +Z (into the wall), toes along dir (projected onto the wall plane); foot bind = flat, toes +Z
  soleToWall(b, S, dir, w) {
    const d2 = dir.clone();
    d2.z = 0;
    if (d2.lengthSq() < 1e-4) d2.set(0, 1, 0);
    d2.normalize();
    // bind: toes +Z, sole normal -Y  ->  toes d2, sole normal +Z
    const R = basisQ(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0))
      .invert()
      .premultiply(basisQ(d2, new THREE.Vector3(0, 0, 1)));
    b.fromBind("foot" + S, R, w);
  }
  // Natural wall climb (user r6: the frog crouch looked crushed; refs/wall/crawl_*): body long and close to the wall,
  // diagonal limb pairs — right hand reaching high while the left knee comes up to the hip, then the other pair.
  // Planted limbs stay fixed on the wall while the body travels past them (stance sweeps down at body speed), the
  // swinging limb lifts ~10 cm off the wall and reaches up. Char space in the wall frame: +Y along the climb
  // heading, +Z into the wall (plane at WALL_Z), X = his left.
  climbPose(pose, dt, v, moving) {
    const b = this.b.begin(pose),
      T = this.time;
    const rots = {};
    for (const k of ["footL", "footR", "handL", "handR"])
      rots[k] = b.cq(k, new THREE.Quaternion());
    // stride per limb cycle grows with speed (reach-limited); cadence = speed / stride
    const Ls = clamp(0.4 + 0.14 * v, 0.6, 0.85);
    this.climbW = damp(this.climbW ?? 0, moving ? 1 : 0, moving ? 8 : 4, dt);
    if (moving)
      this.climbPh = ((this.climbPh ?? 0) + (dt * Math.max(v, 0.3)) / Ls) % 1;
    else
      this.climbPh = damp(
        this.climbPh ?? 0,
        Math.round((this.climbPh ?? 0) * 2) / 2,
        3,
        dt,
      ); // settle: one hand high, the other low (refs/wall/crawl_1)
    const ph = this.climbPh;
    // limb offset along the wall from its centre: stance sweeps +Ls/2 -> -Ls/2 (65 %), swing returns with a lift
    const limb = (p) => {
      p = ((p % 1) + 1) % 1;
      const SW = 0.35;
      if (p < 1 - SW) {
        const u = p / (1 - SW);
        return { y: Ls * (0.5 - u), lift: 0 };
      }
      const u = (p - (1 - SW)) / SW,
        e = u * u * (3 - 2 * u);
      return { y: Ls * (-0.5 + e), lift: Math.sin(Math.PI * u) };
    };
    // body: hips close to the wall, slight sway toward the planted foot side, small bob; chest leans into the wall
    const sway = Math.sin(ph * Math.PI * 2) * 0.045 * this.climbW;
    const breathe = Math.sin(T * 1.9) * 0.008;
    const hips = b.pos("hips", new THREE.Vector3());
    b.moveHips(
      sway - hips.x * 0.6,
      0.93 + breathe - hips.y,
      WALL_Z - 0.42 - hips.z,
    ); // user r8: torso raised off the wall
    b.rot("spine", X, -0.04);
    b.rot("chest", X, -0.04);
    b.rot("spine", Z, -sway * 1.6);
    // shoulders turn toward the reaching hand (right hand high at ph~0.25-0.5 -> left shoulder back)
    b.rot("chest", Y, Math.sin(ph * Math.PI * 2 - 0.6) * 0.14 * this.climbW);
    const zc = WALL_Z; // contact plane
    for (const S of ["L", "R"]) {
      const sx = S === "L" ? 1 : -1;
      // diagonal pairs: right hand + left foot share phase 0, left hand + right foot phase 0.5
      const hp = limb(ph + (S === "R" ? 0 : 0.5)),
        fp = limb(ph + (S === "L" ? 0 : 0.5));
      // hand: around head height, reaching up to ~0.55 m above the shoulder
      const sh = b.pos("upperArm" + S, new THREE.Vector3());
      const hand = new THREE.Vector3(
        sx * 0.4,
        sh.y + 0.12 + hp.y * 0.75,
        zc - 0.045 - 0.1 * hp.lift,
      ); // spread wide, reachable // lower hand stays ~shoulder height
      b.ik(
        "arm",
        S,
        hand,
        new THREE.Vector3(sx * 0.7, sh.y - 0.35, zc - 0.55),
        1,
        { absolute: true },
      ); // elbows down, not out
      b.setCQ("hand" + S, rots["hand" + S]);
      // foot: knee comes up toward the hip at the top of the stride; toes on the wall
      const foot = new THREE.Vector3(
        sx * 0.3,
        0.38 + fp.y * 0.85,
        zc - 0.08 - 0.1 * fp.lift,
      ); // feet reach the wall, spread
      const hipJ = b.pos("upperLeg" + S, new THREE.Vector3());
      b.ik(
        "leg",
        S,
        foot,
        hipJ
          .clone()
          .lerp(foot, 0.5)
          .add(new THREE.Vector3(sx * 0.35, -0.05, -0.4)),
        1,
        { absolute: true },
      ); // knees out-and-down, not flared
      b.setCQ("foot" + S, rots["foot" + S]);
    }
    // head up, looking along the climb
    b.rot("head", X, -0.25);
    b.rot("neck", X, -0.1);
  }
  // Wall stride warp: scale each limb's reach along the wall (char Y) about its root joint, keep wall contact.
  wallStrideWarp(pose, k) {
    const b = this.b.begin(pose);
    for (const [kind, S, root, end] of [
      ["arm", "L", "upperArmL", "handL"],
      ["arm", "R", "upperArmR", "handR"],
      ["leg", "L", "upperLegL", "footL"],
      ["leg", "R", "upperLegR", "footR"],
    ]) {
      const r = b.pos(root, new THREE.Vector3()),
        e = b.pos(end, new THREE.Vector3());
      const tgt = e.clone();
      tgt.y = r.y + (e.y - r.y) * k;
      const eq = b.cq(end, new THREE.Quaternion());
      const mid = b.pos(
        kind === "arm" ? "lowerArm" + S : "lowerLeg" + S,
        new THREE.Vector3(),
      );
      b.ik(
        kind,
        S,
        tgt,
        mid.clone().multiplyScalar(2).sub(r.clone().add(e).multiplyScalar(0.5)),
        1,
        { absolute: false },
      );
      b.setCQ(end, eq);
    }
  }
  // pose-match: choose a loco phase whose feet best match the given pose's feet (entering loco from any state)
  matchLocoPhase(pose, v) {
    const C = this.clips,
      avail = LOCO.filter(([n]) => C.has(n));
    if (!avail.length) return;
    this.skel.fk(pose);
    const fl = this.skel.idx("footL"),
      fr = this.skel.idx("footR");
    const zl = this.skel.cp[fl * 3 + 2],
      zr = this.skel.cp[fr * 3 + 2],
      yl = this.skel.cp[fl * 3 + 1],
      yr = this.skel.cp[fr * 3 + 1];
    let best = this.locoPhase,
      bestE = Infinity;
    const saved = this.locoPhase;
    for (let j = 0; j < 20; j++) {
      this.locoPhase = j / 20;
      this.locoPose(this.P.tmp, Math.max(v, 3));
      this.skel.fk(this.P.tmp);
      const e =
        (this.skel.cp[fl * 3 + 2] - zl) ** 2 +
        (this.skel.cp[fr * 3 + 2] - zr) ** 2 +
        2 *
          ((this.skel.cp[fl * 3 + 1] - yl) ** 2 +
            (this.skel.cp[fr * 3 + 1] - yr) ** 2);
      if (e < bestE) {
        bestE = e;
        best = j / 20;
      }
    }
    this.locoPhase = best;
    this.b.dirty = true;
    return saved;
  }
}

// ---- procedural release tricks (user r10: "full body roll (not crouched roll, but loose body flip over), and a few others").
// Body shape = trunk FK (from bind) + limb IK on top of the normal air pose, weighted by w (in/out envelope). Limb targets are
// offsets in units of limb length (from the shoulder / hip, char space: X = his left, Y = up, Z = forward) passed through
// under-damped springs so the limbs lag, flow and overshoot a little (loose, not stiff). Root rotation: trickSpin (via the
// trick node's spin() hook, about the body centre). D.side (A.trickSide): layout +1 front / -1 back flip;
// corkscrew +1 toward his right.
const _tv = new THREE.Vector3(),
  _tv2 = new THREE.Vector3(),
  _tq = new THREE.Quaternion(),
  _tq2 = new THREE.Quaternion();
const seg = (u, a, b) => smoother((u - a) / (b - a));
const tv = (x, y, z) => new THREE.Vector3(x, y, z);
function trickSpin(D, u, t, out) {
  const sd = D.side;
  switch (D.tr) {
    case "layout": {
      if (D.seam) {
        // user r10c: straight out of the web — continues the release body pitch (phi0) and keeps rotating (no settle)
        const e = remap(u, 0, 0.9),
          p = 0.7 * smooth(e) + 0.3 * e; // starts already turning, eases out
        out.setFromAxisAngle(X, lerp(D.phi0, D.phiEnd, p));
        return out.multiply(_tq.copy(D.resid).slerp(QI, smooth(t / 0.3)));
      }
      return out.setFromAxisAngle(X, sd * TAU * smooth(remap(u, 0.06, 0.92))); // eased in and out (user r10b: slower)
    }
    case "corkscrew": {
      // stretched out along the travel (pitched ~70 deg) and one full twist about the long axis
      const p = 1.2 * smooth(u / 0.2) * (1 - smooth((u - 0.7) / 0.28));
      return out
        .setFromAxisAngle(X, p)
        .multiply(
          _tq.setFromAxisAngle(Y, -sd * TAU * smoother(remap(u, 0.12, 0.86))),
        );
    }
    case "tuckFlip":
      return out.setFromAxisAngle(X, TAU * smooth(remap(u, 0.05, 0.86))); // tucked forward somersault
    case "scissor":
      return out.setFromAxisAngle(
        X,
        0.3 * smooth(u / 0.25) * (1 - smooth((u - 0.68) / 0.3)),
      );
  }
  return null;
}
function trickPose(S, out, D, u, w) {
  if (w < 0.005) return;
  const b = S.b.begin(out),
    tr = D.tr,
    sd = D.side,
    T = S.time;
  if (!D.len) {
    const P = (k) => b.pos(k, new THREE.Vector3());
    D.len = {
      arm:
        P("upperArmL").distanceTo(P("lowerArmL")) +
        P("lowerArmL").distanceTo(P("handL")),
      leg:
        P("upperLegL").distanceTo(P("lowerLegL")) +
        P("lowerLegL").distanceTo(P("footL")),
    };
  }
  const mid = smooth(u / 0.2) * (1 - smooth((u - 0.72) / 0.26));
  // trunk: arch (+ = bend backward, - = curl forward), head pitch (+ = look up/back)
  let arch = 0,
    head = 0,
    lean = 0,
    pt = 0,
    grab = 0;
  const arm = {},
    leg = {}; // S -> [offset (limb lengths; |offset| < 1 = bent), reach 0..1]
  for (const Sd of ["L", "R"]) {
    const sx = Sd === "L" ? 1 : -1,
      lead = sx === sd ? 1 : 0;
    const fl = Math.sin(T * 6.1 + sx) * 0.04; // a little flutter so nothing freezes
    if (tr === "layout") {
      // user r10b pose progression: arms sweep overhead + arch -> arms wide, legs split with a soft bend,
      // head tucked a touch -> arms down & forward, legs together reaching down for the landing / next swing
      const k1 = seg(u, 0.22, 0.42),
        k2 = seg(u, 0.64, 0.84),
        e0 = D.seam ? 1 : smooth(u / 0.15);
      const a0 = tv(sx * 0.3, 1, 0.2),
        a1 = tv(sx * 1, 0.28 + fl, -0.12),
        a2 = tv(sx * 0.5, -0.5, 0.5);
      arm[Sd] = [
        a0.lerp(a1, k1).lerp(a2, k2),
        lerp(lerp(0.95, 0.92, k1), 0.86, k2),
      ];
      const l0 = tv(sx * 0.07, -1, -0.04),
        l1 = tv(sx * 0.09, -0.92, lead ? 0.34 : -0.28),
        l2 = tv(sx * 0.07, -1, 0.1);
      leg[Sd] = [
        l0.lerp(l1, k1).lerp(l2, k2),
        lerp(lerp(0.97, 0.9, k1), 0.97, k2),
      ];
      arch = lerp(lerp(sd < 0 ? 0.32 : 0.22, 0, k1), 0.02, k2) * e0;
      head = lerp(lerp(sd < 0 ? 0.35 : 0.1, -0.22, k1), 0, k2) * e0;
    } else if (tr === "corkscrew") {
      // arms out -> pulled in across the chest (spin up) -> thrown out again; legs together
      const a0 = tv(sx * 1, 0.1, 0.05),
        a1 = tv(sx * 0.12, -0.42, 0.5),
        a2 = tv(sx * 0.9, 0.3 + fl, -0.15); // a1: fists in front of his own chest half (never across the midline: IK flip, coordinator r10d)
      arm[Sd] = [
        a0.lerp(a1, seg(u, 0.12, 0.3)).lerp(a2, seg(u, 0.6, 0.82)),
        0.95,
      ];
      leg[Sd] = [tv(-sx * 0.025 * mid, -1, lead ? 0.03 : -0.03), 0.985];
      arch = 0.08 * mid;
      head = 0.1 * mid;
    } else if (tr === "tuckFlip") {
      // user r10c: quick tuck (knees to chest, hands on the shins) -> open out, legs down, arms out
      const g = seg(u, 0.03, 0.16) * (1 - seg(u, 0.6, 0.8));
      grab = g;
      leg[Sd] = [
        tv(sx * 0.08, -1, 0.06).lerp(tv(sx * 0.13, -0.16, 0.4), g),
        0.97,
      ];
      arm[Sd] = [
        tv(sx * 0.6, 0.05, 0.35).lerp(
          tv(sx * 0.95, 0.15 + fl, 0.05),
          seg(u, 0.62, 0.86),
        ),
        0.92,
      ];
      arch = -0.5 * g;
      head = -0.35 * g;
    } else {
      // scissor: 1.5 air strides, arms counter-pumping
      const ph = TAU * 1.5 * u + (sx > 0 ? 0 : Math.PI),
        fwd = Math.sin(ph);
      leg[Sd] = [tv(sx * 0.08, -0.8, 0.78 * fwd), fwd > 0 ? 0.96 : 0.8];
      arm[Sd] = [
        tv(sx * 0.55, -0.15 + 0.25 * Math.max(0, -fwd), -0.6 * fwd),
        0.85,
      ];
      lean = 0.12 * mid;
      head = 0.2 * mid;
    }
  }
  // trunk (absolute from bind, weighted)
  const c = [
    ["spine", 0.35],
    ["spine1", 0.65],
    ["chest", 1],
  ];
  for (const [k, f] of c)
    b.fromBind(k, _tq.setFromAxisAngle(X, lean - arch * f), w);
  b.fromBind("neck", _tq.setFromAxisAngle(X, lean - arch - head * 0.4), w);
  b.fromBind("head", _tq.setFromAxisAngle(X, lean - arch - head), w);
  // limbs: springs on the offsets (loose follow-through), IK from the current shoulder / hip. Seamless release: the springs
  // start from the limbs' positions in the last frame (the swing pose), so the arms come off the web instead of jumping.
  if (!D.spr) {
    D.spr = {};
    for (const k of ["aL", "aR", "lL", "lR"]) {
      D.spr[k] = new Spring3(k[0] === "a" ? 2.8 : 3.4, 0.55);
      D.spr[k].x.copy((k[0] === "a" ? arm : leg)[k[1]][0]);
    }
    if (D.seam && S.P.prev) {
      const pb = S.b.begin(S.P.prev),
        P = (k) => pb.pos(k, new THREE.Vector3());
      for (const Sd of ["L", "R"]) {
        D.spr["a" + Sd].x.copy(
          P("hand" + Sd)
            .sub(P("upperArm" + Sd))
            .divideScalar(D.len.arm),
        );
        D.spr["l" + Sd].x.copy(
          P("foot" + Sd)
            .sub(P("upperLeg" + Sd))
            .divideScalar(D.len.leg),
        );
      }
      S.b.begin(out);
    }
  }
  const dt = S.dt || 1 / 60;
  for (const Sd of ["L", "R"]) {
    const sx = Sd === "L" ? 1 : -1;
    // legs first (the tuck's hands grab the shins)
    const [lo, lr] = leg[Sd],
      sl = D.spr["l" + Sd].step(lo, dt);
    const hp = b.pos("upperLeg" + Sd, new THREE.Vector3());
    const lt = _tv
      .copy(sl)
      .normalize()
      .multiplyScalar(lr * D.len.leg * clamp(sl.length(), 0.3, 1))
      .add(hp);
    // knee pole: perpendicular to the hip->foot line in the sagittal plane, toward the front (continuous for any leg
    // direction: down -> knee forward, kicked forward -> knee up; never parallel to the leg, so no hinge flips)
    {
      const d = _tv2.copy(lt).sub(hp),
        yz = Math.hypot(d.y, d.z) || 1;
      _tv2.set(sx * 0.15, d.z / yz, -d.y / yz).add(hp);
    }
    b.ik("leg", Sd, lt, _tv2, w, { absolute: true });
    if (pt || tr !== "scissor")
      b.rot("foot" + Sd, X, (0.35 + pt * 0.5) * w * mid); // toes pointed
    const [ao, ar] = arm[Sd],
      sa = D.spr["a" + Sd].step(ao, dt);
    const sh = b.pos("upperArm" + Sd, new THREE.Vector3());
    const at = _tv
      .copy(sa)
      .normalize()
      .multiplyScalar(ar * D.len.arm * clamp(sa.length(), 0.4, 1))
      .add(sh);
    if (grab > 0.001) {
      // hands on the shins, a little below the knee, on the outside-front
      const kn = b.pos("lowerLeg" + Sd, new THREE.Vector3()),
        an = b.pos("foot" + Sd, new THREE.Vector3());
      at.lerp(kn.lerp(an, 0.4).add(_tv2.set(sx * 0.06, 0, 0.07)), grab);
    }
    // hands never cross the body midline (IK hinge flip, coordinator r10d)
    if (sx * at.x < 0.05) at.x = sx * 0.05;
    // elbow pole: out/back/down; where the arm points along that (arm swung back / out-back) it hands over smoothly to
    // down/forward, so the pole is never parallel to the arm (no per-frame elbow-plane flips)
    {
      const d = _tv2.copy(at).sub(sh).normalize(),
        p1 = tv(sx * 0.6, -0.25, -0.45).normalize(),
        p2 = tv(sx * 0.2, -0.9, 0.35).normalize();
      if (tr === "scissor") p1.set(sx * 0.3, -1, 0).normalize(); // pumping arms swing fore/aft through the side: elbows down
      const k =
        tr === "scissor" ? 0 : smooth((Math.abs(d.dot(p1)) - 0.7) / 0.2);
      _tv2.copy(p1.lerp(p2, k)).add(sh);
    }
    b.ik("arm", Sd, at, _tv2, w, { absolute: true });
    const iF = b.i("lowerArm" + Sd),
      iH = b.i("hand" + Sd);
    if (iF >= 0 && iH >= 0) {
      // wrist continues the forearm line
      const fq = b.cq("lowerArm" + Sd, new THREE.Quaternion());
      b.setCQ(
        "hand" + Sd,
        fq.multiply(S.skel.bQ(iF, _tq2).invert()).multiply(S.skel.bQ(iH, _tq)),
        w,
      );
    }
    if (grab > 0.01) {
      S.rd.curl(out, Sd, 0.8, grab * w);
      b.dirty = true;
    } // fingers close round the shin
  }
}

// orthonormal frame (x = d, y = n x d ... ) as a quaternion: maps (X -> d, Z -> n) after orthogonalising n against d
function basisQ(d, n) {
  const x = d.clone().normalize(),
    z = n.clone().addScaledVector(x, -n.dot(x)).normalize(),
    y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(x, y, z),
  );
}
function rdCurl(S, pose, side, amt) {
  S.rd.curl(pose, side, amt, 1);
  S.b.dirty = true;
}
function lerpAngle(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

// =================================================================================================== nodes
function makeNodes(S) {
  const C = S.clips;
  const oneShot = (name, t, out, opts = {}) =>
    C.sample(name, Math.min(t, C.dur(name) - 1e-3), out, {
      loop: false,
      ...opts,
    });
  const nodes = {
    frozen: { eval() {} },

    // ---- idle + locomotion (walk/jog/run/sprint) + combat stance
    ground: {
      enter(L, A, prev) {
        if (prev && prev.name !== "ground" && S.speedH > 1.5)
          S.matchLocoPhase(S.P.out, S.speedH);
        if (prev && prev.name === "turn180") {
          /* yaw already flipped in turn180.exit */
        }
      },
      eval(L, A, out) {
        const vr = S.speedH,
          D = L.data;
        D.vp = vr >= (D.vp ?? vr) ? vr : damp(D.vp, vr, 9, S.dt); // decel: settle over ~0.35 s
        // user r12: WALK STOP = one short finishing step. A gentle walk deceleration (not a run's 0.3 s planted stop) steers the
        // phase onto the next passing pose (feet side by side, closest to idle) exactly as the body comes to rest: phase
        // speed from the remaining stop distance, stride k from phase speed (k * vN * dur * phase/s == ground speed, so the
        // planted foot never slides). The loco weight holds until the step lands, then settles into idle over ~0.3 s.
        const wm = S.locoMeta("walk");
        const slowing = vr < (D.vrPrev ?? vr) - 1e-4 || vr < 0.02;
        D.vrPrev = vr;
        if (
          wm &&
          !D.stop &&
          slowing &&
          vr < 1.75 &&
          vr > 0.05 &&
          D.vp < 2.2 &&
          (S.decel ?? 0) < 9 &&
          A.mode !== "combat" &&
          S.locoInfo?.clipA === "walk"
        ) {
          let dP = (((wm.pass - S.locoPhase) % 0.5) + 0.5) % 0.5;
          if (dP < 0.2) dP += 0.5;
          D.stop = { rem: dP, done: false };
        }
        let ovr = null;
        if (D.stop) {
          const st = D.stop,
            rem = st.rem;
          if (!slowing)
            D.stop = null; // speeding up again: back to the normal cycle
          else if (!st.done) {
            const aEst = Math.max(1.5, S.decel || 0),
              Drem = Math.max((vr * vr) / (2 * aEst), 0.02);
            const fc = clamp((rem * Math.max(vr, 0.25)) / Drem, 0.35, 2.4); // phase / s
            const k = clamp(Math.max(vr, 0) / (wm.v * wm.dur * fc), 0.12, 1.3);
            ovr = { k, rate: fc, fc };
            D.vp = Math.max(D.vp, 1.3);
          }
        }
        const v = D.vp;
        // fight-ready stance near enemies: the guard idle cross-fades in / out (~0.35 s), never a pose swap
        D.cw = damp(
          D.cw ?? 0,
          A.mode === "combat" && C.has("fightIdle") ? 1 : 0,
          6,
          S.dt,
        );
        const combat = D.cw > 0.5;
        const idleName = C.first("idle");
        const wl = smooth((v - 0.15) / 1.1);
        if (wl < 0.999) {
          if (D.cw < 0.999 && !C.sample(idleName, S.idleT, S.P.idle))
            S.fallback("idle", S.idleT, S.P.idle);
          if (D.cw > 0.001) {
            if (D.cw >= 0.999) C.sample("fightIdle", S.idleT, S.P.idle);
            else {
              C.sample("fightIdle", S.idleT, S.P.fi);
              blendPoses(
                S.P.idle,
                S.P.fi,
                smooth(D.cw),
                S.P.idle,
                null,
                S.bm(8 + L.key),
              );
            }
          }
        } else S.idleT = 0;
        // walk start: leave idle from the passing pose (one foot swings through first), not a random phase
        if (
          wl > 0.001 &&
          (D.wlPrev ?? 0) <= 0.001 &&
          wm &&
          vr >= v - 1e-3 &&
          !D.stop
        )
          S.locoPhase = wm.pass;
        D.wlPrev = wl;
        if (wl <= 0.001) D.stop = null;
        if (wl > 0.001) {
          S.locoPose(S.P.loco, v, ovr);
          S.walkForm(
            S.P.loco,
            (1 - smooth((v - 1.9) / 1.8)) *
              smooth((v - 0.05) / 0.6 + (ovr ? 1 : 0)),
          );
          S.armPump(S.P.loco, v, smooth((v - 0.4) / 1.2));
          S.runTrack(S.P.loco, v);
          if (ovr) {
            const adv = Math.min(S.dt * ovr.fc, D.stop.rem);
            D.stop.rem -= adv;
            S.locoPhase = (S.locoPhase + adv) % 1;
            if (D.stop.rem <= 1e-3) D.stop.done = true;
          } else if (!(D.stop && D.stop.done))
            S.locoPhase =
              (S.locoPhase +
                S.dt * S.locoInfo.rate * clamp(vr / Math.max(v, 0.1), 0, 1)) %
              1;
          L.data.clip = S.locoInfo.clipA
            ? `${S.locoInfo.clipA}>${S.locoInfo.clipB}@${S.locoInfo.w.toFixed(2)} r${S.locoInfo.rate.toFixed(2)} k${S.locoInfo.k.toFixed(2)}`
            : "gait";
          if (wl < 0.999)
            blendPoses(S.P.idle, S.P.loco, wl, out, null, S.bm(9 + L.key));
          else out.copy(S.P.loco);
        } else {
          out.copy(S.P.idle);
          L.data.clip = idleName;
        }
        if (wl < 0.999 && D.cw < 0.999)
          S.widenStance(out, (1 - wl) * (1 - smooth(D.cw)));
        L.data.bal = damp(L.data.bal || 0, A.balance ? 1 : 0, 6, S.dt);
        if (L.data.bal > 0.01) {
          S.balance(out, smooth(L.data.bal));
          L.data.clip += " +balance";
        }
      },
    },
    runStart: {
      enter(L) {
        L.data.clip = "runStart";
      },
      hold: (L, A) =>
        A.mode === "ground" &&
        S.speedH > 0.2 &&
        (L.t < 0.2 || S.speedH > 2.5) &&
        L.t < C.dur("runStart") / 1.1 - 0.12,
      eval(L, A, out) {
        oneShot("runStart", L.t * 1.1, out);
      },
    },
    runStop: {
      enter(L) {
        L.data.clip = "runStop";
      },
      hold: (L, A) =>
        A.mode === "ground" &&
        S.speedH < 2.5 &&
        L.t < C.dur("runStop") - 0.1 &&
        A.sub !== "jumpCharge",
      eval(L, A, out) {
        oneShot("runStop", L.t, out);
        // the authored skid throws both arms up high: keep ~half of it (balance, not a flail)
        const idle = C.first("idle");
        if (idle) {
          C.sample(idle, S.idleT, S.P.c);
          blendPoses(
            out,
            S.P.c,
            0.5,
            out,
            S.armMask || (S.armMask = S.maskFor("arms")),
            S.bm(10 + L.key),
          );
        }
        S.groundContact(out, 1);
      },
    },
    turn180: {
      holdYaw: true,
      enter(L, A) {
        const want = Math.atan2(A.velocity.x, A.velocity.z);
        const d = Math.atan2(Math.sin(want - S.yaw), Math.cos(want - S.yaw));
        const clipTurn = C.yawDelta("turn180");
        L.data.mirror = Math.sign(d) !== Math.sign(clipTurn || 1);
        L.data.delta = L.data.mirror ? -clipTurn : clipTurn;
        L.data.clip = "turn180" + (L.data.mirror ? "(m)" : "");
      },
      hold: (L, A) => A.mode === "ground" && L.t < C.dur("turn180") - 0.05,
      exit(L) {},
      eval(L, A, out) {
        oneShot("turn180", L.t, out);
        if (L.data.mirror) S.mirror(out);
        if (!L.data.done && L.t >= C.dur("turn180") - 0.06) {
          // hand the rotation over to the visual yaw
          L.data.done = true;
          S.yaw += L.data.delta;
          S.frameQ.premultiply(_q2.setFromAxisAngle(Y, L.data.delta)); // snap the root with it (pose is counter-rotated below)
        }
        if (L.data.done) {
          S.b.begin(out);
          S.b.rot("hips", Y, -L.data.delta);
        }
      },
    },

    // ---- jump
    // anticipation dip layered over whatever the feet were doing (idle or running): no pop into an idle crouch
    jumpCharge: {
      enter(L) {
        L.data.clip = "jumpCrouch";
        L.data.c = 0;
      },
      eval(L, A, out) {
        L.data.c = damp(L.data.c, clamp(A.jumpCharge ?? 0.6, 0, 1), 12, S.dt);
        const c = L.data.c,
          v = S.speedH;
        nodes.ground.eval(L, A, S.P.c); // current idle / locomotion pose (advances the loco phase)
        if (!C.sample("jumpCrouch", 0.1 + L.t * 0.8, S.P.a)) {
          S.fallback("jump", 0, S.P.a);
        }
        const moving = smooth((v - 1) / 3);
        const wC =
          lerp(0.35 + 0.6 * smooth(c), 0.22 + 0.45 * smooth(c), moving) *
          smooth(L.t / 0.12 + 0.3);
        blendPoses(S.P.c, S.P.a, wC, out, null, S.bm(11 + L.key));
        L.data.clip = "jumpCrouch+" + (v > 1 ? "loco" : "idle");
      },
    },
    jumpLaunch: {
      enter(L, A, prev) {
        S.jumpLead = -(S.jumpLead ?? -1); // alternate the lead arm each jump
        const high =
          (A.jumpCharge ?? 0) > 0.45 ||
          (A.velocity?.y ?? 0) > 11.5 ||
          (prev && prev.name === "jumpCharge" && (A.jumpCharge ?? 1) > 0.45);
        // user r10: "wings" variant (knees tucked under, arms spread wide) on ~40% of jumps and always on charged/high ones
        S.jumpWingsOn =
          globalThis.__jumpWings != null
            ? !!globalThis.__jumpWings
            : high || Math.random() < 0.4;
        L.data.clip =
          high && C.has("jumpLaunchHigh")
            ? "jumpLaunchHigh"
            : C.first("jumpLaunchSmall", "jump");
        // (user r-anim3) knee tuck depth per jump: higher launches tuck deeper, plus a little randomness
        S.jumpTuckK = clamp(
          lerp(
            0.75,
            1.2,
            clamp((Math.max(A.velocity?.y ?? 0, high ? 13 : 8) - 6) / 8, 0, 1),
          ) *
            (0.88 + 0.24 * Math.random()),
          0.6,
          1.25,
        );
        // anticipation already shown (charge node) or running => start at the extension; standing tap => short dip
        const run = S.speedH > 2.5;
        L.data.t0 =
          prev && prev.name === "jumpCharge"
            ? L.data.clip === "jumpLaunchHigh"
              ? 0.1
              : 0.06
            : run
              ? 0.12
              : A.grounded
                ? 0.02
                : 0.1;
      },
      hold: (L, A) =>
        (A.mode === "air" || A.mode === "ground") &&
        L.t + L.data.t0 < C.dur(L.data.clip) - 0.1 &&
        (A.velocity?.y ?? 0) > -3 &&
        !A.trick,
      eval(L, A, out) {
        if (!oneShot(L.data.clip, L.t + L.data.t0, out)) {
          S.fallback("jump", 0, out);
          return;
        }
        // high launch: arms drive up but not locked straight overhead — relax them toward the rise pose
        if (L.data.clip !== "jumpLaunchHigh" && C.has("jumpCrouch")) {
          C.sample("jumpCrouch", 0.3, S.P.c);
          blendPoses(
            out,
            S.P.c,
            0.6,
            out,
            S.armMask || (S.armMask = S.maskFor("arms")),
            S.bm(12 + L.key),
          );
        }
        if (L.data.clip === "jumpLaunchHigh" && C.has("airRise")) {
          C.sample("airRise", L.t, S.P.c);
          blendPoses(
            out,
            S.P.c,
            0.6 * smooth((L.t + L.data.t0 - 0.04) / 0.14),
            out,
            S.armMask || (S.armMask = S.maskFor("arms")),
            S.bm(13 + L.key),
          );
        }
        S.jumpArms(out, smooth((L.t + L.data.t0 - 0.02) / 0.12) * 0.9, 1, 0);
        S.jumpTuck(
          out,
          smooth((L.t + L.data.t0 - 0.1) / 0.18) * 0.8 * (S.jumpTuckK ?? 1),
        );
        S.jumpWings(
          out,
          S.jumpWingsW(S.jumpWingsOn && L.t + L.data.t0 > 0.05 ? 1 : 0),
        );
      },
    },
    air: {
      enter(L, A, prev) {
        L.data.rel = null;
        const fromSwing =
          prev && (prev.name === "swing" || prev.name === "zip");
        L.data.hop = !!(
          prev &&
          prev.name === "jumpLaunch" &&
          prev.data.clip !== "jumpLaunchHigh"
        );
        L.data.wings = !!(prev && prev.name === "jumpLaunch" && S.jumpWingsOn); // the wings jump carries on through the air
        L.data.fromJump = !!(prev && prev.name === "jumpLaunch");
        const tr = A.trick;
        if (
          tr === "spread" ||
          tr === "tuck" ||
          fromSwing ||
          A.sub === "release"
        ) {
          // explicit variant from traversal, else alternate (spread is the default "star" release; tuck on big pops)
          S.relCount = (S.relCount || 0) + 1;
          // variant follows the release trajectory (user feedback #4b): steep/high & slow (released at the top of the arc)
          // -> tuck; flat/forward (released early in the upswing) -> spread "star"
          // user r10: never the tucked releaseTuck ball ("tries to crouch") — a plain release is the open spread pose
          const want = "releaseSpread";
          if (C.has(want)) L.data.rel = want;
        }
        L.data.dive = 0;
      },
      eval(L, A, out) {
        const vy = A.velocity?.y ?? 0;
        const t = S.airT;
        // vy blend space: rise (+) / apex / fall (-) / dive (fast freefall)
        const wr = smooth((vy - 1) / 5),
          wf = smooth((-vy - 1) / 6);
        const diving =
          A.sub === "dive" || A.dive || A.glide || (vy < -17 && t > 0.9);
        L.data.dive = damp(L.data.dive, diving ? 1 : 0, 2.5, S.dt);
        const rise = C.first("airRise", "jump"),
          apex = C.first("airApex", "airRise"),
          fall = C.first("fallCalm", "airApex", "fall"),
          dive = C.first("fallFast", "fall");
        const ok = rise && apex && fall;
        if (!ok) {
          S.fallback((A.velocity?.y ?? 0) < -8 ? "fall" : "jump", S.airT, out);
          return;
        }
        C.sample(apex, t, S.P.a);
        if (wr > 0.001) {
          C.sample(rise, t, S.P.b);
          blendPoses(S.P.a, S.P.b, wr, S.P.a, null, S.bm(14 + L.key));
        }
        if (wf > 0.001) {
          C.sample(fall, t, S.P.b);
          blendPoses(S.P.a, S.P.b, wf, S.P.a, null, S.bm(15 + L.key));
        }
        if (L.data.dive > 0.001 && dive) {
          C.sample(dive, t, S.P.b);
          blendPoses(
            S.P.a,
            S.P.b,
            smooth(L.data.dive),
            S.P.a,
            null,
            S.bm(16 + L.key),
          );
        }
        L.data.clip =
          wr > 0.5 ? rise : wf > 0.5 ? (L.data.dive > 0.5 ? dive : fall) : apex;
        L.data.relW = 0;
        if (L.data.rel) {
          // release variant one-shot, then melt into the blend space
          const d = C.dur(L.data.rel),
            wRel = 1 - smooth((L.t - (d - 0.35)) / 0.35);
          L.data.relW = wRel; // (user r-anim6) the knee tuck fades in as the release melts out (was 0 -> 0.8 in one frame)
          if (wRel > 0.001) {
            oneShot(L.data.rel, L.t, S.P.b);
            blendPoses(S.P.a, S.P.b, wRel, S.P.a, null, S.bm(17 + L.key));
            L.data.clip = L.data.rel;
          } else L.data.rel = null;
        }
        out.copy(S.P.a);
        // user r10m: a real head-first dive (refs/swing/dive_*) — the whole body tips toward head-down as the fall speeds up
        {
          const dk =
            smooth(L.data.dive) * smooth((-vy - 10) / 22) * (A.glide ? 0 : 1);
          if (dk > 0.001) {
            const bd = S.b.begin(out);
            bd.rot("hips", X, (window.__divePitch ?? 1.2) * dk);
          }
        }
        if (L.data.hop && C.has("jumpCrouch")) {
          C.sample("jumpCrouch", 0.3, S.P.c);
          blendPoses(
            out,
            S.P.c,
            0.5,
            out,
            S.armMask || (S.armMask = S.maskFor("arms")),
            S.bm(18 + L.key),
          );
        }
        // user r17: free arms are ALWAYS the jump-arm pose in the air — also through the release one-shot (the old
        // 0 -> 0.85 switch when the release clip ended popped the clip's inward-twisted arms to the jump arms)
        {
          const wa = (1 - smooth(L.data.dive)) * 0.85;
          S.jumpArms(out, wa, wr, wf);
        }
        {
          const wt =
            (1 - smooth(L.data.dive)) *
            (1 - L.data.relW) *
            (1 - smooth((-vy - 3) / 6)) *
            0.8 *
            (L.data.fromJump ? (S.jumpTuckK ?? 1) : 1);
          S.jumpTuck(out, wt);
        }
        // wings variant: holds through the rise + apex, relaxes as he falls toward a landing (spring blend, no pop)
        S.jumpWings(
          out,
          S.jumpWingsW(
            L.data.wings && !L.data.rel
              ? (1 - smooth(L.data.dive)) * (1 - smooth((-vy - 2) / 7))
              : 0,
          ),
        );
        // (anim r2 critic: a running landing touched down bolt upright, knees locked, then popped into the run) with real
        // forward speed the last ~0.3 s of the fall already blends the LEGS into the run stride, so he lands running
        // (user r-anim5: blending the arms too switched them into the run swing mid-air - they keep the jump arms)
        {
          const C0 = S.io?.center,
            W = S.world,
            hs = S.speedH;
          let rw = 0;
          if (C0 && W?.groundHeight && vy < -1 && hs > 4 && !L.data.rel) {
            const g = W.groundHeight(C0.x, C0.z, C0.y);
            if (g != null && isFinite(g)) {
              const tti = (C0.y - (S.io.H ?? 0.95) - g) / Math.max(2, -vy);
              rw =
                smooth((0.32 - tti) / 0.24) *
                smooth((hs - 4) / 3) *
                (1 - smooth(L.data.dive));
            }
          }
          L.data.runIn = damp(L.data.runIn || 0, rw, 14, S.dt);
          if (L.data.runIn > 0.01) {
            S.locoPose(S.P.c, hs);
            S.armPump(S.P.c, hs, 1);
            S.runTrack(S.P.c, hs);
            blendPoses(
              out,
              S.P.c,
              smooth(L.data.runIn) * 0.85,
              out,
              S.legMask || (S.legMask = S.maskFor("legs")),
              S.bm(19 + L.key),
            );
          }
        }
        S.groundReach(out, A);
      },
    },
    trick: {
      enter(L, A, prev) {
        const tr = A.trick || "layout";
        if (PTRICK[tr]) {
          // procedural release trick on top of the normal air blend (it melts back into it)
          Object.assign(L.data, {
            proc: true,
            tr,
            dur: PTRICK[tr],
            side: A.trickSide || 1,
            clip: "trick:" + tr,
            spr: null,
            air: { t: 0, data: { dive: 0, rel: null, hop: false } },
          });
          if (tr === "layout" && prev && prev.name === "swing") {
            // user r10c: seamless out of the web (same frame, no air settle)
            // the root frame snaps to the air frame and the difference (the release body pitch + any bank) moves into the
            // trick's spin, which keeps rotating from there: the visible orientation is continuous on the release frame
            const D = L.data,
              v = A.velocity,
              yaw =
                v && Math.hypot(v.x, v.z) > 1 ? Math.atan2(v.x, v.z) : S.yaw;
            const qy = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
            const d = qy
              .clone()
              .invert()
              .multiply(S.frameQ)
              .multiply(S.spinS ? S.spinS.q : QI);
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(d);
            D.phi0 = Math.atan2(up.z, up.y);
            D.phiEnd = D.side * TAU;
            D.resid = new THREE.Quaternion()
              .setFromAxisAngle(X, -D.phi0)
              .multiply(d);
            S.frameQ.copy(qy);
            S.yaw = yaw;
            D.seam = true;
            D.noHandover = true;
            L.dur = Math.min(L.dur, 0.12); // swing -> trick pose handoff
          }
          return;
        }
        L.data.clip = C.first(TRICKS[tr], "releaseFlip", "airTrick");
        L.data.reverse = tr === "backflip";
        L.data.mirror =
          tr === "spin" || (tr === "twist" && Math.random() < 0.5);
      },
      hold: (L, A) =>
        A.mode === "air" &&
        L.t < (L.data.proc ? L.data.dur - 0.03 : C.dur(L.data.clip) - 0.12),
      eval(L, A, out) {
        if (L.data.proc) {
          L.data.air.t = L.t;
          nodes.air.eval(L.data.air, A, out);
          const u = clamp(L.t / L.data.dur, 0, 1);
          trickPose(
            S,
            out,
            L.data,
            u,
            (L.data.seam ? 1 : smooth(L.t / 0.15)) *
              (1 -
                smooth(
                  (u - (L.data.tr === "layout" ? 0.84 : 0.76)) /
                    (L.data.tr === "layout" ? 0.16 : 0.22),
                )),
          );
          return;
        }
        const d = C.dur(L.data.clip);
        if (!oneShot(L.data.clip, L.data.reverse ? d - L.t : L.t, out)) {
          S.fallback("swingRelease", L.t / 0.8, out);
          return;
        }
        if (L.data.mirror) S.mirror(out);
      },
      spin: (L) =>
        L.data.proc
          ? trickSpin(L.data, clamp(L.t / L.data.dur, 0, 1), L.t, _q2)
          : null,
    },

    // ---- landings
    land: {
      enter(L, A) {
        const sub = A.sub || "";
        const sev = A.landing?.severity ?? 0.5;
        let clip =
          sub === "landRoll"
            ? "landRoll"
            : sub === "landHard"
              ? "landHard"
              : sub === "landMedium"
                ? "landMedium"
                : sub === "landLight"
                  ? "landLight"
                  : sev > 0.75
                    ? "landHard"
                    : sev > 0.35
                      ? "landMedium"
                      : "landLight";
        clip = C.first(clip, "land", "landMedium");
        L.data.clip = clip;
        L.data.t0 = clip ? C.contactTime(clip) : 0;
        L.data.minHold =
          {
            landLight: 0.1,
            landMedium: 0.22,
            landHard: 0.55,
            landRoll: C.dur("landRoll") - L.data.t0 - 0.15,
            land: 0.3,
          }[clip] ?? 0.2;
      },
      hold(L, A) {
        if (!(A.mode === "land" || A.mode === "ground")) return false;
        if (A.sub === "jumpCharge" || A.sub === "jumpLaunch") return L.t < 0.08;
        const rem = C.dur(L.data.clip) - L.data.t0 - L.t;
        if (S.speedH > 2) return L.t < L.data.minHold;
        return rem > 0.25;
      },
      eval(L, A, out) {
        if (!oneShot(L.data.clip, L.data.t0 + L.t, out))
          S.fallback("land", 0, out);
        if (L.data.clip === "landHard" && S.landHardNeedsFix())
          S.threePoint(out);
        S.groundContact(out, 1);
      },
    },

    // ---- perch: land -> idle (crouched, hands between the feet, looking around)
    perch: {
      enter(L, A, prev) {
        L.data.landed = !(
          prev &&
          (prev.name === "zip" ||
            prev.name === "air" ||
            prev.name === "trick" ||
            prev.name === "pointLaunch" ||
            prev.name === "jumpLaunch")
        );
        L.data.t0 =
          prev && prev.name === "zip" && C.has("zipCatchLevel")
            ? 0.233
            : C.contactTime("perchLand");
      },
      eval(L, A, out) {
        const idle = C.first("perchIdle", "wallPerch");
        if (!C.sample(idle, L.t, S.P.a)) S.fallback("wallPerch", 0, S.P.a);
        L.data.clip = idle;
        let land = 0;
        if (!L.data.landed && C.has("perchLand")) {
          const d = C.dur("perchLand") - L.data.t0,
            w = 1 - smooth((L.t - (d - 0.3)) / 0.3);
          if (w > 0.001) {
            oneShot("perchLand", L.data.t0 + L.t, S.P.b);
            blendPoses(S.P.a, S.P.b, w, S.P.a, null, S.bm(20 + L.key));
            L.data.clip = "perchLand";
          }
          land = 1;
        }
        out.copy(S.P.a);
        // user feedback #7: deep frog squat on the perch point. Authored clips that already have it (knees wide) are
        // used as-is; the legacy hunched clip is replaced by a procedural IK squat with the same idle life.
        S.perchSquat(out, L, land);
        // user r9m: round the back in the crouch (it was a flat, stretched plane): posterior pelvic tilt + flexion spread
        // over the spine chain, neck/head counter-rotate so the gaze stays out over the street
        {
          const bb = S.b.begin(out),
            k = window.__perchRound ?? 1;
          // net pitch ~0: the pelvis tucks back, each spine segment flexes forward -> a curve, not a steeper plank
          bb.rot("hips", X, -0.4 * k);
          bb.rot("spine", X, 0.2 * k);
          bb.rot("spine1", X, 0.14 * k);
          bb.rot("chest", X, 0.08 * k);
          bb.rot("neck", X, -0.02 * k);
        }
        S.perchSeat(out, L, A);
      },
    },
    perchToStand: {
      enter(L) {
        L.data.clip = "perchToStand";
      },
      hold: (L, A) =>
        A.mode === "ground" &&
        S.speedH < 2.5 &&
        L.t < C.dur("perchToStand") - 0.2,
      eval(L, A, out) {
        if (!oneShot("perchToStand", L.t, out)) S.fallback("land", 0, out);
      },
    },

    // ---- web tightrope (mode 'rope'; also perch/perchStand: standing on the point at either end of the line)
    // ropeShoot from a crouched perch: the perch pose (a perch sub-layer keeps evaluating) + the shooting arm; ropeStand:
    // cross-fades up into the balance stance over 0.5 s; ropeIdle / ropeWalk / ropeTurn / perchStand: S.ropePose.
    rope: {
      enter(L, A, prev) {
        L.data.perch = {
          t: prev && prev.name === "perch" ? prev.t : 2,
          data: { landed: true, t0: 0 },
        };
        L.data.clip = "rope";
      },
      eval(L, A, out) {
        const R = A.rope,
          sub = A.sub,
          onRope = A.mode === "rope";
        const fromCrouch =
          onRope &&
          !R.fromStand &&
          (sub === "ropeShoot" || sub === "ropeStand");
        // stand-up: a quick blend (0.15 s) from the perch crouch into the SAME stance sunk into a crouch (similar poses:
        // no half-squat in between), then the stance rises procedurally over the 0.5 s (crouch 1 -> 0)
        const ws = !fromCrouch
          ? 1
          : sub === "ropeShoot"
            ? 0
            : smooth(clamp(A.t / 0.15, 0, 1));
        const crouch = fromCrouch
          ? sub === "ropeShoot"
            ? 1
            : 1 - smoother(clamp(A.t / 0.5, 0, 1))
          : 0;
        S.ropePose(S.P.c, L, A, crouch);
        if (ws < 0.999) {
          const PL = L.data.perch;
          PL.t += S.dt;
          nodes.perch.eval(PL, A, S.P.d);
          blendPoses(S.P.d, S.P.c, ws, out, null, S.bm(21 + L.key));
          L.data.clip =
            (sub === "ropeShoot" ? "rope shoot" : "rope stand") + " +perch";
        } else out.copy(S.P.c);
        if (onRope && R.t < R.pinT + 0.25) S.ropeShootArm(out, A);
      },
    },

    // ---- zip / point launch
    zip: {
      // Web-zip (user feedback #8), procedural 4-key blend (clips webZipFire/webZipYank/zipFlight/zipCatch used when the
      // character agent ships them): FIRE both arms snap toward the target -> YANK fists back to the ribs, body coils,
      // knees up (elastic load) -> FLIGHT streamlined along the velocity (arms swept back, legs trailing, toes pointed)
      // -> CATCH body rights itself, knees come up, feet forward, arms out -> perchLand. Air web-dash keeps the clip.
      enter(L, A, prev) {
        L.data.fg =
          !!prev &&
          TRAITS[prev.name]?.frame === "upright" &&
          Math.abs(A.velocity?.y ?? 0) < 1;
        L.data.dash = !!A.zip?.dash || A.mode !== "zip";
        L.data.clip = L.data.dash
          ? C.first("webZipPull", "webShoot")
          : "zip:fire";
        L.data.zt = 0;
        L.data.travelT = null;
      },
      eval(L, A, out) {
        if (L.data.dash) {
          const d = C.dur(L.data.clip);
          const u =
            A.zip?.t != null
              ? clamp(A.zip.t, 0, 1) * d
              : Math.min(L.t, d - 0.01);
          if (!oneShot(L.data.clip, Math.max(u, Math.min(L.t, 0.25)), out))
            S.fallback("jump", 0, out);
          return;
        }
        S.zipPhases(L, A);
        // fired from the ground: feet stay planted through fire + yank (anticipation crouch), release on launch
        const gT =
          L.data.fg && (A.sub === "zipFire" || A.sub === "zipYank") ? 1 : 0;
        if (L.data.gw == null) L.data.gw = gT;
        else L.data.gw = damp(L.data.gw, gT, gT ? 20 : 14, S.dt);
        S.zipPose(out, L, A);
      },
      frame(L, A) {
        if (L.data.dash)
          return { kind: "zip", tilt: lerp(0.15, 0.6, smooth(L.t / 0.25)) };
        const Z = L.data.ph || { y: 0, g: 0, c: 0 };
        // fire: lean slightly toward the target; yank: pulled toward it; flight: body axis along the path; catch: upright,
        // leaning back against the motion so the feet lead into the perch
        const gw = L.data.gw || 0;
        const tilt =
          lerp(
            lerp(lerp(0.12, 0.3, Z.y), C.has("zipFlight") ? 1 : 0.92, Z.g),
            0.0,
            Z.c,
          ) *
          (1 - 0.75 * gw);
        return {
          kind: "zip",
          tilt,
          back: 0.4 * Z.c,
          useVel: false,
          aim: Z.g > 0.05,
          lay: Z.g * (1 - Z.c),
          catchK: Z.c,
          pivot: 1 - gw,
        };
      },
    },
    pointLaunch: {
      enter(L, A) {
        L.data.clip = "pointLaunch";
        L.data.t0 = A.grounded ? 0 : 0.1;
      },
      hold: (L, A) =>
        (A.mode === "air" || A.mode === "zip") &&
        L.t + L.data.t0 < C.dur("pointLaunch") - 0.15,
      eval(L, A, out) {
        if (!oneShot("pointLaunch", L.t + L.data.t0, out))
          S.fallback("jump", 0, out);
      },
    },

    // ---- web slingshot (A.sling, ground sub 'slingshot'). Own node (does not touch the swing / cling code).
    //  hold: fists out in front at chest height reaching toward the anchors, gripping the strands.
    //  shoot (per Ctrl+click): that side's arm snaps out at the new anchor, wrist flicked back (web-shooter), ~0.15 s,
    //         then eases back into the grip. Driven by an under-damped spring per arm (re-triggers on every click).
    //  pull: crouches (knees bent, hips low and back) and LEANS BACK against the webs, 5..22 deg growing with tension,
    //        feet braced out in front with the heels dug in, small back-steps while moving.
    //  release (A.sling.release 0..1, 0.12 s): forward snap: trunk whips forward, legs extend (push-off), arms pull
    //        in to the chest; then the pointLaunch clip takes over (blend 0.18 s).
    //  All weights are damped / springs: entry from idle/run, gesture, lean and release never pop.
    slingshot: {
      enter(L) {
        const D = L.data;
        D.clip = "slingshot";
        D.k = 0;
        D.ph = 0;
        D.in = 0;
        D.mv = 0;
        D.rel = 0;
        D.grip = 0;
        D.g = { L: 0, R: 0 };
        D.gv = { L: 0, R: 0 };
        D.aim = {
          L: new THREE.Vector3(0.6, 0.5, 1).normalize(),
          R: new THREE.Vector3(-0.6, 0.5, 1).normalize(),
        };
        D.hold = {
          L: new THREE.Vector3(0.5, 0.2, 1).normalize(),
          R: new THREE.Vector3(-0.5, 0.2, 1).normalize(),
        };
      },
      eval(L, A, out) {
        const sl = A.sling || {},
          D = L.data,
          rd = S.rd,
          dt = S.dt;
        const anc = sl.anchors || [];
        D.k = damp(D.k, clamp(sl.tension || 0, 0, 1), 9, dt);
        D.in = damp(D.in, 1, 7, dt);
        D.mv = damp(D.mv, clamp(Math.abs(sl.moving || 0), 0, 1), 8, dt);
        D.rel = damp(
          D.rel,
          sl.release >= 0 ? 1 : 0,
          sl.release >= 0 ? 30 : 6,
          dt,
        );
        D.grip = damp(D.grip, anc.length ? 1 : 0.35, 8, dt);
        const k = D.k * (1 - D.rel),
          mv = D.mv,
          rel = D.rel,
          e = smooth(D.in);
        D.ph = (D.ph + dt * (1.1 + 0.9 * (1 - D.k)) * mv) % 1;
        // per side: newest anchor drives the shoot gesture; mean anchor direction drives the hold reach
        for (const Sd of ["L", "R"]) {
          const side = Sd === "L" ? -1 : 1;
          let young = null,
            n = 0;
          const m = _v3.set(0, 0, 0);
          for (const a of anc)
            if (a.side === side) {
              n++;
              if (!young || a.t < young.t) young = a;
              if (S.charToWorld)
                m.add(
                  S.worldToChar(a.p, _v4)
                    .sub(_v2.set(0, 1.35, 0))
                    .normalize(),
                );
            }
          if (young && S.charToWorld) {
            const d = S.worldToChar(young.p, _v4).sub(_v2.set(0, 1.4, 0));
            d.z = Math.max(d.z, 0.15);
            D.aim[Sd].copy(d.normalize());
          }
          if (n && m.lengthSq() > 1e-4) {
            m.normalize();
            m.y = clamp(m.y, -0.1, 0.35);
            m.z = Math.max(m.z, 0.5);
            D.hold[Sd].lerp(m.normalize(), 1 - Math.exp(-6 * dt)).normalize();
          }
          // spring: target 1 for the first 0.15 s after a click (snap out), then back to 0 (overshoot = organic settle)
          const tgt = young && young.t < 0.15 ? 1 : 0,
            w = 30,
            z = 0.55;
          D.gv[Sd] += (w * w * (tgt - D.g[Sd]) - 2 * z * w * D.gv[Sd]) * dt;
          D.g[Sd] += D.gv[Sd] * dt;
        }
        const idle = C.first("idle");
        if (!idle || !C.sample(idle, S.idleT, out))
          S.fallback("idle", S.idleT, out);
        const b = S.b.begin(out);
        // trunk: lean back + crouch with tension; release whips it forward and extends the legs
        b.moveHips(
          0,
          e * (-0.03 - 0.15 * k) + rel * 0.05,
          e * (-0.02 - 0.1 * k) + rel * 0.1,
        );
        b.rot("hips", X, e * (-0.06 - 0.32 * k) + rel * 0.32);
        b.rot("spine", X, e * (0.03 + 0.04 * k) + rel * 0.1);
        if (b.i("spine1") >= 0) b.rot("spine1", X, e * 0.03 + rel * 0.06);
        b.rot("chest", X, e * 0.02 * k);
        b.rot("neck", X, e * (0.08 + 0.18 * k) - rel * 0.12);
        b.rot("head", X, e * (0.05 + 0.12 * k) - rel * 0.1); // gaze stays level / ahead
        // legs: braced out in front (the webs hold him up), heels digging in; alternating small back-steps; push-off on release
        for (const Sd of ["L", "R"]) {
          const sx = Sd === "L" ? 1 : -1,
            th = rd.thigh[Sd];
          const cyc = (D.ph + (Sd === "L" ? 0 : 0.5)) * 2 * Math.PI;
          const z =
            e * ((Sd === "L" ? 0.2 : 0.02) + 0.18 * k) +
            0.08 * mv * Math.cos(cyc) -
            rel * (Sd === "L" ? 0.1 : 0.2);
          const lift = 0.06 * mv * Math.max(0, Math.sin(cyc));
          const fq = b.cq("foot" + Sd, new THREE.Quaternion());
          b.ik(
            "leg",
            Sd,
            _v4.set(sx * (0.15 + 0.04 * k), rd.ankleH + lift + 0.03 * k, z),
            new THREE.Vector3(sx * 0.25, th.y - 0.1, 0.9),
            e,
            { absolute: true },
          );
          b.setCQ("foot" + Sd, fq);
          b.fromBind("foot" + Sd, QI, e);
          b.rot(
            "foot" + Sd,
            X,
            e *
              (-0.4 * k - 0.25 * mv * Math.max(0, Math.sin(cyc))) *
              (1 - rel) +
              rel * 0.35,
          ); // heel dig / toe push
        }
        // arms: hold (reach toward the anchors at chest height) <-> shoot (straight at the new anchor, wrist flicked);
        // release pulls both fists in to the chest
        const ch = b.pos("chest", new THREE.Vector3()),
          reach = rd.a1 + rd.a2;
        for (const Sd of ["L", "R"]) {
          const sx = Sd === "L" ? 1 : -1,
            g = clamp(D.g[Sd], -0.2, 1.25);
          const sh = b.pos("upperArm" + Sd, new THREE.Vector3());
          const hold = _v
            .set(sx * 0.17, ch.y + 0.05, ch.z)
            .addScaledVector(D.hold[Sd], reach * (0.55 + 0.25 * k));
          const shoot = _v2.copy(sh).addScaledVector(D.aim[Sd], reach * 0.97);
          const pull = new THREE.Vector3(sx * 0.18, ch.y - 0.05, ch.z + 0.2);
          const hand = hold.lerp(shoot, clamp(g, 0, 1.1)).lerp(pull, rel);
          const el = new THREE.Vector3(sx * 0.45, sh.y - 0.3, sh.z - 0.15).lerp(
            new THREE.Vector3(sx * 0.3, sh.y - 0.25, sh.z - 0.3),
            rel,
          );
          const w = e * Math.max(D.grip, clamp(g, 0, 1));
          b.ik("arm", Sd, hand, el, w, { absolute: true });
          if (g > 0.02) {
            // web-shooter flick: palm to the anchor, fingers bent back up
            const ax = _v3.crossVectors(Y, D.aim[Sd]);
            if (ax.lengthSq() > 1e-4) {
              b.aim("hand" + Sd, D.aim[Sd], clamp(g, 0, 1));
              b.rot("hand" + Sd, ax.normalize(), -0.75 * clamp(g, 0, 1.2));
            }
          }
          rdCurl(S, out, Sd, lerp(D.grip * e, 0.25, clamp(g, 0, 1)));
        }
        D.clip =
          "slingshot k" +
          D.k.toFixed(2) +
          (mv > 0.3 ? " step" : "") +
          (D.g.L > 0.3 ? " shootL" : "") +
          (D.g.R > 0.3 ? " shootR" : "") +
          (rel > 0.05 ? " rel" + rel.toFixed(2) : "");
      },
    },

    // ---- swing: low/bottom/high by phase, corner bank by bank, mirrored for the left hand
    swing: {
      // one layer per gripping hand (key 'swing#L'/'swing#R'): each keeps its own clock + mirror so a hand switch
      // is a clean cross-fade between two valid poses (user feedback #2)
      enter(L, A, prev) {
        L.data.hand = L.key.split("#")[1] || A.swing?.hand || "R";
        L.data.ph = clamp(A.swing?.phase ?? 0, -1, 1);
        L.data.angPrev = null;
        L.data.fwd = 1;
      },
      eval(L, A, out) {
        const sw = A.swing || {};
        // phase/bank are smoothed per layer: traversal's phase can jump at attach time
        // the body faces its velocity (frame 'swing'), so the low/bottom/high blend must follow the direction of travel
        // along the arc, not traversal's fixed swing plane: long held swings go up past the anchor, fall back and swing
        // backward (user feedback #4). Travel direction = sign of the rope angle rate (flips only at the pendulum's
        // turning point, with hysteresis), so a backswing reads as a normal drop-in -> bottom -> rise.
        const ang = sw.angle ?? 0;
        if (L.data.angPrev != null && S.dt > 0) {
          const rate = (ang - L.data.angPrev) / S.dt;
          if (Math.abs(rate) < 6) {
            if (rate > 0.12) L.data.fwd = 1;
            else if (rate < -0.12) L.data.fwd = -1;
          } // >6 rad/s = re-anchor jump
        }
        L.data.angPrev = ang;
        if (!L.data.fwd) L.data.fwd = 1;
        const phT = clamp(sw.phase ?? 0, -1, 1) * L.data.fwd;
        L.data.ph = damp(L.data.ph, phT, 8, S.dt);
        const ph = L.data.ph,
          bank = clamp(sw.bank ?? 0, -1, 1);
        if (L.data.hand === (sw.hand || "R")) {
          S.swingPh = ph;
          S.swingPhHand = L.data.hand;
        } // travel-relative phase for the two-hand grip (postWeb)
        const t = L.t;
        // left-hand grip: baked mirror clips (character agent) when present, else a runtime mirror of the right-hand set
        const nat =
          L.data.hand === "L" &&
          C.has("swingLowL") &&
          C.has("swingBottomL") &&
          C.has("swingHighL");
        L.data.nat = nat;
        const sfx = nat ? "L" : "";
        const lo = C.first("swingLow" + sfx),
          bo = C.first("swingBottom" + sfx),
          hi = C.first("swingHigh" + sfx);
        if (lo && bo && hi) {
          const wl = smooth(-ph),
            wh = smooth(ph);
          C.sample(bo, t, S.P.a);
          if (wl > 0.001) {
            C.sample(lo, t, S.P.b);
            blendPoses(S.P.a, S.P.b, wl, S.P.a, null, S.bm(22 + L.key));
          }
          if (wh > 0.001) {
            C.sample(hi, t, S.P.b);
            blendPoses(S.P.a, S.P.b, wh, S.P.a, null, S.bm(23 + L.key));
          }
          L.data.clip = ph < -0.35 ? lo : ph > 0.35 ? hi : bo;
        } else if (C.has("swing")) {
          // single arc clip: 0 back, 18 bottom, 32 front (of 56 @30fps)
          const f = ph < 0 ? 18 * (ph + 1) : 18 + 14 * ph;
          C.sample("swing", f / 30, S.P.a, { loop: false });
          L.data.clip = "swing";
          L.data.nat = false;
        } else S.fallback("swing", ph, S.P.a);
        // long swings: the free hand joins the line (postWeb twoHand, ramps in over ~0.3 s once the swing carries on past
        // ~0.45 s towards the bottom). Body follows the two-handed clip: legs together + tucked, torso hanging under the grip.
        const two = C.has("swingTwoHanded")
          ? smooth(S.two[L.data.hand === "L" ? "R" : "L"]) * 0.5
          : 0;
        if (two > 0.01) {
          C.sample("swingTwoHanded", t, S.P.b);
          if (L.data.nat) S.mirror(S.P.b);
          blendPoses(S.P.a, S.P.b, two, S.P.a, null, S.bm(24 + L.key));
        } // L parity
        // corner bank (clip banks toward the character's left; mirror for right banks)
        if (L.data.nat && C.has("swingCornerBankL") && Math.abs(bank) > 0.02) {
          // swingCornerBankL grips left and rolls to his left (= turning left, bank > 0); turning right: mirrored
          C.sample("swingCornerBankL", t, S.P.b);
          if (bank < 0) S.mirror(S.P.b);
          blendPoses(
            S.P.a,
            S.P.b,
            smooth(Math.abs(bank)) * 0.85,
            S.P.a,
            null,
            S.bm(25 + L.key),
          );
        } else if (C.has("swingCornerBank") && Math.abs(bank) > 0.02) {
          C.sample("swingCornerBank", t, S.P.b);
          // the whole pose is mirrored afterwards for a left-hand grip, so pre-flip the bank side for it
          const bk = L.data.hand === "L" ? -bank : bank;
          if (bk * S.mirrorBank < 0) S.mirror(S.P.b);
          blendPoses(
            S.P.a,
            S.P.b,
            smooth(Math.abs(bank)) * 0.85,
            S.P.a,
            null,
            S.bm(26 + L.key),
          );
        }
        // slack web (over the top of a held swing): he is free-falling inside the circle, not hanging -> apex/fall pose
        // (the web hand keeps its grip via the arm aim). Wall-skip: brief tucked kick-off pose off the facade.
        const slack = smooth(sw.slack ?? 0),
          kick = smooth(sw.kick ?? 0);
        // slack: controlled tuck (knees up, core engaged) rather than a limp apex pose
        if (slack > 0.01) {
          const f = C.first("releaseTuck", "airApex");
          if (f) {
            C.sample(f, f === "releaseTuck" ? 0.3 : L.t, S.P.b, {
              loop: false,
            });
            blendPoses(
              S.P.a,
              S.P.b,
              slack * 0.6,
              S.P.a,
              null,
              S.bm(27 + L.key),
            );
          }
        }
        if (kick > 0.01) {
          const k = C.first("wallJump");
          if (k) {
            C.sample(k, 0.14 + 0.1 * (1 - (sw.kick ?? 0)), S.P.b);
            blendPoses(S.P.a, S.P.b, kick * 0.7, S.P.a, null, S.bm(28 + L.key));
          }
        }
        if (L.w > 0.5 || !S.swLife)
          S.swingLife(L, ph, sw, (1 - slack) * (1 - kick)); // the dominant grip layer drives it (applied after swingLegs, postWeb)
        out.copy(S.P.a);
        if (L.data.hand === "L" && !L.data.nat) S.mirror(out);
      },
      spin(L, A) {
        // body roll into the bank
        const bank = clamp(A.swing?.bank ?? 0, -1, 1);
        L.data.roll = damp(L.data.roll || 0, -bank * 0.45, 5, S.dt);
        return Math.abs(L.data.roll) > 1e-3
          ? _q2.setFromAxisAngle(Z, L.data.roll)
          : null;
      },
    },

    // ---- wall: crawl (idle / slow / fast), run, jump, vault, corner
    crawl: {
      eval(L, A, out) {
        const wv = A.wall || {};
        const mv = wv.move ? Math.hypot(wv.move.x, wv.move.y) : 0;
        const sp = A.speed ?? (A.velocity ? A.velocity.length() : 0);
        const moving = mv > 0.1 || sp > 0.3;
        const fast = !!wv.fast;
        L.data.mv = damp(L.data.mv || 0, moving ? (fast ? 2 : 1) : 0, 6, S.dt);
        const m = L.data.mv;
        const slow = C.first("wallCrawl"),
          quick = C.first("wallCrawlFast", "wallCrawl"),
          idle = C.first("wallIdle", "wallCrawl");
        if (!slow) {
          if (moving) S.wallPhase = (S.wallPhase + S.dt * 0.9) % 1;
          S.fallback("wallCrawl", S.wallPhase, out);
          return;
        }
        const ms = { ...C.loco(slow, "wall") },
          mf = { ...C.loco(quick, "wall") };
        if (NAT[slow]) ms.v = NAT[slow];
        if (NAT[quick]) mf.v = NAT[quick];
        // phase sync + cadence from speed (clip natural speed measured from hand/foot contact travel)
        const wFast = Math.max(smooth(m - 1), smooth((sp - 1.2) / 1.2));
        const vN = lerp(ms.v, mf.v, wFast),
          fN = lerp(1 / ms.dur, 1 / mf.dur, wFast);
        // split the speed ratio between cadence and reach (stride warp on the wall) so hands/feet don't slide
        const ratio = Math.max(sp, 0.2) / Math.max(vN, 0.2);
        const k = clamp(Math.pow(ratio, 0.4), 0.8, 1.45),
          rate = clamp(ratio / k, 0.5, 2.6);
        L.data.k = moving ? k : 1;
        if (moving) S.wallPhase = (S.wallPhase + S.dt * fN * rate) % 1;
        C.sample(slow, ((S.wallPhase + ms.phase0) % 1) * ms.dur, S.P.a);
        if (wFast > 0.001) {
          C.sample(quick, ((S.wallPhase + mf.phase0) % 1) * mf.dur, S.P.b);
          blendPoses(S.P.a, S.P.b, wFast, S.P.a, null, S.bm(29 + L.key));
        }
        const wIdle = 1 - smooth(m);
        if (wIdle > 0.001) {
          C.sample(idle, L.t, S.P.b);
          blendPoses(S.P.a, S.P.b, wIdle, S.P.a, null, S.bm(30 + L.key));
        }
        L.data.clip = wIdle > 0.5 ? idle : wFast > 0.5 ? quick : slow;
        out.copy(S.P.a);
        S.climbPose(out, S.dt, sp, moving);
        // user r9: when he stops on the wall he settles into the side-on cling (refs/wall/cling_*)
        L.data.cw = damp(L.data.cw ?? 0, moving ? 0 : 1, moving ? 10 : 5, S.dt);
        // side against the wall: chosen so his chest faces the camera (the cling faces frame -X with his left side on
        // the wall); locked while the cling is blended in, re-picked only once it has faded out (no pops)
        if (L.data.cw < 0.04 || !L.data.side)
          L.data.side = S.pickClingSide(A, L.data.side);
        S.clingPose(out, smooth(L.data.cw), L.data.side);
      },
      frame(L, A) {
        const wv = A.wall || {},
          n = wv.normal;
        let heading = null;
        const v = A.velocity;
        if (n && v && v.lengthSq() > 0.09) {
          heading = _v4.copy(v).addScaledVector(n, -v.dot(n));
          if (heading.lengthSq() > 0.01) heading.normalize();
          else heading = null;
        }
        return { kind: "wall", heading };
      },
    },
    // user feedback #5: wall run = the ground run cycle rotated onto the wall (frame 'wallRun': up = wall normal),
    // phase-continuous with the ground run it came from (shared loco phase) so entry/exit never restart the stride.
    wallRun: {
      enter(L, A, prev) {
        S.wrPushOk = false;
        L.data.side = A.sub === "wallRunSide";
        if (prev && prev.name !== "ground" && prev.name !== "wallRun")
          S.matchLocoPhase(S.P.out, 8);
      },
      eval(L, A, out) {
        const sp = clamp(
          A.speed ?? (A.velocity ? A.velocity.length() : 8),
          4,
          14,
        );
        L.data.side = A.sub === "wallRunSide";
        // user feedback #16: the procedural "ground run rotated onto the wall" read better than the authored wall-run
        // clips (hands-up climb look, legs inside the facade) -> clips disabled
        const cn = null;
        if (cn) {
          // authored wall-run clips (wall convention: facing the wall, soles on the plane at z = +0.30)
          L.data.useClip = true;
          const d = C.dur(cn),
            nat = NAT[cn] || 8;
          S.wallPhase =
            (S.wallPhase + (S.dt * clamp(sp / nat, 0.6, 1.8)) / d) % 1;
          C.sample(cn, S.wallPhase * d, out);
          if (L.data.side) {
            // clip runs toward local +X (his left); mirror for the other direction
            const v = A.velocity,
              n = A.wall?.normal;
            if (v && n) {
              const x = _v3.crossVectors(S.wallUp, _v4.copy(n).negate());
              const m = v.dot(x) < -0.3;
              if (L.data.mir == null || Math.abs(v.dot(x)) > 0.5)
                L.data.mir = m;
            }
            if (L.data.mir) S.mirror(out);
          }
          L.data.clip = cn + (L.data.mir && L.data.side ? "(m)" : "");
          return;
        }
        L.data.useClip = false;
        // user r7: the normal ground run cycle, unchanged (no stride stretch / bounding lift) — legs must not swing wide
        // user r9q: EXACTLY the ground run — same gait/cadence/stride from the actual speed, same elastic arm pump,
        // same torso lean + rear-leg push + track width (runTrack)
        const ap = Math.min(sp, 9.8); // user r9r: wall speed raised, animation kept at the ground-run cadence/stride
        S.locoPose(out, ap);
        S.armPump(out, ap, 1);
        S.runTrack(out, ap);
        S.locoPhase = (S.locoPhase + S.dt * S.locoInfo.rate) % 1;
        if (!L.data.side) {
          // vertical wall run (user r9/r9q): the ground run (same gait, cadence from the real speed, elastic arm pump,
          // counter-rotation, push) on the wall as the floor, leaning ~50 deg up the wall; the ground stride is only
          // mapped under the hips so each foot strikes flat on the facade
          const bb = S.b.begin(out);
          const PITCH = S.wrPitch ?? 0.87;
          const fp = {};
          for (const Sd of ["L", "R"])
            fp[Sd] = {
              p: bb.pos("foot" + Sd, new THREE.Vector3()),
              q: bb.cq("foot" + Sd, new THREE.Quaternion()),
            };
          bb.rot("hips", X, PITCH);
          bb.rot("chest", X, -0.12);
          bb.rot("neck", X, -0.25);
          bb.rot("head", X, -0.45);
          const hy = bb.pos("hips", _v3).y;
          bb.moveHips(0, 0.68 - hy, 0);
          for (const Sd of ["L", "R"]) {
            const f = fp[Sd].p;
            f.z = f.z * 0.6 - 0.36;
            f.y = 0.1 + Math.max(0, f.y - 0.1) * 0.55; // approved r9 wall mapping
            const hip = bb.pos("upperLeg" + Sd, new THREE.Vector3());
            bb.ik(
              "leg",
              Sd,
              f,
              hip
                .clone()
                .lerp(f, 0.5)
                .add(new THREE.Vector3(0, 0.1, 0.6)),
              1,
              { absolute: true },
            );
            bb.setCQ("foot" + Sd, fp[Sd].q);
          }
          S.solesAbove(out, 0);
          L.data.clip = "run@wall(vertical)";
          return;
        }
        // keep the soles on/above the wall plane (char y = 0) — no toes sinking into the facade
        S.solesAbove(out, 0);
        L.data.clip =
          "run@wall " +
          (S.locoInfo.clipA || "gait") +
          ">" +
          (S.locoInfo.clipB || "");
      },
      frame(L, A) {
        const v = A.velocity,
          n = A.wall?.normal;
        let heading = null;
        if (v && n) {
          heading = _v4.copy(v).addScaledVector(n, -v.dot(n));
          if (heading.lengthSq() > 0.25) heading.normalize();
          else heading = null;
        }
        if (L.data.useClip)
          return { kind: "wall", heading: L.data.side ? null : heading };
        return { kind: "wallRun", heading };
      },
    },
    wallJump: {
      enter(L) {
        L.data.clip = C.first("wallJump");
      },
      hold: (L, A) =>
        (A.mode === "air" || A.mode === "wall") &&
        L.t < C.dur("wallJump") - 0.15 &&
        !A.trick,
      eval(L, A, out) {
        if (!oneShot(L.data.clip, L.t, out)) S.fallback("jump", 0, out);
      },
      frame() {
        return { kind: "wallOut" };
      },
    },
    vault: {
      enter(L) {
        L.data.clip = C.first("wallToRoofVault");
      },
      hold: (L, A) =>
        A.mode !== "swing" &&
        A.mode !== "zip" &&
        L.t < C.dur("wallToRoofVault") - 0.12,
      // the capsule itself travels up and over the ledge: lock the clip's hips completely
      eval(L, A, out) {
        if (!oneShot(L.data.clip, L.t, out, { lock: "xyz" }))
          S.fallback("jump", 0, out);
      },
    },
    // Wall top -> roof (user #18): ledgeGrab -> ledgeClimbFlip / ledgeClimbQuick, timed 1:1 by traversal's anim.ledge.t.
    // The clips carry the body up and over the lip (hips translation kept) in a frame pinned to the ledge: origin 0.30 m
    // off the wall plane, 1.95 m below the lip, facing inward (SPIDERMAN.md ledge convention). Traversal moves the capsule
    // along the same displacement, so at the end the mesh hands back to the capsule without a slide.
    ledge: {
      enter(L, A) {
        const G = A.ledge;
        L.data.climb =
          G?.variant === "flip" && C.has("ledgeClimbFlip")
            ? "ledgeClimbFlip"
            : C.first("ledgeClimbQuick", "wallToRoofVault");
        L.data.grab = C.dur("ledgeGrab");
        const f = G
          ? G.inward.clone().setY(0).normalize()
          : new THREE.Vector3(Math.sin(S.yaw), 0, Math.cos(S.yaw));
        const O = G
          ? G.point.clone().addScaledVector(f, -WALL_Z)
          : S.io.center.clone();
        if (G) O.y -= 1.95;
        L.data.O = O;
        L.data.f = f;
        L.data.tl = 0;
      },
      hold: (L, A) =>
        A.mode !== "swing" &&
        A.mode !== "zip" &&
        (A.ledge?.active ||
          L.data.tl < L.data.grab + C.dur(L.data.climb) - 0.08),
      eval(L, A, out) {
        const G = A.ledge;
        L.data.tl = G?.active ? Math.max(L.data.tl, G.t) : L.data.tl + S.dt;
        const t = L.data.tl;
        if (!C.has("ledgeGrab")) {
          oneShot(L.data.climb, t, out, { lock: "xyz" });
          return;
        }
        if (t < L.data.grab) {
          oneShot("ledgeGrab", t, out, { lock: null });
          L.data.clip = "ledgeGrab";
        } else {
          oneShot(L.data.climb, t - L.data.grab, out, { lock: null });
          L.data.clip = L.data.climb;
          const bw = 1 - smooth((t - L.data.grab) / 0.06);
          if (bw > 0.001) {
            oneShot("ledgeGrab", L.data.grab, S.P.c, { lock: null });
            blendPoses(out, S.P.c, bw, out, null, S.bm(31 + L.key));
          }
        }
      },
      frame(L) {
        return {
          kind: "ledge",
          O: L.data.O,
          fwd: L.data.f,
          w: smooth(L.t / 0.1),
        };
      },
    },
    corner: {
      enter(L) {
        L.data.clip = C.first("cornerWrap");
      },
      hold: (L, A) => A.mode === "wall" && L.t < C.dur("cornerWrap") - 0.1,
      eval(L, A, out) {
        if (!oneShot(L.data.clip, L.t, out)) S.fallback("wallCrawl", 0, out);
      },
    },
  };
  return nodes;
}
