/**
 * Cascaded shadow mapping implementation and shader integration for directional sunlight.
 *
 * @module render-csm
 * @version 1.0.0
 * @file src/render/this.ts
 * @since 0.0.1
 * @description Implements the CSM class and shader chunk patches to manage cascade fitting, shadow map updates, caster culling, and optional character-focused shadow cascades.
 */

import * as THREE from "three";

let _installed = false;
export const CHAR_LAYER = 30;
export const BIG_CASTER_LAYER = 28;
export const SHADOW_PROXY_LAYER = 29;
export const csmShared: {
    params: THREE.Vector4;
    proxyShadows?: boolean;
    view?: { x: number; z: number; cos: number };
} = {
    params: new THREE.Vector4(0, 0.1, 1, 0),
};

function installChunks(N: number, taps: number, charCascade: number): void {
    if (_installed) return;
    _installed = true;
    const SC = THREE.ShaderChunk;
    let tryCode = "";

    for (let i = 0; i < N; i++) {
        tryCode += `
  #if NUM_DIR_LIGHT_SHADOWS > ${i}
  if (!done) {
    vec4 sc = vDirectionalShadowCoord[ ${i} ];
    vec3 c = sc.xyz / sc.w;
    vec2 e = min(c.xy, 1.0 - c.xy);
    float edge = min(e.x, e.y);
    // world-anchored dither (hash of the light-space texel): the cascade choice in the blend band does not crawl
    // when the camera moves, and does not change from frame to frame
    float rnd = fract( sin( dot( floor( c.xy * 1024.0 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    if (edge > csmData.params.y * rnd && c.z <= 1.0 && c.z >= 0.0) {
      DirectionalLightShadow dls = directionalLightShadows[ ${i} ];
      #if defined( SHADOWMAP_TYPE_PCF )
        s = csmPCF( directionalShadowMap[ ${i} ], dls.shadowMapSize, dls.shadowBias, dls.shadowRadius, sc, phi );
      #else
        s = getShadow( directionalShadowMap[ ${i} ], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, sc );
      #endif
      done = true;
    }
  }
  #endif`;
    }
    if (charCascade)
        tryCode += `
  #if NUM_DIR_LIGHT_SHADOWS > ${N}
  {
    vec4 sc = vDirectionalShadowCoord[ ${N} ];
    vec3 c = sc.xyz / sc.w;
    vec2 e = min(c.xy, 1.0 - c.xy);
    if (min(e.x, e.y) > 0.02 && c.z <= 1.0 && c.z >= 0.0) {
      DirectionalLightShadow dls = directionalLightShadows[ ${N} ];
      #if defined( SHADOWMAP_TYPE_PCF )
        s = min( s, csmPCF( directionalShadowMap[ ${N} ], dls.shadowMapSize, dls.shadowBias, dls.shadowRadius, sc, phi ) );
      #endif
    }
  }
  #endif`;
    const pars = /* glsl */ `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
  struct CSMData { vec4 params; };
  uniform CSMData csmData;
  #define CSM_TAPS ${taps}
  #if defined( SHADOWMAP_TYPE_PCF )
  float csmPCF( sampler2DShadow map, vec2 size, float bias, float radius, vec4 sc, float phi ) {
    vec3 c = sc.xyz / sc.w; c.z += bias;
    float r = radius / size.x; float s = 0.0;
    for (int k = 0; k < CSM_TAPS; k++) s += texture( map, vec3( c.xy + vogelDiskSample( k, CSM_TAPS, phi ) * r, c.z ) );
    return s / float( CSM_TAPS );
  }
  #endif
  float csmShadow() {
    float n0 = interleavedGradientNoise( gl_FragCoord.xy );
    float phi = fract( n0 + csmData.params.x ) * PI2;
    float s = 1.0; bool done = false;
    ${tryCode}
    return s;
  }
#endif
`;
    if (!SC.shadowmap_pars_fragment.includes("csmShadow"))
        SC.shadowmap_pars_fragment = SC.shadowmap_pars_fragment + pars;

    const src = SC.lights_fragment_begin;
    const start = src.indexOf(
        "#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )",
    );
    const end = src.indexOf("#if ( NUM_RECT_AREA_LIGHTS > 0 )");
    if (start < 0 || end < 0) {
        console.error("[render/csm] could not patch lights_fragment_begin");
        return;
    }
    const block = /* glsl */ `
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )

	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif

	// CSM sun: light 0 carries radiance; cascades 0..${N - 1} provide shadow maps
	directionalLight = directionalLights[ 0 ];
	getDirectionalLightInfo( directionalLight, directLight );
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	directLight.color *= ( directLight.visible && receiveShadow ) ? csmShadow() : 1.0;
	#endif
	#if defined( STANDARD ) || defined( LAMBERT )
	{ // (night r6) moon on up-facing roofs / ground x shape.y^2 (1 by day): pale roofs read frosted from above (critic)
		float csmUp = saturate( dot( geometryNormal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ) );
		directLight.color *= mix( 1.0, ambData.shape.y * ambData.shape.y, csmUp );
	}
	#endif
	{ // the sun is a disc, not a point: widen the specular lobe of very smooth surfaces for the key light only
	#ifdef STANDARD
	float csmR = material.roughness; material.roughness = max( csmR, 0.09 );
	RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	material.roughness = csmR;
	#else
	RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	#endif
	}

	#if NUM_DIR_LIGHTS > ${N + (charCascade ? 1 : 0)}
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		#if ( UNROLLED_LOOP_INDEX >= ${N + (charCascade ? 1 : 0)} )
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
		#endif
	}
	#pragma unroll_loop_end
	#endif

#endif

`;
    SC.lights_fragment_begin = src.slice(0, start) + block + src.slice(end);

    for (const k of [
        "standard",
        "physical",
        "lambert",
        "phong",
        "toon",
    ] as const) {
        const lib = THREE.ShaderLib[k];
        if (lib) lib.uniforms.csmData = { value: csmShared };
    }
}

