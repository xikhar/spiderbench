/**
 * Predefined cinematic camera and character pose shots for development and capture workflows.
 *
 * @module devtools-shots
 * @version 1.0.0
 * @file src/devtools/shots.ts
 * @since 0.0.1
 * @description Exports SHOTS definitions that position the camera and player for specific scenarios (street, wall, swing, climb, suit, etc.) and apply per-frame tuning during shot playback.
 */

import * as THREE from "three";
import { POSES } from "@/player/rig.ts";

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const vec = (v: any): THREE.Vector3 | null =>
    v == null
        ? null
        : v.isVector3
          ? v.clone()
          : Array.isArray(v)
            ? V3(v[0], v[1], v[2])
            : V3(v.x, v.y, v.z);
const UP = V3(0, 1, 0);

function vp(world: any, name: string) {
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

function avenueDir(world: any, p: THREE.Vector3, h = 2) {
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

function findWall(
    world: any,
    p: THREE.Vector3,
    y: number,
    {
        minRoof = 0,
        prefer = null,
    }: { minRoof?: number; prefer?: THREE.Vector3 | null } = {},
) {
    let best: any = null;
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
        const score = -hit.distance + (prefer ? d.dot(prefer) * 60 : 0);
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
function placeCam(
    camera: THREE.PerspectiveCamera,
    pos: THREE.Vector3,
    target: THREE.Vector3,
    fov: number,
    roll = 0,
) {
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    if (roll) camera.rotateZ(roll);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    (window as any).__ctx?.pipeline?.resetHistory?.();
}
const pipe = (ctx: any) =>
    ctx.pipeline || (window as any).__ctx?.pipeline || {};

const S: Record<string, any> = {};
const tune: Record<string, any> = {};
if (typeof window !== "undefined") (window as any).__shotTune = tune;
const T = (name: string, key: string, def: any) =>
    tune[name] && tune[name][key] !== undefined ? tune[name][key] : def;

S.street = {
    frames: 90,
    apply(ctx: any) {
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
    tick(ctx: any, dt: number) {
        ctx.player.shotTick(dt);
        pipe(ctx).setMotionBlur?.(0);
        pipe(ctx).setFocus?.(3.2);
    },
};

S.wall = {
    frames: 90,
    apply(ctx: any) {
        const { world, player, camera } = ctx;
        const v = vp(world, "wall");
        let P: THREE.Vector3,
            n: THREE.Vector3,
            look: THREE.Vector3 | null | undefined;
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
        const t = V3().crossVectors(UP, n).normalize();

        const side = look ? Math.sign(look.dot(t)) || 1 : 1;
        const along = t.clone().multiplyScalar(side);

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
        placeCam(
            camera,
            cam,
            tgt,
            T("wall", "fov", 54),
            T("wall", "roll", -0.03),
        );
        ctx.hud.setVisible(false);
    },
    tick(ctx: any, dt: number) {
        ctx.player.shotTick(dt);
        const p = pipe(ctx);
        p.setMotionBlur?.(0);
        p.setFocus?.(ctx.camera.position.distanceTo(ctx.player.position));
        p.setAperture?.(T("wall", "aperture", 0));
    },
};

function swingPose(
    ctx: any,
    { feet, anchor, anchorN, vel, phase, pose, frame, proc }: any,
) {
    const up = anchor.clone().sub(feet).normalize();

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
function findAnchor(world: any, from: THREE.Vector3, dirs: THREE.Vector3[]) {
    for (const d of dirs) {
        const h = world.raycast(from, d.clone().normalize(), 220);
        if (h && h.point.y > from.y + 10 && Math.abs(h.normal.y) < 0.5)
            return h;
    }
    return null;
}

S.swing = {
    frames: 100,
    apply(ctx: any) {
        const { world, _player: _player, camera } = ctx;
        const v = vp(world, "swing");
        let body: THREE.Vector3, view: THREE.Vector3;
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
    tick(ctx: any, dt: number) {
        ctx.player.shotTick(dt);
        const p = pipe(ctx);
        p.setMotionBlur?.(0.15);
        p.setFocus?.(ctx.camera.position.distanceTo(ctx.player.position));
        p.setAperture?.(T("swing", "aperture", 9));
        p.setDofFar?.(0.3);
    },
};

S.swingBack = {
    frames: 100,
    _vel: null as THREE.Vector3 | null,
    apply(ctx: any) {
        const { world, _player: _player, camera } = ctx;
        const v = vp(world, "swingBack");
        let body: THREE.Vector3, dir: THREE.Vector3;
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
        body.y += T("swingBack", "lift", 9);
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
    tick(ctx: any, dt: number) {
        ctx.player.shotTick(dt);
        const p = pipe(ctx);
        p.setMotionBlur?.(T("swingBack", "blur", 0.8), {
            cameraVelocity: S.swingBack._vel?.clone(),
        });
        p.setFocus?.(ctx.camera.position.distanceTo(ctx.player.position));
        p.setAperture?.(0);
    },
};

S.climb = {
    frames: 100,
    apply(ctx: any) {
        const { world, player, camera } = ctx;
        const v = vp(world, "climb");
        let P: THREE.Vector3, n: THREE.Vector3;
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
        placeCam(
            camera,
            cam,
            tgt,
            T("climb", "fov", 62),
            T("climb", "roll", 0.0),
        );
        ctx.hud.setVisible(true);

        ctx.hud.setObjective?.(
            camera.position
                .clone()
                .addScaledVector(t, 260)
                .addScaledVector(n, 160)
                .add(V3(0, -60, 0)),
        );
    },
    tick(ctx: any, dt: number) {
        ctx.player.shotTick(dt);
        pipe(ctx).setMotionBlur?.(0);
        pipe(ctx).setFocus?.(3);
        pipe(ctx).setAperture?.(0);
    },
};

S.suit = {
    frames: 90,
    apply(ctx: any) {
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
    tick(ctx: any, dt: number) {
        ctx.player.shotTick(dt);
        pipe(ctx).setMotionBlur?.(0);
        pipe(ctx).setFocus?.(1.4);
        pipe(ctx).setAperture?.(0);
    },
};

export const SHOTS = S;
if (typeof window !== "undefined") (window as any).__SHOTS = S;
