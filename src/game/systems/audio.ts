/**
 * Game audio system.
 *
 * @module src-game-systems-audio
 * @version 1.0.0
 * @file src/game/systems/audio.ts
 * @since 0.0.1
 * @description Loads and manages music, loops, and sound effects for traversal, combat, UI, and world ambience.
 */

import * as THREE from "three";
import { nightK } from "@/render/daynight";
import { ASSETS } from "@/core/constants/assets";

const BASE = ASSETS.audio.base;
const STEMS = ["day", "night", "pulseA", "pulseB"] as const;

const ORCH = {
    hero: "music_orch_hero.ogg",
    swing: "music_orch_swing.ogg",
    combat: "music_orch_combat.ogg",
} as Record<string, string>;
const ORCH_BAR = 2.5,
    HERO_T = 14,
    ORCH_LINGER = 6;
const SPRITE_BUS: Record<string, string> = {
    trav: "sfx",
    combat: "sfx",
    ui: "ui",
    world: "ambience",
};
const clamp = THREE.MathUtils.clamp;
const sstep = (a: number, b: number, x: number) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
};

export function createAudio() {
    const AC =
        (window as any).AudioContext || (window as any).webkitAudioContext;
    let ac: AudioContext | null = null,
        ready = false,
        man: any = null,
        master: GainNode,
        comp: DynamicsCompressorNode,
        muffle: BiquadFilterNode,
        musicLP: BiquadFilterNode,
        musicDuck: GainNode,
        loadErr: string | null = null;
    const vol = { master: 1, music: 0.7, sfx: 0.7, ambience: 0.7, ui: 0.7 };
    const FOLEY_K = 0.1;

    const MIX = {
            master: 0.8,
            music: 0.04 * 0.09 * 1.4,
            sfx: 0.16,
            ambience: 0.1,
            ui: 0.06,
        },
        D = 0.7;
    const TRIM = {
        music: (MIX.master * MIX.music) / D,
        sfx: (MIX.master * MIX.sfx) / D,
        ambience: (MIX.master * MIX.ambience) / D,
        ui: (MIX.master * MIX.ui) / D,
    };
    const bus: Record<string, GainNode> = {},
        bufs: Record<string, AudioBuffer> = {},
        mbufs: Record<string, AudioBuffer> = {},
        lbufs: Record<string, AudioBuffer> = {},
        voices = new Map<string, any[]>();
    const music: any = {
        started: false,
        t0: 0,
        layer: {},
        night: 0,
        I: 0,
        dayG: 0,
        nightG: 0,
        aG: 0,
        bG: 0,
    };

    const orch: any = {
        started: false,
        t0: 0,
        layer: {},
        cur: null,
        want: null,
        switchAt: 0,
        k: 0,
        travT: 0,
        calmT: 99,
        bufs: {},
    };
    const listenerPos = new THREE.Vector3(),
        _f = new THREE.Vector3();
    const loops = new Map<string, any>();
    let paused = false,
        combat = false;

    const G = (v = 1) => {
        const g = ac!.createGain();
        g.gain.value = v;
        return g;
    };
    const now = () => ac!.currentTime;

    function init() {
        if (ac || !AC) return;
        try {
            ac = new AC({ latencyHint: "interactive" });
        } catch {
            return;
        }
        master = G(vol.master);
        comp = ac.createDynamicsCompressor();
        comp.threshold.value = -8;
        comp.knee.value = 6;
        comp.ratio.value = 3;
        comp.attack.value = 0.005;
        comp.release.value = 0.25;
        master.connect(comp).connect(ac.destination);
        musicLP = ac.createBiquadFilter();
        musicLP.type = "lowpass";
        musicLP.frequency.value = 20000;
        musicLP.Q.value = 0.5;
        musicDuck = G(1);
        bus.music = G(vol.music * TRIM.music);
        bus.music.connect(musicDuck).connect(musicLP).connect(master);
        muffle = ac.createBiquadFilter();
        muffle.type = "lowpass";
        muffle.frequency.value = 20000;
        muffle.Q.value = 0.5;
        const world = G(1);
        world.connect(muffle).connect(master);
        bus.sfx = G(vol.sfx * TRIM.sfx);
        bus.sfx.connect(world);
        bus.ambience = G(vol.ambience * TRIM.ambience);
        bus.ambience.connect(world);
        bus.ui = G(vol.ui * TRIM.ui);
        bus.ui.connect(master);
        ready = true;
        load();
    }
    const resume = () => {
        init();
        if (ac && ac.state !== "running") ac.resume().catch(() => {});
    };
    for (const ev of ["pointerdown", "keydown", "touchstart"])
        addEventListener(ev, resume, { capture: true, passive: true });

    async function fetchBuf(url: string, tries = 3): Promise<AudioBuffer> {
        for (let i = 0; i < tries; i++) {
            try {
                const r = await fetch(url);
                if (!r.ok) throw new Error(r.status + " " + url);
                return await ac!.decodeAudioData(await r.arrayBuffer());
            } catch (e) {
                if (i === tries - 1) throw e;
                await new Promise((r) => setTimeout(r, 400 * (i + 1)));
            }
        }
        throw new Error("unreachable");
    }
    async function load() {
        try {
            man = await (await fetch(BASE + "manifest.json")).json();

            await Promise.all(
                Object.entries(man.sprites).map(async ([k, s]: any) => {
                    bufs[k] = await fetchBuf(
                        s.url.startsWith("http") || s.url.startsWith("/")
                            ? s.url
                            : BASE + s.url.replace(/^\/?assets\/audio\//, ""),
                    );
                }),
            );
            await Promise.all(
                Object.entries(man.loops).map(async ([k, s]: any) => {
                    lbufs[k] = await fetchBuf(
                        s.url.startsWith("http") || s.url.startsWith("/")
                            ? s.url
                            : BASE + s.url.replace(/^\/?assets\/audio\//, ""),
                    );
                }),
            );
            for (const k of STEMS)
                if (man.music[k]) {
                    const u = man.music[k].url;
                    mbufs[k] = await fetchBuf(
                        u.startsWith("http") || u.startsWith("/")
                            ? u
                            : BASE + u.replace(/^\/?assets\/audio\//, ""),
                    );
                }
            startMusic();
            try {
                for (const [k, f] of Object.entries(ORCH))
                    orch.bufs[k] = await fetchBuf(BASE + f);
                startOrch();
            } catch (e: any) {
                console.warn(
                    "[audio] orchestral score missing (python3 tools/audio/orchestral_v2.py --game):",
                    e?.message || e,
                );
            }
        } catch (e: any) {
            loadErr = String(e?.message || e);
            console.warn("[audio] load failed:", loadErr);
        }
    }

    function startMusic() {
        if (music.started || !STEMS.every((k) => mbufs[k])) return;
        const t0 = now() + 0.25;
        music.t0 = t0;
        for (const k of STEMS) {
            const s = ac!.createBufferSource();
            s.buffer = mbufs[k];
            s.loop = true;
            const g = G(0);
            s.connect(g).connect(bus.music);
            s.start(t0);
            music.layer[k] = { s, g };
        }
        music.started = true;

        musicDuck.gain.setValueAtTime(0, t0);
        musicDuck.gain.linearRampToValueAtTime(1, t0 + 5);
    }
    function startOrch() {
        if (orch.started || !Object.keys(ORCH).every((k) => orch.bufs[k]))
            return;
        const t0 = now() + 0.3;
        orch.t0 = t0;
        for (const k of Object.keys(ORCH)) {
            const s = ac!.createBufferSource();
            s.buffer = orch.bufs[k];
            s.loop = true;
            const g = G(0);
            s.connect(g).connect(bus.music);
            s.start(t0);
            orch.layer[k] = { s, g };
        }
        orch.started = true;
    }
    const nextBar = (t: number) =>
        orch.t0 + Math.ceil((t - orch.t0 + 0.05) / ORCH_BAR) * ORCH_BAR;

    function orchUpdate(dt: number, t: number, trav: boolean, speed: number) {
        if (!orch.started) return 0;
        const fast = trav && speed > 14;
        orch.travT = fast ? orch.travT + dt : Math.max(0, orch.travT - dt * 2);
        orch.calmT = (trav && speed > 6) || combat ? 0 : orch.calmT + dt;
        let want: string | null = null;
        if (combat) want = "combat";
        else if (trav && speed > 6)
            want =
                orch.travT >= HERO_T || orch.cur === "hero" ? "hero" : "swing";
        else if (orch.calmT < ORCH_LINGER) want = orch.cur;
        if (paused) want = orch.cur;
        if (want !== orch.want) {
            orch.want = want;
            orch.switchAt = want && orch.cur ? nextBar(t) : t;
        }
        if (orch.want !== orch.cur && t >= orch.switchAt - 0.12) {
            const at = Math.max(t, orch.switchAt - 0.12);
            for (const [k, L] of Object.entries(
                orch.layer as Record<string, any>,
            )) {
                const on = k === orch.want;
                L.g.gain.cancelScheduledValues(at);
                L.g.gain.setValueAtTime(L.g.gain.value, at);
                if (orch.cur === null || orch.want === null)
                    L.g.gain.setTargetAtTime(on ? 1 : 0, at, on ? 0.8 : 1.4);
                else L.g.gain.setTargetAtTime(on ? 1 : 0, at, on ? 0.09 : 0.16);
            }
            orch.cur = orch.want;
        }
        orch.k +=
            ((orch.cur ? 1 : 0) - orch.k) *
            Math.min(1, dt / (orch.cur ? 1.2 : 3.0));
        return orch.k;
    }
    function duck(amount = 0.4, hold = 0.8, release = 0.9) {
        if (!ready || !music.started) return;
        const t = now(),
            g = musicDuck.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.setTargetAtTime(1 - amount, t, 0.06);
        g.setTargetAtTime(1, t + hold, release);
    }

    function play(name: string, o: any = {}) {
        if (!ready || !man) return null;
        const s = man.sounds[name];
        const buf = s && bufs[s.sprite];
        if (!buf) return null;
        const t = now() + (o.at || 0);
        let vs = voices.get(name);
        if (!vs) voices.set(name, (vs = []));
        for (let i = vs.length - 1; i >= 0; i--)
            if (vs[i].end < now()) vs.splice(i, 1);
        if (vs.length && t - vs[vs.length - 1].t < 0.03) return null;
        while (vs.length >= (s.max || 4)) {
            const v = vs.shift();
            try {
                v.g.gain.setTargetAtTime(0, now(), 0.015);
                v.src.stop(now() + 0.1);
            } catch {
                void 0;
            }
        }
        const n = s.v.length;
        let k =
            o.k != null
                ? clamp(Math.round(o.k), 0, n - 1)
                : Math.floor(Math.random() * n);
        if (o.k == null && n > 1 && k === s.last)
            k = (k + 1 + Math.floor(Math.random() * (n - 1))) % n;
        s.last = k;
        const [off, dur] = s.v[k];
        const rate =
            (o.rate || 1) * (1 + (Math.random() * 2 - 1) * (s.jit || 0));
        const src = ac!.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        const g = G(s.gain * (o.gain ?? 1) * (s.fk ? FOLEY_K : 1));
        let node: AudioNode = src.connect(g);
        if (o.pos) {
            const p = ac!.createPanner();
            p.panningModel = "HRTF";
            p.distanceModel = "inverse";
            p.refDistance = o.ref || 10;
            p.rolloffFactor = 1;
            p.maxDistance = 2000;
            setPos(p, o.pos);
            node = node.connect(p);
        } else if (o.pan && (ac as any).createStereoPanner) {
            const p = (ac as any).createStereoPanner();
            p.pan.value = clamp(o.pan, -1, 1);
            node = node.connect(p);
        }
        node.connect(bus[o.out || SPRITE_BUS[s.sprite] || "sfx"]);
        src.start(t, off, dur);
        vs.push({ src, g, t, end: t + dur / rate });
        return { src, g };
    }
    function setPos(p: PannerNode, v: any) {
        if ((p as any).positionX) {
            (p as any).positionX.value = v.x;
            (p as any).positionY.value = v.y;
            (p as any).positionZ.value = v.z;
        } else (p as any).setPosition(v.x, v.y, v.z);
    }

    let lastThwip: any = null;
    const sfx = {
        thwip(strength = 1, pan = 0) {
            const v = play("thwip", {
                gain: clamp(strength, 0.35, 1.3),
                pan: clamp(pan + (Math.random() - 0.5) * 0.2, -1, 1),
                rate: 1.04 - 0.06 * clamp(strength, 0, 1.3),
            });
            if (v) lastThwip = { v, t: now() };
        },
        zip() {
            if (lastThwip && now() - lastThwip.t < 0.06) {
                try {
                    lastThwip.v.g.gain.setTargetAtTime(0, now(), 0.01);
                } catch {
                    void 0;
                }
            }
            lastThwip = null;
            play("zip");
        },
        attach(pan = 0) {
            play("attach", { pan });
        },
        release(pan = 0) {
            play("release", { pan });
        },
        slingCreak(t = 0.5, pan = 0) {
            const k = clamp(t, 0, 1);
            play("creak", { k: k * 3.4, gain: 0.45 + 0.6 * k, pan });
        },
        slingLaunch(t = 1) {
            const k = clamp(t, 0, 1);
            play("launch", { gain: 0.6 + 0.4 * k });
            if (k > 0.6) duck(0.15, 0.3);
        },
        whoosh(speed = 20) {
            play("swipe", { gain: clamp(speed / 22, 0.4, 1.1) });
        },
        land(sev = 0.5) {
            const t = clamp(sev, 0, 1);
            if (t < 0.3) play("land_soft", { gain: 0.6 + t });
            else if (t < 0.7)
                play("land_med", { gain: 0.7 + (0.4 * (t - 0.3)) / 0.4 });
            else {
                play("land_heavy", { gain: 0.8 + (0.3 * (t - 0.7)) / 0.3 });
                duck(0.3, 0.5);
            }
        },
        step(g = 1, pan = 0, kind = "ground") {
            const k = clamp(g, 0.3, 1.6);
            if (kind === "rope") play("rope", { gain: 0.7, pan });
            else
                play(kind === "wall" ? "wallstep" : "step", {
                    gain: 0.45 + 0.4 * k,
                    pan,
                });
        },
        jumpLoad() {
            play("jumpload");
        },
        jump(charge = 0) {
            play("jump", { gain: 0.7 + 0.5 * clamp(charge, 0, 1) });
        },
        wallContact() {
            play("wall");
        },
        perch() {
            play("perch");
        },

        hover() {
            play("hover");
        },
        move() {
            play("move");
        },
        select() {
            play("select");
        },
        back() {
            play("back");
        },
        open() {
            play("open");
        },
        close() {
            play("close");
        },
        deny() {
            play("deny");
        },
        toast() {
            play("toast");
        },
        xp() {
            play("xp");
        },
        pickup() {
            play("pickup");
            duck(0.2, 0.6);
        },
        levelUp() {
            play("levelup");
            duck(0.45, 1.8, 1.4);
        },
        district() {
            play("district");
            duck(0.4, 2.2, 1.6);
        },
        towerCharge(t: number) {
            play("tick", { rate: 0.8 + 0.8 * clamp(t, 0, 1) });
        },
        shutter() {
            play("shutter");
        },
        crime() {
            play("crime");
            duck(0.25, 0.8);
        },
        success() {
            play("success");
            duck(0.3, 1.0);
        },
        travel() {
            play("travel");
            duck(0.55, 2.2, 1.2);
        },

        hit(heavy = 0) {
            if (heavy > 0.5) play("hitheavy", { gain: 0.8 + 0.3 * heavy });
            else play("hit", { gain: 0.75 + 0.5 * heavy });
        },
        hurt(heavy = false) {
            play("hurt", { gain: heavy ? 1.1 : 0.8 });
            if (heavy) duck(0.2, 0.4);
        },
        shot() {
            play("shot");
        },
        slam() {
            play("slam");
            duck(0.3, 0.5);
        },

        swingSwish(speed = 20, pan = 0) {
            play("swingswish", {
                gain: clamp(speed / 30, 0.35, 1.0),
                pan: clamp(pan, -1, 1),
                rate: 0.94 + 0.12 * clamp(speed / 40, 0, 1),
            });
        },
        bodyfall(sev = 0.5) {
            play("bodyfall", { gain: 0.6 + 0.6 * clamp(sev, 0, 1) });
        },
        clatter(kind = "bin") {
            play(
                "clatter_" +
                    (kind === "crate" || kind === "drum" ? kind : "bin"),
            );
        },

        horn(pan = 0, dist = 1) {
            play(Math.random() < 0.3 ? "horn_big" : "horn_small", {
                pan,
                gain: clamp(1.4 / Math.max(1, dist), 0.12, 1),
            });
        },
        hornAt(x: number, y: number, z: number, big = false) {
            play(big ? "horn_big" : "horn_small", { pos: { x, y, z }, ref: 8 });
        },
        distantSiren(pan = 0) {
            const b = lbufs.siren;
            if (!ready || !b) return;
            const t = now();
            const s = ac!.createBufferSource();
            s.buffer = b;
            s.loop = true;
            s.playbackRate.value = 0.97 + Math.random() * 0.06;
            const g = G(0);
            const lp = ac!.createBiquadFilter();
            lp.type = "lowpass";
            lp.frequency.value = 1300;
            const lv = (man.loops.siren.gain || 0.5) * 0.28;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(lv, t + 2);
            g.gain.setValueAtTime(lv, t + 4.5);
            g.gain.linearRampToValueAtTime(0, t + 7.5);
            let n: AudioNode = s.connect(lp).connect(g);
            if ((ac as any).createStereoPanner) {
                const p = (ac as any).createStereoPanner();
                p.pan.value = clamp(pan, -1, 1);
                n = n.connect(p);
            }
            n.connect(bus.ambience);
            s.start(t, Math.random() * 4);
            s.stop(t + 7.6);
        },
    };

    function startLoopNodes(L: any) {
        const b = lbufs[L.kind === "alarm" ? "alarm" : "siren"];
        if (!b) return;
        const panner = ac!.createPanner();
        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = 14;
        panner.rolloffFactor = 1.1;
        panner.maxDistance = 2000;
        const gain = G(0);
        gain.gain.linearRampToValueAtTime(
            man.loops[L.kind === "alarm" ? "alarm" : "siren"].gain || 0.4,
            now() + 0.8,
        );
        const src = ac!.createBufferSource();
        src.buffer = b;
        src.loop = true;
        src.connect(gain).connect(panner).connect(bus.sfx);
        src.start(now(), Math.random() * b.duration);
        setPos(panner, L.pos);
        Object.assign(L, { src, gain, panner });
    }
    function loop(id: string, kind: string, pos: THREE.Vector3) {
        if (!ready || loops.has(id)) return;
        const L = { kind, pos: pos.clone(), src: null as any };
        loops.set(id, L);
        startLoopNodes(L);
    }
    function loopPos(id: string, pos: THREE.Vector3) {
        const L = loops.get(id);
        if (L) L.pos.copy(pos);
    }
    function stopLoop(id: string) {
        const L = loops.get(id);
        if (!L) return;
        loops.delete(id);
        if (!L.src) return;
        const t = now();
        L.gain.gain.cancelScheduledValues(t);
        L.gain.gain.setValueAtTime(L.gain.gain.value, t);
        L.gain.gain.linearRampToValueAtTime(0, t + 0.6);
        L.src.stop(t + 0.7);
    }

    let hornT = 14,
        sirenT = 40;
    function update(
        dt: number,
        {
            camera,
            playerPos,
            speed = 0,
            ground = 0,
            swinging = false,
            mode = "",
            inCombat = false,
        }: any,
    ) {
        if (!ready) return;
        const t = now();
        combat = inCombat;

        if (music.started) {
            const nk = sstep(0.3, 0.85, (nightK as any).value || 0);
            music.night += (nk - music.night) * Math.min(1, dt / 2.5);
            const trav =
                swinging || /swing|air|zip|wall|rope|launch|dive/.test(mode);
            let target = trav
                ? sstep(5, 30, speed)
                : sstep(9, 22, speed) * 0.45;
            if (combat) target = Math.max(target, 0.55);
            if (paused) target = 0;
            const tau = target > music.I ? 1.1 : 5.5;
            music.I += (target - music.I) * Math.min(1, dt / tau);
            const ok = orchUpdate(dt, t, trav, speed);
            const bed = (1 - 0.18 * music.I) * (1 - ok);
            music.dayG = Math.cos((music.night * Math.PI) / 2) * bed;
            music.nightG = Math.sin((music.night * Math.PI) / 2) * bed;
            music.aG = sstep(0.06, 0.45, music.I) * 0.95 * (1 - ok);
            music.bG = sstep(0.5, 0.92, music.I) * 0.9 * (1 - ok);
            const L = music.layer;
            L.day.g.gain.setTargetAtTime(music.dayG, t, 0.15);
            L.night.g.gain.setTargetAtTime(music.nightG, t, 0.15);
            L.pulseA.g.gain.setTargetAtTime(music.aG, t, 0.2);
            L.pulseB.g.gain.setTargetAtTime(music.bG, t, 0.25);
        }

        const h = Math.max(0, playerPos.y - ground);
        const street = clamp(1 - (h - 4) / 70, 0, 1);
        if (!paused) {
            hornT -= dt;
            sirenT -= dt;
            if (hornT < 0) {
                hornT = 12 + Math.random() * 20;
                if (street > 0.3)
                    sfx.horn(
                        (Math.random() - 0.5) * 1.6,
                        3 + Math.random() * 4,
                    );
            }
            if (sirenT < 0) {
                sirenT = 60 + Math.random() * 70;
                sfx.distantSiren((Math.random() - 0.5) * 1.6);
            }
        }

        const Ls = ac!.listener as any;
        camera.getWorldDirection(_f);
        listenerPos.copy(camera.position);
        if (Ls.positionX) {
            Ls.positionX.value = listenerPos.x;
            Ls.positionY.value = listenerPos.y;
            Ls.positionZ.value = listenerPos.z;
            Ls.forwardX.value = _f.x;
            Ls.forwardY.value = _f.y;
            Ls.forwardZ.value = _f.z;
            Ls.upX.value = 0;
            Ls.upY.value = 1;
            Ls.upZ.value = 0;
        } else {
            Ls.setPosition(listenerPos.x, listenerPos.y, listenerPos.z);
            Ls.setOrientation(_f.x, _f.y, _f.z, 0, 1, 0);
        }
        for (const Lp of loops.values()) {
            if (!Lp.src) startLoopNodes(Lp);
            if (Lp.panner) setPos(Lp.panner, Lp.pos);
        }
    }

    function setVolumes(s: any) {
        vol.master = s.masterVolume ?? 1;
        vol.music = s.musicVolume ?? D;
        vol.sfx = s.sfxVolume ?? D;
        vol.ambience = s.ambienceVolume ?? D;
        vol.ui = s.uiVolume ?? D;
        if (!ready) return;
        const t = now();
        master.gain.setTargetAtTime(vol.master, t, 0.05);
        bus.music.gain.setTargetAtTime(vol.music * TRIM.music, t, 0.05);
        bus.sfx.gain.setTargetAtTime(vol.sfx * TRIM.sfx, t, 0.05);
        bus.ambience.gain.setTargetAtTime(
            vol.ambience * TRIM.ambience,
            t,
            0.05,
        );
        bus.ui.gain.setTargetAtTime(vol.ui * TRIM.ui, t, 0.05);
    }
    function setPaused(p: boolean) {
        paused = p;
        if (!ready) return;
        muffle.frequency.setTargetAtTime(
            p ? 700 : 20000,
            now(),
            p ? 0.08 : 0.2,
        );
        musicLP.frequency.setTargetAtTime(
            p ? 900 : 20000,
            now(),
            p ? 0.15 : 0.3,
        );
    }
    function state() {
        const r3 = (x: number) => Math.round(x * 1000) / 1000;
        return {
            ready,
            ctx: ac?.state || "none",
            sr: ac?.sampleRate,
            loadErr,
            sprites: Object.keys(bufs),
            loops: Object.keys(lbufs),
            stems: Object.keys(mbufs),
            music: {
                started: music.started,
                pos: music.started
                    ? r3((now() - music.t0) % (mbufs.day?.duration || 1))
                    : 0,
                I: r3(music.I),
                night: r3(music.night),
                day: r3(music.dayG),
                nightG: r3(music.nightG),
                pulseA: r3(music.aG),
                pulseB: r3(music.bG),
                orch: {
                    started: orch.started,
                    cur: orch.cur,
                    want: orch.want,
                    k: r3(orch.k),
                    travT: r3(orch.travT),
                    gains: Object.fromEntries(
                        Object.entries(orch.layer as Record<string, any>).map(
                            ([k, L]) => [k, r3(L.g.gain.value)],
                        ),
                    ),
                },
            },
            voices: [...voices.values()].reduce((a, v) => a + v.length, 0),
            activeLoops: loops.size,
        };
    }

    const api = {
        sfx,
        play,
        duck,
        loop,
        loopPos,
        stopLoop,
        update,
        setVolumes,
        setPaused,
        resume,
        state,
        get ready() {
            return ready;
        },
        get context() {
            return ac;
        },
    };
    (window as any).__audio = api;
    return api;
}