function installUniformCache(renderer: THREE.WebGLRenderer): void {
    const gl = renderer.getContext() as WebGL2RenderingContext & {
        __uCache?: boolean;
    };
    if (!gl || gl.__uCache) return;
    gl.__uCache = true;
    const last = new WeakMap<WebGLUniformLocation, Float32Array>();
    for (const fn of ["uniformMatrix4fv", "uniformMatrix3fv"] as const) {
        const orig = (gl as any)[fn].bind(gl) as (...args: any[]) => any;
        (gl as any)[fn] = function (
            loc: WebGLUniformLocation | null,
            transpose: boolean,
            data: ArrayLike<number> | null,
            srcOffset?: number,
            srcLength?: number,
        ) {
            if (loc && data && srcOffset === undefined && data.length > 16) {
                const prev = last.get(loc);
                if (prev && prev.length === data.length) {
                    let same = true;
                    for (let i = 0; i < data.length; i++)
                        if (prev[i] !== (data as ArrayLike<number>)[i]) {
                            same = false;
                            break;
                        }
                    if (same) return;
                    prev.set(data as ArrayLike<number>);
                } else
                    last.set(loc, Float32Array.from(data as ArrayLike<number>));
            }
            return srcOffset === undefined
                ? orig(loc, transpose, data)
                : orig(loc, transpose, data, srcOffset, srcLength);
        };
    }
}

export interface CSMOptions {
    scene: THREE.Scene;
    quality: import("./quality.ts").QualityPreset;
    reversed: boolean;
    renderer?: THREE.WebGLRenderer | null;
}

export class CSM {
    N: number;
    splits: number[];
    size: number;
    reversed: boolean;
    charSize: number;
    sunDir: THREE.Vector3;
    lights: THREE.DirectionalLight[];
    frame: number;
    periods: number[];
    sun: THREE.DirectionalLight;
    charLight: THREE.DirectionalLight | null;
    focus: THREE.Vector3 | null;
    charRadius: number;
    forceAll: boolean;
    private _tagged: WeakSet<THREE.Object3D>;
    private _tagFrame: number;
    private _fwd: THREE.Vector3;
    private _c: THREE.Vector3;
    private _r: THREE.Vector3;
    private _u: THREE.Vector3;
    private _tmp: THREE.Vector3;
    private _layerFix?: boolean;
    private _charObj?: THREE.Object3D | null;
    private _charCount?: number;
    private _big?: Array<THREE.Object3D | THREE.Box3[]>;
    private _capped?: THREE.Object3D[];
    private _bigMemo?: WeakMap<THREE.Object3D, any>;
    private _cellBoxes?: WeakMap<THREE.Object3D, any>;

