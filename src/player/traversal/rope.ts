/**
 * Rope data structures and helpers for traversal rope behavior.
 *
 * @module player-traversal-rope
 * @version 1.0.0
 * @file src/player/traversal/rope.ts
 * @since 0.0.1
 * @description Defines rope state/configuration and provides point sampling and spring-step updates for rope sag and load.
 */

import * as THREE from "three";

export const ROPE = {
    MIN: 6,
    MAX: 120,
    SLOPE: (30 * Math.PI) / 180,
    SPEED: 3.4,
    ACC: 4.2,
    DEC: 5.5,
    AIM: 0.14,
    PIN: 0.16,
    STAND: 0.5,
    LINGER: 3.5,
    DROP: 0.8,
} as const;

export interface RopeState {
    a: THREE.Vector3;
    b: THREE.Vector3;
    na: THREE.Vector3;
    nb: THREE.Vector3;
    dir: THREE.Vector3;
    len: number;
    lenH: number;
    slope: number;
    u: number;
    v: number;
    face: number;
    lean: number;
    sag: number;
    dip: number;
    dipV: number;
    loadU: number;
    load: number;
    dipMax: number;
    t: number;
    fireT: number;
    shootDur: number;
    hitT: number;
    pinT: number;
    hit: boolean;
    pinned: boolean;
    gone: number;
    drop: number;
    alive: boolean;
    fromStand: boolean;
    target: { pos: THREE.Vector3; normal: THREE.Vector3; kind: string };
    start: any;
}

export function makeRope(): RopeState {
    return {
        a: new THREE.Vector3(),
        b: new THREE.Vector3(),
        na: new THREE.Vector3(0, 1, 0),
        nb: new THREE.Vector3(0, 0, 1),
        dir: new THREE.Vector3(0, 0, 1),
        len: 1,
        lenH: 1,
        slope: 0,
        u: 0,
        v: 0,
        face: 1,
        lean: 0,
        sag: 0,
        dip: 0,
        dipV: 0,
        loadU: 0.5,
        load: 0,
        dipMax: 0.1,
        t: 0,
        fireT: ROPE.AIM,
        shootDur: 0.1,
        hitT: 0.3,
        pinT: 0.45,
        hit: false,
        pinned: false,
        gone: -1,
        drop: 0,
        alive: true,
        fromStand: false,
        target: {
            pos: new THREE.Vector3(),
            normal: new THREE.Vector3(),
            kind: "",
        },
        start: null,
    };
}

export function ropePoint(
    R: RopeState,
    u: number,
    out: THREE.Vector3,
): THREE.Vector3 {
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    out.copy(R.a).lerp(R.b, u);
    let y = R.sag * 4 * u * (1 - u);
    if (R.dip !== 0) {
        const p = Math.min(0.999, Math.max(0.001, R.loadU));
        y += R.dip * (u < p ? u / p : (1 - u) / (1 - p));
    }
    out.y -= y;
    return out;
}
const _p = new THREE.Vector3();
export const ropeY = (R: RopeState, u: number): number => ropePoint(R, u, _p).y;

export function stepRopeSpring(R: RopeState, dt: number): void {
    const u = R.loadU,
        want = R.load * R.dipMax * 4 * u * (1 - u);
    const k = 55,
        c = 2 * 0.32 * Math.sqrt(k);
    R.dipV += ((want - R.dip) * k - R.dipV * c) * dt;
    R.dip += R.dipV * dt;
}
