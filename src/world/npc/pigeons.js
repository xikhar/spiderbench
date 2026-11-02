// OWNER: citylife engineer. Pigeon flocks on sidewalks, plazas and park lawns. Birds peck and shuffle around; when
// Spider-Man comes close (walks up, lands nearby, swings low past) or world.alarm() fires, the flock bursts into the
// air, circles, and resettles once he has gone. One instanced mesh; wing flap / head peck in the vertex shader.
import * as THREE from "three";
import { G, mulberry32, inPark, shoreX } from "../layout.js";
import { MB } from "../geom.js";

const R_SIM = 160,
  MAX = 700;

function birdGeometry() {
  const b = new MB();
  const tag = []; // per-vertex: 0 body, 1 head, 2 left wing, 3 right wing
  const mark = (k, fn) => {
    const v0 = b.v;
    fn();
    for (let i = v0; i < b.v; i++) tag[i] = k;
  };
  mark(0, () => {
    b.setColor(0xffffff);
    b.with(
      new THREE.Matrix4()
        .makeRotationX(Math.PI / 2)
        .scale(new THREE.Vector3(1, 1.0, 1))
        .setPosition(0, 0.13, -0.02),
      (d) => d.cyl(0, -0.13, 0, 0.045, 0.05, 0.24, 7, true),
    );
    b.setColor([0.12, 0.12, 0.13]).box(-0.035, 0.12, -0.2, 0.035, 0.14, -0.12); // tail
    b.setColor([0.6, 0.35, 0.25])
      .box(-0.012, 0.0, 0.02, -0.004, 0.09, 0.03)
      .box(0.004, 0.0, 0.02, 0.012, 0.09, 0.03); // legs
  });
  mark(1, () => {
    b.setColor([0.35, 0.42, 0.4]).cyl(
      0,
      0.15,
      0.1,
      0.028,
      0.024,
      0.05,
      6,
      true,
    ); // iridescent neck
    b.setColor([0.55, 0.56, 0.6]).boxC(0, 0.215, 0.115, 0.045, 0.045, 0.055);
    b.setColor([0.1, 0.1, 0.1]).boxC(0, 0.205, 0.15, 0.012, 0.012, 0.03);
  });
  for (const [k, s] of [
    [2, 1],
    [3, -1],
  ])
    mark(k, () => {
      b.setColor([0.5, 0.52, 0.56]);
      const a = b.vert(s * 0.03, 0.15, 0.06, 0, 1, 0),
        c = b.vert(s * 0.03, 0.15, -0.1, 0, 1, 0);
      const e = b.vert(s * 0.3, 0.15, -0.06, 0, 1, 0),
        f = b.vert(s * 0.26, 0.15, 0.03, 0, 1, 0);
      if (s > 0) {
        b.quad(a, f, e, c);
        b.quad(a, c, e, f);
      } else {
        b.quad(a, c, e, f);
        b.quad(a, f, e, c);
      }
      b.setColor([0.12, 0.12, 0.14]);
      const g = b.vert(s * 0.2, 0.151, -0.075, 0, 1, 0),
        h = b.vert(s * 0.3, 0.151, -0.062, 0, 1, 0),
        i = b.vert(s * 0.27, 0.151, 0.0, 0, 1, 0);
      b.tri(g, h, i);
      b.tri(g, i, h);
    });
  const g = b.build();
  g.setAttribute("aTag", new THREE.Float32BufferAttribute(tag, 1));
  return g;
}

