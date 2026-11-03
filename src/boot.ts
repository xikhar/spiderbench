// Boot progress (window.__boot), used by src/main.ts and src/world/city.ts:
//   __boot.stage(name) -> Promise (resolves after the label painted)   __boot.sub(0..1) progress inside the stage
//   __boot.done()      fade out and remove
// Stage durations are remembered per machine (localStorage 'spiderbench.boot'): the bar eases toward the expected end of the
// current stage on the compositor, so it keeps moving while a stage blocks the main thread. ?shot / ?playtest: no screen.
(() => {
  const el = document.getElementById("boot");
  const noop = async (): Promise<void> => {};
  if (!(el instanceof HTMLElement)) {
    window.__boot = { stage: noop, sub() {}, done() {} };
    return;
  }
  const bootElement = el;
  const q = new URLSearchParams(location.search);
  if (q.has("shot") || q.has("playtest") || q.has("noboot")) {
    el.remove();
    window.__boot = { stage: noop, sub() {}, done() {} };
    return;
  }
  const LABELS: Record<string, string> = {
    boot: "Starting",
    tex: "Loading textures",
    gen: "Laying out the streets",
    build: "Raising the skyline",
    ground: "Paving the streets",
    props: "Parking the traffic",
    life: "Bringing the city to life",
    coll: "Mapping every surface",
    player: "Suiting up",
    shaders: "Compiling shaders",
    frame: "Swinging in",
  };
  const ORDER = Object.keys(LABELS);
  // defaults (ms) measured on the dev machine; replaced by this machine's last load
  const DEF: Record<string, number> = {
    boot: 1400,
    tex: 800,
    gen: 4600,
    build: 7200,
    ground: 2300,
    props: 1300,
    life: 1250,
    coll: 2400,
    player: 800,
    shaders: 8200,
    frame: 3600,
  };
  let T: Record<string, number> = { ...DEF };
  try {
    Object.assign(
      T,
      JSON.parse(
        localStorage.getItem("spiderbench.boot") ||
          localStorage.getItem("spidey.boot") ||
          "{}",
      ),
    );
    localStorage.removeItem("spidey.boot");
  } catch (e) {
    /* private mode */
  }
  const total = ORDER.reduce((s, k) => s + (T[k] ?? 0), 0);
  const startOf = (k: string) =>
    ORDER.slice(0, ORDER.indexOf(k)).reduce((s, n) => s + (T[n] ?? 0), 0) /
    total;
  const bar = bootElement.querySelector<HTMLElement>(".bar i")!,
    lbl = bootElement.querySelector<HTMLElement>(".lbl")!;
  const seen: Record<string, number> = {};
  let cur: string | null = null,
    curAt = 0,
    frac = 0,
    act = 0; // act: last sign of progress (stage or sub)
  const set = (f: number, ms: number, ease: string) => {
    frac = Math.max(frac, Math.min(1, f));
    bar.style.transition = `transform ${ms | 0}ms ${ease}`;
    bar.style.transform = `scaleX(${frac.toFixed(4)})`;
    bootElement.setAttribute("aria-valuenow", String(Math.round(frac * 100)));
  };
  // let the label / bar paint before the next blocking step: two frames, but never wait on rAF in a background tab (it does
  // not run there and the load would stall until the tab is shown), and never more than 250 ms
  const raf2 = (): Promise<void> =>
    new Promise<void>((r) => {
      if (document.hidden) {
        setTimeout(r, 0);
        return;
      }
      let done = false;
      const go = () => {
        if (!done) {
          done = true;
          r();
        }
      };
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setTimeout(go, 0)),
      );
      setTimeout(go, 250);
    });
  function stage(name: string): Promise<void> {
    const now = performance.now();
    if (cur) seen[cur] = now - curAt;
    cur = name;
    curAt = act = now;
    if (!(name in LABELS)) return raf2();
    lbl.textContent = LABELS[name] ?? name;
    const s = startOf(name),
      e = s + (T[name] ?? 0) / total;
    set(s, 260, "ease-out"); // catch up to the stage start
    requestAnimationFrame(() =>
      set(
        s + (e - s) * 0.94,
        (T[name] ?? 0) * 1.15,
        "cubic-bezier(.3,.6,.4,1)",
      ),
    ); // then creep toward its end
    return raf2();
  }
  function sub(k: number) {
    // measured progress inside the current stage (shader links)
    if (!cur || !(cur in LABELS)) return;
    act = performance.now();
    const s = startOf(cur),
      e = s + (T[cur] ?? 0) / total;
    set(s + (e - s) * Math.max(0, Math.min(1, k)), 180, "ease-out");
  }
  let finished = false;
  function done() {
    if (finished) return;
    finished = true;
    if (cur) seen[cur] = performance.now() - curAt;
    try {
      const m: Record<string, number> = {};
      for (const k of ORDER)
        m[k] = Math.round(
          seen[k] != null
            ? ((T[k] ?? 0) + 2 * seen[k]) / 3
            : (T[k] ?? 0),
        );
      localStorage.setItem("spiderbench.boot", JSON.stringify(m));
    } catch (e) {
      /* ignore */
    }
    set(1, 300, "ease-out");
    setTimeout(() => {
      bootElement.classList.add("out");
      setTimeout(() => bootElement.remove(), 1000);
    }, 350);
  }
  window.__boot = {
    stage,
    sub,
    done,
    get timings() {
      return { ...seen };
    },
  } as BootProgress & { readonly timings: Record<string, number> };
  // a failed start never leaves the screen loading forever. The error message is shown on the screen: at once when it is
  // certainly fatal (no WebGL, a script that failed to load, anything before the first loading stage), otherwise after
  // 8 s without any progress (a harmless error in an optional module while loading carries on is ignored)
  const msgEl = bootElement.querySelector<HTMLElement>(".msg")!;
  const showErr = (m: string) => {
    if (finished) return;
    bootElement.classList.add("err");
    lbl.textContent = "Could not start";
    msgEl.textContent =
      (m || "Unknown error") + " — details in the browser console";
  };
  const fail = (m: string, fatal: boolean) => {
    if (finished) return;
    if (fatal || cur === "boot") {
      showErr(m);
      return;
    }
    const at = act;
    setTimeout(() => {
      if (act === at) showErr(m);
    }, 8000);
  };
  const msgOf = (e: unknown) => {
    const message = (e as { message?: unknown } | null)?.message;
    return String(message || e || "").slice(0, 240);
  };
  addEventListener(
    "error",
    (e) => {
      if (e.target instanceof HTMLScriptElement) {
        fail("Could not load " + (e.target.src || "a script"), true);
        return;
      }
      if (e.target === window || !e.target) {
        const m = msgOf(e.error) || msgOf(e);
        fail(m, /webgl|context/i.test(m));
      }
    },
    true,
  );
  addEventListener("unhandledrejection", (e) => {
    const m = msgOf(e.reason);
    fail(m, /webgl|context/i.test(m));
  });
  stage("boot");
})();
