/**
 * Constructs the hero building and its reflection rendering support.
 *
 * @module world-hero
 * @version 1.0.0
 * @file src/world/hero.ts
 * @since 0.0.1
 * @description Creates the featured high-rise structure, its collision/zip data, and reflection update logic for the scene.
 */
import * as THREE from "three";
import { FacadeBuilder, STYLE, LAYER } from "./facade.ts";

export function buildHero({
    scene,
    rect,
    facadeMat,
    renderer,
    height = 96,
    solids = null,
    zips = null,
}: any) {
    const X = rect.x0;
    const z0 = rect.z0 + 0.5,
        z1 = rect.z1 - 0.5;
    const H = height;
    const group = new THREE.Group();
    group.name = "hero";
    scene.add(group);

    const B = new FacadeBuilder();
    const P = {
        floorH: 4.0,
        bayW: 1.55,
        winW: 0.97,
        winH: 0.74,
        layer: LAYER.METAL,
        base: LAYER.GRANITE,
        seed: 42,
        margin: 0,
        depth: 0.04,
        glass: 1,
        tint: [1, 1, 1],
        topY: H,
    };
    B.box(
        X,
        0,
        rect.z0,
        rect.x1,
        H,
        rect.z1,
        P,
        {
            nx: { style: STYLE.CURTAIN, gH: 5.5 },
            px: { style: STYLE.CURTAIN, gH: 5.5 },
            nz: { style: STYLE.CURTAIN, gH: 5.5 },
            pz: { style: STYLE.CURTAIN, gH: 5.5 },
        },
        true,
        false,
        { ...P, layer: LAYER.ROOF },
    );
    const body = new THREE.Mesh(B.build(), facadeMat);
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    const F = new FacadeBuilder();
    const stone = {
        style: STYLE.BLANK,
        layer: LAYER.CONCRETE,
        tint: [1.12, 1.1, 1.05],
        seed: 7,
    };
    const metal = {
        style: STYLE.BLANK,
        layer: LAYER.METAL,
        tint: [1.6, 1.65, 1.7],
        seed: 7,
    };
    const fins: number[] = [];
    const pitch = 3.6;
    const n = Math.floor((z1 - z0) / pitch);
    const zs = (z1 - z0 - n * pitch) / 2 + z0;
    for (let i = 0; i <= n; i++) {
        const z = zs + i * pitch;
        F.box(
            X - 0.45,
            0,
            z - 0.3,
            X,
            H + 1.2,
            z + 0.3,
            stone,
            {},
            true,
            false,
        );
        fins.push(z);
    }
    for (let y = 5.5; y < H; y += 4.0)
        F.box(X - 0.12, y - 0.07, z0, X, y + 0.07, z1, metal, {}, true, true);
    F.box(
        X - 0.7,
        H - 1.0,
        rect.z0,
        X,
        H + 1.6,
        rect.z1,
        stone,
        {},
        true,
        true,
    );
    F.box(X - 0.7, 5.2, rect.z0, X, 6.0, rect.z1, stone, {}, true, true);
    if (solids) {
        solids.box(X, 0, rect.z0, rect.x1, H, rect.z1, "hero");
        for (const z of fins)
            solids.box(X - 0.45, 0, z - 0.3, X, H + 1.2, z + 0.3, "hero");
        for (let y = 5.5; y < H; y += 4.0)
            solids.box(X - 0.12, y - 0.07, z0, X, y + 0.07, z1, "ledge");
        solids.box(X - 0.7, H - 1.0, rect.z0, X, H + 1.6, rect.z1, "cornice");
        solids.box(X - 0.7, 5.2, rect.z0, X, 6.0, rect.z1, "ledge");
        solids.box(X - 0.02, 6.0, z0, X, H, z1, "glass");
    }
    if (zips) {
        zips.edge(
            X - 0.35,
            rect.z0,
            X - 0.35,
            rect.z1,
            H + 1.6,
            -1,
            0,
            "roofEdge",
            6,
        );
        zips.edge(rect.x1 - 0.12, rect.z0, rect.x1 - 0.12, rect.z1, H, 1, 0);
        zips.edge(X, rect.z0 + 0.12, rect.x1, rect.z0 + 0.12, H, 0, -1);
        zips.edge(X, rect.z1 - 0.12, rect.x1, rect.z1 - 0.12, H, 0, 1);
        zips.edge(X - 0.35, rect.z0, X - 0.35, rect.z1, 6.0, -1, 0, "ledge", 8);
        for (const [x, z, nx, nz] of [
            [rect.x1 - 0.15, rect.z0 + 0.15, 1, -1],
            [rect.x1 - 0.15, rect.z1 - 0.15, 1, 1],
        ])
            zips.add(
                x,
                H,
                z,
                nx * Math.SQRT1_2,
                0,
                nz * Math.SQRT1_2,
                "roofCorner",
            );
        for (const [z, nz] of [
            [rect.z0 + 0.15, -1],
            [rect.z1 - 0.15, 1],
        ])
            zips.add(
                X - 0.55,
                H + 1.6,
                z,
                -Math.SQRT1_2,
                0,
                nz * Math.SQRT1_2,
                "roofCorner",
            );
    }
    const finMesh = new THREE.Mesh(F.build(), facadeMat);
    finMesh.castShadow = finMesh.receiveShadow = true;
    group.add(finMesh);

    const size = new THREE.Vector2();
    renderer.getDrawingBufferSize(size);
    const rt = new THREE.WebGLRenderTarget(
        Math.max(256, size.x >> 1),
        Math.max(256, size.y >> 1),
        { type: THREE.HalfFloatType, samples: 2 },
    );
    rt.texture.generateMipmaps = true;
    rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
    const texel = new THREE.Vector2(1 / rt.width, 1 / rt.height);
    const texMat = new THREE.Matrix4();
    const uni = {
        tRefl: { value: rt.texture },
        uTexMat: { value: texMat },
        uReflOn: { value: 0 },
        uTexel: { value: texel },
    };
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x2a3540,
        roughness: 0.03,
        metalness: 0,
    }) as any;
    glassMat.onBeforeCompile = (sh: any) => {
        Object.assign(sh.uniforms, uni);
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nuniform mat4 uTexMat; varying vec4 vRefl;",
            )
            .replace(
                "#include <fog_vertex>",
                "#include <fog_vertex>\nvRefl = uTexMat * (modelMatrix * vec4(transformed, 1.0));",
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                "#include <common>\nuniform sampler2D tRefl; uniform float uReflOn; uniform vec2 uTexel; varying vec4 vRefl;",
            )
            .replace(
                "#include <lights_physical_fragment>",
                "#include <lights_physical_fragment>\nmaterial.specularColor = vec3(0.6);",
            )
            .replace(
                "#include <lights_fragment_maps>",
                `#include <lights_fragment_maps>
        if (uReflOn > 0.5) { vec2 ruv = vRefl.xy / vRefl.w; vec2 o1 = uTexel * vec2(0.75, 0.35), o2 = uTexel * vec2(-0.35, 0.75); vec4 pr = 0.25 * (texture(tRefl, ruv + o1, 0.6) + texture(tRefl, ruv - o1, 0.6) + texture(tRefl, ruv + o2, 0.6) + texture(tRefl, ruv - o2, 0.6)); vec2 e = smoothstep(0.0, 0.04, ruv) * smoothstep(1.0, 0.96, ruv);
          vec3 mirrored = mix(pr.rgb, radiance, 0.25);
          radiance = mix(radiance, mirrored, 0.75 * clamp(pr.a, 0.0, 1.0) * e.x * e.y * step(0.0, vRefl.w)); }`,
            );
    };
    glassMat.customProgramCacheKey = () => "city-hero-glass";
    const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(z1 - z0, H - 6.0),
        glassMat,
    );
    glass.position.set(X - 0.02, 6.0 + (H - 6.0) / 2, (z0 + z1) / 2);
    glass.rotation.y = -Math.PI / 2;
    glass.receiveShadow = true;
    group.add(glass);

    const vcam = new THREE.PerspectiveCamera();
    const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), X - 0.05);
    const _p = new THREE.Vector3(),
        _t = new THREE.Vector3(),
        _d = new THREE.Vector3(),
        _c = new THREE.Color();
    const _box = new THREE.Box3(),
        _fr = new THREE.Frustum(),
        _pm = new THREE.Matrix4();
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
    function rootOf(o: THREE.Object3D): THREE.Object3D {
        while (o.parent) o = o.parent;
        return o;
    }
    function renderReflection(camera: THREE.Camera) {
        camera.updateMatrixWorld();
        _p.setFromMatrixPosition(camera.matrixWorld);
        const dist = Math.hypot(
            _p.x - X,
            _p.y - glass.position.y,
            Math.max(0, Math.abs(_p.z - glass.position.z) - (z1 - z0) / 2),
        );
        if (_p.x >= X - 0.05 || dist > 220) {
            uni.uReflOn.value = 0;
            return;
        }
        glass.updateMatrixWorld();
        if (!(glass.geometry as any).boundingBox)
            glass.geometry.computeBoundingBox();
        _box.copy((glass.geometry as any).boundingBox).applyMatrix4(
            glass.matrixWorld,
        );
        _pm.multiplyMatrices(
            (camera as any).projectionMatrix,
            camera.matrixWorldInverse,
        );
        _fr.setFromProjectionMatrix(
            _pm,
            (camera as any).coordinateSystem,
            (camera as any).reversedDepth,
        );
        if (!_fr.intersectsBox(_box)) {
            uni.uReflOn.value = 0;
            return;
        }
        camera.getWorldDirection(_d);
        _t.copy(_p).add(_d);
        vcam.position.set(2 * X - _p.x, _p.y, _p.z);
        vcam.up.set(0, 1, 0).applyQuaternion((camera as any).quaternion);
        vcam.up.x = -vcam.up.x;
        vcam.lookAt(2 * X - _t.x, _t.y, _t.z);
        vcam.projectionMatrix.copy((camera as any).projectionMatrix);
        (vcam as any).projectionMatrixInverse.copy(
            (camera as any).projectionMatrixInverse,
        );
        vcam.updateMatrixWorld();
        texMat
            .copy(bias)
            .multiply(vcam.projectionMatrix)
            .multiply(vcam.matrixWorldInverse);
        body.visible = false;
        glass.visible = false;
        const prevRT = renderer.getRenderTarget();
        const prevAlpha = renderer.getClearAlpha();
        renderer.getClearColor(_c);
        const prevShadow = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;
        const prevShadowOn = renderer.shadowMap.enabled;
        renderer.shadowMap.enabled = false;
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(rt);
        renderer.clear();
        const prevClip = renderer.clippingPlanes;
        renderer.clippingPlanes = [clipPlane];
        renderer.render(scene.parent ? rootOf(scene) : scene, vcam);
        renderer.clippingPlanes = prevClip;
        renderer.setRenderTarget(prevRT);
        renderer.setClearColor(_c, prevAlpha);
        renderer.shadowMap.autoUpdate = prevShadow;
        renderer.shadowMap.enabled = prevShadowOn;
        body.visible = true;
        glass.visible = true;
        uni.uReflOn.value = 1;
    }
    const anchors = fins.map((z) => ({
        point: new THREE.Vector3(X - 0.45, 40, z),
        normal: new THREE.Vector3(-1, 0, 0),
    }));
    return {
        group,
        box: { min: [X - 0.45, 0, rect.z0], max: [rect.x1, H + 1.6, rect.z1] },
        footprint: {
            x0: X,
            z0: rect.z0,
            x1: rect.x1,
            z1: rect.z1,
            h: H,
            kind: "hero",
        },
        fins,
        anchors,
        X,
        H,
        renderReflection,
    };
}
