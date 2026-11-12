// @ts-nocheck
/**
 * Builds the Grand Central landmark and related scene elements.
 *
 * @module world-grandcentral
 * @version 1.0.0
 * @file src/world/grandcentral.ts
 * @since 0.0.1
 * @description Generates Grand Central Terminal geometry, placement details, and crowd-related anchor points in the city.
 */
import * as THREE from "three";
import { G, ZFIX } from "./layout.ts";
import { MB } from "./geom.ts";
import { STYLE, LAYER } from "./facade.ts";
import { registry } from "./npc/registry.ts";
import { REFL_LAYER } from "./water.ts";
import { BIG_CASTER_LAYER } from "@/render/csm.ts";

const CX = 430,
    X0 = 394,
    X1 = 466,
    ZF = -92,
    ZB = -148,
    Y0 = G.CURB_H;
const H_ARCH_B = 9.0,
    H_SPRING = 21.0,
    R_ARCH = 5.0;
const H_CAP = 25.4,
    H_ENT0 = 26.6,
    _H_ENT1 = 30.2,
    H_COR = 31.2,
    H_ATTIC = 38.5;
const ROOF_P = 0.52;
const TER_Y = 8.8,
    TER_Z1 = -84.6;
export const PARK_VIADUCT = {
    x0: CX - 3.6,
    x1: CX + 3.6,
    z0: TER_Z1,
    z1: -14,
    yTop: TER_Y,
    open1: -68,
};

export const GC_KEEP_OUT = [
    { x0: X0 - 1, x1: X1 + 1, z0: ZB - 1, z1: -84.3 },
    { x0: X0 - 7, x1: X0, z0: ZB - 1.5, z1: -84.3 },
    { x0: X1, x1: X1 + 7, z0: ZB - 1.5, z1: -84.3 },
    { x0: 384, x1: 414.2, z0: -216, z1: -184 },
    { x0: 445.8, x1: 476, z0: -216, z1: -184 },
];

(registry.laneClosures ??= []).push({
    x0: PARK_VIADUCT.x0,
    x1: PARK_VIADUCT.x1,
    z0: PARK_VIADUCT.open1,
    z1: PARK_VIADUCT.z1 + 1,
});

const STONE = 0xbab09a,
    STONE_D = 0xa89d88,
    CREAM_S = 0xc8bea5,
    COPPER = 0x72907f,
    SCULPT = 0x958d7c,
    BRONZE = 0x5e5840,
    ASPH = 0x5b5e60,
    _IRON = 0x2c3130,
    CREAM = 0xe6dcc0;

function addGeo(mb, geo, m, color, part) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position,
        N = g.attributes.normal;
    mb.setColor(color).setPart(part);
    const prev = mb.xf;
    mb.xf = m;
    const base = mb.v;
    for (let i = 0; i < P.count; i++)
        mb.vert(
            P.getX(i),
            P.getY(i),
            P.getZ(i),
            N.getX(i),
            N.getY(i),
            N.getZ(i),
            P.getX(i),
            P.getY(i),
        );
    for (let i = 0; i < P.count; i += 3)
        mb.tri(base + i, base + i + 1, base + i + 2);
    mb.xf = prev;
}

const frame = (o, t, n) =>
    new THREE.Matrix4().set(
        t[0],
        0,
        n[0],
        o[0],
        t[1],
        1,
        n[1],
        o[1],
        t[2],
        0,
        n[2],
        o[2],
        0,
        0,
        0,
        1,
    );
function openingPath(h, path = new THREE.Path()) {
    if (h.arch) {
        path.moveTo(h.u - h.w / 2, h.y0);
        path.lineTo(h.u + h.w / 2, h.y0);
        path.lineTo(h.u + h.w / 2, h.ys);
        path.absarc(h.u, h.ys, h.w / 2, 0, Math.PI, false);
        path.lineTo(h.u - h.w / 2, h.y0);
    } else {
        path.moveTo(h.u - h.w / 2, h.y0);
        path.lineTo(h.u + h.w / 2, h.y0);
        path.lineTo(h.u + h.w / 2, h.y1);
        path.lineTo(h.u - h.w / 2, h.y1);
        path.lineTo(h.u - h.w / 2, h.y0);
    }
    return path;
}

function wall(
    mb,
    glass,
    M,
    u0,
    u1,
    y0,
    y1,
    depth,
    holes,
    color = STONE,
    part = 0,
    recess = 0.9,
) {
    if (ZFIX)
        holes = holes.map((h) =>
            h.y0 <= y0 + 1e-3 ? { ...h, y0: y0 + 0.012 } : h,
        );
    const s = new THREE.Shape();
    s.moveTo(u0, y0);
    s.lineTo(u1, y0);
    s.lineTo(u1, y1);
    s.lineTo(u0, y1);
    s.lineTo(u0, y0);
    for (const h of holes) s.holes.push(openingPath(h));
    const g = new THREE.ExtrudeGeometry(s, {
        depth,
        bevelEnabled: false,
        curveSegments: 12,
    });
    addGeo(
        mb,
        g,
        M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -depth)),
        color,
        part,
    );
    g.dispose();
    for (const h of holes) {
        if (h.door && h.glaze) {
            const sg = new THREE.ShapeGeometry(
                new THREE.Shape(openingPath(h).getPoints(12)),
            );
            sg.applyMatrix4(
                M.clone().multiply(
                    new THREE.Matrix4().makeTranslation(0, 0, -depth + 0.3),
                ),
            );
            glass.push(sg);
            mb.setColor(0x4a3c28).setPart(5).setXf(M);
            const zb = -depth + 0.3,
                zf = zb + 0.14,
                x0 = h.u - h.w / 2,
                x1 = h.u + h.w / 2;
            mb.box(x0, h.y0, zb, x0 + 0.18, h.y1, zf).box(
                x1 - 0.18,
                h.y0,
                zb,
                x1,
                h.y1,
                zf,
            );
            mb.box(x0, h.y1 - 1.5, zb, x1, h.y1 - 1.3, zf).box(
                x0,
                h.y0,
                zb,
                x1,
                h.y0 + 0.3,
                zf,
            );
            for (let k = 1; k < 4; k++) {
                const x = x0 + ((x1 - x0) * k) / 4;
                mb.box(x - 0.07, h.y0, zb, x + 0.07, h.y1, zf);
            }
            mb.box(
                h.u - 0.5,
                h.y1 - 1.25,
                zb,
                h.u + 0.5,
                h.y1 - 0.25,
                zf + 0.04,
            );
            mb.setXf(null);
            continue;
        }
        if (h.door) {
            const d = new THREE.ShapeGeometry(
                new THREE.Shape(openingPath(h).getPoints(12)),
            );
            addGeo(
                mb,
                d,
                M.clone().multiply(
                    new THREE.Matrix4().makeTranslation(0, 0, -depth + 0.1),
                ),
                0x1a1c1c,
                5,
            );
            continue;
        }
        const sg = new THREE.ShapeGeometry(
            new THREE.Shape(openingPath(h).getPoints(16)),
            12,
        );
        sg.applyMatrix4(
            M.clone().multiply(
                new THREE.Matrix4().makeTranslation(0, 0, -recess),
            ),
        );
        glass.push(sg);
    }
}

