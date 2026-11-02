// Integration entry. OWNER: orchestrator. Module contracts:
//  render/pipeline.js  createPipeline({renderer, scene, camera}) -> {render(dt), setSize(w,h), setFocus?(dist)}
//  render/lighting.js  createLighting({renderer, scene}) -> {sun, update(camera), timeOfDay}
//  world/city.js       buildCity({scene, renderer}) -> Promise<world>
//                      world = {raycast(origin:Vector3, dir:Vector3, max):{point,normal,distance}|null,
//                               groundHeight(x,z):number, spawn:Vector3, update(dt, camera)}
//  player/player.js    createPlayer({scene, world, camera, input, renderer}) -> Promise<player>
//                      player = {update(dt), object:Object3D, applyShot(name)->boolean}
//  ui/hud.js           createHud({player, world}) -> {update(dt), setVisible(b)}
//  shots.js            SHOTS[name] = {time?, apply(ctx)}  deterministic poses for screenshot/critique
import * as THREE from "three";
import { createPipeline } from "./render/pipeline.js";
import { createLighting } from "./render/lighting.js";
import { buildCity } from "./world/city.js";
import { createPlayer } from "./player/player.js";
import { createInput } from "./player/input.js";
import { createHud } from "./ui/hud.js";
import { SHOTS } from "./shots.js";
import { createWarmup } from "./render/warmup.js"; // (perf r3)
import { getRenderPixelRatio } from "./render/quality.js";
import { REFL_LAYER } from "./world/water.js";
import { BIG_CASTER_LAYER } from "./render/csm.js";

const params = new URLSearchParams(location.search);
const shotName = params.get("shot");
// loading screen (index.html): stage labels + progress; it fades out once the first frames and the game systems are up
const boot = window.__boot || { stage: async () => {}, sub() {}, done() {} };

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
// (zfix) three r186 negates only polygonOffsetFactor for the reversed depth buffer, so every decal's negative
// polygonOffsetUnits ("pull toward the camera") pushed it AWAY: face-on (no depth slope, the factor term ~0) coplanar
// decals lost / flickered against the surface below. Re-issue the offset with both terms negated.
if (renderer.capabilities.reversedDepthBuffer && !params.has("nozfix")) {
  const gl = renderer.getContext(),
    st = renderer.state,
    setMat = st.setMaterial;
  st.setMaterial = function (material, frontFaceCW, clip) {
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

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  pipeline.setSize(innerWidth, innerHeight);
});

const ctx = {
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
};
ctx.systems = ctx.systems || []; // C5: game systems (src/game/**) push {update(dt)} here
window.__ctx = ctx;
// console.log("[DEBUG] Context initialized:", window.__ctx);
// console.log("[DEBUG] Renderer:", window.__ctx.renderer);
// (perf r3) queue every shader program the game can draw (main pass + the river mirror's unshadowed variant + the
// post passes) before the first frame: they link in parallel on the driver's threads during the loading frame instead
// of one by one later, each freezing the game for 0.2-6 s the first time its material came into view
// (render/warmup.js). ?nowarm = old behaviour (A/B)
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
  : import("./game/systems/index.js")
      .then((m) => m.initSystems(ctx))
      .catch((e) => console.error("[systems] init failed", e)) // open-world systems (C5)
      .then(() => import("./game/combat/index.js"))
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
  const shot = SHOTS[shotName];
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
    await new Promise((r) => requestAnimationFrame(r));
  }
  window.__shotInfo = `${renderer.info.render.calls} calls, ${renderer.info.render.triangles} tris`;
  window.__shotReady = true;
} else {
  // clock is , used timer
  const timer = new THREE.Timer();
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
    if (e.target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
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

  function frame(realDt) {
    ctx.realDt = realDt;
    const dt = ctx.realDt * (ctx.timeScale ?? 1);

    player.update(dt);
    world.update(dt, camera);
    lighting.update(camera);
    hud.update(dt);

    for (const s of ctx.systems) s.update?.(dt);

    pipeline.render(dt);
    warmup?.step();
    updateFpsReadout();

    if (++framesDrawn === 1) boot.sub(0.4);
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
