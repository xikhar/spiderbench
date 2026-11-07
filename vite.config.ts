import { defineConfig, type Plugin } from 'vite';
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const maximumChunkSize = 400 * 1024;

function copyPublicAssetsAsync(): Plugin {
  let publicDir: string | false = false;
  let outDir = '';
  let pendingCopy: Promise<void> | undefined;
  let copyFailure: unknown;
  let copyDuration = 0;

  return {
    name: 'copy-public-assets-async',
    apply: 'build' as const,
    enforce: 'post' as const,
    configResolved(config) {
      publicDir = config.publicDir;
      outDir = resolve(config.root, config.build.outDir);
    },
    renderStart() {
      if (publicDir && resolve(publicDir) !== outDir) {
        // Vite clears outDir in its earlier `pre` renderStart hook. Start the static
        // asset copy here so it can overlap with bundle generation instead of blocking
        // the whole build in Vite's prepare-out-dir hook.
        const startedAt = performance.now();
        pendingCopy = cp(publicDir, outDir, { recursive: true, force: true })
          .then(() => {
            copyDuration = performance.now() - startedAt;
          })
          .catch((error: unknown) => {
            copyFailure = error;
          });
      }
    },
    async closeBundle() {
      await pendingCopy;
      if (copyFailure) throw copyFailure;
      if (copyDuration) {
        console.info(
          `[build-assets] public asset copy took ${Math.round(copyDuration)} ms (overlapped with bundle generation)`,
        );
      }
    },
  };
}

export default defineConfig({
  base: '/spiderbench/',
  plugins: [copyPublicAssetsAsync()],
  server: {
    host: true,
    open: true,
  },
  // Run the CSS transform in Lightning CSS instead of the JS-side PostCSS pipeline.
  // This app uses plain CSS and has no PostCSS plugins, so the faster native path is equivalent.
  css: {
    transformer: 'lightningcss',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The async build plugin above copies these files after Vite clears the output directory.
    copyPublicDir: false,
    sourcemap: true,
    target: 'esnext',
    rolldownOptions: {
      checks: {
        bundlerTimings: true,
      },
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
