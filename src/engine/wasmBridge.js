let wasmApi = null;
let loadAttempted = false;

const jsFallback = {
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

export async function initWasmEngine() {
    if (wasmApi) return wasmApi;
    if (loadAttempted) return null;
    loadAttempted = true;
    try {
        const mod = await import("./pkg/engine_wasm.js");
        await mod.default();
        if (typeof mod.initEngine === "function") mod.initEngine();
        wasmApi = mod;
        return wasmApi;
    } catch (_error) {
        wasmApi = null;
        return null;
    }
}

export function getEngineMath() {
    if (!wasmApi) return jsFallback;
    return {
        damp(current, target, rate, deltaTimeSeconds) {
            return wasmApi.damp(current, target, rate, deltaTimeSeconds);
        },
        clampF32(value, minimum, maximum) {
            return wasmApi.clampF32(value, minimum, maximum);
        },
        angleWrap(angleRadians) {
            return wasmApi.angleWrap(angleRadians);
        },
        capHorizontalSpeed(velocityX, velocityZ, maxSpeed) {
            return {
                x: wasmApi.capHorizontalSpeedX(velocityX, velocityZ, maxSpeed),
                z: wasmApi.capHorizontalSpeedZ(velocityX, velocityZ, maxSpeed),
            };
        },
    };
}
