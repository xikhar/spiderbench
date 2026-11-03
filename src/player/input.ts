// @ts-nocheck
// Keyboard + mouse (pointer lock) + Gamepad API.
// Exposes raw state plus high-level "actions" sampled once per frame via poll().
//
// Bindings (Insomniac layout):
//   Keyboard/mouse                          Gamepad (standard mapping)
//   WASD / arrows   move (camera relative)  LS
//   Mouse           camera                  RS
//   RIGHT MOUSE     web-swing (hold)        R2 (in air)
//   Shift           WALK (held, on the ground) / wall run + parkour on walls    R2 = parkour on ground / walls, swing in air
//                   (user r12: ground sprint was removed in r4; on the pad, walk = light stick tilt)
//   Space           jump (hold = charge)    A / Cross
//   E / MIDDLE MOUSE web-zip / point-launch L2 + R2  (or Y / Triangle)
//   C / Ctrl        drop / dive             B / Circle
//   Q               quick web boost (air)   L1 / LB — one-hand web to a far point ahead + forward boost (not in combat: Q = finisher)
//   Ctrl (held, on the ground) + LMB / RMB  web slingshot: anchor a web to the left / right building (no swing / attack)
//   T               web tightrope (perched only): web to the highlighted point, then walk it (W / S)   —
//
// state: move {x,y} (x = right, y = forward, -1..1), look {dx,dy} (pixels-equivalent),
//   swing, sprint, walk (Shift only, keyboard), jump, zip, drop, quick, rope (T) (held) + <name>Pressed / <name>Released edge flags, jumpHeld (seconds),
//   aimT (seconds since the last deliberate camera move), usingPad.
// Automation: input.press('KeyW' | 'Space' | 'MouseRight' | 'MouseMiddle' ...), input.release(code), input.releaseAll().
export function createInput(el) {
  const keys = new Set();
  const tapped = new Set(); // tapped: keys pressed since last poll (latched so short taps are never lost)
  const mouse = { dx: 0, dy: 0, buttons: 0 };
  const synthetic = new Set();
  const isTyping = (e) =>
    /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "");
  addEventListener("keydown", (e) => {
    if (isTyping(e)) return;
    if (!e.repeat) tapped.add(e.code);
    keys.add(e.code);
    if (["Space", "Tab", "ControlLeft", "KeyC"].includes(e.code) && !e.metaKey)
      e.preventDefault();
    // web slingshot walks back with Ctrl held: never let Ctrl+S (save page) / Ctrl+D / Ctrl+A etc. reach the browser
    if (e.ctrlKey && /^(Key[WASDEFQRCZ]|Space|Arrow)/.test(e.code))
      e.preventDefault();
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => {
    keys.clear();
    mouse.buttons = 0;
  });
  el.addEventListener("click", () => {
    try {
      el.requestPointerLock?.();
    } catch {}
  });
  addEventListener("mousemove", (e) => {
    // release-only resync: a mouseup lost outside the window (no pointer lock) must never leave the web stuck on.
    // (DOM MouseEvent.buttons: 1 left, 2 right, 4 middle — our bits are 1 << e.button: 1 left, 2 middle, 4 right)
    // Only WITHOUT pointer lock: some browsers (e.g. Firefox on Linux/Wayland) report buttons=0 on pointer-locked
    // mousemove, which would drop a held web mid-swing. Under pointer lock mousedown/mouseup are authoritative.
    if (typeof e.buttons === "number" && !document.pointerLockElement) {
      if (mouse.buttons & 4 && !(e.buttons & 2)) mouse.buttons &= ~4;
      if (mouse.buttons & 2 && !(e.buttons & 4)) mouse.buttons &= ~2;
    }
    if (document.pointerLockElement) {
      mouse.dx += e.movementX;
      mouse.dy += e.movementY;
    } else if (mouse.buttons & 1) {
      mouse.dx += e.movementX;
      mouse.dy += e.movementY;
    } // drag-to-orbit without lock
  });
  const tappedBtn = { v: 0 };
  // web slingshot: while Ctrl is held and the gate is open (player on the ground, set by player.ts each frame), LMB / RMB
  // clicks are routed to sling.left / sling.right presses and never reach mouse.buttons (no swing, no attack)
  const sling = { gate: false, tap: 0, held: 0 };
  const ctrlHeld = (e) =>
    e.ctrlKey ||
    keys.has("ControlLeft") ||
    keys.has("ControlRight") ||
    synthetic.has("ControlLeft");
  addEventListener("mousedown", (e) => {
    if ((e.button === 0 || e.button === 2) && sling.gate && ctrlHeld(e)) {
      sling.tap |= 1 << e.button;
      sling.held |= 1 << e.button;
      e.preventDefault();
      return;
    }
    mouse.buttons |= 1 << e.button;
    tappedBtn.v |= 1 << e.button;
    if (e.button === 1) e.preventDefault();
  });
  addEventListener("mouseup", (e) => {
    mouse.buttons &= ~(1 << e.button);
    sling.held &= ~(1 << e.button);
  });
  addEventListener("contextmenu", (e) => e.preventDefault());
  addEventListener("auxclick", (e) => e.preventDefault());

  const prev = {};
  const state = {
    move: { x: 0, y: 0 },
    look: { dx: 0, dy: 0 },
    usingPad: false,
    swing: false,
    jump: false,
    zip: false,
    sprint: false,
    walk: false,
    drop: false,
    quick: false,
    rope: false,
    jumpHeld: 0,
    aimT: 99,
  };
  const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
  const has = (c) => keys.has(c) || synthetic.has(c) || tapped.has(c);
  const BTN = { MouseLeft: 1, MouseMiddle: 2, MouseRight: 4 };

  function poll(dt = 1 / 60) {
    let mx = 0,
      my = 0;
    if (has("KeyW") || has("ArrowUp")) my += 1;
    if (has("KeyS") || has("ArrowDown")) my -= 1;
    if (has("KeyD") || has("ArrowRight")) mx += 1;
    if (has("KeyA") || has("ArrowLeft")) mx -= 1;
    let lx = mouse.dx,
      ly = mouse.dy;
    mouse.dx = mouse.dy = 0;
    let btn = mouse.buttons | tappedBtn.v;
    tappedBtn.v = 0;
    for (const [k, b] of Object.entries(BTN)) if (synthetic.has(k)) btn |= b;
    let swing = !!(btn & 4);
    let sprint = has("ShiftLeft") || has("ShiftRight");
    const walk = false; // user r12 Shift-walk DISABLED (user r-nowalk: "disable walking"): Shift = ground parkour / wall-run again
    let jump = has("Space");
    let zip = has("KeyE") || !!(btn & 2);
    let quick = has("KeyQ");
    const rope = has("KeyT");
    let drop = has("KeyC") || has("ControlLeft") || has("ControlRight");
    const ctrl =
      keys.has("ControlLeft") ||
      keys.has("ControlRight") ||
      synthetic.has("ControlLeft") ||
      synthetic.has("ControlRight");
    const slingL = !!(sling.tap & 1),
      slingR = !!(sling.tap & 4);
    sling.tap = 0;
    let usingPad = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || p.mapping !== "standard") continue;
      const ax = dz(p.axes[0]),
        ay = dz(p.axes[1]),
        rx = dz(p.axes[2]),
        ry = dz(p.axes[3]);
      const b = (i) => !!p.buttons[i]?.pressed;
      const rt = (p.buttons[7]?.value ?? 0) > 0.3,
        lt = (p.buttons[6]?.value ?? 0) > 0.3;
      if (ax || ay || rx || ry || rt || lt || b(0) || b(1) || b(3))
        usingPad = true;
      mx += ax;
      my -= ay;
      lx += rx * 900 * dt;
      ly += ry * 600 * dt;
      // L2+R2 = web-zip (R2 then no longer swings); R2 alone = swing in air / parkour on ground
      const zipCombo = lt && rt;
      quick ||= b(4) && !b(5); // L1 alone (L1+R1 = combat throw)
      swing ||= rt && !zipCombo;
      sprint ||= rt && !zipCombo;
      jump ||= b(0);
      zip ||= zipCombo || b(3);
      drop ||= b(1);
    }
    tapped.clear();
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    Object.assign(state, {
      move: { x: mx, y: my },
      look: { dx: lx, dy: ly },
      swing,
      jump,
      zip,
      drop,
      sprint,
      walk,
      quick,
      rope,
      usingPad,
      ctrl,
      slingL,
      slingR,
    });
    for (const k of [
      "swing",
      "jump",
      "zip",
      "drop",
      "sprint",
      "walk",
      "quick",
      "rope",
    ]) {
      state[k + "Pressed"] = state[k] && !prev[k];
      state[k + "Released"] = !state[k] && prev[k];
      prev[k] = state[k];
    }
    state.jumpHeld = jump ? state.jumpHeld + dt : 0;
    state.aimT = Math.abs(lx) + Math.abs(ly) > 1.5 ? 0 : state.aimT + dt;
    return state;
  }

  return {
    keys,
    mouse,
    state,
    poll,
    sling,
    press(code) {
      synthetic.add(code);
    },
    release(code) {
      synthetic.delete(code);
    },
    releaseAll() {
      synthetic.clear();
    },
    consumeMouse() {
      const r = { dx: mouse.dx, dy: mouse.dy };
      mouse.dx = mouse.dy = 0;
      return r;
    },
  };
}
