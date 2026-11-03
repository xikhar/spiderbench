// @ts-nocheck
// OWNER: billboards agent. (r3) ONE shared GPU copy of the ad atlas ts_ads.webp (4096^2, ~85 MB with mips): Times Square,
// city signage and street-prop ad faces all sample the same texture instead of uploading it three times.
import * as THREE from "three";
import { assetUrl } from "../assets.ts";
let tex = null,
  texImg = null;
export function adsTexture() {
  if (!tex) {
    texImg = new Promise((res) => {
      tex = new THREE.TextureLoader().load(
        assetUrl("city/tex/ts_ads.webp"),
        (t) => res(t.image),
        undefined,
        () => res(null),
      );
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }
  return tex;
}
// (night r9) colour grid of an atlas image: a W x H linear-RGB downsample (one canvas draw of the already decoded image,
// once), for the per-region colours of the billboard / screen lights (screenlights.js regionAvg)
function gridOf(img, W, H) {
  if (!img || typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.imageSmoothingQuality = "high";
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
let adsG = null;
export function adsGrid() {
  adsTexture();
  return (adsG ??= texImg.then((img) => {
    try {
      return gridOf(img, 256, 256);
    } catch (e) {
      console.warn("[adstex] grid", e);
      return null;
    }
  }));
}
// (night r5) ONE shared GPU copy of the storefront sign atlas ts_signs.webp (2048^2, 64 signs 512x128, 4 x 16 cells):
// Times Square sign bands / neon, signage.js fascias / blades and props.js blade-sign faces
let signs = null,
  signsImg = null,
  signsG = null;
export function signsGrid() {
  signsTexture();
  return (signsG ??= signsImg.then((img) => {
    try {
      return gridOf(img, 128, 256);
    } catch (e) {
      return null;
    }
  }));
}
export function signsTexture() {
  if (!signs) {
    signsImg = new Promise((res) => {
      signs = new THREE.TextureLoader().load(
        assetUrl("city/tex/ts_signs.webp"),
        (t) => res(t.image),
        undefined,
        () => res(null),
      );
    });
    signs.colorSpace = THREE.SRGBColorSpace;
    signs.anisotropy = 8;
  }
  return signs;
}
