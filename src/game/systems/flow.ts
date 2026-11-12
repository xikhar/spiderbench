/**
 * Game flow and mode controller.
 *
 * @module src-game-systems-flow
 * @version 1.0.0
 * @file src/game/systems/flow.ts
 * @since 0.0.1
 * @description Manages play, pause, photo, travel, and other high-level game mode transitions and input gating.
 */

import * as THREE from "three";
import { emit } from "@/game/events";

export type FlowMode = "play" | "menu" | "photo" | "travel" | "cine";

export function createFlow(ctx: any, { save }: { save: any }) {
    const { player, world, input, hud } = ctx;
    let mode: FlowMode = "play";
    let cameraHook: ((dt: number) => void) | null = null;
    const keyHandlers: Array<
        (e: KeyboardEvent, mode: FlowMode) => boolean | void
    > = [];

    const origPlayerUpdate = player.update;
    player.update = function (dt: number) {
        if (mode === "play") return origPlayerUpdate.call(this, dt);
        cameraHook?.(dt);
    };
    const origWorldUpdate = world.update;
    world.update = function (dt: number, camera: THREE.Camera) {
        return origWorldUpdate.call(this, mode === "play" ? dt : 0, camera);
    };

    if (input?.poll) {
        const origPoll = input.poll;
        input.poll = function (...a: any[]) {
            const s = origPoll.apply(this, a);
            const st = save.state.settings;
            if (s?.look) {
                s.look.dx *= st.mouseSensitivity;
                s.look.dy *= st.mouseSensitivity * (st.invertY ? -1 : 1);
            }
            return s;
        };
    }

    function clearInput() {
        try {
            input?.keys?.clear?.();
            input?.releaseAll?.();
            if (input?.mouse) input.mouse.buttons = 0;
            input?.poll?.(1 / 60);
        } catch {
            void 0;
        }
    }

    function setMode(m: FlowMode) {
        if (m === mode) return;
        const prev = mode;
        mode = m;
        if (m !== "play") {
            try {
                document.exitPointerLock?.();
            } catch {
                void 0;
            }
        }
        if (m === "play") {
            cameraHook = null;
            clearInput();
        }
        hud?.setVisible?.(m === "play");
        emit("flow:mode", { mode: m, prev });
    }

    document.addEventListener("keydown", (e) => {
        if (
            /^(INPUT|TEXTAREA|SELECT)$/.test(
                (e.target as HTMLElement)?.tagName || "",
            ) &&
            e.code !== "Escape"
        )
            return;
        for (let i = keyHandlers.length - 1; i >= 0; i--) {
            if (keyHandlers[i](e, mode) === true) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }
        if (mode !== "play") {
            e.stopPropagation();
            if (["Space", "Tab"].includes(e.code)) e.preventDefault();
        }
    });

    const root = document.getElementById("sys-root");
    for (const ev of ["mousedown", "pointerdown", "wheel", "click", "auxclick"])
        root?.addEventListener(ev, (e) => {
            if (mode !== "play") e.stopPropagation();
        });

    let hadLock = false,
        lockLostAt = 0,
        overlay = false;
    document.addEventListener("pointerlockchange", () => {
        const locked = !!document.pointerLockElement;
        if (!locked && hadLock && mode === "play" && !overlay) {
            lockLostAt = performance.now();
            emit("flow:lockLost", undefined);
        }
        hadLock = locked;
    });

    return {
        get mode() {
            return mode;
        },
        get isPlaying() {
            return mode === "play";
        },
        get lockLostAt() {
            return lockLostAt;
        },
        setMode,
        clearInput,
        set overlay(v: boolean) {
            overlay = !!v;
        },
        get overlay() {
            return overlay;
        },
        setCameraHook(fn: ((dt: number) => void) | null) {
            cameraHook = fn;
        },
        onKey(fn: (e: KeyboardEvent, mode: FlowMode) => boolean | void) {
            keyHandlers.push(fn);
            return () => {
                const i = keyHandlers.indexOf(fn);
                if (i >= 0) keyHandlers.splice(i, 1);
            };
        },
    };
}
