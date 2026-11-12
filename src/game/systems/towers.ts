/**
 * Research tower system.
 *
 * @module src-game-systems-towers
 * @version 1.0.0
 * @file src/game/systems/towers.ts
 * @since 0.0.1
 * @description Manages tower activation, district reveal state, and tower-related interactions and markers.
 */

import * as THREE from "three";
import { emit } from "@/game/events";
import { TOWER_H } from "./markers";

export function createTowers(sys: any) {
    const { data, save, markers, ui, audio, prog } = sys;
    for (const t of data.towers) {
        markers.addTower(t);
        if (save.state.towers.includes(t.id))
            markers.setTowerActive(t.id, true);
    }

    const isActive = (id: string) => save.state.towers.includes(id);
    const revealed = (districtId: string) =>
        save.state.towers.includes("tower_" + districtId);

    function activate(t: any, { silent = false } = {}) {
        if (isActive(t.id)) return false;
        const st = save.state;
        st.towers.push(t.id);
        const d = data.districts.find((x: any) => x.id === t.district);
        const station = data.stations.find(
            (s: any) => s.district === t.district,
        );
        if (station && !st.stations.includes(station.id))
            st.stations.push(station.id);
        save.markDirty();
        markers.setTowerActive(t.id, true);
        if (!silent) {
            markers.pulse(t.pos);
            markers.flareTower?.(t.id);

            const tryReveal = (n = 0) => {
                if (sys.flow.isPlaying && !sys.travel?.traveling) {
                    sys.pause.show("map");
                    sys.pause.pages
                        .find((p: any) => p.id === "map")
                        ?.reveal?.(t.district);
                } else if (n < 60) setTimeout(() => tryReveal(n + 1), 500);
            };
            if (sys.flow.isPlaying) activationCam(t, () => tryReveal());
            else setTimeout(tryReveal, 2600);
            ui.banner(
                "DISTRICT UNLOCKED",
                d.name,
                "Collectibles and crimes revealed on the map",
            );
            setTimeout(
                () =>
                    ui.toast({
                        title: "Fast Travel Unlocked",
                        text: station?.name || "",
                        icon: "station",
                        tone: "cyan",
                    }),
                1400,
            );
            prog.addXp(400, "tower");
        }
        emit("tower:activated", { id: t.id, district: t.district });
        emit("district:unlocked", { id: d.id, name: d.name });
        sys.travel?.refreshObjective?.();
        return true;
    }

    function activationCam(t: any, done: () => void) {
        const { ctx, flow } = sys;
        const cam = ctx.camera;
        const top = t.pos.clone().setY(t.pos.y + TOWER_H * 0.62);
        const from = cam.position.clone(),
            q0 = cam.quaternion.clone();
        const base = Math.atan2(from.x - t.pos.x, from.z - t.pos.z);
        let to: THREE.Vector3 | null = null;
        for (let k = 0; k < 12 && !to; k++) {
            const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5,
                dir = new THREE.Vector3(
                    Math.sin(a),
                    0.42,
                    Math.cos(a),
                ).normalize();
            const h = ctx.world.raycast(top, dir, 40);
            if (!h || h.distance > 36)
                to = top.clone().addScaledVector(dir, 34);
        }
        to = to || top.clone().add(new THREE.Vector3(0, 30, 0.1));
        const look = t.pos.clone().setY(t.pos.y + TOWER_H * 0.45),
            m = new THREE.Matrix4(),
            q1 = new THREE.Quaternion();
        m.lookAt(to, look, new THREE.Vector3(0, 1, 0));
        q1.setFromRotationMatrix(m);
        let T = 0;
        const D = 2.9;
        flow.setMode("cine");
        flow.setCameraHook((dt: number) => {
            T += dt;
            const k = Math.min(1, T / 1.3),
                e = k * k * (3 - 2 * k);
            cam.position.lerpVectors(from, to!, e);
            cam.quaternion.slerpQuaternions(q0, q1, e);
            cam.updateMatrixWorld();
            if (T >= D) {
                flow.setCameraHook(null);
                flow.setMode("play");
                done();
            }
        });
        ctx.pipeline.setMotionBlur?.(0);
    }

    return {
        isActive,
        revealed,
        activate,
        get count() {
            return save.state.towers.length;
        },
        nearestInactive(p: THREE.Vector3) {
            let best: any = null,
                bd = Infinity;
            for (const t of data.towers) {
                if (isActive(t.id)) continue;
                const d = Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
                if (d < bd) {
                    bd = d;
                    best = t;
                }
            }
            return best;
        },
        interact(p: THREE.Vector3) {
            for (const t of data.towers) {
                if (isActive(t.id)) continue;
                const dh = Math.hypot(t.pos.x - p.x, t.pos.z - p.z),
                    dy = p.y - t.pos.y;
                if (dh < 9.5 && dy > -2 && dy < 8) {
                    return {
                        id: t.id,
                        pos:
                            t.panel ||
                            (t.panel = t.pos.clone().setY(t.pos.y + 2.2)),
                        label: "Activate Research Tower",
                        sub: data.districts.find(
                            (d: any) => d.id === t.district,
                        ).name,
                        hold: 1.6,
                        priority: 5,
                        tick: (k: number) => audio.sfx.towerCharge(k),
                        action: () => activate(t),
                    };
                }
            }
            return null;
        },
        pins(p: THREE.Vector3, out: any[]) {
            for (const t of data.towers) {
                if (isActive(t.id)) continue;
                const d = Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
                if (d < 700 && d > 12)
                    out.push({
                        kind: "tower",
                        pos:
                            t.top ||
                            (t.top = t.pos.clone().setY(t.pos.y + TOWER_H + 5)),
                        dist: d,
                        scale: d < 250 ? 1 : 0.85,
                    });
            }
        },
    };
}
