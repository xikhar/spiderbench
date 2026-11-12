// OWNER: foundation agent (city remake). River / harbour water around the island.
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
import * as THREE from "three";
import { G, distToShore, LAND_POLY } from "./layout.js";
import { FAR_LANDS } from "./farshore.js";

export const REFL_LAYER = 27; // meshes the planar reflection renders besides the big shadow casters
const BIG_LAYER = 28; // render/csm.js BIG_CASTER_LAYER (tagged large casters: towers, walls, bridges)

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
            .replace(
                "#include <common>",
                "#include <common>\nvarying vec3 vWPw; uniform mat4 uTexMat; varying vec4 vRefl;",
            )
            .replace(
                "#include <fog_vertex>",
                `#include <fog_vertex>
        vWPw = (modelMatrix * vec4(transformed, 1.0)).xyz; vRefl = uTexMat * vec4(vWPw, 1.0);`,
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      uniform sampler2D tWN; uniform sampler2D tWNoise; uniform float uWTime; varying vec3 vWPw;
      uniform sampler2D tRefl; uniform float uReflOn; varying vec4 vRefl;
      uniform sampler2D tShore; uniform vec4 uShoreBox;
      vec3 wN; float wR; float wDist; float wSh = 1.0; vec2 wDisp; float wSlick; float wShore; float wNearS; float wStreak;
      vec2 wn(vec2 uv) { return texture(tWN, uv).rg * 2.0 - 1.0; }
      vec3 river() {
        vec2 p = vWPw.xz;
        float dist = length(vWPw - cameraPosition); wDist = dist;
        float t = uWTime;
        // broad structure: wind slicks (smooth bands) and current streaks along the rivers (z axis)
        vec3 m1 = texture(tWNoise, p / 900.0 + vec2(0.0, t * 0.0015)).rgb;
        vec3 m2 = texture(tWNoise, vec2(p.x / 260.0, p.y / 1400.0) + vec2(0.31, t * 0.004)).rgb;
        float slick = smoothstep(0.52, 0.72, m1.g) * 0.8 + smoothstep(0.62, 0.8, m2.r) * 0.35;
        // distance to the nearest shore (m, baked 8 m/px map): sheltered, silty water along the bulkheads
        wShore = 400.0;
        #ifdef HAS_SHORE
          wShore = texture(tShore, (p - uShoreBox.xy) / uShoreBox.zw).r * 400.0;
        #endif
        float nearS = 1.0 - smoothstep(6.0, 70.0, wShore);
        // cat's paws: gusts roughen large patches (they read as brighter / hazier sheen from the air)
        vec3 m3 = texture(tWNoise, p / 520.0 + vec2(t * 0.003, -t * 0.002)).rgb;
        float gust = smoothstep(0.45, 0.75, m3.b) * (1.0 - slick);
        slick = clamp(slick + nearS * 0.35, 0.0, 1.0); wSlick = slick; wNearS = nearS;
        // (round 5) wind rows / current streaks: long thin bands along the rivers (z) that break the sheet into
        // brighter, rougher lines (the refs' rivers are never one uniform glassy surface)
        float s1 = texture(tWNoise, vec2(p.x / 34.0, p.y / 520.0) + vec2(t * 0.0008, t * 0.003)).g;
        float s2 = texture(tWNoise, vec2(p.x / 11.0 + p.y / 900.0, p.y / 260.0) + vec2(0.57, t * 0.005)).r;
        float streak = smoothstep(0.58, 0.8, s1) * 0.7 + smoothstep(0.66, 0.86, s2) * 0.45;
        streak *= (1.0 - 0.7 * nearS); wStreak = streak;
        // wave normals: chop (two directions) + swell, faded with distance and in slicks
        // (atmosphere r2) the two broad layers are rotated off-axis and amplitude-modulated by the wind field, so their
        // repeat does not read as a tiling ripple across the whole East River from the air
        vec2 pr1 = mat2(0.829, -0.559, 0.559, 0.829) * p, pr2 = mat2(0.438, 0.899, -0.899, 0.438) * p;
        float amp = 0.55 + 0.9 * m3.g;
        vec2 n = wn(p / 9.0 + vec2(t * 0.021, t * 0.013)) * 0.55
               + wn(vec2(-p.y, p.x) / 14.0 + vec2(t * -0.012, t * 0.017)) * 0.45
               + wn(pr1 / 53.0 + vec2(t * 0.004, -t * 0.006)) * 0.7 * amp
               + wn(pr2 / 173.0 + vec2(-t * 0.002, t * 0.003)) * 0.5 * (1.5 - amp * 0.7);
        float fade = mix(1.0, 0.45, smoothstep(60.0, 2500.0, dist));
        n *= 0.34 * fade * (1.0 - 0.55 * slick) * (1.0 + 0.8 * gust + 0.6 * streak);
        // (round 8) far-field wave groups: long swell / wind-row undulation that fades IN with distance, where the chop is
        // sub-pixel -- the far river breaks into broad mottled sheen bands instead of one flat glossy plate
        n += (wn(vec2(p.x / 380.0, p.y / 170.0) + vec2(t * 0.0012, -t * 0.002)) * 0.7 + wn(p / 95.0 + vec2(-t * 0.003, t * 0.002)) * 0.45)
             * 0.15 * smoothstep(300.0, 1800.0, dist) * (1.0 - 0.5 * slick);
        wN = normalize(vec3(n.x, 1.0, n.y));
        // mirror distortion: waves smear the reflection vertically (screen space), less in the slicks; (round 5) plus a
        // mid-scale ripple field that does NOT fade with distance, so far reflections break into wobbly bands
        vec2 rip = wn(vec2(p.x / 26.0, p.y / 7.0) + vec2(t * 0.011, -t * 0.019)) + 0.6 * wn(p / 61.0 + vec2(-t * 0.006, t * 0.009));
        wDisp = n * (0.9 - 0.5 * slick) + rip * 0.09 * (1.0 - 0.5 * slick);
        // roughness (round 5: ~0.1-0.3 like real wind-blown river water): calm slicks, rougher chop / gusts / streaks,
        // far water rougher to integrate sub-pixel waves
        wR = clamp(0.09 + 0.08 * (1.0 - slick) + 0.1 * gust + 0.07 * streak + 0.07 * smoothstep(300.0, 5000.0, dist), 0.07, 0.32);
        // (round 8) far wind fields: broad rough / glassy patches that stay visible at 1-4 km (hazier vs mirror sheen)
        wR = clamp(wR + (texture(tWNoise, p / 1500.0 + vec2(0.13, t * 0.0006)).g - 0.5) * 0.22 * smoothstep(400.0, 1500.0, dist), 0.06, 0.34);
        #ifndef NO_SSR
          wR = max(wR + 0.05, 0.13); // (atmosphere r2) ponds / reservoir: wind-ruffled, the cloud reflection is never a crisp cubemap
        #endif
        // body colour: deep muted green-grey, turbid variation; silty olive-brown along the shores, a little deeper /
        // bluer mid-channel (depth), current streaks along the rivers
        vec3 c = vec3(${body.map((v) => v.toFixed(4)).join(", ")});
        c *= 0.85 + 0.3 * m1.r;
        c = mix(c, vec3(0.07, 0.085, 0.075), smoothstep(0.4, 0.8, m2.b) * 0.5);
        c = mix(c, vec3(0.06, 0.066, 0.055), nearS * 0.55);
        c = mix(c, c * vec3(0.8, 0.9, 1.05), smoothstep(150.0, 400.0, wShore));
        c *= 1.0 + 0.25 * streak;
        // (round 7) wash line: a broken pale band of churned water / flotsam hugging bulkheads and pier edges, and a
        // brown-olive silt plume a little further out (the rivers change colour toward every shore)
        #ifdef HAS_SHORE
        {
          float fn = texture(tWNoise, p / 23.0 + vec2(t * 0.002, -t * 0.003)).g, fn2 = texture(tWNoise, p / 6.0 + vec2(-t * 0.004, t * 0.002)).b;
          float wash = (1.0 - smoothstep(1.0, 9.0 + 6.0 * fn, wShore)) * smoothstep(0.35, 0.65, fn * 0.6 + fn2 * 0.6);
          c = mix(c, vec3(0.2, 0.205, 0.19), wash * 0.55);
          float silt = (1.0 - smoothstep(10.0, 120.0, wShore)) * (0.55 + 0.45 * fn);
          c = mix(c, vec3(0.085, 0.08, 0.058), silt * 0.4);
        }
        #endif
        return c;
      }`,
            )
            .replace("#include <map_fragment>", "diffuseColor.rgb = river();")
            .replace(
                "#include <roughnessmap_fragment>",
                "float roughnessFactor = wR;",
            )
            .replace(
                "#include <normal_fragment_maps>",
                "normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);",
            )
            // (round 7) cast shadows on open water: a river mostly reflects the sky, so a tower's shadow only removes the
            // sun's glare / diffuse share -> soften the sun occlusion (was a hard dark-blue slab across the East River)
            .replace(
                "#include <lights_fragment_begin>",
                THREE.ShaderChunk.lights_fragment_begin.replace(
                    "directLight.color *= ( directLight.visible && receiveShadow ) ? csmShadow() : 1.0;",
                    "wSh = ( directLight.visible && receiveShadow ) ? csmShadow() : 1.0; directLight.color *= mix(0.8, 1.0, wSh); /* (round 10: 0.62 -> 0.8, critic read tower shadows on the river as dark decal slabs) */",
                ) +
                    `
        // (round 7) sun glitter: sparse sub-pixel facets on a finer, faster chop catch the sun (a sparkling glint path
        // toward the sun instead of one smooth lobe); fades with distance into the broad specular sheen
        #if ( NUM_DIR_LIGHTS > 0 )
        {
          vec2 gp = vWPw.xz;
          vec2 gn = wn(gp / 2.3 + vec2(uWTime * 0.05, uWTime * 0.034)) + 0.8 * wn(vec2(-gp.y, gp.x) / 3.7 + vec2(-uWTime * 0.041, uWTime * 0.02));
          vec3 nG = normalize(wN + vec3(gn.x, 0.0, gn.y) * 0.22 * (1.0 - 0.6 * wSlick));
          vec3 nGv = normalize((viewMatrix * vec4(nG, 0.0)).xyz);
          vec3 Hh = normalize(directLight.direction + geometryViewDir);
          float gl = pow(clamp(dot(nGv, Hh), 0.0, 1.0), 700.0);
          float spark = smoothstep(0.62, 0.9, texture(tWNoise, gp / 5.0 + vec2(uWTime * 0.02, 0.0)).r);
          float gfade = 1.0 - smoothstep(900.0, 4000.0, wDist);
          reflectedLight.directSpecular += directLight.color * gl * spark * gfade * 14.0 * wSh;
        }
        #endif`,
            )
            .replace(
                "#include <lights_fragment_maps>",
                `#include <lights_fragment_maps>
        // (atmosphere r2) sky reflection: the env map's lowest ~6 deg hold a generic city band (for the towers' IBL);
        // open water at grazing angles must mirror the horizon SKY instead (critic: 'flat grey sheet, no fresnel sky
        // gradient'). Re-fetch the env with the reflection lifted above that band; the planar mirror adds the real
        // skyline on top. Grazing view -> brighter, paler horizon sky; looking down -> deep body colour + zenith blue.
        #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
        {
          vec3 rvW = transformDirectionByInverseViewMatrix(reflect(-geometryViewDir, normal), viewMatrix);
          rvW.y = abs(rvW.y) * 0.8 + 0.1;
          radiance = textureCubeUV(envMap, envMapRotation * normalize(rvW), material.roughness).rgb * envMapIntensity;
          radiance *= mix(0.3, 1.0, ambData.bounce.w); // (night) the night sky mirror stays dim: dark water with the city's light streaks (critic r2: rivers brighter than the city)
        }
        #endif
        if (uReflOn > 0.5 && vRefl.w > 0.0) {
          vec2 ruv = vRefl.xy / vRefl.w;
          // (round 4) ripple distortion that survives distance (sheared horizontally by the chop) + a vertical smear:
          // real river reflections are stretched / broken toward the viewer, never a crisp mirror
          vec2 d = vec2(wDisp.x * 0.7, wDisp.y * 1.6) * 0.22 / (1.0 + wDist * 0.00025);
          float spread = (0.004 + 0.034 * wR) * (1.0 - 0.5 * wSlick);
          float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          vec4 pr = vec4(0.0);
          for (int k = 0; k < 8; k++) {
            float o = (float(k) + jit) / 8.0 - 0.35;
            pr += texture(tRefl, ruv + d * (1.0 + 0.12 * float(k)) + vec2(o * spread * 0.25, o * spread));
          }
          pr /= 8.0;
          vec2 e = smoothstep(0.0, 0.03, ruv) * smoothstep(1.0, 0.97, ruv);
          // the mirror render has no aerial perspective: haze it toward the sky radiance with distance (round 5: faster,
          // so far reflections are soft ghosts, never a crisp second skyline)
          vec3 mir = mix(pr.rgb, radiance, 0.28 + 0.52 * smoothstep(200.0, 3500.0, wDist));
          // rough water (gusts / streaks) scatters the image: the mirror gives way to the blurred sky IBL
          float mw = mix(0.7, 0.9, wSlick) * mix(1.0, 0.5, smoothstep(0.12, 0.3, wR)) * (1.0 - 0.3 * wNearS);
          radiance = mix(radiance, mir, clamp(pr.a, 0.0, 1.0) * e.x * e.y * mw);
        }
        // a weaker sky mirror: the refs' rivers read as a deep grey-blue body, not a white sheet; wind rows catch a
        // little more sheen
        radiance *= (0.8 + 0.12 * wStreak); // (atmosphere r2) no far dimming: fresnel brightening toward the horizon
        // (atmosphere r1) critic: 'river reads flat'. Wind fields modulate the sky sheen at every distance: glassy slicks
        // mirror more of the (bright) sky, gust / ruffled patches scatter it into a duller, bluer grey -> visible large-
        // scale mottling and streaks like the refs' Hudson / East River, instead of one even grey-blue sheet
        radiance *= mix(0.82, 1.22, wSlick) * (1.0 + 0.18 * wStreak) * mix(1.0, 0.86, smoothstep(0.14, 0.3, wR));`,
            );
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
                skirt.position.set(
                    camera.position.x,
                    G.WATER_Y,
                    camera.position.z,
                );
                skirt.scale.set(
                    R,
                    Math.max(2, camera.position.y - G.WATER_Y + 1),
                    R,
                );
                skirt.updateMatrixWorld();
                if (mirror)
                    mat.userData.uniforms.uReflOn.value = mirror.render(
                        root(),
                        camera,
                        [mesh, skirt],
                    )
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
        if (cx * s.nx + cz * s.nz <= 0)
            I.push(v, v + 1, v + 2, v, v + 2, v + 3);
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
            .replace(
                "#include <common>",
                "#include <common>\nvarying vec2 vWetUv;",
            )
            .replace(
                "#include <uv_vertex>",
                "#include <uv_vertex>\nvWetUv = uv;",
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                "#include <common>\nuniform sampler2D tWetN; varying vec2 vWetUv;",
            )
            .replace(
                "#include <map_fragment>",
                `{
        float u = vWetUv.x, y = vWetUv.y;
        vec3 nz = texture(tWetN, vec2(u / 9.0, 0.37)).rgb, nz2 = texture(tWetN, vec2(u / 2.1, y * 0.4 + 0.1)).rgb;
        float top = 0.45 + 0.35 * nz.r + 0.15 * nz2.g;            // ragged high-water line
        float a = 1.0 - smoothstep(top - 0.12, top + 0.04, y);
        float algae = 1.0 - smoothstep(0.1, 0.35, y);              // green-black slime right at the water line
        vec3 c = mix(vec3(0.07, 0.065, 0.055), vec3(0.04, 0.06, 0.035), algae);
        c *= 0.8 + 0.4 * nz2.b;
        // streaks running down from the high-water line
        a = max(a, (1.0 - smoothstep(0.0, 0.9, y)) * smoothstep(0.62, 0.8, texture(tWetN, vec2(u / 0.9, 0.71)).r) * 0.6);
        diffuseColor = vec4(c, a * 0.88);
      }`,
            );
    };
    mat.customProgramCacheKey = () => "wet-band-v1";
    const m = new THREE.Mesh(g, mat);
    m.name = "wetBands";
    m.receiveShadow = true;
    m.renderOrder = 1;
    scene.add(m);
    return m;
}
