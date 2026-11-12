/**
 * Collision indexing and capsule push-out utilities for traversal.
 *
 * @module player-traversal-collide
 * @version 1.0.0
 * @file src/player/traversal/collide.ts
 * @since 0.0.1
 * @description Builds spatial lookups and resolves player capsule collisions against world shapes using exact or fallback methods.
 */

import * as THREE from "three";

export class BoxIndex {
    boxes: any[];
    cell: number;
    map: Map<number, number[]>;
    stamp: Uint32Array;
    frame: number;

    constructor(boxes: any[], cell = 24) {
        this.boxes = boxes || [];
        this.cell = cell;
        this.map = new Map();
        this.stamp = new Uint32Array(this.boxes.length);
        this.frame = 1;
        this.boxes.forEach((b, i) => {
            const x0 = Math.floor(b.min[0] / cell),
                x1 = Math.floor(b.max[0] / cell),
                z0 = Math.floor(b.min[2] / cell),
                z1 = Math.floor(b.max[2] / cell);
            for (let x = x0; x <= x1; x++)
                for (let z = z0; z <= z1; z++) {
                    const k = (x * 73856093) ^ (z * 19349663);
                    let l = this.map.get(k);
                    if (!l) this.map.set(k, (l = []));
                    l.push(i);
                }
        });
    }
    get ok(): boolean {
        return this.boxes.length > 0;
    }

    near(x: number, z: number, r: number, out: number[] = []): number[] {
        out.length = 0;
        const c = this.cell,
            fr = ++this.frame;
        const x0 = Math.floor((x - r) / c),
            x1 = Math.floor((x + r) / c),
            z0 = Math.floor((z - r) / c),
            z1 = Math.floor((z + r) / c);
        for (let cx = x0; cx <= x1; cx++)
            for (let cz = z0; cz <= z1; cz++) {
                const l = this.map.get((cx * 73856093) ^ (cz * 19349663));
                if (!l) continue;
                for (const i of l) {
                    if (this.stamp[i] === fr) continue;
                    this.stamp[i] = fr;
                    const b = this.boxes[i];
                    if (
                        b.max[0] < x - r ||
                        b.min[0] > x + r ||
                        b.max[2] < z - r ||
                        b.min[2] > z + r
                    )
                        continue;
                    out.push(i);
                }
            }
        return out;
    }

    inside(p: THREE.Vector3, m = 0): number {
        for (const i of this.near(p.x, p.z, 0.01, _tmpList)) {
            const b = this.boxes[i];
            if (
                p.x > b.min[0] + m &&
                p.x < b.max[0] - m &&
                p.y > b.min[1] + m &&
                p.y < b.max[1] - m &&
                p.z > b.min[2] + m &&
                p.z < b.max[2] - m
            )
                return i;
        }
        return -1;
    }
}
const _tmpList: number[] = [];

export function createCollider(world: any): any {
    const g = world.collision;
    if (g && g.bb && g.type && typeof g.query === "function") {
        const sh = {
            type: 0,
            x0: 0,
            y0: 0,
            z0: 0,
            x1: 0,
            y1: 0,
            z1: 0,
            cx: 0,
            cz: 0,
            rad: 0,
        };
        return {
            ok: true,
            exact: true,
            near(x: number, z: number, r: number, fn: (i: number) => void) {
                g.query(x - r, z - r, x + r, z + r, fn);
            },
            shape(i: number) {
                const j = i * 6,
                    b = g.bb;
                sh.type = g.type[i];
                sh.x0 = b[j];
                sh.y0 = b[j + 1];
                sh.z0 = b[j + 2];
                sh.x1 = b[j + 3];
                sh.y1 = b[j + 4];
                sh.z1 = b[j + 5];
                if (sh.type === 1) {
                    sh.cx = g.par[j];
                    sh.cz = g.par[j + 1];
                    sh.rad = Math.max(g.par[j + 2], g.par[j + 3]);
                }
                return sh;
            },
            top(i: number, x: number, z: number) {
                return typeof g._top === "function"
                    ? g._top(i, x, z)
                    : g.bb[i * 6 + 4];
            },
            inside(p: THREE.Vector3) {
                try {
                    return g.inside(p.x, p.y, p.z);
                } catch {
                    return false;
                }
            },
        };
    }
    const index = new BoxIndex(world.buildings || []);
    if (!index.ok) return null;
    const sh = {
        type: 0,
        x0: 0,
        y0: 0,
        z0: 0,
        x1: 0,
        y1: 0,
        z1: 0,
        cx: 0,
        cz: 0,
        rad: 0,
    };
    const list: number[] = [];
    return {
        ok: true,
        exact: false,
        near(x: number, z: number, r: number, fn: (i: number) => void) {
            for (const i of index.near(x, z, r, list)) fn(i);
        },
        shape(i: number) {
            const b = index.boxes[i];
            sh.type = 0;
            sh.x0 = b.min[0];
            sh.y0 = b.min[1];
            sh.z0 = b.min[2];
            sh.x1 = b.max[0];
            sh.y1 = b.max[1];
            sh.z1 = b.max[2];
            return sh;
        },
        top(i: number) {
            return index.boxes[i].max[1];
        },
        inside(p: THREE.Vector3) {
            return index.inside(p, 0.05) >= 0;
        },
    };
}

