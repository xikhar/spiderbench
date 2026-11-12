// @ts-nocheck
/**
 * Simulates vehicle traffic agents and their runtime behavior.
 *
 * @module world-npc-traffic
 * @version 1.0.0
 * @file src/world/npc/traffic.ts
 * @since 0.0.1
 * @description Manages traffic spawning, path following, junction interaction, and per-frame vehicle updates in the city.
 */
import * as THREE from "three";
import {
    G,
    mulberry32,
    hash2,
    islandNear,
    bikeLaneAt,
    DIAG_SEGS,
    diagD,
} from "@/world/layout.ts";
import { connector, connAt, mapPhase, bridgeJunctions } from "./roads.ts";
import { createJunctions } from "./junctions.ts";
import { registry, curbBlocked } from "./registry.ts";
import { createContactAO, createHeadlightPools } from "@/world/contactao.ts";
import { csmShared, SHADOW_PROXY_LAYER } from "@/render/csm.ts";
import { perf2Off } from "@/world/tilebatch.ts";
import { cityLights } from "@/render/citylights.ts";
import { nightK } from "@/render/daynight.ts";

const RA = 640;
const PARK_R = 500;
const HI_D = 48,
    LOW_D = 230;
const MAX_CARS = 2600;
const _A = 2.0,
    B = 3.2,
    S0 = 2.0,
    _TH = 1.1;
const PLAYER_R = 0.5;

const DENSITY = { av: 31, st: 44, ws: 20, dg: 41, dg1: 80, map: 27, br: 31 };
let densityScale = 1;

export const VTYPES = {
    taxi: { len: 5.39, wid: 1.99, h: 1.5, big: false },
    taxi_hy: { len: 4.54, wid: 1.76, h: 1.52, big: false },
    taxi_mv: { len: 5.08, wid: 1.99, h: 1.8, big: false },
    taxi_gr: { len: 4.86, wid: 1.84, h: 1.48, big: false },
    sedan: { len: 4.85, wid: 1.84, h: 1.46, big: false },
    hatch: { len: 4.26, wid: 1.79, h: 1.46, big: false },
    sedan2: { len: 4.9, wid: 1.85, h: 1.46, big: false },
    cross: { len: 4.6, wid: 1.86, h: 1.7, big: false },
    suv: { len: 4.9, wid: 1.95, h: 1.77, big: false },
    suv2: { len: 5.35, wid: 2.03, h: 1.92, big: false },
    pickup: { len: 5.9, wid: 2.03, h: 1.95, big: false },
    van: { len: 5.98, wid: 2.06, h: 2.55, big: false },
    truck: { len: 7.3, wid: 2.3, h: 3.5, big: true },
    bus: { len: 12.2, wid: 2.55, h: 3.1, big: true },
    tour: { len: 11, wid: 2.55, h: 4.3, big: true },
};

const CAR_COLORS = [
    0x0e0e0f, 0x151517, 0x1b1c1f, 0x101418, 0xe2e2df, 0xd8d8d4, 0xcfcfca,
    0xe6e3da, 0xa9adb1, 0x9c9fa3, 0xb7b9bb, 0x8e9296, 0x6d7074, 0x55585c,
    0x44474b, 0x1b2a4a, 0x223a63, 0x2f4c7a, 0x5a1216, 0x6e1a1a, 0x8a1f1f,
    0xb3a98f, 0x9b8f75, 0x2c3d2e, 0x44563f, 0x6b86a0, 0x4a3a2c, 0x3b4450,
    0x7c8a8f, 0x2a2d33,
];
const lin = (c) =>
    [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255].map(
        (s) => Math.pow(s, 2.2),
    );
const TAXI = lin(0xf5a900);
const TAXI_GR = lin(0x9aae4c);
const VANC = [0xd6d6d2, 0xcfccc4, 0xc9c9c7, 0xd9d7d0].map(lin);
const PAL = CAR_COLORS.map(lin);
const LIVERY = [0x0b0b0c, 0x0e0e10, 0x121315, 0x0d1014].map(lin);
const TRUCKC = [
    0xdcdcd8, 0xd2d2cc, 0xc8c2b4, 0xe2e0da, 0x2a4f8a, 0x8a1c1c, 0x3c4a3a,
    0xb8b4aa,
].map(lin);

class Inst {
    constructor(geo, mat, max, { shadow = true, name = "" } = {}) {
        this.mesh = new THREE.InstancedMesh(geo, mat, max);
        this.mesh.name = name;
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = shadow;
        this.mesh.receiveShadow = true;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.tint = new THREE.InstancedBufferAttribute(
            new Float32Array(max * 3),
            3,
        ).setUsage(THREE.DynamicDrawUsage);
        this.state = new THREE.InstancedBufferAttribute(
            new Float32Array(max),
            1,
        ).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute("aTint", this.tint);
        geo.setAttribute("aState", this.state);
        this.seed = new THREE.InstancedBufferAttribute(
            new Float32Array(max),
            1,
        ).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute("aSeed", this.seed);
        this.max = max;
        this.n = 0;
    }
    push(x, y, z, ry, tint, state, pitch = 0, seed = 0) {
        if (this.n >= this.max) return;
        const k = this.n++,
            e = this.mesh.instanceMatrix.array,
            o = k * 16;
        const c = Math.cos(ry),
            s = Math.sin(ry);
        if (pitch) {
            const cp = Math.cos(pitch),
                sp = Math.sin(pitch);
            e[o] = c * cp;
            e[o + 1] = sp;
            e[o + 2] = -s * cp;
            e[o + 3] = 0;
            e[o + 4] = -c * sp;
            e[o + 5] = cp;
            e[o + 6] = s * sp;
            e[o + 7] = 0;
        } else {
            e[o] = c;
            e[o + 1] = 0;
            e[o + 2] = -s;
            e[o + 3] = 0;
            e[o + 4] = 0;
            e[o + 5] = 1;
            e[o + 6] = 0;
            e[o + 7] = 0;
        }
        e[o + 8] = s;
        e[o + 9] = 0;
        e[o + 10] = c;
        e[o + 11] = 0;
        e[o + 12] = x;
        e[o + 13] = y;
        e[o + 14] = z;
        e[o + 15] = 1;
        this.tint.array[k * 3] = tint[0];
        this.tint.array[k * 3 + 1] = tint[1];
        this.tint.array[k * 3 + 2] = tint[2];
        this.state.array[k] = state;
        this.seed.array[k] = seed;
    }
    begin() {
        this.n = 0;
    }
    end() {
        this.mesh.count = this.n;
        this.mesh.visible = this.n > 0;
        if (!this.n) return;
        const im = this.mesh.instanceMatrix;
        im.clearUpdateRanges();
        im.addUpdateRange(0, this.n * 16);
        im.needsUpdate = true;
        this.tint.clearUpdateRanges();
        this.tint.addUpdateRange(0, this.n * 3);
        this.tint.needsUpdate = true;
        this.state.clearUpdateRanges();
        this.state.addUpdateRange(0, this.n);
        this.state.needsUpdate = true;
        this.seed.clearUpdateRanges();
        this.seed.addUpdateRange(0, this.n);
        this.seed.needsUpdate = true;
    }
}

function makeHorn() {
    let last = -1;
    return (dist, big, x, z, y = 1) => {
        const A = window.__audio;
        if (!A?.ready || dist > 120) return;
        const t = performance.now() / 1000;
        if (t - last < 0.35) return;
        last = t;
        A.sfx.hornAt(x, y + 1.2, z, big);
    };
}

