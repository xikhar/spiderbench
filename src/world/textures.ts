// @ts-nocheck
// OWNER: citygeo. Loads the baked city textures (tools/blender/city_textures.py) and builds array textures.
// Colour maps are sRGB, every data map (normal/roughness, height/AO/weathering, noise) is linear; max anisotropy.
import * as THREE from "three";
import { assetUrl } from "../assets.ts";

const BASE = assetUrl("city/tex/");

// Retries with back-off: under load Chromium can refuse a request (net::ERR_INSUFFICIENT_RESOURCES), which must not
// abort the whole city build.
export function loadImageRetry(src, tries = 5) {
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

function loadImage(name) {
  return loadImageRetry(BASE + name);
}

function tex(im, { srgb = false, repeat = true, aniso = 8 } = {}) {
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

// Stack square images vertically in one tall image -> DataArrayTexture (layer i = i-th square)
function arrayFromImages(images, size, { srgb, aniso }) {
  const layers = images.reduce(
    (n, im) => n + Math.round(im.height / im.width),
    0,
  );
  const data = new Uint8Array(size * size * 4 * layers);
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  let L = 0;
  for (const im of images) {
    const n = Math.round(im.height / im.width);
    for (let i = 0; i < n; i++) {
      cx.clearRect(0, 0, size, size);
      cx.drawImage(im, 0, i * im.width, im.width, im.width, 0, 0, size, size);
      const d = cx.getImageData(0, 0, size, size).data;
      // flip Y so that v=0 is the bottom of the image (matches Texture.flipY behaviour)
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

export async function loadCityTextures(renderer) {
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
    "asphalt_decals.webp", // (textures r2) nrm: lossless webp (was a 20 MB png); granite curb; (textures r3) road repair decals
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
      names.map(async (n) => [
        n.replace(/\..*/, ""),
        await loadImage(n.includes(".") ? n : n + ".png"),
      ]),
    ),
  );
  const markRects = await (await fetch(BASE + "markings.json")).json();
  const T = {
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
  // facade layers 0..7 + roofs 8..12 + (textures r2) 13 terracotta, 14 stucco, 15 red brick 2; hao layer 16 = grime decals
  T.wallsCol = arrayFromImages([ims.walls_col], 1024, { srgb: true, aniso });
  T.wallsNrm = arrayFromImages([ims.walls_nrm], 512, { srgb: false, aniso }); // (textures r2) 512/layer (webp, half the VRAM)
  T.asphaltDecals = tex(ims.asphalt_decals, { repeat: false, aniso }); // (textures r3) $imagegen asphalt repair decals (colour ratio x0.5, linear)
  T.curbCol = tex(ims.curb_col, { srgb: true, aniso }); // (textures r2) $imagegen granite curbstone (ground.js sidewalk material)
  T.wallsHao = arrayFromImages([ims.walls_hao], 512, { srgb: false, aniso });
  return T;
}
