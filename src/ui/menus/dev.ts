// @ts-nocheck
// Developer menu: ~ (Backquote) toggles a small panel with click toggles for testing
// features without playing up to them. Available on the dev server (import.meta.env.DEV) or with ?dev.
//   createDevMenu(sys) -> { open, close, toggle, items }
// Opening frees the mouse cursor (pointer lock off, without the lock-loss pause: flow.overlay); ~ / Esc closes it, and
// clicking back into the game (pointer lock regained) closes it too. The game keeps running underneath.
// Items: { id, label, on() -> bool, toggle(), status() -> string }. Add more to ITEMS below.
import { createReel } from "../../game/systems/reel.ts";

const CSS = `
#dev-menu{position:fixed;left:50%;top:14px;margin-left:calc(min(340px,100vw - 24px) / -2);z-index:60;width:min(340px,calc(100vw - 24px));
  font-family:var(--sys-body,'Spiderbench Sans',system-ui,sans-serif);color:#eef2fb;background:rgba(9,13,26,.86);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(160,188,255,.18);border-radius:10px;
  box-shadow:0 18px 50px rgba(0,0,0,.45);opacity:0;transform:translateY(-6px);pointer-events:none;transition:opacity .15s,transform .15s;user-select:none}
#dev-menu.on{opacity:1;transform:none;pointer-events:auto}
#dev-menu header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;border-bottom:1px solid rgba(160,188,255,.12)}
#dev-menu header b{font:800 12px/1 var(--sys-head,'Spiderbench Condensed',sans-serif);letter-spacing:.32em;color:#fff}
#dev-menu header b i{font-style:normal;color:#e3262f}
#dev-menu header span{font:600 11px/1 inherit;color:rgba(200,212,240,.6);letter-spacing:.04em}
#dev-menu header kbd{font:700 10px/1 inherit;border:1px solid rgba(200,212,240,.4);border-radius:3px;padding:2px 5px;margin-right:4px}
#dev-menu .items{padding:6px}
#dev-menu .item{display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:7px;cursor:pointer}
#dev-menu .item:hover{background:rgba(160,188,255,.08)}
#dev-menu .item .txt{flex:1;min-width:0}
#dev-menu .item .lbl{font:650 14px/1.2 inherit}
#dev-menu .item .st{font:500 12px/1.3 inherit;color:rgba(200,212,240,.66);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#dev-menu .item.busy .st{color:#f5b82e}
#dev-menu .sw{position:relative;flex:none;width:38px;height:22px;border-radius:11px;background:rgba(160,188,255,.2);transition:background .15s}
#dev-menu .sw::after{content:'';position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s;box-shadow:0 1px 3px rgba(0,0,0,.4)}
#dev-menu .item.onx .sw{background:#e3262f}
#dev-menu .item.onx .sw::after{transform:translateX(16px)}
#dev-menu .rg{display:block;width:100%;margin:9px 0 2px;accent-color:#e3262f;cursor:pointer}
`;

