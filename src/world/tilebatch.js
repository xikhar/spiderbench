// OWNER: perf agent. (perf r2) Fewer draws for per-tile static meshes that share one material: tiles are grouped into
// 2x2 SUPER-TILES (512 m). Each super-tile's geometry is one merged BufferGeometry; every tile is a Mesh drawing its
// own index sub-range of the SAME buffers (shared BufferAttributes -> no extra GPU memory). When all tiles of a super-
// tile want the same state (drawn, same shadow flag) the super-tile mesh draws them in ONE call; otherwise the tiles
// draw individually, exactly as before. Per-tile show / hide and shadow ranges are unchanged -> no visible change.
//
// (THREE.BatchedMesh was tried first: one multi-draw per pass, but under Chrome/ANGLE its multi-draws stalled the GPU
// process for ~100 ms per frame -- the game fell to ~2 fps.)
//
//   const b = batchTiles(geoms, material, 'facadeLod', { castShadow, receiveShadow, smallCasters, renderOrder, merge }, centers);
//   merge: false -> one mesh per tile (same API): for the big geometries, whose merged copies raised the city build's
//   peak memory enough to crash the renderer tab (page crash after [rooftops] at 640x360)
//   centers[i] = [cx, cz] of tile i;  b.meshes: add them to the scene;  b.setVisible(i, bool);  b.setShadow(i, bool)
//   (geoms[] entries are consumed: set to null once merged)
import * as THREE from "three";

// A/B switches: ?perf2off disables every round-2 change; ?nobatch / ?nowarm / ?noproxy / ?nowedge / ?nocrowdopt / ?noucache one each
const Q =
  typeof location !== "undefined"
    ? new URLSearchParams(location.search)
    : new URLSearchParams();
export const perf2Off = (k) => Q.has("perf2off") || Q.has(k);
const NOBATCH = perf2Off("nobatch"),
  NOWARM = perf2Off("nowarm");
const SUPER = 512;
const UPLOAD_MAT = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthWrite: false,
  depthTest: false,
}); // (perf r2) warm() helper

const sig = (g) =>
  Object.keys(g.attributes)
    .sort()
    .map(
      (k) =>
        k +
        g.attributes[k].itemSize +
        (g.attributes[k].normalized ? "n" : "") +
        g.attributes[k].array.constructor.name,
    )
    .join(",") + (g.index ? "|i" : "");

function mk(g, material, name, o) {
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.castShadow = !!o.castShadow;
  m.receiveShadow = !!o.receiveShadow;
  if (o.smallCasters) m.userData.smallCasters = true;
  if (o.renderOrder) m.renderOrder = o.renderOrder;
  return m;
}

