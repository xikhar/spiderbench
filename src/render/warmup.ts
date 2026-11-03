// @ts-nocheck
// (perf r3) Shader warm-up. three compiles a program the first time a (material, object state, pass) combination is
// drawn, and ANGLE / the GL driver link a MeshStandard + 5-cascade PCF shader in 0.2-1.6 s, synchronously on the main
// thread (three's first-use getProgramInfoLog waits for it). Every material that first came into view while swinging
// (a far LOD tile, a pool that was empty at spawn, the water mirror's unshadowed variant of a tower, the motion-blur
// pass) froze the game for 0.2-6 s. The warm-up creates those programs ahead of time with renderer.compile(): with
// KHR_parallel_shader_compile the driver links them on its own threads while the game keeps running.
// At load everything is totalProgramsQueued before the first frame (the links overlap the loading frame, which compiled its own
// programs one by one anyway); meshes added later are trickled (a batch only once the previous one linked), so a
// program the game suddenly needs never waits behind a long compileQueue. Pure preparation: nothing is drawn and no object /
// material state changes -> identical frames.
//   const w = createWarmup(renderer, scene, camera, { mirrorLayers });  w.rescan(); w.flush()  (load)
//   later additions: w.rescan() then w.step() once per frame (trickled: <= perStep new programs, <= budgetMs)
import * as THREE from "three";
import { FullscreenPass } from "./fullscreenPass.ts";

type WarmupOptions = {
  mirrorLayers?: number[] | null;
  maxProgramsPerStep?: number;
  compileBudgetMs?: number;
};

type WarmupApi = {
  rescan(): void;
  readonly pending: number;
  settle(
    onProgress?: ((progress: number) => void) | null,
    timeoutMs?: number,
  ): Promise<void>;
  flush(): void;
  step(force?: boolean): boolean;
};

// renderer.compile() reads materials through traverse() and lights through
// traverseVisible(). This small root lets it compile only the queued objects.
const createCompileRoot = (objects) => ({
  traverse(callback) {
    for (const object of objects) callback(object);
  },
  traverseVisible: () => {},
});
const isDrawableObject = (object) =>
  (object.isMesh || object.isPoints || object.isLine || object.isSprite) &&
  object.material;

