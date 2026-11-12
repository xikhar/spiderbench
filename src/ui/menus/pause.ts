/**
 * Pause menu.
 *
 * @module src-ui-menus-pause
 * @version 1.0.0
 * @file src/ui/menus/pause.ts
 * @since 0.0.1
 * @description Implements the pause menu shell, tabs, and navigation between menu pages.
 */

import { icon } from "./icons";
import { createMapPage } from "./map";
import { createSuitsPage } from "./suits";
import { createSkillsPage } from "./skills";
import { createCollectiblesPage } from "./collectibles";
import { createSettingsPage } from "./settings";

export function createPauseMenu(sys: any) {
    const { ui, audio, flow, prog, save: _save } = sys;
    const el = document.createElement("div");
    el.className = "sys-menu";
    el.innerHTML = `<div class="veil"></div><div class="scan"></div>
    <div class="top"><div class="brand">${icon("spider", { color: "#e3262f" })}<span>SPIDER-MAN</span></div>
      <div class="tabs"><span class="qe"><span class="sys-key">Q</span></span><span class="tl"></span><span class="qe"><span class="sys-key">E</span></span></div>
      <div class="stats"><div class="xpcol"><div class="l"><span class="lv"></span><span class="xn"></span></div><div class="b"><i></i></div></div><div class="sp"></div></div></div>
    <div class="body"></div>
    <div class="foot"><span class="left"></span><span class="hints"></span></div>`;
    ui.root.appendChild(el);
    const body = el.querySelector(".body") as HTMLElement,
        tabsEl = el.querySelector(".tl") as HTMLElement,
        hintsEl = el.querySelector(".hints") as HTMLElement,
        leftEl = el.querySelector(".foot .left") as HTMLElement;

    const pages: any[] = [
        createMapPage(sys),
        createSuitsPage(sys),
        createSkillsPage(sys),
        createCollectiblesPage(sys),
        {
            id: "photo",
            title: "Photo Mode",
            action: () => {
                close(true);
                sys.photo.enter();
                sys.photoUI.open();
            },
        },
        createSettingsPage(sys),
    ];
    for (const p of pages)
        if (p.el) {
            p.el.classList.add("page");
            body.appendChild(p.el);
        }
    tabsEl.innerHTML = pages
        .map((p, i) => `<span class="tab" data-i="${i}">${p.title}</span>`)
        .join("");
    const tabEls = [...tabsEl.querySelectorAll(".tab")] as HTMLElement[];
    tabEls.forEach((t, i) => {
        t.addEventListener("click", () => select(i));
        t.addEventListener("mouseenter", () => audio.sfx.hover());
    });

    let open = false,
        cur = -1,
        last = 0;
    function refreshStats() {
        (el.querySelector(".lv") as HTMLElement).textContent =
            `LEVEL ${prog.level}`;
        (el.querySelector(".xn") as HTMLElement).textContent =
            `${prog.xp} / ${prog.need} XP`;
        (el.querySelector(".xpcol .b i") as HTMLElement).style.width =
            Math.min(100, (prog.xp / prog.need) * 100) + "%";
        const sp = prog.skillPoints;
        const spEl = el.querySelector(".sp") as HTMLElement;
        spEl.textContent = `${sp} SKILL POINT${sp === 1 ? "" : "S"}`;
        spEl.style.visibility = sp ? "" : "hidden";
        tabEls[2].innerHTML =
            "Skills" + (sp ? '<span class="dot"></span>' : "");
    }
    function select(i: number, silent = false) {
        const p = pages[i];
        if (!p) return;
        if (p.action) {
            audio.sfx.select();
            p.action();
            return;
        }
        if (i === cur) return;
        const prev = pages[cur];
        if (prev) {
            prev.el.classList.remove("on");
            prev.hide?.();
        }
        p.el.classList.toggle("from-left", i < cur);
        void p.el.offsetWidth;
        cur = i;
        last = i;
        p.el.classList.add("on");
        p.el.classList.remove("from-left");
        tabEls.forEach((t, k) => t.classList.toggle("on", k === i));
        el.classList.toggle("see-through", !!p.seeThrough);
        hintsEl.innerHTML =
            (p.hints || [])
                .map(
                    ([k, t]: [string, string]) =>
                        `<span><span class="sys-key">${k}</span>${t}</span>`,
                )
                .join("") +
            '<span><span class="sys-key">Esc</span>Resume</span>';
        leftEl.textContent = p.footer?.() || "";
        p.show?.();
        if (!silent) audio.sfx.move();
        flow.setCameraHook(p.camera || null);
    }
    function show(tab?: string | number) {
        const i =
            typeof tab === "string"
                ? pages.findIndex((p) => p.id === tab)
                : (tab ?? last);
        if (!open) {
            open = true;
            flow.setMode("menu");
            ui.setVisible(false);
            el.classList.add("open");
            audio.sfx.open();
            audio.setPaused(true);
            refreshStats();
            cur = -1;
        }
        select((i as number) < 0 ? 0 : (i as number), true);
        (window as any).__sysMenu = { open: true, tab: pages[cur]?.id };
    }
    function close(toPhoto = false) {
        if (!open) return;
        open = false;
        const p = pages[cur];
        p?.el?.classList.remove("on");
        p?.hide?.();
        cur = -1;
        el.classList.remove("open", "see-through");
        audio.setPaused(false);
        if (!toPhoto) ui.setVisible(true);
        if (!toPhoto) {
            audio.sfx.close();
            flow.setMode("play");
        }
        (window as any).__sysMenu = { open: false };
    }
    function step(d: number) {
        let i = cur;
        do {
            i = (i + d + pages.length) % pages.length;
        } while (pages[i].action);
        select(i);
    }

    flow.onKey((e: KeyboardEvent, mode: string) => {
        if (mode === "menu") {
            const p = pages[cur];
            if (p?.key?.(e) === true) return true;
            if (e.code === "Escape" || e.code === "KeyP") {
                if (e.code === "Escape" && p?.back?.() === true) return true;
                close();
                return true;
            }
            if (e.code === "KeyQ") {
                step(-1);
                return true;
            }
            if (e.code === "KeyE") {
                step(1);
                return true;
            }
            if (e.code === "KeyM" && p?.id !== "map") {
                select(0);
                return true;
            }
            return true;
        }
        if (mode === "play") {
            if (e.code === "Escape" || e.code === "KeyP") {
                if (performance.now() - flow.lockLostAt < 400) return true;
                show();
                return true;
            }
            if (e.code === "KeyM") {
                show("map");
                return true;
            }
        }
        return false;
    });
    sys.events.on("flow:lockLost", () => {
        if (!sys.photo.active) show();
    });
    const refreshFoot = () => {
        if (open) {
            refreshStats();
            leftEl.textContent = pages[cur]?.footer?.() || "";
        }
    };
    for (const ev of [
        "xp:gain",
        "skill:unlocked",
        "suit:changed",
        "waypoint:set",
        "collectible:pickup",
        "tower:activated",
        "settings:changed",
    ])
        sys.events.on(ev, refreshFoot);

    const padPrev: Record<number, boolean> = {};
    function pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads) {
            if (!pad || pad.mapping !== "standard") continue;
            const edge = (i: number) => {
                const v = !!pad.buttons[i]?.pressed;
                const was = padPrev[i];
                padPrev[i] = v;
                return v && !was;
            };
            const start = edge(9),
                sel = edge(8),
                lb = edge(4),
                rb = edge(5),
                b = edge(1);
            if (flow.mode === "play") {
                if (start) show();
                else if (sel) show("map");
            } else if (flow.mode === "menu") {
                if (start || (b && pages[cur]?.back?.() !== true)) close();
                else if (lb) step(-1);
                else if (rb) step(1);
            }
            break;
        }
    }

    return {
        el,
        pages,
        show,
        close,
        get open() {
            return open;
        },
        get tab() {
            return pages[cur]?.id;
        },
        update(dt: number) {
            pollPad();
            if (open) pages[cur]?.update?.(dt);
        },
    };
}
