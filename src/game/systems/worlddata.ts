/**
 * Open-world data generation.
 *
 * @module src-game-systems-worlddata
 * @version 1.0.0
 * @file src/game/systems/worlddata.ts
 * @since 0.0.1
 * @description Builds districts, towers, stations, collectibles, landmarks, and other world metadata from the city layout.
 */

import * as THREE from "three";
import {
    G,
    avenues,
    streets,
    streetsAt,
    mulberry32,
    inPark,
    stHalfAt,
} from "@/world/layout";

export const DISTRICTS = [
    {
        id: "uws",
        name: "Upper West Side",
        rect: { x0: -800, x1: -234, z0: -2151, z1: -569 },
        anchor: [-450, -1250] as [number, number],
        landmark: "Baxter Building",
        lmDesc: "Home of a certain fantastic family. The rooftop lab still hums at night.",
        photoHint:
            "Brownstones and a long avenue heading north. Aunt May used to shop here.",
    },
    {
        id: "park",
        name: "Central Park",
        rect: { x0: -234, x1: 234, z0: -2151, z1: -569 },
        anchor: [0, -760] as [number, number],
        landmark: "Sheep Meadow",
        lmDesc: "Fifteen acres of lawn in the middle of Manhattan. Best picnic spot in the city.",
        photoHint: "Where the city stops and the trees begin.",
    },
    {
        id: "ues",
        name: "Upper East Side",
        rect: { x0: 234, x1: 900, z0: -2151, z1: -569 },
        anchor: [450, -1250] as [number, number],
        landmark: "Oscorp Tower",
        lmDesc: "Norman Osborn's monument to himself. Harry swore the view was worth the ego.",
        photoHint: "Park on one side, money on the other.",
    },
    {
        id: "hk",
        name: "Hell's Kitchen",
        rect: { x0: -800, x1: -125, z0: -569, z1: 350 },
        anchor: [-420, -100] as [number, number],
        landmark: "Fisk Tower",
        lmDesc: "Wilson Fisk's glass fortress. Still standing after everything.",
        photoHint:
            "A long block of walk-ups. The diner on the corner never closes.",
    },
    {
        id: "mid",
        name: "Midtown",
        rect: { x0: -125, x1: 900, z0: -569, z1: 350 },
        anchor: [180, -120] as [number, number],
        landmark: "Avengers Tower",
        lmDesc: 'The big "A" is gone, but tourists still point.',
        photoHint:
            "The crossroads Peter crossed every day on the way to the lab.",
    },
    {
        id: "gv",
        name: "Greenwich",
        rect: { x0: -800, x1: 0, z0: 350, z1: 1900 },
        anchor: [-400, 1000] as [number, number],
        landmark: "Alchemax HQ",
        lmDesc: "Quietly buying up half the block. Nobody knows what they make.",
        photoHint:
            "Old warehouses turned into lofts. MJ's favourite coffee place.",
    },
    {
        id: "ct",
        name: "Chinatown",
        rect: { x0: 0, x1: 900, z0: 350, z1: 1900 },
        anchor: [420, 1150] as [number, number],
        landmark: "Daily Bugle",
        lmDesc: "JJJ's old paper. The presses stopped, the headlines didn't.",
        photoHint:
            "Red lanterns, busy sidewalks. F.E.A.S.T. is just around the corner.",
    },
    {
        id: "fd",
        name: "Financial District",
        rect: { x0: -800, x1: 900, z0: 1900, z1: 3400 },
        anchor: [-120, 2700] as [number, number],
        landmark: "Roxxon Tower",
        lmDesc: "Oil money in a glass box. Security is tighter than it looks.",
        photoHint: "Towers so tall the street never sees the sun.",
    },
    {
        id: "harlem",
        name: "Harlem",
        rect: { x0: -800, x1: 900, z0: -3500, z1: -2151 },
        anchor: [0, -2750] as [number, number],
        landmark: "Apollo Theater",
        lmDesc: "Amateur Night has launched a thousand careers. The marquee still lights up the street.",
        photoHint:
            "Brownstone stoops and a marquee that lights up the whole block.",
    },
];

