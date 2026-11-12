/**
 * Generates zip target points from world geometry and selects/filters the best zip targets.
 *
 * @module player-traversal-zippoints
 * @version 1.0.0
 * @file src/player/traversal/zippoints.ts
 * @since 0.0.1
 * @description Builds cached zip point candidates from building boxes and provides targeting logic to score and pick visible zip targets.
 */

import * as THREE from "three";

const _v = new THREE.Vector3(),
    _v2 = new THREE.Vector3(),
    _ndc = new THREE.Vector3(),
    _cf = new THREE.Vector3();

export function createZipPoints(world: any, index: any) {
    const cache = new Map<number, any[]>();
    const near: number[] = [];
    function boxPoints(i: number) {
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
        const ins = 0.3;
        const add = (
            x: number,
            z: number,
            nx: number,
            nz: number,
            kind: string,
        ) => {
            if (world.groundHeight(x, z) > top + 0.35) return;

            const ox = x + nx * 1.6,
                oz = z + nz * 1.6;
            if (world.groundHeight(ox, oz) > top - 1.8) return;
            const n = new THREE.Vector3(nx, 0, nz).normalize();
            pts!.push({
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
        const edge = (len: number, cb: (t: number) => void) => {
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
    function fromBoxes(center: THREE.Vector3, radius: number, out: any[]) {
        if (!index.ok) return out;
        for (const i of index.near(center.x, center.z, radius, near)) {
            for (const p of boxPoints(i))
                if (p.pos.distanceToSquared(center) < radius * radius)
                    out.push(p);
        }
        return out;
    }
    return {
        query(center: THREE.Vector3, radius: number) {
            let list: any;
            try {
                list = world.getZipPoints?.(center, radius);
            } catch {
                list = null;
            }
            if (list && list.length) return list;
            return fromBoxes(center, radius, []);
        },
    };
}

export function createZipTargeting(world: any, zipPoints: any) {
    const RANGE = 58;
    let pool: any[] = [],
        poolT = 99,
        best: any = null,
        bestKey = "";
    const vis = new Map<string, { t: number; ok: boolean }>();
    const shown: any[] = [];
    const key = (p: any) =>
        `${p.pos.x.toFixed(1)},${p.pos.y.toFixed(1)},${p.pos.z.toFixed(1)}`;
    let time = 0;

    const meta = new Map<string, { h: number; ok: boolean }>();
    function pointMeta(p: any) {
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
            const B = ((globalThis as any).__badZipPoints ||= []);
            if (B.length < 200)
                B.push({
                    pos: p.pos.toArray().map((v: number) => +v.toFixed(2)),
                    kind: p.kind,
                });
        }
        meta.set(k, m);
        if (meta.size > 4000) meta.clear();
        return m;
    }
    const KIND_BONUS: Record<string, number> = {
        roofEdge: -0.45,
        roofCorner: -0.5,
        waterTower: -0.35,
        ledge: 0.15,
        lampTop: 0.1,
        signalMast: 0.1,
        antenna: 0.05,
        pole: 0.2,
    };
    function visible(p: any, eye: THREE.Vector3) {
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

        update(
            dt: number,
            camera: THREE.Camera,
            eye: THREE.Vector3,
            {
                enabled = true,
                exclude = null as THREE.Vector3 | null,
                _preferKinds = null,
                air = false,
                perchOut = null as THREE.Vector3 | null,
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
            (camera as any).getWorldDirection(_cf);
            const scored: any[] = [];
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
                const dir = _v
                    .copy(p.pos)
                    .sub((camera as any).position)
                    .normalize();
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

                if (air) score += Math.max(0, eye.y - p.pos.y - 3) * 0.07;
                if (p.pos.y < eye.y - 12) score += 0.5;
                if (p.pos.y > eye.y + 30) score += 0.35;
                scored.push({ p, dist, ang, score, sx: _ndc.x, sy: _ndc.y });
            }
            scored.sort((a, b) => a.score - b.score);
            let nb: any = null,
                prevEntry: any = null;
            for (let i = 0; i < scored.length && shown.length < 12; i++) {
                const e = scored[i];
                if (i < 16 && !visible(e.p, eye)) continue;
                if (i >= 16) break;
                if (!nb && e.ang < 0.55) nb = e;
                if (e.ang < 0.42 && shown.length < 3) shown.push(e);
                if (key(e.p) === bestKey) prevEntry = e;
            }

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
