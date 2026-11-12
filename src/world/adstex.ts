/**
 * Loads advertisement and signage texture assets for city displays.
 *
 * @module world-adstex
 * @version 1.0.0
 * @file src/world/adstex.ts
 * @since 0.0.1
 * @description Provides shared texture loaders and helpers for ad and sign atlas images used by world signage and screens.
 */
import * as THREE from "three";

let tex: THREE.Texture | null = null,
    texImg: Promise<HTMLImageElement | null> | null = null;

export function adsTexture(): THREE.Texture {
    if (!tex) {
        texImg = new Promise((res) => {
            tex = new THREE.TextureLoader().load(
                new URL("../assets/textures/city/ts_ads.webp", import.meta.url)
                    .href,
                (t) => res(t.image as HTMLImageElement),
                undefined,
                () => res(null),
            );
        });
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
    }
    return tex!;
}

function gridOf(img: HTMLImageElement | null, W: number, H: number) {
    if (!img || typeof document === "undefined") return null;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext("2d", { willReadFrequently: true })!;
    (cx as any).imageSmoothingQuality = "high";
    cx.drawImage(img, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data,
        L = new Float32Array(256),
        out = new Float32Array(W * H * 3);
    for (let i = 0; i < 256; i++) {
        const v = i / 255;
        L[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
        out[i * 3] = L[d[j]];
        out[i * 3 + 1] = L[d[j + 1]];
        out[i * 3 + 2] = L[d[j + 2]];
    }
    return { W, H, d: out };
}

let adsG: Promise<{ W: number; H: number; d: Float32Array } | null> | null =
    null;
export function adsGrid() {
    adsTexture();
    return (adsG ??= texImg!.then((img) => {
        try {
            return gridOf(img, 256, 256);
        } catch (e) {
            console.warn("[adstex] grid", e);
            return null;
        }
    }));
}

let signs: THREE.Texture | null = null,
    signsImg: Promise<HTMLImageElement | null> | null = null,
    signsG: Promise<{ W: number; H: number; d: Float32Array } | null> | null =
        null;

export function signsGrid() {
    signsTexture();
    return (signsG ??= signsImg!.then((img) => {
        try {
            return gridOf(img, 128, 256);
        } catch {
            return null;
        }
    }));
}

export function signsTexture(): THREE.Texture {
    if (!signs) {
        signsImg = new Promise((res) => {
            signs = new THREE.TextureLoader().load(
                new URL(
                    "../assets/textures/city/ts_signs.webp",
                    import.meta.url,
                ).href,
                (t) => res(t.image as HTMLImageElement),
                undefined,
                () => res(null),
            );
        });
        signs.colorSpace = THREE.SRGBColorSpace;
        signs.anisotropy = 8;
    }
    return signs!;
}
