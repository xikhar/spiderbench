import { defineConfig } from 'vite';

const maximumChunkSize = 400 * 1024;

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
    target: 'esnext',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'shots',
              test: /[/\\]src[/\\]shots\.ts$/,
              maxSize: maximumChunkSize,
              entriesAware: true,
              priority: 5,
            },
            {
              name: 'three',
              test: /[/\\]node_modules[/\\]three[/\\]/,
              maxSize: maximumChunkSize,
              entriesAware: true,
              priority: 50,
            },
            {
              name: 'postprocessing',
              test: /[/\\]node_modules[/\\]postprocessing[/\\]/,
              maxSize: maximumChunkSize,
              entriesAware: true,
              priority: 25,
            },
            {
              name: 'n8ao',
              test: /[/\\]node_modules[/\\]n8ao[/\\]/,
              maxSize: maximumChunkSize,
              entriesAware: true,
              priority: 25,
            },
            {
              name: 'layoutConstants',
              test: /[/\\]src[/\\]world[/\\]layoutConstants\.ts$/,
              priority: 40,
            },
            {
              name: 'performanceFlags',
              test: /[/\\]src[/\\]world[/\\]performanceFlags\.ts$/,
              priority: 40,
            },
            {
              name: 'vehicleLighting',
              test: /[/\\]src[/\\]world[/\\]vehicleLighting\.ts$/,
              priority: 40,
            },
            {
              name: 'world',
              test: /[/\\]src[/\\]world[/\\]/,
              maxSize: maximumChunkSize,
              entriesAware: true,
              priority: 15,
            },
            {
              name: 'render',
              test: /[/\\]src[/\\]render[/\\]/,
              maxSize: maximumChunkSize,
              entriesAware: true,
              priority: 15,
            },
            {
              name: 'player',
              test: /[/\\]src[/\\]player[/\\]/,
              maxSize: maximumChunkSize,
              entriesAware: true,
              priority: 15,
            },
          ],
        },
      },
    },
  },
});
