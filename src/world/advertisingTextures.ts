import * as THREE from "three";
import { assetUrl } from "../assets.ts";
import {
  getLoadedKTX2Texture,
} from "../render/ktx2.ts";
import { loadImageRetry } from "./textures.ts";

export type AtlasColorGrid = {
  width: number;
  height: number;
  linearRgb: Float32Array;
};

type TextureLike = {
  colorSpace: string;
  anisotropy: number;
  image?: CanvasImageSource;
};

type SharedAtlasTexture = {
  texture: TextureLike;
  getImage: () => Promise<CanvasImageSource | null>;
};

function loadSharedAtlasTexture(assetPath: string): SharedAtlasTexture {
  const texture = getLoadedKTX2Texture(assetUrl(assetPath));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  let image: Promise<CanvasImageSource | null> | null = null;
  return {
    texture,
    getImage: () => {
      image ??= loadImageRetry(assetUrl(assetPath))
        .then((loadedImage) => loadedImage as CanvasImageSource)
        .catch(() => null);
      return image!;
    },
  };
}

function createLinearColorGrid(
  image: CanvasImageSource | null,
  width: number,
  height: number,
): AtlasColorGrid | null {
  if (!image || typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const rgbaPixels = context.getImageData(0, 0, width, height).data;
  const srgbToLinear = new Float32Array(256);
  for (let value = 0; value < srgbToLinear.length; value += 1) {
    const normalized = value / 255;
    srgbToLinear[value] =
      normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
  }

  const linearRgb = new Float32Array(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const rgbaOffset = pixel * 4;
    const rgbOffset = pixel * 3;
    const redByte = rgbaPixels[rgbaOffset] ?? 0;
    const greenByte = rgbaPixels[rgbaOffset + 1] ?? 0;
    const blueByte = rgbaPixels[rgbaOffset + 2] ?? 0;
    linearRgb[rgbOffset] = srgbToLinear[redByte] ?? 0;
    linearRgb[rgbOffset + 1] = srgbToLinear[greenByte] ?? 0;
    linearRgb[rgbOffset + 2] = srgbToLinear[blueByte] ?? 0;
  }

  return { width, height, linearRgb };
}

let advertisingAtlas: SharedAtlasTexture | null = null;
let advertisingColorGrid: Promise<AtlasColorGrid | null> | null = null;

function getAdvertisingAtlas(): SharedAtlasTexture {
  advertisingAtlas ??= loadSharedAtlasTexture("city/tex/ts_ads.webp");
  return advertisingAtlas;
}

/** Return the shared GPU texture used by billboards and advertising screens. */
export function getAdvertisingAtlasTexture(): TextureLike {
  return getAdvertisingAtlas().texture;
}

/** Decode a small linear RGB grid for per-panel screen-light colors. */
export function getAdvertisingColorGrid(): Promise<AtlasColorGrid | null> {
  const atlas = getAdvertisingAtlas();
  advertisingColorGrid ??= atlas.getImage().then((image) => {
    try {
      return createLinearColorGrid(image, 256, 256);
    } catch (error) {
      console.warn("[advertising] could not create the ad color grid", error);
      return null;
    }
  });
  return advertisingColorGrid;
}

let signAtlas: SharedAtlasTexture | null = null;
let signColorGrid: Promise<AtlasColorGrid | null> | null = null;

function getSignAtlas(): SharedAtlasTexture {
  signAtlas ??= loadSharedAtlasTexture("city/tex/ts_signs.webp");
  return signAtlas;
}

/** Return the shared GPU texture used by storefront signs. */
export function getSignAtlasTexture(): TextureLike {
  return getSignAtlas().texture;
}

/** Decode a small linear RGB grid for storefront sign lighting. */
export function getSignColorGrid(): Promise<AtlasColorGrid | null> {
  const atlas = getSignAtlas();
  signColorGrid ??= atlas.getImage().then((image) => {
    try {
      return createLinearColorGrid(image, 128, 256);
    } catch {
      return null;
    }
  });
  return signColorGrid;
}
