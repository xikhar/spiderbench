import * as THREE from "three";
import { assetUrl } from "../assets.ts";
import { getLoadedKTX2Texture } from "../render/ktx2.ts";

export type AtlasColorGrid = {
  width: number;
  height: number;
  linearRgb: Float32Array;
};

type TextureLike = {
  colorSpace: string;
  anisotropy: number;
};

function loadSharedAtlasTexture(assetPath: string): TextureLike {
  const texture = getLoadedKTX2Texture(assetUrl(assetPath));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function loadLinearColorGrid(
  fileName: string,
  width: number,
  height: number,
): Promise<AtlasColorGrid | null> {
  return fetch(assetUrl(`city/environmentTextures/${fileName}`))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`color grid failed to load: ${fileName} (${response.status})`);
      }

      const srgbRgb = new Uint8Array(await response.arrayBuffer());
      if (srgbRgb.length !== width * height * 3) {
        throw new Error(`color grid has an invalid length: ${fileName}`);
      }

      const srgbToLinear = new Float32Array(256);
      for (let value = 0; value < srgbToLinear.length; value += 1) {
        const normalized = value / 255;
        srgbToLinear[value] = normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      }

      const linearRgb = new Float32Array(srgbRgb.length);
      for (let channel = 0; channel < srgbRgb.length; channel += 1) {
        linearRgb[channel] = srgbToLinear[srgbRgb[channel] ?? 0] ?? 0;
      }
      return { width, height, linearRgb };
    })
    .catch((error) => {
      console.warn(`[advertising] color grid ${fileName} is unavailable`, error);
      return null;
    });
}

let advertisingAtlas: TextureLike | null = null;
let advertisingColorGrid: Promise<AtlasColorGrid | null> | null = null;

function getAdvertisingAtlas(): TextureLike {
  advertisingAtlas ??= loadSharedAtlasTexture("city/environmentTextures/ts_ads.ktx2");
  return advertisingAtlas;
}

/** Return the shared GPU texture used by billboards and advertising screens. */
export function getAdvertisingAtlasTexture(): TextureLike {
  return getAdvertisingAtlas();
}

/** Load the small precomputed linear RGB grid used to light regions of the ad atlas. */
export function getAdvertisingColorGrid(): Promise<AtlasColorGrid | null> {
  advertisingColorGrid ??= loadLinearColorGrid("ts_ads_color_grid.bin", 256, 256);
  return advertisingColorGrid;
}

let signAtlas: TextureLike | null = null;
let signColorGrid: Promise<AtlasColorGrid | null> | null = null;
let signCellAverage: Promise<readonly (readonly [number, number, number])[]> | null = null;

function getSignAtlas(): TextureLike {
  signAtlas ??= loadSharedAtlasTexture("city/environmentTextures/ts_signs.ktx2");
  return signAtlas;
}

/** Return the shared GPU texture used by storefront signs. */
export function getSignAtlasTexture(): TextureLike {
  return getSignAtlas();
}

/** Load the small precomputed linear RGB grid used for sign and storefront lighting. */
export function getSignColorGrid(): Promise<AtlasColorGrid | null> {
  signColorGrid ??= loadLinearColorGrid("ts_signs_color_grid.bin", 128, 256);
  return signColorGrid;
}

/** Average the 64 cells in the sign atlas in linear RGB. */
export function getSignCellAverageLinearRgb(): Promise<readonly (readonly [number, number, number])[]> {
  signCellAverage ??= getSignColorGrid().then((grid) => {
    if (!grid) return [];

    const columns = 4;
    const rows = 16;
    const cellWidth = grid.width / columns;
    const cellHeight = grid.height / rows;
    const averages: (readonly [number, number, number])[] = [];

    for (let cell = 0; cell < columns * rows; cell += 1) {
      const x0 = (cell % columns) * cellWidth;
      const y0 = Math.floor(cell / columns) * cellHeight;
      let red = 0;
      let green = 0;
      let blue = 0;
      let count = 0;

      for (let y = y0; y < y0 + cellHeight; y += 1) {
        for (let x = x0; x < x0 + cellWidth; x += 1) {
          const offset = (y * grid.width + x) * 3;
          red += grid.linearRgb[offset] ?? 0;
          green += grid.linearRgb[offset + 1] ?? 0;
          blue += grid.linearRgb[offset + 2] ?? 0;
          count += 1;
        }
      }

      const divisor = Math.max(1, count);
      averages.push([red / divisor, green / divisor, blue / divisor]);
    }
    return averages;
  });
  return signCellAverage;
}
