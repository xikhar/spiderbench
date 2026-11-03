// Shared Central Park data used by both the park structures and tree placement.
// Keeping this data separate avoids a runtime import cycle between park.ts and trees.ts.
import { PARK_BOUNDS } from "./layoutConstants.ts";

export const PARK_SITES = {
  met: { x0: 136, x1: 227, z0: -1378, z1: -1204 },
};

// Filled as park rock outcrops are generated; tree placement keeps trunks clear of them.
export const PARK_ROCKS = [];

// Open lawns inside the park: their positions and shapes are shared by trees, ground, pedestrians, and park details.
type ParkMeadow = {
  x: number;
  z: number;
  rx: number;
  rz: number;
  a: number;
};

const meadowAt = (
  xFraction: number,
  zFraction: number,
  radiusX: number,
  radiusZ: number,
  rotation: number,
): ParkMeadow => ({
  x: PARK_BOUNDS.x0 + xFraction * (PARK_BOUNDS.x1 - PARK_BOUNDS.x0),
  z: PARK_BOUNDS.z1 - zFraction * (PARK_BOUNDS.z1 - PARK_BOUNDS.z0),
  rx: radiusX,
  rz: radiusZ,
  a: rotation,
});

export const PARK_MEADOWS: ParkMeadow[] = [
  meadowAt(0.36, 0.12, 100, 58, 0.1),
  meadowAt(0.52, 0.44, 95, 80, -0.15),
  meadowAt(0.6, 0.8, 110, 75, 0.2), // Sheep Meadow, Great Lawn, North Meadow
  meadowAt(0.8, 0.1, 45, 32, 0.5),
  meadowAt(0.16, 0.2, 42, 30, -0.4),
  meadowAt(0.84, 0.36, 40, 36, 0.3),
  meadowAt(0.2, 0.47, 38, 50, 0.2),
  meadowAt(0.25, 0.72, 55, 36, -0.3),
  meadowAt(0.82, 0.22, 34, 26, 0),
  meadowAt(0.3, 0.9, 50, 34, 0.1),
  meadowAt(0.82, 0.68, 40, 50, -0.2),
];

// Normalized elliptical distance to the nearest meadow, including its gently irregular edge.
export function meadowDist(x: number, z: number): number {
  let closestDistance = 9;

  for (const meadow of PARK_MEADOWS) {
    const dx = x - meadow.x;
    const dz = z - meadow.z;
    const cosine = Math.cos(meadow.a);
    const sine = Math.sin(meadow.a);
    const u = (dx * cosine - dz * sine) / meadow.rx;
    const v = (dx * sine + dz * cosine) / meadow.rz;
    const angle = Math.atan2(v, u);
    const edgeWobble =
      1 +
      0.09 * Math.sin(angle * 3 + meadow.x) +
      0.06 * Math.sin(angle * 5 + meadow.z);

    closestDistance = Math.min(closestDistance, Math.hypot(u, v) / edgeWobble);
  }

  return closestDistance;
}
