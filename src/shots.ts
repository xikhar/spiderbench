// @ts-nocheck
// Deterministic compositions mirroring refs/1..5. OWNER: gameplay agent (poses) — keep names stable.
// street   -> refs/1.webp  third-person from behind, standing mid-street at crosswalk, eye level, long avenue vista
// wall     -> refs/2.webp  close-up of Spidey perched on a glass/stone building column with reflection, park & avenue below
// swing    -> refs/3.webp  mid-distance, Spidey swinging on a web line between mid-rise brick buildings, intersection below, DOF
// swingBack-> refs/4.webp  chase camera behind/above Spidey mid-swing along a busy avenue, motion blur
// climb    -> refs/5.webp  wall-crawling on a glass curtain-wall skyscraper, reflections of sky/river, HUD minimap
//
// Uses world.viewpoints[name] when the city provides it (camera-centric format):
//   { pos: camera position, target: camera look-at, subject?: Spidey position, anchor?: wall contact point, normal?: wall normal }
// Otherwise a composition is derived from world raycasts around world.spawn.
import * as THREE from "three";
import { POSES, makePose } from "./player/rig.ts";

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const vec = (v) =>
  v == null
    ? null
    : v.isVector3
      ? v.clone()
      : Array.isArray(v)
        ? V3(v[0], v[1], v[2])
        : V3(v.x, v.y, v.z);
const UP = V3(0, 1, 0);

function vp(world, name) {
  const v = world.viewpoints?.[name];
  if (!v) return null;
  const cam = vec(v.pos ?? v.camera?.pos ?? v.position),
    target = vec(v.target ?? v.camera?.target ?? v.lookAt);
  const dir = cam && target ? target.clone().sub(cam).normalize() : null;
  return {
    cam,
    target,
    dir,
    subject: vec(v.subject),
    anchor: vec(v.anchor),
    normal: vec(v.normal ?? v.wallNormal),
    raw: v,
  };
}

// longest clear horizontal direction from p (avenue direction)
function avenueDir(world, p, h = 2) {
  let best = V3(0, 0, -1),
    bestD = -1;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2,
      d = V3(Math.sin(a), 0, Math.cos(a));
    const hit = world.raycast(V3(p.x, p.y + h, p.z), d, 1500);
    const dist = hit ? hit.distance : 1500;
    if (dist > bestD + 1) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}
