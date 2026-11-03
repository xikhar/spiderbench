// @ts-nocheck
// OWNER: traversal engineer. Insomniac-style web-swing anchor search.
// Anchors are REAL building surfaces: candidate points are generated analytically on the vertical faces (and cornices) of the
// city's boxes around a "desired" anchor location ahead/above the player, scored, then confirmed with world.raycast so the
// web visibly hits that surface. Passes: (1) normal cone (ahead, 30-75 deg up, both sides), (2) wide / far / tall search,
// (3) low swings off lamp tops, signal masts, trees, water towers (from C2 zip points). Falls back to a ray cone when the
// world exposes no box list.
import * as THREE from "three";

const _rel = new THREE.Vector3(),
  _d = new THREE.Vector3(),
  _A = new THREE.Vector3();
const near = [];

export function createAnchorFinder(world, index, zipPoints) {
  const cands = [];
  function faceCandidates(pos, D, fwd, right, opt) {
    cands.length = 0;
    const R = opt.radius;
    for (const i of index.near(pos.x, pos.z, R, near)) {
      const b = index.boxes[i],
        top = b.max[1];
      if (top < pos.y + opt.minAbove) continue;
      if (b.max[0] - b.min[0] < 2.5 && b.max[2] - b.min[2] < 2.5) continue;
      const yLo = Math.max(b.min[1] + 0.8, pos.y + opt.minAbove),
        yHi = top - 0.45;
      if (yHi < yLo) continue;
      const ay = Math.min(Math.max(D.y, yLo), yHi);
      // 4 vertical faces: [axis, plane value, normal sign]
      for (let f = 0; f < 4; f++) {
        const ax = f < 2 ? 0 : 2,
          sgn = f % 2 === 0 ? -1 : 1,
          plane = sgn < 0 ? b.min[ax] : b.max[ax];
        const pc = ax === 0 ? pos.x : pos.z;
        if ((pc - plane) * sgn < 4) continue; // player must be well in front of the face (never a hang-and-scrape swing along the wall he is on)
        const tax = ax === 0 ? 2 : 0;
        const t0 = b.min[tax] + 0.35,
          t1 = b.max[tax] - 0.35;
        if (t1 < t0) continue;
        const dt = tax === 0 ? D.x : D.z;
        const tv = Math.min(Math.max(dt, t0), t1);
        if (ax === 0) _A.set(plane, ay, tv);
        else _A.set(tv, ay, plane);
        _rel.copy(_A).sub(pos);
        const L = _rel.length();
        if (L < opt.minL || L > opt.maxL) continue;
        const ahead = _rel.x * fwd.x + _rel.z * fwd.z;
        if (ahead < opt.minAhead) continue;
        const lat = _rel.x * right.x + _rel.z * right.z,
          hl = Math.hypot(_rel.x, _rel.z);
        const elev = Math.atan2(_rel.y, hl);
        let score = _A.distanceTo(D) / 10 + Math.max(0, _A.y - D.y) * 0.08;
        score += Math.max(0, Math.abs(lat) - opt.maxLat) * 0.25;
        score +=
          Math.max(0, opt.elevLo - elev) * 4 +
          Math.max(0, elev - opt.elevHi) * 3;
        score -= Math.min(ahead, 40) * 0.02;
        if (opt.turn) {
          // corner swing: faces lining the new street (normal perpendicular to the turn), never walls blocking it
          const nd = ax === 0 ? sgn * opt.turn.x : sgn * opt.turn.z;
          if (nd < -0.5) score += 4;
          else if (Math.abs(nd) < 0.5) score -= 0.5;
        }
        cands.push({
          point: _A.clone(),
          normal: new THREE.Vector3(ax === 0 ? sgn : 0, 0, ax === 2 ? sgn : 0),
          L,
          score,
          lat,
          kind: "wall",
        });
      }
    }
    cands.sort((a, b) => a.score - b.score);
    return cands;
  }
  function confirm(pos, c, strict) {
    _d.copy(c.point).sub(pos);
    const len = _d.length();
    _d.divideScalar(len);
    const h = world.raycast(pos, _d, len + 1.5);
    if (!h) return null;
    if (h.point.distanceTo(c.point) > 1.2) {
      if (strict) return null;
      // the ray hit something else first: accept it if it's a solid wall that is itself a good anchor
      if (
        Math.abs(h.normal.y) > 0.5 ||
        h.distance < len * 0.6 ||
        h.point.y < pos.y + 4
      )
        return null;
      return {
        point: h.point.clone(),
        normal: h.normal.clone(),
        L: h.distance,
        lat: c.lat,
        kind: "wall",
      };
    }
    return {
      point: h.point.clone(),
      normal: h.normal.clone(),
      L: h.distance,
      lat: c.lat,
      kind: c.kind,
    };
  }
  // cheap arc check: body path from pos down to the arc bottom must be clear
  function arcClear(pos, pivotY, pivot, rope) {
    const bottom = _rel.set(pivot.x, pivotY - rope, pivot.z);
    _d.copy(bottom).sub(pos);
    const len = _d.length();
    if (len < 1) return true;
    const h = world.raycast(pos, _d.divideScalar(len), len);
    return !h || h.normal.y > 0.7;
  }

  // Tree anchors (park / avenues): the city exposes no tree query, so read the near-LOD canopy instances that are
  // currently rendered (InstancedMesh 'trees-<kind>-near', ~260 m around the camera). Anchor = upper canopy (the web
  // grabs the crown's main branches). Cached, refreshed every 0.8 s or 40 m of travel.
  const trees = {
    meshes: null,
    pts: [],
    t: -1e9,
    at: new THREE.Vector3(1e9, 0, 0),
  };
  const _m4 = new THREE.Matrix4(),
    _tp = new THREE.Vector3(),
    _ts = new THREE.Vector3(),
    _tq = new THREE.Quaternion();
  function treePoints(pos) {
    const now = performance.now();
    if (now - trees.t < 800 && trees.at.distanceToSquared(pos) < 1600)
      return trees.pts;
    trees.t = now;
    trees.at.copy(pos);
    trees.pts.length = 0;
    if (!trees.meshes) {
      const scene = globalThis.__ctx?.scene;
      if (!scene) return trees.pts;
      trees.meshes = [];
      scene.traverse((o) => {
        if (o.isInstancedMesh && /^trees-.*-near$/.test(o.name))
          trees.meshes.push(o);
      });
    }
    for (const m of trees.meshes) {
      const g = m.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const top = g.boundingBox.max.y,
        arr = m.instanceMatrix.array;
      for (let k = 0; k < m.count; k++) {
        const x = arr[k * 16 + 12],
          z = arr[k * 16 + 14];
        if ((x - pos.x) ** 2 + (z - pos.z) ** 2 > 60 * 60) continue;
        _m4.fromArray(arr, k * 16);
        _m4.decompose(_tp, _tq, _ts);
        const y = _tp.y + top * _ts.y * 0.82;
        if (y - _tp.y < 6) continue; // small ornamentals can't hold a swing
        trees.pts.push({
          pos: new THREE.Vector3(x, y, z),
          normal: new THREE.Vector3(0, 1, 0),
          kind: "tree",
          cy: _tp.y + top * _ts.y * 0.72,
          r: top * _ts.y * 0.34,
        });
      }
    }
    return trees.pts;
  }

  function coneRays(pos, fwd) {
    // fallback without box list
    let best = null,
      bestScore = Infinity;
    const dir = new THREE.Vector3();
    for (const e of [0.95, 1.15, 0.75, 1.3])
      for (const y of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05]) {
        const cy = Math.cos(y),
          sy = Math.sin(y);
        const fx = fwd.x * cy + fwd.z * sy,
          fz = -fwd.x * sy + fwd.z * cy;
        dir.set(fx * Math.cos(e), Math.sin(e), fz * Math.cos(e)).normalize();
        const h = world.raycast(pos, dir, 90);
        if (!h || h.point.y < pos.y + 5 || h.distance < 9 || h.normal.y > 0.7)
          continue;
        const score =
          Math.abs(e - 0.95) * 2 +
          Math.abs(y) * 1.2 +
          Math.abs(h.distance - 30) / 20;
        if (score < bestScore) {
          bestScore = score;
          best = {
            point: h.point.clone(),
            normal: h.normal.clone(),
            L: h.distance,
            lat: 0,
            kind: "wall",
          };
        }
      }
    return best;
  }

  return {
    // tree canopies near p (for camera foliage avoidance): [{pos, cy, r}]
    canopies(p) {
      return treePoints(p);
    },
    // pos: body centre; fwd: horizontal travel dir (unit); turn: horizontal steer dir or null; speed: m/s
    find(pos, fwd, turn, speed, floorY) {
      const want = turn
        ? fwd
            .clone()
            .multiplyScalar(0.55)
            .addScaledVector(turn, 0.9)
            .normalize()
        : fwd;
      const right = new THREE.Vector3(-want.z, 0, want.x); // right-hand side of travel (matches camera right)
      if (!index.ok) return coneRays(pos, want);
      const hAbove = pos.y - floorY;
      // Altitude band (Insomniac keeps chains in the street canyon): the desired anchor sits ~30-42 m over the STREET.
      // Above the band the anchor may be only slightly above the body, so the next arc dips back down into the canyon
      // instead of stair-stepping up the skyline.
      // (bridges r1) over an East River bridge the 'street' is the deck (40 m up), not the water below it
      const deckY = world.bridgeDeckY?.(pos.x, pos.z);
      const streetY =
        deckY != null && deckY > 3
          ? Math.min(floorY, deckY)
          : Math.min(floorY, world.groundHeight(pos.x, pos.z, 0.6));
      const band = streetY + THREE.MathUtils.clamp(30 + speed * 0.25, 30, 40);
      const high = pos.y > band - 4;
      const passes = [
        {
          ahead:
            THREE.MathUtils.clamp(12 + speed * 0.75, 18, 40) *
            THREE.MathUtils.clamp(hAbove / 20, 0.55, 1),
          up:
            THREE.MathUtils.clamp(15 + speed * 0.25, 15, 26) *
            THREE.MathUtils.clamp(1.25 - (hAbove - 18) / 40, 0.4, 1),
          radius: 70,
          minAbove: 5,
          minL: 9,
          maxL: 72,
          minAhead: 2,
          maxLat: 22,
          elevLo: 0.5,
          elevHi: 1.3,
        },
        {
          ahead: THREE.MathUtils.clamp(16 + speed * 0.7, 22, 46),
          up: 26,
          radius: 95,
          minAbove: 4,
          minL: 8,
          maxL: 95,
          minAhead: 4,
          maxLat: 40,
          elevLo: 0.3,
          elevHi: 1.4,
        },
      ];
      if (high)
        for (const P of passes) {
          P.minAbove = 1.5;
          P.elevLo = 0.12;
        }
      for (const P of passes) {
        const D = new THREE.Vector3(
          pos.x + want.x * P.ahead,
          Math.max(pos.y + P.minAbove + 1, Math.min(pos.y + P.up, band)),
          pos.z + want.z * P.ahead,
        );
        P.turn = turn;
        const list = faceCandidates(pos, D, want, right, P);
        let tries = 0;
        for (const c of list) {
          if (++tries > 7) break;
          const a = confirm(pos, c, !!turn);
          if (!a) continue;
          const pivotY = a.point.y,
            rope = Math.max(5, Math.min(a.L, pivotY - floorY - 3.2));
          if (!arcClear(pos, pivotY, a.point, rope) && tries < 6) continue;
          return a;
        }
      }
      // low swings off street furniture / trees / water towers (parks, waterfront, wide avenues)
      const pts = zipPoints.query(pos, 40);
      let best = null,
        bs = Infinity;
      for (const p of [...pts, ...treePoints(pos)]) {
        _rel.copy(p.pos).sub(pos);
        // must be above the body and high enough over the ground for a short arc that clears the grass
        const up = _rel.y;
        if (
          up < (p.kind === "tree" ? 4 : 1.0) ||
          p.pos.y - floorY < (p.kind === "tree" ? 9 : 6)
        )
          continue;
        if (p.kind === "tree" && up < Math.hypot(_rel.x, _rel.z) * 0.45)
          continue; // no near-horizontal webs to canopies
        const ahead = _rel.x * want.x + _rel.z * want.z;
        if (ahead < 1) continue;
        const L = _rel.length();
        if (L < 5 || L > 40) continue;
        const s =
          Math.abs(ahead - 12) / 8 +
          Math.abs(_rel.x * right.x + _rel.z * right.z) / 10 -
          Math.min(up, 20) / 20;
        if (s < bs) {
          _d.copy(_rel).divideScalar(L);
          const h = world.raycast(pos, _d, L - (p.kind === "tree" ? 3 : 0.5));
          if (h) continue;
          bs = s;
          best = p;
        }
      }
      if (best)
        return {
          point: best.pos.clone().add(new THREE.Vector3(0, 0.1, 0)),
          normal: best.normal?.clone() || new THREE.Vector3(0, 1, 0),
          L: best.pos.distanceTo(pos),
          lat: 0,
          kind: "low",
        };
      if (hAbove > 3) return coneRays(pos, want);
      return null;
    },
  };
}
