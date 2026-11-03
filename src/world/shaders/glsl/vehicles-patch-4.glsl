#include <lights_fragment_maps>
        #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV ) && defined( RE_IndirectSpecular )
        if (P == 3) radiance = min(mix(radiance, vehHorizon(geometryViewDir, geometryNormal, material.roughness) * 0.7, 0.85), vec3(1.1)); // (vehicles r4) no blown white sky blocks on glass from above
        #ifdef USE_CLEARCOAT
        else if (P == 1 || P == 0 || P == 15 || P == 7 || P == 8) clearcoatRadiance = mix(clearcoatRadiance, vehHorizon(geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness) * (P == 1 ? 2.1 : P == 0 ? 1.5 : 1.0), 0.9); // (vehicles r3) paint: stronger reflection read ((vehicles r4) x2.1 paint, x1.5 white bodies: director 'weak on yellow/white')
        #else
        else if (P == 1) radiance = mix(radiance, vehHorizon(geometryViewDir, geometryNormal, material.roughness), 0.5);
        #endif
        #endif