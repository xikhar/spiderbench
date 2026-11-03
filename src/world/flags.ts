// @ts-nocheck
// Instanced building flags/banners hanging from angled poles, cloth wave in the vertex shader.
import { lazyShaderSections } from "../shaderSections.ts";
import flagsShaderSource from "./shaders/glsl/flags.glsl?raw";
import * as THREE from "three";
import { Pool } from "./pool.ts";
import { linearColorFromHex } from "./meshBuilder.ts";

const flagsShader = lazyShaderSections(() => flagsShaderSource);


const COLORS = [0x8e1b1b, 0x1d5a2e, 0x1b2b5c, 0xb48a2a, 0x5a1a4a];

function flagGeometry() {
  // attached along the pole (slope 1.8/2.6) from x=0.35..2.45, hanging 1.5 m below it
  const nx = 10,
    ny = 5,
    P = [],
    N = [],
    C = [],
    UV = [],
    I = [];
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const u = i / nx,
        v = j / ny;
      const x = 0.35 + u * 2.1;
      const y = x * (1.8 / 2.6) - v * 1.5;
      P.push(x, y, 0);
      N.push(0, 0, 1);
      UV.push(u, v);
      const border = u > 0.88 || v > 0.9 || v < 0.06;
      C.push(...(border ? [1.6, 1.5, 1.2] : [1, 1, 1]));
    }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      I.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  return g;
}

export function buildFlags({ scene, flags }) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",flagsShader.vertexCommon,
      )
      .replace(
        "#include <color_vertex>",flagsShader.vertexColorVertex,
      )
      .replace(
        "#include <begin_vertex>",flagsShader.vertexBeginVertex,
      );
  };
  mat.customProgramCacheKey = () => "city-flag-v1";
  const pool = new Pool(flagGeometry(), mat, {
    max: 200,
    far: 400,
    extra: { aTint: 3 },
    name: "flags",
  });
  scene.add(pool.mesh);
  for (const f of flags || []) {
    const ry = Math.atan2(-f.N[2], f.N[0]); // map +x to N
    pool.add(f.base.x, f.base.y, f.base.z, ry, 1, null, {
      aTint: linearColorFromHex(COLORS[f.color % COLORS.length]),
    });
  }
  let t = 0;
  return {
    update(dt, cam) {
      t += dt;
      uTime.value = t;
      pool.update(cam);
    },
  };
}
