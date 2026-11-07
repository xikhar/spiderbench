// @ts-nocheck
// Static collision for the city: exact primitives that mirror the RENDERED geometry (contract C4).
// Every solid that buildings/ground/hero emit is registered here by the same call that emits its triangles, so
// world.raycast / world.groundHeight agree with what is on screen to well under 2 cm.
//
// Primitive kinds (all stored in flat typed arrays, bucketed in a uniform XZ grid, visited with a 2D DDA):
//   BOX   axis-aligned box
//   CYL   vertical frustum (cx,cz, y0..y1, radius r0 at y0 -> r1 at y1): tanks, cone roofs, legs, vents, poles
//   HF    height field (instanced props): a grid of columns (cell size c) over the AABB, column k solid from base + lo[k]
//         up to base + h[k] (h = -Infinity: empty). Fields are shared between instances (Solids.fields).
//   RAMP  AABB clipped by a sloped top plane (awnings, skylight glazing, pitched caps). The plane rises linearly
//         along one axis (0 = x, 2 = z) from yA at the min side to yB at the max side.
// Flags per primitive:
//   OVERHANG  the solid floats above open space (cornice projection, awning, fire-escape deck, water-tank body).
//             groundHeight(x,z) WITHOUT a y ignores these (so walking under an awning never snaps you on top of it);
//             groundHeight(x,z,y) and raycast always include them.
import * as THREE from "three";

export const BOX = 0,
  CYL = 1,
  RAMP = 2,
  HF = 3;
export const OVERHANG = 1,
  NOZIP = 2,
  DEAD = 4; // DEAD: removed (never inserted into the grid)
// (veg r1) BLOCKONLY: blocks player capsules (query / pushOutCapsule / inside) but is invisible to cast (raycast:
// wall-run / wide-wall probes, camera, web anchors) and topAt (no standing / perching on it). Tree trunks.
export const BLOCKONLY = 8;

// surface kinds (reported as hit.kind; handy for footstep sfx / perch logic)
export const KIND = [
  "wall",
  "roof",
  "parapet",
  "coping",
  "cornice",
  "ledge",
  "equipment",
  "bulkhead",
  "watertower",
  "awning",
  "fireescape",
  "skylight",
  "antenna",
  "spire",
  "hero",
  "park",
  "pier",
  "glass",
  "pole",
  "trunk",
]; // (veg r1) + trunk
const KID = Object.fromEntries(KIND.map((k, i) => [k, i]));

export class Solids {
  constructor() {
    this.t = [];
    this.b = [];
    this.p = [];
    this.f = [];
    this.k = [];
    this.fields = [];
  }
  _add(type, x0, y0, z0, x1, y1, z1, params, kind, flags) {
    this.t.push(type);
    this.b.push(x0, y0, z0, x1, y1, z1);
    this.p.push(...params);
    this.f.push(flags | 0);
    this.k.push(KID[kind] ?? 0);
    return this.t.length - 1;
  }
  box(x0, y0, z0, x1, y1, z1, kind = "wall", flags = 0) {
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return -1;
    return this._add(
      BOX,
      x0,
      y0,
      z0,
      x1,
      y1,
      z1,
      [0, 0, 0, 0, 0, 0],
      kind,
      flags,
    );
  }
  cyl(cx, cz, y0, y1, r0, r1, kind = "equipment", flags = 0) {
    const r = Math.max(r0, r1);
    return this._add(
      CYL,
      cx - r,
      y0,
      cz - r,
      cx + r,
      y1,
      cz + r,
      [cx, cz, r0, r1, 0, 0],
      kind,
      flags,
    );
  }
  // top plane rises along `axis` (0:x, 2:z) from yA at the min side to yB at the max side; solid spans down to y0
  // thk > 0: only a slab of that thickness under the plane is solid (canvas awnings, glazing)
  ramp(x0, y0, z0, x1, z1, axis, yA, yB, kind = "awning", flags = 0, thk = 0) {
    return this._add(
      RAMP,
      x0,
      y0,
      z0,
      x1,
      Math.max(yA, yB),
      z1,
      [axis, yA, yB, thk, 0, 0],
      kind,
      flags,
    );
  }
  get count() {
    return this.t.length;
  }
  remove(i) {
    this.f[i] |= DEAD;
  }
  // field: {nx, nz, cell, h: Float32Array(nx*nz) column tops above the base (-Infinity = empty), lo: column bottoms
  // above the base, hMax, loMin}; returns field id
  addField(f) {
    this.fields.push(f);
    return this.fields.length - 1;
  }
  hfield(x0, base, z0, fid, kind = "equipment", flags = 0) {
    const f = this.fields[fid];
    return this._add(
      HF,
      x0,
      base + f.loMin,
      z0,
      x0 + f.nx * f.cell,
      base + f.hMax,
      z0 + f.nz * f.cell,
      [fid, base, 0, 0, 0, 0],
      kind,
      flags,
    );
  }
}

