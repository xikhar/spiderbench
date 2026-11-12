/**
 * Capability layer is the boundary; no prototype patching.
 *
 * @module src-render-common
 * @version 1.0.0
 * @file src/render/common.ts
 * @since 0.0.1
 */

import * as THREE from "three";

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

export const FS_VERT = `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export interface FSPassOptions {
    uniforms?: Record<string, THREE.IUniform>;
    fragmentShader: string;
    defines?: Record<string, string | number>;
    blending?: THREE.Blending;
    name?: string;
}

/** Fullscreen pass wrapping a RawShaderMaterial-ish ShaderMaterial (GLSL3). */
export class FSPass {
    static all: FSPass[] = [];
    static camera: THREE.Camera = _cam;
    material: THREE.ShaderMaterial;
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    uniforms: Record<string, THREE.IUniform>;

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
        this.uniforms = this.material.uniforms as Record<
            string,
            THREE.IUniform
        >;
    }
    render(
        renderer: THREE.WebGLRenderer,
        target?: THREE.WebGLRenderTarget | null,
    ): void {
        renderer.setRenderTarget(target ?? null);
        renderer.render(this.mesh, _cam);
    }
}

export interface MakeRTOptions {
    type?: THREE.TextureDataType;
    format?: THREE.PixelFormat;
    filter?: THREE.MagnificationTextureFilter;
    depthBuffer?: boolean;
    depthTexture?: THREE.DepthTexture;
    count?: number;
}

export function makeRT(
    w: number,
    h: number,
    opts: MakeRTOptions = {},
): THREE.WebGLRenderTarget {
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

export const GLSL_DEPTH = `
uniform mat4 uProjInv;
uniform float uReversed; // 1.0 when renderer uses reversed depth (EXT_clip_control, [0,1] NDC z)
bool isSky(float d) { return uReversed > 0.5 ? d <= 0.0 : d >= 1.0; }
vec3 viewPosFromDepth(vec2 uv, float d) {
  float z = uReversed > 0.5 ? d : d * 2.0 - 1.0;
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, z, 1.0);
  return p.xyz / p.w;
}
vec3 viewDirFromUv(vec2 uv) {
  vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, 0.5, 1.0);
  return normalize(p.xyz / p.w);
}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

export const GLSL_COLOR = `
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 linearToSRGB(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
`;

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
