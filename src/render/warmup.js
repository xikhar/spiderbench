// (perf r3) Shader warm-up. three compiles a program the first time a (material, object state, pass) combination is
// drawn, and ANGLE / the GL driver link a MeshStandard + 5-cascade PCF shader in 0.2-1.6 s, synchronously on the main
// thread (three's first-use getProgramInfoLog waits for it). Every material that first came into view while swinging
// (a far LOD tile, a pool that was empty at spawn, the water mirror's unshadowed variant of a tower, the motion-blur
// pass) froze the game for 0.2-6 s. The warm-up creates those programs ahead of time with renderer.compile(): with
// KHR_parallel_shader_compile the driver links them on its own threads while the game keeps running.
// At load everything is queued before the first frame (the links overlap the loading frame, which compiled its own
// programs one by one anyway); meshes added later are trickled (a batch only once the previous one linked), so a
// program the game suddenly needs never waits behind a long queue. Pure preparation: nothing is drawn and no object /
// material state changes -> identical frames.
//   const w = createWarmup(renderer, scene, camera, { mirrorLayers });  w.rescan(); w.flush()  (load)
//   later additions: w.rescan() then w.step() once per frame (trickled: <= perStep new programs, <= budgetMs)
import * as THREE from 'three';
import { FSPass } from './common.js';

// duck-typed compile() root: compile() only calls traverse (materials) / traverseVisible (lights, when root != scene)
const sub = list => ({ traverse: f => { for (const o of list) f(o); }, traverseVisible: () => {} });
const drawable = o => (o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.material;

// (loading screen) every texture the scene's materials use: renderer.initTexture() them one by one before the first
// frame (which would upload them all in one ~1 s block), so the loading bar can advance between them. Same uploads.
export function sceneTextures(scene) {
  const T = new Set(), add = v => { if (v?.isTexture && !v.isRenderTargetTexture) T.add(v); };
  scene.traverse(o => { for (const m of [].concat(o.material ?? [])) for (const k in m) {
    if (k === 'uniforms') for (const u of Object.values(m.uniforms)) add(u?.value); else add(m[k]); } });
  return [...T];
}

export function createWarmup(renderer, scene, camera, { mirrorLayers = null, perStep = 4, budgetMs = 2 } = {}) {
  const rt1 = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const done = new WeakSet(); // objects already compiled in a given pass (per-pass sets)
  const doneM = new WeakSet();
  let queue = [], inFlight = [], t0 = 0, queued = 0;
  const mc = camera.clone(); mc.layers.disableAll(); if (mirrorLayers) for (const l of mirrorLayers) mc.layers.enable(l);
  const fsCam = FSPass.camera;
  const api = {
    // collect everything not compiled yet: [kind, object] (main pass for every drawable, the mirror variant for the
    // meshes on the mirror's layers, the post passes)
    rescan() {
      if (!t0) t0 = performance.now();
      scene.traverse(o => { if (!drawable(o)) return;
        if (!done.has(o)) { done.add(o); queue.push(0, o); }
        // mirror meshes: on its layers now, or able to join BIG_CASTER_LAYER later (csm.tagCasters tags shadow casters,
        // also the tiles that switch their shadows on later): meshes on the mirror layers + every shadow-casting-capable
        // one but the 'detail' / smallCasters batches the tagger skips
        if (mirrorLayers && !doneM.has(o) && (o.layers.test(mc.layers) || (o.isMesh && (o.castShadow || /^(facade|roofs|facadeLod)\b/.test(o.name || '')) && !/^detail\b/.test(o.name || '') && !o.userData?.smallCasters))) { doneM.add(o); queue.push(1, o); } });
      for (const p of FSPass.all) if (!done.has(p.mesh)) { done.add(p.mesh); queue.push(2, p.mesh); }
    },
    get pending() { return queue.length / 2; },
    // queue everything at once (at load, before the first frame: the links overlap the loading screen's first frame)
    flush() { const ps = perStep, bm = budgetMs; perStep = Infinity; budgetMs = Infinity; inFlight.length = 0; try { api.step(true); } finally { perStep = ps; budgetMs = bm; } },
    step(force = false) {
      if (!queue.length) return false;
      inFlight = inFlight.filter(p => !(p.isReady?.() ?? true));
      if (inFlight.length && !force) return true; // let the last batch link first
      const P = renderer.info.programs, n0 = P.length;
      const prevRT = renderer.getRenderTarget(), prevOn = renderer.shadowMap.enabled;
      renderer.setRenderTarget(rt1); // the game draws every pass into a render target (linear output in the key)
      try {
        let i = 0; const ts = performance.now();
        while (i < queue.length && P.length - n0 < perStep && performance.now() - ts < budgetMs) { // <= ~2 ms of main-thread time per frame
          const kind = queue[i], o = queue[i + 1]; i += 2;
          if (kind === 1) { renderer.shadowMap.enabled = false; renderer.compile(sub([o]), mc, scene); renderer.shadowMap.enabled = prevOn; } // river mirror: unshadowed
          else if (kind === 2) renderer.compile(sub([o]), fsCam, sub([]));
          else renderer.compile(sub([o]), camera, scene);
        }
        queue = queue.slice(i);
      } catch (e) { console.warn('[warmup]', e); queue = []; }
      finally { renderer.shadowMap.enabled = prevOn; renderer.setRenderTarget(prevRT); }
      for (let k = n0; k < P.length; k++) inFlight.push(P[k]);
      queued += P.length - n0;
      if (!queue.length) console.log(`[warmup] ${queued} programs queued so far (${P.length} total), ${((performance.now() - t0) / 1000).toFixed(1)} s`);
      return queue.length > 0;
    },
  };
  return api;
}
