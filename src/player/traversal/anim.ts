/**
 * Traversal animation state container and writer.
 *
 * @module player-traversal-anim
 * @version 1.0.0
 * @file src/player/traversal/anim.ts
 * @since 0.0.1
 * @description Creates and updates the animation-facing state derived from traversal state for use by the character animator.
 */

import * as THREE from "three";

const UPV = new THREE.Vector3(0, 1, 0),
    XV = new THREE.Vector3(1, 0, 0);

export function makeAnim(): any {
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

export function writeAnim(a: any, s: any, q: THREE.Quaternion): any {
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
                  zipTravel: "flight",
                  zipFlight: "flight",
                  zipCatch: "catch",
              }[s.sub as string] || ""
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
    a.walkK = mode === "ground" ? s.walkK || 0 : 0;
    a.balance = !!s.balance && s.mode === "ground";
    a.facing = s.facing;
    a.dive = s.dive || !!s.gliding;
    a.glide = !!s.gliding;
    a.bodyQ.copy(q);
    a.stepOffset = s.stepOff;
    return a;
}
