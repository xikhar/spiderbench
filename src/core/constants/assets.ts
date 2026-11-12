/**
 * Asset path registry and URL resolution helpers for bundled game resources.
 *
 * @module core-constants-assets
 * @version 1.0.0
 * @file src/core/constants/assets.ts
 * @since 0.0.1
 * @description Defines the ASSETS map for audio, models, data, textures, and styles and exports resolveAssetPath for resolving asset-relative URLs.
 */

const assetUrl = (path: string): string =>
    new URL(`../assets/${path}`, import.meta.url).href;

export const ASSETS = {
    audio: {
        manifest: assetUrl("audio/manifest.json"),
        base: new URL("../assets/audio/", import.meta.url).href,
    },
    models: {
        spiderman: assetUrl("models/characters/spiderman.glb"),
        thug: assetUrl("models/enemies/thug.glb"),
        props: assetUrl("models/city/props.glb"),
        vehicles: assetUrl("models/city/vehicles.glb"),
    },
    data: {
        markings: assetUrl("data/city/markings.json"),
        vehiclesAtlas: assetUrl("data/city/vehicles_atlas.json"),
        peopleJson: assetUrl("data/city/npc/people.json"),
        peopleBin: assetUrl("data/city/npc/people.bin"),
    },
    textures: {
        pedsAtlas: assetUrl("textures/city/peds_atlas.webp"),
        peopleBake: assetUrl("textures/city/npc/people_bake.webp"),
        roofCol: assetUrl("textures/city/roof_col.png"),
        roofNrm: assetUrl("textures/city/roof_nrm.png"),
        roofplants: assetUrl("textures/city/roofplants.webp"),
        tsAds: assetUrl("textures/city/ts_ads.webp"),
        tsSigns: assetUrl("textures/city/ts_signs.webp"),
        neonWords: assetUrl("textures/city/neon_words.webp"),
        bruteBase: assetUrl("textures/enemies/brute/brute_basecolor.webp"),
        thugBaseB: assetUrl("textures/enemies/thug/thug_basecolor_b.webp"),
        thugBaseC: assetUrl("textures/enemies/thug/thug_basecolor_c.webp"),
        suitWeaveHex: assetUrl(
            "textures/characters/spiderman/suit_weave_hex.png",
        ),
        suitWeaveKnit: assetUrl(
            "textures/characters/spiderman/suit_weave_knit.png",
        ),
    },
    styles: {
        fonts: assetUrl("../styles/fonts.css"),
    },
} as const;

export function resolveAssetPath(path: string): string {
    return assetUrl(path.replace(/^\/?assets\//, ""));
}
