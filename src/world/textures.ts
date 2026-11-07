// @ts-nocheck
// Loads the baked city textures (tools/blender/city_textures.py). Colour maps are sRGB, every data map
// (normal/roughness, height/AO/weathering, noise) is linear; max anisotropy.
import * as THREE from "three";
import { assetUrl } from "../assets.ts";
import { loadKTX2TextureAsync } from "../render/ktx2.ts";

const BASE = assetUrl("city/environmentTextures/");

function tex(image, { srgb = false, repeat = true, aniso = 8 } = {}) {
  const texture = image.isCompressedTexture ? image : new THREE.Texture(image);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = aniso;
  texture.generateMipmaps = !image.isCompressedTexture;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export async function loadCityTextures(renderer) {
  const aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const textureSources = {
    walls_col: "walls_col.ktx2",
    walls_nrm: "walls_nrm.ktx2",
    walls_hao: "walls_hao.ktx2",
    asphalt_col: "asphalt_col.ktx2",
    asphalt_nrm: "asphalt_nrm.ktx2",
    asphalt_macro: "asphalt_macro.ktx2",
    sidewalk_col: "sidewalk_col.ktx2",
    sidewalk_nrm: "sidewalk_nrm.ktx2",
    curb_col: "curb_col.ktx2",
    asphalt_decals: "asphalt_decals.ktx2",
    interiors: "interiors.ktx2",
    signs: "signs.ktx2",
    markings: "markings.ktx2",
    leaves: "leaves.ktx2",
    grass_col: "grass_col.ktx2",
    grass_nrm: "grass_nrm.ktx2",
    water_nrm: "water_nrm.ktx2",
    noise: "noise.ktx2",
    detail_nrm: "detail_nrm.ktx2",
  };
  const textureEntries = await Promise.all(
    Object.entries(textureSources).map(async ([key, file]) => [
      key,
      await loadKTX2TextureAsync(BASE + file),
    ]),
  );
  const ims = Object.fromEntries(textureEntries);
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
  // These inputs are KTX2 array textures; each layer retains independent mip levels.
  T.wallsCol = tex(ims.walls_col, { srgb: true, aniso });
  T.wallsNrm = tex(ims.walls_nrm, { aniso });
  T.wallsHao = tex(ims.walls_hao, { aniso });
  T.asphaltDecals = tex(ims.asphalt_decals, { repeat: false, aniso });
  T.curbCol = tex(ims.curb_col, { srgb: true, aniso });
  return T;
}
