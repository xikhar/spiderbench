// @ts-nocheck
// Insomniac-style traversal state machine.
//   modes: ground | air | swing | zip | perch | wall | rope   (+ C1 anim.mode 'land' while a landing recovery plays)
//   rope = web tightrope (T while perched, see ./rope.ts): shoot a web to the targeted point, walk the strand
// Writes the C1 contract struct `anim` every frame (see src/main.ts / traversal/anim.ts) and exposes the body root transform
// (rootPos = feet, bodyQ) for the animation layer.
//
// Physics conventions: s.pos = body centre (feet + H); 120 Hz substeps; gravity 24 m/s^2; speed cap 45 m/s.
import * as THREE from "three";
import {
  BoxIndex,
  createCollider,
  pushOutCapsule,
  pushOutRays,
} from "./collide.ts";
import { createZipPoints, createZipTargeting } from "./zippoints.ts";
import { createAnchorFinder } from "./anchors.ts";
import { makeAnim, writeAnim } from "./anim.ts";
import { ROPE, makeRope, ropePoint, stepRopeSpring } from "./rope.ts";

export const H = 0.95; // body centre above the feet
export const R = 0.36; // capsule radius
export const HEIGHT = 1.8; // capsule height
const STEP = 0.55; // max step-up (curbs, low ledges)
const G = 24,
  GS = 25; // gravity (air / swinging)
const WALK = 2.6,
  RUN = 9.8,
  SPRINT = 15.5;
// user r12: holding Shift on the ground = a natural slow WALK (~1.4 m/s, ~1.85 steps/s). walkK (0..1) eases between the
// run and walk target speeds over ~0.4 s (press / release while moving blends, never snaps); gentle start / stop ramps
// and turn rate while walking. Ground sprint stays removed (user r4 #9) — 'sprint' only appears from carried momentum.
const WALK_SLOW = 1.4,
  WALK_EASE = 7,
  WALK_ACC = 5.5,
  WALK_DEC = 3.5,
  WALK_TURN = 4.5;
const WALLRUN = 14; // user r9r: wall run movement speed (the animation still plays at the ground-run cadence)   // user r9g: faster run (was 8.2)
const VMAX = 45;
// swing momentum chain (user r10g): each swing started within CHAIN_BUF s of the last web raises the speed ceilings and the
// release push; not swinging for CHAIN_BUF s (or standing still on something) resets it
const CHAIN_BUF = 1.6,
  CHAIN_MAX = 6,
  CHAIN_CAP = 2.5,
  CHAIN_REL = 1.5;
// user r9w: E on a wall = a short web-zip straight up the facade: burst v0 -> v1 over dur (~9 m), one web to the wall
// `reach` m above (snaps off at `snap`), `cd` s between zips (no E-spam flying up a tower)
// user r9z: longer + stronger — two webs (one per hand) ~42 m up (clamped under the wall top, off the top of the screen),
// pull 46 -> 16 m/s over 0.95 s (~28 m); W+Shift can't cut it short (only read when the pull ends)
const WZIP = { dur: 0.95, v0: 46, v1: 16, reach: 42, snap: 0.75, cd: 1.2 }; // user r9w: was 0.42 s, 30->13 m/s, 14 m, 0.55, 0.6 s
// user r11: Space-release = speed + height boost, any other release = speed only (no extra height). The forward boost is
// horizontal along the travel direction; a release trick (TRICK_DEF) adds its own forward boost at the snap, so an untricked
// release gets REL_NOTRICK up front instead (the totals match either way).
const SWING_JUMP = 4.0; // Space-release: extra m/s forward on top of the plain release (user r4 #10, r11)
const SWING_JUMP_UP = 16; // Space-release: vertical pop (m/s; vy = max(vy + pop, 0.85 pop), capped at SWING_JUMP_VY) (user r10c: 7.5 = ~2 m rise read as no pop; now ~5 m)
const SWING_JUMP_VY = 22; // Space-release: max upward speed after the pop (no rocket off a rising arc)
const REL_NOTRICK = 4.0; // release with no trick: forward m/s standing in for the trick's snap boost
const REL_UP = 9; // every swing release: upward pop (m/s; vy = max(vy + pop, 0.75 pop), capped at REL_UP_VY) —
const REL_UP_VY = 16; // user r10f: chained swings must climb ("give more height after each swing"); Space-release pops higher
const SWING_DIP = 6;
const SWING_GAIN = 5; // climb assist target: exit this far above the attach height (m) — user r10f        // max arc dip below the attach height (m) — user r10f
// (user r-anim7) "give a visible boost to height and speed when i do a 50%+ swing": swing completion = how far the rope
// got (furthest angle reached) from its attach angle toward the mirrored angle on the far side (0.5 = released at the bottom, 1 = a full
// symmetric arc). From 50 % it adds forward speed and an extra upward pop, ramping to full at FULL_SWING_K; the speed cap
// is raised by the same amount so it is not clamped away. The camera gets a FOV kick (event 'swingBoost').
const FULL_SWING_FWD = 7; // m/s forward at full completion
const FULL_SWING_UP = 7; // m/s extra upward pop (and cap) at full completion
const FULL_SWING_K = 0.85; // completion at which the boost is full
const RELEASE_BOOST = 1.5; // m/s added along the release velocity when the web is let go (x skill 'swingReleaseBoost')
const SWING_DRAG = 0.0022; // aerodynamic drag while swinging (1/m): a held swing with no input decays like a real pendulum
const PUMP_MAX_ANG = 1.15; // pumping (W along the swing) never adds energy beyond what reaches ~75 deg of arc (chains stay in the canyon)
const JUMP = 11.2,
  JUMP_MAX = 19.5; // tap jump (~2.6 m, user r9: higher) / full charge (~7.9 m)
const UP = new THREE.Vector3(0, 1, 0);
// Swing-release / air tricks (user r10: no tucked "crouch" ball after a release — loose, athletic full-body tricks that EARN
// a speed boost). The boost lands at the trick's snap moment (snap * dur seconds in), not at release:
//   boost = m/s added along the horizontal travel direction (x skill 'swingReleaseBoost'), up = m/s vertical,
//   steer = max rad the heading turns toward the stick, side = m/s lateral drift (toward the stick),
//   dur must match animator.ts PTRICK.
const TRICK_DEF = {
  tuckFlip: { dur: 0.9, snap: 0.35, boost: 5.5, up: 0.8 }, // tucked front somersault (user r10c; replaces the flat dive-out)
  layout: { dur: 1.3, snap: 0.35, boost: 4.0, up: 2.5 }, // loose layout flip (slow, eased): speed + a bit of height
  corkscrew: {
    dur: 0.78,
    snap: 0.35,
    boost: 5.0,
    up: 0.6,
    steer: 0.35,
    side: 2.5,
  }, // barrel roll: speed + steering / drift toward the stick
  // (user r10b: the cartwheel 'fan' spin is removed — sideways stick input now drifts the corkscrew instead)
  scissor: { dur: 0.7, snap: 0.32, boost: 3.5, up: 1.4 }, // running-in-air stride
};
const TRICKS = Object.keys(TRICK_DEF);
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const clamp = THREE.MathUtils.clamp;
const angWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _v3 = new THREE.Vector3(),
  _v4 = new THREE.Vector3(),
  _v5 = new THREE.Vector3();
const _q = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion(),
  _m = new THREE.Matrix4();

