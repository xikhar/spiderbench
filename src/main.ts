/**
 * Capability layer is the boundary; no prototype patching.
 *
 * @module src-main
 * @version 1.0.0
 * @file src/main.ts
 * @since 0.0.1
 */

import "./styles/main.css";
import * as THREE from "three";
import { createPipeline } from "./render/pipeline.ts";
import { createLighting } from "./render/lighting.ts";
import { buildCity } from "./world/city.ts";
import { createPlayer } from "./player/player.ts";
import { createInput } from "./player/input.ts";
import { createHud } from "./ui/hud.ts";
import { SHOTS } from "./devtools/shots.ts";
import { createWarmup } from "./render/warmup.ts";
import { REFL_LAYER } from "./world/water.ts";
import { BIG_CASTER_LAYER } from "./render/csm.ts";
import { initWasmEngine } from "./engine/wasmBridge.ts";

const params = new URLSearchParams(location.search);
const shotName = params.get("shot");

const boot = (window as any).__boot || {
    stage: async () => {},
    sub() {},
    done() {},
};

await initWasmEngine();

const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
    stencil: false,
    reversedDepthBuffer: true,
});
renderer.setPixelRatio(
    Math.min(devicePixelRatio, params.has("hipi") ? 1.5 : 1),
);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

if (
    (renderer.capabilities as any).reversedDepthBuffer &&
    !params.has("nozfix")
) {
    const gl = renderer.getContext() as
        WebGLRenderingContext | WebGL2RenderingContext;
    const st = renderer.state as any;
    const setMat = st.setMaterial;
    st.setMaterial = function (material: any, frontFaceCW: any, clip: any) {
        setMat.call(this, material, frontFaceCW, clip);
        if (material.polygonOffset) {
            gl.polygonOffset(
                -material.polygonOffsetFactor,
                -material.polygonOffsetUnits,
            );
        }
    };
}
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

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
const hud = createHud({ player, world: world as any, camera });
const pipeline = createPipeline({ renderer, scene, camera, lighting });

addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    pipeline.setSize(innerWidth, innerHeight);
});

const ctx: any = {
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
ctx.systems = ctx.systems || [];
(window as any).__ctx = ctx;

const warmup =
    !shotName && !params.has("nowarm")
        ? createWarmup(renderer, scene, camera, {
              mirrorLayers: [REFL_LAYER, BIG_CASTER_LAYER],
          })
        : null;

if (warmup) {
    lighting.update(camera);
    pipeline.prepareMaterials?.();
    warmup.rescan();
    warmup.flush();
    await warmup.settle((k: number) => boot.sub(k));
}
await boot.stage("frame");
let framesDrawn = 0;
const systemsReady = shotName
    ? Promise.resolve()
    : import("./game/systems/index.ts")
          .then((m) => m.initSystems(ctx))
          .catch((e) => console.error("[systems] init failed", e))
          .then(() => import("./game/combat/index.ts"))
          .then((m) => m.initCombat(ctx))
          .catch((e) => console.error("[combat] init failed", e))
          .then(() => warmup?.rescan());

systemsReady.then(async () => {
    boot.sub(0.8);
    while (framesDrawn < 4) await new Promise((r) => requestAnimationFrame(r));
    boot.done();
});
ctx.timeScale = 1;

if (shotName) {
    const shot = (SHOTS as any)[shotName];
    if (!shot) throw new Error("unknown shot " + shotName);
    shot.apply(ctx);

    const dt = 1 / 60;
    for (let i = 0; i < (shot.frames ?? 90); i++) {
        shot.tick?.(ctx, dt, i);
        world.update(dt, camera);
        lighting.update(camera);
        hud.update(dt);
        pipeline.render(dt);
        await new Promise((r) => requestAnimationFrame(r));
    }
    (window as any).__shotInfo =
        `${renderer.info.render.calls} calls, ${renderer.info.render.triangles} tris`;
    (window as any).__shotReady = true;
} else {
    const clock = new THREE.Clock();
    function frame(realDt: number) {
        ctx.realDt = realDt;
        const dt = ctx.realDt * (ctx.timeScale ?? 1);
        player.update(dt);
        world.update(dt, camera);
        lighting.update(camera);
        hud.update(dt);
        for (const s of ctx.systems) s.update?.(dt);
        pipeline.render(dt);
        warmup?.step();
        if (++framesDrawn === 1) boot.sub(0.4);
    }

    ctx.stepFrame = (dt: number) => frame(dt);
    renderer.setAnimationLoop(() => {
        const d = Math.min(clock.getDelta(), 1 / 20);
        if (!ctx.manualStep) frame(d);
    });
}
