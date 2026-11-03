// Instanced vehicle models for traffic on the waterfront highways and bridges.
// Geometry is cloned before adding instance attributes because street traffic
// and highway traffic use separate instance buffers.
import * as THREE from "three";
import { createVehicleMaterial } from "./vehicles.ts";

export const HIGH_DETAIL_DISTANCE = 48;
export const LOW_DETAIL_DISTANCE = 230;

type GeometryLike = {
  clone(): GeometryLike;
  setAttribute(name: string, attribute: InstanceAttributeLike): void;
};

type InstanceAttributeLike = {
  array: Float32Array;
  itemSize: number;
  needsUpdate: boolean;
  setUsage(usage: number): InstanceAttributeLike;
  clearUpdateRanges(): void;
  addUpdateRange(start: number, count: number): void;
};

type InstancedMeshLike = {
  name: string;
  count: number;
  visible: boolean;
  frustumCulled: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  userData: Record<string, unknown>;
  instanceMatrix: InstanceAttributeLike;
};

type Matrix4Like = {
  multiplyMatrices(first: Matrix4Like, second: Matrix4Like): Matrix4Like;
  compose(
    position: Vector3Like,
    rotation: QuaternionLike,
    scale: Vector3Like,
  ): Matrix4Like;
};

type Vector3Like = {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): Vector3Like;
};

type QuaternionLike = {
  setFromAxisAngle(axis: Vector3Like, angle: number): QuaternionLike;
  multiply(rotation: QuaternionLike): QuaternionLike;
};

type SphereLike = {
  center: Vector3Like;
  radius: number;
};

type FrustumLike = {
  setFromProjectionMatrix(matrix: Matrix4Like): FrustumLike;
  intersectsSphere(sphere: SphereLike): boolean;
};

type CameraLike = {
  position: Vector3Like;
  projectionMatrix: Matrix4Like;
  matrixWorldInverse: Matrix4Like;
  updateMatrixWorld(): void;
};

type GroupLike = {
  add(mesh: InstancedMeshLike): void;
};

type VehicleType = {
  type: string;
  weight: number;
  farModel: string;
  length: number;
};

type VehicleModels = {
  geos: Record<string, GeometryLike | undefined>;
  atlas: object;
};

function linearColorFromHex(hexColor: number): number[] {
  const red = ((hexColor >> 16) & 255) / 255;
  const green = ((hexColor >> 8) & 255) / 255;
  const blue = (hexColor & 255) / 255;
  return [red, green, blue].map((channel) => channel ** 2.2);
}

// City paint palette shared with the scripted street traffic.
const VEHICLE_PALETTE = [
  0x0e0e0f, 0x151517, 0x1b1c1f, 0x101418, 0xe2e2df, 0xd8d8d4, 0xcfcfca,
  0xe6e3da, 0xa9adb1, 0x9c9fa3, 0xb7b9bb, 0x8e9296, 0x6d7074, 0x55585c,
  0x44474b, 0x1b2a4a, 0x223a63, 0x2f4c7a, 0x5a1216, 0x6e1a1a, 0x8a1f1f,
  0xb3a98f, 0x9b8f75, 0x2c3d2e, 0x44563f, 0x6b86a0, 0x4a3a2c, 0x3b4450,
  0x7c8a8f, 0x2a2d33,
].map(linearColorFromHex);

const TAXI_PAINT = linearColorFromHex(0xf5a900);
const VAN_AND_TRUCK_PAINTS = [
  0xd6d6d2,
  0xcfccc4,
  0xc9c9c7,
  0xd9d7d0,
].map(linearColorFromHex);
const LIVERY_PAINTS = [
  0x0b0b0c,
  0x0e0e10,
  0x121315,
  0x0d1014,
].map(linearColorFromHex);

// Model selection weights, far-distance proxy, and physical vehicle length.
export const VEHICLE_TYPES: VehicleType[] = [
  { type: "taxi_hy", weight: 0.16, farModel: "sedan", length: 4.7 },
  { type: "sedan", weight: 0.32, farModel: "sedan", length: 4.9 },
  { type: "suv", weight: 0.3, farModel: "suv", length: 5.1 },
  { type: "van", weight: 0.12, farModel: "van", length: 6.0 },
  { type: "truck", weight: 0.1, farModel: "truck", length: 7.3 },
];

export function pickVehicle(randomValue: number): VehicleType {
  for (const vehicleType of VEHICLE_TYPES) {
    if (randomValue < vehicleType.weight) return vehicleType;
    randomValue -= vehicleType.weight;
  }
  return VEHICLE_TYPES[0]!;
}

