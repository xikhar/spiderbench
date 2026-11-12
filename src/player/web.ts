// @ts-nocheck
/**
 * Web strand rendering and web shooting/attachment system with splats, forks, and venom styling.
 *
 * @module player-web
 * @version 1.0.0
 * @file src/player/web.ts
 * @since 0.0.1
 * @description Renders and updates web strands, handles web attachment/release, splats, and venom appearance.
 */

import * as THREE from "three";

export const ropeGrip = { off: new THREE.Vector3(), w: 0 };

const SEG = 64;
const FORKS = 4;
const FSEG = 6;

const vert = /* glsl */ `
  attribute vec3 nextPos; attribute float side; attribute float along; attribute float strandW; attribute float dist;
  uniform vec2 uRes; uniform float uWidth; uniform float uMinPx;
  varying float vSide; varying float vAlpha; varying float vAlong; varying float vDist; varying float vPx;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position,1.0);
    vec4 c0 = projectionMatrix * mv;
    vec4 c1 = projectionMatrix * modelViewMatrix * vec4(nextPos,1.0);
    vec2 s0 = c0.xy / c0.w * uRes * 0.5, s1 = c1.xy / c1.w * uRes * 0.5;
    vec2 d = s1 - s0; float L = length(d); d = L > 1e-4 ? d / L : vec2(1.0,0.0);
    vec2 n = vec2(-d.y, d.x);
    // world width -> pixels
    float px = uWidth * strandW * projectionMatrix[1][1] * uRes.y * 0.5 / max(0.05, -mv.z);
    float w = max(px, uMinPx);
    vAlpha = clamp(px / uMinPx, 0.35, 1.0);
    vec2 off = n * side * (w * 0.5 + 1.0);
    c0.xy += off / (uRes * 0.5) * c0.w;
    gl_Position = c0; vSide = side * (w * 0.5 + 1.0) / (w * 0.5); vAlong = along; vDist = dist; vPx = w;
  }`;

