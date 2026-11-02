// OWNER: systems engineer. Suits screen: suit cards (left) + live 3D preview of Spider-Man (the game camera
// orbits the frozen player on the right half; drag to rotate, shallow depth of field), equip applies instantly.
import * as THREE from "three";
import { SUITS } from "../../game/systems/suits.js";

function suitArt(s) {
  const [a, b, c] = s.swatch;
  return `<svg viewBox="0 0 100 120"><defs><linearGradient id="g${s.id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(255,255,255,.18)"/><stop offset="1" stop-color="rgba(0,0,0,.2)"/></linearGradient></defs>
    <path d="M50 6 C33 6 28 20 29 34 C30 46 36 54 42 58 L40 66 C24 68 12 76 8 96 L6 120 L94 120 L92 96 C88 76 76 68 60 66 L58 58 C64 54 70 46 71 34 C72 20 67 6 50 6 Z" fill="${a}"/>
    <path d="M8 96 C12 76 24 68 40 66 L44 80 L30 120 L6 120 Z M92 96 C88 76 76 68 60 66 L56 80 L70 120 L94 120 Z" fill="${b}"/>
    <g fill="${c}"><ellipse cx="50" cy="86" rx="4" ry="6"/><ellipse cx="50" cy="96" rx="5" ry="8"/></g>
    <path d="M46 84 L34 74 M54 84 L66 74 M45 88 L30 88 M55 88 L70 88 M46 94 L34 104 M54 94 L66 104" stroke="${c}" stroke-width="2.4"/>
    <path d="M36 30 C38 38 44 40 47 36 C45 30 40 27 36 30 Z M64 30 C62 38 56 40 53 36 C55 30 60 27 64 30 Z" fill="#fff" stroke="#000" stroke-width="2"/>
    <path d="M50 6 C33 6 28 20 29 34 C30 46 36 54 42 58 L40 66 C24 68 12 76 8 96 L6 120 L94 120 L92 96 C88 76 76 68 60 66 L58 58 C64 54 70 46 71 34 C72 20 67 6 50 6 Z" fill="url(#g${s.id})"/></svg>`;
}

