// OWNER: foundation agent (city remake); rebuilt by the bridges agent (bridges r1). East River bridges (definitions:
// layout.BRIDGES). Every bridge is a complete road from a Manhattan street to the far shore:
//   Manhattan street / avenue (at grade) -> approach plaza (apron over the sidewalk, lots cleared) -> approach viaduct
//   (masonry arcade over block interiors, steel spans over streets / avenues / the waterfront) -> anchorage (stone, in
//   the water off the seawall) -> main span -> far anchorage -> far approach arcade -> far-shore ground.
// The road deck is continuous (one profile: mJoin -> mLand -> xA0 -> xB1 -> rampX1, see roadProfile) with lanes, lane
// markings (deck shader), kerbs + railings, median barriers, lamp posts (emissive heads at night) and exact collision.
//   stone      Brooklyn-Bridge-like: granite towers with twin pointed arches, 4 main cables + the diagonal stay web,
//              a raised plank promenade in the middle (forks round the tower's centre pier)
//   steel      'arch'    Manhattan-Bridge-like: solid legs, X bracing, arched crown portal, cable pairs, deep truss;
//                        a stone arch + colonnade on its approach plaza
//              'lattice' Williamsburg-like: open lattice legs and portals, cable pairs, subway tracks in the middle
//              'deco'    Triborough-like: slender solid legs with plain portals, single cables
//   cantilever Queensboro-like: through truss whose top chord peaks over stone piers with pinnacle towers, crossing
//              the Roosevelt-like islet
// Traversal (bridges r1): towers, anchorages, cable segments and truss chords go into world.buildings (web-swing anchor
// faces, anchors.js); the main cables and truss top chords are solid (thin ramps: run up a cable, perch on it) with zip
// points; lamp heads are lampTop zip points (low swings along the deck). bridgeLimits() is the halfway rule: past a
// bridge's mid-span the player is web-yanked back toward Manhattan (traversal.js bridgeBounce).
// Geometry is merged per material over all bridges: stone, deck, cables, steel (vertex colours: one draw for every
// bridge), truss / railings (lattice shader) = 5 draw calls.
import { nightK, nightOnly } from "../render/daynight.js"; // (daynight)
import { cityLights } from "../render/citylights.js"; // (night) real deck-lamp lighting
import * as THREE from "three";
import { G, BRIDGES, shoreX, onRoad, streetsAt, addCurbCut } from "./layout.js";
import { FAR_LANDS, FAR_Y } from "./farshore.js";
import { REFL_LAYER } from "./water.js";

const LW = 3.4; // lane width (m)