// Exact-fit collision for instanced props (contract C4). The props module's own solids are coarse (up to 1.3 m off,
// or missing: lamp heads, tree-guard rails). For each instance of the listed pools this rasterises the model's
// triangles (with the instance's rotation/scale) at `cell` spacing into per-column [bottom, top] spans -> one HF
// primitive per instance (fields cached per model+rotation+scale). Per pool:
//   minY    only instances whose base is above this (rooftops: 3)
//   yCut    only geometry above this model-space height (lamp heads / mast arms: the poles keep their own cylinders)
//   keepOld keep the props module's solids for the instance (otherwise those whose centre lies in the instance's
//           footprint and that were added in [start, end) are removed)
//   solidBase columns reach down to the instance base (roof equipment: no crawl space under it) instead of the
//           lowest rendered surface in the column
export function fitInstancedSolids(
  S,
  pools,
  { spec, start = 0, end = S.count, cell = 0.025 } = {},
) {
  const _m = new THREE.Matrix4(),
    _q = new THREE.Quaternion(),
    _p = new THREE.Vector3(),
    _s = new THREE.Vector3(),
    _e = new THREE.Euler();
  const Y = new THREE.Vector3(0, 1, 0),
    RQ = Math.PI / 360;
  let nInst = 0,
    nDead = 0;
  const cache = new Map();
  const H = new Map(),
    C = 8;
  for (let i = start; i < end; i++) {
    const j = i * 6;
    const k =
      Math.floor((S.b[j] + S.b[j + 3]) / 2 / C) * 100003 +
      Math.floor((S.b[j + 2] + S.b[j + 5]) / 2 / C);
    let a = H.get(k);
    if (!a) H.set(k, (a = []));
    a.push(i);
  }
  for (const pool of pools) {
    const name = pool?.mesh?.name,
      O = spec[name];
    if (!O) continue;
    const minY = O.minY ?? -Infinity,
      yCut = O.yCut ?? -Infinity;
    const g = pool.mesh.geometry,
      P = g.attributes.position,
      I = g.index; // exactly what is drawn
    const ntAll = I ? I.count / 3 : P.count / 3;
    const locA = [];
    for (let t = 0; t < ntAll; t++) {
      const tri = [];
      for (let v = 0; v < 3; v++) {
        const k = I ? I.getX(t * 3 + v) : t * 3 + v;
        tri.push(P.getX(k), P.getY(k), P.getZ(k));
      }
      if (Math.max(tri[1], tri[4], tri[7]) <= yCut + 1e-4) continue;
      locA.push(...tri);
    }
    const loc = Float32Array.from(locA),
      nt = loc.length / 9;
    if (!nt) continue;
    const W = new Float32Array(nt * 9);
    for (const it of pool.items) {
      if (it.y < minY) continue;
      _p.set(0, 0, 0);
      const ry = Math.round(it.ry / RQ) * RQ; // 0.5 degree steps: < 5 mm at the rim of a 0.6 m dish, bounded field count
      if (it.rx || it.rz) {
        _e.set(it.rx || 0, ry, it.rz || 0, "YXZ");
        _q.setFromEuler(_e);
      } else _q.setFromAxisAngle(Y, ry);
      if (it.scale3)
        _s.set(it.scale3[0] * it.s, it.scale3[1] * it.s, it.scale3[2] * it.s);
      else _s.set(it.s, it.s, it.s);
      const key =
        name +
        "|" +
        [ry, it.rx || 0, it.rz || 0, _s.x, _s.y, _s.z]
          .map((v) => v.toFixed(4))
          .join(",");
      let F = cache.get(key);
      if (!F) {
        _m.compose(_p, _q, _s);
        const e = _m.elements;
        let x0 = Infinity,
          z0 = Infinity,
          x1 = -Infinity,
          z1 = -Infinity,
          yMax = -Infinity;
        for (let q = 0; q < nt * 3; q++) {
          const x = loc[q * 3],
            y = loc[q * 3 + 1],
            z = loc[q * 3 + 2];
          const wx = e[0] * x + e[4] * y + e[8] * z,
            wy = e[1] * x + e[5] * y + e[9] * z,
            wz = e[2] * x + e[6] * y + e[10] * z;
          W[q * 3] = wx;
          W[q * 3 + 1] = wy;
          W[q * 3 + 2] = wz;
          if (wx < x0) x0 = wx;
          if (wx > x1) x1 = wx;
          if (wz < z0) z0 = wz;
          if (wz > z1) z1 = wz;
          if (wy > yMax) yMax = wy;
        }
        // column top = highest up-facing surface, bottom = lowest down-facing surface (heights exact)
        const nx = Math.max(1, Math.ceil((x1 - x0) / cell)),
          nz = Math.max(1, Math.ceil((z1 - z0) / cell));
        const h = new Float32Array(nx * nz).fill(-Infinity),
          lo = new Float32Array(nx * nz).fill(Infinity);
        const cutW = yCut * _s.y;
        const dn = new Float32Array(nx * nz).fill(Infinity); // lowest down-facing surface per column
        const sub = new Float32Array(nx * nz * 9).fill(-Infinity); // per-cell 3x3 up-facing sub-sample tops (thin parts)
        for (let t = 0; t < nt; t++) {
          const o = t * 9;
          const ax = W[o],
            ay = W[o + 1],
            az = W[o + 2],
            bx = W[o + 3],
            by = W[o + 4],
            bz = W[o + 5],
            cx = W[o + 6],
            cy = W[o + 7],
            cz = W[o + 8];
          const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
          // front-face orientation: (b-a)x(c-a).y > 0 faces up (visible from above: defines tops), < 0 faces down
          const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
          const len =
            Math.hypot(bx - ax, by - ay, bz - az) *
              Math.hypot(cx - ax, cy - ay, cz - az) +
            1e-12;
          if (Math.abs(ny) / len < 0.02) continue; // vertical faces are invisible from above (FrontSide); bounded by their neighbours
          // sub-samples at cell/3 spacing, each folded into its cell (max top / min bottom): up-facing parts down to
          // ~cell/3 wide are captured; a column never extends more than cell/2 past a rendered edge
          const SS = cell / 3;
          const i0 = Math.max(
              0,
              Math.ceil((Math.min(ax, bx, cx) - x0) / SS - 0.5 - 1e-6),
            ),
            i1 = Math.min(
              nx * 3 - 1,
              Math.floor((Math.max(ax, bx, cx) - x0) / SS - 0.5 + 1e-6),
            );
          const k0 = Math.max(
              0,
              Math.ceil((Math.min(az, bz, cz) - z0) / SS - 0.5 - 1e-6),
            ),
            k1 = Math.min(
              nz * 3 - 1,
              Math.floor((Math.max(az, bz, cz) - z0) / SS - 0.5 + 1e-6),
            );
          const up = ny > 0;
          for (let kk = k0; kk <= k1; kk++)
            for (let ii = i0; ii <= i1; ii++) {
              const px = x0 + (ii + 0.5) * SS,
                pz = z0 + (kk + 0.5) * SS;
              const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den;
              const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den;
              const l3 = 1 - l1 - l2;
              if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
              const y = Math.max(l1 * ay + l2 * by + l3 * cy, cutW),
                q = Math.floor(kk / 3) * nx + Math.floor(ii / 3);
              const centre = kk % 3 === 1 && ii % 3 === 1;
              if (up) {
                if (centre) {
                  if (y > h[q]) h[q] = y;
                  if (y < lo[q]) lo[q] = y;
                }
                const sq = q * 9 + (kk % 3) * 3 + (ii % 3);
                if (y > sub[sq]) sub[sq] = y;
              } else if (y < dn[q]) dn[q] = y;
            }
        }
        let loMin = Infinity;
        for (let q = 0; q < h.length; q++) {
          // the cell-centre sample defines the column (exact on slopes, edges within cell/2), unless a raised part
          // covers >= 3 of the 9 sub-samples (thin rails, rims, louvre blades narrower than a cell): then its top wins
          {
            let best = -Infinity;
            for (let a = 0; a < 9; a++) {
              const v = sub[q * 9 + a];
              if (!(v > h[q] + 0.02)) continue;
              let n = 0;
              for (let b = 0; b < 9; b++) if (sub[q * 9 + b] >= v - 0.02) n++;
              if (n >= 3 && v > best) best = v;
            }
            if (best > -1e30) {
              if (!(h[q] > -1e30)) lo[q] = best;
              h[q] = best;
            }
          }
          if (!(h[q] > -1e30) || (h[q] < 0.005 && yCut === -Infinity)) {
            h[q] = -Infinity;
            lo[q] = 0;
            continue;
          } // nothing visible from above / ground-hugging skirt
          // bottom: the lowest down-facing surface under the top (closed shells), else a 2 cm skin under the top
          lo[q] = O.solidBase
            ? 0
            : dn[q] <= h[q]
              ? dn[q]
              : Math.min(lo[q], h[q] - 0.02);
          if (lo[q] > h[q] - 0.02) lo[q] = h[q] - 0.02;
          if (lo[q] < loMin) loMin = lo[q];
        }
        if (!(loMin < Infinity)) {
          cache.set(key, (F = null));
          continue;
        }
        F = {
          id: S.addField({ nx, nz, cell, h, lo, hMax: yMax, loMin, src: key }),
          x0,
          z0,
          x1,
          z1,
          yMax,
        };
        cache.set(key, F);
      }
      if (!F) continue;
      S.hfield(
        it.x + F.x0,
        it.y,
        it.z + F.z0,
        F.id,
        O.kind ?? "equipment",
        O.flags ?? 0,
      );
      nInst++;
      // keepOld: only the old solids lying wholly above the cut (e.g. a coarse mast-arm box) are replaced
      const cutY = O.keepOld ? it.y + yCut * _s.y - 0.05 : -Infinity;
      const X0 = it.x + F.x0,
        X1 = it.x + F.x1,
        Z0 = it.z + F.z0,
        Z1 = it.z + F.z1;
      for (
        let gx = Math.floor((X0 - 1) / C);
        gx <= Math.floor((X1 + 1) / C);
        gx++
      )
        for (
          let gz = Math.floor((Z0 - 1) / C);
          gz <= Math.floor((Z1 + 1) / C);
          gz++
        ) {
          for (const i of H.get(gx * 100003 + gz) ?? []) {
            const j = i * 6,
              b = S.b;
            if (S.f[i] & DEAD) continue;
            const mx = (b[j] + b[j + 3]) / 2,
              mz = (b[j + 2] + b[j + 5]) / 2;
            if (mx < X0 || mx > X1 || mz < Z0 || mz > Z1) continue;
            if (
              b[j + 1] < Math.max(it.y - 0.02, cutY) ||
              b[j + 1] > it.y + F.yMax
            )
              continue;
            S.remove(i);
            nDead++;
          }
        }
    }
  }
  let cells = 0;
  for (const f of S.fields) cells += f.h.length;
  return { nInst, nBox: cache.size, nDead, cells };
}

