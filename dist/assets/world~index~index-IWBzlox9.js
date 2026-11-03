import{B as e,Dt as t,Gt as n,Hn as r,Ht as i,Lt as a,Qi as o,Rn as s,U as c,Wi as l,Wr as u,ar as d,ct as f,dt as p,fa as m,in as h,ir as g,j as _,ja as v,jt as y,mr as b,pr as x,qa as S,ro as C,sn as w,ta as T,wr as E}from"./three~index~index~shots~index~GLTFLoader-BF58tRDi.js";import{i as D}from"./three~index~shots~index-BGl7d7Kg.js";import{f as O,n as k,s as A}from"./world~index~shots~index-j5keBes7.js";import{n as j}from"./world~index~index-CVJXHhC_.js";import{$ as M,M as N,P,V as ee,_t as te,b as F,bt as ne,gt as re,j as ie,mt as ae,nt as I,ot as oe,p as L,s as R,st as z,u as B,v as se,vt as ce,y as V,yt as le}from"./world~index~index-CSBGk-H8.js";import{A as ue,M as H,O as de,P as U,c as fe,h as W,j as pe,s as me}from"./world~index~index-DioD5Y6t.js";import{f as he,m as ge,u as G}from"./world~index~index-B_X-vdov.js";import{t as _e}from"./world~index~index~shots~index-eJmDYCna.js";import{r as ve}from"./three~index~shots~index~GLTFLoader-DLicXGnK.js";var ye=`#include <common>
out vec3 vLWP;`,be=`#include <color_vertex>\r
        vWin = color.b > 5.0 ? 1.0 : 0.0; vGl = color.b > 15.0 ? 1.0 : 0.0;\r
        vColor.b = color.b > 15.0 ? color.b - 20.0 : color.b > 5.0 ? color.b - 10.0 : color.b;`,xe=`#include <fog_vertex>
vWPm = (modelMatrix * vec4(transformed, 1.0)).xyz;`,K=`#include <common>\r
      in vec3 vWPm; in float vWin; in float vGl; uniform float uNightK;\r
      float mh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,q=`#include <color_fragment>\r
        vec3 dnE = vec3(0.0); // (daynight) lit windows at night\r
        if (vWin > 0.5) {\r
          // (round 3) readable facades at 1-5 km: dark glazing with a per-window sky / blind variation, spandrels,\r
          // a pale parapet / cornice line, grimy darker base. Averages to the same tone once sub-pixel (no shimmer).\r
          float along = vWPm.x + vWPm.z;\r
          vec2 fw = fwidth(vec2(vWPm.y / 3.3, along / 2.4));\r
          float sub = clamp(max(fw.x, fw.y) * 1.3, 0.0, 1.0);\r
          vec3 base = diffuseColor.rgb;\r
          if (vGl > 0.5) {\r
            float mul = fract(along / 1.6), fl = fract(vWPm.y / 3.9);\r
            float frame = max(1.0 - step(0.1, mul), 1.0 - step(0.12, fl));\r
            vec3 gl = mix(vec3(0.1, 0.13, 0.16), vec3(0.34, 0.4, 0.46), smoothstep(0.0, 180.0, vWPm.y) * 0.6 + 0.25 * mh(floor(vec2(along / 1.6, vWPm.y / 3.9))));\r
            vec3 c = mix(gl, base * 0.9, frame * 0.8);\r
            diffuseColor.rgb = mix(c, mix(vec3(0.14, 0.17, 0.2), vec3(0.28, 0.33, 0.37), smoothstep(0.0, 200.0, vWPm.y)), sub);\r
            dnE = mix(vec3(0.8, 0.88, 1.0) * (1.0 - frame) * step(0.8, mh(floor(vec2(along / 1.6, vWPm.y / 3.9)) + 5.3)) * 0.5, vec3(0.009, 0.01, 0.012), sub); // (night) sparser, dimmer // (daynight, lighting2 r3) sub-pixel mean was 0.3 (x1.4 x night exposure ~3.6): the far shores glowed as a pale band\r
          } else {\r
            float fl = fract((vWPm.y - 1.2) / 3.3), u = fract(along / 2.4);\r
            float w = step(0.3, fl) * step(fl, 0.82) * step(0.28, u) * step(u, 0.74);\r
            vec2 wid = floor(vec2(along / 2.4, (vWPm.y - 1.2) / 3.3));\r
            vec3 wc = vec3(0.07, 0.08, 0.095) * (0.7 + 0.9 * mh(wid)) + vec3(0.1, 0.09, 0.07) * step(0.93, mh(wid + 3.1));\r
            vec3 c = mix(base, wc, w);\r
            c = mix(c, mix(base, wc, 0.33), sub);\r
            diffuseColor.rgb = c;\r
            dnE = mix(vec3(1.0, 0.72, 0.42) * w * step(0.85, mh(wid + 7.7)) * (0.2 + 0.5 * mh(wid + 2.9)), vec3(0.012, 0.0085, 0.005), sub); // (night) sparse warm sparkle; the sub-pixel mean (was 0.026: x1.4 x4.5 exposure = the tan band) matches it\r
          }\r
          diffuseColor.rgb *= 0.62 + 0.38 * smoothstep(0.0, 14.0, vWPm.y - __SHADER_INJECT_0__);   // contact darkening\r
        }\r
        diffuseColor.rgb *= 1.0 - 0.85 * uNightK; // (night) dark silhouettes at night (critic r1, r3)`,Se=`#include <emissivemap_fragment>
totalEmissiveRadiance += dnE * uNightK * 1.4;`,Ce=`#include <fog_vertex>
vLWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`,we=`#include <common>\r
      in vec3 vLWP;\r
      float lh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,Te=`#include <map_fragment>\r
      {\r
        vec2 p = vLWP.xz;\r
        vec2 cell = vec2(96.0, 210.0);\r
        vec2 q = p / cell, id = floor(q), f = fract(q);\r
        float r = lh(id), nb = lh(floor(p / 1400.0));\r
        vec3 blk = mix(vec3(0.29, 0.27, 0.25), vec3(0.4, 0.36, 0.32), r); // (r14: darker, warmer)\r
        if (r > 0.93 || nb < 0.1) blk = vec3(0.26, 0.31, 0.22);             // parks / cemeteries\r
        else if (nb > 0.8) blk *= vec3(1.05, 1.0, 0.95);                     // industrial / lighter\r
        // (round 3) street-tree / back-yard canopy mottling: the hinterland reads as leafy boroughs, not a grey slab\r
        float tc = lh(floor(p / 38.0)) * 0.6 + lh(floor(p / 330.0)) * 0.4;\r
        blk = mix(blk, vec3(0.16, 0.19, 0.12), smoothstep(0.45, 0.8, tc) * 0.75);\r
        vec2 e = min(f, 1.0 - f) * cell;\r
        float st = 1.0 - smoothstep(5.0, 8.0, min(e.x, e.y));\r
        vec3 c = mix(blk, vec3(0.2, 0.2, 0.21), st);\r
        // (round 6) arterial boulevards (same grid as the baked map) keep the road hierarchy readable to the horizon\r
        float art = min(abs(mod(p.x - 350.0 + 550.0, 1100.0) - 550.0), abs(mod(p.y - 180.0 + 475.0, 950.0) - 475.0));\r
        c = mix(c, vec3(0.15, 0.15, 0.16), 1.0 - smoothstep(11.0, 14.0, art));\r
        vec2 fw = fwidth(q);\r
        c = mix(c, vec3(0.33, 0.33, 0.31), clamp(max(fw.x * 4.0, fw.y * 8.0), 0.0, 1.0));\r
        vec2 uvm = vMapUv;\r
        float inMap = step(0.0, uvm.x) * step(uvm.x, 1.0) * step(0.0, uvm.y) * step(uvm.y, 1.0);\r
        float edge = inMap * smoothstep(0.0, 0.03, min(min(uvm.x, 1.0 - uvm.x), min(uvm.y, 1.0 - uvm.y)));\r
        diffuseColor.rgb = mix(c, diffuseColor.rgb, edge);\r
      }`,Ee=`#include <common>
out vec3 vCW;`,De=`#include <fog_vertex>
vCW = (modelMatrix * vec4(transformed, 1.0)).xyz;`,Oe=`#include <common>\r
      in vec3 vCW;\r
      float ch(float x) { return fract(sin(x * 91.7) * 43758.5453); }\r
      float vn(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(ch(i), ch(i + 1.0), f); }`,ke=`{\r
        float u = vCW.z * 0.97 + vCW.x * 0.24, y = vCW.y;\r
        float cu = u / (3.5 + 2.0 * vn(u * 0.05)), cid = floor(cu), cf = fract(cu);\r
        float joint = 1.0 - smoothstep(0.0, 0.12, min(cf, 1.0 - cf));\r
        vec3 c = mix(vec3(0.15, 0.14, 0.13), vec3(0.23, 0.2, 0.17), ch(cid)) * (0.85 + 0.3 * vn(y * 0.3 + cid));\r
        c = mix(c, vec3(0.36, 0.25, 0.18), smoothstep(0.55, 0.9, vn(u * 0.013 + y * 0.02)) * 0.5);   // iron staining\r
        c *= 1.0 - 0.55 * joint;\r
        float ledge = smoothstep(0.82, 0.97, fract(y / (9.0 + 3.0 * vn(u * 0.02))));\r
        vec3 moss = mix(vec3(0.12, 0.15, 0.07), vec3(0.2, 0.19, 0.09), vn(u * 0.2));\r
        float veg = max(ledge * 0.7, smoothstep(__SHADER_INJECT_0__, __SHADER_INJECT_1__, y + 6.0 * vn(u * 0.07))) * step(0.35, vn(u * 0.11 + y * 0.05));\r
        c = mix(c, moss, veg * 0.85);\r
        // wooded talus slope over the lower third (scrub and trees climbing the scree), ragged upper edge\r
        float talus = 1.0 - smoothstep(0.0, 4.0, y - (__SHADER_INJECT_2__ + 12.0 * vn(u * 0.031) + 5.0 * vn(u * 0.17)));\r
        vec3 wood = mix(vec3(0.07, 0.085, 0.045), vec3(0.14, 0.12, 0.06), vn(u * 0.4 + y * 0.3)) * (0.7 + 0.5 * vn(u * 1.3 + y * 0.9));\r
        c = mix(c, wood, talus);\r
        diffuseColor.rgb = c;\r
      }`,Ae=`#include <common>
out vec3 vWPm; out float vWin; out float vGl; out vec3 vBx;`,je=`#include <common>
__SHADER_INJECT_0__`,Me=`#include <lights_fragment_maps>\r
      #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV ) && defined( RE_IndirectSpecular )\r
      {\r
        float cg = clamp(gGlass, 0.0, 1.0);\r
        // (render r-refl) the player / web / near peds mirrored about this glass plane (render/glassmirror.js), laid over the\r
        // glass's own (procedural city) reflection below, before the sash dimming and the Fresnel / specular BRDF\r
        vec4 gmS = cg > 0.001 ? glassMirror(vWPos, normalize(vWN)) : vec4(0.0);\r
        if (cg > 0.001 && vWPos.y <= 2.0) radiance = mix(radiance, gmS.rgb, gmS.a);\r
        if (cg > 0.001 && vWPos.y > 2.0) {\r
          vec3 Rw = inverseTransformDirection(reflect(-geometryViewDir, normal), viewMatrix);\r
          float az = atan(Rw.z, Rw.x) * 7.0 + vS.y * 3.1;\r
          float bk = floor(az), fa = fract(az);\r
          float h1 = fh1(vec2(bk, 3.7)), h2 = fh1(vec2(bk, 9.1)), h3 = fh1(vec2(bk + 0.5, 1.3));\r
          // skyline elevation seen from this window: lower windows see taller neighbours\r
          float hsky = mix(0.03, 0.36, h1 * h1) * (1.0 + 0.8 * (1.0 - smoothstep(20.0, 260.0, vWPos.y))); // (skyline r4) more sky in mid-height glass\r
          hsky *= step(0.12, h3) * (0.85 + 0.3 * step(abs(fa - 0.5), 0.3 * h2)); // gaps + narrower upper shafts\r
          if (vX.z > 3.5 && vX.z < 4.5) hsky *= 0.35; // (skyline r3) the supertall low-iron glass stands above its neighbours: mostly sky\r
          float fwR = fwidth(Rw.y) + 0.004;\r
          float bldg = 1.0 - smoothstep(hsky - fwR, hsky + fwR, Rw.y);\r
          vec3 hz = textureCubeUV(envMap, envMapRotation * normalize(vec3(Rw.x, 0.06, Rw.z)), 0.7).rgb * envMapIntensity;\r
          float sunF = h2 > 0.55 ? 0.58 : 0.27;                          // sunlit vs shaded neighbour face\r
          float rows = 0.8 + 0.2 * step(0.5, fract(Rw.y * 180.0 / max(0.4, 1.0 + 60.0 * fwR)));\r
          vec3 cityC = hz * mix(vec3(0.95, 0.9, 0.82), vec3(0.75, 0.82, 0.95), h3) * sunF * rows;\r
          vec3 streetC = hz * vec3(0.16, 0.17, 0.19);\r
          // (skyline r7) critic: 'right-edge tower is a flat black checkerboard, no reflection'. A high window's steep\r
          // downward ray does not reach the street: it sees the roofscape / lower facades (mid grey, broken up into\r
          // sunlit roofs, shaded canyons and pale parapets) -> dark-but-structured glass instead of a black grid\r
          {\r
            vec2 rq = Rw.xz / max(-Rw.y, 0.2) * (0.6 + 0.5 * vS.y) * 9.0;\r
            float rb = fh1(floor(rq)), rb2 = fh1(floor(rq * 0.37) + 4.1);\r
            vec3 roofC = hz * mix(vec3(0.34, 0.36, 0.39), vec3(0.6, 0.6, 0.59), rb) * (0.75 + 0.35 * rb2); // (skyline r10) lighter: glass seen from above picks up the pale city\r
            streetC = mix(streetC, roofC, smoothstep(35.0, 160.0, vWPos.y));\r
          }\r
          // (skyline r6) critic: 'glass is a matte dark grid, no reflections'. A shallow downward ray (tower seen from above\r
          // or from far away) mirrors the hazy far city / horizon, not the street: bright, cool, with the neighbours'\r
          // lit / shaded faces; only steep rays reach the dark street floor\r
          vec3 farC = hz * mix(vec3(0.62, 0.66, 0.72), vec3(0.9, 0.92, 0.96), h2) * (0.9 + 0.1 * rows);\r
          float dn = smoothstep(0.0, -0.06, Rw.y);\r
          cityC = mix(cityC, farC, dn * (1.0 - smoothstep(-0.12, -0.4, Rw.y)));\r
          cityC = mix(cityC, streetC, smoothstep(-0.4, -0.85, Rw.y));\r
          cityC *= 1.0 - 0.85 * uNightK; // (night) the reflected neighbours / streets are dark masses at night (the horizon-glow tint turned far glass towers pale)\r
          cityC = mix(cityC, radiance, 0.24); // keep a hint of sky / haze in the reflected city (stylised, like the refs)\r
          radiance = mix(radiance, cityC, bldg * cg * (1.0 - 0.5 * smoothstep(0.35, 0.8, material.roughness)));\r
          radiance = mix(radiance, gmS.rgb, gmS.a); // (render r-refl)\r
          radiance *= (1.0 - 0.4 * cg * gSash) /* (textures r4) 0.72 -> 0.4 */ * mix(1.0, gSashV, cg * gSash); // (street r11) per-window reflectance // (street r10) old sash glass in a canyon: dim, dusty reflections (dark holes, not pale panes)\r
        }\r
      }\r
      #endif`,Ne=`#include <fog_vertex>
__SHADER_INJECT_0__`,Pe=`#include <common>
__SHADER_INJECT_0____SHADER_INJECT_1__`,Fe=`Surf FS; facade(FS);
#ifdef FAR_NIGHT
FS.alb *= 1.0 - 0.8 * uNightK; // (night) far shores: dark silhouettes at night (critic r1: beige-peach masses read like dusk)
#endif
diffuseColor.rgb = FS.alb;`,Ie=`float roughnessFactor = FS.rough;`,Le=`float metalnessFactor = FS.metal;`,Re=`\r
        {\r
          vec3 Nw = normalize(vWN);\r
          vec3 Tw = Nw.y > 0.5 ? vec3(1.0, 0.0, 0.0) : (Nw.y < -0.5 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), Nw)));\r
          vec3 Bw = Nw.y > 0.5 ? vec3(0.0, 0.0, -1.0) : (Nw.y < -0.5 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0));\r
          vec3 nw = normalize(Tw * FS.n.x + Bw * FS.n.y + Nw * FS.n.z);\r
          normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);\r
        }`,J=`#include <emissivemap_fragment>
totalEmissiveRadiance += FS.emis;
if (uNightK > 0.0) totalEmissiveRadiance += FS.alb / max(1.0 - gAoT, 0.4) * (1.0 - 0.6 * FS.metal) * crownFlood(vWPos, normalize(vWN)) * uNightK; // (night) crown floods`,ze=`#include <lights_physical_fragment>
material.specularColor = mix(material.specularColor, vec3(gF0) * gSpecTint, clamp(gGlass, 0.0, 1.0));
material.specularF90 = mix(material.specularF90, 0.55, clamp(gGlass, 0.0, 1.0) * gSash); // (textures r4) 0.3 -> 0.55`,Be=`\r
in vec4 aF; in vec4 aS; in vec4 aW; in vec4 aX; in vec3 aTint;\r
out vec2 vFac; flat out vec4 vF; flat out vec4 vS; flat out vec4 vW; flat out vec4 vX; flat out vec3 vTint;\r
out vec3 vWPos; out vec3 vWN;\r
`,Ve=`\r
vFac = uv; vF = aF; vS = aS; vW = aW; vX = aX; vTint = aTint;\r
vec4 fwp = modelMatrix * vec4(transformed, 1.0);\r
vWPos = fwp.xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);\r
`,He=`\r
uniform highp sampler2DArray tWallC; uniform highp sampler2DArray tWallN; uniform highp sampler2DArray tWallH; uniform sampler2D tDetail;\r
uniform sampler2D tInterior; uniform sampler2D tSigns; uniform sampler2D tNoise;\r
uniform float uInteriorGain; uniform float uShopGain; uniform float uNightK; uniform float uDnTime; // (daynight)\r
// (night) landmark crown floodlights (addCrownFlood): per flood A = lit box x0,z0,x1,z1; B = y0 (terrace), y1, reach\r
// (m), pad; C = rgb x gain. uFlBB: union box (x0, z0, x1, z1), uFlY: lowest y0, count\r
uniform vec4 uFl[__SHADER_INJECT_0__]; uniform vec4 uFlBB; uniform vec2 uFlY;\r
vec3 crownFlood(vec3 p, vec3 n) {\r
  vec3 E = vec3(0.0);\r
  if (uFlY.y < 0.5 || p.y < uFlY.x - 0.5 || p.x < uFlBB.x || p.z < uFlBB.y || p.x > uFlBB.z || p.z > uFlBB.w) return E;\r
  for (int i = 0; i < __SHADER_INJECT_1__; i++) {\r
    if (float(i) >= uFlY.y) break;\r
    vec4 A = uFl[i * 3], B = uFl[i * 3 + 1], C = uFl[i * 3 + 2];\r
    if (p.y < B.x - 0.3 || p.y > B.y || p.x < A.x - B.w || p.x > A.z + B.w || p.z < A.y - B.w || p.z > A.w + B.w) continue;\r
    float h = B.z > 0.0 ? p.y - B.x : B.y - p.y; // reach < 0: spill falling off DOWNWARD from y1 (under a lit lip)\r
    float rz = abs(B.z);\r
    // fixtures on the terrace aimed up the face: brightest just above the setback, a long soft falloff, a scallop per\r
    // fixture along the face (4 m pitch); soffits / ledge undersides catch it, terrace floors a little\r
    float along = abs(n.x) > 0.5 ? p.z : p.x;\r
    float sc = 0.8 + 0.2 * cos(along * 1.5708) * exp(-h / (0.6 * rz));\r
    float f = (0.01 + 0.99 * exp(-h / rz)) * smoothstep(-0.3, 0.4, h) * sc; // (critic r1/r3) a 3-4 m up-light band at each setback lip, ~20 % by the next setback\r
    if (C.w > 0.0) { float sp = max(cos(along * 6.2832 / C.w), 0.0); f *= 0.25 + 0.75 * sp * sp; } // (night) vertical flood streaks on the piers, dark mullions between (C.w = pitch m)\r
    E += C.rgb * f * (abs(n.y) < 0.5 ? 1.0 : (n.y < 0.0 ? 0.9 : 0.3));\r
  }\r
  return E;\r
}\r
in vec2 vFac; flat in vec4 vF; flat in vec4 vS; flat in vec4 vW; flat in vec4 vX; flat in vec3 vTint;\r
in vec3 vWPos; in vec3 vWN;\r
\r
float fh1(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }\r
float fh1b(vec3 p) { return fh1(p.xy + p.z * 17.13); }\r
// (night) integer hash (lowbias32), mirrored bit-exactly in JS (nh3js): lit-window decisions shared with the window-light provider\r
uint nhu(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }\r
uint nh3(uint a, uint b, uint c) { return nhu(a * 73856093u ^ nhu(b * 19349663u ^ nhu(c * 83492791u))); }\r
float nh01(uint h) { return float(h >> 8) / 16777216.0; }\r
float layerScale(float L) {\r
  if (L > 12.5) return L < 13.5 ? 3.0 : (L < 14.5 ? 3.0 : 1.8); // (textures r2) terracotta 8 rows / 3 m, stucco, red brick 2 (24 courses)\r
  return L < 2.5 ? 1.8 /* (street r10) 2.4 -> 1.8: finer brick (director: 'brick texel scale reads too big') */ : (L < 3.5 ? 3.0 : (L < 4.5 ? 4.0 : (L < 5.5 ? 3.0 : (L < 6.5 ? 2.0 : (L < 7.5 ? 2.4 : (L < 8.5 ? 8.0 : (L < 9.5 ? 4.0 : (L < 10.5 ? 8.0 : (L < 11.5 ? 8.0 : 4.0)))))))));\r
}\r
// relief depth (m) of each layer's height map, for parallax\r
float layerDepth(float L) { if (L > 12.5) return L < 13.5 ? 0.008 : (L < 14.5 ? 0.004 : 0.014); /* (textures r2) */ return L < 2.5 ? 0.014 : (L < 3.5 ? 0.01 : (L < 4.5 ? 0.008 : (L < 7.5 ? 0.004 : (L < 8.5 ? 0.006 : (L < 9.5 ? 0.02 : (L < 10.5 ? 0.004 : (L < 11.5 ? 0.008 : 0.02))))))); }\r
vec3 gVt = vec3(0.0, 0.0, 1.0); float gPar = 0.0; float gDet = 0.0; vec2 gOff = vec2(0.0);\r
struct Surf { vec3 alb; float rough; float metal; vec3 n; vec3 emis; };\r
vec2 gDx, gDy; float gLodI; float gGlass = 0.0; float gF0 = 0.04; // coated-glass reflectance weight/value // screen-space UV gradients (computed in uniform control flow)\r
float gWeather = 0.0;\r
Surf wallSurf(vec2 uvm, float L, vec3 tint) {\r
  float s = layerScale(L);\r
  vec2 uv = (uvm + gOff) / s;\r
  vec2 dx = gDx / s, dy = gDy / s;\r
  // (textures r3) limestone ashlar (L3): the 3 m tile's 6 courses repeat block-for-block on close walls. Each course\r
  // (bed joints measured in walls_col layer 3: v' = fract(v - 0.1455) at 0/.1694/.3398/.5097/.6797/.8301) gets its own\r
  // random slide along the wall (the seam hides in the bed joint) and each block (head joints: even courses 0.6367, odd\r
  // 0.3174 / 0.955) its own tone, so no two courses or blocks line up across tiles. Pure UV math, no texture tap.\r
  float lsTone = 1.0; vec3 lsHue = vec3(1.0);\r
  if (L > 2.5 && L < 3.5) {\r
    float vp = uv.y - 0.1455, fy = fract(vp);\r
    float ri = fy < 0.1694 ? 0.0 : (fy < 0.3398 ? 1.0 : (fy < 0.5097 ? 2.0 : (fy < 0.6797 ? 3.0 : (fy < 0.8301 ? 4.0 : 5.0))));\r
    float g = floor(vp) * 6.0 + ri;\r
    vec2 bs = gOff * 3.17 + vec2(g * 0.713, g * 1.37);\r
    uv.x += fh1(bs);\r
    float odd = mod(ri, 2.0);\r
    float tx = uv.x - (odd > 0.5 ? 0.3174 : 0.6367);\r
    float bk = odd > 0.5 ? floor(tx) * 2.0 + step(0.6376, fract(tx)) : floor(tx);\r
    float h1 = fh1(bs + vec2(bk * 0.917, 3.3)), h2 = fh1(bs + vec2(5.1, bk * 1.31));\r
    lsTone = 0.86 + 0.2 * h1;\r
    lsHue = mix(vec3(1.0), h2 > 0.5 ? vec3(1.04, 1.0, 0.93) : vec3(0.95, 0.97, 1.0), abs(h2 - 0.5) * 1.6);\r
  }\r
  // parallax offset from the baked height (close range only; 2 taps: coarse + refine)\r
  vec3 hao = textureGrad(tWallH, vec3(uv, L), dx, dy).rgb;\r
  if (gPar > 0.0) {\r
    vec2 pv = gVt.xy / max(gVt.z, 0.35) * layerDepth(L) / s * gPar;\r
    vec2 uv1 = uv + pv * (hao.r - 0.55);\r
    hao = textureGrad(tWallH, vec3(uv1, L), dx, dy).rgb;\r
    uv = uv + pv * (hao.r - 0.55);\r
  }\r
  // footprint (texels per pixel): when the mortar / gravel period nears 2-4 px, pre-filter a little harder, lower the\r
  // pattern contrast toward the layer average and convert lost normal variance into roughness (Toksvig-style)\r
  float tpp = min(length(dx), length(dy)) * 1024.0; // minor footprint axis: the major axis at grazing angles is anisotropic filtering's job\r
  float fl = smoothstep(3.0, 10.0, tpp);\r
  dx *= 1.0 + 0.3 * fl; dy *= 1.0 + 0.3 * fl;\r
  vec3 c = textureGrad(tWallC, vec3(uv, L), dx, dy).rgb;\r
  vec3 d = textureGrad(tWallN, vec3(uv, L), dx, dy).rgb;\r
  vec3 cAvg = textureLod(tWallC, vec3(0.5, 0.5, L), 10.0).rgb;\r
  c = mix(c, cAvg, 0.15 * fl); // light touch: the mips already average the mortar\r
  // one coherent, weathered-muted palette (user feedback): pull every layer toward its own average (-15 % contrast)\r
  // and desaturate 18 %, keeping the layer's brightness\r
  c = mix(cAvg, c, 0.85);\r
  c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 0.82);\r
  c *= lsTone * lsHue; // (textures r3) per-block limestone tone\r
  // (textures) building-scale weathering the 1.8 m brick tile cannot carry without repeating (refs/city3 street_curvedcurb):\r
  // peeling whitewash / old paint left on the brick faces (mortar shows through), darker re-pointed / patched brick areas,\r
  // and blotchy stains on stone + concrete. World-space macro noise per building (gOff), no extra texture fetch but two\r
  // lod-0 noise taps.\r
  if (L < 4.5 || L > 12.5 || (L > 6.5 && L < 7.5)) { // (textures r2) + terracotta / stucco / red brick 2 / white brick (critic: 'white brick clean')\r
    vec2 wq = uvm + gOff * 13.0;\r
    vec3 n1 = textureLod(tNoise, wq / vec2(17.0, 11.0), 0.0).rgb;\r
    vec3 n2 = textureLod(tNoise, wq / vec2(2.3, 1.7) + 0.37, 0.0).rgb;\r
    float face = smoothstep(0.3, 0.62, hao.r);\r
    if (L < 2.5 || L > 14.5) {\r
      float bsel = fract(gOff.x * 7.13 + gOff.y * 3.1); // only ~1 in 3 brick buildings carries old paint\r
      float pAmt = (L < 0.5 || L > 14.5 ? 1.0 : (L < 1.5 ? 0.6 : 0.4)) * step(bsel, 0.25); // (textures r2) 0.35 -> 0.25 of brick buildings\r
      float paint = smoothstep(0.76, 0.86, n1.r + 0.05 * (n2.g - 0.5)) * pAmt; // (textures r5) softer, fewer: 'noisy white speckle' // (textures r2) 0.7 -> 0.74: read as leprous speckle\r
      vec3 pc = vec3(0.68, 0.66, 0.62) * (0.88 + 0.16 * n2.b);\r
      c = mix(c, mix(pc, c, 0.3), paint * mix(0.5, 1.0, face) * 0.42); // (textures r5) 0.6 -> 0.42\r
      float rep = smoothstep(0.7, 0.76, n1.g + 0.15 * (n2.r - 0.5));\r
      c *= mix(vec3(1.0), vec3(1.02, 0.9, 0.86) * 0.86, rep * face);\r
      c *= 1.0 - 0.1 * smoothstep(0.55, 0.8, n1.b) * (1.0 - face * 0.5); // dirty mortar patches\r
    } else {\r
      float st = smoothstep(0.55, 0.85, n1.g * 0.8 + n2.r * 0.35);\r
      c *= 1.0 - 0.16 * st;\r
      c = mix(c, c * vec3(1.03, 1.0, 0.94), smoothstep(0.6, 0.8, n1.r) * 0.6);\r
    }\r
  }\r
  // (textures r4) critic: 'brick washed out, too much sheen, weak mortar'. Brick: darker recessed mortar (height-driven,\r
  // fades once the joints are sub-pixel), matte faces with per-brick roughness breakup; all masonry gets a stronger relief\r
  // normal at close / mid range so walls stop reading as printed images\r
  bool brickL = L < 2.5 || L > 14.5 || (L > 6.5 && L < 7.5);\r
  bool masonL = L < 4.5 || L > 5.5 && L < 8.0 || L > 12.5;\r
  if (brickL) c *= mix(mix(0.62, 0.8, fl), 1.0, smoothstep(0.28, 0.55, hao.r));\r
  float rbk = textureLod(tNoise, uv * vec2(9.0, 22.0) + 0.3, 0.0).g; // per-brick-ish roughness breakup\r
  Surf o; o.alb = c * tint * mix(1.0, hao.g, 0.7 * (1.0 - 0.3 * fl)); o.rough = min(1.0, d.b + 0.12 * fl); o.metal = (L > 4.5 && L < 5.5) ? 0.6 : 0.0;\r
  if (masonL) o.rough = clamp(max(o.rough, 0.74) + 0.18 * (rbk - 0.5), 0.6, 1.0);\r
  vec2 nxy = (d.rg * 2.0 - 1.0) * (1.0 - 0.5 * fl) * (masonL ? 1.0 + 0.7 * (1.0 - fl) : 1.0); // (textures r4) x1.7 relief\r
  if (gDet > 0.0) { // micro detail normal (0.5 m tile) close to the camera\r
    vec2 dn = textureGrad(tDetail, uvm * 2.0, gDx * 2.0, gDy * 2.0).rg * 2.0 - 1.0;\r
    nxy += dn * gDet * (L > 4.5 && L < 7.5 ? 0.25 : 0.6);\r
  }\r
  o.n = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));\r
  o.emis = vec3(0.0);\r
  gWeather = hao.b;\r
  return o;\r
}\r
// (textures r2) grime / leak decal sheet ($imagegen, walls_hao layer 16): R, G, B each hold 8 columns of vertical\r
// streak masks (1 = soot) whose source is at the top. q.x 0..1 across the decal, q.y 0 (source) .. 1 (fade end); g = dq\r
// per unit of vFac (screen gradients come from gDx / gDy, computed in uniform control flow)\r
float grimeDecal(vec2 q, vec2 g, float id) {\r
  if (q.x <= 0.0 || q.x >= 1.0 || q.y <= 0.0 || q.y >= 1.0) return 0.0;\r
  float col = mod(id, 8.0), ch = floor(id / 8.0);\r
  vec2 k = vec2(g.x / 8.0, -g.y);\r
  vec3 m = textureGrad(tWallH, vec3((col + clamp(q.x, 0.02, 0.98)) / 8.0, 1.0 - q.y, 16.0), gDx * k, gDy * k).rgb;\r
  return ch < 0.5 ? m.r : (ch < 1.5 ? m.g : m.b);\r
}\r
// AA box mask: 1 inside [a,b] with filter width w\r
// box-filtered coverage of [a,b] over the pixel footprint [x - w/2, x + w/2]: features thinner than a pixel fade to\r
// their true coverage instead of popping between 0 and >= 0.5 (mullion / frame crawl)\r
float boxAA(float x, float a, float b, float w) { w *= 1.2; return clamp((min(b, x + 0.5 * w) - max(a, x - 0.5 * w)) / w, 0.0, 1.0); }\r
// skyline: box-filtered coverage of the PERIODIC interval [a,b] + k*p over [x - w/2, x + w/2] (exact integral of the\r
// periodic step). Resolves window rows / piers at any distance and converges to the true average (b-a)/p once the\r
// period is sub-pixel -> distant towers keep their floor bands and pier lines instead of turning into flat boxes.\r
float pInt(float x, float p, float a, float b) { float k = floor(x / p); return k * (b - a) + clamp(x - k * p - a, 0.0, b - a); }\r
float pbox(float x, float p, float a, float b, float w) { w = max(w, 1e-4); return clamp((pInt(x + 0.5 * w, p, a, b) - pInt(x - 0.5 * w, p, a, b)) / w, 0.0, 1.0); }\r
vec3 gSpecTint = vec3(1.0); // coated-glass reflection tint (curtain walls)\r
float gSash = 0.0; // (street r9) old masonry sash glass: lower grazing (F90) reflectance\r
float gSashV = 1.0; // (street r11) per-window reflection strength of old sash glass (wavy / dusty / cleaned panes)\r
float gAoT = 0.0; // (night) setback contact shade: the crown flood lights the un-shaded albedo (its band sits right there)\r
float gBlN = 0.0, gCurN = 0.0, gAcN = 0.0, gCovN = 0.0; // (night) blind / curtain / AC-unit masks, far-LOD glass coverage\r
vec2 gWob = vec2(0.0); // (skyline r5) low-frequency curtain-wall panel deflection (wavy, broken reflections at any range)\r
\r
// Interior mapping into a room box [0,rw]x[0,rh]x[-rd,0], entering at p (z=0) along dir (dir.z<0)\r
vec3 interior(vec2 p, vec3 dir, float rw, float rh, float rd, float tile, float lit, float shop) {\r
  vec3 invd = 1.0 / dir;\r
  float tx = dir.x > 0.0 ? (rw - p.x) * invd.x : -p.x * invd.x;\r
  float ty = dir.y > 0.0 ? (rh - p.y) * invd.y : -p.y * invd.y;\r
  float tz = -rd * invd.z;\r
  float t = min(min(tx, ty), tz);\r
  vec3 h = vec3(p, 0.0) + dir * t;\r
  float depth = clamp(-h.z / rd, 0.0, 1.0);\r
  vec2 tileUV = vec2(mod(tile, 4.0), floor(tile / 4.0));\r
  vec3 col;\r
  if (t == tz) {\r
    vec2 q = vec2(h.x / rw, h.y / rh);\r
    if (shop > 0.5 && rw > 4.5) { float nT = floor(rw / 3.2 + 0.5); q.x = fract(h.x / rw * nT); } // (night) wide shop room: the shelving wall tiles every ~3 m\r
    q = clamp(q, 0.01, 0.99);\r
    col = textureLod(tInterior, vec2((tileUV.x + q.x) / 4.0, 1.0 - (tileUV.y + 1.0 - q.y) / 4.0), gLodI).rgb;\r
  } else if (t == ty) {\r
    if (dir.y > 0.0) { // ceiling\r
      vec2 c = vec2(h.x / rw, -h.z / rd);\r
      float panel = step(abs(c.x - 0.5), 0.22) * step(abs(fract(c.y * 2.0) - 0.5), 0.18);\r
      // ceiling tiles + recessed troffers (dim in daylight, soft-edged, fading with room depth so they sit on the ceiling)\r
      float pe = smoothstep(0.26, 0.2, abs(c.x - 0.5)) * smoothstep(0.22, 0.15, abs(fract(c.y * 2.0) - 0.5));\r
      col = vec3(0.72, 0.72, 0.7) * (0.75 + 0.25 * lit) + pe * lit * vec3(0.55, 0.53, 0.48) * (1.0 + shop) * (1.0 - 0.6 * c.y);\r
      if (shop > 0.5) col *= mix(1.0, 0.5, uNightK); // (night) critic r3: shop ceilings clipped to white panels\r
    } else { // floor\r
      col = shop > 0.5 ? vec3(0.55, 0.52, 0.48) : (tile < 5.5 ? vec3(0.23, 0.24, 0.26) : vec3(0.36, 0.25, 0.17));\r
    }\r
  } else {\r
    col = textureLod(tInterior, vec2((tileUV.x + 0.5) / 4.0, 1.0 - (tileUV.y + 0.6) / 4.0), 7.0).rgb * (dir.x > 0.0 ? 0.8 : 0.7);\r
    if (shop > 0.5) col *= mix(1.0, 0.5, uNightK); // (night) shop side walls: flat mip colour, keep them subordinate to the lit shelving\r
    if (uNightK > 0.5) { // (night) side walls seen through lit windows at a grazing angle: real content (the tile's furniture /\r
      // shelving mapped along the room depth, darker, mirrored) and a lamp-light falloff from the window wall, not a flat mip\r
      vec2 sq2 = clamp(vec2(fract(-h.z / max(rd, 0.1) * 1.3), h.y / rh), 0.02, 0.98);\r
      vec3 sc2 = textureLod(tInterior, vec2((tileUV.x + (dir.x > 0.0 ? sq2.x : 1.0 - sq2.x)) / 4.0, 1.0 - (tileUV.y + 1.0 - sq2.y) / 4.0), gLodI + 1.0).rgb;\r
      col = sc2 * (dir.x > 0.0 ? 0.62 : 0.55) * (shop > 0.5 ? 0.8 : 1.0) * (0.75 + 0.35 * smoothstep(0.0, 1.0, h.y / rh));\r
    }\r
    col *= mix(0.7, 1.0, clamp(h.y / rh, 0.0, 1.0));\r
  }\r
  col *= mix(1.0, 0.55, depth);\r
  return col * mix(0.55, 1.0, lit);\r
}\r
\r
void facade(out Surf o) {\r
  vec3 N = normalize(vWN);\r
  gDx = dFdx(vFac); gDy = dFdy(vFac);\r
  o.alb = vec3(0.0); o.rough = 1.0; o.metal = 0.0; o.n = N; o.emis = vec3(0.0);\r
  float roofL = 8.0;\r
  float Lw = mod(vS.x, 16.0);\r
  float Lb = mod(floor(vS.x / 16.0 + 0.01), 16.0);\r
  float tierY = floor(vS.x / 256.0 + 0.001); // (skyline r12) base height of this set-back tier (0 = street mass)\r
  float style = vS.w + 0.01;\r
  float seed = vS.y;\r
  vec3 tint = vTint;\r
  // (textures r2) extra wall materials without touching the zoning code: a per-building hash re-skins some walls\r
  // (texture layer only; Lw keeps driving the zoning logic): ~45 % of red brick -> orange-red common-bond tenement brick,\r
  // the warm 'ochre' limestone + some buff brick -> terracotta ashlar, some low concrete / white-brick walls -> stucco\r
  float LwT = Lw;\r
  {\r
    float vq = fract(seed * 9.271 + 0.137);\r
    if (Lw < 0.5 && vq < 0.45) LwT = 15.0;\r
    else if ((Lw > 2.5 && Lw < 3.5 && vTint.r - vTint.b > 0.18 && vq < 0.8) || (Lw > 1.5 && Lw < 2.5 && vq < 0.18)) LwT = 13.0;\r
    else if (((Lw > 3.5 && Lw < 4.5) || (Lw > 6.5 && Lw < 7.5)) && vW.y - vW.z < 30.0 && vq < 0.4) LwT = 14.0;\r
    // (textures r4) critic: 'pale buff brick on every building; push brick reds / browns'. Some buff walls become\r
    // sooty brown or orange-red common brick (texture only; the zoning family / tint is kept)\r
    else if (Lw > 1.5 && Lw < 2.5 && vq >= 0.18 && vq < 0.36) LwT = 1.0;\r
    else if (Lw > 1.5 && Lw < 2.5 && vq >= 0.36 && vq < 0.5) LwT = 15.0;\r
  }\r
  // large-scale grime/tone variation\r
  vec3 nz = textureLod(tNoise, vWPos.xz / 180.0 + vWPos.y / 300.0, 0.0).rgb;\r
  vec3 nz2 = textureLod(tNoise, vWPos.xz / 23.0 + vWPos.y / 41.0 + 0.5, 0.0).rgb; // mid-scale macro variation (kills tiling)\r
  float camD = length(cameraPosition - vWPos);\r
  gPar = 1.0 - smoothstep(12.0, 35.0, camD);\r
  gDet = 1.0 - smoothstep(6.0, 22.0, camD);\r
  gOff = vec2(fract(seed * 0.618), fract(seed * 0.377)) * 8.0; // per-building texture offset: neighbours never tile in lockstep\r
  vec3 V = normalize(cameraPosition - vWPos);\r
  if (N.y > 0.5) {\r
    gVt = vec3(V.x, -V.z, V.y);\r
    vec3 rt = tint * (0.8 + 0.4 * nz.r) * (0.9 + 0.2 * nz2.g);\r
    // (textures r5) critic: 'flat pale-grey roof slabs' (uncovered roofs on the membrane layer 10: mean 0.71, almost no\r
    // detail) and 'untextured black box' (metal-panel bulkhead tops, layer 5). Per-building roof family: seamed dark\r
    // mod-bit, warm gravel ballast, buff pavers, or a dirtier grey membrane; metal bulkhead tops get rolled roofing.\r
    {\r
      float rq = fract(seed * 7.13 + 0.41);\r
      if (Lw > 9.5 && Lw < 10.5) {\r
        if (rq < 0.3) { Lw = 8.0; rt *= 1.3; }\r
        else if (rq < 0.52) { Lw = 9.0; rt *= vec3(1.08, 0.98, 0.86); }\r
        else if (rq < 0.64) { Lw = 11.0; rt *= vec3(1.02, 0.93, 0.84); }\r
        else rt *= 0.66 * vec3(1.0, 0.97, 0.93);\r
      } else if (Lw > 4.5 && Lw < 5.5) { Lw = 8.0; rt = vec3(1.25, 1.24, 1.2) * (0.9 + 0.2 * nz2.g); }\r
    }\r
    o = wallSurf(vFac, Lw, rt);\r
    // roofs: dirt collects near parapets/edges is handled by AO; add broad wet/dirty patches\r
    if (Lw > 7.5) { o.alb *= 1.0 - 0.25 * smoothstep(0.55, 0.85, nz2.b); o.rough = mix(o.rough, 0.55, smoothstep(0.6, 0.9, nz2.b) * gWeather); }\r
    if (Lw > 7.5 && gDet > 0.0) { // close range: 3.7x rotated re-sample of the same roof layer sharpens granules / gravel\r
      float sc = layerScale(Lw) / 3.7;\r
      mat2 R = mat2(0.8, -0.6, 0.6, 0.8);\r
      vec3 dcol = textureGrad(tWallC, vec3(R * vFac / sc + 0.31, Lw), R * gDx / sc, R * gDy / sc).rgb;\r
      float la = dot(textureLod(tWallC, vec3(0.5, 0.5, Lw), 10.0).rgb, vec3(0.333));\r
      o.alb *= mix(1.0, clamp(dot(dcol, vec3(0.333)) / max(la, 0.02), 0.6, 1.5), 0.45 * gDet);\r
    }\r
    // (textures r3) critic: 'flat roofs uniform dark grey with fine noise, no seams, tar patches, flashing, drains'.\r
    // World-space roof wear, all analytic (no texture tap), box-filtered by the pixel footprint so it resolves from the\r
    // rooftops to the aerial view: rolled-roofing lap seams (bitumen / membrane, 0.95 m strips, staggered end laps),\r
    // sharp-edged glossy tar repairs, roof drains with a dark silt ring, and ponding tide-lines in the low spots.\r
    if (Lw > 7.5 && Lw < 11.5) {\r
      vec2 rp = vFac + gOff * 7.0;\r
      float fw = max(length(gDx), length(gDy)) + 1e-4;\r
      bool rot = fract(seed * 3.71) > 0.5;\r
      vec2 sp = rot ? rp.yx : rp;\r
      if (Lw < 8.5 || (Lw > 9.5 && Lw < 10.5)) {\r
        float sw = 0.95, si = floor(sp.y / sw), sf = sp.y - si * sw;\r
        float lap = pbox(sp.y, sw, 0.0, 0.05, fw) ;\r
        float bleed = pbox(sp.y, sw, 0.05, 0.13, fw);\r
        float endL = 9.0 + 3.0 * fh1(vec2(si, seed)), ex = sp.x + fh1(vec2(seed, si)) * endL;\r
        float endLap = pbox(ex, endL, 0.0, 0.06, fw) * boxAA(sf, 0.05, sw, fw);\r
        float stripT = 0.94 + 0.12 * fh1(vec2(si, floor(ex / endL) + seed));\r
        float fade = 1.0 - smoothstep(0.06, 0.25, fw); // seams dissolve into the average once sub-pixel\r
        o.alb *= mix(1.0, stripT, fade);\r
        o.alb *= 1.0 - (Lw < 8.5 ? 0.3 : 0.2) * max(lap, endLap) * fade;\r
        o.alb *= 1.0 + (Lw < 8.5 ? 0.12 : -0.06) * bleed * fade;\r
        o.rough = mix(o.rough, 0.45, lap * fade * 0.6);\r
      }\r
      // tar repairs: ~1 per 3 cells of 6 x 7 m, 0.5-2.4 m, jagged-ish edges from the noise\r
      vec2 cg = vec2(6.0, 7.0), ci = floor(rp / cg), cf = rp - ci * cg;\r
      float h1 = fh1(ci + seed * 0.13), h2 = fract(h1 * 71.3 + 0.2), h3 = fract(h1 * 13.7 + 0.6);\r
      if (h1 < 0.36) {\r
        vec2 hs = vec2(0.25 + 1.0 * h2, 0.25 + 0.9 * h3), cc = vec2(1.3 + 3.4 * h3, 1.3 + 4.4 * h2);\r
        vec2 dq = abs(cf - cc) - hs;\r
        float dd = max(dq.x, dq.y) + 0.12 * (nz2.r - 0.5);\r
        float inT = 1.0 - smoothstep(-fw, fw, dd);\r
        o.alb = mix(o.alb, vec3(0.055, 0.052, 0.05) * (0.8 + 0.4 * nz2.g), inT * 0.85);\r
        o.rough = mix(o.rough, 0.32, inT);\r
      }\r
      // drains: one per 12 x 11 m cell (inset from the cell edge), dark grate + silt ring\r
      vec2 dg = vec2(12.0, 11.0), di = floor(rp / dg), df = rp - di * dg;\r
      vec2 dc = vec2(3.0, 3.0) + vec2(fh1(di + 7.1), fh1(di + 3.3)) * vec2(6.0, 5.0);\r
      float dr = length(df - dc);\r
      float silt = 1.0 - smoothstep(0.15, 1.1 + 0.4 * nz2.b, dr);\r
      o.alb *= 1.0 - 0.3 * silt;\r
      o.alb = mix(o.alb, vec3(0.03), 1.0 - smoothstep(0.13 - fw, 0.13 + fw, dr));\r
      o.rough = mix(o.rough, 0.4, silt * 0.7);\r
      // ponding: darker damp low spots with a pale dried tide-line at their edge\r
      float pn = textureLod(tNoise, rp / 9.0 + 0.71, 0.0).g * 0.7 + nz2.b * 0.3;\r
      float pond = smoothstep(0.62, 0.7, pn);\r
      float tide = (1.0 - smoothstep(0.0, 0.012 + fw * 0.05, abs(pn - 0.62))) * (1.0 - smoothstep(0.1, 0.4, fw));\r
      o.alb *= (1.0 - 0.18 * pond) * (1.0 + 0.25 * tide);\r
      o.rough = mix(o.rough, 0.5, pond * 0.5);\r
    }\r
    return;\r
  }\r
  if (N.y < -0.5) { o = wallSurf(vFac, LwT, tint * 0.6); return; } // (textures r2) LwT\r
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));\r
  vec3 Vt = vec3(dot(V, T), V.y, max(dot(V, N), 0.06));\r
  gVt = vec3(Vt.x, Vt.y, dot(V, N));\r
  vec3 dirIn = vec3(-Vt.x, -Vt.y, -Vt.z);\r
  float u = vFac.x;\r
  float y = vFac.y - vW.z;\r
  float faceW = vW.x;\r
  float topY = vW.y - vW.z;\r
  float aw = max(fwidth(u), 1e-4);\r
  float ah = max(fwidth(vFac.y), 1e-4);\r
  gLodI = clamp(log2(max(aw, ah) * 512.0 / max(vF.y, 2.0)) + 0.5, 0.0, 9.0);\r
  float gHs = vS.z;\r
  float gH = abs(gHs);\r
  // base wall\r
  // (skyline r5) per-building colour identity (value +-9 %, warm / cool shift) + broad soot blotches, so neighbouring\r
  // blocks of the same layer never read as one repeated atlas\r
  float bv = fract(seed * 13.73 + 0.29), bh = fract(seed * 5.91 + 0.61) * 2.0 - 1.0;\r
  vec3 bTone = (0.91 + 0.18 * bv) * vec3(1.0 + 0.045 * bh, 1.0 + 0.008 * bh, 1.0 - 0.05 * bh);\r
  // (textures r4) per-building masonry identity: brick walls get one of cream / buff / grey / tan / red-brown casts and a\r
  // -10..-25 % value drop (critic: 'brick bright, washed-out, the same on every building')\r
  bool brickW = LwT < 2.5 || LwT > 14.5 || (LwT > 6.5 && LwT < 7.5);\r
  if (brickW) {\r
    float pq = fract(seed * 17.31 + 0.53);\r
    vec3 bCast = pq < 0.2 ? vec3(0.9, 0.9, 0.92) : (pq < 0.4 ? vec3(1.04, 0.95, 0.84) : (pq < 0.55 ? vec3(1.08, 0.9, 0.8) : (pq < 0.7 ? vec3(0.96, 0.97, 0.98) * 0.92 : vec3(1.0))));\r
    bTone *= bCast * (0.95 - 0.13 * fract(seed * 29.7));\r
  } else if (LwT < 4.5 || LwT > 12.5) bTone *= 0.93 - 0.08 * fract(seed * 29.7);\r
  o = wallSurf(vec2(u, vFac.y), LwT /* (textures r2) */, tint * bTone * (0.88 + 0.24 * nz.g) * (0.93 + 0.14 * nz2.r) * (1.0 - 0.14 * smoothstep(0.5, 0.85, nz.b)));\r
  // ground grime & soot, dark drip band under the coping / cornice, wet-looking streak roughness\r
  o.alb *= mix(0.72, 1.0, smoothstep(0.0, 2.5, y));\r
  if (style < 1.5 || style > 2.5) {\r
    // (textures r4) heavy large-scale weathering (critic: 'repeating AO smudges, clean facades'):\r
    //  - street grime: sooty value + desaturation rising 4-12 m from the pavement, ragged top edge\r
    //  - water staining under the coping / cornice: long dark streak columns 3-14 m, some greenish\r
    //  - soot: per-building amount; big blotches weighted to the upper floors and the building corners\r
    vec3 wn = textureGrad(tNoise, vec2(u * 0.08 + seed * 0.71, y * 0.05), gDx * vec2(0.08, 0.0), gDy * vec2(0.0, 0.05)).rgb;\r
    float gTop = 4.0 + 8.0 * fract(seed * 3.77) + 3.0 * (wn.r - 0.5);\r
    float sg = (1.0 - smoothstep(0.0, gTop, y)) * (0.6 + 0.4 * wn.g);\r
    vec3 sootC = vec3(0.34, 0.32, 0.3);\r
    o.alb = mix(o.alb, o.alb * sootC * 1.5, 0.55 * sg);\r
    float colN = textureGrad(tNoise, vec2(u * 0.55 + seed * 1.3, 0.37), gDx * vec2(0.55, 0.0), gDy * vec2(0.55, 0.0)).b;\r
    float runL = 3.0 + 11.0 * colN;\r
    float dTop = topY - y;\r
    float stain = smoothstep(0.45, 0.75, colN) * (1.0 - smoothstep(0.0, runL, dTop)) * (0.65 + 0.35 * wn.b);\r
    vec3 stC = mix(vec3(0.5, 0.48, 0.46), vec3(0.46, 0.5, 0.45), step(0.7, fract(seed * 5.5)));\r
    o.alb = mix(o.alb, o.alb * stC, stain * 0.8);\r
    o.rough = mix(o.rough, 0.55, stain * 0.5);\r
    float sootAmt = fract(seed * 41.3); sootAmt = sootAmt * sootAmt;\r
    vec3 sn = textureGrad(tNoise, vec2(u, y) * 0.035 + seed * 0.19, gDx * 0.035, gDy * 0.035).rgb;\r
    float corner = 1.0 - smoothstep(0.0, 3.0, min(u, faceW - u));\r
    float soot = smoothstep(0.45, 0.8, sn.r + 0.25 * corner + 0.2 * smoothstep(0.3, 1.0, y / max(topY, 1.0))) * (0.3 + 0.7 * sootAmt);\r
    o.alb *= 1.0 - 0.24 * soot; // (textures r5) 0.38 -> 0.24: under lighting2 r3's contrast the blotches read as camouflage\r
  }\r
  if (style < 1.5 || style > 2.5) { // (textures r2) decal-sheet splash grime rising from the pavement + leaks from the coping\r
    float gs = 2.6, gi = floor(u / gs), gr = fh1(vec2(gi + seed * 1.7, seed * 5.3));\r
    float gSp = grimeDecal(vec2(u / gs - gi, y / (0.9 + 1.6 * gr)), vec2(1.0 / gs, 1.0 / (0.9 + 1.6 * gr)), floor(gr * 24.0));\r
    o.alb *= 1.0 - 0.3 * gSp;\r
    float gLen = 3.0 + 10.0 * fract(gr * 7.3);\r
    float gCo = grimeDecal(vec2(u / gs - gi, (topY - 0.2 - y) / gLen), vec2(1.0 / gs, 1.0 / gLen), floor(fract(gr * 3.7) * 24.0));\r
    o.alb *= 1.0 - 0.34 * gCo * step(0.3, fract(gr * 11.1));\r
  }\r
  float drip = (1.0 - smoothstep(0.0, 3.0, topY - y)) * (0.5 + 0.5 * textureGrad(tNoise, vec2(u * 0.35, 0.3 * seed), gDx * vec2(0.35, 0.0), gDy * vec2(0.35, 0.0)).g);\r
  o.alb *= 1.0 - 0.22 * drip;\r
  o.rough = clamp(o.rough - 0.08 * gWeather, 0.05, 1.0);\r
  // (skyline r2) long vertical rain / soot streaks (0.5-3 m wide, tens of metres long), strongest under the coping and\r
  // setback ledges, plus a soft value gradient (tall walls darken toward the street, the top floors wash out slightly)\r
  if (style < 1.5 || style > 2.5) {\r
    vec2 sq = vec2(u * 0.0045 + seed * 0.37, vFac.y * 0.0009);\r
    float stk = textureGrad(tNoise, sq, gDx * vec2(0.0045, 0.0009), gDy * vec2(0.0045, 0.0009)).g;\r
    float stk2 = textureGrad(tNoise, sq * vec2(3.1, 1.3) + 0.21, gDx * vec2(0.014, 0.0012), gDy * vec2(0.014, 0.0012)).b;\r
    float under = 0.45 + 0.55 * (1.0 - smoothstep(0.0, 26.0, topY - y));\r
    o.alb *= 1.0 - (0.2 * smoothstep(0.52, 0.8, stk) + 0.1 * smoothstep(0.55, 0.85, stk2)) * under;\r
    o.alb *= mix(0.86, 1.04, smoothstep(0.0, 70.0, y)) ;\r
    // (skyline r9) critic: 'hero tower reads as a clean smooth extrusion, no weathering / grime streaks'. Pier-scale soot\r
    // runs (2-6 m wide, 60-200 m long) washing down from every coping / setback, and a sooty band just under each ledge\r
    if (topY > 40.0) {\r
      vec2 gq9 = vec2(u * 0.19 + seed * 0.53, vFac.y * 0.006);\r
      vec2 gd9 = vec2(0.19, 0.006);\r
      float g1 = textureGrad(tNoise, gq9, gDx * gd9, gDy * gd9).r;\r
      float g2 = textureGrad(tNoise, gq9 * vec2(2.3, 0.6) + 0.37, gDx * gd9 * vec2(2.3, 0.6), gDy * gd9 * vec2(2.3, 0.6)).g;\r
      float under2 = 0.35 + 0.65 * (1.0 - smoothstep(0.0, 45.0, topY - y));\r
      o.alb *= 1.0 - 0.2 * smoothstep(0.42, 0.78, 0.6 * g1 + 0.4 * g2) * under2;\r
      o.alb *= 1.0 - 0.14 * (1.0 - smoothstep(0.0, 5.0, topY - y));\r
    }\r
  }\r
  if (style > 5.5) { // ---- skyline: stainless crown tier with a sunburst arch of triangular windows (Chrysler-like)\r
    float h = max(topY, 1.0);\r
    float ex = (u - 0.5 * faceW) / (0.5 * faceW), ey = (y + 0.3 * h) / (1.25 * h);\r
    float e = length(vec2(ex, ey)), fw = fwidth(e) + 1e-4;\r
    float ray = fract(atan(max(ey, 0.0), ex) / 3.14159265 * 9.0);\r
    float band = smoothstep(0.6 - fw, 0.6 + fw, e) * (1.0 - smoothstep(0.98 - fw, 0.98 + fw, e));\r
    float tw = clamp((0.95 - e) / 0.32, 0.0, 1.0) * 0.75;\r
    float tri = band * (1.0 - smoothstep(tw - 0.06, tw + 0.06, abs(ray - 0.5) * 2.0)) * smoothstep(0.62, 0.66, e);\r
    float rim = 1.0 - smoothstep(0.0, 2.5 * fw, abs(e - 0.99));\r
    Surf s = o;\r
    // (skyline r2) true stainless (Nirosta) reflectance: bright F0 ~0.55, brushed, so the crown flashes sky / sun\r
    vec3 ss = vec3(0.56, 0.575, 0.6) * (0.9 + 0.2 * nz2.r);\r
    s.alb = ss * mix(0.82, 1.1, band) * (1.0 - 0.35 * rim); s.metal = 0.95; s.rough = 0.2 + 0.1 * nz2.g;\r
    s.alb = mix(s.alb, vec3(0.03, 0.034, 0.04), tri); s.rough = mix(s.rough, 0.08, tri); s.metal = mix(s.metal, 0.0, tri);\r
    s.emis = vec3(0.0);\r
    s.n = normalize(vec3(0.0, 0.3 * band - 0.4 * rim, 1.0));\r
    s.emis = tri * vec3(0.85, 0.92, 1.0) * 1.6 * uNightK; gGlass = tri; gF0 = 0.1; // (night) the sunburst's triangular windows glow white (Chrysler crown)\r
    o = s; return;\r
  }\r
  if (style > 4.5) { // ---- party wall: common brick (whatever the street face is), weathering, demolished-neighbour\r
    // parge coat + flashing line, faded ghost-sign paint\r
    float r1 = fract(seed * 3.713), r2 = fract(seed * 7.137), r3 = fract(seed * 11.31);\r
    float Lp = r3 < 0.3 ? 0.0 : (r3 < 0.6 ? 15.0 : 1.0); // (textures r2) + common-bond red brick 2\r
    o = wallSurf(vec2(u, vFac.y), Lp, vec3(0.9, 0.88, 0.86) * (0.86 + 0.28 * nz.g) * (0.92 + 0.16 * nz2.r));\r
    vec3 st = textureGrad(tNoise, vec2(u * 0.23 + seed, vFac.y * 0.021), gDx * vec2(0.23, 0.0), gDy * vec2(0.0, 0.021)).rgb;\r
    o.alb *= 1.0 - 0.28 * smoothstep(0.5, 0.85, st.g) * (0.4 + 0.6 * (1.0 - smoothstep(0.0, 30.0, topY - y)));   // rain streaks from the top\r
    { // (textures r2) leak decals from the coping, 3.5 m apart, 4-16 m runs\r
      float gs = 3.5, gi = floor(u / gs), gr = fh1(vec2(gi + seed * 2.9, seed * 1.9)), gL = 4.0 + 12.0 * gr;\r
      o.alb *= 1.0 - 0.4 * grimeDecal(vec2(u / gs - gi, (topY - 0.3 - y) / gL), vec2(1.0 / gs, 1.0 / gL), floor(fract(gr * 5.3) * 24.0)) * step(0.25, fract(gr * 9.7));\r
    }\r
    o.alb *= mix(0.72, 1.0, smoothstep(0.0, 3.0, y));                                                              // street grime\r
    if (r1 < 0.6 && topY > 14.0) { // former low neighbour: parged (cement-rendered) area below its roof line, stepped profile\r
      float hN = 5.0 + r2 * min(topY - 9.0, 18.0);\r
      float stepU = faceW * (0.35 + 0.3 * r3);\r
      float hL = u < stepU ? hN : hN - 2.5 - 2.0 * r1;\r
      float parge = boxAA(y, -1.0, hL, ah) * boxAA(u, 0.4, faceW - 0.4, aw);\r
      vec3 pc = vec3(0.56, 0.54, 0.5) * (0.8 + 0.35 * st.b) * (0.85 + 0.2 * nz2.g);\r
      float flash = boxAA(y, hL - 0.08, hL + 0.05, ah) * boxAA(u, 0.4, faceW - 0.4, aw);\r
      o.alb = mix(o.alb, pc, parge * (0.75 + 0.25 * st.r)); o.rough = mix(o.rough, 0.92, parge);\r
      o.n = normalize(mix(o.n, vec3(0.0, 0.0, 1.0), parge * 0.8));\r
      o.alb = mix(o.alb, vec3(0.08, 0.08, 0.085), flash); o.metal = mix(o.metal, 0.4, flash);\r
    }\r
    if (r2 > 0.5 && faceW > 9.0 && topY > 16.0) { // ghost sign painted on the brick, high on the wall\r
      float y1 = topY - 2.0 - 2.0 * r1, u0 = faceW * 0.12, u1 = faceW * 0.88, y0 = y1 - min(min(8.0, (topY - 6.0) * 0.35), (u1 - u0) * 0.25); // (billboards r3) one 4:1 sign cell, unstretched\r
      float inS = boxAA(u, u0, u1, aw) * boxAA(y, y0, y1, ah);\r
      if (inS > 0.0) {\r
        vec2 suv = vec2((u - u0) / (u1 - u0), (y - y0) / (y1 - y0));\r
        float row = floor(r3 * 16.0), col = floor(r1 * 4.0); // (billboards r3) one cell (was: the whole 4-cell atlas row squeezed in)\r
        vec2 suv2 = vec2((col + clamp(suv.x, 0.01, 0.99)) / 4.0, 1.0 - (row + 1.0 - clamp(suv.y, 0.04, 0.96)) / 16.0);\r
        vec3 sc = textureGrad(tSigns, suv2, gDx / (u1 - u0) / 4.0, gDy / (y1 - y0) / 16.0).rgb;\r
        vec3 bd = textureGrad(tSigns, suv2, vec2(0.06, 0.0), vec2(0.0, 0.03)).rgb; // blurred cell ~ board colour\r
        float lum = dot(sc, vec3(0.3, 0.55, 0.15)), let = smoothstep(0.1, 0.24, abs(lum - dot(bd, vec3(0.3, 0.55, 0.15))));\r
        vec3 paint = mix(vec3(0.2, 0.19, 0.2), vec3(0.74, 0.68, 0.55), let); // (billboards r3) cream lettering, the dark board mostly weathered off\r
        float wear = smoothstep(0.25, 0.75, st.r + 0.3 * nz2.b) * (1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.3, fract(vFac.y / 0.075)))); // paint gone at mortar / worn\r
        o.alb = mix(o.alb, paint * (0.9 + 0.2 * nz.g), inS * mix(0.12, 0.5, let) * wear);\r
      }\r
    }\r
    // (street r11) critic: 'a completely flat, windowless brown slab'. Tall exposed lot-line walls get a few columns of\r
    // small lot-line windows (dark glass, stone sill, some bricked-up) above the old neighbour's roof line\r
    if (r1 > 0.3 && topY > 22.0 && faceW > 8.0) {\r
      float pfh = 3.2, pfl = floor(y / pfh), pfy = y - pfl * pfh;\r
      float nC = faceW > 24.0 ? 4.0 : (faceW > 14.0 ? 3.0 : 2.0), cwid = faceW / nC;\r
      float ci = floor(u / cwid), cu = u - (ci + 0.5) * cwid;\r
      float hMin = 8.0 + 10.0 * r2;\r
      float colOn = step(0.28, fract(sin(ci * 12.9 + seed * 3.1) * 437.5)) * step(hMin, y) * step(y, topY - 2.5);\r
      float wm = boxAA(cu, -0.55, 0.55, aw) * boxAA(pfy, 0.9, 2.5, ah) * colOn;\r
      float brk = step(0.8, fract(sin(ci * 7.1 + pfl * 3.7 + seed) * 911.3));             // bricked-up\r
      float sillM = boxAA(cu, -0.7, 0.7, aw) * boxAA(pfy, 0.75, 0.9, ah) * colOn;\r
      vec3 wc = mix(vec3(0.035, 0.04, 0.045) * (0.8 + 0.5 * fract(pfl * 0.37 + ci)), o.alb * 0.8, brk);\r
      o.alb = mix(o.alb, wc, wm); o.rough = mix(o.rough, mix(0.2, o.rough, brk), wm); o.metal = mix(o.metal, 0.0, wm);\r
      o.alb = mix(o.alb, vec3(0.62, 0.6, 0.55) * (0.85 + 0.2 * nz2.r), sillM); o.n = normalize(mix(o.n, vec3(0.0, 0.6, 1.0), sillM));\r
    }\r
    return;\r
  }\r
  if (style < 0.5) return;\r
\r
  bool curtain = abs(style - 2.0) < 0.5;\r
  bool ribbon = abs(style - 3.0) < 0.5;\r
  bool deco = abs(style - 4.0) < 0.5;\r
\r
  // ----------------------------------------------------------- storefront zone\r
  if (y < gH && gHs > 0.0) {\r
    float nb2 = max(1.0, floor(faceW / 6.5 + 0.5));\r
    float bw2 = faceW / nb2;\r
    float bi2 = floor(u / bw2);\r
    float fx2 = u - bi2 * bw2;\r
    float rnd = fh1(vec2(bi2 + seed * 13.1, seed * 7.7 + faceW));\r
    Surf base = wallSurf(vec2(u, vFac.y), Lb, Lb > 5.5 && Lb < 6.5 ? vec3(1.0) : tint * 0.0 + vec3(1.0));\r
    float pier = 0.35;\r
    float signY0 = gH - 1.55, signY1 = gH - 0.55;\r
    float inner = boxAA(fx2, pier, bw2 - pier, aw);\r
    o = base;\r
    if (inner <= 0.0) return;\r
    Surf s;\r
    float glassY0 = 0.55;\r
    if (y > signY1) { // cornice band\r
      s = base; s.alb *= 1.12; s.n = vec3(0.0, 0.45, 0.9);\r
    } else if (y > signY0) { // sign band\r
      float row = floor(fh1(vec2(rnd * 91.0, seed)) * 16.0);\r
      vec2 suv = vec2((fx2 - pier) / (bw2 - 2.0 * pier), (y - signY0) / (signY1 - signY0));\r
      vec3 sc = textureLod(tSigns, vec2(suv.x, 1.0 - (row + 1.0 - suv.y) / 16.0), clamp(log2(max(aw * 1024.0 / (bw2 - 2.0 * pier), ah * 128.0 / 1.0)), 0.0, 9.0)).rgb;\r
      s.alb = sc; s.rough = 0.45; s.metal = 0.0; s.n = vec3(0.0, 0.0, 1.0); s.emis = sc * 0.25 * uShopGain;\r
#ifdef FAR_NIGHT\r
      s.emis *= 1.0 - 0.8 * uNightK; // (night)\r
#endif\r
      if (rnd > 0.8) { s = base; s.alb *= 0.8; } // no sign\r
    } else if (y < glassY0) { // bulkhead\r
      s = base; s.alb *= 0.55; s.rough = 0.4;\r
    } else {\r
      float shutter = step(0.78, rnd);\r
      float gx = fx2 - pier, gw = bw2 - 2.0 * pier;\r
      if (shutter > 0.5 && y > signY0 - 0.24) { // shutter box (coil housing) closes the shutter up to the sign band\r
        float lip = boxAA(y, signY0 - 0.24, signY0 - 0.2, ah);\r
        s.alb = vec3(0.3, 0.31, 0.32) * (0.85 + 0.15 * nz.b) * (1.0 - 0.35 * lip); s.rough = 0.45; s.metal = 0.6;\r
        s.n = normalize(vec3(0.0, 0.35 * (1.0 - lip) - 0.6 * lip, 1.0)); s.emis = vec3(0.0);\r
      } else if (shutter > 0.5) {\r
        // roll-down shutter: 7.5 cm curved slats with dark interlock grooves; the relief fades out once a slat spans\r
        // < ~3 px (no stripe aliasing), bottom rail, grime rising from the pavement\r
        float P = 0.075, sy = y / P, fs = fract(sy);\r
        float amp = 1.0 - smoothstep(0.012, 0.03, ah);\r
        float slope = cos(fs * 6.2831) * amp;                               // convex slat profile\r
        float groove = (1.0 - boxAA(fs, 0.08, 0.92, ah / P)) * amp;           // interlock gap\r
        float rail = boxAA(y, glassY0 - 0.02, glassY0 + 0.1, ah);\r
        vec3 sc = vec3(0.58, 0.59, 0.6) * (0.85 + 0.15 * nz.b) * (1.0 - 0.45 * groove) * mix(0.6, 1.0, smoothstep(0.0, 1.2, y));\r
        float graf = smoothstep(0.58, 0.66, textureGrad(tNoise, vec2(u, y) / 3.0 + seed, gDx / 3.0, gDy / 3.0).g) * step(y, 2.2);\r
        sc = mix(sc, vec3(0.25 + 0.5 * rnd, 0.2, 0.6 - 0.4 * rnd), graf * 0.7);\r
        sc = mix(sc, vec3(0.2, 0.21, 0.22), rail);\r
        s.alb = sc; s.rough = 0.5 + 0.2 * groove; s.metal = 0.5 * (1.0 - graf); s.n = normalize(vec3(0.0, slope * 0.45, 1.0)); s.emis = vec3(0.0);\r
      } else {\r
        // recessed shop glass with mullions\r
        float d = 0.18;\r
        vec2 gp = vec2(gx, y) + vec2(-Vt.x, -Vt.y) / Vt.z * d;\r
        float inG = boxAA(gp.x, 0.0, gw, aw) * boxAA(gp.y, glassY0, signY0, ah);\r
        float nm = max(1.0, floor(gw / 1.8 + 0.5)); float mw = gw / nm;\r
        float mx = mod(gp.x, mw);\r
        float mull = max(1.0 - boxAA(mx, 0.05, mw - 0.05, aw), 1.0 - boxAA(gp.y, glassY0 + 0.06, signY0 - 0.06, ah));\r
        mull = max(mull, 1.0 - boxAA(abs(gp.y - (signY0 - 0.9)), 0.04, 9.0, ah));\r
        float door = step(rnd, 0.5) * boxAA(gp.x, 0.4, 1.5, aw) * step(gp.y, 2.6);\r
        bool wideR = uNightK > 0.35; // (night) one room behind the whole shop window (the per-mullion 1.8 m rooms read as flat tan corridor walls)\r
        vec3 room = interior(wideR ? vec2(gp.x, gp.y - glassY0) : vec2(mod(gp.x, mw), gp.y - glassY0), dirIn, wideR ? gw : mw, signY0 - glassY0 + 0.6, 5.0,\r
                             12.0 + floor(rnd * 4.0), 1.0, 1.0);\r
        float F = 0.04 + 0.96 * pow(1.0 - Vt.z, 5.0);\r
        Surf gl; gl.alb = vec3(0.02); gl.rough = 0.04; gl.metal = 0.0; gl.n = vec3(0.0, 0.0, 1.0);\r
        gl.emis = room * uShopGain * (1.0 - F);\r
        // (night) warm lit shop interiors, not blown panels: x0.3 against the x4.5 night exposure, 3000-3500 K tint, and\r
        // ~20 % of the open (unshuttered) shops closed for the night (dim security light). Same rule as registerShop()\r
        // (JS), which lights the sidewalk with a rect light per frontage.\r
        if (uNightK > 0.0) gl.emis *= mix(vec3(1.0), fract(rnd * 37.1) < 0.2 ? vec3(0.03, 0.032, 0.036) : vec3(0.24, 0.2, 0.15), uNightK); // (critic r3) -35 %\r
#ifdef FAR_NIGHT\r
        gl.emis *= 1.0 - 0.8 * uNightK; // (night) far shores: 1-3 km of lit shop bands summed into a warm tan haze band\r
#endif\r
        Surf fr; fr.alb = rnd > 0.4 ? vec3(0.05, 0.05, 0.055) : vec3(0.35, 0.28, 0.18); fr.rough = 0.35; fr.metal = 0.8; fr.n = vec3(0, 0, 1); fr.emis = vec3(0.0);\r
        float fm = max(mull, door * 0.0);\r
        Surf rv = base; rv.alb *= 0.6; rv.n = vec3(gp.x < 0.0 ? 1.0 : (gp.x > gw ? -1.0 : 0.0), gp.y < glassY0 ? 1.0 : (gp.y > signY0 ? -1.0 : 0.0), 0.3);\r
        rv.n = normalize(rv.n);\r
        s.alb = mix(gl.alb, fr.alb, fm); s.rough = mix(gl.rough, fr.rough, fm); s.metal = mix(gl.metal, fr.metal, fm);\r
        s.n = vec3(0, 0, 1); s.emis = gl.emis * (1.0 - fm);\r
        // reveal where the glass point falls outside the opening\r
        s.alb = mix(rv.alb, s.alb, inG); s.rough = mix(rv.rough, s.rough, inG); s.metal = mix(0.0, s.metal, inG);\r
        s.n = normalize(mix(rv.n, s.n, inG)); s.emis *= inG;\r
        gGlass = inG * (1.0 - fm); gF0 = 0.07;\r
      }\r
    }\r
    o.alb = mix(o.alb, s.alb, inner); o.rough = mix(o.rough, s.rough, inner); o.metal = mix(o.metal, s.metal, inner);\r
    o.n = normalize(mix(o.n, s.n, inner)); o.emis = s.emis * inner;\r
    gGlass *= inner;\r
    return;\r
  }\r
\r
  // ----------------------------------------------------------- upper floors\r
  float fh = vF.x;\r
  float yy = y - gH;\r
  float fl = floor(yy / fh);\r
  float fy = yy - fl * fh;\r
  float margin = vW.w;\r
  float usable = faceW - 2.0 * margin;\r
  float nb = max(1.0, floor(usable / vF.y + 0.5));\r
  float bw = usable / nb;\r
  float ux = u - margin;\r
  float bi = floor(ux / bw);\r
  float fx = ux - bi * bw;\r
  float ww = bw * vF.z;\r
  float wh = fh * vF.w;\r
  float wx0 = (bw - ww) * 0.5;\r
  float wy0 = (fh - wh) * (curtain ? 0.72 : 0.42);\r
  // ==================== (street r9) STREET-LEVEL ZONING of punched masonry facades (street agent, additive) ====================\r
  // critic: 'one tiled brick texture with identical window modules, no base / belt courses / cornice zone / bays / AC units'.\r
  // Classic NYC tripartite facade: a rusticated stone BASE (1-2 floors over the shops), a brick SHAFT broken into bays\r
  // (pilasters every K windows, paired sash windows on some buildings, continuous sill courses every N floors, stone\r
  // quoins), a CAP zone (1-2 floors, stone or brick with arched heads) under the cornice, belt courses between zones.\r
  // All per-building choices hash the building seed; buildings.js emits real projecting belt ledges at the same heights.\r
  bool zOK = !curtain && !ribbon && !deco && style < 1.5 && Lw < 3.5; // masonry (brick / limestone) walls only\r
  bool pOK = !curtain && !ribbon && !deco && style < 1.5; // (street r10) every punched wall: dark window treatment\r
  float zH1 = fract(seed * 2.37 + 0.11), zH2 = fract(seed * 4.73 + 0.59), zH3 = fract(seed * 8.19 + 0.27), zH4 = fract(seed * 1.61 + 0.83);\r
  float zNf = floor((topY - gH) / fh + 0.01);\r
  float zBase = (zOK && zNf >= 5.0) ? 1.0 + step(0.55, zH1) * step(9.0, zNf) : 0.0;\r
  float zCap = (zOK && zNf >= 6.0) ? 1.0 + step(0.6, zH2) * step(11.0, zNf) : 0.0;\r
  float zCapY = (zNf - zCap) * fh;                       // yy where the cap zone starts\r
  bool zInBase = zOK && fl < zBase;\r
  bool zInCap = zOK && zCap > 0.0 && yy >= zCapY;\r
  bool zPaired = zOK && bw > 2.15 && zH4 < 0.42 && !zInBase && !zInCap;\r
  float zBayK = 3.0 + floor(zH4 * 3.0);                    // pilaster every K windows\r
  float zH5 = fract(seed * 3.31 + 0.47);                     // (street r11) mid-shaft belt courses every zMidK floors\r
  float zMidK = (pOK && zNf - zBase - zCap >= 11.0) ? 6.0 + floor(zH5 * 3.0) : 0.0; // zOK: + projecting ledges (buildings.js); other punched walls: shader belt only\r
  bool zMidF = zMidK > 0.5 && !zInCap && fl > zBase + 0.5 && mod(fl - zBase, zMidK) < 0.5 && fl <= zNf - zCap - 3.0; // floor just above a mid belt\r
  if (zPaired) { // two sash windows share one masonry opening group, a narrow brick mullion between them\r
    float hb = bw * 0.5; float bi2 = floor(ux / hb); float par = mod(bi2, 2.0);\r
    bw = hb; bi = bi2; fx = ux - bi2 * hb;\r
    ww = min(hb * 0.8, ww * 0.62); wx0 = par < 0.5 ? hb - ww - 0.09 : 0.09;\r
  }\r
  if (zInBase) { wh = min(fh - 0.5, wh * 1.14); wy0 = (fh - wh) * 0.5; }\r
  if (zInCap && zH2 > 0.3) { wh = min(fh - 0.45, wh * 1.08); wy0 = (fh - wh) * 0.4; }\r
  // ==================== end street r9 zoning (window geometry); wall treatment below ====================\r
  float valid = boxAA(ux, 0.0, usable, aw) * boxAA(yy, 0.0, topY - gH - (curtain ? 0.2 : 1.2), ah);\r
  float cellR = fh1(vec2(bi + seed * 3.7, fl + seed * 1.3));\r
  float cellR2 = fh1(vec2(fl * 1.7 + seed, bi * 2.3 - seed));\r
  float lod = clamp(max(aw / bw, ah / fh) * 3.0 - 0.6, 0.0, 1.0);\r
  // (skyline r8) per-window variation survives into the far LOD while a window cell still spans >= ~1.5 px\r
  // (critic: 'one tiled window pattern per tower, no per-window light / blind variation, reads as wallpaper')\r
  float wv = 1.0 - smoothstep(0.5, 0.9, max(aw / bw, ah / fh));\r
  // (night) window occupancy (refs/night esb_perch_night): a sparse, irregular mix. Office / deco towers light whole\r
  // floors or one tenant's bay group (fluorescent / neutral LED / some warm), most floors dark with a few stray lights;\r
  // homes / masonry a sparse per-window scatter of warm tungsten at very varied brightness (curtains, lamps deep in the\r
  // room), a few blue TV glows. nOn / nCol: this window; nFlM / nBdM: the floor's / building's expected emission factor\r
  // (used once windows / floors go sub-pixel: the far city averages out instead of shimmering)\r
  float nOn = 0.0; vec3 nCol = vec3(1.0), nFlM = vec3(0.0), nBdM = vec3(0.0);\r
  if (uNightK > 0.0) {\r
    float busy = 0.5 + fract(seed * 3.77 + 0.21);                        // per-building activity 0.5 .. 1.5\r
    // integer hashes (exactly reproducible in JS: the window-light provider emits light for the same lit windows); the\r
    // bay index ignores the paired-sash split (a pair shares one bay: both lit or both dark)\r
    uint sdI = uint(floor(seed * 1000.0 + 0.5)), flI = uint(int(fl)), biI = uint(int(floor(ux / (usable / nb))));\r
    float flR = nh01(nh3(flI, sdI, 11u));\r
    float wR = nh01(nh3(biI, flI, sdI + 23u)), wR2 = nh01(nh3(biI, flI, sdI + 57u));\r
    if (curtain || ribbon || deco) {\r
      float pF = (deco ? 0.42 : 0.36) * busy, pP = 0.18 * busy; // (critic r1) office towers ~45-60 % lit          // floor fully lit / one tenant's bays lit\r
      uint gBI = biI / uint(3.0 + floor(fract(seed * 5.3) * 6.0));\r
      float gR = nh01(nh3(gBI, flI, sdI + 91u));\r
      float full = step(flR, pF), part = (1.0 - full) * step(flR, pF + pP);\r
      float fOn = full > 0.5 ? 0.66 : (part > 0.5 ? 0.4 : 0.03);\r
      nOn = step(wR, full > 0.5 ? (gR < 0.18 ? 0.1 : 0.8) : (part > 0.5 ? step(gR, 0.45) * 0.85 : 0.03)); // full floors: an odd dark bay group\r
      float fq = fract(flR * 53.7);\r
      vec3 fc = (fq < 0.5 ? vec3(0.8, 0.92, 1.0) : (fq < 0.84 ? vec3(1.0, 0.93, 0.8) : vec3(1.0, 0.74, 0.48))) * (deco ? 1.0 : 0.7); // half cool-white LED, the rest neutral / warm // (night) office floors: bright but not blown\r
      if (deco) fc = mix(fc, vec3(1.0, 0.9, 0.74), 0.35);                // deco towers: warmer (ESB ref)\r
      float flB = 0.55 + 0.45 * fract(flR * 29.3); // per-floor brightness\r
      nCol = fc * flB * (0.6 + 0.4 * wR2);\r
      nFlM = fc * flB * fOn * 0.8;\r
      nBdM = vec3(0.93, 0.9, 0.84) * (pF * 0.66 + pP * 0.4 + 0.03) * 0.62;\r
    } else {\r
      float pw = 0.25 * busy * (0.6 + 0.8 * fract(flR * 3.3));\r
      nOn = step(wR, pw);\r
      float tv = step(0.9, wR2);\r
      nCol = tv > 0.5 ? vec3(0.42, 0.56, 1.0) * 0.4 : mix(vec3(1.0, 0.58, 0.28), vec3(1.0, 0.8, 0.56), fract(wR2 * 7.9)) * mix(0.12, 1.0, pow(fract(wR2 * 3.7), 1.4));\r
      nFlM = vec3(1.0, 0.68, 0.4) * pw * 0.5;\r
      nBdM = vec3(1.0, 0.68, 0.4) * 0.25 * busy * 0.5;\r
    }\r
    float nsw = fract(sin(floor(uDnTime / (45.0 + 60.0 * cellR2) + cellR * 17.0) * 91.7 + cellR * 311.0) * 4375.5); // rooms switch on / off every ~1-2 min\r
    if (nsw < 0.03) nOn = 1.0 - nOn;\r
  }\r
  float cBl = step(0.72, cellR2) * min(1.0, (cellR2 - 0.72) * 4.0); // curtain wall: blinds drawn (fraction of the pane)\r
  // (skyline r12) critic: 'glass slab = one even grid top to bottom'. Tenant zones of 8-15 floors: each zone gets its own\r
  // glass body tone / reflectance and its own share of drawn blinds (different tenants, re-glazed floors)\r
  float zR = 0.5;\r
  if (curtain) {\r
    float zF = 8.0 + floor(fract(seed * 3.91 + 0.13) * 8.0);\r
    zR = fh1(vec2(floor(fl / zF) + seed * 0.37, seed * 5.1 + 0.7));\r
    float bt = 0.58 + 0.3 * zR;\r
    cBl = step(bt, cellR2) * min(1.0, (cellR2 - bt) * 4.0);\r
  }\r
  float depth = vX.w;\r
  if (zOK) depth = max(depth, 0.16) * 1.3; // (street r9) deeper masonry reveals (critic: 'windows read as flat decals')\r
  if (pOK && !zOK) o.alb *= 0.955 + 0.09 * fh1(vec2(fl * 0.37 + seed, floor(bi / 3.0) + seed * 2.1)); // (street r11) per-floor / per-bay-group panel tone (critic: 'uniform grids, identical spacing top to bottom')\r
  if (pOK) { // (street r10) large-scale brick tonal patches (street r11: all punched walls) (re-pointing, replaced brick, soot washes) so the fine\r
    // pattern never reads as one tile: 3-10 m mottling +-14 %, a slight hue drift\r
    vec2 mq = vec2(u * 0.085 + seed * 0.71, vFac.y * 0.11);\r
    float m1 = textureGrad(tNoise, mq, gDx * 0.085, gDy * 0.11).r, m2 = textureGrad(tNoise, mq * 2.7 + 0.43, gDx * 0.23, gDy * 0.3).g;\r
    float mt = 0.62 * m1 + 0.38 * m2;\r
    o.alb *= (0.86 + 0.28 * smoothstep(0.2, 0.8, mt)) * mix(vec3(1.0), vec3(1.04, 0.99, 0.95), smoothstep(0.55, 0.8, m2));\r
  }\r
  if (zOK) { // (street r9) zone walls: rusticated stone base, stone (or lighter brick) cap\r
    if (zInBase) {\r
      float Lz = Lb < 5.5 && Lb > 2.5 ? Lb : 3.0;\r
      Surf bs = wallSurf(vec2(u, vFac.y), Lz, vec3(0.9, 0.88, 0.84) * (0.9 + 0.2 * nz2.r) * mix(0.72, 1.0, smoothstep(0.0, 2.5, y)));\r
      float rH = 0.56, ry = mod(y, rH), row = floor(y / rH);\r
      float jy = 1.0 - boxAA(ry, 0.035, rH, ah);                                   // deep horizontal rustication joint\r
      float jx = 1.0 - boxAA(mod(u + mod(row, 2.0) * 0.6, 1.2), 0.02, 1.2, aw);     // staggered head joints\r
      bs.alb *= (1.0 - 0.55 * jy) * (1.0 - 0.3 * jx) * (0.94 + 0.12 * fh1(vec2(floor((u + mod(row, 2.0) * 0.6) / 1.2), row + seed)));\r
      bs.n = normalize(vec3(0.0, jy * (ry < 0.02 ? -0.8 : 0.8), 1.0));\r
      o = bs;\r
    } else if (zInCap) {\r
      if (zH2 > 0.5) { Surf cs = wallSurf(vec2(u, vFac.y), 3.0, vec3(0.86, 0.84, 0.79) * (0.9 + 0.2 * nz2.g)); cs.alb *= 1.0 - 0.18 * smoothstep(0.5, 0.85, nz.b); o = cs; }\r
      else o.alb *= vec3(1.06, 1.04, 1.02);\r
    }\r
    // stone quoins at the face corners (alternating long / short blocks)\r
    if (zH1 > 0.4 && !zInBase && faceW > 6.0) {\r
      float qr = floor(y / 0.62), qw = mod(qr, 2.0) < 0.5 ? 0.95 : 0.55;\r
      float qm = max(1.0 - boxAA(u, qw, faceW - qw, aw), 0.0) * step(0.0, yy);\r
      if (qm > 0.0) {\r
        Surf qs = wallSurf(vec2(u, vFac.y), 3.0, vec3(0.84, 0.82, 0.77) * (0.9 + 0.2 * nz2.b));\r
        float qj = 1.0 - boxAA(mod(y, 0.62), 0.03, 0.62, ah);\r
        qs.alb *= 1.0 - 0.45 * qj; qs.n = normalize(vec3(0.0, 0.5 * qj, 1.0));\r
        o.alb = mix(o.alb, qs.alb, qm); o.n = normalize(mix(o.n, qs.n, qm)); o.rough = mix(o.rough, qs.rough, qm);\r
      }\r
    }\r
    // bay pilasters in the shaft: the pier between window groups is a slightly proud strip with a lit / shaded edge\r
    if (!zPaired && !zInBase && !zInCap && zH3 > 0.25) {\r
      bool pR = mod(bi + 1.0, zBayK) < 0.5 && fx > wx0 + ww, pL = mod(bi, zBayK) < 0.5 && bi > 0.5 && fx < wx0;\r
      if (pR || pL) {\r
        float e0 = pR ? fx - (wx0 + ww) : fx + (bw - wx0 - ww), pw2 = bw - ww;       // position across the pier\r
        float edgeL = 1.0 - boxAA(e0, 0.07, 99.0, aw), edgeR = 1.0 - boxAA(e0, -99.0, pw2 - 0.07, aw);\r
        if (zH3 > 0.62) { // stone pilaster (light, jointed every 0.62 m)\r
          Surf ps = wallSurf(vec2(u, vFac.y), 3.0, vec3(0.84, 0.82, 0.77) * (0.9 + 0.2 * nz2.b));\r
          ps.alb *= 1.0 - 0.4 * (1.0 - boxAA(mod(y, 0.62), 0.03, 0.62, ah));\r
          o.alb = ps.alb; o.rough = ps.rough;\r
        } else o.alb *= 0.8 + 0.07 * fract(seed * 3.3); // brick pier in a darker header bond\r
        o.alb *= 1.0 + 0.3 * edgeL - 0.4 * edgeR;\r
        o.n = normalize(o.n + vec3(0.8 * edgeL - 0.8 * edgeR, 0.0, 0.0));\r
      }\r
    }\r
  }\r
\r
  // window opening mask (at facade plane)\r
  float inWx = boxAA(fx, wx0, wx0 + ww, aw);\r
  float inWy = boxAA(fy, wy0, wy0 + wh, ah);\r
  // (street r9) arched heads on cap-zone windows of some buildings\r
  float zArch = zInCap && zH2 > 0.3 && zH2 < 0.8 ? 1.0 : 0.0;\r
  float archO = 1.0;\r
  if (zArch > 0.5) { float ar = ww * 0.5, acy = wy0 + wh - ar; vec2 dq = vec2(fx - wx0 - ar, max(fy - acy, 0.0)); archO = 1.0 - smoothstep(ar - aw, ar + aw, length(dq)); }\r
  float open = inWx * inWy * valid * archO;\r
  // glass plane point (parallax into recess)\r
  vec2 off = vec2(-Vt.x, -Vt.y) / Vt.z * depth;\r
  vec2 gp = vec2(fx, fy) + off;\r
  float inG = boxAA(gp.x, wx0, wx0 + ww, aw) * boxAA(gp.y, wy0, wy0 + wh, ah);\r
  if (zArch > 0.5) { float ar = ww * 0.5, acy = wy0 + wh - ar; vec2 dq = vec2(gp.x - wx0 - ar, max(gp.y - acy, 0.0)); inG *= 1.0 - smoothstep(ar - aw, ar + aw, length(dq)); }\r
  vec2 gq = vec2((gp.x - wx0) / ww, (gp.y - wy0) / wh);\r
\r
  // glass & interior\r
  bool resid = vX.x > 0.5;\r
  float tile = resid ? 6.0 + floor(cellR2 * 6.0) : floor(cellR2 * 6.0);\r
  float lit = step(0.55, fract(cellR * 7.13));\r
  if (uNightK > 0.5) lit = nOn; // (night) lit rooms show their ceiling lights, the rest stay dark\r
  vec3 room = interior(vec2(gp.x, gp.y), dirIn, bw, fh, curtain ? 6.0 : 4.0, tile, lit, 0.0);\r
  float F = 0.04 + 0.96 * pow(1.0 - Vt.z, 5.0);\r
  Surf gl;\r
  float gsel = vX.z;\r
  vec3 gt = gsel < 0.5 ? vec3(0.5, 0.61, 0.72) : (gsel < 1.5 ? vec3(0.4, 0.57, 0.58) : (gsel < 2.5 ? vec3(0.5, 0.56, 0.6) : (gsel < 3.5 ? vec3(0.55, 0.5, 0.42) : vec3(0.66, 0.74, 0.82))));\r
  // (skyline r12) critic: 'no reflective glass / green / dark-glass towers'. 5 = deep green-grey (Lever / Seagram-era\r
  // tinted glass), 6 = high-reflectance silver-blue mirror coating, 7 = gold-bronze reflective coating\r
  bool lowIron = gsel > 3.5 && gsel < 4.5;\r
  if (gsel > 4.5) gt = gsel < 5.5 ? vec3(0.36, 0.55, 0.46) : (gsel < 6.5 ? vec3(0.6, 0.72, 0.86) : vec3(0.78, 0.64, 0.42));\r
  // skyline: per-tower spandrel treatment (dark shadow-box glass / light metal panel / stone band) -> floor banding\r
  float sv = fract(seed * 5.31 + 0.17);\r
  vec3 spC = sv < 0.25 ? gt * 0.08 : (sv < 0.72 ? vec3(0.27, 0.285, 0.3) * (0.8 + 0.4 * fract(seed * 2.71)) : vec3(0.42, 0.405, 0.37) * (0.85 + 0.3 * fract(seed * 1.93)));\r
  float spGl = sv < 0.25 ? 1.0 : 0.2; // (skyline r10) dark shadow-box spandrels 40 -> 25 % (director: city reads too dark)\r
  if (sv > 0.88) spC = vec3(0.3, 0.24, 0.17) * (0.8 + 0.4 * fract(seed * 2.71)); // (skyline r3) bronze-anodised panels\r
  if (curtain) spC *= 0.88 + 0.24 * zR; // (skyline r12) per-zone spandrel tone\r
  // (skyline r3) per-tower mullion cap width (4-13 cm) and finish: silver / dark bronze / black / white-painted\r
  float cw = 0.04 + 0.09 * fract(seed * 7.77);\r
  float cq = fract(seed * 4.39 + 0.5);\r
  vec3 capC = cq < 0.4 ? vec3(0.42, 0.44, 0.46) : (cq < 0.62 ? vec3(0.13, 0.11, 0.09) : (cq < 0.82 ? vec3(0.05, 0.055, 0.06) : vec3(0.68, 0.69, 0.68)));\r
  if (lowIron) capC = vec3(0.56, 0.58, 0.61); // (skyline r7) low-iron supertalls: bright stainless caps (One WTC / CPT, not a black grid)\r
  if (curtain) { float glum = dot(gt, vec3(0.2126, 0.7152, 0.0722)); gSpecTint = pow(gt / glum, vec3(1.7)); gSpecTint *= mix(0.86 + 0.28 * cellR2, 1.0, 1.0 - wv); /* (skyline r9) +-26 % -> +-14 %: read as a pixel mosaic */ } // (r8) per-IGU reflectance held to the far LOD (wv) // per-IGU reflectance variation (fades before it can shimmer)\r
  if (curtain) {\r
    vec3 sm = textureGrad(tNoise, vWPos.xz * 0.05 + vec2(u, y) * 0.11, gDx * 0.11, gDy * 0.11).rgb;\r
    gl.alb = gt * (0.035 + 0.02 * cellR); // (user r-glass) deeper tint: darker glass body\r
    if (lowIron) gl.alb = gt * (0.13 + 0.03 * cellR); // (skyline r7) low-iron glass: pale ceilings / blinds lift the body tone\r
    if (vX.y > 2.5) gl.alb = vec3(0.05, 0.052, 0.055) * (0.75 + 0.5 * step(0.5, fract(gq.y * 6.0))); // (street r11) louvre band: dark blades\r
    gl.alb = mix(gl.alb, vec3(0.3, 0.3, 0.28), 0.75 * cBl * step(1.0 - cBl, gq.y)); // (skyline r8) roller blinds behind some panes\r
    gl.metal = 0.0;\r
    // (user r-glass) "remove the frosted effect, keep it deep tinted but reflective": the smudge speckle (noise texture\r
    // sampled at ~5 cm texel scale in roughness + albedo) read as frosted / crumpled foil -> clean polished glass, only a\r
    // faint per-IGU roughness difference\r
    gl.rough = 0.02 + 0.025 * cellR2 * (1.0 - lod);\r
\r
    // slight per-panel tilt -> broken reflections like real IGUs\r
    gl.n = normalize(vec3(vec2(cellR - 0.5, cellR2 - 0.5) * 0.016 * (1.0 - smoothstep(0.02, 0.12, max(aw / bw, ah / fh))), 1.0)); // per-IGU tilt fades before panels get sub-10px (reflection moire)\r
    gl.emis = room * uInteriorGain * 0.3 * (1.0 - F);\r
    // (skyline r5) panel deflection / heat-strengthened glass roller wave: ~10 m-scale normal wobble + reflectance\r
    // mottling. Low frequency, box-filtered by the mips -> it survives to the far LOD, where the per-IGU jitter is gone\r
    vec2 ws = vec2(0.07, 0.16);\r
    vec3 wob = textureGrad(tNoise, vec2(u, y) * ws + fract(seed * 0.73) * 7.0, gDx * ws, gDy * ws).rgb;\r
    // (user r-glass) the wobble texture is noise at texel scale (~5 cm at this frequency), which crinkled every\r
    // reflection like frosted glass. Panels stay flat mirrors; only the per-IGU tilt above breaks the reflection\r
    gWob = vec2(0.0);\r
    gSpecTint *= 0.94 + 0.12 * zR;\r
    gl.alb *= 0.75 + 0.5 * zR; gSpecTint *= 0.86 + 0.28 * zR; // (skyline r12) per-zone glass tone / reflectance\r
  } else {\r
    gl.alb = vec3(0.015); gl.metal = 0.0; gl.rough = 0.05 + 0.05 * cellR;\r
    gl.n = normalize(vec3(vec2(cellR - 0.5, cellR2 - 0.5) * 0.02 * (1.0 - smoothstep(0.02, 0.12, max(aw / bw, ah / fh))), 1.0));\r
    // daylit rooms seen through clear sash glass: furniture / back walls readable (not a flat dark pane), the\r
    // Fresnel sky reflection takes over at grazing angles\r
    gl.emis = room * uInteriorGain * 2.0 * (1.0 - F);\r
    if (deco) gl.emis *= 0.5; // (skyline r11) deco towers: darker window stripes -> the light stone piers read (ESB, ref 01)\r
    // (street r10) director: 'masonry windows read as pale panes in a crisp grid; the ref's are DARK holes'. Old sash\r
    // windows: deep dim rooms (most unlit), only the occasional lit room; blinds on ~20 % of windows, drawn partway\r
    float bThr = deco ? 0.86 : (pOK ? 0.7 : 0.55); // (street r11) pOK 0.8 -> 0.7: ~30 % of sash windows have a blind down\r
    if (pOK) gl.emis *= (0.42 + 0.6 * lit * step(0.55, cellR2)) * (0.7 + 0.6 * cellR2); // (textures r4) 0.26 -> 0.42: rooms read through the glass (critic: 'flat black holes')\r
    { float hs = smoothstep(0.55, 1.0, gq.y); gl.emis *= 1.0 - 0.5 * hs; } // (textures r4) lintel / soffit shadow over the upper glass: the opening reads recessed\r
    // blinds / curtains\r
    float blind = cellR > bThr ? (cellR - bThr) * (pOK ? 2.6 : 1.8) : 0.0;\r
    blind *= mix(1.0, 0.45, uNightK); // (night) blinds mostly up: lit rooms show their interior, not a flat card\r
    float bl = step(1.0 - blind, gq.y);\r
    gBlN = bl; // (night)\r
    vec3 bc = resid ? mix(vec3(0.85, 0.8, 0.7), vec3(0.6, 0.35, 0.3), step(0.8, cellR2)) : vec3(0.82, 0.82, 0.8);\r
    float slats = 0.85 + 0.15 * step(0.5, fract(gp.y * 25.0));\r
    if (pOK) bc *= 0.5; // (street r10) dusty blinds in shade, not glowing white\r
    // (street r11) critic: 'window + AC module stamped identically; vary blinds, curtains and interior lighting per\r
    // window'. Masonry sash windows: blind colour per window (paper white / cream / tan / grey-green / dark roller),\r
    // side curtains on ~20 % (one or both sides, muted fabric colours), per-window glass reflectance (gSashV)\r
    float cR4 = fh1(vec2(bi * 5.3 + seed * 1.9, fl * 3.1 + seed * 0.37));\r
    if (pOK) {\r
      float bq = fract(cellR * 23.7);\r
      bc = (bq < 0.3 ? vec3(0.8, 0.78, 0.72) : (bq < 0.55 ? vec3(0.78, 0.7, 0.55) : (bq < 0.72 ? vec3(0.55, 0.58, 0.54) : (bq < 0.86 ? vec3(0.2, 0.2, 0.21) : vec3(0.7, 0.66, 0.6))))) * 0.55;\r
      float cSide = cR4 < 0.2 ? (cR4 < 0.08 ? 2.0 : 1.0) : 0.0;           // 1: one side (left / right by hash), 2: both\r
      float cw2 = 0.18 + 0.2 * fract(cR4 * 41.0);\r
      float onL = gq.x < cw2 ? 1.0 : 0.0, onR = gq.x > 1.0 - cw2 ? 1.0 : 0.0;\r
      float cur = cSide > 1.5 ? max(onL, onR) : (cSide > 0.5 ? (fract(cR4 * 13.0) < 0.5 ? onL : onR) : 0.0);\r
      gCurN = cur; // (night)\r
      vec3 cc = fract(cR4 * 7.7) < 0.35 ? vec3(0.62, 0.52, 0.4) : (fract(cR4 * 7.7) < 0.6 ? vec3(0.5, 0.22, 0.18) : (fract(cR4 * 7.7) < 0.8 ? vec3(0.3, 0.36, 0.42) : vec3(0.75, 0.72, 0.64)));\r
      float fold = 0.8 + 0.2 * sin(gp.x * 38.0);\r
      gl.alb = mix(gl.alb, cc * 0.5 * fold, cur); gl.rough = mix(gl.rough, 0.9, cur); gl.emis *= 1.0 - cur;\r
      gl.emis += cur * cc * 0.1 * lit * uInteriorGain;\r
      gSashV = 0.45 + 1.15 * fract(cR4 * 3.3 + cellR2);\r
    }\r
    gl.alb = mix(gl.alb, bc * slats * 0.8, bl); gl.rough = mix(gl.rough, 0.8, bl); gl.emis *= (1.0 - bl);\r
    gl.emis += bl * bc * 0.12 * lit * uInteriorGain;\r
    // reflection floor: real sash glass always mirrors some sky / opposite facade (brighter toward the head, where it\r
    // sees more sky); keeps unlit windows from reading as black holes at mid range\r
    gl.emis += (1.0 - bl) * vec3(0.035, 0.042, 0.052) * (0.55 + 0.45 * gq.y) * (0.8 + 0.4 * cellR2) * (pOK ? 0.8 : 1.0); // (textures r4) pOK 0.45 -> 0.8\r
  }\r
  // mullions / sash\r
  float mullW = curtain ? 0.0 : 0.05;\r
  float frame = 0.0;\r
  if (!curtain) {\r
    float fwm = mullW;\r
    frame = 1.0 - boxAA(gp.x, wx0 + fwm, wx0 + ww - fwm, aw) * boxAA(gp.y, wy0 + fwm, wy0 + wh - fwm, ah);\r
    if (!ribbon) frame = max(frame, 1.0 - boxAA(abs(gq.y - 0.52) * wh, 0.03, 99.0, ah));\r
    if (ww > 1.5 || ribbon) {\r
      float nmx = max(2.0, floor(ww / 1.2 + 0.5));\r
      frame = max(frame, 1.0 - boxAA(abs(fract(gq.x * nmx + 0.5) - 0.5) * ww / nmx, 0.025, 99.0, aw));\r
    }\r
  }\r
  vec3 frameC = vX.y > 1.5 ? vec3(0.9, 0.9, 0.87) : (vX.y > 0.5 ? vec3(0.1, 0.1, 0.1) : vec3(0.28, 0.2, 0.14));\r
  if (zOK) { // (street r9) per-building sash paint (muted: no glowing white grid) + ~18 % replacement aluminium windows\r
    float fq = fract(seed * 3.97 + 0.41);\r
    frameC = fq < 0.3 ? vec3(0.66, 0.65, 0.61) : (fq < 0.5 ? vec3(0.1, 0.15, 0.12) : (fq < 0.7 ? vec3(0.07, 0.07, 0.075) : (fq < 0.85 ? vec3(0.3, 0.21, 0.15) : vec3(0.55, 0.52, 0.45))));\r
    if (fract(cellR * 17.3) < 0.18) frameC = vec3(0.42, 0.43, 0.44);\r
  }\r
  Surf win;\r
  win.alb = mix(gl.alb, frameC, frame); win.rough = mix(gl.rough, 0.45, frame); win.metal = mix(gl.metal, 0.3, frame);\r
  win.n = normalize(mix(gl.n, vec3(0, 0, 1), frame)); win.emis = gl.emis * (1.0 - frame);\r
  // reveal (jambs, head, sill) when the glass point leaves the opening\r
  Surf rv = o;\r
  vec3 rn = vec3(0.0);\r
  if (gp.x < wx0) rn.x = 1.0; else if (gp.x > wx0 + ww) rn.x = -1.0;\r
  if (gp.y < wy0) rn.y = 1.0; else if (gp.y > wy0 + wh) rn.y = -1.0;\r
  rv.n = normalize(rn + vec3(0.0, 0.0, 0.15));\r
  rv.alb *= curtain ? 0.9 : 0.72;\r
  if (curtain) { rv.alb = vec3(0.62, 0.64, 0.66); rv.metal = 0.9; rv.rough = 0.3; }\r
  win.alb = mix(rv.alb, win.alb, inG); win.rough = mix(rv.rough, win.rough, inG); win.metal = mix(rv.metal, win.metal, inG);\r
  win.n = normalize(mix(rv.n, win.n, inG)); win.emis *= inG;\r
\r
  // wall decoration between openings\r
  Surf wall = o;\r
  if (curtain) {\r
    // spandrel panels + aluminium mullions (protruding caps)\r
    float capX = 1.0 - boxAA(fx, cw, bw - cw, aw);\r
    float capY = 1.0 - boxAA(fy, cw, fh - cw, ah);\r
    float cap = max(capX, capY);\r
    Surf sp = o; sp.alb = spC; sp.metal = spGl > 0.5 ? 0.3 : 0.5; sp.rough = spGl > 0.5 ? 0.12 : 0.38;\r
    sp.n = vec3(0.0, 0.0, 1.0); // (user r-glass) flat panel: the inherited masonry bump read as frosted speckle on reflective spandrels\r
    Surf al; al.alb = capC * (0.9 + 0.2 * nz2.r); al.metal = 0.85; al.rough = 0.42; // anodised aluminium: mid grey, satin\r
    // rounded cap profile: normal follows the position across the 6 cm cap (shading gradient, not a flat bright strip)\r
    float cxp = fx < bw * 0.5 ? fx / cw : (bw - fx) / cw, cyp = fy < fh * 0.5 ? fy / cw : (fh - fy) / cw;\r
    al.n = normalize(vec3(capX > 0.5 ? (fx < bw * 0.5 ? -1.0 : 1.0) * (1.0 - clamp(cxp, 0.0, 1.0)) * 0.7 : 0.0, capY > 0.5 ? (fy < fh * 0.5 ? -1.0 : 1.0) * (1.0 - clamp(cyp, 0.0, 1.0)) * 0.35 : 0.0, 1.0));\r
    al.rough = capY > 0.5 && capX < 0.5 ? 0.5 : al.rough; // transoms face the sky/sun: brushed, no blown highlight band\r
    al.emis = vec3(0.0);\r
    wall.alb = mix(sp.alb, al.alb, cap); wall.metal = mix(sp.metal, al.metal, cap); wall.rough = mix(sp.rough, al.rough, cap);\r
    wall.n = normalize(mix(sp.n, al.n, cap));\r
    // also cap over glass\r
    win.alb = mix(win.alb, al.alb, cap); win.metal = mix(win.metal, al.metal, cap); win.rough = mix(win.rough, al.rough, cap);\r
    win.n = normalize(mix(win.n, al.n, cap)); win.emis *= 1.0 - cap;\r
  } else if (deco) {\r
    // dark recessed spandrels between stacked windows -> vertical pier emphasis\r
    // (skyline r2) cast-aluminium / dark-painted spandrel panels (ESB-like): with the dark glass they read as continuous\r
    // recessed vertical stripes between the light stone piers; a raised chevron rib every panel catches the light\r
    float sp = inWx * (1.0 - inWy) * valid;\r
    float spRib = boxAA(abs(fy - (fy < wy0 ? wy0 * 0.5 : (wy0 + wh + fh) * 0.5)), 0.0, 0.07, ah);\r
    Surf sps = o; sps.alb = mix(vec3(0.075, 0.078, 0.082), vec3(0.2, 0.2, 0.19), 0.35 * fract(seed * 3.3)) * (0.85 + 0.3 * nz2.r) * (1.0 + 0.9 * spRib);\r
    sps.metal = 0.22; sps.rough = 0.62; sps.n = normalize(vec3(0.0, -0.18, 1.0)); // (skyline r9) was metal 0.55 + up-tilt: mirrored the sky as blue louvre bands from the street\r
    wall.alb = mix(o.alb, sps.alb, sp); wall.n = normalize(mix(o.n, sps.n, sp)); wall.metal = mix(o.metal, sps.metal, sp); wall.rough = mix(o.rough, sps.rough, sp);\r
    // pier edge shading: piers read as proud of the recessed window/spandrel stripe (light edge / dark edge)\r
    float pe = boxAA(fx, wx0 - 0.12, wx0, aw) - boxAA(fx, wx0 + ww, wx0 + ww + 0.12, aw);\r
    wall.alb *= 1.0 + 0.12 * pe * valid;\r
  } else {\r
    // sills & lintels (stone), belt courses, rain streaks\r
    vec3 stone = vec3(0.78, 0.75, 0.68);\r
    float lint = vX.y;\r
    float ext = 0.1;\r
    float inX = boxAA(fx, wx0 - ext, wx0 + ww + ext, aw) * valid;\r
    float sill = inX * boxAA(fy, wy0 - 0.12, wy0, ah);\r
    float head = inX * boxAA(fy, wy0 + wh, wy0 + wh + (lint > 1.5 ? 0.35 : 0.22), ah);\r
    if (zArch > 0.5) { // (street r9) arched head: stone voussoir ring + keystone instead of a flat lintel\r
      float ar = ww * 0.5, acy = wy0 + wh - ar; vec2 dq = vec2(fx - wx0 - ar, fy - acy);\r
      float rr = length(dq);\r
      head = step(0.0, dq.y) * (smoothstep(ar - aw, ar + aw, rr) - smoothstep(ar + 0.26 - aw, ar + 0.26 + aw, rr));\r
      head = max(head, boxAA(abs(dq.x), -1.0, 0.13, aw) * boxAA(fy, wy0 + wh - 0.05, wy0 + wh + 0.36, ah));\r
      head *= valid;\r
      lint = max(lint, 1.0);\r
    }\r
    if (zMidF) { head = inX * boxAA(fy, wy0 + wh, wy0 + wh + 0.42, ah); sill = inX * boxAA(fy, wy0 - 0.2, wy0, ah); lint = max(lint, 2.0); } // (street r11) dressed floor over a mid belt\r
    if (zInBase) head = 0.0; // rusticated base: the stone joints frame the openings\r
    // (textures r2) under-sill soot / rain runs from the $imagegen grime decal sheet (was a 1.4 m gradient box): each window\r
    // picks one of 24 streak shapes and a 0.8-3 m run; above the window head the run of the floor above continues\r
    float gdy = wy0 - 0.12 - fy, gcr = cellR;\r
    if (gdy < 0.0) { gdy += fh; gcr = fh1(vec2(bi + seed * 3.7, fl + 1.0 + seed * 1.3)); }\r
    float gLn = 0.8 + 2.2 * fract(gcr * 3.3), gWd = ww + 0.35;\r
    float streak = grimeDecal(vec2((fx - wx0 + 0.175) / gWd, gdy / gLn), vec2(1.0 / gWd, 1.0 / gLn), floor(fract(gcr * 5.1) * 24.0)) * valid * 0.42;\r
    if (pOK) streak *= 0.45 + 1.1 * fract(gcr * 5.1); // (street r11) grime under sills varies per window (some heavy runs)\r
    wall.alb *= 1.0 - streak;\r
    float belt = 0.0;\r
    if (fl < 0.5) belt = boxAA(fy, -0.01, 0.35, ah); // belt course above storefront\r
    belt = max(belt, boxAA(yy - (topY - gH - 1.2), 0.0, 0.4, ah)) * boxAA(ux, -margin - 1.0, usable + margin + 1.0, aw);\r
    if (zOK) { // (street r9) zone belt courses (base top / cap bottom) with a shadow line under each, sill courses every N floors\r
      float zb = 0.0, zs = 0.0;\r
      if (zBase > 0.0) { zb = max(zb, boxAA(yy, zBase * fh - 0.02, zBase * fh + 0.46, ah)); zs = max(zs, boxAA(yy, zBase * fh - 0.2, zBase * fh - 0.02, ah)); }\r
      if (zCap > 0.0) { zb = max(zb, boxAA(yy, zCapY - 0.38, zCapY + 0.02, ah)); zs = max(zs, boxAA(yy, zCapY - 0.52, zCapY - 0.38, ah)); }\r
      float strN = zH3 < 0.3 ? 0.0 : 2.0 + floor(zH3 * 4.0);\r
      if (strN > 0.5 && !zInBase && !zInCap && mod(fl, strN) < 0.5) zb = max(zb, boxAA(fy, wy0 - 0.15, wy0, ah));\r
      // (street r11) critic: 'a single window module tiled over 15+ floors, no mid-cornice'. Tall shafts get a heavy\r
      // stone belt course every zMidK (6-8) floors (buildings.js zoneBelts emits the matching projecting ledge), with a\r
      // cast shadow under it and the floor above it in stone-dressed windows (lintel + sill, see zMidF)\r
      if (zMidK > 0.5 && !zInBase && !zInCap) {\r
        float bj = floor((yy / fh - zBase) / zMidK + 0.5), bF = zBase + bj * zMidK;\r
        if (bj >= 1.0 && bF <= zNf - zCap - 3.0) {\r
          zb = max(zb, boxAA(yy, bF * fh - 0.02, bF * fh + 0.5, ah));\r
          zs = max(zs, boxAA(yy, bF * fh - 0.34, bF * fh - 0.02, ah));\r
        }\r
      }\r
      wall.alb *= 1.0 - 0.45 * zs * (1.0 - zb);\r
      belt = max(belt, zb);\r
    } else if (zMidK > 0.5) { // (street r11) mid-shaft belt courses on the other punched walls (concrete / granite / white)\r
      float bj = floor(yy / fh / zMidK + 0.5), bF = bj * zMidK, zb = 0.0, zs = 0.0;\r
      if (bj >= 1.0 && bF <= zNf - 3.0) { zb = boxAA(yy, bF * fh - 0.02, bF * fh + 0.5, ah); zs = boxAA(yy, bF * fh - 0.34, bF * fh - 0.02, ah); }\r
      wall.alb *= 1.0 - 0.45 * zs * (1.0 - zb);\r
      belt = max(belt, zb);\r
    }\r
    float st = max(max(sill, head), belt);\r
    Surf ss = wallSurf(vec2(u, vFac.y), 3.0, vec3(1.0));\r
    ss.alb *= stone * 1.25;\r
    ss.n = normalize(vec3(0.0, sill > 0.5 ? 0.7 : (head > 0.5 ? -0.25 : 0.2), 1.0));\r
    if (lint > 0.5 || belt > 0.5) {\r
      wall.alb = mix(wall.alb, ss.alb, st); wall.n = normalize(mix(wall.n, ss.n, st)); wall.rough = mix(wall.rough, 0.8, st);\r
    } else { // soldier course (darker brick header)\r
      wall.alb *= 1.0 - 0.18 * head;\r
      wall.alb = mix(wall.alb, ss.alb, sill);\r
    }\r
  }\r
  // AO-ish darkening around openings\r
  wall.alb *= 1.0 - 0.1 * (inWx * boxAA(fy, wy0 - 0.3, wy0 + wh + 0.3, ah)) * (1.0 - open);\r
\r
  Surf r;\r
  r.alb = mix(wall.alb, win.alb, open); r.rough = mix(wall.rough, win.rough, open); r.metal = mix(wall.metal, win.metal, open);\r
  r.n = normalize(mix(wall.n, win.n, open)); r.emis = win.emis * open;\r
  float capW = 0.0;\r
  if (curtain) capW = max(1.0 - boxAA(fx, cw, bw - cw, aw), 1.0 - boxAA(fy, cw, fh - cw, ah));\r
  gGlass = open * inG * (1.0 - frame) * (1.0 - capW);\r
  if (curtain) gGlass = max(gGlass, (1.0 - open) * (1.0 - capW) * spGl * 0.8); // shadow-box spandrel glass reflects too\r
  gF0 = curtain ? (lowIron ? 0.46 : (gsel > 5.5 ? 0.62 : (gsel > 4.5 ? 0.2 : 0.25))) * (0.85 + 0.3 * fract(seed * 6.83 + 0.37)) : 0.12; // (skyline r12) per-tower coating: mirror 0.62, tinted 0.2, +-15 % per tower // (skyline r7) low-iron supertall glass 0.34 -> 0.46 (One WTC reads bright) // (skyline r6) 0.2 -> 0.25: glass reads as glass\r
  if (pOK && !zOK) { gF0 = 0.085; gSash = 1.0; } // (textures r4) 0.05 -> 0.085: sash glass mirrors the sky / street opposite // (street r10) all punched walls: dusty, dim sash glass\r
  if (curtain && vX.y > 2.5) { gF0 = 0.03; gSash = 1.0; gSashV = 0.5; } // (street r11) lintel 3 on a curtain wall = dark mechanical louvre band (MetLife plant floors)\r
  if (zOK) {\r
    // (street r9) old sash glass: dusty, lower grazing reflectance (critic: 'windows read as flat bright white-grey planes')\r
    gF0 = 0.085; gSash = 1.0; // (street r10) 0.07 -> 0.05 // (textures r4) -> 0.085 (critic r3: 'windows flat black holes, no glass')\r
    // (street r9) through-window AC units: a 0.28 m deep box sitting on the sill (front face / top / side by ray-marching\r
    // the view segment through the box at 3 depths), a shadow + condensate drip stain on the wall below\r
    float acRate = (resid ? 0.2 : 0.09) * (zInBase ? 0.3 : 1.0) * step(0.15, fract(seed * 6.61));\r
    float cR3 = fh1(vec2(bi * 3.1 + seed * 0.71, fl * 5.7 - seed * 0.3));\r
    if (cR3 < acRate && valid > 0.5 && lod < 0.99) {\r
      float acW = min(0.72, ww - 0.1), acH = 0.42, acD = 0.3, cx = wx0 + 0.5 * ww + (fract(cR3 * 37.0) - 0.5) * max(ww - acW - 0.1, 0.0);\r
      vec2 sh = vec2(Vt.x, Vt.y) / Vt.z * acD;\r
      vec2 p0 = vec2(fx, fy), p1 = p0 + sh, pm = p0 + 0.5 * sh;\r
      float m0 = boxAA(p0.x, cx - 0.5 * acW, cx + 0.5 * acW, aw) * boxAA(p0.y, wy0, wy0 + acH, ah);\r
      float mm = boxAA(pm.x, cx - 0.5 * acW, cx + 0.5 * acW, aw) * boxAA(pm.y, wy0, wy0 + acH, ah);\r
      float m1 = boxAA(p1.x, cx - 0.5 * acW, cx + 0.5 * acW, aw) * boxAA(p1.y, wy0, wy0 + acH, ah);\r
      float hit = max(max(m0, mm), m1);\r
      if (hit > 0.0) {\r
        float gy = (p1.y - wy0) / acH;\r
        vec3 acC = mix(vec3(0.62, 0.61, 0.57), vec3(0.5, 0.52, 0.52), step(0.5, fract(cR3 * 91.0))) * (0.85 + 0.2 * nz2.r);\r
        float gr = step(0.5, fract(gy * 7.0)) * step(0.35, gy) * step(gy, 0.92);   // front grille slots\r
        Surf ac; ac.metal = 0.3; ac.rough = 0.55; ac.emis = vec3(0.0);\r
        if (m1 > 0.5) { ac.alb = acC * (1.0 - 0.3 * gr); ac.n = vec3(0.0, 0.0, 1.0); }\r
        else if (p1.y > wy0 + acH) { ac.alb = acC * 1.1; ac.n = vec3(0.0, 1.0, 0.15); }           // top face\r
        else if (p1.y < wy0) { ac.alb = acC * 0.4; ac.n = vec3(0.0, -1.0, 0.15); }                // underside\r
        else { ac.alb = acC * 0.8; ac.n = vec3(p1.x < cx ? -1.0 : 1.0, 0.0, 0.2); }               // side\r
        ac.n = normalize(ac.n);\r
        float k = hit * (1.0 - lod);\r
        r.alb = mix(r.alb, ac.alb, k); r.rough = mix(r.rough, ac.rough, k); r.metal = mix(r.metal, ac.metal, k);\r
        r.n = normalize(mix(r.n, ac.n, k)); r.emis *= 1.0 - k; gGlass *= 1.0 - k;\r
        gAcN = k; // (night)\r
      }\r
      // cast shadow on the sill / wall below and a thin condensate stain\r
      float shd = boxAA(fx, cx - 0.5 * acW, cx + 0.5 * acW + 0.1, aw) * boxAA(fy, wy0 - 0.45, wy0, ah) * (1.0 - hit);\r
      float drip = boxAA(fx, cx + 0.12, cx + 0.2, aw) * step(fy, wy0) * (1.0 - smoothstep(0.0, 2.2, wy0 - fy));\r
      r.alb *= (1.0 - 0.45 * shd * (1.0 - smoothstep(0.0, 0.45, wy0 - fy))) * (1.0 - 0.3 * drip);\r
    }\r
  }\r
  // far LOD (skyline): exactly box-filtered window pattern (pbox) instead of a flat average: floor bands, deco pier\r
  // lines, spandrel stripes and mullion grids stay readable on distant towers and fade to the true mean (no moire)\r
  if (lod > 0.0) {\r
    float wf = 1.8; // (skyline r4) wider box filter: kills the micro-grid moire seen from altitude\r
    float cxw = pbox(ux, bw, wx0, wx0 + ww, aw * wf);\r
    float cyw = pbox(yy, fh, wy0, wy0 + wh, ah * wf);\r
    float cov = cxw * cyw * valid;\r
    vec3 roomAvg = textureLod(tInterior, vec2((mod(tile, 4.0) + 0.5) / 4.0, 1.0 - (floor(tile / 4.0) + 0.5) / 4.0), 9.0).rgb;\r
    Surf a;\r
    a.n = vec3(0, 0, 1); a.metal = 0.0;\r
    if (curtain) {\r
      float capx = 1.0 - pbox(fx, bw, cw, bw - cw, aw * wf);\r
      float capy = 1.0 - pbox(yy, fh, cw, fh - cw, ah * wf);\r
      float cap = clamp(capx + capy - capx * capy, 0.0, 1.0);\r
      vec3 glc = gt * ((lowIron ? 0.13 : 0.05) + 0.03 * cellR); // (skyline r7) low-iron glass body tone (as near LOD)\r
      glc *= 0.75 + 0.5 * zR; // (skyline r12) per-zone tone (as near LOD)\r
      if (vX.y > 2.5) glc = vec3(0.05, 0.052, 0.055); // (street r11) louvre band\r
      glc = mix(glc, vec3(0.3, 0.3, 0.28), 0.75 * cBl * cBl * mix(0.5, 1.0, wv)); // (skyline r8) blinds (pane-average of the near LOD)\r
      vec3 capc = capC * (0.9 + 0.2 * nz2.r);\r
      float vis = cyw * valid;\r
      a.alb = mix(mix(spC, glc, vis), capc, cap);\r
      a.rough = mix(mix(spGl > 0.5 ? 0.1 : 0.38, 0.06, vis), 0.42, cap);\r
      a.metal = cap * 0.85 + (1.0 - cap) * (1.0 - vis) * (spGl > 0.5 ? 0.3 : 0.5);\r
      gGlass = mix(gGlass, (1.0 - cap) * mix(spGl * 0.8, 1.0, vis), lod);\r
      a.emis = roomAvg * uInteriorGain * 0.25 * vis * (1.0 - cap) * (0.6 + 0.8 * lit);\r
      gCovN = vis * (1.0 - cap) * (1.0 - 0.6 * cBl); // (night)\r
    } else {\r
      vec3 avgGlass = vec3(0.035, 0.038, 0.042);\r
      { // (skyline r8) per-window variation in the far LOD: blinds / curtains (same cellR rule as the near LOD), lit vs\r
        // dark rooms, pane tone; fades to the mean once a window cell is sub-1.5 px\r
        float thr = deco ? 0.86 : (pOK ? 0.8 : 0.55), bf = cellR > thr ? min(1.0, (cellR - thr) * 1.8) : 0.0; // (street r10) zOK: fewer blinds\r
        vec3 bcF = resid ? mix(vec3(0.85, 0.8, 0.7), vec3(0.6, 0.35, 0.3), step(0.8, cellR2)) : vec3(0.82, 0.82, 0.8);\r
        vec3 wvC = avgGlass * (0.55 + 0.9 * cellR2) + roomAvg * 0.08 * lit;\r
        wvC = mix(wvC, bcF * 0.55, bf);\r
        float meanB = deco ? 0.02 : (pOK ? 0.06 : 0.2); // (street r10) masonry: fewer blinds -> darker window mean\r
        avgGlass = mix(mix(avgGlass, bcF * 0.55, meanB), wvC, wv);\r
      }\r
      vec3 wallC = o.alb;\r
      if (deco) { // recessed dark spandrels stacked between the windows: vertical pier lines\r
        vec3 spd = mix(vec3(0.075, 0.078, 0.082), vec3(0.2, 0.2, 0.19), 0.35 * fract(seed * 3.3)) * (0.85 + 0.3 * nz2.r);\r
        wallC = mix(o.alb, mix(spd, avgGlass, cyw), cxw * valid);\r
        a.alb = wallC;\r
        a.metal = 0.2 * cxw * valid * (1.0 - cyw);\r
      } else {\r
        a.alb = mix(wallC, avgGlass, cov);\r
      }\r
      a.alb *= 1.0 - 0.1 * cxw * valid * (1.0 - cyw); // reveals / sills shading\r
      a.rough = mix(o.rough, 0.12, cov);\r
      gGlass = mix(gGlass, cov, lod);\r
      a.emis = (roomAvg * 0.25 * (0.4 + 1.2 * lit) + vec3(0.03, 0.036, 0.045)) * uInteriorGain * cov * (pOK ? 0.7 : (deco ? 0.5 : 1.0)); // (textures r4) pOK 0.45 -> 0.7 // (street r10) darker masonry windows; (skyline r11) deco too\r
      gCovN = cov * (pOK ? 0.85 : 1.0); // (night)\r
    }\r
    r.alb = mix(r.alb, a.alb, lod); r.rough = mix(r.rough, a.rough, lod); r.metal = mix(r.metal, a.metal, lod);\r
    r.n = normalize(mix(r.n, a.n, lod)); r.emis = mix(r.emis, a.emis, lod);\r
  }\r
  // (night) lit windows replace the day emission (whose fake sky-reflection floor + x4.5 night exposure turned every\r
  // window into a lit pane). Near: the room seen through the glass (interior mapping with lit = nOn: ceiling lights,\r
  // back wall), backlit blinds / curtains glow dimmer; dark rooms are nearly black glass. Far: exact glass coverage x\r
  // this window's state, then the floor / building mean once windows / floors get sub-pixel (no shimmer).\r
  if (uNightK > 0.0) {\r
    const float nG = 0.5; // lit-room radiance scale (the night exposure is x4.5)\r
    float glassM = open * inG * (1.0 - frame) * (1.0 - gAcN) * (1.0 - capW);\r
    float bc2 = clamp(gBlN + gCurN, 0.0, 1.0);\r
    // backlit blinds / curtains: slats + a glow gradient toward the lamp side, not a flat card\r
    float slatN = 0.3 + 0.12 * step(0.5, fract(gp.y * 25.0)) + 0.18 * clamp(gq.y, 0.0, 1.0);\r
    vec3 nearE = nOn > 0.5 ? (room * (1.0 - bc2) + vec3(slatN) * gBlN + vec3(0.2 * (0.8 + 0.2 * sin(gp.x * 38.0))) * gCurN) * nCol : room * 0.012;\r
    vec3 perW = nOn > 0.5 ? nCol : vec3(0.012);\r
    vec3 kM = mix(perW, mix(nFlM, nBdM, smoothstep(0.35, 0.8, ah / fh)), 1.0 - wv);\r
    vec3 nE = mix(nearE * glassM, gCovN * 0.42 * kM, lod) * nG;\r
    r.emis = mix(r.emis, nE, uNightK);\r
    // (night) the lit room lights its own opening: jambs / head (the faked reveal inside the opening outline), the sill\r
    // and the frame get ~20-30 % of the window radiance, a short falloff onto the sill course / wall under the opening\r
    // (the rect lights of the provider sit on the wall plane: they light what stands in front, not this faked relief)\r
    if (nOn > 0.5 && lod < 1.0) {\r
      float sillM = inWx * boxAA(fy, wy0 - 0.45, wy0 + 0.02, ah) * (0.35 + 0.65 * smoothstep(wy0 - 0.45, wy0, fy)) * valid;\r
      float halo = inWx * boxAA(fy, wy0 - 1.2, wy0 + wh + 0.3, ah) * valid * 0.04;\r
      float revM = open * (1.0 - inG) + 0.6 * frame * open;\r
      r.emis += r.alb * nCol * nG * 0.25 * (revM + 0.8 * sillM + halo) * (1.0 - lod) * uNightK; // ~20 % of the window radiance\r
    }\r
  }\r
  if (uNightK > 0.0 && abs(vWN.y) > 0.6) r.emis *= 1.0 - uNightK; // (lighting2 r3) no 'windows' on roofs / flat tops (far-shore roofs glowed as a pale band at night)\r
  // (skyline r4) large-scale facade breakup on towers (not deco: those carry piers + tier cornices): a louvred\r
  // mechanical floor every M floors, a louvred plant band under the top of every mass (reads as a mechanical crown /\r
  // penthouse at each setback) and, on curtain walls, a heavier vertical pier / fin every K bays. All terms are\r
  // box-filtered (pbox) so they survive at any distance and never shimmer.\r
  if (!deco && topY - gH > 36.0) {\r
    float hM = fract(seed * 2.93 + 0.41), hK = fract(seed * 6.17 + 0.23);\r
    float M = 9.0 + floor(hM * 5.0) * 4.0; // 9..25 floors\r
    float mech = pbox(yy + 0.5 * fh, M * fh, (M - 1.0) * fh, M * fh, ah * 1.3) * step(0.5, hK) * step(3.0 * fh, topY - gH - yy) * (curtain && lowIron ? 0.0 : 1.0); // (skyline r5) 50 % of towers (was 72 %)\r
    float crownH = (curtain ? 1.0 : 1.4) * fh + (hM > 0.55 ? fh : 0.0);\r
    float crownB = boxAA(yy, topY - gH - crownH, topY - gH + 2.0, ah) * step(0.2, fract(seed * 3.17)) * ((curtain || ribbon || topY - gH > 70.0) ? 1.0 : 0.0) /* (skyline r9) not on masonry mid-rises (bands under cornices) */ * (curtain && lowIron ? 0.0 : 1.0); // (skyline r6) no plant band per tier on the low-iron supertalls (One WTC read as striped)\r
    float band = max(mech, crownB) * boxAA(ux, -0.05, usable + 0.05, aw) * step(0.0, yy);\r
    if (zOK) band = 0.0; // (street r9) masonry walls: no louvred plant floors mid-shaft (read as translucent stripes on brick); the cap zone crowns them\r
    float pierM = 0.0, finN = 0.0;\r
    bool roundT = gHs < -0.015 && gHs > -0.03; // (skyline r9) round tower tiers (FacadeBuilder.cyl wrap)\r
    if ((curtain && hK > 0.45) || roundT) { // vertical pier fin every K bays (0.3-0.5 m), lit / shaded edge\r
      float K = roundT ? 1.0 + floor(fract(seed * 9.31) * 2.0) : 2.0 + floor(fract(seed * 9.31) * 4.0), pw = (roundT ? 0.34 : 0.3) + 0.2 * fract(seed * 1.77);\r
      pierM = pbox(ux + 0.5 * pw, K * bw, 0.0, pw, aw * 1.3) * valid;\r
      float ft = mod(ux + 0.5 * pw, K * bw) / pw; // across the fin: rounded profile -> lit / shaded edges (near range)\r
      finN = step(ft, 1.0) * (ft * 2.0 - 1.0) * 0.85 * (1.0 - lod);\r
    }\r
    if (band > 0.001 || pierM > 0.001) {\r
      float sl = pbox(yy, 0.32, 0.0, 0.13, ah * 1.2); // louvre blades: converge to their mean when sub-pixel\r
      vec3 louv = (curtain ? mix(capC, vec3(0.2, 0.21, 0.22), 0.78) : mix(o.alb * 0.55, vec3(0.2, 0.21, 0.22), 0.6)) * (1.0 - 0.45 * sl) * (0.9 + 0.2 * nz2.g);\r
      // louvre floors keep the pier / mullion rhythm (thin stiles every bay)\r
      float stile = 1.0 - pbox(fx, bw, cw + 0.03, bw - cw - 0.03, aw * 1.3);\r
      louv = mix(louv, curtain ? capC : o.alb * 1.05, stile * 0.8);\r
      r.alb = mix(r.alb, louv, band); r.rough = mix(r.rough, 0.55, band); r.metal = mix(r.metal, curtain ? 0.6 : 0.2, band);\r
      r.n = normalize(mix(r.n, vec3(0.0, -0.3 * (1.0 - lod), 1.0), band)); // (skyline r9) blades slope down-out: no sky-blue glint from the street r.emis *= 1.0 - band; gGlass *= 1.0 - band;\r
      r.emis *= 1.0 - band * uNightK; // (night) the line above only comments this out: no lit rooms behind louvre floors\r
      vec3 pc = mix(capC, vec3(0.62, 0.63, 0.63), step(0.62, fract(seed * 4.39 + 0.5)) * 0.4) * (0.85 + 0.3 * nz2.r);\r
      if (roundT && !curtain) pc = o.alb * vec3(1.1, 1.09, 1.07); // (skyline r9) cast-stone / concrete fins on masonry drums\r
      float pm = pierM * (1.0 - band);\r
      r.n = normalize(mix(r.n, vec3(finN, 0.0, 1.0), pm * (1.0 - lod)));\r
      r.alb = mix(r.alb, pc, pm); r.rough = mix(r.rough, 0.38, pm); r.metal = mix(r.metal, 0.8, pm); r.emis *= 1.0 - pm; gGlass *= 1.0 - pm;\r
    }\r
  }\r
  if (curtain) r.n = normalize(r.n + vec3(gWob, 0.0) * clamp(gGlass, 0.0, 1.0));\r
  // (skyline r12) critic: 'no ambient occlusion at setback ledges'. Contact shade at the foot of every set-back tier\r
  // (the terrace roof + parapet occlude the lower wall), plus a long soft falloff; box-filtered by construction (no tex)\r
  if (tierY > 1.0) {\r
    float dyT = vFac.y - tierY;\r
    float aoT = 0.36 * (1.0 - smoothstep(0.0, 4.5, dyT)) + 0.14 * (1.0 - smoothstep(0.0, 20.0, dyT));\r
    r.alb *= 1.0 - aoT; r.emis *= 1.0 - 0.6 * aoT; gGlass *= 1.0 - 0.5 * aoT;\r
    gAoT = aoT; // (night)\r
  }\r
  o = r;\r
}\r
`,Ue=`#include <common>
out vec3 vWPs; out vec3 vWNs;`,We=`#include <begin_vertex>\r
      vNeck = aEx.x; { vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz; vFat = max(0.0, length(wp - cameraPosition) * 0.0011 - 0.15); transformed += objectNormal * vFat; vWPc = wp; }`,Ge=`#include <common>
in vec3 vWPc; in float vNeck, vFat; uniform float uNightK;`,Ke=`#include <metalnessmap_fragment>
metalnessFactor *= 1.0 - 0.85 * uNightK; diffuseColor.rgb *= 1.0 - 0.7 * uNightK;`,Y=`#include <emissivemap_fragment>\r
      if (uNightK > 0.0 && vNeck > 0.5) { float q = (vWPc.x + vWPc.z) * 0.18; float fq = fwidth(q) + 1e-4;\r
        // (night) small bright bulbs, not a glowing bar: each bulb stays >= ~1.5 px long at any distance (never averaged\r
        // into a continuous line); once bulbs crowd to < ~3.5 px apart only every 2nd / 4th / ... bulb is drawn (stable\r
        // world-space subset), so far bridges keep a dotted necklace of points. Bloom does the glow\r
        float st = exp2(ceil(log2(max(1.0, fq * 6.0)))); // (night r11) 3.5: far necklaces read as dashed white bars\r
        float hw = max(0.05, fq * 0.75), dd = abs(fract(q) - 0.5);\r
        float dot1 = (1.0 - smoothstep(hw - 0.5 * fq, hw + 0.5 * fq, dd)) * step(mod(floor(q), st), 0.5);\r
        // (night r11) the cable is fattened with distance (~1.5 m at 1.5 km): the bulb's emission is scaled back by the\r
        // fattening, so far necklaces read as fine warm points instead of thick white dashes (esb view)\r
        totalEmissiveRadiance += vec3(1.0, 0.9, 0.72) * dot1 * 3.5 * uNightK / (1.0 + vFat * 6.0); }`,qe=`#include <common>
out vec2 vTU;`,Je=`#include <begin_vertex>
vTU = uv;`,Ye=`#include <common>
in vec2 vTU;`,Xe=`#include <clipping_planes_fragment>\r
        if (vTU.y < 1.5) { float u = fract(vTU.x), v = vTU.y; vec2 fw = fwidth(vTU) + 1e-4;\r
          float chord = step(v, 0.08 + fw.y) + step(0.92 - fw.y, v);\r
          float post = step(min(u, 1.0 - u), 0.05 + fw.x);\r
          float d1 = abs(u - v), d2 = abs(u - (1.0 - v));\r
          float diag = step(min(d1, d2), 0.06 + fw.x + fw.y);\r
          // far away the web is sub-pixel: keep it solid (dithered holes would read as polka dots)\r
          if (chord + post + diag < 0.5 && max(fw.x, fw.y) < 0.09) discard;\r
        } else { float v = vTU.y - 2.0, u = vTU.x; vec2 fw = fwidth(vec2(u * 16.0, v)) + 1e-4;\r
          float rail = step(0.9 - fw.y, v) + step(v, 0.07 + fw.y) + step(abs(v - 0.5), 0.035 + fw.y);\r
          float post = step(min(fract(u), 1.0 - fract(u)), 0.04 + fw.x / 16.0);\r
          float pick = step(abs(fract(u * 16.0) - 0.5), 0.12 + fw.x);\r
          if (rail + post + pick < 0.5 && fw.x < 0.6) discard; }`,Ze=`#include <common>
in vec3 aEx; out vec3 vWPd; out vec3 vWNd; out vec2 vUD; out vec3 vEx;`,Qe=`#include <fog_vertex>
vWPd = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNd = normalize(mat3(modelMatrix) * objectNormal); vUD = uv; vEx = aEx;`,$e=`#include <fog_vertex>
vWPs = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNs = normalize(mat3(modelMatrix) * objectNormal);`,et=`#include <common>\r
      uniform sampler2D tDC; uniform sampler2D tSN; in vec3 vWPd; in vec3 vWNd; in vec2 vUD; in vec3 vEx;\r
      float bandL(float l, float c, float w, float fw) { return 1.0 - smoothstep(w * 0.5 - fw, w * 0.5 + fw, abs(l - c)); }`,tt=`{\r
        vec3 c = texture(tDC, vWPd.xz / 6.0).rgb * 1.1;\r
        float md = floor(vEx.z + 0.5);\r
        vec3 nz = texture(tSN, vWPd.xz / 23.0).rgb;\r
        if (vWNd.y < 0.5) c = vec3(0.42, 0.42, 0.41) * (0.85 + 0.25 * nz.r); // slab edges / fascia / kerbs: concrete\r
        else if (md == 1.0) {\r
          float l = abs(vUD.y), a = vUD.x, inner = vEx.x, outer = vEx.y;\r
          float fw = fwidth(vUD.y) + 1e-3;\r
          float fade = 1.0 - smoothstep(0.08, 0.3, fw); // lines fade to the asphalt tone before they alias\r
          float w = bandL(l, outer - 0.45, 0.15, fw);\r
          if (inner > 0.3) w = max(w, bandL(l, inner + 0.45, 0.15, fw));\r
          float n = floor((outer - inner - 1.0) / __SHADER_INJECT_0__ + 0.5);\r
          float k = floor((l - inner - 0.5) / __SHADER_INJECT_1__ + 0.5);\r
          if (k >= 1.0 && k <= n - 1.0) w = max(w, bandL(l, inner + 0.5 + k * __SHADER_INJECT_2__, 0.13, fw) * step(fract(a / 12.0), 0.27));\r
          float y = inner < 0.3 ? max(bandL(l, 0.2, 0.12, fw), 0.0) : 0.0;\r
          // tyre-polished wheel paths (darker, smoother) in every lane\r
          float ln = fract((l - inner - 0.5) / __SHADER_INJECT_3__);\r
          float wear = (1.0 - smoothstep(0.08, 0.16, abs(ln - 0.27))) + (1.0 - smoothstep(0.08, 0.16, abs(ln - 0.73)));\r
          c *= 1.0 - 0.13 * wear * step(l, outer - 0.5) * step(inner + 0.5, l);\r
          // expansion joints every 30 m (steel strip)\r
          c = mix(c, vec3(0.32, 0.31, 0.3), (1.0 - smoothstep(0.05, 0.12 + fwidth(a), abs(fract(a / 30.0) - 0.5) * 30.0)) * fade);\r
          c = mix(c, vec3(0.84, 0.83, 0.78) * (0.8 + 0.25 * nz.g), w * 0.85 * fade);\r
          c = mix(c, vec3(0.78, 0.6, 0.17), y * 0.85 * fade);\r
        } else if (md == 2.0) { // timber planks across the promenade, grey-brown, worn\r
          float a = vUD.x / 0.32, pl = fract(a), id = floor(a);\r
          float h = fract(sin(id * 12.9898) * 43758.5453);\r
          // (bridges r2) weathered timber: warm brown boards greyed by the sun, darker grime patches and a\r
          // foot-polished centre band, dark gaps between the boards\r
          vec3 wood = vec3(0.43, 0.33, 0.24) * (0.72 + 0.34 * h);\r
          vec3 grey = vec3(0.4, 0.38, 0.35) * (0.8 + 0.2 * h);\r
          c = mix(wood, grey, 0.35 + 0.4 * nz.g);\r
          float grain = texture(tSN, vec2(vWPd.x * 0.9, vUD.y * 11.0 + id * 3.1)).r;\r
          c *= 0.82 + 0.3 * grain;\r
          c *= 1.0 - 0.32 * smoothstep(0.52, 0.8, texture(tSN, vWPd.xz / 7.0).b);       // grime / wet-rot patches\r
          c *= 1.0 - 0.18 * smoothstep(1.2, 3.2, abs(vUD.y));                            // edges darker (less foot traffic)\r
          c *= 1.0 - 0.55 * (1.0 - smoothstep(0.0, 0.07 + fwidth(a), min(pl, 1.0 - pl))) * (1.0 - smoothstep(0.2, 0.5, fwidth(a)));\r
        } else if (md == 3.0) { // ballast + timber ties every 0.62 m\r
          vec3 bal = vec3(0.36, 0.34, 0.31) * (0.7 + 0.5 * texture(tSN, vWPd.xz / 1.3).r);\r
          float t = fract(vUD.x / 0.62), tie = step(abs(t - 0.5), 0.2) * step(abs(abs(vUD.y) - 2.3), 1.35);\r
          c = mix(bal, vec3(0.22, 0.18, 0.15), tie * (1.0 - smoothstep(0.2, 0.5, fwidth(vUD.x / 0.62))));\r
        } else if (md == 4.0) { c = vec3(0.56, 0.55, 0.52) * (0.8 + 0.3 * nz.r); }\r
        diffuseColor.rgb *= c;\r
      }`,nt=`#include <common>
uniform sampler2D tSN; in vec3 vWPs; in vec3 vWNs;`,rt=`{\r
        vec3 an = abs(vWNs);\r
        vec2 q = an.x > an.z ? vWPs.zy : vWPs.xy; if (an.y > 0.7) q = vWPs.xz;\r
        vec3 nz = texture(tSN, q / 17.0).rgb, nz2 = texture(tSN, q / 3.1).rgb;\r
        // ashlar coursing: 0.9 m courses, 1.8 m blocks (offset every other course), thin dark joints\r
        float cy = q.y / 0.9, row = floor(cy), cx = q.x / 1.8 + 0.5 * mod(row, 2.0);\r
        vec2 f = vec2(fract(cx), fract(cy)); vec2 fw = fwidth(vec2(cx, cy)) * 1.5 + 1e-4;\r
        float joint = max(1.0 - smoothstep(0.0, 0.03 + fw.x, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, 0.04 + fw.y, min(f.y, 1.0 - f.y)));\r
        joint *= 1.0 - smoothstep(0.2, 0.6, max(fw.x, fw.y));\r
        float blk = fract(sin(dot(floor(vec2(cx, cy)), vec2(12.9898, 78.233))) * 43758.5453);\r
        vec3 c = diffuseColor.rgb * (0.86 + 0.16 * blk) * (0.8 + 0.3 * nz.r) * (0.93 + 0.1 * nz2.g);\r
        c *= 1.0 - 0.35 * joint;\r
        c *= mix(0.72, 1.0, smoothstep(-1.0, 6.0, vWPs.y)); // wet / algae band at the water line\r
        c *= 1.0 - 0.18 * smoothstep(0.55, 0.85, nz.b) * (0.5 + 0.5 * an.x + 0.5 * an.z); // grime streaks\r
        diffuseColor.rgb = c;\r
      }`,it=`#include <common>
in vec3 aEx; out float vGlow;`,at=`#include <begin_vertex>
vGlow = aEx.x;`,ot=`#include <common>
in float vGlow; uniform float uNightK;`,st=`#include <emissivemap_fragment>\r
        totalEmissiveRadiance += vec3(1.0, 0.82, 0.55) * vGlow * (0.15 + 7.0 * uNightK);`,ct=`#include <common>
in vec3 aEx; out vec3 vWPc; out float vNeck, vFat;`,lt=`#include <common>
out vec3 vWPw; uniform mat4 uTexMat; out vec4 vRefl;`,ut=`#include <uv_vertex>
vWetUv = uv;`,dt=`#include <common>
uniform sampler2D tWetN; in vec2 vWetUv;`,ft=`{\r
        float u = vWetUv.x, y = vWetUv.y;\r
        vec3 nz = texture(tWetN, vec2(u / 9.0, 0.37)).rgb, nz2 = texture(tWetN, vec2(u / 2.1, y * 0.4 + 0.1)).rgb;\r
        float top = 0.45 + 0.35 * nz.r + 0.15 * nz2.g;            // ragged high-water line\r
        float a = 1.0 - smoothstep(top - 0.12, top + 0.04, y);\r
        float algae = 1.0 - smoothstep(0.1, 0.35, y);              // green-black slime right at the water line\r
        vec3 c = mix(vec3(0.07, 0.065, 0.055), vec3(0.04, 0.06, 0.035), algae);\r
        c *= 0.8 + 0.4 * nz2.b;\r
        // streaks running down from the high-water line\r
        a = max(a, (1.0 - smoothstep(0.0, 0.9, y)) * smoothstep(0.62, 0.8, texture(tWetN, vec2(u / 0.9, 0.71)).r) * 0.6);\r
        diffuseColor = vec4(c, a * 0.88);\r
      }`,pt=`#include <fog_vertex>\r
        vWPw = (modelMatrix * vec4(transformed, 1.0)).xyz; vRefl = uTexMat * vec4(vWPw, 1.0);`,mt=`#include <common>\r
      uniform sampler2D tWN; uniform sampler2D tWNoise; uniform float uWTime; in vec3 vWPw;\r
      uniform sampler2D tRefl; uniform float uReflOn; in vec4 vRefl;\r
      uniform sampler2D tShore; uniform vec4 uShoreBox;\r
      vec3 wN; float wR; float wDist; float wSh = 1.0; vec2 wDisp; float wSlick; float wShore; float wNearS; float wStreak;\r
      vec2 wn(vec2 uv) { return texture(tWN, uv).rg * 2.0 - 1.0; }\r
      vec3 river() {\r
        vec2 p = vWPw.xz;\r
        float dist = length(vWPw - cameraPosition); wDist = dist;\r
        float t = uWTime;\r
        // broad structure: wind slicks (smooth bands) and current streaks along the rivers (z axis)\r
        vec3 m1 = texture(tWNoise, p / 900.0 + vec2(0.0, t * 0.0015)).rgb;\r
        vec3 m2 = texture(tWNoise, vec2(p.x / 260.0, p.y / 1400.0) + vec2(0.31, t * 0.004)).rgb;\r
        float slick = smoothstep(0.52, 0.72, m1.g) * 0.8 + smoothstep(0.62, 0.8, m2.r) * 0.35;\r
        // distance to the nearest shore (m, baked 8 m/px map): sheltered, silty water along the bulkheads\r
        wShore = 400.0;\r
        #ifdef HAS_SHORE\r
          wShore = texture(tShore, (p - uShoreBox.xy) / uShoreBox.zw).r * 400.0;\r
        #endif\r
        float nearS = 1.0 - smoothstep(6.0, 70.0, wShore);\r
        // cat's paws: gusts roughen large patches (they read as brighter / hazier sheen from the air)\r
        vec3 m3 = texture(tWNoise, p / 520.0 + vec2(t * 0.003, -t * 0.002)).rgb;\r
        float gust = smoothstep(0.45, 0.75, m3.b) * (1.0 - slick);\r
        slick = clamp(slick + nearS * 0.35, 0.0, 1.0); wSlick = slick; wNearS = nearS;\r
        // (round 5) wind rows / current streaks: long thin bands along the rivers (z) that break the sheet into\r
        // brighter, rougher lines (the refs' rivers are never one uniform glassy surface)\r
        float s1 = texture(tWNoise, vec2(p.x / 34.0, p.y / 520.0) + vec2(t * 0.0008, t * 0.003)).g;\r
        float s2 = texture(tWNoise, vec2(p.x / 11.0 + p.y / 900.0, p.y / 260.0) + vec2(0.57, t * 0.005)).r;\r
        float streak = smoothstep(0.58, 0.8, s1) * 0.7 + smoothstep(0.66, 0.86, s2) * 0.45;\r
        streak *= (1.0 - 0.7 * nearS); wStreak = streak;\r
        // wave normals: chop (two directions) + swell, faded with distance and in slicks\r
        // (atmosphere r2) the two broad layers are rotated off-axis and amplitude-modulated by the wind field, so their\r
        // repeat does not read as a tiling ripple across the whole East River from the air\r
        vec2 pr1 = mat2(0.829, -0.559, 0.559, 0.829) * p, pr2 = mat2(0.438, 0.899, -0.899, 0.438) * p;\r
        float amp = 0.55 + 0.9 * m3.g;\r
        vec2 n = wn(p / 9.0 + vec2(t * 0.021, t * 0.013)) * 0.55\r
               + wn(vec2(-p.y, p.x) / 14.0 + vec2(t * -0.012, t * 0.017)) * 0.45\r
               + wn(pr1 / 53.0 + vec2(t * 0.004, -t * 0.006)) * 0.7 * amp\r
               + wn(pr2 / 173.0 + vec2(-t * 0.002, t * 0.003)) * 0.5 * (1.5 - amp * 0.7);\r
        float fade = mix(1.0, 0.45, smoothstep(60.0, 2500.0, dist));\r
        n *= 0.34 * fade * (1.0 - 0.55 * slick) * (1.0 + 0.8 * gust + 0.6 * streak);\r
        // (round 8) far-field wave groups: long swell / wind-row undulation that fades IN with distance, where the chop is\r
        // sub-pixel -- the far river breaks into broad mottled sheen bands instead of one flat glossy plate\r
        n += (wn(vec2(p.x / 380.0, p.y / 170.0) + vec2(t * 0.0012, -t * 0.002)) * 0.7 + wn(p / 95.0 + vec2(-t * 0.003, t * 0.002)) * 0.45)\r
             * 0.15 * smoothstep(300.0, 1800.0, dist) * (1.0 - 0.5 * slick);\r
        wN = normalize(vec3(n.x, 1.0, n.y));\r
        // mirror distortion: waves smear the reflection vertically (screen space), less in the slicks; (round 5) plus a\r
        // mid-scale ripple field that does NOT fade with distance, so far reflections break into wobbly bands\r
        vec2 rip = wn(vec2(p.x / 26.0, p.y / 7.0) + vec2(t * 0.011, -t * 0.019)) + 0.6 * wn(p / 61.0 + vec2(-t * 0.006, t * 0.009));\r
        wDisp = n * (0.9 - 0.5 * slick) + rip * 0.09 * (1.0 - 0.5 * slick);\r
        // roughness (round 5: ~0.1-0.3 like real wind-blown river water): calm slicks, rougher chop / gusts / streaks,\r
        // far water rougher to integrate sub-pixel waves\r
        wR = clamp(0.09 + 0.08 * (1.0 - slick) + 0.1 * gust + 0.07 * streak + 0.07 * smoothstep(300.0, 5000.0, dist), 0.07, 0.32);\r
        // (round 8) far wind fields: broad rough / glassy patches that stay visible at 1-4 km (hazier vs mirror sheen)\r
        wR = clamp(wR + (texture(tWNoise, p / 1500.0 + vec2(0.13, t * 0.0006)).g - 0.5) * 0.22 * smoothstep(400.0, 1500.0, dist), 0.06, 0.34);\r
        #ifndef NO_SSR\r
          wR = max(wR + 0.05, 0.13); // (atmosphere r2) ponds / reservoir: wind-ruffled, the cloud reflection is never a crisp cubemap\r
        #endif\r
        // body colour: deep muted green-grey, turbid variation; silty olive-brown along the shores, a little deeper /\r
        // bluer mid-channel (depth), current streaks along the rivers\r
        vec3 c = vec3(__SHADER_INJECT_0__);\r
        c *= 0.85 + 0.3 * m1.r;\r
        c = mix(c, vec3(0.07, 0.085, 0.075), smoothstep(0.4, 0.8, m2.b) * 0.5);\r
        c = mix(c, vec3(0.06, 0.066, 0.055), nearS * 0.55);\r
        c = mix(c, c * vec3(0.8, 0.9, 1.05), smoothstep(150.0, 400.0, wShore));\r
        c *= 1.0 + 0.25 * streak;\r
        // (round 7) wash line: a broken pale band of churned water / flotsam hugging bulkheads and pier edges, and a\r
        // brown-olive silt plume a little further out (the rivers change colour toward every shore)\r
        #ifdef HAS_SHORE\r
        {\r
          float fn = texture(tWNoise, p / 23.0 + vec2(t * 0.002, -t * 0.003)).g, fn2 = texture(tWNoise, p / 6.0 + vec2(-t * 0.004, t * 0.002)).b;\r
          float wash = (1.0 - smoothstep(1.0, 9.0 + 6.0 * fn, wShore)) * smoothstep(0.35, 0.65, fn * 0.6 + fn2 * 0.6);\r
          c = mix(c, vec3(0.2, 0.205, 0.19), wash * 0.55);\r
          float silt = (1.0 - smoothstep(10.0, 120.0, wShore)) * (0.55 + 0.45 * fn);\r
          c = mix(c, vec3(0.085, 0.08, 0.058), silt * 0.4);\r
        }\r
        #endif\r
        return c;\r
      }`,ht=`diffuseColor.rgb = river();`,gt=`float roughnessFactor = wR;`,_t=`normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);`,vt=`__SHADER_INJECT_0__\r
        // (round 7) sun glitter: sparse sub-pixel facets on a finer, faster chop catch the sun (a sparkling glint path\r
        // toward the sun instead of one smooth lobe); fades with distance into the broad specular sheen\r
        #if ( NUM_DIR_LIGHTS > 0 )\r
        {\r
          vec2 gp = vWPw.xz;\r
          vec2 gn = wn(gp / 2.3 + vec2(uWTime * 0.05, uWTime * 0.034)) + 0.8 * wn(vec2(-gp.y, gp.x) / 3.7 + vec2(-uWTime * 0.041, uWTime * 0.02));\r
          vec3 nG = normalize(wN + vec3(gn.x, 0.0, gn.y) * 0.22 * (1.0 - 0.6 * wSlick));\r
          vec3 nGv = normalize((viewMatrix * vec4(nG, 0.0)).xyz);\r
          vec3 Hh = normalize(directLight.direction + geometryViewDir);\r
          float gl = pow(clamp(dot(nGv, Hh), 0.0, 1.0), 700.0);\r
          float spark = smoothstep(0.62, 0.9, texture(tWNoise, gp / 5.0 + vec2(uWTime * 0.02, 0.0)).r);\r
          float gfade = 1.0 - smoothstep(900.0, 4000.0, wDist);\r
          reflectedLight.directSpecular += directLight.color * gl * spark * gfade * 14.0 * wSh;\r
        }\r
        #endif`,yt=`#include <lights_fragment_maps>\r
        // (atmosphere r2) sky reflection: the env map's lowest ~6 deg hold a generic city band (for the towers' IBL);\r
        // open water at grazing angles must mirror the horizon SKY instead (critic: 'flat grey sheet, no fresnel sky\r
        // gradient'). Re-fetch the env with the reflection lifted above that band; the planar mirror adds the real\r
        // skyline on top. Grazing view -> brighter, paler horizon sky; looking down -> deep body colour + zenith blue.\r
        #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )\r
        {\r
          vec3 rvW = transformDirectionByInverseViewMatrix(reflect(-geometryViewDir, normal), viewMatrix);\r
          rvW.y = abs(rvW.y) * 0.8 + 0.1;\r
          radiance = textureCubeUV(envMap, envMapRotation * normalize(rvW), material.roughness).rgb * envMapIntensity;\r
          radiance *= mix(0.3, 1.0, ambData.bounce.w); // (night) the night sky mirror stays dim: dark water with the city's light streaks (critic r2: rivers brighter than the city)\r
        }\r
        #endif\r
        if (uReflOn > 0.5 && vRefl.w > 0.0) {\r
          vec2 ruv = vRefl.xy / vRefl.w;\r
          // (round 4) ripple distortion that survives distance (sheared horizontally by the chop) + a vertical smear:\r
          // real river reflections are stretched / broken toward the viewer, never a crisp mirror\r
          vec2 d = vec2(wDisp.x * 0.7, wDisp.y * 1.6) * 0.22 / (1.0 + wDist * 0.00025);\r
          float spread = (0.004 + 0.034 * wR) * (1.0 - 0.5 * wSlick);\r
          float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);\r
          vec4 pr = vec4(0.0);\r
          for (int k = 0; k < 8; k++) {\r
            float o = (float(k) + jit) / 8.0 - 0.35;\r
            pr += texture(tRefl, ruv + d * (1.0 + 0.12 * float(k)) + vec2(o * spread * 0.25, o * spread));\r
          }\r
          pr /= 8.0;\r
          vec2 e = smoothstep(0.0, 0.03, ruv) * smoothstep(1.0, 0.97, ruv);\r
          // the mirror render has no aerial perspective: haze it toward the sky radiance with distance (round 5: faster,\r
          // so far reflections are soft ghosts, never a crisp second skyline)\r
          vec3 mir = mix(pr.rgb, radiance, 0.28 + 0.52 * smoothstep(200.0, 3500.0, wDist));\r
          // rough water (gusts / streaks) scatters the image: the mirror gives way to the blurred sky IBL\r
          float mw = mix(0.7, 0.9, wSlick) * mix(1.0, 0.5, smoothstep(0.12, 0.3, wR)) * (1.0 - 0.3 * wNearS);\r
          radiance = mix(radiance, mir, clamp(pr.a, 0.0, 1.0) * e.x * e.y * mw);\r
        }\r
        // a weaker sky mirror: the refs' rivers read as a deep grey-blue body, not a white sheet; wind rows catch a\r
        // little more sheen\r
        radiance *= (0.8 + 0.12 * wStreak); // (atmosphere r2) no far dimming: fresnel brightening toward the horizon\r
        // (atmosphere r1) critic: 'river reads flat'. Wind fields modulate the sky sheen at every distance: glassy slicks\r
        // mirror more of the (bright) sky, gust / ruffled patches scatter it into a duller, bluer grey -> visible large-\r
        // scale mottling and streaks like the refs' Hudson / East River, instead of one even grey-blue sheet\r
        radiance *= mix(0.82, 1.22, wSlick) * (1.0 + 0.18 * wStreak) * mix(1.0, 0.86, smoothstep(0.14, 0.3, wR));`,bt=`#include <common>
out vec2 vWetUv;`,xt=`#include <common>
out float vCy; out vec3 vCn; out vec3 vCi;`,St=`#include <begin_vertex>\r
          vCy = position.y; vCn = normal; vCi = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;\r
          __SHADER_INJECT_0__`,Ct=`#include <common>\r
          in float vCy; in vec3 vCn; in vec3 vCi; float cClump;\r
          float cH3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\r
          float cVn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\r
            return mix(mix(mix(cH3(i), cH3(i + vec3(1, 0, 0)), f.x), mix(cH3(i + vec3(0, 1, 0)), cH3(i + vec3(1, 1, 0)), f.x), f.y),\r
                       mix(mix(cH3(i + vec3(0, 0, 1)), cH3(i + vec3(1, 0, 1)), f.x), mix(cH3(i + vec3(0, 1, 1)), cH3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`,wt=`#include <color_fragment>\r
          diffuseColor.rgb *= mix(0.45, 1.05, smoothstep(-0.9, 0.7, vCy));   // dark underside / inner crown\r
          diffuseColor.rgb *= 0.92 + 0.16 * fract(sin(dot(floor(vCn * 2.0 + 0.5), vec3(12.9, 78.2, 37.7))) * 4375.5); // clump tone breakup\r
          // (round 7) cauliflower foliage clusters: leaf-mass lumps with dark gaps between them (per-crown phase), so the\r
          // crowns read as trees, not smooth cotton balls / lollipops\r
          cClump = cVn(vCn * 3.3 + vCi * 0.137) * 0.62 + cVn(vCn * 7.9 + vCi * 0.291) * 0.38;\r
          diffuseColor.rgb *= mix(0.58, 1.1, smoothstep(0.28, 0.72, cClump));`,Tt=`#include <normal_fragment_maps>\r
          { vec3 sx = normalize(dFdx(-vViewPosition)), sy = normalize(dFdy(-vViewPosition));\r
            vec2 dh = vec2(dFdx(cClump), dFdy(cClump)) * 2.2;\r
            vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);\r
            vec3 bn = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));\r
            if (det != 0.0) normal = bn; }`,Et=`{ vec3 ic = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float fs = smoothstep(__SHADER_INJECT_0__, __SHADER_INJECT_1__, length(ic - cameraPosition)); transformed *= max(fs, 1e-3); }
`,Dt=`#include <common>
in float aTile; out float vTile; out vec2 vCuv; out vec3 vCwp; out float vCny;`,Ot=`#include <fog_vertex>
vTile = aTile; vCuv = uv; vCwp = (modelMatrix * vec4(transformed, 1.0)).xyz; vCny = normal.y;`,kt=`#include <common>\r
      uniform sampler2D tAtlas; uniform sampler2D tNoise; uniform sampler2D tPave; in float vTile; in vec2 vCuv; in vec3 vCwp; in float vCny;\r
      float cR;\r
      vec3 atlasTile(float t, vec2 q) {\r
        vec2 off = vec2(mod(t, 2.0) * 0.5, 0.5 - floor(t / 2.0) * 0.5);\r
        return textureGrad(tAtlas, off + 0.002 + fract(q) * 0.496, dFdx(q) * 0.496, dFdy(q) * 0.496).rgb;\r
      }\r
      vec3 coast() {\r
        float t = floor(vTile + 0.5);\r
        vec3 p = vCwp; cR = 0.9;\r
        vec3 nz = texture(tNoise, p.xz / 47.0 + p.y * 0.01).rgb;\r
        vec3 c;\r
        if (t < 3.5) {\r
          c = atlasTile(t, vCuv);\r
          c = pow(c, vec3(0.92)) * 1.05;\r
          // soot / rust streaks running down from the coping, broken by noise along the wall\r
          float sk = texture(tNoise, vec2(vCuv.x * 0.37 + p.x * 0.003, 0.2 + p.y * 0.006)).r;\r
          c *= 1.0 - 0.28 * smoothstep(0.55, 0.85, sk) * (1.0 - abs(vCny));\r
          c *= 0.86 + 0.28 * nz.g;\r
        } else if (t < 4.5) { c = vec3(1.0); cR = 0.55; }\r
        else if (t < 5.5) { // lawn: mown turf, darker clover patches, worn edges\r
          float n2 = texture(tNoise, p.xz / 9.0).g;\r
          c = mix(vec3(0.085, 0.115, 0.045), vec3(0.14, 0.15, 0.065), n2) * (0.85 + 0.3 * nz.r);\r
          c *= 0.94 + 0.06 * step(0.5, fract(p.x / 3.0 + p.z / 7.0));\r
          cR = 0.95;\r
        } else if (t < 6.5) { // promenade pavers (hex / running bond like the esplanade fill in ground.js)\r
          c = texture(tPave, p.xz / 6.0).rgb;\r
          vec2 hp = p.xz / vec2(0.9, 0.78);\r
          float row = floor(hp.y), cu = fract(hp.x + 0.5 * mod(row, 2.0)), cv = fract(hp.y);\r
          float jn = 1.0 - smoothstep(0.0, 0.07, min(min(cu, 1.0 - cu), min(cv, 1.0 - cv)));\r
          float fwp = clamp(fwidth(hp.x) * 2.0, 0.0, 1.0);\r
          c *= vec3(0.8, 0.77, 0.73) * (1.0 - 0.2 * jn * (1.0 - fwp)) * (0.9 + 0.2 * nz.r);\r
          cR = 0.86;\r
        } else if (t > 7.5) { // (r2) ribbed / slatted sheet metal: ribs along u (roofs, every 0.3 m) or v (roll-up doors, 0.12 m)\r
          float q = t < 8.5 ? vCuv.x / 0.3 : vCuv.y / 0.12, f = fract(q), aa = clamp(fwidth(q), 0.0, 1.0);\r
          float rib = mix(0.82 + 0.3 * smoothstep(0.35, 0.5, f) * (1.0 - smoothstep(0.5, 0.65, f)), 1.0, aa);\r
          c = vec3(rib) * (0.85 + 0.25 * nz.r) * (1.0 - 0.25 * smoothstep(0.6, 0.9, texture(tNoise, p.xz / 9.0 + p.y * 0.05).g)); cR = 0.6;\r
        } else { // picket card: vertical steel bars every 11.5 cm\r
          float f = fract(vCuv.x / 0.115), aa = fwidth(vCuv.x / 0.115);\r
          if (aa < 0.35 && abs(f - 0.5) > 0.09 + aa) discard;\r
          c = vec3(1.0); cR = 0.55;\r
        }\r
        // water line: wet dark band + green-black algae up to ~1 m above the water, darker still below it\r
        float yw = p.y - __SHADER_INJECT_0__;\r
        float wetTop = 0.75 + 0.45 * nz.b;\r
        float wet = 1.0 - smoothstep(wetTop - 0.35, wetTop, yw);\r
        c = mix(c, c * vec3(0.42, 0.47, 0.36), wet * 0.85);\r
        c *= mix(1.0, 0.45, 1.0 - smoothstep(-0.6, 0.05, yw));\r
        cR = mix(cR, 0.35, wet * 0.8);\r
        c *= mix(1.0, 0.82, smoothstep(250.0, 1100.0, length(p - cameraPosition)));\r
        return c;\r
      }`,At=`diffuseColor.rgb = coast();`,jt=`float roughnessFactor = cR;`,Mt=`#include <common>
in vec3 aRoad; out vec3 vWP; out vec3 vRoad;`,Nt=`vec3 walkColor; walk(walkColor); diffuseColor.rgb = walkColor;`,Pt=`float roughnessFactor = sR;`,Ft=`if (vWN.y > 0.5) { vec3 nw = normalize(vec3(sN.x, sN.z, sN.y)); normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz); }`,It=`#include <common>
out vec3 vWP;`,Lt=`#include <fog_vertex>
vWP = (modelMatrix * vec4(transformed,1.0)).xyz;`,Rt=`#include <common>\r
      uniform sampler2D tCol; uniform sampler2D tNoise; in vec3 vWP;\r
      uniform vec4 uMd[__SHADER_INJECT_0__]; uniform float uMa[__SHADER_INJECT_1__]; uniform vec4 uPw[__SHADER_INJECT_2__]; uniform float uPa[__SHADER_INJECT_3__]; uniform vec4 uPh[__SHADER_INJECT_4__]; uniform float uPq[__SHADER_INJECT_5__];\r
      float pondD(vec2 p, vec4 e, float a, vec4 h, float wq) { // same outline function as layout.js PARK_WATER\r
        vec2 d = p - e.xy; float c = cos(a), s = sin(a);\r
        vec2 q = vec2((d.x * c - d.y * s) / e.z, (d.x * s + d.y * c) / e.w);\r
        float t = atan(q.y, q.x);\r
        float k = 1.0 + 0.08 * sin(t * 3.0 + e.x) + 0.05 * sin(t * 5.0 + e.y * 0.1)\r
          + h.x * sin(t * 2.0 + 0.7) + h.y * sin(t * 3.0 + 2.1) + h.z * cos(t * 4.0) + h.w * sin(t * 5.0 + 4.2)\r
          + wq * (sin(t * 7.0 + e.x * 0.05) + 0.7 * sin(t * 11.0 + e.y * 0.03) + 0.45 * sin(t * 17.0 + 1.9)); // (round 7)\r
        return length(q) / k;\r
      }\r
      float pkFld(vec2 p, float f, float ph) { // (park r3) = trees.js fld(): open-woodland field\r
        return 0.5 + 0.5 * (0.55 * sin(p.x * f + ph) * cos(p.y * f * 0.83 - ph * 1.7) + 0.3 * sin((p.x * 0.6 - p.y * 0.8) * f * 2.1 + ph * 2.3) + 0.15 * sin((p.x * 0.9 + p.y * 0.4) * f * 4.3 + ph * 0.7)); }\r
      float ellD(vec2 p, vec4 e, float a, float w1, float w2, float ph2) {\r
        vec2 d = p - e.xy; float c = cos(a), s = sin(a);\r
        vec2 q = vec2((d.x * c - d.y * s) / e.z, (d.x * s + d.y * c) / e.w);\r
        float ang = atan(q.y, q.x);\r
        return length(q) / (1.0 + w1 * sin(ang * 3.0 + e.x) + w2 * sin(ang * 5.0 + e.y * ph2));\r
      }`,zt=`{\r
        vec2 p = vWP.xz;\r
        vec3 c = texture(tCol, p / 6.0).rgb;\r
        vec3 c2 = texture(tCol, p.yx / 23.0).rgb;\r
        vec3 nz = texture(tNoise, p / 140.0).rgb, nz2 = texture(tNoise, p / 37.0).rgb;\r
        c = mix(c, c2, 0.4) * (0.78 + 0.4 * nz.r);\r
        c = mix(c, vec3(dot(c, vec3(0.3, 0.55, 0.15))), 0.32) * vec3(0.84, 0.84, 0.74); // muted, late-season\r
        // meadows: mowed, lighter, a faint mowing stripe; outside: shaded woodland floor (leaf litter, moss) under groves\r
        float m = 9.0; for (int i = 0; i < __SHADER_INJECT_0__; i++) m = min(m, ellD(p, uMd[i], uMa[i], 0.09, 0.06, 1.0));\r
        float grove = sin(p.x * 0.021 + 1.3) * cos(p.y * 0.017 - 0.7) + 0.6 * sin(p.x * 0.047 - p.y * 0.031 + 2.1) + 0.35 * sin(p.y * 0.083 + p.x * 0.012);\r
        grove = clamp(0.75 + grove * 0.45, 0.0, 1.0) * smoothstep(1.0, 1.3, m); // (round 6: +0.3, matches the denser fill canopy)\r
        grove *= 1.0 - 0.8 * smoothstep(0.56, 0.7, pkFld(p, 1.0 / 55.0, 4.1)); // (park r3) open woodland: lawn between scattered trees\r
        vec3 floorC = mix(vec3(0.19, 0.18, 0.09), vec3(0.26, 0.2, 0.11), nz2.g) * (0.8 + 0.25 * nz.b); // (park r9) was near-black (0.1,0.1,0.05): read as holes on the Great Lawn where no crowns cover it\r
        c = mix(c, floorC, smoothstep(0.25, 0.65, grove) * __SHADER_INJECT_1__);\r
        float meadow = __SHADER_INJECT_2__;\r
        { // (park r3) mowing stripes (alternating direction per ~60 m patch) + brown wear patches on the lawns\r
          float dirSel = step(0.5, texture(tNoise, p / 900.0).g);\r
          float sf = fract(mix(p.x, p.y, dirSel) / 6.5 + 0.1 * nz.r);\r
          float strp = smoothstep(0.42, 0.5, sf) * (1.0 - smoothstep(0.92, 1.0, sf)); // (park r10) critic r9: 'no mowing stripes' -> stronger, soft-edged\r
          c = mix(c, c * vec3(1.1, 1.14, 1.0) * (0.88 + 0.22 * strp), meadow);\r
          float wear = smoothstep(0.6, 0.78, texture(tNoise, p / 29.0 + vec2(0.33, 0.77)).r) * smoothstep(0.35, 0.65, nz2.b);\r
          c = mix(c, vec3(0.3, 0.26, 0.17) * (0.85 + 0.3 * nz2.g), wear * 0.55 * meadow); }\r
        // (round 10) lawn texture at mid range (critic: 'large flat blurry green'): trodden desire lines, clover / weed\r
        // patches, dry spots and soft mower-turn arcs, all low-contrast\r
        {\r
          vec3 q1 = texture(tNoise, p / 11.0 + vec2(0.19, 0.53)).rgb, q2 = texture(tNoise, p / 3.3 + vec2(0.61, 0.07)).rgb;\r
          float clover = smoothstep(0.55, 0.75, q1.r) * 0.5 + smoothstep(0.6, 0.8, q2.g) * 0.25;\r
          c = mix(c, c * vec3(0.8, 0.9, 0.78), clover * meadow);\r
          float dry = smoothstep(0.62, 0.8, q1.b) * smoothstep(0.4, 0.7, nz2.r);\r
          c = mix(c, vec3(0.34, 0.31, 0.2) * (0.8 + 0.3 * q2.r), dry * 0.45 * meadow);\r
          float trod = 1.0 - smoothstep(0.0, 1.2, abs(sin(p.x * 0.011 + p.y * 0.019 + 3.0 * nz.g) * 60.0));\r
          c = mix(c, vec3(0.3, 0.28, 0.2), trod * 0.35 * meadow * smoothstep(0.45, 0.6, nz.b));\r
          c *= 0.93 + 0.14 * q2.b;\r
        }\r
        // worn / leaf-covered patches (fewer on the lawns)\r
        c = mix(c, vec3(0.4, 0.28, 0.13), smoothstep(0.58, 0.82, nz.g) * 0.5 * (1.0 - meadow));\r
        // (round 5) broad tonal variation: dry straw-olive swathes vs lush darker grass (never one flat green plane)\r
        vec3 nzL = texture(tNoise, p / 420.0 + vec2(0.37, 0.11)).rgb;\r
        c *= mix(vec3(0.86, 0.9, 0.84), vec3(1.12, 1.04, 0.86), smoothstep(0.3, 0.75, nzL.r));\r
        c *= 0.85 + 0.3 * smoothstep(0.2, 0.8, nzL.b);\r
        // (round 5) Manhattan-schist outcrops: grey-brown rock shelves with dark joints, at meadow edges and in the woods\r
        float ro = texture(tNoise, p / 55.0 + vec2(0.71, 0.29)).g * 0.7 + texture(tNoise, p / 17.0).b * 0.3;\r
        float rock = smoothstep(0.66, 0.7, ro) * smoothstep(0.95, 1.25, m) * __SHADER_INJECT_3__;\r
        vec3 rc = mix(vec3(0.3, 0.29, 0.27), vec3(0.44, 0.42, 0.39), nz2.r) * (0.8 + 0.3 * texture(tNoise, p / 3.0).r);\r
        rc *= 1.0 - 0.45 * smoothstep(0.55, 0.62, fract((p.x * 0.8 + p.y * 0.6) / 2.3 + nz2.g)); // foliation joints\r
        c = mix(c, rc, rock * 0.9);\r
        // ball-field infields (skinned fan-shaped infields with a grass diamond) on the Great-Lawn / North-Meadow-like meadows\r
        for (int i = 1; i < __SHADER_INJECT_4__; i++) {\r
          for (int k = 0; k < 4; k++) {\r
            if (i == 2 && (k == 1 || k == 2)) continue;                 // (round 4) fewer, varied fields: 4 + 2\r
            float fk = float(i * 4 + k);\r
            vec2 hp = uMd[i].xy + vec2(float(k & 1) * 2.0 - 1.0, float(k >> 1) * 2.0 - 1.0) * uMd[i].zw * vec2(0.55 + 0.08 * sin(fk * 2.3), 0.5 + 0.08 * cos(fk * 1.7));\r
            vec2 dir = normalize(uMd[i].xy - hp);                      // outfield points toward the meadow centre\r
            float ra = 0.35 * sin(fk * 3.1 + 0.4); dir = vec2(dir.x * cos(ra) - dir.y * sin(ra), dir.x * sin(ra) + dir.y * cos(ra));\r
            float R = 22.0 + 5.0 * fract(fk * 0.618);\r
            vec2 d = p - hp; float r = length(d), ca = dot(d, dir) / max(r, 1e-3);\r
            float fan = (1.0 - smoothstep(R, R + 1.5, r)) * smoothstep(0.66, 0.72, ca);\r
            vec2 q = vec2(dot(d, dir), dot(d, vec2(-dir.y, dir.x)));  // along / across the foul-line bisector\r
            vec2 qd = vec2(q.x + q.y, q.x - q.y) * 0.7071;             // diamond axes (foul lines)\r
            float gs = R * 0.64;\r
            float grassSq = step(1.5, qd.x) * step(1.5, qd.y) * step(qd.x, gs) * step(qd.y, gs);\r
            float sand = max(fan * (1.0 - grassSq), 1.0 - smoothstep(2.5, 3.2, length(q - vec2(R * 0.48, 0.0)))); // + pitcher's mound\r
            // (park r3) worn infield: darker scuffed base paths / home circle, raked lighter centre, patchy edge into the turf\r
            float bp = max(1.0 - smoothstep(0.8, 1.6, abs(qd.x - 1.0)), 1.0 - smoothstep(0.8, 1.6, abs(qd.y - 1.0))) * step(qd.x, gs + 2.0) * step(qd.y, gs + 2.0) * step(-1.0, min(qd.x, qd.y));\r
            vec3 dirt = mix(vec3(0.38, 0.27, 0.18), vec3(0.46, 0.34, 0.23), texture(tNoise, p / 4.0).r) * (0.8 + 0.25 * nz2.r); // (park r7) darker compacted clay (critic r6: 'pale decals')\r
            dirt = mix(dirt, vec3(0.27, 0.2, 0.14), max(bp * fan, 1.0 - smoothstep(3.0, 4.5, r)) * 0.65);\r
            sand *= smoothstep(0.25, 0.6, texture(tNoise, p / 2.2).g + smoothstep(R - 3.0, R - 0.5, r) * -0.5 + 0.45);\r
            // (park r10) critic r9: 'ballfields are flat decals': a dark lip where the turf edge stands over the skinned\r
            // infield + a worn, lighter outfield ring in front of it (depth / wear instead of a pasted shape)\r
            float lip = (1.0 - smoothstep(0.0, 0.9, abs(r - R - 0.4))) * smoothstep(0.64, 0.72, ca);\r
            float worn = (1.0 - smoothstep(R, R + 9.0, r)) * smoothstep(R - 0.5, R + 1.5, r) * smoothstep(0.55, 0.75, ca);\r
            c = mix(c, c * vec3(1.08, 1.03, 0.86), worn * 0.6);\r
            c *= 1.0 - 0.3 * lip;\r
            c = mix(c, dirt, clamp(sand, 0.0, 1.0) * (0.78 + 0.16 * fract(fk * 0.37))); // (round 6: worn, not stamped; park r2: sand infields read from the air, refs 08 / 09)\r
          }\r
        }\r
        // pond banks: mud / wet stone ring, then damp dark grass\r
        float pd = 9.0; for (int i = 0; i < __SHADER_INJECT_5__; i++) pd = min(pd, (pondD(p, uPw[i], uPa[i], uPh[i], uPq[i]) - 1.0) * max(uPw[i].z, uPw[i].w));\r
        float bank = __SHADER_INJECT_6__;\r
        vec3 mud = mix(vec3(0.2, 0.17, 0.13), vec3(0.34, 0.32, 0.29), step(0.62, nz2.r)); // mud with stones\r
        c = mix(c * (1.0 - 0.35 * (1.0 - smoothstep(3.0, 9.0, pd))), mud, bank);\r
        // (round 5) reeds / shrubby shore vegetation: a patchy dark band a few metres back from the waterline\r
        float reed = (1.0 - smoothstep(4.0, 11.0 + 5.0 * nz.g, pd)) * smoothstep(1.5, 3.5, pd) * smoothstep(0.35, 0.6, nz2.b);\r
        c = mix(c, vec3(0.09, 0.1, 0.045) * (0.8 + 0.4 * nz2.g), reed * __SHADER_INJECT_7__);\r
        // (round 6) the Reservoir's running track: a cinder / gravel loop ~5-9 m outside the bank, with its iron fence line\r
        { float rd = (pondD(p, uPw[3], uPa[3], uPh[3], uPq[3]) - 1.0) * max(uPw[3].z, uPw[3].w);\r
          float eg = 0.9 * (texture(tNoise, p / 7.0).r - 0.5);  // (park r9) ragged grass edges, not a clean ruled band\r
          float trk = smoothstep(4.2 + eg, 5.2 + eg, rd) * (1.0 - smoothstep(8.2 - eg, 9.2 - eg, rd));\r
          vec3 cin = mix(vec3(0.31, 0.26, 0.21), vec3(0.37, 0.31, 0.25), texture(tNoise, p / 1.7).g) * (0.82 + 0.26 * nz2.r); // darker cinder (critic r8: 'clean white band')\r
          cin *= 1.0 - 0.14 * (1.0 - smoothstep(0.3, 1.1, abs(rd - 6.7 + 0.4 * nz.g)));      // worn, compacted running line\r
          cin = mix(cin, vec3(0.2, 0.18, 0.15), smoothstep(0.68, 0.8, texture(tNoise, p / 13.0 + vec2(0.4, 0.1)).b) * 0.6); // damp patches\r
          c = mix(c, cin, trk * __SHADER_INJECT_8__);\r
          c = mix(c, vec3(0.1, 0.1, 0.09), (1.0 - smoothstep(0.2, 0.7, abs(rd - 3.6))) * __SHADER_INJECT_9__); }\r
        diffuseColor.rgb = c;\r
      }`,Bt=`#include <normal_fragment_maps>\r
      {\r
        vec2 p = vWP.xz; float e = 3.0;\r
        #define GH(q) (texture(tNoise, (q) / 160.0 + vec2(0.27, 0.61)).g * 1.5 + texture(tNoise, (q) / 45.0 + vec2(0.83, 0.13)).r * 0.6)\r
        float dx = (GH(p + vec2(e, 0.0)) - GH(p - vec2(e, 0.0))) / (2.0 * e), dz = (GH(p + vec2(0.0, e)) - GH(p - vec2(0.0, e))) / (2.0 * e);\r
        #undef GH\r
        vec3 nW = normalize(vec3(-dx * 6.0, 1.0, -dz * 6.0));\r
        normal = normalize(mix(normal, (viewMatrix * vec4(nW, 0.0)).xyz, 0.85));\r
      }`,Vt=`#include <common>
out vec3 vWPm;`,Ht=`#include <fog_vertex>
vWPm = (modelMatrix * vec4(transformed, 1.0)).xyz;`,Ut=`#include <fog_vertex>
vWP = (modelMatrix * vec4(transformed,1.0)).xyz; vRoad = aRoad;`,Wt=`#include <common>
uniform sampler2D tNoiseW; in vec3 vWPm;`,Gt=`#include <map_fragment>\r
        { vec3 w1 = texture(tNoiseW, vWPm.xz / 2.3).rgb, w2 = texture(tNoiseW, vWPm.xz / 0.37).rgb;\r
          float wear = smoothstep(0.35, 0.8, w1.g * 0.7 + w2.r * 0.5);\r
          diffuseColor.a *= 1.0 - 0.45 * wear; // (street r6: 0.25 -> 0.45) critic: 'lane markings perfect and crisp'\r
          float chip = smoothstep(0.58, 0.72, texture(tNoiseW, vWPm.xz / 0.11 + 0.37).g);   // chipped thermoplastic\r
          diffuseColor.a *= 1.0 - 0.6 * chip * (0.4 + 0.6 * wear);\r
          diffuseColor.rgb *= (0.86 + 0.1 * w2.b) * vec3(1.0, 0.985, 0.95); // grimy, slightly yellowed paint\r
          // (street r9) critic: 'crosswalks crisp painted stripes with no wear': tyre-grime streaks along both travel\r
          // axes (thin in the cross direction, long along it), broad scuffed blotches where the paint is nearly gone\r
          float skZ = texture(tNoiseW, vec2(vWPm.x / 0.5, vWPm.z / 14.0) + 0.21).g, skX = texture(tNoiseW, vec2(vWPm.x / 14.0, vWPm.z / 0.5) + 0.63).b;\r
          diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.45, 0.8, max(skZ, skX));\r
          diffuseColor.a *= 1.0 - 0.5 * smoothstep(0.55, 0.75, texture(tNoiseW, vWPm.xz / 5.3 + 0.11).r); }`,Kt=`#include <common>
out vec2 vPU; out vec3 vPW;`,qt=`#include <uv_vertex>
vPU = uv;`,Jt=`#include <fog_vertex>
vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;`,Yt=`#include <common>
uniform sampler2D tPN; in vec2 vPU; in vec3 vPW;`,Xt=`#include <map_fragment>\r
        { vec3 n = texture(tPN, vPW.xz / 9.0).rgb, n2 = texture(tPN, vPW.xz / 2.3).rgb;\r
          float e = min(vPU.x, 1.0 - vPU.x);\r
          float edge = smoothstep(0.02, 0.2 + 0.12 * n.r, e + 0.08 * (n2.g - 0.5));\r
          diffuseColor.a *= edge;\r
          diffuseColor.rgb *= mix(vec3(1.0), vec3(1.08, 1.0, 0.86), n.b) * (0.9 + 0.2 * n2.r);\r
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.38, 0.34) * (0.9 + 0.2 * n.r), 0.45); } // park r2: paler walks read from the air (refs 08 / 09)`,Zt=`#include <common>\r
      uniform sampler2D tCol; uniform sampler2D tNrm; uniform sampler2D tMacro; uniform sampler2D tNoise; in vec3 vWP; in vec3 vRoad; uniform sampler2D tDec;\r
      vec3 aN; float aR; float gDecR = 0.0; // (textures r3)\r
      vec3 asphalt() {\r
        vec2 p = vWP.xz;\r
        vec3 c = texture(tCol, p / 6.0).rgb * 0.88; // (textures r4) critic: 'street asphalt light grey and clean' -> darker binder\r
        vec3 c2 = texture(tCol, vec2(p.y, -p.x) / 7.3 + 0.37).rgb * 0.88;\r
        c = mix(c, c2, 0.35);\r
        vec3 nd = texture(tNrm, p / 6.0).rgb;\r
        vec3 m = texture(tMacro, p / 64.0).rgb;\r
        vec3 m2 = texture(tMacro, vec2(-p.y, p.x) / 151.0 + 0.5).rgb;\r
        vec3 nz = texture(tNoise, p / 97.0).rgb;\r
        float bright = (0.8 + 0.4 * m.r) * (0.88 + 0.24 * m2.r) * (0.94 + 0.12 * nz.r); // gentle macro variation (was blotchy)\r
        c *= bright;\r
        // (no crack lines: user feedback - roads read as uniform, softly worn asphalt; refs/road)\r
        // lanes / tyre grime\r
        // road rect kind (vRoad.x: 0 avenue, 1 street, 2 intersection) + centre line (vRoad.y) from the geometry\r
        int rk = int(vRoad.x + 0.5);\r
        float ax = p.x - vRoad.y, sz = p.y - vRoad.z;\r
        bool onAv = rk != 1, onSt = rk != 0;\r
        float track = 0.0, oil = 0.0, gutter = 0.0;\r
        if (onAv && !onSt) {\r
          float l = mod(ax + 10.8, 3.6) - 1.8;\r
          track = exp(-pow((abs(l) - 0.85) / 0.3, 2.0));\r
          oil = exp(-pow(l / 0.45, 2.0));\r
          gutter = 1.0 - smoothstep(0.0, 0.8, 11.0 - abs(ax));\r
        } else if (onSt && !onAv) {\r
          float l = sz;\r
          track = exp(-pow((abs(l) - 0.9) / 0.35, 2.0)) * 0.8;\r
          oil = exp(-pow(l / 0.5, 2.0));\r
          float sh = 5.0 + (vRoad.x - 1.0) * 100.0; // (layout2 r9) per-street half width\r
          if (sh > 6.0) { float l2 = mod(abs(sz), 3.3) - 1.65; track = exp(-pow((abs(l2) - 0.85) / 0.3, 2.0)) * 0.8; oil = exp(-pow(l2 / 0.45, 2.0)); } // two lanes each way\r
          gutter = 1.0 - smoothstep(0.0, 0.7, sh - abs(sz));\r
        } else if (onSt && onAv) {\r
          track = 0.25; oil = 0.3;\r
        }\r
        float tv = 0.6 + 0.4 * nz.g;\r
        c *= 1.0 - 0.2 * track * tv; // soft tyre-wear lanes (street r6: 0.14 -> 0.2)\r
        float stain = m.b * oil;\r
        c *= 1.0 - 0.2 * stain - 0.05 * oil * nz.b; // faint, broad (no dark lane-centre streaks)\r
        c *= 1.0 - 0.36 * gutter * (0.6 + 0.4 * nz.b); // (street r6) darker wet kerb gutter\r
        c = mix(c, c * vec3(0.95, 0.93, 0.9), gutter);\r
        // patches: soft, broad darker areas only (low-frequency noise, no hard edges or seams)\r
        float patchN = smoothstep(0.62, 0.78, texture(tNoise, p / 41.0 + 0.23).b) * 0.6;\r
        c *= 1.0 - 0.14 * patchN;\r
        // (street r6) critic: 'road too clean'. Mid-scale blotches: parked-car oil drips + dried spill stains (irregular,\r
        // 0.5-2 m, from two noise octaves), strongest in the parking / curb lanes (gutter side), faint mid-road.\r
        {\r
          float s1 = texture(tNoise, p / 3.7 + 0.61).g, s2 = texture(tNoise, p / 1.3 + 0.17).r;\r
          float blot = smoothstep(0.66, 0.8, s1 * 0.75 + s2 * 0.35);\r
          float curbLane = rk == 0 ? smoothstep(6.5, 8.5, abs(ax)) : (rk == 1 ? smoothstep(2.0, 3.2, abs(sz)) : 0.3);\r
          c *= 1.0 - blot * (0.1 + 0.2 * curbLane);\r
        }\r
        // (street r3) lane-by-lane repaving: whole-lane sections milled + resurfaced at different times (crisp straight\r
        // edges on the lane lines, lighter older / darker fresher asphalt) like the refs' patchwork avenues. No cracks.\r
        {\r
          float li, lane0, along, cw;\r
          if (rk == 0) { li = floor((ax + 10.8) / 3.6); along = p.y; cw = 3.6; lane0 = ax + 10.8 - li * 3.6; }\r
          else if (rk == 1) { li = sz < 0.0 ? 30.0 : 31.0; along = p.x; cw = 5.0; lane0 = abs(sz) ; }\r
          else { li = 40.0 + floor(p.x / 9.0); along = p.y; cw = 9.0; lane0 = mod(p.x, 9.0); }\r
          float seg = floor(along / 23.0 + li * 0.37);\r
          float hh = fract(sin(dot(vec3(li, seg, vRoad.y * 0.013 + vRoad.z * 0.007), vec3(12.9898, 78.233, 37.719))) * 43758.5453);\r
          float fu = fract(along / 23.0 + li * 0.37);\r
          float edge = smoothstep(0.0, 0.004, fu) * smoothstep(1.0, 0.996, fu) * smoothstep(0.0, 0.04, lane0) * smoothstep(cw, cw - 0.04, lane0);\r
          float rp = hh < 0.16 ? 1.13 : hh < 0.3 ? 0.84 : hh < 0.36 ? 1.22 : 1.0;\r
          c *= mix(1.0, rp, edge * (0.75 + 0.25 * nz.r));\r
        }\r
        // (street r11) critic: 'road clean, no patches / stains'. Utility-cut restorations: sharp-edged rectangles of\r
        // fresher (darker) or older (paler) tar, 1-4 m, ~1 per 3 cells of 11 m; a thin sealant rim; plus broad dark\r
        // oil pools in the stop lanes approaching the intersections (no crack lines: user rule)\r
        {\r
          vec2 cg = vec2(11.0, 13.0), cid2 = floor(p / cg), cf = p - cid2 * cg;\r
          float h1 = fract(sin(dot(cid2, vec2(41.31, 17.77))) * 23758.54), h2 = fract(h1 * 73.1 + 0.3), h3 = fract(h1 * 11.7 + 0.61);\r
          float fwp = fwidth(p.x) * 1.2 + 1e-3;\r
          if (h1 < 0.34 && rk != 2) {\r
            vec2 hs = vec2(0.6 + 1.6 * h2, 0.5 + 1.1 * h3), cc2 = vec2(2.0 + h3 * 7.0, 2.0 + h2 * 9.0);\r
            vec2 dq = abs(cf - cc2) - hs;\r
            float inP = 1.0 - smoothstep(-fwp, fwp, max(dq.x, dq.y));\r
            float rim = (1.0 - smoothstep(0.0, 0.07 + fwp, abs(max(dq.x, dq.y)))) ;\r
            c *= mix(1.0, h2 < 0.6 ? 0.72 : 1.18, inP * (0.85 + 0.3 * nz.g)); // (street r12) 0.8 / 1.12 -> 0.72 / 1.18: readable from rooftop height\r
            c *= 1.0 - 0.22 * rim;\r
          }\r
          // (street r12) critic (ref 16): 'road is uniform dark asphalt; add patching'. Long utility trench restorations:\r
          // 0.9-1.4 m wide strips running 4-11 m across or along the lanes, a few per block, crisp sealed edges\r
          if (rk != 2) {\r
            vec2 tg = vec2(29.0, 37.0), tid = floor(p / tg), tf2 = p - tid * tg;\r
            float t1 = fract(sin(dot(tid, vec2(12.71, 91.37))) * 43758.55), t2 = fract(t1 * 57.3 + 0.21), t3 = fract(t1 * 19.9 + 0.77);\r
            if (t1 < 0.42) {\r
              bool acr = t2 < 0.5;\r
              vec2 hs2 = acr ? vec2(2.0 + 3.5 * t3, 0.45 + 0.25 * t2) : vec2(0.45 + 0.25 * t3, 2.0 + 3.5 * t2);\r
              vec2 c3 = vec2(6.0 + t3 * 17.0, 6.0 + t2 * 25.0);\r
              vec2 dq2 = abs(tf2 - c3) - hs2;\r
              float dd = max(dq2.x, dq2.y);\r
              float inT = 1.0 - smoothstep(-fwp, fwp, dd);\r
              c *= mix(1.0, t3 < 0.55 ? 0.66 : 1.2, inT * (0.8 + 0.4 * nz.b));\r
              c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.06 + fwp, abs(dd)));\r
            }\r
          }\r
          vec2 op = p / 2.3 + 0.17;\r
          float pool = smoothstep(0.62, 0.82, texture(tNoise, op).r * 0.7 + texture(tNoise, op * 2.9).g * 0.4) * (rk == 2 ? 0.3 : oil);\r
          c *= 1.0 - 0.25 * pool;\r
        }\r
        // (textures r3) critic: 'asphalt uniform noise, no patches, cracks, tyre marks'. Photographic repair decals\r
        // ($imagegen sheet, asphalt_decals.webp: 8 cells of colour ratio vs plain asphalt): fresh / old sealed utility cuts,\r
        // trench strips, pothole fills, oil stains, skid marks, manholes in a new-asphalt collar, patch clusters. One\r
        // candidate per 8 m cell (~55 % used), random size / quarter-turn / mirror, jittered inside the cell. One texture\r
        // tap with explicit gradients (no mip seams at the cell borders).\r
        {\r
          vec2 dcg = p / 8.0, dci = floor(dcg), dcf = dcg - dci;\r
          vec2 dqx = dFdx(p), dqy = dFdy(p); // uniform control flow\r
          float e1 = fract(sin(dot(dci, vec2(27.17, 61.93))) * 43758.5453), e2 = fract(e1 * 43.7 + 0.13), e3 = fract(e1 * 7.31 + 0.71);\r
          if (e1 < 0.55) {\r
            float k = e1 < 0.03 ? 6.0 : floor(e2 * 7.999); if (k > 5.5) k = e1 < 0.03 ? 6.0 : 7.0; // manholes rarer (street decals have them)\r
            float sz = (k > 5.5 && k < 6.5) ? 1.5 : (1.3 + 1.4 * e3); // decal cell = sz x 2 sz (m)\r
            vec2 ctr = 0.5 + (vec2(e2, e3) - 0.5) * (1.0 - vec2(2.0 * sz, 2.0 * sz) / 8.0);\r
            vec2 q = (dcf - ctr) * 8.0; // metres from the decal centre\r
            if (e3 < 0.5) { q = q.yx; dqx = dqx.yx; dqy = dqy.yx; }\r
            if (fract(e1 * 91.1) < 0.5) { q.x = -q.x; dqx.x = -dqx.x; dqy.x = -dqy.x; }\r
            vec2 du = q / vec2(sz, 2.0 * sz) + 0.5;\r
            if (all(greaterThan(du, vec2(0.0))) && all(lessThan(du, vec2(1.0)))) {\r
              vec2 cc = vec2(mod(k, 4.0), floor(k / 4.0));\r
              vec2 duv = vec2((cc.x + du.x) / 4.0, 1.0 - (cc.y + 1.0 - du.y) / 2.0);\r
              vec2 gs = vec2(1.0 / (4.0 * sz), 1.0 / (4.0 * sz));\r
              vec3 dr = textureGrad(tDec, duv, dqx * gs, dqy * gs).rgb * 2.0;\r
              c *= mix(vec3(1.0), dr, 0.9);\r
              gDecR = clamp(1.0 - dot(dr, vec3(0.333)), 0.0, 0.6);\r
            }\r
          }\r
        }\r
        c *= vec3(0.97, 0.99, 1.03); // slightly blue-grey, faded\r
        // aerial LOD tone: seen from afar, grime, oil, parked cars and kerb shadows aggregate -> the road reads darker than\r
        // the sidewalks (the street grid stays legible from the rooftops instead of washing into pale strips)\r
        float adist = length(vWP - cameraPosition);\r
        c *= mix(1.0, 0.74, smoothstep(80.0, 600.0, adist)); // (round 7: 0.66 -> 0.52; round 10: 0.74 -- critic: streets read as dark trenches, not grey asphalt)\r
        // (street agent r1) street-level tone: up close the refs' asphalt is a dark blue-grey, about half the sidewalk's\r
        // value; fades out by 260 m so the rooftop / aerial read (above) is unchanged\r
        c *= mix(0.8, 1.0, smoothstep(110.0, 260.0, adist)); // (street r3: 0.64 -> 0.7; r4: 0.8, refs 16 / 04 sunlit asphalt reads mid-grey so the wear decals show)\r
        // (round 10) aerial traffic impostor: beyond the simulated-traffic radius the lanes carry static car-sized\r
        // shapes (muted liveries, yellow cabs, a dark cast-shadow sliver), so the grid reads busy from altitude like the\r
        // refs instead of empty trenches. Fades in past 260 m (the real vehicles cover the near field).\r
        float tf = smoothstep(240.0, 420.0, adist);\r
        if (tf > 0.0 && rk != 2) {\r
          float lane, along, lw, gap; vec2 cid;\r
          if (rk == 0) { float li = floor((ax + 10.8) / 3.6); lane = ax - (li * 3.6 - 9.0); along = p.y; gap = 8.5; cid = vec2(li, vRoad.y); lw = 1.0; }\r
          else { float li = sz < 0.0 ? 0.0 : 1.0; lane = sz - (li < 0.5 ? -2.3 : 2.3); along = p.x; gap = 7.6; cid = vec2(li + 20.0, vRoad.z); lw = 0.8; }\r
          float cell = floor(along / gap), u = along - cell * gap - gap * 0.5;\r
          float h1 = fract(sin(dot(vec3(cid, cell), vec3(12.9898, 78.233, 37.719))) * 43758.5453);\r
          float h2 = fract(h1 * 91.3171 + 0.123);\r
          // denser bunching (platoons at lights): block-scale density wave along the road\r
          float dens = (rk == 0 ? 0.5 : 0.32) * lw * (0.55 + 0.9 * texture(tNoise, vec2(along / 260.0, cid.x * 0.13 + cid.y * 0.001)).r);\r
          if (h1 < dens) {\r
            float L = h2 < 0.12 ? 3.4 : (h2 > 0.92 ? 3.9 : 2.25), Wd = h2 > 0.92 ? 1.25 : 0.92; // half extents (bus / van / car)\r
            float du = abs(u + (h2 - 0.5) * 1.6) - L, dv = abs(lane) - Wd;\r
            float inside = 1.0 - smoothstep(-0.25, 0.25, max(du, dv));\r
            float shadowS = 1.0 - smoothstep(-0.3, 0.4, max(du, abs(lane - 0.9) - Wd));\r
            float hc = fract(h2 * 37.77);\r
            vec3 cc = hc < 0.22 ? vec3(0.62, 0.48, 0.12) : hc < 0.42 ? vec3(0.55, 0.55, 0.54) : hc < 0.6 ? vec3(0.05, 0.05, 0.055)\r
                    : hc < 0.72 ? vec3(0.34, 0.35, 0.36) : hc < 0.8 ? vec3(0.36, 0.1, 0.08) : hc < 0.88 ? vec3(0.12, 0.17, 0.26) : vec3(0.46, 0.45, 0.42);\r
            if (h2 > 0.92) cc = vec3(0.5, 0.52, 0.55); // buses / box vans: pale roofs\r
            c = mix(c, c * 0.55, shadowS * tf * 0.8);\r
            c = mix(c, cc, inside * tf);\r
          }\r
        }\r
        aR = clamp(nd.b + 0.05 - 0.25 * stain - 0.08 * track, 0.35, 1.0);\r
        aR = clamp(aR - 0.45 * gDecR, 0.35, 1.0); // (textures r3) fresh tar / oil decals are glossier\r
        // (foundation r13) critic: 'avenue to the horizon is a thin bright white line'. Far away the grazing view of the\r
        // worn, oily surface glared as a mirror-bright strip against the sun: from ~0.3 km the aggregate (cars, grime,\r
        // kerb shadows, repairs) goes fully matte and a step darker, so avenues read as dark cuts to the horizon\r
        aR = mix(aR, 1.0, smoothstep(300.0, 1100.0, adist));\r
        c *= mix(1.0, 0.8, smoothstep(700.0, 2200.0, adist));\r
        vec2 nxy = nd.rg * 2.0 - 1.0;\r
        aN = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));\r
        return c;\r
      }`,Qt=`diffuseColor.rgb = asphalt();`,$t=`float roughnessFactor = aR;`,en=`{ vec3 nw = normalize(vec3(aN.x, aN.z, aN.y)); normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz); }`,tn=`#include <common>
in vec4 aRect; out vec4 vRect; out vec3 vWP; out vec3 vWN;`,nn=`#include <fog_vertex>
vRect = aRect; vWP = (modelMatrix * vec4(transformed,1.0)).xyz; vWN = normal;`,rn=`#include <common>\r
      uniform sampler2D tCol; uniform sampler2D tNrm; uniform sampler2D tNoise; uniform sampler2D tCurb; in vec4 vRect; in vec3 vWP; in vec3 vWN;\r
      vec3 sN = vec3(0.0, 0.0, 1.0); float sR = 0.85;\r
      float curbJ(float a, float fw) { float x = abs(fract(a / 2.4) - 0.5) * 2.4, w = max(0.012, fw * 1.5); return 0.45 * smoothstep(1.2 - w, 1.2, x) * (0.012 / w); } // (textures r2) curbstone joints, AA\r
      void walk(out vec3 walkColor) {\r
        vec2 p = vWP.xz;\r
        vec2 fwP = fwidth(p); // (textures r2) uniform control flow\r
        vec3 nz = texture(tNoise, p / 53.0).rgb;\r
        float d = min(min(p.x - vRect.x, vRect.z - p.x), min(p.y - vRect.y, vRect.w - p.y));\r
        if (vWN.y < 0.5) {\r
          // curb face: weathered concrete/granite, dirtier near the gutter\r
          vec2 q = vec2(p.x + p.y, vWP.y) / 1.3;\r
          vec3 c = texture(tCurb, q).rgb * 0.92; // (textures r2) $imagegen granite curbstone (was the sidewalk sheet)\r
          c *= 1.0 - curbJ(p.x + p.y, fwP.x + fwP.y); // 2.4 m stone joints\r
          c *= mix(0.55, 1.0, smoothstep(-0.02, 0.14, vWP.y));\r
          sR = 0.85; sN = vec3(0.0, 0.0, 1.0);\r
          walkColor = c; return;\r
        }\r
        vec2 uv = p / 6.0; // (textures) imagegen sidewalk sheet holds 4 x 4 slabs -> 1.5 m (5 ft) NYC slabs\r
        vec3 c = texture(tCol, uv).rgb;\r
        vec3 n = texture(tNrm, uv).rgb;\r
        float curb = 1.0 - smoothstep(0.26, 0.3, d);\r
        if (curb > 0.0) {\r
          vec3 cc = texture(tCurb, p / 1.1 + 0.3).rgb * 0.97; // (textures r2) granite curb top + 2.4 m joints\r
          float cAl = (min(p.x - vRect.x, vRect.z - p.x) < min(p.y - vRect.y, vRect.w - p.y)) ? p.y : p.x;\r
          cc *= 1.0 - curbJ(cAl, max(fwP.x, fwP.y));\r
          c = mix(c, cc, curb);\r
          n = mix(n, vec3(0.5, 0.5, 0.7), curb);\r
        }\r
        c *= 0.93 + 0.14 * nz.r; // subtle slab-to-slab variation (refs/road/road_2_sidewalk)\r
        c *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 1.2, abs(d - 0.3))) * nz.b;\r
        // (foundation r13) critic: 'streets from altitude read as blank white stripes', 'riverfront edges are ruler-\r
        // straight white strips'. Aerial LOD tone: grime, tree pits, street furniture and kerb shadows aggregate, so from\r
        // the rooftops / the air the sidewalks sit a step darker (no change within 150 m). Promenade / plaza fill pieces\r
        // (vRect unset) are laid in warmer, darker hex / brick pavers like the East River + Hudson esplanades.\r
        {\r
          float adist = length(vWP - cameraPosition);\r
          c *= mix(1.0, 0.78, smoothstep(150.0, 900.0, adist));\r
          if (vRect.x < -5e4) {\r
            vec2 hp = p / vec2(0.9, 0.78);\r
            float row = floor(hp.y), cu = fract(hp.x + 0.5 * mod(row, 2.0)), cv = fract(hp.y);\r
            float jn = 1.0 - smoothstep(0.0, 0.07, min(min(cu, 1.0 - cu), min(cv, 1.0 - cv)));\r
            float fwp = clamp(fwidth(hp.x) * 2.0, 0.0, 1.0);\r
            c *= vec3(0.86, 0.82, 0.77) * (1.0 - 0.18 * jn * (1.0 - fwp));\r
            c *= mix(1.0, 0.9, smoothstep(120.0, 600.0, adist));\r
          }\r
        }\r
        sR = mix(n.b, 1.0, smoothstep(300.0, 1100.0, length(vWP - cameraPosition))); // (r13) matte from afar (no grazing glare strips)\r
        vec2 nxy = n.rg * 2.0 - 1.0; sN = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));\r
        walkColor = c;\r
      }`,an=`#include <common>\r
      in vec2 aLeaf; in vec3 aTintA; in vec3 aTintB; in float aSway;\r
      out vec2 vLeaf; out vec3 vTA; out vec3 vTB; uniform float uTime;`,on=`#include <common>\r
      in vec2 aLeaf; in vec3 aTintA; in vec3 aTintB;\r
      out vec2 vLeaf; out vec3 vTA; out vec3 vTB; out vec3 vCW; out vec3 vCN; out vec3 vCI;`,sn=`#include <begin_vertex>\r
      vLeaf = aLeaf; vTA = aTintA; vTB = aTintB;\r
      #ifdef USE_INSTANCING\r
        vCW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;\r
        vCN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);\r
        vCI = instanceMatrix[3].xyz;\r
      #else\r
        vCW = (modelMatrix * vec4(position, 1.0)).xyz; vCN = normal; vCI = vec3(0.0);\r
      #endif`,cn=`#include <common>\r
      in vec2 vLeaf; in vec3 vTA; in vec3 vTB; in vec3 vCW; in vec3 vCN; in vec3 vCI;\r
      uniform sampler2D uLeafN; uniform vec4 uLeafFrame; float crClump;\r
      float crIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }\r
      float crH3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\r
      float crVn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\r
        return mix(mix(mix(crH3(i), crH3(i + vec3(1, 0, 0)), f.x), mix(crH3(i + vec3(0, 1, 0)), crH3(i + vec3(1, 1, 0)), f.x), f.y),\r
                   mix(mix(crH3(i + vec3(0, 0, 1)), crH3(i + vec3(1, 0, 1)), f.x), mix(crH3(i + vec3(0, 1, 1)), crH3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`,ln=`\r
        // procedural foliage (no texture: a tiled leaf atlas reads as a checker from afar): clumps (~2.4 m) of\r
        // sub-clumps (~0.7 m) of leaf speckle (~0.25 m), per-crown phase; dark gaps between the clumps\r
        vec3 cp = vCW + vCI * 0.37;\r
        float n1 = crVn(cp * 0.62), n2 = crVn(cp * 2.1 + 3.1), n3 = crVn(cp * 5.3 + 7.7); // (park r2) finer clumps\r
        crClump = n1 * 0.65 + n2 * 0.35;\r
        vec4 tx = vec4(n3, n2, 0.0, 1.0);\r
        float cov = smoothstep(0.18, 0.55, crClump * 0.8 + n3 * 0.35);\r
        float expo = clamp(vLeaf.x, 0.0, 1.0);\r
        float hsel = 0.5 + (n2 - 0.5) * 0.7 + (vLeaf.y - 0.5) * 0.35 + (n1 - 0.5) * 0.4;\r
        vec3 leaf = mix(vTA, vTB, smoothstep(0.1, 0.9, hsel));\r
        leaf *= 0.74 + 0.34 * n3;\r
        leaf = fract(n3 * 17.3 + vLeaf.y * 3.1) > 0.97 ? leaf * vec3(0.55, 0.4, 0.3) : leaf; // dry leaves\r
        vec3 c = mix(vTB * 0.42, leaf, smoothstep(0.3, 0.62, crClump + n3 * 0.22)); // (park r2) deeper gaps between clumps\r
        c *= mix(vec3(1.0), vec3(1.12, 1.1, 0.8), smoothstep(0.62, 0.9, n2) * 0.6); // sunlit yellowing leaf tips\r
        float occ = mix(0.3, 1.14, pow(expo, 1.25)) * mix(0.66, 1.1, smoothstep(0.3, 0.75, crClump)); // (park r4) crowns separate: dark skirts, sunlit domes\r
        diffuseColor.rgb *= c * occ;\r
        // silhouette: grazing faces keep only the leaf coverage -> ragged, see-through crown edges\r
        float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));\r
        float alpha = mix(cov * 1.25, 1.0, smoothstep(0.3, 0.72, facing));\r
        { float n = fract(crIGN(gl_FragCoord.xy + 5.0) + uLeafFrame.x * 2.618034); if (alpha < mix(0.25, 0.75, n)) discard; }\r
      `,un=`#include <normal_fragment_maps>\r
        { vec3 sx = normalize(dFdx(-vViewPosition)), sy2 = normalize(dFdy(-vViewPosition));\r
          vec2 dh = vec2(dFdx(crClump), dFdy(crClump)) * 3.0 + (vec2(dFdx(tx.r), dFdy(tx.r)) * 0.5);\r
          vec3 r1 = cross(sy2, normal), r2 = cross(normal, sx); float det = dot(sx, r1);\r
          if (det != 0.0) normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2)); }`,dn=`#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * vec3(0.11, 0.095, 0.06) * expo * expo * ambData.vert.x * ambData.bounce.w; // (lighting2 r6)`,fn=`#include <begin_vertex>\r
      vLeaf = aLeaf; vTA = aTintA; vTB = aTintB;\r
      #ifdef USE_INSTANCING\r
        vec3 ip = instanceMatrix[3].xyz;\r
        float ph = dot(ip, vec3(0.13, 0.0, 0.17));\r
        // crown sway (slow) + leaf-spray flutter (fast, outer cards only)\r
        transformed.xz += vec2(sin(uTime * 1.3 + ph + position.y * 0.4), cos(uTime * 1.1 + ph)) * 0.05 * position.y * 0.12;\r
        if (aLeaf.x < 1.5) transformed += vec3(sin(uTime * 4.1 + dot(position, vec3(3.1, 1.7, 2.3))), sin(uTime * 3.3 + dot(position, vec3(1.9, 2.9, 1.3))), 0.0).xzy * 0.035 * aLeaf.x;\r
      #endif`,pn=`#include <common>\r
      in vec2 vLeaf; in vec3 vTA; in vec3 vTB; uniform sampler2D uLeafN; uniform vec4 uLeafFrame;\r
      float leafIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`,mn=`\r
        bool core = vLeaf.x >= 1.5;\r
        vec2 luv = core ? fract(vMapUv) : vMapUv;\r
        vec2 gx = dFdx(vMapUv), gy = dFdy(vMapUv);\r
        vec4 tx = textureGrad(map, luv, gx, gy);\r
        float expo = core ? (vLeaf.x - 2.0) : vLeaf.x;\r
        if (core) { // solid inner mass: leaf texture where it has coverage, otherwise deep shade\r
          vec4 t2 = textureGrad(map, fract(vMapUv * 0.7 + 0.31), gx * 0.7, gy * 0.7);\r
          float cov = max(tx.a, t2.a);\r
          tx = tx.a > 0.5 ? tx : t2;\r
          tx.r = tx.g > 0.96 ? 0.55 : (tx.a > 0.5 ? tx.r * 0.85 : 0.45); tx.b = 0.0; tx.g = min(tx.g, 0.94);\r
          // grazing core surface (its silhouette) takes the leaf coverage, so the solid mass never shows a faceted edge\r
          float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));\r
          tx.a = facing > 0.45 ? 1.0 : cov;\r
        }\r
        if (!core) { // cards seen edge-on smear the texture: dissolve them (the neighbouring cards fill in)\r
          vec3 fn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));\r
          tx.a *= smoothstep(0.12, 0.4, abs(dot(fn, normalize(vViewPosition))));\r
        }\r
        diffuseColor.a *= tx.a;\r
        float twig = step(0.97, tx.g);\r
        float hsel = tx.g * 0.8 + vLeaf.y * 0.55 - 0.18;\r
        vec3 leaf = mix(vTA, vTB, smoothstep(0.15, 0.85, hsel));\r
        // a scatter of dry brown / still-green-ish leaves\r
        float odd = fract(tx.g * 13.7 + vLeaf.y * 5.3);\r
        leaf = odd > 0.93 ? vec3(0.13, 0.06, 0.025) : (odd < 0.035 ? vec3(0.16, 0.14, 0.035) : leaf);\r
        leaf *= 0.42 + 0.72 * tx.r;\r
        // self-occlusion: deep / underside leaves and the back of each spray fall into shade\r
        float occ = mix(0.4, 1.0, pow(clamp(expo, 0.0, 1.0), 1.4)) * mix(0.62, 1.0, tx.b);\r
        if (core) occ = mix(0.24, 0.42, clamp(expo, 0.0, 1.0));\r
        vec3 c = twig > 0.5 ? vec3(0.085, 0.06, 0.042) : leaf;\r
        diffuseColor.rgb *= c * occ;\r
        float leafExpo = core ? 0.0 : clamp(expo, 0.0, 1.0);\r
      `,hn=`\r
        // alpha-to-coverage for the TAA pipeline: stochastic threshold per pixel/frame -> TAA resolves soft, density-\r
        // preserving edges (distant sprays keep their filtered coverage instead of thinning out)\r
        { float n = fract(leafIGN(gl_FragCoord.xy + 17.0) + uLeafFrame.x * 2.618034);\r
          if (diffuseColor.a < mix(0.2, 0.7, n)) discard; diffuseColor.a = 1.0; }`,gn=`#include <normal_fragment_begin>\r
        normal = normalize(vNormal);\r
        { // per-leaf normals from the atlas, in the derivative tangent frame (the core: strong, so it never shades as a ball)\r
          vec3 mapN = texture(uLeafN, core ? fract(vMapUv) : vMapUv).xyz * 2.0 - 1.0;\r
          if (core) mapN.xy *= 2.2;\r
          vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);\r
          vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);\r
          vec3 Tt = q1p * gx.x + q0p * gy.x, Bt = q1p * gx.y + q0p * gy.y;\r
          float det = max(dot(Tt, Tt), dot(Bt, Bt));\r
          float sc = det == 0.0 ? 0.0 : inversesqrt(det);\r
          normal = normalize(normal * max(mapN.z, 0.3) + (Tt * mapN.x + Bt * mapN.y) * sc * 0.9);\r
        }`,_n=`vec3 leafSun = vec3(0.0); vec3 leafSunDir = vec3(0.0, 1.0, 0.0);
__SHADER_INJECT_0__`,vn=`#include <lights_fragment_end>\r
        { // thin-leaf translucency: sun shining through the outer leaves toward the camera, plus wrapped back-light\r
          vec3 V = normalize(vViewPosition);\r
          float thr = pow(clamp(dot(-V, leafSunDir), 0.0, 1.0), 4.0);\r
          float back = clamp(dot(-normal, leafSunDir), 0.0, 1.0);\r
          float k = leafExpo * leafExpo * (1.0 - twig);\r
          reflectedLight.directDiffuse += diffuseColor.rgb * leafSun * RECIPROCAL_PI * k * (thr * 2.2 + back * 0.6);\r
        }`,yn=`#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * vec3(0.13, 0.1, 0.06) * ambData.vert.x * ambData.bounce.w; // skylight transmitted through the leaves (warm) (lighting2 r6: x vertical-fill gain, off at night: canopies in shade read dark)`,bn=`in float aKind; in vec4 aTree; uniform vec3 uSun; uniform float uY;\r
      out float vR; out float vK; out float vS;\r
      void main() {\r
        vK = aKind; vR = length(position.xz);\r
        vec3 p;\r
        float dCam = length(aTree.xy - cameraPosition.xz);\r
        if (aKind < 0.5) { p = vec3(aTree.x + position.x * aTree.z * 1.15, uY, aTree.y + position.z * aTree.z * 1.15); vS = 1.0; }\r
        else {\r
          float el = max(asin(clamp(uSun.y, 0.0, 1.0)), 0.2);\r
          vec2 d = -normalize(uSun.xz + vec2(1e-4));\r
          vec2 c = aTree.xy + d * aTree.w / tan(el) * 0.92;\r
          float st = min(1.0 / sin(el), 2.4);\r
          vec2 u = position.x * d * st + position.z * vec2(-d.y, d.x);\r
          p = vec3(c.x + u.x * aTree.z * 0.95, uY + 0.004, c.y + u.y * aTree.z * 0.95);\r
          vS = smoothstep(145.0, 180.0, dCam) * smoothstep(0.02, 0.12, uSun.y);   // near trees cast real CSM shadows\r
        }\r
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);\r
      }\r
`,xn=`in float vR; in float vK; in float vS; out vec4 fragColor;\r
      void main() {\r
        float a = vK < 0.5 ? (1.0 - smoothstep(0.15, 1.0, vR)) * 0.32 : (1.0 - smoothstep(0.45, 1.0, vR)) * 0.5 * vS;\r
        fragColor = vec4(vec3(1.0 - a), 1.0);\r
      }\r
`,Sn=`#include <common>
out vec2 vGU; in float aGV; out float vGV;`,Cn=`#include <uv_vertex>
vCopUV = uv;`,wn=`#include <common>
out vec2 vFU;`,Tn=`#include <uv_vertex>
vFU = uv;`,En=`#include <common>
in vec2 vFU;`,Dn=`\r
        { vec2 q = vec2(vFU.x + vFU.y, vFU.x - vFU.y) / 0.06; vec2 f = abs(fract(q) - 0.5); float w = min(f.x, f.y);\r
          vec2 fw = fwidth(q); float cov = 1.0 - smoothstep(0.06, 0.06 + max(fw.x, fw.y), w);\r
          float far = smoothstep(0.15, 0.6, max(fw.x, fw.y));\r
          diffuseColor.a = mix(cov, 0.42, far);\r
          float rail = step(abs(vFU.y - 0.03), 0.03) + step(abs(vFU.y - floor(vFU.y / 5.0 + 0.5) * 5.0), 0.04);\r
          diffuseColor.a = max(diffuseColor.a, min(rail, 1.0)); if (diffuseColor.a < 0.02) discard; }\r
        #include <alphatest_fragment>`,On=`#include <common>
out vec2 vHexW;`,kn=`#include <begin_vertex>
vHexW = (modelMatrix * vec4(position, 1.0)).xz;`,An=`#include <common>\r
      in vec2 vHexW;\r
      float hxH(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }`,jn=`#include <map_fragment>\r
      { vec2 p = vHexW / 0.23; // hexagon cells (~0.4 m across)\r
        vec2 r = vec2(1.0, 1.7320508), h = r * 0.5;\r
        vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;\r
        vec2 g = dot(a, a) < dot(b, b) ? a : b;\r
        vec2 id = p - g;\r
        vec2 q = abs(g); float edge = 0.5 - max(dot(q, normalize(r)), q.x);\r
        float fw = fwidth(p.x) * 1.2;\r
        float mortar = 1.0 - smoothstep(0.02, 0.02 + fw, edge);\r
        float far = smoothstep(0.08, 0.35, fw);\r
        float tone = 0.86 + 0.2 * hxH(floor(id * 10.0 + 0.5));\r
        float gr = 0.9 + 0.1 * sin(vHexW.x * 0.37 + vHexW.y * 0.21) * sin(vHexW.y * 0.13);\r
        diffuseColor.rgb *= mix(tone * mix(1.0, 0.55, mortar), 0.9, far) * gr; }`,Mn=`#include <common>
out vec2 vDW;`,Nn=`#include <uv_vertex>
vGU = uv; vGV = aGV;`,Pn=`#include <begin_vertex>
vDW = (modelMatrix * vec4(position, 1.0)).xz;`,Fn=`#include <common>\r
        in vec2 vDW;\r
        float dH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\r
        float dN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\r
          return mix(mix(dH(i), dH(i + vec2(1, 0)), f.x), mix(dH(i + vec2(0, 1)), dH(i + vec2(1, 1)), f.x), f.y); }`,In=`#include <map_fragment>\r
        { float n = dN(vDW * 0.35) * 0.6 + dN(vDW * 1.7) * 0.4;\r
          diffuseColor.rgb *= 0.82 + 0.3 * n;                                  // patched / sealed asphalt\r
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.2, 0.19), smoothstep(0.72, 0.8, dN(vDW * 0.12 + 3.0)) * 0.5); }`,Ln=`#include <common>\r
      in vec2 vGU; in float vGV; float gH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,Rn=`\r
        // (park r6) critic r5: 'solar-panel grid textures'. Pale frosted panes (ref 10) in a finer, thinner mullion grid\r
        // (park r8) per-skylight family + pitch (vGV): no two neighbouring skylights share a look\r
        vec2 pitch = vGV < 0.33 ? vec2(1.6, 1.1) : (vGV < 0.66 ? vec2(2.4, 1.5) : vec2(1.2, 2.2));\r
        vec2 gc = vGU / pitch, gf = fract(gc), gi = floor(gc);\r
        vec2 fw = fwidth(gc) * 1.2;\r
        vec2 bar = vec2(0.03, 0.045);\r
        float fr = 1.0 - (smoothstep(bar.x, bar.x + fw.x, gf.x) * smoothstep(bar.x, bar.x + fw.x, 1.0 - gf.x)\r
                        * smoothstep(bar.y, bar.y + fw.y, gf.y) * smoothstep(bar.y, bar.y + fw.y, 1.0 - gf.y));\r
        float h = gH(gi), h2 = gH(gi + 17.3);\r
        vec3 pane = mix(vec3(0.25, 0.29, 0.33), vec3(0.32, 0.35, 0.38), step(0.8, h)) /* (park r9) critic r8: 'bright blue-white skylights look pasted on' */ * (0.92 + 0.1 * h2); // (park r8) less pane-to-pane checker\r
        float fam = fract(vGV * 7.13);\r
        if (fam < 0.34) pane = mix(vec3(0.16, 0.2, 0.25), vec3(0.24, 0.28, 0.32), step(0.85, h)) * (0.9 + 0.2 * h2);   // dark reflective\r
        else if (fam < 0.58) pane = mix(vec3(0.36, 0.38, 0.37), vec3(0.44, 0.45, 0.42), step(0.75, h)) * (0.9 + 0.12 * h2); // milky, weathered\r
        pane *= 0.82 + 0.3 * smoothstep(0.0, 1.0, fract(vGU.x * 0.021 + vGV * 3.0)) ; // broad grime / reflection gradient across the skylight\r
        pane *= 1.0 - 0.18 * smoothstep(0.3, 1.0, fract(vGU.y * 0.07 + h * 0.3));   // dirt washes down the panes\r
        { // (park r10) critic r9: 'add dirt'. Blotchy soot / bird-lime / leaf-litter grime per pane cluster, darker in the\r
          // bottom corners where rain water pools against the bars\r
          float gd = gH(floor(vGU / 5.0) + vGV * 31.0), gd2 = gH(gi * 0.5 + 3.7);\r
          pane *= 1.0 - 0.28 * smoothstep(0.55, 0.95, gd * 0.6 + gd2 * 0.5);\r
          pane *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.22, gf.y)) * (0.5 + 0.5 * h2);\r
          pane = mix(pane, vec3(0.2, 0.18, 0.14), 0.18 * step(0.9, gd2));\r
        }\r
        diffuseColor.rgb = mix(pane, vec3(0.3, 0.31, 0.32), fr * 0.6);\r
        float gRough = mix(mix(0.36, 0.5, step(0.8, h)), 0.6, fr);\r
        if (fam < 0.34) gRough = mix(0.5, 0.6, fr); else if (fam < 0.58) gRough = mix(0.72, 0.8, fr);   // (park r8) dark = matte wired glass, milky = frosted\r
      `,zn=`#include <roughnessmap_fragment>
roughnessFactor = gRough;`,Bn=`#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(0.018, 0.017, 0.015) * (1.0 - fr) * step(h2, 0.7);`,Vn=`#include <map_fragment>\r
        { float blk = fract(vCopUV.y / 1.8); float j = smoothstep(0.0, 0.04, blk) * smoothstep(1.0, 0.96, blk);\r
          float h = fract(sin(floor(vCopUV.y / 1.8) * 91.7) * 4375.5);\r
          diffuseColor.rgb *= (0.55 + 0.45 * j) * (0.85 + 0.25 * h) * mix(0.8, 1.0, smoothstep(0.0, 0.25, vCopUV.x)); }`,Hn=`#include <common>
in vec2 vCopUV;
`,Un=`#include <common>
out vec2 vCopUV;`,Wn=`in float aT; out float vT; out vec3 vW;\r
      #include <fog_pars_vertex>\r
      void main() { vT = aT; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;\r
      #include <fog_vertex>\r
      }\r
`,Gn=`in float vT; in vec3 vW; uniform float uTime; out vec4 fragColor;\r
      #include <fog_pars_fragment>\r
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\r
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\r
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }\r
      void main() {\r
        vec3 V = normalize(cameraPosition - vW);\r
        float graze = 1.0 - clamp(V.y, 0.0, 1.0);                         // 0 top-down .. 1 grazing\r
        float n = vn(vW.xz * 0.18) * 0.6 + vn(vW.xz * 0.7) * 0.4;\r
        // mirrored tree line: its inner edge is a row of crown bumps (~7 m) and reaches further out at grazing views\r
        float crowns = vn(vec2(vW.x + vW.z, vW.z - vW.x) * 0.14) * 0.6 + vn(vW.xz * 0.45) * 0.4;\r
        float reach = mix(0.6, 0.95, graze) * (0.65 + 0.55 * crowns); // (park r8) 0.45 -> 0.6 from above (critic r7: 'no shoreline darkening')\r
        float t = clamp(vT + (n - 0.5) * 0.18, 0.0, 1.0);\r
        float band = 1.0 - smoothstep(reach - 0.12, reach + 0.05, t);\r
        // wind: cat's-paw patches (ruffled water reflects more sky) + fine streaks along the wind\r
        vec2 wd = vec2(0.8, 0.6), wq = vec2(dot(vW.xz, wd), dot(vW.xz, vec2(-wd.y, wd.x)));\r
        float paw = smoothstep(0.45, 0.8, vn(wq * vec2(0.02, 0.035) + uTime * 0.01) * 0.7 + vn(wq * 0.09) * 0.3);\r
        float streak = vn(vec2(wq.x * 0.03, wq.y * 0.6));\r
        float rip = vn(wq * vec2(0.9, 2.2) + vec2(uTime * 0.4, 0.0));\r
        vec3 sky = mix(vec3(0.44, 0.52, 0.6), vec3(0.72, 0.76, 0.8), graze);\r
        vec3 deep = vec3(0.035, 0.05, 0.045);\r
        // (park r9) critic r8: 'a flat mirror with an obvious stretched sky reflection, no depth colour'. Fresnel: seen\r
        // from above the water is mostly its own dark tannin-green body (weak reflection), sky-bright only at grazing\r
        // angles and in the wind-ruffled patches; plus fine ripple bands breaking up the reflected clouds\r
        float fres = 0.12 + 0.88 * pow(graze, 3.0);\r
        float fine = vn(wq * vec2(0.35, 1.3) - vec2(uTime * 0.25, 0.0)) * vn(wq * vec2(1.7, 4.1) + vec2(uTime * 0.6, 0.0));\r
        vec3 c = mix(deep, sky, clamp((0.18 + 0.45 * paw + 0.2 * streak + 0.25 * fine) * mix(0.55, 1.0, fres), 0.0, 1.0));\r
        float a = clamp((0.34 + 0.24 * paw + 0.14 * abs(streak - 0.5) + 0.12 * fine) * mix(1.0, 0.7, fres), 0.0, 0.8); // (park r8) wind texture; (park r9) denser body colour\r
        // (park r10) critic r9: 'blotchy tiled normal pattern, hard dark tone, no sky-reflection gradient, flat mirror'.\r
        // The open water now carries its own reflected-sky gradient (zenith blue seen from above -> pale horizon haze at\r
        // grazing view, weighted by Fresnel) over a teal-grey body, with multi-scale non-repeating ripple bands, and is\r
        // opaque enough (0.62-0.85) to hide the base water's tiling normal from swinging height\r
        {\r
          vec3 skyZ = vec3(0.26, 0.36, 0.48), skyH = vec3(0.6, 0.66, 0.7);\r
          vec3 refl = mix(skyZ, skyH, pow(graze, 1.6));\r
          float cloud = smoothstep(0.35, 0.85, vn(vW.xz * 0.006 + vec2(uTime * 0.002, 0.0)) * 0.7 + vn(vW.xz * 0.02) * 0.3);\r
          refl = mix(refl, vec3(0.7, 0.72, 0.74), cloud * 0.45);\r
          float rw = vn(wq * vec2(0.05, 0.18) + vec2(uTime * 0.05, 0.0)) * 0.5 + vn(wq * vec2(0.16, 0.55) - vec2(uTime * 0.12, 0.0)) * 0.3 + fine * 0.4;\r
          vec3 body = vec3(0.045, 0.068, 0.07) * (0.9 + 0.25 * vn(vW.xz * 0.03));\r
          float fr2 = clamp(0.1 + 0.8 * pow(graze, 2.4) + 0.22 * (rw - 0.45) + 0.2 * paw, 0.04, 0.95);\r
          vec3 c2 = mix(body, refl, fr2);\r
          c = mix(c, c2, 0.75);\r
          a = max(a, mix(0.62, 0.85, graze));\r
        }\r
        // tree reflection colour (dark olive / umber, a little autumn warmth) over the band\r
        vec3 tree = mix(vec3(0.028, 0.036, 0.018), vec3(0.07, 0.058, 0.03), crowns) * (0.85 + 0.3 * rip);\r
        c = mix(c, tree, band); a = mix(a, 0.9, band);\r
        // (park r10) shoreline gradient: a silty olive-brown shallow shelf fading out over the first few metres (seen\r
        // through the tree reflection from above), then a broken foam / wet-stone lip at the waterline\r
        float shelf = 1.0 - smoothstep(0.0, 0.16 + 0.08 * n, vT);\r
        c = mix(c, vec3(0.11, 0.1, 0.066) * (0.85 + 0.3 * n), shelf * mix(0.7, 0.25, graze));\r
        float foam = (1.0 - smoothstep(0.0, 0.03, vT)) * smoothstep(0.45, 0.7, vn(vW.xz * 0.9 + uTime * 0.05));\r
        c = mix(vec3(0.07, 0.065, 0.052), c, smoothstep(0.0, 0.035, vT));   // thin wet-stone lip at the waterline\r
        c = mix(c, vec3(0.34, 0.35, 0.33), foam * 0.55);\r
        a = max(a, (1.0 - smoothstep(0.0, 0.035, vT)) * 0.8);\r
        fragColor = vec4(c, a);\r
        #ifdef USE_FOG\r
          #ifdef FOG_EXP2\r
            float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);\r
          #else\r
            float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);\r
          #endif\r
          fragColor.rgb = mix(fragColor.rgb, fogColor, fogFactor);\r
        #endif\r
      }\r
`,X=B.CURB_H+.02,Kn=B.CURB_H+.02,qn={met:{x0:136,x1:227,z0:-1378,z1:-1204}},Jn=[],Yn=[];function Xn(e){let t=qn.met,n=(e,t)=>{let n=[e[0]];for(let r=1;r<e.length;r++){let[i,a]=e[r-1],[o,s]=e[r],c=Math.hypot(o-i,s-a),l=Math.max(1,Math.ceil(c/t));for(let e=1;e<=l;e++)n.push([i+(o-i)*e/l,a+(s-a)*e/l])}return n},r=[];for(let i of e){if(i.drive){let e=n(i.pts,6),a=t.x0-9;for(let n of e){if(n[0]<a)continue;let e=Math.max(t.z0-4-n[1],n[1]-(t.z1+4),0),r=e>=55?0:.5+.5*Math.cos(Math.PI*e/55);n[0]+=(a-n[0])*r}r.push({...i,pts:e});continue}let e=n(i.pts,3),a=2.5+i.w/2,o=[],s=()=>{o.length>=3&&r.push({...i,pts:o}),o=[]};for(let n of e)n[0]>t.x0-a&&n[0]<t.x1+a&&n[1]>t.z0-a&&n[1]<t.z1+a?s():o.push(n);s()}return e.length=0,e.push(...r),Zn(e),e}function Zn(e){let t=B.PARK,n=qn.met,r=I(8088),i=new Map,a=(e,t,n)=>{let r=Math.floor(e/10)*100003+Math.floor(t/10),a=i.get(r);a||i.set(r,a=[]),a.push([e,t,n])};e.forEach((e,t)=>{for(let n=1;n<e.pts.length;n++){let[r,i]=e.pts[n-1],[o,s]=e.pts[n],c=Math.max(1,Math.ceil(Math.hypot(o-r,s-i)/3));for(let e=0;e<=c;e++)a(r+(o-r)*e/c,i+(s-i)*e/c,t)}});let o=(e,t,n,r)=>{let a=null,o=n*n;for(let s=Math.floor((e-n)/10);s<=Math.floor((e+n)/10);s++)for(let c=Math.floor((t-n)/10);c<=Math.floor((t+n)/10);c++)for(let n of i.get(s*100003+c)??[]){if(n[2]===r)continue;let i=(n[0]-e)**2+(n[1]-t)**2;i<o&&(o=i,a=n)}return a},s=(e,t,n)=>z(e,t)||z(e+n,t)||z(e-n,t)||z(e,t+n)||z(e,t-n),c=(e,r)=>e<t.x0+12||e>t.x1-12||r<t.z0+12||r>t.z1-12||e>n.x0-8&&e<n.x1+8&&r>n.z0-8&&r<n.z1+8,l=(e,t)=>he(e,t)<.9,u=0;for(let t=0;t<160&&u<46;t++){let t=e[Math.floor(r()*e.length)],n=e.indexOf(t);if(t.pts.length<3)continue;let i=1+Math.floor(r()*(t.pts.length-2)),[d,f]=t.pts[i-1],[p,m]=t.pts[i+1],h=Math.atan2(m-f,p-d)+(r()<.5?1:-1)*(Math.PI/2+(r()-.5)*1.1),[g,_]=t.pts[i];if(l(g,_)||s(g,_,10))continue;let v=[[g,_]],y=(r()-.5)*.12,b=!1;for(let e=0;e<70;e++){y=y*.85+(r()-.5)*.16,h+=y;let t=g+Math.cos(h)*5,i=_+Math.sin(h)*5,a=0;for(;(s(t,i,7)||c(t,i)||l(t,i))&&a++<10;)h+=(y>=0?1:-1)*.4,t=g+Math.cos(h)*5,i=_+Math.sin(h)*5;if(a>=10)break;if(g=t,_=i,v.push([g,_]),e>5){let e=o(g,_,4.5,n);if(e&&e[2]!==n){v.push([e[0],e[1]]),b=!0;break}}}if(v.length<8||!b&&(v.length<22||r()<.6))continue;let x=e.length;e.push({pts:v,w:2.3+r()*.9,minor:!0});for(let e=1;e<v.length;e++)a(v[e][0],v[e][1],x);u++}}function Qn({scene:t,facadeMat:n,solids:r=null,zips:i=null,meadowDist:o=null,parkPaths:s=[]}){let c=new pe,l=r,u=[],p=[],m=(e,t,n,r,i,a,o,s={},u=!0,d=null,f=`wall`)=>{c.box(e,t,n,r,i,a,o,s,u,!1,d),l?.box(e,t,n,r,i,a,f)},h={count:0},g=[];{let e={style:U.BLANK,layer:H.LIME,tint:[.93,.9,.84],seed:11,floorH:7,bayW:5.6,winW:.46,winH:.72,margin:1.4,depth:.6,glass:1},n={...e},r={...e,floorH:12.5,bayW:7.2,winW:.52,winH:.74,depth:.6,seed:12},a={style:U.BLANK,layer:H.GRANITE,tint:[.42,.41,.4],seed:13,floorH:4.5,bayW:3,winW:.8,winH:.5,margin:.4,depth:.2},o={style:U.BLANK,layer:H.METAL,tint:[.72,.8,.86],seed:14,floorH:4,bayW:1.6,winW:.96,winH:.9,margin:0,depth:.04,glass:2},s={style:U.BLANK,layer:H.ROOF_MEMBRANE,tint:[.11,.11,.115],seed:15},f={style:U.BLANK,layer:H.ROOF_GRAVEL,tint:[.14,.14,.14],seed:16};U.BLANK,H.WHITE;let _=e=>({style:e,gH:0}),v=_(U.PUNCHED),y=_(U.CURTAIN),x=_(U.BLANK),S=19.5,C=25.5;m(196,0,-1362,222,S,-1298,n,{px:v,nz:v,pz:null,nx:v},!0,s),m(196,0,-1274,222,S,-1208,n,{px:v,pz:v,nz:null,nx:v},!0,s),m(222,0,-1362,223.2,20.7,-1348,e,{px:v,nz:x,pz:x,nx:x},!0,e),m(222,0,-1222,223.2,20.7,-1208,e,{px:v,nz:x,pz:x,nx:x},!0,e),m(221.4,S,-1348,222,20.6,-1298,e,{px:x,nz:null,pz:null,nx:x},!0,e),m(221.4,S,-1274,222,20.6,-1222,e,{px:x,nz:null,pz:null,nx:x},!0,e),m(196,0,-1298,224,C,-1274,r,{px:v,nz:x,pz:x,nx:x},!0,s),m(222.5,C,-1296,224,27.9,-1276,e,{px:x,nz:x,pz:x,nx:x},!0,e);let w={...e,tint:[.95,.92,.86]};m(224,0,-1296.5,226.6,3,-1275.5,e,{px:x,nz:x,pz:x,nx:null},!0,e);for(let e of[-1294.8,-1293,-1289.5,-1287.7,-1284.3,-1282.5,-1279,-1277.2])c.cyl(225.3,e,.52,3,20.6,8,w,U.BLANK,!1),l?.cyl(225.3,e,3,20.6,.52*(1+Math.cos(Math.PI/8))/2,.52*(1+Math.cos(Math.PI/8))/2,`wall`),m(224.55,20.6,e-.75,226.05,21.2,e+.75,w,{nx:null},!1);m(224,21.2,-1296.5,226.6,23.8,-1275.5,e,{px:x,nz:x,pz:x,nx:null},!0,e);for(let[e,t]of[[-1291.25,[.5,.13,.1]],[-1285.9,[.2,.26,.36]],[-1280.65,[.62,.46,.2]]])m(224,7.6,e-1,224.07,19.4,e+1,{style:U.BLANK,layer:H.WHITE,tint:t,seed:75},{px:x,nz:x,pz:x,nx:null},!0,null,`awning`),m(223.95,19.4,e-1.1,224.14,19.55,e+1.1,{style:U.BLANK,layer:H.METAL,tint:[.3,.3,.3],seed:76},{px:x,nz:x,pz:x,nx:null},!0,null,`awning`);for(let t=0;t<6;t++){let n=231.5-t*.8,r=t*.02;m(226.6,0,-1306+r,n,X+(t+1)*.47,-1266-r,e,{nx:null},!0,{...e,tint:[.8,.78,.74]})}{let t={...e,tint:[.97,.94,.88]};for(let[n,r,i]of[[-1362,-1298,e=>e<-1347],[-1274,-1208,e=>e>-1223]]){let a=r-n-2*e.margin,o=Math.max(1,Math.round(a/e.bayW)),s=a/o;for(let n=0;n<=o;n++){let a=r-(e.margin+n*s);i(a)||(m(222,X,a-.5,222.42,18.05,a+.5,t,{px:x,nz:x,pz:x,nx:null},!1),m(221.95,X,a-.62,222.55,1.6,a+.62,t,{px:x,nz:x,pz:x,nx:null},!0,t),m(221.95,17.75,a-.62,222.55,18.05,a+.62,t,{px:x,nz:x,pz:x,nx:null},!0,t))}m(222,18.05,n+(n<-1300?14:0),222.95,18.55,r-(n<-1300?0:14),t,{px:x,nz:x,pz:x,nx:null},!0,t,`cornice`),m(222,18.55,n+(n<-1300?14:0),223.25,18.95,r-(n<-1300?0:14),t,{px:x,nz:x,pz:x,nx:null},!0,t,`cornice`)}for(let[n,r]of[[-1362,-1],[-1208,1]]){let i=e=>r<0?[n-e,n]:[n,n+e],[a,o]=i(.95);m(196,18.05,a,223.2,18.55,o,t,{all:x},!0,t,`cornice`),[a,o]=i(1.25),m(196,18.55,a,223.5,18.95,o,t,{all:x},!0,t,`cornice`),[a,o]=i(.22),m(196,6,a,223.2,6.45,o,t,{all:x},!0,t,`cornice`),[a,o]=i(.3),m(196,X,a,223.2,1.2,o,{...e,tint:[.78,.76,.72]},{all:x},!0,t)}m(224,24.3,-1297.5,227.2,24.9,-1274.5,t,{px:x,nz:x,pz:x,nx:null},!0,t,`cornice`),c.horiz(223.4,-1340,233.3,-1232,X+.006,{style:U.BLANK,layer:H.CONCRETE,tint:[.86,.84,.8],seed:71});for(let t of[-1321,-1251]){let n=228.6,r=3.4,i={...e,tint:[.84,.81,.76]},a=(e,t)=>e*(1+Math.cos(Math.PI/t))/2;c.cyl(n,t,r,X,X+.62,28,i,U.BLANK,!0),l?.cyl(n,t,X,X+.62,a(r,28),a(r,28),`wall`),c.cyl(n,t,3.05,X+.62,X+.626,28,{style:U.BLANK,layer:H.METAL,tint:[.42,.52,.56],seed:73},U.BLANK,!0),c.cyl(n,t,.7,X+.62,X+1.25,12,i,U.BLANK,!0),l?.cyl(n,t,X+.62,X+1.25,a(.7,12),a(.7,12),`wall`),g.push([n,X+1.25,t])}}let T=new W;T.setColor([.05,.055,.06]);let E=15.5,D=13.5,O={...f,tint:[.15,.148,.142]},k={...s,tint:[.1,.1,.108]},A={...s,layer:H.ROOF_MEMBRANE,tint:[.2,.196,.188]},j=_(U.RIBBON);m(150,0,-1356,196,E,-1310,a,{nx:j,nz:j,pz:null,px:null},!0,O),m(150,0,-1310,196,19,-1262,a,{nx:j,nz:x,pz:x,px:null},!0,k),m(150,0,-1262,196,D,-1214,a,{nx:j,nz:null,pz:j,px:null},!0,A),m(160,0,-1376,196,13.5,-1356,o,{nx:y,nz:y,px:y,pz:null},!0,s),m(138,0,-1318,150,8.5,-1254,o,{nx:y,nz:y,pz:y,px:null},!1);{let e=8.5,t=13.2,n=-1318,r=-1254,i=[[138,e,n],[138,e,r],[150,t,r],[150,t,n]];i.v=.1,p.push(i);let a=[[150,e,n],[138,e,n],[150,t,n]],o=[[138,e,r],[150,e,r],[150,t,r]];a.v=o.v=.1,p.push(a,o),l?.ramp(138,8.48,n,150,r,0,e,t,`skylight`);for(let e=n;e<=-1253.99;e+=3.2)T.tube([138,8.51,e],[150,13.209999999999999,e],.02,4);T.box(137.8,8.2,n,138.1,8.52,r),l?.box(137.8,8.2,n,138.1,8.52,r,`skylight`),T.box(149.7,13.18,n,150,13.44,r),l?.box(149.7,13.18,n,150,13.44,r,`skylight`)}let M={style:U.BLANK,layer:H.METAL,tint:[.32,.33,.34],seed:18},N=(e,t,n,r,i,a)=>{m(e,i,t,n,i+a,r,M,{all:x},!1,null,`equipment`),u.push([e,t,n,r,i+a]);let o=n-e>r-t,s=o?n-e:r-t,c=Math.max(1,Math.round(s/3.2)),l={...M,tint:[.2,.21,.22]};for(let u=1;u<c;u++){let d=(o?e:t)+s*u/c;o?m(d-.07,i+a,t,d+.07,i+a+.12,r,l,{all:x},!0,l,`skylight`):m(e,i+a,d-.07,n,i+a+.12,d+.07,l,{all:x},!0,l,`skylight`)}if((o?r-t:n-e)>7){let s=(o?t+r:e+n)/2;o?m(e,i+a,s-.08,n,i+a+.14,s+.08,l,{all:x},!0,l,`skylight`):m(s-.08,i+a,t,s+.08,i+a+.14,r,l,{all:x},!0,l,`skylight`)}let d=.24,f=i+a+.22;m(e,i+a,t,n,f,t+d,l,{all:x},!0,l,`skylight`),m(e,i+a,r-d,n,f,r,l,{all:x},!0,l,`skylight`),m(e,i+a,t+d,e+d,f,r-d,l,{all:x},!0,l,`skylight`),m(n-d,i+a,t+d,n,f,r-d,l,{all:x},!0,l,`skylight`)},P=(e,t,n,r,i,a,o)=>{let s=i+.5,c=s+a;if(m(e,i,t,n,s,r,M,{all:x},!1,null,`equipment`),o){let i=(t+r)/2;p.push([[e,s,t],[n,s,t],[n,c,i],[e,c,i]],[[e,c,i],[n,c,i],[n,s,r],[e,s,r]]),l?.ramp(e,s-.02,t,n,i,2,s,c,`skylight`),l?.ramp(e,s-.02,i,n,r,2,c,s,`skylight`);for(let a of[e,n]){let n=T.v;T.vert(a,s,t,a===e?-1:1,0,0),T.vert(a,s,r,a===e?-1:1,0,0),T.vert(a,c,i,a===e?-1:1,0,0),T.tri(n,n+1,n+2),T.tri(n,n+2,n+1)}T.box(e,c-.04,i-.12,n,c+.1,i+.12),l?.box(e,c-.04,i-.12,n,c+.1,i+.12,`skylight`)}else{let i=(e+n)/2;p.push([[e,s,t],[e,s,r],[i,c,r],[i,c,t]],[[i,c,t],[i,c,r],[n,s,r],[n,s,t]]),l?.ramp(e,s-.02,t,i,r,0,s,c,`skylight`),l?.ramp(i,s-.02,t,n,r,0,c,s,`skylight`);for(let a of[t,r]){let r=T.v;T.vert(e,s,a,0,0,a===t?-1:1),T.vert(n,s,a,0,0,a===t?-1:1),T.vert(i,c,a,0,0,a===t?-1:1),T.tri(r,r+1,r+2),T.tri(r,r+2,r+1)}T.box(i-.12,c-.04,t,i+.12,c+.1,r),l?.box(i-.12,c-.04,t,i+.12,c+.1,r,`skylight`)}};P(156,-1350,190,-1345,E,1.5,!0),P(158,-1340,186,-1335,E,1.5,!0),P(156,-1330,176,-1325,E,1.5,!0),N(161,-1298,185,-1276,19,2.2),N(188,-1296,194,-1280,19,1),N(155,-1254,183,-1231,D,1.2),N(187,-1249,193,-1238,D,.9),N(202,-1354,216,-1335,S,1.2),P(203,-1326,215,-1305,S,1.8,!1),P(204,-1266,214,-1216,S,2,!1),N(205,-1292,217,-1280,C,1.5);{let t=I(606),n={style:U.BLANK,layer:H.METAL,tint:[1.9,1.92,1.95],seed:19},r={...n,tint:[1.1,1.12,1.12]},i=[[1.9,1.92,1.95],[2.2,2.1,1.95],[1.5,1.52,1.5],[2,1.9,1.7],[1.2,1.24,1.28],[.9,.86,.8]],o=(e,a,o,s,u)=>{let d=1.1+t()*1.3,f=i[Math.floor(t()*i.length)];m(e,u,a,e+o,u+d,a+s,{...n,tint:f},{all:x},!0,{...n,tint:f.map(e=>e*.9)},`equipment`);let p=Math.max(1,Math.floor(Math.max(o,s)/2.2));for(let t=0;t<p;t++){let n=(t+.5)/p,i=o>s?e+o*n:e+o/2,f=o>s?a+s/2:a+s*n,m=Math.min(o,s)*.3;c.cyl(i,f,m,u+d,u+d+.35,10,r,U.BLANK,!0),l?.cyl(i,f,u+d,u+d+.35,m*(1+Math.cos(Math.PI/10))/2,m*(1+Math.cos(Math.PI/10))/2,`equipment`)}};o(151.2,-1353,3.4,6.5,E),o(177.5,-1323,7,3,E),o(151.2,-1328,3.2,5,E),o(191.5,-1352,3.6,5.5,E),m(189,E,-1321,195,18.9,-1312,a,{all:x},!0,s,`equipment`),m(152.2,E,-1321,188,16.3,-1319.8,r,{all:x},!0,r,`equipment`),m(151,19,-1308,159,21.6,-1300,a,{all:x},!0,s,`equipment`),o(186,-1307,7.5,3.2,19),o(152,-1272,3.4,7,19),o(187.5,-1274,3.6,8,19),m(160,19,-1266.5,185,19.7,-1265.3,r,{all:x},!0,r,`equipment`),o(151.5,-1228,3.4,5,D),o(160,-1226,6.5,2.6,D),o(172,-1226,5,2.6,D),o(187,-1232,3.6,6,D),o(197,-1360,3.2,4.5,S),o(217.6,-1350,3.2,5.5,S),o(197,-1318,3.4,5,S),o(197,-1262,3.2,4.2,S),o(217.6,-1244,3.2,6,S),o(197,-1228,3.2,5.5,S);let u={...e,tint:[.82,.8,.76]},d=(e,t,n,r,i)=>m(e,i,t,n,i+.75,r,u,{all:x},!0,u,`parapet`);d(196,-1362,196.5,-1298,S),d(196,-1274,196.5,-1208,S),d(196.5,-1362,221.4,-1361.5,S),d(196.5,-1208.5,221.4,-1208,S),d(150,-1356,150.5,-1310,E),d(150,-1310,150.5,-1262,19),d(150,-1262,150.5,-1214,D),d(150.5,-1356,196,-1355.5,E),d(150.5,-1214.5,196,-1214,D),d(150.5,-1310.5,196,-1310,19),d(150.5,-1262,196,-1261.5,19);let f=(e,t,n,r,i,a,o)=>c.horiz(e,t,n,r,i+.008,{style:U.BLANK,layer:a,tint:o,seed:60+Math.floor(e+t)});f(151,-1353,155,-1331,E,H.ROOF_MEMBRANE,[.15,.15,.16]),f(177,-1333,195,-1322,E,H.ROOF_MEMBRANE,[.34,.34,.33]),f(160,-1308,186,-1298,19,H.ROOF_GRAVEL,[.3,.29,.27]),f(151,-1296,162,-1276,19,H.ROOF_MEMBRANE,[.27,.27,.26]),f(184,-1298,195,-1276,19,H.ROOF_GRAVEL,[.22,.215,.2]),f(151,-1260,196,-1256,D,H.ROOF_MEMBRANE,[.22,.22,.22]),f(185,-1236,195.5,-1216,D,H.ROOF_GRAVEL,[.28,.27,.25]),f(196.6,-1296,201.5,-1276,C,H.ROOF_MEMBRANE,[.17,.17,.18]),f(216.5,-1300,221,-1286,S,H.ROOF_MEMBRANE,[.28,.27,.26]),f(197,-1332,201.5,-1320,S,H.ROOF_GRAVEL,[.3,.29,.27]),f(215.5,-1272,221,-1250,S,H.ROOF_MEMBRANE,[.15,.15,.155]);let p=(e,n,r,i,a,o)=>{let s={style:U.BLANK,layer:H.ROOF_MEMBRANE,tint:[.1,.1,.1],seed:90};if(o)for(let o=n+1.1;o<i-.5;o+=1.9+t()*.3)c.horiz(e,o,r,o+.12,a+.012,s);else for(let o=e+1.1;o<r-.5;o+=1.9+t()*.3)c.horiz(o,n,o+.12,i,a+.012,s)};p(151,-1355,196,-1311,E,!1),p(151,-1261,196,-1215,D,!1),p(197,-1361,221,-1209,S,!0);let h={style:U.BLANK,layer:H.METAL,tint:[1.6,1.6,1.6],seed:91};for(let[e,n,i,a,o]of[[151,-1355,196,-1311,E],[151,-1309,196,-1262,19],[151,-1261,196,-1215,D],[197,-1361,221,-1209,S]]){for(let r=0;r<10;r++){let r=e+1+t()*(i-e-2),s=n+1+t()*(a-n-2);if(t()<.5)c.horiz(r-.3,s-.3,r+.3,s+.3,o+.014,{style:U.BLANK,layer:H.ROOF_MEMBRANE,tint:[.05,.05,.05],seed:92});else{let e=.1+t()*.12,n=.6+t()*.9;c.cyl(r,s,e,o,o+n,8,h,U.BLANK,!0),l?.cyl(r,s,o,o+n,e*.95,e*.95,`equipment`)}}for(let r=0;r<7;r++){let r=e+3+t()*(i-e-6),s=n+3+t()*(a-n-6),l=1.2+t()*3.2,u=.06+t()*.07;for(let d=0;d<6;d++){let f=(t()-.5)*l*1.4,p=(t()-.5)*l*1.4,m=l*(.25+t()*.45),h=l*(.25+t()*.45);c.horiz(Math.max(e,r+f-m),Math.max(n,s+p-h),Math.min(i,r+f+m),Math.min(a,s+p+h),o+.016+d*.0015,{style:U.BLANK,layer:H.ROOF_MEMBRANE,tint:[u*(1+d*.12),u*(1+d*.12),u*(1.02+d*.12)],seed:93+d})}}for(let r=0;r<4;r++){let r=e+2+t()*(i-e-8),s=n+2+t()*(a-n-8),l=.38+t()*.12;c.horiz(r,s,r+2+t()*4,s+1.5+t()*3,o+.011,{style:U.BLANK,layer:H.ROOF_MEMBRANE,tint:[l,l,l*.97],seed:97})}for(let s=0;s<2;s++){let c=s===0,u=8+t()*14,d=c?e+2+t()*Math.max(1,i-e-4-u):t()<.5?e+.75:i-.75,f=c?t()<.5?n+.75:a-.75:n+2+t()*Math.max(1,a-n-4-u),p=c?Math.min(i-1,d+u):d,h=c?f:Math.min(a-1,f+u),g=.09;T.tube([d,o+.35,f],[p,o+.35,h],g,8),l?.box(Math.min(d,p)-g,o+.26,Math.min(f,h)-g,Math.max(d,p)+g,o+.44,Math.max(f,h)+g,`equipment`);let _=Math.max(2,Math.floor(u/2.5));for(let e=0;e<=_;e++){let t=e/_,n=d+(p-d)*t,i=f+(h-f)*t;m(n-.18,o,i-.18,n+.18,o+.26,i+.18,r,{all:x},!0,r,`equipment`)}}}}let ee=T.build();if(ee){let e=new d(ee,new b({vertexColors:!0,roughness:.5,metalness:.5}));e.castShadow=!0,e.receiveShadow=!0,e.name=`park-met-steel`,t.add(e)}i&&(i.edge(223.2,-1362,223.2,-1208,20.7,1,0),i.edge(196,-1362,222,-1362,S,0,-1),i.edge(196,-1208,222,-1208,S,0,1),i.edge(150,-1356,150,-1310,E,-1,0),i.edge(150,-1310,150,-1262,19,-1,0),i.edge(150,-1262,150,-1214,D,-1,0)),h.met=qn.met}if(o){let e=I(4242),t=B.PARK,n=[];for(let e of s)for(let t=1;t<e.pts.length;t++)n.push([e.pts[t-1],e.pts[t],e.w/2+2]);let r=(e,t,r)=>n.some(([n,i,a])=>{let o=a+r;if(Math.min(n[0],i[0])-o>e||Math.max(n[0],i[0])+o<e||Math.min(n[1],i[1])-o>t||Math.max(n[1],i[1])+o<t)return!1;let s=i[0]-n[0],c=i[1]-n[1],l=Math.max(0,Math.min(1,((e-n[0])*s+(t-n[1])*c)/(s*s+c*c||1)));return Math.hypot(e-n[0]-s*l,t-n[1]-c*l)<o}),i=qn.met,a=[],c=0;for(let n=0;n<12e3&&c<125;n++){let n=t.x0+15+e()*(t.x1-t.x0-30),s=t.z0+15+e()*(t.z1-t.z0-30),l=o(n,s);if(l<.95||l>2.4)continue;let u=6+e()*9;if(n>i.x0-u-4&&n<i.x1+u&&s>i.z0-u-4&&s<i.z1+u+4||a.some(e=>Math.hypot(e[0]-n,e[1]-s)<32))continue;let d=!1;for(let e=0;e<8&&!d;e++)d=!!z(n+Math.cos(e)*(u+3),s+Math.sin(e)*(u+3));if(d||z(n,s)||r(n,s,u))continue;a.push([n,s]),Jn.push([n,s,u]),c++;let f=e()*Math.PI*2,p=Math.cos(f),h=Math.sin(f),g=.44+e()*.1,_=5+Math.floor(e()*4),v=X-.25;for(let t=0;t<_;t++){let r=t/_,i=n+p*u*r*.45+(e()-.5)*1.5,a=s+h*u*r*.45+(e()-.5)*1.5,o=u*(.72-r*.55)*(.75+e()*.4),l=u*(.52-r*.38)*(.75+e()*.4),d=.22+e()*.26+(t===0?.15:0),f=v+d+.013*t;for(let n=0;n<3;n++){let r=(e()-.5)*o*.7,s=(e()-.5)*l*.7,u=o*(.45+e()*.4),d=l*(.45+e()*.4),p=g*(.8+e()*.32),h=e()<.3?[.96,1,.9]:e()<.5?[1.04,.98,.92]:[.97,.97,.97],_={style:U.BLANK,layer:H.LIME,tint:[p*.9*h[0],p*.88*h[1],p*.84*h[2]],seed:30+c};m(i+r-u,t===0?X-.3:v-.1,a+s-d,i+r+u,f-e()*.12+.004*n,a+s+d,_,{},!0,null,`park`)}let y={style:U.BLANK,layer:H.LIME,tint:[g*.8,g*.78,g*.74],seed:30+c};if(v=f-.12,e()<.5){let n=i+(e()-.5)*o*3,r=a+(e()-.5)*l*3,s=.5+e()*.8;z(n,r)||m(n-s,X-.2,r-s*.8,n+s,X+s*.9+.017*t,r+s*.8,y,{},!0,null,`park`)}}}h.rocks=a}if(u.length||p.length){let e=[],n=[],r=[],i=[],o=[],s=0,c=()=>{let e=Math.sin(++s*91.345+3.1)*43758.5453;return e-Math.floor(e)};for(let t of p){let a=e.length/3,[s,l]=t,u=t.v??c();for(let e=0;e<t.length;e++)o.push(u);let d=[l[0]-s[0],l[1]-s[1],l[2]-s[2]],f=Math.hypot(...d),p=d.map(e=>e/f),m=t[2],h=[m[0]-s[0],m[1]-s[1],m[2]-s[2]],g=[p[1]*h[2]-p[2]*h[1],p[2]*h[0]-p[0]*h[2],p[0]*h[1]-p[1]*h[0]],_=Math.hypot(...g);g=g.map(e=>e/_);let v=g[1]<0;v&&(g=g.map(e=>-e));let y=[g[1]*p[2]-g[2]*p[1],g[2]*p[0]-g[0]*p[2],g[0]*p[1]-g[1]*p[0]];for(let i of t){let t=[i[0]-s[0],i[1]-s[1],i[2]-s[2]];e.push(...i),n.push(...g),r.push(t[0]*p[0]+t[1]*p[1]+t[2]*p[2],Math.abs(t[0]*y[0]+t[1]*y[1]+t[2]*y[2]))}let b=(e,t,n)=>v?i.push(a+e,a+n,a+t):i.push(a+e,a+t,a+n);b(0,1,2),t.length===4&&b(0,2,3)}for(let[t,a,s,l,d]of u){let u=e.length/3,f=c();o.push(f,f,f,f),e.push(t,d,l,s,d,l,s,d,a,t,d,a),n.push(0,1,0,0,1,0,0,1,0,0,1,0);let p=s-t>l-a;for(let[e,n]of[[t,l],[s,l],[s,a],[t,a]])r.push(p?e:n,p?n:e);i.push(u,u+1,u+2,u,u+2,u+3)}let l=new _;l.setAttribute(`position`,new a(e,3)),l.setAttribute(`normal`,new a(n,3)),l.setAttribute(`uv`,new a(r,2)),l.setAttribute(`aGV`,new a(o,1)),l.setIndex(i);let f=new d(l,$n());f.receiveShadow=!0,f.name=`park-skylights`,t.add(f)}if(g.length){let n=[];for(let[t,r,i]of g)n.push(new f(.06,.55,2.8,12,1,!0).translate(t,r+1.4,i)),n.push(new e(2.2,24).rotateX(-Math.PI/2).translate(t,r-.6+.01,i));let r=new b({color:15133936,roughness:.35,transparent:!0,opacity:.5,depthWrite:!1,side:2}),i=new d(ve(n.map(e=>e.toNonIndexed())),r);i.name=`park-met-fountains`,t.add(i)}nr(t,l,m),lr(m),mr(t,l,s),er(t,l),cr(t),tr(t,c,l),rr(m),ar(t),or(t,l),o&&(h.people=sr(t,s));let v=c.build();if(v){let e=new d(v,n);e.castShadow=!0,e.receiveShadow=!0,e.name=`park-setpieces`,t.add(e),h.mesh=e}return h}function $n(){let e=new b({color:9413296,roughness:.1,metalness:.2});return e.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,Sn).replace(`#include <uv_vertex>`,Nn),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,Ln).replace(`#include <map_fragment>`,Rn).replace(`#include <roughnessmap_fragment>`,zn).replace(`#include <emissivemap_fragment>`,Bn)},e.customProgramCacheKey=()=>`park-glassroof-v4`,e}function er(e,t){let n=V.find(e=>e.name===`reservoir`);if(!n)return;let r=n.pts.length,i=n.pts.map(([e,t],i)=>{let[a,o]=n.pts[(i+r-1)%r],[s,c]=n.pts[(i+1)%r],l=s-a,u=c-o,d=Math.hypot(l,u)||1;l/=d,u/=d;let f=u,p=-l;return f*(e-n.cx)+p*(t-n.cz)<0&&(f=-f,p=-p),[f,p]}),o=(e,t)=>[n.pts[e][0]+i[e][0]*t,n.pts[e][1]+i[e][1]*t];{let t=[],i=[],s=[],c=[],l=X+.008,u=0;for(let e=0;e<=r;e++){let a=e%r,d=o(a,0),f=o(a,1.1);if(e&&(u+=Math.hypot(n.pts[a][0]-n.pts[e-1][0],n.pts[a][1]-n.pts[e-1][1])),t.push(d[0],l,d[1],f[0],l,f[1]),i.push(0,1,0,0,1,0),s.push(0,u,1,u),e){let t=e*2;c.push(t-2,t-1,t+1,t-2,t+1,t)}}let f=new _;f.setAttribute(`position`,new a(t,3)),f.setAttribute(`normal`,new a(i,3)),f.setAttribute(`uv`,new a(s,2)),f.setIndex(c);let p=f.index.array,m=f.attributes.position.array;for(let e=0;e<p.length;e+=3){let t=p[e]*3,n=p[e+1]*3,r=p[e+2]*3;if((m[n+2]-m[t+2])*(m[r]-m[t])-(m[n]-m[t])*(m[r+2]-m[t+2])<0){let t=p[e+1];p[e+1]=p[e+2],p[e+2]=t}}let h=new b({color:6907487,roughness:.9,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-2});h.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <map_fragment>`,Vn).replace(`#include <common>`,Hn),e.vertexShader=e.vertexShader.replace(`#include <common>`,Un).replace(`#include <uv_vertex>`,Cn)},h.customProgramCacheKey=()=>`park-coping-v1`;let g=new d(f,h);g.receiveShadow=!0,g.name=`reservoir-coping`,e.add(g)}{let n=[];for(let e=0;e<r;e++)n.push(o(e,3.6));let i=[],s=0;for(let e=0;e<r;e++){let t=n[e],a=n[(e+1)%r],o=Math.hypot(a[0]-t[0],a[1]-t[1]);for(;s<o;s+=2.6)i.push([t[0]+(a[0]-t[0])*s/o,t[1]+(a[1]-t[1])*s/o]);s-=o}let c=[],l=[],u=(e,t,n,r,i)=>{let a=c.length/3;c.push(e[0],n,e[1],t[0],n,t[1],t[0],r,t[1],e[0],r,e[1]),l.push(a,a+1,a+2,a,a+2,a+3)},f=1.9;for(let e=0;e<i.length;e++){let[n,r]=i[e],a=.045,o=[[n-a,r-a],[n+a,r-a],[n+a,r+a],[n-a,r+a]];for(let e=0;e<4;e++)u(o[e],o[(e+1)%4],X,X+f+.08,0);t?.cyl(n,r,X,X+f+.08,a,a,`equipment`);let[s,c]=i[(e+1)%i.length];for(let[e,t]of[[X+.05,X+.11],[X+.95,X+1],[X+f-.06,X+f]])u([n,r],[s,c],e,t,0);for(let e=1;e<6;e++){let t=e/6,i=n+(s-n)*t,a=r+(c-r)*t;u([i-.012,a],[i+.012,a],X+.08,X+f-.03,0),u([i,a-.012],[i,a+.012],X+.08,X+f-.03,0)}}let p=new _;p.setAttribute(`position`,new a(c,3)),p.setIndex(l),p.computeVertexNormals();let m=new b({color:1776924,roughness:.6,metalness:.4,side:2}),h=new d(p,m);h.castShadow=!0,h.receiveShadow=!0,h.name=`reservoir-fence`,e.add(h)}}function tr(e,t,n){let r=B.PARK,i=.45,a=B.CURB_H,o=.1,s={style:U.BLANK,layer:H.GRANITE,tint:[.5,.48,.45],seed:41},c={style:U.BLANK,layer:H.LIME,tint:[.84,.82,.77],seed:42},l=(e,r,i,l,u)=>{let d=a+1+u,f=d+.12;t.box(e-o,a,r-o,i+o,d,l+o,s,{},!1),t.box(e-o-.06,d,r-o-.06,i+o+.06,f,l+o+.06,c,{},!0,!0),n?.box(e-o,a,r-o,i+o,d,l+o,`park`),n?.box(e-o-.06,d,r-o-.06,i+o+.06,f,l+o+.06,`park`)},u=[-150,-60,60,150];for(let[e,t]of[[r.z1-i,r.z1],[r.z0,r.z0+i]]){let n=r.x0;for(let i of[...u,r.x1+100]){let a=Math.min(i-3,r.x1);a>n&&l(n,e,a,t,0),n=i+3}}let f=[];for(let e of[r.x0,r.x1-i])for(let t=r.z1-i;t>r.z0+i+1;t-=160){let n=Math.max(r.z0+i,t-150);l(e,n,e+i,t,.014),f.push([e,n,t])}let p=new W,m=I(911);for(let[e,t,s]of f){let c=e===r.x0,l=c?e-o:e+i+o,u=c?-1:1;for(let e=t+6;e+2<s-4;e+=6.5+m()*3){if(m()<.3)continue;let t=e,r=e+1.9,i=e=>l+u*e,o=(e,t)=>[Math.min(i(e),i(t)),Math.max(i(e),i(t))],s=a;p.setColor([.02,.022,.02]);for(let e of[t,r-.06]){let[t,r]=o(.08,.66);p.box(t,s,e,r,s+.47,e+.06),n?.box(t,s,e,r,s+.47,e+.06,`equipment`);let[i,a]=o(.05,.14);p.box(i,s+.47,e,a,s+.92,e+.06),n?.box(i,s+.47,e,a,s+.92,e+.06,`equipment`)}p.setColor([.05,.075,.045]);for(let e=0;e<4;e++){let[n,i]=o(.16+e*.125,.26+e*.125);p.box(n,s+.42,t+.06,i,s+.46,r-.06)}{let[e,i]=o(.14,.66);n?.box(e,s+.42,t+.06,i,s+.46,r-.06,`equipment`)}for(let e=0;e<3;e++){let[n,i]=o(.08,.12);p.box(n,s+.55+e*.13,t+.06,i,s+.64+e*.13,r-.06)}{let[e,i]=o(.08,.12);n?.box(e,s+.55,t+.06,i,s+.9,r-.06,`equipment`)}}}let h=p.build();if(h){let t=new d(h,new b({vertexColors:!0,roughness:.7}));t.castShadow=!0,t.receiveShadow=!0,t.name=`park-wall-benches`,e.add(t)}}function nr(e,t,n=null){let r=[],i=[],o=[],s=new W;s.setColor([.05,.05,.05]);let c=X,l=(e,n,a)=>{let l=Math.hypot(n[0]-e[0],n[1]-e[1]);if(l<.1)return;let u=r.length/3;r.push(e[0],c,e[1],n[0],c,n[1],n[0],c+a,n[1],e[0],c+a,e[1]),i.push(0,0,l,0,l,a,0,a),o.push(u,u+1,u+2,u,u+2,u+3),s.tube([e[0],c+a-.02,e[1]],[n[0],c+a-.02,n[1]],.02,4);let d=Math.max(1,Math.round(l/.25));for(let r=0;r<=d;r++){let i=r/d;t?.cyl(e[0]+(n[0]-e[0])*i,e[1]+(n[1]-e[1])*i,c,c+a,.02,.02,`pole`)}},u=(e,n,r)=>{s.cyl(e,c,n,.045,.045,r+.08,6,!0,!1),t?.cyl(e,n,c,c+r+.08,.045,.045,`pole`)};for(let e=1;e<3;e++)for(let t=0;t<4;t++){if(e===2&&(t===1||t===2))continue;let r=G[e],i=e*4+t,a=[r.x+((t&1)*2-1)*r.rx*(.55+.08*Math.sin(i*2.3)),r.z+((t>>1)*2-1)*r.rz*(.5+.08*Math.cos(i*1.7))],o=r.x-a[0],s=r.z-a[1],c=Math.hypot(o,s);o/=c,s/=c;let d=.35*Math.sin(i*3.1+.4),f=Math.cos(d),p=Math.sin(d);[o,s]=[o*f-s*p,o*p+s*f];let m=Math.atan2(s,o)+Math.PI,h=[];for(let e=0;e<=8;e++){let t=m+(e/8-.5)*2.3;h.push([a[0]+Math.cos(t)*7,a[1]+Math.sin(t)*7])}for(let e=0;e<8;e++)l(h[e],h[e+1],5);for(let e of h)u(e[0],e[1],5);if(n){let e=m+(i&1?1:-1)*1.55,t=a[0]+Math.cos(e)*10.5,r=a[1]+Math.sin(e)*10.5,o=Math.abs(Math.cos(e))<Math.abs(Math.sin(e)),s=o?0:Math.sign(Math.cos(e)),c=o?Math.sign(Math.sin(e)):0,l={style:U.BLANK,layer:H.METAL,tint:[1.55,1.57,1.6],seed:62},u=3.6;for(let e=0;e<3;e++){let i=e*.7,a=X+.42+e*.38,d=t+s*i,f=r+c*i,[p,m]=o?[u,.36]:[.36,u];n(d-p,X-.05,f-m,d+p,a,f+m,e?l:{...l,tint:[1.2,1.22,1.25]},{},!0,null,`park`)}}for(let e of[-1,1]){let t=Math.atan2(s,o)+e*Math.PI/4,r=Math.cos(t),c=Math.sin(t),d=-c*e,f=r*e,p=[a[0]+r*2+d*6,a[1]+c*2+f*6],m=[a[0]+r*22+d*6,a[1]+c*22+f*6],g=h[e<0?8:0];l(g,p,1.3);for(let e=0;e<4;e++)l([p[0]+(m[0]-p[0])*e/4,p[1]+(m[1]-p[1])*e/4],[p[0]+(m[0]-p[0])*(e+1)/4,p[1]+(m[1]-p[1])*(e+1)/4],1.3);for(let e=0;e<=4;e++)u(p[0]+(m[0]-p[0])*e/4,p[1]+(m[1]-p[1])*e/4,1.3);if(n){let e=a[0]+r*10+d*8.2,t=a[1]+c*10+f*8.2,o=Math.abs(r)>Math.abs(c),s=3.2,l=.9,u={style:U.BLANK,layer:H.CONCRETE,tint:[.8,.79,.76],seed:60+i},p={style:U.BLANK,layer:H.METAL,tint:[.55,.62,.58],seed:61},[m,h]=o?[s,l]:[l,s],g=o?0:(d>0?1:-1)*.75,_=o?(f>0?1:-1)*.75:0;n(e+g-(o?m:.15),X-.05,t+_-(o?.15:h),e+g+(o?m:.15),X+2.1,t+_+(o?.15:h),u,{},!0,null,`park`),n(e-m-.2,X+2.1,t-h-.2,e+m+.2,X+2.26,t+h+.2,p,{},!0,null,`park`);for(let r of[-1,1])n(o?e+r*m-.12:e-m,X-.05,o?t-h:t+r*h-.12,o?e+r*m+.12:e+m,X+2.1,o?t+h:t+r*h+.12,u,{},!0,null,`park`);n(e-m*(o?.9:.4),X+.4,t-h*(o?.4:.9),e+m*(o?.9:.4),X+.46,t+h*(o?.4:.9),{...u,tint:[.42,.3,.2]},{},!0,null,`park`)}}}let f=new _;f.setAttribute(`position`,new a(r,3)),f.setAttribute(`uv`,new a(i,2)),f.setIndex(o),f.computeVertexNormals();let p=new b({color:9080206,roughness:.5,metalness:.6,side:2,transparent:!0,depthWrite:!1});p.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,wn).replace(`#include <uv_vertex>`,Tn),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,En).replace(`#include <alphatest_fragment>`,Dn)},p.customProgramCacheKey=()=>`park-chainlink-v1`;let m=new d(f,p);m.name=`park-ballfield-fences`,m.renderOrder=3,e.add(m);let h=s.build();if(h){let t=new d(h,new b({vertexColors:!0,roughness:.6,metalness:.4}));t.castShadow=!0,t.receiveShadow=!0,t.name=`park-ballfield-posts`,e.add(t)}}function rr(e){let t=I(5151);for(let n of V){if(n.name===`reservoir`)continue;let r=n.pts.length,i=0;for(let a=0;a<r;a++){let[o,s]=n.pts[a],[c,l]=n.pts[(a+1)%r];if(i+=Math.hypot(c-o,l-s),i<5+t()*7||(i=0,t()<.35||ir(n,o,s)>.62))continue;let u=l-s,d=-(c-o),f=Math.hypot(u,d)||1;u/=f,d/=f,z(o+u*3,s+d*3)&&(u=-u,d=-d);let p=.4+t()*.14,m={style:U.BLANK,layer:H.LIME,tint:[p*.9,p*.9,p*.86],seed:70+a},h=2+Math.floor(t()*4);for(let r=0;r<h;r++){let i=-1.2+r*.9+t()*.8,a=(t()-.5)*3.5,c=o+u*i-d*a,l=s+d*i+u*a,f=.5+t()*.9,p=.25+t()*.55-r*.06;e(c-f,n.y-.4,l-f*(.6+t()*.4),c+f,X+p,l+f*(.6+t()*.4),m,{},!0,null,`park`)}}}}function ir(e,t,n){return .5+.32*Math.sin(t*.045+n*.031+e.cx)+.22*Math.sin(t*.11-n*.093+1.7)+.12*Math.sin(n*.27+t*.05)}function ar(e){let t=I(6262),n=[],r=[],i=[],o=[[.46,.42,.24],[.36,.37,.2],[.55,.47,.28],[.3,.33,.19],[.5,.38,.2],[.42,.44,.27]],s=(e,t,a,o,s,c,l,u)=>{let d=Math.cos(c),f=Math.sin(c),p=e+Math.cos(c+1.57)*s,m=a+Math.sin(c+1.57)*s,h=-f,g=d,_=u.map(e=>e*.55),v=u.map(e=>e*1.08);n.push(e-d*l,t,a-f*l,e+d*l,t,a+f*l,p,t+o,m),r.push(h,.35,g,h,.35,g,h,.6,g),i.push(..._,..._,...v)},c=0;for(let e of V){if(e.name===`reservoir`)continue;let a=e.pts.length,l=0;for(let t=0;t<a;t++){let[n,r]=e.pts[t],[i,o]=e.pts[(t+1)%a];l+=n*o-i*r}let u=l>0?1:-1;for(let l=0;l<a;l++){let[d,f]=e.pts[l],[p,m]=e.pts[(l+1)%a],h=Math.hypot(p-d,m-f);if(h<.01)continue;let g=(p-d)/h,_=(m-f)/h,v=-_*u,y=g*u;for(let a=t()*.5;a<h;a+=.35+t()*.4){let l=d+g*a,u=f+_*a,p=ir(e,l,u);if(p<.4||t()>(p-.3)*2.2)continue;let m=.8+(p-.4)*7,h=-1.5+t()*(m+1.5),b=l+v*h+(t()-.5)*.6,x=u+y*h+(t()-.5)*.6,S=!!z(b,x),C=S?e.y-.05:X-.05,w=o[Math.floor(t()*o.length)].map(e=>e*(.85+t()*.3)),T=(S?1.4:.9)+t()*.9,E=18+Math.floor(t()*14);for(let e=0;e<E;e++){let e=T*(.55+t()*.55),n=w.map(e=>e*(.85+t()*.3));s(b+(t()-.5)*1.1,C,x+(t()-.5)*1.1,e,(t()-.5)*e*.5,t()*Math.PI,.07+t()*.07,n)}if(S&&t()<.3){let e=b+(t()-.5)*.2,a=x+(t()-.5)*.2,o=C+T*1.05;for(let t of[0,1.57]){let s=Math.cos(t)*.03,c=Math.sin(t)*.03;n.push(e-s,o,a-c,e+s,o,a+c,e+s,o+.22,a+c,e-s,o,a-c,e+s,o+.22,a+c,e-s,o+.22,a-c);for(let e=0;e<6;e++)r.push(Math.sin(t),.2,-Math.cos(t)),i.push(.2,.12,.07)}}c++}}}if(!n.length)return 0;let l=new _;l.setAttribute(`position`,new a(n,3)),l.setAttribute(`normal`,new a(r,3)),l.setAttribute(`color`,new a(i,3)),l.computeBoundingSphere();let u=new b({vertexColors:!0,roughness:.85,side:2}),f=new d(l,u);return f.name=`park-reeds`,f.castShadow=!0,f.receiveShadow=!0,e.add(f),c}function or(e,t){let n=B.PARK,r=.1,i=B.CURB_H,o=I(7373),s=new W,c=new W,l=(e,n)=>{s.setColor([.03,.045,.035]),s.cyl(e,i,n,.2,.16,.55,8,!0,!1),s.cyl(e,i+.55,n,.085,.065,3.1,8,!1,!0),s.cyl(e,i+3.62,n,.13,.09,.14,8,!0,!1),s.cyl(e,i+4.3,n,.26,.05,.18,8,!0,!1),c.setColor([1,.9,.72]),c.cyl(e,i+3.76,n,.16,.24,.54,10,!0,!0),t?.cyl(e,n,i,i+4.48,.2,.2,`pole`),ur(e,i,n)},u=[];for(let e of[n.x0-r,n.x1+r])u.push({x:e+(e<0?-1.35:1.35),a:n.z0+6,b:n.z1-6,alongX:!1});for(let e of[n.z0-r,n.z1+r])u.push({z:e+(e<-1e3?-1.35:1.35),a:n.x0+6,b:n.x1-6,alongX:!0});for(let e of u)for(let t=e.a+o()*6;t<e.b;t+=17+o()*4)e.alongX?l(t,e.z):l(e.x,t);let f=s.build();if(f){let t=new d(f,new b({vertexColors:!0,roughness:.55,metalness:.5}));t.castShadow=!0,t.receiveShadow=!0,t.name=`park-lamps`,e.add(t)}let p=c.build();if(p){let t=new d(p,dr());t.name=`park-lamp-globes`,e.add(fr(t))}let m=1.95,h=i+.004,g=[],v=[],y=(e,t,n,r)=>{let i=g.length/3;g.push(e,h,t,e,h,r,n,h,r,n,h,t),v.push(i,i+1,i+2,i,i+2,i+3)};y(n.x0-r-m,n.z0-r-m,n.x0-r,n.z1+r+m),y(n.x1+r,n.z0-r-m,n.x1+r+m,n.z1+r+m),y(n.x0-r,n.z0-r-m,n.x1+r,n.z0-r),y(n.x0-r,n.z1+r,n.x1+r,n.z1+r+m);let x=new _;x.setAttribute(`position`,new a(g,3)),x.setAttribute(`normal`,new a(Array(g.length/3).fill([0,1,0]).flat(),3)),x.setIndex(v);let S=new b({color:5723988,roughness:.9,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4});S.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,On).replace(`#include <begin_vertex>`,kn),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,An).replace(`#include <map_fragment>`,jn)},S.customProgramCacheKey=()=>`park-hexpaver-v1`;let C=new d(x,S);C.receiveShadow=!0,C.name=`park-hexpavers`,C.renderOrder=1,e.add(C)}function sr(e,t){let n=I(8181),r=new W;r.setColor([.32,.33,.38]),r.box(-.17,0,-.1,-.02,.84,.1),r.box(.02,0,-.1,.17,.84,.1),r.setColor([1,1,1]),r.box(-.22,.84,-.13,.22,1.45,.13),r.box(-.27,.9,-.07,-.22,1.42,.07),r.box(.22,.9,-.07,.27,1.42,.07);let i=new W;i.setColor([1,1,1]),i.box(-.1,1.47,-.11,.1,1.7,.11),i.box(-.035,1.43,-.035,.035,1.48,.035);let a=new W;a.setColor([1,1,1]),a.box(-.9,0,-.75,.9,.025,.75,63);let o=[15262940,1842982,3886970,9054756,6056778,13218426,8028038,13658682,3104623,12103844,4864604,14729280],s=[14727322,13146232,10119756,6964786,15781296],l=[10130566,8010288,3820138,10126416,4872778,11052186,5917274],d=[],f=[],p=X,m=(e,t,n,r,i=`lawn`)=>d.push({x:e,z:t,pose:n,ry:r,kind:i}),h=[400,150,120,60,50,50,40,60,40,50,50];G.forEach((e,t)=>{let r=h[t]??30,i=0;for(let t=0;t<r*4&&i<r;t++){let t=n()*2-1,r=n()*2-1;if(t*t+r*r>.72)continue;let a=Math.cos(e.a),o=Math.sin(e.a),s=t*e.rx,c=r*e.rz,u=e.x+s*a+c*o,d=e.z-s*o+c*a;if(z(u,d))continue;let p=1+Math.floor(n()*n()*5),h=n()*Math.PI*2;n()<.7&&f.push({x:u,z:d,ry:h,c:l[Math.floor(n()*l.length)]});for(let e=0;e<p;e++){let t=h+e*2.1+n()*.6,r=p>1?.7+n()*.4:0,i=n();m(u+Math.cos(t)*r,d+Math.sin(t)*r,i<.45?1:i<.8?2:0,t+Math.PI+(n()-.5))}i+=p}});let _=[],v=0;for(let e of t)for(let t=1;t<e.pts.length;t++){let n=Math.hypot(e.pts[t][0]-e.pts[t-1][0],e.pts[t][1]-e.pts[t-1][1]);_.push([e.pts[t-1],e.pts[t],e.w,!!e.drive,n]),v+=n}let x=Math.min(1400,Math.floor(v/14));for(let e=0;e<x&&_.length;e++){let e=n()*v,t=_[0];for(let n of _)if(e-=n[4],e<=0){t=n;break}let[r,i,a,o]=t,s=n(),c=i[0]-r[0],l=i[1]-r[1],u=Math.hypot(c,l)||1,d=o?(n()<.5?-1:1)*(a/2-.8):(n()-.5)*Math.max(0,a-1),f=r[0]+c*s-l/u*d,p=r[1]+l*s+c/u*d;if(z(f,p))continue;let h=Math.atan2(c,l)+(n()<.5?0:Math.PI);m(f,p,0,h,`path`),n()<.3&&m(f-Math.cos(h)*.6,p+Math.sin(h)*.6,0,h,`path`)}{let e=B.PARK,t=(e,t,r,i,a)=>{for(let o=e+n()*6;o<t;o+=3+n()*9){let e=r+a*(.6+n()*3.6),t=(i?Math.PI/2:0)+(n()<.5?0:Math.PI)+(n()-.5)*.3,s=n()<.62?1:n()<.8?2:3;for(let r=0;r<s;r++){let a=r*.65,c=r?(n()-.5)*.8:0,l=i?o+a:e+c,u=i?e+c:o+a;d.push({x:l,z:u,pose:0,ry:t+(r===2?Math.PI:0),y:B.CURB_H,kind:`edge`,g:s,j:r,alongX:i})}}};t(e.z0+5,e.z1-5,e.x0-.2,!1,-1),t(e.z0+5,e.z1-5,e.x1+.2,!1,1),t(e.x0+5,e.x1-5,e.z0-.2,!0,-1),t(e.x0+5,e.x1-5,e.z1+.2,!0,1)}let S=(t,n,r,i,a)=>{let o=new b({vertexColors:!0,roughness:.85}),s=new w(t,o,n.length),l=new g,d=new u,f=new y,p=new C,m=new C,h=new c;n.forEach((e,t)=>{a(e,f,p,m),d.setFromEuler(f),l.compose(p,d,m),s.setMatrixAt(t,l),h.setHex(i(e)),h.convertSRGBToLinear?.(),s.setColorAt(t,h)}),s.instanceMatrix.needsUpdate=!0,s.instanceColor&&(s.instanceColor.needsUpdate=!0),s.computeBoundingSphere(),s.castShadow=!0,s.receiveShadow=!0,s.name=r,e.add(s)};d.forEach(e=>{e.sh=o[Math.floor(n()*o.length)],e.sk=s[Math.floor(n()*s.length)]}),Yn.length=0;for(let e of d)e.kind!==`path`&&Yn.push({x:e.x,z:e.z,ry:e.ry,pose:e.pose,kind:e.kind,g:e.g,alongX:e.alongX,y:e.y??p});return f.length&&S(a.build(),f,`park-blankets`,e=>e.c,(e,t,n,r)=>{t.set(0,e.ry,0),n.set(e.x,p+.005,e.z),r.set(1,1,1)}),d.length}function cr(e){let t=[],r=[],i=[];for(let e of V){let n=e.pts.length,a=0;for(let t=0;t<n;t++){let[r,i]=e.pts[t],[o,s]=e.pts[(t+1)%n];a+=r*s-o*i}let o=a>0?1:-1,s=e.y+.012,c=0,l=t.length/3;for(let a=0;a<=n;a++){let l=a%n,[u,d]=e.pts[l],[f,p]=e.pts[(l+n-1)%n],[m,h]=e.pts[(l+1)%n],g=m-f,_=h-p,v=Math.hypot(g,_)||1;g/=v,_/=v,-_*o,g*o,a&&(c+=Math.hypot(u-e.pts[a-1][0],d-e.pts[a-1][1]));let y=Math.hypot(e.cx-u,e.cz-d)||1,b=Math.min(y*.5,(e.name===`reservoir`?12:11)+12*(.5+.5*Math.sin(c*.037+e.cx*.01)*Math.cos(c*.091+1.3)));if(t.push(u,s,d,u+(e.cx-u)/y*b,s,d+(e.cz-d)/y*b),r.push(0,1),a){let e=t.length/3-4;i.push(e,e+1,e+3,e,e+3,e+2)}}let u=t.length/3;t.push(e.cx,s,e.cz),r.push(1);for(let e=0;e<n;e++)i.push(l+e*2+1,l+(e+1)*2+1,u)}let o=new _;o.setAttribute(`position`,new a(t,3)),o.setAttribute(`aT`,new a(r,1)),o.setIndex(i);let s=new T({glslVersion:n,transparent:!0,depthWrite:!1,side:2,fog:!0,uniforms:S.merge([D.fog,{uTime:{value:0}}]),vertexShader:Wn,fragmentShader:Gn});s.userData.tick=e=>{s.uniforms.uTime.value+=e};let c=new d(o,s);c.name=`park-water-shallows`,c.renderOrder=2,e.add(c)}function lr(e){let t=V.find(e=>e.name===`reservoir`);if(!t)return;let n=I(7171),r=t.pts.length,i=0;for(let e=0;e<r;e++){let[n,a]=t.pts[e],[o,s]=t.pts[(e+1)%r];i+=n*s-o*a}let a=i>0?1:-1;for(let i=0;i<r;i++){let[o,s]=t.pts[i],[c,l]=t.pts[(i+1)%r],u=Math.hypot(c-o,l-s);if(u<.01)continue;let d=(c-o)/u,f=(l-s)/u,p=-f*a,m=d*a;for(let r=n()*1.2;r<u;r+=1+n()*1.1){if(Math.sin((o+d*r)*.05)*Math.cos((s+f*r)*.043)+.4*Math.sin((o+s)*.13+r)<-.55&&n()<.8)continue;let a=1+Math.floor(n()*2);for(let c=0;c<a;c++){let a=.2+n()*1.6,c=(n()-.5)*.8,l=o+d*(r+c)+p*a,u=s+f*(r+c)+m*a,h=.35+n()*.45,g=t.y+.1+n()*.5-a*.08,_=.36+n()*.16;e(l-h,t.y-.5,u-h*(.6+n()*.4),l+h,Math.min(g,X-.08),u+h*(.6+n()*.4),{style:U.BLANK,layer:H.LIME,tint:[_*.92,_*.92,_*.9],seed:80+(i&7)},{},!0,null,`park`)}}}}function ur(e,t,n){k.add({type:`point`,pos:[e,t+4.03,n],color:16766624,intensity:20,range:14,radius:.35,volume:.35})}function dr(){return new b({vertexColors:!0,roughness:.2,emissive:16769712,emissiveIntensity:.35,transparent:!0,opacity:.9})}var fr=e=>(e.onBeforeRender=()=>{e.material.emissiveIntensity=.35+1.6*A.value},e);function pr(e,t,n,r,i,a){ur(r,i,a),e.setColor([.03,.045,.035]),e.cyl(r,i,a,.2,.16,.55,8,!0,!1),e.cyl(r,i+.55,a,.085,.065,3.1,8,!1,!0),e.cyl(r,i+3.62,a,.13,.09,.14,8,!0,!1),e.cyl(r,i+4.3,a,.26,.05,.18,8,!0,!1),t.setColor([1,.9,.72]),t.cyl(r,i+3.76,a,.16,.24,.54,10,!0,!0),n?.cyl(r,a,i,i+4.48,.2,.2,`pole`)}function mr(e,t,n){let r=I(9393),i=new W,o=new W,s=X,c=(e,t)=>z(e,t)||z(e+1.5,t)||z(e-1.5,t)||z(e,t+1.5)||z(e,t-1.5),l=(e,t)=>Jn.some(([n,r,i])=>(n-e)**2+(r-t)**2<(i+1.5)**2),u=qn.met,f=(e,t)=>e>u.x0-3&&e<u.x1+8&&t>u.z0-3&&t<u.z1+3,p=0,m=0,h=(e,n,r,a)=>{let o=1.9,c=r?o/2:.33,l=r?.33:o/2;i.setColor([.02,.022,.02]);for(let a of[-1,1]){let u=r?e+a*(o/2-.05):e,d=r?n:n+a*(o/2-.05),f=r?[u-.03,d-l]:[u-c,d-.03],p=r?[u+.03,d+l]:[u+c,d+.03];i.box(f[0],s,f[1],p[0],s+.45,p[1]),t?.box(f[0],s,f[1],p[0],s+.45,p[1],`equipment`)}i.setColor([.05,.075,.045]),i.box(e-c,s+.42,n-l,e+c,s+.47,n+l),t?.box(e-c,s+.42,n-l,e+c,s+.47,n+l,`equipment`);let u=r?[e-c,e+c]:a>0?[e+c-.06,e+c]:[e-c,e-c+.06],d=r?a>0?[n+l-.06,n+l]:[n-l,n-l+.06]:[n-l,n+l];i.box(u[0],s+.47,d[0],u[1],s+.92,d[1]),t?.box(u[0],s+.47,d[0],u[1],s+.92,d[1],`equipment`),m++},g=[],v=[];for(let e of n){let n=e.pts;if(e.drive){let t=e.w/2-.3,r=Kn+.004;for(let e=0;e<n.length;e++){let i=n[Math.max(0,e-1)],a=n[Math.min(n.length-1,e+1)],o=a[0]-i[0],s=a[1]-i[1],c=Math.hypot(o,s)||1;o/=c,s/=c;let l=g.length/3;g.push(n[e][0]-s*t,r,n[e][1]+o*t,n[e][0]+s*t,r,n[e][1]-o*t),e&&v.push(l-2,l-1,l+1,l-2,l+1,l)}}let a=r()*20,u=r()*30;for(let d=1;d<n.length;d++){let[m,g]=n[d-1],[_,v]=n[d],y=Math.hypot(_-m,v-g);if(y<.01)continue;let b=(_-m)/y,x=(v-g)/y;for(let n=0;n<y;n+=2){a+=Math.min(2,y-n),u+=Math.min(2,y-n);let d=m+b*n,_=g+x*n;if(a>(e.drive?46:e.minor?70:32)+r()*8){let n=r()<.5?-1:1,u=e.w/2+.75,m=d-x*u*n,h=_+b*u*n;c(m,h)||l(m,h)||f(m,h)||(pr(i,o,t,m,s,h),p++,a=0)}if(!e.drive&&u>40+r()*20){let t=Math.abs(b)>.97,n=Math.abs(x)>.97;if(t||n){let i=r()<.5?-1:1,a=e.w/2+.55,o=d-x*a*i,s=_+b*a*i,p=Math.sign(t?b*i:-x*i);if(!c(o,s)&&!l(o,s)&&!f(o,s)){h(o,s,t,p);let e=o+(t?2.6:0),i=s+(n?2.6:0);r()<.6&&!c(e,i)&&h(e,i,t,p),u=0}}}}}}let y=V.find(e=>e.name===`reservoir`);if(y){let e=y.pts.length,n=0;for(let r=0;r<e;r++){let[a,l]=y.pts[r],[u,d]=y.pts[(r+1)%e];if(n+=Math.hypot(u-a,d-l),n<30)continue;n=0;let f=a-y.cx,m=l-y.cz,h=Math.hypot(f,m)||1;f/=h,m/=h;let g=a+f*12.5,_=l+m*12.5;c(g,_)||(pr(i,o,t,g,s,_),p++)}}let x=i.build();if(x){let t=new d(x,new b({vertexColors:!0,roughness:.6,metalness:.4}));t.castShadow=!0,t.receiveShadow=!0,t.name=`park-path-furniture`,e.add(t)}let S=o.build();if(S){let t=new d(S,dr());t.name=`park-path-globes`,e.add(fr(t))}if(g.length){let t=new _;t.setAttribute(`position`,new a(g,3)),t.setAttribute(`normal`,new a(Array(g.length/3).fill([0,1,0]).flat(),3)),t.setIndex(v);let n=t.index.array,r=t.attributes.position.array;for(let e=0;e<n.length;e+=3){let t=n[e]*3,i=n[e+1]*3,a=n[e+2]*3;if((r[i+2]-r[t+2])*(r[a]-r[t])-(r[i]-r[t])*(r[a+2]-r[t+2])<0){let t=n[e+1];n[e+1]=n[e+2],n[e+2]=t}}let i=new b({color:5065544,roughness:.92,transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-4});i.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,Mn).replace(`#include <begin_vertex>`,Pn),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,Fn).replace(`#include <map_fragment>`,In)},i.customProgramCacheKey=()=>`park-drive-v1`;let o=new d(t,i);o.receiveShadow=!0,o.renderOrder=1,o.name=`park-drives`,e.add(o)}return{lamps:p,benches:m}}var hr=`#include <common>
__SHADER_INJECT_0__`,gr=`#include <project_vertex>
__SHADER_INJECT_0__`,_r=`#include <common>
__SHADER_INJECT_0__`,vr=`#include <clipping_planes_fragment>
__SHADER_INJECT_0__`,yr=`#include <common>
out float vDistFade;`,br=`#include <project_vertex>\r
        { vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz; vDistFade = clamp((__SHADER_INJECT_0__ - length(wp.xz - cameraPosition.xz)) / __SHADER_INJECT_1__, 0.0, 1.0); }`,xr=`#include <common>\r
      in float vDistFade; uniform vec4 uLodFrame;\r
      float dfIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`,Sr=`#include <clipping_planes_fragment>\r
        if (vDistFade < 0.999 && fract(dfIGN(gl_FragCoord.xy + 7.0) + uLodFrame.x * 1.618034) >= vDistFade) discard;`,Cr=`in vec4 aLod; out float vLodIn; out float vLodOut;
`,wr=`
  #ifdef USE_INSTANCING
  {
    vec3 lodP = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
    float lodD = length(lodP.xz - cameraPosition.xz);
    vLodIn = aLod.y > aLod.x ? clamp((lodD - aLod.x) / (aLod.y - aLod.x), 0.0, 1.0) : 1.0;
    vLodOut = aLod.w > aLod.z ? clamp((aLod.w - lodD) / (aLod.w - aLod.z), 0.0, 1.0) : 1.0;
  }
  #else
  vLodIn = 1.0; vLodOut = 1.0;
  #endif
`,Tr=`in float vLodIn; in float vLodOut; uniform vec4 uLodFrame;
  float lodIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`,Er=`{
    float lodN = fract(lodIGN(gl_FragCoord.xy) + uLodFrame.x * 1.618034);
    if (lodN >= vLodOut || lodN < 1.0 - vLodIn) discard;
  }
`,Dr=ge(`nowedge`),Or=Cr,kr=wr,Ar=Tr,jr=Er;function Mr(e){if(!e||e.userData.lodFade)return e;e.userData.lodFade=!0;let t=e.onBeforeCompile,n=e.customProgramCacheKey;return e.onBeforeCompile=(n,r)=>{t?.call(e,n,r),n.uniforms.uLodFrame={value:j.params},n.vertexShader=n.vertexShader.replace(`#include <common>`,O(hr,Or)).replace(`#include <project_vertex>`,O(gr,kr)),n.fragmentShader=n.fragmentShader.replace(`#include <common>`,O(_r,Ar)).replace(`#include <clipping_planes_fragment>`,O(vr,jr))},e.customProgramCacheKey=()=>(n?n.call(e):``)+`|lodfade1`,e.needsUpdate=!0,e}var Nr=new g,Pr=new u,Fr=new C,Ir=new C,Lr=new y,Rr=new WeakMap,zr=class e{static sortF2B=!new URLSearchParams(location.search).has(`nof2b`);static sortMax=2e4;constructor(e,n,{max:r=1024,near:i=0,far:a=400,castShadow:o=!0,receiveShadow:s=!0,extra:c={},color:l=!1,name:u=``,fadeIn:d=0,fadeOut:f=null,isStatic:p=!1,shadowFar:m=null,smallCasters:g=!1}={}){this.geo=e,this.mat=n,this.max=r,this.near=i,this.far=a,this.fadeIn=i>0?d||Math.max(10,i*.08):0,this.fadeOut=f??Math.max(10,a*.08),this.isStatic=p,this.shadowFar=Math.min(a,m??160),this.nShadow=0,c={...c,aLod:4},Mr(n),this.items=[],this.extraDefs=c,this.mesh=new w(e,n,r),this.mesh.name=u,this.mesh.count=0,this.mesh.frustumCulled=!1,this.mesh.castShadow=o,this.mesh.receiveShadow=s,g&&(this.mesh.userData.smallCasters=!0);let _=0;this.mesh.onBeforeShadow=()=>{_=this.mesh.count,this.mesh.count=Math.min(_,this.nShadow)},this.mesh.onAfterShadow=()=>{this.mesh.count=_},this.mesh.instanceMatrix.setUsage(t),l&&(this.mesh.instanceColor=new h(new Float32Array(r*3),3),this.mesh.instanceColor.setUsage(t)),this.extra={};for(let[n,i]of Object.entries(c)){let a=new h(new Float32Array(r*i),i);a.setUsage(t),e.setAttribute(n,a),this.extra[n]=a}this.last=new C(1e9,0,0),this.sel=new Int32Array(r)}add(e,t,n,r=0,i=1,a=null,o=null,s=null){let c={x:e,y:t,z:n,ry:r,s:i,color:a,extra:o,scale3:s};return this.items.push(c),c}hide(e){e.hidden=!0,this.last.set(1e9,0,0),this.written=-1}show(e){e.hidden=!1,this.last.set(1e9,0,0),this.written=-1}write(e,t){let n=this.extra.aLod;if(n&&n.setXYZW(e,this.near-this.fadeIn,this.near,this.far-this.fadeOut,this.far),Fr.set(t.x,t.y,t.z),Pr.setFromAxisAngle(E.DEFAULT_UP,t.ry),(t.rx||t.rz)&&(Lr.set(t.rx||0,t.ry,t.rz||0,`YXZ`),Pr.setFromEuler(Lr)),t.scale3?Ir.set(t.scale3[0]*t.s,t.scale3[1]*t.s,t.scale3[2]*t.s):Ir.set(t.s,t.s,t.s),t.hidden&&Ir.set(0,0,0),Nr.compose(Fr,Pr,Ir),this.mesh.setMatrixAt(e,Nr),t.color&&this.mesh.instanceColor&&this.mesh.instanceColor.setXYZ(e,t.color[0],t.color[1],t.color[2]),t.extra)for(let n in t.extra){let r=this.extra[n];if(!r)continue;let i=t.extra[n];r.itemSize===1?r.setX(e,i):r.array.set(i,e*r.itemSize)}}buildGrid(){let e=Rr.get(this.items);if(e&&e.n===this.items.length&&!this.dirty){this.grid=e.g,this.gridN=e.n;return}let t=new Map;for(let e=0;e<this.items.length;e++){let n=this.items[e],r=Math.floor(n.x/64)*100003+Math.floor(n.z/64),i=t.get(r);i||t.set(r,i=[]),i.push(e)}this.grid=t,this.gridN=this.items.length,this.dirty=!1,Rr.set(this.items,{g:t,n:this.items.length})}due(e){return this.isStatic?this.written!==this.items.length||this.dirty:e.distanceToSquared(this.last)>=this.thresh()**2||this.viewDue()}viewDue(){let e=j.view;if(Dr||!e||!this.far||this.far<=this.shadowFar)return!1;let t=e.cos>-1;return t!==!!this.vOn||t&&e.x*this.vx+e.z*this.vz<.94}thresh(){return Math.max(6,Math.min(40,this.far*.02))}update(t,n=!1,r=this.thresh()){if(this.isStatic){if(this.written===this.items.length&&!n&&!this.dirty)return;let e=Math.min(this.max,this.items.length);for(let t=0;t<e;t++)this.write(t,this.items[t]);this.mesh.count=e,this.nShadow=this.shadowFar>=this.far?e:0,this.written=this.items.length,this.dirty=!1,this.mesh.visible=e>0,this.upload(e);return}if(!n&&t.distanceToSquared(this.last)<r*r&&!this.viewDue())return;this.last.copy(t);let i=j.view,a=!Dr&&!!i&&i.cos>-1&&this.far>this.shadowFar;this.vOn=a,a&&(this.vx=i.x,this.vz=i.z);let o=a?i.cos:-2,s=a?i.x:0,c=a?i.z:0,l=(this.shadowFar+r)**2;(!this.grid||this.dirty||this.gridN!==this.items.length)&&this.buildGrid();let u=Math.max(0,this.near-this.fadeIn-r),d=this.far+r,f=u*u,p=d*d,m=0,h=this.items,g=[],_=Math.ceil(d/64),v=Math.floor(t.x/64),y=Math.floor(t.z/64);for(let e=v-_;e<=v+_;e++)for(let n=y-_;n<=y+_;n++){let r=this.grid.get(e*100003+n);if(r)for(let e of r){let n=h[e],r=n.x-t.x,i=n.z-t.z,a=r*r+i*i;a>=f&&a<p&&(a<l||r*s+i*c>=o*Math.sqrt(a))&&g.push(e,a)}}let b=(this.shadowFar+r)**2;if(g.length/2>this.max){let e=[];for(let t=0;t<g.length;t+=2)e.push(t);e.sort((e,t)=>g[e+1]-g[t+1]);let t=0;for(let n=0;n<this.max;n++)g[e[n]+1]<b&&(t=n+1),this.write(m++,h[g[e[n]]]);this.nShadow=t}else if(e.sortF2B&&g.length/2<=e.sortMax){let t=g.length>>1,n=e._key&&e._key.length>=t?e._key:e._key=new Float64Array(Math.max(t,4096)),r=0;for(let e=0;e<t;e++){let t=g[2*e+1],i=t<b;i&&r++,n[e]=(Math.floor(t)*2+ +!i)*1048576+e}let i=n.subarray(0,t).sort();for(let e=0;e<t;e++)this.write(m++,h[g[2*(i[e]%1048576)]]);this.nShadow=r}else{for(let e=0;e<g.length;e+=2)g[e+1]<b&&this.write(m++,h[g[e]]);this.nShadow=m;for(let e=0;e<g.length;e+=2)g[e+1]>=b&&this.write(m++,h[g[e]])}this.mesh.count=m,this.mesh.visible=m>0,this.upload(m)}upload(e){if(!e)return;let t=(t,n)=>{t.clearUpdateRanges(),t.addUpdateRange(0,e*n),t.needsUpdate=!0};t(this.mesh.instanceMatrix,16),this.mesh.instanceColor&&t(this.mesh.instanceColor,3);for(let e of Object.values(this.extra))t(e,e.itemSize)}};function Br(e,t,n){if(!e||e.userData.distFade)return e;e.userData.distFade=!0;let r=e.onBeforeCompile,i=e.customProgramCacheKey;return e.onBeforeCompile=(i,a)=>{r?.call(e,i,a),i.uniforms.uLodFrame=i.uniforms.uLodFrame||{value:j.params},i.vertexShader=i.vertexShader.replace(`#include <common>`,yr).replace(`#include <project_vertex>`,O(br,n.toFixed(1),(n-t).toFixed(1))),i.fragmentShader=i.fragmentShader.replace(`#include <common>`,xr).replace(`#include <clipping_planes_fragment>`,Sr)},e.customProgramCacheKey=()=>(i?i.call(e):``)+`|distfade${t}-${n}`,e.needsUpdate=!0,e}var Vr=`#include <common>\r
      in vec4 aBark; out vec4 vBark; out vec2 vBUv;`,Hr=`#include <begin_vertex>\r
      vBark = aBark; vBUv = uv;`,Ur=`#include <common>\r
      uniform highp sampler2DArray tBarkC; uniform highp sampler2DArray tBarkN; in vec4 vBark; in vec2 vBUv;`,Wr=`\r
        vec3 bkUv = vec3(vBUv, floor(vBark.x + 0.5));\r
        vec4 bkC = texture(tBarkC, bkUv);\r
        diffuseColor.rgb *= bkC.rgb * vBark.yzw;`,Gr=`#include <normal_fragment_maps>\r
        { // bark normal map in the derivative tangent frame (no tangent attribute)\r
          vec3 mapN = texture(tBarkN, bkUv).xyz * 2.0 - 1.0; mapN.xy *= 1.35;\r
          vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);\r
          vec2 st0 = dFdx(vBUv), st1 = dFdy(vBUv);\r
          vec3 q1p = cross(q1, normal), q0p = cross(normal, q0);\r
          vec3 Tt = q1p * st0.x + q0p * st1.x, Bt = q1p * st0.y + q0p * st1.y;\r
          float det = max(dot(Tt, Tt), dot(Bt, Bt));\r
          float sc = det == 0.0 ? 0.0 : inversesqrt(det);\r
          normal = normalize(Tt * (mapN.x * sc) + Bt * (mapN.y * sc) + normal * mapN.z);\r
        }`,Kr=`#include <common>
in vec2 aHw; out vec2 vHw; out vec3 vHwP;`,qr=`#include <fog_vertex>
vHw = aHw; vHwP = (modelMatrix * vec4(transformed, 1.0)).xyz;`,Jr=`#include <common>\r
      uniform sampler2D tCol; uniform sampler2D tNoise; uniform sampler2D tMacro; in vec2 vHw; in vec3 vHwP; float hwR = 0.85;\r
      float band(float u, float c, float hw, float aa) { return 1.0 - smoothstep(hw - aa, hw + aa, abs(u - c)); }\r
      void highway(out vec3 highwayColor) {\r
        float u = vHw.x, v = vHw.y;\r
        float lineAA = max(fwidth(u), 1e-3);\r
        vec2 p = vHwP.xz;\r
        vec3 c = texture(tCol, p / 6.0).rgb * 0.92;\r
        vec3 m = texture(tMacro, p / 70.0).rgb; vec3 nz = texture(tNoise, p / 53.0).rgb;\r
        c *= (0.84 + 0.3 * m.r) * (0.93 + 0.14 * nz.r);\r
        float dist = length(vHwP - cameraPosition);\r
        // tyre tracks per lane (darker), slightly lighter lane centres\r
        float l = mod(u - __SHADER_INJECT_0__, __SHADER_INJECT_1__) - __SHADER_INJECT_2__;\r
        c *= 1.0 - 0.12 * exp(-pow((abs(l) - 0.85) / 0.3, 2.0));\r
        c *= mix(1.0, 0.7, smoothstep(90.0, 700.0, dist)); // aerial LOD tone like the street asphalt\r
        hwR = 0.85;\r
        float W = __SHADER_INJECT_3__, SH = __SHADER_INJECT_4__, LN = __SHADER_INJECT_5__, MD = __SHADER_INJECT_6__;\r
        float m0 = SH + 3.0 * LN, m1 = m0 + MD;\r
        // planted median: kerbed strip with grass / soil\r
        if (u > m0 + 0.25 && u < m1 - 0.25) {\r
          vec3 g = mix(vec3(0.16, 0.18, 0.1), vec3(0.2, 0.18, 0.13), texture(tNoise, p / 7.0).g);\r
          hwR = 0.95; highwayColor = g * (0.85 + 0.3 * nz.b); return;\r
        }\r
        if (u > m0 && u < m1) { hwR = 0.8; highwayColor = vec3(0.46, 0.45, 0.42) * (0.9 + 0.2 * nz.g); return; } // kerb\r
        float wear = 0.75 + 0.25 * smoothstep(0.3, 0.7, texture(tNoise, p / 3.1).r);\r
        float paint = 0.0; vec3 pc = vec3(0.86, 0.86, 0.83);\r
        // solid white edge lines\r
        paint += band(u, SH - 0.1, 0.075, lineAA) + band(u, W - SH + 0.1, 0.075, lineAA);\r
        // dashed lane lines (3 m dash, 9 m gap)\r
        float dash = step(mod(v, 12.0), 3.0);\r
        for (int j = 1; j < 3; j++) { paint += dash * (band(u, SH + float(j) * LN, 0.06, lineAA) + band(u, m1 + float(j) * LN, 0.06, lineAA)); }\r
        paint = clamp(paint, 0.0, 1.0);\r
        // double yellow along the median kerbs\r
        float yl = band(u, m0 - 0.2, 0.055, lineAA) + band(u, m1 + 0.2, 0.055, lineAA);\r
        c = mix(c, pc * 0.85, paint * wear * 0.85);\r
        c = mix(c, vec3(0.72, 0.55, 0.16) * 0.85, clamp(yl, 0.0, 1.0) * wear * 0.85);\r
        hwR = mix(0.9, 0.6, paint);\r
        // gutters\r
        c *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.6, u)) - 0.2 * (1.0 - smoothstep(0.0, 0.6, W - u));\r
        highwayColor = c;\r
      }`,Yr=`vec3 highwayColor; highway(highwayColor); diffuseColor.rgb = highwayColor;`,Xr=`float roughnessFactor = hwR;`,Zr=`#include <common>
in float vVehY; in float vVehAO;`,Qr=`diffuseColor.rgb = min(diffuseColor.rgb * vec3(0.27, 0.285, 0.3), vec3(0.12)); pR = 0.07;`,$r=`#include <lights_physical_pars_fragment>\r
        #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )\r
        vec3 vehHorizon(vec3 viewDir, vec3 n, float rough) {\r
          vec3 r = transformDirectionByInverseViewMatrix(reflect(-viewDir, n), viewMatrix);\r
          float h = r.y;\r
          vec3 sky = textureCubeUV(envMap, envMapRotation * normalize(vec3(r.x, max(h, 0.1), r.z)), max(rough, 0.03)).rgb * envMapIntensity;\r
          vec3 hor = textureCubeUV(envMap, envMapRotation * normalize(vec3(r.x, 0.35, r.z)), 0.5).rgb * envMapIntensity;\r
          float id = floor(atan(r.z, r.x) * 11.0);\r
          float bt = 0.03 + 0.24 * fract(sin(id * 12.9898) * 43758.5453);   // building tops (elevation, ~2-15 deg)\r
          float e = 0.006 + rough * 0.4;\r
          float bld = 1.0 - smoothstep(bt - e, bt + e, h);\r
          float gnd = 1.0 - smoothstep(-0.04 - e, 0.0 + e, h);\r
          vec3 c = sky * 1.25;\r
          c = mix(c, hor * (0.24 + 0.1 * fract(id * 0.618)), bld);\r
          c = mix(c, hor * 0.04, gnd);\r
          return c;\r
        }\r
        #endif`,ei=`#include <lights_fragment_maps>\r
        #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV ) && defined( RE_IndirectSpecular )\r
        if (P == 3) radiance = min(mix(radiance, vehHorizon(geometryViewDir, geometryNormal, material.roughness) * 0.7, 0.85), vec3(1.1)); // (vehicles r4) no blown white sky blocks on glass from above\r
        #ifdef USE_CLEARCOAT\r
        else if (P == 1 || P == 0 || P == 15 || P == 7 || P == 8) clearcoatRadiance = mix(clearcoatRadiance, vehHorizon(geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness) * (P == 1 ? 2.1 : P == 0 ? 1.5 : 1.0), 0.9); // (vehicles r3) paint: stronger reflection read ((vehicles r4) x2.1 paint, x1.5 white bodies: director 'weak on yellow/white')\r
        #else\r
        else if (P == 1) radiance = mix(radiance, vehHorizon(geometryViewDir, geometryNormal, material.roughness), 0.5);\r
        #endif\r
        #endif`,ti=`\r
        float gk = 1.0 - smoothstep(0.16, 0.5, vVehY);              // (vehicles) grime band on the lower panels ((vehicles r3) lower + lighter: sills / arches only)\r
        float vehCC = 0.0;\r
        if (P == 1 || P == 0) { diffuseColor.rgb *= mix(vec3(1.0), vec3(0.72, 0.68, 0.62), gk * 0.7); pR = mix(P == 1 ? 0.26 : 0.45, 0.65, gk * 0.7); vehCC = (P == 1 ? 1.0 : 0.7) * (1.0 - gk * 0.6); }\r
        else if (P == 15) vehCC = 0.8;\r
        else if (P == 3) vehCC = 0.0;                                  // (vehicles r3) one glossy layer on glass (two layers = blown double sun glint)\r
        else if (P == 7 || P == 8) vehCC = 0.9;\r
        float vAOe = (P == 2 || P == 5) ? mix(vVehAO, 1.0, 0.65) : vVehAO; // (vehicles r2) baked AO (wheels sit deep in the wells: softened)\r
        diffuseColor.rgb *= mix(1.0, vAOe, 0.55);                    // cavities / wheel wells / under-body\r
        roughnessFactor = pR;`,ni=`#include <aomap_fragment>\r
        {                                                             // (vehicles r2) baked AO occludes sky light + reflections\r
          float vAOk = clamp(vAOe * 1.08, 0.0, 1.0);\r
          reflectedLight.indirectDiffuse *= vAOk;\r
          reflectedLight.indirectSpecular *= vAOk * vAOk;\r
          if (P == 3) reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(0.7)); // (vehicles r4) no blown sun glint on (rear) glass\r
          #if defined( USE_CLEARCOAT )\r
          clearcoatSpecularIndirect *= vAOk * vAOk;\r
          #endif\r
        }`,ri=`#include <lights_physical_fragment>\r
        #ifdef USE_CLEARCOAT\r
        material.clearcoat = vehCC;\r
        #endif`,ii=`out float vVehY; in float aAO; out float vVehAO; in float aSeed;
`,ai=`vVehY = position.y; vVehAO = aAO;
      #ifdef USE_MAP
      if (aPart > 14.5 && aPart < 15.5 && uv.x > 0.499) {
        const float AH = 170.0 / 2048.0;
        float k = floor(fract(aSeed * 7.31 + 0.13) * 8.0);
        vMapUv = vec2(0.5 + mod(k, 2.0) * 0.25, floor(k / 2.0) * AH) + (uv - vec2(0.5, 0.0));
      }
      #endif
`,oi=`#include <common>\r
      in float aPart; flat out float vPart; out vec3 vTintP; out float vStateP;\r
      __SHADER_INJECT_0__ __SHADER_INJECT_1__\r
      __SHADER_INJECT_2__`,si=`#include <begin_vertex>\r
      vPart = aPart; vTintP = __SHADER_INJECT_0__; vStateP = __SHADER_INJECT_1__;\r
      __SHADER_INJECT_2__`,ci=`#include <common>\r
      flat in float vPart; in vec3 vTintP; in float vStateP; uniform float uNightK;`,li=`#include <color_fragment>\r
      int P = int(vPart + 0.5);\r
      float pR = 0.7, pM = 0.0; vec3 pE = vec3(0.0);\r
      if (P == 1) { diffuseColor.rgb *= vTintP; pR = 0.32; }\r
      else if (P == 2) { pR = 0.28; pM = 1.0; }\r
      else if (P == 3) { diffuseColor.rgb = vec3(0.012, 0.014, 0.016); pR = 0.04; }\r
      else if (P == 4) { pR = 0.2; pE = diffuseColor.rgb * 0.4; }\r
      else if (P == 5) { pR = 0.92; }\r
      else if (P == 6) { pR = 0.55; }\r
      else if (P == 7) { pR = 0.08; pM = 0.6; pE = vec3(0.12); }\r
      else if (P == 8) { pR = 0.2; pE = diffuseColor.rgb * (0.3 + max(vStateP, 0.0) * 7.0); } // (night) state -1 = parked car, lamps off\r
      else if (P == 9) { pR = 0.85; }\r
      else if (P >= 10 && P <= 12) {\r
        float on = abs(float(P - 10) - vStateP) < 0.5 ? 1.0 : 0.0;\r
        vec3 lc = P == 10 ? vec3(1.0, 0.06, 0.03) : (P == 11 ? vec3(1.0, 0.5, 0.02) : vec3(0.05, 1.0, 0.45));\r
        diffuseColor.rgb = lc * 0.05; pR = 0.15; pE = lc * on * 30.0;\r
      }\r
      else if (P == 13) { vec3 lc = vStateP > 1.5 ? vec3(0.9, 0.95, 1.0) : vec3(1.0, 0.45, 0.05); diffuseColor.rgb = lc * 0.05; pE = lc * 10.0; }\r
      else if (P == 14) { pR = 0.1; pE = diffuseColor.rgb * 3.0; }\r
      else if (P == 15) { pR = 0.3; pE = diffuseColor.rgb * 0.25; }\r
      else if (P == 16) { diffuseColor.rgb *= vTintP.r > -1.0 ? vec3(1.0) : vec3(1.0); pR = 0.6; }\r
      else if (P == 17 || P == 18 || P == 19) { pR = 0.8; }\r
      else if (P == 20) { pR = 0.85; }\r
      else if (P == 21) { pR = 0.78; }\r
      else if (P == 22) { pR = 0.92; }\r
      // (daynight) lamps, headlights, tail lights, screens and taxi signs light up at night\r
      if (uNightK > 0.0) {\r
        float lampOn = vStateP < -0.5 ? 0.0 : 1.0; // (night) parked cars (traffic.js state -1): head / tail lamps dark\r
        if (P == 4) pE += (vStateP > 0.5 ? vec3(1.0, 0.56, 0.2) : vec3(1.0, 0.85, 0.66)) * 3.2 * uNightK; // (night r3) warm-white LED / sodium amber ((night r4) 9 -> 3.2: the core just clips, a small halo, not a 60 px disc) (street lamps: props.js aState)\r
        // (night r12) user: 'car lights from distance are very bright big circles, with reflections below'. The bloom halo\r
        // is a fixed size on screen while the lamp shrinks: head / tail lamps dim with distance (~1/d past 16 m), so far\r
        // cars read as small bright points (was a flat 7.0: every car a clipped disc + halo at any range)\r
        float hk = clamp(12.0 / max(length(vViewPosition), 1.0), 0.1, 1.0);\r
        if (P == 7) pE += vec3(1.0, 0.95, 0.88) * 3.5 * hk * uNightK * lampOn;\r
        else if (P == 8) pE += diffuseColor.rgb * 2.2 * max(hk, 0.35) * uNightK * lampOn;\r
        else if (P == 14 || P == 15) pE *= 1.0 + 1.5 * uNightK;\r
      }\r
      `,ui=`#include <roughnessmap_fragment>
roughnessFactor = pR;`,di=`#include <metalnessmap_fragment>
metalnessFactor = pM;`,fi=`#include <emissivemap_fragment>
totalEmissiveRadiance += pE;`,pi={BASE:0,PAINT:1,METAL:2,GLASS:3,LAMP:4,RUBBER:5,PLASTIC:6,HEAD:7,TAIL:8,FABRIC:9,SIG_R:10,SIG_Y:11,SIG_G:12,PED:13,SCREEN:14,TAXI:15,SKIN:16,SHIRT:17,PANTS:18,HAIR:19,LEAF:20,WOOD:21,CONCRETE:22};function mi({name:e=`part`,instTint:t=!0,instState:n=!1,physical:r=!1,extraVert:i=``,extraVertMain:a=``,map:o=null}={}){let s=new(r?x:b)({vertexColors:!o,map:o,roughness:.7,metalness:0});return r&&(s.clearcoat=0),s.onBeforeCompile=e=>{e.uniforms.uNightK=A,e.vertexShader=e.vertexShader.replace(`#include <common>`,O(oi,t?`attribute vec3 aTint;`:``,n?`attribute float aState;`:``,i)).replace(`#include <begin_vertex>`,O(si,t?`aTint`:`vec3(1.0)`,n?`aState`:`0.0`,a)),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,ci).replace(`#include <color_fragment>`,li).replace(`#include <roughnessmap_fragment>`,ui).replace(`#include <metalnessmap_fragment>`,di).replace(`#include <emissivemap_fragment>`,fi)},s.customProgramCacheKey=()=>`city-part-${e}-${t}-${n}`,s}var hi=e=>e%2==0?1:-1,gi=(e,t)=>{let n=(e%40+40)%40;return t===`av`?n<18?2:+(n<20):n<20?0:n<38?2:1};function _i(){let e=[...N],t=e.map(()=>B.AV_HALF),n=le,r=e.length,i=n.length,a=(e,t)=>e<0||e>=r||t<0||t>=i?-1:t*r+e,o=(e,t)=>t+1<i&&ie(e,t),s=(t,n)=>{if(t<0||t+1>=r)return!1;let i=te(n,2*(t+1));return!!i&&Math.abs(i[0]-(e[t]+B.AV_HALF))<.001&&Math.abs(i[1]-(e[t+1]-B.AV_HALF))<.001},c=[];for(let l=0;l<i;l++)for(let i=0;i<r;i++){let r=o(i,l)||l>0&&o(i,l-1)||s(i,l)||i>0&&s(i-1,l);c.push(r?{id:a(i,l),i,j:l,x:e[i],z:n[l],hw:t[i],hz:ae(l),inLinks:[],outLinks:[],av:o(i,l)||l>0&&o(i,l-1),st:s(i,l)||i>0&&s(i-1,l),drive:!1}:null)}let l=[],u=(e,t,n,r,i,a,o,s,u)=>{let d={id:l.length,from:e,to:t,ax:n,az:r,dx:i,dz:a,len:o,kind:s,axis:s===`st`||s===`ws`?`st`:`av`,lane:u,stopS:o-5,out:null,conn:new Map,cars:[],parked:null,active:!1,heading:0,cx:n+i*o/2,cz:r+a*o/2};return d.heading=Math.atan2(a,i),l.push(d),c[e].outLinks.push(d),c[t].inLinks.push(d),d};for(let c=0;c<i;c++)for(let i=0;i<r;i++){if(o(i,c)){let t=a(i,c),r=a(i,c+1),o=n[c]+ae(c),s=n[c+1]-ae(c+1),l=s-o,d=i===5&&oe(c),f=d?se.lane0:1.8,p=d?se.lane1:5.4,m=[u(t,r,e[i]-f,o,0,1,l,`av`,0),u(t,r,e[i]-p,o,0,1,l,`av`,1)],h=[u(r,t,e[i]+f,s,0,-1,l,`av`,0),u(r,t,e[i]+p,s,0,-1,l,`av`,1)];if(d)for(let e of[...m,...h])e.noPark=!0}if(s(i,c)){let r=hi(c),o=e[i]+t[i],s=e[i+1]-t[i+1],l=s-o,d=n[c]+.6*r;if(ce(c)){let e=a(i,c),t=a(i+1,c);for(let[r,i]of[[0,1.6],[1,4.9]]){let a=u(e,t,o,n[c]+i,1,0,l,`ws`,r),d=u(t,e,s,n[c]-i,-1,0,l,`ws`,r);r===1&&(a.parkSides=d.parkSides=[2.9])}}else if(re(c)){let e=n[c]-1*r,t=r>0?u(a(i,c),a(i+1,c),o,e,1,0,l,`st`,0):u(a(i+1,c),a(i,c),s,e,-1,0,l,`st`,0);t.parkSides=[3.5],t.narrow=!0}else r>0?u(a(i,c),a(i+1,c),o,d,1,0,l,`st`,0):u(a(i+1,c),a(i,c),s,d,-1,0,l,`st`,0)}}vi({X:e,Z:n,nodes:c,links:l,mk:u,nodeId:a}),yi({X:e,Z:n,nodes:c,links:l,mk:u,nodeId:a}),Ti(c,l,u),Ei(c,l);for(let e of l){if(e.kind===`st`||e.bridge)continue;let t=c[e.from].outLinks.find(t=>t!==e&&t.to===e.to);t&&(e.alt={link:t,turn:`S`,ok:!0})}for(let e of l){let t=c[e.to],n=[];for(let r of t.outLinks){let t=e.dx*r.dz-e.dz*r.dx,i=e.dx*r.dx+e.dz*r.dz,a=i>.5?`S`:i<-.5?`U`:t>0?`R`:`L`;if(a===`U`||a===`S`&&r.lane!==e.lane&&r.kind!==`st`&&e.kind!==`st`||a===`R`&&r.kind!==`st`&&r.lane!==1||a===`L`&&r.kind!==`st`&&r.lane!==0)continue;let o=!0;e.kind!==`st`&&(a===`L`&&e.lane!==0&&(o=!1),a===`R`&&e.lane!==1&&(o=!1)),n.push({link:r,turn:a,ok:o})}let r=n.filter(e=>e.ok);if(r.length||(r=n),!r.length)for(let n of t.outLinks)e.dx*n.dx+e.dz*n.dz<-.5&&(n.lane===e.lane||n.kind===`st`)&&r.push({link:n,turn:`U`,ok:!0});e.out=r,e.opp=t.inLinks.filter(t=>t.dx*e.dx+t.dz*e.dz<-.5),e.signal=t.av&&t.st||!!t.sig,e.diag&&(e.xAxis?(e.signal=!0,e.axis=e.xAxis):e.axis=Math.abs(e.dz)>=Math.abs(e.dx)?`av`:`st`)}xi(l),Si(c,l);let d=new Map;for(let e of c)if(e&&e.av&&e.st)for(let t of[`N`,`S`,`E`,`W`]){if(!(t===`N`?e.j>0&&o(e.i,e.j-1):t===`S`?o(e.i,e.j):t===`W`?e.i>0&&s(e.i-1,e.j):s(e.i,e.j)))continue;let n=t===`N`||t===`S`,r=n?{x:e.x,z:e.z+(t===`N`?-1:1)*(e.hz+2.3)}:{x:e.x+(t===`W`?-1:1)*(e.hw+2.3),z:e.z};d.set(e.id+t,{key:e.id+t,node:e,leg:t,x:r.x,z:r.z,alongX:n,half:n?e.hw:e.hz,axis:n?`av`:`st`,peds:0})}for(let e of l){let t=c[e.from],n=e.dz>.5?`S`:e.dz<-.5?`N`:e.dx>.5?`E`:`W`;e.xwStart=d.get(t.id+n)||null;let r=c[e.to],i=e.dz>.5?`N`:e.dz<-.5?`S`:e.dx>.5?`W`:`E`;e.xwEnd=d.get(r.id+i)||null}return{X:e,Z:n,HW:t,nodes:c,links:l,crosswalks:d,nodeId:a,avSeg:o,stSeg:s,nx:r,nz:i}}function vi({X:e,Z:t,nodes:n,links:r,mk:i,nodeId:a}){let o=new Map,s=(r,i,s)=>{let c=e.findIndex(e=>Math.abs(e-r)<.5),l=t.findIndex(e=>Math.abs(e-i)<.5);if(c>=0&&l>=0&&n[a(c,l)])return n[a(c,l)];let u=s??`${Math.round(r)},${Math.round(i)}`;if(!o.has(u)){let e={id:n.length,i:-1,j:-1,x:r,z:i,hw:0,hz:0,inLinks:[],outLinks:[],av:!1,st:!1,drive:!1,diag:!0};n.push(e),o.set(u,e)}return o.get(u)},c=0;for(let e of R){let{ax:r,az:o,ux:l,uz:u,nx:d,nz:f,hw:p,len:m}=e,h=(t,n)=>{let r=ne(t,n),i=r.type;return i===`avenue`||i===`intersection`?i:i===`street`?r.diag?r.diag.name===e.name?null:`d`+r.diag.id:`street`:null},g=[],_=null;for(let e=0;e<=m+1e-6;e+=.5){let t=null;for(let n=-p;n<=p+1e-6&&!t;n+=p/3)t=h(r+l*e+d*n,o+u*e+f*n);t?(_||g.push(_={s0:e,s1:e,types:{}}),_.s1=e,_.types[t]=(_.types[t]||0)+1):_=null}(!g.length||g[0].s0>1)&&g.unshift({s0:0,s1:0,types:{}}),g[g.length-1].s1<m-1&&g.push({s0:m,s1:m,types:{}});let v=[g[0]];for(let e=1;e<g.length;e++){let t=v[v.length-1],n=g[e];if(n.s0-t.s1<12){t.s1=n.s1;for(let e in n.types)t.types[e]=(t.types[e]||0)+n.types[e]}else v.push(n)}if(v.length<2)continue;for(let t=0;t<v.length;t++){let n=v[t],i=Object.entries(n.types).sort((e,t)=>t[1]-e[1])[0]?.[0]??null;n.node=t===0?s(r,o):t===v.length-1?s(e.bx,e.bz):s(r+l*(n.s0+n.s1)/2,o+u*(n.s0+n.s1)/2,`x`+e.id+`:`+t);let a=Math.abs(u)>=Math.abs(l)?`av`:`st`;n.axis=i===`avenue`?`st`:i===`street`?`av`:i&&i[0]===`d`?(()=>{let t=R[+i.slice(1)];return Math.abs(u)>Math.abs(t.uz)||Math.abs(u)===Math.abs(t.uz)&&e.id<t.id?`av`:`st`})():a,(n.node.av||n.node.i>=0)&&(n.axis=null)}for(let e of[0,v.length-1]){let r=v[e],i=r.node;if(v.length<2||!i||i.i<0||r.s1-r.s0<45||Math.abs(i.x-F.x)<1&&Math.abs(i.z-F.z)<1)continue;let s=o+u*(e===0?r.s1:r.s0),c=null;for(let e=0;e<t.length;e++){let t=n[a(i.i,e)];!t||!t.av||t===i||Math.abs(t.z-s)>30||(t.z-i.z)*(s-i.z)<=0||(!c||Math.abs(t.z-s)<Math.abs(c.z-s))&&(c=t)}let l=v[e===0?1:v.length-2].node;c&&c!==l&&(r.node=c)}let y=e.name===`BROADWAY`&&Math.min(e.az,e.bz)>=F.z-1,b=2*p,x=y?[[-1.2,0],[2.4,1]]:b>=14?[[1.8,0],[5.4,1]]:b>=12?[[b/4,0]]:null,S=b>=14?`dg`:`st`,C=y?[u>0?1:-1]:x?[1,-1]:[c++%2?-1:1],w=x||[[.6,0]];for(let t=0;t+1<v.length;t++){let n=v[t].s1+.5,a=v[t+1].s0-.5,s=a-n;if(!(s<8))for(let c of C)for(let[d,f]of w){let m=l*c,h=u*c,g=-h,_=m,b=c>0?n:a,x=c>0?v[t].node:v[t+1].node,C=c>0?v[t+1].node:v[t].node,w=i(x.id,C.id,r+l*b+g*d,o+u*b+_*d,m,h,s,S,f);w.diag=e,w.noPark=!y,w.xAxis=(c>0?v[t+1]:v[t]).axis,y&&(w.oneWayBway=!0,f===1&&(w.parkSides=[p-1.1-d,-(p-1.1)-d]))}}}}function yi(e){for(let t of L)bi(t,e)}function bi(e,{X:t,Z:n,nodes:r,links:i,mk:a,nodeId:o}){let s=new Map,c=(e,t)=>`${Math.round(e*10)},${Math.round(t*10)}`,l=new Map,u=(e,t,n,r,i)=>{let a=c(e,t);l.has(a)||l.set(a,[]),l.get(a).push({ux:n,uz:r,hw:i})};for(let t of e.segs)u(t.ax,t.az,t.ux,t.uz,t.hw),u(t.bx,t.bz,-t.ux,-t.uz,t.hw);let d=(i,a)=>{let u=t.findIndex(e=>Math.abs(e-i)<.5),d=n.findIndex(e=>Math.abs(e-a)<.5);if(u>=0&&d>=0&&r[o(u,d)])return r[o(u,d)];let f=c(i,a);if(!s.has(f)){let t=!!e.boundary(i,a)||(l.get(f)||[]).length<3,n={id:r.length,i:-1,j:-1,x:i,z:a,hw:0,hz:0,inLinks:[],outLinks:[],av:!1,st:!1,drive:!1,diag:!0,vmap:!0,tee:t};r.push(n),s.set(f,n)}return s.get(f)},f=(t,n,r,i,a=8)=>{let o=[...l.get(c(t,n))||[]],s=e.boundary(t,n);s&&s.hw&&o.push({ux:s.ux,uz:s.uz,hw:s.hw});let u=s&&s.edge?4+a*.6:3;for(let e of o){let t=Math.abs(r*e.uz-i*e.ux);t<.05||(u=Math.max(u,e.hw/Math.max(.35,t)+2))}return s&&!s.edge&&(l.get(c(t,n))||[]).length<2&&(u+=6),Math.min(u,30)};for(let t of e.segs){let e=d(t.ax,t.az),n=d(t.bx,t.bz),r=f(t.ax,t.az,t.ux,t.uz,t.w),i=f(t.bx,t.bz,-t.ux,-t.uz,t.w),o=t.len-r-i;if(o<8)continue;let s=t.oneway?0:t.w/4;for(let c of t.oneway?[t.oneway]:[1,-1]){let l=t.ux*c,u=t.uz*c,d=-u,f=l,p=c>0?r:t.len-i,m=a((c>0?e:n).id,(c>0?n:e).id,t.ax+t.ux*p+d*s,t.az+t.uz*p+f*s,l,u,o,`st`,0),h=c>0?n:e;m.diag=t,m.noPark=!0,m.vmap=!0,m.xAxis=h.vmap&&!h.tee?Math.abs(u)>=Math.abs(l)?`av`:`st`:null}}}function xi(e){for(let t of e){if(t.diag)continue;let e=[];for(let n of R){let r=n.hw+1.2,i=ee(n,t.ax,t.az),a=t.dx*n.nx+t.dz*n.nz;if(Math.abs(a)<.05)continue;let o=Math.min((r-i)/a,(-r-i)/a),s=Math.max((r-i)/a,(-r-i)/a);if(s<0||o>t.len)continue;let c=(o+s)/2,l=t.ax+t.dx*c,u=t.az+t.dz*c,d=(l-n.ax)*n.ux+(u-n.az)*n.uz;if(d<-2||d>n.len+2)continue;let f=o-1.5;f>4&&f<t.stopS-4?(e.push(f),(t.xcr??=[]).push({stop:f,s0:o,s1:Math.min(s,t.len)})):f<=4?t.xEarly=Math.max(t.xEarly??0,Math.min(s,t.len)):t.xLate=Math.min(t.xLate??t.len,Math.max(0,o))}e.length&&(t.xst=e.sort((e,t)=>e-t),t.xcr.sort((e,t)=>e.stop-t.stop))}}function Si(e,t){let n=2.9,r=(e,t,n,r,i)=>{let a=t-e.ax,o=n-e.az,s=Math.max(r,Math.min(i,a*e.dx+o*e.dz));return Math.hypot(a-e.dx*s,o-e.dz*s)};for(let t of e){if(!t)continue;let e=[...t.inLinks.map(e=>({L:e,inb:!0})),...t.outLinks.map(e=>({L:e,inb:!1}))];if(e.length<3||!e.some(e=>e.L.diag||e.L.roundTo))continue;let i=[];for(let e of t.inLinks)for(let t of e.out||[]){let r=e.conn.get(t.link.id)||Oi(e,t.link,t.turn);e.conn.set(t.link.id,r);let a=[],o=[0,0,0];for(let e=0;e<=r.len;e+=1)Ai(r,e,o),a.push(o[0],o[1]);i.push({I:e,O:t.link,P:a,D:t.turn===`S`&&(!e.diag||e.vmap)?n:3.9})}for(let t of e){let a=0,o=Math.min(t.L.len,60);for(let i of e){if(t.L===i.L||t.L.from===i.L.to&&t.L.to===i.L.from&&t.L.lane===i.L.lane&&!t.L.vmap||t.inb&&!i.inb&&t.L.out?.some(e=>e.link===i.L)||!t.inb&&i.inb&&i.L.out?.some(e=>e.link===t.L)||t.inb===i.inb&&Math.abs(t.L.dx*i.L.dx+t.L.dz*i.L.dz)>.995)continue;let e=Math.min(i.L.len,60),s=i.inb?i.L.len-e:0,c=i.inb?i.L.len:e;for(let e=0;e<=o;e+=1){let o=t.inb?t.L.len-e:e;r(i.L,t.L.ax+t.L.dx*o,t.L.az+t.L.dz*o,s,c)<n&&(a=Math.max(a,e+1))}}for(let e of i){if(t.inb&&e.I===t.L||!t.inb&&e.O===t.L)continue;let n=e.P;for(let r=0;r<n.length;r+=2){let i=n[r]-t.L.ax,s=n[r+1]-t.L.az,c=i*t.L.dx+s*t.L.dz,l=t.inb?t.L.len-c:c;l<0||l>o||Math.abs(i*t.L.dz-s*t.L.dx)<e.D&&(a=Math.max(a,l+1))}}a<=0||(t.inb?t.L.xLate=Math.min(t.L.xLate??t.L.len,t.L.len-a):t.L.xEarly=Math.max(t.L.xEarly??0,a))}}for(let e of t)e.xLate!==void 0&&e.xLate-1.5<e.stopS&&(e.stopS=Math.max(1,e.xLate-1.5))}var Ci=[];function wi(){return Ci}function Ti(e,t,n){Ci=[];for(let r of de()){if(r.mLand===null)continue;let i=r.sec,a=i.R+1,o=r.mJoin0-4,s=t.filter(e=>{if(e.bridge||Math.abs(e.dz)<.4)return!1;let t=o-e.ax,n=r.z-e.az,i=t*e.dx+n*e.dz;return i>0&&i<e.len&&Math.abs(t*e.dz-n*e.dx)<14});if(!s.length)continue;let c={id:e.length,i:-1,j:-1,x:o,z:r.z,hw:0,hz:0,inLinks:[],outLinks:[],av:!1,st:!1,drive:!1,diag:!0,sig:!1,bridgeT:r.name};e.push(c);let l=-1e9;for(let t of s){let i=a/Math.abs(t.dz),o=(r.z-t.az)/t.dz,s=o-i,u=o+i;if(s<6||u>t.len-6)continue;let d=e[t.to],f=n(c.id,t.to,t.ax+t.dx*u,t.az+t.dz*u,t.dx,t.dz,t.len-u,t.kind,t.lane);for(let e of[`diag`,`noPark`,`vmap`,`parkSides`,`narrow`,`xAxis`])t[e]!==void 0&&(f[e]=t[e]);d.inLinks.splice(d.inLinks.indexOf(f),1),d.inLinks[d.inLinks.indexOf(t)]=f,t.to=c.id,t.len=s,t.stopS=s-5,t.cx=t.ax+t.dx*s/2,t.cz=t.az+t.dz*s/2,t.vmap&&(t.xAxis=null),c.inLinks.push(t),l=Math.max(l,t.ax+t.dx*s+0*t.dz,f.ax)}if(!c.inLinks.length){e.pop();continue}let u=ue(r).map(e=>[e[0],e[1]]),d=Math.max(r.mJoin0+1.5,l+1.5),f=[[d,0],...u.filter(e=>e[0]>d+4).map((e,t)=>[e[0],t===0&&e[1]<1?0:e[1]])],p=[c,...f.slice(1).map((t,n)=>({id:e.length+n,i:-1,j:-1,x:t[0],z:r.z,hw:0,hz:0,inLinks:[],outLinks:[],av:!1,st:!1,drive:!1,diag:!0,bridgeN:r.name,y:t[1],deadEnd:n===f.length-2}))];for(let t of p.slice(1))e.push(t);for(let e=0;e<i.lanes;e++){let t=e===0?0:e===i.lanes-1?1:2,a=i.inner+.5+3.4*(e+.5);for(let e=0;e+1<f.length;e++){let i=f[e][0],o=f[e+1][0],s=f[e][1],c=f[e+1][1],l=e===0?i:i+.5,u=e+2===f.length?o:o-.5,d=n(p[e].id,p[e+1].id,l,r.z+a,1,0,u-l,`br`,t),m=n(p[e+1].id,p[e].id,u,r.z-a,-1,0,u-l,`br`,t);for(let[e,t,n]of[[d,s,c],[m,c,s]])e.bridge=r.name,e.noPark=!0,e.axis=`st`,e.y0=t,e.y1=n,e.grade=(n-t)/e.len}}Ci.push({name:r.name,x:o,z:r.z,x0:o-24,x1:f[1][0]+4,z0:r.z-i.hw-22,z1:r.z+i.hw+22})}}function Ei(e,t){let n=F,r=e.find(e=>e&&Math.abs(e.x-n.x)<.5&&Math.abs(e.z-n.z)<.5);if(!r)return;r.round=n;let i=n.lane+5,a=(e,t)=>Math.hypot(e.ax+e.dx*t-n.x,e.az+e.dz*t-n.z)>=i;for(let e of t){if(e.to===r.id){let t=e.len;for(;t>4&&!a(e,t);)t-=.25;e.len=t,e.stopS=Math.max(1,t-1.5),e.roundTo=n}if(e.from===r.id){let t=0;for(;t<e.len-4&&!a(e,t);)t+=.25;e.ax+=e.dx*t,e.az+=e.dz*t,e.len-=t,e.stopS=Math.min(e.stopS,e.len-5)}e.cx=e.ax+e.dx*e.len/2,e.cz=e.az+e.dz*e.len/2}}function Di(e,t,n){let r=e.roundTo,i=e.ax+e.dx*e.len,a=e.az+e.dz*e.len,o=t.ax,s=t.az,c=(e,t)=>Math.atan2(t-r.z,e-r.x),l=c(i,a),u=l-c(o,s);for(;u<=.9;)u+=Math.PI*2;for(;u>Math.PI*2+.9;)u-=Math.PI*2;let d=l-.35,f=u-.7,p=Math.max(4,Math.ceil(f*r.lane/2)),m=[[i,a]];for(let e=0;e<=p;e++){let t=d-f*e/p;m.push([r.x+Math.cos(t)*r.lane,r.z+Math.sin(t)*r.lane])}m.push([o,s]);let h=[0],g=0;for(let e=1;e<m.length;e++)g+=Math.hypot(m[e][0]-m[e-1][0],m[e][1]-m[e-1][1]),h.push(g);return{poly:m,tab:h,len:g,turn:n,to:t}}function Oi(e,t,n){if(e.roundTo)return Di(e,t,n);let r=e.ax+e.dx*e.len,i=e.az+e.dz*e.len,a=t.ax,o=t.az,s=Math.hypot(a-r,o-i),c=n===`S`?s/3:n===`U`?s*.9:s*.39,l=[r,i,r+e.dx*c,i+e.dz*c,a-t.dx*c,o-t.dz*c,a,o],u=[0],d=r,f=i,p=0;for(let e=1;e<=12;e++){let[t,n]=ki(l,e/12);p+=Math.hypot(t-d,n-f),u.push(p),d=t,f=n}return{P:l,tab:u,len:p,turn:n,to:t}}function ki(e,t){let n=1-t,r=n*n*n,i=3*n*n*t,a=3*n*t*t,o=t*t*t;return[r*e[0]+i*e[2]+a*e[4]+o*e[6],r*e[1]+i*e[3]+a*e[5]+o*e[7]]}function Ai(e,t,n){if(e.poly){let r=e.tab,i=e.poly,a=1;for(;a<r.length-1&&r[a]<t;)a++;let o=Math.max(0,Math.min(1,(t-r[a-1])/Math.max(1e-4,r[a]-r[a-1])));return n[0]=i[a-1][0]+(i[a][0]-i[a-1][0])*o,n[1]=i[a-1][1]+(i[a][1]-i[a-1][1])*o,n[2]=Math.atan2(i[a][1]-i[a-1][1],i[a][0]-i[a-1][0]),n}let r=e.tab,i=r.length-1,a=1;for(;a<i&&r[a]<t;)a++;let o=Math.max(0,Math.min(1,(t-r[a-1])/Math.max(1e-4,r[a]-r[a-1]))),s=(a-1+o)/i,[c,l]=ki(e.P,s),[u,d]=ki(e.P,Math.min(1,s+.02)),[f,p]=ki(e.P,Math.max(0,s-.02));return n[0]=c,n[1]=l,n[2]=Math.atan2(d-p,u-f),n}var ji=globalThis.__jxDbg||null,Mi=17.64,Ni=2.9,Pi=Ni*Ni,Z=1,Fi=4,Ii=12,Li=.82,Ri=32;function zi(e,t){let{links:n,nodes:r}=e,i=[],a=[0,0,0],o=e=>e.roundTo||e.kind===`av`||e.kind===`dg`||e.kind===`ws`||e.vmap&&(e.diag?.w??10)>=12?2:1,s={S:2,R:1,L:0,U:0},c=(e,t,n)=>{if(e.kind===`x`){let r=e.L,i=e.base+t;return n[0]=r.ax+r.dx*i,n[1]=r.az+r.dz*i,n[2]=r.heading,n}if(t<0){let r=e.inL,i=r.len+t;return n[0]=r.ax+r.dx*i,n[1]=r.az+r.dz*i,n[2]=r.heading,n}if(t>e.C.len){let r=e.outL,i=t-e.C.len;return n[0]=r.ax+r.dx*i,n[1]=r.az+r.dz*i,n[2]=r.heading,n}return Ai(e.C,t,n)},l=e=>{e.id=i.length,i.push(e),e.cf=new Map,e.cfB=new Map;let t=Math.max(2,Math.ceil((e.end-e.u0)/Z)+1),n=new Float32Array(t*4),r=1e9,o=1e9,s=-1e9,l=-1e9;for(let i=0;i<t;i++)c(e,Math.min(e.end,e.u0+i*Z),a),n[i*4]=a[0],n[i*4+1]=a[1],n[i*4+2]=Math.cos(a[2]),n[i*4+3]=Math.sin(a[2]),r=Math.min(r,a[0]),s=Math.max(s,a[0]),o=Math.min(o,a[1]),l=Math.max(l,a[1]);return e.P=n,e.n=t,e.bb=[r-5.2,o-5.2,s+5.2,l+5.2],e},u=(e,n,r)=>{let i=t(e,{link:n,turn:r}),a=Math.min(e.stopS,e.len),c=Math.min(n.len,Math.max(Fi,(n.xEarly??0)+2));return l({kind:`c`,y:e.y1??0,inL:e,outL:n,C:i,turn:r,lc:r===`S`&&e.kind!==`st`&&n.kind!==`st`&&e.lane!==n.lane,stopS:a,u0:Math.min(a-1,e.len)-e.len,end:i.len+c,prio:e.roundTo?5:o(e)*3+(s[r]??0),owner:e.to,J:null})};for(let e of n){e.mv=new Map;for(let t of e.out||[]){e.mv.has(t.link.id)||e.mv.set(t.link.id,u(e,t.link,t.turn));let n=t.link.alt;n&&!e.mv.has(n.link.id)&&e.mv.set(n.link.id,u(e,n.link,`S`))}e.xm=(e.xcr||[]).map((t,n)=>l({kind:`x`,y:0,L:e,base:t.stop,stopS:t.stop,u0:-1,end:t.s1+2-t.stop,prio:o(e)*3+2,owner:r.length+e.id*8+n,J:null}))}let d=(e,t)=>{let n=e.mv.get(t.link.id);return n||(n=u(e,t.link,t.turn),e.mv.set(t.link.id,n),n.J===null&&(n.J=E([n]))),n},f=(e,t)=>{if(e.kind===`c`&&t.kind===`c`)return e.outL===t.inL||t.outL===e.inL;if(e.kind===`x`&&t.kind===`x`)return e.L===t.L;let n=e.kind===`x`?e:t,r=e.kind===`x`?t:e;return r.inL===n.L||r.outL===n.L},p=(e,t)=>g(e,t,!1),m=(e,t,n)=>{let r=e.J;if(r!==t.J||!r.cm)return g(e,t,n);let i=n?r.cmB:r.cm,a=e.ji*r.moves.length+t.ji,o=i[a];return o===void 0&&(o=i[a]=g(e,t,n)),o},h=(e,t)=>g(e,t,!0),g=(e,t,n)=>{if(e===t)return null;let r=n?`cfB`:`cf`,i=n?Mi:Pi,a=e[r].get(t.id);if(a!==void 0)return a;if(a=null,Math.abs(e.y-t.y)>4)return e[r].set(t.id,null),t[r].set(e.id,null),null;if(!f(e,t)&&e.bb[0]<t.bb[2]&&t.bb[0]<e.bb[2]&&e.bb[1]<t.bb[3]&&t.bb[1]<e.bb[3]){let o=e.P,s=t.P,c=[],l=e.turn&&e.turn!==`S`||t.turn&&t.turn!==`S`||e.lc||t.lc;for(let r=0;r<e.n;r++){let a=o[r*4],u=o[r*4+1];if(!(a<t.bb[0]||a>t.bb[2]||u<t.bb[1]||u>t.bb[3]))for(let d=0;d<t.n;d++){let f=s[d*4]-a,p=s[d*4+1]-u,m=f*f+p*p;if(m>=i)continue;let h=o[r*4+2]*s[d*4+2]+o[r*4+3]*s[d*4+3];if(n&&m>=Pi&&(h<-.9||h>.9)&&!l)continue;let g=null;for(let e=c.length-1;e>=0;e--){let t=c[e];if(r-t.i1<=2&&d>=t.j0-2&&d<=t.j1+2){g=t;break}}g||c.push(g={i0:r,i1:r,j0:d,j1:d,best:1e9,dot:1,kb:0,ks:0,kn:0}),g.i1=r,d<g.j0&&(g.j0=d),d>g.j1&&(g.j1=d),m<g.best&&(g.best=m,g.dot=h,g.kb=(d-r)*Z+t.u0-e.u0),m<.6&&h>Li&&(g.ks+=(d-r)*Z+t.u0-e.u0,g.kn++)}}if(c.length){a=[];let n=[];for(let r of c){let i=r.dot>Li,o=i&&r.kn?r.ks/r.kn:r.kb,s=e.u0+r.i0*Z-Z,c=e.u0+r.i1*Z+Z,l=t.u0+r.j0*Z-Z,u=t.u0+r.j1*Z+Z;a.push({cross:!i,a0:s,a1:c,b0:l,b1:u,k:o}),n.push({cross:!i,a0:l,a1:u,b0:s,b1:c,k:-o})}let i=a.filter(e=>e.cross);if(i.length>1){a=[{cross:!0,a0:Math.min(...i.map(e=>e.a0)),a1:Math.max(...i.map(e=>e.a1)),b0:Math.min(...i.map(e=>e.b0)),b1:Math.max(...i.map(e=>e.b1)),k:i[0].k},...a.filter(e=>!e.cross)],n.length=0;for(let e of a)n.push({cross:e.cross,a0:e.b0,a1:e.b1,b0:e.a0,b1:e.a1,k:-e.k})}t[r].set(e.id,n)}else t[r].set(e.id,null)}return e[r].set(t.id,a),a},_=new Map,v=e=>{for(;_.has(e)&&_.get(e)!==e;){let t=_.get(_.get(e));_.set(e,t),e=t}return e},y=(e,t)=>{e=v(e),t=v(t),e!==t&&_.set(t,e)};for(let e of i)_.set(e.owner,e.owner);let b=new Map;for(let e of i)for(let t=Math.floor(e.bb[0]/Ri);t<=Math.floor(e.bb[2]/Ri);t++)for(let n=Math.floor(e.bb[1]/Ri);n<=Math.floor(e.bb[3]/Ri);n++){let r=t*65536+n,i=b.get(r);i||b.set(r,i=[]),i.push(e)}let x=new Set;for(let e of b.values())for(let t=0;t<e.length;t++)for(let n=t+1;n<e.length;n++){let r=e[t],i=e[n];if(r.owner===i.owner||v(r.owner)===v(i.owner))continue;let a=r.id<i.id?r.id*1e6+i.id:i.id*1e6+r.id;x.has(a)||(x.add(a),(p(r,i)||(r.turn!==`S`||i.turn!==`S`)&&h(r,i))&&y(r.owner,i.owner))}let S=new Map;for(let e of i)if(e.kind===`c`)for(let t=0;t<e.n;t++){let n=e.u0+t*Z;if(n<0||n>e.C.len)continue;let r=Math.floor(e.P[t*4]/8)*65536+Math.floor(e.P[t*4+1]/8),i=S.get(r);i||S.set(r,i=[]),i.push(e.P[t*4],e.P[t*4+1])}let C=(e,t,n)=>{let r=Math.floor((e-n)/8),i=Math.floor((e+n)/8),a=Math.floor((t-n)/8),o=Math.floor((t+n)/8);for(let s=r;s<=i;s++)for(let r=a;r<=o;r++){let i=S.get(s*65536+r);if(i){for(let r=0;r<i.length;r+=2)if((i[r]-e)**2+(i[r+1]-t)**2<n*n)return!0}}return!1},w=[],T=new Map,E=e=>{let t={id:w.length,moves:e,occ:[],wait:[],inLinks:[],hot:!1,cm:null,cmB:null};w.push(t);for(let n of e)n.J=t;return e.length&&D(t),t};function D(e){e.moves.forEach((e,t)=>{e.ji=t}),e.cm=Array(e.moves.length**2),e.cmB=Array(e.moves.length**2)}for(let e of i){let t=v(e.owner),n=T.get(t);n||(n=E([]),T.set(t,n)),n.moves.push(e),e.J=n}for(let e of w){let t=new Set;for(let n of e.moves)t.add(n.kind===`x`?n.L:n.inL);e.inLinks=[...t],D(e)}let O=(e,t)=>t.kind===`x`?e.link===t.L&&!e.conn?e.s-t.base:NaN:e.link===t.inL&&!e.conn?e.s-t.inL.len:e.link===t.outL&&(e.conn?e.conn===t.C:e.via===t)?e.s+t.C.len:NaN,k=new Set,A=(e,t)=>{let n=e.reg;if(n){for(let e=0;e<n.length;e++)if(n[e]===t)return!0}return!1},j=(e,t,n=!1)=>{A(e,t)||((e.reg??=[]).push(t),t.J.occ.push({c:e,M:t,pend:n}),k.add(t.J),e.regT=se,e.wait&&M(e))},M=e=>{let t=e.wait;if(e.wait=null,!t)return;let n=t.J.wait,r=n.indexOf(t);r>=0&&n.splice(r,1)},N={M:null,stop:0},P=e=>{let t=e.link;if(e.conn)return null;let n=t.xm;for(let t=0;t<n.length;t++){let r=n[t];if(!A(e,r)&&!(e.s-e.len/2-r.base>r.end))return N.M=r,N.stop=r.stopS,N}if(!e.next)return null;let r=e._tM;return r&&e._tN===e.next&&r.inL===t||(r=e._tM=d(t,e.next),e._tN=e.next),A(e,r)?null:(N.M=r,N.stop=r.stopS,N)},ee=(e,t,n)=>{let r=e.c.wAcc>Ii||!!(e.c.reg&&e.c.reg.length);return r===(t.wM===t._req&&t.wAcc>Ii)?e.M.prio===t._req.prio?e.c.wT0<(t.wM===t._req?t.wT0:n)-.3:e.M.prio>t._req.prio:r},te=(e,t)=>{if(t.kind===`x`){let n=t.L.cars,r=null;for(let t=0;t<n.length;t++)if(n[t].s>e.s){r=n[t];break}return!r||r.s-r.len/2+Math.min(r.v*1.5,8)>=t.base+t.end+e.len/2+1.5}let n=t.outL;if(!n.active)return!0;let r=0,i=Math.min(n.len,n.blockS),a=0;for(let t of n.cars)if(t!==e){if(t.conn||t.s-t.len/2<0)r+=t.len+2;else{i=t.s-t.len/2,a=t.v;break}}let o=t.J.occ;for(let t=0;t<o.length;t++){let i=o[t];i.M.kind===`c`&&i.M.outL===n&&i.c!==e&&i.c.link!==n&&(r+=i.c.len+2)}let s=Math.min(t.end-t.C.len+e.len/2+1.5,Math.max(e.len+2,n.len*.6));return i-r+Math.min(a,3)>=s},F=null,ne=(e,t)=>e<=0?0:t.v<.3&&t.stillT>2?1e9:(-t.v+Math.sqrt(t.v*t.v+5*e))/2.5,re=(e,t,n)=>{let r=n+.5-(t-e.len/2);return r<=0?0:1.3*(-e.v+Math.sqrt(e.v*e.v+4*r))/2+1},ie=(e,t,n,r)=>{let i=t.J;for(let a=0;a<i.occ.length;a++){let o=i.occ[a],s=o.c;if(s===e)continue;let c=m(o.M,t,e.len>7||s.len>7);if(!c)continue;let l=O(s,o.M);if(l!==l){if(o.pend&&c.some(e=>e.cross))return F=s,1}else for(let i=0;i<c.length;i++){let a=c[i];if(l-s.len/2>a.a1+.5)continue;if(a.cross){let i=l+s.len/2;if(i>=a.a0-(s.v*s.v/12+.5)||!r&&ne(a.a0-i,s)<re(e,n,a.b1)){if(F=s,ji){let e=o.M.id+`>`+t.id;ji.set(e,(ji.get(e)||0)+1)}return 1}continue}let u=l+a.k;if(!(u>=n||n+e.len/2>=a.b0)&&n-e.len/2-(u+s.len/2)<(r?1+s.v*s.v/8:2+s.v*1.2+Math.max(0,s.v-e.v)**2/6)){if(F=s,ji){let e=o.M.id+`>`+t.id+`fb`;ji.set(e,(ji.get(e)||0)+1)}return 1}}}return 0},ae=(e,t,n,r,i,a)=>{let o=t[0],s=o.J;e._req=o;let c=!1;if(e.reg)for(let t=0;t<e.reg.length;t++)e.reg[t].J===s&&(c=!0);let l=c||e.wM===o&&e.wAcc>Ii;for(let i=0;i<r;i++)if(ie(e,t[i],n[i],l))return 1;if(!c)for(let t=0;t<s.wait.length;t++){let n=s.wait[t];if(!(n.c===e||i-n.last>.3||(n.why===4||n.why===1)&&!(n.c.wAcc>Ii)||!p(n.M,o))&&ee(n,e,i))return F=n.c,2}if(!l)for(let t of s.inLinks){let n=t.cars;for(let r=n.length-1;r>=0;r--){let i=n[r];if(i===e||i.conn)continue;let c=i.s+i.len/2;if(c<t.len-70)break;if(i.v<2||i.reg?.length&&i.reg[i.reg.length-1].J===s)continue;let l=P(i);if(!l||l.M.J!==s||l.M.prio<=o.prio)continue;let u=l.stop-c;if(!(u<-.5||u/i.v>3.2)&&!a(i,l.M)&&p(l.M,o))return F=i,3}}F=null;for(let n=0;n<r;n++)if(!te(e,t[n]))return F=(t[n].kind===`c`?t[n].outL:t[n].L).cars.find(r=>r!==e&&!r.conn&&r.s-r.len/2>=0&&(t[n].kind===`c`||r.s>e.s))||null,4;return 0},I={gap:1e4,vL:0,why:``,whyC:null},oe=[0,0,0,0,0,0],L=[],R=[],z=[],B=(e,t,n)=>{L[0]=t,R[0]=O(e,t);let r=1,i=e.link,a=e.s,o=t;for(;r<4;){let s=null;if(o.kind===`x`){for(let e of i.xm)if(e.base>o.base){s=e;break}}else a=a-i.len-o.C.len,i=o.outL,s=i.xm[0]||null;if(!s){let t=null;if(i===e.link?t=e.next:e.pre&&e.pre.L!==i||(e.pre||={L:i,opt:n(e,i)},t=e.pre.opt),!t)break;s=d(i,t)}if(s.J!==t.J||A(e,s))break;L[r]=s,R[r]=s.kind===`x`?a-s.base:a-i.len,z[r]=s.stopS-(a+e.len/2),r++,o=s}return r},se=0,ce=(e,t,n,r,i,a,o)=>{if(se=r,I.gap=1e4,I.vL=0,I.whyC=null,e.reg)for(let n=e.reg.length-1;n>=0;n--){let r=e.reg[n],a=r.stopS-t;if((r.kind===`x`?e.link===r.L:e.link===r.inL&&!e.conn)&&a>.3&&a>e.v*e.v/10&&!V(e,r)&&i(e,r,a)){let t=e.chain,i=t?t.indexOf(r):-1;if(i>=0)for(let n=t.length-1;n>i;n--){let r=e.reg.indexOf(t[n]);r>=0&&H(e,t[n],r)}H(e,r,e.reg.indexOf(r)),n=Math.min(n,e.reg.length)}}let s=e.link.len-t>60&&!e.link.xm.length?null:P(e);if(s){let c=s.M,l=s.stop-t,u=n&&n.s+n.len/2<s.stop+.3&&!(n.reg&&n.reg.length&&n.reg[n.reg.length-1].J===c.J);if(l<-.5)j(e,c);else if(!u&&l<Math.max(9,e.v*e.v/6+6)&&!i(e,c,l)){let t=B(e,c,o),n=0;for(let r=1;r<t;r++)if(i(e,L[r],z[r])){for(let t=0;t<r;t++)R[t]+z[r]-e.len/2<le(L[t])+.5&&(n=5);t=r;break}if(n||=ae(e,L,R,t,r,a),!n){let n=e.wM===c&&e.wAcc>Ii,i=L.slice(0,t);for(let t of i)j(e,t,t!==c);n&&(e.regT=r-100),e.chain=i,e.wM=null}else if(oe[n]++,I.gap=Math.max(.05,l),I.vL=0,I.why=`deny`+n,I.whyC=F,l<14&&(e.wM!==c&&(e.wM=c,e.wT0=r,e.wAcc=0,e.wLast=r),e.wAcc+=Math.min(.1,r-e.wLast),e.wLast=r,e.wait&&e.wait.M===c||(M(e),e.wait={c:e,M:c,J:c.J,last:r,roomOnly:!1,why:0},c.J.wait.push(e.wait),k.add(c.J)),e.wait.last=r,e.wait.roomOnly=n===4,e.wait.why=n,(n===4&&e.wAcc>6||e.wAcc>20)&&c.kind===`c`&&c.inL===e.link&&e.next&&(c.inL.out?.length||0)>1)){let t=o(e,e.link,e.next.link);t&&t.link!==e.next.link&&(e.next=t,e.pre&&=null,M(e),e.wM=null)}}else e.wait&&!u&&M(e),e.wLast=r;l<40&&!A(e,c)&&U(e,c,!1)}if(e.reg)for(let t=0;t<e.reg.length;t++)U(e,e.reg[t],!0);return I},V=(e,t)=>{for(let n=0;n<e.reg.length;n++){let r=e.reg[n];if(r!==t&&r.J===t.J&&O(e,r)===O(e,r)&&O(e,r)+e.len/2>r.stopS-(r.kind===`x`?r.base:r.inL.len))return!0}return!1},le=e=>{if(e.zEnd!==void 0)return e.zEnd;let t=-1e9;for(let n of e.J.moves){let r=p(e,n);if(r)for(let e of r)e.cross&&e.a1>t&&(t=e.a1)}return e.zEnd=t},ue=(e,t)=>A(e,t),H=(e,t,n)=>{e.reg.splice(n,1);let r=t.J.occ;for(let n=r.length-1;n>=0;n--)if(r[n].c===e&&r[n].M===t){r.splice(n,1);break}},de=(e,t,n,r)=>{let i=Math.cos(r.ry),a=-Math.sin(r.ry);for(let o=0;o<=8;o+=.5){let s=Math.round(n+o-t.u0);if(s<0||s>=t.n)break;let c=t.P[s*4],l=t.P[s*4+1],u=t.P[s*4+2],d=t.P[s*4+3],f=r.x-c,p=r.z-l,m=!0;for(let[t,n]of[[u,d],[-d,u],[i,a],[-a,i]]){let o=(e.len/2+.3)*Math.abs(u*t+d*n)+(e.wid/2+.2)*Math.abs(-d*t+u*n),s=r.len/2*Math.abs(i*t+a*n)+r.wid/2*Math.abs(-a*t+i*n);if(Math.abs(f*t+p*n)>o+s){m=!1;break}}if(m)return Math.max(.05,o-.5)}return 1e4},U=(e,t,n)=>{let r=t.J.occ;if(r.length<2)return;let i=O(e,t);if(i===i)for(let a=0;a<r.length;a++){let o=r[a],s=o.c;if(s===e)continue;let c=s.x-e.x,l=s.z-e.z;if(c*c+l*l>8100)continue;let u=m(o.M,t,e.len>7||s.len>7);if(!u)continue;let d=O(s,o.M);if(d===d)for(let r=0;r<u.length;r++){let a=u[r];if(d-s.len/2>a.a1+.5||i-e.len/2>a.b1+.5)continue;if(a.cross){if(!n)continue;let r=i+e.len/2,o=d+s.len/2;if(r>=a.b0-(e.v*e.v/12+.5)){if(o>=a.a0&&d-s.len/2<=a.a1){let n=de(e,t,i,s);n<I.gap&&(I.gap=n,I.vL=0,I.why=`jzone`,I.whyC=s)}continue}if(o>=a.a0-(s.v*s.v/12+.5)||(s.regT<e.regT||s.regT===e.regT&&s.id<e.id)&&ne(a.a0-o,s)<re(e,i,a.b1)){let e=a.b0-1-r;e<I.gap&&(I.gap=e,I.vL=0,I.why=`jzone`,I.whyC=s)}continue}let o=d+a.k;if(o<=i||d+s.len/2<a.a0-.5&&s.stillT>1.5)continue;let c=o-s.len/2-(i+e.len/2);c<I.gap&&(I.gap=c,I.vL=s.v,I.why=`jfollow`,I.whyC=s)}}};return{moveFor:d,conflict:p,conflictBig:h,nearTurn:C,uOf:O,car:ce,tick:e=>{for(let t of k){let n=t.occ;for(let e=n.length-1;e>=0;e--){let t=n[e],r=t.c,i=O(r,t.M);if(t.pend){if(i===i)t.pend=!1;else if(!r.dead)continue}if((r.dead||i!==i||i-r.len/2>t.M.end+.3)&&(n.splice(e,1),r.reg)){let e=r.reg.indexOf(t.M);e>=0&&r.reg.splice(e,1)}}let r=t.wait;for(let t=r.length-1;t>=0;t--)(r[t].c.dead||e-r[t].last>.5)&&(r[t].c.wait===r[t]&&(r[t].c.wait=null),r.splice(t,1));!n.length&&!r.length&&k.delete(t)}},register:j,stats:()=>{let e=0,t=0;for(let n of k)e+=n.occ.length,t+=n.wait.length;return{junctions:w.length,moves:i.length,hot:k.size,occ:e,wait:t,deny:oe.slice(1)}},Js:w,moves:i,dropWait:M,holds:ue}}var Bi={laneObstacles:[],curbBlocks:[],laneClosures:[]};function Vi(e,t,n=0){for(let r of Bi.curbBlocks)if(e>r.x0-n&&e<r.x1+n&&t>r.z0-n&&t<r.z1+n)return!0;return!1}var Hi=640,Ui=500,Wi=2600,Gi=3.2,Ki=.5,qi={av:31,st:44,ws:20,dg:41,dg1:80,map:27,br:31},Ji=1,Q={taxi:{len:5.39,wid:1.99,h:1.5,big:!1},taxi_hy:{len:4.54,wid:1.76,h:1.52,big:!1},taxi_mv:{len:5.08,wid:1.99,h:1.8,big:!1},taxi_gr:{len:4.86,wid:1.84,h:1.48,big:!1},sedan:{len:4.85,wid:1.84,h:1.46,big:!1},hatch:{len:4.26,wid:1.79,h:1.46,big:!1},sedan2:{len:4.9,wid:1.85,h:1.46,big:!1},cross:{len:4.6,wid:1.86,h:1.7,big:!1},suv:{len:4.9,wid:1.95,h:1.77,big:!1},suv2:{len:5.35,wid:2.03,h:1.92,big:!1},pickup:{len:5.9,wid:2.03,h:1.95,big:!1},van:{len:5.98,wid:2.06,h:2.55,big:!1},truck:{len:7.3,wid:2.3,h:3.5,big:!0},bus:{len:12.2,wid:2.55,h:3.1,big:!0},tour:{len:11,wid:2.55,h:4.3,big:!0}},Yi=[921103,1381655,1776671,1053720,14869215,14211284,13619146,15131610,11120049,10264483,12040635,9343638,7172212,5593180,4474699,1780298,2243171,3099770,5902870,7215642,9051935,11774351,10194805,2899246,4478527,7046816,4864556,3884112,8161935,2764083],Xi=e=>[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255].map(e=>e**2.2),Zi=Xi(16099584),Qi=Xi(10137164),$i=[14079698,13618372,13224391,14276560].map(Xi),ea=Yi.map(Xi),ta=[723724,921104,1184533,856084].map(Xi);[14474456,13816524,13157044,14868698,2772874,9051164,3951162,12104874].map(Xi);var na=class{constructor(e,n,r,{shadow:i=!0,name:a=``}={}){this.mesh=new w(e,n,r),this.mesh.name=a,this.mesh.count=0,this.mesh.frustumCulled=!1,this.mesh.castShadow=i,this.mesh.receiveShadow=!0,this.mesh.instanceMatrix.setUsage(t),this.tint=new h(new Float32Array(r*3),3).setUsage(t),this.state=new h(new Float32Array(r),1).setUsage(t),e.setAttribute(`aTint`,this.tint),e.setAttribute(`aState`,this.state),this.seed=new h(new Float32Array(r),1).setUsage(t),e.setAttribute(`aSeed`,this.seed),this.max=r,this.n=0}push(e,t,n,r,i,a,o=0,s=0){if(this.n>=this.max)return;let c=this.n++,l=this.mesh.instanceMatrix.array,u=c*16,d=Math.cos(r),f=Math.sin(r);if(o){let e=Math.cos(o),t=Math.sin(o);l[u]=d*e,l[u+1]=t,l[u+2]=-f*e,l[u+3]=0,l[u+4]=-d*t,l[u+5]=e,l[u+6]=f*t,l[u+7]=0}else l[u]=d,l[u+1]=0,l[u+2]=-f,l[u+3]=0,l[u+4]=0,l[u+5]=1,l[u+6]=0,l[u+7]=0;l[u+8]=f,l[u+9]=0,l[u+10]=d,l[u+11]=0,l[u+12]=e,l[u+13]=t,l[u+14]=n,l[u+15]=1,this.tint.array[c*3]=i[0],this.tint.array[c*3+1]=i[1],this.tint.array[c*3+2]=i[2],this.state.array[c]=a,this.seed.array[c]=s}begin(){this.n=0}end(){if(this.mesh.count=this.n,this.mesh.visible=this.n>0,!this.n)return;let e=this.mesh.instanceMatrix;e.clearUpdateRanges(),e.addUpdateRange(0,this.n*16),e.needsUpdate=!0,this.tint.clearUpdateRanges(),this.tint.addUpdateRange(0,this.n*3),this.tint.needsUpdate=!0,this.state.clearUpdateRanges(),this.state.addUpdateRange(0,this.n),this.state.needsUpdate=!0,this.seed.clearUpdateRanges(),this.seed.addUpdateRange(0,this.n),this.seed.needsUpdate=!0}};function ra(){let e=-1;return(t,n,r,i,a=1)=>{let o=window.__audio;if(!o?.ready||t>120)return;let s=performance.now()/1e3;s-e<.35||(e=s,o.sfx.hornAt(r,a+1.2,i,n))}}function ia({scene:e,roads:t,phase:n,geos:r,mats:a,models:o=null}){let{links:s,nodes:c}=t,l={},u=[],d={},f=e=>o?.[e]?.grp??e;for(let t of Object.keys(Q)){let n=f(t);if(!d[n]){let i=Q[t].big;if(d[n]={far:new na(r.far[n],a.far,i?500:2400,{shadow:!1,name:`veh-far-`+n})},d[n].far.farTier=!0,e.add(d[n].far.mesh),u.push(d[n].far),r.glb||r.hi[t]){let t=new na(r.far[n].clone(),a.far,i?200:700,{name:`veh-shadowProxy-`+n});t.mesh.layers.set(29),t.mesh.userData.smallCasters=!0,t.mesh.receiveShadow=!1,e.add(t.mesh),u.push(t),d[n].proxy=t}}}for(let t of Object.keys(Q)){let n=Q[t].big?60:120;l[t]={hi:new na(r.hi[t]||r.low[t],r.hi[t]?a.hi:a.mid,n,{name:`veh-hi-`+t}),low:new na(r.low[t],a.mid,Q[t].big?200:500,{name:`veh-low-`+t}),far:d[f(t)].far,proxy:d[f(t)].proxy};for(let n of[`hi`,`low`])e.add(l[t][n].mesh),u.push(l[t][n])}let p=me(e,1600),h=fe(e,600),_=2048,v=Array(_).fill(null),y=new Float32Array(_),b=new Float32Array(_),x=0,S=.1,w={type:`spot`,pos:[0,0,0],dir:[1,0,0],color:16767152,intensity:45,range:20,angle:.5,penumbra:.9,radius:3.5,volume:.18,key:0,spec:0},T={type:`point`,pos:[0,0,0],color:16718860,intensity:.75,range:4.5,radius:.2,volume:.04,shadow:!1},E=typeof location<`u`&&/[?&]nohl\b/.test(location.search);k.addProvider(e=>{let t=x;if(!t||E)return;let n=1/0,r=1/0;if(t>30){b.set(y);for(let e=t;e<_;e++)b[e]=0xe8d4a51000;b.sort(),r=b[29],t>50&&(n=b[49])}for(let i=0;i<t;i++){if(y[i]>n)continue;let t=v[i],a=t.parked?0:t.y,o=t.parked?0:t.pitch+t.gp,s=Math.cos(t.ry),c=Math.sin(t.ry),l=Math.sin(o),u=t.len/2+.1,d=a+.72,f=y[i]<=r,p=Math.cos(o-S),m=Math.sin(o-S);w.dir[0]=s*p,w.dir[1]=m,w.dir[2]=-c*p;let h=t.x>-112&&t.x<112&&t.z>-352&&t.z<22?14:38,g=(t.parked?1e6+Math.round(t.x*3+t.z*7919):t.id)*2,_=t.x+s*u,b=d+l*u,x=t.z-c*u,C=f?Math.max(.5,t.wid/2-.25):0;for(let t=f?-1:0;t<=+!!f;t+=2-!f)w.pos[0]=_+c*C*t,w.pos[1]=b,w.pos[2]=x+s*C*t,w.intensity=f?h:2*h,w.key=g+ +(t>0),e(w);if(y[i]<2025){let n=t.len/2+.2,r=t.parked?t.haz&&(W*1.5+t.x*.01)%1<.5:t.brake>0,i=t.x-s*n,o=a+.85-l*n,u=t.z+c*n,d=Math.max(.5,t.wid/2-.2);T.intensity=r?2:.75;for(let t=-1;t<=1;t+=2)T.pos[0]=i+c*d*t,T.pos[1]=o,T.pos[2]=u+s*d*t,T.key=4e7+g+ +(t>0),e(T)}}},{moving:!0});for(let e of s){e.blockS=1/0;for(let t of Bi.laneObstacles){let n=t.x-e.ax,r=t.z-e.az,i=n*e.dx+r*e.dz,a=Math.abs(n*e.dz-r*e.dx);i>-2&&i<e.len+2&&a<1.6&&(e.blockS=Math.min(e.blockS,i-2.5))}for(let t of Bi.laneClosures??[])for(let n=0;n<=e.len;n+=1){let r=e.ax+e.dx*n,i=e.az+e.dz*n;if(r>t.x0&&r<t.x1&&i>t.z0&&i<t.z1){e.blockS=Math.min(e.blockS,n-2.5),e.noSpawn=!0;break}}}let D=ra(),O=[],N=1,te=I(globalThis.__trafficSeed??99),F={pos:new C(1e9,0,0),vel:new C,t:-1,ground:0},ne=(e,t)=>{let n=e.kind!==`st`&&e.lane===1;return n&&t<.07?`bus`:n&&t<.09?`tour`:t<.13?`truck`:t<.21?`van`:t<.28?`taxi_hy`:t<.34?`taxi_mv`:t<.41?`taxi_gr`:t<.44?`taxi`:t<.52?`sedan`:t<.6?`sedan2`:t<.66?`hatch`:t<.74?`suv`:t<.82?`cross`:t<.93?`suv2`:`pickup`},re=(e,t)=>e===`taxi_gr`?t<.3?Qi:Zi:e.startsWith(`taxi`)?Zi:e===`suv2`&&t<.7||e===`sedan2`&&t<.4||e===`suv`&&t<.3?ta[Math.floor(t*97)%ta.length]:e===`truck`||e===`van`?$i[Math.floor(t*$i.length)]:e===`tour`?Xi(11735578):e===`bus`?Xi(15000800):ea[Math.floor(t*ea.length)],ie=(e,t,n=null)=>{let r=t.out;if(!r||!r.length)return null;let i=Q[e.type].big,a=0,o=r.map(r=>{let o=r.turn===`S`?.66:r.turn===`U`?.05:i&&r.turn===`L`?.02:.17;r.link.blockS<1/0&&(o*=.001),n&&r.link===n&&(o*=.02),e.len>7&&r.link.vmap&&((r.link.diag?.w??10)<12||e.len>10)&&(o*=.002),e.len>10&&r.turn!==`S`&&(t.diag||r.link.diag)&&(o*=.01);{let t=r.link,n=t.len;for(let e=0;e<t.cars.length;e++){let r=t.cars[e];n=r.s-r.len/2-(r.conn?r.len:0);break}t.active&&n<e.len+8&&(o*=.08+.92*Math.max(0,n)/(e.len+8))}return a+=o,o}),s=e.rng()*a;for(let e=0;e<r.length;e++)if((s-=o[e])<=0){let t=r[e];return t.link.blockS<1/0&&t.turn===`S`&&t.link.alt?t.link.alt:t}return r[r.length-1]},ae=(e,t,n,r)=>{let i=I(r),a=ne(e,i()),o=Q[a],s={id:N++,type:a,len:o.len,wid:o.wid,h:o.h,link:e,s:t,v:n,v0:(e.kind===`st`?9:12.5)+i()*3.5,conn:null,next:null,rng:i,color:re(a,i()),brake:0,blockT:0,honkT:0,x:0,z:0,ry:0,pitch:0,acc:0,dead:!1,reg:null,chain:null,via:null,pre:null,wait:null,wM:null,wT0:0,wAcc:0,wLast:0,_req:null,_red:!1,_why:``,_whyC:null,creepT:0,_tM:null,_tN:null,stuckT:0,stillT:0,regT:0,_pAlong:null,_pLat:0,_pSoft:!1,inZone:!1,adSeed:void 0,_vis:!1,dA:1.6+i()*.8,dTH:.8+i()*.6,dS0:1.5+i()*1,latB:0,latA:.1+i()*.25,latK:2*Math.PI/(60+i()*100),latP:i()*6.283,odo:0,lat:0,latV:0,lc:0,lc0:0,lcFrom:null,lcT:0,lcDur:0,lcCool:4+i()*10,wob:i()*100,yaw:0,y:0,gp:0};return s.latB=(i()<.25?.25:.08)*(i()<.5?-1:1),s.next=ie(s,e),s},oe=(e,t)=>{let n=e.length;for(;n>0&&e[n-1].s>t.s;)n--;e.splice(n,0,t)},L=new C(1e9,0,0),z=0,B=(e,t,n)=>{let r=t-e.ax,i=n-e.az,a=Math.max(0,Math.min(e.len,r*e.dx+i*e.dz)),o=r-e.dx*a,s=i-e.dz*a;return o*o+s*s},se=(e,t)=>{if(e.noSpawn)return;let r=I(e.id*7919+(e.gen=(e.gen||0)+1)*104729>>>0),i=e.kind===`st`?[8,38]:e.kind===`dr`?[10,38]:[6,27],a=3+r()*12+(e.blockS<1/0?e.blockS+6:0),o=e.signal?n(W,e.axis):2,s=[];for(;a<e.len-3&&O.length<Wi;){let t=ae(e,0,0,e.id*131+a*17+e.gen*7>>>0);if(t.s=a+t.len/2,t.s+t.len/2>e.len-1)break;{let n=e.ax+e.dx*t.s,r=e.az+e.dz*t.s,i=(F.pos.x-n)*e.dx+(F.pos.z-r)*e.dz;if(Math.abs((F.pos.x-n)*e.dz-(F.pos.z-r)*e.dx)<t.wid/2+Ki+.7&&i>-t.len/2-2&&i<t.len/2+25){a+=t.len+4;continue}let o=!1;for(let e of G.values())e.until>W&&(e.x-n)**2+(e.z-r)**2<(e.r+8)**2&&(o=!0);if(o){a+=t.len+4;continue}}let n=e.stopS-(t.s+t.len/2);t.v=t.v0*(.55+r()*.35),o!==2&&n>-.5&&(t.v=Math.min(t.v,Math.sqrt(5*Math.max(0,n-1.5)))),s.push(t),O.push(t);let c=e.kind!==`st`;(e.plat===void 0||e.plat<=0)&&(e.plat=(c?1:2)+Math.floor(r()*(c?4:5))),a+=t.len+(--e.plat>0?2.4+r()*5.5:(i[0]*2+r()*(i[1]*2.6))*(c?2.3:1))}if(o!==2&&s.length){let t=e.stopS;for(let e=s.length-1;e>=0;e--){let n=s[e];(n.s+n.len/2>t-.3||t-(n.s+n.len/2)<25)&&(n.s=Math.min(n.s,t-n.len/2-.3),t-(n.s+n.len/2)<3&&(n.v=0)),t=n.s-n.len/2-(2.3+r()*1.5)}}{let t=Math.min(e.stopS,e.xst?e.xst[0]:1/0);for(let e of s)e.s+e.len/2<t&&(e.v=Math.min(e.v,Math.sqrt(6*Math.max(0,t-(e.s+e.len/2)-1))))}for(let e=s.length-2;e>=0;e--){let t=s[e],n=s[e+1],r=n.s-n.len/2-(t.s+t.len/2);t.v=Math.min(t.v,n.v+Math.max(0,r-1.5)*.9)}{let t=de(e)*(.8+r()*.4);for(;s.length>Math.ceil(t)||s.length&&r()<.03;){let e=Math.floor(r()*s.length);s[e].dead=!0,s.splice(e,1)}}e.cars=s.concat(e.cars).sort((e,t)=>e.s-t.s),e.spawnGap=i[0]+r()*(i[1]-i[0])},ce=(e,t)=>wi().some(n=>e>n.x0&&e<n.x1&&t>n.z0&&t<n.z1),V=(e,t,n,r=null)=>{for(let i of R){if(i===r)continue;let a=(e-i.ax)*i.ux+(t-i.az)*i.uz;if(a>-n&&a<i.len+n&&Math.abs(ee(i,e,t))<i.hw+n)return!0}return!1},le=e=>{if(e.dbl=null,e.kind===`dr`||e.noPark||e.kind!==`st`&&e.lane!==1)return[];let t=I(e.id*48271+11>>>0),n=[],r=e.parkSides||(e.kind===`st`?[3.9,-3.9]:[3.8]);for(let i of r){if(t()<.12)continue;let r=-e.dz,a=e.dx,o=e.parkSides?i:e.kind===`st`?i-.6:i,s=[];{let t=I(e.id*69621+(i>0?7:3)>>>0),n=e.kind!==`st`,c=(n,i,o,c)=>{let l=Q[n];if(i<8||i>e.len-10)return;let u=e.ax+e.dx*i+r*o,d=e.az+e.dz*i+a*o;Vi(u,d,1.5)||M(u,d,2.8)||P(u,d)||V(u,d,l.len/2+3,e.oneWayBway?e.diag:null)||ce(u,d)||K.nearTurn(u,d,l.len/2+1.6)||((e.dbl??=[]).push({s:i,lat:o,hw:l.wid/2,hl:l.len/2}),s.push({type:n,len:l.len,wid:l.wid,h:l.h,x:u,z:d,ry:-e.heading+(t()-.5)*.05,color:re(n,t()),v:0,parked:!0,haz:c,s:i}))},l=(e,t)=>Math.sign(o)*Math.max(Math.abs(o)-e,t);t()<(n?.2:.26)&&!e.narrow&&c(`truck`,12+t()*(e.len-30),l(1.05,2.45),!0),t()<.16&&!e.narrow&&c([`taxi_hy`,`taxi_mv`,`taxi_gr`,`taxi_hy`][(e.id*7+ +(i>0))%4],10+t()*(e.len-25),l(.35,2.35),!0),n&&t()<.14&&e.stopS>30&&c(`bus`,e.stopS-12-t()*8,l(.4,2.65),!1)}for(let e of s)n.push(e);for(let i=9+t()*5;i<e.len-12;i+=5.9+t()*2.4){if(t()<(e.kind===`st`?.16:.28)||s.some(e=>Math.abs(e.s-i)<e.len/2+3.4))continue;let c=t(),l=c<.08?`taxi`:c<.52?`sedan`:c<.93?`suv`:`truck`;{let t=Math.abs(Math.sin(e.id*12.9898+i*78.233)*43758.5453)%1;l===`taxi`?l=t<.15?`taxi`:t<.55?`taxi_hy`:t<.8?`taxi_mv`:`taxi_gr`:l===`sedan`?l=t<.42?`sedan`:t<.74?`sedan2`:`hatch`:l===`suv`?l=t<.32?`suv`:t<.6?`cross`:t<.88?`suv2`:`pickup`:l===`truck`&&(l=t<.45?`van`:`truck`)}let u=Q[l];(l===`truck`||l===`van`||l===`pickup`)&&(i+=1.3);let d=e.ax+e.dx*i+r*o+(t()-.5)*.2,f=e.az+e.dz*i+a*o+(t()-.5)*.2;if(Vi(d,f,1.5)||M(d,f,2.8)||P(d,f)||V(d,f,u.len/2+3,e.oneWayBway?e.diag:null)||ce(d,f)||K.nearTurn(d,f,u.len/2+1.6))continue;let p=-e.heading+(t()-.5)*.04;n.push({type:l,len:u.len,wid:u.wid,h:u.h,x:d,z:f,ry:p,color:re(l,t()),v:0,parked:!0}),l===`truck`?i+=2.5:(l===`van`||l===`pickup`)&&(i+=.6)}}return n},ue=e=>{let t=Hi*Hi,n=700**2,r=Ui*Ui,i=550**2;for(let a of s){let o=B(a,e.x,e.z)*(a.bridge?.75:1);if(a.far=o>108900?2:+(o>4e4),!a.active&&o<t)a.active=!0,se(a);else if(a.active&&o>n){a.active=!1;for(let e of a.cars)e.dead=!0;a.cars=[]}!a.parked&&o<r?a.parked=le(a):a.parked&&o>i&&(a.parked=null)}O=O.filter(e=>!e.dead),U(e)},H=e=>e.bridge?`br`:e.vmap?`map`:e.oneWayBway?`dg1`:e.diag&&e.kind===`dg`?`dg`:e.kind===`ws`?`ws`:e.kind===`st`?`st`:`av`,de=e=>e.noSpawn||e.blockS<1/0?0:e.len/1e3*qi[H(e)]*Ji*(e.vmap&&e.cz>2400?.6:1)*(e.bridge&&e.dx<0?e.lane===2?0:.35:1),U=e=>{let t=0,n=0,r=[];for(let e of s){if(!e.active)continue;let i=de(e);t+=i,n+=e.cars.length,i-e.cars.length>.6&&r.push(e)}q.want=Math.round(t),q.have=n;let i=0;for(let t of s){if(!t.active||i>=6||t.cars.length<3||t.cars.length<=de(t)*1.5+2)continue;let n=t.cx-e.x,r=t.cz-e.z;if(J.center.set(t.cx,2,t.cz),J.radius=t.len/2+6,!(n*n+r*r<67600&&ze&&Le.intersectsSphere(J))){for(let e of t.cars)if(!e.conn&&e.v<.5&&!e._vis&&!(e.reg&&e.reg.length)){e.dead=!0,i++,q.drain++;break}}}if(i){for(let e of s)e.active&&e.cars.some(e=>e.dead)&&(e.cars=e.cars.filter(e=>!e.dead));O=O.filter(e=>!e.dead)}let a=Math.min(t-n,Wi-O.length);if(a<1||!r.length)return;let o=Math.min(24,Math.ceil(a*.1));for(let t=0;t<60&&o>0;t++){let t=r[Math.floor(te()*r.length)],n=t.cx-e.x,i=t.cz-e.z;if(J.center.set(t.cx,2,t.cz),J.radius=t.len/2+6,n*n+i*i<67600&&ze&&Le.intersectsSphere(J))continue;let a=Math.max(6,(t.xEarly??0)+4),s=Math.min(t.stopS,t.len)-10;if(s-a<8)continue;let c=a+te()*(s-a);if(t.xcr&&t.xcr.some(e=>c>e.stop-12&&c<e.s1+6))continue;let l=!0,u=null,d=0;for(let e of t.cars){if(d+=e.v,Math.abs(e.s-c)<e.len/2+9){l=!1;break}e.s>c&&!u&&(u=e)}if(!l||t.cars.length>1&&d/t.cars.length<1.5||u&&u.v<1&&u.s-c<40)continue;{let e=t.ax+t.dx*c,n=t.az+t.dz*c,r=t.y0===void 0?0:t.y0+(t.y1-t.y0)*c/t.len;for(let t of O)if((t.x-e)**2+(t.z-n)**2<100&&Math.abs(t.y-r)<3){l=!1;break}}if(!l)continue;let f=ae(t,c,0,t.id*2654435761+N*97>>>0),p=(u?u.s-u.len/2:t.stopS)-(c+f.len/2);p<4||(f.v=Math.min(f.v0*.7,Math.sqrt(6*Math.max(0,p-2)),u?u.v+p*.5:99),oe(t.cars,f),O.push(f),o--,q.refill++)}},W=0,pe=[0,0,0],he=e=>{let t=F.pos,n=t.x-e.x,r=t.z-e.z;if(n*n+r*r>2500||t.y>F.ground+2.6||Math.abs(F.ground-e.y)>3)return null;let i=Math.cos(e.ry),a=-Math.sin(e.ry),o=n*i+r*a,s=Math.abs(n*a-r*i),c=Math.max(12,e.v*2.8+9);if(o>0&&o<e.len/2+c&&s<e.wid/2+Ki+.8){if(e._pAlong=o,e._pLat=s,s<e.wid/2+Ki+.3)return o-e.len/2-Ki-1.4;e._pSoft=!0}return null},G=new Map,_e=e=>{if(!G.size)return null;let t=null,n=Math.cos(e.ry),r=-Math.sin(e.ry);for(let i of G.values()){if(i.until<W)continue;let a=i.x-e.x,o=i.z-e.z,s=a*n+o*r,c=Math.abs(a*r-o*n);if(a*a+o*o<(i.r+e.len*.3)**2&&s<i.r*.6)return e.inZone=!0,0;if(s>0&&c<i.r+e.wid/2&&s<i.r+Math.max(25,e.v*3+12)){let n=s-Math.sqrt(Math.max(0,(i.r+e.wid/2)**2-c*c))-e.len/2-1.5;(t===null||n<t)&&(t=n)}}return t};for(let e of s){let t=e.diag?.w??0;if(e.kind===`av`||e.kind===`dg`)e.latL=.3,e.latR=e.lane===1?e.kind===`dg`?.45:.25:.35;else if(e.kind===`ws`)e.latL=.22,e.latR=.22;else if(e.narrow)e.latL=.2,e.latR=.2;else if(e.bridge)e.latL=.25,e.latR=.25;else if(e.diag){let n=!!e.diag.oneway||t<12&&!e.vmap;e.latL=n?Math.min(.35,Math.max(0,t/2-1.6)):Math.min(.3,Math.max(0,(t/2-2.55)/2)),e.latR=n?e.latL:Math.min(.3,Math.max(0,t/4-1.5))}else e.latL=.4,e.latR=.3}let ve=(e,t,n)=>{e.odo+=e.v*n;let r=e.s-e.len/2,i=t.len-e.s-e.len/2,a=Math.min(r,i)/10;a=a<=0?0:a>=1?1:a*a*(3-2*a);let o=Math.max(0,(e.wid-1.9)/2),s=Math.max(0,t.latR-o),c=-Math.max(0,t.latL-o),l=Math.max(c,Math.min(s,e.latB+e.latA*Math.sin(e.odo*e.latK+e.latP)))*a;if(t.dbl)for(let n of t.dbl){let t=Math.abs(n.s-e.s),r=n.hl+e.len/2;if(t>r+10)continue;let i=t<r+1?1:1-(t-r-1)/9,a=n.hw+e.wid/2+.35;if(n.lat>0){let e=n.lat-a;e<l&&(l+=(e-l)*i)}else{let e=n.lat+a;e>l&&(l+=(e-l)*i)}}let u=l-e.lat,d=Math.sign(u)*Math.min(Math.abs(u),.8*n);if(e.lat+=d,e.latV=d/Math.max(n,1e-4),e.wob+=n*.45,e.lcDur>0){e.lcT+=n;let t=Math.min(1,e.lcT/e.lcDur),r=t*t*(3-2*t),i=e.lc0*(1-r);e.latV+=(i-e.lc)/Math.max(n,1e-4),e.lc=i,t>=1&&(e.lc=0,e.lcDur=0)}e.yaw=Math.max(-.2,Math.min(.2,e.latV/Math.max(e.v,2.5)))+.004*Math.sin(e.wob)*a},ye=(e,t,n,r)=>{if(e.lcCool=2.5+e.rng()*5,t.kind===`st`||e.lcDur>0||e.reg&&e.reg.length||e.wait||e.s<20||t.len-e.s<45||e.v<3)return!1;for(let n of t.xm)if(n.base>e.s-25&&n.base<e.s+50)return!1;let i=t.alt.link;if(!i.active||i.blockS<1/0||i.noSpawn)return!1;let a=n[r+1],o=a&&a.v<e.v0*.6&&a.s-e.s<40;if(!o&&e.rng()>.12)return!1;let s=null,c=null;for(let t of i.cars){if(t.s>=e.s){s=t;break}c=t}if(s&&(s.s-s.len/2-(e.s+e.len/2)<Math.max(14,e.v*1.5+6)||o&&s.v<e.v)||c&&(c.conn||e.s-e.len/2-(c.s+c.len/2)<Math.max(12,c.v*1.7+6+Math.max(0,c.v-e.v)*2.5)))return!1;let l=n[r-1];if(l&&e.s-e.len/2-(l.s+l.len/2)<10+Math.max(0,l.v-e.v)*3)return!1;if(i.dbl){for(let t of i.dbl)if(t.s>e.s-15&&t.s<e.s+60)return!1}return n.splice(r,1),oe(i.cars,e),e.lc0=e.lc=(t.ax-i.ax)*-i.dz+(t.az-i.az)*i.dx,e.lcT=0,e.lcDur=3.2+e.rng()*1.6,e.lcFrom=t,e.link=i,(t.lcOut??=[]).push(e),e.pre=null,e.next=ie(e,i),q.lc++,!0},be=(e,t=null)=>{let r=n(W,`av`),i=n(W,`st`);for(let e of s){if(!e.active||t!==null&&e.far!==t)continue;let n=e.cars;for(let e=1;e<n.length;e++){let t=n[e],r=e-1;for(;r>=0&&n[r].s>t.s;)n[r+1]=n[r],r--;n[r+1]=t}}for(let n of s){if(!n.active||t!==null&&n.far!==t)continue;let a=n.cars,o=a.length,s=n.signal?n.mapSig?gi(W,n.axis):n.axis===`av`?r:i:2;for(let t=o-1;t>=0;t--){let c=a[t],l=c.s+c.len/2,u=1e4,d=c.v,f=t+1;if(c.conn)for(;f<o&&a[f].conn&&a[f].conn!==c.conn;)f++;let p=`free`,m=null;if(f<o){let e=a[f];u=e.s-e.len/2-l,d=e.v,p=`lead`,m=e}else if(c.next&&c.next.link.active&&!c.conn){let e=c.next.link,t=xe(n,c.next);for(let r=0;r<e.cars.length;r++){let i=e.cars[r];if(!(i.conn&&i.conn!==t)){u=n.len-l+t.len+(i.s-i.len/2),d=i.v,p=`next`,m=i;break}}}let h=c.v0;if(c._red=!1,c.lcDur>0&&Math.abs(c.lc)>1.2&&c.lcFrom){for(let e of c.lcFrom.cars)if(e.s>c.s){let t=e.s-e.len/2-l;t<u&&(u=t,d=e.v,p=`lcold`,m=e);break}}if(n.lcOut)for(let e=n.lcOut.length-1;e>=0;e--){let t=n.lcOut[e];if(t.dead||t.lcDur<=0||Math.abs(t.lc)<=1.2||t.lcFrom!==n)n.lcOut.splice(e,1);else if(t!==c&&t.s>c.s){let e=t.s-t.len/2-l;e<u&&(u=e,d=t.v,p=`lcnew`,m=t)}}if(n.blockS<1/0&&c.s<n.blockS+3){let e=n.blockS-l;e>-2&&e<u&&(u=Math.max(.05,e),d=0)}if(c.conn)c.conn.turn!==`S`&&(h=Math.min(h,5.5));else{let e=n.len-l;c.next&&c.next.turn!==`S`&&(h=Math.min(h,4.8+.3*Math.max(0,e)));let t=n.stopS-l;if(n.signal&&t>-.4){let e=s===0||s===1&&t>c.v*1.3+1.5;if(!e&&c.next){let t=c.next.link.xwStart,r=n.xwEnd;(t&&t.peds>0||r&&r.peds>0)&&(e=!0)}e&&c.next&&c.reg&&K.holds(c,K.moveFor(n,c.next))&&(e=!1),e&&t<u&&(u=t,d=0,p=`red`),c._red=e&&t<30}if(n.xst){let e=n.axis===`av`?r:i;if(e!==2)for(let t=0;t<n.xst.length;t++){let r=n.xst[t]-l;if(!(r<=-.4)){if(c.reg&&n.xm[t]&&K.holds(c,n.xm[t]))break;(e===0||r>c.v*1.3+1.5)&&r<u&&(u=Math.max(.05,r),d=0,p=`xred`);break}}}c.next}{let e=K.car(c,l,t+1<o?a[t+1]:null,W,we,Te,ie);e.gap<u&&(u=Math.max(.05,e.gap),d=e.vL,p=e.why,m=e.whyC)}if(c._why=p,c._whyC=m,c.creepT>0||c.stillT>12&&m&&!c._red&&(c.creepT=Oe(c))){c.creepT-=e;let t=ke(c);t>.3&&(u=t,d=0,h=Math.min(h,2),p=`creep`,m=null,c._why=p,c._whyC=null)}c._pAlong=null,c._pSoft=!1,c.inZone=!1;let g=_e(c);g!==null&&g<u&&(u=Math.max(.05,g),d=0);let _=he(c);c._pSoft&&(h=Math.min(h,2.2+Math.max(0,c._pAlong-c.len/2-6)*.35));let v=!1;_!==null&&_<u&&(u=Math.max(.05,_),d=0,v=!0);let y=c.v-d,b=c.dS0+Math.max(0,c.v*c.dTH+c.v*y/(2*Math.sqrt(c.dA*Gi))),x=c.dA*(1-(c.v/h)**4-(b/Math.max(u,.1))**2);if(x=Math.max(v&&_<c.v*c.v/12+1?-13:-9,Math.min(c.dA,x)),c.acc=x,c.v=Math.max(0,c.v+x*e),c._pAlong!==null&&c._pLat<c.wid/2+Ki+.1){let t=c._pAlong-c.len/2-Ki-.25;c.v*e>t&&(c.v=0,c.acc=-9)}if(c.s+=c.v*e,c.conn?(c.lat=0,c.lc=0,c.latV=0,c.yaw=0):(!n.far||c.lcDur>0)&&ve(c,n,e),c.v<.1&&!c._red?(c.stuckT+=e,c.stuckT>60&&!c._vis&&(c.dead=!0,q.broken++)):c.stuckT=0,c.stillT=c.v<.3?c.stillT+e:0,c.brake=+(x<-.6||c.v<.4),c.inZone&&(c.v=Math.max(0,c.v-12*e),c.brake=+(W*1.6%1<.5)),c.pitch+=((x<-1.5?Math.min(.025,-x*.004):0)-c.pitch)*Math.min(1,e*6),v&&c.v<1&&u<6){if(c.blockT+=e,c.blockT>.7&&W>c.honkT){c.honkT=W+2.2+c.rng()*3;let e=Math.hypot(F.pos.x-c.x,F.pos.z-c.z);D(e,Q[c.type].big,c.x,c.z,c.y??0),Ve.push({type:`honk`,x:c.x,z:c.z,t:W})}}else c.blockT=Math.max(0,c.blockT-e)}}for(let n of s){if(!n.active||t!==null&&n.far!==t)continue;let r=n.cars;for(let t=r.length-1;t>=0;t--){let i=r[t];if(i.dead)r.splice(t,1);else if(!(n.alt&&!n.far&&!i.conn&&(i.lcCool-=e)<0&&ye(i,n,r,t))&&(i.conn&&i.s>=0&&(i.conn=null,i.next=i.pre&&i.pre.L===n?i.pre.opt:ie(i,n),i.pre=null),!i.conn&&i.s>n.len)){r.splice(t,1);let e=i.next;if(!e||!e.link.active||c[n.to].deadEnd&&!i._vis){i.dead=!0;continue}let a=xe(n,e),o=K.moveFor(n,e);i.via=o,K.register(i,o),i.conn=a,i.link=e.link,i.s=i.s-n.len-a.len,oe(e.link.cars,i)}}}for(let e of s){if(!e.active||t!==null&&e.far!==t||O.length>=Wi)continue;let n=c[e.from],r=!1;for(let e of n.inLinks)if(e.active){r=!0;break}if(r||e.blockS<1/0)continue;let i=e.cars[0];if(!i||i.s-i.len/2>(e.spawnGap||20)+7.5){let t=ae(e,0,0,e.id*2654435761+N*97>>>0);t.s=t.len/2,t.v=t.v0*.8,i&&(t.v=Math.min(t.v,i.v+Math.max(0,i.s-i.len/2-t.len-2)*.6)),e.cars.unshift(t),O.push(t),e.spawnGap=(e.kind===`st`?12:8)+t.rng()*35,e.plat>0||(e.plat=(e.kind===`st`?2:1)+Math.floor(t.rng()*(e.kind===`st`?5:4))),e.spawnGap=--e.plat>0?2.5+t.rng()*5:e.kind===`st`?30+t.rng()*70:50+t.rng()*140}}O.some(e=>e.dead)&&(O=O.filter(e=>!e.dead)),K.tick(W)},xe=(e,t)=>{let n=e.conn.get(t.link.id);return n||(n=Oi(e,t.link,t.turn),e.conn.set(t.link.id,n)),n},K=zi(t,xe),q={broken:0,lc:0,refill:0,drain:0},Se=new C(1e9,0,0),Ce=(e,t=null)=>t&&t.mapSig?gi(W,e):n(W,e),we=(e,t,n)=>{let r=t.kind===`x`?t.L:t.inL;if(t.kind===`x`||r.signal){let t=Ce(r.axis,r);if(t===0||t===1&&n>e.v*1.3+1.5)return!0}if(t.kind===`c`&&r.signal){let e=t.outL.xwStart,n=r.xwEnd;if(e&&e.peds>0||n&&n.peds>0)return!0}return!1},Te=(e,t)=>(t.kind===`x`||t.inL.signal)&&Ce((t.kind===`x`?t.L:t.inL).axis,t.kind===`x`?t.L:t.inL)===0;for(let e of s)e.mapSig=!!(e.signal&&(e.vmap&&!c[e.to].av||c[e.to].bridgeT));let Ee=[0,0,0],De=[0,0,0],Oe=e=>{let t=e._whyC,n=0,r=e.id;for(;t&&n++<16;){if(t===e)return r===e.id?3:0;t.id<r&&(r=t.id),t=t._whyC}return 0},ke=e=>{let t=[];for(let n of O)n!==e&&Math.abs(n.x-e.x)<20&&Math.abs(n.z-e.z)<20&&t.push(n);let n=e.link,r=e.conn,i=0;for(let a=.5;a<=4;a+=.5){let o,s,c;if(r){let t=e.s+a+r.len;if(t>r.len)break;Ai(r,t,Ee),o=Ee[0],s=Ee[1],c=Ee[2]}else{let t=e.s+a;if(t>n.len)break;o=n.ax+n.dx*t,s=n.az+n.dz*t,c=n.heading}let l=Math.cos(c),u=Math.sin(c),d=!1;for(let n of t){let t=Math.cos(n.ry),r=-Math.sin(n.ry),i=n.x-o,a=n.z-s;for(let[o,s]of[[l,u],[-u,l],[t,r],[-r,t]]){let c=(e.len/2+.3)*Math.abs(l*o+u*s)+(e.wid/2+.2)*Math.abs(-u*o+l*s),f=n.len/2*Math.abs(t*o+r*s)+n.wid/2*Math.abs(-r*o+t*s);if(Math.abs(i*o+a*s)>c+f){d=!1;break}d=!0}if(d)break}if(d)break;i=a}return i},Ae=(e,t,n,r,i)=>{if(r<0&&t){let e=t.len+r;return i[0]=t.ax+t.dx*e,i[1]=t.az+t.dz*e,i}if(r>e.len){let t=r-e.len;return i[0]=n.ax+n.dx*t,i[1]=n.az+n.dz*t,i}return Ai(e,Math.max(0,r),i)},je=e=>{let t=e.link;if(e.conn){let n=e.conn,r=e.s+n.len;Ai(n,r,pe),e.x=pe[0],e.z=pe[1];let i=e.len*.3,a=e.via&&e.via.C===n?e.via.inL:null;Ae(n,a,t,r-i,Ee),Ae(n,a,t,r+i,De),e.ry=-Math.atan2(De[1]-Ee[1],De[0]-Ee[0]);let o=a&&a.y1!==void 0?a.y1:0,s=t.y0===void 0?0:t.y0;e.y=o+(s-o)*Math.max(0,Math.min(1,r/n.len)),e.gp=Math.atan((s-o)/Math.max(1,n.len))}else{let n=e.lat+e.lc;e.x=t.ax+t.dx*e.s-t.dz*n,e.z=t.az+t.dz*e.s+t.dx*n,e.ry=-t.heading-e.yaw,t.y0===void 0?(e.y=0,e.gp=0):(e.y=t.y0+(t.y1-t.y0)*Math.max(0,Math.min(1,e.s/t.len)),e.gp=Math.atan(t.grade))}},Me=[],Ne=()=>{Me.length=0;let e=F.pos;for(let t of O)Math.abs(t.x-e.x)<40&&Math.abs(t.z-e.z)<40&&Me.push(t);for(let t of s)if(t.parked&&t.parked.length&&!(Math.abs(t.cx-e.x)>t.len/2+50||Math.abs(t.cz-e.z)>t.len/2+50))for(let n of t.parked)Math.abs(n.x-e.x)<40&&Math.abs(n.z-e.z)<40&&Me.push(n)},Pe=new C,Fe=new C,Ie=(e,t=.4,n=1.8)=>{let r=!1,i=!1,a=-1/0,o=null,s=e.x,c=e.z,l=Me.length?Me:O.filter(t=>Math.abs(t.x-e.x)<20&&Math.abs(t.z-e.z)<20);for(let u of l){let l=s-u.x,d=c-u.z;if(l*l+d*d>(u.len/2+t+1)**2)continue;let f=Math.cos(u.ry),p=-Math.sin(u.ry),m=l*f+d*p,h=-l*p+d*f,g=u.len/2-.05,_=u.wid/2,v=u.parked?0:u.y,y=v+u.h;if(e.y>y-.35&&e.y<y+.7&&Math.abs(m)<g+t*.3&&Math.abs(h)<_+t*.3){y>a&&(a=y,i=!0,o=u.parked?null:Fe.set(f*u.v,0,p*u.v)),r=!0;continue}if(e.y>=y-.35||e.y+n<v+.1)continue;let b=Math.max(-g,Math.min(g,m)),x=Math.max(-_,Math.min(_,h)),S=m-b,C=h-x,w=Math.hypot(S,C),T=0,E=0,D=0;if(w>1e-4){if(w>=t)continue;T=t-w,E=S/w,D=C/w}else{let e=g-Math.abs(m),n=_-Math.abs(h);e<n?(T=e+t,E=Math.sign(m)||1):(T=n+t,D=Math.sign(h)||1)}let O=(E*f-D*p)*T,k=(E*p+D*f)*T;s+=O,c+=k,r=!0,!u.parked&&u.v>.5&&(o=Fe.set(f*u.v,0,p*u.v))}if(!r)return null;Pe.set(s-e.x,0,c-e.z);let u={push:Pe};return i&&(u.grounded=!0,u.groundY=a),o&&(u.velocity=o),u},Le=new i,Re=new g,J=new m,ze=!1,Be=0,Ve=[],He=!1,Ue=(e,t)=>{if(!He&&j.proxyShadows&&!ge(`noproxy`)){He=!0;for(let e in l)l[e].proxy&&(l[e].hi.mesh.userData.maxCascade=1,l[e].low.mesh.userData.maxCascade=1)}let n=(Be++&1)==1;for(let e of u)n&&e.farTier||e.begin();p.begin(),h.begin();let r=k.enabled&&A.value>.01;x=0;let i=e.position;e.updateMatrixWorld(),Re.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),Le.setFromProjectionMatrix(Re),ze=!0;let a=(e,a)=>{let o=e.x-i.x,s=e.z-i.z,c=o*o+s*s;if(t){let n=o*t.dir.x+s*t.dir.z,r=Math.abs(o*t.dir.z-s*t.dir.x);if(n>-6&&n<t.len&&r<t.half+e.len*.3)return}let u=a||e.haz!==void 0;if(r&&u&&c<4e4&&x<_){let t=e.len*.5+15;J.center.set(e.x+Math.cos(e.ry)*t,1.5+(a?e.y:0),e.z-Math.sin(e.ry)*t),J.radius=18,(c<400||Le.intersectsSphere(J))&&(v[x]=e,y[x++]=c)}let d=c<2304?`hi`:c<52900?`low`:`far`;if(n&&d===`far`){a&&(e._vis=!0);return}if(a&&(e._vis=!1),c>1600&&(J.center.set(e.x,1.5+(a?e.y:0),e.z),J.radius=e.len*.6+1,!Le.intersectsSphere(J)))return;a&&(e._vis=!0);let f=a?e.y:0,m=a?e.pitch+e.gp:0;l[e.type][d].push(e.x,f,e.z,e.ry,e.color,a?e.brake:e.haz?+((W*1.5+e.x*.01)%1<.5):u?0:-1,m,e.adSeed??=Math.random()),d!==`far`&&He&&l[e.type].proxy?.push(e.x,f,e.z,e.ry,e.color,0,m),f>.5||(d!==`far`&&p.push(e.x,e.z,e.ry,Q[e.type].len,Q[e.type].wid),a&&c<62500&&!r&&h.push(e.x,e.z,e.ry,Q[e.type].len))};for(let e of O)je(e),a(e,!0);for(let e of s){if(!e.parked||!e.parked.length)continue;let t=e.cx-i.x,n=e.cz-i.z;if(!(t*t+n*n>(Ui+e.len/2)**2))for(let t of e.parked)a(t,!1)}for(let e of u)n&&e.farTier||e.end();p.end(),h.end()},We=0,Ge=0,Ke=0,Y={cars:()=>O,links:s,roads:t,events:Ve,VTYPES:Q,_dbg:{player:F,playerObstacle:he},_jx:K,_time:()=>W,ms:{step:0,render:0,stream:0,streamMax:0,stepMax:0,renderMax:0},setPlayer(e,t,n){F.pos.copy(e),t&&F.vel.copy(t),F.t=W,F.ground=n??0},collideDynamic:Ie,zone(e,t,n=18,r=!0,i=1e9){r?G.set(e,{x:t.x,z:t.z,r:n,until:W+i}):G.delete(e)},zones:G,setDensity(e){Ji=Math.max(0,e)},alarm(e,t=30){G.set(`alarm:`+Math.round(e.x/10)+`,`+Math.round(e.z/10),{x:e.x,z:e.z,r:Math.min(t,22),until:W+8});for(let n of O)Math.hypot(n.x-e.x,n.z-e.z)<t&&(n.v*=.3,W>n.honkT&&(n.honkT=W+3,D(Math.hypot(F.pos.x-n.x,F.pos.z-n.z),Q[n.type].big,n.x,n.z,n.y??0)))},update(e,t,n,r=null){W=n;let i=t.position;if(Se.copy(i),z-=e,z<=0||i.distanceToSquared(L)>225){let e=performance.now();ue(i),L.copy(i),z=.3;let t=performance.now()-e;Y.ms.stream+=(t-Y.ms.stream)*.2,t>Y.ms.streamMax&&(Y.ms.streamMax=t)}let a=e>1/24?2:1,o=performance.now();for(let t=0;t<a;t++)be(e/a,0);We++,We%2==0&&be(Math.min(.1,e+Ge),1),Ke+=e,We%4==0&&(be(Math.min(.2,Ke),2),Ke=0),Ge=e;let s=performance.now();for(Ue(t,r),Y.ms.step+=(s-o-Y.ms.step)*.05,Y.ms.render+=(performance.now()-s-Y.ms.render)*.05,Y.ms.stepMax=Math.max(Y.ms.stepMax,s-o),Y.ms.renderMax=Math.max(Y.ms.renderMax,performance.now()-s),Ne();Ve.length&&W-Ve[0].t>3;)Ve.shift()},stats(){let e=0;for(let t of s)t.active&&e++;let t=0;for(let e of u)e.mesh.userData.smallCasters||(t+=e.n);return{cars:O.length,activeLinks:e,drawn:t,junction:{...K.stats(),broken:q.broken,laneChanges:q.lc,refill:q.refill,drain:q.drain,want:q.want,have:q.have}}}};return Y}var aa=_e(`city/tex/`);function oa(e,t=5){return new Promise((n,r)=>{let i=0,a=()=>{let o=new Image;o.onload=()=>n(o),o.onerror=()=>++i<t?setTimeout(a,250*2**i):r(Error(`texture failed to load: `+e)),o.src=e};a()})}function sa(e){return oa(aa+e)}function $(e,{srgb:t=!1,repeat:n=!0,aniso:i=8}={}){let a=new v(e);return a.colorSpace=t?o:``,n&&(a.wrapS=a.wrapT=l),a.anisotropy=i,a.generateMipmaps=!0,a.minFilter=r,a.magFilter=s,a.needsUpdate=!0,a}function ca(e,t,{srgb:n,aniso:i}){let a=e.reduce((e,t)=>e+Math.round(t.height/t.width),0),c=new Uint8Array(t*t*4*a),u=document.createElement(`canvas`);u.width=t,u.height=t;let d=u.getContext(`2d`,{willReadFrequently:!0}),f=0;for(let n of e){let e=Math.round(n.height/n.width);for(let r=0;r<e;r++){d.clearRect(0,0,t,t),d.drawImage(n,0,r*n.width,n.width,n.width,0,0,t,t);let e=d.getImageData(0,0,t,t).data;for(let n=0;n<t;n++){let r=(t-1-n)*t*4;c.set(e.subarray(r,r+t*4),(f*t*t+n*t)*4)}f++}}let m=new p(c,t,t,a);return m.colorSpace=n?o:``,m.wrapS=m.wrapT=l,m.generateMipmaps=!0,m.minFilter=r,m.magFilter=s,m.anisotropy=i,m.needsUpdate=!0,m}async function la(e){let t=Math.min(16,e.capabilities.getMaxAnisotropy()),n=Object.fromEntries(await Promise.all([`asphalt_col`,`asphalt_nrm`,`asphalt_macro`,`sidewalk_col`,`sidewalk_nrm`,`walls_col.jpg`,`walls_nrm.webp`,`walls_hao.jpg`,`curb_col.webp`,`asphalt_decals.webp`,`interiors`,`signs`,`markings`,`leaves`,`grass_col`,`grass_nrm`,`water_nrm`,`noise`,`detail_nrm`].map(async e=>[e.replace(/\..*/,``),await sa(e.includes(`.`)?e:e+`.png`)]))),r=await(await fetch(aa+`markings.json`)).json(),i={asphaltCol:$(n.asphalt_col,{srgb:!0,aniso:t}),asphaltNrm:$(n.asphalt_nrm,{aniso:t}),asphaltMacro:$(n.asphalt_macro,{aniso:t}),sidewalkCol:$(n.sidewalk_col,{srgb:!0,aniso:t}),sidewalkNrm:$(n.sidewalk_nrm,{aniso:t}),interiors:$(n.interiors,{srgb:!0,repeat:!1,aniso:4}),signs:$(n.signs,{srgb:!0,repeat:!1,aniso:t}),markings:$(n.markings,{srgb:!0,repeat:!1,aniso:t}),leaves:$(n.leaves,{repeat:!1,aniso:4}),grassCol:$(n.grass_col,{srgb:!0,aniso:t}),grassNrm:$(n.grass_nrm,{aniso:t}),detailNrm:$(n.detail_nrm,{aniso:t}),waterNrm:$(n.water_nrm,{aniso:t}),noise:$(n.noise,{aniso:4}),markRects:r};return i.wallsCol=ca([n.walls_col],1024,{srgb:!0,aniso:t}),i.wallsNrm=ca([n.walls_nrm],512,{srgb:!1,aniso:t}),i.asphaltDecals=$(n.asphalt_decals,{repeat:!1,aniso:t}),i.curbCol=$(n.curb_col,{srgb:!0,aniso:t}),i.wallsHao=ca([n.walls_hao],512,{srgb:!1,aniso:t}),i}export{rn as $,rt as $t,Br as A,Oe as An,Et as At,_n as B,be as Bn,gt as Bt,Kr as C,Fe as Cn,Nt as Ct,Hr as D,je as Dn,kt as Dt,Ur as E,Me as En,At as Et,Qn as F,Ce as Fn,xt as Ft,fn as G,dt as Gt,hn as H,mt as Ht,xn as I,Se as In,bt as It,ln as J,ct as Jt,dn as K,ut as Kt,bn as L,q as Ln,yt as Lt,Jn as M,Ee as Mn,wt as Mt,qn as N,Te as Nn,Ct as Nt,Vr as O,Ae as On,Ot,Xn as P,we as Pn,St as Pt,an as Q,it as Qt,yn as R,K as Rn,vt as Rt,qr as S,Ie as Sn,Pt as St,Wr as T,Ne as Tn,jt as Tt,mn as U,pt as Ut,gn as V,ye as Vn,ht as Vt,pn as W,ft as Wt,sn as X,ot as Xt,cn as Y,st as Yt,on as Z,at as Zt,Qr as _,Be as _n,zt as _t,_i as a,Ze as an,Zt as at,Yr as b,Re as bn,It as bt,pi as c,Je as cn,Jt as ct,ii as d,Ke as dn,Gt as dt,nt as en,nn as et,ri as f,Ge as fn,Wt as ft,$r as g,Ve as gn,Bt as gt,ei as h,He as hn,Vt as ht,Bi as i,Qe as in,Qt as it,Yn as j,De as jn,Tt as jt,zr as k,ke as kn,Dt as kt,mi as l,qe as ln,qt as lt,ti as m,Ue as mn,Ht as mt,oa as n,et as nn,en as nt,gi as o,Xe as on,Xt as ot,ni as p,We as pn,Ut as pt,un as q,lt as qt,ia as r,$e as rn,$t as rt,hi as s,Ye as sn,Yt as st,la as t,tt as tn,tn as tt,ai as u,Y as un,Kt as ut,Zr as v,ze as vn,Rt as vt,Gr as w,Pe as wn,Mt as wt,Jr as x,Le as xn,Ft as xt,Xr as y,J as yn,Lt as yt,vn as z,xe as zn,_t as zt};
//# sourceMappingURL=world~index~index-IWBzlox9.js.map