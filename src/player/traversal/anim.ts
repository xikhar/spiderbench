// @ts-nocheck
// C1 contract: `player.anim`, written by traversal every frame, read by the animation layer.
// {
//   mode: 'ground'|'air'|'swing'|'zip'|'perch'|'wall'|'rope'|'land'|'combat',
//   sub:  ground: idle | walk | run | sprint | jumpCharge | vault | slingshot (web slingshot, see anim.sling)
//         land:   landLight | landMedium | landHard | landRoll          (mode 'land' while a landing recovery plays)
//         air:    jumpLaunch | rise | apex | fall | dive | release | trick | pointLaunch | wallJump | zipPull (air web-dash)
//         swing:  swingLow (back part of the arc, dropping in) | swingBottom | swingHigh (rising front part)
//                 | swingSlack (web slack: over the top / free fall inside the circle) | wallKick (held swing skipping off a facade)
//         zip:    zipFire (both arms snap forward, TWO webs fire, one per hand; ~0.05 s, instant — user r10) | zipFlight
//                 (launch at once: burst to a 40-72 m/s peak, body streamlined along the path, zip.t 0..1 = time fraction;
//                 webs snap off at zip.t 0.25, zip.webs false after) | zipCatch (braking phase, last ~0.15-0.3 s: body
//                 swings upright, feet forward to catch the perch) -> perch/perchLand. (zipYank is no longer used.)
//         perch:  perchLand | perchIdle | perchStand (standing on the point at either end of a web tightrope, no crouch)
//         rope:   web tightrope (T while perched): ropeShoot (arm up + point, web flies to the target, the hand pins the
//                 near end at the perch point; times in rope.fireT / hitT / pinT, s since T) -> ropeStand (ROPE.STAND
//                 0.5 s up from the perch crouch onto the line) -> ropeIdle | ropeWalk | ropeTurn (180 on the line)
//         wall:   crawl | wallRun (vertical) | wallRunSide | cornerWrap | ledgeGrab (0.27 s) -> ledgeClimb (clip
//                 ledgeClimbFlip 1.0 s when fast / from a wall-run, ledgeClimbQuick 0.5 s when crawling; anim.ledge =
//                 {active, point (lip top, world), inward (unit), variant 'flip'|'quick', t (s since grab), phase 'grab'|'climb'};
//                 the capsule follows the clips' root displacement: hang origin 0.30 m off the wall with feet 1.95 m under
//                 the lip -> +1.95 m up, +0.70/+0.62 m inward) | vault (legacy)
//   t: seconds in the current sub-state, modeT: seconds in the current mode,
//   speed (m/s), velocity: Vector3, grounded, jumpCharge 0..1,
//   swing: {phase -1..1 (back..front), bank -1..1, tension 0..1, anchor: Vector3, hand: 'L'|'R', ropeLength},
//   zip.pitch: flight elevation (rad, +up) = asin(v.y/|v|) -> blend zipFlight (object up along velocity) <-> zipFlightLevel;
//   zip.dir: unit flight direction.
//   perch.point: EXACT perch top-surface point (feet contact, world) — IK the balls of the feet / hands onto it;
//   perch.impact: arrival velocity of the zip (world, m/s) — absorb it in perchLand (knees/hips give, small slide);
//   perch.up: surface normal at the contact (world up for tops/edges); perch.edge: horizontal edge direction (for roof
//   edges/ledges; the lip runs along it); perch.radius: approx half-width of a small top (lamp globe/mast), 0 = long edge
//   zip: {target: Vector3, t: 0..1 (flight progress; 0 during fire/yank), dash: boolean, phase: 'fire'|'yank'|'flight'|'catch'|'',
//         webs: boolean (strands attached), taut 0..1 (yank load), anchorL/anchorR: Vector3 (per-hand web ends), launchDir: Vector3}, perch: {normal: Vector3, kind},
//   wall: {normal: Vector3, move: Vector2 (x right, y up; -1..1), fast: boolean, phase (crawl cycle, cycles),
//          dist: capsule centre (player.position) -> EFFECTIVE wall plane along -normal (m; the most protruding facade
//                surface over the body extent — use this instead of raycasting from the centre, feet must sit ON it),
//          point: Vector3 on the effective wall plane at body-centre height,
//          runK 0..1: wall-run blend (1 = run cycle rotated onto the wall: bodyQ up = wall normal, forward = run dir,
//                rootPos = feet on the wall plane; 0 = crawl frame: bodyQ forward = -normal, rootPos 0.30 m off the plane)},
//   swing.angle: rope angle from straight down (rad; +pi/2 = level in front = end of the full arc, no auto-release: may exceed pi/2 while held)
//   swing.slack 0..1 (web slack, body free-falling while still attached), swing.kick 0..1 (wall-skip pose weight)
//   landing: {severity 0..1}, trick: 'layout'|'corkscrew'|'tuckFlip'|'scissor'|null (swing-release / double-tap air
//            tricks; never a tucked ball), trickSide: +1/-1 (layout: front/back flip; corkscrew: to his right/left),
//   lookDir: Vector3 (camera forward),
//   // extras for the animation layer:
//   balance: boolean (walking/standing on a narrow coping / parapet top: feet on a line, arms out),
//   facing (yaw rad), dive: boolean (true also while gliding), glide: boolean (RMB held, no anchor: web-assisted glide-dive), bodyQ: Quaternion (root orientation incl. bank/pitch), rootPos: Vector3 (feet),
//   fromMode: previous mode (for transition blends), stepOffset (curb step smoothing, m)
//   sling: web slingshot (mode 'ground', sub 'slingshot' while Ctrl is held on the ground):
//          {active, tension 0..1 (pull back / max ~2.8 m), anchors: [{p: Vector3, n: Vector3, side: -1 L | +1 R, t: age s}],
//           dir: unit horizontal launch direction (toward the anchors), moving: -1..1 (+ = stepping back, - = easing forward),
//           nL / nR: webs per side, release: -1 | 0..1 (Ctrl let go with tension > 0.2: 0.12 s push-off wind-up, still on
//           the ground with the webs attached; at 1 -> air/pointLaunch at 40 deg)}.
//   quick: quick web boost (Q / L1 in the air; mode stays 'air' with the normal rise/apex/fall subs — NO zip flight):
//          {active, t (s since the press), hand 'L'|'R' (the web hand), anchor: Vector3 (web end, world), hitT (s: web
//           reaches the anchor = yank + impulse moment), web (strand still attached; snaps off ~0.26 s after hitT), seq
//           (increments per press), k (chain strength 1 .. 0.55)} -> animator postQuickYank: one-arm reach + yank to chest.
//   rope: web tightrope strand (traversal/rope.ts; ropePoint(anim.rope, u) gives the strand point, dip included):
//          {active (mode 'rope'), a / b: Vector3 anchors (start perch point / target), u 0..1 (his feet), len, lenH
//           (horizontal A-B), sag, dip, loadU (point-load shape), face +1 walks / faces toward b, -1 toward a,
//           speed (m/s along the line, >= 0), lean -1..1 (A / D sway), t (s since T), fireT / hitT / pinT, fromStand}
// }
import * as THREE from "three";

