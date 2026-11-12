/**
 * Save data persistence.
 *
 * @module src-game-systems-save
 * @version 1.0.0
 * @file src/game/systems/save.ts
 * @since 0.0.1
 * @description Loads, stores, migrates, and persists player progress and settings.
 */

const KEY = "spiderbench.save.v1";
const OLD_KEYS = ["spidey.save.v1"];

export interface SaveSettings {
    quality: string;
    renderScale: number;
    mouseSensitivity: number;
    invertY: boolean;
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    ambienceVolume: number;
    uiVolume: number;
    audioV: number;
    showPins: boolean;
    minimalHud: boolean;
    subtitles: boolean;
    fovOffset: number;
    motionBlur: number;
    dof: number;
    hudScale: number;
    subtitleSize: number;
    timeOfDay: string;
    puddles: boolean;
    daySun: string;
}

export interface SaveCrimes {
    stopped: number;
    byType: Record<string, number>;
    byDistrict: Record<string, number>;
}

export interface SaveState {
    v: number;
    xp: number;
    level: number;
    skillPoints: number;
    skills: string[];
    suit: string;
    suitsUnlocked: string[];
    towers: string[];
    stations: string[];
    backpacks: string[];
    landmarks: string[];
    secretPhotos: string[];
    photoThumbs: Record<string, string>;
    crimes: SaveCrimes;
    waypoint: [number, number, number] | null;
    player: [number, number, number, number] | null;
    playTime: number;
    settings: SaveSettings;
}

export const DEFAULT_SETTINGS: SaveSettings = {
    quality: "high",
    renderScale: 1,
    mouseSensitivity: 1,
    invertY: false,

    masterVolume: 1,
    musicVolume: 0.7,
    sfxVolume: 0.7,
    ambienceVolume: 0.7,
    uiVolume: 0.7,
    audioV: 3,
    showPins: true,
    minimalHud: false,
    subtitles: true,
    fovOffset: 0,
    motionBlur: 1,
    dof: 1,
    hudScale: 1,
    subtitleSize: 1,
    timeOfDay: "day",
    puddles: true,
    daySun: "a",
};

export function defaultState(): SaveState {
    return {
        v: 1,
        xp: 0,
        level: 1,
        skillPoints: 1,
        skills: [],
        suit: "advanced",
        suitsUnlocked: ["advanced", "symbiote"],
        towers: [],
        stations: [],
        backpacks: [],
        landmarks: [],
        secretPhotos: [],
        photoThumbs: {},
        crimes: { stopped: 0, byType: {}, byDistrict: {} },
        waypoint: null,
        player: null,
        playTime: 0,
        settings: { ...DEFAULT_SETTINGS },
    };
}

export interface SaveApi {
    readonly state: SaveState;
    persistent: boolean;
    markDirty(delay?: number): void;
    flush(): void;
    reset(): void;
}

export function createSave(): SaveApi {
    const q = new URLSearchParams(location.search);
    const persistent = (!q.has("playtest") && !q.has("shot")) || q.has("save");
    let state = defaultState();
    if (q.has("newgame")) {
        try {
            localStorage.removeItem(KEY);
        } catch {
            void 0;
        }
    }
    if (persistent) {
        try {
            if (localStorage.getItem(KEY) == null)
                for (const k of OLD_KEYS) {
                    const o = localStorage.getItem(k);
                    if (o != null) {
                        localStorage.setItem(KEY, o);
                        localStorage.removeItem(k);
                        break;
                    }
                }
            const raw = localStorage.getItem(KEY);
            if (raw) {
                const s = JSON.parse(raw) as Partial<SaveState> & {
                    settings?: any;
                };
                if (s && s.v === 1)
                    state = {
                        ...defaultState(),
                        ...s,
                        settings: {
                            ...DEFAULT_SETTINGS,
                            ...(s.settings || {}),
                        },
                        crimes: {
                            ...defaultState().crimes,
                            ...(s.crimes || {}),
                        },
                    } as SaveState;
                if (!(s.settings?.audioV >= 3)) {
                    for (const k of [
                        "masterVolume",
                        "musicVolume",
                        "sfxVolume",
                        "ambienceVolume",
                        "uiVolume",
                        "musicV",
                    ] as const)
                        delete (state.settings as any)[k];
                    Object.assign(state.settings, {
                        masterVolume: 1,
                        musicVolume: 0.7,
                        sfxVolume: 0.7,
                        ambienceVolume: 0.7,
                        uiVolume: 0.7,
                        audioV: 3,
                    });
                }
            }
        } catch (e) {
            console.warn("[save] could not read save, starting fresh", e);
        }
    }
    let timer: ReturnType<typeof setTimeout> | 0 = 0;
    function writeNow() {
        timer = 0;
        if (!persistent) return;
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch {
            try {
                state.photoThumbs = {};
                localStorage.setItem(KEY, JSON.stringify(state));
            } catch {
                void 0;
            }
        }
    }
    return {
        get state() {
            return state;
        },
        persistent,
        markDirty(delay = 800) {
            if (!timer) timer = setTimeout(writeNow, delay);
        },
        flush() {
            if (timer) clearTimeout(timer);
            writeNow();
        },
        reset() {
            const keepSettings = state.settings;
            state = defaultState();
            state.settings = keepSettings;
            writeNow();
        },
    };
}
