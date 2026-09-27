// OWNER: gameplay agent. Insomniac-style HUD: minimap (bottom-right, tilted, navy/blue), compass strip,
// objective markers, off-screen objective indicator (left diamond), controls help overlay.
// createHud({player, world, camera}) -> {update(dt), setVisible(b), setObjective(vec3|null), showHelp(b)}
import * as THREE from 'three';
import { createReticle } from './reticle.js';

const COL = { street: '#0a1648', block: '#95b4f5', blockHi: '#b4cbff', water: '#1b4f86', shore: '#5da6e6', park: '#2f63b0', sidewalk: '#16266a', bg: '#0c1c55' };
let PX_PER_M = 0.58;        // offscreen map resolution (lowered if the minimap canvas fails to allocate; see buildOffscreen)
const VIEW_M = 260;        // meters visible across the minimap width

function css() {
  if (document.getElementById('hud-css')) return;
  // local fonts only (no network). Not twice: index.html links them for the loading screen, and Safari treats re-added
  // @font-face rules as new fonts, hiding all text in them (font-display: block) until they have "loaded" again
  if (!document.getElementById('sys-fonts')) {
    const l = document.createElement('link'); l.id = 'sys-fonts'; l.rel = 'stylesheet';
    l.href = (import.meta.env?.BASE_URL || '/') + 'assets/ui/fonts/fonts.css'; document.head.appendChild(l);
  }
  const s = document.createElement('style'); s.id = 'hud-css';
  s.textContent = `
  #hud{position:fixed;inset:0;pointer-events:none;font-family:Rajdhani,'Barlow Condensed','Arial Narrow',sans-serif;color:#fff;z-index:10;transition:opacity .4s}
  #hud.hidden{opacity:0}
  .mm-wrap{position:absolute;right:2.4vw;bottom:1.9vh;width:15.6vw;min-width:190px;perspective:700px}
  .mm{position:relative;transform:rotateY(-12deg) rotateX(6deg) skewY(-1.5deg);transform-origin:100% 100%}
  .mm-compass{position:relative;height:2.1vw;min-height:26px;overflow:hidden;
    background:linear-gradient(180deg,rgba(18,30,60,.55),rgba(18,30,60,.25));border-top:1px solid rgba(190,210,255,.55);
    clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}
  .mm-compass canvas{position:absolute;inset:0;width:100%;height:100%}
  .mm-map{position:relative;margin-top:.25vw;aspect-ratio:1.78/1;border-radius:.35vw;overflow:hidden;
    box-shadow:0 0 0 1px rgba(160,190,255,.35),0 4px 18px rgba(0,0,30,.35);background:${COL.bg}}
  .mm-map canvas{position:absolute;inset:0;width:100%;height:100%}
  .mm-corner{position:absolute;width:10px;height:10px;border:1.5px solid rgba(220,230,255,.8)}
  .mm-side{position:absolute;right:-6px;top:38%;width:3px;height:22%;background:#f39a2b;border-radius:2px;box-shadow:0 0 6px #f39a2b}
  .obj-ind{position:absolute;width:64px;height:64px;transform:translate(-50%,-50%);transition:opacity .3s}
  .obj-ind svg{width:100%;height:100%;overflow:visible}
  .help{position:absolute;left:2vw;bottom:3vh;font-size:15px;line-height:1.5;letter-spacing:.04em;
    background:linear-gradient(90deg,rgba(8,14,34,.62),rgba(8,14,34,0));padding:10px 26px 10px 14px;border-left:2px solid #e23b3b;transition:opacity 1.2s}
  .help b{display:inline-block;min-width:96px;color:#ffd35a;font-weight:700}
  .help .t{font-weight:700;font-size:13px;color:#9fb6ea;letter-spacing:.18em;margin-bottom:4px}
  .dbg{position:absolute;left:10px;top:8px;font:12px monospace;color:#cfe;opacity:.55;text-shadow:0 1px 2px #000}
  `;
  document.head.appendChild(s);
}

