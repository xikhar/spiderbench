// OWNER: combat engineer. Combat buttons, read only while a fight is active.
//   LMB press = attack (fires on press) · LMB held past 0.22 s = launcher (cancels the jab) / air slam
//   Space (spider-sense) or C / Ctrl = dodge · F = web shooter · E / MMB = web strike · R = throw · Q = finisher · Z = heal
// Gamepad (standard): Square attack (hold = launcher) · Circle dodge · R1 web · Triangle web strike · L1+R1 throw ·
//   R3 finisher · D-pad down heal.
// Buffers are measured in GAME time (slow-mo stretches them with the action); the hold threshold in real time.
const HOLD = 0.22,
    BUFFER = 0.45;
export function createCombatInput(realClock, gameClock) {
    const rnow = realClock || (() => performance.now() / 1000);
    const gnow = gameClock || rnow;
    const pressed = new Map(); // action -> game time of the press (buffered until consumed or stale)
    let lmbDown = false,
        pressT = 0,
        holdSent = true;
    let enabled = false;
    const typing = (e) =>
        /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || "");
    const KEYS = {
        KeyF: "web",
        KeyR: "throw",
        KeyQ: "finisher",
        KeyZ: "heal",
        KeyC: "dodge",
        ControlLeft: "dodge",
        ControlRight: "dodge",
        KeyE: "strike",
    };
    const press = (k) => pressed.set(k, gnow());
    addEventListener("keydown", (e) => {
        if (!enabled || typing(e) || e.repeat) return;
        const k = KEYS[e.code];
        if (k) press(k);
    });
    addEventListener("mousedown", (e) => {
        if (!enabled) return;
        if (e.ctrlKey && (e.button === 0 || e.button === 2)) return; // Ctrl+click = web slingshot anchor (player/input.js), never an attack
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
    const prev = [];
    let padDown = false;
    function pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const p of pads) {
            if (!p || p.mapping !== "standard") continue;
            const b = (i) => !!p.buttons[i]?.pressed;
            const edge = (i) => b(i) && !prev[i];
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
        set enabled(v) {
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
        // buffered press still fresh (not consumed)
        has(k) {
            const t = pressed.get(k);
            if (t == null) return false;
            if (gnow() - t > BUFFER) {
                pressed.delete(k);
                return false;
            }
            return true;
        },
        take(k) {
            const ok = this.has(k);
            pressed.delete(k);
            return ok;
        },
        // 'hold' once LMB / Square has been held past the threshold (reported once per press)
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
