// @ts-nocheck
/**
 * Assembles and updates the complete procedural city world.
 *
 * @module world-city
 * @version 1.0.0
 * @file src/world/city.ts
 * @since 0.0.1
 * @description Coordinates layout generation, buildings, ground, props, landmarks, NPC systems, and per-frame world updates.
 */
import * as THREE from "three";
import {
    G,
    buildBlocks,
    streetsAt,
    inPark,
    roadRects,
    avenues,
    AV_NAMES,
    LAND_POLY,
    SHORE_Z,
    SHORE_W,
    SHORE_E,
    PARK_WATER,
    diagRoadPolys,
    DIAG_SEGS,
    diagD,
    _diagS,
    _VMAP,
    MAPS,
    BATTERY,
    vmapRoadPolys,
    polyArea,
    inConvexPoly,
    islands,
    inCurbCut,
    LINCOLN,
} from "./layout.ts";
import { buildFarShore, FAR_LANDS } from "./farshore.ts";
import {
    buildBridges,
    approachRects,
    bridgeLimits,
    bridgeDeckY,
    bridgeKeepOuts,
} from "./bridges.ts";
import { buildHinterland } from "./horizon.ts";
import { buildBoats } from "./boats.ts";
import { buildHighways } from "./highway.ts";

import { buildWetBands } from "./water.ts";
import { landmarkReserves, buildStandalone } from "./landmarks.ts";
import {
    timesSquareReserves,
    buildTimesSquare,
    tsTrimTrees,
} from "./timessq.ts";
import { loadCityTextures } from "./textures.ts";
import { createFacadeMaterial, STYLE, LAYER } from "./facade.ts";
import { buildHero } from "./hero.ts";
import {
    generateBuildings,
    createDetailMaterial,
    dressSquares,
} from "./buildings.ts";
import { buildGround, terrainHeight, PIERS } from "./ground.ts";
import {
    CollisionGrid,
    makeQueries,
    collisionDebugLines,
    fitInstancedSolids,
} from "./collision.ts";
import { addPropAnchors, createGeoDebug } from "./zippoints.ts";
import { buildProps } from "./props.ts";
import { buildTrees, meadowDist } from "./trees.ts";
import { buildPark } from "./park.ts";
import { buildTraffic, loadVehicleModels } from "./vehicles.ts";
import { buildPeds } from "./peds.ts";
import { buildFlags } from "./flags.ts";
import { buildRooftops } from "./rooftops.ts";
import { buildSignage } from "./signage.ts";
import { buildNeon } from "./neon.ts";
import { attachLife } from "./npc/life.ts";
import { applyDistanceFade } from "./pool.ts";
import { batchTiles } from "./tilebatch.ts";

