// OWNER: city agent. Landmark buildings of the island (all procedural, emitted through the same facade / collision /
// zip-point machinery as the generic buildings, so C2/C4 hold):
//   Empire-State-like stepped art-deco tower + mast (5th Av & 34th), Chrysler-like crown (Lexington & 42nd),
//   Grand-Central-like terminal standing across Park Av (closed segment, see layout.CLOSED_AV) with a MetLife-like slab
//   behind it, Billionaires'-Row slender towers on 57th (432-Park-like, Central-Park-Tower-like, One57-like),
//   One-WTC-like tapering tower + spire (Financial District), Times-Square-like bow-tie plaza on 6th/7th Av with
//   billboard-clad towers and LED screens.
// landmarkReserves() -> reserve specs for generateBuildings (lots under them are trimmed; `arch` / `shape` build them)
// buildStandalone({gen, facadeMat}) -> Grand Central + Times-Square screens (geometry not tied to one block lot)
import * as THREE from "three";
import { STYLE, LAYER } from "./facade.js";
import { G } from "./layout.js";
import { heroTowerReserves } from "./skyline.js"; // skyline agent: ESB / Chrysler / 432 / CPT / One57 / One WTC
import { buildGrandCentral } from "./grandcentral.js";

const snap = (A, y) =>
    A.gH + Math.max(1, Math.round((y - A.gH) / A.floorH)) * A.floorH;
const inset = (m, a, b = a, c = a, d = a) => ({
    x0: m.x0 + a,
    x1: m.x1 - b,
    z0: m.z0 + c,
    z1: m.z1 - d,
});
const OUT = { nx: [-1, 0], px: [1, 0], nz: [0, -1], pz: [0, 1] };

// facade box into the tile (full + far LOD) with its collision box and roof zip points
export function lmBox(
    t,
    S,
    Z,
    x0,
    y0,
    z0,
    x1,
    y1,
    z1,
    P,
    {
        style = STYLE.BLANK,
        kind = "wall",
        zip = true,
        roofP = null,
        lod = true,
    } = {},
) {
    const f = { style, gH: -0.01 };
    const faces = { px: f, nx: f, pz: f, nz: f };
    t.fac.box(
        x0,
        y0,
        z0,
        x1,
        y1,
        z1,
        { ...P, topY: y1, baseY: y0 },
        faces,
        true,
        false,
        roofP,
    );
    if (lod)
        t.lod.box(
            x0,
            y0,
            z0,
            x1,
            y1,
            z1,
            { ...P, topY: y1, baseY: y0 },
            faces,
            true,
            false,
            roofP,
        );
    S.box(x0, y0, z0, x1, y1, z1, kind);
    if (zip) {
        for (const [cx, cz, nx, nz] of [
            [x0, z0, -1, -1],
            [x1, z0, 1, -1],
            [x0, z1, -1, 1],
            [x1, z1, 1, 1],
        ])
            Z.add(
                cx - nx * 0.15,
                y1,
                cz - nz * 0.15,
                nx * Math.SQRT1_2,
                0,
                nz * Math.SQRT1_2,
                "roofCorner",
            );
        Z.edge(x0 + 0.12, z0, x0 + 0.12, z1, y1, -1, 0);
        Z.edge(x1 - 0.12, z0, x1 - 0.12, z1, y1, 1, 0);
        Z.edge(x0, z0 + 0.12, x1, z0 + 0.12, y1, 0, -1);
        Z.edge(x0, z1 - 0.12, x1, z1 - 0.12, y1, 0, 1);
    }
}
// round tier / mast: facade prism (full + LOD) + collision frustum + top zip
export function lmCyl(
    t,
    S,
    Z,
    cx,
    cz,
    r,
    y0,
    y1,
    P,
    { n = 16, r1 = r, style = STYLE.BLANK, kind = "spire", zipTop = true } = {},
) {
    t.fac.cyl(
        cx,
        cz,
        r,
        y0,
        y1,
        n,
        { ...P, topY: y1, baseY: y0 },
        style,
        true,
        r1,
    );
    t.lod.cyl(
        cx,
        cz,
        r,
        y0,
        y1,
        Math.max(6, n >> 1),
        { ...P, topY: y1, baseY: y0 },
        style,
        true,
        r1,
    );
    const k = (1 + Math.cos(Math.PI / n)) / 2;
    S.cyl(cx, cz, y0, y1, r * k, r1 * k, kind);
    if (zipTop) Z.add(cx, y1, cz, 0, 1, 0, "antenna");
}

