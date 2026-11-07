// @ts-nocheck
import pipelineSsrFragmentShader from "./shaders/fragment/pipeline-ssr.frag?raw";
import pipelineShaftsFragmentShader from "./shaders/fragment/pipeline-shafts.frag?raw";
import pipelineCityVolumeFragmentShader from "./shaders/fragment/pipeline-cityvolume.frag?raw";
import pipelineScreenSpaceGiFragmentShader from "./shaders/fragment/pipeline-ssgi.frag?raw";
import pipelineSunVisibilityFragmentShader from "./shaders/fragment/pipeline-sunvis.frag?raw";
import pipelineCompositeFragmentShader from "./shaders/fragment/pipeline-composite.frag?raw";
import pipelineTaaFragmentShader from "./shaders/fragment/pipeline-taa.frag?raw";
import depthOfFieldCocGlsl from "./shaders/glsl/depth-of-field-coc.glsl?raw";
import pipelineDofPrefilterFragmentShader from "./shaders/fragment/pipeline-dofprefilter.frag?raw";
import pipelineDofBokehFragmentShader from "./shaders/fragment/pipeline-dofbokeh.frag?raw";
import pipelineDofTentFragmentShader from "./shaders/fragment/pipeline-doftent.frag?raw";
import pipelineDofCombineFragmentShader from "./shaders/fragment/pipeline-dofcombine.frag?raw";
import pipelineMotionBlurFragmentShader from "./shaders/fragment/pipeline-motionblur.frag?raw";
import pipelineBloomDownFragmentShader from "./shaders/fragment/pipeline-bloomdown.frag?raw";
import pipelineBloomUpFragmentShader from "./shaders/fragment/pipeline-bloomup.frag?raw";
import pipelineAutoExposureFragmentShader from "./shaders/fragment/pipeline-autoexposure.frag?raw";
import pipelineFinalFragmentShader from "./shaders/fragment/pipeline-final.frag?raw";
import pipelineDebugBlitFragmentShader from "./shaders/fragment/pipeline-debugblit.frag?raw";
import { injectShader } from "./shaderInjection.ts";
// // createPipeline({renderer, scene, camera, lighting}) -> pipeline
//   pipeline.render(dt)                 render one frame to the screen
//   pipeline.setSize(w, h)              CSS pixels (pixel ratio applied internally)
//   pipeline.setFocus(dist)             depth-of-field focus distance in metres
//   pipeline.setAperture(px)            DoF blur radius (full-res px) of objects at infinity; 0 disables DoF
//   pipeline.setDof({focus, aperture, maxBlur})
//   pipeline.setAutoFocus(object3D|null) focus follows an object (e.g. the player) every frame
//   pipeline.setMotionBlur(strength, {cameraVelocity?: Vector3 m/s, angularVelocity?: Vector3 rad/s, maskDistance?})
//        strength 0..1 (0.5 ~ 180deg shutter). Real camera motion is used automatically; for static screenshot
//        cameras pass a synthetic cameraVelocity / angularVelocity. Pixels closer than maskDistance (defaults to
//        focus distance + 1.5 m) are kept sharp so the chase-cam character doesn't smear.
//   pipeline.grade                      live-editable grading params (exposure, saturation, lift/gamma/gain ...)
//   pipeline.resetHistory()             call on camera cuts (also auto-detected)
//   pipeline.timings()                  GPU ms per pass when ?prof=1
// Frame: scene(HDR, jittered) -> sky(1/2 res) -> AO(N8AO) -> composite(sky+aerial perspective) -> TAA ->
//        DoF -> motion blur -> bloom -> final(CA, sharpen, ACES, grade, vignette, dither) -> screen
import * as THREE from "three";
import { N8AOPostPass } from "n8ao";
import { FullscreenPass, createRenderTarget, DEPTH_RECONSTRUCTION_GLSL, COLOR_SPACE_CONVERSION_GLSL, haltonSequence } from "./fullscreenPass.ts";
import { GLSL_SKY_COMMON } from "./sky.ts";
import { GpuProfiler } from "./profiler.ts";
import {
  cityLights,
  cityLightsShared,
  cityLightsGLSL,
  CL_SLOTS,
} from "./citylights.ts"; // (night) local city lights: lit haze
import { createGlassMirror } from "./glassmirror.ts"; // (render r-refl) player / cars / peds mirrored in facade glass

