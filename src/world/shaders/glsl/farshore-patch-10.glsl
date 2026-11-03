#include <color_vertex>
        vWin = color.b > 5.0 ? 1.0 : 0.0; vGl = color.b > 15.0 ? 1.0 : 0.0;
        vColor.b = color.b > 15.0 ? color.b - 20.0 : color.b > 5.0 ? color.b - 10.0 : color.b;