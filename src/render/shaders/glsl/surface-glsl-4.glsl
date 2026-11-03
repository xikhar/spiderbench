vec3 irr = PI * envMapColor.rgb * envMapIntensity;
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
						irr += tc * ( ambData.city.w * inTS * th ) * ( 1.0 - ambData.vert.w * ( 1.0 - mix( 0.4, 0.35, smoothstep( 18.0, 40.0, cy ) ) ) ); /* (night r6) 40 % at street level too: warm-magenta plaza fill (critic: plazas ~45 % under the ref) */ // (night r5) above the street the analytic screen-colour field stays at 60%: roofs / upper facades around the square pick up the magenta glow (critic r4: TS perch roof black) // (night) real screen lights (screenlights.js) replace this analytic spill; city.w still drives the damp TS asphalt
					}
				}
			}
			#endif
			return irr;