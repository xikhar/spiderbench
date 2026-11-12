// OWNER: lighting agent. (daynight) ONE shared global for the night city, driven by lighting.js from the sun elevation.
//   nightK.value: 0 = day .. 1 = full night (lit windows, street lamps + light pools, car lights, billboards, bridges).
//   It is uniform-shaped: bind it directly in a shader ({ uNightK: nightK }) or read nightK.value in JS.
//   nightOnly(mesh): the mesh is drawn only while nightK > 0.01 (no draw call by day).
export const nightK = { value: 0 };
export const dnTime = { value: 0 };
// (lighting2 r5) per-emissive exposure compensation for LED screens / back-lit signs: multiply their emission by
// screenK.value so they keep ~day brightness (x0.5 at full night) at every preset instead of washing to white
export const screenK = { value: 1 }; // seconds (window lights switching on / off over time)
const nightMeshes = new Set();
export function nightOnly(mesh) {
    nightMeshes.add(mesh);
    mesh.layers.mask = 1;
    return mesh;
}
// the first frames after load draw them anyway (at nightK 0 they add nothing): their programs compile during loading,
// not as a hitch at sunset
let warm = 240;
export function syncNightMeshes() {
    const m = nightK.value > 0.01 || warm > 0 ? 1 : 0;
    for (const o of nightMeshes) if (o.layers.mask !== m) o.layers.mask = m;
}
export function tickNightMeshes() {
    if (warm > 0 && --warm === 0) syncNightMeshes();
    else if (warm > 0) syncNightMeshes();
}