function stoneMaterial(T) {
    const m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.86,
    });
    m.onBeforeCompile = (sh) => {
        sh.uniforms.tGN = { value: T?.noise ?? null };
        sh.uniforms.tGWC = { value: T?.wallsCol ?? null };
        sh.uniforms.tGWH = { value: T?.wallsHao ?? null };
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nattribute float aPart; varying float vGP; varying vec3 vGW; varying vec3 vGN;",
            )
            .replace(
                "#include <fog_vertex>",
                "#include <fog_vertex>\nvGP = aPart; vGW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGN = normalize(mat3(modelMatrix) * objectNormal);",
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      uniform sampler2D tGN; varying float vGP; varying vec3 vGW; varying vec3 vGN;
      uniform highp sampler2DArray tGWC; uniform highp sampler2DArray tGWH; // (textures r5)
      float gh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float gV = 0.0;   // (street r8) verdigris amount (bronze part 8)
      float gH = 0.0;   // (street r2) carved height (m, <= 0 in joints) -> bump-mapped normal
      vec3 gcPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
        vec3 vSigmaX = normalize(dFdx(surf_pos)), vSigmaY = normalize(dFdy(surf_pos)), vN = surf_norm;
        vec3 R1 = cross(vSigmaY, vN), R2 = cross(vN, vSigmaX);
        float fDet = dot(vSigmaX, R1) * faceDir;
        vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
        return normalize(abs(fDet) * surf_norm - vGrad);
      }`,
            )
            .replace(
                "#include <map_fragment>",
                `#include <map_fragment>
      {
        vec3 an = abs(vGN);
        vec2 q = an.x > an.z ? vGW.zy : vGW.xy; if (an.y > 0.7) q = vGW.xz;
        vec3 nz = texture(tGN, q / 13.0).rgb, nz2 = texture(tGN, q / 2.7 + 0.31).rgb;
        int part = int(vGP + 0.5);
        vec3 c = diffuseColor.rgb;
        if (part == 0) {
          // limestone ashlar: 0.75 m courses, 1.5 m blocks, thin joints; per-block tone; grime washing down
          float cy = q.y / 0.62, row = floor(cy), cx = q.x / 1.25 + 0.5 * mod(row, 2.0);
          vec2 f = vec2(fract(cx), fract(cy)); vec2 fw = fwidth(vec2(cx, cy)) * 1.5 + 1e-4;
          float joint = max(1.0 - smoothstep(0.0, 0.025 + fw.x, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, 0.035 + fw.y, min(f.y, 1.0 - f.y)));
          joint *= (1.0 - smoothstep(0.15, 0.5, max(fw.x, fw.y))) * (1.0 - an.y);
          float blk = gh(floor(vec2(cx, cy)));
          c *= (0.94 + 0.07 * blk) * (0.86 + 0.22 * nz.r) * (0.94 + 0.08 * nz2.g);
          c *= 1.0 - 0.17 * joint;
          // channelled rustication on the ground storey (below the terrace string course): deep horizontal joints
          float rus = (1.0 - smoothstep(8.4, 8.8, vGW.y)) * (1.0 - an.y);
          float jr = 1.0 - smoothstep(0.0, 0.07 + fw.y, min(f.y, 1.0 - f.y));
          c *= 1.0 - 0.22 * jr * rus;
          gH = -0.018 * joint - 0.05 * jr * rus;
          // rain streaks washing down from sills / cornices
          float stk = texture(tGN, vec2(q.x / 1.9, vGW.y / 34.0) + 0.17).r;
          c *= 1.0 - 0.22 * smoothstep(0.45, 0.8, stk) * (1.0 - an.y); // (street r8) 0.13 -> 0.22
        } else if (part == 1 || part == 3 || part == 7) {
          c *= (0.88 + 0.2 * nz.r) * (0.94 + 0.08 * nz2.g);
          if (part == 7) { // (street r6) fluted column shafts: 24 flutes from the normal's azimuth (bump + cavity shade)
            float az = atan(vGN.z, vGN.x) * 12.0 / 3.14159265;
            float fl = abs(fract(az) - 0.5) * 2.0;           // 0 at the arris, 1 mid-flute
            float cav = smoothstep(0.15, 0.95, fl);
            gH = -0.06 * cav;
            c *= 1.0 - 0.2 * cav * (1.0 - an.y);
          }
        } else if (part == 8) {
          // (street r8) patinated bronze statuary: dark oily bronze, verdigris washing over up-facing surfaces, runs below
          float up = clamp(vGN.y * 0.5 + 0.5, 0.0, 1.0);
          float n1 = texture(tGN, vGW.xy / 0.9 + vGW.z * 0.31).g, n2 = texture(tGN, vec2(vGW.x / 0.35 + vGW.z * 0.2, vGW.y / 3.0) + 0.21).r;
          gV = clamp(smoothstep(0.45, 0.95, up) * 0.75 + smoothstep(0.5, 0.78, n2) * 0.55 + (n1 - 0.5) * 0.5, 0.0, 1.0);
          c = mix(c * (0.75 + 0.45 * n1), vec3(0.33, 0.45, 0.38) * (0.85 + 0.3 * n2), gV * 0.8);
        } else if (part == 2) {
          // weathered copper: verdigris streaks running down the slope, darker seams
          float st = texture(tGN, vec2(q.x / 3.0, vGW.y / 40.0)).g;
          float st2 = texture(tGN, vec2(q.x / 0.9, q.y / 14.0) + 0.5).b;
          c *= (0.72 + 0.34 * st) * (0.85 + 0.25 * st2) * (0.9 + 0.15 * nz2.r);
          c = mix(c, vec3(dot(c, vec3(0.33))), 0.25);   // chalky, desaturated verdigris
          float sw = fwidth(q.x / 1.2) * 1.5 + 1e-4;
          float seam = smoothstep(0.9 - sw, 0.9, abs(fract(q.x / 1.2) - 0.5) * 2.0) * (1.0 - smoothstep(0.1, 0.4, sw));
          c *= 1.0 - 0.12 * seam;
          // (street r11) critic: 'copper roof is a flat saturated mint plane'. Old weathered copper: dark brown-bronze
          // base showing through in broad blotches and long rain runs down the slope, the verdigris only as a
          // streaky chalky crust (paler where the water washes), soot-dark near the eaves. gV carries the crust amount
          // into the roughness (crust matte, bare metal satiny).
          float cb = texture(tGN, q / 9.0 + 0.37).r, cr = texture(tGN, vec2(q.x / 1.6, vGW.y / 22.0) + 0.61).g;
          float crust = clamp(smoothstep(0.3, 0.72, cb) * 0.7 + smoothstep(0.35, 0.8, cr) * 0.55 - 0.1, 0.0, 1.0);
          vec3 bare = vec3(0.24, 0.2, 0.15) * (0.8 + 0.4 * st2);
          vec3 verd = vec3(0.43, 0.52, 0.46) * (0.82 + 0.3 * st) * (0.9 + 0.2 * cr);
          c = mix(bare, verd, crust) * (0.9 + 0.12 * nz2.r);
          c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 3.5, vGW.y - ${H_COR.toFixed(1)}));   // soot at the eaves
          c *= 1.0 - 0.12 * seam;
          gV = crust;
        } else if (part == 6) {
          c *= (0.7 + 0.5 * texture(tGN, vGW.xz / 1.3 + vGW.y * 0.3).g) * (0.8 + 0.3 * nz2.r);
        } else if (part == 4) {
          c *= (0.85 + 0.25 * nz.r) * (0.92 + 0.12 * nz2.b);
          // (street r5) deck wear: rectangular utility patches (darker fresh tar / paler old), oil blotches, sealed joints
          vec2 pc = floor(vGW.xz / vec2(3.1, 4.3)); float ph = gh(pc), ph2 = gh(pc + 7.0);
          vec2 pf = fract(vGW.xz / vec2(3.1, 4.3));
          float pm = step(0.84, ph) * step(0.12, pf.x) * step(pf.x, 0.88) * step(0.1, pf.y) * step(pf.y, 0.82);
          c *= mix(1.0, ph2 > 0.5 ? 0.78 : 1.12, pm);
          c *= 1.0 - 0.22 * smoothstep(0.62, 0.8, texture(tGN, vGW.xz / 5.3 + 0.21).b);
          float jn = abs(fract(vGW.z / 9.0) - 0.5) * 2.0; c *= 1.0 - 0.3 * smoothstep(0.975, 0.995, jn);
          // (street r6) critic: 'smooth grey slab, no tyre wear / oil'. On the Park Av ramp (two lanes along z): polished
          // darker wheel paths, an oil-drip stripe down each lane centre, and a dark wet gutter line at both parapets.
          float lx = vGW.x - ${CX.toFixed(1)};
          if (abs(lx) < 3.7) {
            float lc = abs(abs(lx) - 1.8);                       // distance from the lane centre
            float wn = texture(tGN, vec2(lx * 0.5, vGW.z / 23.0) + 0.43).r;
            float wheel = 1.0 - smoothstep(0.18, 0.5, abs(lc - 0.85));
            c *= 1.0 - 0.14 * wheel * (0.6 + 0.6 * wn);
            float drip = (1.0 - smoothstep(0.1, 0.35, lc)) * smoothstep(0.45, 0.75, texture(tGN, vec2(lx * 0.9, vGW.z / 3.1) + 0.11).g);
            c *= 1.0 - 0.28 * drip;
            float gut = 1.0 - smoothstep(0.0, 0.45, 3.6 - abs(lx));
            c *= 1.0 - 0.35 * gut * (0.7 + 0.3 * wn);
          }
        }
        // grime: soot collecting under projections + dark wash near the ground (stone only)
        if (part == 0 || part == 1 || part == 3 || part == 7) {
          c *= 1.0 - 0.2 * smoothstep(0.55, 0.85, nz.b) * (1.0 - an.y);
          c *= mix(0.78, 1.0, smoothstep(0.0, 4.0, vGW.y));
          // (street r5) critic: 'no weathering / staining under ledges, no AO where the cornice meets the wall'.
          // Contact shadow bands under the big projections + soot streaks washing down from them (walls only).
          float wall = 1.0 - an.y;
          float dC = ${H_ENT0.toFixed(2)} - vGW.y, dA = ${(H_ATTIC - 1.0).toFixed(2)} - vGW.y, dT = ${(TER_Y - 1.0).toFixed(2)} - vGW.y;
          float ao = 0.34 * step(0.0, dC) * exp(-max(dC, 0.0) * 1.1) + 0.26 * step(0.0, dA) * step(vGW.y, ${H_ATTIC.toFixed(1)}) * exp(-max(dA, 0.0) * 1.4) + 0.3 * step(0.0, dT) * exp(-max(dT, 0.0) * 0.9); // (skyline r6) max(): exp overflowed to inf at y ~250 (MetLife cap) -> 0*inf = NaN = black
          float colS = texture(tGN, vec2(q.x / 0.55, 0.37)).g, colS2 = texture(tGN, vec2(q.x / 2.3, 0.71)).b;
          float streak = smoothstep(0.52, 0.8, colS) * (0.6 + 0.6 * colS2);
          float run = step(0.0, dC) * exp(-max(dC, 0.0) / 7.0) + step(0.0, dA) * step(vGW.y, ${H_ATTIC.toFixed(1)}) * exp(-max(dA, 0.0) / 3.0);
          c *= (1.0 - ao * wall) * (1.0 - 0.3 * streak * run * wall);
          c = mix(c, c * vec3(0.93, 0.95, 0.98), 0.5 * smoothstep(12.0, 30.0, vGW.y) * wall);   // cooler, cleaner stone higher up
          // (textures r5) critic: 'Grand Central reads as pale clean plaster'. Real stone grain from the $imagegen stucco /
          // limestone layer (luminance ratio, so the part colours stay), soot streak masks (walls_hao layer 16) washing
          // down 3-14 m from the cornice / attic between the piers, and an overall aged value drop.
          vec3 gs = texture(tGWC, vec3(q / 2.4 + 0.13, 14.0)).rgb, gm = textureLod(tGWC, vec3(0.5, 0.5, 14.0), 10.0).rgb;
          c *= mix(1.0, clamp(dot(gs, vec3(0.333)) / max(dot(gm, vec3(0.333)), 0.05), 0.7, 1.3), 0.65);
          float sc = floor(q.x / 1.7), sr = gh(vec2(sc, 3.1)), sLen = 3.0 + 11.0 * sr;
          float sy = (vGW.y > ${H_ENT0.toFixed(2)} ? ${(H_ATTIC - 1.0).toFixed(2)} : ${H_ENT0.toFixed(2)}) - vGW.y;
          vec2 sq = vec2(fract(q.x / 1.7), sy / sLen);
          float sm = (sq.y > 0.0 && sq.y < 1.0) ? texture(tGWH, vec3((mod(sc, 8.0) + clamp(sq.x, 0.02, 0.98)) / 8.0, 1.0 - sq.y, 16.0)).r : 0.0;
          c *= 1.0 - 0.38 * sm * wall * step(0.35, sr);
          c *= 0.86 * mix(vec3(1.0), vec3(1.0, 0.97, 0.92), 0.5 * (1.0 - smoothstep(2.0, 12.0, vGW.y)));
        }
        diffuseColor.rgb = c;
      }`,
            )
            .replace(
                "#include <roughnessmap_fragment>",
                `#include <roughnessmap_fragment>
        if (int(vGP + 0.5) == 2) roughnessFactor = 0.42 + 0.45 * gV;  else if (int(vGP + 0.5) == 5) roughnessFactor = 0.45; else if (int(vGP + 0.5) == 8) roughnessFactor = 0.42 + 0.4 * gV;`,
            )
            .replace(
                "#include <metalnessmap_fragment>",
                `#include <metalnessmap_fragment>
        if (int(vGP + 0.5) == 8) metalnessFactor = 0.55 * (1.0 - gV); else if (int(vGP + 0.5) == 2) metalnessFactor = 0.35 * (1.0 - gV);`,
            )
            .replace(
                "#include <normal_fragment_maps>",
                `#include <normal_fragment_maps>
        {
          vec2 dH = vec2(dFdx(gH) / max(length(dFdx(vViewPosition)), 1e-4), dFdy(gH) / max(length(dFdy(vViewPosition)), 1e-4));
          dH = clamp(dH, vec2(-0.8), vec2(0.8));
          if (abs(dH.x) + abs(dH.y) > 1e-4) normal = gcPerturb(-vViewPosition, normal, dH, faceDirection);
        }`,
            );
    };
    m.customProgramCacheKey = () => "gc-stone-v10";
    return m;
}
function glassMaterial() {
    const m = new THREE.MeshStandardMaterial({
        color: 0x4d5857,
        roughness: 0.1,
        metalness: 0.6,
    });
    m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying vec2 vGU; varying vec3 vGWp; varying vec3 vGNp;",
            )
            .replace("#include <uv_vertex>", "#include <uv_vertex>\nvGU = uv;")
            .replace(
                "#include <fog_vertex>",
                "#include <fog_vertex>\nvGWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vGNp = normalize(mat3(modelMatrix) * objectNormal);",
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      varying vec2 vGU; varying vec3 vGWp; varying vec3 vGNp; float vGMull = 0.0; vec3 gInt = vec3(0.0);
      float gGrid(vec2 q, vec2 per, vec2 w) { vec2 g = q / per; vec2 fw = fwidth(g) + 1e-4; vec2 d = abs(fract(g) - 0.5) * 2.0;
        return max(smoothstep(1.0 - w.x - fw.x * 2.0, 1.0 - w.x, d.x), smoothstep(1.0 - w.y - fw.y * 2.0, 1.0 - w.y, d.y)) * (1.0 - smoothstep(0.3, 0.7, max(fw.x, fw.y))); }`,
            )
            .replace(
                "#include <map_fragment>",
                `#include <map_fragment>
      {
        // fine muntins on the outer skin (the heavy bars are real geometry)
        float mull = gGrid(vGU, vec2(0.5, 0.65), vec2(0.1, 0.08));
        vec3 V = normalize(vGWp - cameraPosition), n = normalize(vGNp);
        float cv = max(dot(V, -n), 0.08);
        vec3 tW = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4));
        // inner skin 1.2 m in
        vec3 h1 = vGWp + V * (1.2 / cv);
        float m1 = gGrid(vec2(dot(h1, tW), h1.y), vec2(1.0, 1.3), vec2(0.12, 0.1));
        // concourse: far wall 30 m in, floor at y = 1
        float tb = 30.0 / cv, tf = V.y < -0.01 ? (vGWp.y - 1.0) / -V.y : 1e5;
        vec3 col;
        if (tf < tb) {
          vec3 hf = vGWp + V * tf;
          vec2 fq = vec2(dot(hf, tW), dot(hf, n));
          float tile = gGrid(fq, vec2(1.6, 1.6), vec2(0.04, 0.04));
          col = vec3(0.34, 0.28, 0.2) * (0.85 + 0.15 * sin(fq.x * 0.37) * sin(fq.y * 0.29)) * (1.0 - 0.3 * tile);
          col *= 0.55 + 0.45 * exp(-tf * 0.02);
        } else {
          vec3 hb = vGWp + V * tb;
          vec2 bq = vec2(dot(hb, tW), hb.y);
          col = vec3(0.2, 0.15, 0.1) * (0.7 + 0.3 * smoothstep(20.0, 4.0, bq.y));            // warm stone hall, lit low
          float ax = mod(bq.x + 7.5, 15.0) - 7.5;                                            // the far wall's arched windows
          float arch = step(abs(ax), 4.0) * step(9.0, bq.y) * step(bq.y, 21.0 + sqrt(max(0.0, 16.0 - ax * ax)));
          col = mix(col, vec3(0.34, 0.36, 0.38), arch * (1.0 - 0.6 * gGrid(bq, vec2(1.0, 1.3), vec2(0.14, 0.12))));
          vec2 ch = vec2(mod(bq.x, 7.5) - 3.75, bq.y - 12.5);                                  // chandelier glows
          col += vec3(1.0, 0.72, 0.4) * 0.9 * exp(-dot(ch, ch) * 0.9);
          col += vec3(0.45, 0.4, 0.3) * smoothstep(24.0, 30.0, bq.y) * 0.4;                    // barrel ceiling (painted sky)
        }
        col *= 1.0 - 0.55 * m1;
        gInt = col;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.47, 0.44), mull * 0.45); // (street r5) pale painted muntins, faint (read as glazing, not a dark grid decal)
        vGMull = mull;
      }`,
            )
            .replace(
                "#include <roughnessmap_fragment>",
                "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, vGMull);",
            )
            .replace(
                "#include <metalnessmap_fragment>",
                "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.2, vGMull);",
            )
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>
        {
          float cv2 = max(dot(normalize(cameraPosition - vGWp), normalize(vGNp)), 0.0);
          float fres = 0.08 + 0.92 * pow(1.0 - cv2, 5.0);
          totalEmissiveRadiance += gInt * (1.0 - fres) * (1.0 - vGMull * 0.5) * 1.15; /* (street r10) 0.85 -> 1.15: warm concourse glow behind the deep reveals */ // (street r6) dimmer: deep, dark hall // (street r5) warmer interior glow
        }`,
            );
    };
    m.customProgramCacheKey = () => "gc-glass-v6";
    return m;
}

export function buildGrandCentral({ scene, gen, T }) {
    const S = gen.solids,
        Z = gen.zips;
    const mb = new MB(),
        glass = [],
        gw = new MB();
    const box = (
        x0,
        y0,
        z0,
        x1,
        y1,
        z1,
        color = STONE,
        part = 0,
        kind = "wall",
        col = true,
    ) => {
        mb.setColor(color).setPart(part).box(x0, y0, z0, x1, y1, z1);
        if (col && S) S.box(x0, y0, z0, x1, y1, z1, kind);
    };
    const cylZ = (x, y, z0, z1, r, color, part) => {
        const g = new THREE.CylinderGeometry(r, r, z1 - z0, 40);
        addGeo(
            mb,
            g,
            new THREE.Matrix4().compose(
                new THREE.Vector3(x, y, (z0 + z1) / 2),
                new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(1, 0, 0),
                    Math.PI / 2,
                ),
                new THREE.Vector3(1, 1, 1),
            ),
            color,
            part,
        );
        g.dispose();
    };
    const cylY = (
        cx,
        cz,
        y0,
        y1,
        r0,
        r1,
        seg,
        color,
        part,
        kind = "wall",
        col = true,
    ) => {
        mb.setColor(color)
            .setPart(part)
            .cyl(cx, y0, cz, r0, r1, y1 - y0, seg);
        if (col && S) {
            const k = (1 + Math.cos(Math.PI / seg)) / 2;
            S.cyl(cx, cz, y0, y1, r0 * k, r1 * k, kind);
        }
    };

    const RECESS_Z = ZF - 2.4;

    mb.setColor(0x8e877a)
        .setPart(1)
        .box(X0, Y0, ZB, X1, H_COR, RECESS_Z, 1 << 2);
    if (S) S.box(X0, Y0, ZB, X1, H_COR, RECESS_Z, "roof");

    const MS = frame([CX, 0, ZF], [1, 0, 0], [0, 0, 1]);
    const arches = [-15, 0, 15].map((u) => ({
        u,
        w: 2 * R_ARCH,
        y0: H_ARCH_B,
        ys: H_SPRING,
        arch: true,
    }));
    const doors = [-15, 0, 15].map((u) => ({
        u,
        w: 5.2,
        y0: Y0,
        y1: 5.4,
        door: true,
        glaze: true,
    }));
    wall(
        mb,
        glass,
        MS,
        -25,
        25,
        Y0,
        H_ENT0,
        2.5,
        [...arches, ...doors],
        STONE,
        0,
        2.4,
    );

    for (const u of [-15, 0, 15]) {
        const ring = (rOut, rIn, z, d, color, part) => {
            const sh = new THREE.Shape();
            sh.moveTo(-rOut, H_ARCH_B);
            sh.lineTo(-rOut, H_SPRING);
            sh.absarc(0, H_SPRING, rOut, Math.PI, 0, true);
            sh.lineTo(rOut, H_ARCH_B);
            sh.lineTo(rIn, H_ARCH_B);
            sh.lineTo(rIn, H_SPRING);
            sh.absarc(0, H_SPRING, rIn, 0, Math.PI, false);
            sh.lineTo(-rIn, H_ARCH_B);
            const g = new THREE.ExtrudeGeometry(sh, {
                depth: d,
                bevelEnabled: false,
                curveSegments: 20,
            });
            addGeo(
                mb,
                g,
                new THREE.Matrix4().makeTranslation(CX + u, 0, z),
                color,
                part,
            );
            g.dispose();
        };
        ring(R_ARCH + 0.01, R_ARCH - 0.45, RECESS_Z - 0.02, 0.38, STONE_D, 1);
        ring(R_ARCH - 0.45, R_ARCH - 0.67, RECESS_Z - 0.02, 0.3, 0x5f6a63, 5);
        mb.setColor(STONE_D)
            .setPart(1)
            .box(
                CX + u - R_ARCH,
                H_ARCH_B - 0.02,
                RECESS_Z - 0.02,
                CX + u + R_ARCH,
                H_ARCH_B + 0.35,
                RECESS_Z + 0.55,
            );
        if (S) {
            S.box(
                CX + u - R_ARCH,
                H_ARCH_B - 0.02,
                RECESS_Z - 0.02,
                CX + u + R_ARCH,
                H_ARCH_B + 0.35,
                RECESS_Z + 0.55,
                "ledge",
            );
            for (const sg of [-1, 1])
                S.box(
                    Math.min(
                        CX + u + sg * R_ARCH,
                        CX + u + sg * (R_ARCH - 0.67),
                    ),
                    H_ARCH_B,
                    RECESS_Z - 0.02,
                    Math.max(
                        CX + u + sg * R_ARCH,
                        CX + u + sg * (R_ARCH - 0.67),
                    ),
                    H_SPRING,
                    RECESS_Z + 0.36,
                    "wall",
                );
        }
    }
    mb.setColor(0x505a55).setPart(5);
    for (const u of [-15, 0, 15]) {
        const z0 = RECESS_Z,
            z1 = RECESS_Z + 0.26;
        for (let k = 1; k < 10; k++) {
            const dx = -R_ARCH + k,
                top = H_SPRING + Math.sqrt(R_ARCH * R_ARCH - dx * dx),
                w = k === 5 ? 0.13 : 0.08;
            mb.box(
                CX + u + dx - w,
                H_ARCH_B,
                z0,
                CX + u + dx + w,
                top,
                z1,
                0b110011,
            );
        }
        for (
            let r = 1, y = H_ARCH_B + 1.3;
            y < H_SPRING + R_ARCH - 0.3;
            y += 1.3, r++
        ) {
            const hw =
                y <= H_SPRING
                    ? R_ARCH
                    : Math.sqrt(
                          Math.max(0, R_ARCH * R_ARCH - (y - H_SPRING) ** 2),
                      );
            const t = r % 3 === 0 ? 0.16 : 0.07;
            mb.box(
                CX + u - hw,
                y - t,
                z0,
                CX + u + hw,
                y + t,
                z1 + (r % 3 === 0 ? 0.08 : 0),
                0b111100,
            );
        }
    }

    if (S) {
        const zA = ZF - 2.5,
            zB2 = ZF;
        const spans = [
            [-25, -20],
            [-10, -5],
            [5, 10],
            [20, 25],
        ];
        for (const [a, b] of spans)
            S.box(CX + a, Y0, zA, CX + b, H_ENT0, zB2, "wall");
        for (const u of [-15, 0, 15]) {
            S.box(CX + u - 5, 5.4, zA, CX + u + 5, H_ARCH_B, zB2, "wall");
            S.box(CX + u - 5, Y0, zA, CX + u - 2.6, 5.4, zB2, "wall");
            S.box(CX + u + 2.6, Y0, zA, CX + u + 5, 5.4, zB2, "wall");
            const n = 12;
            for (let i = 0; i < n; i++) {
                const a0 = -R_ARCH + (2 * R_ARCH * i) / n,
                    a1 = a0 + (2 * R_ARCH) / n;
                const am = Math.min(Math.abs(a0), Math.abs(a1));
                const yc =
                    H_SPRING +
                    Math.sqrt(Math.max(0, R_ARCH * R_ARCH - am * am));
                S.box(CX + u + a0, yc, zA, CX + u + a1, H_ENT0, zB2, "wall");
            }
        }
    }

    box(
        X0 + 0.5,
        TER_Y - 0.1,
        ZF,
        X1 - 0.5,
        TER_Y + 0.35,
        ZF + 0.35,
        STONE_D,
        1,
        "ledge",
    );

    for (const sg of [-1, 1]) {
        const u0 = sg < 0 ? -36 : 25,
            u1 = sg < 0 ? -25 : 36,
            uc = (u0 + u1) / 2;
        const MP = frame([CX, 0, ZF + 1.0], [1, 0, 0], [0, 0, 1]);
        const win = [
            [10.4, 14.6],
            [16.4, 20.6],
            [22.2, 25.2],
        ].map(([a, b]) => ({ u: uc, w: 2.8, y0: a, y1: b }));
        wall(
            mb,
            glass,
            MP,
            u0,
            u1,
            Y0,
            H_ENT0,
            1.0 + 0.02,
            [
                ...win,
                { u: uc, w: 3.6, y0: Y0, y1: 5.6, door: true, glaze: true },
            ],
            STONE,
            0,
            0.45,
        );
        if (S) S.box(CX + u0, Y0, ZF - 0.02, CX + u1, H_ENT0, ZF + 1.0, "wall");

        if (gen.buildings)
            for (const e of [u0 + 2.6, u1 - 2.6]) {
                const bx0 = CX + e,
                    by = 15.4,
                    bz = ZF + 1.0;
                mb.setColor(0xc9b27a)
                    .setPart(5)
                    .tube([bx0, by, bz], [bx0, by + 1.8, bz + 2.6], 0.045, 6);
                (gen.buildings.flags ??= []).push({
                    top: new THREE.Vector3(bx0, by + 1.8, bz + 2.6),
                    base: new THREE.Vector3(bx0, by, bz),
                    N: [0, 0, 1],
                    T: [1, 0, 0],
                    color: e < 0 ? 0 : 2,
                });
            }

        for (const [sa, sb] of [
            [u0 + 0.6, uc - 2.4],
            [uc + 2.4, u1 - 0.6],
        ]) {
            const xa = CX + sa,
                xb = CX + sb,
                zf = ZF + 1.0;
            box(
                xa - 0.12,
                Y0,
                zf,
                xb + 0.12,
                4.6,
                zf + 0.14,
                0x3a3128,
                5,
                "wall",
            );
            gw.setColor(0xe8c894).box(
                xa + 0.05,
                Y0 + 0.45,
                zf + 0.14,
                xb - 0.05,
                2.2,
                zf + 0.15,
                0b010000,
            );
            gw.setColor(0xf2dcae).box(
                xa + 0.05,
                2.2,
                zf + 0.14,
                xb - 0.05,
                3.3,
                zf + 0.15,
                0b010000,
            );
            mb.setColor(0x2a241e).setPart(5);
            for (let x = xa + 0.05; x <= xb; x += (xb - xa - 0.1) / 3)
                mb.box(
                    x - 0.04,
                    Y0 + 0.4,
                    zf + 0.15,
                    x + 0.04,
                    3.35,
                    zf + 0.2,
                    0b010000,
                );
            mb.box(xa, 3.3, zf + 0.15, xb, 3.45, zf + 0.2, 0b010000).box(
                xa,
                Y0 + 0.35,
                zf + 0.15,
                xb,
                Y0 + 0.47,
                zf + 0.2,
                0b010000,
            );
            mb.setColor(0x1c1a18)
                .setPart(1)
                .box(xa, 3.55, zf + 0.15, xb, 4.45, zf + 0.21, 0b010100);
            if (S)
                S.box(xa, Y0 + 0.35, zf + 0.14, xb, 4.45, zf + 0.215, "wall");
            gw.setColor(0xd9cfb6);
            for (let x = xa + 0.35, i = 0; x < xb - 0.45; x += 0.38, i++)
                if (i % 5 !== 3)
                    gw.box(
                        x,
                        3.82,
                        zf + 0.215,
                        x + 0.26,
                        4.16,
                        zf + 0.22,
                        0b010000,
                    );
        }

        for (const e of [u0 + 0.9, u1 - 0.9])
            box(
                CX + e - 0.9,
                9.0,
                ZF + 1.0,
                CX + e + 0.9,
                H_CAP,
                ZF + 1.35,
                STONE,
                0,
                "wall",
            );

        for (const [a, b] of [
            [10.4, 14.6],
            [16.4, 20.6],
            [22.2, 25.2],
        ]) {
            box(
                CX + uc - 1.8,
                a - 0.5,
                ZF + 1.0,
                CX + uc + 1.8,
                a - 0.15,
                ZF + 1.3,
                STONE_D,
                1,
                "ledge",
            );
            box(
                CX + uc - 1.8,
                b + 0.1,
                ZF + 1.0,
                CX + uc + 1.8,
                b + 0.5,
                ZF + 1.3,
                STONE_D,
                1,
                "ledge",
            );
        }
    }

    for (const pu of [-22.5, -7.5, 7.5, 22.5]) {
        box(
            CX + pu - 2.4,
            Y0,
            ZF,
            CX + pu + 2.4,
            H_ARCH_B,
            ZF + 1.8,
            STONE_D,
            0,
            "wall",
        );
        box(
            CX + pu - 2.6,
            H_ARCH_B - 0.5,
            ZF,
            CX + pu + 2.6,
            H_ARCH_B,
            ZF + 2.0,
            STONE,
            1,
            "ledge",
        );
        for (const d of [-1.25, 1.25]) {
            const x = CX + pu + d,
                z = ZF + 0.9;
            cylY(
                x,
                z,
                H_ARCH_B,
                H_ARCH_B + 0.6,
                0.95,
                0.95,
                14,
                STONE,
                1,
                "wall",
            );
            cylY(x, z, H_ARCH_B + 0.6, H_CAP, 0.82, 0.72, 28, STONE, 7, "wall");

            cylY(
                x,
                z,
                H_CAP - 0.12,
                H_CAP + 0.06,
                0.8,
                0.8,
                20,
                CREAM_S,
                1,
                "wall",
            );
            cylY(
                x,
                z,
                H_CAP + 0.06,
                H_ENT0 - 0.28,
                0.72,
                0.96,
                20,
                STONE,
                1,
                "wall",
            );
            {
                const LF = new THREE.SphereGeometry(1, 6, 5);
                for (let tier = 0; tier < 2; tier++)
                    for (let k = 0; k < 8; k++) {
                        const a = ((k + tier * 0.5) / 8) * Math.PI * 2,
                            rr = 0.78 + tier * 0.1,
                            yy = H_CAP + 0.32 + tier * 0.36;
                        addGeo(
                            mb,
                            LF,
                            new THREE.Matrix4().compose(
                                new THREE.Vector3(
                                    x + Math.cos(a) * rr,
                                    yy,
                                    z + Math.sin(a) * rr,
                                ),
                                new THREE.Quaternion().setFromAxisAngle(
                                    new THREE.Vector3(0, 1, 0),
                                    -a,
                                ),
                                new THREE.Vector3(0.1, 0.3, 0.2),
                            ),
                            CREAM_S,
                            3,
                        );
                    }
                for (const [dx, dz] of [
                    [-1, 1],
                    [1, 1],
                    [-1, -1],
                    [1, -1],
                ])
                    addGeo(
                        mb,
                        LF,
                        new THREE.Matrix4()
                            .makeScale(0.2, 0.2, 0.2)
                            .setPosition(
                                x + dx * 0.78,
                                H_ENT0 - 0.42,
                                z + dz * 0.78,
                            ),
                        CREAM_S,
                        3,
                    );
                LF.dispose();
            }
            box(
                x - 1.05,
                H_ENT0 - 0.28,
                z - 1.05,
                x + 1.05,
                H_ENT0,
                z + 1.05,
                CREAM_S,
                1,
                "wall",
            );
        }
    }

    const _pa = new THREE.Vector3(),
        _pb = new THREE.Vector3();
    const fbox = (
        M,
        a0,
        y0,
        b0,
        a1,
        y1,
        b1,
        color,
        part,
        kind = "wall",
        col = true,
    ) => {
        mb.setXf(M).setColor(color).setPart(part).box(a0, y0, b0, a1, y1, b1);
        mb.setXf(null);
        if (col && S) {
            _pa.set(a0, y0, b0).applyMatrix4(M);
            _pb.set(a1, y1, b1).applyMatrix4(M);
            S.box(
                Math.min(_pa.x, _pb.x),
                Math.min(_pa.y, _pb.y),
                Math.min(_pa.z, _pb.z),
                Math.max(_pa.x, _pb.x),
                Math.max(_pa.y, _pb.y),
                Math.max(_pa.z, _pb.z),
                kind,
            );
        }
    };
    const PROF = [
        [H_ENT0, 27.05, 1.95, 1, "wall"],
        [27.05, 27.5, 2.02, 1, "wall"],
        [27.5, 27.92, 2.09, 1, "wall"],
        [27.92, 28.08, 2.2, 1, "wall"],
        [28.08, 29.45, 2.0, 0, "wall"],
        [29.45, 29.62, 2.22, 1, "wall"],
        [29.62, 29.98, 2.24, 1, "wall"],
        [29.98, 30.12, 2.52, 1, "wall"],
        [30.12, 30.5, 2.52, 1, "wall"],
        [30.5, 31.0, 3.3, 1, "cornice"],
        [31.0, H_COR, 3.18, 1, "cornice"],
    ];
    const entRun = (o, t, n, uA, uB, off, ext) => {
        const M = frame(o, t, n);
        PROF.forEach(([y0, y1, w, part, kind], li) => {
            const p = w - off,
                e = ext ? w - 1.8 : 0,
                a0 = uA - e,
                a1 = uB + e;
            fbox(
                M,
                a0,
                y0,
                -0.5,
                a1,
                y1,
                p,
                li === 4 ? STONE : li >= 9 ? STONE_D : CREAM_S,
                part,
                kind,
            );
            if (li === 6) {
                mb.setXf(M).setColor(CREAM_S).setPart(1);
                for (let a = a0 + 0.25; a < a1 - 0.2; a += 0.4)
                    mb.box(
                        a - 0.1,
                        y0 + 0.02,
                        p,
                        a + 0.1,
                        y1,
                        p + 0.2,
                        0b110111,
                    );
                mb.setXf(null);
            }
            if (li === 8) {
                mb.setXf(M).setColor(CREAM_S).setPart(1);
                for (let a = a0 + 0.65; a < a1 - 0.5; a += 1.3) {
                    mb.box(
                        a - 0.17,
                        y0 + 0.08,
                        p,
                        a + 0.17,
                        y1,
                        p + 0.72,
                        0b110111,
                    );
                    mb.box(
                        a - 0.15,
                        y0 - 0.1,
                        p,
                        a + 0.15,
                        y0 + 0.08,
                        p + 0.3,
                        0b111111,
                    );
                }
                mb.setXf(null);
            }
        });
    };
    entRun([0, 0, ZF], [1, 0, 0], [0, 0, 1], X0, X1, 0, true);
    entRun([0, 0, ZB], [-1, 0, 0], [0, 0, -1], -X1, -X0, 1.8, true);
    entRun(
        [X1, 0, 0],
        [0, 0, -1],
        [1, 0, 0],
        -(ZF - 0.5),
        -(ZB + 0.5),
        1.8,
        false,
    );
    entRun([X0, 0, 0], [0, 0, 1], [-1, 0, 0], ZB + 0.5, ZF - 0.5, 1.8, false);

    box(
        CX - 26,
        H_COR,
        ZF - 3.2,
        CX + 26,
        H_ATTIC - 1.0,
        ZF + 1.2,
        STONE,
        0,
        "wall",
    );
    {
        const M = frame([0, 0, ZF + 1.2], [1, 0, 0], [0, 0, 1]);
        fbox(
            M,
            CX - 26.15,
            H_ATTIC - 1.0,
            -4.4,
            CX + 26.15,
            H_ATTIC - 0.82,
            0.15,
            CREAM_S,
            1,
            "coping",
        );
        fbox(
            M,
            CX - 26.2,
            H_ATTIC - 0.82,
            -4.4,
            CX + 26.2,
            H_ATTIC - 0.55,
            0.2,
            CREAM_S,
            1,
            "coping",
        );
        mb.setXf(M).setColor(CREAM_S).setPart(1);
        for (let a = CX - 26.0; a < CX + 26.0; a += 0.36)
            mb.box(
                a - 0.09,
                H_ATTIC - 0.8,
                0.2,
                a + 0.09,
                H_ATTIC - 0.56,
                0.36,
                0b110111,
            );
        mb.setXf(null);
        fbox(
            M,
            CX - 26.5,
            H_ATTIC - 0.55,
            -4.6,
            CX + 26.5,
            H_ATTIC,
            0.42,
            STONE_D,
            1,
            "coping",
        );

        for (const [a, b] of [
            [-20.3, -9.7],
            [9.7, 20.3],
        ]) {
            fbox(
                M,
                CX + a,
                H_COR + 1.2,
                0,
                CX + b,
                H_COR + 1.45,
                0.12,
                CREAM_S,
                1,
                "wall",
                false,
            );
            fbox(
                M,
                CX + a,
                H_ATTIC - 2.4,
                0,
                CX + b,
                H_ATTIC - 2.15,
                0.12,
                CREAM_S,
                1,
                "wall",
                false,
            );
            fbox(
                M,
                CX + a,
                H_COR + 1.45,
                0,
                CX + a + 0.25,
                H_ATTIC - 2.4,
                0.12,
                CREAM_S,
                1,
                "wall",
                false,
            );
            fbox(
                M,
                CX + b - 0.25,
                H_COR + 1.45,
                0,
                CX + b,
                H_ATTIC - 2.4,
                0.12,
                CREAM_S,
                1,
                "wall",
                false,
            );
        }
    }
    for (const pu of [-22.5, -7.5, 7.5, 22.5])
        box(
            CX + pu - 2.2,
            H_COR,
            ZF + 1.2,
            CX + pu + 2.2,
            H_ATTIC - 1.0,
            ZF + 1.6,
            STONE,
            1,
            "wall",
        );

    for (const [x0, x1] of [
        [X0 - 1.2, CX - 26],
        [CX + 26, X1 + 1.2],
    ]) {
        const z0 = ZF - 0.5,
            z1 = ZF + 2.9;
        box(
            x0,
            H_COR,
            z1 - 0.5,
            x1,
            H_COR + 0.3,
            z1,
            STONE_D,
            1,
            "parapet",
            false,
        );
        box(
            x0,
            H_COR + 1.25,
            z1 - 0.55,
            x1,
            H_COR + 1.5,
            z1 + 0.05,
            CREAM_S,
            1,
            "parapet",
            false,
        );
        mb.setColor(CREAM_S).setPart(1);
        for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.4) {
            mb.cyl(x, H_COR + 0.3, z1 - 0.25, 0.1, 0.13, 0.45, 6, false);
            mb.cyl(x, H_COR + 0.75, z1 - 0.25, 0.13, 0.08, 0.5, 6, false);
        }
        for (let x = x0; x < x1 - 0.5; x += (x1 - x0) / 4)
            box(
                x,
                H_COR,
                z1 - 0.6,
                x + 0.6,
                H_COR + 1.6,
                z1 + 0.1,
                STONE_D,
                1,
                "parapet",
                false,
            );
        if (S)
            S.box(x0, H_COR, z1 - 0.6, x1, H_COR + 1.6, z1 + 0.1, "parapet", 2);
        void z0;
    }

    for (const u of [-15, 0, 15]) {
        const sh = new THREE.Shape();
        sh.absarc(0, 0, R_ARCH + 0.62, 0, Math.PI, false);
        sh.lineTo(-R_ARCH, 0);
        sh.absarc(0, 0, R_ARCH, Math.PI, 0, true);
        sh.lineTo(R_ARCH + 0.62, 0);
        const g = new THREE.ExtrudeGeometry(sh, {
            depth: 0.18,
            bevelEnabled: false,
            curveSegments: 24,
        });
        addGeo(
            mb,
            g,
            new THREE.Matrix4().makeTranslation(CX + u, H_SPRING, ZF),
            CREAM_S,
            1,
        );
        g.dispose();
        const g2 = new THREE.ExtrudeGeometry(
            (() => {
                const s2 = new THREE.Shape();
                s2.absarc(0, 0, R_ARCH + 0.25, 0, Math.PI, false);
                s2.lineTo(-R_ARCH, 0);
                s2.absarc(0, 0, R_ARCH, Math.PI, 0, true);
                s2.lineTo(R_ARCH + 0.25, 0);
                return s2;
            })(),
            { depth: 0.1, bevelEnabled: false, curveSegments: 24 },
        );
        addGeo(
            mb,
            g2,
            new THREE.Matrix4().makeTranslation(CX + u, H_SPRING, ZF + 0.18),
            CREAM_S,
            1,
        );
        g2.dispose();

        const ks = new THREE.Shape();
        ks.moveTo(-0.45, 0);
        ks.lineTo(0.45, 0);
        ks.lineTo(0.7, 1.9);
        ks.lineTo(-0.7, 1.9);
        ks.lineTo(-0.45, 0);
        const kg = new THREE.ExtrudeGeometry(ks, {
            depth: 0.42,
            bevelEnabled: true,
            bevelSize: 0.05,
            bevelThickness: 0.05,
            bevelSegments: 1,
        });
        addGeo(
            mb,
            kg,
            new THREE.Matrix4().makeTranslation(
                CX + u,
                H_SPRING + R_ARCH - 0.25,
                ZF,
            ),
            STONE_D,
            1,
        );
        kg.dispose();

        for (const s of [-1, 1])
            box(
                CX + u + s * (R_ARCH + 0.3) - 0.35,
                H_SPRING - 0.3,
                ZF,
                CX + u + s * (R_ARCH + 0.3) + 0.35,
                H_SPRING + 0.05,
                ZF + 0.3,
                CREAM_S,
                1,
                "ledge",
                false,
            );
    }

    {
        const TOR = new THREE.TorusGeometry(0.85, 0.2, 6, 20);
        for (const u of [-22.5, -7.5, 7.5, 22.5])
            addGeo(
                mb,
                TOR,
                new THREE.Matrix4().makeTranslation(CX + u, 23.7, ZF + 0.05),
                CREAM_S,
                3,
            );
        TOR.dispose();
    }
    {
        const cz = ZF + 1.75,
            cy = 37.0;
        const disc = (r, dz, color, part, seg = 48) =>
            addGeo(
                mb,
                new THREE.CircleGeometry(r, seg),
                new THREE.Matrix4().makeTranslation(CX, cy, cz + dz),
                color,
                part,
            );
        cylZ(CX, cy, ZF + 1.2, cz, 3.25, STONE_D, 1);
        const TR = new THREE.TorusGeometry(2.75, 0.22, 8, 48);
        addGeo(
            mb,
            TR,
            new THREE.Matrix4().makeTranslation(CX, cy, cz + 0.05),
            0x5a5240,
            5,
        );
        TR.dispose();
        const TR2 = new THREE.TorusGeometry(3.15, 0.14, 6, 48);
        addGeo(
            mb,
            TR2,
            new THREE.Matrix4().makeTranslation(CX, cy, cz - 0.02),
            0x5a5240,
            5,
        );
        TR2.dispose();
        disc(2.6, 0.02, CREAM, 1);
        const RG = new THREE.RingGeometry(1.95, 2.45, 48);
        addGeo(
            mb,
            RG,
            new THREE.Matrix4().makeTranslation(CX, cy, cz + 0.035),
            0xb8ab86,
            1,
        );
        RG.dispose();
        mb.setColor(0x1c1a16).setPart(5);
        for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2,
                r = 2.2,
                x = CX + Math.sin(a) * r,
                y = cy + Math.cos(a) * r;
            const m = new THREE.Matrix4().compose(
                new THREE.Vector3(x, y, cz + 0.05),
                new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(0, 0, 1),
                    -a,
                ),
                new THREE.Vector3(1, 1, 1),
            );
            mb.with(m, (b) => {
                b.box(-0.05, -0.2, 0, 0.05, 0.2, 0.03);
                if (k % 3 === 0)
                    b.box(-0.16, -0.2, 0, -0.08, 0.2, 0.03).box(
                        0.08,
                        -0.2,
                        0,
                        0.16,
                        0.2,
                        0.03,
                    );
            });
        }

        mb.with(
            new THREE.Matrix4().compose(
                new THREE.Vector3(CX, cy, cz + 0.08),
                new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(0, 0, 1),
                    1.05,
                ),
                new THREE.Vector3(1, 1, 1),
            ),
            (b) => b.box(-0.08, -0.2, 0, 0.08, 1.35, 0.04),
        );
        mb.with(
            new THREE.Matrix4().compose(
                new THREE.Vector3(CX, cy, cz + 0.1),
                new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(0, 0, 1),
                    -1.05,
                ),
                new THREE.Vector3(1, 1, 1),
            ),
            (b) => b.box(-0.06, -0.25, 0, 0.06, 2.0, 0.04),
        );

        const LEAF = new THREE.SphereGeometry(1, 7, 5);
        for (let k = 0; k < 30; k++) {
            const a = (k / 30) * Math.PI * 2;
            if (Math.abs(Math.cos(a) - 1) < 0.05) continue;
            const x = CX + Math.sin(a) * 3.45,
                y = cy + Math.cos(a) * 3.45;
            if (y > H_ATTIC + 0.2) continue;
            addGeo(
                mb,
                LEAF,
                new THREE.Matrix4().compose(
                    new THREE.Vector3(x, y, ZF + 1.65),
                    new THREE.Quaternion().setFromAxisAngle(
                        new THREE.Vector3(0, 0, 1),
                        -a + 0.6,
                    ),
                    new THREE.Vector3(0.18, 0.42, 0.14),
                ),
                SCULPT,
                3,
            );
        }
        if (S)
            S.box(
                CX - 3.25,
                cy - 3.25,
                ZF + 1.2,
                CX + 3.25,
                H_ATTIC,
                cz,
                "wall",
            );

        const sx = CX,
            sz = ZF - 0.6,
            y = H_ATTIC;

        box(
            sx - 9.6,
            y,
            sz - 2.4,
            sx + 9.6,
            y + 0.55,
            sz + 1.8,
            STONE_D,
            1,
            "wall",
        );
        box(
            sx - 9.0,
            y + 0.55,
            sz - 2.1,
            sx + 9.0,
            y + 2.35,
            sz + 1.5,
            STONE,
            0,
            "wall",
        );
        box(
            sx - 9.3,
            y + 2.35,
            sz - 2.3,
            sx + 9.3,
            y + 2.6,
            sz + 1.7,
            CREAM_S,
            1,
            "wall",
        );
        box(
            sx - 9.45,
            y + 2.6,
            sz - 2.4,
            sx + 9.45,
            y + 2.82,
            sz + 1.8,
            STONE_D,
            1,
            "wall",
        );
        for (const sg of [-1, 1])
            box(
                sx + sg * 6.2 - 1.3,
                y + 0.8,
                sz + 1.5,
                sx + sg * 6.2 + 1.3,
                y + 2.1,
                sz + 1.62,
                CREAM_S,
                1,
                "wall",
                false,
            );
        const b0 = y + 2.82;
        const GK = 0.92,
            kx = (x) => sx + (x - sx) * GK,
            ky = (yy) => b0 + (yy - b0) * GK,
            kz = (z) => sz + (z - sz) * GK;
        const vSc = mb.v;
        const SPH = new THREE.SphereGeometry(1, 16, 12);
        const Q = (rx, ry, rz) =>
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
        const blob = (x, yy, z, rx, ry, rz, rot = [0, 0, 0]) =>
            addGeo(
                mb,
                SPH,
                new THREE.Matrix4().compose(
                    new THREE.Vector3(x, yy, z),
                    Q(...rot),
                    new THREE.Vector3(rx, ry, rz),
                ),
                BRONZE,
                8,
            );
        const limb = (a, c, r0, r1 = r0) => {
            const A = new THREE.Vector3(...a),
                B = new THREE.Vector3(...c),
                d = B.clone().sub(A),
                L = d.length();
            const m = new THREE.Matrix4().compose(
                A,
                new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0),
                    d.normalize(),
                ),
                new THREE.Vector3(1, 1, 1),
            );
            mb.setColor(BRONZE)
                .setPart(8)
                .with(m, (bb) => bb.cyl(0, 0, 0, r0, r1, L, 10, false));
            blob(a[0], a[1], a[2], r0, r0, r0);
            blob(c[0], c[1], c[2], r1, r1, r1);
        };
        const torso = (x, yy, z, h, w, d, rot) => {
            const pr = [
                [0.001, 0],
                [0.62, 0.02],
                [0.7, 0.18],
                [0.58, 0.38],
                [0.66, 0.6],
                [0.8, 0.82],
                [0.72, 0.95],
                [0.3, 1.0],
                [0.001, 1.01],
            ].map(([r, v]) => new THREE.Vector2(r, v));
            const g = new THREE.LatheGeometry(pr, 14);
            addGeo(
                mb,
                g,
                new THREE.Matrix4().compose(
                    new THREE.Vector3(x, yy, z),
                    Q(...rot),
                    new THREE.Vector3(w, h, d),
                ),
                BRONZE,
                8,
            );
            g.dispose();
        };
        const extr = (pts, depth, m) => {
            const s = new THREE.Shape(
                pts.map(([a, c]) => new THREE.Vector2(a, c)),
            );
            const g = new THREE.ExtrudeGeometry(s, {
                depth,
                bevelEnabled: true,
                bevelSize: 0.08,
                bevelThickness: 0.08,
                bevelSegments: 2,
                curveSegments: 8,
            });
            addGeo(mb, g, m, BRONZE, 8);
            g.dispose();
        };

        limb(
            [sx - 0.45, b0 + 4.0, sz],
            [sx - 0.62, b0 + 2.05, sz + 0.15],
            0.44,
            0.33,
        );
        limb(
            [sx - 0.62, b0 + 2.05, sz + 0.15],
            [sx - 0.75, b0 + 0.3, sz + 0.1],
            0.33,
            0.22,
        );
        limb(
            [sx + 0.45, b0 + 4.0, sz],
            [sx + 1.0, b0 + 2.3, sz + 0.95],
            0.44,
            0.33,
        );
        limb(
            [sx + 1.0, b0 + 2.3, sz + 0.95],
            [sx + 0.95, b0 + 0.3, sz + 0.55],
            0.33,
            0.22,
        );
        blob(sx - 0.8, b0 + 0.22, sz + 0.3, 0.26, 0.2, 0.55);
        blob(sx + 0.95, b0 + 0.22, sz + 0.75, 0.26, 0.2, 0.55);
        torso(sx, b0 + 3.75, sz, 3.0, 1.05, 0.66, [0.05, 0, -0.04]);
        limb([sx, b0 + 6.7, sz], [sx + 0.03, b0 + 7.05, sz], 0.3, 0.28);
        blob(sx + 0.04, b0 + 7.45, sz + 0.05, 0.4, 0.47, 0.42);
        blob(sx + 0.04, b0 + 7.78, sz + 0.02, 0.56, 0.2, 0.56);
        for (const s of [-1, 1])
            extr(
                [
                    [0, 0],
                    [0.9, 0.25],
                    [1.05, 0.75],
                    [0.55, 0.45],
                    [0.1, 0.3],
                ],
                0.05,
                new THREE.Matrix4().compose(
                    new THREE.Vector3(sx + s * 0.4, b0 + 7.7, sz - 0.1),
                    Q(0, s > 0 ? 1.0 : Math.PI - 1.0, 0.1),
                    new THREE.Vector3(0.55, 0.5, 1),
                ),
            );
        limb(
            [sx + 0.85, b0 + 6.35, sz],
            [sx + 1.85, b0 + 7.35, sz + 0.25],
            0.26,
            0.21,
        );
        limb(
            [sx + 1.85, b0 + 7.35, sz + 0.25],
            [sx + 2.35, b0 + 8.55, sz + 0.45],
            0.21,
            0.16,
        );
        blob(sx + 2.42, b0 + 8.75, sz + 0.47, 0.17, 0.24, 0.15);
        limb(
            [sx - 0.85, b0 + 6.35, sz],
            [sx - 1.45, b0 + 5.05, sz + 0.4],
            0.26,
            0.21,
        );
        limb(
            [sx - 1.45, b0 + 5.05, sz + 0.4],
            [sx - 1.85, b0 + 4.1, sz + 0.75],
            0.21,
            0.16,
        );
        mb.setColor(BRONZE)
            .setPart(8)
            .tube(
                [sx - 1.9, b0 + 2.4, sz + 0.8],
                [sx - 1.95, b0 + 6.9, sz + 0.8],
                0.07,
                6,
                true,
            );
        blob(sx - 1.95, b0 + 6.95, sz + 0.8, 0.14, 0.14, 0.14);

        extr(
            [
                [0.9, 6.5],
                [-0.9, 6.5],
                [-2.2, 5.6],
                [-3.6, 4.4],
                [-4.1, 2.9],
                [-3.3, 1.9],
                [-3.0, 3.0],
                [-2.1, 3.6],
                [-1.2, 3.1],
                [-0.4, 4.0],
                [0.8, 3.8],
            ],
            0.3,
            new THREE.Matrix4().compose(
                new THREE.Vector3(sx, b0, sz - 0.75),
                Q(0, 0.15, 0),
                new THREE.Vector3(1, 1, 1),
            ),
        );
        extr(
            [
                [-1.0, 6.2],
                [-2.9, 5.2],
                [-3.8, 3.6],
                [-2.4, 4.3],
            ],
            0.25,
            new THREE.Matrix4().compose(
                new THREE.Vector3(sx, b0, sz - 0.35),
                Q(0, -0.1, 0),
                new THREE.Vector3(1, 1, 1),
            ),
        );
        if (S)
            S.box(
                kx(sx - 1.1),
                b0,
                kz(sz - 0.8),
                kx(sx + 1.1),
                ky(b0 + 7.0),
                kz(sz + 0.8),
                "wall",
            );

        for (const sg of [-1, 1]) {
            const fx = sx + sg * 4.6,
                hip = [fx + sg * 0.3, b0 + 1.35, sz];
            blob(fx - sg * 0.4, b0 + 0.75, sz - 0.3, 1.9, 0.8, 1.25);
            torso(hip[0], hip[1], sz, 2.6, 0.95, 0.62, [0, 0, sg * 0.55]);
            const sh = [hip[0] + sg * 1.35, hip[1] + 2.15, sz];
            blob(sh[0] + sg * 0.45, sh[1] + 0.75, sz + 0.1, 0.4, 0.46, 0.42);

            limb(
                [hip[0] + sg * 0.2, hip[1] + 0.1, sz + 0.45],
                [fx + sg * 2.6, b0 + 2.2, sz + 0.85],
                0.46,
                0.35,
            );
            limb(
                [fx + sg * 2.6, b0 + 2.2, sz + 0.85],
                [fx + sg * 3.4, b0 + 0.35, sz + 0.9],
                0.35,
                0.24,
            );
            limb(
                [hip[0] + sg * 0.2, hip[1] - 0.1, sz - 0.35],
                [fx + sg * 3.3, b0 + 0.75, sz - 0.4],
                0.46,
                0.33,
            );
            limb(
                [fx + sg * 3.3, b0 + 0.75, sz - 0.4],
                [fx + sg * 5.2, b0 + 0.35, sz - 0.3],
                0.33,
                0.22,
            );

            limb(
                [sh[0] - sg * 0.6, sh[1], sz + 0.1],
                [sh[0] - sg * 1.2, sh[1] + 0.9, sz + 0.55],
                0.25,
                0.2,
            );
            limb(
                [sh[0] - sg * 1.2, sh[1] + 0.9, sz + 0.55],
                [sh[0] - sg * 1.0, sh[1] + 1.9, sz + 0.75],
                0.2,
                0.15,
            );
            limb(
                [sh[0] + sg * 0.6, sh[1] - 0.1, sz],
                [sh[0] + sg * 1.3, sh[1] - 1.0, sz + 0.3],
                0.25,
                0.2,
            );
            limb(
                [sh[0] + sg * 1.3, sh[1] - 1.0, sz + 0.3],
                [fx + sg * 2.4, b0 + 2.6, sz + 0.75],
                0.2,
                0.16,
            );
            if (sg < 0) {
                blob(
                    fx + 0.3,
                    b0 + 1.35,
                    sz + 0.35,
                    1.25,
                    0.42,
                    0.9,
                    [0, 0, 0.3],
                );
                limb(
                    [fx - 3.5, b0 + 0.3, sz + 1.2],
                    [fx - 2.3, b0 + 3.2, sz + 1.0],
                    0.16,
                    0.34,
                );
            } else {
                blob(
                    sh[0] + sg * 0.45,
                    sh[1] + 1.1,
                    sz + 0.05,
                    0.46,
                    0.3,
                    0.48,
                );
                mb.setColor(BRONZE)
                    .setPart(8)
                    .box(
                        sh[0] + sg * 0.45 - 0.08,
                        sh[1] + 1.2,
                        sz - 0.5,
                        sh[0] + sg * 0.45 + 0.08,
                        sh[1] + 1.65,
                        sz + 0.45,
                    );
                blob(fx + sg * 2.4, b0 + 1.05, sz + 0.1, 2.5, 0.72, 1.0, [
                    0,
                    0,
                    sg * -0.08,
                ]);
                const SH = new THREE.CylinderGeometry(1.25, 1.25, 0.22, 24);
                addGeo(
                    mb,
                    SH,
                    new THREE.Matrix4().compose(
                        new THREE.Vector3(fx + sg * 4.4, b0 + 1.25, sz - 0.9),
                        Q(Math.PI / 2 - 0.2, 0, 0.15),
                        new THREE.Vector3(1, 1, 1),
                    ),
                    BRONZE,
                    8,
                );
                SH.dispose();
            }
            if (S)
                S.box(
                    kx(sx + Math.min(sg * 1.2, sg * 10)),
                    b0,
                    kz(sz - 1.4),
                    kx(sx + Math.max(sg * 1.2, sg * 10)),
                    ky(b0 + 2.4),
                    kz(sz + 1.3),
                    "wall",
                );
        }
        for (let i = vSc * 3; i < mb.v * 3; i += 3) {
            mb.p[i] = kx(mb.p[i]);
            mb.p[i + 1] = ky(mb.p[i + 1]);
            mb.p[i + 2] = kz(mb.p[i + 2]);
        }

        for (const sg of [-1, 1]) {
            const ex = CX + sg * 24.8,
                ey = H_ATTIC,
                ez = ZF - 0.2;
            box(
                ex - 1.1,
                ey,
                ez - 1.1,
                ex + 1.1,
                ey + 0.8,
                ez + 1.1,
                STONE_D,
                1,
                "wall",
            );
            const vE = mb.v;
            blob(ex, ey + 1.7, ez, 0.55, 0.95, 0.55);
            blob(ex, ey + 2.85, ez + 0.25, 0.28, 0.3, 0.32);
            blob(ex, ey + 2.78, ez + 0.58, 0.1, 0.08, 0.22);
            for (const s2 of [-1, 1])
                extr(
                    [
                        [0, 0],
                        [0.9, 0.7],
                        [1.9, 1.7],
                        [2.3, 2.6],
                        [1.7, 2.2],
                        [1.8, 1.7],
                        [1.2, 1.5],
                        [1.2, 1.0],
                        [0.6, 0.9],
                        [0.2, 0.5],
                    ],
                    0.12,
                    new THREE.Matrix4().compose(
                        new THREE.Vector3(ex + s2 * 0.3, ey + 1.3, ez - 0.2),
                        Q(0, s2 > 0 ? -0.35 : Math.PI + 0.35, 0),
                        new THREE.Vector3(1, 1, 1),
                    ),
                );
            for (let i = vE * 3; i < mb.v * 3; i += 3) {
                mb.p[i] = ex + (mb.p[i] - ex) * 0.65;
                mb.p[i + 1] = ey + 0.8 + (mb.p[i + 1] - ey - 0.8) * 0.65;
                mb.p[i + 2] = ez + (mb.p[i + 2] - ez) * 0.65;
            }
            if (S)
                S.box(
                    ex - 0.8,
                    ey + 0.8,
                    ez - 0.4,
                    ex + 0.8,
                    ey + 2.35,
                    ez + 0.55,
                    "wall",
                );
        }
    }

    for (const [o, t, n, len] of [
        [[X1, 0, ZF + 1.0], [0, 0, -1], [1, 0, 0], ZF + 1.0 - ZB],
        [[X0, 0, ZB], [0, 0, 1], [-1, 0, 0], ZF + 1.0 - ZB],
        [[X1, 0, ZB], [-1, 0, 0], [0, 0, -1], X1 - X0],
    ]) {
        const M = frame(o, t, n),
            k = Math.floor(len / 9),
            sp = len / k;
        const holes = [];
        for (let i = 0; i < k; i++)
            holes.push({
                u: sp * (i + 0.5),
                w: 4.4,
                y0: 11,
                ys: 20.5,
                arch: true,
            });
        for (let i = 0; i < k; i++)
            holes.push({ u: sp * (i + 0.5), w: 2.4, y0: 3.2, y1: 7.2 });
        wall(mb, glass, M, 0, len, Y0, H_ENT0, 0.9, holes, STONE, 0, 0.8);
        for (let i = 0; i <= k; i++) {
            const u = sp * i,
                c = [o[0] + t[0] * u, o[2] + t[2] * u];
            const px = c[0] + n[0] * 0.25,
                pz = c[1] + n[2] * 0.25;
            box(
                Math.min(c[0], px) - Math.abs(t[0]) * 0.8,
                9.0,
                Math.min(c[1], pz) - Math.abs(t[2]) * 0.8,
                Math.max(c[0], px) + Math.abs(t[0]) * 0.8,
                H_CAP,
                Math.max(c[1], pz) + Math.abs(t[2]) * 0.8,
                STONE,
                1,
                "wall",
                false,
            );
        }
    }

    {
        const rz0 = ZB + 1.5,
            rz1 = ZF - 3.6,
            rx0 = X0 + 1.2,
            rx1 = X1 - 1.2,
            zr = (rz0 + rz1) / 2;

        const yE = H_COR,
            yR = H_COR + ((rz1 - rz0) / 2) * Math.tan(ROOF_P);
        mb.setColor(COPPER).setPart(2);
        const q = (a, b, c, d, nrm) => {
            const i = [a, b, c, d].map((p) =>
                mb.vert(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2]),
            );
            mb.quad(i[0], i[1], i[2], i[3]);
        };
        const s = Math.hypot(1, Math.tan(ROOF_P)),
            ny = 1 / s,
            nz = Math.tan(ROOF_P) / s;
        q(
            [rx0, yE, rz1],
            [rx1, yE, rz1],
            [rx1, yR, zr],
            [rx0, yR, zr],
            [0, ny, nz],
        );
        q(
            [rx1, yE, rz0],
            [rx0, yE, rz0],
            [rx0, yR, zr],
            [rx1, yR, zr],
            [0, ny, -nz],
        );
        for (const [x, nx] of [
            [rx0, -1],
            [rx1, 1],
        ]) {
            const i = [
                [x, yE, rz0],
                [x, yE, rz1],
                [x, yR, zr],
            ].map((p) => mb.vert(p[0], p[1], p[2], nx, 0, 0));
            if (nx > 0) mb.tri(i[0], i[2], i[1]);
            else mb.tri(i[0], i[1], i[2]);
        }

        box(
            rx0 + 8,
            yR - 0.4,
            zr - 3.2,
            rx1 - 8,
            yR + 2.4,
            zr + 3.2,
            COPPER,
            2,
            "roof",
        );
        for (const sg of [-1, 1])
            glass.push(
                new THREE.PlaneGeometry(rx1 - rx0 - 16, 2.2).applyMatrix4(
                    new THREE.Matrix4()
                        .makeRotationY(sg > 0 ? 0 : Math.PI)
                        .setPosition(CX, yR + 1.0, zr + sg * 3.22),
                ),
            );
        if (S) {
            S.ramp(rx0, H_COR - 0.5, zr, rx1, rz1, 2, yR, yE, "roof");
            S.ramp(rx0, H_COR - 0.5, rz0, rx1, zr, 2, yE, yR, "roof");
        }
        Z.edge(X0 - 1.38, ZB, X0 - 1.38, ZF - 0.5, H_COR, -1, 0);
        Z.edge(X1 + 1.38, ZB, X1 + 1.38, ZF - 0.5, H_COR, 1, 0);
        Z.edge(CX - 26, ZF + 1.62, CX + 26, ZF + 1.62, H_ATTIC, 0, 1);
        for (const [cx, cz, nx, nz] of [
            [X0 - 1.38, ZB - 1.38, -1, -1],
            [X1 + 1.38, ZB - 1.38, 1, -1],
            [X0 - 1.38, ZF + 3.18, -1, 1],
            [X1 + 1.38, ZF + 3.18, 1, 1],
        ])
            Z.add(
                cx - nx * 0.15,
                H_COR,
                cz - nz * 0.15,
                nx * Math.SQRT1_2,
                0,
                nz * Math.SQRT1_2,
                "roofCorner",
            );
    }

    {
        const V = PARK_VIADUCT,
            th = 1.0;

        const WX0 = X0 - 5.5,
            WX1 = X1 + 5.5,
            GR = 0x3a3e3b /* (street r7) was 0x46534c: critic 'flat green band' */,
            DB = TER_Y - th;
        box(
            X0 + 3,
            DB,
            ZF + 0.02,
            X1 - 3,
            TER_Y,
            ZF + 1.02,
            STONE_D,
            1,
            "roof",
        );
        box(WX0, DB, ZF + 1.02, WX1, TER_Y, TER_Z1, STONE_D, 1, "roof");
        box(WX0, DB, ZB + 0.4, X0 - 0.02, TER_Y, ZF + 1.02, STONE_D, 1, "roof");
        box(X1 + 0.02, DB, ZB + 0.4, WX1, TER_Y, ZF + 1.02, STONE_D, 1, "roof");

        {
            const aq = (x0, z0, x1, z1) => {
                mb.setColor(ASPH).setPart(4);
                const y = TER_Y + 0.012;
                const i = [
                    [x0, z1],
                    [x1, z1],
                    [x1, z0],
                    [x0, z0],
                ].map(([x, z]) => mb.vert(x, y, z, 0, 1, 0, x, z));
                mb.quad(i[0], i[1], i[2], i[3]);
            };
            aq(X0 + 3, ZF + 0.3, X1 - 3, TER_Z1 - 0.6);
            aq(WX0 + 0.6, ZF + 1.3, X0 + 3, TER_Z1 - 0.6);
            aq(X1 - 3, ZF + 1.3, WX1 - 0.6, TER_Z1 - 0.6);
            aq(WX0 + 0.6, ZB + 0.8, X0 - 0.3, ZF + 1.3);
            aq(X1 + 0.3, ZB + 0.8, WX1 - 0.6, ZF + 1.3);

            mb.setColor(0xb9b3a2).setPart(5);
            const ln = (x0, z0, x1, z1) => {
                const y = TER_Y + 0.02;
                const i = [
                    [x0, z1],
                    [x1, z1],
                    [x1, z0],
                    [x0, z0],
                ].map(([x, z]) => mb.vert(x, y, z, 0, 1, 0, x, z));
                mb.quad(i[0], i[1], i[2], i[3]);
            };
            const zc = (ZF + 1.3 + TER_Z1 - 0.6) / 2;
            for (let x = WX0 + 3.2; x < WX1 - 3.2; x += 4.5)
                if (x + 2.6 < V.x0 - 1 || x > V.x1 + 1)
                    ln(x, zc - 0.06, x + 2.6, zc + 0.06);
            for (const xc of [(WX0 + X0) / 2, (X1 + WX1) / 2])
                for (let z = ZB + 3; z < ZF - 2; z += 4.5)
                    ln(xc - 0.06, z, xc + 0.06, z + 2.6);
        }

        const bal = (x0, x1) => {
            box(
                x0,
                TER_Y,
                TER_Z1 - 0.45,
                x1,
                TER_Y + 0.25,
                TER_Z1,
                STONE,
                1,
                "parapet",
            );
            box(
                x0,
                TER_Y + 0.95,
                TER_Z1 - 0.5,
                x1,
                TER_Y + 1.15,
                TER_Z1 + 0.05,
                STONE,
                1,
                "parapet",
            );
            mb.setColor(STONE).setPart(1);
            for (let x = x0 + 0.25; x < x1 - 0.2; x += 0.42)
                mb.cyl(
                    x,
                    TER_Y + 0.25,
                    TER_Z1 - 0.22,
                    0.13,
                    0.09,
                    0.7,
                    6,
                    false,
                );
            for (let x = x0; x < x1 - 1; x += 7.2)
                box(
                    x,
                    TER_Y,
                    TER_Z1 - 0.55,
                    x + 0.6,
                    TER_Y + 1.3,
                    TER_Z1 + 0.1,
                    STONE_D,
                    1,
                    "parapet",
                    false,
                );
            if (S)
                S.box(
                    x0,
                    TER_Y + 0.25,
                    TER_Z1 - 0.45,
                    x1,
                    TER_Y + 0.95,
                    TER_Z1,
                    "parapet",
                    2,
                );
        };
        const balZ = (xo, sg, z0, z1) => {
            const xa = sg < 0 ? xo : xo - 0.45,
                xb = sg < 0 ? xo + 0.45 : xo;
            box(xa, TER_Y, z0, xb, TER_Y + 0.25, z1, STONE, 1, "parapet");
            box(
                xa - (sg < 0 ? 0.05 : 0),
                TER_Y + 0.95,
                z0,
                xb + (sg > 0 ? 0.05 : 0),
                TER_Y + 1.15,
                z1,
                STONE,
                1,
                "parapet",
            );
            mb.setColor(STONE).setPart(1);
            for (let z = z0 + 0.25; z < z1 - 0.2; z += 0.42)
                mb.cyl(
                    (xa + xb) / 2,
                    TER_Y + 0.25,
                    z,
                    0.13,
                    0.09,
                    0.7,
                    6,
                    false,
                );
            for (let z = z0; z < z1 - 1; z += 7.2)
                box(
                    xa - (sg < 0 ? 0.1 : 0),
                    TER_Y,
                    z,
                    xb + (sg > 0 ? 0.1 : 0),
                    TER_Y + 1.3,
                    z + 0.6,
                    STONE_D,
                    1,
                    "parapet",
                    false,
                );
            if (S)
                S.box(xa, TER_Y + 0.25, z0, xb, TER_Y + 0.95, z1, "parapet", 2);
        };
        bal(WX0, V.x0);
        bal(V.x1, WX1);
        balZ(WX0, -1, ZB + 0.4, TER_Z1 - 0.45);
        balZ(WX1, 1, ZB + 0.4, TER_Z1 - 0.45);

        for (const [xa, xb] of [
            [WX0, X0],
            [X1, WX1],
        ]) {
            box(
                xa - (xa < CX ? 0.4 : 0),
                0,
                ZB - 0.6,
                xb + (xa < CX ? 0 : 0.4),
                TER_Y + 4.6,
                ZB + 0.4,
                STONE,
                0,
                "wall",
            );
            mb.setColor(0x151716)
                .setPart(5)
                .box(
                    xa + 0.5,
                    TER_Y,
                    ZB + 0.4,
                    xb - 0.5,
                    TER_Y + 3.8,
                    ZB + 0.42,
                );
            box(
                xa - 0.5,
                TER_Y + 4.6,
                ZB - 0.7,
                xb + 0.1,
                TER_Y + 5.0,
                ZB + 0.6,
                CREAM_S,
                1,
                "ledge",
            );
        }

        {
            const fz = (x0, x1, z) => {
                mb.setColor(GR)
                    .setPart(5)
                    .box(x0, DB - 1.1, z - 0.1, x1, DB + 0.02, z + 0.02)
                    .box(x0, DB - 1.2, z - 0.2, x1, DB - 1.08, z + 0.08)
                    .box(
                        x0,
                        TER_Y - 0.08,
                        z - 0.02,
                        x1,
                        TER_Y + 0.02,
                        z + 0.06,
                    );
                for (let x = x0 + 0.7; x < x1 - 0.3; x += 1.5)
                    mb.box(
                        x - 0.06,
                        DB - 1.1,
                        z + 0.02,
                        x + 0.06,
                        DB,
                        z + 0.08,
                    );
                if (S) S.box(x0, DB - 1.2, z - 0.2, x1, DB, z + 0.08, "wall");
            };
            const fx = (x, sg, z0, z1) => {
                const a = sg < 0 ? x : x - 0.1,
                    b = sg < 0 ? x + 0.1 : x;
                mb.setColor(GR)
                    .setPart(5)
                    .box(
                        a - (sg < 0 ? 0.02 : 0),
                        DB - 1.1,
                        z0,
                        b + (sg > 0 ? 0.02 : 0),
                        DB + 0.02,
                        z1,
                    )
                    .box(
                        a - (sg < 0 ? 0.08 : 0.1),
                        DB - 1.2,
                        z0,
                        b + (sg > 0 ? 0.08 : 0.1),
                        DB - 1.08,
                        z1,
                    );
                const xs = sg < 0 ? a - 0.06 : b;
                for (let z = z0 + 0.7; z < z1 - 0.3; z += 1.5)
                    mb.box(xs, DB - 1.1, z - 0.06, xs + 0.06, DB, z + 0.06);
                if (S)
                    S.box(
                        Math.min(a, b) - 0.1,
                        DB - 1.2,
                        z0,
                        Math.max(a, b) + 0.1,
                        DB,
                        z1,
                        "wall",
                    );
            };
            fz(WX0, V.x0, TER_Z1);
            fz(V.x1, WX1, TER_Z1);
            fx(WX0, -1, ZB + 0.4, TER_Z1);
            fx(WX1, 1, ZB + 0.4, TER_Z1);
            mb.setColor(GR).setPart(5);
            for (let x = WX0 + 2; x < WX1 - 1; x += 3.0)
                if (x < V.x0 - 0.3 || x > V.x1 + 0.3)
                    mb.box(
                        x - 0.1,
                        DB - 0.7,
                        ZF + 1.1,
                        x + 0.1,
                        DB,
                        TER_Z1 - 0.1,
                        0b111011,
                    );
            for (const [x0, x1] of [
                [WX0 + 0.1, X0 - 0.05],
                [X1 + 0.05, WX1 - 0.1],
            ])
                for (let z = ZB + 2; z < ZF; z += 3.0)
                    mb.box(x0, DB - 0.7, z - 0.1, x1, DB, z + 0.1, 0b111011);

            const colAt = (x, z) => {
                box(
                    x - 0.5,
                    Y0,
                    z - 0.5,
                    x + 0.5,
                    Y0 + 0.6,
                    z + 0.5,
                    0x8d877b,
                    1,
                    "wall",
                );
                mb.setColor(GR)
                    .setPart(5)
                    .cyl(x, Y0 + 0.6, z, 0.34, 0.3, 0.35, 10)
                    .cyl(x, Y0 + 0.95, z, 0.24, 0.24, DB - 1.2 - Y0 - 1.75, 12)
                    .cyl(x, DB - 2.0, z, 0.24, 0.5, 0.8, 10);
                if (S) {
                    S.cyl(x, z, Y0 + 0.6, Y0 + 0.95, 0.34, 0.3, "pole");
                    S.cyl(x, z, Y0 + 0.95, DB - 2.0, 0.24, 0.24, "pole");
                    S.cyl(x, z, DB - 2.0, DB - 1.2, 0.24, 0.5, "pole");
                }
            };
            for (const x of [WX0 + 0.7, 404, 421.5, 438.5, 456, WX1 - 0.7])
                colAt(x, TER_Z1 - 1.0);
            for (const x of [WX0 + 0.7, WX1 - 0.7])
                for (let z = TER_Z1 - 10; z > ZB + 4; z -= 11) colAt(x, z);

            const LG = 0x2f3a33;
            const lamp = (x, z) => {
                const y = TER_Y + 1.3;
                mb.setColor(LG)
                    .setPart(5)
                    .cyl(x, y, z, 0.16, 0.12, 0.3, 8)
                    .cyl(x, y + 0.3, z, 0.1, 0.075, 3.3, 8)
                    .cyl(x, y + 3.6, z, 0.13, 0.13, 0.12, 8);
                mb.setColor(0xefe8d2)
                    .setPart(1)
                    .cyl(x, y + 3.72, z, 0.22, 0.27, 0.6, 8)
                    .setColor(LG)
                    .setPart(5)
                    .cyl(x, y + 4.32, z, 0.3, 0.02, 0.3, 8);
                if (S) S.cyl(x, z, y, y + 3.6, 0.12, 0.08, "pole");
            };
            for (let x = WX0 + 0.3; x < WX1 - 1; x += 14.4)
                if (x + 0.6 < V.x0 - 0.5 || x > V.x1 + 0.5)
                    lamp(x + 0.3, TER_Z1 - 0.22);
            for (let z = ZB + 0.4 + 7.2; z < TER_Z1 - 3; z += 14.4) {
                lamp(WX0 + 0.22, z + 0.3);
                lamp(WX1 - 0.22, z + 0.3);
            }
        }

        const yAt = (z) => V.yTop * Math.max(0, (V.z1 - z) / (V.z1 - V.z0));
        const _zs = [V.z0, V.open1, V.z1];
        const quad = (a, b, c, d, nrm, color, part) => {
            mb.setColor(color).setPart(part);
            const i = [a, b, c, d].map((p) =>
                mb.vert(p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], p[0], p[2]),
            );
            mb.quad(i[0], i[1], i[2], i[3]);
        };
        const sl = V.yTop / (V.z1 - V.z0),
            nl = Math.hypot(1, sl);
        const up = [0, 1 / nl, sl / nl];

        quad(
            [V.x0, yAt(V.z1) + 0.01, V.z1],
            [V.x1, yAt(V.z1) + 0.01, V.z1],
            [V.x1, yAt(V.z0), V.z0],
            [V.x0, yAt(V.z0), V.z0],
            up,
            ASPH,
            4,
        );

        const sq = (x0, x1, yb, yt, za, zb, color, part) => {
            quad(
                [x0, yt(zb), zb],
                [x1, yt(zb), zb],
                [x1, yt(za), za],
                [x0, yt(za), za],
                up,
                color,
                part,
            );
            quad(
                [x0, yb(za), za],
                [x1, yb(za), za],
                [x1, yb(zb), zb],
                [x0, yb(zb), zb],
                [0, -1, 0],
                color,
                part,
            );
            quad(
                [x0, yb(zb), zb],
                [x0, yb(za), za],
                [x0, yt(za), za],
                [x0, yt(zb), zb],
                [-1, 0, 0],
                color,
                part,
            );
            quad(
                [x1, yb(za), za],
                [x1, yb(zb), zb],
                [x1, yt(zb), zb],
                [x1, yt(za), za],
                [1, 0, 0],
                color,
                part,
            );
        };
        for (const [xa, xb] of [
            [V.x0, V.x0 + 0.35],
            [V.x1 - 0.35, V.x1],
        ]) {
            const ya = (z) => yAt(z) + 1.0,
                yp = (z) => yAt(z) + 0.3;
            quad(
                [xa, yp(V.z1), V.z1],
                [xb, yp(V.z1), V.z1],
                [xb, yp(V.z0), V.z0],
                [xa, yp(V.z0), V.z0],
                up,
                STONE,
                1,
            );
            for (const [x, nx] of [
                [xa, -1],
                [xb, 1],
            ]) {
                const bot = (z) => (z > V.open1 ? 0 : yAt(z) - 1.3);
                const top = (z) =>
                    x === (xa === V.x0 ? xa : xb) ? yp(z) : yp(z);
                for (const [za, zb] of [
                    [V.z0, V.open1],
                    [V.open1, V.z1],
                ]) {
                    const pts =
                        nx < 0
                            ? [
                                  [x, bot(za), za],
                                  [x, bot(zb), zb],
                                  [x, top(zb), zb],
                                  [x, top(za), za],
                              ]
                            : [
                                  [x, bot(zb), zb],
                                  [x, bot(za), za],
                                  [x, top(za), za],
                                  [x, top(zb), zb],
                              ];
                    quad(pts[0], pts[1], pts[2], pts[3], [nx, 0, 0], STONE, 0);
                }
            }
            quad(
                [xa, 0, V.z1],
                [xb, 0, V.z1],
                [xb, ya(V.z1), V.z1],
                [xa, ya(V.z1), V.z1],
                [0, 0, 1],
                STONE,
                1,
            );

            sq(
                xa - 0.05,
                xb + 0.05,
                (z) => yAt(z) + 0.84,
                ya,
                V.z0,
                V.z1,
                CREAM_S,
                1,
            );
            mb.setColor(CREAM_S).setPart(1);
            const xm = (xa + xb) / 2;
            for (let z = V.z0 + 0.3; z < V.z1 - 0.3; z += 0.42) {
                const y = yp(z);
                if (y + 0.5 < 0.35) continue;
                mb.cyl(xm, y, z, 0.1, 0.13, 0.26, 6, false);
                mb.cyl(xm, y + 0.26, z, 0.13, 0.07, 0.28, 6, false);
            }

            for (let z = V.z0 + 0.4; z < V.z1 - 1; z += 7.2) {
                const y0 = yAt(z + 0.3),
                    y1 = yAt(z - 0.3) + 1.12;
                mb.setColor(STONE_D)
                    .setPart(1)
                    .box(xa - 0.08, y0, z - 0.3, xb + 0.08, y1, z + 0.3);
                mb.setColor(CREAM_S).box(
                    xa - 0.12,
                    y1,
                    z - 0.34,
                    xb + 0.12,
                    y1 + 0.1,
                    z + 0.34,
                );
            }
            if (S) {
                S.ramp(
                    xa,
                    0,
                    V.open1,
                    xb,
                    V.z1,
                    2,
                    ya(V.open1),
                    ya(V.z1),
                    "parapet",
                );
                S.ramp(
                    xa,
                    0,
                    V.z0,
                    xb,
                    V.open1,
                    2,
                    ya(V.z0),
                    ya(V.open1),
                    "parapet",
                    0,
                    2.3,
                );
            }
        }

        for (const [x, sg] of [
            [V.x0, -1],
            [V.x1, 1],
        ]) {
            const xo = x + sg * 0.12,
                xa2 = Math.min(x, xo),
                xb2 = Math.max(x, xo);
            sq(
                xa2 - (sg < 0 ? 0.04 : 0),
                xb2 + (sg > 0 ? 0.04 : 0),
                (z) => Math.max(0, yAt(z) - 0.25),
                (z) => Math.max(0.02, yAt(z) + 0.1),
                V.open1,
                V.z1 - 2,
                CREAM_S,
                1,
            );
            for (let z = V.open1 + 5; z < V.z1 - 4; z += 6) {
                const yt = yAt(z + 0.4) - 0.25;
                if (yt < 0.8) continue;
                mb.setColor(STONE_D)
                    .setPart(0)
                    .box(xa2, 0, z - 0.4, xb2, yt, z + 0.4);
            }
        }

        for (const [xl, xr, c] of [
            [CX - 0.2, CX - 0.08, 0xc6a03c],
            [CX + 0.08, CX + 0.2, 0xc6a03c],
            [V.x0 + 0.65, V.x0 + 0.77, 0xd8d5ca],
            [V.x1 - 0.77, V.x1 - 0.65, 0xd8d5ca],
        ])
            quad(
                [xl, yAt(V.z1 - 0.5) + 0.02, V.z1 - 0.5],
                [xr, yAt(V.z1 - 0.5) + 0.02, V.z1 - 0.5],
                [xr, yAt(V.z0) + 0.02, V.z0],
                [xl, yAt(V.z0) + 0.02, V.z0],
                up,
                c,
                5,
            );

        {
            const GR = 0x3a3e3b;
            quad(
                [V.x0, yAt(V.z0) - 0.9, V.z0],
                [V.x1, yAt(V.z0) - 0.9, V.z0],
                [V.x1, yAt(V.open1) - 0.9, V.open1],
                [V.x0, yAt(V.open1) - 0.9, V.open1],
                [0, -1, 0],
                GR,
                5,
            );
            for (let z = V.z0 + 1.0; z < V.open1 - 0.3; z += 2.4) {
                const y = yAt(z);
                mb.setColor(GR)
                    .setPart(5)
                    .box(
                        V.x0 + 0.1,
                        y - 1.3,
                        z - 0.18,
                        V.x1 - 0.1,
                        y - 1.22,
                        z + 0.18,
                    )
                    .box(
                        V.x0 + 0.1,
                        y - 1.25,
                        z - 0.04,
                        V.x1 - 0.1,
                        y - 0.9,
                        z + 0.04,
                    );
            }
            for (const [x, sg] of [
                [V.x0, -1],
                [V.x1, 1],
            ]) {
                const xo = x + sg * 0.1,
                    xa2 = Math.min(x, xo),
                    xb2 = Math.max(x, xo);
                sq(
                    xa2,
                    xb2,
                    (z) => yAt(z) - 1.36,
                    (z) => yAt(z) - 1.18,
                    V.z0,
                    V.open1,
                    GR,
                    5,
                );
                sq(
                    xa2,
                    xb2,
                    (z) => yAt(z) - 0.02,
                    (z) => yAt(z) + 0.12,
                    V.z0,
                    V.open1,
                    GR,
                    5,
                );
                for (let z = V.z0 + 0.6; z < V.open1 - 0.2; z += 1.5) {
                    const y = yAt(z);
                    mb.setColor(GR)
                        .setPart(5)
                        .box(
                            xa2 - (sg < 0 ? 0.04 : 0),
                            y - 1.2,
                            z - 0.07,
                            xb2 + (sg > 0 ? 0.04 : 0),
                            y - 0.02,
                            z + 0.07,
                        );
                }
            }
        }

        box(
            V.x0 + 0.2,
            0,
            V.open1 - 1.2,
            V.x1 - 0.2,
            yAt(V.open1) - 1.3,
            V.open1 + 0.01,
            STONE_D,
            0,
            "wall",
            false,
        );

        quad(
            [V.x0, 0, V.z1],
            [V.x1, 0, V.z1],
            [V.x1, 0.02, V.z1],
            [V.x0, 0.02, V.z1],
            [0, 0, 1],
            STONE,
            1,
        );
        if (S) {
            S.ramp(
                V.x0 + 0.35,
                0,
                V.open1 - 1.2,
                V.x1 - 0.35,
                V.z1,
                2,
                yAt(V.open1 - 1.2),
                yAt(V.z1) + 0.01,
                "roof",
            );
            S.ramp(
                V.x0 + 0.35,
                0,
                V.z0,
                V.x1 - 0.35,
                V.open1 - 1.2,
                2,
                yAt(V.z0),
                yAt(V.open1 - 1.2),
                "roof",
                0,
                1.3,
            );
        }

        const LG = 0x2f3a33;
        for (let z = V.z0 + 0.4; z < V.z1 - 6; z += 14.4)
            for (const x of [V.x0 + 0.17, V.x1 - 0.17]) {
                const y = yAt(z - 0.3) + 1.22;
                if (yAt(z) < 1.5) continue;
                mb.setColor(LG)
                    .setPart(5)
                    .box(x - 0.2, y, z - 0.2, x + 0.2, y + 0.5, z + 0.2)
                    .cyl(x, y + 0.5, z, 0.16, 0.12, 0.3, 8)
                    .cyl(x, y + 0.8, z, 0.11, 0.075, 3.4, 8)
                    .cyl(x, y + 1.6, z, 0.14, 0.14, 0.12, 8)
                    .cyl(x, y + 4.2, z, 0.13, 0.13, 0.12, 8);
                mb.box(
                    x - 0.05,
                    y + 4.3,
                    z - 0.95,
                    x + 0.05,
                    y + 4.4,
                    z + 0.95,
                );
                for (const dz of [-0.9, 0.9]) {
                    mb.setColor(LG).cyl(
                        x,
                        y + 4.4,
                        z + dz,
                        0.05,
                        0.05,
                        0.12,
                        6,
                    );
                    mb.setColor(0xefe8d2)
                        .setPart(1)
                        .cyl(x, y + 4.52, z + dz, 0.2, 0.24, 0.5, 8)
                        .setColor(LG)
                        .setPart(5)
                        .cyl(x, y + 5.02, z + dz, 0.26, 0.02, 0.22, 8);
                }
                mb.setColor(0xefe8d2)
                    .setPart(1)
                    .cyl(x, y + 4.4, z, 0.22, 0.26, 0.55, 8)
                    .setColor(LG)
                    .setPart(5)
                    .cyl(x, y + 4.95, z, 0.28, 0.02, 0.3, 8);
                if (S) S.cyl(x, z, y, y + 4.3, 0.12, 0.08, "pole");
            }
    }

    {
        const gm2 = new THREE.Mesh(
            gw.build(),
            new THREE.MeshBasicMaterial({ vertexColors: true }),
        );
        gm2.name = "grandCentralGlow";
        scene.add(gm2);
    }
    const sm = new THREE.Mesh(mb.build({ part: true }), stoneMaterial(T));
    sm.name = "grandCentral";
    sm.castShadow = true;
    sm.receiveShadow = true;
    sm.layers.enable(REFL_LAYER);
    sm.layers.enable(BIG_CASTER_LAYER);
    scene.add(sm);
    if (glass.length) {
        const P = [],
            N = [],
            U = [];
        for (const g0 of glass) {
            const g = g0.index ? g0.toNonIndexed() : g0;
            const p = g.attributes.position,
                n = g.attributes.normal,
                u = g.attributes.uv;
            for (let i = 0; i < p.count; i++) {
                P.push(p.getX(i), p.getY(i), p.getZ(i));
                N.push(n.getX(i), n.getY(i), n.getZ(i));
                U.push(u.getX(i), u.getY(i));
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
        g.computeBoundingSphere();
        const gm = new THREE.Mesh(g, glassMaterial());
        gm.name = "grandCentralGlass";
        gm.receiveShadow = true;
        scene.add(gm);
    }
    gen.footprints.push({
        x0: X0,
        z0: ZB,
        x1: X1,
        z1: ZF,
        h: 46,
        kind: "deco",
    });
    gen.boxes.push({ min: [X0 - 1, 0, ZB - 1], max: [X1 + 1, 47, ZF + 3] });
    gen.boxes.push({ min: [X0 - 6.5, 0, ZB - 1], max: [X1 + 6.5, 14.5, -84] });

    gen.__gcT = T;
    gen.__gcScene = scene;
    buildMetLife(gen);
    buildParkPodium(gen, scene, T);
}

function podiumGlassMaterial(Y0, FH, BW) {
    const m = new THREE.MeshStandardMaterial({
        color: 0x1c1d1c,
        roughness: 0.1,
        metalness: 0.85,
    });
    m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                "#include <common>\nvarying vec3 vPW; varying vec3 vPN;",
            )
            .replace(
                "#include <fog_vertex>",
                "#include <fog_vertex>\nvPW = (modelMatrix * vec4(transformed, 1.0)).xyz; vPN = normalize(mat3(modelMatrix) * objectNormal);",
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      varying vec3 vPW; varying vec3 vPN; float pOpq = 0.0; float pH = 0.0, pH2 = 0.0, pH3 = 0.0; vec3 pInt = vec3(0.0);
      float ph(vec2 p) { return fract(sin(dot(p, vec2(41.37, 289.11))) * 23758.5453); }`,
            )
            .replace(
                "#include <map_fragment>",
                `#include <map_fragment>
      {
        vec3 n = normalize(vPN), tW = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4));
        float u = dot(vPW, tW), fl = (vPW.y - ${Y0.toFixed(2)}) / ${FH.toFixed(2)};
        float fy = fract(fl), fu = fract(u / ${BW.toFixed(2)});
        vec2 id = vec2(floor(u / ${BW.toFixed(2)}) + n.x * 17.0 + n.z * 31.0, floor(fl));
        pH = ph(id); pH2 = ph(id + 7.3); pH3 = ph(vec2(floor(u / (${BW.toFixed(2)} * 3.0)), id.y) + 3.1);   // pane / room hashes
        float fwU = fwidth(u / ${BW.toFixed(2)}) + 1e-4, fwY = fwidth(fl) + 1e-4;
        float mull = max(1.0 - smoothstep(0.025, 0.025 + fwU * 1.5, min(fu, 1.0 - fu)), 1.0 - smoothstep(0.012, 0.012 + fwY * 1.5, abs(fy - 0.235)));
        float span = 1.0 - smoothstep(0.215, 0.215 + fwY, fy);                    // opaque spandrel band at the slab
        pOpq = max(span, mull);
        // interior: room box behind the pane (back wall 6 m in, floor at the sill, ceiling 2.9 m up)
        vec3 V = normalize(vPW - cameraPosition);
        float cv = max(dot(V, -n), 0.06);
        float yF = ${Y0.toFixed(2)} + floor(fl) * ${FH.toFixed(2)} + 0.95, yC = yF + 2.85;
        float tB = 6.0 / cv, tC = V.y > 0.001 ? (yC - vPW.y) / V.y : 1e5, tF = V.y < -0.001 ? (yF - vPW.y) / V.y : 1e5;
        float lit = step(0.35, pH3);
        vec3 col;
        if (tC < tB && tC < tF) { vec3 h = vPW + V * tC; float lx = abs(fract(dot(h, tW) / 1.5) - 0.5), lz = abs(fract(dot(h, n) / 2.4) - 0.5);
          col = vec3(0.1) + lit * vec3(0.95, 0.97, 1.0) * 0.55 * (1.0 - smoothstep(0.12, 0.16, lx)) * (1.0 - smoothstep(0.3, 0.34, lz)); }
        else if (tF < tB) { vec3 h = vPW + V * tF; col = vec3(0.06, 0.06, 0.065) * (0.7 + 0.6 * exp(-tF * 0.2)); }
        else { vec3 h = vPW + V * tB; float hy = h.y - yF; float bx = dot(h, tW);
          col = mix(vec3(0.16, 0.16, 0.15), vec3(0.24, 0.22, 0.19), ph(vec2(floor(bx / 4.0), id.y)));
          float desk = step(0.0, hy) * step(hy, 0.78) * step(0.25, fract(bx / 2.6)); col = mix(col, vec3(0.05), desk * 0.8);
          col *= 0.5 + 0.5 * lit; }
        col *= 0.35 + 0.65 * lit;
        // blinds: some bays drawn part-way down from the head
        // (street r12) critic: 'randomly scattered bright white window cells (missing-texture flicker)'. Blinds are now
        // set per 3-bay office (one tenant, one drop height, quantised to thirds) and are a dusty dark bronze, not cream
        float bl = pH3 > 0.62 ? 0.2 + 0.25 * floor(ph(vec2(floor(u / (${BW.toFixed(2)} * 3.0)), id.y) + 1.9) * 3.0) : 0.0;
        float wy = (fy - 0.235) / 0.765;
        float blind = step(1.0 - bl, wy);
        float slat = mix(0.92, 0.85 + 0.15 * step(0.5, fract(vPW.y * 18.0)), 1.0 - smoothstep(0.15, 0.4, fwidth(vPW.y * 18.0)));
        pInt = mix(col, vec3(0.0), blind);
        diffuseColor.rgb = mix(diffuseColor.rgb * (0.75 + 0.5 * pH), vec3(0.17, 0.155, 0.13) * slat * (0.9 + 0.15 * pH2), blind * 0.85); // (street r12) darker blinds
        pOpq = max(pOpq, blind * 0.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, span > 0.5 ? vec3(0.075, 0.068, 0.058) : vec3(0.1, 0.09, 0.075), max(span, mull));
      }`,
            )
            .replace(
                "#include <roughnessmap_fragment>",
                "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.05 + 0.18 * pH * pH, 0.55, pOpq);",
            )
            .replace(
                "#include <metalnessmap_fragment>",
                "#include <metalnessmap_fragment>\nmetalnessFactor = mix(0.85, 0.25, pOpq);",
            )
            .replace(
                "#include <normal_fragment_maps>",
                `#include <normal_fragment_maps>
        normal = normalize(normal + vec3(pH - 0.5, pH2 - 0.5, 0.0) * 0.045 * (1.0 - pOpq));   // per-pane tilt (oil-canning)`,
            )
            .replace(
                "#include <emissivemap_fragment>",
                `#include <emissivemap_fragment>
        {
          float cv2 = max(dot(normalize(cameraPosition - vPW), normalize(vPN)), 0.0);
          float fres = 0.06 + 0.94 * pow(1.0 - cv2, 5.0);
          totalEmissiveRadiance += pInt * (1.0 - fres) * (1.0 - pOpq) * 0.55;
        }`,
            );
    };
    m.customProgramCacheKey = () => "gc-podium-glass-v2";
    return m;
}