const ITEMS: [string, string][] = [
    [
        "Science Fair Ribbon",
        "First place, Midtown Science High. The volcano was Harry's idea.",
    ],
    ["Library Card", "Overdue since sophomore year. Sorry, Ms. Kemper."],
    ["Mixtape", 'Side A: "Songs for Swinging". Side B: mostly static.'],
    [
        "Broken Web-Shooter",
        "Mark I. The cartridge jammed mid-swing over 5th Avenue.",
    ],
    ["Subway Token", "From the day Uncle Ben took Peter to Coney Island."],
    ["Bugle Press Pass", "Expired. Robbie signed it anyway."],
    [
        "Crumpled Hall Pass",
        'Excused: "family emergency". It was a bank robbery.',
    ],
    ["Lab Goggles", "Scratched to the point of uselessness. Irreplaceable."],
    ["Pizza Coupon", "Joe's Pizza, buy one get one. Never redeemed."],
    ["Old Polaroid", "Peter and MJ on the Staten Island Ferry."],
    [
        "Wrestling Flyer",
        '"$3,000 to anyone who lasts 3 minutes." Peter lasted two.',
    ],
    ["Chemistry Notes", "Web fluid formula v0.4. Mostly crossed out."],
    ["Birthday Card", 'From May. "To my favourite nephew. Wear a jacket."'],
    ["Spare Lens", "Hand-ground, slightly the wrong curve."],
    ["Stubby Pencil", "Chewed. Used to sketch the first suit design."],
    ["Ferry Ticket", "Round trip. Only one half torn."],
    ["Mets Cap", "Signed by nobody famous. Worn anyway."],
    [
        "Graph Paper",
        "Swing trajectories plotted by hand. Parabolas everywhere.",
    ],
    ["Walkman", "The headphones still work. The batteries do not."],
    ["Physics Trophy", "Regional runner-up. Gwen won."],
    ["Friendship Bracelet", "Made at summer camp. Harry has the other one."],
    ["Rubber Band Ball", "Six months of lab downtime."],
    ["Dented Thermos", "Coffee, black, cold. Every stakeout ever."],
    ["Arcade Token", "For the Fun Zone machine that ate every other token."],
    ["First Mask", "Hand-stitched. The eyes never lined up."],
    ["Crossword Book", "Every clue answered in pen. Some wrongly."],
    ["Concert Stub", "Front row. MJ's idea. Worth it."],
    ["Microscope Slide", 'Labelled "spider #42 — DO NOT TOUCH".'],
    ["Bent Fork", "From before Peter learned his own strength."],
    ["Diner Menu", "Circled: pancakes. Always pancakes."],
    ["Tuxedo Bow Tie", "Worn once, to prom. Left early for a mugging."],
    ["Soldering Iron", "Burned a spider-shaped mark into the bench."],
    ["Comic Book", "Issue #1 of something. Bagged and boarded."],
    ["Snow Globe", "The Empire State Building, with a crack in the dome."],
    ["Notebook Doodle", 'A spider wearing sunglasses. Signed "P.P."'],
    ["Postcard", 'From May in Florida. "Wish you were here!"'],
    ["Retainer Case", "Empty. The retainer is a mystery for the ages."],
    ["Bike Lock Key", "The bike was stolen years ago. The key remains."],
    ["Pressed Flower", "From the park bench where Peter asked MJ out."],
    [
        "Handwritten Letter",
        "From Uncle Ben. Peter never opens it. He knows it by heart.",
    ],
];

export function districtAt(x: number, z: number) {
    for (const d of DISTRICTS) {
        const r = d.rect;
        if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) return d;
    }
    return x < 0 ? DISTRICTS[3] : DISTRICTS[4];
}

