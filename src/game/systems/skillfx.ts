// @ts-nocheck
// OWNER: systems engineer. Applies skill-tree traversal multipliers (ctx.params, see progression.js) to the live
// traversal state as external impulses / time-scales, using only traversal's public surface:
//   player.traversal.events (one-frame: jump, wallJump, pointLaunch, webDash, zipLaunch)   player.state (s: vel, pos, zip, mode, sub)
// Runs right after player.update each frame (systems tick after the player), so changes feed the next integration step.
// Release inertia (USER_FEEDBACK 4b) is untouched: swingReleaseBoost is read by traversal itself.
// If traversal starts consuming a param natively it can list it in `traversal.consumesParams` and this layer skips it.
import * as THREE from "three";

export function createSkillFx(ctx) {
  const P = () => ctx.params || {};
  const native = (k) => {
    const c = ctx.player?.traversal?.consumesParams;
    return !!(c && (c.has ? c.has(k) : c.includes?.(k)));
  };
  const _d = new THREE.Vector3();
  const stats = { jumps: 0, launches: 0, dashes: 0, zips: 0 };
  return {
    stats,
    update(dt) {
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
      // swing momentum: extra pump along the direction of travel, strongest at the bottom of the arc
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
      // wall sprint: run faster along the wall plane (velocity is tangent to the wall)
      if (
        mode === "wall" &&
        (sub === "wallRun" || sub === "wallRunSide") &&
        p.wallRunSpeed > 1 &&
        !native("wallRunSpeed")
      )
        s.pos.addScaledVector(s.vel, (p.wallRunSpeed - 1) * dt);
      // dive bomb: stronger tuck (more gravity, higher terminal speed)
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
