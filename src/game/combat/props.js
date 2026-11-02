// OWNER: combat engineer. Environmental throwables spawned around a fight (NYC litter bin, wooden crate, oil drum):
// webbed with both hands, yanked overhead, hurled at an enemy (R / L1+R1).
import * as THREE from 'three';
import { clamp, rnd } from './util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

function woodTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#9a7248'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#8d6740' : '#a47b4f'; g.fillRect(0, i * 64 + 2, 256, 60); }
  g.strokeStyle = 'rgba(60,38,20,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 90; i++) { const y = Math.random() * 256; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + rnd(-4, 4), 170, y + rnd(-4, 4), 256, y + rnd(-3, 3)); g.stroke(); }
  g.fillStyle = 'rgba(40,25,12,0.8)'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 64, 256, 3);
  g.fillStyle = '#6e4e2e'; g.fillRect(0, 0, 18, 256); g.fillRect(238, 0, 18, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function makeBin(mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.25, 0.86, 18, 1, true), mats.bin); body.position.y = 0.45;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.25, 18), mats.bin); bottom.rotation.x = Math.PI / 2; bottom.position.y = 0.02;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.022, 6, 20), mats.binDark); rim.rotation.x = Math.PI / 2; rim.position.y = 0.88;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.015, 6, 20), mats.binDark); band.rotation.x = Math.PI / 2; band.position.y = 0.3;
  const trash = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.trash); trash.position.y = 0.82; trash.scale.y = 0.4;
  for (const m of [body, bottom, rim, band, trash]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return { g, r: 0.3, h: 0.9, mass: 1 };
}
function makeCrate(mats) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), mats.wood); b.position.y = 0.3; b.castShadow = true; b.receiveShadow = true; g.add(b);
  return { g, r: 0.4, h: 0.6, mass: 1, breaks: true };
}
function makeDrum(mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 20), mats.drum); body.position.y = 0.44;
  g.add(body);
  for (const y of [0.3, 0.6]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.014, 6, 22), mats.drum); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, r: 0.3, h: 0.88, mass: 1.3 };
}

