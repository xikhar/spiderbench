// @ts-nocheck
import __shaderRaw1 from "./shaders/fragment/sky-lut_frag.frag?raw";
import __shaderRaw2 from "./shaders/fragment/sky-noise_frag.frag?raw";
import __shaderRaw3 from "./shaders/glsl/sky-glsl_sky_common.glsl?raw";
import __shaderRaw4 from "./shaders/glsl/sky-glsl_clouds.glsl?raw";
import __shaderRaw5 from "./shaders/fragment/sky-skypass.frag?raw";
import __shaderRaw6 from "./shaders/vertex/sky-envsky.vert?raw";
import __shaderRaw7 from "./shaders/fragment/sky-envsky.frag?raw";
import { injectShader } from "./shader.ts";
// OWNER: render agent.
// Physically based sky: single-scattering atmosphere (Rayleigh + Mie + ozone, approx multiple scattering)
// baked into a small sky-view LUT, raymarched cumulus cloud layer (Perlin-Worley 3D noise), procedural distant
// skyline, PMREM environment generation for IBL.
import * as THREE from "three";
import { FSPass, makeRT, GLSL_DEPTH } from "./common.ts";
import { GLSL_ATMOS, sunTransmittance } from "./atmosphere.ts";

const LUT_W = 256,
  LUT_H = 128;

// ---------------------------------------------------------------------------------------------------------
// GLSL: sky LUT generation (radiance for unit sun illuminance), parameterised relative to the sun azimuth.
const LUT_FRAG = injectShader(__shaderRaw1, GLSL_ATMOS);

// ---------------------------------------------------------------------------------------------------------
// GLSL: tileable Perlin-Worley 3D noise generation (R = perlin-worley, GBA = worley fbm at increasing freqs)
const NOISE_FRAG = __shaderRaw2;

// ---------------------------------------------------------------------------------------------------------
// GLSL: shared sky evaluation (LUT lookup, clouds, skyline). Requires uniforms declared in SKY_UNIFORMS.
export const GLSL_SKY_COMMON = injectShader(
  __shaderRaw3,
  GLSL_ATMOS,
  LUT_W,
  LUT_W,
);

const GLSL_CLOUDS = __shaderRaw4;

