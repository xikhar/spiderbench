// OWNER: citylife engineer. (citylife junctions) Junction conflict + reservation model for npc/traffic.js.
// User: 'where non gridded roads cut together the traffic cars just intersect through each other'.
//  * MOVEMENT = one way through a junction: a turn connector (in-link tail from the stop point -> connector -> out-link
//    head; the head / tail stretch over Broadway gores, roads.js L.xEarly / L.xLate) or a mid-link crossing of an
//    off-grid road by a grid lane (roads.js L.xcr). Sampled every STEP m as (x, z, heading).
//  * CONFLICT (lazy, cached per movement pair): the stretch of both paths closer than D (widest vehicle + margin).
//    'cross' when the headings there differ (> 35 deg: crossings, head-on) -> mutual exclusion until the holder's rear
//    has left its stretch; 'follow' when they run together (merges, diverges, the roundabout ring) -> the other car is
//    projected onto our path (offset k) and followed like a leader, entry needs a safe gap.
//  * JUNCTION = the nodes whose movements conflict (union-find), so Broadway's pseudo-nodes, the grid node it runs
//    into, the avenue lanes it crosses mid-block and the map nodes share one reservation table.
//  * GRANT at the stop point (after the signal said go): no conflicting holder, no older / higher-priority waiter
//    (FIFO -> zipper at merges), yield to faster higher-priority traffic about to arrive (left turns, minor map roads;
//    waived after STARVE s), room behind the box on the out-link (don't block the box). Only holders progress into a
//    box and a holder never waits for a waiter, so the oldest top-priority waiter always gets through (no deadlock);
//    traffic.js still retires cars stuck > 45 s off-screen as a last-resort breaker.
import { connAt } from "./roads.js";

const DBG = globalThis.__jxDbg || null; // (debug) Map 'holderMove>requestMove' -> denials (tools/dev/traffic_probe)
const D_BIG2 = 4.2 * 4.2; // (big vehicles: widest + turning off-tracking)
const D = 2.9,
    D2 = D * D,
    STEP = 1.0,
    POST = 4,
    STARVE = 12,
    FOLLOW_DOT = 0.82,
    CELL = 32;

