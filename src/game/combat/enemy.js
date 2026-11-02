// OWNER: combat engineer. One combat enemy wrapping a crime actor (src/game/systems/crimeactors.js): thug.glb with its
// own brawler clips (thugIdle, thugPunch1/2, thugKick, directional stumbles, thugKnockdown / thugGetUp, gun aim / fire,
// bruteSlam, thugWebbedStruggle) plus Spider-Man's walk / jog / run for locomotion. Stumbles, knockdown and get-up carry
// root motion (actor.rootDelta): the body travels with the feet, never slides or snaps back.
// The combat module sets actor.external = true and owns position / facing / clips from then on.
// Types: 'melee' (street thug), 'gunman' (pistol, keeps distance, fires bursts), 'brute' (big, super-armoured heavy hitter).
// States: hold · approach · attack · aim · fire · stagger · air · knock · down · getup · webbed · stuck · out
import * as THREE from 'three';
import { makePistol, Cocoon } from './fx.js';
import { clamp, damp, dampAngle, angWrap, yawTo, hdist, rnd, pick, smooth, UP } from './util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0);
const G = 22;

export const TYPES = {
  melee: { hp: 50, speed: 3.2, reach: 1.35, dmg: 9, scale: 1, attacks: ['thugPunch1', 'thugPunch2', 'thugKick'] },
  gunman: { hp: 38, speed: 3.0, reach: 1.3, dmg: 6, scale: 1, attacks: ['thugPunch2', 'thugPunch1'] },
  brute: { hp: 150, speed: 2.4, reach: 1.7, dmg: 18, scale: 1.24, attacks: ['bruteSlam', 'thugPunch1', 'bruteSlam'] },
};
// contact time (clip s) and telegraph (s from the start of the swing to the contact: the wind-up is slowed to fill it, so
// the spider-sense lead matches what the body shows). The thug steps in during the wind-up.
const HIT_T = { thugPunch1: 0.33, thugPunch2: 0.20, thugKick: 0.30, bruteSlam: 0.57 };
const TELE = { thugPunch1: 0.55, thugPunch2: 0.42, thugKick: 0.5, bruteSlam: 0.85 };
const STUMBLE = { back: 'thugStumbleBack', left: 'thugStumbleLeft', right: 'thugStumbleRight' };
const LOCO = { walk: 1.25, jog: 3.2, run: 5.8 };

