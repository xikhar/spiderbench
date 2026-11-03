// @ts-nocheck
// OWNER: systems engineer. Street-crime actors: thugs + civilians built from public/thug.glb (same skeleton as
// Spider-Man, so the clips of spiderman.glb play on it directly, see public/SPIDERMAN.md).
//   const A = createActors(ctx); await A.ready();  const a = A.spawn({ pos, yaw, variant: 'a'|'b'|'c', role: 'thug'|'victim' })
//   a.play('thugIdle') · a.face(vec3) · a.runTo(vec3, speed) · a.hit() · a.knockDown() · a.dispose()
// Actors are plain objects so the combat module can take them over (crime.enemies[i].actor / .object):
//   set actor.external = true and drive actor.root / actor.mixer yourself; this module then only ticks the mixer.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";
import { assetUrl } from "../../assets.ts";

const VARIANT_TEX = {
  b: assetUrl("tex/thug_basecolor_b.webp"),
  c: assetUrl("tex/thug_basecolor_c.webp"),
};
const LOOPS = new Set([
  "idle",
  "idleLook",
  "walk",
  "jog",
  "run",
  "sprint",
  "fightIdle",
  "jumpCrouch",
  "thugIdle",
  "thugWebbedStruggle",
  "thugGunAim",
]);
// thug.glb's own clips whose hips travel (stumbles, knockdown, get-up): the played copy is IN PLACE (hips X/Z pinned at
// the standing offset) and the travel is handed to the owner as root motion (a.rootDelta), so the body moves with the
// feet instead of sliding and never snaps back when the next clip cross-fades in
const ROOT_MOTION = new Set([
  "thugStumbleBack",
  "thugStumbleLeft",
  "thugStumbleRight",
  "thugKnockdown",
  "thugGetUp",
]);
const SPEED = { walk: 1.25, jog: 3.2, run: 5.8, sprint: 9.0 };