const METAL = (tint = [2.4, 2.45, 2.5]) => ({
    floorH: 3.0,
    bayW: 1.2,
    winW: 0.5,
    winH: 0.5,
    layer: LAYER.METAL,
    base: LAYER.METAL,
    seed: 5,
    margin: 0,
    depth: 0.05,
    tint,
});

export function landmarkReserves() {
    const R = [];
    R.push(...heroTowerReserves()); // skyline agent: hero towers moved to skyline.js
    // Grand Central (standalone, built across the closed Park Av segment): clear the generic lots under it
    R.push({ name: "gcW", x0: 388, x1: 420, z0: -160, z1: -80, custom: true });
    R.push({ name: "gcE", x0: 440, x1: 472, z0: -160, z1: -80, custom: true });
    // ---------------------------------------------------------------- MetLife-like slab straddling Park Av behind Grand Central
    // (built by grandcentral.js over the avenue; its two legs stand on these lots)
    R.push({
        name: "metlifeW",
        x0: 384,
        x1: 414,
        z0: -240,
        z1: -160,
        custom: true,
    });
    R.push({
        name: "metlifeE",
        x0: 446,
        x1: 476,
        z0: -240,
        z1: -160,
        custom: true,
    });
    R.push({
        name: "gcPodium",
        x0: 446,
        x1: 496,
        z0: -76,
        z1: -4,
        custom: true,
    }); // street agent r2: low glass podium + roof garden (grandcentral.js)
    // (street r11) Park Av forecourt south of 42nd St, west side: the Park Av frontage lot is trimmed back 12 m so the
    // terminal's full frontage (pavilions included) reads down the avenue like ref 04; the strip is open paving dressed
    // by props.js (GC_FORECOURT). The trimmed building keeps a real street facade on its new Park Av face.
    R.push({
        name: "gcForecourtW",
        x0: 402,
        x1: 420,
        z0: -76,
        z1: -4,
        custom: true,
        plaza: true,
        trimFace: "street",
    });
    // ---------------------------------------------------------------- Times Square (6th/7th Av x=0, 42nd..50th)
    // open plaza strips along both sides of the avenue (nothing built: the block's paving shows) + billboard towers
    for (const [z0, z1] of [
        [-240, -160],
        [-160, -80],
    ]) {
        R.push({
            name: "tsPlazaW",
            x0: -34,
            x1: -10,
            z0,
            z1,
            custom: true,
            plaza: true,
        });
        R.push({
            name: "tsPlazaE",
            x0: 10,
            x1: 34,
            z0,
            z1,
            custom: true,
            plaza: true,
        });
        for (const [x0, x1, face, s] of [
            [-78, -34, "px", 1],
            [34, 80, "nx", 2],
        ]) {
            R.push({
                name: "tsTower",
                x0,
                x1,
                z0,
                z1,
                seed: 700 + s + z0,
                sides: { [face]: "street" },
                arch: (r) => ({
                    type: "postwar",
                    style: r() < 0.5 ? STYLE.RIBBON : STYLE.CURTAIN,
                    layer: r() < 0.5 ? LAYER.CONCRETE : LAYER.METAL,
                    base: LAYER.GRANITE,
                    floorH: 3.8,
                    bayW: 1.6,
                    winW: 0.9,
                    winH: 0.5,
                    gH: 7,
                    height: 130 + r() * 110,
                    depth: 0.12,
                    margin: 0.4,
                    tint: [0.95, 0.95, 0.95],
                    cornice: false,
                    shape: (lot, A, P, r2, H) => {
                        // tall screen-clad podium (the billboard wall), tower set back above it
                        const ph = snap(A, 42 + r2() * 18);
                        const pp = {
                            ...P,
                            style: STYLE.PUNCHED,
                            layer: LAYER.CONCRETE,
                            winW: 0.6,
                            winH: 0.55,
                        };
                        const k = (sd) =>
                            sd === face
                                ? 5
                                : lot.sides[sd] === "street"
                                  ? 3
                                  : 1.5;
                        return [
                            {
                                x0: lot.x0,
                                x1: lot.x1,
                                z0: lot.z0,
                                z1: lot.z1,
                                y0: 0,
                                y1: ph,
                                p: pp,
                                parapet: 1.1,
                                roof: true,
                            },
                            {
                                ...inset(
                                    lot,
                                    k("nx"),
                                    k("px"),
                                    k("nz"),
                                    k("pz"),
                                ),
                                y0: ph,
                                y1: H,
                                p: P,
                                parapet: 1.2,
                            },
                        ];
                    },
                }),
                billboards: face,
            });
        }
    }
    return R;
}
export const PLAZAS = []; // filled by landmarkReserves consumers: [{x0,z0,x1,z1,kind}]

