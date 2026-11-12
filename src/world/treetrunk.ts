// @ts-nocheck
/**
 * Generates procedural tree trunk meshes and bark materials.
 *
 * @module world-treetrunk
 * @version 1.0.0
 * @file src/world/treetrunk.ts
 * @since 0.0.1
 * @description Builds trunk skeletons, level-of-detail meshes, and bark material helpers used by tree rendering.
 */
import * as THREE from "three";
import { mulberry32 } from "./layout.ts";

export const BARK = { PLANE: 0, OAK: 1, DARK: 2 };
const TILE = 0.85;

export const TRUNK_LOD = {
    near: {
        sides: [12, 6, 4, 3],
        step: [0.5, 1.05, 1.5, 9],
        levels: 4,
        ridges: true,
        flare: [0, 0.12, 0.3, 0.55, 0.9, 1.3],
    },
    mid: {
        sides: [6, 3, 3, 3],
        step: [1.2, 2.2, 9, 9],
        levels: 3,
        ridges: false,
        flare: [0, 0.25, 0.7],
    },
    far: {
        sides: [4, 3, 3, 3],
        step: [3.2, 9, 9, 9],
        levels: 1,
        ridges: false,
        flare: [0],
    },
};

export function trunkSkeleton({
    h,
    r,
    branches,
    spread,
    lobes = [],
    seed = 3,
    kind = "",
}) {
    const rnd = mulberry32(seed * 7919 + 17);
    const B = [];

    const la = rnd() * Math.PI * 2,
        lean = h * (0.03 + rnd() * 0.05),
        bend = r * (0.5 + rnd() * 0.7),
        bph = rnd() * 6.28;
    const ld = [Math.cos(la), Math.sin(la)],
        pd = [-ld[1], ld[0]];
    const tr = [];
    for (let i = 0; i <= 4; i++) {
        const t = i / 4,
            y = -0.3 + (h + 0.3) * t;
        const o = lean * Math.pow(t, 1.4),
            b = bend * Math.sin(Math.PI * t * 1.2 + bph) * t;
        tr.push(
            new THREE.Vector3(ld[0] * o + pd[0] * b, y, ld[1] * o + pd[1] * b),
        );
    }
    const top = tr[4];

    const L0 = lobes[0] ?? { x: 0, y: h * 1.6, z: 0, r: h * 0.5 };
    const lend = new THREE.Vector3(
        L0.x,
        L0.y - L0.r * (L0.sy ?? 0.8) * 0.15,
        L0.z,
    );
    const conifer = kind === "conifer";
    if (conifer) {
        const tl = lobes[lobes.length - 1];
        lend.set(tl.x, tl.y, tl.z);
    }
    tr.push(
        new THREE.Vector3(
            (top.x * 2 + lend.x) / 3,
            top.y + (lend.y - top.y) * 0.4,
            (top.z * 2 + lend.z) / 3,
        ),
        lend,
    );
    B.push({
        pts: tr,
        r0: r,
        r1: r * (conifer ? 0.12 : 0.26),
        level: 0,
        flare: true,
        h,
    });
    const trunkAt = (y) => {
        for (let i = 1; i < tr.length; i++)
            if (tr[i].y >= y || i === tr.length - 1) {
                const a = tr[i - 1],
                    b = tr[i],
                    t = Math.max(
                        0,
                        Math.min(1, (y - a.y) / Math.max(1e-3, b.y - a.y)),
                    );
                return [a.clone().lerp(b, t), b.clone().sub(a).normalize()];
            }
    };
    const trunkR = (y) =>
        r *
        (1 - 0.22 * Math.min(1, y / h)) *
        (y > h
            ? Math.max(0.4, 1 - ((y - h) / Math.max(1, lend.y - h)) * 0.6)
            : 1);

    const limb = (S, T, targets, r0, r1, level, out) => {
        const d = targets[0].clone().sub(S);
        const L = d.length();
        const o = out ?? new THREE.Vector3(d.x, 0, d.z).normalize();
        const p1 = S.clone()
            .addScaledVector(T, Math.min(L * 0.28, r0 * 5 + 0.4))
            .addScaledVector(o, r0 * 1.6);
        B.push({ pts: [S.clone(), p1, ...targets], r0, r1, level });
        return B.length - 1;
    };
    const shell = (L, u, el) =>
        new THREE.Vector3(
            L.x + Math.cos(u) * L.r * 0.86,
            L.y + el * L.r * 0.5 * (L.sy ?? 0.8),
            L.z + Math.sin(u) * L.r * 0.86,
        );
    const lobesOut = conifer ? [] : lobes.slice(1);

    for (const L of lobesOut) {
        const y0 = h * (0.62 + rnd() * 0.3);
        const [S, T] = trunkAt(y0);
        const m = new THREE.Vector3(L.x * 0.62, L.y - L.r * 0.3, L.z * 0.62);
        const u = Math.atan2(L.z, L.x) + (rnd() - 0.5) * 0.8;
        const e = shell(L, u, 0.1 + rnd() * 0.3);
        const li = limb(S, T, [m, e], trunkR(y0) * 0.64, r * 0.1, 1);
        subBranches(li, L, lobes.length > 5 ? 2 : 3);
    }

    if (!conifer) subBranches(0, L0, 3, 0.62);

    const nx = conifer ? branches + 5 : Math.round(branches * 0.5);
    for (let i = 0; i < nx; i++) {
        const a = (i / Math.max(1, nx)) * Math.PI * 2 + rnd() * 0.9;
        const y0 = conifer
            ? h * 0.7 + ((lend.y - h * 0.7) * (i + rnd() * 0.6)) / nx
            : h * (0.72 + rnd() * 0.26);
        const [S, T] = trunkAt(y0);
        const Ls = conifer
            ? spread * 1.7 * (1 - (0.7 * (y0 - h * 0.7)) / (lend.y - h * 0.7))
            : spread * (0.6 + rnd() * 0.5);
        const e = new THREE.Vector3(
            S.x + Math.cos(a) * Ls,
            y0 + Ls * (conifer ? -0.1 : 0.7 + rnd() * 0.5),
            S.z + Math.sin(a) * Ls,
        );
        const m = S.clone().lerp(e, 0.5);
        m.y += Ls * (conifer ? 0.12 : 0.05);
        const li = limb(
            S,
            T,
            [m, e],
            trunkR(y0) * (conifer ? 0.3 : 0.45),
            r * 0.06,
            1,
            new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
        );
        if (!conifer) {
            const a2 = a + (rnd() - 0.5) * 1.4;
            twigFrom(
                li,
                0.7,
                new THREE.Vector3(
                    e.x + Math.cos(a2) * Ls * 0.3,
                    e.y + Ls * 0.35,
                    e.z + Math.sin(a2) * Ls * 0.3,
                ),
                r * 0.2,
                2,
            );
        }
    }
    function subBranches(pi, L, n, tMin = 0.45) {
        for (let k = 0; k < n; k++) {
            const u = rnd() * Math.PI * 2,
                el = 0.15 + rnd() * 0.6;
            const e = shell(L, u, el);
            const bi = twigFrom(pi, tMin + rnd() * (0.9 - tMin), e, null, 2);
            const u2 = u + 0.8 * (rnd() < 0.5 ? 1 : -1);
            twigFrom(
                bi,
                0.55 + rnd() * 0.3,
                new THREE.Vector3(
                    e.x + Math.cos(u2) * L.r * 0.25,
                    e.y + L.r * 0.2,
                    e.z + Math.sin(u2) * L.r * 0.25,
                ),
                null,
                3,
            );
        }
    }

    function twigFrom(pi, t, e, r0, level) {
        const P = B[pi],
            ps = P.pts,
            f = t * (ps.length - 1),
            i = Math.min(ps.length - 2, Math.floor(f)),
            w = f - i;
        const S = ps[i].clone().lerp(ps[i + 1], w),
            T = ps[i + 1].clone().sub(ps[i]).normalize();
        const pr = P.r0 + (P.r1 - P.r0) * t;
        const m = S.clone().lerp(e, 0.5);
        m.y += e.distanceTo(S) * 0.08;
        return limb(
            S,
            T,
            [m, e],
            r0 ?? pr * 0.62,
            level >= 3 ? 0.012 : 0.02,
            level,
        );
    }

    const cTop = Math.min(3.8, h);
    const [c0] = trunkAt(0.4),
        [c1] = trunkAt(cTop);
    return {
        branches: B,
        h,
        r,
        collider: {
            x: (c0.x + c1.x) / 2,
            z: (c0.z + c1.z) / 2,
            y1: cTop,
            r0: r * 1.22,
            r1: trunkR(cTop) + Math.hypot(c1.x - c0.x, c1.z - c0.z) / 2,
        },
    };
}