export function createTraversal({ world, cam, web, rig, camera }) {
  const index = new BoxIndex(world.buildings || []); // coarse building masses: anchor faces / zip fallback
  const collider = createCollider(world); // exact solids (C4) when the city exposes them
  const zipPoints = createZipPoints(world, index);
  const targeting = createZipTargeting(world, zipPoints);
  const anchors = createAnchorFinder(world, index, zipPoints);
  const rnd = Math.random;

  const s = {
    mode: "air",
    sub: "fall",
    subT: 0,
    modeT: 0,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    facing: 0,
    speed: 0,
    grounded: false,
    floorY: 0,
    stepOff: 0,
    carry: new THREE.Vector3(),
    charging: false,
    chargeT: 0,
    jumpCharge: 0,
    coyote: 0,
    airT: 0,
    apexY: 0,
    dive: false,
    relT: 99,
    swing: {
      anchor: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      pivot: new THREE.Vector3(),
      rope: 20,
      ropeTarget: 20,
      t: 0,
      dir: new THREE.Vector3(0, 0, 1),
      hand: "R",
      phase: 0,
      bank: 0,
      tension: 0,
      kind: "wall",
      slack: 0,
      kick: 0,
      kickCd: 0,
      apexed: false,
      angPrev: 0,
      slackT: 0,
    },
    lastTrick: false,
    trick: null,
    searchT: 0,
    swingCooldown: 0,
    wallCooldown: 0,
    zipCooldown: 0,
    dashCount: 0,
    zip: {
      target: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      kind: "",
      p0: new THREE.Vector3(),
      p1: new THREE.Vector3(),
      p2: new THREE.Vector3(),
      t: 0,
      dur: 0.5,
      launch: false,
      dash: false,
    },
    perch: {
      pos: new THREE.Vector3(),
      normal: new THREE.Vector3(0, 0, 1),
      kind: "roofEdge",
      roof: true,
    },
    wall: {
      normal: new THREE.Vector3(0, 0, 1),
      move: new THREE.Vector2(),
      fast: false,
      runV: 0,
      up: new THREE.Vector3(0, 1, 0),
      phase: 0,
      off: 0,
      dist: R + 0.02,
      point: new THREE.Vector3(),
      runK: 0,
    },
    kin: null, // scripted move {type, t, dur, p0, p1, p2, n0, n1, then}
    landing: { severity: 0, lock: 0 },
    dyn: { y: -Infinity, vel: new THREE.Vector3(), t: 9 },
    bodyQ: new THREE.Quaternion(),
    roll: 0,
    pitch: 0,
    bank: 0,
    rollSpin: 0,
    wallNormal: null, // alias kept for screenshotPresets.ts (player.state.wallNormal)
    lookDir: new THREE.Vector3(0, 0, 1),
    // web slingshot (Ctrl held on the ground): anchors [{p, n, side -1 L / +1 R, t}], pull (m back from origin), tension 0..1
    sling: {
      active: false,
      rel: -1,
      anchors: [],
      tension: 0,
      pull: 0,
      origin: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      fwd0: new THREE.Vector3(0, 0, 1),
      moving: 0,
      t: 0,
    },
    // quick web boost (Q in the air): one-hand web to a far point ahead, yank, forward impulse (quickBoostStart / stepQuickBoost)
    quick: {
      active: false,
      t: 0,
      hand: "R",
      anchor: new THREE.Vector3(),
      normal: new THREE.Vector3(0, 0, 1),
      hitT: 0.08,
      applied: false,
      webOn: false,
      dist: 0,
      sky: false,
      k: 1,
      n: 0,
      last: -9,
      seq: 0,
    },
    clock: 0,
    walkK: 0,
    // web tightrope: rope = the strand he is on (or shooting), ropes = every strand still drawn (lingering ones included)
    rope: null,
    ropes: [],
    standHold: false,
    standPos: null,
  };
  s.wallNormal = s.wall.normal;
  const anim = makeAnim();
  let lastInput = null;
  const events = []; // one-frame events for camera/audio: {type, severity}

  // ------------------------------------------------------------------ helpers
  const feetY = () => s.pos.y - H;
  // highest walkable surface at (x,z) that is at or below y
  const floorAt = (x, z, y) => world.groundHeight(x, z, y - 0.5);
  // standable floor: thin pinnacles (vent pipes, bollards, posts < ~0.4 m across) are NOT floors — the feet would hang
  // in the air around them. If the surface drops away on all four sides within 0.22 m, use the level around it
  // (the capsule push-out then moves the body off the pipe). Narrow copings/beams (drop on 2 sides only) still count.
  function standAt(x, z, y) {
    const g = floorAt(x, z, y),
      r = 0.22;
    const a = floorAt(x + r, z, y),
      b = floorAt(x - r, z, y),
      c = floorAt(x, z + r, y),
      d = floorAt(x, z - r, y);
    if (a < g - 0.25 && b < g - 0.25 && c < g - 0.25 && d < g - 0.25)
      return Math.max(a, b, c, d);
    return g;
  }
  function inputDir(I, out) {
    const f = cam.forwardFlat(_v4),
      r = cam.rightFlat(_v5);
    return out
      .set(0, 0, 0)
      .addScaledVector(f, I.move.y)
      .addScaledVector(r, I.move.x);
  }
  // INVARIANT (user feedback #4): the web is released ONLY by (a) letting go of the swing button (!I.swing ->
  // releaseSwing), (b) a zip / web-dash (E / MMB, an explicit button press), or (c) teleport. Anything else that tries
  // to leave 'swing' while the button is still held is a bug -> logged loudly in dev.
  let leaveSwingOK = false;
  function setMode(mode, sub) {
    if (
      s.mode === "swing" &&
      mode !== "swing" &&
      lastInput?.swing &&
      !leaveSwingOK
    )
      console.error(
        `[traversal] BUG: left 'swing' -> '${mode}/${sub}' while the swing button is held (web must stay attached)`,
      );
    if (s.mode !== mode) s.modeT = 0;
    s.mode = mode;
    setSub(sub);
  }
  // skill scaling (progression 'swingReleaseBoost'); set by the systems layer via traversal.setStats, else read ctx.params
  const stats = {};
  const releaseBoost = () =>
    RELEASE_BOOST *
    (stats.releaseBoost ?? (globalThis.__ctx?.params?.swingReleaseBoost || 1));
  function setSub(sub) {
    if (s.sub !== sub) {
      s.sub = sub;
      s.subT = 0;
    }
  }
  const feet = new THREE.Vector3();
  const contact = {
    normal: new THREE.Vector3(),
    point: new THREE.Vector3(),
    box: -1,
    depth: 0,
    top: 0,
  };
  function collide(stepH = STEP, rad = R) {
    feet.set(s.pos.x, s.pos.y - H, s.pos.z);
    const c = collider
      ? pushOutCapsule(collider, feet, rad, HEIGHT, stepH, contact)
      : pushOutRays(world, feet, rad, HEIGHT, stepH, contact);
    s.pos.x = feet.x;
    s.pos.z = feet.z;
    return c;
  }
  function hdir(v, out) {
    out.set(v.x, 0, v.z);
    const l = out.length();
    return l > 1e-4 ? out.divideScalar(l) : null;
  }
  const vmaxC = () => VMAX + CHAIN_CAP * (s.chain || 0);
  function capSpeed(m = vmaxC()) {
    const l = s.vel.length();
    if (l > m) s.vel.multiplyScalar(m / l);
  }
  function heightAboveFloor() {
    return feetY() - floorAt(s.pos.x, s.pos.z, feetY() + 0.1);
  }

  // ------------------------------------------------------------------ ground
  function enterGround(sub = "idle") {
    setMode("ground", sub);
    s.grounded = true;
    s.vel.y = 0;
    s.dashCount = 0;
    s.dive = false;
    s.trick = null;
    s.quick.n = 0;
    const hs = Math.hypot(s.vel.x, s.vel.z);
    s.speed = hs;
    if (hs > 3) s.facing = Math.atan2(s.vel.x, s.vel.z); // (tiny residual velocity never flips facing)
  }
  function stepGround(h, I) {
    const inD = inputDir(I, new THREE.Vector3());
    const mag = Math.min(1, inD.length());
    if (mag > 1e-3) inD.divideScalar(mag);
    // user r12: Shift on the ground = WALK (keyboard only; I.walk). Shift is no longer ground parkour — RMB / R2 still are
    // (on the pad R2 sets sprint + swing, so its parkour is unchanged); Shift pushing into a tall wall still wall-runs.
    const walkHeld = !!I.walk;
    s.walkK =
      s.speed < 0.3
        ? walkHeld
          ? 1
          : 0
        : damp(s.walkK, walkHeld ? 1 : 0, WALK_EASE, h); // (standing: no ease needed)
    const wk = s.walkK;
    const parkour = I.swing || (I.sprint && !walkHeld);
    const L = s.landing;
    const landing = s.sub.startsWith("land");
    // landing recovery: hard landings lock movement briefly, rolls carry momentum
    if (landing) {
      L.lock -= h;
      if (s.sub === "landRoll") {
        s.speed = Math.max(s.speed - 6 * h, Math.min(s.speed, 6));
      } else if (L.lock > 0) s.speed = Math.max(0, s.speed - 40 * h);
      const cancel = L.lock <= 0 && (mag > 0.2 || I.jumpPressed || I.jump);
      if (
        s.subT >
          (s.sub === "landHard"
            ? 0.75
            : s.sub === "landRoll"
              ? 0.6
              : s.sub === "landMedium"
                ? 0.35
                : 0.18) ||
        cancel
      )
        setSub("idle");
    }
    const locked = landing && L.lock > 0;
    // --- web slingshot (Ctrl held): replaces locomotion while active
    if (stepSling(h, I, landing)) return;
    // --- jump (hold to charge, release to launch)
    if (!locked) {
      // jump buffer: Space pressed shortly before touching down (or during a landing lock) still starts the charge
      if ((I.jumpPressed || (s.jumpBuf > 0 && I.jump)) && !s.charging) {
        s.charging = true;
        s.chargeT = 0;
        s.jumpBuf = 0;
      }
      if (s.charging) {
        s.chargeT += h;
        s.jumpCharge = clamp((s.chargeT - 0.1) / 0.55, 0, 1);
        // tap = short anticipation crouch (never a 1-frame pop into the air): launch once the minimum wind-up played
        if (!I.jump && s.chargeT >= (s.speed > RUN ? 0.06 : 0.1)) {
          launchJump(parkour);
          return;
        }
      }
    }
    // --- RMB pressed on the ground (park lawns, streets): if there is anything to swing from, hop up and swing
    //     (held RMB after a landing keeps the parkour run; only a fresh press launches)
    if (!locked && I.swingPressed && !s.charging && s.swingCooldown <= 0) {
      const fwd = travelDir(I, travel),
        probe = _v.copy(s.pos);
      probe.y += 3;
      const a = anchors.find(probe, fwd, null, Math.max(s.speed, 10), s.floorY);
      if (a && a.point.y > s.pos.y + 6) {
        s.jumpCharge = 0.35;
        launchJump(true);
        s.groundSwing = true;
        s.swingCooldown = 0.1;
        return;
      }
    }
    // --- locomotion: facing-driven (no side slip), accel / decel curves
    let target = 0;
    if (!locked && mag > 0.08) {
      target =
        mag < 0.55
          ? (WALK * mag) / 0.55 + 0.4
          : WALK + ((RUN - WALK) * (mag - 0.55)) / 0.45;
      if (wk > 1e-3)
        target += (WALK_SLOW * clamp(mag / 0.6, 0.45, 1) - target) * wk; // Shift walk (eased, see walkK)
      if (s.charging) target *= 1 - 0.75 * s.jumpCharge;
      const want = Math.atan2(inD.x, inD.z);
      const d = angWrap(want - s.facing);
      if (s.sub !== "landRoll") {
        if (Math.abs(d) > 2.4 && s.speed > 6) {
          s.speed *= Math.exp(-14 * h);
          s.facing += Math.sign(d) * 9 * h;
        } // skid-turn
        else {
          let rate = s.speed < 2 ? 18 : s.speed < 9 ? 11 : 7;
          if (wk > 1e-3 && s.speed < 3)
            rate += ((s.speed < 0.3 ? 9 : WALK_TURN) - rate) * wk; // walking: gentle turns (no snapping)
          s.facing += clamp(d, -rate * h, rate * h);
        }
      }
      target *= clamp(1 - Math.max(0, Math.abs(d) - 0.9) * 0.5, 0.35, 1); // slow into sharp turns
    }
    if (s.sub !== "landRoll" || s.speed < 6) {
      let acc = (parkour ? 24 : 30) * (s.speed < 3 ? 1.6 : 1),
        dec = target < 0.1 ? 28 : 22; // ~0.3 s planted stop from a run
      if (wk > 1e-3 && s.speed < 2.2) {
        if (target < 2.2) acc += (WALK_ACC - acc) * wk;
        dec += (WALK_DEC - dec) * wk;
      } // walk start ~0.25 s / stop ~0.3 s
      if (target > s.speed) s.speed = Math.min(target, s.speed + acc * h);
      else s.speed = Math.max(target, s.speed - dec * h);
      if (target < 0.1 && s.speed < 0.35) s.speed = 0;
    }
    const fx = Math.sin(s.facing),
      fz = Math.cos(s.facing);
    s.carry.multiplyScalar(Math.exp(-7 * h));
    s.vel.set(fx * s.speed + s.carry.x, 0, fz * s.speed + s.carry.z);
    // riding a car roof
    if (s.dyn.t < 0.12 && s.dyn.onTop) {
      s.pos.x += s.dyn.vel.x * h;
      s.pos.z += s.dyn.vel.z * h;
    }
    s.pos.x += s.vel.x * h;
    s.pos.z += s.vel.z * h;
    let c = collide();
    let wide = c ? wideWall(c.normal, c.point) : false;
    // (user r-wallrun) storefront mullions, window bars, door jambs: the capsule pushes out of a thin box's corner with a
    // diagonal normal, so the contact read as a pole ("steer around it") and he ran in place against the shop window.
    // When the running direction faces a broad facade (most of a 3x3 ray fan sees surfaces facing him), use that facade.
    if (c && mag > 0.3) {
      const F = facadeAhead(fx, fz);
      if (F && F.into > 0.55) {
        c = {
          ...c,
          normal: F.normal,
          point: F.point,
          top: Math.max(c.top, F.top),
        };
        wide = true;
      }
    }
    if (c && !wide) {
      // narrow obstacle (lamp post, signal pole, hydrant, tree trunk): parkour AROUND it — keep speed, steer the heading
      // onto the tangent on the side we are already passing; never wall-run up a pole
      const tx = -c.normal.z,
        tz = c.normal.x,
        sd = Math.sign(fx * tx + fz * tz) || 1;
      const want = Math.atan2(
        tx * sd + c.normal.x * 0.35,
        tz * sd + c.normal.z * 0.35,
      );
      s.facing += clamp(angWrap(want - s.facing), -10 * h, 10 * h);
    } else if (c) {
      const into = -(fx * c.normal.x + fz * c.normal.z);
      if (into > 0.25)
        s.speed *= Math.max(0, 1 - into * 0.9 * Math.min(1, h * 30)); // don't run in place against walls
      if (into > 0.8 && c.top - feetY() > 2.1 && !parkour) s.speed = 0; // walking straight into a wall: stop (idle), no walk-in-place
      const obstacle = c.top - feetY();
      if (!locked && into > 0.55 && mag > 0.3 && walkHeld && !parkour) {
        // Shift walk: no parkour vaults / hops at walking pace. Shift into a tall wall still starts the wall run (Shift's wall
        // behaviour), a low thick obstacle is stepped up onto gently (mantle at walk speed), anything else just stops him.
        if (obstacle >= 2.1 && s.wallCooldown <= 0) {
          enterWall(c.normal, c.point, true, Math.max(12, s.speed));
          return;
        }
        if (obstacle > STEP && obstacle <= 1.45 && startMantleOnto(c)) return;
      } else if (!locked && into > 0.55 && mag > 0.3) {
        if (obstacle > STEP && obstacle < 2.1) {
          const behind = floorAt(
            s.pos.x - c.normal.x * (R + 1.2),
            s.pos.z - c.normal.z * (R + 1.2),
            c.top + 0.05,
          );
          if (parkour || (obstacle < 1.2 && behind > c.top - 1.5)) {
            startVault(c, parkour);
            return;
          } // walking: only low hops that don't drop off roofs
          if (obstacle <= 1.45 && startMantleOnto(c)) return; // parapet with a drop behind: step up and stand ON it
        }
        if (parkour && obstacle >= 2.1 && s.wallCooldown <= 0) {
          enterWall(c.normal, c.point, true, Math.max(12, s.speed));
          return;
        }
        if (
          !parkour &&
          obstacle > STEP &&
          obstacle <= 1.45 &&
          startMantleOnto(c)
        )
          return;
      }
    }
    // --- ground snap (C4: exact world.groundHeight, smooth curb step-ups, walk off edges)
    const fy = feetY();
    let g = standAt(s.pos.x, s.pos.z, fy + STEP);
    if (s.dyn.t < 0.12 && s.dyn.y <= fy + STEP && s.dyn.y > g) g = s.dyn.y;
    s.balance = false; // user r9: no balance-beam / edge-hold logic on railings — they are ordinary ground
    if (g < fy - 0.65) {
      // walked off a ledge
      setMode("air", "fall");
      s.grounded = false;
      s.airT = 0;
      s.apexY = fy;
      s.coyote = 0.12;
      s.vel.y = 0;
      return;
    }
    if (Math.abs(g - fy) > 1e-4) {
      s.stepOff += fy - g;
      s.stepOff = clamp(s.stepOff, -0.6, 0.6);
    }
    if (g < WATER_Y && waterBounce()) return;
    s.pos.y = g + H;
    s.floorY = g;
    // sub-state
    if (!s.sub.startsWith("land") && s.sub !== "vault") {
      if (s.charging) setSub("jumpCharge");
      else if (s.speed < 0.2) setSub("idle");
      else if (s.speed < WALK + 0.8) setSub("walk");
      else if (s.speed > RUN + 1.5) setSub("sprint");
      else setSub("run");
    }
  }
  // walking into a parapet / low wall (<= 1.25 m) with a drop behind it: mantle up and stand ON its top (balance)
  function startMantleOnto(c) {
    const n = c.normal,
      inward = _v3.copy(n).negate();
    let thick = 0;
    for (; thick < 0.9; thick += 0.05) {
      const f = floorAt(
        c.point.x + inward.x * (thick + 0.03),
        c.point.z + inward.z * (thick + 0.03),
        c.top + 0.05,
      );
      if (Math.abs(f - c.top) > 0.06) break;
    }
    if (thick < 0.15) return false;
    const land = new THREE.Vector3(
      c.point.x + inward.x * (thick / 2 + 0.02),
      c.top + H,
      c.point.z + inward.z * (thick / 2 + 0.02),
    );
    if (collider && collider.inside(_v4.set(land.x, land.y + 0.3, land.z)))
      return false;
    const p0 = s.pos.clone(),
      ctrl = p0.clone().lerp(land, 0.3);
    ctrl.y = land.y + 0.35;
    const sp = Math.hypot(s.vel.x, s.vel.z); // user r9: hopping up onto a railing keeps the run (never stops on top)
    s.kin = {
      type: "vault",
      t: 0,
      dur: clamp(1.2 / Math.max(sp, 3), 0.22, 0.42),
      p0,
      p1: ctrl,
      p2: land,
      exitVel: inward.clone().multiplyScalar(sp),
      floor: c.top,
    };
    s.facing = Math.atan2(inward.x, inward.z);
    setMode("ground", "vault");
    events.push({ type: "vault", onto: true });
    return true;
  }
  function launchJump(parkour) {
    const k = Math.pow(s.jumpCharge, 0.85);
    s.vel.y =
      JUMP + (JUMP_MAX - JUMP) * k + (parkour && s.speed > 10 ? 1.2 : 0);
    if (s.speed > 1) {
      const f = Math.min(s.speed + 1.2, VMAX);
      s.vel.x = Math.sin(s.facing) * f;
      s.vel.z = Math.cos(s.facing) * f;
    }
    s.charging = false;
    s.chargeT = 0;
    s.grounded = false;
    const charge = s.jumpCharge;
    setMode("air", "jumpLaunch");
    s.airT = 0;
    s.apexY = feetY();
    s.jumpCharge = charge;
    s.swingCooldown = 0.12;
    events.push({ type: "jump", charge });
  }

  // ------------------------------------------------------------------ web slingshot
  // Ctrl held on the ground: Ctrl+LMB / Ctrl+RMB anchor webs to the buildings on the left / right (up to 4 per side,
  // fanned a few degrees apart). Walking BACK (away from the anchors) stretches them: speed falls with (1 - tension)^2
  // (floored so the last step still lands) and stops at SL_MAX. Releasing Ctrl with tension > 0.2 launches him forward
  // (toward the anchors) and up at 40 deg, speed scaled by tension (full ~52 m/s: ~110 m flat range); less = cancel.
  const _slIn = new THREE.Vector3();
  const SL_MAX = 2.8,
    SL_CAP = 4,
    SL_BACK = 3.0,
    SL_FLOOR = 0.3,
    SL_ELEV = (40 * Math.PI) / 180,
    SL_MIN = 0.2,
    SL_REL = 0.12;
  function slingDir(out) {
    const S = s.sling;
    out.set(0, 0, 0);
    for (const a of S.anchors) {
      const dx = a.p.x - S.origin.x,
        dz = a.p.z - S.origin.z,
        l = Math.hypot(dx, dz);
      if (l > 1e-3) {
        out.x += dx / l;
        out.z += dz / l;
      }
    }
    const l = out.length();
    if (l > 1e-3) out.divideScalar(l);
    out.add(S.fwd0); // one-sided anchors pull diagonally: keep the launch heading down the street (entry heading)
    if (out.lengthSq() < 1e-4) out.copy(S.fwd0);
    return out.normalize();
  }
  function slingAttach(side) {
    const S = s.sling;
    const n = S.anchors.reduce((c, a) => c + (a.side === side), 0);
    if (n >= SL_CAP) {
      events.push({ type: "slingFail", side, full: true });
      return false;
    }
    const f = cam.forwardFlat(new THREE.Vector3()),
      r = cam.rightFlat(new THREE.Vector3());
    const o = _v3.copy(s.pos);
    o.y += 0.6;
    const jit = () => (rnd() - 0.5) * 0.07;
    // sideways-forward-up fan; each extra web on a side is offset ~7 deg forward / ~5 deg up so the strands spread
    for (const th0 of [55, 42, 68, 30, 80])
      for (const el0 of [22, 32, 14, 42]) {
        const th = ((th0 - n * 7) * Math.PI) / 180 + jit(),
          el = ((el0 + n * 5) * Math.PI) / 180 + jit();
        const d = _v4
          .copy(f)
          .multiplyScalar(Math.cos(th))
          .addScaledVector(r, side * Math.sin(th))
          .normalize();
        d.multiplyScalar(Math.cos(el));
        d.y = Math.sin(el);
        const hit = world.raycast(o, d, 40);
        if (hit && hit.distance > 3 && Math.abs(hit.normal.y) < 0.7) {
          S.anchors.push({
            p: hit.point.clone(),
            n: hit.normal.clone(),
            side,
            t: 0,
          });
          events.push({
            type: "slingAttach",
            side,
            point: hit.point.clone(),
            normal: hit.normal.clone(),
            dist: hit.distance,
          });
          return true;
        }
      }
    events.push({ type: "slingFail", side });
    return false;
  }
  function slingEnd(launch) {
    const S = s.sling;
    events.push({
      type: "slingRelease",
      launch,
      tension: S.tension,
      anchors: S.anchors.map((a) => ({
        p: a.p.clone(),
        n: a.n.clone(),
        side: a.side,
      })),
    });
    S.active = false;
    S.anchors.length = 0;
    S.tension = 0;
    S.pull = 0;
    S.moving = 0;
    S.rel = -1;
  }
  function slingLaunch() {
    const S = s.sling,
      k = S.tension;
    const D = slingDir(new THREE.Vector3());
    const sp = 24 + 28 * k;
    s.vel.copy(D).multiplyScalar(sp * Math.cos(SL_ELEV));
    s.vel.y = sp * Math.sin(SL_ELEV);
    s.pos.y += 0.05;
    s.speed = 0;
    s.charging = false;
    setMode("air", "pointLaunch");
    s.airT = 0;
    s.apexY = feetY();
    s.swingCooldown = 0.45;
    s.wallCooldown = 0.5;
    s.relT = 0;
    s.facing = Math.atan2(D.x, D.z);
    s.trick = null;
    s.grounded = false;
    s.dive = false;
    events.push(
      { type: "pointLaunch", sling: true },
      { type: "zipLaunch", dist: 40 * k },
      { type: "slingLaunch", tension: k, speed: sp },
    );
    slingEnd(true);
  }
  // returns true while it owns the ground step
  function stepSling(h, I, landing) {
    const S = s.sling;
    if (!S.active) {
      if (!I.ctrl || landing || s.charging || s.sub === "vault" || s.kin)
        return false;
      S.active = true;
      S.anchors.length = 0;
      S.tension = 0;
      S.pull = 0;
      S.moving = 0;
      S.t = 0;
      S.rel = -1;
      S.origin.copy(s.pos);
      cam.forwardFlat(S.fwd0);
      S.dir.copy(S.fwd0);
      setSub("slingshot");
      events.push({ type: "slingStart" });
    }
    // release: a short push-off wind-up (SL_REL s: legs drive, arms snap in, webs still attached) before the launch
    if (S.rel >= 0) {
      S.rel += h;
      for (const a of S.anchors) a.t += h;
      s.vel.set(0, 0, 0);
      s.speed = 0;
      if (S.rel >= SL_REL) slingLaunch();
      return true;
    }
    if (!I.ctrl) {
      if (S.anchors.length && S.tension > SL_MIN) {
        S.rel = 0;
        events.push({ type: "slingWindup", tension: S.tension });
        return true;
      }
      slingEnd(false);
      setSub("idle");
      return false;
    }
    S.t += h;
    if (I.slingL) {
      slingAttach(-1);
      I.slingL = false;
    }
    if (I.slingR) {
      slingAttach(1);
      I.slingR = false;
    }
    for (const a of S.anchors) a.t += h;
    const D = slingDir(S.dir);
    const inD = inputDir(I, _slIn);
    const back = -(inD.x * D.x + inD.z * D.z);
    let v = 0; // + = backward (away from the anchors)
    if (S.anchors.length) {
      if (back > 0.2)
        v =
          SL_BACK *
          Math.min(1, back) *
          Math.max((1 - S.tension) ** 2, SL_FLOOR);
      else if (back < -0.2 && S.pull > 0.01) v = -1.4 * Math.min(1, -back); // easing forward slackens the webs
    }
    if (S.tension >= 0.999 && v > 0) v = 0;
    const px = s.pos.x,
      pz = s.pos.z;
    s.pos.x -= D.x * v * h;
    s.pos.z -= D.z * v * h;
    collide();
    // pull = distance backward from where the webs were set (along -D), clamped to [0, SL_MAX]
    let pull = -((s.pos.x - S.origin.x) * D.x + (s.pos.z - S.origin.z) * D.z);
    if (pull > SL_MAX) {
      s.pos.x += D.x * (pull - SL_MAX);
      s.pos.z += D.z * (pull - SL_MAX);
      pull = SL_MAX;
    }
    if (pull < 0) {
      s.pos.x += D.x * pull;
      s.pos.z += D.z * pull;
      pull = 0;
    }
    const fy = feetY(),
      g = standAt(s.pos.x, s.pos.z, fy + STEP);
    if (g < fy - 0.65) {
      s.pos.x = px;
      s.pos.z = pz;
      pull = S.pull;
    } // never backs off a roof edge / drop
    else {
      if (Math.abs(g - fy) > 1e-4)
        s.stepOff = clamp(s.stepOff + fy - g, -0.6, 0.6);
      s.pos.y = g + H;
      s.floorY = g;
    }
    const moved = Math.hypot(s.pos.x - px, s.pos.z - pz) / h;
    S.pull = Math.max(0, pull);
    S.tension = clamp(S.pull / SL_MAX, 0, 1);
    S.moving = damp(S.moving, moved > 0.05 ? Math.sign(v) : 0, 10, h);
    s.vel.set(-D.x * v, 0, -D.z * v);
    if (moved < 0.02) s.vel.set(0, 0, 0);
    s.speed = 0;
    s.carry.set(0, 0, 0);
    s.facing += clamp(angWrap(Math.atan2(D.x, D.z) - s.facing), -8 * h, 8 * h);
    setSub("slingshot");
    return true;
  }

  // ------------------------------------------------------------------ air
  function stepAir(h, I) {
    s.airT += h;
    s.coyote -= h;
    if (s.coyote > 0 && I.jumpPressed) {
      s.jumpCharge = 0;
      launchJump(I.sprint || I.swing);
      return;
    }
    // user r4 #12: double-tap Space in the air = an air flip / corkscrew (once per airtime, animation only)
    if (I.jumpPressed) {
      const dtap = s.airT - (s.airTapT ?? -9);
      if (
        dtap >= 0 &&
        dtap < 0.4 &&
        !s.airTrickUsed &&
        heightAboveFloor() > 2.5 &&
        s.sub !== "trick"
      ) {
        startTrick(chooseTrick(I));
        s.airTrickUsed = true;
        s.airTapT = -9;
        events.push({ type: "airTrick", trick: s.trick });
      } else s.airTapT = s.airT;
    }
    if (
      s.sub === "trick" &&
      s.trick &&
      !s.trickBoosted &&
      s.subT >= (s.trickSnapT ?? 9)
    )
      trickBoost(I);
    // user r10m: holding forward (W) while falling tips into the head-first dive (faster fall + speed; camera pitches down,
    // blur grows); letting go of W returns to the flat fall. Drop still dives anywhere in the air.
    const wDive =
      I.move.y > 0.5 &&
      s.airT > 0.3 &&
      (s.vel.y < -7 || (s.dive && s.vel.y < 0)) &&
      s.sub !== "trick" &&
      s.sub !== "zipPull" &&
      heightAboveFloor() > 6;
    s.dive =
      (I.drop || wDive) &&
      s.airT > 0.08 &&
      !(s.returnT > 0) &&
      heightAboveFloor() > 3;
    let g = G;
    if (!s.dive && Math.abs(s.vel.y) < 3.5 && s.sub !== "zipPull") g *= 0.55; // apex hang time
    if (s.dive) g *= 1.55;
    // open areas (park, waterfront, wide avenues) with the swing button held and nothing to attach to: never a dead
    // free-fall — Spidey streamlines into a web-assisted glide-dive that trades height for forward speed until a tree /
    // lamp / building comes in range (the search keeps running every 60 ms)
    s.returnT = (s.returnT || 0) - h;
    const glide =
      I.swing &&
      !s.dive &&
      !(s.returnT > 0) &&
      (s.noAnchorT || 0) > 0.15 &&
      s.vel.y < -4 &&
      s.airT > 0.3 &&
      heightAboveFloor() > 3.5;
    s.gliding = glide;
    if (glide) {
      g *= 0.5;
      const hs0 = Math.hypot(s.vel.x, s.vel.z),
        hv0 = hdir(s.vel, _v3) || cam.forwardFlat(_v3);
      const excess = Math.max(0, -s.vel.y - 13); // descent beyond ~13 m/s is converted into forward speed
      const conv = Math.min(excess, 18 * h);
      s.vel.y += conv;
      const add = Math.min(conv * 0.9 + 3 * h, Math.max(0, 34 - hs0));
      s.vel.x += hv0.x * add;
      s.vel.z += hv0.z * add;
    }
    s.vel.y = Math.max(s.vel.y - g * h, s.dive ? -72 : -56);
    // low over open ground the glide flattens out (~10 m up) for a few seconds so a tree / lamp can be caught with a
    // real arc instead of a grass-skimming one
    if (glide && s.noAnchorT < 4 && heightAboveFloor() < 12)
      s.vel.y = damp(s.vel.y, -2.5, 3, h);
    // air control
    const inD = inputDir(I, new THREE.Vector3());
    // after a web release the release velocity owns the trajectory (user feedback #4b): air control fades in
    // over ~0.9 s instead of immediately re-aiming the flight toward the stick / camera
    s.relT += h;
    const relK = s.returnT > 0 ? 0 : clamp((s.relT - 0.35) / 0.55, 0, 1);
    const rawMag = Math.min(1, inD.length()),
      mag = rawMag * relK;
    const hs = Math.hypot(s.vel.x, s.vel.z);
    if (mag > 0.05) {
      inD.divideScalar(Math.max(inD.length(), 1e-3)); // unit direction; authority (stick * release ramp) is in `mag`
      if (hs < 9) {
        s.vel.x += inD.x * 16 * mag * h;
        s.vel.z += inD.z * 16 * mag * h;
        const n = Math.hypot(s.vel.x, s.vel.z),
          cap = Math.max(9, hs);
        if (n > cap) {
          s.vel.x *= cap / n;
          s.vel.z *= cap / n;
        }
      } else {
        const cur = Math.atan2(s.vel.x, s.vel.z),
          want = Math.atan2(inD.x, inD.z);
        const d = angWrap(want - cur);
        const turn = clamp(d, -1.9 * mag * h, 1.9 * mag * h),
          na = cur + turn;
        let sp = hs;
        if (Math.abs(d) > 2.2) sp = Math.max(6, hs - 8 * h); // pulling back = air brake
        s.vel.x = Math.sin(na) * sp;
        s.vel.z = Math.cos(na) * sp;
      }
    }
    if (s.dive) {
      // dive: tuck and gain speed, keep heading
      const n = Math.hypot(s.vel.x, s.vel.z);
      if (n > 2) {
        const k = Math.min(n + 3 * h, 30) / n;
        s.vel.x *= k;
        s.vel.z *= k;
      }
    }
    if (hs > 32 + 3 * (s.chain || 0)) {
      s.vel.x *= 1 - 0.12 * h;
      s.vel.z *= 1 - 0.12 * h;
    }
    if (
      hs > 12 &&
      relK >= 1 &&
      (s.sub === "release" || s.sub === "trick" || I.swing)
    )
      corridor(h, inD);
    const prevFeet = feetY();
    s.pos.addScaledVector(s.vel, h);
    const c = collide(0.35);
    if (c) {
      const hv = hdir(s.vel, _v);
      const into = hv ? -hv.dot(c.normal) : 0;
      const pushIn = inD.dot(c.normal) < -0.4;
      // chaining (RMB held, or just released a swing) and not deliberately steering into the wall: skip off it
      const chaining =
        (I.swing || s.relT < 0.7) &&
        !pushIn &&
        Math.hypot(s.vel.x, s.vel.z) > 9;
      let wideC = wideWall(c.normal, c.point);
      if (!wideC && hv && (into > 0.15 || pushIn)) {
        // (user r-wallrun) bars / mullions: judge the facade, not the bar corner
        const F = facadeAhead(hv.x, hv.z);
        if (F && (F.into > 0.4 || pushIn)) {
          c.normal.copy(F.normal);
          c.point.copy(F.point);
          c.top = Math.max(c.top, F.top);
          wideC = true;
        }
      }
      if (
        (into > 0.3 || pushIn) &&
        s.wallCooldown <= 0 &&
        c.top - feetY() > 1.2 &&
        wideC &&
        !chaining &&
        !(s.clock < (s.bridgeRetUntil ?? -1))
      ) {
        // (bridges r2) never cling during a bridge push-back arc
        // low ledge in front at chest height: mantle instead of sticking to it
        if (c.top - feetY() < 1.9 && s.vel.y > -6) {
          startVault(c, true);
          return;
        }
        const sp = s.vel.length();
        enterWall(
          c.normal,
          c.point,
          ((I.swing || I.sprint) && sp > 7) || sp > 18,
          sp,
          rawMag > 0.2,
        );
        return;
      }
      const vn = s.vel.dot(c.normal);
      if (vn < 0) {
        s.vel.addScaledVector(c.normal, -vn);
        // chaining through a facade graze: skip off it along the street (keeps flow, never a wall-run up the tower)
        if (chaining && -vn > 3) {
          s.vel.addScaledVector(c.normal, clamp(-vn * 0.25, 1.5, 4));
          s.wallCooldown = 0.25;
          events.push({
            type: "swingWallKick",
            severity: clamp(-vn / 30, 0.1, 0.5),
          });
        }
      }
    }
    // swing attach (RMB held): search throttled; after a release wait for the apex / trick to play out
    if (s.jumpRelHold && (s.vel.y <= 0 || s.mode !== "air"))
      s.jumpRelHold = false;
    if (I.swing && s.swingCooldown <= 0 && (!s.jumpRelHold || I.swingPressed)) {
      // a fresh RMB press still grabs at once
      const trickBusy =
        s.sub === "trick" && s.subT < Math.max(0.62, (s.trickDur || 0) - 0.35); // let the (slow) flip finish
      const ready =
        I.swingPressed ||
        (s.groundSwing && s.airT > 0.14) ||
        (s.airT > 0.1 && s.vel.y < 5.5 && !trickBusy) ||
        s.vel.y < -6;
      s.searchT -= h;
      if (ready && s.searchT <= 0 && !trickBusy) {
        s.searchT = 0.06;
        if (tryStartSwing(I)) return;
      }
    }
    // landing
    let f = standAt(s.pos.x, s.pos.z, prevFeet + 0.05);
    if (s.dyn.t < 0.12 && s.dyn.y <= prevFeet + 0.3 && s.dyn.y > f) f = s.dyn.y;
    if (feetY() <= f && s.vel.y <= 0) {
      land(f, I);
      return;
    }
    if (s.sub === "vault" && s.subT < 0.3)
      s.facing = Math.atan2(s.vel.x, s.vel.z);
    s.apexY = Math.max(s.apexY, feetY());
    // sub-state
    const timed = {
      jumpLaunch: 0.16,
      release: 0.4,
      trick: s.trickDur || 0.85,
      pointLaunch: 0.45,
      wallJump: 0.3,
      zipPull: 0.28,
      vault: 0.3,
    };
    if (!(s.sub in timed) || s.subT > timed[s.sub]) {
      if (s.sub === "trick") s.trick = null;
      if (s.dive || s.gliding) setSub("dive");
      else if (s.vel.y > 3) setSub("rise");
      else if (s.vel.y > -4) setSub("apex");
      else setSub(s.vel.y < -24 && !I.swing ? "dive" : "fall");
    }
  }
  // Water (river beyond the seawall; floor below -1 m): Spidey never lands on / runs across water. On contact he
  // splashes and immediately web-yanks himself back onto the nearest dry ground on a ballistic arc.
  const WATER_Y = -1.0;
  function waterBounce() {
    let best = null,
      bd = Infinity;
    for (let r = 4; r <= 120 && !best; r += 4) {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2,
          x = s.pos.x + Math.sin(a) * r,
          z = s.pos.z + Math.cos(a) * r;
        const gy = world.groundHeight(x, z, 200);
        if (gy > WATER_Y + 0.3 && gy < s.pos.y + 25) {
          // prefer a point a few metres inland so he doesn't land on the seawall lip
          const d = r;
          if (d < bd) {
            bd = d;
            best = new THREE.Vector3(
              x + Math.sin(a) * 5,
              0,
              z + Math.cos(a) * 5,
            );
          }
        }
      }
    }
    if (!best) return false;
    best.y = world.groundHeight(best.x, best.z, 200);
    const from = _v.set(s.pos.x, feetY(), s.pos.z);
    const hd = Math.hypot(best.x - from.x, best.z - from.z),
      tf = clamp(0.55 + hd / 20, 0.9, 2.4);
    const g = G; // (apex hang only lengthens the flight: errs on the inland side)
    s.vel.set(
      (best.x - from.x) / tf,
      (best.y + 0.4 - from.y) / tf + 0.5 * g * tf,
      (best.z - from.z) / tf,
    );
    s.pos.y = WATER_Y + H - 0.3;
    setMode("air", "pointLaunch");
    s.airT = 0;
    s.apexY = feetY();
    s.swingCooldown = tf + 0.2;
    s.wallCooldown = 0.3;
    s.returnT = tf + 0.3; // the return arc is ballistic: no glide / air control / swing re-attach until it lands
    s.facing = Math.atan2(s.vel.x, s.vel.z);
    s.trick = null;
    s.dive = false;
    s.gliding = false;
    s.noAnchorT = 0;
    const tgt = best.clone();
    tgt.y += 0.2;
    web.attach(rig.handWorld("R"), tgt, _v2.set(0, 1, 0));
    s.dashWebT = 0.3;
    events.push(
      { type: "waterSplash", severity: clamp(-s.vel.y / 40, 0.2, 1) },
      { type: "pointLaunch" },
    );
    return true;
  }
  // (bridges r1) Halfway rule on the East River bridges (world.bridgeLimit, bridges.ts bridgeLimits): past a bridge's
  // mid-span (on the deck, swinging, perched on a cable or falling) he is web-yanked back toward Manhattan on a
  // ballistic arc onto the deck, like the water bounce (no teleport; no glide / air control / re-attach until he lands).
  function bridgeBounce(L) {
    leaveSwingOK = true;
    if (s.mode === "rope") leaveRope();
    if (s.sling.active) slingEnd(false);
    web.release();
    s.kin = null;
    s.wall.zipWeb = false;
    // (bridges r2) pick an arc that is clear of the towers / spires / cables: candidate landing points further back
    // toward Manhattan and higher arcs, each checked with raycasts along the ballistic path (first clear one wins)
    const from = _v.set(s.pos.x, feetY(), s.pos.z);
    let bx = L.target[0],
      by = L.target[1],
      bz = L.target[2],
      tf = 0,
      found = false;
    const dirX = Math.sign(bx - from.x) || -1,
      o = new THREE.Vector3(),
      q = new THREE.Vector3(),
      d = new THREE.Vector3();
    for (const back of [0, 25, 50, 80])
      for (const k of [1, 1.35, 1.7]) {
        const tx = L.target[0] + dirX * back,
          ty = world.groundHeight(tx, L.target[2], by + 12);
        const hd = Math.hypot(tx - from.x, L.target[2] - from.z),
          t0 = clamp(0.7 + hd / 35, 1.2, 2.6) * k;
        const vx = (tx - from.x) / t0,
          vy = (ty + 0.4 - from.y) / t0 + 0.5 * G * t0,
          vz = (L.target[2] - from.z) / t0;
        let clear = true;
        for (let i = 0; i < 14 && clear; i++) {
          const ta = (t0 * i) / 14 + 0.05,
            tb = (t0 * (i + 1)) / 14 - (i === 13 ? 0.25 : 0);
          for (const hy of [0.2, 1.7]) {
            o.set(
              from.x + vx * ta,
              from.y + hy + vy * ta - 0.5 * G * ta * ta,
              from.z + vz * ta,
            );
            q.set(
              from.x + vx * tb,
              from.y + hy + vy * tb - 0.5 * G * tb * tb,
              from.z + vz * tb,
            );
            d.subVectors(q, o);
            const len = d.length();
            if (len < 0.01) continue;
            if (world.raycast(o, d.divideScalar(len), len + 0.4)) {
              clear = false;
              break;
            }
          }
        }
        if (clear || (back === 80 && k === 1.7 && !found)) {
          bx = tx;
          by = ty;
          tf = t0;
          found = clear;
          if (clear) break;
        }
        if (found) break;
      }
    if (!found && !tf) {
      const hd = Math.hypot(bx - from.x, bz - from.z);
      tf = clamp(0.7 + hd / 35, 1.2, 2.6);
    }
    s.vel.set(
      (bx - from.x) / tf,
      (by + 0.4 - from.y) / tf + 0.5 * G * tf,
      (bz - from.z) / tf,
    );
    s.bridgeRetUntil = s.clock + tf + 0.2;
    setMode("air", "pointLaunch");
    leaveSwingOK = false;
    s.airT = 0;
    s.apexY = feetY();
    s.swingCooldown = tf + 0.2;
    s.wallCooldown = 0.4;
    s.grounded = false;
    s.returnT = tf + 0.3;
    s.bridgeBT = s.clock;
    s.facing = Math.atan2(s.vel.x, s.vel.z);
    s.trick = null;
    s.dive = false;
    s.gliding = false;
    s.noAnchorT = 0;
    s.charging = false;
    web.attach(
      rig.handWorld("R"),
      _v2.set(L.web[0], L.web[1], L.web[2]),
      _v3.set(0, 1, 0),
    );
    s.dashWebT = 0.35;
    events.push({ type: "bridgeLimit", name: L.name }, { type: "pointLaunch" });
  }
  function land(f, I) {
    s.airTrickUsed = false;
    s.airTapT = -9;
    if (f < WATER_Y && waterBounce()) return;
    s.noAnchorT = 0;
    s.gliding = false;
    s.groundSwing = false;
    const impact = -s.vel.y,
      drop = s.apexY - f;
    s.pos.y = f + H;
    s.floorY = f;
    const inD = inputDir(I, new THREE.Vector3());
    const hv = hdir(s.vel, _v2);
    const hs = Math.hypot(s.vel.x, s.vel.z);
    const holding =
      inD.lengthSq() > 0.09 && hv && inD.normalize().dot(hv) > 0.3;
    const sev = clamp(
      (Math.max(impact, Math.sqrt(Math.max(0, drop) * 2 * G) * 0.8) - 9) / 28,
      0,
      1,
    );
    enterGround("idle");
    s.landing.severity = sev;
    if (impact < 7) {
      s.landing.lock = 0;
      if (impact > 4) setSub("landLight");
      s.speed = hs;
    } else if (holding && hs > 8.5 && (impact > 13 || drop > 4)) {
      setSub("landRoll");
      s.landing.lock = 0.35;
      s.speed = Math.min(hs * 0.85, 16);
      s.facing = Math.atan2(hv.x, hv.z);
    } else if (impact < 13 && drop < 6) {
      setSub("landLight");
      s.landing.lock = 0;
      s.speed = holding ? hs : hs * 0.8;
    } else if (impact < 23 && drop < 16) {
      setSub("landMedium");
      s.landing.lock = holding ? 0.06 : 0.14;
      s.speed = hs * (holding ? 0.7 : 0.45);
    } else {
      setSub("landHard");
      s.landing.lock = 0.42;
      s.speed = 0;
    }
    s.charging = false;
    s.jumpCharge = 0;
    s.carry.set(0, 0, 0);
    events.push({
      type: "land",
      kind: s.sub,
      severity: s.sub === "idle" ? 0 : sev,
    });
  }

  // ------------------------------------------------------------------ corridor keeping (swing / air chains stay in the street canyon)
  const corr = { t: 0, push: new THREE.Vector3() };
  function corridor(h, inD) {
    corr.t -= h;
    if (corr.t <= 0) {
      corr.t = 0.05;
      corr.push.set(0, 0, 0);
      const hv = hdir(s.vel, _v);
      if (!hv) return;
      const right = _v2.set(-hv.z, 0, hv.x);
      const sp = Math.hypot(s.vel.x, s.vel.z);
      for (const sgn of [1, -1])
        for (const fwdK of [0, 0.5]) {
          const d = _v3
            .copy(right)
            .multiplyScalar(sgn)
            .addScaledVector(hv, fwdK)
            .normalize();
          const hit = world.raycast(s.pos, d, 16);
          if (!hit || Math.abs(hit.normal.y) > 0.5) continue;
          const k = clamp((16 - hit.distance) / 11, 0, 1); // 0 at 16 m .. 1 at 5 m
          corr.push.addScaledVector(
            right,
            -sgn * k * k * (fwdK ? 0.6 : 1) * Math.min(1, sp / 15),
          );
        }
    }
    if (corr.push.lengthSq() < 1e-4) return;
    // don't fight a player deliberately steering into the wall (they want a wall-run)
    const want =
      inD.lengthSq() > 0.1
        ? -inD.dot(corr.push) /
          Math.max(corr.push.length(), 1e-3) /
          Math.max(inD.length(), 1e-3)
        : -1;
    if (want > 0.5) return;
    s.vel.addScaledVector(corr.push, 24 * h);
  }

  // ------------------------------------------------------------------ swing
  const travel = new THREE.Vector3();
  // desired travel heading while airborne / swinging: camera forward turned by the stick (W = camera direction,
  // A/D = 45-90 deg turns). null without input.
  function steerHeading(I, inD, out) {
    if (inD.lengthSq() < 0.02) return null;
    return out.set(inD.x, 0, inD.z).normalize();
  }
  // look-ahead along the swing: a facade within ~0.9 s of travel bends the heading toward the canyon (rad this step)
  const avoidS = { t: 0, rate: 0 };
  function facadeAvoid(h) {
    avoidS.t -= h;
    if (avoidS.t <= 0) {
      avoidS.t = 0.06;
      avoidS.rate = 0;
      const hv = hdir(s.vel, _v2);
      const hs = Math.hypot(s.vel.x, s.vel.z);
      if (hv && hs > 6) {
        const look = clamp(hs * 0.9, 8, 34);
        const hit = world.raycast(s.pos, hv, look);
        if (hit && Math.abs(hit.normal.y) < 0.5) {
          const n = hit.normal,
            into = -(hv.x * n.x + hv.z * n.z);
          if (into > 0.25) {
            // turn toward the wall tangent that is closer to the current heading
            const tx = -n.z,
              tz = n.x,
              sd = Math.sign(hv.x * tx + hv.z * tz) || 1;
            const urgency = clamp(1 - hit.distance / look, 0, 1);
            const cur = Math.atan2(hv.x, hv.z),
              tgt = Math.atan2(tx * sd + n.x * 0.3, tz * sd + n.z * 0.3);
            avoidS.rate =
              clamp(angWrap(tgt - cur), -1, 1) * (0.6 + 2.2 * urgency) * into;
          }
        }
      }
    }
    return avoidS.rate * h;
  }
  function travelDir(I, out) {
    const hv = hdir(s.vel, out);
    const inD = inputDir(I, _v3);
    if (hv && Math.hypot(s.vel.x, s.vel.z) > 4) return hv;
    if (inD.lengthSq() > 0.05) return out.copy(inD).normalize();
    if (hv) return hv;
    return cam.forwardFlat(out);
  }
  function tryStartSwing(I) {
    const fwd = travelDir(I, travel);
    {
      const want = steerHeading(I, inputDir(I, _v5), _v4);
      if (want && want.dot(fwd) > -0.5) fwd.lerp(want, 0.6).normalize();
    } // the NEXT anchor follows the player's chosen heading
    const inD = inputDir(I, new THREE.Vector3());
    let turn = null;
    if (inD.lengthSq() > 0.1) {
      inD.normalize();
      if (inD.dot(fwd) < 0.85) turn = inD;
    }
    const hs = Math.hypot(s.vel.x, s.vel.z);
    const fl = floorAt(s.pos.x, s.pos.z, feetY() + 0.1);
    const a = anchors.find(s.pos, fwd, turn, s.vel.length(), fl);
    if (!a) {
      events.push({ type: "noAnchor" });
      s.noAnchorT = (s.noAnchorT || 0) + 0.06;
      return false;
    }
    s.noAnchorT = 0;
    startSwing(a, fwd, turn, hs);
    s.groundSwing = false;
    return true;
  }
  function startSwing(a, fwd, turn, hs) {
    const S = s.swing;
    s.chain =
      (s.sinceSwing ?? 99) <= CHAIN_BUF
        ? Math.min(CHAIN_MAX, (s.chain || 0) + 1)
        : 0; // user r10g momentum chain
    events.push({ type: "swingChain", n: s.chain });
    S.anchor.copy(a.point);
    S.normal.copy(a.normal);
    S.kind = a.kind;
    S.dir.copy(turn ? fwd.clone().lerp(turn, 0.6).normalize() : fwd);
    // physics pivot: the real anchor with part of its lateral offset removed (keeps the arc in the travel plane; corner swings keep more)
    // (always fully in-plane: corner turns are done by steering the plane, never by a laterally offset pivot — an
    // offset pivot plus rope reel-in was the source of sideways position jumps)
    const keep = 0.0;
    const dx = a.point.x - s.pos.x,
      dz = a.point.z - s.pos.z,
      along = dx * S.dir.x + dz * S.dir.z;
    const lx = dx - S.dir.x * along,
      lz = dz - S.dir.z * along;
    S.pivot.set(
      s.pos.x + S.dir.x * along + lx * keep,
      a.point.y,
      s.pos.z + S.dir.z * along + lz * keep,
    );
    const L = s.pos.distanceTo(S.pivot);
    // no ground scraping: the bottom of the arc keeps the feet >= 2.4 m over the highest floor under the arc
    let fmax = -Infinity;
    for (const k of [0, 0.5, 1, 1.4]) {
      const x = s.pos.x + (S.pivot.x - s.pos.x) * k,
        z = s.pos.z + (S.pivot.z - s.pos.z) * k;
      fmax = Math.max(fmax, floorAt(x, z, S.pivot.y - 2));
    }
    // arc depth: dip toward the street (Insomniac look) but keep the feet over bus height; higher entries dip deeper
    const hEntry = s.pos.y - H - fmax;
    let bottomFeet =
      a.kind === "low"
        ? 3.0
        : Math.max(fmax < 1 ? 4.2 : 2.6, clamp(8 + hEntry * 0.3, 11, 18));
    // user r10f: chained swings climb — the arc dips at most SWING_DIP below the entry, so every swing exits near its
    // entry height and the release pop (REL_UP) nets height each time (the street-dip look above still applies low down)
    if (a.kind !== "low") bottomFeet = Math.max(bottomFeet, hEntry - SWING_DIP);
    S.ropeTarget = Math.max(4, Math.min(L, S.pivot.y - fmax - H - bottomFeet));
    // Arc depth without reel-in: if the rope from here would swing the feet below the clearance line, the (virtual)
    // physics pivot is raised instead (longer, flatter arc; the web is still drawn to the real anchor). Solves
    // u - sqrt(hd^2 + u^2) = -(y0 - B) for the pivot height u above the body.
    // low entries (street-level chains): the bottom may not be above the entry — it sits >= 3.5 m over the floor and
    // at most ~2 m under the entry height (a flat, fast arc over the traffic)
    {
      const y0 = s.pos.y,
        B = fmax + H + bottomFeet,
        dyc = y0 - B;
      const hd = Math.hypot(S.pivot.x - s.pos.x, S.pivot.z - s.pos.z);
      if (dyc > 0.5 && S.pivot.y - L < B) {
        const u = Math.min(70, (hd * hd - dyc * dyc) / (2 * dyc));
        if (u > S.pivot.y - y0) S.pivot.y = y0 + u;
        S.ropeTarget = Math.max(S.ropeTarget, s.pos.distanceTo(S.pivot) - 1);
      }
    }
    S.rope = s.pos.distanceTo(S.pivot);
    S.t = 0;
    S.tension = 0;
    S.tautT = 0;
    S.cornered = false;
    S.y0 = s.pos.y;
    S.slack = 0;
    S.slackT = 0;
    S.kick = 0;
    S.kickCd = 0;
    S.apexed = false;
    S.angMax = -9;
    S.ang0 = null; // ang0: attach angle (swing completion)
    // momentum conservation: redirect velocity along the swing tangent keeping speed (dive speed becomes swing speed)
    const rd = _v.copy(S.pivot).sub(s.pos).normalize();
    const sp = s.vel.length(),
      vr = s.vel.dot(rd);
    // the web goes taut on attach (no slack free-fall + snap): velocity is rotated onto the arc tangent, keeping speed.
    // Moving away from the pivot the web catches (small loss); moving toward it the web is reeled in (no loss).
    {
      const tan = _v2.copy(s.vel).addScaledVector(rd, -vr);
      if (tan.lengthSq() > 0.01)
        s.vel.copy(tan.normalize().multiplyScalar(sp * (vr < 0 ? 0.96 : 1)));
      else if (sp > 0.5) s.vel.copy(S.dir).multiplyScalar(sp);
    }
    if (hs < 11) {
      // web yank when starting slow — along the arc tangent (never toward the pivot, which would slacken the web)
      const yd = _v4.copy(S.dir).addScaledVector(rd, -S.dir.dot(rd));
      if (yd.lengthSq() > 1e-3)
        s.vel.addScaledVector(yd.normalize(), (11 - hs) * 0.7);
    }
    capSpeed();
    const right = _v3.set(-S.dir.z, 0, S.dir.x);
    const lat = dx * right.x + dz * right.z;
    S.hand =
      Math.abs(lat) > 2 ? (lat > 0 ? "R" : "L") : S.hand === "R" ? "L" : "R";
    web.attach(rig.handWorld(S.hand), S.anchor, S.normal);
    setMode("swing", "swingLow");
    s.trick = null;
    s.dive = false;
    s.airTrickUsed = false;
    s.airTapT = -9;
    events.push({ type: "swingStart" });
  }
  function swingPhase() {
    const S = s.swing;
    const along =
      (s.pos.x - S.pivot.x) * S.dir.x + (s.pos.z - S.pivot.z) * S.dir.z;
    const below = S.pivot.y - s.pos.y;
    return clamp(Math.atan2(along, Math.max(below, 0.01)) / 1.25, -1, 1);
  }
  function stepSwing(h, I) {
    const S = s.swing;
    S.t += h;
    // the web is released ONLY by letting go of the swing button (user feedback #4) — no jump / angle / height auto-release
    if (!I.swing) {
      releaseSwing("manual", I);
      return;
    }
    if (I.jumpPressed) {
      // user r4 #10: Space = let go AND launch along the current velocity with extra force
      leaveSwingOK = true;
      releaseSwing("jump", I);
      leaveSwingOK = false; // boosts (speed + height) applied in releaseSwing
      s.swingCooldown = 0.35;
      events.push({ type: "swingJump" });
      return;
    }
    s.vel.y -= GS * h;
    const rd = _v.copy(S.pivot).sub(s.pos);
    const dist = rd.length();
    rd.divideScalar(dist);
    // steering: input perpendicular to the rope; also bends the travel plane (corner swings)
    const inD = inputDir(I, new THREE.Vector3());
    // STEERING (Insomniac): the desired heading = camera forward turned by the stick. The whole swing (plane, body
    // position and velocity) precesses about the vertical line through the pivot toward that heading — a conical /
    // tangential turn that keeps speed and rope length (no sideways shove, no out-of-plane drift). Facades on the
    // predicted arc bend the heading away pre-emptively.
    const sideA = _v5.set(-S.dir.z, 0, S.dir.x);
    let latIn = 0;
    {
      const want = steerHeading(I, inD, _v4);
      let dyaw = 0;
      if (want) {
        const cur = Math.atan2(S.dir.x, S.dir.z),
          tgt = Math.atan2(want.x, want.z);
        const d = angWrap(tgt - cur);
        if (Math.abs(d) < 2.6)
          dyaw = clamp(d, -1.7 * h, 1.7 * h) * clamp(Math.abs(d) / 0.25, 0, 1);
        latIn = clamp(d / 0.8, -1, 1);
      }
      const avoid = facadeAvoid(h);
      dyaw += avoid;
      if (Math.abs(dyaw) > 1e-6) {
        _q.setFromAxisAngle(UP, dyaw);
        S.dir.applyQuaternion(_q).normalize();
        s.vel.applyQuaternion(_q);
        // the (virtual) physics pivot swings around the BODY: the body path stays continuous (no sideways slide), only
        // the arc's heading turns; the drawn web stays on the real anchor
        const rel = _v3.copy(S.pivot).sub(s.pos);
        rel.applyQuaternion(_q);
        S.pivot.copy(s.pos).add(rel);
        sideA.set(-S.dir.z, 0, S.dir.x);
      }
    }
    // never grind along a facade: a wall within ~2.5 m at the side pushes the body (and the virtual pivot) out
    // toward the street, so a pinned swing peels off the wall instead of dangling against the bricks
    {
      S.sideT = (S.sideT || 0) - h;
      if (S.sideT <= 0) {
        S.sideT = 0.05;
        S.sideN = null;
        for (const sg of [1, -1]) {
          const hh = world.raycast(
            s.pos,
            _v2.copy(sideA).multiplyScalar(sg),
            2.5,
          );
          if (hh && Math.abs(hh.normal.y) < 0.5) {
            S.sideN = (S.sideN || new THREE.Vector3())
              .set(hh.normal.x, 0, hh.normal.z)
              .normalize();
            S.sideK = 1 - hh.distance / 2.5;
          }
        }
      }
      if (S.sideN) {
        s.vel.addScaledVector(S.sideN, 10 * S.sideK * h);
        S.pivot.addScaledVector(S.sideN, 3 * S.sideK * h);
      }
    }
    // keep the pendulum in its plane: sideways velocity decays -> no drift into facades
    {
      const vl = s.vel.dot(sideA);
      s.vel.addScaledVector(sideA, -vl * (1 - Math.exp(-2.5 * h)));
    }
    corridor(h, inD);
    const spd = s.vel.length();
    // Insomniac "pump": ONLY with stick input along the swing direction while moving forward along the arc, strongest at
    // the bottom, and never beyond the energy that reaches ~100 deg of arc (a held swing without input is a pendulum).
    const tan = _v2.copy(s.vel).addScaledVector(rd, -s.vel.dot(rd));
    const push =
      inD.lengthSq() > 0.01
        ? clamp(inD.dot(S.dir) / Math.max(inD.length(), 1e-3), 0, 1)
        : 0;
    if (
      push > 0 &&
      tan.lengthSq() > 0.01 &&
      tan.dot(S.dir) > 0 &&
      S.tautT > 0
    ) {
      const E = 0.5 * spd * spd + GS * (s.pos.y - S.pivot.y); // specific energy relative to the pivot
      const Ecap = -GS * S.rope * Math.cos(PUMP_MAX_ANG); // energy that just reaches PUMP_MAX_ANG
      const room = clamp((Ecap - E) / (GS * 1.5), 0, 1);
      const bottom = Math.max(0, rd.y);
      s.vel.addScaledVector(
        tan.normalize(),
        9 * bottom * bottom * push * room * h,
      );
    }
    // climb assist (user r10f "web swings are supposed to give height each time"): on the rising half of the arc, with the
    // stick along the swing, the web drives him along the arc until he is SWING_GAIN above the height he attached at, so
    // every swing exits higher than it began (the release pop REL_UP adds on top) and a chain climbs
    if (
      push > 0 &&
      tan.lengthSq() > 0.01 &&
      s.vel.y > 0 &&
      tan.dot(S.dir) > 0 &&
      S.tautT > 0.1 &&
      S.y0 != null
    ) {
      const short = S.y0 + SWING_GAIN - s.pos.y;
      if (short > 0)
        s.vel.addScaledVector(
          _v3.copy(tan).normalize(),
          Math.min(short, 3) * 4.5 * push * h,
        );
    }
    // first-arc carry: on the rising front half of the FIRST arc only (before its apex) a web "motor" guarantees a
    // minimum speed along the arc so the opening swing reaches the anchor's height instead of stalling. After the first
    // apex it is pure rope physics (no motor). The web is NOT released by this or anything else while RMB is held.
    if (!S.apexed) {
      const ang = swingAngle();
      if (ang > 0.15 && ang < 1.0 && S.tautT > 0.05 && S.tension > 0.05) {
        const tg = _v3
          .copy(S.dir)
          .multiplyScalar(Math.cos(ang))
          .addScaledVector(UP, Math.sin(ang)); // arc tangent (forward/up)
        const vt = s.vel.dot(tg);
        if (vt > -1.5) {
          const u = clamp((ang - 0.15) / 0.85, 0, 1);
          const vmin =
            clamp(0.65 * Math.sqrt(GS * S.rope), 10, 18) * u * u * (3 - 2 * u);
          if (vt < vmin) s.vel.addScaledVector(tg, Math.min(vmin - vt, 30 * h));
        }
      }
    }
    // aerodynamic drag (quadratic): a held swing with no input settles into a decaying pendulum within a few passes
    s.vel.multiplyScalar(
      Math.max(0, 1 - SWING_DRAG * (1 - 0.08 * (s.chain || 0)) * spd * h),
    ); // a momentum chain slips through the air (r10g)
    if (spd > 37 + 3 * (s.chain || 0)) s.vel.multiplyScalar(1 - 0.3 * h); // soft top speed (hard cap VMAX; dives exceed it); a swing chain lifts it (r10g)
    // reel toward target length (lifts off the street), faster if the feet approach the floor
    const fl = floorAt(s.pos.x, s.pos.z, feetY() + 0.2);
    const clearance = feetY() - fl;
    if (clearance < 2.2 && s.vel.y < 0)
      S.ropeTarget = Math.min(
        S.ropeTarget,
        Math.max(3, S.pivot.y - (fl + 2.4 + H)),
      );
    {
      const want = damp(
        S.rope,
        S.ropeTarget,
        clearance < 1.5 ? 10 : S.kind === "low" || clearance < 4 ? 6 : 3.2,
        h,
      );
      S.rope = Math.max(want, S.rope - (clearance < 3 ? 22 : 14) * h);
    } // reel-in speed limit: the body is never yanked along the rope
    // web auto-tension: a slack web retracts (down to the clearance length) so the arc starts smoothly, no free-fall jerk
    const Lnow = s.pos.distanceTo(S.pivot);
    // (not over the top: above the pivot's level a slack web stays slack and snaps taut when he falls back onto it)
    if (Lnow < S.rope && S.t < 0.6)
      S.rope = Math.max(S.ropeTarget, Lnow); // attach: taut at once
    else if (Lnow < S.rope && s.pos.y < S.pivot.y - 0.5)
      S.rope = Math.max(S.ropeTarget, Math.max(Lnow, S.rope - 45 * h));
    capSpeed();
    s.pos.addScaledVector(s.vel, h);
    // rope constraint (inequality: slack allowed)
    const d = _v3.copy(s.pos).sub(S.pivot);
    const L = d.length();
    let tension = 0,
      vrIn = 0;
    if (L > S.rope) {
      d.divideScalar(L);
      s.pos.copy(S.pivot).addScaledVector(d, S.rope);
      const vr = s.vel.dot(d);
      if (vr > 0) {
        s.vel.addScaledVector(d, -vr);
        vrIn = vr;
      }
      const vt2 = s.vel.lengthSq();
      tension = clamp(
        (vt2 / Math.max(S.rope, 1) + GS * Math.max(0, -d.y)) / (GS * 2.6),
        0,
        1,
      );
    }
    // slack: over the top (angle > 90 deg without enough speed for v^2/r > g) the body free-falls inside the circle; the
    // web sags (web.setSlack) and the pose leaves the hang. When the rope catches again it snaps taut with a jolt.
    // physical criterion: required rope pull = v_t^2/L - g.(outward); < 0 means gravity out-pulls the circle -> free fall
    const du = _v4.copy(s.pos).sub(S.pivot).divideScalar(Math.max(L, 1e-3));
    const vtan2 = s.vel.lengthSq() - s.vel.dot(du) ** 2;
    const need = vtan2 / Math.max(L, 1) - GS * du.y;
    const slackT =
      tension < 0.05
        ? Math.max(
            clamp(-need / (GS * 0.35), 0, 1),
            clamp((S.rope - L) / 1.0, 0, 1),
          )
        : 0;
    if (slackT > 0.2) S.slackT += h;
    else if (tension > 0.05) {
      if (S.slackT > 0.18 && vrIn > 2) {
        tension = 1;
        events.push({ type: "ropeSnap", severity: clamp(vrIn / 14, 0.15, 1) });
      }
      S.slackT = 0;
    }
    S.slack = damp(S.slack, slackT, slackT > S.slack ? 6 : 14, h);
    S.tension = damp(S.tension, tension, 12, h);
    if (tension > 0.05) S.tautT += h;
    // wall contact: the web stays attached (never a wall-run takeover / drop while held). A real impact becomes a
    // "wall-skip": velocity is redirected along the facade (keeps ~88% of the speed, biased along the swing direction and
    // up) plus a push-off, with a short cooldown so he does not grind. A wider capsule keeps the limbs out of the facade.
    S.kickCd -= h;
    S.kick = Math.max(0, S.kick - h / 0.4);
    const c = collide(0.3, R + 0.22);
    if (c) {
      // the pivot is never deeper toward this facade than the body: gravity must not keep pulling him into the wall
      {
        const dn =
          (s.pos.x - S.pivot.x) * c.normal.x +
          (s.pos.z - S.pivot.z) * c.normal.z;
        if (dn > 0) {
          S.pivot.x += c.normal.x * (dn + 0.6);
          S.pivot.z += c.normal.z * (dn + 0.6);
        }
      }
      const vn = s.vel.dot(c.normal);
      if (vn < 0) {
        const sp0 = s.vel.length();
        s.vel.addScaledVector(c.normal, -vn); // slide component (along the facade)
        if (-vn > 3.5 && S.kickCd <= 0 && sp0 > 6) {
          const slide = _v4.copy(s.vel);
          if (slide.lengthSq() > 1e-4) slide.normalize();
          const along = _v5
            .copy(S.dir)
            .addScaledVector(c.normal, -S.dir.dot(c.normal));
          along.y = 0;
          if (along.lengthSq() > 1e-4)
            slide.addScaledVector(along.normalize(), 0.45);
          slide
            .addScaledVector(UP, 0.35)
            .addScaledVector(c.normal, -slide.dot(c.normal));
          if (slide.lengthSq() < 1e-4) slide.copy(UP);
          slide.normalize();
          s.vel
            .copy(slide)
            .multiplyScalar(sp0 * 0.88)
            .addScaledVector(c.normal, clamp(-vn * 0.12, 1.5, 3));
          S.kickCd = 0.35;
          S.kick = 1;
          events.push({
            type: "swingWallKick",
            severity: clamp(-vn / 30, 0.1, 0.6),
          });
        }
      }
    }
    // floor contact: never scrape — lift and keep going
    const f2 = floorAt(s.pos.x, s.pos.z, feetY() + 0.4);
    if (feetY() < f2 + 0.3) {
      s.pos.y = f2 + 0.3 + H;
      if (s.vel.y < 0) s.vel.y = 0;
    }
    // phase / sub-state
    S.phase = swingPhase();
    S.angle = swingAngle();
    if (S.ang0 == null) S.ang0 = S.angle;
    S.angMax = Math.max(S.angMax ?? -9, S.angle);
    if (!S.apexed && ((S.angle < S.angMax - 0.06 && S.angMax > 0.2) || S.t > 4))
      S.apexed = true;
    if (S.kick > 0.3) setSub("wallKick");
    else if (S.slack > 0.5) setSub("swingSlack");
    else
      setSub(
        S.phase < -0.28
          ? "swingLow"
          : S.phase < 0.28
            ? "swingBottom"
            : "swingHigh",
      );
    web.setSlack?.(S.slack, S.tension);
    // NO auto-release: while the button is held he keeps swinging — up past the anchor, over and around (pure rope physics)
    ropeWrap(h);
  }
  // Rope wrap: if a building now sits between the body and the anchor (the rope would pass THROUGH it — physically
  // impossible) the web wraps on that edge: the contact point becomes the new anchor/pivot with the remaining length.
  // Velocity is untouched (momentum conserved) and the strand is re-targeted, not re-shot. This is the ONLY way the
  // anchor changes while RMB is held.
  function ropeWrap(h) {
    const S = s.swing;
    S.wrapT = (S.wrapT || 0) - h;
    if (S.wrapT > 0) return;
    S.wrapT = 0.05;
    const d = _v4.copy(S.anchor).sub(s.pos);
    const L = d.length();
    if (L < 4) return;
    d.divideScalar(L);
    const hit = world.raycast(s.pos, d, L - 1.5);
    if (!hit || hit.distance < 1.5) return;
    // the rope passes through a building (e.g. after steering round a corner): RE-ANCHOR ahead along the current
    // heading when a good anchor exists (the web is re-shot, never dropped); otherwise wrap on the building edge
    {
      const fl = floorAt(s.pos.x, s.pos.z, feetY() + 0.1);
      const a = anchors.find(
        s.pos,
        _v3.set(S.dir.x, 0, S.dir.z).normalize(),
        null,
        s.vel.length(),
        fl,
      );
      if (a && a.point.y > s.pos.y + 3) {
        S.anchor.copy(a.point);
        S.normal.copy(a.normal);
        S.kind = a.kind;
        const dx = a.point.x - s.pos.x,
          dz = a.point.z - s.pos.z,
          al = dx * S.dir.x + dz * S.dir.z;
        S.pivot.set(s.pos.x + S.dir.x * al, a.point.y, s.pos.z + S.dir.z * al);
        const Ln = s.pos.distanceTo(S.pivot);
        S.rope = Ln;
        S.ropeTarget = Math.max(4, Ln - 6);
        web.attach(rig.handWorld(S.hand), S.anchor, S.normal, {
          shootDur: 0.06,
        });
        events.push({ type: "ropeReanchor" });
        return;
      }
    }
    const p = _v5.copy(hit.point).addScaledVector(hit.normal, 0.06);
    S.anchor.copy(p);
    S.normal.copy(hit.normal);
    // physics pivot stays in the current swing plane (the wrap never turns the chain on its own; S.dir unchanged)
    {
      const dx = p.x - s.pos.x,
        dz = p.z - s.pos.z,
        al = dx * S.dir.x + dz * S.dir.z;
      S.pivot.set(s.pos.x + S.dir.x * al, p.y, s.pos.z + S.dir.z * al);
    }
    const Ln = s.pos.distanceTo(S.pivot);
    S.rope = Ln;
    S.ropeTarget = Math.min(S.ropeTarget, Ln);
    web.retarget?.(p, hit.normal);
    events.push({ type: "ropeWrap" });
  }
  // signed rope angle from straight down, in the swing plane: 0 bottom, +pi/2 level in front, -pi/2 level behind
  function swingAngle() {
    const S = s.swing;
    const along =
      (s.pos.x - S.pivot.x) * S.dir.x + (s.pos.z - S.pivot.z) * S.dir.z;
    return Math.atan2(along, S.pivot.y - s.pos.y);
  }
  // ---- release / air tricks (TRICK_DEF). Selection follows the release trajectory: flat & fast -> tucked front flip / corkscrew,
  // high & steep -> layout flip, stick held sideways -> corkscrew drifting that way; never the same trick twice in a row.
  function chooseTrick(I) {
    const sp = s.vel.length(),
      hs = Math.hypot(s.vel.x, s.vel.z),
      vy = s.vel.y,
      steep = sp > 1 ? vy / sp : 0;
    const hv =
      hdir(s.vel, _v2) || _v2.set(Math.sin(s.facing), 0, Math.cos(s.facing));
    const inD = inputDir(I || lastInput || { move: { x: 0, y: 0 } }, _v3);
    const lat = inD.z * hv.x - inD.x * hv.z; // stick component to the RIGHT of travel (+) / left (-)
    const W = { tuckFlip: 1, corkscrew: 1, layout: 1, scissor: 0.7 };
    if (steep < 0.3) {
      W.tuckFlip += 2.2;
      W.corkscrew += 1.4;
      W.layout = 0.6;
    } else if (steep > 0.55) {
      W.layout += 2.4;
      W.tuckFlip = 0.25;
      W.scissor = 0.4;
    }
    if (hs > 22) {
      W.tuckFlip += 1;
      W.corkscrew += 0.6;
    }
    if (vy < -2) W.layout = 0.3;
    if (vy < -5) {
      W.layout = 0.1;
      W.tuckFlip += 1;
    } // released falling: out-and-forward tricks
    if (Math.abs(lat) > 0.35) W.corkscrew += 2; // stick held sideways: barrel roll that drifts that way
    if (s.lastTrickName) W[s.lastTrickName] = 0;
    let tot = 0;
    for (const k of TRICKS) tot += W[k];
    let r = rnd() * tot,
      name = TRICKS[0];
    for (const k of TRICKS) {
      r -= W[k];
      if (r <= 0) {
        name = k;
        break;
      }
    }
    s._trickLat = lat;
    s._trickSteep = steep;
    return name;
  }
  function startTrick(name) {
    const D = TRICK_DEF[name],
      lat = s._trickLat || 0;
    s.trick = name;
    s.lastTrickName = name;
    // side: layout +1 front flip / -1 back flip (steep, rising releases flip backward); corkscrew rolls / drifts toward the stick
    s.trickSide =
      name === "layout"
        ? ((s._trickSteep ?? 0) > 0.45 ? -1 : 1) * (rnd() < 0.2 ? -1 : 1)
        : Math.abs(lat) > 0.35
          ? Math.sign(lat)
          : rnd() < 0.5
            ? 1
            : -1;
    s.trickDur = D.dur;
    s.trickSnapT = D.dur * D.snap;
    s.trickBoosted = false;
    s.trickNoUp = false;
    setSub("trick");
  }
  function trickBoost(I) {
    const D = TRICK_DEF[s.trick];
    s.trickBoosted = true;
    if (!D) return;
    const k =
      stats.releaseBoost ?? (globalThis.__ctx?.params?.swingReleaseBoost || 1);
    const sp0 = s.vel.length(),
      vy0 = s.vel.y;
    const hv =
      hdir(s.vel, _v2) || _v2.set(Math.sin(s.facing), 0, Math.cos(s.facing));
    if (D.steer) {
      // corkscrew: the roll turns the heading toward the stick (up to D.steer rad)
      const inD = inputDir(I, _v3);
      if (inD.lengthSq() > 0.09) {
        const d = angWrap(Math.atan2(inD.x, inD.z) - Math.atan2(hv.x, hv.z)),
          a = clamp(d, -D.steer, D.steer);
        const hs = Math.hypot(s.vel.x, s.vel.z),
          na = Math.atan2(hv.x, hv.z) + a;
        s.vel.x = Math.sin(na) * hs;
        s.vel.z = Math.cos(na) * hs;
        hv.set(Math.sin(na), 0, Math.cos(na));
      }
    }
    s.vel.x += hv.x * D.boost * k;
    s.vel.z += hv.z * D.boost * k;
    if (!s.trickNoUp) s.vel.y += (D.up || 0) * k;
    if (D.side && Math.abs(s._trickLat || 0) > 0.35) {
      const sd = s.trickSide || 1;
      s.vel.x += -hv.z * D.side * sd * k;
      s.vel.z += hv.x * D.side * sd * k;
    }
    const lim = Math.max(vmaxC(), sp0),
      sp = s.vel.length();
    if (sp > lim) s.vel.multiplyScalar(lim / sp);
    s.lastTrickBoost = {
      trick: s.trick,
      from: +sp0.toFixed(2),
      to: +s.vel.length().toFixed(2),
      vy0: +vy0.toFixed(2),
      vy: +s.vel.y.toFixed(2),
    };
    events.push({
      type: "trickBoost",
      trick: s.trick,
      dv: s.vel.length() - sp0,
    });
  }
  function releaseSwing(kind, I) {
    web.release();
    // release inertia (user feedback #4b): the velocity at the instant of release — tangent to the arc, speed AND
    // direction — carries over 1:1, plus a small constant boost along that same direction. No resets / clamps / re-aim.
    const sp = s.vel.length();
    if (sp > 0.5)
      s.vel.multiplyScalar(
        (sp + releaseBoost() + CHAIN_REL * (s.chain || 0)) / sp,
      ); // + momentum chain (r10g)
    const k = releaseBoost() / RELEASE_BOOST,
      hv =
        hdir(s.vel, new THREE.Vector3()) ||
        new THREE.Vector3(Math.sin(s.facing), 0, Math.cos(s.facing));
    // full-swing boost (user r-anim7): completion of the arc since the attach angle
    const Sw = s.swing,
      a0 = Sw.ang0 ?? swingAngle(),
      comp = clamp(
        (Math.max(swingAngle(), Sw.angMax ?? -9) - a0) /
          Math.max(2 * Math.abs(a0), 0.5),
        0,
        1.5,
      ); // furthest point the arc reached
    const fb =
        THREE.MathUtils.smoothstep(comp, 0.5, FULL_SWING_K) *
        (Sw.t > 0.35 ? 1 : 0),
      upB = FULL_SWING_UP * fb;
    s.lastSwingComp = +comp.toFixed(2);
    s.lastBoost = +fb.toFixed(2);
    if (fb > 0) {
      s.vel.x += hv.x * FULL_SWING_FWD * fb;
      s.vel.z += hv.z * FULL_SWING_FWD * fb;
      events.push({ type: "swingBoost", k: fb, comp });
    }
    if (kind !== "jump")
      s.vel.y = Math.min(
        Math.max(s.vel.y, REL_UP_VY + upB),
        Math.max(s.vel.y + REL_UP * k + upB, REL_UP * 0.75 * k + upB),
      );
    if (kind === "jump") {
      // user r11: Space-release = stronger forward push + a jump-off-the-web pop up
      s.vel.x += hv.x * SWING_JUMP * k;
      s.vel.z += hv.z * SWING_JUMP * k;
      s.vel.y = Math.min(
        SWING_JUMP_VY + upB,
        Math.max(s.vel.y + SWING_JUMP_UP + upB, SWING_JUMP_UP * 0.85 + upB),
      );
      s.jumpRelHold = true; // user r10c: with RMB still held the next web re-attached ~0.35 s later and ate the pop — no new web until the apex
    }
    setMode("air", "release");
    s.airT = 0;
    s.apexY = feetY();
    s.swingCooldown = 0.05;
    s.relT = 0;
    // release trick (user r10): the common case (~80 %); a plain release (normal air blend) never twice in a row. Needs room
    // to play out (~0.8 s of air). Velocity is untouched here — the trick's boost lands at its snap moment (trickBoost).
    const hf = heightAboveFloor(),
      room = hf > 5 && s.vel.length() > 9 && (s.vel.y > -5 || hf > 14);
    const force = globalThis.__forceTrick; // playtest / debug hook: trick name, or 'none'
    if (
      force ? force !== "none" && room : room && (!s.lastTrick || rnd() < 0.8)
    ) {
      startTrick(TRICK_DEF[force] ? force : chooseTrick(I));
      s.lastTrick = true;
    } else {
      s.trick = null;
      s.lastTrick = false;
      s.vel.x += hv.x * REL_NOTRICK * k;
      s.vel.z += hv.z * REL_NOTRICK * k;
    }
    s.trickNoUp = false; // user r10f: every release gains height again (the trick's small `up` lands at its snap too)
    const hs = Math.hypot(s.vel.x, s.vel.z),
      hl = Math.max(vmaxC(), sp) + FULL_SWING_FWD * fb;
    if (hs > hl) {
      s.vel.x *= hl / hs;
      s.vel.z *= hl / hs;
    }
    events.push({
      type: "release",
      kind,
      trick: s.trick,
      comp: +comp.toFixed(2),
      boost: +fb.toFixed(2),
    });
  }

  // ------------------------------------------------------------------ wall
  // is the contact a real facade (>= ~1 m wide, both sides of the contact present and coplanar)? Poles / posts / trunks
  // are not wall-runnable: the player slides around them instead.
  function wideWall(n, point) {
    const tx = -n.z,
      tz = n.x;
    let ok = 0;
    for (const sd of [-1, 1]) {
      const o = _v3.set(
        point.x + n.x * 0.5 + tx * sd * 0.5,
        s.pos.y,
        point.z + n.z * 0.5 + tz * sd * 0.5,
      );
      const hit = world.raycast(o, _v5.set(-n.x, 0, -n.z), 1.1);
      if (
        hit &&
        Math.abs(hit.normal.y) < 0.5 &&
        hit.normal.x * n.x + hit.normal.z * n.z > 0.8
      )
        ok++;
    }
    return ok === 2;
  }
  // (user r-wallrun) broad facade in the horizontal direction (dx, dz): a 3x3 ray fan (knee / chest / head x left / mid /
  // right) out to 1.3 m; faces turned toward us (bar fronts, glass, piers, masonry) vote, bar sides and poles don't. A
  // facade = >= 5 of 9 rays agree. Returns the mean normal, the nearest point and the tallest surface seen (for `top`).
  const _fo = new THREE.Vector3(),
    _fd = new THREE.Vector3(),
    _fp = new THREE.Vector3();
  function facadeAhead(dx, dz) {
    const tx = -dz,
      tz = dx;
    let nx = 0,
      nz = 0,
      k = 0,
      bd = Infinity;
    _fd.set(dx, 0, dz);
    for (const oy of [-0.45, 0.3, 0.95])
      for (const ol of [-0.38, 0, 0.38]) {
        const hit = world.raycast(
          _fo.set(s.pos.x + tx * ol, s.pos.y + oy, s.pos.z + tz * ol),
          _fd,
          R + 0.95,
        );
        if (
          !hit ||
          Math.abs(hit.normal.y) > 0.5 ||
          hit.normal.x * dx + hit.normal.z * dz > -0.5
        )
          continue;
        nx += hit.normal.x;
        nz += hit.normal.z;
        k++;
        if (hit.distance < bd) {
          bd = hit.distance;
          _fp.copy(hit.point);
        }
      }
    if (k < 5) return null;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    const up = world.raycast(
      _fo.set(s.pos.x, feetY() + 2.6, s.pos.z),
      _fd,
      R + 1.4,
    ); // still a wall above head height?
    return {
      normal: new THREE.Vector3(nx, 0, nz),
      point: _fp.clone(),
      into: -(dx * nx + dz * nz),
      top: up && Math.abs(up.normal.y) < 0.5 ? feetY() + 3 : feetY() + 1.9,
    };
  }
  // (user r-wallrun) a surface top found in the climb path is the real wall top only if the facade does not carry on
  // above it (a window sill / recess floor / cornice / sign top has more wall right behind and above it)
  function realTop(n, topY) {
    const reach = R + 0.02 + (s.wall.off || 0) + 2.1; // setbacks up to ~2 m are stepped over (see the setback step in stepWall)
    for (const dy of [1.1, 2.1]) {
      const hit = world.raycast(
        _fo.set(s.pos.x, topY + dy, s.pos.z),
        _fd.set(-n.x, 0, -n.z),
        reach,
      );
      if (hit && Math.abs(hit.normal.y) < 0.5 && hit.normal.dot(n) > 0.5)
        return false;
    }
    return true;
  }
  function enterWall(n, point, run, speed = 0, moving = false) {
    const W = s.wall;
    W.normal.copy(n).setY(0).normalize();
    s.pos.x = point.x + W.normal.x * (R + 0.02);
    s.pos.z = point.z + W.normal.z * (R + 0.02);
    W.runV = run
      ? clamp(Math.max(speed * 0.8, s.vel.y), WALLRUN * 0.9, WALLRUN * 1.15)
      : Math.max(0, Math.min(8, s.vel.y)); // r9q: carry ~run speed onto the wall
    W.fast = run;
    s.vel.set(0, 0, 0);
    s.dive = false;
    s.trick = null;
    W.up.set(0, 1, 0);
    W.off = 0;
    W.runK = 0;
    W.dist = R + 0.02;
    W.point.set(point.x, s.pos.y, point.z);
    setMode("wall", run || moving ? "wallRun" : "crawl");
    s.grounded = false;
    s.dashCount = 0; // (user r-wallrun) a held direction never flashes the cling pose on arrival
    events.push({ type: "wall", run });
  }
  // (user r-wallrun) is the obstacle beside us a real inner corner (a wall sticking out > ~1 m) or a shallow fin / pier /
  // bar / pipe (the running surface lifts over it: see the look-ahead relief in stepWall)?
  function deepSide(n, side) {
    for (const k of [0.75, 1.1]) {
      const hit = world.raycast(
        _fo.copy(s.pos).addScaledVector(n, k),
        side,
        R + 0.45,
      );
      if (!hit || Math.abs(hit.normal.y) > 0.5 || hit.normal.dot(side) > -0.7)
        return false;
    }
    return true;
  }
  // (user r-wallrun) the wall probe lost the facade, but it steps back <= 2.2 m (terrace ledge, setback, deep recess) and
  // the new face carries on above: re-base on it keeping the body where it is (W.off = the step depth, then the relief
  // envelope lets him in over the ledge smoothly) instead of dropping off or hopping onto a ledge with no room.
  function setbackStep(n, vy) {
    if (vy < -0.5 && Math.abs(vy) > 1) return false;
    const W = s.wall;
    for (const oy of [0.35, 0.9, -0.2]) {
      const far = world.raycast(
        _fo.copy(s.pos).setY(s.pos.y + oy),
        _fd.set(-n.x, 0, -n.z),
        R + 2.5 + W.off,
      );
      if (!far || Math.abs(far.normal.y) > 0.5 || far.normal.dot(n) < 0.9)
        continue;
      const above = world.raycast(
        _fo.copy(s.pos).setY(s.pos.y + 2.0),
        _fd,
        R + 2.7 + W.off,
      );
      if (!above || Math.abs(above.normal.y) > 0.5) continue; // nothing above: that is the top (hop / vault instead)
      n.copy(far.normal).setY(0).normalize();
      const dcur =
        (s.pos.x - far.point.x) * n.x + (s.pos.z - far.point.z) * n.z;
      W.off = Math.max(0, dcur - (R + 0.02));
      W.point.set(
        far.point.x + n.x * W.off,
        s.pos.y,
        far.point.z + n.z * W.off,
      );
      return true;
    }
    return false;
  }
  function wallBasis(n, right) {
    cam.rightFlat(right);
    right.addScaledVector(n, -right.dot(n));
    if (right.lengthSq() < 0.09) right.set(-n.z, 0, n.x).multiplyScalar(-1); // camera looks along the wall: fall back to wall-right as seen from outside
    return right.normalize();
  }
  function stepWall(h, I) {
    const W = s.wall,
      n = W.normal;
    const right = wallBasis(n, _v4);
    // user r9: the separate slow crawl is held for later (until the model supports it better) — ANY movement on a wall
    // is the wall run; with no input he just clings in place (crawl idle pose)
    let fast = I.sprint || I.swing || Math.hypot(I.move.x, I.move.y) > 0.2;
    let mx = I.move.x,
      my = I.move.y;
    // user r9: running sideways round a building — after a corner the camera still looks at the old face, so the held
    // key keeps meaning "carry on the same way round" until it is released / reversed or the camera catches up
    if (W.lockDir) {
      if (Math.sign(mx) === W.lockMx && Math.abs(mx) > 0.2) {
        if (right.dot(W.lockDir) * W.lockMx > 0.8)
          W.lockDir = null; // camera agrees again: plain camera mapping
        else right.copy(W.lockDir).multiplyScalar(W.lockMx);
      } else W.lockDir = null;
    }
    if (fast && Math.hypot(mx, my) < 0.2) my = 1; // parkour held with no direction: run up
    // user r9w: wall-zip burst — straight up at the zip speed (flight pose only, no run legs); when it ends, forward +
    // Shift still held carries straight on into the wall run, otherwise the momentum bleeds off into the cling
    let zv = 0;
    if (s.sub === "wallZip") {
      // user r9z: input-proof for the whole pull (fast / mx / my overridden below)
      W.zipT += h;
      const u = clamp(W.zipT / WZIP.dur, 0, 1);
      zv = WZIP.v0 + (WZIP.v1 - WZIP.v0) * u * u * (3 - 2 * u);
      mx = 0;
      my = 1;
      if (W.zipWeb && u >= WZIP.snap) {
        W.zipWeb = false;
        web.releaseSnap ? web.releaseSnap(0.3) : web.release();
      }
      if (u >= 1) {
        const go = I.sprint && I.move.y > 0.2;
        W.runV = go ? WALLRUN * 1.1 : 3;
        setSub(go ? "wallRun" : "crawl");
      }
    }
    W.move.set(mx, my);
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const vx = (fast ? WALLRUN : 4.2) * mx,
      vyIn = (fast ? WALLRUN : 4.2) * my; // user r9r: faster wall run (animation unchanged)
    W.runV = damp(
      W.runV,
      0,
      fast && my > 0.2 ? 0.4 : Math.hypot(mx, my) < 0.2 ? 9 : 3,
      h,
    ); // no input: stop and cling (~0.2 s)
    if (s.sub === "wallZip") W.runV = zv;
    if (s.sub === "wallZip") fast = true; // user r9z
    const vy = zv || Math.max(vyIn, my >= -0.1 ? W.runV : -Infinity);
    s.vel.copy(right).multiplyScalar(vx).addScaledVector(UP, vy);
    W.fast = fast && Math.abs(vx) + Math.abs(vy) > 5;
    W.phase += (s.vel.length() * h) / (W.fast ? 2.6 : 1.2);
    const sub = W.fast
      ? Math.abs(vy) >= Math.abs(vx)
        ? "wallRun"
        : "wallRunSide"
      : "crawl";
    if (s.sub !== "wallZip" && (s.sub !== "cornerWrap" || s.subT > 0.3))
      setSub(sub);
    if (s.vel.lengthSq() > 0.04)
      W.up.lerp(_v.copy(s.vel).normalize(), 1 - Math.exp(-8 * h)).normalize();
    else W.up.lerp(UP, 1 - Math.exp(-4 * h)).normalize();
    if (W.up.y < -0.2) W.up.lerp(UP, 0.5).normalize();
    if (I.jumpPressed) {
      // wall jump
      s.vel
        .copy(n)
        .multiplyScalar(8.5)
        .addScaledVector(UP, fast ? 11 : 9.5)
        .addScaledVector(right, mx * 4);
      setMode("air", "wallJump");
      s.airT = 0;
      s.apexY = feetY();
      s.wallCooldown = 0.35;
      s.swingCooldown = 0.18;
      s.facing = Math.atan2(s.vel.x, s.vel.z);
      events.push({ type: "wallJump" });
      return;
    }
    if (I.swingPressed) {
      // RMB on a wall: kick off it and swing away (search starts right after the push-off)
      s.vel
        .copy(n)
        .multiplyScalar(9)
        .addScaledVector(UP, 7)
        .addScaledVector(
          cam.forwardFlat(_v2).addScaledVector(n, -_v2.dot(n)),
          6,
        );
      setMode("air", "wallJump");
      s.airT = 0;
      s.apexY = feetY();
      s.wallCooldown = 0.5;
      s.swingCooldown = 0.1;
      s.groundSwing = true;
      s.facing = Math.atan2(s.vel.x, s.vel.z);
      events.push({ type: "wallJump" });
      return;
    }
    if (I.dropPressed) {
      s.vel.copy(n).multiplyScalar(3);
      setMode("air", "fall");
      s.airT = 0;
      s.apexY = feetY();
      s.wallCooldown = 0.5;
      return;
    }
    const prev = _v5.copy(s.pos);
    s.pos.addScaledVector(s.vel, h);
    // inner corner: wall ahead in the sideways direction
    if (Math.abs(vx) > 0.5) {
      const side = _v2.copy(right).multiplyScalar(Math.sign(vx));
      const hit = world.raycast(s.pos, side, R + 0.25);
      if (
        hit &&
        Math.abs(hit.normal.y) < 0.5 &&
        hit.normal.dot(side) < -0.7 &&
        deepSide(n, side)
      ) {
        // (user r-wallrun) fins / bars: run over
        const n1 = hit.normal.clone().setY(0).normalize();
        startCornerWrap(
          n1,
          hit.point
            .clone()
            .addScaledVector(n1, R + 0.02)
            .setY(s.pos.y),
          0.22,
          n.clone(),
          Math.sign(vx),
        );
        return;
      }
    }
    // wall top ahead (user r6): as soon as the top of the wall in the climb path — railing, parapet or roof lip — is at
    // chest height, pop straight up until the feet clear it, then hop forward onto the roof (no ledge grab)
    if (vyIn + W.runV > 0.5 || vy > 0.5) {
      const o = _v.copy(s.pos).addScaledVector(n, -(R + 0.25));
      o.y = feetY() + 2.4;
      const top = world.raycast(o, _v2.set(0, -1, 0), 2.4);
      if (
        top &&
        top.normal.y > 0.5 &&
        top.point.y - feetY() < 1.35 &&
        realTop(n, top.point.y)
      ) {
        if (startWallHop(n.clone(), fast || W.fast)) return;
      }
    }
    // stay attached: probe the wall at chest and knee height
    const probe = (oy) =>
      world.raycast(
        _v.copy(s.pos).setY(s.pos.y + oy),
        _v2.copy(n).negate(),
        R + 0.9 + W.off,
      );
    let hit = probe(0.35);
    if (!hit || Math.abs(hit.normal.y) > 0.5) hit = probe(-0.5);
    if (hit && Math.abs(hit.normal.y) < 0.5) {
      const nn = _v3.copy(hit.normal).setY(0).normalize();
      if (nn.dot(n) < 0.98) n.copy(nn);
      // effective wall plane = the most protruding surface over the whole body/stride extent (sills, cornices, piers):
      // limbs planted on the wall must never sink into a protrusion the chest probe missed (user feedback #5)
      const bx = hit.point.x,
        bz = hit.point.z;
      // (user r-wallrun) look ahead along the run (sideways / up / diagonal) so fins, bars, piers, sills and cornices up
      // to 1 m deep are run OVER (the surface lifts before he reaches them) instead of wrapped round or stopping him
      const prot = Math.min(
        2.2,
        wallProtrusion(n, bx, bz, right, true, vx, vy),
      );
      W.off =
        prot > W.off ? Math.min(prot, W.off + 16 * h) : damp(W.off, prot, 8, h);
      const off = R + 0.02 + W.off;
      s.pos.x = bx + n.x * off;
      s.pos.z = bz + n.z * off;
      W.point.set(bx + n.x * W.off, s.pos.y, bz + n.z * W.off);
      W.dist = R + 0.02;
    } else if (setbackStep(n, vy)) {
      // (user r-wallrun) terrace / setback ledge (the facade steps back <= 2.2 m and carries on up): stepped over
    } else {
      // outer corner: wrap around it (checked first when moving sideways — a side run must carry round the corner)
      if (Math.abs(vx) > 0.5 && Math.abs(vx) >= Math.abs(vy)) {
        const side = _v2.copy(right).multiplyScalar(Math.sign(vx));
        const o = _v
          .copy(prev)
          .addScaledVector(side, R + 0.8)
          .addScaledVector(n, -(R + 0.8));
        const hit2 = world.raycast(o, _v3.copy(side).negate(), 2);
        if (hit2 && hit2.normal.dot(side) > 0.7) {
          const n1 = hit2.normal.clone().setY(0).normalize();
          startCornerWrap(
            n1,
            hit2.point
              .clone()
              .addScaledVector(n1, R + 0.02)
              .setY(prev.y),
            0.3,
            n.clone().negate(),
            Math.sign(vx),
          );
          return;
        }
      }
      // top of the wall: vault / mantle onto the roof
      if (vy > -0.5) {
        const o = _v.copy(prev).addScaledVector(n, -(R + 0.7));
        o.y += 2.4;
        const top = world.raycast(o, _v2.set(0, -1, 0), 5.5);
        if (
          top &&
          top.normal.y > 0.5 &&
          realTop(n, top.point.y) &&
          startWallHop(n.clone(), fast || W.fast)
        )
          return;
      }
      if (s.sub === "wallZip" && s.zip.target.y > s.pos.y + 0.5) return; // user r9z: a recess mid-pull (window, setback) never drops him off / back into a run
      // outer corner: wrap around it
      if (Math.abs(vx) > 0.5) {
        const side = _v2.copy(right).multiplyScalar(Math.sign(vx));
        const o = _v
          .copy(prev)
          .addScaledVector(side, R + 0.8)
          .addScaledVector(n, -(R + 0.8));
        const hit2 = world.raycast(o, _v3.copy(side).negate(), 2);
        if (hit2 && hit2.normal.dot(side) > 0.7) {
          startCornerWrap(
            side.clone(),
            hit2.point
              .clone()
              .addScaledVector(side, R + 0.02)
              .setY(prev.y),
            0.3,
            n.clone().negate(),
            Math.sign(vx),
          );
          return;
        }
      }
      s.vel
        .copy(n)
        .multiplyScalar(2)
        .addScaledVector(UP, Math.max(0, vy) * 0.5);
      setMode("air", "fall");
      s.airT = 0;
      s.apexY = feetY();
      s.wallCooldown = 0.3;
      return;
    }
    // Wall traversal follows facade raycasts, so it does not get the capsule push-out used by ground / air movement.
    // Resolve against the shared city solids after attaching to the surface; trunks and railings are otherwise crossed
    // when they are invisible to the wall-raycast path (BLOCKONLY) or their thin geometry is missed by the probes.
    const obstacle = collide(0.3);
    if (obstacle) {
      const into = s.vel.dot(obstacle.normal);
      if (into < 0) s.vel.addScaledVector(obstacle.normal, -into);
      s.vel.addScaledVector(
        obstacle.normal,
        Math.max(1.5, s.vel.length() * 0.12),
      );
      setMode("air", "fall");
      s.airT = 0;
      s.apexY = feetY();
      s.wallCooldown = 0.35;
      return;
    }
    // bottom: step off onto the street
    const gf = floorAt(s.pos.x + n.x * 0.6, s.pos.z + n.z * 0.6, feetY() + 0.3);
    if (feetY() <= gf + 0.02 && vy <= 0) {
      s.pos.y = gf + H;
      s.pos.x += n.x * 0.15;
      s.pos.z += n.z * 0.15;
      s.vel.set(0, 0, 0);
      s.facing = Math.atan2(n.x, n.z);
      enterGround("idle");
      s.wallCooldown = 0.5;
      return;
    }
  }
  // user r9w: E while running up / clinging to a wall: short zip up the facade (burst in stepWall, sub 'wallZip')
  function wallZip() {
    const W = s.wall,
      n = W.normal;
    const tgt = s.pos.clone().addScaledVector(n, -(R + 0.02 + (W.off || 0)));
    tgt.y += WZIP.reach; // web anchor on the facade above
    // user r9z: highest facade point up to `reach` (step up the wall; stop 0.5 m under its top)
    let top = -1;
    for (let dy = 2; dy <= WZIP.reach; dy += 2) {
      const hit = world.raycast(
        _v.copy(s.pos).setY(s.pos.y + dy),
        _v2.copy(n).negate(),
        R + 2.5,
      );
      if (hit && Math.abs(hit.normal.y) < 0.5) {
        top = dy;
        tgt.copy(hit.point);
      } else if (top > 0) break;
    }
    if (top > 0 && top < WZIP.reach) tgt.y -= 0.5;
    s.zip.target.copy(tgt);
    W.zipT = 0;
    W.zipWeb = true;
    W.lockDir = null;
    // user r9z: two webs, one per hand (side by side on the wall), no splat decal
    const side = _v3.set(-n.z, 0, n.x).multiplyScalar(0.35);
    web.attach(rig.handWorld("R"), tgt.clone().sub(side), n.clone(), {
      noDecal: true,
    });
    web.attachSecond?.(
      rig.handWorld("L", new THREE.Vector3()),
      tgt.clone().add(side),
      n.clone(),
      { noDecal: true },
    );
    setSub("wallZip");
    s.facing = Math.atan2(-n.x, -n.z);
    s.zipCooldown = WZIP.cd;
    events.push({ type: "wallZip" });
  }
  // how far (m, >= 0) any wall surface within the body's extent sticks out past the base wall point (bx, bz)
  const PROBE_Y = [-0.88, -0.45, 0.05, 0.5, 0.85],
    PROBE_X = [-0.45, 0.45];
  function wallProtrusion(n, bx, bz, right, side, vx = 0, vy = 0) {
    let best = 0;
    const dn = _v2.copy(n).negate();
    const test = (ox, oy) => {
      const o = _v.set(
        bx + n.x * 1.15 + right.x * ox,
        s.pos.y + oy,
        bz + n.z * 1.15 + right.z * ox,
      );
      const hit = world.raycast(o, dn, 2.0);
      if (!hit || Math.abs(hit.normal.y) > 0.6) return;
      const d = (hit.point.x - bx) * n.x + (hit.point.z - bz) * n.z;
      if (d > best && d < 2.2) best = d;
    };
    for (const oy of PROBE_Y) test(0, oy);
    if (side)
      for (const ox of PROBE_X) for (const oy of [-0.6, 0.3]) test(ox, oy);
    // (user r-wallrun) look-ahead along the travel direction (lead grows with speed: ~0.15 s ahead + half a body)
    const sp = Math.hypot(vx, vy);
    if (side && sp > 1) {
      const lead = 0.4 + sp * 0.15,
        ux = vx / sp,
        uy = vy / sp;
      for (const f of [0.35, 0.7, 1])
        for (const o of [-0.5, 0, 0.5])
          test(ux * lead * f - uy * o * 0.4, uy * lead * f + ux * o * 0.9);
    }
    return best;
  }
  // dir1 = travel direction along the new face, mx = the lateral key held (for the direction lock).
  // A fast side run (user r9) wraps at running speed and keeps the run cycle (sub stays wallRunSide): seamless.
  function startCornerWrap(n1, p1, dur, dir1, mx) {
    const W = s.wall,
      run = W.fast && (s.sub === "wallRunSide" || s.sub === "wallRun"); // (user r-wallrun) any running direction wraps at speed (a diagonal run was dropped into the cling wrap)
    const mid = s.pos
      .clone()
      .lerp(p1, 0.5)
      .addScaledVector(W.normal, 0.35)
      .addScaledVector(n1, 0.35);
    const sp = s.vel.length();
    if (run)
      dur = clamp(
        (s.pos.distanceTo(mid) + mid.distanceTo(p1)) / Math.max(sp, 6),
        0.1,
        0.3,
      );
    const vy = run ? s.vel.y : 0; // (user r-wallrun) a diagonal run keeps climbing through the wrap
    if (vy) {
      mid.y += vy * dur * 0.5;
      p1 = p1.clone();
      p1.y += vy * dur;
    }
    s.kin = {
      type: "cornerWrap",
      t: 0,
      dur,
      p0: s.pos.clone(),
      p1: mid,
      p2: p1,
      n0: W.normal.clone(),
      n1,
      run,
      sp,
      dir1,
      sub: s.sub,
    };
    if (dir1 && mx) {
      W.lockDir = dir1.clone();
      W.lockMx = mx;
    }
    if (!run) setSub("cornerWrap");
    events.push({ type: "cornerWrap", run });
  }
  // Ledge vault at a wall top (user r4 #18): ledgeGrab (0.27 s: hands on the lip, body hangs with feet 1.95 m under
  // the lip, 0.30 m off the wall) -> ledgeClimbFlip (1.0 s, fast / from a wall-run) or ledgeClimbQuick (0.5 s, slow
  // crawl). The capsule follows the clips' root displacement: +1.95 m up, +0.70 m (flip) / +0.62 m (quick) inward from
  // the hang origin, then he stands on the roof. anim.ledge = {point, inward, variant, t, phase}.
  const LEDGE = { grab: 0.27, flip: 1.0, quick: 0.5 };
  function startLedgeClimb(top, n, fast) {
    const inward = new THREE.Vector3(-n.x, 0, -n.z).normalize();
    const lip = new THREE.Vector3(
      s.pos.x - n.x * s.wall.dist,
      top.y,
      s.pos.z - n.z * s.wall.dist,
    ); // wall plane at the lip
    const variant = fast ? "flip" : "quick";
    const hang = lip.clone().addScaledVector(n, 0.3);
    hang.y = top.y - 1.95 + H; // capsule centre while hanging
    const end = lip
      .clone()
      .addScaledVector(n, 0.3)
      .addScaledVector(inward, variant === "flip" ? 0.7 : 0.62);
    end.y = top.y + H;
    s.kin = {
      type: "ledge",
      t: 0,
      variant,
      grab: LEDGE.grab,
      climb: LEDGE[variant],
      p0: s.pos.clone(),
      hang,
      end,
      lip,
      inward,
      floor: top.y,
      fromWall: true,
      exitVel: inward.clone().multiplyScalar(fast ? 5 : 0),
    };
    s.facing = Math.atan2(inward.x, inward.z);
    setMode("wall", "ledgeGrab");
    s.vel.set(0, 0, 0);
    events.push({ type: "ledgeGrab", variant });
  }
  function stepLedge(h) {
    const k = s.kin;
    k.t += h;
    const prev = _v5.copy(s.pos);
    if (k.t < k.grab) {
      // reach + grab: ease onto the hang point
      const u = k.t / k.grab,
        e = u * u * (3 - 2 * u);
      s.pos.copy(k.p0).lerp(k.hang, e);
    } else {
      if (s.sub !== "ledgeClimb") setSub("ledgeClimb");
      const u = Math.min(1, (k.t - k.grab) / k.climb);
      // vertical leads (pull-up / flip rises early), inward follows (over the lip in the second half)
      const ey = 1 - Math.pow(1 - u, 2.2),
        eh = u * u * (3 - 2 * u);
      s.pos.set(
        k.hang.x + (k.end.x - k.hang.x) * eh,
        k.hang.y + (k.end.y - k.hang.y) * ey,
        k.hang.z + (k.end.z - k.hang.z) * eh,
      );
      if (u >= 1) {
        s.kin = null;
        s.floorY = floorAt(s.pos.x, s.pos.z, k.floor + 0.3);
        s.pos.y = s.floorY + H;
        s.vel.copy(k.exitVel);
        s.speed = k.exitVel.length();
        enterGround(s.speed > 1 ? "run" : "idle");
        s.speed = k.exitVel.length();
        s.wallCooldown = 0.35;
        return;
      }
    }
    s.vel.copy(s.pos).sub(prev).divideScalar(Math.max(h, 1e-4));
  }
  // Wall-top hop (user r6, replaces the ledge grab / flip): scan the first ~2.7 m past the wall plane for the tallest
  // thing in the way (railing, parapet, lip, rooftop kerb), pop straight up until the feet clear it, then a short
  // forward jump that lands on the roof beyond it. Pure ballistic curve (one continuous parabola), so it reads as
  // "move up and jump forward" and never passes through a railing: the forward part only starts once the feet are
  // above the obstacle, and the apex is raised until the arc clears the railing at the moment it crosses it.
  function startWallHop(n, fast) {
    const W = s.wall,
      inward = _v4.set(-n.x, 0, -n.z).normalize().clone();
    // user r9: from a vertical wall RUN the hop is part of the run — keep the upward speed, keep the run cycle going
    // up past the lip, then carry straight on over the top onto the roof at running speed (no launch / landing poses)
    const run =
      s.mode === "wall" &&
      ((s.sub === "wallRun" && W.fast) || s.sub === "wallZip"); // user r9w: a wall zip past the top launches like the run
    const vy0 = run ? Math.max(0, s.vel.y) : 0;
    // user r9b (refs: running-leap off the wall top): a vertical wall RUN reaching the top launches him into the air —
    // the wall-run speed carries straight up (plus a little drift over the roof) and from there it is ordinary air
    // gameplay (swing / zip / dive / land wherever he comes down). No scripted hop.
    if (run) {
      const vUp = clamp(Math.max(vy0, 12), 12, 15);
      s.vel.copy(inward).multiplyScalar(2.6).addScaledVector(UP, vUp);
      s.facing = Math.atan2(inward.x, inward.z);
      setMode("air", "jumpLaunch");
      s.airT = 0;
      s.apexY = feetY();
      s.grounded = false;
      s.jumpCharge = 1;
      s.wallCooldown = 0.9;
      s.swingCooldown = 0.15;
      s.kin = null;
      events.push({ type: "wallLaunch" });
      events.push({ type: "jump", charge: 1 });
      return true;
    }
    const wallDist = R + 0.02 + (W.off || 0); // body centre -> wall plane
    const f0 = feetY();
    const D = [0.08, 0.25, 0.45, 0.7, 1.0, 1.35, 1.75, 2.2, 2.7];
    const prof = [];
    for (const d of D) {
      const o = _v.copy(s.pos).addScaledVector(inward, wallDist + d);
      o.y = f0 + 6;
      const hit = world.raycast(o, _v2.set(0, -1, 0), 14);
      prof.push(hit && hit.normal.y > 0.3 ? hit.point.y : -Infinity);
    }
    const far = prof.slice(3).filter((y) => y > -Infinity);
    if (!far.length) return false; // nothing to land on
    const floor = Math.min(...far); // roof surface
    if (floor < f0 - 3) return false; // it's not a roof, it's a drop (thin wall / sign)
    let obstD = -1,
      obstTop = floor;
    prof.forEach((y, i) => {
      if (y > floor + 0.2 && D[i] < 1.6) {
        obstD = D[i];
        if (y > obstTop) obstTop = y;
      }
    });
    const landD = Math.max(1.25, obstD + 0.95);
    const land = s.pos.clone().addScaledVector(inward, wallDist + landD);
    const landTop = floorAt(land.x, land.z, Math.max(obstTop, floor) + 0.3);
    if (!(landTop > f0 - 3)) return false;
    // clear the tallest obstacle by 0.45 m at the apex, then check the arc at the crossing point and raise if needed
    let apex = Math.max(obstTop, landTop) + 0.45;
    apex = Math.max(apex, f0 + 0.35);
    const Dtot = wallDist + landD;
    let tA = 0,
      tB = 0,
      v = 0;
    for (let k = 0; k < 4; k++) {
      tA = Math.sqrt((2 * (apex - f0)) / G);
      tB = Math.max(0.28, Math.sqrt((2 * Math.max(0.05, apex - landTop)) / G));
      v = Dtot / tB;
      if (obstD < 0) break;
      const tc = (wallDist + obstD + R) / v,
        drop = 0.5 * G * tc * tc;
      if (apex - drop >= obstTop + 0.1) break;
      apex = obstTop + 0.1 + drop + 0.05;
    }
    s.kin = {
      type: "wallHop",
      t: 0,
      tA,
      tB,
      f0,
      apex,
      landTop,
      p0: s.pos.clone(),
      inward,
      Dtot,
      fast,
      exitSpeed: fast ? 5.5 : 1.8,
    };
    s.facing = Math.atan2(inward.x, inward.z);
    setMode("air", "jumpLaunch");
    s.airT = 0;
    s.apexY = apex;
    s.grounded = false;
    s.wallCooldown = 0.6;
    s.swingCooldown = 0.25;
    s.jumpCharge = fast ? 0.35 : 0.1;
    events.push({ type: "wallHop", fast });
    return true;
  }
  function stepWallHop(h) {
    const k = s.kin;
    k.t += h;
    const prev = _v5.copy(s.pos);
    let fy, d;
    if (k.t <= k.tA) {
      // rising straight up along the wall (decelerating), no inward motion yet
      const vy0 = G * k.tA,
        t = k.t;
      fy = k.f0 + vy0 * t - 0.5 * G * t * t;
      d = 0;
      if (s.sub !== "jumpLaunch" && k.t < 0.12) setSub("jumpLaunch");
      else if (k.t >= 0.12) setSub("rise");
    } else {
      // over the top and forward onto the roof
      const t = Math.min(k.t - k.tA, k.tB);
      fy = k.apex - 0.5 * G * t * t;
      d = k.Dtot * (t / k.tB);
      setSub(t < 0.12 ? "apex" : "fall");
      if (k.t - k.tA >= k.tB || fy <= k.landTop) {
        s.kin = null;
        s.pos.copy(k.p0).addScaledVector(k.inward, k.Dtot);
        s.floorY = floorAt(s.pos.x, s.pos.z, k.landTop + 0.3);
        s.pos.y = s.floorY + H;
        s.vel.copy(k.inward).multiplyScalar(k.exitSpeed);
        s.facing = Math.atan2(k.inward.x, k.inward.z);
        enterGround("landLight");
        s.speed = k.exitSpeed;
        s.landing.severity = 0.15;
        s.landing.lock = 0;
        s.wallCooldown = 0.4;
        events.push({ type: "land", severity: 0.15 });
        return;
      }
    }
    s.pos.set(k.p0.x + k.inward.x * d, fy + H, k.p0.z + k.inward.z * d);
    s.vel.copy(s.pos).sub(prev).divideScalar(Math.max(h, 1e-4));
  }
  function startRoofVault(top, n, fast) {
    return startLedgeClimb(top, n, fast);
  }
  function startRoofVaultLegacy(top, n, fast) {
    const inward = n.clone().negate();
    const land = top.clone().addScaledVector(inward, 0.9);
    land.y = top.y + H;
    const p0 = s.pos.clone(),
      ctrl = p0.clone().lerp(land, 0.35);
    ctrl.y = Math.max(p0.y, land.y) + 1.0;
    s.kin = {
      type: "vault",
      t: 0,
      dur: fast ? 0.34 : 0.48,
      p0,
      p1: ctrl,
      p2: land,
      exitVel: inward.multiplyScalar(fast ? 11 : 3.5),
      floor: top.y,
      fromWall: true,
    };
    s.facing = Math.atan2(-n.x, -n.z);
    setMode("ground", "vault");
    events.push({ type: "vault" });
  }
  function startVault(c, fast) {
    // ground mantle over a low obstacle / parapet
    const n = c.normal;
    const top = c.top;
    const inward = n.clone().negate();
    // land on top if it's deep enough, otherwise clear it
    const onTop = floorAt(s.pos.x - n.x * 1.3, s.pos.z - n.z * 1.3, top + 0.05);
    const land = s.pos.clone().addScaledVector(inward, 1.3 + R);
    const beyond = floorAt(land.x, land.z, top + 0.05);
    if (Math.abs(onTop - top) > 0.1 && beyond < top - 2.2) {
      // roof edge / parapet with a drop behind it: parkour leap over it
      const sp = Math.max(Math.hypot(s.vel.x, s.vel.z), 8);
      s.pos.y = Math.max(s.pos.y, top + 0.15 + H);
      s.vel.copy(inward).multiplyScalar(sp).addScaledVector(UP, 6.5);
      s.facing = Math.atan2(inward.x, inward.z);
      setMode("air", "vault");
      s.airT = 0;
      s.apexY = feetY();
      s.swingCooldown = 0.1;
      events.push({ type: "vault" });
      return;
    }
    land.y = (Math.abs(onTop - top) < 0.1 ? top : beyond) + H;
    const p0 = s.pos.clone(),
      ctrl = p0.clone().lerp(land, 0.5);
    ctrl.y = top + H + 0.5;
    const sp = Math.max(Math.hypot(s.vel.x, s.vel.z), fast ? 10 : 4);
    s.kin = {
      type: "vault",
      t: 0,
      dur: clamp(1.6 / sp, 0.22, 0.42),
      p0,
      p1: ctrl,
      p2: land,
      exitVel: inward.multiplyScalar(sp * 0.9),
      floor: land.y - H,
    };
    s.facing = Math.atan2(-n.x, -n.z);
    setMode("ground", "vault");
    events.push({ type: "vault" });
  }
  function stepKin(h) {
    const k = s.kin;
    k.t += h / k.dur;
    const u = Math.min(1, k.t);
    const e = k.type === "zip" ? zipEase(u) : u * u * (3 - 2 * u);
    const a = 1 - e;
    s.pos
      .set(0, 0, 0)
      .addScaledVector(k.p0, a * a)
      .addScaledVector(k.p1, 2 * a * e)
      .addScaledVector(k.p2, e * e);
    if (k.type === "cornerWrap") {
      s.wall.normal.copy(k.n0).lerp(k.n1, e).normalize();
      // velocity along the wrap path (the animator heads the run along it)
      const pv = _v5
        .set(0, 0, 0)
        .addScaledVector(k.p1, 2 * a)
        .addScaledVector(k.p0, -2 * a)
        .addScaledVector(k.p2, 2 * e)
        .addScaledVector(k.p1, -2 * e);
      if (pv.lengthSq() > 1e-6)
        s.vel.copy(pv.normalize()).multiplyScalar(k.run ? k.sp : 2);
    }
    if (u >= 1) {
      s.kin = null;
      if (k.type === "cornerWrap") {
        s.wall.normal.copy(k.n1);
        if (k.run && k.dir1) {
          s.vel.copy(k.dir1).multiplyScalar(k.sp);
          setSub(k.sub === "wallRun" ? "wallRun" : "wallRunSide");
        } else setSub("crawl");
      } else if (k.type === "vault") {
        s.floorY = floorAt(s.pos.x, s.pos.z, feetY() + 0.3);
        s.pos.y = s.floorY + H;
        s.speed = k.exitVel.length();
        s.vel.copy(k.exitVel);
        if (s.speed > 0.1) s.facing = Math.atan2(k.exitVel.x, k.exitVel.z);
        enterGround(
          s.speed > RUN + 1.5 ? "sprint" : s.speed > 1 ? "run" : "idle",
        );
        s.speed = k.exitVel.length();
        s.wallCooldown = 0.35;
      } else if (k.type === "zip") arriveZip();
    }
  }

  // ------------------------------------------------------------------ zip / perch / point launch
  // Insomniac web-zip (USER_FEEDBACK #8): zipFire (both arms snap forward, TWO webs shoot to the target, one per hand)
  // -> zipYank (arms pull back sharply, webs taut / stretching: elastic load ~0.15 s, body coils)
  // -> zipFlight (slingshot: the whole body is catapulted along an arc toward the target, max speed at launch then
  //    decelerating; streamlined along the flight path; the webs snap off the hands and fade at ~30% of the flight)
  // -> zipCatch (last ~28%: body rotates upright, feet swing forward to catch the perch) -> perch/perchLand.
  const ZIP_EXP = 1.8; // flight ease: e(u) = 1 - (1-u)^ZIP_EXP (fast launch, soft catch)
  // user r10: web-zip is INSTANT — both webs fire in the same frame and he rockets off at once (no hop, no yank/hold):
  // zipFire (~0.05 s: arms snap, lines reach the target) -> zipFlight (burst ramp to a 40-72 m/s peak, webs pull him for
  // the first ~25% then snap off) -> braking -> zipCatch -> perch. (zipYank is no longer entered.)
  const ZIP_BRAKE = 200,
    ZIP_VEND = 5,
    ZIP_RAMP = 0.07; // flight: burst ramp (s), braking decel (m/s^2), arrival speed (user r9x: brake 240 -> 200)
  const ZIP_SPEED = 0.83; // user r9x: zip a bit slower (~17%): scales the peak speed, same profile
  const zipEase = (u) => 1 - Math.pow(1 - u, ZIP_EXP);
  const zipOff = new THREE.Vector3();
  function startZip(t) {
    const Z = s.zip;
    Z.target.copy(t.pos);
    Z.normal.copy(t.normal);
    Z.kind = t.kind;
    Z.launch = false;
    Z.dash = false;
    Z.webs = true;
    Z.taut = 0;
    Z.t = 0;
    Z.u = 0;
    const horiz = Math.hypot(t.normal.x, t.normal.z) > 0.3;
    // perch stance: feet on the edge (slightly inboard), facing outward
    const end = t.pos.clone();
    if (horiz)
      end.addScaledVector(_v.set(t.normal.x, 0, t.normal.z).normalize(), -0.12);
    end.y += H;
    Z.p2.copy(end);
    const dist = s.pos.distanceTo(end);
    // two anchors a hand-span apart across the line of fire, converging on the target
    const los = _v2.copy(t.pos).sub(s.pos).normalize();
    zipOff.crossVectors(los, UP);
    if (zipOff.lengthSq() < 1e-4) zipOff.set(1, 0, 0);
    zipOff.normalize().multiplyScalar(0.09);
    const nrm = horiz ? t.normal : UP;
    const aR = t.pos.clone().addScaledVector(t.normal, 0.05).sub(zipOff),
      aL = t.pos.clone().addScaledVector(t.normal, 0.05).add(zipOff);
    Z.anchorR = aR;
    Z.anchorL = aL;
    const shoot = clamp(dist / 900, 0.03, 0.05); // near-instant lines (user r10)
    web.attach(rig.handWorld("R"), aR, nrm, { shootDur: shoot, noDecal: true }); // user r9x: no circular web patch left at the perch
    web.attachSecond?.(rig.handWorld("L"), aL, nrm, {
      shootDur: shoot + 0.015,
      noDecal: true,
    });
    Z.fromGround = s.grounded;
    // from the air the webs fire and load WHILE he keeps flying (momentum carries through the whole sequence)
    Z.fireDur = shoot + 0.015;
    Z.yankDur = 0;
    s.facing = Math.atan2(end.x - s.pos.x, end.z - s.pos.z);
    setMode("zip", "zipFire");
    s.charging = false;
    s.dive = false;
    s.trick = null;
    s.gliding = false;
    if (Z.fromGround) s.vel.multiplyScalar(0.35);
    events.push({ type: "zip" });
  }
  function zipCurve(Z, vel) {
    // arc from the launch point: rises over, then drops onto the perch from above / outside
    const p0 = Z.p0,
      end = Z.p2,
      dist = p0.distanceTo(end);
    // final approach roughly LEVEL into the perch (no rise-over-and-drop-onto-it): the control point sits just above
    // the perch height, so the last part of the curve arrives nearly horizontal
    Z.p1.copy(p0).lerp(end, 0.62);
    Z.p1.y = end.y + 0.4 + (p0.y > end.y ? 0 : dist * 0.03);
    const hn = _v.set(Z.normal.x, 0, Z.normal.z);
    if (hn.lengthSq() > 0.09)
      Z.p1.addScaledVector(hn.normalize(), Math.min(3, dist * 0.08)); // approach from outside the edge
    // air zip: the arc leaves along the current momentum (no kink / stop), bending onto the target
    const sp = vel.length();
    if (sp > 4) {
      const vd = _v2.copy(vel).divideScalar(sp),
        toT = _v3.copy(end).sub(p0).normalize();
      if (vd.dot(toT) > -0.2)
        Z.p1.lerp(
          _v4.copy(p0).addScaledVector(vd, dist * 0.5),
          clamp(sp / 30, 0, 0.55),
        );
    }
    // the whole flight curve must be clear of facades (no hugging / clipping walls): raise the arc and move its
    // control point out over the street until every segment is free (last segment into the perch is exempt)
    for (let it = 0; it < 5 && !zipClear(Z); it++) {
      Z.p1.y += 2.5 + dist * 0.05;
      const out = _v.set(Z.normal.x, 0, Z.normal.z);
      if (out.lengthSq() < 0.09) out.copy(p0).sub(end).setY(0);
      if (out.lengthSq() > 1e-4) Z.p1.addScaledVector(out.normalize(), 1.5);
    }
    // speed profile (user r10: release burst, much faster): arc-length LUT of the curve, then distance(time) =
    // short burst ramp (ZIP_RAMP) up to the peak speed -> cruise at the peak -> constant braking (ZIP_BRAKE) to ZIP_VEND
    // exactly at the perch. Peak ~40-72 m/s by distance (was a Hermite ease peaking ~22-43 m/s).
    const LUT = Z.lut || (Z.lut = new Float32Array(33)),
      q = _v4.copy(p0),
      b = _v5;
    LUT[0] = 0;
    for (let k = 1; k <= 32; k++) {
      bez(Z, k / 32, b);
      LUT[k] = LUT[k - 1] + b.distanceTo(q);
      q.copy(b);
    }
    const L = LUT[32];
    Z.len = L;
    const v0 = clamp(vel.dot(_v2.copy(Z.p1).sub(p0).normalize()), 0, 20);
    let vP = clamp(22 + L * 2.4, 40, 72) * ZIP_SPEED;
    for (let it = 0; it < 12; it++) {
      // shrink the peak until ramp + braking fit inside the path
      const dR = ((v0 + vP) / 2) * ZIP_RAMP,
        dB = (vP * vP - ZIP_VEND * ZIP_VEND) / (2 * ZIP_BRAKE);
      if (dR + dB <= L * 0.92 || vP <= 12) break;
      vP *= 0.88;
    }
    const dR = ((v0 + vP) / 2) * ZIP_RAMP,
      dB = Math.max(0, (vP * vP - ZIP_VEND * ZIP_VEND) / (2 * ZIP_BRAKE));
    const dC = Math.max(0, L - dR - dB);
    Z.v0 = v0;
    Z.vP = vP;
    Z.dR = dR;
    Z.dC = dC;
    Z.dB = L - dR - dC;
    Z.tC = ZIP_RAMP + dC / vP;
    Z.tBrake = Z.tC;
    // braking time from the braking distance actually left (keeps d(dur) == L even when the fit was clamped)
    const vE = Math.sqrt(Math.max(0, vP * vP - 2 * ZIP_BRAKE * Z.dB)),
      aB = Z.dB > 1e-3 ? (vP * vP - vE * vE) / (2 * Z.dB) : ZIP_BRAKE;
    Z.aB = aB;
    Z.dur = Z.tC + (vP - vE) / Math.max(aB, 1e-3);
  }
  // distance along the flight after tau seconds (burst ramp -> cruise -> braking), clamped to the path length
  function zipDist(Z, tau) {
    if (tau <= ZIP_RAMP)
      return Z.v0 * tau + (((Z.vP - Z.v0) / ZIP_RAMP) * tau * tau) / 2;
    if (tau <= Z.tC) return Z.dR + Z.vP * (tau - ZIP_RAMP);
    const tb = Math.min(tau, Z.dur) - Z.tC;
    return Math.min(Z.len, Z.dR + Z.dC + Z.vP * tb - (Z.aB * tb * tb) / 2);
  }
  // arc length -> bezier parameter (LUT inversion)
  function zipArcE(Z, d) {
    const T = Z.lut;
    if (d >= T[32]) return 1;
    if (d <= 0) return 0;
    let k = 1;
    while (k < 32 && T[k] < d) k++;
    return (k - 1 + (d - T[k - 1]) / Math.max(1e-6, T[k] - T[k - 1])) / 32;
  }
  function zipClear(Z) {
    const a = _v4.copy(Z.p0),
      b = new THREE.Vector3(),
      d = new THREE.Vector3();
    for (let k = 1; k <= 10; k++) {
      bez(Z, k / 10, b);
      if (k === 10) break;
      d.copy(b).sub(a);
      const L = d.length();
      if (L > 1e-3) {
        d.divideScalar(L);
        const hh = world.raycast(a, d, L + 0.4);
        if (hh && hh.point.distanceTo(Z.p2) > 1.6) return false;
      }
      a.copy(b);
    }
    return true;
  }
  const bez = (Z, e, out) => {
    const a = 1 - e;
    return out
      .set(0, 0, 0)
      .addScaledVector(Z.p0, a * a)
      .addScaledVector(Z.p1, 2 * a * e)
      .addScaledVector(Z.p2, e * e);
  };
  function stepZip(h, I) {
    const Z = s.zip;
    // user r4 #11: Space in the last ~0.35 s before arrival (or during the catch) = don't perch, launch off the anchor
    if (
      I.jumpPressed &&
      (s.sub === "zipCatch" ||
        (s.sub === "zipFlight" && (1 - Z.u) * Z.dur < 0.35))
    )
      Z.launch = true;
    // user r4 #13: RMB during the flight cancels the zip and swings at once, carrying the zip's velocity
    if (I.swingPressed && (s.sub === "zipFlight" || s.sub === "zipCatch")) {
      web.release();
      Z.webs = false;
      setMode("air", "fall");
      s.airT = 0.2;
      s.apexY = feetY();
      s.swingCooldown = 0;
      s.relT = 0.4;
      events.push({ type: "zipCancel" });
      if (!tryStartSwing(I)) s.groundSwing = true; // keep searching every 60 ms while RMB is held
      return;
    }
    if (s.sub === "zipFire" || s.sub === "zipYank") {
      // the webs are shooting (a few frames): ground stays planted, air keeps its momentum; then LAUNCH at once
      if (Z.fromGround) {
        s.vel.multiplyScalar(Math.exp(-7 * h));
        s.vel.y = 0;
      } else {
        s.vel.multiplyScalar(Math.exp(-0.8 * h));
        s.vel.y -= 6 * h;
      }
      s.pos.addScaledVector(s.vel, h);
      if (!Z.fromGround) {
        const c = collide(0.3);
        if (c) {
          const vn = s.vel.dot(c.normal);
          if (vn < 0) s.vel.addScaledVector(c.normal, -vn);
        }
      }
      if (s.subT >= Z.fireDur) {
        // LAUNCH: the taut webs yank him off toward the target
        Z.taut = 1;
        web.setTaut?.(1);
        Z.p0.copy(s.pos);
        zipCurve(Z, s.vel);
        Z.u = 0;
        Z.tau = 0;
        const d0 = _v2.copy(Z.p1).sub(Z.p0).normalize();
        Z.launchDir = (Z.launchDir || new THREE.Vector3()).copy(d0);
        setSub("zipFlight");
        s.grounded = false;
        events.push({
          type: "zipLaunch",
          dir: d0.clone(),
          dist: Z.p0.distanceTo(Z.p2),
        });
      }
      Z.t = 0;
      return;
    }
    const prev = _v5.copy(s.pos);
    Z.tau = (Z.tau || 0) + h;
    Z.u = Math.min(1, Z.tau / Z.dur);
    bez(Z, zipArcE(Z, zipDist(Z, Z.tau)), s.pos);
    s.vel.copy(s.pos).sub(prev).divideScalar(Math.max(h, 1e-4));
    Z.t = Z.u;
    {
      const sp = s.vel.length();
      if (sp > 0.5) {
        Z.pitch = Math.asin(clamp(s.vel.y / sp, -1, 1));
        (Z.flightDir ||= new THREE.Vector3()).copy(s.vel).divideScalar(sp);
      }
    }
    if (Z.webs && Z.u >= 0.25) {
      Z.webs = false;
      web.setTaut?.(0);
      web.releaseSnap ? web.releaseSnap(0.3) : web.release();
      events.push({ type: "zipWebRelease" });
    }
    if (s.sub === "zipFlight" && Z.tau >= Z.tBrake) setSub("zipCatch");
    if (Z.u >= 1) arriveZip();
  }
  function arriveZip() {
    const Z = s.zip;
    web.release();
    const travelV = s.vel.clone();
    if (Z.launch) {
      anchorLaunch(travelV);
      return;
    }
    const P = s.perch;
    P.pos.copy(Z.target);
    P.normal.copy(Z.normal);
    P.kind = Z.kind;
    (P.up ||= new THREE.Vector3()).set(0, 1, 0);
    {
      const hn2 = _v2.set(Z.normal.x, 0, Z.normal.z);
      P.edge ||= new THREE.Vector3();
      if (hn2.lengthSq() > 0.09) P.edge.set(-hn2.z, 0, hn2.x).normalize();
      else P.edge.set(Math.cos(s.facing), 0, -Math.sin(s.facing));
    }
    P.radius =
      {
        lampTop: 0.25,
        signalMast: 0.15,
        pole: 0.1,
        antenna: 0.1,
        waterTower: 1.2,
      }[Z.kind] || 0;
    const hn = _v.set(Z.normal.x, 0, Z.normal.z);
    if (hn.lengthSq() > 0.09) {
      hn.normalize();
      s.facing = Math.atan2(hn.x, hn.z);
    } else if (travelV.lengthSq() > 1)
      s.facing = Math.atan2(travelV.x, travelV.z);
    P.roof =
      Math.abs(
        floorAt(
          Z.target.x - hn.x * 1.0,
          Z.target.z - hn.z * 1.0,
          Z.target.y + 0.2,
        ) - Z.target.y,
      ) < 0.25;
    (P.impact ||= new THREE.Vector3()).copy(travelV); // arrival velocity: the animation layer absorbs it (perchLand)
    s.pos.copy(Z.p2);
    s.vel.set(0, 0, 0);
    s.floorY = Z.target.y;
    setMode("perch", "perchLand");
    s.grounded = true;
    s.dashCount = 0;
    s.landing.severity = clamp(travelV.length() / 60, 0.1, 0.45);
    events.push({ type: "perch", severity: s.landing.severity });
  }
  // user r4 #11: Space at a zip arrival — no perch: use the anchor to vault on, jump up + forward keeping momentum
  function anchorLaunch(travelV) {
    const hv = _v4.set(travelV.x, 0, travelV.z);
    let hs = hv.length();
    if (hs < 2) {
      cam.forwardFlat(hv);
      hs = 0;
    } else hv.divideScalar(hs);
    const inD = lastInput ? inputDir(lastInput, new THREE.Vector3()) : null; // fresh vector: inputDir uses _v5 internally
    if (inD && inD.lengthSq() > 0.09)
      hv.lerp(inD.setY(0).normalize(), 0.35).normalize(); // a little stick steering
    const fwd = Math.min(VMAX - 6, Math.max(hs, 12) + 6);
    s.vel
      .copy(hv)
      .multiplyScalar(fwd)
      .addScaledVector(UP, 13 + Math.max(0, travelV.y) * 0.3);
    setMode("air", "pointLaunch");
    s.airT = 0;
    s.apexY = feetY();
    s.swingCooldown = 0.3;
    s.wallCooldown = 0.3;
    s.relT = 0;
    s.facing = Math.atan2(hv.x, hv.z);
    s.trick = null;
    s.grounded = false;
    events.push({ type: "pointLaunch", anchor: true });
  }
  function pointLaunch(normal, travelV) {
    // direction: held stick > camera heading, nudged by the zip momentum / perch outward normal
    const inD = lastInput
      ? inputDir(lastInput, new THREE.Vector3())
      : new THREE.Vector3();
    let dir =
      inD.lengthSq() > 0.09
        ? inD.normalize()
        : cam.forwardFlat(new THREE.Vector3());
    const tv = hdir(travelV, _v2);
    if (tv && tv.dot(dir) > 0) dir.lerp(tv, 0.25).normalize();
    const out = _v.set(normal.x, 0, normal.z);
    if (out.lengthSq() > 0.09 && out.normalize().dot(dir) > -0.3)
      dir.lerp(out, 0.2).normalize();
    // never launch into a facade: if the chosen heading is blocked close ahead (and up the launch arc), swing it toward
    // the perch's outward normal / the most open direction
    {
      const blocked = (d) => {
        const o = _v3.copy(s.pos);
        o.y += 1.5;
        const hh = world.raycast(o, _v4.set(d.x, 0.45, d.z).normalize(), 14);
        return hh && Math.abs(hh.normal.y) < 0.6;
      };
      if (blocked(dir)) {
        let bestD = null,
          bestA = 9;
        const a0 = Math.atan2(dir.x, dir.z);
        for (const da of [
          0.4,
          -0.4,
          0.8,
          -0.8,
          1.2,
          -1.2,
          1.6,
          -1.6,
          2.2,
          -2.2,
          Math.PI,
        ]) {
          const d = new THREE.Vector3(Math.sin(a0 + da), 0, Math.cos(a0 + da));
          if (!blocked(d)) {
            if (Math.abs(da) < bestA) {
              bestA = Math.abs(da);
              bestD = d;
            }
          }
        }
        if (bestD) dir.copy(bestD);
        else if (out.lengthSq() > 0.09) dir.copy(out);
      }
    }
    const carry = Math.min(12, Math.hypot(travelV.x, travelV.z) * 0.25);
    s.vel
      .copy(dir)
      .multiplyScalar(15 + carry)
      .addScaledVector(UP, 20.5);
    setMode("air", "pointLaunch");
    s.airT = 0;
    s.apexY = feetY();
    s.swingCooldown = 0.35;
    s.wallCooldown = 0.3;
    s.facing = Math.atan2(dir.x, dir.z);
    s.trick = null;
    events.push({ type: "pointLaunch" });
  }
  function webDash() {
    // Insomniac web-zip: forward air dash when no zip point is targeted
    const f = cam.forwardFlat(new THREE.Vector3());
    const hs = Math.hypot(s.vel.x, s.vel.z);
    const sp = Math.min(Math.max(hs + 8, 22), VMAX);
    s.vel.x = f.x * sp;
    s.vel.z = f.z * sp;
    s.vel.y = Math.max(s.vel.y, 3.5);
    const tgt = s.pos.clone().addScaledVector(f, 16);
    tgt.y += 3;
    s.zip.target.copy(tgt);
    s.zip.t = 0;
    s.zip.dash = true;
    web.attach(rig.handWorld("R"), tgt, f.clone().negate());
    s.dashWebT = 0.22;
    setMode("air", "zipPull");
    s.airT = 0.2;
    s.zipCooldown = 0.45;
    s.dashCount++;
    s.facing = Math.atan2(f.x, f.z);
    s.trick = null;
    events.push({ type: "webDash" });
  }
  // ------------------------------------------------------------------ quick web boost (Q / L1, air only)
  // One web from ONE hand to a far point ahead (building / prop 25-80 m along the camera / stick heading, slightly up;
  // nearer 12-25 m hits next; else a point in the sky), the hand yanks it back to the chest and the body gets a forward
  // impulse toward the anchor (mostly horizontal + a little lift) at the moment the web hits. Body stays in the normal air
  // animation (no zip flight); the animator layers a one-arm yank (anim.quick). Mid-swing: the swing web is let go first.
  // Chained presses alternate hands and diminish (1, 0.8, 0.65, 0.55 ...), reset on landing / after 1.6 s.
  const QUICK = {
    dv: 12,
    hCap: 40,
    cd: 0.55,
    minD: 25,
    maxD: 80,
    nearD: 12,
    web: 0.26,
    dur: 0.62,
  };
  function quickAnchor(out, nOut) {
    const L = cam.forward ? cam.forward(new THREE.Vector3()) : s.lookDir,
      inD = lastInput ? inputDir(lastInput, new THREE.Vector3()) : null;
    let yaw = Math.atan2(L.x, L.z);
    if (inD && inD.lengthSq() > 0.09) yaw = Math.atan2(inD.x, inD.z); // stick heading wins (camera-relative)
    const el0 = clamp(Math.asin(clamp(L.y, -1, 1)) + 0.14, 0.06, 0.6);
    const o = _v3.copy(s.pos);
    o.y += 0.5;
    let best = null,
      bestS = -1e9,
      near = null;
    for (const [de, dy] of [
      [0, 0],
      [0.16, 0],
      [-0.06, 0],
      [0, 0.2],
      [0, -0.2],
      [0.16, 0.2],
      [0.16, -0.2],
      [0.34, 0],
      [0.34, 0.3],
      [0.34, -0.3],
    ]) {
      const el = el0 + de,
        a = yaw + dy;
      const d = _v4.set(
        Math.sin(a) * Math.cos(el),
        Math.sin(el),
        Math.cos(a) * Math.cos(el),
      );
      const hit = world.raycast(o, d, QUICK.maxD);
      if (!hit || (hit.normal.y > 0.7 && hit.point.y < s.pos.y - 1)) continue; // never the ground below
      if (hit.distance >= QUICK.minD) {
        const sc = -Math.abs(dy) * 3 - Math.abs(de) * 1.5;
        if (sc > bestS) {
          bestS = sc;
          best = {
            p: hit.point.clone(),
            n: hit.normal.clone(),
            d: hit.distance,
          };
        }
      } else if (
        hit.distance >= QUICK.nearD &&
        (!near || hit.distance > near.d)
      )
        near = { p: hit.point.clone(), n: hit.normal.clone(), d: hit.distance };
    }
    const pick = best || near;
    if (pick) {
      out.copy(pick.p);
      nOut.copy(pick.n);
      return { dist: pick.d, sky: false };
    }
    const el = el0 + 0.1,
      d = _v4.set(
        Math.sin(yaw) * Math.cos(el),
        Math.sin(el),
        Math.cos(yaw) * Math.cos(el),
      );
    out.copy(o).addScaledVector(d, 60);
    nOut.copy(d).negate();
    return { dist: 60, sky: true };
  }
  function quickBoostStart() {
    const Q = s.quick,
      fromSwing = s.mode === "swing";
    if (fromSwing) {
      // let go of the swing web first (explicit button press, like E / MMB)
      leaveSwingOK = true;
      web.release();
      setMode("air", s.vel.y > 3 ? "rise" : s.vel.y > -4 ? "apex" : "fall");
      leaveSwingOK = false;
      s.airT = 0;
      s.apexY = feetY();
      s.relT = 0;
      s.trick = null;
      s.lastTrick = false;
    }
    const r = quickAnchor(Q.anchor, Q.normal);
    const hand0 = Q.hand;
    if (s.clock - Q.last > 1.6) Q.n = 0;
    if (fromSwing)
      Q.hand = s.swing.hand === "L" ? "R" : "L"; // just left a swing: the free hand
    else if (Q.n > 0)
      Q.hand = hand0 === "L" ? "R" : "L"; // chain: alternate
    else {
      const rel = _v.copy(Q.anchor).sub(s.pos),
        f = Math.sin(s.facing) * rel.z - Math.cos(s.facing) * rel.x;
      Q.hand = f > 0 ? "R" : "L";
    } // target side
    Q.k = [1, 0.8, 0.65, 0.55][Math.min(Q.n, 3)];
    Q.n++;
    Q.last = s.clock;
    Q.seq++;
    Q.dist = r.dist;
    Q.sky = r.sky;
    Q.t = 0;
    Q.applied = false;
    Q.active = true;
    Q.webOn = true;
    Q.hitT = clamp(r.dist / 600, 0.05, 0.11);
    s.dashWebT = 0;
    web.attach(rig.handWorld(Q.hand), Q.anchor, Q.normal, {
      shootDur: Q.hitT,
      noSplat: r.sky,
    });
    // body stays in the normal air blend: leave launch / dash / trick one-shots for rise / apex / fall
    if (
      s.sub !== "rise" &&
      s.sub !== "apex" &&
      s.sub !== "fall" &&
      s.sub !== "release"
    ) {
      s.trick = null;
      setSub(s.vel.y > 3 ? "rise" : s.vel.y > -4 ? "apex" : "fall");
    }
    s.swingCooldown = Math.max(s.swingCooldown, Q.hitT + 0.28); // the boost plays before a held RMB re-attaches
    s.zipCooldown = Math.max(s.zipCooldown, 0.15);
    events.push({
      type: "quickZip",
      hand: Q.hand,
      dist: r.dist,
      sky: r.sky,
      k: Q.k,
    });
  }
  function quickImpulse() {
    const Q = s.quick;
    const d = _v.copy(Q.anchor).sub(s.pos);
    const L = d.length();
    if (L > 1e-3) d.divideScalar(L);
    else d.set(Math.sin(s.facing), 0, Math.cos(s.facing));
    let hd = hdir(d, _v2);
    if (!hd) hd = _v2.set(Math.sin(s.facing), 0, Math.cos(s.facing));
    const sp0 = s.vel.length(),
      hs0 = Math.hypot(s.vel.x, s.vel.z);
    const cur =
      hs0 > 1 ? _v3.set(s.vel.x / hs0, 0, s.vel.z / hs0) : _v3.copy(hd);
    const hv = cur.lerp(hd, 0.75).normalize(); // most of the current momentum swings round toward the anchor
    const hs = Math.min(
      Math.max(hs0, 8) + QUICK.dv * Q.k,
      Math.max(hs0, QUICK.hCap),
    );
    // a little lift (more toward a high anchor); a fall is only partly arrested (no hovering by spamming Q)
    const vy = Math.min(
      (s.vel.y < 0 ? s.vel.y * 0.4 : s.vel.y) +
        (3 + 5 * Math.max(0, d.y)) * Q.k,
      9,
    );
    s.vel.set(hv.x * hs, Math.max(s.vel.y, vy), hv.z * hs);
    capSpeed(VMAX);
    s.facing = Math.atan2(hv.x, hv.z);
    s.relT = 0.15; // the boost owns the trajectory; air control fades back in over ~0.75 s
    s.dive = false;
    Q.applied = true;
    web.setTaut?.(0.8);
    events.push({
      type: "quickBoost",
      hand: Q.hand,
      dist: Q.dist,
      sky: Q.sky,
      v0: sp0,
      v1: s.vel.length(),
      k: Q.k,
    });
  }
  // per frame (before the substeps): web hit -> impulse, web snap-off after ~0.26 s, anim timeline
  function stepQuickBoost(dt) {
    const Q = s.quick;
    if (!Q.active) return;
    Q.t += dt;
    if (!Q.applied && Q.t >= Q.hitT) {
      if (s.mode === "air") quickImpulse();
      else Q.applied = true;
    }
    if (Q.webOn && (Q.t > Q.hitT + QUICK.web || s.mode !== "air")) {
      Q.webOn = false;
      if (s.mode !== "swing" && s.mode !== "zip" && !s.sling.active)
        web.releaseSnap ? web.releaseSnap(0.3) : web.release();
    }
    if (Q.t > QUICK.dur) Q.active = false;
  }
  function stepPerch(h, I) {
    const P = s.perch;
    if (s.sub === "perchLand" && s.subT > 0.5) setSub("perchIdle");
    // standing perch at an end of a web tightrope: settle onto the point; the W / S held to walk the line must be let go
    // before the stick means "walk / hop off" (else arriving with W held would hop straight off the far roof)
    if (s.sub === "perchStand") {
      if (s.standPos) s.pos.lerp(s.standPos, 1 - Math.exp(-10 * h));
      if (s.standHold && Math.hypot(I.move.x, I.move.y) < 0.1)
        s.standHold = false;
    }
    const out = _v.set(P.normal.x, 0, P.normal.z);
    if (out.lengthSq() < 0.09)
      out.set(Math.sin(s.facing), 0, Math.cos(s.facing));
    out.normalize();
    if (I.jumpPressed) {
      if (s.sub === "perchLand" && s.subT < 0.25 && P.impact)
        anchorLaunch(P.impact);
      else pointLaunch(P.normal, _v2.set(0, 0, 0));
      return;
    }
    if (I.swingPressed) {
      s.vel.copy(out).multiplyScalar(7).addScaledVector(UP, 5.5);
      setMode("air", "jumpLaunch");
      s.airT = 0;
      s.apexY = feetY();
      s.swingCooldown = 0.12;
      return;
    }
    if (I.dropPressed) {
      s.pos.addScaledVector(out, 0.55);
      s.vel.copy(out).multiplyScalar(2.5);
      setMode("air", "fall");
      s.airT = 0;
      s.apexY = feetY();
      return;
    }
    const inD = inputDir(I, new THREE.Vector3());
    if (
      inD.lengthSq() > 0.16 &&
      s.modeT > 0.25 &&
      !(s.sub === "perchStand" && s.standHold)
    ) {
      inD.normalize();
      const alongEdge =
        Math.abs(inD.dot(out)) < 0.5 &&
        P.kind !== "lampTop" &&
        P.kind !== "signalMast" &&
        P.kind !== "pole" &&
        P.kind !== "antenna";
      if (!alongEdge && (inD.dot(out) > 0.3 || !P.roof)) {
        // hop down / off (outward, or off a lamp / pole top)
        if (inD.dot(out) > 0.3) s.pos.addScaledVector(out, 0.3);
        s.vel.copy(inD).multiplyScalar(5.5).addScaledVector(UP, 4.5);
        s.facing = Math.atan2(inD.x, inD.z);
        setMode("air", "jumpLaunch");
        s.airT = 0;
        s.apexY = feetY();
        return;
      }
      // stand up and walk: along the edge / coping (balance keeps him on it) or back onto the roof
      s.facing = Math.atan2(inD.x, inD.z);
      s.speed = 1.5;
      if (!alongEdge) s.pos.addScaledVector(inD, 0.2);
      enterGround("walk");
      s.speed = 1.5;
      return;
    }
    s.vel.set(0, 0, 0);
  }

  // ------------------------------------------------------------------ web tightrope (T while perched; ./rope.ts)
  // T on a perch with the zip reticle on a point: validate (length 6-120 m, incline <= 30 deg, clear line for the strand
  // and his body) -> ropeShoot: right arm up + point, one web flies to the target (ROPE.AIM s), the hand brings the near
  // end down and pins it at our perch point (ROPE.PIN s after the hit) -> ropeStand (0.5 s up from the crouch onto the
  // start of the line, facing along it) -> ropeIdle / ropeWalk (W toward the far point, S back toward the start; he
  // turns round on the line to face the way he walks: ropeTurn) -> the far end = standing perch there (perchStand), the
  // start = standing perch back on the start point. Exits: Space jump, E zip (only with a target), C / Ctrl drop,
  // RMB hop into a swing, combat engage (player.ts -> ropeFall). The strand lingers ROPE.LINGER s after he leaves, then
  // lets go at the far end and falls away.
  function ropeFail(reason) {
    events.push({ type: "ropeFail", reason });
    return false;
  }
  function ropeTry(t) {
    if (!t) return ropeFail("noTarget");
    const A = s.perch.pos,
      d = new THREE.Vector3().copy(t.pos).sub(A),
      L = d.length();
    if (L < ROPE.MIN || L > ROPE.MAX) return ropeFail("length");
    d.divideScalar(L);
    if (Math.abs(Math.asin(clamp(d.y, -1, 1))) > ROPE.SLOPE)
      return ropeFail("slope");
    // clear line: the strand itself and his body over it (knees, head); world.raycast already skips BLOCKONLY trunks
    const blocked = (lift, trim) => {
      const o = _v3.copy(A).addScaledVector(d, trim);
      o.y += lift;
      return !!world.raycast(o, d, Math.max(0.1, L - 2 * trim));
    };
    if (blocked(0.08, 0.35) || blocked(0.9, 0.6) || blocked(1.75, 0.9))
      return ropeFail("blocked");
    startRope(t, L, d);
    return true;
  }
  function startRope(t, L, d) {
    const R = makeRope(),
      P = s.perch;
    R.a.copy(P.pos);
    R.b.copy(t.pos);
    R.nb.copy(t.normal);
    R.target.pos.copy(t.pos);
    R.target.normal.copy(t.normal);
    R.target.kind = t.kind;
    R.dir.copy(d);
    R.len = L;
    R.lenH = Math.hypot(t.pos.x - P.pos.x, t.pos.z - P.pos.z);
    R.slope = Math.asin(clamp(d.y, -1, 1));
    R.sag = Math.min(0.25, 0.002 * L);
    R.dipMax = Math.min(0.24, 0.035 + 0.0035 * L);
    R.shootDur = clamp(L / 260, 0.06, 0.22);
    R.fireT = ROPE.AIM;
    R.hitT = R.fireT + R.shootDur;
    R.pinT = R.hitT + ROPE.PIN;
    R.fromStand = s.sub === "perchStand";
    R.uStart = Math.min(0.1, 0.22 / L);
    R.p0 = s.pos.clone();
    R.start = {
      pos: P.pos.clone(),
      normal: P.normal.clone(),
      kind: P.kind,
      roof: P.roof,
      up: (P.up || UP).clone(),
      edge: (P.edge || new THREE.Vector3(1, 0, 0)).clone(),
      radius: P.radius || 0,
    };
    if (s.rope) leaveRope();
    s.rope = R;
    s.ropes.push(R);
    if (R.lenH > 0.1) s.facing = Math.atan2(d.x, d.z);
    setMode("rope", "ropeShoot");
    s.vel.set(0, 0, 0);
    s.speed = 0;
    s.grounded = true;
    s.charging = false;
    s.standHold = false;
    events.push({ type: "ropeStart", len: L });
  }
  // he is off the strand (arrived, jumped, dropped, zipped, knocked off): it stays taut for a while, then lets go
  function leaveRope() {
    const R = s.rope;
    if (!R) return;
    R.load = 0;
    R.gone = s.clock;
    R.linger = R.pinned ? ROPE.LINGER : 0;
    s.rope = null;
  }
  const ropeFwd = (R, out) => {
    out.set(R.dir.x * R.face, 0, R.dir.z * R.face);
    if (out.lengthSq() < 1e-6)
      out.set(Math.sin(s.facing), 0, Math.cos(s.facing));
    return out.normalize();
  };
  function ropeOff(kind, I) {
    // leave the line into the air
    const R = s.rope,
      f = ropeFwd(R, new THREE.Vector3()),
      right = new THREE.Vector3(-f.z, 0, f.x);
    const sp = Math.abs(R.v);
    if (kind === "jump") {
      // Space: a jump off the line along the walk (keeps the walk speed), a little toward the A / D lean
      s.vel
        .copy(f)
        .multiplyScalar(sp * 0.9 + 2.5)
        .addScaledVector(right, (R.lean || 0) * 2.5);
      s.vel.y = JUMP * 0.9;
      setMode("air", "jumpLaunch");
      events.push({ type: "ropeJump" });
    } else if (kind === "swing") {
      // RMB: hop up and out into a swing (like a perch kick-off)
      s.vel
        .copy(f)
        .multiplyScalar(Math.max(5, sp + 2))
        .addScaledVector(UP, 5.5);
      setMode("air", "jumpLaunch");
      s.swingCooldown = 0.12;
    } else {
      // drop (C / Ctrl) or knocked off (combat): slips off the line and falls
      const side =
        kind === "knock"
          ? Math.random() < 0.5
            ? -1
            : 1
          : Math.sign(R.lean || 0) || 1;
      s.vel
        .copy(f)
        .multiplyScalar(sp * 0.6)
        .addScaledVector(right, side * (kind === "knock" ? 2.2 : 0.8));
      s.vel.y = kind === "knock" ? 2 : -1;
      setMode("air", "fall");
      events.push({ type: "ropeDrop", knock: kind === "knock" });
    }
    s.airT = 0;
    s.apexY = feetY();
    s.grounded = false;
    s.trick = null;
    s.charging = false;
    leaveRope();
  }
  function ropeArrive(far) {
    const R = s.rope,
      P = s.perch;
    if (far) {
      const T = R.target;
      P.pos.copy(T.pos);
      P.normal.copy(T.normal);
      P.kind = T.kind;
      (P.up ||= new THREE.Vector3()).set(0, 1, 0);
      const hn = _v2.set(T.normal.x, 0, T.normal.z);
      P.edge ||= new THREE.Vector3();
      if (hn.lengthSq() > 0.09) {
        hn.normalize();
        P.edge.set(-hn.z, 0, hn.x);
      } else P.edge.set(Math.cos(s.facing), 0, -Math.sin(s.facing));
      P.radius =
        {
          lampTop: 0.25,
          signalMast: 0.15,
          pole: 0.1,
          antenna: 0.1,
          waterTower: 1.2,
        }[T.kind] || 0;
      P.roof =
        hn.lengthSq() > 0.09 &&
        Math.abs(
          floorAt(T.pos.x - hn.x, T.pos.z - hn.z, T.pos.y + 0.2) - T.pos.y,
        ) < 0.25;
    } else {
      const S0 = R.start;
      P.pos.copy(S0.pos);
      P.normal.copy(S0.normal);
      P.kind = S0.kind;
      P.roof = S0.roof;
      (P.up ||= new THREE.Vector3()).copy(S0.up);
      (P.edge ||= new THREE.Vector3()).copy(S0.edge);
      P.radius = S0.radius;
    }
    (P.impact ||= new THREE.Vector3()).set(0, 0, 0);
    s.standPos = (s.standPos || new THREE.Vector3()).copy(P.pos);
    s.standPos.y += H; // feet on the point itself
    s.vel.set(0, 0, 0);
    s.speed = 0;
    s.floorY = P.pos.y;
    setMode("perch", "perchStand");
    s.grounded = true;
    s.standHold = true;
    s.dashCount = 0;
    leaveRope();
    events.push({ type: "ropeArrive", far });
  }
  function stepRope(h, I) {
    const R = s.rope;
    if (!R) {
      setMode("air", "fall");
      s.airT = 0;
      s.apexY = feetY();
      return;
    }
    R.t += h;
    if (!R.fired && R.t >= R.fireT) {
      R.fired = true;
      events.push({ type: "ropeShoot", len: R.len });
    }
    if (!R.hit && R.t >= R.hitT) {
      R.hit = true;
      web.splat?.(R.b, R.nb);
      events.push({ type: "ropeHit" });
    }
    if (!R.pinned && R.t >= R.pinT) {
      R.pinned = true;
      R.load = 1;
      events.push({ type: "ropeAnchor" });
    }
    if (I.jumpPressed) {
      ropeOff("jump", I);
      return;
    }
    if (I.dropPressed) {
      ropeOff("drop", I);
      return;
    }
    if (I.swingPressed) {
      ropeOff("swing", I);
      return;
    }
    s.vel.set(0, 0, 0);
    s.speed = 0;
    if (s.sub === "ropeShoot") {
      if (R.pinned && R.t >= R.pinT + 0.06) setSub("ropeStand");
      return;
    }
    if (s.sub === "ropeStand") {
      // up from the crouch onto the start of the line
      R.u = R.uStart;
      R.loadU = R.u;
      const k = clamp(s.subT / ROPE.STAND, 0, 1),
        e = k * k * (3 - 2 * k);
      ropePoint(R, R.u, _v);
      _v.y += H;
      s.pos.copy(R.p0).lerp(_v, e);
      if (s.subT >= ROPE.STAND) setSub("ropeIdle");
      return;
    }
    // W = toward the far point, S = back toward the start (rope-absolute: the camera orbiting never flips them); he turns
    // round on the line (ropeTurn, ~0.45 s) to face the way he walks. A / D: lean / sway only.
    const want = I.move.y > 0.3 ? 1 : I.move.y < -0.3 ? -1 : 0;
    R.lean = damp(R.lean, clamp(I.move.x, -1, 1), 5, h);
    if (s.sub === "ropeTurn") {
      R.v = 0;
      if (s.subT >= 0.45) setSub("ropeIdle");
    } else if (want && want !== R.face && Math.abs(R.v) < 0.25) {
      R.face = want;
      R.v = 0;
      const f = ropeFwd(R, _v);
      s.facing = Math.atan2(f.x, f.z);
      setSub("ropeTurn");
    } else {
      const climb = Math.max(0, R.face * Math.sin(R.slope)); // uphill: slower (at most 30 deg -> x0.75)
      const vmax = ROPE.SPEED * (1 - 0.5 * climb);
      const remain =
        R.face > 0 ? (1 - R.u) * R.len : Math.max(0, R.u - R.uStart) * R.len;
      const cap = Math.sqrt(2 * ROPE.DEC * 0.6 * remain) + 0.35; // eases into the end point
      const tgt = want === R.face ? Math.min(vmax, cap) : 0;
      let sp = Math.abs(R.v);
      sp =
        sp < tgt
          ? Math.min(tgt, sp + ROPE.ACC * h)
          : Math.max(tgt, sp - ROPE.DEC * h);
      R.v = sp * R.face;
      setSub(sp > 0.05 ? "ropeWalk" : "ropeIdle");
    }
    const lo = R.face < 0 ? R.uStart : 0;
    R.u = clamp(R.u + (R.v * h) / R.len, Math.min(lo, R.u), 1);
    R.loadU = R.u;
    const prev = _v5.copy(s.pos);
    ropePoint(R, R.u, s.pos);
    s.pos.y += H;
    s.vel.copy(s.pos).sub(prev).divideScalar(Math.max(h, 1e-4));
    s.speed = Math.abs(R.v);
    if (want === 1 && R.face > 0 && R.u >= 1 - 1e-5) ropeArrive(true);
    else if (want === -1 && R.face < 0 && R.u <= R.uStart + 1e-5)
      ropeArrive(false);
  }
  // per frame: dip springs + lifetime of every drawn strand (the one he is on and the lingering ones)
  function ropesTick(dt) {
    if (s.rope && s.mode !== "rope") leaveRope(); // left the line some other way (zip, teleport, safety net)
    for (const R of s.ropes) {
      stepRopeSpring(R, dt);
      if (R.gone >= 0) {
        R.drop = clamp((s.clock - R.gone - R.linger) / ROPE.DROP, 0, 1);
        if (R.drop >= 1) R.alive = false;
      }
    }
    if (s.ropes.some((R) => !R.alive)) s.ropes = s.ropes.filter((R) => R.alive);
  }

  // ------------------------------------------------------------------ dynamic obstacles (C3) + world feedback
  const dynFeet = new THREE.Vector3();
  function dynamicCollide(dt) {
    s.dyn.t += dt;
    s.dyn.onTop = false;
    if (!world.collideDynamic) return;
    dynFeet.set(s.pos.x, s.pos.y - H, s.pos.z);
    let r = null;
    try {
      r = world.collideDynamic(dynFeet, R, HEIGHT);
    } catch (e) {
      r = null;
    }
    if (!r) return;
    if (r.push) {
      s.pos.x += r.push.x;
      s.pos.z += r.push.z;
      if (r.push.y > 0 && !r.grounded) s.pos.y += r.push.y;
    }
    if (r.grounded && r.groundY != null) {
      s.dyn.y = r.groundY;
      s.dyn.t = 0;
      s.dyn.onTop = true;
      if (r.velocity) s.dyn.vel.copy(r.velocity);
      else s.dyn.vel.set(0, 0, 0);
    }
    if (r.push && s.mode === "ground" && !r.grounded) {
      // bumped by a car: stumble
      const pl = Math.hypot(r.push.x, r.push.z);
      if (pl > 0.05 && r.velocity)
        s.carry.set(r.velocity.x * 0.5, 0, r.velocity.z * 0.5);
    }
  }

  // ------------------------------------------------------------------ orientation (root transform)
  const rootPos = new THREE.Vector3();
  const basis = (fwd, up, out) => {
    const z = _v.copy(fwd).addScaledVector(up, -fwd.dot(up));
    if (z.lengthSq() < 1e-6) return null;
    z.normalize();
    const x = _v2.crossVectors(up, z).normalize();
    const y = _v3.crossVectors(z, x);
    _m.makeBasis(x, y, z);
    return out.setFromRotationMatrix(_m);
  };
  let lastVelYaw = 0;
  function orient(dt) {
    const hv = Math.hypot(s.vel.x, s.vel.z);
    let rate = 12;
    const want = _q;
    const up = _v4.set(0, 1, 0),
      fwd = new THREE.Vector3(Math.sin(s.facing), 0, Math.cos(s.facing));
    // bank from the yaw-rate of travel (centripetal lean)
    const velYaw = Math.atan2(s.vel.x, s.vel.z);
    const yr = hv > 2 ? angWrap(velYaw - lastVelYaw) / Math.max(dt, 1e-3) : 0;
    lastVelYaw = velYaw;
    const bankT = clamp((yr * hv) / 22, -1, 1);
    s.bank = damp(s.bank, bankT, 5, dt);
    s.pitch = 0;
    s.roll = 0;
    if (s.mode === "ground") {
      rate = s.sub === "landRoll" ? 20 : 16;
      s.roll = -s.bank * (s.speed > RUN ? 0.28 : 0.15);
      if (s.sub === "sprint" || s.sub === "run")
        s.pitch = 0.06 * Math.min(1, s.speed / SPRINT);
    } else if (s.mode === "air") {
      if (hv > 1.5 && s.sub !== "zipPull")
        s.facing = Math.atan2(s.vel.x, s.vel.z);
      fwd.set(Math.sin(s.facing), 0, Math.cos(s.facing));
      s.roll = -s.bank * 0.45;
      s.pitch =
        s.dive || s.gliding ? 0.25 : clamp(-s.vel.y * 0.008, -0.2, 0.25); // (the dive's head-down tip is in the animator air node)
      rate = 8;
    } else if (s.mode === "swing") {
      const S = s.swing;
      // slack web (over the top / free fall inside the circle): the body stops hanging from the anchor and rights itself
      const ad = _v5.copy(S.anchor).sub(s.pos).normalize();
      up.copy(ad)
        .multiplyScalar(1 - 0.85 * S.slack)
        .addScaledVector(UP, 0.12 + 0.85 * S.slack)
        .normalize();
      if (hv > 1) s.facing = Math.atan2(s.vel.x, s.vel.z);
      fwd.copy(
        s.vel.lengthSq() > 1
          ? s.vel
          : _v5.set(Math.sin(s.facing), 0, Math.cos(s.facing)),
      );
      S.bank = damp(
        S.bank,
        clamp(bankT + (s.vel.x * S.dir.z - s.vel.z * S.dir.x) * 0.02, -1, 1),
        6,
        dt,
      );
      s.roll = -S.bank * 0.5;
      rate = 14;
    } else if (s.mode === "zip") {
      // body line: loaded/leaning back on the yank, head-first as the slingshot fires, swinging feet-first for the perch
      // flight: streamlined HEAD-FIRST along the velocity (object up = flight direction, belly toward the ground —
      // matches the zipFlight clip contract); catch: rotates back upright, facing out over the perch
      // user r4 #15/#17: streamlined pointing AT the anchor for the whole flight (no upright swing mid-air), collapse
      // upright only in the last ~10% at the anchor. Chest axis from a FIXED heading (s.facing, set once at zip start):
      // x = UP x facing, z = x x up — continuous through vertical / over-the-top, never a 180 deg yaw flip.
      const Z = s.zip,
        sm = (x) => {
          x = clamp(x, 0, 1);
          return x * x * (3 - 2 * x);
        };
      const flying = s.sub === "zipFlight" || s.sub === "zipCatch";
      const k = flying
        ? sm((Z.tau || 0) / 0.08) * (1 - sm((0.12 - (1 - Z.t) * Z.dur) / 0.12))
        : 0; // upright over the last 0.12 s
      const hf = _v5.set(Math.sin(s.facing), 0, Math.cos(s.facing));
      if (k > 0.01) {
        const toT = _v3.copy(Z.p2).sub(s.pos);
        if (toT.lengthSq() < 0.25 && Z.flightDir) toT.copy(Z.flightDir);
        toT.normalize();
        up.copy(UP).lerp(toT, k).normalize();
        const xr = _v2.crossVectors(UP, hf).normalize();
        fwd.crossVectors(xr, up);
        if (fwd.lengthSq() < 1e-4) fwd.copy(hf);
      } else fwd.copy(hf);
      rate = 14;
    } else if (s.mode === "perch" || s.mode === "rope") {
      fwd.set(Math.sin(s.facing), 0, Math.cos(s.facing));
      rate = 10;
    } else if (s.mode === "wall") {
      const n = s.wall.normal,
        W = s.wall;
      // wall-run = the run cycle rotated onto the wall: body up = wall normal, forward = run direction along the wall.
      // runK eases 0..1 on entry / back to 0 on exit so the root pitches smoothly onto / off the wall (no snaps).
      // vertical wall-run = run cycle rotated onto the wall; sideways run uses the crawl frame (wallRunHorizontal clip
      // contract: +Z into the wall, +Y up the wall, origin 0.30 m off the surface)
      const running = s.sub === "wallRun" && W.fast;
      W.runK = damp(W.runK, running ? 1 : 0, running ? 9 : 7, dt);
      const along = _v5.copy(W.up).addScaledVector(n, -W.up.dot(n));
      if (along.lengthSq() < 1e-4) along.set(0, 1, 0);
      along.normalize();
      if (W.runK > 0.5) {
        fwd.copy(along);
        up.copy(n);
      } else {
        fwd.copy(n).negate();
        up.copy(along);
      }
      rate = 14;
    }
    if (basis(fwd, up, want)) s.bodyQ.slerp(want, 1 - Math.exp(-rate * dt));
    // procedural root adds: pitch / roll / roll-landing spin
    const q = _q2.copy(s.bodyQ);
    if (s.roll) q.multiply(_q.setFromAxisAngle(_v.set(0, 0, 1), s.roll));
    if (s.pitch) q.multiply(_q.setFromAxisAngle(_v.set(1, 0, 0), s.pitch));
    // root position = feet (along the body's up axis), with curb step smoothing
    s.stepOff = damp(s.stepOff, 0, 16, dt);
    const bodyUp = _v.set(0, 1, 0).applyQuaternion(s.bodyQ);
    if (s.mode === "wall") {
      // crawl: origin 0.30 m off the effective wall plane (wall-clip convention, SPIDERMAN.md); wall-run: feet ON the
      // plane (rotated run). Blend by runK so entry/exit never pops the body through the facade.
      const W = s.wall,
        toPlane = W.dist; // capsule centre -> effective wall plane
      const crawl = _v2
        .copy(s.pos)
        .addScaledVector(W.normal, 0.3 - toPlane)
        .addScaledVector(bodyUp, -H * (1 - W.runK));
      const run = _v3.copy(s.pos).addScaledVector(W.normal, -toPlane + 0.02);
      rootPos.copy(crawl).lerp(run, W.runK);
    } else rootPos.copy(s.pos).addScaledVector(bodyUp, -H);
    if (s.mode === "ground" || s.mode === "perch" || s.mode === "rope")
      rootPos.y = s.pos.y - H + s.stepOff;
    return q;
  }

  // ------------------------------------------------------------------ main update
  const guardP = new THREE.Vector3();
  let guardOk = false;
  const api = {
    s,
    anim,
    events,
    targeting,
    zipPoints,
    anchors,
    index,
    rootPos,
    H,
    R,
    floorAt,
    update(dt, I) {
      events.length = 0;
      lastInput = I;
      s.jumpBuf = I.jumpPressed ? 0.22 : Math.max(0, (s.jumpBuf || 0) - dt);
      s.subT += dt;
      s.modeT += dt;
      if (s.mode === "swing") s.sinceSwing = 0;
      else {
        s.sinceSwing = (s.sinceSwing ?? 99) + dt;
        if (s.sinceSwing > CHAIN_BUF && s.chain) {
          s.chain = 0;
          events.push({ type: "swingChain", n: 0 });
        }
      }
      s.swingCooldown -= dt;
      s.wallCooldown -= dt;
      s.zipCooldown -= dt;
      s.clock += dt;
      if (s.mode !== "ground")
        s.walkK = damp(
          s.walkK,
          lastInput?.walk && s.grounded ? 1 : 0,
          WALK_EASE,
          dt,
        ); // (ground: stepGround)
      if (s.dashWebT > 0) {
        s.dashWebT -= dt;
        if (s.dashWebT <= 0 && s.mode === "air") web.release();
      }
      // zip targeting (reticle) — suppressed while swinging fast / zipping
      const eye = _v.copy(s.pos);
      eye.y += 0.5;
      const enabled =
        s.mode !== "zip" && !(s.mode === "swing" && s.vel.length() > 30);
      const perched = s.mode === "perch";
      targeting.update(dt, camera, eye, {
        enabled,
        exclude: perched ? s.perch.pos : null,
        air: s.mode === "air" || s.mode === "swing",
        perchOut: perched
          ? _v2.set(s.perch.normal.x, 0, s.perch.normal.z).lengthSq() > 0.09
            ? _v2.normalize()
            : _v2.set(Math.sin(s.facing), 0, Math.cos(s.facing))
          : null,
      });
      // T: web tightrope to the highlighted point — only while perched (standing or crouched); anywhere else it does nothing
      if (I.ropePressed && s.mode === "perch" && !s.kin && s.zipCooldown <= 0)
        ropeTry(targeting.best);
      // E / MMB: zip to the highlighted point, or air web-dash
      if (I.zipPressed && s.zipCooldown <= 0 && !s.kin) {
        const t = targeting.best;
        leaveSwingOK = true; // explicit button press: the only non-RMB way the held web is switched
        if (s.mode === "wall" && (s.sub === "wallRun" || s.sub === "crawl"))
          wallZip(); // user r9w: wall zip up (overrides the target)
        else if (s.mode === "rope") {
          if (t) {
            leaveRope();
            startZip(t);
            s.zipCooldown = 0.25;
          } else ropeFail("noTarget");
        } // tightrope: zip only with a target
        else if (t) {
          if (s.mode === "swing") web.release();
          startZip(t);
          s.zipCooldown = 0.25;
        } else if (s.mode === "perch") {
          pointLaunch(s.perch.normal, _v3.set(0, 0, 0));
          s.zipCooldown = 0.25;
        } // never a dead button on a perch
        else if (s.mode === "air" || s.mode === "swing") {
          if (s.mode === "swing") web.release();
          webDash();
        }
        leaveSwingOK = false;
      }
      // Q / L1: quick web boost (air, or mid-swing: the swing web is let go first); ground / wall / zip / perch: ignored
      // (a press up to 0.25 s early is buffered until the cooldown ends)
      s.quickBuf = I.quickPressed ? 0.25 : Math.max(0, (s.quickBuf || 0) - dt);
      if (
        s.quickBuf > 0 &&
        !s.kin &&
        (s.mode === "air" || s.mode === "swing") &&
        s.clock - s.quick.last >= QUICK.cd
      ) {
        s.quickBuf = 0;
        quickBoostStart();
      }
      stepQuickBoost(dt);
      const n = Math.max(1, Math.ceil(dt / (1 / 120))),
        h = dt / n;
      for (let i = 0; i < n; i++) {
        const pre = s.mode;
        if (s.kin && s.kin.type === "ledge") stepLedge(h);
        else if (s.kin && s.kin.type === "wallHop") stepWallHop(h);
        else if (s.kin && s.mode !== "zip") stepKin(h);
        else if (s.mode === "ground") stepGround(h, I);
        else if (s.mode === "air") stepAir(h, I);
        else if (s.mode === "swing") stepSwing(h, I);
        else if (s.mode === "wall") stepWall(h, I);
        else if (s.mode === "zip") stepZip(h, I);
        else if (s.mode === "perch") stepPerch(h, I);
        else if (s.mode === "rope") stepRope(h, I);
        if (i === 0 || s.mode !== pre) {
          I.jumpPressed = false;
          I.swingPressed = false;
          I.dropPressed = false;
          I.slingL = false;
          I.slingR = false;
        }
      }
      ropesTick(dt);
      if (s.sling.active && s.mode !== "ground") slingEnd(false); // left the ground some other way (zip, fall): webs drop
      // user r9w: wall zip cut short (wall jump / roof hop / fell off): its web drops
      if (s.wall.zipWeb && s.sub !== "wallZip") {
        s.wall.zipWeb = false;
        if (s.mode !== "swing" && s.mode !== "zip")
          web.releaseSnap ? web.releaseSnap(0.3) : web.release();
      }
      dynamicCollide(dt);
      // (bridges r1) bridge halfway limit (once per yank; re-armed 0.6 s later or when he lands short of it again)
      if (
        world.bridgeLimit &&
        s.clock - (s.bridgeBT ?? -9) > 0.6 &&
        !(s.mode === "air" && s.returnT > 0)
      ) {
        const L = world.bridgeLimit(s.pos.x, s.pos.y, s.pos.z);
        if (L) bridgeBounce(L);
      }
      // position-delta guard (debug): nothing but teleport may move the body faster than its speed allows
      {
        const d = s.pos.distanceTo(guardP),
          lim = Math.max(4, s.vel.length() * dt * 2.5 + 1.5);
        if (guardOk && d > lim)
          console.warn(
            `[traversal] position jump ${d.toFixed(1)} m in ${(dt * 1000).toFixed(0)} ms (${s.mode}/${s.sub})`,
          );
        guardP.copy(s.pos);
        guardOk = true;
      }
      // safety net: never below the terrain / inside a building
      const g = world.groundHeight(s.pos.x, s.pos.z, s.pos.y - H + 0.3);
      if (s.pos.y - H < g - 0.05 && s.mode !== "wall" && s.mode !== "rope") {
        s.pos.y = g + H;
        if (s.vel.y < 0) s.vel.y = 0;
        if (s.mode === "air") land(g, I);
      }
      if (
        collider &&
        s.mode !== "zip" &&
        s.mode !== "wall" &&
        s.mode !== "rope" &&
        collider.inside(_v.set(s.pos.x, s.pos.y + 0.3, s.pos.z))
      ) {
        // resolved inside a solid: pop on top
        // pop UP only onto a surface within reach of the current height (never skip overhangs / snap onto a roof 30 m
        // up); otherwise leave it to the horizontal push-out next substep
        const fy0 = s.pos.y - H,
          top = world.groundHeight(s.pos.x, s.pos.z, fy0 + 1.2);
        const okUp =
          top > fy0 - 0.3 &&
          top - fy0 < 1.2 &&
          !collider.inside(_v.set(s.pos.x, top + 0.35, s.pos.z));
        if (okUp) s.pos.y = top + H;
        else {
          const c = collide(STEP, R + 0.05);
          if (!c) {
            /* resolved sideways */
          }
        }
        if (okUp || !collider.inside(_v.set(s.pos.x, s.pos.y + 0.3, s.pos.z))) {
          // a held web is never dropped by the safety net: keep swinging from on top (only vertical speed is removed)
          if (s.mode === "swing") {
            if (s.vel.y < 0) s.vel.y = 0;
          } else if (okUp) {
            s.vel.set(0, 0, 0);
            web.release();
            enterGround("idle");
          }
        }
      }
      try {
        world.setPlayerState?.(_v.set(s.pos.x, s.pos.y - H, s.pos.z), s.vel);
      } catch (e) {
        /* city-side */
      }
      s.grounded =
        s.mode === "ground" || s.mode === "perch" || s.mode === "rope";
      if (s.mode === "ground") s.dashCount = 0;
      const q = orient(dt);
      cam.getLookDir?.(s.lookDir);
      writeAnim(anim, s, q);
      anim.rootPos.copy(rootPos);
      return q;
    },
    teleport(p, yaw = 0) {
      guardOk = false;
      s.pos.copy(p);
      const f = floorAt(p.x, p.z, p.y);
      if (s.pos.y < f + H) s.pos.y = f + H;
      leaveSwingOK = true;
      s.vel.set(0, 0, 0);
      s.kin = null;
      web.release();
      if (s.sling.active) slingEnd(false);
      s.facing = yaw;
      s.speed = 0;
      s.stepOff = 0;
      s.trick = null;
      s.dive = false;
      s.charging = false;
      if (s.pos.y - H - f < 0.05) enterGround("idle");
      else {
        setMode("air", "fall");
        s.airT = 0;
        s.apexY = feetY();
      }
      leaveSwingOK = false;
      s.bodyQ.setFromAxisAngle(UP, yaw);
    },
    // progression hook: {releaseBoost: multiplier} (skill 'Slingshot Swing'); null/undefined keys fall back to ctx.params
    setStats(o = {}) {
      Object.assign(stats, o);
    },
    // knocked off the web tightrope (a combat hit); no-op off the line
    ropeFall() {
      if (s.mode === "rope" && s.rope) ropeOff("knock");
    },
    // combat hand-off: a scripted move ends in the air — continue as a normal ballistic fall with this velocity
    // (momentum kept: flying-kick rebound, air-combo drop), landing handled by traversal
    toAir(vel) {
      s.kin = null;
      s.vel.copy(vel);
      s.grounded = false;
      s.airT = 0;
      s.apexY = feetY();
      s.coyote = 0;
      setMode("air", vel.y > 0.5 ? "rise" : "fall");
    },
    // debug / tests
    forceZip(t) {
      startZip(t);
    },
    forceRope(t) {
      if (s.mode !== "perch") return false;
      return ropeTry(t || targeting.best);
    },
    perchAt(pos, normal, kind = "roofEdge") {
      startZip({ pos, normal, kind });
      s.kin = null;
      s.zip.p2
        .copy(pos)
        .addScaledVector(_v.set(normal.x, 0, normal.z).normalize(), -0.12);
      s.zip.p2.y += H;
      arriveZip();
    },
  };
  return api;
}
