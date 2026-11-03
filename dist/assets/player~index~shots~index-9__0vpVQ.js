import{A as e,Dt as t,Fr as n,Gt as r,Hn as i,Ir as a,L as o,Ma as s,Qi as c,U as l,Wi as u,ar as d,fa as f,io as p,j as m,jr as h,no as g,or as _,ro as v,ta as y,tr as b}from"./three~index~index~shots~index~GLTFLoader-BF58tRDi.js";import{s as x,t as S}from"./world~index~shots~index-j5keBes7.js";import{t as C}from"./world~index~index~shots~index-eJmDYCna.js";import{t as w}from"./render~index~shots~index-Cq-q3ipF.js";var T=`\r
  in vec3 nextPos; in float side; in float along; in float strandW; in float dist;\r
  uniform vec2 uRes; uniform float uWidth; uniform float uMinPx;\r
  out float vSide; out float vAlpha; out float vAlong; out float vDist; out float vPx;\r
  void main(){\r
    vec4 mv = modelViewMatrix * vec4(position,1.0);\r
    vec4 c0 = projectionMatrix * mv;\r
    vec4 c1 = projectionMatrix * modelViewMatrix * vec4(nextPos,1.0);\r
    vec2 s0 = c0.xy / c0.w * uRes * 0.5, s1 = c1.xy / c1.w * uRes * 0.5;\r
    vec2 d = s1 - s0; float L = length(d); d = L > 1e-4 ? d / L : vec2(1.0,0.0);\r
    vec2 n = vec2(-d.y, d.x);\r
    // world width -> pixels\r
    float px = uWidth * strandW * projectionMatrix[1][1] * uRes.y * 0.5 / max(0.05, -mv.z);\r
    float w = max(px, uMinPx);\r
    vAlpha = clamp(px / uMinPx, 0.35, 1.0);\r
    vec2 off = n * side * (w * 0.5 + 1.0);\r
    c0.xy += off / (uRes * 0.5) * c0.w;\r
    gl_Position = c0; vSide = side * (w * 0.5 + 1.0) / (w * 0.5); vAlong = along; vDist = dist; vPx = w;\r
  }\r
`,E=`\r
  uniform vec3 uColor; uniform float uOpacity; uniform float uVenom;\r
  in float vSide; in float vAlpha; in float vAlong; in float vDist; in float vPx;\r
  out vec4 fragColor;\r
  float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }\r
  float vn(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }\r
  void main(){\r
    if (uVenom > 0.5) {\r
      float t = vDist;\r
      // envelope radius (fraction of the ribbon half-width): slow bulges + knots; thin strands (few px) stay solid\r
      float bulge = vn(t * 1.7 + 3.1), knot = smoothstep(0.72, 1.0, vn(t * 3.9 + 1.7));\r
      float R = 0.5 + 0.36 * bulge + 0.2 * knot + 0.06 * vn(t * 11.0);\r
      float detail = smoothstep(3.0, 9.0, vPx);\r
      R = mix(0.95, R, detail);\r
      // three twisted sub-cords (braided / ropy symbiote mass), faded to one solid cord when the twist is sub-pixel\r
      float pitchPx = vPx * 0.9 / max(fwidth(t) * 3.4 * vPx, 1e-4); // ~ one twist period in pixels\r
      float braid = detail * smoothstep(6.0, 14.0, pitchPx);\r
      float y = vSide / R;            // -1..1 across the envelope\r
      float aa = 1.6 / max(vPx * R * 0.5, 1.0);\r
      // each covering cord contributes its shading, weighted toward the one nearest the viewer (soft, no seams)\r
      float cov = 0.0, wsum = 0.0, depB = 0.0; vec3 col = vec3(0.0);\r
      float mott = vn(t * 4.3 + 11.0);\r
      for (int k = 0; k < 3; k++) {\r
        float fk = float(k);\r
        float ph = t * 13.0 + 9.0 * vn(t * 0.9 + 2.0) + fk * 2.0944 + 2.2 * vn(t * 2.6 + fk * 5.0); // uneven, organic twist\r
        float c = (0.36 + 0.14 * vn(t * 5.0 + fk)) * sin(ph) * braid, dep = cos(ph);   // lateral centre, depth (toward viewer +)\r
        float rs = mix(1.0, 0.5 + 0.22 * vn(t * 6.0 + fk * 3.3), braid);\r
        float xl = (y - c) / rs;\r
        float ck = 1.0 - smoothstep(1.0 - aa / rs, 1.0 + aa / rs, abs(xl));\r
        if (ck < 0.001) continue;\r
        cov = max(cov, ck);\r
        float nz = sqrt(max(0.0, 1.0 - xl * xl)), fib = vn(t * 38.0 + xl * 1.5 + fk * 7.0);\r
        float occl = mix(1.0, 0.5 + 0.5 * (dep * 0.5 + 0.5), braid);                // cords behind read darker\r
        vec3 cc = uColor * (0.5 + 0.5 * nz) * (0.8 + 0.3 * fib) * (0.85 + 0.3 * mott) * occl;\r
        // wet specular streak (light from above-left in screen space) + faint cool rim\r
        float spec = pow(max(0.0, 1.0 - abs(xl + 0.4) * 1.7), 3.0) * (0.45 + 0.55 * fib) * (0.55 + 0.45 * mott) * (0.6 + 0.4 * occl);\r
        cc += vec3(0.26, 0.28, 0.32) * spec + vec3(0.035, 0.04, 0.05) * pow(1.0 - nz, 3.0);\r
        float w = ck * exp(dep * 7.0 * braid) * nz + 1e-4;\r
        col += cc * w; wsum += w;\r
      }\r
      if (cov * uOpacity < 0.004) discard;\r
      col /= max(wsum, 1e-4);\r
      fragColor = vec4(col, cov * uOpacity * max(vAlpha, 0.8));\r
      fragColor = linearToOutputTexel(fragColor);\r
      return;\r
    }\r
    float edge = 1.0 - smoothstep(0.55, 1.0 + 0.35, abs(vSide));\r
    float core = 1.0 - smoothstep(0.0, 0.9, abs(vSide));\r
    vec3 col = mix(uColor * 0.82, uColor * 1.15, core);   // slight cylindrical shading / glow core\r
    float a = edge * vAlpha * uOpacity * (0.75 + 0.25 * core);\r
    if (a < 0.004) discard;\r
    fragColor = vec4(col, a);\r
    fragColor = linearToOutputTexel(fragColor);\r
  }\r
`,D={off:new v,w:0},O=64,k=4,A=6,j=T,M=E,N=new Set,P=new Set,F=!1,I={white:{color:15659766,width:.022,minPx:2},venom:{color:723983,width:.06,minPx:2.6}};function L(e){let t=F?I.venom:I.white,n=e.mat.uniforms;n.uColor.value.set(t.color),n.uWidth.value=t.width*e.widthK,n.uMinPx.value=t.minPx,n.uVenom.value=+!!F}function R(e){F=!!e;for(let e of N)L(e);for(let e of P)e(F)}var z=class{constructor(n,{widthK:i=1}={}){this.counts=n,this.widthK=i;let a=n.reduce((e,t)=>e+t+1,0),o=new Float32Array(a*2*3),s=new Float32Array(a*2*3),c=new Float32Array(a*2),u=new Float32Array(a*2),p=new Float32Array(a*2),h=new Float32Array(a*2),_=[],b=0;this.offsets=[];for(let e of n){this.offsets.push(b);for(let t=0;t<=e;t++)c[(b+t)*2]=-1,c[(b+t)*2+1]=1,u[(b+t)*2]=u[(b+t)*2+1]=t/e,p[(b+t)*2]=p[(b+t)*2+1]=1;for(let t=0;t<e;t++){let e=(b+t)*2;_.push(e,e+1,e+2,e+1,e+3,e+2)}b+=e+1}let x=new m;x.setAttribute(`position`,new e(o,3).setUsage(t)),x.setAttribute(`nextPos`,new e(s,3).setUsage(t)),x.setAttribute(`side`,new e(c,1)),x.setAttribute(`along`,new e(u,1)),x.setAttribute(`strandW`,new e(p,1).setUsage(t)),x.setAttribute(`dist`,new e(h,1).setUsage(t)),x.setIndex(_),x.boundingSphere=new f(new v,1e5),this.geo=x,this.mat=new y({glslVersion:r,vertexShader:j,fragmentShader:M,transparent:!0,depthWrite:!0,side:2,uniforms:{uRes:{value:new g(1920,1080)},uWidth:{value:.022},uMinPx:{value:2},uColor:{value:new l(15659766)},uOpacity:{value:.92},uVenom:{value:0}}}),N.add(this),L(this),this.mesh=new d(x,this.mat),this.mesh.frustumCulled=!1,this.mesh.renderOrder=5,this.mesh.name=`WebStrands`}setStrand(e,t,n=1){let r=this.counts[e],i=this.offsets[e],a=this.geo.attributes.position.array,o=this.geo.attributes.nextPos.array,s=this.geo.attributes.strandW.array,c=this.geo.attributes.dist.array,l=0,u=Math.min(r,t.length-1);for(let n=r;n>=0;n--)n<u&&(l+=t[Math.min(n,t.length-1)].distanceTo(t[Math.min(n+1,t.length-1)])),c[(i+n)*2]=c[(i+n)*2+1]=l+e*1.37;for(let e=0;e<=r;e++){let c=t[Math.min(e,t.length-1)],l=e<r?t[Math.min(e+1,t.length-1)]:null,u,d,f;if(l&&l.distanceToSquared(c)>1e-10)u=l.x,d=l.y,f=l.z;else{let n=t[Math.max(0,Math.min(e,t.length-1)-1)];u=2*c.x-n.x,d=2*c.y-n.y,f=2*c.z-n.z}for(let t=0;t<2;t++){let r=((i+e)*2+t)*3;a[r]=c.x,a[r+1]=c.y,a[r+2]=c.z,o[r]=u,o[r+1]=d,o[r+2]=f,s[(i+e)*2+t]=n}}}hideStrand(e){let t=new v(0,-1e4,0);this.setStrand(e,[t,t])}commit(){for(let e of[`position`,`nextPos`,`strandW`,`dist`])this.geo.attributes[e].needsUpdate=!0}};function ee(){let e=document.createElement(`canvas`);e.width=e.height=256;let t=e.getContext(`2d`);t.translate(128,128),t.strokeStyle=`rgba(255,255,255,0.95)`,t.lineCap=`round`;let n=B(7),r=[...Array(11)].map((e,t)=>t/11*Math.PI*2+(n()-.5)*.4),i=r.map(()=>70+n()*55);t.lineWidth=3.2,r.forEach((e,n)=>{t.beginPath(),t.moveTo(0,0),t.lineTo(Math.cos(e)*i[n],Math.sin(e)*i[n]),t.stroke()}),t.lineWidth=1.8;for(let e of[16,30,46,64])t.beginPath(),r.forEach((a,o)=>{let s=Math.min(e*(.9+n()*.2),i[o]),c=Math.cos(a)*s,l=Math.sin(a)*s;if(o===0)t.moveTo(c,l);else{let e=r[o-1]+(a-r[o-1])/2;t.quadraticCurveTo(Math.cos(e)*s*.8,Math.sin(e)*s*.8,c,l)}}),t.stroke();let a=t.createRadialGradient(0,0,0,0,0,22);a.addColorStop(0,`rgba(255,255,255,1)`),a.addColorStop(1,`rgba(255,255,255,0)`),t.fillStyle=a,t.beginPath(),t.arc(0,0,22,0,Math.PI*2),t.fill();let s=new o(e);return s.colorSpace=c,s.anisotropy=4,s}function B(e){return()=>{e|=0,e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function V(t){let r=[O,...Array(k).fill(A),O,...Array(k).fill(A)];for(let e=0;e<3;e++)r.push(O,...Array(k).fill(A));let i=new z(r);t.add(i.mesh);let o=ee(),s=new _({map:o,transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-4,color:16054008}),c=[...Array(8)].map(()=>{let e=new d(new h(1,1),s.clone());return e.visible=!1,e.renderOrder=4,t.add(e),{m:e,t:0,life:0}}),l=0,u=e=>{for(let t of c)t.m.material.color.set(e?1184534:16054008);S.material.color.set(e?1579292:16777215)},p=new m,g=new Float32Array(144),y=[...Array(48)].map(()=>new v),x=new Float32Array(48);p.setAttribute(`position`,new e(g,3)),p.boundingSphere=new f(new v,1e5);let S=new n(p,new a({color:16777215,size:.07,transparent:!0,opacity:.8,depthWrite:!1}));S.frustumCulled=!1,t.add(S);let C=0;P.add(u),u(F);let w=()=>({on:!1,t:0,hand:new v,anchor:new v,normal:new v(0,0,1),shootDur:.12,tension:0,seed:0,slack:0,slackIn:0,snapT:9,taut:0,pts:[...Array(65)].map(()=>new v)}),T=w(),E=w(),j=[...[,,,]].map(()=>({on:!1,t:0,pts:[],vel:[],anchor:new v,normal:new v,seed:0})),M=0,N=0,I=[...Array(7)].map(()=>new v),L=new v,R=new v,B=new v,V=new v,H=new v,U=new v;function W(e,t,n,r,a,o,s=1){L.set(0,1,0),Math.abs(r.y)>.9&&L.set(1,0,0);let c=R.crossVectors(r,L).normalize(),l=B.crossVectors(r,c).normalize();for(let u=0;u<k;u++){let d=a*6.28+Math.PI*2/k*u+Math.sin(a*13+u)*.5,f=o*(.55+.45*Math.abs(Math.sin(a*7+u*2.3))),p=V.copy(n).addScaledVector(c,Math.cos(d)*f).addScaledVector(l,Math.sin(d)*f).addScaledVector(r,.02);for(let e=0;e<=A;e++){let n=e/A;I[e].copy(t).lerp(p,n),I[e].addScaledVector(r,Math.sin(n*Math.PI)*.05*o)}i.setStrand(e+u,I,.55*s)}}function G(e,t,n=!1){let r=n?null:c[l++%c.length];r&&(r.m.visible=!0,r.t=0,r.life=2.2,r.m.position.copy(e).addScaledVector(t,.03),r.m.lookAt(L.copy(e).add(t)),r.m.rotateZ(Math.random()*6.28),r.m.scale.setScalar(.01));for(let n=0;n<16;n++){let n=C++%48;g[n*3]=e.x,g[n*3+1]=e.y,g[n*3+2]=e.z,x[n]=.45,y[n].set(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(5).addScaledVector(t,3)}}function K(e,t,n,r,i,a,o=!1,s=!1){e.noSplat=o,e.noDecal=s,e.on=!0,e.t=+!!i,e.hand.copy(t),e.anchor.copy(n),e.normal.copy(r||L.set(0,0,1)).normalize(),e.seed=Math.random(),e.impacted=i,e.slack=e.slackIn=0,e.snapT=9,e.taut=0,e.shootDur=a??b.clamp(t.distanceTo(n)/380,.05,.16);for(let n of e.pts)n.copy(t);i&&!o&&G(n,e.normal,s)}function q(e){if(!e.on)return;e.on=!1;let t=j[M++%3];t.on=!0,t.t=0,t.anchor.copy(e.anchor),t.normal.copy(e.normal),t.seed=e.seed,t.noSplat=!!e.noSplat,t.pts=e.pts.map(e=>e.clone()),t.vel=t.pts.map(()=>new v(0,0,0))}function J(e,t,n,r){if(!e.on){i.hideStrand(t);for(let e=0;e<k;e++)i.hideStrand(t+1+e);return}e.t+=r,e.hand.copy(n),t===0&&D.w>.001&&(n=U.copy(n).addScaledVector(D.off,Math.min(1,D.w)));let a=Math.min(1,e.t/e.shootDur),o=1-(1-a)**3;a>=1&&!e.impacted&&(e.impacted=!0,e.noSplat||G(e.anchor,e.normal,e.noDecal));let s=Math.max(0,e.t-e.shootDur);e.slack+=(e.slackIn-e.slack)*(1-Math.exp(-(e.slackIn>e.slack?7:22)*r)),e.snapT+=r;let c=e.snapT<.6?Math.exp(-e.snapT*7)*.45:0,l=((1-o)*.35+Math.exp(-s*9)*.25+.012+e.slack*.18+c)*(1-.9*e.taut),u=n.distanceTo(e.anchor),d=R.copy(e.anchor).sub(n).normalize(),f=B.set(0,1,0).cross(d);f.lengthSq()<1e-4&&f.set(1,0,0),f.normalize();let p=V.crossVectors(d,f).normalize(),m=H.set(0,-1,0).addScaledVector(d,d.y);m.lengthSq()<.04&&m.copy(p),m.normalize();let h=e.slack*Math.min(u*.16,3.2)*+!!e.impacted,g=e.pts;for(let t=0;t<=O;t++){let r=t/O*o,i=g[t].copy(n).addScaledVector(d,u*r),a=Math.sin(Math.min(1,r/Math.max(o,.001))*Math.PI),s=r*u*.9-e.t*22+e.seed*40,_=r*u*.55-e.snapT*38;i.addScaledVector(f,Math.sin(s)*l*a+Math.sin(_)*c*a).addScaledVector(p,Math.cos(s*.7+1.3)*l*.6*a),h>0&&i.addScaledVector(m,h*a*(1+.08*Math.sin(e.t*3.1+r*5)))}if(i.setStrand(t,g,1-.3*e.taut),e.impacted&&!e.noSplat){let n=Math.min(1,s/.08);W(t+1,g[Math.floor(O*.975)],e.anchor,e.normal,e.seed,.9*n+.05)}else for(let e=0;e<k;e++)i.hideStrand(t+1+e)}return{get active(){return T.on},get active2(){return E.on},anchor2:E.anchor,attach(e,t,n,{instant:r=!1,shootDur:i=null,noSplat:a=!1,noDecal:o=!1}={}){(T.on||E.on)&&this.release(),K(T,e,t,n,r,i,a,o)},attachSecond(e,t,n,{instant:r=!1,shootDur:i=null,noDecal:a=!1}={}){E.on&&q(E),K(E,e,t,n,r,i,!1,a)},setTaut(e=0){T.taut=E.taut=b.clamp(e,0,1)},release(){q(T),q(E)},retarget(e,t){T.on&&(T.anchor.copy(e),t&&T.normal.copy(t).normalize())},setSlack(e=0,t=0){T.slack>.35&&e<.1&&t>.3&&(T.snapT=0),T.slackIn=b.clamp(e,0,1)},isImpacted(){return T.on&&T.impacted},splat(e,t){G(e,t)},setSeed(e){T.seed=e},releaseSnap(e=.35){let t=M;this.release();for(let n=t;n<M;n++){let t=j[n%3];t.life=e,t.pts.forEach((e,n)=>{let r=1-n/O;t.vel[n].copy(t.anchor).sub(e).multiplyScalar(2.2*r)})}},update(e,t,n,r,a=null){N+=e;let o=r.getDrawingBufferSize(L);i.mat.uniforms.uRes.value.set(o.x,o.y),J(T,0,t,e),J(E,5,a||t,e),j.forEach((t,n)=>{let r=10+n*5;if(!t.on){i.hideStrand(r);for(let e=0;e<k;e++)i.hideStrand(r+1+e);return}t.t+=e;let a=Math.max(0,1-t.t/(t.life||.7));if(a<=0)t.on=!1;else{for(let n=0;n<=O;n++){let r=1-n/O;t.vel[n].y-=18*e*r,t.pts[n].addScaledVector(t.vel[n],e)}if(i.setStrand(r,t.pts,a),t.noSplat)for(let e=0;e<k;e++)i.hideStrand(r+1+e);else W(r+1,t.pts[Math.floor(O*.975)],t.anchor,t.normal,t.seed,.95,a)}}),i.mat.uniforms.uOpacity.value=.92,i.commit();for(let t of c){if(!t.m.visible)continue;t.t+=e;let n=Math.min(1,t.t/.09);t.m.scale.setScalar(.2+1.1*(1-(1-n)**3)),t.m.material.opacity=Math.min(1,(t.life-t.t)/.6),t.t>t.life&&(t.m.visible=!1)}for(let t=0;t<48;t++)x[t]<=0?g[t*3+1]=-1e4:(x[t]-=e,y[t].y-=6*e,y[t].multiplyScalar(1-3*e),g[t*3]+=y[t].x*e,g[t*3+1]+=y[t].y*e,g[t*3+2]+=y[t].z*e);p.attributes.position.needsUpdate=!0},get shootK(){return T.on?Math.min(1,T.t/T.shootDur):0},anchor:T.anchor}}var H=`#include <common>
out vec3 vFabP;`,U=`#include <begin_vertex>
vFabP = position;`,W=`#include <common>\r
uniform float uFabOn, uFabNightK; uniform sampler2D uFabHex, uFabKnit; uniform vec4 uFabP; uniform vec3 uCityAmbLo, uCityAmbHi;\r
in vec3 vFabP;\r
float fabHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\r
float fabNoise(vec3 x) { // value noise, -1..1\r
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);\r
  return 2.0 * mix(mix(mix(fabHash(i), fabHash(i + vec3(1, 0, 0)), f.x), mix(fabHash(i + vec3(0, 1, 0)), fabHash(i + vec3(1, 1, 0)), f.x), f.y),\r
                   mix(mix(fabHash(i + vec3(0, 0, 1)), fabHash(i + vec3(1, 0, 1)), f.x), mix(fabHash(i + vec3(0, 1, 1)), fabHash(i + vec3(1, 1, 1)), f.x), f.y), f.z) - 1.0;\r
}`,G=`#include <map_fragment>\r
vec4 fabW = vec4(0.0); vec3 fabHx = vec3(0.5, 0.5, 0.5), fabKn = vec3(0.5, 0.5, 0.5); float fabFade = 0.0, fabN1 = 0.0;\r
#ifdef USE_MAP\r
if (uFabOn > 0.5) {\r
  vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));\r
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); float sat = (mx - mn) / max(mx, 1e-4);\r
  float wR = smoothstep(0.03, 0.12, c.r - max(c.g, c.b));\r
  float wB = smoothstep(0.015, 0.05, c.b - max(c.r, c.g)) * (1.0 - wR);\r
  float wW = smoothstep(0.22, 0.42, lum) * (1.0 - smoothstep(0.18, 0.4, sat)) * (1.0 - wR) * (1.0 - wB);\r
  float wK = (1.0 - wR) * (1.0 - wB) * (1.0 - wW);                                   // web lines, piping, emblem outline\r
  fabW = vec4(wR, wB, wW, wK);\r
  // hex tile registered onto the honeycomb already baked into suit_normal (character_tex.py: 3 cosines, 5 px period on\r
  // the 4096 map -> cells 5.77 px apart, neighbours along v): same pitch, orientation and phase, so the two reinforce\r
  // instead of beating into moire. Tile = 4 x 4*sqrt3 cells = 23.094 x 40 texels (texture x runs along Blender v).\r
  vec2 fabPx = vec2(vMapUv.x, 1.0 - vMapUv.y) * uFabP.x - 0.5;\r
  vec2 uvH = vec2(fabPx.y / 23.094, fabPx.x / 40.0), uvK = vMapUv * uFabP.y;\r
  fabHx = texture(uFabHex, uvH).rgb; fabKn = texture(uFabKnit, uvK).rgb;\r
  // detail fades out once a hex cell (1/4 tile) covers < ~2 px (mips already average it; this stops the residual shimmer)\r
  float cellPx = 5.7735 / max(length(fwidth(fabPx)), 1e-6);   // hex cell = 5.77 baked texels\r
  fabFade = smoothstep(1.6, 4.0, cellPx);\r
  // tonal variation in bind-pose space (sticks to the body): slow patches + a finer mottling\r
  fabN1 = fabNoise(vFabP * 5.0 + 1.7); float n2 = fabNoise(vFabP * 16.0 - 4.2);\r
  vec3 red = c * vec3(0.78, 0.84, 0.98) * (1.0 + 0.16 * fabN1 + 0.06 * n2);             // deeper crimson, gentle shifts\r
  red.b += 0.0035 * (0.5 + 0.5 * fabN1) * lum / 0.07;                                    // a hint of magenta in the lighter patches\r
  float cob = 0.5 + 0.5 * fabN1;                                                        // navy <-> cobalt\r
  vec3 blue = c * mix(vec3(0.78, 0.76, 0.8), vec3(1.05, 1.3, 1.2), cob) * (1.0 + 0.06 * n2);\r
  vec3 o = c * (1.0 + 0.04 * n2) * mix(1.0, 0.86, wW);                                  // emblem: off-white, never blown out\r
  o = mix(o, red, wR); o = mix(o, blue, wB);\r
  // woven cavities: grooves darker, crests a touch lighter (mips average to a constant tone at distance)\r
  float cav = dot(vec2(wR + 0.5 * wW, wB), vec2(fabHx.b - 0.62, fabKn.b - 0.55));\r
  o *= 1.0 + uFabP.w * cav;\r
  #ifdef USE_AOMAP\r
  float fabAO = texture(aoMap, vAoMapUv).r; o *= mix(1.0, fabAO * fabAO, 0.5);   // light crease AO on the albedo too\r
  #endif\r
  diffuseColor.rgb = o;\r
}\r
#endif`,K=`#include <roughnessmap_fragment>\r
if (uFabOn > 0.5) {\r
  float fabMetal = 0.0;\r
  #ifdef USE_METALNESSMAP\r
  fabMetal = texture(metalnessMap, vMetalnessMapUv).b;\r
  #endif\r
  // red rubberised fabric / navy knit: matte-satin, grooves rougher; emblem + web lines slightly glossier rubber\r
  vec4 rr = vec4(0.58 + 0.12 * (1.0 - fabHx.b) + 0.03 * fabN1,\r
                 0.64 + 0.10 * (1.0 - fabKn.b) + 0.03 * fabN1,\r
                 0.42 + 0.06 * (1.0 - fabHx.b),\r
                 0.40);\r
  float ws = dot(fabW, vec4(1.0)) * (1.0 - smoothstep(0.2, 0.5, fabMetal));   // leave the metal web-shooter parts alone\r
  roughnessFactor = mix(roughnessFactor, dot(rr, fabW) / max(dot(fabW, vec4(1.0)), 1e-3), clamp(ws, 0.0, 1.0));\r
}`,q=`#include <lights_fragment_maps>\r
#ifdef USE_CITYL\r
iblIrradiance *= mix(1.0, 0.35, uFabNightK); radiance *= mix(1.0, 0.6, uFabNightK);\r
#endif\r
{ vec3 fabWN = transformDirectionByInverseViewMatrix(normal, viewMatrix);\r
  irradiance += mix(uCityAmbLo, uCityAmbHi, 0.5 + 0.5 * fabWN.y) * (0.75 + 0.25 * (1.0 - abs(fabWN.y))); }`,J=`#include <normal_fragment_maps>\r
#ifdef USE_NORMALMAP_TANGENTSPACE\r
if (uFabOn > 0.5) {\r
  // tbn = (dP/du, dP/dv) of the glTF UVs. Hex texture x runs along -v, y along +u -> rotate into (u, v).\r
  vec2 hx = fabHx.xy * 2.0 - 1.0;\r
  vec2 dn = vec2(hx.y, -hx.x) * (fabW.x + 0.45 * fabW.z) + (fabKn.xy * 2.0 - 1.0) * fabW.y;\r
  dn *= uFabP.z * fabFade;\r
  normal = normalize(tbn * vec3(mapN.xy + dn, mapN.z));\r
}\r
#endif`,Y={uFabOn:{value:0},uFabHex:{value:null},uFabKnit:{value:null},uFabP:{value:new p(4096,147,.85,.18)},uFabNightK:x,uCityAmbLo:S.lo,uCityAmbHi:S.hi},X=!0,Z=0,Q,te=typeof location<`u`&&new URLSearchParams(location.search).get(`fabric`)===`0`;new Promise(e=>{Q=e});var $=()=>{Y.uFabOn.value=X&&!te&&Z===2?1:0,Z===2&&Q()};function ne(e){X=!!e,$()}function re(e,t){new s().load(e,e=>{e.colorSpace=``,e.wrapS=e.wrapT=u,e.anisotropy=8,e.generateMipmaps=!0,e.minFilter=i,Y[t].value=e,Z++,$()},void 0,t=>console.warn(`[suitfabric] detail texture failed`,e,t))}function ie(e){let t=null;return e.traverse(e=>{if(e.isMesh)for(let n of[].concat(e.material))n?.name===`SpiderSuit`&&(t=n)}),!t||t.userData.__patches?.has(`suitFabric`)||(!Y.uFabHex.value&&Z===0&&(re(C(`tex/suit_weave_hex.png`),`uFabHex`),re(C(`tex/suit_weave_knit.png`),`uFabKnit`)),w(t,`suitFabric`,e=>{Object.assign(e.uniforms,Y),e.vertexShader=e.vertexShader.replace(`#include <common>`,H).replace(`#include <begin_vertex>`,U),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,W).replace(`#include <map_fragment>`,G).replace(`#include <roughnessmap_fragment>`,K).replace(`#include <lights_fragment_maps>`,q).replace(`#include <normal_fragment_maps>`,J)}),$()),t}export{D as a,V as i,ne as n,R as o,z as r,ie as t};
//# sourceMappingURL=player~index~shots~index-9__0vpVQ.js.map