// @ts-nocheck
// OWNER: citylife engineer. Glue between the city-life systems (traffic, crowd, pigeons) and the world contract:
//   world.collideDynamic(pos, radius, height) -> {push, grounded?, groundY?, velocity?} | null      (C3)
//   world.setPlayerState(pos, vel)            traversal calls it every frame; cars brake/honk, people react (C3)
//   world.alarm(pos, radius)                  danger (combat/explosions): people flee, cars stop + honk
//   world.life                                debug/introspection: {traffic, crowd, pigeons, stats()}
// If traversal never calls setPlayerState, the player state is polled from window.__ctx.player defensively.
import * as THREE from "three";

export function attachLife(world, { traffic, crowd = null, pigeons = null }) {
  const sim = traffic?.sim;
  const state = {
    pos: new THREE.Vector3(1e9, 0, 0),
    vel: new THREE.Vector3(),
    last: -1,
    t: 0,
    prevVy: 0,
    landT: -9,
    airT: 0,
  };
  const _v = new THREE.Vector3(),
    _p = new THREE.Vector3();
  const feed = (pos, vel) => {
    const gy = world.groundHeight ? world.groundHeight(pos.x, pos.z, pos.y) : 0;
    const air = pos.y - gy > 0.6;
    // landing detection (for crowd reactions): airborne with speed, then on the ground
    const fdt = Math.min(0.1, Math.max(0, state.t - (state.feedT ?? state.t)));
    state.feedT = state.t;
    if (air) state.airT += fdt || 1 / 60;
    else {
      if (state.airT > 0.35 && (state.prevVy < -6 || state.airT > 1.0)) {
        state.landT = state.t;
        state.landPos = pos.clone();
        state.landSeverity = Math.min(1, -state.prevVy / 25);
      }
      state.airT = 0;
    }
    state.prevVy = vel ? vel.y : 0;
    state.pos.copy(pos);
    if (vel) state.vel.copy(vel);
    state.ground = gy;
    state.air = air;
    sim?.setPlayer(pos, vel, gy);
    crowd?.setPlayer?.(state);
    pigeons?.setPlayer?.(state);
  };
  // until traversal feeds us, assume the player stands at the spawn (no car is ever streamed in on top of him)
  if (world.spawn) {
    state.pos.copy(world.spawn);
    sim?.setPlayer(world.spawn, null, world.spawn.y ?? 0);
  }
  world.setPlayerState = (pos, vel) => {
    state.last = state.t;
    feed(pos, vel);
  };
  world.collideDynamic = (pos, radius = 0.4, height = 1.8) =>
    sim ? sim.collideDynamic(pos, radius, height) : null;
  world.alarm = (pos, radius = 25) => {
    sim?.alarm(pos, radius);
    crowd?.alarm?.(pos, radius);
    pigeons?.alarm?.(pos, radius);
  };
  world.life = {
    traffic: sim,
    crowd,
    pigeons,
    player: state,
    stats: () => ({
      ...(sim?.stats() || {}),
      ...(crowd?.stats?.() || {}),
      ...(pigeons?.stats?.() || {}),
    }),
  };
  // crime zones -> crowd danger zones. Systems emit ctx.events 'crime:zone' {pos, radius, active, id?}; fallback: poll
  // __sys.crimes.active (pos) so civilians clear out of fights even before the event ships.
  let evBound = false,
    pollT = 0,
    polledKey = null;
  const onZone = (e = {}) => {
    if (!e.pos && (e.active !== false || e.id == null)) return;
    if (!crowd?.danger) return;
    const key =
      e.id ?? "zone:" + Math.round(e.pos.x) + "," + Math.round(e.pos.z);
    crowd.danger(key, e.pos, e.radius ?? 18, e.active !== false);
    if (e.type !== "carChase")
      sim?.zone?.(key, e.pos, Math.min(24, e.radius ?? 18), e.active !== false);
  };
  const crimeZones = (dt) => {
    const ctx = typeof window !== "undefined" ? window.__ctx : null;
    if (!evBound && ctx?.events?.on) {
      ctx.events.on("crime:zone", onZone);
      evBound = true;
    }
    if ((pollT -= dt) > 0 || !crowd?.danger) return;
    pollT = 0.5;
    const c =
      typeof window !== "undefined" ? window.__sys?.crimes?.active : null;
    const act =
      c &&
      c.pos &&
      (c.state === undefined || c.state === "active") &&
      !c.suspended &&
      c.type !== "carChase";
    const key = act ? "crime:" + (c.id ?? "x") : null;
    if (polledKey && polledKey !== key) {
      crowd.danger(polledKey, null, 0, false);
      sim?.zone?.(polledKey, null, 0, false);
      polledKey = null;
    }
    if (act) {
      crowd.danger(key, c.pos, 18, true);
      sim?.zone?.(key, c.pos, 18, true);
      polledKey = key;
    }
  };
  if (crowd)
    crowd.scatter = crowd.scatter || ((pos, r) => crowd.alarm?.(pos, r));
  const update = world.update;
  world.update = (dt, camera) => {
    state.t += dt;
    crimeZones(dt);
    const dc = world.life.debugCam; // debug: [x,y,z, tx,ty,tz] forces the camera (tools / playtests)
    if (dc && camera) {
      camera.position.set(dc[0], dc[1], dc[2]);
      camera.lookAt(dc[3], dc[4], dc[5]);
      camera.updateMatrixWorld();
    }
    if (state.t - state.last > 0.5) {
      // traversal isn't feeding us: poll the player
      const p = typeof window !== "undefined" ? window.__ctx?.player : null;
      const pos = p?.position || p?.object?.position;
      if (pos)
        feed(
          _p.set(pos.x, pos.y - (p.position ? 0.95 : 0), pos.z),
          p.velocity || _v.set(0, 0, 0),
        ); // body centre -> feet
    }
    update(dt, camera);
  };
  return world;
}
