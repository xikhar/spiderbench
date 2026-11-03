// @ts-nocheck
import fxParticleVertexShader from "./shaders/vertex/particle.vert?raw";
import fxAdditiveParticleFragmentShader from "./shaders/fragment/particle-additive.frag?raw";
import fxAlphaParticleFragmentShader from "./shaders/fragment/particle-alpha.frag?raw";
// Combat VFX: GPU-instanced billboard particles (hit sparks, flashes, shock rings, dust),
// camera-facing web ribbons, spider-sense "tingle" around the head, web splats (wall / ground decals), web cocoons
// wrapped around enemy bones, bullet tracers / muzzle flashes, and the gunmen's pistol mesh.
// All textures are generated on canvases at start-up (no external files). Colours are linear HDR (pipeline blooms > 1).
import * as THREE from "three";
import { clamp, randomBetween, WORLD_UP } from "./combatMath.ts";

const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _v3 = new THREE.Vector3(),
  _q = new THREE.Quaternion(),
  _m = new THREE.Matrix4();

function canvasTex(size, draw, { srgb = false, mips = true } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = mips;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ particle atlas (2x2): glow, star, ring, smoke
function atlasTex() {
  return canvasTex(256, (g, S) => {
    const h = S / 2;
    g.clearRect(0, 0, S, S);
    // 0: soft glow
    let gr = g.createRadialGradient(h / 2, h / 2, 0, h / 2, h / 2, h / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.25, "rgba(255,255,255,0.65)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, h, h);
    // 1: 4-point star flare
    g.save();
    g.translate(h + h / 2, h / 2);
    for (const [sx, sy] of [
      [1, 0.06],
      [0.06, 1],
      [0.55, 0.035],
      [0.035, 0.55],
    ]) {
      g.save();
      if (sx === 0.55 || sx === 0.035) g.rotate(Math.PI / 4);
      const r = h / 2;
      gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.3, "rgba(255,255,255,0.5)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.scale(sx, sy);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    gr = g.createRadialGradient(0, 0, 0, 0, 0, h * 0.18);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, h * 0.18, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // 2: ring
    g.save();
    g.translate(h / 2, h + h / 2);
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = `rgba(255,255,255,${[0.25, 1, 0.25][i]})`;
      g.lineWidth = [10, 4, 10][i];
      g.beginPath();
      g.arc(0, 0, h * 0.4, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    // 3: smoke puff (clustered soft blobs)
    g.save();
    g.translate(h + h / 2, h + h / 2);
    let seed = 7;
    const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2,
        d = R() * h * 0.22,
        r = h * (0.1 + R() * 0.16);
      gr = g.createRadialGradient(
        Math.cos(a) * d,
        Math.sin(a) * d,
        0,
        Math.cos(a) * d,
        Math.sin(a) * d,
        r,
      );
      gr.addColorStop(0, "rgba(255,255,255,0.35)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(-h / 2, -h / 2, h, h);
    }
    g.restore();
  });
}

const PVERT = fxParticleVertexShader;
const PFRAG_ADD = fxAdditiveParticleFragmentShader;
const PFRAG_ALPHA = fxAlphaParticleFragmentShader;

class Particles {
  constructor(scene, tex, additive, max = 700) {
    this.max = max;
    this.list = [];
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    g.attributes.uv = base.attributes.uv;
    const A = (n, k) => {
      const a = new THREE.InstancedBufferAttribute(
        new Float32Array(max * k),
        k,
      );
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(n, a);
      return a;
    };
    this.aPos = A("iPos", 3);
    this.aDir = A("iDir", 3);
    this.aSize = A("iSize", 2);
    this.aCol = A("iCol", 4);
    this.aTile = A("iTile", 1);
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uTex: { value: tex } },
      vertexShader: PVERT,
      fragmentShader: additive ? PFRAG_ADD : PFRAG_ALPHA,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending,
    });
    if (additive) {
      m.blendSrc = THREE.OneFactor;
      m.blendDst = THREE.OneFactor;
      m.blendEquation = THREE.AddEquation;
    }
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 19;
    this.mesh.name = additive ? "cmb-fx-add" : "cmb-fx-alpha";
    scene.add(this.mesh);
    this.geo = g;
  }
  // o: {pos, vel, life, size, size1, stretch, color:[r,g,b], alpha, tile, drag, grav, fadeIn}
  emit(o) {
    if (this.list.length >= this.max) this.list.shift();
    const p = {
      pos: o.pos.clone(),
      vel: (o.vel || _v.set(0, 0, 0)).clone(),
      life: o.life || 0.3,
      age: 0,
      size: o.size ?? 0.2,
      size1: o.size1 ?? o.size ?? 0.2,
      stretch: o.stretch || 0,
      color: o.color || [1, 1, 1],
      alpha: o.alpha ?? 1,
      tile: o.tile || 0,
      drag: o.drag || 0,
      grav: o.grav || 0,
      fadeIn: o.fadeIn || 0,
      dir: o.dir ? o.dir.clone() : null,
    };
    this.list.push(p);
    return p;
  }
  update(dt) {
    const L = this.list;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vel.y -= p.grav * dt;
      if (p.drag) p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      L[n++] = p;
    }
    L.length = n;
    const P = this.aPos.array,
      D = this.aDir.array,
      S = this.aSize.array,
      C = this.aCol.array,
      T = this.aTile.array;
    for (let i = 0; i < n; i++) {
      const p = L[i],
        u = p.age / p.life;
      P[i * 3] = p.pos.x;
      P[i * 3 + 1] = p.pos.y;
      P[i * 3 + 2] = p.pos.z;
      const d = p.dir || p.vel;
      D[i * 3] = d.x;
      D[i * 3 + 1] = d.y;
      D[i * 3 + 2] = d.z;
      S[i * 2] = p.size + (p.size1 - p.size) * u;
      S[i * 2 + 1] = p.stretch * clamp(p.vel.length() / 12, 0, 1.5);
      const fi = p.fadeIn > 0 ? clamp(p.age / p.fadeIn, 0, 1) : 1;
      const a = p.alpha * fi * (1 - u) * (1 - u * 0.3);
      C[i * 4] = p.color[0];
      C[i * 4 + 1] = p.color[1];
      C[i * 4 + 2] = p.color[2];
      C[i * 4 + 3] = a;
      T[i] = p.tile;
    }
    this.geo.instanceCount = n;
    for (const a of [this.aPos, this.aDir, this.aSize, this.aCol, this.aTile]) {
      a.needsUpdate = true;
      a.clearUpdateRanges?.();
      a.addUpdateRange?.(0, n * a.itemSize);
    }
  }
}

