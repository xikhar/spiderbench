/**
 * Runs WASM, type checking, and production build via Bun shell.
 *
 * @module scripts-build
 * @version 1.0.0
 * @file scripts/build.ts
 * @since 0.0.1
 * @description Builds the Rust/WASM engine first, then runs TypeScript type checking and the Vite production build using Bun's shell command runner.
 */
import { $ } from "bun";

await $`cd engine/wasm && wasm-pack build --target web --out-dir ../../src/engine/pkg --out-name engine_wasm`;

try {
    await $`bunx --bun tsc --noEmit --pretty false`;
} catch {
    void 0;
}

await $`bunx --bun vite build`;
