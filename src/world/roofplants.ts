/**
 * Generates instanced rooftop plant geometry and rendering support.
 *
 * @module world-roofplants
 * @version 1.0.0
 * @file src/world/roofplants.ts
 * @since 0.0.1
 * @description Creates plant card meshes and pooling utilities for shrubs, grass, flowers, and other rooftop vegetation.
 */
import * as THREE from "three";
import { Pool } from "./pool.ts";

export const PLANT = { SHRUB: 0, GRASS: 1, FLOWER: 2, BROAD: 3 } as const;
const TILE_UV = (i: number) =>
    [(i % 2) * 0.5, Math.floor(i / 2) * 0.5] as const;
const M = 0.006;

function card(
    P: number[],
    N: number[],
    UV: number[],
    I: number[],
    c: THREE.Vector3,
    ex: THREE.Vector3,
    ey: THREE.Vector3,
    tile: number,
    nc: THREE.Vector3,
    bend = 0.65,
) {
    const v = P.length / 3,
        [tu, tv] = TILE_UV(tile);
    const fn = new THREE.Vector3().crossVectors(ex, ey).normalize();
    for (const [a, b] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
    ] as const) {
        const p = c.clone().addScaledVector(ex, a).addScaledVector(ey, b);
        P.push(p.x, p.y, p.z);
        const n = p
            .clone()
            .sub(nc)
            .normalize()
            .multiplyScalar(bend)
            .addScaledVector(
                fn,
                (1 - bend) * Math.sign(fn.dot(p.clone().sub(nc)) || 1),
            )
            .normalize();
        N.push(n.x, n.y, n.z);
        UV.push(
            tu + M + ((a + 1) / 2) * (0.5 - 2 * M),
            tv + M + ((b + 1) / 2) * (0.5 - 2 * M),
        );
    }
    I.push(v, v + 1, v + 2, v, v + 2, v + 3);
}
function geo(P: number[], N: number[], UV: number[], I: number[]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
    g.setIndex(I);
    g.computeBoundingSphere();
    return g;
}
function moundGeometry() {
    const P: number[] = [],
        N: number[] = [],
        UV: number[] = [],
        I: number[] = [],
        V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const nc = V(0, 0.15, 0);
    for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI + 0.3;
        card(
            P,
            N,
            UV,
            I,
            V(0, 0.42, 0),
            V(Math.cos(a), 0, Math.sin(a)),
            V(0, 0.62, 0),
            0,
            nc,
        );
    }
    card(
        P,
        N,
        UV,
        I,
        V(0, 0.72, 0),
        V(0.95, 0.06, 0),
        V(0, 0.08, 0.95),
        0,
        nc,
        0.8,
    );
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.5,
            ca = Math.cos(a),
            sa = Math.sin(a);
        const c = V(ca * 0.55, 0.38 + (k % 2) * 0.1, sa * 0.55);
        const out = V(ca, 0.9, sa).normalize(),
            tang = V(-sa, 0, ca);
        const up = new THREE.Vector3().crossVectors(out, tang).normalize();
        card(
            P,
            N,
            UV,
            I,
            c,
            tang.multiplyScalar(0.5),
            up.multiplyScalar(-0.5),
            0,
            nc,
        );
    }
    return geo(P, N, UV, I);
}
function grassGeometry() {
    const P: number[] = [],
        N: number[] = [],
        UV: number[] = [],
        I: number[] = [],
        V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI + 0.2,
            lean = k % 2 ? 0.08 : -0.08;
        card(
            P,
            N,
            UV,
            I,
            V(Math.sin(a) * lean, 0.5, -Math.cos(a) * lean),
            V(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5),
            V(0, 0.5, 0),
            1,
            V(0, -0.2, 0),
            0.5,
        );
    }
    return geo(P, N, UV, I);
}

function plantMaterial(tex: THREE.Texture) {
    const mat = new THREE.MeshStandardMaterial({
        map: tex,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0,
    }) as any;
    mat.onBeforeCompile = (sh: any) => {
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
      attribute vec4 aPlant; varying vec3 vPTint; varying float vPY;`,
            )
            .replace(
                "#include <uv_vertex>",
                `#include <uv_vertex>
      #ifdef USE_INSTANCING
        { float t = floor(aPlant.x + 0.5), d = floor(aPlant.x / 4.0 + 0.001);
          t = t - d * 4.0;
          vec2 off = vec2(mod(t, 2.0), floor(t / 2.0)) * 0.5 - vec2(mod(d, 2.0), floor(d / 2.0)) * 0.5;
          vMapUv += off; }
      #endif
      vPTint = aPlant.yzw; vPY = position.y;`,
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      varying vec3 vPTint; varying float vPY;`,
            )
            .replace(
                "#include <map_fragment>",
                `#include <map_fragment>
      diffuseColor.rgb *= vPTint * mix(0.55, 1.0, smoothstep(0.0, 0.6, vPY));`,
            );
    };
    mat.customProgramCacheKey = () => "roofplant-v1";
    return mat;
}

export class RoofPlants {
    items: any[][] = [[], []];
    pools: Pool[] | null = null;

    add(
        x: number,
        y: number,
        z: number,
        r: number,
        hgt: number,
        tile: number,
        tint: number[],
        ry?: number,
    ) {
        const grass = tile === PLANT.GRASS ? 1 : 0;
        const d = grass ? 1 : 0;
        this.items[grass].push({
            x,
            y,
            z,
            ry,
            s: 1,
            scale3: grass ? [r * 2, hgt, r * 2] : [r, hgt, r],
            extra: { aPlant: [tile + 4 * d, ...tint] },
        });
    }
    get count() {
        return this.items[0].length + this.items[1].length;
    }
    build(scene: THREE.Scene) {
        if (!this.count) return;
        const tex = new THREE.TextureLoader().load(
            new URL("../assets/textures/city/roofplants.webp", import.meta.url)
                .href,
        );
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const mat = plantMaterial(tex);
        this.pools = [moundGeometry(), grassGeometry()].map((g, i) => {
            const p = new Pool(g, mat, {
                max: 9000,
                far: 210,
                shadowFar: 55,
                extra: { aPlant: 4 },
                name: "roofplants-" + (i ? "grass" : "mound"),
            });
            (p as any).items = this.items[i];
            (p.mesh.userData as any).maxCascade = 0;
            (p.mesh.userData as any).smallCasters = true;
            scene.add(p.mesh);
            return p;
        });
    }
    update(cam: THREE.Camera) {
        if (this.pools)
            for (const p of this.pools) if (p.due(cam)) p.update(cam);
    }
}
