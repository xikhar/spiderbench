// @ts-nocheck
// River / harbour water around the island.
// One large plane at G.WATER_Y with a PBR water material:
//   - world-space multi-scale scrolling wave normals (two chop directions + a broad swell), wind slicks (calm,
//     mirror-like bands) and current streaks, normals faded with distance (no far shimmer)
//   - PLANAR REFLECTION: a low-res mirror render of the big stuff (skyline, far shores, bridges, hinterland: layers
//     28 + REFL_LAYER) replaces the env-map specular where it hits, distorted by the wave normals (vertical streaks
//     like a real river), hazed toward the sky radiance with the reflected distance; misses keep the sky IBL
//   - Fresnel from the PBR model: dark green-grey body looking down near the camera, sky/skyline mirror at grazing
//   - opts out of the pipeline's SSR (the mirror replaces it; SSR's 220 m rays never reached the far shore)
// Plus: wet bands (dark, algae-stained tidal strip) along every bulkhead / seawall / pier edge, and a horizon skirt
// just inside the far plane.
import { lazyShaderSections } from "../shaderSections.ts";
import waterShaderSource from "./shaders/glsl/water.glsl?raw";
import { injectShader } from "../render/shaderInjection.ts";
import * as THREE from "three";
import { G, distToShore, LAND_POLY } from "./layout.ts";
import { FAR_LANDS } from "./farshore.ts";
import { REFL_LAYER } from "./waterLayers.ts";

export { REFL_LAYER };

const waterShader = lazyShaderSections(() => waterShaderSource);


const BIG_LAYER = 28; // render/cascadedShadows.ts BIG_CASTER_LAYER (tagged large casters: towers, walls, bridges)

export function createRiverMaterial(
  T,
  refl = null,
  { ssr = false, body = [0.06, 0.082, 0.09], shore = null } = {},
) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0.0,
  });
  if (!ssr) mat.defines = { NO_SSR: "" }; // (park ponds keep the pipeline SSR: their reflections are short range)
  if (shore) mat.defines = { ...(mat.defines ?? {}), HAS_SHORE: "" };
  const uni = {
    tWN: { value: T.waterNrm },
    tWNoise: { value: T.noise },
    uWTime: { value: 0 },
    tRefl: { value: refl?.texture ?? null },
    uTexMat: { value: refl?.texMat ?? new THREE.Matrix4() },
    uReflOn: { value: 0 },
    tShore: { value: shore?.texture ?? null },
    uShoreBox: { value: shore?.box ?? new THREE.Vector4(0, 0, 1, 1) },
  };
  mat.userData.uniforms = uni;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", waterShader.vertexCommon)
      .replace("#include <fog_vertex>", waterShader.vertexFogVertex);
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        injectShader(waterShader.fragmentCommon, body.map((v) => v.toFixed(4)).join(", ")),
      )
      .replace("#include <map_fragment>", waterShader.fragmentMap)
      .replace("#include <roughnessmap_fragment>", waterShader.fragmentRoughness)
      .replace("#include <normal_fragment_maps>", waterShader.fragmentNormalMaps)
      // (round 7) cast shadows on open water: a river mostly reflects the sky, so a tower's shadow only removes the
      // sun's glare / diffuse share -> soften the sun occlusion (was a hard dark-blue slab across the East River)
      .replace(
        "#include <lights_fragment_begin>",
        injectShader(
          waterShader.fragmentLightsBegin,
          THREE.ShaderChunk.lights_fragment_begin.replace(
            "directLight.color *= ( directLight.visible && receiveShadow ) ? csmShadow() : 1.0;",
            "wSh = ( directLight.visible && receiveShadow ) ? csmShadow() : 1.0; directLight.color *= mix(0.8, 1.0, wSh); /* (round 10: 0.62 -> 0.8, critic read tower shadows on the river as dark decal slabs) */",
          ),
        ),
      )
      .replace("#include <lights_fragment_maps>", waterShader.fragmentLightsMaps);
  };
  mat.customProgramCacheKey = () =>
    "city-river-v11" +
    (ssr ? "-ssr" : "") +
    (shore ? "-sh" : "") +
    body.join(",");
  return mat;
}

