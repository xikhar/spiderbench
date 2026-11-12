/**
 * Collectibles system.
 *
 * @module src-game-systems-collectibles
 * @version 1.0.0
 * @file src/game/systems/collectibles.ts
 * @since 0.0.1
 * @description Tracks, spawns, updates, and handles pickup interactions for backpacks and other collectible items.
 */

import * as THREE from "three";
import { emit } from "@/game/events";

const _v = new THREE.Vector3(),
    _d = new THREE.Vector3(),
    _f = new THREE.Vector3();

export function createCollectibles(sys: any) {
    const { ctx, data, save, markers, ui, audio, prog } = sys;
    const st = () => save.state;
    markers.setBackpacks(data.backpacks, new Set(st().backpacks));

    function revealed(districtId: string) {
        return sys.towers.revealed(districtId);
    }

    function pickupBackpack(b: any) {
        if (st().backpacks.includes(b.id)) return;
        st().backpacks.push(b.id);
        save.markDirty();
        markers.hideBackpack(b.id);
        const info = {
            kind: "backpack",
            id: b.id,
            item: b.item,
            desc: b.desc,
            pos: b.pos.clone(),
        };
        try {
            ctx.player.playGesture?.("pickup");
            ctx.player.onPickup?.(info);
        } catch (e) {
            console.warn(e);
        }
        emit("collectible:pickup", info);
        audio.sfx.thwip(0.6);
        audio.sfx.pickup();
        ui.toast({
            title: "Backpack Found",
            text: b.item,
            icon: "backpack",
            count: `${st().backpacks.length}/${data.backpacks.length}`,
            sound: null,
            tone: "gold",
        });
        prog.addXp(150, "backpack");
        if (st().backpacks.length === data.backpacks.length)
            ui.banner(
                "ALL BACKPACKS FOUND",
                "Memory Lane",
                "Every one of Peter's old backpacks recovered",
                "levelUp",
            );
    }

    const _ray = new THREE.Vector3();
    function photographable(
        lm: any,
        camera: THREE.Camera,
        rangeMul = st().skills.includes("photog") ? 1.4 : 1,
    ) {
        const cam = camera.position;
        const d = cam.distanceTo(lm.target);
        const range = (lm.fp ? 480 : 300) * rangeMul;
        if (d > range || d < 8) return false;
        _v.copy(lm.target).applyMatrix4(camera.matrixWorldInverse);
        if (_v.z > -1) return false;
        _v.applyMatrix4(camera.projectionMatrix);
        if (Math.abs(_v.x) > 0.8 || Math.abs(_v.y) > 0.85) return false;
        if (lm.fp) {
            const ang = Math.max(lm.fp.x1 - lm.fp.x0, lm.fp.z1 - lm.fp.z0) / d;
            if (ang < 0.06) return false;
            _ray.copy(lm.target).sub(cam).normalize();
            const hit = ctx.world.raycast(cam, _ray, d + 5);
            if (!hit) return true;
            const p = hit.point,
                m = 3;
            return (
                (p.x > lm.fp.x0 - m &&
                    p.x < lm.fp.x1 + m &&
                    p.z > lm.fp.z0 - m &&
                    p.z < lm.fp.z1 + m) ||
                hit.distance > d - lm.radius
            );
        }
        _ray.copy(lm.target).sub(cam).normalize();
        const hit = ctx.world.raycast(cam, _ray, d + 5);
        return !hit || hit.point.distanceTo(lm.target) < 60;
    }
    function photoLandmark(lm: any, thumb?: string) {
        if (st().landmarks.includes(lm.id)) return false;
        st().landmarks.push(lm.id);
        if (thumb) st().photoThumbs[lm.id] = thumb;
        save.markDirty();
        emit("collectible:photo", {
            kind: "landmark",
            id: lm.id,
            name: lm.name,
        });
        ui.toast({
            title: "Landmark Photographed",
            text: lm.name,
            icon: "landmark",
            count: `${st().landmarks.length}/${data.landmarks.length}`,
            tone: "cyan",
        });
        prog.addXp(200 * (ctx.params?.photoXp ?? 1), "landmark");
        return true;
    }
    function inSecretSpot(sp: any, pos: THREE.Vector3, camera: THREE.Camera) {
        const dh = Math.hypot(pos.x - sp.pos.x, pos.z - sp.pos.z);
        if (dh > 16 || Math.abs(pos.y - sp.pos.y) > 7) return false;
        camera.getWorldDirection(_f);
        _f.y = 0;
        _f.normalize();
        _d.copy(sp.dir);
        _d.y = 0;
        _d.normalize();
        return _f.dot(_d) > Math.cos(THREE.MathUtils.degToRad(32));
    }
    function photoSecret(sp: any, thumb?: string) {
        if (st().secretPhotos.includes(sp.id)) return false;
        st().secretPhotos.push(sp.id);
        if (thumb) st().photoThumbs[sp.id] = thumb;
        save.markDirty();
        emit("collectible:photo", {
            kind: "secretPhoto",
            id: sp.id,
            name: sp.name,
        });
        ui.toast({
            title: "Secret Photo Matched",
            text: data.districts.find((d: any) => d.id === sp.district).name,
            icon: "photo",
            count: `${st().secretPhotos.length}/${data.secretPhotos.length}`,
            tone: "gold",
        });
        prog.addXp(300 * (ctx.params?.photoXp ?? 1), "secretPhoto");
        return true;
    }

    function checkPhoto(camera: THREE.Camera, pos: THREE.Vector3) {
        const got: any[] = [];
        for (const lm of data.landmarks)
            if (!st().landmarks.includes(lm.id) && photographable(lm, camera))
                got.push(lm);
        for (const sp of data.secretPhotos)
            if (
                !st().secretPhotos.includes(sp.id) &&
                inSecretSpot(sp, pos, camera)
            )
                got.push(sp);
        return got;
    }
    function collectPhoto(items: any[], thumb?: string) {
        for (const it of items) {
            if (it.id.startsWith("lm_")) photoLandmark(it, thumb);
            else photoSecret(it, thumb);
        }
    }

    const hints = new Map<string, string | null>();
    function renderHint(sp: any) {
        if (hints.has(sp.id)) return hints.get(sp.id);
        const { camera, pipeline, lighting, world, renderer } = ctx;
        const save_ = {
            p: camera.position.clone(),
            q: camera.quaternion.clone(),
            fov: camera.fov,
        };
        try {
            camera.position.copy(sp.pos);
            camera.lookAt(_v.copy(sp.pos).add(sp.dir));
            camera.fov = sp.fov;
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld();
            world.update(0, camera);
            lighting.update?.(camera);
            pipeline.resetHistory?.();
            pipeline.setAperture?.(0);
            pipeline.render(0);
            const src = renderer.domElement,
                W = 360,
                H = 225;
            const c = document.createElement("canvas");
            c.width = W;
            c.height = H;
            const g = c.getContext("2d")!;
            const sa = src.width / src.height,
                ta = W / H;
            let sw = src.width,
                sh = src.height,
                sx = 0,
                sy = 0;
            if (sa > ta) {
                sw = sh * ta;
                sx = (src.width - sw) / 2;
            } else {
                sh = sw / ta;
                sy = (src.height - sh) / 2;
            }
            g.filter =
                "sepia(0.85) contrast(1.15) brightness(0.78) blur(0.4px)";
            g.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
            g.filter = "none";

            const vg = g.createRadialGradient(
                W / 2,
                H / 2,
                H * 0.3,
                W / 2,
                H / 2,
                W * 0.7,
            );
            vg.addColorStop(0, "rgba(60,40,20,0)");
            vg.addColorStop(1, "rgba(40,25,10,.6)");
            g.fillStyle = vg;
            g.fillRect(0, 0, W, H);
            const id = g.getImageData(0, 0, W, H),
                px = id.data;
            let s = sp.id.length * 9973;
            const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
            for (let i = 0; i < px.length; i += 4) {
                const n = (rnd() - 0.5) * 26;
                px[i] += n;
                px[i + 1] += n;
                px[i + 2] += n;
            }
            g.putImageData(id, 0, 0);
            g.strokeStyle = "rgba(255,245,225,.25)";
            g.lineWidth = 0.7;
            for (let i = 0; i < 5; i++) {
                const x = rnd() * W;
                g.beginPath();
                g.moveTo(x, 0);
                g.lineTo(x + (rnd() - 0.5) * 30, H);
                g.stroke();
            }
            const url = c.toDataURL("image/jpeg", 0.85);
            hints.set(sp.id, url);
            return url;
        } catch (e) {
            console.warn("[collectibles] hint render failed", e);
            hints.set(sp.id, null);
            return null;
        } finally {
            camera.position.copy(save_.p);
            camera.quaternion.copy(save_.q);
            camera.fov = save_.fov;
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld();
            world.update(0, camera);
            lighting.update?.(camera);
            pipeline.resetHistory?.();
        }
    }

    function storeThumb(id: string, t?: string) {
        if (t) {
            st().photoThumbs[id] = t;
            save.markDirty();
        }
    }

    return {
        photographable,
        checkPhoto,
        collectPhoto,
        renderHint,
        pickupBackpack,
        photoLandmark,
        photoSecret,
        inSecretSpot,
        hintCached: (id: string) => hints.get(id),
        update(dt: number, p: THREE.Vector3) {
            for (const b of data.backpacks) {
                if (Math.abs(b.pos.x - p.x) > 2 || Math.abs(b.pos.z - p.z) > 2)
                    continue;
                if (!st().backpacks.includes(b.id) && b.pos.distanceTo(p) < 1.4)
                    pickupBackpack(b);
            }
        },
        interact(p: THREE.Vector3, camera: THREE.Camera) {
            let best: any = null,
                bd = Infinity;
            for (const b of data.backpacks) {
                if (st().backpacks.includes(b.id)) continue;
                const dh = Math.hypot(b.pos.x - p.x, b.pos.z - p.z),
                    dy = b.pos.y - p.y;
                if (
                    dh < 4.5 &&
                    dy < 8 &&
                    dy > -3 &&
                    dh + Math.abs(dy) * 0.3 < bd
                ) {
                    bd = dh + Math.abs(dy) * 0.3;
                    best = b;
                }
            }
            if (best) {
                const b = best;
                return {
                    id: b.id,
                    pos: b.pos,
                    label: "Grab Backpack",
                    sub: "Web-pull",
                    hold: 0,
                    priority: 6,
                    action: () => pickupBackpack(b),
                };
            }
            for (const sp of data.secretPhotos) {
                if (
                    !st().secretPhotos.includes(sp.id) &&
                    inSecretSpot(sp, p, camera)
                ) {
                    return {
                        id: sp.id,
                        label: "Match Secret Photo",
                        sub: "This looks like the spot",
                        hold: 0,
                        priority: 4,
                        action: () => {
                            photoSecret(sp);
                            sys.photo.snap((t: string) => storeThumb(sp.id, t));
                        },
                    };
                }
            }
            for (const lm of data.landmarks) {
                if (st().landmarks.includes(lm.id)) continue;
                if (photographable(lm, camera))
                    return {
                        id: lm.id,
                        label: "Photograph Landmark",
                        sub: lm.name,
                        hold: 0,
                        priority: 3,
                        action: () => {
                            photoLandmark(lm);
                            sys.photo.snap((t: string) => storeThumb(lm.id, t));
                        },
                    };
            }
            return null;
        },
        pins(p: THREE.Vector3, out: any[]) {
            const det = ctx.params?.backpackDetector || 0;
            for (const b of data.backpacks) {
                if (st().backpacks.includes(b.id)) continue;
                const d = b.pos.distanceTo(p);
                if ((revealed(b.district) && d < 110) || d < det * 0.5)
                    out.push({
                        kind: "backpack",
                        pos: b.pos,
                        dist: d,
                        scale: 0.8,
                    });
            }
            for (const lm of data.landmarks) {
                if (st().landmarks.includes(lm.id) || !revealed(lm.district))
                    continue;
                const d = lm.target.distanceTo(p);
                if (d < 520)
                    out.push({
                        kind: "landmark",
                        pos: lm.target,
                        dist: d,
                        scale: 0.8,
                        alpha: 0.9,
                    });
            }
        },
    };
}
