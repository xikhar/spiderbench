// OWNER: render agent.
// createLighting({renderer, scene}) -> lighting
//   lighting.sun            DirectionalLight carrying the key-light radiance (sun, or moon at night; cascade 0 of the CSM)
//   lighting.update(camera) call once per frame before rendering (fits shadow cascades, re-bakes env if dirty,
//                           follows the player with the high-res character shadow cascade)
//   lighting.setSun({elevation, azimuth})   degrees; azimuth measured from +X toward +Z. Re-bakes LUT + env.
//   lighting.setupMaterial(mat)  no-op kept for API compatibility: CSM works through global chunk overrides, so
//                                every built-in lit material is handled automatically.
//   lighting.sky            sky object (params, LUT, uniforms) used by the pipeline
//   lighting.fog            aerial-perspective params used by the pipeline composite pass
//   lighting.tod            current time-of-day state {name, hour, night, exposure, ...} (read by the pipeline)
//   lighting.timeOfDay      current hour (informational)
//
// TIME OF DAY (lighting2 r3, Insomniac-style): NO clock / cycle. Fixed hand-tuned presets (PRESETS below): day (default),
//   morning, sunrise, sunset, dusk, night, overcast (rain: wet city + puddle ripples in surface.js, streaks in pipeline).
//   Settings > Time of Day -> lighting.setTimeMode(name) (blends ~2.5 s, env re-baked one cube face per frame).
//   ?tod=<preset> pins a preset (screenshots / blind pairs); ?shot= / ?playtest= pin 'day'. Old names map (golden ->
//   sunset, dawn -> sunrise, default / noon / afternoon -> day, rain -> overcast).
//   console: setTOD('night') (blended) | __ctx.lighting.setTimeOfDay('dusk') (instant)
//   Night-city hooks read nightK (src/render/daynight.js), set per preset (night 1, dusk 0.7, overcast 0.3).
import * as THREE from "three";
import { getQuality } from "./quality.js";
import { createSky } from "./sky.js";
import { CSM } from "./csm.js";
import { installSurfaceChunks, ambShared } from "./surface.js";
import { cityLights, installCityLightChunks } from "./citylights.js"; // (night) real local lights
import { sunTransmittance } from "./atmosphere.js";

// (daynight) ONE shared global for the night city (src/render/daynight.js): 0 = day .. 1 = full night. Also exposed as
// window.__nightK and lighting.nightK.
import {
    nightK,
    dnTime,
    screenK,
    syncNightMeshes,
    tickNightMeshes,
} from "./daynight.js";
export { nightK };

// Manhattan, early September. Our world: -Z is north, +X is east; azimuth measured from +X toward +Z.
const GRID_ROT = 29; // deg, Manhattan grid north vs true north
const LAT = (40.75 * Math.PI) / 180,
    DECL = (6.0 * Math.PI) / 180,
    SOLAR_NOON = 12.95;
export function solarPosition(hour) {
    let dh = ((((hour - SOLAR_NOON) % 24) + 36) % 24) - 12; // (daynight) wrap to [-12, 12) h: continuous azimuth through midnight
    const H = (dh * 15 * Math.PI) / 180;
    const sinEl =
        Math.sin(LAT) * Math.sin(DECL) +
        Math.cos(LAT) * Math.cos(DECL) * Math.cos(H);
    const el = Math.asin(sinEl);
    let cosA =
        (Math.sin(DECL) - sinEl * Math.sin(LAT)) /
        (Math.cos(el) * Math.cos(LAT));
    let A = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1)); // from north, clockwise
    if (H > 0) A = 2 * Math.PI - A;
    // (lighting2 r3) the game's -Z 'north' is Manhattan grid north, which is ~29 deg east of true north: rotate the true
    // azimuth into grid space (sunrise / sunset slant across the grid; 'Manhattanhenge' alignment in late May / July)
    return {
        elevation: (el * 180) / Math.PI,
        azimuth: (A * 180) / Math.PI - 90 - GRID_ROT,
    };
}