// planar mirror at y = WATER_Y: mirrored camera renders layers BIG_LAYER + REFL_LAYER into a low-res HDR target
function createMirror(renderer) {
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const rt = new THREE.WebGLRenderTarget(
    Math.max(256, Math.round(size.x / 3)),
    Math.max(144, Math.round(size.y / 3)),
    { type: THREE.HalfFloatType },
  );
  const texMat = new THREE.Matrix4();
  const vcam = new THREE.PerspectiveCamera();
  vcam.layers.set(BIG_LAYER);
  vcam.layers.enable(REFL_LAYER);
  const bias = new THREE.Matrix4().set(
    0.5,
    0,
    0,
    0.5,
    0,
    0.5,
    0,
    0.5,
    0,
    0,
    0.5,
    0.5,
    0,
    0,
    0,
    1,
  );
  const _p = new THREE.Vector3(),
    _d = new THREE.Vector3(),
    _t = new THREE.Vector3(),
    _c = new THREE.Color(),
    _u = new THREE.Vector3();
  const Y = G.WATER_Y;
  let frame = 0;
  return {
    texture: rt.texture,
    texMat,
    render(scene, camera, hide) {
      camera.updateMatrixWorld();
      _p.setFromMatrixPosition(camera.matrixWorld);
      if (_p.y < Y + 0.3) return false;
      // inland at street level the rivers are hidden behind the blocks: skip the mirror
      if (_p.y < 45 && distToShore(_p.x, _p.z) > 260) return false;
      camera.getWorldDirection(_d);
      _t.copy(_p).add(_d);
      vcam.position.set(_p.x, 2 * Y - _p.y, _p.z);
      _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
      _u.y = -_u.y;
      vcam.up.copy(_u);
      vcam.lookAt(_t.x, 2 * Y - _t.y, _t.z);
      vcam.projectionMatrix.copy(camera.projectionMatrix);
      vcam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      vcam.updateMatrixWorld();
      texMat
        .copy(bias)
        .multiply(vcam.projectionMatrix)
        .multiply(vcam.matrixWorldInverse);
      frame++;
      for (const h of hide) h.visible = false;
      const prevRT = renderer.getRenderTarget();
      const prevAlpha = renderer.getClearAlpha();
      renderer.getClearColor(_c);
      const prevAuto = renderer.shadowMap.autoUpdate,
        prevOn = renderer.shadowMap.enabled;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.enabled = false; // cascades are fitted to the main camera
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, vcam);
      renderer.setRenderTarget(prevRT);
      renderer.setClearColor(_c, prevAlpha);
      renderer.shadowMap.autoUpdate = prevAuto;
      renderer.shadowMap.enabled = prevOn;
      for (const h of hide) h.visible = true;
      return true;
    },
  };
}

// the harbour plane (100 km, centred on the island) + an update(dt, camera) that advances the waves / renders the mirror
// distance-to-shore map (metres / 400 in R, 8 m/px) over the harbour: land polygons rasterised on a canvas, then a
// two-pass chamfer distance transform. Drives the silty near-shore tone / sheltered slicks of the river shader.
function shoreMap() {
  const X0 = -6400,
    Z0 = -8000,
    X1 = 6400,
    Z1 = 9600,
    PX = 8;
  const W = Math.round((X1 - X0) / PX),
    H = Math.round((Z1 - Z0) / PX);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d", { willReadFrequently: true });
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#fff";
  for (const pts of [LAND_POLY, ...FAR_LANDS.map((L) => L.pts)]) {
    g.beginPath();
    pts.forEach(([x, z], i) => {
      const u = (Math.max(-1e5, Math.min(1e5, x)) - X0) / PX,
        v = (Math.max(-1e5, Math.min(1e5, z)) - Z0) / PX;
      if (i) g.lineTo(u, v);
      else g.moveTo(u, v);
    });
    g.closePath();
    g.fill();
  }
  const img = g.getImageData(0, 0, W, H).data;
  const D = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) D[i] = img[i * 4] > 127 ? 0 : 1e9;
  const a = PX,
    b = PX * Math.SQRT2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let d = D[i];
      if (!d) continue;
      if (x > 0) d = Math.min(d, D[i - 1] + a);
      if (y > 0) {
        d = Math.min(d, D[i - W] + a);
        if (x > 0) d = Math.min(d, D[i - W - 1] + b);
        if (x < W - 1) d = Math.min(d, D[i - W + 1] + b);
      }
      D[i] = d;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let d = D[i];
      if (!d) continue;
      if (x < W - 1) d = Math.min(d, D[i + 1] + a);
      if (y < H - 1) {
        d = Math.min(d, D[i + W] + a);
        if (x < W - 1) d = Math.min(d, D[i + W + 1] + b);
        if (x > 0) d = Math.min(d, D[i + W - 1] + b);
      }
      D[i] = d;
    }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++)
    out[i] = Math.min(255, Math.round((D[i] / 400) * 255));
  const tex = new THREE.DataTexture(
    out,
    W,
    H,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { texture: tex, box: new THREE.Vector4(X0, Z0, X1 - X0, Z1 - Z0) };
}