    constructor({ scene, quality, reversed, renderer }: CSMOptions) {
        this.N = quality.cascades;
        this.splits = quality.splits.slice();
        this.size = quality.shadowMapSize;
        this.reversed = reversed;
        this.charSize = quality.charShadow || 0;
        installChunks(this.N, quality.shadowTaps, this.charSize > 0 ? 1 : 0);
        this.sunDir = new THREE.Vector3(0.5, 0.7, 0.3).normalize();
        this.lights = [];
        this.frame = 0;

        this.periods = [1, 2, 4, 8, 8].slice(0, this.N);
        const radii = [1.6, 1.25, 1.1, 1.0, 1.0];
        for (let i = 0; i < this.N; i++) {
            const l = new THREE.DirectionalLight(0xffffff, i === 0 ? 1 : 0);
            l.name = "CSM_" + i;
            l.castShadow = true;
            const sz =
                i === this.N - 1 && this.N > 2 ? this.size >> 1 : this.size;
            l.shadow.mapSize.set(sz, sz);
            l.shadow.radius = radii[i] * (sz < this.size ? 0.6 : 1);
            l.shadow.autoUpdate = false;
            l.shadow.needsUpdate = true;
            scene.add(l);
            scene.add(l.target);
            this.lights.push(l);
        }
        this.sun = this.lights[0];

        for (let i = 3; i < this.N; i++)
            this.lights[i].shadow.camera.layers.set(BIG_CASTER_LAYER);

        if (quality.perf !== false)
            for (let i = 2; i < this.N; i++)
                this.lights[i].shadow.camera.layers.enable(
                    i >= 3 ? BIG_CASTER_LAYER : SHADOW_PROXY_LAYER,
                );
        csmShared.proxyShadows = quality.perf !== false && !!renderer;
        this._tagged = new WeakSet();
        this._tagFrame = 0;

        this.charLight = null;
        this.focus = null;
        this.charRadius = 1.6;
        if (this.charSize > 0) {
            const l = new THREE.DirectionalLight(0xffffff, 0);
            l.name = "CSM_char";
            l.castShadow = true;
            l.shadow.mapSize.set(this.charSize, this.charSize);
            l.shadow.radius = 2.0;
            l.shadow.autoUpdate = false;
            l.shadow.needsUpdate = true;
            l.shadow.camera.layers.set(CHAR_LAYER);
            scene.add(l);
            scene.add(l.target);
            this.charLight = l;
        }

        for (const l of [...this.lights, this.charLight]) {
            if (!l || l.shadow.map) continue;
            const s = l.shadow.mapSize;
            const rt = new THREE.WebGLRenderTarget(s.x, s.y);
            const dt = new THREE.DepthTexture(s.x, s.y, THREE.UnsignedIntType);
            dt.name = l.name + ".shadowMap";
            dt.format = THREE.DepthFormat;
            dt.compareFunction = reversed
                ? THREE.GreaterEqualCompare
                : THREE.LessEqualCompare;
            dt.minFilter = dt.magFilter = THREE.LinearFilter;
            rt.depthTexture = dt;
            rt.texture.name = l.name + ".shadowMap";
            l.shadow.map = rt;
            renderer?.initRenderTarget?.(rt);
        }

        if (quality.perf !== false && renderer) {
            this._installLayerFix(renderer);
            this._layerFix = true;
        }
        if (
            quality.perf !== false &&
            renderer &&
            !/[?&](perf2off|noucache)\b/.test(globalThis.location?.search ?? "")
        )
            installUniformCache(renderer);
        this._fwd = new THREE.Vector3();
        this._c = new THREE.Vector3();
        this._r = new THREE.Vector3();
        this._u = new THREE.Vector3();
        this._tmp = new THREE.Vector3();
        this.forceAll = true;
    }

