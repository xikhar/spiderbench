/**
 * Loads and retries city texture and image resources.
 *
 * @module world-textures
 * @version 1.0.0
 * @file src/world/textures.ts
 * @since 0.0.1
 * @description Provides utilities for resolving texture URLs and loading images with retry handling for world assets.
 */
import * as THREE from "three";

function texUrl(name: string) {
    return new URL(`../assets/textures/city/${name}`, import.meta.url).href;
}

export function loadImageRetry(
    src: string,
    tries = 5,
): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
        let n = 0;
        const attempt = () => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () =>
                ++n < tries
                    ? setTimeout(attempt, 250 * 2 ** n)
                    : rej(new Error("texture failed to load: " + src));
            im.src = src;
        };
        attempt();
    });
}

function loadImage(name: string) {
    return loadImageRetry(texUrl(name));
}

function tex(
    im: HTMLImageElement,
    { srgb = false, repeat = true, aniso = 8 } = {},
) {
    const t = new THREE.Texture(im);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
}

function arrayFromImages(
    images: HTMLImageElement[],
    size: number,
    { srgb, aniso }: { srgb: boolean; aniso: number },
) {
    const layers = images.reduce(
        (n, im) => n + Math.round(im.height / im.width),
        0,
    );
    const data = new Uint8Array(size * size * 4 * layers);
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const cx = cv.getContext("2d", { willReadFrequently: true })!;
    let L = 0;
    for (const im of images) {
        const n = Math.round(im.height / im.width);
        for (let i = 0; i < n; i++) {
            cx.clearRect(0, 0, size, size);
            cx.drawImage(
                im,
                0,
                i * im.width,
                im.width,
                im.width,
                0,
                0,
                size,
                size,
            );
            const d = cx.getImageData(0, 0, size, size).data;

            for (let y = 0; y < size; y++) {
                const src = (size - 1 - y) * size * 4;
                data.set(
                    d.subarray(src, src + size * 4),
                    (L * size * size + y * size) * 4,
                );
            }
            L++;
        }
    }
    const t = new THREE.DataArrayTexture(data, size, size, layers);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = aniso;
    t.needsUpdate = true;
    return t;
}

export async function loadCityTextures(renderer: THREE.WebGLRenderer) {
    const aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    const names = [
        "asphalt_col",
        "asphalt_nrm",
        "asphalt_macro",
        "sidewalk_col",
        "sidewalk_nrm",
        "walls_col.jpg",
        "walls_nrm.webp",
        "walls_hao.jpg",
        "curb_col.webp",
        "asphalt_decals.webp",
        "interiors",
        "signs",
        "markings",
        "leaves",
        "grass_col",
        "grass_nrm",
        "water_nrm",
        "noise",
        "detail_nrm",
    ];
    const ims = Object.fromEntries(
        await Promise.all(
            names.map(
                async (n) =>
                    [
                        n.replace(/\..*/, ""),
                        await loadImage(n.includes(".") ? n : n + ".png"),
                    ] as const,
            ),
        ),
    ) as Record<string, HTMLImageElement>;
    const markRects = await (await fetch(texUrl("markings.json"))).json();
    const T: any = {
        asphaltCol: tex(ims.asphalt_col, { srgb: true, aniso }),
        asphaltNrm: tex(ims.asphalt_nrm, { aniso }),
        asphaltMacro: tex(ims.asphalt_macro, { aniso }),
        sidewalkCol: tex(ims.sidewalk_col, { srgb: true, aniso }),
        sidewalkNrm: tex(ims.sidewalk_nrm, { aniso }),
        interiors: tex(ims.interiors, { srgb: true, repeat: false, aniso: 4 }),
        signs: tex(ims.signs, { srgb: true, repeat: false, aniso }),
        markings: tex(ims.markings, { srgb: true, repeat: false, aniso }),
        leaves: tex(ims.leaves, { repeat: false, aniso: 4 }),
        grassCol: tex(ims.grass_col, { srgb: true, aniso }),
        grassNrm: tex(ims.grass_nrm, { aniso }),
        detailNrm: tex(ims.detail_nrm, { aniso }),
        waterNrm: tex(ims.water_nrm, { aniso }),
        noise: tex(ims.noise, { aniso: 4 }),
        markRects,
    };

    T.wallsCol = arrayFromImages([ims.walls_col], 1024, { srgb: true, aniso });
    T.wallsNrm = arrayFromImages([ims.walls_nrm], 512, { srgb: false, aniso });
    T.asphaltDecals = tex(ims.asphalt_decals, { repeat: false, aniso });
    T.curbCol = tex(ims.curb_col, { srgb: true, aniso });
    T.wallsHao = arrayFromImages([ims.walls_hao], 512, { srgb: false, aniso });
    return T;
}
