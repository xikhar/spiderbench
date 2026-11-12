// OWNER: street agent (r7). Contact ambient occlusion under vehicles: one instanced, soft-edged dark rounded-rect
// decal per rendered car (hi / low tiers), laid on the road just under the body. Critic (street r6): 'cars have weak
// contact shadows so they look pasted on'. Cheap: 1 draw call, no shadow pass, depth-tested, no depth write.
//   const ao = createContactAO(scene, max); per frame: ao.begin(); ao.push(x, z, ry, len, wid); ao.end();
import * as THREE from "three";

function aoTexture() {
    const W = 128,
        H = 64,
        cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d"),
        img = g.createImageData(W, H);
    const sm = (a, b, x) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };
    for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
            // normalised coords -1..1; rounded-rect signed distance (car footprint = inner 0.8 x 0.72)
            const u = ((i + 0.5) / W) * 2 - 1,
                v = ((j + 0.5) / H) * 2 - 1;
            const qx = Math.abs(u) - 0.66,
                qy = Math.abs(v) - 0.5,
                r = 0.14;
            const d =
                Math.hypot(Math.max(qx + r, 0), Math.max(qy + r, 0)) +
                Math.min(Math.max(qx + r, qy + r), 0) -
                r;
            // dense core under the chassis + a soft penumbra; slightly darker under the wheel lines (|u| ~ 0.55)
            let a =
                0.62 * (1 - sm(-0.18, 0.2, d)) +
                0.22 * (1 - sm(-0.05, 0.02, d));
            a +=
                0.12 *
                (1 - sm(0.0, 0.12, Math.abs(Math.abs(u) - 0.52))) *
                (1 - sm(-0.1, 0.05, d));
            const k = (j * W + i) * 4;
            img.data[k] = img.data[k + 1] = img.data[k + 2] = 0;
            img.data[k + 3] = Math.round(Math.min(0.9, a) * 255);
        }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export function createContactAO(scene, max = 1500) {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
        map: aoTexture(),
        transparent: true,
        depthWrite: false,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.name = "carContactAO";
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = -1;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    let n = 0;
    const e = mesh.instanceMatrix.array;
    return {
        mesh,
        begin() {
            n = 0;
        },
        push(x, z, ry, len, wid, y = 0.035) {
            if (n >= max) return;
            const o = 16 * n++,
                c = Math.cos(ry),
                s = Math.sin(ry),
                sx = len * 1.14,
                sz = wid * 1.32;
            e[o] = c * sx;
            e[o + 1] = 0;
            e[o + 2] = -s * sx;
            e[o + 3] = 0;
            e[o + 4] = 0;
            e[o + 5] = 1;
            e[o + 6] = 0;
            e[o + 7] = 0;
            e[o + 8] = s * sz;
            e[o + 9] = 0;
            e[o + 10] = c * sz;
            e[o + 11] = 0;
            e[o + 12] = x;
            e[o + 13] = y;
            e[o + 14] = z;
            e[o + 15] = 1;
        },
        end() {
            mesh.count = n;
            if (!n) return;
            const im = mesh.instanceMatrix;
            im.clearUpdateRanges();
            im.addUpdateRange(0, n * 16);
            im.needsUpdate = true;
        },
    };
}

// (daynight, lighting2 r4) headlight light pools on the road ahead of moving cars at night: one additive instanced decal
// (a soft cone-shaped gradient), drawn only while nightK > 0 (no draw call by day). Same push API as the contact AO.
//   const hl = createHeadlightPools(scene, max); per frame: hl.begin(); hl.push(x, z, ry, len); hl.end();
import { nightK, nightOnly } from "../render/daynight.js";
function beamTexture() {
    const W = 64,
        H = 128,
        cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d"),
        img = g.createImageData(W, H);
    for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
            const t = 1 - j / (H - 1),
                u = ((i + 0.5) / W) * 2 - 1; // t: 0 at the bumper .. 1 far end (flipY: row 0 = v 1 = far end)
            const half = 0.3 + 0.7 * t; // the cone widens away from the car
            const lat = Math.max(0, 1 - (Math.abs(u) / half) ** 2);
            const a = lat * Math.min(1, t * 6) * (1 - t) ** 1.6; // fades in at the bumper, falls off with distance
            const k = (j * W + i) * 4;
            img.data[k] = 255;
            img.data[k + 1] = 236;
            img.data[k + 2] = 200;
            img.data[k + 3] = Math.round(Math.min(1, a * 1.25) * 255);
        }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
export function createHeadlightPools(scene, max = 600) {
    const geo = new THREE.PlaneGeometry(1, 1)
        .rotateX(-Math.PI / 2)
        .rotateY(-Math.PI / 2); // texture v runs along local +x (car forward)
    const mat = new THREE.MeshBasicMaterial({
        map: beamTexture(),
        color: new THREE.Color(1, 0.9, 0.75).multiplyScalar(0.045),
        transparent: true, // x night exposure (~4.5x): a soft pool, not a white sheet
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.ZeroFactor,
        blendDstAlpha: THREE.OneFactor,
        depthWrite: false,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -5,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.name = "carHeadlightPools";
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 2;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.onBeforeRender = () => {
        mat.opacity = nightK.value;
    };
    scene.add(nightOnly(mesh));
    let n = 0;
    const e = mesh.instanceMatrix.array;
    return {
        mesh,
        begin() {
            n = 0;
        },
        push(x, z, ry, len, y = 0.05) {
            if (n >= max || nightK.value < 0.01) return;
            const L = 9,
                Wd = 3.8,
                c = Math.cos(ry),
                s = Math.sin(ry),
                off = len * 0.5 + L * 0.5 - 0.5;
            const o = 16 * n++;
            e[o] = c * L;
            e[o + 1] = 0;
            e[o + 2] = -s * L;
            e[o + 3] = 0;
            e[o + 4] = 0;
            e[o + 5] = 1;
            e[o + 6] = 0;
            e[o + 7] = 0;
            e[o + 8] = s * Wd;
            e[o + 9] = 0;
            e[o + 10] = c * Wd;
            e[o + 11] = 0;
            e[o + 12] = x + c * off;
            e[o + 13] = y;
            e[o + 14] = z - s * off;
            e[o + 15] = 1;
        },
        end() {
            mesh.count = n;
            if (!n) return;
            const im = mesh.instanceMatrix;
            im.clearUpdateRanges();
            im.addUpdateRange(0, n * 16);
            im.needsUpdate = true;
        },
    };
}
