#include <lights_physical_pars_fragment>
        #if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
        vec3 vehHorizon(vec3 viewDir, vec3 n, float rough) {
          vec3 r = transformDirectionByInverseViewMatrix(reflect(-viewDir, n), viewMatrix);
          float h = r.y;
          vec3 sky = textureCubeUV(envMap, envMapRotation * normalize(vec3(r.x, max(h, 0.1), r.z)), max(rough, 0.03)).rgb * envMapIntensity;
          vec3 hor = textureCubeUV(envMap, envMapRotation * normalize(vec3(r.x, 0.35, r.z)), 0.5).rgb * envMapIntensity;
          float id = floor(atan(r.z, r.x) * 11.0);
          float bt = 0.03 + 0.24 * fract(sin(id * 12.9898) * 43758.5453);   // building tops (elevation, ~2-15 deg)
          float e = 0.006 + rough * 0.4;
          float bld = 1.0 - smoothstep(bt - e, bt + e, h);
          float gnd = 1.0 - smoothstep(-0.04 - e, 0.0 + e, h);
          vec3 c = sky * 1.25;
          c = mix(c, hor * (0.24 + 0.1 * fract(id * 0.618)), bld);
          c = mix(c, hor * 0.04, gnd);
          return c;
        }
        #endif