export async function buildCity({ scene, renderer }) {
    const t0 = performance.now();
    const boot = globalThis.__boot;
    await boot?.stage("tex");
    const T = await loadCityTextures(renderer);
    const facadeMat = createFacadeMaterial(T);
    const detailMat = createDetailMaterial(T);
    applyDistanceFade(detailMat, 320, 450);

    const TT = [],
        tick = async (n, next) => {
            TT.push(n + " " + (performance.now() - t0).toFixed(0));
            if (next) await boot?.stage(next);
        };
    await tick("tex", "gen");
    const blocks = buildBlocks();

    const HERO_RECT = { x0: 266, z0: -620, x1: 300, z1: -580 };
    const gen = generateBuildings(blocks, 1234, {
        exclude: [HERO_RECT, ...approachRects()],
        reserve: [
            ...landmarkReserves().filter((r) => !/^ts[A-Z]/.test(r.name)),
            ...timesSquareReserves(),
            ...lincolnReserves(),
        ],
        force: [
            {
                x: -232,
                z: 552,
                arch: () => ({
                    type: "loft",
                    style: STYLE.PUNCHED,
                    layer: LAYER.LIME,
                    base: LAYER.LIME,
                    floorH: 3.7,
                    bayW: 2.1,
                    winW: 0.58,
                    winH: 0.62,
                    gH: 5.6,
                    height: 5.6 + 15 * 3.7,
                    tint: [1.02, 0.97, 0.88],
                    cornice: true,
                    lintel: 0,
                    waterTower: false,
                    fireEscape: false,
                    margin: 1.0,
                    resid: 0,
                }),
            },
            {
                x: -232,
                z: 568,
                arch: () => ({
                    type: "loft",
                    style: STYLE.PUNCHED,
                    layer: LAYER.RED,
                    base: LAYER.LIME,
                    floorH: 3.6,
                    bayW: 2.3,
                    winW: 0.62,
                    winH: 0.6,
                    gH: 5.4,
                    height: 5.4 + 9 * 3.6,
                    tint: [0.95, 0.9, 0.88],
                    cornice: true,
                    lintel: 2,
                    waterTower: true,
                    fireEscape: false,
                    margin: 0.9,
                    resid: 0,
                }),
            },
            {
                x: -232,
                z: 600,
                arch: () => ({
                    layer: LAYER.BUFF,
                    base: LAYER.LIME,
                    style: STYLE.PUNCHED,
                    type: "loft",
                }),
            },
            {
                x: -232,
                z: 520,
                arch: () => ({
                    layer: LAYER.BROWN,
                    base: LAYER.LIME,
                    style: STYLE.PUNCHED,
                    type: "loft",
                }),
            },
        ],
    });
    await tick("gen", "build");
    const sqd = dressSquares(gen, blocks);
    console.log("[city] (layout2 r4) square dressing", JSON.stringify(sqd));
    const heroRect = gen.excluded[0]
        ? { ...gen.excluded[0], x0: HERO_RECT.x0 }
        : HERO_RECT;
    const root = new THREE.Group();
    root.name = "city";
    scene.add(root);
    buildStandalone({ scene: root, gen, T });
    buildTimesSquare({ scene: root, gen });
    const rooftops = await buildRooftops({
        scene: root,
        gen,
        facadeMat,
        T,
        renderer,
        extraRoofs: [{ rect: heroRect, H: 96 }],
    });
    const signage = buildSignage({ scene: root, gen });
    const tileMeshes = [];

    const facG = [],
        lodG = [],
        detG = [];
    for (const t of gen.tiles.values()) {
        const i = tileMeshes.length;
        facG[i] = t.fac.build();
        lodG[i] = t.lod.build();
        detG[i] = t.det.v ? t.det.build({ part: true }) : null;
        tileMeshes.push({
            i,
            mesh: !!detG[i],
            fac: !!facG[i],
            lod: !!lodG[i],
            cx: t.cx,
            cz: t.cz,
            far: 900,
            near: true,
        });

        t.fac = t.lod = t.det = null;
    }
    const ctr = tileMeshes.map((t) => [t.cx, t.cz]);
    const facB = batchTiles(
        facG,
        facadeMat,
        "facade",
        { castShadow: true, receiveShadow: true, merge: false },
        ctr,
    );
    const lodB = batchTiles(
        lodG,
        facadeMat,
        "facadeLod",
        { castShadow: true, receiveShadow: true },
        ctr,
    );
    const detB = batchTiles(
        detG,
        detailMat,
        "detail",
        { castShadow: true, receiveShadow: true, merge: false },
        ctr,
    );
    for (const b of [facB, lodB, detB]) for (const m of b.meshes) root.add(m);
    for (const tm of tileMeshes) if (tm.lod) lodB.setVisible(tm.i, false);
    await tick("tiles", "ground");
    const hero = buildHero({
        scene: root,
        rect: heroRect,
        facadeMat,
        renderer,
        solids: gen.solids,
        zips: gen.zips,
    });
    gen.boxes.push(hero.box);
    gen.footprints.push(hero.footprint);
    const ground = buildGround({
        scene: root,
        T,
        blocks,
        facadeMat,
        solids: gen.solids,
        zips: gen.zips,
        renderer,
    });
    buildPark({
        scene: root,
        facadeMat,
        solids: gen.solids,
        zips: gen.zips,
        meadowDist,
        parkPaths: ground.parkPaths,
    });
    await tick("ground");
    const far = buildFarShore({ scene: root, facadeMat, solids: gen.solids });
    await tick("far");
    const bridges = buildBridges({
        scene: root,
        T,
        solids: gen.solids,
        zips: gen.zips,
        boxes: gen.boxes,
    });
    await tick("bridges");

    const hinter = buildHinterland({ scene: root });
    buildWetBands({
        scene: root,
        T,
        segs: [...(ground.wetSegs ?? []), ...(far.wetSegs ?? [])],
    });
    await tick("hinterland " + hinter.count, "props");
    const boats = buildBoats({
        scene: root,
        solids: gen.solids,
        docks: [
            ...PIERS,
            ...(far.piers ?? []).map(([x0, z0, x1, z1]) => ({
                x0,
                z0,
                x1,
                z1,
            })),
        ],
    });
    const vehModels = await loadVehicleModels(renderer);
    const highways = buildHighways({
        scene: root,
        T,
        solids: gen.solids,
        models: vehModels,
    });

    const nSolidsPre = gen.solids.count;
    const props = await buildProps({
        scene: root,
        blocks,
        parkPaths: ground.parkPaths,
        T,
        solids: gen.solids,
        buildings: gen.buildings,
    });
    await tick("props", "life");
    {
        const K = bridgeKeepOuts(),
            inR = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
        const keep = new Set([
            "lamp",
            "lampPool",
            "mast",
            "post",
            "blade",
            "doorman",
            "hvac",
            "dish",
            "antenna",
            "vents",
            "garden",
            "billboard",
            "fence",
        ]);
        const kept = [],
            gone = [];
        let nRm = 0;
        for (const p of props.pools ?? []) {
            const nm = p.mesh?.name;
            if (!p.items) continue;
            if (keep.has(nm)) {
                for (const it of p.items)
                    if (K.some((k) => inR(k.props, it.x, it.z))) kept.push(it);
                continue;
            }
            const n0 = p.items.length;
            p.items = p.items.filter((it) => {
                const out =
                    it.y < 1.5 && K.some((k) => inR(k.props, it.x, it.z));
                if (out) gone.push(it);
                return !out;
            });
            if (p.items.length !== n0) {
                nRm += n0 - p.items.length;
                p.written = -1;
                p.last?.set?.(1e9, 0, 0);
            }
        }

        const S = gen.solids;
        let nS = 0;
        for (let i = nSolidsPre; i < S.count; i++) {
            const j = i * 6,
                cx = (S.b[j] + S.b[j + 3]) / 2,
                cz = (S.b[j + 2] + S.b[j + 5]) / 2;
            if (S.b[j + 1] > 1.5 || !K.some((k) => inR(k.props, cx, cz)))
                continue;
            if (
                !gone.some((it) => Math.hypot(it.x - cx, it.z - cz) < 3.5) ||
                kept.some((it) => Math.hypot(it.x - cx, it.z - cz) < 1.2)
            )
                continue;
            S.remove(i);
            nS++;
        }
        for (let i = props.treeSpots.length - 1; i >= 0; i--)
            if (
                K.some((k) =>
                    inR(k.props, props.treeSpots[i].x, props.treeSpots[i].z),
                )
            )
                props.treeSpots.splice(i, 1);
        console.log(
            `[city] (bridges r3) ramp mouths cleared: ${nRm} props, ${nS} solids`,
        );
    }
    props.treeSpots.push(...(highways.treeSpots ?? []));
    props.treeSpots.push({ x: -266.5, z: 566.4, kind: "street" });
    tsTrimTrees(props.treeSpots);
    diagTreeSpots(props.treeSpots, blocks, gen);
    for (const I of islands())
        for (const [x, z] of I.trees)
            props.treeSpots.push({ x, z, kind: "street" });
    for (let i = props.treeSpots.length - 1; i >= 0; i--) {
        const q = streetsAt(props.treeSpots[i].x, props.treeSpots[i].z);
        if (
            q.round ||
            q.cut ||
            (q.island && q.island.kind !== "median") ||
            inCurbCut(props.treeSpots[i].x, props.treeSpots[i].z, 1.2)
        )
            props.treeSpots.splice(i, 1);
    }
    props.treeSpots.push(...(rooftops.roofTrees ?? []));
    props.treeSpots.push(...(gen.openTrees ?? []));
    {
        const spans = bridges.spans;
        gen.excluded.slice(1).forEach((E, i) => {
            const B = spans.filter((s) => s.mLand !== null)[i];
            if (!E || !B) return;
            for (let x = E.x0 + 5; x < E.x1 - 4; x += 9)
                for (let z = E.z0 + 4; z < E.z1 - 3; z += 8) {
                    const h =
                        Math.abs(
                            Math.sin(x * 12.9898 + z * 78.233) * 43758.5453,
                        ) % 1;
                    if (h < 0.3) continue;
                    const jx = x + (h - 0.5) * 3,
                        jz = z + (((h * 7.13) % 1) - 0.5) * 2.5;
                    if (
                        Math.abs(jz - B.z) < B.sec.hw + 4.5 ||
                        (jx < B.mLand + 2 && Math.abs(jz - B.z) < B.sec.hw + 12)
                    )
                        continue;
                    if (
                        !["block"].includes(streetsAt(jx, jz).type) ||
                        !["block"].includes(streetsAt(jx + 2.5, jz).type) ||
                        !["block"].includes(streetsAt(jx - 2.5, jz).type)
                    )
                        continue;
                    if (
                        gen.footprints.some(
                            (f) =>
                                jx > f.x0 - 3 &&
                                jx < f.x1 + 3 &&
                                jz > f.z0 - 3 &&
                                jz < f.z1 + 3,
                        )
                    )
                        continue;
                    props.treeSpots.push({
                        x: jx,
                        z: jz,
                        kind: h > 0.9 ? "small" : "street",
                    });
                }
        });
    }
    if (gen.variety)
        console.log(
            "[city] (layout2 r3) block variety",
            JSON.stringify(gen.variety),
        );
    buildNeon({ scene: root, solids: gen.solids });
    const trees = buildTrees({
        scene: root,
        T,
        spots: props.treeSpots,
        parkPaths: ground.parkPaths,
    });
    const traffic = buildTraffic({
        scene: root,
        phase: props.phase,
        models: vehModels,
    });
    const peds = await buildPeds({
        scene: root,
        blocks,
        parkPaths: ground.parkPaths,
        props,
        traffic,
    });
    const flags = buildFlags({ scene: root, flags: gen.buildings.flags });
    await tick("life", "coll");
    let time = 0;
    let _fr = null,
        _pm = null,
        _sp = null;

    addPropAnchors(gen.zips, props);
    gen.zips.addTreeBlockers?.(trees);

    const tFit = performance.now();
    const roofEq = { minY: 3, solidBase: true };
    const fit = fitInstancedSolids(gen.solids, props.pools ?? [], {
        start: nSolidsPre,
        spec: {
            hvac: roofEq,
            vents: roofEq,
            garden: roofEq,
            dish: { minY: 3 },
            antenna: { minY: 3, kind: "antenna" },
            lamp: { yCut: 8.3, keepOld: true, kind: "pole" },
            mast: { yCut: 6.2, keepOld: true, kind: "pole" },
            pit: { yCut: 0.01, keepOld: true, kind: "equipment" },

            planter: { solidBase: true },
            trash: { solidBase: true },
            newsbox: { solidBase: true },
            mailbox: { solidBase: true },
            dumpster: { solidBase: true },
            drum: { solidBase: true },
            hydrant: { solidBase: true },
        },
    });
    const tFit2 = performance.now();
    trees.addSolids?.(gen.solids);
    const grid = new CollisionGrid(gen.solids, 24);
    const zips = gen.zips.finalize(grid);
    const { groundHeight, raycast, surfaceAt } = makeQueries(
        grid,
        terrainHeight,
    );
    const geoDebug = createGeoDebug(root, grid, zips, collisionDebugLines);
    await tick("coll");

    const spawn = new THREE.Vector3(250, 0, 160 + G.ST_HALF + 2.3);
    const viewpoints = makeViewpoints(gen, spawn, hero);

    const params = new URLSearchParams(location.search);
    const camParam = params.get("cam");
    const vpParam = params.get("vp");
    const shotMode = params.has("shot");
    const _dir = new THREE.Vector3();
    const forced = camParam ? camParam.split(",").map(Number) : null;

    const world = {
        raycast,
        groundHeight,
        surfaceAt,
        spawn,
        viewpoints,
        streetsAt,
        getZipPoints: (center, radius, kinds) =>
            zips.query(center, radius, kinds),

        bridgeLimit: null,
        bridgeDeckY,
        propAnchors: () => props.propAnchors?.() ?? [],
        grabbables: (c, r) => props.grabbables?.(c, r) ?? [],
        grabProp: (id) => props.grab?.(id),
        releaseProp: (id) => props.release?.(id),
        collision: grid,
        geoDebug,
        buildings: gen.boxes,
        footprints: gen.footprints,
        getMapFeatures: () => mapFeatures(blocks, gen),
        textures: T,
        materials: { facade: facadeMat },
        update(dt, camera) {
            time += dt;
            const P0_ = world.prof,
                g0_ = P0_ ? performance.now() : 0;
            ground.update(dt, camera);
            const g1_ = P0_ ? performance.now() : 0;
            boats.update(dt);
            highways.update(dt, camera);
            if (P0_) {
                const g2_ = performance.now(),
                    a_ = (k, v) => {
                        P0_[k] = (P0_[k] ?? v) * 0.95 + v * 0.05;
                        P0_[k + "Max"] = Math.max(P0_[k + "Max"] || 0, v);
                    };
                a_("ground", g1_ - g0_);
                a_("highways", g2_ - g1_);
            }

            if (!world._skylineOff) {
                const lg = window.__ctx?.lighting;
                if (lg?.sky?.params) {
                    lg.sky.params.skylineVisible = 0;
                    lg.refresh?.();
                    world._skylineOff = true;
                }
            }
            if (camera) {
                if (forced) {
                    camera.position.set(forced[0], forced[1], forced[2]);
                    camera.lookAt(forced[3], forced[4], forced[5]);
                } else if (vpParam && viewpoints[vpParam]) {
                    const v = viewpoints[vpParam];
                    camera.position.copy(v.pos);
                    camera.lookAt(v.target);
                }
                const cp = camera.position;
                const h0_ = P0_ ? performance.now() : 0;
                hero.renderReflection(camera);
                if (P0_) {
                    const v = performance.now() - h0_;
                    P0_.hero = (P0_.hero ?? v) * 0.95 + v * 0.05;
                    P0_.heroMax = Math.max(P0_.heroMax || 0, v);
                }
                geoDebug.update(camera);
                const P_ = world.prof,
                    t0_ = P_ ? performance.now() : 0;
                props.update(dt, cp, time);
                const t1_ = P_ ? performance.now() : 0;
                trees.update(dt, cp);
                flags.update(dt, cp);
                rooftops.update(camera);
                signage.update(cp);
                const t2_ = P_ ? performance.now() : 0;
                let clear = null;
                if (shotMode && !forced) {
                    camera.getWorldDirection(_dir);
                    _dir.y = 0;
                    _dir.normalize();
                    clear = { pos: cp, dir: _dir, len: 32, half: 2.2 };
                }
                traffic.update(Math.min(dt, 0.1), camera, time, clear);
                const t3_ = P_ ? performance.now() : 0;
                peds.update(Math.min(dt, 0.1), camera);
                if (P_) {
                    const t4_ = performance.now(),
                        a_ = (k, v) => {
                            P_[k] = (P_[k] ?? v) * 0.95 + v * 0.05;
                            P_[k + "Max"] = Math.max(P_[k + "Max"] || 0, v);
                        };
                    a_("props", t1_ - t0_);
                    a_("trees", t2_ - t1_);
                    a_("traffic", t3_ - t2_);
                    a_("peds", t4_ - t3_);
                }
                facB.endWarm();
                detB.endWarm();
                let warmed = false;
                if (!_fr) {
                    _fr = new THREE.Frustum();
                    _pm = new THREE.Matrix4();
                    _sp = new THREE.Sphere();
                }
                _pm.multiplyMatrices(
                    camera.projectionMatrix,
                    camera.matrixWorldInverse,
                );
                _fr.setFromProjectionMatrix(_pm);
                for (const tm of tileMeshes) {
                    const d = Math.hypot(
                        Math.max(0, Math.abs(camera.position.x - tm.cx) - 128),
                        Math.max(0, Math.abs(camera.position.z - tm.cz) - 128),
                    );
                    if (tm.mesh) {
                        detB.setVisible(tm.i, d < 450);
                        detB.setShadow(tm.i, d < 160);
                    }

                    if (tm.lod) {
                        const near = tm.near ? d < 690 : d < 650;
                        tm.near = near;
                        if (tm.fac) facB.setVisible(tm.i, near);
                        lodB.setVisible(tm.i, !near);
                    }

                    if (
                        !warmed &&
                        d < 850 &&
                        ((tm.fac && !tm.warmF && !tm.near) ||
                            (tm.mesh && !tm.warmD && d >= 450 && d < 600))
                    ) {
                        _sp.center.set(tm.cx, 60, tm.cz);
                        _sp.radius = 200;
                        if (_fr.intersectsSphere(_sp)) {
                            if (tm.fac && !tm.warmF && !tm.near) {
                                if (facB.warm(tm.i)) warmed = true;
                                else tm.warmF = true;
                            } else if (detB.warm(tm.i)) warmed = true;
                            else tm.warmD = true;
                        }
                    }
                }
            }
        },
    };
    {
        const lim = bridgeLimits(groundHeight);
        world.bridgeLimit = (x, y, z) => lim.check(x, y, z);
        world.bridgeLimits = lim.list;
    }
    attachLife(world, { traffic, crowd: peds.crowd, pigeons: peds.pigeons });
    console.log(
        `[city] built in ${(performance.now() - t0).toFixed(0)} ms: ${gen.boxes.length} boxes, ${grid.n} solids, ${zips.count} zip points, rooftop refit ${fit.nInst} inst/${fit.nBox} fields/${(fit.cells / 1e6).toFixed(2)}M cells/-${fit.nDead} in ${(tFit2 - tFit).toFixed(0)} ms, ${gen.footprints.length} buildings, ${gen.tiles.size} tiles, ${far.count} far-shore boxes (${far.near} near, ${far.trees} trees), ${bridges.spans.length} bridges | ${TT.join(", ")}`,
    );
    return world;
}

