/**
 * Provides lightweight mesh builder utilities for procedural geometry.
 *
 * @module world-geom
 * @version 1.0.0
 * @file src/world/geom.ts
 * @since 0.0.1
 * @description Defines helper classes and functions for accumulating vertices, indices, transforms, and colors during geometry generation.
 */
import * as THREE from "three";

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();
void _m;

export class MB {
    p: number[] = [];
    n: number[] = [];
    c: number[] = [];
    uv: number[] = [];
    part: number[] = [];
    i: number[] = [];
    v = 0;
    color: [number, number, number] = [1, 1, 1];
    curPart = 0;
    xf: THREE.Matrix4 | null = null;

    setColor(c: number | [number, number, number]): this {
        this.color = Array.isArray(c)
            ? c
            : ([
                  ((c >> 16) & 255) / 255,
                  ((c >> 8) & 255) / 255,
                  (c & 255) / 255,
              ].map((s) => Math.pow(s, 2.2)) as [number, number, number]);
        return this;
    }
    setPart(k: number): this {
        this.curPart = k;
        return this;
    }
    setXf(m: THREE.Matrix4 | null): this {
        this.xf = m;
        return this;
    }
    vert(
        x: number,
        y: number,
        z: number,
        nx: number,
        ny: number,
        nz: number,
        u = 0,
        vv = 0,
    ): number {
        if (this.xf) {
            _v.set(x, y, z).applyMatrix4(this.xf);
            x = _v.x;
            y = _v.y;
            z = _v.z;
            _nm.getNormalMatrix(this.xf);
            _n.set(nx, ny, nz).applyMatrix3(_nm).normalize();
            nx = _n.x;
            ny = _n.y;
            nz = _n.z;
        }
        this.p.push(x, y, z);
        this.n.push(nx, ny, nz);
        this.c.push(...this.color);
        this.uv.push(u, vv);
        this.part.push(this.curPart);
        return this.v++;
    }
    tri(a: number, b: number, c: number): void {
        this.i.push(a, b, c);
    }
    quad(a: number, b: number, c: number, d: number): void {
        this.i.push(a, b, c, a, c, d);
    }

    box(
        x0: number,
        y0: number,
        z0: number,
        x1: number,
        y1: number,
        z1: number,
        faces = 63,
    ): this {
        const F: [[number, number, number], [number, number, number][]][] = [
            [
                [1, 0, 0],
                [
                    [x1, y0, z1],
                    [x1, y0, z0],
                    [x1, y1, z0],
                    [x1, y1, z1],
                ],
            ],
            [
                [-1, 0, 0],
                [
                    [x0, y0, z0],
                    [x0, y0, z1],
                    [x0, y1, z1],
                    [x0, y1, z0],
                ],
            ],
            [
                [0, 1, 0],
                [
                    [x0, y1, z1],
                    [x1, y1, z1],
                    [x1, y1, z0],
                    [x0, y1, z0],
                ],
            ],
            [
                [0, -1, 0],
                [
                    [x0, y0, z0],
                    [x1, y0, z0],
                    [x1, y0, z1],
                    [x0, y0, z1],
                ],
            ],
            [
                [0, 0, 1],
                [
                    [x0, y0, z1],
                    [x1, y0, z1],
                    [x1, y1, z1],
                    [x0, y1, z1],
                ],
            ],
            [
                [0, 0, -1],
                [
                    [x1, y0, z0],
                    [x0, y0, z0],
                    [x0, y1, z0],
                    [x1, y1, z0],
                ],
            ],
        ];
        F.forEach(([nn, q], k) => {
            if (!(faces & (1 << k))) return;
            const s = q.map(([x, y, z], j) =>
                this.vert(
                    x,
                    y,
                    z,
                    nn[0],
                    nn[1],
                    nn[2],
                    j === 1 || j === 2 ? 1 : 0,
                    j >= 2 ? 1 : 0,
                ),
            );
            this.quad(s[0], s[1], s[2], s[3]);
        });
        return this;
    }
    boxC(
        cx: number,
        cy: number,
        cz: number,
        sx: number,
        sy: number,
        sz: number,
        faces?: number,
    ): this {
        return this.box(
            cx - sx / 2,
            cy - sy / 2,
            cz - sz / 2,
            cx + sx / 2,
            cy + sy / 2,
            cz + sz / 2,
            faces,
        );
    }

