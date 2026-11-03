import{$r as e,Ht as t,Qi as n,Rt as r,U as i,Yt as a,_r as o,cr as s,do as c,ei as l,fa as u,ft as d,io as f,ir as ee,kr as te,ro as p,to as m,tr as h,zi as ne}from"./three~index~index~shots~index~GLTFLoader-BF58tRDi.js";import{n as g,r as _}from"./three~index~shots~index-BGl7d7Kg.js";function v(e,...t){let n=e;for(let e=0;e<t.length;e++)n=n.replaceAll(`__SHADER_INJECT_${e}__`,String(t[e]));return n}var y=`#include <begin_vertex>
#ifdef USE_INSTANCING
transformed -= normalize( normal ) * 0.2;
#endif`,b=`\r
// (r11) fallbacks set per material by fixPrograms() on GPUs with 16 fragment texture units (Apple / ANGLE D3D11):\r
// CITYL_NOSH drops the shadow-map sampler, CITYL_OFF the city lights entirely (the program would not link)\r
#ifdef CITYL_OFF\r
#undef USE_CITYL\r
#endif\r
// (r13) CITYL_UNIF: no city-light textures at all: the CL_UN lights that light the player most arrive as a uniform array\r
// (cityLU, same 4-texel records; count in cityLU[ CL_UN * 4 ].x). For materials that are over the unit limit even without\r
// the shadow sampler (the suit on the Mac: 16 of its own), so Spider-Man is still lit by the lamps / cars / screens\r
#ifdef CITYL_UNIF\r
#define CITYL_NOSH\r
#endif\r
#ifdef USE_CITYL\r
#ifndef CITYL_PARS\r
#define CITYL_PARS\r
#ifdef CITYL_UNIF\r
struct CityL { vec4 origin; vec4 misc; mat4 shM[ __SHADER_INJECT_0__ ]; vec4 shW; };\r
uniform vec4 cityLU[ __SHADER_INJECT_1__ ];\r
#elif defined( CITYL_NOSH )\r
struct CityL { sampler2D data; highp usampler2D grid; vec4 origin; vec4 misc; mat4 shM[ __SHADER_INJECT_2__ ]; vec4 shW; };\r
#else\r
struct CityL { sampler2D data; highp usampler2D grid; vec4 origin; vec4 misc; mat4 shM[ __SHADER_INJECT_3__ ]; sampler2D shMap; vec4 shW; };\r
#endif\r
uniform CityL cityL;\r
#ifdef CITYL_UNIF\r
vec4 cityLTex( int li, int k ) { return cityLU[ li * 4 + k ]; }\r
#else\r
vec4 cityLTex( int li, int k ) { return texelFetch( cityL.data, ivec2( ( li & 255 ) * 4 + k, li >> 8 ), 0 ); }\r
#endif\r
// shadow of slot s at wp (dist: distance to the light, range: its range): 3x3 PCF of the distance map, faded by shW\r
float cityLShadow( int s, vec3 wp, float dist, float range ) {\r
  #ifdef CITYL_NOSH\r
  return 1.0;\r
  #else\r
  vec4 cp = cityL.shM[ s ] * vec4( wp, 1.0 );\r
  if ( cp.w <= 0.0 ) return 1.0;\r
  vec2 uv = cp.xy / cp.w * 0.5 + 0.5;\r
  if ( any( lessThan( uv, vec2( 0.004 ) ) ) || any( greaterThan( uv, vec2( 0.996 ) ) ) ) return 1.0;\r
  vec2 tile = vec2( float( s & 1 ), float( s >> 1 ) ) * 0.5;\r
  vec2 tuv = tile + uv * 0.5;\r
  const float tx = 1.0 / __SHADER_INJECT_4__.0;\r
  float fd = dist / range - ( 0.05 + dist * 0.02 ) / range; // receiver bias grows with the texel footprint\r
  float vis = 0.0;\r
  // 3x3 taps on a rotated grid (breaks up texel stair-steps), footprint ~2.5 texels\r
  const mat2 R = mat2( 0.866, 0.5, -0.5, 0.866 );\r
  for ( int j = - 1; j <= 1; j ++ ) for ( int i = - 1; i <= 1; i ++ ) {\r
    vec2 q = clamp( tuv + R * vec2( float( i ), float( j ) ) * tx * 1.25, tile + tx, tile + 0.5 - tx );\r
    vis += step( fd, textureLod( cityL.shMap, q, 0.0 ).r );\r
  }\r
  float w = s == 0 ? cityL.shW.x : s == 1 ? cityL.shW.y : s == 2 ? cityL.shW.z : cityL.shW.w;\r
  return mix( 1.0, vis / 9.0, w );\r
  #endif\r
}\r
// incident light of city light li at world point wp: returns the colour (0 if none), world direction to the light and\r
// the source-size roughness widening\r
// (night r10) specular representative point (Karis 2013): cityLSpecDir = direction to the point of the emitter closest to\r
// the reflection ray cityLRefl (set by the caller, world space; zero = unused), cityLAng = the emitter's angular size\r
// (for the energy normalisation (a / a')^2 in the caller)\r
vec3 cityLRefl = vec3( 0.0 ), cityLSpecDir = vec3( 0.0, 1.0, 0.0 ); float cityLAng = 0.0;\r
vec3 cityLIncident2( int li, vec3 wp, out vec3 Ldir, out float widen, out float specK ) {\r
  vec4 a = cityLTex( li, 0 );\r
  Ldir = vec3( 0.0, 1.0, 0.0 ); widen = 0.0; specK = 1.0; cityLAng = 0.0;\r
  vec3 lp = a.xyz, L0 = lp - wp;\r
  float dc2 = dot( L0, L0 );\r
  if ( dc2 > a.w * a.w ) return vec3( 0.0 ); // out of range (rects: a.w = range + half diagonal, from the centre): skip the other 3 fetches\r
  vec4 b = cityLTex( li, 1 ), c = cityLTex( li, 2 ), d = cityLTex( li, 3 );\r
  float type = floor( b.w );\r
  if ( type > 1.5 ) { // rect emitter (screen / lit window): representative point = closest point of the rectangle\r
    vec3 rel = wp - lp;\r
    float side = dot( rel, c.xyz );\r
    if ( side <= 0.02 ) return vec3( 0.0 );\r
    vec3 v = cross( c.xyz, d.xyz );\r
    float du = clamp( dot( rel, d.xyz ), - c.w, c.w ), dv = clamp( dot( rel, v ), - d.w, d.w );\r
    vec3 L = lp + d.xyz * du + v * dv - wp;\r
    float d2 = dot( L, L );\r
    float dist = sqrt( d2 );\r
    Ldir = L / max( dist, 1e-4 );\r
    float area = 4.0 * c.w * d.w;\r
    float cosE = mix( side / max( length( rel ), 1e-3 ), max( dot( c.xyz, - Ldir ), 0.0 ), 0.6 ); // emitter cosine: centre (smooth) blended with the closest point (floors / ledges at the foot of a big screen get their light)\r
    float win = 1.0 - dc2 / ( a.w * a.w ); win *= win;\r
    widen = min( 0.15, min( c.w, d.w ) / ( 2.0 * dist + 0.5 ) ); // (night r10) wrap capped at 0.15: near big screens it lit faces turned away evenly (flat, self-lit look)\r
    cityLSpecDir = Ldir; cityLAng = min( 1.0, sqrt( area ) / ( dist + 0.5 ) );\r
    float rn = dot( cityLRefl, c.xyz );\r
    if ( rn < -1e-3 ) { // the reflection ray heads toward the emitter's lit face: its hit point on the plane, clamped into the rect\r
      float t = dot( lp - wp, c.xyz ) / rn;\r
      if ( t > 0.0 ) {\r
        vec3 h = wp + cityLRefl * t - lp;\r
        vec3 hp = lp + d.xyz * clamp( dot( h, d.xyz ), - c.w, c.w ) + v * clamp( dot( h, v ), - d.w, d.w ) - wp;\r
        cityLSpecDir = normalize( hp );\r
      }\r
    }\r
    return b.rgb * ( area * cosE / ( d2 + area * 0.3183 ) ) * win;\r
  }\r
  vec3 L = L0;\r
  float d2 = dc2;\r
  float dist = sqrt( d2 );\r
  Ldir = L / max( dist, 1e-4 );\r
  float x = d2 / ( a.w * a.w ); float win = 1.0 - x * x; win *= win;\r
  float att = win / ( d2 + d.x * d.x + 0.25 );\r
  if ( type > 0.5 ) att *= smoothstep( c.w, d.w, dot( - Ldir, c.xyz ) ); // spot cone\r
  if ( d.y > 0.5 && att > 0.0 ) att *= cityLShadow( int( d.y ) - 1, wp, dist, a.w ); // (night) real-time shadow slot\r
  widen = d.x / ( 2.0 * dist + 0.5 ); specK = d.z;\r
  { // sphere light: the point of the sphere closest to the reflection ray (Karis 2013). d.x is a softness radius for the\r
    // diffuse near field (headlights 3.5 m, neon ~1 m); the real emitters (lamp heads, bulbs, tubes) are small: <= 0.25 m\r
    float rs = min( d.x, 0.25 );\r
    cityLAng = min( 1.0, rs / ( dist + 0.25 ) );\r
    vec3 ctr = dot( L, cityLRefl ) * cityLRefl - L;\r
    cityLSpecDir = normalize( L + ctr * clamp( rs / max( length( ctr ), 1e-4 ), 0.0, 1.0 ) );\r
  }\r
  return b.rgb * att;\r
}\r
vec3 cityLIncident( int li, vec3 wp, out vec3 Ldir, out float widen ) { float specK; return cityLIncident2( li, wp, Ldir, widen, specK ); }\r
// light list of the grid cell holding wp: returns the count (0: outside the grid / above every light in the cell)\r
int cityLCell( vec3 wp, out int bx, out int by, out uvec4 h0 ) {\r
  #ifdef CITYL_UNIF\r
  bx = 0; by = 0; h0 = uvec4( 0u );\r
  return cityL.origin.w > 0.0 ? int( cityLU[ __SHADER_INJECT_5__ ].x ) : 0;\r
  #else\r
  vec2 cg = ( wp.xz - cityL.origin.xy ) / cityL.origin.z;\r
  #ifndef CITYL_NODITHER\r
  { // (night r9) dithered cell lookup (+-0.3 cell, rotating per frame): where neighbouring cells' lists differ (slot overflow, far LOD) the\r
    // boundary is a TAA-resolved blend instead of a straight edge\r
    vec2 q = gl_FragCoord.xy + cityL.misc.y * 7.13;\r
    cg += ( vec2( fract( 52.9829189 * fract( dot( q, vec2( 0.06711056, 0.00583715 ) ) ) ), fract( 52.9829189 * fract( dot( q.yx, vec2( 0.06711056, 0.00583715 ) ) ) ) ) - 0.5 ) * 0.6;\r
  }\r
  #endif\r
  bx = 0; by = 0; h0 = uvec4( 0u );\r
  if ( cityL.origin.w <= 0.0 || any( lessThan( cg, vec2( 0.0 ) ) ) || any( greaterThanEqual( cg, vec2( __SHADER_INJECT_6__.0 ) ) ) ) return 0;\r
  ivec2 cc = ivec2( cg ); bx = cc.x * __SHADER_INJECT_7__; by = cc.y + ( wp.y >= __SHADER_INJECT_8__.0 ? __SHADER_INJECT_9__ : 0 ); // height layer\r
  h0 = texelFetch( cityL.grid, ivec2( bx, by ), 0 );\r
  if ( wp.y > float( h0.y ) - 1000.0 ) return 0;\r
  return int( h0.x );\r
  #endif\r
}\r
int cityLIndex( int i, int bx, int by, uvec4 h0 ) {\r
  #ifdef CITYL_UNIF\r
  return i;\r
  #else\r
  if ( i < 2 ) return int( i == 0 ? h0.z : h0.w );\r
  uvec4 hh = texelFetch( cityL.grid, ivec2( bx + 1 + ( i - 2 ) / 4, by ), 0 );\r
  return int( hh[ ( i - 2 ) & 3 ] );\r
  #endif\r
}\r
// fade toward the grid border (lights hand over to the far-field city glow in surface.js)\r
float cityLEdge( vec3 wp ) {\r
  vec2 q = abs( ( wp.xz - cityL.origin.xy ) / ( cityL.origin.z * __SHADER_INJECT_10__.0 ) * 2.0 - 1.0 );\r
  return 1.0 - smoothstep( 0.8, 0.98, max( q.x, q.y ) );\r
}\r
// diffuse irradiance (Lambert, N.L) for custom shaders (trees, crowd): multiply by albedo / PI\r
vec3 cityLightIrradiance( vec3 wp, vec3 wn ) {\r
  int bx, by; uvec4 h0; int n = cityLCell( wp, bx, by, h0 );\r
  vec3 E = vec3( 0.0 );\r
  for ( int i = 0; i < __SHADER_INJECT_11__; i ++ ) {\r
    if ( i >= n ) break;\r
    vec3 Ld; float wd;\r
    vec3 c = cityLIncident( cityLIndex( i, bx, by, h0 ), wp, Ld, wd );\r
    E += c * max( dot( wn, Ld ), 0.0 );\r
  }\r
  return E * cityL.misc.x * cityLEdge( wp );\r
}\r
#endif\r
#endif\r
`,re=`\r
#if defined( USE_CITYL ) && defined( RE_Direct )\r
if ( cityL.origin.w > 0.0 ) {\r
  vec3 clWP = cameraPosition + geometryPosition * mat3( viewMatrix );\r
  int clBx, clBy; uvec4 clH0;\r
  int clN = cityLCell( clWP, clBx, clBy, clH0 );\r
  if ( clN > 0 ) {\r
    #if defined( STANDARD ) && !( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )\r
    material.multiScatteringCompensation = vec3( 1.0 );\r
    #endif\r
    #if defined( STANDARD ) && !defined( USE_CLEARCOAT ) && !defined( USE_SHEEN ) && !defined( USE_IRIDESCENCE ) && !defined( USE_ANISOTROPY )\r
      #define CL_FAST\r
    #endif\r
    float clK = cityL.misc.x * cityLEdge( clWP );\r
    mat3 clVM = mat3( viewMatrix );\r
    vec3 clE = vec3( 0.0 );\r
    cityLRefl = normalize( reflect( - geometryViewDir, geometryNormal ) * clVM ); // world-space reflection ray (spec representative point)\r
    #ifdef CL_FAST\r
    bool clSpec = material.roughness < 0.75;\r
    #ifdef CITYL_NOSPEC\r
    clSpec = false; // (night r11) material opt-out (LED screens: matte louvred panels; a neighbour's light smeared a long glossy streak across the TS perch screen)\r
    #endif\r
    float clR = material.roughness, clRorig = material.roughness;\r
    { // (night r10) specular anti-aliasing for the local lights: normal-map detail (asphalt aggregate) under a lamp or\r
      // headlight broke into glitter; widen the lobe by the screen-space normal variation (flat puddles keep their mirror)\r
      vec3 clDn = fwidth( geometryNormal ); float clV = dot( clDn, clDn );\r
      clR = min( 1.0, sqrt( clR * clR + 0.6 * clV ) );\r
    }\r
    #endif\r
    // (perf) lights are sorted strongest first: far surfaces and alpha-tested foliage only take the dominant ones\r
    int clMax = clN;\r
    #if defined( USE_ALPHATEST ) || defined( USE_ALPHAHASH )\r
    clMax = min( clMax, 6 );\r
    #endif\r
    clMax = min( clMax, int( mix( __SHADER_INJECT_0__.0, 8.0, smoothstep( 30.0, 160.0, length( geometryPosition ) ) ) ) ); // (perf r5) screens + signs raised TS to ~870 lights\r
    for ( int i = 0; i < __SHADER_INJECT_1__; i ++ ) {\r
      if ( i >= clMax ) break;\r
      vec3 clL; float clWd;\r
      float clSk;\r
      vec3 clC = cityLIncident2( cityLIndex( i, clBx, clBy, clH0 ), clWP, clL, clWd, clSk );\r
      if ( clC.r + clC.g + clC.b <= 1e-5 ) continue;\r
      vec3 clLv = normalize( clVM * clL );\r
      #ifdef CL_FAST\r
      float clNL = saturate( ( dot( geometryNormal, clLv ) + clWd ) / ( 1.0 + clWd ) ); // (night r9) wrap by the source's angular size: big screens light faces at grazing angles softly (no crisp reveal edges)\r
      #if defined( USE_ALPHATEST ) && defined( DOUBLE_SIDED )\r
      { // (night r9) foliage (alpha-tested, double-sided leaf cards): leaves transmit and scatter light, so a lamp lights a\r
        // canopy as a soft glowing volume, not leaf-by-leaf cut-outs (the blotchy 'grid-like' texture around lamp heads)\r
        float clNd = dot( geometryNormal, clLv );\r
        clNL = 0.22 + 0.55 * saturate( clNd ) + 0.28 * saturate( - clNd ); // front lit + light transmitted from behind\r
        // leaves a metre from a lamp head would be 30x the pool below and clip in patches: smooth compression\r
        clC *= 1.1 / ( 1.1 + max( clC.r, max( clC.g, clC.b ) ) );\r
      }\r
      #endif\r
      if ( clNL <= 0.0 ) continue;\r
      vec3 clIrr = clC * ( clK * clNL );\r
      clE += clIrr;\r
      if ( clSpec ) { // (night r10) representative point along the reflection ray + energy normalisation (a / a')^2 (Karis 2013):\r
        // a mirror-like surface shows the emitter's shape at its real brightness instead of a clipped disc\r
        vec3 clLs = normalize( clVM * cityLSpecDir );\r
        float clNLs = saturate( dot( geometryNormal, clLs ) );\r
        float clA = clR * clR, clA2 = min( 1.0, clA + 0.5 * cityLAng ), clNorm = ( clA * clA ) / max( clA2 * clA2, 1e-8 );\r
        material.roughness = clR;\r
        reflectedLight.directSpecular += clC * ( clK * clNLs * clSk * clNorm ) * BRDF_GGX( clLs, geometryViewDir, geometryNormal, material ) * material.multiScatteringCompensation;\r
      }\r
      #else\r
      IncidentLight clI; clI.direction = clLv; clI.color = clC * clK; clI.visible = true;\r
        #ifdef STANDARD\r
        float clR0 = material.roughness; material.roughness = min( 1.0, clR0 + clWd );\r
        RE_Direct( clI, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\r
        material.roughness = clR0;\r
        #else\r
        RE_Direct( clI, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );\r
        #endif\r
      #endif\r
    }\r
    #ifdef CL_FAST\r
    material.roughness = clRorig;\r
    reflectedLight.directDiffuse += clE * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - material.specularColorBlended * 0.5 );\r
    #undef CL_FAST\r
    #endif\r
  }\r
}\r
#endif\r
`,ie=`#define USE_CITYL
`,ae={value:0},oe={value:0},se={value:1},ce=new Set;function le(e){return ce.add(e),e.layers.mask=1,e}var ue=240;function de(){let e=+(ae.value>.01||ue>0);for(let t of ce)t.layers.mask!==e&&(t.layers.mask=e)}function fe(){(ue>0&&--ue===0||ue>0)&&de()}var pe=2048,x=512,me=new Float32Array(260),he=!1,ge=new Float32Array(pe*16),S=new d(ge,1024,pe/256,e,r);S.minFilter=S.magFilter=o,S.generateMipmaps=!1,S.needsUpdate=!0;var _e=new Uint16Array(229376),C=new d(_e,448,128,l,m);C.internalFormat=`RGBA16UI`,C.minFilter=C.magFilter=o,C.generateMipmaps=!1,C.needsUpdate=!0;var w=1024,T=new c(w*2,w*2,{type:a,format:ne,minFilter:o,magFilter:o,depthBuffer:!0,generateMipmaps:!1});T.texture.name=`cityLightShadows`;var E={data:S,grid:C,origin:new f(0,0,8,0),misc:new f(1,0,0,0),shM:Array.from({length:4},()=>new ee),shMap:T.texture,shW:new f},ve=v(b,4,65,4,4,w*2,64,64,7,14,64,64,26),ye=v(re,26,26),be=ve,D=null,xe=null,Se=-1,Ce=0,we=new WeakSet;function Te(){let e=D?.info.programs;if(!e||e.length===Se&&++Ce%10)return;Se=e.length;let t=new Set(e.filter(e=>e.diagnostics&&!e.diagnostics.runnable&&!we.has(e)));if(!t.size)return;t.forEach(e=>we.add(e));let n=new Set;xe.traverse(e=>{for(let r of Array.isArray(e.material)?e.material:e.material?[e.material]:[]){if(n.has(r)||r.isShaderMaterial)continue;let e=D.properties.get(r);if(!t.has(e.currentProgram)&&!(e.programs&&[...e.programs.values()].some(e=>t.has(e))))continue;n.add(r);let i=r.defines||={};if(!(`CITYL_NOSH`in i))i.CITYL_NOSH=``;else if(!(`CITYL_UNIF`in i))i.CITYL_UNIF=``,he=!0;else if(!(`CITYL_OFF`in i))i.CITYL_OFF=``;else continue;r.needsUpdate=!0,console.warn(`[citylights] ${r.name||r.type}: program failed to link, retry with ${`CITYL_OFF`in i?`no city lights`:`CITYL_UNIF`in i?`the 16 lights nearest the player (no textures)`:`no city-light shadows`}`)}})}var Ee=!1;function De(e=null,t=null){if(D=e,xe=t,Ee)return;Ee=!0;let n=D?.capabilities?.maxTextures<=16;n&&(he=!0,N.shadows=!1);try{let e=new URLSearchParams(location.search);e.has(`nocl`)&&(N.enabled=!1),e.has(`noclsh`)&&(N.shadows=!1),e.has(`noclvol`)&&(N.volume=0)}catch{}let r=g;r.lights_pars_begin.includes(`CITYL_PARS`)||(r.lights_pars_begin=r.lights_pars_begin+(n?`
#define CITYL_UNIF
`:``)+ve);let i=r.lights_fragment_begin,a=i.indexOf(`#if defined( RE_IndirectDiffuse )`);if(a<0)console.error(`[citylights] could not patch lights_fragment_begin`);else{i.includes(`clWP`)||(r.lights_fragment_begin=i.slice(0,a)+ye+i.slice(a));for(let e of[`standard`,`physical`,`lambert`,`phong`,`toon`]){let t=_[e];t&&(t.uniforms.cityL={value:E},t.uniforms.cityLU={value:me},t.fragmentShader.startsWith(`#define USE_CITYL
`)||(t.fragmentShader=ie+t.fragmentShader))}}}var Oe={point:0,spot:1,rect:2},O=new i,k=64,A=[],j=new Map,M=[],ke=(e,t)=>(e+4096)*8192+(t+4096);function Ae(e,t){return e&&(Array.isArray(e)?(t[0]=e[0],t[1]=e[1],t[2]=e[2]):(t[0]=e.x,t[1]=e.y,t[2]=e.z)),t}function je(e,t={}){t.type=Oe[e.type??`point`]??0,t.p=Ae(e.pos,t.p||[0,0,0]),e.color==null?O.setRGB(1,1,1):Array.isArray(e.color)?O.setRGB(e.color[0],e.color[1],e.color[2],n):e.color.isColor?O.copy(e.color):O.set(e.color);let r=e.intensity??1;t.c=[O.r*r,O.g*r,O.b*r],t.lum=(O.r*.2126+O.g*.7152+O.b*.0722)*r,t.range=e.range??20,t.d=Ae(e.dir,t.d||[0,-1,0]);{let e=Math.hypot(t.d[0],t.d[1],t.d[2])||1;t.d[0]/=e,t.d[1]/=e,t.d[2]/=e}t.u=Ae(e.u,t.u||[1,0,0]);{let e=Math.hypot(t.u[0],t.u[1],t.u[2])||1;t.u[0]/=e,t.u[1]/=e,t.u[2]/=e}let i=e.angle??.9,a=e.penumbra??.4;return t.cosO=Math.cos(i),t.cosI=Math.cos(i*(1-a)),t.hw=(e.width??1)/2,t.hh=(e.height??1)/2,t.radius=e.radius??.2,t.spec=Math.max(0,Math.min(1,e.spec??1)),t.hcos=t.type===1&&Math.abs(t.d[1])<.7?Math.cos(Math.min(Math.PI,Math.acos(Math.max(-1,Math.min(1,t.cosO)))+.35)):-2,t.rEff=t.type===2?t.range+Math.hypot(t.hw,t.hh):t.range,t.vol=Math.min(.99,Math.max(0,e.volume??.5)),t.day=!!e.day,t.key=e.key??null,t.shSlot=0,t.noShadow=e.shadow===!1,t.type===2&&(t.lum*=4*t.hw*t.hh),t.top=t.type===1&&t.d[1]<-.5?t.p[1]+.6:t.type===2?t.p[1]+t.hh+t.range:t.type===1?t.p[1]+t.range*Math.max(.05,Math.sin(Math.asin(Math.max(-1,Math.min(1,t.d[1])))+Math.acos(Math.max(-1,Math.min(1,t.cosO))))):t.p[1]+t.range,t.bot=t.type===2?t.p[1]-t.hh-t.range:t.p[1]-t.range,t}var N={enabled:!0,gain:1,volume:1,incremental:!0,stats:{lights:0,cand:0,cells:0,maxCell:0,ms:0},add(e){let t=je(e);t.id=A.length,A.push(t),I++;let n=ke(Math.floor(t.p[0]/k),Math.floor(t.p[2]/k)),r=j.get(n);return r||j.set(n,r=[]),r.push(t),t.bk=n,t.id},update(e,t){let n=A[e];if(!n)return;let r={...n.src,...t};n.src=r,I++;let i=n.bk;je(r,n);let a=ke(Math.floor(n.p[0]/k),Math.floor(n.p[2]/k));if(a!==i){let e=j.get(i);e?.splice(e.indexOf(n),1);let t=j.get(a);t||j.set(a,t=[]),t.push(n),n.bk=a}},remove(e){let t=A[e];if(!t)return;let n=j.get(t.bk);if(n){let e=n.indexOf(t);e>=0&&n.splice(e,1)}A[e]=null,I++},addProvider(e,t={}){let n={fn:e,moving:!!t.moving};return M.push(n),I++,()=>{let e=M.indexOf(n);e>=0&&M.splice(e,1),I++}},invalidate(){I++},get count(){return A.reduce((e,t)=>e+ +!!t,0)},frame:null,get ambient(){return K}};{let e=N.add;N.add=function(t){let n=e.call(this,t);return A[n].src={...t},n}}var P=[],F=0,I=0,Me=-1,Ne=-1,Pe=99,Fe=new p(1e9,0,0),Ie=new p,Le=new p,Re=new Set,ze=new Map,L={};function Be(e){je(e,P[F]||(P[F]={})),F++}var R=[],z=8192,Ve=new Uint8Array(z),He=new Uint16Array(z*26),B=new Float32Array(z*26),Ue=new Float32Array(z),We=new Float32Array(z),Ge=new Uint8Array(z);function Ke(e){let t=e*26,n=0,r=B[t];for(let e=1;e<26;e++){let i=B[t+e];i<r&&(r=i,n=e)}We[e]=r,Ge[e]=n}var V=new Uint8Array(26),H=new p,qe=new t,Je=new ee,Ye=new u;function Xe(e,t,n){let r=ge,i=e*16,a=t.day?1:n;r[i]=t.p[0],r[i+1]=t.p[1],r[i+2]=t.p[2],r[i+3]=t.rEff,r[i+4]=t.c[0]*a,r[i+5]=t.c[1]*a,r[i+6]=t.c[2]*a,r[i+7]=t.type+t.vol,r[i+8]=t.d[0],r[i+9]=t.d[1],r[i+10]=t.d[2],t.type===2?(r[i+11]=t.hw,r[i+12]=t.u[0],r[i+13]=t.u[1],r[i+14]=t.u[2],r[i+15]=t.hh):(r[i+11]=t.cosO,r[i+12]=t.radius,r[i+13]=t.shSlot,r[i+14]=t.spec,r[i+15]=t.cosI)}var U=!0,Ze=e=>{if(!U)return;let t=e.key;if(t==null||!Re.has(t)){U=!1;return}let n=ze.get(t);if(n===void 0)return;je(e,L);let r=R[n];r.p[0]=L.p[0],r.p[1]=L.p[1],r.p[2]=L.p[2],r.d[0]=L.d[0],r.d[1]=L.d[1],r.d[2]=L.d[2],r.c[0]=L.c[0],r.c[1]=L.c[1],r.c[2]=L.c[2],Xe(n,r,Ne)};function Qe(e,t){U=!0;for(let t of M)if(t.moving){try{t.fn(Ze,e)}catch{U=!1}if(!U)return!1}pt(e,t);for(let e=0;e<R.length;e++){let t=R[e];t.type===1&&(ge[e*16+13]=t.shSlot)}return S.needsUpdate=!0,!0}var W=new p,$e=new Int32Array(16),G=new Float32Array(16);function et(e){let t=typeof window<`u`?window.__ctx?.player?.object:null;t?t.getWorldPosition(W):W.copy(e.position),W.y+=1;let n=0,r=E.misc.z,i=ge;for(let e=0;e<r;e++){let t=e*16,r=i[t]-W.x,a=i[t+1]-W.y,o=i[t+2]-W.z,s=r*r+a*a+o*o,c=i[t+3]+1.5;if(s>c*c)continue;let l=i[t+4]*.3+i[t+5]*.55+i[t+6]*.15,u=(i[t+7]>=2?l*4*i[t+11]*i[t+15]:l)/(s+1);if(n<16){$e[n]=e,G[n++]=u;continue}let d=0;for(let e=1;e<16;e++)G[e]<G[d]&&(d=e);u>G[d]&&($e[d]=e,G[d]=u)}for(let e=0;e<n;e++)me.set(i.subarray($e[e]*16,$e[e]*16+16),e*16);me[256]=n}var tt=.16,K={lo:{value:new p},hi:{value:new p},gain:1},q=new p,J=new p,Y=new p,nt=0;function rt(e,t){let n=e.p[0]-q.x,r=e.p[1]-q.y,i=e.p[2]-q.z,a=n*n+r*r+i*i,o=Math.min(70,Math.max(25,e.rEff*2.5));if(a>o*o)return;let s=Math.sqrt(a),c=1-h.smoothstep(s,.55*o,o),l=(e.day?1:t)*tt*c*(e.type===2?4*e.hw*e.hh:1)/(a+36),u=h.clamp(r/(s+1),-1,1),d=.62+.18*Math.max(0,u);J.x+=e.c[0]*l*d,J.y+=e.c[1]*l*d,J.z+=e.c[2]*l*d,Y.x+=e.c[0]*l*(1-d),Y.y+=e.c[1]*l*(1-d),Y.z+=e.c[2]*l*(1-d)}function it(e){let t=performance.now(),n=t,r=nt?Math.min((t-nt)/1e3,.25):1;nt=t,J.set(0,0,0),Y.set(0,0,0);let i=typeof window<`u`?window.__ctx?.player?.object:null;if(i&&N.enabled&&e>=.01){i.getWorldPosition(q),q.y+=1;let t=Math.floor((q.x-70)/k),n=Math.floor((q.x+70)/k),r=Math.floor((q.z-70)/k),a=Math.floor((q.z+70)/k);for(let i=t;i<=n;i++)for(let t=r;t<=a;t++){let n=j.get(ke(i,t));if(n)for(let t of n)rt(t,e)}for(let t=0;t<F;t++)rt(P[t],e);let o=K.gain*N.gain;J.multiplyScalar(o),Y.multiplyScalar(o)}let a=1-Math.exp(-r/.5);K.lo.value.lerp(J,a),K.hi.value.lerp(Y,a),N.stats.ambMs=+(performance.now()-n).toFixed(3),N.stats.amb=[+K.lo.value.x.toFixed(4),+K.lo.value.y.toFixed(4),+K.lo.value.z.toFixed(4),+K.hi.value.y.toFixed(4)]}function at(e){let t=performance.now();D&&Te();let n=E,r=ae.value;if(it(r),!N.enabled||r<.01){n.origin.w=0,N.stats.lights=0;return}if(e.getWorldDirection(Le),Pe++,N.incremental&&I===Me&&Math.abs(r-Ne)<.005&&Pe<6&&e.position.distanceToSquared(Fe)<2.25&&Le.dot(Ie)>.9995&&Qe(e,r)){he&&et(e),N.stats.ms=performance.now()-t,N.stats.partial=!0;return}Pe=0,Me=I,Ne=r,Fe.copy(e.position),Ie.copy(Le),N.stats.partial=!1,e.getWorldDirection(H);let i=Math.hypot(H.x,H.z)||1,a=Math.min(210,70+.6*Math.max(0,e.position.y))*Math.min(1,i*1.5),o=e.position.x+H.x/i*a,s=e.position.z+H.z/i*a,c=Math.floor(o/8)*8-x/2,l=Math.floor(s/8)*8-x/2;n.origin.set(c,l,8,1),n.misc.x=N.gain,n.misc.w=r,n.misc.y=(n.misc.y+1)%64,e.updateMatrixWorld(),Je.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),qe.setFromProjectionMatrix(Je),R.length=0;let u=Math.floor(c/k),d=Math.floor((c+x)/k),f=Math.floor(l/k),ee=Math.floor((l+x)/k),te=t=>{let n=t.rEff;if(t.p[0]+n<c||t.p[0]-n>c+x||t.p[2]+n<l||t.p[2]-n>l+x||(Ye.center.set(t.p[0],t.p[1],t.p[2]),Ye.radius=n,!qe.intersectsSphere(Ye)))return;let i=t.p[0]-e.position.x,a=t.p[2]-e.position.z,o=t.p[1]-e.position.y;t.pri=t.lum*(t.day?1:r)/(i*i+o*o+a*a+400),R.push(t)};for(let e=u;e<=d;e++)for(let t=f;t<=ee;t++){let n=j.get(ke(e,t));if(n)for(let e of n)te(e)}let p=performance.now();F=0,Re.clear(),ze.clear();for(let t of M){let n=F;try{t.fn(Be,e)}catch(e){console.warn(`[citylights] provider`,e)}if(t.moving)for(let e=n;e<F;e++)P[e].mov=!0,P[e].key!=null&&Re.add(P[e].key);else for(let e=n;e<F;e++)P[e].mov=!1}for(let e=0;e<F;e++)te(P[e]);let m=performance.now();N.stats.cand=R.length,R.length>2048&&(R.sort((e,t)=>t.pri-e.pri),R.length=pe),pt(e,r);for(let e=0;e<R.length;e++){let t=R[e];t.mov&&t.key!=null&&ze.set(t.key,e)}for(let e=0;e<R.length;e++)Xe(e,R[e],r);let h=performance.now();Ve.fill(0),Ue.fill(-1e3);let ne=0,g=0;for(let e=0;e<R.length;e++){let t=R[e],n=t.rEff,r=t.p[0],i=t.p[2],a=n*n,o=Math.max(0,Math.floor((r-n-c)/8)),s=Math.min(63,Math.floor((r+n-c)/8)),u=Math.max(0,Math.floor((i-n-l)/8)),d=Math.min(63,Math.floor((i+n-l)/8)),f=t.bot<14,ee=t.top>=14,te=t.type===2,p=t.hcos>-2,m=t.top,h=t.lum,g=t.d[0],_=t.d[2],v=p?1/(Math.sqrt(g*g+_*_)||1):0,y=t.hcos;for(let t=u;t<=d;t++){let n=l+t*8,u=n>i?n-i:i>n+8?i-n-8:0,d=u*u;if(!(d>a))for(let l=o;l<=s;l++){let o=c+l*8,s=o>r?o-r:r>o+8?r-o-8:0,u=s*s+d;if(u>a)continue;if(p&&u>16){let e=o+4-r,t=n+4-i,a=Math.sqrt(e*e+t*t),s=(e*g+t*_)*v/a,c=6/a;if(s<y-(c<1?c:1))continue}if(te&&(o+4-r)*g+(n+4-i)*_<-6)continue;let b=h/(u+4),re=t*64+l;for(let t=0;t<2;t++){if(t===0?!f:!ee)continue;let n=t*64*64+re,r=Ve[n];if(r<26)He[n*26+r]=e,B[n*26+r]=b,Ve[n]=r+1,r+1>ne&&(ne=r+1),r+1===26&&Ke(n);else{if(b<=We[n])continue;let t=Ge[n];He[n*26+t]=e,B[n*26+t]=b,Ke(n)}m>Ue[n]&&(Ue[n]=m)}}}}let _=performance.now(),v=_e;for(let e=0;e<z;e++){let t=Ve[e],n=e/64|0,r=e-n*64,i=(n*64*7+r*7)*4;if(v[i]=t,!t)continue;g++,v[i+1]=Math.min(65535,Math.max(0,Math.ceil(Ue[e]+1e3)));let a=e*26;if(t>5){for(let e=0;e<t;e++){let t=B[a+e],n=e;for(;n>0&&B[a+V[n-1]]<t;)V[n]=V[n-1],n--;V[n]=e}for(let e=0;e<t;e++)v[i+2+e]=He[a+V[e]]}else for(let e=0;e<t;e++)v[i+2+e]=He[a+e]}S.needsUpdate=!0,C.needsUpdate=!0,n.misc.z=R.length,he&&et(e);let y=N.stats;y.lights=R.length,y.cells=g,y.maxCell=ne,y.ms=performance.now()-t;let b=performance.now();y.split={static:+(p-t).toFixed(2),providers:+(m-p).toFixed(2),records:+(h-m).toFixed(2),bin:+(_-h).toFixed(2),texture:+(b-_).toFixed(2)}}var ot=Array.from({length:4},()=>new te(90,1,.1,30)),st=Array.from({length:4},()=>{let e=new s;return e.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <begin_vertex>`,y)},e.customProgramCacheKey=()=>`clShrink`,e}),ct=Array.from({length:4},()=>({matrixWorld:new ee,shadow:{camera:{near:.1,far:30}}})),X=Array.from({length:4},()=>({id:null,rec:null,w:0})),Z=[],lt=0,Q=new p,ut=new p,dt=new p,ft=e=>e.key==null?e.id==null?null:`s`+e.id:`k`+e.key;function pt(e,t){let n=performance.now(),r=lt?Math.min((n-lt)/1e3,.1):0;lt=n;let i=typeof window<`u`?window.__ctx?.player?.object:null;i?i.getWorldPosition(Q):Q.copy(e.position),(!i||Q.distanceToSquared(e.position)>22500)&&(e.getWorldDirection(dt),Q.copy(e.position).addScaledVector(dt,12)),Q.y+=.9,Z.length=0;for(let e of R)e.shSlot=0;if(N.shadows)for(let e of R){if(e.type!==1||e.noShadow)continue;let t=ft(e);if(!t)continue;let n=Q.x-e.p[0],r=Q.y-e.p[1],i=Q.z-e.p[2],a=n*n+r*r+i*i;if(a>e.range*e.range)continue;let o=Math.sqrt(a)||1,s=(n*e.d[0]+r*e.d[1]+i*e.d[2])/o,c=Math.min(1,Math.max(0,(s-e.cosO)/Math.max(e.cosI-e.cosO,.001))),l=c*c*(3-2*c);if(l<=0)continue;let u=e.lum*l/(a+1);X.some(e=>e.id===t)&&(u*=1.6),e._imp=u,e._id=t,Z.push(e)}Z.sort((e,t)=>t._imp-e._imp),Z.length>4&&(Z.length=4);for(let e of X){let t=Z.find(t=>t._id===e.id);t?(e.rec=t,e.w=Math.min(1,e.w+r*3)):(e.id=null,e.rec=null,e.w=0)}for(let e of Z)if(!X.some(t=>t.id===e._id)){let t=X.find(e=>!e.id);t&&(t.id=e._id,t.rec=e,t.w=+!r,t.fresh=!0)}let a=E.shW;X.forEach((e,t)=>{if(a.setComponent(t,e.rec?e.w:0),!e.rec)return;let n=e.rec;n.shSlot=t+1;let r=ot[t];r.position.set(n.p[0],n.p[1],n.p[2]),ut.set(0,1,0),Math.abs(n.d[1])>.95&&ut.set(0,0,1),r.up.copy(ut),r.lookAt(dt.set(n.p[0]+n.d[0],n.p[1]+n.d[1],n.p[2]+n.d[2])),r.fov=Math.min(150,h.radToDeg(Math.acos(Math.max(-.99,n.cosO)))*2+4),r.near=.1,r.far=n.range,r.updateProjectionMatrix(),r.updateMatrixWorld(),ct[t].matrixWorld.copy(r.matrixWorld),ct[t].shadow.camera.far=n.range})}var mt=new i,ht=0;function gt(e,t){if(E.origin.w<=0||!X.some(e=>e.rec))return;let n=e.shadowMap.autoUpdate,r=t.overrideMaterial,i=e.getRenderTarget();e.getClearColor(mt);let a=e.getClearAlpha();e.shadowMap.autoUpdate=!1;let o=e.autoClear;e.autoClear=!1,e.setClearColor(16777215,1),ht++,T.scissorTest=!0;let s=typeof window<`u`?window.__ctx?.player?.object:null,c=window.__ctx?.camera,l=!!(s&&c&&s.position.distanceToSquared(c.position)<6.25);X.forEach((n,r)=>{if(!n.rec||!n.fresh&&ht+r&1)return;n.fresh=!1;let i=(r&1)*w,a=(r>>1)*w;T.viewport.set(i,a,w,w),T.scissor.set(i,a,w,w),e.setRenderTarget(T),e.clear(!0,!0,!1),E.shM[r].multiplyMatrices(ot[r].projectionMatrix,ot[r].matrixWorldInverse);let o=ot[r];if(o.layers.set(l?29:30),o.layers.enable(29),e.properties.get(st[r]).light=ct[r],t.overrideMaterial=st[r],e.render(t,o),$.length){t.overrideMaterial=null,o.layers.enableAll();for(let t of $){let n=t.mesh;if(!n.visible||n.count===0)continue;let i=n.material;n.material=t.material,e.properties.get(t.material).light=ct[r],e.render(n,o),n.material=i}}}),T.scissorTest=!1,T.viewport.set(0,0,w*2,w*2),t.overrideMaterial=r,e.autoClear=o,e.setClearColor(mt,a),e.shadowMap.autoUpdate=n,e.setRenderTarget(i)}N.renderShadows=gt;var $=[];N.addCaster=(e,t)=>{let n={mesh:e,material:t};return $.push(n),()=>{let e=$.indexOf(n);e>=0&&$.splice(e,1)}},N.shadows=!0,N.shadowSlots=X,N.shadowRT=T,N.build=at,N.shared=E;export{De as a,le as c,fe as d,v as f,E as i,se as l,N as n,oe as o,be as r,ae as s,K as t,de as u};
//# sourceMappingURL=world~index~shots~index-j5keBes7.js.map