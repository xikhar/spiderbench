// Builds indexed city meshes from vertices, faces, colors, UVs, and optional material-part IDs.
import * as THREE from "three";

type Vector3Like = {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): Vector3Like;
  applyMatrix4(matrix: Matrix4Like): Vector3Like;
  applyMatrix3(matrix: Matrix3Like): Vector3Like;
  normalize(): Vector3Like;
  clone(): Vector3Like;
  sub(vector: Vector3Like): Vector3Like;
  length(): number;
};

type QuaternionLike = {
  setFromUnitVectors(from: Vector3Like, to: Vector3Like): QuaternionLike;
  setFromAxisAngle(axis: Vector3Like, angle: number): QuaternionLike;
};

type Matrix3Like = {
  getNormalMatrix(matrix: Matrix4Like): Matrix3Like;
};

type Matrix4Like = {
  clone(): Matrix4Like;
  multiply(matrix: Matrix4Like): Matrix4Like;
  compose(
    position: Vector3Like,
    rotation: QuaternionLike,
    scale: Vector3Like,
  ): Matrix4Like;
};

type BufferGeometryLike = {
  setAttribute(name: string, attribute: unknown): BufferGeometryLike;
  setIndex(attribute: unknown): BufferGeometryLike;
  computeBoundingSphere(): void;
  computeBoundingBox(): void;
};

const transformedPosition = new THREE.Vector3() as Vector3Like;
const transformedNormal = new THREE.Vector3() as Vector3Like;
const normalMatrix = new THREE.Matrix3() as Matrix3Like;

