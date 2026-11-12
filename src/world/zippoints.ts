// @ts-nocheck
/**
 * Manages zipline and grapple anchor points in the world.
 *
 * @module world-zippoints
 * @version 1.0.0
 * @file src/world/zippoints.ts
 * @since 0.0.1
 * @description Stores, queries, and visualizes zip point candidates derived from buildings, props, and other world geometry.
 */
import * as THREE from "three";

export const ZKIND = [
    "roofEdge",
    "roofCorner",
    "ledge",
    "waterTower",
    "antenna",
    "pole",
    "lampTop",
    "signalMast",
];
const ZID = Object.fromEntries(ZKIND.map((k, i) => [k, i]));

export class ZipPoints {
    constructor() {
        this.raw = [];
        this.cell = 32;
    }
    add(x, y, z, nx, ny, nz, kind) {
        this.raw.push(x, y, z, nx, ny, nz, ZID[kind] ?? 0);
    }

    edge(ax, az, bx, bz, y, nx, nz, kind = "roofEdge", step = 7) {
        const L = Math.hypot(bx - ax, bz - az);
        const k = Math.max(1, Math.round(L / step));
        for (let i = 1; i < k; i++) {
            const t = i / k;
            this.add(
                ax + (bx - ax) * t,
                y,
                az + (bz - az) * t,
                nx,
                0,
                nz,
                kind,
            );
        }
        if (k === 1 && L > 2)
            this.add((ax + bx) / 2, y, (az + bz) / 2, nx, 0, nz, kind);
    }

    addBlockers(list) {
        (this.blockers ??= []).push(...list);
    }