export class CollisionGrid {
  constructor(solids, cell = 24, { releaseSource = false } = {}) {
    const n = solids.count;
    this.n = n;
    this.cell = cell;
    this.type = Uint8Array.from(solids.t);
    this.bb = Float32Array.from(solids.b);
    this.par = Float32Array.from(solids.p);
    this.flags = Uint8Array.from(solids.f);
    this.kind = Uint8Array.from(solids.k);
    this.fields = solids.fields || [];
    // The caller can drop the large JS-number arrays as soon as their typed copies exist,
    // before the spatial index allocates its own buckets. Height fields stay shared.
    if (releaseSource) {
      solids.t = [];
      solids.b = [];
      solids.p = [];
      solids.f = [];
      solids.k = [];
    }
    let x0 = Infinity,
      z0 = Infinity,
      x1 = -Infinity,
      z1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const j = i * 6;
      x0 = Math.min(x0, this.bb[j]);
      z0 = Math.min(z0, this.bb[j + 2]);
      x1 = Math.max(x1, this.bb[j + 3]);
      z1 = Math.max(z1, this.bb[j + 5]);
    }
    if (!n) {
      x0 = z0 = 0;
      x1 = z1 = 1;
    }
    this.ox = x0 - 1;
    this.oz = z0 - 1;
    this.nx = Math.ceil((x1 - this.ox + 1) / cell);
    this.nz = Math.ceil((z1 - this.oz + 1) / cell);
    const counts = new Uint32Array(this.nx * this.nz + 1);
    for (let i = 0; i < n; i++) {
      if (this.flags[i] & DEAD) continue;
      const j = i * 6,
        a = Math.floor((this.bb[j] - this.ox) / cell),
        b = Math.floor((this.bb[j + 3] - this.ox) / cell),
        c = Math.floor((this.bb[j + 2] - this.oz) / cell),
        d = Math.floor((this.bb[j + 5] - this.oz) / cell);
      for (let cz = c; cz <= d; cz++)
        for (let cx = a; cx <= b; cx++) counts[cz * this.nx + cx]++;
    }
    this.start = new Uint32Array(this.nx * this.nz + 1);
    for (let i = 0, acc = 0; i < this.nx * this.nz; i++) {
      this.start[i] = acc;
      acc += counts[i];
      this.start[i + 1] = acc;
    }
    this.items = new Uint32Array(this.start[this.nx * this.nz]);
    // Reuse counts as write cursors instead of allocating a second grid-sized array.
    for (let i = 0; i < this.nx * this.nz; i++) counts[i] = this.start[i];
    for (let i = 0; i < n; i++) {
      if (this.flags[i] & DEAD) continue;
      const j = i * 6,
        a = Math.floor((this.bb[j] - this.ox) / cell),
        b = Math.floor((this.bb[j + 3] - this.ox) / cell),
        c = Math.floor((this.bb[j + 2] - this.oz) / cell),
        d = Math.floor((this.bb[j + 5] - this.oz) / cell);
      for (let cz = c; cz <= d; cz++)
        for (let cx = a; cx <= b; cx++)
          this.items[counts[cz * this.nx + cx]++] = i;
    }
    this.stamp = new Uint32Array(n);
    this.frame = 1;
    this._hn = [0, 0, 0];
  }

  // ---- per-primitive ray tests. Return t (>= 0) or Infinity; write the normal into this._hn.
  _rayBox(i, ox, oy, oz, dx, dy, dz, tMax) {
    const j = i * 6,
      b = this.bb;
    let tn = -Infinity,
      tf = Infinity,
      ax = -1;
    for (let a = 0; a < 3; a++) {
      const o = a === 0 ? ox : a === 1 ? oy : oz,
        d = a === 0 ? dx : a === 1 ? dy : dz;
      const lo = b[j + a],
        hi = b[j + 3 + a];
      if (d === 0) {
        if (o < lo || o > hi) return Infinity;
        continue;
      }
      let t0 = (lo - o) / d,
        t1 = (hi - o) / d;
      if (t0 > t1) {
        const s = t0;
        t0 = t1;
        t1 = s;
      }
      if (t0 > tn) {
        tn = t0;
        ax = a;
      }
      if (t1 < tf) tf = t1;
      if (tn > tf) return Infinity;
    }
    if (tn < 0 || tn > tMax) return Infinity; // origin inside -> ignored (ray starts within a solid)
    const d = ax === 0 ? dx : ax === 1 ? dy : dz;
    this._hn[0] = this._hn[1] = this._hn[2] = 0;
    this._hn[ax] = d > 0 ? -1 : 1;
    return tn;
  }
  _rayRamp(i, ox, oy, oz, dx, dy, dz, tMax) {
    const j = i * 6,
      b = this.bb,
      P = this.par;
    const axis = P[j],
      yA = P[j + 1],
      yB = P[j + 2];
    const lo = b[j + axis],
      hi = b[j + 3 + axis];
    // plane: y - s*c <= w  with c the axis coordinate
    const s = (yB - yA) / (hi - lo),
      w = yA - s * lo;
    const oc = axis === 0 ? ox : oz,
      dc = axis === 0 ? dx : dz;
    let tn = -Infinity,
      tf = Infinity,
      ax = -1;
    for (let a = 0; a < 3; a++) {
      const o = a === 0 ? ox : a === 1 ? oy : oz,
        d = a === 0 ? dx : a === 1 ? dy : dz;
      const l = b[j + a],
        h = b[j + 3 + a];
      if (d === 0) {
        if (o < l || o > h) return Infinity;
        continue;
      }
      let t0 = (l - o) / d,
        t1 = (h - o) / d;
      if (t0 > t1) {
        const q = t0;
        t0 = t1;
        t1 = q;
      }
      if (t0 > tn) {
        tn = t0;
        ax = a;
      }
      if (t1 < tf) tf = t1;
    }
    const f0 = oy - s * oc - w,
      fd = dy - s * dc;
    if (Math.abs(fd) < 1e-12) {
      if (f0 > 0) return Infinity;
    } else {
      const tp = -f0 / fd;
      if (fd < 0) {
        if (tp > tn) {
          tn = tp;
          ax = 3;
        }
      } else if (tp < tf) tf = tp;
    }
    const thk = P[j + 3];
    if (thk > 0) {
      // lower plane: y - s*c >= w - thk
      const g0 = f0 + thk;
      if (Math.abs(fd) < 1e-12) {
        if (g0 < 0) return Infinity;
      } else {
        const tp = -g0 / fd;
        if (fd > 0) {
          if (tp > tn) {
            tn = tp;
            ax = 4;
          }
        } else if (tp < tf) tf = tp;
      }
    }
    if (tn > tf || tn < 0 || tn > tMax) return Infinity;
    if (ax === 3 || ax === 4) {
      const l = Math.hypot(s, 1) * (ax === 4 ? -1 : 1);
      this._hn[0] = axis === 0 ? -s / l : 0;
      this._hn[1] = 1 / l;
      this._hn[2] = axis === 2 ? -s / l : 0;
    } else {
      const d = ax === 0 ? dx : ax === 1 ? dy : dz;
      this._hn[0] = this._hn[1] = this._hn[2] = 0;
      this._hn[ax] = d > 0 ? -1 : 1;
    }
    return tn;
  }
  _rayHF(i, ox, oy, oz, dx, dy, dz, tMax) {
    const j = i * 6,
      b = this.bb,
      f = this.fields[this.par[j]],
      base = this.par[j + 1];
    const x0 = b[j],
      z0 = b[j + 2],
      c = f.cell,
      H = f.h,
      LO = f.lo,
      nx = f.nx,
      nz = f.nz;
    let t0 = 0,
      t1 = tMax,
      entryAx = -1;
    for (let a = 0; a < 3; a++) {
      const o = a === 0 ? ox : a === 1 ? oy : oz,
        d = a === 0 ? dx : a === 1 ? dy : dz;
      const lo = b[j + a],
        hi = b[j + 3 + a];
      if (Math.abs(d) < 1e-12) {
        if (o < lo || o > hi) return Infinity;
        continue;
      }
      let ta = (lo - o) / d,
        tb = (hi - o) / d;
      if (ta > tb) {
        const q = ta;
        ta = tb;
        tb = q;
      }
      if (ta > t0) {
        t0 = ta;
        entryAx = a;
      }
      if (tb < t1) t1 = tb;
      if (t0 > t1) return Infinity;
    }
    const px = ox + dx * t0 - x0,
      pz = oz + dz * t0 - z0;
    let ix = Math.min(nx - 1, Math.max(0, Math.floor(px / c))),
      iz = Math.min(nz - 1, Math.max(0, Math.floor(pz / c)));
    const sx = dx > 0 ? 1 : -1,
      sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) < 1e-12 ? Infinity : c / Math.abs(dx),
      tdz = Math.abs(dz) < 1e-12 ? Infinity : c / Math.abs(dz);
    let tnx =
      Math.abs(dx) < 1e-12
        ? Infinity
        : (x0 + (ix + (sx > 0 ? 1 : 0)) * c - ox) / dx;
    let tnz =
      Math.abs(dz) < 1e-12
        ? Infinity
        : (z0 + (iz + (sz > 0 ? 1 : 0)) * c - oz) / dz;
    let tc = t0;
    const hn = this._hn;
    for (let guard = 0; guard < 8192; guard++) {
      const tEnd = Math.min(tnx, tnz, t1);
      const k = iz * nx + ix,
        h = H[k];
      if (h > -1e30) {
        const top = base + h,
          bot = base + (LO ? LO[k] : 0),
          yIn = oy + dy * tc;
        if (yIn <= top && yIn >= bot) {
          // entered through a side face (the origin inside a column is ignored)
          if (tc <= 1e-9) return Infinity;
          hn[0] = hn[1] = hn[2] = 0;
          if (entryAx === 0) hn[0] = -sx;
          else if (entryAx === 2) hn[2] = -sz;
          else hn[1] = dy > 0 ? -1 : 1;
          return tc;
        }
        if (dy < 0 && yIn > top) {
          const tt = (top - oy) / dy;
          if (tt <= tEnd) {
            hn[0] = hn[2] = 0;
            hn[1] = 1;
            return tt;
          }
        }
        if (dy > 0 && yIn < bot) {
          const tt = (bot - oy) / dy;
          if (tt <= tEnd) {
            hn[0] = hn[2] = 0;
            hn[1] = -1;
            return tt;
          }
        }
      }
      if (tEnd >= t1) return Infinity;
      if (tnx < tnz) {
        tc = tnx;
        ix += sx;
        tnx += tdx;
        entryAx = 0;
        if (ix < 0 || ix >= nx) return Infinity;
      } else {
        tc = tnz;
        iz += sz;
        tnz += tdz;
        entryAx = 2;
        if (iz < 0 || iz >= nz) return Infinity;
      }
    }
    return Infinity;
  }
  _rayCyl(i, ox, oy, oz, dx, dy, dz, tMax) {
    const j = i * 6,
      b = this.bb,
      P = this.par;
    const cx = P[j],
      cz = P[j + 1],
      r0 = P[j + 2],
      r1 = P[j + 3],
      y0 = b[j + 1],
      y1 = b[j + 4];
    const h = y1 - y0,
      k = (r1 - r0) / h;
    const X = ox - cx,
      Z = oz - cz;
    // inside test -> ignore
    if (oy >= y0 && oy <= y1) {
      const r = r0 + k * (oy - y0);
      if (X * X + Z * Z <= r * r) return Infinity;
    }
    let best = Infinity,
      nx = 0,
      ny = 0,
      nz = 0;
    // side
    const a0 = r0 + k * (oy - y0),
      bb = k * dy;
    const A = dx * dx + dz * dz - bb * bb,
      B = 2 * (X * dx + Z * dz - a0 * bb),
      C = X * X + Z * Z - a0 * a0;
    if (Math.abs(A) > 1e-12) {
      const disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
          if (t < 0 || t >= best || t > tMax) continue;
          const y = oy + dy * t;
          if (y < y0 || y > y1) continue;
          const R = a0 + bb * t;
          if (R < 0) continue;
          const px = X + dx * t,
            pz = Z + dz * t;
          // must be entering (normal against the ray)
          const gx = px,
            gy = -R * k,
            gz = pz;
          if (gx * dx + gy * dy + gz * dz >= 0) continue;
          best = t;
          const l = Math.hypot(gx, gy, gz) || 1;
          nx = gx / l;
          ny = gy / l;
          nz = gz / l;
        }
      }
    }
    // caps
    if (dy < 0 && r1 > 0) {
      const t = (y1 - oy) / dy;
      if (t >= 0 && t < best && t <= tMax) {
        const px = X + dx * t,
          pz = Z + dz * t;
        if (px * px + pz * pz <= r1 * r1) {
          best = t;
          nx = 0;
          ny = 1;
          nz = 0;
        }
      }
    }
    if (dy > 0 && r0 > 0) {
      const t = (y0 - oy) / dy;
      if (t >= 0 && t < best && t <= tMax) {
        const px = X + dx * t,
          pz = Z + dz * t;
        if (px * px + pz * pz <= r0 * r0) {
          best = t;
          nx = 0;
          ny = -1;
          nz = 0;
        }
      }
    }
    if (best === Infinity) return Infinity;
    this._hn[0] = nx;
    this._hn[1] = ny;
    this._hn[2] = nz;
    return best;
  }

  // returns {t, id, n:[x,y,z]} or null. d must be normalized.
  cast(ox, oy, oz, dx, dy, dz, tMax) {
    const c = this.cell;
    const fr = ++this.frame;
    let t0 = 0,
      t1 = tMax;
    const gx0 = this.ox,
      gz0 = this.oz,
      gx1 = this.ox + this.nx * c,
      gz1 = this.oz + this.nz * c;
    if (Math.abs(dx) < 1e-12) {
      if (ox < gx0 || ox > gx1) return null;
    } else {
      let a = (gx0 - ox) / dx,
        b = (gx1 - ox) / dx;
      if (a > b) {
        const s = a;
        a = b;
        b = s;
      }
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
    if (Math.abs(dz) < 1e-12) {
      if (oz < gz0 || oz > gz1) return null;
    } else {
      let a = (gz0 - oz) / dz,
        b = (gz1 - oz) / dz;
      if (a > b) {
        const s = a;
        a = b;
        b = s;
      }
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
    if (t0 > t1) return null;
    const px = ox + dx * t0,
      pz = oz + dz * t0;
    let cx = Math.min(this.nx - 1, Math.max(0, Math.floor((px - gx0) / c)));
    let cz = Math.min(this.nz - 1, Math.max(0, Math.floor((pz - gz0) / c)));
    const sx = dx > 0 ? 1 : -1,
      sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) < 1e-12 ? Infinity : c / Math.abs(dx);
    const tdz = Math.abs(dz) < 1e-12 ? Infinity : c / Math.abs(dz);
    let tnx =
      Math.abs(dx) < 1e-12
        ? Infinity
        : (gx0 + (cx + (sx > 0 ? 1 : 0)) * c - ox) / dx;
    let tnz =
      Math.abs(dz) < 1e-12
        ? Infinity
        : (gz0 + (cz + (sz > 0 ? 1 : 0)) * c - oz) / dz;
    let best = tMax,
      bi = -1;
    const n = [0, 0, 0];
    const st = this.stamp,
      T = this.type;
    for (;;) {
      const cell = cz * this.nx + cx;
      for (let k = this.start[cell], e = this.start[cell + 1]; k < e; k++) {
        const i = this.items[k];
        if (st[i] === fr) continue;
        st[i] = fr;
        if (this.flags[i] & BLOCKONLY) continue; // (veg r1)
        const ty = T[i];
        const t =
          ty === BOX
            ? this._rayBox(i, ox, oy, oz, dx, dy, dz, best)
            : ty === CYL
              ? this._rayCyl(i, ox, oy, oz, dx, dy, dz, best)
              : ty === HF
                ? this._rayHF(i, ox, oy, oz, dx, dy, dz, best)
                : this._rayRamp(i, ox, oy, oz, dx, dy, dz, best);
        if (t < best) {
          best = t;
          bi = i;
          n[0] = this._hn[0];
          n[1] = this._hn[1];
          n[2] = this._hn[2];
        }
      }
      const tExit = Math.min(tnx, tnz);
      if (bi >= 0 && best <= tExit) break;
      if (tExit > t1) break;
      if (tnx < tnz) {
        cx += sx;
        tnx += tdx;
        if (cx < 0 || cx >= this.nx) break;
      } else {
        cz += sz;
        tnz += tdz;
        if (cz < 0 || cz >= this.nz) break;
      }
    }
    return bi < 0 ? null : { t: best, id: bi, n };
  }

  // surface height of primitive i at (x,z) or -Infinity
  _top(i, x, z) {
    const j = i * 6,
      b = this.bb,
      P = this.par,
      ty = this.type[i];
    if (x < b[j] || x > b[j + 3] || z < b[j + 2] || z > b[j + 5])
      return -Infinity;
    if (ty === BOX) return b[j + 4];
    if (ty === HF) {
      const f = this.fields[P[j]],
        c = f.cell;
      const ix = Math.min(f.nx - 1, Math.floor((x - b[j]) / c)),
        iz = Math.min(f.nz - 1, Math.floor((z - b[j + 2]) / c));
      const h = f.h[iz * f.nx + ix];
      return h > -1e30 ? P[j + 1] + h : -Infinity;
    }
    if (ty === RAMP) {
      const axis = P[j],
        lo = b[j + axis],
        hi = b[j + 3 + axis];
      const c = axis === 0 ? x : z;
      return P[j + 1] + ((P[j + 2] - P[j + 1]) * (c - lo)) / (hi - lo);
    }
    const dx = x - P[j],
      dz = z - P[j + 1],
      d = Math.sqrt(dx * dx + dz * dz),
      r0 = P[j + 2],
      r1 = P[j + 3];
    if (d <= r1) return b[j + 4];
    if (d <= r0)
      return b[j + 1] + ((r0 - d) / (r0 - r1)) * (b[j + 4] - b[j + 1]);
    return -Infinity;
  }
  // public alias (stable API for traversal: world.collision.top(i, x, z))
  top(i, x, z) {
    return this._top(i, x, z);
  }
  // highest surface at (x,z) whose height <= yMax. skipOverhang: ignore floating solids (see header).
  // returns {y, id} (id -1 when nothing)
  topAt(
    x,
    z,
    yMax = Infinity,
    skipOverhang = false,
    out = { y: -Infinity, id: -1 },
  ) {
    out.y = -Infinity;
    out.id = -1;
    const c = this.cell;
    const cx = Math.floor((x - this.ox) / c),
      cz = Math.floor((z - this.oz) / c);
    if (cx < 0 || cz < 0 || cx >= this.nx || cz >= this.nz) return out;
    const cell = cz * this.nx + cx;
    for (let k = this.start[cell], e = this.start[cell + 1]; k < e; k++) {
      const i = this.items[k];
      if (skipOverhang && this.flags[i] & OVERHANG) continue;
      if (this.flags[i] & BLOCKONLY) continue; // (veg r1) trunks: never a floor
      const y = this._top(i, x, z);
      if (y > out.y && y <= yMax) {
        out.y = y;
        out.id = i;
      }
    }
    return out;
  }
  // normal of the top surface of primitive i at (x,z)
  topNormal(i, x, z, out) {
    const j = i * 6,
      P = this.par,
      b = this.bb,
      ty = this.type[i];
    out.set(0, 1, 0);
    if (ty === RAMP) {
      const axis = P[j],
        s = (P[j + 2] - P[j + 1]) / (b[j + 3 + axis] - b[j + axis]);
      if (axis === 0) out.set(-s, 1, 0);
      else out.set(0, 1, -s);
      out.normalize();
    } else if (ty === CYL) {
      const dx = x - P[j],
        dz = z - P[j + 1],
        d = Math.hypot(dx, dz),
        r0 = P[j + 2],
        r1 = P[j + 3];
      if (d > r1 && r0 > r1 && d > 1e-6) {
        const k = (b[j + 4] - b[j + 1]) / (r0 - r1);
        out.set((dx / d) * k, 1, (dz / d) * k).normalize();
      }
    }
    return out;
  }
  // all primitives overlapping an AABB (for debugging / zip-point validation)
  query(x0, z0, x1, z1, fn) {
    const c = this.cell,
      fr = ++this.frame;
    const a = Math.max(0, Math.floor((x0 - this.ox) / c)),
      b = Math.min(this.nx - 1, Math.floor((x1 - this.ox) / c));
    const e = Math.max(0, Math.floor((z0 - this.oz) / c)),
      f = Math.min(this.nz - 1, Math.floor((z1 - this.oz) / c));
    for (let cz = e; cz <= f; cz++)
      for (let cx = a; cx <= b; cx++) {
        const cell = cz * this.nx + cx;
        for (let k = this.start[cell], kk = this.start[cell + 1]; k < kk; k++) {
          const i = this.items[k];
          if (this.stamp[i] === fr) continue;
          this.stamp[i] = fr;
          const j = i * 6;
          if (
            this.bb[j + 3] < x0 ||
            this.bb[j] > x1 ||
            this.bb[j + 5] < z0 ||
            this.bb[j + 2] > z1
          )
            continue;
          fn(i);
        }
      }
  }
  // true if the point is inside any solid
  inside(x, y, z) {
    let hit = false;
    this.query(x, z, x, z, (i) => {
      if (hit) return;
      const j = i * 6;
      if (y < this.bb[j + 1] || y > this.bb[j + 4]) return;
      const top = this._top(i, x, z);
      if (top >= y) {
        if (
          this.type[i] === RAMP &&
          this.par[j + 3] > 0 &&
          y < top - this.par[j + 3]
        )
          return;
        if (this.type[i] === HF) {
          const f = this.fields[this.par[j]];
          if (f.lo) {
            const c = f.cell,
              k =
                Math.min(f.nz - 1, Math.floor((z - this.bb[j + 2]) / c)) *
                  f.nx +
                Math.min(f.nx - 1, Math.floor((x - this.bb[j]) / c));
            if (y < this.par[j + 1] + f.lo[k]) return;
          }
        }
        if (this.type[i] === CYL) {
          // below the cone/cyl surface but also inside the radius at this height
          const P = this.par,
            r =
              P[j + 2] +
              ((P[j + 3] - P[j + 2]) * (y - this.bb[j + 1])) /
                (this.bb[j + 4] - this.bb[j + 1]);
          if (Math.hypot(x - P[j], z - P[j + 1]) > r) return;
        }
        hit = true;
      }
    });
    return hit;
  }
}

