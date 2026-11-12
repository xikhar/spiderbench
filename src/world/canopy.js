// OWNER: foundation agent (city remake). Cheap distant tree canopies for the far shores (back yards, parks, street
// rows, the Palisades woods): one InstancedMesh of lumpy low-poly blobs (20-tri icosahedra, per-instance squash and
// tone), shaded darker underneath / inside so clumps read as foliage masses from the air, casting shadows.
// Not for Manhattan's own streets / park (trees.js owns those, with real leaf cards and LODs).
import * as THREE from "three";
import { mulberry32 } from "./layout.js";

// muted late-season palette matching trees.js (olive / dusty greens, a few ochre / rust crowns)
const PAL = [
    [0.13, 0.16, 0.085],
    [0.15, 0.18, 0.1],
    [0.11, 0.145, 0.08],
    [0.17, 0.19, 0.11],
    [0.13, 0.165, 0.11],
    [0.25, 0.2, 0.09],
    [0.28, 0.17, 0.08],
    [0.2, 0.19, 0.1],
];

export class CanopyBatch {
    // opts.palette: [[r,g,b], ...] (first 5 = main tones, rest = accent picked with the `autumn` share)
    // opts.fade: [d0, d1] -> crowns grow in from nothing at d0 to full size at d1 from the camera (an HLOD 'far fill'
    // behind real near trees: they never show up close as low-poly blobs)
    constructor(seed = 1, opts = {}) {
        this.rnd = mulberry32(seed);
        this.M = [];
        this.C = [];
        this.pal = opts.palette ?? PAL;
        this.fade = opts.fade ?? null;
        this.squash = opts.squash ?? 1;
        this.shape = opts.shape ?? "blob";
    }
    // crown centred at (x, y + h) with radius r; tone jitter from the palette (autumn = share of ochre / rust crowns)
    // sq (optional): per-crown vertical squash overriding the batch's (round 8: umbrella elms / columnar crowns)
    add(x, y, z, r, autumn = 0.25, sq = null) {
        const rnd = this.rnd;
        const P = this.pal,
            c =
                P[
                    rnd() < autumn
                        ? 5 + Math.floor(rnd() * (P.length - 5))
                        : Math.floor(rnd() * 5)
                ],
            k = 0.8 + rnd() * 0.4;
        const sy = (0.75 + rnd() * 0.3) * (sq ?? this.squash),
            sx = r * (0.9 + rnd() * 0.2),
            sz = r * (0.9 + rnd() * 0.2);
        const m = new THREE.Matrix4().compose(
            new THREE.Vector3(x, y + r * sy * 0.9 + r * 0.35, z),
            new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                rnd() * 6.28,
            ),
            new THREE.Vector3(sx, r * sy, sz),
        );
        this.M.push(m);
        this.C.push(c[0] * k, c[1] * k, c[2] * k);
    }
    // a clump: n crowns scattered in a disc
    clump(x, y, z, R, n, rMin = 3, rMax = 6, autumn = 0.25) {
        for (let i = 0; i < n; i++) {
            const a = this.rnd() * Math.PI * 2,
                d = R * Math.sqrt(this.rnd());
            this.add(
                x + Math.cos(a) * d,
                y,
                z + Math.sin(a) * d,
                rMin + this.rnd() * (rMax - rMin),
                autumn,
            );
        }
    }
    get count() {
        return this.M.length;
    }
    // opts.tile: split the instances into square tiles of this size (m) -> per-tile frustum / shadow-cascade culling;
    // opts.smallCasters: skip the far shadow cascades (render/csm.js). Returns the first mesh (all are added to scene).
    build(scene, name = "canopy", castShadow = true, opts = {}) {
        if (!this.M.length) return null;
        if (opts.tile) {
            const cells = new Map(),
                _p = new THREE.Vector3();
            this.M.forEach((m, i) => {
                _p.setFromMatrixPosition(m);
                const k =
                    Math.floor(_p.x / opts.tile) +
                    "," +
                    Math.floor(_p.z / opts.tile);
                if (!cells.has(k)) cells.set(k, []);
                cells.get(k).push(i);
            });
            let first = null;
            for (const idx of cells.values()) {
                const sub = new CanopyBatch(1, {
                    palette: this.pal,
                    fade: this.fade,
                    squash: this.squash,
                    shape: this.shape,
                });
                sub.M = idx.map((i) => this.M[i]);
                sub.C = idx.flatMap((i) => [
                    this.C[i * 3],
                    this.C[i * 3 + 1],
                    this.C[i * 3 + 2],
                ]);
                sub._geo = this._geo;
                sub._mat = this._mat;
                const m = sub.build(scene, name, castShadow, {
                    smallCasters: opts.smallCasters,
                });
                this._geo = sub._geo;
                this._mat = sub._mat;
                first ??= m;
            }
            return first;
        }
        // (round 8) shape 'cone': conifers (pines / spruces) -- a lumpy 7-sided spire, so park woods mix silhouettes
        const geo =
            this._geo ??
            (this.shape === "cone"
                ? new THREE.ConeGeometry(0.62, 2.3, 7, 3).translate(0, 0.25, 0)
                : new THREE.IcosahedronGeometry(1, 0));
        if (!this._geo) {
            // lumpy: push a few vertices in/out (shared positions keep the mesh closed)
            const pos = geo.attributes.position,
                rnd = mulberry32(3);
            const bump = new Map();
            for (let i = 0; i < pos.count; i++) {
                const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
                if (!bump.has(key)) bump.set(key, 0.85 + rnd() * 0.3);
                const b = bump.get(key);
                pos.setXYZ(
                    i,
                    pos.getX(i) * b,
                    pos.getY(i) * b,
                    pos.getZ(i) * b,
                );
            }
            // spherical normals (smooth, soft crown shading instead of faceted gems)
            const nrm = geo.attributes.normal;
            for (let i = 0; i < pos.count; i++) {
                const l = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
                nrm.setXYZ(
                    i,
                    pos.getX(i) / l,
                    pos.getY(i) / l,
                    pos.getZ(i) / l,
                );
            }
            this._geo = geo;
        }
        if (this._mat)
            return this._inst(scene, name, castShadow, geo, this._mat, opts);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.95,
            metalness: 0,
            flatShading: false,
        });
        this._mat = mat;
        const fade = this.fade;
        mat.onBeforeCompile = (sh) => {
            sh.vertexShader = sh.vertexShader
                .replace(
                    "#include <common>",
                    "#include <common>\nvarying float vCy; varying vec3 vCn; varying vec3 vCi;",
                )
                .replace(
                    "#include <begin_vertex>",
                    `#include <begin_vertex>
          vCy = position.y; vCn = normal; vCi = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          ${
              fade
                  ? `{ vec3 ic = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float fs = smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, length(ic - cameraPosition)); transformed *= max(fs, 1e-3); }`
                  : ""
          }`,
                );
            sh.fragmentShader = sh.fragmentShader
                .replace(
                    "#include <common>",
                    `#include <common>
          varying float vCy; varying vec3 vCn; varying vec3 vCi; float cClump;
          float cH3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
          float cVn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(cH3(i), cH3(i + vec3(1, 0, 0)), f.x), mix(cH3(i + vec3(0, 1, 0)), cH3(i + vec3(1, 1, 0)), f.x), f.y),
                       mix(mix(cH3(i + vec3(0, 0, 1)), cH3(i + vec3(1, 0, 1)), f.x), mix(cH3(i + vec3(0, 1, 1)), cH3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`,
                )
                .replace(
                    "#include <color_fragment>",
                    `#include <color_fragment>
          diffuseColor.rgb *= mix(0.45, 1.05, smoothstep(-0.9, 0.7, vCy));   // dark underside / inner crown
          diffuseColor.rgb *= 0.92 + 0.16 * fract(sin(dot(floor(vCn * 2.0 + 0.5), vec3(12.9, 78.2, 37.7))) * 4375.5); // clump tone breakup
          // (round 7) cauliflower foliage clusters: leaf-mass lumps with dark gaps between them (per-crown phase), so the
          // crowns read as trees, not smooth cotton balls / lollipops
          cClump = cVn(vCn * 3.3 + vCi * 0.137) * 0.62 + cVn(vCn * 7.9 + vCi * 0.291) * 0.38;
          diffuseColor.rgb *= mix(0.58, 1.1, smoothstep(0.28, 0.72, cClump));`,
                )
                .replace(
                    "#include <normal_fragment_maps>",
                    `#include <normal_fragment_maps>
          { vec3 sx = normalize(dFdx(-vViewPosition)), sy = normalize(dFdy(-vViewPosition));
            vec2 dh = vec2(dFdx(cClump), dFdy(cClump)) * 2.2;
            vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
            vec3 bn = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
            if (det != 0.0) normal = bn; }`,
                );
        };
        mat.customProgramCacheKey = () =>
            "far-canopy-v2" + (fade ? fade.join(",") : "") + this.shape;
        return this._inst(scene, name, castShadow, geo, mat, opts);
    }
    _inst(scene, name, castShadow, geo, mat, opts) {
        const mesh = new THREE.InstancedMesh(geo, mat, this.M.length);
        const col = new THREE.Color();
        for (let i = 0; i < this.M.length; i++) {
            mesh.setMatrixAt(i, this.M[i]);
            mesh.setColorAt(
                i,
                col.setRGB(this.C[i * 3], this.C[i * 3 + 1], this.C[i * 3 + 2]),
            );
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = castShadow && !this.fade;
        mesh.receiveShadow = true;
        mesh.name = name; // (faded fills: the shadow pass would not shrink them)
        if (opts.smallCasters) mesh.userData.smallCasters = true;
        scene.add(mesh);
        return mesh;
    }
}
