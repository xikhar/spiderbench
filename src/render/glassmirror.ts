/**
 * Planar glass-mirror rendering pass for reflective facade surfaces.
 *
 * @module render-glass-mirror
 * @version 1.0.0
 * @file src/render/glassmirror.ts
 * @since 0.0.1
 * @description Exports shared mirror uniforms, GLSL declarations, and createGlassMirror to select a reflection plane, render a mirrored scene target, and supply it to materials.
 */

import * as THREE from "three";

export const GM_LAYER = 26;

export const glassMirrorShared = {
    tGM: { value: null as THREE.Texture | null },
    uGMMat: { value: new THREE.Matrix4() },
    uGMPlane: { value: new THREE.Vector4(0, 1, 0, -1e6) },
    uGMOn: { value: 0 },
};
export const GLSL_GLASS_MIRROR_DECL = /* glsl */ `
uniform sampler2D tGM; uniform mat4 uGMMat; uniform vec4 uGMPlane; uniform float uGMOn;
// mirror image (rgb) + coverage (a) at this facade point, or 0 when it is not on the mirrored plane
vec4 glassMirror(vec3 wp, vec3 wn) {
  if (uGMOn < 0.5) return vec4(0.0);
  float pd = dot(wp, uGMPlane.xyz) - uGMPlane.w;
  float pm = smoothstep(0.96, 0.99, dot(wn, uGMPlane.xyz)) * (1.0 - smoothstep(0.2, 0.45, abs(pd)));
  if (pm <= 0.0) return vec4(0.0);
  vec4 rp = uGMMat * vec4(wp, 1.0);
  if (rp.w <= 0.0) return vec4(0.0);
  vec2 ruv = rp.xy / rp.w;
  vec2 e = smoothstep(0.0, 0.03, ruv) * smoothstep(1.0, 0.97, ruv);
  vec4 m = texture(tGM, ruv);
  return vec4(m.rgb, clamp(m.a, 0.0, 1.0) * pm * e.x * e.y);
}
`;

export interface GlassMirrorHandle {
    rt: THREE.WebGLRenderTarget;
    stats: { on: number; plane: number[] | null };
    setSize(w: number, h: number): void;
    render(cam: THREE.Camera): void;
}

