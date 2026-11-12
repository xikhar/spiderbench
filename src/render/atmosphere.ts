/**
 * Atmospheric scattering constants and GLSL/CPU helpers for sky and sunlight calculations.
 *
 * @module render-atmosphere
 * @version 1.0.0
 * @file src/render/atmosphere.ts
 * @since 0.0.1
 * @description Exports atmosphere parameters, shader code fragments, and sunTransmittance for computing physically inspired sky and solar attenuation values.
 */

import * as THREE from "three";

export const ATMOS = {
    RG: 6360.0,
    RT: 6460.0,
    betaR: [5.802e-3, 13.558e-3, 33.1e-3] as [number, number, number],
    betaMs: 3.996e-3,
    betaMe: 4.4e-3,
    betaO: [0.65e-3, 1.881e-3, 0.085e-3] as [number, number, number],
    HR: 8.0,
    HM: 1.2,
};

export const GLSL_ATMOS = `
#define RG 6360.0
#define RT 6460.0
const vec3 BETA_R = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const float BETA_MS = 3.996e-3;
const float BETA_ME = 4.40e-3;
const vec3 BETA_O = vec3(0.650e-3, 1.881e-3, 0.085e-3);
const float PI_ = 3.14159265359;

vec2 raySphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd); float c = dot(ro, ro) - r * r; float d = b * b - c;
  if (d < 0.0) return vec2(-1.0);
  d = sqrt(d); return vec2(-b - d, -b + d);
}
float phaseR(float mu) { return 3.0 / (16.0 * PI_) * (1.0 + mu * mu); }
float phaseHG(float mu, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI_ * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5)); }
// Cornette-Shanks (better Mie shape)
float phaseCS(float mu, float g) { float g2 = g * g; return 3.0 / (8.0 * PI_) * (1.0 - g2) * (1.0 + mu * mu) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5)); }
`;

/** CPU transmittance of sunlight reaching height h (km) for a sun at elevation `elev` (radians). */
export function sunTransmittance(
    elev: number,
    mie = 1,
    h = 0.05,
): [number, number, number] {
    const { RG, RT, betaR, betaMe, betaO, HR, HM } = ATMOS;
    const ro = new THREE.Vector3(0, RG + h, 0);
    const rd = new THREE.Vector3(Math.cos(elev), Math.sin(elev), 0);

    const b = ro.dot(rd),
        c = ro.dot(ro) - RT * RT,
        t = -b + Math.sqrt(b * b - c);
    const N = 64;
    const dt = t / N;
    const od: [number, number, number] = [0, 0, 0];
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
    return od.map((x) => Math.exp(-x)) as [number, number, number];
}