// Look parameters (everything the time of day changes besides the sun position).
//  env: diffuse sky fill, envSpec: specular (reflection) env level, envSat: ambient saturation, sun: key-light gain,
//  warm: key-light warmth (0..1), fog: fog density scale, mie: haze aerosols, clouds: coverage, exposure: grade exposure,
//  bounce / groundBounce: street + facade bounce GI (surface.js), glow: golden aureole around a low sun (sky.js),
//  fogTint: aerial-perspective in-scatter tint.
// (daynight) keyframes by SUN ELEVATION, blended smoothly (no popping anywhere in the day-night cycle). 'afternoon'
// (el 24) is the tuned gameplay look (lighting2 r2: warm late afternoon), 'noon' is the lighting2 r1 midday look.
const LOOK_KEYS = [
    {
        el: -14,
        env: 1.0,
        envSpec: 1.0,
        envSat: 0.7,
        sun: 1.0,
        warm: 0.0,
        fog: 0.55 /* (lighting2 r3) 0.9: aerial night views drowned in a brown glow haze */,
        mie: 1.2,
        clouds: 0.14 /* (night r4) 0.28: cotton puffs; the refs have a featureless hazy veil */ /* (night) 0.5: dark cloud blobs on the sky; the refs show a smooth hazy night sky */ /* (lighting2 r3) 0.35: night ref has a dark cloud deck lit from below */,
        exposure: 1.0,
        bounce: 0.1,
        groundBounce: 0.0,
        glow: 0.0,
        fogTint: [0.84, 0.9, 1.0],
    },
    {
        el: -4.5,
        env: 1.0,
        envSpec: 1.0,
        envSat: 0.75,
        sun: 1.0,
        warm: 0.3,
        fog: 1.2,
        mie: 1.3,
        clouds: 0.45,
        exposure: 1.45,
        bounce: 0.3,
        groundBounce: 1.2,
        glow: 0.7,
        fogTint: [0.88, 0.85, 0.95],
    },
    {
        el: 3,
        env: 0.72,
        envSpec: 1.0,
        envSat: 0.75,
        sun: 1.15,
        warm: 0.85,
        fog: 1.35,
        mie: 1.4,
        clouds: 0.55,
        exposure: 1.5,
        bounce: 0.5,
        /* (lighting2 r3) env 0.95 -> 0.72, bounce 0.6 -> 0.5: contre-jour, faces away from a low sun fall into cool silhouettes */ groundBounce: 2.2,
        glow: 1.5,
        fogTint: [1.0, 0.86, 0.74],
    },
    {
        el: 10,
        env: 0.8,
        envSpec: 0.95,
        envSat: 0.8,
        sun: 1.3,
        warm: 0.75,
        fog: 1.3,
        mie: 1.05,
        clouds: 0.55,
        exposure: 1.2,
        bounce: 0.62,
        /* (lighting2 r3) env 1.1 -> 0.8, bounce 0.8 -> 0.62 (critic: backlit facades evenly lit beige) */ groundBounce: 2.6,
        glow: 1.45,
        fogTint: [1.0, 0.9, 0.8],
    },
    {
        el: 24,
        env: 1.5,
        envSpec: 0.85,
        envSat: 0.85,
        sun: 1.55,
        warm: 0.48,
        fog: 1.45,
        mie: 0.75,
        clouds: 0.62,
        exposure: 0.74,
        /* (lighting2 r3) day refs: warm 0.62 -> 0.48 (sepia cast), exposure 0.84 -> 0.74 (2-11 % of pixels clipped vs refs < 1 %) */ bounce: 0.95,
        groundBounce: 2.6,
        glow: 1.25,
        fogTint: [0.9, 0.9, 0.96],
    },
    {
        el: 45,
        env: 1.0,
        envSpec: 0.8,
        envSat: 0.6,
        sun: 1.45,
        warm: 0.32,
        fog: 1.0,
        mie: 0.35,
        clouds: 0.8,
        exposure: 0.72,
        bounce: 0.55,
        groundBounce: 2.4,
        glow: 0.3,
        fogTint: [0.72, 0.83, 1.0],
    },
];
function lookAt(el) {
    const K = LOOK_KEYS;
    if (el <= K[0].el) return { ...K[0], fogTint: [...K[0].fogTint] };
    for (let i = 1; i < K.length; i++)
        if (el < K[i].el) {
            const a = K[i - 1],
                b = K[i],
                x = (el - a.el) / (b.el - a.el),
                t = x * x * (3 - 2 * x),
                o = {};
            for (const k in a)
                o[k] = Array.isArray(a[k])
                    ? a[k].map((v, j) => v + (b[k][j] - v) * t)
                    : a[k] + (b[k] - a[k]) * t;
            return o;
        }
    const L = K[K.length - 1];
    return { ...L, fogTint: [...L.fogTint] };
}

