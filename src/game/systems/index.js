// OWNER: systems engineer. Open-world systems entry point (Insomniac-style non-combat feature set).
//   initSystems(ctx) is called once from main.js after ctx is built (C5 hook):  import('./game/systems/index.js').then(m => m.initSystems(ctx))
// It pushes ONE {update(dt)} into ctx.systems and exposes:
//   ctx.events  (bus: on/emit, see events.js)     ctx.params (traversal tuning from skills, see progression.js)
//   ctx.flow    (pause/photo/travel modes)         window.__sys (everything, for debugging / playtests)
// Debug hooks (console / playtest "eval"): __sys.debug.{xp(n), unlockAll(), activateTower(id|'all'), crime(type), tp(x,z,y),
//   waypoint(x,z), grabNearestBackpack(), openMenu(tab), photo(), state()}.  window.__ptState is extended with systems state.
import * as THREE from 'three';
import events, { on, emit } from './events.js';
import { createSave } from './save.js';
import { createProgression, SKILLS } from './progression.js';
import { buildWorldData } from './worlddata.js';
import { createMarkers } from './markers.js';
import { createAudio } from './audio.js';
import { createFlow } from './flow.js';
import { createTowers } from './towers.js';
import { createCollectibles } from './collectibles.js';
import { createDevMenu } from '../../ui/menus/dev.js';
import { createCrimes } from './crimes.js';
import { createTravel } from './travel.js';
import { createPhoto } from './photo.js';
import { createSuits, SUITS } from './suits.js';
import { createSkillFx } from './skillfx.js';
import { createUI } from '../../ui/menus/ui.js';
import { createPauseMenu } from '../../ui/menus/pause.js';
import { createPhotoUI } from '../../ui/menus/photo.js';
import { getRenderPixelRatio } from '../../render/quality.js';