export function batchTiles(geoms, material, name, o = {}, centers = []) {
  const n = geoms.length;
  const tile = new Array(n).fill(null); // i -> { m, grp, vis, sh }
  const groups = [];
  const meshes = [];
  // group tiles by super cell (and attribute signature: merged geometries need identical layouts)
  const byKey = new Map();
  for (let i = 0; i < n; i++) {
    const g = geoms[i];
    if (!g) continue;
    const c = centers[i] || [0, 0];
    const k =
      (NOBATCH || o.merge === false
        ? "i" + i
        : Math.floor(c[0] / SUPER) + "," + Math.floor(c[1] / SUPER)) +
      "|" +
      (g.index ? sig(g) : "noindex" + i);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(i);
  }
  for (const idx of byKey.values()) {
    const grp = { tiles: idx, sup: null, nVis: 0 };
    if (idx.length === 1) {
      // nothing to merge: the tile keeps its own geometry
      const i = idx[0],
        m = mk(geoms[i], material, name + " " + i, o);
      tile[i] = { m, grp, vis: true, sh: true };
      meshes.push(m);
      geoms[i] = null;
      grp.nVis = 1;
      groups.push(grp);
      continue;
    }
    // merge: vertices and indices of the tiles back to back
    let nv = 0,
      ni = 0;
    for (const i of idx) {
      nv += geoms[i].attributes.position.count;
      ni += geoms[i].index.count;
    }
    const G = new THREE.BufferGeometry(),
      g0 = geoms[idx[0]];
    for (const [k, a0] of Object.entries(g0.attributes)) {
      const arr = new a0.array.constructor(nv * a0.itemSize);
      let off = 0;
      for (const i of idx) {
        const a = geoms[i].attributes[k].array;
        arr.set(a, off);
        off += a.length;
      }
      G.setAttribute(
        k,
        new THREE.BufferAttribute(arr, a0.itemSize, a0.normalized),
      );
    }
    const I = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
    const ranges = [];
    let vo = 0,
      io = 0;
    for (const i of idx) {
      const g = geoms[i],
        src = g.index.array;
      for (let j = 0; j < src.length; j++) I[io + j] = src[j] + vo;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (!g.boundingBox) g.computeBoundingBox();
      ranges.push([io, src.length, g.boundingSphere, g.boundingBox]);
      vo += g.attributes.position.count;
      io += src.length;
      g.dispose();
      geoms[i] = null; // never uploaded; frees the typed arrays (the city build peaks near the heap limit)
    }
    const IA = new THREE.BufferAttribute(I, 1);
    G.setIndex(IA);
    G.computeBoundingSphere();
    G.computeBoundingBox();
    const sup = mk(G, material, name + " super", o);
    sup.visible = false;
    meshes.push(sup);
    grp.sup = sup;
    idx.forEach((i, k) => {
      // the tile: same buffers, its own index range + bounds
      const [start, count, bs, bb] = ranges[k];
      const g = new THREE.BufferGeometry();
      for (const [key, a] of Object.entries(G.attributes))
        g.setAttribute(key, a);
      g.setIndex(IA);
      g.setDrawRange(start, count);
      g.boundingSphere = bs;
      g.boundingBox = bb;
      g.userData.sharedRange = true;
      const m = mk(g, material, name + " " + i, o);
      tile[i] = { m, grp, vis: true, sh: true };
      meshes.push(m);
    });
    grp.nVis = idx.length;
    groups.push(grp);
  }
  // pick super-tile vs individual tiles for a group after a change
  const resolve = (grp) => {
    if (!grp.sup) {
      const t = tile[grp.tiles[0]];
      t.m.visible = t.vis;
      t.m.castShadow = t.sh && !!o.castShadow;
      return;
    }
    let all = true,
      sh0 = null,
      same = true;
    for (const i of grp.tiles) {
      const t = tile[i];
      if (!t.vis) {
        all = false;
        break;
      }
      if (sh0 === null) sh0 = t.sh;
      else if (t.sh !== sh0) same = false;
    }
    const useSup = all && same;
    grp.sup.visible = useSup;
    grp.sup.castShadow = useSup && sh0 && !!o.castShadow;
    for (const i of grp.tiles) {
      const t = tile[i];
      t.m.visible = !useSup && t.vis;
      t.m.castShadow = t.sh && !!o.castShadow;
    }
  };
  for (const grp of groups) resolve(grp);
  // (perf r2) pre-upload: uploading a facade tile's vertex buffers (~15-20 MB, 16 attributes) in the frame the tile
  // appears cost 100-150 ms hitches while swinging. warm(i) uploads ONE of the tile's buffers per call through a hidden
  // helper mesh (empty draw range: three uploads a geometry's attributes when it projects a visible mesh; the GL buffer
  // is cached per BufferAttribute, so the real tile reuses it). Returns false once everything is uploaded.
  const upG = new THREE.BufferGeometry();
  upG.setDrawRange(0, 0);
  const upM = new THREE.Mesh(upG, UPLOAD_MAT);
  upM.name = name + " upload";
  upM.frustumCulled = false;
  upM.visible = false;
  meshes.push(upM);
  const endWarm = () => {
    upM.visible = false;
  };
  return {
    mesh: meshes[0] ?? null,
    meshes,
    warm(i) {
      const t = tile[i];
      if (!t || NOWARM) return false;
      const g = t.m.geometry;
      if (!t.wq)
        t.wq = [...Object.keys(g.attributes), g.index ? "#index" : null].filter(
          Boolean,
        );
      if (!t.wq.length) return false;
      const k = t.wq.shift();
      for (const n of Object.keys(upG.attributes)) upG.deleteAttribute(n);
      upG.setIndex(null);
      if (k === "#index") {
        upG.setAttribute("position", g.attributes.position);
        upG.setIndex(g.index);
      } else
        upG.setAttribute(k === "position" ? k : "position", g.attributes[k]); // any name: only the buffer matters
      upM.visible = true;
      return true;
    },
    endWarm,
    has: (i) => !!tile[i],
    setVisible(i, v) {
      const t = tile[i];
      if (!t || t.vis === v) return;
      t.vis = v;
      resolve(t.grp);
    },
    setShadow(i, v) {
      const t = tile[i];
      if (!t || t.sh === v) return;
      t.sh = v;
      resolve(t.grp);
    },
  };
}