export function getVehiclePaint(
  vehicleType: string,
  randomValue: number,
): number[] {
  if (vehicleType.startsWith("taxi")) return TAXI_PAINT;
  if (vehicleType === "van" || vehicleType === "truck") {
    return VAN_AND_TRUCK_PAINTS[Math.floor(randomValue * 4) % 4]!;
  }
  if (vehicleType === "suv" && randomValue < 0.35) {
    return LIVERY_PAINTS[Math.floor(randomValue * 97) % 4]!;
  }
  return VEHICLE_PALETTE[
    Math.floor(randomValue * VEHICLE_PALETTE.length) % VEHICLE_PALETTE.length
  ]!;
}

class InstancedVehicleMesh {
  readonly mesh: InstancedMeshLike;
  readonly capacity: number;
  readonly instanceTint: InstanceAttributeLike;
  readonly instanceState: InstanceAttributeLike;
  readonly instanceSeed: InstanceAttributeLike;
  count = 0;

  constructor(
    geometry: GeometryLike,
    material: object,
    capacity: number,
    name: string,
    castsShadows: boolean,
  ) {
    const instanceGeometry = geometry.clone();
    this.instanceTint = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 3),
      3,
    ).setUsage(THREE.DynamicDrawUsage) as InstanceAttributeLike;
    this.instanceState = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity),
      1,
    ).setUsage(THREE.DynamicDrawUsage) as InstanceAttributeLike;
    this.instanceSeed = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity),
      1,
    ).setUsage(THREE.DynamicDrawUsage) as InstanceAttributeLike;

    instanceGeometry.setAttribute("aTint", this.instanceTint);
    instanceGeometry.setAttribute("aState", this.instanceState);
    instanceGeometry.setAttribute("aSeed", this.instanceSeed);

    this.mesh = new THREE.InstancedMesh(
      instanceGeometry,
      material,
      capacity,
    ) as InstancedMeshLike;
    this.mesh.name = name;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castsShadows;
    this.mesh.receiveShadow = true;
    this.mesh.userData.maxCascade = 1;
    this.mesh.userData.smallCasters = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.visible = false;
    this.capacity = capacity;
  }

  addInstance(
    transform: Matrix4Like & {
      toArray(array: Float32Array, offset: number): unknown;
    },
    tint: ArrayLike<number>,
    seed: number,
  ): boolean {
    if (this.count >= this.capacity) return false;

    const instanceIndex = this.count;
    this.count += 1;
    transform.toArray(this.mesh.instanceMatrix.array, instanceIndex * 16);
    this.instanceTint.array.set(tint, instanceIndex * 3);
    this.instanceSeed.array[instanceIndex] = seed;
    return true;
  }

  commitInstances(): void {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count === 0) return;

    const updatedAttributes = [
      this.mesh.instanceMatrix,
      this.instanceTint,
      this.instanceSeed,
    ];
    for (const attribute of updatedAttributes) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.count * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }
}

type VehicleSetOptions = {
  models: VehicleModels | null;
  group: GroupLike;
  counts: Record<string, number>;
  name?: string;
  maxHi?: number;
  maxLow?: number;
  maxFar?: number;
};

