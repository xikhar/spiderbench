// @ts-nocheck
import atmosphereGlsl from "./shaders/glsl/atmosphere.glsl?raw";
// Atmosphere model shared by sky LUT, sky pass, env map and aerial-perspective fog.
// Units: km inside the atmosphere model. Radiance is for a sun illuminance of 1; multiply by `uSkyScale`.
import * as THREE from "three";

export const ATMOS = {
  RG: 6360.0,
  RT: 6460.0,
  betaR: [5.802e-3, 13.558e-3, 33.1e-3],
  betaMs: 3.996e-3,
  betaMe: 4.4e-3,
  betaO: [0.65e-3, 1.881e-3, 0.085e-3],
  HR: 8.0,
  HM: 1.2,
};

export const GLSL_ATMOS = atmosphereGlsl;

/** CPU transmittance of sunlight reaching height h (km) for a sun at elevation `elev` (radians). */
export function sunTransmittance(elev, mie = 1, h = 0.05) {
  const { RG, RT, betaR, betaMe, betaO, HR, HM } = ATMOS;
  const ro = new THREE.Vector3(0, RG + h, 0);
  const rd = new THREE.Vector3(Math.cos(elev), Math.sin(elev), 0);
  // intersect top
  const b = ro.dot(rd),
    c = ro.dot(ro) - RT * RT,
    t = -b + Math.sqrt(b * b - c);
  const N = 64;
  const dt = t / N;
  const od = [0, 0, 0];
  const p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    p.copy(rd)
      .multiplyScalar((i + 0.5) * dt)
      .add(ro);
    const hh = p.length() - RG;
    if (hh < 0) return [0, 0, 0];
    const dr = Math.exp(-hh / HR),
      dm = Math.exp(-hh / HM),
      dO = Math.max(0, 1 - Math.abs(hh - 25) / 15);
    for (let k = 0; k < 3; k++)
      od[k] += (betaR[k] * dr + betaMe * mie * dm + betaO[k] * dO) * dt;
  }
  return od.map((x) => Math.exp(-x));
}