    addTreeBlockers(trees) {
        const out = [];
        for (const p of trees?.pools ?? []) {
            if (!/^trees-.*-near$/.test(p.mesh?.name ?? "")) continue;
            const g = p.geo ?? p.mesh.geometry;
            if (!g.boundingBox) g.computeBoundingBox();
            const b = g.boundingBox,
                R = Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z) * 0.9;
            for (const it of p.items) {
                const s = it.s ?? 1;
                out.push({
                    x: it.x,
                    z: it.z,
                    r: R * s + 0.45,
                    y0: it.y + b.min.y * s - 1.9,
                    y1: it.y + b.max.y * s,
                });
            }
        }
        this.addBlockers(out);
        return out.length;
    }
    _blocked(x, y, z) {
        const B = this.blockers;
        if (!B) return false;
        if (!this._bh) {
            this._bh = new Map();
            B.forEach((b, i) => {
                for (
                    let gx = Math.floor((b.x - b.r) / 16);
                    gx <= Math.floor((b.x + b.r) / 16);
                    gx++
                )
                    for (
                        let gz = Math.floor((b.z - b.r) / 16);
                        gz <= Math.floor((b.z + b.r) / 16);
                        gz++
                    ) {
                        const k = gx * 7919 + gz;
                        let a = this._bh.get(k);
                        if (!a) this._bh.set(k, (a = []));
                        a.push(i);
                    }
            });
        }
        const a = this._bh.get(Math.floor(x / 16) * 7919 + Math.floor(z / 16));
        if (!a) return false;
        for (const i of a) {
            const b = B[i];
            if (
                y > b.y0 &&
                y < b.y1 &&
                (x - b.x) ** 2 + (z - b.z) ** 2 < b.r * b.r
            )
                return true;
        }
        return false;
    }

    finalize(grid) {
        const R = this.raw,
            n = R.length / 7;
        const keep = [];
        for (let i = 0; i < n; i++) {
            const j = i * 7,
                x = R[j],
                y = R[j + 1],
                z = R[j + 2],
                nx = R[j + 3],
                nz = R[j + 5],
                k = R[j + 6];
            if (this._blocked(x, y, z)) continue;

            if (k === ZID.ledge && y < 8) continue;
            if (k >= 3 && y < 3) continue;
            if (grid) {
                const sx = k < 3 ? x - nx * 0.12 : x,
                    sz = k < 3 ? z - nz * 0.12 : z;
                const top = grid.topAt(sx, sz, y + 0.3);
                if (top.id < 0 || Math.abs(top.y - y) > (k < 3 ? 0.06 : 0.3))
                    continue;
                if (k >= 3) {
                    const t2 = grid.topAt(x, z, y + 0.3);
                    if (t2.id < 0) continue;
                    R[j + 1] = t2.y;
                } else R[j + 1] = top.y;
                const ys = R[j + 1];

                const up = k >= 3 ? 0.35 : 0.3;
                if (grid.inside(x, ys + up, z) || grid.inside(x, ys + 1.2, z))
                    continue;
                if (
                    grid.cast(x, ys + 0.02, z, 0, 1, 0, 2.0) ||
                    grid.cast(sx, ys + 0.02, sz, 0, 1, 0, 2.0)
                )
                    continue;
                if (k === ZID.ledge) {
                    const dx = x - nx * 0.6,
                        dz = z - nz * 0.6,
                        t3 = grid.topAt(dx, dz, ys + 0.05);
                    if (
                        t3.id < 0 ||
                        Math.abs(t3.y - ys) > 0.05 ||
                        grid.inside(dx, ys + 0.3, dz)
                    )
                        continue;
                }
                if (k < 3) {
                    const ox = x + nx * 0.35,
                        oz = z + nz * 0.35;
                    if (grid.inside(ox, ys + (k === ZID.ledge ? 1.3 : 0.3), oz))
                        continue;
                }
            }
            keep.push(i);
        }
        const P = new Float32Array(keep.length * 6),
            K = new Uint8Array(keep.length);
        keep.forEach((i, q) => {
            for (let c = 0; c < 6; c++) P[q * 6 + c] = R[i * 7 + c];
            K[q] = R[i * 7 + 6];
        });
        this.P = P;
        this.K = K;
        this.raw = null;
        this.blockers = null;
        this._bh = null;

        const c = this.cell,
            m = new Map();
        for (let q = 0; q < K.length; q++) {
            const key =
                (Math.floor(P[q * 6] / c) * 73856093) ^
                (Math.floor(P[q * 6 + 2] / c) * 19349663);
            let a = m.get(key);
            if (!a) m.set(key, (a = []));
            a.push(q);
        }
        this.hash = m;
        return this;
    }
    get count() {
        return this.K ? this.K.length : this.raw.length / 7;
    }
    query(center, radius, kinds = null) {
        const out = [];
        if (!this.hash) return out;
        const c = this.cell,
            P = this.P,
            r2 = radius * radius;
        const x0 = Math.floor((center.x - radius) / c),
            x1 = Math.floor((center.x + radius) / c);
        const z0 = Math.floor((center.z - radius) / c),
            z1 = Math.floor((center.z + radius) / c);
        const tmp = [];
        for (let gx = x0; gx <= x1; gx++)
            for (let gz = z0; gz <= z1; gz++) {
                const a = this.hash.get((gx * 73856093) ^ (gz * 19349663));
                if (!a) continue;
                for (const q of a) {
                    const j = q * 6,
                        dx = P[j] - center.x,
                        dy = P[j + 1] - center.y,
                        dz = P[j + 2] - center.z;
                    const d2 = dx * dx + dy * dy + dz * dz;
                    if (d2 > r2) continue;
                    if (
                        Math.floor(P[j] / c) !== gx ||
                        Math.floor(P[j + 2] / c) !== gz
                    )
                        continue;
                    if (kinds && !kinds.includes(ZKIND[this.K[q]])) continue;
                    tmp.push(q, d2);
                }
            }
        const idx = [];
        for (let i = 0; i < tmp.length; i += 2) idx.push(i);
        idx.sort((a, b) => tmp[a + 1] - tmp[b + 1]);
        for (const i of idx) {
            const q = tmp[i],
                j = q * 6;
            out.push({
                pos: new THREE.Vector3(P[j], P[j + 1], P[j + 2]),
                normal: new THREE.Vector3(P[j + 3], P[j + 4], P[j + 5]),
                kind: ZKIND[this.K[q]],
            });
        }
        return out;
    }
}