export function createJunctions(roads, getConn) {
    const { links, nodes } = roads;
    const moves = [];
    const tmp = [0, 0, 0];
    const rankOf = (L) =>
        L.roundTo
            ? 2
            : L.kind === "av" || L.kind === "dg" || L.kind === "ws"
              ? 2
              : L.vmap
                ? (L.diag?.w ?? 10) >= 12
                    ? 2
                    : 1
                : 1;
    const TURNP = { S: 2, R: 1, L: 0, U: 0 };
    // ------------------------------------------------------------------ movements
    const pos = (M, u, out) => {
        if (M.kind === "x") {
            const L = M.L,
                s = M.base + u;
            out[0] = L.ax + L.dx * s;
            out[1] = L.az + L.dz * s;
            out[2] = L.heading;
            return out;
        }
        if (u < 0) {
            const L = M.inL,
                s = L.len + u;
            out[0] = L.ax + L.dx * s;
            out[1] = L.az + L.dz * s;
            out[2] = L.heading;
            return out;
        }
        if (u > M.C.len) {
            const L = M.outL,
                s = u - M.C.len;
            out[0] = L.ax + L.dx * s;
            out[1] = L.az + L.dz * s;
            out[2] = L.heading;
            return out;
        }
        return connAt(M.C, u, out);
    };
    const finish = (M) => {
        M.id = moves.length;
        moves.push(M);
        M.cf = new Map();
        M.cfB = new Map();
        const n = Math.max(2, Math.ceil((M.end - M.u0) / STEP) + 1),
            P = new Float32Array(n * 4);
        let x0 = 1e9,
            z0 = 1e9,
            x1 = -1e9,
            z1 = -1e9;
        for (let i = 0; i < n; i++) {
            pos(M, Math.min(M.end, M.u0 + i * STEP), tmp);
            P[i * 4] = tmp[0];
            P[i * 4 + 1] = tmp[1];
            P[i * 4 + 2] = Math.cos(tmp[2]);
            P[i * 4 + 3] = Math.sin(tmp[2]);
            x0 = Math.min(x0, tmp[0]);
            x1 = Math.max(x1, tmp[0]);
            z0 = Math.min(z0, tmp[1]);
            z1 = Math.max(z1, tmp[1]);
        }
        M.P = P;
        M.n = n;
        M.bb = [x0 - 5.2, z0 - 5.2, x1 + 5.2, z1 + 5.2];
        return M;
    };
    const connMove = (L, O, turn) => {
        const C = getConn(L, { link: O, turn });
        const stopS = Math.min(L.stopS, L.len);
        const post = Math.min(O.len, Math.max(POST, (O.xEarly ?? 0) + 2));
        return finish({
            kind: "c",
            y: L.y1 ?? 0,
            inL: L,
            outL: O,
            C,
            turn,
            lc:
                turn === "S" &&
                L.kind !== "st" &&
                O.kind !== "st" &&
                L.lane !== O.lane,
            stopS,
            u0: Math.min(stopS - 1, L.len) - L.len,
            end: C.len + post,
            prio: L.roundTo ? 5 : rankOf(L) * 3 + (TURNP[turn] ?? 0),
            owner: L.to,
            J: null,
        });
    };
    for (const L of links) {
        L.mv = new Map();
        for (const o of L.out || []) {
            if (!L.mv.has(o.link.id))
                L.mv.set(o.link.id, connMove(L, o.link, o.turn));
            const a = o.link.alt; // blocked-lane detour through the box (traffic.js chooseNext)
            if (a && !L.mv.has(a.link.id))
                L.mv.set(a.link.id, connMove(L, a.link, "S"));
        }
        L.xm = (L.xcr || []).map((x, k) =>
            finish({
                kind: "x",
                y: 0,
                L,
                base: x.stop,
                stopS: x.stop,
                u0: -1,
                end: x.s1 + 2 - x.stop,
                prio: rankOf(L) * 3 + 2,
                owner: nodes.length + L.id * 8 + k,
                J: null,
            }),
        );
    }
    const moveFor = (L, opt) => {
        let M = L.mv.get(opt.link.id);
        if (!M) {
            M = connMove(L, opt.link, opt.turn);
            L.mv.set(opt.link.id, M);
            if (M.J === null) M.J = newJ([M]);
        }
        return M;
    };
    // ------------------------------------------------------------------ conflicts
    const sequential = (a, b) => {
        if (a.kind === "c" && b.kind === "c")
            return a.outL === b.inL || b.outL === a.inL;
        if (a.kind === "x" && b.kind === "x") return a.L === b.L;
        const x = a.kind === "x" ? a : b,
            m = a.kind === "x" ? b : a;
        return m.inL === x.L || m.outL === x.L;
    };
    // -> null or an array of zones { cross, a0, a1, b0, b1, k }: every separate stretch where the two paths run closer
    // than D (a roundabout pair can share an arc AND cross at an entry: two zones, each with its own type)
    const conflict = (a, b) => conflictD(a, b, false);
    const cfx = (a, b, big) => {
        // same-junction pairs through the matrix
        const J = a.J;
        if (J !== b.J || !J.cm) return conflictD(a, b, big);
        const m = big ? J.cmB : J.cm,
            k = a.ji * J.moves.length + b.ji;
        let r = m[k];
        if (r === undefined) r = m[k] = conflictD(a, b, big);
        return r;
    };
    const conflictBig = (a, b) => conflictD(a, b, true); // (buses / trucks sweep wider on turns: D_BIG)
    const conflictD = (a, b, big) => {
        if (a === b) return null;
        const cache = big ? "cfB" : "cf",
            DD = big ? D_BIG2 : D2;
        let r = a[cache].get(b.id);
        if (r !== undefined) return r;
        r = null;
        if (Math.abs(a.y - b.y) > 4) {
            a[cache].set(b.id, null);
            b[cache].set(a.id, null);
            return null;
        } // (citylife bridges) one on a deck above the other
        if (
            !sequential(a, b) &&
            a.bb[0] < b.bb[2] &&
            b.bb[0] < a.bb[2] &&
            a.bb[1] < b.bb[3] &&
            b.bb[1] < a.bb[3]
        ) {
            const A = a.P,
                B = b.P,
                cl = [],
                turning =
                    (a.turn && a.turn !== "S") ||
                    (b.turn && b.turn !== "S") ||
                    a.lc ||
                    b.lc;
            for (let i = 0; i < a.n; i++) {
                const ax = A[i * 4],
                    az = A[i * 4 + 1];
                if (
                    ax < b.bb[0] ||
                    ax > b.bb[2] ||
                    az < b.bb[1] ||
                    az > b.bb[3]
                )
                    continue;
                for (let j = 0; j < b.n; j++) {
                    const dx = B[j * 4] - ax,
                        dz = B[j * 4 + 1] - az,
                        d2 = dx * dx + dz * dz;
                    if (d2 >= DD) continue;
                    const dt =
                        A[i * 4 + 2] * B[j * 4 + 2] +
                        A[i * 4 + 3] * B[j * 4 + 3];
                    if (big && d2 >= D2 && (dt < -0.9 || dt > 0.9) && !turning)
                        continue; // the wide envelope only where the paths are not parallel (turn sweep), never between adjacent / opposing lanes
                    let z = null;
                    for (let q = cl.length - 1; q >= 0; q--) {
                        const c = cl[q];
                        if (i - c.i1 <= 2 && j >= c.j0 - 2 && j <= c.j1 + 2) {
                            z = c;
                            break;
                        }
                    }
                    if (!z)
                        cl.push(
                            (z = {
                                i0: i,
                                i1: i,
                                j0: j,
                                j1: j,
                                best: 1e9,
                                dot: 1,
                                kb: 0,
                                ks: 0,
                                kn: 0,
                            }),
                        );
                    z.i1 = i;
                    if (j < z.j0) z.j0 = j;
                    if (j > z.j1) z.j1 = j;
                    if (d2 < z.best) {
                        z.best = d2;
                        z.dot = dt;
                        z.kb = (j - i) * STEP + b.u0 - a.u0;
                    }
                    if (d2 < 0.6 && dt > FOLLOW_DOT) {
                        z.ks += (j - i) * STEP + b.u0 - a.u0;
                        z.kn++;
                    }
                }
            }
            if (cl.length) {
                r = [];
                const m = [];
                for (const z of cl) {
                    const follow = z.dot > FOLLOW_DOT,
                        k = follow && z.kn ? z.ks / z.kn : z.kb;
                    const a0 = a.u0 + z.i0 * STEP - STEP,
                        a1 = a.u0 + z.i1 * STEP + STEP,
                        b0 = b.u0 + z.j0 * STEP - STEP,
                        b1 = b.u0 + z.j1 * STEP + STEP;
                    r.push({ cross: !follow, a0, a1, b0, b1, k });
                    m.push({
                        cross: !follow,
                        a0: b0,
                        a1: b1,
                        b0: a0,
                        b1: a1,
                        k: -k,
                    });
                }
                // (r3) two paths that cross twice (a gore: one crosses the other's approach, then its exit) must be taken as one
                // exclusive stretch, or each car ends up inside one crossing waiting for the other to leave the second
                const xs = r.filter((z) => z.cross);
                if (xs.length > 1) {
                    const u = {
                        cross: true,
                        a0: Math.min(...xs.map((z) => z.a0)),
                        a1: Math.max(...xs.map((z) => z.a1)),
                        b0: Math.min(...xs.map((z) => z.b0)),
                        b1: Math.max(...xs.map((z) => z.b1)),
                        k: xs[0].k,
                    };
                    r = [u, ...r.filter((z) => !z.cross)];
                    m.length = 0;
                    for (const z of r)
                        m.push({
                            cross: z.cross,
                            a0: z.b0,
                            a1: z.b1,
                            b0: z.a0,
                            b1: z.a1,
                            k: -z.k,
                        });
                }
                b[cache].set(a.id, m);
            } else b[cache].set(a.id, null);
        }
        a[cache].set(b.id, r);
        return r;
    };
    // ------------------------------------------------------------------ junctions (union of nodes whose movements conflict)
    const par = new Map();
    const find = (x) => {
        while (par.has(x) && par.get(x) !== x) {
            const p = par.get(par.get(x));
            par.set(x, p);
            x = p;
        }
        return x;
    };
    const unite = (a, b) => {
        a = find(a);
        b = find(b);
        if (a !== b) par.set(b, a);
    };
    for (const M of moves) par.set(M.owner, M.owner);
    const grid = new Map();
    for (const M of moves) {
        for (
            let i = Math.floor(M.bb[0] / CELL);
            i <= Math.floor(M.bb[2] / CELL);
            i++
        )
            for (
                let j = Math.floor(M.bb[1] / CELL);
                j <= Math.floor(M.bb[3] / CELL);
                j++
            ) {
                const k = i * 65536 + j;
                let c = grid.get(k);
                if (!c) grid.set(k, (c = []));
                c.push(M);
            }
    }
    const seen = new Set();
    for (const c of grid.values())
        for (let i = 0; i < c.length; i++)
            for (let j = i + 1; j < c.length; j++) {
                const a = c[i],
                    b = c[j];
                if (a.owner === b.owner || find(a.owner) === find(b.owner))
                    continue;
                const key = a.id < b.id ? a.id * 1e6 + b.id : b.id * 1e6 + a.id;
                if (seen.has(key)) continue;
                seen.add(key);
                if (
                    conflict(a, b) ||
                    ((a.turn !== "S" || b.turn !== "S") && conflictBig(a, b))
                )
                    unite(a.owner, b.owner); // (r3) + bus / truck turn sweeps
            }
    // spatial hash (8 m) of the turn-connector samples: curb parking keeps off the corners the turning cars sweep
    const cgrid = new Map();
    for (const M of moves)
        if (M.kind === "c")
            for (let i = 0; i < M.n; i++) {
                const u = M.u0 + i * STEP;
                if (u < 0 || u > M.C.len) continue;
                const k =
                    Math.floor(M.P[i * 4] / 8) * 65536 +
                    Math.floor(M.P[i * 4 + 1] / 8);
                let a = cgrid.get(k);
                if (!a) cgrid.set(k, (a = []));
                a.push(M.P[i * 4], M.P[i * 4 + 1]);
            }
    const nearTurn = (x, z, r) => {
        const i0 = Math.floor((x - r) / 8),
            i1 = Math.floor((x + r) / 8),
            j0 = Math.floor((z - r) / 8),
            j1 = Math.floor((z + r) / 8);
        for (let i = i0; i <= i1; i++)
            for (let j = j0; j <= j1; j++) {
                const a = cgrid.get(i * 65536 + j);
                if (a)
                    for (let q = 0; q < a.length; q += 2)
                        if ((a[q] - x) ** 2 + (a[q + 1] - z) ** 2 < r * r)
                            return true;
            }
        return false;
    };
    const Js = [],
        jOf = new Map();
    const newJ = (ms) => {
        const J = {
            id: Js.length,
            moves: ms,
            occ: [],
            wait: [],
            inLinks: [],
            hot: false,
            cm: null,
            cmB: null,
        };
        Js.push(J);
        for (const M of ms) M.J = J;
        if (ms.length) setupJ(J);
        return J;
    };
    // (perf) per-junction conflict matrices (array lookups instead of Map gets in the per-car loops)
    function setupJ(J) {
        J.moves.forEach((M, i) => {
            M.ji = i;
        });
        J.cm = new Array(J.moves.length ** 2);
        J.cmB = new Array(J.moves.length ** 2);
    }
    for (const M of moves) {
        const r = find(M.owner);
        let J = jOf.get(r);
        if (!J) {
            J = newJ([]);
            jOf.set(r, J);
        }
        J.moves.push(M);
        M.J = J;
    }
    for (const J of Js) {
        const s = new Set();
        for (const M of J.moves) s.add(M.kind === "x" ? M.L : M.inL);
        J.inLinks = [...s];
        setupJ(J);
    }

    // ------------------------------------------------------------------ runtime
    // position of car c's centre along M (u), NaN when c is not on M's path
    const uOf = (c, M) => {
        if (M.kind === "x")
            return c.link === M.L && !c.conn ? c.s - M.base : NaN;
        if (c.link === M.inL && !c.conn) return c.s - M.inL.len;
        if (c.link === M.outL && (c.conn ? c.conn === M.C : c.via === M))
            return c.s + M.C.len;
        return NaN;
    };
    const hot = new Set();
    const has = (c, M) => {
        const r = c.reg;
        if (r) for (let i = 0; i < r.length; i++) if (r[i] === M) return true;
        return false;
    };
    const register = (c, M, pend = false) => {
        if (has(c, M)) return;
        (c.reg ??= []).push(M);
        M.J.occ.push({ c, M, pend });
        hot.add(M.J);
        c.regT = NOW;
        if (c.wait) dropWait(c);
    };
    const dropWait = (c) => {
        const w = c.wait;
        c.wait = null;
        if (!w) return;
        const a = w.J.wait,
            i = a.indexOf(w);
        if (i >= 0) a.splice(i, 1);
    };
    // next junction movement ahead of a car on its link (a crossing on the link, else the turn at its end)
    const T = { M: null, stop: 0 };
    const target = (c) => {
        const L = c.link;
        if (c.conn) return null;
        const xm = L.xm;
        for (let k = 0; k < xm.length; k++) {
            const X = xm[k];
            if (has(c, X)) continue;
            if (c.s - c.len / 2 - X.base > X.end) continue;
            T.M = X;
            T.stop = X.stopS;
            return T;
        }
        if (!c.next) return null;
        let M = c._tM;
        if (!M || c._tN !== c.next || M.inL !== L) {
            M = c._tM = moveFor(L, c.next);
            c._tN = c.next;
        }
        if (has(c, M)) return null;
        T.M = M;
        T.stop = M.stopS;
        return T;
    };
    // waiter order: starving (denied > STARVE s in total) first, then movement priority, then first come
    const precedes = (w, c, now) => {
        const sw = w.c.wAcc > STARVE || !!(w.c.reg && w.c.reg.length),
            sc = c.wM === c._req && c.wAcc > STARVE;
        if (sw !== sc) return sw;
        if (w.M.prio !== c._req.prio) return w.M.prio > c._req.prio;
        return w.c.wT0 < (c.wM === c._req ? c.wT0 : now) - 0.3;
    };
    const room = (c, M) => {
        if (M.kind === "x") {
            // the car ahead on the link must leave room behind the crossing
            const arr = M.L.cars;
            let lead = null;
            for (let i = 0; i < arr.length; i++)
                if (arr[i].s > c.s) {
                    lead = arr[i];
                    break;
                }
            if (!lead) return true;
            return (
                lead.s - lead.len / 2 + Math.min(lead.v * 1.5, 8) >=
                M.base + M.end + c.len / 2 + 1.5
            ); // our rear must be able to clear the crossing
        }
        const N = M.outL;
        if (!N.active) return true;
        let occ = 0,
            tail = Math.min(N.len, N.blockS),
            tv = 0;
        for (const o of N.cars) {
            if (o === c) continue;
            if (o.conn || o.s - o.len / 2 < 0) occ += o.len + 2;
            else {
                tail = o.s - o.len / 2;
                tv = o.v;
                break;
            }
        }
        const occJ = M.J.occ; // granted cars still on their way in (not yet on the out-link's list) need room too
        for (let i = 0; i < occJ.length; i++) {
            const e = occJ[i];
            if (
                e.M.kind === "c" &&
                e.M.outL === N &&
                e.c !== c &&
                e.c.link !== N
            )
                occ += e.c.len + 2;
        }
        // our rear must be able to clear the whole movement (incl. its out-link head) behind the queue: don't block the box
        const need = Math.min(
            M.end - M.C.len + c.len / 2 + 1.5,
            Math.max(c.len + 2, N.len * 0.6),
        );
        return tail - occ + Math.min(tv, 3) >= need;
    };
    // may car c (centre at u on M) enter M now?
    let DENY_BY = null; // (debug) the car that caused the last denial
    // time for o's front to cover d (it may accelerate; a car standing > 2 s is not coming), time for c's rear to clear b1
    const eta = (d, o) =>
        d <= 0
            ? 0
            : o.v < 0.3 && o.stillT > 2
              ? 1e9
              : (-o.v + Math.sqrt(o.v * o.v + 5 * d)) / 2.5;
    const clearT = (c, u, b1) => {
        const d = b1 + 0.5 - (u - c.len / 2);
        return d <= 0
            ? 0
            : (1.3 * (-c.v + Math.sqrt(c.v * c.v + 4 * d))) / 2 + 1.0;
    };
    const holdersBlock = (c, M, u, inside) => {
        const J = M.J;
        for (let i = 0; i < J.occ.length; i++) {
            const e = J.occ[i],
                o = e.c;
            if (o === c) continue;
            const zs = cfx(e.M, M, c.len > 7 || o.len > 7);
            if (!zs) continue;
            const uo = uOf(o, e.M);
            if (uo !== uo) {
                if (e.pend && zs.some((z) => z.cross)) {
                    DENY_BY = o;
                    return 1;
                }
                continue;
            } // (bridges) a chained holder still on its way in counts as coming
            for (let zi = 0; zi < zs.length; zi++) {
                const cf = zs[zi];
                if (uo - o.len / 2 > cf.a1 + 0.5) continue; // holder already past the shared stretch
                if (cf.cross) {
                    // space-time: deny only if the holder is committed to / in the shared stretch, or gets there before we clear it
                    const fo = uo + o.len / 2;
                    // (a car already inside this junction only waits for committed holders: the others yield to it at their zone)
                    if (
                        fo >= cf.a0 - ((o.v * o.v) / 12 + 0.5) ||
                        (!inside && eta(cf.a0 - fo, o) < clearT(c, u, cf.b1))
                    ) {
                        DENY_BY = o;
                        if (DBG) {
                            const k = e.M.id + ">" + M.id;
                            DBG.set(k, (DBG.get(k) || 0) + 1);
                        }
                        return 1;
                    }
                    continue;
                }
                const p = uo + cf.k; // holder projected onto our path
                // holder ahead on the shared path: we just follow it. Holder behind: only a problem while we are not on the shared
                // stretch yet (merging in front of it needs a gap it can brake for); once we are on it, it follows us
                if (p >= u || u + c.len / 2 >= cf.b0) continue;
                if (
                    u - c.len / 2 - (p + o.len / 2) <
                    (inside
                        ? 1 + (o.v * o.v) / 8
                        : 2 + o.v * 1.2 + Math.max(0, o.v - c.v) ** 2 / 6)
                ) {
                    DENY_BY = o;
                    if (DBG) {
                        const k = e.M.id + ">" + M.id + "fb";
                        DBG.set(k, (DBG.get(k) || 0) + 1);
                    }
                    return 1;
                }
            }
        }
        return 0;
    };
    // may car c enter the chain of movements ch (ch[k] with the car's centre at us[k] on it) now? 0 = yes, else the reason
    const grant = (c, ch, us, n, now, redFor) => {
        const M = ch[0],
            J = M.J;
        c._req = M;
        let inside = false;
        if (c.reg)
            for (let i = 0; i < c.reg.length; i++)
                if (c.reg[i].J === J) inside = true;
        // a car already holding a movement of this junction (Broadway pseudo-node -> grid node, roundabout exit after a
        // crossing) goes before waiters / arriving traffic: it is in the box and must be able to leave it. A car denied for
        // > STARVE s (a minor approach into a saturated roundabout / gore) gets the same standing: holders not yet committed
        // yield to it at their zone (it is registered with priority, see car())
        const starving = inside || (c.wM === M && c.wAcc > STARVE);
        for (let k = 0; k < n; k++)
            if (holdersBlock(c, ch[k], us[k], starving)) return 1;
        if (!inside)
            for (let i = 0; i < J.wait.length; i++) {
                const w = J.wait[i];
                // a waiter only holds others back while it is next in line: not when it waits for room or for a holder (unless starving)
                if (
                    w.c === c ||
                    now - w.last > 0.3 ||
                    ((w.why === 4 || w.why === 1) && !(w.c.wAcc > STARVE)) ||
                    !conflict(w.M, M)
                )
                    continue;
                if (precedes(w, c, now)) {
                    DENY_BY = w.c;
                    return 2;
                }
            }
        if (!starving)
            for (const I of J.inLinks) {
                // yield to faster higher-priority traffic about to arrive
                const arr = I.cars;
                for (let k = arr.length - 1; k >= 0; k--) {
                    const o = arr[k];
                    if (o === c || o.conn) continue;
                    const front = o.s + o.len / 2;
                    if (front < I.len - 70) break;
                    if (
                        o.v < 2 ||
                        (o.reg?.length && o.reg[o.reg.length - 1].J === J)
                    )
                        continue;
                    const t = target(o);
                    if (!t || t.M.J !== J || t.M.prio <= M.prio) continue;
                    const d = t.stop - front;
                    if (d < -0.5 || d / o.v > 3.2) continue;
                    if (redFor(o, t.M)) continue;
                    if (conflict(t.M, M)) {
                        DENY_BY = o;
                        return 3;
                    }
                }
            }
        DENY_BY = null;
        for (let k = 0; k < n; k++)
            if (!room(c, ch[k])) {
                const N = ch[k].kind === "c" ? ch[k].outL : ch[k].L;
                DENY_BY =
                    N.cars.find(
                        (o) =>
                            o !== c &&
                            !o.conn &&
                            o.s - o.len / 2 >= 0 &&
                            (ch[k].kind === "c" || o.s > c.s),
                    ) || null;
                return 4;
            }
        return 0;
    };
    // per car: junction constraint for this step -> smallest gap (m) + leader speed; handles grants / registration
    const R = { gap: 1e4, vL: 0, why: "", whyC: null };
    const WHY = [0, 0, 0, 0, 0, 0]; // denial counts: -, holder, waiter, approaching, room, later light red
    // the movements a car will take through this junction from M0 on (a Broadway pseudo-node straight into the grid
    // node behind it, a mid-block crossing then the turn at the corner, ...): granted and registered as ONE unit, so a
    // holder never has to wait inside the box for a second grant (that wait was the deadlock seed: hold A, want B)
    const CH = [],
        US = [],
        DS = [];
    const chainOf = (c, M0, pick) => {
        CH[0] = M0;
        US[0] = uOf(c, M0);
        let n = 1;
        let link = c.link,
            s = c.s,
            M = M0;
        while (n < 4) {
            let nx = null;
            if (M.kind === "x") {
                for (const X of link.xm)
                    if (X.base > M.base) {
                        nx = X;
                        break;
                    }
            } else {
                s = s - link.len - M.C.len;
                link = M.outL;
                nx = link.xm[0] || null;
            }
            if (!nx) {
                let opt = null;
                if (link === c.link) opt = c.next;
                else if (!c.pre || c.pre.L === link) {
                    if (!c.pre) c.pre = { L: link, opt: pick(c, link) };
                    opt = c.pre.opt;
                }
                if (!opt) break;
                nx = moveFor(link, opt);
            }
            if (nx.J !== M0.J || has(c, nx)) break;
            CH[n] = nx;
            US[n] = nx.kind === "x" ? s - nx.base : s - link.len;
            DS[n] = nx.stopS - (s + c.len / 2);
            n++;
            M = nx;
        }
        return n;
    };
    let NOW = 0;
    const car = (c, front, lead, now, sigStop, redFor, pick) => {
        NOW = now;
        R.gap = 1e4;
        R.vL = 0;
        R.whyC = null;
        if (c.reg)
            for (let i = c.reg.length - 1; i >= 0; i--) {
                // granted but still before the stop point: the light went red -> give it back (+ the rest of its chain)
                const M = c.reg[i],
                    d = M.stopS - front;
                if (
                    (M.kind === "x"
                        ? c.link === M.L
                        : c.link === M.inL && !c.conn) &&
                    d > 0.3 &&
                    d > (c.v * c.v) / 10 &&
                    !insideOther(c, M) &&
                    sigStop(c, M, d)
                ) {
                    const ch = c.chain,
                        k0 = ch ? ch.indexOf(M) : -1;
                    if (k0 >= 0)
                        for (let k = ch.length - 1; k > k0; k--) {
                            const q = c.reg.indexOf(ch[k]);
                            if (q >= 0) unregister(c, ch[k], q);
                        }
                    unregister(c, M, c.reg.indexOf(M));
                    i = Math.min(i, c.reg.length);
                }
            }
        const t =
            c.link.len - front > 60 && !c.link.xm.length ? null : target(c); // (perf) far from the link end: nothing to do
        if (t) {
            const M = t.M,
                dStop = t.stop - front;
            // only the head of the queue asks: a car behind an uncommitted leader just follows it
            const queued =
                lead &&
                lead.s + lead.len / 2 < t.stop + 0.3 &&
                !(
                    lead.reg &&
                    lead.reg.length &&
                    lead.reg[lead.reg.length - 1].J === M.J
                );
            if (dStop < -0.5)
                register(c, M); // already past the stop point (spawned / overshoot): commit
            else if (
                !queued &&
                dStop < Math.max(9, (c.v * c.v) / 6 + 6) &&
                !sigStop(c, M, dStop)
            ) {
                let n = chainOf(c, M, pick);
                // a later light in the chain is red: take the chain up to it only if the car can wait at that stop line with its
                // rear clear of every crossing stretch of the part it holds (else it would sit in the box: wait here)
                let why = 0;
                for (let k = 1; k < n; k++)
                    if (sigStop(c, CH[k], DS[k])) {
                        for (let j = 0; j < k; j++)
                            if (US[j] + DS[k] - c.len / 2 < zEnd(CH[j]) + 0.5)
                                why = 5;
                        n = k;
                        break;
                    }
                if (!why) why = grant(c, CH, US, n, now, redFor);
                if (!why) {
                    const pri = c.wM === M && c.wAcc > STARVE;
                    const ch = CH.slice(0, n);
                    for (const q of ch) register(c, q, q !== M);
                    if (pri) c.regT = now - 100;
                    c.chain = ch;
                    c.wM = null;
                } else {
                    WHY[why]++;
                    R.gap = Math.max(0.05, dStop);
                    R.vL = 0;
                    R.why = "deny" + why;
                    R.whyC = DENY_BY;
                    if (dStop < 14) {
                        // waiting at the line: denied time accumulates per movement (starvation + FIFO order)
                        if (c.wM !== M) {
                            c.wM = M;
                            c.wT0 = now;
                            c.wAcc = 0;
                            c.wLast = now;
                        }
                        c.wAcc += Math.min(0.1, now - c.wLast);
                        c.wLast = now;
                        if (!c.wait || c.wait.M !== M) {
                            dropWait(c);
                            c.wait = {
                                c,
                                M,
                                J: M.J,
                                last: now,
                                roomOnly: false,
                                why: 0,
                            };
                            M.J.wait.push(c.wait);
                            hot.add(M.J);
                        }
                        c.wait.last = now;
                        c.wait.roomOnly = why === 4;
                        c.wait.why = why;
                        // no room behind the box for > 6 s: take another way out (the street the driver wanted is backed up)
                        // (r2) denied for > 20 s for any reason (a gridlock ring through several boxes): try another way out too
                        if (
                            ((why === 4 && c.wAcc > 6) || c.wAcc > 20) &&
                            M.kind === "c" &&
                            M.inL === c.link &&
                            c.next &&
                            (M.inL.out?.length || 0) > 1
                        ) {
                            const o = pick(c, c.link, c.next.link);
                            if (o && o.link !== c.next.link) {
                                c.next = o;
                                if (c.pre) c.pre = null;
                                dropWait(c);
                                c.wM = null;
                            }
                        }
                    }
                }
            } else {
                if (c.wait && !queued) dropWait(c);
                c.wLast = now;
            }
            if (dStop < 40 && !has(c, M)) followLeaders(c, M, false); // diverge: a car ahead that already turned off (the grant handles crossings)
        }
        if (c.reg)
            for (let i = 0; i < c.reg.length; i++)
                followLeaders(c, c.reg[i], true);
        return R;
    };
    // c is already on the path of another movement it holds in M's junction (it must clear the box, not stop in it)
    const insideOther = (c, M) => {
        for (let i = 0; i < c.reg.length; i++) {
            const R = c.reg[i];
            if (
                R !== M &&
                R.J === M.J &&
                uOf(c, R) === uOf(c, R) &&
                uOf(c, R) + c.len / 2 >
                    R.stopS - (R.kind === "x" ? R.base : R.inL.len)
            )
                return true;
        }
        return false;
    };
    // end of the last crossing-type stretch on M (a car waiting with its rear beyond it blocks nobody)
    const zEnd = (M) => {
        if (M.zEnd !== undefined) return M.zEnd;
        let z = -1e9;
        for (const X of M.J.moves) {
            const zs = conflict(M, X);
            if (zs) for (const cf of zs) if (cf.cross && cf.a1 > z) z = cf.a1;
        }
        return (M.zEnd = z);
    };
    const holds = (c, M) => has(c, M);
    const unregister = (c, M, i) => {
        c.reg.splice(i, 1);
        const occ = M.J.occ;
        for (let k = occ.length - 1; k >= 0; k--)
            if (occ[k].c === c && occ[k].M === M) {
                occ.splice(k, 1);
                break;
            }
    };
    // how far c's body can advance along M (<= 8 m) before its OBB (on the path pose) touches o's; 1e4 = clear
    const sweepFree = (c, M, u, o) => {
        const ofx = Math.cos(o.ry),
            ofz = -Math.sin(o.ry);
        for (let d = 0; d <= 8; d += 0.5) {
            const i = Math.round(u + d - M.u0);
            if (i < 0 || i >= M.n) break;
            const x = M.P[i * 4],
                z = M.P[i * 4 + 1],
                fx = M.P[i * 4 + 2],
                fz = M.P[i * 4 + 3],
                dx = o.x - x,
                dz = o.z - z;
            let hit = true;
            for (const [ax, az] of [
                [fx, fz],
                [-fz, fx],
                [ofx, ofz],
                [-ofz, ofx],
            ]) {
                const ra =
                    (c.len / 2 + 0.3) * Math.abs(fx * ax + fz * az) +
                    (c.wid / 2 + 0.2) * Math.abs(-fz * ax + fx * az);
                const rb =
                    (o.len / 2) * Math.abs(ofx * ax + ofz * az) +
                    (o.wid / 2) * Math.abs(-ofz * ax + ofx * az);
                if (Math.abs(dx * ax + dz * az) > ra + rb) {
                    hit = false;
                    break;
                }
            }
            if (hit) return Math.max(0.05, d - 0.5);
        }
        return 1e4;
    };
    const followLeaders = (c, M, held) => {
        const occ = M.J.occ;
        if (occ.length < 2) return;
        const u = uOf(c, M);
        if (u !== u) return;
        for (let i = 0; i < occ.length; i++) {
            const e = occ[i],
                o = e.c;
            if (o === c) continue;
            const dx = o.x - c.x,
                dz = o.z - c.z;
            if (dx * dx + dz * dz > 8100) continue; // (perf) > 90 m apart: no constraint this frame
            const zs = cfx(e.M, M, c.len > 7 || o.len > 7);
            if (!zs) continue;
            const uo = uOf(o, e.M);
            if (uo !== uo) continue;
            for (let zi = 0; zi < zs.length; zi++) {
                const cf = zs[zi];
                if (uo - o.len / 2 > cf.a1 + 0.5 || u - c.len / 2 > cf.b1 + 0.5)
                    continue;
                if (cf.cross) {
                    // zone gate (only on movements we hold): committed (can't stop any more) goes; else yield to a committed one / an earlier holder arriving first
                    if (!held) continue;
                    const fc = u + c.len / 2,
                        fo = uo + o.len / 2;
                    if (fc >= cf.b0 - ((c.v * c.v) / 12 + 0.5)) {
                        // committed, but a car STANDING inside the stretch is never driven into: stop at its edge (a creeping ring breaker
                        // or a force-registered car can be committed without a clear stretch ahead)
                        if (fo >= cf.a0 && uo - o.len / 2 <= cf.a1) {
                            const g = sweepFree(c, M, u, o);
                            if (g < R.gap) {
                                R.gap = g;
                                R.vL = 0;
                                R.why = "jzone";
                                R.whyC = o;
                            }
                        }
                        continue;
                    }
                    if (
                        fo >= cf.a0 - ((o.v * o.v) / 12 + 0.5) ||
                        ((o.regT < c.regT ||
                            (o.regT === c.regT && o.id < c.id)) &&
                            eta(cf.a0 - fo, o) < clearT(c, u, cf.b1))
                    ) {
                        const g = cf.b0 - 1.0 - fc;
                        if (g < R.gap) {
                            R.gap = g;
                            R.vL = 0;
                            R.why = "jzone";
                            R.whyC = o;
                        }
                    }
                    continue;
                }
                const p = uo + cf.k;
                if (p <= u) continue;
                // follow the projected car once it is on the shared stretch; before that only while it is actually coming (a car
                // standing in its own queue on another approach is not 'ahead' of us yet)
                if (uo + o.len / 2 < cf.a0 - 0.5 && o.stillT > 1.5) continue;
                const g = p - o.len / 2 - (u + c.len / 2);
                if (g < R.gap) {
                    R.gap = g;
                    R.vL = o.v;
                    R.why = "jfollow";
                    R.whyC = o;
                }
            }
        }
    };
    // release holders whose rear has left the movement (or who left its path / died), stale waiters
    const tick = (now) => {
        for (const J of hot) {
            const occ = J.occ;
            for (let i = occ.length - 1; i >= 0; i--) {
                const e = occ[i],
                    c = e.c,
                    u = uOf(c, e.M);
                if (e.pend) {
                    if (u === u) e.pend = false;
                    else if (!c.dead) continue;
                } // chained movement the car has not reached yet
                if (c.dead || u !== u || u - c.len / 2 > e.M.end + 0.3) {
                    occ.splice(i, 1);
                    if (c.reg) {
                        const k = c.reg.indexOf(e.M);
                        if (k >= 0) c.reg.splice(k, 1);
                    }
                }
            }
            const w = J.wait;
            for (let i = w.length - 1; i >= 0; i--)
                if (w[i].c.dead || now - w[i].last > 0.5) {
                    if (w[i].c.wait === w[i]) w[i].c.wait = null;
                    w.splice(i, 1);
                }
            if (!occ.length && !w.length) hot.delete(J);
        }
    };
    const stats = () => {
        let occ = 0,
            wait = 0;
        for (const J of hot) {
            occ += J.occ.length;
            wait += J.wait.length;
        }
        return {
            junctions: Js.length,
            moves: moves.length,
            hot: hot.size,
            occ,
            wait,
            deny: WHY.slice(1),
        };
    };
    return {
        moveFor,
        conflict,
        conflictBig,
        nearTurn,
        uOf,
        car,
        tick,
        register,
        stats,
        Js,
        moves,
        dropWait,
        holds,
    };
}
