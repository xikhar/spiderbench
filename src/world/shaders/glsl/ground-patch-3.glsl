#include <common>
      uniform sampler2D tCol; uniform sampler2D tNrm; uniform sampler2D tMacro; uniform sampler2D tNoise; in vec3 vWP; in vec3 vRoad; uniform sampler2D tDec;
      vec3 aN; float aR; float gDecR = 0.0; // (textures r3)
      vec3 asphalt() {
        vec2 p = vWP.xz;
        vec3 c = texture(tCol, p / 6.0).rgb * 0.88; // (textures r4) critic: 'street asphalt light grey and clean' -> darker binder
        vec3 c2 = texture(tCol, vec2(p.y, -p.x) / 7.3 + 0.37).rgb * 0.88;
        c = mix(c, c2, 0.35);
        vec3 nd = texture(tNrm, p / 6.0).rgb;
        vec3 m = texture(tMacro, p / 64.0).rgb;
        vec3 m2 = texture(tMacro, vec2(-p.y, p.x) / 151.0 + 0.5).rgb;
        vec3 nz = texture(tNoise, p / 97.0).rgb;
        float bright = (0.8 + 0.4 * m.r) * (0.88 + 0.24 * m2.r) * (0.94 + 0.12 * nz.r); // gentle macro variation (was blotchy)
        c *= bright;
        // (no crack lines: user feedback - roads read as uniform, softly worn asphalt; refs/road)
        // lanes / tyre grime
        // road rect kind (vRoad.x: 0 avenue, 1 street, 2 intersection) + centre line (vRoad.y) from the geometry
        int rk = int(vRoad.x + 0.5);
        float ax = p.x - vRoad.y, sz = p.y - vRoad.z;
        bool onAv = rk != 1, onSt = rk != 0;
        float track = 0.0, oil = 0.0, gutter = 0.0;
        if (onAv && !onSt) {
          float l = mod(ax + 10.8, 3.6) - 1.8;
          track = exp(-pow((abs(l) - 0.85) / 0.3, 2.0));
          oil = exp(-pow(l / 0.45, 2.0));
          gutter = 1.0 - smoothstep(0.0, 0.8, 11.0 - abs(ax));
        } else if (onSt && !onAv) {
          float l = sz;
          track = exp(-pow((abs(l) - 0.9) / 0.35, 2.0)) * 0.8;
          oil = exp(-pow(l / 0.5, 2.0));
          float sh = 5.0 + (vRoad.x - 1.0) * 100.0; // (layout2 r9) per-street half width
          if (sh > 6.0) { float l2 = mod(abs(sz), 3.3) - 1.65; track = exp(-pow((abs(l2) - 0.85) / 0.3, 2.0)) * 0.8; oil = exp(-pow(l2 / 0.45, 2.0)); } // two lanes each way
          gutter = 1.0 - smoothstep(0.0, 0.7, sh - abs(sz));
        } else if (onSt && onAv) {
          track = 0.25; oil = 0.3;
        }
        float tv = 0.6 + 0.4 * nz.g;
        c *= 1.0 - 0.2 * track * tv; // soft tyre-wear lanes (street r6: 0.14 -> 0.2)
        float stain = m.b * oil;
        c *= 1.0 - 0.2 * stain - 0.05 * oil * nz.b; // faint, broad (no dark lane-centre streaks)
        c *= 1.0 - 0.36 * gutter * (0.6 + 0.4 * nz.b); // (street r6) darker wet kerb gutter
        c = mix(c, c * vec3(0.95, 0.93, 0.9), gutter);
        // patches: soft, broad darker areas only (low-frequency noise, no hard edges or seams)
        float patchN = smoothstep(0.62, 0.78, texture(tNoise, p / 41.0 + 0.23).b) * 0.6;
        c *= 1.0 - 0.14 * patchN;
        // (street r6) critic: 'road too clean'. Mid-scale blotches: parked-car oil drips + dried spill stains (irregular,
        // 0.5-2 m, from two noise octaves), strongest in the parking / curb lanes (gutter side), faint mid-road.
        {
          float s1 = texture(tNoise, p / 3.7 + 0.61).g, s2 = texture(tNoise, p / 1.3 + 0.17).r;
          float blot = smoothstep(0.66, 0.8, s1 * 0.75 + s2 * 0.35);
          float curbLane = rk == 0 ? smoothstep(6.5, 8.5, abs(ax)) : (rk == 1 ? smoothstep(2.0, 3.2, abs(sz)) : 0.3);
          c *= 1.0 - blot * (0.1 + 0.2 * curbLane);
        }
        // (street r3) lane-by-lane repaving: whole-lane sections milled + resurfaced at different times (crisp straight
        // edges on the lane lines, lighter older / darker fresher asphalt) like the refs' patchwork avenues. No cracks.
        {
          float li, lane0, along, cw;
          if (rk == 0) { li = floor((ax + 10.8) / 3.6); along = p.y; cw = 3.6; lane0 = ax + 10.8 - li * 3.6; }
          else if (rk == 1) { li = sz < 0.0 ? 30.0 : 31.0; along = p.x; cw = 5.0; lane0 = abs(sz) ; }
          else { li = 40.0 + floor(p.x / 9.0); along = p.y; cw = 9.0; lane0 = mod(p.x, 9.0); }
          float seg = floor(along / 23.0 + li * 0.37);
          float hh = fract(sin(dot(vec3(li, seg, vRoad.y * 0.013 + vRoad.z * 0.007), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float fu = fract(along / 23.0 + li * 0.37);
          float edge = smoothstep(0.0, 0.004, fu) * smoothstep(1.0, 0.996, fu) * smoothstep(0.0, 0.04, lane0) * smoothstep(cw, cw - 0.04, lane0);
          float rp = hh < 0.16 ? 1.13 : hh < 0.3 ? 0.84 : hh < 0.36 ? 1.22 : 1.0;
          c *= mix(1.0, rp, edge * (0.75 + 0.25 * nz.r));
        }
        // (street r11) critic: 'road clean, no patches / stains'. Utility-cut restorations: sharp-edged rectangles of
        // fresher (darker) or older (paler) tar, 1-4 m, ~1 per 3 cells of 11 m; a thin sealant rim; plus broad dark
        // oil pools in the stop lanes approaching the intersections (no crack lines: user rule)
        {
          vec2 cg = vec2(11.0, 13.0), cid2 = floor(p / cg), cf = p - cid2 * cg;
          float h1 = fract(sin(dot(cid2, vec2(41.31, 17.77))) * 23758.54), h2 = fract(h1 * 73.1 + 0.3), h3 = fract(h1 * 11.7 + 0.61);
          float fwp = fwidth(p.x) * 1.2 + 1e-3;
          if (h1 < 0.34 && rk != 2) {
            vec2 hs = vec2(0.6 + 1.6 * h2, 0.5 + 1.1 * h3), cc2 = vec2(2.0 + h3 * 7.0, 2.0 + h2 * 9.0);
            vec2 dq = abs(cf - cc2) - hs;
            float inP = 1.0 - smoothstep(-fwp, fwp, max(dq.x, dq.y));
            float rim = (1.0 - smoothstep(0.0, 0.07 + fwp, abs(max(dq.x, dq.y)))) ;
            c *= mix(1.0, h2 < 0.6 ? 0.72 : 1.18, inP * (0.85 + 0.3 * nz.g)); // (street r12) 0.8 / 1.12 -> 0.72 / 1.18: readable from rooftop height
            c *= 1.0 - 0.22 * rim;
          }
          // (street r12) critic (ref 16): 'road is uniform dark asphalt; add patching'. Long utility trench restorations:
          // 0.9-1.4 m wide strips running 4-11 m across or along the lanes, a few per block, crisp sealed edges
          if (rk != 2) {
            vec2 tg = vec2(29.0, 37.0), tid = floor(p / tg), tf2 = p - tid * tg;
            float t1 = fract(sin(dot(tid, vec2(12.71, 91.37))) * 43758.55), t2 = fract(t1 * 57.3 + 0.21), t3 = fract(t1 * 19.9 + 0.77);
            if (t1 < 0.42) {
              bool acr = t2 < 0.5;
              vec2 hs2 = acr ? vec2(2.0 + 3.5 * t3, 0.45 + 0.25 * t2) : vec2(0.45 + 0.25 * t3, 2.0 + 3.5 * t2);
              vec2 c3 = vec2(6.0 + t3 * 17.0, 6.0 + t2 * 25.0);
              vec2 dq2 = abs(tf2 - c3) - hs2;
              float dd = max(dq2.x, dq2.y);
              float inT = 1.0 - smoothstep(-fwp, fwp, dd);
              c *= mix(1.0, t3 < 0.55 ? 0.66 : 1.2, inT * (0.8 + 0.4 * nz.b));
              c *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.06 + fwp, abs(dd)));
            }
          }
          vec2 op = p / 2.3 + 0.17;
          float pool = smoothstep(0.62, 0.82, texture(tNoise, op).r * 0.7 + texture(tNoise, op * 2.9).g * 0.4) * (rk == 2 ? 0.3 : oil);
          c *= 1.0 - 0.25 * pool;
        }
        // (textures r3) critic: 'asphalt uniform noise, no patches, cracks, tyre marks'. Photographic repair decals
        // ($imagegen sheet, asphalt_decals.webp: 8 cells of colour ratio vs plain asphalt): fresh / old sealed utility cuts,
        // trench strips, pothole fills, oil stains, skid marks, manholes in a new-asphalt collar, patch clusters. One
        // candidate per 8 m cell (~55 % used), random size / quarter-turn / mirror, jittered inside the cell. One texture
        // tap with explicit gradients (no mip seams at the cell borders).
        {
          vec2 dcg = p / 8.0, dci = floor(dcg), dcf = dcg - dci;
          vec2 dqx = dFdx(p), dqy = dFdy(p); // uniform control flow
          float e1 = fract(sin(dot(dci, vec2(27.17, 61.93))) * 43758.5453), e2 = fract(e1 * 43.7 + 0.13), e3 = fract(e1 * 7.31 + 0.71);
          if (e1 < 0.55) {
            float k = e1 < 0.03 ? 6.0 : floor(e2 * 7.999); if (k > 5.5) k = e1 < 0.03 ? 6.0 : 7.0; // manholes rarer (street decals have them)
            float sz = (k > 5.5 && k < 6.5) ? 1.5 : (1.3 + 1.4 * e3); // decal cell = sz x 2 sz (m)
            vec2 ctr = 0.5 + (vec2(e2, e3) - 0.5) * (1.0 - vec2(2.0 * sz, 2.0 * sz) / 8.0);
            vec2 q = (dcf - ctr) * 8.0; // metres from the decal centre
            if (e3 < 0.5) { q = q.yx; dqx = dqx.yx; dqy = dqy.yx; }
            if (fract(e1 * 91.1) < 0.5) { q.x = -q.x; dqx.x = -dqx.x; dqy.x = -dqy.x; }
            vec2 du = q / vec2(sz, 2.0 * sz) + 0.5;
            if (all(greaterThan(du, vec2(0.0))) && all(lessThan(du, vec2(1.0)))) {
              vec2 cc = vec2(mod(k, 4.0), floor(k / 4.0));
              vec2 duv = vec2((cc.x + du.x) / 4.0, 1.0 - (cc.y + 1.0 - du.y) / 2.0);
              vec2 gs = vec2(1.0 / (4.0 * sz), 1.0 / (4.0 * sz));
              vec3 dr = textureGrad(tDec, duv, dqx * gs, dqy * gs).rgb * 2.0;
              c *= mix(vec3(1.0), dr, 0.9);
              gDecR = clamp(1.0 - dot(dr, vec3(0.333)), 0.0, 0.6);
            }
          }
        }
        c *= vec3(0.97, 0.99, 1.03); // slightly blue-grey, faded
        // aerial LOD tone: seen from afar, grime, oil, parked cars and kerb shadows aggregate -> the road reads darker than
        // the sidewalks (the street grid stays legible from the rooftops instead of washing into pale strips)
        float adist = length(vWP - cameraPosition);
        c *= mix(1.0, 0.74, smoothstep(80.0, 600.0, adist)); // (round 7: 0.66 -> 0.52; round 10: 0.74 -- critic: streets read as dark trenches, not grey asphalt)
        // (street agent r1) street-level tone: up close the refs' asphalt is a dark blue-grey, about half the sidewalk's
        // value; fades out by 260 m so the rooftop / aerial read (above) is unchanged
        c *= mix(0.8, 1.0, smoothstep(110.0, 260.0, adist)); // (street r3: 0.64 -> 0.7; r4: 0.8, refs 16 / 04 sunlit asphalt reads mid-grey so the wear decals show)
        // (round 10) aerial traffic impostor: beyond the simulated-traffic radius the lanes carry static car-sized
        // shapes (muted liveries, yellow cabs, a dark cast-shadow sliver), so the grid reads busy from altitude like the
        // refs instead of empty trenches. Fades in past 260 m (the real vehicles cover the near field).
        float tf = smoothstep(240.0, 420.0, adist);
        if (tf > 0.0 && rk != 2) {
          float lane, along, lw, gap; vec2 cid;
          if (rk == 0) { float li = floor((ax + 10.8) / 3.6); lane = ax - (li * 3.6 - 9.0); along = p.y; gap = 8.5; cid = vec2(li, vRoad.y); lw = 1.0; }
          else { float li = sz < 0.0 ? 0.0 : 1.0; lane = sz - (li < 0.5 ? -2.3 : 2.3); along = p.x; gap = 7.6; cid = vec2(li + 20.0, vRoad.z); lw = 0.8; }
          float cell = floor(along / gap), u = along - cell * gap - gap * 0.5;
          float h1 = fract(sin(dot(vec3(cid, cell), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float h2 = fract(h1 * 91.3171 + 0.123);
          // denser bunching (platoons at lights): block-scale density wave along the road
          float dens = (rk == 0 ? 0.5 : 0.32) * lw * (0.55 + 0.9 * texture(tNoise, vec2(along / 260.0, cid.x * 0.13 + cid.y * 0.001)).r);
          if (h1 < dens) {
            float L = h2 < 0.12 ? 3.4 : (h2 > 0.92 ? 3.9 : 2.25), Wd = h2 > 0.92 ? 1.25 : 0.92; // half extents (bus / van / car)
            float du = abs(u + (h2 - 0.5) * 1.6) - L, dv = abs(lane) - Wd;
            float inside = 1.0 - smoothstep(-0.25, 0.25, max(du, dv));
            float shadowS = 1.0 - smoothstep(-0.3, 0.4, max(du, abs(lane - 0.9) - Wd));
            float hc = fract(h2 * 37.77);
            vec3 cc = hc < 0.22 ? vec3(0.62, 0.48, 0.12) : hc < 0.42 ? vec3(0.55, 0.55, 0.54) : hc < 0.6 ? vec3(0.05, 0.05, 0.055)
                    : hc < 0.72 ? vec3(0.34, 0.35, 0.36) : hc < 0.8 ? vec3(0.36, 0.1, 0.08) : hc < 0.88 ? vec3(0.12, 0.17, 0.26) : vec3(0.46, 0.45, 0.42);
            if (h2 > 0.92) cc = vec3(0.5, 0.52, 0.55); // buses / box vans: pale roofs
            c = mix(c, c * 0.55, shadowS * tf * 0.8);
            c = mix(c, cc, inside * tf);
          }
        }
        aR = clamp(nd.b + 0.05 - 0.25 * stain - 0.08 * track, 0.35, 1.0);
        aR = clamp(aR - 0.45 * gDecR, 0.35, 1.0); // (textures r3) fresh tar / oil decals are glossier
        // (foundation r13) critic: 'avenue to the horizon is a thin bright white line'. Far away the grazing view of the
        // worn, oily surface glared as a mirror-bright strip against the sun: from ~0.3 km the aggregate (cars, grime,
        // kerb shadows, repairs) goes fully matte and a step darker, so avenues read as dark cuts to the horizon
        aR = mix(aR, 1.0, smoothstep(300.0, 1100.0, adist));
        c *= mix(1.0, 0.8, smoothstep(700.0, 2200.0, adist));
        vec2 nxy = nd.rg * 2.0 - 1.0;
        aN = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy)))));
        return c;
      }