// (lighting2 r3) INSOMNIAC-STYLE FIXED PRESETS (user: "don't make a realistic cycle, follow what Insomniac does"): no clock,
// the player picks one hand-tuned look (Settings > Time of Day). Each preset = a FIXED sun (or moon) direction + look
// overrides on top of the elevation keyframes above. Azimuth: degrees from +X (east) toward +Z (south); game -Z = grid
// north. Extra look keys: windows (nightK for the night city), wet / rain (surface.js / pipeline rain), flare (sun glare /
// shafts), moonEl / moonAz (night key light + moon disc), skyDusk (sunset band strength).
// History: (street r8 / atmosphere r1-r2 / lighting2 r1-r2) the old single default look evolved into 'day' below.
export const PRESETS = {
    // (lighting2 r3, user) daylight presets: strong key : fill (less sky + bounce fill than r1/r2: shade clearly darker, cool,
    // with texture), crisp shadows. Day: high sun (~65 deg) slightly south-west, most streets / roofs in direct sun.
    day: {
        elevation: 65,
        azimuth: 118,
        look: {
            vertFill: 0.55,
            vertBounce: 0.25,
            warm: 0.22,
            env: 1.0,
            envSpec: 0.9,
            envSat: 0.9,
            sun: 1.75,
            exposure: 0.9,
            clouds: 0.55,
            fog: 0.9,
            mie: 0.35,
            bounce: 0.4,
            groundBounce: 1.25,
            /* measured vs topdown_street_shadows: first pass lit 0.23 / shade 0.004 (ref 0.55 / 0.023) */ glow: 0.15,
            fogTint: [0.74, 0.84, 1.0],
        },
    },
    morning: {
        elevation: 16,
        azimuth: 342,
        look: {
            vertFill: 0.6,
            vertBounce: 0.3,
            warm: 0.22,
            env: 0.58,
            envSat: 0.8,
            sun: 1.65,
            exposure: 1.0,
            clouds: 0.5,
            fog: 1.2,
            mie: 0.9,
            bounce: 0.24,
            groundBounce: 0.8,
            glow: 0.45,
            fogTint: [0.78, 0.86, 1.0],
        },
    },
    sunrise: {
        elevation: 4,
        azimuth: 330,
        look: {
            vertFill: 0.65,
            vertBounce: 0.35,
            warm: 0.8,
            env: 0.5,
            bounce: 0.26,
            groundBounce: 0.9,
            glow: 1.4,
            clouds: 0.5,
            skyDusk: 1.0,
        },
    },
    sunset: {
        elevation: 7,
        azimuth: 160,
        look: {
            vertFill: 0.65,
            vertBounce: 0.35,
            warm: 0.85,
            env: 0.52,
            bounce: 0.3,
            groundBounce: 1.0,
            glow: 1.5,
            clouds: 0.55,
            skyDusk: 1.25,
        },
    },
    dusk: {
        elevation: -4.5,
        azimuth: 172,
        look: {
            vertFill: 0.8,
            vertBounce: 0.5,
            windows: 0.7,
            env: 1.5 /* (lighting2 r5) 0.8: critic 'dusk shade pure black, needs ~5-10 % sky fill' */,
            bounce: 0.2,
            groundBounce: 0.6,
            skyDusk: 1.1,
            fogTint: [0.78, 0.7, 0.72],
        },
    },
    // night: its own config (dark sky, moon key low, the city lit by windows / street + TS light (surface.js city term))
    night: {
        elevation: -14,
        azimuth: 190,
        look: {
            windows: 1,
            env: 3.0 /* (night) critic r1: street-level facades 12-15 vs ref 24-46, ESB body 15 vs 28 (was 2.0) */ /* (night) 1.0: facade bodies read as dark grey-blue massing (esb ref ~ sRGB 45), not black */ /* (lighting2 r5) 0.7: rooftops read */,
            moonEl: 36,
            moonAz: 15,
            fogTint: [
                0.38, 0.33, 0.32,
            ] /* (lighting2 r5) slightly warm light-pollution haze (was 0.3 grey; 0.52 relit the far-shore band) */ /* the additive skyline glow in the haze in-scatter lit the far shores as a pale band */,
        },
    },
    overcast: {
        elevation: 38,
        azimuth: 125,
        look: {
            vertFill: 0.75,
            vertBounce: 0.5,
            sun: 0.18,
            env: 1.6,
            envSpec: 1.0,
            envSat: 0.4,
            warm: 0.0,
            clouds: 1.0,
            fog: 2.6,
            mie: 1.7,
            fogTint: [0.82, 0.85, 0.88],
            exposure: 0.82,
            bounce: 0.1,
            groundBounce: 0.4,
            glow: 0.0,
            wet: 1,
            rain: 1,
            windows: 0.3,
            flare: 0,
            overcast: 1 /* (lighting2 r4) grey storm deck, darker */,
        },
    },
};
// (user r-daysun) "add 2 different sun orientations for light / shadows during the day preset": same Day look, the sun
// from two more directions (Settings > Day Sun). dayB: late-morning sun from the south-east (shadows fall north-west
// across the streets); dayC: mid-afternoon sun from the west-south-west, lower (longer shadows across the avenues).
PRESETS.dayB = { elevation: 55, azimuth: 58, look: { ...PRESETS.day.look } };
PRESETS.dayC = { elevation: 44, azimuth: 160, look: { ...PRESETS.day.look } };
export const DAY_SUNS = { a: "day", b: "dayB", c: "dayC" };
// old names (settings saves, ?tod=, tools) -> closest preset
const PRESET_ALIAS = {
    default: "day",
    noon: "day",
    afternoon: "day",
    golden: "sunset",
    dawn: "sunrise",
    rain: "overcast",
    cycle: "day",
};
export const TOD_PRESETS = PRESETS;
export const SUN_PRESETS = TOD_PRESETS; // backwards compat

const lerp = THREE.MathUtils.lerp;
const smooth = (a, b, x) => {
    const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
};

