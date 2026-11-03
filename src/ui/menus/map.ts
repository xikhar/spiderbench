// @ts-nocheck
// Full-screen city map: pre-rendered Insomniac-blue base map (blocks, footprints with
// height shading + drop shadows, streets, park, river), district borders & names, scrambled overlay on districts
// whose research tower is inactive, icons (towers, stations, backpacks, landmarks, secret-photo areas, crimes,
// waypoint, player), filters, district progress, hover cards, waypoint setting and fast travel.
import * as THREE from "three";
import { badgeImage, badge } from "./icons.ts";

let PXM = 0.6; // base-map pixels per metre (lowered automatically if the big canvas fails to allocate)
const K_UP = 0.3,
  K_E = 0.07; // oblique extrusion: map-metres of north / east roof shift per metre of height
const FONT =
  '"Spiderbench Condensed", "Barlow Condensed", "Arial Narrow", sans-serif';
const MAPC = {
  water0: "#0b2552",
  water1: "#0a2048",
  street: "#07122c",
  road: "#1a2750",
  avenue: "#223263",
  pier: "#1e2a4c",
  block: "#0e1b40",
  park: "#123f55",
  tree0: "rgba(60,150,160,.42)",
  tree1: "rgba(90,180,190,.32)",
  bg: "#0a2048",
};
const CAT = [
  ["tower", "Research Towers"],
  ["station", "Fast Travel"],
  ["backpack", "Backpacks"],
  ["landmark", "Landmarks"],
  ["photo", "Secret Photos"],
  ["crime", "Crimes"],
];

