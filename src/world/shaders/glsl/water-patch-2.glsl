#include <fog_vertex>
        vWPw = (modelMatrix * vec4(transformed, 1.0)).xyz; vRefl = uTexMat * vec4(vWPw, 1.0);