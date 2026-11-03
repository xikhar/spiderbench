// grandcentral shader sections. Use parseShaderSections() to select an injection chunk.
// @section vertexCommon
#include <common>
in float aPart;
out float vGP;
out vec3 vGW;
out vec3 vGN;
// @section vertexFogVertex
#include <fog_vertex>
vGP = aPart;
vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGN = normalize(mat3(modelMatrix) * objectNormal);
// @section fragmentCommon
#include <common>
uniform sampler2D tGN;
in float vGP;
in vec3 vGW;
in vec3 vGN;
uniform highp sampler2DArray tGWC;
uniform highp sampler2DArray tGWH; // (textures r5)
float gh(vec2 p) {
return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
float gV = 0.0;   // (street r8) verdigris amount (bronze part 8)
float gH = 0.0;   // (street r2) carved height (m, <= 0 in joints) -> bump-mapped normal
vec3 gcPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
vec3 vSigmaX = normalize(dFdx(surf_pos)), vSigmaY = normalize(dFdy(surf_pos)), vN = surf_norm;
vec3 R1 = cross(vSigmaY, vN), R2 = cross(vN, vSigmaX);
float fDet = dot(vSigmaX, R1) * faceDir;
vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
return normalize(abs(fDet) * surf_norm - vGrad);
}
// @section fragmentMap
#include <map_fragment>
{
vec3 an = abs(vGN);
vec2 q = an.x > an.z ? vGW.zy : vGW.xy;
if(an.y > 0.7) q = vGW.xz;
vec3 nz = texture(tGN, q / 13.0).rgb, nz2 = texture(tGN, q / 2.7 + 0.31).rgb;
int part = int(vGP + 0.5);
vec3 c = diffuseColor.rgb;
if(part == 0) {
// limestone ashlar: 0.75 m courses, 1.5 m blocks, thin joints; per-block tone; grime washing down
float cy = q.y / 0.62, row = floor(cy), cx = q.x / 1.25 + 0.5 * mod(row, 2.0);
vec2 f = vec2(fract(cx), fract(cy));
vec2 fw = fwidth(vec2(cx, cy)) * 1.5 + 1e-4;
float joint = max(1.0 - smoothstep(0.0, 0.025 + fw.x, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, 0.035 + fw.y, min(f.y, 1.0 - f.y)));
joint *= (1.0 - smoothstep(0.15, 0.5, max(fw.x, fw.y))) * (1.0 - an.y);
float blk = gh(floor(vec2(cx, cy)));
c *= (0.94 + 0.07 * blk) * (0.86 + 0.22 * nz.r) * (0.94 + 0.08 * nz2.g);
c *= 1.0 - 0.17 * joint;
// channelled rustication on the ground storey (below the terrace string course): deep horizontal joints
float rus = (1.0 - smoothstep(8.4, 8.8, vGW.y)) * (1.0 - an.y);
float jr = 1.0 - smoothstep(0.0, 0.07 + fw.y, min(f.y, 1.0 - f.y));
c *= 1.0 - 0.22 * jr * rus;
gH = - 0.018 * joint - 0.05 * jr * rus;
// rain streaks washing down from sills / cornices
float stk = texture(tGN, vec2(q.x / 1.9, vGW.y / 34.0) + 0.17).r;
c *= 1.0 - 0.22 * smoothstep(0.45, 0.8, stk) * (1.0 - an.y); // (street r8) 0.13 -> 0.22
} else if(part == 1 || part == 3 || part == 7) {
c *= (0.88 + 0.2 * nz.r) * (0.94 + 0.08 * nz2.g);
if(part == 7) { // (street r6) fluted column shafts: 24 flutes from the normal's azimuth (bump + cavity shade)
float az = atan(vGN.z, vGN.x) * 12.0 / 3.14159265;
float fl = abs(fract(az) - 0.5) * 2.0;           // 0 at the arris, 1 mid-flute
float cav = smoothstep(0.15, 0.95, fl);
gH = - 0.06 * cav;
c *= 1.0 - 0.2 * cav * (1.0 - an.y);
}
} else if(part == 8) {
// (street r8) patinated bronze statuary: dark oily bronze, verdigris washing over up-facing surfaces, runs below
float up = clamp(vGN.y * 0.5 + 0.5, 0.0, 1.0);
float n1 = texture(tGN, vGW.xy / 0.9 + vGW.z * 0.31).g, n2 = texture(tGN, vec2(vGW.x / 0.35 + vGW.z * 0.2, vGW.y / 3.0) + 0.21).r;
gV = clamp(smoothstep(0.45, 0.95, up) * 0.75 + smoothstep(0.5, 0.78, n2) * 0.55 + (n1 - 0.5) * 0.5, 0.0, 1.0);
c = mix(c * (0.75 + 0.45 * n1), vec3(0.33, 0.45, 0.38) * (0.85 + 0.3 * n2), gV * 0.8);
} else if(part == 2) {
// weathered copper: verdigris streaks running down the slope, darker seams
float st = texture(tGN, vec2(q.x / 3.0, vGW.y / 40.0)).g;
float st2 = texture(tGN, vec2(q.x / 0.9, q.y / 14.0) + 0.5).b;
c *= (0.72 + 0.34 * st) * (0.85 + 0.25 * st2) * (0.9 + 0.15 * nz2.r);
c = mix(c, vec3(dot(c, vec3(0.33))), 0.25);   // chalky, desaturated verdigris
float sw = fwidth(q.x / 1.2) * 1.5 + 1e-4;
float seam = smoothstep(0.9 - sw, 0.9, abs(fract(q.x / 1.2) - 0.5) * 2.0) * (1.0 - smoothstep(0.1, 0.4, sw));
c *= 1.0 - 0.12 * seam;
// (street r11) critic: 'copper roof is a flat saturated mint plane'. Old weathered copper: dark brown-bronze
// base showing through in broad blotches and long rain runs down the slope, the verdigris only as a
// streaky chalky crust (paler where the water washes), soot-dark near the eaves. gV carries the crust amount
// into the roughness (crust matte, bare metal satiny).
float cb = texture(tGN, q / 9.0 + 0.37).r, cr = texture(tGN, vec2(q.x / 1.6, vGW.y / 22.0) + 0.61).g;
float crust = clamp(smoothstep(0.3, 0.72, cb) * 0.7 + smoothstep(0.35, 0.8, cr) * 0.55 - 0.1, 0.0, 1.0);
vec3 bare = vec3(0.24, 0.2, 0.15) * (0.8 + 0.4 * st2);
vec3 verd = vec3(0.43, 0.52, 0.46) * (0.82 + 0.3 * st) * (0.9 + 0.2 * cr);
c = mix(bare, verd, crust) * (0.9 + 0.12 * nz2.r);
c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 3.5, vGW.y - __SHADER_INJECT_0__));   // soot at the eaves
c *= 1.0 - 0.12 * seam;
gV = crust;
} else if(part == 6) {
c *= (0.7 + 0.5 * texture(tGN, vGW.xz / 1.3 + vGW.y * 0.3).g) * (0.8 + 0.3 * nz2.r);
} else if(part == 4) {
c *= (0.85 + 0.25 * nz.r) * (0.92 + 0.12 * nz2.b);
// (street r5) deck wear: rectangular utility patches (darker fresh tar / paler old), oil blotches, sealed joints
vec2 pc = floor(vGW.xz / vec2(3.1, 4.3));
float ph = gh(pc), ph2 = gh(pc + 7.0);
vec2 pf = fract(vGW.xz / vec2(3.1, 4.3));
float pm = step(0.84, ph) * step(0.12, pf.x) * step(pf.x, 0.88) * step(0.1, pf.y) * step(pf.y, 0.82);
c *= mix(1.0, ph2 > 0.5 ? 0.78 : 1.12, pm);
c *= 1.0 - 0.22 * smoothstep(0.62, 0.8, texture(tGN, vGW.xz / 5.3 + 0.21).b);
float jn = abs(fract(vGW.z / 9.0) - 0.5) * 2.0;
c *= 1.0 - 0.3 * smoothstep(0.975, 0.995, jn);
// (street r6) critic: 'smooth grey slab, no tyre wear / oil'. On the Park Av ramp (two lanes along z): polished
// darker wheel paths, an oil-drip stripe down each lane centre, and a dark wet gutter line at both parapets.
float lx = vGW.x - __SHADER_INJECT_1__;
if(abs(lx) < 3.7) {
float lc = abs(abs(lx) - 1.8);                       // distance from the lane centre
float wn = texture(tGN, vec2(lx * 0.5, vGW.z / 23.0) + 0.43).r;
float wheel = 1.0 - smoothstep(0.18, 0.5, abs(lc - 0.85));
c *= 1.0 - 0.14 * wheel * (0.6 + 0.6 * wn);
float drip = (1.0 - smoothstep(0.1, 0.35, lc)) * smoothstep(0.45, 0.75, texture(tGN, vec2(lx * 0.9, vGW.z / 3.1) + 0.11).g);
c *= 1.0 - 0.28 * drip;
float gut = 1.0 - smoothstep(0.0, 0.45, 3.6 - abs(lx));
c *= 1.0 - 0.35 * gut * (0.7 + 0.3 * wn);
}
}
// grime: soot collecting under projections + dark wash near the ground (stone only)
if(part == 0 || part == 1 || part == 3 || part == 7) {
c *= 1.0 - 0.2 * smoothstep(0.55, 0.85, nz.b) * (1.0 - an.y);
c *= mix(0.78, 1.0, smoothstep(0.0, 4.0, vGW.y));
// (street r5) critic: 'no weathering / staining under ledges, no AO where the cornice meets the wall'.
// Contact shadow bands under the big projections + soot streaks washing down from them (walls only).
float wall = 1.0 - an.y;
float dC = __SHADER_INJECT_2__ - vGW.y, dA = __SHADER_INJECT_3__ - vGW.y, dT = __SHADER_INJECT_4__ - vGW.y;
float ao = 0.34 * step(0.0, dC) * exp(- max(dC, 0.0) * 1.1) + 0.26 * step(0.0, dA) * step(vGW.y, __SHADER_INJECT_5__) * exp(- max(dA, 0.0) * 1.4) + 0.3 * step(0.0, dT) * exp(- max(dT, 0.0) * 0.9); // (skyline r6) max(): exp overflowed to inf at y ~250 (MetLife cap) -> 0*inf = NaN = black
float colS = texture(tGN, vec2(q.x / 0.55, 0.37)).g, colS2 = texture(tGN, vec2(q.x / 2.3, 0.71)).b;
float streak = smoothstep(0.52, 0.8, colS) * (0.6 + 0.6 * colS2);
float run = step(0.0, dC) * exp(- max(dC, 0.0) / 7.0) + step(0.0, dA) * step(vGW.y, __SHADER_INJECT_6__) * exp(- max(dA, 0.0) / 3.0);
c *= (1.0 - ao * wall) * (1.0 - 0.3 * streak * run * wall);
c = mix(c, c * vec3(0.93, 0.95, 0.98), 0.5 * smoothstep(12.0, 30.0, vGW.y) * wall);   // cooler, cleaner stone higher up
// (textures r5) critic: 'Grand Central reads as pale clean plaster'. Real stone grain from the $imagegen stucco /
// limestone layer (luminance ratio, so the part colours stay), soot streak masks (walls_hao layer 16) washing
// down 3-14 m from the cornice / attic between the piers, and an overall aged value drop.
vec3 gs = texture(tGWC, vec3(q / 2.4 + 0.13, 14.0)).rgb, gm = textureLod(tGWC, vec3(0.5, 0.5, 14.0), 10.0).rgb;
c *= mix(1.0, clamp(dot(gs, vec3(0.333)) / max(dot(gm, vec3(0.333)), 0.05), 0.7, 1.3), 0.65);
float sc = floor(q.x / 1.7), sr = gh(vec2(sc, 3.1)), sLen = 3.0 + 11.0 * sr;
float sy = (vGW.y > __SHADER_INJECT_7__ ? __SHADER_INJECT_8__ : __SHADER_INJECT_9__) - vGW.y;
vec2 sq = vec2(fract(q.x / 1.7), sy / sLen);
float sm = (sq.y > 0.0 && sq.y < 1.0) ? texture(tGWH, vec3((mod(sc, 8.0) + clamp(sq.x, 0.02, 0.98)) / 8.0, 1.0 - sq.y, 16.0)).r : 0.0;
c *= 1.0 - 0.38 * sm * wall * step(0.35, sr);
c *= 0.86 * mix(vec3(1.0), vec3(1.0, 0.97, 0.92), 0.5 * (1.0 - smoothstep(2.0, 12.0, vGW.y)));
}
diffuseColor.rgb = c;
}
// @section fragmentRoughness
#include <roughnessmap_fragment>
if(int(vGP + 0.5) == 2) roughnessFactor = 0.42 + 0.45 * gV; /* (street r11) bare copper satin, crust matte */ 
else if(int(vGP + 0.5) == 5) roughnessFactor = 0.45;
else if(int(vGP + 0.5) == 8) roughnessFactor = 0.42 + 0.4 * gV;
// @section fragmentMetalness
#include <metalnessmap_fragment>
if(int(vGP + 0.5) == 8) metalnessFactor = 0.55 * (1.0 - gV);
else if(int(vGP + 0.5) == 2) metalnessFactor = 0.35 * (1.0 - gV);
// @section fragmentNormalMaps
#include <normal_fragment_maps>
{
vec2 dH = vec2(dFdx(gH) / max(length(dFdx(vViewPosition)), 1e-4), dFdy(gH) / max(length(dFdy(vViewPosition)), 1e-4));
dH = clamp(dH, vec2(- 0.8), vec2(0.8));
if(abs(dH.x) + abs(dH.y) > 1e-4) normal = gcPerturb(- vViewPosition, normal, dH, faceDirection);
}
// @section vertexCommonByGrandCentralWorldNormal
#include <common>
out vec2 vGU;
out vec3 vGWp;
out vec3 vGNp;
// @section vertexUvVertex
#include <uv_vertex>
vGU = uv;
// @section vertexFogVertexByGrandCentralWorldNormal
#include <fog_vertex>
vGWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGNp = normalize(mat3(modelMatrix) * objectNormal);
// @section fragmentCommonByGrandCentralWorldNormal
#include <common>
in vec2 vGU;
in vec3 vGWp;
in vec3 vGNp;
float vGMull = 0.0;
vec3 gInt = vec3(0.0);
float gGrid(vec2 q, vec2 per, vec2 w) {
vec2 g = q / per;
vec2 fw = fwidth(g) + 1e-4;
vec2 d = abs(fract(g) - 0.5) * 2.0;
return max(smoothstep(1.0 - w.x - fw.x * 2.0, 1.0 - w.x, d.x), smoothstep(1.0 - w.y - fw.y * 2.0, 1.0 - w.y, d.y)) * (1.0 - smoothstep(0.3, 0.7, max(fw.x, fw.y)));
}
// @section fragmentMapByGrandCentralWorldPosition
#include <map_fragment>
{
// fine muntins on the outer skin (the heavy bars are real geometry)
float mull = gGrid(vGU, vec2(0.5, 0.65), vec2(0.1, 0.08));
vec3 V = normalize(vGWp - cameraPosition), n = normalize(vGNp);
float cv = max(dot(V, - n), 0.08);
vec3 tW = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4));
// inner skin 1.2 m in
vec3 h1 = vGWp + V * (1.2 / cv);
float m1 = gGrid(vec2(dot(h1, tW), h1.y), vec2(1.0, 1.3), vec2(0.12, 0.1));
// concourse: far wall 30 m in, floor at y = 1
float tb = 30.0 / cv, tf = V.y < - 0.01 ? (vGWp.y - 1.0) / - V.y : 1e5;
vec3 col;
if(tf < tb) {
vec3 hf = vGWp + V * tf;
vec2 fq = vec2(dot(hf, tW), dot(hf, n));
float tile = gGrid(fq, vec2(1.6, 1.6), vec2(0.04, 0.04));
col = vec3(0.34, 0.28, 0.2) * (0.85 + 0.15 * sin(fq.x * 0.37) * sin(fq.y * 0.29)) * (1.0 - 0.3 * tile);
col *= 0.55 + 0.45 * exp(- tf * 0.02);
} else {
vec3 hb = vGWp + V * tb;
vec2 bq = vec2(dot(hb, tW), hb.y);
col = vec3(0.2, 0.15, 0.1) * (0.7 + 0.3 * smoothstep(20.0, 4.0, bq.y));            // warm stone hall, lit low
float ax = mod(bq.x + 7.5, 15.0) - 7.5;                                            // the far wall's arched windows
float arch = step(abs(ax), 4.0) * step(9.0, bq.y) * step(bq.y, 21.0 + sqrt(max(0.0, 16.0 - ax * ax)));
col = mix(col, vec3(0.34, 0.36, 0.38), arch * (1.0 - 0.6 * gGrid(bq, vec2(1.0, 1.3), vec2(0.14, 0.12))));
vec2 ch = vec2(mod(bq.x, 7.5) - 3.75, bq.y - 12.5);                                  // chandelier glows
col += vec3(1.0, 0.72, 0.4) * 0.9 * exp(- dot(ch, ch) * 0.9);
col += vec3(0.45, 0.4, 0.3) * smoothstep(24.0, 30.0, bq.y) * 0.4;                    // barrel ceiling (painted sky)
}
col *= 1.0 - 0.55 * m1;
gInt = col;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.47, 0.44), mull * 0.45); // (street r5) pale painted muntins, faint (read as glazing, not a dark grid decal)
vGMull = mull;
}
// @section fragmentRoughnessStreetFixtures
#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.6, vGMull);
// @section fragmentMetalnessStreetFixtures
#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, 0.2, vGMull);
// @section fragmentEmissive
#include <emissivemap_fragment>
{
float cv2 = max(dot(normalize(cameraPosition - vGWp), normalize(vGNp)), 0.0);
float fres = 0.08 + 0.92 * pow(1.0 - cv2, 5.0);
totalEmissiveRadiance += gInt * (1.0 - fres) * (1.0 - vGMull * 0.5) * 1.15; /* (street r10) 0.85 -> 1.15: warm concourse glow behind the deep reveals */ // (street r6) dimmer: deep, dark hall // (street r5) warmer interior glow
}
// @section vertexCommonByPavementWorldNormal
#include <common>
out vec3 vPW;
out vec3 vPN;
// @section vertexFogVertexByPavementWorldNormal
#include <fog_vertex>
vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;
vPN = normalize(mat3(modelMatrix) * objectNormal);
// @section fragmentCommonByPavementWorldNormal
#include <common>
in vec3 vPW;
in vec3 vPN;
float pOpq = 0.0;
float pH = 0.0, pH2 = 0.0, pH3 = 0.0;
vec3 pInt = vec3(0.0);
float ph(vec2 p) {
return fract(sin(dot(p, vec2(41.37, 289.11))) * 23758.5453);
}
// @section fragmentMapByPavementWorldPosition
#include <map_fragment>
{
vec3 n = normalize(vPN), tW = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4));
float u = dot(vPW, tW), fl = (vPW.y - __SHADER_INJECT_0__) / __SHADER_INJECT_1__;
float fy = fract(fl), fu = fract(u / __SHADER_INJECT_2__);
vec2 id = vec2(floor(u / __SHADER_INJECT_3__) + n.x * 17.0 + n.z * 31.0, floor(fl));
pH = ph(id);
pH2 = ph(id + 7.3);
pH3 = ph(vec2(floor(u / (__SHADER_INJECT_4__ * 3.0)), id.y) + 3.1);   // pane / room hashes
float fwU = fwidth(u / __SHADER_INJECT_5__) + 1e-4, fwY = fwidth(fl) + 1e-4;
float mull = max(1.0 - smoothstep(0.025, 0.025 + fwU * 1.5, min(fu, 1.0 - fu)), 1.0 - smoothstep(0.012, 0.012 + fwY * 1.5, abs(fy - 0.235)));
float span = 1.0 - smoothstep(0.215, 0.215 + fwY, fy);                    // opaque spandrel band at the slab
pOpq = max(span, mull);
// interior: room box behind the pane (back wall 6 m in, floor at the sill, ceiling 2.9 m up)
vec3 V = normalize(vPW - cameraPosition);
float cv = max(dot(V, - n), 0.06);
float yF = __SHADER_INJECT_6__ + floor(fl) * __SHADER_INJECT_7__ + 0.95, yC = yF + 2.85;
float tB = 6.0 / cv, tC = V.y > 0.001 ? (yC - vPW.y) / V.y : 1e5, tF = V.y < - 0.001 ? (yF - vPW.y) / V.y : 1e5;
float lit = step(0.35, pH3);
vec3 col;
if(tC < tB && tC < tF) {
vec3 h = vPW + V * tC;
float lx = abs(fract(dot(h, tW) / 1.5) - 0.5), lz = abs(fract(dot(h, n) / 2.4) - 0.5);
col = vec3(0.1) + lit * vec3(0.95, 0.97, 1.0) * 0.55 * (1.0 - smoothstep(0.12, 0.16, lx)) * (1.0 - smoothstep(0.3, 0.34, lz));
} else if(tF < tB) {
vec3 h = vPW + V * tF;
col = vec3(0.06, 0.06, 0.065) * (0.7 + 0.6 * exp(- tF * 0.2));
} else {
vec3 h = vPW + V * tB;
float hy = h.y - yF;
float bx = dot(h, tW);
col = mix(vec3(0.16, 0.16, 0.15), vec3(0.24, 0.22, 0.19), ph(vec2(floor(bx / 4.0), id.y)));
float desk = step(0.0, hy) * step(hy, 0.78) * step(0.25, fract(bx / 2.6));
col = mix(col, vec3(0.05), desk * 0.8);
col *= 0.5 + 0.5 * lit;
}
col *= 0.35 + 0.65 * lit;
// blinds: some bays drawn part-way down from the head
// (street r12) critic: 'randomly scattered bright white window cells (missing-texture flicker)'. Blinds are now
// set per 3-bay office (one tenant, one drop height, quantised to thirds) and are a dusty dark bronze, not cream
float bl = pH3 > 0.62 ? 0.2 + 0.25 * floor(ph(vec2(floor(u / (__SHADER_INJECT_8__ * 3.0)), id.y) + 1.9) * 3.0) : 0.0;
float wy = (fy - 0.235) / 0.765;
float blind = step(1.0 - bl, wy);
float slat = mix(0.92, 0.85 + 0.15 * step(0.5, fract(vPW.y * 18.0)), 1.0 - smoothstep(0.15, 0.4, fwidth(vPW.y * 18.0)));
pInt = mix(col, vec3(0.0), blind);
diffuseColor.rgb = mix(diffuseColor.rgb * (0.75 + 0.5 * pH), vec3(0.17, 0.155, 0.13) * slat * (0.9 + 0.15 * pH2), blind * 0.85); // (street r12) darker blinds
pOpq = max(pOpq, blind * 0.7);
diffuseColor.rgb = mix(diffuseColor.rgb, span > 0.5 ? vec3(0.075, 0.068, 0.058) : vec3(0.1, 0.09, 0.075), max(span, mull));
}
// @section fragmentRoughnessWindowGlass
#include <roughnessmap_fragment>
roughnessFactor = mix(0.05 + 0.18 * pH * pH, 0.55, pOpq);
// @section fragmentMetalnessWindowGlass
#include <metalnessmap_fragment>
metalnessFactor = mix(0.85, 0.25, pOpq);
// @section fragmentNormalMapsWindowPane
#include <normal_fragment_maps>
normal = normalize(normal + vec3(pH - 0.5, pH2 - 0.5, 0.0) * 0.045 * (1.0 - pOpq));   // per-pane tilt (oil-canning)
// @section fragmentEmissiveByPavementWorldNormal
#include <emissivemap_fragment>
{
float cv2 = max(dot(normalize(cameraPosition - vPW), normalize(vPN)), 0.0);
float fres = 0.06 + 0.94 * pow(1.0 - cv2, 5.0);
totalEmissiveRadiance += pInt * (1.0 - fres) * (1.0 - pOpq) * 0.55;
}