export const GC_PODIUM = { x0: 456, x1: 494, z0: -70, z1: -10 };

export const GC_FORECOURTS = [
    { x0: 402, z0: -71, x1: 414, z1: -9, nx: 1, nz: 0, W: 12, L: 62 },
    { x0: 446, z0: -71, x1: 456, z1: -9, nx: -1, nz: 0, W: 10, L: 62 },
];
export const GC_TREE_SPOTS = [];
export const GC_CROWD_SPOTS = [];
function buildParkPodium(gen, scene, T) {
    const S = gen.solids,
        Z = gen.zips,
        R = GC_PODIUM;
    GC_TREE_SPOTS.length = 0;
    GC_CROWD_SPOTS.length = 0;
    const t = gen.tile((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2);
    const Y0 = G.CURB_H,
        YL = 5.4,
        YT = 25.4 /* (street r7) 5 floors: ref 04's podium is a tall dark-glass block whose roof is barely seen */,
        f = (style) => ({ style, gH: -0.01 });
    const GL = {
        floorH: 4.0,
        bayW: 1.52,
        winW: 0.94,
        winH: 0.84,
        layer: LAYER.METAL,
        base: LAYER.METAL,
        seed: 81,
        margin: 0,
        depth: 0.14,
        tint: [0.2, 0.2, 0.19],
        resid: 0,
    };
    const LOB = {
        ...GL,
        floorH: 5.25,
        bayW: 3.0,
        winW: 0.95,
        winH: 0.9,
        tint: [0.5, 0.5, 0.48],
        seed: 82,
    };
    const all = (st) => ({ px: f(st), nx: f(st), pz: f(st), nz: f(st) });
    const IN = 2.6; // lobby set back behind the column line
    for (const B of [t.fac, t.lod]) {
        B.box(
            R.x0 + IN,
            Y0,
            R.z0 + IN,
            R.x1 - IN,
            YL,
            R.z1 - IN,
            { ...LOB, topY: YL, baseY: Y0 },
            all(STYLE.CURTAIN),
            false,
            false,
        );
    }
    // (street r8) critic: 'curtain wall is uniform grey panels with identical reflections; add mullion depth, varied tint,

    {
        const P = [],
            N = [],
            add = (a, b, c, d, n) => {
                P.push(...a, ...b, ...c, ...a, ...c, ...d);
                for (let i = 0; i < 6; i++) N.push(...n);
            };
        add(
            [R.x0, YL, R.z1],
            [R.x1, YL, R.z1],
            [R.x1, YT, R.z1],
            [R.x0, YT, R.z1],
            [0, 0, 1],
        );
        add(
            [R.x1, YL, R.z0],
            [R.x0, YL, R.z0],
            [R.x0, YT, R.z0],
            [R.x1, YT, R.z0],
            [0, 0, -1],
        );
        add(
            [R.x1, YL, R.z1],
            [R.x1, YL, R.z0],
            [R.x1, YT, R.z0],
            [R.x1, YT, R.z1],
            [1, 0, 0],
        );
        add(
            [R.x0, YL, R.z0],
            [R.x0, YL, R.z1],
            [R.x0, YT, R.z1],
            [R.x0, YT, R.z0],
            [-1, 0, 0],
        );
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
        const gm = new THREE.Mesh(g, podiumGlassMaterial(YL, 4.0, 1.52));
        gm.name = "parkPodiumGlass";
        gm.castShadow = true;
        gm.receiveShadow = true;
        gm.layers.enable(BIG_CASTER_LAYER);
        scene.add(gm);
    }
    S.box(R.x0 + IN, Y0, R.z0 + IN, R.x1 - IN, YL, R.z1 - IN, "wall");
    S.box(R.x0, YL, R.z0, R.x1, YT, R.z1, "wall");
    const mb = new MB();
    const bx = (x0, y0, z0, x1, y1, z1, c, part, kind = null) => {
        mb.setColor(c).setPart(part).box(x0, y0, z0, x1, y1, z1);
        if (kind && S) S.box(x0, y0, z0, x1, y1, z1, kind);
    };
    bx(
        R.x0 + 0.02,
        YL - 0.44,
        R.z0 + 0.02,
        R.x1 - 0.02,
        YL + 0.3,
        R.z1 - 0.02,
        0x3b3833,
        1,
        null,
    );

    for (let x = R.x0 + 1.2; x < R.x1 - 0.5; x += (R.x1 - R.x0 - 2.4) / 6)
        for (const z of [R.z0 + 1.2, R.z1 - 1.2])
            bx(
                x - 0.45,
                Y0,
                z - 0.45,
                x + 0.45,
                YL,
                z + 0.45,
                0xa7a9a6,
                5,
                "wall",
            );
    for (
        let z = R.z0 + 1.2 + (R.z1 - R.z0 - 2.4) / 7;
        z < R.z1 - 2;
        z += (R.z1 - R.z0 - 2.4) / 7
    )
        for (const x of [R.x0 + 1.2, R.x1 - 1.2])
            bx(
                x - 0.45,
                Y0,
                z - 0.45,
                x + 0.45,
                YL,
                z + 0.45,
                0xa7a9a6,
                5,
                "wall",
            );

    const FIN = 0x2c2924;
    mb.setPart(1);
    for (let x = R.x0 + 3.04; x < R.x1 - 0.3; x += 3.04) {
        bx(x - 0.05, YL, R.z0 - 0.15, x + 0.05, YT, R.z0, FIN, 1);
        bx(x - 0.05, YL, R.z1, x + 0.05, YT, R.z1 + 0.15, FIN, 1);
    }
    for (let z = R.z0 + 3.04; z < R.z1 - 0.3; z += 3.04) {
        bx(R.x0 - 0.15, YL, z - 0.05, R.x0, YT, z + 0.05, FIN, 1);
        bx(R.x1, YL, z - 0.05, R.x1 + 0.15, YT, z + 0.05, FIN, 1);
    }
    for (let y = YL; y < YT; y += 4.0) {
        bx(
            R.x0 - 0.2,
            y - 0.45,
            R.z0 - 0.2,
            R.x1 + 0.2,
            y + 0.25,
            R.z1 + 0.2,
            FIN,
            1,
            "ledge",
        );
    }

    bx(
        R.x0 - 0.15,
        YT,
        R.z0 - 0.15,
        R.x1 + 0.15,
        YT + 1.1,
        R.z0 + 1.4,
        FIN,
        5,
        "parapet",
    );
    bx(
        R.x0 - 0.15,
        YT,
        R.z1 - 1.4,
        R.x1 + 0.15,
        YT + 1.1,
        R.z1 + 0.15,
        FIN,
        5,
        "parapet",
    );
    bx(
        R.x0 - 0.15,
        YT,
        R.z0 + 1.4,
        R.x0 + 1.4,
        YT + 1.1,
        R.z1 - 1.4,
        FIN,
        5,
        "parapet",
    );
    bx(
        R.x1 - 1.4,
        YT,
        R.z0 + 1.4,
        R.x1 + 0.15,
        YT + 1.1,
        R.z1 - 1.4,
        FIN,
        5,
        "parapet",
    );
    bx(
        R.x0 + 1.4,
        YT,
        R.z0 + 1.4,
        R.x1 - 1.4,
        YT + 0.012,
        R.z1 - 1.4,
        0x77726a,
        1,
        null,
    );
    if (Z) {
        Z.edge(R.x0 - 0.03, R.z0, R.x0 - 0.03, R.z1, YT + 1.1, -1, 0);
        Z.edge(R.x1 + 0.03, R.z0, R.x1 + 0.03, R.z1, YT + 1.1, 1, 0);
        Z.edge(R.x0, R.z0 - 0.03, R.x1, R.z0 - 0.03, YT + 1.1, 0, -1);
        Z.edge(R.x0, R.z1 + 0.03, R.x1, R.z1 + 0.03, YT + 1.1, 0, 1);
    }
    const rnd = (() => {
        let a = 90210;
        return () => {
            a = (a + 0x6d2b79f5) | 0;
            let t2 = Math.imul(a ^ (a >>> 15), 1 | a);
            t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2;
            return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296;
        };
    })();

    const zc = (R.z0 + R.z1) / 2,
        xc = (R.x0 + R.x1) / 2;
    const PLANT = 0x4a4436,
        _SOIL = 0x4a4234,
        GRAV = 0x78736a,
        PAVE = 0x6f6a61,
        TEAK = 0x6b4f36,
        STEEL = 0x5a5d5e;
    const PAL_R = [
        [
            [0.17, 0.18, 0.08],
            [0.1, 0.11, 0.05],
        ],
        [
            [0.13, 0.15, 0.08],
            [0.08, 0.1, 0.05],
        ],
        [
            [0.28, 0.25, 0.1],
            [0.17, 0.15, 0.06],
        ],
        [
            [0.24, 0.18, 0.08],
            [0.15, 0.11, 0.05],
        ],
        [
            [0.3, 0.2, 0.07],
            [0.19, 0.12, 0.05],
        ],
        [
            [0.2, 0.21, 0.09],
            [0.12, 0.13, 0.06],
        ],
        [
            [0.36, 0.3, 0.1],
            [0.22, 0.18, 0.06],
        ],
        [
            [0.4, 0.33, 0.09],
            [0.25, 0.2, 0.06],
        ],
    ];
    const spot = (x, z, kind, sc) =>
        GC_TREE_SPOTS.push({
            x,
            y: YT + 0.45,
            z,
            kind,
            sc,
            pal: [PAL_R[Math.floor(rnd() * PAL_R.length)]],
        });

    bx(
        R.x0 + 1.4,
        YT + 0.012,
        zc - 1.6,
        R.x1 - 1.4,
        YT + 0.02,
        zc + 1.6,
        PAVE,
        1,
        null,
    );
    const MECH = [R.x1 - 12.5, zc + 1.9, R.x1 - 1.6, R.z1 - 1.6];
    const crossX = [];
    for (let x = R.x0 + 7; x < R.x1 - 13.7; x += 11.5) crossX.push(x);
    for (const x of crossX)
        bx(
            x - 1.1,
            YT + 0.012,
            R.z0 + 1.4,
            x + 1.1,
            YT + 0.018,
            R.z1 - 1.4,
            GRAV,
            1,
            null,
        );

    const beds = [];
    const xs = [
        R.x0 + 1.4,
        ...crossX.flatMap((x) => [x - 1.1, x + 1.1]),
        R.x1 - 1.4,
    ];
    for (let i = 0; i + 1 < xs.length; i += 2)
        for (const [z0, z1] of [
            [R.z0 + 1.4, zc - 1.6],
            [zc + 1.6, R.z1 - 1.4],
        ])
            beds.push([xs[i] + 0.5, z0 + 0.5, xs[i + 1] - 0.5, z1 - 0.5]);

    let bedI = 0;
    for (const [x0, z0, x1, z1] of beds) {
        if (x1 - x0 < 2) continue;
        if (x1 > MECH[0] && x0 < MECH[2] && z1 > MECH[1] && z0 < MECH[3])
            continue;
        const lawn = bedI++ % 5 === 2;
        bx(x0, YT, z0, x1, YT + 0.45, z1, 0x4e4034, 5, null);
        bx(
            x0 + 0.12,
            YT + 0.45,
            z0 + 0.12,
            x1 - 0.12,
            YT + 0.46,
            z1 - 0.12,
            lawn
                ? [0x5f5a3c, 0x575436, 0x645c3e][bedI % 3]
                : [0x3a3326, 0x40372a, 0x352f25, 0x3d3829][
                      Math.floor(rnd() * 4)
                  ],
            6,
            null,
        );

        const zb = z0 > zc ? z0 - 0.55 : z1 + 0.55,
            fz = z0 > zc ? -1 : 1;
        for (let x = x0 + 1.5; x < x1 - 2.5; x += 5.5 + rnd() * 2) {
            bx(
                x,
                YT + 0.4,
                zb - 0.25,
                x + 1.8,
                YT + 0.46,
                zb + 0.25,
                TEAK,
                5,
                null,
            );
            bx(
                x,
                YT + 0.46,
                zb + fz * 0.22 - 0.04,
                x + 1.8,
                YT + 0.85,
                zb + fz * 0.22 + 0.04,
                TEAK,
                5,
                null,
            );
            for (const xx of [x + 0.15, x + 1.6])
                bx(
                    xx,
                    YT,
                    zb - 0.22,
                    xx + 0.06,
                    YT + 0.4,
                    zb + 0.22,
                    STEEL,
                    5,
                    null,
                );

            if (rnd() < 0.6)
                for (let k = 0, nk = rnd() < 0.4 ? 2 : 1; k < nk; k++)
                    GC_CROWD_SPOTS.push({
                        x: x + 0.45 + k * 0.9 + (rnd() - 0.5) * 0.2,
                        z: zb + fz * 0.06,
                        y: YT + 0.03,
                        ry: fz < 0 ? 0 : Math.PI,
                        mode: "sit",
                        elev: true,
                    });
        }

        const area = (x1 - x0) * (z1 - z0);
        if (lawn) {
            spot(
                (x0 + x1) / 2 + (rnd() - 0.5) * 2,
                (z0 + z1) / 2 + (rnd() - 0.5) * 2,
                "street",
                0.5 + rnd() * 0.15,
            );
            for (const [cx2, cz2] of [
                [x0 + 0.9, z0 + 0.9],
                [x1 - 0.9, z1 - 0.9],
            ])
                if (rnd() < 0.8) spot(cx2, cz2, "small", 0.3 + rnd() * 0.12);

            for (
                let k = 0, n = Math.round(((x1 - x0) * (z1 - z0)) / 9);
                k < n;
                k++
            )
                GC_TREE_SPOTS.push({
                    x: x0 + 0.6 + rnd() * (x1 - x0 - 1.2),
                    y: YT + 0.45,
                    z: z0 + 0.6 + rnd() * (z1 - z0 - 1.2),
                    kind: "small",
                    sc: 0.16 + rnd() * 0.12,
                    pal: [PAL_R[[2, 6, 7, 5][Math.floor(rnd() * 4)]]],
                });
            continue;
        }

        for (let d = 0, nd = 5 + (rnd() < 0.5 ? 1 : 0); d < nd; d++) {
            const dx = x0 + 1.2 + rnd() * (x1 - x0 - 2.4),
                dz = z0 + 1.2 + rnd() * (z1 - z0 - 2.4),
                pal = [PAL_R[Math.floor(rnd() * PAL_R.length)]];
            for (let k = 0, n = 7 + Math.floor(rnd() * 5); k < n; k++) {
                const px = Math.min(
                        x1 - 0.7,
                        Math.max(x0 + 0.7, dx + (rnd() - 0.5) * 3.2),
                    ),
                    pz = Math.min(
                        z1 - 0.7,
                        Math.max(z0 + 0.7, dz + (rnd() - 0.5) * 3.2),
                    );
                GC_TREE_SPOTS.push({
                    x: px,
                    y: YT + 0.45,
                    z: pz,
                    kind: "small",
                    sc: 0.26 + rnd() * rnd() * 0.34,
                    pal,
                });
            }
        }
        for (let k = 0, n = Math.max(2, Math.round(area / 90)); k < n; k++)
            spot(
                x0 + 2 + rnd() * (x1 - x0 - 4),
                z0 + 2 + rnd() * (z1 - z0 - 4),
                rnd() < 0.5 ? "street" : "small",
                rnd() < 0.5 ? 0.5 + rnd() * 0.15 : 0.65 + rnd() * 0.3,
            );
    }

    const edge = (x0, z0, x1, z1) => {
        const L = Math.hypot(x1 - x0, z1 - z0);
        let run = 0;
        for (let u = 0.6; u < L - 0.5; u += 1.3 + rnd() * 0.9) {
            if (run <= 0) {
                if (rnd() < 0.18) {
                    u += 1.5 + rnd() * 2.5;
                    continue;
                }
                run = 2 + Math.floor(rnd() * 3);
            }
            run--;
            const k = u / L;
            if (
                x0 === x1
                    ? false
                    : x0 + (x1 - x0) * k > MECH[0] - 0.5 && z0 > zc
            )
                continue;
            GC_TREE_SPOTS.push({
                x: x0 + (x1 - x0) * k,
                y: YT + 0.7,
                z: z0 + (z1 - z0) * k,
                kind: "small",
                sc: 0.26 + rnd() * rnd() * 0.24,
                pal: [PAL_R[[6, 7, 2, 4][Math.floor(rnd() * 4)]]],
            });
        }
    };
    edge(R.x0 + 0.7, R.z0 + 0.7, R.x1 - 0.7, R.z0 + 0.7);
    edge(R.x0 + 0.7, R.z1 - 0.7, R.x1 - 0.7, R.z1 - 0.7);
    edge(R.x0 + 0.7, R.z0 + 0.7, R.x0 + 0.7, R.z1 - 0.7);
    edge(R.x1 - 0.7, R.z0 + 0.7, R.x1 - 0.7, R.z1 - 0.7);

    {
        const stX = (R.x1 - R.x0 - 2.4) / 6,
            stZ = (R.z1 - R.z0 - 2.4) / 7;
        const nearCol = (v, a, st) => {
            const m = (((v - a) % st) + st) % st;
            return m < 1.1 || m > st - 1.1;
        };
        const grp = (cx, cz, y, elev) => {
            if (
                !elev &&
                (nearCol(cx, R.x0 + 1.2, stX) || nearCol(cz, R.z0 + 1.2, stZ))
            )
                return;
            const n = rnd() < 0.35 ? 1 : 2 + Math.floor(rnd() * 2),
                a0 = rnd() * 6.28,
                R0 = 0.42 + n * 0.06;
            for (let k = 0; k < n; k++) {
                const ang = a0 + (k / n) * 6.28,
                    px = n === 1 ? cx : cx + Math.cos(ang) * R0,
                    pz = n === 1 ? cz : cz + Math.sin(ang) * R0;
                GC_CROWD_SPOTS.push({
                    x: px,
                    z: pz,
                    y,
                    ry: n === 1 ? rnd() * 6.28 : Math.atan2(cx - px, cz - pz),
                    mode: "stand",
                    clip:
                        n === 1
                            ? rnd() < 0.6
                                ? "phone"
                                : "idle"
                            : rnd() < 0.7
                              ? "talk"
                              : "idle",
                    elev,
                });
            }
        };
        for (let x = R.x0 + 3 + rnd() * 3; x < R.x1 - 3; x += 4.5 + rnd() * 5)
            grp(x, zc + (rnd() - 0.5) * 2.2, YT + 0.02, true);
        for (const x of crossX)
            for (let z = R.z0 + 4 + rnd() * 4; z < R.z1 - 4; z += 9 + rnd() * 8)
                if (Math.abs(z - zc) > 3)
                    grp(x + (rnd() - 0.5) * 1.2, z, YT + 0.02, true);

        for (const [za, zb2] of [
            [R.z0 + 0.3, R.z0 + IN - 0.3],
            [R.z1 - IN + 0.3, R.z1 - 0.3],
        ])
            for (
                let x = R.x0 + 2.5 + rnd() * 3;
                x < R.x1 - 2.5;
                x += 3.5 + rnd() * 5
            )
                grp(x, za + (zb2 - za) * (0.3 + rnd() * 0.4), Y0, false);
        for (const [xa, xb2] of [
            [R.x0 + 0.3, R.x0 + IN - 0.3],
            [R.x1 - IN + 0.3, R.x1 - 0.3],
        ])
            for (
                let z = R.z0 + 3 + rnd() * 3;
                z < R.z1 - 3;
                z += 3.5 + rnd() * 5
            )
                grp(xa + (xb2 - xa) * (0.3 + rnd() * 0.4), z, Y0, false);
    }
    {
        const [mx0, mz0, mx1, mz1] = MECH,
            BRK = 0x7d7468,
            LOUV = 0x5c5f5c,
            TAR = 0x4b4a47;
        bx(mx0, YT, mz0, mx1, YT + 0.02, mz1, TAR, 1, null);
        const hx0 = mx0 + 3.2,
            hx1 = mx1 - 0.6,
            hz0 = mz0 + 1.6,
            hz1 = mz1 - 0.4;
        bx(hx0, YT, hz0, hx1, YT + 4.2, hz1, BRK, 1, "wall");
        bx(
            hx0 - 0.15,
            YT + 4.2,
            hz0 - 0.15,
            hx1 + 0.15,
            YT + 4.5,
            hz1 + 0.15,
            0x6c6459,
            1,
            "ledge",
        );
        bx(
            hx1 - 3.2,
            YT + 4.5,
            hz0 + 0.4,
            hx1 - 0.3,
            YT + 6.3,
            hz1 - 0.4,
            BRK,
            1,
            "wall",
        );
        bx(
            hx1 - 3.3,
            YT + 6.3,
            hz0 + 0.3,
            hx1 - 0.2,
            YT + 6.5,
            hz1 - 0.3,
            0x6c6459,
            1,
            "ledge",
        );
        mb.setColor(LOUV).setPart(5);
        for (let y = YT + 1.2; y < YT + 3.8; y += 0.18)
            mb.box(
                hx0 - 0.08,
                y,
                hz0 + 0.6,
                hx0,
                y + 0.07,
                hz1 - 0.6,
                0b111111,
            );
        bx(
            hx0 - 0.1,
            YT,
            (hz0 + hz1) / 2 - 0.5,
            hx0,
            YT + 2.2,
            (hz0 + hz1) / 2 + 0.5,
            0x3d3b37,
            5,
            null,
        );

        for (let k = 0; k < 3; k++) {
            const cx = mx0 + 0.3 + k * 1.02,
                cz = mz0 + 0.5;
            bx(
                cx - 0.05,
                YT,
                cz - 0.1,
                cx + 0.95,
                YT + 0.25,
                cz + 1.9,
                0x3a3c3b,
                5,
                null,
            );
            bx(
                cx,
                YT + 0.25,
                cz,
                cx + 0.9,
                YT + 1.25,
                cz + 1.8,
                [0x9fa19c, 0x8f918c, 0xa7a59c][k],
                5,
                "wall",
            );
            mb.setColor(0x2e302f)
                .setPart(5)
                .cyl(cx + 0.45, YT + 1.25, cz + 0.9, 0.36, 0.36, 0.05, 12);
        }
        for (const [fx, fz] of [
            [mx0 + 1.2, mz1 - 1.4],
            [mx0 + 2.5, mz1 - 1.1],
        ]) {
            mb.setColor(0x8a8c88)
                .setPart(5)
                .cyl(fx, YT, fz, 0.45, 0.4, 0.9, 10)
                .cyl(fx, YT + 0.9, fz, 0.55, 0.55, 0.12, 10);
        }
        bx(
            mx0 + 0.3,
            YT + 1.6,
            hz0 + 0.3,
            hx0,
            YT + 2.2,
            hz0 + 0.9,
            0x9a9c97,
            5,
            null,
        );
        for (let x = mx0 + 0.6; x < hx0; x += 1.4)
            bx(
                x,
                YT,
                hz0 + 0.5,
                x + 0.1,
                YT + 1.6,
                hz0 + 0.7,
                0x3a3c3b,
                5,
                null,
            );
    }

    for (const [x0, z0, x1, z1] of [
        [R.x0 - 0.05, R.z0 - 0.05, R.x1 + 0.05, R.z0 + 0.05],
        [R.x0 - 0.05, R.z1 - 0.05, R.x1 + 0.05, R.z1 + 0.05],
        [R.x0 - 0.05, R.z0, R.x0 + 0.05, R.z1],
        [R.x1 - 0.05, R.z0, R.x1 + 0.05, R.z1],
    ]) {
        const yb = YT + 1.1;
        bx(x0, yb + 1.0, z0, x1, yb + 1.06, z1, STEEL, 5, null);
        bx(x0, yb + 0.5, z0, x1, yb + 0.53, z1, STEEL, 5, null);
        const L = Math.max(x1 - x0, z1 - z0),
            alongX = x1 - x0 > z1 - z0;
        for (let u = 0; u <= L; u += 1.8) {
            const x = alongX ? x0 + u : x0,
                z = alongX ? z0 : z0 + u;
            bx(
                x - 0.03 + (alongX ? 0 : 0.05),
                yb,
                z - 0.03 + (alongX ? 0.05 : 0),
                x + 0.03 + (alongX ? 0 : 0.05),
                yb + 1.0,
                z + 0.03 + (alongX ? 0.05 : 0),
                STEEL,
                5,
                null,
            );
        }
    }

    {
        const gw = new MB(),
            zm = (R.z0 + R.z1) / 2,
            xg = R.x0 + IN;
        gw.setColor(0xf4e6c4);
        for (let z = R.z0 + 0.8; z < R.z1 - 0.8; z += 2.1)
            for (let x = R.x0 + 0.5; x < xg - 0.3; x += 1.1)
                gw.box(x, YL - 0.47, z, x + 0.7, YL - 0.46, z + 1.2, 0b001000);
        for (let x = R.x0 + 0.8; x < R.x1 - 0.8; x += 2.1)
            for (const [za, zb] of [
                [R.z0 + 0.3, R.z0 + IN - 0.2],
                [R.z1 - IN + 0.2, R.z1 - 0.3],
            ])
                for (let z = za; z < zb - 0.5; z += 1.1)
                    gw.box(
                        x,
                        YL - 0.47,
                        z,
                        x + 1.2,
                        YL - 0.46,
                        z + 0.7,
                        0b001000,
                    );

        bx(
            xg - 0.1,
            3.7,
            zm - 5.5,
            xg - 0.02,
            4.6,
            zm + 5.5,
            0x241f1a,
            5,
            null,
        );
        if (S) S.box(xg - 0.13, 3.7, zm - 5.5, xg, 4.6, zm + 5.5, "wall");
        for (let z = zm - 5.0, i = 0; z < zm + 5.0; z += 0.55, i++)
            if (i % 6 !== 4)
                gw.setColor(0xefe2c2).box(
                    xg - 0.13,
                    3.92,
                    z,
                    xg - 0.1,
                    4.38,
                    z + 0.38,
                    0b000010,
                );

        for (const dz of [-2.4, 0, 2.4]) {
            mb.setColor(0x9a9c98)
                .setPart(5)
                .cyl(xg - 1.0, Y0, zm + dz, 1.0, 1.0, 0.08, 16)
                .cyl(xg - 1.0, Y0 + 2.5, zm + dz, 1.05, 1.05, 0.25, 16);
            if (S) {
                S.cyl(xg - 1.0, zm + dz, Y0, Y0 + 2.5, 1.0, 1.0, "wall");
                S.cyl(
                    xg - 1.0,
                    zm + dz,
                    Y0 + 2.5,
                    Y0 + 2.75,
                    1.05,
                    1.05,
                    "wall",
                );
            }
        }
        gw.setColor(0xb89a6a);
        for (const dz of [-2.4, 0, 2.4])
            gw.cyl(xg - 1.0, Y0 + 0.08, zm + dz, 0.99, 0.99, 2.42, 16);
        const gm = new THREE.Mesh(
            gw.build(),
            new THREE.MeshBasicMaterial({ vertexColors: true }),
        );
        gm.name = "parkPodiumGlow";
        scene.add(gm);
        if (gen.buildings)
            for (const dz of [-9, 9]) {
                const by = YL + 1.2,
                    bz = zm + dz;
                mb.setColor(0xb4b6b2)
                    .setPart(5)
                    .tube(
                        [R.x0 - 0.2, by, bz],
                        [R.x0 - 2.8, by + 1.9, bz],
                        0.045,
                        6,
                    );
                (gen.buildings.flags ??= []).push({
                    top: new THREE.Vector3(R.x0 - 2.8, by + 1.9, bz),
                    base: new THREE.Vector3(R.x0 - 0.2, by, bz),
                    N: [-1, 0, 0],
                    T: [0, 0, 1],
                    color: dz < 0 ? 0 : 1,
                });
            }
    }
    void xc;
    void PLANT;
    void GRAV;
    const mesh = new THREE.Mesh(mb.build({ part: true }), stoneMaterial(T));
    mesh.name = "parkPodium";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    gen.footprints.push({
        x0: R.x0,
        z0: R.z0,
        x1: R.x1,
        z1: R.z1,
        h: YT + 1.1,
        kind: "glass",
    });
    gen.boxes.push({
        min: [R.x0 - 0.3, 0, R.z0 - 0.3],
        max: [R.x1 + 0.3, YT + 4, R.z1 + 0.3],
    });
}

function buildMetLife(gen) {
    const S = gen.solids,
        Z = gen.zips;
    const cx = CX,
        cz = -200,
        PORT = 14.0,
        TOP = 214;
    const t = gen.tile(cx, cz);
    const P = {
        floorH: 3.9,
        bayW: 1.45,
        winW: 0.46,
        winH: 0.8,
        /* (street r11) tall narrow slots between deep precast mullions: vertical ribbing (ref 04) */ layer: LAYER.CONCRETE,
        base: LAYER.GRANITE,
        seed: 45,
        margin: 0.1,
        depth: 0.3,
        tint: [0.95, 0.92, 0.85],
        resid: 0,
    };
    const BAND = {
        ...P,
        layer: LAYER.METAL,
        floorH: 3.0,
        bayW: 1.45,
        winW: 0.96,
        winH: 0.84,
        depth: 0.05,
        margin: 0,
        tint: [0.8, 0.8, 0.82],
        glass: 2,
        lintel: 3,
        seed: 46.37,
    }; /* (street r11) lintel 3 = facade.js dark louvre band: dark grey plant louvres, not a sky-blue stripe (critic) */
    const LOBBY = {
        ...P,
        layer: LAYER.METAL,
        floorH: 4.6,
        bayW: 3.0,
        winW: 0.92,
        winH: 0.9,
        depth: 0.1,
        tint: [0.5, 0.52, 0.52],
        seed: 47,
    };
    const M = [
        [30, 20],
        [35, 17.2],
        [39.5, 14.4],
        [43.2, 11.6],
        [46, 9],
    ];
    const secs = [
        [PORT, 58, P, STYLE.PUNCHED],
        [58, 67, BAND, STYLE.CURTAIN],
        [67, 147, P, STYLE.PUNCHED],
        [147, 156, BAND, STYLE.CURTAIN],
        [156, TOP, P, STYLE.PUNCHED],
    ];
    const f = (style) => ({ style, gH: -0.01 });
    const FIN_D = 0.34;
    for (const [y0, y1, p, style] of secs) {
        const band = p === BAND,
            ins = band ? 0.6 : 0;
        M.forEach(([hx0, hz0], i) => {
            const hx = hx0 - ins,
                hz = hz0 - ins;
            const PP = { ...p, topY: y1, baseY: y0 };
            const faces = {
                px: f(style),
                nx: f(style),
                pz: f(style),
                nz: f(style),
            };
            for (const B of [t.fac, t.lod]) {
                B.box(
                    cx - hx,
                    y0,
                    cz - hz,
                    cx + hx,
                    y1,
                    cz + hz,
                    PP,
                    faces,
                    false,
                    false,
                );
                const roofP = {
                    ...PP,
                    layer: LAYER.ROOF_GRAVEL,
                    style: STYLE.BLANK,
                };
                const prevHx = i ? M[i - 1][0] : 0;
                if (y1 === TOP) {
                    if (!i)
                        B.horiz(cx - hx, cz - hz, cx + hx, cz + hz, y1, roofP);
                    else {
                        B.horiz(
                            cx - hx,
                            cz - hz,
                            cx - prevHx,
                            cz + hz,
                            y1,
                            roofP,
                        );
                        B.horiz(
                            cx + prevHx,
                            cz - hz,
                            cx + hx,
                            cz + hz,
                            y1,
                            roofP,
                        );
                    }
                }
                if (y0 === PORT) {
                    if (!i)
                        B.horiz(
                            cx - hx,
                            cz - hz,
                            cx + hx,
                            cz + hz,
                            y0,
                            PP,
                            true,
                        );
                    else {
                        B.horiz(
                            cx - hx,
                            cz - hz,
                            cx - prevHx,
                            cz + hz,
                            y0,
                            PP,
                            true,
                        );
                        B.horiz(
                            cx + prevHx,
                            cz - hz,
                            cx + hx,
                            cz + hz,
                            y0,
                            PP,
                            true,
                        );
                    }
                }
            }
        });
    }
    for (const [y0, y1, p] of secs) {
        const e = p === BAND ? -0.6 : FIN_D;
        M.forEach(([hx, hz]) =>
            S.box(
                cx - hx - e,
                y0,
                cz - hz - e,
                cx + hx + e,
                y1,
                cz + hz + e,
                "wall",
            ),
        );
    }

    {
        const fm = new MB();
        fm.setColor(0xb8ae9b).setPart(1);
        const inside = (x, z) =>
            M.some(
                ([hx, hz]) =>
                    Math.abs(x - cx) < hx - 0.05 &&
                    Math.abs(z - cz) < hz - 0.05,
            );
        const spans = secs
            .filter((q) => q[2] !== BAND)
            .map((q) => [q[0], q[1]]);
        M.forEach(([hx, hz]) => {
            for (const [axis, W, fixed, sg] of [
                ["x", 2 * hx, cz + hz, 1],
                ["x", 2 * hx, cz - hz, -1],
                ["z", 2 * hz, cx + hx, 1],
                ["z", 2 * hz, cx - hx, -1],
            ]) {
                const nb = Math.max(1, Math.round((W - 0.2) / P.bayW)),
                    bw = (W - 0.2) / nb;
                for (let k = 0; k <= nb; k++) {
                    const u = 0.1 + k * bw,
                        c = (axis === "x" ? cx - hx : cz - hz) + u;
                    const [x, z] = axis === "x" ? [c, fixed] : [fixed, c];
                    const ox = axis === "z" ? sg * 0.3 : 0,
                        oz = axis === "x" ? sg * 0.3 : 0;
                    if (inside(x + ox, z + oz)) continue;
                    for (const [y0, y1a] of spans) {
                        const y1 = ZFIX && y1a > TOP - 0.01 ? TOP - 0.02 : y1a;
                        if (axis === "x")
                            fm.box(
                                x - 0.11,
                                y0,
                                Math.min(z, z + sg * FIN_D),
                                x + 0.11,
                                y1,
                                Math.max(z, z + sg * FIN_D),
                                0b110111,
                            );
                        else
                            fm.box(
                                Math.min(x, x + sg * FIN_D),
                                y0,
                                z - 0.11,
                                Math.max(x, x + sg * FIN_D),
                                y1,
                                z + 0.11,
                                0b110111,
                            );
                    }
                }
            }
        });

        fm.setColor(0x4c5052).setPart(5);
        for (let x = cx - 19.6; x <= cx + 19.6; x += 0.7)
            for (const z of [cz - 9, cz + 9])
                fm.box(
                    x - 0.06,
                    TOP,
                    z - (z < cz ? 0.15 : 0),
                    x + 0.06,
                    TOP + 9,
                    z + (z > cz ? 0.15 : 0),
                    0b110111,
                );
        fm.setColor(0xbdb6a6)
            .setPart(1)
            .box(cx - 20.6, TOP + 9, cz - 9.6, cx + 20.6, TOP + 9.8, cz + 9.6);
        S.box(
            cx - 20.6,
            TOP + 9,
            cz - 9.6,
            cx + 20.6,
            TOP + 9.8,
            cz + 9.6,
            "bulkhead",
        );
        const fmesh = new THREE.Mesh(
            fm.build({ part: true }),
            stoneMaterial(gen.__gcT),
        );
        fmesh.name = "metlifeFins";
        fmesh.castShadow = true;
        fmesh.receiveShadow = true;
        fmesh.layers.enable(BIG_CASTER_LAYER);
        gen.__gcScene.add(fmesh);
    }

    for (const [x0, x1] of [
        [cx - 42, cx - 16],
        [cx + 16, cx + 42],
    ]) {
        const PP = { ...LOBBY, topY: PORT, baseY: G.CURB_H };
        for (const B of [t.fac, t.lod])
            B.box(
                x0,
                G.CURB_H,
                cz - 12,
                x1,
                PORT,
                cz + 12,
                PP,
                {
                    px: f(STYLE.CURTAIN),
                    nx: f(STYLE.CURTAIN),
                    pz: f(STYLE.CURTAIN),
                    nz: f(STYLE.CURTAIN),
                },
                false,
                false,
            );
        S.box(x0, G.CURB_H, cz - 12, x1, PORT, cz + 12, "wall");
    }
    const PIER = { ...P, topY: PORT, baseY: 0 };
    for (const [hx, hz] of [[29.2, 19.2]])
        for (const sx of [-1, 1])
            for (let k = 0; k < 4; k++) {
                const x = cx + sx * (18 + (k * (hx - 18)) / 3);
                for (const z of [cz - hz, cz + hz]) {
                    t.fac.box(
                        x - 0.7,
                        G.CURB_H,
                        z - 0.7,
                        x + 0.7,
                        PORT,
                        z + 0.7,
                        PIER,
                        {},
                        false,
                        false,
                    );
                    S.box(
                        x - 0.7,
                        G.CURB_H,
                        z - 0.7,
                        x + 0.7,
                        PORT,
                        z + 0.7,
                        "wall",
                    );
                }
            }

    {
        const PH = { ...BAND, topY: TOP + 9, baseY: TOP };
        const fc = {
            px: f(STYLE.CURTAIN),
            nx: f(STYLE.CURTAIN),
            pz: f(STYLE.CURTAIN),
            nz: f(STYLE.CURTAIN),
        };
        for (const B of [t.fac, t.lod])
            B.box(
                cx - 20,
                TOP,
                cz - 9,
                cx + 20,
                TOP + 9,
                cz + 9,
                PH,
                fc,
                true,
                false,
                { ...PH, layer: LAYER.ROOF_MEMBRANE, style: STYLE.BLANK },
            );
        S.box(cx - 20, TOP, cz - 9, cx + 20, TOP + 9, cz + 9, "bulkhead");
        Z.edge(cx - 30, cz - 20 + 0.12, cx + 30, cz - 20 + 0.12, TOP, 0, -1);
        Z.edge(cx - 30, cz + 20 - 0.12, cx + 30, cz + 20 - 0.12, TOP, 0, 1);
        Z.edge(cx - 46 + 0.12, cz - 9, cx - 46 + 0.12, cz + 9, TOP, -1, 0);
        Z.edge(cx + 46 - 0.12, cz - 9, cx + 46 - 0.12, cz + 9, TOP, 1, 0);
    }
    for (const [hx, hz] of M)
        gen.footprints.push({
            x0: cx - hx,
            z0: cz - hz,
            x1: cx + hx,
            z1: cz + hz,
            h: TOP,
            kind: "postwar",
        });
    gen.boxes.push({
        min: [cx - 46, 0, cz - 20],
        max: [cx + 46, TOP + 9, cz + 20],
    });
}
