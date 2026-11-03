#include <begin_vertex>
        float w = (transformed.x - 0.35) / 2.1;
        float ph = uTime * 5.0 - transformed.x * 2.6 + instanceMatrix[3].x * 0.37;
        transformed.z += sin(ph) * 0.16 * w + sin(ph * 1.7 + 1.0) * 0.05 * w;
        objectNormal = normalize(vec3(-cos(ph) * 0.3 * w, 0.0, 1.0));