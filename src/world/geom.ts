// @ts-nocheck
// OWNER: city agent. Small immediate-mode mesh builder (positions/normals/colors/uv + optional per-vertex "part").
import * as THREE from "three";

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();

export class MB {
  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
    this.uv = [];
    this.part = [];
    this.i = [];
    this.v = 0;
    this.color = [1, 1, 1];
    this.curPart = 0;
    this.xf = null;
  }
  setColor(c) {
    this.color = Array.isArray(c)
      ? c
      : [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map(
          (s) => Math.pow(s, 2.2),
        );
    return this;
  }
  setPart(k) {
    this.curPart = k;
    return this;
  }
  setXf(m) {
    this.xf = m;
    return this;
  }
  vert(x, y, z, nx, ny, nz, u = 0, v = 0) {
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
    this.uv.push(u, v);
    this.part.push(this.curPart);
    return this.v++;
  }
  tri(a, b, c) {
    this.i.push(a, b, c);
  }
  quad(a, b, c, d) {
    this.i.push(a, b, c, a, c, d);
  }
  // box from min/max (axis aligned in local frame)
  box(x0, y0, z0, x1, y1, z1, faces = 63) {
    const F = [
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
    F.forEach(([n, q], k) => {
      if (!(faces & (1 << k))) return;
      const s = q.map(([x, y, z], j) =>
        this.vert(
          x,
          y,
          z,
          n[0],
          n[1],
          n[2],
          j === 1 || j === 2 ? 1 : 0,
          j >= 2 ? 1 : 0,
        ),
      );
      this.quad(s[0], s[1], s[2], s[3]);
    });
    return this;
  }
  boxC(cx, cy, cz, sx, sy, sz, faces) {
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
  // cylinder / frustum along Y
  cyl(cx, y0, cz, r0, r1, h, seg = 8, caps = true, smooth = true) {
    const ring0 = [],
      ring1 = [];
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
        const r = [];
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
        const r = [];
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
  // cylinder between two points
  tube(a, b, r, seg = 6, caps = false) {
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
  // arbitrary transformed sub-build
  with(m, fn) {
    const prev = this.xf;
    this.xf = prev ? prev.clone().multiply(m) : m;
    fn(this);
    this.xf = prev;
    return this;
  }
  merge(other) {
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
  build({ part = false } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    if (part)
      g.setAttribute("aPart", new THREE.Float32BufferAttribute(this.part, 1));
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

export const M4 = (x = 0, y = 0, z = 0, ry = 0, s = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
    new THREE.Vector3(s, s, s),
  );
export const hexLin = (c) =>
  [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map((s) =>
    Math.pow(s, 2.2),
  );
