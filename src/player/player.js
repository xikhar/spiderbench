// OWNER: traversal engineer.
// createPlayer({scene, world, camera, input, renderer}) -> Promise<player>
//   player = { update(dt), object, rig, web, cam, state, anim (C1), traversal, position, velocity, mode, heading,
//              setControlOverride(fn|null) (C5), setAnimator(a|null), teleport(p, yaw), setPose(o), shotTick(dt), applyShot(name) }
// Traversal lives in ./traversal/** (state machine, anchors, zip points, collision). This file wires input -> camera ->
// traversal -> animation -> web rendering, and owns a fallback animation driver that maps the C1 `anim` struct onto
// the GLB clips (used until / unless an animation layer registers itself).
//
// Controls: WASD move · mouse camera · RMB (hold) web-swing · Shift walk (ground) / wall-run · Space jump (hold = charge)
//           E / MMB web-zip to highlighted point (no target in air = web-dash) · C / Ctrl drop / dive.
//           Q / L1 (air or mid-swing) quick web boost: one-hand web to a far point ahead + forward impulse (off in combat).
//           Web slingshot (on the ground): hold Ctrl, LMB / RMB = web to the left / right building (repeat for more),
//           walk back (S) to stretch, release Ctrl to launch (traversal stepSling, player/slingweb.js).
//           T (perched, zip reticle on a point): web tightrope — web to that point, stand up, W / S walk the line
//           (traversal stepRope, traversal/rope.js, player/ropeweb.js).
//
// Animation layer hook (C1): either `player.setAnimator({update(dt, anim, player)})`, or a `rig.animate(anim, dt, player)`
// method. When present, it is called every frame after the root transform (object.position = feet, object.quaternion =
// body orientation incl. bank) has been applied, and the fallback below is skipped.
// C5: player.setControlOverride(fn) — fn(inputState, dt, player) returns the input state traversal should use
// (return the same object possibly modified, or null for neutral input). If the returned object has `combat: true` and
// he is on the ground, anim.mode is reported as 'combat' (anim.sub = returned.combatSub || current sub); every other
// traversal mode (air, swing, wall, zip, perch, landing) keeps its own animation (no fight stance on a wall / in a
// swing). `combatVel` (Vector3) = the body velocity of a scripted combat move (lunge, dodge, knock-back): the animator
// (stride, lean) and the chase camera (follow lag, no snap-back) see real motion; `combatCam` = suppress the chase
// camera's travel recenter (the combat camera frames the fight).
import * as THREE from "three";
import { loadCharacter, POSES, makePose, blendPose, copyPose } from "./rig.js";
import { createWebSystem } from "./web.js";
import { createSlingWebs } from "./slingweb.js";
import { createRopeWebs } from "./ropeweb.js";
import { createChaseCamera } from "./camera.js";
import { createTraversal, H } from "./traversal/traversal.js";
import { SHOTS } from "../shots.js";

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(),
    _v2 = new THREE.Vector3(),
    _q = new THREE.Quaternion();
const NEUTRAL = {
    move: { x: 0, y: 0 },
    look: { dx: 0, dy: 0 },
    swing: false,
    jump: false,
    zip: false,
    sprint: false,
    walk: false,
    drop: false,
    swingPressed: false,
    jumpPressed: false,
    zipPressed: false,
    dropPressed: false,
    sprintPressed: false,
    swingReleased: false,
    jumpReleased: false,
    zipReleased: false,
    dropReleased: false,
    sprintReleased: false,
    jumpHeld: 0,
    aimT: 99,
};

