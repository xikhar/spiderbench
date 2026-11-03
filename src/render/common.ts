import __shaderRaw1 from "./shaders/vertex/common-fs_vert.vert?raw";
import __shaderRaw2 from "./shaders/glsl/common-glsl_depth.glsl?raw";
import __shaderRaw3 from "./shaders/glsl/common-glsl_color.glsl?raw";
// OWNER: render agent. Small shared helpers for the render module (fullscreen passes, RTs, GLSL snippets).
import * as THREE from "three";

type PassUniform = { value: unknown };

type FSPassOptions = {
  uniforms?: Record<string, PassUniform>;
  fragmentShader: string;
  defines?: Record<string, string | number | boolean>;
  blending?: number;
  name?: string;
};

type RenderTargetOptions = {
  type?: number;
  format?: number;
  filter?: number;
  depthBuffer?: boolean;
  count?: number;
  depthTexture?: unknown;
};

type FullscreenRenderer = {
  setRenderTarget(target: unknown): void;
  render(object: unknown, camera: unknown): void;
};

const _tri = new THREE.BufferGeometry();
_tri.setAttribute(
  "position",
  new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
);
_tri.setAttribute(
  "uv",
  new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2),
);
const _cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export const FS_VERT = __shaderRaw1;

/** Fullscreen pass wrapping a RawShaderMaterial-ish ShaderMaterial (GLSL3). */
export class FSPass {
  static all: FSPass[] = []; // (perf r3) render/warmup.js pre-compiles the passes that only run later (motion blur, DOF, ...)
  static camera: unknown = _cam;
  readonly material: any;
  readonly mesh: any;
  readonly uniforms: Record<string, PassUniform>;

  constructor({
    uniforms = {},
    fragmentShader,
    defines = {},
    blending = THREE.NoBlending,
    name = "pass",
  }: FSPassOptions) {
    FSPass.all.push(this);
    this.material = new THREE.ShaderMaterial({
      name,
      uniforms,
      defines,
      glslVersion: THREE.GLSL3,
      vertexShader: FS_VERT,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      blending,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(_tri, this.material);
    this.mesh.frustumCulled = false;
    this.uniforms = this.material.uniforms;
  }
  render(renderer: FullscreenRenderer, target: unknown = null): void {
    renderer.setRenderTarget(target ?? null);
    renderer.render(this.mesh, _cam);
  }
}

export function makeRT(
  w: number,
  h: number,
  opts: RenderTargetOptions = {},
): any {
  const rt = new THREE.WebGLRenderTarget(
    Math.max(1, w | 0),
    Math.max(1, h | 0),
    {
      type: opts.type ?? THREE.HalfFloatType,
      format: opts.format ?? THREE.RGBAFormat,
      minFilter: opts.filter ?? THREE.LinearFilter,
      magFilter: opts.filter ?? THREE.LinearFilter,
      depthBuffer: opts.depthBuffer ?? false,
      stencilBuffer: false,
      generateMipmaps: false,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      colorSpace: THREE.NoColorSpace,
      count: opts.count ?? 1,
    },
  );
  if (opts.depthTexture) rt.depthTexture = opts.depthTexture;
  return rt;
}

// GLSL: reconstruct view-space position from a depth-texture sample. Works for standard and reversed depth.
export const GLSL_DEPTH = __shaderRaw2;

export const GLSL_COLOR = __shaderRaw3;

export function halton(i: number, b: number): number {
  let f = 1,
    r = 0;
  while (i > 0) {
    f /= b;
    r += f * (i % b);
    i = Math.floor(i / b);
  }
  return r;
}
