// OWNER: citylife engineer. Road network shared by traffic (npc/traffic.js) and pedestrians (npc/crowd.js):
// intersections (nodes) on the avenue x street grid incl. the waterfront drive, directed lane links between them,
// turn connectors (cubic Bezier through the intersection box) and crosswalk ids.
// Axes: +x east, -z north. Avenues two-way (2 moving lanes each way + parking), streets one-way (alternating), drive two-way.
import { bridgeSpans, roadProfile } from "../bridges.js"; // (citylife bridges)
import {
    G,
    avenues,
    streets,
    avActive,
    stRange,
    DIAG_SEGS,
    diagD,
    streetsAt,
    VMAP,
    MAPS,
    PARK_AV_I,
    PARK_MEDIAN,
    parkMedianAt,
    ROUNDABOUT,
    stHalf,
    stWide,
    stNarrow,
} from "../layout.js"; // (layout2 r3) Park Av median; (layout2 r9) per-street widths

export const DRIVE_C = 1e9; // (legacy: no straight waterfront drive on the island map)
export const STOP_BACK = 5.0; // stop line distance from the intersection box edge (crosswalk + line)
export const streetDir = (j) => (j % 2 === 0 ? 1 : -1);
// (citylife junctions r2) signal phase of the street-map junctions (Village / FiDi interior nodes): an even 18 s + 2 s
// amber split instead of the grid's avenue-biased 22 / 11 s (props.js drives their signal heads with it too)
export const mapPhase = (t, ax) => {
    const c = ((t % 40) + 40) % 40;
    return ax === "av"
        ? c < 18
            ? 2
            : c < 20
              ? 1
              : 0
        : c < 20
          ? 0
          : c < 38
            ? 2
            : 1;
}; // +1 eastbound (same convention as ground.js / props.js)