// Ground terrain (analytic): road 0 / curbs / park / water; groundFn(x,z) -> y
export function makeRaycast(grid, groundFn) {
  return function raycast(origin, dir, maxDist = 1000) {
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const dx = dir.x / len,
      dy = dir.y / len,
      dz = dir.z / len;
    let best = maxDist,
      hit = null;
    const h = grid.cast(origin.x, origin.y, origin.z, dx, dy, dz, maxDist);
    if (h) {
      best = h.t;
      hit = {
        point: new THREE.Vector3(
          origin.x + dx * h.t,
          origin.y + dy * h.t,
          origin.z + dz * h.t,
        ),
        normal: new THREE.Vector3(h.n[0], h.n[1], h.n[2]),
        distance: h.t,
        box: h.id,
        kind: KIND[grid.kind[h.id]],
      };
    }
    // terrain: march the piecewise-flat ground (curbs are 15 cm steps) with a coarse step + bisection
    if (dy < -1e-6 || origin.y < groundFn(origin.x, origin.z) + 0.3) {
      const g = terrainHit(
        groundFn,
        origin.x,
        origin.y,
        origin.z,
        dx,
        dy,
        dz,
        best,
      );
      if (g) hit = g;
    }
    return hit;
  };
}

function terrainHit(groundFn, ox, oy, oz, dx, dy, dz, tMax) {
  // ray vs the height function: step along the ray until below ground, then refine; also report curb faces
  const horiz = Math.hypot(dx, dz);
  const minY = -2.0,
    maxY = 0.35; // terrain is confined to this band
  let tA = 0,
    tB = tMax;
  if (dy < 0) {
    tA = Math.max(0, (maxY - oy) / dy);
    tB = Math.min(tMax, (minY - oy) / dy);
  } else if (oy > maxY) return null;
  else tB = Math.min(tMax, 200, dy > 1e-6 ? (maxY - oy) / dy : Infinity); // (near-)horizontal ray skimming the ground: curbs only
  if (tA > tB) return null;
  const step =
    horiz > 1e-6
      ? Math.min(0.25 / horiz, Math.max(tB - tA, 0) + 1e-3)
      : tB - tA;
  let prevT = tA,
    prevAbove = oy + dy * tA > groundFn(ox + dx * tA, oz + dz * tA);
  if (!prevAbove) return null;
  for (let t = tA + step; ; t += step) {
    const tt = Math.min(t, tB);
    const x = ox + dx * tt,
      y = oy + dy * tt,
      z = oz + dz * tt;
    if (y <= groundFn(x, z)) {
      let lo = prevT,
        hi = tt;
      for (let k = 0; k < 22; k++) {
        const m = (lo + hi) / 2;
        if (oy + dy * m > groundFn(ox + dx * m, oz + dz * m)) lo = m;
        else hi = m;
      }
      const hx = ox + dx * hi,
        hz = oz + dz * hi;
      const gA = groundFn(ox + dx * lo, oz + dz * lo),
        gB = groundFn(hx, hz);
      const n = new THREE.Vector3(0, 1, 0);
      let py = gB;
      if (gB - gA > 0.03 && oy + dy * lo < gB) {
        // hit the riser of a step (curb face)
        n.set(-dx, 0, -dz).normalize();
        const ax = Math.abs(n.x) > Math.abs(n.z);
        n.set(ax ? Math.sign(n.x) : 0, 0, ax ? 0 : Math.sign(n.z));
        py = oy + dy * hi;
      }
      return {
        point: new THREE.Vector3(hx, py, hz),
        normal: n,
        distance: hi,
        ground: true,
        kind: "ground",
      };
    }
    prevT = tt;
    if (tt >= tB) break;
  }
  return null;
}

