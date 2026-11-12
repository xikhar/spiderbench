// OWNER: systems engineer. Photo mode core: free camera (tethered to the player), FOV / roll / DoF / exposure,
// colour filters (via pipeline.grade), frames (drawn on a 2D overlay + baked into captures), hide HUD / hide
// Spider-Man, PNG capture + download, landmark / secret-photo detection on capture. Also `snap()` for quick
// in-game photos (landmarks) which only produces a thumbnail.
// Capture: pipeline.render is wrapped; right after a frame is drawn the WebGL canvas is copied (same task, so the
// drawing buffer is still valid without preserveDrawingBuffer).
import * as THREE from "three";
import { emit } from "./events.js";

export const FILTERS = [
    { id: "none", name: "None" },
    { id: "vivid", name: "Vivid", g: { saturation: 1.3, contrast: 1.08 } },
    {
        id: "noir",
        name: "Noir",
        g: { saturation: 0, contrast: 1.38, vignette: 0.55, grain: 0.05 },
    },
    {
        id: "vintage",
        name: "Vintage",
        g: {
            saturation: 0.62,
            contrast: 0.95,
            gain: [1.12, 1.0, 0.78],
            lift: [0.03, 0.018, -0.004],
            vignette: 0.5,
            grain: 0.04,
        },
    },
    {
        id: "warm",
        name: "Golden",
        g: { saturation: 1.12, gain: [1.14, 1.0, 0.8] },
    },
    {
        id: "cool",
        name: "Cold",
        g: {
            saturation: 0.92,
            gain: [0.9, 1.0, 1.16],
            lift: [-0.01, 0.0, 0.02],
        },
    },
    { id: "bleach", name: "Bleach", g: { saturation: 0.42, contrast: 1.32 } },
    {
        id: "drama",
        name: "Dramatic",
        g: { contrast: 1.34, exposure: 0.92, vignette: 0.7, saturation: 1.05 },
    },
];
export const FRAMES = [
    { id: "none", name: "None" },
    { id: "cinema", name: "Cinema" },
    { id: "bugle", name: "Bugle" },
    { id: "polaroid", name: "Polaroid" },
    { id: "comic", name: "Comic" },
    { id: "film", name: "Film" },
];