const UPV = new THREE.Vector3(0, 1, 0),
  XV = new THREE.Vector3(1, 0, 0);
export function makeAnim() {
  return {
    mode: "ground",
    sub: "idle",
    t: 0,
    modeT: 0,
    speed: 0,
    velocity: new THREE.Vector3(),
    grounded: true,
    jumpCharge: 0,
    swing: {
      phase: 0,
      bank: 0,
      tension: 0,
      anchor: new THREE.Vector3(),
      hand: "R",
      ropeLength: 0,
      angle: 0,
      slack: 0,
      kick: 0,
    },
    zip: {
      target: new THREE.Vector3(),
      t: 0,
      dash: false,
      phase: "",
      webs: false,
      taut: 0,
      anchorL: new THREE.Vector3(),
      anchorR: new THREE.Vector3(),
      launchDir: new THREE.Vector3(),
      pitch: 0,
      dir: new THREE.Vector3(0, 0, 1),
    },
    perch: {
      normal: new THREE.Vector3(0, 0, 1),
      kind: "roofEdge",
      point: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      edge: new THREE.Vector3(1, 0, 0),
      radius: 0,
      impact: new THREE.Vector3(),
    },
    wall: {
      normal: new THREE.Vector3(0, 0, 1),
      move: new THREE.Vector2(),
      fast: false,
      phase: 0,
      dist: 0.38,
      point: new THREE.Vector3(),
      runK: 0,
    },
    ledge: {
      active: false,
      point: new THREE.Vector3(),
      inward: new THREE.Vector3(0, 0, 1),
      variant: "flip",
      t: 0,
      phase: "",
    },
    landing: { severity: 0 },
    trick: null,
    trickSide: 1,
    lookDir: new THREE.Vector3(0, 0, 1),
    facing: 0,
    dive: false,
    bodyQ: new THREE.Quaternion(),
    rootPos: new THREE.Vector3(),
    fromMode: "ground",
    stepOffset: 0,
    sling: {
      active: false,
      tension: 0,
      anchors: [],
      dir: new THREE.Vector3(0, 0, 1),
      moving: 0,
      nL: 0,
      nR: 0,
      release: -1,
    },
    quick: {
      active: false,
      t: 0,
      hand: "R",
      anchor: new THREE.Vector3(),
      hitT: 0.08,
      web: false,
      seq: 0,
      k: 1,
    },
    rope: {
      active: false,
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      u: 0,
      len: 1,
      lenH: 1,
      sag: 0,
      dip: 0,
      loadU: 0,
      face: 1,
      speed: 0,
      lean: 0,
      t: 0,
      fireT: 0.14,
      hitT: 0.3,
      pinT: 0.45,
      fromStand: false,
    },
  };
}