export function createProps(c) {
  const ctx = c.ctx, scene = ctx.scene;
  const mats = {
    bin: new THREE.MeshStandardMaterial({ color: 0x2f5a37, roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide }),
    binDark: new THREE.MeshStandardMaterial({ color: 0x1f3a24, roughness: 0.5, metalness: 0.5 }),
    trash: new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.35, metalness: 0.0 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.85 }),
    drum: new THREE.MeshStandardMaterial({ color: 0x1d4f8f, roughness: 0.45, metalness: 0.55 }),
  };
  const list = [];
  const P = {
    list,
    spawnAround(center, n = 3) {
      const W = ctx.world;
      for (let k = 0, tries = 0; k < n && tries < 40; tries++) {
        const a = Math.random() * Math.PI * 2, r = rnd(3, 8.5);
        const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
        const gy = W.groundHeight(x, z, center.y + 2);
        if (Math.abs(gy - center.y) > 0.4) continue;
        const d = _v2.set(x - center.x, 0, z - center.z); const L = d.length(); d.normalize();
        const hit = W.raycast(_v.set(center.x, center.y + 0.6, center.z), d, L + 0.6);
        if (hit) continue;
        if (list.some(p => p.pos.distanceTo(_v.set(x, gy, z)) < 1.2)) continue;
        const kind = ['bin', 'crate', 'drum'][k % 3];
        const m = kind === 'bin' ? makeBin(mats) : kind === 'crate' ? makeCrate(mats) : makeDrum(mats);
        m.g.position.set(x, gy, z); m.g.rotation.y = Math.random() * 6.28; m.g.name = 'cmb-prop-' + kind; scene.add(m.g);
        list.push({ kind, ...m, pos: m.g.position, vel: new THREE.Vector3(), spin: new THREE.Vector3(), state: 'rest', t: 0 });
        k++;
      }
    },
    // push a standing body (feet position, radius r) out of the resting props; returns true when it touched one
    collide(feet, r, move) {
      let hit = false;
      for (const pr of list) {
        if (pr.state !== 'rest' && pr.state !== 'spent') continue;
        if (feet.y > pr.pos.y + (pr.h || 1) || feet.y + 1.6 < pr.pos.y) continue;
        const dx = feet.x - pr.pos.x, dz = feet.z - pr.pos.z, d = Math.hypot(dx, dz), m = r + (pr.state === 'spent' ? 0.25 : pr.r || 0.35);
        if (d < m && d > 1e-4) { move((dx / d) * (m - d), (dz / d) * (m - d)); hit = true; }
      }
      return hit;
    },
    nearest(p, maxD) {
      let best = null, bd = maxD;
      for (const pr of list) { if (pr.state !== 'rest') continue; const d = pr.pos.distanceTo(p); if (d < bd) { bd = d; best = pr; } }
      return best;
    },
    grab(pr, me) { pr.state = 'held'; pr.t = 0; pr.from = pr.pos.clone(); pr.me = me; },
    launch(pr, target) {
      pr.state = 'flying'; pr.t = 0; pr.target = target;
      const to = target.chest(_v); pr.vel.subVectors(to, pr.pos).normalize().multiplyScalar(26);
      pr.spin.set(rnd(-9, 9), rnd(-6, 6), rnd(-9, 9));
    },
    clear() { for (const p of list) scene.remove(p.g); list.length = 0; },
    update(dt) {
      const pp = ctx.player.position;
      for (let i = list.length - 1; i >= 0; i--) {
        const pr = list[i]; pr.t += dt;
        if (pr.state === 'held') {
          // yanked by the webs toward a point above Spider-Man's head, spinning
          const up = _v.set(pp.x, pp.y + 1.6, pp.z);
          const k = clamp(pr.t / 0.38, 0, 1), e = k * k * (3 - 2 * k);
          pr.pos.lerpVectors(pr.from, up, e); pr.pos.y += Math.sin(Math.PI * k) * 1.2 - pr.h * 0.5 * e;
          pr.g.rotation.x += dt * 8 * k; pr.g.rotation.z += dt * 5 * k;
        } else if (pr.state === 'flying') {
          const T = pr.target;
          if (T && T.alive) { const to = T.chest(_v); const d = _v2.subVectors(to, pr.pos); const L = d.length();
            pr.vel.lerp(d.normalize().multiplyScalar(26), 1 - Math.exp(-10 * dt));
            if (L < 0.9) {
              c.playerHit(T, { kind: 'throw', dmg: 45, heavy: 1, from: pr.pos.clone() });
              for (const e of c.enemies) if (e !== T && e.alive && e.pos.distanceTo(T.pos) < 2) c.playerHit(e, { kind: 'throw', dmg: 20, heavy: 0.5, silent: true });
              if (pr.breaks) { c.fx.dust(pr.pos, { amount: 0.8 }); for (let j = 0; j < 14; j++) c.fx.alpha.emit({ pos: pr.pos, vel: _v.set(rnd(-5, 5), rnd(1, 6), rnd(-5, 5)), life: 0.9, size: 0.09, size1: 0.07, color: [0.45, 0.32, 0.2], alpha: 1, tile: 0, grav: 14 }); scene.remove(pr.g); list.splice(i, 1); continue; }
              pr.state = 'settle'; pr.vel.multiplyScalar(-0.15).setY(4);
            }
          } else pr.vel.y -= 9 * dt;
          pr.pos.addScaledVector(pr.vel, dt);
          pr.g.rotation.x += pr.spin.x * dt; pr.g.rotation.y += pr.spin.y * dt; pr.g.rotation.z += pr.spin.z * dt;
          if (pr.t > 2.5) pr.state = 'settle';
        }
        if (pr.state === 'settle') {
          pr.vel.y -= 20 * dt; pr.pos.addScaledVector(pr.vel, dt);
          pr.g.rotation.x += pr.spin.x * dt * 0.5; pr.g.rotation.z += pr.spin.z * dt * 0.5;
          const gy = ctx.world.groundHeight(pr.pos.x, pr.pos.z, pr.pos.y + 1);
          if (pr.pos.y <= gy) {
            pr.pos.y = gy;
            if (Math.abs(pr.vel.y) > 3) { pr.vel.y *= -0.3; pr.vel.x *= 0.5; pr.vel.z *= 0.5; c.sfx('clatter', pr.kind); }
            else { pr.vel.set(0, 0, 0); pr.state = 'spent'; pr.g.rotation.x = Math.PI / 2; pr.g.rotation.z = 0; pr.pos.y = gy + pr.r; }
          }
        }
      }
    },
  };
  return P;
}