export function buildRoads() {
    const X = [...avenues];
    const HW = X.map(() => G.AV_HALF);
    const Z = streets;
    const nx = X.length,
        nz = Z.length;
    const nodeId = (i, j) =>
        i < 0 || i >= nx || j < 0 || j >= nz ? -1 : j * nx + i;
    const avSeg = (i, j) => j + 1 < nz && avActive(i, j);
    // a street link needs the full segment between both avenues (clipped dead-end stubs at the promenade carry no traffic)
    const stSeg = (i, j) => {
        if (i < 0 || i + 1 >= nx) return false;
        const s = stRange(j, 2 * (i + 1));
        return (
            !!s &&
            Math.abs(s[0] - (X[i] + G.AV_HALF)) < 1e-3 &&
            Math.abs(s[1] - (X[i + 1] - G.AV_HALF)) < 1e-3
        );
    };
    const nodes = [];
    for (let j = 0; j < nz; j++)
        for (let i = 0; i < nx; i++) {
            const has =
                avSeg(i, j) ||
                (j > 0 && avSeg(i, j - 1)) ||
                stSeg(i, j) ||
                (i > 0 && stSeg(i - 1, j));
            nodes.push(
                has
                    ? {
                          id: nodeId(i, j),
                          i,
                          j,
                          x: X[i],
                          z: Z[j],
                          hw: HW[i],
                          hz: stHalf(j),
                          inLinks: [],
                          outLinks: [],
                          av: avSeg(i, j) || (j > 0 && avSeg(i, j - 1)),
                          st: stSeg(i, j) || (i > 0 && stSeg(i - 1, j)),
                          drive: false,
                      }
                    : null,
            );
        }
    const links = [];
    const mk = (from, to, ax, az, dx, dz, len, kind, lane) => {
        const L = {
            id: links.length,
            from,
            to,
            ax,
            az,
            dx,
            dz,
            len,
            kind,
            axis: kind === "st" || kind === "ws" ? "st" : "av",
            lane, // (layout2 r9) 'ws': wide two-way street (multi-lane like an avenue, street phase)
            stopS: len - STOP_BACK,
            out: null,
            conn: new Map(),
            cars: [],
            parked: null,
            active: false,
            heading: 0,
            cx: ax + (dx * len) / 2,
            cz: az + (dz * len) / 2,
        };
        L.heading = Math.atan2(dz, dx);
        links.push(L);
        nodes[from].outLinks.push(L);
        nodes[to].inLinks.push(L);
        return L;
    };
    for (let j = 0; j < nz; j++)
        for (let i = 0; i < nx; i++) {
            if (avSeg(i, j)) {
                const a = nodeId(i, j),
                    b = nodeId(i, j + 1);
                const z0 = Z[j] + stHalf(j),
                    z1 = Z[j + 1] - stHalf(j + 1),
                    len = z1 - z0,
                    kind = "av";
                // (layout2 r3) Park Av median: both lanes shift outward beside it, no curb parking
                const med = i === PARK_AV_I && parkMedianAt(j),
                    l0 = med ? PARK_MEDIAN.lane0 : 1.8,
                    l1 = med ? PARK_MEDIAN.lane1 : 5.4;
                const sb = [
                    mk(a, b, X[i] - l0, z0, 0, 1, len, kind, 0),
                    mk(a, b, X[i] - l1, z0, 0, 1, len, kind, 1),
                ]; // southbound (+z)
                const nb = [
                    mk(b, a, X[i] + l0, z1, 0, -1, len, kind, 0),
                    mk(b, a, X[i] + l1, z1, 0, -1, len, kind, 1),
                ]; // northbound (-z)
                if (med) for (const L of [...sb, ...nb]) L.noPark = true;
            }
            if (stSeg(i, j)) {
                const d = streetDir(j);
                const x0 = X[i] + HW[i],
                    x1 = X[i + 1] - HW[i + 1],
                    len = x1 - x0,
                    z = Z[j] + 0.6 * d;
                if (stWide(j)) {
                    // (layout2 r9) wide crosstown street: two-way, 2 lanes each way (1.6 / 4.9 m off the centre) + curb parking
                    const A = nodeId(i, j),
                        B = nodeId(i + 1, j);
                    for (const [l, o] of [
                        [0, 1.6],
                        [1, 4.9],
                    ]) {
                        const e = mk(A, B, x0, Z[j] + o, 1, 0, len, "ws", l),
                            w = mk(B, A, x1, Z[j] - o, -1, 0, len, "ws", l);
                        if (l === 1) e.parkSides = w.parkSides = [2.9];
                    }
                } else if (stNarrow(j)) {
                    // (layout2 r9) narrow side street: one lane left of the centre, one parking lane on the right
                    const zl = Z[j] - 1.0 * d;
                    const L =
                        d > 0
                            ? mk(
                                  nodeId(i, j),
                                  nodeId(i + 1, j),
                                  x0,
                                  zl,
                                  1,
                                  0,
                                  len,
                                  "st",
                                  0,
                              )
                            : mk(
                                  nodeId(i + 1, j),
                                  nodeId(i, j),
                                  x1,
                                  zl,
                                  -1,
                                  0,
                                  len,
                                  "st",
                                  0,
                              );
                    L.parkSides = [3.5];
                    L.narrow = true;
                } else if (d > 0)
                    mk(
                        nodeId(i, j),
                        nodeId(i + 1, j),
                        x0,
                        z,
                        1,
                        0,
                        len,
                        "st",
                        0,
                    );
                else
                    mk(
                        nodeId(i + 1, j),
                        nodeId(i, j),
                        x1,
                        z,
                        -1,
                        0,
                        len,
                        "st",
                        0,
                    );
            }
        }
    buildDiagLinks({ X, Z, nodes, links, mk, nodeId }); // (layout2) Broadway + angled Village / FiDi streets
    buildVmapLinks({ X, Z, nodes, links, mk, nodeId }); // (layout2 r2) Village street map
    buildBridgeLinks(nodes, links, mk); // (citylife bridges) the five East River bridges as ordinary traffic links
    roundaboutLinks(nodes, links); // (layout2 r3) Columbus Circle: links pulled back to the ring, ring connectors
    // parallel lane of the same segment (lane changes around obstacles)
    for (const L of links) {
        if (L.kind === "st" || L.bridge) continue; // (citylife bridges) no lane changes across 3 bridge lanes
        const sib = nodes[L.from].outLinks.find(
            (O) => O !== L && O.to === L.to,
        );
        if (sib) L.alt = { link: sib, turn: "S", ok: true };
    }
    // turn options + opposing approaches
    for (const L of links) {
        const n = nodes[L.to];
        const opts = [];
        for (const O of n.outLinks) {
            const cr = L.dx * O.dz - L.dz * O.dx,
                dot = L.dx * O.dx + L.dz * O.dz;
            const turn =
                dot > 0.5 ? "S" : dot < -0.5 ? "U" : cr > 0 ? "R" : "L";
            if (turn === "U") continue;
            if (
                turn === "S" &&
                O.lane !== L.lane &&
                O.kind !== "st" &&
                L.kind !== "st"
            )
                continue; // stay in lane
            if (turn === "R" && O.kind !== "st" && O.lane !== 1) continue; // right turn -> curb lane
            if (turn === "L" && O.kind !== "st" && O.lane !== 0) continue; // left turn -> inner lane
            let ok = true;
            if (L.kind !== "st") {
                if (turn === "L" && L.lane !== 0) ok = false;
                if (turn === "R" && L.lane !== 1) ok = false;
            }
            opts.push({ link: O, turn, ok });
        }
        let good = opts.filter((o) => o.ok);
        if (!good.length) good = opts;
        if (!good.length) {
            // dead end (map edge): U-turn into the opposite lane
            for (const O of n.outLinks)
                if (
                    L.dx * O.dx + L.dz * O.dz < -0.5 &&
                    (O.lane === L.lane || O.kind === "st")
                )
                    good.push({ link: O, turn: "U", ok: true });
        }
        L.out = good;
        L.opp = n.inLinks.filter((I) => I.dx * L.dx + I.dz * L.dz < -0.5);
        L.signal = (n.av && n.st) || !!n.sig; // (citylife bridges) n.sig: a bridge's T onto its avenue / street
        if (L.diag) {
            // (layout2) off-grid link: phase of the crossing it ends at, or the dominant axis at a grid node
            if (L.xAxis) {
                L.signal = true;
                L.axis = L.xAxis;
            } else L.axis = Math.abs(L.dz) >= Math.abs(L.dx) ? "av" : "st";
        }
    }
    diagCrossStops(links); // (layout2) grid links stop before the off-grid crossings they pass mid-block
    goreOverlaps(nodes, links); // (citylife junctions) lane bodies overlapping near shallow-angle junctions
    // crosswalks: one per (node, leg). Crossing a leg of the intersection = walking across that road.
    const crosswalks = new Map();
    for (const n of nodes) {
        if (!n || !n.av || !n.st) continue;
        for (const leg of ["N", "S", "E", "W"]) {
            const hasLeg =
                leg === "N"
                    ? n.j > 0 && avSeg(n.i, n.j - 1)
                    : leg === "S"
                      ? avSeg(n.i, n.j)
                      : leg === "W"
                        ? n.i > 0 && stSeg(n.i - 1, n.j)
                        : stSeg(n.i, n.j);
            if (!hasLeg) continue;
            // centre + walking axis; the avenue legs (N/S) are crossed walking along x, the street legs along z
            const ns = leg === "N" || leg === "S";
            const c = ns
                ? { x: n.x, z: n.z + (leg === "N" ? -1 : 1) * (n.hz + 2.3) }
                : { x: n.x + (leg === "W" ? -1 : 1) * (n.hw + 2.3), z: n.z };
            crosswalks.set(n.id + leg, {
                key: n.id + leg,
                node: n,
                leg,
                x: c.x,
                z: c.z,
                alongX: ns,
                half: ns ? n.hw : n.hz,
                axis: ns ? "av" : "st",
                peds: 0,
            }); // `axis`: the traffic that crosses it; peds may walk when that axis is red
        }
    }
    for (const L of links) {
        const n = nodes[L.from];
        const leg =
            L.dz > 0.5 ? "S" : L.dz < -0.5 ? "N" : L.dx > 0.5 ? "E" : "W";
        L.xwStart = crosswalks.get(n.id + leg) || null;
        const m = nodes[L.to];
        const legE =
            L.dz > 0.5 ? "N" : L.dz < -0.5 ? "S" : L.dx > 0.5 ? "W" : "E";
        L.xwEnd = crosswalks.get(m.id + legE) || null;
    }
    return { X, Z, HW, nodes, links, crosswalks, nodeId, avSeg, stSeg, nx, nz };
}