    cyl(
        cx: number,
        y0: number,
        cz: number,
        r0: number,
        r1: number,
        h: number,
        seg = 8,
        caps = true,
        smooth = true,
    ): this {
        const ring0: number[] = [],
            ring1: number[] = [];
        const slope = (r0 - r1) / h;
        for (let k = 0; k <= seg; k++) {
            const a = (k / seg) * Math.PI * 2;
            const ca = Math.cos(a),
                sa = Math.sin(a);
            const nl = Math.hypot(1, slope);
            ring0.push(
                this.vert(
                    cx + ca * r0,
                    y0,
                    cz + sa * r0,
                    ca / nl,
                    slope / nl,
                    sa / nl,
                    k / seg,
                    0,
                ),
            );
            ring1.push(
                this.vert(
                    cx + ca * r1,
                    y0 + h,
                    cz + sa * r1,
                    ca / nl,
                    slope / nl,
                    sa / nl,
                    k / seg,
                    1,
                ),
            );
        }
        for (let k = 0; k < seg; k++)
            this.quad(ring0[k + 1], ring0[k], ring1[k], ring1[k + 1]);
        if (caps) {
            if (r1 > 0) {
                const c = this.vert(cx, y0 + h, cz, 0, 1, 0);
                const r: number[] = [];
                for (let k = 0; k <= seg; k++) {
                    const a = (k / seg) * Math.PI * 2;
                    r.push(
                        this.vert(
                            cx + Math.cos(a) * r1,
                            y0 + h,
                            cz + Math.sin(a) * r1,
                            0,
                            1,
                            0,
                        ),
                    );
                }
                for (let k = 0; k < seg; k++) this.tri(c, r[k + 1], r[k]);
            }
            if (r0 > 0) {
                const c = this.vert(cx, y0, cz, 0, -1, 0);
                const r: number[] = [];
                for (let k = 0; k <= seg; k++) {
                    const a = (k / seg) * Math.PI * 2;
                    r.push(
                        this.vert(
                            cx + Math.cos(a) * r0,
                            y0,
                            cz + Math.sin(a) * r0,
                            0,
                            -1,
                            0,
                        ),
                    );
                }
                for (let k = 0; k < seg; k++) this.tri(c, r[k], r[k + 1]);
            }
        }
        void smooth;
        return this;
    }

    tube(
        a: [number, number, number],
        b: [number, number, number],
        r: number,
        seg = 6,
        caps = false,
    ): this {
        const A = new THREE.Vector3(...a),
            B = new THREE.Vector3(...b);
        const d = B.clone().sub(A);
        const L = d.length();
        const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            d.normalize(),
        );
        const m = new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1));
        const prev = this.xf;
        this.xf = prev ? prev.clone().multiply(m) : m;
        this.cyl(0, 0, 0, r, r, L, seg, caps);
        this.xf = prev;
        return this;
    }

    with(m: THREE.Matrix4, fn: (mb: MB) => void): this {
        const prev = this.xf;
        this.xf = prev ? prev.clone().multiply(m) : m;
        fn(this);
        this.xf = prev;
        return this;
    }
    merge(other: MB): this {
        const off = this.v;
        this.p.push(...other.p);
        this.n.push(...other.n);
        this.c.push(...other.c);
        this.uv.push(...other.uv);
        this.part.push(...other.part);
        for (const k of other.i) this.i.push(k + off);
        this.v += other.v;
        return this;
    }
    build({ part = false }: { part?: boolean } = {}): THREE.BufferGeometry {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
        g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
        if (part)
            g.setAttribute(
                "aPart",
                new THREE.Float32BufferAttribute(this.part, 1),
            );
        g.setIndex(
            this.v > 65535
                ? new THREE.Uint32BufferAttribute(this.i, 1)
                : new THREE.Uint16BufferAttribute(this.i, 1),
        );
        g.computeBoundingSphere();
        g.computeBoundingBox();
        return g;
    }
}

export const M4 = (x = 0, y = 0, z = 0, ry = 0, s = 1): THREE.Matrix4 =>
    new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
        new THREE.Vector3(s, s, s),
    );

export const hexLin = (c: number): [number, number, number] =>
    [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map(
        (s) => Math.pow(s, 2.2),
    ) as [number, number, number];
