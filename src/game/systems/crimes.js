// OWNER: systems engineer. Random street crimes: mugging, bank robbery, car chase — with visible actors.
// Lifecycle (event bus, see events.js):
//   crime:spawn crime            actors are placed (thug.glb + Spider-Man clips): a cowering victim + muggers, or robbers
//                                outside a bank; car chase = getaway car (red target marker) + two pursuing police cars.
//   crime:engage crime           player reached the scene. crime.enemies = [{id, object:Group, actor}] (standing thugs),
//                                crime.victim = actor|null. COMBAT HOOK: call crime.claim() inside the handler, drive the
//                                enemies yourself (set enemy.actor.external = true), then emit
//                                'crime:cleared' {id} (or the legacy 'crime:resolve' {id, success}).
//   crime:resolved | crime:failed | crime:expired crime
//   crime:zone {id, pos, radius, active, type, moving?}  civilians inside `radius` of an active crime should flee (city life);
//                                re-emitted every 0.5 s for the moving car chase, active:false when the crime ends
//   If nobody claims an engaged crime, a built-in fallback runs: thugs square up and swing at Spider-Man; tap [F]
//   ("Web Strike") next to a thug to hit it (2 hits = knocked down). All down -> cleared. The victim gets up and runs off.
//   Car chase fallback: stay close to the getaway car until the meter fills.
// Fast travel suspends an active crime (timers and the chase freeze) until the player comes back within 260 m.
// crime = { id, type:'mugging'|'bankAlarm'|'carChase', title, pos:Vector3 (live), district, state, claimed, t, meter,
//           enemies, victim, claim() }
import * as THREE from "three";
import { G, streetsAt, avenues, onLand } from "../../world/layout.js";
import { on, emit } from "./events.js";
import { roadGraph } from "./route.js";
import { loadVehicleModels } from "../../world/vehicles.js";
import { createPartMaterial } from "../../world/partmat.js";
import { createActors } from "./crimeactors.js";

const TYPES = {
    mugging: {
        title: "Mugging",
        text: "A civilian is being robbed",
        icon: "mugging",
        xp: 300,
        engage: 26,
        thugs: 2,
    },
    bankAlarm: {
        title: "Bank Robbery",
        text: "Alarm triggered at a bank",
        icon: "alarm",
        xp: 450,
        engage: 34,
        thugs: 3,
    },
    carChase: {
        title: "Car Chase",
        text: "Armed suspects fleeing police",
        icon: "chase",
        xp: 500,
        engage: 60,
        thugs: 0,
    },
};
const _v = new THREE.Vector3();

