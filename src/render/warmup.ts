/**
 * Render warmup scheduler for precompiling scene and fullscreen-pass shader programs.
 *
 * @module render-warmup
 * @version 1.0.0
 * @file src/render/warmup.ts
 * @since 0.0.1
 * @description Exports createWarmup to incrementally compile drawable objects, mirror-layer candidates, and fullscreen passes to reduce first-frame stalls.
 */

import * as THREE from "three";
import { FSPass } from "./common.ts";

const sub = (list: THREE.Object3D[]): THREE.Object3D =>
    ({
        traverse: (f: (o: THREE.Object3D) => void) => {
            for (const o of list) f(o);
        },
        traverseVisible: () => {},
    }) as unknown as THREE.Object3D;

const drawable = (o: THREE.Object3D): boolean =>
    ((o as THREE.Mesh).isMesh ||
        (o as THREE.Points).isPoints ||
        (o as THREE.Line).isLine ||
        (o as THREE.Sprite).isSprite) &&
    !!(o as THREE.Mesh).material;

export interface WarmupOptions {
    mirrorLayers?: number[] | null;
    perStep?: number;
    budgetMs?: number;
}

export interface WarmupHandle {
    rescan(): void;
    readonly pending: number;
    settle(
        onProgress?: ((p: number) => void) | null,
        timeoutMs?: number,
    ): Promise<void>;
    flush(): void;
    step(force?: boolean): boolean;
}

export function createWarmup(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    { mirrorLayers = null, perStep = 4, budgetMs = 2 }: WarmupOptions = {},
): WarmupHandle {
    const rt1 = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
    });
    const done = new WeakSet<THREE.Object3D>();
    const doneM = new WeakSet<THREE.Object3D>();
    let queue: Array<number | THREE.Object3D> = [],
        inFlight: Array<{ isReady?: () => boolean }> = [],
        t0 = 0,
        queued = 0;
    const mc = camera.clone();
    mc.layers.disableAll();
    if (mirrorLayers) for (const l of mirrorLayers) mc.layers.enable(l);
    const fsCam = FSPass.camera;
    let perStepN = perStep;
    let budgetMsN = budgetMs;
    const api: WarmupHandle = {
        rescan() {
            if (!t0) t0 = performance.now();
            scene.traverse((o) => {
                if (!drawable(o)) return;
                if (!done.has(o)) {
                    done.add(o);
                    queue.push(0, o);
                }

                if (
                    mirrorLayers &&
                    !doneM.has(o) &&
                    (o.layers.test(mc.layers) ||
                        ((o as THREE.Mesh).isMesh &&
                            ((o as THREE.Mesh).castShadow ||
                                /^(facade|roofs|facadeLod)\b/.test(
                                    o.name || "",
                                )) &&
                            !/^detail\b/.test(o.name || "") &&
                            !(o.userData as { smallCasters?: boolean })
                                ?.smallCasters))
                ) {
                    doneM.add(o);
                    queue.push(1, o);
                }
            });
            for (const p of FSPass.all)
                if (!done.has(p.mesh)) {
                    done.add(p.mesh);
                    queue.push(2, p.mesh);
                }
        },
        get pending() {
            return queue.length / 2;
        },

        settle(
            onProgress: ((p: number) => void) | null = null,
            timeoutMs = 25000,
        ) {
            const all = inFlight.slice(),
                n = all.length,
                t = performance.now();
            return new Promise<void>((res) => {
                const poll = () => {
                    let ready = 0;
                    for (const p of all) if (p.isReady?.() ?? true) ready++;
                    onProgress?.(n ? ready / n : 1);
                    if (ready >= n || performance.now() - t > timeoutMs) {
                        console.log(
                            `[warmup] ${ready}/${n} programs linked before the first frame (${((performance.now() - t) / 1000).toFixed(1)} s)`,
                        );
                        res();
                    } else setTimeout(poll, 60);
                };
                poll();
            });
        },

        flush() {
            const ps = perStepN,
                bm = budgetMsN;
            perStepN = Infinity;
            budgetMsN = Infinity;
            inFlight.length = 0;
            try {
                api.step(true);
            } finally {
                perStepN = ps;
                budgetMsN = bm;
            }
        },
        step(force = false) {
            if (!queue.length) return false;
            inFlight = inFlight.filter((p) => !(p.isReady?.() ?? true));
            if (inFlight.length && !force) return true;
            const P = renderer.info.programs as Array<{
                isReady?: () => boolean;
            }> | null;
            const n0 = P?.length ?? 0;
            const prevRT = renderer.getRenderTarget(),
                prevOn = renderer.shadowMap.enabled;
            renderer.setRenderTarget(rt1);
            try {
                let i = 0;
                const ts = performance.now();
                while (
                    i < queue.length &&
                    (P?.length ?? 0) - n0 < perStepN &&
                    performance.now() - ts < budgetMsN
                ) {
                    const kind = queue[i] as number,
                        o = queue[i + 1] as THREE.Object3D;
                    i += 2;
                    if (kind === 1) {
                        renderer.shadowMap.enabled = false;
                        renderer.compile(sub([o]) as any, mc, scene);
                        renderer.shadowMap.enabled = prevOn;
                    } else if (kind === 2)
                        renderer.compile(
                            sub([o]) as any,
                            fsCam,
                            sub([]) as any,
                        );
                    else renderer.compile(sub([o]) as any, camera, scene);
                }
                queue = queue.slice(i);
            } catch (e) {
                console.warn("[warmup]", e);
                queue = [];
            } finally {
                renderer.shadowMap.enabled = prevOn;
                renderer.setRenderTarget(prevRT);
            }
            if (P) for (let k = n0; k < P.length; k++) inFlight.push(P[k]);
            queued += (P?.length ?? 0) - n0;
            if (!queue.length)
                console.log(
                    `[warmup] ${queued} programs queued so far (${P?.length ?? 0} total), ${((performance.now() - t0) / 1000).toFixed(1)} s)`,
                );
            return queue.length > 0;
        },
    };
    return api;
}
