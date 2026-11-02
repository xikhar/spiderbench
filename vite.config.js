import { defineConfig } from 'vite';

export default defineConfig({
base: '/spiderbench/',

server: {
    host: true,
    open: true,
},

build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: "esnext",
    chunkSizeWarningLimit: 2500,
},
});