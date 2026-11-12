/**
 * Combat utility helpers.
 *
 * @module src-game-combat-util
 * @version 1.0.0
 * @file src/game/combat/util.ts
 * @since 0.0.1
 * @description Provides shared math, geometry, and helper functions for combat systems.
 */

import * as THREE from "three";

export const UP = new THREE.Vector3(0, 1, 0);
export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const smooth = (x: number): number => {
    x = clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
};
export const damp = (a: number, b: number, rate: number, dt: number): number =>
    a + (b - a) * (1 - Math.exp(-rate * dt));
export const angWrap = (a: number): number =>
    Math.atan2(Math.sin(a), Math.cos(a));
export const dampAngle = (
    a: number,
    b: number,
    rate: number,
    dt: number,
): number => a + angWrap(b - a) * (1 - Math.exp(-rate * dt));
export const yawTo = (
    from: { x: number; z: number },
    to: { x: number; z: number },
): number => Math.atan2(to.x - from.x, to.z - from.z);
export const hdist = (
    a: { x: number; z: number },
    b: { x: number; z: number },
): number => Math.hypot(a.x - b.x, a.z - b.z);
export const rnd = (a: number, b: number): number =>
    a + Math.random() * (b - a);
export const pick = <T>(arr: T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];