export function initSystems(ctx) {
  if (ctx.sys) return ctx.sys;
  const q = new URLSearchParams(location.search);
  if (q.has('shot')) return null; // deterministic screenshot mode: no open-world systems
  const t0 = performance.now();
  const save = createSave();
  // saved graphics preset (quality is chosen from the URL at boot by render/quality.js)
  if (save.persistent && !q.has('q') && save.state.settings.quality && save.state.settings.quality !== 'high') {
    const u = new URL(location.href); u.searchParams.set('q', save.state.settings.quality); location.replace(u.toString()); return null;
  }
  ctx.events = events;
  const audio = createAudio();
  const ui = createUI({ camera: ctx.camera, audio });
  ui.setSubtitleGate?.(() => save.state.settings.subtitles !== false);
  const flow = ctx.flow = createFlow(ctx, { save });
  const prog = createProgression(ctx, save);
  const data = buildWorldData(ctx.world);
  const markers = createMarkers(ctx.scene, ctx.renderer);
  markers.setStations(data.stations);
  const sys = ctx.sys = { ctx, events, save, audio, ui, flow, prog, data, markers };
  // world.extraColliders: systems-owned solids (research tower plinth / cabinets / mast). world.raycast and
  // world.groundHeight are wrapped so the camera, zip targeting and ground queries all see them.
  {
    const W = ctx.world, rc = W.raycast.bind(W), gh = W.groundHeight.bind(W);
    W.extraColliders = { raycast: markers.raycastExtra, groundHeight: markers.groundExtra, list: markers.colliders };
    W.raycast = (o, d, max = 1000) => { const a = rc(o, d, max), b = markers.raycastExtra(o, d, max); return !b ? a : !a ? b : (b.distance < a.distance ? b : a); };
    W.groundHeight = (x, z, y) => { const g = gh(x, z, y); const e = markers.groundExtra(x, z, y ?? Infinity); return e > g ? e : g; };
  }
  sys.suits = createSuits(ctx);
  sys.skillfx = createSkillFx(ctx);
  sys.towers = createTowers(sys);
  sys.collect = createCollectibles(sys);
  sys.crimes = createCrimes(sys);
  sys.travel = createTravel(sys);
  sys.photo = createPhoto(sys);
  sys.pause = createPauseMenu(sys);
  sys.photoUI = createPhotoUI(sys);
  // developer menu (~): dev server, or ?dev on a build (registered after the pause menu: its keys win)
  if (import.meta.env?.DEV || new URLSearchParams(location.search).has('dev')) sys.dev = createDevMenu(sys);
  // user r-symbiote: Classic / Stealth / Negative / Noir were removed; old saves wearing one fall back to Advanced
  if (!SUITS.some(s => s.id === save.state.suit)) { save.state.suit = 'advanced'; save.markDirty(); }
  if (save.state.suitsUnlocked) save.state.suitsUnlocked = save.state.suitsUnlocked.filter(id => SUITS.some(s => s.id === id));
  sys.suits.apply(save.state.suit);
  sys.travel.init();

  // ---------------------------------------------------------------- settings
  // camera / post settings are applied by wrapping the pipeline setters (feature-detected) so every caller
  // (traversal camera, photo mode, suit preview) respects them
  const pipe = ctx.pipeline;
  if (pipe.setMotionBlur) { const o = pipe.setMotionBlur.bind(pipe); pipe.setMotionBlur = (k, opts) => o(k * (save.state.settings.motionBlur ?? 1), opts); }
  if (pipe.setAperture) { const o = pipe.setAperture.bind(pipe); pipe.setAperture = a => o(flow.mode === 'photo' ? a : a * (save.state.settings.dof ?? 1)); }
  if (pipe.setDof) { const o = pipe.setDof.bind(pipe); pipe.setDof = (d = {}) => o(d.aperture !== undefined && flow.mode !== 'photo' ? { ...d, aperture: d.aperture * (save.state.settings.dof ?? 1) } : d); }
  let appliedScale = null;
  sys.applySettings = () => {
    const s = save.state.settings;
    audio.setVolumes(s);
    { const t = s.timeOfDay === 'cycle' || !s.timeOfDay ? 'day' : s.timeOfDay; ctx.lighting?.setTimeMode?.(t === 'day' ? ({ b: 'dayB', c: 'dayC' }[s.daySun] ?? 'day') : t); } // (user r-daysun) Day Sun variant // (lighting2 r3) fixed preset (old saves: 'cycle' -> day)
    ctx.lighting?.setDryPuddles?.(s.puddles !== false); // (user r-nopuddles)
    if (s.renderScale !== appliedScale) {
      appliedScale = s.renderScale;
      if (appliedScale !== 1 || ctx.renderer.getPixelRatio() !== getRenderPixelRatio(ctx.renderer)) {
        ctx.renderer.setPixelRatio(getRenderPixelRatio(ctx.renderer, s.renderScale));
        ctx.renderer.setSize(innerWidth, innerHeight); ctx.pipeline.setSize?.(innerWidth, innerHeight);
      }
    }
    prog.recompute();
    const z = String(s.hudScale ?? 1);
    const hudEl = document.getElementById('hud'); if (hudEl) hudEl.style.zoom = z;
    ui.root.querySelectorAll('.sys-xp,.sys-obj,.sys-toasts,.sys-crime').forEach(e => { e.style.zoom = z; });
    ui.root.style.setProperty('--sub-scale', String(s.subtitleSize ?? 1));
    document.body.classList.toggle('ui-minimal', s.minimalHud === true); // Minimal HUD: only the minimap stays (css in systems.css)
    emit('settings:changed', s);
  };
  if (save.state.settings.crimesOn === false) sys.crimes.enable(false);
  sys.applySettings();

  // ---------------------------------------------------------------- progression feedback
  on('xp:gain', e => { ui.xp({ level: prog.level, xp: prog.xp, need: prog.need, gain: e.amount, leveled: e.leveled }); if (!e.leveled) audio.sfx.xp(); });
  on('level:up', e => {
    const n = e.gained || 1;
    ui.banner('LEVEL UP', `LEVEL ${e.level}`, `+${n} Skill Point${n > 1 ? 's' : ''} — open the pause menu to spend ${n > 1 ? 'them' : 'it'}`, 'levelUp');
    for (const s of SUITS) if (s.level > (e.from ?? e.level - 1) && s.level <= e.level) ui.toast({ title: 'Suit Unlocked', text: s.name, icon: 'xp', tone: 'gold' });
  });

  // ---------------------------------------------------------------- interaction ([F])
  let fHeld = false, fPressed = false, holdT = 0, holdId = null, lastTick = 0;
  flow.onKey((e, mode) => { if (mode === 'play' && e.code === 'KeyF' && !e.repeat) { fHeld = true; fPressed = true; } return false; });
  addEventListener('keyup', e => { if (e.code === 'KeyF') fHeld = false; });
  addEventListener('blur', () => { fHeld = false; });
  function interact(dt) {
    const p = ctx.player.position;
    const cands = [sys.towers.interact(p), sys.collect.interact(p, ctx.camera), sys.crimes.interact(p)].filter(Boolean);
    cands.sort((a, b) => b.priority - a.priority);
    const c = cands[0];
    if (!c) { ui.prompt(null); holdT = 0; holdId = null; fPressed = false; return; }
    if (c.id !== holdId) { holdId = c.id; holdT = 0; }
    if (!c.hold) {
      ui.prompt({ label: c.label, sub: c.sub, progress: 0, pos: c.pos });
      if (fPressed) { c.action(); ui.prompt(null); }
    } else {
      if (fHeld) {
        holdT += dt; const k = Math.min(1, holdT / c.hold);
        if (c.tick && performance.now() - lastTick > 90) { lastTick = performance.now(); c.tick(k); }
        if (k >= 1) { holdT = 0; fHeld = false; c.action(); ui.prompt(null); fPressed = false; return; }
      } else holdT = Math.max(0, holdT - dt * 2);
      ui.prompt({ label: c.label, sub: c.sub, progress: holdT / c.hold, key: 'F', pos: c.pos });
    }
    fPressed = false;
  }

  // ---------------------------------------------------------------- traversal-derived events (audio, tricks)
  const tr = { mode: '', sub: '', webActive: false, grounded: true, vy: 0, minVy: 0, trick: null, phase: 0, thwipT: 0, airT: 0, stepT: 0, stepSide: 1 };
  const _footP = new THREE.Vector3();
  function traversalEvents(dt) {
    const P = ctx.player, a = P.anim; const v = P.velocity || a?.velocity; if (!v) return;
    const mode = a?.mode || P.mode || '';
    const grounded = a ? !!a.grounded : (mode === 'ground');
    const webActive = !!(P.web?.active);
    tr.thwipT -= dt;
    // pan the thwip toward the firing hand (L swings sound from the left) so both hands feel symmetric
    const thwip = (s = 1) => { if (tr.thwipT > 0) return; tr.thwipT = 0.12; const hand = a?.swing?.hand || 'R'; audio.sfx.thwip(s, hand === 'L' ? -0.35 : 0.35); emit('player:thwip', { hand }); };
    // quick web boost (Q): one strand from its own hand — thwip panned to that hand (a mid-swing boost keeps the web
    // "active" across the switch, so the rising edge alone would miss it)
    if ((P.traversal?.events || []).some(e => e.type === 'wallZip')) { tr.thwipT = 0.12; audio.sfx.zip(); } // user r9w: wall zip up
    const qz = (P.traversal?.events || []).find(e => e.type === 'quickZip');
    if (qz) { tr.thwipT = 0.12; audio.sfx.thwip(1.1, qz.hand === 'L' ? -0.35 : 0.35); emit('player:thwip', { hand: qz.hand, quick: true }); }
    else if (webActive && !tr.webActive) thwip();
    // (user r-norelease) "remove the sound when web is released": letting go of a web is silent
    if (mode !== tr.mode) {
      if (mode === 'swing' && !webActive) thwip();
      if (mode === 'zip') { thwip(1.2); audio.sfx.zip(); }
      if (mode === 'wall' && tr.mode !== 'wall') audio.sfx.wallContact?.(); // (audio r1) hands / feet meet the wall
      if (mode === 'perch' && tr.mode !== 'perch') audio.sfx.perch?.();     // (audio r1) perch grip
    }
    // web slingshot (traversal events + anim.sling): thwip per web (panned to its side), stretch creaks that tighten with
    // tension while he pulls back, snap + whoosh on the launch
    for (const e of P.traversal?.events || []) {
      if (e.type === 'slingAttach') { audio.sfx.thwip(1, e.side * 0.4); emit('player:thwip', { hand: e.side < 0 ? 'L' : 'R' }); }
      else if (e.type === 'slingLaunch') audio.sfx.slingLaunch(e.tension);
      // web tightrope (T): thwip as the web leaves the hand, a softer one as the near end is pinned, deny on an invalid target
      else if (e.type === 'ropeShoot') { tr.thwipT = 0.12; audio.sfx.thwip(1.05, 0.3); emit('player:thwip', { hand: 'R', rope: true }); }
      else if (e.type === 'ropeAnchor') audio.sfx.thwip(0.45, 0.1);
      else if (e.type === 'ropeFail') audio.sfx.deny();
    }
    { const sl = a?.sling; tr.creakT = (tr.creakT ?? 0) - dt;
      if (sl?.active && sl.anchors?.length && sl.tension > 0.04 && (sl.moving > 0.2 || sl.tension > 0.95) && tr.creakT <= 0) {
        tr.creakT = 0.26 - 0.14 * sl.tension + Math.random() * 0.05; audio.sfx.slingCreak?.(sl.tension, (Math.random() - 0.5) * 0.3);
        if (sl.tension > 0.95) tr.creakT += 0.35; // held at full stretch: sparse strained creaks
      } }
    // jump: anticipation cue on crouch, push-off on launch (C1 subs)
    const sub = a?.sub || '';
    if (sub !== tr.sub) {
      if (sub === 'jumpCharge') audio.sfx.jumpLoad();
      if (sub === 'jumpLaunch' || sub === 'wallJump') { audio.sfx.jump(a?.jumpCharge ?? 0); emit('player:jump', { charge: a?.jumpCharge ?? 0, from: tr.sub }); }
    }
    // footsteps: ground locomotion and wall runs (feet striking the wall surface), cadence from speed
    const hs = Math.hypot(v.x, v.z), sp3 = v.length();
    const stepping = (mode === 'ground' && grounded && hs > 1.2 && /walk|run|sprint/.test(sub)) || (mode === 'wall' && /wallRun/.test(sub) && sp3 > 1.5);
    const roping = mode === 'rope' && (a?.rope?.speed ?? 0) > 0.4; // web tightrope: light ticks at the animator's rope cadence
    // (user r-foley2) "for running, sounds should match the rhythm of the legs, so when they touch ground": ground
    // footsteps fire on each foot's real touchdown, read from the animated foot bones (height above the body's feet
    // level: the moment a descending foot stops at its low point), so they follow whatever walk / run / sprint / stop
    // blend is playing. Wall runs and the tightrope keep the cadence timer.
    const fb = P.rig?.bones, footSync = mode === 'ground' && fb?.footL && fb?.footR;
    if (footSync) {
      const ft = tr.feet || (tr.feet = { L: { y: 0, v: 0, lo: 0, t: 1, ok: false }, R: { y: 0, v: 0, lo: 0, t: 1, ok: false } });
      for (const S of ['L', 'R']) {
        const f = ft[S]; fb['foot' + S].getWorldPosition(_footP);
        const y = _footP.y - P.position.y, vy = dt > 1e-4 ? (y - f.y) / dt : 0;
        if (!f.ok) { f.ok = true; f.y = f.lo = y; f.v = 0; continue; }
        f.lo = Math.min(f.lo + dt * 0.15, y); f.t += dt; // low point of this foot's cycle (creeps back up on slopes / crouches)
        const down = f.v < -0.35 && vy > -0.1 && y < f.lo + 0.07; // was falling, now stopped, near the ground
        if (stepping && down && f.t > 0.16) { f.t = 0; audio.sfx.step(THREE.MathUtils.clamp(hs / 8, 0.5, 1.6), S === 'L' ? -0.12 : 0.12, 'ground'); }
        f.y = y; f.v = f.v * 0.35 + vy * 0.65;
      }
    } else if (tr.feet) { tr.feet.L.ok = tr.feet.R.ok = false; }
    if ((stepping && !footSync) || roping) {
      const spd = roping ? a.rope.speed : mode === 'wall' ? sp3 : hs;
      tr.stepT -= dt * (roping ? 2 * (0.7 + 0.45 * spd) : THREE.MathUtils.clamp(0.9 + spd * 0.16, 1.1, 3.4));
      if (tr.stepT <= 0) { tr.stepT += 1; tr.stepSide = -tr.stepSide; audio.sfx.step(roping ? 0.45 : THREE.MathUtils.clamp(spd / 8, 0.5, 1.6), tr.stepSide * 0.12, roping ? 'rope' : mode === 'wall' ? 'wall' : 'ground'); }
    } else tr.stepT = 0.35;
    if (!grounded) { tr.airT += dt; tr.minVy = Math.min(tr.minVy, v.y); } else tr.airT = 0;
    if (grounded && !tr.grounded && tr.minVy < -4) {
      const sev = a?.landing?.severity ?? THREE.MathUtils.clamp((-tr.minVy - 4) / 26, 0, 1);
      audio.sfx.land(sev); emit('player:land', { severity: sev });
    }
    if (grounded) tr.minVy = 0;
    // (user r10h removed the loud swing-arc whoosh; user r-foley2 asked for a much softer one back): a faint swish as he
    // passes through the bottom of each swing arc (once per arc, fast swings only)
    if (mode === 'swing' && webActive) {
      const ph = Math.abs(a?.swing?.phase ?? 1);
      if (ph < 0.3 && (tr.swishPh ?? 1) >= 0.3 && sp3 > 7) audio.sfx.swingSwish?.(sp3, a?.swing?.hand === 'L' ? -0.25 : 0.25);
      tr.swishPh = ph;
    } else tr.swishPh = 1;
    // air tricks -> XP (Air Tricks skill)
    const trick = a?.trick || null;
    if (trick && trick !== tr.trick && ctx.params.airTricks) prog.addXp(25, 'trick');
    tr.sub = sub; tr.trick = trick; tr.vy = v.y; tr.mode = mode; tr.webActive = webActive; tr.grounded = grounded;
  }

  // ---------------------------------------------------------------- district entry titles
  let curDistrict = null, districtT = 0, lastShown = -1e9, shownId = null;
  function districtTitle(dt) {
    const p = ctx.player.position; const d = data.districtAt(p.x, p.z);
    if (d.id !== curDistrict) { curDistrict = d.id; districtT = 0; }
    districtT += dt;
    if (districtT > 1.5 && shownId !== d.id && performance.now() - lastShown > 25000) {
      shownId = d.id; lastShown = performance.now();
      if (sys.towers.revealed(d.id)) ui.toast({ title: d.name, text: 'District', icon: 'landmark', sound: null, ms: 3000, tone: 'cyan' });
      else ui.toast({ title: d.name, text: 'Signal scrambled — find the research tower', icon: 'tower', sound: null, ms: 3800, tutorial: true, valid: () => !sys.towers.revealed(d.id) && !inCombat });
    }
  }

  // ---------------------------------------------------------------- restore position / periodic save
  // resolve a saved position into a free standing spot: on top of whatever is rendered there (props / rooftop boxes /
  // cars), and nudged out of any wall the capsule would overlap
  function safeSpot(x, y, z) {
    const W = ctx.world, V = new THREE.Vector3();
    const top = (px, pz) => W.groundHeight(px, pz, y + 4);
    let gy = top(x, z);
    const dirs = []; for (let i = 0; i < 12; i++) dirs.push(new THREE.Vector3(Math.cos(i / 12 * 6.283), 0, Math.sin(i / 12 * 6.283)));
    const blocked = (px, py, pz) => dirs.some(d => { const h = W.raycast(V.set(px, py + 1.0, pz), d, 0.5); return h && h.distance < 0.45; });
    if (blocked(x, gy, z)) {
      outer: for (let r = 0.8; r <= 6; r += 0.8) for (const d of dirs) { const px = x + d.x * r, pz = z + d.z * r, py = top(px, pz); if (Math.abs(py - gy) < 3 && !blocked(px, py, pz)) { x = px; z = pz; gy = py; break outer; } }
    }
    const dyn = W.collideDynamic?.(V.set(x, gy, z), 0.4, 1.8); if (dyn?.grounded && dyn.groundY != null) gy = Math.max(gy, dyn.groundY);
    return new THREE.Vector3(x, gy + 0.95 + 0.08, z);
  }
  if (save.persistent && save.state.player && !q.has('fresh')) {
    const [x, y, z, yaw] = save.state.player;
    try { ctx.player.teleport?.(safeSpot(x, y, z), yaw || 0); } catch (e) { console.warn('[systems] restore position failed', e); }
  }
  let saveT = 0;
  const savePos = () => {
    // only remember stable spots (standing / perched), never mid-air, mid-swing or inside a wall run
    const a = ctx.player.anim, m = a?.mode || ctx.player.mode;
    if (!(m === 'ground' || m === 'perch') || (a && a.grounded === false && m !== 'perch')) return;
    const p = ctx.player.position; save.state.player = [+p.x.toFixed(1), +(p.y + 0.5).toFixed(1), +p.z.toFixed(1), +(ctx.player.heading ?? 0).toFixed(2)]; save.markDirty(2000); };
  addEventListener('beforeunload', () => { if (flow.isPlaying) savePos(); save.flush(); });

  // first-run onboarding
  if (!save.state.towers.length && save.state.xp === 0 && save.state.level === 1) {
    setTimeout(() => ui.toast({ title: 'Research Towers', text: 'Activate towers to reveal districts, collectibles and fast travel. Esc / M opens the map.', icon: 'tower', ms: 7000, tutorial: true, valid: () => !save.state.towers.length && !inCombat }), 3500);
  }

  // ---------------------------------------------------------------- combat: keep the screen clear while fighting
  let inCombat = false;
  const setCombat = on => {
    if (on === inCombat) return; inCombat = on;
    if (on) { ctx.hud?.showHelp?.(false); ui.objective(null); }
    ui.root.classList.toggle('sys-combat', on);
  };
  on('combat:engaged', e => setCombat(e?.engaged !== false)); on('combat:ended', () => setCombat(false));
  sys.inCombat = () => inCombat;

  // ---------------------------------------------------------------- per-frame
  const pinList = [], mmList = [];
  let time = 0;
  const system = {
    name: 'openworld',
    update(dt) {
      time += dt;
      const playing = flow.isPlaying;
      const p = ctx.player.position;
      sys.suits.update(dt);
      // FOV setting: the chase camera rewrites camera.fov every frame; add the user's offset on top while playing
      const fo = save.state.settings.fovOffset || 0;
      if (fo && playing) { ctx.camera.fov += fo; ctx.camera.updateProjectionMatrix(); }
      markers.update(dt, ctx.camera);
      sys.pause.update(dt);
      sys.photoUI.update(dt);
      ui.update(dt);
      audio.update(dt, { camera: ctx.camera, playerPos: p, speed: playing ? (ctx.player.velocity?.length?.() || 0) : 0, ground: ctx.world.groundHeight(p.x, p.z), swinging: ['swing', 'air'].includes(ctx.player.anim?.mode || ctx.player.mode), mode: ctx.player.anim?.mode || ctx.player.mode || '', inCombat: !!(ctx.combat?.engaged ?? window.__cmb?.state?.engaged) }); // swing + the air between webs (r10j); (audio r1) mode / combat drive the music's swing layers
      if (!playing) { ui.pins([], false); ui.prompt(null); return; }
      sys.skillfx.update(dt);
      traversalEvents(dt);
      sys.crimes.update(dt, p);
      sys.collect.update(dt, p);
      sys.travel.update(dt);
      interact(dt);
      districtTitle(dt);
      // world pins + minimap icons
      pinList.length = 0;
      sys.towers.pins(p, pinList); sys.collect.pins(p, pinList); sys.crimes.pins(p, pinList);
      for (const s of data.stations) if (save.state.stations.includes(s.id)) { const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z); if (d < 140 && d > 6) pinList.push({ kind: 'station', pos: s.pinPos || (s.pinPos = s.pos.clone().setY(s.pos.y + 3.2)), dist: d, scale: 0.8 }); }
      // waypoint: distance under the HUD's world diamond + objective panel (waypoint > nearest research tower)
      setCombat(!!(ctx.combat?.engaged ?? window.__cmb?.state?.engaged ?? inCombat));
      const wp = sys.travel.waypoint;
      if (inCombat) ui.objective(null);
      else if (wp) { const d = Math.hypot(wp.x - p.x, wp.z - p.z); pinList.push({ kind: 'label', pos: wp.clone().setY(wp.y - 1.2), label: d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m', edge: false }); ui.objective({ cap: 'Waypoint', text: 'Travel to the marked location', dist: sys.travel.routeLength ?? d }); }
      else if (!sys.crimes.active) { const t = sys.towers.nearestInactive(p); if (t) ui.objective({ cap: 'Objective', text: `Activate the ${data.districts.find(x => x.id === t.district).name} tower`, dist: Math.hypot(t.pos.x - p.x, t.pos.z - p.z) }); else ui.objective(null); }
      else ui.objective(null);
      ui.pins(pinList, save.state.settings.showPins !== false);
      mmList.length = 0;
      for (const t of data.towers) mmList.push({ kind: sys.towers.isActive(t.id) ? 'towerDone' : 'tower', pos: t.pos, clamp: !sys.towers.isActive(t.id) && Math.hypot(t.pos.x - p.x, t.pos.z - p.z) < 500, mscale: 1 });
      for (const s of data.stations) if (save.state.stations.includes(s.id)) mmList.push({ kind: 'station', pos: s.pos, mscale: 0.85 });
      const det = ctx.params.backpackDetector || 0;
      for (const b of data.backpacks) if (!save.state.backpacks.includes(b.id) && (sys.towers.revealed(b.district) || Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < det)) mmList.push({ kind: 'backpack', pos: b.pos, mscale: 0.75 });
      for (const l of data.landmarks) if (!save.state.landmarks.includes(l.id) && sys.towers.revealed(l.district)) mmList.push({ kind: 'landmark', pos: l.target, mscale: 0.8 });
      if (sys.crimes.active) mmList.push({ kind: sys.crimes.active.icon, pos: sys.crimes.active.pos, clamp: true, mscale: 1.1 });
      sys.travel.minimap(mmList);
      saveT += dt; if (saveT > 5) { saveT = 0; savePos(); }
    },
  };
  ctx.systems = ctx.systems || [];
  ctx.systems.push(system);

  // ---------------------------------------------------------------- debug / playtest hooks
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  sys.debug = {
    xp: n => prog.addXp(n, 'debug'),
    unlockAll() { save.state.skillPoints += SKILLS.length; for (const s of SKILLS) prog.unlock(s.id); },
    activateTower(id = null) { for (const t of data.towers) if (id === 'all' || t.id === id || t.district === id || (!id && t === sys.towers.nearestInactive(ctx.player.position))) sys.towers.activate(t, { silent: id === 'all' }); },
    crime(type) { sys.crimes.enable(true); return sys.crimes.spawn(type); },
    tp(x, z, y) { const gy = ctx.world.groundHeight(x, z); ctx.player.teleport(V(x, y ?? gy + 1.2, z), ctx.player.heading ?? 0); },
    tpTower(id) { // stand on the roof ~7 m from the mast, facing it, clear of the plinth and cabinets
      const t = data.towers.find(t => t.id === id || t.district === id) || sys.towers.nearestInactive(ctx.player.position);
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2 + 0.4, x = t.pos.x + Math.sin(a) * 7, z = t.pos.z + Math.cos(a) * 7;
        const y = ctx.world.groundHeight(x, z, t.pos.y + 3);
        if (Math.abs(y - t.pos.y) > 0.4) continue;
        const bx = x + Math.sin(a) * 4, bz = z + Math.cos(a) * 4; if (Math.abs(ctx.world.groundHeight(bx, bz, t.pos.y + 3) - t.pos.y) > 0.6) continue; // room for the camera behind
        const eye = V(x, y + 1.6, z), toM = V(t.pos.x - x, 0.35, t.pos.z - z).normalize();
        const hm = ctx.world.raycast(eye, toM, 8); if (hm && hm.distance < 4.2) continue; // clear view of the mast (plinth is ~4.4 m away)
        const back = V(-toM.x, 0.25, -toM.z).normalize(); const hb = ctx.world.raycast(eye, back, 4.5); if (hb) continue; // no wall behind: chase camera fits
        ctx.player.teleport(V(x, y + 1.0, z), Math.atan2(t.pos.x - x, t.pos.z - z)); return t.id;
      }
      ctx.player.teleport(V(t.pos.x + 5, t.pos.y + 1.0, t.pos.z + 5), Math.atan2(-5, -5)); return t.id;
    },
    tpBackpack(i = 0) { const b = data.backpacks.filter(b => !save.state.backpacks.includes(b.id))[i]; if (!b) return null; ctx.player.teleport(b.pos.clone().addScaledVector(b.normal, 2.2).setY(b.pos.y + (b.mount === 'wall' ? -b.pos.y + ctx.world.groundHeight(b.pos.x + b.normal.x * 2.2, b.pos.z + b.normal.z * 2.2) + 1.2 : 1.2)), 0); return b.id; },
    waypoint(x, z) { sys.travel.setWaypoint(x == null ? null : V(x, 0, z)); },
    grabNearestBackpack() { let best = null, bd = Infinity; for (const b of data.backpacks) { if (save.state.backpacks.includes(b.id)) continue; const d = b.pos.distanceTo(ctx.player.position); if (d < bd) { bd = d; best = b; } } if (best) sys.collect.pickupBackpack(best); return best?.id; },
    openMenu(tab = 'map') { sys.pause.show(tab); }, closeMenu() { sys.pause.close(); },
    photo() { if (sys.pause.open) sys.pause.close(true); sys.photo.enter(); sys.photoUI.open(); },
    suit(id) { save.state.suit = sys.suits.apply(id).id; },
    fastTravel(id) { const s = data.stations.find(s => s.id === id || s.district === id); if (s && !save.state.stations.includes(s.id)) save.state.stations.push(s.id); return sys.travel.fastTravel(s); },
    state() { const st = save.state; return { mode: flow.mode, level: st.level, xp: st.xp, sp: st.skillPoints, towers: st.towers.length, backpacks: st.backpacks.length, landmarks: st.landmarks.length, photos: st.secretPhotos.length, crime: sys.crimes.active?.type || null, crimeState: sys.crimes.active?.state || null, waypoint: !!sys.travel.waypoint, route: sys.travel.route?.length || 0, suit: st.suit, menu: sys.pause.tab || null }; },
  };
  window.__sys = sys;
  const prevPt = window.__ptState;
  window.__ptState = () => ({ ...(prevPt ? prevPt() : {}), sys: sys.debug.state() });
  console.info(`[systems] open world ready in ${(performance.now() - t0).toFixed(0)} ms: ${data.towers.length} towers, ${data.stations.length} stations, ${data.backpacks.length} backpacks, ${data.landmarks.length} landmarks, ${data.secretPhotos.length} secret photos`);
  return sys;
}
