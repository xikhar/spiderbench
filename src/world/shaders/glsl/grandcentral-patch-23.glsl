#include <emissivemap_fragment>
        {
          float cv2 = max(dot(normalize(cameraPosition - vPW), normalize(vPN)), 0.0);
          float fres = 0.06 + 0.94 * pow(1.0 - cv2, 5.0);
          totalEmissiveRadiance += pInt * (1.0 - fres) * (1.0 - pOpq) * 0.55;
        }