export function createTraffic({
    scene,
    roads,
    phase,
    geos,
    mats,
    models = null,
}) {
    const { links, nodes } = roads;
    const tiers = {};
    const all = [];

    const groups = {};
    const grpOf = (t) => models?.[t]?.grp ?? t;
    for (const t of Object.keys(VTYPES)) {
        const g = grpOf(t);
        if (!groups[g]) {
            const big = VTYPES[t].big;
            groups[g] = {
                far: new Inst(geos.far[g], mats.far, big ? 500 : 2400, {
                    shadow: false,
                    name: "veh-far-" + g,
                }),
            };
            groups[g].far.farTier = true;
            scene.add(groups[g].far.mesh);
            all.push(groups[g].far);
            if (geos.glb || geos.hi[t]) {
                const px = new Inst(
                    geos.far[g].clone(),
                    mats.far,
                    big ? 200 : 700,
                    { name: "veh-shadowProxy-" + g },
                );
                px.mesh.layers.set(SHADOW_PROXY_LAYER);
                px.mesh.userData.smallCasters = true;
                px.mesh.receiveShadow = false;
                scene.add(px.mesh);
                all.push(px);
                groups[g].proxy = px;
            }
        }
    }
    for (const t of Object.keys(VTYPES)) {
        const hiMax = VTYPES[t].big ? 60 : 120;
        tiers[t] = {
            hi: new Inst(
                geos.hi[t] || geos.low[t],
                geos.hi[t] ? mats.hi : mats.mid,
                hiMax,
                { name: "veh-hi-" + t },
            ),
            low: new Inst(geos.low[t], mats.mid, VTYPES[t].big ? 200 : 500, {
                name: "veh-low-" + t,
            }),
            far: groups[grpOf(t)].far,
            proxy: groups[grpOf(t)].proxy,
        };
        for (const k of ["hi", "low"]) {
            scene.add(tiers[t][k].mesh);
            all.push(tiers[t][k]);
        }
    }
    const cao = createContactAO(scene, 1600);
    const hlp = createHeadlightPools(scene, 600);

    const CL_MAX = 50,
        CL_R = 200,
        CL_TAIL = 45,
        CL_CAP = 2048;
    const clCar = new Array(CL_CAP).fill(null),
        clD = new Float32Array(CL_CAP),
        clSort = new Float32Array(CL_CAP);
    let clN = 0;

    const CL_TWIN = 30,
        CL_TILT = 0.1;
    const clH = {
        type: "spot",
        pos: [0, 0, 0],
        dir: [1, 0, 0],
        color: 0xffd8b0,
        intensity: 45,
        range: 20,
        angle: 0.5,
        penumbra: 0.9,
        radius: 3.5,
        volume: 0.18,
        key: 0,
        spec: 0,
    };
    const clT = {
        type: "point",
        pos: [0, 0, 0],
        color: 0xff1c0c,
        intensity: 0.75,
        range: 4.5,
        radius: 0.2,
        volume: 0.04,
        shadow: false,
    };
    const clOff =
        typeof location !== "undefined" && /[?&]nohl\b/.test(location.search);
    cityLights.addProvider(
        (emitL) => {
            const n = clN;
            if (!n || clOff) return;
            let lim = Infinity,
                limT = Infinity;
            if (n > CL_TWIN) {
                clSort.set(clD);
                for (let i = n; i < CL_CAP; i++) clSort[i] = 1e12;
                clSort.sort();
                limT = clSort[CL_TWIN - 1];
                if (n > CL_MAX) lim = clSort[CL_MAX - 1];
            }
            for (let i = 0; i < n; i++) {
                if (clD[i] > lim) continue;
                const c = clCar[i],
                    cy = c.parked ? 0 : c.y,
                    p = c.parked ? 0 : c.pitch + c.gp,
                    cs = Math.cos(c.ry),
                    sn = Math.sin(c.ry),
                    sp = Math.sin(p);
                const h = c.len / 2 + 0.1,
                    ly = cy + 0.72,
                    twin = clD[i] <= limT;
                const cq = Math.cos(p - CL_TILT),
                    sq = Math.sin(p - CL_TILT);
                clH.dir[0] = cs * cq;
                clH.dir[1] = sq;
                clH.dir[2] = -sn * cq;
                const I =
                    c.x > -112 && c.x < 112 && c.z > -352 && c.z < 22 ? 14 : 38;
                const id2 =
                    (c.parked ? 1e6 + Math.round(c.x * 3 + c.z * 7919) : c.id) *
                    2;
                const fx = c.x + cs * h,
                    fy = ly + sp * h,
                    fz = c.z - sn * h,
                    w = twin ? Math.max(0.5, c.wid / 2 - 0.25) : 0;

                for (
                    let k = twin ? -1 : 0;
                    k <= (twin ? 1 : 0);
                    k += 2 - (twin ? 0 : 1)
                ) {
                    clH.pos[0] = fx + sn * w * k;
                    clH.pos[1] = fy;
                    clH.pos[2] = fz + cs * w * k;
                    clH.intensity = twin ? I : 2 * I;
                    clH.key = id2 + (k > 0 ? 1 : 0);
                    emitL(clH);
                }
                if (clD[i] < CL_TAIL * CL_TAIL) {
                    const t = c.len / 2 + 0.2,
                        br = c.parked
                            ? c.haz && (time * 1.5 + c.x * 0.01) % 1 < 0.5
                            : c.brake > 0;
                    const bx = c.x - cs * t,
                        by = cy + 0.85 - sp * t,
                        bz = c.z + sn * t,
                        tw = Math.max(0.5, c.wid / 2 - 0.2);
                    clT.intensity = br ? 2 : 0.75;
                    for (let k = -1; k <= 1; k += 2) {
                        clT.pos[0] = bx + sn * tw * k;
                        clT.pos[1] = by;
                        clT.pos[2] = bz + cs * tw * k;
                        clT.key = 4e7 + id2 + (k > 0 ? 1 : 0);
                        emitL(clT);
                    }
                }
            }
        },
        { moving: true },
    );

    for (const L of links) {
        L.blockS = Infinity;
        for (const o of registry.laneObstacles) {
            const px = o.x - L.ax,
                pz = o.z - L.az,
                s = px * L.dx + pz * L.dz,
                lat = Math.abs(px * L.dz - pz * L.dx);
            if (s > -2 && s < L.len + 2 && lat < 1.6)
                L.blockS = Math.min(L.blockS, s - 2.5);
        }

        for (const c of registry.laneClosures ?? []) {
            for (let s = 0; s <= L.len; s += 1) {
                const x = L.ax + L.dx * s,
                    z = L.az + L.dz * s;
                if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) {
                    L.blockS = Math.min(L.blockS, s - 2.5);
                    L.noSpawn = true;
                    break;
                }
            }
        }
    }
    const horn = makeHorn();
    let cars = [];
    let serial = 1;
    const rnd = mulberry32(globalThis.__trafficSeed ?? 99);
    const player = {
        pos: new THREE.Vector3(1e9, 0, 0),
        vel: new THREE.Vector3(),
        t: -1,
        ground: 0,
    };

    const pickType = (L, r) => {
        const big = L.kind !== "st" && L.lane === 1;
        if (big && r < 0.07) return "bus";
        if (big && r < 0.09) return "tour";

        if (r < 0.13) return "truck";
        if (r < 0.21) return "van";
        if (r < 0.28) return "taxi_hy";
        if (r < 0.34) return "taxi_mv";
        if (r < 0.41) return "taxi_gr";
        if (r < 0.44) return "taxi";
        if (r < 0.52) return "sedan";
        if (r < 0.6) return "sedan2";
        if (r < 0.66) return "hatch";
        if (r < 0.74) return "suv";
        if (r < 0.82) return "cross";
        if (r < 0.93) return "suv2";
        return "pickup";
    };
    const colorOf = (type, r) =>
        type === "taxi_gr"
            ? r < 0.3
                ? TAXI_GR
                : TAXI
            : type.startsWith("taxi")
              ? TAXI
              : (type === "suv2" && r < 0.7) ||
                  (type === "sedan2" && r < 0.4) ||
                  (type === "suv" && r < 0.3)
                ? LIVERY[Math.floor(r * 97) % LIVERY.length]
                : type === "truck" || type === "van"
                  ? VANC[Math.floor(r * VANC.length)]
                  : type === "tour"
                    ? lin(0xb3121a)
                    : type === "bus"
                      ? lin(0xe4e4e0)
                      : PAL[Math.floor(r * PAL.length)];
    const chooseNext = (c, L, avoid = null) => {
        const opts = L.out;
        if (!opts || !opts.length) return null;
        const big = VTYPES[c.type].big;
        let tot = 0;
        const w = opts.map((o) => {
            let x =
                o.turn === "S"
                    ? 0.66
                    : o.turn === "U"
                      ? 0.05
                      : big && o.turn === "L"
                        ? 0.02
                        : 0.17;
            if (o.link.blockS < Infinity) x *= 0.001;
            if (avoid && o.link === avoid) x *= 0.02;
            if (
                c.len > 7 &&
                o.link.vmap &&
                ((o.link.diag?.w ?? 10) < 12 || c.len > 10)
            )
                x *= 0.002;
            if (c.len > 10 && o.turn !== "S" && (L.diag || o.link.diag))
                x *= 0.01;
            {
                const N = o.link;
                let tail = N.len;
                for (let k = 0; k < N.cars.length; k++) {
                    const q = N.cars[k];
                    tail = q.s - q.len / 2 - (q.conn ? q.len : 0);
                    break;
                }
                if (N.active && tail < c.len + 8)
                    x *= 0.08 + (0.92 * Math.max(0, tail)) / (c.len + 8);
            }
            tot += x;
            return x;
        });
        let r = c.rng() * tot;
        for (let i = 0; i < opts.length; i++)
            if ((r -= w[i]) <= 0) {
                const o = opts[i];
                if (o.link.blockS < Infinity && o.turn === "S" && o.link.alt)
                    return o.link.alt;
                return o;
            }
        return opts[opts.length - 1];
    };
    const newCar = (L, s, v, seed) => {
        const rng = mulberry32(seed);
        const type = pickType(L, rng());
        const T = VTYPES[type];
        const c = {
            id: serial++,
            type,
            len: T.len,
            wid: T.wid,
            h: T.h,
            link: L,
            s,
            v,
            v0: (L.kind === "st" ? 9 : 12.5) + rng() * 3.5,
            conn: null,
            next: null,
            rng,
            color: colorOf(type, rng()),
            brake: 0,
            blockT: 0,
            honkT: 0,
            x: 0,
            z: 0,
            ry: 0,
            pitch: 0,
            acc: 0,
            dead: false,

            reg: null,
            chain: null,
            via: null,
            pre: null,
            wait: null,
            wM: null,
            wT0: 0,
            wAcc: 0,
            wLast: 0,
            _req: null,
            _red: false,
            _why: "",
            _whyC: null,
            creepT: 0,
            _tM: null,
            _tN: null,
            stuckT: 0,
            stillT: 0,
            regT: 0,
            _pAlong: null,
            _pLat: 0,
            _pSoft: false,
            inZone: false,
            adSeed: undefined,
            _vis: false,

            dA: 1.6 + rng() * 0.8,
            dTH: 0.8 + rng() * 0.6,
            dS0: 1.5 + rng() * 1.0,
            latB: 0,
            latA: 0.1 + rng() * 0.25,
            latK: (2 * Math.PI) / (60 + rng() * 100),
            latP: rng() * 6.283,
            odo: 0,
            lat: 0,
            latV: 0,
            lc: 0,
            lc0: 0,
            lcFrom: null,
            lcT: 0,
            lcDur: 0,
            lcCool: 4 + rng() * 10,
            wob: rng() * 100,
            yaw: 0,
            y: 0,
            gp: 0,
        };
        {
            const r = rng();
            c.latB = (r < 0.25 ? 0.25 : 0.08) * (rng() < 0.5 ? -1 : 1);
        }
        c.next = chooseNext(c, L);
        return c;
    };
    const insertSorted = (arr, c) => {
        let i = arr.length;
        while (i > 0 && arr[i - 1].s > c.s) i--;
        arr.splice(i, 0, c);
    };

    const lastCam = new THREE.Vector3(1e9, 0, 0);
    let streamT = 0;
    const segDist2 = (L, x, z) => {
        const px = x - L.ax,
            pz = z - L.az;
        const t = Math.max(0, Math.min(L.len, px * L.dx + pz * L.dz));
        const qx = px - L.dx * t,
            qz = pz - L.dz * t;
        return qx * qx + qz * qz;
    };
    const populate = (L, first) => {
        if (L.noSpawn) return;
        const rng = mulberry32(
            (L.id * 7919 + (L.gen = (L.gen || 0) + 1) * 104729) >>> 0,
        );
        const spacing =
            L.kind === "st" ? [8, 38] : L.kind === "dr" ? [10, 38] : [6, 27];
        let s = 3 + rng() * 12 + (L.blockS < Infinity ? L.blockS + 6 : 0);
        const light = L.signal ? phase(time, L.axis) : 2;
        const list = [];
        while (s < L.len - 3 && cars.length < MAX_CARS) {
            const c = newCar(L, 0, 0, (L.id * 131 + s * 17 + L.gen * 7) >>> 0);
            c.s = s + c.len / 2;
            if (c.s + c.len / 2 > L.len - 1) break;
            {
                const cx = L.ax + L.dx * c.s,
                    cz = L.az + L.dz * c.s;
                const pa =
                        (player.pos.x - cx) * L.dx + (player.pos.z - cz) * L.dz,
                    pl = Math.abs(
                        (player.pos.x - cx) * L.dz - (player.pos.z - cz) * L.dx,
                    );
                if (
                    pl < c.wid / 2 + PLAYER_R + 0.7 &&
                    pa > -c.len / 2 - 2 &&
                    pa < c.len / 2 + 25
                ) {
                    s += c.len + 4;
                    continue;
                }
                let inZ = false;
                for (const z of zones.values())
                    if (
                        z.until > time &&
                        (z.x - cx) ** 2 + (z.z - cz) ** 2 < (z.r + 8) ** 2
                    )
                        inZ = true;
                if (inZ) {
                    s += c.len + 4;
                    continue;
                }
            }
            const dStop = L.stopS - (c.s + c.len / 2);
            c.v = c.v0 * (0.55 + rng() * 0.35);
            if (light !== 2 && dStop > -0.5)
                c.v = Math.min(
                    c.v,
                    Math.sqrt(2 * 2.5 * Math.max(0, dStop - 1.5)),
                );
            list.push(c);
            cars.push(c);

            const avL = L.kind !== "st";
            if (L.plat === undefined || L.plat <= 0)
                L.plat = (avL ? 1 : 2) + Math.floor(rng() * (avL ? 4 : 5));
            s +=
                c.len +
                (--L.plat > 0
                    ? 2.4 + rng() * 5.5
                    : (spacing[0] * 2 + rng() * (spacing[1] * 2.6)) *
                      (avL ? 2.3 : 1));
        }

        if (light !== 2 && list.length) {
            let lim = L.stopS;
            for (let i = list.length - 1; i >= 0; i--) {
                const c = list[i];
                if (
                    c.s + c.len / 2 > lim - 0.3 ||
                    lim - (c.s + c.len / 2) < 25
                ) {
                    c.s = Math.min(c.s, lim - c.len / 2 - 0.3);
                    if (lim - (c.s + c.len / 2) < 3) c.v = 0;
                }
                lim = c.s - c.len / 2 - (S0 + 0.3 + rng() * 1.5);
            }
        }

        {
            const stop = Math.min(L.stopS, L.xst ? L.xst[0] : Infinity);
            for (const c of list)
                if (c.s + c.len / 2 < stop)
                    c.v = Math.min(
                        c.v,
                        Math.sqrt(
                            2 * 3 * Math.max(0, stop - (c.s + c.len / 2) - 1),
                        ),
                    );
        }
        for (let i = list.length - 2; i >= 0; i--) {
            const a = list[i],
                b = list[i + 1],
                g = b.s - b.len / 2 - (a.s + a.len / 2);
            a.v = Math.min(a.v, b.v + Math.max(0, g - 1.5) * 0.9);
        }
        {
            const tgt = linkTarget(L) * (0.8 + rng() * 0.4);
            while (
                list.length > Math.ceil(tgt) ||
                (list.length && rng() < 0.03)
            ) {
                const k = Math.floor(rng() * list.length);
                list[k].dead = true;
                list.splice(k, 1);
            }
        }
        L.cars = list.concat(L.cars).sort((a, b) => a.s - b.s);
        L.spawnGap = spacing[0] + rng() * (spacing[1] - spacing[0]);
        void first;
    };

    const inBJ = (x, z) =>
        bridgeJunctions().some(
            (b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1,
        );
    const onDiag = (x, z, pad, own = null) => {
        for (const g of DIAG_SEGS) {
            if (g === own) continue;
            const u = (x - g.ax) * g.ux + (z - g.az) * g.uz;
            if (
                u > -pad &&
                u < g.len + pad &&
                Math.abs(diagD(g, x, z)) < g.hw + pad
            )
                return true;
        }
        return false;
    };
    const parkedFor = (L) => {
        L.dbl = null;
        if (L.kind === "dr" || L.noPark || (L.kind !== "st" && L.lane !== 1))
            return [];
        const rng = mulberry32((L.id * 48271 + 11) >>> 0);
        const out = [];
        const sides =
            L.parkSides || (L.kind === "st" ? [3.9, -3.9] : [9.2 * 0 + 3.8]);
        for (const lat of sides) {
            if (rng() < 0.12) continue;

            const rx = -L.dz,
                rz = L.dx;
            const off = L.parkSides ? lat : L.kind === "st" ? lat - 0.6 : lat;

            const special = [];
            {
                const r2 = mulberry32((L.id * 69621 + (lat > 0 ? 7 : 3)) >>> 0);
                const av = L.kind !== "st";
                const put = (type, sAt, latOff, haz) => {
                    const T = VTYPES[type];
                    if (sAt < 8 || sAt > L.len - 10) return;
                    const x = L.ax + L.dx * sAt + rx * latOff,
                        z = L.az + L.dz * sAt + rz * latOff;
                    if (
                        curbBlocked(x, z, 1.5) ||
                        islandNear(x, z, 2.8) ||
                        bikeLaneAt(x, z) ||
                        onDiag(
                            x,
                            z,
                            T.len / 2 + 3,
                            L.oneWayBway ? L.diag : null,
                        ) ||
                        inBJ(x, z) ||
                        jx.nearTurn(x, z, T.len / 2 + 1.6)
                    )
                        return;
                    (L.dbl ??= []).push({
                        s: sAt,
                        lat: latOff,
                        hw: T.wid / 2,
                        hl: T.len / 2,
                    });
                    special.push({
                        type,
                        len: T.len,
                        wid: T.wid,
                        h: T.h,
                        x,
                        z,
                        ry: -L.heading + (r2() - 0.5) * 0.05,
                        color: colorOf(type, r2()),
                        v: 0,
                        parked: true,
                        haz,
                        s: sAt,
                    });
                };

                const inset = (d, min) =>
                    Math.sign(off) * Math.max(Math.abs(off) - d, min);
                if (r2() < (av ? 0.2 : 0.26) && !L.narrow)
                    put(
                        "truck",
                        12 + r2() * (L.len - 30),
                        inset(1.05, 2.45),
                        true,
                    );
                if (r2() < 0.16 && !L.narrow)
                    put(
                        ["taxi_hy", "taxi_mv", "taxi_gr", "taxi_hy"][
                            (L.id * 7 + (lat > 0 ? 1 : 0)) % 4
                        ],
                        10 + r2() * (L.len - 25),
                        inset(0.35, 2.35),
                        true,
                    );
                if (av && r2() < 0.14 && L.stopS > 30)
                    put(
                        "bus",
                        L.stopS - 12 - r2() * 8,
                        inset(0.4, 2.65),
                        false,
                    );
            }
            for (const q of special) out.push(q);
            for (
                let s = 9 + rng() * 5;
                s < L.len - 12;
                s += 5.9 + rng() * 2.4
            ) {
                if (rng() < (L.kind === "st" ? 0.16 : 0.28)) continue;
                if (special.some((q) => Math.abs(q.s - s) < q.len / 2 + 3.4))
                    continue;
                const r = rng();
                let type =
                    r < 0.08
                        ? "taxi"
                        : r < 0.52
                          ? "sedan"
                          : r < 0.93
                            ? "suv"
                            : "truck";
                {
                    const h =
                        Math.abs(
                            Math.sin(L.id * 12.9898 + s * 78.233) * 43758.5453,
                        ) % 1;
                    if (type === "taxi")
                        type =
                            h < 0.15
                                ? "taxi"
                                : h < 0.55
                                  ? "taxi_hy"
                                  : h < 0.8
                                    ? "taxi_mv"
                                    : "taxi_gr";
                    else if (type === "sedan")
                        type =
                            h < 0.42 ? "sedan" : h < 0.74 ? "sedan2" : "hatch";
                    else if (type === "suv")
                        type =
                            h < 0.32
                                ? "suv"
                                : h < 0.6
                                  ? "cross"
                                  : h < 0.88
                                    ? "suv2"
                                    : "pickup";
                    else if (type === "truck")
                        type = h < 0.45 ? "van" : "truck";
                }
                const T = VTYPES[type];
                if (type === "truck" || type === "van" || type === "pickup")
                    s += 1.3;
                const x = L.ax + L.dx * s + rx * off + (rng() - 0.5) * 0.2,
                    z = L.az + L.dz * s + rz * off + (rng() - 0.5) * 0.2;
                if (
                    curbBlocked(x, z, 1.5) ||
                    islandNear(x, z, 2.8) ||
                    bikeLaneAt(x, z) ||
                    onDiag(x, z, T.len / 2 + 3, L.oneWayBway ? L.diag : null) ||
                    inBJ(x, z) ||
                    jx.nearTurn(x, z, T.len / 2 + 1.6)
                )
                    continue;

                const ry = -L.heading + (rng() - 0.5) * 0.04;
                out.push({
                    type,
                    len: T.len,
                    wid: T.wid,
                    h: T.h,
                    x,
                    z,
                    ry,
                    color: colorOf(type, rng()),
                    v: 0,
                    parked: true,
                });
                if (type === "truck") s += 2.5;
                else if (type === "van" || type === "pickup") s += 0.6;
            }
        }
        return out;
    };
    const stream = (cam) => {
        const R2 = RA * RA,
            R2o = (RA + 60) ** 2,
            P2 = PARK_R * PARK_R,
            P2o = (PARK_R + 50) ** 2;
        for (const L of links) {
            const d2 = segDist2(L, cam.x, cam.z) * (L.bridge ? 0.75 : 1);
            L.far = d2 > 330 * 330 ? 2 : d2 > 200 * 200 ? 1 : 0;
            if (!L.active && d2 < R2) {
                L.active = true;
                populate(L);
            } else if (L.active && d2 > R2o) {
                L.active = false;
                for (const c of L.cars) c.dead = true;
                L.cars = [];
            }
            if (!L.parked && d2 < P2) L.parked = parkedFor(L);
            else if (L.parked && d2 > P2o) L.parked = null;
        }
        cars = cars.filter((c) => !c.dead);
        refill(cam);
    };
    const kindOf = (L) =>
        L.bridge
            ? "br"
            : L.vmap
              ? "map"
              : L.oneWayBway
                ? "dg1"
                : L.diag && L.kind === "dg"
                  ? "dg"
                  : L.kind === "ws"
                    ? "ws"
                    : L.kind === "st"
                      ? "st"
                      : "av";
    const linkTarget = (L) =>
        L.noSpawn || L.blockS < Infinity
            ? 0
            : (L.len / 1000) *
              DENSITY[kindOf(L)] *
              densityScale *
              (L.vmap && L.cz > 2400 ? 0.6 : 1) *
              (L.bridge && L.dx < 0 ? (L.lane === 2 ? 0 : 0.35) : 1);

    const _refillT = 0;
    const refill = (cam) => {
        let want = 0,
            have = 0;
        const cand = [];
        for (const L of links) {
            if (!L.active) continue;
            const t = linkTarget(L);
            want += t;
            have += L.cars.length;
            if (t - L.cars.length > 0.6) cand.push(L);
        }
        jStats.want = Math.round(want);
        jStats.have = have;

        let drained = 0;
        for (const L of links) {
            if (
                !L.active ||
                drained >= 6 ||
                L.cars.length < 3 ||
                L.cars.length <= linkTarget(L) * 1.5 + 2
            )
                continue;
            const dx = L.cx - cam.x,
                dz = L.cz - cam.z;
            sph.center.set(L.cx, 2, L.cz);
            sph.radius = L.len / 2 + 6;
            if (
                dx * dx + dz * dz < 260 * 260 &&
                frustumOk &&
                frustum.intersectsSphere(sph)
            )
                continue;
            for (const q of L.cars)
                if (
                    !q.conn &&
                    q.v < 0.5 &&
                    !q._vis &&
                    !(q.reg && q.reg.length)
                ) {
                    q.dead = true;
                    drained++;
                    jStats.drain++;
                    break;
                }
        }
        if (drained) {
            for (const L of links)
                if (L.active && L.cars.some((q) => q.dead))
                    L.cars = L.cars.filter((q) => !q.dead);
            cars = cars.filter((q) => !q.dead);
        }
        const deficit = Math.min(want - have, MAX_CARS - cars.length);
        if (deficit < 1 || !cand.length) return;
        let budget = Math.min(24, Math.ceil(deficit * 0.1));
        for (let tries = 0; tries < 60 && budget > 0; tries++) {
            const L = cand[Math.floor(rnd() * cand.length)];
            const dx = L.cx - cam.x,
                dz = L.cz - cam.z;
            sph.center.set(L.cx, 2, L.cz);
            sph.radius = L.len / 2 + 6;
            if (
                dx * dx + dz * dz < 260 * 260 &&
                frustumOk &&
                frustum.intersectsSphere(sph)
            )
                continue;
            const lo = Math.max(6, (L.xEarly ?? 0) + 4),
                hi = Math.min(L.stopS, L.len) - 10;
            if (hi - lo < 8) continue;
            const s0 = lo + rnd() * (hi - lo);
            if (L.xcr && L.xcr.some((x) => s0 > x.stop - 12 && s0 < x.s1 + 6))
                continue;
            let ok = true,
                lead = null,
                vs = 0;
            for (const q of L.cars) {
                vs += q.v;
                if (Math.abs(q.s - s0) < q.len / 2 + 9) {
                    ok = false;
                    break;
                }
                if (q.s > s0 && !lead) lead = q;
            }
            if (
                !ok ||
                (L.cars.length > 1 && vs / L.cars.length < 1.5) ||
                (lead && lead.v < 1 && lead.s - s0 < 40)
            )
                continue;
            {
                const px = L.ax + L.dx * s0,
                    pz = L.az + L.dz * s0;
                const py =
                    L.y0 !== undefined
                        ? L.y0 + ((L.y1 - L.y0) * s0) / L.len
                        : 0;
                for (const q of cars)
                    if (
                        (q.x - px) ** 2 + (q.z - pz) ** 2 < 100 &&
                        Math.abs(q.y - py) < 3
                    ) {
                        ok = false;
                        break;
                    }
            }
            if (!ok) continue;
            const c = newCar(L, s0, 0, (L.id * 2654435761 + serial * 97) >>> 0);
            const room =
                (lead ? lead.s - lead.len / 2 : L.stopS) - (s0 + c.len / 2);
            if (room < 4) continue;
            c.v = Math.min(
                c.v0 * 0.7,
                Math.sqrt(2 * 3 * Math.max(0, room - 2)),
                lead ? lead.v + room * 0.5 : 99,
            );
            insertSorted(L.cars, c);
            cars.push(c);
            budget--;
            jStats.refill++;
        }
    };

    let time = 0;
    const tmp3 = [0, 0, 0];
    const playerObstacle = (c) => {
        const p = player.pos;
        const dx = p.x - c.x,
            dz = p.z - c.z;
        if (dx * dx + dz * dz > 2500) return null;
        if (p.y > player.ground + 2.6 || Math.abs(player.ground - c.y) > 3)
            return null;
        const fx = Math.cos(c.ry),
            fz = -Math.sin(c.ry);
        const along = dx * fx + dz * fz,
            lat = Math.abs(dx * fz - dz * fx);
        const look = Math.max(12, c.v * 2.8 + 9);

        if (
            along > 0 &&
            along < c.len / 2 + look &&
            lat < c.wid / 2 + PLAYER_R + 0.8
        ) {
            c._pAlong = along;
            c._pLat = lat;

            if (lat < c.wid / 2 + PLAYER_R + 0.3)
                return along - c.len / 2 - PLAYER_R - 1.4;
            c._pSoft = true;
        }
        return null;
    };

    const zones = new Map();
    const zoneObstacle = (c) => {
        if (!zones.size) return null;
        let best = null;
        const fx = Math.cos(c.ry),
            fz = -Math.sin(c.ry);
        for (const z of zones.values()) {
            if (z.until < time) continue;
            const dx = z.x - c.x,
                dz = z.z - c.z;
            const along = dx * fx + dz * fz,
                lat = Math.abs(dx * fz - dz * fx);
            if (
                dx * dx + dz * dz < (z.r + c.len * 0.3) ** 2 &&
                along < z.r * 0.6
            ) {
                c.inZone = true;
                return 0;
            }
            if (
                along > 0 &&
                lat < z.r + c.wid / 2 &&
                along < z.r + Math.max(25, c.v * 3 + 12)
            ) {
                const g =
                    along -
                    Math.sqrt(Math.max(0, (z.r + c.wid / 2) ** 2 - lat * lat)) -
                    c.len / 2 -
                    1.5;
                if (best === null || g < best) best = g;
            }
        }
        return best;
    };

    for (const L of links) {
        const w = L.diag?.w ?? 0;
        if (L.kind === "av" || L.kind === "dg") {
            L.latL = 0.3;
            L.latR = L.lane === 1 ? (L.kind === "dg" ? 0.45 : 0.25) : 0.35;
        } else if (L.kind === "ws") {
            L.latL = 0.22;
            L.latR = 0.22;
        } else if (L.narrow) {
            L.latL = 0.2;
            L.latR = 0.2;
        } else if (L.bridge) {
            L.latL = 0.25;
            L.latR = 0.25;
        } else if (L.diag) {
            const one = !!L.diag.oneway || (w < 12 && !L.vmap);
            L.latL = one
                ? Math.min(0.35, Math.max(0, w / 2 - 1.6))
                : Math.min(0.3, Math.max(0, (w / 2 - 2.55) / 2));
            L.latR = one ? L.latL : Math.min(0.3, Math.max(0, w / 4 - 1.5));
        } else {
            L.latL = 0.4;
            L.latR = 0.3;
        }
    }
    const lateral = (c, L, dt) => {
        c.odo += c.v * dt;
        const dS = c.s - c.len / 2,
            dE = L.len - c.s - c.len / 2;
        let f = Math.min(dS, dE) / 10;
        f = f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f);
        const shrink = Math.max(0, (c.wid - 1.9) / 2);
        const hi = Math.max(0, L.latR - shrink),
            lo = -Math.max(0, L.latL - shrink);
        let tgt =
            Math.max(
                lo,
                Math.min(
                    hi,
                    c.latB + c.latA * Math.sin(c.odo * c.latK + c.latP),
                ),
            ) * f;
        if (L.dbl)
            for (const o of L.dbl) {
                const d = Math.abs(o.s - c.s),
                    w = o.hl + c.len / 2;
                if (d > w + 10) continue;
                const ramp = d < w + 1 ? 1 : 1 - (d - w - 1) / 9,
                    need = o.hw + c.wid / 2 + 0.35;
                if (o.lat > 0) {
                    const cap = o.lat - need;
                    if (cap < tgt) tgt += (cap - tgt) * ramp;
                } else {
                    const cap = o.lat + need;
                    if (cap > tgt) tgt += (cap - tgt) * ramp;
                }
            }
        const d = tgt - c.lat,
            st = Math.sign(d) * Math.min(Math.abs(d), 0.8 * dt);
        c.lat += st;
        c.latV = st / Math.max(dt, 1e-4);
        c.wob += dt * 0.45;
        if (c.lcDur > 0) {
            c.lcT += dt;
            const u = Math.min(1, c.lcT / c.lcDur),
                sm = u * u * (3 - 2 * u),
                n = c.lc0 * (1 - sm);
            c.latV += (n - c.lc) / Math.max(dt, 1e-4);
            c.lc = n;
            if (u >= 1) {
                c.lc = 0;
                c.lcDur = 0;
            }
        }
        c.yaw =
            Math.max(-0.2, Math.min(0.2, c.latV / Math.max(c.v, 2.5))) +
            0.004 * Math.sin(c.wob) * f;
    };

    const laneChange = (c, L, arr, i) => {
        c.lcCool = 2.5 + c.rng() * 5;
        if (
            L.kind === "st" ||
            c.lcDur > 0 ||
            (c.reg && c.reg.length) ||
            c.wait ||
            c.s < 20 ||
            L.len - c.s < 45 ||
            c.v < 3
        )
            return false;
        for (const X of L.xm)
            if (X.base > c.s - 25 && X.base < c.s + 50) return false;
        const A2 = L.alt.link;
        if (!A2.active || A2.blockS < Infinity || A2.noSpawn) return false;
        const lead = arr[i + 1],
            slow = lead && lead.v < c.v0 * 0.6 && lead.s - c.s < 40;
        if (!slow && c.rng() > 0.12) return false;
        let nl = null,
            nf = null;
        for (const q of A2.cars) {
            if (q.s >= c.s) {
                nl = q;
                break;
            }
            nf = q;
        }
        if (
            nl &&
            (nl.s - nl.len / 2 - (c.s + c.len / 2) <
                Math.max(14, c.v * 1.5 + 6) ||
                (slow && nl.v < c.v))
        )
            return false;
        if (
            nf &&
            (nf.conn ||
                c.s - c.len / 2 - (nf.s + nf.len / 2) <
                    Math.max(
                        12,
                        nf.v * 1.7 + 6 + Math.max(0, nf.v - c.v) * 2.5,
                    ))
        )
            return false;
        const of = arr[i - 1];
        if (
            of &&
            c.s - c.len / 2 - (of.s + of.len / 2) <
                10 + Math.max(0, of.v - c.v) * 3
        )
            return false;
        if (A2.dbl)
            for (const o of A2.dbl)
                if (o.s > c.s - 15 && o.s < c.s + 60) return false;
        arr.splice(i, 1);
        insertSorted(A2.cars, c);
        c.lc0 = c.lc = (L.ax - A2.ax) * -A2.dz + (L.az - A2.az) * A2.dx;
        c.lcT = 0;
        c.lcDur = 3.2 + c.rng() * 1.6;
        c.lcFrom = L;
        c.link = A2;
        (L.lcOut ??= []).push(c);
        c.pre = null;
        c.next = chooseNext(c, A2);
        jStats.lc++;
        return true;
    };
    const step = (dt, far = null) => {
        const lightAv = phase(time, "av"),
            lightSt = phase(time, "st");
        for (const L of links) {
            if (!L.active || (far !== null && L.far !== far)) continue;
            const arr = L.cars;
            for (let i = 1; i < arr.length; i++) {
                const c = arr[i];
                let j = i - 1;
                while (j >= 0 && arr[j].s > c.s) {
                    arr[j + 1] = arr[j];
                    j--;
                }
                arr[j + 1] = c;
            }
        }
        for (const L of links) {
            if (!L.active || (far !== null && L.far !== far)) continue;
            const arr = L.cars,
                n = arr.length;
            const light = L.signal
                ? L.mapSig
                    ? mapPhase(time, L.axis)
                    : L.axis === "av"
                      ? lightAv
                      : lightSt
                : 2;
            for (let i = n - 1; i >= 0; i--) {
                const c = arr[i];
                const front = c.s + c.len / 2;
                let gap = 1e4,
                    vL = c.v;

                let li = i + 1;
                if (c.conn)
                    while (li < n && arr[li].conn && arr[li].conn !== c.conn)
                        li++;
                let why = "free",
                    whyC = null;
                if (li < n) {
                    const l = arr[li];
                    gap = l.s - l.len / 2 - front;
                    vL = l.v;
                    why = "lead";
                    whyC = l;
                } else if (c.next && c.next.link.active && !c.conn) {
                    const N = c.next.link,
                        C = getConn(L, c.next);
                    for (let k = 0; k < N.cars.length; k++) {
                        const l = N.cars[k];
                        if (l.conn && l.conn !== C) continue;
                        gap = L.len - front + C.len + (l.s - l.len / 2);
                        vL = l.v;
                        why = "next";
                        whyC = l;
                        break;
                    }
                }
                let v0 = c.v0;
                c._red = false;
                if (c.lcDur > 0 && Math.abs(c.lc) > 1.2 && c.lcFrom) {
                    for (const q of c.lcFrom.cars)
                        if (q.s > c.s) {
                            const g = q.s - q.len / 2 - front;
                            if (g < gap) {
                                gap = g;
                                vL = q.v;
                                why = "lcold";
                                whyC = q;
                            }
                            break;
                        }
                }
                if (L.lcOut)
                    for (let k = L.lcOut.length - 1; k >= 0; k--) {
                        const q = L.lcOut[k];
                        if (
                            q.dead ||
                            q.lcDur <= 0 ||
                            Math.abs(q.lc) <= 1.2 ||
                            q.lcFrom !== L
                        ) {
                            L.lcOut.splice(k, 1);
                            continue;
                        }
                        if (q !== c && q.s > c.s) {
                            const g = q.s - q.len / 2 - front;
                            if (g < gap) {
                                gap = g;
                                vL = q.v;
                                why = "lcnew";
                                whyC = q;
                            }
                        }
                    }
                if (L.blockS < Infinity && c.s < L.blockS + 3) {
                    const d = L.blockS - front;
                    if (d > -2 && d < gap) {
                        gap = Math.max(0.05, d);
                        vL = 0;
                    }
                }
                if (!c.conn) {
                    const dEnd = L.len - front;
                    if (c.next && c.next.turn !== "S")
                        v0 = Math.min(v0, 4.8 + 0.3 * Math.max(0, dEnd));
                    const dStop = L.stopS - front;
                    if (L.signal && dStop > -0.4) {
                        let stop =
                            light === 0 ||
                            (light === 1 && dStop > c.v * 1.3 + 1.5);
                        if (!stop && c.next) {
                            const xw = c.next.link.xwStart,
                                xe = L.xwEnd;
                            if ((xw && xw.peds > 0) || (xe && xe.peds > 0))
                                stop = true;
                        }
                        if (
                            stop &&
                            c.next &&
                            c.reg &&
                            jx.holds(c, jx.moveFor(L, c.next))
                        )
                            stop = false;
                        if (stop) {
                            if (dStop < gap) {
                                gap = dStop;
                                vL = 0;
                                why = "red";
                            }
                        }
                        c._red = stop && dStop < 30;
                    }
                    if (L.xst) {
                        const xl = L.axis === "av" ? lightAv : lightSt;
                        if (xl !== 2)
                            for (let xi = 0; xi < L.xst.length; xi++) {
                                const xs = L.xst[xi],
                                    d = xs - front;
                                if (d <= -0.4) continue;
                                if (c.reg && L.xm[xi] && jx.holds(c, L.xm[xi]))
                                    break;
                                if (
                                    (xl === 0 || d > c.v * 1.3 + 1.5) &&
                                    d < gap
                                ) {
                                    gap = Math.max(0.05, d);
                                    vL = 0;
                                    why = "xred";
                                }
                                break;
                            }
                    }
                    if (!c.next && dEnd < 30) {
                      void 0;
                    }
                } else if (c.conn.turn !== "S") v0 = Math.min(v0, 5.5);
                {
                    const jr = jx.car(
                        c,
                        front,
                        i + 1 < n ? arr[i + 1] : null,
                        time,
                        sigStop,
                        redFor,
                        chooseNext,
                    );
                    if (jr.gap < gap) {
                        gap = Math.max(0.05, jr.gap);
                        vL = jr.vL;
                        why = jr.why;
                        whyC = jr.whyC;
                    }
                }
                c._why = why;
                c._whyC = whyC;

                if (
                    c.creepT > 0 ||
                    (c.stillT > 12 &&
                        whyC &&
                        !c._red &&
                        (c.creepT = inCycle(c)))
                ) {
                    c.creepT -= dt;
                    const free = freeAhead(c);
                    if (free > 0.3) {
                        gap = free;
                        vL = 0;
                        v0 = Math.min(v0, 2);
                        why = "creep";
                        _whyC = null;
                        c._why = why;
                        c._whyC = null;
                    }
                }
                c._pAlong = null;
                c._pSoft = false;
                c.inZone = false;
                const zo = zoneObstacle(c);
                if (zo !== null && zo < gap) {
                    gap = Math.max(0.05, zo);
                    vL = 0;
                }
                const po = playerObstacle(c);
                if (c._pSoft)
                    v0 = Math.min(
                        v0,
                        2.2 + Math.max(0, c._pAlong - c.len / 2 - 6) * 0.35,
                    );
                let blocked = false;
                if (po !== null && po < gap) {
                    gap = Math.max(0.05, po);
                    vL = 0;
                    blocked = true;
                }
                const dv = c.v - vL;
                const sStar =
                    c.dS0 +
                    Math.max(
                        0,
                        c.v * c.dTH + (c.v * dv) / (2 * Math.sqrt(c.dA * B)),
                    );
                let acc =
                    c.dA *
                    (1 - (c.v / v0) ** 4 - (sStar / Math.max(gap, 0.1)) ** 2);

                acc = Math.max(
                    blocked && po < (c.v * c.v) / 12 + 1 ? -13 : -9,
                    Math.min(c.dA, acc),
                );
                c.acc = acc;
                c.v = Math.max(0, c.v + acc * dt);

                if (
                    c._pAlong !== null &&
                    c._pLat < c.wid / 2 + PLAYER_R + 0.1
                ) {
                    const room = c._pAlong - c.len / 2 - PLAYER_R - 0.25;
                    if (c.v * dt > room) {
                        c.v = 0;
                        c.acc = -9;
                    }
                }
                c.s += c.v * dt;
                if (!c.conn) {
                    if (!L.far || c.lcDur > 0) lateral(c, L, dt);
                } else {
                    c.lat = 0;
                    c.lc = 0;
                    c.latV = 0;
                    c.yaw = 0;
                }

                if (c.v < 0.1 && !c._red) {
                    c.stuckT += dt;
                    if (c.stuckT > 60 && !c._vis) {
                        c.dead = true;
                        jStats.broken++;
                    }
                } else c.stuckT = 0;
                c.stillT = c.v < 0.3 ? c.stillT + dt : 0;
                c.brake = acc < -0.6 || c.v < 0.4 ? 1 : 0;
                if (c.inZone) {
                    c.v = Math.max(0, c.v - 12 * dt);
                    c.brake = (time * 1.6) % 1 < 0.5 ? 1 : 0;
                }
                c.pitch +=
                    ((acc < -1.5 ? Math.min(0.025, -acc * 0.004) : 0) -
                        c.pitch) *
                    Math.min(1, dt * 6);

                if (blocked && c.v < 1.0 && gap < 6) {
                    c.blockT += dt;
                    if (c.blockT > 0.7 && time > c.honkT) {
                        c.honkT = time + 2.2 + c.rng() * 3;
                        const d = Math.hypot(
                            player.pos.x - c.x,
                            player.pos.z - c.z,
                        );
                        horn(d, VTYPES[c.type].big, c.x, c.z, c.y ?? 0);
                        events.push({ type: "honk", x: c.x, z: c.z, t: time });
                    }
                } else c.blockT = Math.max(0, c.blockT - dt);
            }
        }

        for (const L of links) {
            if (!L.active || (far !== null && L.far !== far)) continue;
            const arr = L.cars;
            for (let i = arr.length - 1; i >= 0; i--) {
                const c = arr[i];
                if (c.dead) {
                    arr.splice(i, 1);
                    continue;
                }
                if (
                    L.alt &&
                    !L.far &&
                    !c.conn &&
                    (c.lcCool -= dt) < 0 &&
                    laneChange(c, L, arr, i)
                )
                    continue;
                if (c.conn && c.s >= 0) {
                    c.conn = null;
                    c.next =
                        c.pre && c.pre.L === L ? c.pre.opt : chooseNext(c, L);
                    c.pre = null;
                }
                if (!c.conn && c.s > L.len) {
                    arr.splice(i, 1);
                    const nx = c.next;
                    if (
                        !nx ||
                        !nx.link.active ||
                        (nodes[L.to].deadEnd && !c._vis)
                    ) {
                        c.dead = true;
                        continue;
                    }
                    const C = getConn(L, nx);
                    const M = jx.moveFor(L, nx);
                    c.via = M;
                    jx.register(c, M);
                    c.conn = C;
                    c.link = nx.link;
                    c.s = c.s - L.len - C.len;
                    insertSorted(nx.link.cars, c);
                }
            }
        }

        for (const L of links) {
            if (
                !L.active ||
                (far !== null && L.far !== far) ||
                cars.length >= MAX_CARS
            )
                continue;
            const fromN = nodes[L.from];
            let fed = false;
            for (const I of fromN.inLinks)
                if (I.active) {
                    fed = true;
                    break;
                }
            if (fed) continue;
            if (L.blockS < Infinity) continue;
            const first = L.cars[0];
            if (!first || first.s - first.len / 2 > (L.spawnGap || 20) + 7.5) {
                const c = newCar(
                    L,
                    0,
                    0,
                    (L.id * 2654435761 + serial * 97) >>> 0,
                );
                c.s = c.len / 2;
                c.v = c.v0 * 0.8;
                if (first)
                    c.v = Math.min(
                        c.v,
                        first.v +
                            Math.max(0, first.s - first.len / 2 - c.len - 2) *
                                0.6,
                    );
                L.cars.unshift(c);
                cars.push(c);
                L.spawnGap = (L.kind === "st" ? 12 : 8) + c.rng() * 35;
                {
                    if (!(L.plat > 0))
                        L.plat =
                            (L.kind === "st" ? 2 : 1) +
                            Math.floor(c.rng() * (L.kind === "st" ? 5 : 4));
                    L.spawnGap =
                        --L.plat > 0
                            ? 2.5 + c.rng() * 5
                            : L.kind === "st"
                              ? 30 + c.rng() * 70
                              : 50 + c.rng() * 140;
                }
            }
        }
        if (cars.some((c) => c.dead)) cars = cars.filter((c) => !c.dead);
        jx.tick(time);
    };
    const getConn = (L, o) => {
        let C = L.conn.get(o.link.id);
        if (!C) {
            C = connector(L, o.link, o.turn);
            L.conn.set(o.link.id, C);
        }
        return C;
    };

    const jx = createJunctions(roads, getConn);
    const jStats = { broken: 0, lc: 0, refill: 0, drain: 0 };
    const camPos = new THREE.Vector3(1e9, 0, 0);
    const axisLight = (ax, L = null) =>
        L && L.mapSig ? mapPhase(time, ax) : phase(time, ax);
    const sigStop = (c, M, d) => {
        const L = M.kind === "x" ? M.L : M.inL;
        if (M.kind === "x" || L.signal) {
            const l = axisLight(L.axis, L);
            if (l === 0 || (l === 1 && d > c.v * 1.3 + 1.5)) return true;
        }
        if (M.kind === "c" && L.signal) {
            const xw = M.outL.xwStart,
                xe = L.xwEnd;
            if ((xw && xw.peds > 0) || (xe && xe.peds > 0)) return true;
        }
        return false;
    };
    const redFor = (o, M) =>
        (M.kind === "x" || M.inL.signal) &&
        axisLight(
            (M.kind === "x" ? M.L : M.inL).axis,
            M.kind === "x" ? M.L : M.inL,
        ) === 0;

    for (const L of links)
        L.mapSig = !!(
            L.signal &&
            ((L.vmap && !nodes[L.to].av) || nodes[L.to].bridgeT)
        );
    const tmpA = [0, 0, 0],
        tmpB = [0, 0, 0];

    const inCycle = (c) => {
        let q = c._whyC,
            k = 0,
            lo = c.id;
        while (q && k++ < 16) {
            if (q === c) return lo === c.id ? 3 : 0;
            if (q.id < lo) lo = q.id;
            q = q._whyC;
        }
        return 0;
    };

    const freeAhead = (c) => {
        const near = [];
        for (const o of cars)
            if (o !== c && Math.abs(o.x - c.x) < 20 && Math.abs(o.z - c.z) < 20)
                near.push(o);
        const L = c.link,
            C = c.conn;
        let ok = 0;
        for (let d = 0.5; d <= 4; d += 0.5) {
            let x, z, h;
            if (C) {
                const u = c.s + d + C.len;
                if (u > C.len) break;
                connAt(C, u, tmpA);
                x = tmpA[0];
                z = tmpA[1];
                h = tmpA[2];
            } else {
                const s2 = c.s + d;
                if (s2 > L.len) break;
                x = L.ax + L.dx * s2;
                z = L.az + L.dz * s2;
                h = L.heading;
            }
            const fx = Math.cos(h),
                fz = Math.sin(h);
            let hit = false;
            for (const o of near) {
                const ofx = Math.cos(o.ry),
                    ofz = -Math.sin(o.ry),
                    dx = o.x - x,
                    dz = o.z - z;
                for (const [ax, az] of [
                    [fx, fz],
                    [-fz, fx],
                    [ofx, ofz],
                    [-ofz, ofx],
                ]) {
                    const ra =
                        (c.len / 2 + 0.3) * Math.abs(fx * ax + fz * az) +
                        (c.wid / 2 + 0.2) * Math.abs(-fz * ax + fx * az);
                    const rb =
                        (o.len / 2) * Math.abs(ofx * ax + ofz * az) +
                        (o.wid / 2) * Math.abs(-ofz * ax + ofx * az);
                    if (Math.abs(dx * ax + dz * az) > ra + rb) {
                        hit = false;
                        break;
                    }
                    hit = true;
                }
                if (hit) break;
            }
            if (hit) break;
            ok = d;
        }
        return ok;
    };
    const pathPt = (C, Lin, Lout, q, out) => {
        if (q < 0 && Lin) {
            const s = Lin.len + q;
            out[0] = Lin.ax + Lin.dx * s;
            out[1] = Lin.az + Lin.dz * s;
            return out;
        }
        if (q > C.len) {
            const s = q - C.len;
            out[0] = Lout.ax + Lout.dx * s;
            out[1] = Lout.az + Lout.dz * s;
            return out;
        }
        return connAt(C, Math.max(0, q), out);
    };
    const placeCar = (c) => {
        const L = c.link;
        if (c.conn) {
            const C = c.conn,
                u = c.s + C.len;
            connAt(C, u, tmp3);
            c.x = tmp3[0];
            c.z = tmp3[1];

            const h = c.len * 0.3,
                Lin = c.via && c.via.C === C ? c.via.inL : null;
            pathPt(C, Lin, L, u - h, tmpA);
            pathPt(C, Lin, L, u + h, tmpB);
            c.ry = -Math.atan2(tmpB[1] - tmpA[1], tmpB[0] - tmpA[0]);
            const ya = Lin && Lin.y1 !== undefined ? Lin.y1 : 0,
                yb = L.y0 !== undefined ? L.y0 : 0;
            c.y = ya + (yb - ya) * Math.max(0, Math.min(1, u / C.len));
            c.gp = Math.atan((yb - ya) / Math.max(1, C.len));
        } else {
            const o = c.lat + c.lc;
            c.x = L.ax + L.dx * c.s - L.dz * o;
            c.z = L.az + L.dz * c.s + L.dx * o;
            c.ry = -L.heading - c.yaw;
            if (L.y0 !== undefined) {
                c.y =
                    L.y0 +
                    (L.y1 - L.y0) * Math.max(0, Math.min(1, c.s / L.len));
                c.gp = Math.atan(L.grade);
            } else {
                c.y = 0;
                c.gp = 0;
            }
        }
    };

    const near = [];
    const refreshNear = () => {
        near.length = 0;
        const p = player.pos;
        for (const c of cars)
            if (Math.abs(c.x - p.x) < 40 && Math.abs(c.z - p.z) < 40)
                near.push(c);
        for (const L of links) {
            if (!L.parked || !L.parked.length) continue;
            if (
                Math.abs(L.cx - p.x) > L.len / 2 + 50 ||
                Math.abs(L.cz - p.z) > L.len / 2 + 50
            )
                continue;
            for (const c of L.parked)
                if (Math.abs(c.x - p.x) < 40 && Math.abs(c.z - p.z) < 40)
                    near.push(c);
        }
    };
    const _push = new THREE.Vector3(),
        _vel = new THREE.Vector3();
    const collideDynamic = (pos, radius = 0.4, height = 1.8) => {
        let hit = false,
            grounded = false,
            groundY = -Infinity,
            vel = null;
        let px = pos.x,
            pz = pos.z;
        const list = near.length
            ? near
            : cars.filter(
                  (c) =>
                      Math.abs(c.x - pos.x) < 20 && Math.abs(c.z - pos.z) < 20,
              );
        for (const c of list) {
            const dx = px - c.x,
                dz = pz - c.z;
            if (dx * dx + dz * dz > (c.len / 2 + radius + 1) ** 2) continue;
            const fx = Math.cos(c.ry),
                fz = -Math.sin(c.ry);
            const lx = dx * fx + dz * fz,
                lz = -dx * fz + dz * fx;
            const hl = c.len / 2 - 0.05,
                hw = c.wid / 2;
            const base = c.parked ? 0 : c.y,
                roof = base + c.h;
            if (
                pos.y > roof - 0.35 &&
                pos.y < roof + 0.7 &&
                Math.abs(lx) < hl + radius * 0.3 &&
                Math.abs(lz) < hw + radius * 0.3
            ) {
                if (roof > groundY) {
                    groundY = roof;
                    grounded = true;
                    vel = c.parked ? null : _vel.set(fx * c.v, 0, fz * c.v);
                }
                hit = true;
                continue;
            }
            if (pos.y >= roof - 0.35 || pos.y + height < base + 0.1) continue;
            const cx = Math.max(-hl, Math.min(hl, lx)),
                cz = Math.max(-hw, Math.min(hw, lz));
            const ox = lx - cx,
                oz = lz - cz;
            const d = Math.hypot(ox, oz);
            let pushL,
                nlx = 0,
                nlz = 0;
            if (d > 1e-4) {
                if (d >= radius) continue;
                pushL = radius - d;
                nlx = ox / d;
                nlz = oz / d;
            } else {
                const ex = hl - Math.abs(lx),
                    ez = hw - Math.abs(lz);
                if (ex < ez) {
                    pushL = ex + radius;
                    nlx = Math.sign(lx) || 1;
                } else {
                    pushL = ez + radius;
                    nlz = Math.sign(lz) || 1;
                }
            }
            const wx = (nlx * fx - nlz * fz) * pushL,
                wz = (nlx * fz + nlz * fx) * pushL;
            px += wx;
            pz += wz;
            hit = true;
            if (!c.parked && c.v > 0.5) vel = _vel.set(fx * c.v, 0, fz * c.v);
        }
        if (!hit) return null;
        _push.set(px - pos.x, 0, pz - pos.z);
        const out = { push: _push };
        if (grounded) {
            out.grounded = true;
            out.groundY = groundY;
        }
        if (vel) out.velocity = vel;
        return out;
    };

    const frustum = new THREE.Frustum(),
        pv = new THREE.Matrix4(),
        sph = new THREE.Sphere();
    let frustumOk = false,
        renderN = 0;
    const events = [];
    let proxyOn = false;
    const render = (camera, clear) => {
        if (!proxyOn && csmShared.proxyShadows && !perf2Off("noproxy")) {
            proxyOn = true;
            for (const t in tiers)
                if (tiers[t].proxy) {
                    tiers[t].hi.mesh.userData.maxCascade = 1;
                    tiers[t].low.mesh.userData.maxCascade = 1;
                }
        }

        const farSkip = (renderN++ & 1) === 1;
        for (const k of all) if (!(farSkip && k.farTier)) k.begin();
        cao.begin();
        hlp.begin();
        const clOn = cityLights.enabled && nightK.value > 0.01;
        clN = 0;
        const cp = camera.position;
        camera.updateMatrixWorld();
        pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(pv);
        frustumOk = true;
        const emit = (c, moving) => {
            const dx = c.x - cp.x,
                dz = c.z - cp.z,
                d2 = dx * dx + dz * dz;
            if (clear) {
                const along = dx * clear.dir.x + dz * clear.dir.z,
                    lat = Math.abs(dx * clear.dir.z - dz * clear.dir.x);
                if (
                    along > -6 &&
                    along < clear.len &&
                    lat < clear.half + c.len * 0.3
                )
                    return;
            }
            const lit = moving || c.haz !== undefined;
            if (clOn && lit && d2 < CL_R * CL_R && clN < CL_CAP) {
                const f = c.len * 0.5 + 15;
                sph.center.set(
                    c.x + Math.cos(c.ry) * f,
                    1.5 + (moving ? c.y : 0),
                    c.z - Math.sin(c.ry) * f,
                );
                sph.radius = 18;
                if (d2 < 400 || frustum.intersectsSphere(sph)) {
                    clCar[clN] = c;
                    clD[clN++] = d2;
                }
            }
            const tier =
                d2 < HI_D * HI_D ? "hi" : d2 < LOW_D * LOW_D ? "low" : "far";
            if (farSkip && tier === "far") {
                if (moving) c._vis = true;
                return;
            }
            if (moving) c._vis = false;
            if (d2 > 1600) {
                sph.center.set(c.x, 1.5 + (moving ? c.y : 0), c.z);
                sph.radius = c.len * 0.6 + 1;
                if (!frustum.intersectsSphere(sph)) return;
            }
            if (moving) c._vis = true;
            const cy = moving ? c.y : 0,
                cpitch = moving ? c.pitch + c.gp : 0;
            tiers[c.type][tier].push(
                c.x,
                cy,
                c.z,
                c.ry,
                c.color,
                moving
                    ? c.brake
                    : c.haz
                      ? (time * 1.5 + c.x * 0.01) % 1 < 0.5
                          ? 1
                          : 0
                      : lit
                        ? 0
                        : -1,
                cpitch,
                (c.adSeed ??= Math.random()),
            );
            if (tier !== "far" && proxyOn)
                tiers[c.type].proxy?.push(
                    c.x,
                    cy,
                    c.z,
                    c.ry,
                    c.color,
                    0,
                    cpitch,
                );
            if (cy > 0.5) return;
            if (tier !== "far")
                cao.push(
                    c.x,
                    c.z,
                    c.ry,
                    VTYPES[c.type].len,
                    VTYPES[c.type].wid,
                );
            if (moving && d2 < 250 * 250 && !clOn)
                hlp.push(c.x, c.z, c.ry, VTYPES[c.type].len);
        };
        for (const c of cars) {
            placeCar(c);
            emit(c, true);
        }
        for (const L of links) {
            if (!L.parked || !L.parked.length) continue;
            const dx = L.cx - cp.x,
                dz = L.cz - cp.z;
            if (dx * dx + dz * dz > (PARK_R + L.len / 2) ** 2) continue;
            for (const c of L.parked) emit(c, false);
        }
        for (const k of all) if (!(farSkip && k.farTier)) k.end();
        cao.end();
        hlp.end();
    };

    let frameN = 0,
        lastDt = 0,
        acc4 = 0;
    const api = {
        cars: () => cars,
        links,
        roads,
        events,
        VTYPES,
        _dbg: { player, playerObstacle },
        _jx: jx,
        _time: () => time,
        ms: {
            step: 0,
            render: 0,
            stream: 0,
            streamMax: 0,
            stepMax: 0,
            renderMax: 0,
        },
        setPlayer(pos, vel, groundY) {
            player.pos.copy(pos);
            if (vel) player.vel.copy(vel);
            player.t = time;
            player.ground = groundY ?? 0;
        },
        collideDynamic,

        zone(key, pos, r = 18, active = true, ttl = 1e9) {
            if (!active) {
                zones.delete(key);
                return;
            }
            zones.set(key, { x: pos.x, z: pos.z, r, until: time + ttl });
        },
        zones,
        setDensity(k) {
            densityScale = Math.max(0, k);
        },
        alarm(pos, radius = 30) {
            zones.set(
                "alarm:" +
                    Math.round(pos.x / 10) +
                    "," +
                    Math.round(pos.z / 10),
                {
                    x: pos.x,
                    z: pos.z,
                    r: Math.min(radius, 22),
                    until: time + 8,
                },
            );
            for (const c of cars) {
                if (Math.hypot(c.x - pos.x, c.z - pos.z) < radius) {
                    c.v *= 0.3;
                    if (time > c.honkT) {
                        c.honkT = time + 3;
                        horn(
                            Math.hypot(player.pos.x - c.x, player.pos.z - c.z),
                            VTYPES[c.type].big,
                            c.x,
                            c.z,
                            c.y ?? 0,
                        );
                    }
                }
            }
        },
        update(dt, camera, t, clear = null) {
            time = t;
            const cp = camera.position;
            camPos.copy(cp);
            streamT -= dt;
            if (streamT <= 0 || cp.distanceToSquared(lastCam) > 225) {
                const ts0 = performance.now();
                stream(cp);
                lastCam.copy(cp);
                streamT = 0.3;
                const d = performance.now() - ts0;
                api.ms.stream += (d - api.ms.stream) * 0.2;
                if (d > api.ms.streamMax) api.ms.streamMax = d;
            }
            const sub = dt > 1 / 24 ? 2 : 1;
            const tp0 = performance.now();
            for (let i = 0; i < sub; i++) step(dt / sub, 0);
            frameN++;
            if (frameN % 2 === 0) step(Math.min(0.1, dt + lastDt), 1);
            acc4 += dt;
            if (frameN % 4 === 0) {
                step(Math.min(0.2, acc4), 2);
                acc4 = 0;
            }
            lastDt = dt;
            const tp1 = performance.now();
            render(camera, clear);
            api.ms.step += (tp1 - tp0 - api.ms.step) * 0.05;
            api.ms.render += (performance.now() - tp1 - api.ms.render) * 0.05;
            api.ms.stepMax = Math.max(api.ms.stepMax, tp1 - tp0);
            api.ms.renderMax = Math.max(
                api.ms.renderMax,
                performance.now() - tp1,
            );
            refreshNear();
            while (events.length && time - events[0].t > 3) events.shift();
        },
        stats() {
            let active = 0;
            for (const L of links) if (L.active) active++;
            let drawn = 0;
            for (const k of all)
                if (!k.mesh.userData.smallCasters) drawn += k.n;
            return {
                cars: cars.length,
                activeLinks: active,
                drawn,
                junction: {
                    ...jx.stats(),
                    broken: jStats.broken,
                    laneChanges: jStats.lc,
                    refill: jStats.refill,
                    drain: jStats.drain,
                    want: jStats.want,
                    have: jStats.have,
                },
            };
        },
    };
    void rnd;
    void hash2;
    void G;
    void TRUCKC;
    return api;
}
