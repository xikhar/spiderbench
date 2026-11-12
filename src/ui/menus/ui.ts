/**
 * System UI root controller.
 *
 * @module src-ui-menus-ui
 * @version 1.0.0
 * @file src/ui/menus/ui.ts
 * @since 0.0.1
 * @description Creates and manages the shared UI root, toasts, banners, prompts, pins, and menu integration.
 */

import * as THREE from "three";
import "@/ui/systems.css";
import { icon, badge } from "./icons";
import { loadFonts } from "@/ui/fonts";

export { loadFonts };

export interface UIToast {
    title: string;
    text?: string;
    icon?: string;
    count?: string | number;
    tone?: string;
    sound?: string | null;
    ms?: number;
    valid?: (() => boolean) | null;
    maxAge?: number;
    tutorial?: boolean;
}

export interface UICreateArgs {
    camera: THREE.Camera;
    audio?: any;
}

export function createUI({ camera, audio }: UICreateArgs) {
    loadFonts();
    const root =
        document.getElementById("sys-root") ||
        document.body.appendChild(
            Object.assign(document.createElement("div"), { id: "sys-root" }),
        );
    root.innerHTML = `
    <div class="sys-pins"></div>
    <div class="sys-xp"><div class="sys-hex"><svg viewBox="0 0 50 56"><path d="M25 2 L47 14.5 L47 41.5 L25 54 L3 41.5 L3 14.5 Z" fill="rgba(8,15,38,.75)" stroke="#fff" stroke-width="2"/></svg><i>LVL</i><b>1</b></div>
      <div><div class="lbl"><span>EXPERIENCE</span><span class="num"></span></div><div class="bar"><s></s><i></i></div></div><div class="gain"></div></div>
    <div class="sys-obj"><small></small><b></b><span></span></div>
    <div class="sys-toasts"></div>
    <div class="sys-sub"><b></b><span></span></div>
    <div class="sys-banner"><div class="cap"></div><div class="big"></div><div class="sub"></div></div>
    <div class="sys-crime"><small>CRIME IN PROGRESS</small><b></b><div class="meter"><i></i></div><div class="t"></div></div>
    <div class="sys-prompt"><div class="ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.35)" stroke-width="2.5"/><circle class="arc" cx="22" cy="22" r="19" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="119.4" stroke-dashoffset="119.4"/></svg><b>F</b></div><div><span class="lbl"></span><span class="sub"></span></div></div>
    <div class="sys-snap"></div>
    <div class="sys-fade"><div class="tunnel"><div class="lights"></div><div class="rail"></div>
      <svg class="car" viewBox="0 0 520 120" preserveAspectRatio="none"><defs><linearGradient id="sysCar" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c9d3e6"/><stop offset=".55" stop-color="#8793ad"/><stop offset="1" stop-color="#3b4458"/></linearGradient></defs>
        <path d="M18 18 Q20 8 34 8 L500 8 Q512 8 512 20 L512 100 Q512 110 500 110 L20 110 Q8 110 8 98 Z" fill="url(#sysCar)"/>
        <g fill="#0b1226">${Array.from({ length: 7 }, (_, i) => `<rect x="${40 + i * 66}" y="26" width="46" height="34" rx="3"/>`).join("")}</g>
        <g fill="#ffe7a8" opacity=".55">${Array.from({ length: 7 }, (_, i) => `<rect x="${42 + i * 66}" y="28" width="42" height="12" rx="2"/>`).join("")}</g>
        <rect x="8" y="72" width="504" height="6" fill="#e3262f"/><circle cx="470" cy="92" r="4" fill="#fff6c8"/></svg></div>
      <div class="dest"><small>FAST TRAVEL</small><b></b><i></i></div><div class="ld"><span>Loading</span><div class="line"><i></i></div></div></div>`;
    const $ = (s: string) => root.querySelector(s) as HTMLElement;
    const el = {
        pins: $(".sys-pins"),
        xp: $(".sys-xp"),
        xpLvl: $(".sys-xp .sys-hex b") as HTMLElement,
        xpNum: $(".sys-xp .num") as HTMLElement,
        xpBar: $(".sys-xp .bar i") as HTMLElement,
        xpNew: $(".sys-xp .bar s") as HTMLElement,
        xpGain: $(".sys-xp .gain") as HTMLElement,
        toasts: $(".sys-toasts"),
        banner: $(".sys-banner"),
        crime: $(".sys-crime"),
        prompt: $(".sys-prompt") as HTMLElement & {
            _on?: boolean;
            _anch?: boolean;
        },
        fade: $(".sys-fade"),
    };

    const queue: Array<any> = [];
    let active = 0;
    let bannerBusy = false;
    function toast({
        title,
        text = "",
        icon: ic = "xp",
        count = "",
        tone = "",
        sound = "toast",
        ms = 4200,
        valid = null,
        maxAge = 5000,
        tutorial = false,
    }: UIToast) {
        queue.push({
            title,
            text,
            ic,
            count,
            tone,
            sound,
            ms,
            valid,
            at: performance.now(),
            maxAge: tutorial ? 30000 : maxAge,
            tutorial,
        });
        pump();
    }
    let held = false,
        tutOn = false;
    function pump() {
        if (bannerBusy || held) return;
        while (active < 3 && queue.length) {
            if ((queue[0].tutorial && active > 0) || tutOn) break;
            const t = queue.shift();

            if (performance.now() - t.at > t.maxAge || (t.valid && !t.valid()))
                continue;
            active++;
            if (t.tutorial) tutOn = true;
            const d = document.createElement("div");
            d.className = "sys-toast " + t.tone + (t.tutorial ? " tut" : "");
            d.innerHTML = `<div class="ti">${t.ic.startsWith("<") ? t.ic : badge(t.ic, 38)}</div><div><h4></h4><p></p></div><div class="ct"></div>`;
            (d.querySelector("h4") as HTMLElement).textContent = t.title;
            (d.querySelector("p") as HTMLElement).textContent = t.text;
            (d.querySelector(".ct") as HTMLElement).textContent = String(
                t.count ?? "",
            );
            el.toasts.appendChild(d);
            if (t.sound) audio?.sfx?.[t.sound]?.();
            setTimeout(() => {
                d.classList.add("out");
                setTimeout(() => {
                    d.remove();
                    active--;
                    if (t.tutorial) tutOn = false;
                    pump();
                }, 400);
            }, t.ms);
        }
    }

    const bannerQ: Array<any> = [];
    function banner(cap: string, big: string, sub = "", sound = "district") {
        bannerQ.push({ cap, big, sub, sound });
        nextBanner();
    }
    function nextBanner() {
        if (bannerBusy || held || !bannerQ.length) return;
        bannerBusy = true;
        const b = bannerQ.shift();
        ($(".sys-banner .cap") as HTMLElement).textContent = b.cap;
        ($(".sys-banner .big") as HTMLElement).textContent = b.big;
        ($(".sys-banner .sub") as HTMLElement).textContent = b.sub;
        el.banner.classList.remove("on");
        void (el.banner as HTMLElement).offsetWidth;
        el.banner.classList.add("on");
        el.toasts.classList.add("dim");
        if (b.sound) audio?.sfx?.[b.sound]?.();
        setTimeout(() => {
            el.banner.classList.remove("on");
            bannerBusy = false;
            if (!bannerQ.length) el.toasts.classList.remove("dim");
            nextBanner();
            pump();
        }, 4300);
    }

    let xpHide = 0,
        gainSum = 0;
    function xp({
        level,
        xp: cur,
        need,
        gain = 0,
        leveled = false,
    }: {
        level: number;
        xp: number;
        need: number;
        gain?: number;
        leveled?: boolean;
    }) {
        el.xpLvl.textContent = String(level);
        el.xpNum.textContent = `${cur} / ${need}`;
        const before = leveled ? 0 : Math.max(0, cur - gain),
            barGain = Math.min(gain, cur - before);
        el.xpBar.style.width = Math.min(1, before / need) * 100 + "%";
        el.xpNew.style.left = Math.min(1, before / need) * 100 + "%";
        el.xpNew.style.width = Math.min(1, barGain / need) * 100 + "%";
        requestAnimationFrame(() =>
            setTimeout(() => {
                el.xpBar.style.width = Math.min(1, cur / need) * 100 + "%";
                el.xpNew.style.width = "0%";
                el.xpNew.style.left = el.xpBar.style.width;
            }, 350),
        );
        if (gain) {
            gainSum = (xpHide > 0 ? gainSum : 0) + gain;
            el.xpGain.textContent = `+${gainSum} XP`;
            el.xpGain.classList.remove("pop");
            void (el.xpGain as HTMLElement).offsetWidth;
            el.xpGain.classList.add("pop");
        }
        el.xp.classList.add("on");
        xpHide = 4.5;
    }

    let promptKey = "",
        promptOff = "",
        promptPos = "",
        promptArc: SVGCircleElement | null = null;
    function prompt(p: any) {
        promptArc =
            promptArc || ($(".sys-prompt .arc") as unknown as SVGCircleElement);
        if (!p) {
            if (el.prompt._on) {
                el.prompt._on = false;
                el.prompt.classList.remove("on");
                promptKey = "";
            }
            return;
        }
        const k = p.label + "|" + (p.sub || "") + "|" + (p.key || "F");
        if (k !== promptKey) {
            promptKey = k;
            ($(".sys-prompt .lbl") as HTMLElement).textContent = p.label;
            ($(".sys-prompt .sub") as HTMLElement).textContent = p.sub || "";
            ($(".sys-prompt .ring b") as HTMLElement).textContent =
                p.key || "F";
        }
        const off = (119.4 * (1 - (p.progress || 0))).toFixed(1);
        if (off !== promptOff) {
            promptOff = off;
            promptArc.style.strokeDashoffset = off;
        }

        let anchored = false;
        if (p.pos) {
            _p.copy(p.pos).applyMatrix4(camera.matrixWorldInverse);
            if (_p.z < -0.5) {
                _p.applyMatrix4(camera.projectionMatrix);
                if (Math.abs(_p.x) < 0.85 && Math.abs(_p.y) < 0.8) {
                    const sx = (_p.x * 0.5 + 0.5) * innerWidth + 26,
                        sy = (-_p.y * 0.5 + 0.5) * innerHeight;
                    const pk =
                        Math.min(innerWidth - 320, sx).toFixed(0) +
                        "|" +
                        Math.max(80, Math.min(innerHeight * 0.62, sy)).toFixed(
                            0,
                        );
                    if (pk !== promptPos) {
                        promptPos = pk;
                        const [l, t] = pk.split("|");
                        (el.prompt.style as any).left = l + "px";
                        (el.prompt.style as any).top = t + "px";
                        (el.prompt.style as any).bottom = "auto";
                    }
                    anchored = true;
                }
            }
        }
        if (!anchored && promptPos !== "free") {
            promptPos = "free";
            (el.prompt.style as any).left = "";
            (el.prompt.style as any).top = "";
            (el.prompt.style as any).bottom = "";
        }
        if (el.prompt._anch !== anchored) {
            el.prompt._anch = anchored;
            el.prompt.classList.toggle("anchored", anchored);
        }
        if (!el.prompt._on) {
            el.prompt._on = true;
            el.prompt.classList.add("on");
        }
    }

    const crimeEls = {
            b: $(".sys-crime b"),
            t: $(".sys-crime .t"),
            s: $(".sys-crime small"),
            m: $(".sys-crime .meter i") as HTMLElement,
        },
        crimeLast: Record<string, any> = {};
    const setText = (k: string, e: HTMLElement, v: string) => {
        if (crimeLast[k] !== v) {
            crimeLast[k] = v;
            if (k === "m") e.style.width = v;
            else e.textContent = v;
        }
    };
    function crime(c: any) {
        if (!c) {
            if (crimeLast.on) {
                crimeLast.on = false;
                el.crime.classList.remove("on");
            }
            return;
        }
        setText("b", crimeEls.b, c.title);
        setText("t", crimeEls.t, c.text || "");
        setText("s", crimeEls.s, c.caption || "CRIME IN PROGRESS");
        setText("m", crimeEls.m, ((c.meter ?? 1) * 100).toFixed(1) + "%");
        if (!crimeLast.on) {
            crimeLast.on = true;
            el.crime.classList.add("on");
        }
    }

    const subQ: Array<{ who: string; text: string; ms: number }> = [];
    let subBusy = false;
    let subsOn: () => boolean = () => true;
    function subtitle(who: string, text: string, ms = 3600) {
        if (!subsOn()) return;
        subQ.push({ who, text, ms });
        nextSub();
    }
    function nextSub() {
        if (subBusy || !subQ.length) return;
        subBusy = true;
        const l = subQ.shift()!,
            e = $(".sys-sub");
        (e.querySelector("b") as HTMLElement).textContent = l.who
            ? l.who + ":"
            : "";
        (e.querySelector("span") as HTMLElement).textContent = l.text;
        e.classList.add("on");
        setTimeout(() => {
            e.classList.remove("on");
            setTimeout(() => {
                subBusy = false;
                nextSub();
            }, 350);
        }, l.ms);
    }

    let objKey = "",
        objDist = "";
    function objective(o: any) {
        const e = $(".sys-obj");
        if (!o) {
            if (objKey) {
                e.classList.remove("on");
                objKey = "";
            }
            return;
        }
        const k = o.cap + "|" + o.text;
        if (k !== objKey) {
            if (!objKey) e.classList.add("on");
            objKey = k;
            (e.querySelector("small") as HTMLElement).textContent = o.cap;
            (e.querySelector("b") as HTMLElement).textContent = o.text;
        }
        const dt =
            o.dist != null
                ? o.dist > 1000
                    ? (o.dist / 1000).toFixed(1) + " KM"
                    : Math.round(o.dist / 5) * 5 + " M"
                : "";
        if (dt !== objDist) {
            objDist = dt;
            (e.querySelector("span") as HTMLElement).textContent = dt;
        }
    }
    function flash() {
        const f = $(".sys-snap");
        f.classList.remove("go");
        void (f as HTMLElement).offsetWidth;
        f.classList.add("go");
    }

    function fade(on: boolean, dest = "", sub = "") {
        if (dest) {
            ($(".sys-fade .dest b") as HTMLElement).textContent = dest;
            ($(".sys-fade .dest i") as HTMLElement).textContent = sub;
        }
        el.fade.classList.toggle("on", on);
    }

    const pinPool: Array<HTMLElement & any> = [];
    const _p = new THREE.Vector3();
    function pins(list: any[], visible = true) {
        let n = 0;
        if (visible)
            for (const it of list) {
                _p.copy(it.pos).applyMatrix4(camera.matrixWorldInverse);
                const behind = _p.z > -0.1;
                _p.applyMatrix4(camera.projectionMatrix);
                let x = _p.x,
                    y = _p.y;
                let edge = false;
                if (behind) {
                    if (!it.edge) continue;
                    x = -x;
                    y = -y;
                }
                if (Math.abs(x) > 0.94 || Math.abs(y) > 0.9 || behind) {
                    if (!it.edge) continue;
                    edge = true;
                    const m = Math.max(
                        Math.abs(x) / 0.94,
                        Math.abs(y) / 0.88,
                        1e-3,
                    );
                    x /= m;
                    y /= m;
                }
                let d = pinPool[n];
                if (!d) {
                    d = document.createElement("div");
                    d.className = "sys-pin";
                    d.innerHTML = '<div class="ic"></div><div class="d"></div>';
                    el.pins.appendChild(d);
                    pinPool[n] = d;
                    d._kind = "";
                }
                if (d._kind !== it.kind) {
                    d._kind = it.kind;
                    (d.querySelector(".ic") as HTMLElement).innerHTML =
                        it.kind === "label" ? "" : badge(it.kind, 34);
                    d.className =
                        "sys-pin " +
                        (it.cls || "") +
                        (it.kind === "label" ? " noicon" : "");
                }
                if (d._edge !== edge) {
                    d._edge = edge;
                    d.classList.toggle("edge", edge);
                }
                const sx = (x * 0.5 + 0.5) * innerWidth,
                    sy = (-y * 0.5 + 0.5) * innerHeight;
                const s = it.scale ?? 1;
                const tf = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) scale(${s.toFixed(2)})`;
                if (d._tf !== tf) {
                    d._tf = tf;
                    d.style.transform = tf;
                }
                const al = it.alpha ?? 1;
                if (d._al !== al) {
                    d._al = al;
                    d.style.opacity = String(al);
                }
                if (d._hid) {
                    d._hid = false;
                    d.style.display = "";
                }
                const txt =
                    it.label ??
                    (it.dist != null ? `${Math.round(it.dist)}m` : "");
                const dd = d.querySelector(".d") as HTMLElement;
                if (dd.textContent !== txt) dd.textContent = txt;
                n++;
            }
        for (let i = n; i < pinPool.length; i++)
            if (!pinPool[i]._hid) {
                pinPool[i]._hid = true;
                pinPool[i].style.display = "none";
            }
    }

    return {
        root,
        toast,
        banner,
        xp,
        prompt,
        crime,
        fade,
        pins,
        icon,
        flash,
        objective,
        subtitle,
        setSubtitleGate(fn: () => boolean) {
            subsOn = fn;
        },
        setVisible(v: boolean) {
            root.querySelectorAll(
                ".sys-pins,.sys-xp,.sys-toasts,.sys-crime,.sys-prompt,.sys-banner,.sys-obj,.sys-sub",
            ).forEach((e) => {
                (e as HTMLElement).style.visibility = v ? "" : "hidden";
            });
            const was = held;
            held = !v;
            if (was && !held) {
                const now = performance.now();
                for (const t of queue) t.at = now;
                setTimeout(() => {
                    nextBanner();
                    pump();
                }, 350);
            }
        },
        update(dt: number) {
            if (xpHide > 0) {
                xpHide -= dt;
                if (xpHide <= 0) el.xp.classList.remove("on");
            }
        },
    };
}
