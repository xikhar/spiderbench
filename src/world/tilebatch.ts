/**
 * Batches tile geometry and manages mesh warm-up behavior.
 *
 * @module world-tilebatch
 * @version 1.0.0
 * @file src/world/tilebatch.ts
 * @since 0.0.1
 * @description Merges tile meshes, controls visibility and shadow settings, and handles upload/warm strategies for city tiles.
 */
import * as THREE from "three";

const Q =
    typeof location !== "undefined"
        ? new URLSearchParams(location.search)
        : new URLSearchParams();
export const perf2Off = (k: string) => Q.has("perf2off") || Q.has(k);
const NOBATCH = perf2Off("nobatch"),
    NOWARM = perf2Off("nowarm");
const SUPER = 512;
const UPLOAD_MAT = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
});

const sig = (g: THREE.BufferGeometry) =>
    Object.keys(g.attributes)
        .sort()
        .map(
            (k) =>
                k +
                (g.attributes[k] as any).itemSize +
                ((g.attributes[k] as any).normalized ? "n" : "") +
                (g.attributes[k].array as any).constructor.name,
        )
        .join(",") + (g.index ? "|i" : "");

function mk(
    g: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
    o: any,
) {
    const m = new THREE.Mesh(g, material);
    m.name = name;
    m.castShadow = !!o.castShadow;
    m.receiveShadow = !!o.receiveShadow;
    if (o.smallCasters) m.userData.smallCasters = true;
    if (o.renderOrder) m.renderOrder = o.renderOrder;
    return m;
}

export function batchTiles(
    geoms: Array<THREE.BufferGeometry | null>,
    material: THREE.Material,
    name: string,
    o: any = {},
    centers: number[][] = [],
) {
    const n = geoms.length;
    const tile: any[] = new Array(n).fill(null);
    const groups: any[] = [];
    const meshes: THREE.Mesh[] = [];

    const byKey = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
        const g = geoms[i];
        if (!g) continue;
        const c = centers[i] || [0, 0];
        const k =
            (NOBATCH || o.merge === false
                ? "i" + i
                : Math.floor(c[0] / SUPER) + "," + Math.floor(c[1] / SUPER)) +
            "|" +
            (g.index ? sig(g) : "noindex" + i);
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(i);
    }
    for (const idx of byKey.values()) {
        const grp: any = { tiles: idx, sup: null, nVis: 0 };
        if (idx.length === 1) {
            const i = idx[0],
                m = mk(geoms[i]!, material, name + " " + i, o);
            tile[i] = { m, grp, vis: true, sh: true };
            meshes.push(m);
            geoms[i] = null;
            grp.nVis = 1;
            groups.push(grp);
            continue;
        }

        let nv = 0,
            ni = 0;
        for (const i of idx) {
            nv += (geoms[i]!.attributes.position as THREE.BufferAttribute)
                .count;
            ni += (geoms[i]!.index as THREE.BufferAttribute).count;
        }
        const G = new THREE.BufferGeometry(),
            g0 = geoms[idx[0]]!;
        for (const [k, a0] of Object.entries(g0.attributes)) {
            const arr = new (a0.array as any).constructor(
                nv * (a0 as any).itemSize,
            );
            let off = 0;
            for (const i of idx) {
                const a = geoms[i]!.attributes[k].array as any;
                arr.set(a, off);
                off += a.length;
            }
            G.setAttribute(
                k,
                new THREE.BufferAttribute(
                    arr,
                    (a0 as any).itemSize,
                    (a0 as any).normalized,
                ),
            );
        }
        const I = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
        const ranges: any[] = [];
        let vo = 0,
            io = 0;
        for (const i of idx) {
            const g = geoms[i]!,
                src = g.index!.array as any;
            for (let j = 0; j < src.length; j++) I[io + j] = src[j] + vo;
            if (!g.boundingSphere) g.computeBoundingSphere();
            if (!g.boundingBox) g.computeBoundingBox();
            ranges.push([io, src.length, g.boundingSphere, g.boundingBox]);
            vo += (g.attributes.position as THREE.BufferAttribute).count;
            io += src.length;
            g.dispose();
            geoms[i] = null;
        }
        const IA = new THREE.BufferAttribute(I, 1);
        G.setIndex(IA);
        G.computeBoundingSphere();
        G.computeBoundingBox();
        const sup = mk(G, material, name + " super", o);
        sup.visible = false;
        meshes.push(sup);
        grp.sup = sup;
        idx.forEach((i, k) => {
            const [start, count, bs, bb] = ranges[k];
            const g = new THREE.BufferGeometry();
            for (const [key, a] of Object.entries(G.attributes))
                g.setAttribute(key, a as any);
            g.setIndex(IA);
            g.setDrawRange(start, count);
            g.boundingSphere = bs;
            g.boundingBox = bb;
            g.userData.sharedRange = true;
            const m = mk(g, material, name + " " + i, o);
            tile[i] = { m, grp, vis: true, sh: true };
            meshes.push(m);
        });
        grp.nVis = idx.length;
        groups.push(grp);
    }

    const resolve = (grp: any) => {
        if (!grp.sup) {
            const t = tile[grp.tiles[0]];
            t.m.visible = t.vis;
            t.m.castShadow = t.sh && !!o.castShadow;
            return;
        }
        let all = true,
            sh0: boolean | null = null,
            same = true;
        for (const i of grp.tiles) {
            const t = tile[i];
            if (!t.vis) {
                all = false;
                break;
            }
            if (sh0 === null) sh0 = t.sh;
            else if (t.sh !== sh0) same = false;
        }
        const useSup = all && same;
        grp.sup.visible = useSup;
        grp.sup.castShadow = useSup && !!sh0 && !!o.castShadow;
        for (const i of grp.tiles) {
            const t = tile[i];
            t.m.visible = !useSup && t.vis;
            t.m.castShadow = t.sh && !!o.castShadow;
        }
    };
    for (const grp of groups) resolve(grp);

    const upG = new THREE.BufferGeometry();
    upG.setDrawRange(0, 0);
    const upM = new THREE.Mesh(upG, UPLOAD_MAT);
    upM.name = name + " upload";
    upM.frustumCulled = false;
    upM.visible = false;
    meshes.push(upM);
    const endWarm = () => {
        upM.visible = false;
    };
    return {
        mesh: meshes[0] ?? null,
        meshes,
        warm(i: number) {
            const t = tile[i];
            if (!t || NOWARM) return false;
            const g = t.m.geometry as THREE.BufferGeometry;
            if (!t.wq)
                t.wq = [
                    ...Object.keys(g.attributes),
                    g.index ? "#index" : null,
                ].filter(Boolean);
            if (!t.wq.length) return false;
            const k = t.wq.shift();
            for (const n of Object.keys(upG.attributes)) upG.deleteAttribute(n);
            upG.setIndex(null);
            if (k === "#index") {
                upG.setAttribute("position", g.attributes.position as any);
                upG.setIndex(g.index);
            } else
                upG.setAttribute(
                    k === "position" ? k : "position",
                    g.attributes[k] as any,
                );
            upM.visible = true;
            return true;
        },
        endWarm,
        has: (i: number) => !!tile[i],
        setVisible(i: number, v: boolean) {
            const t = tile[i];
            if (!t || t.vis === v) return;
            t.vis = v;
            resolve(t.grp);
        },
        setShadow(i: number, v: boolean) {
            const t = tile[i];
            if (!t || t.sh === v) return;
            t.sh = v;
            resolve(t.grp);
        },
    };
}
