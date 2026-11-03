// @ts-nocheck
// OWNER: traversal engineer. Insomniac-style zip-point reticles (2D canvas overlay inside #hud).
// - Every visible candidate perch point: small dim white ring (only while the player is aiming: camera recently moved,
//   perched, or standing still) with a soft fade.
// - Highlighted (best) point: bright white ring with a centre dot, four rotating notch ticks and a subtle pulse; scales in
//   when the target changes. Kind-specific glyph hint (roof corner / lamp etc. share the same look — Insomniac uses one icon).
// createReticle(root) -> { update(dt, camera, {candidates, best, aiming, visible}) }
import * as THREE from "three";

const _p = new THREE.Vector3();

export function createReticle(root) {
  const c = document.createElement("canvas");
  c.className = "zip-reticle";
  c.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  root.prepend(c);
  const g = c.getContext("2d");
  let W = 0,
    Hh = 0,
    dpr = 1,
    t = 0,
    aimA = 0,
    bestA = 0,
    lastKey = "",
    pop = 0;
  const fade = new Map(); // key -> alpha
  const key = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(innerWidth * dpr),
      h = Math.round(innerHeight * dpr);
    if (w !== W || h !== Hh) {
      W = c.width = w;
      Hh = c.height = h;
    }
  }
  function ring(x, y, r, lw, a, fill = 0) {
    g.globalAlpha = a;
    g.lineWidth = lw;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    if (fill) {
      g.globalAlpha = a * fill;
      g.fill();
    }
  }
  return {
    update(
      dt,
      camera,
      { candidates = [], best = null, aiming = false, visible = true } = {},
    ) {
      t += dt;
      resize();
      g.clearRect(0, 0, W, Hh);
      if (!visible) {
        fade.clear();
        return;
      }
      aimA +=
        ((aiming ? 1 : 0) - aimA) * (1 - Math.exp(-(aiming ? 10 : 3) * dt));
      const bk = best ? key(best.pos) : "";
      if (bk !== lastKey) {
        pop = 0;
        lastKey = bk;
      }
      pop = Math.min(1, pop + dt / 0.18);
      bestA += ((best ? 1 : 0) - bestA) * (1 - Math.exp(-12 * dt));
      g.strokeStyle = "#fff";
      g.fillStyle = "#fff";
      g.shadowColor = "rgba(0,0,0,0.55)";
      g.shadowBlur = 4 * dpr;
      const s = dpr * Math.max(0.8, Math.min(1.3, (innerHeight / 1080) * 1.15));
      const seen = new Set();
      for (const e of candidates) {
        if (e.best) continue;
        const k = key(e.p.pos);
        seen.add(k);
        const a0 = fade.get(k) ?? 0;
        const a = a0 + (1 - a0) * (1 - Math.exp(-8 * dt));
        fade.set(k, a);
        _p.copy(e.p.pos).project(camera);
        if (_p.z > 1) continue;
        const x = (_p.x * 0.5 + 0.5) * W,
          y = (-_p.y * 0.5 + 0.5) * Hh;
        const r = (5.5 - Math.min(2, e.dist / 25)) * s;
        ring(x, y, r, 1.6 * s, 0.55 * aimA * a);
        ring(x, y, 1.3 * s, 1.3 * s, 0.5 * aimA * a, 1);
      }
      for (const k of fade.keys()) if (!seen.has(k)) fade.delete(k);
      if (best && bestA > 0.02) {
        _p.copy(best.pos).project(camera);
        if (_p.z <= 1) {
          const x = (_p.x * 0.5 + 0.5) * W,
            y = (-_p.y * 0.5 + 0.5) * Hh;
          const e = 1 - Math.pow(1 - pop, 3);
          const pulse = 1 + 0.06 * Math.sin(t * 6);
          const r =
            (13 - Math.min(4, best.dist / 15)) * s * (1.6 - 0.6 * e) * pulse;
          const a = bestA * (0.55 + 0.45 * e);
          ring(x, y, r, 2.2 * s, 0.95 * a);
          ring(x, y, 3 * s, 2 * s, 0.95 * a, 1);
          // four notch ticks rotating slowly
          g.globalAlpha = 0.95 * a;
          g.lineWidth = 2.4 * s;
          g.lineCap = "round";
          const rot = t * 1.4;
          for (let i = 0; i < 4; i++) {
            const an = rot + (i * Math.PI) / 2,
              ca = Math.cos(an),
              sa = Math.sin(an);
            g.beginPath();
            g.moveTo(x + ca * (r + 3 * s), y + sa * (r + 3 * s));
            g.lineTo(x + ca * (r + 8 * s), y + sa * (r + 8 * s));
            g.stroke();
          }
          // soft outer halo
          ring(x, y, r * 1.9, 1 * s, 0.25 * a * (0.5 + 0.5 * Math.sin(t * 3)));
        }
      }
      g.globalAlpha = 1;
      g.shadowBlur = 0;
    },
  };
}