export function createSky(renderer, quality) {
  // LUT target
  const lut = makeRT(LUT_W, LUT_H, { type: THREE.HalfFloatType });
  const lutPass = new FSPass({
    name: "skyLUT",
    fragmentShader: LUT_FRAG,
    uniforms: {
      uSunEl: { value: 0.6 },
      uMie: { value: 2.2 },
      uViewH: { value: 0.05 },
      uMS: { value: 2.2 },
      uGroundAlbedo: { value: new THREE.Vector3(0.12, 0.12, 0.11) },
    },
  });

  // 3D noise (generated on GPU once)
  const NS = 128;
  const noiseRT = new THREE.WebGL3DRenderTarget(NS, NS, NS, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    depthBuffer: false,
  });
  const nt = noiseRT.texture;
  nt.wrapS = nt.wrapT = nt.wrapR = THREE.RepeatWrapping;
  nt.minFilter = THREE.LinearFilter;
  nt.magFilter = THREE.LinearFilter;
  nt.generateMipmaps = false;
  const noisePass = new FSPass({
    name: "cloudNoise",
    fragmentShader: NOISE_FRAG,
    uniforms: {
      uZ: { value: 0 },
      uPW: { value: new THREE.Vector2(0.4, 0.22) },
    },
  });
  const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  function genNoise(pwx, pwy) {
    // (atmosphere r1) re-callable (tuning): perlin-worley remap offset / range
    noisePass.uniforms.uPW.value.set(pwx, pwy);
    for (let z = 0; z < NS; z++) {
      noisePass.uniforms.uZ.value = (z + 0.5) / NS;
      renderer.setRenderTarget(noiseRT, z);
      renderer.render(noisePass.mesh, oc);
    }
    renderer.setRenderTarget(null);
  }
  genNoise(0.4, 0.22);

  const params = {
    elevation: 44,
    azimuth: 70, // degrees; azimuth measured from +X toward +Z
    mie: 1.4,
    ms: 2.2,
    skyScale: 16.0,
    envSaturation: 0.62,
    cloudCoverage: 0.52,
    cloudDensity: 0.7,
    cloudBottom: 1.25,
    cloudTop: 2.8,
    cloudFade: 28.0,
    cloudSun: 4.3,
    cloudAmb: 0.8,
    cloudScale: 0.13,
    cirrus: 0.6,
    cloudErode: 0.88,
    cloudDetailScale: 2.4, // (atmosphere r2) sun 6 -> 4.3 (key light x1.4), finer cauliflower detail
    // (atmosphere r1) brighter, larger cumulus + cirrus veil
    cloudBaseDark: 0.9,
    skylineVisible: 1.0,
    // time-of-day controls (set by lighting.js presets)
    lightScale: 1.0,
    lightTint: [1, 1, 1], // scale/tint of the key light (sun, or moon at night)
    skyTint: [1, 1, 1],
    skyGlow: [0, 0, 0], // sky radiance multiplier / additive horizon glow
    night: 0,
    stars: 0,
    groundAlbedo: [0.2, 0.18, 0.155], // env-map ground (sunlit street/sidewalk bounce)
    envFacadeAlbedo: [0.34, 0.29, 0.23], // env-map city band (sunlit limestone/brick bounce)
  };

  const sunDir = new THREE.Vector3();
  const sunColor = new THREE.Color();
  const skyUniforms = {
    uSkyLUT: { value: lut.texture },
    uSunDir: { value: sunDir },
    uSunColor: { value: new THREE.Vector3() },
    uSkyScale: { value: params.skyScale },
    uNoise: { value: nt },
    uCloudCoverage: { value: params.cloudCoverage },
    uCloudDensity: { value: params.cloudDensity },
    uCloudBottom: { value: params.cloudBottom },
    uCloudTop: { value: params.cloudTop },
    uCloudFade: { value: params.cloudFade },
    uCloudOffset: { value: new THREE.Vector3(3.1, 0, 7.7) },
    uSkyline: { value: 1.0 },
    uSkyTint: { value: new THREE.Vector3(1, 1, 1) },
    uSkyGlow: { value: new THREE.Vector3(0, 0, 0) },
    uFacadeAlb: { value: new THREE.Vector3(0.2, 0.185, 0.165) },
    uNight: { value: 0 },
    uCloudSun: { value: params.cloudSun },
    uCloudAmb: { value: params.cloudAmb },
    uCloudScale: { value: params.cloudScale },
    uHzK: { value: new THREE.Vector3(0.56, 0.63, 0.78) },
    uCirrus: { value: params.cirrus },
    uCloudErode: { value: params.cloudErode },
    uCloudDetailScale: { value: params.cloudDetailScale },
    uCloudBaseDark: { value: params.cloudBaseDark },
    uSunGlow: { value: new THREE.Vector4(0, 0, 0, 0) }, // (lighting2 r2)
    uOvercast: { value: 0 }, // (lighting2 r4)
  };

  function updateSun() {
    const el = THREE.MathUtils.degToRad(params.elevation),
      az = THREE.MathUtils.degToRad(params.azimuth);
    sunDir
      .set(
        Math.cos(el) * Math.cos(az),
        Math.sin(el),
        Math.cos(el) * Math.sin(az),
      )
      .normalize();
    const T = sunTransmittance(Math.max(el, 0.009), params.mie); // (daynight) the LUT follows the sun below the horizon; the key light colour is faded by lightScale
    // "white" sun above the atmosphere, times transmittance, times global scale (lux-ish arbitrary units)
    const E = params.skyScale * 0.62 * params.lightScale;
    const lt = params.lightTint;
    sunColor.setRGB(T[0] * E * lt[0], T[1] * E * lt[1], T[2] * E * lt[2]);
    skyUniforms.uSkyTint.value.fromArray(params.skyTint);
    skyUniforms.uSkyGlow.value.fromArray(params.skyGlow);
    skyUniforms.uSunGlow.value.fromArray(params.sunGlow ?? [0, 0, 0, 0]); // (lighting2 r2)
    skyUniforms.uOvercast.value = params.overcast ?? 0; // (lighting2 r4)
    skyUniforms.uNight.value = params.night;
    skyUniforms.uSunColor.value.set(sunColor.r, sunColor.g, sunColor.b);
    skyUniforms.uSkyScale.value = params.skyScale;
    lutPass.uniforms.uSunEl.value = el;
    lutPass.uniforms.uMie.value = params.mie;
    lutPass.uniforms.uMS.value = params.ms;
    lutPass.render(renderer, lut);
    renderer.setRenderTarget(null);
  }
  function syncCloudUniforms() {
    skyUniforms.uCloudCoverage.value = params.cloudCoverage;
    skyUniforms.uCloudDensity.value = params.cloudDensity;
    skyUniforms.uCloudBottom.value = params.cloudBottom;
    skyUniforms.uCloudTop.value = params.cloudTop;
    skyUniforms.uCloudFade.value = params.cloudFade;
    skyUniforms.uCloudSun.value = params.cloudSun;
    skyUniforms.uCloudAmb.value = params.cloudAmb;
    skyUniforms.uCloudScale.value = params.cloudScale;
    skyUniforms.uCirrus.value = params.cirrus;
    skyUniforms.uCloudErode.value = params.cloudErode;
    skyUniforms.uCloudDetailScale.value = params.cloudDetailScale;
    skyUniforms.uCloudBaseDark.value = params.cloudBaseDark;
  }

  // ---------------- half-res sky pass (screen) ----------------
  const skyPass = new FSPass({
    name: "skyPass",
    defines: {
      CLOUD_STEPS: quality.cloudSteps,
      CLOUD_LIGHT_STEPS: quality.cloudLightSteps,
    },
    uniforms: {
      ...skyUniforms,
      uDepth: { value: null },
      uProjInv: { value: new THREE.Matrix4() },
      uReversed: { value: 0 },
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uFullRes: { value: new THREE.Vector2(1, 1) },
      uFrame: { value: 0 },
      uStars: { value: 0 },
    },
    fragmentShader: injectShader(
      __shaderRaw5,
      GLSL_DEPTH,
      GLSL_SKY_COMMON,
      GLSL_CLOUDS,
    ),
  });

  // ---------------- env cubemap ----------------
  const envScene = new THREE.Scene();
  const envMat = new THREE.ShaderMaterial({
    name: "envSky",
    glslVersion: THREE.GLSL3,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    defines: { CLOUD_STEPS: 48, CLOUD_LIGHT_STEPS: 4 },
    uniforms: {
      ...skyUniforms,
      uCamPos: { value: new THREE.Vector3(0, 60, 0) },
      uGround: { value: new THREE.Vector3(0.2, 0.18, 0.155) },
      uEnvSat: { value: 0.62 },
      uEnvFacade: { value: new THREE.Vector3(0.34, 0.29, 0.23) },
    },
    vertexShader: __shaderRaw6,
    fragmentShader: injectShader(
      __shaderRaw7,
      GLSL_SKY_COMMON,
      GLSL_CLOUDS,
    ),
  });
  const envMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), envMat);
  envMesh.frustumCulled = false;
  envScene.add(envMesh);
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, {
    type: THREE.HalfFloatType,
    generateMipmaps: false,
  });
  const cubeCam = new THREE.CubeCamera(0.1, 100, cubeRT);
  envScene.add(cubeCam);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;

  function renderEnv() {
    const oldTarget = renderer.getRenderTarget();
    const oldTM = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    cubeCam.update(renderer, envScene);
    const next = pmrem.fromCubemap(cubeRT.texture, envRT ?? undefined);
    envRT = next;
    renderer.toneMapping = oldTM;
    renderer.setRenderTarget(oldTarget);
    return envRT.texture;
  }

  // (daynight) env re-bake spread over frames (day-night cycle): one cube face per call, then the PMREM pre-filter
  function renderEnvFace(i) {
    const ot = renderer.getRenderTarget(),
      of = renderer.getActiveCubeFace(),
      om = renderer.getActiveMipmapLevel();
    const oldTM = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    if (cubeCam.coordinateSystem !== renderer.coordinateSystem) {
      cubeCam.coordinateSystem = renderer.coordinateSystem;
      cubeCam.updateCoordinateSystem();
    }
    renderer.setRenderTarget(cubeRT, i);
    renderer.render(envScene, cubeCam.children[i]);
    renderer.toneMapping = oldTM;
    renderer.setRenderTarget(ot, of, om);
  }
  function finishEnv() {
    const ot = renderer.getRenderTarget();
    envRT = pmrem.fromCubemap(cubeRT.texture, envRT ?? undefined);
    renderer.setRenderTarget(ot);
    return envRT.texture;
  }

  updateSun();
  syncCloudUniforms();

  return {
    params,
    sunDir,
    sunColor,
    lut,
    noise: nt,
    noiseRT,
    skyUniforms,
    skyPass,
    genNoise,
    /** call after changing params.elevation/azimuth/mie/... ; re-bakes LUT (cheap). returns true */
    update() {
      syncCloudUniforms();
      updateSun();
      skyUniforms.uSkyline.value = params.skylineVisible;
      envMat.uniforms.uEnvSat.value = params.envSaturation;
      envMat.uniforms.uGround.value.fromArray(params.groundAlbedo);
      envMat.uniforms.uEnvFacade.value.fromArray(params.envFacadeAlbedo);
      skyPass.uniforms.uStars.value = params.stars;
    },
    renderEnv,
    renderEnvFace,
    finishEnv,
    /** Evaluate horizon/zenith colors on the CPU is not supported; use GLSL_SKY_COMMON in shaders. */
    renderSkyPass(target, camera, depthTex, fullW, fullH, frame, reversed) {
      const u = skyPass.uniforms;
      u.uDepth.value = depthTex;
      u.uProjInv.value.copy(camera.projectionMatrixInverse);
      u.uCamWorld.value.copy(camera.matrixWorld);
      u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
      u.uFullRes.value.set(fullW, fullH);
      u.uFrame.value = frame % 64;
      u.uReversed.value = reversed ? 1 : 0;
      u.uSkyline.value = params.skylineVisible;
      skyPass.render(renderer, target);
    },
  };
}
