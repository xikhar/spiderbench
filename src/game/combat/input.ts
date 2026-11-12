// @ts-nocheck
/**
 * Combat input handling.
 *
 * @module src-game-combat-input
 * @version 1.0.0
 * @file src/game/combat/input.ts
 * @since 0.0.1
 * @description Maps player input to combat actions and manages combat control state.
 */

const HOLD = 0.22;
const BUFFER = 0.45;

export type CombatAction =
    "attack" | "dodge" | "web" | "strike" | "throw" | "finisher" | "heal";

export interface CombatInput {
    enabled: boolean;
    poll(): void;
    has(k: string): boolean;
    take(k: string): boolean;
    holdNow(): boolean;
    clear(): void;
}

export function createCombatInput(
    realClock?: () => number,
    gameClock?: () => number,
): CombatInput {
    const rnow = realClock || (() => performance.now() / 1000);
    const gnow = gameClock || rnow;
    const pressed = new Map<string, number>();
    let lmbDown = false;
    let pressT = 0;
    let holdSent = true;
    let enabled = false;
    const typing = (e: KeyboardEvent) =>
        /^(INPUT|TEXTAREA|SELECT)$/.test(
            (e.target as HTMLElement | null)?.tagName || "",
        );
    const KEYS: Record<string, CombatAction> = {
        KeyF: "web",
        KeyR: "throw",
        KeyQ: "finisher",
        KeyZ: "heal",
        KeyC: "dodge",
        ControlLeft: "dodge",
        ControlRight: "dodge",
        KeyE: "strike",
    };
    const press = (k: string) => pressed.set(k, gnow());
    addEventListener("keydown", (e) => {
        if (!enabled || typing(e) || e.repeat) return;
        const k = KEYS[e.code];
        if (k) press(k);
    });
    addEventListener("mousedown", (e) => {
        if (!enabled) return;
        if (e.ctrlKey && (e.button === 0 || e.button === 2)) return;
        if (e.button === 0) {
            lmbDown = true;
            pressT = rnow();
            holdSent = false;
            press("attack");
        }
        if (e.button === 1) press("strike");
    });
    addEventListener("mouseup", (e) => {
        if (e.button === 0) {
            lmbDown = false;
            holdSent = true;
        }
    });
    addEventListener("blur", () => {
        lmbDown = false;
        holdSent = true;
    });
    const prev: boolean[] = [];
    let padDown = false;
    function pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const p of pads) {
            if (!p || p.mapping !== "standard") continue;
            const b = (i: number) => !!p.buttons[i]?.pressed;
            const edge = (i: number) => b(i) && !prev[i];
            if (edge(1)) press("dodge");
            if (b(4) && b(5) && (edge(4) || edge(5))) press("throw");
            else if (edge(5) && !b(4)) press("web");
            if (edge(3)) press("strike");
            if (edge(11)) press("finisher");
            if (edge(13)) press("heal");
            if (edge(2)) {
                padDown = true;
                pressT = rnow();
                holdSent = false;
                press("attack");
            }
            if (!b(2)) {
                if (padDown) holdSent = true;
                padDown = false;
            }
            for (let i = 0; i < p.buttons.length; i++) prev[i] = b(i);
            break;
        }
    }
    return {
        set enabled(v: boolean) {
            enabled = v;
            if (!v) {
                pressed.clear();
                holdSent = true;
            }
        },
        get enabled() {
            return enabled;
        },
        poll() {
            if (enabled) pollPad();
        },

        has(k: string) {
            const t = pressed.get(k);
            if (t == null) return false;
            if (gnow() - t > BUFFER) {
                pressed.delete(k);
                return false;
            }
            return true;
        },
        take(k: string) {
            const ok = this.has(k);
            pressed.delete(k);
            return ok;
        },

        holdNow() {
            if (!holdSent && (lmbDown || padDown) && rnow() - pressT >= HOLD) {
                holdSent = true;
                return true;
            }
            return false;
        },
        clear() {
            pressed.clear();
        },
    };
}
