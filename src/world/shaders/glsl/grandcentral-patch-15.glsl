#include <emissivemap_fragment>
        {
          float cv2 = max(dot(normalize(cameraPosition - vGWp), normalize(vGNp)), 0.0);
          float fres = 0.08 + 0.92 * pow(1.0 - cv2, 5.0);
          totalEmissiveRadiance += gInt * (1.0 - fres) * (1.0 - vGMull * 0.5) * 1.15; /* (street r10) 0.85 -> 1.15: warm concourse glow behind the deep reveals */ // (street r6) dimmer: deep, dark hall // (street r5) warmer interior glow
        }