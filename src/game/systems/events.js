// OWNER: systems engineer. Tiny synchronous event bus shared by every game system (open world, combat, UI).
//   import { on, once, off, emit } from './game/systems/events.js'   (also on window.__ctx.events)
//   const unsub = on('crime:engage', (e) => { e.claim(); ...spawn enemies...; later emit('crime:resolve', { id: e.id, success: true }) });
// Event catalogue (payload):
//   xp:gain {amount, reason, total}          level:up {level, skillPoints}
//   tower:activated {id, district}           district:unlocked {id, name}
//   collectible:pickup {kind:'backpack', id, item, pos:Vector3}   (animation layer: play a pickup gesture on this)
//   collectible:photo {kind:'landmark'|'secretPhoto', id, name}
//   crime:spawn crime   crime:engage crime (+ crime.claim())   crime:resolve {id, success}  <- emitted BY combat
//   crime:resolved crime   crime:failed crime   crime:expired crime   crime:cleared {id} <- emitted BY combat (all enemies down)
//   crime:zone {id, pos, radius, active, type, moving?}  -> city life: civilians within radius flee
//   waypoint:set {pos}|null   fasttravel:start {station}   fasttravel:end {station}
//   suit:changed {id}   skill:unlocked {id}   params:changed params   settings:changed settings
//   pause {tab}   resume   photomode:enter   photomode:exit   photo:captured {landmarks:[ids], url}
//   player:thwip {hand}   player:land {severity}   (derived from traversal state; used by audio/NPC reactions)
const handlers = new Map();

export function on(type, fn) {
    let s = handlers.get(type);
    if (!s) handlers.set(type, (s = new Set()));
    s.add(fn);
    return () => s.delete(fn);
}
export function off(type, fn) {
    handlers.get(type)?.delete(fn);
}
export function once(type, fn) {
    const u = on(type, (p, t) => {
        u();
        fn(p, t);
    });
    return u;
}
export function emit(type, payload) {
    const list = [...(handlers.get(type) || []), ...(handlers.get("*") || [])];
    for (const fn of list) {
        try {
            fn(payload, type);
        } catch (e) {
            console.error(`[events] handler for "${type}" failed`, e);
        }
    }
    return list.length;
}
export function listenerCount(type) {
    return handlers.get(type)?.size || 0;
}
export const events = { on, off, once, emit, listenerCount };
export default events;
