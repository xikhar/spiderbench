// @ts-nocheck
// OWNER: citylife engineer. Shared static facts between the city-life modules (filled by props.js at build time,
// read by traffic/crowd): things occupying road lanes or curb parking so vehicles route around them.
export const registry = {
  laneObstacles: [], // {x, z, r}   objects standing in a moving lane (steam stacks) -> cars avoid that lane link
  curbBlocks: [], // {x0, z0, x1, z1} parking-lane stretches taken by construction / dumpsters -> no parked cars
  laneClosures: [], // {x0, z0, x1, z1} moving-lane stretches built over (Park Av viaduct ramp) -> links blocked, never populated
};
export function curbBlocked(x, z, pad = 0) {
  for (const b of registry.curbBlocks)
    if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad)
      return true;
  return false;
}