export function createLighting({ renderer, scene }) {
    const quality = getQuality();
    installSurfaceChunks(quality);
    const reversed = !!renderer.capabilities.reversedDepthBuffer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // hardware PCF (PCFSoft was removed in r18x)
    renderer.shadowMap.autoUpdate = true;

    const sky = createSky(renderer, quality);
    const csm = new CSM({ scene, quality, reversed, renderer });
    installCityLightChunks(renderer, scene); // (night) after the CSM patch of lights_fragment_begin
    const sun = csm.sun;

    scene.background = null;
    const fogBase = { density: 0.00013, heightFalloff: 1 / 300 }; // (timessq r6) falloff 1/420 -> 1/300: the extra day haze sits low in the street canyons, aerial views barely change // (foundation: was 0.0002 -> far shores / horizon bleached to a milky wall)
    const fog = {
        density: fogBase.density, // extinction per metre at ground level
        heightFalloff: fogBase.heightFalloff, // 1/m (exponential height falloff)
        sunScatter: 0.6, // strength of the forward (Mie) sun glow in the fog
        tint: new THREE.Color(0.84, 0.9, 1.0), // slightly bluer/deeper than the raw horizon radiance
        startDistance: 35,
        shafts: 1.0, // volumetric light shaft strength (pipeline)
    };

    const tod = {
        name: "default",
        hour: 14.5,
        elevation: 47,
        azimuth: 118,
        night: 0,
        exposure: 1.0,
        bloom: 1.0,
        windows: 0, // 0..1 how much the city's interior lights are boosted
    };
    const state = {
        envDirty: true,
        envTexture: null,
        envIntensity: 0.95,
        envTimer: 0,
        nightMats: null,
        nightScan: 0,
    };
    const city = { street: 0.5, ts: 0.13 }; // (night) 0.1 -> 0.5: matches the average irradiance of the real lamp pools inside the local-light grid, so far avenues glow like the near ones (rooftop_haze ref) // (night) street 0.05 -> 0.1: far-field street glow seen from above (rooftop_haze ref: glowing avenues) // (lighting2 r4) 0.08 / 0.22: critic 'TS road blown out to near-white' // (lighting2 r3) night street-light / Times Square spill irradiance (live-tunable: lighting.city)
    const nightBase = new WeakMap(); // material -> base values (so re-scans never re-read boosted values)
    // (night) light-polluted haze (refs/night): in-scatter colours (pre-exposure radiance, low = toward the horizon /
    // looking down, high = looking up), horizon sky glow, fog density scale. Live-tunable: lighting.nightHaze
    const NH = {
        low: [0.0125, 0.0115, 0.0165],
        high: [0.008, 0.008, 0.012],
        glow: [0.012, 0.009, 0.011],
        fog: 4.0,
        start: 120,
        /* (night) r3: critic 'no light-pollution dome, clean blue hour': warm-magenta horizon glow, purple-grey haze (#3a2e3a) from ~120 m */ glowCol:
            [0.022, 0.013, 0.0075],
        glowH: 22,
        glowK: 0.004,
    }; // glowCol / H / K: warm street-level glow layer (pipeline composite)
    const nightHaze = { k: 0, low: NH.low, high: NH.high, cfg: NH };

    // ------------------------------------------------------------------ apply a time of day
    // (daynight) everything is a continuous function of the sun elevation (keyframes in LOOK_KEYS), so the cycle never pops:
    //  - the sky LUT always follows the real sun (also below the horizon: twilight, then the multiple-scattering floor),
    //    faded to a dim moonlit night sky by skyTint
    //  - the key light (CSM DirectionalLight) is the sun while it is up (faded out by el -3) and the moon afterwards (faded
    //    in from el -3); the switch happens while both are ~0, so shadows fade out and back in instead of jumping
    const _moonDir = new THREE.Vector3(),
        _keyDir = new THREE.Vector3(),
        _moonCol = new THREE.Color();
    const key = {
        moon: false,
        dir: _keyDir,
        color: new THREE.Color(),
        lastDir: new THREE.Vector3(0, 1, 0),
    };
    const moon = { dir: _moonDir, k: 0 };
    function applyTod(
        { elevation, azimuth, hour = null, name = "custom", look = null },
        cycling = false,
    ) {
        tod.name = name;
        tod.hour = hour ?? tod.hour;
        tod.elevation = elevation;
        tod.azimuth = azimuth;
        const el = elevation;
        const night = smooth(-1, -8, el); // 0 day .. 1 full night (exposure, lights)
        tod.night = night;
        const L = look ?? lookAt(el); // (lighting2 r3) preset look (fully merged), or the elevation keyframes
        const p = sky.params;
        const sunK = smooth(-3, 2, el); // sun key light
        const moonK = smooth(-3, -10, el); // moon key light
        const dayF = smooth(-10, 1, el) ** 2; // day sky radiance weight (deep blue twilight once the sun is ~5 deg down)
        p.elevation = Math.max(el, -14);
        p.azimuth = azimuth;
        p.lightScale = sunK * (L.sun ?? 1);
        const w = L.warm;
        p.lightTint = [1 + 0.1 * w, 1 - 0.04 * w, 1 - 0.3 * w];
        // moonlit night sky: the (sun-below-horizon) LUT is only its multiple-scattering floor, scaled to a dim blue
        // (lighting2 r3) director: 'night reads as a dim day, sky too bright purple'. night_aerial / ts_night refs: deep
        // blue-black sky (x0.45, less saturated), the city is lit by its windows / street lights, not by the moon
        const nt = [
            0.066 * moonK + 0.01,
            0.042 * moonK + 0.007,
            0.027 * moonK + 0.005,
        ]; // (night r4) zenith less saturated blue (esb sky 38/43/68 vs ref 37/40/51) // (night) r2 bluer (street ref sky 33/49/64, esb 37/40/51) // (night) esb ref zenith ~ sRGB 29/34/49: grey-blue, not saturated navy (was 0.0075/0.0105/0.022)
        p.skyTint = nt.map(
            (v, i) => lerp(v, 1, dayF) * (L.rain ? [0.95, 0.9, 0.7][i] : 1),
        ); // (lighting2 r3) overcast: greyer (less blue) sky
        const dusk =
            smooth(10, 1, el) * smooth(-9, -1.5, el) * (L.skyDusk ?? 1); // warm dusk band near the horizon around sunset
        p.skyGlow = [
            0.35 * dusk + NH.glow[0] * night,
            0.16 * dusk + NH.glow[1] * night,
            0.06 * dusk + NH.glow[2] * night,
        ]; // (night) purple-grey light pollution (was sodium orange 0.05/0.028/0.016) // + sodium light pollution (skyline glow near the horizon) (lighting2 r3: warmer, stronger vs the darker zenith)
        sky.skyUniforms.uHzK.value.set(
            lerp(0.56, 0.38, night),
            lerp(0.63, 0.38, night),
            lerp(0.78, 0.5, night),
        ); // (night) no pink horizon band (esb ref horizon ~ sRGB 45/46/63)
        p.night = night;
        p.stars = night * (1 - dayF) * 0.04; // (night) 0.4: the refs show almost no stars over Manhattan // (lighting2 r3) Manhattan light pollution: only the brightest stars
        // (lighting2 r2) golden aureole around a low sun (sky.js): warm haze toward the sun
        p.sunGlow = [1.05, 0.5, 0.08, (L.glow ?? 1) * smooth(-4, 1, el)];
        // moon: follows the solar arc 12 h later (rises around sunset), clamped high enough for usable shadows
        // (lighting2 r3) presets give the moon a fixed direction (moonEl / moonAz); the moon disc (pipeline) uses the same dir
        const mh =
            L.moonEl != null
                ? { elevation: L.moonEl, azimuth: L.moonAz }
                : solarPosition(((tod.hour ?? 22) + 12) % 24);
        const mel = THREE.MathUtils.degToRad(Math.max(mh.elevation, 14)),
            maz = THREE.MathUtils.degToRad(mh.azimuth);
        _moonDir
            .set(
                Math.cos(mel) * Math.cos(maz),
                Math.sin(mel),
                Math.cos(mel) * Math.sin(maz),
            )
            .normalize();
        moon.k = moonK;
        key.moon = sunK < 1e-3;
        if (key.moon) {
            const T = sunTransmittance(mel, 1.2),
                E =
                    p.skyScale *
                    0.62 *
                    (0.047 * moonK +
                        0.0005); /* (night r6) moonlit facades 58 vs target 35-45 */ /* (night) r2: 0.058, street ref asphalt / facades read in cool moonlight */ /* (night) 0.036: the refs' moonlight reads on facades and streets (cool blue fill) */ /* (lighting2 r4) 0.026: critic 'building bodies pure black, massing should read' */ // (lighting2 r3) 0.055 -> 0.026: buildings read as dark silhouettes defined by their windows
            key.color.setRGB(T[0] * E * 0.45, T[1] * E * 0.7, T[2] * E * 1.4); // (night r4) moonlit stone read as overcast day (critic: facades 58-63 vs ref 24-46 bluish): dimmer + bluer // (night) r2 cooler moonlight: blue-lit roofs (rooftop_haze ref 56/66/86)
        }
        p.mie = L.mie;
        p.envSaturation = 0.92;
        p.cloudCoverage = L.clouds;
        p.overcast = L.overcast ?? 0;
        p.cloudDensity = 0.7 * (1 + 1.5 * p.overcast); // (lighting2 r4) heavy low deck
        // (atmosphere r2) L.env is the DIFFUSE sky fill; specular sky reflections (glass, water, wet paint) keep a stronger
        // level (L.envSpec) -- lowering the fill for sun/shade contrast must not turn the rivers and glass towers grey
        const envSpec = L.envSpec ?? L.env; // (lighting2 r1) no max(): the diffuse fill may exceed the specular level (shape.z > 1)
        state.envIntensity = envSpec;
        ambShared.shape.z = L.env / envSpec;
        fog.density = fogBase.density * lerp(L.fog, NH.fog, night); // (night) denser, light-polluted haze: distant towers fade (esb ref)
        nightHaze.k = night; // (night) composite: haze in-scatter colour at night
        fog.startDistance = lerp(35, NH.start, night);
        fog.tint.setRGB(...L.fogTint);
        fog.sunScatter = lerp(0.25, 0.6 + 0.6 * smooth(20, 3, el), sunK);
        fog.shafts = lerp(0.35, 1.0, sunK) * (L.flare ?? 1);
        tod.exposure = L.exposure * lerp(1, 4.5, night);
        tod.bloom = 1 + 1.6 * night; // (daynight) night refs: lamps / screens / headlights bloom and spill
        tod.windows = L.windows ?? smooth(3, -7, el); // city lights come on around sunset (presets: nightK per preset)
        tod.sunK = sunK * (L.flare ?? 1);
        tod.moonK = moonK; // sunK also gates the sun flare / glare (overcast: none)
        tod.rain = L.rain ?? 0;
        ambShared.wx.x = L.wet ?? 0;
        ambShared.wx.z = tod.rain; // (lighting2 r3) overcast rain: wet city (surface.js), streaks (pipeline)
        nightK.value = tod.windows;
        syncNightMeshes();
        screenK.value = Math.min(
            1.2,
            (0.9 * lerp(1, 0.5, tod.windows)) / Math.max(tod.exposure, 0.3),
        ); // (lighting2 r5)
        applySun({ env: !cycling });
        // ambient grade (diffuse IBL): saturation + slight warm tint; bounce GI from the sunlit street/facades
        const sc = sky.sunColor,
            sy = Math.max(sky.sunDir.y, 0);
        ambShared.grade.set(
            lerp(0.98, 0.72, night),
            lerp(1.0, 0.93, night),
            lerp(1.03, 1.36, night),
            L.envSat,
        ); // (night r7) ~8500 K moon/sky fill: unlit facades read blue (street ref 24/33/46), lamp pools stay warm // (night) moonlit blue-grey fill (street ref), not warm-grey // (atmosphere r2) slightly cool sky fill: shade reads cool against the warm key (was 1.04/1/0.93); the warm street bounce below keeps it from going blue
        const bk = (L.bounce ?? 0.4) * Math.max(sy, 0.3 * Math.min(1, sy * 8)); // (lighting2 r1) 0.17 -> 0.4; low suns keep a floor (golden hour bounce) // sunlit street/facade bounce onto shaded walls (atmosphere r2: 0.12 -> 0.17, shade keeps a readable warm-lifted floor)
        ambShared.bounce.set(
            sc.r * bk * 1.08,
            sc.g * bk,
            sc.b * bk * 0.8,
            lerp(1, 0.04, night),
        );
        // (atmosphere r3) street-level bounce boost (surface.js): people / cars / shop fronts standing in building shade in
        // the canyons (Times Square) went near-black -- they get the warm light bounced off the sunlit street and facades
        ambShared.shape.w = (L.groundBounce ?? 2.4) * (1 - night);
        ambShared.shape.y = lerp(1, 0.62, night); // (night r5) less sky fill on up-facing roofs / ground: pale roofs read frosted from above (critic r4)
        ambShared.vert.set(
            L.vertFill ?? 1,
            L.vertBounce ?? 1,
            (1 - (L.vertFill ?? 1)) * 0.8,
            cityLights.enabled ? 1 : 0,
        ); // w: (night) local city lights on -> the analytic street glow only lights the far field // z: canyon skylight occlusion (daylight only) // (lighting2 r6) vertical-surface fill (daylight presets < 1)
        // (lighting2 r3) night city light (surface.js): sodium street-level fill + Times Square screen-colour spill
        const cl = tod.windows;
        ambShared.city.set(
            city.street * cl,
            city.street * 0.72 * cl,
            city.street * 0.45 * cl,
            city.ts * cl,
        ); // (night) LED-mix warm white (was sodium 0.5 / 0.17)
        scene.environmentIntensity = state.envIntensity;
        applyNightMaterials();
    }

    const _sunKeyDir = new THREE.Vector3();
    function applySun({ env = true } = {}) {
        sky.update();
        if (key.moon) {
            _keyDir.copy(_moonDir);
            sun.color.copy(key.color);
        } else {
            // sun key light: direction clamped just above the horizon (shadows stay valid while it fades out)
            const e = THREE.MathUtils.degToRad(
                    Math.max(sky.params.elevation, 2),
                ),
                a = THREE.MathUtils.degToRad(sky.params.azimuth);
            _keyDir
                .set(
                    Math.cos(e) * Math.cos(a),
                    Math.sin(e),
                    Math.cos(e) * Math.sin(a),
                )
                .normalize();
            sun.color.copy(sky.sunColor);
        }
        // re-fit the shadow cascades only when the key light turned noticeably (setSunDirection re-renders every cascade)
        if (key.lastDir.angleTo(_keyDir) > 0.0012 || env) {
            csm.setSunDirection(_keyDir);
            key.lastDir.copy(_keyDir);
        }
        sun.intensity = 1.0;
        // keep the color normalised-ish so other agents that read sun.intensity see something sane
        const m = Math.max(sun.color.r, sun.color.g, sun.color.b, 1e-6);
        sun.color.multiplyScalar(1 / m);
        sun.intensity = m;
        if (env) state.envDirty = true;
    }

    // ------------------------------------------------------------------ night: boost city emissives
    // The city exposes facade uniforms (uInteriorGain / uShopGain) and uses emissive colours for lamps, signals and
    // car lights. We scale them at night (base values remembered on first sight).
    function scanNightMaterials() {
        const mats = new Set();
        scene.traverse((o) => {
            const m = o.material;
            if (!m) return;
            for (const mm of Array.isArray(m) ? m : [m]) mats.add(mm);
        });
        const list = [];
        for (const m of mats) {
            let b = nightBase.get(m);
            if (!b) {
                const u = m.userData?.uniforms;
                if (m.userData?.nightGain != null && m.emissive)
                    b = {
                        kind: "emis",
                        ei: m.emissiveIntensity ?? 1,
                        gain: m.userData.nightGain,
                    }; // (lighting2 r4) per-material override
                else if (m.userData?.nightLit)
                    b = { kind: "emis", ei: m.userData.nightLit, base0: true }; // (lighting2 r3) printed billboards: 0 by day, lamp-lit at night
                else if (u?.uInteriorGain || u?.uShopGain)
                    b = {
                        kind: "facade",
                        gi: u.uInteriorGain?.value ?? 0,
                        gs: u.uShopGain?.value ?? 0,
                    };
                else if (
                    m.emissive &&
                    m.emissive.r + m.emissive.g + m.emissive.b > 0.05 &&
                    !m.map
                )
                    b = { kind: "emis", ei: m.emissiveIntensity ?? 1 };
                // (daynight) LED screens / billboards / lit shop cards (emissive maps): vivid at night, not blown out to white
                else if (
                    m.emissive &&
                    m.emissiveMap &&
                    (m.emissiveIntensity ?? 0) > 0.3
                )
                    b = {
                        kind: "emis",
                        ei: m.emissiveIntensity,
                        gain: 0.1,
                        screen: true,
                    }; // the night exposure (x4.5) already makes them pop (lighting2 r3: 0.35 -> 0.13, director: TS ads blown to white, must stay readable + saturated)
                else b = { kind: "none" };
                nightBase.set(m, b);
            }
            if (b.kind !== "none") list.push({ m, ...b });
            wrapTranslucency(m);
        }
        state.nightMats = list;
    }
    // Some city materials fake leaf translucency as `totalEmissiveRadiance += diffuseColor.rgb * k` (constant, i.e.
    // it glows at night). Scale that term by the daylight factor (ambData.bounce.w) without touching their code:
    // wrap their onBeforeCompile and give the program a distinct cache key.
    const wrapped = new WeakSet();
    function wrapTranslucency(m) {
        if (wrapped.has(m)) return;
        wrapped.add(m);
        const obc = m.onBeforeCompile;
        if (!obc || obc === THREE.Material.prototype.onBeforeCompile) return;
        let src = "";
        try {
            src = obc.toString();
        } catch (e) {
            return;
        }
        if (!/totalEmissiveRadiance \+= diffuseColor\.rgb \*/.test(src)) return;
        m.onBeforeCompile = function (sh, r) {
            obc.call(this, sh, r);
            sh.fragmentShader = sh.fragmentShader.replace(
                /totalEmissiveRadiance \+= diffuseColor\.rgb \* ([0-9.]+);/g,
                "totalEmissiveRadiance += diffuseColor.rgb * $1 * ambData.bounce.w;",
            );
        };
        const key = m.customProgramCacheKey;
        m.customProgramCacheKey = function () {
            return (key ? key.call(this) : "") + "|dayTrans";
        };
        m.needsUpdate = true;
    }
    function applyNightMaterials() {
        const k = tod.windows;
        if (!state.nightMats) {
            if (k <= 0) return;
            scanNightMaterials();
        }
        for (const e of state.nightMats) {
            if (e.kind === "facade") {
                const u = e.m.userData.uniforms;
                if (u.uInteriorGain)
                    u.uInteriorGain.value = e.gi * lerp(1, 5.0, k);
                if (u.uShopGain) u.uShopGain.value = e.gs * lerp(1, 1.5, k); // (night) 3.0: shop interiors are modelled / lit by real rect lights now (buildings r2)
            } else {
                // (lighting2 r5) screens: per-emissive exposure compensation (director: 'at Dusk LED screens wash to near-white').
                // Their displayed radiance follows the preset exposure: ~day level x (1 .. 0.5 at full night) at EVERY preset
                if (e.screen) e.m.emissiveIntensity = e.ei * screenK.value;
                else
                    e.m.emissiveIntensity = e.base0
                        ? e.ei * k
                        : e.ei * lerp(1, e.gain ?? 3.0, k);
            }
        }
    }

    const LOOK_NUM = [
        "vertFill",
        "vertBounce",
        "overcast",
        "env",
        "envSpec",
        "envSat",
        "sun",
        "warm",
        "fog",
        "mie",
        "clouds",
        "exposure",
        "bounce",
        "groundBounce",
        "glow",
        "windows",
        "wet",
        "rain",
        "flare",
        "skyDusk",
        "moonEl",
        "moonAz",
    ];
    function resolvePreset(name) {
        const n = PRESETS[name] ? name : (PRESET_ALIAS[name] ?? "day");
        const d = PRESETS[n],
            base = lookAt(d.elevation);
        const look = {
            windows: smooth(3, -7, d.elevation),
            wet: 0,
            rain: 0,
            overcast: 0,
            vertFill: 1,
            vertBounce: 1,
            flare: 1,
            skyDusk: 1,
            moonEl: 36,
            moonAz: d.azimuth + 180,
            ...base,
            ...d.look,
        };
        look.fogTint = [...(d.look.fogTint ?? base.fogTint)];
        return { elevation: d.elevation, azimuth: d.azimuth, name: n, look };
    }
    // (lighting2 r3) preset switches blend over ~2.5 s (sun direction on the shortest arc + every look value), the env map
    // re-bakes one cube face per frame meanwhile (no hitch); ?tod= / ?shot= / ?playtest= pin a preset (screenshots, pairs)
    const blend = {
        on: false,
        t: 0,
        dur: 2.5,
        from: null,
        to: null,
        envStep: -1,
        envTail: 0,
    };
    let forced = false;
    function snapshot() {
        return {
            elevation: tod.elevation,
            azimuth: tod.azimuth,
            name: tod.name,
            look: { ...tod.look, fogTint: [...tod.look.fogTint] },
        };
    }
    function setPreset(name, { instant = false } = {}) {
        const to = resolvePreset(name);
        if (instant || !tod.look) {
            blend.on = false;
            applyTod(to);
            tod.look = to.look;
            return to.name;
        }
        if (blend.on ? blend.to.name === to.name : tod.name === to.name)
            return to.name;
        blend.from = snapshot();
        blend.to = to;
        blend.t = 0;
        blend.on = true;
        return to.name;
    }
    function setTimeMode(mode = "day") {
        if (forced) return tod.name;
        return setPreset(mode, { instant: (state.upT || 0) < 3 });
    } // saved preset at load: instant
    function stepBlend(dt) {
        blend.t = Math.min(1, blend.t + dt / blend.dur);
        const x = blend.t * blend.t * (3 - 2 * blend.t),
            A = blend.from,
            B = blend.to,
            L = { ...B.look };
        for (const k of LOOK_NUM)
            if (A.look[k] != null && B.look[k] != null)
                L[k] = lerp(A.look[k], B.look[k], x);
        L.fogTint = A.look.fogTint.map((v, j) => lerp(v, B.look.fogTint[j], x));
        const da = ((((B.azimuth - A.azimuth) % 360) + 540) % 360) - 180;
        const el = lerp(A.elevation, B.elevation, x),
            az = A.azimuth + da * x;
        applyTod(
            {
                elevation: el,
                azimuth: az,
                name: x < 1 ? A.name + ">" + B.name : B.name,
                look: L,
            },
            true,
        );
        tod.look = L;
        if (blend.t >= 1) {
            blend.on = false;
            blend.envTail = 1;
        }
        // env: one cube face per frame, PMREM on the 7th, repeated while blending + once after the end
        if (blend.envStep < 0) blend.envStep = 0;
    }
    function stepEnv() {
        if (blend.envStep < 0) return;
        if (blend.envStep < 6) sky.renderEnvFace(blend.envStep++);
        else {
            state.envTexture = sky.finishEnv();
            scene.environment = state.envTexture;
            blend.envStep = blend.on || blend.envTail-- > 0 ? 0 : -1;
        }
    }

    let initial = "day";
    try {
        const q = new URLSearchParams(location.search);
        const n = q.get("tod");
        if (n != null) initial = n;
        forced = n != null || q.has("shot") || q.has("playtest");
    } catch (e) {
        /* non-browser */
    }
    setPreset(initial, { instant: true });

    // ------------------------------------------------------------------ character shadow cascade target
    const _pp = new THREE.Vector3();

    const lighting = {
        sun,
        csm,
        sky,
        fog,
        quality,
        reversed,
        tod,
        amb: ambShared,
        city,
        cityLights,
        cityVol: { strength: 1, density: 0.0045, height: 30 },
        nightHaze, // (night) lit haze around the city lights (pipeline cityVolume)
        get timeOfDay() {
            return tod.name;
        },
        get envIntensity() {
            return state.envIntensity;
        },
        set envIntensity(v) {
            state.envIntensity = v;
            scene.environmentIntensity = v;
        },
        setSun({ elevation, azimuth } = {}) {
            blend.on = false;
            applyTod({
                elevation: elevation ?? tod.elevation,
                azimuth: azimuth ?? tod.azimuth,
                name: "custom",
                look: tod.look,
            });
        },
        /** re-bake LUT/env after editing sky.params (clouds, mie ...) */
        refresh() {
            applySun();
        },
        setupMaterial(/* material */) {
            /* not needed: global chunk override */
        },
        get preset() {
            return tod.name;
        },
        /** (lighting2 r3) instant switch: 'day' | 'morning' | 'sunrise' | 'sunset' | 'dusk' | 'night' | 'overcast' (old names map) */
        setTimeOfDay(v) {
            return setPreset(v, { instant: true });
        },
        /** blended (~2.5 s) switch to a preset */
        setPreset(v) {
            return setPreset(v);
        },
        /** settings menu: blended switch, ignored when a preset is pinned by ?tod= / ?shot= */
        setTimeMode,
        nightK,
        moon,
        setDryPuddles(on = true) {
            ambShared.wx.w = on ? 1 : 0;
        }, // (user r-nopuddles) Settings > Puddles
        get cycle() {
            return { on: false, hour: tod.hour ?? 12, minutes: 0 };
        }, // (lighting2 r3) compat: no clock any more (old readers of .cycle.hour)
        presets: Object.keys(PRESETS),
        update(camera, dt = 1 / 60) {
            const nowS = performance.now() / 1000,
                rdt = state.lastT ? Math.min(nowS - state.lastT, 0.1) : dt;
            state.lastT = nowS; // (main.js passes no dt)
            if (blend.on) stepBlend(rdt);
            stepEnv();
            scene.environmentIntensity = state.envIntensity;
            ambShared.wx.y = performance.now() / 1000; // (lighting2 r3) rain ripples clock
            tickNightMeshes();
            dnTime.value = performance.now() / 1000; // (daynight)
            // (daynight) re-scan for newly streamed-in city materials every 6 s while the lights are on
            // (lighting2 r3) every 1 s for the first ~20 s (the first scan ran on an empty scene: TS screens stayed at their day
            // intensity and blew out to white until the 6 s re-scan / forever in short screenshot runs)
            state.upT = (state.upT || 0) + dt;
            if (
                tod.windows > 0 &&
                (state.nightScan += dt) > (state.upT < 20 ? 1 : 6)
            ) {
                state.nightScan = 0;
                scanNightMaterials();
                applyNightMaterials();
            }
            if (state.envDirty) {
                state.envTexture = sky.renderEnv();
                scene.environment = state.envTexture;
                scene.environmentIntensity = state.envIntensity;
                state.envDirty = false;
            }
            camera.updateMatrixWorld();
            // high-res character shadow cascade follows the player (feature-detected)
            const po =
                typeof window !== "undefined"
                    ? window.__ctx?.player?.object
                    : null;
            if (po) {
                po.getWorldPosition(_pp);
                csm.setFocus(_pp);
                if ((state.charScan = (state.charScan || 0) + 1) % 30 === 1)
                    csm.setCharacter(po);
            } else csm.setFocus(null);
            csm.update(camera, scene);
            cityLights.build(camera); // (night) local light grid around the camera
            {
                const o = cityLights.shared.origin;
                ambShared.cgrid.set(o.x, o.y, o.z * 64, o.w);
            }
        },
    };
    if (typeof window !== "undefined") {
        window.setTOD = (v) => setPreset(v); // (lighting2 r3) blended
        window.__nightK = nightK; // (daynight)
        window.__cityLights = cityLights; // (night)
    }
    return lighting;
}