// ------------------------------------------------------------------ (layout2) off-grid roads
// Every DIAG_SEGS segment is sampled along its roadway; the stretches over foreign asphalt (grid avenue / street /
// intersection, or another off-grid road) are crossings. Links run between crossings: a crossing mid-segment becomes a
// signalised pseudo-node (phase opposite to the crossed road), a segment end at a grid intersection joins that grid
// node (turn connectors to / from the avenues + streets), other ends (T into a street mid-block, bends) share a node
// keyed by position. Broadway: 2 lanes each way; 12 m streets: 1 lane each way; narrower ones: one-way.
function buildDiagLinks({ X, Z, nodes, links, mk, nodeId }) {
    const extra = new Map();
    const nodeAt = (x, z, key) => {
        const i = X.findIndex((v) => Math.abs(v - x) < 0.5),
            j = Z.findIndex((v) => Math.abs(v - z) < 0.5);
        if (i >= 0 && j >= 0 && nodes[nodeId(i, j)]) return nodes[nodeId(i, j)];
        const k = key ?? `${Math.round(x)},${Math.round(z)}`;
        if (!extra.has(k)) {
            const n = {
                id: nodes.length,
                i: -1,
                j: -1,
                x,
                z,
                hw: 0,
                hz: 0,
                inLinks: [],
                outLinks: [],
                av: false,
                st: false,
                drive: false,
                diag: true,
            };
            nodes.push(n);
            extra.set(k, n);
        }
        return extra.get(k);
    };
    let oneWay = 0;
    for (const seg of DIAG_SEGS) {
        const { ax, az, ux, uz, nx, nz, hw, len } = seg;
        const foreign = (x, z) => {
            const q = streetsAt(x, z),
                t = q.type;
            if (t === "avenue" || t === "intersection") return t;
            if (t === "street")
                return !q.diag
                    ? "street"
                    : q.diag.name === seg.name
                      ? null
                      : "d" + q.diag.id;
            return null;
        };
        const STEP = 0.5,
            runs = [];
        let cur = null;
        for (let s = 0; s <= len + 1e-6; s += STEP) {
            let t = null;
            for (let v = -hw; v <= hw + 1e-6 && !t; v += hw / 3)
                t = foreign(ax + ux * s + nx * v, az + uz * s + nz * v);
            if (t) {
                if (!cur) runs.push((cur = { s0: s, s1: s, types: {} }));
                cur.s1 = s;
                cur.types[t] = (cur.types[t] || 0) + 1;
            } else cur = null;
        }
        if (!runs.length || runs[0].s0 > 1)
            runs.unshift({ s0: 0, s1: 0, types: {} });
        if (runs[runs.length - 1].s1 < len - 1)
            runs.push({ s0: len, s1: len, types: {} });
        const R = [runs[0]]; // merge crossings closer than 12 m (a link needs room for a stop line and a car)
        for (let k = 1; k < runs.length; k++) {
            const p = R[R.length - 1],
                r = runs[k];
            if (r.s0 - p.s1 < 12) {
                p.s1 = r.s1;
                for (const t in r.types)
                    p.types[t] = (p.types[t] || 0) + r.types[t];
            } else R.push(r);
        }
        if (R.length < 2) continue;
        // node + stop phase of each crossing
        for (let k = 0; k < R.length; k++) {
            const r = R[k];
            const main =
                Object.entries(r.types).sort((a, b) => b[1] - a[1])[0]?.[0] ??
                null;
            r.node =
                k === 0
                    ? nodeAt(ax, az)
                    : k === R.length - 1
                      ? nodeAt(seg.bx, seg.bz)
                      : nodeAt(
                            ax + (ux * (r.s0 + r.s1)) / 2,
                            az + (uz * (r.s0 + r.s1)) / 2,
                            "x" + seg.id + ":" + k,
                        );
            const dom = Math.abs(uz) >= Math.abs(ux) ? "av" : "st";
            r.axis =
                main === "avenue"
                    ? "st"
                    : main === "street"
                      ? "av"
                      : main && main[0] === "d"
                        ? (() => {
                              const o = DIAG_SEGS[+main.slice(1)];
                              return Math.abs(uz) > Math.abs(o.uz) ||
                                  (Math.abs(uz) === Math.abs(o.uz) &&
                                      seg.id < o.id)
                                  ? "av"
                                  : "st";
                          })()
                        : dom;
            if (r.node.av || r.node.i >= 0) r.axis = null; // grid node: its own signal (dominant axis)
        }
        // (citylife junctions r2) shared lane segment: where Broadway runs into an avenue at a shallow angle (its end run over
        // the avenue asphalt is long), it joins the avenue at the grid node nearest to where it meets the avenue, and the
        // avenue lanes carry its traffic for that block; no 100+ m connectors sweeping across the avenue's lanes
        for (const k of [0, R.length - 1]) {
            const r = R[k],
                n0 = r.node;
            if (
                R.length < 2 ||
                !n0 ||
                n0.i < 0 ||
                r.s1 - r.s0 < 45 ||
                (Math.abs(n0.x - ROUNDABOUT.x) < 1 &&
                    Math.abs(n0.z - ROUNDABOUT.z) < 1)
            )
                continue;
            const sq = k === 0 ? r.s1 : r.s0,
                qz = az + uz * sq;
            let best = null;
            for (let j = 0; j < Z.length; j++) {
                const n = nodes[nodeId(n0.i, j)];
                if (
                    !n ||
                    !n.av ||
                    n === n0 ||
                    Math.abs(n.z - qz) > 30 ||
                    (n.z - n0.z) * (qz - n0.z) <= 0
                )
                    continue;
                if (!best || Math.abs(n.z - qz) < Math.abs(best.z - qz))
                    best = n;
            }
            const other = R[k === 0 ? 1 : R.length - 2].node;
            if (best && best !== other) r.node = best;
        }
        // (citylife junctions r2) Broadway south of Columbus Circle is one-way southbound (as in NYC): 2 lanes right of the
        // centre + curb parking both sides. Two-way, its northbound lanes had to cross the avenue's southbound lanes along the
        // whole shallow-angle gore at every bow-tie (up to 150 m head-on conflicts); one-way it merges into / diverges from
        // the avenue's own direction and crosses opposing lanes only near the node.
        const lower =
            seg.name === "BROADWAY" &&
            Math.min(seg.az, seg.bz) >= ROUNDABOUT.z - 1;
        const w = 2 * hw,
            lanes = lower
                ? [
                      [-1.2, 0],
                      [2.4, 1],
                  ]
                : w >= 14
                  ? [
                        [1.8, 0],
                        [5.4, 1],
                    ]
                  : w >= 12
                    ? [[w / 4, 0]]
                    : null;
        const kind = w >= 14 ? "dg" : "st";
        const dirs = lower
            ? [uz > 0 ? 1 : -1]
            : lanes
              ? [1, -1]
              : [oneWay++ % 2 ? -1 : 1];
        const L0 = lanes || [[0.6, 0]];
        for (let k = 0; k + 1 < R.length; k++) {
            const sa = R[k].s1 + 0.5,
                sb = R[k + 1].s0 - 0.5,
                l = sb - sa;
            if (l < 8) continue;
            for (const d of dirs)
                for (const [o, lane] of L0) {
                    const dx = ux * d,
                        dz = uz * d,
                        rx = -dz,
                        rz = dx; // right-hand side of travel
                    const s = d > 0 ? sa : sb;
                    const from = d > 0 ? R[k].node : R[k + 1].node,
                        to = d > 0 ? R[k + 1].node : R[k].node;
                    const L = mk(
                        from.id,
                        to.id,
                        ax + ux * s + rx * o,
                        az + uz * s + rz * o,
                        dx,
                        dz,
                        l,
                        kind,
                        lane,
                    );
                    L.diag = seg;
                    L.noPark = !lower;
                    L.xAxis = (d > 0 ? R[k + 1] : R[k]).axis;
                    if (lower) {
                        L.oneWayBway = true;
                        if (lane === 1)
                            L.parkSides = [hw - 1.1 - o, -(hw - 1.1) - o];
                    }
                }
        }
    }
}
// (layout2 r2) Village street map: every VMAP segment is a two-way street (one lane each way, w/4 off the centre line)
// between nodes at its ends: a grid intersection on the seam roads, an interior Village intersection (signalised by the
// dominant axis) or a T onto a seam road mid-block (dead end: cars U-turn). Links are trimmed back from each node by the
// crossing roads' half-widths (angle-aware) so the turn connectors run through the junction box.
function buildVmapLinks(args) {
    for (const V of MAPS) buildMapLinks(V, args);
} // (layout2 r4) every street map (Village, FiDi)
function buildMapLinks(V, { X, Z, nodes, links, mk, nodeId }) {
    const extra = new Map();
    const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
    const inc = new Map(); // node point -> [{ux, uz, hw}] roads meeting there
    const addInc = (x, z, ux, uz, hw) => {
        const k = key(x, z);
        if (!inc.has(k)) inc.set(k, []);
        inc.get(k).push({ ux, uz, hw });
    };
    for (const s of V.segs) {
        addInc(s.ax, s.az, s.ux, s.uz, s.hw);
        addInc(s.bx, s.bz, -s.ux, -s.uz, s.hw);
    }
    const nodeAt = (x, z) => {
        const i = X.findIndex((v) => Math.abs(v - x) < 0.5),
            j = Z.findIndex((v) => Math.abs(v - z) < 0.5);
        if (i >= 0 && j >= 0 && nodes[nodeId(i, j)]) return nodes[nodeId(i, j)];
        const k = key(x, z);
        if (!extra.has(k)) {
            // seam T / waterfront dead end (U-turn) or a plain bend (2 legs): no signal. (layout2 r4) V.boundary: any map's edges
            const seam = !!V.boundary(x, z) || (inc.get(k) || []).length < 3;
            const n = {
                id: nodes.length,
                i: -1,
                j: -1,
                x,
                z,
                hw: 0,
                hz: 0,
                inLinks: [],
                outLinks: [],
                av: false,
                st: false,
                drive: false,
                diag: true,
                vmap: true,
                tee: seam,
            };
            nodes.push(n);
            extra.set(k, n);
        }
        return extra.get(k);
    };
    const trim = (x, z, ux, uz, w = 8) => {
        const R = [...(inc.get(key(x, z)) || [])];
        const bd = V.boundary(x, z);
        if (bd && bd.hw) R.push({ ux: bd.ux, uz: bd.uz, hw: bd.hw });
        let t = bd && bd.edge ? 4 + w * 0.6 : 3; // waterfront dead end: room for the U-turn inside the asphalt
        for (const o of R) {
            const sn = Math.abs(ux * o.uz - uz * o.ux);
            if (sn < 0.05) continue;
            t = Math.max(t, o.hw / Math.max(0.35, sn) + 2);
        }
        if (bd && !bd.edge && (inc.get(key(x, z)) || []).length < 2) t += 6; // (citylife junctions r2) dead-end T on a seam street: U-turn clear of the street's lane
        return Math.min(t, 30);
    };
    for (const s of V.segs) {
        const A = nodeAt(s.ax, s.az),
            B = nodeAt(s.bx, s.bz);
        const ta = trim(s.ax, s.az, s.ux, s.uz, s.w),
            tb = trim(s.bx, s.bz, -s.ux, -s.uz, s.w),
            l = s.len - ta - tb;
        if (l < 8) continue;
        const o = s.oneway ? 0 : s.w / 4; // (layout2 r4) one-lane one-way streets: a single centred lane
        for (const d of s.oneway ? [s.oneway] : [1, -1]) {
            const dx = s.ux * d,
                dz = s.uz * d,
                rx = -dz,
                rz = dx;
            const st = d > 0 ? ta : s.len - tb;
            const L = mk(
                (d > 0 ? A : B).id,
                (d > 0 ? B : A).id,
                s.ax + s.ux * st + rx * o,
                s.az + s.uz * st + rz * o,
                dx,
                dz,
                l,
                "st",
                0,
            );
            const to = d > 0 ? B : A;
            L.diag = s;
            L.noPark = true;
            L.vmap = true;
            L.xAxis =
                to.vmap && !to.tee
                    ? Math.abs(dz) >= Math.abs(dx)
                        ? "av"
                        : "st"
                    : null;
        }
    }
}
// grid lane links crossing an off-grid roadway mid-link get stop positions (L.xst, sorted) before the crossing; the car
// stops there when its own axis is not green (the off-grid road runs on the opposite phase)
function diagCrossStops(links) {
    for (const L of links) {
        if (L.diag) continue;
        const xs = [];
        for (const seg of DIAG_SEGS) {
            const m = seg.hw + 1.2;
            const d0 = diagD(seg, L.ax, L.az),
                dd = L.dx * seg.nx + L.dz * seg.nz;
            if (Math.abs(dd) < 0.05) continue;
            const sEnter = Math.min((m - d0) / dd, (-m - d0) / dd); // lane parameter where |d| becomes <= m
            const sExit = Math.max((m - d0) / dd, (-m - d0) / dd);
            if (sExit < 0 || sEnter > L.len) continue;
            const sm = (sEnter + sExit) / 2,
                x = L.ax + L.dx * sm,
                z = L.az + L.dz * sm; // inside the finite segment?
            const u = (x - seg.ax) * seg.ux + (z - seg.az) * seg.uz;
            if (u < -2 || u > seg.len + 2) continue;
            const stop = sEnter - 1.5;
            if (stop > 4 && stop < L.stopS - 4) {
                xs.push(stop);
                (L.xcr ??= []).push({
                    stop,
                    s0: sEnter,
                    s1: Math.min(sExit, L.len),
                });
            }
            // (citylife junctions) crossings / gores at the link ends (Broadway running into the avenue asphalt): the
            // junction model stretches the node movements over them (traffic junctions.js: movement PRE / POST)
            else if (stop <= 4)
                L.xEarly = Math.max(L.xEarly ?? 0, Math.min(sExit, L.len));
            else L.xLate = Math.min(L.xLate ?? L.len, Math.max(0, sEnter));
        }
        if (xs.length) {
            L.xst = xs.sort((a, b) => a - b);
            L.xcr.sort((a, b) => a.stop - b.stop);
        }
    }
}

