// OWNER: foundation agent (city remake, round 3). River traffic: ferries, tour boats, barge + tug tows, work boats and
// small craft moving up and down the Hudson / East River channels and across the harbour, each trailing a foam wake
// (V-shaped Kelvin wake + prop wash) drawn as a transparent, depth-tested quad just above the water.
// Cost: one InstancedMesh per hull type (5 draw calls) + one instanced wake quad (1 draw call). No collision (boats are
// unreachable set dressing out on the water; the player never stands on them).
import * as THREE from "three";
import { G, onLand, shoreX, mulberry32 } from "./layout.js";
import { farShoreHeight } from "./farshore.js";
import { REFL_LAYER } from "./water.js";
import { nightK } from "../render/daynight.js";

const isWater = (x, z) => !onLand(x, z) && farShoreHeight(x, z) === null;

// channel centre-line of a river at z: walk away from Manhattan's seawall until the far bank, take the middle
function channel(side, z) {
    const [w, e] = shoreX(z);
    const x0 = side < 0 ? (w < e ? w : -700) : w < e ? e : 700;
    if (!isWater(x0 + side * 25, z)) return null;
    let x = x0 + side * 25;
    while (isWater(x + side * 10, z) && Math.abs(x - x0) < 2400) x += side * 10;
    const width = Math.abs(x - x0);
    if (width < 160) return null;
    return { c: (x0 + x) / 2, half: width / 2 };
}

// ---- hull kits: list of boxes [x0, y0, z0, x1, y1, z1, colour] in boat space (+z = bow), y = 0 at the waterline
const K = {
    ferry: {
        len: 62,
        beam: 15,
        speed: 7,
        parts: [
            [-7.5, -1.2, -31, 7.5, 2.4, 31, [0.78, 0.36, 0.12]],
            [-7.8, 2.4, -29, 7.8, 5.4, 29, [0.8, 0.8, 0.77]],
            [-6.6, 5.4, -24, 6.6, 8.0, 24, [0.74, 0.39, 0.15]],
            [-4.2, 8.0, -9, 4.2, 10.4, 9, [0.82, 0.82, 0.79]],
            [-7.9, 3.2, -28, 7.9, 4.3, 28, [0.13, 0.15, 0.17]],
            [-6.7, 6.1, -23, 6.7, 7.1, 23, [0.12, 0.14, 0.16]],
            [-0.6, 10.4, -1, 0.6, 14.5, 1, [0.2, 0.2, 0.2]],
        ],
    },
    tour: {
        len: 46,
        beam: 10,
        speed: 6,
        parts: [
            [-5, -1, -22, 5, 1.8, 20, [0.86, 0.86, 0.84]],
            [-4.6, -0.2, 20, 4.6, 1.8, 23, [0.86, 0.86, 0.84]],
            [-4.8, 1.8, -19, 4.8, 4.6, 15, [0.84, 0.84, 0.82]],
            [-4.9, 2.6, -18.5, 4.9, 3.8, 14.5, [0.12, 0.15, 0.2]],
            [-4.2, 4.6, -15, 4.2, 6.6, 8, [0.2, 0.3, 0.45]],
            [-1.8, 6.6, 0, 1.8, 8.4, 5, [0.88, 0.88, 0.86]],
        ],
    },
    barge: {
        len: 60,
        beam: 16,
        speed: 3,
        parts: [
            [-8, -1.6, -30, 8, 1.6, 30, [0.3, 0.19, 0.13]],
            [-7, 1.6, -27, 7, 2.2, 27, [0.24, 0.16, 0.11]],
            [-5.5, 1.6, -22, 5.5, 5.2, -2, [0.44, 0.41, 0.37]],
            [-5.5, 1.6, 2, 5.5, 4.4, 22, [0.36, 0.34, 0.3]],
            // the pushing tug at the stern
            [-4.2, -1.4, -44, 4.2, 1.8, -30, [0.12, 0.13, 0.14]],
            [-3.2, 1.8, -41, 3.2, 5.2, -33, [0.72, 0.2, 0.14]],
            [-2.6, 5.2, -39, 2.6, 8.8, -34, [0.8, 0.8, 0.76]],
            [-2.7, 7.4, -39.1, 2.7, 8.4, -33.9, [0.1, 0.12, 0.14]],
            [-0.8, 5.2, -43, 0.8, 11, -41.5, [0.14, 0.14, 0.14]],
        ],
    },
    work: {
        len: 26,
        beam: 8,
        speed: 5,
        parts: [
            [-4, -1.2, -13, 4, 1.8, 11, [0.14, 0.16, 0.2]],
            [-3.4, -0.4, 11, 3.4, 1.8, 13, [0.14, 0.16, 0.2]],
            [-3.2, 1.8, -4, 3.2, 5.4, 5, [0.82, 0.8, 0.74]],
            [-3.3, 3.8, -3.9, 3.3, 4.8, 4.9, [0.1, 0.12, 0.14]],
            [-0.5, 5.4, 0, 0.5, 8.5, 1, [0.25, 0.25, 0.25]],
            [-3.8, 1.8, -12, 3.8, 2.8, -6, [0.6, 0.45, 0.12]],
        ],
    },
    small: {
        len: 11,
        beam: 3.6,
        speed: 11,
        parts: [
            [-1.8, -0.5, -5.5, 1.8, 0.9, 3.5, [0.88, 0.88, 0.86]],
            [-1.2, -0.3, 3.5, 1.2, 0.9, 5.5, [0.88, 0.88, 0.86]],
            [-1.4, 0.9, -1.5, 1.4, 2.2, 1.5, [0.84, 0.84, 0.82]],
            [-1.45, 1.4, 0.2, 1.45, 2.0, 1.55, [0.12, 0.15, 0.2]],
            [-1.85, 0.2, -5.4, 1.85, 0.5, 3.4, [0.15, 0.25, 0.42]],
        ],
    },
};

