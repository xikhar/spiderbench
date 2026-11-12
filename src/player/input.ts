/**
 * Input controller for keyboard, mouse, and gamepad actions.
 *
 * @module player-input
 * @version 1.0.0
 * @file src/player/input.ts
 * @since 0.0.1
 * @description Collects device input and produces polled movement, look, and action state including pressed/released edge flags.
 */

export interface MoveState {
    x: number;
    y: number;
}
export interface LookState {
    dx: number;
    dy: number;
}

export interface InputState {
    move: MoveState;
    look: LookState;
    usingPad: boolean;
    swing: boolean;
    jump: boolean;
    zip: boolean;
    sprint: boolean;
    walk: boolean;
    drop: boolean;
    quick: boolean;
    rope: boolean;
    jumpHeld: number;
    aimT: number;
    ctrl?: boolean;
    slingL?: boolean;
    slingR?: boolean;
    swingPressed?: boolean;
    jumpPressed?: boolean;
    zipPressed?: boolean;
    dropPressed?: boolean;
    sprintPressed?: boolean;
    walkPressed?: boolean;
    quickPressed?: boolean;
    ropePressed?: boolean;
    swingReleased?: boolean;
    jumpReleased?: boolean;
    zipReleased?: boolean;
    dropReleased?: boolean;
    sprintReleased?: boolean;
    walkReleased?: boolean;
    quickReleased?: boolean;
    ropeReleased?: boolean;
}

export interface InputController {
    keys: Set<string>;
    mouse: { dx: number; dy: number; buttons: number };
    state: InputState;
    poll: (dt?: number) => InputState;
    sling: { gate: boolean; tap: number; held: number };
    press: (code: string) => void;
    release: (code: string) => void;
    releaseAll: () => void;
    consumeMouse: () => { dx: number; dy: number };
}