export function createPipeline({ renderer, scene, camera, lighting }) {
  const Q = lighting.quality;
  const reversed = !!renderer.capabilities.reversedDepthBuffer;
  const params = new URLSearchParams(location.search);
  const prof = new GpuProfiler(renderer, params.has("prof"));
  // (perf) with ?prof=1, split 'scene+shadows' into 'shadows' (all CSM cascades) and 'scene' (main colour pass),
  // and count draw calls / triangles of the shadow passes separately (pipeline.stats.shadowCalls / shadowTris)
  const shadowStat = { calls: 0, triangles: 0, cCalls: 0, cTris: 0 };
  if (prof.enabled) {
    const sm = renderer.shadowMap,
      smRender = sm.render;
    sm.render = function (...a) {
      const c0 = renderer.info.render.calls,
        t0 = renderer.info.render.triangles,
        u0 = performance.now();
      prof.begin("shadows");
      smRender.apply(this, a);
      prof.begin("scene");
      shadowStat.cCalls += renderer.info.render.calls - c0;
      shadowStat.cTris += renderer.info.render.triangles - t0;
      shadowStat.cCpu = (shadowStat.cCpu || 0) + performance.now() - u0;
    };
  }

  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = true;

  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  let W = size.x,
    H = size.y;

  // ---------------------------------------------------------------- targets
  const depthTex = new THREE.DepthTexture(
    W,
    H,
    reversed ? THREE.FloatType : THREE.UnsignedIntType,
  );
  depthTex.format = THREE.DepthFormat;
  depthTex.minFilter = depthTex.magFilter = THREE.NearestFilter;
  const sceneRT = createRenderTarget(W, H, { depthBuffer: true, depthTexture: depthTex });
  sceneRT.texture.minFilter = sceneRT.texture.magFilter = THREE.LinearFilter;
  const aoRT = createRenderTarget(W, H);
  const skyRT = createRenderTarget(W / 2, H / 2);
  const litRT = createRenderTarget(W, H);
  const hist = [createRenderTarget(W, H), createRenderTarget(W, H)];
  const postA = createRenderTarget(W, H),
    postB = createRenderTarget(W, H);
  const dofHalfA = createRenderTarget(W / 2, H / 2),
    dofHalfB = createRenderTarget(W / 2, H / 2);
  const ssrRT = createRenderTarget(W / 2, H / 2); // rgb: (reflection - env) * confidence (signed, half float)
  const shaftRT = createRenderTarget(W / 2, H / 2); // rgb: sun in-scatter along the view ray (shadowed), a: linear depth
  const cvolRT = createRenderTarget(W / 4, H / 4); // (perf) quarter res: soft, low-frequency in-scatter (TAA + depth-aware upsample)      // (night) rgb: in-scatter of the city lights (lamps, screens, headlights) in the night haze, a: linear depth
  const sunVisRT = createRenderTarget(1, 1, { filter: THREE.NearestFilter }); // r: sun visibility (lens flare)
  // auto exposure: r = adapted log2 luminance (ping-pong 1x1), g = this frame's metered value
  const aeRT = [
    createRenderTarget(1, 1, { filter: THREE.NearestFilter, type: THREE.FloatType }),
    createRenderTarget(1, 1, { filter: THREE.NearestFilter, type: THREE.FloatType }),
  ];
  let aeIdx = 0;
  // character mask: depth of the player's meshes only (same jittered camera as the scene). TAA compares it with
  // the scene depth to find character pixels and reprojects those with the character's own rigid motion instead
  // of the camera motion (chase-cam swinging otherwise smears / ghosts the suit).
  const maskDepth = new THREE.DepthTexture(
    W,
    H,
    reversed ? THREE.FloatType : THREE.UnsignedIntType,
  );
  maskDepth.format = THREE.DepthFormat;
  maskDepth.minFilter = maskDepth.magFilter = THREE.NearestFilter;
  const maskRT = createRenderTarget(W, H, {
    depthBuffer: true,
    depthTexture: maskDepth,
    type: THREE.UnsignedByteType,
    filter: THREE.NearestFilter,
  });
  const maskMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const objPrev = new THREE.Matrix4(),
    objCur = new THREE.Matrix4(),
    objDelta = new THREE.Matrix4();
  let objHave = false;
  const bloomDown = [],
    bloomUp = [];
  function allocBloom() {
    let w = W,
      h = H;
    for (let i = 0; i < Q.bloomLevels; i++) {
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
      if (bloomDown[i]) bloomDown[i].setSize(w, h);
      else bloomDown.push(createRenderTarget(w, h));
      if (bloomUp[i]) bloomUp[i].setSize(w, h);
      else bloomUp.push(createRenderTarget(w, h));
    }
    while (bloomDown.length > Q.bloomLevels) {
      bloomDown.pop().dispose();
      bloomUp.pop().dispose();
    }
  }
  allocBloom();

  // ---------------------------------------------------------------- AO
  let ao = null;
  if (Q.ao) {
    ao = new N8AOPostPass(scene, camera, W, H);
    ao.autoDetectTransparency = false;
    ao.configuration.transparencyAware = false;
    ao.configuration.gammaCorrection = false;
    ao.configuration.halfRes = Q.aoHalfRes;
    // N8AO's MRT shim exposes `target.texture` as the whole textures array.
    // Three r172+ expects `target.texture` to be the first attachment and reads
    // its mipmaps during framebuffer setup, so restore the modern RenderTarget API.
    const aoDepthTarget = ao.depthDownsampleTarget;
    if (aoDepthTarget && Array.isArray(aoDepthTarget.texture)) {
      Object.defineProperty(aoDepthTarget, "texture", {
        configurable: true,
        get() {
          return this.textures[0];
        },
        set(texture) {
          this.textures[0] = texture;
        },
      });
    }
    ao.setQualityMode(Q.aoQuality);
    if (!Q.aoHalfRes) {
      // full res with few samples + spatial denoise (TAA integrates the per-frame noise). Same cost as half-res
      // Medium, but no light halo along silhouettes (N8AO's half-res upsample bleeds across depth edges).
      ao.configuration.aoSamples = 4;
      ao.configuration.denoiseSamples = 4;
      ao.configuration.denoiseRadius = 5;
    }
    // moderate radius: large radii + half-res upsampling leave bright halos around thin foreground objects
    ao.configuration.aoRadius = 3.0; // (lighting2 r3) 2.2 -> 3.0: building bases / awnings / props get a wider contact darkening (user)
    ao.configuration.distanceFalloff = 0.9;
    ao.configuration.intensity = 3.4; // (lighting2 r3) user: contact shadows should read dark // was // (lighting2 r1) 3.2 -> 2.5: N8AO multiplies the lit colour, deep crevices went black
    ao.configuration.color = new THREE.Color(0x0e0b09); // neutral-warm occlusion (blue AO read as cold shadows)
    ao.setDepthTexture(depthTex);
    ao.renderToScreen = false;
  }

  const sky = lighting.sky;
  const cascadedShadows = lighting.cascadedShadows;

  // ---------------------------------------------------------------- SSR (half res, screen-space ray march)
  // Surfaces encode their reflection weight in the scene alpha (see surface.ts). Rays are marched in screen space
  // against the depth buffer; hits fetch the previous frame's resolved HDR image (reprojected), so reflections
  // include sky, fog and the character. Output is the DELTA to the environment-map reflection the material already
  // added, so misses cost nothing and hits replace env by the real scene (glass towers reflecting their neighbours).
  const ssrOn = !!Q.ssr && !params.has("nossr");
  // (render r-refl) planar mirror of the dynamic objects (player, cars, peds) for the facade glass next to the player
  // (glassmirror.ts): the facade opts out of SSR, so this is what puts Spider-Man into windows / curtain walls
  const gmirror = Q.ssr ? createGlassMirror(renderer, scene) : null;
  const ssr = new FullscreenPass({
    name: "ssr",
    defines: {
      STEPS: Q.ssrSteps || 24,
      ENVMAP_TYPE_CUBE_UV: "",
      CUBEUV_TEXEL_WIDTH: 0.0013,
      CUBEUV_TEXEL_HEIGHT: 0.001953125,
      CUBEUV_MAX_MIP: "7.0",
    },
    uniforms: {
      uDepth: { value: depthTex },
      uScene: { value: sceneRT.texture },
      uPrev: { value: null },
      envMap: { value: null },
      uProj: { value: new THREE.Matrix4() },
      uProjInv: { value: new THREE.Matrix4() },
      uReversed: { value: reversed ? 1 : 0 },
      uCamWorld: { value: new THREE.Matrix4() },
      uPrevViewProj: { value: new THREE.Matrix4() },
      uRes: { value: new THREE.Vector2(W, H) },
      uFrame: { value: 0 },
      uEnvI: { value: 1 },
      uHavePrev: { value: 0 },
      uMaxDist: { value: 220 },
      uFloor: { value: 0.5 },
    },
    fragmentShader: injectShader(
      pipelineSsrFragmentShader,
      DEPTH_RECONSTRUCTION_GLSL,
      THREE.ShaderChunk.cube_uv_reflection_fragment,
    ),
  });

  // ---------------------------------------------------------------- volumetric sun shafts (half res)
  const NC = cascadedShadows.N;
  const shaftsOn = !!Q.shafts && !params.has("noshafts");
  const shafts = new FullscreenPass({
    name: "shafts",
    defines: { STEPS: Q.shaftSteps || 12, NC },
    uniforms: {
      ...sky.skyUniforms,
      uDepth: { value: depthTex },
      uProjInv: { value: new THREE.Matrix4() },
      uReversed: { value: reversed ? 1 : 0 },
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uCamFwd: { value: new THREE.Vector3() },
      uSM0: { value: null },
      uSM1: { value: null },
      uSM2: { value: null },
      uSM3: { value: null },
      uSMat: {
        value: [
          new THREE.Matrix4(),
          new THREE.Matrix4(),
          new THREE.Matrix4(),
          new THREE.Matrix4(),
        ],
      },
      uSplits: { value: new THREE.Vector4(1e9, 1e9, 1e9, 1e9) },
      uRes: { value: new THREE.Vector2(W, H) },
      uFrame: { value: 0 },
      uDensity: { value: 0.0008 },
      uHeightFall: { value: 1 / 70 },
      uMaxT: { value: 180 },
      uStrength: { value: 1 },
    },
    fragmentShader: injectShader(pipelineShaftsFragmentShader, DEPTH_RECONSTRUCTION_GLSL, GLSL_SKY_COMMON),
  });

  // ---------------------------------------------------------------- (night) lit haze around the city lights (half res)
  // Ray-march the view ray through the night haze (quadratic step spacing: dense near the camera) and, at each sample,
  // add the in-scatter of the lights listed in the sample's city-light grid cell (cityLights.ts): halos around lamp
  // heads, light cones under the street lamps and in front of headlights, coloured glow in front of the big screens.
  // Jittered per pixel + frame; TAA integrates. Unshadowed (no local-light shadow maps), soft on purpose.
  const cvol = new FullscreenPass({
    name: "cityVolume",
    defines: {
      NSEG: Q.cityVolSteps || 16,
      VSLOTS: Math.min(CL_SLOTS, 10),
      USE_CITYL: "",
      CITYL_NODITHER: "",
    },
    uniforms: {
      cityL: { value: cityLightsShared },
      uDepth: { value: depthTex },
      uProjInv: { value: new THREE.Matrix4() },
      uReversed: { value: reversed ? 1 : 0 },
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uFrame: { value: 0 },
      uDensity: { value: 0.012 },
      uHeightFall: { value: 1 / 40 },
      uMaxT: { value: 120 },
      uStrength: { value: 1 },
      uG: { value: 0.55 },
    },
    // (night r9) ANALYTIC in-scatter (no ray-march noise: the jittered march read as a grid-like texture at the lamp heads).
    // The view ray is cut into NSEG deterministic segments (short near the camera); for each segment the lights of the grid
    // cell at its midpoint are integrated exactly over the segment for the inverse-square falloff:
    //   int dt / (h^2 + (t - tc)^2) = ( atan((t1 - tc) / h) - atan((t0 - tc) / h) ) / h
    // with the spot cone, range window and phase taken at 2 points of the segment.
    fragmentShader: injectShader(pipelineCityVolumeFragmentShader, DEPTH_RECONSTRUCTION_GLSL, cityLightsGLSL),
  });

  // ---------------------------------------------------------------- SSGI (lighting2 r1: half-res screen-space one-bounce GI)
  // For one full-res pixel of each 2x2 block (rotating per frame, TAA integrates the rest): reconstruct the position and
  // depth normal, trace a few cosine-distributed rays in view space against the depth buffer, and on a hit gather the
  // PREVIOUS frame's lit radiance at that point (reprojected, from the quarter-res bloom chain = pre-filtered, cheap,
  // firefly-free). Without an albedo buffer the bounce is applied as a RATIO: out = E_gi / (E_sun * vis + E_amb), where
  // E_sun uses the real CSM visibility + N.L and E_amb the env irradiance, so composite does col *= 1 + ratio. Shaded
  // walls opposite a sunlit facade / street get the warm coloured bounce; sunlit pixels barely change.
  const ssgiOn = Q.ssgi !== false && !params.has("nossgi");
  const ssgiRT = createRenderTarget(W / 2, H / 2);
  const ssgi = new FullscreenPass({
    name: "ssgi",
    defines: {
      DIRS: Q.ssgiDirs || 6,
      STEPS: Q.ssgiSteps || 4,
      NC,
      ENVMAP_TYPE_CUBE_UV: "",
      CUBEUV_TEXEL_WIDTH: 0.0013,
      CUBEUV_TEXEL_HEIGHT: 0.001953125,
      CUBEUV_MAX_MIP: "7.0",
    },
    uniforms: {
      ...sky.skyUniforms,
      uDepth: { value: depthTex },
      uPrevRad: { value: null },
      envMap: { value: null },
      uEnvI: { value: 1 },
      uAmbBounce: { value: new THREE.Vector3() },
      uProj: { value: new THREE.Matrix4() },
      uProjInv: { value: new THREE.Matrix4() },
      uReversed: { value: reversed ? 1 : 0 },
      uCamWorld: { value: new THREE.Matrix4() },
      uPrevViewProj: { value: new THREE.Matrix4() },
      uSM0: { value: null },
      uSM1: { value: null },
      uSM2: { value: null },
      uSM3: { value: null },
      uSMat: {
        value: [
          new THREE.Matrix4(),
          new THREE.Matrix4(),
          new THREE.Matrix4(),
          new THREE.Matrix4(),
        ],
      },
      uSplits: { value: new THREE.Vector4(1e9, 1e9, 1e9, 1e9) },
      uRes: { value: new THREE.Vector2(W, H) },
      uFrame: { value: 0 },
      uHavePrev: { value: 0 },
      uStrength: { value: 1 },
      uAbs: { value: 0 },
      uAbsK: { value: 1 }, // (night) additive emissive bounce
    },
    fragmentShader: injectShader(
      pipelineScreenSpaceGiFragmentShader,
      DEPTH_RECONSTRUCTION_GLSL,
      GLSL_SKY_COMMON,
      THREE.ShaderChunk.cube_uv_reflection_fragment,
    ),
  });

  // ---------------------------------------------------------------- sun visibility (1x1) for lens effects
  const sunVis = new FullscreenPass({
    name: "sunVis",
    uniforms: {
      uDepth: { value: depthTex },
      uSky: { value: skyRT.texture },
      uSunUv: { value: new THREE.Vector2() },
      uReversed: { value: reversed ? 1 : 0 },
      uProjInv: { value: new THREE.Matrix4() },
      uAspect: { value: 1 },
    },
    fragmentShader: injectShader(pipelineSunVisibilityFragmentShader, DEPTH_RECONSTRUCTION_GLSL),
  });

  // ---------------------------------------------------------------- composite (sky + aerial perspective)
  const composite = new FullscreenPass({
    name: "composite",
    uniforms: {
      ...sky.skyUniforms,
      uColor: { value: null },
      uDepth: { value: depthTex },
      uSky: { value: skyRT.texture },
      uProjInv: { value: new THREE.Matrix4() },
      uReversed: { value: reversed ? 1 : 0 },
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uFogDensity: { value: 0 },
      uFogFalloff: { value: 0 },
      uFogSun: { value: 0 },
      uFogTint: { value: new THREE.Color() },
      uFogStart: { value: 0 },
      uPx: { value: new THREE.Vector2() },
      uSceneA: { value: sceneRT.texture },
      uSSR: { value: ssrRT.texture },
      uSSROn: { value: 0 },
      uShafts: { value: shaftRT.texture },
      uShaftOn: { value: 0 },
      uHalfPx: { value: new THREE.Vector2() },
      uCVol: { value: cvolRT.texture },
      uCVolOn: { value: 0 },
      uQuarterPx: { value: new THREE.Vector2() }, // (night) city-light haze
      uCloudShadow: { value: 0.4 }, // (foundation agent) strength of the projected cloud shadows (0 = off)
      uGI: { value: ssgiRT.texture },
      uGIOn: { value: 0 },
      uGIAbs: { value: 0 },
      uGIAlb: { value: 0.09 }, // (lighting2 r1) SSGI bounce ratio (half res, a = distance)
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonK: { value: 0 }, // (daynight) moon disc
      uNightHaze: { value: new THREE.Vector3() },
      uNightHazeHi: { value: new THREE.Vector3() },
      uNightFog: { value: 0 }, // (night) light-polluted haze
      uGlowCol: { value: new THREE.Vector3() },
      uGlowH: { value: 22 },
      uGlowK: { value: 0.004 },
      uNightMid: { value: new THREE.Vector3(0.0035, 0.0088, 0.0215) },
      /* (r9) +20 % saturation looking down (rooftop_haze B-R) */ uTsGlow: {
        value: new THREE.Vector3(0.0056, 0.0045, 0.004),
      },
      uNightMidLevel: { value: new THREE.Vector3(0.0062, 0.0068, 0.0105) }, // (night r6) blue mid-distance in-scatter // (night) warm street-level glow layer
    },
    fragmentShader: injectShader(pipelineCompositeFragmentShader, DEPTH_RECONSTRUCTION_GLSL, GLSL_SKY_COMMON),
  });

  // ---------------------------------------------------------------- TAA
  const taa = new FullscreenPass({
    name: "taa",
    uniforms: {
      uCurrent: { value: litRT.texture },
      uHistory: { value: null },
      uDepth: { value: depthTex },
      uProjInv: { value: new THREE.Matrix4() },
      uReversed: { value: reversed ? 1 : 0 },
      uCamWorld: { value: new THREE.Matrix4() },
      uPrevViewProj: { value: new THREE.Matrix4() },
      uRes: { value: new THREE.Vector2(W, H) },
      uBlend: { value: 0.1 },
      uCharBlend: { value: 0.14 },
      uSkyBlend: { value: 0.08 },
      uSkyBlendCap: { value: 0 },
      uReset: { value: 1 },
      uJitter: { value: new THREE.Vector2() },
      uProjInvU: { value: new THREE.Matrix4() },
      uMask: { value: maskDepth },
      uMaskOn: { value: 0 },
      uObjDelta: { value: new THREE.Matrix4() },
    },
    fragmentShader: injectShader(pipelineTaaFragmentShader, DEPTH_RECONSTRUCTION_GLSL, COLOR_SPACE_CONVERSION_GLSL),
  });

  // ---------------------------------------------------------------- DoF (half-res gather bokeh)
  const dofState = { focus: 10, aperture: 0, maxBlur: 14, auto: null, far: 1 };
  const cocUniforms = () => ({
    uFocus: { value: 10 },
    uBokeh: { value: 0 },
    uMaxCoc: { value: 12 },
    uFar: { value: 1 },
  });
  const GLSL_COC = depthOfFieldCocGlsl;
  const dofPre = new FullscreenPass({
    name: "dofPrefilter",
    uniforms: {
      ...cocUniforms(),
      uColor: { value: null },
      uDepth: { value: depthTex },
      uProjInv: { value: new THREE.Matrix4() },
      uReversed: { value: reversed ? 1 : 0 },
      uPx: { value: new THREE.Vector2() },
    },
    fragmentShader: injectShader(
      pipelineDofPrefilterFragmentShader,
      DEPTH_RECONSTRUCTION_GLSL,
      COLOR_SPACE_CONVERSION_GLSL,
      GLSL_COC,
    ),
  });
  // golden-angle disk kernel
  function diskKernel(n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt((i + 0.5) / n);
      const a = i * 2.39996323;
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    return pts;
  }
  const dofBokeh = new FullscreenPass({
    name: "dofBokeh",
    defines: { TAPS: Q.dofTaps },
    uniforms: {
      uSrc: { value: dofHalfA.texture },
      uKernel: { value: diskKernel(Q.dofTaps) },
      uMaxCoc: { value: 12 },
      uPx: { value: new THREE.Vector2() },
    },
    fragmentShader: pipelineDofBokehFragmentShader,
  });
  const dofPost = new FullscreenPass({
    name: "dofTent",
    uniforms: {
      uSrc: { value: dofHalfB.texture },
      uPx: { value: new THREE.Vector2() },
    },
    fragmentShader: pipelineDofTentFragmentShader,
  });
  const dofCombine = new FullscreenPass({
    name: "dofCombine",
    uniforms: {
      ...cocUniforms(),
      uColor: { value: null },
      uDof: { value: dofHalfA.texture },
      uDepth: { value: depthTex },
      uProjInv: { value: new THREE.Matrix4() },
      uReversed: { value: reversed ? 1 : 0 },
    },
    fragmentShader: injectShader(pipelineDofCombineFragmentShader, DEPTH_RECONSTRUCTION_GLSL, GLSL_COC),
  });

  // ---------------------------------------------------------------- motion blur
  const mbState = {
    strength: 0,
    velocity: null,
    angular: null,
    maskDistance: null,
    prevViewProj: new THREE.Matrix4(),
    have: false,
  };
  const motion = new FullscreenPass({
    name: "motionBlur",
    defines: { SAMPLES: Q.motionBlurSamples },
    uniforms: {
      uColor: { value: null },
      uDepth: { value: depthTex },
      uProjInv: { value: new THREE.Matrix4() },
      uReversed: { value: reversed ? 1 : 0 },
      uCamWorld: { value: new THREE.Matrix4() },
      uPrevViewProj: { value: new THREE.Matrix4() },
      uScale: { value: 0.5 },
      uMask: { value: 3.0 },
      uRes: { value: new THREE.Vector2(W, H) },
      uFrame: { value: 0 },
    },
    fragmentShader: injectShader(pipelineMotionBlurFragmentShader, DEPTH_RECONSTRUCTION_GLSL),
  });

  // ---------------------------------------------------------------- bloom
  const bloomDownPass = new FullscreenPass({
    name: "bloomDown",
    uniforms: {
      uSrc: { value: null },
      uPx: { value: new THREE.Vector2() },
      uFirst: { value: 0 },
    },
    fragmentShader: injectShader(pipelineBloomDownFragmentShader, COLOR_SPACE_CONVERSION_GLSL),
  });
  const bloomUpPass = new FullscreenPass({
    name: "bloomUp",
    uniforms: {
      uSrc: { value: null },
      uCur: { value: null },
      uPx: { value: new THREE.Vector2() },
      uRadius: { value: 1.0 },
      uT: { value: 1.2 },
      uK: { value: 0.8 },
      uThrSrc: { value: 0 },
    },
    // (lighting2 r1) THRESHOLDED bloom: the down chain stays plain radiance (auto exposure + SSGI read it), the soft-knee
    // threshold is applied to every level as it is added here, so only sun / sky glare, glints and emissives glow
    fragmentShader: pipelineBloomUpFragmentShader,
  });

  // ---------------------------------------------------------------- auto exposure (eye adaptation)
  // Meters a centre-weighted log-average luminance of the (bloom-downsampled) HDR frame, rejecting the darkest and
  // brightest samples' extremes, and adapts over time (faster toward brighter). The final pass applies a PARTIAL
  // compensation (grade.aeStrength) around grade.aeKey so dark alleys open up and bright vistas calm down without
  // flattening the intended look.
  const aePass = new FullscreenPass({
    name: "autoExposure",
    uniforms: {
      uSrc: { value: null },
      uPrev: { value: null },
      uRate: { value: 0.1 },
      uReset: { value: 1 },
    },
    fragmentShader: pipelineAutoExposureFragmentShader,
  });

  // ---------------------------------------------------------------- final
  const grade = {
    autoExposure: true,
    aeKey: -2.05, // log2 luminance that maps to the base exposure (calibrated on the reference shots)
    aeStrength: 0.42, // 0 = fixed exposure, 1 = full compensation
    aeRange: 1.25, // max EV correction either way
    aeSpeedUp: 2.5,
    aeSpeedDown: 1.4, // adaptation speeds (1/s)
    exposure: 0.8,
    bloom: 0.11, // (lighting2 r2) 0.07 -> 0.11 (sun / wet glints glow like the golden-hour ref) (lighting2 r1) additive, thresholded (was a 0.045 energy-conserving mix of the whole frame)
    bloomThreshold: 0.9,
    bloomKnee: 0.7, // (lighting2 r2) 1.1 -> 0.9 // HDR (pre-exposure) luminance
    saturation: 1.14, // (lighting2 r3) 1.0 -> 1.14 day refs: richer brick / foliage / sky (with the warm cast removed below)
    contrast: 1.18, // (lighting2 r3) 1.14 -> 1.18  // (atmosphere r2: 1.15 -> 1.2, critic: 'grey, lifted blacks, no real darks') (lighting2 r1: 1.14, shade crushed)
    pivot: 0.18, // contrast pivot (display-linear, ~mid grey)
    satKnee: 0.72, // chroma soft-clip: saturation above this is compressed (keeps neon foliage/paint in gamut)
    lift: new THREE.Vector3(-0.004, -0.004, -0.003), // (lighting2 r1) was -0.009: anything below ~1% went pure black // black point (atmosphere r2: deeper, was -0.004/-0.005/-0.008)
    gamma: new THREE.Vector3(1.0, 1.0, 1.0),
    gain: new THREE.Vector3(1.015, 1.0, 0.975), // (lighting2 r3) was 1.03/0.95: whole frame read sepia      // (atmosphere r1: 1.06/0.9 -> 1.03/0.95, the horizon / clouds read cream-yellow; refs' whites are neutral)
    whiteBalance: new THREE.Vector3(1.0, 1.0, 1.0),
    // (atmosphere r2) split toning: cool shadows / warm highlights (display-linear luma-weighted tint, luma-neutral)
    splitShadow: new THREE.Vector3(0.95, 1.0, 1.07),
    splitHigh: new THREE.Vector3(1.035, 1.0, 0.95), // (lighting2 r3) was 1.05/0.92
    splitBalance: 0.3, // luma where the tint crosses over
    vignette: 0.28,
    ca: 0.0009,
    sharpen: Q.sharpen,
    grain: 0.012,
    shafts: 1.0, // volumetric sun shaft strength
    nightSplitShadow: new THREE.Vector3(0.93, 1.0, 1.1), // (r6) 0.88/0.98/1.16 darkened the ground
    nightSplitStreet: new THREE.Vector3(0.8, 0.96, 1.3), // (night r7) street-level cameras // (night r5) split-tone of the darks at night
    nightLift: new THREE.Vector3(0.0074, 0.0068, 0.0078), // (r8 / r9) unlit asphalt floor ~20 sRGB (critic: 17) // (night) black floor at night (refs: darkest street areas ~sRGB 20-35, nothing crushed to 0)
    cityVol: 1.0, // (night) lit haze around the city lights (cityLights.ts)
    giNight: 0.35,
    giNightAlbedo: 0.3, // (r10) 1.0: street level went amber / 2x too bright (critic r9); the bounce is on top of real lights // (night) additive screen-space emissive bounce: irradiance gain, albedo proxy
    streak: 0.012, // (night) anamorphic streaks on bright lamps / headlights (night only)
    flare: 1.0, // lens flare / sun glare strength
    gi: 0.5, // (lighting2 r3) 1.0 -> 0.7 (less fill: darker shade, user) (lighting2 r1) SSGI bounce strength
    toe: 0.34, // (lighting2 r3) 0.36 -> 0.34 (tried 0.3: shade crushed to 0.004 vs topdown ref 0.023)
    // (lighting2 r2) 0.45 -> 0.36: the stronger sky / bounce fill lifts shade, keep some contrast (lighting2 r1) tonemap toe: linear slope floor under the ACES curve (0 = plain ACES)
  };
  const final = new FullscreenPass({
    name: "final",
    uniforms: {
      uColor: { value: null },
      uBloom: { value: null },
      uPx: { value: new THREE.Vector2() },
      uStreakSrc: { value: null },
      uStreakLo: { value: null },
      uStreak: { value: 0 },
      uStreakT: { value: 2.5 }, // (night) anamorphic lamp streaks
      uExposure: { value: 1 },
      uBloomStr: { value: 0.04 },
      uSat: { value: 1 },
      uContrast: { value: 1 },
      uLift: { value: grade.lift },
      uGamma: { value: grade.gamma },
      uGain: { value: grade.gain },
      uWB: { value: grade.whiteBalance },
      uVignette: { value: 0.3 },
      uCA: { value: 0.001 },
      uSharpen: { value: 0.3 },
      uGrain: { value: 0 },
      uFrame: { value: 0 },
      uAspect: { value: 1 },
      uSunVis: { value: sunVisRT.texture },
      uSunUv: { value: new THREE.Vector2() },
      uFlare: { value: 0 },
      uSunCol: { value: new THREE.Vector3() },
      uPivot: { value: 0.18 },
      uSatKnee: { value: 0.72 },
      uDepthS: { value: depthTex },
      uProjInvS: { value: new THREE.Matrix4() },
      uRevS: { value: reversed ? 1 : 0 },
      uAE: { value: null },
      uAEOn: { value: 0 },
      uAEKey: { value: 0 },
      uAEStr: { value: 0.6 },
      uAERange: { value: 1.25 },
      uSplitSh: { value: grade.splitShadow },
      uSplitHi: { value: grade.splitHigh },
      uSplitBal: { value: 0.3 },
      uWarmGuard: { value: 0 },
      uToe: { value: 0.45 },
      uRain: { value: 0 },
    },
    fragmentShader: injectShader(pipelineFinalFragmentShader, COLOR_SPACE_CONVERSION_GLSL),
  });

  // ---------------------------------------------------------------- debug view (pipeline.debug = {tex:'ssr'|'shafts'|'ao'|'scene', scale})
  const dbgPass = new FullscreenPass({
    name: "debugBlit",
    uniforms: {
      uSrc: { value: null },
      uScale: { value: 1 },
      uMode: { value: 0 },
    },
    fragmentShader: pipelineDebugBlitFragmentShader,
  });

  // ---------------------------------------------------------------- state
  let frame = 0;
  let histIdx = 0;
  let resetHistory = true;
  let aeReset = true;
  const projUnjit = new THREE.Matrix4();
  const viewProj = new THREE.Matrix4();
  const prevViewProj = new THREE.Matrix4();
  const prevCamPos = new THREE.Vector3();
  const _liftN = new THREE.Vector3(),
    _splitN = new THREE.Vector3(); // (night)
  const camPos = new THREE.Vector3();
  const prevCamQuat = new THREE.Quaternion();
  const tmpQ = new THREE.Quaternion();
  const tmpM = new THREE.Matrix4();
  const tmpV = new THREE.Vector3();
  const camFwd = new THREE.Vector3();
  const lens = { sunUv: new THREE.Vector2(), onScreen: false };
  const _virtual = new THREE.Matrix4();

  function setSize(w, h) {
    const pr = renderer.getPixelRatio();
    const nextW = Math.max(1, Math.floor(w * pr));
    const nextH = Math.max(1, Math.floor(h * pr));
    if (nextW === W && nextH === H) {
      resetHistory = true;
      return;
    }
    W = nextW;
    H = nextH;
    sceneRT.setSize(W, H);
    depthTex.image.width = W;
    depthTex.image.height = H;
    aoRT.setSize(W, H);
    litRT.setSize(W, H);
    hist[0].setSize(W, H);
    hist[1].setSize(W, H);
    postA.setSize(W, H);
    postB.setSize(W, H);
    skyRT.setSize(W >> 1, H >> 1);
    dofHalfA.setSize(W >> 1, H >> 1);
    dofHalfB.setSize(W >> 1, H >> 1);
    ssrRT.setSize(W >> 1, H >> 1);
    shaftRT.setSize(W >> 1, H >> 1);
    cvolRT.setSize(W >> 2, H >> 2);
    ssgiRT.setSize(W >> 1, H >> 1);
    gmirror?.setSize(W, H);
    maskRT.setSize(W, H);
    maskDepth.image.width = W;
    maskDepth.image.height = H;
    allocBloom();
    if (ao) ao.setSize(W, H);
    resetHistory = true;
  }

  function updateCoc(u, cam) {
    u.uFocus.value = dofState.focus;
    u.uBokeh.value = dofState.aperture; // full-res px at infinity -> *0.5 in shader for half res
    u.uMaxCoc.value = dofState.maxBlur;
    u.uFar.value = dofState.far;
    if (u.uProjInv) u.uProjInv.value.copy(cam.projectionMatrixInverse);
  }

  // materials that render their own (planar) reflections opt out of SSR
  const ssrOptOut = new WeakSet();
  function scanSSROptOut() {
    scene.traverse((o) => {
      const m = o.material;
      if (!m || Array.isArray(m) || ssrOptOut.has(m)) return;
      ssrOptOut.add(m);
      let key = "";
      try {
        key = m.customProgramCacheKey?.() ?? "";
      } catch (e) {
        /* ignore */
      }
      if (m.userData?.noSSR || key.includes("hero-glass")) {
        m.defines = { ...(m.defines || {}), NO_SSR: "" };
        m.needsUpdate = true;
      }
    });
  }

  renderer.info.autoReset = false;
  const stats = { calls: 0, triangles: 0 };
  function render(dt = 1 / 60) {
    frame++;
    stats.calls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles; // previous frame, all passes
    stats.shadowCalls = shadowStat.cCalls;
    stats.shadowTris = shadowStat.cTris;
    stats.shadowCpu = shadowStat.cCpu || 0;
    shadowStat.cCalls = shadowStat.cTris = shadowStat.cCpu = 0; // (perf)
    renderer.info.reset();
    if (ssrOn && frame % 120 === 1) scanSSROptOut();
    prof.poll();
    const cam = camera;
    cam.updateMatrixWorld();
    if (dofState.auto) {
      dofState.auto.getWorldPosition(tmpV);
      dofState.focus = tmpV.distanceTo(
        tmpV.clone().setFromMatrixPosition(cam.matrixWorld),
      );
    }

    // --- camera cut detection
    camPos.setFromMatrixPosition(cam.matrixWorld);
    tmpQ.setFromRotationMatrix(cam.matrixWorld);
    if (camPos.distanceTo(prevCamPos) > 60 || tmpQ.angleTo(prevCamQuat) > 0.6)
      resetHistory = true;
    // motion blur fades back in over ~0.3 s after a cut / resize / resetHistory() (a stale prev matrix would streak)
    mbState.fade = resetHistory
      ? 0
      : Math.min(1, (mbState.fade ?? 1) + dt / 0.3);

    // --- jitter (make sure three has switched the camera to reversed-Z first, or our saved matrix would be stale)
    if (reversed && cam.reversedDepth !== true) {
      cam._reversedDepth = true;
      cam.updateProjectionMatrix();
    }
    projUnjit.copy(cam.projectionMatrix);
    viewProj.multiplyMatrices(projUnjit, cam.matrixWorldInverse);
    const jIdx = (frame % 16) + 1;
    const jx = Q.taa ? haltonSequence(jIdx, 2) - 0.5 : 0,
      jy = Q.taa ? haltonSequence(jIdx, 3) - 0.5 : 0;
    if (Q.taa) {
      cam.projectionMatrix.elements[8] += (2 * jx) / W;
      cam.projectionMatrix.elements[9] += (2 * jy) / H;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }

    // --- (render r-refl) glass mirror of the player / cars / peds (sampled by the facade glass in the scene pass)
    if (gmirror) {
      prof.begin("glassMirror");
      gmirror.render(cam);
    }

    // --- (night) real-time shadow maps of the city lights nearest the player (cityLights.ts)
    if (cityLightsShared.origin.w > 0) {
      prof.begin("cityShadows");
      cityLights.renderShadows(renderer, scene);
    }

    // --- scene
    prof.begin("scene+shadows");
    renderer.setRenderTarget(sceneRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    renderer.render(scene, cam);

    // --- character mask (depth only, same jittered camera)
    const po = window.__ctx?.player?.object;
    let maskOn = false;
    if (Q.taa && po && po.visible) {
      prof.begin("charMask");
      po.updateMatrixWorld();
      objCur.copy(po.matrixWorld);
      const swapped = [];
      po.traverse((o) => {
        if (o.material && (o.isMesh || o.isSkinnedMesh) && o.visible) {
          swapped.push([o, o.material]);
          o.material = maskMat;
        } else if (o.visible && (o.isLine || o.isPoints || o.isSprite)) {
          swapped.push([o, null]);
          o.visible = false;
        }
      });
      const oldAuto = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(maskRT);
      renderer.clear(false, true, false);
      renderer.render(po, cam);
      renderer.shadowMap.autoUpdate = oldAuto;
      for (const [o, m] of swapped) {
        if (m) o.material = m;
        else o.visible = true;
      }
      objDelta.copy(objPrev).multiply(tmpM.copy(objCur).invert());
      maskOn = objHave;
      objPrev.copy(objCur);
      objHave = true;
    }

    // --- sky (half res)
    prof.begin("sky");
    sky.renderSkyPass(skyRT, cam, depthTex, W, H, reversed);

    // --- sun visibility for lens effects
    const sunNdc = tmpV
      .copy(sky.sunDir)
      .multiplyScalar(1e4)
      .add(camPos)
      .project(cam)
      .clone(); // (lighting2 r1) clone: tmpV is overwritten just below, which put the glare / flare at sunDir.xy instead of the sun
    const sunOnScreen =
      Math.abs(sunNdc.x) < 1.3 &&
      Math.abs(sunNdc.y) < 1.3 &&
      tmpV.copy(sky.sunDir).dot(camFwd.set(0, 0, -1).applyQuaternion(tmpQ)) > 0;
    lens.sunUv.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5);
    lens.onScreen = sunOnScreen;
    if (sunOnScreen && grade.flare > 0) {
      sunVis.uniforms.uSunUv.value.copy(lens.sunUv);
      sunVis.uniforms.uAspect.value = W / H;
      sunVis.render(renderer, sunVisRT);
    }

    // --- SSR
    // const envTex = scene.environment;
    // Three.js r187 uses cube-based PMREM textures.
    // The custom SSR shader still expects the old CubeUV atlas.
    const doSSR = false;
    // const doSSR =
    //   ssrOn && envTex && envTex.mapping === THREE.CubeUVReflectionMapping;
    // if (doSSR) {
    //   prof.begin("ssr");
    //   const u = ssr.uniforms;
    //   const hgt = envTex.image.height;
    //   if (ssr.material.userData.envH !== hgt) {
    //     const maxMip = Math.log2(hgt) - 2;
    //     ssr.material.defines.CUBEUV_TEXEL_HEIGHT = 1 / hgt;
    //     ssr.material.defines.CUBEUV_TEXEL_WIDTH =
    //       1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16));
    //     ssr.material.defines.CUBEUV_MAX_MIP = maxMip.toFixed(1);
    //     ssr.material.needsUpdate = true;
    //     ssr.material.userData.envH = hgt;
    //   }
    //   u.envMap.value = envTex;
    //   u.uEnvI.value = scene.environmentIntensity ?? 1;
    //   u.uFloor.value = THREE.MathUtils.lerp(
    //     0.5,
    //     0.06,
    //     lighting.nightHaze?.k ?? 0,
    //   ); // (night r12)
    //   u.uPrev.value = hist[1 - histIdx].texture;
    //   u.uHavePrev.value = Q.taa && !resetHistory ? 1 : 0;
    //   u.uProj.value.copy(cam.projectionMatrix);
    //   u.uProjInv.value.copy(cam.projectionMatrixInverse);
    //   u.uCamWorld.value.copy(cam.matrixWorld);
    //   u.uPrevViewProj.value.copy(prevViewProj);
    //   u.uRes.value.set(W, H);
    //   u.uFrame.value = frame % 64;
    //   ssr.render(renderer, ssrRT);
    // }

    // --- SSGI (lighting2 r1)
    // The custom SSGI shader also samples the old CubeUV atlas.
    const doGI = false;
    // const doGI =
    //   ssgiOn &&
    //   envTex &&
    //   envTex.mapping === THREE.CubeUVReflectionMapping &&
    //   !!cascadedShadows.lights[0].shadow.map?.depthTexture;
    // if (doGI) {
    //   prof.begin("ssgi");
    //   const u = ssgi.uniforms;
    //   const hgt = envTex.image.height;
    //   if (ssgi.material.userData.envH !== hgt) {
    //     const maxMip = Math.log2(hgt) - 2;
    //     ssgi.material.defines.CUBEUV_TEXEL_HEIGHT = 1 / hgt;
    //     ssgi.material.defines.CUBEUV_TEXEL_WIDTH =
    //       1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16));
    //     ssgi.material.defines.CUBEUV_MAX_MIP = maxMip.toFixed(1);
    //     ssgi.material.needsUpdate = true;
    //     ssgi.material.userData.envH = hgt;
    //   }
    //   for (let i = 0; i < Math.min(NC, 4); i++) {
    //     const l = cascadedShadows.lights[i];
    //     u["uSM" + i].value = l.shadow.map?.depthTexture ?? null;
    //     u.uSMat.value[i].copy(l.shadow.matrix);
    //   }
    //   for (let i = NC; i < 4; i++) u["uSM" + i].value = u.uSM0.value;
    //   const sp = cascadedShadows.splits;
    //   u.uSplits.value.set(
    //     sp[1] ?? 1e9,
    //     sp[2] ?? 1e9,
    //     sp[3] ?? 1e9,
    //     sp[4] ?? 1e9,
    //   );
    //   const A = lighting.amb;
    //   u.envMap.value = envTex;
    //   u.uEnvI.value =
    //     (scene.environmentIntensity ?? 1) * (A.shape.z > 0 ? A.shape.z : 1);
    //   u.uAmbBounce.value
    //     .set(A.bounce.x, A.bounce.y, A.bounce.z)
    //     .multiplyScalar(0.6 * (scene.environmentIntensity ?? 1));
    //   u.uPrevRad.value = bloomDown[1].texture;
    //   u.uHavePrev.value = !resetHistory && frame > 2 ? 1 : 0;
    //   u.uProj.value.copy(cam.projectionMatrix);
    //   u.uProjInv.value.copy(cam.projectionMatrixInverse);
    //   u.uCamWorld.value.copy(cam.matrixWorld);
    //   u.uPrevViewProj.value.copy(prevViewProj);
    //   u.uRes.value.set(W, H);
    //   u.uFrame.value = frame % 64;
    //   const giN = lighting.nightHaze?.k ?? 0; // (night)
    //   u.uStrength.value = grade.gi * (A.bounce.w ?? 1);
    //   u.uAbs.value = giN;
    //   u.uAbsK.value = grade.giNight;
    //   ssgi.render(renderer, ssgiRT);
    // }

    // --- volumetric sun shafts
    const doShafts = shaftsOn && lighting.fog.shafts > 0 && sky.sunDir.y > 0.0;
    if (doShafts) {
      prof.begin("shafts");
      const u = shafts.uniforms;
      for (let i = 0; i < Math.min(NC, 4); i++) {
        const l = cascadedShadows.lights[i];
        u["uSM" + i].value = l.shadow.map?.depthTexture ?? null;
        u.uSMat.value[i].copy(l.shadow.matrix);
      }
      for (let i = NC; i < 4; i++) u["uSM" + i].value = u.uSM0.value;
      const sp = cascadedShadows.splits;
      u.uSplits.value.set(
        sp[1] ?? 1e9,
        sp[2] ?? 1e9,
        sp[3] ?? 1e9,
        sp[4] ?? 1e9,
      );
      u.uProjInv.value.copy(cam.projectionMatrixInverse);
      u.uCamWorld.value.copy(cam.matrixWorld);
      u.uCamPos.value.copy(camPos);
      cam.getWorldDirection(u.uCamFwd.value);
      u.uRes.value.set(W, H);
      u.uFrame.value = frame % 64;
      u.uStrength.value = grade.shafts * lighting.fog.shafts;
      if (u.uSM0.value) shafts.render(renderer, shaftRT);
    }

    // --- (night) city-light haze
    const doCVol =
      cityLightsShared.origin.w > 0 &&
      grade.cityVol > 0 &&
      cityLights.volume > 0 &&
      Q.shafts !== false;
    if (doCVol) {
      prof.begin("cityVolume");
      const u = cvol.uniforms;
      u.uProjInv.value.copy(cam.projectionMatrixInverse);
      u.uCamWorld.value.copy(cam.matrixWorld);
      u.uCamPos.value.copy(camPos);
      u.uFrame.value = frame % 64;
      u.uStrength.value = grade.cityVol * (lighting.cityVol?.strength ?? 1);
      u.uDensity.value = lighting.cityVol?.density ?? 0.012;
      u.uHeightFall.value = 1 / (lighting.cityVol?.height ?? 40);
      cvol.render(renderer, cvolRT);
    }

    // --- AO
    let colorTex = sceneRT.texture;
    if (ao) {
      prof.begin("ao");
      ao.render(renderer, sceneRT, aoRT);
      colorTex = aoRT.texture;
    }

    // --- composite
    prof.begin("composite");
    {
      const u = composite.uniforms;
      u.uColor.value = colorTex;
      u.uProjInv.value.copy(cam.projectionMatrixInverse);
      u.uCamWorld.value.copy(cam.matrixWorld);
      u.uCamPos.value.copy(camPos);
      const f = lighting.fog;
      u.uMoonDir.value.copy(lighting.moon?.dir ?? u.uMoonDir.value);
      u.uMoonK.value = lighting.moon?.k ?? 0; // (daynight)
      {
        const nh = lighting.nightHaze;
        u.uNightFog.value = nh ? nh.k : 0;
        if (nh) {
          u.uNightHaze.value.fromArray(nh.low);
          u.uNightHazeHi.value.fromArray(nh.high);
          u.uGlowCol.value.fromArray(nh.cfg.glowCol);
          u.uGlowH.value = nh.cfg.glowH;
          u.uGlowK.value = nh.cfg.glowK;
        }
      } // (night)
      u.uFogDensity.value = f.density;
      u.uFogFalloff.value = f.heightFalloff;
      u.uFogSun.value = f.sunScatter;
      u.uFogTint.value.copy(f.tint);
      u.uFogStart.value = f.startDistance;
      u.uSSROn.value = doSSR ? 1 : 0;
      u.uGIOn.value = doGI ? 1 : 0;
      u.uGIAbs.value = lighting.nightHaze?.k ?? 0;
      u.uGIAlb.value = grade.giNightAlbedo / Math.PI; // (night)
      u.uShaftOn.value = doShafts && shafts.uniforms.uSM0.value ? 1 : 0;
      u.uCVolOn.value = doCVol ? 1 : 0;
      u.uQuarterPx.value.set(1 / cvolRT.width, 1 / cvolRT.height);
      u.uHalfPx.value.set(1 / shaftRT.width, 1 / shaftRT.height);
      composite.render(renderer, litRT);
    }

    // --- TAA
    let cur = litRT;
    if (Q.taa) {
      prof.begin("taa");
      const u = taa.uniforms;
      const out = hist[histIdx],
        prev = hist[1 - histIdx];
      u.uCurrent.value = litRT.texture;
      u.uHistory.value = prev.texture;
      u.uProjInv.value.copy(cam.projectionMatrixInverse);
      u.uCamWorld.value.copy(cam.matrixWorld);
      u.uPrevViewProj.value.copy(prevViewProj);
      u.uRes.value.set(W, H);
      u.uReset.value = resetHistory ? 1 : 0;
      u.uBlend.value = 0.08;
      // Character animation changes at the limbs even when its root transform is stable; low-res history
      // otherwise leaves a pale temporal fringe around hands and other moving silhouette details.
      u.uCharBlend.value = Q.name === "low" ? 0.55 : 0.14;
      // Clouds are static in world space. Low mode's quarter-resolution sky benefits from longer
      // reprojection history to hide the coarse raymarch changing as the camera moves.
      u.uSkyBlend.value = Q.name === "low" ? 0.04 : 0.08;
      u.uSkyBlendCap.value = Q.name === "low" ? 1 : 0;
      u.uJitter.value.set(-jx / W, -jy / H);
      u.uProjInvU.value.copy(projUnjit).invert();
      u.uMaskOn.value = maskOn ? 1 : 0;
      u.uObjDelta.value.copy(objDelta);
      taa.render(renderer, out);
      histIdx = 1 - histIdx;
      cur = out;
    }
    resetHistory = false;

    // restore unjittered projection for everything after (DoF / MeshBuilder reconstruct with the jitter-free matrix)
    cam.projectionMatrix.copy(projUnjit);
    cam.projectionMatrixInverse.copy(projUnjit).invert();

    let pp = [postA, postB],
      ppi = 0;
    // --- DoF
    if (dofState.aperture > 0.01) {
      prof.begin("dof");
      updateCoc(dofPre.uniforms, cam);
      dofPre.uniforms.uColor.value = cur.texture;
      dofPre.uniforms.uPx.value.set(1 / W, 1 / H);
      dofPre.render(renderer, dofHalfA);
      dofBokeh.uniforms.uSrc.value = dofHalfA.texture;
      dofBokeh.uniforms.uMaxCoc.value = dofState.maxBlur;
      dofBokeh.uniforms.uPx.value.set(2 / W, 2 / H);
      dofBokeh.render(renderer, dofHalfB);
      dofPost.uniforms.uSrc.value = dofHalfB.texture;
      dofPost.uniforms.uPx.value.set(2 / W, 2 / H);
      dofPost.render(renderer, dofHalfA);
      updateCoc(dofCombine.uniforms, cam);
      dofCombine.uniforms.uColor.value = cur.texture;
      dofCombine.uniforms.uDof.value = dofHalfA.texture;
      dofCombine.render(renderer, pp[ppi]);
      cur = pp[ppi];
      ppi = 1 - ppi;
    }

    // --- motion blur
    if (
      mbState.strength > 0.001 &&
      (mbState.fade > 0.001 || mbState.velocity || mbState.angular)
    ) {
      let pvp = prevViewProj;
      if (mbState.velocity || mbState.angular) {
        // synthetic previous camera: undo `velocity * (1/60)` translation and `angular * (1/60)` rotation
        const h = 1 / 60;
        const p = camPos.clone();
        if (mbState.velocity) p.addScaledVector(mbState.velocity, -h);
        const q = tmpQ.clone();
        if (mbState.angular) {
          const ang = mbState.angular.length() * h;
          if (ang > 0)
            q.premultiply(
              new THREE.Quaternion().setFromAxisAngle(
                mbState.angular.clone().normalize(),
                -ang,
              ),
            );
        }
        _virtual.compose(p, q, new THREE.Vector3(1, 1, 1)).invert();
        pvp = tmpM.multiplyMatrices(projUnjit, _virtual);
      }
      if (mbState.have || mbState.velocity || mbState.angular) {
        prof.begin("motionBlur");
        const u = motion.uniforms;
        u.uColor.value = cur.texture;
        u.uProjInv.value.copy(cam.projectionMatrixInverse);
        u.uCamWorld.value.copy(cam.matrixWorld);
        u.uPrevViewProj.value.copy(pvp);
        // normalise real per-frame motion to a 60 fps shutter
        const fpsNorm =
          mbState.velocity || mbState.angular
            ? 1
            : Math.min(2, 1 / 60 / Math.max(dt, 1e-3));
        u.uScale.value =
          mbState.strength *
          fpsNorm *
          (mbState.velocity || mbState.angular ? 1 : (mbState.fade ?? 1));
        u.uMask.value =
          mbState.maskDistance ??
          (dofState.auto || dofState.focus < 30 ? dofState.focus + 1.5 : 3.0);
        u.uRes.value.set(W, H);
        u.uFrame.value = frame % 64;
        motion.render(renderer, pp[ppi]);
        cur = pp[ppi];
        ppi = 1 - ppi;
      }
    }

    // --- bloom
    prof.begin("bloom");
    let src = cur.texture,
      sw = W,
      shh = H;
    for (let i = 0; i < bloomDown.length; i++) {
      bloomDownPass.uniforms.uSrc.value = src;
      bloomDownPass.uniforms.uPx.value.set(1 / sw, 1 / shh);
      bloomDownPass.uniforms.uFirst.value = i === 0 ? 1 : 0;
      bloomDownPass.render(renderer, bloomDown[i]);
      src = bloomDown[i].texture;
      sw = bloomDown[i].width;
      shh = bloomDown[i].height;
    }
    let up = bloomDown[bloomDown.length - 1];
    for (let i = bloomDown.length - 2; i >= 0; i--) {
      bloomUpPass.uniforms.uSrc.value = up.texture;
      bloomUpPass.uniforms.uCur.value = bloomDown[i].texture;
      bloomUpPass.uniforms.uPx.value.set(1 / up.width, 1 / up.height);
      bloomUpPass.uniforms.uThrSrc.value = i === bloomDown.length - 2 ? 1 : 0;
      bloomUpPass.uniforms.uT.value = grade.bloomThreshold;
      bloomUpPass.uniforms.uK.value = grade.bloomKnee;
      bloomUpPass.render(renderer, bloomUp[i]);
      up = bloomUp[i];
    }

    // --- auto exposure
    if (grade.autoExposure) {
      prof.begin("autoExposure");
      const u = aePass.uniforms;
      const prevT = aeRT[aeIdx],
        outT = aeRT[1 - aeIdx];
      u.uSrc.value = bloomDown[Math.min(3, bloomDown.length - 1)].texture;
      u.uPrev.value = prevT.texture;
      u.uReset.value = aeReset ? 1 : 0;
      aeReset = false;
      // asymmetric speed can't be decided on the CPU without readback: use the mean of both (smooth, stable)
      const sp = 0.5 * (grade.aeSpeedUp + grade.aeSpeedDown);
      u.uRate.value = 1 - Math.exp(-Math.max(dt, 1 / 240) * sp);
      aePass.render(renderer, outT);
      aeIdx = 1 - aeIdx;
    }

    // --- final
    prof.begin("final");
    {
      const u = final.uniforms;
      u.uColor.value = cur.texture;
      u.uBloom.value = up.texture;
      u.uStreakSrc.value = bloomDown[0].texture;
      u.uStreakLo.value = bloomDown[Math.min(3, bloomDown.length - 1)].texture;
      u.uStreak.value = grade.streak * (lighting.nightHaze?.k ?? 0); // (night)
      u.uPx.value.set(1 / W, 1 / H);
      const td = lighting.tod || {};
      u.uRain.value = td.rain ?? 0;
      u.uExposure.value = grade.exposure * (td.exposure ?? 1);
      u.uBloomStr.value = grade.bloom * (td.bloom ?? 1);
      u.uSat.value = grade.saturation;
      u.uFlare.value = lens.onScreen
        ? grade.flare * (lighting.tod.sunK ?? 1)
        : 0; // (daynight) no sun flare once the sun has set u.uSunUv.value.copy(lens.sunUv);
      u.uSunCol.value.copy(sky.skyUniforms.uSunColor.value);
      u.uContrast.value = grade.contrast;
      u.uPivot.value = grade.pivot;
      u.uSatKnee.value = grade.satKnee;
      u.uVignette.value = grade.vignette;
      u.uCA.value = grade.ca;
      u.uSharpen.value = grade.sharpen;
      u.uGrain.value = grade.grain;
      u.uFrame.value = frame % 36000; // (lighting2 r3) long period: rain streak clock
      u.uAspect.value = W / H;
      u.uProjInvS.value.copy(cam.projectionMatrixInverse);
      u.uAE.value = aeRT[aeIdx].texture;
      u.uAEOn.value = grade.autoExposure ? 1 : 0;
      u.uAEKey.value = grade.aeKey;
      u.uAEStr.value = grade.aeStrength;
      u.uAERange.value = grade.aeRange;
      u.uLift.value = _liftN
        .copy(grade.lift)
        .addScaledVector(grade.nightLift, lighting.nightHaze?.k ?? 0); // (night)
      u.uToe.value = grade.toe;
      u.uSplitSh.value = _splitN
        .copy(grade.nightSplitStreet)
        .lerp(
          grade.nightSplitShadow,
          THREE.MathUtils.smoothstep(camPos.y, 25, 120),
        )
        .lerp(grade.splitShadow, 1 - (lighting.nightHaze?.k ?? 0));
      /* (night r7) street-level cameras: cooler (luma-kept) darks, moonlit blue like the street ref; aerials milder */ /* (night r5) cooler darks: blue night atmosphere (rooftop_haze / street refs) */ u.uSplitHi.value =
        grade.splitHigh;
      u.uWarmGuard.value = lighting.nightHaze?.k ?? 0;
      u.uSplitBal.value = THREE.MathUtils.lerp(
        grade.splitBalance,
        0.14,
        lighting.nightHaze?.k ?? 0,
      ); /* (night r8) lamp pools / warm lit surfaces fall on the (warm) highlight side of the split */
      final.render(renderer, null);
    }
    if (pipeline.debug) {
      const D = pipeline.debug,
        T = {
          ssr: ssrRT,
          ssgi: ssgiRT,
          shafts: shaftRT,
          cvol: cvolRT,
          ao: aoRT,
          scene: sceneRT,
          lit: litRT,
          ssrw: sceneRT,
        }[D.tex];
      if (T) {
        dbgPass.uniforms.uSrc.value = T.texture;
        dbgPass.uniforms.uScale.value = D.scale ?? 1;
        dbgPass.uniforms.uMode.value = D.tex === "ssrw" ? 1 : 0;
        dbgPass.render(renderer, null);
      }
    }
    prof.begin("external"); // GPU work issued between frames (planar mirrors, world/player updates) until next render()

    // --- history
    prevViewProj.copy(viewProj);
    prevCamPos.copy(camPos);
    prevCamQuat.copy(tmpQ);
    mbState.have = true;
  }

  const pipeline = {
    debug: null,
    render,
    setSize,
    grade,
    get ao() {
      return ao;
    },
    passes: { ssr, ssgi, shafts, composite, taa, final }, // debug access to uniforms
    gmirror, // (render r-refl)
    setFocus(d) {
      dofState.focus = Math.max(0.1, d);
    },
    setAperture(px) {
      dofState.aperture = Math.max(0, px);
    },
    /** background blur scale (1 = physical, <1 keeps the background crisper while the foreground still blurs) */
    setDofFar(k) {
      dofState.far = Math.max(0, k);
    },
    setDof({ focus, aperture, maxBlur, far } = {}) {
      if (far !== undefined) dofState.far = far;
      if (focus !== undefined) dofState.focus = focus;
      if (aperture !== undefined) dofState.aperture = aperture;
      if (maxBlur !== undefined) dofState.maxBlur = maxBlur;
    },
    setAutoFocus(obj) {
      dofState.auto = obj || null;
    },
    setMotionBlur(strength, opts = {}) {
      mbState.strength = strength;
      mbState.velocity = opts.cameraVelocity
        ? opts.cameraVelocity.clone()
        : null;
      mbState.angular = opts.angularVelocity
        ? opts.angularVelocity.clone()
        : null;
      mbState.maskDistance = opts.maskDistance ?? null;
    },
    resetHistory() {
      resetHistory = true;
    },
    resetExposure() {
      aeReset = true;
    },
    /** metered log2 luminance {adapted, current} (debug; GPU readback) */
    readExposure() {
      const b = new Float32Array(4);
      renderer.readRenderTargetPixels(aeRT[aeIdx], 0, 0, 1, 1, b);
      return { adapted: b[0], current: b[1] };
    },
    timings(reset) {
      return prof.report(reset);
    },
    prepareMaterials() {
      if (ssrOn) scanSSROptOut();
    }, // (perf r3) the NO_SSR defines the first render would add (render/warmup.ts compiles after them)
    get size() {
      return { W, H };
    },
    /** draw calls / triangles of the previous frame summed over ALL passes (shadows, mirrors, post) */
    get stats() {
      return { ...stats };
    },
  };
  return pipeline;
}