export function createPigeons({ scene, blocks, parkPaths }) {
  const geo = birdGeometry();
  const iF = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX * 4),
    4,
  ).setUsage(THREE.DynamicDrawUsage);
  const iT = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("iF", iF);
  geo.setAttribute("iT", iT);
  const uTime = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      attribute float aTag; attribute vec4 iF; attribute vec3 iT; uniform float uTime;`,
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed = position;
      {
        int T = int(aTag + 0.5);
        if (T >= 2) {
          float s = T == 2 ? 1.0 : -1.0;
          float fold = iF.w;
          // folded: wing tucked along the body; open: flapping about the body axis
          float a = s * (iF.x * sin(uTime * 17.0 + iF.y * 6.28) + 0.15 * iF.x);
          vec2 p = vec2(transformed.x - s * 0.03, transformed.y - 0.15);
          p.x *= mix(1.0, 0.18, fold);
          transformed.z = mix(transformed.z, transformed.z - abs(p.x) * 1.2 - 0.02, fold);
          float c = cos(a), sn = sin(a);
          transformed.xy = vec2(s * 0.03, 0.15) + vec2(c * p.x - sn * p.y, sn * p.x + c * p.y);
        } else if (T == 1) {
          float pk = iF.z * max(0.0, sin(uTime * 7.0 + iF.y * 40.0));
          vec2 q = transformed.zy - vec2(0.08, 0.14);
          float c = cos(pk * 1.1), sn = sin(pk * 1.1);
          transformed.zy = vec2(0.08, 0.14) + vec2(c * q.x + sn * q.y, -sn * q.x + c * q.y);
          transformed.z += 0.012 * sin(uTime * 9.0 + iF.y * 20.0) * (1.0 - iF.z) * (1.0 - step(0.01, iF.x));
        }
      }`,
      )
      .replace(
        "#include <color_vertex>",
        "#include <color_vertex>\n vColor.rgb *= iT;",
      );
  };
  mat.customProgramCacheKey = () => "city-pigeon-v1";
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.name = "pigeons";
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  // ---- flock sites
  const rnd = mulberry32(3131);
  const flocks = [];
  const addFlock = (x, z, y, n) =>
    flocks.push({
      x,
      z,
      y,
      n,
      birds: null,
      state: "ground",
      t: 0,
      seed: flocks.length * 977 + 5,
    });
  for (const b of blocks) {
    if (rnd() > (b.core ? 0.55 : 0.3)) continue;
    // on the sidewalk, building side of a random frontage
    const side = Math.floor(rnd() * 4),
      u = 0.15 + rnd() * 0.7;
    const x =
      side === 0 || side === 2
        ? b.x0 + (b.x1 - b.x0) * u
        : side === 1
          ? b.x1 - 2.8
          : b.x0 + 2.8;
    const z =
      side === 1 || side === 3
        ? b.z0 + (b.z1 - b.z0) * u
        : side === 0
          ? b.z0 + 2.5
          : b.z1 - 2.5;
    addFlock(x, z, G.CURB_H, 5 + Math.floor(rnd() * 10));
  }
  for (const p of parkPaths || []) {
    if (p.drive) continue;
    for (let i = 4; i < p.pts.length; i += 14)
      if (rnd() < 0.6)
        addFlock(
          p.pts[i][0] + (rnd() - 0.5) * 3,
          p.pts[i][1] + (rnd() - 0.5) * 3,
          G.CURB_H + 0.02,
          6 + Math.floor(rnd() * 14),
        );
  }
  for (let z = -3150; z < 3050; z += 110) {
    const zz = z + rnd() * 40,
      [w, e] = shoreX(zz);
    addFlock(
      rnd() < 0.5 ? w + 5 + rnd() * 6 : e - 5 - rnd() * 6,
      zz,
      G.CURB_H,
      5 + Math.floor(rnd() * 10),
    );
  }

  const spawnBirds = (F) => {
    const r = mulberry32(F.seed);
    F.birds = [];
    for (let i = 0; i < F.n; i++) {
      const a = r() * 6.28,
        d = Math.sqrt(r()) * 1.6;
      const g = r();
      const tint =
        g < 0.12
          ? [1.5, 1.45, 1.4]
          : g < 0.3
            ? [0.9, 0.75, 0.62]
            : [0.85 + r() * 0.3, 0.85 + r() * 0.3, 0.9 + r() * 0.3];
      F.birds.push({
        x: F.x + Math.cos(a) * d,
        y: F.y,
        z: F.z + Math.sin(a) * d,
        ry: r() * 6.28,
        tx: 0,
        tz: 0,
        wt: r() * 2,
        vx: 0,
        vy: 0,
        vz: 0,
        flap: 0,
        fold: 1,
        peck: 0,
        ph: r(),
        tint,
        orbit: 8 + r() * 8,
        ang: r() * 6.28,
        alt: 10 + r() * 10,
        spd: 7 + r() * 3,
        land: 0,
      });
    }
  };

  const player = {
    pos: new THREE.Vector3(1e9, 0, 0),
    vel: new THREE.Vector3(),
    air: false,
    ground: 0,
    landT: -9,
    landPos: null,
  };
  let time = 0;
  const alarms = [];
  const scatter = (F) => {
    if (F.state === "air") {
      F.t = 0;
      return;
    }
    F.state = "air";
    F.t = 0;
    for (const b of F.birds) {
      const ax = b.x - player.pos.x,
        az = b.z - player.pos.z,
        l = Math.hypot(ax, az) || 1;
      b.vx = (ax / l) * (2 + Math.random() * 2);
      b.vz = (az / l) * (2 + Math.random() * 2);
      b.vy = 3 + Math.random() * 2.5;
      b.ang = Math.atan2(b.z - F.z, b.x - F.x);
      b.delay = Math.random() * 0.25;
    }
  };
  const threat = (F) => {
    const d = Math.hypot(player.pos.x - F.x, player.pos.z - F.z);
    const h = player.pos.y - F.y;
    if (d < 6 && h < 3) return true;
    if (d < 11 && h < 10 && player.vel.lengthSq() > 49) return true;
    if (
      player.landT > time - 0.3 &&
      player.landPos &&
      Math.hypot(player.landPos.x - F.x, player.landPos.z - F.z) < 14
    )
      return true;
    for (const al of alarms)
      if (Math.hypot(al.x - F.x, al.z - F.z) < al.r + 15) return true;
    return false;
  };
  const clearOf = (F) =>
    Math.hypot(player.pos.x - F.x, player.pos.z - F.z) > 16 && !alarms.length;

  const e = mesh.instanceMatrix.array;
  const frustum = new THREE.Frustum(),
    pv = new THREE.Matrix4(),
    sph = new THREE.Sphere();
  return {
    flocks,
    setPlayer(st) {
      player.pos.copy(st.pos);
      player.vel.copy(st.vel);
      player.air = st.air;
      player.ground = st.ground ?? 0;
      player.landT = st.landT;
      player.landPos = st.landPos;
    },
    alarm(pos, r = 25) {
      alarms.push({ x: pos.x, z: pos.z, r, t: time });
    },
    update(dt, camera) {
      time += dt;
      uTime.value = time;
      while (alarms.length && time - alarms[0].t > 0.5) alarms.shift();
      const cp = camera.position;
      camera.updateMatrixWorld();
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(pv);
      let n = 0;
      for (const F of flocks) {
        const dc = Math.hypot(F.x - cp.x, F.z - cp.z);
        if (dc > R_SIM) {
          F.birds = null;
          F.state = "ground";
          continue;
        }
        if (!F.birds) spawnBirds(F);
        F.t += dt;
        if (F.state === "ground" && threat(F)) scatter(F);
        if (F.state === "air" && F.t > 7 && clearOf(F)) {
          F.state = "landing";
          F.t = 0;
        }
        if (F.state === "landing" && threat(F)) scatter(F);
        let landed = 0;
        for (const b of F.birds) {
          if (F.state === "ground") {
            b.wt -= dt;
            if (b.wt <= 0) {
              b.wt = 1 + Math.random() * 3;
              const a = Math.random() * 6.28,
                d = Math.sqrt(Math.random()) * 1.8;
              b.tx = F.x + Math.cos(a) * d;
              b.tz = F.z + Math.sin(a) * d;
              b.peck = Math.random() < 0.5 ? 1 : 0;
            }
            const dx = b.tx - b.x,
              dz = b.tz - b.z,
              l = Math.hypot(dx, dz);
            if (l > 0.05 && b.tx) {
              const s = Math.min(l, 0.35 * dt);
              b.x += (dx / l) * s;
              b.z += (dz / l) * s;
              b.ry +=
                Math.atan2(
                  Math.sin(Math.atan2(dx, dz) - b.ry),
                  Math.cos(Math.atan2(dx, dz) - b.ry),
                ) * Math.min(1, dt * 8);
              b.peckNow = 0;
            } else b.peckNow = b.peck;
            b.y = F.y;
            b.flap += (0 - b.flap) * Math.min(1, dt * 10);
            b.fold += (1 - b.fold) * Math.min(1, dt * 6);
          } else if (F.state === "air") {
            if (b.delay > 0) {
              b.delay -= dt;
            } else if (F.t < 1.6) {
              // burst up and away
              b.x += b.vx * dt;
              b.z += b.vz * dt;
              b.y += b.vy * dt;
              b.vy += 4 * dt;
              b.ry = Math.atan2(b.vx, b.vz);
              b.flap = 0.95;
              b.fold = 0;
            } else {
              // circle over the site
              b.ang += (b.spd / b.orbit) * dt;
              const tx = F.x + Math.cos(b.ang) * b.orbit,
                tz = F.z + Math.sin(b.ang) * b.orbit,
                ty = F.y + b.alt;
              b.x += (tx - b.x) * Math.min(1, dt * 1.5);
              b.z += (tz - b.z) * Math.min(1, dt * 1.5);
              b.y += (ty - b.y) * Math.min(1, dt * 1.2);
              b.ry = Math.atan2(-Math.sin(b.ang), Math.cos(b.ang));
              b.flap = 0.55 + 0.35 * Math.sin(time * 1.3 + b.ph * 9);
              b.fold = 0;
            }
            b.peckNow = 0;
          } else {
            // landing: glide down to a spot in the site
            if (!b.land) {
              const a = Math.random() * 6.28,
                d = Math.sqrt(Math.random()) * 1.8;
              b.tx = F.x + Math.cos(a) * d;
              b.tz = F.z + Math.sin(a) * d;
              b.land = 1;
            }
            const dx = b.tx - b.x,
              dz = b.tz - b.z,
              dy = F.y - b.y,
              l = Math.hypot(dx, dz);
            const s = Math.min(l, 6 * dt);
            if (l > 0.05) {
              b.x += (dx / l) * s;
              b.z += (dz / l) * s;
              b.ry = Math.atan2(dx, dz);
            }
            b.y += dy * Math.min(1, dt * (l < 3 ? 3 : 0.8));
            b.flap = l < 2 ? 0.8 : 0.25;
            b.fold = Math.abs(dy) < 0.05 && l < 0.1 ? 1 : 0;
            if (Math.abs(dy) < 0.03 && l < 0.1) landed++;
          }
          if (n >= MAX) continue;
          sph.center.set(b.x, b.y, b.z);
          sph.radius = 0.5;
          if (!frustum.intersectsSphere(sph) && dc > 20) continue;
          const k = n++,
            o = k * 16,
            c = Math.cos(b.ry),
            s = Math.sin(b.ry);
          e[o] = c;
          e[o + 1] = 0;
          e[o + 2] = -s;
          e[o + 3] = 0;
          e[o + 4] = 0;
          e[o + 5] = 1;
          e[o + 6] = 0;
          e[o + 7] = 0;
          e[o + 8] = s;
          e[o + 9] = 0;
          e[o + 10] = c;
          e[o + 11] = 0;
          e[o + 12] = b.x;
          e[o + 13] = b.y;
          e[o + 14] = b.z;
          e[o + 15] = 1;
          iF.array[k * 4] = b.flap;
          iF.array[k * 4 + 1] = b.ph;
          iF.array[k * 4 + 2] = b.peckNow || 0;
          iF.array[k * 4 + 3] = b.fold;
          iT.array[k * 3] = b.tint[0];
          iT.array[k * 3 + 1] = b.tint[1];
          iT.array[k * 3 + 2] = b.tint[2];
        }
        if (F.state === "landing" && landed === F.birds.length) {
          F.state = "ground";
          for (const b of F.birds) b.land = 0;
        }
      }
      mesh.count = n;
      if (n)
        for (const [a, w] of [
          [mesh.instanceMatrix, 16],
          [iF, 4],
          [iT, 3],
        ]) {
          a.clearUpdateRanges();
          a.addUpdateRange(0, n * w);
          a.needsUpdate = true;
        }
    },
    stats() {
      let n = 0;
      for (const F of flocks) if (F.birds) n += F.birds.length;
      return { pigeons: n, flocks: flocks.length };
    },
  };
  void inPark;
}
