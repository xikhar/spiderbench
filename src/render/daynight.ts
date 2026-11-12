/**
 * Day/night state hooks and helpers for night-only scene elements.
 *
 * @module render-daynight
 * @version 1.0.0
 * @file src/render/daynight.ts
 * @since 0.0.1
 * @description Exposes shared night and time scalars and utilities to tag, synchronize, and tick meshes that should only be active or adjusted during night conditions.
 */

import type * as THREE from "three";

export const nightK: { value: number } = { value: 0 };
export const dnTime: { value: number } = { value: 0 };

export const screenK: { value: number } = { value: 1 };
const nightMeshes = new Set<THREE.Object3D>();
export function nightOnly<T extends THREE.Object3D>(mesh: T): T {
    nightMeshes.add(mesh);
    mesh.layers.mask = 1;
    return mesh;
}

let warm = 240;
export function syncNightMeshes(): void {
    const m = nightK.value > 0.01 || warm > 0 ? 1 : 0;
    for (const o of nightMeshes) if (o.layers.mask !== m) o.layers.mask = m;
}
export function tickNightMeshes(): void {
    if (warm > 0 && --warm === 0) syncNightMeshes();
    else if (warm > 0) syncNightMeshes();
}