// find a building wall near p at height y: returns {point, normal, roof}
function findWall(world, p, y, { minRoof = 0, prefer = null } = {}) {
  let best = null;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2,
      d = V3(Math.sin(a), 0, Math.cos(a));
    const o = V3(p.x, y, p.z);
    const hit = world.raycast(o, d, 400);
    if (!hit || Math.abs(hit.normal.y) > 0.3) continue;
    const top = world.raycast(
      V3(hit.point.x - hit.normal.x, 900, hit.point.z - hit.normal.z),
      V3(0, -1, 0),
      900,
    );
    const roof = top ? top.point.y : y;
    if (roof < minRoof) continue;
    let score = -hit.distance + (prefer ? d.dot(prefer) * 60 : 0);
    if (!best || score > best.score)
      best = {
        point: hit.point.clone(),
        normal: hit.normal.clone().setY(0).normalize(),
        roof,
        score,
      };
  }
  return best;
}
function placeCam(camera, pos, target, fov, roll = 0) {
  camera.position.copy(pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  if (roll) camera.rotateZ(roll);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  window.__ctx?.pipeline?.resetHistory?.();
}
const pipe = (ctx) => ctx.pipeline || window.__ctx?.pipeline || {};
function orient(forward, up) {
  const z = forward.clone().addScaledVector(up, -forward.dot(up)).normalize();
  const x = V3().crossVectors(up, z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(x, up.clone().normalize(), z),
  );
}

// ---------------------------------------------------------------------------------------------
export type ShotDefinition = {
  frames?: number;
  apply: (ctx: any) => void;
  tick?: (ctx: any, dt: number, frame: number) => void;
};

const S: Record<string, ShotDefinition> = {};
const tune = {}; // live-tweakable offsets: window.__shotTune.<name> = {...} (debug only)
if (typeof window !== "undefined") window.__shotTune = tune;
const T = (name, key, def) =>
  tune[name] && tune[name][key] !== undefined ? tune[name][key] : def;

// ref 1: behind Spidey standing idle on a crosswalk, eye-level, long avenue vista
S.street = {
  frames: 90,
  apply(ctx) {
    const { world, player, camera } = ctx;
    const v = vp(world, "street");
    const feet = (v?.subject || world.spawn).clone();
    feet.y = world.groundHeight(feet.x, feet.z);
    const dir = (v?.dir ? v.dir.clone() : avenueDir(world, feet))
      .setY(0)
      .normalize();
    const right = V3().crossVectors(dir, UP).normalize();
    player.setPose({
      pos: feet,
      forward: dir,
      clip: "idle",
      clipTime: 0.25,
      pose: POSES.idle(0),
      forceProcedural: !player.rig.hasClip("idle"),
    });
    const back = T("street", "back", 3.05),
      h = T("street", "h", 1.42);
    const cam = feet
      .clone()
      .addScaledVector(dir, -back)
      .addScaledVector(right, T("street", "side", 0.05))
      .add(V3(0, h, 0));
    const tgt = feet
      .clone()
      .addScaledVector(dir, 10)
      .add(V3(0, T("street", "th", 0.45), 0));
    placeCam(camera, cam, tgt, T("street", "fov", 46));
    ctx.hud.setVisible(false);
  },
  tick(ctx, dt) {
    ctx.player.shotTick(dt);
    pipe(ctx).setMotionBlur?.(0);
    pipe(ctx).setFocus?.(3.2);
  },
};

// ref 2: close-up, perched on a building edge/column ~40 m up, glass beside him, park avenue below
S.wall = {
  frames: 90,
  apply(ctx) {
    const { world, player, camera } = ctx;
    const v = vp(world, "wall");
    let P, n, look;
    if (v?.anchor && v?.normal) {
      P = v.anchor;
      n = v.normal.setY(0).normalize();
      look = v.dir;
    } else {
      const w = findWall(world, world.spawn, 40, { minRoof: 55 }) || {
        point: world.spawn.clone().add(V3(0, 40, 0)),
        normal: V3(0, 0, 1),
      };
      P = w.point;
      n = w.normal;
    }
    const t = V3().crossVectors(UP, n).normalize(); // along the wall
    // camera looks mostly along the wall (wall recedes on one side), slightly down to the street
    const side = look ? Math.sign(look.dot(t)) || 1 : 1; // which way along the wall the camera looks
    const along = t.clone().multiplyScalar(side); // camera view direction along wall
    // Spidey: right side against the wall, chest facing out/back toward the camera
    const facing = n
      .clone()
      .multiplyScalar(T("wall", "fn", 0.55))
      .addScaledVector(along, -T("wall", "fa", 0.85))
      .normalize();
    const feet = P.clone()
      .addScaledVector(n, T("wall", "off", 0.42))
      .add(V3(0, -0.55, 0));
    player.setPose({
      pos: feet,
      forward: facing,
      clip: "wallPerch",
      clipTime: 0.3,
      pose: POSES.wallPerch(),
      forceProcedural: T("wall", "proc", false),
      state: "wall",
    });
    const cam = P.clone()
      .addScaledVector(n, T("wall", "cn", 2.0))
      .addScaledVector(along, -T("wall", "ca", 1.15))
      .add(V3(0, T("wall", "ch", 0.9), 0));
    const tgt = P.clone()
      .addScaledVector(n, T("wall", "tn", 0.3))
      .addScaledVector(along, T("wall", "ta", 1.5))
      .add(V3(0, T("wall", "th", 0.0), 0));
    placeCam(camera, cam, tgt, T("wall", "fov", 54), T("wall", "roll", -0.03));
    ctx.hud.setVisible(false);
  },
  tick(ctx, dt) {
    ctx.player.shotTick(dt);
    const p = pipe(ctx);
    p.setMotionBlur?.(0);
    p.setFocus?.(ctx.camera.position.distanceTo(ctx.player.position));
    p.setAperture?.(T("wall", "aperture", 0));
  },
};

// Swing shots: Spidey hangs from an anchor on a facade, body along the rope.
function swingPose(
  ctx,
  { feet, anchor, anchorN, vel, phase, pose, frame, proc },
) {
  const up = anchor.clone().sub(feet).normalize();
  // GLB swing clip keys: 0 back of arc, 18 bottom (tuck), 32 front, of 56 frames
  ctx.player.setPose({
    pos: feet,
    forward: vel.clone(),
    up,
    clip: "swing",
    clipTime: (frame ?? 18) / 56,
    pose: pose || POSES.swing(phase),
    forceProcedural: !!proc,
    anchor,
    anchorNormal: anchorN,
    state: "swing",
  });
}
function findAnchor(world, from, dirs) {
  for (const d of dirs) {
    const h = world.raycast(from, d.clone().normalize(), 220);
    if (h && h.point.y > from.y + 10 && Math.abs(h.normal.y) < 0.5) return h;
  }
  return null;
}

// ref 3: mid-distance, Spidey mid-swing in front of a brick facade across an intersection, DOF
S.swing = {
  frames: 100,
  apply(ctx) {
    const { world, player, camera } = ctx;
    const v = vp(world, "swing");
    let body, view;
    if (v?.subject && v?.dir) {
      body = v.subject.clone();
      view = v.dir.clone().setY(0).normalize();
    } else {
      const g = world.spawn.clone();
      g.y = world.groundHeight(g.x, g.z);
      view = avenueDir(world, g);
      body = g
        .clone()
        .addScaledVector(view, 30)
        .add(V3(0, 14, 0));
    }
    view.applyAxisAngle(UP, T("swing", "yaw", -0.4));
    const right = V3().crossVectors(view, UP).normalize();
    // web goes up and slightly right, away from camera toward the facade behind Spidey
    const hit = findAnchor(world, body, [
      view
        .clone()
        .multiplyScalar(0.55)
        .addScaledVector(right, 0.28)
        .add(V3(0, 1, 0)),
      view
        .clone()
        .multiplyScalar(0.8)
        .addScaledVector(right, 0.2)
        .add(V3(0, 1, 0)),
      view.clone().add(V3(0, 1.3, 0)),
    ]);
    const anchor = hit
      ? hit.point.clone()
      : body
          .clone()
          .addScaledVector(view, 20)
          .addScaledVector(right, 8)
          .add(V3(0, 40, 0));
    const anchorN = hit ? hit.normal.clone() : view.clone().negate();
    // swinging toward camera-left and slightly toward camera
    const vel = right
      .clone()
      .multiplyScalar(-14)
      .addScaledVector(view, -8)
      .add(V3(0, 3, 0));
    swingPose(ctx, {
      feet: body.clone().add(V3(0, -0.9, 0)),
      anchor,
      anchorN,
      vel,
      phase: 0.55,
      frame: T("swing", "frame", 20),
      proc: T("swing", "proc", false),
    });
    const dist = T("swing", "dist", 7.0);
    const cam = body
      .clone()
      .addScaledVector(view, -dist)
      .addScaledVector(right, T("swing", "side", 0.3))
      .add(V3(0, T("swing", "h", 1.0), 0));
    const tgt = body
      .clone()
      .add(V3(0, T("swing", "th", 0.9), 0))
      .addScaledVector(right, T("swing", "tside", 0.3));
    placeCam(camera, cam, tgt, T("swing", "fov", 46));
    ctx.hud.setVisible(false);
  },
  tick(ctx, dt) {
    ctx.player.shotTick(dt);
    const p = pipe(ctx);
    p.setMotionBlur?.(0.15);
    p.setFocus?.(ctx.camera.position.distanceTo(ctx.player.position));
    p.setAperture?.(T("swing", "aperture", 9));
    p.setDofFar?.(0.3); // ref 3: blurred foreground, crisp background
  },
};

// ref 4: chase cam behind & above mid-swing over a busy avenue, motion blur
S.swingBack = {
  frames: 100,
  apply(ctx) {
    const { world, player, camera } = ctx;
    const v = vp(world, "swingBack");
    let body, dir;
    if (v?.subject && v?.dir) {
      body = v.subject.clone();
      dir = v.dir.clone().setY(0).normalize();
    } else {
      const g = world.spawn.clone();
      g.y = world.groundHeight(g.x, g.z);
      dir = avenueDir(world, g);
      body = g
        .clone()
        .addScaledVector(dir, 25)
        .add(V3(0, 12, 0));
    }
    body.y += T("swingBack", "lift", 9); // keep the chase camera above the street-tree canopy (no foliage near the lens)
    const right = V3().crossVectors(dir, UP).normalize();
    const hit = findAnchor(world, body, [
      dir
        .clone()
        .multiplyScalar(0.45)
        .addScaledVector(right, 0.55)
        .add(V3(0, 1, 0)),
      dir
        .clone()
        .multiplyScalar(0.6)
        .addScaledVector(right, 0.8)
        .add(V3(0, 1, 0)),
      dir
        .clone()
        .multiplyScalar(0.3)
        .addScaledVector(right, 1)
        .add(V3(0, 1.2, 0)),
      dir
        .clone()
        .multiplyScalar(0.7)
        .add(V3(0, 1, 0)),
    ]);
    const anchor = hit
      ? hit.point.clone()
      : body
          .clone()
          .addScaledVector(dir, 14)
          .addScaledVector(right, 12)
          .add(V3(0, 40, 0));
    const anchorN = hit ? hit.normal.clone() : right.clone().negate();
    const vel = dir
      .clone()
      .multiplyScalar(24)
      .add(V3(0, -4, 0));
    swingPose(ctx, {
      feet: body.clone().add(V3(0, -0.9, 0)),
      anchor,
      anchorN,
      vel,
      phase: -0.2,
      pose: POSES.swingBackRef(),
      frame: T("swingBack", "frame", 4),
      proc: T("swingBack", "proc", true),
    });
    const cam = body
      .clone()
      .addScaledVector(dir, -T("swingBack", "back", 2.7))
      .addScaledVector(right, T("swingBack", "side", 0.75))
      .add(V3(0, T("swingBack", "h", 1.2), 0));
    const tgt = body
      .clone()
      .addScaledVector(dir, 12)
      .add(V3(0, T("swingBack", "th", -3.2), 0));
    placeCam(
      camera,
      cam,
      tgt,
      T("swingBack", "fov", 66),
      T("swingBack", "roll", 0.035),
    );
    ctx.hud.setVisible(false);
    S.swingBack._vel = vel;
  },
  tick(ctx, dt) {
    ctx.player.shotTick(dt);
    const p = pipe(ctx);
    p.setMotionBlur?.(T("swingBack", "blur", 0.8), {
      cameraVelocity: S.swingBack._vel?.clone(),
    });
    p.setFocus?.(ctx.camera.position.distanceTo(ctx.player.position));
    p.setAperture?.(0);
  },
};

// ref 5: behind Spidey crawling up a glass curtain wall high up, HUD on
S.climb = {
  frames: 100,
  apply(ctx) {
    const { world, player, camera } = ctx;
    const v = vp(world, "climb");
    let P, n;
    if (v?.anchor && v?.normal) {
      P = v.anchor;
      n = v.normal.setY(0).normalize();
    } else {
      const w = findWall(world, world.spawn, 60, { minRoof: 90 }) ||
        findWall(world, world.spawn, 30) || {
          point: world.spawn.clone().add(V3(0, 60, 0)),
          normal: V3(0, 0, 1),
        };
      P = w.point;
      n = w.normal;
    }
    const t = V3().crossVectors(UP, n).normalize();
    const feet = P.clone()
      .addScaledVector(n, T("climb", "off", 0.3))
      .add(V3(0, -0.95, 0));
    player.setPose({
      pos: feet,
      forward: n.clone().negate(),
      up: UP,
      clip: "wallCrawl",
      clipTime: 0.35,
      pose: POSES.climbRef(),
      forceProcedural: true,
      state: "wall",
    });
    player.state.wallNormal.copy(n);
    const cam = P.clone()
      .addScaledVector(n, T("climb", "cn", 2.9))
      .addScaledVector(t, T("climb", "ct", -1.1))
      .add(V3(0, T("climb", "ch", -0.2), 0));
    const tgt = P.clone()
      .addScaledVector(t, T("climb", "tt", 0.9))
      .add(V3(0, T("climb", "th", 0.7), 0));
    placeCam(camera, cam, tgt, T("climb", "fov", 62), T("climb", "roll", 0.0));
    ctx.hud.setVisible(true);
    // objective off to the left so the diamond indicator sits on the left edge (as in ref 5)
    ctx.hud.setObjective?.(
      camera.position
        .clone()
        .addScaledVector(t, 260)
        .addScaledVector(n, 160)
        .add(V3(0, -60, 0)),
    );
  },
  tick(ctx, dt) {
    ctx.player.shotTick(dt);
    pipe(ctx).setMotionBlur?.(0);
    pipe(ctx).setFocus?.(3);
    pipe(ctx).setAperture?.(0);
  },
};

// suit material close-up (user r-suitfabric): 3/4 front of Spidey standing on the street spawn, chest + head framed.
// Pair with ?tod= for the lighting presets: node tools/shot.mjs 'suit&tod=sunset' -> shots/suit_tod_sunset.png
S.suit = {
  frames: 90,
  apply(ctx) {
    const { world, player, camera } = ctx;
    const v = vp(world, "street");
    const feet = (v?.subject || world.spawn).clone();
    feet.y = world.groundHeight(feet.x, feet.z);
    const dir = (v?.dir ? v.dir.clone() : avenueDir(world, feet))
      .setY(0)
      .normalize();
    const right = V3().crossVectors(dir, UP).normalize();
    player.setPose({
      pos: feet,
      forward: dir,
      clip: "idle",
      clipTime: 0.25,
      pose: POSES.idle(0),
      forceProcedural: !player.rig.hasClip("idle"),
    });
    const cam = feet
      .clone()
      .addScaledVector(dir, T("suit", "fwd", 1.25))
      .addScaledVector(right, T("suit", "side", 0.55))
      .add(V3(0, T("suit", "h", 1.5), 0));
    const tgt = feet.clone().add(V3(0, T("suit", "th", 1.34), 0));
    placeCam(camera, cam, tgt, T("suit", "fov", 40));
    ctx.hud.setVisible(false);
  },
  tick(ctx, dt) {
    ctx.player.shotTick(dt);
    pipe(ctx).setMotionBlur?.(0);
    pipe(ctx).setFocus?.(1.4);
    pipe(ctx).setAperture?.(0);
  },
};

export const SHOTS: Record<string, ShotDefinition> = S;
if (typeof window !== "undefined") window.__SHOTS = S;
