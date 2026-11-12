// @ts-nocheck
/**
 * Initializes pedestrian and pigeon systems for the world.
 *
 * @module world-peds
 * @version 1.0.0
 * @file src/world/peds.ts
 * @since 0.0.1
 * @description Builds road data as needed and wires together crowd and pigeon simulations for runtime updates.
 */
import { createCrowd } from "./npc/crowd.ts";
import { createPigeons } from "./npc/pigeons.ts";
import { buildRoads } from "./npc/roads.ts";

export async function buildPeds({
    scene,
    blocks,
    parkPaths,
    props = null,
    traffic = null,
}: any) {
    const roads = traffic?.roads || buildRoads();
    const phase = props?.phase || (() => 2);
    let crowd: any = null;
    try {
        crowd = await createCrowd({
            scene,
            blocks,
            parkPaths,
            props,
            roads,
            phase,
        });
    } catch (e) {
        console.warn(
            "[city] crowd assets missing (run tools/blender/city_npc.py)",
            e,
        );
    }
    const pigeons = createPigeons({ scene, blocks, parkPaths, props });
    let cam: any = null;

    const q =
        typeof location !== "undefined"
            ? new URLSearchParams(location.search)
            : new URLSearchParams();
    const noCrowd = q.has("nocrowd"),
        noPigeons = q.has("nopigeons");
    return {
        crowd,
        pigeons,
        update(dt: number, camOrPos: any) {
            if (camOrPos && camOrPos.isCamera) cam = camOrPos;
            else if (!cam)
                cam =
                    (typeof window !== "undefined" &&
                        (window as any).__ctx?.camera) ||
                    null;
            if (!cam) return;
            if (!noCrowd) crowd?.update(dt, cam);
            if (!noPigeons) pigeons.update(dt, cam);
        },
    };
}
