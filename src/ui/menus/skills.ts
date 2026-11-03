// @ts-nocheck
// OWNER: systems engineer. Skill tree screen: two trees (Webslinger / Innovator) of hex nodes with prerequisite
// links, a detail panel with the gameplay effect, and Unlock (1 skill point). Effects land in ctx.params.
import { icon } from "./icons.ts";
import { SKILLS, SKILL_TREES } from "../../game/systems/progression.ts";

export function createSkillsPage(sys) {
  const { prog, audio } = sys;
  const el = document.createElement("div");
  el.className = "sys-skills";
  el.innerHTML = `<div class="trees">${SKILL_TREES.map(
    (
      t,
    ) => `<div class="sys-tree sys-panel cut interactive" data-t="${t.id}"><svg class="links"></svg>
      <div class="sys-h3">${t.name}</div><div class="sys-p" style="font-size:13px;color:var(--sys-dim);max-width:80%">${t.desc}</div><div class="nodes"></div></div>`,
  ).join("")}</div>
    <div class="detail sys-panel cut interactive"><div class="ic"></div><div class="sys-h3 tr"></div><h2 class="sys-h2 nm"></h2><div class="state"></div><p class="sys-p ds"></p><div class="eff"></div>
      <div class="skstats"></div><div class="skstats next"></div>
      <div class="acts"><button class="sys-btn red ub">Unlock · 1 SP</button></div></div>`;
  let sel = SKILLS[0].id;
  function status(s) {
    return prog.has(s.id) ? "owned" : prog.canUnlock(s.id) ? "avail" : "locked";
  }
  function render() {
    for (const tree of el.querySelectorAll(".sys-tree")) {
      const list = SKILLS.filter((s) => s.tree === tree.dataset.t);
      const nodes = tree.querySelector(".nodes");
      nodes.innerHTML = list
        .map(
          (s) =>
            `<div class="sys-node ${status(s)} ${s.id === sel ? "sel" : ""}" data-id="${s.id}" style="left:${s.x * 100}%;top:${s.y * 100}%"><div class="hex"></div>${icon(s.icon, { color: "#fff", sw: 2.2 })}<label>${s.name}</label></div>`,
        )
        .join("");
      nodes.querySelectorAll(".sys-node").forEach((n) => {
        n.addEventListener("click", () => {
          if (sel === n.dataset.id) unlock();
          else {
            sel = n.dataset.id;
            audio.sfx.move();
            render();
          }
        });
        n.addEventListener("mouseenter", () => audio.sfx.hover());
      });
      // links (drawn in tree-panel pixel space after layout)
      requestAnimationFrame(() => {
        const svg = tree.querySelector("svg.links");
        const tr = tree.getBoundingClientRect();
        const nr = nodes.getBoundingClientRect();
        const pos = (s) => [
          nr.left - tr.left + s.x * nr.width,
          nr.top - tr.top + s.y * nr.height,
        ];
        svg.setAttribute("viewBox", `0 0 ${tr.width} ${tr.height}`);
        svg.innerHTML = list
          .flatMap((s) =>
            (s.req || []).map((r) => {
              const a = pos(SKILLS.find((k) => k.id === r)),
                b = pos(s);
              const on = prog.has(r);
              const n = nodes.querySelector(".sys-node").offsetHeight / 2 + 2;
              return `<line x1="${a[0]}" y1="${a[1] + n}" x2="${b[0]}" y2="${b[1] - n}" stroke="${on ? (prog.has(s.id) ? "#e3262f" : "#ffffff") : "rgba(150,170,230,.25)"}" stroke-width="${on ? 2.5 : 1.5}" ${on ? "" : 'stroke-dasharray="5 5"'}/>`;
            }),
          )
          .join("");
      });
    }
    const s = SKILLS.find((k) => k.id === sel),
      stt = status(s);
    el.querySelector(".detail .ic").innerHTML =
      `<div class="sys-node ${stt}" style="position:relative;transform:none;left:0;top:0;width:70px;height:78px"><div class="hex"></div>${icon(s.icon, { color: "#fff", sw: 2.2 })}</div>`;
    el.querySelector(".tr").textContent = SKILL_TREES.find(
      (t) => t.id === s.tree,
    ).name;
    el.querySelector(".nm").textContent = s.name;
    el.querySelector(".ds").textContent = s.desc;
    el.querySelector(".eff").textContent = s.eff;
    const req = (s.req || [])
      .filter((r) => !prog.has(r))
      .map((r) => SKILLS.find((k) => k.id === r).name);
    el.querySelector(".state").textContent =
      stt === "owned"
        ? "Unlocked"
        : stt === "avail"
          ? prog.skillPoints
            ? "Available"
            : "Need a skill point — level up"
          : `Requires ${req.join(" + ")}`;
    // live traversal stats (current vs. with this skill) + what can be unlocked next
    const P = prog.params,
      preview = {};
    if (stt !== "owned") {
      const tmp = { ...P };
      s.apply(tmp);
      Object.assign(preview, tmp);
    }
    const ROWS = [
      ["swingSpeed", "Swing speed"],
      ["swingReleaseBoost", "Release boost"],
      ["webRange", "Web range"],
      ["zipSpeed", "Web-zip"],
      ["pointLaunch", "Point launch"],
      ["jump", "Jump"],
      ["wallRunSpeed", "Wall run"],
      ["diveSpeed", "Dive"],
    ];
    el.querySelector(".skstats:not(.next)").innerHTML =
      '<div class="sys-h3">Traversal</div>' +
      ROWS.map(([k, n]) => {
        const cur = P[k] ?? 1,
          nxt = preview[k] ?? cur,
          sc = (v) => Math.min(1, (v - 1) / 0.5);
        return `<div class="row">${n}<div class="bar"><i style="width:${sc(cur) * 100}%"></i>${nxt > cur ? `<s style="left:${sc(cur) * 100}%;width:${(sc(nxt) - sc(cur)) * 100}%"></s>` : ""}</div><b>${nxt > cur ? `<span style="color:var(--sys-gold)">+${Math.round((nxt - 1) * 100)}%</span>` : `+${Math.round((cur - 1) * 100)}%`}</b></div>`;
      }).join("");
    const avail = SKILLS.filter(
      (k) => prog.canUnlock(k.id) && k.id !== s.id,
    ).slice(0, 4);
    const nx = el.querySelector(".skstats.next");
    nx.innerHTML = avail.length
      ? '<div class="sys-h3" style="margin-top:14px">Available next</div>' +
        avail
          .map(
            (k) =>
              `<div class="nx" data-id="${k.id}">${icon(k.icon, { color: "#fff", sw: 2.2 })}${k.name}</div>`,
          )
          .join("")
      : "";
    nx.querySelectorAll(".nx").forEach((n) =>
      n.addEventListener("click", () => {
        sel = n.dataset.id;
        audio.sfx.move();
        render();
      }),
    );
    const b = el.querySelector(".ub");
    b.disabled = stt !== "avail" || prog.skillPoints < 1;
    b.textContent = stt === "owned" ? "Unlocked" : "Unlock · 1 SP";
  }
  function unlock() {
    if (prog.unlock(sel)) {
      audio.sfx.levelUp();
      sys.ui.toast({
        title: "Skill Unlocked",
        text: SKILLS.find((k) => k.id === sel).name,
        icon: "xp",
        tone: "gold",
        sound: null,
      });
    } else audio.sfx.deny();
    render();
  }
  el.querySelector(".ub").addEventListener("click", unlock);
  function move(dx, dy) {
    const s = SKILLS.find((k) => k.id === sel);
    let best = null,
      bd = Infinity;
    for (const k of SKILLS) {
      if (k === s) continue;
      const ox =
          k.x +
          (k.tree === "innovator" ? 1.2 : 0) -
          (s.x + (s.tree === "innovator" ? 1.2 : 0)),
        oy = k.y - s.y;
      if (dx && Math.sign(ox) !== dx) continue;
      if (dy && Math.sign(oy) !== dy) continue;
      const d = Math.hypot(ox * (dy ? 3 : 1), oy * (dx ? 3 : 1));
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    if (best) {
      sel = best.id;
      audio.sfx.move();
      render();
    }
  }
  return {
    id: "skills",
    title: "Skills",
    el,
    hints: [
      ["Click", "Select"],
      ["Enter", "Unlock"],
    ],
    footer: () =>
      `${prog.skillPoints} SKILL POINT${prog.skillPoints === 1 ? "" : "S"} AVAILABLE`,
    show() {
      render();
    },
    key(e) {
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        move(1, 0);
        return true;
      }
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        move(-1, 0);
        return true;
      }
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        move(0, -1);
        return true;
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        move(0, 1);
        return true;
      }
      if (e.code === "Enter" || e.code === "Space") {
        unlock();
        return true;
      }
      return false;
    },
  };
}