export async function createPlayer({ scene, world, camera, input, renderer }) {
    const rig = await loadCharacter(renderer);
    const object = new THREE.Group();
    object.name = "Player";
    object.add(rig.object);
    scene.add(object);
    const web = createWebSystem(scene);
    const slingWebs = createSlingWebs(scene, web);
    const ropeWebs = createRopeWebs(scene);
    const cam = createChaseCamera(camera, world);
    const trav = createTraversal({ world, cam, web, rig, camera });
    const s = trav.s,
        anim = trav.anim;
    cam.foliage = (p) => trav.anchors.canopies?.(p); // camera avoids tree canopies (no collision geometry)

    trav.teleport(world.spawn.clone().add(new THREE.Vector3(0, H, 0)), 0);
    cam.reset(s.pos, 0);

    let override = null,
        animator = null,
        frozen = false;

    // ---------------------------------------------------------------- fallback animation (C1 -> GLB clips / procedural)
    const F = {
        lastSub: "",
        lastMode: "",
        spin: 0,
        pose: makePose(),
        prev: makePose(),
        blend: 1,
        key: "",
    };
    const spinQ = new THREE.Quaternion();
    function clip(name, o = {}) {
        return rig.mixer && rig.hasClip(name) && rig.play(name, o);
    }
    function drive(name, t01, fade = 0.2) {
        return rig.mixer && rig.hasClip(name) && rig.drive(name, t01, fade);
    }
    function fallbackAnimate(dt) {
        const a = anim,
            m = a.mode,
            sub = a.sub,
            t = a.t;
        const entered = sub !== F.lastSub || m !== F.lastMode;
        F.lastSub = sub;
        F.lastMode = m;
        let ok = false,
            pose = null;
        let spinAxis = null,
            spinAngle = 0,
            spinH = 0.95;
        const hs = Math.hypot(a.velocity.x, a.velocity.z);
        if (m === "ground" || m === "combat") {
            if (sub === "idle") {
                ok = clip("idle", { fade: 0.25 });
                pose = POSES.idle(a.t);
            } else if (sub === "walk" || sub === "run" || sub === "sprint") {
                const ts =
                    sub === "walk"
                        ? Math.max(0.45, a.speed / 3.6)
                        : Math.max(
                              0.7,
                              a.speed / (sub === "sprint" ? 11.5 : 7.8),
                          );
                ok = clip("run", {
                    fade: entered && F.lastWasIdle ? 0.15 : 0.22,
                    timeScale: ts,
                });
                if (ok && rig.current) rig.current.timeScale = ts;
                F.runPhase = ((F.runPhase || 0) + (a.speed * dt) / 2.4) % 1;
                pose = POSES.run(
                    F.runPhase,
                    THREE.MathUtils.clamp((a.speed - 4) / 10, 0, 1),
                );
            } else if (sub === "jumpCharge") {
                ok = drive("jump", 0.05 + 0.2 * a.jumpCharge, 0.12);
                pose = POSES.jump();
            } else if (sub === "vault") {
                ok = drive("jump", 0.45 + 0.45 * Math.min(1, t / 0.35), 0.1);
                pose = POSES.jump();
            } else {
                ok = clip("idle", { fade: 0.25 });
                pose = POSES.idle(0);
            }
        } else if (m === "land") {
            if (sub === "landRoll") {
                ok = drive("jump", 0.9, 0.06);
                pose = POSES.jump();
                const u = Math.min(1, t / 0.5);
                spinAxis = "x";
                spinAngle = Math.PI * 2 * (u * u * (3 - 2 * u));
                spinH = 0.55;
            } else {
                const start =
                    sub === "landHard" ? 0 : sub === "landMedium" ? 0.12 : 0.35;
                const speed =
                    sub === "landHard"
                        ? 1.05
                        : sub === "landMedium"
                          ? 1.5
                          : 2.2;
                ok = drive(
                    "land",
                    start + (t * speed) / 0.73,
                    entered ? 0.05 : 0.1,
                );
                pose = POSES.land();
            }
        } else if (m === "air") {
            if (
                sub === "trick" &&
                a.trick === "flip" &&
                rig.hasClip("airTrick")
            ) {
                ok = drive("airTrick", Math.min(0.99, t / 0.85), 0.08);
            } else if (sub === "trick") {
                ok = drive("jump", 0.9, 0.1);
                pose = POSES.swingRelease(Math.min(1, t / 0.85));
                const u = Math.min(1, t / 0.8),
                    e = u * u * (3 - 2 * u);
                spinAxis = "x";
                spinAngle = Math.PI * 2 * e; // user r10b: no horizontal 'fan' spins (was y / z) — a plain flip
            } else if (
                sub === "jumpLaunch" ||
                sub === "pointLaunch" ||
                sub === "wallJump"
            ) {
                ok = drive("jump", Math.min(0.9, 0.3 + t * 2.2), 0.08);
                pose = POSES.jump();
            } else if (
                sub === "dive" ||
                (sub === "fall" && a.velocity.y < -16)
            ) {
                ok = clip("fall", { fade: 0.35 });
                pose = POSES.fall(t);
            } else if (sub === "zipPull") {
                ok = drive("jump", 0.9, 0.12);
                pose = POSES.jump();
            } else {
                ok = drive("jump", 0.9, 0.25);
                pose = POSES.jump();
            }
        } else if (m === "swing") {
            // clip: 0 back of arc, 18 bottom, 32 front (of 56 frames)
            const ph = a.swing.phase;
            const f = ph < 0 ? 18 * (ph + 1) : 18 + 14 * ph;
            ok = drive(
                "swing",
                f / 56,
                entered && F.prevMode !== "swing" ? 0.12 : 0.2,
            );
            pose = POSES.swing(ph);
        } else if (m === "zip") {
            ok = drive("jump", sub === "zipPull" ? 0.3 : 0.9, 0.12);
            pose = POSES.jump();
        } else if (m === "perch") {
            if (sub === "perchLand") {
                ok = drive(
                    "land",
                    Math.min(0.5, t * 1.1),
                    entered ? 0.08 : 0.15,
                );
                pose = POSES.land();
            } else {
                ok =
                    clip("wallPerch", { fade: 0.45 }) ||
                    clip("idle", { fade: 0.3 });
                pose = POSES.land();
            }
        } else if (m === "wall") {
            if (sub === "vault") {
                ok = drive("jump", 0.45 + 0.45 * Math.min(1, t / 0.4), 0.1);
                pose = POSES.jump();
            } else {
                ok = drive("wallCrawl", a.wall.phase * 0.5, 0.2);
                pose = POSES.wallCrawl(a.wall.phase);
            }
        }
        F.prevMode = m;
        F.lastWasIdle = sub === "idle";
        // root spin for rolls / tricks (about the body centre)
        if (spinAxis) {
            const ax =
                spinAxis === "x"
                    ? _v.set(1, 0, 0)
                    : spinAxis === "y"
                      ? _v.set(0, 1, 0)
                      : _v.set(0, 0, 1);
            spinQ.setFromAxisAngle(ax, spinAngle);
            const centre = _v2
                .set(0, spinH, 0)
                .applyQuaternion(object.quaternion)
                .add(object.position);
            object.quaternion.multiply(spinQ);
            object.position
                .copy(centre)
                .sub(_v.set(0, spinH, 0).applyQuaternion(object.quaternion));
        }
        rig.update(dt);
        if (!ok && pose) {
            const key = m + sub;
            if (key !== F.key) {
                copyPose(F.pose, F.prev);
                F.blend = 0;
                F.key = key;
            }
            F.blend = Math.min(1, F.blend + dt / 0.18);
            blendPose(
                F.prev,
                pose,
                F.blend * F.blend * (3 - 2 * F.blend),
                F.pose,
            );
            rig.applyPose(F.pose, 1);
        }
        // arm IK: web arm to the anchor / zip target
        const aim = (S, target, w) => {
            const sh = rig.bones["upperArm" + S];
            if (!sh) return;
            const d = target.clone().sub(sh.getWorldPosition(_v)).normalize();
            rig.aimBone("upperArm" + S, d, w);
            rig.aimBone("lowerArm" + S, d, w);
        };
        if (m === "swing" && web.active) {
            aim(a.swing.hand, web.anchor, 1);
            if (a.swing.hand === "L") aim("R", web.anchor, 0.55);
        } else if (
            (m === "zip" || (m === "air" && sub === "zipPull")) &&
            web.active
        ) {
            aim("R", web.anchor, 1);
            if (m === "zip" && sub === "zipTravel") aim("L", web.anchor, 0.8);
        }
    }

    // ---------------------------------------------------------------- per-frame update
    let lastQ = new THREE.Quaternion(),
        aimT = 99,
        zipHeld = false;
    function update(dt) {
        if (frozen) return;
        if (input.sling) input.sling.gate = s.mode === "ground"; // Ctrl+LMB/RMB = slingshot anchors only on the ground
        let I = input.poll(dt);
        aimT = I.aimT;
        zipHeld = I.zip;
        let combat = null;
        if (override) {
            let r;
            try {
                r = override(I, dt, api);
            } catch (e) {
                console.error("[player] control override failed", e);
                r = I;
            }
            if (r === null) {
                NEUTRAL.look = I.look;
                I = NEUTRAL;
            } else if (r && r !== I) {
                combat = r.combat ? r : null;
                I = r;
            } else if (r && r.combat) combat = r;
        }
        cam.applyLook(I, dt);
        const q = trav.update(dt, I);
        lastQ.copy(q);
        if (combat && anim.mode === "ground") {
            anim.mode = "combat";
            if (combat.combatSub) anim.sub = combat.combatSub;
            if (combat.combatVel) {
                anim.velocity.copy(combat.combatVel);
                anim.velocity.y = 0;
                anim.speed = Math.hypot(anim.velocity.x, anim.velocity.z);
            }
        }
        const camVel = combat?.combatVel || s.vel;
        for (const e of trav.events) {
            if (e.type === "land" && e.severity > 0.02) cam.impact(e.severity);
            else if (e.type === "perch") cam.impact(e.severity * 0.6);
            else if (e.type === "pointLaunch") {
                cam.impact(0.18);
                cam.kick?.(0.7);
            } else if (e.type === "zipLaunch")
                cam.kick?.(Math.min(1, 0.45 + (e.dist || 0) / 60)); // slingshot: pull-back + FOV kick
            else if (e.type === "zipYank") cam.shake(0.06);
            else if (e.type === "swingBoost") {
                cam.kick?.(0.3 + 0.35 * e.k);
                cam.shake(0.03 + 0.04 * e.k);
            } // (user r-anim7) full-swing release boost
            else if (e.type === "quickBoost") {
                cam.kick?.(0.22 + 0.18 * e.k);
                cam.shake(0.04);
            } // small FOV kick (launch kick spring)
            else if (e.type === "waterSplash") cam.shake(0.25);
            else if (e.type === "wall" && e.run) cam.shake(0.08);
            else if (e.type === "ropeSnap")
                cam.shake(0.12 + 0.25 * e.severity); // slack web catching taut again
            else if (e.type === "swingWallKick")
                cam.shake(0.1 + 0.3 * e.severity);
            else if (e.type === "slingFail") cam.shake(0.05);
            else if (e.type === "slingAttach") cam.shake(0.03);
            else if (e.type === "slingLaunch") cam.shake(0.1 + 0.2 * e.tension);
            else if (e.type === "ropeFail") cam.shake(0.035);
            else if (e.type === "ropeAnchor") cam.shake(0.03);
            else if (e.type === "ropeArrive") cam.impact(0.05);
        }
        cam.update(dt, {
            pos: s.pos,
            vel: camVel,
            noAuto: !!combat?.combatCam,
            mode: s.mode,
            sub: s.sub,
            modeT: s.modeT,
            anchor: s.mode === "swing" ? s.swing.anchor : null,
            swingDir: s.mode === "swing" ? s.swing.dir : null,
            wallNormal: s.wall.normal,
            facing: s.facing,
            dive: s.dive || s.gliding,
            tension: s.swing.tension,
            bank: s.swing.bank,
            sling: s.sling.active ? 0.25 + 0.75 * s.sling.tension : 0,
            walkK: s.mode === "ground" ? s.walkK || 0 : 0,
            ropeDir: s.mode === "rope" && s.rope ? s.rope.dir : null,
        });
        // character occlusion: never render the camera inside Spider-Man (hide the mesh when the lens is within ~0.8 m)
        {
            const cd = camera.position.distanceTo(s.pos);
            rig.object.visible = cd > 0.85;
        }
        // root transform
        object.quaternion.copy(q);
        object.position.copy(trav.rootPos);
        if (animator) animator.update(dt, anim, api);
        else if (typeof rig.animate === "function") rig.animate(anim, dt, api);
        else fallbackAnimate(dt);
        const hand =
            s.mode === "swing"
                ? s.swing.hand
                : s.quick.webOn
                  ? s.quick.hand
                  : "R"; // quick boost: the strand leaves its own hand
        // web-zip fires TWO strands (one per hand): the second strand starts at the left palm
        web.update(
            dt,
            rig.handWorld(hand),
            camera,
            renderer,
            web.active2 ? rig.handWorld("L", _v2) : null,
        );
        slingWebs.update(dt, s.sling, trav.events, rig, camera, renderer);
        ropeWebs.update(dt, s.ropes, rig.handWorld("R", _v2), renderer);
    }

    // ---------------------------------------------------------------- shot / scripted posing API (used by src/shots.js)
    // setPose(opts): {pos (feet world pos), quaternion | forward+up | facing, pose | poseName, clip, clipTime, anchor, anchorNormal, state}
    const basisM = new THREE.Matrix4();
    function orientFrom(fwd, up) {
        const z = fwd.clone().addScaledVector(up, -fwd.dot(up)).normalize();
        const x = new THREE.Vector3().crossVectors(up, z).normalize();
        basisM.makeBasis(x, up.clone().normalize(), z);
        return new THREE.Quaternion().setFromRotationMatrix(basisM);
    }
    function setPose(o) {
        frozen = true;
        if (o.quaternion) s.bodyQ.copy(o.quaternion);
        else if (o.forward)
            s.bodyQ.copy(orientFrom(o.forward.clone(), (o.up || UP).clone()));
        else
            s.bodyQ.copy(
                orientFrom(
                    new THREE.Vector3(
                        Math.sin(o.facing || 0),
                        0,
                        Math.cos(o.facing || 0),
                    ),
                    UP,
                ),
            );
        object.quaternion.copy(s.bodyQ);
        object.position.copy(o.pos);
        s.pos
            .copy(o.pos)
            .addScaledVector(
                new THREE.Vector3(0, 1, 0).applyQuaternion(s.bodyQ),
                H,
            );
        object.updateMatrixWorld(true);
        let usedClip = false;
        if (o.clip && rig.hasClip(o.clip))
            usedClip = rig.setClipTime(o.clip, o.clipTime ?? 0.3);
        if (!usedClip || o.forceProcedural) {
            const p =
                o.pose ||
                (o.poseName
                    ? POSES[o.poseName](o.poseArg ?? 0)
                    : POSES.idle(0));
            rig.applyPose(p, 1);
        }
        s.mode = o.state || "ground";
        if (o.anchor) {
            s.swing.anchor.copy(o.anchor);
            if (!web.active)
                web.attach(
                    rig.handWorld("R"),
                    o.anchor,
                    o.anchorNormal || new THREE.Vector3(0, 0, 1),
                    { instant: true },
                );
            const sh = rig.bones.upperArmR;
            if (sh) {
                const d = o.anchor
                    .clone()
                    .sub(sh.getWorldPosition(new THREE.Vector3()))
                    .normalize();
                rig.aimBone("upperArmR", d);
                rig.aimBone("lowerArmR", d);
            }
        }
        object.updateMatrixWorld(true);
    }

    const api = {
        object,
        rig,
        web,
        cam,
        traversal: trav,
        state: s,
        anim,
        get position() {
            return s.pos;
        },
        get velocity() {
            return s.vel;
        },
        get heading() {
            return cam.yaw;
        },
        get mode() {
            return s.mode;
        },
        get sub() {
            return s.sub;
        },
        get zipTarget() {
            return trav.targeting.best;
        },
        // reticle: show all candidates while the player is aiming (camera recently moved, perched, standing still, holding zip)
        get aiming() {
            return (
                aimT < 1.6 ||
                zipHeld ||
                s.mode === "perch" ||
                s.mode === "rope" ||
                (s.mode === "ground" && s.speed < 0.3 && s.modeT > 0.6)
            );
        },
        get zipCandidates() {
            return trav.targeting.candidates;
        },
        update,
        setPose,
        shotTick(dt) {
            web.update(dt, rig.handWorld("R"), camera, renderer);
        },
        teleport(p, yaw = 0) {
            frozen = false;
            trav.teleport(p, yaw);
            cam.reset(s.pos, yaw);
        },
        applyShot(name) {
            const sh = SHOTS[name];
            if (!sh || !window.__ctx) return false;
            sh.apply(window.__ctx);
            return true;
        },
        setControlOverride(fn) {
            override = typeof fn === "function" ? fn : null;
        },
        setAnimator(a) {
            animator = a && typeof a.update === "function" ? a : null;
        },
        get frozen() {
            return frozen;
        },
        set frozen(b) {
            frozen = !!b;
        },
    };
    if (typeof window !== "undefined") {
        window.__trav = trav;
        const params = new URLSearchParams(location.search);
        if (params.has("playtest") && !window.__ptState)
            window.__ptState = () => ({
                sub: anim.sub,
                am: anim.mode,
                t: +anim.t.toFixed(2),
                ph: +anim.swing.phase.toFixed(2),
                bank: +anim.swing.bank.toFixed(2),
                ten: +anim.swing.tension.toFixed(2),
                hand: anim.swing.hand,
                trick: anim.trick,
                jc: +anim.jumpCharge.toFixed(2),
                sev: +anim.landing.severity.toFixed(2),
                zipT: +anim.zip.t.toFixed(2),
                tgt: trav.targeting.best ? trav.targeting.best.kind : null,
                nC: trav.targeting.candidates.length,
                feet: +(s.pos.y - H).toFixed(2),
                floor: +trav
                    .floorAt(s.pos.x, s.pos.z, s.pos.y - H + 0.3)
                    .toFixed(2),
                rope: s.mode === "swing" ? +s.swing.rope.toFixed(1) : null,
                ang:
                    s.mode === "swing"
                        ? Math.round((s.swing.angle || 0) * 57.3)
                        : null,
                woff: s.mode === "wall" ? +s.wall.off.toFixed(2) : null,
                runK: s.mode === "wall" ? +s.wall.runK.toFixed(2) : null,
                node: anim.animNode || null,
                ropeU:
                    s.mode === "rope" && s.rope ? +s.rope.u.toFixed(3) : null,
                ropeN: s.ropes.length,
                anc:
                    s.mode === "swing"
                        ? s.swing.anchor.toArray().map((v) => +v.toFixed(1))
                        : null,
            });
    }
    return api;
}
