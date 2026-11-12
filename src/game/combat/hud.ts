/**
 * Combat HUD.
 *
 * @module src-game-combat-hud
 * @version 1.0.0
 * @file src/game/combat/hud.ts
 * @since 0.0.1
 * @description Displays combat-specific UI such as prompts, meters, and encounter feedback.
 */

import * as THREE from "three";
import { clamp } from "./util";

const CSS = `
#cmb-hud{position:fixed;inset:0;pointer-events:none;z-index:25;font-family:var(--sys-head,'Barlow Condensed','Arial Narrow',sans-serif);color:#fff;opacity:0;transition:opacity .45s}
#cmb-hud.on{opacity:1}
#cmb-hud .bars{position:absolute;left:2.2vw;top:3.2vh;width:min(24vw,360px);padding:9px 12px 10px;background:linear-gradient(90deg,rgba(7,13,31,.72),rgba(7,13,31,0));clip-path:polygon(0 0,100% 0,100% 100%,14px 100%,0 calc(100% - 14px))}
#cmb-hud .hp{position:relative;height:15px;transform:skewX(-18deg);background:rgba(8,12,28,.62);box-shadow:0 0 0 1.5px rgba(255,255,255,.55),0 3px 12px rgba(0,0,0,.45);overflow:hidden}
#cmb-hud .hp i{position:absolute;left:0;top:0;bottom:0;width:100%;transform-origin:0 50%}
#cmb-hud .hp .trail{background:#fff}
#cmb-hud .hp .fill{background:linear-gradient(180deg,#ff4a4f,#d0141d 55%,#a20d15)}
#cmb-hud .hp.low .fill{animation:cmbLow .6s ease-in-out infinite}
@keyframes cmbLow{50%{filter:brightness(1.6)}}
#cmb-hud .lbl{display:flex;justify-content:space-between;font:700 12px/1 var(--sys-head,sans-serif);letter-spacing:.2em;color:#d7e0ff;margin:0 0 5px 2px;text-shadow:0 1px 3px #000}
#cmb-hud .focus{display:flex;gap:5px;margin-top:7px;width:78%}
#cmb-hud .focus b{position:relative;flex:1;height:9px;transform:skewX(-18deg);background:rgba(8,12,28,.6);box-shadow:0 0 0 1px rgba(255,255,255,.45);overflow:hidden}
#cmb-hud .focus b i{position:absolute;inset:0;background:linear-gradient(180deg,#fff,#cfe6ff);transform-origin:0 50%}
#cmb-hud .focus b.full{box-shadow:0 0 0 1px #fff,0 0 12px rgba(160,210,255,.9)}
#cmb-hud .combo{position:absolute;right:4.5vw;top:38vh;text-align:right;opacity:0;transition:opacity .25s;text-shadow:0 2px 8px rgba(0,0,0,.6)}
#cmb-hud .combo.on{opacity:1}
#cmb-hud .combo .n{font:800 64px/0.9 var(--sys-head,sans-serif);letter-spacing:.02em}
#cmb-hud .combo .n small{font-size:.45em;margin-right:4px;color:#ffb3b5}
#cmb-hud .combo .t{font:700 14px/1 var(--sys-head,sans-serif);letter-spacing:.35em;color:#dfe6ff;margin-top:4px}
#cmb-hud .combo .bar{height:3px;background:#e3262f;margin-top:8px;transform-origin:100% 50%}
#cmb-hud .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(200,0,10,.55) 100%);opacity:0}
#cmb-hud .slow{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 50%,rgba(40,90,190,.35) 100%);opacity:0;transition:opacity .2s}
#cmb-hud .banner{position:absolute;left:50%;top:27vh;transform:translateX(-50%) scale(.9);font:800 30px/1 var(--sys-head,sans-serif);letter-spacing:.3em;opacity:0;transition:opacity .2s,transform .2s;text-shadow:0 2px 10px rgba(0,40,120,.8);white-space:nowrap}
#cmb-hud .banner.on{opacity:1;transform:translateX(-50%) scale(1)}
#cmb-hud .msg{position:absolute;left:50%;bottom:22vh;transform:translateX(-50%);font:600 17px/1 var(--sys-head,sans-serif);letter-spacing:.15em;text-transform:uppercase;opacity:0;transition:opacity .25s;text-shadow:0 1px 4px #000}
#cmb-hud .msg.on{opacity:.95}
#cmb-hud .arrows i{position:absolute;left:0;top:0;width:0;height:0;will-change:transform}
#cmb-hud .arrows i:before{content:'';position:absolute;left:-15px;top:-11px;border-left:30px solid currentColor;border-top:11px solid transparent;border-bottom:11px solid transparent;filter:drop-shadow(0 0 6px currentColor)}
#cmb-hud .ebar{position:absolute;left:0;top:0;width:90px;height:6px;margin-left:-45px;background:rgba(0,0,0,.55);box-shadow:0 0 0 1px rgba(255,255,255,.6);transform:skewX(-18deg);opacity:0}
#cmb-hud .ebar i{position:absolute;inset:0;background:#e3262f;transform-origin:0 50%}
#cmb-hud .ebar.stun i{background:#f5b82e}
#cmb-hud .hint{position:absolute;left:50%;bottom:3vh;transform:translateX(-50%);width:max-content;max-width:min(58vw,760px);display:flex;flex-wrap:wrap;justify-content:center;gap:9px 16px;font:600 13px/1 var(--sys-body,sans-serif);letter-spacing:.06em;opacity:0;transition:opacity .8s;white-space:nowrap;text-shadow:0 1px 3px #000}
#cmb-hud .hint.on{opacity:.92}
#cmb-hud .hint span{display:flex;align-items:center;gap:6px}
#cmb-hud .hint kbd{font:800 11px/1 var(--sys-body,sans-serif);border:1.5px solid rgba(255,255,255,.85);border-radius:4px;padding:3px 5px;background:rgba(0,0,0,.4)}
`;