const _t = new THREE.Vector3(),
    _n = new THREE.Vector3(),
    _b = new THREE.Vector3(),
    _p = new THREE.Vector3(),
    _q = new THREE.Quaternion();
export function trunkMesh(skel, lod = TRUNK_LOD.near) {
    const P = [],
        N = [],
        UV = [],
        C = [],
        I = [];
    const { h, r } = skel;
    for (const br of skel.branches) {
        if (br.level >= lod.levels) continue;
        const sides = lod.sides[br.level],
            step = lod.step[br.level];
        const curve = new THREE.CatmullRomCurve3(
            br.pts,
            false,
            "centripetal",
            0.5,
        );
        const len = curve.getLength();

        const ts = [];
        if (br.flare) {
            const fl = lod.flare.filter((v) => v < len * 0.5);
            for (const v of fl) ts.push(v / len);
        }
        {
            const n = Math.max(2, Math.ceil(len / step)),
                ds = len / n;
            for (let s = 0; s <= len + 1e-6;) {
                const t = s / len;
                if (!ts.length || t > ts[ts.length - 1] + 0.3 / len)
                    ts.push(Math.min(1, t));
                s += br.level === 0 && br.pts[0].y + s > h * 1.05 ? ds * 2 : ds;
            }
            if (ts[ts.length - 1] < 1 - 0.2 / len) ts.push(1);
            else ts[ts.length - 1] = 1;
        }
        const uRep = Math.max(1, Math.round((2 * Math.PI * br.r0) / TILE));
        const v0 = P.length / 3;

        curve.getTangentAt(0, _t);
        _n.set(1, 0, 0);
        if (Math.abs(_t.x) > 0.9) _n.set(0, 0, 1);
        _b.crossVectors(_t, _n).normalize();
        _n.crossVectors(_b, _t).normalize();
        const prevT = _t.clone();
        let vAcc = 0,
            prevP = null;
        const rng = mulberry32(br.level * 131 + Math.round(br.r0 * 1e4));
        const ph = rng() * 6.28,
            ph2 = rng() * 6.28;
        const flN = 4 + Math.floor(rng() * 2);
        for (let ri = 0; ri < ts.length; ri++) {
            const t = ts[ri];
            const c = curve.getPointAt(t);
            curve.getTangentAt(t, _t);
            _q.setFromUnitVectors(prevT, _t);
            _n.applyQuaternion(_q);
            _b.applyQuaternion(_q);
            prevT.copy(_t);
            if (prevP) vAcc += c.distanceTo(prevP);
            prevP = c;

            let rad;
            if (br.level === 0) {
                const y = Math.max(0, c.y);
                rad =
                    y <= h
                        ? r * (1 - (0.22 * y) / h)
                        : r * 0.78 +
                          (br.r1 - r * 0.78) *
                              Math.min(
                                  1,
                                  (y - h) /
                                      Math.max(
                                          1,
                                          br.pts[br.pts.length - 1].y - h,
                                      ),
                              );
            } else rad = br.r0 + (br.r1 - br.r0) * Math.pow(t, 0.75);

            if (br.level > 0)
                rad *= 1 + 0.18 * Math.exp((-t * len) / (br.r0 * 4 + 0.05));
            const ao =
                br.level === 0
                    ? 0.62 + 0.38 * Math.min(1, Math.max(0, c.y + 0.1) / 1.2)
                    : 0.78 + 0.22 * Math.min(1, (t * len) / (br.r0 * 6 + 0.1));
            for (let k = 0; k <= sides; k++) {
                const a = (k / sides) * Math.PI * 2,
                    ca = Math.cos(a),
                    sa = Math.sin(a);
                let rr = rad;
                if (br.flare) {
                    const y = Math.max(0, c.y),
                        fall = Math.exp(-y / 0.38);
                    rr *=
                        1 +
                        fall *
                            (0.42 +
                                0.5 *
                                    Math.pow(
                                        Math.max(0, Math.cos(a * flN + ph)),
                                        3,
                                    ));
                }
                if (lod.ridges && br.level <= 1) {
                    const w =
                        0.5 +
                        0.5 *
                            Math.sin(
                                a * Math.max(5, Math.round(rad * 38)) +
                                    1.7 * Math.sin(c.y * 1.9 + a * 2 + ph2) +
                                    ph,
                            );
                    rr *=
                        1 + 0.07 * (w * w - 0.35) * (br.level === 0 ? 1 : 0.6);
                }
                _p.copy(c)
                    .addScaledVector(_n, ca * rr)
                    .addScaledVector(_b, sa * rr);
                P.push(_p.x, _p.y, _p.z);
                N.push(0, 0, 0);
                UV.push((k / sides) * uRep, vAcc / TILE);
                C.push(ao, ao, ao);
            }
            if (ri > 0) {
                const a0 = v0 + (ri - 1) * (sides + 1),
                    a1 = v0 + ri * (sides + 1);
                for (let k = 0; k < sides; k++)
                    I.push(
                        a0 + k,
                        a1 + k,
                        a0 + k + 1,
                        a0 + k + 1,
                        a1 + k,
                        a1 + k + 1,
                    );
            }
        }

        {
            const last = v0 + (ts.length - 1) * (sides + 1),
                c = curve.getPointAt(1);
            for (let k = 0; k <= sides; k++) {
                P[(last + k) * 3] = c.x;
                P[(last + k) * 3 + 1] = c.y;
                P[(last + k) * 3 + 2] = c.z;
            }
        }
        br._v0 = v0;
        br._sides = sides;
        br._rings = ts.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    g.setIndex(
        P.length / 3 > 65535
            ? new THREE.Uint32BufferAttribute(I, 1)
            : new THREE.Uint16BufferAttribute(I, 1),
    );
    g.computeVertexNormals();

    const nr = g.attributes.normal;
    for (const br of skel.branches) {
        if (br._v0 === undefined || br.level >= lod.levels) continue;
        for (let ri = 0; ri < br._rings; ri++) {
            const a = br._v0 + ri * (br._sides + 1),
                b = a + br._sides;
            _t.set(
                nr.getX(a) + nr.getX(b),
                nr.getY(a) + nr.getY(b),
                nr.getZ(a) + nr.getZ(b),
            ).normalize();
            nr.setXYZ(a, _t.x, _t.y, _t.z);
            nr.setXYZ(b, _t.x, _t.y, _t.z);
        }
        delete br._v0;
    }
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
}

let BARK_TEX = null;

function arrayTexFromStrip(url, srgb, fill) {
    const mk = (data, w, h, d) => {
        const t = new THREE.DataArrayTexture(data, w, h, d);
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.anisotropy = 4;
        t.needsUpdate = true;
        return t;
    };
    const u = { value: mk(new Uint8Array(4 * 4 * 4 * 3).fill(fill), 4, 4, 3) };
    if (typeof Image === "undefined") return u;
    const im = new Image();
    im.onload = () => {
        const size = im.width,
            layers = Math.round(im.height / im.width);
        const cv = document.createElement("canvas");
        cv.width = size;
        cv.height = im.height;
        const cx = cv.getContext("2d", { willReadFrequently: true });
        cx.drawImage(im, 0, 0);
        const d = cx.getImageData(0, 0, size, im.height).data,
            data = new Uint8Array(size * size * 4 * layers);
        for (let L = 0; L < layers; L++)
            for (let y = 0; y < size; y++) {
                const src = (L * size + (size - 1 - y)) * size * 4;
                data.set(
                    d.subarray(src, src + size * 4),
                    (L * size * size + y * size) * 4,
                );
            }
        const old = u.value;
        u.value = mk(data, size, size, layers);
        old.dispose();
    };
    im.src = url;
    return u;
}
export function barkTextures() {
    BARK_TEX ??= {
        col: arrayTexFromStrip(
            new URL("../assets/textures/city/bark_col.webp", import.meta.url)
                .href,
            true,
            110,
        ),
        nrm: arrayTexFromStrip(
            new URL("../assets/textures/city/bark_nrm.webp", import.meta.url)
                .href,
            false,
            128,
        ),
    };
    return BARK_TEX;
}

export function barkMaterial() {
    const T = barkTextures();
    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.93,
        metalness: 0,
    });
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.tBarkC = T.col;
        sh.uniforms.tBarkN = T.nrm;
        sh.vertexShader = sh.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
      attribute vec4 aBark; varying vec4 vBark; varying vec2 vBUv;`,
            )
            .replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
      vBark = aBark; vBUv = uv;`,
            );
        sh.fragmentShader = sh.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
      uniform highp sampler2DArray tBarkC; uniform highp sampler2DArray tBarkN; varying vec4 vBark; varying vec2 vBUv;`,
            )
            .replace(
                "#include <map_fragment>",
                `
        vec3 bkUv = vec3(vBUv, floor(vBark.x + 0.5));
        vec4 bkC = texture(tBarkC, bkUv);
        diffuseColor.rgb *= bkC.rgb * vBark.yzw;`,
            )
            .replace(
                "#include <normal_fragment_maps>",
                `#include <normal_fragment_maps>
        { // bark normal map in the derivative tangent frame (no tangent attribute)
          vec3 mapN = texture(tBarkN, bkUv).xyz * 2.0 - 1.0; mapN.xy *= 1.35;
          vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
          vec2 st0 = dFdx(vBUv), st1 = dFdy(vBUv);
          vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);
          vec3 Tt = q1p * st0.x + q0p * st1.x, Bt = q1p * st0.y + q0p * st1.y;
          float det = max(dot(Tt, Tt), dot(Bt, Bt));
          float sc = det == 0.0 ? 0.0 : inversesqrt(det);
          normal = normalize(Tt * (mapN.x * sc) + Bt * (mapN.y * sc) + normal * mapN.z);
        }`,
            );
    };
    mat.customProgramCacheKey = () => "bark-v1";
    return mat;
}