// ------------------------------------------------------------------ geometry accumulator
// P / N / U + per-vertex colour (C, linear rgb: steel of every bridge in one mesh) and ex (E): deck = (road inner half,
// road outer half, marking mode), steel = (emissive, 0, 0)
class Acc {
  constructor() {
    this.P = [];
    this.N = [];
    this.U = [];
    this.C = [];
    this.E = [];
    this.I = [];
    this.n = 0;
    this.col = [1, 1, 1];
    this.ex = [0, 0, 0];
  }
  vtx(p, n, uv) {
    this.P.push(p[0], p[1], p[2]);
    this.N.push(n[0], n[1], n[2]);
    this.U.push(uv[0], uv[1]);
    this.C.push(this.col[0], this.col[1], this.col[2]);
    this.E.push(this.ex[0], this.ex[1], this.ex[2]);
  }
  // quad a,b,c,d (counter-clockwise seen from the front), uv per corner
  quad(
    a,
    b,
    c,
    d,
    uv = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  ) {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2],
      vx = d[0] - a[0],
      vy = d[1] - a[1],
      vz = d[2] - a[2];
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const n = [nx, ny, nz];
    this.vtx(a, n, uv[0]);
    this.vtx(b, n, uv[1]);
    this.vtx(c, n, uv[2]);
    this.vtx(d, n, uv[3]);
    this.I.push(this.n, this.n + 1, this.n + 2, this.n, this.n + 2, this.n + 3);
    this.n += 4;
  }
  box(x0, y0, z0, x1, y1, z1, { top = true, bottom = false } = {}) {
    this.quad(
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
    );
    this.quad(
      [x1, y0, z0],
      [x0, y0, z0],
      [x0, y1, z0],
      [x1, y1, z0],
      [
        [-x1, y0],
        [-x0, y0],
        [-x0, y1],
        [-x1, y1],
      ],
    );
    this.quad(
      [x1, y0, z1],
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [
        [-z1, y0],
        [-z0, y0],
        [-z0, y1],
        [-z1, y1],
      ],
    );
    this.quad(
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
      [
        [z0, y0],
        [z1, y0],
        [z1, y1],
        [z0, y1],
      ],
    );
    if (top)
      this.quad(
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
        [
          [x0, z1],
          [x1, z1],
          [x1, z0],
          [x0, z0],
        ],
      );
    if (bottom)
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  }
  // box whose top / bottom follow a slope along x (ramped kerbs, girders, parapets): y = ya..yb at x0..x1, height h
  sbox(x0, x1, ya, yb, h, z0, z1, { top = true, bottom = false, dz = 0 } = {}) {
    const A = [x0, ya, z0],
      B = [x1, yb, z0],
      Ct = [x1, yb + h, z0],
      D = [x0, ya + h, z0];
    const A1 = [x0, ya, z1],
      B1 = [x1, yb, z1],
      C1 = [x1, yb + h, z1],
      D1 = [x0, ya + h, z1];
    this.quad(A1, B1, C1, D1, [
      [x0, 0],
      [x1, 0],
      [x1, h],
      [x0, h],
    ]);
    this.quad(B, A, D, Ct, [
      [-x1, 0],
      [-x0, 0],
      [-x0, h],
      [-x1, h],
    ]);
    this.quad(B1, B, Ct, C1);
    this.quad(A, A1, D1, D);
    if (top)
      this.quad(D1, C1, Ct, D, [
        [x0, z1],
        [x1, z1],
        [x1, z0],
        [x0, z0],
      ]);
    if (bottom) this.quad(A, B, B1, A1);
    void dz;
  }
  // square-section beam between two points (cables, stays, bracing), s = side
  beam(p, q, s, up = [0, 1, 0]) {
    const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]],
      L = Math.hypot(...d);
    if (L < 1e-3) return;
    const t = d.map((v) => v / L);
    let a = [
      t[1] * up[2] - t[2] * up[1],
      t[2] * up[0] - t[0] * up[2],
      t[0] * up[1] - t[1] * up[0],
    ];
    if (Math.hypot(...a) < 1e-3) a = [1, 0, 0];
    const la = Math.hypot(...a);
    a = a.map((v) => v / la);
    const b = [
      t[1] * a[2] - t[2] * a[1],
      t[2] * a[0] - t[0] * a[2],
      t[0] * a[1] - t[1] * a[0],
    ];
    const h = s / 2,
      C = [
        [h, h],
        [-h, h],
        [-h, -h],
        [h, -h],
      ];
    const pt = (o, i) => [
      o[0] + a[0] * C[i][0] + b[0] * C[i][1],
      o[1] + a[1] * C[i][0] + b[1] * C[i][1],
      o[2] + a[2] * C[i][0] + b[2] * C[i][1],
    ];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(pt(p, i), pt(p, j), pt(q, j), pt(q, i), [
        [0, 0],
        [s, 0],
        [s, L],
        [0, L],
      ]);
    }
  }
  // polyline tube (main cables): n-gon section, radius r
  tube(pts, r, n = 6) {
    const base = this.n;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i],
        q = pts[Math.min(pts.length - 1, i + 1)],
        o = pts[Math.max(0, i - 1)];
      const t = [q[0] - o[0], q[1] - o[1], q[2] - o[2]],
        lt = Math.hypot(...t) || 1;
      t[0] /= lt;
      t[1] /= lt;
      t[2] /= lt;
      let a = [-t[2], 0, t[0]];
      const la = Math.hypot(...a) || 1;
      a = a.map((v) => v / la);
      const b = [
        t[1] * a[2] - t[2] * a[1],
        t[2] * a[0] - t[0] * a[2],
        t[0] * a[1] - t[1] * a[0],
      ];
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2,
          c = Math.cos(ang),
          s = Math.sin(ang);
        const nn = [
          a[0] * c + b[0] * s,
          a[1] * c + b[1] * s,
          a[2] * c + b[2] * s,
        ];
        this.vtx([p[0] + nn[0] * r, p[1] + nn[1] * r, p[2] + nn[2] * r], nn, [
          k / n,
          i,
        ]);
      }
    }
    for (let i = 0; i + 1 < pts.length; i++)
      for (let k = 0; k < n; k++) {
        const a = base + i * n + k,
          b = base + i * n + ((k + 1) % n),
          c = a + n,
          d = b + n;
        this.I.push(a, b, c, b, d, c);
      }
    this.n += pts.length * n;
  }
  // octagonal column (colonnade)
  column(x, z, y0, y1, r) {
    const pts = [
      [x, y0, z],
      [x, y1, z],
    ];
    const base = this.n;
    for (const p of pts)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        this.vtx(
          [p[0] + Math.cos(a) * r, p[1], p[2] + Math.sin(a) * r],
          [Math.cos(a), 0, Math.sin(a)],
          [k / 8, p[1]],
        );
      }
    for (let k = 0; k < 8; k++) {
      const a = base + k,
        b = base + ((k + 1) % 8);
      this.I.push(a, b + 8, b, a, a + 8, b + 8);
    }
    this.n += 16;
  }
  // THREE geometry (ExtrudeGeometry etc.) through a vertex transform f([x,y,z]) -> [x,y,z], normal transform fn
  geom(g, f, fn, flip = false) {
    const pos = g.attributes.position,
      nrm = g.attributes.normal;
    for (let i = 0; i < pos.count; i++)
      this.vtx(
        f([pos.getX(i), pos.getY(i), pos.getZ(i)]),
        fn([nrm.getX(i), nrm.getY(i), nrm.getZ(i)]),
        [0, 0],
      );
    const idx = g.index ? g.index.array : [...Array(pos.count).keys()];
    for (let i = 0; i < idx.length; i += 3)
      flip
        ? this.I.push(this.n + idx[i], this.n + idx[i + 2], this.n + idx[i + 1])
        : this.I.push(
            this.n + idx[i],
            this.n + idx[i + 1],
            this.n + idx[i + 2],
          );
    this.n += pos.count;
    g.dispose();
  }
  build({ color = false, ex = false } = {}) {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.U, 2));
    if (color)
      g.setAttribute("color", new THREE.Float32BufferAttribute(this.C, 3));
    if (ex) g.setAttribute("aEx", new THREE.Float32BufferAttribute(this.E, 3));
    g.setIndex(
      this.n > 65535
        ? new THREE.Uint32BufferAttribute(this.I, 1)
        : new THREE.Uint16BufferAttribute(this.I, 1),
    );
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------------------------------------------ materials
function stoneMaterial(T) {
  const m = new THREE.MeshStandardMaterial({
    color: 0xa39a8a,
    roughness: 0.88,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tSN = { value: T.noise };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWPs; varying vec3 vWNs;",
      )
      .replace(
        "#include <fog_vertex>",
        "#include <fog_vertex>\nvWPs = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNs = normalize(mat3(modelMatrix) * objectNormal);",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D tSN; varying vec3 vWPs; varying vec3 vWNs;",
      )
      .replace(
        "#include <map_fragment>",
        `{
        vec3 an = abs(vWNs);
        vec2 q = an.x > an.z ? vWPs.zy : vWPs.xy; if (an.y > 0.7) q = vWPs.xz;
        vec3 nz = texture(tSN, q / 17.0).rgb, nz2 = texture(tSN, q / 3.1).rgb;
        // ashlar coursing: 0.9 m courses, 1.8 m blocks (offset every other course), thin dark joints
        float cy = q.y / 0.9, row = floor(cy), cx = q.x / 1.8 + 0.5 * mod(row, 2.0);
        vec2 f = vec2(fract(cx), fract(cy)); vec2 fw = fwidth(vec2(cx, cy)) * 1.5 + 1e-4;
        float joint = max(1.0 - smoothstep(0.0, 0.03 + fw.x, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, 0.04 + fw.y, min(f.y, 1.0 - f.y)));
        joint *= 1.0 - smoothstep(0.2, 0.6, max(fw.x, fw.y));
        float blk = fract(sin(dot(floor(vec2(cx, cy)), vec2(12.9898, 78.233))) * 43758.5453);
        vec3 c = diffuseColor.rgb * (0.86 + 0.16 * blk) * (0.8 + 0.3 * nz.r) * (0.93 + 0.1 * nz2.g);
        c *= 1.0 - 0.35 * joint;
        c *= mix(0.72, 1.0, smoothstep(-1.0, 6.0, vWPs.y)); // wet / algae band at the water line
        c *= 1.0 - 0.18 * smoothstep(0.55, 0.85, nz.b) * (0.5 + 0.5 * an.x + 0.5 * an.z); // grime streaks
        diffuseColor.rgb = c;
      }`,
      );
  };
  m.customProgramCacheKey = () => "bridge-stone-v1";
  return m;
}
// steel (vertex colours = per-bridge paint; aEx.x = lamp-head glow at night)
function steelMaterial() {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.6,
    metalness: 0.35,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNightK = nightK;
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec3 aEx; varying float vGlow;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvGlow = aEx.x;",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vGlow; uniform float uNightK;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.82, 0.55) * vGlow * (0.15 + 7.0 * uNightK);`,
      );
  };
  m.customProgramCacheKey = () => "bridge-steel-v2";
  return m;
}
function cableMaterial() {
  // cables / suspenders: fatten with distance so they never break up into sub-pixel dashes (keep ~1 px, read as
  // heavy catenaries from across the river instead of a faint wireframe)
  const m = new THREE.MeshStandardMaterial({
    color: 0x3b4043,
    roughness: 0.6,
    metalness: 0.35,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNightK = nightK; // (daynight) necklace lights along the cables at night
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec3 aEx; varying vec3 vWPc; varying float vNeck, vFat;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      vNeck = aEx.x; { vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz; vFat = max(0.0, length(wp - cameraPosition) * 0.0011 - 0.15); transformed += objectNormal * vFat; vWPc = wp; }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWPc; varying float vNeck, vFat; uniform float uNightK;",
      )
      // (night) the distance-fattened cables read as pale bars against the night sky (moon / sky sheen on 2+ px tubes):
      // darker, less metallic at night, so only the necklace bulbs carry the catenaries from afar
      .replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - 0.85 * uNightK; diffuseColor.rgb *= 1.0 - 0.7 * uNightK;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
      if (uNightK > 0.0 && vNeck > 0.5) { float q = (vWPc.x + vWPc.z) * 0.18; float fq = fwidth(q) + 1e-4;
        // (night) small bright bulbs, not a glowing bar: each bulb stays >= ~1.5 px long at any distance (never averaged
        // into a continuous line); once bulbs crowd to < ~3.5 px apart only every 2nd / 4th / ... bulb is drawn (stable
        // world-space subset), so far bridges keep a dotted necklace of points. Bloom does the glow
        float st = exp2(ceil(log2(max(1.0, fq * 6.0)))); // (night r11) 3.5: far necklaces read as dashed white bars
        float hw = max(0.05, fq * 0.75), dd = abs(fract(q) - 0.5);
        float dot1 = (1.0 - smoothstep(hw - 0.5 * fq, hw + 0.5 * fq, dd)) * step(mod(floor(q), st), 0.5);
        // (night r11) the cable is fattened with distance (~1.5 m at 1.5 km): the bulb's emission is scaled back by the
        // fattening, so far necklaces read as fine warm points instead of thick white dashes (esb view)
        totalEmissiveRadiance += vec3(1.0, 0.9, 0.72) * dot1 * 3.5 * uNightK / (1.0 + vFat * 6.0); }`,
      );
  };
  m.customProgramCacheKey = () => "bridge-cable-minpx-v6";
  return m;
}
// lattice (vertex colours). uv.y 0..1: truss web (u = along in panels): chords, posts every panel, X diagonals.
// uv.y 2..3: railing (u = along / 2 m): top + mid + bottom rails, posts every 2 m, pickets every 12.5 cm.
function latticeMaterial() {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.6,
    metalness: 0.35,
    side: THREE.DoubleSide,
  });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTU;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTU = uv;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTU;")
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        if (vTU.y < 1.5) { float u = fract(vTU.x), v = vTU.y; vec2 fw = fwidth(vTU) + 1e-4;
          float chord = step(v, 0.08 + fw.y) + step(0.92 - fw.y, v);
          float post = step(min(u, 1.0 - u), 0.05 + fw.x);
          float d1 = abs(u - v), d2 = abs(u - (1.0 - v));
          float diag = step(min(d1, d2), 0.06 + fw.x + fw.y);
          // far away the web is sub-pixel: keep it solid (dithered holes would read as polka dots)
          if (chord + post + diag < 0.5 && max(fw.x, fw.y) < 0.09) discard;
        } else { float v = vTU.y - 2.0, u = vTU.x; vec2 fw = fwidth(vec2(u * 16.0, v)) + 1e-4;
          float rail = step(0.9 - fw.y, v) + step(v, 0.07 + fw.y) + step(abs(v - 0.5), 0.035 + fw.y);
          float post = step(min(fract(u), 1.0 - fract(u)), 0.04 + fw.x / 16.0);
          float pick = step(abs(fract(u * 16.0) - 0.5), 0.12 + fw.x);
          if (rail + post + pick < 0.5 && fw.x < 0.6) discard; }`,
      );
  };
  m.customProgramCacheKey = () => "bridge-lattice-v2";
  return m;
}
// deck: asphalt with painted lanes. uv = (x along, lateral offset from the bridge centre line); aEx = (road inner half,
// road outer half, mode): 1 road markings (edge lines, double yellow / lane dashes, tyre wear), 2 timber promenade
// planks, 3 subway track bed (ballast + ties), 4 concrete walkway / median, 0 plain asphalt. Side faces: concrete.
function deckMaterial(T) {
  const m = new THREE.MeshStandardMaterial({ color: 0x75726c, roughness: 0.9 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tDC = { value: T.asphaltCol };
    sh.uniforms.tSN = { value: T.noise };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec3 aEx; varying vec3 vWPd; varying vec3 vWNd; varying vec2 vUD; varying vec3 vEx;",
      )
      .replace(
        "#include <fog_vertex>",
        "#include <fog_vertex>\nvWPd = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNd = normalize(mat3(modelMatrix) * objectNormal); vUD = uv; vEx = aEx;",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      uniform sampler2D tDC; uniform sampler2D tSN; varying vec3 vWPd; varying vec3 vWNd; varying vec2 vUD; varying vec3 vEx;
      float bandL(float l, float c, float w, float fw) { return 1.0 - smoothstep(w * 0.5 - fw, w * 0.5 + fw, abs(l - c)); }`,
      )
      .replace(
        "#include <map_fragment>",
        `{
        vec3 c = texture(tDC, vWPd.xz / 6.0).rgb * 1.1;
        float md = floor(vEx.z + 0.5);
        vec3 nz = texture(tSN, vWPd.xz / 23.0).rgb;
        if (vWNd.y < 0.5) c = vec3(0.42, 0.42, 0.41) * (0.85 + 0.25 * nz.r); // slab edges / fascia / kerbs: concrete
        else if (md == 1.0) {
          float l = abs(vUD.y), a = vUD.x, inner = vEx.x, outer = vEx.y;
          float fw = fwidth(vUD.y) + 1e-3;
          float fade = 1.0 - smoothstep(0.08, 0.3, fw); // lines fade to the asphalt tone before they alias
          float w = bandL(l, outer - 0.45, 0.15, fw);
          if (inner > 0.3) w = max(w, bandL(l, inner + 0.45, 0.15, fw));
          float n = floor((outer - inner - 1.0) / ${LW.toFixed(1)} + 0.5);
          float k = floor((l - inner - 0.5) / ${LW.toFixed(1)} + 0.5);
          if (k >= 1.0 && k <= n - 1.0) w = max(w, bandL(l, inner + 0.5 + k * ${LW.toFixed(1)}, 0.13, fw) * step(fract(a / 12.0), 0.27));
          float y = inner < 0.3 ? max(bandL(l, 0.2, 0.12, fw), 0.0) : 0.0;
          // tyre-polished wheel paths (darker, smoother) in every lane
          float ln = fract((l - inner - 0.5) / ${LW.toFixed(1)});
          float wear = (1.0 - smoothstep(0.08, 0.16, abs(ln - 0.27))) + (1.0 - smoothstep(0.08, 0.16, abs(ln - 0.73)));
          c *= 1.0 - 0.13 * wear * step(l, outer - 0.5) * step(inner + 0.5, l);
          // expansion joints every 30 m (steel strip)
          c = mix(c, vec3(0.32, 0.31, 0.3), (1.0 - smoothstep(0.05, 0.12 + fwidth(a), abs(fract(a / 30.0) - 0.5) * 30.0)) * fade);
          c = mix(c, vec3(0.84, 0.83, 0.78) * (0.8 + 0.25 * nz.g), w * 0.85 * fade);
          c = mix(c, vec3(0.78, 0.6, 0.17), y * 0.85 * fade);
        } else if (md == 2.0) { // timber planks across the promenade, grey-brown, worn
          float a = vUD.x / 0.32, pl = fract(a), id = floor(a);
          float h = fract(sin(id * 12.9898) * 43758.5453);
          // (bridges r2) weathered timber: warm brown boards greyed by the sun, darker grime patches and a
          // foot-polished centre band, dark gaps between the boards
          vec3 wood = vec3(0.43, 0.33, 0.24) * (0.72 + 0.34 * h);
          vec3 grey = vec3(0.4, 0.38, 0.35) * (0.8 + 0.2 * h);
          c = mix(wood, grey, 0.35 + 0.4 * nz.g);
          float grain = texture(tSN, vec2(vWPd.x * 0.9, vUD.y * 11.0 + id * 3.1)).r;
          c *= 0.82 + 0.3 * grain;
          c *= 1.0 - 0.32 * smoothstep(0.52, 0.8, texture(tSN, vWPd.xz / 7.0).b);       // grime / wet-rot patches
          c *= 1.0 - 0.18 * smoothstep(1.2, 3.2, abs(vUD.y));                            // edges darker (less foot traffic)
          c *= 1.0 - 0.55 * (1.0 - smoothstep(0.0, 0.07 + fwidth(a), min(pl, 1.0 - pl))) * (1.0 - smoothstep(0.2, 0.5, fwidth(a)));
        } else if (md == 3.0) { // ballast + timber ties every 0.62 m
          vec3 bal = vec3(0.36, 0.34, 0.31) * (0.7 + 0.5 * texture(tSN, vWPd.xz / 1.3).r);
          float t = fract(vUD.x / 0.62), tie = step(abs(t - 0.5), 0.2) * step(abs(abs(vUD.y) - 2.3), 1.35);
          c = mix(bal, vec3(0.22, 0.18, 0.15), tie * (1.0 - smoothstep(0.2, 0.5, fwidth(vUD.x / 0.62))));
        } else if (md == 4.0) { c = vec3(0.56, 0.55, 0.52) * (0.8 + 0.3 * nz.r); }
        diffuseColor.rgb *= c;
      }`,
      );
  };
  m.customProgramCacheKey = () => "bridge-deck-v2";
  return m;
}

// far-shore x where the east bank meets the line z (Manhattan-facing crossing = smallest x beyond the island)
function farShoreX(z, x0) {
  let best = Infinity;
  for (const L of FAR_LANDS) {
    if (L.name !== "east") continue;
    for (let i = 0; i < L.pts.length; i++) {
      const [ax, az] = L.pts[i],
        [bx, bz] = L.pts[(i + 1) % L.pts.length];
      if (az > z === bz > z) continue;
      const x = ax + ((bx - ax) * (z - az)) / (bz - az);
      if (x > x0 && x < best) best = x;
    }
  }
  return best;
}
// island crossings (Roosevelt-like) along z: [[xa, xb], ...]
function isletSpans(z, x0, x1) {
  const out = [];
  for (const L of FAR_LANDS) {
    if (L.name !== "roos") continue;
    const xs = [];
    for (let i = 0; i < L.pts.length; i++) {
      const [ax, az] = L.pts[i],
        [bx, bz] = L.pts[(i + 1) % L.pts.length];
      if (az > z === bz > z) continue;
      xs.push(ax + ((bx - ax) * (z - az)) / (bz - az));
    }
    xs.sort((a, b) => a - b);
    if (xs.length >= 2 && xs[0] > x0 && xs[1] < x1) out.push([xs[0], xs[1]]);
  }
  return out;
}

// cross-section of a bridge (lateral offsets from the centre line): R road outer half, hw deck half width, cz cable
// planes, zc / legHz steel tower leg centre / half depth, truss plane (cantilever)
function sectionOf(B) {
  const inner = B.inner ?? 0.6,
    lanes = B.lanes ?? 2,
    R = inner + 1.0 + lanes * LW;
  if (B.style === "stone") {
    const hw = R + 1.0;
    return { inner, lanes, R, hw, cz: [-(hw - 0.3), -3.4, 3.4, hw - 0.3] };
  }
  if (B.style === "cantilever") {
    const hw = R + 0.9;
    return { inner, lanes, R, hw, truss: hw + 1.2, cz: [] };
  }
  const legHz = B.pairs ? 4.2 : 3.4,
    zc = R + 0.6 + legHz,
    hw = zc + (B.pairs ? 1.8 : 1.0);
  return {
    inner,
    lanes,
    R,
    hw,
    zc,
    legHz,
    cz: B.pairs ? [-zc - 1.4, -zc + 1.4, zc - 1.4, zc + 1.4] : [-zc, zc],
  };
}
// x where the at-grade approach apron meets a roadway (first road cell west of the landing) at lateral line zl
function joinX(xL, zl) {
  for (let x = xL; x > xL - 160; x -= 0.5) if (onRoad(x, zl)) return x + 0.25;
  return xL - 12;
}

// resolved spans for each bridge (shared with farshore.js for keeping the approach corridors free); memoised: the layout
// and the far lands are static
let _spans = null;
export function bridgeSpans() {
  if (_spans) return _spans;
  _spans = BRIDGES.map((B) => {
    const S = sectionOf(B);
    const xM = shoreX(B.z)[1]; // Manhattan east seawall
    const xF = farShoreX(B.z, xM + 50); // far bank
    const xA0 = xM + 1.5;
    // Manhattan approach: from the anchorage (deck level) down at mGrade to the block level (mLand), then an at-grade
    // apron west to the first roadway (mJoin: per lateral line, the street edge; mJoin0 at the centre line)
    const mLand = B.mGrade ? xA0 - (B.deckY - G.CURB_H) / B.mGrade : null;
    const zl = [-1, -0.5, 0, 0.5, 1].map((t) => t * (S.hw - 0.3));
    const mJoins =
      mLand !== null ? zl.map((l) => [l, joinX(mLand, B.z + l)]) : null;
    const mJoin = mJoins ? Math.min(...mJoins.map((j) => j[1])) : null,
      mJoin0 = mJoins ? mJoins[2][1] : null;
    const xA1 = xM + 1.5 + B.anchor,
      xB0 = xF - 1.5 - B.anchor,
      xB1 = xF - 1.5;
    return {
      ...B,
      sec: S,
      xM,
      xF,
      xA0,
      xA1,
      xB0,
      xB1,
      rampX1: xF + B.ramp,
      mLand,
      mJoin,
      mJoin0,
      mJoins,
      xMid: (xM + xF) / 2,
    };
  });
  return _spans;
}
// road profile [x, y] (x increasing) from the Manhattan street to the far-shore ground
export function roadProfile(B) {
  const pts = [];
  if (B.mLand !== null) pts.push([B.mJoin0, G.CURB_H], [B.mLand, G.CURB_H]);
  pts.push([B.xA0, B.deckY], [B.xB1, B.deckY], [B.rampX1, FAR_Y]);
  return pts;
}
// (bridges r3) ramp-mouth junction footprints (Manhattan side): the apron, the ramp foot and the whole joined street
// (both sidewalks + parking lanes) +-22 m past the deck. Street furniture and trees keep off (city.js); it matches the
// traffic's no-parking T footprint (npc/roads.js bridgeJunctions, built later with the road network).
export function bridgeKeepOuts() {
  return bridgeSpans()
    .filter((B) => B.mLand !== null)
    .map((B) => {
      const hw = B.sec.hw;
      return {
        name: B.name,
        props: {
          x0: Math.min(B.mJoin, B.mJoin0 - 4) - 28,
          x1: B.mLand + 12,
          z0: B.z - hw - 22,
          z1: B.z + hw + 22,
        },
      };
    });
}
// building-exclusion rects under the Manhattan approaches (city.js -> generateBuildings exclude): apron + viaduct
export function approachRects() {
  return bridgeSpans()
    .filter((B) => B.mLand !== null)
    .map((B) => {
      const p = B.sec.hw + (B.plazaArch ? 9 : 3);
      return { x0: B.mJoin - 4, x1: B.xA0, z0: B.z - p, z1: B.z + p };
    });
}
// deck top y under (x, z) if it is on a bridge road (for the anchor search's altitude band), else null
export function bridgeDeckY(x, z) {
  for (const B of bridgeSpans()) {
    if (Math.abs(z - B.z) > B.sec.hw + 4) continue;
    const P = roadProfile(B);
    if (x < P[0][0] || x > P[P.length - 1][0]) continue;
    for (let i = 1; i < P.length; i++)
      if (x <= P[i][0])
        return (
          P[i - 1][1] +
          ((P[i][1] - P[i - 1][1]) * (x - P[i - 1][0])) /
            (P[i][0] - P[i - 1][0])
        );
  }
  return null;
}
// Halfway rule (bridges r1): each bridge's corridor (+-140 m around its centre line) east of its mid-span (xMid) up to
// beyond the far ramp is out of bounds. check(x, y, z) -> null | {name, xLim, target: [x, y, z] (a deck point back toward
// Manhattan, 75 m inside the limit), web: [x, y, z] (the Manhattan tower top: where the yank web is drawn to)}
export function bridgeLimits(groundHeight) {
  const L = bridgeSpans().map((B) => {
    const xT = Math.max(B.xA1 + 25, B.xMid - 75);
    return {
      B,
      xLim: B.xMid,
      z0: B.z - 140,
      z1: B.z + 140,
      x1: B.rampX1 + 400,
      xT,
      web: B.web ?? [B.xA1 + 40, B.deckY + 30, B.z],
    };
  });
  return {
    list: L.map((l) => ({ name: l.B.name, xLim: l.xLim, z: l.B.z })),
    check(x, y, z) {
      for (const l of L) {
        if (z < l.z0 || z > l.z1 || x <= l.xLim || x > l.x1) continue;
        const B = l.B,
          zT = B.z + Math.max(-B.sec.R + 2, Math.min(B.sec.R - 2, z - B.z));
        const yT = groundHeight ? groundHeight(l.xT, zT, B.deckY + 8) : B.deckY;
        return {
          name: B.name,
          xLim: l.xLim,
          target: [l.xT, yT, zT],
          web: l.web,
        };
      }
      return null;
    },
  };
}

// ------------------------------------------------------------------ build
export function buildBridges({
  scene,
  T,
  solids = null,
  zips = null,
  boxes = null,
}) {
  const group = new THREE.Group();
  group.name = "bridges";
  scene.add(group);
  const K = {
    stone: new Acc(),
    deck: new Acc(),
    cable: new Acc(),
    steel: new Acc(),
    lat: new Acc(),
    pool: new Acc(),
    lamps: [],
    solids,
    zips,
    boxes,
  }; // (night) lamps: real lights (citylights.js)
  const spans = bridgeSpans();
  for (const B of spans) {
    const col = new THREE.Color(B.color ?? 0x6f7a80);
    K.steel.col = K.lat.col = [col.r, col.g, col.b];
    // (bridges r2) railings: painted steel, darker than the structure (Brooklyn: dark green, not the tan truss paint)
    const rc = new THREE.Color(B.railColor ?? B.color ?? 0x6f7a80);
    if (!B.railColor) rc.multiplyScalar(0.62);
    K.railCol = [rc.r, rc.g, rc.b];
    K.steel.ex = [0, 0, 0];
    buildBridge(B, K);
  }
  // ---- meshes
  const add = (a, mat, name, shadow = true, opt = {}) => {
    const g = a.build(opt);
    if (!g) return;
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.layers.enable(REFL_LAYER);
    group.add(m);
  };
  add(K.stone, stoneMaterial(T), "bridgeStone");
  add(K.deck, deckMaterial(T), "bridgeDeck", true, { ex: true });
  add(K.cable, cableMaterial(), "bridgeCables", false, { ex: true });
  add(K.steel, steelMaterial(), "bridgeSteel", true, { color: true, ex: true });
  add(K.lat, latticeMaterial(), "bridgeTruss", false, { color: true });
  {
    // (bridges r2) lamp light pools on the decks at night: one additive decal mesh (like props.js lampPool), no draw by day
    const cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const g2 = cv.getContext("2d"),
      gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.25, "rgba(255,255,255,0.62)");
    gr.addColorStop(0.6, "rgba(255,255,255,0.16)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(1.0, 0.62, 0.3).multiplyScalar(0.22),
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      fog: false,
    });
    const g = K.pool.build();
    if (g) {
      const m = new THREE.Mesh(g, pm);
      m.name = "bridgeLampPools";
      m.renderOrder = 2;
      m.onBeforeRender = () => {
        pm.opacity = cityLights.enabled ? 0 : nightK.value;
      };
      group.add(nightOnly(m));
    } // (night) replaced by the real lamp light below
    // (night) every deck lamp is a real light: roadway cobra heads = warm down-facing spots (like the street lamps,
    // props.js), anchorage twin globes = soft warm points
    for (const L of K.lamps)
      cityLights.add(
        L.globe
          ? {
              type: "point",
              pos: [L.x, L.y, L.z],
              color: 0xffd9a8,
              intensity: 55,
              range: 14,
              radius: 0.5,
              volume: 0.45,
            }
          : {
              type: "spot",
              pos: [L.x, L.y, L.z],
              dir: [0, -1, 0],
              angle: 1.3,
              penumbra: 0.8,
              color: 0xffdab4,
              intensity: 82,
              range: 17,
              radius: 0.9,
              volume: 0.4,
            },
      ); // (night r3) same warm-white head as the street lamps
  }
  return { group, spans };
}

function buildBridge(B, K) {
  const S = B.sec,
    dy = B.deckY;
  // ---- the road: Manhattan approach (apron + viaduct), main deck, far approach
  if (B.mLand !== null) manhattanApproach(B, K);
  const span = B.xB0 - B.xA1,
    side = span * (B.sideFrac ?? 0.21);
  const tx = [B.xA1 + side, B.xB0 - side];
  B._noLamp =
    B.style === "cantilever"
      ? null
      : (x) => tx.some((X) => Math.abs(x - X) < 17);
  roadway(B, K, B.xA0, B.xB1, dy, dy, { t: 1.8, special: true });
  farApproach(B, K);
  // ---- anchorages
  anchorage(B, K, B.xA0, B.xA1, 1);
  anchorage(B, K, B.xB0, B.xB1, -1);
  if (B.style === "cantilever") {
    buildCantilever(B, K);
    return;
  }
  // ---- towers
  const top = B.towerH,
    WY = G.WATER_Y,
    z = B.z;
  for (const X of tx) {
    const cw = (B.style === "stone" ? S.hw + 8 : S.zc + S.legHz) + 3;
    K.stone.box(X - 13, WY - 2, z - cw, X + 13, 7, z + cw); // caisson pier
    K.solids?.box(X - 13, WY - 2, z - cw, X + 13, 7, z + cw, "wall");
    if (B.style === "stone") stoneTower(B, K, X);
    else steelTower(B, K, X);
  }
  B.web = [tx[0], top + 2, z]; // the halfway yank web is drawn to the Manhattan tower top
  suspension(B, K, tx);
}

// ------------------------------------------------------------------ road deck
// roadway from xa to xb, top y linear ya..yb, slab thickness t: deck strips with markings, kerbs + railings, median,
// lamps, collision. special (main span only): Brooklyn promenade / Williamsburg tracks in the centre zone.
function roadway(
  B,
  K,
  xa,
  xb,
  ya,
  yb,
  { t = 1.5, special = false, lamps = true, girder = false } = {},
) {
  const S = B.sec,
    z = B.z,
    hw = S.hw,
    R = S.R,
    inner = S.inner,
    D = K.deck;
  const yAt = (x) => ya + ((yb - ya) * (x - xa)) / (xb - xa);
  const top = (l0, l1, mode, dyo = 0) => {
    // deck top strip between lateral l0 < l1
    D.ex = [inner, R, mode];
    for (let x = xa; x < xb - 0.01; x += 120) {
      const x1 = Math.min(xb, x + 120),
        y0 = yAt(x) + dyo,
        y1 = yAt(x1) + dyo;
      D.quad(
        [x, y0, z + l1],
        [x1, y1, z + l1],
        [x1, y1, z + l0],
        [x, y0, z + l0],
        [
          [x, l1],
          [x1, l1],
          [x1, l0],
          [x, l0],
        ],
      );
    }
  };
  // strips: edge walkways, road both sides (one strip over the centre when there is no median), centre zone
  top(-hw, -R, 4);
  top(R, hw, 4);
  if (inner < 0.3) top(-R, R, 1);
  else {
    top(-R, -inner, 1);
    top(inner, R, 1);
    if (inner < 1) top(-inner, inner, 4);
    else if (special && B.tracks) top(-inner, inner, 3);
    else if (!(special && B.style === "stone")) {
      // raised kerbed median island on the approaches
      top(-inner + 0.3, inner - 0.3, 4, 0.2);
      D.ex = [0, 0, 4];
      for (const s of [-1, 1]) {
        const zz = z + s * (inner - 0.3);
        D.sbox(
          xa,
          xb,
          yAt(xa),
          yAt(xb),
          0.2,
          Math.min(zz, zz - s * 0.01),
          Math.max(zz, zz - s * 0.01),
          { top: false },
        );
      }
      K.solids &&
        (ya === yb
          ? K.solids.box(
              xa,
              ya,
              z - inner + 0.3,
              xb,
              ya + 0.2,
              z + inner - 0.3,
              "roof",
            )
          : K.solids.ramp(
              xa,
              Math.min(ya, yb),
              z - inner + 0.3,
              xb,
              z + inner - 0.3,
              0,
              ya + 0.2,
              yb + 0.2,
              "roof",
              0,
              0.3,
            ));
    } else top(-inner, inner, 4);
  }
  // slab sides + underside (concrete)
  D.ex = [0, 0, 0];
  const ta = Math.min(t, Math.max(0.05, ya - G.CURB_H + 0.001)),
    tb = Math.min(t, Math.max(0.05, yb - G.CURB_H + 0.001));
  D.quad(
    [xa, ya - ta, z - hw],
    [xb, yb - tb, z - hw],
    [xb, yb - tb, z + hw],
    [xa, ya - ta, z + hw],
  );
  D.quad(
    [xa, ya - ta, z + hw],
    [xb, yb - tb, z + hw],
    [xb, yb, z + hw],
    [xa, ya, z + hw],
  );
  D.quad(
    [xb, yb - tb, z - hw],
    [xa, ya - ta, z - hw],
    [xa, ya, z - hw],
    [xb, yb, z - hw],
  );
  if (K.solids) {
    if (ya === yb) K.solids.box(xa, ya - t, z - hw, xb, ya, z + hw, "roof");
    else
      K.solids.ramp(
        xa,
        Math.min(ya, yb) - t,
        z - hw,
        xb,
        z + hw,
        0,
        ya,
        yb,
        "roof",
        0,
        t,
      );
  }
  // plate girders under the deck edges (steel spans over streets / the waterfront)
  if (girder)
    for (const s of [-1, 1]) {
      const zo = z + s * (hw - 0.2),
        zi = z + s * (hw - 1.1);
      K.steel.sbox(
        xa,
        xb,
        yAt(xa) - ta - 1.6,
        yAt(xb) - tb - 1.6,
        1.6,
        Math.min(zo, zi),
        Math.max(zo, zi),
        { bottom: true },
      );
    }
  // kerbs (concrete) + railings (lattice) along the road edges
  D.ex = [0, 0, 4];
  for (const s of [-1, 1]) {
    const z0 = s < 0 ? z - R - 0.45 : z + R,
      z1 = z0 + 0.45;
    D.sbox(xa, xb, yAt(xa), yAt(xb), 0.5, z0, z1);
    const zr = z + s * (R + 0.25),
      y0 = ya + 0.5,
      y1 = yb + 0.5,
      h = 1.05;
    {
      const lc = K.lat.col;
      K.lat.col = K.railCol;
      K.lat.quad(
        [xa, y0, zr],
        [xb, y1, zr],
        [xb, y1 + h, zr],
        [xa, y0 + h, zr],
        [
          [xa / 2, 2],
          [xb / 2, 2],
          [xb / 2, 3],
          [xa / 2, 3],
        ],
      );
      K.lat.col = lc;
    }
    if (K.solids) {
      if (ya === yb) K.solids.box(xa, ya, z0, xb, ya + 1.5, z1, "ledge");
      else
        K.solids.ramp(
          xa,
          Math.min(ya, yb),
          z0,
          xb,
          z1,
          0,
          ya + 1.5,
          yb + 1.5,
          "ledge",
          0,
          1.5,
        );
    }
  }
  // jersey median barrier
  if (inner > 0.3 && inner < 1) {
    D.ex = [0, 0, 4];
    D.sbox(xa, xb, yAt(xa), yAt(xb), 0.85, z - 0.28, z + 0.28);
    if (K.solids) {
      if (ya === yb)
        K.solids.box(xa, ya, z - 0.28, xb, ya + 0.85, z + 0.28, "ledge");
      else
        K.solids.ramp(
          xa,
          Math.min(ya, yb),
          z - 0.28,
          xb,
          z + 0.28,
          0,
          ya + 0.85,
          yb + 0.85,
          "ledge",
          0,
          0.85,
        );
    }
  }
  // Williamsburg-like: subway rails + track fences on the main span
  if (special && B.tracks) {
    K.steel.col = [0.2, 0.19, 0.18];
    for (const tz of [-2.3, 2.3])
      for (const r of [-0.72, 0.72])
        K.steel.box(
          xa,
          ya,
          z + tz + r - 0.04,
          xb,
          ya + 0.17,
          z + tz + r + 0.04,
          {},
        );
    for (const s of [-1, 1]) {
      const zf = z + s * (inner - 0.1);
      {
        const lc = K.lat.col;
        K.lat.col = K.railCol;
        K.lat.quad(
          [xa, ya, zf],
          [xb, yb, zf],
          [xb, yb + 2.2, zf],
          [xa, ya + 2.2, zf],
          [
            [xa / 2, 2],
            [xb / 2, 2],
            [xb / 2, 3],
            [xa / 2, 3],
          ],
        );
        K.lat.col = lc;
      }
      if (K.solids)
        K.solids.box(xa, ya, zf - 0.1, xb, ya + 2.2, zf + 0.1, "ledge");
    }
    const c = new THREE.Color(B.color);
    K.steel.col = [c.r, c.g, c.b];
  }
  if (lamps) roadwayLamps(B, K, xa + 18, xb, yAt);
}

// ------------------------------------------------------------------ masonry arcade (approach viaducts)
// solid stone body from yb to the deck underside yT(x) over [x0, x1], width 2 * hwA, with blind round arches (0.9 m
// reveals) on both long faces; exact collision = a ramp solid over the whole body
function arcade(K, x0, x1, yb, yT, z, hwA) {
  {
    // trim to where the deck underside is >= 0.4 m above the base (the ramp nose lands on its own)
    const f = (x) => yT(x) - yb - 0.4,
      f0 = f(x0),
      f1 = f(x1);
    if (f0 < 0 && f1 < 0) return;
    if (f0 < 0) x0 += ((x1 - x0) * -f0) / (f1 - f0);
    else if (f1 < 0) x1 -= ((x1 - x0) * -f1) / (f0 - f1);
  }
  if (x1 - x0 < 3) return;
  const y0 = yT(x0),
    y1 = yT(x1);
  const A = K.stone,
    back = hwA - 0.9;
  // core: recess back planes + end faces
  A.quad(
    [x0, yb, z + back],
    [x1, yb, z + back],
    [x1, y1, z + back],
    [x0, y0, z + back],
  );
  A.quad(
    [x1, yb, z - back],
    [x0, yb, z - back],
    [x0, y0, z - back],
    [x1, y1, z - back],
  );
  A.quad(
    [x0, yb, z - hwA],
    [x0, yb, z + hwA],
    [x0, y0, z + hwA],
    [x0, y0, z - hwA],
  );
  A.quad(
    [x1, yb, z + hwA],
    [x1, yb, z - hwA],
    [x1, y1, z - hwA],
    [x1, y1, z + hwA],
  );
  // arch frames (0.9 m deep) on both faces
  const shape = new THREE.Shape();
  shape.moveTo(x0, yb);
  shape.lineTo(x1, yb);
  shape.lineTo(x1, y1);
  shape.lineTo(x0, y0);
  shape.closePath();
  const bay = 11,
    n = Math.floor((x1 - x0 - 3) / bay);
  for (let i = 0; i < n; i++) {
    const xc = x0 + ((x1 - x0) * (i + 0.5)) / n,
      r = Math.min(3.6, ((x1 - x0) / n) * 0.34);
    const yl = Math.min(yT(xc - r), yT(xc + r)) - 1.6,
      spring = yl - r;
    if (spring - yb < 2.2) continue;
    const h = new THREE.Path();
    h.moveTo(xc - r, yb + 0.3);
    h.lineTo(xc + r, yb + 0.3);
    h.lineTo(xc + r, spring);
    for (let k = 1; k < 8; k++) {
      const a = (k / 8) * Math.PI;
      h.lineTo(xc + Math.cos(a) * r, spring + Math.sin(a) * r);
    }
    h.lineTo(xc - r, spring);
    h.closePath();
    shape.holes.push(h);
  }
  for (const s of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.9,
      bevelEnabled: false,
      curveSegments: 1,
    });
    const zb = s > 0 ? z + back : z - hwA;
    A.geom(
      g,
      (p) => [p[0], p[1], zb + p[2]],
      (q) => q,
    );
  }
  K.solids?.ramp(x0, yb, z - hwA, x1, z + hwA, 0, y0, y1, "wall");
}

// ------------------------------------------------------------------ Manhattan approach
function manhattanApproach(B, K) {
  const S = B.sec,
    z = B.z,
    hw = S.hw,
    ra = B.mLand,
    rb = B.xA0,
    yA = G.CURB_H,
    yB = B.deckY;
  const yAt = (x) => yA + ((yB - yA) * (x - ra)) / (rb - ra);
  // ---- at-grade apron from the street edge (per lateral line) to the ramp nose, road markings continued; registered
  // as a curb cut so street furniture / trees keep off it
  {
    const D = K.deck,
      J = B.mJoins,
      y = G.CURB_H + 0.012;
    D.ex = [S.inner, S.R, 1];
    for (let i = 0; i + 1 < J.length; i++) {
      const [la, xa] = J[i],
        [lb, xb] = J[i + 1];
      D.quad(
        [xb, y, z + lb],
        [ra, y, z + lb],
        [ra, y, z + la],
        [xa, y, z + la],
        [
          [xb, lb],
          [ra, lb],
          [ra, la],
          [xa, la],
        ],
      );
    }
    D.ex = [0, 0, 4]; // kerb returns along both apron sides
    for (const s of [-1, 1]) {
      const zz = z + s * (hw - 0.3),
        j = s < 0 ? J[0][1] : J[J.length - 1][1];
      D.box(
        j + 1.5,
        G.CURB_H,
        Math.min(zz, zz + s * 0.3),
        ra,
        G.CURB_H + 0.14,
        Math.max(zz, zz + s * 0.3),
      );
    }
    addCurbCut({ x0: B.mJoin - 1, z0: z - hw, x1: ra + 1, z1: z + hw });
  }
  // ---- supports: classify the ground under the viaduct along x: waterfront strip (promenade + highway) east of the
  // last block, block interiors (masonry arcade), everything else (streets, avenues, sidewalks) open steel spans
  const lines = [-1, -0.5, 0, 0.5, 1].map((t) => z + t * (hw - 0.8));
  const kindAt = (x) => {
    const ts = lines.map((zl) => streetsAt(x, zl).type);
    if (ts.every((t) => t === "block")) return "block";
    return "open";
  };
  let wf = rb; // waterfront zone: from the last block edge east of the landing to the seawall
  for (let x = rb - 1; x > ra; x -= 1) {
    if (lines.some((zl) => streetsAt(x, zl).type === "block")) break;
    wf = x;
  }
  const segs = [];
  let cur = null;
  for (let x = ra; x < wf; x += 1) {
    const k = kindAt(x);
    if (!cur || cur.k !== k) {
      cur = { k, x0: x, x1: x + 1 };
      segs.push(cur);
    } else cur.x1 = x + 1;
  }
  segs.push({ k: "wf", x0: wf, x1: rb });
  for (const sg of segs) {
    const xa = Math.max(ra, sg.x0),
      xb = Math.min(rb, sg.x1);
    roadway(B, K, xa, xb, yAt(xa), yAt(xb), {
      t: 1.5,
      girder: sg.k !== "block",
      lamps: false,
    });
    if (sg.k === "block")
      arcade(
        K,
        xa + 0.4,
        xb - 0.4,
        G.CURB_H,
        (x) => yAt(x) - 1.5,
        z,
        hw - 0.35,
      );
  }
  // lamps along the whole approach (one staggered run)
  roadwayLamps(B, K, ra + 8, rb, yAt);
  // ---- waterfront: slender steel bents on the promenade (never on the highway strip)
  const [, eS] = shoreX(z);
  const onHighway = (x) => {
    const d = eS - x;
    return d > 11 && d < 41;
  };
  for (let x = wf + 8; x < rb - 5; x += 26) {
    let xx = x;
    if (onHighway(xx)) continue;
    if (lines.some((zl) => onRoad(xx, zl))) continue;
    const yb = yAt(xx) - 1.5 - 1.6;
    if (yb < 4) continue;
    const g = G.CURB_H;
    for (const zc of [z - hw + 2.2, z + hw - 3.8]) {
      K.stone.box(xx - 1.3, g, zc - 0.3, xx + 1.3, g + 1.2, zc + 1.9);
      K.solids?.box(xx - 1.3, g, zc - 0.3, xx + 1.3, g + 1.2, zc + 1.9, "wall");
      K.steel.box(xx - 0.8, g + 1.2, zc, xx + 0.8, yb, zc + 1.6, {});
      K.solids?.box(xx - 0.8, g + 1.2, zc, xx + 0.8, yb, zc + 1.6, "pole");
    }
    K.steel.box(xx - 0.8, yb - 1.4, z - hw + 1.5, xx + 0.8, yb, z + hw - 1.5, {
      bottom: true,
    }); // cap beam
    K.solids?.box(
      xx - 0.8,
      yb - 1.4,
      z - hw + 1.5,
      xx + 0.8,
      yb,
      z + hw - 1.5,
      "wall",
    );
  }
  if (B.plazaArch) plazaArch(B, K);
}
function roadwayLamps(B, K, xa, xb, yAt) {
  const S = B.sec,
    z = B.z,
    steelCol = K.steel.col;
  for (let x = xa, i = 0; x < xb - 6; x += 38, i++) {
    if (B._noLamp && B._noLamp(x)) continue;
    const s = i % 2 ? 1 : -1,
      zp = z + s * (S.R + 0.22),
      y0 = yAt(x) + 0.5,
      yt = y0 + 8.6,
      hz = zp - s * 2.3;
    K.steel.col = [0.12, 0.13, 0.13];
    K.steel.box(x - 0.14, y0, zp - 0.14, x + 0.14, yt, zp + 0.14, {});
    K.steel.beam([x, yt - 0.1, zp], [x, yt + 0.25, hz], 0.14, [1, 0, 0]);
    K.steel.box(
      x - 0.45,
      yt - 0.02,
      hz - 0.25,
      x + 0.45,
      yt + 0.3,
      hz + 0.25,
      {},
    );
    K.steel.ex = [1, 0, 0];
    K.steel.quad(
      [x - 0.4, yt - 0.03, hz + 0.22],
      [x + 0.4, yt - 0.03, hz + 0.22],
      [x + 0.4, yt - 0.03, hz - 0.22],
      [x - 0.4, yt - 0.03, hz - 0.22],
    );
    K.steel.ex = [0, 0, 0];
    K.solids?.box(x - 0.14, y0, zp - 0.14, x + 0.14, yt, zp + 0.14, "pole");
    K.solids?.box(
      x - 0.45,
      yt - 0.02,
      hz - 0.25,
      x + 0.45,
      yt + 0.3,
      hz + 0.25,
      "pole",
    );
    if (yt - yAt(x) > 6) K.zips?.add(x, yt + 0.3, hz, 0, 1, 0, "lampTop");
    lampPool(K, x, yAt(x), hz, 5.2, yAt(x + 1) - yAt(x)); // (bridges r2)
    K.lamps?.push({ x, y: yt - 0.1, z: hz }); // (night)
  }
  K.steel.col = steelCol;
}
// Manhattan-Bridge-like triumphal arch over the approach plaza road + two colonnades flanking the plaza
function plazaArch(B, K) {
  const S = B.sec,
    z = B.z,
    hw = S.hw,
    g = G.CURB_H,
    xA = Math.min(B.mLand - 14, B.mJoin0 + 26),
    A = K.stone;
  const W = hw + 7,
    H = 27,
    ht = 3.2,
    span = S.R + 0.6,
    crown = 19; // half width, height, half thickness (x)
  const shape = new THREE.Shape();
  shape.moveTo(z - W, g);
  shape.lineTo(z + W, g);
  shape.lineTo(z + W, H);
  shape.lineTo(z - W, H);
  shape.closePath();
  const h = new THREE.Path(),
    spring = crown - span * 0.55;
  h.moveTo(z - span, g);
  h.lineTo(z + span, g);
  h.lineTo(z + span, spring);
  for (let k = 1; k < 12; k++) {
    const a = (k / 12) * Math.PI;
    h.lineTo(z + Math.cos(a) * span, spring + Math.sin(a) * span * 0.55);
  }
  h.lineTo(z - span, spring);
  h.closePath();
  shape.holes.push(h);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: ht * 2,
    bevelEnabled: false,
    curveSegments: 2,
  });
  A.geom(
    geo,
    (p) => [xA - ht + p[2], p[1], p[0]],
    (n) => [n[2], n[1], n[0]],
    true,
  );
  A.box(
    xA - ht - 0.8,
    H - 2.2,
    z - W - 0.8,
    xA + ht + 0.8,
    H - 1.2,
    z + W + 0.8,
  ); // cornice
  A.box(xA - ht + 0.4, H, z - W + 0.4, xA + ht - 0.4, H + 2.4, z + W - 0.4); // attic
  if (K.solids) {
    K.solids.box(xA - ht, g, z - W, xA + ht, H, z - span, "wall");
    K.solids.box(xA - ht, g, z + span, xA + ht, H, z + W, "wall");
    K.solids.box(xA - ht, crown, z - span, xA + ht, H, z + span, "wall");
    K.solids.box(
      xA - ht + 0.4,
      H,
      z - W + 0.4,
      xA + ht - 0.4,
      H + 2.4,
      z + W - 0.4,
      "roof",
    );
  }
  K.zips?.add(xA - ht + 0.9, H + 2.4, z - W + 0.9, -0.7, 0, -0.7, "roofCorner");
  K.zips?.add(xA + ht - 0.9, H + 2.4, z + W - 0.9, 0.7, 0, 0.7, "roofCorner");
  K.boxes?.push({ min: [xA - ht, g, z - W], max: [xA + ht, H + 2.4, z + W] });
  // colonnades: a row of columns with an entablature on each side of the plaza, east of the arch
  for (const s of [-1, 1]) {
    const zc = z + s * (hw + 4.5),
      xa = xA + ht + 4,
      xb = Math.min(B.mLand + 20, xa + 44);
    for (let x = xa; x <= xb; x += 4.4) {
      A.column(x, zc, g, g + 12, 0.75);
      K.solids?.cyl(x, zc, g, g + 12, 0.75, 0.75, "wall");
    }
    A.box(xa - 1, g + 12, zc - 1.1, xb + 1, g + 14, zc + 1.1);
    K.solids?.box(xa - 1, g + 12, zc - 1.1, xb + 1, g + 14, zc + 1.1, "roof");
    A.box(xa - 1.2, g, zc - 1.3, xb + 1.2, g + 0.5, zc + 1.3);
  }
}

// ------------------------------------------------------------------ far approach (arcade viaduct down to the far ground)
function farApproach(B, K) {
  const ra = B.xB1,
    rb = B.rampX1,
    yA = B.deckY,
    yB = FAR_Y,
    z = B.z,
    hw = B.sec.hw;
  const yAt = (x) => yA + ((yB - yA) * (x - ra)) / (rb - ra);
  // spans over far-shore cross streets every ~120 m and the Flushing-Line-like el (farshore.js RAIL, x = 1450)
  const gaps = [];
  for (let x = ra + 60; x < rb - 60; x += 118) gaps.push([x, x + 16]);
  gaps.push([1440, 1462]);
  const cuts = [ra, rb, ...gaps.flat()]
    .filter((x) => x >= ra && x <= rb)
    .sort((a, b) => a - b);
  for (let i = 0; i + 1 < cuts.length; i++) {
    const xa = cuts[i],
      xb = cuts[i + 1];
    if (xb - xa < 0.5) continue;
    const isGap = gaps.some(([a, b]) => xa >= a - 0.01 && xb <= b + 0.01);
    roadway(B, K, xa, xb, yAt(xa), yAt(xb), {
      t: 2.0,
      girder: isGap,
      lamps: false,
    });
    if (!isGap)
      arcade(K, xa + 0.4, xb - 0.4, FAR_Y, (x) => yAt(x) - 2.0, z, hw - 0.35);
  }
  roadwayLamps(B, K, ra + 20, rb - 10, yAt);
  // (bridges r2) far landing: the road continues at grade into the far-shore corridor, flanked by two stone pylons
  // with lamp standards (the landing is in view from the mid-span)
  const S = B.sec,
    D = K.deck,
    y = FAR_Y + 0.012,
    xe = rb + 18;
  D.ex = [S.inner, S.R, 1];
  D.quad(
    [rb, y, z + S.R],
    [xe, y, z + S.R],
    [xe, y, z - S.R],
    [rb, y, z - S.R],
    [
      [rb, S.R],
      [xe, S.R],
      [xe, -S.R],
      [rb, -S.R],
    ],
  );
  D.ex = [0, 0, 4];
  for (const s of [-1, 1]) {
    const za = z + s * S.R,
      zb = z + s * (S.R + 2.5);
    D.quad(
      [rb, y + 0.15, Math.max(za, zb)],
      [xe, y + 0.15, Math.max(za, zb)],
      [xe, y + 0.15, Math.min(za, zb)],
      [rb, y + 0.15, Math.min(za, zb)],
      [
        [rb, 0],
        [xe, 0],
        [xe, 1],
        [rb, 1],
      ],
    );
  }
  for (const s of [-1, 1]) {
    const zc = z + s * (hw + 2.2),
      x0 = rb - 6,
      A = K.stone;
    A.box(x0 - 2.4, FAR_Y, zc - 2.4, x0 + 2.4, FAR_Y + 1.4, zc + 2.4);
    A.box(x0 - 1.8, FAR_Y + 1.4, zc - 1.8, x0 + 1.8, FAR_Y + 10, zc + 1.8);
    A.box(x0 - 2.2, FAR_Y + 10, zc - 2.2, x0 + 2.2, FAR_Y + 10.8, zc + 2.2);
    for (let yy = FAR_Y + 3; yy < FAR_Y + 9.5; yy += 1.8)
      A.box(x0 - 1.95, yy, zc - 1.95, x0 + 1.95, yy + 0.35, zc + 1.95, {
        top: false,
      });
    K.solids?.box(
      x0 - 2.4,
      FAR_Y,
      zc - 2.4,
      x0 + 2.4,
      FAR_Y + 10.8,
      zc + 2.4,
      "wall",
    );
    {
      const col = K.steel.col,
        yt = FAR_Y + 10.8;
      K.steel.col = [0.08, 0.09, 0.08]; // lantern on the pylon
      K.steel.box(x0 - 0.5, yt, zc - 0.5, x0 + 0.5, yt + 0.4, zc + 0.5, {});
      K.steel.ex = [1, 0, 0];
      K.steel.box(
        x0 - 0.4,
        yt + 0.4,
        zc - 0.4,
        x0 + 0.4,
        yt + 1.6,
        zc + 0.4,
        {},
      );
      K.steel.ex = [0, 0, 0];
      K.steel.box(
        x0 - 0.55,
        yt + 1.6,
        zc - 0.55,
        x0 + 0.55,
        yt + 1.9,
        zc + 0.55,
        {},
      );
      K.steel.col = col;
    }
  }
}

// ------------------------------------------------------------------ anchorages
// massive stone block in the water off the seawall under the deck, masonry side towers above the deck (outside the
// road) where the main cables enter, cornices; Brooklyn: a low cable housing in the median for the inner cables
// ornamental lamp standards on the kerbs across an anchorage (twin globes on a fluted post), with night pools
function anchorLamps(B, K, a0, a1, y0, lz) {
  const z = B.z,
    col = K.steel.col;
  for (const x of [a0 + 6, (a0 + a1) / 2, a1 - 6])
    for (const s of [-1, 1]) {
      const zp = z + s * lz,
        yt = y0 + 5.2;
      K.steel.col = [0.08, 0.09, 0.08];
      K.steel.box(x - 0.25, y0, zp - 0.25, x + 0.25, y0 + 0.9, zp + 0.25, {});
      K.steel.box(x - 0.13, y0 + 0.9, zp - 0.13, x + 0.13, yt, zp + 0.13, {});
      K.steel.box(
        x - 0.9,
        yt - 0.1,
        zp - 0.08,
        x + 0.9,
        yt + 0.05,
        zp + 0.08,
        {},
      );
      K.steel.ex = [1, 0, 0];
      for (const dx of [-0.8, 0.8])
        K.steel.box(
          x + dx - 0.2,
          yt + 0.05,
          zp - 0.2,
          x + dx + 0.2,
          yt + 0.55,
          zp + 0.2,
          {},
        );
      K.steel.ex = [0, 0, 0];
      K.solids?.box(x - 0.35, y0, zp - 0.35, x + 0.35, yt, zp + 0.35, "pole");
      lampPool(K, x, y0 - 0.44, zp - s * 1.2, 4.2);
      K.lamps?.push({ x, y: yt + 0.3, z: zp, globe: true }); // (night) one light for the twin globes
    }
  K.steel.col = col;
}
// warm light pool decal on the deck under a lamp (additive, night only: bridges' lampPools mesh)
function lampPool(K, x, y, z, r, g = 0) {
  // g: deck grade along x (the decal follows ramps)
  const ya = y + 0.07 - g * r,
    yb = y + 0.07 + g * r;
  K.pool.quad(
    [x - r, ya, z + r],
    [x + r, yb, z + r],
    [x + r, yb, z - r],
    [x - r, ya, z - r],
    [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ],
  );
}
function anchorage(B, K, a0, a1, dir) {
  const S = B.sec,
    z = B.z,
    hw = S.hw,
    dy = B.deckY,
    WY = G.WATER_Y,
    A = K.stone;
  const wz = Math.max(hw + 5, (S.zc ?? 0) + (S.legHz ?? 0) + 3);
  A.box(a0, WY - 2, z - wz, a1, dy - 1.8, z + wz);
  K.solids?.box(a0, WY - 2, z - wz, a1, dy - 1.8, z + wz, "wall");
  // step courses near the waterline
  A.box(a0 - 1.2, WY - 2, z - wz - 1.2, a1 + 1.2, 3.5, z + wz + 1.2);
  K.solids?.box(
    a0 - 1.2,
    WY - 2,
    z - wz - 1.2,
    a1 + 1.2,
    3.5,
    z + wz + 1.2,
    "wall",
  );
  // (bridges r2) masonry detail: rusticated bands (projecting courses every 3.2 m), corner pilasters, a coping band at
  // deck level (both ends: the far anchorage is in full view from the mid-span)
  for (let y = 6.5; y < dy - 5; y += 3.2)
    A.box(a0 - 0.35, y, z - wz - 0.35, a1 + 0.35, y + 0.55, z + wz + 0.35, {
      top: false,
    });
  for (const xc of [a0, a1])
    for (const zc of [z - wz, z + wz])
      A.box(xc - 1.4, 3.5, zc - 1.4, xc + 1.4, dy - 2.4, zc + 1.4, {
        top: false,
      });
  A.box(a0 - 0.9, dy - 2.9, z - wz - 0.9, a1 + 0.9, dy - 1.8, z + wz + 0.9);
  K.solids?.box(
    a0 - 0.9,
    dy - 2.9,
    z - wz - 0.9,
    a1 + 0.9,
    dy - 1.8,
    z + wz + 0.9,
    "cornice",
  );
  if (B.style === "cantilever") {
    anchorLamps(B, K, a0, a1, dy + 0.5, S.R + 0.2);
    return;
  }
  const hTop = dy + 11;
  for (const s of [-1, 1]) {
    const zi = z + s * (S.R + 0.5),
      zo = z + s * wz,
      za = Math.min(zi, zo),
      zb = Math.max(zi, zo);
    A.box(a0 + 2, dy - 1.8, za, a1 - 2, hTop, zb);
    A.box(a0 + 1.2, hTop - 0.6, za - 0.8, a1 - 1.2, hTop + 0.8, zb + 0.8); // cornice
    A.box(a0 + 2.6, hTop + 0.8, za + 0.6, a1 - 2.6, hTop + 1.8, zb - 0.6); // parapet cap
    K.solids?.box(a0 + 2, dy - 1.8, za, a1 - 2, hTop, zb, "wall");
    K.solids?.box(
      a0 + 1.2,
      hTop - 0.6,
      za - 0.8,
      a1 - 1.2,
      hTop + 0.8,
      zb + 0.8,
      "cornice",
    );
    K.solids?.box(
      a0 + 2.6,
      hTop + 0.8,
      za + 0.6,
      a1 - 2.6,
      hTop + 1.8,
      zb - 0.6,
      "roof",
    );
    K.boxes?.push({
      min: [a0 + 2, dy - 1.8, za],
      max: [a1 - 2, hTop + 1.8, zb],
    });
    K.zips?.add(
      a0 + 3.2,
      hTop + 1.8,
      s < 0 ? za + 1.2 : zb - 1.2,
      -0.7,
      0,
      s * 0.7,
      "roofCorner",
    );
    K.zips?.add(
      a1 - 3.2,
      hTop + 1.8,
      s < 0 ? za + 1.2 : zb - 1.2,
      0.7,
      0,
      s * 0.7,
      "roofCorner",
    );
    // rusticated bands + pilaster strips on the side towers, a sunk panel line under the cornice
    for (let y = dy + 1.2; y < hTop - 2; y += 2.6)
      A.box(a0 + 1.75, y, za - 0.25, a1 - 1.75, y + 0.45, zb + 0.25, {
        top: false,
      });
    for (const xc of [a0 + 2, a1 - 2])
      A.box(xc - 0.9, dy - 1.8, za - 0.5, xc + 0.9, hTop - 0.6, zb + 0.5, {
        top: false,
      });
  }
  anchorLamps(B, K, a0, a1, dy + 0.5, S.R + 0.2);
  if (B.style === "stone") {
    // inner-cable housing in the median (the promenade ramps down before it)
    const xa = dir > 0 ? a1 - 14 : a0 + 4,
      xb = dir > 0 ? a1 - 4 : a0 + 14;
    A.box(xa, dy + 0.2, z - S.inner + 0.4, xb, dy + 4, z + S.inner - 0.4);
    K.solids?.box(
      xa,
      dy + 0.2,
      z - S.inner + 0.4,
      xb,
      dy + 4,
      z + S.inner - 0.4,
      "wall",
    );
  }
}

// ------------------------------------------------------------------ suspension spans (towers built already)
function suspension(B, K, tx) {
  const S = B.sec,
    z = B.z,
    dy = B.deckY,
    top = B.towerH,
    hw = S.hw;
  const stone = B.style === "stone";
  // ---- main cables: side spans (anchorage -> tower top) and main span (sagging parabola)
  let xE0 = B.xA1 - 3,
    xE1 = B.xB0 + 3; // cables enter the anchorage side towers (Brooklyn inner: the median housing)
  const cabY = (x, yAnch, ySag) => {
    const yTop = top + 0.4;
    if (x <= tx[0]) {
      const t = (x - xE0) / (tx[0] - xE0);
      return yAnch + (yTop - yAnch) * t - 6 * t * (1 - t);
    }
    if (x >= tx[1]) {
      const t = (xE1 - x) / (xE1 - tx[1]);
      return yAnch + (yTop - yAnch) * t - 6 * t * (1 - t);
    }
    const t = (x - tx[0]) / (tx[1] - tx[0]);
    return ySag + (yTop - ySag) * (2 * t - 1) ** 2;
  };
  const rC = stone ? 0.8 : 1.0;
  for (const c of S.cz) {
    const innerC = stone && Math.abs(c) < S.inner;
    const yAnch = innerC ? dy + 3 : dy + 7,
      ySag = innerC ? dy + 6.8 : dy + 2.6,
      zz = z + c;
    xE0 = innerC ? B.xA1 - 8 : B.xA1 - 3;
    xE1 = innerC ? B.xB0 + 8 : B.xB0 + 3;
    const cy = (x) => cabY(x, yAnch, ySag);
    const pts = [];
    for (let x = xE0; x < xE1; x += 6) pts.push([x, cy(x), zz]);
    pts.push([xE1, cy(xE1), zz]);
    K.cable.ex = [1, 0, 0];
    K.cable.tube(pts, rC, 6);
    K.cable.ex = [0, 0, 0]; // necklace lights on the main cables only
    // collision (a thin ramp slab along the cable top: run up a cable, stand on it) + perch points + anchor boxes
    for (let i = 0; i + 1 < pts.length; i++) {
      const [xa, ya] = pts[i],
        [xb, yb] = pts[i + 1];
      K.solids?.ramp(
        xa,
        Math.min(ya, yb) - rC,
        zz - rC * 0.75,
        xb,
        zz + rC * 0.75,
        0,
        ya + rC,
        yb + rC,
        "ledge",
        0,
        rC * 1.6,
      );
      if (i % 2 === 0 && K.boxes && ya - dy > 12) {
        const q = pts[Math.min(pts.length - 1, i + 2)];
        K.boxes.push({
          min: [xa, Math.min(ya, q[1]) - rC, zz - rC],
          max: [q[0], Math.max(ya, q[1]) + rC, zz + rC],
        });
      }
      if (i % 3 === 1 && ya - dy > 7 && tx.every((X) => Math.abs(xa - X) > 14))
        K.zips?.add((xa + xb) / 2, (ya + yb) / 2 + rC, zz, 0, 1, 0, "pole");
    }
    // suspenders down to the deck edge girder (the promenade edge for the Brooklyn inner cables)
    const yDeck = innerC ? dy + 4.8 : dy + 0.2;
    for (let x = B.xA1 + 6; x < B.xB0 - 4; x += 7.5) {
      if (tx.some((X) => Math.abs(x - X) < 13)) continue;
      const yc = cy(x);
      if (yc - yDeck > 1.2)
        K.cable.beam(
          [x, yDeck, zz],
          [x, yc - rC, zz],
          stone ? 0.14 : 0.18,
          [0, 0, 1],
        );
    }
    // Brooklyn-like diagonal stays: fan from each tower top down to the deck / promenade edges
    if (stone)
      for (const X of tx)
        for (const dir of [-1, 1])
          for (let k = 1; k <= 13; k++) {
            const xd = X + dir * (12 + k * 10.5);
            if (xd < B.xA1 + 4 || xd > B.xB0 - 4) continue;
            K.cable.beam(
              [X + dir * 9, top - 6 - k * 0.7, zz],
              [xd, yDeck + 0.1, zz],
              0.12,
              [0, 0, 1],
            );
          }
  }
  // ---- stiffening truss under the deck between the anchorages (lattice sides) + cross beams + solid chords
  const x0 = B.xA1 - 1.5,
    x1 = B.xB0 + 1.5;
  const depth = stone ? 4.6 : 9.0,
    panel = stone ? 5.0 : 7.5;
  for (const s of [-1, 1]) {
    const zz = z + s * (hw - 0.4),
      u0 = x0 / panel,
      u1 = x1 / panel;
    K.lat.quad(
      [x0, dy - 1.8 - depth, zz],
      [x1, dy - 1.8 - depth, zz],
      [x1, dy - 1.8, zz],
      [x0, dy - 1.8, zz],
      [
        [u0, 0],
        [u1, 0],
        [u1, 1],
        [u0, 1],
      ],
    );
  }
  for (let x = x0 + 4; x < x1; x += panel * 2)
    K.steel.box(
      x - 0.3,
      dy - 1.8 - depth,
      z - hw + 0.4,
      x + 0.3,
      dy - 1.8 - depth + 0.6,
      z + hw - 0.4,
      {},
    );
  for (const s of [-1, 1]) {
    const zo = z + s * (hw + 0.05),
      zi = z + s * (hw - 0.9),
      za = Math.min(zo, zi),
      zb = Math.max(zo, zi);
    K.steel.box(x0, dy - 2.9, za, x1, dy + 0.05, zb, { bottom: true }); // deck-level plate-girder fascia
    K.steel.box(x0, dy - 1.8 - depth, za, x1, dy - 1.8 - depth + 1.3, zb, {
      bottom: true,
    }); // bottom chord
    K.solids?.box(x0, dy - 2.9, za, x1, dy + 0.05, zb, "ledge");
    K.solids?.box(
      x0,
      dy - 1.8 - depth,
      za,
      x1,
      dy - 1.8 - depth + 1.3,
      zb,
      "wall",
    );
  }
  if (stone) brooklynPromenade(B, K, tx);
}

// Brooklyn-like raised timber promenade over the median: posts + cross beams, railings, ramps down at both ends, forks
// round each tower's centre pier (the fork runs over the inner lanes, 4.3 m clear)
function brooklynPromenade(B, K, tx) {
  const S = B.sec,
    z = B.z,
    dy = B.deckY,
    yP = dy + 4.8,
    ph = S.inner - 0.9,
    D = K.deck;
  const xs = B.xA1 + 8,
    xe = B.xB0 - 8,
    ramp = 48; // ramps from deck level up to the promenade
  const tw = 10.5 + 7,
    tp = 10.6; // fork half length round a tower / tower half thickness (+ margin)
  const pieces = []; // [xa, xb, ya, yb, l0, l1, posts]
  const run = (xa, xb, l0, l1, posts = true) =>
    pieces.push([xa, xb, yP, yP, l0, l1, posts]);
  pieces.push(
    [xs, xs + ramp, dy + 0.2, yP, -ph, ph, true],
    [xe - ramp, xe, yP, dy + 0.2, -ph, ph, true],
  );
  let x = xs + ramp;
  for (const X of tx) {
    // narrow run, a wide landing, the two forks past the pier (over the inner lanes), a wide landing
    run(x, X - tw, -ph, ph);
    run(X - tw, X - tp, -7.4, 7.4, false);
    run(X - tp, X + tp, -7.4, -3.9, false);
    run(X - tp, X + tp, 3.9, 7.4, false);
    run(X + tp, X + tw, -7.4, 7.4, false);
    x = X + tw;
  }
  run(x, xe - ramp, -ph, ph);
  const col = K.steel.col;
  for (const [xa, xb, ya, yb, l0, l1, posts] of pieces) {
    if (xb - xa < 0.5) continue;
    D.ex = [0, 0, 2];
    const t = 0.45;
    D.quad(
      [xa, ya, z + l1],
      [xb, yb, z + l1],
      [xb, yb, z + l0],
      [xa, ya, z + l0],
      [
        [xa, l1],
        [xb, l1],
        [xb, l0],
        [xa, l0],
      ],
    );
    D.ex = [0, 0, 0];
    D.quad(
      [xa, ya - t, z + l0],
      [xb, yb - t, z + l0],
      [xb, yb - t, z + l1],
      [xa, ya - t, z + l1],
    );
    D.quad(
      [xa, ya - t, z + l1],
      [xb, yb - t, z + l1],
      [xb, yb, z + l1],
      [xa, ya, z + l1],
    );
    D.quad(
      [xb, yb - t, z + l0],
      [xa, ya - t, z + l0],
      [xa, ya, z + l0],
      [xb, yb, z + l0],
    );
    if (K.solids) {
      if (ya === yb) K.solids.box(xa, ya - t, z + l0, xb, ya, z + l1, "roof");
      else
        K.solids.ramp(
          xa,
          Math.min(ya, yb) - t,
          z + l0,
          xb,
          z + l1,
          0,
          ya,
          yb,
          "roof",
          0,
          t,
        );
    }
    // railings on both edges + posts / cross beams down to the deck
    for (const l of [l0 + 0.1, l1 - 0.1]) {
      {
        const lc = K.lat.col;
        K.lat.col = K.railCol;
        K.lat.quad(
          [xa, ya, z + l],
          [xb, yb, z + l],
          [xb, yb + 1.15, z + l],
          [xa, ya + 1.15, z + l],
          [
            [xa / 2, 2],
            [xb / 2, 2],
            [xb / 2, 3],
            [xa / 2, 3],
          ],
        );
        K.lat.col = lc;
      }
      if (K.solids) {
        if (ya === yb)
          K.solids.box(
            xa,
            ya,
            z + l - 0.08,
            xb,
            ya + 1.15,
            z + l + 0.08,
            "ledge",
          );
        else
          K.solids.ramp(
            xa,
            Math.min(ya, yb),
            z + l - 0.08,
            xb,
            z + l + 0.08,
            0,
            ya + 1.15,
            yb + 1.15,
            "ledge",
            0,
            1.15,
          );
      }
    }
    K.steel.col = K.railCol;
    for (let px = xa + 3; posts && px < xb - 1; px += 7.5) {
      const yy = ya + ((yb - ya) * (px - xa)) / (xb - xa) - t;
      if (yy - dy < 1) continue;
      for (const l of [l0 + 0.3, l1 - 0.3]) {
        K.steel.box(px - 0.2, dy, z + l - 0.2, px + 0.2, yy, z + l + 0.2, {});
        K.solids?.box(
          px - 0.2,
          dy,
          z + l - 0.2,
          px + 0.2,
          yy,
          z + l + 0.2,
          "pole",
        );
      }
      K.steel.box(px - 0.25, yy - 0.5, z + l0, px + 0.25, yy, z + l1, {
        bottom: true,
      });
    }
    K.steel.col = col;
  }
}

// Brooklyn-like granite tower: two pointed arches for the roadways (the promenade forks round the centre pier), cornice,
// cable saddles; collision = three piers + the solid upper part
function stoneTower(B, K, X) {
  const S = B.sec,
    z = B.z,
    dy = B.deckY,
    top = B.towerH,
    A = K.stone;
  const tx = 10.5,
    W = S.hw + 8; // half thickness (x), half width (z)
  const base = 7,
    archBot = dy - 1.0,
    archTop = dy + (top - dy) * 0.52;
  const pierIn = 3.6,
    archOut = S.R + 1.4,
    aw = (archOut - pierIn) / 2; // arch half-width
  const centers = [z - pierIn - aw, z + pierIn + aw];
  const shape = new THREE.Shape();
  shape.moveTo(z - W, base);
  shape.lineTo(z + W, base);
  shape.lineTo(z + W, top);
  shape.lineTo(z - W, top);
  shape.closePath();
  for (const c of centers) {
    const h = new THREE.Path();
    const r = aw * 1.6,
      spring = archTop - Math.sqrt(r * r - (r - aw) ** 2);
    h.moveTo(c - aw, archBot);
    h.lineTo(c + aw, archBot);
    h.lineTo(c + aw, spring);
    const n = 10;
    for (let i = 1; i <= n; i++) {
      const yy =
        spring + (archTop - spring) * Math.sin(((i / n) * Math.PI) / 2);
      h.lineTo(
        c + aw - r + Math.sqrt(Math.max(0, r * r - (yy - spring) ** 2)),
        yy,
      );
    }
    for (let i = n - 1; i >= 0; i--) {
      const yy =
        spring + (archTop - spring) * Math.sin(((i / n) * Math.PI) / 2);
      h.lineTo(
        c - aw + r - Math.sqrt(Math.max(0, r * r - (yy - spring) ** 2)),
        yy,
      );
    }
    h.closePath();
    shape.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: tx * 2,
    bevelEnabled: false,
    curveSegments: 4,
  });
  // shape x -> world z, shape y -> world y, extrude (+z) -> world x; the axis swap mirrors: flip the winding
  A.geom(
    g,
    (p) => [X - tx + p[2], p[1], p[0]],
    (n) => [n[2], n[1], n[0]],
    true,
  );
  // cornice + cap, buttress pilasters, a string course at the arch spring, cable saddles
  A.box(
    X - tx - 0.8,
    top - 3,
    z - W - 0.8,
    X + tx + 0.8,
    top - 1.8,
    z + W + 0.8,
  );
  A.box(X - tx + 0.6, top, z - W + 0.6, X + tx - 0.6, top + 2.2, z + W - 0.6);
  A.box(
    X - tx - 0.5,
    archTop + 1,
    z - W - 0.5,
    X + tx + 0.5,
    archTop + 1.8,
    z + W + 0.5,
  );
  for (const zz of [z - W - 1.2, z + W - 0.2])
    A.box(X - tx - 0.6, base, zz, X + tx + 0.6, archTop, zz + 1.4);
  for (const c of S.cz)
    A.box(X - 4, top + 2.2, z + c - 1.4, X + 4, top + 3.4, z + c + 1.4);
  if (K.solids) {
    K.solids.box(X - tx, base, z - W, X + tx, archTop, centers[0] - aw, "wall");
    K.solids.box(
      X - tx,
      base,
      centers[0] + aw,
      X + tx,
      archTop,
      centers[1] - aw,
      "wall",
    );
    K.solids.box(X - tx, base, centers[1] + aw, X + tx, archTop, z + W, "wall");
    K.solids.box(X - tx, archTop, z - W, X + tx, top, z + W, "wall");
    K.solids.box(
      X - tx + 0.6,
      top,
      z - W + 0.6,
      X + tx - 0.6,
      top + 2.2,
      z + W - 0.6,
      "roof",
    );
  }
  K.boxes?.push({
    min: [X - tx, base, z - W],
    max: [X + tx, top + 2.2, z + W],
  });
  K.zips?.add(
    X - tx + 0.7,
    top + 2.2,
    z - W + 0.7,
    -0.7,
    0,
    -0.7,
    "roofCorner",
  );
  K.zips?.add(X + tx - 0.7, top + 2.2, z + W - 0.7, 0.7, 0, 0.7, "roofCorner");
  K.zips?.add(X - tx + 0.7, top + 2.2, z + W - 0.7, -0.7, 0, 0.7, "roofCorner");
  K.zips?.add(X + tx - 0.7, top + 2.2, z - W + 0.7, 0.7, 0, -0.7, "roofCorner");
}

// steel tower: two legs on the cable planes (outside the road), portals (one clear over the road), X bracing
// (arch / lattice variants), saddle houses on the leg tops
function steelTower(B, K, X) {
  const S = B.sec,
    z = B.z,
    dy = B.deckY,
    top = B.towerH,
    A = K.steel,
    kind = B.tower ?? "arch";
  const lx = 5.2,
    lz = S.legHz,
    zl = [z - S.zc, z + S.zc],
    lat = kind === "lattice";
  for (const zc of zl) {
    if (lat) {
      // open lattice leg: 4 corner posts + lattice faces
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ])
        A.box(
          X + sx * lx - 0.8,
          7,
          zc + sz * lz - 0.8,
          X + sx * lx + 0.8,
          top,
          zc + sz * lz + 0.8,
        );
      const pu = 6,
        L = K.lat;
      for (const sx of [-1, 1])
        L.quad(
          [X + sx * lx, 7, zc - lz],
          [X + sx * lx, 7, zc + lz],
          [X + sx * lx, top, zc + lz],
          [X + sx * lx, top, zc - lz],
          [
            [7 / pu, 0],
            [7 / pu, 1],
            [top / pu, 1],
            [top / pu, 0],
          ].map(([u, v]) => [u, v]),
        );
      for (const sz of [-1, 1])
        L.quad(
          [X - lx, 7, zc + sz * lz],
          [X + lx, 7, zc + sz * lz],
          [X + lx, top, zc + sz * lz],
          [X - lx, top, zc + sz * lz],
          [
            [7 / pu, 0],
            [7 / pu, 1],
            [top / pu, 1],
            [top / pu, 0],
          ],
        );
    } else {
      const yS = dy + (top - dy) * 0.55; // setback: heavier lower shaft
      A.box(X - lx - 0.7, 7, zc - lz - 0.5, X + lx + 0.7, yS, zc + lz + 0.5);
      A.box(X - lx, yS, zc - lz, X + lx, top, zc + lz);
      for (const s of [-1, 1])
        A.box(
          X + s * (lx + 0.7) - 0.3,
          7,
          zc - lz * 0.35,
          X + s * (lx + 0.7) + 0.3,
          yS,
          zc + lz * 0.35,
          { top: false },
        ); // ribs
      for (const s of [-1, 1])
        A.box(
          X + s * lx - 0.25,
          yS,
          zc - lz * 0.35,
          X + s * lx + 0.25,
          top,
          zc + lz * 0.35,
          { top: false },
        );
    }
    A.box(
      X - lx - 0.6,
      top,
      zc - lz - 0.6,
      X + lx + 0.6,
      top + 3,
      zc + lz + 0.6,
    ); // saddle house
    A.box(
      X - lx - 1.0,
      top + 3,
      zc - lz - 1.0,
      X + lx + 1.0,
      top + 3.6,
      zc + lz + 1.0,
    );
    K.solids?.box(
      X - lx - 0.7,
      7,
      zc - lz - 0.5,
      X + lx + 0.7,
      top,
      zc + lz + 0.5,
      "wall",
    );
    K.solids?.box(
      X - lx - 1.0,
      top,
      zc - lz - 1.0,
      X + lx + 1.0,
      top + 3.6,
      zc + lz + 1.0,
      "roof",
    );
    K.boxes?.push({
      min: [X - lx - 0.7, 7, zc - lz - 0.5],
      max: [X + lx + 0.7, top + 3.6, zc + lz + 0.5],
    });
    K.zips?.add(
      X - lx - 0.5,
      top + 3.6,
      zc - lz - 0.5,
      -0.7,
      0,
      -0.7,
      "roofCorner",
    );
    K.zips?.add(
      X + lx + 0.5,
      top + 3.6,
      zc + lz + 0.5,
      0.7,
      0,
      0.7,
      "roofCorner",
    );
    K.zips?.add(
      X + lx + 0.5,
      top + 3.6,
      zc - lz - 0.5,
      0.7,
      0,
      -0.7,
      "roofCorner",
    );
    K.zips?.add(
      X - lx - 0.5,
      top + 3.6,
      zc + lz + 0.5,
      -0.7,
      0,
      0.7,
      "roofCorner",
    );
  }
  const zi0 = zl[0] + lz,
    zi1 = zl[1] - lz,
    mid = dy + (top - dy) * 0.5;
  const portals =
    kind === "deco"
      ? [dy - 9, dy + 9, mid + 8, top - 4]
      : [dy - 9, dy + 9, mid, top - 4];
  for (const y of portals) {
    if (lat) {
      for (const s of [-1, 1])
        K.lat.quad(
          [X + s * lx * 0.8, y - 2.6, zi0],
          [X + s * lx * 0.8, y - 2.6, zi1],
          [X + s * lx * 0.8, y + 2.6, zi1],
          [X + s * lx * 0.8, y + 2.6, zi0],
          [
            [zi0 / 5, 0],
            [zi1 / 5, 0],
            [zi1 / 5, 1],
            [zi0 / 5, 1],
          ],
        );
      for (const yy of [y - 2.6, y + 2.6])
        A.box(X - lx * 0.8, yy - 0.5, zi0, X + lx * 0.8, yy + 0.5, zi1);
    } else A.box(X - lx * 0.8, y - 2.2, zi0, X + lx * 0.8, y + 2.2, zi1);
    K.solids?.box(
      X - lx * 0.8,
      y - 2.4,
      zi0,
      X + lx * 0.8,
      y + 2.4,
      zi1,
      "ledge",
    );
    if (y > dy)
      K.boxes?.push({
        min: [X - lx * 0.8, y - 2.4, zi0],
        max: [X + lx * 0.8, y + 2.4, zi1],
      });
  }
  // X bracing between the upper portals (both faces): never below the road clearance portal
  if (kind !== "deco") {
    const lv = [dy + 11.5, mid - 2.4, mid + 2.4, top - 6.4];
    for (const xf of [X - lx * 0.7, X + lx * 0.7])
      for (let i = 0; i + 1 < lv.length; i += 2) {
        if (kind === "arch" && i > 0) continue; // the crown arch fills the upper panel
        A.beam(
          [xf, lv[i], zi0],
          [xf, lv[i + 1], zi1],
          lat ? 1.1 : 1.5,
          [1, 0, 0],
        );
        A.beam(
          [xf, lv[i], zi1],
          [xf, lv[i + 1], zi0],
          lat ? 1.1 : 1.5,
          [1, 0, 0],
        );
      }
  } else {
    // deco: a pair of slim vertical fins on the leg faces + stepped crown
    for (const zc of zl)
      A.box(
        X - lx - 1.2,
        top - 10,
        zc - lz * 0.5,
        X + lx + 1.2,
        top + 1,
        zc + lz * 0.5,
      );
  }
  if (kind === "arch") {
    // Manhattan-like crown: an arch under the top portal on both faces
    const r = (zi1 - zi0) / 2,
      yc = top - 6.4 - r * 0.55;
    for (const xf of [X - lx * 0.7, X + lx * 0.7]) {
      let prev = null;
      for (let k = 0; k <= 10; k++) {
        const a = (k / 10) * Math.PI,
          p = [xf, yc + Math.sin(a) * r * 0.55, z - Math.cos(a) * r];
        if (prev) A.beam(prev, p, 1.4, [1, 0, 0]);
        prev = p;
      }
    }
  }
}

// Queensboro-like cantilever: stone piers with steel pinnacle towers, a through truss whose top chord peaks over the
// piers (lattice sides, solid chords with collision: run along the top chord, swing from it)
function buildCantilever(B, K) {
  const S = B.sec,
    z = B.z,
    dy = B.deckY,
    WY = G.WATER_Y,
    zt = S.truss;
  const piers = [B.xA1 + 20, B.xB0 - 20];
  for (const [a, b] of isletSpans(z, B.xA1, B.xB0)) piers.push(a + 12, b - 12);
  piers.sort((a, b) => a - b);
  const x0 = B.xA1 - 1.5,
    x1 = B.xB0 + 1.5,
    rise = 32,
    low = 11;
  const topY = (x) => {
    // top chord height: peaks over piers, dips mid-span
    let d = Infinity;
    for (const p of piers) d = Math.min(d, Math.abs(x - p));
    const f = Math.min(1, d / 90);
    return dy + low + (rise - low) * (1 - f) ** 1.6;
  };
  for (const P of piers) {
    K.stone.box(P - 9, WY - 2, z - zt - 4, P + 9, dy - 1.8, z + zt + 4);
    K.solids?.box(
      P - 9,
      WY - 2,
      z - zt - 4,
      P + 9,
      dy - 1.8,
      z + zt + 4,
      "wall",
    );
    for (const s of [-1, 1]) {
      // pinnacle towers above the deck on the truss lines, with spires
      const zc = z + s * zt;
      K.steel.box(P - 3.2, dy, zc - 2.6, P + 3.2, dy + rise + 9, zc + 2.6);
      K.steel.box(
        P - 3.8,
        dy + rise + 7.5,
        zc - 3.2,
        P + 3.8,
        dy + rise + 9,
        zc + 3.2,
      );
      K.steel.box(
        P - 1.8,
        dy + rise + 9,
        zc - 1.6,
        P + 1.8,
        dy + rise + 15,
        zc + 1.6,
      );
      K.steel.beam([P, dy + rise + 15, zc], [P, dy + rise + 21, zc], 0.7);
      K.solids?.box(
        P - 3.2,
        dy,
        zc - 2.6,
        P + 3.2,
        dy + rise + 9,
        zc + 2.6,
        "wall",
      );
      K.solids?.box(
        P - 1.8,
        dy + rise + 9,
        zc - 1.6,
        P + 1.8,
        dy + rise + 15,
        zc + 1.6,
        "wall",
      );
      K.boxes?.push({
        min: [P - 3.2, dy, zc - 2.6],
        max: [P + 3.2, dy + rise + 15, zc + 2.6],
      });
      K.zips?.add(P, dy + rise + 15, zc, 0, 1, 0, "antenna");
    }
  }
  B.web = [piers[0], dy + rise + 15, z];
  // truss sides (lattice panels) following the top chord, top chord beams (solid: ramps), bottom chord, portal struts
  const panel = 9;
  for (const s of [-1, 1]) {
    const zz = z + s * zt;
    for (let x = x0; x < x1 - 0.01; x += panel) {
      const xb = Math.min(x1, x + panel),
        ya = topY(x),
        yb = topY(xb);
      K.lat.quad(
        [x, dy - 2, zz],
        [xb, dy - 2, zz],
        [xb, yb, zz],
        [x, ya, zz],
        [
          [x / panel, 0],
          [xb / panel, 0],
          [xb / panel, 1],
          [x / panel, 1],
        ],
      );
      K.steel.beam([x, ya, zz], [xb, yb, zz], 1.2, [0, 0, 1]);
      // the truss web is a wall (you can crawl it / web to it); the top chord a narrow walkable ridge
      K.solids?.ramp(
        x,
        dy,
        zz - 0.4,
        xb,
        zz + 0.4,
        0,
        ya - 0.6,
        yb - 0.6,
        "wall",
      );
      K.solids?.ramp(
        x,
        Math.min(ya, yb) - 1.2,
        zz - 0.6,
        xb,
        zz + 0.6,
        0,
        ya + 0.6,
        yb + 0.6,
        "ledge",
        0,
        1.2,
      );
      if (Math.floor(x / panel) % 2 === 0)
        K.boxes?.push({
          min: [x, dy, zz - 0.6],
          max: [xb, Math.max(ya, yb) + 0.6, zz + 0.6],
        });
      if (
        Math.floor(x / panel) % 3 === 0 &&
        piers.every((P) => Math.abs(x - P) > 8)
      )
        K.zips?.add(x + panel / 2, (ya + yb) / 2 + 0.6, zz, 0, 1, 0, "pole");
    }
    K.steel.beam([x0, dy - 1.5, zz], [x1, dy - 1.5, zz], 1.4, [0, 0, 1]);
  }
  for (let x = x0 + panel; x < x1; x += panel * 2) {
    const y = topY(x);
    K.steel.box(x - 0.35, y - 0.9, z - zt, x + 0.35, y, z + zt);
  }
}
