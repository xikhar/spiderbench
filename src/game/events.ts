/**
 * Shared game event bus.
 *
 * @module src-game-events
 * @version 1.0.0
 * @file src/game/events.ts
 * @since 0.0.1
 * @description Provides the synchronous event emitter used by game systems, combat, UI, and gameplay modules.
 */

export type EventHandler<T = unknown> = (payload: T, type: string) => void;

const handlers = new Map<string, Set<EventHandler>>();

export function on<T = unknown>(type: string, fn: EventHandler<T>): () => void {
    let set = handlers.get(type);
    if (!set) {
        set = new Set();
        handlers.set(type, set);
    }
    set.add(fn as EventHandler);
    return () => {
        set?.delete(fn as EventHandler);
    };
}

export function off<T = unknown>(type: string, fn: EventHandler<T>): void {
    handlers.get(type)?.delete(fn as EventHandler);
}

export function once<T = unknown>(
    type: string,
    fn: EventHandler<T>,
): () => void {
    const unsubscribe = on(type, (payload, eventType) => {
        unsubscribe();
        fn(payload as T, eventType);
    });
    return unsubscribe;
}

export function emit<T = unknown>(type: string, payload: T): number {
    const list = [...(handlers.get(type) ?? []), ...(handlers.get("*") ?? [])];
    for (const fn of list) {
        try {
            fn(payload, type);
        } catch (error) {
            console.error(`[events] handler for "${type}" failed`, error);
        }
    }
    return list.length;
}

export function listenerCount(type: string): number {
    return handlers.get(type)?.size ?? 0;
}

export const events = { on, off, once, emit, listenerCount };
export default events;
