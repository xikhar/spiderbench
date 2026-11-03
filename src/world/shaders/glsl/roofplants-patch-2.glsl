#include <uv_vertex>
      #ifdef USE_INSTANCING
        { float t = floor(aPlant.x + 0.5), d = floor(aPlant.x / 4.0 + 0.001); // aPlant.x = tile + 4 * geometry default tile
          t = t - d * 4.0;
          vec2 off = vec2(mod(t, 2.0), floor(t / 2.0)) * 0.5 - vec2(mod(d, 2.0), floor(d / 2.0)) * 0.5;
          vMapUv += off; }
      #endif
      vPTint = aPlant.yzw; vPY = position.y;