// @ts-nocheck
// Pedestrians + pigeons entry point used by city.ts.
//   buildPedestrians({scene, blocks, parkPaths, props?, traffic?}) -> Promise<{update(dt, camera|cameraPos), crowd, pigeons}>
// The crowd itself lives in npc/crowd.ts (Blender-modelled GPU-skinned people), birds in npc/pigeons.ts.
import { createCrowd } from "./npc/crowd.ts";
import { createPigeons } from "./npc/pigeons.ts";
import { buildRoads } from "./npc/roads.ts";

export async function buildPedestrians({
  scene,
  blocks,
  parkPaths,
  props = null,
  traffic = null,
}) {
  const roads = traffic?.roads || buildRoads();
  const phase = props?.phase || (() => 2);
  let crowd = null;
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
  let cam = null;
  // debug: ?nocrowd / ?nopigeons disable the systems (bisecting perf)
  const q =
    typeof location !== "undefined"
      ? new URLSearchParams(location.search)
      : new URLSearchParams();
  const noCrowd = q.has("nocrowd"),
    noPigeons = q.has("nopigeons");
  return {
    crowd,
    pigeons,
    update(dt, camOrPos) {
      if (camOrPos && camOrPos.isCamera) cam = camOrPos;
      else if (!cam)
        cam = (typeof window !== "undefined" && window.__ctx?.camera) || null;
      if (!cam) return;
      if (!noCrowd) crowd?.update(dt, cam);
      if (!noPigeons) pigeons.update(dt, cam);
    },
  };
}