// --------------------------------------------------------------------------------------------- ad atlas (LED screens)
export function makeAdAtlas() {
    const N = 4,
        S = 256,
        cv = document.createElement("canvas");
    cv.width = cv.height = N * S;
    const g = cv.getContext("2d");
    const ads = [
        ["#1d2b4a", "#c23b3b", "OSBORN", "FOR MAYOR"],
        ["#2a1f1a", "#e0a33a", "BURGERS", "HOT DOGS"],
        ["#0f3a44", "#5fd0c8", "PULSE", "NEW SEASON"],
        ["#3b1030", "#e05aa0", "ZEPHYR", "FRAGRANCE"],
        ["#161616", "#f0f0f0", "BROADWAY", "TONIGHT"],
        ["#233d1c", "#a7d86a", "NOVA", "SODA"],
        ["#40210e", "#f08a3c", "SKYLINE", "TOURS"],
        ["#10223d", "#6aa8f0", "ROXXON", "ENERGY"],
        ["#2d0f0f", "#f04a3a", "DAILY BUGLE", "READ ALL"],
        ["#1f1f33", "#c8b8ff", "THE CATS", "MUSICAL"],
        ["#0d2b20", "#46d49a", "GREEN", "BANK"],
        ["#3a3210", "#f2d24a", "TAXI", "APP"],
        ["#22123a", "#b06af0", "VIEWS", "FROM THE TOP"],
        ["#0e2f3f", "#3cc8f0", "AIR", "SNEAKERS"],
        ["#3a1a10", "#f0a070", "PIZZA", "$1 SLICE"],
        ["#101a2e", "#e8e8f0", "MIDTOWN", "SCIENCE"],
    ];
    ads.forEach(([bg, fg, t1, t2], i) => {
        const x = (i % N) * S,
            y = Math.floor(i / N) * S;
        const gr = g.createLinearGradient(x, y, x + S, y + S);
        gr.addColorStop(0, bg);
        gr.addColorStop(1, "#0a0a0a");
        g.fillStyle = gr;
        g.fillRect(x, y, S, S);
        g.globalAlpha = 0.35;
        g.fillStyle = fg;
        if (i % 3 === 0) {
            g.beginPath();
            g.arc(x + S * 0.75, y + S * 0.35, S * 0.3, 0, 7);
            g.fill();
        } else if (i % 3 === 1)
            for (let k = 0; k < 5; k++)
                g.fillRect(x, y + (k * S) / 5 + 6, S, 10);
        else {
            g.beginPath();
            g.moveTo(x, y + S);
            g.lineTo(x + S, y);
            g.lineTo(x + S, y + S * 0.4);
            g.lineTo(x + S * 0.4, y + S);
            g.fill();
        }
        g.globalAlpha = 1;
        g.fillStyle = fg;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = `900 ${Math.floor(S * (t1.length > 7 ? 0.14 : 0.2))}px Impact, Arial Black, sans-serif`;
        g.fillText(t1, x + S / 2, y + S * 0.45);
        g.font = `700 ${Math.floor(S * 0.09)}px Arial, sans-serif`;
        g.fillStyle = "#e8e8e8";
        g.fillText(t2, x + S / 2, y + S * 0.68);
        g.strokeStyle = "rgba(0,0,0,0.6)";
        g.lineWidth = 6;
        g.strokeRect(x + 3, y + 3, S - 6, S - 6);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { tex, n: ads.length, N };
}

// --------------------------------------------------------------------------------------------- standalone landmarks
export function buildStandalone({ scene, gen, T }) {
    const S = gen.solids,
        Z = gen.zips;
    // ---- Grand-Central-like terminal across Park Av + Park-Av viaduct + MetLife-like slab (street agent: grandcentral.js)
    buildGrandCentral({ scene, gen, T });
    // ---- Times Square LED screens on the billboard towers (plaza faces), one merged emissive mesh
    const ads = makeAdAtlas();
    const P = [],
        UV = [],
        N = [],
        I = [];
    let v = 0;
    const quad = (a, b, c, d, n, cell, rep = 1) => {
        const u0 = (cell % ads.N) / ads.N,
            v0 = 1 - (Math.floor(cell / ads.N) + 1) / ads.N,
            du = 1 / ads.N;
        for (const p of [a, b, c, d]) P.push(...p);
        UV.push(u0, v0, u0 + du * rep, v0, u0 + du * rep, v0 + du, u0, v0 + du);
        for (let k = 0; k < 4; k++) N.push(...n);
        I.push(v, v + 1, v + 2, v, v + 2, v + 3);
        v += 4;
    };
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const R of gen.reserves) {
        if (!R.billboards || !R.build) continue;
        const t = gen.tile(
            (R.lot.x0 + R.lot.x1) / 2,
            (R.lot.z0 + R.lot.z1) / 2,
        );
        const m = R.build.masses[0],
            face = R.billboards;
        const x = face === "px" ? m.x1 : m.x0,
            sgn = face === "px" ? 1 : -1;
        // stacked screens up the podium / lower tower along the plaza face, plus wraps on the street faces
        let y = 7.5;
        while (y + 6 < m.y1 - 1.5) {
            const h = Math.min(7 + rnd() * 9, m.y1 - 1.5 - y);
            let z = m.z0 + 1.5;
            while (z < m.z1 - 4) {
                const w = Math.min(m.z1 - 1.5 - z, 9 + rnd() * 14);
                if (w < 4) break;
                const off = 0.35,
                    xo = x + sgn * off;
                // frame (dark steel box against the wall) + emissive screen quad on its face
                const fx0 = Math.min(x, xo),
                    fx1 = Math.max(x, xo);
                const fp = {
                    floorH: 3,
                    bayW: 2,
                    winW: 0.5,
                    winH: 0.5,
                    layer: LAYER.METAL,
                    base: LAYER.METAL,
                    seed: 3,
                    margin: 0,
                    depth: 0.05,
                    tint: [0.35, 0.35, 0.37],
                    topY: y + h,
                    baseY: y,
                };
                t.fac.box(
                    fx0,
                    y,
                    z,
                    fx1,
                    y + h,
                    z + w,
                    fp,
                    { [face === "px" ? "nx" : "px"]: null },
                    true,
                    true,
                );
                S.box(fx0, y, z, fx1, y + h, z + w, "wall");
                const xs = xo + sgn * 0.01,
                    e = 0.25;
                const a = [xs, y + e, face === "px" ? z + w - e : z + e],
                    b = [xs, y + e, face === "px" ? z + e : z + w - e];
                const c = [xs, y + h - e, b[2]],
                    d = [xs, y + h - e, a[2]];
                quad(a, b, c, d, [sgn, 0, 0], Math.floor(rnd() * ads.n));
                z += w + 0.6 + rnd() * 3;
            }
            y += h + 0.8 + rnd() * 4;
        }
    }
    if (v) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
        g.setIndex(I);
        g.computeBoundingSphere();
        const mat = new THREE.MeshStandardMaterial({
            map: ads.tex,
            emissive: 0xffffff,
            emissiveMap: ads.tex,
            emissiveIntensity: 0.55,
            roughness: 0.35,
            metalness: 0,
        });
        const mesh = new THREE.Mesh(g, mat);
        mesh.name = "timesSquareScreens";
        mesh.receiveShadow = true;
        scene.add(mesh);
    }
    for (const R of gen.reserves)
        if (R.plaza && R.lot)
            PLAZAS.push({
                x0: R.lot.x0,
                z0: R.lot.z0,
                x1: R.lot.x1,
                z1: R.lot.z1,
                kind: "times",
            });
}