function makeViewpoints(gen, spawn, hero) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const vp = {};
    vp.street = {
        pos: V(spawn.x, 1.7, spawn.z + 4.2),
        target: V(spawn.x - 1, 6, spawn.z - 200),
        subject: spawn.clone(),
    };

    {
        const mid = hero.fins[hero.fins.length - 1] - 6;
        const zf = hero.fins.reduce(
            (best, z) => (Math.abs(z - mid) < Math.abs(best - mid) ? z : best),
            hero.fins[0],
        );
        const a = V(hero.X - 0.45, 40, zf);
        vp.wall = {
            pos: V(a.x - 1.4, a.y + 1.0, a.z + 2.0),
            target: V(a.x - 0.3, a.y - 6, a.z - 30),
            anchor: a,
            normal: V(-1, 0, 0),
        };
    }

    vp.swing = {
        pos: V(-304, 15, 561.5),
        target: V(-234, 12, 560),
        subject: V(-296, 14, 561),
    };

    vp.swingBack = {
        pos: V(246, 14.5, 120),
        target: V(249, 4, 40),
        subject: V(247, 11, 112),
    };

    let gt = null;
    for (const b of gen.buildings)
        if (b.A.type === "glass" && b.lot.x1 > 600 && (!gt || b.H > gt.H))
            gt = b;
    if (gt) {
        const m =
            gt.masses.find((m) => m.y1 >= 150 && m.y0 <= 150) ?? gt.masses[0];
        const a = V(m.x1 + 0.05, Math.min(150, m.y1 - 5), (m.z0 + m.z1) / 2);
        vp.climb = {
            pos: V(a.x + 3.2, a.y + 1.2, a.z + 2.2),
            target: V(a.x, a.y + 1.5, a.z - 3),
            anchor: a,
            normal: V(1, 0, 0),
        };
    }
    return vp;
}

