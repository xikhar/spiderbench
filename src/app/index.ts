/**
 * Application bootstrap API accessor for the browser runtime.
 *
 * @module app-index
 * @version 1.0.0
 * @file src/app/index.ts
 * @since 0.0.1
 * @description Provides getBootApi to retrieve the global boot interface from window or return a no-op fallback when unavailable.
 */

import type { BootApi } from "@/core/types/index.ts";

declare global {
    interface Window {
        __boot?: BootApi;
    }
}

export function getBootApi(): BootApi {
    return (
        window.__boot ?? {
            stage: async () => {},
            sub: () => {},
            done: () => {},
        }
    );
}
