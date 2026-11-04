import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

let loader: KTX2Loader | null = null;
const texturePromises = new Map<string, ReturnType<KTX2Loader["loadAsync"]>>();
const loadedTextures = new Map<string, Awaited<ReturnType<KTX2Loader["loadAsync"]>>>();

/** Configure KTX2 transcoding for the renderer before requesting any textures. */
export function configureKTX2Loader(renderer: unknown): KTX2Loader {
  if (loader) return loader;
  loader = new KTX2Loader();
  loader.detectSupport(renderer);
  return loader;
}

function getLoader(): KTX2Loader {
  if (!loader) {
    throw new Error("KTX2Loader must be configured with a renderer before use.");
  }
  return loader;
}

/** Map an original image URL to its generated KTX2 sibling, preserving query/hash suffixes. */
export function ktx2Url(sourceUrl: string): string {
  const suffixOffset = sourceUrl.search(/[?#]/);
  const resource = suffixOffset < 0 ? sourceUrl : sourceUrl.slice(0, suffixOffset);
  const suffix = suffixOffset < 0 ? "" : sourceUrl.slice(suffixOffset);

  // These four source files had the same stem but different contents, so their
  // generated siblings retain the source extension to keep both variants.
  if (/\/thug_basecolor_[bc]\.(?:png|webp)$/i.test(resource)) {
    return `${resource}.ktx2${suffix}`;
  }

  return `${resource.replace(/\.(?:png|jpe?g|webp)$/i, ".ktx2")}${suffix}`;
}

export function loadKTX2TextureAsync(sourceUrl: string) {
  const url = ktx2Url(sourceUrl);
  let pending = texturePromises.get(url);
  if (!pending) {
    pending = getLoader()
      .loadAsync(url)
      .then((texture) => {
        loadedTextures.set(url, texture);
        return texture;
      });
    texturePromises.set(url, pending);
  }
  return pending;
}

/** Preload KTX2 files for synchronous builders that take an already loaded Texture. */
export async function preloadKTX2TexturesAsync(sourceUrls: string[]) {
  await Promise.all(sourceUrls.map(loadKTX2TextureAsync));
}

/** Get a texture previously loaded by loadKTX2TextureAsync or preloadKTX2TexturesAsync. */
export function getLoadedKTX2Texture(sourceUrl: string) {
  const url = ktx2Url(sourceUrl);
  const texture = loadedTextures.get(url);
  if (!texture) {
    throw new Error(`KTX2 texture was not preloaded: ${url}`);
  }
  return texture;
}
