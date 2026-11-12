/**
 * Maintains shared registries for NPC obstacles and road constraints.
 *
 * @module world-npc-registry
 * @version 1.0.0
 * @file src/world/npc/registry.ts
 * @since 0.0.1
 * @description Stores lane obstacles, curb blocks, and lane closures referenced by traffic and other NPC systems.
 */
export const registry = {
    laneObstacles: [],
    curbBlocks: [],
    laneClosures: [],
};
export function curbBlocked(x, z, pad = 0) {
    for (const b of registry.curbBlocks)
        if (
            x > b.x0 - pad &&
            x < b.x1 + pad &&
            z > b.z0 - pad &&
            z < b.z1 + pad
        )
            return true;
    return false;
}