export function createVehicleSet({
  models,
  group,
  counts,
  name = "vehicle",
  maxHi = 40,
  maxLow = 400,
  maxFar = 3000,
}: VehicleSetOptions) {
  const geometries = models?.geos ?? {};
  const activeVehicleTypes = VEHICLE_TYPES.filter(
    ({ type }) => counts[type],
  );

  const hasRequiredModels =
    activeVehicleTypes.every(
      ({ type }) => geometries[type] && geometries[`${type}_l1`],
    ) &&
    ["sedan", "suv", "van", "truck"].every(
      (type) => geometries[`${type}_l2`],
    );
  if (!hasRequiredModels) return null;

  const atlas = models?.atlas;
  if (!atlas) return null;
  const materials = {
    highDetail: createVehicleMaterial({ name: "veh0", map: atlas }),
    lowDetail: createVehicleMaterial({ name: "veh1", map: atlas }),
    farDetail: createVehicleMaterial({
      name: "veh2",
      map: atlas,
      physical: false,
    }),
  };

  const detailMeshesByType: Record<
    string,
    { high: InstancedVehicleMesh; low: InstancedVehicleMesh }
  > = {};
  const farMeshesByModel: Record<string, InstancedVehicleMesh> = {};
  const allInstancedMeshes: InstancedVehicleMesh[] = [];
  const totalVehicleCount = Object.values(counts).reduce(
    (total, count) => total + count,
    0,
  );

  for (const vehicleType of activeVehicleTypes) {
    const vehicleCount = counts[vehicleType.type] ?? 0;
    detailMeshesByType[vehicleType.type] = {
      high: new InstancedVehicleMesh(
        geometries[vehicleType.type]!,
        materials.highDetail,
        Math.min(vehicleCount, maxHi),
        `${name}-high-${vehicleType.type}`,
        true,
      ),
      low: new InstancedVehicleMesh(
        geometries[`${vehicleType.type}_l1`]!,
        materials.lowDetail,
        Math.min(vehicleCount, maxLow),
        `${name}-low-${vehicleType.type}`,
        true,
      ),
    };
    allInstancedMeshes.push(
      detailMeshesByType[vehicleType.type]!.high,
      detailMeshesByType[vehicleType.type]!.low,
    );
  }

  for (const farModel of ["sedan", "suv", "van", "truck"]) {
    farMeshesByModel[farModel] = new InstancedVehicleMesh(
      geometries[`${farModel}_l2`]!,
      materials.farDetail,
      Math.min(totalVehicleCount, maxFar),
      `${name}-far-${farModel}`,
      false,
    );
    allInstancedMeshes.push(farMeshesByModel[farModel]!);
  }

  for (const instancedMesh of allInstancedMeshes) {
    group.add(instancedMesh.mesh);
  }

  const farModelByVehicleType = new Map<string, string>(
    VEHICLE_TYPES.map(({ type, farModel }) => [type, farModel] as const),
  );
  const lengthByVehicleType = new Map<string, number>(
    VEHICLE_TYPES.map(({ type, length }) => [type, length] as const),
  );

  const instanceTransform = new THREE.Matrix4() as Matrix4Like & {
    toArray(array: Float32Array, offset: number): unknown;
  };
  const instanceRotation = new THREE.Quaternion() as QuaternionLike;
  const pitchRotation = new THREE.Quaternion() as QuaternionLike;
  const instancePosition = new THREE.Vector3() as Vector3Like;
  const unitScale = new THREE.Vector3(1, 1, 1) as Vector3Like;
  const upAxis = new THREE.Vector3() as Vector3Like;
  const cameraFrustum = new THREE.Frustum() as FrustumLike;
  const viewProjectionMatrix = new THREE.Matrix4() as Matrix4Like;
  const vehicleBounds = new THREE.Sphere() as SphereLike;
  let cameraPosition: Vector3Like | null = null;
  let farDistanceSquared = Infinity;

  return {
    meshes: allInstancedMeshes.map(({ mesh }) => mesh),

    beginFrame(camera: CameraLike, farDistance = Infinity) {
      camera.updateMatrixWorld();
      viewProjectionMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      cameraFrustum.setFromProjectionMatrix(viewProjectionMatrix);
      cameraPosition = camera.position;
      farDistanceSquared = farDistance * farDistance;

      for (const instancedMesh of allInstancedMeshes) {
        instancedMesh.count = 0;
      }
    },

    addVehicle(
      type: string,
      x: number,
      y: number,
      z: number,
      yaw: number,
      pitch: number,
      tint: ArrayLike<number>,
      seed: number,
    ) {
      if (!cameraPosition) return;

      const offsetX = x - cameraPosition.x;
      const offsetY = y - cameraPosition.y;
      const offsetZ = z - cameraPosition.z;
      const distanceSquared =
        offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ;
      if (distanceSquared > farDistanceSquared) return;

      if (distanceSquared > 1600) {
        vehicleBounds.center.set(x, y + 1.5, z);
        vehicleBounds.radius = (lengthByVehicleType.get(type) ?? 4.9) * 0.6 + 1;
        if (!cameraFrustum.intersectsSphere(vehicleBounds)) return;
      }

      instanceRotation.setFromAxisAngle(upAxis.set(0, 1, 0), yaw);
      if (pitch) {
        pitchRotation.setFromAxisAngle(upAxis.set(0, 0, 1), pitch);
        instanceRotation.multiply(pitchRotation);
      }
      instanceTransform.compose(
        instancePosition.set(x, y, z),
        instanceRotation,
        unitScale,
      );

      const detailMeshes = detailMeshesByType[type];
      if (!detailMeshes) return;
      if (
        distanceSquared < HIGH_DETAIL_DISTANCE ** 2 &&
        detailMeshes.high.addInstance(instanceTransform, tint, seed)
      ) {
        return;
      }
      if (
        distanceSquared < LOW_DETAIL_DISTANCE ** 2 &&
        detailMeshes.low.addInstance(instanceTransform, tint, seed)
      ) {
        return;
      }

      const farModel = farModelByVehicleType.get(type);
      if (farModel) {
        farMeshesByModel[farModel]?.addInstance(instanceTransform, tint, seed);
      }
    },

    endFrame() {
      for (const instancedMesh of allInstancedMeshes) {
        instancedMesh.commitInstances();
      }
    },

    hide() {
      for (const instancedMesh of allInstancedMeshes) {
        instancedMesh.count = 0;
        instancedMesh.commitInstances();
      }
    },
  };
}