export class MeshBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly colors: number[] = [];
  readonly uvCoordinates: number[] = [];
  readonly parts: number[] = [];
  readonly indices: number[] = [];
  vertexCount = 0;
  color: number[] = [1, 1, 1];
  activePart = 0;
  transform: Matrix4Like | null = null;

  setColor(color: number | readonly number[]): this {
    if (typeof color === "number") {
      this.color = [
        ((color >> 16) & 255) / 255,
        ((color >> 8) & 255) / 255,
        (color & 255) / 255,
      ].map((channel) => channel ** 2.2);
    } else {
      this.color = [color[0] ?? 1, color[1] ?? 1, color[2] ?? 1];
    }
    return this;
  }
  setPart(partId: number): this {
    this.activePart = partId;
    return this;
  }
  setXf(transform: Matrix4Like | null): this {
    this.transform = transform;
    return this;
  }
  vert(
    x: number,
    y: number,
    z: number,
    normalX: number,
    normalY: number,
    normalZ: number,
    u = 0,
    v = 0,
  ): number {
    if (this.transform) {
      transformedPosition.set(x, y, z).applyMatrix4(this.transform);
      x = transformedPosition.x;
      y = transformedPosition.y;
      z = transformedPosition.z;
      normalMatrix.getNormalMatrix(this.transform);
      transformedNormal
        .set(normalX, normalY, normalZ)
        .applyMatrix3(normalMatrix)
        .normalize();
      normalX = transformedNormal.x;
      normalY = transformedNormal.y;
      normalZ = transformedNormal.z;
    }
    this.positions.push(x, y, z);
    this.normals.push(normalX, normalY, normalZ);
    this.colors.push(...this.color);
    this.uvCoordinates.push(u, v);
    this.parts.push(this.activePart);
    return this.vertexCount++;
  }
  tri(first: number, second: number, third: number): void {
    this.indices.push(first, second, third);
  }
  quad(first: number, second: number, third: number, fourth: number): void {
    this.indices.push(first, second, third, first, third, fourth);
  }
  // box from min/max (axis aligned in local frame)
  box(
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
    faces = 63,
  ): this {
    type FaceDefinition = {
      normal: readonly [number, number, number];
      corners: readonly (readonly [number, number, number])[];
    };
    const faceDefinitions: FaceDefinition[] = [
      {
        normal: [1, 0, 0],
        corners: [
          [maxX, minY, maxZ],
          [maxX, minY, minZ],
          [maxX, maxY, minZ],
          [maxX, maxY, maxZ],
        ],
      },
      {
        normal: [-1, 0, 0],
        corners: [
          [minX, minY, minZ],
          [minX, minY, maxZ],
          [minX, maxY, maxZ],
          [minX, maxY, minZ],
        ],
      },
      {
        normal: [0, 1, 0],
        corners: [
          [minX, maxY, maxZ],
          [maxX, maxY, maxZ],
          [maxX, maxY, minZ],
          [minX, maxY, minZ],
        ],
      },
      {
        normal: [0, -1, 0],
        corners: [
          [minX, minY, minZ],
          [maxX, minY, minZ],
          [maxX, minY, maxZ],
          [minX, minY, maxZ],
        ],
      },
      {
        normal: [0, 0, 1],
        corners: [
          [minX, minY, maxZ],
          [maxX, minY, maxZ],
          [maxX, maxY, maxZ],
          [minX, maxY, maxZ],
        ],
      },
      {
        normal: [0, 0, -1],
        corners: [
          [maxX, minY, minZ],
          [minX, minY, minZ],
          [minX, maxY, minZ],
          [maxX, maxY, minZ],
        ],
      },
    ];
    faceDefinitions.forEach(({ normal, corners }, faceIndex) => {
      if (!(faces & (1 << faceIndex))) return;
      const vertexIndices = corners.map(([x, y, z], cornerIndex) =>
        this.vert(
          x,
          y,
          z,
          normal[0],
          normal[1],
          normal[2],
          cornerIndex === 1 || cornerIndex === 2 ? 1 : 0,
          cornerIndex >= 2 ? 1 : 0,
        ),
      );
      this.quad(
        vertexIndices[0]!,
        vertexIndices[1]!,
        vertexIndices[2]!,
        vertexIndices[3]!,
      );
    });
    return this;
  }
  boxC(
    centerX: number,
    centerY: number,
    centerZ: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    faces?: number,
  ): this {
    return this.box(
      centerX - sizeX / 2,
      centerY - sizeY / 2,
      centerZ - sizeZ / 2,
      centerX + sizeX / 2,
      centerY + sizeY / 2,
      centerZ + sizeZ / 2,
      faces,
    );
  }
  // cylinder / frustum along Y
  cyl(
    centerX: number,
    bottomY: number,
    centerZ: number,
    bottomRadius: number,
    topRadius: number,
    height: number,
    segmentCount = 8,
    caps = true,
    smooth = true,
  ): this {
    const lowerRing = [];
    const upperRing = [];
    const slope = (bottomRadius - topRadius) / height;
    const normalLength = Math.hypot(1, slope);
    for (let segmentIndex = 0; segmentIndex <= segmentCount; segmentIndex++) {
      const angle = (segmentIndex / segmentCount) * Math.PI * 2;
      const cosAngle = Math.cos(angle);
      const sinAngle = Math.sin(angle);
      lowerRing.push(
        this.vert(
          centerX + cosAngle * bottomRadius,
          bottomY,
          centerZ + sinAngle * bottomRadius,
          cosAngle / normalLength,
          slope / normalLength,
          sinAngle / normalLength,
          segmentIndex / segmentCount,
          0,
        ),
      );
      upperRing.push(
        this.vert(
          centerX + cosAngle * topRadius,
          bottomY + height,
          centerZ + sinAngle * topRadius,
          cosAngle / normalLength,
          slope / normalLength,
          sinAngle / normalLength,
          segmentIndex / segmentCount,
          1,
        ),
      );
    }
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
      this.quad(
        lowerRing[segmentIndex + 1]!,
        lowerRing[segmentIndex]!,
        upperRing[segmentIndex]!,
        upperRing[segmentIndex + 1]!,
      );
    }
    if (caps) {
      if (topRadius > 0) {
        const capCenter = this.vert(centerX, bottomY + height, centerZ, 0, 1, 0);
        const capRing = [];
        for (let segmentIndex = 0; segmentIndex <= segmentCount; segmentIndex++) {
          const angle = (segmentIndex / segmentCount) * Math.PI * 2;
          capRing.push(
            this.vert(
              centerX + Math.cos(angle) * topRadius,
              bottomY + height,
              centerZ + Math.sin(angle) * topRadius,
              0,
              1,
              0,
            ),
          );
        }
        for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
          this.tri(
            capCenter,
            capRing[segmentIndex + 1]!,
            capRing[segmentIndex]!,
          );
        }
      }
      if (bottomRadius > 0) {
        const capCenter = this.vert(centerX, bottomY, centerZ, 0, -1, 0);
        const capRing = [];
        for (let segmentIndex = 0; segmentIndex <= segmentCount; segmentIndex++) {
          const angle = (segmentIndex / segmentCount) * Math.PI * 2;
          capRing.push(
            this.vert(
              centerX + Math.cos(angle) * bottomRadius,
              bottomY,
              centerZ + Math.sin(angle) * bottomRadius,
              0,
              -1,
              0,
            ),
          );
        }
        for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
          this.tri(
            capCenter,
            capRing[segmentIndex]!,
            capRing[segmentIndex + 1]!,
          );
        }
      }
    }
    void smooth;
    return this;
  }
  // cylinder between two points
  tube(
    startPoint: readonly [number, number, number],
    endPoint: readonly [number, number, number],
    radius: number,
    segmentCount = 6,
    caps = false,
  ): this {
    const start = new THREE.Vector3(...startPoint) as Vector3Like;
    const end = new THREE.Vector3(...endPoint) as Vector3Like;
    const direction = end.clone().sub(start);
    const length = direction.length();
    const rotation = (new THREE.Quaternion() as QuaternionLike).setFromUnitVectors(
      new THREE.Vector3(0, 1, 0) as Vector3Like,
      direction.normalize(),
    );
    const tubeTransform = (new THREE.Matrix4() as Matrix4Like).compose(
      start,
      rotation,
      new THREE.Vector3(1, 1, 1) as Vector3Like,
    );
    const previousTransform = this.transform;
    this.transform = previousTransform
      ? previousTransform.clone().multiply(tubeTransform)
      : tubeTransform;
    this.cyl(0, 0, 0, radius, radius, length, segmentCount, caps);
    this.transform = previousTransform;
    return this;
  }
  // arbitrary transformed sub-build
  with(
    transform: Matrix4Like,
    buildPart: (builder: MeshBuilder) => void,
  ): this {
    const previousTransform = this.transform;
    this.transform = previousTransform
      ? previousTransform.clone().multiply(transform)
      : transform;
    buildPart(this);
    this.transform = previousTransform;
    return this;
  }
  merge(other: MeshBuilder): this {
    const vertexOffset = this.vertexCount;
    this.positions.push(...other.positions);
    this.normals.push(...other.normals);
    this.colors.push(...other.colors);
    this.uvCoordinates.push(...other.uvCoordinates);
    this.parts.push(...other.parts);
    for (const index of other.indices) {
      this.indices.push(index + vertexOffset);
    }
    this.vertexCount += other.vertexCount;
    return this;
  }
  build({ part = false }: { part?: boolean } = {}): BufferGeometryLike {
    const geometry = new THREE.BufferGeometry() as BufferGeometryLike;
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(this.positions, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(this.normals, 3),
    );
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(this.colors, 3),
    );
    geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(this.uvCoordinates, 2),
    );
    if (part)
      geometry.setAttribute(
        "aPart",
        new THREE.Float32BufferAttribute(this.parts, 1),
      );
    geometry.setIndex(
      this.vertexCount > 65535
        ? new THREE.Uint32BufferAttribute(this.indices, 1)
        : new THREE.Uint16BufferAttribute(this.indices, 1),
    );
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}

export const createTransformMatrix = (
  x = 0,
  y = 0,
  z = 0,
  rotationY = 0,
  scale = 1,
): Matrix4Like =>
  (new THREE.Matrix4() as Matrix4Like).compose(
    new THREE.Vector3(x, y, z) as Vector3Like,
    (new THREE.Quaternion() as QuaternionLike).setFromAxisAngle(
      new THREE.Vector3(0, 1, 0) as Vector3Like,
      rotationY,
    ),
    new THREE.Vector3(scale, scale, scale) as Vector3Like,
  );
export const linearColorFromHex = (hexColor: number): number[] =>
  [
    ((hexColor >> 16) & 255) / 255,
    ((hexColor >> 8) & 255) / 255,
    (hexColor & 255) / 255,
  ].map((channel) =>
    Math.pow(channel, 2.2),
  );
