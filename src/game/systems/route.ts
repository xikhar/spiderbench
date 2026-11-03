// @ts-nocheck
// OWNER: systems engineer. GPS routing on the Manhattan street grid (Dijkstra over avenue x street intersections).
// Segments are only used if they're actually drivable road (streetsAt midpoint = avenue/street/intersection/drive),
// so routes go around the park and the closed T-junction street.
import { G, avenues, streets, streetsAt } from "../../world/layout.ts";

let graph = null;
function buildGraph() {
  const xs = [...avenues];
  const zs = streets;
  const nodes = [];
  const idx = (i, j) => i * zs.length + j;
  for (let i = 0; i < xs.length; i++)
    for (let j = 0; j < zs.length; j++)
      nodes.push({ x: xs[i], z: zs[j], adj: [] });
  const road = (x, z) => {
    const t = streetsAt(x, z).type;
    return (
      t === "avenue" || t === "street" || t === "intersection" || t === "drive"
    );
  };
  for (let i = 0; i < xs.length; i++)
    for (let j = 0; j < zs.length; j++) {
      const a = nodes[idx(i, j)];
      if (j + 1 < zs.length) {
        const b = nodes[idx(i, j + 1)];
        if (
          road(a.x, (a.z + b.z) / 2) &&
          road(a.x, a.z + 20) &&
          road(a.x, b.z - 20)
        ) {
          const w = b.z - a.z;
          a.adj.push([idx(i, j + 1), w]);
          b.adj.push([idx(i, j), w]);
        }
      }
      if (i + 1 < xs.length) {
        const b = nodes[idx(i + 1, j)];
        if (
          road((a.x + b.x) / 2, a.z) &&
          road(a.x + 30, a.z) &&
          road(b.x - 30, a.z)
        ) {
          const w = b.x - a.x;
          a.adj.push([idx(i + 1, j), w]);
          b.adj.push([idx(i, j), w]);
        }
      }
    }
  graph = { nodes, xs, zs };
  return graph;
}

// snap a point onto the nearest drivable road centre line -> {x, z, seeds:[[dist, nodeIdx]]} (seeds = both ends of that road segment)
function snapToRoad(x, z) {
  const { nodes, xs, zs } = graph;
  const idx = (i, j) => i * zs.length + j;
  const cands = [];
  // along an avenue (vertical segment between two streets)
  let i = 0,
    bd = Infinity;
  xs.forEach((ax, k) => {
    const d = Math.abs(ax - x);
    if (d < bd) {
      bd = d;
      i = k;
    }
  });
  let j = 0;
  while (j < zs.length - 2 && zs[j + 1] < z) j++;
  {
    const a = idx(i, j),
      b = idx(i, j + 1);
    if (nodes[a].adj.some(([n]) => n === b)) {
      const zz = Math.min(Math.max(z, zs[j]), zs[j + 1]);
      cands.push({
        x: xs[i],
        z: zz,
        d: Math.hypot(xs[i] - x, zz - z),
        seeds: [
          [zz - zs[j], a],
          [zs[j + 1] - zz, b],
        ],
      });
    }
  }
  // along a street (horizontal segment between two avenues)
  let jj = 0;
  bd = Infinity;
  zs.forEach((sz, k) => {
    const d = Math.abs(sz - z);
    if (d < bd) {
      bd = d;
      jj = k;
    }
  });
  let ii = 0;
  while (ii < xs.length - 2 && xs[ii + 1] < x) ii++;
  {
    const a = idx(ii, jj),
      b = idx(ii + 1, jj);
    if (nodes[a].adj.some(([n]) => n === b)) {
      const xx = Math.min(Math.max(x, xs[ii]), xs[ii + 1]);
      cands.push({
        x: xx,
        z: zs[jj],
        d: Math.hypot(xx - x, zs[jj] - z),
        seeds: [
          [xx - xs[ii], a],
          [xs[ii + 1] - xx, b],
        ],
      });
    }
  }
  cands.sort((p, q) => p.d - q.d);
  return cands[0] || null;
}

function nearestNodes(x, z, k = 4) {
  const { nodes } = graph;
  return nodes
    .map((n, i) => [Math.hypot(n.x - x, n.z - z), i])
    .filter(([, i]) => nodes[i].adj.length)
    .sort((a, b) => a[0] - b[0])
    .slice(0, k);
}

// returns [[x,z], ...] from (sx,sz) to (tx,tz) along roads (plus straight first/last legs)
export function findRoute(sx, sz, tx, tz) {
  if (!graph) buildGraph();
  const { nodes } = graph;
  const direct = Math.hypot(tx - sx, tz - sz);
  if (direct < 90)
    return [
      [sx, sz],
      [tx, tz],
    ];
  const N = nodes.length,
    dist = new Float64Array(N).fill(Infinity),
    prev = new Int32Array(N).fill(-1),
    done = new Uint8Array(N);
  const heap = [];
  const push = (d, i) => {
    heap.push([d, i]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1,
          r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  const s0 = snapToRoad(sx, sz),
    t0 = snapToRoad(tx, tz);
  for (const [d, i] of s0 ? s0.seeds : nearestNodes(sx, sz)) {
    if (d < dist[i]) {
      dist[i] = d;
      push(d, i);
    }
  }
  const goals = new Map(
    (t0 ? t0.seeds : nearestNodes(tx, tz)).map(([d, i]) => [i, d]),
  );
  let best = -1,
    bestD = Infinity;
  while (heap.length) {
    const [d, i] = pop();
    if (done[i]) continue;
    done[i] = 1;
    if (d >= bestD) break;
    if (goals.has(i) && d + goals.get(i) < bestD) {
      bestD = d + goals.get(i);
      best = i;
    }
    for (const [j, w] of nodes[i].adj) {
      const nd = d + w;
      if (nd < dist[j]) {
        dist[j] = nd;
        prev[j] = i;
        push(nd, j);
      }
    }
  }
  if (best < 0)
    return [
      [sx, sz],
      [tx, tz],
    ];
  const path = [];
  for (let i = best; i >= 0; i = prev[i]) path.push([nodes[i].x, nodes[i].z]);
  path.reverse();
  // enter / leave the road network at the snapped points (no diagonal legs across blocks); if the snapped point
  // lies on the first/last segment itself, the node before/after it is behind us -> drop it
  const onSeg = (p, a, b) =>
    Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) <
      1 &&
    (p[0] - a[0]) * (p[0] - b[0]) <= 0.5 &&
    (p[1] - a[1]) * (p[1] - b[1]) <= 0.5;
  if (s0 && path.length > 1 && onSeg([s0.x, s0.z], path[0], path[1]))
    path.shift();
  if (
    t0 &&
    path.length > 1 &&
    onSeg([t0.x, t0.z], path[path.length - 2], path[path.length - 1])
  )
    path.pop();
  const out = [[sx, sz]];
  if (s0) out.push([s0.x, s0.z]);
  out.push(...path);
  if (t0) out.push([t0.x, t0.z]);
  out.push([tx, tz]);
  return out;
}

export function routeLength(path) {
  let L = 0;
  for (let i = 1; i < path.length; i++)
    L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return L;
}

export function roadGraph() {
  return graph || buildGraph();
}