// ------------------------------------------------------------------ map features normalisation
function toPolys(list) {
  const out = [];
  for (const f of list || []) {
    if (!f) continue;
    let pts = null;
    const P = p => Array.isArray(p) ? [p[0], p[p.length === 3 ? 2 : 1]] : [p.x, p.z ?? p.y];
    if (Array.isArray(f)) pts = f.map(P);
    else if (f.poly || f.points || f.polygon || f.outline) pts = (f.poly || f.points || f.polygon || f.outline).map(P);
    else if (f.x0 != null && f.x1 != null && f.z0 != null && f.z1 != null) pts = [[f.x0, f.z0], [f.x1, f.z0], [f.x1, f.z1], [f.x0, f.z1]];
    else if (f.min && f.max) { const a = P(f.min), b = P(f.max); pts = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]]; }
    else if (f.isBox3) pts = [[f.min.x, f.min.z], [f.max.x, f.min.z], [f.max.x, f.max.z], [f.min.x, f.max.z]];
    else {
      const x = f.x ?? f.cx ?? f.center?.x ?? f.position?.x, z = f.z ?? f.cz ?? f.center?.z ?? f.position?.z;
      const w = f.w ?? f.width ?? f.sx ?? f.size?.x, d = f.d ?? f.depth ?? f.sz ?? f.size?.z ?? f.size?.y;
      if (x == null || w == null || d == null) continue;
      const r = f.rot ?? f.rotation ?? f.angle ?? 0, c = Math.cos(r), s = Math.sin(r);
      pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * c + v * s, z - u * s + v * c]);
    }
    if (pts && pts.length >= 3) out.push({ pts, h: f.h ?? f.height ?? 0 });
  }
  return out;
}

