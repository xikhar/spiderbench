// OWNER: traversal engineer. Zip / perch points (C2) + aim targeting for the reticle.
//   C2: world.getZipPoints(center, radius) -> [{pos, normal, kind}] (city provides). If absent or empty, perch points are
//   derived here from the city's box list (roof edges / corners / rooftop boxes such as water towers), validated with
//   world.groundHeight so they sit on real, uncovered rooftops with a real drop outward.
import * as THREE from "three";

const _v = new THREE.Vector3(),
    _v2 = new THREE.Vector3(),
    _ndc = new THREE.Vector3(),
    _cf = new THREE.Vector3();

export function createZipPoints(world, index) {
    const cache = new Map(); // box index -> points
    const near = [];
    function boxPoints(i) {
        let pts = cache.get(i);
        if (pts) return pts;
        pts = [];
        cache.set(i, pts);
        const b = index.boxes[i],
            top = b.max[1];
        if (top < 3) return pts;
        const w = b.max[0] - b.min[0],
            d = b.max[2] - b.min[2];
        const onRoof = b.min[1] > 3,
            small = w < 8 && d < 8;
        const kindEdge =
            onRoof && small
                ? top - b.min[1] > 2.5
                    ? "waterTower"
                    : "ledge"
                : "roofEdge";
        const kindCorner = onRoof && small ? kindEdge : "roofCorner";
        const ins = 0.3; // inset from the edge (feet stand on the parapet / edge)
        const add = (x, z, nx, nz, kind) => {
            // uncovered: nothing higher at this spot
            if (world.groundHeight(x, z) > top + 0.35) return;
            // real drop outward (not flush against a taller / same-height neighbour)
            const ox = x + nx * 1.6,
                oz = z + nz * 1.6;
            if (world.groundHeight(ox, oz) > top - 1.8) return;
            const n = new THREE.Vector3(nx, 0, nz).normalize();
            pts.push({
                pos: new THREE.Vector3(x, top, z),
                normal: n,
                kind,
                box: i,
            });
        };
        const s2 = Math.SQRT1_2;
        add(b.min[0] + ins, b.min[2] + ins, -s2, -s2, kindCorner);
        add(b.max[0] - ins, b.min[2] + ins, s2, -s2, kindCorner);
        add(b.min[0] + ins, b.max[2] - ins, -s2, s2, kindCorner);
        add(b.max[0] - ins, b.max[2] - ins, s2, s2, kindCorner);
        const edge = (len, cb) => {
            if (len < 5) return;
            const n = Math.max(1, Math.round(len / 9));
            for (let k = 0; k < n; k++) cb((k + 0.5) / n);
        };
        edge(w, (t) => {
            const x = b.min[0] + w * t;
            add(x, b.min[2] + ins, 0, -1, kindEdge);
            add(x, b.max[2] - ins, 0, 1, kindEdge);
        });
        edge(d, (t) => {
            const z = b.min[2] + d * t;
            add(b.min[0] + ins, z, -1, 0, kindEdge);
            add(b.max[0] - ins, z, 1, 0, kindEdge);
        });
        return pts;
    }
    function fromBoxes(center, radius, out) {
        if (!index.ok) return out;
        for (const i of index.near(center.x, center.z, radius, near)) {
            for (const p of boxPoints(i))
                if (p.pos.distanceToSquared(center) < radius * radius)
                    out.push(p);
        }
        return out;
    }
    return {
        // C2 consumer: prefers the city's list, falls back to derived points.
        query(center, radius) {
            let list = null;
            try {
                list = world.getZipPoints?.(center, radius);
            } catch (e) {
                list = null;
            }
            if (list && list.length) return list;
            return fromBoxes(center, radius, []);
        },
    };
}