let seq = 0;
export class Enemy {
  constructor(combat, actor, type = 'melee') {
    this.c = combat; this.actor = actor; this.type = type; this.id = 'e' + (++seq);
    this.T = TYPES[type];
    this.root = actor.root; this.inner = actor.root.children[0];
    actor.external = true; actor.then = null; actor.move = null; actor.lookout = false; actor.bully = null;
    this.hp = this.maxHp = this.T.hp;
    this.state = 'hold'; this.st = 0;
    this.vel = new THREE.Vector3(); this.yaw = this.root.rotation.y;
    this.web = 0; this.webT = 0; this.stun = 0; this.cd = rnd(0.6, 2.0); this.flinch = 0; this.flinchDir = 0;
    this.pitch = 0; this.slot = null; this.out = false; this.stuck = null; this.lastHitT = -9; this.juggle = 0;
    this.aimW = 0; this.hasGun = type === 'gunman'; this.shots = 0;
    const s = this.T.scale; this.root.scale.setScalar(s);
    this.bones = {}; this.root.traverse(o => { if (o.isBone) this.bones[o.name] = o; });
    this.rest = {}; for (const k of ['deltoidR', 'deltoidL', 'gluteL', 'gluteR']) if (this.bones[k]) this.rest[k] = this.bones[k].quaternion.clone();
    if (type === 'brute') this.tintBrute();
    if (this.hasGun) { this.gun = makePistol(); combat.ctx.scene.add(this.gun); }
    this.cocoon = new Cocoon(combat.ctx.scene, this.root, combat.fx.cocoonMat);
    this.rd = new THREE.Vector3(); this.loco = null;
    this.play('thugIdle', { fade: 0.25 });
  }
  tintBrute() {
    const tex = this.c.bruteTex;
    this.root.traverse(o => { if (o.isMesh && o.material) { if (tex) { o.material.map = tex; } else o.material.color.setRGB(0.5, 0.5, 0.55); o.material.needsUpdate = true; } });
  }
  get pos() { return this.root.position; }
  get alive() { return !this.out && !this.stuck; }
  get targetable() { return this.alive && this.state !== 'down' && this.state !== 'getup'; }
  chest(out = new THREE.Vector3()) { return out.copy(this.pos).setY(this.pos.y + 1.25 * this.T.scale + (this.state === 'down' || this.state === 'out' ? -0.95 : 0)); }
  headPos(out = new THREE.Vector3()) { const b = this.bones.head; if (b) return b.getWorldPosition(out); return this.chest(out).setY(out.y + 0.4); }
  set(state) { this.state = state; this.st = 0; if (['hold', 'approach', 'attack', 'aim', 'fire'].includes(state)) this.turnRate = 0; }
  play(name, o = {}) {
    const a = this.actor.play(name, { fade: o.fade ?? 0.18, timeScale: o.ts ?? 1, once: o.once });
    if (a) { this.act = a; this.actName = name; if (o.at != null) { a.time = o.at; this.actor.rootSync?.(); } }
    return a;
  }
  // ------------------------------------------------------------------ damage intake
  // h: {dmg, dir (horizontal unit, attacker -> me), kind:'light'|'ender'|'launch'|'air'|'slam'|'strike'|'throw'|'finisher', stunBrute}
  hit(h) {
    if (!this.alive) return null;
    const c = this.c;
    this.lastHitT = c.time;
    const armored = this.type === 'brute' && this.stun <= 0 && !['throw', 'finisher', 'slam'].includes(h.kind) && this.state !== 'webbed';
    if (h.stunBrute && this.type === 'brute') this.stun = 3.8;
    this.hp -= h.dmg * (armored ? 0.55 : 1);
    this.faceYaw = Math.atan2(-h.dir.x, -h.dir.z); // toward the attacker (turned to quickly, never snapped)
    const rel = angWrap(this.faceYaw - this.yaw); // attacker bearing in his frame (+ = on his left)
    const dead = this.hp <= 0;
    this.actor.hp = dead ? 0 : Math.max(1, Math.ceil(2 * this.hp / this.maxHp)); // mirror onto the crime record
    if (this.state === 'webbed' && h.kind !== 'air') { this.knock(h.dir, 10, 3.4, true); return { knocked: true }; }
    if (armored && !dead) { this.flinch = 1; this.flinchDir = Math.random() < 0.5 ? -1 : 1; this.pushXZ(h.dir, 0.15); return { armored: true }; }
    if (h.kind === 'slam') { this.vel.set(h.dir.x * 2, -18, h.dir.z * 2); this.set('air'); this.juggle = 0; this.falling = false; return { slam: true }; } // (was unreachable for airborne targets)
    if (this.state === 'air' && h.kind !== 'air') { this.juggle = 0; this.vel.set(h.dir.x * 4, Math.min(this.vel.y, 1), h.dir.z * 4); this.flinch = 1; return { air: true }; }
    if (this.state === 'air' || h.kind === 'air') { this.airHit(h); if (dead) this.juggle = Math.min(this.juggle, 0.25); return { air: true }; }
    if (h.kind === 'launch') { this.launch(h.dir); return { launched: true }; }
    if (h.kind === 'finisher') { this.hp = 0; this.knock(h.dir, 8, 4.5, true); return { knocked: true }; }
    if (dead || h.kind === 'ender' || h.kind === 'strike' || h.kind === 'throw') {
      const f = h.kind === 'throw' ? 8 : h.kind === 'strike' ? 7.5 : dead ? 7 : 6.5;
      this.knock(h.dir, f, h.kind === 'throw' ? 4.5 : 3.8); return { knocked: true };
    }
    // light hit: a directional stumble (root motion carries him 0.26-0.32 m with his feet). From the side he is pushed
    // away sideways; from the front the punch's side picks the way his head snaps (h.side: +1 = he is hit on his left)
    let st = 'back';
    if (Math.abs(rel) > 0.9 && Math.abs(rel) < 2.3) st = rel > 0 ? 'right' : 'left';
    else if (Math.abs(rel) <= 0.9 && h.side) st = h.side > 0 ? 'right' : 'left';
    if (st === this.lastStumble && Math.random() < 0.5) st = 'back';
    this.lastStumble = st;
    this.set('stagger'); this.turnRate = Math.abs(rel) > 2.3 ? 14 : 5; // hit from behind: spins round to face him
    const ts = 1.15 + Math.random() * 0.15;
    this.play(STUMBLE[st], { fade: 0.06, once: true, ts });
    this.stagT = (st === 'back' ? 0.7 : 0.6) / ts - 0.06;
    this.c.onEnemyInterrupted(this);
    return { stagger: true };
  }
  pushXZ(dir, d) { this.moveXZ(dir.x * d, dir.z * d); }
  // pulled in by Spider-Man's web: lurches off balance toward `to` (ground point) over dur s, feet leaving the ground
  // for a moment; stays there (still off balance) until the blow lands, or recovers after a beat
  yank(to, dur) {
    if (!this.alive) return;
    this.set('yanked'); this.yk = { from: this.pos.clone(), to: to.clone(), dur, prev: 0 };
    this.faceYaw = yawTo(this.pos, to) ; this.turnRate = 16;
    this.play('thugKnockdown', { fade: 0.06, once: true, ts: 0.3, at: 0.1 }); // chest pulled forward, arms flung
    this.c.onEnemyInterrupted(this);
  }
  // locomotion clip for ground speed sp (m/s), with hysteresis so a speed near a threshold never flips clips each frame;
  // stride-matched (timeScale = speed / the clip's authored speed)
  locomote(sp, fade = 0.25) {
    if (sp < 0.12) { this.loco = null; this.play('thugIdle', { fade: 0.3 }); return; }
    const cur = this.loco;
    let clip = sp > 4.6 ? 'run' : sp > 2.0 ? 'jog' : 'walk';
    if (cur === 'run' && sp > 4.0) clip = 'run'; else if (cur === 'jog' && sp > 1.6 && sp < 5.2) clip = 'jog'; else if (cur === 'walk' && sp < 2.4) clip = 'walk';
    this.loco = clip;
    this.play(clip, { ts: clamp(sp / LOCO[clip], 0.55, 1.6), fade });
  }
  // apply the playing clip's root motion (stumbles / knockdown / get-up) with wall collision
  rootMotion() {
    const d = this.actor.rootDelta?.(this.rd); if (!d) return;
    if (Math.abs(d.x) + Math.abs(d.z) > 1e-6) this.moveXZ(d.x, d.z);
  }
  launch(dir) {
    this.set('air'); this.vel.set(dir.x * 0.4, 10.2, dir.z * 0.4); this.juggle = 1.7; this.turnRate = 16; this.falling = false;
    this.play('thugKnockdown', { fade: 0.08, once: true, ts: 0.6 }); // thrown up: arches back, arms flung up
    this.c.onEnemyInterrupted(this);
  }
  airHit(h) {
    this.set('air'); this.juggle = 1.2; this.falling = false;
    this.vel.set(h.dir.x * 0.8, Math.max(this.vel.y, 1.4), h.dir.z * 0.8);
    this.play('thugStumbleBack', { fade: 0.05, once: true, ts: 1.3 }); // limp jolt from each air hit
    this.flinch = 1;
  }
  knock(dir, speed, up, webbed = false) {
    this.set('knock'); this.airborne = true; this.knockWeb = webbed || this.web >= 0.99; this.turnRate = 22;
    this.vel.set(dir.x * speed, up, dir.z * speed);
    this.play('thugKnockdown', { fade: 0.06, once: true, ts: 1.1 });
    this.c.onEnemyInterrupted(this);
  }
  addWeb(amount, dir) {
    if (!this.alive) return;
    if (this.hasGun) { this.disarm(dir); amount *= 0.5; }
    this.web = Math.min(1, this.web + amount);
    if (this.type === 'brute' && this.web >= 0.6) this.stun = Math.max(this.stun, 3.2);
    // airborne / knocked enemies get pinned to the nearest wall; downed ones to the ground
    if (this.state === 'knock' || (this.state === 'air' && this.juggle <= 0)) {
      const w = this.c.findWall(this.chest(_v), dir, 5);
      if (w) { this.stickWall(w.point, w.normal); return; }
    }
    if (this.state === 'down' || this.state === 'out') { this.stickGround(); return; }
    // already cocooned: more webbing tips him over and pins him to the pavement (neutralised)
    if (this.state === 'webbed' && this.st > 0.15) { this.play('thugKnockdown', { fade: 0.1, once: true, ts: 1.3 }); this.stickGround(); return; }
    if (this.web >= 0.99 && this.state !== 'air' && this.state !== 'knock') {
      this.set('webbed'); this.webT = 7; this.play('thugWebbedStruggle', { fade: 0.18 });
      this.c.onEnemyInterrupted(this);
    }
  }
  disarm(dir) {
    if (!this.hasGun) return;
    this.hasGun = false; this.aimW = 0;
    const g = this.gun; this.gun = null; if (!g) return;
    this.c.throwAway(g, _v.copy(dir).multiplyScalar(-6).setY(4));
    if (this.state === 'aim' || this.state === 'fire') { this.set('hold'); this.c.releaseToken(this); }
    this.type = 'melee'; this.T = { ...TYPES.melee, scale: this.T.scale };
  }
  stickWall(point, normal) {
    this.stuck = 'wall'; this.set('stuck'); this.web = 1; this.vel.set(0, 0, 0);
    const n = _v2.set(normal.x, 0, normal.z).normalize();
    const gy = this.ground();
    this.root.position.set(point.x + n.x * 0.3, Math.max(point.y - 0.6, gy + 0.9), point.z + n.z * 0.3);
    this.yaw = Math.atan2(n.x, n.z); this.root.rotation.y = this.yaw; this.pitch = 0;
    this.play('thugWebbedStruggle', { fade: 0.12, ts: 0.45 }); // arms webbed to his sides, writhing slowly on the wall
    this.c.fx.splat(_v.set(point.x, this.root.position.y + 1.2 * this.T.scale, point.z), n, { size: 2.6 });
    this.c.fx.splat(_v.set(point.x, this.root.position.y + 0.45, point.z), n, { size: 1.4 });
    this.c.onEnemyOut(this, 'wall');
  }
  stickGround() {
    this.stuck = 'ground'; this.set('stuck'); this.web = 1;
    const p = this.pos; this.c.fx.splat(_v.set(p.x, this.ground() + 0.02, p.z).addScaledVector(_v2.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), 0.8), UP, { size: 2.1 });
    this.c.onEnemyOut(this, 'ground');
  }
  ground() { return this.c.ctx.world.groundHeight(this.pos.x, this.pos.z, this.pos.y + 1.0); }
  // horizontal move with wall collision (no walking through facades / props)
  moveXZ(dx, dz) {
    const L = Math.hypot(dx, dz); if (L < 1e-6) return null;
    const d = _v3.set(dx / L, 0, dz / L);
    const h = this.c.ctx.world.raycast(_v.set(this.pos.x, this.pos.y + 0.9, this.pos.z), d, L + 0.35);
    if (h && h.normal && Math.abs(h.normal.y) < 0.6) {
      const n = _v2.set(h.normal.x, 0, h.normal.z).normalize();
      const into = dx * n.x + dz * n.z;
      if (into < 0) { dx -= n.x * into; dz -= n.z * into; }
      const room = h.distance - 0.35; if (room < 0) { dx += n.x * -room; dz += n.z * -room; }
      this.pos.x += dx; this.pos.z += dz; return h;
    }
    this.pos.x += dx; this.pos.z += dz; return null;
  }
  // ------------------------------------------------------------------ per-frame
  update(dt) {
    const c = this.c, P = c.playerFeet;
    this.st += dt; this.cd -= dt; this.stun -= dt;
    this.flinch = Math.max(0, this.flinch - dt * 5);
    const dist = hdist(this.pos, P);
    const faceP = yawTo(this.pos, P);
    let moving = 0;
    // safety: never stay airborne / sliding forever (stuck on geometry, lost juggle)
    if ((this.state === 'knock' || this.state === 'air') && this.st > 3.5) { this.pos.y = this.ground(); if (this.actName !== 'thugKnockdown') this.play('thugKnockdown', { fade: 0.1, once: true, at: 0.6 }); this.landDown(); }
    if (this.faceYaw != null && this.turnRate) { this.yaw = dampAngle(this.yaw, this.faceYaw, this.turnRate, dt); if (Math.abs(angWrap(this.faceYaw - this.yaw)) < 0.02) this.turnRate = 0; }
    if (['stagger', 'knock', 'down', 'getup'].includes(this.state)) this.rootMotion();
    switch (this.state) {
      case 'hold': {
        const slot = c.slotFor(this);
        const to = _v.set(slot.x - this.pos.x, 0, slot.z - this.pos.z); const L = to.length();
        const far = L > 1.4;
        const sp = far ? (L > 6 ? this.T.speed * 1.5 : this.T.speed * 0.75) : Math.min(0.55, L * 1.5);
        // speed eases (no instant start / stop), clip picked from the actual speed
        const want = L > 0.15 ? sp : 0;
        this.spd = damp(this.spd || 0, want, want > (this.spd || 0) ? 5 : 8, dt);
        if (L > 0.15) { to.divideScalar(L); this.moveXZ(to.x * this.spd * dt, to.z * this.spd * dt); moving = this.spd; }
        this.yaw = dampAngle(this.yaw, far ? Math.atan2(to.x, to.z) : faceP, far ? 8 : 6, dt);
        this.locomote(this.spd > 0.9 || far ? this.spd : 0);
        break;
      }
      case 'approach': { // committed melee attack: close in, start the swing ~1 m out (he steps in during the wind-up)
        const reach = this.T.reach;
        const sp = dist > 4 ? 6.0 : 4.2;
        this.spd = damp(this.spd || 0, dist > reach + 0.9 ? sp : 2.2, 6, dt);
        if (dist > reach + 0.9) {
          const d = _v.set(P.x - this.pos.x, 0, P.z - this.pos.z).normalize();
          this.moveXZ(d.x * this.spd * dt, d.z * this.spd * dt); moving = this.spd;
          this.locomote(this.spd, 0.2);
        }
        this.yaw = dampAngle(this.yaw, faceP, 12, dt);
        if (dist <= reach + 1.0 && Math.abs(angWrap(faceP - this.yaw)) < 0.6) this.startSwing();
        else if (this.st > 2.4 || c.spidey.airborne) { this.set('hold'); c.releaseToken(this); }
        break;
      }
      case 'attack': {
        const a = this.act, hitT = HIT_T[this.atk] ?? 0.25, tele = TELE[this.atk] ?? 0.5;
        // telegraph: the wind-up (to hitT - 0.06) is stretched to fill the telegraph, then he snaps through the strike
        const k0 = hitT - 0.06;
        if (a) a.timeScale = a.time < k0 ? k0 / Math.max(0.05, tele - 0.06) : this.type === 'brute' ? 0.9 : 1.05;
        if (!this.swung) {
          this.yaw = dampAngle(this.yaw, faceP, this.st < tele * 0.6 ? 10 : 3, dt); // tracks him through the wind-up, then commits
          // step in: arrive at reach by the contact (a lunge step, not a slide across the street)
          const left = Math.max(0.06, tele - this.st), gap = dist - this.T.reach * 0.92;
          if (gap > 0.02) { const st = Math.min(gap, gap / left * dt, 3.6 * dt); const d = _v.set(P.x - this.pos.x, 0, P.z - this.pos.z).normalize(); this.moveXZ(d.x * st, d.z * st); }
        }
        if (!this.swung && a && a.time >= hitT) { this.swung = true; c.enemyStrike(this); }
        if (this.swung && a && a.time >= a.getClip().duration - 0.12) { this.set('hold'); this.play('thugIdle', { fade: 0.25 }); this.cd = rnd(1.3, 2.8) * (this.type === 'brute' ? 1.3 : 1); c.releaseToken(this); }
        break;
      }
      case 'aim': {
        this.yaw = dampAngle(this.yaw, faceP, 10, dt);
        this.aimW = Math.min(1, this.aimW + dt / 0.22);
        if (this.hasGun) this.play('thugGunAim', { fade: 0.22 }); else this.play('thugIdle', { fade: 0.2 });
        if (this.st >= this.aimDur) { this.set('fire'); this.shots = 0; this.nextShot = 0; }
        break;
      }
      case 'fire': {
        this.yaw = dampAngle(this.yaw, faceP, 10, dt);
        this.nextShot -= dt;
        if (this.nextShot <= 0 && this.shots < 3) { this.shots++; this.nextShot = 0.26; c.enemyShoot(this); if (this.hasGun) this.play('thugGunFire', { fade: 0.04, once: true, ts: 1.15 }); }
        if (this.shots >= 3 && this.st > 0.85) { this.set('hold'); this.play('thugIdle', { fade: 0.3 }); this.cd = rnd(2.6, 4.2); c.releaseToken(this); }
        break;
      }
      case 'yanked': {
        const Y = this.yk, u = clamp(this.st / Y.dur, 0, 1), e = u * u * (3 - 2 * u);
        const dd = e - Y.prev; Y.prev = e;
        if (dd > 0) this.moveXZ((Y.to.x - Y.from.x) * dd, (Y.to.z - Y.from.z) * dd);
        this.pos.y = this.ground() + Math.sin(Math.PI * u) * 0.28;
        if (this.st > Y.dur + 0.35) { this.set('stagger'); this.stagT = 0.4; this.play('thugStumbleBack', { fade: 0.12, once: true, ts: 1.2 }); } // no blow came
        break;
      }
      case 'stagger': {
        if (this.st > this.stagT) { this.set('hold'); this.play('thugIdle', { fade: 0.25 }); this.cd = Math.max(this.cd, rnd(0.8, 1.6)); }
        break;
      }
      case 'air': {
        // real gravity on the way up; near the apex a juggled enemy hangs (Spider-Man keeps him up with hits)
        this.juggle -= dt;
        const hang = this.juggle > 0 && this.vel.y < 1.5;
        this.vel.y -= (hang ? G * 0.12 : G) * dt;
        if (hang) this.vel.y = Math.max(this.vel.y, -1.0);
        this.vel.x *= Math.exp(-3 * dt); this.vel.z *= Math.exp(-3 * dt);
        this.moveXZ(this.vel.x * dt, this.vel.z * dt); this.pos.y += this.vel.y * dt;
        // lie back in the air while juggled; body rights itself as he falls
        this.pitch = damp(this.pitch, this.juggle > 0 ? -1.15 : -0.6, 6, dt);
        if (this.juggle <= 0 && !this.falling && this.vel.y < -1) { this.falling = true; this.play('thugKnockdown', { fade: 0.2, once: true, at: 0.3, ts: 1 }); }
        const gy = this.ground();
        if (this.pos.y <= gy && this.vel.y <= 0) {
          this.pos.y = gy; const sev = clamp(-this.vel.y / 16, 0.2, 1);
          c.fx.dust(this.pos, { amount: 0.5 + sev }); c.shake(0.12 * sev + 0.05); c.sfx('bodyfall', 0.4 + sev * 0.5);
          if (this.hp <= 0 && this.slammed !== false) this.hp = Math.min(this.hp, 0);
          if (this.actName !== 'thugKnockdown' || this.act.time < 0.5) this.play('thugKnockdown', { fade: 0.1, once: true, at: 0.62 });
          this.falling = false; this.landDown();
        }
        break;
      }
      case 'knock': {
        this.vel.y -= G * dt;
        const h = this.moveXZ(this.vel.x * dt, this.vel.z * dt);
        this.pos.y += this.vel.y * dt;
        if (h && Math.hypot(this.vel.x, this.vel.z) > 3) {
          if (this.knockWeb && this.c.isFacade(h)) { this.stickWall(h.point, h.normal); break; }
          if (this.knockWeb) { this.pos.y += 0.02; } else {
          c.fx.hit(_v.copy(this.chest(_v2)), _v3.set(h.normal.x, 0, h.normal.z), { heavy: 0.4, color: [2, 2, 2] }); c.shake(0.15);
          this.vel.x *= -0.25; this.vel.z *= -0.25; this.hp -= 6;
          }
        }
        const gy = this.ground();
        if (this.pos.y <= gy && this.vel.y <= 0) {
          this.pos.y = gy;
          const hs = Math.hypot(this.vel.x, this.vel.z);
          if (hs > 0.6) { this.vel.y = 0; this.vel.x *= Math.exp(-7 * dt); this.vel.z *= Math.exp(-7 * dt); if (!this.dusted) { this.dusted = true; c.fx.dust(this.pos, { amount: 0.8 }); c.sfx('bodyfall', 0.6); } }
          else this.landDown();
        }
        break;
      }
      case 'down': {
        this.pitch = damp(this.pitch, 0, 8, dt);
        if (this.st > this.downT) {
          if (this.hp <= 0) { this.out = true; this.set('out'); c.onEnemyOut(this, 'ko'); }
          else { this.set('getup'); this.play('thugGetUp', { fade: 0.15, once: true, ts: 1.1 }); } // rolls to his side, hands + knees, stands
        }
        break;
      }
      case 'getup': if (this.st > 1.4 / 1.1 - 0.12) { this.set('hold'); this.play('thugIdle', { fade: 0.25 }); this.cd = rnd(0.8, 1.8); } break;
      case 'webbed': {
        this.webT -= dt;
        if (this.webT <= 0) { this.web = 0.3; this.set('hold'); this.play('thugIdle', { fade: 0.3 }); }
        break;
      }
      case 'stuck': case 'out': this.pitch = damp(this.pitch, 0, 8, dt); break;
    }
    if (!['webbed', 'stuck', 'air', 'knock', 'down'].includes(this.state) && this.webT <= 0) this.web = Math.max(0, this.web - dt * 0.05);
    // ground follow when standing
    if (['hold', 'approach', 'attack', 'aim', 'fire', 'stagger', 'getup', 'webbed', 'down', 'out'].includes(this.state)) { // (not 'yanked': it sets its own height)
      const gy = this.ground(); this.pos.y = damp(this.pos.y, gy, 20, dt); this.pitch = damp(this.pitch, 0, 8, dt);
      const dyn = this.c.ctx.world.collideDynamic?.(this.pos, 0.34 * this.T.scale, 1.7); // parked / moving cars
      if (dyn?.push && !dyn.grounded) { this.pos.x += dyn.push.x; this.pos.z += dyn.push.z; }
    }
    this.root.rotation.y = this.yaw;
    this.moving = moving;
  }
  landDown() {
    if (this.knockWeb || this.web >= 0.95) { // webbed and landing near a facade: the web yanks him onto it
      const dir = this.vel.lengthSq() > 0.01 ? this.vel : new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const w = this.c.findWall(this.chest(new THREE.Vector3()), dir, 4.5);
      if (w) { this.stickWall(w.point, w.normal); return; }
    }
    this.set('down'); this.vel.set(0, 0, 0); this.airborne = false; this.dusted = false;
    this.downT = this.hp <= 0 ? 1.1 : rnd(1.3, 2.0);
    if (this.web >= 0.95 || this.knockWeb) { this.stickGround(); }
  }
  startSwing() {
    let atk = pick(this.T.attacks); if (atk === this.atk && Math.random() < 0.6) atk = pick(this.T.attacks);
    this.atk = atk; this.swung = false; this.loco = null;
    this.set('attack'); this.play(this.atk, { fade: 0.12, once: true, ts: 0.5 });
    this.c.threat(this, TELE[this.atk] ?? 0.5, this.type === 'brute' ? 'heavy' : 'melee');
  }
  // ------------------------------------------------------------------ procedural layer (after the mixer)
  late(dt) {
    const B = this.bones;
    // air / knock tumble about the pelvis
    const piv = 0.95;
    _q.setFromAxisAngle(X, this.pitch);
    this.inner.quaternion.copy(_q);
    this.inner.position.set(0, piv, 0).sub(_v.set(0, piv, 0).applyQuaternion(_q));
    // hit flinch: spine/head snap (additive on top of the clip)
    if (this.flinch > 0 && B.spine2) {
      const f = smooth(this.flinch);
      B.spine2.quaternion.multiply(_q.setFromAxisAngle(X, -0.35 * f)); if (B.head) B.head.quaternion.multiply(_q.setFromAxisAngle(_v.set(0, 0, 1), 0.3 * f * this.flinchDir));
    }
    // gunman: the two-handed aim clip points along his facing; pitch the chest toward Spider-Man (on a ledge / in the air)
    const aiming = this.hasGun && (this.state === 'aim' || this.state === 'fire');
    this.aimW = aiming ? this.aimW : Math.max(0, this.aimW - dt * 4);
    if (this.aimW > 0.01 && B.spine2) {
      const tgt = this.c.playerChest(_v2), sh = this.chest(_v3);
      const pitch = clamp(Math.atan2(tgt.y - sh.y, Math.max(1, hdist(tgt, sh))), -0.6, 0.9);
      this.aimP = damp(this.aimP || 0, pitch, 8, dt);
      B.spine2.quaternion.multiply(_q.setFromAxisAngle(X, -this.aimP * 0.8 * smooth(this.aimW)));
    }
    // helper bones follow their base bones (SPIDERMAN.md v3 contract)
    if (B.deltoidR && B.upperArmR) B.deltoidR.quaternion.slerpQuaternions(this.rest.deltoidR, B.upperArmR.quaternion, 0.5);
    this.root.updateMatrixWorld(true);
    // pistol in the right hand
    if (this.gun && B.handR) {
      B.handR.getWorldPosition(_v); B.handR.getWorldQuaternion(_q);
      const fwd = _v2.set(0, 1, 0).applyQuaternion(_q);
      this.gun.position.copy(_v).addScaledVector(fwd, 0.085 * this.T.scale);
      const up = _v3.copy(UP).addScaledVector(fwd, -fwd.y).normalize();
      const x = new THREE.Vector3().crossVectors(up, fwd).normalize();
      this.gun.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, fwd));
      this.gun.position.addScaledVector(up, -0.02);
    }
    this.cocoon.update(dt, this.web);
  }
  muzzle(out = new THREE.Vector3()) {
    if (this.gun) return out.copy(this.gun.userData.muzzle).applyMatrix4(this.gun.matrixWorld);
    return this.bones.handR ? this.bones.handR.getWorldPosition(out) : this.chest(out);
  }
  release() { // hand the actor back to the crime system (player left the area)
    this.actor.external = false; this.dispose(); if (!this.alive) return;
    this.actor.play('thugIdle', { fade: 0.3 });
  }
  dispose() {
    this.cocoon.dispose();
    if (this.gun) this.gun.parent?.remove(this.gun);
    this.inner.quaternion.identity(); this.inner.position.set(0, 0, 0);
  }
}

export { HIT_T, angWrap };
