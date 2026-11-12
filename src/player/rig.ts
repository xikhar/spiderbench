// @ts-nocheck
/**
 * Character rig loading, bone mapping, pose application, and IK helpers.
 *
 * @module player-rig
 * @version 1.0.0
 * @file src/player/rig.ts
 * @since 0.0.1
 * @description Loads the player character, resolves logical bones, manages poses/clips, and provides hand, finger, and IK utilities.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Animator } from "./anim/animator";
import { legacyAnim } from "./anim/legacy";
import { applySuitFabric } from "./suitfabric";

export interface Pose {
    root: number[];
    hipY: number;
    spine: number[];
    chest: number[];
    neck: number[];
    head: number[];
    uaL: THREE.Vector3;
    laL: THREE.Vector3;
    uaR: THREE.Vector3;
    laR: THREE.Vector3;
    ulL: THREE.Vector3;
    llL: THREE.Vector3;
    ulR: THREE.Vector3;
    llR: THREE.Vector3;
    handL: number[];
    handR: number[];
    footL: number[];
    footR: number[];
    curlL: number | null;
    curlR: number | null;
}

const LOGICAL = [
    "hips",
    "spine",
    "chest",
    "neck",
    "head",
    "upperArmL",
    "lowerArmL",
    "handL",
    "upperArmR",
    "lowerArmR",
    "handR",
    "upperLegL",
    "lowerLegL",
    "footL",
    "upperLegR",
    "lowerLegR",
    "footR",
] as const;
const CHILD: Record<string, string> = {
    upperArmL: "lowerArmL",
    lowerArmL: "handL",
    upperArmR: "lowerArmR",
    lowerArmR: "handR",
    upperLegL: "lowerLegL",
    lowerLegL: "footL",
    upperLegR: "lowerLegR",
    lowerLegR: "footR",
};

function side(n: string): string {
    if (/left/i.test(n)) return "L";
    if (/right/i.test(n)) return "R";
    const m =
        n.match(/[._\-\s]([lLrR])$/) ||
        n.match(/[a-z0-9]([LR])$/) ||
        n.match(/^([lLrR])[._\-\s]/);
    return m ? m[1].toUpperCase() : "";
}
function resolveBones(root: THREE.Object3D): Record<string, any> {
    const bones: Record<string, any> = {};
    const all: THREE.Object3D[] = [];
    root.traverse((o: any) => {
        if (o.isBone || o.userData.isRigBone) all.push(o);
    });
    const find = (re: RegExp, sd?: string, exclude?: RegExp) =>
        all.find((b) => {
            const n = b.name
                .replace(/^mixamorig:?/i, "")
                .replace(/^DEF[-_]/, "");
            return (
                re.test(n.toLowerCase()) &&
                (!sd || side(n) === sd) &&
                !(exclude && exclude.test(n.toLowerCase()))
            );
        });
    bones.hips = find(/^(hips|pelvis|root_?hips|hip)$/) || find(/hips|pelvis/);
    const spines = all.filter((b) =>
        /spine|chest|torso/.test(b.name.toLowerCase()),
    );
    bones.spine = find(/^spine(\.?0*1?)?$|^spine_01$|^spine$/) || spines[0];
    bones.chest =
        find(/upper_?chest|spine\.?0*3|spine_03|spine2/) ||
        find(/chest|spine\.?0*2|spine_02|spine1/) ||
        spines[spines.length - 1];
    if (bones.chest === bones.spine) bones.chest = spines[spines.length - 1];
    bones.neck = find(/neck/);
    bones.head = find(/^head$|head(?!.*end)(?!top)/, "", /end|top|nub/);
    for (const S of ["L", "R"]) {
        bones["upperArm" + S] =
            find(/upper_?arm|^arm|uparm/, S, /fore|lower|twist|clav/) ||
            find(/arm/, S, /fore|lower|twist|clav|shoulder/);
        bones["lowerArm" + S] = find(
            /fore_?arm|lower_?arm|lowarm|elbow/,
            S,
            /twist/,
        );
        bones["hand" + S] = find(
            /hand|wrist/,
            S,
            /index|thumb|middle|ring|pinky|finger|end/,
        );
        bones["upperLeg" + S] = find(
            /thigh|upper_?leg|up_?leg|upleg/,
            S,
            /twist/,
        );
        bones["lowerLeg" + S] = find(
            /shin|calf|lower_?leg|knee|^leg|lowleg/,
            S,
            /twist|up/,
        );
        bones["foot" + S] = find(/foot|ankle/, S, /toe|end|ball/);
    }
    return bones;
}

function buildPlaceholder() {
    const root = new THREE.Group();
    root.name = "SpideyPlaceholder";
    const red = new THREE.MeshStandardMaterial({
        color: 0xb3121f,
        roughness: 0.45,
        metalness: 0.05,
    });
    const blue = new THREE.MeshStandardMaterial({
        color: 0x14306e,
        roughness: 0.55,
        metalness: 0.05,
    });
    const white = new THREE.MeshStandardMaterial({
        color: 0xf2f2f2,
        roughness: 0.3,
    });
    const mk = (
        name: string,
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
    ) => {
        const b = new THREE.Object3D();
        b.name = name;
        (b.userData as any).isRigBone = true;
        b.position.set(x, y, z);
        parent.add(b);
        return b;
    };
    const hips = mk("hips", root, 0, 0.98, 0);
    const spine = mk("spine", hips, 0, 0.1, 0);
    const chest = mk("chest", spine, 0, 0.2, 0);
    const neck = mk("neck", chest, 0, 0.25, 0);
    const head = mk("head", neck, 0, 0.09, 0.01);
    mk("head_end", head, 0, 0.22, 0);
    const B: Record<string, THREE.Object3D> = {
        hips,
        spine,
        chest,
        neck,
        head,
    };
    for (const [S, sx] of [
        ["L", 1],
        ["R", -1],
    ] as const) {
        const ua = mk("upperArm" + S, chest, 0.19 * sx, 0.19, -0.01);
        const la = mk("lowerArm" + S, ua, 0.025 * sx, -0.29, 0);
        const h = mk("hand" + S, la, 0.01 * sx, -0.26, 0);
        mk("hand_end" + S, h, 0, -0.1, 0);
        const ul = mk("upperLeg" + S, hips, 0.095 * sx, -0.06, 0);
        const ll = mk("lowerLeg" + S, ul, 0, -0.43, 0);
        const f = mk("foot" + S, ll, 0, -0.42, -0.02);
        mk("toe" + S, f, 0, -0.06, 0.15);
        Object.assign(B, {
            ["upperArm" + S]: ua,
            ["lowerArm" + S]: la,
            ["hand" + S]: h,
            ["upperLeg" + S]: ul,
            ["lowerLeg" + S]: ll,
            ["foot" + S]: f,
        });
    }
    const seg = (
        bone: THREE.Object3D,
        child: THREE.Object3D,
        r0: number,
        r1: number,
        mat: THREE.Material,
    ) => {
        const len = child.position.length();
        const g = new THREE.CapsuleGeometry(
            (r0 + r1) / 2,
            Math.max(0.01, len - (r0 + r1) * 0.6),
            6,
            12,
        );
        const m = new THREE.Mesh(g, mat);
        m.castShadow = m.receiveShadow = true;
        const d = child.position.clone().normalize();
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        m.position.copy(child.position).multiplyScalar(0.5);
        bone.add(m);
        return m;
    };
    seg(hips, spine, 0.15, 0.14, blue).scale.set(1.15, 1, 0.8);
    seg(spine, chest, 0.14, 0.15, blue).scale.set(1.15, 1, 0.8);
    const ch = seg(chest, neck, 0.17, 0.17, red);
    ch.scale.set(1.2, 1, 0.75);
    seg(neck, head, 0.05, 0.05, red);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), red);
    hd.scale.set(0.9, 1.15, 1);
    hd.position.set(0, 0.1, 0);
    hd.castShadow = true;
    head.add(hd);
    for (const sx of [1, -1]) {
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 12, 8),
            white,
        );
        eye.scale.set(1, 1.4, 0.4);
        eye.position.set(0.04 * sx, 0.11, 0.085);
        eye.rotation.z = 0.5 * sx;
        head.add(eye);
    }
    const emb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.01), white);
    emb.position.set(0, 0.12, 0.13);
    chest.add(emb);
    for (const S of ["L", "R"]) {
        seg(B["upperArm" + S], B["lowerArm" + S], 0.055, 0.05, red);
        seg(B["lowerArm" + S], B["hand" + S], 0.045, 0.04, red);
        const hm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.035), red);
        hm.position.y = -0.05;
        hm.castShadow = true;
        B["hand" + S].add(hm);
        seg(B["upperLeg" + S], B["lowerLeg" + S], 0.08, 0.065, blue);
        seg(B["lowerLeg" + S], B["foot" + S], 0.06, 0.045, red);
        const fm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.24), red);
        fm.position.set(0, -0.03, 0.06);
        fm.castShadow = true;
        B["foot" + S].add(fm);
    }
    return { root, bones: B };
}

const _q = new THREE.Quaternion(),
    _q2 = new THREE.Quaternion(),
    _q3 = new THREE.Quaternion();
const _v = new THREE.Vector3(),
    _v2 = new THREE.Vector3(),
    _e = new THREE.Euler();
const eq = (a: number[], out = new THREE.Quaternion()) =>
    out.setFromEuler(_e.set(a[0], a[1], a[2], "YXZ"));
const V = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).normalize();
export const dirFromAngles = (pitchFwd: number, sideOut: number, down = true) =>
    new THREE.Vector3(
        Math.sin(sideOut) * Math.cos(pitchFwd),
        (down ? -1 : 1) * Math.cos(sideOut) * Math.cos(pitchFwd),
        Math.sin(pitchFwd),
    ).normalize();

export function makePose(p: any = {}): Pose {
    const z = () => [0, 0, 0];
    return {
        root: p.root || z(),
        hipY: p.hipY || 0,
        spine: p.spine || z(),
        chest: p.chest || z(),
        neck: p.neck || z(),
        head: p.head || z(),
        uaL: (p.uaL || V(0.25, -1, 0)).clone().normalize(),
        laL: (p.laL || V(0.2, -1, 0.1)).clone().normalize(),
        uaR: (p.uaR || V(-0.25, -1, 0)).clone().normalize(),
        laR: (p.laR || V(-0.2, -1, 0.1)).clone().normalize(),
        ulL: (p.ulL || V(0.08, -1, 0)).clone().normalize(),
        llL: (p.llL || V(0.06, -1, 0)).clone().normalize(),
        ulR: (p.ulR || V(-0.08, -1, 0)).clone().normalize(),
        llR: (p.llR || V(-0.06, -1, 0)).clone().normalize(),
        handL: p.handL || z(),
        handR: p.handR || z(),
        footL: p.footL || z(),
        footR: p.footR || z(),
        curlL: p.curlL ?? null,
        curlR: p.curlR ?? null,
    };
}
const EUL = [
    "root",
    "spine",
    "chest",
    "neck",
    "head",
    "handL",
    "handR",
    "footL",
    "footR",
] as const;
const DIRS = ["uaL", "laL", "uaR", "laR", "ulL", "llL", "ulR", "llR"] as const;
export function blendPose(
    a: Pose,
    b: Pose,
    t: number,
    out: Pose = makePose(),
): Pose {
    for (const k of EUL)
        for (let i = 0; i < 3; i++)
            (out as any)[k][i] =
                (a as any)[k][i] + ((b as any)[k][i] - (a as any)[k][i]) * t;
    out.hipY = a.hipY + (b.hipY - a.hipY) * t;
    for (const k of DIRS)
        (out as any)[k]
            .copy((a as any)[k])
            .lerp((b as any)[k], t)
            .normalize();
    for (const k of ["curlL", "curlR"] as const)
        out[k] =
            a[k] == null
                ? b[k]
                : b[k] == null
                  ? a[k]
                  : (a[k] as number) +
                    ((b[k] as number) - (a[k] as number)) * t;
    return out;
}
export function copyPose(src: Pose, out: Pose = makePose()): Pose {
    return blendPose(src, src, 0, out);
}

const TAU = Math.PI * 2;
const legDirs = (
    thigh: number,
    knee: number,
    sx: number,
): [THREE.Vector3, THREE.Vector3] => {
    const u = new THREE.Vector3(0.05 * sx, -Math.cos(thigh), Math.sin(thigh));
    const a = thigh - knee;
    const l = new THREE.Vector3(0.03 * sx, -Math.cos(a), Math.sin(a));
    return [u.normalize(), l.normalize()];
};
const armDirs = (
    swingFwd: number,
    outA: number,
    elbow: number,
    sx: number,
): [THREE.Vector3, THREE.Vector3] => {
    const u = new THREE.Vector3(
        Math.sin(outA) * sx,
        -Math.cos(outA) * Math.cos(swingFwd),
        Math.sin(swingFwd) * Math.cos(outA),
    );
    const a = swingFwd + elbow;
    const l = new THREE.Vector3(
        Math.sin(outA) * sx * 0.6,
        -Math.cos(a),
        Math.sin(a),
    );
    return [u.normalize(), l.normalize()];
};

export const POSES: Record<string, (...args: any[]) => Pose> = {
    idle(t = 0) {
        const br = Math.sin(t * TAU * 0.25) * 0.015;
        const [uaL, laL] = armDirs(0.0, 0.13, 0.25, 1),
            [uaR, laR] = armDirs(0.0, 0.13, 0.25, -1);
        return makePose({
            root: [0.0, 0, 0],
            chest: [-0.03 + br, 0, 0],
            head: [0.05, 0, 0],
            neck: [0, 0, 0],
            uaL,
            laL,
            uaR,
            laR,
            ulL: V(0.16, -1, 0.0),
            llL: V(0.12, -1, -0.02),
            ulR: V(-0.16, -1, 0.0),
            llR: V(-0.12, -1, -0.02),
            handL: [0, 0, -0.3],
            handR: [0, 0, 0.3],
            footL: [0, 0.15, 0],
            footR: [0, -0.15, 0],
        });
    },
    run(phase: number, speed = 1) {
        const s = Math.sin(phase * TAU),
            c = Math.cos(phase * TAU);
        const amp = 0.45 + 0.35 * speed;
        const kL =
            0.25 +
            (0.9 + 0.6 * speed) * Math.max(0, Math.sin(phase * TAU - 1.6));
        const kR =
            0.25 +
            (0.9 + 0.6 * speed) *
                Math.max(0, Math.sin(phase * TAU + Math.PI - 1.6));
        const [ulL, llL] = legDirs(amp * s, kL, 1),
            [ulR, llR] = legDirs(-amp * s, kR, -1);
        const [uaL, laL] = armDirs(-0.7 * amp * s, 0.18, 1.4, 1),
            [uaR, laR] = armDirs(0.7 * amp * s, 0.18, 1.4, -1);
        return makePose({
            root: [0.12 + 0.2 * speed, 0.12 * s, 0],
            hipY: -0.03 - 0.035 * Math.abs(c),
            spine: [0.05, -0.12 * s, 0],
            chest: [0.05 * speed, -0.12 * s, 0],
            head: [-0.1 - 0.15 * speed, 0.1 * s, 0],
            uaL,
            laL,
            uaR,
            laR,
            ulL,
            llL,
            ulR,
            llR,
            footL: [0.3 * s, 0, 0],
            footR: [-0.3 * s, 0, 0],
            handL: [0.3, 0, 0],
            handR: [0.3, 0, 0],
        });
    },
    jump() {
        const [ulL, llL] = legDirs(0.9, 1.7, 1),
            [ulR, llR] = legDirs(0.1, 0.5, -1);
        return makePose({
            root: [0.1, 0, 0],
            chest: [-0.1, 0, 0],
            head: [-0.2, 0, 0],
            ulL,
            llL,
            ulR,
            llR,
            uaL: V(0.6, 0.2, 0.3),
            laL: V(0.4, 0.8, 0.5),
            uaR: V(-0.6, 0.2, 0.3),
            laR: V(-0.4, 0.8, 0.5),
        });
    },
    fall(t = 0) {
        const w = Math.sin(t * 6) * 0.1;
        const [ulL, llL] = legDirs(0.35 + w, 1.2, 1),
            [ulR, llR] = legDirs(-0.1 - w, 0.7, -1);
        return makePose({
            root: [0.25, 0, 0],
            chest: [-0.15, 0, 0],
            head: [-0.35, 0, 0],
            ulL,
            llL,
            ulR,
            llR,
            uaL: V(0.85, -0.05 + w, 0.35),
            laL: V(0.45, 0.7, 0.55),
            uaR: V(-0.85, 0.1 - w, 0.3),
            laR: V(-0.4, 0.75, 0.5),
            handL: [0, 0, -0.4],
            handR: [0, 0, 0.4],
        });
    },
    land() {
        const [ulL, llL] = legDirs(1.3, 2.4, 1),
            [ulR, llR] = legDirs(0.2, 2.0, -1);
        return makePose({
            root: [0.55, 0, 0],
            hipY: -0.5,
            chest: [0.2, 0, 0],
            head: [-0.6, 0, 0],
            ulL,
            llL,
            ulR,
            llR,
            uaL: V(0.5, -0.6, 0.4),
            laL: V(0.3, -0.9, 0.2),
            uaR: V(-0.15, -0.7, 0.8),
            laR: V(-0.05, -1, 0.3),
            handR: [0.8, 0, 0],
        });
    },
    swing(phase = 0) {
        const tuck = THREE.MathUtils.clamp(0.5 + phase * 0.6, 0, 1);
        const [ulL, llL] = legDirs(0.2 + 1.2 * tuck, 0.5 + 1.4 * tuck, 1),
            [ulR, llR] = legDirs(-0.35 + 0.8 * tuck, 0.9 + 1.0 * tuck, -1);
        return makePose({
            root: [-0.1 * phase, 0, 0],
            chest: [0.05, 0, 0],
            head: [-0.2, 0, 0],
            ulL,
            llL,
            ulR,
            llR,
            uaR: V(-0.15, 1, 0.1),
            laR: V(-0.1, 1, 0.1),
            uaL: V(0.95, -0.1, 0.3),
            laL: V(0.7, 0.3, 0.6),
            handL: [0, 0, -0.5],
        });
    },
    swingRelease(t = 0) {
        const k = Math.sin(Math.min(1, t) * Math.PI);
        const [ulL, llL] = legDirs(0.5 + 0.9 * k, 1.4 + 0.8 * k, 1),
            [ulR, llR] = legDirs(0.2 + 0.9 * k, 1.1 + 1.0 * k, -1);
        return makePose({
            root: [0.3 * k, 0, 0],
            chest: [0.3 * k, 0.4 * k, 0],
            head: [-0.3, 0, 0],
            ulL,
            llL,
            ulR,
            llR,
            uaL: V(0.95, 0.4 - 0.6 * k, 0.2),
            laL: V(0.6, 0.5, 0.6),
            uaR: V(-0.95, 0.4 - 0.6 * k, 0.2),
            laR: V(-0.6, 0.5, 0.6),
        });
    },
    wallCrawl(phase = 0) {
        const s = Math.sin(phase * TAU);
        const [ulL, llL] = [
            V(0.6, -0.55 + 0.35 * s, 0.35),
            V(0.15, -1, 0.1),
        ] as [THREE.Vector3, THREE.Vector3];
        const [ulR, llR] = [
            V(-0.6, -0.55 - 0.35 * s, 0.35),
            V(-0.15, -1, 0.1),
        ] as [THREE.Vector3, THREE.Vector3];
        return makePose({
            root: [0, 0, 0],
            hipY: -0.1,
            chest: [0.1, 0, 0],
            head: [-0.4, 0, 0],
            ulL,
            llL,
            ulR,
            llR,
            uaL: V(0.55, 0.6 - 0.5 * s, 0.25),
            laL: V(0.25, 1, 0.25),
            uaR: V(-0.55, 0.6 + 0.5 * s, 0.25),
            laR: V(-0.25, 1, 0.25),
            handL: [-0.8, 0, 0],
            handR: [-0.8, 0, 0],
            footL: [-0.6, 0, 0],
            footR: [-0.6, 0, 0],
        });
    },
    climbRef() {
        return makePose({
            root: [0.05, 0.1, -0.05],
            hipY: 0,
            spine: [0, 0.05, 0.05],
            chest: [0.05, 0.1, 0.05],
            head: [-0.25, 0.15, 0],
            uaR: V(-0.12, 1, 0.12),
            laR: V(-0.05, 1, 0.2),
            uaL: V(0.75, 0.05, 0.3),
            laL: V(0.3, 0.9, 0.3),
            handR: [-0.9, 0, 0],
            handL: [-0.8, 0, 0],
            ulL: V(0.35, -0.05, 0.9),
            llL: V(0.15, -1, 0.25),
            ulR: V(-0.05, -1, 0.15),
            llR: V(0.02, -1, -0.1),
            footL: [-0.4, 0, 0],
            footR: [-0.9, 0, 0],
        });
    },
    wallPerch() {
        return makePose({
            root: [0.2, 0, 0.1],
            hipY: -0.25,
            spine: [0.1, 0.1, 0],
            chest: [0.15, 0.25, 0.05],
            head: [0.15, 0.35, 0.15],
            uaR: V(-0.9, 0.55, 0.15),
            laR: V(-0.5, 0.2, 0.75),
            handR: [0, 0, 0.5],
            uaL: V(0.55, -0.75, 0.2),
            laL: V(0.45, -0.7, 0.45),
            handL: [0.6, 0, -0.5],
            ulL: V(0.45, 0.05, 0.9),
            llL: V(0.25, -1, -0.15),
            ulR: V(-0.35, -0.75, 0.45),
            llR: V(-0.65, -0.8, -0.1),
            footL: [-0.3, 0, 0],
            footR: [0.4, -0.5, 0],
        });
    },
    swingBackRef() {
        return makePose({
            root: [0.25, 0.15, -0.1],
            spine: [0.1, 0.1, 0],
            chest: [0.05, 0.15, -0.05],
            head: [-0.25, -0.1, 0],
            uaR: V(-0.3, 1, 0.1),
            laR: V(-0.2, 1, 0.15),
            uaL: V(1, 0.45, -0.1),
            laL: V(0.8, 0.55, 0.3),
            handL: [0, 0, -0.6],
            ulL: V(0.12, -0.8, -0.55),
            llL: V(0.05, -0.1, -1),
            ulR: V(-0.12, -0.9, 0.35),
            llR: V(-0.05, -1, -0.25),
            footL: [0.6, 0, 0],
            footR: [0.3, 0, 0],
        });
    },
    webShootArm: V(-0.2, 0.4, 1),
};

export async function loadCharacter(_renderer?: any): Promise<any> {
    let gltf: any,
        source = "placeholder";
    const defaultUrl = new URL(
        "../assets/models/characters/spiderman.glb",
        import.meta.url,
    ).href;
    const url = new URLSearchParams(location.search).get("char") || defaultUrl;
    try {
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder as any);
        gltf = await loader.loadAsync(url);
        source = "glb";
    } catch (e) {
        console.warn(
            "[player] spiderman.glb failed to load, using placeholder",
            e,
        );
        gltf = null;
    }

    let root: THREE.Object3D,
        bones: Record<string, any>,
        clips: THREE.AnimationClip[] = [];
    if (gltf) {
        root = gltf.scene;
        clips = gltf.animations || [];
        root.traverse((o: any) => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
                o.frustumCulled = false;
            }
        });
        applySuitFabric(root);
        bones = resolveBones(root);
        const missing = LOGICAL.filter((k) => !bones[k]);
        if (missing.length)
            console.warn("[player] GLB missing bones:", missing.join(","));
        if (!bones.hips || !bones.upperArmR || !bones.upperLegL) {
            console.warn(
                "[player] GLB rig unusable for procedural layers; using placeholder",
            );
            gltf = null;
        }
    }
    if (gltf)
        console.info(
            "[player] character",
            url,
            "bones:",
            Object.entries(bones!)
                .map(([k, b]) => k + "=" + (b ? (b as any).name : "-"))
                .join(" "),
            "clips:",
            clips.map((c) => c.name).join(","),
        );
    if (!gltf) {
        const p = buildPlaceholder();
        root = p.root;
        bones = p.bones;
        clips = [];
        source = "placeholder";
    }

    const wrap = new THREE.Group();
    wrap.name = "SpideyModel";
    wrap.add(root!);
    root!.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root!, true);
    const h = box.max.y - box.min.y;
    if (source === "glb" && (h < 1.2 || h > 2.4) && h > 0) {
        root!.scale.multiplyScalar(1.78 / h);
        root!.updateMatrixWorld(true);
        box.setFromObject(root!, true);
    }
    root!.position.y -= box.min.y;
    root!.updateMatrixWorld(true);
    const rig = new Rig(wrap, root!, bones!, clips, source);
    const poll = () => {
        if ((window as any).__ctx) rig._hookSystems();
        else requestAnimationFrame(poll);
    };
    if (
        typeof window !== "undefined" &&
        !new URLSearchParams(location.search).has("shot")
    )
        requestAnimationFrame(poll);
    return rig;
}

function clipIndex(clips: THREE.AnimationClip[]) {
    const want: Record<string, RegExp> = {
        idle: /^idle|stand/i,
        run: /^run|sprint|jog/i,
        walk: /walk/i,
        jump: /^jump/i,
        fall: /fall|air(?!trick)|airborne/i,
        land: /land/i,
        swing: /^swing(?!.*rel)/i,
        swingRelease: /release|trick|flip/i,
        wallCrawl: /crawl|climb/i,
        wallPerch: /perch|cling/i,
        webShoot: /shoot|web(?!.*swing)|zip|thwip/i,
    };
    const idx: Record<string, THREE.AnimationClip | null> = {};
    for (const [k, re] of Object.entries(want)) {
        idx[k] =
            clips.find((c) => c.name.toLowerCase() === k.toLowerCase()) ||
            clips.find((c) => re.test(c.name)) ||
            null;
    }
    return idx;
}

export class Rig {
    object: THREE.Group;
    model: THREE.Object3D;
    bones: Record<string, any>;
    source: string;
    clips: Record<string, THREE.AnimationClip | null>;
    allClips: THREE.AnimationClip[];
    mixer: THREE.AnimationMixer | null;
    actions: Record<string, THREE.AnimationAction>;
    current: THREE.AnimationAction | null;
    bind: Record<string, any>;
    fingers: { L: Record<string, any[]>; R: Record<string, any[]> };
    fingerRest: Map<any, THREE.Quaternion>;
    pose: Pose;
    poseWeight: number;
    fade: number;
    animator: any;
    animSource: any;
    _shim: any;
    _animActive: boolean;
    _inAnim: boolean;
    _hooked: boolean;
    _ranThisFrame: boolean;
    _everRan: boolean;

    constructor(
        object: THREE.Group,
        model: THREE.Object3D,
        bones: Record<string, any>,
        clips: THREE.AnimationClip[],
        source: string,
    ) {
        this.object = object;
        this.model = model;
        this.bones = bones;
        this.source = source;
        this.clips = clipIndex(clips);
        this.allClips = clips;
        this.mixer = clips.length ? new THREE.AnimationMixer(model) : null;
        this.actions = {};
        this.current = null;
        this._animActive = false;
        this._inAnim = false;
        this._hooked = false;
        this._ranThisFrame = false;
        this._everRan = false;
        object.updateMatrixWorld(true);
        const invRoot = new THREE.Quaternion();
        object.getWorldQuaternion(invRoot).invert();
        this.bind = {};
        for (const k of LOGICAL) {
            const b = bones[k];
            if (!b) continue;
            const A = b
                .getWorldQuaternion(new THREE.Quaternion())
                .premultiply(invRoot);
            const d: any = {
                A,
                restLocal: b.quaternion.clone(),
                restPos: b.position.clone(),
                dir: null,
            };
            const ck = CHILD[k];
            let child = ck && bones[ck];
            if (!child && /hand/.test(k))
                child =
                    b.children.find((c: any) => /middle/i.test(c.name)) || null;
            if (!child && /hand|foot|head/.test(k))
                child = b.children.find(
                    (c: any) => c.isBone || c.userData.isRigBone,
                );
            if (child) {
                const p0 = b.getWorldPosition(new THREE.Vector3()),
                    p1 = child.getWorldPosition(new THREE.Vector3());
                d.dir = p1
                    .sub(p0)
                    .applyQuaternion(
                        object
                            .getWorldQuaternion(new THREE.Quaternion())
                            .invert(),
                    )
                    .normalize();
            }
            this.bind[k] = d;
        }
        this.fingers = { L: {}, R: {} };
        this.fingerRest = new Map();
        model.traverse((o: any) => {
            if (!(o.isBone || o.userData.isRigBone)) return;
            const m = o.name
                .replace(/^mixamorig:?/i, "")
                .match(
                    /^(thumb|index|middle|ring|pinky)[._]?0*(\d)[._]?([LR])$/i,
                );
            if (!m) return;
            const S = m[3].toUpperCase() as "L" | "R",
                f = m[1].toLowerCase(),
                i = +m[2] - 1;
            (this.fingers[S][f] ||= [])[i] = o;
            this.fingerRest.set(o, o.quaternion.clone());
        });
        this.pose = makePose();
        this.poseWeight = 0;
        this.fade = 0.2;
    }
    hasClip(name: string) {
        return !!this.clips[name];
    }
    play(
        name: string,
        {
            fade = 0.2,
            loop = true,
            timeScale = 1,
            restart = false,
            mask = null,
        }: any = {},
    ) {
        if (this.owned())
            return this.animator.playOneShot(name, {
                fade,
                timeScale,
                loop,
                mask,
                restart,
            });
        if (!this.mixer || !this.clips[name]) return false;
        let a = this.actions[name];
        if (!a) {
            a = this.actions[name] = this.mixer.clipAction(this.clips[name]!);
        }
        a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        a.clampWhenFinished = !loop;
        a.timeScale = timeScale;
        if (this.current === a && !restart) return true;
        a.reset();
        a.enabled = true;
        a.setEffectiveWeight(1);
        if (this.current && this.current !== a)
            a.crossFadeFrom(this.current, fade, false);
        else a.fadeIn(fade);
        a.play();
        this.current = a;
        return true;
    }
    drive(name: string, t01: number, fade = 0.2) {
        if (this.owned()) return true;
        if (!this.play(name, { fade, timeScale: 0 })) return false;
        const a = this.actions[name];
        a.timeScale = 0;
        a.time = (((t01 % 1) + 1) % 1) * a.getClip().duration;
        return true;
    }
    setClipTime(name: string, t: number) {
        if (this.owned()) return true;
        if (!this.play(name, { fade: 0 })) return false;
        for (const a of Object.values(this.actions))
            if (a !== this.current) {
                a.stop();
            }
        this.current!.time = t * this.current!.getClip().duration;
        this.current!.setEffectiveWeight(1);
        this.mixer!.update(0);
        return true;
    }
    setAnimSource(fn: any) {
        this.animSource = fn;
    }
    _source() {
        if (this.animSource) return this.animSource();
        const ctx = (window as any).__ctx,
            p = ctx?.player;
        if (!p) return null;
        let o: any = this.object;
        while (o && o !== p.object) o = o.parent;
        if (!o) return null;
        if (p.state?.frozen || p.frozen) return null;
        const anim = p.anim || legacyAnim(p, this._shim || (this._shim = {}));
        if (!anim) return null;
        return {
            anim,
            center: p.position || p.state?.pos,
            world: ctx.world,
            camera: ctx.camera,
            H: p.H ?? p.capsule?.H,
        };
    }
    owned() {
        const a = this.animator;
        if (!a || !a.enabled || this._inAnim) return false;
        const p = (window as any).__ctx?.player;
        if (p && (p.state?.frozen || p.frozen)) {
            if (this._animActive) this._releaseAnim();
            return false;
        }
        return !!this._animActive;
    }
    _releaseAnim() {
        this._animActive = false;
        this.object.position.set(0, 0, 0);
        this.object.quaternion.identity();
        this.object.updateMatrixWorld(true);
    }
    update(dt: number) {
        if (
            this.animator !== false &&
            !this.animator &&
            (this.allClips.length || this.source === "placeholder")
        ) {
            try {
                this.animator = new Animator(this);
                this.animator.poses = POSES;
            } catch (e) {
                console.warn("[anim] animator init failed, using legacy", e);
                this.animator = false;
            }
        }
        const src =
            this.animator && this.animator.enabled ? this._source() : null;
        if (src && src.anim && src.center) {
            this._hookSystems();
            this._inAnim = true;
            try {
                this.animator.update(dt, src);
                this._animActive = true;
            } catch (e) {
                console.error("[anim] update failed", e);
                this.animator.enabled = false;
                this._animActive = false;
            }
            this._inAnim = false;
            this._ranThisFrame = true;
            this._everRan = true;
            return;
        }
        if (this._animActive) this._releaseAnim();
        if (this.mixer) this.mixer.update(dt);
    }
    animate(anim: any, dt: number, player: any) {
        if (this.animator !== false && !this.animator) {
            try {
                this.animator = new Animator(this);
                this.animator.poses = POSES;
            } catch (e) {
                console.warn("[anim] animator init failed", e);
                this.animator = false;
            }
        }
        if (!this.animator || !this.animator.enabled || !anim) {
            if (this._animActive) this._releaseAnim();
            if (this.mixer) this.mixer.update(dt);
            return false;
        }
        const ctx = (window as any).__ctx;
        this._hookSystems();
        this._inAnim = true;
        try {
            const t0 = performance.now();
            this.animator.update(dt, {
                anim,
                center: player?.position || anim.rootPos,
                world: ctx?.world,
                camera: ctx?.camera,
                H: player?.H ?? 0.95,
            });
            const ms = performance.now() - t0;
            this.animator.debug.ms =
                this.animator.debug.ms == null
                    ? ms
                    : this.animator.debug.ms * 0.95 + ms * 0.05;
            this._animActive = true;
        } catch (e) {
            console.error("[anim] update failed", e);
            this.animator.enabled = false;
            this._animActive = false;
        }
        this._inAnim = false;
        this._ranThisFrame = true;
        this._everRan = true;
        return true;
    }
    _hookSystems() {
        if (this._hooked) return;
        const ctx = (window as any).__ctx;
        if (!ctx) return;
        this._hooked = true;
        ctx.systems = ctx.systems || [];
        const prev = (window as any).__ptState;
        let scr: any = null;
        if (new URLSearchParams(location.search).has("playtest")) {
            const hp = new THREE.Vector3();
            let mesh: any = null;
            this.object.traverse((o: any) => {
                if (!mesh && o.isSkinnedMesh) mesh = o;
            });
            if (mesh)
                mesh.onBeforeRender = (r: any, _sc: any, cam: any) => {
                    if (cam !== ctx.camera) return;
                    this.bones.hips.getWorldPosition(hp).project(cam);
                    const sz = r.getSize(new THREE.Vector2());
                    scr = [
                        +(((hp.x + 1) / 2) * sz.x).toFixed(0),
                        +(((1 - hp.y) / 2) * sz.y).toFixed(0),
                        +cam.position
                            .distanceTo(
                                this.bones.hips.getWorldPosition(
                                    new THREE.Vector3(),
                                ),
                            )
                            .toFixed(1),
                    ];
                };
        }
        (window as any).__ptState = () => {
            const a = this.animator;
            const base = prev ? prev() : {};
            return a
                ? {
                      ...base,
                      aNode: a.debug.node,
                      aClip: a.debug.clip,
                      aLayers: a.debug.layers,
                      aMs: +(a.debug.ms || 0).toFixed(3),
                      scr,
                  }
                : base;
        };
        ctx.systems.push({
            name: "anim-fallback",
            update: (dt: number) => {
                if (!this._ranThisFrame && this.animator && this._source())
                    this.update(dt);
                this._ranThisFrame = false;
            },
        });
    }
    get animState() {
        const a = this.animator;
        return a ? a.debug : null;
    }
    applyPose(pose: Pose, w = 1) {
        if (this.owned()) return;
        if (w <= 0.001) return;
        const B = this.bones,
            K = this.bind,
            obj = this.object;
        obj.updateMatrixWorld(true);
        const rootQ = obj.getWorldQuaternion(new THREE.Quaternion());
        const desired: Record<string, THREE.Quaternion> = {};
        const Qroot = eq(pose.root);
        const set = (k: string, charQ: THREE.Quaternion) => {
            if (K[k]) desired[k] = charQ.clone().multiply(K[k].A);
        };
        set("hips", Qroot);
        const qs = Qroot.clone().multiply(eq(pose.spine));
        set("spine", qs);
        const qc = qs.clone().multiply(eq(pose.chest));
        set("chest", qc);
        const qn = qc.clone().multiply(eq(pose.neck));
        set("neck", qn);
        const qh = qn.clone().multiply(eq(pose.head));
        set("head", qh);
        const limb = (
            up: string,
            lo: string,
            end: string,
            F: THREE.Quaternion,
            dU: THREE.Vector3,
            dL: THREE.Vector3,
            endE: number[],
            endInParent: boolean,
        ) => {
            if (!K[up] || !K[up].dir) return;
            const vU = _v.copy(dU).applyQuaternion(F);
            const Uu = new THREE.Quaternion()
                .setFromUnitVectors(_v2.copy(K[up].dir).applyQuaternion(F), vU)
                .multiply(F);
            set(up, Uu);
            let Ul = Uu;
            if (K[lo] && K[lo].dir) {
                const vL = _v.copy(dL).applyQuaternion(F);
                Ul = new THREE.Quaternion()
                    .setFromUnitVectors(
                        _v2.copy(K[lo].dir).applyQuaternion(Uu),
                        vL,
                    )
                    .multiply(Uu);
                set(lo, Ul);
            }
            if (K[end])
                set(
                    end,
                    (endInParent ? F.clone() : Ul.clone()).multiply(eq(endE)),
                );
        };
        limb(
            "upperArmL",
            "lowerArmL",
            "handL",
            qc,
            pose.uaL,
            pose.laL,
            pose.handL,
            false,
        );
        limb(
            "upperArmR",
            "lowerArmR",
            "handR",
            qc,
            pose.uaR,
            pose.laR,
            pose.handR,
            false,
        );
        limb(
            "upperLegL",
            "lowerLegL",
            "footL",
            Qroot,
            pose.ulL,
            pose.llL,
            pose.footL,
            true,
        );
        limb(
            "upperLegR",
            "lowerLegR",
            "footR",
            Qroot,
            pose.ulR,
            pose.llR,
            pose.footR,
            true,
        );
        if (B.hips) {
            const target = K.hips.restPos.clone();
            const parentScale = B.hips.parent
                ? B.hips.parent.getWorldScale(new THREE.Vector3()).y
                : 1;
            target.y += pose.hipY / Math.max(1e-4, parentScale);
            B.hips.position.lerp(target, w);
        }
        for (const k of LOGICAL) {
            const b = B[k];
            if (!b || !desired[k]) continue;
            const pw = b.parent.getWorldQuaternion(_q2);
            const local = _q3
                .copy(pw)
                .invert()
                .multiply(_q.copy(rootQ).multiply(desired[k]));
            b.quaternion.slerp(local, w);
            b.updateMatrixWorld(true);
        }
        if (pose.curlL != null) this.curlFingers("L", pose.curlL, w);
        if (pose.curlR != null) this.curlFingers("R", pose.curlR, w);
    }
    handFrame(
        S: "L" | "R",
        out: any = {
            wrist: new THREE.Vector3(),
            finger: new THREE.Vector3(),
            across: new THREE.Vector3(),
            palm: new THREE.Vector3(),
            len: 0.09,
        },
    ) {
        const h = this.bones["hand" + S];
        if (!h) return null;
        h.updateWorldMatrix(true, true);
        h.getWorldPosition(out.wrist);
        const F = this.fingers[S],
            mid = F.middle?.[0],
            idx = F.index?.[0],
            pin = F.pinky?.[0] || F.ring?.[0];
        if (mid) {
            mid.getWorldPosition(out.finger).sub(out.wrist);
            out.len = out.finger.length();
            out.finger.normalize();
        } else {
            const la = this.bones["lowerArm" + S];
            out.finger.copy(out.wrist).sub(la.getWorldPosition(_v)).normalize();
            out.len = 0.09;
        }
        if (idx && pin)
            out.across
                .copy(pin.getWorldPosition(_v))
                .sub(idx.getWorldPosition(_v2));
        else out.across.set(1, 0, 0).applyQuaternion(h.getWorldQuaternion(_q));
        out.across
            .addScaledVector(out.finger, -out.across.dot(out.finger))
            .normalize();
        out.palm
            .crossVectors(out.across, out.finger)
            .multiplyScalar(S === "L" ? 1 : -1)
            .normalize();
        return out;
    }
    palmWorld(S: "L" | "R" = "R", out = new THREE.Vector3()) {
        const f = this.handFrame(S);
        if (!f) return this.handWorld(S, out);
        return out
            .copy(f.wrist)
            .addScaledVector(f.finger, f.len * 0.55)
            .addScaledVector(f.palm, 0.02);
    }
    curlFingers(S: "L" | "R", curl: number, w = 1, thumb = 0.6) {
        if (this.owned()) return;
        const F = this.fingers[S];
        if (!F.index) return;
        const fr = this.handFrame(S);
        if (!fr) return;
        const sgn = S === "L" ? 1 : -1;
        const axis = fr.across.clone(),
            segA = [1.25, 1.55, 1.05];
        for (const [name, chain] of Object.entries(F)) {
            if (name === "thumb") continue;
            const spread =
                name === "index" ? 0.92 : name === "pinky" ? 1.08 : 1;
            chain.forEach((b: any, i: number) => {
                if (!b) return;
                b.quaternion.slerp(this.fingerRest.get(b), w);
                b.updateMatrixWorld(true);
                this._rotWorld(b, axis, sgn * curl * segA[i] * spread * w);
            });
        }
        (F.thumb || []).forEach((b: any, i: number) => {
            if (!b) return;
            b.quaternion.slerp(this.fingerRest.get(b), w);
            b.updateMatrixWorld(true);
            if (i > 0)
                this._rotWorld(b, fr.finger, -sgn * curl * thumb * 0.9 * w);
        });
    }
    _rotWorld(b: any, axis: THREE.Vector3, angle: number) {
        const wq = b.getWorldQuaternion(new THREE.Quaternion());
        const target = new THREE.Quaternion()
            .setFromAxisAngle(axis, angle)
            .multiply(wq);
        b.quaternion.copy(
            b.parent
                .getWorldQuaternion(new THREE.Quaternion())
                .invert()
                .multiply(target),
        );
        b.updateMatrixWorld(true);
    }
    orientHand(
        S: "L" | "R",
        finger: THREE.Vector3,
        palm: THREE.Vector3,
        w = 1,
    ) {
        if (this.owned()) return;
        const h = this.bones["hand" + S],
            fr = this.handFrame(S);
        if (!h || !fr) return;
        const basis = (f: THREE.Vector3, p: THREE.Vector3) => {
            const z = p.clone().addScaledVector(f, -p.dot(f)).normalize();
            const y = f.clone().normalize();
            const x = new THREE.Vector3().crossVectors(y, z);
            return new THREE.Quaternion().setFromRotationMatrix(
                new THREE.Matrix4().makeBasis(x, y, z),
            );
        };
        const cur = basis(fr.finger, fr.palm),
            want = basis(finger, palm);
        const delta = want.multiply(cur.invert());
        const wq = h.getWorldQuaternion(new THREE.Quaternion());
        const target = delta.multiply(wq);
        const local = h.parent
            .getWorldQuaternion(new THREE.Quaternion())
            .invert()
            .multiply(target);
        h.quaternion.slerp(local, w);
        h.updateMatrixWorld(true);
    }
    solveIK(
        limb: string,
        target: THREE.Vector3,
        { pole = null, w = 1 }: any = {},
    ) {
        if (this.owned()) return 0;
        const S = limb.slice(-1) as "L" | "R",
            arm = limb.startsWith("arm");
        const u = (arm ? "upperArm" : "upperLeg") + S,
            l = (arm ? "lowerArm" : "lowerLeg") + S,
            e = (arm ? "hand" : "foot") + S;
        const B = this.bones;
        if (!B[u] || !B[l] || !B[e] || w <= 0) return Infinity;
        B[u].updateWorldMatrix(true, true);
        const a = B[u].getWorldPosition(new THREE.Vector3()),
            b = B[l].getWorldPosition(new THREE.Vector3()),
            c = B[e].getWorldPosition(new THREE.Vector3());
        const l1 = a.distanceTo(b),
            l2 = b.distanceTo(c);
        const toT = target.clone().sub(a);
        const dRaw = toT.length();
        const d = THREE.MathUtils.clamp(
            dRaw,
            Math.abs(l1 - l2) + 1e-3,
            (l1 + l2) * 0.9995,
        );
        const dir = toT.normalize();
        const pv = (pole ? (pole as THREE.Vector3).clone() : b.clone()).sub(a);
        pv.addScaledVector(dir, -pv.dot(dir));
        if (pv.lengthSq() < 1e-8) {
            pv.copy(c).sub(a).cross(dir);
            if (pv.lengthSq() < 1e-8) pv.set(0, 0, 1);
            pv.cross(dir);
        }
        pv.normalize();
        const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
            hgt = Math.sqrt(Math.max(0, l1 * l1 - x * x));
        const mid = a.clone().addScaledVector(dir, x).addScaledVector(pv, hgt);
        const endP = a.clone().addScaledVector(dir, d);
        this.aimBone(u, mid.sub(a), w);
        const b2 = B[l].getWorldPosition(new THREE.Vector3());
        this.aimBone(l, endP.sub(b2), w);
        return Math.max(0, dRaw - d);
    }
    plant(
        limb: string,
        P: THREE.Vector3,
        n: THREE.Vector3,
        {
            gap = null,
            at = null,
            pole = null,
            w = 1,
            fingerDir = null,
            curl = null,
            toeIn = 0.35,
        }: any = {},
    ) {
        const S = limb.slice(-1) as "L" | "R",
            arm = limb.startsWith("arm");
        const e = this.bones[(arm ? "hand" : "foot") + S];
        if (!e) return;
        const cur = at
            ? (at as THREE.Vector3).clone()
            : e.getWorldPosition(new THREE.Vector3());
        const g = gap ?? (arm ? 0.035 : 0.09);
        const tgt = cur.addScaledVector(n, g - cur.clone().sub(P).dot(n));
        if (arm && fingerDir) {
            const f = (fingerDir as THREE.Vector3)
                .clone()
                .addScaledVector(n, -fingerDir.dot(n))
                .normalize();
            const fr = this.handFrame(S);
            if (fr) tgt.addScaledVector(f, -fr.len * 0.55);
        }
        this.solveIK(limb, tgt, { pole, w });
        if (arm && fingerDir) {
            const f = (fingerDir as THREE.Vector3)
                .clone()
                .addScaledVector(n, -fingerDir.dot(n))
                .normalize();
            this.orientHand(
                S,
                f.addScaledVector(n, -0.12).normalize(),
                n.clone().negate(),
                w,
            );
        }
        if (arm && curl != null) this.curlFingers(S, curl, w);
        if (!arm && fingerDir) {
            const d = (fingerDir as THREE.Vector3)
                .clone()
                .addScaledVector(n, -fingerDir.dot(n))
                .normalize()
                .addScaledVector(n, -toeIn)
                .normalize();
            this.aimBone("foot" + S, d, w);
        }
    }
    aimBone(k: string, worldDir: THREE.Vector3, w = 1) {
        if (this.owned()) return;
        const b = this.bones[k],
            K = this.bind[k];
        if (!b || !K || !K.dir || w <= 0) return;
        const child =
            this.bones[CHILD[k]] ||
            b.children.find((c: any) => c.isBone || c.userData.isRigBone);
        if (!child) return;
        b.updateMatrixWorld(true);
        const p0 = b.getWorldPosition(new THREE.Vector3()),
            p1 = child.getWorldPosition(new THREE.Vector3());
        const cur = p1.sub(p0).normalize();
        const d = new THREE.Quaternion().setFromUnitVectors(
            cur,
            worldDir.clone().normalize(),
        );
        const wq = b.getWorldQuaternion(new THREE.Quaternion());
        const target = d.multiply(wq);
        const pw = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        b.quaternion.slerp(pw.multiply(target), w);
        b.updateMatrixWorld(true);
    }
    rotateBoneWorld(k: string, axis: THREE.Vector3, angle: number) {
        if (this.owned()) return;
        const b = this.bones[k];
        if (!b || !angle) return;
        const wq = b.getWorldQuaternion(new THREE.Quaternion());
        const target = new THREE.Quaternion()
            .setFromAxisAngle(axis, angle)
            .multiply(wq);
        b.quaternion.copy(
            b.parent
                .getWorldQuaternion(new THREE.Quaternion())
                .invert()
                .multiply(target),
        );
        b.updateMatrixWorld(true);
    }
    handWorld(side: "L" | "R" = "R", out = new THREE.Vector3()) {
        if (this.fingers[side]?.middle) return this.palmWorld(side, out);
        const h = this.bones["hand" + side] || this.bones["lowerArm" + side];
        if (!h)
            return this.object
                .getWorldPosition(out)
                .add(new THREE.Vector3(0, 1.5, 0));
        h.updateWorldMatrix(true, false);
        h.getWorldPosition(out);
        const tip = h.children.find(
            (c: any) => c.isBone || c.userData.isRigBone,
        );
        if (tip) {
            const t = tip.getWorldPosition(new THREE.Vector3());
            out.lerp(t, 0.6);
        }
        return out;
    }
}
