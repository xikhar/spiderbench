import{$n as e,A as t,Ha as n,Hn as r,Ht as i,L as a,Lt as o,Qi as s,Rn as c,U as l,Va as u,Wi as d,Wn as f,ar as p,dt as m,fa as h,ft as g,ir as _,j as v,ja as y,mr as b,or as x,ro as S}from"./three~index~combat~screenshotPresets~gameSystems~GLTFLoader-BF58tRDi.js";import{n as C,o as w,s as T}from"./world~index~screenshotPresets~gameSystems-Dd9PBWOO.js";import{i as E,o as D}from"./vehicleLighting-CSwID43I.js";import{A as ee,D as O,P as k,k as A,p as te,s as ne,v as j}from"./world~index~gameSystems-DDWeQzOb.js";import{B as re,Ct as M,Et as ie,H as ae,L as oe,Tt as se,bt as N,ct as ce,et as P,m as le,st as ue,ut as F,v as I,z as de}from"./world~index~gameSystems-CmUdPMNT.js";import{l as fe}from"./world~index~gameSystems-CtJhtwP5.js";import{a as pe,n as me,r as he}from"./world~index~combat~screenshotPresets~gameSystems-iDC50CWi.js";import{a as ge,i as L,m as R,n as _e,o as ve,p as z,r as ye,s as be,u as xe,y as Se}from"./world~index-D5yddocA.js";import{t as Ce}from"./world~index-CIQQHw8C.js";var we=`// horizon shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
      in vec3 aWall; in vec3 aRoof; out vec3 vHC; out vec3 vHP; out float vTop; out float vLit;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
      vTop = normal.y > 0.5 ? 1.0 : 0.0; vHC = vTop > 0.5 ? aRoof : aWall;\r
      vHP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\r
      { vec3 io = instanceMatrix[3].xyz; float lh = fract(sin(dot(io.xz, vec2(12.9898, 78.233))) * 43758.5453); // (night) per-building lit share\r
        vLit = lh < 0.35 ? 0.0 : (lh < 0.93 ? (lh - 0.35) * 0.35 : 0.6 + (lh - 0.93) * 4.0); }\r
// @section fragmentCommon\r
#include <common>\r
      in vec3 vHC; in vec3 vHP; in float vTop; in float vLit; uniform float uNightK;\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
      if (uNightK > 0.0 && vTop < 0.5) totalEmissiveRadiance += vec3(1.0, 0.7, 0.42) * vLit * 0.06 * smoothstep(3.0, 9.0, vHP.y) * uNightK;\r
// @section fragmentMap\r
{\r
        vec3 c = vHC;\r
        if (vTop < 0.5) {\r
          // floor bands + bays, averaged out once they get sub-pixel\r
          float fl = fract(vHP.y / 3.4), u = fract((vHP.x + vHP.z) / 2.6);\r
          float w = step(0.35, fl) * step(fl, 0.85) * step(0.3, u) * step(u, 0.75);\r
          vec2 fw = fwidth(vec2(vHP.y / 3.4, (vHP.x + vHP.z) / 2.6));\r
          w = mix(w, 0.3, clamp(max(fw.x, fw.y) * 1.5, 0.0, 1.0));\r
          c = mix(c, vec3(0.08, 0.09, 0.1), w * 0.85);\r
          c *= 0.65 + 0.35 * smoothstep(0.0, 12.0, vHP.y); // grimy base / contact darkening\r
        }\r
        diffuseColor.rgb = c * (1.0 - 0.85 * uNightK); // (night) dark masses\r
      }\r
`,Te=`// boats shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section fragmentCommon\r
#include <common>
uniform float uNightK;\r
// @section fragmentColor\r
#include <color_fragment>
diffuseColor.rgb *= mix(1.0, 0.025, uNightK);\r
`,B=(e,t)=>e.gH+Math.max(1,Math.round((t-e.gH)/e.floorH))*e.floorH,Ee=(e,t,n=t,r=t,i=t)=>({x0:e.x0+t,x1:e.x1-n,z0:e.z0+r,z1:e.z1-i}),V={nx:`setback`,px:`setback`,nz:`setback`,pz:`setback`},De=(e,t,n,r=n)=>({x0:e-n,x1:e+n,z0:t-r,z1:t+r}),H=(e=[2.4,2.45,2.5],t=5)=>({floorH:3,bayW:1.2,winW:.5,winH:.5,layer:O.METAL,base:O.METAL,seed:t,margin:0,depth:.05,tint:e});function U(e,t,n,r,i,a={}){return t<=.4?[{...e,y0:n,y1:r,p:i,parapet:0,sides:{...V},...a}]:[{x0:e.x0+t,x1:e.x1-t,z0:e.z0,z1:e.z1,y0:n,y1:r,p:i,parapet:0,sides:{...V},...a},{x0:e.x0,x1:e.x0+t,z0:e.z0+t,z1:e.z1-t,y0:n,y1:r,p:i,parapet:0,sides:{...V,px:`party`},...a},{x0:e.x1-t,x1:e.x1,z0:e.z0+t,z1:e.z1-t,y0:n,y1:r,p:i,parapet:0,sides:{...V,nx:`party`},...a}]}function Oe(e,t,n,r,i,a,o){if(r>=2*n-.3)return[{...De(e,t,n),y0:i,y1:a,p:o,parapet:0,sides:{...V}}];let s=Math.max(1,Math.min(4,Math.round((2*n-r)/4))),c=[],l=[];for(let e=0;e<=s;e++){let t=n-e*(2*n-r)/s;c.push(t),l.push(r-t)}let u=[{x0:e-c[s],x1:e+c[s],z0:t-l[s],z1:t+l[s],y0:i,y1:a,p:o,parapet:0,sides:{...V}}];for(let n=0;n<s;n++)u.push({x0:e+c[n+1],x1:e+c[n],z0:t-l[n],z1:t+l[n],y0:i,y1:a,p:o,parapet:0,sides:{...V,nx:`party`}}),u.push({x0:e-c[n],x1:e-c[n+1],z0:t-l[n],z1:t+l[n],y0:i,y1:a,p:o,parapet:0,sides:{...V,px:`party`}});return u}function ke(e,t,n,r,i,a){let o=e=>t.gH+e*t.floorH,s=[1,.7,.36],c=Ee(e,24.5,24.5,20,20),l=Ee(e,27.5,27.5,23,23);ee(c,o(72),o(80),s,2.4,1.1),ee(l,o(80),o(85)+1,s,2.4,1.1),ee(De(n,r,12,9),i,i+14.6,s,2,1.1),ee(De(n,r,12,9),i+1.5,i+14.6,s,.9,6,1.2,1.75),ee(Ee(e,21,21,17,17),o(72)-14,o(72)+.2,s,.3,-3.5),ee(De(n,r,8.2),a,a+38,[1,.8,.52],.4,7,1.2,1.4),Ae(c,o(72)+.4,16761466,4),Ae(l,o(80)+.4,16761466,4)}function Ae(e,t,n,r){let i=(e.x0+e.x1)/2,a=(e.z0+e.z1)/2;for(let[o,s,c,l]of[[i,e.z0-2.8,0,1],[i,e.z1+2.8,0,-1],[e.x0-2.8,a,1,0],[e.x1+2.8,a,-1,0]])C.add({type:`spot`,pos:[o,t,s],dir:[c*.12,1,l*.12],angle:.7,penumbra:.7,color:n,intensity:r,range:34,radius:1.2,volume:0})}function W(){let e=[];return e.push({name:`empire`,x0:146,x1:234,z0:240,z1:320,seed:3401,arch:()=>({type:`deco`,style:A.DECO,layer:O.LIME,base:O.GRANITE,floorH:3.9,bayW:1.75,winW:.72,winH:.8,gH:7,height:340,depth:.34,margin:1,tint:[.86,.85,.82],cornice:!1,waterTower:!1,lintel:0,seed:34.1,shape:(e,t,n)=>{let r=e=>t.gH+e*t.floorH,i={...n,tint:[.78,.775,.76]},a=[{...e,y0:0,y1:r(5),p:n,parapet:1.3,roof:!0},{...Ee(e,9,9,7,7),y0:r(5),y1:r(20),p:i,parapet:1.2,roof:!0,sides:{...V}},{...Ee(e,15,15,12,12),y0:r(20),y1:r(29),p:n,parapet:1.2,roof:!0,sides:{...V}},...U(Ee(e,21,21,17,17),5.5,r(29),r(72),n,{roof:!0}).map((e,t)=>t?{...e,p:i}:e),...U(Ee(e,24.5,24.5,20,20),4,r(72),r(80),n,{roof:!0}),...U(Ee(e,27.5,27.5,23,23),3,r(80),r(85),n)],o=Ee(e,21,21,17,17),s=(e.x0+e.x1)/2,c=(e.z0+e.z1)/2,l=7.5,u=1.4;return a.push({x0:s-l,x1:s+l,z0:o.z0-u,z1:o.z0,y0:r(29),y1:r(72)-2*t.floorH,p:n,parapet:0,roof:!1,sides:{...V,pz:`party`}}),a.push({x0:s-l,x1:s+l,z0:o.z1,z1:o.z1+u,y0:r(29),y1:r(72)-2*t.floorH,p:n,parapet:0,roof:!1,sides:{...V,nz:`party`}}),a.push({x0:o.x0-u,x1:o.x0,z0:c-l,z1:c+l,y0:r(29),y1:r(72)-2*t.floorH,p:n,parapet:0,roof:!1,sides:{...V,px:`party`}}),a.push({x0:o.x1,x1:o.x1+u,z0:c-l,z1:c+l,y0:r(29),y1:r(72)-2*t.floorH,p:n,parapet:0,roof:!1,sides:{...V,nx:`party`}}),a}}),extra(e,t,{S:n,Z:r,tile:i}){let a=t.masses.reduce((e,t)=>t.y1>e.y1?t:e,t.masses[0]),o=(e.x0+e.x1)/2,s=(e.z0+e.z1)/2,c=a.y1;for(let e of t.masses){if(e.y0<.1)continue;let a=e.sides||{},o=e.p,s=e.y1+(e.parapet||0)-.12,c={...o,style:A.BLANK,tint:o.tint.map(e=>e*1.06)};for(let l of[`nz`,`pz`,`nx`,`px`]){if(a[l]===`party`)continue;let u=l===`nz`||l===`pz`,d=u?e.x1-e.x0:e.z1-e.z0,f=u?e.x0:e.z0,p=d-2*o.margin,m=Math.max(1,Math.floor(p/o.bayW+.5)),h=p/m;for(let a=0;a<=m;a++){let u=a%4==0,d=f+o.margin+a*h,p=a===0||a===m||u?.4:.24,g=u?.55:.3,_;_=l===`nz`?[d-p,e.z0-g,d+p,e.z0]:l===`pz`?[d-p,e.z1,d+p,e.z1+g]:l===`nx`?[e.x0-g,d-p,e.x0,d+p]:[e.x1,d-p,e.x1+g,d+p];let v=(_[0]+_[2])/2,y=(_[1]+_[3])/2;t.masses.some(t=>t!==e&&t.y1>e.y0+1&&t.y0<s-1&&v>t.x0-.05&&v<t.x1+.05&&y>t.z0-.05&&y<t.z1+.05)||z(i,n,r,_[0],e.y0+.2,_[1],_[2],s,_[3],c,{zip:!1,lod:!1})}}}{let e={nz:null,pz:null,nx:null,px:null},r=t.A;for(let a of t.masses){if(a.y0<.1||a.x1-a.x0<2.5||a.z1-a.z0<2.5)continue;let t=a.sides||{},o=a.parapet||0,s=a.y1+o,c=.7,l=.5,u=o<.1,d=e=>t[e]===`party`?0:c,f={...a.p,style:A.BLANK,tint:[.97,.95,.9],topY:a.y1,baseY:a.y1-l},p=u?a.y1-l:s-1.4;for(let o of[`nz`,`pz`,`nx`,`px`]){if(t[o]===`party`)continue;if(u){let e;e=o===`nz`?[a.x0-d(`nx`),a.z0-c,a.x1+d(`px`),a.z0]:o===`pz`?[a.x0-d(`nx`),a.z1,a.x1+d(`px`),a.z1+c]:o===`nx`?[a.x0-c,a.z0,a.x0,a.z1]:[a.x1,a.z0,a.x1+c,a.z1];let t=o===`nx`||o===`px`?{nz:null,pz:null}:{};i.fac.box(e[0],a.y1-l,e[1],e[2],a.y1,e[3],f,t,!0,!0),i.lod.box(e[0],a.y1-l,e[1],e[2],a.y1,e[3],f,t,!0,!1),n.box(e[0],a.y1-l,e[1],e[2],a.y1,e[3],`ledge`)}let m=.012,h=(e,t,n)=>({...a.p,topY:s,tint:a.p.tint.map(t=>t*e)}),g=(t,n,s)=>{if(n-t<.3)return;let c;c=o===`nz`?[a.x0,a.z0-m,a.x1,a.z0]:o===`pz`?[a.x0,a.z1,a.x1,a.z1+m]:o===`nx`?[a.x0-m,a.z0,a.x0,a.z1]:[a.x1,a.z0,a.x1+m,a.z1],i.fac.box(c[0],t,c[1],c[2],n,c[3],h(s),{...e,[o]:{style:a.p.style??r.style,gH:-r.gH}},!1,!1)};g(p-2.2,p,.8),g(a.y0,Math.min(a.y0+3,p-2.2),.7)}}}let l={floorH:3.9,bayW:1.75,winW:.44,winH:.66,layer:O.LIME,base:O.LIME,seed:12,margin:.8,depth:.3,tint:[.9,.88,.83]},u=H([2.5,2.52,2.55],7);for(let e of t.masses)if(!(Math.abs(e.y0-287.8)>.1||e.x1-e.x0<20)){for(let[t,a]of[[e.x0-2.2,e.z0-2.2],[e.x1,e.z0-2.2],[e.x0-2.2,e.z1],[e.x1,e.z1]])z(i,n,r,t,e.y0,a,t+2.2,e.y0+7.8,a+2.2,l,{style:A.BLANK,zip:!1});break}z(i,n,r,o-12,c,s-9,o+12,c+7.8,s+9,l,{style:A.DECO}),z(i,n,r,o-12,c+7.8,s-9,o+12,c+9,s-8.6,l,{zip:!1}),z(i,n,r,o-12,c+7.8,s+8.6,o+12,c+9,s+9,l,{zip:!1}),z(i,n,r,o-12,c+7.8,s-8.6,o-11.6,c+9,s+8.6,l,{zip:!1}),z(i,n,r,o+11.6,c+7.8,s-8.6,o+12,c+9,s+8.6,l,{zip:!1}),z(i,n,r,o-8,c+7.8,s-8,o+8,c+14.5,s+8,l,{style:A.DECO});let d=c+14.5;R(i,n,r,o,s,6.2,d,d+4,l,{n:12,zipTop:!1}),R(i,n,r,o,s,5.2,d+4,d+34,u,{n:12,style:A.DECO,zipTop:!1});let f={...l,tint:[.95,.93,.88]};for(let[e,t,a,c,l]of[[5,7.8,-.7,.7,26],[-7.8,-5,-.7,.7,26],[4.4,7,-2.4,-1.4,20],[4.4,7,1.4,2.4,20],[-7,-4.4,-2.4,-1.4,20],[-7,-4.4,1.4,2.4,20]])z(i,n,r,o+e,d+4,s+a,o+t,d+4+l,s+c,f,{zip:!1}),z(i,n,r,o+a,d+4,s+e,o+c,d+4+l,s+t,f,{zip:!1});R(i,n,r,o,s,4.2,d+34,d+38,l,{n:12,zipTop:!1}),R(i,n,r,o,s,3.6,d+38,d+44,u,{n:12,style:A.CURTAIN,zipTop:!1}),R(i,n,r,o,s,3.6,d+44,d+49,H([2,2.02,2.05]),{n:12,r1:1.3,zipTop:!1}),R(i,n,r,o,s,1.1,d+49,d+60,H([1.8,1.8,1.85]),{n:8,r1:.8,zipTop:!1}),R(i,n,r,o,s,.7,d+60,d+106,H([1.6,1.6,1.65]),{n:6,r1:.18}),ke(e,t.A,o,s,c,d)}}),e.push({name:`chrysler`,x0:484,x1:540,z0:-160,z1:-80,seed:4202,arch:()=>({type:`deco`,style:A.DECO,layer:O.WHITE,base:O.GRANITE,floorH:3.8,bayW:1.6,winW:.5,winH:.62,gH:6.5,height:240,depth:.3,margin:.8,tint:[.9,.89,.87],cornice:!1,waterTower:!1,seed:42.2,shape:(e,t,n)=>{let r=e=>t.gH+e*t.floorH,i=(e.x0+e.x1)/2,a=(e.z0+e.z1)/2;return[{...e,y0:0,y1:r(4),p:n,parapet:1.1,roof:!0},{...Ee(e,4,4,6,6),y0:r(4),y1:r(16),p:n,parapet:1.1,roof:!0,sides:{...V}},{...Ee(e,8,8,10,10),y0:r(16),y1:r(24),p:n,parapet:1.1,roof:!0,sides:{...V}},...U(De(i,a,15),2.5,r(24),r(58),n,{roof:!0}),...U(De(i,a,13),2,r(58),r(61),n)]}}),extra(e,t,{S:n,Z:r,tile:i}){let a=(e.x0+e.x1)/2,o=(e.z0+e.z1)/2,s=t.H,c=12.5,l={...H([3.3,3.32,3.35],9)};for(let e=0;e<7;e++)z(i,n,r,a-c,s,o-c,a+c,s+6.2,o+c,l,{style:A.ARCH,zip:e===0}),s+=6.2,c-=1.5;R(i,n,r,a,o,2.2,s,s+42,l,{n:8,r1:.1}),ee(De(a,o,12.5),t.H,s+42,[.86,.92,1],.55,16),Ae(De(a,o,12.5),t.H+.4,14477567,10)}}),e.push({name:`park432`,x0:372,x1:404,z0:-620,z1:-586,seed:5701,arch:()=>({type:`postwar`,style:A.PUNCHED,layer:O.WHITE,base:O.CONCRETE,floorH:4.7,bayW:3.6,winW:.7,winH:.66,gH:9,height:425,margin:0,depth:.45,tint:[1.05,1.05,1.03],cornice:!1,waterTower:!1,lintel:0,resid:1,glass:2,seed:57.01,shape:(e,t,n)=>[{...De((e.x0+e.x1)/2,(e.z0+e.z1)/2,14.5),y0:0,y1:B(t,425),p:n,parapet:1.6,sides:{...V}}]}),extra(e,t,{S:n,Z:r,tile:i}){let a=t.masses[0],o=t.A,s={floorH:o.floorH,bayW:3.6,winW:.66,winH:.97,layer:O.WHITE,base:O.WHITE,seed:3,margin:0,depth:.9,tint:[1,1,.98],resid:0,glass:2};for(let e=12;e*o.floorH+o.gH<a.y1-10;e+=12){let t=o.gH+e*o.floorH;z(i,n,r,a.x0-.06,t,a.z0-.06,a.x1+.06,t+o.floorH,a.z1+.06,s,{style:A.RIBBON,zip:!1})}let c=a.y1-2*o.floorH;z(i,n,r,a.x0-.06,c,a.z0-.06,a.x1+.06,a.y1-.6,a.z1+.06,{...s,floorH:2*o.floorH-.6,winH:.92},{style:A.RIBBON,zip:!1})}}),e.push({name:`cptower`,x0:136,x1:174,z0:-552,z1:-514,seed:5702,arch:()=>({type:`glass`,style:A.CURTAIN,layer:O.METAL,base:O.GRANITE,floorH:4.3,bayW:1.5,winW:.97,winH:.8,gH:9,height:440,margin:0,depth:.04,tint:[1,1,1],glass:4,seed:1,shape:(e,t,n)=>{let r={...n,style:A.PUNCHED,layer:O.LIME,winW:.62,winH:.66,depth:.3,margin:1,tint:[1,.98,.95]},i=B(t,30),a=B(t,300),o=B(t,370),s=B(t,425);return[{...e,y0:0,y1:i,p:r,parapet:1,roof:!0},...U(Ee(e,3),4,i,a,n,{roof:!0}),...U(Ee(e,3,10,3,3),3,a,o,n,{roof:!0}),...U(Ee(e,3,10,10,3),3,o,s,n)]}}),extra(e,t,{S:n,Z:r,tile:i}){let a=t.H,o=t.masses.filter(e=>Math.abs(e.y1-a)<.1),s={x0:Math.min(...o.map(e=>e.x0)),x1:Math.max(...o.map(e=>e.x1)),z0:Math.min(...o.map(e=>e.z0)),z1:Math.max(...o.map(e=>e.z1))},c=t.A,l={floorH:c.floorH,bayW:c.bayW,winW:c.winW,winH:c.winH,layer:O.METAL,base:O.METAL,seed:1,margin:0,depth:.04,tint:[1,1,1],glass:4},u=s,d=a;for(let e=0;e<2;e++)u=Ee(u,2.2),z(i,n,r,u.x0,d,u.z0,u.x1,d+2*c.floorH,u.z1,l,{style:A.CURTAIN,zip:e===1}),d+=2*c.floorH;u=Ee(u,2.2),z(i,n,r,u.x0,d,u.z0,u.x1,d+2*c.floorH,u.z1,l,{style:A.CURTAIN,zip:!1}),d+=2*c.floorH;let f={floorH:.4,bayW:1.2,winW:1,winH:.2,layer:O.CONCRETE,base:O.CONCRETE,seed:13,margin:0,depth:.05,tint:[1.08,1.08,1.1],glass:2};z(i,n,r,u.x0-.3,d,u.z0-.3,u.x1+.3,d+9,u.z1+.3,f,{style:A.RIBBON,zip:!1}),z(i,n,r,u.x0-.8,d+9,u.z0-.8,u.x1+.8,d+10.2,u.z1+.8,H([2.6,2.62,2.66],9));let p=Ee(u,2.5),m=(u.x0+u.x1)/2,h=(u.z0+u.z1)/2,g=d+10.2;p.x1-p.x0>4&&p.z1-p.z0>4&&(z(i,n,r,p.x0,g,p.z0,p.x1,g+4.5,p.z1,{...f,tint:[.92,.93,.95]},{style:A.RIBBON}),g+=4.5),R(i,n,r,m,h,1.6,g,g+3.5,H([2.3,2.3,2.35]),{n:8,zipTop:!1}),R(i,n,r,m,h,.9,g+3.5,g+11.5,H([2.5,2.5,2.55]),{n:8,r1:.7,zipTop:!1}),R(i,n,r,m,h,1.3,g+7.5,g+7.9,H([2.6,2.6,2.65]),{n:8,zipTop:!1}),R(i,n,r,m,h,.45,g+11.5,g+19.5,H([2.6,2.6,2.65]),{n:6,r1:.12})}}),e.push({name:`one57`,x0:40,x1:80,z0:-552,z1:-512,seed:5703,arch:()=>({type:`glass`,style:A.CURTAIN,layer:O.METAL,base:O.GRANITE,floorH:4,bayW:1.5,winW:.97,winH:.72,gH:8,height:306,margin:0,depth:.04,tint:[.95,.98,1.02],glass:1,seed:2,shape:(e,t,n)=>{let r=Ee(e,2),i=[{...e,y0:0,y1:B(t,24),p:{...n,style:A.PUNCHED,layer:O.GRANITE,winW:.62,winH:.66,depth:.3,margin:1},parapet:1,roof:!0}],a=B(t,24);return[200,226,250,270,290,306].forEach((e,o)=>{let s=B(t,e);i.push({...r,x0:r.x0+o*5.5,y0:a,y1:s,p:n,parapet:0,roof:!0,sides:{...V}}),a=s}),i}})}),e.push({name:`wtc1`,x0:-168,x1:-110,z0:2731,z1:2789,seed:1776,arch:()=>({type:`glass`,style:A.CURTAIN,layer:O.METAL,base:O.GRANITE,floorH:4.2,bayW:1.5,winW:.97,winH:.84,gH:12,height:430,margin:0,depth:.04,tint:[.97,1,1.05],glass:4,seed:3,shape:(e,t,n)=>{let r=(e.x0+e.x1)/2,i=(e.z0+e.z1)/2,a=Math.min(e.x1-e.x0,e.z1-e.z0)/2,o=B(t,57),s={...n,style:A.RIBBON,layer:O.METAL,winW:.22,winH:.94,tint:[1.55,1.57,1.6]},c=[{...De(r,i,a),y0:0,y1:o,p:s,parapet:0,roof:!1,sides:{...V}}],l=a*1.03,u=o;for(let e=0;e<14;e++){let s=B(t,o+(430-o)*(e+1)/14);if(s<=u)continue;let d=(e+.5)/14;c.push(...Oe(r,i,a,2*a+(l-2*a)*d,u,s,n)),u=s}return c}}),extra(e,t,{S:n,Z:r,tile:i}){let a=(e.x0+e.x1)/2,o=(e.z0+e.z1)/2,s=t.H;R(i,n,r,a,o,9,s,s+4.5,H([1.8,1.85,1.9]),{n:16,style:A.RIBBON,zipTop:!1}),R(i,n,r,a,o,3.2,s+4.5,s+9,H([2,2,2.05]),{n:12,zipTop:!1}),R(i,n,r,a,o,2.1,s+9,s+140,H([2.7,2.72,2.75]),{n:8,r1:.35}),ee(De(a,o,9.5),s,s+140,[.88,.93,1],.7,45)}}),e.push({name:`bluehq`,x0:-234,x1:-176,z0:-71,z1:-9,seed:811,arch:()=>({type:`glass`,style:A.CURTAIN,layer:O.METAL,base:O.GRANITE,floorH:4,bayW:1.5,winW:.97,winH:.7,gH:8,height:300,margin:0,depth:.04,tint:[.9,.95,1.05],glass:0,seed:1.94,cornice:!1,waterTower:!1,shape:(e,t,n)=>{let r={...n,style:A.PUNCHED,layer:O.GRANITE,winW:.6,winH:.62,depth:.32,margin:1,tint:[.62,.63,.66]},i=B(t,30),a=B(t,252),o=B(t,284),s=B(t,300);return[{...e,y0:0,y1:i,p:r,parapet:1.2,roof:!0},...U(Ee(e,5,5,6,6),5,i,a,n,{roof:!0}),...U(Ee(e,5,15,6,6),4,a,o,n,{roof:!0}),{...Ee(e,9,19,10,10),y0:o,y1:s,p:n,parapet:0,sides:{...V},spireR:6}]}}),extra(e,t,{S:n,Z:r,tile:i}){t.A;let a=H([2.9,2.2,.85],21),o=Ee(e,5,5,6,6),s=t.masses[0].y1,c=t.masses.find(e=>e.y0===s&&e.x0===o.x0+5),l=t.masses.find(e=>Math.abs(e.y0-c.y1)<.01),u=(l?l.y1:c.y1)+2,d=.45,f=1.3;for(let e of[1/3,2/3]){let t=c.x0+(c.x1-c.x0)*e;z(i,n,r,t-f,s,c.z0-d,t+f,u,c.z0,a,{zip:!1}),z(i,n,r,t-f,s,c.z1,t+f,u,c.z1+d,a,{zip:!1})}let p=(o.z0+o.z1)/2;z(i,n,r,o.x0-d,s,p-f,o.x0,u,p+f,a,{zip:!1});let m=t.masses.find(e=>e.y0===s&&e.x0===o.x1-5);z(i,n,r,o.x1,s,p-f,o.x1+d,m.y1+3,p+f,a,{zip:!1});let h=t.masses[t.masses.length-1],g=h.y1,_={floorH:.42,bayW:1.2,winW:1,winH:.3,layer:O.METAL,base:O.METAL,seed:7,margin:0,depth:.05,tint:[2.3,2.34,2.4],glass:2};z(i,n,r,h.x0-.4,g,h.z0-.4,h.x1+.4,g+7,h.z1+.4,_,{style:A.RIBBON,zip:!1}),z(i,n,r,h.x0-.7,g+7,h.z0-.7,h.x1+.7,g+8,h.z1+.7,H([2.6,2.62,2.65],9));let v=(h.x0+h.x1)/2,y=(h.z0+h.z1)/2,b=g+8;R(i,n,r,v,y,3.2,b,b+5,H([2.2,2.22,2.25]),{n:12,zipTop:!1}),R(i,n,r,v,y,1.5,b+5,b+30,H([2.4,2.4,2.45]),{n:8,r1:.9,zipTop:!1});for(let e of[.3,.65])R(i,n,r,v,y,2.2-e,b+5+25*e,b+5.6+25*e,H([2.6,2.6,2.65]),{n:8,zipTop:!1});R(i,n,r,v,y,.9,b+30,b+46,H([2.7,2.7,2.75]),{n:6,r1:.15}),ee({x0:h.x0-1,z0:h.z0-1,x1:h.x1+1,z1:h.z1+1},g-3,b+46,[.85,.92,1],.6,14);for(let[e,t]of[[-1,-1],[1,-1],[-1,1],[1,1]])z(i,n,r,v+e*4.2-.3,b,y+t*4.2-.3,v+e*4.2+.3,b+9,y+t*4.2+.3,H([2.2,2.2,2.25]),{zip:!1})}}),e.push({name:`vanderbilt`,x0:336,x1:384,z0:-151,z1:-89,seed:4203,arch:()=>({type:`glass`,style:A.CURTAIN,layer:O.METAL,base:O.LIME,floorH:4.1,bayW:1.6,winW:.97,winH:.74,gH:10,height:330,margin:0,depth:.04,tint:[1,1,1.02],glass:4,seed:1.05,cornice:!1,waterTower:!1,shape:(e,t,n)=>{let r={...n,style:A.PUNCHED,layer:O.LIME,winW:.66,winH:.7,depth:.32,margin:1,tint:[.97,.95,.9]},i=(e.x0+e.x1)/2,a=(e.z0+e.z1)/2,o=[{...e,y0:0,y1:B(t,26),p:r,parapet:1.1,roof:!0}],s=[[112,20,26,3],[178,18.5,24,5],[238,17,22,7],[288,15,19,8.5],[330,12.5,15.5,9]],c=B(t,26);for(let[e,r,l,u]of s){let s=B(t,e),d=Oe(i,a,r,2*r-u,c,s,n),f=l/r;for(let t of d)o.push({...t,z0:a+(t.z0-a)*f,z1:a+(t.z1-a)*f,roof:!0,...e===330?{spireR:12}:{}});c=s}return o}}),extra(e,t,{S:n,Z:r,tile:i}){let a=(e.x0+e.x1)/2,o=(e.z0+e.z1)/2,s=t.H,c=t.A,l={floorH:c.floorH,bayW:1.6,winW:.97,winH:.74,layer:O.METAL,base:O.METAL,seed:1.05,margin:0,depth:.04,tint:[1,1,1.02],glass:4};z(i,n,r,a-8,s,o-10,a+8,s+3*c.floorH,o+10,l,{style:A.CURTAIN});let u=s+3*c.floorH;z(i,n,r,a-8.4,u,o-10.4,a+8.4,u+1.2,o+10.4,H([2.6,2.62,2.65],9),{zip:!1}),z(i,n,r,a-5,u+1.2,o-6,a+5,u+7,o+6,l,{style:A.CURTAIN}),R(i,n,r,a,o,1.8,u+7,u+12,H([2.4,2.42,2.45]),{n:8,zipTop:!1}),R(i,n,r,a,o,1.1,u+12,u+40,H([2.7,2.72,2.75]),{n:8,r1:.2}),ee({x0:a-9,z0:o-11,x1:a+9,z1:o+11},s,u+40,[.9,.94,1],.5,18)}}),e}var je=`// grandcentral shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in float aPart;\r
out float vGP;\r
out vec3 vGW;\r
out vec3 vGN;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vGP = aPart;\r
vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vGN = normalize(mat3(modelMatrix) * objectNormal);\r
// @section fragmentCommon\r
#include <common>\r
uniform sampler2D tGN;\r
in float vGP;\r
in vec3 vGW;\r
in vec3 vGN;\r
uniform highp sampler2DArray tGWC;\r
uniform highp sampler2DArray tGWH; // (textures r5)\r
float gh(vec2 p) {\r
return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);\r
}\r
float gV = 0.0;   // (street r8) verdigris amount (bronze part 8)\r
float gH = 0.0;   // (street r2) carved height (m, <= 0 in joints) -> bump-mapped normal\r
vec3 gcPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {\r
vec3 vSigmaX = normalize(dFdx(surf_pos)), vSigmaY = normalize(dFdy(surf_pos)), vN = surf_norm;\r
vec3 R1 = cross(vSigmaY, vN), R2 = cross(vN, vSigmaX);\r
float fDet = dot(vSigmaX, R1) * faceDir;\r
vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);\r
return normalize(abs(fDet) * surf_norm - vGrad);\r
}\r
// @section fragmentMap\r
#include <map_fragment>\r
{\r
vec3 an = abs(vGN);\r
vec2 q = an.x > an.z ? vGW.zy : vGW.xy;\r
if(an.y > 0.7) q = vGW.xz;\r
vec3 nz = texture(tGN, q / 13.0).rgb, nz2 = texture(tGN, q / 2.7 + 0.31).rgb;\r
int part = int(vGP + 0.5);\r
vec3 c = diffuseColor.rgb;\r
if(part == 0) {\r
// limestone ashlar: 0.75 m courses, 1.5 m blocks, thin joints; per-block tone; grime washing down\r
float cy = q.y / 0.62, row = floor(cy), cx = q.x / 1.25 + 0.5 * mod(row, 2.0);\r
vec2 f = vec2(fract(cx), fract(cy));\r
vec2 fw = fwidth(vec2(cx, cy)) * 1.5 + 1e-4;\r
float joint = max(1.0 - smoothstep(0.0, 0.025 + fw.x, min(f.x, 1.0 - f.x)), 1.0 - smoothstep(0.0, 0.035 + fw.y, min(f.y, 1.0 - f.y)));\r
joint *= (1.0 - smoothstep(0.15, 0.5, max(fw.x, fw.y))) * (1.0 - an.y);\r
float blk = gh(floor(vec2(cx, cy)));\r
c *= (0.94 + 0.07 * blk) * (0.86 + 0.22 * nz.r) * (0.94 + 0.08 * nz2.g);\r
c *= 1.0 - 0.17 * joint;\r
// channelled rustication on the ground storey (below the terrace string course): deep horizontal joints\r
float rus = (1.0 - smoothstep(8.4, 8.8, vGW.y)) * (1.0 - an.y);\r
float jr = 1.0 - smoothstep(0.0, 0.07 + fw.y, min(f.y, 1.0 - f.y));\r
c *= 1.0 - 0.22 * jr * rus;\r
gH = - 0.018 * joint - 0.05 * jr * rus;\r
// rain streaks washing down from sills / cornices\r
float stk = texture(tGN, vec2(q.x / 1.9, vGW.y / 34.0) + 0.17).r;\r
c *= 1.0 - 0.22 * smoothstep(0.45, 0.8, stk) * (1.0 - an.y); // (street r8) 0.13 -> 0.22\r
} else if(part == 1 || part == 3 || part == 7) {\r
c *= (0.88 + 0.2 * nz.r) * (0.94 + 0.08 * nz2.g);\r
if(part == 7) { // (street r6) fluted column shafts: 24 flutes from the normal's azimuth (bump + cavity shade)\r
float az = atan(vGN.z, vGN.x) * 12.0 / 3.14159265;\r
float fl = abs(fract(az) - 0.5) * 2.0;           // 0 at the arris, 1 mid-flute\r
float cav = smoothstep(0.15, 0.95, fl);\r
gH = - 0.06 * cav;\r
c *= 1.0 - 0.2 * cav * (1.0 - an.y);\r
}\r
} else if(part == 8) {\r
// (street r8) patinated bronze statuary: dark oily bronze, verdigris washing over up-facing surfaces, runs below\r
float up = clamp(vGN.y * 0.5 + 0.5, 0.0, 1.0);\r
float n1 = texture(tGN, vGW.xy / 0.9 + vGW.z * 0.31).g, n2 = texture(tGN, vec2(vGW.x / 0.35 + vGW.z * 0.2, vGW.y / 3.0) + 0.21).r;\r
gV = clamp(smoothstep(0.45, 0.95, up) * 0.75 + smoothstep(0.5, 0.78, n2) * 0.55 + (n1 - 0.5) * 0.5, 0.0, 1.0);\r
c = mix(c * (0.75 + 0.45 * n1), vec3(0.33, 0.45, 0.38) * (0.85 + 0.3 * n2), gV * 0.8);\r
} else if(part == 2) {\r
// weathered copper: verdigris streaks running down the slope, darker seams\r
float st = texture(tGN, vec2(q.x / 3.0, vGW.y / 40.0)).g;\r
float st2 = texture(tGN, vec2(q.x / 0.9, q.y / 14.0) + 0.5).b;\r
c *= (0.72 + 0.34 * st) * (0.85 + 0.25 * st2) * (0.9 + 0.15 * nz2.r);\r
c = mix(c, vec3(dot(c, vec3(0.33))), 0.25);   // chalky, desaturated verdigris\r
float sw = fwidth(q.x / 1.2) * 1.5 + 1e-4;\r
float seam = smoothstep(0.9 - sw, 0.9, abs(fract(q.x / 1.2) - 0.5) * 2.0) * (1.0 - smoothstep(0.1, 0.4, sw));\r
c *= 1.0 - 0.12 * seam;\r
// (street r11) critic: 'copper roof is a flat saturated mint plane'. Old weathered copper: dark brown-bronze\r
// base showing through in broad blotches and long rain runs down the slope, the verdigris only as a\r
// streaky chalky crust (paler where the water washes), soot-dark near the eaves. gV carries the crust amount\r
// into the roughness (crust matte, bare metal satiny).\r
float cb = texture(tGN, q / 9.0 + 0.37).r, cr = texture(tGN, vec2(q.x / 1.6, vGW.y / 22.0) + 0.61).g;\r
float crust = clamp(smoothstep(0.3, 0.72, cb) * 0.7 + smoothstep(0.35, 0.8, cr) * 0.55 - 0.1, 0.0, 1.0);\r
vec3 bare = vec3(0.24, 0.2, 0.15) * (0.8 + 0.4 * st2);\r
vec3 verd = vec3(0.43, 0.52, 0.46) * (0.82 + 0.3 * st) * (0.9 + 0.2 * cr);\r
c = mix(bare, verd, crust) * (0.9 + 0.12 * nz2.r);\r
c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 3.5, vGW.y - __SHADER_INJECT_0__));   // soot at the eaves\r
c *= 1.0 - 0.12 * seam;\r
gV = crust;\r
} else if(part == 6) {\r
c *= (0.7 + 0.5 * texture(tGN, vGW.xz / 1.3 + vGW.y * 0.3).g) * (0.8 + 0.3 * nz2.r);\r
} else if(part == 4) {\r
c *= (0.85 + 0.25 * nz.r) * (0.92 + 0.12 * nz2.b);\r
// (street r5) deck wear: rectangular utility patches (darker fresh tar / paler old), oil blotches, sealed joints\r
vec2 pc = floor(vGW.xz / vec2(3.1, 4.3));\r
float ph = gh(pc), ph2 = gh(pc + 7.0);\r
vec2 pf = fract(vGW.xz / vec2(3.1, 4.3));\r
float pm = step(0.84, ph) * step(0.12, pf.x) * step(pf.x, 0.88) * step(0.1, pf.y) * step(pf.y, 0.82);\r
c *= mix(1.0, ph2 > 0.5 ? 0.78 : 1.12, pm);\r
c *= 1.0 - 0.22 * smoothstep(0.62, 0.8, texture(tGN, vGW.xz / 5.3 + 0.21).b);\r
float jn = abs(fract(vGW.z / 9.0) - 0.5) * 2.0;\r
c *= 1.0 - 0.3 * smoothstep(0.975, 0.995, jn);\r
// (street r6) critic: 'smooth grey slab, no tyre wear / oil'. On the Park Av ramp (two lanes along z): polished\r
// darker wheel paths, an oil-drip stripe down each lane centre, and a dark wet gutter line at both parapets.\r
float lx = vGW.x - __SHADER_INJECT_1__;\r
if(abs(lx) < 3.7) {\r
float lc = abs(abs(lx) - 1.8);                       // distance from the lane centre\r
float wn = texture(tGN, vec2(lx * 0.5, vGW.z / 23.0) + 0.43).r;\r
float wheel = 1.0 - smoothstep(0.18, 0.5, abs(lc - 0.85));\r
c *= 1.0 - 0.14 * wheel * (0.6 + 0.6 * wn);\r
float drip = (1.0 - smoothstep(0.1, 0.35, lc)) * smoothstep(0.45, 0.75, texture(tGN, vec2(lx * 0.9, vGW.z / 3.1) + 0.11).g);\r
c *= 1.0 - 0.28 * drip;\r
float gut = 1.0 - smoothstep(0.0, 0.45, 3.6 - abs(lx));\r
c *= 1.0 - 0.35 * gut * (0.7 + 0.3 * wn);\r
}\r
}\r
// grime: soot collecting under projections + dark wash near the ground (stone only)\r
if(part == 0 || part == 1 || part == 3 || part == 7) {\r
c *= 1.0 - 0.2 * smoothstep(0.55, 0.85, nz.b) * (1.0 - an.y);\r
c *= mix(0.78, 1.0, smoothstep(0.0, 4.0, vGW.y));\r
// (street r5) critic: 'no weathering / staining under ledges, no AO where the cornice meets the wall'.\r
// Contact shadow bands under the big projections + soot streaks washing down from them (walls only).\r
float wall = 1.0 - an.y;\r
float dC = __SHADER_INJECT_2__ - vGW.y, dA = __SHADER_INJECT_3__ - vGW.y, dT = __SHADER_INJECT_4__ - vGW.y;\r
float ao = 0.34 * step(0.0, dC) * exp(- max(dC, 0.0) * 1.1) + 0.26 * step(0.0, dA) * step(vGW.y, __SHADER_INJECT_5__) * exp(- max(dA, 0.0) * 1.4) + 0.3 * step(0.0, dT) * exp(- max(dT, 0.0) * 0.9); // (skyline r6) max(): exp overflowed to inf at y ~250 (MetLife cap) -> 0*inf = NaN = black\r
float colS = texture(tGN, vec2(q.x / 0.55, 0.37)).g, colS2 = texture(tGN, vec2(q.x / 2.3, 0.71)).b;\r
float streak = smoothstep(0.52, 0.8, colS) * (0.6 + 0.6 * colS2);\r
float run = step(0.0, dC) * exp(- max(dC, 0.0) / 7.0) + step(0.0, dA) * step(vGW.y, __SHADER_INJECT_6__) * exp(- max(dA, 0.0) / 3.0);\r
c *= (1.0 - ao * wall) * (1.0 - 0.3 * streak * run * wall);\r
c = mix(c, c * vec3(0.93, 0.95, 0.98), 0.5 * smoothstep(12.0, 30.0, vGW.y) * wall);   // cooler, cleaner stone higher up\r
// (textures r5) critic: 'Grand Central reads as pale clean plaster'. Real stone grain from the $imagegen stucco /\r
// limestone layer (luminance ratio, so the part colours stay), soot streak masks (walls_hao layer 16) washing\r
// down 3-14 m from the cornice / attic between the piers, and an overall aged value drop.\r
vec3 gs = texture(tGWC, vec3(q / 2.4 + 0.13, 14.0)).rgb, gm = textureLod(tGWC, vec3(0.5, 0.5, 14.0), 10.0).rgb;\r
c *= mix(1.0, clamp(dot(gs, vec3(0.333)) / max(dot(gm, vec3(0.333)), 0.05), 0.7, 1.3), 0.65);\r
float sc = floor(q.x / 1.7), sr = gh(vec2(sc, 3.1)), sLen = 3.0 + 11.0 * sr;\r
float sy = (vGW.y > __SHADER_INJECT_7__ ? __SHADER_INJECT_8__ : __SHADER_INJECT_9__) - vGW.y;\r
vec2 sq = vec2(fract(q.x / 1.7), sy / sLen);\r
float sm = (sq.y > 0.0 && sq.y < 1.0) ? texture(tGWH, vec3((mod(sc, 8.0) + clamp(sq.x, 0.02, 0.98)) / 8.0, 1.0 - sq.y, 16.0)).r : 0.0;\r
c *= 1.0 - 0.38 * sm * wall * step(0.35, sr);\r
c *= 0.86 * mix(vec3(1.0), vec3(1.0, 0.97, 0.92), 0.5 * (1.0 - smoothstep(2.0, 12.0, vGW.y)));\r
}\r
diffuseColor.rgb = c;\r
}\r
// @section fragmentRoughness\r
#include <roughnessmap_fragment>\r
if(int(vGP + 0.5) == 2) roughnessFactor = 0.42 + 0.45 * gV; /* (street r11) bare copper satin, crust matte */ \r
else if(int(vGP + 0.5) == 5) roughnessFactor = 0.45;\r
else if(int(vGP + 0.5) == 8) roughnessFactor = 0.42 + 0.4 * gV;\r
// @section fragmentMetalness\r
#include <metalnessmap_fragment>\r
if(int(vGP + 0.5) == 8) metalnessFactor = 0.55 * (1.0 - gV);\r
else if(int(vGP + 0.5) == 2) metalnessFactor = 0.35 * (1.0 - gV);\r
// @section fragmentNormalMaps\r
#include <normal_fragment_maps>\r
{\r
vec2 dH = vec2(dFdx(gH) / max(length(dFdx(vViewPosition)), 1e-4), dFdy(gH) / max(length(dFdy(vViewPosition)), 1e-4));\r
dH = clamp(dH, vec2(- 0.8), vec2(0.8));\r
if(abs(dH.x) + abs(dH.y) > 1e-4) normal = gcPerturb(- vViewPosition, normal, dH, faceDirection);\r
}\r
// @section vertexCommonByGrandCentralWorldNormal\r
#include <common>\r
out vec2 vGU;\r
out vec3 vGWp;\r
out vec3 vGNp;\r
// @section vertexUvVertex\r
#include <uv_vertex>\r
vGU = uv;\r
// @section vertexFogVertexByGrandCentralWorldNormal\r
#include <fog_vertex>\r
vGWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vGNp = normalize(mat3(modelMatrix) * objectNormal);\r
// @section fragmentCommonByGrandCentralWorldNormal\r
#include <common>\r
in vec2 vGU;\r
in vec3 vGWp;\r
in vec3 vGNp;\r
float vGMull = 0.0;\r
vec3 gInt = vec3(0.0);\r
float gGrid(vec2 q, vec2 per, vec2 w) {\r
vec2 g = q / per;\r
vec2 fw = fwidth(g) + 1e-4;\r
vec2 d = abs(fract(g) - 0.5) * 2.0;\r
return max(smoothstep(1.0 - w.x - fw.x * 2.0, 1.0 - w.x, d.x), smoothstep(1.0 - w.y - fw.y * 2.0, 1.0 - w.y, d.y)) * (1.0 - smoothstep(0.3, 0.7, max(fw.x, fw.y)));\r
}\r
// @section fragmentMapByGrandCentralWorldPosition\r
#include <map_fragment>\r
{\r
// fine muntins on the outer skin (the heavy bars are real geometry)\r
float mull = gGrid(vGU, vec2(0.5, 0.65), vec2(0.1, 0.08));\r
vec3 V = normalize(vGWp - cameraPosition), n = normalize(vGNp);\r
float cv = max(dot(V, - n), 0.08);\r
vec3 tW = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4));\r
// inner skin 1.2 m in\r
vec3 h1 = vGWp + V * (1.2 / cv);\r
float m1 = gGrid(vec2(dot(h1, tW), h1.y), vec2(1.0, 1.3), vec2(0.12, 0.1));\r
// concourse: far wall 30 m in, floor at y = 1\r
float tb = 30.0 / cv, tf = V.y < - 0.01 ? (vGWp.y - 1.0) / - V.y : 1e5;\r
vec3 col;\r
if(tf < tb) {\r
vec3 hf = vGWp + V * tf;\r
vec2 fq = vec2(dot(hf, tW), dot(hf, n));\r
float tile = gGrid(fq, vec2(1.6, 1.6), vec2(0.04, 0.04));\r
col = vec3(0.34, 0.28, 0.2) * (0.85 + 0.15 * sin(fq.x * 0.37) * sin(fq.y * 0.29)) * (1.0 - 0.3 * tile);\r
col *= 0.55 + 0.45 * exp(- tf * 0.02);\r
} else {\r
vec3 hb = vGWp + V * tb;\r
vec2 bq = vec2(dot(hb, tW), hb.y);\r
col = vec3(0.2, 0.15, 0.1) * (0.7 + 0.3 * smoothstep(20.0, 4.0, bq.y));            // warm stone hall, lit low\r
float ax = mod(bq.x + 7.5, 15.0) - 7.5;                                            // the far wall's arched windows\r
float arch = step(abs(ax), 4.0) * step(9.0, bq.y) * step(bq.y, 21.0 + sqrt(max(0.0, 16.0 - ax * ax)));\r
col = mix(col, vec3(0.34, 0.36, 0.38), arch * (1.0 - 0.6 * gGrid(bq, vec2(1.0, 1.3), vec2(0.14, 0.12))));\r
vec2 ch = vec2(mod(bq.x, 7.5) - 3.75, bq.y - 12.5);                                  // chandelier glows\r
col += vec3(1.0, 0.72, 0.4) * 0.9 * exp(- dot(ch, ch) * 0.9);\r
col += vec3(0.45, 0.4, 0.3) * smoothstep(24.0, 30.0, bq.y) * 0.4;                    // barrel ceiling (painted sky)\r
}\r
col *= 1.0 - 0.55 * m1;\r
gInt = col;\r
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.47, 0.44), mull * 0.45); // (street r5) pale painted muntins, faint (read as glazing, not a dark grid decal)\r
vGMull = mull;\r
}\r
// @section fragmentRoughnessStreetFixtures\r
#include <roughnessmap_fragment>\r
roughnessFactor = mix(roughnessFactor, 0.6, vGMull);\r
// @section fragmentMetalnessStreetFixtures\r
#include <metalnessmap_fragment>\r
metalnessFactor = mix(metalnessFactor, 0.2, vGMull);\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
{\r
float cv2 = max(dot(normalize(cameraPosition - vGWp), normalize(vGNp)), 0.0);\r
float fres = 0.08 + 0.92 * pow(1.0 - cv2, 5.0);\r
totalEmissiveRadiance += gInt * (1.0 - fres) * (1.0 - vGMull * 0.5) * 1.15; /* (street r10) 0.85 -> 1.15: warm concourse glow behind the deep reveals */ // (street r6) dimmer: deep, dark hall // (street r5) warmer interior glow\r
}\r
// @section vertexCommonByPavementWorldNormal\r
#include <common>\r
out vec3 vPW;\r
out vec3 vPN;\r
// @section vertexFogVertexByPavementWorldNormal\r
#include <fog_vertex>\r
vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vPN = normalize(mat3(modelMatrix) * objectNormal);\r
// @section fragmentCommonByPavementWorldNormal\r
#include <common>\r
in vec3 vPW;\r
in vec3 vPN;\r
float pOpq = 0.0;\r
float pH = 0.0, pH2 = 0.0, pH3 = 0.0;\r
vec3 pInt = vec3(0.0);\r
float ph(vec2 p) {\r
return fract(sin(dot(p, vec2(41.37, 289.11))) * 23758.5453);\r
}\r
// @section fragmentMapByPavementWorldPosition\r
#include <map_fragment>\r
{\r
vec3 n = normalize(vPN), tW = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4));\r
float u = dot(vPW, tW), fl = (vPW.y - __SHADER_INJECT_0__) / __SHADER_INJECT_1__;\r
float fy = fract(fl), fu = fract(u / __SHADER_INJECT_2__);\r
vec2 id = vec2(floor(u / __SHADER_INJECT_3__) + n.x * 17.0 + n.z * 31.0, floor(fl));\r
pH = ph(id);\r
pH2 = ph(id + 7.3);\r
pH3 = ph(vec2(floor(u / (__SHADER_INJECT_4__ * 3.0)), id.y) + 3.1);   // pane / room hashes\r
float fwU = fwidth(u / __SHADER_INJECT_5__) + 1e-4, fwY = fwidth(fl) + 1e-4;\r
float mull = max(1.0 - smoothstep(0.025, 0.025 + fwU * 1.5, min(fu, 1.0 - fu)), 1.0 - smoothstep(0.012, 0.012 + fwY * 1.5, abs(fy - 0.235)));\r
float span = 1.0 - smoothstep(0.215, 0.215 + fwY, fy);                    // opaque spandrel band at the slab\r
pOpq = max(span, mull);\r
// interior: room box behind the pane (back wall 6 m in, floor at the sill, ceiling 2.9 m up)\r
vec3 V = normalize(vPW - cameraPosition);\r
float cv = max(dot(V, - n), 0.06);\r
float yF = __SHADER_INJECT_6__ + floor(fl) * __SHADER_INJECT_7__ + 0.95, yC = yF + 2.85;\r
float tB = 6.0 / cv, tC = V.y > 0.001 ? (yC - vPW.y) / V.y : 1e5, tF = V.y < - 0.001 ? (yF - vPW.y) / V.y : 1e5;\r
float lit = step(0.35, pH3);\r
vec3 col;\r
if(tC < tB && tC < tF) {\r
vec3 h = vPW + V * tC;\r
float lx = abs(fract(dot(h, tW) / 1.5) - 0.5), lz = abs(fract(dot(h, n) / 2.4) - 0.5);\r
col = vec3(0.1) + lit * vec3(0.95, 0.97, 1.0) * 0.55 * (1.0 - smoothstep(0.12, 0.16, lx)) * (1.0 - smoothstep(0.3, 0.34, lz));\r
} else if(tF < tB) {\r
vec3 h = vPW + V * tF;\r
col = vec3(0.06, 0.06, 0.065) * (0.7 + 0.6 * exp(- tF * 0.2));\r
} else {\r
vec3 h = vPW + V * tB;\r
float hy = h.y - yF;\r
float bx = dot(h, tW);\r
col = mix(vec3(0.16, 0.16, 0.15), vec3(0.24, 0.22, 0.19), ph(vec2(floor(bx / 4.0), id.y)));\r
float desk = step(0.0, hy) * step(hy, 0.78) * step(0.25, fract(bx / 2.6));\r
col = mix(col, vec3(0.05), desk * 0.8);\r
col *= 0.5 + 0.5 * lit;\r
}\r
col *= 0.35 + 0.65 * lit;\r
// blinds: some bays drawn part-way down from the head\r
// (street r12) critic: 'randomly scattered bright white window cells (missing-texture flicker)'. Blinds are now\r
// set per 3-bay office (one tenant, one drop height, quantised to thirds) and are a dusty dark bronze, not cream\r
float bl = pH3 > 0.62 ? 0.2 + 0.25 * floor(ph(vec2(floor(u / (__SHADER_INJECT_8__ * 3.0)), id.y) + 1.9) * 3.0) : 0.0;\r
float wy = (fy - 0.235) / 0.765;\r
float blind = step(1.0 - bl, wy);\r
float slat = mix(0.92, 0.85 + 0.15 * step(0.5, fract(vPW.y * 18.0)), 1.0 - smoothstep(0.15, 0.4, fwidth(vPW.y * 18.0)));\r
pInt = mix(col, vec3(0.0), blind);\r
diffuseColor.rgb = mix(diffuseColor.rgb * (0.75 + 0.5 * pH), vec3(0.17, 0.155, 0.13) * slat * (0.9 + 0.15 * pH2), blind * 0.85); // (street r12) darker blinds\r
pOpq = max(pOpq, blind * 0.7);\r
diffuseColor.rgb = mix(diffuseColor.rgb, span > 0.5 ? vec3(0.075, 0.068, 0.058) : vec3(0.1, 0.09, 0.075), max(span, mull));\r
}\r
// @section fragmentRoughnessWindowGlass\r
#include <roughnessmap_fragment>\r
roughnessFactor = mix(0.05 + 0.18 * pH * pH, 0.55, pOpq);\r
// @section fragmentMetalnessWindowGlass\r
#include <metalnessmap_fragment>\r
metalnessFactor = mix(0.85, 0.25, pOpq);\r
// @section fragmentNormalMapsWindowPane\r
#include <normal_fragment_maps>\r
normal = normalize(normal + vec3(pH - 0.5, pH2 - 0.5, 0.0) * 0.045 * (1.0 - pOpq));   // per-pane tilt (oil-canning)\r
// @section fragmentEmissiveByPavementWorldNormal\r
#include <emissivemap_fragment>\r
{\r
float cv2 = max(dot(normalize(cameraPosition - vPW), normalize(vPN)), 0.0);\r
float fres = 0.06 + 0.94 * pow(1.0 - cv2, 5.0);\r
totalEmissiveRadiance += pInt * (1.0 - fres) * (1.0 - pOpq) * 0.55;\r
}\r
`,Me=`// timessq shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section fragmentCommon\r
#include <common>\r
__SHADER_INJECT_0__\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
totalEmissiveRadiance *= __SHADER_INJECT_0__; // (night)\r
{\r
vec2 px = vEmissiveMapUv * vec2(4096.0) * 0.5;\r
vec2 fw = fwidth(px);\r
float k = clamp(1.0 - max(fw.x, fw.y) * 1.6, 0.0, 1.0);\r
vec2 g = abs(fract(px) - 0.5);\r
float m = smoothstep(0.5, 0.36, max(g.x, g.y));\r
// RGB sub-pixel triads (visible up close only) + the dark pixel grid between the LEDs\r
float sp = fract(px.x * 3.0);\r
vec3 tri = vec3(smoothstep(0.0, 0.12, sp) * smoothstep(0.36, 0.24, sp), smoothstep(0.3, 0.42, sp) * smoothstep(0.7, 0.58, sp), smoothstep(0.64, 0.76, sp) * smoothstep(1.0, 0.88, sp));\r
float k2 = clamp(1.0 - max(fw.x, fw.y) * 4.0, 0.0, 1.0);\r
totalEmissiveRadiance *= mix(vec3(1.0), (0.4 + 0.75 * m) * mix(vec3(1.0), 0.35 + 1.9 * tri, k2), k);\r
// (r6) a touch less chroma (critic: 'over-saturated, too clean')\r
totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(dot(totalEmissiveRadiance, vec3(0.3, 0.55, 0.15))), mix(0.26, uScrDesat, uNightK)); // (night) vivid LED colour at night (ts_perch_night) // (billboards r6) 0.14 -> 0.26 (critic r5: 'uniformly saturated poster imagery')\r
// (r7) LED cabinet modules (16 x 16 LEDs): thin dark seams that survive much farther than the LED grid, plus faint\r
// horizontal scan rows (critic r6: 'flat glowing cards with no LED pixel grid or scanline')\r
vec2 cb = vEmissiveMapUv * vec2(4096.0) / 32.0;\r
vec2 fc = fwidth(cb);\r
float kc = clamp(1.0 - max(fc.x, fc.y) * 14.0, 0.0, 1.0);\r
vec2 gc = 0.5 - abs(fract(cb) - 0.5);\r
float seam = max(1.0 - smoothstep(0.006, 0.006 + fc.x, gc.x), 1.0 - smoothstep(0.006, 0.006 + fc.y, gc.y));\r
totalEmissiveRadiance *= 1.0 - 0.09 * seam * kc; // (r9) 0.2 -> 0.09 (critic r8: 'visible grid tiling pattern' up close)\r
float kr = clamp(1.0 - fw.y * 1.4, 0.0, 1.0);\r
totalEmissiveRadiance *= mix(1.0, 0.8 + 0.2 * cos(px.y * 6.2831853), kr * 0.8);\r
// (r7) LED viewing cone: panels seen off-axis dim + shift slightly cool, so screens at different angles differ\r
float ca = abs(dot(normalize(normal), normalize(vViewPosition)));\r
totalEmissiveRadiance *= mix(vec3(0.5, 0.54, 0.6), vec3(1.0), smoothstep(0.08, 0.7, ca));\r
// (r7) soft highlight shoulder: whites roll off instead of clipping to a flat near-white card\r
float mx = max(totalEmissiveRadiance.r, max(totalEmissiveRadiance.g, totalEmissiveRadiance.b));\r
if(mx > 1.0) totalEmissiveRadiance *= (1.0 + (mx - 1.0) / (1.0 + (mx - 1.0) * 1.1)) / mx;\r
__SHADER_INJECT_1__ }\r
// @section fragmentMap\r
#include <map_fragment>\r
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), 0.2) * 0.92 + 0.012;\r
// @section fragmentColor\r
diffuseColor.a *= vColor.r;\r
diffuseColor.rgb = vec3(0.0);\r
// @section fragmentEmissiveSignLetterCutout\r
{\r
vec3 c = texture(emissiveMap, vEmissiveMapUv).rgb, b = textureLod(emissiveMap, vEmissiveMapUv, 5.0).rgb;\r
float m = smoothstep(0.1, 0.3, length(c - b));\r
if(m < 0.4) discard;\r
totalEmissiveRadiance = emissive * mix(vColor.rgb, vec3(1.0, 0.96, 0.92), 0.45 * smoothstep(0.65, 1.0, m)) * m;\r
}\r
// @section vertexCommon\r
#include <common>\r
out float vHaloF;\r
// @section vertexProjectVertex\r
#include <project_vertex>\r
{\r
vec3 hwp = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vHaloF = 1.0 - smoothstep(0.3, 0.65, - normalize(hwp - cameraPosition).y);\r
}\r
// @section fragmentCommonByHaloFade\r
#include <common>\r
in float vHaloF;\r
// @section fragmentOpaque\r
outgoingLight *= vHaloF;\r
#include <opaque_fragment>\r
// @section vertexProjectVertexStorefront\r
#include <project_vertex>\r
vTanW = aTan;\r
vRoom = aRoom;\r
vNW = normal;\r
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
// @section fragmentMapStorefrontGlass\r
#include <map_fragment>\r
diffuseColor.rgb = vec3(0.03);\r
// @section fragmentEmissiveStorefrontInterior\r
{\r
vec3 V = normalize(vWP - cameraPosition), Nn = normalize(vNW), Tt = normalize(vTanW);\r
float dx = dot(V, Tt), dy = V.y, dz = max(- dot(V, Nn), 1e-3);\r
vec2 sz = vRoom.zw, p = vRoom.xy * sz;\r
const float D = 5.5;\r
float tx = dx > 1e-4 ? (sz.x - p.x) / dx : (dx < - 1e-4 ? - p.x / dx : 1e5);\r
float ty = dy > 1e-4 ? (sz.y + 0.6 - p.y) / dy : (dy < - 1e-4 ? - (p.y + 0.5) / dy : 1e5);\r
float tz = D / dz, t = min(min(tx, ty), tz);\r
vec3 h = vec3(p.x + dx * t, p.y + dy * t, dz * t);\r
vec2 cs = vec2(0.242, 0.49), c0 = vEmissiveMapUv - vRoom.xy * cs;\r
float fall = 1.0 - 0.4 * h.z / D;\r
vec3 col;\r
if(t >= tz - 1e-3) col = texture(emissiveMap, c0 + clamp(h.xy / sz, 0.02, 0.98) * cs).rgb;\r
else if(t >= tx - 1e-3) {\r
float s = 0.3 * h.z / D; // side walls: the outer strips of the shop picture run down the wall\r
col = texture(emissiveMap, c0 + vec2(dx > 0.0 ? 0.98 - s : 0.02 + s, clamp(h.y / sz.y, 0.02, 0.98)) * cs).rgb * 0.6 * fall;\r
} else if(dy > 0.0) {\r
float lp = step(0.62, fract(h.z / 1.5 + 0.2)) * step(0.3, fract(h.x / 1.8 + 0.15));\r
col = vec3(0.3, 0.29, 0.27) * fall + vec3(1.7, 1.6, 1.4) * lp;\r
} else {\r
vec2 q = vec2(h.x, h.z) / 0.6;\r
float tl = step(0.05, fract(q.x)) * step(0.05, fract(q.y));\r
col = vec3(0.36, 0.33, 0.3) * (0.7 + 0.3 * tl) * fall;\r
}\r
totalEmissiveRadiance = emissive * col * vColor.r;\r
}\r
// @section fragmentMapPaverGrime\r
#include <map_fragment>\r
{\r
vec2 wp = vec2(vMapUv.x, - vMapUv.y) * 9.6;\r
// (r7) large-scale colour variance (warm red-brown <-> cooler grey-pink fields), lighter polished walking lines,\r
// darker grime along the building frontage\r
float h1 = texture(tMacro, wp * 0.0071 + 0.53).b, h2 = texture(tMacro, wp * 0.021 + 0.21).r;\r
diffuseColor.rgb *= mix(vec3(1.07, 0.97, 0.9), vec3(0.9, 0.96, 1.05), smoothstep(0.3, 0.72, h1));\r
float path = smoothstep(0.55, 0.8, h2) * (0.6 + 0.4 * texture(tMacro, wp * 0.13).g);\r
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + vec3(0.012, 0.011, 0.01), path * 0.7);\r
float ex = abs(wp.x);\r
diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(uEdgeX - 4.0, uEdgeX - 0.5, ex) * (0.6 + 0.4 * h2);\r
// painted discs: worn, blotchy, paver texture multiplied through\r
float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));\r
// The loop skips discs per pixel. Compute the scaled mip levels before that divergent control flow;\r
// textureLod avoids executing a gradient instruction in the loop on ANGLE/D3D backends.\r
vec2 wpDx = dFdx(wp), wpDy = dFdy(wp);\r
vec2 macroTexelSize = vec2(textureSize(tMacro, 0));\r
float paintMacroLod = paverMipLevel(wpDx * 0.31, wpDy * 0.31, macroTexelSize);\r
float grainMacroLod = paverMipLevel(wpDx * 1.9, wpDy * 1.9, macroTexelSize);\r
for(int i = 0;\r
i < 24;\r
i ++) {\r
vec4 C = uCirc[i];\r
if(C.z < 0.0) continue;\r
float d = length(wp - C.xy) - C.z;\r
if(d > 0.05) continue;\r
float m = 1.0 - smoothstep(- 0.04, 0.03, d);\r
float rim = (1.0 - smoothstep(- 0.34, - 0.3, d)) * smoothstep(- 0.46, - 0.42, d); // pale inner ring line\r
vec3 pc = C.w < 0.5 ? vec3(0.07, 0.2, 0.3) : C.w < 1.5 ? vec3(0.09, 0.22, 0.24) : C.w < 2.5 ? vec3(0.16, 0.17, 0.2) : vec3(0.06, 0.12, 0.26);\r
float wr = textureLod(tMacro, wp * 0.31 + C.xy * 0.01, paintMacroLod).g * 0.6 + textureLod(tMacro, wp * 1.9, grainMacroLod).r * 0.5;\r
float keep = smoothstep(0.34, 0.62, wr);\r
vec3 painted = pc * clamp(lum / 0.16, 0.45, 1.5);\r
painted = mix(painted, vec3(0.5, 0.52, 0.52) * clamp(lum / 0.16, 0.45, 1.5), rim * 0.8);\r
diffuseColor.rgb = mix(diffuseColor.rgb, painted, m * keep * 0.5); // (r8) fainter, worn (critic: 'cheap flat circles')\r
}\r
}\r
{\r
float a = texture(tMacro, vMapUv * 0.061).r, b = texture(tMacro, vMapUv * 0.23 + 0.37).g, c = texture(tMacro, vMapUv * 0.9 + 0.11).b;\r
diffuseColor.rgb *= 0.74 + 0.42 * a * (0.7 + 0.6 * b);\r
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))), 0.12 + 0.25 * smoothstep(0.55, 0.8, c));\r
diffuseColor.rgb *= mix(1.0, texture(roughnessMap, vRoughnessMapUv).r, 0.8);\r
diffuseColor.rgb = diffuseColor.rgb * 1.2 + vec3(0.014, 0.012, 0.011); // (r8) paler, sunlit pavers (director r7)\r
// (r11) critic r9: 'pavers flat and too saturated, no grime' -> less chroma + a sooty film in the macro noise lows\r
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))), 0.2);\r
diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(0.5, 0.2, a) * (0.5 + 0.5 * b);\r
}\r
// @section fragmentMapCrosswalkWear\r
{\r
vec4 n1 = texture(map, vMapUv), n2 = texture(map, vMapUv * 4.3 + 0.37), n3 = texture(map, vMapUv * 17.0 + 0.71);\r
float pale = smoothstep(0.72, 0.9, n1.g) * smoothstep(0.45, 0.75, n2.b);\r
diffuseColor = vec4(mix(diffuse * (0.75 + 0.4 * n3.b), vec3(0.62, 0.61, 0.58), pale), clamp((0.26 + 0.34 * smoothstep(0.2, 0.8, n1.r)) * (0.65 + 0.7 * n2.g) + 0.25 * pale, 0.0, 0.68));\r
vec2 wq = vMapUv * float(__SHADER_INJECT_0__);\r
// (r11) worn crosswalk paint (critic r9: 'stripes too clean and uniformly white'): denser grime film + chipped\r
// spots over the avenue crossings (z = street +- 7.4) and the side-street crossings (|x| = 13.4)\r
{\r
float zz = mod(wq.y, float(__SHADER_INJECT_1__)), ax = abs(wq.x);\r
float cw = (1.0 - smoothstep(2.2, 3.0, abs(zz - __SHADER_INJECT_2__))) + (1.0 - smoothstep(2.2, 3.0, abs(zz - __SHADER_INJECT_3__)));\r
cw *= 1.0 - smoothstep(__SHADER_INJECT_4__, __SHADER_INJECT_5__, ax);\r
cw += (1.0 - smoothstep(__SHADER_INJECT_6__, __SHADER_INJECT_7__, min(zz, float(__SHADER_INJECT_8__) - zz))) * (1.0 - smoothstep(1.8, 2.6, abs(ax - __SHADER_INJECT_9__)));\r
float chip = smoothstep(0.55, 0.72, n3.r) * (0.6 + 0.4 * n2.b);\r
diffuseColor.a = __SHADER_INJECT_10__;\r
}\r
diffuseColor.a *= smoothstep(float(__SHADER_INJECT_11__), float(__SHADER_INJECT_12__), abs(wq.x)) * smoothstep(- 326.0, - 306.0, wq.y) * smoothstep(6.0, - 8.0, wq.y);\r
}\r
\r
// @section storefrontVertexPrefix\r
in vec3 aTan;\r
in vec4 aRoom;\r
out vec3 vTanW;\r
out vec4 vRoom;\r
out vec3 vWP;\r
out vec3 vNW;\r
\r
// @section storefrontFragmentPrefix\r
in vec3 vTanW;\r
in vec4 vRoom;\r
in vec3 vWP;\r
in vec3 vNW;\r
\r
// @section paversFragmentPrefix\r
uniform sampler2D tMacro;\r
uniform vec4 uCirc[24];\r
uniform float uEdgeX;\r
float paverMipLevel(vec2 uvDx, vec2 uvDy, vec2 textureSizeInTexels) {\r
float footprint = max(length(uvDx * textureSizeInTexels), length(uvDy * textureSizeInTexels));\r
return log2(max(footprint, 1.0));\r
}\r
`,Ne=pe(`city/tex/`);function G(e,t=5){return new Promise((n,r)=>{let i=0,a=()=>{let o=new Image;o.onload=()=>n(o),o.onerror=()=>++i<t?setTimeout(a,250*2**i):r(Error(`texture failed to load: `+e)),o.src=e};a()})}function Pe(e){return G(Ne+e)}function Fe(e,{srgb:t=!1,repeat:n=!0,aniso:i=8}={}){let a=e.isCompressedTexture?e:new y(e);return a.colorSpace=t?s:``,n&&(a.wrapS=a.wrapT=d),a.anisotropy=i,a.generateMipmaps=!e.isCompressedTexture,a.minFilter=r,a.magFilter=c,a.needsUpdate=!0,a}function Ie(e,t,{srgb:n,aniso:i}){let a=e.reduce((e,t)=>e+Math.round(t.height/t.width),0),o=new Uint8Array(t*t*4*a),l=document.createElement(`canvas`);l.width=t,l.height=t;let u=l.getContext(`2d`,{willReadFrequently:!0}),f=0;for(let n of e){let e=Math.round(n.height/n.width);for(let r=0;r<e;r++){u.clearRect(0,0,t,t),u.drawImage(n,0,r*n.width,n.width,n.width,0,0,t,t);let e=u.getImageData(0,0,t,t).data;for(let n=0;n<t;n++){let r=(t-1-n)*t*4;o.set(e.subarray(r,r+t*4),(f*t*t+n*t)*4)}f++}}let p=new m(o,t,t,a);return p.colorSpace=n?s:``,p.wrapS=p.wrapT=d,p.generateMipmaps=!0,p.minFilter=r,p.magFilter=c,p.anisotropy=i,p.needsUpdate=!0,p}async function K(e){let t=Math.min(16,e.capabilities.getMaxAnisotropy()),[n,r]=await Promise.all([Promise.all(Object.entries({walls_col:`walls_col.jpg`,walls_nrm:`walls_nrm.webp`,walls_hao:`walls_hao.jpg`}).map(async([e,t])=>[e,await Pe(t)])),Promise.all(Object.entries({asphalt_col:`asphalt_col.png`,asphalt_nrm:`asphalt_nrm.png`,asphalt_macro:`asphalt_macro.png`,sidewalk_col:`sidewalk_col.png`,sidewalk_nrm:`sidewalk_nrm.png`,curb_col:`curb_col.webp`,asphalt_decals:`asphalt_decals.webp`,interiors:`interiors.png`,signs:`signs.png`,markings:`markings.png`,leaves:`leaves.png`,grass_col:`grass_col.png`,grass_nrm:`grass_nrm.png`,water_nrm:`water_nrm.png`,noise:`noise.png`,detail_nrm:`detail_nrm.png`}).map(async([e,t])=>[e,await he(Ne+t)]))]),i=Object.fromEntries([...n,...r]),a=await(await fetch(Ne+`markings.json`)).json(),o={asphaltCol:Fe(i.asphalt_col,{srgb:!0,aniso:t}),asphaltNrm:Fe(i.asphalt_nrm,{aniso:t}),asphaltMacro:Fe(i.asphalt_macro,{aniso:t}),sidewalkCol:Fe(i.sidewalk_col,{srgb:!0,aniso:t}),sidewalkNrm:Fe(i.sidewalk_nrm,{aniso:t}),interiors:Fe(i.interiors,{srgb:!0,repeat:!1,aniso:4}),signs:Fe(i.signs,{srgb:!0,repeat:!1,aniso:t}),markings:Fe(i.markings,{srgb:!0,repeat:!1,aniso:t}),leaves:Fe(i.leaves,{repeat:!1,aniso:4}),grassCol:Fe(i.grass_col,{srgb:!0,aniso:t}),grassNrm:Fe(i.grass_nrm,{aniso:t}),detailNrm:Fe(i.detail_nrm,{aniso:t}),waterNrm:Fe(i.water_nrm,{aniso:t}),noise:Fe(i.noise,{aniso:4}),markRects:a};return o.wallsCol=Ie([i.walls_col],1024,{srgb:!0,aniso:t}),o.wallsNrm=Ie([i.walls_nrm],512,{srgb:!1,aniso:t}),o.asphaltDecals=Fe(i.asphalt_decals,{repeat:!1,aniso:t}),o.curbCol=Fe(i.curb_col,{srgb:!0,aniso:t}),o.wallsHao=Ie([i.walls_hao],512,{srgb:!1,aniso:t}),o}var Le=`// screenlights shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section fragmentCommon\r
#include <common>\r
__SHADER_INJECT_0__\r
// @section fragmentLightsBegin\r
totalEmissiveRadiance *= __SHADER_INJECT_0__; // (night)\r
__SHADER_INJECT_1__\r
#include <lights_fragment_begin>\r
\r
// @section uniformDeclarations\r
uniform float uScreenK;\r
uniform float uNightK;\r
uniform float uScrBoost;\r
uniform float uScrDesat;\r
uniform float uScrKnee;\r
uniform float uScrTop;\r
\r
// @section gainExpression\r
(uScreenK * (1.0 + (uScrBoost - 1.0) * uNightK))\r
\r
// @section highlightShoulder\r
if(uNightK > 0.0) {\r
float scrN = max(max(emissive.r, emissive.g), emissive.b) * __SHADER_INJECT_0__ + 1e-4;\r
float scrM = max(max(totalEmissiveRadiance.r, totalEmissiveRadiance.g), totalEmissiveRadiance.b) / scrN;\r
if(scrM > uScrKnee) {\r
float scrW = uScrTop - uScrKnee;\r
float scrY = uScrKnee + scrW * (1.0 - exp(- (scrM - uScrKnee) / scrW));\r
totalEmissiveRadiance *= mix(1.0, scrY / scrM, uNightK);\r
}\r
}\r
`,Re=w(()=>Le),ze={gain:1,sat:2,minL:.06,mergeA:40,mergeGap:5,mergeMax:26,volume:.28,point:1,split:10,halo:.3,printed:.8,lodNear:45,tileMin:3},Be=[];function Ve(){for(let e of Be)e.sync?e.sync():e.col?C.update(e.id,{color:e.col(),intensity:e.I()}):C.update(e.id,{intensity:e.I()})}typeof window<`u`&&(window.__screenLights={SL:ze,refresh:Ve,all:Be});var He=new l,Ue=e=>1.5*Math.max(e,ze.minL)/(1+Math.max(e,ze.minL));function We(e){let t=.2126*e[0]+.7152*e[1]+.0722*e[2],n=Math.max(0,t+(e[0]-t)*ze.sat),r=Math.max(0,t+(e[1]-t)*ze.sat),i=Math.max(0,t+(e[2]-t)*ze.sat),a=Math.max(n,r,i,1e-4);return{rgb:[n/a,r/a,i/a],lum:t,m:a}}function Ge(){let e=[],t=[],n=[];return{rects:e,points:t,halos:n,rect(t,n,r,i,a,o,s=1,c={}){(o||c.uv)&&i>.3&&a>.3&&e.push({c:[...t],n:[...n],u:[...r],w:i,h:a,avg:o?[...o]:null,k:s,uv:c.uv?[c.uv[0],c.uv[1],c.uv[2],c.uv[3]]:null,pr:!!c.printed,range:c.range,whole:!!c.whole,gain:c.gain??1})},point(e,n,r,i=8,a=.2){t.push({p:[...e],col:n,I:r,range:i,volume:a})},halo(e,t,r,i,a,o){o&&n.push({c:[...e],n:[...t],u:[...r],w:i,h:a,avg:[...o]})},commit(i=``,a={}){let o={tag:i,panels:e.length,emitters:0,halos:n.length,points:t.length,pending:!0};typeof window<`u`&&(window.__screenLightStats??=[]).push(o);let s=e.some(e=>e.uv),c=e=>{try{r(e,i,a,o)}catch(e){console.warn(`[screenlights]`,i,e)}o.pending=!1};return s?(a.grid??L()).then(c,()=>c(null)):c(null),o}};function r(r,i,a,o){let s=a.mergeA??ze.mergeA,c=a.mergeGap??ze.mergeGap,u=a.mergeMax??ze.mergeMax;for(let t of e){let e=t.uv&&r?qe(r,t.uv,0,1,0,1):null;e?t.avg=e:t.avg||=[.15,.15,.15]}let d=e.filter(e=>e.w*e.h<s),p=e.filter(e=>e.w*e.h>=s),m=[];for(let e of d){let t=e.c[0]*e.u[0]+e.c[2]*e.u[2],n=e.c[0]*e.n[0]+e.c[2]*e.n[2],r=null;for(let i of m){if(i.n[0]!==e.n[0]||i.n[2]!==e.n[2]||Math.abs(i.d-n)>2)continue;let a=Math.min(i.t0,t-e.w/2),o=Math.max(i.t1,t+e.w/2),s=Math.min(i.y0,e.c[1]-e.h/2),l=Math.max(i.y1,e.c[1]+e.h/2),d=Math.max(i.t0-(t+e.w/2),t-e.w/2-i.t1),f=Math.max(i.y0-(e.c[1]+e.h/2),e.c[1]-e.h/2-i.y1);if(!(d>c||f>c||o-a>u||l-s>u)){r=i,Object.assign(i,{t0:a,t1:o,y0:s,y1:l});break}}r||m.push(r={n:e.n,u:e.u,d:n,t0:t-e.w/2,t1:t+e.w/2,y0:e.c[1]-e.h/2,y1:e.c[1]+e.h/2,list:[]}),r.list.push(e)}let h=[],g=[],_=e=>{let t=Math.max(1,Math.ceil(e.w/ze.split-.15)),n=Math.max(1,Math.ceil(e.h/ze.split-.15));e.uv&&r&&!e.whole&&(e.w>=ze.tileMin&&e.w>=.6*e.h&&(t=Math.max(t,2)),e.h>=ze.tileMin&&e.h>=.6*e.w&&(n=Math.max(n,2)));let i=e.w/t,a=e.h/n;for(let o=0;o<t;o++)for(let s=0;s<n;s++){let c=(o+.5)*i-e.w/2,l=(s+.5)*a-e.h/2,u={...e,c:[e.c[0]+e.u[0]*c,e.c[1]+l,e.c[2]+e.u[2]*c],w:i,h:a};e.uv&&r&&!e.whole&&(u.avg=qe(r,e.uv,o/t,(o+1)/t,s/n,(s+1)/n)??e.avg),u.list=[u],h.push(u),v.push(u)}v.length===1&&(h.pop(),v.length=0);let o={...e,list:[e]};h.push(o),g.push({whole:o,tiles:v.length>1?v:null,T:v})},v,y=e=>{v=[],_(e)};for(let e of p)y(e);for(let e of m){if(e.list.length===1){y(e.list[0]);continue}let t=e.t1-e.t0,n=e.y1-e.y0,r=(e.t0+e.t1)/2,i=e.list.reduce((e,t)=>e+t.c[0]*t.n[0]+t.c[2]*t.n[2],0)/e.list.length,a={c:[e.n[0]*i+e.u[0]*r,(e.y0+e.y1)/2,e.n[2]*i+e.u[2]*r],n:e.n,u:e.u,w:t,h:n,list:e.list,pr:e.list.every(e=>e.pr)};h.push(a),g.push({whole:a,tiles:null})}for(let e of h){let t=0,n=0,r=0;for(let i of e.list){let e=i.w*i.h*i.k;t+=i.avg[0]*e,n+=i.avg[1]*e,r+=i.avg[2]*e}let a=e.w*e.h,o={kind:`rect`,avg:[t/a,n/a,r/a],c:e.c,n:e.n,w:e.w,h:e.h,tag:i,pr:!!e.pr,g:e.gain??1};o.col=()=>{let e=We(o.avg);return He.setRGB(e.rgb[0],e.rgb[1],e.rgb[2],f).clone()},o.I=()=>{let e=We(o.avg);return ze.gain*o.g*Ue(e.m)*(o.pr?ze.printed:1)};let s=Math.sqrt(a),c=e.range??Math.min(60,Math.max(e.pr?12:18,s*(e.pr?3.5:4.5)));o.rec={type:`rect`,pos:e.c,dir:e.n,u:e.u,width:e.w,height:e.h,color:new l,intensity:1,range:c,radius:Math.min(e.w,e.h)/2,volume:ze.volume},o.sync=()=>{o.rec.color.copy(o.col()).multiplyScalar(o.I())},o.sync(),e.e=o,Be.push(o)}for(let e of g){let t=e.whole.e,n=Math.max(t.w,t.h);Ke.push({x:t.c[0],z:t.c[2],R:t.rec.range+n,lod:ze.lodNear+n,far:t.pr?160:70+5*(t.rec.range+n),whole:t.rec,tiles:e.tiles?e.tiles.map(e=>e.e.rec):null})}for(let e of n){let t={kind:`rect`,avg:e.avg,c:e.c,n:e.n,w:e.w,h:e.h,tag:i+`Halo`};t.col=()=>{let e=We(t.avg);return He.setRGB(e.rgb[0],e.rgb[1],e.rgb[2],f).clone()},t.I=()=>{let n=We(t.avg);return ze.gain*ze.halo*Ue(n.m)*e.w*e.h},t.id=C.add({type:`point`,pos:e.c,color:t.col(),intensity:t.I(),range:Math.min(22,3+.8*Math.max(e.w,e.h)),radius:.3*Math.min(e.w,e.h),volume:0}),Be.push(t)}for(let e of t){let t={kind:`point`,I:()=>e.I*ze.point};t.id=C.add({type:`point`,pos:e.p,color:e.col,intensity:t.I(),range:e.range,radius:.3,volume:e.volume}),Be.push(t)}o.emitters=h.length,o.boards=g.length}}var Ke=[];C.addProvider((e,t)=>{if(E.value<.01||!Ke.length)return;let n=t.position.x,r=t.position.z,i=0;for(let t=0;t<Ke.length;t++){let a=Ke[t],o=a.x-n,s=a.z-r;if(Math.abs(o)>256+a.R||Math.abs(s)>256+a.R)continue;let c=o*o+s*s;if(!(c>a.far*a.far)){if(a.tiles&&c<a.lod*a.lod){for(let t=0;t<a.tiles.length;t++)e(a.tiles[t]);i+=a.tiles.length}else e(a.whole),i++}}ze.emitted=i});function qe(e,t,n=0,r=1,i=0,a=1){let o=t[0]+(t[2]-t[0])*n,s=t[0]+(t[2]-t[0])*r,c=t[1]+(t[3]-t[1])*i,l=t[1]+(t[3]-t[1])*a,u=Math.max(0,Math.floor(Math.min(o,s)*e.width)),d=Math.min(e.width,Math.max(u+1,Math.round(Math.max(o,s)*e.width))),f=Math.max(0,Math.floor((1-Math.max(c,l))*e.height)),p=Math.min(e.height,Math.max(f+1,Math.round((1-Math.min(c,l))*e.height))),m=0,h=0,g=0,_=0;for(let t=f;t<p;t+=1)for(let n=u;n<d;n+=1){let r=(t*e.width+n)*3;m+=e.linearRgb[r]??0,h+=e.linearRgb[r+1]??0,g+=e.linearRgb[r+2]??0,_+=1}return _?[m/_,h/_,g/_]:null}var Je={value:2},Ye={value:-.18},Xe=()=>({uScreenK:D,uNightK:E,uScrBoost:Je,uScrDesat:Ye,uScrKnee:$e,uScrTop:et}),Ze=Re.uniformDeclarations,Qe=Re.gainExpression,$e={value:.28},et={value:.46};typeof window<`u`&&Object.assign(window.__screenLights,{uScrBoost:Je,uScrKnee:$e,uScrTop:et});var tt=T(Re.highlightShoulder,Qe);function nt(t,n){t.userData.nightGain=1;let r=t.onBeforeCompile;t.onBeforeCompile=function(t,n){r&&r!==e.prototype.onBeforeCompile&&r.call(this,t,n),Object.assign(t.uniforms,Xe()),t.fragmentShader=t.fragmentShader.replace(`#include <common>`,T(Re.fragmentCommon,Ze)).replace(`#include <lights_fragment_begin>`,T(Re.fragmentLightsBegin,Qe,tt))};let i=t.customProgramCacheKey;return t.customProgramCacheKey=function(){return(i?i.call(this):``)+`|scrNight|`+n},t}var rt=`// hero shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
uniform mat4 uTexMat;\r
out vec4 vRefl;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vRefl = uTexMat * (modelMatrix * vec4(transformed, 1.0));\r
// @section fragmentCommon\r
#include <common>\r
uniform sampler2D tRefl;\r
uniform float uReflOn;\r
uniform vec2 uTexel;\r
in vec4 vRefl;\r
// @section fragmentPhysicalLights\r
#include <lights_physical_fragment>\r
material.specularColor = vec3(0.6);\r
// @section fragmentLightsMaps\r
#include <lights_fragment_maps>\r
if(uReflOn > 0.5) {\r
vec2 ruv = vRefl.xy / vRefl.w;\r
vec2 o1 = uTexel * vec2(0.75, 0.35), o2 = uTexel * vec2(- 0.35, 0.75);\r
vec4 pr = 0.25 * (texture(tRefl, ruv + o1, 0.6) + texture(tRefl, ruv - o1, 0.6) + texture(tRefl, ruv + o2, 0.6) + texture(tRefl, ruv - o2, 0.6));\r
vec2 e = smoothstep(0.0, 0.04, ruv) * smoothstep(1.0, 0.96, ruv);\r
// the mirror render carries no aerial perspective: pull it toward the sky/env radiance (haze), and keep a\r
// share of the sky reflection even over the reflected geometry (coated glass reads sky-bright, as in ref 2)\r
vec3 mirrored = mix(pr.rgb, radiance, 0.25);\r
radiance = mix(radiance, mirrored, 0.75 * clamp(pr.a, 0.0, 1.0) * e.x * e.y * step(0.0, vRefl.w));\r
}\r
`,it=`// buildings shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in float aPart;\r
flat out float vPart;\r
out vec3 vWP;\r
out vec3 vWN;\r
out vec2 vUv2;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vPart = aPart;\r
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vWN = normalize(mat3(modelMatrix) * objectNormal);\r
vUv2 = uv;\r
// @section fragmentCommon\r
#include <common>\r
uniform sampler2D tNoise;\r
__SHADER_INJECT_0__ flat in float vPart;\r
in vec3 vWP;\r
in vec3 vWN;\r
in vec2 vUv2;\r
float dR;\r
float dM;\r
vec3 dN;\r
// @section fragmentColor\r
#include <color_fragment>\r
{\r
int P = int(vPart + 0.5);\r
vec3 N = normalize(vWN);\r
vec2 tp = abs(N.y) > 0.6 ? vWP.xz : (abs(N.x) > abs(N.z) ? vWP.zy : vWP.xy);\r
vec3 nz = texture(tNoise, tp / 7.0).rgb, nz2 = texture(tNoise, tp / 1.3).rgb;\r
dR = 0.7;\r
dM = 0.0;\r
dN = vec3(0.0, 0.0, 1.0);\r
float grime = smoothstep(0.35, 0.8, nz.r) * 0.35 + (1.0 - smoothstep(0.0, 0.6, fract(vWP.y) + nz2.g * 0.2)) * 0.0;\r
if(P == 0) {\r
dR = 0.45 + 0.3 * nz2.g;\r
dM = 0.2;\r
diffuseColor.rgb *= 1.0 - grime * 0.5;\r
          // rain streaks on painted sheet metal\r
if(abs(N.y) < 0.5) diffuseColor.rgb *= 1.0 - 0.25 * smoothstep(0.55, 0.9, texture(tNoise, vec2(tp.x * 0.9, tp.y * 0.05)).g);\r
} else if(P == 1) { // timber staves (vertical boards) weathered\r
float st = fract(vUv2.x * 48.0);\r
float seam = smoothstep(0.0, 0.06, st) * smoothstep(1.0, 0.94, st);\r
float board = fract(sin(floor(vUv2.x * 48.0) * 91.7) * 4375.5);\r
diffuseColor.rgb *= (0.75 + 0.35 * board) * mix(0.55, 1.0, seam) * (0.8 + 0.4 * nz2.b);\r
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.88, 0.9, 0.88), smoothstep(0.4, 0.9, nz.g));\r
dR = 0.85;\r
dN = normalize(vec3((1.0 - seam) * sign(st - 0.5) * 0.6, 0.0, 1.0));\r
} else if(P == 2) {\r
dR = 0.5 + 0.3 * nz2.r;\r
dM = 0.7;\r
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.25, 0.92, 0.75), smoothstep(0.55, 0.85, nz2.g) * 0.5);\r
} else if(P == 3) {\r
dR = 0.06 + 0.25 * smoothstep(0.5, 0.9, nz2.g);\r
dM = 0.0;\r
diffuseColor.rgb = mix(vec3(0.02, 0.025, 0.03), vec3(0.2), smoothstep(0.6, 0.95, nz2.g) * 0.5);\r
} else if(P == 4) {\r
dR = 0.9;\r
diffuseColor.rgb *= 0.9 + 0.2 * nz2.b;\r
} else if(P == 5) {\r
dR = 0.85;\r
diffuseColor.rgb *= 0.9 + 0.15 * nz2.r;\r
} else if(P == 6) {\r
dR = 0.35 + 0.25 * nz2.g;\r
dM = 0.85;\r
} else if(P == 7) {\r
dR = 0.8;\r
diffuseColor.rgb *= 0.9 + 0.2 * nz2.b;\r
diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.5, 0.9, nz.g);\r
} else if(P == 8) {\r
dR = 0.85;\r
} else if(P == 10) { // thin steel (rails, masts, bracing): dithered fade 90-170 m (TAA resolves it; no sub-pixel crawl)\r
dR = 0.5 + 0.3 * nz2.r;\r
dM = 0.7;\r
float fd = smoothstep(90.0, 170.0, length(cameraPosition - vWP));\r
if(fd > 0.0 && fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) < fd) discard;\r
} else if(P == 9) { // steel bar grating (fire-escape decks): 3 mm bearing bars every 3 cm, cross rods every 10 cm\r
dM = 0.6;\r
dR = 0.55 + 0.25 * nz2.r;\r
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.2, 0.92, 0.75), smoothstep(0.55, 0.85, nz2.g) * 0.4);\r
if(abs(N.y) > 0.6) {\r
vec2 q = vWP.xz;\r
vec2 fw = fwidth(q);\r
vec2 pitch = vec2(0.03, 0.10);\r
// bars along the longer deck axis: pick the axis with more variation of the part... use world x\r
float bx = abs(fract(q.x / pitch.x) - 0.5) * pitch.x, bz = abs(fract(q.y / pitch.y) - 0.5) * pitch.y;\r
float onBar = max(step(pitch.x * 0.5 - 0.004, bx), step(pitch.y * 0.5 - 0.004, bz));\r
float fine = max(fw.x / pitch.x, fw.y / pitch.y);\r
if(fine < 0.25) {\r
if(onBar < 0.5) discard;\r
} else { // (textures r4) critic: 'fire escapes are solid black slabs'. Past the bar resolution the deck stays\r
// see-through: dithered coverage at the grating's true open fraction (~65 %), resolved by TAA\r
float dth = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));\r
if(dth < 0.62 * (1.0 - smoothstep(1.5, 4.0, fine) * 0.4)) discard;\r
}\r
}\r
}\r
diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.85); // muted palette\r
}\r
// @section fragmentRoughness\r
float roughnessFactor = dR;\r
// @section fragmentMetalness\r
float metalnessFactor = dM;\r
// @section fragmentNormalMaps\r
#include <normal_fragment_maps>\r
{\r
vec3 Nw = normalize(vWN);\r
vec3 Tw = abs(Nw.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), Nw));\r
vec3 Bw = cross(Nw, Tw);\r
vec3 nw = normalize(Tw * dN.x + Bw * dN.y + Nw * dN.z);\r
if(dN.z < 0.999) normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);\r
}\r
`,at=`// props shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in vec4 aPuff;\r
uniform float uTime;\r
out float vFade;\r
out vec2 vPuv;\r
out float vAge;\r
// @section vertexBeginNormalVertex\r
vec3 objectNormal = normalize(vec3(0.0, 0.8, 0.0) + normalize(cameraPosition - aPuff.xyz));\r
#ifdef USE_TANGENT\r
vec3 objectTangent = vec3(1.0, 0.0, 0.0);\r
#endif\r
// @section vertexBeginVertex\r
\r
float ph = fract(uTime * 0.11 + aPuff.w);\r
float lowV = aPuff.y < -1.0 ? 1.0 : 0.0;                  // (street r7) manhole wisp (vent y = -2.5): thinner, lower\r
float h = 5.5 * (1.0 - (1.0 - ph) * (1.0 - ph)) * (1.0 - 0.35 * lowV); // decelerating rise (~5.5 m)\r
float rad = mix(0.5, 3.0, sqrt(ph)) * (1.0 - 0.45 * lowV);\r
vec2 wind = vec2(0.8, 0.35) * (ph * ph * 3.2);\r
vec3 c = aPuff.xyz + vec3(wind.x + sin(aPuff.w * 40.0 + uTime * 0.6) * 0.35 * ph, 2.55 + h, wind.y + sin(aPuff.w * 23.0 + uTime * 0.4) * 0.5 * ph);\r
vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);\r
vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);\r
float rot = aPuff.w * 17.0 + uTime * 0.12;\r
vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;\r
vec3 transformed = c + (camR * q.x * 1.25 + camU * q.y) * rad;\r
float dCam = length(cameraPosition - c);\r
vFade = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.25, 1.0, ph)) * (1.0 - smoothstep(160.0, 320.0, dCam)) * smoothstep(0.6, 2.5, dCam);                              // fade out when the lens is inside a puff\r
vAge = ph;\r
vPuv = uv * 0.45 + fract(vec2(aPuff.w * 3.1, aPuff.w * 7.7) + vec2(uTime * 0.01, - uTime * 0.03));\r
// @section vertexProjectVertex\r
vec4 mvPosition = viewMatrix * vec4(transformed, 1.0);\r
gl_Position = projectionMatrix * mvPosition;\r
// @section vertexWorldPositionVertex\r
vec4 worldPosition = vec4(transformed, 1.0);\r
// @section fragmentCommon\r
#include <common>\r
in float vFade;\r
in vec2 vPuv;\r
in float vAge;\r
// @section fragmentAlphaMap\r
{\r
float n = texture(alphaMap, vPuv).g * 0.55 + texture(alphaMap, vPuv * 2.7 + 0.37).r * 0.45;\r
float r = length(vAlphaMapUv - 0.5) * 2.0;\r
float disc = 1.0 - smoothstep(0.1, 1.0, r);\r
disc *= disc;\r
diffuseColor.a *= vFade * 0.3 * disc * smoothstep(0.25, 0.75, n + disc * 0.2 - vAge * 0.15);\r
if(diffuseColor.a < 0.008) discard;\r
}\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
totalEmissiveRadiance += diffuseColor.rgb * 0.06;\r
// @section vertexCommonByFaceUv\r
#include <common>\r
in vec4 aCell;\r
out vec2 vFaceUv;\r
// @section vertexUvVertex\r
#include <uv_vertex>\r
vFaceUv = uv;\r
vMapUv = aCell.xy + vec2(uv.y, 1.0 - uv.x) * aCell.zw; // text runs up the face\r
// @section vertexProjectVertexGrassFarCull\r
#include <project_vertex>\r
{\r
vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;\r
vec2 dd = ip.xz - cameraPosition.xz;\r
if(dot(dd, dd) > 90000.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);\r
} // beyond the blade frames' far cull (300 m)\r
// @section fragmentCommonByFaceUv\r
#include <common>\r
in vec2 vFaceUv;\r
uniform float uScreenK;\r
uniform float uNightK;\r
// @section fragmentEmissiveByFaceUv\r
#include <emissivemap_fragment>\r
{ // lit from inside: centre brightest, rim ~55 % (tubes behind the face); ~day level by day, x2.2 at night (screenK\r
          // cancels the preset exposure): a white board tops out ~0.13 pre-exposure = ~170 sRGB at night\r
float ex = min(vFaceUv.x, 1.0 - vFaceUv.x) * 2.0, ey = min(vFaceUv.y, 1.0 - vFaceUv.y) * 2.0 * 2.3;\r
float lit = 0.55 + 0.45 * smoothstep(0.0, 0.8, min(ex, ey));\r
          // (night r6) at night the board colour is lifted by a power curve on its peak channel (m^0.45): dark navy / green\r
          // boards glow ~110-150 sRGB while white glyphs stay ~0.75 of clip (critic r6: 'unlit painted boards' at x2.2 linear)\r
vec3 bt = diffuseColor.rgb;\r
float bm = max(max(bt.r, bt.g), bt.b) + 1e-4;\r
vec3 bNight = bt / bm * pow(bm, 0.45) * 2.0;\r
totalEmissiveRadiance += mix(bt * 0.5, bNight, uNightK) * lit * uScreenK;\r
}\r
// @section vertexCommonByGain\r
#include <common>\r
in vec4 aCell;\r
in float aGain;\r
out float vGain;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vGain = aGain;\r
// @section vertexUvVertexByEmissiveMapUv\r
#include <uv_vertex>\r
#ifdef USE_MAP\r
vMapUv = aCell.xy + uv * aCell.zw;\r
#endif\r
#ifdef USE_EMISSIVEMAP\r
vEmissiveMapUv = vMapUv;\r
#endif\r
// @section fragmentCommonByGain\r
#include <common>\r
in float vGain;\r
uniform float uNightK;\r
// @section fragmentEmissiveByGain\r
#include <emissivemap_fragment>\r
totalEmissiveRadiance *= mix(vGain, max(vGain, 0.25), uNightK) / 0.06; // (night r9) rooftop prints floodlit at night\r
// @section fragmentMap\r
#include <map_fragment>\r
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), 0.18) * 0.9 + 0.012;\r
// @section vertexCommonByPitCameraPosition\r
#include <common>\r
out vec3 vPitL;\r
out vec3 vPitCam;\r
// @section vertexProjectVertexByPitCameraPosition\r
#include <project_vertex>\r
vPitL = position;\r
        #ifdef USE_INSTANCING\r
vPitCam = (inverse(modelMatrix * instanceMatrix) * vec4(cameraPosition, 1.0)).xyz;\r
        #else\r
vPitCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;\r
        #endif\r
// @section fragmentCommonByPitCameraPosition\r
#include <common>\r
uniform mat4 projectionMatrix;\r
in vec3 vPitL;\r
in vec3 vPitCam;\r
// @section fragmentClipping\r
#include <clipping_planes_fragment>\r
{\r
float h = vPitCam.y;\r
if(h < 0.04) discard;\r
float den = max(h - vPitL.y, 1e-3);\r
float tA = (h - 0.035) / den, tB = (h - 0.006) / den;\r
vec3 Q = vPitCam + (vPitL - vPitCam) * tB;\r
if(abs(Q.x) > 2.27 || abs(Q.z) > 0.83) discard;\r
float k = clamp(- vPitL.y / 4.0, 0.0, 1.0);\r
vec3 Pv = - vViewPosition;\r
vec4 cq = projectionMatrix * vec4(Pv * mix(tA, tB, k), 1.0);\r
vec4 cp = projectionMatrix * vec4(Pv, 1.0);\r
float nz = cq.z / cq.w, pz = cp.z / cp.w;\r
bool zeroOne = abs(gl_FragCoord.z - pz) < abs(gl_FragCoord.z - (0.5 * pz + 0.5));\r
gl_FragDepth = zeroOne ? nz : 0.5 * nz + 0.5;\r
}\r
`;function ot(){let e=document.createElement(`canvas`);e.width=e.height=512;let t=e.getContext(`2d`),n=ce(777);for(let e=0;e<4;e++){let r=e%2*256,i=Math.floor(e/2)*256,a=[],o=e===3?7:3;for(let e=0;e<=12;e++)a.push([r+10+236*e/12,i+10+(n()-.5)*o]);for(let e=1;e<=12;e++)a.push([r+256-10+(n()-.5)*o,i+10+236*e/12]);for(let e=11;e>=0;e--)a.push([r+10+236*e/12,i+256-10+(n()-.5)*o]);for(let e=11;e>=1;e--)a.push([r+10+(n()-.5)*o,i+10+236*e/12]);t.beginPath(),a.forEach(([e,n],r)=>r?t.lineTo(e,n):t.moveTo(e,n)),t.closePath();let s=[.36,.62,.34,.6][e];t.fillStyle=e===1?`rgba(132,132,130,0.36)`:e===3?`rgba(116,116,114,0.3)`:`rgba(22,24,27,${s})`,t.fill(),t.save(),t.clip();for(let e=0;e<900;e++){let e=r+n()*256,a=i+n()*256,o=.6+n()*1.6;t.fillStyle=n()<.5?`rgba(120,120,118,${.08+n()*.1})`:`rgba(10,10,12,${.1+n()*.15})`,t.fillRect(e,a,o,o)}for(let e=0;e<6;e++){let e=t.createRadialGradient(r+n()*256,i+n()*256,2,r+n()*256,i+n()*256,40+n()*60);e.addColorStop(0,`rgba(140,140,138,0.10)`),e.addColorStop(1,`rgba(140,140,138,0)`),t.fillStyle=e,t.fillRect(r,i,256,256)}t.restore(),t.lineWidth=5,t.strokeStyle=`rgba(8,8,9,0.55)`,t.stroke(),t.lineWidth=2,t.strokeStyle=`rgba(150,150,146,0.22)`,t.stroke()}let r=new a(e);return r.colorSpace=s,r.anisotropy=8,r}function st({scene:e}){let t=ce(9011),r=[],i=[],a=[],s=0,c=(e,t,n,o,c,l)=>{let u=c%2/2,d=Math.floor(c/2)/2,f=.5,p=[[u,d],[u+f,d],[u+f,d+f],[u,d+f]];l&&(p=[p[1],p[2],p[3],p[0]]);let m=[[e,o],[n,o],[n,t],[e,t]];for(let e=0;e<4;e++)r.push(m[e][0],.008,m[e][1]),i.push(...p[e]);a.push(s,s+1,s+2,s,s+2,s+3),s+=4},l=Se;for(let e=0;e<re.length;e++){let n=re[e];for(let r=0;r+1<se.length;r++){if(!de(e,r))continue;let i=se[r]+N(r)+9,a=se[r+1]-N(r+1)-9,o=7+Math.floor(t()*6);for(let e=0;e<o;e++){let e=t(),r,o,s,u;if(e>.62&&e<.78){let e=n+(t()-.5)*16,r=1.2+t()*2.2,o=3+t()*6,s=i+t()*Math.max(1,a-i-o-3),u=Math.floor(t()*4),d=(t()<.5?-1:1)*(1.4+t()*2.2),f=1+t()*1.4,p=s+t()*o*.6,m=1.2+t()*2;for(let[t,i,a,h]of[[e-r/2,s,e+r/2,s+o],[Math.min(e,e+d)-f/2,p,Math.max(e,e+d)+f/2,p+m]]){let e=Math.max(t,n-I.AV_HALF+.2),r=Math.min(a,n+I.AV_HALF-.2);r-e<.5||r>l.x0&&e<l.x1&&h>l.z0&&i<l.z1||c(e,i,r,h,u,h-i>r-e)}continue}if(e<.5){let e=Math.floor(t()*6),c=n-9+e*3.6+(t()-.5)*.8,l=.9+t()*1.6,d=4+t()*9,f=i+t()*Math.max(1,a-i-d);r=c-l/2,o=c+l/2,s=f,u=f+d}else if(e<.8){let e=n+(t()-.5)*18,c=1+t()*1.8,l=1.8+t()*4.2,d=i+t()*(a-i-l);r=e-c/2,o=e+c/2,s=d,u=d+l}else if(e<.88){let e=2+Math.floor(t()*2),c=Math.floor(t()*(7-e)),l=7+t()*9,d=i+t()*Math.max(1,a-i-l);r=n-I.AV_HALF+.5+c*3.5,o=r+e*3.5,s=d,u=d+l}else{let e=t()<.5?-1:1,c=5+t()*5,l=.9+t()*.8,d=i+t()*(a-i-l);r=e<0?n-I.AV_HALF+.3:n+I.AV_HALF-.3-c,o=r+c,s=d,u=d+l}if(r=Math.max(r,n-I.AV_HALF+.2),o=Math.min(o,n+I.AV_HALF-.2),o-r<.5||u<=s||o>l.x0&&r<l.x1&&u>l.z0&&s<l.z1)continue;let d=Math.floor(t()*4);(e<.5||e>=.8&&e<.88)&&!(d&1)&&Math.abs(Math.sin(r*12.9898+s*78.233)*43758.5453)%1<.65&&d++,c(r,s,o,u,d,u-s>o-r)}}}for(let e=0;e<se.length;e++){let n=se[e];for(let r=0;r<2*re.length+1;r+=2){let i=M(e,r);if(!i)continue;let[a,o]=i;if(!(o-a<30||t()<.15))for(let r=0,i=2+Math.floor(t()*3);r<i;r++){let r=1.5+t()*6,i=1+t()*2.8,s=a+8+t()*(o-a-16-r),l=n-N(e)+.3+t()*(2*N(e)-.6-i);c(s,l,s+r,l+i,Math.floor(t()*4),!1)}}}let u=new v;u.setAttribute(`position`,new o(r,3)),u.setAttribute(`normal`,new o(Array(s).fill(0).flatMap(()=>[0,1,0]),3)),u.setAttribute(`uv`,new o(i,2)),u.setIndex(new n(a,1)),u.computeBoundingSphere();let d=new b({map:ot(),transparent:!0,depthWrite:!1,roughness:.8,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),f=new p(u,d);return f.name=`roadPatches`,f.receiveShadow=!0,f.renderOrder=0,e.add(f),f}var q={MH_A:0,MH_B:1,PLATE:2,GRATE:3,OIL_A:4,OIL_B:5,TAR_A:6,TAR_B:7,DRIP:8,GUTTER:9,AO:10,STAIN:11,BLOT:12};function ct(){let e=document.createElement(`canvas`);e.width=e.height=1024;let t=e.getContext(`2d`),n=ce(4711),r=(e,n)=>{t.save(),t.translate(e%4*256,Math.floor(e/4)*256),t.beginPath(),t.rect(0,0,256,256),t.clip(),n(),t.restore()},i=(e,r,i,a=.5,o=0,s=0,c=256,l=256)=>{for(let u=0;u<e;u++){let e=o+n()*c,u=s+n()*l,d=.6+n()*1.8;t.fillStyle=n()<a?`rgba(150,145,138,${r+n()*(i-r)})`:`rgba(8,8,9,${r+n()*(i-r)})`,t.fillRect(e,u,d,d)}},o=(e,n,r,i,a=`10,10,12`)=>{let o=t.createRadialGradient(e,n,0,e,n,r);o.addColorStop(0,`rgba(${a},${i})`),o.addColorStop(.6,`rgba(${a},${i*.5})`),o.addColorStop(1,`rgba(${a},0)`),t.fillStyle=o,t.fillRect(e-r,n-r,2*r,2*r)};for(let[e,a]of[[q.MH_A,!1],[q.MH_B,!0]])r(e,()=>{if(t.fillStyle=`rgba(12,12,13,0.55)`,t.beginPath(),t.arc(128,128,124,0,7),t.fill(),t.fillStyle=`rgba(52,48,44,0.97)`,t.beginPath(),t.arc(128,128,112,0,7),t.fill(),t.strokeStyle=`rgba(96,74,52,0.9)`,t.lineWidth=7,t.beginPath(),t.arc(128,128,109,0,7),t.stroke(),t.save(),t.beginPath(),t.arc(128,128,100,0,7),t.clip(),t.strokeStyle=`rgba(120,116,108,0.75)`,t.lineWidth=3,a){for(let e=22;e<100;e+=17)t.beginPath(),t.arc(128,128,e,0,7),t.stroke();for(let e=0;e<16;e++){let n=e/16*Math.PI*2;t.beginPath(),t.moveTo(128+Math.cos(n)*22,128+Math.sin(n)*22),t.lineTo(128+Math.cos(n)*100,128+Math.sin(n)*100),t.stroke()}t.fillStyle=`rgba(40,38,35,0.95)`,t.fillRect(68,116,120,24),t.fillStyle=`rgba(130,125,115,0.7)`;for(let e=0;e<9;e++)t.fillRect(74+e*12.5,121,8,14)}else for(let e=-100;e<100;e+=13)for(let r=-100;r<100;r+=13)(e/13+r/13)%2==0&&(t.fillStyle=`rgba(118,114,106,${.45+n()*.3})`,t.fillRect(128+e,128+r,9,9));o(128+(n()-.5)*80,128+(n()-.5)*80,70,.35,`70,48,30`),i(500,.1,.3,.4),t.restore()});r(q.PLATE,()=>{t.fillStyle=`rgba(58,56,53,0.96)`,t.fillRect(6,6,244,244),t.strokeStyle=`rgba(105,100,92,0.55)`,t.lineWidth=2;for(let e=10;e<246;e+=10)for(let n=10+(e%20?5:0);n<246;n+=10)t.beginPath(),t.moveTo(n-3,e-3),t.lineTo(n+3,e+3),t.stroke();for(let e=0;e<5;e++)o(20+n()*216,20+n()*216,30+n()*50,.35,`92,58,32`);t.strokeStyle=`rgba(15,15,16,0.85)`,t.lineWidth=6,t.strokeRect(6,6,244,244),i(600,.1,.3)}),r(q.GRATE,()=>{t.fillStyle=`rgba(30,29,28,0.97)`,t.fillRect(10,60,236,136),t.fillStyle=`rgba(5,5,6,0.95)`;for(let e=26;e<230;e+=16)t.fillRect(e,74,8,108);t.strokeStyle=`rgba(88,80,70,0.8)`,t.lineWidth=6,t.strokeRect(12,62,232,132),o(128,128,120,.3)}),r(q.OIL_A,()=>{for(let e=0;e<14;e++)o(128+(n()-.5)*120,128+(n()-.5)*170,18+n()*45,.16+n()*.14);i(300,.05,.15,.2,40,30,176,196)}),r(q.OIL_B,()=>{for(let e=0;e<26;e++)o(30+n()*196,30+n()*196,6+n()*22,.18+n()*.2)});for(let e of[q.TAR_A,q.TAR_B])r(e,()=>{t.strokeStyle=`rgba(6,6,7,0.62)`,t.lineCap=`round`,t.lineJoin=`round`;let r=e===q.TAR_A?2:5;for(let i=0;i<r;i++){let r=n()*256,i=0,a=Math.PI/2+(n()-.5)*.6;t.lineWidth=4+n()*4,t.beginPath(),t.moveTo(r,i),e===q.TAR_B&&(r=n()*256,i=n()*256,t.moveTo(r,i),a=n()*7);for(let e=0;e<40;e++)a+=(n()-.5)*.7,r+=Math.cos(a)*8,i+=Math.sin(a)*8,t.lineTo(r,i);t.stroke()}});r(q.DRIP,()=>{let e=t.createLinearGradient(0,0,256,0);e.addColorStop(0,`rgba(10,10,12,0)`),e.addColorStop(.3,`rgba(10,10,12,0.1)`),e.addColorStop(.5,`rgba(10,10,12,0.22)`),e.addColorStop(.7,`rgba(10,10,12,0.1)`),e.addColorStop(1,`rgba(10,10,12,0)`),t.fillStyle=e,t.fillRect(0,0,256,256);for(let e=0;e<90;e++)o(128+(n()-.5)*70,n()*256,3+n()*9,.15+n()*.2);for(let e of[30.72,225.28]){let n=t.createLinearGradient(e-20,0,e+20,0);n.addColorStop(0,`rgba(120,120,122,0)`),n.addColorStop(.5,`rgba(120,120,122,0.07)`),n.addColorStop(1,`rgba(120,120,122,0)`),t.fillStyle=n,t.fillRect(e-20,0,40,256)}let r=t.createLinearGradient(0,0,0,256);r.addColorStop(0,`rgba(0,0,0,1)`),r.addColorStop(.15,`rgba(0,0,0,0)`),r.addColorStop(.85,`rgba(0,0,0,0)`),r.addColorStop(1,`rgba(0,0,0,1)`),t.globalCompositeOperation=`destination-out`,t.fillStyle=r,t.fillRect(0,0,256,256),t.globalCompositeOperation=`source-over`}),r(q.GUTTER,()=>{let e=t.createLinearGradient(0,0,256,0);e.addColorStop(0,`rgba(14,13,12,0.5)`),e.addColorStop(.25,`rgba(14,13,12,0.32)`),e.addColorStop(.7,`rgba(14,13,12,0.08)`),e.addColorStop(1,`rgba(14,13,12,0)`),t.fillStyle=e,t.fillRect(0,0,256,256);for(let e=0;e<40;e++)o(n()*256*.5,n()*256,8+n()*24,.12+n()*.12);for(let e=0;e<260;e++){let e=n()*256*.35,r=n()*256;t.fillStyle=n()<.5?`rgba(${110+n()*40},${80+n()*30},${40+n()*20},0.5)`:`rgba(170,165,155,${.2+n()*.3})`,t.fillRect(e,r,1+n()*3,1+n()*3)}}),r(q.AO,()=>{let e=t.createLinearGradient(0,0,256,0);e.addColorStop(0,`rgba(10,9,8,0.62)`),e.addColorStop(.12,`rgba(10,9,8,0.4)`),e.addColorStop(.45,`rgba(10,9,8,0.12)`),e.addColorStop(1,`rgba(10,9,8,0)`),t.fillStyle=e,t.fillRect(0,0,256,256);for(let e=0;e<30;e++)o(n()*256*.25,n()*256,6+n()*18,.1)}),r(q.STAIN,()=>{for(let e=0;e<10;e++)o(30+n()*196,30+n()*196,15+n()*40,.08+n()*.08);for(let e=0;e<160;e++)t.fillStyle=`rgba(20,20,20,${.25+n()*.3})`,t.beginPath(),t.arc(n()*256,n()*256,1+n()*2,0,7),t.fill()}),r(q.BLOT,()=>{for(let e=0;e<8;e++)o(64+n()*128,64+n()*128,30+n()*60,.1+n()*.08,`22,20,18`)});let c=new a(e);return c.colorSpace=s,c.anisotropy=8,c}var lt=[];function ut({scene:e,buildings:t=null}){lt.length=0;let r=ce(31337),i=[],a=[],s=[],c=0,l=1/256,u=(e,t,n,r,o,u=[0,-1],d=.01)=>{let f=e%4/4+l,p=1-(Math.floor(e/4)+1)/4+l,m=.25-2*l,[h,g]=u,_=-g,v=h,y=[[-r,-o],[r,-o],[r,o],[-r,o]],b=[[f,p],[f+m,p],[f+m,p+m],[f,p+m]];for(let e=0;e<4;e++)i.push(t+_*y[e][0]+h*y[e][1],d,n+v*y[e][0]+g*y[e][1]),a.push(...b[e]);s.push(c,c+1,c+2,c,c+2,c+3),c+=4},d=Se,f=(e,t)=>e>d.x0-.5&&e<d.x1+.5&&t>d.z0-.5&&t<d.z1+.5,m=(e,t)=>{let n=ie(e,t).type;return(n===`avenue`||n===`street`||n===`intersection`)&&!f(e,t)},h=(e,t,n,i,a,o,s=[0,-1],c=.3,l=.01)=>{for(let d=n;d<i-2;){let n=Math.min(o*(.7+r()*.6),i-d);r()>c&&m(t,d+n/2)&&u(e,t,d+n/2,a,n/2,s,l),d+=n+r()*3}};for(let e=0;e<re.length;e++){let t=re[e];for(let n=0;n+1<se.length;n++){if(!de(e,n))continue;let i=se[n]+N(n)+1.5,a=se[n+1]-N(n+1)-1.5;if(a-i<10)continue;for(let e of[-1,1])for(let n=0;n<3;n++){let o=t+e*(.2+I.AV_LANE*n+I.AV_LANE/2)+(r()-.5)*.3;if(h(q.DRIP,o,i+2,a-2,n===2?.7:.8,11,[0,-1],n===2?.55:.3),n<2){for(let[e,t]of[[i+3,1],[a-3,-1]])if(r()<.75){let n=e+t*(1.5+r()*4);u(r()<.5?q.OIL_A:q.OIL_B,o+(r()-.5)*.4,n,.9+r()*.4,1.6+r()*.8)}}}for(let e of[-1,1]){let n=t+e*(I.AV_HALF-.4);h(q.GUTTER,n,i-1,a+1,.4,16,[0,e],.05,.0095);for(let n of[i+1.5,a-1.5])r()<.7&&u(q.GRATE,t+e*(I.AV_HALF-.35),n,.5,.35,[e,0],.011)}let o=2+Math.floor(r()*3);for(let e=0;e<o;e++){let n=t+(r()-.5)*16,o=i+4+r()*(a-i-8);m(n,o)&&(u(r()<.6?q.MH_A:q.MH_B,n,o,.48,.48,[Math.cos(e),Math.sin(e)],.0105),lt.push([n,o]))}if(r()<.3){let e=t+(r()-.5)*12,n=i+6+r()*(a-i-12);m(e,n)&&u(q.PLATE,e,n,1.2,.8+r()*.6,[0,-1],.0105)}for(let e of[se[n]+N(n)+2.3,se[n+1]-N(n+1)-2.3])for(let n of[-1,1])for(let i=0;i<3;i++){if(r()<.3)continue;let a=t+n*(.2+I.AV_LANE*i+I.AV_LANE/2)+(r()-.5)*.4;m(a,e)&&u(q.DRIP,a,e,1.1+r()*.3,2.4,[0,-1],.013)}for(let e=0,n=1+Math.floor(r()*3);e<n;e++){let e=t+(r()-.5)*18,n=i+5+r()*(a-i-10);m(e,n)&&u(r()<.5?q.TAR_A:q.TAR_B,e,n,2+r()*2,3+r()*4,r()<.5?[0,-1]:[1,0])}}}for(let e=0;e<se.length;e++){let t=se[e];for(let n=0;n<2*re.length+1;n+=2){let i=M(e,n);if(!i)continue;let[a,o]=i,s=a+1.5,c=o-1.5;if(!(c-s<12)){for(let n=s+2;n<c-2;){let i=Math.min(18*(.7+r()*.6),c-n);r()>.15&&m(n+i/2,t)&&u(q.DRIP,n+i/2,t+(r()-.5)*.4,1.1,i/2,[1,0]);for(let a of[-1,1])r()>.05&&m(n+i/2,t+a*(N(e)-.4))&&u(q.GUTTER,n+i/2,t+a*(N(e)-.4),.4,i/2,[-a,0],.0095);n+=i+r()*2}for(let[e,n]of[[s+2,1],[c-2,-1]])r()<.6&&u(r()<.5?q.OIL_A:q.OIL_B,e+n*(2+r()*4),t+(r()-.5),1.6+r()*.8,.9+r()*.3,[1,0]);if(r()<.8){let e=s+6+r()*(c-s-12),n=t+(r()-.5)*4;m(e,n)&&(u(r()<.5?q.MH_A:q.MH_B,e,n,.48,.48,[0,-1],.0105),lt.push([e,n]))}if(r()<.35){let e=s+6+r()*(c-s-12);m(e,t)&&u(q.TAR_B,e,t+(r()-.5)*3,2.5,4,[1,0])}}}}for(let e=0;e<re.length;e++)for(let t=0;t<se.length;t++){let n=re[e],i=se[t];if(ie(n,i).type===`intersection`)for(let e=0,a=3+Math.floor(r()*4);e<a;e++){let e=n+(r()-.5)*(I.AV_HALF*1.6),a=i+(r()-.5)*(N(t)*1.4);if(!m(e,a))continue;let o=1.6+r()*2.2,s=r()*6.28;u(r()<.6?q.BLOT:q.OIL_A,e,a,o,o*(.7+r()*.5),[Math.cos(s),Math.sin(s)],.0102)}}let g=I.CURB_H+.006,_=(e,t)=>ie(e,t).type===`sidewalk`;if(t)for(let e of t)for(let t of e.masses||[]){if(t.y0>.2)continue;let e=[[t.x0,t.z0,t.x0,t.z1,-1,0],[t.x1,t.z0,t.x1,t.z1,1,0],[t.x0,t.z0,t.x1,t.z0,0,-1],[t.x0,t.z1,t.x1,t.z1,0,1]];for(let[t,n,i,a,o,s]of e){let e=Math.hypot(i-t,a-n);if(e<2)continue;let c=Math.max(1,Math.round(e/12)),l=e/c,d=(i-t)/e,f=(a-n)/e;for(let e=0;e<c;e++){let i=t+d*l*(e+.5),a=n+f*l*(e+.5);_(i+o*.6,a+s*.6)&&(u(q.AO,i+o*.55,a+s*.55,.55,l/2+.02,[s,-o],g),r()<.18?u(q.STAIN,i+o*(1.2+r()*1.6),a+s*(1.2+r()*1.6),1.2,1.2,[d,f],g+.001):r()<.12&&u(q.BLOT,i+o*(1.5+r()*1.5),a+s*(1.5+r()*1.5),1.5,1.5,[d,f],g+.001))}}}let y=new v;y.setAttribute(`position`,new o(i,3)),y.setAttribute(`normal`,new o(new Float32Array(c*3).map((e,t)=>+(t%3==1)),3)),y.setAttribute(`uv`,new o(a,2)),y.setIndex(new n(s,1)),y.computeBoundingSphere();let x=new b({map:ct(),transparent:!0,depthWrite:!1,roughness:.78,metalness:0,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),S=new p(y,x);return S.name=`streetGrime`,S.receiveShadow=!0,S.renderOrder=0,e.add(S),S}function dt(e){let t=[];if(!e)return t;for(let n of e){let e=n.lot;if(!e||!e.sides)continue;let r=(n.masses||[]).filter(e=>e.y0<.2);if(!r.length)continue;let i={x0:Math.min(...r.map(e=>e.x0)),x1:Math.max(...r.map(e=>e.x1)),z0:Math.min(...r.map(e=>e.z0)),z1:Math.max(...r.map(e=>e.z1))},a=[[`nx`,e.x0,e.z0,i.x0,e.z1,-1,0],[`px`,i.x1,e.z0,e.x1,e.z1,1,0],[`nz`,e.x0,e.z0,e.x1,i.z0,0,-1],[`pz`,e.x0,i.z1,e.x1,e.z1,0,1]];for(let[n,r,i,o,s,c,l]of a){if(e.sides[n]!==`street`)continue;let a=c?o-r:s-i,u=c?s-i:o-r;a<4.5||u<10||Math.abs((r+o)/2)<110&&(i+s)/2>-335&&(i+s)/2<10||t.push({x0:r,z0:i,x1:o,z1:s,nx:c,nz:l,W:a,L:u})}}return t}function ft(){let e=1024,t=document.createElement(`canvas`);t.width=t.height=e;let n=t.getContext(`2d`),r=ce(3131);n.fillStyle=`#6d6a64`,n.fillRect(0,0,e,e);let i=204.8;for(let t=0;t<10;t++)for(let a=-1;a<6;a++){let o=a*i+t%2*i/2,s=t*102.4,c=136+(r()-.5)*30,l=(r()-.5)*10,u=r()<.08?.78:1,d=(c+l)*u,f=(c+l*.4)*u,p=(c-l*.6-4)*u,m=e=>{n.fillStyle=`rgb(${d|0},${f|0},${p|0})`,n.fillRect(o+e+2,s+2,200.8,98.4)};m(0),m(e),m(-1024)}for(let t=0;t<26e3;t++){let t=r()<.5?40:220;n.fillStyle=`rgba(${t},${t},${t},${.05+r()*.08})`,n.fillRect(r()*e,r()*e,1+r()*1.5,1+r()*1.5)}for(let t=0;t<260;t++){n.fillStyle=`rgba(35,33,30,${.25+r()*.3})`;let t=1.5+r()*3;n.beginPath(),n.arc(r()*e,r()*e,t,0,7),n.fill()}for(let t=0;t<22;t++){let t=r()*e,i=r()*e,a=40+r()*140,o=n.createRadialGradient(t,i,2,t,i,a);o.addColorStop(0,`rgba(40,36,30,${.1+r()*.12})`),o.addColorStop(1,`rgba(40,36,30,0)`),n.fillStyle=o,n.fillRect(0,0,e,e)}let o=new a(t);return o.wrapS=o.wrapT=d,o.colorSpace=s,o.anisotropy=8,o}function pt({scene:e,strips:t}){if(!t.length)return null;let r=[],i=[],a=[],s=0,c=I.CURB_H+.004,l=[],u=(e,t)=>{if(t.x0>=e.x1||t.x1<=e.x0||t.z0>=e.z1||t.z1<=e.z0)return[e];let n=[];t.z0>e.z0&&n.push({x0:e.x0,x1:e.x1,z0:e.z0,z1:t.z0}),t.z1<e.z1&&n.push({x0:e.x0,x1:e.x1,z0:t.z1,z1:e.z1});let r=Math.max(e.z0,t.z0),i=Math.min(e.z1,t.z1);return t.x0>e.x0&&n.push({x0:e.x0,x1:t.x0,z0:r,z1:i}),t.x1<e.x1&&n.push({x0:t.x1,x1:e.x1,z0:r,z1:i}),n};for(let e of t){let t=[{x0:e.x0,x1:e.x1,z0:e.z0,z1:e.z1}];if(oe)for(let e of l)t=t.flatMap(t=>u(t,e));l.push(e);let n=e.nx!==0;for(let e of t){if(e.x1-e.x0<.01||e.z1-e.z0<.01)continue;let t=[[e.x0,e.z1],[e.x1,e.z1],[e.x1,e.z0],[e.x0,e.z0]];for(let[e,a]of t)r.push(e,c,a),i.push(n?a/8:e/8,n?-e/8:-a/8);a.push(s,s+1,s+2,s,s+2,s+3),s+=4}}let d=new v;d.setAttribute(`position`,new o(r,3)),d.setAttribute(`normal`,new o(new Float32Array(s*3).map((e,t)=>+(t%3==1)),3)),d.setAttribute(`uv`,new o(i,2)),d.setIndex(new n(a,1)),d.computeBoundingSphere();let f=new b({map:ft(),roughness:.86,metalness:0,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),m=new p(d,f);return m.name=`plazaPaving`,m.receiveShadow=!0,e.add(m),m}var mt=`// flags shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in vec3 aTint;\r
uniform float uTime;\r
// @section vertexColorVertex\r
#include <color_vertex>\r
vColor.rgb *= aTint;\r
// @section vertexBeginVertex\r
#include <begin_vertex>\r
float w = (transformed.x - 0.35) / 2.1;\r
float ph = uTime * 5.0 - transformed.x * 2.6 + instanceMatrix[3].x * 0.37;\r
transformed.z += sin(ph) * 0.16 * w + sin(ph * 1.7 + 1.0) * 0.05 * w;\r
objectNormal = normalize(vec3(- cos(ph) * 0.3 * w, 0.0, 1.0));\r
`,ht=`// rooftops shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in vec4 aM;\r
in vec4 aE;\r
out vec2 vRUv;\r
flat out vec4 vM;\r
flat out vec4 vE;\r
out vec3 vRWP;\r
out vec3 vRWN;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vRUv = uv;\r
vM = aM;\r
vE = aE;\r
vRWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
vRWN = normalize(mat3(modelMatrix) * objectNormal);\r
// @section fragmentCommon\r
#include <common>\r
uniform highp sampler2DArray tRoofC;\r
uniform highp sampler2DArray tRoofN;\r
uniform sampler2D tNoiseR;\r
in vec2 vRUv;\r
flat in vec4 vM;\r
flat in vec4 vE;\r
in vec3 vRWP;\r
in vec3 vRWN;\r
float rR;\r
float rM;\r
vec3 rN;\r
const float ROUGH[__SHADER_INJECT_0__] = float[__SHADER_INJECT_1__](__SHADER_INJECT_2__);\r
const float PONDS[__SHADER_INJECT_3__] = float[__SHADER_INJECT_4__](__SHADER_INJECT_5__);\r
const float SEAM[__SHADER_INJECT_6__] = float[__SHADER_INJECT_7__](__SHADER_INJECT_8__);\r
const float TARP[__SHADER_INJECT_9__] = float[__SHADER_INJECT_10__](__SHADER_INJECT_11__);\r
float rHash(vec2 p) {\r
return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);\r
}\r
// @section fragmentColor\r
#include <color_fragment>\r
{\r
vec3 N = normalize(vRWN);\r
rR = 0.85;\r
rM = 0.0;\r
rN = vec3(0.0, 0.0, 1.0);\r
float cell = vM.x;\r
vec2 tuv = vRUv * vM.y;\r
vec3 nz = texture(tNoiseR, vRWP.xz / 70.0 + vRWP.y / 130.0).rgb;\r
vec3 nz2 = texture(tNoiseR, vRWP.xz / 13.0 + 0.37).rgb;\r
int ci = int(cell + 0.5);\r
if(cell > - 0.5) {\r
vec3 tc = texture(tRoofC, vec3(tuv, cell)).rgb;\r
diffuseColor.rgb *= tc;\r
rR = ROUGH[ci];\r
rN = texture(tRoofN, vec3(tuv, cell)).xyz * 2.0 - 1.0;\r
rN.xy *= 0.8;\r
}\r
if(vM.w > 0.5) { // rooftop pool water: dark teal, glossy, gentle ripples\r
float rip = texture(tNoiseR, vRWP.xz / 3.0).g;\r
diffuseColor.rgb = vec3(0.09, 0.3, 0.34) * (0.85 + 0.3 * rip);\r
rR = 0.08; // r4: lighter pool blue (ref 02 / 03) rN = normalize(vec3((rip - 0.5) * 0.15, 0.0, 1.0));\r
}\r
if(ci == __SHADER_INJECT_0__) diffuseColor.rgb *= 1.5; // r4: dusty, weathered rubber (pure black read as holes)\r
// macro tone variation (kills repetition across a roof)\r
diffuseColor.rgb *= (0.86 + 0.26 * nz.r) * (0.94 + 0.12 * nz2.g);\r
if(vM.z > 0.0) { // roof skin\r
// parapet grime: dark wet band at the base of the parapet, streaky, fading into the field\r
float d = min(min(vRUv.x - vE.x, vE.z - vRUv.x), min(vRUv.y - vE.y, vE.w - vRUv.y));\r
float ed = d + (nz2.b - 0.5) * 0.9;\r
diffuseColor.rgb *= mix(0.4, 1.0, smoothstep(0.0, vM.z * 2.2, ed)); // r4: deeper soot band\r
diffuseColor.rgb *= mix(vec3(0.93, 0.9, 0.84), vec3(1.0), smoothstep(0.0, vM.z * 4.0, ed)); // dust / rust-brown drift toward the walls\r
// r6: per-roof dirt gradient (roofs drain / collect soot toward one side) + drain sumps: dark wet blotches\r
{\r
vec2 rsz = max(vE.zw - vE.xy, vec2(1.0)), rc = (vRUv - vE.xy) / rsz;\r
float ang = rHash(floor(vE.xy * 0.37)) * 6.2832;\r
float gdt = dot(rc - 0.5, vec2(cos(ang), sin(ang)));\r
diffuseColor.rgb *= 1.0 - (0.08 + 0.12 * rHash(floor(vE.zw))) * smoothstep(- 0.55, 0.55, gdt);\r
vec2 dp = vE.xy + rsz * vec2(0.25 + 0.5 * rHash(floor(vE.xy) + 1.7), 0.25 + 0.5 * rHash(floor(vE.zw) + 2.9));\r
float dd = length(vRUv - dp) + (nz2.r - 0.5) * 1.6;\r
float sump = 1.0 - smoothstep(0.4, 2.6 + 1.5 * rHash(floor(vE.xy) + 4.1), dd);\r
diffuseColor.rgb *= 1.0 - 0.3 * sump;\r
rR = mix(rR, 0.35, sump * 0.6);\r
}\r
          // r4: sheets / rolls: per-sheet tone + dark lap seams (antialiased), end laps every ~12 m\r
if(ci >= 0 && ci < __SHADER_INJECT_1__ && SEAM[ci] > 0.0) {\r
float su = vRUv.x / SEAM[ci], sid = floor(su);\r
diffuseColor.rgb *= 0.92 + 0.16 * rHash(vec2(sid, floor(vE.x * 0.7)));\r
float fu = fract(su), fwu = max(fwidth(su), 1e-4);\r
float seam = 1.0 - smoothstep(0.0, fwu * 1.2 + 0.02, min(fu, 1.0 - fu));\r
float sv = (vRUv.y + rHash(vec2(sid, 3.7)) * 12.0) / 12.0, fv = fract(sv), fwv = max(fwidth(sv), 1e-4);\r
seam = max(seam, 0.7 * (1.0 - smoothstep(0.0, fwv * 1.2 + 0.004, min(fv, 1.0 - fv))));\r
diffuseColor.rgb *= 1.0 - 0.3 * seam * smoothstep(0.6, 0.15, fwu);\r
}\r
          // r4: hot-mopped tar patches (dark, semi-glossy blotches with crisp edges)\r
if(ci >= 0 && ci < __SHADER_INJECT_2__ && TARP[ci] > 0.5) {\r
float tpn = texture(tNoiseR, vRWP.xz / 7.0 + vec2(0.23, 0.71)).r * 0.65 + texture(tNoiseR, vRWP.zx / 29.0 + 0.5).g * 0.35;\r
float tp = smoothstep(0.64, 0.66, tpn);\r
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.28 + vec3(0.012), tp * 0.85);\r
rR = mix(rR, 0.5, tp);\r
}\r
          // world-space stains at three scales (non-repeating) : soot / algae / dust drifts\r
vec3 w1 = texture(tNoiseR, vRWP.xz / 41.0 + 0.13).rgb;\r
vec3 w2 = texture(tNoiseR, vRWP.zx / 17.0 + 0.71).rgb;\r
float stain = smoothstep(0.52, 0.8, w1.g * 0.55 + w2.r * 0.45);\r
diffuseColor.rgb *= 1.0 - 0.26 * stain;\r
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.03, 1.0, 0.95), smoothstep(0.55, 0.85, w2.b)); // rust / tannin tinge (r4: weaker, read green on grey)\r
          // repair patches: rectangles on a per-roof grid (uv already carries a per-roof random offset)\r
          // r4: only on membranes / coatings (not ballast or pavers), rarer and bigger (the small ones read as camo squares)\r
vec2 pg = vec2(6.0 + 3.0 * rHash(floor(vE.xy)), 4.5 + 3.0 * rHash(floor(vE.zw)));\r
vec2 pc = floor(vRUv / pg), pf = fract(vRUv / pg);\r
float ph = fract(sin(dot(pc, vec2(12.9898, 78.233)) + dot(floor(vE.xy), vec2(0.0137, 0.0291))) * 43758.5453);\r
vec2 pa = vec2(0.05 + 0.3 * rHash(pc + 3.1), 0.05 + 0.3 * rHash(pc + 7.7)), pb = vec2(0.6 + 0.35 * rHash(pc + 1.3), 0.55 + 0.4 * rHash(pc + 5.9));\r
if(ci >= 0 && ci < __SHADER_INJECT_3__ && TARP[ci] > 0.5 && ph < 0.07 && pf.x > pa.x && pf.y > pa.y && pf.x < pb.x && pf.y < pb.y) {\r
diffuseColor.rgb *= 0.7 + ph * 5.0;\r
rR = min(1.0, rR + 0.05);\r
}\r
          // ponding on flat membranes: dark, glossy puddle stains with a dried rim\r
if(ci >= 0 && ci < __SHADER_INJECT_4__ && PONDS[ci] > 0.5) {\r
float pw = texture(tNoiseR, vRWP.xz / 9.0 + vec2(0.61, 0.27)).b * 0.7 + w1.r * 0.3;\r
float pond = smoothstep(0.66, 0.72, pw), rim = smoothstep(0.6, 0.66, pw) - pond;\r
diffuseColor.rgb *= (1.0 - 0.32 * pond) * (1.0 + 0.1 * rim);\r
rR = mix(rR, 0.18, pond);\r
rN = normalize(mix(rN, vec3(0.0, 0.0, 1.0), pond));\r
}\r
} else { // clutter: grime + contact darkening near the base, rain streaks on the sides\r
float hb = vRWP.y - vE.x;\r
diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.45, hb));\r
if(abs(N.y) < 0.5) {\r
diffuseColor.rgb *= 1.0 - 0.22 * smoothstep(0.55, 0.9, texture(tNoiseR, vec2((vRWP.x + vRWP.z) * 0.7, vRWP.y * 0.06)).g);\r
// r8: rust runs + weathering on sheet-metal housings (critic: "boxes look like primitive cubes, add rust")\r
if(ci == __SHADER_INJECT_5__ || ci == __SHADER_INJECT_6__) {\r
float rn = texture(tNoiseR, vec2((vRWP.x - vRWP.z) * 1.7 + 0.13, vRWP.y * 0.09 + 0.41)).r * 0.7 + nz2.b * 0.3;\r
diffuseColor.rgb *= mix(vec3(1.0), vec3(0.86, 0.7, 0.55), smoothstep(0.58, 0.82, rn) * 0.75);\r
}\r
} else if(vM.w < 0.5) { // tops: dusty, blotchy, a rust bloom here and there (sun-lit clean tops read as white dice)\r
float tb = texture(tNoiseR, vRWP.xz / 2.3 + 0.57).g;\r
diffuseColor.rgb *= (0.9 + 0.16 * tb) * mix(vec3(1.0), vec3(0.9, 0.8, 0.68), smoothstep(0.66, 0.86, nz2.r) * 0.6);\r
}\r
if(ci == __SHADER_INJECT_7__ || ci == __SHADER_INJECT_8__) rM = 0.2;\r
}\r
diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.64); // muted (r3: 0.82 -> 0.64, critic: saturated colour cards)\r
}\r
// @section fragmentRoughness\r
float roughnessFactor = rR;\r
// @section fragmentMetalness\r
float metalnessFactor = rM;\r
// @section fragmentNormalMaps\r
#include <normal_fragment_maps>\r
{\r
vec3 Nw = normalize(vRWN);\r
vec3 Tw, Bw;\r
if(abs(Nw.y) > 0.5) {\r
Tw = vec3(1.0, 0.0, 0.0);\r
Bw = vec3(0.0, 0.0, - 1.0);\r
} else {\r
Tw = normalize(cross(vec3(0.0, 1.0, 0.0), Nw));\r
Bw = vec3(0.0, 1.0, 0.0);\r
}\r
vec3 nw = normalize(Tw * rN.x + Bw * rN.y + Nw * rN.z);\r
if(rN.z < 0.9999) normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);\r
}\r
// @section vertexCommonByRoofDistance\r
#include <common>\r
in vec4 aS;\r
in vec4 aT;\r
out vec4 vS;\r
out vec4 vT;\r
out float vSD;\r
// @section vertexFogVertexByRoofTrim\r
#include <fog_vertex>\r
vS = aS;\r
vT = aT;\r
vSD = length((modelViewMatrix * vec4(transformed, 1.0)).xyz);\r
// @section fragmentCommonByRoofTrim\r
#include <common>\r
uniform sampler2D tNoiseS;\r
in vec4 vS;\r
in vec4 vT;\r
in float vSD;\r
// @section fragmentColorByRoofDistance\r
#include <color_fragment>\r
{\r
float u = vS.x, d = vS.y, H = vS.z, k = vS.w;\r
float n1 = texture(tNoiseS, vec2(u / 11.0, 0.37)).r * 0.6 + texture(tNoiseS, vec2(u / 3.1, 0.71)).g * 0.4; // per-column run length\r
float n2 = texture(tNoiseS, vec2(u / 0.9, d / 70.0 + 0.13)).b * 0.7 + texture(tNoiseS, vec2(u / 0.37, d / 30.0 + 0.61)).r * 0.3; // fine streak columns\r
float len = H * (0.2 + 1.1 * smoothstep(0.3, 0.75, n1));\r
float fall = 1.0 - smoothstep(0.0, len, d);\r
float streak = smoothstep(0.44, 0.62, n2) * fall;\r
float band = (1.0 - smoothstep(0.0, 0.3 + 0.6 * n1, d));                                                  // drip line under the cap\r
float wash = (1.0 - smoothstep(0.0, H * 0.8, d));                                                          // general soiling under the cap\r
float dark = k * clamp(streak * 0.75 + band * 0.5 + wash * 0.2, 0.0, 0.8) * smoothstep(820.0, 450.0, vSD) * mix(0.35, 1.0, smoothstep(45.0, 200.0, vSD)); // (park r10) near walls: soot was crushing shaded facades to black at swing range\r
diffuseColor.rgb = vec3(1.0) - dark * vec3(0.8, 0.85, 0.93);                                               // brownish soot (multiplied)\r
        // r7: blank party walls (the big salmon brick slabs seen from above): per-wall hue, big weathering blotches,\r
        // patched / repointed brick rectangles and old tar roof-lines of demolished neighbours\r
if(vT.w > 0.0) {\r
float fd = smoothstep(900.0, 500.0, vSD);\r
vec3 tint = mix(vec3(1.0), vT.rgb, fd);\r
float b1 = texture(tNoiseS, vec2(u / 19.0 + 0.21, d / 23.0 + 0.47)).g, b2 = texture(tNoiseS, vec2(u / 6.0 + 0.6, d / 7.5 + 0.1)).r;\r
float blot = smoothstep(0.45, 0.8, b1 * 0.7 + b2 * 0.3);\r
vec2 pc = floor(vec2(u / 4.3, d / 3.1)), pf = fract(vec2(u / 4.3, d / 3.1));\r
float ph = fract(sin(dot(pc, vec2(12.9898, 78.233)) + vT.w * 17.0) * 43758.5453);\r
float patchv = (ph < 0.12 && pf.x > 0.1 && pf.y > 0.15 && pf.x < 0.9 && pf.y < 0.85) ? (0.8 + ph * 1.2) : 1.0;\r
float gl = fract(sin(vT.w * 91.7) * 4375.5) * H * 0.7 + 2.0;\r
float ghost = (1.0 - smoothstep(0.0, 0.25, abs(d - gl))) * step(0.5, fract(vT.w * 7.3));\r
diffuseColor.rgb *= tint * (1.0 - vT.w * fd * (0.28 * blot + 0.3 * ghost)) * mix(1.0, patchv, fd);\r
}\r
        // r8: canyon occlusion at the foot of street walls (vT.w < 0: quad from the ground up H metres): sky and bounce\r
        // light fall off toward the street, so the street gaps read as deep canyons from swinging altitude\r
if(vT.w < 0.0) {\r
float g = clamp(d / max(H, 1.0), 0.0, 1.0);\r
float wn = texture(tNoiseS, vec2(u / 9.0 + 0.3, d / 5.0 + 0.8)).g;\r
diffuseColor.rgb = vec3(1.0) - k * g * g * (0.85 + 0.3 * wn) * vec3(0.52, 0.54, 0.58) * smoothstep(1100.0, 500.0, vSD) * mix(0.45, 1.0, smoothstep(45.0, 200.0, vSD)); // (park r10) softer up close\r
}\r
}\r
`,gt=`// roofplants shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in vec4 aPlant; out vec3 vPTint; out float vPY;\r
// @section vertexUvVertex\r
#include <uv_vertex>\r
#ifdef USE_INSTANCING\r
{ float t = floor(aPlant.x + 0.5), d = floor(aPlant.x / 4.0 + 0.001); // aPlant.x = tile + 4 * geometry default tile\r
t = t - d * 4.0;\r
vec2 off = vec2(mod(t, 2.0), floor(t / 2.0)) * 0.5 - vec2(mod(d, 2.0), floor(d / 2.0)) * 0.5;\r
vMapUv += off; }\r
#endif\r
vPTint = aPlant.yzw; vPY = position.y;\r
// @section fragmentCommon\r
#include <common>\r
      in vec3 vPTint; in float vPY;\r
// @section fragmentMap\r
#include <map_fragment>\r
      diffuseColor.rgb *= vPTint * mix(0.55, 1.0, smoothstep(0.0, 0.6, vPY)); // tint + darker at the soil (self-shade)\r
`,_t=w(()=>gt),vt={SHRUB:0,GRASS:1,FLOWER:2,BROAD:3},yt=e=>[e%2*.5,Math.floor(e/2)*.5],bt=.006;function xt(e,t,n,r,i,a,o,s,c,l=.65){let u=e.length/3,[d,f]=yt(s),p=new S().crossVectors(a,o).normalize();for(let[r,s]of[[-1,-1],[1,-1],[1,1],[-1,1]]){let u=i.clone().addScaledVector(a,r).addScaledVector(o,s);e.push(u.x,u.y,u.z);let m=u.clone().sub(c).normalize().multiplyScalar(l).addScaledVector(p,(1-l)*Math.sign(p.dot(u.clone().sub(c))||1)).normalize();t.push(m.x,m.y,m.z),n.push(d+bt+(r+1)/2*(.5-2*bt),f+bt+(s+1)/2*(.5-2*bt))}r.push(u,u+1,u+2,u,u+2,u+3)}function St(e,t,n,r){let i=new v;return i.setAttribute(`position`,new o(e,3)),i.setAttribute(`normal`,new o(t,3)),i.setAttribute(`uv`,new o(n,2)),i.setIndex(r),i.computeBoundingSphere(),i}function Ct(){let e=[],t=[],n=[],r=[],i=(e,t,n)=>new S(e,t,n),a=i(0,.15,0);for(let o=0;o<3;o++){let s=o/3*Math.PI+.3;xt(e,t,n,r,i(0,.42,0),i(Math.cos(s),0,Math.sin(s)),i(0,.62,0),0,a)}xt(e,t,n,r,i(0,.72,0),i(.95,.06,0),i(0,.08,.95),0,a,.8);for(let o=0;o<6;o++){let s=o/6*Math.PI*2+.5,c=Math.cos(s),l=Math.sin(s),u=i(c*.55,.38+o%2*.1,l*.55),d=i(c,.9,l).normalize(),f=i(-l,0,c),p=new S().crossVectors(d,f).normalize();xt(e,t,n,r,u,f.multiplyScalar(.5),p.multiplyScalar(-.5),0,a)}return St(e,t,n,r)}function wt(){let e=[],t=[],n=[],r=[],i=(e,t,n)=>new S(e,t,n);for(let a=0;a<4;a++){let o=a/4*Math.PI+.2,s=a%2?.08:-.08;xt(e,t,n,r,i(Math.sin(o)*s,.5,-Math.cos(o)*s),i(Math.cos(o)*.5,0,Math.sin(o)*.5),i(0,.5,0),1,i(0,-.2,0),.5)}return St(e,t,n,r)}function Tt(e){let t=new b({map:e,alphaTest:.5,side:2,roughness:.85,metalness:0});return t.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,_t.vertexCommon).replace(`#include <uv_vertex>`,_t.vertexUvVertex),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,_t.fragmentCommon).replace(`#include <map_fragment>`,_t.fragmentMap)},t.customProgramCacheKey=()=>`roofplant-v1`,t}var Et=class{constructor(){this.items=[[],[]]}add(e,t,n,r,i,a,o,s){let c=+(a===vt.GRASS),l=+!!c;this.items[c].push({x:e,y:t,z:n,ry:s,s:1,scale3:c?[r*2,i,r*2]:[r,i,r],extra:{aPlant:[a+4*l,...o]}})}get count(){return this.items[0].length+this.items[1].length}build(e){if(!this.count)return;let t=Tt(new y);he(pe(`city/tex/roofplants.webp`)).then(e=>{e.colorSpace=s,e.anisotropy=4,t.map=e,t.needsUpdate=!0}).catch(e=>console.warn(`[roofplants] texture failed`,e)),this.pools=[Ct(),wt()].map((n,r)=>{let i=new fe(n,t,{max:9e3,far:210,shadowFar:55,extra:{aPlant:4},name:`roofplants-`+(r?`grass`:`mound`)});return i.items=this.items[r],i.mesh.userData.maxCascade=0,i.mesh.userData.smallCasters=!0,e.add(i.mesh),i})}update(e){if(this.pools)for(let t of this.pools)t.due(e)&&t.update(e)}},Dt=w(()=>ht),Ot=256,J={TAR:0,GRAVEL:1,TAN:2,MEMBRANE:3,BITUMEN:4,PAVERS:5,DECK:6,GREEN:7,METAL:8,PADS:9,RED:10,SILVER:11,EPDM:12,LAWN:13,LOUVRE:14,SOLAR:15,STAVES:16,GLASS:17,FAN:18},kt=[12,8,8,18,10,4.8,4.2,10,3,3.6,10,12,15,6,3,2,3,3,1],At=[.92,.95,.95,.6,.85,.85,.8,.95,.55,.9,.8,.5,.75,.95,.6,.22,.85,.12,.6],jt=[1,0,0,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,0],Mt=[0,0,0,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],Nt=[1,0,0,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,0],Pt={[J.TAR]:[O.ROOF,[.95,.95,.93]],[J.GRAVEL]:[O.ROOF_GRAVEL,[1,.98,.95]],[J.TAN]:[O.ROOF_GRAVEL,[1,.85,.7]],[J.MEMBRANE]:[O.ROOF_MEMBRANE,[.92,.92,.9]],[J.BITUMEN]:[O.ROOF,[1.1,1.1,1.08]],[J.PAVERS]:[O.ROOF_PAVERS,[1,.98,.94]],[J.DECK]:[O.ROOF_PAVERS,[.8,.62,.48]],[J.GREEN]:[O.ROOF_GREEN,[.8,.85,.75]],[J.RED]:[O.ROOF,[1.35,.85,.72]],[J.SILVER]:[O.ROOF_MEMBRANE,[.8,.8,.8]],[J.EPDM]:[O.ROOF,[.62,.62,.62]],[J.LAWN]:[O.ROOF_GREEN,[.85,.95,.8]]},Y=e=>[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255].map(e=>e**2.2),X=(e,t,n=.08)=>{let r=1+(t()-.5)*2*n;return e.map(e=>e*r)},Z=(e,t)=>e[Math.floor(t()*e.length)];function Ft(e){return G(e)}function It(e,t,n){let i=e.width,a=Math.round(e.height/e.width),o=document.createElement(`canvas`);o.width=i,o.height=e.height;let l=o.getContext(`2d`,{willReadFrequently:!0});l.drawImage(e,0,0);let u=l.getImageData(0,0,i,e.height).data,f=new Uint8Array(i*i*4*a);for(let e=0;e<a;e++)for(let t=0;t<i;t++){let n=(e*i+(i-1-t))*i*4;f.set(u.subarray(n,n+i*4),(e*i*i+t*i)*4)}let p=new m(f,i,i,a);return p.colorSpace=t?s:``,p.wrapS=p.wrapT=d,p.generateMipmaps=!0,p.minFilter=r,p.magFilter=c,p.anisotropy=n,p.needsUpdate=!0,p}function Lt(e,t,n){let r=new b({vertexColors:!0,roughness:.9,metalness:0}),i={tRoofC:{value:e},tRoofN:{value:t},tNoiseR:{value:n}};return r.onBeforeCompile=e=>{Object.assign(e.uniforms,i),e.vertexShader=e.vertexShader.replace(`#include <common>`,Dt.vertexCommon).replace(`#include <fog_vertex>`,Dt.vertexFogVertex),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,T(Dt.fragmentCommon,At.length,At.length,At.map(e=>e.toFixed(2)).join(`, `),jt.length,jt.length,jt.map(e=>e.toFixed(1)).join(`, `),Mt.length,Mt.length,Mt.map(e=>e.toFixed(1)).join(`, `),Nt.length,Nt.length,Nt.map(e=>e.toFixed(1)).join(`, `))).replace(`#include <color_fragment>`,T(Dt.fragmentColor,J.EPDM,Mt.length,Nt.length,Nt.length,jt.length,J.METAL,J.LOUVRE,J.SOLAR,J.GLASS)).replace(`#include <roughnessmap_fragment>`,Dt.fragmentRoughness).replace(`#include <metalnessmap_fragment>`,Dt.fragmentMetalness).replace(`#include <normal_fragment_maps>`,Dt.fragmentNormalMaps)},r.customProgramCacheKey=()=>`city-rooftops-v8`,r}var Rt=class{constructor(e=Float32Array,t=1024){this.T=e,this.a=new e(t),this.length=0}push(...e){if(this.length+e.length>this.a.length){let t=new this.T(Math.max(this.a.length*2,this.length+e.length));t.set(this.a),this.a=t}for(let t=0;t<e.length;t++)this.a[this.length++]=e[t]}out(e=this.T){return e===this.T?this.a.slice(0,this.length):e.from(this.a.subarray(0,this.length))}},zt=class{constructor(){this.p=new Rt,this.n=new Rt,this.uv=new Rt,this.c=new Rt,this.m=new Rt,this.e=new Rt,this.i=new Rt(Uint32Array),this.v=0}_v(e,t,n,r,i,a,o,s,c,l,u){return this.p.push(e,t,n),this.n.push(r,i,a),this.uv.push(o,s),this.c.push(c[0],c[1],c[2]),this.m.push(l[0],l[1],l[2],l[3]),this.e.push(u[0],u[1],u[2],u[3]),this.v++}skin(e,t,n,r,i,a,o,s,c,l,u=1.2){let d=1/kt[a],f=(e,t)=>l?[-t+s,-e+c]:[e+s,-t+c],p=f(e,t),m=f(n,r),h=[Math.min(p[0],m[0]),Math.min(p[1],m[1]),Math.max(p[0],m[0]),Math.max(p[1],m[1])],g=[a,d,u,0],_=[[e,r],[n,r],[n,t],[e,t]].map(([e,t])=>{let[n,r]=f(e,t);return this._v(e,i,t,0,1,0,n,r,o,g,h)});return this.i.push(_[0],_[1],_[2],_[0],_[2],_[3]),{x0:e,z0:t,x1:n,z1:r,y:i,U:f,M:g,E:h,col:o}}box(e,t,n,r,i,a,o,s,c=null,l=null,u=0){let d=[o,1/kt[o>=0?o:8],0,0],f=[t,0,0,0],p=[[[1,0,0],[[r,t,a],[r,t,n],[r,i,n],[r,i,a]],(e,t,n)=>[-n,t]],[[-1,0,0],[[e,t,n],[e,t,a],[e,i,a],[e,i,n]],(e,t,n)=>[n,t]],[[0,0,1],[[e,t,a],[r,t,a],[r,i,a],[e,i,a]],(e,t,n)=>[e,t]],[[0,0,-1],[[r,t,n],[e,t,n],[e,i,n],[r,i,n]],(e,t,n)=>[-e,t]]];for(let[e,t,n]of p){let r=t.map(([t,r,i])=>{let[a,o]=n(t,r,i);return this._v(t,r,i,e[0],e[1],e[2],a,o,s,d,f)});this.i.push(r[0],r[1],r[2],r[0],r[2],r[3])}if(c===!1)return;let m=l??o,h=[m,1/kt[m>=0?m:8],0,u],g=[[e,a],[r,a],[r,n],[e,n]].map(([e,t])=>this._v(e,i,t,0,1,0,e,-t,c??s,h,f));this.i.push(g[0],g[1],g[2],g[0],g[2],g[3])}obox(e,t,n,r,i,a,o,s=null,c=null){let l=[a,1/kt[a>=0?a:8],0,0],u=[c??e[1]-Math.abs(t[1]*r[1])-Math.abs(t[0]*n[1])-Math.abs(t[2]*i[1]),0,0,0],d=(a,o,s)=>[e[0]+n[0]*a*t[0]+r[0]*o*t[1]+i[0]*s*t[2],e[1]+n[1]*a*t[0]+r[1]*o*t[1]+i[1]*s*t[2],e[2]+n[2]*a*t[0]+r[2]*o*t[1]+i[2]*s*t[2]],f=[[n,1,`yz`],[n,-1,`yz`],[r,1,`xz`],[r,-1,`xz`],[i,1,`xy`],[i,-1,`xy`]];for(let[e,n,r]of f){let i;i=r===`yz`?[[n,-1,n],[n,-1,-n],[n,1,-n],[n,1,n]]:r===`xz`?[[-1,n,n],[1,n,n],[1,n,-n],[-1,n,-n]]:[[-n,-1,n],[n,-1,n],[n,1,n],[-n,1,n]];let a=r===`xz`&&n>0&&s?s:o,c=i.map(([i,o,s])=>{let c=d(i,o,s),f=r===`yz`?s*t[2]:i*t[0],p=r===`xz`?s*t[2]:o*t[1];return this._v(c[0],c[1],c[2],e[0]*n,e[1]*n,e[2]*n,f,p,a,l,u)});this.i.push(c[0],c[1],c[2],c[0],c[2],c[3])}}disc(e,t,n,r,i,a=10){let o=i===Jt,s=o?[J.FAN,1,0,0]:[-1,1,0,0],c=[t-1,0,0,0],l=o?[.42,.42,.42]:i;o&&(a=Math.max(a,12));let u=this._v(e,t,n,0,1,0,.5,.5,l,s,c),d=[];for(let i=0;i<=a;i++){let o=i/a*Math.PI*2;d.push(this._v(e+Math.cos(o)*r,t,n+Math.sin(o)*r,0,1,0,.5+Math.cos(o)*.5,.5-Math.sin(o)*.5,l,s,c))}for(let e=0;e<a;e++)this.i.push(u,d[e+1],d[e])}cyl(e,t,n,r,i,a,o=10,s=J.METAL,c=null){if(c===Jt&&o>=6){let o=i-r;this.lathe([e,r,t],[0,1,0],[[n,0],[n,o+.08],[n*.9,o+.08],[n*.9,o*.5]],12,a,s,{base:r-.5}),this.disc(e,r+o*.5,t,n*.9,Jt,12)}else this.lathe([e,r,t],[0,1,0],[[n,0],[n,i-r]],o,a,s,{cap:c??a,base:r})}lathe(e,t,n,r,i,a,o={}){let s=[a,1/kt[a>=0?a:8],0,0],c=[o.base??e[1],0,0,0],l=new S(...t).normalize(),u=Math.abs(l.y)<.9?new S(0,1,0):new S(1,0,0),d=new S().crossVectors(l,u).normalize(),f=new S().crossVectors(d,l),p=[];for(let t=0;t<n.length;t++){let[a,u]=n[t],m=n[Math.max(0,t-1)],h=n[Math.min(n.length-1,t+1)],g=h[0]-m[0],_=h[1]-m[1],v=Math.hypot(g,_)||1,y=_/v,b=-g/v,x=[];for(let t=0;t<=r;t++){let n=(o.rot0??0)+t/r*Math.PI*2,p=Math.cos(n),m=Math.sin(n),h=d.x*p+f.x*m,g=d.y*p+f.y*m,_=d.z*p+f.z*m,v=[e[0]+h*a+l.x*u,e[1]+g*a+l.y*u,e[2]+_*a+l.z*u],S=[h*y+l.x*b,g*y+l.y*b,_*y+l.z*b];x.push(this._v(v[0],v[1],v[2],S[0],S[1],S[2],n*Math.max(a,.3),u,i,s,c))}p.push(x)}for(let e=0;e+1<p.length;e++)for(let t=0;t<r;t++){let n=p[e][t],r=p[e][t+1],i=p[e+1][t],a=p[e+1][t+1];this.i.push(r,n,i,r,i,a),o.back&&this.i.push(r,i,n,r,a,i)}if(o.back,o.cap){let[t,i]=n[n.length-1];if(t>.001){let n=[e[0]+l.x*i,e[1]+l.y*i,e[2]+l.z*i],a=this._v(n[0],n[1],n[2],l.x,l.y,l.z,n[0],-n[2],o.cap,s,c),u=[];for(let e=0;e<=r;e++){let i=(o.rot0??0)+e/r*Math.PI*2,a=Math.cos(i),p=Math.sin(i),m=[n[0]+(d.x*a+f.x*p)*t,n[1]+(d.y*a+f.y*p)*t,n[2]+(d.z*a+f.z*p)*t];u.push(this._v(m[0],m[1],m[2],l.x,l.y,l.z,m[0],-m[2],o.cap,s,c))}for(let e=0;e<r;e++)this.i.push(a,u[e+1],u[e])}}}build(){if(!this.v)return null;let e=new v;return e.setAttribute(`position`,new t(this.p.out(),3)),e.setAttribute(`normal`,new t(this.n.out(),3)),e.setAttribute(`uv`,new t(this.uv.out(),2)),e.setAttribute(`color`,new t(this.c.out(),3)),e.setAttribute(`aM`,new t(this.m.out(),4)),e.setAttribute(`aE`,new t(this.e.out(),4)),e.setIndex(new t(this.i.out(this.v>65535?Uint32Array:Uint16Array),1)),e.computeBoundingSphere(),e.computeBoundingBox(),e}},Bt=class{constructor(){this.p=new Rt,this.c=new Rt,this.i=new Rt(Uint32Array),this.v=0}_v(e,t,n,r){return this.p.push(e,t,n),this.c.push(r**.92,r,r**1.12),this.v++}ring(e,t,n,r,i,a,o,s=null){let c=t-a,l=n-a,u=r+a,d=i+a;s&&(c=Math.max(c,s.x0),l=Math.max(l,s.z0),u=Math.min(u,s.x1),d=Math.min(d,s.z1));let f=e+.02,p=this._v(t,f,n,o),m=this._v(r,f,n,o),h=this._v(r,f,i,o),g=this._v(t,f,i,o),_=this._v(c,f,l,1),v=this._v(u,f,l,1),y=this._v(u,f,d,1),b=this._v(c,f,d,1);this.i.push(_,p,m,_,m,v,v,m,h,v,h,y,y,h,g,y,g,b,b,g,p,b,p,_)}band(e,t,n,r,i,a,o){(r-t<2*a+.5||i-n<2*a+.5)&&(a=Math.min(r-t,i-n)*.3);let s=e+.02,c=this._v(t,s,n,o),l=this._v(r,s,n,o),u=this._v(r,s,i,o),d=this._v(t,s,i,o),f=this._v(t+a,s,n+a,1),p=this._v(r-a,s,n+a,1),m=this._v(r-a,s,i-a,1),h=this._v(t+a,s,i-a,1);this.i.push(c,f,p,c,p,l,l,p,m,l,m,u,u,m,h,u,h,d,d,h,f,d,f,c)}build(){if(!this.v)return null;let e=new v;return e.setAttribute(`position`,new t(this.p.out(),3)),e.setAttribute(`color`,new t(this.c.out(),3)),e.setIndex(new t(this.i.out(this.v>65535?Uint32Array:Uint16Array),1)),e.computeBoundingSphere(),e}},Vt=class{constructor(){this.p=new Rt,this.s=new Rt,this.t=new Rt,this.i=new Rt(Uint32Array),this.v=0}wall(e,t,n,r,i,a,o,s,c,l,u=[1,1,1],d=0){let f=.03,p=Math.hypot(n-e,r-t);if(p<1||s<1)return;let m=e+i*f,h=t+a*f,g=n+i*f,_=r+a*f,v=[[m,o,h,l,0],[g,o,_,l+p,0],[g,o-s,_,l+p,s],[m,o-s,h,l,s]],y=this.v;for(let[e,t,n,r,i]of v)this.p.push(e,t,n),this.s.push(r,i,s,c),this.t.push(u[0],u[1],u[2],d),this.v++;this.i.push(y,y+1,y+2,y,y+2,y+3)}build(){if(!this.v)return null;let e=new v;return e.setAttribute(`position`,new t(this.p.out(),3)),e.setAttribute(`aS`,new t(this.s.out(),4)),e.setAttribute(`aT`,new t(this.t.out(),4)),e.setIndex(new t(this.i.out(this.v>65535?Uint32Array:Uint16Array),1)),e.computeBoundingSphere(),e}};function Ht(e){let t=new x({color:16777215,blending:4,premultipliedAlpha:!0,transparent:!0,depthWrite:!1,toneMapped:!1,fog:!1,side:2});return t.onBeforeCompile=t=>{t.uniforms.tNoiseS={value:e},t.vertexShader=t.vertexShader.replace(`#include <common>`,Dt.vertexCommonByRoofDistance).replace(`#include <fog_vertex>`,Dt.vertexFogVertexByRoofTrim),t.fragmentShader=t.fragmentShader.replace(`#include <common>`,Dt.fragmentCommonByRoofTrim).replace(`#include <color_fragment>`,Dt.fragmentColorByRoofDistance)},t.customProgramCacheKey=()=>`city-roof-streaks-v3`,t}var Ut=te.indexOf(`watertower`),Wt=te.indexOf(`bulkhead`),Gt=te.indexOf(`equipment`),Kt=class{constructor(e,t=2.5){this.C=16,this.h=new Map;let n=e.b;for(let r=0;r<e.t.length;r++){let i=r*6;n[i+4]<t||this._ins(n[i],n[i+1],n[i+2],n[i+3],n[i+4],n[i+5],e.k[r],e.t[r])}}_ins(e,t,n,r,i,a,o=-1,s=0){let c=this.C,l=[e,t,n,r,i,a,o,s];for(let t=Math.floor(e/c);t<=Math.floor(r/c);t++)for(let e=Math.floor(n/c);e<=Math.floor(a/c);e++){let n=t*100003+e,r=this.h.get(n);r||this.h.set(n,r=[]),r.push(l)}}hit(e,t,n,r,i,a=4){let o=this.C;for(let s=Math.floor(e/o);s<=Math.floor(n/o);s++)for(let c=Math.floor(t/o);c<=Math.floor(r/o);c++){let o=this.h.get(s*100003+c);if(o){for(let s of o)if(s[4]>i+.05&&s[1]<i+a&&n>s[0]&&e<s[3]&&r>s[2]&&t<s[5])return!0}}return!1}on(e,t,n,r,i){let a=this.C,o=new Set;for(let s=Math.floor(e/a);s<=Math.floor(n/a);s++)for(let c=Math.floor(t/a);c<=Math.floor(r/a);c++){let a=this.h.get(s*100003+c);if(a)for(let s of a)Math.abs(s[1]-i)<.3&&s[0]>=e-.5&&s[3]<=n+.5&&s[2]>=t-.5&&s[5]<=r+.5&&o.add(s)}return[...o]}add(e,t,n,r,i,a,o=-1){this._ins(e,t,n,r,i,a,o)}},qt=[9079687,8159101,9868171,7633530,9209462,7172724,10395288,8357759,10787978,6252136,8622218,9076592].map(Y),Jt=Y(3948096),Yt=Y(11053737);Y(2831416);var Xt=Y(7303535);[5069363,6055480,7035444,4543537,7757882].map(Y);var Zt=Y(9077881),Qt=Y(8020040),$t=[14209730,3099196,8203813,2898514].map(Y),en=[5922400,4869455,7038560,4146246].map(Y),tn=[3947064,4867392,5991010,7232072].map(Y),nn=[12105390,10396834,9344652,12894130].map(Y),rn=Y(7227964),an=[6968384,5918792,8022616,9079430].map(Y),on=[8751239,7633272,9407362,6778479].map(Y),sn=[9079948,8014390,11048008,11842218,6122354,7040624].map(Y),cn=[10262664,7238760,9080716,11906710,8224632].map(Y),ln=[5198934,3947836,7226934,8016962,6709852,6185568,5662814,7236194,4736063].map(Y),un=[6052180,5131336,6709594,5723472,6973024,4867908].map(Y),dn=(e,t)=>{let n=.3,r={nx:Math.abs(e.x0-t.x0)<n?t.sides.nx:`setback`,px:Math.abs(e.x1-t.x1)<n?t.sides.px:`setback`,nz:Math.abs(e.z0-t.z0)<n?t.sides.nz:`setback`,pz:Math.abs(e.z1-t.z1)<n?t.sides.pz:`setback`};return e.sides&&Object.assign(r,e.sides),r},fn={deco:1,postwar:1,apt:1,loft:1},pn={[J.GRAVEL]:[J.MEMBRANE,J.BITUMEN,J.EPDM,J.SILVER],[J.PAVERS]:[J.GRAVEL,J.BITUMEN,J.MEMBRANE],[J.TAN]:[J.GRAVEL,J.BITUMEN,J.SILVER],[J.BITUMEN]:[J.GRAVEL,J.SILVER,J.MEMBRANE,J.TAR],[J.MEMBRANE]:[J.GRAVEL,J.BITUMEN,J.EPDM],[J.EPDM]:[J.MEMBRANE,J.GRAVEL,J.BITUMEN],[J.TAR]:[J.SILVER,J.BITUMEN,J.GRAVEL],[J.SILVER]:[J.TAR,J.BITUMEN,J.MEMBRANE],[J.RED]:[J.TAR,J.SILVER]},mn=[1.02,.99,.94],hn=[.92,.96,1],gn=[1,1,1];async function _n({scene:e,gen:t,facadeMat:n,T:r,renderer:a,extraRoofs:o=[]}){let s=k().lodScale,c=Math.min(8,a?.capabilities?.getMaxAnisotropy?.()??4),[l,u]=await Promise.all([Ft(pe(`city/tex/roof_col.png`)),Ft(pe(`city/tex/roof_nrm.png`))]),d=Lt(It(l,!0,c),It(u,!1,c),r.noise),f=new x({vertexColors:!0,blending:4,premultipliedAlpha:!0,transparent:!0,depthWrite:!1,toneMapped:!1,fog:!1}),p=Ht(r.noise),m=t.solids,g=t.zips,v=new Kt(m),y=new Map,b=(e,t)=>{let n=`${Math.floor(e/Ot)},${Math.floor(t/Ot)}`,r=y.get(n);return r||(r={rb:new zt,ao:new Bt,sk:new Vt,key:n,cx:(Math.floor(e/Ot)+.5)*Ot,cz:(Math.floor(t/Ot)+.5)*Ot},y.set(n,r)),r},S=new j(4242,{squash:.8}),C=new Et,w=[],T=ce(9133),E=[.085,.062,.045],D={[vt.SHRUB]:[.32,.6,.55,1.05],[vt.GRASS]:[.28,.45,.8,1.4],[vt.FLOWER]:[.28,.45,.45,.75],[vt.BROAD]:[.3,.5,.35,.65]},ee=(e,t,n,r,i=1)=>{let a=D[r],o=.82+T()*.3;C.add(e,t,n,(a[0]+T()*(a[1]-a[0]))*i,(a[2]+T()*(a[3]-a[2]))*i,r,[o*(.95+T()*.1),o*(.95+T()*.1),o*(.9+T()*.1)],T()*Math.PI*2)},te=e=>{let t=T()*e.reduce((e,t)=>e+t,0);for(let n=0;n<e.length;n++)if(t-=e[n],t<=0)return n;return 0},re=(e,t,n,r,i,a,o=1.9,s=1)=>{let c=n-e,l=r-t,u=Math.max(1,Math.min(18,Math.round(c*l*o))),d=Math.max(1,Math.round(Math.sqrt(u*c/l))),f=Math.max(1,Math.ceil(u/d));for(let n=0;n<d;n++)for(let r=0;r<f;r++){let o=e+(n+.2+T()*.6)/d*c,u=t+(r+.2+T()*.6)/f*l;ee(o,i-.04,u,te(a),s*Math.min(1,.55+.5*Math.min(c/d,l/f)))}},M={roofs:0,pent:0,mech:0,hvac:0,sky:0,chim:0,terr:0,pool:0,ct:0,wt:0,dish:0,ant:0,solar:0,garden:0,green:0,yard:0,clad:0,rail:0,arch:{}},ie=new Map,se=o.map(({rect:e,H:t})=>({hero:!0,H:t,A:{type:`postwar`,floorH:4},lot:{x0:e.x0,z0:e.z0,x1:e.x1,z1:e.z1,cx:(e.x0+e.x1)/2,cz:(e.z0+e.z1)/2,sides:{}},masses:[{x0:e.x0,z0:e.z0,x1:e.x1,z1:e.z1,y0:0,y1:t,parapet:0,p:{floorH:4,bayW:1.55,winW:.97,winH:.74,layer:O.CONCRETE,base:O.GRANITE,seed:42,margin:0,depth:.04,tint:[1,1,1],style:A.BLANK}}]}));for(let e of[...t.buildings,...se]){let n=e.A,r=e.masses;if(!r?.length)continue;e.roofKit=!0;let i=e.lot,a=ce(Math.floor(Math.abs(i.x0*73.1+i.z0*19.7+i.x1*3.3))+11),o=t.tile(i.cx,i.cz),s=b(i.cx,i.cz),c=s.rb,l=r.filter(e=>!e.crown),u=(l.length?l:r).reduce((e,t)=>t.y1>e.y1?t:e,(l.length?l:r)[0]),d=P(i.cx,i.cz),f=n.type,p=f===`apt`||f===`walkup`,h=e.H>85,_=wn(f,a,d,e.H),y=X(a()<.3?mn:a()<.4?hn:gn,a,.13).map((e,t,n)=>e*(t===0?n.k=.66+a()*.4:n.k)),x=a()*50,S=a()*50,C=a()<.5,D=i.sides||{},k=D.px===`street`&&D.nx!==`street`?-1:D.nx===`street`&&D.px!==`street`?1:a()<.5?-1:1,te=D.pz===`street`&&D.nz!==`street`?-1:D.nz===`street`&&D.pz!==`street`?1:a()<.5?-1:1,j=ce(Math.floor(Math.abs(i.x0*17.3+i.z0*41.9+i.z1*5.1))+977),se=(f===`glass`?.4:f===`walkup`||f===`loft`?1:f===`apt`?.9:.8)*(.6+j()*.5),N=ce(Math.floor(Math.abs(i.x0*29.3+i.z1*61.7+i.x1*7.9))+4049),le=`svc`;if(!e.hero&&e.H>12&&e.H<=85&&f!==`glass`){let t=f===`postwar`||f===`deco`?[[`garden`,.13],[`pool`,.13],[`tank`,.1],[`tar`,.17],[`sign`,.05]]:[[`garden`,.17],[`pool`,.09],[`tank`,.22],[`tar`,.2],[`sign`,.07]],n=()=>{let e=N();for(let[n,r]of t){if(e<r)return n;e-=r}return`svc`},r=ae(i.cx,i.cz),a=r?`${r.x0.toFixed(0)},${r.z0.toFixed(0)}`:``;le=n(),a&&ie.get(a)===le&&(le=n()),a&&ie.set(a,le),le===`sign`&&e.H>55&&(le=`tar`)}M.arch[le]=(M.arch[le]??0)+1;let ue=e=>e===u&&le!==`svc`;for(let l of r){if(l.crown){let e=l.p?.tint;if(e&&l.p.layer===O.CONCRETE&&e[1]>e[0]*1.25&&l.y1-l.y0<2.5){let e=.78+j()*.22,t=.012,n=X(Y(5201750),j,.05).map(t=>t*e),i=X(Y(7043440),j,.05).map(t=>t*e);if(c.box(l.x0-t,l.y0,l.z0-t,l.x1+t,l.y1+t,l.z1+t,J.METAL,n,i),l.y1>=Math.max(...r.map(e=>e.y1))-.01){let e=(l.x0+l.x1)/2,t=(l.z0+l.z1)/2,r=3+j()*5;c.box(e-.8,l.y1,t-.8,e+.8,l.y1+1.2,t+.8,J.METAL,n,i),c.cyl(e,t,.09,l.y1+1.2,l.y1+1.2+r,Y(5921884),6),m.box(e-.8,l.y1,t-.8,e+.8,l.y1+1.2,t+.8,`equipment`),m.cyl(e,t,l.y1+1.2,l.y1+1.2+r,.09,.09,`antenna`)}M.copper=(M.copper??0)+1}else if(l.y1-l.y0>2.5&&l.x1-l.x0>3&&l.z1-l.z0>3&&!l.round&&!l.pyr&&!r.some(e=>e!==l&&e.y0>=l.y1-.1&&e.x0<l.x1&&e.x1>l.x0&&e.z0<l.z1&&e.z1>l.z0)){let e=X(Z(ln,j),j,.06),t=.03;for(let[n,r,i,a]of[[l.x0-t,l.z0-t,l.x1+t,l.z0+.35],[l.x0-t,l.z1-.35,l.x1+t,l.z1+t],[l.x0-t,l.z0+.35,l.x0+.35,l.z1-.35],[l.x1-.35,l.z0+.35,l.x1+t,l.z1-.35]])c.box(n,l.y1-.45,r,i,l.y1+.35,a,J.METAL,e.map(e=>e*.8),e),m.box(n,l.y1-.45,r,i,l.y1+.35,a,`coping`);c.skin(l.x0+.35,l.z0+.35,l.x1-.35,l.z1-.35,l.y1+.006,j()<.5?J.TAR:J.GRAVEL,X([.8,.8,.8],j,.08),0,0,!1,.4);let n=(l.x0+l.x1)/2,r=(l.z0+l.z1)/2,i=j();if(i<.45&&Math.min(l.x1-l.x0,l.z1-l.z0)>4)xn(c,m,g,n,l.y1,r,5+j()*8,j);else if(i<.8){let e=Math.min(3,(l.x1-l.x0)*.4),t=Math.min(3,(l.z1-l.z0)*.4),i=1.6+j()*1.2,a=Z(on,j);c.box(n-e/2,l.y1,r-t/2,n+e/2,l.y1+i,r+t/2,J.LOUVRE,a,a.map(e=>e*.6),J.METAL),m.box(n-e/2,l.y1,r-t/2,n+e/2,l.y1+i,r+t/2,`equipment`),c.cyl(n+e/2+.5,r,.3,l.y1,l.y1+i+1.5,Y(6974572),8),m.cyl(n+e/2+.5,r,l.y1,l.y1+i+1.5,.3,.3,`equipment`)}M.crownDress=(M.crownDress??0)+1}continue}if(l.y0<.5&&l.y1>6&&i.sides){let e=dn(l,i),t=ne.WALK,n=Math.min(l.y1-1,9+Math.min(12,l.y1*.12)),r=(e,r,i,a,o,c)=>s.sk.wall(e,r,i,a,o,c,t+n,n,.55,(e+r)*.37,[1,1,1],-1);e.nz!==`party`&&r(l.x0,l.z0,l.x1,l.z0,0,-1),e.pz!==`party`&&r(l.x1,l.z1,l.x0,l.z1,0,1),e.nx!==`party`&&r(l.x0,l.z1,l.x0,l.z0,-1,0),e.px!==`party`&&r(l.x1,l.z0,l.x1,l.z1,1,0),s.ao.ring(t,l.x0,l.z0,l.x1,l.z1,2.4,.62)}if(r.some(e=>e!==l&&e.x0<=l.x0+.2&&e.x1>=l.x1-.2&&e.z0<=l.z0+.2&&e.z1>=l.z1-.2&&e.y0<=l.y1+.1&&e.y1>l.y1+.1))continue;let b=l.x1-l.x0,ie=l.z1-l.z0;if(b<3||ie<3)continue;let ae=l.parapet>0?.3:0,P={x0:l.x0+ae,z0:l.z0+ae,x1:l.x1-ae,z1:l.z1-ae},F=l.y1,I=l.y1+l.parapet,de=l===u,fe=f===`glass`||f===`postwar`&&e.H>70?v.on(l.x0,l.z0,l.x1,l.z1,l.y1).find(e=>e[6]===Gt&&e[7]===0&&e[3]-e[0]>5&&e[5]-e[2]>5&&e[4]-e[1]>4):null,pe=f===`glass`&&de&&l.parapet===0||!!fe,me=!de;M.roofs++;let he=[],ge=null,L=null,R=ue(l)?le:``,_e=R===`garden`||R===`pool`||!pe&&(me?a()<.6:f===`apt`&&a()<.45||(f===`walkup`||f===`loft`)&&a()<.22),ve=a(),z=h||(P.x1-P.x0)*(P.z1-P.z0)>380,ye=ve<.42?J.DECK:ve<.84?J.PAVERS:z?ve<.92?J.PAVERS:J.DECK:ve<.94?J.GREEN:J.LAWN;R===`garden`&&(ye=N()<.55?J.PAVERS:J.DECK),R===`pool`&&(ye=N()<.7?J.DECK:J.PAVERS);let be=_;if(me){let e=a();be=p||d.upper>.5||d.harlem>.5?e<.3?J.TAR:e<.5?J.BITUMEN:e<.68?J.GRAVEL:e<.8?J.EPDM:e<.9?J.PAVERS:J.SILVER:e<.32?J.GRAVEL:e<.52?J.PAVERS:e<.66?J.TAN:e<.8?J.BITUMEN:e<.9?J.EPDM:J.SILVER}pe&&(be=a()<.5?J.GRAVEL:a()<.6?J.PAVERS:J.BITUMEN),R===`tar`&&(be=Z([J.TAR,J.TAR,J.EPDM,J.BITUMEN],N));let xe=1;if(!pe&&r.length>1&&l!==u){let e=ce(Math.floor(Math.abs(l.x0*13.7+l.z0*71.3+l.y1*3.1))+61);e()<.7&&(be=Z(pn[be]??[J.GRAVEL,J.BITUMEN,J.TAR],e)),xe=.74+e()*.34}let Se=!pe&&!h&&!me&&(f===`loft`||f===`apt`||f===`postwar`)&&a()<.06&&!1;Se&&(be=J.GREEN,M.green++);let Ce=y.map(e=>e*xe*(me?.97:1)*(be===J.MEMBRANE?.76:1)*(h?.86:1));if(_e&&!Se&&Math.min(P.x1-P.x0,P.z1-P.z0)>6){let e=P.x1-P.x0>=P.z1-P.z0,t=a(),n=R?.55+N()*.25:.3+t*.25,r=e?k<0:te<0;if(e){let e=r?P.x1-(P.x1-P.x0)*n:P.x0+(P.x1-P.x0)*n;L=r?{x0:e,z0:P.z0,x1:P.x1,z1:P.z1}:{x0:P.x0,z0:P.z0,x1:e,z1:P.z1}}else{let e=r?P.z1-(P.z1-P.z0)*n:P.z0+(P.z1-P.z0)*n;L=r?{x0:P.x0,z0:e,x1:P.x1,z1:P.z1}:{x0:P.x0,z0:P.z0,x1:P.x1,z1:e}}let i=e?r?{...P,x1:L.x0}:{...P,x0:L.x1}:r?{...P,z1:L.z0}:{...P,z0:L.z1},o=X(ye===J.GREEN||ye===J.LAWN?[.86,.86,.8]:ye===J.PAVERS?[.84,.83,.81]:[1,1,1],a,.07);he.push(c.skin(L.x0,L.z0,L.x1,L.z1,F+.006,ye,o,x,S,C,.8)),he.push(c.skin(i.x0,i.z0,i.x1,i.z1,F+.006,be,Ce,x,S,C)),L.cell=ye,M.terr++}else if(!me&&!pe&&(P.x1-P.x0)*(P.z1-P.z0)>320&&Math.min(P.x1-P.x0,P.z1-P.z0)>12&&a()<.75){let e=P.x1-P.x0>=P.z1-P.z0,t=e?P.x0:P.z0,n=e?P.x1:P.z1,r=n-t>45&&a()<.5?3:2,i=[t];for(let e=1;e<r;e++)i.push(t+(n-t)*(e/r+(a()-.5)*.18));i.push(n);let o=pn[be]??[J.GRAVEL,J.BITUMEN];for(let t=0;t<r;t++){let n=t===0||a()<.3?be:Z(o,a),r=Ce.map(e=>e*(.86+a()*.24)*(n===J.MEMBRANE?.86:1)),[s,l]=[i[t],i[t+1]];if(he.push(e?c.skin(s,P.z0,l,P.z1,F+.006,n,r,x,S,C):c.skin(P.x0,s,P.x1,l,F+.006,n,r,x,S,C)),t>0){let[t,n,r,i]=e?[s-.14,P.z0,s+.14,P.z1]:[P.x0,s-.14,P.x1,s+.14];v.hit(t,n,r,i,F,.4)||(c.box(t,F,n,r,F+.2,i,J.METAL,X(Y(7237742),a,.08)),m.box(t,F,n,r,F+.2,i,`equipment`),v.add(t,F,n,r,F+.2,i))}}M.zoned=(M.zoned??0)+1}else he.push(c.skin(P.x0,P.z0,P.x1,P.z1,F+.006,be,Ce,x,S,C));if(!pe&&(R===`tar`||(be===J.TAR||be===J.BITUMEN||be===J.EPDM||be===J.MEMBRANE)&&N()<.3)){let e=(P.x1-P.x0)*(P.z1-P.z0),t=Math.min(R===`tar`?14:5,1+Math.floor(e/(R===`tar`?45:110)));for(let e=0;e<t;e++){let t=Math.min(P.x1-P.x0-.4,1.2+N()*5.5),n=Math.min(P.z1-P.z0-.4,.8+N()*4);if(t<.8||n<.6)break;let r=P.x0+.2+N()*(P.x1-P.x0-.4-t),i=P.z0+.2+N()*(P.z1-P.z0-.4-n);if(L&&r+t>L.x0&&r<L.x1&&i+n>L.z0&&i<L.z1)continue;let a=N(),o=a<.62?J.TAR:a<.85?J.EPDM:J.SILVER,s=o===J.SILVER?X([.85,.85,.83],N,.06):X([.5,.49,.47],N,.2);c.skin(r,i,r+t,i+n,F+.009+e*4e-4,o,s,N()*30,N()*30,N()<.5,.18)}M.patched=(M.patched??0)+1}if(l.parapet>0&&a()<.97){let e=n.cornice&&l.y0<.1?.1:.08,t=I+e+.015,r=ae+.03+.018,o=X(Z(ln,a),a,.07),s={nx:Math.abs(l.x0-i.x0)<.1&&D.nx===`party`,px:Math.abs(l.x1-i.x1)<.1&&D.px===`party`,nz:Math.abs(l.z0-i.z0)<.1&&D.nz===`party`,pz:Math.abs(l.z1-i.z1)<.1&&D.pz===`party`},u=e=>s[e]?.018:.04+.018,d=l.x0-u(`nx`),f=l.x1+u(`px`),p=l.z0-u(`nz`),m=l.z1+u(`pz`);for(let[n,i,a,s]of[[d,p,f,l.z0+r],[d,l.z1-r,f,m],[d,l.z0+r,l.x0+r,l.z1-r],[l.x1-r,l.z0+r,f,l.z1-r]]){let r=a-n>=s-i,l=r?n:i,u=r?a:s;for(let d=l;d<u-.01;){let l=Math.min(u,d+1.2+j()*2.8),f=j();if(f>.06){let u=f<.16?X(Y(3026219),j,.1):f<.22?X(Y(6965814),j,.1):o.map(e=>e*(.84+j()*.3));j();let p=t-.015-e-.012;r?c.box(d,p,i,l,t,s,J.METAL,u.map(e=>e*.85),u):c.box(n,p,d,a,t,l,J.METAL,u.map(e=>e*.85),u)}d=l}}M.cope=(M.cope??0)+1}if(l.parapet>0&&i.sides){let e=dn(l,i),t=(e,t,n,r)=>{let i=X(Z(un,j),j,.08),a;a=e===`nz`?[l.x0-r.nx,l.z0-t,l.x1+r.px,l.z0]:e===`pz`?[l.x0-r.nx,l.z1,l.x1+r.px,l.z1+t]:e===`nx`?[l.x0-t,l.z0,l.x0,l.z1]:[l.x1,l.z0,l.x1+t,l.z1];let o=.018,s=e===`nz`||e===`pz`,u=(s?a[0]:a[1])-o,d=(s?a[2]:a[3])+o;for(let t=u;t<d-.01;){let r=Math.min(d,t+2+j()*5),l=i.map(e=>e*(.82+j()*.3));s?c.box(t,n-.03,a[1]-(e===`nz`?o:0),r,n+o,a[3]+(e===`pz`?o:0),J.METAL,l.map(e=>e*.8),l):c.box(a[0]-(e===`nx`?o:0),n-.03,t,a[2]+(e===`px`?o:0),n+o,r,J.METAL,l.map(e=>e*.8),l),t=r}};if(n.cornice&&l.y0<.1){let n={};for(let t of[`nx`,`px`,`nz`,`pz`])n[t]=e[t]===`street`?.55:0;for(let r of[`nz`,`pz`,`nx`,`px`])e[r]===`street`&&t(r,.55,I+.1,n);M.ledge=(M.ledge??0)+1}else if(!l.crown&&I>28&&fn[f]&&Math.min(l.x1-l.x0,l.z1-l.z0)>8){let n=.34*(I>110?1.45:I>60?1:.7),r={};for(let t of[`nx`,`px`,`nz`,`pz`])r[t]=e[t]===`party`?0:n;for(let i of[`nz`,`pz`,`nx`,`px`])e[i]!==`party`&&t(i,n,I-.12,r);M.ledge=(M.ledge??0)+1}}if(de&&l.parapet>0&&(f===`walkup`||f===`loft`||f===`apt`)&&a()<.35){let e=[`nz`,`pz`,`nx`,`px`].filter(e=>D[e]===`street`&&Math.abs(e===`nx`?l.x0-i.x0:e===`px`?i.x1-l.x1:e===`nz`?l.z0-i.z0:i.z1-l.z1)<.1);if(e.length){let t=Z(e,a),r=t===`nz`||t===`pz`,i=r?l.x1-l.x0:l.z1-l.z0,s=Math.min(i*.55,3.5+a()*6),u=.7+a()*.9,d=I+(n.cornice&&l.y0<.1?.1:.08),f=d+u,p=(r?l.x0+l.x1:l.z0+l.z1)/2+(a()<.3?(a()-.5)*(i-s)*.6:0),[h,g,_,y]=r?[p-s/2,t===`nz`?l.z0:l.z1-ae,p+s/2,t===`nz`?l.z0+ae:l.z1]:[t===`nx`?l.x0:l.x1-ae,p-s/2,t===`nx`?l.x0+ae:l.x1,p+s/2];if(s>2.5&&!v.hit(h,g,_,y,d-.04,u)){let e={...l.p,style:A.BLANK,topY:f};o.fac.box(h,d,g,_,f,y,e,{},!1);let t=X(Z(ln,a),a,.06);c.box(h-.04,f,g-.04,_+.04,f+.08,y+.04,J.METAL,t.map(e=>e*.85),t),m.box(h,d,g,_,f,y,`parapet`),m.box(h-.04,f,g-.04,_+.04,f+.08,y+.04,`coping`),v.add(h,d,g,_,f+.08,y),M.ppanel=(M.ppanel??0)+1}}}if(l.y1-l.y0>3){let e=I+.1,t=Math.min(l.y1-l.y0,(me?2.5:3.5)+j()*(h?30:10)),n=()=>se*(.7+j()*.5),r=()=>j()*200;if(s.sk.wall(l.x0,l.z0,l.x1,l.z0,0,-1,e,t*(.7+j()*.5),n(),r()),s.sk.wall(l.x1,l.z1,l.x0,l.z1,0,1,e,t*(.7+j()*.5),n(),r()),s.sk.wall(l.x0,l.z1,l.x0,l.z0,-1,0,e,t*(.7+j()*.5),n(),r()),s.sk.wall(l.x1,l.z0,l.x1,l.z1,1,0,e,t*(.7+j()*.5),n(),r()),i.sides){let t=dn(l,i),a=e-l.y0,o=[[.8,.84,.9],[.86,.84,.82],[.74,.73,.72],[.9,.9,.92],[.82,.86,.86],[.7,.72,.76]],c=(t,i,c,l,u,d)=>s.sk.wall(t,i,c,l,u,d,e,a,n()*.8,r(),Z(o,j),.55+j()*.45);t.nz===`party`&&c(l.x0,l.z0,l.x1,l.z0,0,-1),t.pz===`party`&&c(l.x1,l.z1,l.x0,l.z1,0,1),t.nx===`party`&&c(l.x0,l.z1,l.x0,l.z0,-1,0),t.px===`party`&&c(l.x1,l.z0,l.x1,l.z1,1,0)}}let we=Pt[be]??Pt[J.TAR];o.lod.horiz(l.x0,l.z0,l.x1,l.z1,I+.01,{...l.p,style:A.BLANK,layer:we[0],tint:we[1].map((e,t)=>e*Ce[t]*.95),topY:I});let Te={...l.p,style:A.BLANK,layer:O.METAL,tint:[2,2.05,2.1],topY:I+6},B=(e,t,n,r,i,a=I)=>{i>a+.25&&o.lod.box(e,a,t,n,i,r,Te,{},!0,!1,{...Te,layer:O.ROOF,tint:[.62,.62,.6]})};if(l.y1<3)continue;let Ee=ae+.7,V={x0:l.x0+Ee,z0:l.z0+Ee,x1:l.x1-Ee,z1:l.z1-Ee},De=(e,t,n,r)=>L&&n>L.x0-.4&&e<L.x1+.4&&r>L.z0-.4&&t<L.z1+.4,H=(e,t,n,r,i,a=!1,o=F,s=V)=>{let c=e+n,l=t+r;return!(e<s.x0||t<s.z0||c>s.x1||l>s.z1||!a&&De(e,t,c,l)||v.hit(e-.35,t-.35,c+.35,l+.35,o,i))},U=(e,t,n,r=10,i=V,o=!1)=>{for(let s=0;s<r;s++){let r=i.x1-i.x0-e,s=i.z1-i.z0-t;if(r<0||s<0)return null;let c=i.x0+a()*r,l=i.z0+a()*s;if(H(c,l,e,t,n,o,F,i))return[c,l]}return null},Oe=[k>0?V.x1-3:V.x0+3,te>0?V.z1-3:V.z0+3],ke=(e,t,n,r=5,i=12)=>{for(let o=0;o<i;o++){let i=(a()+a()+a()-1.5)*r*1.2,o=(a()+a()+a()-1.5)*r*1.2,s=Math.min(Math.max(Oe[0]+i-e/2,V.x0),V.x1-e),c=Math.min(Math.max(Oe[1]+o-t/2,V.z0),V.z1-t);if(H(s,c,e,t,n))return[s,c]}return null},Ae=(e,t,n,r,i,a)=>{if(a<.25)return;let o=Math.abs(i-F)<.05?P:ge&&Math.abs(i-ge.y)<.05?ge:null;o&&s.ao.ring(i,e,t,n,r,Math.min(2.4,.35+a*.32),a>3?.42:a>1.2?.52:.62,o)},W=(e,t,n,r,i,a,o=`equipment`)=>{m.box(e,t,n,r,i,a,o),v.add(e,t,n,r,i,a),Ae(e,n,r,a,t,i-t)},je=(e,t,n,r,i)=>{for(let[a,o,s,c]of[[e,t,-1,-1],[n,t,1,-1],[e,r,-1,1],[n,r,1,1]])g.add(a-s*.15,i,o-c*.15,s*Math.SQRT1_2,0,c*Math.SQRT1_2,`roofCorner`)},Me=V.x1-V.x0,Ne=V.z1-V.z0,G=Math.max(0,Me*Ne);if(Me<2||Ne<2)continue;let Pe=v.on(l.x0,l.z0,l.x1,l.z1,F),Fe=Pe.find(e=>e[6]===Wt&&e[3]-e[0]>1.8&&e[5]-e[2]>1.8);Fe&&(Oe=[(Fe[0]+Fe[3])/2,(Fe[2]+Fe[5])/2]);let Ie=Pe.some(e=>e[6]===Ut);l.parapet>.3&&s.ao.band(F,P.x0,P.z0,P.x1,P.z1,Math.min(1.4,.5+l.parapet),.62);for(let e of Pe)e[4]-e[1]>.3&&e[3]-e[0]<Me+1&&e[5]-e[2]<Ne+1&&Ae(e[0],e[2],e[3],e[5],F,e[4]-e[1]);for(let e of Pe){if(e[6]!==Wt||e[3]-e[0]<1.8||e[5]-e[2]<1.8||e[4]-e[1]<2)continue;let t=.012,n=e[4],r=X(Z(ln,j),j,.06);c.skin(e[0],e[2],e[3],e[5],n+.006,Z([J.TAR,J.BITUMEN,J.EPDM,J.SILVER],j),X([.78,.78,.78],j,.08),x,S,C,.4);for(let[i,a,o,s]of[[e[0]-t,e[2]-t,e[3]+t,e[2]+.2],[e[0]-t,e[5]-.2,e[3]+t,e[5]+t],[e[0]-t,e[2]+.2,e[0]+.2,e[5]-.2],[e[3]-.2,e[2]+.2,e[3]+t,e[5]-.2]])c.box(i,n-.2,a,o,n+.012,s,J.METAL,r.map(e=>e*.8),r);let i=e[4]-e[1];s.sk.wall(e[0],e[2],e[3],e[2],0,-1,n,i,.9,j()*99),s.sk.wall(e[3],e[5],e[0],e[5],0,1,n,i,.9,j()*99),s.sk.wall(e[0],e[5],e[0],e[2],-1,0,n,i,.9,j()*99),s.sk.wall(e[3],e[2],e[3],e[5],1,0,n,i,.9,j()*99),M.bhDress=(M.bhDress??0)+1}if(pe){let e=fe;if(M.scrMiss=(M.scrMiss??0)+ +!e,e){let t=.015,n=Z(on,a);c.box(e[0]-t,e[1],e[2]-t,e[3]+t,e[4]-.05,e[5]+t,J.LOUVRE,n,!1),c.box(e[0]-t-.04,e[4]-.35,e[2]-t-.04,e[3]+t+.04,e[4]+.012,e[5]+t+.04,J.METAL,Y(7106416),!1),c.skin(e[0],e[2],e[3],e[5],e[4]+.021,a()<.5?J.GRAVEL:J.EPDM,X([.85,.85,.85],a,.06),x,S,C,.6),B(e[0],e[2],e[3],e[5],e[4],F),M.clad++;for(let n of v.on(e[0],e[2],e[3],e[5],e[4]))if(!(n[6]!==Gt||n[7]!==0||n[4]-n[1]<2.3||n[3]-n[0]<3.5||n[5]-n[2]<2.8)){{let e=X(Z(on,a),a,.06);c.box(n[0]-t,n[1],n[2]-t,n[3]+t,n[4]+.012,n[5]+t,J.LOUVRE,e,e.map(e=>e*.62),J.METAL)}B(n[0],n[2],n[3],n[5],n[4],n[1])}let r=e[4]+.012,i={x0:e[0]+.7,z0:e[2]+.7,x1:e[3]-.7,z1:e[5]-.7},o=(i.x1-i.x0)*(i.z1-i.z0);for(let e=0,t=Math.min(22,Math.floor(o/28));e<t;e++){let e=a(),t=a()<.5;if(e>.82){let e=5+a()*4,n=2.1+a()*.4,o=1.9+a()*.4,l=t?e:n,u=t?n:e,d=null;for(let e=0;e<8&&!d;e++){let e=i.x0+a()*Math.max(0,i.x1-i.x0-l),t=i.z0+a()*Math.max(0,i.z1-i.z0-u);H(e,t,l,u,o+.6,!0,r,i)&&(d=[e,t])}if(!d)continue;let f=X(Z(qt,a),a,.06);yn(c,m,d[0],d[1],d[0]+l,d[1]+u,r,o,t,f,f.map(e=>e*.72)),m.box(d[0],r,d[1],d[0]+l,r+o,d[1]+u,`equipment`),v.add(d[0],r,d[1],d[0]+l,r+o+.3,d[1]+u),s.ao.ring(r,d[0],d[1],d[0]+l,d[1]+u,Math.min(2,.35+o*.32),.5,i);continue}let n=e<.5?1.8+a()*2:e<.75?1.2+a()*.8:1.2+a()*1.2,o=e<.5?1.1+a()*.6:e<.75?1.2+a()*.8:.5,l=t?n:o,u=t?o:n,d=e<.5?.9+a()*.6:e<.75?1.4+a()*1.2:1.6,f=null;for(let e=0;e<8&&!f;e++){let e=i.x0+a()*Math.max(0,i.x1-i.x0-l),t=i.z0+a()*Math.max(0,i.z1-i.z0-u);H(e,t,l,u,d+.4,!0,r,i)&&(f=[e,t])}if(!f)continue;let[p,h]=f,g=p+l,_=h+u,y=X(Z(qt,a),a,.06),b=y.map(e=>e*.72);if(e<.5){c.box(p,r,h,g,r+d,_,J.METAL,y,b);let e=Math.max(1,Math.floor(n/1.6));for(let i=0;i<e;i++){let a=(i+.5)/e,s=t?p+l*a:(p+g)/2,f=t?(h+_)/2:h+u*a;c.cyl(s,f,Math.min(o*.34,n/e*.36),r+d,r+d+.1,b,10,J.METAL,Jt)}m.box(p,r,h,g,r+d,_,`equipment`)}else if(e<.75){let e=Math.min(l,u)/2*.9,t=(p+g)/2,n=(h+_)/2,i=X(Z(nn,a),a,.05).map(e=>e*.75);c.lathe([t,r,n],[0,1,0],[[e,0],[e,d],[e*.3,d+e*.3]],12,i,J.METAL,{cap:i}),m.cyl(t,n,r,r+d,e,e,`equipment`),m.cyl(t,n,r+d,r+d+e*.3,e,e*.3,`equipment`)}else c.box(p,r,h,g,r+d,_,J.METAL,X(Y(9080456),a,.05),X(Y(6974824),a,.05)),m.box(p,r,h,g,r+d,_,`equipment`);v.add(p,r,h,g,r+d+.3,_),s.ao.ring(r,p,h,g,_,Math.min(2,.35+d*.32),.5,i)}}if(l.parapet===0&&Math.min(b,ie)>8){let e=ce(Math.floor(Math.abs(l.x0*11.3+l.z0*23.9+l.y1))+313),t=.9+e()*.5,n=.35,r=.08,i=X(Z([Y(6120036),Y(7237746),Y(5001555),Y(8026740)],e),e,.05),a=i.map(e=>e*1.35);for(let[e,o,s,u]of[[l.x0,l.z0,l.x1,l.z0+n],[l.x0,l.z1-n,l.x1,l.z1],[l.x0,l.z0+n,l.x0+n,l.z1-n],[l.x1-n,l.z0+n,l.x1,l.z1-n]])v.hit(e+.05,o+.05,s-.05,u-.05,F+.02,t)||(c.box(e,F,o,s,F+t-.12,u,J.METAL,i,!1),c.box(e-(e===l.x0?r:0),F+t-.12,o-(o===l.z0?r:0),s+(s===l.x1?r:0),F+t,u+(u===l.z1?r:0),J.METAL,i.map(e=>e*.8),a),m.box(e,F,o,s,F+t,u,`parapet`),v.add(e,F,o,s,F+t,u));s.ao.band(F,l.x0+n,l.z0+n,l.x1-n,l.z1-n,1.1,.6),s.sk.wall(l.x0,l.z0,l.x1,l.z0,0,-1,F+t,3+e()*6,.5,e()*99),s.sk.wall(l.x1,l.z1,l.x0,l.z1,0,1,F+t,3+e()*6,.5,e()*99),s.sk.wall(l.x0,l.z1,l.x0,l.z0,-1,0,F+t,3+e()*6,.5,e()*99),s.sk.wall(l.x1,l.z0,l.x1,l.z1,1,0,F+t,3+e()*6,.5,e()*99),M.gpar=(M.gpar??0)+1}vn(c,m,v,H,a,V,F,2+Math.floor(a()*3),M);continue}if(de&&h&&G>650&&(e.hero||a()<.13)){let e=Math.min(15,Math.min(Me,Ne)*.55),t=1.4,n=U(e+2*t,e+2*t,3,12),r=n&&[n[0]+t,n[1]+t];if(r){let[n,i]=r,a=n+e,o=i+e,s=(n+a)/2,l=(i+o)/2,u=F+.6,d=Y(3093042),f=u-.18;for(let[e,r,s,l]of[[n-t,i-t,a+t,i],[n-t,o,a+t,o+t],[n-t,i,n,o],[a,i,a+t,o]])c.box(e,f-.03,r,s,f,l,J.LOUVRE,d,d.map(e=>e*1.3)),m.box(e,f-.03,r,s,f,l,`awning`,1);for(let[e,r]of[[n-t,i-t],[a+t-.08,i-t],[n-t,o+t-.08],[a+t-.08,o+t-.08]])c.box(e,F,r,e+.08,f-.03,r+.08,J.METAL,Xt,!1),m.box(e,F,r,e+.08,f-.03,r+.08,`pole`);for(let t=1.5;t<e-1;t+=3)for(let[e,r]of[[n+t,i+.25],[n+t,o-.25],[n+.25,i+t],[a-.25,i+t]])c.cyl(e,r,.07,u,u+.1,Y(9083504),6),m.cyl(e,r,u,u+.1,.07,.07,`equipment`);c.box(n,F,i,a,u,o,J.METAL,Y(5922143),Y(6974571),J.EPDM);let p=Y(11051136),h=e*.42;c.lathe([s,u+.006,l],[0,1,0],[[h,0],[h-.45,0]],28,p,J.METAL,{back:!0,base:F});let g=Y(12894386),_=e*.22,v=e*.13;c.box(s-v-.25,u,l-_,s-v+.25,u+.008,l+_,J.METAL,g,null,null),c.box(s+v-.25,u,l-_,s+v+.25,u+.008,l+_,J.METAL,g,null,null),c.box(s-v+.25,u,l-.25,s+v-.25,u+.008,l+.25,J.METAL,g,null,null);for(let[e,t]of[[n+.3,i+.3],[a-.3,i+.3],[n+.3,o-.3],[a-.3,o-.3]])c.cyl(e,t,.1,u,u+.18,Y(10130528),6),m.cyl(e,t,u,u+.18,.1,.1,`equipment`);W(n,F,i,a,u,o,`roof`),je(n,i,a,o,u),M.heli=(M.heli??0)+1}}if(de&&e.H>40&&Math.max(Me,Ne)>24&&Math.max(Me,Ne)/Math.min(Me,Ne)>3&&Math.min(Me,Ne)<16){let e=Me>=Ne,t=e?V.x0:V.z0,n=e?V.x1:V.z1,r=e?V.z0:V.x0,i=e?V.z1:V.x1,a=Math.min(.6,(i-r)*.08),s=t+1+j()*4,u=0;for(;s<n-5;){let t=Math.min(n-s,7+j()*14),d=j(),f=d<.35?5+j()*4:d<.8?3.2+j()*2.5:2.4+j()*1.2,p=r+a+(j()<.3?(i-r)*.2:0),h=i-a-(j()<.3?(i-r)*.2:0),[g,_,y,b]=e?[s,p,s+t,h]:[p,s,h,s+t];if(t>3.5&&h-p>2.5&&!v.hit(g-.3,_-.3,y+.3,b+.3,F,f+1)){let n=F+f;if(d<.35){let r={...l.p,style:A.BLANK,tint:(l.p.tint??[1,1,1]).map(e=>e*(.82+j()*.14)),topY:n};o.fac.box(g,F,_,y,n,b,r,{},!0,!1,{...r,layer:O.ROOF,tint:[.62,.62,.6]}),o.lod.box(g,I,_,y,n,b,r,{},!0,!1,{...r,layer:O.ROOF,tint:[.62,.62,.6]}),c.skin(g,_,y,b,n+.006,j()<.5?J.BITUMEN:J.GRAVEL,X([.85,.85,.85],j,.06),x,S,C,.5),c.box(g-.04,n-.25,_-.04,y+.04,n+.05,b+.04,J.METAL,X(Z(ln,j),j,.06),!1);let i=Z(on,j);e?c.box(g+1,F+1,_-.03,Math.min(y-1,g+1+t*.5),F+f*.6,_,J.LOUVRE,i,!1):c.box(g-.03,F+1,_+1,g,F+f*.6,Math.min(b-1,_+1+t*.5),J.LOUVRE,i,!1)}else if(d<.8){let e=.9+j()*.8,t=Z(on,j),r=X(Y(9341570),j,.06);c.box(g,F,_,y,F+e,b,J.PAVERS,r,!1),c.box(g,F+e,_,y,n,b,J.LOUVRE,t,!1),c.box(g-.05,n-.3,_-.05,y+.05,n+.012,b+.05,J.METAL,Y(6645864),!1),c.skin(g-.05,_-.05,y+.05,b+.05,n+.021,j()<.5?J.EPDM:J.GRAVEL,X([.9,.9,.9],j,.06),x,S,C,.5),B(g,_,y,b,n)}else{let r=X(Z(qt,j),j,.06);c.box(g,F,_,y,n,b,J.LOUVRE,r,r.map(e=>e*.7),J.METAL);let i=Math.max(1,Math.floor(t/3.2)),a=Math.min(1.3,(h-p)*.36,t/i*.4);for(let o=0;o<i;o++){let l=s+t*(o+.5)/i,u=(p+h)/2;c.cyl(e?l:u,e?u:l,a,n,n+.5,r.map(e=>e*.8),12,J.METAL,Jt),m.cyl(e?l:u,e?u:l,n,n+.5,a,a,`equipment`)}B(g,_,y,b,n)}W(g,F,_,y,n,b,`bulkhead`),je(g,_,y,b,n),u++}s+=t+2.5+j()*6}if(u&&j()<.6){let t=e?n-2:(r+i)/2,a=e?(r+i)/2:n-2;v.hit(t-.8,a-.8,t+.8,a+.8,F,4)||(xn(c,m,g,t,F,a,8+j()*10,j),v.add(t-.8,F,a-.8,t+.8,F+10,a+.8))}M.spine=(M.spine??0)+u}let K=null;if(de&&G>110&&e.H>22){let t=(f===`apt`||f===`loft`||f===`walkup`)&&e.H<95&&a()<.3,r=!t&&(h||(f===`postwar`||f===`loft`||f===`deco`||f===`apt`)&&a()<(f===`postwar`?.85:.6));if(t||r){let e=t?.45+a()*.3:h?.3+a()*.16:.28+a()*.22,i=t?.45+a()*.3:h?.3+a()*.16:.28+a()*.22,s=Math.max(4,Me*e),u=Math.max(4,Ne*i),d=t?1+ +(a()<.45):1,f=n.floorH??3.4,p=t?d*f:h?5.5+a()*3.5:4+a()*2.6,m=null,g=s,_=u;for(let e=0;e<5&&!m;e++)m=t?U(g,_,p+1,12):ke(g,_,p+1,3,8)??U(g,_,p+1,10),m||(g=Math.max(3.5,g*.8),_=Math.max(3.5,_*.8));if(m){let[e,i]=m,s=e+g,u=i+_,d=F+p;if(t){let t=a()<.4,r=t?{...l.p,style:A.CURTAIN,layer:O.METAL,bayW:1.6,winW:.95,winH:.8,floorH:f,margin:0,depth:.04,tint:[1,1,1],topY:d}:{...l.p,topY:d},p={all:{style:t?A.CURTAIN:l.p.style??n.style??A.PUNCHED,gH:-(n.gH??4)}};o.fac.box(e,F,i,s,d,u,r,p,!1),o.lod.box(e,I,i,s,d,u,r,p,!0,!1,{...r,style:A.BLANK,layer:O.ROOF,tint:[.85,.85,.85]}),o.fac.horiz(e,i,s,u,d,{...r,style:A.BLANK,layer:O.ROOF,tint:[.8,.8,.8]}),c.skin(e,i,s,u,d+.006,a()<.5?J.BITUMEN:J.SILVER,X([1,1,1],a,.06),x,S,C,.6),M.pent++}else{let t=Math.min(1.2+a()*1.4,p*.4),n=Z(on,a),r=a()<.5?X(Y(10130827),a,.06):X(rn,a,.1);c.box(e,F,i,s,F+t,u,J.PAVERS,r,!1),c.box(e,F+t,i,s,d,u,J.LOUVRE,n,!1),c.box(e-.05,d-.3,i-.05,s+.05,d+.012,u+.05,J.METAL,Y(7369586),!1),c.skin(e-.05,i-.05,s+.05,u+.05,d+.021,a()<.5?J.EPDM:J.GRAVEL,X([.9,.9,.9],a,.06),x,S,C,.5),B(e,i,s,u,d),M.mech++}if(W(e,F,i,s,d,u,`bulkhead`),je(e,i,s,u,d),Fe||(Oe=[(e+s)/2,(i+u)/2]),Math.min(g,_)>3&&(K={x0:e+.5,z0:i+.5,x1:s-.5,z1:u-.5,y:d}),ge={x0:e,z0:i,x1:s,z1:u,y:d},t&&!L&&(L={x0:P.x0,z0:P.z0,x1:P.x1,z1:P.z1,cell:J.DECK}),r&&a()<.65){let e=2.6+a()*1.4,t=2.6+a()*1.4,n=p+1.6+a()*1.8,r=ke(e,t,n+1,4,10);if(r){let[i,s]=r,c=F+n,u={...l.p,style:A.BLANK,layer:a()<.5?l.p.layer??O.CONCRETE:O.CONCRETE,tint:(l.p.tint??[1,1,1]).map(e=>e*.9),topY:c};o.fac.box(i,F,s,i+e,c,s+t,u,{},!0,!1,{...u,layer:O.ROOF,tint:[.7,.7,.7]}),o.lod.box(i,I,s,i+e,c,s+t,u,{},!0,!1,{...u,layer:O.ROOF,tint:[.7,.7,.7]}),W(i,F,s,i+e,c,s+t,`bulkhead`),je(i,s,i+e,s+t,c)}}}}}if(de&&!Se&&R!==`garden`&&R!==`pool`&&G>380&&(h||e.hero||(f===`postwar`||f===`deco`||f===`loft`)&&G>700)){let e=ce(Math.floor(Math.abs(l.x0*31.7+l.z1*13.1+l.y1*7.3))+9091),t=(t,n,r)=>{for(let i=0;i<14;i++){let i=V.x1-V.x0-t,a=V.z1-V.z0-n;if(i<0||a<0)return null;let o=V.x0+e()*i,s=V.z0+e()*a;if(H(o,s,t,n,r))return[o,s]}return null},n=Math.min(3,+!!h+(G>900?2:1));for(let r=0;r<n;r++)if(r===0?!(e()<.65):!(e()<.5)){let n=Math.min(Me*.5,7+e()*9),r=Math.min(Ne*.5,5+e()*7),i=4.5+e()*4,a=t(n,r,i+1);if(!a)continue;let[u,d]=a,f=u+n,p=d+r,h=F+i,g={...l.p,style:A.BLANK,tint:(l.p.tint??[1,1,1]).map(t=>t*(.78+e()*.16)),topY:h};o.fac.box(u,F,d,f,h,p,g,{},!0,!1,{...g,layer:O.ROOF,tint:[.6,.6,.58]}),o.lod.box(u,I,d,f,h,p,g,{},!0,!1,{...g,layer:O.ROOF,tint:[.6,.6,.58]}),c.skin(u,d,f,p,h+.006,e()<.5?J.GRAVEL:J.BITUMEN,X([.82,.82,.82],e,.06),x,S,C,.5);let _=X(Z(ln,e),e,.06);c.box(u-.05,h-.3,d-.05,f+.05,h+.05,p+.05,J.METAL,_.map(e=>e*.85),_);let y=Z(on,e),b=1+e()*1.5;c.box(u+.8,F+b,d-.03,f-.8,F+b+(i-b)*.55,d,J.LOUVRE,y,!1),c.box(f,F+b,d+.8,f+.03,F+b+(i-b)*.55,p-.8,J.LOUVRE,y,!1),s.sk.wall(u,d,f,d,0,-1,h,i,.9,e()*99),s.sk.wall(f,p,u,p,0,1,h,i,.9,e()*99),s.sk.wall(u,p,u,d,-1,0,h,i,.9,e()*99),s.sk.wall(f,d,f,p,1,0,h,i,.9,e()*99),W(u,F,d,f,h,p,`bulkhead`),je(u,d,f,p,h);for(let t=0,i=1+Math.floor(e()*3);t<i;t++){let t=1.6+e()*1.6,i=1.1+e()*.9,a=.9+e()*.8,o=u+.5+e()*Math.max(0,n-t-1),s=d+.5+e()*Math.max(0,r-i-1);if(o+t>f-.4||s+i>p-.4||v.hit(o,s,o+t,s+i,h,a))continue;let l=Z(qt,e);c.box(o,h,s,o+t,h+a,s+i,J.METAL,l),c.cyl(o+t/2,s+i/2,Math.min(t,i)*.33,h+a,h+a+.1,l.map(e=>e*.8),10,J.METAL,Jt),m.box(o,h,s,o+t,h+a,s+i,`equipment`),v.add(o,h,s,o+t,h+a,s+i)}if(e()<.6){let t=u+.8,n=p-.8,r=2+e()*3;c.cyl(t,n,.35,h,h+r,Y(6185056),8,J.METAL,Jt),m.cyl(t,n,h,h+r,.35,.35,`equipment`)}M.pent9=(M.pent9??0)+1}else{let n=3.4+e()*1.2,r=1+Math.floor(e()*(G>900?4:3)),i=e()<.45?2:1,a=e()<.5,o=(a?r:i)*n,s=(a?i:r)*n,l=.8+e()*.5,u=3.6+e()*2.4,d=1+e()*.9,f=t(o+1.2,s+1.2,l+u+d+.5);if(!f)continue;let p=f[0]+.6,h=f[1]+.6,g=p+o,_=h+s,y=F+l,b=y+u,x=X(Z(en,e),e,.06);for(let e=0;e<=(a?r:i);e++){let t=(a?p:h)+e*n-(e?.15:0);a?c.box(t,y-.35,h-.3,t+.15,y,_+.3,J.METAL,x):c.box(p-.3,y-.35,t,g+.3,y,t+.15,J.METAL,x);for(let e of[0,1]){let n=a?t:e?g+.1:p-.3,r=a?e?_+.1:h-.3:t;c.box(n,F,r,n+.2,y-.35,r+.2,J.METAL,x.map(e=>e*.85),!1),m.box(n,F,r,n+.2,y-.35,r+.2,`pole`)}a?m.box(t,y-.35,h-.3,t+.15,y,_+.3,`equipment`):m.box(p-.3,y-.35,t,g+.3,y,t+.15,`equipment`)}let S=X(Z([Y(9278096),Y(8357764),Y(10131084),Y(7305077)],e),e,.06);c.box(p,y,h,g,y+u*.5,_,J.LOUVRE,S.map(e=>e*.92),!1),c.box(p,y+u*.5,h,g,b,_,J.METAL,S,S.map(e=>e*.7));for(let e=1;e<r;e++){let t=(a?p:h)+e*n;a?c.box(t-.06,y,h-.05,t+.06,b+.05,_+.05,J.METAL,S.map(e=>e*.75),!1):c.box(p-.05,y,t-.06,g+.05,b+.05,t+.06,J.METAL,S.map(e=>e*.75),!1)}for(let e=0;e<r;e++)for(let t=0;t<i;t++){let r=a?p+(e+.5)*n:p+(t+.5)*n,i=a?h+(t+.5)*n:h+(e+.5)*n,o=n*.4;c.lathe([r,b,i],[0,1,0],[[o,0],[o*1.02,d*.6],[o*1.1,d]],12,S.map(e=>e*.86),J.METAL,{back:!0}),c.disc(r,b+d*.45,i,o*1.01,Jt,12),m.cyl(r,i,b,b+d,o,o*1.1,`equipment`)}let C=Y(11052122).map(e=>e*.8);c.box(p,b+1,h,g,b+1.06,h+.05,J.METAL,C,!1),c.box(p,b+1,_-.05,g,b+1.06,_,J.METAL,C,!1);for(let e=p;e<=g+.01;e+=Math.max(1.5,o/Math.ceil(o/2)))for(let t of[h,_-.05])c.box(Math.min(e,g-.05),b,t,Math.min(e,g-.05)+.05,b+1,t+.05,J.METAL,C,!1);c.box(g,F,h+.4,g+.12,b+1,h+1,J.METAL,C,!1);let w=4+e()*10,T=X(Z(sn,e),e,.06),E=a?te>0?-1:1:k>0?-1:1;for(let e of[.5,1.3]){let[t,n,r,i]=a?[p+e,E>0?_+.3:h-.3-w,p+e+.4,E>0?_+.3+w:h-.3]:[E>0?g+.3:p-.3-w,h+e,E>0?g+.3+w:p-.3,h+e+.4];t<V.x0||n<V.z0||r>V.x1||i>V.z1||v.hit(t,n,r,i,F,1.2)||(c.box(t,F+.55,n,r,F+.95,i,J.METAL,T,T.map(e=>e*1.08)),m.box(t,F+.55,n,r,F+.95,i,`equipment`),v.add(t,F,n,r,F+.95,i))}m.box(p,y,h,g,b,_,`equipment`),m.box(g,F,h+.4,g+.12,b+1,h+1,`pole`),v.add(p-.3,F,h-.3,g+.3,b+d,_+.3),Ae(p-.3,h-.3,g+.3,_+.3,F,b-F),B(p,h,g,_,b+d*.6),je(p,h,g,_,b),M.ct9=(M.ct9??0)+1}for(let t=0,n=3+Math.floor(e()*6);t<n;t++){let n=Math.min(P.x1-P.x0-.4,2+e()*9),r=Math.min(P.z1-P.z0-.4,1.5+e()*7);if(n<1||r<1)break;let i=P.x0+.2+e()*(P.x1-P.x0-.4-n),a=P.z0+.2+e()*(P.z1-P.z0-.4-r);if(De(i,a,i+n,a+r))continue;let o=e(),s=o<.5?J.TAR:o<.8?J.EPDM:J.BITUMEN;c.skin(i,a,i+n,a+r,F+.0105+t*4e-4,s,X([.46,.45,.43],e,.25),e()*30,e()*30,e()<.5,.18)}}if(de&&(h||G>500&&(f===`postwar`||f===`loft`))&&a()<(h?.75:.35)){let e=6+a()*7,t=5+a()*5,n=2.4+a()*1,r=.15,i=U(e,t,n+.5,12);if(i){let[o,l]=i,u=o+e,d=l+t,f=X(Z(on,a),a,.05),p=[[o,l,u,l+r],[o,d-r,u,d],[o,l+r,o+r,d-r],[u-r,l+r,u,d-r]];for(let[e,t,r,i]of p){c.box(e,F+.1,t,r,F+n,i,J.LOUVRE,f,f.map(e=>e*.7),J.METAL);for(let a=(r-e>i-t?e:t)+.05;a<(r-e>i-t?r:i);a+=2.4)r-e>i-t?c.box(a,F,t-.03,a+.1,F+n,i+.03,J.METAL,Xt,null):c.box(e-.03,F,a,r+.03,F+n,a+.1,J.METAL,Xt,null);m.box(e-.03,F,t-.03,r+.03,F+n,i+.03,`equipment`),Ae(e,t,r,i,F,n*.6)}v.add(o,F,l,u,F+n,d);let h=[];for(let i=0,f=Math.floor(e*t/14);i<f;i++){let i=1.4+a()*1.6,f=1.1+a()*.9,p=Math.min(n-.4,1.1+a()*.8),g=o+.5+a()*Math.max(0,e-1-i),_=l+.5+a()*Math.max(0,t-1-f);if(h.some(e=>g<e[2]+.4&&g+i>e[0]-.4&&_<e[3]+.4&&_+f>e[1]-.4))continue;h.push([g,_,g+i,_+f]);let v=X(Z(qt,a),a,.06),y=v.map(e=>e*.72);c.box(g,F,_,g+i,F+p,_+f,J.METAL,v,y),c.cyl(g+i/2,_+f/2,Math.min(i,f)*.34,F+p,F+p+.1,y,10,J.METAL,Jt),m.box(g,F,_,g+i,F+p,_+f,`equipment`),s.ao.ring(F,g,_,g+i,_+f,.6,.55,{x0:o+r,z0:l+r,x1:u-r,z1:d-r})}B(o,l,u,d,F+n),je(o,l,u,d,F+n),M.screen=(M.screen??0)+1}}if(!Fe&&!K&&de&&G>40&&e.H>12&&a()<.75){let e=2.4+a()*1.4,t=3.2+a()*1.4,n=2.8+a()*.6,r=a()<.5,i=ke(r?t:e,r?e:t,n+.5,2,10);if(i){let[s,u]=i,d=s+(r?t:e),f=u+(r?e:t),p=F+n,m={...l.p,style:A.BLANK,layer:a()<.6?l.p.layer??O.RED:O.RED,tint:(l.p.tint??[1,1,1]).map(e=>e*.88),topY:p};o.fac.box(s,F,u,d,p,f,m,{},!0,!1,{...m,layer:O.ROOF,tint:[.7,.7,.7]}),o.lod.box(s,I,u,d,p,f,m,{},!0,!1,{...m,layer:O.ROOF,tint:[.7,.7,.7]}),c.skin(s,u,d,f,p+.006,a()<.5?J.TAR:J.SILVER,X([1,1,1],a,.06),x,S,C,.4),(V.x0+V.x1)/2,(u+f)/2<(V.z0+V.z1)/2?c.box((s+d)/2-.45,F,f,(s+d)/2+.45,F+2.05,f+.03,J.METAL,Y(4014662)):c.box((s+d)/2-.45,F,u-.03,(s+d)/2+.45,F+2.05,u,J.METAL,Y(4014662)),W(s,F,u,d,p,f,`bulkhead`),je(s,u,d,f,p),Oe=[(s+d)/2,(u+f)/2]}}if(!Se&&!h&&G>380&&(me||f===`loft`||f===`postwar`||f===`apt`)&&a()<.14){let e=11+a()*6,t=7+a()*3,n=Me>Ne,r=n?e:t,i=n?t:e,o=U(r,i,3.4,10,V,!0);if(o){let[e,t]=o,s=e+r,l=t+i,u=F+.012,d=Z([Y(5073500),Y(5925498),Y(9067080),Y(5599326)],a),f=Y(14210764);c.skin(e,t,s,l,u,J.EPDM,d.map(e=>e*1.1),0,0,!1,.25);let p=(e,t,n,r)=>c.skin(e,t,n,r,u+.003,J.METAL,f,0,0,!1,.01),h=.6,g=.07;p(e+h,t+h,s-h,t+h+g),p(e+h,l-h-g,s-h,l-h),p(e+h,t+h,e+h+g,l-h),p(s-h-g,t+h,s-h,l-h),n?p((e+s)/2-g/2,t+h,(e+s)/2+g/2,l-h):p(e+h,(t+l)/2-g/2,s-h,(t+l)/2+g/2);let _=Y(5922142);for(let[n,r,i,a]of[[e,t,s,t+.05],[e,l-.05,s,l],[e,t,e+.05,l],[s-.05,t,s,l]]){c.box(n,F+3-.06,r,i,F+3,a,J.METAL,_),m.box(n,F+3-.06,r,i,F+3,a,`pole`),c.box(n,F,r,i,F+.25,a,J.METAL,_.map(e=>e*.8)),m.box(n,F,r,i,F+.25,a,`wall`);let e=Math.max(i-n,a-r),t=i-n>a-r;for(let o=0;o<=e;o+=2.5){let e=t?Math.min(n+o,i-.05):n,s=t?r:Math.min(r+o,a-.05);c.box(e,F,s,e+.05,F+3,s+.05,J.METAL,_,!1),m.box(e,F,s,e+.05,F+3,s+.05,`pole`)}}v.add(e,F,t,s,F+3,l),M.court2=(M.court2??0)+1}}let Le=de&&!pe&&!h&&G>150&&Me>9&&Ne>9&&(p||f===`loft`||f===`postwar`||f===`deco`)&&a()<(p||f===`loft`?.72:.45)?G>520&&a()<.5?2:1:0;for(let e=0;e<Le;e++){let e=a()<.7,t=e?3.2+a()*3:2.8+a()*2.4,n=e?4+a()*5.5:3.5+a()*4.5,r=a()<.5,i=r?n:t,u=r?t:n,d=null;if(a()<.5&&(d=U(i,u,1.6,8,te>0?{x0:V.x0,z0:V.z1-u,x1:V.x1,z1:V.z1}:{x0:V.x0,z0:V.z0,x1:V.x1,z1:V.z0+u})),d??=U(i,u,1.6,10),!d)continue;let[f,p]=d,h=f+i,g=p+u;if(e){let e=.3,t=1+a()*.5,n={...l.p,style:A.BLANK,layer:l.p.layer===O.RED||l.p.layer===O.BROWN?l.p.layer:a()<.6?O.RED:O.BROWN,tint:(l.p.tint??[1,1,1]).map(e=>e*.8),topY:F+t,baseY:F};o.fac.box(f,F,p,h,F+t,g,n,{},!1),o.fac.innerRing(f+e,p+e,h-e,g-e,F,F+t,{...n,tint:n.tint.map(e=>e*.55)});let r=X(Z(ln,a),a,.06);for(let[n,i,a,o]of[[f,p,h,p+e],[f,g-e,h,g],[f,p+e,f+e,g-e],[h-e,p+e,h,g-e]])c.box(n-.03,F+t,i-.03,a+.03,F+t+.07,o+.03,J.METAL,r.map(e=>e*.85),r),m.box(n,F,i,a,F+t,o,`parapet`),m.box(n-.03,F+t,i-.03,a+.03,F+t+.07,o+.03,`coping`);c.skin(f+e,p+e,h-e,g-e,F+.01,J.TAR,[.07,.068,.065],0,0,!1,1.5),s.ao.band(F+.01,f+e,p+e,h-e,g-e,Math.min(1.6,(Math.min(i,u)-2*e)*.45),.25),s.ao.ring(F,f,p,h,g,.9,.5,P),B(f,p,h,g,F+t),v.add(f,F,p,h,F+t+.1,g),M.shaft=(M.shaft??0)+1}else{let e=.55+a()*.3;c.box(f,F,p,h,F+e,g,J.PAVERS,X(rn,a,.08),!1),c.box(f-.04,F+e,p-.04,h+.04,F+e+.06,g+.04,J.METAL,Y(6974570),!1),c.box(f+.06,F+e-.1,p+.06,h-.06,F+e+.02,g-.06,J.GLASS,[.4,.43,.45]);for(let t=f+1.1;t<h-.5;t+=1.1)c.box(t-.03,F+e+.02,p+.06,t+.03,F+e+.05,g-.06,J.METAL,Xt,!1);W(f-.04,F,p-.04,h+.04,F+e+.06,g+.04,`skylight`),M.court=(M.court??0)+1}}for(let t=0,n=R===`tank`?Ie?+(G>250):G>220&&N()<.55?2:1:!Ie&&de&&!Se&&e.H>16&&e.H<130&&(p||f===`loft`||f===`postwar`||f===`deco`)&&a()<(p||f===`loft`?e.H<60?.64:.46:.3)?G>450&&a()<.35?2:1:0;t<n;t++){let e=1.5+a()*1.3,t=ke(e*2+.6,e*2+.6,9,5,12)??U(e*2+.6,e*2+.6,9,8);if(t){let n=t[0]+e+.3,r=t[1]+e+.3;Sn(c,m,g,v,n,F,r,e,a);let i={...l.p,style:A.BLANK,layer:O.BROWN,tint:[.85,.72,.6],baseY:F};o.lod.box(n-e*.7,I,r-e*.7,n+e*.7,F+e*1.3,r+e*.7,{...Te,topY:F+e*1.3},{},!1),o.lod.cyl(n,r,e,F+e*1.3,F+e*3.2,8,{...i,topY:F+e*3.2},A.BLANK,!1),o.lod.cyl(n,r,e*1.04,F+e*3.2,F+e*3.8,8,{...i,layer:O.ROOF,tint:[.55,.52,.5],topY:F+e*3.8},A.BLANK,!1,.05),M.wt++}}if(R===`sign`){let e=[`nz`,`pz`,`nx`,`px`].filter(e=>D[e]===`street`&&Math.abs(e===`nx`?l.x0-i.x0:e===`px`?i.x1-l.x1:e===`nz`?l.z0-i.z0:i.z1-l.z1)<.1);if(e.length){let n=Z(e,N),r=n===`nz`||n===`pz`,i=n===`nz`||n===`nx`?-1:1,a=r?V.x0:V.z0,o=r?V.x1:V.z1,s=o-a,l=Math.min(s-1,8+N()*7),u=3.2+N()*2.6,d=2+N()*2,f=2.4,p=(a+o)/2+(N()-.5)*Math.max(0,s-l)*.7,h=p-l/2,g=p+l/2,_=n===`nz`?V.z0:n===`pz`?V.z1:n===`nx`?V.x0:V.x1,y=e=>_-i*e,b=(e,t,n,i,a,o,s,l,u=null,d=`equipment`)=>{let f=y(n),p=y(i),[h,g,_,v]=r?[e,t,Math.min(f,p),Math.max(f,p)]:[Math.min(f,p),Math.max(f,p),e,t];return c.box(h,a,_,g,o,v,s,l,u),d&&m.box(h,a,_,g,o,v,d),[h,_,g,v]},x=r?[h,Math.min(y(0),y(f)),g,Math.max(y(0),y(f))]:[Math.min(y(0),y(f)),h,Math.max(y(0),y(f)),g];if(l>5&&!v.hit(x[0],x[1],x[2],x[3],F,d+u+.3)){let e=X(Z(en,N),N,.06),i=F+d,a=i+u;b(h,g,.02,.4,i,a,J.METAL,e,e.map(e=>e*.8));let o=[9058864,3099242,12625e3,3824192,13946044,2763308,10115626,5913178].map(Y),s=2+Math.floor(N()*2),c=[i+.15];for(let e=1;e<s;e++)c.push(i+.15+(u-.3)*(e/s+(N()-.5)*.2));c.push(a-.15);let p=typeof location<`u`&&!location.search.includes(`nosignage`);p&&(t.roofSignPanels??=[]).push({k:n,alx:r,a0:h+.12,a1:g-.12,y0:i+.12,y1:a-.12,plane:y(-.004)});for(let e=0;e<s;e++){let t=X(Z(o,N),N,.08).map(e=>e*.8);p||b(h+.15,g-.15,.008,.03,c[e],c[e+1],J.MEMBRANE,t,null,null)}b(h-.08,g+.08,-.03,.43,a,a+.12,J.METAL,e.map(e=>e*.7),null,`coping`);let m=Math.max(2,Math.ceil(l/3.2)+1);for(let t=0;t<m;t++){let n=h+.2+(l-.4-.22)*(t/(m-1));b(n,n+.22,.4,.62,F,a,J.METAL,e,null,`pole`),b(n+.03,n+.19,2.2199999999999998,f,F,i+u*.55,J.METAL,e,null,`pole`),b(n+.05,n+.17,.62,2.2199999999999998,i+u*.55-.16,i+u*.55,J.METAL,e,null,`pole`)}b(h,g,.62,1.5,i-.08,i,J.LOUVRE,Y(4869196),Y(5921884),`awning`);for(let e=h+.6;e<g-.3;e+=2.4)b(e,e+.12,.5,.62,a+.12,a+.5,J.METAL,Y(3816508),null,`equipment`);v.add(x[0],F,x[1],x[2],a+.5,x[3]),Ae(x[0],x[1],x[2],x[3],F,1.2),B(...r?[h,Math.min(y(0),y(.4)),g,Math.max(y(0),y(.4))]:[Math.min(y(0),y(.4)),h,Math.max(y(0),y(.4)),g],a,i),M.sign=(M.sign??0)+1}}}if(!pe&&!Se&&G>320&&(h||e.hero||f===`postwar`||f===`deco`||f===`loft`||me&&G>500)){let e=Math.min(4,1+Math.floor(G/520+a()*1.5));for(let t=0;t<e;t++){let e=3.5+a()*4,n=3+a()*3,r=2.2+a()*1.5,i=a()<.5,o=i?e:n,s=i?n:e,l=(t===0?ke(o,s,r+.8,7,10):null)??U(o,s,r+.8,10);if(!l)continue;let[u,d]=l,f=u+o,p=d+s,h=X(Z(on,a),a,.06);if(a()<.55){c.box(u,F,d,f,F+.3,p,J.PAVERS,X(Y(9209725),a,.06),!1),c.box(u,F+.3,d,f,F+r,p,J.LOUVRE,h,!1),c.box(u-.04,F+r-.25,d-.04,f+.04,F+r+.012,p+.04,J.METAL,h.map(e=>e*.8),!1),c.skin(u-.04,d-.04,f+.04,p+.04,F+r+.021,a()<.5?J.EPDM:J.BITUMEN,X([.8,.8,.8],a,.08),x,S,C,.4);for(let e=0,t=1+Math.floor(a()*2);e<t;e++){let e=u+o*(.3+.4*a()),t=d+s*(.3+.4*a()),n=.35+a()*.3;c.lathe([e,F+r,t],[0,1,0],[[n*.6,0],[n*.6,.3],[n,.4],[n*.9,.55],[n*.2,.7]],10,h.map(e=>e*.75),J.METAL),m.cyl(e,t,F+r,F+r+.7,n*.6,n*.2,`equipment`)}}else{let e=Math.max(1,Math.round((i?o:s)/3)),t=(i?o:s)/e,n=X(Y(9278096),a,.06);c.box(u,F,d,f,F+.5,p,J.METAL,Xt,!1),c.box(u,F+.5,d,f,F+.5+(r-.5)*.55,p,J.LOUVRE,n,!1),c.box(u,F+.5+(r-.5)*.55,d,f,F+r,p,J.METAL,n,n.map(e=>e*.78));for(let a=0;a<e;a++){let e=i?u+(a+.5)*t:(u+f)/2,l=i?(d+p)/2:d+(a+.5)*t,h=Math.min(t,i?s:o)*.38;c.lathe([e,F+r,l],[0,1,0],[[h,0],[h*1.06,.45],[h*1.1,.7]],10,n.map(e=>e*.9),J.METAL,{back:!0}),c.disc(e,F+r+.28,l,h*1.02,Jt,12),m.cyl(e,l,F+r,F+r+.7,h*.985,h*1.09,`equipment`)}M.ct++}W(u,F,d,f,F+r,p),B(u,d,f,p,F+r),je(u,d,f,p,F+r),M.encl=(M.encl??0)+1}for(let e=0,t=1+Math.floor(a()*Math.min(3,G/400));e<t;e++){let e=7+a()*Math.min(16,Math.max(Me,Ne)*.5),t=.8+a()*.5,n=.7+a()*.4,r=a()<.5,i=F+.35+a()*.3,o=r?e:t,s=r?t:e,l=U(o,s,n+1,8);if(!l)continue;let[u,d]=l,f=u+o,p=d+s,h=X(a()<.6?Yt:Y(9079942),a,.05);c.box(u,i,d,f,i+n,p,J.METAL,h,h.map(e=>e*.9));for(let t=.4;t<e-.2;t+=2.2){let[e,n]=r?[u+t,(d+p)/2]:[(u+f)/2,d+t];c.box(e-.05,F,n-.05,e+.05,i,n+.05,J.METAL,Xt,!1),m.box(e-.05,F,n-.05,e+.05,i,n+.05,`pole`)}for(let t=1.5;t<e-.3;t+=1.5)r?c.box(u+t-.03,i-.02,d-.02,u+t+.03,i+n+.02,p+.02,J.METAL,h.map(e=>e*.8),!1):c.box(u-.02,i-.02,d+t-.03,f+.02,i+n+.02,d+t+.03,J.METAL,h.map(e=>e*.8),!1);let[g,_,y,b]=r?[f-t,d,f,p]:[u,p-t,f,p];c.box(g,F,_,y,i,b,J.METAL,h.map(e=>e*.9),!1),m.box(u,i,d,f,i+n,p,`equipment`),m.box(g,F,_,y,i,b,`equipment`),v.add(u,F,d,f,i+n,p),Ae(u,d,f,p,F,.8),M.duct=(M.duct??0)+1}}if(G>200&&(f===`postwar`||f===`loft`||f===`deco`||me||h)&&a()<.75)for(let e=0,t=1+Math.floor(a()*Math.min(3,G/300));e<t;e++){let e=4+a()*5,t=1.8+a()*.9,n=1.6+a()*.9,r=a()<.5,i=ke(r?e:t,r?t:e,n+.4,6);if(!i)continue;let[o,s]=i,l=o+(r?e:t),u=s+(r?t:e),d=X(Z(qt,a),a,.05);c.box(o,F,s,l,F+n,u,J.METAL,d),r?c.box(o-.02,F+.2,s+.1,o,F+n-.2,u-.1,J.LOUVRE,d.map(e=>e*.9),!1):c.box(o+.1,F+.2,s-.02,l-.1,F+n-.2,s,J.LOUVRE,d.map(e=>e*.9),!1);for(let i=0,a=Math.max(1,Math.floor(e/2.4));i<a;i++){let e=(i+.5)/a,f=r?o+(l-o)*e:(o+l)/2,p=r?(s+u)/2:s+(u-s)*e;c.cyl(f,p,t*.32,F+n,F+n+.25,d.map(e=>e*.85),10,J.METAL,Jt)}if(W(o,F,s,l,F+n,u),B(o,s,l,u,F+n),a()<.8){let e=.7+a()*.4,t=3+a()*8,n=F+.5,[i,d,f,p]=r?k>0?[l,(s+u)/2-e/2,l+t,(s+u)/2+e/2]:[o-t,(s+u)/2-e/2,o,(s+u)/2+e/2]:te>0?[(o+l)/2-e/2,u,(o+l)/2+e/2,u+t]:[(o+l)/2-e/2,s-t,(o+l)/2+e/2,s];if(H(i-0,d,f-i,p-d,e+.8)){c.box(i,n,d,f,n+e,p,J.METAL,Yt);for(let e=.5;e<t;e+=2.5){let[t,a]=r?[i+e,(d+p)/2]:[(i+f)/2,d+e];c.box(t-.05,F,a-.05,t+.05,n,a+.05,J.METAL,Xt,!1)}W(i,n,d,f,n+e,p)}}M.ahu=(M.ahu??0)+1}let Re=[],ze=Se?0:(R===`garden`||R===`pool`?.5:1)*Math.min(h?22:G>600?12:6,Math.floor(G/(me?h?110:p?130:200:p?150:85)+a()*1.6));for(let e=0;e<ze;e++){let t=a(),n=t<.12?0:t<.2?1:t<.28?2:t<.39?3:t<.47?4:t<.54?5:t<.62?6:t<.69?7:t<.8?8:t<.89?9:t<.94?10:11;p&&(n===8||n===10)&&(n=a()<.5?4:11);let[r,i,o]=[[1.3+a()*1.5,1+a()*1,.9+a()*.9],[.9+a()*.6,1+a()*.8,1.3+a()*.6],[1+a()*.5,1+a()*.5,1],[3.2+a()*2.8,1.7+a()*.6,1.2+a()*.5],[.9+a()*.3,.45+a()*.15,.75+a()*.2],[1+a()*.6,1+a()*.5,1.2+a()*.8],[1.6+a()*1,1.4+a()*.8,1.2+a()*.8],[.7+a()*.3,.45+a()*.1,1.5+a()*.4],[5+a()*4,2.1+a()*.5,1.9+a()*.5],[6+a()*8,1.1+a()*.6,.8+a()*.6],[3+a()*1.8,1.5+a()*.5,2+a()*.4],[.9+a()*.4,.9+a()*.4,.45+a()*.2]][n],s=[4,4,3,2,6,3,1,5,2,1,1,4][n],l=1+Math.floor(a()*(p?Math.min(2,s):s)),u=n===7?.05:n===4?.35+a()*.3:.5+a()*.7,d=a()<.5,f=l*r*1.1+(l-1)*u,h=i*1.25,g=null;if((n===4||n===7||n===0&&a()<.3)&&a()<.7){let e=Math.floor(a()*4),t=d?f:h,n=d?h:f;for(let r=0;r<5&&!g;r++){let r=e===0?V.x0:e===1?V.x1-t:V.x0+a()*Math.max(0,Me-t),i=e===2?V.z0:e===3?V.z1-n:V.z0+a()*Math.max(0,Ne-n);H(r,i,t,n,o+.5)&&(g=[r,i])}}if(g??=ke(d?f:h,d?h:f,o+.5,p?4:e>5?11:7,10)??(p?null:U(d?f:h,d?h:f,o+.5,8)),!g)continue;let _=X(Z(qt,a),a,.06),y=0;for(let e=0;e<l;e++){let e=r*(.9+a()*.2),t=i*(.92+a()*.16),s=o*(.9+a()*.2),l=(h-t)*a(),f=a()<.15?X(Z(qt,a),a,.06):X(_,a,.04),p=f.map(e=>e*.72),b=g[0]+(d?y:l),x=g[1]+(d?l:y),S=b+(d?e:t),C=x+(d?t:e);if(y+=e+u,S>V.x1||C>V.z1)break;let w=(b+S)/2,T=(x+C)/2,E=Math.min(S-b,C-x);if(n===0){c.box(b,F,x,S,F+s,C,J.METAL,f,p);let t=e>2.2?2:1;for(let e=0;e<t;e++){let n=(e+.5)/t,r=d?b+(S-b)*n:w,i=d?T:x+(C-x)*n,a=Math.min(E*.36,(d?S-b:C-x)/t*.38);c.cyl(r,i,a,F+s,F+s+.1,p,10,J.METAL,Jt)}W(b,F,x,S,F+s,C)}else if(n===1)c.box(b,F,x,S,F+s,C,J.LOUVRE,f,p,J.METAL),c.box(b-.05,F+s,x-.05,S+.05,F+s+.1,C+.05,J.METAL,p),W(b,F,x,S,F+s,C),m.box(b-.05,F+s,x-.05,S+.05,F+s+.1,C+.05,`equipment`);else if(n===2){let e=E*.45;c.box(b+.05,F,x+.05,S-.05,F+.35,C-.05,J.METAL,f.map(e=>e*.85)),c.lathe([w,F+.35,T],[0,1,0],[[e*.55,0],[e*.55,.35],[e,.45],[e*.9,.62],[e*.2,.78]],10,p,J.METAL),W(b+.05,F,x+.05,S-.05,F+.35,C-.05),m.cyl(w,T,F+.35,F+.8,e*.55,e*.2,`equipment`)}else if(n===3){let e=d?b+(S-b)*.42:x+(C-x)*.42,t=s*.72,[n,r,i,a]=d?[b,x,e,C]:[b,x,S,e],[o,l,u,h]=d?[e,x,S,C]:[b,e,S,C];c.box(n,F,r,i,F+s,a,J.METAL,f,p),c.box(o,F,l,u,F+t,h,J.LOUVRE,f.map(e=>e*.95),p,J.METAL);for(let e=0;e<2;e++){let n=(e+.5)/2,r=d?o+(u-o)*n:(o+u)/2,i=d?(l+h)/2:l+(h-l)*n,a=Math.min(E*.34,(d?u-o:h-l)*.2);c.cyl(r,i,a,F+t,F+t+.12,p,10,J.METAL,Jt)}let g=d?n+.35:i-.35,_=d?a-.35:r+.35;c.cyl(g,_,.045,F+s,F+s+.55,Y(4869197),6),m.cyl(g,_,F+s,F+s+.55,.044,.044,`equipment`),W(n,F,r,i,F+s,a),W(o,F,l,u,F+t,h)}else if(n===4){c.box(b,F+.15,x,S,F+s,C,J.METAL,X(Y(11776166),a,.05),X(Y(9342085),a,.05)),c.box(b+.05,F,x+.05,S-.05,F+.15,C-.05,J.METAL,Xt,!1);let t=Math.min(s*.36,e*.3),n=F+.15+(s-.15)/2;d?c.lathe([b+(S-b)*.4,n,C],[0,0,1],[[t,0],[.001,.005]],10,Jt,J.METAL):c.lathe([S,n,x+(C-x)*.4],[1,0,0],[[t,0],[.001,.005]],10,Jt,J.METAL),W(b,F+.15,x,S,F+s,C),m.box(b+.05,F,x+.05,S-.05,F+.15,C-.05,`equipment`)}else if(n===5){let n=Math.min(t,e)/2*.9,r=X(Z(nn,a),a,.05).map(e=>e*.8),i=s+a()*.6;c.box(b,F,x,S,F+.2,C,J.PAVERS,Y(9078139)),W(b,F,x,S,F+.2,C),c.lathe([w,F+.2,T],[0,1,0],[[n,0],[n,i],[n*.3,i+n*.3]],12,r,J.METAL,{cap:r.map(e=>e*.8)}),m.cyl(w,T,F+.2,F+.2+i,n,n,`equipment`),m.cyl(w,T,F+.2+i,F+.2+i+n*.3,n,n*.3,`equipment`),v.add(b,F,x,S,F+.2+i+n*.3,C),Ae(b,x,S,C,F,i)}else if(n===6){let e=a()<.5?X(Y(9209466),a,.06):X(rn,a,.08);c.box(b,F,x,S,F+s,C,J.PAVERS,e,!1);let t=.35,n=[w,F+s+t/2,T],r=(d?S-b:C-x)/2,i=(d?C-x:S-b)/2,o=Math.atan2(t,2*i),l=d?[1,0,0]:[0,0,1],u=d?[0,0,1]:[1,0,0];c.obox(n,[r+.05,.03,Math.hypot(i,t/2)+.05],l,[u[0]*-Math.sin(o),Math.cos(o),u[2]*-Math.sin(o)],[u[0]*Math.cos(o),Math.sin(o),u[2]*Math.cos(o)],J.METAL,Y(5593435),null,F),W(b,F,x,S,F+s,C),m.ramp(b-.05,F+s-.05,x-.05,S+.05,C+.05,d?2:0,F+s+.03,F+s+t+.03,`equipment`,0,.06)}else if(n===8)yn(c,m,b,x,S,C,F,s,d,f,p),W(b,F,x,S,F+s,C);else if(n===9){let e=d?S-b:C-x,t=d?C-x:S-b,n=2+Math.floor(a()*3),r=(e,t)=>d?[b+e,x+t]:[b+t,x+e];for(let n=.3;n<e-.1;n+=2.4){for(let i of[.1,t-.1]){let[t,a]=r(Math.min(n,e-.1),i);c.box(t-.05,F,a-.05,t+.05,F+s,a+.05,J.METAL,Xt,!1),m.box(t-.05,F,a-.05,t+.05,F+s,a+.05,`pole`)}let[i,a]=r(Math.min(n,e-.1)-.05,.05),[o,l]=r(Math.min(n,e-.1)+.05,t-.05);c.box(i,F+s-.1,a,o,F+s,l,J.METAL,Xt),m.box(i,F+s-.1,a,o,F+s,l,`pole`)}let i=.2;for(let r=0;r<n;r++){let n=.07+a()*.13;if(i+2*n>t-.15)break;let r=X(Z(sn,a),a,.06),o=i+n,l=F+s+n,u=d?[b,l,x+o]:[b+o,l,x];c.lathe(u,d?[1,0,0]:[0,0,1],[[n,0],[n,e]],8,r,J.METAL,{cap:r,base:F});let f=n*.92;d?m.box(b,l-f,x+o-f,S,l+f,x+o+f,`pole`):m.box(b+o-f,l-f,x,b+o+f,l+f,C,`pole`),i+=2*n+.08+a()*.15}v.add(b,F,x,S,F+s+.5,C),Ae(b,x,S,C,F,.4)}else if(n===10){let e=X(Z(cn,a),a,.05);c.box(b,F,x,S,F+s,C,J.LOUVRE,e,e.map(e=>e*.74),J.METAL);let t=d?S-.5:w,n=d?T:C-.5;c.cyl(t,n,.13,F+s,F+s+1.4,Y(4144442),8),m.cyl(t,n,F+s,F+s+1.4,.13,.13,`equipment`);let[r,i,o,l]=d?[b+.4,T-.28,b+1.8,T+.28]:[w-.28,x+.4,w+.28,x+1.8];c.box(r,F+s,i,o,F+s+.5,l,J.METAL,Y(5920596),Y(4867908)),m.box(r,F+s,i,o,F+s+.5,l,`equipment`),W(b,F,x,S,F+s,C)}else if(n===11){let e=X(Y(10132632),a,.08);c.box(b+.1,F,x+.1,S-.1,F+s,C-.1,J.METAL,e.map(e=>e*.85)),c.box(w-.18,F+s,T-.18,w+.18,F+s+.3,T+.18,J.METAL,Xt,!1),c.box(b,F+s+.3,x,S,F+s+.38,C,J.METAL,e,e.map(e=>e*.78)),W(b+.1,F,x+.1,S-.1,F+s,C-.1),m.box(w-.18,F+s,T-.18,w+.18,F+s+.3,T+.18,`equipment`),m.box(b,F+s+.3,x,S,F+s+.38,C,`equipment`),v.add(b,F,x,S,F+s+.4,C)}else{let e=a()<.5?X(Y(9080456),a,.05):X(Y(10656908),a,.05);c.box(b,F,x,S,F+s,C,J.METAL,e,e.map(e=>e*.78)),W(b,F,x,S,F+s,C)}M.hvac++}let b=Math.min(g[0]+(d?y:h),V.x1),x=Math.min(g[1]+(d?h:y),V.z1);if(Re.push([(g[0]+b)/2,(g[1]+x)/2,g[0],g[1],b,x]),B(g[0],g[1],b,x,F+o),a()<.45){let e=.18+a()*.2,t=.12,n=F+.18,r=(g[0]+b)/2,i=(g[1]+x)/2,o=(r,i,a,o)=>{let s=Math.min(r,a)-e/2,l=Math.max(r,a)+e/2,u=Math.min(i,o)-e/2,d=Math.max(i,o)+e/2;if(Math.max(l-s,d-u)<1.5||s<V.x0||u<V.z0||l>V.x1||d>V.z1||v.hit(s+.05,u+.05,l-.05,d-.05,F,.4))return;c.box(s,n,u,l,n+t,d,J.METAL,Y(7829882)),m.box(s,n,u,l,n+t,d,`equipment`);let f=Math.max(l-s,d-u);for(let e=.4;e<f;e+=2.2){let t=l-s>d-u?s+e:(s+l)/2,r=l-s>d-u?(u+d)/2:u+e;c.box(t-.04,F,r-.04,t+.04,n,r+.04,J.METAL,Xt,!1),m.box(t-.04,F,r-.04,t+.04,n,r+.04,`equipment`)}v.add(s,F,u,l,n+t,d)};d?o(r,i+(i<Oe[1]?h/2+.3:-h/2-.3),r,Oe[1]):o(r+(r<Oe[0]?h/2+.3:-h/2-.3),i,Oe[0],i)}}if(K){let e=(K.x1-K.x0)*(K.z1-K.z0);if(e>40&&(h||a()<.45)){let t=1+Math.floor(a()*(e>120?3:2)),n=3+a()*.6,r=K.x1-K.x0>K.z1-K.z0,i=r?t*n:n,o=r?n:t*n,s=2.4+a()*1,l=0,u=0,d=!1;for(let e=0;e<6&&!d;e++)l=K.x0+a()*Math.max(0,K.x1-K.x0-i),u=K.z0+a()*Math.max(0,K.z1-K.z0-o),d=l+i<=K.x1+.01&&u+o<=K.z1+.01&&!v.hit(l-.3,u-.3,l+i+.3,u+o+.3,K.y,s+.6);if(d){let e=X(Y(9278096),a,.06);c.box(l,K.y,u,l+i,K.y+s*.55,u+o,J.LOUVRE,e,!1),c.box(l,K.y+s*.55,u,l+i,K.y+s,u+o,J.METAL,e,e.map(e=>e*.8));for(let a=0;a<t;a++){let t=r?l+(a+.5)*n:l+i/2,d=r?u+o/2:u+(a+.5)*n,f=n*.4;c.lathe([t,K.y+s,d],[0,1,0],[[f,0],[f*1.06,.5],[f*1.1,.75]],10,e.map(e=>e*.9),J.METAL,{back:!0}),c.disc(t,K.y+s+.3,d,f*1.02,Jt,12),m.cyl(t,d,K.y+s,K.y+s+.75,f*.985,f*1.09,`equipment`)}W(l,K.y,u,l+i,K.y+s,u+o),B(l,u,l+i,u+o,K.y+s,K.y),M.ct++}}for(let e=0,t=1+Math.floor(a()*3);e<t;e++){let e=1.4+a()*1.4,t=1+a()*.9,n=.9+a()*.7,r=K.x1-K.x0-e,i=K.z1-K.z0-t;if(r<0||i<0)break;let o=K.x0+a()*r,s=K.z0+a()*i;if(v.hit(o-.3,s-.3,o+e+.3,s+t+.3,K.y,n+.3))continue;let l=Z(qt,a);c.box(o,K.y,s,o+e,K.y+n,s+t,J.METAL,l),c.cyl(o+e/2,s+t/2,Math.min(e,t)*.33,K.y+n,K.y+n+.1,l.map(e=>e*.8),10,J.METAL,Jt),W(o,K.y,s,o+e,K.y+n,s+t)}if(h&&a()<.6){let e=K.x0+(K.x1-K.x0)*(.2+a()*.6),t=K.z0+(K.z1-K.z0)*(.2+a()*.6);v.hit(e-.8,t-.8,e+.8,t+.8,K.y,12)||(xn(c,m,g,e,K.y,t,7+a()*10,a),v.add(e-.6,K.y,t-.6,e+.6,K.y+17,t+.6),M.ant++)}}!Se&&(p?a()<.42:a()<.3)&&vn(c,m,v,H,a,V,F,1+Math.floor(a()*3),M);for(let e=0,t=p&&de&&a()<.6?1+ +(a()<.3):0;e<t;e++){let e=a()<.5?ke(.4,.4,5,5,8):U(.4,.4,5,6);e&&(bn(c,m,e[0]+.2,F,e[1]+.2,2.5+a()*2.5,a),v.add(e[0],F,e[1],e[0]+.4,F+5,e[1]+.4),M.ant++)}if(!Se&&!h&&G>110&&(p||f===`loft`||me)&&a()<.2){let e=2+Math.floor(a()*4),t=Math.min(Me*.6,4+a()*8),n=1.7,r=.35,i=2.4,o=t,s=e*i,l=U(o,s,1.4,10);if(l){for(let a=0;a<e;a++){let e=l[1]+a*i,o=e+n*Math.cos(r)/2,s=F+.35,u=s+n*Math.sin(r),d=[l[0]+t/2,(s+u)/2+.03,o],f=[1,0,0],p=[0,Math.cos(r),-Math.sin(r)],h=[0,Math.sin(r),Math.cos(r)];c.obox(d,[t/2,.03,n/2],f,p,h,J.SOLAR,[1,1,1],null,F);for(let e of[l[0]+.3,l[0]+t-.3])c.box(e-.04,F,o+.3,e+.04,u-.1,o+.38,J.METAL,Xt,!1);m.ramp(l[0],s-.05,e,l[0]+t,e+n*Math.cos(r),2,s+.06,u+.06,`equipment`,0,.12)}v.add(l[0],F,l[1],l[0]+o,F+1.4,l[1]+s),M.solar++}}if(!Se&&(f===`loft`||f===`walkup`||f===`apt`||me)&&a()<.6){let e=a()<.4,t=1+Math.floor(a()*(G>200?4:2)),n=1.6+a()*2.2,r=1.4+a()*1.2,i=null;for(let o=0;o<t;o++){let t=e?r:n,o=r,s=.35+a()*.2,l=i?[i[0]+t+1.2,i[1]]:U(t,o,s+.9,8);if(i&&!H(l[0],l[1],t,o,s+.9)||!l)break;i=l;let[u,d]=l;if(c.box(u,F,d,u+t,F+s,d+o,J.METAL,Xt,!1),e){let e=Math.min(t,o)/2*Math.SQRT2,n=Math.min(t,o)*.4;c.lathe([u+t/2,F+s,d+o/2],[0,1,0],[[e,0],[.001,n]],4,[1,1,1],J.GLASS,{rot0:Math.PI/4}),m.box(u,F,d,u+t,F+s,d+o,`skylight`)}else c.box(u+.08,F+s,d+.08,u+t-.08,F+s+.02,d+o-.08,J.GLASS,[1,1,1]),m.box(u,F,d,u+t,F+s+.02,d+o,`skylight`);v.add(u,F,d,u+t,F+s+.5,d+o),M.sky++}}if(de&&(f===`walkup`||f===`apt`||f===`loft`&&a()<.4)){let e=i.sides||{},t=[`nx`,`px`,`nz`,`pz`].filter(t=>e[t]===`party`&&Math.abs(t===`nx`?l.x0-i.x0:t===`px`?i.x1-l.x1:t===`nz`?l.z0-i.z0:i.z1-l.z1)<.3),n=a()<.6?O.RED:O.BROWN;for(let e of t)if(!(a()<.35))for(let t=0,r=1+Math.floor(a()*3);t<r;t++){let r=.7+a()*.8,i=.5+a()*.4,s=1.2+a()*1.4,u=e===`nx`||e===`px`?`z`:`x`,d=a(),f,p,m,h;if(u===`z`?(m=i,h=r,f=e===`nx`?l.x0+ae+.02:l.x1-ae-.02-i,p=V.z0+d*Math.max(0,Ne-r)):(m=r,h=i,p=e===`nz`?l.z0+ae+.02:l.z1-ae-.02-i,f=V.x0+d*Math.max(0,Me-r)),v.hit(f+.01,p+.01,f+m-.01,p+h-.01,F,s))continue;let g={...l.p,style:A.BLANK,layer:n,tint:[.85,.8,.78],topY:F+s};o.fac.box(f,F,p,f+m,F+s,p+h,g,{},!0,!1,{...g,layer:O.CONCRETE,tint:[.45,.44,.42]}),W(f,F,p,f+m,F+s,p+h,`bulkhead`),t===0&&c.cyl(f+m/2,p+h/2,Math.min(m,h)*.22,F+s,F+s+.3,Y(6969936),5,J.METAL,Jt),M.chim++}}if(L){let e=L.x1-L.x0,t=L.z1-L.z0,r=.25,i={x0:Math.max(L.x0,V.x0-.45),z0:Math.max(L.z0,V.z0-.45),x1:Math.min(L.x1,V.x1+.45),z1:Math.min(L.z1,V.z1+.45)},o=[];Math.abs(L.x0-P.x0)<.1&&o.push([`x`,i.x0+r,i.z0+r,i.z1-r]),Math.abs(L.x1-P.x1)<.1&&o.push([`x`,i.x1-r-.8,i.z0+r,i.z1-r]),Math.abs(L.z0-P.z0)<.1&&o.push([`z`,i.z0+r,i.x0+r,i.x1-r]),Math.abs(L.z1-P.z1)<.1&&o.push([`z`,i.z1-r-.8,i.x0+r,i.x1-r]);for(let[e,t,n,r]of o){let i=n+a()*1.5;for(;i<r-1.2;){let n=Math.min(r-i,1.6+a()*2.2);if(a()<.75){let r=.55+a()*.2,o=r+.35+a()*.5,[s,l,u,d]=e===`x`?[t,i,t+.8,i+n]:[i,t,i+n,t+.8];if(!v.hit(s,l,u,d,F,o)){c.box(s,F,l,u,F+r,d,J.PAVERS,Zt,X(E,a,.15),J.GRAVEL);let e=T(),t=e<.4?[1,0,0,.12]:e<.65?[0,1,.15,0]:[.3,.35,.5,.4];re(s+.1,l+.1,u-.1,d-.1,F+r,t,2.4,.9),a(),W(s,F,l,u,F+r,d)}}i+=n+.4+a()*1.2}}let s=a();if(R===`pool`&&e*t>40||e*t>70&&s<.36&&(f===`apt`||f===`glass`||f===`postwar`||me)){let n=R===`pool`,r=Math.min(e-3,n?6+a()*7:4+a()*5),i=Math.min(t-3,n?3.5+a()*2.5:3+a()*3),o=L.x0+(e-r)/2,s=L.z0+(t-i)/2;if(r>2.5&&i>2&&!v.hit(o-.3,s-.3,o+r+.3,s+i+.3,F,1)){c.box(o-.3,F,s-.3,o+r+.3,F+.45,s+i+.3,J.PAVERS,Y(13223096),Y(16777215),-1,1),W(o-.3,F,s-.3,o+r+.3,F+.45,s+i+.3,`roof`),c.skin(o-1.4,s-1.4,o+r+1.4,s+i+1.4,F+.009,J.DECK,X([.95,.9,.85],a,.06),0,0,!1,.2);for(let e=o+.2;e<o+r-.6;e+=1.1){let t=s+i+.45;if(t+1.8>L.z1-.2||v.hit(e,t,e+.65,t+1.8,F,.5))break;c.box(e,F,t,e+.65,F+.35,t+1.8,J.METAL,X(Z($t,a),a,.05).map(e=>e*.9)),W(e,F,t,e+.65,F+.35,t+1.8)}if(n){for(let e=o+.4;e<o+r-.6;e+=1.3){let t=s-.45-1.8;if(t<L.z0+.2||v.hit(e,t,e+.65,t+1.8,F,.5))break;c.box(e,F,t,e+.65,F+.35,t+1.8,J.METAL,X(Z($t,N),N,.05).map(e=>e*.9)),W(e,F,t,e+.65,F+.35,t+1.8)}let e={x0:L.x0+1.2,z0:L.z0+1.2,x1:L.x1-1.2,z1:L.z1-1.2};for(let t=0,n=2+Math.floor(N()*3);t<n;t++){let t=U(2.2,2.2,2.6,6,e,!0);if(!t)break;let n=t[0]+1.1,r=t[1]+1.1,i=X(Z($t,N),N,.05);c.cyl(n,r,.03,F,F+2.2,Xt,5),c.lathe([n,F+2.05,r],[0,1,0],[[1.05,0],[.05,.38]],8,i,J.METAL,{back:!0,base:F}),m.cyl(n,r,F,F+2.05,.03,.03,`pole`),m.cyl(n,r,F+2.05,F+2.43,1.05,.05,`awning`),v.add(n-1.05,F,r-1.05,n+1.05,F+2.45,r+1.05)}let t=U(3.2,2.2,3,8,e,!0);if(t){let[e,n]=t,r=X(Z($t,N),N,.05);c.box(e,F,n,e+3.2,F+2.3,n+2.2,J.DECK,X(Qt,N,.1),!1),c.box(e-.25,F+2.3,n-.25,e+3.45,F+2.45,n+2.45,J.METAL,r.map(e=>e*.85),r),W(e,F,n,e+3.2,F+2.3,n+2.2),m.box(e-.25,F+2.3,n-.25,e+3.45,F+2.45,n+2.45,`awning`,1)}}M.pool++}}if(R===`garden`){let n={x0:L.x0+.9,z0:L.z0+.9,x1:L.x1-.9,z1:L.z1-.9};for(let r=0,i=Math.min(10,2+Math.floor(e*t/20));r<i;r++){let e=1.6+N()*3.6,t=1.4+N()*2.8,r=.35+N()*.35,i=U(e,t,2.5,6,n,!0);if(!i)continue;let[a,o]=i,s=a+e,l=o+t,u=N()<.5?X(Qt,N,.1):X(Zt,N,.08);c.box(a,F,o,s,F+r,l,N()<.5?J.DECK:J.PAVERS,u,X(E,N,.15),J.GRAVEL),W(a,F,o,s,F+r,l),N(),N();for(let n=0,r=Math.min(10,3+Math.floor(e*t/1.8));n<r*3;n++)N();let d=[[1,.3,.3,.4],[.3,1,.5,.1],[.3,.4,1,.3],[.6,.1,.3,1]][Math.floor(T()*4)],f=e*t>6&&N()<.5;if(re(a+.15,o+.15,s-.15,l-.15,F+r,d,f?1.5:1.9),f){let e=(a+s)/2,t=(o+l)/2;1.4+N()*1.2;let n=1+N()*.8;w.push({x:e,z:t,y:F+r-.02,kind:`small`,sc:n/2.6})}v.add(a,F,o,s,F+r+1.5,l)}M.gardenArch=(M.gardenArch??0)+1}if(!R&&e*t>50&&a()<.4&&!n.noBedGrid){let e=1.4+a()*.8,t=2.5+a()*2.5,n=e+1,r=t+1;for(let i=L.x0+1.4;i+e<L.x1-1.2;i+=n)for(let n=L.z0+1.4;n+t<L.z1-1.2;n+=r){if(a()<.4)continue;let r=t*(.5+a()*.5),o=n+a()*(t-r);if(v.hit(i-.2,o-.2,i+e+.2,o+r+.2,F,1))continue;let s=.4+a()*.2;c.box(i,F,o,i+e,F+s,o+r,J.DECK,X(Qt,a,.1),X(a()<.5?E:E.map(e=>e*1.25),a,.12),J.GRAVEL),W(i,F,o,i+e,F+s,o+r),re(i+.12,o+.12,i+e-.12,o+r-.12,F+s,T()<.5?[.1,.1,.5,1]:[.2,.3,1,.5],1.6,.8)}M.garden++}if(L.cell===J.DECK&&e*t>40&&a()<.35){let e=3+a()*2,t=2.5+a()*1.5,n=2.5,r=U(e,t,2.8,6,{x0:L.x0+.8,z0:L.z0+.8,x1:L.x1-.8,z1:L.z1-.8},!0);if(r){let[i,a]=r,o=i+e,s=a+t;for(let[e,t]of[[i,a],[o-.12,a],[i,s-.12],[o-.12,s-.12]])c.box(e,F,t,e+.12,F+n,t+.12,J.DECK,Qt),m.box(e,F,t,e+.12,F+n,t+.12,`pole`);for(let e=i;e<o;e+=.5)c.box(e,F+n,a-.1,e+.07,F+n+.14,s+.1,J.DECK,Qt);m.box(i,F+n,a-.1,o,F+n+.14,s+.1,`awning`,1),v.add(i,F,a,o,F+n+.2,s)}}for(let n=0,r=Math.floor(e*t/30);n<Math.min(r,12);n++){let e=U(1.8,1.8,2.6,5,{x0:L.x0+1.3,z0:L.z0+1.3,x1:L.x1-1.3,z1:L.z1-1.3},!0);if(!e)break;let t=e[0]+.9,n=e[1]+.9,r=a();if(r<.4){c.box(t-.45,F,n-.45,t+.45,F+.7,n+.45,J.PAVERS,Zt);let e=.8+a()*.4;w.push({x:t,z:n,y:F+.68,kind:`small`,sc:e/2.9}),T()<.5&&ee(t+.18,F+.68,n-.15,T()<.5?vt.BROAD:vt.FLOWER,.7),W(t-.45,F,n-.45,t+.45,F+.7,n+.45),v.add(t-e,F,n-e,t+e,F+3.2,n+e)}else r<.7?(c.box(t-.03,F,n-.03,t+.03,F+2.2,n+.03,J.METAL,Xt),c.box(t-1,F+2.2,n-1,t+1,F+2.32,n+1,J.METAL,X(Z($t,a),a,.05)),m.box(t-.03,F,n-.03,t+.03,F+2.2,n+.03,`pole`),m.box(t-1,F+2.2,n-1,t+1,F+2.32,n+1,`awning`,1),v.add(t-1,F,n-1,t+1,F+2.32,n+1)):(c.box(t-.9,F,n-.35,t+.9,F+.35,n+.35,J.DECK,Qt),W(t-.9,F,n-.35,t+.9,F+.35,n+.35))}if(l.parapet<.5){let e=(e,t,n,r)=>{let i=Math.hypot(n-e,r-t),a=Math.abs(n-e)>Math.abs(r-t),o=1.05;if(i<2)return;let[s,l]=a?[Math.min(e,n),t]:[e,Math.min(t,r)];a?(c.box(s,F+o-.05,l-.03,s+i,F+o,l+.03,J.METAL,Xt),m.box(s,F+o-.05,l-.03,s+i,F+o,l+.03,`pole`)):(c.box(s-.03,F+o-.05,l,s+.03,F+o,l+i,J.METAL,Xt),m.box(s-.03,F+o-.05,l,s+.03,F+o,l+i,`pole`));for(let e=0;e<=i;e+=1.5){let t=a?s+Math.min(e,i-.04):s,n=a?l:l+Math.min(e,i-.04);c.box(t-.02,F,n-.02,t+.02,F+o-.05,n+.02,J.METAL,Xt,!1)}M.rail++},t=.15;Math.abs(L.x0-l.x0)<.2&&e(l.x0+t,L.z0+t,l.x0+t,L.z1-t),Math.abs(L.x1-l.x1)<.2&&e(l.x1-t,L.z0+t,l.x1-t,L.z1-t),Math.abs(L.z0-l.z0)<.2&&e(L.x0+t,l.z0+t,L.x1-t,l.z0+t),Math.abs(L.z1-l.z1)<.2&&e(L.x0+t,l.z1-t,L.x1-t,l.z1-t)}}if(!Se&&!h&&de&&(f===`loft`||f===`apt`)&&G>150&&a()<.08){let e=4+a()*4,t=3+a()*2,n=2.4,r=U(e,t,2.9,8);if(r){let[i,a]=r,o=i+e,s=a+t;c.box(i,F,a,o,F+.5,s,J.PAVERS,Zt,!1),c.box(i,F+.5,a,o,F+n,s,J.GLASS,[1,1,1]),W(i,F,a,o,F+n,s,`skylight`),B(i,a,o,s,F+n)}}if(!Se&&!h&&de&&(p||f===`loft`)&&G>45){if(a()<.32){let e=1.8+a()*2.2,t=1.5+a()*1.4,n=2+a()*.5,r=.35,i=a()<.5,o=i?e:t,s=i?t:e,l=a()<.5?ke(o,s,n+r+.3,6,8):U(o,s,n+r+.3,8);if(l){let[e,t]=l,u=e+o,d=t+s,f=a()<.5,p=f?X(Z(an,a),a,.1):X(Z([Y(9080458),Y(8022616),Y(7042160)],a),a,.08);c.box(e,F,t,u,F+n,d,f?J.DECK:J.METAL,p,!1);let h=(i?o:s)/2+.12,g=(i?s:o)/2+.12,_=Math.atan2(r,2*g),v=i?[1,0,0]:[0,0,1],y=i?[0,0,1]:[1,0,0];c.obox([(e+u)/2,F+n+r/2,(t+d)/2],[h,.03,Math.hypot(g,r/2)],v,[y[0]*-Math.sin(_),Math.cos(_),y[2]*-Math.sin(_)],[y[0]*Math.cos(_),Math.sin(_),y[2]*Math.cos(_)],J.METAL,X(Z([Y(5922142),Y(7232072),Y(4869192),Y(8157810)],a),a,.08),null,F),W(e,F,t,u,F+n,d),m.ramp(e-.12,F+n-.05,t-.12,u+.12,d+.12,i?2:0,F+n+.03,F+n+r+.03,`equipment`,0,.06),M.shed=(M.shed??0)+1}}if(a()<.1){let e=U(3.2,2.2,2.6,6);if(e){let[t,n]=e,r=t+3.2,i=n+2.2;for(let[e,a]of[[t,n],[r-.1,n],[t,i-.1],[r-.1,i-.1]])c.box(e,F,a,e+.1,F+.7,a+.1,J.DECK,Qt,!1),m.box(e,F,a,e+.1,F+.7,a+.1,`pole`);c.box(t,F+.7,n,t+1.8,F+2.2,i,J.DECK,X([.85,.8,.72],a,.1),Y(4868680),J.EPDM),c.box(t+1.8,F+.7,n+.1,r,F+2,i-.1,J.LOUVRE,Y(5593178),Y(5922142),J.LOUVRE),m.box(t,F+.7,n,r,F+2.2,i,`equipment`),v.add(t,F,n,r,F+2.2,i),Ae(t,n,r,i,F,1.2)}}if(a()<.25)for(let e=0,t=2+Math.floor(a()*3);e<t;e++){let e=.5+a()*.9,t=.5+a()*.9,n=.15+a()*.7,r=ke(e,t,n+.2,3,5);if(!r)continue;let i=X(Z([Qt,Y(9079944),Y(5922142),Y(8020040),Y(7238760)],a),a,.1);c.box(r[0],F,r[1],r[0]+e,F+n,r[1]+t,n<.3?J.DECK:J.METAL,i),W(r[0],F,r[1],r[0]+e,F+n,r[1]+t)}if(l.parapet>.3&&a()<.45){let e=[`nz`,`pz`,`nx`,`px`].filter(e=>D[e]===`street`&&Math.abs(e===`nx`?l.x0-i.x0:e===`px`?i.x1-l.x1:e===`nz`?l.z0-i.z0:i.z1-l.z1)<.1);if(e.length){let t=Z(e,a),n=t===`nz`||t===`pz`,r=n?l.x1-l.x0:l.z1-l.z0,i=(n?l.x0:l.z0)+r*(.15+a()*.7),o=Y(3026736),s=I+1,u=ae+.9,d=t===`nz`||t===`nx`?-1:1,f=t===`nz`?l.z0:t===`pz`?l.z1:t===`nx`?l.x0:l.x1;for(let e of[-.25,.25]){let t=i+e,r=(e,r,i,a)=>{let[s,l,u,d]=n?[t-.025,Math.min(e,r),t+.025,Math.max(e,r)]:[Math.min(e,r),t-.025,Math.max(e,r),t+.025];c.box(s,i,l,u,a,d,J.METAL,o),m.box(s,i,l,u,a,d,`fireescape`)};r(f+d*.35,f+d*.4,I-1.5,s),r(f+d*.4,f-d*u,s-.05,s),r(f-d*(u-.05),f-d*u,F,s)}M.goose=(M.goose??0)+1}}}if(a()<.5){let e=ke(.9,.9,.7,4,6);e&&(c.box(e[0],F,e[1],e[0]+.9,F+.55,e[1]+.9,J.METAL,Y(9079946)),W(e[0],F,e[1],e[0]+.9,F+.55,e[1]+.9))}for(let e=0,t=Math.floor(a()*(p?5:4));e<t;e++){let e=ke(.4,.4,1.4,6,4);if(!e)continue;let t=.08+a()*.1,n=.5+a()*.8,r=e[0]+.2,i=e[1]+.2,o=a()<.5?Y(9409172):Y(3816252);a()<.5?(c.lathe([r,F,i],[0,1,0],[[t,0],[t,n],[t*2.2,n+.02],[t*2,n+.12],[.01,n+.2]],7,o,J.METAL),m.cyl(r,i,F+n,F+n+.12,t*2.2,t*2,`equipment`)):c.cyl(r,i,t,F,F+n,o,7),m.cyl(r,i,F,F+n,t*.95,t*.95,`equipment`),v.add(e[0],F,e[1],e[0]+.4,F+n+.2,e[1]+.4)}if(de&&h&&(l.parapet>.3||e.hero)&&Me>10&&Ne>10){let e=1.3,t=.14,n=.12,r=Y(7172210),i=[[V.x0+e,V.z0+e,V.x1-e,V.z0+e+t],[V.x0+e,V.z1-e-t,V.x1-e,V.z1-e],[V.x0+e,V.z0+e+t,V.x0+e+t,V.z1-e-t],[V.x1-e-t,V.z0+e+t,V.x1-e,V.z1-e-t]];for(let[e,t,a,o]of i)v.hit(e,t,a,o,F,.5)||(c.box(e,F,t,a,F+n,o,J.METAL,r),m.box(e,F,t,a,F+n,o,`equipment`),v.add(e,F,t,a,F+n,o));M.davit=(M.davit??0)+1}if(de&&h&&l.parapet>.3&&l.parapet<1.3&&j()<.55){let e=F,t=I-F+1,n=X(Y(9211532),j,.05),r=ae+.5,i=[[l.x0+r,l.z0+r,l.x1-r,l.z0+r],[l.x0+r,l.z1-r,l.x1-r,l.z1-r],[l.x0+r,l.z0+r,l.x0+r,l.z1-r],[l.x1-r,l.z0+r,l.x1-r,l.z1-r]];for(let[r,a,o,s]of i){let i=Math.abs(o-r)>Math.abs(s-a),l=i?o-r:s-a;if(!(l<2||v.hit(Math.min(r,o)-.05,Math.min(a,s)-.05,Math.max(r,o)+.05,Math.max(a,s)+.05,e,t))){v.add(Math.min(r,o)-.03,e,Math.min(a,s)-.03,Math.max(r,o)+.03,e+t,Math.max(a,s)+.03);for(let l of[e+t-.05,I+.45]){let e=i?[r,l,a-.025,o,l+.05,a+.025]:[r-.025,l,a,r+.025,l+.05,s];c.box(...e,J.METAL,n),m.box(...e,`pole`)}for(let o=0;o<=l;o+=2.4){let s=i?r+Math.min(o,l-.03):r,u=i?a:a+Math.min(o,l-.03);c.box(s-.025,e,u-.025,s+.025,e+t-.05,u+.025,J.METAL,n,!1),m.box(s-.025,e,u-.025,s+.025,e+t-.05,u+.025,`pole`)}}}M.grail=(M.grail??0)+1}if(G>60)for(let e=0,t=Math.min(4,1+Math.floor(G/300));e<t;e++){let e=V.x0+1+j()*Math.max(0,Me-2),t=V.z0+1+j()*Math.max(0,Ne-2);v.hit(e-.5,t-.5,e+.5,t+.5,F,.3)||De(e-.3,t-.3,e+.3,t+.3)||(c.disc(e,F+.012,t,.42,Y(2763304),8),c.cyl(e,t,.16,F,F+.11,Y(4868678),8),m.cyl(e,t,F,F+.11,.16,.16,`equipment`))}if(Re.length&&!Se&&G>90){let e=.75,t=X([1.25,1.22,1.15],a,.05),n=F+.015,r=[],i=(e,t)=>{if(t[0]>=e[2]||t[2]<=e[0]||t[1]>=e[3]||t[3]<=e[1])return[e];let n=[],r=Math.max(e[1],t[1]),i=Math.min(e[3],t[3]);return t[1]>e[1]&&n.push([e[0],e[1],e[2],t[1]]),t[3]<e[3]&&n.push([e[0],t[3],e[2],e[3]]),t[0]>e[0]&&n.push([e[0],r,t[0],i]),t[2]<e[2]&&n.push([t[2],r,e[2],i]),n},o=(a,o,s,l,u)=>{let d=u?Math.min(a,s):a-e/2,f=u?Math.max(a,s):a+e/2,p=u?o-e/2:Math.min(o,l),m=u?o+e/2:Math.max(o,l);if(d=Math.max(d,V.x0-.3),p=Math.max(p,V.z0-.3),f=Math.min(f,V.x1+.3),m=Math.min(m,V.z1+.3),(u?f-d:m-p)<1.2||f<=d||m<=p)return;let h=[[d,p,f,m]];if(oe)for(let e of r)h=h.flatMap(t=>i(t,e));r.push([d,p,f,m]);for(let[e,r,i,a]of h)i-e>.05&&a-r>.05&&c.skin(e,r,i,a,n,J.PAVERS,t,0,0,!1,.12)},[s,l]=Oe;for(let[e,t,n,r,i,a]of Re.slice(0,6)){let n=t<l?a+.5:r-.5;o(s,l,e,l,!0),o(e,l,e,n,!1)}M.pads=(M.pads??0)+1}}}Cn(t,v,m,b,S,M);let N=[],le=[],ue=[],F=[],I=0;for(let e of y.values()){let t=e.rb.build();if(!t)continue;let n=N.length;le[n]=t,I+=t.index.count/3,ue[n]=e.ao.build(),F[n]=e.sk.build(),e.rb=e.ao=e.sk=null,F[n]&&(M.streakTris=(M.streakTris??0)+F[n].index.count/3),N.push({i:n,ao:!!ue[n],sk:!!F[n],cx:e.cx,cz:e.cz,near:!0})}let de=N.map(e=>[e.cx,e.cz]),fe=Ce(le,d,`roofs`,{castShadow:!0,receiveShadow:!0,smallCasters:!0,merge:!1},de),me=Ce(ue,f,`roofAO`,{renderOrder:1},de),he=Ce(F,p,`roofStreaks`,{renderOrder:1},de);for(let t of[fe,me,he])for(let n of t.meshes)e.add(n);S.count&&S.build(e,`roof-trees`,!0,{tile:Ot*2,smallCasters:!0}),C.build(e),M.plants=C.count,M.roofTrees=w.length,typeof window<`u`&&(window.__roofPlants=C);let ge={...M,tiles:N.length,crowns:S.count,tris:I};console.log(`[rooftops]`,JSON.stringify(ge)),typeof window<`u`&&(window.__roofAt=(e,n)=>t.buildings.filter(t=>t.masses?.some(t=>e>=t.x0&&e<=t.x1&&n>=t.z0&&n<=t.z1)).map(e=>({type:e.A.type,H:e.H,lot:[e.lot.x0,e.lot.z0,e.lot.x1,e.lot.z1].map(Math.round),sides:e.lot.sides,masses:e.masses.map(e=>[e.x0,e.z0,e.x1,e.z1,e.y0,e.y1,e.parapet,e.crown?`C`:``,e.p?.layer].map(e=>typeof e==`number`?+e.toFixed(1):e))})));let L=null,R=null,_e=null;return{stats:ge,roofTrees:w,update(e){if(!e)return;let t=e.position;C.update(t),fe.endWarm();let n=!1;L||(L=new i,R=new _,_e=new h),R.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),L.setFromProjectionMatrix(R);for(let e of N){let r=Math.hypot(Math.max(0,Math.abs(t.x-e.cx)-128),Math.max(0,Math.abs(t.z-e.cz)-128)),i=e.near?r<690*s:r<650*s;e.near=i,fe.setVisible(e.i,i),fe.setShadow(e.i,r<230*s),!n&&!i&&!e.warm&&r<850*s&&(_e.center.set(e.cx,60,e.cz),_e.radius=200,L.intersectsSphere(_e)&&(fe.warm(e.i)?n=!0:e.warm=!0)),e.ao&&me.setVisible(e.i,r<520*s),e.sk&&he.setVisible(e.i,r<690*s)}}}}function vn(e,t,n,r,i,a,o,s,c){let l=Math.floor(i()*4),u=i(),d=l<2?a.x1-a.x0:a.z1-a.z0;for(let f=0;f<s;f++){let p=.35+i()*(i()<.2?.8:.3),m=2*p+.4,h=u*(d-m*s)+f*(m+.3+i()*.8);if(h<0||h+m>d)continue;let g=l<2?a.x0+h:l===2?a.x0:a.x1-m,_=l<2?l===0?a.z0:a.z1-m:a.z0+h;if(!r(g,_,m,m,2.2))continue;let v=g+m/2,y=_+m/2,b=.55+i()*.25,x=o+.5+p*.8,S=[0,Math.sin(b),-Math.cos(b)];e.box(v-.35,o,y-.35,v+.35,o+.12,y+.35,J.METAL,Y(5593178)),e.box(v-.04,o+.12,y-.04,v+.04,x,y+.04,J.METAL,Y(6974832),!1);let C=i()<.7?Y(13158080):Y(9211534),w=p*.28;e.lathe([v,x,y],S,[[.001,0],[p*.5,w*.25],[p,w]],8,C,J.METAL,{back:!0,base:o});let T=p*.9;e.obox([v+S[0]*T*.5,x+S[1]*T*.5,y+S[2]*T*.5],[.015,T*.5,.015],[1,0,0],S,[0,-S[2],S[1]],J.METAL,Y(4474440),null,o),t.box(v-.35,o,y-.35,v+.35,o+.12,y+.35,`equipment`),t.box(v-.04,o+.12,y-.04,v+.04,x,y+.04,`antenna`);let E=p*.7,D=y-E*Math.sin(b)+S[2]*w*.5,ee=y+E*Math.sin(b)+S[2]*w*.5;t.ramp(v-E,x-E*Math.cos(b)-.05,Math.min(D,ee),v+E,Math.max(D,ee),2,x+E*Math.cos(b)+S[1]*w*.5,x-E*Math.cos(b)+S[1]*w*.5,`antenna`,0,.06),n.add(g,o,_,g+m,x+p,_+m),c.dish++}}function yn(e,t,n,r,i,a,o,s,c,l,u){e.box(n,o,r,i,o+s*.8,a,J.LOUVRE,l,!1),e.box(n,o+s*.8,r,i,o+s,a,J.METAL,l.map(e=>e*.92),u);let d=c?i-n:a-r,f=c?a-r:i-n,p=Math.max(2,Math.floor(d/1.3)),m=f>2.3?2:1;for(let i=0;i<p;i++)for(let a=0;a<m;a++){let l=(i+.5)/p*d,h=(a+.5)/m*f,g=Math.min(d/p,f/m)*.4,_=c?n+l:n+h,v=c?r+h:r+l;e.lathe([_,o+s,v],[0,1,0],[[g,0],[g,.26]],10,u.map(e=>e*.85),J.METAL,{back:!0}),e.disc(_,o+s+.1,v,g*.98,Jt,10),t.cyl(_,v,o+s,o+s+.26,g,g,`equipment`)}}function bn(e,t,n,r,i,a,o){let s=Y(6119522);e.box(n-.025,r,i-.025,n+.025,r+a,i+.025,J.METAL,s);let c=o()*Math.PI;for(let t=0;t<3;t++){let o=r+a-.2-t*.35,l=.9-t*.15;e.obox([n,o,i],[l,.012,.012],[Math.cos(c),0,Math.sin(c)],[0,1,0],[-Math.sin(c),0,Math.cos(c)],J.METAL,s,null,r)}t.box(n-.025,r,i-.025,n+.025,r+a,i+.025,`antenna`)}function xn(e,t,n,r,i,a,o,s){let c=s()<.5?Y(10395808):Y(9062970),l=.5,u=[0,1,2].map(e=>[r+Math.cos(e*2.094)*l,a+Math.sin(e*2.094)*l]);for(let[n,r]of u)e.box(n-.04,i,r-.04,n+.04,i+o,r+.04,J.METAL,c),t.box(n-.04,i,r-.04,n+.04,i+o,r+.04,`antenna`);for(let t=i+1.2;t<i+o;t+=1.2)e.lathe([r,t,a],[0,1,0],[[l,0],[l,.05]],3,c,J.METAL,{back:!0,rot0:0});let d=3+s()*3;e.cyl(r,a,.05,i+o,i+o+d,c,5),t.cyl(r,a,i+o,i+o+d,.05,.05,`antenna`),n.add(r,i+o,a,0,1,0,`pole`)}function Sn(e,t,n,r,i,a,o,s,c){let l=c()<.3,u=l?.8+c()*1.2:2.6+c()*2.2,d=s*(l?1.8:2+c()*.4),f=Z(en,c),p=s*.72;for(let[n,r]of[[i-p,o-p],[i+p,o-p],[i-p,o+p],[i+p,o+p]])e.box(n-.1,a,r-.1,n+.1,a+u,r+.1,J.METAL,f),t.box(n-.1,a,r-.1,n+.1,a+u,r+.1,`watertower`);if(u>1.5){let t=a+u*.5;e.box(i-p,t-.04,o-p-.03,i+p,t+.04,o-p+.03,J.METAL,f,!1),e.box(i-p,t-.04,o+p-.03,i+p,t+.04,o+p+.03,J.METAL,f,!1),e.box(i-p-.03,t-.04,o-p,i-p+.03,t+.04,o+p,J.METAL,f,!1),e.box(i+p-.03,t-.04,o-p,i+p+.03,t+.04,o+p,J.METAL,f,!1)}let m=a+u;if(e.box(i-s*1.05,m-.25,o-s*1.05,i+s*1.05,m,o+s*1.05,J.DECK,f.map(e=>e*1.1)),t.box(i-s*1.05,m-.25,o-s*1.05,i+s*1.05,m,o+s*1.05,`watertower`,1),l){let n=Z(nn,c);e.lathe([i,m,o],[0,1,0],[[s,0],[s,d],[s*.97,d+.05],[s*.3,d+s*.3],[.01,d+s*.34]],12,n,J.METAL),t.cyl(i,o,m,m+d,s*.99,s*.99,`watertower`),t.cyl(i,o,m+d,m+d+s*.3,s*.97*.98,s*.3,`watertower`)}else{let n=X([1,1,1],c,.12),r=Z(tn,c);e.lathe([i,m,o],[0,1,0],[[s,0],[s*.96,d]],12,n,J.STAVES),e.lathe([i,m+d,o],[0,1,0],[[s*1.04,0],[s*.12,s*.7],[.01,s*.75]],12,r,J.METAL,{back:!0}),e.cyl(i,o,.06,m+d+s*.7,m+d+s*.7+.5,Y(3815994),5),t.cyl(i,o,m,m+d,s*.99,s*.96*.99,`watertower`),t.cyl(i,o,m+d,m+d+s*.7,s*1.02,s*.12,`watertower`,1)}let h=m+d+(l?s*.3:s*.7);n.add(i,h,o,0,1,0,`waterTower`);for(let e=0;e<4;e++){let t=e*Math.PI/2+.4;n.add(i+Math.cos(t)*(s+.05),m+d*.6,o+Math.sin(t)*(s+.05),Math.cos(t),0,Math.sin(t),`waterTower`)}r.add(i-s*1.1,a,o-s*1.1,i+s*1.1,h+.5,o+s*1.1,Ut)}function Cn(e,t,n,r,i,a){let o=new Kt(n,.6),s=ne.WALK;for(let t of e.buildings){let e=t.lot,c=e.sides||{},l=c.pz===`rear`?1:c.nz===`rear`?-1:0;if(!l)continue;let u=ae(e.cx,e.cz);if(!u)continue;let d=ce(Math.floor(Math.abs(e.x0*31.7+e.z0*7.3))+5),f=l>0?e.z1:e.z0,p=0,m=l>0?u.pz1-f:f-u.pz0;for(;p<m&&!o.hit(e.x0+.5,l>0?f+p:f-p-.5,e.x1-.5,l>0?f+p+.5:f-p,s-.5,3);)p+=.5;if(p<2)continue;let h=p>=m-.1?p:p/2,g=e.x0+.05,_=e.x1-.05,v=l>0?f+.05:f-h+.02,y=l>0?f+h-.02:f-.05;if(_-g<2||y-v<1.5||o.hit(g+.1,v+.1,_-.1,y-.1,s-.5,3))continue;let b=r(e.cx,e.cz).rb,x=d(),S=x<.45?J.LAWN:x<.7?J.PAVERS:x<.85?J.GRAVEL:J.TAR;b.skin(g,v,_,y,s+.012,S,X(S===J.LAWN?[.95,.95,.9]:[.92,.92,.9],d,.1),d()*40,d()*40,!1,.6);let C=Z(an,d),w=1.6+d()*.4,T=.05,E=(e,t,r,i)=>{if(Math.abs(r-e)<.3&&Math.abs(i-t)<.3)return;let a=Math.min(e,r)-T/2,c=Math.max(e,r)+T/2,l=Math.min(t,i)-T/2,u=Math.max(t,i)+T/2;o.hit(a+.06,l+.06,c-.06,u-.06,s-.5,2)||(b.box(a,s,l,c,s+w,u,J.DECK,C,C),n.box(a,s,l,c,s+w,u,`wall`))};E(e.x0+.03,v,e.x0+.03,y),E(e.x1-.03,v,e.x1-.03,y),(h<p-.2||p>=m-.1)&&E(g,l>0?y:v,_,l>0?y:v);let D={x0:g+.5,z0:v+.5,x1:_-.5,z1:y-.5};if(d()<.25&&D.x1-D.x0>2.5&&D.z1-D.z0>2.2){let e=1.8+d()*.8,t=1.6+d()*.6,r=2.1,i=d()<.5?D.x0:D.x1-e,a=l>0?D.z1-t:D.z0,o=Z(an,d).map(e=>e*1.1);b.box(i,s,a,i+e,s+r,a+t,J.DECK,o,Y(4868680),J.EPDM),n.box(i,s,a,i+e,s+r,a+t,`equipment`)}for(let e=0,t=d()<.8?(_-g)*(y-v)>90&&d()<.5?2:1:0;e<t&&!(D.x1-D.x0<2||D.z1-D.z0<2);e++){let e=D.x0+d()*(D.x1-D.x0),t=D.z0+d()*(D.z1-D.z0),r=Math.min(e-g,_-e,t-v,y-t)+1.6,a=Math.min(r,2.4+d()*2.4),o=3+d()*4;b.cyl(e,t,.15,s,s+o,Y(4865588),6,J.DECK),n.cyl(e,t,s,s+o,.14,.14,`pole`),i.add(e,s+o-a*.55,t,a,.3)}a.yard++}}function wn(e,t,n,r){let i=t();return e===`glass`?i<.5?J.GRAVEL:i<.75?J.BITUMEN:J.PAVERS:r>85?i<.42?J.GRAVEL:i<.62?J.BITUMEN:i<.74?J.EPDM:i<.84?J.PAVERS:J.TAN:e===`postwar`?i<.3?J.GRAVEL:i<.5?J.BITUMEN:i<.65?J.MEMBRANE:i<.8?J.EPDM:i<.9?J.SILVER:J.TAR:e===`deco`?i<.45?J.GRAVEL:i<.7?J.TAN:i<.92?J.PAVERS:J.RED:e===`walkup`||n.harlem>.5?i<.32?J.TAR:i<.56?J.SILVER:i<.74?J.BITUMEN:i<.8?J.RED:i<.92?J.GRAVEL:J.EPDM:e===`apt`?i<.26?J.TAR:i<.48?J.GRAVEL:i<.62?J.SILVER:i<.76?J.TAN:i<.81?J.RED:J.BITUMEN:i<.25?J.TAR:i<.45?J.BITUMEN:i<.6?J.GRAVEL:i<.7?J.MEMBRANE:i<.82?J.SILVER:i<.87?J.RED:J.TAN}var Tn=`// signage shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
in vec2 aSig;\r
in vec2 aLoc;\r
out vec2 vSig;\r
out vec2 vLoc;\r
out vec3 vWPs;\r
// @section vertexFogVertex\r
#include <fog_vertex>\r
vSig = aSig;\r
vLoc = aLoc;\r
vWPs = (modelMatrix * vec4(transformed, 1.0)).xyz;\r
// @section fragmentCommon\r
#include <common>\r
uniform sampler2D tSigns;\r
uniform sampler2D tArt;\r
uniform sampler2D tNoiseS;\r
in vec2 vSig;\r
in vec2 vLoc;\r
in vec3 vWPs;\r
float sgR;\r
float sgM;\r
vec3 sgE;\r
uniform float uNightK;\r
uniform float uScreenK;\r
uniform float uScrBoost;\r
uniform float uScrKnee;\r
uniform float uScrTop;\r
// @section fragmentMap\r
\r
// @section fragmentColor\r
#include <color_fragment>\r
int K = int(vSig.x + 0.5);\r
vec4 tx = vec4(1.0);\r
sgR = 0.55;\r
sgM = 0.0;\r
sgE = vec3(0.0);\r
vec2 ledF = vec2(0.0);\r
float ledAA = 0.0;\r
if(K == 3) { // (r2) LED pixel grid: 1 diode per 4 atlas texels (~10 cm on a 12 m screen), image sampled per diode\r
vec2 lp = vMapUv * 1024.0;\r
ledF = fract(lp) - 0.5;\r
ledAA = clamp(1.6 - 2.2 * max(fwidth(lp.x), fwidth(lp.y)), 0.0, 1.0);\r
tx = texture(map, mix(vMapUv, (floor(lp) + 0.5) / 1024.0, ledAA));\r
} else if(K > 0 && K != 6 && K != 7) tx = vMapUv.x > 3.5 ? texture(tArt, vMapUv - vec2(4.0, 0.0)) : vMapUv.x > 1.5 ? texture(tSigns, vMapUv - vec2(2.0, 0.0)) : texture(map, vMapUv);\r
vec3 nzA = texture(tNoiseS, (vWPs.xz + vWPs.yy * vec2(0.7, - 0.4)) / 9.0).rgb;\r
vec3 nzB = texture(tNoiseS, (vWPs.xz * 0.6 + vWPs.yy * vec2(- 0.5, 0.8)) / 1.7).rgb;\r
float lum = dot(tx.rgb, vec3(0.2126, 0.7152, 0.0722));\r
if(K == 0) {\r
sgR = 0.5 + 0.3 * nzB.r;\r
sgM = 0.35;\r
diffuseColor.rgb *= 0.85 + 0.3 * nzA.g;\r
} else if(K == 1) { // printed vinyl (r3: ~30% desaturated, uneven sun fade, rain streaks from the top rail, grimy curling edges)\r
tx.rgb = mix(tx.rgb, vec3(lum), 0.32) * 0.86 + 0.02;\r
tx.rgb = mix(tx.rgb, vec3(lum * 0.85 + 0.1), smoothstep(0.35, 0.8, nzA.b) * 0.16 + 0.08 * vLoc.y);\r
float stk = smoothstep(0.55, 0.9, texture(tNoiseS, vec2(vWPs.x + vWPs.z, vWPs.y * 0.08) * 0.35).g) * (0.35 + 0.65 * vLoc.y);\r
tx.rgb *= 1.0 - 0.24 * stk;\r
vec2 ed = min(vLoc, 1.0 - vLoc);\r
float edg = 1.0 - smoothstep(0.004, 0.035, min(ed.x, ed.y * 0.5) + 0.018 * (nzB.r - 0.5));\r
tx.rgb = mix(tx.rgb, tx.rgb * 0.5 + vec3(0.035, 0.032, 0.028), edg * 0.75);\r
diffuseColor.rgb *= tx.rgb;\r
sgR = 0.48 + 0.34 * nzB.g;\r
} else if(K == 2) { // painted on brick (vertex colour = the wall): chalky, faded, mortar courses, flaking paint\r
// (textures r5) critic: 'painted wall ads crisp / fresh'. Sun-bleached, chalky, soaked into the brick: stronger\r
// desaturation + value cap, brick colour bleeding through, a paler top (sun fade), more and wider flaking.\r
tx.rgb = mix(tx.rgb, vec3(lum), 0.45) * 0.66 + 0.05;\r
tx.rgb = min(tx.rgb, vec3(0.6)) * mix(vec3(1.0), diffuseColor.rgb / max(dot(diffuseColor.rgb, vec3(0.333)), 0.05), 0.18);\r
tx.rgb = mix(tx.rgb, vec3(dot(tx.rgb, vec3(0.333))) * 1.08 + 0.02, 0.35 * smoothstep(0.3, 1.0, vLoc.y));\r
float course = abs(fract(vWPs.y / 0.0762) - 0.5), fw = fwidth(vWPs.y / 0.0762);\r
tx.rgb *= 1.0 - 0.2 * smoothstep(0.4, 0.5, course) * clamp(1.0 - fw * 3.0, 0.0, 1.0);\r
float peel = smoothstep(0.6, 0.76, nzA.r * 0.7 + nzB.g * 0.45 + 0.08 * (vLoc.y - 0.5));\r
diffuseColor.rgb = mix(tx.rgb, diffuseColor.rgb, min(1.0, peel * 0.9 + 0.1));\r
sgR = 0.88;\r
} else if(K == 3) { // LED screen: dark glass, image emitted through a diode grid (dark louvre lines between)\r
float dio = 1.0 - smoothstep(0.26, 0.42, max(abs(ledF.x), abs(ledF.y)));\r
float grid = mix(1.0, dio * 1.55, ledAA);\r
sgE = tx.rgb * vSig.y * grid;\r
diffuseColor.rgb *= tx.rgb * 0.12;\r
sgR = 0.25;\r
} else if(K == 6) { // (r2) marquee bulbs: uv = bulb index (x, y), warm incandescent dots on the dark trim\r
vec2 bf = fract(vMapUv) - 0.5;\r
float bw = max(fwidth(vMapUv.x), fwidth(vMapUv.y));\r
float bulb = 1.0 - smoothstep(0.2, 0.34, length(bf));\r
bulb = mix(bulb, 0.3, clamp(bw * 1.5 - 0.3, 0.0, 1.0));\r
float flick = 0.85 + 0.15 * fract(sin(dot(floor(vMapUv) + vWPs.xz, vec2(12.9898, 78.233))) * 43758.5453);\r
sgE = vec3(1.0, 0.78, 0.46) * vSig.y * bulb * flick;\r
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.8, 0.6), bulb);\r
sgR = mix(0.5, 0.15, bulb);\r
} else if(K == 4) { // back-lit sign box face\r
sgE = tx.rgb * vSig.y;\r
diffuseColor.rgb *= tx.rgb * 0.85;\r
sgR = 0.35;\r
} else if(K == 7) { // (r3) awning / canopy fabric: vertex colour, optional stripes (vSig.y = stripe count), soiling\r
float st = vSig.y > 0.5 ? step(0.5, fract(vLoc.x * vSig.y)) : 0.0;\r
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.58, 0.5), st * 0.85) * (0.82 + 0.3 * nzB.g) * (1.0 - 0.18 * smoothstep(0.5, 0.85, nzA.r));\r
sgR = 0.88;\r
} else if(K == 8) { // (r3) cut brass building-name letters (light lettering of a sign cell; board discarded)\r
if(smoothstep(0.3, 0.5, lum) < 0.5) discard;\r
diffuseColor.rgb *= 0.8 + 0.3 * nzB.r;\r
sgM = 0.85;\r
sgR = 0.32 + 0.2 * nzA.g;\r
} else if(K == 9) { // (r4) second-floor window lettering: gold-leaf / white vinyl letters on the glass (board discarded)\r
if(smoothstep(0.28, 0.42, lum) < 0.5) discard;\r
diffuseColor.rgb = tx.rgb * (0.78 + 0.25 * nzB.r);\r
sgM = tx.r > tx.b * 1.4 ? 0.6 : 0.0;\r
sgR = 0.38 + 0.2 * nzA.g;\r
sgE = tx.rgb * 0.35 * uNightK; // back-lit by the room at night\r
} else { // (r3) ghost sign: world-space flaking paint (per brick + patches, mortar joints break it), uneven fade; no screen dither\r
vec3 brd = vMapUv.x > 3.5 ? texture(tArt, vMapUv - vec2(4.0, 0.0), 5.0).rgb : texture(tSigns, vMapUv - vec2(2.0, 0.0), 5.0).rgb; // heavily blurred cell ~ the board colour\r
float lumL = smoothstep(0.1, 0.24, abs(lum - dot(brd, vec3(0.2126, 0.7152, 0.0722)))); // lettering = contrast vs board (light or dark boards)\r
tx.rgb = mix(tx.rgb, vec3(lum), 0.5);\r
float bc = vWPs.y / 0.0762, row = floor(bc);\r
float hx = (vWPs.x + vWPs.z) / 0.2032 + 0.5 * mod(row, 2.0);\r
float bh = fract(sin(dot(vec2(floor(hx), row), vec2(12.9898, 78.233))) * 43758.5453);\r
float nearB = clamp(1.4 - 3.0 * max(fwidth(bc), fwidth(hx) * 0.4), 0.0, 1.0);\r
float wear = smoothstep(0.3, 0.85, nzA.r * 0.6 + nzB.b * 0.5 + 0.2 * (0.5 - vLoc.y));\r
float cov = mix(0.04, 0.97, lumL) /* (textures r5) 0.16 -> 0.04: board-paint speckle read as white grunge */ * (1.0 - 0.7 * wear) * clamp(vSig.y * 1.7, 0.0, 1.2);\r
float val = mix(nzB.g, 0.5 * nzB.g + 0.5 * bh, nearB);\r
float fb = fract(bc), fh = fract(hx);\r
float mj = max(1.0 - smoothstep(0.035, 0.07, min(fb, 1.0 - fb)), 1.0 - smoothstep(0.012, 0.025, min(fh, 1.0 - fh)));\r
if(val > cov || mj * nearB > 0.6) discard;\r
// (textures r3) ghost paint read as white blobs at grazing angles / mid range: soaked-in, darker paint (letters cap\r
// ~0.5 albedo, tinted by the brick), fading further toward the wall once the bricks go sub-pixel\r
// (textures r4) critic: 'ghost sign too crisp / high-contrast; fade it, brick bleed-through': more of the brick\r
// colour in the paint and a higher floor of wall show-through\r
vec3 gp = min(tx.rgb * 0.58 + 0.04, vec3(0.46)) * mix(vec3(1.0), diffuseColor.rgb / max(dot(diffuseColor.rgb, vec3(0.333)), 0.05), 0.45);\r
diffuseColor.rgb = mix(gp, diffuseColor.rgb, min(0.94, 0.5 + 0.35 * wear + 0.15 * bh * nearB + 0.2 * (1.0 - nearB)));\r
sgR = 0.92;\r
}\r
// @section fragmentRoughness\r
float roughnessFactor = sgR;\r
// @section fragmentMetalness\r
float metalnessFactor = sgM;\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
__SHADER_INJECT_0____SHADER_INJECT_1__if((K == 3 || K == 4) && uNightK > 0.0) {\r
float scrM = max(max(tx.r, tx.g), tx.b);\r
if(scrM > uScrKnee) {\r
float scrW = uScrTop - uScrKnee;\r
float scrY = uScrKnee + scrW * (1.0 - exp(- (scrM - uScrKnee) / scrW));\r
sgE *= mix(1.0, scrY / scrM, uNightK);\r
}\r
}\r
if(uNightK > 0.0) {\r
if(K == 1) sgE += diffuseColor.rgb * uNightK * 0.28 * (0.5 + 0.5 * smoothstep(0.2, 1.0, vLoc.y));\r
}\r
totalEmissiveRadiance += sgE;\r
`,{district:En,mulberry32:Dn,streetsAt:On,SITES:kn}=ue,An=w(()=>Tn),jn=pe(`city/tex/`),Mn=512,Nn=typeof location<`u`?new URLSearchParams(location.search):new URLSearchParams,Pn=Nn.has(`nosignage`);function Fn(e,t,n=[]){let r=Array.from({length:e},()=>[]);return(i,a,o=null)=>{let s=0,c=-1;for(let l=0;l<e;l++){if(o&&o(l)||n.includes(l))continue;let e=1e5;for(let t of r[l])e=Math.min(e,Math.hypot(t[0]-i,t[1]-a));e+=t()*40,e>c&&(c=e,s=l)}return r[s].push([i,a]),s}}function In(e,t,n,r,i,a,o,s=o){let c=2/o,l=2/s;if(e+=c,n-=2*c,t+=l,r-=2*l,a>i){let e=i/a;t+=r*(1-e)/2,r*=e}else{let t=a/i;e+=n*(1-t)/2,n*=t}return[e,t,e+n,t+r]}var Ln=(e,t)=>In(e%8/8,1-(Math.floor(e/8)+1)/16,1/8,1/16,2,t,4096),Rn=(e,t)=>In(e%16/16,.5-(Math.floor(e/16)+1)/8,1/16,1/8,.5,t,4096),zn=(e,t)=>{let n=In(e%4/4,1-(Math.floor(e/4)+1)/16,1/4,1/16,4,t,2048);return n[0]+=2,n[2]+=2,n},Bn=(e,t,n,r,i)=>{let a=In(e/2048,1-(t+r)/1792,n/2048,r/1792,4,i,2048,1792);return a[0]+=4,a[2]+=4,a},Vn=(e,t)=>Bn(e%2*1024,Math.floor(e/2)*256,1024,256,t),Hn=(e,t)=>Bn(e%4*512,1024+Math.floor(e/4)*128,512,128,t),Un=(e,t)=>Bn(e%4*512,1280+Math.floor(e/4)*128,512,128,t),Wn=[1,4,8,11,12,13,19,21,24,28,33,35,36,37,40,48,52,56,60,61,62,63],Gn=[2,11,12,13,15,19,24,32,36,41,44,45,46,51,52,56,59,61],Kn=class{constructor(){this.p=[],this.n=[],this.uv=[],this.c=[],this.s=[],this.l=[],this.i=[],this.v=0}quad(e,t,n,r,i,a){for(let n of e)this.p.push(n[0],n[1],n[2]),this.n.push(t[0],t[1],t[2]),this.c.push(r[0],r[1],r[2]),this.s.push(i,a);n?this.uv.push(n[0],n[1],n[2],n[1],n[2],n[3],n[0],n[3]):this.uv.push(0,0,0,0,0,0,0,0),this.l.push(0,0,1,0,1,1,0,1),this.i.push(this.v,this.v+1,this.v+2,this.v,this.v+2,this.v+3),this.v+=4}build(){if(!this.v)return null;let e=new v;return e.setAttribute(`position`,new o(this.p,3)),e.setAttribute(`normal`,new o(this.n,3)),e.setAttribute(`uv`,new o(this.uv,2)),e.setAttribute(`color`,new o(this.c,3)),e.setAttribute(`aSig`,new o(this.s,2)),e.setAttribute(`aLoc`,new o(this.l,2)),e.setIndex(this.v>65535?new n(this.i,1):new u(this.i,1)),e.computeBoundingSphere(),e.computeBoundingBox(),e}},qn=e=>[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255].map(e=>e**2.2);function Jn(e,t){switch(t){case`pz`:return{O:[e.x0,e.z1],T:[1,0],N:[0,1],W:e.x1-e.x0,s:t};case`nz`:return{O:[e.x1,e.z0],T:[-1,0],N:[0,-1],W:e.x1-e.x0,s:t};case`px`:return{O:[e.x1,e.z1],T:[0,-1],N:[1,0],W:e.z1-e.z0,s:t};default:return{O:[e.x0,e.z0],T:[0,1],N:[-1,0],W:e.z1-e.z0,s:t}}}var Q=(e,t,n,r)=>[e.O[0]+e.T[0]*t+e.N[0]*r,n,e.O[1]+e.T[1]*t+e.N[1]*r],$=(e,t,n,r,i,a,o)=>{let s=Q(e,t,n,r),c=Q(e,i,a,o);return[Math.min(s[0],c[0]),n,Math.min(s[2],c[2]),Math.max(s[0],c[0]),a,Math.max(s[2],c[2])]};function Yn(e,t,n,r,i,a,o,s,c,l=null,u=0,d=0,f=63,p=0){let m=(e,n,r)=>Q(t,e,n,r),h=[t.T[0],0,t.T[1]],g=[t.N[0],0,t.N[1]],_=e=>e.map(e=>-e);f&1&&e.quad([m(n,i,s),m(r,i,s),m(r,a,s),m(n,a,s)],g,l,l?[1,1,1]:c,l?u:p,d),f&2&&e.quad([m(r,i,o),m(n,i,o),m(n,a,o),m(r,a,o)],_(g),null,c,p,0),f&4&&e.quad([m(r,i,s),m(r,i,o),m(r,a,o),m(r,a,s)],h,null,c,p,0),f&8&&e.quad([m(n,i,o),m(n,i,s),m(n,a,s),m(n,a,o)],_(h),null,c,p,0),f&16&&e.quad([m(n,a,s),m(r,a,s),m(r,a,o),m(n,a,o)],[0,1,0],null,c.map(e=>e*1.1),p,0),f&32&&e.quad([m(n,i,o),m(r,i,o),m(r,i,s),m(n,i,s)],[0,-1,0],null,c.map(e=>e*.6),p,0)}function Xn(e,t,n,r,i,a,o,s){let c=$(t,n,i,o,r,a,s);e.box(c[0],c[1],c[2],c[3],c[4],c[5])}function Zn(e){let t=me(e);return t.colorSpace=s,t.anisotropy=8,t}function Qn(e,t,n,r,i){let a=new b({map:e,vertexColors:!0,roughness:.6,metalness:0,transparent:r,depthWrite:!r,polygonOffset:r,polygonOffsetFactor:r?-3:0,polygonOffsetUnits:r?-3:0});r&&Object.assign(a,{blending:5,blendEquation:100,blendSrc:204,blendDst:205,blendSrcAlpha:200,blendDstAlpha:201});let o={tSigns:{value:t},tNoiseS:{value:n},tArt:{value:i},uNightK:E,uScreenK:D,uScrBoost:Je,uScrKnee:$e,uScrTop:et};return a.onBeforeCompile=e=>{Object.assign(e.uniforms,o),e.vertexShader=e.vertexShader.replace(`#include <common>`,An.vertexCommon).replace(`#include <fog_vertex>`,An.vertexFogVertex),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,An.fragmentCommon).replace(`#include <map_fragment>`,An.fragmentMap).replace(`#include <color_fragment>`,An.fragmentColor).replace(`#include <roughnessmap_fragment>`,An.fragmentRoughness).replace(`#include <metalnessmap_fragment>`,An.fragmentMetalness).replace(`#include <emissivemap_fragment>`,T(An.fragmentEmissive,`if (K == 3 || K == 4) sgE *= uScreenK * (K == 4 ? mix(1.0, 1.7, uNightK) : 1.0 + (uScrBoost - 1.0) * uNightK); /* (lighting2 r5) exposure-compensated at every preset (night) LED x uScrBoost at night */
`,`if (K == 6) sgE *= mix(1.0, 0.3, uNightK);
`))},a.customProgramCacheKey=()=>`city-signage-r5n2-`+(r?`g`:`o`),a}function $n({scene:e,gen:t}){let n={roof:0,wall:0,ghost:0,blade:0,led:0,tris:0,meshes:0,at:{roof:[],wall:[],ghost:[],blade:[],led:[],marquee:[],canopy:[],letters:[],flag:[],awning:[],win:[]}};typeof window<`u`&&(window.__signStats=n);let i=(e,t,r,i)=>{let a=n.at[e];if(a.length<5e3){let e=Q(t,r,i,0);a.push([Math.round(e[0]),Math.round(i),Math.round(e[2]),t.N[0],t.N[1]])}};if(Pn)return{update(){},stats:n};let a=t.solids,o=t.zips,s=Dn(90210),u=Ge(),f=Ge(),m=Fn(64,s),h=Fn(64,s),_=Fn(64,s),v=Fn(8,s),y=new Map,b=(e,t)=>{let n=Math.floor(e/Mn)+`,`+Math.floor(t/Mn),r=y.get(n);return r||(r={op:new Kn,gh:new Kn,x0:Math.floor(e/Mn)*Mn,z0:Math.floor(t/Mn)*Mn},y.set(n,r)),r},x=new Map,C=(e,t,n,r,i,a)=>{for(let o=Math.floor(e/16);o<=Math.floor(r/16);o++)for(let s=Math.floor(n/16);s<=Math.floor(a/16);s++){let c=o*100003+s,l=x.get(c);l||x.set(c,l=[]),l.push(e,t,n,r,i,a)}};for(let e=0;e<a.t.length;e++){let t=e*6;(a.b[t+1]>=3||a.b[t+1]>=1.8&&a.b[t+4]>2.4)&&C(a.b[t],a.b[t+1],a.b[t+2],a.b[t+3],a.b[t+4],a.b[t+5])}let w=e=>{for(let t=Math.floor(e[0]/16);t<=Math.floor(e[3]/16);t++)for(let n=Math.floor(e[2]/16);n<=Math.floor(e[5]/16);n++){let r=x.get(t*100003+n);if(r){for(let t=0;t<r.length;t+=6)if(r[t+4]>e[1]+.05&&r[t+1]<e[4]&&e[3]>r[t]&&e[0]<r[t+3]&&e[5]>r[t+2]&&e[2]<r[t+5])return!0}}return!1},T=new Map;t.footprints.forEach((e,t)=>{for(let n=Math.floor(e.x0/32);n<=Math.floor(e.x1/32);n++)for(let r=Math.floor(e.z0/32);r<=Math.floor(e.z1/32);r++){let e=n*100003+r,i=T.get(e);i||T.set(e,i=[]),i.push(t)}});let E=(e,n,r,i,a)=>{let o=0,s=new Set;for(let c=Math.floor(e/32);c<=Math.floor(r/32);c++)for(let l=Math.floor(n/32);l<=Math.floor(i/32);l++)for(let u of T.get(c*100003+l)??[]){if(s.has(u))continue;s.add(u);let c=t.footprints[u];c!==a&&c.x1>e&&c.x0<r&&c.z1>n&&c.z0<i&&(o=Math.max(o,c.h))}return o},D=(e,t)=>{let n=`block`;for(let r of[3,6,10,15]){let i=Q(e,t,0,r),a=On(i[0],i[2]);if(a.type===`avenue`)return`avenue`;a.type===`street`||a.type===`intersection`?n=`street`:a.type===`water`||a.type===`sidewalk`&&a.fill?n===`block`&&(n=`water`):a.type===`park`&&n===`block`&&(n=`park`)}return n},ee=[kn.heraldSquare,kn.unionSquare].filter(Boolean).map(e=>[(e.x0+e.x1)/2,(e.z0+e.z1)/2]);for(let e of le??[])if(e?.kind===`broadway`&&Array.isArray(e.pts))for(let[t,n]of e.pts)(re??[]).some(e=>Math.abs(e-t)<1)&&(F?.(t,n)??!0)&&ee.push([t,n]);ee.length||ee.push([0,320],[430,1040]);let k=kn.timesSquare??{x0:1e6,x1:1e6,z0:1e6,z1:1e6},A=e=>e.x1>k.x0-30&&e.x0<k.x1+30&&e.z1>k.z0-90&&e.z0<k.z1+10,te=e=>e.layer===O.RED||e.layer===O.BROWN||e.layer===O.BUFF,ne={[O.RED]:qn(8014396),[O.BROWN]:qn(6046264),[O.BUFF]:qn(10257512)},j=[3948352,4869452,3027251,5591626,4015680].map(qn),M=e=>e.poly??e.lot?.poly??e.masses?.find(e=>e.y0<.1&&e.poly)?.poly??null,ie=(e,t)=>{let n=En(e,t),r=Math.exp(-Math.hypot(e,t+160)/420),i=Math.max(0,...ee.map(([n,r])=>Math.exp(-Math.hypot(e-n,t-r)/220)));return{d:n,dens:Math.min(1.6,.3+.55*(n.midtown??0)+.35*(n.village??0)+.9*r+.8*i-.2*(n.parkEdge??0)-.15*(n.harlem??0)-.35*(n.fidi??0))}},ae=(e,t,r,i=null)=>{if(!Array.isArray(e)||e.length<3||!t||t.type===`glass`||!((t.gH??0)>3.6)||!(r>(t.gH??0)+3))return;let a=0,o=0;for(let t of e)a+=t[0],o+=t[1];a/=e.length,o/=e.length;let{d:s,dens:c}=ie(a,o);if(s.id===`park`)return;let l=Dn(Math.floor(a*3.7)*73856093^Math.floor(o*2.9)*19349663^40465),u=b(a,o),d=t.gH,f=d-1.52,p=d-.6,m=Math.min(.92,.3+.45*c);for(let t=0;t<e.length;t++){let r=e[t],s=e[(t+1)%e.length],d=Math.hypot(s[0]-r[0],s[1]-r[1]);if(d<5||i&&i[t]!==`street`)continue;let h=[(s[0]-r[0])/d,(s[1]-r[1])/d],g=[h[1],-h[0]];g[0]*((r[0]+s[0])/2-a)+g[1]*((r[1]+s[1])/2-o)<0&&(g=[-g[0],-g[1]]);let _=Math.abs(-h[1]-g[0])<1e-6&&Math.abs(h[0]-g[1])<1e-6?{O:r,T:h,N:g,W:d}:{O:s,T:[-h[0],-h[1]],N:g,W:d},v=D(_,d/2);if(v!==`avenue`&&v!==`street`)continue;let y=Math.max(1,Math.floor(d/6.5+.5)),b=d/y;for(let e=0;e<y;e++){if(l()>m)continue;let t=e*b+.4,r=(e+1)*b-.4,i=[g[0],0,g[1]],a=qn([1842463,2764600,3810336,2044710,6969914,2894896][Math.floor(l()*6)]);u.op.quad([Q(_,t,f,.012),Q(_,r,f,.012),Q(_,r,p,.012),Q(_,t,p,.012)],i,null,a,0,0);let o=Math.min(r-t-.16,(p-f-.12)*4.6),s=(t+r-o)/2;u.op.quad([Q(_,s,f+.06,.018),Q(_,s+o,f+.06,.018),Q(_,s+o,p-.06,.018),Q(_,s,p-.06,.018)],i,zn(Math.floor(l()*64),o/(p-f-.12)),[1,1,1],4,.3+.35*Math.min(1,c)*l()),n.front=(n.front??0)+1}}};for(let e of t.polyBuildings??[])ae(e.poly,e.A,e.H,Array.isArray(e.faces)?e.faces:null);let oe=[3103290,8006186,2768234,10126424,3500650,9062954,5909066,3158064,6973994].map(qn),se=(e,t,r,o,s,c,l=-1)=>{let u=1.15+c()*.35,d=.55,f=l>=0?.4:.3,p=oe[Math.floor(c()*oe.length)],m=c()<.3?Math.round((o-r)/.32):0,h=s-d,g=Math.hypot(u,d),_=[t.N[0]*d/g,u/g,t.N[1]*d/g],v=(e,n,r)=>Q(t,e,n,r);e.quad([v(r,h,u),v(o,h,u),v(o,s,.02),v(r,s,.02)],_,null,p,7,m),e.quad([v(r,s-.03,.02),v(o,s-.03,.02),v(o,h-.03,u-.02),v(r,h-.03,u-.02)],_.map(e=>-e),null,p.map(e=>e*.3),7,0),Yn(e,t,r,o,h-f,h,u-.02,u+.01,p,null,7,m,61,7);for(let[n,i]of[[r,-1],[o,1]]){let r=v(n,s,.02),a=v(n,h,u-.02),o=v(n,h-f*.2,.25),c=[t.T[0]*i,0,t.T[1]*i];e.quad([r,o,a,a],c,null,p.map(e=>e*.8),7,0),e.quad([r,a,o,o],c.map(e=>-e),null,p.map(e=>e*.8),7,0)}if(l>=0){let n=Math.min(o-r-.4,(f-.09)*4.6),i=(r+o-n)/2;e.quad([v(i,h-f+.05,u+.014),v(i+n,h-f+.05,u+.014),v(i+n,h-.04,u+.014),v(i,h-.04,u+.014)],[t.N[0],0,t.N[1]],zn(l,n/(f-.09)),[1,1,1],1,0)}let y=$(t,r,0,0,o,0,u),b=t.N[0]===0?2:0,x=t.N[0]+t.N[1];a.ramp(y[0],h-.03,y[2],y[3],y[5],b,x>0?s:h,x>0?h:s,`awning`,1,.03),a.box(...$(t,r,h-f,u-.02,o,h,u+.01),`awning`,1),C(...$(t,r,h-f,0,o,s,u+.02)),n.awning=(n.awning??0)+1,i(`awning`,t,(r+o)/2,s)},N=[...t.buildings].sort((e,t)=>(e.lot?.cx??0)-(t.lot?.cx??0)||(e.lot?.cz??0)-(t.lot?.cz??0));for(let e of N){let{lot:r,A:s,masses:c}=e;if(r&&!r.reserved&&(M(e)||r.angle||r.rot)){M(e)&&ae(M(e),s,e.H);continue}if(!r||!s||!c?.length||r.reserved||A(r))continue;let d=r.cx??(r.x0+r.x1)/2,p=r.cz??(r.z0+r.z1)/2,g=En(d,p);if(g.id===`park`)continue;let y=Dn(Math.floor(d*3.7)*73856093^Math.floor(p*2.9)*19349663^20903),x=Math.exp(-Math.hypot(d-0,p+160)/420),T=Math.max(...ee.map(([e,t])=>Math.exp(-Math.hypot(d-e,p-t)/220))),O=Math.min(1.6,.3+.55*g.midtown+.35*g.village+.9*x+.8*T-.2*g.parkEdge-.15*g.harlem-.35*g.fidi),k=c.find(e=>e.y0<.1&&!e.round&&!e.crown);if(!k)continue;let re=s.type,ie=re===`glass`,oe=(e,t)=>(t===`nx`?Math.abs(e.x0-r.x0)<.15:t===`px`?Math.abs(e.x1-r.x1)<.15:t===`nz`?Math.abs(e.z0-r.z0)<.15:Math.abs(e.z1-r.z1)<.15)?e.sides?.[t]??r.sides?.[t]??`street`:`inner`,N=(e,t)=>c.some(n=>n!==e&&n.y1>t[1]+.2&&n.y0<t[4]&&n.x0<t[3]&&n.x1>t[0]&&n.z0<t[5]&&n.z1>t[2]),ce=[`nx`,`px`,`nz`,`pz`].map(e=>({s:e,t:oe(k,e),fr:Jn(k,e)}));for(let e of ce)e.t===`street`&&(e.view=D(e.fr,e.fr.W/2));let P=k.y1,le=k.parapet??1,ue=!c.some(e=>e!==k&&e.y0>k.y1-.5&&e.y0<k.y1+.5&&e.x0<=k.x0+.1&&e.x1>=k.x1-.1&&e.z0<=k.z0+.1&&e.z1>=k.z1-.1);if(!ie&&P>8&&P<75&&ue&&g.fidi<.55){let e=ce.filter(e=>e.t===`street`&&e.fr.W>9).map(e=>({...e,w:e.view===`avenue`?.42:e.view===`water`?.4:e.view===`street`?.1:0})).filter(e=>e.w>0).sort((e,t)=>t.w-e.w)[0];if(e&&y()<e.w*O){let r=e.fr,s=e.view===`water`?4.6+y()*1.4:3.6+y()*1.6,c=Math.min(r.W-1.2,s*(2.05+y()*.45)),l=Math.max(.6,(r.W-c)*(.15+y()*.7)),f=l+c,h=-.7,g=-1.02,_=P+(le+1.6+y()*3.2),v=_+s,x=$(r,l-.2,P,-3.3,f+.2,v+.8,.6),S=$(r,l-.2,P+le+.35,-3.3,f+.2,v+.8,-.05);if(c>6.5&&!w(S)&&!N(k,x)){let e=b(d,p),S=j[Math.floor(y()*j.length)],w=Ln(m(d,p),c/s);Yn(e.op,r,l,f,_,v,g,h,S,w,1,0),u.rect(Q(r,(l+f)/2,(_+v)/2,-.6699999999999999),[r.N[0],0,r.N[1]],[r.T[0],0,r.T[1]],c,s,null,1,{uv:w,printed:!0}),Yn(e.op,r,l-.12,f+.12,v,v+.14,-1.06,-.6399999999999999,S.map(e=>e*.7),null,0,0,62),Yn(e.op,r,l-.12,f+.12,_-.16,_,-1.06,-.6399999999999999,S.map(e=>e*.7),null,0,0,62);for(let t of[l-.12,f])Yn(e.op,r,t,t+.12,_-.16,v+.14,-1.06,-.6399999999999999,S.map(e=>e*.75),null,0,0,61);a.box(...$(r,l-.12,_-.16,-1.06,f+.12,v+.14,-.6399999999999999),`equipment`);let T=Math.max(2,Math.ceil(c/3.6)+1),E=t.tile(d,p).det;for(let t=0;t<T;t++){let n=l+.3+(c-.6-.26)*(t/(T-1));Yn(e.op,r,n,n+.26,P,v,-1.32,g,S,null,0,0,62),a.box(...$(r,n,P,-1.32,n+.26,v,g),`pole`),E.setPart(_e.STEEL).setColor(S),Xn(E,r,n+.05,n+.21,P,_+s*.5,-3.22,-3.02),Xn(E,r,n+.07,n+.19,_+s*.5-.14,_+s*.5,-3.22,-1.32),Xn(E,r,n+.07,n+.19,P+.9,P+1.02,-3.22,-1.32),a.box(...$(r,n+.05,P,-3.22,n+.21,_+s*.5,-3.02),`pole`)}E.setPart(_e.GRATE).setColor(5921882),Xn(E,r,l-.1,f+.1,_-.26,_-.2,h,.25),E.setPart(_e.STEEL).setColor(S),Xn(E,r,l-.1,f+.1,_-.34,_-.26,.15000000000000002,.25);for(let e=l;e<=f+.01;e+=c/Math.max(1,Math.round(c/2.4)))Xn(E,r,e-.03,e+.03,_-.34,_+.72,.18000000000000005,.24);Xn(E,r,l-.1,f+.1,_+.68,_+.74,.18000000000000005,.24),a.box(...$(r,l-.1,_-.34,h,f+.1,_-.2,.25),`awning`,1),E.setPart(_e.PAINT).setColor(2763820);for(let e=l+1;e<f-.5;e+=3.2)Xn(E,r,e-.035,e+.035,v+.14,v+.62,-.92,-.85),Xn(E,r,e-.035,e+.035,v+.55,v+.62,-.92,.25),Xn(E,r,e-.16,e+.16,v+.44,v+.6,.050000000000000044,.3800000000000001);o.edge?.(...(()=>{let e=Q(r,l,0,-1.72/2),t=Q(r,f,0,-1.72/2);return[e[0],e[2],t[0],t[2]]})(),v+.14,r.N[0],r.N[1],`roofEdge`,5),C(...x),n.roof++,i(`roof`,r,(l+f)/2,_)}}}if(!ie&&re!==`deco`&&e.H<110)for(let e of ce){if(e.t!==`party`||e.fr.W<8)continue;let r=e.fr,o=$(r,.3,0,.2,r.W-.3,1,1.2),c=E(o[0],o[2],o[3],o[5],null),l=Math.max(c+1.2,(s.gH??4)+1.5),f=k.y1-1.2;if(f-l<6.5)continue;let g=te(s)&&(re===`walkup`||re===`loft`||re===`apt`||re===`postwar`),x=.5*O+(g?.12:0);if(y()>x)continue;let S=g&&y()<.5,C=r.W-1.6,w=f-l,T=b(d,p);if(S){let e=Math.min(C,16+y()*6),t=e/4,a=Math.max(1,Math.min(3,Math.floor(w/(t*1.1)))),o=(r.W-e)/2,c=f-.6-y()*Math.max(0,w-a*t*1.1)*.5;for(let n=0;n<a&&c-t>l;n++){let i=y()<.6?Vn(v(d+n*50,p),e/t):zn(_(d+n*50,p,e=>!Wn.includes(e)),e/t);T.op.quad([Q(r,o,c-t,.045),Q(r,o+e,c-t,.045),Q(r,o+e,c,.045),Q(r,o,c,.045)],[r.N[0],0,r.N[1]],i,ne[s.layer]??[.3,.25,.2],5,.42+y()*.2),c-=t*1.12}n.ghost++,i(`ghost`,r,r.W/2,f)}else{let e=w>C*.8,o,c;if(e?(c=Math.min(w,34),o=Math.min(C,c*.62),c=Math.min(c,o/.5)):(o=Math.min(C,26),c=Math.min(w,o/1.7),o=Math.min(o,c*2.3)),o<6||c<5)continue;let l=(r.W-o)*(.3+y()*.4),g=f-y()*(w-c)*.4,_=g-c,v=e?Rn(h(d,p),o/c):Ln(m(d,p),o/c);if(te(s)&&y()<.55)T.op.quad([Q(r,l,_,.05),Q(r,l+o,_,.05),Q(r,l+o,g,.05),Q(r,l,g,.05)],[r.N[0],0,r.N[1]],v,ne[s.layer]??[.3,.25,.2],2,0);else{let e=j[Math.floor(y()*j.length)],n=e.map(e=>e*.72),i=.32,s=.2;Yn(T.op,r,l,l+o,_,g,.02,.25,e,v,1,0,1),u.rect(Q(r,l+o/2,(_+g)/2,.28),[r.N[0],0,r.N[1]],[r.T[0],0,r.T[1]],o,c,null,1,{uv:v,printed:!0}),Yn(T.op,r,l-s,l+o+s,g,g+s,0,i,n,null,0,0,61),Yn(T.op,r,l-s,l+o+s,_-s,_,0,i,n,null,0,0,61),Yn(T.op,r,l-s,l,_,g,0,i,n,null,0,0,61),Yn(T.op,r,l+o,l+o+s,_,g,0,i,n,null,0,0,61),a.box(...$(r,l-s,_-s,0,l+o+s,g+s,i),`wall`);let f=t.tile(d,p).det,m=_-s-.28,h=l-s,b=l+o+s;f.setPart(_e.GRATE).setColor(5592922),Xn(f,r,h,b,m,m+.06,.05,1),f.setPart(_e.STEEL).setColor(e),Xn(f,r,h,b,m-.1,m,.9,1),Xn(f,r,h,b,m+1,m+1.06,.93,.99);let x=Math.max(2,Math.round(o/2.6)+1);for(let e=0;e<x;e++){let t=h+.1+(b-h-.2)*e/(x-1);Xn(f,r,t-.03,t+.03,m,m+1,.93,.99),f.tube(Q(r,t,m-1.1,.02),Q(r,t,m-.04,.95),.04,4)}f.setPart(_e.PAINT).setColor(2763820);for(let e=l+1;e<l+o-.4;e+=3)f.tube(Q(r,e,m+1.03,.96),Q(r,e,m+1.55,1.45),.03,4),Xn(f,r,e-.17,e+.17,m+1.5,m+1.68,1.28,1.6);a.box(...$(r,h,m-.1,0,b,m+.06,1),`awning`,1)}n.wall++,i(`wall`,r,l+o/2,_)}}if(!ie&&(re===`loft`||re===`walkup`||re===`apt`)&&(s.gH??0)>3.5)for(let e of ce){if(e.t!==`street`||e.fr.W<9||e.view!==`avenue`&&e.view!==`street`||y()>(e.view===`avenue`?.2:.11)*O)continue;let r=e.fr,o=.95+y()*.75*Math.min(1,O),c=o*4,l=s.gH+.9,u=l+c;if(u>k.y1-1.5)continue;let m=y()<.5?1.6+y()*1.2:r.W-1.6-y()*1.2,h=.3,g=h+o,_=b(d,p),v=Gn[Math.floor(y()*Gn.length)],x=[qn(1842463),qn(5905690),qn(1911370),qn(8022586)][Math.floor(y()*4)];Yn(_.op,r,m-.18,m+.18,l,u,h,g,x,null,0,0,61);let S=zn(v,c/o),C=.45+.4*Math.min(1,O),w=(e,t,n)=>Q(r,e,t,n),T=(e,t)=>{let n=t>0?g-.06:.36,i=t>0?.36:g-.06,a=l+.08,o=u-.08,s=[r.T[0]*t,0,r.T[1]*t],c=_.op,d=c.v;for(let t of[w(e,a,n),w(e,a,i),w(e,o,i),w(e,o,n)])c.p.push(t[0],t[1],t[2]),c.n.push(...s),c.c.push(1,1,1),c.s.push(4,C);c.uv.push(S[0],S[3],S[0],S[1],S[2],S[1],S[2],S[3]),c.l.push(0,0,1,0,1,1,0,1),c.i.push(d,d+1,d+2,d,d+2,d+3),c.v+=4};T(m+.185,1),T(m-.185,-1);{let e=[S[0]-2,S[1],S[2]-2,S[3]];for(let t of[1,-1])f.rect(Q(r,m+t*.2,(l+u)/2,(h+g)/2),[r.T[0]*t,0,r.T[1]*t],[r.N[0]*t,0,r.N[1]*t],o,c,null,1,{uv:e,whole:!0,gain:.7,range:10})}let E=Math.max(4,Math.round((c-.2)/.17));_.op.quad([w(m-.13,l+.1,g+.006),w(m+.13,l+.1,g+.006),w(m+.13,u-.1,g+.006),w(m-.13,u-.1,g+.006)],[r.N[0],0,r.N[1]],[0,0,2,E],x,6,.9+.5*Math.min(1,O)),Yn(_.op,r,m-.24,m+.24,u,u+.12,.25,g+.08,x.map(e=>e*.8),null,0,0,61);let D=t.tile(d,p).det;D.setPart(_e.STEEL).setColor(2763564);for(let e of[l+.35,u-.35])Xn(D,r,m-.04,m+.04,e-.06,e+.06,0,.38),Xn(D,r,m-.1,m+.1,e-.18,e+.18,0,.05),D.tube(Q(r,m,e-.9,.03),Q(r,m,e-.04,.35),.025,4);a.box(...$(r,m-.19,l,0,m+.19,u,g),`equipment`,1),n.blade++,i(`blade`,r,m,l);break}let F=s.gH??0;if(!ie&&F>4.2&&k.y1>14){let e=.5*Math.min(1,x*1.6)+.04*g.midtown+.03*T,r=ce.find(e=>e.t===`street`&&(e.view===`street`||e.view===`avenue`)&&e.fr.W>12);if(r&&y()<e){let e=r.fr,o=Math.min(e.W-4,7+y()*5),s=2.6+y()*.8,c=1.3+y()*.5,f=1.5+y()*(e.W-o-3),m=f+o,h=Math.max(3.3,F-1.9),g=h+c;if(!w($(e,f-.1,h-.1,.6,m+.1,g+.2,s+.1))){let r=b(d,p).op,c=[12,42,53,21,31,15,48,12,42],_=x>.3?c[Math.floor(y()*c.length)]:[15,48,12,42][Math.floor(y()*4)],v=qn([2761760,6967328,3807256,1711136][Math.floor(y()*4)]);Yn(r,e,f,m,h,g,.05,s,v,null,0,0,29);let S=(t,n,r)=>Q(e,t,n,r),w=[e.N[0],0,e.N[1]],T=[e.T[0],0,e.T[1]],E=T.map(e=>-e),D=h+.22,ee=g-.22,O=ee-D;r.quad([S(f+.25,D,s+.006),S(m-.25,D,s+.006),S(m-.25,ee,s+.006),S(f+.25,ee,s+.006)],w,zn(_,(o-.5)/O),[1,1,1],4,.9);let k=zn(_,4);r.quad([S(m+.006,D,s-.25),S(m+.006,D,.3),S(m+.006,ee,.3),S(m+.006,ee,s-.25)],T,k,[1,1,1],4,.9),r.quad([S(f-.006,D,.3),S(f-.006,D,s-.25),S(f-.006,ee,s-.25),S(f-.006,ee,.3)],E,k,[1,1,1],4,.9);let A=.16;for(let[e,t]of[[h+.04,D-.04],[ee+.04,g-.04]]){let n=Math.round((o-.1)/A),i=Math.round((s-.1)/A);r.quad([S(f+.05,e,s+.008),S(m-.05,e,s+.008),S(m-.05,t,s+.008),S(f+.05,t,s+.008)],w,[0,0,n,1],v,6,1.4),r.quad([S(m+.008,e,s-.05),S(m+.008,e,.1),S(m+.008,t,.1),S(m+.008,t,s-.05)],T,[0,0,i,1],v,6,1.4),r.quad([S(f-.008,e,.1),S(f-.008,e,s-.05),S(f-.008,t,s-.05),S(f-.008,t,.1)],E,[0,0,i,1],v,6,1.4)}let te=Math.round(o/.45),ne=Math.round(s/.45);r.quad([S(f,h-.002,.05),S(m,h-.002,.05),S(m,h-.002,s),S(f,h-.002,s)],[0,-1,0],[0,0,te,ne],v,6,1.1);let j=t.tile(d,p).det;j.setPart(_e.STEEL).setColor(2303013);for(let t of[f+.4,m-.4])Xn(j,e,t-.03,t+.03,g+.02,g+.08+s*.6,0,.06),Xn(j,e,t-.02,t+.02,g,g+.05,.05,s-.3);a.box(...$(e,f,h,0,m,g,s),`awning`,1),C(...$(e,f-.1,h-.1,0,m+.1,g+.2,s+.1)),u.point(Q(e,(f+m)/2,h-.5,s*.6),new l(1,.72,.42),10+2.5*o,12,.4),n.marquee=(n.marquee??0)+1,i(`marquee`,e,(f+m)/2,h)}}}if(F>3.4&&k.y1>14){let e=ce.filter(e=>e.t===`street`&&(e.view===`avenue`||e.view===`street`||e.view===`park`)&&e.fr.W>14).sort((e,t)=>(t.view!==`street`)-(e.view!==`street`))[0];if(e){let r=e.fr,s=r.W*(.4+y()*.2),c=b(d,p),l=t.tile(d,p).det,u=ie||re===`deco`||re===`postwar`,f=re===`apt`||re===`postwar`,m=!1;if(f&&y()<.6&&[`sidewalk`].includes(On(...(e=>[e[0],e[2]])(Q(r,s,0,3.9))).type)){let e=2.3,t=3.5,o=2.95,u=3.3;if(!w($(r,s-e/2-.1,2.5,.1,s+e/2+.1,3.5999999999999996,3.6))){let d=qn([2047275,5904927,1713472,2763306,3878434][Math.floor(y()*5)]);Yn(c.op,r,s-e/2,s+e/2,o,u,.02,t,d,null,7,0,61,7);let f=1.196;c.op.quad([Q(r,s-f/2,2.99,3.512),Q(r,s+f/2,2.99,3.512),Q(r,s+f/2,3.25,3.512),Q(r,s-f/2,3.25,3.512)],[r.N[0],0,r.N[1]],zn([15,48,10,36,35,60,63][Math.floor(y()*7)],f/.26),qn(13215840),8,0),l.setPart(_e.GALV).setColor(12098138);for(let t of[-1,1])l.tube(Q(r,s+t*(e/2-.12),0,3.35),Q(r,s+t*(e/2-.12),o,3.35),.035,6),a.box(...$(r,s+t*(e/2-.12)-.04,0,3.31,s+t*(e/2-.12)+.04,o,3.39),`pole`);a.box(...$(r,s-e/2,o,0,s+e/2,u,t),`awning`,1),C(...$(r,s-e/2,0,0,s+e/2,u,t)),m=!0,n.canopy=(n.canopy??0)+1,i(`canopy`,r,s,o)}}if(!m&&(u||f)&&y()<.55+.3*g.fidi){let e=.36+y()*.16,t=Math.min(r.W-2,e*4.3),a=F-.45,o=a-e;o>2.4&&!w($(r,s-t/2,o,0,s+t/2,a,.3))&&(c.op.quad([Q(r,s-t/2,o,.035),Q(r,s+t/2,o,.035),Q(r,s+t/2,a,.035),Q(r,s-t/2,a,.035)],[r.N[0],0,r.N[1]],zn([10,36,35,15,48,60,63,41][Math.floor(y()*8)],t/e),qn(y()<.6?13215840:13158596),8,0),C(...$(r,s-t/2,o,0,s+t/2,a,.1)),n.letters=(n.letters??0)+1,i(`letters`,r,s,o))}if(u&&e.view!==`street`&&y()<.3+.35*Math.min(1,O)){let e=F+1.5;for(let a of[-2.4,2.4]){let c=s+a;if(c<1||c>r.W-1||w($(r,c-.4,e-1.4,0,c+.4,e+1.9,2.7)))continue;let u=Q(r,c,e,0),d=Q(r,c,e+1.8,2.6);l.setPart(_e.GALV).setColor(13218426),l.tube(u,d,.035,6),(t.buildings.flags??=[]).push({top:new S(...d),base:new S(...u),N:[r.N[0],0,r.N[1]],T:[r.T[0],0,r.T[1]],color:Math.floor(y()*4)}),o.add?.(d[0],d[1]+.035,d[2],0,1,0,`pole`),C(...$(r,c-.3,e-1.4,0,c+.3,e+1.9,2.7)),n.flag=(n.flag??0)+1,i(`flag`,r,c,e)}}}}if(!ie&&F>3.6&&re!==`deco`&&k.y1>F+3){let e=Math.min(.92,.3+.45*O);for(let t of ce){if(t.t!==`street`||t.view!==`avenue`&&t.view!==`street`||t.fr.W<5)continue;let r=t.fr,i=Math.max(1,Math.floor(r.W/6.5+.5)),o=r.W/i,s=F-.6,c=s-(.72+y()*.36),l=b(d,p),u=y()<.35,f=Math.floor(y()*64),m=qn([1842463,2764600,3810336,2044710,6969914,2894896][Math.floor(y()*6)]);for(let t=0;t<i;t++){let i=t*o+.38,d=(t+1)*o-.38;if(!u&&y()>e){let e=Math.min(F-.6,Math.max(F-1.5,3.6));e-.95>=2.63&&y()<.5*Math.min(1,O)+.12&&!w($(r,i,2.4,.1,d,e+.1,1.8))&&se(l.op,r,i,d,e,y,Math.floor(y()*64));continue}let p=.16+y()*.1;if(w($(r,i,c,0,d,s,p+.05))||w($(r,i,3,.2,d,s,1.6))){u=!1;continue}let h=u?m:qn([1842463,2764600,3810336,2044710,6969914,2894896,4857374,2109514][Math.floor(y()*8)]);Yn(l.op,r,i,d,c,s,.02,p,h,null,0,0,61);let g=Math.min(d-i-.16,(s-c-.12)*4.6),_=(i+d-g)/2,v=u?f:Math.floor(y()*64),b=!u&&y()<.22?Hn(Math.floor(y()*8),g/(s-c-.12)):zn(v,g/(s-c-.12)),x=.3+.35*Math.min(1,O)*y();l.op.quad([Q(r,_,c+.06,p+.004),Q(r,_+g,c+.06,p+.004),Q(r,_+g,s-.06,p+.004),Q(r,_,s-.06,p+.004)],[r.N[0],0,r.N[1]],b,[1,1,1],4,x),a.box(...$(r,i,c,0,d,s,p),`equipment`,1),C(...$(r,i,c,0,d,s,p)),n.front=(n.front??0)+1,c-.06-.85>=2.63&&y()<.35*Math.min(1,O)+.08&&!w($(r,i,2.4,.1,d,c-.1,1.8))&&se(l.op,r,i,d,c-.06,y)}}}if(!ie&&re!==`deco`&&F>3.4){let e=k.p??s,t=e.floorH??3.3,r=e.margin??.6,a=Math.floor((k.y1+(k.parapet??0)-F)/t+.01);if((e.style??0)<1.5&&k.y1>F+t+1){let o=Math.min(.75,.2+.45*Math.min(1,O));for(let s of ce){if(s.t!==`street`||s.view!==`avenue`&&s.view!==`street`||y()>o)continue;let c=s.fr,l=c.W-2*r;if(l<2.5)continue;let u=Math.max(1,Math.floor(l/(e.bayW??2.4)+.5)),f=l/u;if(a<5&&f>2.15)continue;let m=f*(e.winW??.5),h=t*(e.winH??.55),g=(t-h)*.42;a>=5&&(h=Math.min(t-.5,h*1.14),g=(t-h)*.5);let _=Math.min(m*.96,1.7),v=_/4,x=F+g+h*(.42+y()*.2);if(_<.5||v>h*.5)continue;let S=Math.floor(y()*16),C=Math.min(u,1+Math.floor(y()*3)),T=Math.floor(y()*(u-C+1)),E=b(d,p);for(let e=0;e<C;e++){let t=r+(T+e+.5)*f;w($(c,t-_/2,x-v/2,0,t+_/2,x+v/2,.06))||(E.op.quad([Q(c,t-_/2,x-v/2,.014),Q(c,t+_/2,x-v/2,.014),Q(c,t+_/2,x+v/2,.014),Q(c,t-_/2,x+v/2,.014)],[c.N[0],0,c.N[1]],Un(S,_/v),[1,1,1],9,0),n.winLetters=(n.winLetters??0)+1,i(`win`,c,t,x))}}}}let I=ce.filter(e=>e.t===`street`&&(e.view===`avenue`||e.view===`street`)).length>=2,de=.55*T*T+.02*g.midtown+.04*x+.025*g.fidi;if(I&&P>18&&y()<de){let e=ce.filter(e=>e.t===`street`&&(e.view===`avenue`||e.view===`street`)&&e.fr.W>12).sort((e,t)=>(t.view===`avenue`)-(e.view===`avenue`)).slice(0,T>.45?2:1);for(let t of e){let e=t.fr,r=Math.min(e.W*.45,9+y()*7),o=Math.min(P-(s.gH??5)-3,r*(.45+y()*.35));if(o<4)continue;let c=[`nx`,`px`,`nz`,`pz`].indexOf(t.s),l=ce.filter(e=>e.t===`street`&&e!==t&&[`nx`,`px`,`nz`,`pz`].indexOf(e.s)>>1!=c>>1)[0],f=y()<.5;if(l){let t=Q(e,e.W,0,0),n=l.fr;f=Math.abs(n.N[0]?t[0]-n.O[0]:t[2]-n.O[1])<.5}let g=f?e.W-r-.4:.4,_=(s.gH??5)+1.2,v=_+o,x=b(d,p),S=r/o>1.1,C=S?m(d,p):h(d,p),w=S?Ln(C,r/o):Rn(C,r/o),T=(S?be:xe)[C]??[.15,.15,.15],E=.2126*T[0]+.7152*T[1]+.0722*T[2],D=1.35*Math.min(1.4,Math.max(.5,(.15/(E+.02))**.5));Yn(x.op,e,g-.18,g+r+.18,_-.18,v+.18,.02,.42,qn(1710877),null,0,0,62),Yn(x.op,e,g,g+r,_,v,.42,.45,qn(1710877),w,3,D,1),a.box(...$(e,g-.18,_-.18,0,g+r+.18,v+.18,.45),`equipment`,1),u.rect(Q(e,g+r/2,(_+v)/2,.4),[e.N[0],0,e.N[1]],[e.T[0],0,e.T[1]],r,o,T,1,{uv:w,gain:1.8}),n.led++,i(`led`,e,g+r/2,_)}}}for(let e of t.roofSignPanels??[]){let t=Jn(e.alx?{x0:e.a0,x1:e.a1,z0:e.plane,z1:e.plane}:{x0:e.plane,x1:e.plane,z0:e.a0,z1:e.a1},e.k),r=e.a1-e.a0,i=e.y1-e.y0,a=Q(t,r/2,0,0),o=b(a[0],a[2]),s=Ln(m(a[0],a[2]),r/i);o.op.quad([Q(t,0,e.y0,0),Q(t,r,e.y0,0),Q(t,r,e.y1,0),Q(t,0,e.y1,0)],[t.N[0],0,t.N[1]],s,[1,1,1],1,0),u.rect(Q(t,r/2,(e.y0+e.y1)/2,.03),[t.N[0],0,t.N[1]],[t.T[0],0,t.T[1]],r,i,null,1,{uv:s,printed:!0}),n.roofPanel=(n.roofPanel??0)+1}t.textures;let ce=Qn(ye(),ge(),(()=>{let e=new Uint8Array(65536),t=Dn(7),n=Array.from({length:768},()=>t()),i=e=>e*e*(3-2*e);for(let t=0;t<128;t++)for(let r=0;r<128;r++)for(let a=0;a<3;a++){let o=0,s=.5,c=1;for(let e=0;e<3;e++){let e=4*c,l=r/128*e,u=t/128*e,d=Math.floor(l),f=Math.floor(u),p=i(l-d),m=i(u-f),h=(t,r)=>n[((t%e+e)%e*16+(r%e+e)%e)%256*3+a];o+=s*((h(d,f)*(1-p)+h(d+1,f)*p)*(1-m)+(h(d,f+1)*(1-p)+h(d+1,f+1)*p)*m),s*=.5,c*=2}e[(t*128+r)*4+a]=Math.round(255*Math.min(1,o/.875)),e[(t*128+r)*4+3]=255}let a=new g(e,128,128);return a.wrapS=a.wrapT=d,a.magFilter=c,a.minFilter=r,a.generateMipmaps=!0,a.needsUpdate=!0,a})(),!1,Zn(jn+`city_signart.webp`)),P=[];for(let t of y.values()){let r=t.op.build(),i=t.gh.build(),a={x0:t.x0,z0:t.z0,op:null,gh:null};if(r){let t=new p(r,ce);t.name=`signage`,t.castShadow=!0,t.receiveShadow=!0,t.userData.smallCasters=!0,t.userData.maxCascade=2,e.add(t),a.op=t,n.tris+=r.index.count/3}if(i){let t=new p(i,null);t.name=`signageGhost`,t.castShadow=!1,t.receiveShadow=!0,t.renderOrder=1,e.add(t),a.gh=t,n.tris+=i.index.count/3}(a.op||a.gh)&&P.push(a)}if(n.meshes=P.reduce((e,t)=>e+!!t.op+!!t.gh,0),n.lights=u.commit(`signage`),n.bladeLights=f.commit(`signBlades`,{grid:ve(),mergeA:0}),console.log(`[signage] ${n.roof} rooftop billboards (+${n.roofPanel??0} roof-kit ad faces), ${n.front??0} shop fascias, ${n.marquee??0} marquees, ${n.wall} wall ads, ${n.ghost} ghost signs, ${n.blade} blade signs, ${n.led} LED screens, ${n.awning??0} awnings, ${n.canopy??0} canopies, ${n.letters??0} lobby letters, ${n.winLetters??0} window letterings, ${n.flag??0} flags | ${P.length} cells, ${n.meshes} meshes, ${(n.tris/1e3).toFixed(1)}k tris`),Nn.has(`signdbg`)){let[e,t,r]=(Nn.get(`signdbg`)||`0,0,900`).split(`,`).map(Number);for(let i in n.at)console.log(`[signage-at] `+i+` `+JSON.stringify(n.at[i].filter(n=>Math.hypot(n[0]-e,n[2]-t)<r).slice(0,40)))}return typeof window<`u`&&(window.__signage=n),{stats:n,update(e){for(let t of P){let n=Math.max(0,t.x0-e.x,e.x-(t.x0+Mn)),r=Math.max(0,t.z0-e.z,e.z-(t.z0+Mn)),i=Math.hypot(n,r);t.op&&(t.op.visible=i<850,t.op.castShadow=i<120),t.gh&&(t.gh.visible=i<520)}}}}var er=`// neon shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section vertexCommon\r
#include <common>\r
      in vec4 aS; in vec3 iO; in vec3 iT; in vec3 iV; in vec4 iD; in vec4 iC;\r
      out vec4 vNeonC; out float vNeonDim; vec3 neonPos;\r
// @section vertexBeginNormalVertex\r
\r
      int nSide = int(aS.x + 0.5);\r
      float nW = iD.x, nH = iD.y, nR = iD.z; int nMask = int(iD.w + 0.5);\r
      vec3 nT = iT, nV = iV, nN = normalize(cross(iT, iV));\r
      float nDist = length(iO + nT * nW * 0.5 + nV * nH * 0.5 - cameraPosition);\r
      float nRe = max(nR, nDist * 0.00062); // ~0.6 px at 1080p / 55 deg: no sub-pixel shimmer, energy kept below\r
      vNeonDim = nR / nRe;\r
      vNeonC = iC;\r
      vec2 p0 = nSide == 0 ? vec2(0.0) : nSide == 1 ? vec2(nW, 0.0) : nSide == 2 ? vec2(nW, nH) : vec2(0.0, nH);\r
      vec2 dr = nSide == 0 ? vec2(1.0, 0.0) : nSide == 1 ? vec2(0.0, 1.0) : nSide == 2 ? vec2(-1.0, 0.0) : vec2(0.0, -1.0);\r
      float nLen = (nSide == 0 || nSide == 2) ? nW : nH;\r
      float nS = mix(-nRe, nLen + nRe, aS.y);                            // run past the corners: closed joints / end caps\r
      vec3 nAx = nT * dr.x + nV * dr.y, nPerp = nT * abs(dr.y) + nV * abs(dr.x);\r
      float nFlat = iC.w >= 1.0 ? 0.35 : 1.0;                               // LED strips: a flat ribbon\r
      vec3 objectNormal = normalize(nPerp * aS.z + nN * aS.w);\r
      neonPos = iO + nT * p0.x + nV * p0.y + nAx * nS + (nPerp * aS.z * nFlat + nN * aS.w) * nRe;\r
      if (((nMask >> nSide) & 1) == 0 || nDist > 700.0) neonPos = iO;       // masked side / far: degenerate\r
      #ifdef USE_TANGENT\r
      vec3 objectTangent = vec3(tangent.xyz);\r
      #endif\r
// @section vertexBeginVertex\r
vec3 transformed = neonPos;\r
// @section fragmentCommon\r
#include <common>\r
      in vec4 vNeonC; in float vNeonDim; uniform float uNeonK, uNeonT, uNeonS; uniform vec4 uNeon;\r
// @section fragmentColor\r
#include <color_fragment>\r
      diffuseColor.rgb = mix(vec3(0.55), vNeonC.rgb, 0.35) * uNeon.z; // unlit glass tube (pale tint) by day\r
// @section fragmentEmissive\r
#include <emissivemap_fragment>\r
      if (uNeonK > 0.0) {\r
        float led = step(1.0, vNeonC.w), seed = fract(vNeonC.w);\r
        float face = abs(dot(normalize(normal), normalize(vViewPosition)));\r
        vec3 col = vNeonC.rgb;\r
        // bright saturated core, dimmer + deeper colour toward the tube's silhouette; LED ribbons flat and even\r
        vec3 e = col * mix(mix(0.4, 1.0, pow(face, 1.5)), 0.85, led);\r
        e = mix(e, vec3(max(max(col.r, col.g), col.b)), 0.18 * pow(face, 6.0) * (1.0 - led));\r
        float fl = 1.0;\r
        if (seed < 0.034 && led < 0.5) { // ~1 in 30 tubes buzz: brief dips, cheap hash of time\r
          float h = fract(sin(floor(uNeonT * 13.0 + seed * 977.0) * 12.9898) * 43758.5453);\r
          fl = h > 0.82 ? 0.25 + 0.5 * h * h : 1.0;\r
        }\r
        totalEmissiveRadiance += e * uNeon.x * mix(1.0, uNeon.y, led) * uNeonS * uNeonK * vNeonDim * fl;\r
      }\r
// @section vertexCommonByNeonUvScale\r
#include <common>\r
      in vec3 iO; in vec3 iT; in vec4 iD; in vec4 iC; out vec2 vNeonUv, vNeonQ; out vec4 vNeonC; out float vNeonDim;\r
// @section vertexBeginVertexByNeonDimmer\r
\r
      vec3 nN = vec3(-iT.z, 0.0, iT.x);\r
      vec3 transformed = iO + iT * position.x * iD.x + vec3(0.0, 1.0, 0.0) * position.y * iD.y;\r
      float cell = iD.z, asp = iD.x / iD.y;\r
      // the cell holds the item centred at its own aspect (90 % x 78 % of 512 x 256): map the quad onto that box\r
      float ca = __SHADER_INJECT_0__;\r
      vec2 sz = asp > ca ? vec2(0.9, 0.9 / asp * 2.0) : vec2(0.78 * asp * 0.5, 0.78);\r
      if (cell > 23.5) sz = vec2(0.5, 1.0) / 1.12; // icons: drawn in the cell's centre square\r
      vec2 cuv = 0.5 + position.xy * min(sz * 1.12, vec2(0.995));\r
      vNeonUv = vec2((mod(cell, 4.0) + cuv.x) / 4.0, 1.0 - (floor(cell / 4.0) + 1.0 - cuv.y) / 8.0);\r
      vNeonC = iC; vNeonQ = position.xy + 0.5;\r
      float d = length(iO - cameraPosition);\r
      vNeonDim = 1.0 - smoothstep(420.0, 600.0, d);\r
      if (d > 600.0) transformed = iO;\r
// @section fragmentCommonByNeonColor\r
#include <common>\r
      in vec2 vNeonUv, vNeonQ; in vec4 vNeonC; in float vNeonDim; uniform float uNeonK, uNeonT, uNeonS; uniform sampler2D uNeonTex; uniform vec4 uNeonW;\r
// @section fragmentMap\r
\r
      vec2 nt = max(texture(uNeonTex, vNeonUv).rg - 0.02, 0.0) / 0.98; // webp noise floor\r
      vec2 eq = min(vNeonQ, 1.0 - vNeonQ); nt.g *= smoothstep(0.0, 0.12, min(eq.x, eq.y * 2.0)); // halo fades out before the quad edge\r
      float seed = fract(vNeonC.w), fl = 1.0;\r
      if (seed < 0.034) { float h = fract(sin(floor(uNeonT * 11.0 + seed * 613.0) * 12.9898) * 43758.5453); fl = h > 0.8 ? 0.2 + 0.4 * h : 1.0; }\r
      vec3 col = vNeonC.rgb;\r
      vec3 e = col * nt.r + mix(col, vec3(max(max(col.r, col.g), col.b)), 0.25) * nt.r * nt.r * 0.2 + col * nt.g * uNeonW.y;\r
      diffuseColor.rgb = e * uNeonW.x * uNeonS * uNeonK * fl * vNeonDim;\r
`;export{W as C,je as S,we as T,Ge as _,lt as a,G as b,ut as c,it as d,rt as f,Xe as g,tt as h,mt as i,dt as l,Ze as m,$n as n,pt as o,Qe as p,_n as r,st as s,er as t,at as u,nt as v,Te as w,Me as x,K as y};
//# sourceMappingURL=world~index-Wz5F0-4a.js.map