// (citylife junctions) shallow-angle junctions (map streets meeting at < 30 deg, Broadway gores): the lane lines of two
// links at the same node run closer than a car's width for a stretch beyond the trimmed box. That stretch belongs to the
// junction: an in-link's stop point moves back before it (L.xLate), an out-link's head is added to the movements (L.xEarly).
function goreOverlaps(nodes, links) {
    const D = 2.9;
    const segD = (L, x, z, s0, s1) => {
        const px = x - L.ax,
            pz = z - L.az,
            t = Math.max(s0, Math.min(s1, px * L.dx + pz * L.dz));
        return Math.hypot(px - L.dx * t, pz - L.dz * t);
    };
    for (const n of nodes) {
        if (!n) continue;
        const ends = [
            ...n.inLinks.map((L) => ({ L, inb: true })),
            ...n.outLinks.map((L) => ({ L, inb: false })),
        ];
        if (ends.length < 3 || !ends.some((e) => e.L.diag || e.L.roundTo))
            continue; // plain grid corners are regular: nothing to find
        const cs = []; // this node's turn connectors, sampled every metre
        for (const I of n.inLinks)
            for (const o of I.out || []) {
                const C = I.conn.get(o.link.id) || connector(I, o.link, o.turn);
                I.conn.set(o.link.id, C);
                const P = [],
                    T = [0, 0, 0];
                for (let q = 0; q <= C.len; q += 1) {
                    connAt(C, q, T);
                    P.push(T[0], T[1]);
                }
                cs.push({
                    I,
                    O: o.link,
                    P,
                    D: o.turn === "S" && !(I.diag && !I.vmap) ? D : 3.9,
                }); // (r2) a turning bus / truck sweeps wider than its path
            }
        for (const a of ends) {
            let sMax = 0; // distance from the node end of a over which its lane line is within D of another link's
            const lim = Math.min(a.L.len, 60);
            for (const b of ends) {
                if (
                    a.L === b.L ||
                    (a.L.from === b.L.to &&
                        a.L.to === b.L.from &&
                        a.L.lane === b.L.lane &&
                        !a.L.vmap)
                )
                    continue;
                if (
                    (a.inb && !b.inb && a.L.out?.some((o) => o.link === b.L)) ||
                    (!a.inb && b.inb && b.L.out?.some((o) => o.link === a.L))
                )
                    continue; // a -> b is a path
                if (
                    a.inb === b.inb &&
                    Math.abs(a.L.dx * b.L.dx + a.L.dz * b.L.dz) > 0.995
                )
                    continue; // parallel sibling lanes
                const bl = Math.min(b.L.len, 60),
                    b0 = b.inb ? b.L.len - bl : 0,
                    b1 = b.inb ? b.L.len : bl;
                for (let d = 0; d <= lim; d += 1) {
                    const sa = a.inb ? a.L.len - d : d;
                    if (
                        segD(
                            b.L,
                            a.L.ax + a.L.dx * sa,
                            a.L.az + a.L.dz * sa,
                            b0,
                            b1,
                        ) < D
                    )
                        sMax = Math.max(sMax, d + 1);
                }
            }
            // turn connectors of the other approaches sweeping over this link's tail / head (Broadway leaving a grid node at a
            // shallow angle crosses the street approach waiting at the corner)
            for (const q of cs) {
                if ((a.inb && q.I === a.L) || (!a.inb && q.O === a.L)) continue;
                const P = q.P;
                for (let k = 0; k < P.length; k += 2) {
                    const px = P[k] - a.L.ax,
                        pz = P[k + 1] - a.L.az,
                        t = px * a.L.dx + pz * a.L.dz;
                    const d = a.inb ? a.L.len - t : t;
                    if (d < 0 || d > lim) continue;
                    if (Math.abs(px * a.L.dz - pz * a.L.dx) < q.D)
                        sMax = Math.max(sMax, d + 1);
                }
            }
            if (sMax <= 0) continue;
            if (a.inb) {
                a.L.xLate = Math.min(a.L.xLate ?? a.L.len, a.L.len - sMax);
            } else a.L.xEarly = Math.max(a.L.xEarly ?? 0, sMax);
        }
    }
    for (const L of links)
        if (L.xLate !== undefined && L.xLate - 1.5 < L.stopS)
            L.stopS = Math.max(1, L.xLate - 1.5);
}
// ------------------------------------------------------------------ (citylife bridges) bridge decks
// Each bridge (bridges.js bridgeSpans / roadProfile): its lanes both ways (bridges.js section: `lanes` per direction,
// 3.4 m, outside the centre zone) as links from a signalised T on the avenue / street it lands on (that road's links are
// split there, a box of the deck's half width + 1 m each side), over the at-grade apron, up the approach viaduct, across
// the span and down the far ramp to a dead end on the far shore (cars U-turn there, out of sight). Links carry their deck
// height (y0 -> y1: linear per link, split at the profile's breaks). Lanes: innermost 0 (left turns), outermost 1 (right
// turns), middle 2 (straight).
export const BRIDGE_DENSITY = 31; // eastbound; westbound x0.6 (it feeds the T) // cars per km of lane on a bridge (npc/traffic.js)
let _bj = [];
export function bridgeJunctions() {
    return _bj;
} // T footprints [{name, x, z, x0, x1, z0, z1}]: no parking / curb life / street props
function buildBridgeLinks(nodes, links, mk) {
    _bj = [];
    for (const B of bridgeSpans()) {
        if (B.mLand === null) continue;
        const S = B.sec,
            R = S.R + 1,
            xJ = B.mJoin0 - 4;
        // the road it lands on: every lane link within 14 m of the T point, roughly across the bridge
        const hits = links.filter((L) => {
            if (L.bridge || Math.abs(L.dz) < 0.4) return false;
            const px = xJ - L.ax,
                pz = B.z - L.az,
                sAl = px * L.dx + pz * L.dz;
            return (
                sAl > 0 && sAl < L.len && Math.abs(px * L.dz - pz * L.dx) < 14
            );
        });
        if (!hits.length) continue;
        const Tn = {
            id: nodes.length,
            i: -1,
            j: -1,
            x: xJ,
            z: B.z,
            hw: 0,
            hz: 0,
            inLinks: [],
            outLinks: [],
            av: false,
            st: false,
            drive: false,
            diag: true,
            sig: false,
            bridgeT: B.name,
        }; // unsignalised: the avenue has priority, bridge traffic yields and merges into its gaps (starving cars get their turn)
        nodes.push(Tn);
        let xE = -1e9;
        for (const L of hits) {
            // split: L (a -> T) + L2 (T -> b), a box of +-R in z around the deck centre line
            const hz = R / Math.abs(L.dz),
                sC = (B.z - L.az) / L.dz,
                s0 = sC - hz,
                s1 = sC + hz;
            if (s0 < 6 || s1 > L.len - 6) continue;
            const to = nodes[L.to];
            const L2 = mk(
                Tn.id,
                L.to,
                L.ax + L.dx * s1,
                L.az + L.dz * s1,
                L.dx,
                L.dz,
                L.len - s1,
                L.kind,
                L.lane,
            );
            for (const k of [
                "diag",
                "noPark",
                "vmap",
                "parkSides",
                "narrow",
                "xAxis",
            ])
                if (L[k] !== undefined) L2[k] = L[k];
            to.inLinks.splice(to.inLinks.indexOf(L2), 1);
            to.inLinks[to.inLinks.indexOf(L)] = L2; // mk pushed L2 at the end; L2 replaces L
            L.to = Tn.id;
            L.len = s0;
            L.stopS = s0 - STOP_BACK;
            L.cx = L.ax + (L.dx * s0) / 2;
            L.cz = L.az + (L.dz * s0) / 2;
            if (L.vmap) L.xAxis = null; // unsignalised T: the street has priority
            Tn.inLinks.push(L);
            xE = Math.max(xE, L.ax + L.dx * s0 + 0 * L.dz, L2.ax); // east edge of the road there
        }
        if (!Tn.inLinks.length) {
            nodes.pop();
            continue;
        }
        // deck profile -> break points (x, y); the first one at the east edge of the road + 2 m, at grade
        const P = roadProfile(B).map((p) => [p[0], p[1]]);
        const x0 = Math.max(B.mJoin0 + 1.5, xE + 1.5);
        const br = [
            [x0, 0],
            ...P.filter((p) => p[0] > x0 + 4).map((p, i) => [
                p[0],
                i === 0 && p[1] < 1 ? 0 : p[1],
            ]),
        ];
        const bn = [
            Tn,
            ...br.slice(1).map((p, k) => {
                const n = {
                    id: nodes.length + k,
                    i: -1,
                    j: -1,
                    x: p[0],
                    z: B.z,
                    hw: 0,
                    hz: 0,
                    inLinks: [],
                    outLinks: [],
                    av: false,
                    st: false,
                    drive: false,
                    diag: true,
                    bridgeN: B.name,
                    y: p[1],
                    deadEnd: k === br.length - 2,
                };
                return n;
            }),
        ];
        for (const n of bn.slice(1)) nodes.push(n);
        for (let k = 0; k < S.lanes; k++) {
            const lane = k === 0 ? 0 : k === S.lanes - 1 ? 1 : 2,
                u = S.inner + 0.5 + 3.4 * (k + 0.5);
            for (let q = 0; q + 1 < br.length; q++) {
                const xa = br[q][0],
                    xb = br[q + 1][0],
                    ya = br[q][1],
                    yb = br[q + 1][1];
                const ea = q === 0 ? xa : xa + 0.5,
                    eb = q + 2 === br.length ? xb : xb - 0.5; // 1 m gaps: connectors between the pieces
                const E = mk(
                    bn[q].id,
                    bn[q + 1].id,
                    ea,
                    B.z + u,
                    1,
                    0,
                    eb - ea,
                    "br",
                    lane,
                );
                const W = mk(
                    bn[q + 1].id,
                    bn[q].id,
                    eb,
                    B.z - u,
                    -1,
                    0,
                    eb - ea,
                    "br",
                    lane,
                );
                for (const [L, y0, y1] of [
                    [E, ya, yb],
                    [W, yb, ya],
                ]) {
                    L.bridge = B.name;
                    L.noPark = true;
                    L.axis = "st";
                    L.y0 = y0;
                    L.y1 = y1;
                    L.grade = (y1 - y0) / L.len;
                }
            }
        }
        _bj.push({
            name: B.name,
            x: xJ,
            z: B.z,
            x0: xJ - 24,
            x1: br[1][0] + 4,
            z0: B.z - S.hw - 22,
            z1: B.z + S.hw + 22,
        });
    }
}
// cubic Bezier connector from the end of link A to the start of link B (arc-length table for constant speed)
// (layout2 r3) Columbus Circle: the links meeting the roundabout node end / start on a circle outside the ring lane;
// their connectors run counter-clockwise (seen from above) around the island at ROUNDABOUT.lane
function roundaboutLinks(nodes, links) {
    const R = ROUNDABOUT,
        n = nodes.find(
            (q) => q && Math.abs(q.x - R.x) < 0.5 && Math.abs(q.z - R.z) < 0.5,
        );
    if (!n) return;
    n.round = R;
    const rEnd = R.lane + 5,
        far = (L, s) =>
            Math.hypot(L.ax + L.dx * s - R.x, L.az + L.dz * s - R.z) >= rEnd;
    for (const L of links) {
        if (L.to === n.id) {
            let s = L.len;
            while (s > 4 && !far(L, s)) s -= 0.25;
            L.len = s;
            L.stopS = Math.max(1, s - 1.5);
            L.roundTo = R;
        }
        if (L.from === n.id) {
            let s = 0;
            while (s < L.len - 4 && !far(L, s)) s += 0.25;
            L.ax += L.dx * s;
            L.az += L.dz * s;
            L.len -= s;
            L.stopS = Math.min(L.stopS, L.len - STOP_BACK);
        }
        L.cx = L.ax + (L.dx * L.len) / 2;
        L.cz = L.az + (L.dz * L.len) / 2;
    }
}
function ringConnector(A, B, turn) {
    const R = A.roundTo,
        ex = A.ax + A.dx * A.len,
        ez = A.az + A.dz * A.len,
        sx = B.ax,
        sz = B.az;
    const ang = (x, z) => Math.atan2(z - R.z, x - R.x),
        ta = ang(ex, ez),
        tb = ang(sx, sz);
    let dt = ta - tb;
    while (dt <= 0.9) dt += Math.PI * 2;
    while (dt > Math.PI * 2 + 0.9) dt -= Math.PI * 2;
    const a0 = ta - 0.35,
        span = dt - 0.7,
        N = Math.max(4, Math.ceil((span * R.lane) / 2));
    const pts = [[ex, ez]];
    for (let i = 0; i <= N; i++) {
        const a = a0 - (span * i) / N;
        pts.push([R.x + Math.cos(a) * R.lane, R.z + Math.sin(a) * R.lane]);
    }
    pts.push([sx, sz]);
    const tab = [0];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        tab.push(acc);
    }
    return { poly: pts, tab, len: acc, turn, to: B };
}
export function connector(A, B, turn) {
    if (A.roundTo) return ringConnector(A, B, turn); // (layout2 r3)
    const ex = A.ax + A.dx * A.len,
        ez = A.az + A.dz * A.len;
    const sx = B.ax,
        sz = B.az;
    const d = Math.hypot(sx - ex, sz - ez);
    const k = turn === "S" ? d / 3 : turn === "U" ? d * 0.9 : d * 0.39;
    const P = [
        ex,
        ez,
        ex + A.dx * k,
        ez + A.dz * k,
        sx - B.dx * k,
        sz - B.dz * k,
        sx,
        sz,
    ];
    const N = 12,
        tab = [0];
    let px = ex,
        pz = ez,
        acc = 0;
    for (let i = 1; i <= N; i++) {
        const [x, z] = bez(P, i / N);
        acc += Math.hypot(x - px, z - pz);
        tab.push(acc);
        px = x;
        pz = z;
    }
    return { P, tab, len: acc, turn, to: B };
}
function bez(P, t) {
    const u = 1 - t,
        a = u * u * u,
        b = 3 * u * u * t,
        c = 3 * u * t * t,
        d = t * t * t;
    return [
        a * P[0] + b * P[2] + c * P[4] + d * P[6],
        a * P[1] + b * P[3] + c * P[5] + d * P[7],
    ];
}
// position + heading at arc length s along a connector -> out = [x, z, heading]
export function connAt(C, s, out) {
    if (C.poly) {
        // (layout2 r3) polyline connector (roundabout)
        const T = C.tab,
            P = C.poly;
        let i = 1;
        while (i < T.length - 1 && T[i] < s) i++;
        const f = Math.max(
            0,
            Math.min(1, (s - T[i - 1]) / Math.max(1e-4, T[i] - T[i - 1])),
        );
        out[0] = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f;
        out[1] = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f;
        out[2] = Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0]);
        return out;
    }
    const tab = C.tab,
        N = tab.length - 1;
    let i = 1;
    while (i < N && tab[i] < s) i++;
    const f = Math.max(
        0,
        Math.min(1, (s - tab[i - 1]) / Math.max(1e-4, tab[i] - tab[i - 1])),
    );
    const t = (i - 1 + f) / N;
    const [x, z] = bez(C.P, t);
    const [x2, z2] = bez(C.P, Math.min(1, t + 0.02));
    const [x0, z0] = bez(C.P, Math.max(0, t - 0.02));
    out[0] = x;
    out[1] = z;
    out[2] = Math.atan2(z2 - z0, x2 - x0);
    return out;
}
