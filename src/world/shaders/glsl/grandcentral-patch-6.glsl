#include <metalnessmap_fragment>
        if (int(vGP + 0.5) == 8) metalnessFactor = 0.55 * (1.0 - gV); else if (int(vGP + 0.5) == 2) metalnessFactor = 0.35 * (1.0 - gV);