export function createHud({ player, world, camera }) {
  css();
  const root = document.getElementById('hud') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'hud' }));
  root.innerHTML = `
    <div class="mm-wrap"><div class="mm">
      <div class="mm-compass"><canvas></canvas></div>
      <div class="mm-map"><canvas></canvas></div>
      <div class="mm-corner" style="left:-4px;top:-3px;border-right:none;border-bottom:none"></div>
      <div class="mm-corner" style="right:-4px;bottom:-4px;border-left:none;border-top:none"></div>
      <div class="mm-side"></div>
    </div></div>
    <div class="obj-ind"><svg viewBox="-32 -32 64 64">
      <g class="chev" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M-17,-9 L-27,0 M-27,4 L-15,11"/></g>
      <g transform="translate(6,0)">
        <path d="M0,-17 L13,-4 M0,17 L13,4 M0,-17 L-13,-4 M0,17 L-13,4" stroke="#f5b82e" stroke-width="3.4" fill="none"/>
        <path d="M0,-11 L11,0 L0,11 L-11,0Z" fill="rgba(20,20,26,.75)"/>
        <path d="M0,-6.5 L6.5,0 L0,6.5 L-6.5,0Z" fill="none" stroke="#f5b82e" stroke-width="2"/>
        <circle r="2.4" fill="#f5d34a"/>
        <path d="M-19,0 h4 M15,0 h4" stroke="#f5b82e" stroke-width="2"/>
      </g></svg></div>
    <div class="help"><div class="t">CONTROLS</div>
      <div><b>WASD</b>Move (camera relative)</div><div><b>Mouse</b>Camera (click to capture)</div>
      <div><b>R-Mouse</b>Hold: web-swing · let go to release · press again to chain · on ground / wall: hop off into a swing · during a zip: cancel into a swing</div><div><b>Shift</b>On ground: parkour run · on walls: wall-run</div>
      <div><b>Space</b>Jump (hold = charged high jump) · in a swing: release + launch · double-tap in air: flip · at zip arrival: launch off the point · wall jump · point-launch from perch</div>
      <div><b>E / M-Mouse</b>Web-zip to <span style="color:#fff">&#9711;</span> point &amp; perch · air web-dash</div>
      <div><b>T</b>While perched: web tightrope to the <span style="color:#fff">&#9711;</span> point · W / S walk the line · A / D sway · Space jump off</div><div><b>E on wall</b>Wall zip upward</div><div><b>Q</b>Quick web boost (in air)</div><div><b>W</b>Hold while falling: head-first dive</div><div><b>Ctrl+Mouse</b>On ground, Ctrl + Left / Right Mouse: web slingshot</div>
      <div><b>C / Ctrl</b>Dive (hold in air) · drop off wall / perch</div><div><b>H</b>Toggle this help</div></div>
    <div class="dbg"></div>`;
  const compassC = root.querySelector('.mm-compass canvas'), mapC = root.querySelector('.mm-map canvas');
  const help = root.querySelector('.help'), ind = root.querySelector('.obj-ind'), chev = root.querySelector('.chev'), dbg = root.querySelector('.dbg');
  const debug = new URLSearchParams(location.search).has('debug');
  const shotMode = new URLSearchParams(location.search).has('shot');
  const reticle = shotMode ? null : createReticle(root);
  let helpT = 0, helpOn = !new URLSearchParams(location.search).get('shot');
  // help: shown for the first 30 s of play, then collapsed; H toggles it (a manual show stays until H again)
  let helpManual = false;
  addEventListener('keydown', e => { if (e.code === 'KeyH') { helpOn = !helpOn; helpT = 0; helpManual = helpOn; } });

  // ---------------- offscreen map
  let off = null, offCtx = null, ox = 0, oz = 0, OW = 0, OH = 0, sampling = null;
  function buildOffscreen(feat) {
    const buildings = toPolys(feat.buildings || feat.footprints || feat.blocks);
    const blocks = feat.buildings ? toPolys(feat.blocks) : [];
    const water = toPolys(feat.water), parks = toPolys(feat.parks || feat.park), roads = toPolys(feat.roads || feat.streets);
    const all = [...buildings, ...blocks, ...water, ...parks, ...roads];
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const p of all) for (const [x, z] of p.pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    if (feat.bounds) { const b = feat.bounds; minX = b.x0 ?? b.minX ?? b.min?.x ?? minX; maxX = b.x1 ?? b.maxX ?? b.max?.x ?? maxX; minZ = b.z0 ?? b.minZ ?? b.min?.z ?? minZ; maxZ = b.z1 ?? b.maxZ ?? b.max?.z ?? maxZ; }
    minX = Math.max(minX, -4000); maxX = Math.min(maxX, 4000); minZ = Math.max(minZ, -4000); maxZ = Math.min(maxZ, 4000);
    if (!isFinite(minX)) return false;
    const pad = 60; minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
    OW = Math.min(4096, Math.ceil((maxX - minX) * PX_PER_M)); OH = Math.min(4096, Math.ceil((maxZ - minZ) * PX_PER_M));
    ox = minX; oz = minZ;
    off = document.createElement('canvas'); off.width = OW; off.height = OH; offCtx = off.getContext('2d');
    const g = offCtx; g.fillStyle = COL.street; g.fillRect(0, 0, OW, OH);
    const fill = (polys, col, stroke) => { for (const p of polys) { g.beginPath(); p.pts.forEach(([x, z], i) => { const X = (x - ox) * PX_PER_M, Y = (z - oz) * PX_PER_M; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fillStyle = col; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); } } };
    fill(blocks, COL.sidewalk); fill(water, COL.water, COL.shore); fill(toPolys(feat.farLand), COL.sidewalk, COL.shore); fill(parks, COL.park); fill(toPolys(feat.parkWater), COL.water); fill(roads, COL.street);
    fill(buildings, COL.block, COL.blockHi);
    // (systems) a silently failed canvas allocation leaves it blank -> read a few building centres back; retry smaller
    const probe = buildings.filter((_, i) => i % 97 === 0).slice(0, 8); let okN = 0;
    for (const b of probe) { const [x, z] = b.pts[0], [x2, z2] = b.pts[2] || b.pts[0]; const d = g.getImageData(Math.floor(((x + x2) / 2 - ox) * PX_PER_M), Math.floor(((z + z2) / 2 - oz) * PX_PER_M), 1, 1).data; if (d[3] > 0 && d[0] + d[1] + d[2] > 150) okN++; }
    if (probe.length && !okN) { off = null; offCtx = null; if (PX_PER_M > 0.35) PX_PER_M *= 0.7; console.warn('[hud] minimap canvas blank, rebuilding at', PX_PER_M.toFixed(2), 'px/m'); return false; }
    return true;
  }
  function startSampling() { // fallback: sample rooftops by raycasting down on a grid around spawn
    const half = 360, step = 4; const c = world.spawn || new THREE.Vector3();
    OW = OH = Math.ceil(half * 2 * PX_PER_M); ox = c.x - half; oz = c.z - half;
    off = document.createElement('canvas'); off.width = OW; off.height = OH; offCtx = off.getContext('2d');
    offCtx.fillStyle = COL.street; offCtx.fillRect(0, 0, OW, OH);
    sampling = { i: 0, n: Math.ceil(half * 2 / step), step };
  }
  const _o = new THREE.Vector3(), _d = new THREE.Vector3(0, -1, 0);
  function sampleSome(budget) {
    if (!sampling) return;
    const { n, step } = sampling;
    for (let k = 0; k < budget && sampling.i < n * n; k++, sampling.i++) {
      const ix = sampling.i % n, iz = Math.floor(sampling.i / n);
      const x = ox + (ix + 0.5) * step, z = oz + (iz + 0.5) * step;
      const gy = world.groundHeight(x, z);
      const h = world.raycast(_o.set(x, gy + 400, z), _d, 420);
      let col = null;
      if (h && h.point.y > gy + 3) col = COL.block;
      else if (gy < -0.8) col = COL.water;
      if (col) { offCtx.fillStyle = col; offCtx.fillRect((x - ox - step / 2) * PX_PER_M, (z - oz - step / 2) * PX_PER_M, step * PX_PER_M + 0.5, step * PX_PER_M + 0.5); }
    }
    if (sampling.i >= n * n) sampling = null;
  }
  let featTries = 0;
  function tryFeatures() {
    if (off && !sampling) return;
    const f = world.getMapFeatures?.();
    if (f && buildOffscreen(f)) { sampling = null; return; }
    if (!off && ++featTries > 30) startSampling();
  }

  // objective: a spot ~300m from spawn (or world-provided)
  let objective = world.objective?.clone?.() || (world.spawn ? world.spawn.clone().add(new THREE.Vector3(-260, 60, 180)) : new THREE.Vector3(200, 60, 200));
  const collectibles = world.collectibles || [objective.clone().add(new THREE.Vector3(90, 0, -140))];

  // (perf r3) the canvases' on-screen box only changes with the window: re-read it on resize and every 30th call, not
  // on every draw (getBoundingClientRect forced a synchronous style + layout pass each frame: the objective marker
  // moves every frame)
  const rects = new Map(); let rectGen = 0; addEventListener('resize', () => rectGen++);
  const rectOf = c => { let e = rects.get(c); if (!e || e.gen !== rectGen || ++e.n >= 30) rects.set(c, e = { r: c.getBoundingClientRect(), gen: rectGen, n: 0 }); return e.r; };
  function resizeCanvas(c) { const r = rectOf(c); const dpr = Math.min(2, devicePixelRatio); const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return [w, h]; }

  function drawCompass(heading) {
    const [w, h] = resizeCanvas(compassC); const g = compassC.getContext('2d'); g.clearRect(0, 0, w, h);
    const span = Math.PI * 0.9; // radians visible across strip
    const pxr = w / span;
    // heading: yaw where camera looks along (sin yaw, cos yaw) in xz. North = -Z.
    const bearing = Math.atan2(Math.sin(heading), -Math.cos(heading)); // 0 = north(-Z), +pi/2 = east(+X)
    g.font = `700 ${Math.round(h * 0.52)}px Rajdhani, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let deg = -180; deg < 540; deg += 7.5) {
      const a = deg * Math.PI / 180; let d = a - bearing; d = Math.atan2(Math.sin(d), Math.cos(d));
      const x = w / 2 + d * pxr; if (x < -10 || x > w + 10) continue;
      if (deg % 90 === 0) {
        const L = ['N', 'E', 'S', 'W'][((deg / 90) % 4 + 4) % 4];
        g.fillStyle = L === 'N' ? '#f39a2b' : '#fff'; g.fillText(L, x, h * 0.5);
      } else {
        const big = deg % 22.5 === 0; g.fillStyle = 'rgba(235,240,255,.85)';
        g.fillRect(x - 1, h * (big ? 0.34 : 0.42), 2, h * (big ? 0.32 : 0.18));
      }
    }
    // objective pip
    const p = player.position; const oa = Math.atan2(objective.x - p.x, -(objective.z - p.z));
    let d = oa - bearing; d = Math.atan2(Math.sin(d), Math.cos(d)); const x = THREE.MathUtils.clamp(w / 2 + d * pxr, 8, w - 8);
    g.fillStyle = '#f5c02e'; g.beginPath(); g.moveTo(x, h * 0.72); g.lineTo(x + h * 0.18, h * 0.98); g.lineTo(x - h * 0.18, h * 0.98); g.closePath(); g.fill();
  }

  function drawMap(heading) {
    const [w, h] = resizeCanvas(mapC); const g = mapC.getContext('2d');
    g.fillStyle = COL.bg; g.fillRect(0, 0, w, h);
    const p = player.position, scale = w / VIEW_M; // px per meter
    const cx = w * 0.5, cy = h * 0.62;
    g.save(); g.translate(cx, cy); g.rotate(-(Math.PI - heading)); // camera forward -> screen up
    g.scale(scale, scale);
    if (off) {
      g.imageSmoothingEnabled = true;
      g.drawImage(off, (ox - p.x), (oz - p.z), OW / PX_PER_M, OH / PX_PER_M);
    }
    // collectible icons (kept upright)
    const icon = (v, fn) => { g.save(); g.translate(v.x - p.x, v.z - p.z); g.rotate(Math.PI - heading); g.scale(1 / scale, 1 / scale); fn(); g.restore(); };
    for (const c of collectibles) icon(c, () => { // orange backpack-ish emblem
      g.fillStyle = '#f07a22'; g.strokeStyle = '#1a1020'; g.lineWidth = 1.6;
      for (const [dx, r] of [[-5, -0.35], [0, 0], [5, 0.35]]) { g.save(); g.rotate(r); g.beginPath(); g.ellipse(dx * 0.4, -2, 4, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
    });
    g.restore();
    // objective marker (clamped to the map edge)
    {
      const dx = objective.x - p.x, dz = objective.z - p.z; const r = -(Math.PI - heading);
      let X = (dx * Math.cos(r) - dz * Math.sin(r)) * scale + cx, Y = (dx * Math.sin(r) + dz * Math.cos(r)) * scale + cy;
      X = THREE.MathUtils.clamp(X, 10, w - 10); Y = THREE.MathUtils.clamp(Y, 10, h - 10);
      g.save(); g.translate(X, Y); g.strokeStyle = '#f5b82e'; g.lineWidth = 2.2; g.fillStyle = 'rgba(15,15,20,.8)';
      g.beginPath(); g.moveTo(0, -9); g.lineTo(9, 0); g.lineTo(0, 9); g.lineTo(-9, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f5d34a'; g.beginPath(); g.arc(0, 0, 2.5, 0, 7); g.fill(); g.restore();
    }
    // player arrow (camera-up; rotate by player facing relative to camera)
    const vel = player.velocity; const face = Math.hypot(vel.x, vel.z) > 0.5 ? Math.atan2(vel.x, vel.z) : heading;
    g.save(); g.translate(cx, cy); g.rotate(-(face - heading));
    const s = h * 0.075;
    g.beginPath(); g.moveTo(0, -s * 1.35); g.lineTo(s * 1.0, s * 0.9); g.lineTo(0, s * 0.35); g.lineTo(-s * 1.0, s * 0.9); g.closePath();
    g.fillStyle = '#f7c531'; g.fill(); g.lineWidth = Math.max(1.5, s * 0.22); g.strokeStyle = '#fff'; g.stroke();
    g.restore();
    // vignette
    const vg = g.createLinearGradient(0, 0, 0, h); vg.addColorStop(0, 'rgba(0,0,40,.25)'); vg.addColorStop(0.2, 'rgba(0,0,40,0)'); vg.addColorStop(1, 'rgba(0,0,40,.15)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  }

  const _p = new THREE.Vector3(), _hd = new THREE.Vector3();
  function drawIndicator() {
    // world objective -> screen; if off-screen clamp to edge with chevron pointing out
    _p.copy(objective).project(camera);
    const behind = _p.z > 1;
    let x = _p.x, y = _p.y;
    if (behind) { x = -x; y = -y; }
    const on = !behind && Math.abs(x) < 0.92 && Math.abs(y) < 0.9;
    let sx, sy, ang = 0;
    if (on) { sx = (x * 0.5 + 0.5) * innerWidth; sy = (-y * 0.5 + 0.5) * innerHeight; chev.style.display = 'none'; }
    else {
      const m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.82, 1e-3); x /= m; y /= m;
      if (behind && Math.abs(x) < 0.9) { x = x < 0 ? -0.92 : 0.92; }
      sx = (x * 0.5 + 0.5) * innerWidth; sy = (-y * 0.5 + 0.5) * innerHeight; chev.style.display = '';
      ang = Math.atan2(-y, x) * 180 / Math.PI + 180; // chevron drawn pointing left
    }
    ind.style.left = sx + 'px'; ind.style.top = sy + 'px';
    chev.setAttribute('transform', `rotate(${ang})`);
  }

  let visible = true, t = 0;
  let mmT = 1, mmFrame = 0;
  return {
    setVisible(b) { visible = b; root.classList.toggle('hidden', !b); },
    setObjective(v) { if (v) objective = v.clone(); },
    showHelp(b) { helpOn = b; },
    get minimapFrame() { return mmFrame; },
    get objective() { return objective; },
    update(dt) {
      t += dt; tryFeatures(); sampleSome(off && sampling ? 700 : 0);
      reticle?.update(dt, camera, { candidates: player.zipCandidates || [], best: player.zipTarget, aiming: !!player.aiming, visible });
      if (!visible) return;
      helpT += dt; help.style.opacity = helpOn && (helpManual || helpT < 30) ? 1 : 0;
      const cd = camera.getWorldDirection(_hd); const heading = Math.atan2(cd.x, cd.z);
      drawCompass(heading); drawIndicator();
      mmT += dt; if (mmT >= 1 / 30) { mmT = 0; drawMap(heading); mmFrame++; } // minimap at 30 Hz (systems overlay follows mmFrame)
      if (debug) { const p = player.position, v = player.velocity; dbg.textContent = `${player.mode} pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  v ${v.length().toFixed(1)} m/s`; }
    },
  };
}
