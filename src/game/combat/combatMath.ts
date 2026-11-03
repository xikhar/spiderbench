// Shared movement, angle, and random-value helpers for combat systems.
import * as THREE from "three";

type HorizontalPosition = { x: number; z: number };

export const WORLD_UP = new THREE.Vector3(0, 1, 0);
export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;

export function smoothstep01(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function dampValue(
  current: number,
  target: number,
  rate: number,
  deltaSeconds: number,
): number {
  const blend = 1 - Math.exp(-rate * deltaSeconds);
  return current + (target - current) * blend;
}

export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function dampAngle(
  current: number,
  target: number,
  rate: number,
  deltaSeconds: number,
): number {
  return current + wrapAngle(target - current) * (1 - Math.exp(-rate * deltaSeconds));
}

export function yawToTarget(from: HorizontalPosition, to: HorizontalPosition): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function horizontalDistance(
  first: HorizontalPosition,
  second: HorizontalPosition,
): number {
  return Math.hypot(first.x - second.x, first.z - second.z);
}

export function randomBetween(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}

export function chooseRandom<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}
