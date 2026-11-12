/**
 * Skill visual and gameplay effects.
 *
 * @module src-game-systems-skillfx
 * @version 1.0.0
 * @file src/game/systems/skillfx.ts
 * @since 0.0.1
 * @description Applies runtime effects and feedback for unlocked player skills.
 */

import * as THREE from "three";

export function createSkillFx(ctx: any) {
    const P = () => ctx.params || {};
    const native = (k: string) => {
        const c = ctx.player?.traversal?.consumesParams;
        return !!(c && (c.has ? c.has(k) : c.includes?.(k)));
    };
    const _d = new THREE.Vector3();
    const stats = { jumps: 0, launches: 0, dashes: 0, zips: 0 };
    return {
        stats,
        update(dt: number) {
            const pl = ctx.player,
                s = pl?.state,
                tr = pl?.traversal;
            if (!s || !tr || dt <= 0) return;
            const p = P();
            for (const e of tr.events || []) {
                if (
                    (e.type === "jump" || e.type === "wallJump") &&
                    p.jump !== 1 &&
                    !native("jump") &&
                    s.vel.y > 0
                ) {
                    s.vel.y *= p.jump;
                    stats.jumps++;
                } else if (
                    e.type === "pointLaunch" &&
                    p.pointLaunch !== 1 &&
                    !native("pointLaunch")
                ) {
                    s.vel.multiplyScalar(p.pointLaunch);
                    stats.launches++;
                } else if (
                    e.type === "webDash" &&
                    p.zipSpeed !== 1 &&
                    !native("zipSpeed")
                ) {
                    s.vel.x *= p.zipSpeed;
                    s.vel.z *= p.zipSpeed;
                    stats.dashes++;
                } else if (
                    e.type === "zipLaunch" &&
                    p.zipSpeed !== 1 &&
                    !native("zipSpeed") &&
                    s.zip?.dur
                ) {
                    s.zip.dur /= p.zipSpeed;
                    stats.zips++;
                }
            }
            const mode = s.mode,
                sub = s.sub;

            if (mode === "swing" && p.swingSpeed > 1 && !native("swingSpeed")) {
                const sp = s.vel.length();
                if (sp > 4) {
                    const ph = pl.anim?.swing?.phase ?? 0;
                    const k = 1 - Math.min(1, Math.abs(ph));
                    s.vel.addScaledVector(
                        _d.copy(s.vel).divideScalar(sp),
                        (p.swingSpeed - 1) * 16 * k * dt,
                    );
                }
            }

            if (
                mode === "wall" &&
                (sub === "wallRun" || sub === "wallRunSide") &&
                p.wallRunSpeed > 1 &&
                !native("wallRunSpeed")
            )
                s.pos.addScaledVector(s.vel, (p.wallRunSpeed - 1) * dt);

            if (
                mode === "air" &&
                sub === "dive" &&
                p.diveSpeed > 1 &&
                !native("diveSpeed")
            )
                s.vel.y = Math.max(
                    s.vel.y - (p.diveSpeed - 1) * 37 * dt,
                    -72 * p.diveSpeed,
                );
        },
    };
}