export const POSES = [
    { id: "live", name: "As Is" },
    { id: "idle", name: "Hero Stand", clip: "idle", t: 0.3 },
    { id: "perch", name: "Perch", clip: "perchIdle", t: 1.0 },
    { id: "land", name: "Superhero", clip: "landHard", t: 0.42 },
    { id: "thwip", name: "Thwip", clip: "webShootR", t: 0.22 },
    { id: "wall", name: "Wall Cling", clip: "wallPerch", t: 0.5 },
    { id: "guard", name: "Fight Stance", clip: "fightIdle", t: 0.2 },
    { id: "kick", name: "Roundhouse", clip: "kick", t: 0.32 },
    { id: "flip", name: "Front Flip", clip: "releaseFlip", t: 0.4 },
    { id: "dive", name: "Swan Dive", clip: "fallFast", t: 0.3 },
];
export const STICKERS = [
    { id: "thwip", name: "Thwip!" },
    { id: "emblem", name: "Spider Logo" },
    { id: "stamp", name: "Date Stamp" },
    { id: "bugle", name: "Bugle Stamp" },
    { id: "burst", name: "Pow Burst" },
    { id: "sig", name: "Signature" },
];
// stickers are composited after the frame, both on the live overlay and into captures.
// list items: {id, x, y (0..1 of the frame), s (scale), r (radians)}; each sticker is drawn centred on its origin.
export const STICKER_HOME = {
    thwip: [0.78, 0.66],
    emblem: [0.9, 0.16],
    stamp: [0.86, 0.8],
    bugle: [0.16, 0.74],
    burst: [0.2, 0.28],
    sig: [0.2, 0.84],
};
export const STICKER_R = {
    thwip: 150,
    emblem: 72,
    stamp: 110,
    bugle: 145,
    burst: 150,
    sig: 130,
}; // hit radius (px @1080)
export function newSticker(id) {
    const [x, y] = STICKER_HOME[id] || [0.5, 0.5];
    return {
        id,
        x,
        y,
        s: 1,
        r:
            id === "thwip"
                ? -0.18
                : id === "bugle"
                  ? -0.2
                  : id === "burst"
                    ? 0.12
                    : 0,
    };
}
export function drawStickers(g, list, W, H) {
    if (!list || !list.length) return;
    const u = Math.min(W, H) / 1080;
    for (const st of list) {
        const id = st.id || st;
        const item = st.id ? st : newSticker(st);
        g.save();
        g.translate(item.x * W, item.y * H);
        g.rotate(item.r || 0);
        g.scale(item.s || 1, item.s || 1);
        if (id === "thwip") {
            g.font = `900 ${Math.round(110 * u)}px "Spiderbench Condensed", Impact, sans-serif`;
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.lineJoin = "round";
            g.lineWidth = 16 * u;
            g.strokeStyle = "#111";
            g.strokeText("THWIP!", 0, 0);
            g.fillStyle = "#fff";
            g.fillText("THWIP!", 0, 0);
            g.lineWidth = 5 * u;
            g.strokeStyle = "#e3262f";
            g.strokeText("THWIP!", 6 * u, 6 * u);
        } else if (id === "emblem") {
            g.fillStyle = "#e3262f";
            g.beginPath();
            g.arc(0, 0, 70 * u, 0, 7);
            g.fill();
            g.strokeStyle = "#fff";
            g.lineWidth = 6 * u;
            g.stroke();
            g.fillStyle = "#111";
            g.beginPath();
            g.ellipse(0, -14 * u, 9 * u, 12 * u, 0, 0, 7);
            g.fill();
            g.beginPath();
            g.ellipse(0, 14 * u, 13 * u, 20 * u, 0, 0, 7);
            g.fill();
            g.strokeStyle = "#111";
            g.lineWidth = 4 * u;
            g.lineCap = "round";
            for (const sx of [-1, 1])
                for (const [a, b, c, d] of [
                    [5, -16, 30, -44],
                    [7, -8, 44, -18],
                    [7, 6, 44, 20],
                    [5, 14, 30, 48],
                ]) {
                    g.beginPath();
                    g.moveTo(sx * a * u, b * u);
                    g.quadraticCurveTo(
                        sx * (c * 0.8) * u,
                        (b + d) * 0.3 * u,
                        sx * c * u,
                        d * u,
                    );
                    g.stroke();
                }
        } else if (id === "stamp") {
            const d = new Date();
            const txt = `'${String(d.getFullYear()).slice(2)} ${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getDate()).padStart(2, "0")}`;
            g.font = `700 ${Math.round(46 * u)}px "Courier New", monospace`;
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.shadowColor = "rgba(255,120,0,.9)";
            g.shadowBlur = 10 * u;
            g.fillStyle = "#ffa133";
            g.fillText(txt, 0, 0);
        } else if (id === "bugle") {
            g.strokeStyle = "#c4161f";
            g.lineWidth = 7 * u;
            g.strokeRect(-140 * u, -48 * u, 280 * u, 96 * u);
            g.fillStyle = "#c4161f";
            g.font = `900 ${Math.round(40 * u)}px Georgia, serif`;
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText("EXCLUSIVE", 0, -8 * u);
            g.font = `700 ${Math.round(18 * u)}px Georgia, serif`;
            g.fillText("DAILY BUGLE PHOTO DESK", 0, 26 * u);
        } else if (id === "burst") {
            g.beginPath();
            for (let i = 0; i < 28; i++) {
                const a = (i / 28) * Math.PI * 2,
                    r = (i % 2 ? 72 : 130) * u;
                g.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r);
            }
            g.closePath();
            g.fillStyle = "#ffd61f";
            g.fill();
            g.lineWidth = 7 * u;
            g.strokeStyle = "#111";
            g.stroke();
            g.fillStyle = "#e3262f";
            g.font = `900 ${Math.round(76 * u)}px "Spiderbench Condensed", Impact, sans-serif`;
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText("POW!", 0, 4 * u);
        } else if (id === "sig") {
            g.font = `italic 600 ${Math.round(58 * u)}px "Segoe Script", "Brush Script MT", cursive`;
            g.fillStyle = "rgba(255,255,255,.92)";
            g.shadowColor = "rgba(0,0,0,.6)";
            g.shadowBlur = 6 * u;
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText("— Spidey", 0, 0);
        }
        g.restore();
    }
}

