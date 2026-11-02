// OWNER: systems engineer. Game-flow / time control without touching main.js' loop:
//   modes: 'play' | 'menu' | 'photo' | 'travel'.  Outside 'play' the player sim is frozen (player.update is
//   replaced by the active camera controller) and the world ticks with dt=0 (traffic/peds freeze, LOD still follows
//   the camera). Input is gated: while not playing, key/mouse-down events never reach the traversal input layer,
//   so nothing latches. Also scales mouse look by settings (sensitivity / invert Y) at the input layer.
//   ctx.flow = { mode, setMode(m), isPlaying, onKey(fn), cameraHook }
import * as THREE from 'three';
import { emit } from './events.js';

export function createFlow(ctx, { save }) {
  const { player, world, input, hud } = ctx;
  let mode = 'play';
  let cameraHook = null; // fn(dt) run in place of player.update when not playing
  const keyHandlers = [];

  const origPlayerUpdate = player.update;
  player.update = function (dt) {
    if (mode === 'play') return origPlayerUpdate.call(this, dt);
    cameraHook?.(dt);
  };
  const origWorldUpdate = world.update;
  world.update = function (dt, camera) { return origWorldUpdate.call(this, mode === 'play' ? dt : 0, camera); };

  // mouse sensitivity / invert-Y applied once, at the source (params.lookScaledByInput tells traversal not to re-apply)
  if (input?.poll) {
    const origPoll = input.poll;
    input.poll = function (...a) {
      const s = origPoll.apply(this, a);
      const st = save.state.settings;
      if (s?.look) { s.look.dx *= st.mouseSensitivity; s.look.dy *= st.mouseSensitivity * (st.invertY ? -1 : 1); }
      return s;
    };
  }

  function clearInput() {
    try { input?.keys?.clear?.(); input?.releaseAll?.(); if (input?.mouse) input.mouse.buttons = 0; input?.poll?.(1 / 60); } catch {}
  }

  function setMode(m) {
    if (m === mode) return;
    const prev = mode; mode = m;
    if (m !== 'play') { try { document.exitPointerLock?.(); } catch {} }
    if (m === 'play') { cameraHook = null; clearInput(); }
    hud?.setVisible?.(m === 'play');
    emit('flow:mode', { mode: m, prev });
  }

  // keyboard: document-level bubble listener runs before the input layer's window listener, so we can swallow
  // events while a menu / photo mode is up. keyup is never swallowed (prevents stuck keys).
  document.addEventListener('keydown', e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') && e.code !== 'Escape') return;
    for (let i = keyHandlers.length - 1; i >= 0; i--) { if (keyHandlers[i](e, mode) === true) { e.preventDefault(); e.stopPropagation(); return; } }
    if (mode !== 'play') { e.stopPropagation(); if (['Space', 'Tab'].includes(e.code)) e.preventDefault(); }
  });
  // mouse on our overlay never reaches the input layer
  const root = document.getElementById('sys-root');
  for (const ev of ['mousedown', 'pointerdown', 'wheel', 'click', 'auxclick']) root?.addEventListener(ev, e => { if (mode !== 'play') e.stopPropagation(); });

  // losing pointer lock (browser eats the Esc keydown) while playing -> pause, like console games
  let hadLock = false, lockLostAt = 0, overlay = false; // overlay: a dev panel freed the cursor (no pause on lock loss)
  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    if (!locked && hadLock && mode === 'play' && !overlay) { lockLostAt = performance.now(); emit('flow:lockLost'); }
    hadLock = locked;
  });

  return {
    get mode() { return mode; },
    get isPlaying() { return mode === 'play'; },
    get lockLostAt() { return lockLostAt; },
    setMode, clearInput,
    set overlay(v) { overlay = !!v; }, get overlay() { return overlay; },
    setCameraHook(fn) { cameraHook = fn; },
    onKey(fn) { keyHandlers.push(fn); return () => { const i = keyHandlers.indexOf(fn); if (i >= 0) keyHandlers.splice(i, 1); }; },
  };
}
