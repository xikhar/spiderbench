// @ts-nocheck
/**
 * Visual web strands for slingshot traversal actions.
 *
 * @module player-slingweb
 * @version 1.0.0
 * @file src/player/slingweb.ts
 * @since 0.0.1
 * @description Renders and updates slingshot web attachments and dying release strands using the shared strand system.
 */

import * as THREE from "three";
import { Strands } from "./web";
import type { WebSystem } from "./web";

const SEG = 20,
    N = 8,
    DYING = 8;
const _h = new THREE.Vector3(),
    _d = new THREE.Vector3(),
    _p1 = new THREE.Vector3(),
    _p2 = new THREE.Vector3();

export function createSlingWebs(scene: THREE.Scene, web: WebSystem) {
    const strands = new Strands(Array(N + DYING).fill(SEG));
    strands.mesh.name = "SlingWebs";
    scene.add(strands.mesh);
    const pts = [...Array(SEG + 1)].map(() => new THREE.Vector3());
    const dying = [...Array(DYING)].map(() => ({
        on: false,
        t: 0,
        a: new THREE.Vector3(),
        h: new THREE.Vector3(),
        life: 0.3,
        side: 1,
    }));
    let dI = 0,
        time = 0;

    function draw(
        si: number,
        hand: THREE.Vector3,
        anchor: THREE.Vector3,
        ext: number,
        sag: number,
        trem: number,
        seed: number,
        width: number,
    ) {
        const L = hand.distanceTo(anchor);
        _d.copy(anchor).sub(hand).divideScalar(Math.max(L, 1e-4));
        const p1 = _p1.set(0, 1, 0).cross(_d);
        if (p1.lengthSq() < 1e-4) p1.set(1, 0, 0);
        p1.normalize();
        for (let i = 0; i <= SEG; i++) {
            const s = (i / SEG) * ext,
                env = Math.sin(Math.PI * Math.min(1, s / Math.max(ext, 1e-3)));
            const p = pts[i].copy(hand).addScaledVector(_d, L * s);
            p.y -= sag * env * Math.min(L * 0.08, 1.2);
            p.addScaledVector(
                p1,
                Math.sin(s * L * 1.3 + time * 70 + seed * 9) * trem * env,
            );
        }
        strands.setStrand(si, pts, width);
    }

    return {
        mesh: strands.mesh,

        update(
            dt: number,
            sling: any,
            events: any[],
            rig: any,
            _camera: THREE.Camera,
            renderer: THREE.WebGLRenderer,
        ) {
            time += dt;
            const res = renderer.getDrawingBufferSize(_p2);
            (strands.mat.uniforms as any).uRes.value.set(res.x, res.y);
            for (const e of events) {
                if (e.type === "slingAttach") web.splat?.(e.point, e.normal);
                if (e.type === "slingRelease")
                    for (const a of e.anchors) {
                        const d = dying[dI++ % DYING];
                        d.on = true;
                        d.t = 0;
                        d.a.copy(a.p);
                        d.side = a.side;
                        rig.handWorld(a.side < 0 ? "L" : "R", d.h);
                        d.life = e.launch ? 0.28 : 0.45;
                    }
            }
            const k = sling.active ? sling.tension : 0;
            for (let i = 0; i < N; i++) {
                const a = sling.active ? sling.anchors[i] : null;
                if (!a) {
                    strands.hideStrand(i);
                    continue;
                }
                rig.handWorld(a.side < 0 ? "L" : "R", _h);
                const ext = 1 - Math.pow(1 - Math.min(1, a.t / 0.12), 3);
                const settle = Math.exp(-Math.max(0, a.t - 0.12) * 8);
                draw(
                    i,
                    _h,
                    a.p,
                    ext,
                    0.35 * (1 - k) * (1 - settle * 0.5),
                    (0.04 + 0.25 * (1 - ext)) * (1 - k) * settle +
                        0.012 * k * k,
                    i,
                    1 + 0.45 * k,
                );
            }
            for (let j = 0; j < DYING; j++) {
                const d = dying[j],
                    si = N + j;
                if (!d.on) {
                    strands.hideStrand(si);
                    continue;
                }
                d.t += dt;
                const u = d.t / d.life;
                if (u >= 1) {
                    d.on = false;
                    strands.hideStrand(si);
                    continue;
                }

                const from = _h.copy(d.h).lerp(d.a, 1 - Math.pow(1 - u, 2));
                draw(
                    si,
                    from,
                    d.a,
                    1,
                    0.1,
                    0.08 * (1 - u),
                    j,
                    Math.max(0.05, 1 - u),
                );
            }
            strands.commit();
        },
    };
}