export interface CombatHud {
    show(on: boolean): void;
    hurt(k: number): void;
    banner(text: string): void;
    flash(text: string): void;
    update(realDt: number, S: { threats: any[] }): void;
}

export function createHud(c: any): CombatHud {
    if (!document.getElementById("cmb-css")) {
        const st = document.createElement("style");
        st.id = "cmb-css";
        st.textContent = CSS;
        document.head.appendChild(st);
    }
    const root = document.createElement("div");
    root.id = "cmb-hud";
    root.innerHTML = `
    <div class="vig"></div><div class="slow"></div>
    <div class="bars"><div class="lbl"><span>HEALTH</span><span class="hpn">100</span></div>
      <div class="hp"><i class="trail"></i><i class="fill"></i></div>
      <div class="focus"><b><i></i></b><b><i></i></b><b><i></i></b></div></div>
    <div class="combo"><div class="n"><small>x</small><span>0</span></div><div class="t">COMBO</div><div class="bar"></div></div>
    <div class="arrows"></div><div class="ebars"></div>
    <div class="banner">PERFECT DODGE</div><div class="msg"></div>
    <div class="hint">
      <span><kbd>LMB</kbd>Attack</span><span><kbd>Hold LMB</kbd>Launch / Slam</span><span><kbd>C</kbd>Dodge</span><span><kbd>Space</kbd>Jump (evades)</span>
      <span><kbd>E</kbd>Web Strike</span><span><kbd>F</kbd>Web</span><span><kbd>R</kbd>Throw</span><span><kbd>Q</kbd>Finisher</span><span><kbd>Z</kbd>Heal</span></div>`;
    document.body.appendChild(root);
    const $ = (s: string) => root.querySelector(s) as HTMLElement;
    const fill = $(".hp .fill") as HTMLElement;
    const trail = $(".hp .trail") as HTMLElement;
    const hpBox = $(".hp") as HTMLElement;
    const hpn = $(".hpn") as HTMLElement;
    const segs = [...root.querySelectorAll(".focus b")] as HTMLElement[];
    const combo = $(".combo") as HTMLElement;
    const comboN = $(".combo .n span") as HTMLElement;
    const comboBar = $(".combo .bar") as HTMLElement;
    const vig = $(".vig") as HTMLElement;
    const slow = $(".slow") as HTMLElement;
    const banner = $(".banner") as HTMLElement;
    const msg = $(".msg") as HTMLElement;
    const hint = $(".hint") as HTMLElement;
    const arrows = $(".arrows") as HTMLElement;
    const ebars = $(".ebars") as HTMLElement;
    const arrowEls: HTMLElement[] = [];
    const ebarEls = new Map<any, HTMLElement>();
    let trailV = 1;
    let vigV = 0;
    let bannerT = 0;
    let msgT = 0;
    let hintT = 0;
    let shown = false;
    let lastHp = 100;
    const _v = new THREE.Vector3();
    const self: any = { _hold: 0 };

    return {
        show(on: boolean) {
            shown = on;
            root.classList.toggle("on", on);
            if (on) {
                hintT = 9;
            }
        },
        hurt(k: number) {
            vigV = Math.min(1, vigV + 0.5 + k);
        },
        banner(text: string) {
            banner.textContent = text;
            bannerT = 1.1;
        },
        flash(text: string) {
            msg.textContent = text;
            msgT = 1.4;
        },
        update(realDt: number, S: { threats: any[] }) {
            const me = c.spidey;
            const hp = clamp(me.hp / me.maxHp, 0, 1);
            fill.style.transform = `scaleX(${hp})`;
            if (hp < trailV)
                trailV = Math.max(
                    hp,
                    trailV - realDt * (me.hp < lastHp ? 0 : 0.45),
                );
            else trailV = hp;
            if (me.hp < lastHp) self._hold = 0.5;
            lastHp = me.hp;
            self._hold = (self._hold || 0) - realDt;
            if (self._hold <= 0) trailV = Math.max(hp, trailV - realDt * 0.5);
            trail.style.transform = `scaleX(${trailV})`;
            hpBox.classList.toggle("low", hp < 0.3);
            hpn.textContent = String(Math.ceil(me.hp));
            segs.forEach((b, i) => {
                const k = clamp(me.focus - i, 0, 1);
                (b.firstChild as HTMLElement).style.transform = `scaleX(${k})`;
                b.classList.toggle("full", k >= 1);
            });

            const on = c.combo.n >= 2;
            combo.classList.toggle("on", on);
            if (on) {
                comboN.textContent = String(c.combo.n);
                comboBar.style.transform = `scaleX(${clamp(1 - c.combo.t / 3.2, 0, 1)})`;
            }
            vigV = Math.max(0, vigV - realDt * 1.6);
            vig.style.opacity = vigV.toFixed(3);
            slow.style.opacity =
                c.slowK > 0.05 ? (c.slowK * 0.9).toFixed(2) : "0";
            bannerT -= realDt;
            banner.classList.toggle("on", bannerT > 0);
            msgT -= realDt;
            msg.classList.toggle("on", msgT > 0);
            hintT -= realDt;
            hint.classList.toggle("on", shown && hintT > 0);

            const cam = c.ctx.camera;
            const W = innerWidth;
            const Hh = innerHeight;
            const threats = S.threats;
            while (arrowEls.length < threats.length) {
                const i = document.createElement("i");
                arrows.appendChild(i);
                arrowEls.push(i);
            }
            arrowEls.forEach((el, k) => {
                const t = threats[k];
                if (!t) {
                    el.style.display = "none";
                    return;
                }
                const p = t.e.chest(_v).project(cam);
                const behind = p.z > 1;
                let x = p.x;
                let y = p.y;
                if (behind) {
                    x = -x;
                    y = -y;
                }
                const onScreen =
                    !behind && Math.abs(x) < 0.85 && Math.abs(y) < 0.8;
                const lvl = clamp(1 - (t.at - c.time) / 0.9, 0, 1);
                if (onScreen || lvl <= 0) {
                    el.style.display = "none";
                    return;
                }
                const a = Math.atan2(y, x);
                const r = Math.max(
                    Math.abs(Math.cos(a)) / 0.9,
                    Math.abs(Math.sin(a)) / 0.82,
                );
                const sx = ((Math.cos(a) / r) * 0.5 + 0.5) * W;
                const sy = (1 - ((Math.sin(a) / r) * 0.5 + 0.5)) * Hh;
                el.style.display = "block";
                el.style.color = t.kind === "gun" ? "#ff4040" : "#ffd070";
                el.style.opacity = (0.35 + 0.65 * lvl).toFixed(2);
                el.style.transform = `translate(${sx}px,${sy}px) rotate(${-a}rad) scale(${0.8 + 0.5 * lvl})`;
            });
            for (const e of c.enemies) {
                let el = ebarEls.get(e);
                const want = e.type === "brute" && e.alive;
                if (!want) {
                    if (el) el.style.opacity = "0";
                    continue;
                }
                if (!el) {
                    el = document.createElement("div");
                    el.className = "ebar";
                    el.innerHTML = "<i></i>";
                    ebars.appendChild(el);
                    ebarEls.set(e, el);
                }
                const p = e.headPos(_v);
                p.y += 0.45;
                p.project(cam);
                if (p.z > 1 || Math.abs(p.x) > 1.1) {
                    el.style.opacity = "0";
                    continue;
                }
                el.style.opacity = "1";
                el.style.transform = `translate(${(p.x * 0.5 + 0.5) * W}px,${(1 - (p.y * 0.5 + 0.5)) * Hh}px) skewX(-18deg)`;
                (el.firstChild as HTMLElement).style.transform =
                    `scaleX(${clamp(e.hp / e.maxHp, 0, 1)})`;
                el.classList.toggle("stun", e.stun > 0);
            }
            for (const [e, el] of ebarEls)
                if (!c.enemies.includes(e)) {
                    el.remove();
                    ebarEls.delete(e);
                }
        },
    };
}