function diagTreeSpots(spots, blocks, gen) {
    for (let i = spots.length - 1; i >= 0; i--)
        if (
            spots[i].kind === "street" &&
            streetsAt(spots[i].x, spots[i].z).diag
        )
            spots.splice(i, 1);
    const clearOfRoads = (x, z, r) => {
        for (const [dx, dz] of [
            [r, 0],
            [-r, 0],
            [0, r],
            [0, -r],
        ]) {
            const t = streetsAt(x + dx, z + dz).type;
            if (t !== "sidewalk" && t !== "block") return false;
        }
        return true;
    };
    for (const s of DIAG_SEGS)
        for (const sg of [-1, 1]) {
            const off = sg * (s.hw + 1.1);
            for (let t = 8; t < s.len - 8; t += 11) {
                const x = s.ax + s.ux * t + s.nx * off,
                    z = s.az + s.uz * t + s.nz * off;
                const q = streetsAt(x, z);
                if (
                    q.type !== "sidewalk" ||
                    q.diagWalk !== s ||
                    !clearOfRoads(x, z, 3.2)
                )
                    continue;
                spots.push({ x, z, kind: "street" });
            }
        }

    if (!spots.vmapDone)
        for (const sg of MAPS.flatMap((M) => M.segs))
            for (const side of [-1, 1]) {
                const off = side * (sg.hw + 1.1),
                    ph = (sg.ax * 0.37 + sg.az * 0.11) % 4;
                for (
                    let t = 9 + Math.abs(ph);
                    t < sg.len - 9;
                    t += 9.5 + ((t * 13.7) % 3)
                ) {
                    const x = sg.ax + sg.ux * t + sg.nx * off,
                        z = sg.az + sg.uz * t + sg.nz * off;
                    if (
                        streetsAt(x, z).type !== "sidewalk" ||
                        !clearOfRoads(x, z, 2.2)
                    )
                        continue;
                    spots.push({ x, z, kind: "street" });
                }
            }
    {
        const ML = gen.mapLawns ?? [];
        const lawnsP = [
            ...(ML.length
                ? ML.map((l) => l.inner)
                : MAPS.flatMap((M) => M.cells)
                      .filter((c) => c.park && c.prop)
                      .map((c) => c.prop)),
            ...BATTERY.lawns,
        ];
        const offML = (x, z) =>
            ML.some(
                (l) =>
                    (l.fountain &&
                        Math.hypot(x - l.fountain.x, z - l.fountain.z) <
                            l.fountain.r + 2.5) ||
                    (l.walks ?? []).some((w) => {
                        const dx = w.bx - w.ax,
                            dz = w.bz - w.az,
                            L2 = dx * dx + dz * dz,
                            t = Math.max(
                                0,
                                Math.min(
                                    1,
                                    ((x - w.ax) * dx + (z - w.az) * dz) / L2,
                                ),
                            );
                        return (
                            Math.hypot(x - w.ax - dx * t, z - w.az - dz * t) <
                            w.w + 1.5
                        );
                    }),
            );
        for (const P of lawnsP) {
            const xs = P.map((p) => p[0]),
                zs = P.map((p) => p[1]);
            for (let x = Math.min(...xs) + 4; x < Math.max(...xs) - 3; x += 9)
                for (
                    let z = Math.min(...zs) + 4;
                    z < Math.max(...zs) - 3;
                    z += 9
                ) {
                    const h =
                            Math.abs(
                                Math.sin(x * 12.9898 + z * 78.233) * 43758.5453,
                            ) % 1,
                        jx = x + (h - 0.5) * 4,
                        jz = z + (((h * 7.13) % 1) - 0.5) * 4;
                    if (h < 0.3) continue;
                    const clr = [
                        [0, 0],
                        [2.2, 0],
                        [-2.2, 0],
                        [0, 2.2],
                        [0, -2.2],
                    ].every(([dx, dz]) => inConvexPoly(P, jx + dx, jz + dz));
                    if (clr && !offML(jx, jz))
                        spots.push({
                            x: jx,
                            z: jz,
                            kind: h < 0.42 ? "small" : "street",
                        });
                }
        }
    }
    for (const c of MAPS.flatMap((M) => M.cells))
        if (!c.park && (!c.prop || polyArea(c.prop) < 160)) {
            const q = c.prop ?? c.curb,
                n = q.length,
                x = q.reduce((a, p) => a + p[0], 0) / n,
                z = q.reduce((a, p) => a + p[1], 0) / n;
            if (polyArea(c.curb) > 90 && clearOfRoads(x, z, 2.2))
                spots.push({ x, z, kind: "street" });
        }
    const pav = gen.paverCells;
    for (const [b, lots] of gen.diagLots ?? []) {
        for (let x = b.px0 + 4; x < b.px1 - 3; x += 7.5)
            for (let z = b.pz0 + 4; z < b.pz1 - 3; z += 7.5) {
                const h =
                    Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) %
                    1;
                if (h < 0.25) continue;
                const jx = x + (h - 0.5) * 3.6,
                    jz = z + (((h * 7.13) % 1) - 0.5) * 3.6;
                if (
                    pav &&
                    pav.has(
                        Math.floor(jx / 1.5) * 100003 + Math.floor(jz / 1.5),
                    )
                )
                    continue;
                if (streetsAt(jx, jz).type !== "block") continue;
                {
                    const L = LINCOLN.plaza;
                    if (jx > L.x0 && jx < L.x1 && jz > L.z0 && jz < L.z1)
                        continue;
                }
                if (
                    b.diag.some(
                        (s) => Math.abs(diagD(s, jx, jz)) < s.hw + s.walk + 2.5,
                    )
                )
                    continue;
                if (
                    lots.some(
                        (l) =>
                            jx > l.x0 - 3.5 &&
                            jx < l.x1 + 3.5 &&
                            jz > l.z0 - 3.5 &&
                            jz < l.z1 + 3.5,
                    )
                )
                    continue;
                if (
                    (gen.squareSpots ?? []).some(
                        (q) => Math.hypot(q.x - jx, q.z - jz) < q.r + 1.8,
                    )
                )
                    continue;
                if (
                    (gen.frontPolys ?? []).some(
                        (P) =>
                            inConvexPoly(P, jx, jz) ||
                            P.some(
                                ([px, pz]) =>
                                    Math.hypot(px - jx, pz - jz) < 3.5,
                            ) ||
                            inConvexPoly(P, jx + 3, jz) ||
                            inConvexPoly(P, jx - 3, jz) ||
                            inConvexPoly(P, jx, jz + 3) ||
                            inConvexPoly(P, jx, jz - 3),
                    )
                )
                    continue;
                spots.push({
                    x: jx,
                    z: jz,
                    kind: h > 0.88 ? "small" : "street",
                    sc: 0.62 + 0.5 * ((h * 3.7) % 1),
                });
            }
    }
}