// draw a frame overlay into a 2D context of size W x H
export function drawFrame(g, id, W, H, caption = "") {
    g.save();
    const u = Math.min(W, H) / 1080;
    if (id === "cinema") {
        const bar = Math.max(0, (H - W / 2.39) / 2);
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, bar);
        g.fillRect(0, H - bar, W, bar);
    } else if (id === "bugle") {
        const m = 36 * u,
            top = 150 * u,
            bot = 120 * u;
        g.fillStyle = "#f3efe4";
        g.beginPath();
        g.rect(0, 0, W, H);
        g.rect(m, top, W - 2 * m, H - top - bot);
        g.fill("evenodd");
        g.fillStyle = "#111";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = `900 ${Math.round(92 * u)}px "Times New Roman", Georgia, serif`;
        g.fillText("DAILY  BUGLE", W / 2, top * 0.52);
        g.fillRect(m, top - 16 * u, W - 2 * m, 3 * u);
        g.fillRect(m, top - 9 * u, W - 2 * m, 1.5 * u);
        g.font = `600 ${Math.round(20 * u)}px Georgia, serif`;
        g.textAlign = "left";
        g.fillText("NEW YORK'S FINEST DAILY NEWSPAPER", m, 26 * u);
        g.textAlign = "right";
        g.fillText("50¢", W - m, 26 * u);
        g.textAlign = "center";
        g.font = `800 ${Math.round(44 * u)}px "Arial Narrow", "Barlow Condensed", sans-serif`;
        g.fillText(
            caption || "SPIDER-MAN: THREAT OR MENACE?",
            W / 2,
            H - bot / 2,
        );
    } else if (id === "polaroid") {
        const m = 50 * u,
            bot = 190 * u;
        g.fillStyle = "#f7f5f0";
        g.beginPath();
        g.rect(0, 0, W, H);
        g.rect(m, m, W - 2 * m, H - m - bot);
        g.fill("evenodd");
        g.fillStyle = "#2a3a8a";
        g.font = `italic 600 ${Math.round(54 * u)}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(caption || "NYC, from above", W / 2, H - bot / 2);
    } else if (id === "comic") {
        const m = 28 * u;
        g.fillStyle = "#fff";
        g.beginPath();
        g.rect(0, 0, W, H);
        g.rect(m, m, W - 2 * m, H - 2 * m);
        g.fill("evenodd");
        g.lineWidth = 10 * u;
        g.strokeStyle = "#111";
        g.strokeRect(m, m, W - 2 * m, H - 2 * m);
        const bw = 470 * u,
            bh = 86 * u;
        g.fillStyle = "#ffe14a";
        g.fillRect(m + 5 * u, m + 5 * u, bw, bh);
        g.lineWidth = 6 * u;
        g.strokeRect(m + 5 * u, m + 5 * u, bw, bh);
        g.fillStyle = "#111";
        g.font = `800 ${Math.round(40 * u)}px "Comic Sans MS", "Barlow Condensed", sans-serif`;
        g.textBaseline = "middle";
        g.fillText(caption || "MEANWHILE...", m + 30 * u, m + 5 * u + bh / 2);
    } else if (id === "film") {
        const b = 90 * u;
        g.fillStyle = "#0c0c0c";
        g.fillRect(0, 0, W, b);
        g.fillRect(0, H - b, W, b);
        g.fillStyle = "#e9e2cf";
        const hw = 44 * u,
            hh = 30 * u;
        for (let x = 30 * u; x < W; x += 90 * u) {
            g.fillRect(x, (b - hh) / 2, hw, hh);
            g.fillRect(x, H - b + (b - hh) / 2, hw, hh);
        }
        g.fillStyle = "#e8a33c";
        g.font = `700 ${Math.round(22 * u)}px monospace`;
        g.fillText("KODAK 400TX   24", 60 * u, b - 8 * u);
    }
    g.restore();
}

export function createPhoto(sys) {
    const { ctx, flow, audio, save } = sys;
    const { camera, pipeline, renderer, player, world } = ctx;
    const state = {
        fov: 60,
        roll: 0,
        focus: 6,
        aperture: 0,
        exposure: 0,
        filter: "none",
        frame: "none",
        hideHero: false,
        grid: false,
        clean: false,
        pose: "live",
        stickers: [],
        yaw: 0,
        pitch: 0,
        pos: new THREE.Vector3(),
    };
    const keys = new Set();
    let active = false,
        gradeBase = null,
        camSave = null;
    const TETHER = 30;

    // ---------------------------------------------------------------- capture hook
    let pending = [];
    const origRender = pipeline.render;
    pipeline.render = function (dt) {
        const r = origRender.call(this, dt);
        if (pending.length) {
            const list = pending;
            pending = [];
            for (const fn of list) {
                try {
                    fn(renderer.domElement);
                } catch (e) {
                    console.error(e);
                }
            }
        }
        return r;
    };
    function afterRender(fn) {
        pending.push(fn);
    }
    function thumbFrom(src, W = 320, H = 180) {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const g = c.getContext("2d");
        const sa = src.width / src.height,
            ta = W / H;
        let sw = src.width,
            sh = src.height,
            sx = 0,
            sy = 0;
        if (sa > ta) {
            sw = sh * ta;
            sx = (src.width - sw) / 2;
        } else {
            sh = sw / ta;
            sy = (src.height - sh) / 2;
        }
        g.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
        if (active && state.frame !== "none") drawFrame(g, state.frame, W, H);
        if (active) drawStickers(g, state.stickers, W, H);
        return c.toDataURL("image/jpeg", 0.8);
    }
    let lastThumb = null;
    // quick in-game photo (no photo mode): flash + shutter + thumbnail callback
    function snap(cb) {
        audio.sfx.shutter();
        sys.ui?.flash?.();
        afterRender((src) => {
            lastThumb = thumbFrom(src);
            cb?.(lastThumb);
        });
    }
    function capture() {
        const items = sys.collect.checkPhoto(camera, player.position);
        return new Promise((res) =>
            afterRender((src) => {
                const c = document.createElement("canvas");
                c.width = src.width;
                c.height = src.height;
                const g = c.getContext("2d");
                g.drawImage(src, 0, 0);
                drawFrame(g, state.frame, c.width, c.height);
                drawStickers(g, state.stickers, c.width, c.height);
                const thumb = thumbFrom(src);
                sys.collect.collectPhoto(items, thumb);
                c.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const stamp = new Date()
                        .toISOString()
                        .replace(/[:T]/g, "-")
                        .slice(0, 19);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `spider-man_${stamp}.png`;
                    // automated runs (?playtest) don't download unless ?photodl
                    const q = new URLSearchParams(location.search);
                    if (!q.has("playtest") || q.has("photodl")) {
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                    }
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                    window.__lastPhoto = {
                        width: c.width,
                        height: c.height,
                        bytes: blob.size,
                        items: items.map((i) => i.id),
                    };
                    emit("photo:captured", {
                        items: items.map((i) => i.id),
                        thumb,
                        width: c.width,
                        height: c.height,
                    });
                    res({ thumb, items });
                }, "image/png");
            }),
        );
    }

    // ---------------------------------------------------------------- grade / dof
    const GKEYS = ["exposure", "saturation", "contrast", "vignette", "grain"];
    function applyGrade() {
        const g = pipeline.grade;
        if (!g || !gradeBase) return;
        for (const k of GKEYS) g[k] = gradeBase[k];
        for (const k of ["lift", "gain", "gamma"]) g[k]?.copy?.(gradeBase[k]);
        const f = FILTERS.find((x) => x.id === state.filter)?.g || {};
        for (const [k, v] of Object.entries(f)) {
            if (Array.isArray(v)) g[k]?.set?.(...v);
            else g[k] = v;
        }
        g.exposure =
            (f.exposure ?? gradeBase.exposure) * Math.pow(2, state.exposure);
    }

    // ---------------------------------------------------------------- free camera
    const _fw = new THREE.Vector3(),
        _rt = new THREE.Vector3(),
        _mv = new THREE.Vector3(),
        _e = new THREE.Euler(0, 0, 0, "YXZ");
    function tick(dt) {
        // photo mode freezes time: tell the rig's 'anim-fallback' system the animation already ran this frame, so the
        // frozen pose (or a chosen photo pose) isn't overwritten by the animator ticking on its own
        if (player.rig) player.rig._ranThisFrame = true;
        const sp =
            (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 12 : 4) * dt;
        _fw.set(
            -Math.sin(state.yaw) * Math.cos(state.pitch),
            Math.sin(state.pitch),
            -Math.cos(state.yaw) * Math.cos(state.pitch),
        );
        _rt.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
        _mv.set(0, 0, 0);
        if (keys.has("KeyW")) _mv.add(_fw);
        if (keys.has("KeyS")) _mv.sub(_fw);
        if (keys.has("KeyD")) _mv.add(_rt);
        if (keys.has("KeyA")) _mv.sub(_rt);
        if (keys.has("KeyE") || keys.has("Space")) _mv.y += 1;
        if (keys.has("KeyQ") || keys.has("KeyC")) _mv.y -= 1;
        if (_mv.lengthSq() > 0) state.pos.addScaledVector(_mv.normalize(), sp);
        // tether to the player + stay above ground
        const c = player.position;
        const off = _mv.copy(state.pos).sub(c);
        if (off.length() > TETHER) state.pos.copy(c).add(off.setLength(TETHER));
        const gy =
            world.groundHeight(state.pos.x, state.pos.z, state.pos.y) + 0.25;
        if (state.pos.y < gy) state.pos.y = gy;
        camera.position.copy(state.pos);
        _e.set(state.pitch, state.yaw, THREE.MathUtils.degToRad(state.roll));
        camera.quaternion.setFromEuler(_e);
        if (camera.fov !== state.fov) {
            camera.fov = state.fov;
            camera.updateProjectionMatrix();
        }
        camera.updateMatrixWorld();
        pipeline.setMotionBlur?.(0);
        pipeline.setDof?.({
            focus: state.focus,
            aperture: state.aperture,
            maxBlur: 16,
        });
    }

    function enter() {
        if (active) return;
        active = true;
        camSave = {
            pos: camera.position.clone(),
            q: camera.quaternion.clone(),
            fov: camera.fov,
        };
        state.pos.copy(camera.position);
        _e.setFromQuaternion(camera.quaternion, "YXZ");
        state.yaw = _e.y;
        state.pitch = _e.x;
        state.roll = 0;
        state.fov = Math.round(camera.fov);
        state.focus = +camera.position.distanceTo(player.position).toFixed(1);
        state.aperture = 0;
        state.exposure = 0;
        const g = pipeline.grade;
        gradeBase = g
            ? {
                  ...g,
                  lift: g.lift?.clone?.(),
                  gain: g.gain?.clone?.(),
                  gamma: g.gamma?.clone?.(),
              }
            : null;
        applyGrade();
        flow.setMode("photo");
        flow.setCameraHook(tick);
        emit("photomode:enter");
    }
    function exit() {
        if (!active) return;
        active = false;
        keys.clear();
        state.filter = "none";
        state.exposure = 0;
        applyGrade();
        gradeBase = null;
        player.object.visible = true;
        if (poseAction) {
            poseAction.stop();
            poseAction = null;
        }
        restorePose();
        state.pose = "live";
        camera.fov = camSave.fov;
        camera.updateProjectionMatrix();
        camera.position.copy(camSave.pos);
        camera.quaternion.copy(camSave.q);
        pipeline.setDof?.({ aperture: 0 });
        pipeline.resetHistory?.();
        flow.setMode("play");
        emit("photomode:exit");
    }
    function look(dx, dy) {
        state.yaw -= dx * 0.0032 * (state.fov / 60);
        state.pitch = THREE.MathUtils.clamp(
            state.pitch - dy * 0.0032 * (state.fov / 60),
            -1.45,
            1.45,
        );
    }
    // ---------------------------------------------------------------- poses: sample a Spider-Man clip onto the frozen
    // skeleton with a private mixer (the animation layer is paused in photo mode and takes over again on exit)
    let poseMixer = null,
        poseAction = null;
    function setPose(id) {
        state.pose = id;
        const rig = player.rig,
            P = POSES.find((p) => p.id === id);
        if (poseAction) {
            poseAction.stop();
            poseAction = null;
        }
        if (!rig?.model || !P?.clip) {
            if (id === "live" && poseRest) restorePose();
            return;
        }
        const clip = (rig.allClips || []).find((c) => c.name === P.clip);
        if (!clip) return;
        if (!poseRest) {
            poseRest = [];
            rig.model.traverse((o) => {
                if (o.isBone)
                    poseRest.push([
                        o,
                        o.position.clone(),
                        o.quaternion.clone(),
                        o.scale.clone(),
                    ]);
            });
        }
        poseMixer = poseMixer || new THREE.AnimationMixer(rig.model);
        poseAction = poseMixer.clipAction(clip);
        poseAction.reset();
        poseAction.play();
        poseAction.time = Math.min(P.t, clip.duration * 0.98);
        poseMixer.update(0);
    }
    let poseRest = null;
    function restorePose() {
        if (!poseRest) return;
        for (const [b, p, q, s] of poseRest) {
            b.position.copy(p);
            b.quaternion.copy(q);
            b.scale.copy(s);
        }
        poseRest = null;
    }
    function set(k, v) {
        if (k === "pose") return setPose(v);
        state[k] = v;
        if (k === "filter" || k === "exposure") applyGrade();
        if (k === "hideHero") player.object.visible = !v;
    }
    function autofocus() {
        // focus on whatever is under the screen centre
        camera.getWorldDirection(_fw);
        const h = world.raycast(camera.position, _fw, 400);
        const dp = camera.position.distanceTo(player.position);
        _rt.copy(player.position).sub(camera.position).normalize();
        state.focus = +(_rt.dot(_fw) > 0.97 || !h ? dp : h.distance).toFixed(1);
        return state.focus;
    }

    return {
        state,
        keys,
        enter,
        exit,
        look,
        set,
        capture,
        snap,
        autofocus,
        afterRender,
        thumbFrom,
        get active() {
            return active;
        },
        get lastThumb() {
            return lastThumb;
        },
        reset() {
            Object.assign(state, {
                fov: camSave?.fov ?? 60,
                roll: 0,
                aperture: 0,
                exposure: 0,
                filter: "none",
                frame: "none",
                stickers: [],
            });
            setPose("live");
            applyGrade();
        },
    };
}