const frag = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; uniform float uVenom;
  varying float vSide; varying float vAlpha; varying float vAlong; varying float vDist; varying float vPx;
  float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
  float vn(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
  void main(){
    if (uVenom > 0.5) {
      float t = vDist;
      float bulge = vn(t * 1.7 + 3.1), knot = smoothstep(0.72, 1.0, vn(t * 3.9 + 1.7));
      float R = 0.5 + 0.36 * bulge + 0.2 * knot + 0.06 * vn(t * 11.0);
      float detail = smoothstep(3.0, 9.0, vPx);
      R = mix(0.95, R, detail);
      float pitchPx = vPx * 0.9 / max(fwidth(t) * 3.4 * vPx, 1e-4);
      float braid = detail * smoothstep(6.0, 14.0, pitchPx);
      float y = vSide / R;
      float aa = 1.6 / max(vPx * R * 0.5, 1.0);
      float cov = 0.0, wsum = 0.0; vec3 col = vec3(0.0);
      float mott = vn(t * 4.3 + 11.0);
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float ph = t * 13.0 + 9.0 * vn(t * 0.9 + 2.0) + fk * 2.0944 + 2.2 * vn(t * 2.6 + fk * 5.0);
        float c = (0.36 + 0.14 * vn(t * 5.0 + fk)) * sin(ph) * braid, dep = cos(ph);
        float rs = mix(1.0, 0.5 + 0.22 * vn(t * 6.0 + fk * 3.3), braid);
        float xl = (y - c) / rs;
        float ck = 1.0 - smoothstep(1.0 - aa / rs, 1.0 + aa / rs, abs(xl));
        if (ck < 0.001) continue;
        cov = max(cov, ck);
        float nz = sqrt(max(0.0, 1.0 - xl * xl)), fib = vn(t * 38.0 + xl * 1.5 + fk * 7.0);
        float occl = mix(1.0, 0.5 + 0.5 * (dep * 0.5 + 0.5), braid);
        vec3 cc = uColor * (0.5 + 0.5 * nz) * (0.8 + 0.3 * fib) * (0.85 + 0.3 * mott) * occl;
        float spec = pow(max(0.0, 1.0 - abs(xl + 0.4) * 1.7), 3.0) * (0.45 + 0.55 * fib) * (0.55 + 0.45 * mott) * (0.6 + 0.4 * occl);
        cc += vec3(0.26, 0.28, 0.32) * spec + vec3(0.035, 0.04, 0.05) * pow(1.0 - nz, 3.0);
        float w = ck * exp(dep * 7.0 * braid) * nz + 1e-4;
        col += cc * w; wsum += w;
      }
      if (cov * uOpacity < 0.004) discard;
      col /= max(wsum, 1e-4);
      gl_FragColor = vec4(col, cov * uOpacity * max(vAlpha, 0.8));
      #include <colorspace_fragment>
      return;
    }
    float edge = 1.0 - smoothstep(0.55, 1.0 + 0.35, abs(vSide));
    float core = 1.0 - smoothstep(0.0, 0.9, abs(vSide));
    vec3 col = mix(uColor * 0.82, uColor * 1.15, core);
    float a = edge * vAlpha * uOpacity * (0.75 + 0.25 * core);
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;

const _allStrands = new Set<Strands>(),
    _venomHooks = new Set<(v: boolean) => void>();
let _venom = false;
const WEB_LOOK = {
    white: { color: 0xeef2f6, width: 0.022, minPx: 2.0 },
    venom: { color: 0x0b0c0f, width: 0.06, minPx: 2.6 },
};
function styleStrands(S: Strands) {
    const L = _venom ? WEB_LOOK.venom : WEB_LOOK.white,
        u = S.mat.uniforms as any;
    u.uColor.value.set(L.color);
    u.uWidth.value = L.width * S.widthK;
    u.uMinPx.value = L.minPx;
    u.uVenom.value = _venom ? 1 : 0;
}
export function setWebVenom(on: boolean) {
    _venom = !!on;
    for (const S of _allStrands) styleStrands(S);
    for (const f of _venomHooks) f(_venom);
}
export const webVenom = () => _venom;

export class Strands {
    counts: number[];
    widthK: number;
    offsets: number[];
    geo: THREE.BufferGeometry;
    mat: THREE.ShaderMaterial;
    mesh: THREE.Mesh;

    constructor(counts: number[], { widthK = 1 }: { widthK?: number } = {}) {
        this.counts = counts;
        this.widthK = widthK;
        const nPts = counts.reduce((s, c) => s + c + 1, 0);
        const pos = new Float32Array(nPts * 2 * 3),
            nxt = new Float32Array(nPts * 2 * 3);
        const side = new Float32Array(nPts * 2),
            along = new Float32Array(nPts * 2),
            sw = new Float32Array(nPts * 2),
            dist = new Float32Array(nPts * 2);
        const idx: number[] = [];
        let base = 0;
        this.offsets = [];
        for (const c of counts) {
            this.offsets.push(base);
            for (let i = 0; i <= c; i++) {
                side[(base + i) * 2] = -1;
                side[(base + i) * 2 + 1] = 1;
                along[(base + i) * 2] = along[(base + i) * 2 + 1] = i / c;
                sw[(base + i) * 2] = sw[(base + i) * 2 + 1] = 1;
            }
            for (let i = 0; i < c; i++) {
                const a = (base + i) * 2;
                idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
            base += c + 1;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute(
            "position",
            new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage),
        );
        g.setAttribute(
            "nextPos",
            new THREE.BufferAttribute(nxt, 3).setUsage(THREE.DynamicDrawUsage),
        );
        g.setAttribute("side", new THREE.BufferAttribute(side, 1));
        g.setAttribute("along", new THREE.BufferAttribute(along, 1));
        g.setAttribute(
            "strandW",
            new THREE.BufferAttribute(sw, 1).setUsage(THREE.DynamicDrawUsage),
        );
        g.setAttribute(
            "dist",
            new THREE.BufferAttribute(dist, 1).setUsage(THREE.DynamicDrawUsage),
        );
        g.setIndex(idx);
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
        this.geo = g;
        this.mat = new THREE.ShaderMaterial({
            vertexShader: vert,
            fragmentShader: frag,
            transparent: true,
            depthWrite: true,
            side: THREE.DoubleSide,
            uniforms: {
                uRes: { value: new THREE.Vector2(1920, 1080) },
                uWidth: { value: 0.022 },
                uMinPx: { value: 2.0 },
                uColor: { value: new THREE.Color(0xeef2f6) },
                uOpacity: { value: 0.92 },
                uVenom: { value: 0 },
            },
        });
        _allStrands.add(this);
        styleStrands(this);
        this.mesh = new THREE.Mesh(g, this.mat);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 5;
        this.mesh.name = "WebStrands";
    }
    setStrand(si: number, pts: THREE.Vector3[], width = 1) {
        const c = this.counts[si],
            base = this.offsets[si];
        const P = this.geo.attributes.position.array as Float32Array,
            N = this.geo.attributes.nextPos.array as Float32Array,
            W = this.geo.attributes.strandW.array as Float32Array,
            D = this.geo.attributes.dist.array as Float32Array;

        let acc = 0;
        const last = Math.min(c, pts.length - 1);
        for (let i = c; i >= 0; i--) {
            if (i < last)
                acc += pts[Math.min(i, pts.length - 1)].distanceTo(
                    pts[Math.min(i + 1, pts.length - 1)],
                );
            D[(base + i) * 2] = D[(base + i) * 2 + 1] = acc + si * 1.37;
        }
        for (let i = 0; i <= c; i++) {
            const p = pts[Math.min(i, pts.length - 1)],
                q = i < c ? pts[Math.min(i + 1, pts.length - 1)] : null;
            let nx: number, ny: number, nz: number;
            if (q && q.distanceToSquared(p) > 1e-10) {
                nx = q.x;
                ny = q.y;
                nz = q.z;
            } else {
                const pp = pts[Math.max(0, Math.min(i, pts.length - 1) - 1)];
                nx = 2 * p.x - pp.x;
                ny = 2 * p.y - pp.y;
                nz = 2 * p.z - pp.z;
            }
            for (let s = 0; s < 2; s++) {
                const k = ((base + i) * 2 + s) * 3;
                P[k] = p.x;
                P[k + 1] = p.y;
                P[k + 2] = p.z;
                N[k] = nx;
                N[k + 1] = ny;
                N[k + 2] = nz;
                W[(base + i) * 2 + s] = width;
            }
        }
    }
    hideStrand(si: number) {
        const z = new THREE.Vector3(0, -1e4, 0);
        this.setStrand(si, [z, z]);
    }
    commit() {
        for (const a of ["position", "nextPos", "strandW", "dist"])
            (this.geo.attributes as any)[a].needsUpdate = true;
    }
}

function splatTexture() {
    const S = 256,
        c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    g.translate(S / 2, S / 2);
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineCap = "round";
    const spokes = 11,
        rnd = mulberry(7);
    const ang = [...Array(spokes)].map(
        (_, i) => (i / spokes) * Math.PI * 2 + (rnd() - 0.5) * 0.4,
    );
    const len = ang.map(() => 70 + rnd() * 55);
    g.lineWidth = 3.2;
    ang.forEach((a, i) => {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * len[i], Math.sin(a) * len[i]);
        g.stroke();
    });
    g.lineWidth = 1.8;
    for (const r of [16, 30, 46, 64]) {
        g.beginPath();
        ang.forEach((a, i) => {
            const rr = Math.min(r * (0.9 + rnd() * 0.2), len[i]);
            const x = Math.cos(a) * rr,
                y = Math.sin(a) * rr;
            if (i === 0) g.moveTo(x, y);
            else {
                const pa = ang[i - 1] + (a - ang[i - 1]) / 2;
                g.quadraticCurveTo(
                    Math.cos(pa) * rr * 0.8,
                    Math.sin(pa) * rr * 0.8,
                    x,
                    y,
                );
            }
        });
        g.stroke();
    }
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 22);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(0, 0, 22, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}
function mulberry(a: number) {
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface AttachOpts {
    instant?: boolean;
    shootDur?: number | null;
    noSplat?: boolean;
    noDecal?: boolean;
}

export interface WebSystem {
    readonly active: boolean;
    readonly active2: boolean;
    anchor2: THREE.Vector3;
    anchor: THREE.Vector3;
    shootK: number;
    attach: (
        hand: THREE.Vector3,
        anchor: THREE.Vector3,
        normal?: THREE.Vector3,
        opts?: AttachOpts,
    ) => void;
    attachSecond: (
        hand: THREE.Vector3,
        anchor: THREE.Vector3,
        normal?: THREE.Vector3,
        opts?: Omit<AttachOpts, "noSplat">,
    ) => void;
    setTaut: (k?: number) => void;
    release: () => void;
    retarget: (anchor: THREE.Vector3, normal?: THREE.Vector3) => void;
    setSlack: (k?: number, tension?: number) => void;
    isImpacted: () => boolean;
    splat: (anchor: THREE.Vector3, normal: THREE.Vector3) => void;
    setSeed: (s: number) => void;
    releaseSnap: (life?: number) => void;
    update: (
        dt: number,
        hand: THREE.Vector3,
        camera: THREE.Camera,
        renderer: THREE.WebGLRenderer,
        hand2?: THREE.Vector3 | null,
    ) => void;
}

export function createWebSystem(scene: THREE.Scene): WebSystem {
    const DYING = 3,
        SLOT2 = 1 + FORKS,
        DBASE = 2 * (1 + FORKS);
    const counts = [
        SEG,
        ...Array(FORKS).fill(FSEG),
        SEG,
        ...Array(FORKS).fill(FSEG),
    ] as number[];
    for (let d = 0; d < DYING; d++)
        counts.push(SEG, ...Array(FORKS).fill(FSEG));
    const strands = new Strands(counts);
    scene.add(strands.mesh);
    const tex = splatTexture();
    const splatMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        color: 0xf4f6f8,
    });
    const splats = [...Array(8)].map(() => {
        const m = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            splatMat.clone(),
        );
        m.visible = false;
        m.renderOrder = 4;
        scene.add(m);
        return { m, t: 0, life: 0 };
    });
    let splatI = 0;

    const tintWeb = (v: boolean) => {
        for (const s of splats)
            (s.m.material as THREE.MeshBasicMaterial).color.set(
                v ? 0x121316 : 0xf4f6f8,
            );
        (pts.material as THREE.PointsMaterial).color.set(
            v ? 0x18191c : 0xffffff,
        );
    };

    const PN = 48;
    const pg = new THREE.BufferGeometry();
    const pp = new Float32Array(PN * 3);
    const pv = [...Array(PN)].map(() => new THREE.Vector3());
    const pl = new Float32Array(PN);
    pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
    pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const pts = new THREE.Points(
        pg,
        new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.07,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
        }),
    );
    pts.frustumCulled = false;
    scene.add(pts);
    let pI = 0;
    _venomHooks.add(tintWeb);
    tintWeb(_venom);

    const mkActive = () => ({
        on: false,
        t: 0,
        hand: new THREE.Vector3(),
        anchor: new THREE.Vector3(),
        normal: new THREE.Vector3(0, 0, 1),
        shootDur: 0.12,
        tension: 0,
        seed: 0,
        slack: 0,
        slackIn: 0,
        snapT: 9,
        taut: 0,
        impacted: false,
        noSplat: false,
        noDecal: false,
        pts: [...Array(SEG + 1)].map(() => new THREE.Vector3()),
    });
    type Active = ReturnType<typeof mkActive>;
    const active = mkActive(),
        active2 = mkActive();
    const dying = [...Array(DYING)].map(() => ({
        on: false,
        t: 0,
        pts: [] as THREE.Vector3[],
        vel: [] as THREE.Vector3[],
        anchor: new THREE.Vector3(),
        normal: new THREE.Vector3(),
        seed: 0,
        noSplat: false,
        life: 0.7,
    }));
    let dI = 0;
    const _time = 0;
    const ftmp = [...Array(FSEG + 1)].map(() => new THREE.Vector3());
    const _a = new THREE.Vector3(),
        _b = new THREE.Vector3(),
        _c = new THREE.Vector3(),
        _d = new THREE.Vector3(),
        _e = new THREE.Vector3(),
        _g = new THREE.Vector3();

    function forkPoints(
        si0: number,
        from: THREE.Vector3,
        anchor: THREE.Vector3,
        normal: THREE.Vector3,
        seed: number,
        spread: number,
        fade = 1,
    ) {
        _a.set(0, 1, 0);
        if (Math.abs(normal.y) > 0.9) _a.set(1, 0, 0);
        const t1 = _b.crossVectors(normal, _a).normalize(),
            t2 = _c.crossVectors(normal, t1).normalize();
        for (let f = 0; f < FORKS; f++) {
            const ang =
                seed * 6.28 +
                f * ((Math.PI * 2) / FORKS) +
                Math.sin(seed * 13 + f) * 0.5;
            const r =
                spread * (0.55 + 0.45 * Math.abs(Math.sin(seed * 7 + f * 2.3)));
            const end = _d
                .copy(anchor)
                .addScaledVector(t1, Math.cos(ang) * r)
                .addScaledVector(t2, Math.sin(ang) * r)
                .addScaledVector(normal, 0.02);
            for (let i = 0; i <= FSEG; i++) {
                const s = i / FSEG;
                ftmp[i].copy(from).lerp(end, s);
                ftmp[i].addScaledVector(
                    normal,
                    Math.sin(s * Math.PI) * 0.05 * spread,
                );
            }
            strands.setStrand(si0 + f, ftmp, 0.55 * fade);
        }
    }

    function thwip(
        anchor: THREE.Vector3,
        normal: THREE.Vector3,
        noDecal = false,
    ) {
        const s = noDecal ? null : splats[splatI++ % splats.length];
        if (s) {
            s.m.visible = true;
            s.t = 0;
            s.life = 2.2;
            s.m.position.copy(anchor).addScaledVector(normal, 0.03);
            s.m.lookAt(_a.copy(anchor).add(normal));
            s.m.rotateZ(Math.random() * 6.28);
            s.m.scale.setScalar(0.01);
        }
        for (let i = 0; i < 16; i++) {
            const k = pI++ % PN;
            pp[k * 3] = anchor.x;
            pp[k * 3 + 1] = anchor.y;
            pp[k * 3 + 2] = anchor.z;
            pl[k] = 0.45;
            pv[k]
                .set(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                )
                .multiplyScalar(5)
                .addScaledVector(normal, 3);
        }
    }

    function fire(
        A: Active,
        hand: THREE.Vector3,
        anchor: THREE.Vector3,
        normal?: THREE.Vector3,
        instant?: boolean,
        shootDur?: number | null,
        noSplat = false,
        noDecal = false,
    ) {
        A.noSplat = noSplat;
        A.noDecal = noDecal;
        A.on = true;
        A.t = instant ? 1 : 0;
        A.hand.copy(hand);
        A.anchor.copy(anchor);
        A.normal.copy(normal || _a.set(0, 0, 1)).normalize();
        A.seed = Math.random();
        A.impacted = !!instant;
        A.slack = A.slackIn = 0;
        A.snapT = 9;
        A.taut = 0;
        A.shootDur =
            shootDur ??
            THREE.MathUtils.clamp(hand.distanceTo(anchor) / 380, 0.05, 0.16);
        for (const p of A.pts) p.copy(hand);
        if (instant && !noSplat) thwip(anchor, A.normal, noDecal);
    }
    function drop(A: Active) {
        if (!A.on) return;
        A.on = false;
        const d = dying[dI++ % DYING];
        d.on = true;
        d.t = 0;
        d.anchor.copy(A.anchor);
        d.normal.copy(A.normal);
        d.seed = A.seed;
        d.noSplat = !!A.noSplat;
        d.pts = A.pts.map((p) => p.clone());
        d.vel = d.pts.map(() => new THREE.Vector3(0, 0, 0));
        d.life = 0.7;
    }
    function drawActive(
        A: Active,
        base: number,
        hand: THREE.Vector3,
        dt: number,
    ) {
        if (!A.on) {
            strands.hideStrand(base);
            for (let f = 0; f < FORKS; f++) strands.hideStrand(base + 1 + f);
            return;
        }
        A.t += dt;
        A.hand.copy(hand);
        let h = hand;
        if (base === 0 && ropeGrip.w > 0.001)
            h = _g
                .copy(hand)
                .addScaledVector(ropeGrip.off, Math.min(1, ropeGrip.w));
        const k = Math.min(1, A.t / A.shootDur);
        const ext = 1 - Math.pow(1 - k, 3);
        if (k >= 1 && !A.impacted) {
            A.impacted = true;
            if (!A.noSplat) thwip(A.anchor, A.normal, A.noDecal);
        }
        const since = Math.max(0, A.t - A.shootDur);
        A.slack +=
            (A.slackIn - A.slack) *
            (1 - Math.exp(-(A.slackIn > A.slack ? 7 : 22) * dt));
        A.snapT += dt;
        const whip = A.snapT < 0.6 ? Math.exp(-A.snapT * 7) * 0.45 : 0;
        const wave =
            ((1 - ext) * 0.35 +
                Math.exp(-since * 9) * 0.25 +
                0.012 +
                A.slack * 0.18 +
                whip) *
            (1 - 0.9 * A.taut);
        const L = h.distanceTo(A.anchor);
        const dir = _b.copy(A.anchor).sub(h).normalize();
        const perp1 = _c.set(0, 1, 0).cross(dir);
        if (perp1.lengthSq() < 1e-4) perp1.set(1, 0, 0);
        perp1.normalize();
        const perp2 = _d.crossVectors(dir, perp1).normalize();
        const sagD = _e.set(0, -1, 0).addScaledVector(dir, dir.y);
        if (sagD.lengthSq() < 0.04) sagD.copy(perp2);
        sagD.normalize();
        const sag = A.slack * Math.min(L * 0.16, 3.2) * (A.impacted ? 1 : 0);
        const tmp = A.pts;
        for (let i = 0; i <= SEG; i++) {
            const s = (i / SEG) * ext;
            const p = tmp[i].copy(h).addScaledVector(dir, L * s);
            const env = Math.sin(
                Math.min(1, s / Math.max(ext, 1e-3)) * Math.PI,
            );
            const ph = s * L * 0.9 - A.t * 22 + A.seed * 40;
            const wph = s * L * 0.55 - A.snapT * 38;
            p.addScaledVector(
                perp1,
                Math.sin(ph) * wave * env + Math.sin(wph) * whip * env,
            ).addScaledVector(
                perp2,
                Math.cos(ph * 0.7 + 1.3) * wave * 0.6 * env,
            );
            if (sag > 0)
                p.addScaledVector(
                    sagD,
                    sag * env * (1 + 0.08 * Math.sin(A.t * 3.1 + s * 5)),
                );
        }
        strands.setStrand(base, tmp, 1 - 0.3 * A.taut);
        if (A.impacted && !A.noSplat) {
            const sp = Math.min(1, since / 0.08);
            forkPoints(
                base + 1,
                tmp[Math.floor(SEG * 0.975)],
                A.anchor,
                A.normal,
                A.seed,
                0.9 * sp + 0.05,
            );
        } else for (let f = 0; f < FORKS; f++) strands.hideStrand(base + 1 + f);
    }

    return {
        get active() {
            return active.on;
        },
        get active2() {
            return active2.on;
        },
        anchor2: active2.anchor,
        anchor: active.anchor,
        get shootK() {
            return active.on ? Math.min(1, active.t / active.shootDur) : 0;
        },
        attach(hand, anchor, normal, opts: AttachOpts = {}) {
            const {
                instant = false,
                shootDur = null,
                noSplat = false,
                noDecal = false,
            } = opts;
            if (active.on || active2.on) this.release();
            fire(
                active,
                hand,
                anchor,
                normal,
                instant,
                shootDur,
                noSplat,
                noDecal,
            );
        },
        attachSecond(
            hand,
            anchor,
            normal,
            opts: Omit<AttachOpts, "noSplat"> = {},
        ) {
            const { instant = false, shootDur = null, noDecal = false } = opts;
            if (active2.on) drop(active2);
            fire(
                active2,
                hand,
                anchor,
                normal,
                instant,
                shootDur,
                false,
                noDecal,
            );
        },
        setTaut(k = 0) {
            active.taut = active2.taut = THREE.MathUtils.clamp(k, 0, 1);
        },
        release() {
            drop(active);
            drop(active2);
        },
        retarget(anchor, normal) {
            if (!active.on) return;
            active.anchor.copy(anchor);
            if (normal) active.normal.copy(normal).normalize();
        },
        setSlack(k = 0, tension = 0) {
            if (active.slack > 0.35 && k < 0.1 && tension > 0.3)
                active.snapT = 0;
            active.slackIn = THREE.MathUtils.clamp(k, 0, 1);
        },
        isImpacted() {
            return active.on && active.impacted;
        },
        splat(anchor, normal) {
            thwip(anchor, normal);
        },
        setSeed(s) {
            active.seed = s;
        },
        releaseSnap(life = 0.35) {
            const n0 = dI;
            this.release();
            for (let i = n0; i < dI; i++) {
                const d = dying[i % DYING];
                d.life = life;
                d.pts.forEach((p, j) => {
                    const free = 1 - j / SEG;
                    d.vel[j]
                        .copy(d.anchor)
                        .sub(p)
                        .multiplyScalar(2.2 * free);
                });
            }
        },
        update(dt, hand, _camera, renderer, hand2 = null) {
            time += dt;
            const res = renderer.getDrawingBufferSize(_a);
            (strands.mat.uniforms as any).uRes.value.set(res.x, res.y);
            drawActive(active, 0, hand, dt);
            drawActive(active2, SLOT2, hand2 || hand, dt);
            dying.forEach((d, di) => {
                const base = DBASE + di * (1 + FORKS);
                if (!d.on) {
                    strands.hideStrand(base);
                    for (let f = 0; f < FORKS; f++)
                        strands.hideStrand(base + 1 + f);
                    return;
                }
                d.t += dt;
                const fade = Math.max(0, 1 - d.t / (d.life || 0.7));
                if (fade <= 0) {
                    d.on = false;
                    return;
                }
                for (let i = 0; i <= SEG; i++) {
                    const s = i / SEG,
                        free = 1 - s;
                    d.vel[i].y -= 18 * dt * free;
                    d.pts[i].addScaledVector(d.vel[i], dt);
                }
                strands.setStrand(base, d.pts, fade);
                if (d.noSplat)
                    for (let f = 0; f < FORKS; f++)
                        strands.hideStrand(base + 1 + f);
                else
                    forkPoints(
                        base + 1,
                        d.pts[Math.floor(SEG * 0.975)],
                        d.anchor,
                        d.normal,
                        d.seed,
                        0.95,
                        fade,
                    );
            });
            (strands.mat.uniforms as any).uOpacity.value = 0.92;
            strands.commit();
            for (const s of splats) {
                if (!s.m.visible) continue;
                s.t += dt;
                const g = Math.min(1, s.t / 0.09);
                s.m.scale.setScalar(0.2 + 1.1 * (1 - Math.pow(1 - g, 3)));
                (s.m.material as THREE.MeshBasicMaterial).opacity = Math.min(
                    1,
                    (s.life - s.t) / 0.6,
                );
                if (s.t > s.life) s.m.visible = false;
            }
            for (let k = 0; k < PN; k++) {
                if (pl[k] <= 0) {
                    pp[k * 3 + 1] = -1e4;
                    continue;
                }
                pl[k] -= dt;
                pv[k].y -= 6 * dt;
                pv[k].multiplyScalar(1 - 3 * dt);
                pp[k * 3] += pv[k].x * dt;
                pp[k * 3 + 1] += pv[k].y * dt;
                pp[k * 3 + 2] += pv[k].z * dt;
            }
            pg.attributes.position.needsUpdate = true;
        },
    };
}
