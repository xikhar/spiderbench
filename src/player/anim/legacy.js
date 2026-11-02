// OWNER: animation agent.
// Shim: derive a C1 `player.anim` object from the pre-C1 player.state (old src/player/player.js), so the new
// animation layer runs even before traversal publishes player.anim. Once player.anim exists it is used instead.
import * as THREE from "three";

export function legacyAnim(p, cache) {
  const s = p.state;
  if (!s) return null;
  const A =
    cache.anim ||
    (cache.anim = {
      velocity: new THREE.Vector3(),
      lookDir: new THREE.Vector3(0, 0, 1),
      swing: {
        phase: 0,
        bank: 0,
        tension: 1,
        anchor: new THREE.Vector3(),
        hand: "R",
      },
      zip: { target: new THREE.Vector3(), t: 0 },
      perch: { normal: new THREE.Vector3(0, 1, 0), kind: "roofEdge" },
      wall: {
        normal: new THREE.Vector3(0, 0, 1),
        move: new THREE.Vector2(),
        fast: false,
      },
      landing: { severity: 0 },
      trick: null,
      t: 0,
    });
  const hv = Math.hypot(s.vel.x, s.vel.z);
  A.velocity.copy(s.vel);
  A.speed = s.vel.length();
  A.grounded = s.state === "ground";
  const cam = window.__ctx?.camera;
  if (cam) cam.getWorldDirection(A.lookDir);
  let mode = s.state,
    sub = "";
  if (mode === "ground") {
    if (s.landT > 0) {
      mode = "land";
      sub = s.landT > 0.35 ? "landHard" : "landMedium";
      A.landing.severity = Math.min(1, s.landT * 2);
    } else
      sub = hv < 0.6 ? "idle" : s.sprint ? "sprint" : hv < 3 ? "walk" : "run";
  } else if (mode === "air") {
    sub = s.vel.y > 2 ? "rise" : s.vel.y < -2 ? "fall" : "apex";
    if (s.stateT < 0.05 && cache.prev === "swing") sub = "release";
  } else if (mode === "swing") {
    A.swing.phase = s.swingPhase ?? 0;
    A.swing.anchor.copy(s.anchor);
    A.swing.tension = 1;
    // bank: lateral steering vs travel
    const f = new THREE.Vector3(s.vel.x, 0, s.vel.z).normalize(),
      r = new THREE.Vector3(f.z, 0, -f.x);
    const inp = window.__ctx?.input?.state?.move;
    A.swing.bank = inp ? THREE.MathUtils.clamp(-inp.x * 0.8, -1, 1) : 0;
    sub =
      A.swing.phase < -0.33
        ? "swingLow"
        : A.swing.phase > 0.33
          ? "swingHigh"
          : "swingBottom";
  } else if (mode === "wall") {
    A.wall.normal.copy(s.wallNormal);
    const v = s.vel.length();
    A.wall.fast = v > 6;
    sub = (s.wallRunV || 0) > 2 && v > 8 ? "wallRun" : "crawl";
    A.wall.move.set(v > 0.2 ? 1 : 0, 0);
  } else if (mode === "zip") {
    A.zip.target.copy(s.zipTarget);
    A.zip.t = Math.min(1, s.stateT / 0.7);
    sub = "zipPull";
  }
  // trick after a release / wall jump (old player uses trickT)
  if (mode === "air" && s.trickT < 0.05 && !cache.trickOn) {
    cache.trickOn = true;
    cache.trickName = ["flip", "corkscrew", "flip", "backflip"][
      (cache.n = (cache.n || 0) + 1) % 4
    ];
  }
  if (s.trickT > 0.8 || mode !== "air") cache.trickOn = false;
  A.trick = cache.trickOn ? cache.trickName : null;
  if (mode !== cache.prev || sub !== cache.prevSub) A.t = 0;
  else A.t += 1 / 60;
  cache.prev = mode;
  cache.prevSub = sub;
  A.mode = mode;
  A.sub = sub;
  return A;
}