function mapFeatures(blocks, gen) {
    const P = G.PARK;
    const E = 4000,
        zN = G.Z_MIN,
        zS = G.Z_MAX;
    const west = SHORE_Z.map((z, i) => [SHORE_W[i], z]);
    const east = SHORE_Z.map((z, i) => [SHORE_E[i], z]);
    return {
        bounds: {
            x0: G.X_MIN - 150,
            z0: G.Z_MIN - 150,
            x1: G.X_MAX + 150,
            z1: G.Z_MAX + 150,
        },
        land: [LAND_POLY],
        farLand: FAR_LANDS.map((L) => L.pts),
        blocks: blocks.map((b) => ({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 })),
        buildings: gen.footprints,
        streets: [
            ...roadRects().map((r) => ({
                x0: r.x0,
                z0: r.z0,
                x1: r.x1,
                z1: r.z1,
                kind: r.kind === "intersection" ? "avenue" : r.kind,
            })),
            ...diagRoadPolys().map((p) => ({
                poly: p.pts,
                kind: p.seg.kind === "broadway" ? "avenue" : "street",
                name: p.seg.name,
            })),
            ...vmapRoadPolys().map((p) => ({
                poly: p.pts,
                kind: "street",
                name: p.seg.name,
            })),
        ],
        water: [
            [
                [-E, zN - E],
                [E, zN - E],
                [E, zN],
                ...west,
                [E, zS],
                [E, zS + E],
                [-E, zS + E],
            ],
            [[E, zN], ...east, [E, zS]],
        ],
        parks: [
            [
                [P.x0, P.z0],
                [P.x1, P.z0],
                [P.x1, P.z1],
                [P.x0, P.z1],
            ],
            BATTERY.poly,
            ...MAPS.flatMap((M) => M.cells)
                .filter((c) => c.park && c.prop)
                .map((c) => c.prop),
        ],
        parkWater: PARK_WATER.map((w) => w.pts),
        avenueNames: avenues.map((x, i) => ({ x, name: AV_NAMES[i] })),
        inPark,
    };
}

function lincolnReserves() {
    const R = [{ name: "lcPlaza", ...LINCOLN.plaza, custom: true }];
    const S = { nx: "street", px: "street", nz: "street", pz: "street" };
    for (const h of LINCOLN.halls)
        R.push({
            name: h.name,
            x0: h.x0,
            x1: h.x1,
            z0: h.z0,
            z1: h.z1,
            seed: 4100 + R.length,
            sides: S,
            arch: () => ({
                type: "loft",
                style: STYLE.PUNCHED,
                layer: LAYER.LIME,
                base: LAYER.LIME,
                floorH: h.fh,
                bayW: h.bay,
                winW: h.name === "lcRear" ? 0.55 : 0.8,
                winH: h.name === "lcRear" ? 0.5 : 0.9,
                gH: h.fh,
                height: h.h,
                depth: 0.55,
                margin: 0.5,
                tint: [1.02, 0.98, 0.9],
                cornice: true,
                lintel: 0,
                waterTower: false,
                fireEscape: false,
                noBalconies: true,
                resid: 0,
                shape: null,
            }),
        });
    return R;
}