export function createActors(ctx) {
  let gltf = null,
    loading = null,
    clips = new Map();
  const rootTracks = new Map(); // clip -> hips position track (original, for root motion)
  const twins = new WeakMap(); // clip -> a clone (a second mixer action for back-to-back replays)
  const tex = {};
  const actors = new Set();
  let seq = 0;

  function clipList() {
    // Spider-Man's clips may animate helper bones the thug rig doesn't have (e.g. glutes): drop those tracks so
    // PropertyBinding doesn't warn, and keep one filtered copy per clip
    const src = ctx.player?.rig?.allClips || [];
    const names = new Set();
    gltf.scene.traverse((o) => names.add(o.name));
    for (const c of src) {
      const tracks = c.tracks.filter((t) =>
        names.has(THREE.PropertyBinding.parseTrackName(t.name).nodeName),
      );
      clips.set(
        c.name,
        tracks.length === c.tracks.length
          ? c
          : new THREE.AnimationClip(c.name, c.duration, tracks),
      );
    }
    // the thug's own clips (thugIdle, thugPunch1/2, thugKick, stumbles, knockdown, get-up, gun aim / fire, bruteSlam,
    // webbed struggle); SPIDERMAN.md "thug.glb clips"
    for (const c of gltf.animations) {
      if (!ROOT_MOTION.has(c.name)) {
        clips.set(c.name, c);
        continue;
      }
      const tracks = c.tracks.map((t) => {
        if (t.name !== "hips.position") return t;
        rootTracks.set(c.name, t);
        const v = t.values.slice();
        for (let i = 0; i < v.length; i += 3) {
          v[i] = 0;
          v[i + 2] = -0.02;
        }
        return new THREE.VectorKeyframeTrack(t.name, t.times.slice(), v);
      });
      clips.set(c.name, new THREE.AnimationClip(c.name, c.duration, tracks));
    }
  }
  // hips X/Z of a root-motion clip at time t (clip space: +Z forward, +X his left)
  const _rm = new Float32Array(3);
  function rootXZ(name, t, out) {
    const tr = rootTracks.get(name);
    if (!tr) return null;
    const T = tr.times,
      V = tr.values;
    t = Math.max(T[0], Math.min(T[T.length - 1], t));
    let i = 1;
    while (i < T.length - 1 && T[i] < t) i++;
    const k = (t - T[i - 1]) / Math.max(1e-6, T[i] - T[i - 1]);
    for (let c = 0; c < 3; c++)
      _rm[c] = V[(i - 1) * 3 + c] + (V[i * 3 + c] - V[(i - 1) * 3 + c]) * k;
    out.x = _rm[0];
    out.z = _rm[2];
    return out;
  }
  function load() {
    if (loading) return loading;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loading = loader
      .loadAsync(assetUrl("thug.glb"))
      .then((g) => {
        gltf = g;
        clipList();
        g.scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            o.frustumCulled = false;
          }
        });
        return true;
      })
      .catch((e) => {
        console.warn("[crimes] thug.glb unavailable", e);
        return false;
      });
    return loading;
  }
  const _rmp = { x: 0, z: 0 };
  function variantMap(v) {
    if (!VARIANT_TEX[v]) return null;
    if (!tex[v]) {
      tex[v] = new THREE.TextureLoader().load(VARIANT_TEX[v]);
      tex[v].colorSpace = THREE.SRGBColorSpace;
      tex[v].flipY = false;
      tex[v].anisotropy = 4;
    }
    return tex[v];
  }

  function spawn({ pos, yaw = 0, variant = "a", role = "thug" }) {
    if (!gltf) return null;
    const root = skeletonClone(gltf.scene);
    root.name = `crime-${role}-${++seq}`;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      const m = variantMap(variant);
      if (m) {
        o.material.map = m;
        o.material.needsUpdate = true;
      }
    });
    const g = new THREE.Group();
    g.add(root);
    g.position.copy(pos);
    g.rotation.y = yaw;
    ctx.scene.add(g);
    const mixer = new THREE.AnimationMixer(root);
    const a = {
      id: `${role}_${seq}`,
      role,
      root: g,
      object: g,
      mixer,
      alive: true,
      down: false,
      hp: 2,
      external: false,
      cur: null,
      curName: "",
      move: null,
      faceTarget: null,
      lastHit: 0,
      play(
        name,
        {
          fade = 0.25,
          timeScale = 1,
          once = !LOOPS.has(name),
          then = null,
        } = {},
      ) {
        let clip = clips.get(name);
        if (!clip) return null;
        if (a.curName === name && !once) {
          a.cur.timeScale = timeScale;
          return a.cur;
        }
        // replaying the clip that is playing (two stumbles in a row): three.js keeps ONE action per clip, so reset() would
        // snap it to frame 0 with no blend. Alternate with a twin copy of the clip so the new play cross-fades from the old.
        if (a.curName === name) {
          if (!twins.has(clip)) twins.set(clip, clip.clone());
          clip = a.cur.getClip() === clip ? twins.get(clip) : clip;
        }
        const act = mixer.clipAction(clip);
        act.reset();
        act.enabled = true;
        act.timeScale = timeScale;
        act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        act.clampWhenFinished = once;
        if (a.cur && a.cur !== act) {
          act.crossFadeFrom(a.cur, fade, false);
        }
        act.play();
        a.cur = act;
        a.curName = name;
        a.then = then;
        a.clipDur = clip.duration / Math.max(0.01, timeScale);
        a.clipT = 0;
        a.rm = rootTracks.has(name)
          ? { name, act, prev: rootXZ(name, 0, { x: 0, z: 0 }) }
          : null;
        return act;
      },
      face(p, snap = false) {
        a.faceTarget = p.clone ? p.clone() : p;
        if (snap) {
          g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z);
        }
      },
      runTo(
        p,
        speed = 5.8,
        clip = speed > 7
          ? "sprint"
          : speed > 4
            ? "run"
            : speed > 2
              ? "jog"
              : "walk",
      ) {
        a.move = { to: p.clone(), speed };
        a.play(clip, { timeScale: speed / (SPEED[clip] || speed) });
      },
      stop(clip = "thugIdle") {
        a.move = null;
        a.play(clip);
      },
      hit() {
        if (a.down) return false;
        a.hp--;
        a.lastHit = performance.now();
        if (a.hp <= 0) {
          a.knockDown();
          return true;
        }
        a.play("thugStumbleBack", { fade: 0.08, then: "thugIdle" });
        return false;
      },
      knockDown() {
        a.down = true;
        a.alive = false;
        a.move = null;
        a.play("thugKnockdown", { fade: 0.08 });
      },
      // root motion since the last call (world X/Z, m) of the playing root-motion clip; consumed by the caller
      rootDelta(out) {
        out.set(0, 0, 0);
        const r = a.rm;
        if (!r) return out;
        const p = rootXZ(r.name, r.act.time, _rmp);
        if (!p) return out;
        const dx = p.x - r.prev.x,
          dz = p.z - r.prev.z;
        r.prev.x = p.x;
        r.prev.z = p.z;
        const w = r.act.getEffectiveWeight(),
          yaw = g.rotation.y,
          sc = g.scale.x * (root.scale?.x || 1);
        const c = Math.cos(yaw),
          sn = Math.sin(yaw);
        out.x = (dx * c + dz * sn) * w * sc;
        out.z = (-dx * sn + dz * c) * w * sc; // rotate clip X/Z by the yaw
        return out;
      },
      rootSync() {
        if (a.rm) rootXZ(a.rm.name, a.rm.act.time, a.rm.prev);
      }, // after seeking the playing clip
      update(dt) {
        mixer.update(dt);
        if (a.cur && a.then) {
          a.clipT += dt;
          if (a.clipT >= a.clipDur - 0.12) {
            const n = a.then;
            a.then = null;
            a.play(n, { fade: 0.2 });
          }
        }
        if (a.external) return;
        if (a.move) {
          const d = new THREE.Vector3(
            a.move.to.x - g.position.x,
            0,
            a.move.to.z - g.position.z,
          );
          const L = d.length();
          if (L < 0.4) {
            a.move = null;
            a.onArrive?.();
          } else {
            d.divideScalar(L);
            const st = Math.min(L, a.move.speed * dt);
            g.position.x += d.x * st;
            g.position.z += d.z * st;
            g.rotation.y = dampAngle(
              g.rotation.y,
              Math.atan2(d.x, d.z),
              10,
              dt,
            );
          }
        } else if (a.faceTarget && !a.down) {
          g.rotation.y = dampAngle(
            g.rotation.y,
            Math.atan2(
              a.faceTarget.x - g.position.x,
              a.faceTarget.z - g.position.z,
            ),
            6,
            dt,
          );
        }
        g.position.y = ctx.world.groundHeight(
          g.position.x,
          g.position.z,
          g.position.y + 1,
        );
      },
      dispose() {
        actors.delete(a);
        ctx.scene.remove(g);
        mixer.stopAllAction();
        g.traverse((o) => {
          if (o.isMesh) o.material.dispose();
        });
      },
    };
    actors.add(a);
    a.play(role === "victim" ? "jumpCrouch" : "thugIdle", { fade: 0 });
    return a;
  }

  return {
    ready: load,
    spawn,
    get loaded() {
      return !!gltf;
    },
    actors,
    update(dt) {
      for (const a of actors) a.update(dt);
    },
  };
}

function dampAngle(a, b, rate, dt) {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * (1 - Math.exp(-rate * dt));
}
