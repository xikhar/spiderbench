// OWNER: systems engineer. Settings: graphics (quality preset -> reload with ?q=, live render scale), controls
// (mouse sensitivity, invert Y, keybind reference), audio (master / music / sfx / ambience / UI), gameplay (world markers,
// reset progress). Persisted in the save's settings block; applied through sys.applySettings().
export function createSettingsPage(sys) {
  const { save, audio } = sys;
  const el = document.createElement("div");
  el.className = "sys-settings";
  const CATS = [
    ["graphics", "Graphics"],
    ["camera", "Camera"],
    ["controls", "Controls"],
    ["audio", "Audio"],
    ["interface", "Interface"],
    ["gameplay", "Gameplay"],
  ];
  el.innerHTML = `<div class="cats sys-panel cut interactive">${CATS.map(([k, n], i) => `<div class="sys-list-item ${i ? "" : "on"}" data-c="${k}"><b>${n}</b></div>`).join("")}</div>
    <div class="main sys-panel cut interactive sys-scroll"></div>`;
  let cat = "graphics";
  const S = () => save.state.settings;
  const main = el.querySelector(".main");
  const curQ = new URLSearchParams(location.search).get("q") || "high";

  const seg = (key, opts, label, sub) =>
    `<div class="sys-opt"><label>${label}<small>${sub}</small></label><div class="sys-seg" data-k="${key}">${opts.map(([v, n]) => `<button data-v="${v}" class="${String(S()[key]) === String(v) ? "on" : ""}">${n}</button>`).join("")}</div></div>`;
  const range = (
    key,
    min,
    max,
    step,
    label,
    sub,
    fmt = (v) => Math.round(v * 100) + "%",
  ) =>
    `<div class="sys-opt"><label>${label}<small>${sub}</small></label><input type="range" class="sys-range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${S()[key]}"><span class="val" data-v="${key}">${fmt(+S()[key])}</span></div>`;
  const FMT = {
    mouseSensitivity: (v) => v.toFixed(2) + "×",
    renderScale: (v) => Math.round(v * 100) + "%",
    fovOffset: (v) => Math.round(58 + v) + "°",
    hudScale: (v) => Math.round(v * 100) + "%",
    subtitleSize: (v) => Math.round(v * 100) + "%",
  };

  function render() {
    el.querySelectorAll(".cats .sys-list-item").forEach((n) =>
      n.classList.toggle("on", n.dataset.c === cat),
    );
    if (cat === "graphics")
      main.innerHTML = `<div class="sys-h3">Graphics</div>
      ${seg(
        "quality",
        [
          ["low", "Low"],
          ["med", "Medium"],
          ["high", "High"],
        ],
        "Quality Preset",
        `Shadows, AO, clouds, DoF samples. Applying reloads the game (current: ${curQ}).`,
      )}
      ${range("renderScale", 0.6, 1.25, 0.05, "Render Resolution", "Internal resolution scale. Lower for more FPS.", FMT.renderScale)}
      ${seg(
        "timeOfDay",
        [
          ["day", "Day"],
          ["morning", "Morning"],
          ["sunrise", "Sunrise"],
          ["sunset", "Sunset"],
          ["dusk", "Dusk"],
          ["night", "Night"],
          ["overcast", "Overcast"],
        ],
        "Time of Day",
        "Hand-tuned lighting preset",
      )}
      ${seg(
        "daySun",
        [
          ["a", "Midday"],
          ["b", "Late Morning"],
          ["c", "Afternoon"],
        ],
        "Day Sun",
        "Sun direction for the Day preset (shadow angle)",
      )}
      ${seg(
        "puddles",
        [
          ["true", "On"],
          ["false", "Off"],
        ],
        "Puddles",
        "Water and wet patches on the ground in dry weather (rain always wets the streets)",
      )}`;
    // (lighting2 r3) fixed presets (no cycle)
    else if (cat === "camera")
      main.innerHTML = `<div class="sys-h3">Camera</div>
      ${range("fovOffset", -10, 20, 1, "Field of View", "Base chase-camera FOV (speed widens it further)", FMT.fovOffset)}
      ${seg(
        "motionBlur",
        [
          ["0", "Off"],
          ["0.5", "Low"],
          ["1", "Medium"],
          ["1.6", "High"],
          ["2.4", "Very High"],
        ],
        "Motion Blur",
        "Speed blur, stronger the faster you move",
      )}
      ${seg(
        "dof",
        [
          ["0", "Off"],
          ["1", "On"],
        ],
        "Depth of Field",
        "Cinematic focus blur in menus and cutscenes (Photo Mode always has its own control)",
      )}`;
    else if (cat === "interface")
      main.innerHTML = `<div class="sys-h3">Interface</div>
      ${seg(
        "minimalHud",
        [
          ["false", "Off"],
          ["true", "On"],
        ],
        "Minimal HUD",
        "Hide all on-screen UI except the minimap",
      )}
      ${range("hudScale", 0.8, 1.25, 0.05, "HUD Scale", "Minimap, objective, XP and notifications", FMT.hudScale)}
      ${seg(
        "subtitles",
        [
          ["true", "On"],
          ["false", "Off"],
        ],
        "Subtitles",
        "Police scanner and dispatch chatter",
      )}
      ${range("subtitleSize", 0.8, 1.6, 0.1, "Subtitle Size", "Text size of subtitles", FMT.subtitleSize)}
      ${seg(
        "showPins",
        [
          ["true", "On"],
          ["false", "Off"],
        ],
        "World Markers",
        "On-screen icons for towers, crimes and nearby collectibles",
      )}`;
    else if (cat === "controls")
      main.innerHTML = `<div class="sys-h3">Controls</div>
      ${range("mouseSensitivity", 0.2, 3, 0.05, "Camera Sensitivity", "Mouse / right stick look speed", FMT.mouseSensitivity)}
      ${seg(
        "invertY",
        [
          ["false", "Off"],
          ["true", "On"],
        ],
        "Invert Y-Axis",
        "Flip vertical camera look",
      )}
      <div class="sys-h3" style="margin-top:28px">Key Bindings</div>
      <div class="sys-binds"><div class="h">Action</div><div class="h k">Keyboard / Mouse</div><div class="h k">Gamepad</div>
      ${[
        ["Move", "W A S D", "Left Stick"],
        ["Camera", "Mouse", "Right Stick"],
        ["Web-Swing (hold)", "Right Mouse", "R2"],
        ["Parkour (ground) / Wall-Run (walls)", "Shift", "R2"],
        ["Parkour (ground)", "Right Mouse", "R2 (ground)"],
        ["Jump (hold to charge)", "Space", "Cross / A"],
        ["Web-Zip / Point-Launch", "E / Middle Mouse", "L2 + R2"],
        ["Dive / Drop", "C / Ctrl", "Circle / B"],
        ["Quick Web Boost (air)", "Q", "L1 / LB"],
        ["Web Tightrope (perched)", "T, then W / S", "—"],
        ["Web Slingshot (ground)", "Ctrl + Left / Right Mouse", "—"],
        ["Attack / Launcher (combat)", "Left Mouse (hold)", "Square / X"],
        [
          "Dodge (combat)",
          "C / Ctrl · Space jump evades a warning",
          "Circle / B",
        ],
        ["Web Shooter / Web Strike (combat)", "F / E", "R1 / Triangle"],
        ["Throw / Finisher / Heal (combat)", "R / Q / Z", "—"],
        ["Interact / Photograph", "F (hold)", "—"],
        ["Pause Menu", "Esc / P", "Options / Start"],
        ["Map", "M", "Touchpad / View"],
        ["Photo Mode", "V (or pause menu)", "—"],
        ["Controls Help", "H", "—"],
      ]
        .map(
          ([a, k, p]) =>
            `<div>${a}</div><div class="k"><span class="sys-key">${k}</span></div><div class="k" style="color:var(--sys-soft)">${p}</div>`,
        )
        .join("")}</div>`;
    else if (cat === "audio")
      main.innerHTML = `<div class="sys-h3">Audio</div>
      ${range("masterVolume", 0, 1, 0.01, "Master Volume", "Everything")}
      ${range("musicVolume", 0, 1, 0.01, "Music", "Ambient score and the swing pulse")}
      ${range("sfxVolume", 0, 1, 0.01, "Effects", "Web thwips, landings, footsteps, combat, alarms")}
      ${range("ambienceVolume", 0, 1, 0.01, "City Ambience", "Distant horns and sirens")}
      ${range("uiVolume", 0, 1, 0.01, "Interface", "Menus and notifications")}`;
    else
      main.innerHTML = `<div class="sys-h3">Gameplay</div>
      ${seg(
        "crimes",
        [
          ["true", "On"],
          ["false", "Off"],
        ],
        "Random Crimes",
        "Street crimes are reported while you explore",
      )}
      <div class="sys-opt"><label>Reset Progress<small>Erase XP, skills, suits, towers and collectibles. Settings are kept.</small></label><button class="sys-btn rst">Reset</button></div>`;
    main.querySelectorAll(".sys-seg").forEach((sg) =>
      sg.querySelectorAll("button").forEach((b) =>
        b.addEventListener("click", () => {
          const k = sg.dataset.k;
          let v = b.dataset.v;
          if (v === "true" || v === "false") v = v === "true";
          else if (v !== "" && !isNaN(+v)) v = +v;
          if (k === "crimes") {
            sys.crimes.enable(v);
            S().crimesOn = v;
            save.markDirty();
            render();
            audio.sfx.select();
            return;
          }
          S()[k] = v;
          save.markDirty();
          audio.sfx.select();
          if (k === "quality") {
            save.flush();
            if (v !== curQ) {
              const u = new URL(location.href);
              u.searchParams.set("q", v);
              location.href = u.toString();
              return;
            }
          }
          sys.applySettings();
          render();
        }),
      ),
    );
    const crimesSeg = main.querySelector('.sys-seg[data-k="crimes"]');
    if (crimesSeg)
      crimesSeg
        .querySelectorAll("button")
        .forEach((b) =>
          b.classList.toggle(
            "on",
            (b.dataset.v === "true") === sys.crimes.enabled,
          ),
        );
    main.querySelectorAll("input.sys-range").forEach((r) => {
      const upd = () => {
        const k = r.dataset.k;
        S()[k] = +r.value;
        r.style.setProperty(
          "--p",
          ((r.value - r.min) / (r.max - r.min)) * 100 + "%",
        );
        main.querySelector(`[data-v="${k}"]`).textContent = (
          FMT[k] || ((v) => Math.round(v * 100) + "%")
        )(+r.value);
        sys.applySettings();
        save.markDirty();
      };
      r.addEventListener("input", upd);
      r.addEventListener("change", () => audio.sfx.move());
      r.style.setProperty(
        "--p",
        ((r.value - r.min) / (r.max - r.min)) * 100 + "%",
      );
    });
    const rst = main.querySelector(".rst");
    if (rst)
      rst.addEventListener("click", () => {
        if (rst.dataset.armed) {
          save.reset();
          location.reload();
          return;
        }
        rst.dataset.armed = "1";
        rst.textContent = "Click again to confirm";
        rst.classList.add("red");
        audio.sfx.deny();
      });
  }
  el.querySelectorAll(".cats .sys-list-item").forEach((n) => {
    n.addEventListener("click", () => {
      cat = n.dataset.c;
      audio.sfx.move();
      render();
    });
    n.addEventListener("mouseenter", () => audio.sfx.hover());
  });
  return {
    id: "settings",
    title: "Settings",
    el,
    hints: [["Click", "Change"]],
    footer: () =>
      save.persistent
        ? "PROGRESS SAVES AUTOMATICALLY"
        : "TEST SESSION — PROGRESS NOT SAVED",
    show() {
      render();
    },
    key(e) {
      const i = CATS.findIndex((c) => c[0] === cat);
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        cat = CATS[(i + 1) % CATS.length][0];
        audio.sfx.move();
        render();
        return true;
      }
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        cat = CATS[(i - 1 + CATS.length) % CATS.length][0];
        audio.sfx.move();
        render();
        return true;
      }
      return false;
    },
  };
}
