// @ts-nocheck
// OWNER: combat engineer. Small shared helpers for src/game/combat/**.
import * as THREE from "three";

export const UP = new THREE.Vector3(0, 1, 0);
export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const smooth = (x) => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};
export const damp = (a, b, rate, dt) =>
  a + (b - a) * (1 - Math.exp(-rate * dt));
export const angWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const dampAngle = (a, b, rate, dt) =>
  a + angWrap(b - a) * (1 - Math.exp(-rate * dt));
export const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
export const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
