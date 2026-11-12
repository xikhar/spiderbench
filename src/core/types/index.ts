/**
 * Shared core TypeScript type definitions for boot, world, input, and app context APIs.
 *
 * @module core-types
 * @version 1.0.0
 * @file src/core/types/index.ts
 * @since 0.0.1
 * @description Defines interfaces such as BootApi, WorldApi, InputApi, and AppContext that describe contracts between core systems, rendering, and gameplay.
 */

import type * as THREE from "three";

export interface BootApi {
    stage: (name: string) => Promise<void> | void;
    sub: (value: number) => void;
    done: () => void;
}

export interface Vec3Like {
    x: number;
    y: number;
    z: number;
}

export interface RaycastHit {
    point: THREE.Vector3;
    normal: THREE.Vector3;
    distance: number;
}

export interface ZipPoint {
    position: THREE.Vector3;
    normal?: THREE.Vector3;
    kind?: string;
    [key: string]: unknown;
}

export interface WorldApi {
    raycast: (
        origin: THREE.Vector3,
        dir: THREE.Vector3,
        maxDist: number,
    ) => RaycastHit | null;
    groundHeight: (x: number, z: number, y?: number) => number;
    spawn: THREE.Vector3;
    update: (dt: number, camera: THREE.Camera) => void;
    viewpoints?: Record<string, unknown>;
    streetsAt?: (x: number, z: number) => unknown;
    getMapFeatures?: () => unknown;
    getZipPoints?: (
        center: THREE.Vector3,
        radius: number,
        kinds?: readonly string[],
    ) => ZipPoint[];
    [key: string]: unknown;
}

export interface InputState {
    move: { x: number; y: number };
    look: { dx: number; dy: number };
    usingPad: boolean;
    swing: boolean;
    jump: boolean;
    zip: boolean;
    sprint: boolean;
    walk: boolean;
    drop: boolean;
    quick: boolean;
    rope: boolean;
    jumpHeld: number;
    aimT: number;
    ctrl?: boolean;
    slingL?: boolean;
    slingR?: boolean;
    [key: string]: unknown;
}

export interface InputApi {
    state: InputState;
    poll: (dt?: number) => InputState;
    sling: { gate: boolean; tap: number; held: number };
    press: (code: string) => void;
    release: (code: string) => void;
    releaseAll: () => void;
    consumeMouse: () => { dx: number; dy: number };
    [key: string]: unknown;
}

export interface Updatable {
    update?: (dt: number, ...args: unknown[]) => void;
}

export interface AppContext {
    THREE: typeof THREE;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    lighting: unknown;
    world: WorldApi;
    player: unknown;
    hud: unknown;
    pipeline: unknown;
    input: InputApi;
    systems: Updatable[];
    timeScale?: number;
    realDt?: number;
    manualStep?: boolean;
    stepFrame?: (dt: number) => void;
    [key: string]: unknown;
}