// World query API (contract C4). terrain(x,z) -> analytic ground height (roads/curbs/park/water).
//  groundHeight(x, z)     highest GROUNDED surface (terrain, roofs, parapets, equipment) - ignores overhangs, so
//                         standing under an awning/cornice never snaps to its top
//  groundHeight(x, z, y)  highest surface of ANY solid whose top is <= y + 0.5 (step-up tolerance), incl. overhangs
//  surfaceAt(x, z, y?, step=0.5) -> {y, normal, kind, id} same rule, with the surface normal (ramps, cone roofs)
//  raycast(origin, dir, max) -> {point, normal, distance, kind, box?, ground?} | null
export function makeQueries(grid, terrain) {
  const tmp = { y: -Infinity, id: -1 };
  const groundHeight = (x, z, y) => {
    const g = terrain(x, z);
    const t =
      y === undefined
        ? grid.topAt(x, z, Infinity, true, tmp)
        : grid.topAt(x, z, y + 0.5, false, tmp);
    return Math.max(g, t.y);
  };
  const surfaceAt = (x, z, y, step = 0.5) => {
    const g = terrain(x, z);
    const t =
      y === undefined
        ? grid.topAt(x, z, Infinity, true, tmp)
        : grid.topAt(x, z, y + step, false, tmp);
    if (t.id >= 0 && t.y >= g)
      return {
        y: t.y,
        normal: grid.topNormal(t.id, x, z, new THREE.Vector3()),
        kind: KIND[grid.kind[t.id]],
        id: t.id,
      };
    return { y: g, normal: new THREE.Vector3(0, 1, 0), kind: "ground", id: -1 };
  };
  return { groundHeight, surfaceAt, raycast: makeRaycast(grid, terrain) };
}

