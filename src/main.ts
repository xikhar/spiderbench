// Integration entry. OWNER: orchestrator. Module contracts:
//  render/pipeline.ts  createPipeline({renderer, scene, camera}) -> {render(dt), setSize(w,h), setFocus?(dist)}
//  render/lighting.ts  createLighting({renderer, scene}) -> {sun, update(camera), timeOfDay}
//  world/city.ts       buildCity({scene, renderer}) -> Promise<world>
//                      world = {raycast(origin:Vector3, dir:Vector3, max):{point,normal,distance}|null,
//                               groundHeight(x,z):number, spawn:Vector3, update(dt, camera)}
//  player/player.ts    createPlayer({scene, world, camera, input, renderer}) -> Promise<player>
//                      player = {update(dt), object:Object3D, applyShot(name)->boolean}
//  ui/hud.ts           createHud({player, world}) -> {update(dt), setVisible(b)}
//  screenshotPresets.ts            SCREENSHOT_PRESETS[name] = {time?, apply(ctx)}  deterministic poses for screenshot/critique
import * as THREE from "three";
import { createPipeline } from "./render/pipeline.ts";
import { createLighting } from "./render/lighting.ts";
import { buildCity } from "./world/city.ts";
import { createPlayer } from "./player/player.ts";
import { createInput } from "./player/input.ts";
import { createHud } from "./ui/hud.ts";
import { createWarmup } from "./render/warmup.ts"; // (perf r3)
import { getRenderPixelRatio } from "./render/quality.ts";
import { REFL_LAYER } from "./world/waterLayers.ts";
import { BIG_CASTER_LAYER } from "./render/cascadedShadows.ts";
import { configureKTX2Loader } from "./render/ktx2.ts";
import { auditSceneTextures } from "./render/textureAudit.ts";

const params = new URLSearchParams(location.search);
const shotName = params.get("shot");
// loading screen (index.html): stage labels + progress; it fades out once the first frames and the game systems are up
const boot = window.__boot || { stage: async () => { }, sub() { }, done() { } };

type RuntimeContext = {
  THREE: typeof THREE;
  renderer: typeof renderer;
  scene: typeof scene;
  camera: typeof camera;
  lighting: typeof lighting;
  world: typeof world;
  player: typeof player;
  hud: typeof hud;
  pipeline: typeof pipeline;
  input: typeof input;
  systems: Array<{ name?: string; update?: (dt: number) => void }>;
  timeScale: number;
  realDt?: number;
  setFpsLimit?: (value: number) => void;
  stepFrame?: (dt: number) => void;
  manualStep?: boolean;
};

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "high-performance",
  stencil: false,
  reversedDepthBuffer: true,
});
renderer.setPixelRatio(getRenderPixelRatio(renderer));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // tone mapping done in pipeline
configureKTX2Loader(renderer);
// (zfix) three r186 negates only polygonOffsetFactor for the reversed depth buffer, so every decal's negative
// polygonOffsetUnits ("pull toward the camera") pushed it AWAY: face-on (no depth slope, the factor term ~0) coplanar
// decals lost / flickered against the surface below. Re-issue the offset with both terms negated.
if (renderer.capabilities.reversedDepthBuffer && !params.has("nozfix")) {
  const gl = renderer.getContext(),
    st = renderer.state,
    setMat = st.setMaterial;
  st.setMaterial = function (material: any, frontFaceCW: any, clip: any) {
    setMat.call(this, material, frontFaceCW, clip);
    if (material.polygonOffset)
      gl.polygonOffset(
        -material.polygonOffsetFactor,
        -material.polygonOffsetUnits,
      );
  };
}
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// far plane 150 km (foundation agent): the harbour, far shores and distant hinterland run out to the (fogged) true
// horizon instead of being clipped into a hard band at 6 km (reversed float depth keeps precision at this range)
const camera = new THREE.PerspectiveCamera(
  55,
  innerWidth / innerHeight,
  0.1,
  150000,
);

const lighting = createLighting({ renderer, scene });
const world = await buildCity({ scene, renderer });
const input = createInput(renderer.domElement);
await boot.stage("player");
const player = await createPlayer({ scene, world, camera, input, renderer });
await boot.stage("shaders");
const hud = createHud({ player, world, camera });
const pipeline = createPipeline({ renderer, scene, camera, lighting });
// Run again from DevTools after viewing a new area to inspect textures loaded later.
(window as any).auditSceneTextures = () => auditSceneTextures(renderer, scene);

