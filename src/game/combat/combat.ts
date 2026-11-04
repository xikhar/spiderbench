// @ts-nocheck
// Insomniac-style street combat.
//   initCombat(ctx) — called from main.ts after the open-world systems (C5). Pushes one {update(dt)} into ctx.systems.
// Integration:
//   crime:engage (systems/crimes.ts) -> crime.claim(); the crime's thugs become combat enemies (actor.external = true),
//     reinforcements run in (gunmen, a brute at bank robberies), throwable props appear around the scene
//   all enemies down / webbed -> emit('crime:cleared', {id})
//   player.setControlOverride(fn) (C5) takes over Spider-Man's input + motion while a fight is on; combat animation is a
//     pose layer on top of the animation layer's output (combatPoseLayer.ts)
//   ctx.timeScale (main.ts) = hit-stop / slow-mo; world.alarm(pos, r) makes civilians flee; emits 'crime:zone' {pos, radius}
// Debug (console / playtests): __cmb.debug.fight('mmgb', dist)  (m melee, g gunman, b brute) · __cmb.debug.state()
//   __cmb.debug.focus(n) · __cmb.debug.hp(n) · __cmb.debug.webAll() · __cmb.state (live)
import * as THREE from "three";
import { on, emit } from "../systems/events.ts";
import { createFx } from "./combatEffects.ts";
import { Enemy } from "./enemy.ts";
import { createCombatCharacter } from "./combatCharacter.ts";
import { createProps } from "./props.ts";
import { createHud } from "./hud.ts";
import { createCombatInput } from "./input.ts";
import {
  clamp,
  smoothstep01,
  dampValue,
  lerp,
  wrapAngle,
  yawToTarget,
  horizontalDistance,
  randomBetween,
  WORLD_UP,
} from "./combatMath.ts";
import { assetUrl } from "../../assets.ts";
import { loadKTX2TextureAsync } from "../../render/ktx2.ts";

const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _v3 = new THREE.Vector3(),
  _v4 = new THREE.Vector3();
const H = 0.95;