export function buildWorldData(world: any) {
    const fps = (world.footprints || []).map((f: any, i: number) => ({
        ...f,
        i,
        cx: (f.x0 + f.x1) / 2,
        cz: (f.z0 + f.z1) / 2,
        w: f.x1 - f.x0,
        d: f.z1 - f.z0,
    }));
    const byDistrict = new Map(DISTRICTS.map((d) => [d.id, [] as any[]]));
    for (const f of fps) byDistrict.get(districtAt(f.cx, f.cz).id)!.push(f);
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const down = V(0, -1, 0);
    const roofY = (x: number, z: number, from = 700) => {
        const h = world.raycast(V(x, from, z), down, from + 50);
        return h ? h.point.y : world.groundHeight(x, z);
    };
    const usedFp = new Set<number>();

    const towers = DISTRICTS.map((d) => {
        const [ax, az] = d.anchor;
        let best: any = null,
            bs = Infinity;
        for (const f of byDistrict.get(d.id)!) {
            if (
                f.h < 40 ||
                f.h > 150 ||
                f.w < 16 ||
                f.d < 16 ||
                f.kind === "hero"
            )
                continue;
            const s =
                Math.hypot(f.cx - ax, f.cz - az) + Math.abs(f.h - 85) * 1.5;
            if (s < bs) {
                bs = s;
                best = f;
            }
        }

        const flat = (f: any) => {
            const y = roofY(f.cx, f.cz);
            for (const [dx, dz] of [
                [3.5, 3.5],
                [-3.5, 3.5],
                [3.5, -3.5],
                [-3.5, -3.5],
            ] as [number, number][])
                if (Math.abs(roofY(f.cx + dx, f.cz + dz) - y) > 0.35)
                    return null;
            return y;
        };
        let pos: THREE.Vector3 | undefined;
        if (best && d.id !== "park") {
            const cands = byDistrict
                .get(d.id)!
                .filter(
                    (f) =>
                        !(
                            f.h < 40 ||
                            f.h > 150 ||
                            f.w < 16 ||
                            f.d < 16 ||
                            f.kind === "hero"
                        ),
                )
                .sort(
                    (a, b) =>
                        Math.hypot(a.cx - ax, a.cz - az) +
                        Math.abs(a.h - 85) * 1.5 -
                        (Math.hypot(b.cx - ax, b.cz - az) +
                            Math.abs(b.h - 85) * 1.5),
                );
            for (const f of cands.slice(0, 40)) {
                const y = flat(f);
                if (y != null) {
                    best = f;
                    pos = V(f.cx, y, f.cz);
                    break;
                }
            }
            if (!pos) pos = V(best.cx, roofY(best.cx, best.cz), best.cz);
            usedFp.add(best.i);
        } else pos = V(ax, world.groundHeight(ax, az), az);
        return {
            id: "tower_" + d.id,
            district: d.id,
            name: `${d.name} Research Tower`,
            pos: pos!,
        };
    });

    const stations = DISTRICTS.map((d) => {
        const [ax, az] = d.id === "park" ? [0, G.PARK.z1 + 90] : d.anchor;
        const cands: Array<[number, number, number]> = [];
        for (const x of avenues)
            for (const z of streets) {
                if (streetsAt(x, z).type !== "intersection") continue;
                if (districtAt(x, z).id !== d.id && d.id !== "park") continue;
                cands.push([Math.hypot(x - ax, z - az), x, z]);
            }
        cands.sort((a, b) => a[0] - b[0]);
        for (const [, x, z] of cands) {
            for (const [sx, sz] of [
                [1, 1],
                [-1, 1],
                [1, -1],
                [-1, -1],
            ] as [number, number][]) {
                const px =
                        x +
                        sx *
                            (((G as any).AV_HALF ?? G.AV_ROAD / 2) +
                                G.AV_WALK * 0.5),
                    pz = z + sz * (stHalfAt(z) + G.ST_WALK + 5.5);
                if (streetsAt(px, pz).type !== "sidewalk") continue;
                const y = world.groundHeight(px, pz);
                if (Math.abs(y - G.CURB_H) > 0.3) continue;
                return {
                    id: "station_" + d.id,
                    district: d.id,
                    name: `${stationName(x, z)} Station`,
                    pos: V(px, y, pz),
                    dirZ: -sz,
                    arrive: V(
                        px - sx * (G.AV_WALK * 0.5 - 0.6),
                        y,
                        pz + sz * 3,
                    ),
                    yaw: sx > 0 ? -Math.PI / 2 : Math.PI / 2,
                };
            }
        }
        return {
            id: "station_" + d.id,
            district: d.id,
            name: `${d.name} Station`,
            pos: V(ax, world.groundHeight(ax, az), az),
            dirZ: 1,
            arrive: V(ax, world.groundHeight(ax, az), az + 3),
            yaw: 0,
        };
    });

    const backpacks: any[] = [];
    let itemIdx = 0;
    for (const d of DISTRICTS) {
        const rnd = mulberry32(
            0xb4c4 + d.id.charCodeAt(0) * 131 + d.id.charCodeAt(1) * 7,
        );
        const [ax, az] = d.anchor;
        const placed: Array<{ x: number; z: number }> = [];
        const farOk = (x: number, z: number) =>
            placed.every((p) => Math.hypot(p.x - x, p.z - z) > 110);
        if (d.id === "park") {
            let tries = 0;
            while (placed.length < 5 && tries++ < 400) {
                const x = ax + (rnd() - 0.5) * 420,
                    z = az + (rnd() - 0.5) * 520;
                if (!inPark(x, z, -20) || !farOk(x, z)) continue;
                const y = world.groundHeight(x, z);
                const hit = world.raycast(V(x, y + 40, z), down, 60);
                if (hit && hit.point.y > y + 0.5) continue;
                placed.push({ x, z });
                backpacks.push(mkPack(d, V(x, y, z), V(0, 1, 0), "ground"));
            }
            continue;
        }
        const pool = byDistrict
            .get(d.id)!
            .filter(
                (f) =>
                    f.h > 14 &&
                    f.h < 140 &&
                    f.w > 10 &&
                    f.d > 10 &&
                    !usedFp.has(f.i) &&
                    Math.hypot(f.cx - ax, f.cz - az) < 650,
            );
        pool.sort(
            (a, b) =>
                Math.hypot(a.cx - ax, a.cz - az) -
                Math.hypot(b.cx - ax, b.cz - az),
        );
        let roofN = 0,
            wallN = 0,
            tries = 0;
        while ((roofN < 3 || wallN < 2) && tries++ < 600 && pool.length) {
            const f = pool[Math.floor(rnd() * Math.min(pool.length, 60))];
            if (!farOk(f.cx, f.cz)) continue;
            if (roofN < 3 && (wallN >= 2 || rnd() < 0.6)) {
                const cx = rnd() < 0.5 ? f.x0 + 2.4 : f.x1 - 2.4,
                    cz = rnd() < 0.5 ? f.z0 + 2.4 : f.z1 - 2.4;
                const hit = world.raycast(V(cx, f.h + 40, cz), down, 80);
                if (!hit || hit.normal.y < 0.8 || hit.point.y < f.h - 25)
                    continue;
                placed.push({ x: cx, z: cz });
                usedFp.add(f.i);
                roofN++;
                backpacks.push(
                    mkPack(d, hit.point.clone(), V(0, 1, 0), "roof"),
                );
            } else {
                const sides = [
                    [V(0, 0, 1), f.cx, f.z1],
                    [V(0, 0, -1), f.cx, f.z0],
                    [V(1, 0, 0), f.x1, f.cz],
                    [V(-1, 0, 0), f.x0, f.cz],
                ] as [THREE.Vector3, number, number][];
                const [n, sx, sz] = sides[Math.floor(rnd() * 4)];
                const y = 3.2 + rnd() * Math.min(5, f.h * 0.3);
                const o = V(sx, y, sz).addScaledVector(n, 4);
                if (streetsAt(o.x, o.z).type !== "sidewalk") continue;
                const hit = world.raycast(o, n.clone().negate(), 8);
                if (!hit || Math.abs(hit.normal.y) > 0.2) continue;
                placed.push({ x: sx, z: sz });
                usedFp.add(f.i);
                wallN++;
                backpacks.push(
                    mkPack(
                        d,
                        hit.point.clone().addScaledVector(hit.normal, 0.02),
                        hit.normal.clone().setY(0).normalize(),
                        "wall",
                    ),
                );
            }
        }
    }
    function mkPack(
        d: any,
        pos: THREE.Vector3,
        normal: THREE.Vector3,
        mount: string,
    ) {
        const [name, desc] = ITEMS[itemIdx % ITEMS.length];
        const id = `bp_${d.id}_${backpacks.filter((b) => b.district === d.id).length}`;
        itemIdx++;
        return { id, district: d.id, pos, normal, mount, item: name, desc };
    }

    const landmarks = DISTRICTS.map((d) => {
        const [ax, az] = d.anchor;
        if (d.id === "park")
            return {
                id: "lm_park",
                district: d.id,
                name: d.landmark,
                desc: d.lmDesc,
                target: V(0, 3, -760),
                radius: 60,
                fp: null as any,
            };
        let best: any = null;
        for (const f of byDistrict.get(d.id)!) {
            if (Math.hypot(f.cx - ax, f.cz - az) > 600 || f.w < 14 || f.d < 14)
                continue;
            if (!best || f.h > best.h) best = f;
        }
        if (!best)
            return {
                id: "lm_" + d.id,
                district: d.id,
                name: d.landmark,
                desc: d.lmDesc,
                target: V(ax, 60, az),
                radius: 40,
                fp: null as any,
            };
        return {
            id: "lm_" + d.id,
            district: d.id,
            name: d.landmark,
            desc: d.lmDesc,
            target: V(best.cx, best.h * 0.62, best.cz),
            top: best.h,
            radius: Math.max(best.w, best.d) * 0.6,
            fp: {
                x0: best.x0,
                x1: best.x1,
                z0: best.z0,
                z1: best.z1,
                h: best.h,
            },
        };
    });

    const secretPhotos = DISTRICTS.map((d, k) => {
        const rnd = mulberry32(0x5ec0 + k * 977);
        const [ax, az] = d.id === "park" ? [0, G.PARK.z1 + 9] : d.anchor;
        const cands: Array<[number, number, number]> = [];
        for (const x of avenues)
            for (const z of streets) {
                if (streetsAt(x, z).type !== "intersection") continue;
                if (d.id !== "park" && districtAt(x, z).id !== d.id) continue;
                const dd = Math.hypot(x - ax, z - az);
                if (dd < 90 || dd > 420) continue;
                cands.push([dd + rnd() * 160, x, z]);
            }
        cands.sort((a, b) => a[0] - b[0]);
        const [, x, z] = cands[0] || [0, ax, az];
        const sx = rnd() < 0.5 ? 1 : -1,
            sz = rnd() < 0.5 ? 1 : -1;
        const pos = V(
            x + sx * (((G as any).AV_HALF ?? G.AV_ROAD / 2) + 2.2),
            G.CURB_H + 1.7,
            z + sz * (stHalfAt(z) + 2.2),
        );

        const alongAv = rnd() < 0.6;
        const dir = alongAv
            ? V(-sx * 0.14, 0.07 + rnd() * 0.08, -sz)
            : V(-sx, 0.08 + rnd() * 0.08, -sz * 0.14);
        if (d.id === "park") dir.set(0, 0.12, -1);
        dir.normalize();
        return {
            id: "sp_" + d.id,
            district: d.id,
            name: `Secret Photo: ${d.name}`,
            hint: d.photoHint,
            pos,
            dir,
            fov: 58,
        };
    });

    return {
        districts: DISTRICTS,
        towers,
        stations,
        backpacks,
        landmarks,
        secretPhotos,
        districtAt,
    };
}

function stationName(x: number, z: number) {
    const av = Math.round(x / ((G as any).AV_SP ?? 200));
    const avNames: Record<string, string> = {
        "-6": "14th Av",
        "-5": "13th Av",
        "-4": "12th Av",
        "-3": "11th Av",
        "-2": "10th Av",
        "-1": "8th Av",
        0: "6th Av",
        1: "5th Av",
        2: "Lexington Av",
    };
    const st = Math.round(59 - ((z + 480) / 80) * 2.5);
    return `${st > 0 ? st : 1}${ordinal(st > 0 ? st : 1)} St – ${avNames[av] ?? "Park Av"}`;
}
function ordinal(n: number) {
    const s = ["th", "st", "nd", "rd"],
        v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}
