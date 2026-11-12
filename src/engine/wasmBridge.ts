/**
 * Bridge for loading and accessing the optional WASM engine math API with JS fallbacks.
 *
 * @module engine-wasm-bridge
 * @version 1.0.0
 * @file src/engine/wasmBridge.ts
 * @since 0.0.1
 * @description Exposes initWasmEngine and getEngineMath to lazily load the WASM module and provide math operations such as damping, clamping, angle wrapping, and speed capping.
 */

export interface EngineMathApi {
    damp(
        current: number,
        target: number,
        rate: number,
        deltaTimeSeconds: number,
    ): number;
    clampF32(value: number, minimum: number, maximum: number): number;
    angleWrap(angleRadians: number): number;
    capHorizontalSpeed(
        velocityX: number,
        velocityZ: number,
        maxSpeed: number,
    ): { x: number; z: number };
}

interface WasmApi {
    default?: () => Promise<unknown> | unknown;
    initEngine?: () => void;
    damp: (
        current: number,
        target: number,
        rate: number,
        deltaTimeSeconds: number,
    ) => number;
    clampF32: (value: number, minimum: number, maximum: number) => number;
    angleWrap: (angleRadians: number) => number;
    capHorizontalSpeedX: (
        velocityX: number,
        velocityZ: number,
        maxSpeed: number,
    ) => number;
    capHorizontalSpeedZ: (
        velocityX: number,
        velocityZ: number,
        maxSpeed: number,
    ) => number;
}

let wasmApi: WasmApi | null = null;
let loadAttempted = false;

const jsFallback: EngineMathApi = {
    damp(current, target, rate, deltaTimeSeconds) {
        const safeRate = Number.isFinite(rate) && rate >= 0 ? rate : 0;
        const safeDt =
            Number.isFinite(deltaTimeSeconds) && deltaTimeSeconds >= 0
                ? deltaTimeSeconds
                : 0;
        const factor = 1 - Math.exp(-safeRate * safeDt);
        return current + (target - current) * factor;
    },
    clampF32(value, minimum, maximum) {
        const lower = minimum <= maximum ? minimum : maximum;
        const upper = minimum <= maximum ? maximum : minimum;
        if (value < lower) return lower;
        if (value > upper) return upper;
        return value;
    },
    angleWrap(angleRadians) {
        if (!Number.isFinite(angleRadians)) return 0;
        return Math.atan2(Math.sin(angleRadians), Math.cos(angleRadians));
    },
    capHorizontalSpeed(velocityX, velocityZ, maxSpeed) {
        const safeMax =
            Number.isFinite(maxSpeed) && maxSpeed >= 0 ? maxSpeed : 0;
        const speedSq = velocityX * velocityX + velocityZ * velocityZ;
        const maxSq = safeMax * safeMax;
        if (!Number.isFinite(speedSq) || speedSq <= maxSq || speedSq <= 1e-12) {
            return {
                x: Number.isFinite(velocityX) ? velocityX : 0,
                z: Number.isFinite(velocityZ) ? velocityZ : 0,
            };
        }
        const speed = Math.sqrt(speedSq);
        if (speed <= 1e-12) return { x: 0, z: 0 };
        const scale = safeMax / speed;
        return { x: velocityX * scale, z: velocityZ * scale };
    },
};

export async function initWasmEngine(): Promise<WasmApi | null> {
    if (wasmApi) return wasmApi;
    if (loadAttempted) return null;
    loadAttempted = true;
    try {
        const pkg = "./pkg/engine_wasm.js";
        const mod = (await import(/* @vite-ignore */ pkg)) as WasmApi;
        await mod.default?.();
        mod.initEngine?.();
        wasmApi = mod;
        return wasmApi;
    } catch {
        wasmApi = null;
        return null;
    }
}

export function getEngineMath(): EngineMathApi {
    if (!wasmApi) return jsFallback;
    const api = wasmApi;
    return {
        damp(current, target, rate, deltaTimeSeconds) {
            return api.damp(current, target, rate, deltaTimeSeconds);
        },
        clampF32(value, minimum, maximum) {
            return api.clampF32(value, minimum, maximum);
        },
        angleWrap(angleRadians) {
            return api.angleWrap(angleRadians);
        },
        capHorizontalSpeed(velocityX, velocityZ, maxSpeed) {
            return {
                x: api.capHorizontalSpeedX(velocityX, velocityZ, maxSpeed),
                z: api.capHorizontalSpeedZ(velocityX, velocityZ, maxSpeed),
            };
        },
    };
}