export function buildWater({ scene, T, renderer = null }) {
  const mirror = renderer ? createMirror(renderer) : null;
  let shore = null;
  try {
    shore = shoreMap();
  } catch (e) {
    console.warn("[water] shore map", e);
  }
  const mat = createRiverMaterial(T, mirror, { shore });
  const WS = 300000;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WS, WS, 16, 16)
      .rotateX(-Math.PI / 2)
      .translate(0, G.WATER_Y, 0),
    mat,
  );
  mesh.name = "water";
  mesh.receiveShadow = true;
  scene.add(mesh);
  // horizon skirt: the flat world would end at the camera's far plane in a line below the true horizon. A ring wall
  // just inside the far plane, centred on the camera, rising from the water to the camera's height, fills the last
  // fraction of a degree down to the horizon with (fully aerial-perspective fogged) distant water / shore.
  const skirt = horizonSkirt();
  scene.add(skirt);
  let t = 0;
  const root = () => {
    let o = mesh;
    while (o.parent) o = o.parent;
    return o;
  };
  return {
    mesh,
    material: mat,
    skirt,
    update(dt, camera) {
      t += dt;
      mat.userData.uniforms.uWTime.value = t;
      if (camera) {
        const R = camera.far * 0.94;
        skirt.position.set(camera.position.x, G.WATER_Y, camera.position.z);
        skirt.scale.set(R, Math.max(2, camera.position.y - G.WATER_Y + 1), R);
        skirt.updateMatrixWorld();
        if (mirror)
          mat.userData.uniforms.uReflOn.value = mirror.render(root(), camera, [
            mesh,
            skirt,
          ])
            ? 1
            : 0;
      }
    },
  };
}

function horizonSkirt(n = 180) {
  const P = [],
    N = [],
    C = [],
    I = [];
  const land = [0.3, 0.3, 0.29],
    water = [0.14, 0.17, 0.19];
  // direction classes (from the island): west (New Jersey), east (Long Island), north (Bronx / Westchester);
  // south: open ocean past the Narrows
  const colAt = (a) => {
    const z = Math.sin(a);
    return z > 0.3 ? water : land;
  };
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2,
      x = Math.cos(a),
      z = Math.sin(a),
      c = colAt(a);
    P.push(x, 0, z, x, 1, z);
    N.push(0, 1, 0, 0, 1, 0);
    C.push(...c, ...c);
    if (i < n) {
      const b = i * 2;
      I.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  const m = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  m.name = "horizonSkirt";
  m.frustumCulled = false;
  m.matrixAutoUpdate = false;
  return m;
}

// Wet tidal band along vertical water edges (seawalls, bulkheads, pier decks, piles, anchorages): a dark, algae-stained
// strip from just below the water line up ~1.1 m, fading out with a ragged top edge. segs: [{ax, az, bx, bz, nx, nz}]
// (outward normal toward the water). One transparent mesh, 2 cm proud of the wall (no z-fight, no collision change).
export function buildWetBands({
  scene,
  T,
  segs,
  y0 = G.WATER_Y - 0.25,
  h = 1.35,
}) {
  const P = [],
    N = [],
    UV = [],
    I = [];
  let v = 0;
  for (const s of segs) {
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (L < 0.05) continue;
    const o = 0.02;
    const ax = s.ax + s.nx * o,
      az = s.az + s.nz * o,
      bx = s.bx + s.nx * o,
      bz = s.bz + s.nz * o;
    P.push(ax, y0, az, bx, y0, bz, bx, y0 + h, bz, ax, y0 + h, az);
    for (let k = 0; k < 4; k++) N.push(s.nx, 0, s.nz);
    const u0 = s.ax * 0.7 + s.az * 0.3,
      u1 = u0 + L;
    UV.push(u0, 0, u1, 0, u1, 1, u0, 1);
    // wind so the face points along the normal
    const cx = (bz - az) * h,
      cz = -(bx - ax) * h; // (b-a) x up
    if (cx * s.nx + cz * s.nz <= 0) I.push(v, v + 1, v + 2, v, v + 2, v + 3);
    else I.push(v, v + 2, v + 1, v, v + 3, v + 2);
    v += 4;
  }
  if (!v) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(new THREE.Uint32BufferAttribute(I, 1));
  g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tWetN = { value: T.noise };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", waterShader.vertexCommonByWetSurfaceUv)
      .replace("#include <uv_vertex>", waterShader.vertexUvVertex);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", waterShader.fragmentCommonByWetSurfaceUv)
      .replace("#include <map_fragment>", waterShader.fragmentMapByWetSurfaceUv);
  };
  mat.customProgramCacheKey = () => "wet-band-v1";
  const m = new THREE.Mesh(g, mat);
  m.name = "wetBands";
  m.receiveShadow = true;
  m.renderOrder = 1;
  scene.add(m);
  return m;
}