let resizeTimeout: number | undefined;
addEventListener("resize", () => {
  // Render-target resizing reallocates many GPU textures. Wait for a resize burst to settle
  // so dragging the window edge does not repeat that work for every intermediate size.
  if (resizeTimeout !== undefined) clearTimeout(resizeTimeout);
  resizeTimeout = window.setTimeout(() => {
    resizeTimeout = undefined;
    const width = innerWidth;
    const height = innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    pipeline.setSize(width, height);
  }, 120);
});

const ctx: RuntimeContext = {
  THREE,
  renderer,
  scene,
  camera,
  lighting,
  world,
  player,
  hud,
  pipeline,
  input,
  systems: [],
  timeScale: 1,
};
window.__ctx = ctx;
// console.log("[DEBUG] Context initialized:", window.__ctx);
// console.log("[DEBUG] Renderer:", window.__ctx.renderer);
// (perf r3) queue every shader program the game can draw (main pass + the river mirror's unshadowed variant + the
// post passes) before the first frame: they link in parallel on the driver's threads during the loading frame instead
// of one by one later, each freezing the game for 0.2-6 s the first time its material came into view
// (render/warmup.ts). ?nowarm = old behaviour (A/B)
const warmup =
  !shotName && !params.has("nowarm")
    ? createWarmup(renderer, scene, camera, {
      mirrorLayers: [REFL_LAYER, BIG_CASTER_LAYER],
    })
    : null;
// first the state the first frame would set that is part of the program keys: the sky IBL (scene.environment, from the
// first lighting update) and the pipeline's NO_SSR material defines
if (warmup) {
  lighting.update(camera);
  pipeline.prepareMaterials?.();
  warmup.rescan();
  warmup.flush();
  await warmup.settle((k) => boot.sub(k));
}
await boot.stage("frame");
let framesDrawn = 0;
const systemsReady = shotName
  ? Promise.resolve()
  : import("./game/systems/gameSystems.ts")
    .then((m) => m.initSystems(ctx))
    .catch((e) => console.error("[systems] init failed", e)) // open-world systems (C5)
    .then(() => import("./game/combat/combat.ts"))
    .then((m) => m.initCombat(ctx))
    .catch((e) => console.error("[combat] init failed", e)) // combat (C5)
    .then(() => warmup?.rescan()); // (perf r3) + the meshes the systems / combat added (trickled by warmup.step)
// the loading screen goes once the game systems (HUD, save position) are in and a few frames have been drawn
systemsReady.then(async () => {
  boot.sub(0.8);
  while (framesDrawn < 4) await new Promise((r) => requestAnimationFrame(r));
  boot.done();
});
ctx.timeScale = 1; // global game-time scale (combat hit-stop / slow-mo); ctx.realDt = unscaled frame time

