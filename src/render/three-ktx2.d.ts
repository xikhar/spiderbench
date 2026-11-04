declare module "three/addons/loaders/KTX2Loader.js" {
  import type { CompressedTexture } from "three";

  export class KTX2Loader {
    detectSupport(renderer: unknown): this;
    loadAsync(url: string): Promise<CompressedTexture>;
  }
}
