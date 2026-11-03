Surf FS; facade(FS);
#ifdef FAR_NIGHT
FS.alb *= 1.0 - 0.8 * uNightK; // (night) far shores: dark silhouettes at night (critic r1: beige-peach masses read like dusk)
#endif
diffuseColor.rgb = FS.alb;