export function createGlassMirror(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
): GlassMirrorHandle {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(
        Math.max(64, size.x >> 1),
        Math.max(64, size.y >> 1),
        { type: THREE.HalfFloatType, depthBuffer: true },
    );
    rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
    rt.texture.generateMipmaps = false;
    const S = glassMirrorShared;
    S.tGM.value = rt.texture;
    let off = false;
    try {
        off = new URLSearchParams(location.search).has("nogmirror");
    } catch (_e) {
        /* non-browser */
    }
    const vcam = new THREE.PerspectiveCamera();
    vcam.layers.set(GM_LAYER);
    vcam.matrixAutoUpdate = true;
    const bias = new THREE.Matrix4().set(
        0.5,
        0,
        0,
        0.5,
        0,
        0.5,
        0,
        0.5,
        0,
        0,
        0.5,
        0.5,
        0,
        0,
        0,
        1,
    );
    const _p = new THREE.Vector3(),
        _c = new THREE.Vector3(),
        _d = new THREE.Vector3(),
        _t = new THREE.Vector3(),
        _u = new THREE.Vector3();
    const _m = new THREE.Vector3(),
        _n = new THREE.Vector3(),
        _q = new THREE.Vector4(),
        _col = new THREE.Color(),
        _pl = new THREE.Plane(),
        _rq = new THREE.Quaternion();
    const DIRS: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++)
        DIRS.push(
            new THREE.Vector3(
                Math.cos((i * Math.PI) / 4),
                0,
                Math.sin((i * Math.PI) / 4),
            ),
        );
    const cur = { on: false, n: new THREE.Vector3(), d: 0 };
    const stats: { on: number; plane: number[] | null } = {
        on: 0,
        plane: null,
    };
    const refl = (v: THREE.Vector3, n: THREE.Vector3, d: number) =>
        v.addScaledVector(n, -2 * (v.dot(n) - d));
    const reflDir = (v: THREE.Vector3, n: THREE.Vector3) =>
        v.addScaledVector(n, -2 * v.dot(n));

    function scan() {
        scene.traverse((o) => {
            if ((o as THREE.Light).isLight) {
                o.layers.enable(GM_LAYER);
                return;
            }
            if (
                !(
                    (o as THREE.Mesh).isMesh ||
                    (o as THREE.SkinnedMesh).isSkinnedMesh
                ) ||
                o.layers.isEnabled(GM_LAYER)
            )
                return;

            if (/^people-.*-L0$/.test(o.name)) o.layers.enable(GM_LAYER);
        });
        (window as any).__ctx?.player?.object?.traverse((o: THREE.Object3D) => {
            if (
                (o as THREE.Mesh).isMesh ||
                (o as THREE.SkinnedMesh).isSkinnedMesh
            )
                o.layers.enable(GM_LAYER);
        });
        for (const o of scene.children)
            if (/^(WebStrands|WebRopes|SlingWebs)$/.test(o.name))
                o.traverse((w) => w.layers.enable(GM_LAYER));
    }

    function pickPlane(
        cam: THREE.Camera,
        player: { position: THREE.Vector3 },
        world: {
            raycast: (o: THREE.Vector3, d: THREE.Vector3, r: number) => any;
        },
    ): { n: THREE.Vector3; d: number } | null {
        _p.copy(player.position);
        _c.setFromMatrixPosition(cam.matrixWorld);
        let best: { n: THREE.Vector3; d: number } | null = null,
            bestS = Infinity;
        for (const dir of DIRS) {
            const h = world.raycast(_p, dir, 32);
            if (
                !h ||
                h.ground ||
                Math.abs(h.normal.y) > 0.3 ||
                !(h.kind === "wall" || h.kind === "glass")
            )
                continue;
            _n.copy(h.normal).setY(0).normalize();
            const d = _n.dot(h.point);
            if (_n.dot(_c) - d < 0.4) continue;
            _m.copy(_p);
            refl(_m, _n, d);
            _q.set(_m.x, _m.y, _m.z, 1)
                .applyMatrix4(cam.matrixWorldInverse)
                .applyMatrix4(cam.projectionMatrix);
            if (
                _q.w <= 0.1 ||
                Math.abs(_q.x / _q.w) > 1.35 ||
                Math.abs(_q.y / _q.w) > 1.35
            )
                continue;
            let s = h.distance;
            if (cur.on && cur.n.dot(_n) > 0.999 && Math.abs(cur.d - d) < 0.1)
                s -= 2.5;
            if (s < bestS) {
                bestS = s;
                best = { n: _n.clone(), d };
            }
        }
        return best;
    }

    let frame = 0;
    return {
        rt,
        stats,
        setSize(w: number, h: number) {
            rt.setSize(Math.max(64, w >> 1), Math.max(64, h >> 1));
        },

        render(cam: THREE.Camera) {
            S.uGMOn.value = 0;
            stats.on = 0;
            const ctx = (window as any).__ctx,
                player = ctx?.player,
                world = ctx?.world;
            if (off || !player?.object?.visible || !world?.raycast) {
                cur.on = false;
                return;
            }
            if (frame++ % 60 === 0) scan();
            const pl = pickPlane(cam, player, world);
            if (!pl) {
                cur.on = false;
                return;
            }
            cur.on = true;
            cur.n.copy(pl.n);
            cur.d = pl.d;

            _c.setFromMatrixPosition(cam.matrixWorld);
            (cam as THREE.PerspectiveCamera).getWorldDirection?.(_d);
            _t.copy(_c).add(_d);
            refl(_t, pl.n, pl.d);
            vcam.position.copy(_c);
            refl(vcam.position, pl.n, pl.d);
            _u.set(0, 1, 0).applyQuaternion(cam.getWorldQuaternion(_rq));
            reflDir(_u, pl.n);
            vcam.up.copy(_u);
            vcam.lookAt(_t);
            vcam.updateMatrixWorld();
            vcam.projectionMatrix.copy(cam.projectionMatrix);
            vcam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
            const camP = cam as THREE.PerspectiveCamera & {
                reversedDepth?: boolean;
                _reversedDepth?: boolean;
            };
            vcam.near = camP.near;
            vcam.far = camP.far;
            vcam.fov = camP.fov;
            vcam.aspect = camP.aspect;
            if (camP.reversedDepth) (vcam as any)._reversedDepth = true;

            _pl.set(pl.n, -(pl.d - 0.05)).applyMatrix4(vcam.matrixWorldInverse);
            const e = vcam.projectionMatrix.elements,
                C = _pl.normal,
                Cw = _pl.constant;
            if (camP.reversedDepth) {
                const k = 0.5;
                e[2] = -C.x * k;
                e[6] = -C.y * k;
                e[10] = -1 - C.z * k;
                e[14] = -Cw * k;
            } else {
                _q.set(
                    (Math.sign(C.x) + e[8]) / e[0],
                    (Math.sign(C.y) + e[9]) / e[5],
                    -1,
                    (1 + e[10]) / e[14],
                );
                const k =
                    2 / (C.x * _q.x + C.y * _q.y + C.z * _q.z + Cw * _q.w);
                e[2] = C.x * k;
                e[6] = C.y * k;
                e[10] = C.z * k + 1;
                e[14] = Cw * k;
            }
            vcam.projectionMatrixInverse.copy(vcam.projectionMatrix).invert();
            S.uGMMat.value
                .copy(bias)
                .multiply(vcam.projectionMatrix)
                .multiply(vcam.matrixWorldInverse);
            S.uGMPlane.value.set(pl.n.x, pl.n.y, pl.n.z, pl.d);
            player.object.updateMatrixWorld(true);
            const prevRT = renderer.getRenderTarget(),
                prevA = renderer.getClearAlpha();
            renderer.getClearColor(_col);
            const sm = renderer.shadowMap,
                prevAuto = sm.autoUpdate,
                prevNU = sm.needsUpdate;
            const prevWAU = scene.matrixWorldAutoUpdate;
            sm.autoUpdate = false;
            sm.needsUpdate = false;
            scene.matrixWorldAutoUpdate = false;
            try {
                renderer.setRenderTarget(rt);
                renderer.setClearColor(0x000000, 0);
                renderer.clear(true, true, false);
                renderer.render(scene, vcam);
            } finally {
                sm.autoUpdate = prevAuto;
                sm.needsUpdate = prevNU;
                scene.matrixWorldAutoUpdate = prevWAU;
                renderer.setRenderTarget(prevRT);
                renderer.setClearColor(_col, prevA);
            }
            S.uGMOn.value = 1;
            stats.on = 1;
            stats.plane = [pl.n.x, pl.n.z, +pl.d.toFixed(2)];
        },
    };
}
