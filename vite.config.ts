/**
 * Vite configuration for the spider project.
 *
 * @module vite-config
 * @version 1.0.0
 * @file vite.config.ts
 * @since 0.0.1
 * @description Defines Vite settings, including path aliases for source, tests, and scripts directories.
 */
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "@/tests": fileURLToPath(new URL("./tests", import.meta.url)),
            "@/scripts": fileURLToPath(new URL("./scripts", import.meta.url)),
        },
    },
});