export function createDevMenu(sys) {
  const { ctx, flow } = sys;
  const P = ctx.player;
  const reel = (sys.reel = createReel(sys)); // cinematic demo reel (game/systems/reel.ts)
  const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  let note = ""; // last one-off message for the robbery item (spawn failed, cleared, ...)
  const robbery = () => {
    const c = sys.crimes.active;
    return c && c.dev && c.type === "bankAlarm" ? c : null;
  };
  // smooth mouse camera (kept across sessions): slider 0..100 % -> glide time constant 30..450 ms
  const LOOK_KEY = "spiderbench.dev.smoothLook";
  const look = (() => {
    try {
      return {
        on: false,
        v: 50,
        ...JSON.parse(localStorage.getItem(LOOK_KEY) || "{}"),
      };
    } catch {
      return { on: false, v: 50 };
    }
  })();
  const lookTau = () => 0.03 + 0.42 * (look.v / 100) ** 1.6;
  const applyLook = () => {
    if (P.cam) P.cam.lookSmooth = look.on ? lookTau() : 0;
    try {
      localStorage.setItem(
        LOOK_KEY,
        JSON.stringify({ on: look.on, v: look.v }),
      );
    } catch {}
  };
  applyLook();

  const ITEMS = [
    {
      id: "robbery",
      label: "Robbery fight nearby",
      on: () => !!robbery(),
      toggle() {
        if (robbery()) {
          sys.crimes.cancel();
          note = "Removed";
          return;
        }
        if (sys.crimes.active) sys.crimes.cancel(); // a random crime in progress makes room
        const fwd = P.cam?.forwardFlat?.();
        const c = sys.crimes.spawn("bankAlarm", { near: true, fwd, dev: true });
        note = c ? "" : "No street nearby: move closer to an avenue";
      },
      status() {
        const c = robbery();
        if (!c) return note || "Off: spawns a bank robbery 30-60 m away";
        const d = Math.round(hdist(P.position, c.pos));
        if (c.claimed)
          return c.cmbTotal
            ? `Fighting · ${c.cmbLeft} of ${c.cmbTotal} left`
            : "Fighting";
        if (c.state === "engaged") return "Starting the fight…";
        return `Bank robbery · ${d} m away`;
      },
    },
    {
      id: "reel",
      label: "Cinematic demo reel",
      on: () => reel.active,
      toggle() {
        if (reel.active) reel.stop();
        else {
          close(false);
          reel.start();
        }
      }, // the panel closes so it never shows in a recording
      status: () => reel.status(),
    },
    {
      // smooth mouse camera: the chase camera's look is eased (camera.ts c.lookSmooth); on / off + a smoothness slider
      id: "smoothLook",
      label: "Smooth mouse camera",
      on: () => look.on,
      toggle() {
        look.on = !look.on;
        applyLook();
      },
      status: () =>
        look.on
          ? `On · smoothness ${look.v} % (${Math.round(lookTau() * 1000)} ms glide)`
          : "Off: the camera follows the mouse 1:1",
      slider: {
        min: 0,
        max: 100,
        step: 1,
        get: () => look.v,
        set: (v) => {
          look.v = v;
          applyLook();
        },
      },
    },
  ];
  const endNote = (txt) => (cr) => {
    if (cr?.dev) note = txt;
  };
  sys.events.on("crime:resolved", endNote("Cleared ✓"));
  sys.events.on("crime:failed", endNote("Failed"));
  sys.events.on("crime:expired", endNote("Expired"));

  if (!document.getElementById("dev-menu-css")) {
    const st = document.createElement("style");
    st.id = "dev-menu-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const root = document.createElement("div");
  root.id = "dev-menu";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Developer menu");
  root.innerHTML = `<header><b>DEV<i>.</i></b><span><kbd>~</kbd>close</span></header><div class="items"></div>`;
  document.body.appendChild(root);
  // clicks on the panel never reach the game (attack / swing / pointer lock listeners on window and the canvas)
  for (const ev of [
    "mousedown",
    "mouseup",
    "pointerdown",
    "click",
    "auxclick",
    "wheel",
    "contextmenu",
  ])
    root.addEventListener(ev, (e) => e.stopPropagation());
  const list = root.querySelector(".items");
  const rows = ITEMS.map((it) => {
    const el = document.createElement("div");
    el.className = "item";
    el.setAttribute("role", "switch"); // (not a <button>: a focused button would take Space = jump)
    el.innerHTML = `<div class="txt"><div class="lbl"></div><div class="st"></div></div><div class="sw"></div>`;
    el.querySelector(".lbl").textContent = it.label;
    el.addEventListener("click", () => {
      try {
        it.toggle();
      } catch (e) {
        console.error("[dev]", it.id, e);
        note = "Error: see console";
      }
      refresh();
    });
    if (it.slider) {
      // a range under the label; dragging it never toggles the row (arrow keys on it never reach the game: it is an INPUT)
      const S = it.slider,
        rg = document.createElement("input");
      rg.type = "range";
      rg.min = S.min;
      rg.max = S.max;
      rg.step = S.step;
      rg.value = S.get();
      rg.className = "rg";
      for (const ev of ["click", "pointerdown", "mousedown"])
        rg.addEventListener(ev, (e) => e.stopPropagation());
      rg.addEventListener("input", () => {
        S.set(+rg.value);
        refresh();
      });
      el.querySelector(".txt").appendChild(rg);
    }
    list.appendChild(el);
    return { it, el, st: el.querySelector(".st") };
  });
  function refresh() {
    for (const r of rows) {
      const on = !!r.it.on();
      r.el.classList.toggle("onx", on);
      r.el.setAttribute("aria-checked", on);
      const s = r.it.status();
      if (r.st.textContent !== s) r.st.textContent = s;
      r.el.classList.toggle("busy", on);
    }
  }

  let isOpen = false,
    timer = 0;
  function open() {
    if (isOpen) return;
    isOpen = true;
    flow.overlay = true; // the cursor is freed on purpose: no pause menu
    try {
      document.exitPointerLock?.();
    } catch {}
    note = robbery() ? "" : note;
    refresh();
    timer = setInterval(refresh, 250);
    root.classList.add("on");
  }
  function close(relock = true) {
    if (!isOpen) return;
    isOpen = false;
    clearInterval(timer);
    root.classList.remove("on");
    if (relock && !document.pointerLockElement) {
      try {
        ctx.renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
      } catch {}
    }
    flow.overlay = false;
  }
  flow.onKey((e, mode) => {
    if (e.code === "Backquote" && !e.repeat && mode === "play") {
      if (isOpen) close();
      else open();
      return true;
    }
    if (isOpen && e.code === "Escape") {
      close(false);
      return true;
    }
    return false;
  });
  // clicking back into the game takes the pointer lock: the panel gets out of the way
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement && isOpen) close(false);
  });
  sys.events.on("flow:mode", ({ mode }) => {
    if (mode !== "play") close(false);
  });

  const api = {
    open,
    close,
    toggle: () => (isOpen ? close() : open()),
    items: ITEMS,
    get isOpen() {
      return isOpen;
    },
  };
  window.__dev = api;
  return api;
}
