/**
 * Render quality presets and runtime quality selection utilities.
 *
 * @module render-quality
 * @version 1.0.0
 * @file src/render/quality.ts
 * @since 0.0.1
 * @description Defines QualityPreset settings, built-in low/med/high presets, and getQuality for resolving the active preset from URL parameters and overrides.
 */

export interface QualityPreset {
    name: string;
    cascades: number;
    shadowMapSize: number;
    shadowFar: number;
    splits: number[];
    shadowTaps: number;
    ao: boolean;
    aoHalfRes: boolean;
    aoQuality: string;
    cloudSteps: number;
    cloudLightSteps: number;
    envSize: number;
    taa: boolean;
    bloomLevels: number;
    dofTaps: number;
    mbSamples: number;
    sharpen: number;
    charShadow: number;
    ssr: boolean;
    ssrSteps?: number;
    shafts: boolean;
    shaftSteps: number;
    ssgi: boolean;
    ssgiDirs?: number;
    ssgiSteps?: number;
    wet: boolean;
    perf?: boolean;
    [key: string]: unknown;
}

export const PRESETS: Record<string, QualityPreset> = {
    low: {
        name: "low",
        cascades: 2,
        shadowMapSize: 1024,
        shadowFar: 500,
        splits: [0.1, 30, 500],
        shadowTaps: 5,
        ao: false,
        aoHalfRes: true,
        aoQuality: "Performance",
        cloudSteps: 10,
        cloudLightSteps: 2,
        envSize: 64,
        taa: true,
        bloomLevels: 5,
        dofTaps: 16,
        mbSamples: 6,
        sharpen: 0.25,
        charShadow: 0,
        ssr: false,
        shafts: false,
        shaftSteps: 0,
        ssgi: false,
        wet: false,
    },
    med: {
        name: "med",
        cascades: 3,
        shadowMapSize: 2048,
        shadowFar: 900,
        splits: [0.1, 18, 90, 900],
        shadowTaps: 8,
        ao: true,
        aoHalfRes: true,
        aoQuality: "Low",
        cloudSteps: 16,
        cloudLightSteps: 3,
        envSize: 128,
        taa: true,
        bloomLevels: 6,
        dofTaps: 22,
        mbSamples: 8,
        sharpen: 0.3,
        charShadow: 1024,
        ssr: true,
        ssrSteps: 20,
        shafts: true,
        shaftSteps: 12,
        ssgi: true,
        ssgiDirs: 4,
        ssgiSteps: 4,
        wet: true,
    },
    high: {
        name: "high",

        cascades: 5,
        shadowMapSize: 2048,
        shadowFar: 3000,
        splits: [0.1, 14, 50, 200, 800, 3000],
        shadowTaps: 10,
        ao: true,
        aoHalfRes: false,
        aoQuality: "Medium",
        cloudSteps: 22,
        cloudLightSteps: 3,
        envSize: 128,
        taa: true,
        bloomLevels: 6,
        dofTaps: 43,
        mbSamples: 10,
        sharpen: 0.35,
        charShadow: 2048,
        ssr: true,
        ssrSteps: 28,
        shafts: true,
        shaftSteps: 16,
        ssgi: true,
        ssgiDirs: 6,
        ssgiSteps: 4,
        wet: true,
    },
};

let _q: QualityPreset | null = null;
export function getQuality(): QualityPreset {
    if (_q) return _q;
    let name = "high";
    try {
        const p = new URLSearchParams(location.search).get("q");
        if (p && PRESETS[p]) name = p;
        if (p === "medium") name = "med";
    } catch (_e) { void 0; }
    _q = { ...PRESETS[name] };

    try {
        _q.perf = !new URLSearchParams(location.search).has("perfoff");
    } catch (_e) {
        _q.perf = true;
    }

    try {
        const qs = new URLSearchParams(location.search).get("qset");
        if (qs)
            for (const kv of qs.split(",")) {
                const [k, v] = kv.split(":");
                if (k in _q)
                    _q[k] =
                        v === "true"
                            ? true
                            : v === "false"
                              ? false
                              : isNaN(+v)
                                ? v
                                : +v;
            }
    } catch (_e) {
        /* non-browser */
    }
    return _q;
}