// Debug: wireframe of every collision solid within `radius` of `center` (boxes, frustums, ramps) as one LineSegments.
// Kinds are colour-coded: overhangs orange, ramps green, frustums cyan, everything else white.
export function collisionDebugLines(grid, center, radius = 60) {
  const P = [],
    C = [];
  const push = (a, b, c) => {
    P.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    C.push(...c, ...c);
  };
  grid.query(
    center.x - radius,
    center.z - radius,
    center.x + radius,
    center.z + radius,
    (i) => {
      const j = i * 6,
        b = grid.bb,
        par = grid.par,
        ty = grid.type[i];
      const col =
        ty === CYL
          ? [0.2, 0.9, 1]
          : ty === RAMP
            ? [0.3, 1, 0.3]
            : grid.flags[i] & OVERHANG
              ? [1, 0.6, 0.1]
              : [1, 1, 1];
      if (ty === CYL) {
        const seg = 16;
        for (let k = 0; k < seg; k++) {
          const a0 = (k / seg) * Math.PI * 2,
            a1 = ((k + 1) / seg) * Math.PI * 2;
          for (const [y, r] of [
            [b[j + 1], par[j + 2]],
            [b[j + 4], par[j + 3]],
          ])
            push(
              [par[j] + Math.cos(a0) * r, y, par[j + 1] + Math.sin(a0) * r],
              [par[j] + Math.cos(a1) * r, y, par[j + 1] + Math.sin(a1) * r],
              col,
            );
          if (k % 4 === 0)
            push(
              [
                par[j] + Math.cos(a0) * par[j + 2],
                b[j + 1],
                par[j + 1] + Math.sin(a0) * par[j + 2],
              ],
              [
                par[j] + Math.cos(a0) * par[j + 3],
                b[j + 4],
                par[j + 1] + Math.sin(a0) * par[j + 3],
              ],
              col,
            );
        }
        return;
      }
      const x0 = b[j],
        y0 = b[j + 1],
        z0 = b[j + 2],
        x1 = b[j + 3],
        y1 = b[j + 4],
        z1 = b[j + 5];
      const top = (x, z) => grid._top(i, x, z);
      const cs = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ];
      for (let k = 0; k < 4; k++) {
        const [ax, az] = cs[k],
          [bx, bz] = cs[(k + 1) % 4];
        push([ax, y0, az], [bx, y0, bz], col);
        push(
          [ax, ty === RAMP ? top(ax, az) : y1, az],
          [bx, ty === RAMP ? top(bx, bz) : y1, bz],
          col,
        );
        push([ax, y0, az], [ax, ty === RAMP ? top(ax, az) : y1, az], col);
      }
    },
  );
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  const m = new THREE.LineSegments(
    g,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      depthTest: false,
      transparent: true,
      opacity: 0.45,
    }),
  );
  m.name = "collisionDebug";
  m.frustumCulled = false;
  m.renderOrder = 10;
  return m;
}
