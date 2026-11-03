// @ts-nocheck
// OWNER: systems engineer. Waypoints, GPS route, fast travel, objective management, minimap overlay.
//   setWaypoint(Vector3|null) -> HUD objective (hud.setObjective) + light pillar + GPS route line on the minimap
//   fastTravel(station)       -> fade / subway loading card -> player.teleport -> fade in
//   With no waypoint, the HUD objective points at the nearest inactive research tower (Insomniac onboarding).
// The minimap overlay is drawn onto the HUD's `.mm-map canvas` right after hud.update (systems run after the HUD
// each frame) using the same transform as hud.js (VIEW_M = 260 m across, player at 50% / 62%, camera-heading-up).
import * as THREE from "three";
import { emit } from "./events.ts";
import { findRoute, routeLength } from "./route.ts";
import { badgeImage } from "../../ui/menus/icons.ts";

const VIEW_M = 260;
const _hd = new THREE.Vector3();

export function createTravel(sys) {
  const { ctx, save, markers, ui, audio, flow, data } = sys;
  const { player, hud, camera } = ctx;
  let waypoint = save.state.waypoint
    ? new THREE.Vector3(...save.state.waypoint)
    : null;
  let route = null,
    routeFrom = new THREE.Vector3(1e9, 0, 0),
    routeT = 0;
  let traveling = false;

  function objectiveFallback() {
    const t = sys.towers.nearestInactive(player.position);
    return t ? t.pos.clone().setY(t.pos.y + 16) : null;
  }
  function refreshObjective() {
    const o = waypoint || objectiveFallback();
    if (o) hud?.setObjective?.(o);
  }
  function setWaypoint(pos, { silent = false } = {}) {
    waypoint = pos ? pos.clone() : null;
    if (waypoint)
      waypoint.y = ctx.world.groundHeight(waypoint.x, waypoint.z) + 1.5;
    save.state.waypoint = waypoint
      ? waypoint.toArray().map((v) => +v.toFixed(1))
      : null;
    save.markDirty();
    markers.setWaypoint(waypoint);
    route = null;
    routeFrom.set(1e9, 0, 0);
    refreshObjective();
    if (!silent) audio.sfx[waypoint ? "select" : "back"]();
    emit("waypoint:set", waypoint ? { pos: waypoint.clone() } : null);
  }

  async function fastTravel(station) {
    if (traveling || !save.state.stations.includes(station.id)) return false;
    traveling = true;
    if (sys.pause?.open) sys.pause.close(true); // started from the map / debug while paused
    const prevMode = flow.mode;
    flow.setMode("travel");
    emit("fasttravel:start", { station });
    const dn =
      data.districts.find((d) => d.id === station.district)?.name || "";
    ui.fade(true, station.name, dn ? `${dn} · Subway` : "Subway");
    audio.sfx.travel();
    await wait(700);
    const p = station.arrive.clone();
    p.y += 1.2;
    player.teleport?.(p, station.yaw);
    ctx.pipeline.resetHistory?.();
    flow.setMode("play"); // let the world/player settle behind the black screen
    await wait(1500);
    ui.fade(false);
    ui.setVisible(true);
    traveling = false;
    emit("fasttravel:end", { station });
    ui.toast({
      title: "Arrived",
      text: station.name,
      icon: "station",
      tone: "cyan",
      sound: null,
    });
    void prevMode;
    return true;
  }
  // (user r-mapteleport) "teleport anywhere by clicking on the map, falls from a safe distance from the sky": drop in at
  // (x, z) from 60 m above the tallest surface within ~30 m (>= 100 m up), so no safe landing spot has to be found
  async function teleportTo(x, z) {
    if (traveling) return false;
    traveling = true;
    if (sys.pause?.open) sys.pause.close(true);
    flow.setMode("travel");
    ui.fade(true, "Web Travel", "");
    audio.sfx.travel();
    await wait(450);
    let top = 0;
    for (let dx = -30; dx <= 30; dx += 10)
      for (let dz = -30; dz <= 30; dz += 10)
        top = Math.max(top, ctx.world.groundHeight(x + dx, z + dz) || 0);
    player.teleport?.(
      new THREE.Vector3(x, Math.max(100, top + 60), z),
      player.heading ?? 0,
    );
    ctx.pipeline.resetHistory?.();
    flow.setMode("play");
    await wait(900);
    ui.fade(false);
    ui.setVisible(true);
    traveling = false;
    emit("fasttravel:end", { station: null, pos: { x, z } });
    return true;
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------- minimap overlay
  let mmCanvas = null,
    lastMM = -1;
  function minimap(pinsWorld) {
    if (!flow.isPlaying) return;
    // the HUD redraws its minimap at a throttled rate: only overlay when it actually redrew (else we'd stack)
    const fr = hud?.minimapFrame;
    if (fr !== undefined) {
      if (fr === lastMM) return;
      lastMM = fr;
    }
    if (!mmCanvas || !mmCanvas.isConnected)
      mmCanvas = document.querySelector("#hud .mm-map canvas");
    const c = mmCanvas;
    if (!c || !c.width) return;
    const g = c.getContext("2d"),
      w = c.width,
      h = c.height;
    const p = player.position,
      scale = w / VIEW_M,
      cx = w * 0.5,
      cy = h * 0.62;
    const cd = camera.getWorldDirection(_hd);
    const heading = Math.atan2(cd.x, cd.z);
    const r = -(Math.PI - heading),
      cr = Math.cos(r),
      sr = Math.sin(r);
    const toMap = (x, z) => [
      ((x - p.x) * cr - (z - p.z) * sr) * scale + cx,
      ((x - p.x) * sr + (z - p.z) * cr) * scale + cy,
    ];
    // GPS route
    if (route && route.length > 1) {
      g.save();
      g.lineJoin = "round";
      g.lineCap = "round";
      g.beginPath();
      route.forEach(([x, z], i) => {
        const [X, Y] = toMap(x, z);
        i ? g.lineTo(X, Y) : g.moveTo(X, Y);
      });
      g.strokeStyle = "rgba(20,12,0,.55)";
      g.lineWidth = Math.max(4, w * 0.022);
      g.stroke();
      g.strokeStyle = "#f5c02e";
      g.lineWidth = Math.max(2.2, w * 0.012);
      g.setLineDash([w * 0.03, w * 0.012]);
      g.lineDashOffset = -performance.now() * 0.02 * (w / 300);
      g.stroke();
      g.restore();
    }
    // icons
    const sz = Math.round(h * 0.13);
    for (const it of pinsWorld) {
      let [X, Y] = toMap(it.pos.x, it.pos.z);
      const inside = X > 6 && X < w - 6 && Y > 6 && Y < h - 6;
      if (!inside) {
        if (!it.clamp) continue;
        X = THREE.MathUtils.clamp(X, sz / 2, w - sz / 2);
        Y = THREE.MathUtils.clamp(Y, sz / 2, h - sz / 2);
      }
      const im = badgeImage(it.kind, 64);
      if (!im.complete) continue;
      const s = sz * (it.mscale || 1);
      g.globalAlpha = it.alpha ?? 1;
      g.drawImage(im, X - s / 2, Y - s / 2, s, s);
      g.globalAlpha = 1;
    }
    // player arrow on top of the icons (same shape/transform as hud.js so it simply re-covers the HUD's arrow)
    {
      const vel = player.velocity;
      const face =
        Math.hypot(vel.x, vel.z) > 0.5 ? Math.atan2(vel.x, vel.z) : heading;
      g.save();
      g.translate(cx, cy);
      g.rotate(-(face - heading));
      const s = h * 0.075;
      g.beginPath();
      g.moveTo(0, -s * 1.35);
      g.lineTo(s * 1.0, s * 0.9);
      g.lineTo(0, s * 0.35);
      g.lineTo(-s * 1.0, s * 0.9);
      g.closePath();
      g.shadowColor = "rgba(0,0,30,.6)";
      g.shadowBlur = 4;
      g.fillStyle = "#f7c531";
      g.fill();
      g.lineWidth = Math.max(1.5, s * 0.22);
      g.strokeStyle = "#fff";
      g.stroke();
      g.restore();
    }
    // GPS distance readout
    if (waypoint && route && ctx.params?.gpsDistance) {
      const L = routeLength(route);
      g.save();
      g.font = `700 ${Math.round(h * 0.085)}px "Barlow Condensed", Rajdhani, sans-serif`;
      g.textAlign = "right";
      g.textBaseline = "top";
      g.fillStyle = "rgba(0,0,20,.55)";
      const txt =
        L > 1000 ? (L / 1000).toFixed(1) + " km" : Math.round(L) + " m";
      const tw = g.measureText(txt).width;
      g.fillRect(w - tw - h * 0.06, h * 0.03, tw + h * 0.04, h * 0.11);
      g.fillStyle = "#f5c02e";
      g.fillText(txt, w - h * 0.04, h * 0.045);
      g.restore();
    }
  }

  return {
    get waypoint() {
      return waypoint;
    },
    get route() {
      return route;
    },
    get routeLength() {
      return route && route.length > 1 ? routeLength(route) : null;
    },
    get traveling() {
      return traveling;
    },
    setWaypoint,
    fastTravel,
    teleportTo,
    refreshObjective,
    minimap,
    init() {
      markers.setWaypoint(waypoint);
      refreshObjective();
    },
    update(dt) {
      const p = player.position;
      routeT -= dt;
      if (waypoint) {
        if (
          Math.hypot(waypoint.x - p.x, waypoint.z - p.z) < 22 &&
          Math.abs(waypoint.y - p.y) < 40
        ) {
          ui.toast({
            title: "Destination Reached",
            text: "",
            icon: "waypoint",
            sound: "toast",
          });
          setWaypoint(null, { silent: true });
          return;
        }
        if (routeT <= 0 && (routeFrom.distanceTo(p) > 25 || !route)) {
          route = findRoute(p.x, p.z, waypoint.x, waypoint.z);
          routeFrom.copy(p);
          routeT = 0.5;
        } else if (route) route[0] = [p.x, p.z];
      } else route = null;
      // keep the tower objective fresh as the player moves
      if (!waypoint && routeT <= -2) {
        routeT = 0;
        refreshObjective();
      }
    },
  };
}