export function createInput(el: HTMLElement): InputController {
    const keys = new Set<string>();
    const tapped = new Set<string>();
    const mouse = { dx: 0, dy: 0, buttons: 0 };
    const synthetic = new Set<string>();
    const isTyping = (e: KeyboardEvent) =>
        /^(INPUT|TEXTAREA|SELECT)$/.test(
            (e.target as HTMLElement | null)?.tagName || "",
        );
    addEventListener("keydown", (e: KeyboardEvent) => {
        if (isTyping(e)) return;
        if (!e.repeat) tapped.add(e.code);
        keys.add(e.code);
        if (
            ["Space", "Tab", "ControlLeft", "KeyC"].includes(e.code) &&
            !e.metaKey
        )
            e.preventDefault();

        if (e.ctrlKey && /^(Key[WASDEFQRCZ]|Space|Arrow)/.test(e.code))
            e.preventDefault();
    });
    addEventListener("keyup", (e: KeyboardEvent) => keys.delete(e.code));
    addEventListener("blur", () => {
        keys.clear();
        mouse.buttons = 0;
    });
    el.addEventListener("click", () => {
        try {
            el.requestPointerLock?.();
        } catch {
            void 0;
        }
    });
    addEventListener("mousemove", (e: MouseEvent) => {
        if (typeof e.buttons === "number" && !document.pointerLockElement) {
            if (mouse.buttons & 4 && !(e.buttons & 2)) mouse.buttons &= ~4;
            if (mouse.buttons & 2 && !(e.buttons & 4)) mouse.buttons &= ~2;
        }
        if (document.pointerLockElement) {
            mouse.dx += e.movementX;
            mouse.dy += e.movementY;
        } else if (mouse.buttons & 1) {
            mouse.dx += e.movementX;
            mouse.dy += e.movementY;
        }
    });
    const tappedBtn = { v: 0 };

    const sling = { gate: false, tap: 0, held: 0 };
    const ctrlHeld = (e: MouseEvent) =>
        e.ctrlKey ||
        keys.has("ControlLeft") ||
        keys.has("ControlRight") ||
        synthetic.has("ControlLeft");
    addEventListener("mousedown", (e: MouseEvent) => {
        if ((e.button === 0 || e.button === 2) && sling.gate && ctrlHeld(e)) {
            sling.tap |= 1 << e.button;
            sling.held |= 1 << e.button;
            e.preventDefault();
            return;
        }
        mouse.buttons |= 1 << e.button;
        tappedBtn.v |= 1 << e.button;
        if (e.button === 1) e.preventDefault();
    });
    addEventListener("mouseup", (e: MouseEvent) => {
        mouse.buttons &= ~(1 << e.button);
        sling.held &= ~(1 << e.button);
    });
    addEventListener("contextmenu", (e: Event) => e.preventDefault());
    addEventListener("auxclick", (e: Event) => e.preventDefault());

    const prev: Record<string, boolean> = {};
    const state: InputState = {
        move: { x: 0, y: 0 },
        look: { dx: 0, dy: 0 },
        usingPad: false,
        swing: false,
        jump: false,
        zip: false,
        sprint: false,
        walk: false,
        drop: false,
        quick: false,
        rope: false,
        jumpHeld: 0,
        aimT: 99,
    };
    const dz = (v: number) =>
        Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85;
    const has = (c: string) => keys.has(c) || synthetic.has(c) || tapped.has(c);
    const BTN: Record<string, number> = {
        MouseLeft: 1,
        MouseMiddle: 2,
        MouseRight: 4,
    };

    function poll(dt = 1 / 60): InputState {
        let mx = 0,
            my = 0;
        if (has("KeyW") || has("ArrowUp")) my += 1;
        if (has("KeyS") || has("ArrowDown")) my -= 1;
        if (has("KeyD") || has("ArrowRight")) mx += 1;
        if (has("KeyA") || has("ArrowLeft")) mx -= 1;
        let lx = mouse.dx,
            ly = mouse.dy;
        mouse.dx = mouse.dy = 0;
        let btn = mouse.buttons | tappedBtn.v;
        tappedBtn.v = 0;
        for (const [k, b] of Object.entries(BTN))
            if (synthetic.has(k)) btn |= b;
        let swing = !!(btn & 4);
        let sprint = has("ShiftLeft") || has("ShiftRight");
        const walk = false;
        let jump = has("Space");
        let zip = has("KeyE") || !!(btn & 2);
        let quick = has("KeyQ");
        const rope = has("KeyT");
        let drop = has("KeyC") || has("ControlLeft") || has("ControlRight");
        const ctrl =
            keys.has("ControlLeft") ||
            keys.has("ControlRight") ||
            synthetic.has("ControlLeft") ||
            synthetic.has("ControlRight");
        const slingL = !!(sling.tap & 1),
            slingR = !!(sling.tap & 4);
        sling.tap = 0;
        let usingPad = false;
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const p of pads) {
            if (!p || p.mapping !== "standard") continue;
            const ax = dz(p.axes[0]),
                ay = dz(p.axes[1]),
                rx = dz(p.axes[2]),
                ry = dz(p.axes[3]);
            const b = (i: number) => !!p.buttons[i]?.pressed;
            const rt = (p.buttons[7]?.value ?? 0) > 0.3,
                lt = (p.buttons[6]?.value ?? 0) > 0.3;
            if (ax || ay || rx || ry || rt || lt || b(0) || b(1) || b(3))
                usingPad = true;
            mx += ax;
            my -= ay;
            lx += rx * 900 * dt;
            ly += ry * 600 * dt;

            const zipCombo = lt && rt;
            quick ||= b(4) && !b(5);
            swing ||= rt && !zipCombo;
            sprint ||= rt && !zipCombo;
            jump ||= b(0);
            zip ||= zipCombo || b(3);
            drop ||= b(1);
        }
        tapped.clear();
        const len = Math.hypot(mx, my);
        if (len > 1) {
            mx /= len;
            my /= len;
        }
        Object.assign(state, {
            move: { x: mx, y: my },
            look: { dx: lx, dy: ly },
            swing,
            jump,
            zip,
            drop,
            sprint,
            walk,
            quick,
            rope,
            usingPad,
            ctrl,
            slingL,
            slingR,
        });
        for (const k of [
            "swing",
            "jump",
            "zip",
            "drop",
            "sprint",
            "walk",
            "quick",
            "rope",
        ] as const) {
            (state as any)[k + "Pressed"] = state[k] && !prev[k];
            (state as any)[k + "Released"] = !state[k] && prev[k];
            prev[k] = state[k];
        }
        state.jumpHeld = jump ? state.jumpHeld + dt : 0;
        state.aimT = Math.abs(lx) + Math.abs(ly) > 1.5 ? 0 : state.aimT + dt;
        return state;
    }

    return {
        keys,
        mouse,
        state,
        poll,
        sling,
        press(code: string) {
            synthetic.add(code);
        },
        release(code: string) {
            synthetic.delete(code);
        },
        releaseAll() {
            synthetic.clear();
        },
        consumeMouse() {
            const r = { dx: mouse.dx, dy: mouse.dy };
            mouse.dx = mouse.dy = 0;
            return r;
        },
    };
}