export function addPropAnchors(Z, props) {
    const anchors = props?.anchors?.() ?? props?.propAnchors?.();
    if (Array.isArray(anchors)) {
        const tops = new Map();
        for (const p of props?.pools ?? []) {
            if (p.mesh?.name !== "antenna") continue;
            const g = p.geo ?? p.mesh.geometry;
            if (!g.boundingBox) g.computeBoundingBox();
            tops.set("antenna", { items: p.items, maxY: g.boundingBox.max.y });
        }
        for (const a of anchors) {
            const t = tops.get(a.kind);
            if (t) {
                let best = null,
                    bd = 0.25;
                for (const it of t.items) {
                    const d = Math.hypot(it.x - a.pos.x, it.z - a.pos.z);
                    if (d < bd) {
                        bd = d;
                        best = it;
                    }
                }
                if (best)
                    a.pos.y =
                        best.y +
                        t.maxY *
                            (best.scale3
                                ? best.scale3[1] * (best.s ?? 1)
                                : (best.s ?? 1));
            }
        }

        const mastPole = new Set();
        for (const p of props?.pools ?? [])
            if (p.mesh?.name === "mast")
                for (const it of p.items)
                    mastPole.add(
                        Math.round(it.x * 10) + "," + Math.round(it.z * 10),
                    );
        for (const a of anchors) {
            if (
                a.kind === "signalMast" &&
                mastPole.has(
                    Math.round(a.pos.x * 10) + "," + Math.round(a.pos.z * 10),
                )
            )
                continue;
            Z.add(
                a.pos.x,
                a.pos.y,
                a.pos.z,
                a.normal?.x ?? 0,
                a.normal?.y ?? 1,
                a.normal?.z ?? 0,
                a.kind,
            );
        }
        return anchors.length;
    }
    const pools = props?.pools ?? [];
    let n = 0;
    const put = (it, lx, ly, lz, kind) => {
        const s = it.s ?? 1,
            c = Math.cos(it.ry),
            sn = Math.sin(it.ry);

        Z.add(
            it.x + (lx * c + lz * sn) * s,
            it.y + ly * s,
            it.z + (-lx * sn + lz * c) * s,
            0,
            1,
            0,
            kind,
        );
        n++;
    };
    for (const p of pools) {
        const name = p.mesh?.name;
        if (name === "lamp")
            for (const it of p.items) put(it, 0, 9.15, 2.9, "lampTop");
        else if (name === "mast")
            for (const it of p.items) {
                put(it, 0, 7.9, 0, "signalMast");
                put(it, 0, 6.8, 10.4, "signalMast");
            }
    }
    return n;
}

const ZCOL = [
    [1, 1, 1],
    [1, 0.9, 0.1],
    [1, 0.5, 0.1],
    [0.2, 0.5, 1],
    [1, 0.15, 0.1],
    [0.3, 1, 0.3],
    [0.3, 1, 0.3],
    [0.1, 0.8, 0.4],
];
export function zipDebugObject(zips, center, radius = 150) {
    const pts = zips.query(center, radius);
    const P = [],
        C = [],
        L = [],
        LC = [];
    for (const z of pts) {
        const c = ZCOL[ZKIND.indexOf(z.kind)] ?? [1, 1, 1];
        P.push(z.pos.x, z.pos.y + 0.05, z.pos.z);
        C.push(...c);
        L.push(
            z.pos.x,
            z.pos.y + 0.05,
            z.pos.z,
            z.pos.x + z.normal.x * 0.8,
            z.pos.y + 0.05 + z.normal.y * 0.8,
            z.pos.z + z.normal.z * 0.8,
        );
        LC.push(...c, ...c);
    }
    const grp = new THREE.Group();
    grp.name = "zipDebug";
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    grp.add(
        new THREE.Points(
            g,
            new THREE.PointsMaterial({
                size: 11,
                sizeAttenuation: false,
                vertexColors: true,
                depthTest: false,
            }),
        ),
    );
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(L, 3));
    lg.setAttribute("color", new THREE.Float32BufferAttribute(LC, 3));
    grp.add(
        new THREE.LineSegments(
            lg,
            new THREE.LineBasicMaterial({
                vertexColors: true,
                depthTest: false,
            }),
        ),
    );
    grp.children.forEach((o) => {
        o.frustumCulled = false;
        o.renderOrder = 11;
    });
    return grp;
}

export function createGeoDebug(root, grid, zips, collisionDebugLines) {
    const q = new URLSearchParams(
        typeof location !== "undefined" ? location.search : "",
    );
    const st = {
        zips: q.has("zipdbg"),
        collision: q.has("coldbg"),
        radius: +(q.get("dbgr") || 60),
    };
    let zObj = null,
        cObj = null;
    const last = new THREE.Vector3(1e9, 0, 0);
    const drop = (o) => {
        if (o) {
            root.remove(o);
            o.traverse((c) => {
                c.geometry?.dispose();
                c.material?.dispose();
            });
        }
        return null;
    };
    return {
        set(o) {
            Object.assign(st, o);
            last.set(1e9, 0, 0);
            if (!st.zips) zObj = drop(zObj);
            if (!st.collision) cObj = drop(cObj);
        },
        update(camera) {
            if (!st.zips && !st.collision) return;
            if (camera.position.distanceTo(last) < st.radius * 0.3) return;
            last.copy(camera.position);
            if (st.zips) {
                zObj = drop(zObj);
                zObj = zipDebugObject(zips, camera.position, st.radius * 2);
                root.add(zObj);
            }
            if (st.collision) {
                cObj = drop(cObj);
                cObj = collisionDebugLines(grid, camera.position, st.radius);
                root.add(cObj);
            }
        },
    };
}