export function createSuitsPage(sys) {
  const { ctx, save, audio, prog } = sys;
  const el = document.createElement("div");
  el.className = "sys-suits";
  el.innerHTML = `<div class="col"><div class="sys-h3">Suit Selection</div><h2 class="sys-h2">Suits</h2><div class="grid interactive"></div>
    <div class="info sys-panel cut"><div class="sys-h3 st"></div><h2 class="sys-h2 nm"></h2><div class="sw"></div><p class="sys-p ds"></p><div style="margin-top:18px"><button class="sys-btn red eqb">Equip</button></div></div></div>
    <div class="rot">Drag to rotate</div>`;
  const grid = el.querySelector(".grid");
  let sel = save.state.suit;
  const unlocked = (s) => prog.level >= s.level;
  function render() {
    grid.innerHTML = SUITS.map(
      (
        s,
      ) => `<div class="sys-suit ${s.id === sel ? "on" : ""} ${unlocked(s) ? "" : "locked"}" data-id="${s.id}">${suitArt(s)}
      ${save.state.suit === s.id ? '<span class="eq">EQUIPPED</span>' : ""}${unlocked(s) ? "" : `<span class="lock">LVL ${s.level}</span>`}<div class="nm">${s.name}</div></div>`,
    ).join("");
    grid.querySelectorAll(".sys-suit").forEach((c) => {
      c.addEventListener("click", () => {
        sel = c.dataset.id;
        audio.sfx.move();
        preview();
        render();
      });
      c.addEventListener("dblclick", () => equip());
      c.addEventListener("mouseenter", () => audio.sfx.hover());
    });
    const s = SUITS.find((x) => x.id === sel);
    el.querySelector(".info .st").textContent =
      save.state.suit === s.id
        ? "Equipped"
        : unlocked(s)
          ? "Available"
          : `Unlocks at level ${s.level}`;
    el.querySelector(".info .nm").textContent = s.name;
    el.querySelector(".info .ds").textContent = s.desc;
    el.querySelector(".sw").innerHTML = s.swatch
      .map((c) => `<i style="background:${c}"></i>`)
      .join("");
    const b = el.querySelector(".eqb");
    b.disabled = !unlocked(s) || save.state.suit === s.id;
    b.textContent = save.state.suit === s.id ? "Equipped" : "Equip";
  }
  function preview() {
    sys.suits.apply(sel);
  } // locked suits can be previewed, not equipped
  function equip() {
    const s = SUITS.find((x) => x.id === sel);
    if (!unlocked(s)) {
      audio.sfx.deny();
      return;
    }
    save.state.suit = s.id;
    save.markDirty();
    sys.suits.apply(s.id);
    audio.sfx.select();
    render();
    sys.events.emit("suit:changed", { id: s.id });
  }
  el.querySelector(".eqb").addEventListener("click", equip);

  // ---------------- preview camera (orbit around the frozen player)
  let yaw = 0,
    targetYaw = 0,
    dragX = null;
  const _c = new THREE.Vector3(),
    _t = new THREE.Vector3(),
    _f = new THREE.Vector3(),
    _r = new THREE.Vector3();
  el.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".col")) dragX = e.clientX;
  });
  addEventListener("mousemove", (e) => {
    if (dragX != null) {
      targetYaw -= (e.clientX - dragX) * 0.01;
      dragX = e.clientX;
    }
  });
  addEventListener("mouseup", () => {
    dragX = null;
  });
  // how far the preview camera can sit from Spider-Man along a yaw before hitting buildings OR parked/stopped vehicles
  const _o = new THREE.Vector3(),
    _dir = new THREE.Vector3(),
    _q = new THREE.Vector3();
  function clearDist(a, want = 3.1) {
    const P = ctx.player.position;
    _o.set(P.x, P.y + 0.4, P.z);
    _dir.set(Math.sin(a), 0.1, Math.cos(a)).normalize();
    let d = want;
    const h = ctx.world.raycast(_o, _dir, want + 0.6);
    if (h) d = Math.min(d, h.distance - 0.6);
    for (let k = 0.6; k <= d + 0.3; k += 0.35) {
      _q.copy(_o).addScaledVector(_dir, k);
      _q.y = P.y - 0.9;
      if (ctx.world.collideDynamic?.(_q, 0.45, 1.8)) {
        d = Math.min(d, k - 0.55);
        break;
      }
    }
    return d;
  }
  let camDist = 3.1;
  // ---------------- dedicated preview stage (Insomniac suit screen): the city is hidden, Spider-Man stands on a
  // glossy disc inside a dark navy cyclorama with a bright rim band behind him and a red floor ring.
  let stage = null;
  const hidden = [];
  function buildStage() {
    const g = new THREE.Group();
    g.name = "suit-stage";
    const cyc = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 14, 64, 1, true),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: true,
        vertexShader:
          "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `varying vec3 vP; void main(){ float h = clamp((vP.y + 1.0) / 9.0, 0.0, 1.0);
        vec3 top = vec3(0.004, 0.008, 0.03), mid = vec3(0.03, 0.06, 0.16), glow = vec3(0.25, 0.45, 1.1);
        vec3 c = mix(mid, top, smoothstep(0.1, 0.9, h));
        c += glow * exp(-pow((vP.y - 1.2) / 0.9, 2.0)) * 0.35;           // horizon light band (rim source)
        float grid = step(0.985, fract(atan(vP.z, vP.x) * 14.3)) + step(0.97, fract(vP.y * 1.2));
        c += vec3(0.025, 0.045, 0.11) * grid * (1.0 - h) * smoothstep(0.0, 0.25, h);
        gl_FragColor = vec4(c, 1.0); }`,
      }),
    );
    cyc.position.y = 6;
    g.add(cyc);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0a1020,
        roughness: 0.55,
        metalness: 0.0,
        envMapIntensity: 0.25,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.2, 0.15, 0.18),
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.2, 96), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    g.add(ring);
    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 2.42, 96),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.4, 0.7, 1.6),
        transparent: true,
        opacity: 0.5,
      }),
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.01;
    g.add(ring2);
    return g;
  }
  function stageOn() {
    stage = stage || buildStage();
    const P = ctx.player.position;
    const feet = P.y - 0.95;
    stage.position.set(P.x, feet + 0.005, P.z);
    hidden.length = 0;
    for (const o of ctx.scene.children) {
      if (o === ctx.player.object || o.isLight || o === stage || !o.visible)
        continue;
      o.visible = false;
      hidden.push(o);
    }
    ctx.scene.add(stage);
    // the dark stage would make eye adaptation blow the suit out: hold the daylight exposure while previewing
    const gr = ctx.pipeline.grade;
    if (gr) {
      aeSave = gr.autoExposure;
      gr.autoExposure = false;
    }
  }
  let aeSave = null;
  function stageOff() {
    if (!stage) return;
    ctx.scene.remove(stage);
    for (const o of hidden) o.visible = true;
    hidden.length = 0;
    const gr = ctx.pipeline.grade;
    if (gr && aeSave != null) {
      gr.autoExposure = aeSave;
      aeSave = null;
    }
  }
  function camera(dt) {
    const cam = ctx.camera,
      P = ctx.player;
    targetYaw += dt * (dragX == null ? 0.12 : 0);
    yaw += (targetYaw - yaw) * (1 - Math.exp(-8 * dt));
    const center = _c.copy(P.position);
    center.y += 0.05;
    camDist +=
      ((stage?.parent ? 3.1 : THREE.MathUtils.clamp(clearDist(yaw), 1.3, 3.1)) -
        camDist) *
      (1 - Math.exp(-10 * dt));
    const dist = camDist;
    cam.position.set(
      center.x + Math.sin(yaw) * dist,
      center.y + 0.35,
      center.z + Math.cos(yaw) * dist,
    );
    _f.copy(center).sub(cam.position).setY(0).normalize();
    _r.set(-_f.z, 0, _f.x);
    _t.copy(center).addScaledVector(_r, -0.95);
    _t.y -= 0.05;
    const gy =
      ctx.world.groundHeight(cam.position.x, cam.position.z, cam.position.y) +
      0.3;
    if (cam.position.y < gy) cam.position.y = gy;
    cam.up.set(0, 1, 0);
    cam.lookAt(_t);
    if (cam.fov !== 42) {
      cam.fov = 42;
      cam.updateProjectionMatrix();
    }
    ctx.pipeline.setDof?.({ focus: dist, aperture: 2.5, maxBlur: 8 });
    ctx.pipeline.setMotionBlur?.(0);
  }
  let camSave = null;

  return {
    id: "suits",
    title: "Suits",
    el,
    seeThrough: true,
    camera,
    hints: [
      ["Click", "Select"],
      ["Dbl-Click", "Equip"],
    ],
    footer: () =>
      `${SUITS.filter(unlocked).length}/${SUITS.length} SUITS UNLOCKED`,
    show() {
      sel = save.state.suit;
      render();
      // start in FRONT of Spider-Man (opposite the chase camera), on the first yaw with a clear line of sight
      const P = ctx.player.position,
        c = ctx.camera.position;
      const base = Math.atan2(P.x - c.x, P.z - c.z) + 0.45;
      yaw = base;
      let bestD = -1;
      for (let k = 0; k < 16; k++) {
        const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.39;
        const d = clearDist(a, 3.4);
        if (d >= 3.1) {
          yaw = a;
          bestD = d;
          break;
        }
        if (d > bestD) {
          bestD = d;
          yaw = a;
        }
      }
      targetYaw = yaw;
      camDist = THREE.MathUtils.clamp(bestD, 1.3, 3.1);
      camSave = {
        p: ctx.camera.position.clone(),
        q: ctx.camera.quaternion.clone(),
        fov: ctx.camera.fov,
      };
      stageOn();
      camDist = 3.1;
      ctx.pipeline.resetHistory?.();
    },
    hide() {
      stageOff();
      sys.suits.apply(save.state.suit);
      ctx.pipeline.setDof?.({ aperture: 0 });
      if (camSave) {
        ctx.camera.position.copy(camSave.p);
        ctx.camera.quaternion.copy(camSave.q);
        ctx.camera.fov = camSave.fov;
        ctx.camera.updateProjectionMatrix();
        camSave = null;
      }
      ctx.pipeline.resetHistory?.();
    },
    key(e) {
      const i = SUITS.findIndex((s) => s.id === sel);
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        sel = SUITS[(i + 1) % SUITS.length].id;
        preview();
        render();
        audio.sfx.move();
        return true;
      }
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        sel = SUITS[(i - 1 + SUITS.length) % SUITS.length].id;
        preview();
        render();
        audio.sfx.move();
        return true;
      }
      if (e.code === "Enter" || e.code === "Space") {
        equip();
        return true;
      }
      return false;
    },
  };
}