    _collectBig(scene: THREE.Scene): void {
        const L: Array<THREE.Object3D | THREE.Box3[]> = (this._big = []);
        const C: THREE.Object3D[] = (this._capped = []);

        const memo = (this._bigMemo ??= new WeakMap());
        scene.traverse((o) => {
            if (
                ((o.userData as any)?.maxCascade !== undefined ||
                    (o.userData as any)?.minCascade !== undefined) &&
                (o as THREE.Mesh).castShadow
            )
                C.push(o);
            if (
                !(o as THREE.Mesh).isMesh ||
                (o as THREE.SkinnedMesh).isSkinnedMesh ||
                !(o as THREE.Mesh).frustumCulled ||
                !(o as THREE.Mesh).geometry ||
                !(o as THREE.Mesh).castShadow ||
                (o.userData as any)?.dynamic
            )
                return;
            const g = (o as THREE.Mesh).geometry;
            if (
                (o as THREE.InstancedMesh).isInstancedMesh &&
                !(o as THREE.InstancedMesh).count
            )
                return;
            o.updateWorldMatrix(true, false);
            const me = o.matrixWorld.elements,
                iv = (o as THREE.InstancedMesh).isInstancedMesh
                    ? (o as THREE.InstancedMesh).instanceMatrix.version
                    : -1,
                pc =
                    (g.attributes.position as THREE.BufferAttribute | undefined)
                        ?.count ?? 0;
            let mm = memo.get(o);
            if (
                mm &&
                mm.g === g &&
                mm.n ===
                    ((o as THREE.InstancedMesh).isInstancedMesh
                        ? (o as THREE.InstancedMesh).count
                        : -1) &&
                mm.iv === iv &&
                mm.pc === pc &&
                mm.bb === g.boundingBox &&
                (!mm.bb ||
                    (mm.bb.min.equals(mm.b0) && mm.bb.max.equals(mm.b1))) &&
                me.every((v: number, i: number) => v === mm.m[i])
            ) {
                if (mm.boxes) L.push(o, mm.boxes);
                return;
            }
            if ((o as THREE.InstancedMesh).isInstancedMesh)
                (o as THREE.InstancedMesh).computeBoundingBox();
            else if (!g.boundingBox) g.computeBoundingBox();
            mm = {
                g,
                n: (o as THREE.InstancedMesh).isInstancedMesh
                    ? (o as THREE.InstancedMesh).count
                    : -1,
                iv,
                pc,
                bb: g.boundingBox,
                b0: g.boundingBox?.min.clone(),
                b1: g.boundingBox?.max.clone(),
                m: me.slice(),
                boxes: null,
            };
            memo.set(o, mm);
            const bb = (o as THREE.InstancedMesh).isInstancedMesh
                ? (o as THREE.InstancedMesh).boundingBox
                : g.boundingBox;
            if (!bb || bb.isEmpty()) return;
            const box = bb.clone().applyMatrix4(o.matrixWorld);
            if (
                box.max.x - box.min.x < 60 &&
                box.max.z - box.min.z < 60 &&
                box.max.y - box.min.y < 60
            )
                return;

            let boxes: THREE.Box3[] = [box];
            if (
                !(o as THREE.InstancedMesh).isInstancedMesh &&
                (box.max.x - box.min.x > 512 || box.max.z - box.min.z > 512)
            ) {
                const c = (this._cellBoxes ??= new WeakMap());
                let e = c.get(o);
                if (
                    !e ||
                    e.g !== g ||
                    e.n !==
                        (g.attributes.position as THREE.BufferAttribute).count
                ) {
                    const pos = g.attributes.position as THREE.BufferAttribute,
                        v = new THREE.Vector3(),
                        cells = new Map<number, THREE.Box3>();
                    for (let i = 0; i < pos.count; i++) {
                        v.fromBufferAttribute(pos, i).applyMatrix4(
                            o.matrixWorld,
                        );
                        const k =
                            Math.floor(v.x / 256) * 65536 +
                            Math.floor(v.z / 256);
                        let b = cells.get(k);
                        if (!b) cells.set(k, (b = new THREE.Box3()));
                        b.expandByPoint(v);
                    }
                    c.set(
                        o,
                        (e = { g, n: pos.count, boxes: [...cells.values()] }),
                    );
                }
                boxes = e.boxes;
            }
            mm.boxes = boxes;
            L.push(o, boxes);
        });
    }
    _installLayerFix(renderer: THREE.WebGLRenderer): void {
        const sm = renderer.shadowMap as THREE.WebGLShadowMap & {
                render: (...args: any[]) => any;
            },
            orig = sm.render,
            one: Array<THREE.Light | null> = [null],
            hid: THREE.Object3D[] = [];
        const csm = this;
        sm.render = function (
            lights: THREE.Light[],
            scene: THREE.Scene,
            camera: THREE.Camera,
        ) {
            if (
                (this as THREE.WebGLShadowMap).enabled === false ||
                ((this as THREE.WebGLShadowMap).autoUpdate === false &&
                    (this as THREE.WebGLShadowMap).needsUpdate === false) ||
                !lights.length
            )
                return orig.call(this, lights, scene, camera);
            const mask = camera.layers.mask,
                nu = (this as THREE.WebGLShadowMap).needsUpdate;
            try {
                for (const l of lights) {
                    const sh = (l as THREE.DirectionalLight).shadow;
                    if (
                        !sh ||
                        (sh.autoUpdate === false && sh.needsUpdate === false)
                    )
                        continue;
                    camera.layers.mask = sh.camera.layers.mask;
                    const big = csm._big;

                    const ci = csm.lights.indexOf(l as THREE.DirectionalLight);
                    if (csm._capped && ci >= 0)
                        for (const o of csm._capped) {
                            const u = o.userData as any;
                            if (
                                o.visible &&
                                (ci > (u.maxCascade ?? 99) ||
                                    ci < (u.minCascade ?? 0))
                            ) {
                                o.visible = false;
                                hid.push(o);
                            }
                        }
                    if (
                        big &&
                        (l as THREE.DirectionalLight).isDirectionalLight &&
                        (sh as any).getFrustum
                    ) {
                        sh.updateMatrices(l as THREE.DirectionalLight);
                        const fr = (sh as any).getFrustum();
                        for (let i = 0; i < big.length; i += 2) {
                            const o = big[i] as THREE.Object3D;
                            if (!o.visible || !(o as THREE.Mesh).castShadow)
                                continue;
                            const bx = big[i + 1] as THREE.Box3[];
                            let hit = false;
                            for (let j = 0; j < bx.length && !hit; j++)
                                hit = fr.intersectsBox(bx[j]);
                            if (!hit) {
                                o.visible = false;
                                hid.push(o);
                            }
                        }
                    }
                    one[0] = l;
                    (this as THREE.WebGLShadowMap).needsUpdate = nu;
                    try {
                        orig.call(this, one, scene, camera);
                    } finally {
                        for (const o of hid) o.visible = true;
                        hid.length = 0;
                    }
                }
            } finally {
                camera.layers.mask = mask;
                one[0] = null;
            }
        };
    }