export function createMapPage(sys) {
  const { ctx, data, save, audio, travel } = sys;
  const el = document.createElement("div");
  el.className = "sys-map";
  el.innerHTML = `<canvas></canvas>
    <div class="legend sys-panel cut interactive"><div class="dist"><small>DISTRICT</small><b></b><div class="dprog"></div><div class="pbar"><i></i></div></div>
      <div class="rows"></div></div>
    <div class="zoomhint">Wheel / + - &nbsp;zoom<br>Drag / WASD &nbsp;pan<br>Click &nbsp;teleport / set waypoint<br>Right-click &nbsp;clear waypoint<br>C &nbsp;center on Spider-Man</div>
    <div class="card sys-panel cut hide"><small></small><h5></h5><p></p><div class="acts"></div></div>
    <div class="reveal-hint"><small>DISTRICT UNLOCKED</small><b></b><span><span class="sys-key">Esc</span>Continue</span></div>`;
  const cv = el.querySelector("canvas"),
    g = cv.getContext("2d", { willReadFrequently: true });
  const card = el.querySelector(".card"),
    rowsEl = el.querySelector(".rows");
  const filters = Object.fromEntries(CAT.map(([k]) => [k, true]));
  rowsEl.innerHTML = CAT.map(
    ([k, n]) =>
      `<div class="row" data-k="${k}">${badge(k === "crime" ? "crime" : k, 24)}<b>${n}</b><span></span></div>`,
  ).join("");
  rowsEl.querySelectorAll(".row").forEach((r) =>
    r.addEventListener("click", () => {
      filters[r.dataset.k] = !filters[r.dataset.k];
      r.classList.toggle("off", !filters[r.dataset.k]);
      audio.sfx.move();
      dirty = true;
    }),
  );

  // ---------------------------------------------------------------- base map (built lazily once)
  // Insomniac-style tilted 3D city: every footprint is extruded with an oblique projection (roof shifted north by
  // h*K_UP and east by h*K_E) so the south/west walls read as faces; roofs are shaded by height, glass towers cyan.
  // Icons use the same projection (toSY) so rooftop items sit on their roofs.
  let hintT = 0;
  let base = null,
    baseMips = null,
    bx0 = 0,
    bz0 = 0,
    drawChecked = false;
  function buildBase() {
    const f = ctx.world.getMapFeatures?.();
    if (!f) return;
    const b = f.bounds || { x0: -900, z0: -3600, x1: 950, z1: 3450 };
    bx0 = b.x0 - 400;
    bz0 = b.z0 - 120;
    const x1 = b.x1 + 400,
      z1 = b.z1 + 60;
    const W = Math.ceil((x1 - bx0) * PXM),
      H = Math.ceil((z1 - bz0) * PXM);
    base = document.createElement("canvas");
    base.width = W;
    base.height = H;
    baseMips = null;
    const c = base.getContext("2d", { willReadFrequently: false });
    if (!c) {
      failBase();
      return;
    }
    const X = (x) => (x - bx0) * PXM,
      Z = (z) => (z - bz0) * PXM;
    const rect = (r, fill) => {
      c.fillStyle = fill;
      c.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * PXM, (r.z1 - r.z0) * PXM);
    };
    const poly = (pts, fill) => {
      c.beginPath();
      pts.forEach(([x, z], i) =>
        i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)),
      );
      c.closePath();
      c.fillStyle = fill;
      c.fill();
    };
    // water everywhere, land on top
    const wg = c.createLinearGradient(0, 0, W, 0);
    wg.addColorStop(0, MAPC.water0);
    wg.addColorStop(1, MAPC.water1);
    c.fillStyle = wg;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = "rgba(120,170,255,.06)";
    c.lineWidth = 1;
    for (let y = 0; y < H; y += 7) {
      c.beginPath();
      for (let x = 0; x < W; x += 14)
        c.lineTo(x, y + Math.sin(x * 0.045 + y * 0.7) * 1.4);
      c.stroke();
    }
    // far shores, then the island with a shoreline glow
    for (const p of f.farLand || []) poly(p, MAPC.pier);
    for (const p of f.land || []) {
      c.save();
      c.shadowColor = "rgba(90,170,255,.55)";
      c.shadowBlur = 18 * PXM;
      poly(p, MAPC.street);
      c.restore();
      c.beginPath();
      p.forEach(([x, z], i) =>
        i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)),
      );
      c.closePath();
      c.strokeStyle = "rgba(140,200,255,.55)";
      c.lineWidth = 2;
      c.stroke();
    }
    // roads: lighter asphalt with kerb lines + centre dashes so the grid reads as streets
    for (const r of f.streets || [])
      if (!r.poly)
        rect(
          r,
          r.kind === "avenue" || r.kind === "drive" ? MAPC.avenue : MAPC.road,
        );
    // sidewalks / blocks (with a bright kerb edge)
    for (const bl of f.blocks || []) {
      rect(bl, MAPC.block);
      c.strokeStyle = "rgba(150,185,255,.28)";
      c.lineWidth = 1;
      c.strokeRect(
        X(bl.x0) + 0.5,
        Z(bl.z0) + 0.5,
        (bl.x1 - bl.x0) * PXM - 1,
        (bl.z1 - bl.z0) * PXM - 1,
      );
    }
    for (const r of f.streets || []) if (r.poly) poly(r.poly, MAPC.avenue); // (layout2) Broadway / angled streets cut across the blocks
    c.lineWidth = Math.max(1, 1.2 * PXM);
    c.setLineDash([7 * PXM, 7 * PXM]);
    for (const r of f.streets || []) {
      if (r.poly) continue;
      const vert = r.z1 - r.z0 > r.x1 - r.x0;
      c.strokeStyle =
        r.kind === "avenue" || r.kind === "drive"
          ? "rgba(245,200,90,.32)"
          : "rgba(200,215,255,.16)";
      c.beginPath();
      if (vert) {
        const cx = X((r.x0 + r.x1) / 2);
        c.moveTo(cx, Z(r.z0));
        c.lineTo(cx, Z(r.z1));
      } else {
        const cz = Z((r.z0 + r.z1) / 2);
        c.moveTo(X(r.x0), cz);
        c.lineTo(X(r.x1), cz);
      }
      c.stroke();
    }
    c.setLineDash([]);
    // park: lawn + tree stipple
    for (const p of f.parks || []) {
      poly(p, MAPC.park);
      const [a, , bb] = [p[0], p[1], p[2]];
      let s = 7;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 2600; i++) {
        const x = a[0] + (bb[0] - a[0]) * rnd(),
          z = a[1] + (bb[1] - a[1]) * rnd(),
          r = (2.5 + rnd() * 4) * PXM;
        c.beginPath();
        c.arc(X(x), Z(z), r, 0, 6.283);
        c.fillStyle = rnd() < 0.5 ? MAPC.tree0 : MAPC.tree1;
        c.fill();
      }
      c.strokeStyle = "rgba(190,230,235,.30)";
      c.lineWidth = 1.8 * PXM; // winding paths
      for (let k = 0; k < 7; k++) {
        c.beginPath();
        const z0 = a[1] + ((bb[1] - a[1]) * (k + 0.5)) / 7;
        for (let x = a[0]; x <= bb[0]; x += 12)
          c.lineTo(X(x), Z(z0 + Math.sin(x * 0.02 + k * 1.7) * 25));
        c.stroke();
      }
      // reservoir + lake, meadow, loop drive
      const mx = (a[0] + bb[0]) / 2,
        mz = (a[1] + bb[1]) / 2,
        wz = Math.abs(bb[1] - a[1]),
        wx = Math.abs(bb[0] - a[0]);
      for (const [ex, ez, rx, rz] of [
        [mx, mz - wz * 0.2, wx * 0.3, wz * 0.09],
        [mx - wx * 0.12, mz + wz * 0.22, wx * 0.16, wz * 0.05],
      ]) {
        c.beginPath();
        c.ellipse(X(ex), Z(ez), rx * PXM, rz * PXM, 0, 0, 7);
        c.fillStyle = MAPC.water1;
        c.fill();
        c.strokeStyle = "rgba(150,210,255,.55)";
        c.lineWidth = 1.5;
        c.stroke();
      }
      c.beginPath();
      c.ellipse(
        X(mx + wx * 0.05),
        Z(mz + wz * 0.02),
        wx * 0.18 * PXM,
        wz * 0.07 * PXM,
        0,
        0,
        7,
      );
      c.fillStyle = "rgba(120,200,170,.22)";
      c.fill();
      c.strokeStyle = "rgba(210,225,255,.28)";
      c.lineWidth = 3 * PXM;
      c.beginPath();
      c.roundRect?.(
        X(a[0] + 18),
        Z(Math.min(a[1], bb[1]) + 18),
        (wx - 36) * PXM,
        (wz - 36) * PXM,
        60 * PXM,
      );
      c.stroke();
    }
    // buildings: back (north-east) to front (south-west)
    const fps = (f.buildings || [])
      .slice()
      .sort((p, q) => p.z1 - p.x0 * 0.3 - (q.z1 - q.x0 * 0.3));
    const lerp = (a, b, t) => a + (b - a) * t;
    const col = (t, glass, k = 1) => {
      const r = glass ? lerp(70, 150, t) : lerp(60, 184, t),
        g = glass ? lerp(118, 225, t) : lerp(86, 206, t),
        bl = glass ? lerp(170, 255, t) : lerp(150, 255, t);
      return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(bl * k)})`;
    };
    for (const fp of fps) {
      const h = fp.h || 10,
        up = h * K_UP,
        ex = h * K_E,
        t = THREE.MathUtils.clamp(h / 230, 0, 1),
        glass = fp.kind === "glass";
      const x0 = X(fp.x0),
        x1 = X(fp.x1),
        zA = Z(fp.z0),
        zB = Z(fp.z1),
        du = up * PXM,
        de = ex * PXM;
      // contact shadow (south-west, soft)
      c.fillStyle = "rgba(0,4,18,.35)";
      c.fillRect(x0 - 2, zA + 2, x1 - x0 + 2, zB - zA + 2);
      // west face
      c.beginPath();
      c.moveTo(x0, zA);
      c.lineTo(x0, zB);
      c.lineTo(x0 + de, zB - du);
      c.lineTo(x0 + de, zA - du);
      c.closePath();
      c.fillStyle = col(t, glass, 0.42);
      c.fill();
      // south face (+ floor lines)
      c.beginPath();
      c.moveTo(x0, zB);
      c.lineTo(x1, zB);
      c.lineTo(x1 + de, zB - du);
      c.lineTo(x0 + de, zB - du);
      c.closePath();
      const sg = c.createLinearGradient(0, zB, 0, zB - du);
      sg.addColorStop(0, col(t, glass, 0.38));
      sg.addColorStop(1, col(t, glass, 0.62));
      c.fillStyle = sg;
      c.fill();
      if (du > 10) {
        c.save();
        c.clip();
        c.strokeStyle = glass
          ? "rgba(170,235,255,.16)"
          : "rgba(190,210,255,.10)";
        c.lineWidth = 1;
        const step = Math.max(3.2, 4 * K_UP * PXM);
        for (let yy = zB - step; yy > zB - du; yy -= step) {
          c.beginPath();
          c.moveTo(x0, yy);
          c.lineTo(x1 + de, yy);
          c.stroke();
        }
        c.restore();
      }
      // roof
      const rx0 = x0 + de,
        rz0 = zA - du,
        rw = x1 - x0,
        rh = zB - zA;
      const rg = c.createLinearGradient(rx0, rz0, rx0 + rw, rz0 + rh);
      rg.addColorStop(0, col(t, glass, 1.05));
      rg.addColorStop(1, col(t, glass, 0.86));
      c.fillStyle = rg;
      c.fillRect(rx0, rz0, rw, rh);
      c.strokeStyle = `rgba(225,238,255,${0.35 + 0.45 * t})`;
      c.lineWidth = 1;
      c.strokeRect(rx0 + 0.5, rz0 + 0.5, rw - 1, rh - 1);
      if (rw > 14 && rh > 14 && !glass) {
        c.fillStyle = "rgba(10,20,50,.18)";
        c.fillRect(rx0 + rw * 0.3, rz0 + rh * 0.3, rw * 0.28, rh * 0.22);
      } // rooftop bulkhead
    }
    // avenue names
    c.fillStyle = "rgba(170,200,255,.34)";
    c.font = `800 ${Math.round(13 * PXM)}px ${FONT}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const a of f.avenueNames || [])
      for (const zz of [-2900, -300, 500, 1300]) {
        c.save();
        c.translate(X(a.x), Z(zz));
        c.rotate(-Math.PI / 2);
        c.fillText(a.name, 0, 0);
        c.restore();
      }
    c.fillStyle = "rgba(150,200,255,.22)";
    c.font = `800 ${Math.round(34 * PXM)}px ${FONT}`;
    for (const [x, z, t] of [
      [925, -300, "E A S T   R I V E R"],
      [-1150, -300, "H U D S O N   R I V E R"],
      [925, 1500, "E A S T   R I V E R"],
      [-1150, 1500, "H U D S O N   R I V E R"],
    ]) {
      c.save();
      c.translate(X(x), Z(z));
      c.rotate(-Math.PI / 2);
      c.fillText(t, 0, 0);
      c.restore();
    }
    // A single block-centre readback catches a silently failed canvas allocation without
    // forcing the large map canvas into a readback-optimized backing store.
    const blocks = f.blocks || [];
    const probe = blocks[Math.floor(blocks.length / 2)];
    if (probe) {
      const d = c.getImageData(
        Math.floor(X((probe.x0 + probe.x1) / 2)),
        Math.floor(Z((probe.z0 + probe.z1) / 2)),
        1,
        1,
      ).data;
      if (!(d[3] > 0 && d[0] + d[1] + d[2] > 20)) failBase();
    }
  }
  let baseFails = 0;
  function failBase() {
    baseFails++;
    base = null;
    baseMips = null;
    if (baseFails < 4) PXM *= 0.7;
    console.warn(
      "[map] base map canvas failed, retrying at",
      PXM.toFixed(2),
      "px/m",
    );
  }

  // scrambled pattern for locked districts
  const pat = (() => {
    const p = document.createElement("canvas");
    p.width = p.height = 48;
    const q = p.getContext("2d");
    q.fillStyle = "rgba(4,8,22,.18)";
    q.fillRect(0, 0, 48, 48);
    q.strokeStyle = "rgba(227,38,47,.16)";
    q.lineWidth = 2;
    for (let i = -48; i < 96; i += 12) {
      q.beginPath();
      q.moveTo(i, 0);
      q.lineTo(i + 48, 48);
      q.stroke();
    }
    for (let i = 0; i < 90; i++) {
      q.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      q.fillRect(Math.random() * 48, Math.random() * 48, 2, 1);
    }
    return p;
  })();
  let pattern = null;
  // the base map bakes text: rebuild once the local UI font is ready
  document.fonts
    ?.load?.(`800 16px ${FONT}`)
    .then(() => {
      base = null;
      dirty = true;
    })
    .catch(() => {});

  // ---------------------------------------------------------------- view
  const view = { x: 0, z: 0, s: 0.55 };
  let W = 0,
    H = 0,
    dpr = 1,
    dirty = true,
    hover = null,
    mouse = null,
    drag = null,
    time = 0,
    pulse = 0;
  const toS = (x, z) => [
    (x - view.x) * view.s * dpr + W / 2,
    (z - view.z) * view.s * dpr + H / 2,
  ];
  const toSY = (x, y, z) => toS(x + y * K_E, z - y * K_UP); // oblique 3D projection (matches the extruded base map)
  const _cd = new THREE.Vector3();
  const toW = (sx, sy) => [
    (sx * dpr - W / 2) / (view.s * dpr) + view.x,
    (sy * dpr - H / 2) / (view.s * dpr) + view.z,
  ];
  const LAND = { x0: -820, x1: 900, z0: -3540, z1: 3390 };
  function clampView() {
    const cw = (W || innerWidth * dpr) / dpr,
      ch = (H || innerHeight * dpr) / dpr;
    const minS =
      Math.min(cw / (LAND.x1 - LAND.x0), ch / (LAND.z1 - LAND.z0)) * 0.96;
    view.s = THREE.MathUtils.clamp(view.s, Math.max(0.12, minS), 2.4);
    const hw = cw / 2 / view.s,
      hh = ch / 2 / view.s;
    view.x =
      LAND.x1 - LAND.x0 <= hw * 2
        ? (LAND.x0 + LAND.x1) / 2
        : THREE.MathUtils.clamp(view.x, LAND.x0 + hw, LAND.x1 - hw);
    view.z =
      LAND.z1 - LAND.z0 <= hh * 2
        ? (LAND.z0 + LAND.z1) / 2
        : THREE.MathUtils.clamp(view.z, LAND.z0 + hh, LAND.z1 - hh);
  }
  // tower payoff: fly to the district and play the unscramble
  let revealAnim = null;
  function reveal(id) {
    const d = data.districts.find((x) => x.id === id);
    if (!d) return;
    const r = d.rect,
      x0 = Math.max(r.x0, LAND.x0),
      x1 = Math.min(r.x1, LAND.x1);
    const cw = cv.getBoundingClientRect().width || innerWidth,
      ch = cv.getBoundingClientRect().height || innerHeight;
    view.x = (x0 + x1) / 2;
    view.z = (r.z0 + r.z1) / 2;
    view.s = Math.min(cw / (x1 - x0), ch / (r.z1 - r.z0)) * 0.7;
    clampView();
    revealAnim = { id, t: 0, auto: true };
    audio.sfx.district?.();
    const h = el.querySelector(".reveal-hint");
    h.querySelector("b").textContent = d.name;
    h.classList.add("on");
  }
  function center() {
    const p = ctx.player.position;
    view.x = p.x;
    view.z = p.z;
    clampView();
    dirty = true;
  }

  const revealed = (id) => sys.towers.revealed(id);
  function items() {
    const st = save.state,
      out = [];
    for (const t of data.towers)
      out.push({
        cat: "tower",
        kind: st.towers.includes(t.id) ? "towerDone" : "tower",
        x: t.pos.x,
        z: t.pos.z,
        obj: t,
        title: t.name,
        cap: st.towers.includes(t.id) ? "Activated" : "Research Tower",
        text: st.towers.includes(t.id)
          ? "District scanned. Collectibles revealed."
          : "Reach the rooftop and hold [F] to activate. Reveals this district.",
      });
    for (const s of data.stations) {
      const on = st.stations.includes(s.id);
      out.push({
        cat: "station",
        kind: on ? "station" : "stationLocked",
        x: s.pos.x,
        z: s.pos.z,
        obj: s,
        title: s.name,
        cap: on ? "Fast Travel" : "Subway Station — Locked",
        text: on
          ? "Take the subway to travel here instantly."
          : "Activate this district's research tower to unlock fast travel.",
        station: on ? s : null,
      });
    }
    for (const b of data.backpacks)
      if (revealed(b.district) || st.backpacks.includes(b.id)) {
        const got = st.backpacks.includes(b.id);
        out.push({
          cat: "backpack",
          kind: got ? "done" : "backpack",
          x: b.pos.x,
          z: b.pos.z,
          obj: b,
          title: got ? b.item : "Backpack",
          cap: got
            ? "Collected"
            : b.mount === "roof"
              ? "Rooftop"
              : b.mount === "wall"
                ? "Webbed to a wall"
                : "Ground level",
          text: got
            ? b.desc
            : "One of Peter's old backpacks, webbed up years ago.",
          small: got,
        });
      }
    for (const l of data.landmarks)
      if (revealed(l.district) || st.landmarks.includes(l.id)) {
        const got = st.landmarks.includes(l.id);
        out.push({
          cat: "landmark",
          kind: got ? "done" : "landmark",
          x: l.target.x,
          z: l.target.z,
          obj: l,
          title: l.name,
          cap: got ? "Photographed" : "Landmark",
          text: got
            ? l.desc
            : "Get it in frame and press [F] (or use Photo Mode).",
          small: got,
        });
      }
    for (const p of data.secretPhotos)
      if (revealed(p.district) || st.secretPhotos.includes(p.id)) {
        const got = st.secretPhotos.includes(p.id);
        const o =
          p.area ||
          (p.area = {
            x: p.pos.x + Math.sin(p.pos.z) * 45,
            z: p.pos.z + Math.cos(p.pos.x) * 45,
          });
        out.push({
          cat: "photo",
          kind: got ? "done" : "photo",
          x: got ? p.pos.x : o.x,
          z: got ? p.pos.z : o.z,
          area: !got,
          obj: p,
          title: "Secret Photo",
          cap: got ? "Matched" : "Somewhere around here",
          text: p.hint,
          small: got,
        });
      }
    const c = sys.crimes.active;
    if (c)
      out.push({
        cat: "crime",
        kind: c.icon,
        x: c.pos.x,
        z: c.pos.z,
        obj: c,
        title: c.title,
        cap: "Crime in progress",
        text: c.text,
      });
    return out.filter((i) => filters[i.cat]);
  }

  function itemY(it) {
    const o = it.obj;
    if (it.cat === "landmark") return o.fp?.h ?? o.target?.y ?? 0;
    if (it.cat === "photo" && it.area) return 0;
    return o.pos?.y ?? 0;
  }
  // district names: placed at the candidate spot inside each district that overlaps the fewest icons and none of
  // the HUD panels (legend / key hints / info card), then fitted to the district's on-screen width
  const _panels = [];
  function panelRects() {
    const cr = cv.getBoundingClientRect();
    _panels.length = 0;
    for (const e of [
      el.querySelector(".legend"),
      el.querySelector(".zoomhint"),
      card.classList.contains("hide") ? null : card,
      el.querySelector(".reveal-hint.on"),
    ]) {
      if (!e) continue;
      const r = e.getBoundingClientRect();
      _panels.push([
        (r.left - cr.left - 12) * dpr,
        (r.top - cr.top - 8) * dpr,
        (r.right - cr.left + 12) * dpr,
        (r.bottom - cr.top + 8) * dpr,
      ]);
    }
    return _panels;
  }
  const ov = (a, b) =>
    Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
    Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  function drawLabels(proj, S, hoverD) {
    const panels = panelRects();
    const icons = proj.map((p) => [
      p.X - S * 0.6,
      p.Y - S * 0.6,
      p.X + S * 0.6,
      p.Y + S * 0.6,
    ]);
    // keep names off the GPS route: sample it every ~24 px as small obstacles
    const route = travel.route;
    if (route && route.length > 1)
      for (let i = 1; i < route.length; i++) {
        const [ax, ay] = toS(route[i - 1][0], route[i - 1][1]),
          [bx, by] = toS(route[i][0], route[i][1]);
        const n = Math.max(
          1,
          Math.ceil(Math.hypot(bx - ax, by - ay) / (24 * dpr)),
        );
        for (let k = 0; k <= n; k++) {
          const x = ax + ((bx - ax) * k) / n,
            y = ay + ((by - ay) * k) / n;
          icons.push([x - 8 * dpr, y - 8 * dpr, x + 8 * dpr, y + 8 * dpr]);
        }
      }
    const fs = Math.round(
      THREE.MathUtils.clamp(30 * Math.pow(view.s / 0.55, 0.5), 18, 44) * dpr,
    );
    const placed = [];
    for (const d of data.districts) {
      const rx0 = Math.max(d.rect.x0, LAND.x0),
        rx1 = Math.min(d.rect.x1, LAND.x1);
      const [sx0, sy0] = toS(rx0, d.rect.z0),
        [sx1, sy1] = toS(rx1, d.rect.z1);
      if (sx1 < 0 || sx0 > W || sy1 < 0 || sy0 > H) continue;
      const lock = !revealed(d.id);
      const dw = (sx1 - sx0) * 0.86;
      g.save();
      g.textAlign = "center";
      g.textBaseline = "middle";
      let f2 = fs;
      g.font = `800 ${f2}px ${FONT}`;
      g.letterSpacing = `${Math.round(f2 * 0.18)}px`;
      let tw = g.measureText(d.name.toUpperCase()).width;
      if (tw > dw) {
        f2 = Math.max(11 * dpr, Math.floor((f2 * dw) / tw));
        g.font = `800 ${f2}px ${FONT}`;
        g.letterSpacing = `${Math.round(f2 * 0.18)}px`;
        tw = g.measureText(d.name.toUpperCase()).width;
      }
      const sf = Math.max(10 * dpr, Math.round(f2 * 0.42));
      // one uniform style; the status line only for the hovered district (locked ones get a small red marker)
      const hot = hoverD === d;
      const sub = !hot
        ? ""
        : lock
          ? "SIGNAL SCRAMBLED · FIND THE RESEARCH TOWER"
          : `${Math.round(districtPct(d) * 100)}% COMPLETE`;
      const bw = tw + f2 + 16 * dpr,
        bh = f2 * 1.9; // size from the name only so hovering never moves the label
      // visible part of the district (label must stay on screen)
      const vx0 = Math.max(sx0, 0) + bw / 2,
        vx1 = Math.min(sx1, W) - bw / 2,
        vy0 = Math.max(sy0, 0) + bh / 2,
        vy1 = Math.min(sy1, H) - bh / 2;
      if (vx1 < vx0 || vy1 < vy0) {
        g.restore();
        continue;
      }
      let best = null,
        bs = Infinity;
      for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7, 0.15, 0.85])
        for (const fy of [0.22, 0.1, 0.35, 0.5, 0.65, 0.8, 0.92]) {
          const X = vx0 + (vx1 - vx0) * fx,
            Y = vy0 + (vy1 - vy0) * fy,
            box = [X - bw / 2, Y - bh / 2, X + bw / 2, Y + bh / 2];
          let sc = Math.abs(fx - 0.5) * 30 + Math.abs(fy - 0.22) * 20;
          for (const r of icons) sc += (ov(box, r) / (S * S)) * 60;
          for (const r of panels) sc += ov(box, r) / (dpr * dpr);
          for (const r of placed) sc += ov(box, r) / 5;
          if (sc < bs) {
            bs = sc;
            best = [X, Y, box];
          }
        }
      const [X, Y, box] = best;
      placed.push(box);
      const Yt = Y - bh * 0.18;
      g.shadowColor = "rgba(0,6,24,.95)";
      g.shadowBlur = 10 * dpr;
      g.fillStyle = "rgba(255,255,255,.88)";
      g.fillText(d.name.toUpperCase(), X, Yt);
      if (lock) {
        const lx = X - tw / 2 - f2 * 0.55,
          ly = Yt,
          r = f2 * 0.2;
        g.shadowBlur = 0;
        g.fillStyle = "#e3262f";
        g.beginPath();
        g.moveTo(lx, ly - r);
        g.lineTo(lx + r, ly);
        g.lineTo(lx, ly + r);
        g.lineTo(lx - r, ly);
        g.closePath();
        g.fill();
      }
      if (sub) {
        g.shadowBlur = 6 * dpr;
        g.letterSpacing = `${Math.round(sf * 0.2)}px`;
        g.font = `800 ${sf}px ${FONT}`;
        const pc = districtPct(d);
        g.fillStyle = lock
          ? "#ff5a61"
          : pc >= 1
            ? "#f5c02e"
            : "rgba(170,205,255,.95)";
        // keep the (wider) status line fully on screen and clear of the side panels
        const sw = g.measureText(sub).width,
          lp = panels[0] ? panels[0][2] : 0,
          rp = panels[1] ? panels[1][0] : W;
        const yy = Yt + f2 * 0.88,
          overL = panels[0] && yy > panels[0][1] && yy < panels[0][3],
          overR = panels[1] && yy > panels[1][1] && yy < panels[1][3];
        const X2 = Math.min(
          Math.max(X, (overL ? lp : 0) + sw / 2 + 8 * dpr),
          (overR ? rp : W) - sw / 2 - 8 * dpr,
        );
        g.fillText(sub, X2, yy);
      }
      g.restore();
    }
  }
  function draw() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio);
    const w = Math.round(r.width * dpr),
      h = Math.round(r.height * dpr);
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    W = w;
    H = h;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = MAPC.bg;
    g.fillRect(0, 0, W, H);
    if (!base) buildBase();
    if (base) {
      // strong minification of a ~9 Mpx canvas can fail silently on some GPU canvas paths: keep a half-res and a
      // quarter-res copy and pick the level closest to the on-screen scale
      if (!baseMips) {
        baseMips = [base];
        let src = base;
        for (let i = 0; i < 2; i++) {
          const m = document.createElement("canvas");
          m.width = Math.ceil(src.width / 2);
          m.height = Math.ceil(src.height / 2);
          const mg = m.getContext("2d");
          mg.imageSmoothingQuality = "high";
          mg.drawImage(src, 0, 0, m.width, m.height);
          baseMips.push(m);
          src = m;
        }
      }
      const k = (view.s * dpr) / PXM;
      const lvl = k < 0.35 ? 2 : k < 0.7 ? 1 : 0;
      const src = baseMips[lvl];
      const [sx, sy] = toS(bx0, bz0);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "medium";
      g.drawImage(
        src,
        sx,
        sy,
        (base.width / PXM) * view.s * dpr,
        (base.height / PXM) * view.s * dpr,
      );
      if (!drawChecked) {
        // the on-screen copy can fail too (huge source): readback one land texel under the player
        drawChecked = true;
        const [px, py] = toS(ctx.player.position.x, ctx.player.position.z);
        if (px > 0 && py > 0 && px < W && py < H) {
          const d = g.getImageData(px | 0, py | 0, 1, 1).data;
          const bgc = [10, 32, 72];
          if (
            Math.abs(d[0] - bgc[0]) +
              Math.abs(d[1] - bgc[1]) +
              Math.abs(d[2] - bgc[2]) <
            4
          ) {
            baseMips = null;
            if (baseFails < 4) failBase();
          }
        }
      }
    }
    // districts: locked ones are scrambled (animated static + red scanlines), the hovered one is outlined
    pattern = pattern || g.createPattern(pat, "repeat");
    let hoverD = null;
    if (mouse && !drag?.moved) {
      const [wx, wz] = toW(mouse.x, mouse.y);
      hoverD = data.districtAt(wx, wz);
    }
    for (const d of data.districts) {
      const [x0, y0] = toS(Math.max(d.rect.x0, LAND.x0), d.rect.z0),
        [x1, y1] = toS(Math.min(d.rect.x1, LAND.x1), d.rect.z1);
      const rv = revealAnim && revealAnim.id === d.id ? revealAnim : null;
      const k = rv ? THREE.MathUtils.smoothstep(rv.t, 0.4, 2.4) : 0; // 0 = scrambled, 1 = clear
      if (!revealed(d.id) || (rv && k < 1)) {
        g.save();
        g.beginPath();
        g.rect(x0, y0, x1 - x0, y1 - y0);
        g.clip();
        // locked: the city is still drawn, but desaturated, darkened and covered in drifting red static
        g.globalAlpha = 1 - k;
        g.globalCompositeOperation = "saturation";
        g.fillStyle = "#808080";
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.globalCompositeOperation = "source-over";
        g.fillStyle = "rgba(6,10,26,.42)";
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        const off = (time * 9) % 48;
        g.translate(off, 0);
        g.fillStyle = pattern;
        g.fillRect(x0 - 48 - off, y0, x1 - x0 + 96, y1 - y0);
        g.translate(-off, 0);
        // signal glitch: blocks of the district flicker / shear sideways (deterministic per 0.12 s tick)
        let sd = Math.floor(time * 8) * 131 + d.id.charCodeAt(0) * 7;
        const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
        g.globalAlpha = 1 - k;
        for (let i = 0; i < 10; i++) {
          const gy = y0 + rn() * (y1 - y0),
            gh = (4 + rn() * 22) * dpr,
            sh = (rn() - 0.5) * 40 * dpr;
          if (base && rn() < 0.6) {
            const [bsx, bsy] = toS(bx0, bz0),
              sc = (view.s * dpr) / PXM,
              src = baseMips?.[0] || base;
            g.drawImage(
              src,
              (x0 - bsx) / sc,
              (gy - bsy) / sc,
              (x1 - x0) / sc,
              gh / sc,
              x0 + sh,
              gy,
              x1 - x0,
              gh,
            );
          }
          g.fillStyle =
            rn() < 0.5 ? "rgba(227,38,47,.22)" : "rgba(120,170,255,.12)";
          g.fillRect(x0, gy, x1 - x0, gh * 0.3);
        }
        g.restore();
        if (rv) {
          // scan line sweeping down the district as it decodes
          const sy =
            y0 + (y1 - y0) * THREE.MathUtils.clamp((rv.t - 0.3) / 2.1, 0, 1);
          const gr = g.createLinearGradient(0, sy - 60 * dpr, 0, sy);
          gr.addColorStop(0, "rgba(90,200,255,0)");
          gr.addColorStop(1, "rgba(150,230,255,.55)");
          g.fillStyle = gr;
          g.fillRect(x0, sy - 60 * dpr, x1 - x0, 60 * dpr);
          g.fillStyle = "#dff6ff";
          g.fillRect(x0, sy - 1.5 * dpr, x1 - x0, 3 * dpr);
        }
      }
      if (hoverD === d && !rv) {
        g.fillStyle = revealed(d.id)
          ? "rgba(160,210,255,.07)"
          : "rgba(227,38,47,.08)";
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      const hot = hoverD === d || (rv && rv.t < 3.5);
      g.strokeStyle =
        rv && rv.t < 3.5
          ? `rgba(120,220,255,${0.9 - 0.2 * Math.sin(time * 8)})`
          : hot
            ? "rgba(255,255,255,.75)"
            : "rgba(190,215,255,.26)";
      g.lineWidth = (hot ? 2.2 : 1.4) * dpr;
      g.setLineDash(hot ? [] : [8 * dpr, 6 * dpr]);
      g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      g.setLineDash([]);
    }
    // GPS route
    const route = travel.route;
    if (route && route.length > 1) {
      g.save();
      g.lineJoin = g.lineCap = "round";
      g.beginPath();
      route.forEach(([x, z], i) => {
        const [X, Y] = toS(x, z);
        i ? g.lineTo(X, Y) : g.moveTo(X, Y);
      });
      g.strokeStyle = "rgba(10,6,0,.6)";
      g.lineWidth = 8 * dpr;
      g.stroke();
      g.shadowColor = "rgba(245,192,46,.8)";
      g.shadowBlur = 10 * dpr;
      g.strokeStyle = "#f5c02e";
      g.lineWidth = 4 * dpr;
      g.setLineDash([12 * dpr, 7 * dpr]);
      g.lineDashOffset = -time * 34 * dpr;
      g.stroke();
      g.restore();
    }
    // icons (painter's order by screen y); secret-photo search areas under everything
    const list = items();
    drawn = [];
    const S = Math.round(
      THREE.MathUtils.clamp(30 * Math.sqrt(view.s / 0.55), 22, 42) * dpr,
    );
    const proj = list
      .map((it) => {
        const [X, Y] = toSY(it.x, itemY(it), it.z);
        return { it, X, Y };
      })
      .sort((a, b) => a.Y - b.Y);
    // de-clutter: push overlapping (full-size) icons apart a little, a few relaxation passes
    const big = proj.filter((p) => !p.it.small && !p.it.area),
      minD = S * 0.95;
    for (let pass = 0; pass < 4; pass++)
      for (let i = 0; i < big.length; i++)
        for (let j = i + 1; j < big.length; j++) {
          const a = big[i],
            b = big[j];
          let dx = b.X - a.X,
            dy = b.Y - a.Y;
          const d = Math.hypot(dx, dy);
          if (d >= minD) continue;
          if (d < 0.01) {
            dx = 1;
            dy = 0;
          }
          const k = (minD - d) / 2 / Math.max(d, 0.01);
          a.X -= dx * k;
          a.Y -= dy * k;
          b.X += dx * k;
          b.Y += dy * k;
        }
    drawLabels(proj, S, hoverD);
    for (const { it, X, Y } of proj) {
      if (!it.area) continue;
      const [ax, ay] = toS(it.x, it.z);
      g.beginPath();
      g.arc(ax, ay, 70 * view.s * dpr, 0, 6.3);
      g.fillStyle = "rgba(168,96,216,.16)";
      g.fill();
      g.strokeStyle = "rgba(200,150,255,.6)";
      g.setLineDash([5 * dpr, 4 * dpr]);
      g.lineWidth = 1.5 * dpr;
      g.stroke();
      g.setLineDash([]);
    }
    // icons stay inside a padded area (clear of the top bar / footer edges and the scale + north-arrow corner)
    g.save();
    g.beginPath();
    g.rect(0, 14 * dpr, W, H - 34 * dpr);
    g.clip();
    for (const { it, X, Y } of proj) {
      if (X < -40 || Y < -40 || X > W + 40 || Y > H + 40) continue;
      if (X > W - 200 * dpr && Y > H - 120 * dpr) continue;
      if (it.small && view.s < 0.32) continue; // declutter when zoomed out
      const im = badgeImage(it.kind, 64);
      const s =
        (it.small ? S * 0.62 : S) *
        (hover === it ? 1.28 : 1) *
        (it.cat === "crime" ? 1 + 0.12 * Math.sin(time * 6) : 1);
      if (it.cat === "crime") {
        g.beginPath();
        g.arc(X, Y, s * (0.7 + (time % 1) * 0.9), 0, 6.3);
        g.strokeStyle = `rgba(227,38,47,${1 - (time % 1)})`;
        g.lineWidth = 2 * dpr;
        g.stroke();
      }
      if (im.complete) {
        g.save();
        g.globalAlpha = it.small ? 0.72 : 1;
        g.shadowColor = "rgba(0,4,20,.8)";
        g.shadowBlur = 6 * dpr;
        g.shadowOffsetY = 2 * dpr;
        g.drawImage(im, X - s / 2, Y - s / 2, s, s);
        g.restore();
      }
      drawn.push({ it, X, Y, r: s * 0.55 });
      if (it.cat === "landmark" && view.s > 0.42) {
        g.save();
        g.font = `800 ${Math.round(12 * dpr)}px ${FONT}`;
        g.letterSpacing = `${2 * dpr}px`;
        g.textAlign = "left";
        g.textBaseline = "middle";
        g.shadowColor = "rgba(0,6,24,.95)";
        g.shadowBlur = 6 * dpr;
        g.fillStyle = it.small ? "rgba(160,220,210,.7)" : "#9ff0e2";
        g.fillText((it.obj.name || it.title).toUpperCase(), X + s * 0.62, Y);
        g.restore();
      }
    }
    g.restore();
    // waypoint
    const wp = travel.waypoint;
    if (wp) {
      const [X, Y] = toS(wp.x, wp.z);
      const im = badgeImage("waypoint", 64);
      const s = S * 1.25,
        k = (time % 1.2) / 1.2;
      g.beginPath();
      g.moveTo(X, Y);
      g.lineTo(X, Y - s * 0.9);
      g.strokeStyle = "#f5c02e";
      g.lineWidth = 2 * dpr;
      g.stroke();
      if (im.complete) g.drawImage(im, X - s / 2, Y - s * 1.35, s, s);
      g.beginPath();
      g.ellipse(
        X,
        Y,
        s * (0.3 + k * 0.9),
        s * (0.3 + k * 0.9) * 0.55,
        0,
        0,
        6.3,
      );
      g.strokeStyle = `rgba(245,192,46,${1 - k})`;
      g.lineWidth = 2 * dpr;
      g.stroke();
    }
    // player (Spider-Man): heading wedge + pulsing ring, at his projected height
    {
      const p = ctx.player.position;
      const [X, Y] = toSY(p.x, Math.max(0, p.y - 1), p.z);
      const cd = ctx.camera.getWorldDirection(_cd);
      const ang = Math.atan2(cd.x, -cd.z);
      g.save();
      g.translate(X, Y);
      g.beginPath();
      g.arc(0, 0, 24 * dpr * (1 + 0.25 * Math.sin(time * 4)), 0, 6.3);
      g.fillStyle = "rgba(227,38,47,.18)";
      g.fill();
      g.rotate(ang);
      const cone = g.createRadialGradient(0, 0, 0, 0, 0, 60 * dpr);
      cone.addColorStop(0, "rgba(255,255,255,.35)");
      cone.addColorStop(1, "rgba(255,255,255,0)");
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 60 * dpr, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
      g.closePath();
      g.fillStyle = cone;
      g.fill();
      const s = 12 * dpr;
      g.shadowColor = "rgba(0,0,0,.7)";
      g.shadowBlur = 6 * dpr;
      g.beginPath();
      g.moveTo(0, -s * 1.35);
      g.lineTo(s, s);
      g.lineTo(0, s * 0.45);
      g.lineTo(-s, s);
      g.closePath();
      g.fillStyle = "#e3262f";
      g.fill();
      g.lineWidth = 2.5 * dpr;
      g.strokeStyle = "#fff";
      g.stroke();
      g.restore();
    }
    // cursor reticle
    if (mouse && !drag?.moved) {
      const X = mouse.x * dpr,
        Y = mouse.y * dpr;
      g.strokeStyle = "rgba(255,255,255,.9)";
      g.lineWidth = 1.5 * dpr;
      g.beginPath();
      g.arc(X, Y, 14 * dpr, 0, 6.3);
      g.stroke();
      for (const [a, b] of [
        [
          [-26, 0],
          [-18, 0],
        ],
        [
          [18, 0],
          [26, 0],
        ],
        [
          [0, -26],
          [0, -18],
        ],
        [
          [0, 18],
          [0, 26],
        ],
      ]) {
        g.beginPath();
        g.moveTo(X + a[0] * dpr, Y + a[1] * dpr);
        g.lineTo(X + b[0] * dpr, Y + b[1] * dpr);
        g.stroke();
      }
    }
    // scale bar + north arrow
    {
      const m = view.s > 1 ? 100 : view.s > 0.4 ? 200 : 500,
        L = m * view.s * dpr,
        bx = W - 40 * dpr,
        by = H - 26 * dpr;
      const pg = g.createLinearGradient(W - 220 * dpr, 0, W, 0);
      pg.addColorStop(0, "rgba(4,9,26,0)");
      pg.addColorStop(0.35, "rgba(4,9,26,.72)");
      pg.addColorStop(1, "rgba(4,9,26,.8)");
      g.fillStyle = pg;
      g.fillRect(W - 220 * dpr, H - 118 * dpr, 220 * dpr, 118 * dpr);
      g.fillStyle = "rgba(255,255,255,.75)";
      g.fillRect(bx - L, by, L, 2 * dpr);
      g.fillRect(bx - L, by - 5 * dpr, 2 * dpr, 7 * dpr);
      g.fillRect(bx - 2 * dpr, by - 5 * dpr, 2 * dpr, 7 * dpr);
      g.font = `800 ${13 * dpr}px ${FONT}`;
      g.letterSpacing = `${2 * dpr}px`;
      g.textAlign = "right";
      g.textBaseline = "alphabetic";
      g.fillText(`${m} M`, bx, by - 9 * dpr);
      const nx = W - 60 * dpr,
        ny = H - 90 * dpr;
      g.save();
      g.translate(nx, ny);
      g.beginPath();
      g.arc(0, 0, 18 * dpr, 0, 6.3);
      g.fillStyle = "rgba(4,9,26,.7)";
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.lineWidth = 1 * dpr;
      g.stroke();
      g.beginPath();
      g.moveTo(0, -13 * dpr);
      g.lineTo(6 * dpr, 3 * dpr);
      g.lineTo(-6 * dpr, 3 * dpr);
      g.closePath();
      g.fillStyle = "#e3262f";
      g.fill();
      g.fillStyle = "#fff";
      g.textAlign = "center";
      g.font = `800 ${11 * dpr}px ${FONT}`;
      g.letterSpacing = "0px";
      g.fillText("N", 0, 13 * dpr);
      g.restore();
      g.letterSpacing = "0px";
    }
  }
  let drawn = [];

  function districtParts(d) {
    const st = save.state;
    const bp = data.backpacks.filter((b) => b.district === d.id);
    const lm = data.landmarks.find((l) => l.district === d.id),
      sp = data.secretPhotos.find((s) => s.district === d.id);
    return [
      st.towers.includes("tower_" + d.id),
      ...bp.map((b) => st.backpacks.includes(b.id)),
      !!lm && st.landmarks.includes(lm.id),
      !!sp && st.secretPhotos.includes(sp.id),
    ];
  }
  function districtPct(d) {
    const p = districtParts(d);
    return p.filter(Boolean).length / p.length;
  }
  function updateLegend() {
    const st = save.state,
      cnt = (list, got) =>
        `${list.filter((x) => got.includes(x.id)).length}/${list.length}`;
    const counts = {
      tower: cnt(data.towers, st.towers),
      station: cnt(data.stations, st.stations),
      backpack: cnt(data.backpacks, st.backpacks),
      landmark: cnt(data.landmarks, st.landmarks),
      photo: cnt(data.secretPhotos, st.secretPhotos),
      crime: String(st.crimes.stopped),
    };
    rowsEl.querySelectorAll(".row").forEach((r) => {
      r.querySelector("span").textContent = counts[r.dataset.k];
    });
    let wx, wz;
    if (mouse) [wx, wz] = toW(mouse.x, mouse.y);
    else {
      wx = ctx.player.position.x;
      wz = ctx.player.position.z;
    }
    const d = data.districtAt(wx, wz);
    el.querySelector(".dist b").textContent = d.name;
    const bp = data.backpacks.filter((b) => b.district === d.id),
      got = bp.filter((b) => st.backpacks.includes(b.id)).length;
    const lm = data.landmarks.find((l) => l.district === d.id),
      sp = data.secretPhotos.find((s) => s.district === d.id);
    const pc = districtPct(d);
    el.querySelector(".dist .pbar i").style.width = pc * 100 + "%";
    el.querySelector(".dist small").textContent = revealed(d.id)
      ? `DISTRICT · ${Math.round(pc * 100)}% COMPLETE`
      : "DISTRICT · LOCKED";
    const cell = (k, v) =>
      `<span style="white-space:nowrap;margin-right:14px">${k} <b style="display:inline;font:inherit;color:#fff">${v}</b></span>`;
    el.querySelector(".dist .dprog").innerHTML =
      `<div style="font:600 13px var(--sys-head);letter-spacing:.12em;color:var(--sys-soft);margin-top:6px;line-height:1.7">${cell("BACKPACKS", `${got}/${bp.length}`)}${cell("LANDMARK", st.landmarks.includes(lm?.id) ? "✓" : "—")}${cell("PHOTO", st.secretPhotos.includes(sp?.id) ? "✓" : "—")}${cell("CRIMES", st.crimes.byDistrict[d.id] || 0)}</div>`;
  }

  function pick(mx, my) {
    let best = null,
      bd = Infinity;
    for (const d of drawn) {
      const dd = Math.hypot(d.X - mx * dpr, d.Y - my * dpr);
      if (dd < Math.max(d.r, 14 * dpr) && dd < bd) {
        bd = dd;
        best = d.it;
      }
    }
    return best;
  }
  function showCard(it, mx, my) {
    card.querySelector("small").textContent = it.cap;
    card.querySelector("h5").textContent = it.title;
    card.querySelector("p").textContent = it.text || "";
    const acts = card.querySelector(".acts");
    acts.innerHTML = "";
    const btn = (label, cls, fn) => {
      const b = document.createElement("button");
      b.className = "sys-btn " + cls;
      b.textContent = label;
      b.onclick = (e) => {
        e.stopPropagation();
        fn();
      };
      acts.appendChild(b);
    };
    if (it.station)
      btn("Fast Travel", "red", () => {
        hideCard();
        sys.pause.close(true);
        travel.fastTravel(it.station);
      });
    if (it.teleport)
      btn("Teleport Here", "red", () => {
        hideCard();
        sys.pause.close(true);
        travel.teleportTo(it.x, it.z);
      }); // (user r-mapteleport)
    btn("Set Waypoint", "", () => {
      travel.setWaypoint(new THREE.Vector3(it.x, 0, it.z));
      hideCard();
      dirty = true;
    });
    const r = el.getBoundingClientRect();
    card.style.left = Math.min(r.width - 320, mx + 24) + "px";
    card.style.top = Math.min(r.height - 200, Math.max(10, my - 40)) + "px";
    card.classList.remove("hide");
    audio.sfx.select();
  }
  function hideCard() {
    card.classList.add("hide");
  }

  const touch = () => {
    if (revealAnim) revealAnim.auto = false;
  };
  cv.addEventListener("mousedown", touch);
  cv.addEventListener("wheel", touch, { passive: true });
  cv.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      drag = {
        x: e.clientX,
        y: e.clientY,
        vx: view.x,
        vz: view.z,
        moved: false,
      };
      cv.classList.add("drag");
    }
  });
  addEventListener("mousemove", (e) => {
    if (!el.classList.contains("on")) return;
    const r = cv.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (drag) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      view.x = drag.vx - dx / view.s;
      view.z = drag.vz - dy / view.s;
      clampView();
    }
    const h = drag?.moved ? null : pick(mouse.x, mouse.y);
    if (h !== hover) {
      hover = h;
      if (h) audio.sfx.hover();
    }
    dirty = true;
  });
  addEventListener("mouseup", (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    cv.classList.remove("drag");
    if (d.moved || e.button !== 0 || !el.classList.contains("on")) return;
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left,
      my = e.clientY - r.top;
    const it = pick(mx, my);
    if (it) {
      showCard(it, mx, my);
      return;
    }
    hideCard();
    const [wx, wz] = toW(mx, my);
    const wp = travel.waypoint;
    const [sx, sy] = wp ? toS(wp.x, wp.z) : [1e9, 1e9];
    if (wp && Math.hypot(sx - mx * dpr, sy - my * dpr) < 22 * dpr) {
      travel.setWaypoint(null);
      dirty = true;
      return;
    }
    // (user r-mapteleport) empty spot: card with Teleport Here (drop in from the sky) + Set Waypoint
    const x = THREE.MathUtils.clamp(wx, -1490, 640),
      z = THREE.MathUtils.clamp(wz, -1590, 1590);
    showCard(
      {
        x,
        z,
        cap: "Map Location",
        title: "Drop In Here",
        text: "Teleport and fall in from the sky above this spot, or mark it with a waypoint.",
        teleport: true,
      },
      mx,
      my,
    );
    dirty = true;
  });
  cv.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (travel.waypoint) {
      travel.setWaypoint(null);
      dirty = true;
    }
    hideCard();
  });
  cv.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left,
        my = e.clientY - r.top;
      const [wx, wz] = toW(mx, my);
      view.s *= Math.exp(-e.deltaY * 0.0015);
      clampView();
      const [wx2, wz2] = toW(mx, my);
      view.x += wx - wx2;
      view.z += wz - wz2;
      clampView();
      dirty = true;
      hideCard();
    },
    { passive: false },
  );
  cv.addEventListener("mouseleave", () => {
    mouse = null;
    dirty = true;
  });

  const held = new Set();
  addEventListener("keyup", (e) => held.delete(e.code));

  return {
    id: "map",
    title: "Map",
    el,
    reveal,
    hints: [
      ["Click", "Waypoint"],
      ["R-Click", "Clear"],
      ["C", "Center"],
    ],
    footer: () =>
      `${save.state.towers.length}/${data.towers.length} DISTRICTS UNLOCKED`,
    show() {
      drawChecked = false;
      el.querySelector(".zoomhint").classList.remove("fade");
      clearTimeout(hintT);
      hintT = setTimeout(
        () => el.querySelector(".zoomhint").classList.add("fade"),
        5000,
      );
      center();
      hideCard();
      dirty = true;
      updateLegend();
      window.__sysMap = {
        toS: (x, z) => {
          const [a, b] = toS(x, z);
          return [a / dpr, b / dpr];
        },
        view,
      };
    },
    hide() {
      hideCard();
      held.clear();
      el.querySelector(".reveal-hint").classList.remove("on");
      revealAnim = null;
    },
    back() {
      if (!card.classList.contains("hide")) {
        hideCard();
        return true;
      }
      return false;
    },
    key(e) {
      touch();
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      ) {
        held.add(e.code);
        return true;
      }
      if (e.code === "Equal" || e.code === "NumpadAdd") {
        view.s *= 1.25;
        clampView();
        dirty = true;
        return true;
      }
      if (e.code === "Minus" || e.code === "NumpadSubtract") {
        view.s /= 1.25;
        clampView();
        dirty = true;
        return true;
      }
      if (e.code === "KeyC") {
        center();
        return true;
      }
      if (e.code === "KeyM") {
        sys.pause.close();
        return true;
      }
      return false;
    },
    update(dt) {
      time += dt;
      pulse += dt;
      if (revealAnim) {
        revealAnim.t += dt;
        if (revealAnim.t > 6) revealAnim = null;
      }
      const sp = (600 / view.s) * dt;
      if (held.has("KeyW") || held.has("ArrowUp")) view.z -= sp;
      if (held.has("KeyS") || held.has("ArrowDown")) view.z += sp;
      if (held.has("KeyA") || held.has("ArrowLeft")) view.x -= sp;
      if (held.has("KeyD") || held.has("ArrowRight")) view.x += sp;
      if (held.size) clampView();
      travel.update(0);
      draw();
      if (pulse > 0.25) {
        pulse = 0;
        updateLegend();
      }
    },
  };
}