function kitGeometry(parts) {
    const P = [],
        N = [],
        C = [],
        I = [];
    let n = 0;
    const F = [
        // +x, -x, +y, +z, -z (no bottom)
        [
            [1, 0, 0],
            [
                [1, 0, 1],
                [1, 0, 0],
                [1, 1, 0],
                [1, 1, 1],
            ],
        ],
        [
            [-1, 0, 0],
            [
                [0, 0, 0],
                [0, 0, 1],
                [0, 1, 1],
                [0, 1, 0],
            ],
        ],
        [
            [0, 1, 0],
            [
                [0, 1, 1],
                [1, 1, 1],
                [1, 1, 0],
                [0, 1, 0],
            ],
        ],
        [
            [0, 0, 1],
            [
                [0, 0, 1],
                [1, 0, 1],
                [1, 1, 1],
                [0, 1, 1],
            ],
        ],
        [
            [0, 0, -1],
            [
                [1, 0, 0],
                [0, 0, 0],
                [0, 1, 0],
                [1, 1, 0],
            ],
        ],
    ];
    for (const [x0, y0, z0, x1, y1, z1, col] of parts) {
        for (const [nrm, q] of F) {
            for (const [a, b, c] of q) {
                P.push(a ? x1 : x0, b ? y1 : y0, c ? z1 : z0);
                N.push(...nrm);
                C.push(...col);
            }
            I.push(n, n + 1, n + 2, n, n + 2, n + 3);
            n += 4;
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    g.setIndex(I);
    return g;
}

// wake texture: bow wave + Kelvin V arms (~19.5 deg) + turbulent prop-wash trail, alpha only (white foam)
function wakeTexture() {
    const W = 128,
        H = 512,
        cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d"),
        img = g.createImageData(W, H),
        rnd = mulberry32(77);
    const noise = new Float32Array(W * H);
    for (let i = 0; i < noise.length; i++) noise[i] = rnd();
    const sm = (a, b, x) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };
    for (let y = 0; y < H; y++) {
        const v = y / H; // 0 = bow, 1 = far behind
        for (let x = 0; x < W; x++) {
            const u = (x / (W - 1)) * 2 - 1,
                au = Math.abs(u);
            const arm = v * 0.98; // V arms spread linearly from the bow
            let a =
                Math.exp(-Math.pow((au - arm) / (0.06 + v * 0.08), 2)) *
                (1 - v) *
                0.85; // (r14: broader arms, they vanished sub-pixel from the air)
            a +=
                Math.exp(-Math.pow(u / (0.11 + v * 0.22), 2)) *
                Math.pow(1 - v, 1.3) *
                1.0 *
                sm(0.0, 0.05, v); // prop wash (r14: wider, longer)
            a *=
                0.55 +
                0.9 *
                    noise[y * W + x] *
                    noise[((y * 7) % H) * W + ((x * 3) % W)];
            a *= sm(0, 0.02, v) * (au < arm + 0.1 ? 1 : 0.3);
            const k = (y * W + x) * 4;
            img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
            img.data[k + 3] = Math.max(0, Math.min(255, a * 255));
        }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}

export function buildBoats({ scene, docks = [], solids = null }) {
    const rnd = mulberry32(3131);
    const boats = [];
    // lanes: river channels (sampled every 40 m) + harbour crossings
    const lanes = [];
    for (const side of [-1, 1]) {
        const pts = [];
        for (let z = G.Z_MIN - 1200; z <= G.Z_MAX + 600; z += 40) {
            const ch = channel(side, z);
            if (ch) pts.push({ z, ...ch });
        }
        // keep the longest continuous run (breaks at Roosevelt Island / narrows)
        let best = [],
            cur = [];
        for (const p of pts) {
            if (cur.length && p.z - cur[cur.length - 1].z > 45) {
                if (cur.length > best.length) best = cur;
                cur = [];
            }
            cur.push(p);
        }
        if (cur.length > best.length) best = cur;
        if (best.length > 10) lanes.push({ side, pts: best });
    }
    const laneAt = (L, z) => {
        const i = Math.max(
            0,
            Math.min(L.pts.length - 2, Math.floor((z - L.pts[0].z) / 40)),
        );
        const a = L.pts[i],
            b = L.pts[i + 1];
        const f = Math.min(1, Math.max(0, (z - a.z) / 40));
        return {
            c: a.c + (b.c - a.c) * f,
            half: a.half + (b.half - a.half) * f,
        };
    };
    const mix = {
        hudson: [
            "ferry",
            "tour",
            "barge",
            "work",
            "small",
            "small",
            "tour",
            "barge",
            "small",
            "work",
            "ferry",
            "small",
        ],
        east: [
            "tour",
            "barge",
            "work",
            "small",
            "small",
            "ferry",
            "small",
            "barge",
            "work",
        ],
    };
    for (const L of lanes) {
        const types = (L.side < 0 ? mix.hudson : mix.east).flatMap((t) => [
            t,
            t === "ferry" ? "small" : t,
            ...(t === "small" || t === "work" || t === "tour" ? [t] : []),
        ]); // (round 6) twice the river traffic; (r14) + more small craft / work boats / tour boats (critic: 'boats are sparse dots')
        const z0 = L.pts[0].z,
            z1 = L.pts[L.pts.length - 1].z;
        types.forEach((type, i) => {
            const dir = rnd() < 0.5 ? 1 : -1;
            boats.push({
                type,
                lane: L,
                laneOff: (rnd() * 0.9 - 0.45) * (dir > 0 ? 1 : -1),
                z: z0 + (z1 - z0) * ((i + rnd() * 0.7) / types.length),
                dir,
                x: 0,
                h: 0,
            });
        });
    }
    // harbour: south of the Battery, slow crossings between the tip and the far side (Staten-Island-ferry like)
    for (let i = 0; i < 9; i++) {
        const type = [
            "ferry",
            "barge",
            "small",
            "work",
            "tour",
            "ferry",
            "small",
            "work",
            "barge",
        ][i];
        const x = -900 + rnd() * 1800,
            z = G.Z_MAX + 500 + rnd() * 1700;
        if (!isWater(x, z)) continue;
        boats.push({
            type,
            lane: null,
            x,
            z,
            h: rnd() * Math.PI * 2,
            dir: 1,
            turn: (rnd() - 0.5) * 0.004,
        });
    }

    // (round 12) moored vessels alongside the piers (critic: 'piers are flat slabs with no boats', 'boats are scale-less
    // specks'): tugs / work boats / tour boats / barges tied up along a pier's long side, bow toward the pier head. Static
    // (no bob), axis-aligned (heading +-90 deg), so each hull part gets an exact collision box. Own rng (traffic unchanged).
    {
        const drnd = mulberry32(6161),
            placed = [];
        const DOCK_MIX = [
            "work",
            "tour",
            "barge",
            "small",
            "work",
            "tour",
            "small",
            "barge",
            "ferry",
            "small",
        ];
        const clearOf = (x0, z0, x1, z1) =>
            docks.every(
                (d) =>
                    x1 < d.x0 - 0.5 ||
                    x0 > d.x1 + 0.5 ||
                    z1 < d.z0 - 0.5 ||
                    z0 > d.z1 + 0.5,
            ) &&
            placed.every(
                (b) =>
                    x1 < b[0] - 2 ||
                    x0 > b[2] + 2 ||
                    z1 < b[1] - 2 ||
                    z0 > b[3] + 2,
            );
        for (const d of docks) {
            if (drnd() < 0.3) continue;
            const pl = d.x1 - d.x0;
            if (pl < 40) continue;
            const nB = pl > 150 && drnd() < 0.5 ? 2 : 1;
            for (let j = 0; j < nB; j++) {
                const type = DOCK_MIX[Math.floor(drnd() * DOCK_MIX.length)],
                    k = K[type];
                if (k.len + 10 > pl) continue;
                const sz = drnd() < 0.5 ? -1 : 1,
                    zc =
                        sz < 0
                            ? d.z0 - k.beam / 2 - 1.3
                            : d.z1 + k.beam / 2 + 1.3;
                // along the pier: toward its water end (head = the end farther from land)
                const headW =
                    isWater(d.x0 - 8, (d.z0 + d.z1) / 2) &&
                    !isWater(d.x1 + 8, (d.z0 + d.z1) / 2); // head at x0 (pier grows toward -x)
                const u =
                        6 + k.len / 2 + drnd() * Math.max(0, pl * 0.55 - k.len),
                    xc = headW ? d.x0 + u : d.x1 - u;
                const x0 = xc - k.len / 2 - 5,
                    x1 = xc + k.len / 2 + 5,
                    z0 = zc - k.beam / 2,
                    z1 = zc + k.beam / 2;
                if (
                    ![
                        [x0, z0],
                        [x1, z0],
                        [x0, z1],
                        [x1, z1],
                        [xc, zc],
                    ].every(([x, z]) => isWater(x, z)) ||
                    !clearOf(x0, z0, x1, z1)
                )
                    continue;
                placed.push([x0, z0, x1, z1]);
                const h = headW ? -Math.PI / 2 : Math.PI / 2; // bow toward the pier head
                boats.push({
                    type,
                    lane: null,
                    docked: true,
                    x: xc,
                    z: zc,
                    h,
                    dir: 1,
                    turn: 0,
                });
                if (solids)
                    for (const [a0, y0, b0, a1, y1, b1] of k.parts) {
                        // boat space (+z bow) -> world: heading +-90 deg maps boat z onto world +-x, boat x onto world -+z
                        const s = Math.sin(h); // +1 (bow +x) or -1 (bow -x)
                        const wx0 = xc + Math.min(s * b0, s * b1),
                            wx1 = xc + Math.max(s * b0, s * b1);
                        const za = zc + Math.min(-s * a0, -s * a1),
                            zb = zc + Math.max(-s * a0, -s * a1);
                        solids.box(
                            wx0,
                            G.WATER_Y + y0,
                            za,
                            wx1,
                            G.WATER_Y + y1,
                            zb,
                            y1 > 1.5 ? "roof" : "pier",
                        );
                    }
            }
        }
    }

    // ---- meshes
    const hullMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.6,
        metalness: 0.05,
    });
    const meshes = {};
    for (const type of Object.keys(K)) {
        const list = boats.filter((b) => b.type === type);
        if (!list.length) continue;
        const m = new THREE.InstancedMesh(
            kitGeometry(K[type].parts),
            hullMat,
            list.length,
        );
        m.name = "boats-" + type;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        m.layers.enable(REFL_LAYER);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        list.forEach((b, i) => {
            b.mesh = m;
            b.idx = i;
        });
        scene.add(m);
        meshes[type] = m;
    }
    const wakeGeo = new THREE.PlaneGeometry(1, 1)
        .rotateX(Math.PI / 2)
        .translate(0, 0, -0.5); // extends backwards (-z), bow (tex top) at z = 0
    // (round 11) wakes were oversized and glowing white (unlit basic material): dimmer foam value + lower opacity
    boats.forEach((b, i) => {
        b.wi = i;
    });
    const wakeMat = new THREE.MeshBasicMaterial({
        map: wakeTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.8,
        color: 0xc2c9ca,
        fog: true,
        side: THREE.DoubleSide,
    }); // (round 12: opacity 0.5 -> 0.7)
    // (night r11) unlit foam glowed as a white smear on the dark river at night (x4.5 night exposure): moonlit-foam level
    wakeMat.onBeforeCompile = (sh) => {
        sh.uniforms.uNightK = nightK;
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                "#include <common>\nuniform float uNightK;",
            )
            .replace(
                "#include <color_fragment>",
                "#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.025, uNightK);",
            );
    };
    wakeMat.customProgramCacheKey = () => "boat-wake-night-v1";
    const wakes = new THREE.InstancedMesh(wakeGeo, wakeMat, boats.length);
    wakes.name = "boatWakes";
    wakes.frustumCulled = false;
    wakes.renderOrder = 2;
    wakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(wakes);

    const m4 = new THREE.Matrix4(),
        q = new THREE.Quaternion(),
        s = new THREE.Vector3(1, 1, 1),
        p = new THREE.Vector3(),
        up = new THREE.Vector3(0, 1, 0);
    const place = (b, t) => {
        const k = K[b.type];
        const bob = b.docked ? 0 : Math.sin(t * 0.9 + b.idx * 1.7) * 0.12;
        q.setFromAxisAngle(up, b.h);
        p.set(b.x, G.WATER_Y + bob, b.z);
        b.mesh.setMatrixAt(b.idx, m4.compose(p, q, s.set(1, 1, 1)));
        // wake: starts at the bow, length ~ 5 boat lengths (shorter for the slow tows), width grows with the V
        // (round 12) critic: 'boats are tiny specks with no wakes' -> back up to ~4 / 3 boat lengths (round 11 halved them)
        const wl = b.docked ? 1e-4 : k.len * (k.speed > 6 ? 4.2 : 3.0),
            ww = wl * 0.7;
        p.set(
            b.x + Math.sin(b.h) * k.len * 0.5,
            G.WATER_Y + 0.06,
            b.z + Math.cos(b.h) * k.len * 0.5,
        );
        wakes.setMatrixAt(b.wi, m4.compose(p, q, s.set(ww, 1, wl)));
    };
    let t = 0;
    const step = (dt) => {
        t += dt;
        for (const b of boats) {
            const k = K[b.type];
            if (b.docked) {
                if (!b.placed) {
                    place(b, t);
                    b.placed = true;
                }
                continue;
            }
            if (b.lane) {
                b.z += b.dir * k.speed * dt;
                const L = b.lane,
                    zA = L.pts[0].z + 60,
                    zB = L.pts[L.pts.length - 1].z - 60;
                if (b.z > zB) {
                    b.z = zB;
                    b.dir = -1;
                    b.laneOff = -b.laneOff;
                } else if (b.z < zA) {
                    b.z = zA;
                    b.dir = 1;
                    b.laneOff = -b.laneOff;
                }
                const a = laneAt(L, b.z),
                    a2 = laneAt(L, b.z + b.dir * 40);
                b.x =
                    a.c +
                    b.laneOff * Math.min(a.half - k.beam * 2, a.half * 0.8);
                const x2 =
                    a2.c +
                    b.laneOff * Math.min(a2.half - k.beam * 2, a2.half * 0.8);
                b.h = Math.atan2(x2 - b.x, b.dir * 40);
            } else {
                b.h += b.turn * dt * 60;
                const nx = b.x + Math.sin(b.h) * k.speed * dt,
                    nz = b.z + Math.cos(b.h) * k.speed * dt;
                if (
                    isWater(nx + Math.sin(b.h) * 120, nz + Math.cos(b.h) * 120)
                ) {
                    b.x = nx;
                    b.z = nz;
                } else b.h += 0.02;
            }
            place(b, t);
        }
        for (const m of Object.values(meshes))
            m.instanceMatrix.needsUpdate = true;
        wakes.instanceMatrix.needsUpdate = true;
    };
    step(0);
    return {
        boats,
        count: boats.length,
        update: (dt) => step(Math.min(dt, 0.1)),
    };
}
