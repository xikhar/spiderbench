// @ts-nocheck
/**
 * Global surface shader patching for wet materials, SSR masking, ambient grading, and city-light influence.
 *
 * @module render-surface
 * @version 1.0.0
 * @file src/render/surface.ts
 * @since 0.0.1
 * @description Installs shared shader chunk modifications and exports ambShared uniforms used to drive environment response, wetness, and night lighting across standard materials.
 */

import * as THREE from "three";
import {
    avenues,
    G,
    WIDE_ROADS,
    NARROW_STREETS,
    WIDE_ST_HALF,
    NARROW_ST_HALF,
    VREG,
    FREG,
} from "@/world/layout.ts";

export const ambShared = {
    grade: new THREE.Vector4(1, 1, 1, 0.6),
    bounce: new THREE.Vector4(0, 0, 0, 1),
    vert: new THREE.Vector4(1, 1, 0, 0),
    wx: new THREE.Vector4(0, 0, 0, 1),
    cgrid: new THREE.Vector4(0, 0, 512, 0),
    city: new THREE.Vector4(0, 0, 0, 0),
    shape: new THREE.Vector4(0.25, 1, 0, 0),
};

let _installed = false;
export function installSurfaceChunks(quality: { wet?: boolean } = {}): void {
    if (_installed) return;
    _installed = true;
    const SC = THREE.ShaderChunk;

    let wetOn = quality.wet !== false;
    try {
        if (new URLSearchParams(location.search).has("nowet")) wetOn = false;
    } catch (_e) {
        /* non-browser */
    }
    let oldPud = false;
    try {
        oldPud = new URLSearchParams(location.search).has("oldpuddles");
    } catch (_e) {
        /* non-browser */
    }
    const wet = /* glsl */ `
#if defined( STANDARD ) && !defined( USE_SKINNING ) && !defined( NO_WET ) && !defined( USE_TRANSMISSION )
{
  vec3 wetUp = ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz;
  float wetFlat = smoothstep( 0.93, 0.985, dot( normalize( normal ), wetUp ) );
  vec3 wetDc = material.diffuseColor;
  float wetMx = max( wetDc.r, max( wetDc.g, wetDc.b ) ), wetMn = min( wetDc.r, min( wetDc.g, wetDc.b ) );
  float wetGrey = 1.0 - smoothstep( 0.18, 0.4, ( wetMx - wetMn ) / max( wetMx, 1e-3 ) );
  float wetRain = ambData.wx.x; // (lighting2 r3) overcast rain: the whole city is wet
  if ( ambData.city.w > 0.0 ) { // (lighting2 r5) Times Square at night: glossy, damp asphalt / pavers mirror the screens (ts_night ref)
    vec3 twp = cameraPosition + ( - vViewPosition ) * mat3( viewMatrix );
    float tsM = smoothstep( 112.0, 80.0, abs( twp.x ) ) * smoothstep( -352.0, -325.0, twp.z ) * smoothstep( 22.0, 0.0, twp.z ) * step( twp.y, 1.0 );
    wetRain = max( wetRain, 0.75 * tsM * clamp( ambData.city.w * 8.0, 0.0, 1.0 ) );
  }
  if ( wetRain > 0.0 ) {
    // rain-soaked everything: darker, glossier (walls, cars, paint); flat ground: a continuous water film
    material.diffuseColor *= 1.0 - 0.22 * wetRain;
    material.roughness = mix( material.roughness, material.roughness * 0.45, wetRain );
    wetGrey = mix( wetGrey, 1.0, wetRain * 0.85 );
  }
  // (lighting2 r3) no puddles past ~1 km: far flat grey plates (hinterland, far shores) at grazing angles turned into
  // mirrors of the horizon glow (a pale band along the night horizon)
  wetFlat *= 1.0 - smoothstep( 700.0, 1300.0, length( vViewPosition ) );
  wetFlat *= max( ambData.wx.w, clamp( wetRain * 4.0, 0.0, 1.0 ) ); // (user r-nopuddles) Settings > Puddles off: no water on the ground in dry weather (rain still wets it)
  if ( wetFlat * wetGrey > 0.01 ) {
    vec3 wetP = cameraPosition + ( - vViewPosition ) * mat3( viewMatrix );
    vec2 q = wetP.xz;
    // cheap value noise, 2 octaves (big puddle fields + ragged edges)
    vec2 i0 = floor( q / 7.0 ), f0 = fract( q / 7.0 ); f0 = f0 * f0 * ( 3.0 - 2.0 * f0 );
    #define WH(v) fract( sin( dot( v, vec2( 127.1, 311.7 ) ) ) * 43758.5453 )
    float n0 = mix( mix( WH( i0 ), WH( i0 + vec2( 1, 0 ) ), f0.x ), mix( WH( i0 + vec2( 0, 1 ) ), WH( i0 + vec2( 1, 1 ) ), f0.x ), f0.y );
    vec2 i1 = floor( q / 1.9 ), f1 = fract( q / 1.9 ); f1 = f1 * f1 * ( 3.0 - 2.0 * f1 );
    float n1 = mix( mix( WH( i1 ), WH( i1 + vec2( 1, 0 ) ), f1.x ), mix( WH( i1 + vec2( 0, 1 ) ), WH( i1 + vec2( 1, 1 ) ), f1.x ), f1.y );
    #undef WH
    float wetN = n0 * 0.72 + n1 * 0.28;
    float wetH = mix( 0.4, 1.0, smoothstep( 4.0, 10.0, wetP.y ) ); // streets: fewer / smaller puddles than roofs
    float wetT = 0.3 * wetRain; // rain: puddles grow, the rest of the ground is a damp film
    // (zfix) dry presets (no rain): ~35-40 % fewer / smaller puddles, pooled mostly in the kerb gutters of the grid
    // roads, in low spots (a 23 m noise field) and around the roof drains; the rain look (wetRain > 0) is unchanged
    float wetSh = 0.0, wetDry = max( ${oldPud ? "0.0" : "1.0"} - clamp( wetRain * 4.0, 0.0, 1.0 ), 0.0 ); // ?oldpuddles: the previous dry look (A/B)
    if ( wetDry > 0.0 ) {
      vec2 lq = q / 23.0 + vec2( 5.3, 9.01 ), li = floor( lq ), lf = fract( lq ); lf = lf * lf * ( 3.0 - 2.0 * lf );
      #define WL(v) fract( sin( dot( v, vec2( 269.5, 183.3 ) ) ) * 43758.5453 )
      float wetL = mix( mix( WL( li ), WL( li + vec2( 1, 0 ) ), lf.x ), mix( WL( li + vec2( 0, 1 ) ), WL( li + vec2( 1, 1 ) ), lf.x ), lf.y );
      #undef WL
      float wetLow = smoothstep( 0.45, 0.8, wetL ) * ( wetP.y > 4.0 ? 1.0 : 0.45 ), wetGut = 0.0;
      if ( wetP.y < 0.1 && wetP.z < ${FREG.z0.toFixed(1)} && !( wetP.x > ${VREG.x0.toFixed(1)} && wetP.x < ${VREG.x1.toFixed(1)} && wetP.z > ${VREG.z0.toFixed(1)} && wetP.z < ${VREG.z1.toFixed(1)} ) ) {
        float dk = 9.0; // distance inside the roadway to the nearest kerb line (grid avenues + streets)
        ${avenues.map((a: number) => `dk = min( dk, ${G.AV_HALF.toFixed(2)} - abs( wetP.x - ${a.toFixed(1)} ) + step( ${G.AV_HALF.toFixed(2)}, abs( wetP.x - ${a.toFixed(1)} ) ) * 99.0 );`).join(" ")}
        float zc = floor( wetP.z / ${G.ST_SP.toFixed(1)} + 0.5 ) * ${G.ST_SP.toFixed(1)}, hw = ${G.ST_HALF.toFixed(2)};
        ${WIDE_ROADS.map((z: number) => `hw = abs( zc - ${z.toFixed(1)} ) < 1.0 ? ${WIDE_ST_HALF.toFixed(2)} : hw;`).join(" ")}
        ${NARROW_STREETS.map((z: number) => `hw = abs( zc - ${z.toFixed(1)} ) < 1.0 ? ${NARROW_ST_HALF.toFixed(2)} : hw;`).join(" ")}
        float dz = abs( wetP.z - zc ); if ( dz < hw ) dk = min( dk, hw - dz );
        wetGut = 1.0 - smoothstep( 0.4, 1.6, dk );
      }
      wetSh = wetDry * ( 0.095 - 0.13 * max( wetGut, wetLow ) );
    }
    float wetM = smoothstep( 0.63 + 0.05 * ( 1.0 - wetH ) - wetT + wetSh, 0.7 + 0.05 * ( 1.0 - wetH ) - wetT + wetSh - 0.01 * wetDry, wetN ) * wetFlat * wetGrey;
    float damp = max( smoothstep( 0.48 + wetSh + 0.02 * wetDry, 0.62 + wetSh + 0.02 * wetDry, wetN ), wetRain ) * wetFlat * wetGrey; // damp rim: darker, semi-glossy
    if ( wetRain * wetM > 0.01 ) { // rain ripples on the puddles: expanding rings in two jittered cell layers
      vec2 rg = vec2( 0.0 );
      for ( int k = 0; k < 2; k ++ ) {
        vec2 rq = q / ( 0.55 + 0.3 * float( k ) ) + float( k ) * 7.31;
        vec2 rc = floor( rq ), rf = fract( rq ) - 0.5;
        float rh = fract( sin( dot( rc, vec2( 12.99, 78.23 ) ) ) * 43758.55 );
        vec2 ro = rf - ( vec2( fract( rh * 7.1 ), fract( rh * 13.7 ) ) - 0.5 ) * 0.5;
        float rt = fract( ambData.wx.y * 1.1 + rh ), rd = length( ro );
        float ring = sin( ( rd - rt * 0.5 ) * 45.0 ) * exp( - pow( ( rd - rt * 0.5 ) * 14.0, 2.0 ) ) * ( 1.0 - rt );
        rg += ro / max( rd, 1e-3 ) * ring;
      }
      normal = normalize( normal + ( viewMatrix * vec4( rg.x, 0.0, rg.y, 0.0 ) ).xyz * 0.35 * wetM * wetRain );
    }
    material.roughness = mix( material.roughness, 0.3, damp * 0.6 );
    material.roughness = mix( material.roughness, 0.045, wetM );
    material.diffuseColor *= 1.0 - 0.28 * damp - 0.22 * wetM;
    material.specularColor = mix( material.specularColor, vec3( 0.02 ), wetM ); // a water film: dielectric F0 whatever lies below
    material.specularF90 = mix( material.specularF90, 1.0, wetM );
  }
}
#endif
`;
    if (wetOn && !SC.lights_physical_fragment.includes("wetFlat"))
        SC.lights_physical_fragment = SC.lights_physical_fragment + wet;
    const add = /* glsl */ `
#if defined( STANDARD ) && defined( OPAQUE ) && !defined( NO_SSR ) && !defined( USE_TRANSMISSION )
{
  float ssrRough = material.roughness;
  vec3 ssrF = EnvironmentBRDF( normal, geometryViewDir, material.specularColor, material.specularF90, ssrRough );
  float ssrW = dot( ssrF, vec3( 0.2126, 0.7152, 0.0722 ) ) * ( 1.0 - smoothstep( 0.16, 0.36, ssrRough ) );
  #ifdef USE_CLEARCOAT
    vec3 ssrC = EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
    ssrW = max( ssrW, material.clearcoat * dot( ssrC, vec3( 0.2126, 0.7152, 0.0722 ) ) * ( 1.0 - smoothstep( 0.16, 0.36, material.clearcoatRoughness ) ) );
  #endif
  gl_FragColor.a = 1.0 + clamp( ssrW, 0.0, 0.98 );
}
#endif
`;
    if (!SC.opaque_fragment.includes("ssrW"))
        SC.opaque_fragment = SC.opaque_fragment + add;

    const env = SC.envmap_physical_pars_fragment;
    const target = "return PI * envMapColor.rgb * envMapIntensity;";
    if (env.includes(target) && !env.includes("ambData")) {
        SC.envmap_physical_pars_fragment =
            /* glsl */ `
struct AmbData { vec4 grade; vec4 bounce; vec4 shape; vec4 city; vec4 wx; vec4 vert; vec4 cgrid; };
uniform AmbData ambData;
` +
            env.replace(
                target,
                /* glsl */ `vec3 irr = PI * envMapColor.rgb * envMapIntensity;
			float irrL = dot( irr, vec3( 0.2126, 0.7152, 0.0722 ) );
			irr = mix( vec3( irrL ), irr, ambData.grade.w ) * ambData.grade.rgb;
			float down = clamp( 0.5 - 0.5 * worldNormal.y, 0.0, 1.0 );
			irr *= mix( 1.0, ambData.shape.y, clamp( worldNormal.y, 0.0, 1.0 ) );
			// (atmosphere r3) street-level inter-reflection: in the canyons the sunlit asphalt, sidewalks and facades
			// bounce a lot of warm light onto everything standing in shade (people, cars, shop fronts, lower walls).
			// Stronger near the ground, fading with height (so tower shade sides seen from the air keep their contrast)
			float bGround = 1.0;
			#ifndef FLAT_SHADED
			{
				float wy = cameraPosition.y + dot( viewMatrix[ 1 ].xyz, - vViewPosition );
				// (lighting2 r2) + a long-range tail: tall shaded facades still see sunlit roofs / facades across the street
				// (off-screen for SSGI), so walls keep some warm fill tens of metres up
				irr *= 1.0 - ambData.vert.z * ( 1.0 - smoothstep( 2.0, 30.0, wy ) ); // (lighting2 r6) street-canyon skylight occlusion: cars / props / people in the canyon see a slot of sky
				bGround += ambData.shape.w * ( exp( - max( wy, 0.0 ) / 26.0 ) + 0.3 * exp( - max( wy, 0.0 ) / 150.0 ) ) * ( 1.0 - 0.7 * clamp( worldNormal.y, 0.0, 1.0 ) )
					* mix( 1.0, ambData.vert.y, 1.0 - abs( worldNormal.y ) ); // (lighting2 r6) user: walls / objects in shade too bright
			}
			#endif
			irr += ambData.bounce.rgb * mix( ambData.shape.x, 1.0, down * sqrt( down ) ) * bGround * envMapIntensity;
			irr *= ( ambData.shape.z > 0.0 ? ambData.shape.z : 1.0 ); // (atmosphere r2) diffuse-only IBL gain
			irr *= mix( 1.0, ambData.vert.x, smoothstep( 0.2, 0.85, 1.0 - abs( worldNormal.y ) ) ); // (lighting2 r6) vertical-surface fill: shaded facades / objects read dark (refs: 5-8:1 sun : shade on walls)
			// (lighting2 r3) NIGHT CITY LIGHT (night_aerial / ts_night refs): sodium street lighting fills the street level
			// (orange lines seen from above, lit sidewalks / lower facades / cars / people), and Times Square is bathed in
			// the coloured light of its screens (projected colour field: magenta / blue / cyan / warm, fading with height)
			#if !defined( FLAT_SHADED ) && !defined( NO_CITYLIGHT ) // NO_CITYLIGHT: far shores / other boroughs (farshore.js)
			if ( ambData.city.r + ambData.city.w > 0.0 ) {
				vec3 cwp = cameraPosition + ( - vViewPosition ) * mat3( viewMatrix );
				float cy = max( cwp.y, 0.0 ), cup = clamp( worldNormal.y, 0.0, 1.0 );
				// lamp rhythm along the streets (~30 m) so the light is not a flat wash
				float lr = 0.7 + 0.3 * sin( cwp.x * 0.21 + 1.3 ) * sin( cwp.z * 0.19 );
				// only the modelled city (the far shores / hinterland ground plates would light up as one glowing band)
				float cfar = smoothstep( 2600.0, 1300.0, length( cwp.xz - cameraPosition.xz ) );
				if ( ambData.cgrid.w > 0.0 ) { vec2 gq = abs( ( cwp.xz - ambData.cgrid.xy ) / ambData.cgrid.z * 2.0 - 1.0 ); cfar *= max( smoothstep( 0.8, 0.98, max( gq.x, gq.y ) ), 0.6 * smoothstep( 220.0, 420.0, length( cwp - cameraPosition ) ) ); } // far inside the grid only ~5 lights per pixel (LOD): keep part of the analytic glow (critic r2: only one avenue glows from above) // (night) inside the local-light grid the real lamps light the street (citylights.js); the analytic glow takes over at its edge
				irr += ambData.city.rgb * ( exp( - cy / 4.5 ) * ( 0.45 + 0.55 * cup ) * lr + 0.12 * exp( - cy / 18.0 ) ) * cfar;
				if ( ambData.city.w > 0.0 ) {
					vec2 tq = cwp.xz;
					float inTS = smoothstep( 112.0, 70.0, abs( tq.x ) ) * smoothstep( -352.0, -318.0, tq.y ) * smoothstep( 22.0, -6.0, tq.y );
					if ( inTS > 0.0 ) {
						float ph = tq.y * 0.021 + tq.x * 0.013 + 0.35 * sin( tq.y * 0.047 + tq.x * 0.03 );
						vec3 c1 = mix( vec3( 1.0, 0.25, 0.7 ), vec3( 0.25, 0.45, 1.0 ), 0.5 + 0.5 * sin( ph * 6.2831 ) );
						vec3 c2 = mix( vec3( 0.2, 0.9, 1.0 ), vec3( 1.0, 0.7, 0.35 ), 0.5 + 0.5 * sin( ph * 4.1 + 1.7 ) );
						vec3 tc = mix( c1, c2, 0.5 + 0.5 * sin( tq.x * 0.05 - tq.y * 0.031 ) );
						tc = max( tc - 0.55 * min( tc.r, min( tc.g, tc.b ) ), 0.0 ) * 1.4; // (lighting2 r4) saturated magenta / cyan / amber spill, not white
						float th = exp( - cy / 22.0 ) * ( 0.55 + 0.45 * cup ) + 0.35 * exp( - cy / 70.0 ) * ( 1.0 - cup );
						th += ambData.vert.w * 0.9 * smoothstep( 12.0, 35.0, cy ) * exp( - max( cy - 35.0, 0.0 ) / 60.0 ); /* (night r9) 1.6: upper facades read lavender, ref walls between screens are near-black */ // (night r5) roofs / ledges around the square bathed in the screens' colour (ts_perch ref: pink ledge)
						irr += tc * ( ambData.city.w * inTS * th ) * ( 1.0 - ambData.vert.w * ( 1.0 - mix( 0.4, 0.35, smoothstep( 18.0, 40.0, cy ) ) ) );  // (night r5) above the street the analytic screen-colour field stays at 60%: roofs / upper facades around the square pick up the magenta glow (critic r4: TS perch roof black) // (night) real screen lights (screenlights.js) replace this analytic spill; city.w still drives the damp TS asphalt
					}
				}
			}
			#endif
			return irr;`,
            );
        for (const k of [
            "standard",
            "physical",
            "lambert",
            "phong",
            "toon",
        ] as const) {
            const lib = THREE.ShaderLib[k];
            if (lib) (lib.uniforms as any).ambData = { value: ambShared };
        }
    } else if (!env.includes("ambData")) {
        console.warn(
            "[render/surface] could not patch envmap_physical_pars_fragment",
        );
    }
}