export function writeAnim(a, s, q) {
  let mode = s.mode;
  if (mode === "ground" && s.sub.startsWith("land")) mode = "land";
  if (s.sub === "vault" && s.kin && s.kin.fromWall) mode = "wall";
  if (mode !== a.mode) a.fromMode = a.mode;
  a.mode = mode;
  a.sub = s.sub;
  a.t = s.subT;
  a.modeT = s.modeT;
  a.velocity.copy(s.vel);
  a.speed = mode === "ground" || mode === "land" ? s.speed : s.vel.length();
  a.grounded = s.grounded;
  a.jumpCharge = s.charging || s.sub === "jumpLaunch" ? s.jumpCharge : 0;
  const S = s.swing;
  a.swing.phase = S.phase;
  a.swing.bank = S.bank;
  a.swing.tension = s.mode === "swing" ? S.tension : 0;
  a.swing.anchor.copy(S.anchor);
  a.swing.hand = S.hand;
  a.swing.ropeLength = S.rope;
  a.swing.angle = s.mode === "swing" ? S.angle || 0 : 0;
  a.swing.slack = s.mode === "swing" ? S.slack || 0 : 0;
  a.swing.kick = s.mode === "swing" ? S.kick || 0 : 0;
  a.zip.target.copy(s.zip.target);
  a.zip.t = s.mode === "zip" ? s.zip.t : 0;
  a.zip.dash = !!s.zip.dash && s.sub === "zipPull" && s.mode === "air";
  {
    const Z = s.zip,
      zm = s.mode === "zip";
    a.zip.phase = zm
      ? {
          zipFire: "fire",
          zipYank: "yank",
          zipFlight: "flight",
          zipCatch: "catch",
        }[s.sub] || ""
      : "";
    a.zip.webs = zm && !!Z.webs;
    a.zip.taut = zm ? Z.taut || 0 : 0;
    if (Z.anchorL) a.zip.anchorL.copy(Z.anchorL);
    if (Z.anchorR) a.zip.anchorR.copy(Z.anchorR);
    if (Z.launchDir) a.zip.launchDir.copy(Z.launchDir);
  }
  a.zip.pitch = s.mode === "zip" ? s.zip.pitch || 0 : 0;
  if (s.zip.flightDir) a.zip.dir.copy(s.zip.flightDir);
  a.perch.normal.copy(s.perch.normal);
  a.perch.kind = s.perch.kind;
  a.perch.point.copy(s.perch.pos);
  a.perch.up.copy(s.perch.up || UPV);
  a.perch.edge.copy(s.perch.edge || XV);
  a.perch.radius = s.perch.radius || 0;
  if (s.perch.impact) a.perch.impact.copy(s.perch.impact);
  a.wall.normal.copy(s.wall.normal);
  a.wall.move.copy(s.wall.move);
  a.wall.fast = s.wall.fast;
  a.wall.phase = s.wall.phase;
  a.wall.dist = s.wall.dist;
  a.wall.point.copy(s.wall.point);
  a.wall.runK = mode === "wall" ? s.wall.runK : 0;
  {
    const k = s.kin,
      L = a.ledge;
    L.active = !!(k && k.type === "ledge");
    if (L.active) {
      L.point.copy(k.lip);
      L.inward.copy(k.inward);
      L.variant = k.variant;
      L.t = k.t;
      L.phase = k.t < k.grab ? "grab" : "climb";
    } else L.phase = "";
  }
  a.landing.severity = s.landing.severity;
  a.trick = s.trick;
  a.trickSide = s.trickSide ?? 1;
  a.lookDir.copy(s.lookDir);
  {
    const S = s.sling,
      o = a.sling;
    o.active = !!S.active;
    o.tension = S.active ? S.tension : 0;
    o.anchors = S.anchors;
    o.dir.copy(S.dir);
    o.moving = S.active ? S.moving : 0;
    o.release = S.active && S.rel >= 0 ? Math.min(1, S.rel / 0.12) : -1;
    o.nL = 0;
    o.nR = 0;
    for (const x of S.anchors) {
      if (x.side < 0) o.nL++;
      else o.nR++;
    }
  }
  {
    const Q = s.quick,
      o = a.quick;
    o.active = Q.active;
    o.t = Q.t;
    o.hand = Q.hand;
    o.anchor.copy(Q.anchor);
    o.hitT = Q.hitT;
    o.web = Q.webOn;
    o.seq = Q.seq;
    o.k = Q.k;
  }
  {
    const R = s.rope,
      o = a.rope;
    o.active = !!R && s.mode === "rope";
    if (R) {
      o.a.copy(R.a);
      o.b.copy(R.b);
      o.u = R.u;
      o.len = R.len;
      o.lenH = R.lenH;
      o.sag = R.sag;
      o.dip = R.dip;
      o.loadU = R.loadU;
      o.face = R.face;
      o.speed = Math.abs(R.v);
      o.lean = R.lean;
      o.t = R.t;
      o.fireT = R.fireT;
      o.hitT = R.hitT;
      o.pinT = R.pinT;
      o.fromStand = R.fromStand;
    } else {
      o.speed = 0;
      o.lean = 0;
      o.dip = 0;
      o.sag = 0;
    }
  }
  a.walkK = mode === "ground" ? s.walkK || 0 : 0; // user r12: Shift-walk blend 0..1 (camera / animator)
  a.balance = !!s.balance && s.mode === "ground";
  a.facing = s.facing;
  a.dive = s.dive || !!s.gliding;
  a.glide = !!s.gliding;
  a.bodyQ.copy(q);
  a.stepOffset = s.stepOff;
  return a;
}