export function createWarmup(
  renderer: any,
  scene: any,
  camera: any,
  {
    mirrorLayers = null,
    maxProgramsPerStep = 4,
    compileBudgetMs = 2,
  }: WarmupOptions = {},
): WarmupApi {
  const warmupRenderTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
  });
  const compiledInMainPass = new WeakSet(); // objects already compiled in a given pass (per-pass sets)
  const compiledInMirrorPass = new WeakSet();
  let compileQueue = [],
    programsBeingLinked = [],
    warmupStartedAt = 0,
    totalProgramsQueued = 0;
  const mirrorCamera = camera.clone();
  mirrorCamera.layers.disableAll();
  if (mirrorLayers) for (const l of mirrorLayers) mirrorCamera.layers.enable(l);
  const fullscreenCamera = FullscreenPass.camera;
  const api: WarmupApi = {
    // Collect everything not compiled yet: [pass kind, object] (main pass for every drawable, mirror variant for the
    // meshes on the mirror's layers, the post passes)
    rescan() {
      if (!warmupStartedAt) warmupStartedAt = performance.now();
      scene.traverse((object) => {
        if (!isDrawableObject(object)) return;
        if (!compiledInMainPass.has(object)) {
          compiledInMainPass.add(object);
          compileQueue.push(0, object);
        }
        // mirror meshes: on its layers now, or able to join BIG_CASTER_LAYER later (csm.tagCasters tags shadow casters,
        // also the tiles that switch their shadows on later): meshes on the mirror layers + every shadow-casting-capable
        // one but the 'detail' / smallCasters batches the tagger skips
        if (
          mirrorLayers &&
          !compiledInMirrorPass.has(object) &&
          (object.layers.test(mirrorCamera.layers) ||
            (object.isMesh &&
              (object.castShadow ||
                /^(facade|roofs|facadeLod)\b/.test(object.name || "")) &&
              !/^detail\b/.test(object.name || "") &&
              !object.userData?.smallCasters))
        ) {
          compiledInMirrorPass.add(object);
          compileQueue.push(1, object);
        }
      });
      for (const pass of FullscreenPass.registeredPasses)
        if (!compiledInMainPass.has(pass.mesh)) {
          compiledInMainPass.add(pass.mesh);
          compileQueue.push(2, pass.mesh);
        }
    },
    get pending() {
      return compileQueue.length / 2;
    },
    // After flush(), poll every 60 ms until the queued programs have linked, so the
    // first frame does not stall on them; onProgress(0..1) feeds the loading screen. Resolves on timeout too.
    /**
     * @param {((progress: number) => void) | null} onProgress
     * @param {number} timeoutMs
     */
    settle(onProgress = null, timeoutMs = 25000) {
      const programsToWaitFor = programsBeingLinked.slice();
      const programCount = programsToWaitFor.length;
      const waitStartedAt = performance.now();
      return new Promise((res) => {
        const pollBudgetMs = 3,
          pollBatchSize = 32;
        const pendingPrograms = programsToWaitFor.slice();
        let cursor = 0;
        const poll = () => {
          const pollStartedAt = performance.now();
          let checked = 0;
          while (
            cursor < pendingPrograms.length &&
            checked < pollBatchSize &&
            performance.now() - pollStartedAt < pollBudgetMs
          ) {
            if (pendingPrograms[cursor].isReady?.() ?? true) {
              pendingPrograms[cursor] =
                pendingPrograms[pendingPrograms.length - 1];
              pendingPrograms.pop();
            } else cursor++;
            checked++;
          }
          onProgress?.(
            programCount
              ? (programCount - pendingPrograms.length) / programCount
              : 1,
          );
          const passComplete = cursor >= pendingPrograms.length;
          const timedOut = performance.now() - waitStartedAt > timeoutMs;
          if (
            pendingPrograms.length === 0 ||
            (timedOut && passComplete)
          ) {
            console.log(
              `[warmup] ${programCount - pendingPrograms.length}/${programCount} programs linked before the first frame (${((performance.now() - waitStartedAt) / 1000).toFixed(1)} s)`,
            );
            res();
          } else if (passComplete) {
            cursor = 0;
            setTimeout(poll, timedOut ? 0 : 60);
          } else setTimeout(poll, 0);
        };
        poll();
      });
    },
    // Compile everything at once during load, before the first frame.
    flush() {
      const originalProgramsPerStep = maxProgramsPerStep;
      const originalCompileBudgetMs = compileBudgetMs;
      maxProgramsPerStep = Infinity;
      compileBudgetMs = Infinity;
      programsBeingLinked.length = 0;
      try {
        api.step(true);
      } finally {
        maxProgramsPerStep = originalProgramsPerStep;
        compileBudgetMs = originalCompileBudgetMs;
      }
    },
    step(force = false) {
      if (!compileQueue.length) return false;
      programsBeingLinked = programsBeingLinked.filter(
        (program) => !(program.isReady?.() ?? true),
      );
      if (programsBeingLinked.length && !force) return true; // let the last batch link first
      const programs = renderer.info.programs;
      const existingProgramCount = programs.length;
      const previousRenderTarget = renderer.getRenderTarget();
      const shadowMapWasEnabled = renderer.shadowMap.enabled;
      renderer.setRenderTarget(warmupRenderTarget); // the game draws every pass into a render target (linear output in the key)
      try {
        let queueOffset = 0;
        const stepStartedAt = performance.now();
        while (
          queueOffset < compileQueue.length &&
          programs.length - existingProgramCount < maxProgramsPerStep &&
          performance.now() - stepStartedAt < compileBudgetMs
        ) {
          // <= ~2 ms of main-thread time per frame
          const passKind = compileQueue[queueOffset];
          const object = compileQueue[queueOffset + 1];
          queueOffset += 2;
          if (passKind === 1) {
            renderer.shadowMap.enabled = false;
            renderer.compile(createCompileRoot([object]), mirrorCamera, scene);
            renderer.shadowMap.enabled = shadowMapWasEnabled;
          } // river mirror: unshadowed
          else if (passKind === 2) {
            renderer.compile(
              createCompileRoot([object]),
              fullscreenCamera,
              createCompileRoot([]),
            );
          } else {
            renderer.compile(createCompileRoot([object]), camera, scene);
          }
        }
        compileQueue = compileQueue.slice(queueOffset);
      } catch (e) {
        console.warn("[warmup]", e);
        compileQueue = [];
      } finally {
        renderer.shadowMap.enabled = shadowMapWasEnabled;
        renderer.setRenderTarget(previousRenderTarget);
      }
      for (
        let programIndex = existingProgramCount;
        programIndex < programs.length;
        programIndex += 1
      ) {
        programsBeingLinked.push(programs[programIndex]);
      }
      totalProgramsQueued += programs.length - existingProgramCount;
      if (!compileQueue.length)
        console.log(
          `[warmup] ${totalProgramsQueued} programs queued so far (${programs.length} total), ${((performance.now() - warmupStartedAt) / 1000).toFixed(1)} s`,
        );
      return compileQueue.length > 0;
    },
  };
  return api;
}