export function createCrimes(sys) {
    const { ctx, save, ui, audio, prog, data } = sys;
    const q = new URLSearchParams(location.search);
    let enabled = !q.has("playtest");
    let next = 28,
        seq = 0,
        active = null,
        chase = null;
    const actors = createActors(ctx);
    const leftovers = []; // actors of finished crimes: {a, until}

    on("crime:resolve", ({ id, success = true } = {}) => {
        if (active && active.id === id)
            finish(success, success ? undefined : "failed");
    });
    on("crime:cleared", ({ id } = {}) => {
        if (active && (active.id === id || id == null)) finish(true);
    });
    on("fasttravel:start", () => {
        if (active) {
            active.suspended = true;
            active.suspendT = 0;
        }
    });

    // (dev menu) a sidewalk spot 28-60 m from p (widening if there is none), preferring the direction `fwd`; `out`
    // points from the building line to the nearest roadway, like pickSpot's
    function pickSpotNear(type, p, fwd) {
        const road = (t) =>
            t === "avenue" || t === "street" || t === "intersection";
        const sideOK = (x, z) => {
            const q = streetsAt(x, z);
            return (
                q.type === "sidewalk" &&
                !q.island &&
                onLand(x, z) &&
                ctx.world.groundHeight(x, z, 3) < 1.2
            );
        };
        for (const [r0, r1] of [
            [28, 60],
            [55, 120],
            [110, 240],
        ]) {
            for (let tries = 0; tries < 120; tries++) {
                const base = fwd ? Math.atan2(fwd.x, fwd.z) : 0,
                    spread = fwd && tries < 70 ? 1.2 : Math.PI;
                const a = base + (Math.random() * 2 - 1) * spread,
                    r = r0 + Math.random() * (r1 - r0);
                const x = p.x + Math.sin(a) * r,
                    z = p.z + Math.cos(a) * r;
                if (type === "carChase") {
                    const ax = avenues.reduce(
                            (b, v) =>
                                Math.abs(v - x) < Math.abs(b - x) ? v : b,
                            avenues[0],
                        ),
                        sz = G.ST_SP * Math.round(z / G.ST_SP);
                    if (streetsAt(ax, sz).type === "intersection")
                        return { pos: new THREE.Vector3(ax, 0, sz) };
                    continue;
                }
                if (!sideOK(x, z)) continue;
                let out = null;
                for (const d of [2, 3.5, 5, 7]) {
                    for (const [dx, dz] of [
                        [1, 0],
                        [-1, 0],
                        [0, 1],
                        [0, -1],
                    ])
                        if (
                            !out &&
                            road(streetsAt(x + dx * d, z + dz * d).type)
                        )
                            out = new THREE.Vector3(dx, 0, dz);
                    if (out) break;
                }
                if (!out) continue;
                const along = new THREE.Vector3(-out.z, 0, out.x);
                if (
                    ![-2, 3.5].every((k) =>
                        sideOK(x + along.x * k, z + along.z * k),
                    )
                )
                    continue; // room for the scene along the sidewalk
                return {
                    pos: new THREE.Vector3(x, ctx.world.groundHeight(x, z), z),
                    out,
                };
            }
        }
        return null;
    }
    function pickSpot(type, p) {
        const rnd = Math.random;
        for (let tries = 0; tries < 60; tries++) {
            const a = rnd() * Math.PI * 2,
                r = 170 + rnd() * 260;
            const x = p.x + Math.cos(a) * r,
                z = p.z + Math.sin(a) * r;
            if (!onLand(x, z)) continue;
            const ax = avenues.reduce(
                    (b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b),
                    avenues[0],
                ),
                sz = G.ST_SP * Math.round(z / G.ST_SP);
            if (type === "carChase") {
                if (streetsAt(ax, sz).type !== "intersection") continue;
                return { pos: new THREE.Vector3(ax, 0, sz) };
            }
            // sidewalk mid-block along an avenue; `out` points from the building line toward the road
            const side = rnd() < 0.5 ? -1 : 1;
            const px = ax + side * (G.AV_HALF + G.AV_WALK * 0.5),
                pz = sz + (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 20);
            if (streetsAt(px, pz).type !== "sidewalk") continue;
            return {
                pos: new THREE.Vector3(px, ctx.world.groundHeight(px, pz), pz),
                out: new THREE.Vector3(-side, 0, 0),
            };
        }
        return null;
    }

    // ---------------------------------------------------------------- scene actors
    async function stage(c, out) {
        const ok = await actors.ready();
        if (!ok || active !== c) return;
        const P = c.pos,
            along = new THREE.Vector3(-out.z, 0, out.x); // along the sidewalk
        const at = (a, o) =>
            P.clone().addScaledVector(along, a).addScaledVector(out, o);
        const V = (p) => {
            p.y = ctx.world.groundHeight(p.x, p.z, p.y + 2);
            return p;
        };
        if (c.type === "mugging") {
            const vp = V(at(0, -0.9)); // victim pressed toward the building line
            c.victim = actors.spawn({ pos: vp, variant: "c", role: "victim" });
            const t1 = actors.spawn({
                pos: V(at(-0.9, 0.35)),
                variant: "a",
                role: "thug",
            });
            const t2 = actors.spawn({
                pos: V(at(1.3, 0.9)),
                variant: "b",
                role: "thug",
            });
            c.thugs = [t1, t2].filter(Boolean);
            if (c.victim) {
                c.victim.face(at(-2, 3), true);
                c.victim.play("jumpCrouch");
            }
            if (t1) {
                t1.face(vp, true);
                t1.bully = c.victim;
            }
            if (t2) {
                t2.face(at(5, 3), true);
                t2.play("idleLook");
                t2.lookout = true;
            }
        } else if (c.type === "bankAlarm") {
            const door = V(at(0, -1.2));
            c.victim = actors.spawn({
                pos: V(at(3.2, -1.0)),
                variant: "c",
                role: "victim",
            });
            if (c.victim) {
                c.victim.face(door, true);
                c.victim.play("jumpCrouch");
            }
            c.thugs = [
                actors.spawn({
                    pos: V(at(-1.2, 0.2)),
                    variant: "b",
                    role: "thug",
                }),
                actors.spawn({
                    pos: V(at(0.9, 0.6)),
                    variant: "a",
                    role: "thug",
                }),
                actors.spawn({
                    pos: V(at(-0.2, 1.8)),
                    variant: "b",
                    role: "thug",
                }),
            ].filter(Boolean);
            c.thugs.forEach((t, i) => {
                t.face(at(i - 1, 8), true);
                t.play(i === 1 ? "idleLook" : "thugIdle");
                t.lookout = true;
            });
        }
        c.enemies = (c.thugs || []).map((a) => ({
            id: a.id,
            object: a.root,
            actor: a,
        }));
    }
    function releaseActors(c, how) {
        const until = performance.now() + (how === "won" ? 16000 : 9000);
        for (const t of c.thugs || []) {
            if (how === "flee" && !t.down && !t.external) {
                const away = t.root.position
                    .clone()
                    .sub(c.pos)
                    .setY(0)
                    .normalize()
                    .multiplyScalar(60)
                    .add(t.root.position);
                t.runTo(away, 6.5);
            }
            leftovers.push({ a: t, until });
        }
        const v = c.victim;
        if (v) {
            if (how === "won") {
                v.play("perchToStand", { then: "idle" });
                setTimeout(() => {
                    if (v.root.parent) {
                        const away = v.root.position
                            .clone()
                            .add(
                                new THREE.Vector3(Math.random() - 0.5, 0, 1)
                                    .normalize()
                                    .multiplyScalar(40),
                            );
                        v.runTo(away, 5.2);
                    }
                }, 1600);
            }
            leftovers.push({ a: v, until });
        }
    }

    // opts.near: spawn 28-60 m from the player (dev menu), preferring opts.fwd (the camera's view direction)
    function spawn(type, opts = {}) {
        if (active) return null;
        const p = ctx.player.position;
        type =
            type ||
            ["mugging", "bankAlarm", "carChase"][Math.floor(Math.random() * 3)];
        const spot = opts.near
            ? pickSpotNear(type, p, opts.fwd)
            : pickSpot(type, p);
        if (!spot) return null;
        const { pos } = spot;
        const T = TYPES[type];
        const c = (active = {
            id: "crime_" + ++seq,
            type,
            title: T.title,
            text: T.text,
            icon: T.icon,
            pos,
            district: data.districtAt(pos.x, pos.z).id,
            state: "active",
            claimed: false,
            t: 0,
            meter: 0,
            limit: type === "carChase" ? 150 : 110,
            enemies: [],
            thugs: [],
            victim: null,
            suspended: false,
            hitCd: 0,
            dev: !!opts.dev,
            claim() {
                this.claimed = true;
            },
        });
        if (type === "bankAlarm")
            audio.loop(c.id, "alarm", pos.clone().setY(pos.y + 4));
        if (type === "carChase") startChase(c);
        else {
            sys.markers.setCrime(pos);
            stage(c, spot.out);
        }
        emit("crime:spawn", c);
        emit("crime:zone", {
            id: c.id,
            pos: c.pos.clone(),
            radius: 15,
            active: true,
            type,
        });
        audio.sfx.crime();
        ui.toast({
            title: "Crime in Progress",
            text: `${T.title} — ${data.districts.find((d) => d.id === c.district).name}`,
            icon: T.icon,
            sound: null,
        });
        const dn = data.districts.find((d) => d.id === c.district).name;
        const lines = {
            mugging: [
                [
                    "Dispatch",
                    `Report of a mugging in progress, ${dn}. Any units in the area?`,
                ],
                ["Unit 12", "Ten-four, en route. Three minutes out."],
            ],
            bankAlarm: [
                [
                    "Dispatch",
                    `Silent alarm tripped at a bank in ${dn}. Suspects may be armed.`,
                ],
                [
                    "Sergeant",
                    "All units, set up a perimeter. Nobody goes in alone.",
                ],
            ],
            carChase: [
                [
                    "Unit 7",
                    `We're in pursuit of a black sedan, heading through ${dn}!`,
                ],
                ["Dispatch", "Copy, Unit 7. Do not lose that vehicle."],
            ],
        }[type];
        for (const [w, t] of lines) ui.subtitle?.(w, t);
        return c;
    }

    // remove the active crime at once, no toast / XP / fail (dev menu toggle): combat drops its fight ('crime:cancelled'),
    // every actor of the scene is removed
    function cancel() {
        const c = active;
        if (!c) return false;
        active = null;
        c.state = "cancelled";
        audio.stopLoop(c.id);
        audio.stopLoop(c.id + "_siren");
        if (chase) {
            chase.hide();
            chase = null;
        }
        ride.pending = ride.on = false;
        emit("crime:cancelled", c);
        for (const a of [...(c.thugs || []), c.victim])
            if (a?.root?.parent) a.dispose();
        ui.crime(null);
        sys.markers.setCrime(null);
        sys.markers.setCrimeColumn(true);
        emit("crime:zone", {
            id: c.id,
            pos: c.pos.clone(),
            radius: 15,
            active: false,
            type: c.type,
        });
        next = (70 + Math.random() * 60) / (ctx.params?.crimeRate || 1);
        return true;
    }
    function finish(success, reason) {
        const c = active;
        if (!c) return;
        c.state = success ? "resolved" : reason || "failed";
        active = null;
        audio.stopLoop(c.id);
        audio.stopLoop(c.id + "_siren");
        if (chase) chase.stop(success);
        releaseActors(c, success ? "won" : "flee");
        const st = save.state;
        if (success) {
            st.crimes.stopped++;
            st.crimes.byType[c.type] = (st.crimes.byType[c.type] || 0) + 1;
            st.crimes.byDistrict[c.district] =
                (st.crimes.byDistrict[c.district] || 0) + 1;
            save.markDirty();
            audio.sfx.success();
            ui.toast({
                title: "Crime Stopped",
                text: c.victim ? `${c.title} — "Thanks, Spider-Man!"` : c.title,
                icon: c.icon,
                tone: "gold",
                sound: null,
            });
            prog.addXp(TYPES[c.type].xp, "crime");
            emit("crime:resolved", c);
        } else {
            ui.toast({
                title:
                    reason === "expired" ? "Suspects Escaped" : "Crime Failed",
                text: c.title,
                icon: c.icon,
                sound: "deny",
            });
            emit(reason === "expired" ? "crime:expired" : "crime:failed", c);
        }
        ui.crime(null);
        sys.markers.setCrime(null);
        sys.markers.setCrimeColumn(true);
        emit("crime:zone", {
            id: c.id,
            pos: c.pos.clone(),
            radius: 15,
            active: false,
            type: c.type,
        });
        next = (70 + Math.random() * 60) / (ctx.params?.crimeRate || 1);
    }

    // ---------------------------------------------------------------- car chase
    let vehicles = null,
        vehLoading = null;
    const NCAR = 3; // 0 = getaway, 1..2 = police
    async function loadCars() {
        if (vehicles || vehLoading) return vehLoading;
        vehLoading = (async () => {
            const models = await loadVehicleModels(ctx.renderer);
            if (!models?.geos?.sedan) return null;
            const geo = models.geos.sedan.clone();
            const mat = createPartMaterial({
                name: "syschase",
                instTint: true,
                instState: false,
                map: models.atlas,
            });
            const im = new THREE.InstancedMesh(geo, mat, NCAR);
            im.castShadow = true;
            im.receiveShadow = true;
            im.frustumCulled = false;
            geo.setAttribute(
                "aTint",
                new THREE.InstancedBufferAttribute(
                    new Float32Array([
                        0.05, 0.055, 0.06, 0.92, 0.92, 0.94, 0.92, 0.92, 0.94,
                    ]),
                    3,
                ),
            );
            const box = new THREE.Box3().setFromBufferAttribute(
                geo.attributes.position,
            );
            const bars = [];
            for (let i = 1; i < NCAR; i++) {
                // police light bars (emissive; bloom does the glow, no dynamic lights = no shader recompiles)
                const bar = new THREE.Group();
                const lr = new THREE.Mesh(
                    new THREE.BoxGeometry(0.3, 0.12, 0.55),
                    new THREE.MeshStandardMaterial({
                        color: 0x300000,
                        emissive: 0xff1010,
                        emissiveIntensity: 0,
                    }),
                );
                const lb = new THREE.Mesh(
                    new THREE.BoxGeometry(0.3, 0.12, 0.55),
                    new THREE.MeshStandardMaterial({
                        color: 0x000030,
                        emissive: 0x1840ff,
                        emissiveIntensity: 0,
                    }),
                );
                lr.position.set(0, 0, 0.3);
                lb.position.set(0, 0, -0.3);
                bar.add(lr, lb);
                bar.position.y = box.max.y + 0.06;
                const root = new THREE.Group();
                root.add(bar);
                ctx.scene.add(root);
                root.visible = false;
                bars.push({ root, lr, lb });
            }
            // getaway-car target marker: red chevron floating above the roof
            const chev = new THREE.Mesh(
                new THREE.ConeGeometry(0.32, 0.6, 4),
                new THREE.MeshStandardMaterial({
                    color: 0x300000,
                    emissive: 0xff1010,
                    emissiveIntensity: 5,
                    roughness: 0.4,
                }),
            );
            chev.rotation.x = Math.PI;
            const tgt = new THREE.Group();
            tgt.add(chev);
            tgt.visible = false;
            ctx.scene.add(tgt);
            ctx.scene.add(im);
            im.visible = false;
            vehicles = {
                im,
                bars,
                tgt,
                chev,
                roof: box.max.y,
                len: box.max.x - box.min.x,
                wid: box.max.z - box.min.z,
                cx: (box.max.x + box.min.x) / 2,
                cz: (box.max.z + box.min.z) / 2,
            };
            return vehicles;
        })().catch((e) => {
            console.warn("[crimes] chase vehicles unavailable", e);
            return null;
        });
        return vehLoading;
    }

    function startChase(c) {
        const g = roadGraph();
        let idx = -1,
            bd = Infinity;
        g.nodes.forEach((n, i) => {
            const d = Math.hypot(n.x - c.pos.x, n.z - c.pos.z);
            if (n.adj.length && d < bd) {
                bd = d;
                idx = i;
            }
        });
        c.pos.set(g.nodes[idx].x, 0, g.nodes[idx].z);
        const car = {
            path: [],
            s: 0,
            speed: 0,
            target: 18,
            node: idx,
            prevNode: -1,
            pos: c.pos.clone(),
            stopped: false,
            spin: 0,
        };
        const police = [
            { s: -14, h: 0 },
            { s: -28, h: 0 },
        ];
        function extend() {
            while (car.path.length < 7) {
                const n = g.nodes[car.node];
                let opts = n.adj.filter(([j]) => j !== car.prevNode);
                if (!opts.length) opts = n.adj;
                const [j] = opts[Math.floor(Math.random() * opts.length)];
                car.path.push([car.node, j]);
                car.prevNode = car.node;
                car.node = j;
            }
        }
        extend();
        const pts = [],
            lens = [];
        function rebuild() {
            pts.length = 0;
            for (const [a, b] of car.path) {
                const A = g.nodes[a],
                    B = g.nodes[b];
                const dx = Math.sign(B.x - A.x),
                    dz = Math.sign(B.z - A.z);
                const ox = -dz * 1.8,
                    oz = dx * 1.8;
                pts.push(
                    [A.x + ox + dx * 6, A.z + oz + dz * 6],
                    [B.x + ox - dx * 6, B.z + oz - dz * 6],
                );
            }
            lens.length = 0;
            let L = 0;
            lens.push(0);
            for (let i = 1; i < pts.length; i++) {
                L += Math.hypot(
                    pts[i][0] - pts[i - 1][0],
                    pts[i][1] - pts[i - 1][1],
                );
                lens.push(L);
            }
        }
        rebuild();
        // path starts 40 m back so the police cars have road behind the getaway car
        car.s = 40;
        police[0].s = 26;
        police[1].s = 12;
        function at(s, out) {
            s = Math.max(0, s);
            let i = 1;
            while (i < lens.length - 1 && lens[i] < s) i++;
            const t = THREE.MathUtils.clamp(
                (s - lens[i - 1]) / Math.max(1e-3, lens[i] - lens[i - 1]),
                0,
                1,
            );
            out.x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t;
            out.z = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
            return out;
        }
        const m = new THREE.Matrix4(),
            q = new THREE.Quaternion(),
            P = new THREE.Vector3(),
            one = new THREE.Vector3(1, 1, 1),
            Y = new THREE.Vector3(0, 1, 0);
        const A = { x: 0, z: 0 },
            B = { x: 0, z: 0 };
        let cheading = 0,
            t = 0,
            primed = false;
        loadCars();
        audio.loop(c.id + "_siren", "siren", c.pos);
        const place = (i, s, h) => {
            at(s, A);
            at(s + 4, B);
            const hh = primed
                ? angDamp(h, Math.atan2(B.z - A.z, B.x - A.x), 8, 1 / 60)
                : Math.atan2(B.z - A.z, B.x - A.x);
            q.setFromAxisAngle(Y, -hh);
            m.compose(
                P.set(A.x, ctx.world.groundHeight(A.x, A.z), A.z),
                q,
                one,
            );
            vehicles.im.setMatrixAt(i, m);
            return hh;
        };
        const roofP = new THREE.Vector3();
        chase = {
            car,
            roof() {
                return roofP.set(
                    car.pos.x,
                    ctx.world.groundHeight(car.pos.x, car.pos.z) +
                        (vehicles?.roof ?? 1.45) +
                        0.02,
                    car.pos.z,
                );
            },
            update(dt, frozen) {
                if (!frozen) {
                    t += dt;
                    if (!car.stopped)
                        car.speed = THREE.MathUtils.damp(
                            car.speed,
                            car.target,
                            1.2,
                            dt,
                        );
                    else
                        car.speed = THREE.MathUtils.damp(car.speed, 0, 2.5, dt);
                    car.s += car.speed * dt;
                    for (const [k, pc] of police.entries()) {
                        const gap = car.stopped ? 7 + k * 6.5 : 14 + k * 14;
                        pc.s +=
                            THREE.MathUtils.clamp(
                                (car.s - gap - pc.s) * 1.5,
                                0,
                                car.stopped ? 15 : car.speed * 1.35 + 2,
                            ) * dt;
                    }
                    if (car.s > lens[2] + 1 && police[1].s > lens[2] + 1) {
                        car.path.shift();
                        const cut = lens[2];
                        car.s -= cut;
                        for (const pc of police) pc.s -= cut;
                        extend();
                        rebuild();
                    }
                }
                at(car.s, A);
                at(car.s + 4, B);
                cheading =
                    angDamp(
                        cheading,
                        Math.atan2(B.z - A.z, B.x - A.x),
                        primed ? 8 : 1e3,
                        Math.max(dt, 1 / 60),
                    ) + (car.stopped && !frozen ? car.spin * dt : 0);
                if (car.stopped) car.spin *= Math.exp(-2 * dt);
                c.pos.set(A.x, 0, A.z);
                car.pos.copy(c.pos);
                audio.loopPos(c.id + "_siren", _v.set(A.x, 1, A.z));
                if (vehicles) {
                    const { im, bars, tgt, chev, roof } = vehicles;
                    im.visible = true;
                    q.setFromAxisAngle(Y, -cheading);
                    m.compose(
                        P.set(A.x, ctx.world.groundHeight(A.x, A.z), A.z),
                        q,
                        one,
                    );
                    im.setMatrixAt(0, m);
                    tgt.visible = !car.stopped && !ride.on;
                    tgt.position.set(
                        A.x,
                        P.y + roof + 1.6 + Math.sin(t * 4) * 0.15,
                        A.z,
                    );
                    chev.rotation.y = t * 2.5;
                    chase.heading = cheading;
                    if (chase.web) {
                        chase.web.position.set(A.x, P.y, A.z);
                        chase.web.quaternion.copy(q);
                    }
                    for (let k = 0; k < police.length; k++) {
                        police[k].h = place(k + 1, police[k].s, police[k].h);
                        const b = bars[k];
                        b.root.visible = true;
                        b.root.position.copy(P);
                        b.root.quaternion.copy(q);
                        const ph = (t * 3.2 + k * 0.37) % 1;
                        b.lr.material.emissiveIntensity = ph < 0.5 ? 45 : 0;
                        b.lb.material.emissiveIntensity = ph >= 0.5 ? 55 : 0;
                    }
                    im.instanceMatrix.needsUpdate = true;
                    primed = true;
                }
            },
            hide() {
                if (vehicles) {
                    vehicles.im.visible = false;
                    vehicles.tgt.visible = false;
                    for (const b of vehicles.bars) b.root.visible = false;
                }
                if (chase?.web) {
                    ctx.scene.remove(chase.web);
                    chase.web = null;
                }
            },
            stop(success) {
                if (success) {
                    car.stopped = true;
                    car.spin = 2.2;
                } else car.target = 26;
                setTimeout(
                    () => {
                        if (chase?.car === car) {
                            chase.hide();
                            chase = null;
                        }
                    },
                    success ? 12000 : 5000,
                );
            },
        };
    }

    // ---------------------------------------------------------------- car chase: zip + ride + web finisher
    const ride = { pending: false, on: false, last: new THREE.Vector3() };
    const UPV = new THREE.Vector3(0, 1, 0);
    function zipToCar() {
        if (!chase) return;
        const R = chase.roof();
        ctx.player.traversal.forceZip({
            pos: R.clone(),
            normal: UPV.clone(),
            kind: "roofEdge",
        });
        ride.pending = true;
        ride.on = false;
        ride.last.copy(R);
        audio.sfx.zip();
    }
    function rideUpdate(c, dt) {
        const s = ctx.player.state;
        if (!chase || !s) return;
        const R = chase.roof();
        if (ride.pending) {
            if (s.mode === "zip") {
                // home the zip onto the moving roof
                const Z = s.zip;
                Z.target.copy(R);
                Z.p2.copy(R);
                Z.p2.y += 0.95;
            } else if (s.mode === "perch" && s.pos.distanceTo(R) < 3) {
                ride.pending = false;
                ride.on = true;
                ride.last.copy(R);
                ui.toast({
                    title: "On the Car",
                    text: "Hold [F] to web it to the road",
                    icon: "chase",
                    ms: 3000,
                    sound: null,
                });
            } else {
                ride.pending = false;
            }
        }
        if (ride.on) {
            if (s.mode !== "perch" || chase.car.stopped) {
                ride.on = false;
                return;
            }
            const dlt = _v.copy(R).sub(ride.last);
            ride.last.copy(R);
            s.pos.add(dlt);
            s.perch?.pos?.add(dlt);
            s.zip?.target?.add(dlt);
            s.zip?.p2?.add(dlt);
        }
    }
    // webbing texture (alpha): radial strands + sagging rings + fine cross fibres, drawn once on a canvas
    let webTex = null;
    function webTexture() {
        if (webTex) return webTex;
        const N = 512,
            c = document.createElement("canvas");
        c.width = c.height = N;
        const g = c.getContext("2d");
        const cx = N / 2,
            cy = N / 2,
            spokes = 18;
        let s = 7;
        const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        g.strokeStyle = "rgba(255,255,255,.95)";
        g.lineCap = "round";
        const ang = [];
        for (let i = 0; i < spokes; i++)
            ang.push((i / spokes) * Math.PI * 2 + (rnd() - 0.5) * 0.15);
        for (const a of ang) {
            g.lineWidth = 3 + rnd() * 2;
            g.beginPath();
            g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(a) * N * 0.72, cy + Math.sin(a) * N * 0.72);
            g.stroke();
        }
        for (let r = 26; r < N * 0.7; r += 22 + r * 0.08) {
            g.lineWidth = 1.6 + rnd();
            g.beginPath();
            for (let i = 0; i <= spokes; i++) {
                const a0 = ang[i % spokes],
                    a1 =
                        ang[(i + 1) % spokes] +
                        (i + 1 === spokes ? Math.PI * 2 : 0),
                    am = (a0 + a1) / 2,
                    rr = r * (1 + (rnd() - 0.5) * 0.08);
                if (i === 0)
                    g.moveTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
                g.quadraticCurveTo(
                    cx + Math.cos(am) * rr * 0.86,
                    cy + Math.sin(am) * rr * 0.86,
                    cx + Math.cos(a1) * rr,
                    cy + Math.sin(a1) * rr,
                );
            }
            g.stroke();
        }
        g.strokeStyle = "rgba(255,255,255,.35)";
        g.lineWidth = 1;
        for (let i = 0; i < 70; i++) {
            const a = rnd() * 6.28,
                r0 = rnd() * N * 0.5;
            g.beginPath();
            g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
            g.lineTo(
                cx + Math.cos(a + 0.4) * (r0 + 40),
                cy + Math.sin(a + 0.4) * (r0 + 40),
            );
            g.stroke();
        }
        const blob = g.createRadialGradient(cx, cy, 0, cx, cy, 60);
        blob.addColorStop(0, "rgba(255,255,255,.95)");
        blob.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = blob;
        g.fillRect(0, 0, N, N);
        webTex = new THREE.CanvasTexture(c);
        webTex.colorSpace = THREE.SRGBColorSpace;
        webTex.anisotropy = 8;
        return webTex;
    }
    // draped over the car (a slightly oversized shell: roof + sides get webbing) plus a splat pinning it to the road
    function webDrape() {
        const V = vehicles;
        const map = webTexture();
        const mat = new THREE.MeshStandardMaterial({
            map,
            alphaMap: map,
            transparent: true,
            alphaTest: 0.25,
            color: 0xf4f6fa,
            roughness: 0.55,
            side: THREE.DoubleSide,
            depthWrite: true,
        });
        const g = new THREE.Group();
        const shell = new THREE.Mesh(
            new THREE.BoxGeometry(V.len * 1.04, V.roof * 1.02, V.wid * 1.1),
            mat,
        );
        shell.position.set(V.cx, V.roof * 0.51, V.cz);
        g.add(shell);
        const splat = new THREE.Mesh(
            new THREE.PlaneGeometry(V.len * 1.9, V.wid * 2.6),
            mat,
        );
        splat.rotation.x = -Math.PI / 2;
        splat.position.set(V.cx, 0.03, V.cz);
        g.add(splat);
        return g;
    }
    function webCar(c) {
        if (!chase || chase.car.stopped) return;
        if (vehicles) {
            const w = webDrape();
            ctx.scene.add(w);
            chase.web = w;
        }
        // end the ride: hop off to the side of the car and drop to the road (never left perched in mid-air)
        if (ride.on || ctx.player.state?.mode === "perch") {
            const R = chase.roof(),
                side = new THREE.Vector3(
                    Math.cos(chase.heading ?? 0),
                    0,
                    Math.sin(chase.heading ?? 0),
                );
            side.set(-side.z, 0, side.x);
            const to = R.clone().addScaledVector(side, 2.6);
            to.y = R.y + 0.4;
            ctx.player.teleport(to, Math.atan2(R.x - to.x, R.z - to.z));
        }
        ctx.player.cam?.shake?.(0.25);
        audio.sfx.thwip(1.3);
        audio.sfx.land?.(0.6);
        ride.on = false;
        ride.pending = false;
        finish(true); // chase.stop(true) spins the car out; the police cars pull up behind it
    }
    // ---------------------------------------------------------------- fallback fight (until combat claims crimes)
    function fallbackFight(c, dt, p) {
        for (const th of c.thugs) {
            if (th.down || th.external) continue;
            const d = Math.hypot(
                th.root.position.x - p.x,
                th.root.position.z - p.z,
            );
            th.cd = (th.cd ?? Math.random() * 1.5) - dt;
            if (d > 2.2 && d < 40) {
                if (!th.move || th.move.to.distanceTo(p) > 1.5) {
                    th.runTo(_v.copy(p).setY(0), d > 8 ? 5.8 : 3.2);
                    th.onArrive = () => th.stop("thugIdle");
                }
            } else if (d <= 2.2) {
                if (th.move) th.stop("thugIdle");
                th.face(p);
                if (th.cd <= 0 && performance.now() - th.lastHit > 700) {
                    th.cd = 1.6 + Math.random() * 1.2;
                    th.play(
                        ["thugPunch1", "thugPunch2", "thugKick"][
                            Math.floor(Math.random() * 3)
                        ],
                        { fade: 0.1, then: "thugIdle" },
                    );
                    setTimeout(() => {
                        if (
                            !th.down &&
                            th.root.position.distanceTo(ctx.player.position) <
                                2.6
                        ) {
                            ctx.player.cam?.shake?.(0.12);
                            audio.sfx.land?.(0.15);
                        }
                    }, 260);
                }
            }
        }
    }
    function nearestStanding(c, p, maxD = 3.2) {
        let best = null,
            bd = maxD;
        for (const th of c.thugs || []) {
            if (th.down) continue;
            const d = th.root.position.distanceTo(
                _v.copy(p).setY(th.root.position.y),
            );
            if (d < bd) {
                bd = d;
                best = th;
            }
        }
        return best;
    }

    // ---------------------------------------------------------------- per-frame
    const api = {
        get active() {
            return active;
        },
        get enabled() {
            return enabled;
        },
        actors,
        enable(v = true) {
            enabled = v;
            if (v && !active) next = Math.min(next, 3);
        },
        spawn,
        finish,
        cancel,
        update(dt, p) {
            actors.update(dt);
            for (let i = leftovers.length - 1; i >= 0; i--) {
                const L = leftovers[i];
                if (
                    performance.now() > L.until &&
                    L.a.root.position.distanceTo(p) > 25
                ) {
                    L.a.dispose();
                    leftovers.splice(i, 1);
                }
            }
            if (!active) {
                chase?.update(dt, false);
                if (enabled) {
                    next -= dt;
                    if (next <= 0) {
                        next = 20;
                        spawn();
                    }
                }
                return;
            }
            const c = active;
            const dh = Math.hypot(c.pos.x - p.x, c.pos.z - p.z); // shown everywhere (tracker + world pin use the same number)
            const d = dh + Math.max(0, Math.abs(p.y - c.pos.y) - 20);
            if (c.suspended) {
                c.suspendT += dt;
                chase?.update(dt, true);
                if (d < 260) c.suspended = false;
                else {
                    if (c.suspendT > 240) finish(false, "expired");
                    else
                        ui.crime({
                            title: c.title,
                            text: `Suspended — return to the scene · ${Math.round(dh)} m`,
                            meter: Math.max(0, 1 - c.t / c.limit),
                            caption: "CRIME ON HOLD",
                        });
                    return;
                }
            }
            chase?.update(dt, false);
            c.t += dt;
            if (c.type === "carChase") {
                c.zoneT = (c.zoneT || 0) - dt;
                if (c.zoneT <= 0) {
                    c.zoneT = 0.5;
                    emit("crime:zone", {
                        id: c.id,
                        pos: c.pos.clone(),
                        radius: 15,
                        active: true,
                        type: c.type,
                        moving: true,
                    });
                }
            }
            sys.markers.setCrimeColumn(d > 30);
            if (c.state === "active") {
                if (d < TYPES[c.type].engage) {
                    c.state = "engaged";
                    for (const th of c.thugs) {
                        th.lookout = false;
                        th.bully = null;
                        th.face(p);
                        th.play("thugIdle", { fade: 0.2 });
                    }
                    c.enemies = c.thugs.map((a) => ({
                        id: a.id,
                        object: a.root,
                        actor: a,
                    }));
                    emit("crime:engage", c);
                    c.engageT = c.t;
                    c.meter = 0;
                } else if (c.t > c.limit) {
                    finish(false, "expired");
                    return;
                } else {
                    // ambient scene: the mugger shoves the victim now and then
                    for (const th of c.thugs)
                        if (th.bully && !th.then && Math.random() < dt * 0.5) {
                            th.play("thugPunch2", {
                                fade: 0.1,
                                then: "thugIdle",
                            });
                            setTimeout(
                                () =>
                                    th.bully?.play("thugStumbleBack", {
                                        fade: 0.08,
                                        then: "jumpCrouch",
                                    }),
                                230,
                            );
                        }
                }
            }
            let tracker = {
                title: c.title,
                text: `${Math.round(dh)} m`,
                meter: Math.max(0, 1 - c.t / c.limit),
                caption: "CRIME IN PROGRESS",
            };
            if (c.claimed && !c.handedOff) {
                c.handedOff = true;
                for (const th of c.thugs) {
                    th.external = true;
                    th.move = null;
                }
            }
            if (!c.claimed && c.handedOff) {
                c.handedOff = false;
                for (const th of c.thugs) th.external = false;
            } // combat released it
            // watchdog (fallback only): combat normally emits 'crime:cleared'. While combat owns the crime we count every
            // enemy in its fight (reinforcements included); an enemy is finished only when !alive (down / webbed can get up).
            // If all are finished for 1.5 s, or combat has nobody left to fight and has been idle for 5 s, clear it ourselves.
            if (c.claimed) {
                const cmb = ctx.combat,
                    f = cmb?.fight;
                const own = f && f.crime === c;
                const list = own ? cmb.enemies || [] : [];
                let left = 0;
                for (const e of list) {
                    const th = c.thugs.find((t) => t === e.actor);
                    if (th)
                        th.down =
                            !e.alive ||
                            ["down", "out", "webbed"].includes(e.state);
                    if (e.alive) left++;
                }
                c.cmbLeft = list.length
                    ? left
                    : c.thugs.filter((t) => !t.down).length;
                c.cmbTotal = list.length || c.thugs.length;
                c.meter = c.cmbTotal ? 1 - c.cmbLeft / c.cmbTotal : c.meter;
                c.idleT = own ? 0 : (c.idleT || 0) + dt; // combat dropped the fight without telling us
                c.clearT =
                    own && list.length && !left ? (c.clearT || 0) + dt : 0;
                if (
                    c.clearT > 1.5 ||
                    (c.idleT > 5 && c.thugs.every((t) => t.down))
                ) {
                    emit("crime:cleared", { id: c.id });
                    return;
                }
            }
            const waitClaim =
                c.state === "engaged" &&
                !c.claimed &&
                c.type !== "carChase" &&
                c.t - (c.engageT ?? c.t) < 0.5;
            if (waitClaim) {
                /* combat gets ~0.5 s to claim before the stand-in fight starts */
            } else if (c.state === "engaged" && !c.claimed) {
                if (c.type === "carChase") {
                    // gameplay: web-zip onto the roof (the zip homes onto the moving car), ride it, then hold [F] to web it
                    // to the road. Police box it in once it slows down.
                    rideUpdate(c, dt);
                    if (chase) chase.car.target = d < 30 ? 12 : 18; // it's harder to shake Spider-Man up close
                    // the only way to win is holding [F] (web the car); the meter shows the escape clock
                    c.meter = Math.max(0, 1 - c.t / c.limit);
                    tracker = {
                        title: "Stop the Getaway Car",
                        text: ride.on
                            ? "Hold [F] — web the car"
                            : d < 40
                              ? "[F] Web-zip onto the car"
                              : `Catch up — ${Math.round(dh)} m`,
                        meter: c.meter,
                        caption: "CAR CHASE",
                    };
                    if (c.t > c.limit) {
                        finish(false, "expired");
                        return;
                    }
                    if (d > 320) {
                        finish(false);
                        return;
                    }
                } else {
                    fallbackFight(c, dt, p);
                    const left = c.thugs.filter((t) => !t.down).length,
                        total = c.thugs.length;
                    c.meter = total ? 1 - left / total : 1;
                    tracker = {
                        title:
                            c.type === "bankAlarm"
                                ? "Stop the Robbers"
                                : "Stop the Muggers",
                        text: left
                            ? `${left} of ${total} left — [F] Web Strike`
                            : "Area clear",
                        meter: c.meter,
                        caption: c.title.toUpperCase(),
                    };
                    if (total && !left) {
                        emit("crime:cleared", { id: c.id });
                        return;
                    }
                    if (!total && d < 6) {
                        emit("crime:cleared", { id: c.id });
                        return;
                    } // actors failed to load
                    if (d > 160) {
                        finish(false);
                        return;
                    }
                }
            } else if (c.claimed)
                tracker = {
                    title:
                        c.type === "bankAlarm"
                            ? "Stop the Robbers"
                            : "Stop the Muggers",
                    text: c.cmbTotal
                        ? `${c.cmbLeft} of ${c.cmbTotal} left`
                        : "Take them down",
                    meter: c.meter,
                    caption: c.title.toUpperCase(),
                };
            ui.crime(tracker);
        },
        interact(p) {
            const c = active;
            if (!c || c.claimed || c.state !== "engaged") return null;
            if (c.type === "carChase") {
                if (!chase || chase.car.stopped) return null;
                const R = chase.roof(),
                    d = R.distanceTo(p);
                if (ride.on || d < 7)
                    return {
                        id: c.id + "web",
                        pos: R.clone().setY(R.y + 0.6),
                        label: "Web the Car",
                        sub: "Pin it to the road",
                        hold: 2.0,
                        priority: 10,
                        tick: (k) => audio.sfx.thwip(0.5 + k * 0.6),
                        action: () => webCar(c),
                    };
                if (d < 45 && ctx.player.traversal?.forceZip)
                    return {
                        id: c.id + "zip",
                        pos: R.clone().setY(R.y + 0.8),
                        label: "Web-Zip to Car",
                        sub: "Getaway car",
                        hold: 0,
                        priority: 10,
                        action: () => zipToCar(),
                    };
                return null;
            }
            const th = nearestStanding(c, p);
            if (!th) return null;
            return {
                id: c.id + th.id,
                pos: th.root.position.clone().setY(th.root.position.y + 1.9),
                label: "Web Strike",
                sub: th.hp > 1 ? "Thug" : "Finish him",
                hold: 0,
                priority: 9,
                action: () => {
                    th.face(p);
                    const k = th.hit();
                    ctx.player.cam?.shake?.(k ? 0.2 : 0.1);
                    audio.sfx.thwip(1.1);
                    audio.sfx.land?.(k ? 0.5 : 0.25);
                    ctx.player.playGesture?.("strike");
                },
            };
        },
        pins(p, out) {
            const c = active;
            if (!c || ride.on) return;
            const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
            if (c.type !== "carChase" && d < 30) {
                for (const th of c.thugs || [])
                    if (!th.down)
                        out.push({
                            kind: "crime",
                            pos: th.root.position
                                .clone()
                                .setY(th.root.position.y + 2.3),
                            label: "",
                            scale: 0.55,
                            cls: "crime",
                        });
                return;
            }
            out.push({
                kind: c.icon,
                pos:
                    c.type === "carChase"
                        ? c.pos.clone().setY(3.4)
                        : c.pos.clone().setY(c.pos.y + 3),
                dist: d,
                edge: true,
                cls: "crime",
                scale: 1.05,
            });
        },
    };
    return api;
}

function angDamp(a, b, rate, dt) {
    let d = b - a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return a + d * (1 - Math.exp(-rate * dt));
}