if (shotName) {
  const { SCREENSHOT_PRESETS } = await import("./screenshotPresets.ts");
  const shot = SCREENSHOT_PRESETS[shotName];
  if (!shot) throw new Error("unknown shot " + shotName);
  shot.apply(ctx);
  // Warm up: let shadows, TAA/accumulation, streaming settle.
  const dt = 1 / 60;
  for (let i = 0; i < (shot.frames ?? 90); i++) {
    shot.tick?.(ctx, dt, i);
    world.update(dt, camera);
    lighting.update(camera);
    hud.update(dt);
    pipeline.render(dt);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }
  auditSceneTextures(renderer, scene);
  window.__shotInfo = `${renderer.info.render.calls} calls, ${renderer.info.render.triangles} tris`;
  window.__shotReady = true;
} else {
  // clock is depreciated, used timer
  const timer = new THREE.Timer();
  const cpuProfileEnabled = params.has("cpuprof");
  const cpuProfileStats = new Map<
    string,
    { count: number; total: number; max: number }
  >();
  let cpuPhase: string | null = null;
  let cpuPhaseStart = 0;
  let cpuNextReport = performance.now() + 3000;
  function markCpuPhase(next: string | null) {
    if (!cpuProfileEnabled) return;
    const now = performance.now();
    if (cpuPhase !== null) {
      const elapsed = now - cpuPhaseStart;
      const stat = cpuProfileStats.get(cpuPhase) ?? {
        count: 0,
        total: 0,
        max: 0,
      };
      stat.count++;
      stat.total += elapsed;
      stat.max = Math.max(stat.max, elapsed);
      cpuProfileStats.set(cpuPhase, stat);
    }
    cpuPhase = next;
    cpuPhaseStart = now;
  }
  function reportCpuProfile() {
    if (!cpuProfileEnabled) return;
    const now = performance.now();
    if (now < cpuNextReport) return;
    const report = [...cpuProfileStats.entries()]
      .sort((a, b) => b[1].max - a[1].max)
      .map(
        ([name, stat]) =>
          `${name}: max ${stat.max.toFixed(1)} ms, avg ${(stat.total / stat.count).toFixed(1)} ms (${stat.count})`,
      );
    console.info(`[cpu-prof] ${report.join(" | ") || "no samples"}`);
    cpuProfileStats.clear();
    cpuNextReport = now + 3000;
  }
  let fpsLimit = renderer.capabilities.maxTextures <= 16 ? 30 : 60;
  let nextFrameAt = 0;
  let fpsVisible = false;
  let fpsFrameCount = 0;
  let fpsWindowStart = performance.now();
  const fpsReadout = document.createElement("div");
  fpsReadout.id = "fps-readout";
  fpsReadout.textContent = "FPS: --";
  fpsReadout.style.cssText =
    "position:fixed;top:10px;right:12px;z-index:10000;display:none;pointer-events:none;padding:5px 8px;border:1px solid rgba(180,210,255,.35);border-radius:4px;background:rgba(5,10,24,.78);color:#d9ffad;font:600 13px/1.2 ui-monospace,Consolas,monospace;text-shadow:0 1px 2px #000";
  document.body.appendChild(fpsReadout);

  addEventListener("keydown", (e) => {
    if (e.repeat || (e.code !== "Equal" && e.code !== "NumpadEqual")) return;
    if (
      e.target instanceof Element &&
      e.target.closest("input, textarea, select, [contenteditable='true']")
    )
      return;
    fpsVisible = !fpsVisible;
    fpsReadout.style.display = fpsVisible ? "block" : "none";
    fpsFrameCount = 0;
    fpsWindowStart = performance.now();
    if (fpsVisible) fpsReadout.textContent = "FPS: --";
  });

  function updateFpsReadout() {
    if (!fpsVisible) return;
    fpsFrameCount++;
    const now = performance.now();
    const elapsed = now - fpsWindowStart;
    if (elapsed < 500) return;
    fpsReadout.textContent = `FPS: ${Math.round((fpsFrameCount * 1000) / elapsed)}`;
    fpsFrameCount = 0;
    fpsWindowStart = now;
  }

  ctx.setFpsLimit = (value) => {
    const next = Number(value);
    const limit = Number.isFinite(next) && next > 0 ? next : 0;
    if (limit !== fpsLimit) {
      fpsLimit = limit;
      nextFrameAt = 0;
    }
  };

  function frame(realDt: number) {
    ctx.realDt = realDt;
    const dt = ctx.realDt * (ctx.timeScale ?? 1);

    markCpuPhase("player");
    player.update(dt);
    markCpuPhase("world");
    world.update(dt, camera);
    markCpuPhase("lighting");
    lighting.update(camera);
    markCpuPhase("hud");
    hud.update(dt);

    for (const [i, s] of ctx.systems.entries()) {
      markCpuPhase(s.name || `system-${i}`);
      s.update?.(dt);
    }

    markCpuPhase("render");
    pipeline.render(dt);
    markCpuPhase("shader-warmup");
    warmup?.step();
    markCpuPhase("frame-tail");
    updateFpsReadout();

    if (++framesDrawn === 1) boot.sub(0.4);
    if (framesDrawn === 4) auditSceneTextures(renderer, scene);
    markCpuPhase(null);
    reportCpuProfile();
  }
  // tools (tools/film.mjs): ctx.manualStep = true pauses the real-time loop; ctx.stepFrame(dt) then advances exactly one
  // frame of dt seconds (deterministic frame-by-frame captures of fast motion)
  ctx.stepFrame = (dt) => frame(dt);

  renderer.setAnimationLoop(() => {
    if (fpsLimit > 0) {
      const now = performance.now();
      if (now < nextFrameAt) return;
      nextFrameAt = now + 1000 / fpsLimit;
    }
    timer.update();

    const d = Math.min(timer.getDelta(), 1 / 20);

    if (!ctx.manualStep) frame(d);
  });
}
