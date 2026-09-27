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
//  ui/boot.js          bootStage(text), bootProgress(step, f?) -> Promise|undefined, bootDone(instant?)  loading screen
import * as THREE from 'three';
import { createPipeline } from './render/pipeline.js';
import { createLighting } from './render/lighting.js';
import { buildCity } from './world/city.js';
import { createPlayer } from './player/player.js';
import { createInput } from './player/input.js';
import { createHud } from './ui/hud.js';
import { SHOTS } from './shots.js';
import { bootStage, bootProgress, bootDone } from './ui/boot.js';
import { createWarmup, sceneTextures } from './render/warmup.js'; // (perf r3)
import { REFL_LAYER } from './world/water.js';
import { BIG_CASTER_LAYER } from './render/csm.js';

bootProgress('start'); // the modules are loaded
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, reversedDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // tone mapping done in pipeline
// (zfix) three r186 negates only polygonOffsetFactor for the reversed depth buffer, so every decal's negative
// polygonOffsetUnits ("pull toward the camera") pushed it AWAY: face-on (no depth slope, the factor term ~0) coplanar
// decals lost / flickered against the surface below. Re-issue the offset with both terms negated.
if (renderer.capabilities.reversedDepthBuffer && !params.has('nozfix')) {
  const gl = renderer.getContext(), st = renderer.state, setMat = st.setMaterial;
  st.setMaterial = function (material, frontFaceCW, clip) {
    setMat.call(this, material, frontFaceCW, clip);
    if (material.polygonOffset) gl.polygonOffset(-material.polygonOffsetFactor, -material.polygonOffsetUnits);
  };
}
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// far plane 150 km (foundation agent): the harbour, far shores and distant hinterland run out to the (fogged) true
// horizon instead of being clipped into a hard band at 6 km (reversed float depth keeps precision at this range)
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 150000);

const lighting = createLighting({ renderer, scene });
bootStage('Building the city');
const world = await buildCity({ scene, renderer, progress: bootProgress });
const input = createInput(renderer.domElement);
bootStage('Suiting up');
const player = await createPlayer({ scene, world, camera, input, renderer });
await bootProgress('player');
const hud = createHud({ player, world, camera });
const pipeline = createPipeline({ renderer, scene, camera, lighting });
await bootProgress('pipeline');

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); pipeline.setSize(innerWidth, innerHeight);
});

const ctx = { THREE, renderer, scene, camera, lighting, world, player, hud, pipeline, input };
ctx.systems = ctx.systems || []; // C5: game systems (src/game/**) push {update(dt)} here
window.__ctx = ctx;
bootStage('Warming up the GPU');
// (perf r3) queue every shader program the game can draw (main pass + the river mirror's unshadowed variant + the
// post passes) before the first frame: they link in parallel on the driver's threads during the loading frame instead
// of one by one later, each freezing the game for 0.2-6 s the first time its material came into view
// (render/warmup.js). ?nowarm = old behaviour (A/B)
const warmup = !shotName && !params.has('nowarm') ? createWarmup(renderer, scene, camera, { mirrorLayers: [REFL_LAYER, BIG_CASTER_LAYER] }) : null;
// first the state the first frame would set that is part of the program keys: the sky IBL (scene.environment, from the
// first lighting update) and the pipeline's NO_SSR material defines
if (warmup) { lighting.update(camera); pipeline.prepareMaterials?.(); warmup.rescan(); warmup.flush(); }
await bootProgress('shaders');
const tex = sceneTextures(scene); // uploaded one by one (the first frame would do them in one block): the bar advances
for (let i = 0; i < tex.length; i++) { renderer.initTexture(tex[i]); await bootProgress('textures', (i + 1) / tex.length); }
if (!shotName) import('./game/systems/index.js').then(m => m.initSystems(ctx)).catch(e => console.error('[systems] init failed', e)) // open-world systems (C5)
  .then(() => import('./game/combat/index.js')).then(m => m.initCombat(ctx)).catch(e => console.error('[combat] init failed', e)) // combat (C5)
  .then(() => warmup?.rescan()); // (perf r3) + the meshes the systems / combat added (trickled by warmup.step)
ctx.timeScale = 1; // global game-time scale (combat hit-stop / slow-mo); ctx.realDt = unscaled frame time

if (shotName) {
  const shot = SHOTS[shotName];
  if (!shot) throw new Error('unknown shot ' + shotName);
  bootDone(true);
  shot.apply(ctx);
  // Warm up: let shadows, TAA/accumulation, streaming settle.
  const dt = 1 / 60;
  for (let i = 0; i < (shot.frames ?? 90); i++) {
    shot.tick?.(ctx, dt, i);
    world.update(dt, camera); lighting.update(camera); hud.update(dt);
    pipeline.render(dt);
    await new Promise(r => requestAnimationFrame(r));
  }
  window.__shotInfo = `${renderer.info.render.calls} calls, ${renderer.info.render.triangles} tris`;
  window.__shotReady = true;
} else {
  const clock = new THREE.Clock();
  let booted = false;
  renderer.setAnimationLoop(() => {
    ctx.realDt = Math.min(clock.getDelta(), 1 / 20);
    const dt = ctx.realDt * (ctx.timeScale ?? 1);
    player.update(dt); world.update(dt, camera); lighting.update(camera); hud.update(dt);
    for (const s of ctx.systems) s.update?.(dt);
    pipeline.render(dt);
    if (!booted) { booted = true; bootDone(); } // the first frame (and its shader links) is done: fade the loading screen
    warmup?.step(); // (perf r3)
  });
}