    _viewWedge(camera: THREE.Camera): void {
        const V = (csmShared.view ??= { x: 0, z: 1, cos: -2 });
        if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
            V.cos = -2;
            return;
        }
        const f = this._fwd,
            hl = Math.hypot(f.x, f.z);
        if (hl < 0.3) {
            V.cos = -2;
            return;
        }
        V.x = f.x / hl;
        V.z = f.z / hl;
        const cam = camera as THREE.PerspectiveCamera;
        const tv = Math.tan(THREE.MathUtils.degToRad(cam.fov) * 0.5),
            th = tv * cam.aspect,
            v = this._tmp,
            e = camera.matrixWorld.elements;
        let worst = 1;
        for (let k = 0; k < 4; k++) {
            const x = k & 1 ? th : -th,
                y = k & 2 ? tv : -tv;
            v.set(
                e[0] * x + e[4] * y - e[8],
                e[1] * x + e[5] * y - e[9],
                e[2] * x + e[6] * y - e[10],
            );
            const h = Math.hypot(v.x, v.z);
            if (h < 1e-4) {
                V.cos = -2;
                return;
            }
            worst = Math.min(worst, (v.x * V.x + v.z * V.z) / h);
        }
        const half = Math.acos(Math.max(-1, Math.min(1, worst))) + Math.PI / 3;
        V.cos = half >= Math.PI ? -2 : Math.cos(half);
    }
    setSunDirection(dir: THREE.Vector3): void {
        this.sunDir.copy(dir).normalize();
        this.forceAll = true;
    }
    /** world position of the player's feet (or null): the character cascade covers a box around it */
    /** tag large shadow casters (world bounding radius >= 3 m, or instanced batches of such) for the far cascades */
    tagCasters(scene: THREE.Scene): void {
        const _s = new THREE.Vector3();
        scene.traverse((o) => {
            if (
                !(o as THREE.Mesh).castShadow ||
                !(o as THREE.Mesh).isMesh ||
                this._tagged.has(o)
            )
                return;
            this._tagged.add(o);
            const g = (o as THREE.Mesh).geometry;
            if (!g) return;
            if (!g.boundingSphere) g.computeBoundingSphere();
            o.updateWorldMatrix(true, false);
            _s.setFromMatrixScale(o.matrixWorld);
            let r =
                (g.boundingSphere?.radius ?? 0) * Math.max(_s.x, _s.y, _s.z);
            if (
                (o as THREE.InstancedMesh).isInstancedMesh &&
                (o as THREE.InstancedMesh).instanceMatrix &&
                (o as THREE.InstancedMesh).count > 0
            ) {
                // per-instance scale of the first instance
                const m = new THREE.Matrix4().fromArray(
                    (o as THREE.InstancedMesh).instanceMatrix
                        .array as unknown as number[],
                    0,
                );
                const s2 = new THREE.Vector3().setFromMatrixScale(m);
                r =
                    (g.boundingSphere?.radius ?? 0) *
                    Math.max(s2.x, s2.y, s2.z) *
                    Math.max(_s.x, _s.y, _s.z);
            }
            // merged small-detail batches (cornices, sills, vents: city 'detail x,z' chunks) have large bounds but only
            // small features: their shadows are sub-texel in the far cascades, so skip them there
            if (
                /^detail\b/.test(o.name || "") ||
                (o.userData as any)?.smallCasters
            )
                return;
            if (r >= 3.0) o.layers.enable(BIG_CASTER_LAYER);
        });
    }
    /** mark the player's meshes so they (only) render into the character cascade */
    setCharacter(obj: THREE.Object3D | null | undefined): void {
        if (
            !obj ||
            (obj === this._charObj &&
                this._charCount === this._countMeshes(obj))
        )
            return;
        this._charObj = obj;
        this._charCount = this._countMeshes(obj);
        obj.traverse((o) => {
            if (
                (o as THREE.Mesh).isMesh ||
                (o as THREE.SkinnedMesh).isSkinnedMesh
            )
                o.layers.enable(CHAR_LAYER);
        });
    }
    _countMeshes(obj: THREE.Object3D): number {
        let n = 0;
        obj.traverse((o) => {
            if (
                (o as THREE.Mesh).isMesh ||
                (o as THREE.SkinnedMesh).isSkinnedMesh
            )
                n++;
        });
        return n;
    }
    setFocus(p: THREE.Vector3 | null | undefined): void {
        if (p) (this.focus ??= new THREE.Vector3()).copy(p);
        else this.focus = null;
    }
    _fit(
        light: THREE.DirectionalLight,
        center: THREE.Vector3,
        r: number,
        right: THREE.Vector3,
        lup: THREE.Vector3,
        L: THREE.Vector3,
        size: number,
    ): void {
        const texel = (2 * r) / size;
        const cx = Math.round(center.dot(right) / texel) * texel;
        const cy = Math.round(center.dot(lup) / texel) * texel;
        const cz = center.dot(L);
        center
            .copy(right)
            .multiplyScalar(cx)
            .addScaledVector(lup, cy)
            .addScaledVector(L, cz);
        const D = r + 900;
        light.position.copy(center).addScaledVector(L, D);
        light.target.position.copy(center);
        light.updateMatrixWorld();
        light.target.updateMatrixWorld();
        const cam = light.shadow.camera as THREE.OrthographicCamera;
        cam.left = -r;
        cam.right = r;
        cam.top = r;
        cam.bottom = -r;
        cam.near = 1;
        cam.far = D + r + 50;
        cam.updateProjectionMatrix();
        const depthRange = cam.far - cam.near;
        light.shadow.normalBias = texel * 1.4;
        light.shadow.bias =
            ((this.reversed ? 1 : -1) * (texel * 0.6)) / depthRange;
        light.shadow.needsUpdate = true;
    }
    update(camera: THREE.Camera, scene?: THREE.Scene): void {
        this.frame++;
        if (scene && this._tagFrame++ % 120 === 0) {
            this.tagCasters(scene);
            if (this._layerFix) this._collectBig(scene);
        }
        csmShared.params.x = ((this.frame % 64) * 0.618034) % 1;
        csmShared.params.y = 0.06;
        const L = this.sunDir;

        const up =
            Math.abs(L.y) > 0.99
                ? this._tmp.set(0, 0, 1)
                : this._tmp.set(0, 1, 0);
        const right = this._r.crossVectors(up, L).normalize();
        const lup = this._u.crossVectors(L, right).normalize();
        (camera as THREE.PerspectiveCamera).getWorldDirection?.(this._fwd);
        this._viewWedge(camera);
        const camPos = new THREE.Vector3().setFromMatrixPosition(
            camera.matrixWorld,
        );

        const camP = camera as THREE.PerspectiveCamera;
        const tanV = Math.tan(
            THREE.MathUtils.degToRad(Math.max(camP.fov, 80)) * 0.5,
        );
        const tanH = tanV * Math.max(camP.aspect, 16 / 9);
        const k2 = tanV * tanV + tanH * tanH;
        for (let i = 0; i < this.N; i++) {
            const light = this.lights[i];
            const period = this.periods[i];
            const due = this.forceAll || (this.frame + i) % period === 0;
            if (!due) {
                light.shadow.needsUpdate = false;
                continue;
            }
            const n = Math.max(this.splits[i], camP.near),
                f = Math.min(this.splits[i + 1], camP.far);
            let zc = (f + n) * 0.5 * (1 + k2),
                r: number;
            if (zc >= f) {
                zc = f;
                r = f * Math.sqrt(k2);
            } else r = Math.sqrt((zc - n) ** 2 + n * n * k2);
            if (i >= 1) r *= [1, 1.06, 1.12, 1.15][i];
            r = Math.ceil(r);
            const center = this._c
                .copy(this._fwd)
                .multiplyScalar(zc)
                .add(camPos);

            const texel = (2 * r) / light.shadow.mapSize.x;
            const cx = Math.round(center.dot(right) / texel) * texel;
            const cy = Math.round(center.dot(lup) / texel) * texel;
            const cz = Math.round(center.dot(L) / 4) * 4;
            center
                .copy(right)
                .multiplyScalar(cx)
                .addScaledVector(lup, cy)
                .addScaledVector(L, cz);
            const D = r + 900;
            light.position.copy(center).addScaledVector(L, D);
            light.target.position.copy(center);
            light.updateMatrixWorld();
            light.target.updateMatrixWorld();
            const cam = light.shadow.camera as THREE.OrthographicCamera;
            cam.left = -r;
            cam.right = r;
            cam.top = r;
            cam.bottom = -r;
            cam.near = 1;
            cam.far = D + r + 50;
            cam.updateProjectionMatrix();

            const depthRange = cam.far - cam.near;
            light.shadow.normalBias = texel * 1.4;
            light.shadow.bias =
                ((this.reversed ? 1 : -1) * (texel * 0.6)) / depthRange;
            light.shadow.needsUpdate = true;
        }
        this.forceAll = false;
        if (this.charLight) {
            const c = this._c;

            const near = this.focus && this.focus.distanceTo(camPos) < 25;
            if (near) c.copy(this.focus!).add(this._tmp.set(0, 0.9, 0));
            else c.set(0, -5000, 0);
            const r = this.charRadius;
            this._fit(this.charLight, c, r, right, lup, L, this.charSize);

            this.charLight.shadow.normalBias = ((2 * r) / this.charSize) * 2.0;
        }
    }
}