export interface PushOutResult {
    normal: THREE.Vector3;
    point: THREE.Vector3;
    box: number;
    depth: number;
    top: number;
}

export function pushOutCapsule(
    col: any,
    feet: THREE.Vector3,
    r: number,
    h: number,
    stepH: number,
    out: PushOutResult = {
        normal: new THREE.Vector3(),
        point: new THREE.Vector3(),
        box: -1,
        depth: 0,
        top: 0,
    },
): PushOutResult | null {
    let best: PushOutResult | null = null;
    const lo = feet.y + stepH,
        hi = feet.y + h;
    for (let iter = 0; iter < 3; iter++) {
        let moved = false;
        col.near(feet.x, feet.z, r + 0.05, (i: number) => {
            const b = col.shape(i);
            if (b.y0 >= hi || b.y1 <= lo) return;
            let nx: number, nz: number, depth: number, cx: number, cz: number;
            if (b.type === 1) {
                const dx = feet.x - b.cx,
                    dz = feet.z - b.cz,
                    d = Math.hypot(dx, dz);
                if (d >= r + b.rad) return;
                if (d > 1e-6) {
                    nx = dx / d;
                    nz = dz / d;
                } else {
                    nx = 1;
                    nz = 0;
                }
                depth = r + b.rad - d;
                cx = b.cx + nx * b.rad;
                cz = b.cz + nz * b.rad;
            } else {
                cx = Math.min(Math.max(feet.x, b.x0), b.x1);
                cz = Math.min(Math.max(feet.z, b.z0), b.z1);
                const dx = feet.x - cx,
                    dz = feet.z - cz,
                    d2 = dx * dx + dz * dz;
                if (d2 >= r * r) return;
                if (d2 > 1e-10) {
                    const d = Math.sqrt(d2);
                    nx = dx / d;
                    nz = dz / d;
                    depth = r - d;
                } else {
                    const e = [
                        feet.x - b.x0,
                        b.x1 - feet.x,
                        feet.z - b.z0,
                        b.z1 - feet.z,
                    ];
                    let k = 0;
                    for (let j = 1; j < 4; j++) if (e[j] < e[k]) k = j;
                    nx = k === 0 ? -1 : k === 1 ? 1 : 0;
                    nz = k === 2 ? -1 : k === 3 ? 1 : 0;
                    depth = e[k] + r;
                }
            }
            const top = b.type === 2 ? col.top(i, cx, cz) : b.y1;
            if (top <= lo) return;
            feet.x += nx * (depth + 1e-4);
            feet.z += nz * (depth + 1e-4);
            moved = true;
            if (!best || depth > best.depth) {
                best = out;
                out.normal.set(nx, 0, nz);
                out.point.set(
                    feet.x - nx * r,
                    feet.y + h * 0.5,
                    feet.z - nz * r,
                );
                out.box = i;
                out.depth = depth;
                out.top = top;
                if (Math.abs(nx) > 0.999) out.normal.set(Math.sign(nx), 0, 0);
                else if (Math.abs(nz) > 0.999)
                    out.normal.set(0, 0, Math.sign(nz));
            }
        });
        if (!moved) break;
    }
    if (best) {
        let top = best.top;
        const px = best.point.x - best.normal.x * 0.05,
            pz = best.point.z - best.normal.z * 0.05;
        for (let k = 0; k < 6; k++) {
            let next = top;
            col.near(px, pz, 0.02, (i: number) => {
                const b = col.shape(i);
                if (
                    b.y0 <= top + 0.05 &&
                    b.y1 > next &&
                    px >= b.x0 - 0.02 &&
                    px <= b.x1 + 0.02 &&
                    pz >= b.z0 - 0.02 &&
                    pz <= b.z1 + 0.02
                )
                    next = b.type === 2 ? col.top(i, px, pz) : b.y1;
            });
            if (next <= top + 1e-3) break;
            top = next;
        }
        best.top = top;
    }
    return best;
}

export function pushOutRays(
    world: any,
    feet: THREE.Vector3,
    r: number,
    h: number,
    stepH: number,
    out: PushOutResult = {
        normal: new THREE.Vector3(),
        point: new THREE.Vector3(),
        box: -1,
        depth: 0,
        top: 0,
    },
): PushOutResult | null {
    let best: PushOutResult | null = null;
    const o = new THREE.Vector3(),
        d = new THREE.Vector3();
    for (const oy of [stepH + 0.15, h * 0.5, h - 0.15]) {
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            d.set(Math.cos(a), 0, Math.sin(a));
            o.set(feet.x, feet.y + oy, feet.z);
            const hit = world.raycast(o, d, r);
            if (!hit || Math.abs(hit.normal.y) > 0.6) continue;
            const depth = r - hit.distance;
            feet.addScaledVector(hit.normal, depth + 1e-3);
            if (!best || depth > best.depth) {
                best = out;
                out.normal.copy(hit.normal).setY(0).normalize();
                out.point.copy(hit.point);
                out.depth = depth;
                out.box = -1;
                out.top = hit.point.y + 1;
            }
        }
    }
    return best;
}