export function initCombat(ctx) {
  if (ctx.combat) return ctx.combat;
  const sys = ctx.sys;
  const P = ctx.player;
  const c = {
    ctx,
    sys,
    time: 0,
    enemies: [],
    threats: [],
    fight: null,
    combo: { n: 0, t: 0 },
    slowK: 0,
    playerFeet: new THREE.Vector3(),
    meleeToken: null,
    gunToken: null,
    globalCd: 0,
    gunCd: 0,
    pendingShot: null,
    loose: [],
    camW: 0,
    cineS: null,
    warnCount: 0,
  };
  ctx.combat = c;
  c.fx = createFx(ctx);
  c.rtime = 0;
  c.input = createCombatInput(
    () => c.rtime,
    () => c.time,
  );
  c.props = createProps(c);
  c.hud = createHud(c);
  c.combatCharacter = createCombatCharacter(c);
  const me = c.combatCharacter;
  // brute texture (public/enemies, built by tools/blender/enemy_tex.py); tint fallback if missing
  loadKTX2TextureAsync(assetUrl("enemies/brute_basecolor.webp"))
    .then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = false;
      t.anisotropy = 4;
      c.bruteTex = t;
    })
    .catch(() => {});

  c.sfx = (k, a) => {
    try {
      const s = sys?.audio?.sfx;
      if (!s) return;
      if (k === "land") s.land(a);
      else if (k === "whoosh") s.whoosh(a);
      else if (k === "thwip") s.thwip(a);
      else if (k === "deny") s.deny?.();
      else s[k]?.(a);
    } catch (e) {
      /* audio optional */
    }
  }; // (audio r1) + hit / hurt / shot / slam
  c.shake = (a) => P.cam?.shake?.(a);
  c.playerChest = (out) => out.copy(P.position).setY(P.position.y + 0.45);

  // ------------------------------------------------------------------ time scale (hit-stop / slow-mo), real-time based
  const timeReq = [];
  c.hitStop = (dur, scale = 0.04) =>
    timeReq.push({ until: c.rtime + dur, scale, kind: "stop" });
  c.slowmo = (dur, scale = 0.3, ease = 0.25) =>
    timeReq.push({
      start: c.rtime,
      until: c.rtime + dur,
      scale,
      ease,
      kind: "slow",
    });
  function updateTime() {
    const now = c.rtime;
    let sc = 1,
      slow = 0;
    for (let i = timeReq.length - 1; i >= 0; i--) {
      const r = timeReq[i];
      if (now >= r.until) {
        timeReq.splice(i, 1);
        continue;
      }
      let s = r.scale;
      if (r.kind === "slow") {
        const left = r.until - now;
        const k = smoothstep01(left / r.ease);
        s = 1 - (1 - r.scale) * k;
        slow = Math.max(slow, 1 - s);
      }
      sc = Math.min(sc, s);
    }
    ctx.timeScale = sc;
    c.slowK = slow;
  }

  // ------------------------------------------------------------------ targeting
  // dir: preferred direction (stick, camera-relative; falls back to camera forward). minD: web strike minimum distance.
  c.pickTarget = (dir, maxD, from, minD = 0, needView = false) => {
    let want =
      dir && dir.lengthSq() > 0.04
        ? _v.copy(dir).setY(0).normalize()
        : P.cam.forwardFlat(_v);
    let best = null,
      bs = Infinity;
    for (const e of c.enemies) {
      if (!e.targetable) continue;
      const d = horizontalDistance(from, e.pos);
      if (d > maxD || d < minD) continue;
      if (Math.abs(e.pos.y - from.y) > 6 && e.state !== "air") continue;
      if (e.state === "air" && e.pos.y - from.y > 1.2 && !me.airborne) continue; // juggled enemies are only reachable from the air
      const to = _v2.set(e.pos.x - from.x, 0, e.pos.z - from.z).normalize();
      const ang = Math.acos(clamp(to.dot(want), -1, 1));
      if (needView && ang > (needView === true ? 1.25 : needView)) continue; // needView: true = 72 deg cone, or the half-angle (rad)
      let sc = d * 0.6 + ang * 3.2;
      if (e === me.target) sc -= 1.2;
      if (e.state === "attack" || e.state === "approach") sc -= 0.4;
      if (sc < bs) {
        bs = sc;
        best = e;
      }
    }
    return best;
  };
  // a hit is a facade (not a bin / lamp post) if the surface continues ~1.2 m higher at the same depth
  c.isFacade = (h) => {
    const n = new THREE.Vector3(h.normal.x, 0, h.normal.z);
    if (n.lengthSq() < 0.25) return false;
    n.normalize();
    const side = new THREE.Vector3(-n.z, 0, n.x),
      back = n.clone().negate(),
      o = new THREE.Vector3();
    // the surface must continue above and to both sides at about the same depth (not a pole / bin / hydrant)
    let ok = 0;
    for (const [sx, sy] of [
      [0, 1.4],
      [0.9, 0.2],
      [-0.9, 0.2],
      [0, 2.4],
    ]) {
      o.copy(h.point).addScaledVector(n, 0.6).addScaledVector(side, sx);
      o.y += sy;
      const h2 = ctx.world.raycast(o, back, 2.2);
      if (h2 && h2.distance < 1.8) ok++;
    }
    return ok >= 3; // tall and wide (storefront recesses allowed), unlike poles / bins / hydrants
  };
  c.findWall = (pos, dir, maxD) => {
    const d0 = _v3.set(dir.x, 0, dir.z);
    if (d0.lengthSq() < 1e-4) return null;
    d0.normalize();
    let best = null;
    for (const a of [0, 0.5, -0.5, 1.0, -1.0]) {
      const d = _v4.copy(d0).applyAxisAngle(WORLD_UP, a);
      const h = ctx.world.raycast(pos, d, maxD);
      if (
        h &&
        h.normal &&
        Math.abs(h.normal.y) < 0.5 &&
        (!best || h.distance < best.distance) &&
        c.isFacade(h)
      )
        best = {
          point: h.point.clone(),
          normal: h.normal.clone(),
          distance: h.distance,
        };
    }
    return best;
  };

  // ------------------------------------------------------------------ threats / spider-sense
  c.threat = (e, lead, kind) => {
    c.threats.push({ e, at: c.time + lead, kind, hinted: false });
  };
  c.clearThreats = (e) => {
    c.threats = c.threats.filter((t) => t.e !== e);
  };
  c.nearestThreat = () => {
    let b = null;
    for (const t of c.threats) {
      const r = t.at - c.time;
      if (r < -0.08 || r > 0.8) continue;
      if (!b || t.at < b.at) b = t;
    }
    return b;
  };
  c.releaseToken = (e) => {
    if (c.meleeToken === e) {
      c.meleeToken = null;
      c.globalCd = randomBetween(0.35, 0.9);
    }
    if (c.gunToken === e) {
      c.gunToken = null;
      c.gunCd = randomBetween(1.2, 2.4);
    }
  };
  c.onEnemyInterrupted = (e) => {
    c.releaseToken(e);
    c.clearThreats(e);
  };
  c.onDodge = (t, perfect) => {
    if (perfect) {
      c.slowmo(0.85, 0.22, 0.35);
      c.hud.banner("PERFECT DODGE");
      me.focus = Math.min(3, me.focus + 0.35);
      P.cam?.impact?.(0.15);
      c.fx.setSense(1, t?.kind === "gun" ? 1 : 0);
    }
  };

  // ------------------------------------------------------------------ hits dealt by Spider-Man
  // melee blows only connect in reach: Spider-Man's body within h.reach (default 1.9 m, brutes +0.3) of the enemy, both
  // horizontally and in height. A blow that would land from further away (the target was knocked / stepped away, or the
  // move could not close the gap) whiffs instead of hitting through the air.
  const MELEE = new Set([
    "light",
    "ender",
    "launch",
    "strike",
    "air",
    "slam",
    "finisher",
  ]);
  c.playerHit = (e, h) => {
    if (!e || !e.alive) return;
    if (MELEE.has(h.kind) && !h.from) {
      const lim = (h.reach ?? 1.9) + (e.type === "brute" ? 0.3 : 0),
        dy = P.position.y - H - e.pos.y;
      if (horizontalDistance(P.position, e.pos) > lim || dy > 2.4 || dy < -1.2) {
        c.sfx("whoosh", 8);
        return;
      }
    }
    const from = h.from || P.position;
    const dir = _v.set(e.pos.x - from.x, 0, e.pos.z - from.z);
    if (dir.lengthSq() < 1e-4)
      dir.set(Math.sin(P.state.facing), 0, Math.cos(P.state.facing));
    dir.normalize();
    const r = e.hit({
      dmg: h.dmg,
      dir: dir.clone(),
      kind: h.kind,
      stunBrute: h.stunBrute,
      side: h.side || 0,
    });
    if (!r) return;
    const heavy = r.armored ? 0.1 : h.heavy || 0;
    const cp = e.chest(_v2).addScaledVector(dir, -0.28);
    if (h.kind === "air" || h.kind === "slam" || e.state === "air")
      cp.y = e.pos.y + 1.0;
    if (!h.silent) {
      c.fx.hit(cp, _v3.copy(dir).negate(), {
        heavy,
        color: r.armored ? [3, 3, 3.4] : undefined,
      });
      // impact: light hits dip time for 2 frames (0.15x, not a freeze), heavy ones hold ~4 frames; a full stop on every
      // jab read as stutter
      if (h.kind === "finisher") c.hitStop(0.12, 0.05);
      else if (heavy > 0.5) c.hitStop(0.065, 0.08);
      else c.hitStop(0.035, 0.15);
      c.shake(0.05 + heavy * 0.25);
      if (heavy > 0.5) P.cam?.impact?.(0.12 + heavy * 0.15);
      c.sfx("hit", heavy);
      if (!r.armored) {
        c.combo.n++;
        c.combo.t = 0;
      }
      if (heavy > 0.5) {
        c.camPunchT = 0;
        c.camPunchDir = dir.clone();
        c.fx.smear(cp, dir, heavy);
      }
      const mult = 1 + Math.min(1, c.combo.n / 15);
      me.focus = Math.min(3, me.focus + (heavy > 0.5 ? 0.14 : 0.075) * mult);
    }
  };
  c.groundPound = (p) => {
    c.fx.dust(p, { amount: 1.4 });
    c.shake(0.35);
    P.cam?.impact?.(0.35);
    c.sfx("slam");
    for (const e of c.enemies)
      if (e.alive && e.state !== "air" && horizontalDistance(e.pos, p) < 2.8)
        c.playerHit(e, {
          kind: "ender",
          dmg: 8,
          heavy: 0.4,
          reach: 3.2,
          silent: true,
        });
  };
  c.heal = (n) => {
    me.hp = Math.min(me.maxHp, me.hp + n);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      c.fx.add.emit({
        pos: _v.set(
          P.position.x + Math.cos(a) * 0.6,
          P.position.y - 0.6 + Math.random() * 0.4,
          P.position.z + Math.sin(a) * 0.6,
        ),
        vel: _v2.set(0, randomBetween(1.5, 3), 0),
        life: 0.8,
        size: 0.06,
        size1: 0.02,
        color: [1.5, 3.5, 2],
        tile: 0,
        drag: 1,
      });
    }
    c.hud.flash("Healed");
    c.sfx("thwip", 0.6);
  };
  c.cine = (target, dur, kind = "finisher") => {
    c.cineS = { target, t: 0, dur, side: null, kind };
    if (kind === "finisher") c.slowmo(1.2, 0.45, 0.4);
    else c.slowmo(0.7, 0.4, 0.3);
  };
  c.throwAway = (obj, vel) => {
    c.loose.push({ obj, vel: vel.clone(), t: 0 });
  };
  // loss condition: Spider-Man knocked out -> the crime fails, the thugs scatter, he gets back up at full health
  c.onPlayerDefeated = () => {
    const f = c.fight;
    c.hud.banner("DEFEATED");
    if (!f) return;
    if (f.crime) {
      const cr = f.crime;
      releaseFight(true);
      emit("crime:resolve", { id: cr.id, success: false });
    } else {
      endFight(false);
    }
  };
  c.onPlayerRecovered = () => {
    for (const e of c.enemies) e.cd = Math.max(e.cd, randomBetween(1.5, 3));
    c.hud.flash("Back on your feet");
  };
  c.onEnemyOut = (e, how) => {
    c.releaseToken(e);
    c.clearThreats(e);
    e.actor.hp = 0;
    e.actor.down = true;
    e.actor.alive = false; // crime records (crimes.active.thugs[])
    if (how === "wall") c.cine(e, 1.0, "pin");
    if (how === "wall" || how === "ground") {
      c.shake(0.12);
      c.fx.webHit(e.chest(_v), _v2.set(0, -1, 0));
      c.sfx("thwip", 1.3);
    }
    if (how === "wall" && e.state === "stuck")
      me.focus = Math.min(3, me.focus + 0.2);
  };

  // ------------------------------------------------------------------ hits dealt by enemies
  c.enemyStrike = (e) => {
    c.clearThreats(e);
    const pf = c.playerFeet;
    const d = horizontalDistance(e.pos, pf),
      dy = Math.abs(pf.y - e.pos.y);
    const inReach = d <= e.T.reach + 0.75 && dy < 1.1;
    if (!inReach || me.invuln()) {
      c.sfx("whoosh", 10);
      return;
    }
    const heavy =
      e.type === "brute" || (e.atk === "kick" && Math.random() < 0.3);
    const dmg = e.T.dmg * (heavy && e.type !== "brute" ? 1.3 : 1);
    me.takeHit(e, dmg, heavy);
    c.fx.hit(
      _v.copy(P.position).setY(P.position.y + 0.5),
      _v2.set(pf.x - e.pos.x, 0, pf.z - e.pos.z).normalize(),
      { heavy: heavy ? 0.6 : 0.2, color: [5, 2, 1.5] },
    );
    c.hitStop(heavy ? 0.08 : 0.045, heavy ? 0.06 : 0.12);
    c.shake(heavy ? 0.4 : 0.22);
    if (heavy) P.cam?.impact?.(0.3);
    c.hud.hurt(heavy ? 0.4 : 0.1);
    c.combo.n = 0;
    c.sfx("hurt", heavy);
  };
  c.enemyShoot = (e) => {
    const mz = e.muzzle(_v);
    const chest = c.playerChest(_v2);
    const dir = _v3.subVectors(chest, mz).normalize();
    c.fx.muzzle(mz, dir);
    const blocked = ctx.world.raycast(mz, dir, mz.distanceTo(chest) - 0.5);
    const miss = me.invuln() || blocked || (me.airborne && Math.random() < 0.6);
    const end = miss
      ? chest
          .clone()
          .add(_v4.set(randomBetween(-1, 1), randomBetween(-0.4, 1), randomBetween(-1, 1)))
          .addScaledVector(dir, 6)
      : chest;
    c.fx.tracer(mz, end);
    c.sfx("shot");
    if (e.shots >= 3) c.clearThreats(e);
    if (miss) return;
    me.hp = Math.max(0, me.hp - e.T.dmg);
    c.fx.hit(chest, dir.clone().negate(), { heavy: 0.05, color: [5, 2, 1.2] });
    c.hud.hurt(0.08);
    c.shake(0.1);
    c.combo.n = 0;
    if ((me.isFree() && !me.airborne) || me.hp <= 0)
      me.takeHit(e, 0, me.hp <= 0);
  };

  // ------------------------------------------------------------------ fight lifecycle
  const actorsApi = () => sys?.crimes?.actors;
  function wrap(actor, type) {
    const e = new Enemy(c, actor, type);
    c.enemies.push(e);
    return e;
  }
  async function reinforce(center, types, near) {
    const A = actorsApi();
    if (!A) return;
    await A.ready();
    types.forEach((type, i) => {
      // run in from 12-18 m away, from a direction with a clear line to the fight
      let pos = null;
      for (let k = 0; k < 16 && !pos; k++) {
        const a = Math.random() * Math.PI * 2,
          r = randomBetween(11, 17);
        const x = center.x + Math.cos(a) * r,
          z = center.z + Math.sin(a) * r,
          gy = ctx.world.groundHeight(x, z, center.y + 2);
        if (Math.abs(gy - center.y) > 0.6) continue;
        const d = _v.set(x - center.x, 0, z - center.z);
        const L = d.length();
        d.normalize();
        if (ctx.world.raycast(_v2.set(center.x, center.y + 1, center.z), d, L))
          continue;
        pos = new THREE.Vector3(x, gy, z);
      }
      if (!pos)
        pos = near.clone().add(new THREE.Vector3(randomBetween(-4, 4), 0, randomBetween(-4, 4)));
      const variant =
        type === "gunman" ? "a" : type === "brute" ? "c" : ["a", "b"][i % 2];
      const a = A.spawn({
        pos,
        yaw: yawToTarget(pos, center),
        variant,
        role: "thug",
      });
      if (!a) return;
      a.combatSpawned = true;
      const e = wrap(a, type);
      e.cd = randomBetween(1.2, 2.5);
      if (c.fight) c.fight.spawned.push(a);
    });
  }
  function startFight({
    crime = null,
    center,
    actors = [],
    types = [],
    extra = [],
  }) {
    if (c.fight) endFight(false);
    c.fight = {
      crime,
      center: center.clone(),
      t: 0,
      clearT: 0,
      spawned: [],
      alarmT: 0,
      far: 0,
    };
    actors.forEach((a, i) => wrap(a, types[i] || "melee"));
    if (extra.length) reinforce(center, extra, P.position);
    c.props.spawnAround(center, 3);
    c.combo.n = 0;
    me.hp = Math.max(me.hp, 60);
    c.warnCount = 0;
    engage(true);
    c.hud.show(true);
  }
  function engage(on) {
    if (on === c.engaged) return;
    c.engaged = on;
    c.input.enabled = on;
    c.input.clear();
    P.setControlOverride?.(on ? me.override : null);
    emit("combat:engaged", { engaged: on, crime: c.fight?.crime?.id || null });
    if (!on) {
      me.reset();
      ctx.timeScale = 1;
    }
  }
  function endFight(won) {
    const f = c.fight;
    if (!f) return;
    c.fight = null;
    engage(false);
    c.combo.n = 0;
    c.threats.length = 0;
    c.meleeToken = c.gunToken = null;
    if (won && f.crime) emit("crime:cleared", { id: f.crime.id });
    emit("crime:zone", {
      id: f.crime?.id || "cmb-fight",
      pos: f.center.clone(),
      radius: 15,
      active: false,
      type: f.crime?.type || "fight",
    });
    if (won) {
      c.hud.banner("AREA CLEAR");
      c.slowmo(0.8, 0.35, 0.5);
    }
    setTimeout(() => {
      if (!c.fight) c.hud.show(false);
    }, 3500);
    c.leftovers = { t: 0, center: f.center, spawned: f.spawned };
  }
  // player left the scene: give the crime back to the systems layer (its fallback / expiry logic takes over)
  function releaseFight(defeated = false) {
    const f = c.fight;
    if (!f) return;
    const cr = f.crime;
    c.fight = null;
    engage(false);
    c.combo.n = 0;
    c.threats.length = 0;
    c.meleeToken = c.gunToken = null;
    if (cr && !defeated) {
      cr.claimed = false;
      emit("crime:zone", {
        id: cr.id,
        pos: f.center.clone(),
        radius: 15,
        active: true,
        type: cr.type,
      });
    }
    for (const e of c.enemies) {
      if (e.alive && (defeated || !e.actor.combatSpawned)) {
        e.release();
        if (defeated) {
          const away = e.pos
            .clone()
            .sub(P.position)
            .setY(0)
            .normalize()
            .multiplyScalar(50)
            .add(e.pos);
          e.actor.runTo(away, 6.2);
        }
      } else e.dispose();
    }
    for (const a of f.spawned) {
      if (defeated && a.external === false && a.move)
        setTimeout(() => a.dispose?.(), 9000);
      else a.dispose?.();
    }
    c.enemies.length = 0;
    c.props.clear();
    c.hud.show(false);
  }
  function disposeLeftovers() {
    const L = c.leftovers;
    if (!L) return;
    for (const e of c.enemies) e.dispose();
    c.enemies.length = 0;
    for (const a of L.spawned) a.dispose?.();
    c.props.clear();
    c.fx.clear();
    for (const l of c.loose) l.obj.parent?.remove(l.obj);
    c.loose.length = 0;
    c.leftovers = null;
  }
  on("crime:engage", (crime) => {
    if (!crime || crime.type === "carChase" || !crime.enemies?.length) return;
    crime.claim();
    if (c.leftovers) disposeLeftovers();
    const actors = crime.enemies.map((x) => x.actor).filter(Boolean);
    const bank = crime.type === "bankAlarm";
    const types = actors.map((a, i) => (bank && i === 1 ? "gunman" : "melee"));
    if (bank && actors[1]) attachGunLater(actors[1]);
    startFight({
      crime,
      center: crime.pos,
      actors,
      types,
      extra: bank ? ["gunman", "brute", "melee"] : ["melee", "gunman"],
    });
  });
  function attachGunLater() {
    /* the Enemy constructor adds the pistol for gunmen */
  }
  on("crime:failed", (cr) => {
    if (c.fight?.crime === cr) endFight(false);
  });
  // the systems watchdog may resolve the crime early (it only counts the crime's own thugs): keep fighting the rest,
  // just don't emit a second clear for it
  on("crime:resolved", (cr) => {
    if (c.fight?.crime === cr) c.fight.crime = null;
  });
  on("crime:expired", (cr) => {
    if (c.fight?.crime === cr) endFight(false);
  });
  // dev menu: the crime was removed outright -> drop the fight and every combat-spawned body / prop at once
  on("crime:cancelled", (cr) => {
    if (c.fight?.crime === cr) {
      endFight(false);
      disposeLeftovers();
      c.hud.show(false);
    }
  });

  // ------------------------------------------------------------------ director: slots, tokens, attacks
  const slots = new Map();
  function director(dt) {
    const pf = c.playerFeet;
    c.globalCd -= dt;
    c.gunCd -= dt;
    const standing = c.enemies.filter(
      (e) =>
        e.alive &&
        [
          "hold",
          "approach",
          "attack",
          "aim",
          "fire",
          "stagger",
          "getup",
        ].includes(e.state),
    );
    // surround: spread melee enemies around the player at ~3 m, gunmen at ~10 m
    for (const group of [
      standing.filter((e) => e.type !== "gunman"),
      standing.filter((e) => e.type === "gunman"),
    ]) {
      if (!group.length) continue;
      const gun = group[0].type === "gunman";
      const items = group.map((e) => ({
        e,
        a: Math.atan2(e.pos.x - pf.x, e.pos.z - pf.z),
      }));
      const minSep = gun ? 0.7 : Math.min((Math.PI * 2) / items.length, 1.25);
      for (let it = 0; it < 4; it++)
        for (let i = 0; i < items.length; i++)
          for (let j = i + 1; j < items.length; j++) {
            const d = wrapAngle(items[j].a - items[i].a);
            if (Math.abs(d) < minSep) {
              const push = (minSep - Math.abs(d)) * 0.5 * (d >= 0 ? 1 : -1);
              items[i].a -= push;
              items[j].a += push;
            }
          }
      items.forEach((o, i) => {
        let r = gun
          ? 9.5 + (i % 2) * 1.5
          : o.e.type === "brute"
            ? 3.6
            : 3.0 + (i % 2) * 0.7;
        if (me.airborne && !gun) r += 1.2;
        const d = _v.set(Math.sin(o.a), 0, Math.cos(o.a));
        const h = ctx.world.raycast(_v2.set(pf.x, pf.y + 1, pf.z), d, r + 0.6);
        if (h) r = Math.max(1.8, h.distance - 0.8);
        const s = slots.get(o.e) || new THREE.Vector3();
        s.set(pf.x + d.x * r, pf.y, pf.z + d.z * r);
        slots.set(o.e, s);
      });
    }
    if (me.moveName() === "down" || me.moveName() === "finisher") return;
    // melee token: one committed attacker at a time (brutes attack a bit more often when close)
    if (!c.meleeToken && c.globalCd <= 0 && !me.airborne) {
      let best = null,
        bs = Infinity;
      for (const e of standing) {
        if ((e.type === "gunman" && e.hasGun) || e.state !== "hold" || e.cd > 0)
          continue;
        const d = horizontalDistance(e.pos, pf);
        if (d > 9) continue;
        const sc = d + Math.random() * 2;
        if (sc < bs) {
          bs = sc;
          best = e;
        }
      }
      if (best) {
        c.meleeToken = best;
        best.set("approach");
      }
    }
    if (!c.gunToken && c.gunCd <= 0) {
      for (const e of standing) {
        if (!e.hasGun || e.state !== "hold" || e.cd > 0) continue;
        const d = horizontalDistance(e.pos, pf);
        if (d > 24 || d < 2.5) continue;
        const from = _v.copy(e.pos).setY(e.pos.y + 1.4),
          to = c.playerChest(_v2);
        const dir = _v3.subVectors(to, from);
        const L = dir.length();
        dir.normalize();
        if (ctx.world.raycast(from, dir, L - 0.5)) continue;
        c.gunToken = e;
        e.set("aim");
        e.aimDur = 0.95;
        c.threat(e, 0.95, "gun");
        break;
      }
    }
  }
  c.slotFor = (e) => slots.get(e) || c.playerFeet;

  // ------------------------------------------------------------------ web shooter projectiles
  const shots = [];
  function fireWeb(target) {
    const from = P.rig.handWorld("R", new THREE.Vector3());
    const rb = c.fx.ribbon({ width: 0.012 });
    shots.push({ pos: from.clone(), target, rb, t: 0, hit: false, fade: 0 });
    c.sfx("thwip", 1.1);
  }
  function updateShots(dt) {
    const cp = ctx.camera.position;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.t += dt;
      const hand = P.rig.handWorld("R", _v4);
      if (!s.hit) {
        const to = s.target.chest(_v);
        const d = _v2.subVectors(to, s.pos);
        const L = d.length();
        const step = 48 * dt;
        if (L <= step || s.t > 1) {
          s.hit = true;
          s.pos.copy(to);
          if (s.target.alive) {
            s.target.addWeb(0.34, d.normalize().clone());
            c.fx.webHit(to, d);
            me.focus = Math.min(3, me.focus + 0.03);
          }
        } else s.pos.addScaledVector(d.normalize(), step);
        c.fx.add.emit({
          pos: s.pos,
          life: 0.04,
          size: 0.12,
          color: [2.6, 2.7, 2.9],
          tile: 0,
        });
        s.rb.set(hand, s.pos, cp, { opacity: 0.9, sag: 0 });
      } else {
        s.fade += dt / 0.14;
        if (s.fade >= 1) {
          c.fx.freeRibbon(s.rb);
          shots.splice(i, 1);
          continue;
        }
        s.rb.set(hand, s.pos, cp, {
          opacity: 0.9 * (1 - s.fade),
          sag: 0.15 * s.fade,
        });
      }
    }
  }

  // ------------------------------------------------------------------ combat camera layer (post chase-camera)
  // Only while he fights on (or next to) the ground with enemies close: traversal around / above the fight keeps the
  // plain chase camera. Pulls back and lifts with the spread of the fight so the threats around him stay in frame,
  // shifts sideways toward the crowd (smoothed: no per-frame re-centring jitter), punches in on heavy hits, keeps the
  // lens out of walls / cars / bodies. The player owns the orbit; when they leave the mouse alone for a moment and an
  // attacker is winding up off-screen, the yaw drifts gently to bring him in.
  const camPivot = new THREE.Vector3(),
    camProbe = new THREE.Vector3(),
    camWant = new THREE.Vector3(),
    camDir = new THREE.Vector3();
  const camFrame = new THREE.Vector3();
  const _cr = new THREE.Vector3(),
    _cu = new THREE.Vector3(),
    _cf = new THREE.Vector3();
  function combatCamera(realDt) {
    const cam = ctx.camera;
    const pc = P.position;
    let nearD = Infinity,
      spread = 0,
      n = 0;
    const cen = camProbe.set(0, 0, 0);
    for (const e of c.enemies) {
      if (!e.alive) continue;
      const d = horizontalDistance(e.pos, pc);
      nearD = Math.min(nearD, d);
      if (d > 12) continue;
      const k = e.type === "gunman" ? 0.5 : 1;
      n += k;
      cen.x += e.pos.x * k;
      cen.z += e.pos.z * k;
      spread = Math.max(spread, d * (e.type === "gunman" ? 0.7 : 1));
    }
    const grounded = P.mode === "ground" || me.busy();
    const want = c.fight && c.engaged && grounded && nearD < 14 ? 1 : 0;
    c.camW = dampValue(c.camW, want, want ? 2.0 : 1.3, realDt);
    const w = smoothstep01(c.camW);
    // heavy-hit push-in envelope: eases in over 0.15 s, out over 0.45 s (it used to start at full strength: a 0.5 m cut)
    c.camPunchT = (c.camPunchT ?? 9) + realDt;
    c.camPunch =
      c.camPunchT < 0.15
        ? smoothstep01(c.camPunchT / 0.15)
        : 1 - smoothstep01((c.camPunchT - 0.15) / 0.45);
    if (w > 0.002) {
      const air = me.airborne || P.mode === "air";
      const fwd = cam.getWorldDirection(_cf);
      _cr.set(1, 0, 0).applyQuaternion(cam.quaternion);
      _cu.set(0, 1, 0).applyQuaternion(cam.quaternion);
      // distance: pulled back with the spread of the fight, smoothed; an air juggle pulls back and lifts further so the
      // juggled enemy is in frame beside him, not hidden above his head
      const juggle =
        ["air", "airStrike", "slamDown"].includes(me.moveName()) ||
        (me.moveName() === "launch" && me.M.rise);
      c.camAir = dampValue(
        c.camAir || 0,
        juggle ? 1 : air ? 0.4 : 0,
        juggle ? 3 : 1.5,
        realDt,
      );
      const wantExtra =
        clamp(0.35 + (spread - 3) * 0.16, 0.2, 1.5) + c.camAir * 1.1;
      c.camExtra = dampValue(c.camExtra ?? wantExtra, wantExtra, 1.6, realDt);
      const wantP = camWant
        .copy(cam.position)
        .addScaledVector(fwd, -c.camExtra * w);
      wantP.y += (0.3 + c.camAir * 0.9) * w;
      if (c.camAir > 0.01 && me.target) {
        // step round toward the enemy's side: parallax opens the pair up side by side
        const tp = me.target.pos;
        const lat = (tp.x - pc.x) * _cr.x + (tp.z - pc.z) * _cr.z;
        c.camSide = dampValue(c.camSide || 0, lat >= 0 ? 1 : -1, 2, realDt);
        wantP.addScaledVector(_cr, c.camSide * 1.0 * c.camAir * w);
      }
      // heavy hit: short push-in toward the impact
      if (c.camPunch > 0) wantP.addScaledVector(fwd, 0.25 * c.camPunch * w);
      // sideways toward the crowd (world-space offset, spring-smoothed, lateral only)
      const off = n
        ? _v.set(cen.x / n - pc.x, 0, cen.z / n - pc.z).multiplyScalar(0.22)
        : _v.set(0, 0, 0);
      if (off.length() > 1.6) off.setLength(1.6);
      camFrame.x = dampValue(camFrame.x, off.x, 2.2, realDt);
      camFrame.z = dampValue(camFrame.z, off.z, 2.2, realDt);
      wantP.addScaledVector(_cr, camFrame.dot(_cr) * w);
      // world collision from the body
      const pivot = camPivot.copy(pc);
      pivot.y += 0.5;
      const toCam = camDir.subVectors(wantP, pivot);
      const Lc = toCam.length();
      toCam.normalize();
      // HARD occluders (walls, poles, cars): raw clearance along the lens ray (buffered below: the lens eases in toward
      // 0.6 m short of the obstacle and is only clamped at 0.12 m short of it, so a car / pole crossing the ray is not
      // a 1-2 m cut)
      let raw = Lc + 0.6;
      const h = ctx.world.raycast(pivot, toCam, Lc + 0.9);
      if (h) raw = Math.min(raw, h.distance);
      for (let t = 0.8; t < raw; t += 0.35) {
        // cars (dynamic, not in world.raycast)
        const q = _v2.copy(pivot).addScaledVector(toCam, t);
        const dyn = ctx.world.collideDynamic?.(
          _v4.set(q.x, q.y - 0.9, q.z),
          0.35,
          1.2,
        );
        if (dyn && dyn.push && dyn.push.lengthSq() > 1e-4) {
          raw = Math.min(raw, t);
          break;
        }
      }
      const limH = Math.max(0.6, raw - 0.12),
        tgtH = Math.max(0.6, raw - 0.6);
      c.camHard = Math.min(
        limH,
        dampValue(
          c.camHard ?? tgtH,
          tgtH,
          tgtH < (c.camHard ?? tgtH) ? 12 : 2.5,
          realDt,
        ),
      );
      let allow = Math.min(Lc, c.camHard);
      // SOFT occluders (bodies, street-tree trunks): the lens may sit in them for a moment, so it eases in (~0.25 s)
      // instead of cutting 2-3 m closer in one frame; walls / cars above stay instant (never inside geometry)
      const hard = allow;
      // enemies (incl. big brutes, cocoons and pinned bodies) between lens and Spidey: pull in only as far as a normal
      // over-the-shoulder distance (never into his head: a thug stepping behind him must not become a first-person view)
      for (const e of c.enemies) {
        if (e.stuck === "wall" || e.state === "out") continue;
        const r = 0.5 * e.T.scale + (e.web > 0.3 ? 0.25 : 0);
        for (const hgt of [0.6, 1.3]) {
          const ep = _v2.copy(e.pos).setY(e.pos.y + hgt * e.T.scale);
          const t = _v4.subVectors(ep, pivot).dot(toCam);
          if (t < 0.5 || t > allow + 0.4) continue;
          const d = ep.distanceTo(_v4.copy(pivot).addScaledVector(toCam, t));
          if (d < r + 0.25) allow = Math.max(2.4, Math.min(allow, t - r - 0.2));
        }
      }
      // street-tree trunks (walk-blocking only, invisible to the world raycast): never park the lens behind one
      const trees = P.cam?.foliage?.(pivot);
      if (trees && trees.length) {
        for (let t = 0.7; t < allow; t += 0.3) {
          const q = _v2.copy(pivot).addScaledVector(toCam, t);
          let hit = false;
          for (const tr of trees)
            if (
              q.y < tr.cy &&
              (q.x - tr.pos.x) ** 2 + (q.z - tr.pos.z) ** 2 < 0.36
            ) {
              hit = true;
              break;
            }
          if (hit) {
            allow = Math.max(1.6, t - 0.45);
            break;
          }
        }
      }
      c.camSoft = dampValue(
        c.camSoft ?? Lc,
        allow,
        allow < (c.camSoft ?? Lc) ? 9 : 2.5,
        realDt,
      );
      c.camAllow = Math.min(hard, c.camSoft);
      c.camDbg = [
        +Lc.toFixed(2),
        +raw.toFixed(2),
        +hard.toFixed(2),
        +c.camAllow.toFixed(2),
      ];
      if (c.camAllow < Lc) {
        wantP.copy(pivot).addScaledVector(toCam, c.camAllow);
        wantP.y += (Lc - c.camAllow) * 0.3;
      }
      const gy = ctx.world.groundHeight(wantP.x, wantP.z, wantP.y + 0.3) + 0.35;
      if (wantP.y < gy) wantP.y = gy;
      cam.position.copy(wantP);
      const pc2 = P.cam;
      // pitch: an occlusion dodge (building / tree beside him) can leave the orbit near top-down, and standing and
      // fighting never brings it back. Mouse idle and no occlusion goal -> ease back toward a fight angle (~14 deg down)
      // as far as that angle has room behind him (never back into the wall that raised it)
      if (
        pc2 &&
        pc2.lastLook > 1.0 &&
        !pc2.occGoal &&
        (pc2.occHold || 0) <= 0 &&
        pc2.pitch > 0.3
      ) {
        const tp = clamp(pc2.pitch - 0.25, 0.24, pc2.pitch),
          cp = Math.cos(tp);
        const d = _v2.set(
            -Math.sin(pc2.yaw) * cp,
            Math.sin(tp),
            -Math.cos(pc2.yaw) * cp,
          ),
          o = _v4.copy(pc).setY(pc.y + 0.55);
        const hh = ctx.world.raycast(o, d, 4.2);
        if (!hh || hh.distance > 3.4)
          pc2.pitch = dampValue(pc2.pitch, tp, 1.4 * w, realDt);
      }
      // 3/4 framing: while he fights on the ground and the current target stands (nearly) straight ahead of him along the
      // view, his body hides the thug and the blows. With the mouse idle for 0.6 s the orbit drifts round (<= 1.3 rad/s)
      // until Spider-Man -> target is ~45 deg off the view axis, on the side it already is.
      const tg = me.target?.alive ? me.target : null;
      if (
        pc2 &&
        tg &&
        pc2.lastLook > 0.6 &&
        !c.cineS &&
        c.time - me.lastAttackT < 2.5 &&
        !juggle
      ) {
        const yawST = Math.atan2(tg.pos.x - pc.x, tg.pos.z - pc.z),
          dA = wrapAngle(yawST - pc2.yaw);
        if (Math.abs(dA) < 0.72 && horizontalDistance(tg.pos, pc) > 0.6) {
          const goal = yawST - (dA >= 0 ? 1 : -1) * 0.8,
            step = wrapAngle(goal - pc2.yaw);
          pc2.yaw += clamp(step, -1.3 * realDt * w, 1.3 * realDt * w);
        }
      }
      // yaw assist: an attacker winding up outside the view (mouse idle for 1.2 s) -> drift the orbit toward him
      if (pc2 && pc2.lastLook > 1.2 && !c.cineS) {
        let tgt = null,
          best = Infinity;
        for (const t of c.threats) {
          const r = t.at - c.time;
          if (r > 0 && r < best) {
            best = r;
            tgt = t.e;
          }
        }
        if (tgt) {
          const rel = wrapAngle(
            Math.atan2(tgt.pos.x - pc.x, tgt.pos.z - pc.z) - pc2.yaw,
          );
          const over = Math.abs(rel) - 0.62; // beyond ~35 deg off the view axis
          if (over > 0)
            pc2.yaw += Math.sign(rel) * Math.min(over, 1.4 * realDt * w);
        }
      }
    }
    // cinematic beats (finisher / wall pin): low side angle that frames BOTH actors every frame
    const S = c.cineS;
    if (S) {
      S.t += realDt;
      const k = smoothstep01(S.t / 0.22) * (1 - smoothstep01((S.t - S.dur + 0.3) / 0.3));
      if (S.t > S.dur || !S.target) c.cineS = null;
      else if (k > 0.001) {
        const tp = S.target.chest(_v2);
        const a = camPivot.copy(pc);
        a.y += 0.2;
        // after the hit the victim flies off: keep him in frame but bias toward Spider-Man
        const mid = _v.copy(a).lerp(tp, S.kind === "pin" ? 0.55 : 0.5);
        const span = a.distanceTo(tp);
        if (!S.side) {
          const ax = new THREE.Vector3(tp.x - a.x, 0, tp.z - a.z).normalize();
          const cands = [
            new THREE.Vector3(-ax.z, 0, ax.x),
            new THREE.Vector3(ax.z, 0, -ax.x),
          ];
          for (const sd of cands.slice())
            cands.push(
              sd.clone().addScaledVector(ax, -0.8).normalize(),
              sd.clone().addScaledVector(ax, 0.8).normalize(),
            );
          let best = null,
            bs = Infinity;
          for (const sd of cands) {
            const dist = 2.6 + span * 0.8,
              cp = mid.clone().addScaledVector(sd, dist);
            cp.y = mid.y + 0.35;
            let sc = 0;
            // both actors must be unobstructed from this spot (walls, other enemies, cars)
            for (const tgt of [a, tp]) {
              const dd = tgt.clone().sub(cp);
              const L = dd.length();
              dd.normalize();
              if (ctx.world.raycast(cp, dd, L - 0.3)) sc += 10;
              for (const e of c.enemies) {
                if (e === S.target || !e.alive) continue;
                const q = new THREE.Line3(cp, tgt).closestPointToPoint(
                  e.pos.clone().setY(e.pos.y + 1),
                  true,
                  new THREE.Vector3(),
                );
                if (q.distanceTo(e.pos.clone().setY(e.pos.y + 1)) < 0.7)
                  sc += 4;
              }
            }
            if (ctx.world.raycast(mid, sd, dist)) sc += 6;
            const dyn = ctx.world.collideDynamic?.(
              cp.clone().setY(cp.y - 0.9),
              0.4,
              1.2,
            );
            if (dyn?.push?.lengthSq() > 1e-4) sc += 6;
            sc -=
              sd.dot(_v3.subVectors(cam.position, mid).setY(0).normalize()) *
              0.8; // prefer the current side
            if (sc < bs) {
              bs = sc;
              best = { sd, dist };
            }
          }
          S.side = best.sd;
          S.dist = best.dist;
        }
        const cpos = _v3.copy(mid).addScaledVector(S.side, S.dist + S.t * 0.35);
        cpos.y = mid.y + 0.35;
        const hh = ctx.world.raycast(
          mid,
          _v4.subVectors(cpos, mid).normalize(),
          mid.distanceTo(cpos),
        );
        if (hh)
          cpos.copy(mid).addScaledVector(_v4, Math.max(1.0, hh.distance - 0.3));
        // blend: position lerps, the look target lerps from the chase framing (Spidey) to the pair midpoint
        const look0 = _v4
          .copy(cam.position)
          .addScaledVector(
            cam.getWorldDirection(_cf),
            Math.max(2, cam.position.distanceTo(pc)),
          );
        const look = look0.lerp(mid, k);
        cam.position.lerp(cpos, k);
        cam.up.set(0, 1, 0);
        cam.lookAt(look);
      }
    }
    cam.updateMatrixWorld();
  }

  // ------------------------------------------------------------------ per-frame
  let alarmT = 0;
  const system = {
    name: "combat",
    update(dt) {
      const realDt = ctx.realDt ?? dt;
      const playing = ctx.flow ? ctx.flow.isPlaying : true;
      if (!playing) {
        if (c.engaged) ctx.timeScale = 1;
        return;
      }
      c.time += dt;
      c.rtime += realDt;
      c.input.poll();
      c.playerFeet.copy(P.position).setY(P.position.y - H);
      const f = c.fight;
      if (f) {
        f.t += dt;
        // disengage when the player leaves the area; re-engage on return
        const d = horizontalDistance(P.position, f.center);
        if (c.engaged && d > 55) {
          f.far += dt;
          if (f.far > 2) engage(false);
        } else if (d <= 55) f.far = 0;
        if (d > 120) {
          f.gone = (f.gone || 0) + dt;
          if (f.gone > 2) {
            releaseFight();
            return;
          }
        } else f.gone = 0;
        if (!c.engaged && d < 30) engage(true);
        // keep the fight centre on the action
        let n = 0;
        _v.set(0, 0, 0);
        for (const e of c.enemies)
          if (e.alive) {
            _v.add(e.pos);
            n++;
          }
        if (n) f.center.lerp(_v.divideScalar(n), 1 - Math.exp(-0.5 * dt));
        // civilians flee (city life) + event for other systems
        alarmT -= dt;
        if (alarmT <= 0) {
          alarmT = 1.5;
          try {
            ctx.world.alarm?.(f.center, 18);
          } catch (e) {
            /* optional */
          }
          emit("crime:zone", {
            id: f.crime?.id || "cmb-fight",
            pos: f.center.clone(),
            radius: 15,
            active: true,
            type: f.crime?.type || "fight",
            moving: true,
          });
        }
        if (c.engaged) director(dt);
        const alive = c.enemies.filter((e) => e.alive).length;
        if (!alive && c.enemies.length) {
          f.clearT += dt;
          if (f.clearT > 1.3 && (me.isFree() || f.clearT > 3)) endFight(true);
        } else f.clearT = 0;
      } else if (c.leftovers) {
        c.leftovers.t += dt;
        if (
          c.leftovers.t > 25 ||
          (c.leftovers.t > 6 && horizontalDistance(P.position, c.leftovers.center) > 45)
        )
          disposeLeftovers();
      }
      // enemies
      for (let i = c.enemies.length - 1; i >= 0; i--) {
        const e = c.enemies[i];
        if (!e.actor.root.parent) {
          e.dispose();
          c.enemies.splice(i, 1);
          continue;
        } // actor disposed by the crime system
        if (c.engaged || !e.alive) e.update(dt);
        else {
          e.play("fightIdle");
        }
      }
      // separation (standing enemies from each other and from Spider-Man)
      for (let i = 0; i < c.enemies.length; i++) {
        const a = c.enemies[i];
        if (
          !a.alive ||
          a.state === "air" ||
          a.state === "knock" ||
          a.state === "down"
        )
          continue;
        for (let j = i + 1; j < c.enemies.length; j++) {
          const b = c.enemies[j];
          if (
            !b.alive ||
            b.state === "air" ||
            b.state === "knock" ||
            b.state === "down"
          )
            continue;
          const dx = b.pos.x - a.pos.x,
            dz = b.pos.z - a.pos.z,
            d = Math.hypot(dx, dz),
            m = 0.85 * Math.max(a.T.scale, b.T.scale);
          if (d < m && d > 1e-4) {
            const k = ((m - d) * 0.5) / d;
            a.moveXZ(-dx * k, -dz * k);
            b.moveXZ(dx * k, dz * k);
          }
        }
        c.props.collide(a.pos, 0.3 * a.T.scale, (x, z) => a.moveXZ(x, z)); // throwable props are solid
        const pf = c.playerFeet,
          dx = a.pos.x - pf.x,
          dz = a.pos.z - pf.z,
          d = Math.hypot(dx, dz),
          m = 0.8 * a.T.scale;
        if (d < m && d > 1e-4 && Math.abs(a.pos.y - pf.y) < 1)
          a.moveXZ((dx / d) * (m - d), (dz / d) * (m - d));
      }
      for (const e of c.enemies) e.late(dt);
      // Spider-Man pose layer + web shots
      me.late(dt);
      if (c.pendingShot && c.time >= c.pendingShot.at) {
        const t = c.pendingShot.target;
        c.pendingShot = null;
        if (t?.alive) fireWeb(t);
      }
      updateShots(dt);
      c.props.update(dt);
      for (let i = c.loose.length - 1; i >= 0; i--) {
        const l = c.loose[i];
        l.t += dt;
        if (l.rest) continue;
        l.vel.y -= 20 * dt;
        l.obj.position.addScaledVector(l.vel, dt);
        l.obj.rotation.x += dt * 12;
        l.obj.rotation.z += dt * 7;
        const gy = ctx.world.groundHeight(
          l.obj.position.x,
          l.obj.position.z,
          l.obj.position.y + 0.5,
        );
        if (l.obj.position.y < gy + 0.03) {
          l.obj.position.y = gy + 0.03;
          if (l.vel.y < -3) {
            l.vel.y *= -0.3;
            l.vel.x *= 0.5;
            l.vel.z *= 0.5;
          } else {
            l.rest = true;
            l.obj.rotation.set(Math.PI / 2, Math.random() * 6, 0);
          }
        }
      }
      // threats -> spider-sense (sprite + slow-mo hint for the first warnings of a fight)
      c.threats = c.threats.filter((t) => t.at > c.time - 0.15 && t.e.alive);
      let lvl = 0,
        red = 0;
      for (const t of c.threats) {
        const r = t.at - c.time;
        const k = clamp(1 - r / 0.75, 0, 1) * (r > -0.1 ? 1 : 0);
        if (k > lvl) {
          lvl = k;
          red = t.kind === "gun" ? 1 : 0;
        }
        if (!t.hinted && r < 0.5 && r > 0.2) {
          t.hinted = true;
          if (c.warnCount < 2 && P.mode === "ground") {
            c.slowmo(0.28, 0.45, 0.2);
          } // teach the warning once or twice
          c.warnCount++;
        }
      }
      const head = P.rig.bones?.head
        ? P.rig.bones.head.getWorldPosition(_v)
        : _v.copy(P.position).setY(P.position.y + 0.75);
      head.y += 0.08;
      c.fx.setSense(c.engaged ? lvl : 0, red, head);
      c.fx.update(dt, realDt);
      c.combo.t += dt;
      if (c.combo.t > 3.2) c.combo.n = 0;
      updateTime();
      combatCamera(realDt);
      if (c.fight || c.leftovers) c.hud.update(realDt, { threats: c.threats });
    },
  };
  ctx.systems = ctx.systems || [];
  ctx.systems.push(system);

  // ------------------------------------------------------------------ debug / playtest hooks
  c.debug = {
    async fight(spec = "mmgb", dist = 7) {
      const A = actorsApi();
      if (!A) return "no actors";
      await A.ready();
      if (c.fight) endFight(false);
      if (c.leftovers) disposeLeftovers();
      const pf = P.position.clone().setY(P.position.y - H);
      const fwd = P.cam.forwardFlat(new THREE.Vector3());
      const center = pf.clone().addScaledVector(fwd, dist * 0.6);
      const map = { m: "melee", g: "gunman", b: "brute" };
      const actors = [],
        types = [];
      [...spec].forEach((ch, i) => {
        const type = map[ch] || "melee";
        const a = (i / spec.length - 0.5) * 2.2;
        const r = type === "gunman" ? dist + 4 : dist;
        const d = fwd.clone().applyAxisAngle(WORLD_UP, a);
        const p = pf.clone().addScaledVector(d, r);
        p.y = ctx.world.groundHeight(p.x, p.z, pf.y + 2);
        const ac = A.spawn({
          pos: p,
          yaw: yawToTarget(p, pf),
          variant:
            type === "gunman"
              ? "a"
              : type === "brute"
                ? "c"
                : ["b", "a"][i % 2],
          role: "thug",
        });
        if (ac) {
          actors.push(ac);
          types.push(type);
          ac.combatSpawned = true;
        }
      });
      startFight({ center, actors, types });
      c.fight.spawned.push(...actors);
      return c.enemies.map((e) => e.type).join(",");
    },
    // stand ~dist m in front of the nearest facade, facing it (for wall-web tests)
    nearWall(dist = 7) {
      const p = P.position.clone();
      let best = null;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const d = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const h = ctx.world.raycast(p, d, 40);
        if (
          h &&
          Math.abs(h.normal.y) < 0.3 &&
          (!best || h.distance < best.distance)
        )
          best = h;
      }
      if (!best) return null;
      const n = best.normal.clone().setY(0).normalize();
      const q = best.point.clone().addScaledVector(n, dist);
      q.y = ctx.world.groundHeight(q.x, q.z, p.y) + 1.2;
      P.teleport(q, Math.atan2(-n.x, -n.z));
      return [q.x.toFixed(1), q.z.toFixed(1)];
    },
    focus(n = 3) {
      me.focus = n;
    },
    hp(n = 100) {
      me.hp = n;
    },
    webAll() {
      for (const e of c.enemies) e.addWeb(1, new THREE.Vector3(0, 0, 1));
    },
    end() {
      endFight(false);
      disposeLeftovers();
    },
    state() {
      return c.state;
    },
  };
  Object.defineProperty(c, "state", {
    get() {
      return {
        rt: +c.rtime.toFixed(2),
        fight: !!c.fight,
        engaged: !!c.engaged,
        move: me.moveName(),
        hp: Math.round(me.hp),
        focus: +me.focus.toFixed(2),
        combo: c.combo.n,
        ts: +(ctx.timeScale ?? 1).toFixed(2),
        sense: c.threats.length,
        cine: c.cineS ? c.cineS.kind + ":" + c.cineS.t.toFixed(2) : null,
        enemies: c.enemies
          .map(
            (e) =>
              `${e.type[0]}:${e.state}${e.stuck ? "-" + e.stuck : ""}:${Math.max(0, Math.round(e.hp))}${e.web ? ":w" + e.web.toFixed(1) : ""}`,
          )
          .join(" "),
      };
    },
  });
  window.__cmb = c;
  const prevPt = window.__ptState;
  window.__ptState = () => ({ ...(prevPt ? prevPt() : {}), cmb: c.state });
  console.info("[combat] ready");
  return c;
}