// ------------------------------------------------------------------ web ribbon (camera-facing strip, CPU built)
const RSEG = 14;
export class Ribbon {
  constructor(
    scene,
    { width = 0.014, color = new THREE.Color(1.5, 1.55, 1.6) } = {},
  ) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((RSEG + 1) * 2 * 3);
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage),
    );
    const idx = [];
    for (let i = 0; i < RSEG; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 18;
    scene.add(this.mesh);
    this.geo = g;
    this.width = width;
  }
  // a -> b with a downward sag (m) and an optional sideways wobble
  set(
    a,
    b,
    cam,
    { sag = 0, opacity = 1, width = this.width, wobble = 0, t = 0 } = {},
  ) {
    this.mesh.visible = opacity > 0.01;
    if (!this.mesh.visible) return;
    this.mat.opacity = opacity;
    const P = this.pos;
    for (let i = 0; i <= RSEG; i++) {
      const u = i / RSEG;
      _v.lerpVectors(a, b, u);
      _v.y -= sag * 4 * u * (1 - u);
      if (wobble) {
        const w = Math.sin(u * 9 + t * 40) * wobble * u * (1 - u) * 4;
        _v.x += w;
        _v.z += w * 0.5;
      }
      // strip normal: perpendicular to the strand and the view ray
      _v2.subVectors(b, a).normalize();
      _v3.subVectors(cam, _v).normalize();
      const n = _v3
        .cross(_v2)
        .normalize()
        .multiplyScalar(
          width * (0.6 + 0.4 * (1 - u)) * Math.max(1, _v.distanceTo(cam) / 12),
        );
      P[i * 6] = _v.x + n.x;
      P[i * 6 + 1] = _v.y + n.y;
      P[i * 6 + 2] = _v.z + n.z;
      P[i * 6 + 3] = _v.x - n.x;
      P[i * 6 + 4] = _v.y - n.y;
      P[i * 6 + 5] = _v.z - n.z;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  hide() {
    this.mesh.visible = false;
  }
  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ------------------------------------------------------------------ web textures
function webSplatTex() {
  return canvasTex(512, (g, S) => {
    const c = S / 2;
    g.clearRect(0, 0, S, S);
    let seed = 3;
    const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const spokes = 15,
      ang = [];
    for (let i = 0; i < spokes; i++)
      ang.push(((i + R() * 0.5) / spokes) * Math.PI * 2);
    const len = ang.map(() => c * (0.72 + R() * 0.26));
    g.lineCap = "round";
    g.strokeStyle = "rgba(255,255,255,0.95)";
    for (let i = 0; i < spokes; i++) {
      g.lineWidth = 3 + R() * 3;
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(c + Math.cos(ang[i]) * len[i], c + Math.sin(ang[i]) * len[i]);
      g.stroke();
    }
    for (let r = 0.12; r < 0.9; r += 0.1 + R() * 0.05) {
      g.lineWidth = 1.5 + R() * 2;
      g.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const k = i % spokes;
        const rr = Math.min(r * c * (0.9 + R() * 0.2), len[k] * 0.98);
        const x = c + Math.cos(ang[k]) * rr,
          y = c + Math.sin(ang[k]) * rr;
        if (i === 0) g.moveTo(x, y);
        else {
          const km = (k + spokes - 1) % spokes;
          const am =
            (ang[km] + (ang[k] < ang[km] ? ang[k] + Math.PI * 2 : ang[k])) / 2;
          const sag = rr * 0.86;
          g.quadraticCurveTo(
            c + Math.cos(am) * sag,
            c + Math.sin(am) * sag,
            x,
            y,
          );
        }
      }
      g.stroke();
    }
    const gr = g.createRadialGradient(c, c, 0, c, c, c * 0.3);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.5, "rgba(255,255,255,0.8)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(c, c, c * 0.3, 0, Math.PI * 2);
    g.fill();
  });
}
function wrapTex() {
  // dense criss-cross strands for cocoons
  return canvasTex(256, (g, S) => {
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(0, 0, S, S);
    let seed = 11;
    const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.lineCap = "round";
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.55 + R() * 0.45})`;
      g.lineWidth = 1 + R() * 3.5;
      const y0 = R() * S,
        y1 = y0 + (R() - 0.5) * S * 0.9;
      g.beginPath();
      g.moveTo(-10, y0);
      g.bezierCurveTo(
        S * 0.33,
        y0 + (R() - 0.5) * 60,
        S * 0.66,
        y1 + (R() - 0.5) * 60,
        S + 10,
        y1,
      );
      g.stroke();
      g.beginPath();
      g.moveTo(-10, y0 - S);
      g.bezierCurveTo(S * 0.33, y0 - S, S * 0.66, y1 - S, S + 10, y1 - S);
      g.stroke();
      g.beginPath();
      g.moveTo(-10, y0 + S);
      g.bezierCurveTo(S * 0.33, y0 + S, S * 0.66, y1 + S, S + 10, y1 + S);
      g.stroke();
    }
  });
}
function senseTex() {
  // Spider-sense "tingle": wavy strokes radiating around an empty centre (the head)
  return canvasTex(256, (g, S) => {
    const c = S / 2;
    g.clearRect(0, 0, S, S);
    g.lineCap = "round";
    g.lineJoin = "round";
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 2) * 0.12 - Math.PI / 2;
      if (Math.abs(Math.sin(a) - 1) < 0.02) continue;
      const r0 = c * (0.42 + (i % 3) * 0.04),
        r1 = c * (0.86 + (i % 2) * 0.08);
      for (const [w, al] of [
        [9, 0.25],
        [4, 1],
      ]) {
        g.strokeStyle = `rgba(255,255,255,${al})`;
        g.lineWidth = w;
        g.beginPath();
        for (let k = 0; k <= 12; k++) {
          const u = k / 12,
            r = r0 + (r1 - r0) * u,
            wob = Math.sin(u * Math.PI * 3) * 0.07 * (1 - u * 0.4);
          const x = c + Math.cos(a + wob) * r,
            y = c + Math.sin(a + wob) * r;
          if (k === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  });
}

// ------------------------------------------------------------------ pistol (gunmen)
export function makePistol() {
  const g = new THREE.Group();
  g.name = "cmb-pistol";
  const metal = new THREE.MeshStandardMaterial({
    color: 0x1a1b1e,
    roughness: 0.38,
    metalness: 0.85,
  });
  const grip = new THREE.MeshStandardMaterial({
    color: 0x0c0c0d,
    roughness: 0.7,
    metalness: 0.1,
  });
  const slide = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.032, 0.19),
    metal,
  );
  slide.position.set(0, 0.03, 0.05);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.02, 0.15), metal);
  frame.position.set(0, 0.006, 0.035);
  const gr = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.1, 0.035), grip);
  gr.position.set(0, -0.04, -0.015);
  gr.rotation.x = 0.28;
  const guard = new THREE.Mesh(
    new THREE.TorusGeometry(0.018, 0.004, 5, 10, Math.PI),
    metal,
  );
  guard.position.set(0, -0.004, 0.035);
  guard.rotation.set(0, Math.PI / 2, Math.PI);
  for (const m of [slide, frame, gr, guard]) {
    m.castShadow = true;
    g.add(m);
  }
  g.userData.muzzle = new THREE.Vector3(0, 0.03, 0.15);
  return g;
}

// ------------------------------------------------------------------ main fx object
export function createFx(ctx) {
  const scene = ctx.scene,
    camera = ctx.camera;
  const atlas = atlasTex();
  const add = new Particles(scene, atlas, true, 900);
  const alpha = new Particles(scene, atlas, false, 300);
  const splatTex = webSplatTex(),
    wrap = wrapTex();
  wrap.wrapS = wrap.wrapT = THREE.RepeatWrapping;
  const webMat = new THREE.MeshStandardMaterial({
    color: 0xf2f4f6,
    map: splatTex,
    alphaMap: null,
    transparent: true,
    alphaTest: 0.25,
    roughness: 0.62,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  webMat.name = "cmb-websplat";
  const cocoonMat = new THREE.MeshStandardMaterial({
    color: 0xe9edf1,
    map: wrap,
    transparent: true,
    alphaTest: 0.12,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  cocoonMat.name = "cmb-cocoon";
  const splats = [];
  const ribbons = []; // transient strands {rb, a, b, t, life, sag, follow}
  const ribbonPool = [];

  // spider-sense sprite
  const senseMat = new THREE.SpriteMaterial({
    map: senseTex(),
    color: new THREE.Color(4, 3, 1.6),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const sense = new THREE.Sprite(senseMat);
  sense.renderOrder = 40;
  sense.scale.setScalar(1);
  sense.visible = false;
  sense.name = "cmb-spidersense";
  scene.add(sense);
  const S = { level: 0, pop: 0, red: 0, t: 0 };

  const fx = {
    add,
    alpha,
    webMat,
    cocoonMat,
    // --- hit spark: bright flash + star + streak sparks + ring (heavy) ---------------------------------------
    hit(pos, dir, { heavy = 0, color = [6, 4.2, 2.2] } = {}) {
      const s = 1 + heavy;
      add.emit({
        pos,
        life: 0.07 + 0.04 * heavy,
        size: 0.28 * s,
        size1: 0.5 * s,
        color: [7, 5.5, 4],
        alpha: 0.8,
        tile: 0,
      });
      add.emit({
        pos,
        dir: _v.set(randomBetween(-1, 1), randomBetween(-1, 1), randomBetween(-1, 1)),
        life: 0.08 + 0.04 * heavy,
        size: 0.4 * s,
        size1: 0.7 * s,
        color,
        tile: 1,
      });
      const n = 10 + Math.round(heavy * 14);
      for (let i = 0; i < n; i++) {
        const v = _v2
          .set(randomBetween(-1, 1), randomBetween(-0.6, 1), randomBetween(-1, 1))
          .normalize()
          .addScaledVector(dir, 1.1)
          .normalize()
          .multiplyScalar(randomBetween(5, 13) * (0.8 + heavy * 0.5));
        add.emit({
          pos,
          vel: v,
          life: randomBetween(0.12, 0.28),
          size: randomBetween(0.018, 0.035),
          size1: 0.01,
          stretch: 7,
          color: [7, 4.5, 2],
          tile: 0,
          drag: 5,
          grav: 9,
        });
      }
      if (heavy > 0.3) {
        const ring = add.emit({
          pos,
          dir: _v.set(1, 0, 0),
          life: 0.13,
          size: 0.2,
          size1: 0.75 * s,
          color: [2.2, 2, 1.8],
          alpha: 0.38,
          tile: 2,
        });
        ring.dir = null;
        for (let i = 0; i < 5; i++)
          alpha.emit({
            pos: _v
              .copy(pos)
              .add(_v2.set(randomBetween(-0.2, 0.2), randomBetween(-0.2, 0.2), randomBetween(-0.2, 0.2))),
            vel: _v3
              .copy(dir)
              .multiplyScalar(randomBetween(1, 3))
              .add(_v2.set(randomBetween(-1, 1), randomBetween(0, 1), randomBetween(-1, 1))),
            life: randomBetween(0.4, 0.7),
            size: 0.35,
            size1: 1.1,
            color: [0.75, 0.72, 0.7],
            alpha: 0.35,
            tile: 3,
            drag: 3,
          });
      }
    },
    // heavy-hit smear: fast white speed streaks along the blow direction + a squashed flash
    smear(pos, dir, heavy = 1) {
      const side = _v3.set(-dir.z, 0, dir.x);
      for (let i = 0; i < 7; i++) {
        const o = _v.copy(pos).addScaledVector(side, randomBetween(-0.35, 0.35));
        o.y += randomBetween(-0.3, 0.3);
        add.emit({
          pos: o,
          vel: _v2.copy(dir).multiplyScalar(randomBetween(14, 24)),
          life: randomBetween(0.08, 0.14),
          size: 0.03,
          size1: 0.015,
          stretch: 14,
          color: [3, 3, 3.2],
          alpha: 0.7,
          drag: 8,
        });
      }
      add.emit({
        pos,
        dir,
        life: 0.1,
        size: 0.35 * heavy,
        size1: 0.6 * heavy,
        stretch: 2.5,
        color: [3.5, 3.2, 3],
        alpha: 0.6,
        tile: 0,
      });
    },
    // ground impact (slam / body landing): dust ring + debris
    dust(pos, { amount = 1 } = {}) {
      const n = Math.round(8 * amount);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + randomBetween(0, 0.5);
        alpha.emit({
          pos: _v
            .copy(pos)
            .add(_v2.set(Math.cos(a) * 0.3, 0.15, Math.sin(a) * 0.3)),
          vel: _v3
            .set(Math.cos(a), randomBetween(0.1, 0.5), Math.sin(a))
            .multiplyScalar(randomBetween(1.8, 4) * amount),
          life: randomBetween(0.6, 1.1),
          size: 0.5,
          size1: 1.4 + amount * 0.6,
          color: [0.62, 0.6, 0.57],
          alpha: 0.42,
          tile: 3,
          drag: 3.2,
          fadeIn: 0.05,
        });
      }
    },
    // web impact: white splat burst
    webHit(pos, dir) {
      add.emit({
        pos,
        life: 0.12,
        size: 0.35,
        size1: 0.6,
        color: [3.5, 3.6, 3.8],
        tile: 0,
      });
      for (let i = 0; i < 9; i++) {
        const v = _v2
          .set(randomBetween(-1, 1), randomBetween(-1, 1), randomBetween(-1, 1))
          .normalize()
          .addScaledVector(dir, -0.5)
          .normalize()
          .multiplyScalar(randomBetween(2, 6));
        add.emit({
          pos,
          vel: v,
          life: randomBetween(0.15, 0.3),
          size: 0.02,
          size1: 0.01,
          stretch: 6,
          color: [2.8, 2.9, 3.1],
          drag: 6,
          grav: 4,
        });
      }
    },
    muzzle(pos, dir) {
      add.emit({
        pos,
        dir,
        life: 0.06,
        size: 0.16,
        size1: 0.22,
        stretch: 1.8,
        color: [14, 8, 3],
        tile: 1,
      });
      add.emit({ pos, life: 0.05, size: 0.3, color: [6, 3.5, 1.2], tile: 0 });
      alpha.emit({
        pos,
        vel: _v.copy(dir).multiplyScalar(1.2),
        life: 0.5,
        size: 0.1,
        size1: 0.4,
        color: [0.7, 0.7, 0.7],
        alpha: 0.25,
        tile: 3,
        drag: 2,
      });
    },
    tracer(from, to) {
      const d = _v.subVectors(to, from);
      const L = d.length();
      d.normalize();
      const p = add.emit({
        pos: from,
        vel: d.clone().multiplyScalar(160),
        life: Math.min(0.2, L / 160),
        size: 0.02,
        stretch: 30,
        color: [10, 7, 3.5],
        tile: 0,
      });
      return p;
    },
    // a web projectile (glowing blob) with a trailing strand from the hand
    ribbon(opts = {}) {
      const rb = ribbonPool.pop() || new Ribbon(scene);
      rb.width = opts.width || 0.014;
      return rb;
    },
    freeRibbon(rb) {
      rb.hide();
      ribbonPool.push(rb);
    },
    // strand that lives `life` seconds: a/b are functions or vectors (followed every frame)
    strand(a, b, { life = 0.35, sag = 0.1, width = 0.014, fade = 0.15 } = {}) {
      const r = { rb: fx.ribbon({ width }), a, b, t: 0, life, sag, fade };
      ribbons.push(r);
      return r;
    },
    splat(pos, normal, { size = 1.8, life = 30 } = {}) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), webMat);
      m.position.copy(pos).addScaledVector(normal, 0.03);
      m.quaternion.setFromUnitVectors(_v.set(0, 0, 1), normal);
      m.rotateZ(Math.random() * Math.PI * 2);
      m.receiveShadow = true;
      m.name = "cmb-splat";
      scene.add(m);
      const s = { m, t: 0, life, grow: 0 };
      splats.push(s);
      m.scale.setScalar(0.2);
      return s;
    },
    // spider-sense: level 0..1 (proximity of the incoming hit), red = ranged threat
    setSense(level, red, headPos) {
      if (level > 0.02 && S.level <= 0.02) S.pop = 1;
      S.level = level;
      S.red = red;
      if (headPos) sense.position.copy(headPos);
    },
    clear() {
      for (const s of splats) {
        scene.remove(s.m);
        s.m.geometry.dispose();
      }
      splats.length = 0;
      for (const r of ribbons) fx.freeRibbon(r.rb);
      ribbons.length = 0;
    },
    update(dt, realDt) {
      add.update(dt);
      alpha.update(dt);
      const cp = camera.position;
      for (let i = ribbons.length - 1; i >= 0; i--) {
        const r = ribbons[i];
        r.t += dt;
        if (r.t >= r.life) {
          fx.freeRibbon(r.rb);
          ribbons.splice(i, 1);
          continue;
        }
        const a = typeof r.a === "function" ? r.a() : r.a,
          b = typeof r.b === "function" ? r.b() : r.b;
        if (!a || !b) continue;
        const op = clamp((r.life - r.t) / r.fade, 0, 1);
        r.rb.set(a, b, cp, {
          sag: r.sag * (1 - op * 0.5),
          opacity: op,
          t: r.t,
        });
      }
      for (let i = splats.length - 1; i >= 0; i--) {
        const s = splats[i];
        s.t += dt;
        s.grow = Math.min(1, s.grow + dt / 0.12);
        const e = 1 - Math.pow(1 - s.grow, 3);
        s.m.scale.setScalar(0.2 + 0.8 * e);
        if (s.t > s.life) {
          scene.remove(s.m);
          s.m.geometry.dispose();
          splats.splice(i, 1);
        }
      }
      // spider-sense sprite (real-time animated so it stays readable in slow-mo)
      S.t += realDt;
      S.pop = Math.max(0, S.pop - realDt * 4);
      const on = S.level > 0.02;
      sense.visible = on;
      if (on) {
        const flick = 0.85 + 0.15 * Math.sin(S.t * 60);
        senseMat.opacity = clamp(S.level * 1.4, 0, 1) * flick;
        const sc = 0.95 + 0.25 * S.pop + 0.08 * Math.sin(S.t * 30);
        const d = sense.position.distanceTo(cp);
        sense.scale.setScalar(sc * Math.max(1, d / 5));
        senseMat.rotation = Math.sin(S.t * 13) * 0.05;
        senseMat.color.setRGB(
          4 + S.red * 3,
          3.1 * (1 - S.red * 0.75),
          1.6 * (1 - S.red * 0.7),
        );
      }
    },
  };
  return fx;
}

// ------------------------------------------------------------------ cocoon wrapped on an enemy's bones
// parts follow bone world transforms each frame (no re-parenting, robust against armature scale)
const PARTS = [
  // bone, radius x, length (along bone), radius z, centre offset along bone, min web level to show
  ["spine1", 0.24, 0.42, 0.19, 0.16, 0.0],
  ["hips", 0.22, 0.2, 0.17, 0.04, 0.2],
  ["thighL", 0.11, 0.46, 0.11, 0.22, 0.45],
  ["thighR", 0.11, 0.46, 0.11, 0.22, 0.45],
  ["upperArmL", 0.08, 0.3, 0.08, 0.14, 0.6],
  ["upperArmR", 0.08, 0.3, 0.08, 0.14, 0.6],
  ["shinL", 0.08, 0.4, 0.08, 0.2, 0.85],
  ["shinR", 0.08, 0.4, 0.08, 0.2, 0.85],
];
const sphere = new THREE.SphereGeometry(1, 14, 10);
export class Cocoon {
  constructor(scene, root, mat) {
    this.parts = [];
    const bones = {};
    root.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
    });
    for (const [name, rx, len, rz, off, min] of PARTS) {
      const b = bones[name];
      if (!b) continue;
      const m = new THREE.Mesh(sphere, mat);
      m.castShadow = true;
      m.frustumCulled = false;
      m.visible = false;
      m.name = "cmb-cocoon";
      // random UV rotation per piece so the strand pattern doesn't repeat visibly
      m.userData = {
        b,
        rx,
        len,
        rz,
        off,
        min,
        twist: Math.random() * Math.PI * 2,
        jit: 0.9 + Math.random() * 0.2,
      };
      scene.add(m);
      this.parts.push(m);
    }
    this.level = 0;
    this.shown = 0;
  }
  update(dt, level) {
    this.level = level;
    this.shown += (level - this.shown) * (1 - Math.exp(-10 * dt));
    for (const m of this.parts) {
      const d = m.userData,
        k = clamp((this.shown - d.min) / 0.25, 0, 1);
      m.visible = k > 0.02;
      if (!m.visible) continue;
      d.b.updateWorldMatrix(true, false);
      d.b.matrixWorld.decompose(_v, _q, _v2);
      const ax = _v3.set(0, 1, 0).applyQuaternion(_q);
      m.position.copy(_v).addScaledVector(ax, d.off);
      m.quaternion
        .copy(_q)
        .multiply(new THREE.Quaternion().setFromAxisAngle(WORLD_UP, d.twist));
      const g = (0.55 + 0.45 * k) * d.jit;
      m.scale.set(
        d.rx * g * 1.05,
        d.len * 0.5 * (0.7 + 0.3 * k),
        d.rz * g * 1.05,
      );
    }
  }
  dispose() {
    for (const m of this.parts) m.parent?.remove(m);
    this.parts.length = 0;
  }
}
