/**
 * Core numeric utility helpers for clamping, interpolation, damping, and timing.
 *
 * @module core-utils
 * @version 1.0.0
 * @file src/core/utils/index.ts
 * @since 0.0.1
 * @description Exports small math and time helpers (clamp, lerp, damp, nowMs) used across the application for frame-rate-independent calculations.
 */

export const clamp = (value: number, min: number, max: number): number =>
    value < min ? min : value > max ? max : value;

export const lerp = (a: number, b: number, t: number): number =>
    a + (b - a) * t;

export const damp = (
    current: number,
    target: number,
    lambda: number,
    dt: number,
): number => lerp(current, target, 1 - Math.exp(-lambda * dt));

export const nowMs = (): number =>
    typeof performance !== "undefined" ? performance.now() : Date.now();