// Aim targeting: picks the highlighted candidate (screen-centre + distance weighted, occlusion-checked, with hysteresis).
export function createZipTargeting(world, zipPoints) {
    const RANGE = 58;
    let pool = [],
        poolT = 99,
        best = null,
        bestKey = "";
    const vis = new Map(); // key -> {t, ok}
    const shown = [];
    const key = (p) =>
        `${p.pos.x.toFixed(1)},${p.pos.y.toFixed(1)},${p.pos.z.toFixed(1)}`;
    let time = 0;
    // Vantage / validity per point (cached): height over the ground below it, and a real surface under the point.
    // Points with nothing under them (floating over bare street) are dropped and logged to window.__badZipPoints for
    // the city owner. Low street furniture (subway globes, bollards < 4 m) are not zip targets.
    const meta = new Map();
    function pointMeta(p) {
        const k = key(p);
        let m = meta.get(k);
        if (m) return m;
        const below = world.groundHeight(
            p.pos.x + p.normal.x * 0.02,
            p.pos.z + p.normal.z * 0.02,
            p.pos.y - 0.6,
        );
        const h =
            p.pos.y -
            Math.min(
                below,
                world.groundHeight(
                    p.pos.x + p.normal.x * 1.2,
                    p.pos.z + p.normal.z * 1.2,
                    p.pos.y - 0.6,
                ),
            );
        const hit = world.raycast(
            _v.set(p.pos.x, p.pos.y + 0.6, p.pos.z),
            _v2.set(0, -1, 0),
            1.6,
        );
        const gh = world.groundHeight(p.pos.x, p.pos.z, p.pos.y + 0.3);
        const solid = !!hit || Math.abs(gh - p.pos.y) < 0.3;
        const minH =
            p.kind === "ledge"
                ? 8
                : p.kind === "roofEdge" ||
                    p.kind === "roofCorner" ||
                    p.kind === "waterTower"
                  ? 6
                  : 4.5;
        m = { h, ok: solid && h >= minH };
        if (!solid) {
            const B = (globalThis.__badZipPoints ||= []);
            if (B.length < 200)
                B.push({
                    pos: p.pos.toArray().map((v) => +v.toFixed(2)),
                    kind: p.kind,
                });
        }
        meta.set(k, m);
        if (meta.size > 4000) meta.clear();
        return m;
    }
    const KIND_BONUS = {
        roofEdge: -0.45,
        roofCorner: -0.5,
        waterTower: -0.35,
        ledge: 0.15,
        lampTop: 0.1,
        signalMast: 0.1,
        antenna: 0.05,
        pole: 0.2,
    };
    function visible(p, eye) {
        const k = key(p),
            c = vis.get(k);
        if (c && time - c.t < 0.25) return c.ok;
        const tgt = _v.copy(p.pos).addScaledVector(p.normal, 0.35);
        tgt.y += 0.35;
        const dir = _v2.copy(tgt).sub(eye);
        const len = dir.length();
        dir.divideScalar(len);
        const h = world.raycast(eye, dir, len);
        const ok = !h || h.distance > len - 0.7;
        vis.set(k, { t: time, ok });
        if (vis.size > 600) vis.clear();
        return ok;
    }
    return {
        get best() {
            return best;
        },
        candidates: shown,
        // eye: player chest position; exclude: point we're perched on (Vector3|null); enabled: false hides everything
        update(
            dt,
            camera,
            eye,
            {
                enabled = true,
                exclude = null,
                preferKinds = null,
                air = false,
                perchOut = null,
            } = {},
        ) {
            time += dt;
            poolT += dt;
            shown.length = 0;
            if (!enabled) {
                best = null;
                bestKey = "";
                return null;
            }
            if (poolT > 0.15) {
                poolT = 0;
                pool = zipPoints.query(eye, RANGE);
            }
            camera.getWorldDirection(_cf);
            const scored = [];
            for (const p of pool) {
                const dist = p.pos.distanceTo(eye);
                if (dist < 3 || dist > RANGE) continue;
                if (exclude && p.pos.distanceToSquared(exclude) < 4) continue;
                _ndc.copy(p.pos).project(camera);
                if (
                    _ndc.z > 1 ||
                    Math.abs(_ndc.x) > 0.92 ||
                    Math.abs(_ndc.y) > 0.9
                )
                    continue;
                const dir = _v.copy(p.pos).sub(camera.position).normalize();
                const ang = Math.acos(
                    THREE.MathUtils.clamp(dir.dot(_cf), -1, 1),
                );
                const m = pointMeta(p);
                if (!m.ok) continue;
                let score =
                    ang / 0.3 +
                    (dist / RANGE) * 0.9 +
                    (KIND_BONUS[p.kind] ?? 0) -
                    (Math.min(m.h, 40) / 40) * 0.35;
                // in the air: points well below you are rarely wanted (zipping DOWN to a lamp) — prefer your height or above
                if (air) score += Math.max(0, eye.y - p.pos.y - 3) * 0.07;
                if (p.pos.y < eye.y - 12) score += 0.5; // far below: rarely the intended target
                if (p.pos.y > eye.y + 30) score += 0.35; // very high: prefer reachable perches
                scored.push({ p, dist, ang, score, sx: _ndc.x, sy: _ndc.y });
            }
            scored.sort((a, b) => a.score - b.score);
            let nb = null,
                prevEntry = null;
            for (let i = 0; i < scored.length && shown.length < 12; i++) {
                const e = scored[i];
                if (i < 16 && !visible(e.p, eye)) continue;
                if (i >= 16) break;
                if (!nb && e.ang < 0.55) nb = e;
                if (e.ang < 0.42 && shown.length < 3) shown.push(e); // HUD: only the best few near the screen centre
                if (key(e.p) === bestKey) prevEntry = e;
            }
            // perched with nothing in view (camera against a wall): fall back to the best point out in front of the perch
            if (!nb && perchOut) {
                let bs = Infinity;
                for (const p of pool) {
                    const d = _v.copy(p.pos).sub(eye);
                    const dist = d.length();
                    if (dist < 3 || dist > RANGE) continue;
                    if (exclude && p.pos.distanceToSquared(exclude) < 4)
                        continue;
                    d.divideScalar(dist);
                    const out = d.x * perchOut.x + d.z * perchOut.z;
                    if (out < 0.2) continue;
                    const m = pointMeta(p);
                    if (!m.ok || !visible(p, eye)) continue;
                    const sc =
                        dist / RANGE -
                        out +
                        (KIND_BONUS[p.kind] ?? 0) -
                        (p.pos.y > eye.y - 2 ? 0.3 : 0);
                    if (sc < bs) {
                        bs = sc;
                        nb = { p, dist, ang: 0, score: sc, sx: 0, sy: 0 };
                    }
                }
                if (nb) shown.push(nb);
            }
            // hysteresis: keep the current target unless the new one is clearly better
            if (
                prevEntry &&
                prevEntry.ang < 0.6 &&
                (!nb || prevEntry.score < nb.score + 0.25)
            )
                nb = prevEntry;
            if (nb && !shown.includes(nb)) {
                shown.unshift(nb);
                if (shown.length > 3) shown.length = 3;
            }
            best = nb
                ? {
                      pos: nb.p.pos,
                      normal: nb.p.normal,
                      kind: nb.p.kind,
                      dist: nb.dist,
                      sx: nb.sx,
                      sy: nb.sy,
                  }
                : null;
            bestKey = nb ? key(nb.p) : "";
            for (const e of shown) e.best = e === nb;
            return best;
        },
    };
}
