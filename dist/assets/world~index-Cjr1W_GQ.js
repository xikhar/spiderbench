import{$n as e,A as t,Fr as n,Ha as r,Hn as i,Ir as a,L as o,Ln as s,Lt as c,Ma as l,Mn as u,O as d,Qi as f,Rn as p,U as m,Va as h,Wi as g,Wn as _,Z as v,ar as y,ft as b,io as x,ir as S,j as C,mr as w,no as T,or as E,pa as D,qt as O,ro as k,sn as ee}from"./three~index~combat~screenshotPresets~gameSystems~GLTFLoader-BF58tRDi.js";import{n as te,o as ne,s as re}from"./world~index~screenshotPresets~gameSystems-Dd9PBWOO.js";import{i as ie,o as A}from"./vehicleLighting-CSwID43I.js";import{A as ae,D as j,k as M}from"./world~index~gameSystems-BSmpxLKb.js";import{B as oe,Ct as se,Et as ce,L as le,Tt as N,bt as ue,ct as de,m as P,o as fe,st as pe,ut as me,v as F,z as he}from"./world~index~gameSystems-BR_3eHIy.js";import{t as ge}from"./world~index~combat~screenshotPresets~gameSystems-eJmDYCna.js";import{t as _e}from"./performanceFlags-Cybz3NnI.js";import{a as ve,c as I,d as L,f as R,i as ye,l as be,m as z,n as xe,o as Se,p as B,r as Ce,s as we,u as Te,y as V}from"./world~index-DmU0GBQf.js";var Ee=`// horizon shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`,De=`// boats shader sections. Use parseShaderSections() to select an injection chunk.\r
// @section fragmentCommon\r
#include <common>
uniform float uNightK;\r
// @section fragmentColor\r
#include <color_fragment>
diffuseColor.rgb *= mix(1.0, 0.025, uNightK);\r
`,Oe=(e,t)=>e.gH+Math.max(1,Math.round((t-e.gH)/e.floorH))*e.floorH,H=(e,t,n=t,r=t,i=t)=>({x0:e.x0+t,x1:e.x1-n,z0:e.z0+r,z1:e.z1-i}),U={nx:`setback`,px:`setback`,nz:`setback`,pz:`setback`},ke=(e,t,n,r=n)=>({x0:e-n,x1:e+n,z0:t-r,z1:t+r}),W=(e=[2.4,2.45,2.5],t=5)=>({floorH:3,bayW:1.2,winW:.5,winH:.5,layer:j.METAL,base:j.METAL,seed:t,margin:0,depth:.05,tint:e});function Ae(e,t,n,r,i,a={}){return t<=.4?[{...e,y0:n,y1:r,p:i,parapet:0,sides:{...U},...a}]:[{x0:e.x0+t,x1:e.x1-t,z0:e.z0,z1:e.z1,y0:n,y1:r,p:i,parapet:0,sides:{...U},...a},{x0:e.x0,x1:e.x0+t,z0:e.z0+t,z1:e.z1-t,y0:n,y1:r,p:i,parapet:0,sides:{...U,px:`party`},...a},{x0:e.x1-t,x1:e.x1,z0:e.z0+t,z1:e.z1-t,y0:n,y1:r,p:i,parapet:0,sides:{...U,nx:`party`},...a}]}function je(e,t,n,r,i,a,o){if(r>=2*n-.3)return[{...ke(e,t,n),y0:i,y1:a,p:o,parapet:0,sides:{...U}}];let s=Math.max(1,Math.min(4,Math.round((2*n-r)/4))),c=[],l=[];for(let e=0;e<=s;e++){let t=n-e*(2*n-r)/s;c.push(t),l.push(r-t)}let u=[{x0:e-c[s],x1:e+c[s],z0:t-l[s],z1:t+l[s],y0:i,y1:a,p:o,parapet:0,sides:{...U}}];for(let n=0;n<s;n++)u.push({x0:e+c[n+1],x1:e+c[n],z0:t-l[n],z1:t+l[n],y0:i,y1:a,p:o,parapet:0,sides:{...U,nx:`party`}}),u.push({x0:e-c[n],x1:e-c[n+1],z0:t-l[n],z1:t+l[n],y0:i,y1:a,p:o,parapet:0,sides:{...U,px:`party`}});return u}function Me(e,t,n,r,i,a){let o=e=>t.gH+e*t.floorH,s=[1,.7,.36],c=H(e,24.5,24.5,20,20),l=H(e,27.5,27.5,23,23);ae(c,o(72),o(80),s,2.4,1.1),ae(l,o(80),o(85)+1,s,2.4,1.1),ae(ke(n,r,12,9),i,i+14.6,s,2,1.1),ae(ke(n,r,12,9),i+1.5,i+14.6,s,.9,6,1.2,1.75),ae(H(e,21,21,17,17),o(72)-14,o(72)+.2,s,.3,-3.5),ae(ke(n,r,8.2),a,a+38,[1,.8,.52],.4,7,1.2,1.4),Ne(c,o(72)+.4,16761466,4),Ne(l,o(80)+.4,16761466,4)}function Ne(e,t,n,r){let i=(e.x0+e.x1)/2,a=(e.z0+e.z1)/2;for(let[o,s,c,l]of[[i,e.z0-2.8,0,1],[i,e.z1+2.8,0,-1],[e.x0-2.8,a,1,0],[e.x1+2.8,a,-1,0]])te.add({type:`spot`,pos:[o,t,s],dir:[c*.12,1,l*.12],angle:.7,penumbra:.7,color:n,intensity:r,range:34,radius:1.2,volume:0})}function Pe(){let e=[];return e.push({name:`empire`,x0:146,x1:234,z0:240,z1:320,seed:3401,arch:()=>({type:`deco`,style:M.DECO,layer:j.LIME,base:j.GRANITE,floorH:3.9,bayW:1.75,winW:.72,winH:.8,gH:7,height:340,depth:.34,margin:1,tint:[.86,.85,.82],cornice:!1,waterTower:!1,lintel:0,seed:34.1,shape:(e,t,n)=>{let r=e=>t.gH+e*t.floorH,i={...n,tint:[.78,.775,.76]},a=[{...e,y0:0,y1:r(5),p:n,parapet:1.3,roof:!0},{...H(e,9,9,7,7),y0:r(5),y1:r(20),p:i,parapet:1.2,roof:!0,sides:{...U}},{...H(e,15,15,12,12),y0:r(20),y1:r(29),p:n,parapet:1.2,roof:!0,sides:{...U}},...Ae(H(e,21,21,17,17),5.5,r(29),r(72),n,{roof:!0}).map((e,t)=>t?{...e,p:i}:e),...Ae(H(e,24.5,24.5,20,20),4,r(72),r(80),n,{roof:!0}),...Ae(H(e,27.5,27.5,23,23),3,r(80),r(85),n)],o=H(e,21,21,17,17),s=(e.x0+e.x1)/2,c=(e.z0+e.z1)/2,l=7.5,u=1.4;return a.push({x0:s-l,x1:s+l,z0:o.z0-u,z1:o.z0,y0:r(29),y1:r(72)-2*t.floorH,p:n,parapet:0,roof:!1,sides:{...U,pz:`party`}}),a.push({x0:s-l,x1:s+l,z0:o.z1,z1:o.z1+u,y0:r(29),y1:r(72)-2*t.floorH,p:n,parapet:0,roof:!1,sides:{...U,nz:`party`}}),a.push({x0:o.x0-u,x1:o.x0,z0:c-l,z1:c+l,y0:r(29),y1:r(72)-2*t.floorH,p:n,parapet:0,roof:!1,sides:{...U,px:`party`}}),a.push({x0:o.x1,x1:o.x1+u,z0:c-l,z1:c+l,y0:r(29),y1:r(72)-2*t.floorH,p:n,parapet:0,roof:!1,sides:{...U,nx:`party`}}),a}}),extra(e,t,{S:n,Z:r,tile:i}){let a=t.masses.reduce((e,t)=>t.y1>e.y1?t:e,t.masses[0]),o=(e.x0+e.x1)/2,s=(e.z0+e.z1)/2,c=a.y1;for(let e of t.masses){if(e.y0<.1)continue;let a=e.sides||{},o=e.p,s=e.y1+(e.parapet||0)-.12,c={...o,style:M.BLANK,tint:o.tint.map(e=>e*1.06)};for(let l of[`nz`,`pz`,`nx`,`px`]){if(a[l]===`party`)continue;let u=l===`nz`||l===`pz`,d=u?e.x1-e.x0:e.z1-e.z0,f=u?e.x0:e.z0,p=d-2*o.margin,m=Math.max(1,Math.floor(p/o.bayW+.5)),h=p/m;for(let a=0;a<=m;a++){let u=a%4==0,d=f+o.margin+a*h,p=a===0||a===m||u?.4:.24,g=u?.55:.3,_;_=l===`nz`?[d-p,e.z0-g,d+p,e.z0]:l===`pz`?[d-p,e.z1,d+p,e.z1+g]:l===`nx`?[e.x0-g,d-p,e.x0,d+p]:[e.x1,d-p,e.x1+g,d+p];let v=(_[0]+_[2])/2,y=(_[1]+_[3])/2;t.masses.some(t=>t!==e&&t.y1>e.y0+1&&t.y0<s-1&&v>t.x0-.05&&v<t.x1+.05&&y>t.z0-.05&&y<t.z1+.05)||B(i,n,r,_[0],e.y0+.2,_[1],_[2],s,_[3],c,{zip:!1,lod:!1})}}}{let e={nz:null,pz:null,nx:null,px:null},r=t.A;for(let a of t.masses){if(a.y0<.1||a.x1-a.x0<2.5||a.z1-a.z0<2.5)continue;let t=a.sides||{},o=a.parapet||0,s=a.y1+o,c=.7,l=.5,u=o<.1,d=e=>t[e]===`party`?0:c,f={...a.p,style:M.BLANK,tint:[.97,.95,.9],topY:a.y1,baseY:a.y1-l},p=u?a.y1-l:s-1.4;for(let o of[`nz`,`pz`,`nx`,`px`]){if(t[o]===`party`)continue;if(u){let e;e=o===`nz`?[a.x0-d(`nx`),a.z0-c,a.x1+d(`px`),a.z0]:o===`pz`?[a.x0-d(`nx`),a.z1,a.x1+d(`px`),a.z1+c]:o===`nx`?[a.x0-c,a.z0,a.x0,a.z1]:[a.x1,a.z0,a.x1+c,a.z1];let t=o===`nx`||o===`px`?{nz:null,pz:null}:{};i.fac.box(e[0],a.y1-l,e[1],e[2],a.y1,e[3],f,t,!0,!0),i.lod.box(e[0],a.y1-l,e[1],e[2],a.y1,e[3],f,t,!0,!1),n.box(e[0],a.y1-l,e[1],e[2],a.y1,e[3],`ledge`)}let m=.012,h=(e,t,n)=>({...a.p,topY:s,tint:a.p.tint.map(t=>t*e)}),g=(t,n,s)=>{if(n-t<.3)return;let c;c=o===`nz`?[a.x0,a.z0-m,a.x1,a.z0]:o===`pz`?[a.x0,a.z1,a.x1,a.z1+m]:o===`nx`?[a.x0-m,a.z0,a.x0,a.z1]:[a.x1,a.z0,a.x1+m,a.z1],i.fac.box(c[0],t,c[1],c[2],n,c[3],h(s),{...e,[o]:{style:a.p.style??r.style,gH:-r.gH}},!1,!1)};g(p-2.2,p,.8),g(a.y0,Math.min(a.y0+3,p-2.2),.7)}}}let l={floorH:3.9,bayW:1.75,winW:.44,winH:.66,layer:j.LIME,base:j.LIME,seed:12,margin:.8,depth:.3,tint:[.9,.88,.83]},u=W([2.5,2.52,2.55],7);for(let e of t.masses)if(!(Math.abs(e.y0-287.8)>.1||e.x1-e.x0<20)){for(let[t,a]of[[e.x0-2.2,e.z0-2.2],[e.x1,e.z0-2.2],[e.x0-2.2,e.z1],[e.x1,e.z1]])B(i,n,r,t,e.y0,a,t+2.2,e.y0+7.8,a+2.2,l,{style:M.BLANK,zip:!1});break}B(i,n,r,o-12,c,s-9,o+12,c+7.8,s+9,l,{style:M.DECO}),B(i,n,r,o-12,c+7.8,s-9,o+12,c+9,s-8.6,l,{zip:!1}),B(i,n,r,o-12,c+7.8,s+8.6,o+12,c+9,s+9,l,{zip:!1}),B(i,n,r,o-12,c+7.8,s-8.6,o-11.6,c+9,s+8.6,l,{zip:!1}),B(i,n,r,o+11.6,c+7.8,s-8.6,o+12,c+9,s+8.6,l,{zip:!1}),B(i,n,r,o-8,c+7.8,s-8,o+8,c+14.5,s+8,l,{style:M.DECO});let d=c+14.5;z(i,n,r,o,s,6.2,d,d+4,l,{n:12,zipTop:!1}),z(i,n,r,o,s,5.2,d+4,d+34,u,{n:12,style:M.DECO,zipTop:!1});let f={...l,tint:[.95,.93,.88]};for(let[e,t,a,c,l]of[[5,7.8,-.7,.7,26],[-7.8,-5,-.7,.7,26],[4.4,7,-2.4,-1.4,20],[4.4,7,1.4,2.4,20],[-7,-4.4,-2.4,-1.4,20],[-7,-4.4,1.4,2.4,20]])B(i,n,r,o+e,d+4,s+a,o+t,d+4+l,s+c,f,{zip:!1}),B(i,n,r,o+a,d+4,s+e,o+c,d+4+l,s+t,f,{zip:!1});z(i,n,r,o,s,4.2,d+34,d+38,l,{n:12,zipTop:!1}),z(i,n,r,o,s,3.6,d+38,d+44,u,{n:12,style:M.CURTAIN,zipTop:!1}),z(i,n,r,o,s,3.6,d+44,d+49,W([2,2.02,2.05]),{n:12,r1:1.3,zipTop:!1}),z(i,n,r,o,s,1.1,d+49,d+60,W([1.8,1.8,1.85]),{n:8,r1:.8,zipTop:!1}),z(i,n,r,o,s,.7,d+60,d+106,W([1.6,1.6,1.65]),{n:6,r1:.18}),Me(e,t.A,o,s,c,d)}}),e.push({name:`chrysler`,x0:484,x1:540,z0:-160,z1:-80,seed:4202,arch:()=>({type:`deco`,style:M.DECO,layer:j.WHITE,base:j.GRANITE,floorH:3.8,bayW:1.6,winW:.5,winH:.62,gH:6.5,height:240,depth:.3,margin:.8,tint:[.9,.89,.87],cornice:!1,waterTower:!1,seed:42.2,shape:(e,t,n)=>{let r=e=>t.gH+e*t.floorH,i=(e.x0+e.x1)/2,a=(e.z0+e.z1)/2;return[{...e,y0:0,y1:r(4),p:n,parapet:1.1,roof:!0},{...H(e,4,4,6,6),y0:r(4),y1:r(16),p:n,parapet:1.1,roof:!0,sides:{...U}},{...H(e,8,8,10,10),y0:r(16),y1:r(24),p:n,parapet:1.1,roof:!0,sides:{...U}},...Ae(ke(i,a,15),2.5,r(24),r(58),n,{roof:!0}),...Ae(ke(i,a,13),2,r(58),r(61),n)]}}),extra(e,t,{S:n,Z:r,tile:i}){let a=(e.x0+e.x1)/2,o=(e.z0+e.z1)/2,s=t.H,c=12.5,l={...W([3.3,3.32,3.35],9)};for(let e=0;e<7;e++)B(i,n,r,a-c,s,o-c,a+c,s+6.2,o+c,l,{style:M.ARCH,zip:e===0}),s+=6.2,c-=1.5;z(i,n,r,a,o,2.2,s,s+42,l,{n:8,r1:.1}),ae(ke(a,o,12.5),t.H,s+42,[.86,.92,1],.55,16),Ne(ke(a,o,12.5),t.H+.4,14477567,10)}}),e.push({name:`park432`,x0:372,x1:404,z0:-620,z1:-586,seed:5701,arch:()=>({type:`postwar`,style:M.PUNCHED,layer:j.WHITE,base:j.CONCRETE,floorH:4.7,bayW:3.6,winW:.7,winH:.66,gH:9,height:425,margin:0,depth:.45,tint:[1.05,1.05,1.03],cornice:!1,waterTower:!1,lintel:0,resid:1,glass:2,seed:57.01,shape:(e,t,n)=>[{...ke((e.x0+e.x1)/2,(e.z0+e.z1)/2,14.5),y0:0,y1:Oe(t,425),p:n,parapet:1.6,sides:{...U}}]}),extra(e,t,{S:n,Z:r,tile:i}){let a=t.masses[0],o=t.A,s={floorH:o.floorH,bayW:3.6,winW:.66,winH:.97,layer:j.WHITE,base:j.WHITE,seed:3,margin:0,depth:.9,tint:[1,1,.98],resid:0,glass:2};for(let e=12;e*o.floorH+o.gH<a.y1-10;e+=12){let t=o.gH+e*o.floorH;B(i,n,r,a.x0-.06,t,a.z0-.06,a.x1+.06,t+o.floorH,a.z1+.06,s,{style:M.RIBBON,zip:!1})}let c=a.y1-2*o.floorH;B(i,n,r,a.x0-.06,c,a.z0-.06,a.x1+.06,a.y1-.6,a.z1+.06,{...s,floorH:2*o.floorH-.6,winH:.92},{style:M.RIBBON,zip:!1})}}),e.push({name:`cptower`,x0:136,x1:174,z0:-552,z1:-514,seed:5702,arch:()=>({type:`glass`,style:M.CURTAIN,layer:j.METAL,base:j.GRANITE,floorH:4.3,bayW:1.5,winW:.97,winH:.8,gH:9,height:440,margin:0,depth:.04,tint:[1,1,1],glass:4,seed:1,shape:(e,t,n)=>{let r={...n,style:M.PUNCHED,layer:j.LIME,winW:.62,winH:.66,depth:.3,margin:1,tint:[1,.98,.95]},i=Oe(t,30),a=Oe(t,300),o=Oe(t,370),s=Oe(t,425);return[{...e,y0:0,y1:i,p:r,parapet:1,roof:!0},...Ae(H(e,3),4,i,a,n,{roof:!0}),...Ae(H(e,3,10,3,3),3,a,o,n,{roof:!0}),...Ae(H(e,3,10,10,3),3,o,s,n)]}}),extra(e,t,{S:n,Z:r,tile:i}){let a=t.H,o=t.masses.filter(e=>Math.abs(e.y1-a)<.1),s={x0:Math.min(...o.map(e=>e.x0)),x1:Math.max(...o.map(e=>e.x1)),z0:Math.min(...o.map(e=>e.z0)),z1:Math.max(...o.map(e=>e.z1))},c=t.A,l={floorH:c.floorH,bayW:c.bayW,winW:c.winW,winH:c.winH,layer:j.METAL,base:j.METAL,seed:1,margin:0,depth:.04,tint:[1,1,1],glass:4},u=s,d=a;for(let e=0;e<2;e++)u=H(u,2.2),B(i,n,r,u.x0,d,u.z0,u.x1,d+2*c.floorH,u.z1,l,{style:M.CURTAIN,zip:e===1}),d+=2*c.floorH;u=H(u,2.2),B(i,n,r,u.x0,d,u.z0,u.x1,d+2*c.floorH,u.z1,l,{style:M.CURTAIN,zip:!1}),d+=2*c.floorH;let f={floorH:.4,bayW:1.2,winW:1,winH:.2,layer:j.CONCRETE,base:j.CONCRETE,seed:13,margin:0,depth:.05,tint:[1.08,1.08,1.1],glass:2};B(i,n,r,u.x0-.3,d,u.z0-.3,u.x1+.3,d+9,u.z1+.3,f,{style:M.RIBBON,zip:!1}),B(i,n,r,u.x0-.8,d+9,u.z0-.8,u.x1+.8,d+10.2,u.z1+.8,W([2.6,2.62,2.66],9));let p=H(u,2.5),m=(u.x0+u.x1)/2,h=(u.z0+u.z1)/2,g=d+10.2;p.x1-p.x0>4&&p.z1-p.z0>4&&(B(i,n,r,p.x0,g,p.z0,p.x1,g+4.5,p.z1,{...f,tint:[.92,.93,.95]},{style:M.RIBBON}),g+=4.5),z(i,n,r,m,h,1.6,g,g+3.5,W([2.3,2.3,2.35]),{n:8,zipTop:!1}),z(i,n,r,m,h,.9,g+3.5,g+11.5,W([2.5,2.5,2.55]),{n:8,r1:.7,zipTop:!1}),z(i,n,r,m,h,1.3,g+7.5,g+7.9,W([2.6,2.6,2.65]),{n:8,zipTop:!1}),z(i,n,r,m,h,.45,g+11.5,g+19.5,W([2.6,2.6,2.65]),{n:6,r1:.12})}}),e.push({name:`one57`,x0:40,x1:80,z0:-552,z1:-512,seed:5703,arch:()=>({type:`glass`,style:M.CURTAIN,layer:j.METAL,base:j.GRANITE,floorH:4,bayW:1.5,winW:.97,winH:.72,gH:8,height:306,margin:0,depth:.04,tint:[.95,.98,1.02],glass:1,seed:2,shape:(e,t,n)=>{let r=H(e,2),i=[{...e,y0:0,y1:Oe(t,24),p:{...n,style:M.PUNCHED,layer:j.GRANITE,winW:.62,winH:.66,depth:.3,margin:1},parapet:1,roof:!0}],a=Oe(t,24);return[200,226,250,270,290,306].forEach((e,o)=>{let s=Oe(t,e);i.push({...r,x0:r.x0+o*5.5,y0:a,y1:s,p:n,parapet:0,roof:!0,sides:{...U}}),a=s}),i}})}),e.push({name:`wtc1`,x0:-168,x1:-110,z0:2731,z1:2789,seed:1776,arch:()=>({type:`glass`,style:M.CURTAIN,layer:j.METAL,base:j.GRANITE,floorH:4.2,bayW:1.5,winW:.97,winH:.84,gH:12,height:430,margin:0,depth:.04,tint:[.97,1,1.05],glass:4,seed:3,shape:(e,t,n)=>{let r=(e.x0+e.x1)/2,i=(e.z0+e.z1)/2,a=Math.min(e.x1-e.x0,e.z1-e.z0)/2,o=Oe(t,57),s={...n,style:M.RIBBON,layer:j.METAL,winW:.22,winH:.94,tint:[1.55,1.57,1.6]},c=[{...ke(r,i,a),y0:0,y1:o,p:s,parapet:0,roof:!1,sides:{...U}}],l=a*1.03,u=o;for(let e=0;e<14;e++){let s=Oe(t,o+(430-o)*(e+1)/14);if(s<=u)continue;let d=(e+.5)/14;c.push(...je(r,i,a,2*a+(l-2*a)*d,u,s,n)),u=s}return c}}),extra(e,t,{S:n,Z:r,tile:i}){let a=(e.x0+e.x1)/2,o=(e.z0+e.z1)/2,s=t.H;z(i,n,r,a,o,9,s,s+4.5,W([1.8,1.85,1.9]),{n:16,style:M.RIBBON,zipTop:!1}),z(i,n,r,a,o,3.2,s+4.5,s+9,W([2,2,2.05]),{n:12,zipTop:!1}),z(i,n,r,a,o,2.1,s+9,s+140,W([2.7,2.72,2.75]),{n:8,r1:.35}),ae(ke(a,o,9.5),s,s+140,[.88,.93,1],.7,45)}}),e.push({name:`bluehq`,x0:-234,x1:-176,z0:-71,z1:-9,seed:811,arch:()=>({type:`glass`,style:M.CURTAIN,layer:j.METAL,base:j.GRANITE,floorH:4,bayW:1.5,winW:.97,winH:.7,gH:8,height:300,margin:0,depth:.04,tint:[.9,.95,1.05],glass:0,seed:1.94,cornice:!1,waterTower:!1,shape:(e,t,n)=>{let r={...n,style:M.PUNCHED,layer:j.GRANITE,winW:.6,winH:.62,depth:.32,margin:1,tint:[.62,.63,.66]},i=Oe(t,30),a=Oe(t,252),o=Oe(t,284),s=Oe(t,300);return[{...e,y0:0,y1:i,p:r,parapet:1.2,roof:!0},...Ae(H(e,5,5,6,6),5,i,a,n,{roof:!0}),...Ae(H(e,5,15,6,6),4,a,o,n,{roof:!0}),{...H(e,9,19,10,10),y0:o,y1:s,p:n,parapet:0,sides:{...U},spireR:6}]}}),extra(e,t,{S:n,Z:r,tile:i}){t.A;let a=W([2.9,2.2,.85],21),o=H(e,5,5,6,6),s=t.masses[0].y1,c=t.masses.find(e=>e.y0===s&&e.x0===o.x0+5),l=t.masses.find(e=>Math.abs(e.y0-c.y1)<.01),u=(l?l.y1:c.y1)+2,d=.45,f=1.3;for(let e of[1/3,2/3]){let t=c.x0+(c.x1-c.x0)*e;B(i,n,r,t-f,s,c.z0-d,t+f,u,c.z0,a,{zip:!1}),B(i,n,r,t-f,s,c.z1,t+f,u,c.z1+d,a,{zip:!1})}let p=(o.z0+o.z1)/2;B(i,n,r,o.x0-d,s,p-f,o.x0,u,p+f,a,{zip:!1});let m=t.masses.find(e=>e.y0===s&&e.x0===o.x1-5);B(i,n,r,o.x1,s,p-f,o.x1+d,m.y1+3,p+f,a,{zip:!1});let h=t.masses[t.masses.length-1],g=h.y1,_={floorH:.42,bayW:1.2,winW:1,winH:.3,layer:j.METAL,base:j.METAL,seed:7,margin:0,depth:.05,tint:[2.3,2.34,2.4],glass:2};B(i,n,r,h.x0-.4,g,h.z0-.4,h.x1+.4,g+7,h.z1+.4,_,{style:M.RIBBON,zip:!1}),B(i,n,r,h.x0-.7,g+7,h.z0-.7,h.x1+.7,g+8,h.z1+.7,W([2.6,2.62,2.65],9));let v=(h.x0+h.x1)/2,y=(h.z0+h.z1)/2,b=g+8;z(i,n,r,v,y,3.2,b,b+5,W([2.2,2.22,2.25]),{n:12,zipTop:!1}),z(i,n,r,v,y,1.5,b+5,b+30,W([2.4,2.4,2.45]),{n:8,r1:.9,zipTop:!1});for(let e of[.3,.65])z(i,n,r,v,y,2.2-e,b+5+25*e,b+5.6+25*e,W([2.6,2.6,2.65]),{n:8,zipTop:!1});z(i,n,r,v,y,.9,b+30,b+46,W([2.7,2.7,2.75]),{n:6,r1:.15}),ae({x0:h.x0-1,z0:h.z0-1,x1:h.x1+1,z1:h.z1+1},g-3,b+46,[.85,.92,1],.6,14);for(let[e,t]of[[-1,-1],[1,-1],[-1,1],[1,1]])B(i,n,r,v+e*4.2-.3,b,y+t*4.2-.3,v+e*4.2+.3,b+9,y+t*4.2+.3,W([2.2,2.2,2.25]),{zip:!1})}}),e.push({name:`vanderbilt`,x0:336,x1:384,z0:-151,z1:-89,seed:4203,arch:()=>({type:`glass`,style:M.CURTAIN,layer:j.METAL,base:j.LIME,floorH:4.1,bayW:1.6,winW:.97,winH:.74,gH:10,height:330,margin:0,depth:.04,tint:[1,1,1.02],glass:4,seed:1.05,cornice:!1,waterTower:!1,shape:(e,t,n)=>{let r={...n,style:M.PUNCHED,layer:j.LIME,winW:.66,winH:.7,depth:.32,margin:1,tint:[.97,.95,.9]},i=(e.x0+e.x1)/2,a=(e.z0+e.z1)/2,o=[{...e,y0:0,y1:Oe(t,26),p:r,parapet:1.1,roof:!0}],s=[[112,20,26,3],[178,18.5,24,5],[238,17,22,7],[288,15,19,8.5],[330,12.5,15.5,9]],c=Oe(t,26);for(let[e,r,l,u]of s){let s=Oe(t,e),d=je(i,a,r,2*r-u,c,s,n),f=l/r;for(let t of d)o.push({...t,z0:a+(t.z0-a)*f,z1:a+(t.z1-a)*f,roof:!0,...e===330?{spireR:12}:{}});c=s}return o}}),extra(e,t,{S:n,Z:r,tile:i}){let a=(e.x0+e.x1)/2,o=(e.z0+e.z1)/2,s=t.H,c=t.A,l={floorH:c.floorH,bayW:1.6,winW:.97,winH:.74,layer:j.METAL,base:j.METAL,seed:1.05,margin:0,depth:.04,tint:[1,1,1.02],glass:4};B(i,n,r,a-8,s,o-10,a+8,s+3*c.floorH,o+10,l,{style:M.CURTAIN});let u=s+3*c.floorH;B(i,n,r,a-8.4,u,o-10.4,a+8.4,u+1.2,o+10.4,W([2.6,2.62,2.65],9),{zip:!1}),B(i,n,r,a-5,u+1.2,o-6,a+5,u+7,o+6,l,{style:M.CURTAIN}),z(i,n,r,a,o,1.8,u+7,u+12,W([2.4,2.42,2.45]),{n:8,zipTop:!1}),z(i,n,r,a,o,1.1,u+12,u+40,W([2.7,2.72,2.75]),{n:8,r1:.2}),ae({x0:a-9,z0:o-11,x1:a+9,z1:o+11},s,u+40,[.9,.94,1],.5,18)}}),e}var Fe=`// grandcentral shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`,Ie=`// timessq shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`,Le=`// screenlights shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`,Re=ne(()=>Le),G={gain:1,sat:2,minL:.06,mergeA:40,mergeGap:5,mergeMax:26,volume:.28,point:1,split:10,halo:.3,printed:.8,lodNear:45,tileMin:3},ze=[];function Be(){for(let e of ze)e.sync?e.sync():e.col?te.update(e.id,{color:e.col(),intensity:e.I()}):te.update(e.id,{intensity:e.I()})}typeof window<`u`&&(window.__screenLights={SL:G,refresh:Be,all:ze});var Ve=new m,He=e=>1.5*Math.max(e,G.minL)/(1+Math.max(e,G.minL));function Ue(e){let t=.2126*e[0]+.7152*e[1]+.0722*e[2],n=Math.max(0,t+(e[0]-t)*G.sat),r=Math.max(0,t+(e[1]-t)*G.sat),i=Math.max(0,t+(e[2]-t)*G.sat),a=Math.max(n,r,i,1e-4);return{rgb:[n/a,r/a,i/a],lum:t,m:a}}function We(){let e=[],t=[],n=[];return{rects:e,points:t,halos:n,rect(t,n,r,i,a,o,s=1,c={}){(o||c.uv)&&i>.3&&a>.3&&e.push({c:[...t],n:[...n],u:[...r],w:i,h:a,avg:o?[...o]:null,k:s,uv:c.uv?[c.uv[0],c.uv[1],c.uv[2],c.uv[3]]:null,pr:!!c.printed,range:c.range,whole:!!c.whole,gain:c.gain??1})},point(e,n,r,i=8,a=.2){t.push({p:[...e],col:n,I:r,range:i,volume:a})},halo(e,t,r,i,a,o){o&&n.push({c:[...e],n:[...t],u:[...r],w:i,h:a,avg:[...o]})},commit(i=``,a={}){let o={tag:i,panels:e.length,emitters:0,halos:n.length,points:t.length,pending:!0};typeof window<`u`&&(window.__screenLightStats??=[]).push(o);let s=e.some(e=>e.uv),c=e=>{try{r(e,i,a,o)}catch(e){console.warn(`[screenlights]`,i,e)}o.pending=!1};return s?(a.grid??ye()).then(c,()=>c(null)):c(null),o}};function r(r,i,a,o){let s=a.mergeA??G.mergeA,c=a.mergeGap??G.mergeGap,l=a.mergeMax??G.mergeMax;for(let t of e){let e=t.uv&&r?Ke(r,t.uv,0,1,0,1):null;e?t.avg=e:t.avg||=[.15,.15,.15]}let u=e.filter(e=>e.w*e.h<s),d=e.filter(e=>e.w*e.h>=s),f=[];for(let e of u){let t=e.c[0]*e.u[0]+e.c[2]*e.u[2],n=e.c[0]*e.n[0]+e.c[2]*e.n[2],r=null;for(let i of f){if(i.n[0]!==e.n[0]||i.n[2]!==e.n[2]||Math.abs(i.d-n)>2)continue;let a=Math.min(i.t0,t-e.w/2),o=Math.max(i.t1,t+e.w/2),s=Math.min(i.y0,e.c[1]-e.h/2),u=Math.max(i.y1,e.c[1]+e.h/2),d=Math.max(i.t0-(t+e.w/2),t-e.w/2-i.t1),f=Math.max(i.y0-(e.c[1]+e.h/2),e.c[1]-e.h/2-i.y1);if(!(d>c||f>c||o-a>l||u-s>l)){r=i,Object.assign(i,{t0:a,t1:o,y0:s,y1:u});break}}r||f.push(r={n:e.n,u:e.u,d:n,t0:t-e.w/2,t1:t+e.w/2,y0:e.c[1]-e.h/2,y1:e.c[1]+e.h/2,list:[]}),r.list.push(e)}let p=[],h=[],g=e=>{let t=Math.max(1,Math.ceil(e.w/G.split-.15)),n=Math.max(1,Math.ceil(e.h/G.split-.15));e.uv&&r&&!e.whole&&(e.w>=G.tileMin&&e.w>=.6*e.h&&(t=Math.max(t,2)),e.h>=G.tileMin&&e.h>=.6*e.w&&(n=Math.max(n,2)));let i=e.w/t,a=e.h/n;for(let o=0;o<t;o++)for(let s=0;s<n;s++){let c=(o+.5)*i-e.w/2,l=(s+.5)*a-e.h/2,u={...e,c:[e.c[0]+e.u[0]*c,e.c[1]+l,e.c[2]+e.u[2]*c],w:i,h:a};e.uv&&r&&!e.whole&&(u.avg=Ke(r,e.uv,o/t,(o+1)/t,s/n,(s+1)/n)??e.avg),u.list=[u],p.push(u),v.push(u)}v.length===1&&(p.pop(),v.length=0);let o={...e,list:[e]};p.push(o),h.push({whole:o,tiles:v.length>1?v:null,T:v})},v,y=e=>{v=[],g(e)};for(let e of d)y(e);for(let e of f){if(e.list.length===1){y(e.list[0]);continue}let t=e.t1-e.t0,n=e.y1-e.y0,r=(e.t0+e.t1)/2,i=e.list.reduce((e,t)=>e+t.c[0]*t.n[0]+t.c[2]*t.n[2],0)/e.list.length,a={c:[e.n[0]*i+e.u[0]*r,(e.y0+e.y1)/2,e.n[2]*i+e.u[2]*r],n:e.n,u:e.u,w:t,h:n,list:e.list,pr:e.list.every(e=>e.pr)};p.push(a),h.push({whole:a,tiles:null})}for(let e of p){let t=0,n=0,r=0;for(let i of e.list){let e=i.w*i.h*i.k;t+=i.avg[0]*e,n+=i.avg[1]*e,r+=i.avg[2]*e}let a=e.w*e.h,o={kind:`rect`,avg:[t/a,n/a,r/a],c:e.c,n:e.n,w:e.w,h:e.h,tag:i,pr:!!e.pr,g:e.gain??1};o.col=()=>{let e=Ue(o.avg);return Ve.setRGB(e.rgb[0],e.rgb[1],e.rgb[2],_).clone()},o.I=()=>{let e=Ue(o.avg);return G.gain*o.g*He(e.m)*(o.pr?G.printed:1)};let s=Math.sqrt(a),c=e.range??Math.min(60,Math.max(e.pr?12:18,s*(e.pr?3.5:4.5)));o.rec={type:`rect`,pos:e.c,dir:e.n,u:e.u,width:e.w,height:e.h,color:new m,intensity:1,range:c,radius:Math.min(e.w,e.h)/2,volume:G.volume},o.sync=()=>{o.rec.color.copy(o.col()).multiplyScalar(o.I())},o.sync(),e.e=o,ze.push(o)}for(let e of h){let t=e.whole.e,n=Math.max(t.w,t.h);Ge.push({x:t.c[0],z:t.c[2],R:t.rec.range+n,lod:G.lodNear+n,far:t.pr?160:70+5*(t.rec.range+n),whole:t.rec,tiles:e.tiles?e.tiles.map(e=>e.e.rec):null})}for(let e of n){let t={kind:`rect`,avg:e.avg,c:e.c,n:e.n,w:e.w,h:e.h,tag:i+`Halo`};t.col=()=>{let e=Ue(t.avg);return Ve.setRGB(e.rgb[0],e.rgb[1],e.rgb[2],_).clone()},t.I=()=>{let n=Ue(t.avg);return G.gain*G.halo*He(n.m)*e.w*e.h},t.id=te.add({type:`point`,pos:e.c,color:t.col(),intensity:t.I(),range:Math.min(22,3+.8*Math.max(e.w,e.h)),radius:.3*Math.min(e.w,e.h),volume:0}),ze.push(t)}for(let e of t){let t={kind:`point`,I:()=>e.I*G.point};t.id=te.add({type:`point`,pos:e.p,color:e.col,intensity:t.I(),range:e.range,radius:.3,volume:e.volume}),ze.push(t)}o.emitters=p.length,o.boards=h.length}}var Ge=[];te.addProvider((e,t)=>{if(ie.value<.01||!Ge.length)return;let n=t.position.x,r=t.position.z,i=0;for(let t=0;t<Ge.length;t++){let a=Ge[t],o=a.x-n,s=a.z-r;if(Math.abs(o)>256+a.R||Math.abs(s)>256+a.R)continue;let c=o*o+s*s;if(!(c>a.far*a.far)){if(a.tiles&&c<a.lod*a.lod){for(let t=0;t<a.tiles.length;t++)e(a.tiles[t]);i+=a.tiles.length}else e(a.whole),i++}}G.emitted=i});function Ke(e,t,n=0,r=1,i=0,a=1){let o=t[0]+(t[2]-t[0])*n,s=t[0]+(t[2]-t[0])*r,c=t[1]+(t[3]-t[1])*i,l=t[1]+(t[3]-t[1])*a,u=Math.max(0,Math.floor(Math.min(o,s)*e.width)),d=Math.min(e.width,Math.max(u+1,Math.round(Math.max(o,s)*e.width))),f=Math.max(0,Math.floor((1-Math.max(c,l))*e.height)),p=Math.min(e.height,Math.max(f+1,Math.round((1-Math.min(c,l))*e.height))),m=0,h=0,g=0,_=0;for(let t=f;t<p;t+=1)for(let n=u;n<d;n+=1){let r=(t*e.width+n)*3;m+=e.linearRgb[r]??0,h+=e.linearRgb[r+1]??0,g+=e.linearRgb[r+2]??0,_+=1}return _?[m/_,h/_,g/_]:null}var qe={value:2},Je={value:-.18},Ye=()=>({uScreenK:A,uNightK:ie,uScrBoost:qe,uScrDesat:Je,uScrKnee:Qe,uScrTop:$e}),Xe=Re.uniformDeclarations,Ze=Re.gainExpression,Qe={value:.28},$e={value:.46};typeof window<`u`&&Object.assign(window.__screenLights,{uScrBoost:qe,uScrKnee:Qe,uScrTop:$e});var et=re(Re.highlightShoulder,Ze);function tt(t,n){t.userData.nightGain=1;let r=t.onBeforeCompile;t.onBeforeCompile=function(t,n){r&&r!==e.prototype.onBeforeCompile&&r.call(this,t,n),Object.assign(t.uniforms,Ye()),t.fragmentShader=t.fragmentShader.replace(`#include <common>`,re(Re.fragmentCommon,Xe)).replace(`#include <lights_fragment_begin>`,re(Re.fragmentLightsBegin,Ze,et))};let i=t.customProgramCacheKey;return t.customProgramCacheKey=function(){return(i?i.call(this):``)+`|scrNight|`+n},t}var nt=ne(()=>Ie),K=F.CURB_H,rt=1.3,it=ge(`city/tex/`),q={plazaRows:[-240,-160],endRows:[-320,-80],plazaX:44,towerX:100,endX:96,oneTS:{x0:-9,x1:9,z0:-64,z1:-24,h:98},tkts:{x0:-40,x1:-21,zFront:-207,zBack:-229,n:16}},at=[],ot=[],st=e=>({z0:e+F.ST_HALF+F.ST_WALK,z1:e+F.ST_SP-F.ST_HALF-F.ST_WALK,c0:e+F.ST_HALF,c1:e+F.ST_SP-F.ST_HALF}),ct=(e,t)=>e.gH+Math.max(1,Math.round((t-e.gH)/e.floorH))*e.floorH;function lt(){let e=[],t=(t,n,r,i,a,o,s,c,l=!1)=>e.push({name:t,x0:n,x1:r,z0:i,z1:a,seed:s,ts:!0,face:o,sides:{[o]:`street`},arch:e=>({type:`glass`,style:e()<.5?M.RIBBON:M.CURTAIN,layer:e()<.45?j.CONCRETE:j.METAL,base:j.GRANITE,floorH:3.8,bayW:1.6,winW:.9,winH:.5,gH:7,height:l?72+e()*40:140+e()*110,depth:.12,margin:.4,tint:[.62,.64,.68],cornice:!1,waterTower:!1,shape:(e,t,n,r,i)=>{let a=ct(t,c[0]+r()*c[1]),s={...n,style:M.PUNCHED,layer:[j.CONCRETE,j.LIME,j.BUFF,j.RED][Math.floor(r()*4)],winW:.6,winH:.55,tint:[.62,.6,.58]},u=t=>t===o?(l?9:4)+r()*3:e.sides[t]===`street`?2.5:1.2,d=[{...n,style:M.DECO,layer:r()<.5?j.LIME:j.BUFF,bayW:1.9,winW:.52,winH:.62,depth:.25,tint:[1,.98,.94]},{...n,style:M.PUNCHED,layer:r()<.6?j.RED:j.BROWN,bayW:2.3,winW:.55,winH:.6,depth:.22,tint:[1,1,1]},{...n,style:M.RIBBON,layer:j.WHITE,bayW:1.6,winW:.9,winH:.5,depth:.12,tint:[.9,.9,.9]},{...n,style:M.CURTAIN,layer:j.METAL,bayW:1.5,winW:.97,winH:.74,depth:.05,tint:[.62,.66,.74]},n],f=d[Math.floor(r()*d.length)],p=[{x0:e.x0,x1:e.x1,z0:e.z0,z1:e.z1,y0:0,y1:a,p:s,parapet:1.1,roof:!0}],m={x0:e.x0+u(`nx`),x1:e.x1-u(`px`),z0:e.z0+u(`nz`),z1:e.z1-u(`pz`)},h=a,g=1+Math.floor(r()*3);for(let e=0;e<g;e++){let n=e===g-1||Math.min(m.x1-m.x0,m.z1-m.z0)<22,a=n?i:ct(t,h+(i-h)*(.45+r()*.25));if(p.push({...m,y0:h,y1:a,p:f,parapet:f.style===M.CURTAIN?.6:1.3,roof:!0}),n)break;h=a;let o=2.5+r()*3;m={x0:m.x0+o,x1:m.x1-o,z0:m.z0+o,z1:m.z1-o}}return p}})});for(let n of q.plazaRows){let{z0:r,z1:i}=st(n);e.push({name:`tsqPlazaW`,x0:-q.plazaX,x1:-10,z0:r,z1:i,custom:!0,tsPlaza:!0}),e.push({name:`tsqPlazaE`,x0:10,x1:q.plazaX,z0:r,z1:i,custom:!0,tsPlaza:!0}),t(`tsqTowerW`,-q.towerX,-q.plazaX,r,i,`px`,900+n,[36,22],!0),t(`tsqTowerE`,q.plazaX,q.towerX,r,i,`nx`,950+n,[36,22])}for(let e of q.endRows){let{z0:n,z1:r}=st(e);t(`tsqEndW`,-q.endX,-10,n,r,`px`,1300+e,[30,26],e===-80),t(`tsqEndE`,10,q.endX,n,r,`nx`,1350+e,[30,26])}return e}var ut=64,dt=4096,ft=4096;function pt(e){let t={L:Array.from({length:ut},()=>[]),P:Array.from({length:ut},()=>[])};return(n,r,i)=>{let a=t[n?`L`:`P`],o=0,s=-1,c=n?I:L;for(let n=0;n<ut;n+=1){let l=1e5;if(c){let e=c[n];for(let n of[`L`,`P`]){let a=n===`L`?I:L,o=t[n];for(let t=0;t<ut;t+=1)if(a[t]===e)for(let e of o[t])l=Math.min(l,Math.hypot(e[0]-r,e[1]-i))}}else for(let e of a[n])l=Math.min(l,Math.hypot(e[0]-r,e[1]-i));let u=l+e()*8;u>s&&(s=u,o=n)}return a[o].push([r,i]),o}}function mt(e,t,n,r=0,i=0){let a=t>=1||t>.75&&e()<.5;return gt(a,n(a,r,i),t)}function ht(e,t,n){let r=e[0]!==`P`,i=r?be:R,a=i?i.indexOf(e):-1;if(a<0)return null;let o=gt(r,a,n?r?2:.5:t);if(n){let e=o[3]-o[1];o[1]+=e*n[0],o[3]=o[1]+e*(n[1]-n[0])}return o}function gt(e,t,n){let r,i,a,o,s;e?(r=t%8/8,a=1/8,o=1/16,i=1-(Math.floor(t/8)+1)/16,s=2):(r=t%16/16,a=1/16,o=1/8,i=.5-(Math.floor(t/16)+1)/8,s=.5);let c=2/dt,l=2/ft;if(r+=c,a-=2*c,i+=l,o-=2*l,n>s){let e=s/n;i+=o*(1-e)/2,o*=e}else{let e=n/s;r+=a*(1-e)/2,a*=e}let u=[r,i,r+a,i+o];return u.avg=(e?we:Te)[t],u}var _t=64,vt=[];function yt(e,t){if(!vt.length){vt=Array.from({length:_t},(e,t)=>t);for(let t=63;t>0;t--){let n=Math.floor(e()*(t+1));[vt[t],vt[n]]=[vt[n],vt[t]]}}let n=vt.pop(),r=n%4/4+2/2048,i=.25-4/2048,a=1-(Math.floor(n/4)+1)/16+2/2048,o=1/16-4/2048;if(t>4){let e=4/t;a+=o*(1-e)/2,o*=e}else{let e=t/4;r+=i*(1-e)/2,i*=e}return[r,a,r+i,a+o]}function bt(e,t){let n=e%4/4+2/2048,r=.25-4/2048,i=1-(Math.floor(e/4)+1)/16+2/2048,a=1/16-4/2048;if(t>4){let e=4/t;i+=a*(1-e)/2,a*=e}else{let e=t/4;n+=r*(1-e)/2,r*=e}return[n,i,n+r,i+a]}var xt=[3,19,22,38,54,57,37,53,20,18,12,36],St=class{constructor(){this.p=[],this.n=[],this.uv=[],this.c=[],this.i=[],this.v=0}quad(e,t,n,r,i,a,o=[1,1,1]){for(let a of[e,t,n,r])this.p.push(a[0],a[1],a[2]),this.n.push(i[0],i[1],i[2]),this.c.push(o[0],o[1],o[2]);this.uv.push(a[0],a[1],a[2],a[1],a[2],a[3],a[0],a[3]),this.i.push(this.v,this.v+1,this.v+2,this.v,this.v+2,this.v+3),this.v+=4}room(e,t,n,r,i,a,o,s,c,l){this.tan||(this.tan=[],this.rm=[]),this.quad(e,t,n,r,i,a,o);for(let[e,t]of[[0,0],[1,0],[1,1],[0,1]])this.tan.push(s[0],s[1],s[2]),this.rm.push(e,t,c,l)}build(){if(!this.v)return null;let e=new C;return e.setAttribute(`position`,new c(this.p,3)),e.setAttribute(`normal`,new c(this.n,3)),e.setAttribute(`uv`,new c(this.uv,2)),e.setAttribute(`color`,new c(this.c,3)),this.tan&&(e.setAttribute(`aTan`,new c(this.tan,3)),e.setAttribute(`aRoom`,new c(this.rm,4))),e.setIndex(this.v>65535?new r(this.i,1):new h(this.i,1)),e.computeBoundingSphere(),e}};function Ct(e,{srgb:t=!0,repeat:n=!1,aniso:r=8}={}){let i=new l().load(e);return t&&(i.colorSpace=f),i.anisotropy=r,n&&(i.wrapS=i.wrapT=g),i}function wt(){let e=new Uint8Array(4096);for(let t=0;t<32;t++)for(let n=0;n<32;n++){let r=Math.hypot(n-16+.5,t-16+.5)/11.52,i=Math.max(0,Math.min(1,1.25-r))**1.5,a=(t*32+n)*4;e[a]=e[a+1]=e[a+2]=Math.round(20+235*i),e[a+3]=255}let t=new b(e,32,32);return t.wrapS=t.wrapT=g,t.magFilter=p,t.minFilter=i,t.generateMipmaps=!0,t.needsUpdate=!0,t}function Tt(){let e=new Uint8Array(65536),t=de(99),n=Array.from({length:64},()=>t()),r=Array.from({length:64},()=>.3+t()*.7),a=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)};for(let t=0;t<64;t++)for(let i=0;i<256;i++){let o=Math.floor(i/64),s=(i%64+.5)/64,c=(t+.5)/64,l;if(o===0)l=(1-c)**1.9;else if(o===1){let e=Math.hypot(s-.5,c-.5)*2;l=Math.max(0,1-e)**1.6}else if(o===2)l=a(0,.16,Math.min(s,1-s,c,1-c));else{let e=i%64,t=.5*n[e]+.25*(n[(e+1)%64]+n[(e+63)%64]);l=Math.max(0,t-.25)*1.4*Math.max(0,1-c/r[e])**1.3+.15*(1-c)**2}let u=(t*256+i)*4;e[u]=e[u+1]=e[u+2]=0,e[u+3]=Math.round(255*l)}let o=new b(e,256,64);return o.magFilter=p,o.minFilter=i,o.generateMipmaps=!0,o.needsUpdate=!0,o}function Et(e){if(!e.length||typeof Image>`u`)return;let t=new Image;t.onload=()=>{let n=document.createElement(`canvas`);n.width=64,n.height=128;let r=n.getContext(`2d`,{willReadFrequently:!0});r.drawImage(t,0,0,64,128);let i=r.getImageData(0,0,64,128).data,a=e=>(e/=255,e<=.04045?e/12.92:((e+.055)/1.055)**2.4),o=We();for(let t of e){let e=(t.uv[0]+t.uv[2])/2,n=(t.uv[1]+t.uv[3])/2,r=Math.abs(t.uv[2]-t.uv[0])/2,s=Math.abs(t.uv[3]-t.uv[1])/2,c=Math.floor((e-r)*64),l=Math.ceil((e+r)*64),u=Math.floor((1-n-s)*128),d=Math.ceil((1-n+s)*128),f=0,p=0,m=0,h=0;for(let e=Math.max(0,u);e<Math.min(128,d);e++)for(let t=Math.max(0,c);t<Math.min(64,l);t++){let n=(e*64+t)*4;f+=a(i[n]),p+=a(i[n+1]),m+=a(i[n+2]),h++}h&&o.rect(t.c,t.n,t.u,t.w,t.h,[f/h,p/h,m/h],3)}o.commit(`tsSigns`,{mergeA:1e9,mergeGap:9,mergeMax:44})},t.src=it+`ts_signs.webp`}function Dt({scene:e,gen:t}){let n=t.solids,r=t.zips,i=de(4242),a=de(1111),o=de(4404),s=de(5505),c=0,l=0;vt=[],at.length=0,ot.length=0;let u=new St,f=new St,h=new St,_=new fe,C=new St,O=new fe,ne=new St,A=new St,ae=new St,oe=new St,se=[.008,0,.242,1],ce=[.256,0,.494,1],N=[.506,0,.744,1],ue=[.752,0,.998,1],P=K+.016,pe=(e,t,n,r,i)=>oe.quad(e,t,[t[0]+n[0]*r,t[1]+n[1]*r,t[2]+n[2]*r],[e[0]+n[0]*r,e[1]+n[1]*r,e[2]+n[2]*r],[0,1,0],se,[i,i,i]),me=(e,t,n,r,i,a=P)=>oe.quad([e-n,a,t+r],[e+n,a,t+r],[e+n,a,t-r],[e-n,a,t-r],[0,1,0],ce,[i,i,i]),he=(e,t,n,r,i,a=P)=>oe.quad([e,a,r],[n,a,r],[n,a,t],[e,a,t],[0,1,0],N,[i,i,i]),ge=pt(i),_e=pt(a),I=(e,t,r,i,a,o,s,c)=>{c!==void 0&&_.setColor(c),_.box(e,t,r,i,a,o),n.box(e,t,r,i,a,o,s)},L=(e,t,n,r)=>[e.n[0]*(e.d+r)+e.r[0]*t,n,e.n[1]*(e.d+r)+e.r[1]*t],R=(e,t,n,r,i,a,o,s,c)=>{let l=L(e,t,r,a),u=L(e,n,i,o);I(Math.min(l[0],u[0]),r,Math.min(l[2],u[2]),Math.max(l[0],u[0]),i,Math.max(l[2],u[2]),s,c)},ye=[[.35,1,.9],[1,.3,.65],[1,.75,.35],[.45,.6,1],[1,1,1]],be=[],z=[],xe=We(),Se=[],B=!1,Te=[],V=(e,t,n,r,a,o,s={})=>{Te.push({n:e.n,d:e.d,ta:t,tb:n,ya:r,yb:a+2.2});let c=s.frame??[1776671,2237222,2895153,1381655,3816255,1776671,7106162,9343124,12171442][Math.floor(i()*9)],l=s.sign||s.flush?0:s.gap??.3+i()*.6;l&&(o=Math.max(o,.4));let d=l?{...e,d:e.d+l}:e;if(l){_.setColor(2829616);let i=Math.max(2,Math.round((n-t)/3.2)+1);for(let o=0;o<i;o++){let s=t+.3+(n-t-.75)*o/(i-1);R(e,s,s+.15,r+.25,a-.25,0,l,`wall`)}for(let i of[r+.45,a-.65])R(e,t+.2,n-.2,i,i+.18,.03,l-.03,`wall`);let o=.7+Math.min(1.2,l*1.2);oe.quad(L(e,t-o,r-o,.02),L(e,n+o,r-o,.02),L(e,n+o,a+o*.5,.02),L(e,t-o,a+o*.5,.02),[e.n[0],0,e.n[1]],N,[.62,.62,.62])}R(d,t,n,r,a,0,o,`wall`,c);let p=!s.sign&&!s.flush&&n-t>5;p&&(o=Math.max(o,.6+i()*.5));let m=s.bezel??(p?.26+i()*.3:.16+i()*.22),g=o+.012,v=[d.n[0],0,d.n[1]],y=n-t-2*m,b=a-r-2*m,x=L(d,(t+n)/2,0,0),S=s.uv??(s.sign?yt(i,y/b):mt(i,y/b,ge,x[0]+(r+a)*.15,x[2])),C=!!s.vinyl&&!s.sign;!s.sign&&!C&&!s.noSpill&&r<32&&be.push({f:e,ta:t,tb:n,ya:r,yb:a,off:l+o,avg:S.avg}),!s.sign&&!C&&!s.noHalo&&S.avg&&n-t>2.5&&z.push({f:e,ta:t,tb:n,ya:r,yb:a,avg:S.avg});let w=s.sign?f:C?ae:u,T=s.bright??(C?.85+i()*.2:.62+i()*.5);if(!s.sign&&!C&&S.avg){let e=S.avg,t=.2126*e[0]+.7152*e[1]+.0722*e[2];T*=Math.min(1.45,Math.max(.55,(.15/(t+.02))**.5))}if(w.quad(L(d,t+m,r+m,g),L(d,n-m,r+m,g),L(d,n-m,a-m,g),L(d,t+m,a-m,g),v,S,[T,T,T]),!C&&!s.sign?(xe.rect(L(d,(t+n)/2,(r+a)/2,g-.05),v,[d.r[0],0,d.r[1]],y,b,S.avg,1,{uv:S}),y*b>30&&l&&xe.halo(L(d,(t+n)/2,(r+a)/2,-l+Math.min(1.5,l+g-.15)),v,[d.r[0],0,d.r[1]],y,b,S.avg)):C?xe.rect(L(d,(t+n)/2,(r+a)/2,g+.02),v,[d.r[0],0,d.r[1]],y,b,S.avg,1,{uv:S,printed:!0}):s.sign&&Se.push({c:L(d,(t+n)/2,(r+a)/2,g+.06),n:v,u:[d.r[0],0,d.r[1]],w:y,h:b,uv:S}),s.sign)return;if(C){let e=.1;_.setColor(c),R(d,t,n,a-m,a,o,o+e,`wall`),R(d,t,n,r,r+m,o,o+e,`wall`),R(d,t,t+m,r+m,a-m,o,o+e,`wall`),R(d,n-m,n,r+m,a-m,o,o+e,`wall`);let i=Math.max(2,Math.round((n-t)/3.4)),s=.9+Math.min(.8,(a-r)*.05);for(let e=0;e<i;e++){let r=t+(n-t)*(e+.5)/i;_.setColor(2500651),R(d,r-.035,r+.035,a+.05,a+.12,o,o+s,`pole`),R(d,r-.035,r+.035,a-.25,a+.12,o+.02,o+.1,`pole`),R(d,r-.2,r+.2,a-.02,a+.16,o+s-.05,o+s+.22,`pole`);let c=L(d,r-.18,a-.025,o+s-.03),l=L(d,r+.18,a-.025,o+s+.2);h.quad([c[0],a-.025,c[2]],[l[0],a-.025,c[2]],[l[0],a-.025,l[2]],[c[0],a-.025,l[2]],[0,-1,0],[.5,.5,.5,.5],[1,.93,.8])}return}let E=s.lip??(p?.14+i()*.16:.06+i()*.06);_.setColor(c),R(d,t,n,a-m,a,o,o+E,`wall`),R(d,t,n,r,r+m,o,o+E,`wall`),R(d,t,t+m,r+m,a-m,o,o+E,`wall`),R(d,n-m,n,r+m,a-m,o,o+E,`wall`);let D=s.trim===`bulbs`?0:s.trim===`cols`?.3:s.trim===`bar`?.5:s.trim===`none`?1:i(),O=o+E+.01,k=(e,t,n,r,i,a,o,s=O)=>{let c=i?n-e:r-t;h.quad(L(d,e,t,s),L(d,n,t,s),L(d,n,r,s),L(d,e,r,s),v,o?i?[0,0,c/o,1]:[0,0,1,c/o]:[.5,.5,.5,.5],a)};if(D<.2&&!s.noTrim){let e=[1,.82,.55],i=.34;k(t,a-i,n,a,!0,e,i),k(t,r,n,r+i,!0,e,i),k(t,r+i,t+i,a-i,!1,e,i),k(n-i,r+i,n,a-i,!1,e,i)}else if(D<.36&&s.trim===`cols`&&a-r>6&&!s.noTrim){let s=ye[Math.floor(i()*2)],c=o+.3;for(let i of[t-.9,n+.35])R(d,i,i+.55,r,a,0,o+.28,`wall`,1447706),l&&R(e,i+.2,i+.35,r+.4,a-.4,0,l,`wall`,2829616),h.quad(L(d,i+.08,r+.3,c),L(d,i+.47,r+.3,c),L(d,i+.47,a-.3,c),L(d,i+.08,a-.3,c),v,[0,0,1,(a-r)/.8],s)}else if(D<.56){let e=ye[Math.floor(i()*ye.length)],o=.12+i()*.18;k(t,a-o,n,a,!0,e,0),i()<.6&&k(t,r,n,r+o,!0,e,0)}if(s.edgeLed){let e=s.edgeLed;k(t,r,t+.09,a,!1,e,0),k(n-.09,r,n,a,!1,e,0)}if(p&&l&&s.rig&&a-r>4){let e=a+.02,r=Math.min(s.rigH??1.3,.8+i()*.5),c=o*.2,l=Math.min(o,c+.5);_.setColor(3882562),R(d,t+.1,n-.1,e,e+.1,c,l,`pole`),R(d,t+.1,n-.1,e+r-.1,e+r,c,l,`pole`);let u=Math.max(2,Math.round((n-t)/1.4)+1);for(let i=0;i<u;i++){let a=t+.1+(n-t-.3)*i/(u-1);R(d,a,a+.09,e+.1,e+r-.1,c+.08,l-.08,`pole`)}let f=Math.max(2,Math.round((n-t)/4.5));for(let i=0;i<f;i++){let a=t+(n-t)*(i+.5)/f;_.setColor(2303272),R(d,a-.04,a+.04,e+r-.09,e+r-.01,l,o+E+.85,`pole`),R(d,a-.17,a+.17,e+r-.32,e+r-.02,o+E+.72,o+E+1.02,`pole`);let s=L(d,a-.15,e+r-.325,o+E+.74),c=L(d,a+.15,e+r-.325,o+E+1);h.quad([s[0],s[1],s[2]],[c[0],s[1],s[2]],[c[0],s[1],c[2]],[s[0],s[1],c[2]],[0,-1,0],[.5,.5,.5,.5],[1,.95,.85])}}if(l&&!B&&!s.noWalk&&n-t>7&&(r<9.5||s.walk)&&i()<.2){let i=l+o+1,a=r-.14;_.setColor(2303015),R(e,t-.3,n+.3,a,a+.08,0,i,`roof`);for(let r=t-.25;r<n+.3;r+=1.55)R(e,r,r+.05,a+.08,a+1.1,i-.06,i-.01,`pole`);R(e,t-.3,n+.3,a+1.05,a+1.1,i-.07,i,`pole`),R(e,t-.3,n+.3,a+.56,a+.6,i-.06,i-.01,`pole`);for(let r=t+.4;r<n-.3;r+=3.2)R(e,r,r+.12,a-.55,a,0,i-.4,`wall`)}},Ee={px:[1,0],nx:[-1,0],pz:[0,1],nz:[0,-1]},De=(e,t,r,a,o,s,c,l=3.4,d=1.25,f={})=>{let p=Ee[t],m=Ee[r];for(let n of[t,r]){let t=Ve(e,n);Te.push({n:t.f.n,d:t.f.d,ta:-1e9,tb:1e9,ya:a-.5,yb:o+.6})}let g=[(p[0]||m[0])>0?e.x1:e.x0,(p[1]||m[1])>0?e.z1:e.z0],v=(e,t)=>[g[0]+p[0]*e+m[0]*t,g[1]+p[1]*e+m[1]*t],y=v(d-l,d-l);_.setColor(1908257);let b=(e,t)=>I(Math.min(e[0],t[0]),a,Math.min(e[1],t[1]),Math.max(e[0],t[0]),o,Math.max(e[1],t[1]),`wall`);b(v(0,d-l-s),v(d,d-l)),b(v(d-l-c,0),v(d-l,d)),_.cyl(y[0],a,y[1],l-.015,l-.015,o-a,20,!0),n.cyl(y[0],y[1],a,o,l,l,`wall`),_.setColor(2763824);for(let[e,t]of[[o,o+.34],[a-.3,a]]){let r=l+.32,i=d+.32;_.cyl(y[0],e,y[1],r,r,t-e,40,!0),n.cyl(y[0],y[1],e,t,r,r,`wall`);for(let[n,r]of[[v(0,d-l-s-.3),v(i,d-l)],[v(d-l-c-.3,0),v(d-l,i)]])I(Math.min(n[0],r[0]),e,Math.min(n[1],r[1]),Math.max(n[0],r[0]),t,Math.max(n[1],r[1]),`wall`)}let x=[];x.push([...v(d+.01,d-l-s),p]);for(let e=0;e<=12;e++){let t=e/12*Math.PI/2,n=Math.cos(t),r=Math.sin(t),i=[p[0]*n+m[0]*r,p[1]*n+m[1]*r];x.push([y[0]+i[0]*(l+.01),y[1]+i[1]*(l+.01),i])}x.push([...v(d-l-c,d+.01),m]);let S=[p[1],-p[0]];(S[0]!==m[0]||S[1]!==m[1])&&x.reverse();let C=[0];for(let e=1;e<x.length;e++)C.push(C[e-1]+Math.hypot(x[e][0]-x[e-1][0],x[e][1]-x[e-1][1]));let w=C[C.length-1],T=.18,E=v(d,d),D=f.uv??mt(i,w/(o-a-2*T),ge,E[0]+(a+o)*.15,E[1]),O=f.k??.95+i()*.2,k=f.tile?w/Math.max(1,Math.round(w/f.tile)):w;if(f.tile){let e=[x[0]],t=[0];for(let n=1;n<x.length;n++){let r=x[n-1],i=x[n],a=C[n-1],o=C[n];for(let n=(Math.floor(a/k+1e-6)+1)*k;n<o-1e-4;n+=k){let s=(n-a)/(o-a),c=[r[2][0]+(i[2][0]-r[2][0])*s,r[2][1]+(i[2][1]-r[2][1])*s],l=Math.hypot(c[0],c[1])||1;e.push([r[0]+(i[0]-r[0])*s,r[1]+(i[1]-r[1])*s,[c[0]/l,c[1]/l]]),t.push(n)}e.push(i),t.push(o)}x.length=0,x.push(...e),C.length=0,C.push(...t)}{let e=0;for(let t=1;t<x.length;t++){let n=x[e],r=x[t],i=t===x.length-1,s=x[t][2],c=n[2][0]*s[0]+n[2][1]*s[1];if(!i&&c>.82)continue;let l=r[0]-n[0],u=r[1]-n[1],p=Math.hypot(l,u);if(p>.5){let i=[l/p,0,u/p],s=[i[2],0,-i[0]],c=x[Math.round((e+t)/2)][2];s[0]*c[0]+s[2]*c[1]<0&&(s[0]*=-1,s[2]*=-1);let m=f.tile?null:[D[0]+(D[2]-D[0])*C[e]/w,D[1],D[0]+(D[2]-D[0])*C[t]/w,D[3]];xe.rect([(n[0]+r[0])/2-s[0]*.05,(a+o)/2,(n[1]+r[1])/2-s[2]*.05],s,i,p,o-a-2*T,D.avg,1,m?{uv:m}:{}),xe.halo([(n[0]+r[0])/2-s[0]*d*.5,(a+o)/2,(n[1]+r[1])/2-s[2]*d*.5],s,i,p,o-a-2*T,D.avg)}e=t}}for(let e=1;e<x.length;e++){let t=x[e-1],n=x[e],r=Math.floor((C[e-1]+C[e])/2/k),i=D[0]+(D[2]-D[0])*(C[e-1]/k-r),s=D[0]+(D[2]-D[0])*(C[e]/k-r),c=[(t[2][0]+n[2][0])/2,0,(t[2][1]+n[2][1])/2];u.quad([t[0],a+T,t[1]],[n[0],a+T,n[1]],[n[0],o-T,n[1]],[t[0],o-T,t[1]],c,[i,D[1],s,D[3]],[O,O,O]);let l=ye[(e+Math.floor(a))%2?0:1];for(let[e,r]of[[o-T,o],[a,a+T]]){let i=[t[0]+t[2][0]*.02,t[1]+t[2][1]*.02],a=[n[0]+n[2][0]*.02,n[1]+n[2][1]*.02];h.quad([i[0],e,i[1]],[a[0],e,a[1]],[a[0],r,a[1]],[i[0],r,i[1]],c,[.5,.5,.5,.5],l)}}},Oe=[1776671,2237222,1381655,2895153],H=[11120050,9343124,12895944],U=[10123840,8414255,11570506],ke=()=>{let e=i(),t=e<.5?Oe:e<.72?H:e<.86?U:[14276302,15263456];return t[Math.floor(i()*t.length)]},W=[[1,.22,.55],[.25,.85,1],[1,.5,.15],[1,.14,.1],[.75,.4,1],[.95,.95,1]],Ae=new St,je=(e,t,n,r,a,o={})=>{Te.push({n:e.n,d:e.d,ta:t-.5,tb:n+.5,ya:r-.5,yb:a+.5});let s=[e.n[0],0,e.n[1]],c=o.col??W[Math.floor(i()*W.length)],l=o.dep??.3+i()*.2,u=bt(xt[Math.floor(i()*xt.length)],(n-t)/(a-r));i()<.65&&R(e,t-.25,n+.25,r-.18,a+.18,l-.07,l,`wall`,1118483),_.setColor(2763566);for(let i of[t+.35,(t+n)/2,n-.35])R(e,i-.04,i+.04,r+.15,a-.15,0,l-.07,`pole`);Ae.quad(L(e,t,r,l+.025),L(e,n,r,l+.025),L(e,n,a,l+.025),L(e,t,a,l+.025),s,u,c),xe.point(L(e,(t+n)/2,(r+a)/2,l+.6),new m(c[0],c[1],c[2]),6+2*(n-t),7+(n-t),.35)},Me=(e,t,n,r,a)=>V(e,t,n,r,a,.45,{bezel:.05,lip:.02,frame:H[Math.floor(i()*3)],trim:`none`,noWalk:!0,edgeLed:i()<.6?[.85,.92,1]:null}),Ne=(e,t,n,r,a)=>V(e,t,n,r,a,.9+i()*.5,{gap:.25,bezel:.3+i()*.2,lip:.18,frame:ke(),trim:i()<.4?`bar`:`none`,noWalk:!0,noHalo:!0}),Pe=(e,t,r,a,o,s=3.8)=>{Te.push({n:e.n,d:e.d,ta:t,tb:r,ya:a,yb:o+1});let c=[e.n[0],0,e.n[1]],l=.09,u=L(e,(t+r)/2,0,0),d=.88+i()*.16;ae.quad(L(e,t,a,l),L(e,r,a,l),L(e,r,o,l),L(e,t,o,l),c,mt(i,(r-t)/(o-a),ge,u[0]+a*.15,u[2]),[d,d,d]),_.setColor(3816512),R(e,t-.08,r+.08,o,o+.1,0,.13,`wall`),R(e,t-.08,r+.08,a-.1,a,0,.13,`wall`),R(e,t-.1,t,a,o,0,.13,`wall`),R(e,r,r+.1,a,o,0,.13,`wall`);let f=Math.max(2,Math.round((r-t)/2.5)),p=(r-t)/f;for(let n=1;n<f;n++){let r=t+n*p;oe.quad(L(e,r-.04,a,.096),L(e,r+.04,a,.096),L(e,r+.04,o,.096),L(e,r-.04,o,.096),c,N,[.5,.5,.5])}for(let n=a+s*(.3+i()*.4);n<o-.3;n+=s)oe.quad(L(e,t,n,.096),L(e,r,n,.096),L(e,r,n+.35,.096),L(e,t,n+.35,.096),c,N,[.16,.16,.16]);let m=L(e,t,a,0),h=L(e,r,o,.11);n.box(Math.min(m[0],h[0]),a,Math.min(m[2],h[2]),Math.max(m[0],h[0]),o,Math.max(m[2],h[2]),`wall`)},Fe=(e,t,n,r,a,o)=>{let s=n-t,c=a-r,l=i();if(l<.34&&c>9){let l=Math.min(s,3.2+i()*2.8),u=Math.min(c,Math.max(l*3.2,c*(.7+i()*.3))),d=o?t:n-l;if(Me(e,d,d+l,a-u,a),s-l>8&&i()<.5){let t=Math.min(s-l-2,4+i()*4),n=o?d+l+1.8:d-1.8-t,a=r+i()*Math.max(0,c-t/4-1);je(e,n,n+t,a,a+t/4.2)}}else if(l<.58){let n=Math.min(s-.5,4+i()*5),a=n/4.2,o=t+(s-n)*i(),l=r+1+i()*Math.max(0,c-a-2);n>2.5&&je(e,o,o+n,l,l+a)}else if(l<.8){let c=Math.min(s,4+i()*4),l=o?t:n-c,u=c*(.55+i()*.5),d=a-u;for(let t=0;t<2&&d>r&&(Ne(e,l,l+c,d,d+u),d-=u+2+i()*3,!(i()<.5));t++);}},Ie=(e,t,n,r,a)=>{let o=a-r,s=i();if(s<.4)Ue(e,t,n,a-Math.min(o,1.25),Math.min(o,1.25)),o>3.4&&i()<.5&&Ue(e,t,n,a-2.9,1.1);else if(s<.62){let r=Math.min(o-.2,1.6+i()*1.2),s=Math.min(n-t-1,r*4.2),c=t+(n-t-s)*i();s>3&&je(e,c,c+s,a-r-.1,a-.1)}else if(s<.82&&o>3){let r=2+Math.floor(i()*2),s=1.8+i(),c=Math.min(7,(n-t-(r-1)*s)/r),l=Math.min(o-.4,c*.6);if(c>2.5)for(let i=0;i<r;i++){let o=t+(n-t-r*c-(r-1)*s)/2+i*(c+s);Ne(e,o,o+c,a-l,a)}}},Le=(e,t,n,r,a,o={})=>{let s=o.pad??1.8;t+=s,n-=s;let c=n-t,l=a-r;if(c<5||l<4)return;if(c>50){let s=t+c*(.42+i()*.16),l={...o,pad:0};Le(e,t,s-1.2,r,a,l),Le(e,s+1.2,n,r,a,l);return}let u=1.4+i()*1.2,d=l*(.6+i()*.32);l-d<u+2&&(d=l);let f=Math.min(c*(.55+i()*.25),d*3.2);c-f<u+3&&(f=c);let p=o.heroHi??i()<.5,m=i()<.62,h=p?n-f:t,g=h+f,_=m?a-d:r,v=_+d,y=v>=a-.01,b=i();b<.4?V(e,h,g,_,v,.5+i()*.7,{frame:ke(),bezel:i()<.3?.05:.35+i()*.45,lip:i()<.3?.02:void 0,trim:i()<.45?`bar`:`none`,rig:y&&i()<.7}):b<.64&&!o.noWrap?Pe(e,h,g,_,v,o.fh):b<.8?V(e,h,g,_,v,.55+i()*.5,{frame:i()<.6?U[Math.floor(i()*3)]:1710620,bezel:.45+i()*.25,trim:`bulbs`,rig:y&&i()<.4}):V(e,h,g,_,v,.4,{vinyl:!0,frame:ke(),walk:_<14});let x=p?t:g+u,S=p?h-u:n;S-x>=2.6&&Fe(e,x,S,r,a,p);let C=m?r:v+u,w=m?_-u:a;w-C>=1.4&&Ie(e,h,g,C,w)},Re=[9209472,7301732,3815478,10787468,5982782,2895409],G=[2763566,9314854,2380342,2307178,6965796,1381653,11041314,8003140],ze=(e,t,r)=>{let a=K,o=4.65,s=[e.n[0],0,e.n[1]],c=Math.max(1,Math.round(r/3.6)),l=r/c,u=Math.floor(i()*8);for(let n=0;n<c;n++){let r=t+n*l,c=r+l,d=(u+n%2)%8,f=d%4/4+.004,p=1-Math.floor(d/4)/2-.004,m=.8+i()*.35;A.room(L(e,r,a+.5,.035),L(e,c,a+.5,.035),L(e,c,o,.035),L(e,r,o,.035),s,[f,p-.49,f+.242,p],[m,m,m],[e.r[0],0,e.r[1]],c-r,o-a-.5)}pe(L(e,t-.6,P,.42),L(e,t+r+.6,P,.42),[e.n[0],0,e.n[1]],1.5,.5),_.setColor(1974050),R(e,t,t+r,a,a+.5,0,.06,`wall`),R(e,t,t+r,3.6,3.7,.035,.06,`wall`),R(e,t,t+r,o,4.73,0,.06,`wall`);for(let n=0;n<=c;n++){let i=t+n*l;R(e,Math.max(t,i-.05),Math.min(t+r,i+.05),a+.5,o,.035,.06,`wall`)}let d=t+(Math.floor(c/2)+.5)*l;R(e,d-.95,d-.87,a,3.6,.035,.06,`wall`),R(e,d+.87,d+.95,a,3.6,.035,.06,`wall`),_.setColor(12106943),R(e,d-.8,d+.8,1.1,1.16,.035,.06,`wall`),n.box(...(()=>{let n=L(e,t,a,0),i=L(e,t+r,o,.06);return[Math.min(n[0],i[0]),a,Math.min(n[2],i[2]),Math.max(n[0],i[0]),o,Math.max(n[2],i[2])]})(),`wall`);let f=Re[Math.floor(i()*Re.length)];for(let[n,i]of[[t-.55,t],[t+r,t+r+.55]])R(e,n,i,0,4.7,0,.42,`wall`,f),R(e,n-.02,i+.02,0,.45,0,.44,`wall`,2763308);R(e,t,t+r,4.73,4.7,0,.42,`wall`,f)},Be=(e,t,r)=>{let a=t+.6;for(;a<r-3;){let t=Math.min(r-.6-a,6+i()*9);if(t<3)break;V(e,a,a+t,5,7.25,.3,{sign:!0,bezel:.1,frame:1184276,bright:1.15}),ze(e,a,t);let o=t>6&&i()<.28,s=o?2.6+i()*.8:1.6,c=o?5.8:5,l=L(e,a,4.7,0),u=L(e,a+t,c,s);if(_.setColor(o?1710620:G[Math.floor(i()*G.length)]).box(Math.min(l[0],u[0]),4.7,Math.min(l[2],u[2]),Math.max(l[0],u[0]),c,Math.max(l[2],u[2])),n.box(Math.min(l[0],u[0]),4.7,Math.min(l[2],u[2]),Math.max(l[0],u[0]),c,Math.max(l[2],u[2]),`awning`),o){let n=[e.n[0],0,e.n[1]],r=s+.012,o=[1,.8,.5];f.quad(L(e,a+.35,4.95,r),L(e,a+t-.35,4.95,r),L(e,a+t-.35,5.55,r),L(e,a+.35,5.55,r),n,yt(i,(t-.7)/.6),[1,1,1]);let c=.2;for(let[i,s]of[[4.72,4.92],[5.58,5.78]])h.quad(L(e,a,i,r+.005),L(e,a+t,i,r+.005),L(e,a+t,s,r+.005),L(e,a,s,r+.005),n,[0,0,t/c,1],o);for(let[n,r]of[[a-.012,-1],[a+t+.012,1]]){let t=[e.r[0]*r,0,e.r[1]*r],i=L(e,n,4.72,.1),a=L(e,n,4.72,s),l=L(e,n,4.92,s),u=L(e,n,4.92,.1);h.quad(i,a,l,u,t,[0,0,(s-.1)/c,1],o);let d=L(e,n,5.58,.1),f=L(e,n,5.58,s),p=L(e,n,5.78,s),m=L(e,n,5.78,.1);h.quad(d,f,p,m,t,[0,0,(s-.1)/c,1],o)}let l=L(e,a+.2,4.695,.3),u=L(e,a+t-.2,4.695,s-.2);xe.point(L(e,a+t/2,4.3,s*.6),new m(1,.72,.42),10+2.5*t,12,.4),h.quad([l[0],4.695,l[2]],[u[0],4.695,l[2]],[u[0],4.695,u[2]],[l[0],4.695,u[2]],[0,-1,0],[0,0,Math.abs(u[0]-l[0])/.45,Math.abs(u[2]-l[2])/.45],[1,.9,.7]),a+=t+.8+i()*2;continue}let d=L(e,a+.3,4.695,1.1),p=L(e,a+t-.3,4.695,1.3);h.quad([d[0],4.695,d[2]],[p[0],4.695,d[2]],[p[0],4.695,p[2]],[d[0],4.695,p[2]],[0,-1,0],[.5,.5,.5,.5],[1,.92,.78]),a+=t+.8+i()*2}},Ve=(e,t)=>t===`px`?{f:{n:[1,0],r:[0,-1],d:e.x1},t0:-e.z1,t1:-e.z0}:t===`nx`?{f:{n:[-1,0],r:[0,1],d:-e.x0},t0:e.z0,t1:e.z1}:t===`pz`?{f:{n:[0,1],r:[1,0],d:e.z1},t0:e.x0,t1:e.x1}:{f:{n:[0,-1],r:[-1,0],d:-e.z0},t0:-e.x1,t1:-e.x0},He=new St,Ue=(e,t,n,r,a,o=i())=>{R(e,t,n,r,r+a,0,.4,`wall`,1315862);let s=[e.n[0],0,e.n[1]],c=.08,l=(n-t-2*c)/((a-2*c)*32);return He.quad(L(e,t+c,r+c,.412),L(e,n-c,r+c,.412),L(e,n-c,r+a-c,.412),L(e,t+c,r+a-c,.412),s,[o,0,o+l,1]),o+l},Ge=(e,t,n,r,a)=>{Te.push({n:e.n,d:e.d,ta:t-.8,tb:t+.8,ya:n-.5,yb:r+.5}),R(e,t-.22,t+.22,n,r,0,a,`wall`,1710878);let o=L(e,t,0,a),s=mt(i,(a-.35)/(r-n-.5),ge,o[0]+n*.15,o[2]);for(let i of[1,-1]){let o=t+i*.225,c=[e.r[0]*i,0,e.r[1]*i],l=i>0?a-.1:.25,d=i>0?.25:a-.1;u.quad(L(e,o,n+.25,l),L(e,o,n+.25,d),L(e,o,r-.25,d),L(e,o,r-.25,l),c,s,[1,1,1]),xe.rect(L(e,o+i*.06,(n+r)/2,(a+.15)/2),c,[e.n[0]*-i,0,e.n[1]*-i],a-.35,r-n-.5,s.avg)}h.quad(L(e,t-.2,n,a+.01),L(e,t+.2,n,a+.01),L(e,t+.2,r,a+.01),L(e,t-.2,r,a+.01),[e.n[0],0,e.n[1]],[0,0,1,(r-n)/.3],[1,.82,.55])},Ke=e=>{let t=Ee[e];return[t[1],-t[0]]},qe=(e,t)=>{let n=Ke(e),r=Ee[t];return n[0]===r[0]&&n[1]===r[1]};for(let e of t.reserves){if(!e.ts||!e.build)continue;let[t,n]=e.build.masses,r=null,u=e.face,d={[u]:[0,0],nz:[0,0],pz:[0,0]},f=3.4,p=1.25;for(let n of[`nz`,`pz`]){if(e.lot.sides[n]!==`street`||i()<.3)continue;let r=7+i()*8,a=5+i()*6,o=8.5+i()*3,l=0;for(;o<t.y1-8;){let e=Math.min(t.y1-.8-o,8+i()*12);if(e<6||(De(t,u,n,o,o+e,r,a,f,p),l=o+e,o+=e+.75+i()*2.5,i()<.55))break}if(l&&l+4.6<t.y1+4.2&&s()<(c?.45:.9)){let e=3.3+s()*.8,i=ht(`L41`,0,[.27,.71]);i&&(De(t,u,n,l+.55,l+.55+e,r,a,f,p,{uv:i,tile:(e-.36)*4.4,k:.62}),c++)}d[u][+!!qe(u,n)]=2.15+r+.6,d[n][+!!qe(n,u)]=2.15+a+.6}{let{f:e,t0:n,t1:r}=Ve(t,u);i()<.55&&(Ue(e,n+.5+d[u][0],r-.5-d[u][1],7.4,.95),B=!0);let a=n+.5+d[u][0],o=r-.5-d[u][1];if(o-a>14&&i()<.7){let n=a+4+i()*(o-a-8),r=8.7+i()*3,s=Math.min(t.y1-1,r+14+i()*16);Le(e,a,n-2,8.6,t.y1-.6),Le(e,n+2,o,8.6,t.y1-.6),Ge(e,n,r,s,3.6+i()*1.4)}else if(o-a>24&&t.y1>22&&s()<(l?.4:.85)&&ht(`L42`,1.8)){let n=4.4+s()*.8,r=n/1.75,i=.55+s()*.3,c=3*n+2*i,u=3*r+2*i,d=a+3+s()*(o-a-c-6),f=d+c,p=Math.min(t.y1-1-u,9.2+s()*4),m=ht(`L42`,n/r);for(let t=0;t<3;t++)for(let a=0;a<3;a++){let o=d+t*(n+i),s=p+a*(r+i);V(e,o,o+n,s,s+r,.35,{uv:m,noTrim:!0,noWalk:!0,gap:.3,bright:.72,noHalo:t!==1||a!==1})}d-a>6&&Le(e,a,d-2,8.6,t.y1-.6),o-f>6&&Le(e,f+2,o,8.6,t.y1-.6),t.y1-.6-(p+u+2)>3&&Ie(e,d,f,p+u+2,t.y1-.6),l++}else Le(e,a,o,8.6,t.y1-.6);Be(e,n,r),B=!1}for(let n of[`nz`,`pz`]){if(e.lot.sides[n]!==`street`)continue;let{f:r,t0:a,t1:o}=Ve(t,n),c=qe(n,u),l=Math.min(o-a,26+i()*12),f=c?o-l:a,p=c?o:a+l;c?p-=d[n][1]:f+=d[n][0];let m=3.4+s()*.9,h=m*1.8,g=Math.min(6,Math.floor((p-f-.8)/(m+.35)));if(g>=3&&t.y1-9-h>7&&s()<.45){let e=L(r,(f+p)/2,0,0),n=gt(!1,ge(!1,e[0],e[2]),m/h),i=s()<.5,a=(f+p)/2-(g*m+(g-1)*.35)/2;for(let e=0;e<g;e++){let t=a+e*(m+.35);V(r,t,t+m,8.8,8.8+h,.3,{uv:n,vinyl:i,noTrim:!0,noWalk:!0,gap:.25,bright:i?.95:.8,noHalo:!0})}Ie(r,f+.4,p-.4,8.8+h+2,t.y1-.6)}else Le(r,f+.4,p-.4,8.4,t.y1-.6,{heroHi:c});Be(r,a,o);for(let e=0,n=c?o-l-3:a+l+3;e<2;e++){if(i()<.35)continue;let s=n+(c?-1:1)*e*(9+i()*6);if(s<a+2||s>o-2)continue;let l=8+i()*2,u=Math.min(t.y1-1,l+9+i()*9);u-l>6&&Ge(r,s,l,u,2.6+i()*.8)}}if(n){let{f:t,t0:r,t1:a}=Ve(n,u),s=[`nz`,`pz`].filter(t=>e.lot.sides[t]===`street`);if(a-r>14&&n.y1-n.y0>60&&o()<.42){let e=a-r-1.6,i=Math.min(n.y1-n.y0-12,e*(1.45+o()*.35)),s=n.y0+2+o()*6,c=o()<.45,l=L(t,(r+a)/2,0,0);V(t,r+.8,r+.8+e,s,s+i,.5,{walk:!0,vinyl:c,rig:!c,bright:c?.95:void 0,noTrim:!0,uv:mt(o,Math.min(.74,e/i),ge,l[0]+s*.15,l[2])})}else if(s.length&&i()<.55){let e=s[Math.floor(i()*s.length)],t=n.y0+3+i()*8,o=Math.min(n.y1-t-6,18+i()*26);o>10&&De(n,u,e,t,t+o,Math.min(a-r-8,8+i()*8),6+i()*6,3,1.1)}else{let e=1+ +(i()<.35),o=n.y0+2+i()*6;for(let s=0;s<e&&o<n.y1-20;s++){let e=Math.min(n.y1-4-o,22+i()*34),c=Math.min(a-r-3,12+i()*14),l=r+1.5+i()*(a-r-3-c);s===0&&i()<.3?Pe(t,l,l+c,o,o+e):V(t,l,l+c,o,o+e,.5+i()*.8,{walk:!0,vinyl:i()<.15,rig:i()<.6,frame:ke(),bezel:i()<.35?.05:void 0}),o+=e+2+i()*8}for(let e of s){if(i()<.45)continue;let t=Ve(n,e),r=qe(e,u),a=Math.min(t.t1-t.t0-2,10+i()*10),o=Math.min(n.y1-n.y0-6,14+i()*26),s=r?t.t1-a-.8:t.t0+.8,c=n.y0+3+i()*10;V(t.f,s,s+a,c,c+o,.6,{rig:i()<.5})}}}if(n&&o()<.7){let{f:e,t0:t,t1:r}=Ve(n,u),i=[e.n[0],0,e.n[1]],a=.9+o()*.5,s=.22+o()*.1,c=o()<.75?[.78,.9,.96]:ye[Math.floor(o()*4)].map(e=>e*.85),l=.25+o()*.6;for(let o of[t+l,r-l-a])for(let t=n.y0+1.4;t<n.y1-1.5;t+=3.8)h.quad(L(e,o,t,.07),L(e,o+a,t,.07),L(e,o+a,t+s,.07),L(e,o,t+s,.07),i,[.5,.5,.5,.5],c)}if(n&&e.name===`tsqTowerW`&&e.lot.z1>-100&&e.lot.z0<-100&&n.y1>t.y1+22){let e=i;i=de(9109);let{f:r,t0:a,t1:o}=Ve(n,u),s=a+2.2,c=Math.min(o-2,s+20),l=t.y1+(t.parapet??1.1)+.9,d=l+15;V(r,s,c,l,d,.6,{uv:ht(`L42`,(c-s-.6)/(d-l-.6))??gt(!0,49,(c-s-.6)/(d-l-.6)),gap:.5,bezel:.3,lip:.16,frame:1776671,trim:`bar`,noWalk:!0,noSpill:!0,noHalo:!0,bright:.38}),i=e}for(let n of[u,`nz`,`pz`])if(n===u||e.lot.sides[n]===`street`){let e=Ve(t,n);pe(L(e.f,e.t0,P,0),L(e.f,e.t1,P,0),[e.f.n[0],0,e.f.n[1]],1.2,.42)}for(let n of e.build.masses){let r=n.p||{},a=r.style===M.CURTAIN,o=r.layer===j.RED||r.layer===j.BROWN?10130310:r.layer===j.LIME||r.layer===j.BUFF?11576719:a?3159356:r.layer===j.WHITE?12763579:8749434,s=r.floorH||3.8,c=r.gH||7,l=3+Math.floor(i()*3);if(n!==t)for(let e=n.y0+l*s;e<n.y1-s*1.5;e+=l*s){let t=Math.round((e-c)/s)*s+c-.22;I(n.x0-.1,t,n.z0-.1,n.x1+.1,t+(a?.3:.42),n.z1+.1,`ledge`,o)}if(n!==t)for(let e of[`px`,`nx`,`pz`,`nz`]){let t=Ve(n,e),r=[t.f.n[0],0,t.f.n[1]],o=a?.35:.6,u=(e,n,i)=>oe.quad(L(t.f,t.t0,e,.03),L(t.f,t.t1,e,.03),L(t.f,t.t1,e-n,.03),L(t.f,t.t0,e-n,.03),r,ue,[i,i,i]);u(n.y1-.95,Math.min(n.y1-n.y0-1,6+i()*8),o);for(let e=n.y0+l*s;e<n.y1-s*1.5;e+=l*s)u(Math.round((e-c)/s)*s+c-.24,2.5+i()*3,o*.6)}let u=a?.18:.45,d=a?.5:.85;if(I(n.x0-u,n.y1-d-.05,n.z0-u,n.x1+u,n.y1-.05,n.z1+u,`cornice`,o),a||I(n.x0-u*.55,n.y1-d-.35,n.z0-u*.55,n.x1+u*.55,n.y1-d-.05,n.z1+u*.55,`cornice`,o),r.style===M.PUNCHED||r.style===M.DECO){let a=r.floorH||3.8,o=r.margin??.4,s=n.y1+(n.parapet||0),c=r.style===M.PUNCHED?.1:.06;for(let l of[`px`,`nx`,`pz`,`nz`]){if(n===t&&e.lot.sides[l]!==`street`)continue;let u=(l===`px`||l===`nx`?n.z1-n.z0:n.x1-n.x0)-2*o,d=Math.max(1,Math.round(u/(r.bayW||2.4))),f=u/d,p=f*(r.winW||.5),m=a*(r.winH||.55),h=Ve(n,l),g=h.f.n,_=Math.ceil((n.y0+.5-7)/a),v=Math.floor((s-7-1.2-a)/a);for(let e=_;e<=v;e++)for(let t=0;t<d;t++){if(i()>c)continue;let r=o+(t+.5)*f,s=7+e*a+(a-m)*.42,u=l===`pz`?n.x0+r:l===`nz`?n.x1-r:l===`px`?n.x1:n.x0,d=l===`pz`?n.z1:l===`nz`?n.z0:l===`px`?n.z1-r:n.z0+r,_=h.f.r[0]*u+h.f.r[1]*d;if(Te.some(e=>e.n[0]===g[0]&&e.n[1]===g[1]&&Math.abs(e.d-h.f.d)<2.5&&_>e.ta-1.2&&_<e.tb+1.2&&s>e.ya-1.5&&s<e.yb))continue;let v=Math.min(p-.08,.62+i()*.12),y=.38+i()*.08,b=.3+i()*.12,x=[13222838,11775910,10328464,14078664,9276036][Math.floor(i()*5)];R(h.f,_-v/2,_+v/2,s+.02,s+.02+y,-.22,b,`equipment`,x),R(h.f,_-v/2+.05,_+v/2-.05,s+.07,s+y-.04,b,b+.012,`equipment`,5592143),R(h.f,_-v/2+.04,_-v/2+.08,s-.22,s+.02,0,b-.04,`pole`,3815994),R(h.f,_+v/2-.08,_+v/2-.04,s-.22,s+.02,0,b-.04,`pole`,3815994),oe.quad(L(h.f,_-v/2-.1,s,.02),L(h.f,_+v/2+.1,s,.02),L(h.f,_+v/2+.1,s-1.2-i()*1.5,.02),L(h.f,_-v/2-.1,s-1.2-i()*1.5,.02),[g[0],0,g[1]],ue,[.45,.45,.45])}}}}if(n&&i()<.8){let{f:e,t0:a,t1:o}=Ve(t,u),s=u===`px`?t.x1-n.x1:n.x0-t.x0;if(s>3.4){let n=Math.min(o-a-6,12+i()*10),c=a+3+i()*(o-a-6-n),l=c+n,u=t.y1,d=2.2+i()*2.4,f=u+d,p=f+Math.min(10,n*(.38+i()*.2)),m=Math.min(s-1.6,1.9),h={...e,d:e.d+-1.15-.55};_.setColor(3422011);let g=Math.max(3,Math.round(n/3)+1);for(let t=0;t<g;t++){let r=c+.2+(n-.6)*t/(g-1);R(e,r,r+.2,u,f+.2,-1.9,-1.7,`pole`),R(e,r,r+.2,u,p-.6,-1.7-m,-1.5-m,`pole`),R(e,r+.04,r+.16,u+d*.5,u+d*.5+.14,-1.5-m,-1.9,`pole`),R(e,r+.04,r+.16,f+(p-f)*.5,f+(p-f)*.5+.14,-1.5-m,-1.7,`pole`)}for(let t of[u+.9,u+d-.3,f+(p-f)*.72])R(e,c,l,t,t+.16,-1.7-m,-1.54-m,`pole`);R(e,c,l,u+d*.5,u+d*.5+.14,-1.9,-1.7599999999999998,`pole`),_.setColor(2500651),R(e,c-.3,l+.3,f-.12,f-.04,-1.7,-.6499999999999999,`roof`),R(e,c-.3,l+.3,f+.9,f+.95,-.71,-.6499999999999999,`pole`);for(let t=c-.3;t<l+.3;t+=1.8)R(e,t,t+.05,f-.04,f+.9,-.71,-.6599999999999999,`pole`);V(h,c,l,f+.05,p,.55,{flush:!0,vinyl:i()<.5,noWalk:!0,noSpill:!0,noHalo:!0}),Te.push({n:e.n,d:e.d-s,ta:c-1,tb:l+1,ya:u,yb:p+1.5}),r=[c,l]}}{let n=i;i=a;let{f:o,t0:s,t1:c}=Ve(t,u);for(let n of[`nz`,`pz`]){if(e.lot.sides[n]!==`street`||a()<.3)continue;let i=qe(u,n),l=7+a()*8,d=.6+a()*3.2,f=Math.min(9,l*(.42+a()*.4)),p=i?c-l-.5-a()*2.5:s+.5+a()*2.5,m=p+l;if(r&&p<r[1]+1.5&&m>r[0]-1.5)continue;let h=(e,n,r,i)=>{let o=t.y1,s=o+1.1+d,c=s+f,l={...e,d:e.d-i-.55},u=1.4;_.setColor(3356218);let p=Math.max(2,Math.round((r-n)/3.2)+1);for(let t=0;t<p;t++){let a=n+.25+(r-n-.7)*t/(p-1);R(e,a,a+.2,o,c-.4,-i-.8,-i-.58,`pole`),R(e,a,a+.2,o,s+(c-s)*.6,-i-.6-u,-i-.4-u,`pole`),R(e,a+.04,a+.16,o+(s-o)*.5,o+(s-o)*.5+.14,-i-.45-u,-i-.75,`pole`),R(e,a+.04,a+.16,s+(c-s)*.55,s+(c-s)*.55+.14,-i-.45-u,-i-.75,`pole`)}for(let t of[s-.3,s+(c-s)*.55])R(e,n,r,t,t+.16,-i-.6-u,-i-.44-u,`pole`);R(e,n,r,s-.45,s-.3,-i-.8,-i-.6,`pole`);let m=L(e,(n+r)/2,0,0);V(l,n,r,s,c,.55,{flush:!0,noWalk:!0,noSpill:!0,noHalo:!0,vinyl:a()<.3,uv:mt(a,(r-n)/f,_e,m[0]+s*.15,m[2])})};if(h(o,p,m,.35),a()<.5){let e=Ve(t,n),r=qe(n,u),i=Math.min(e.t1-e.t0-4,5+a()*5),o=r?e.t1-i-3.2:e.t0+3.2;i>3&&h(e.f,o,o+i,.35)}}i=n}}{let e=q.oneTS,a=t.tile((e.x0+e.x1)/2,(e.z0+e.z1)/2),o={floorH:3.9,bayW:1.5,winW:.9,winH:.6,layer:j.METAL,base:j.GRANITE,seed:88,margin:0,depth:.05,tint:[.42,.44,.48]},s={style:M.CURTAIN,gH:6};for(let t of[a.fac,a.lod])t.box(e.x0,K,e.z0,e.x1,e.h,e.z1,{...o,topY:e.h,baseY:K},{px:s,nx:s,pz:s,nz:s},!0,!1);n.box(e.x0,K,e.z0,e.x1,e.h,e.z1,`wall`);for(let t of[`px`,`nx`,`pz`,`nz`]){let n=Ve(e,t);pe(L(n.f,n.t0,P,0),L(n.f,n.t1,P,0),[n.f.n[0],0,n.f.n[1]],1.4,.5)}t.footprints.push({x0:e.x0,z0:e.z0,x1:e.x1,z1:e.z1,h:e.h+18,kind:`tower`}),t.boxes.push({min:[e.x0,0,e.z0],max:[e.x1,e.h+18,e.z1]}),r.edge(e.x0+.12,e.z0,e.x0+.12,e.z1,e.h,-1,0),r.edge(e.x1-.12,e.z0,e.x1-.12,e.z1,e.h,1,0),r.edge(e.x0,e.z0+.12,e.x1,e.z0+.12,e.h,0,-1),r.edge(e.x0,e.z1-.12,e.x1,e.z1-.12,e.h,0,1);let c={n:[0,-1],r:[-1,0],d:-e.z0};{let t=0,n=-1;we.forEach((e,r)=>{let i=Math.max(...e),a=Math.min(...e),o=i>.08?(i-a)/i*Math.sqrt(i):0;o>n&&(n=o,t=r)});let r=mt(i,1.25,()=>t,0,e.z0),a=(e.x1-e.x0+1.2)/4;for(let t=0;t<3;t++)for(let n=0;n<4;n++){let i=-e.x1-.6+n*a,o=8.5+t*3;V(c,i+.12,i+a-.12,o,o+2.8,.7+t%2*.12,{uv:r,bezel:.12,noTrim:!0,noWalk:!0,gap:.3,bright:1.05,frame:1710877})}}V(c,-e.x1-2.6,-e.x0+1.4,17.6,26.4,1.6,{bright:1.08,noWalk:!0});{let t=(i()-.5)*3;V(c,-e.x1-.6,t-.3,27.2,38.6,.9,{bright:.95}),V(c,t+.3,-e.x0+.9,27.8,37.4,1.5,{bright:1.1})}V(c,-e.x1-.4,-e.x0+.4,39.6,44.4,1.1,{noTrim:!0});{let t=45.4,n=92.5,r=-e.x1-1,i=-e.x0+1;V(c,r,i,t,n,1.4,{bright:1.12,noTrim:!0,walk:!1,noWalk:!0});for(let e of[r-.75,i+.1]){R(c,e,e+.65,45,92.9,0,1.75,`wall`,1316119);let r=1.76,i=[c.n[0],0,c.n[1]];h.quad(L(c,e+.12,t,r),L(c,e+.53,t,r),L(c,e+.53,n,r),L(c,e+.12,n,r),i,[0,0,1,47.1/.9],[.35,1,.9])}}Be(c,-e.x1,-e.x0),Ue({n:[-1,0],r:[0,1],d:-e.x0},e.z0+.4-.4,e.z0+16,7.35,.95),Ue(c,-e.x1-.4,-e.x0+.4,7.35,.95),Ue({n:[1,0],r:[0,-1],d:e.x1},-(e.z0+16),-e.z0+.4,7.35,.95);for(let t of[`px`,`nx`]){let n=t===`px`?{n:[1,0],r:[0,-1],d:e.x1}:{n:[-1,0],r:[0,1],d:-e.x0},r=t===`px`?[-(e.z0+16),-e.z0-.3]:[e.z0+.3,e.z0+16];for(let[e,t]of[[8.5,20],[21,38],[39,62]])V(n,r[0],r[1],e,t,.6);let i=t===`px`?[-e.z1+1,-(e.z0+17)]:[e.z0+17,e.z1-1];Be(n,i[0],i[1])}Le({n:[0,1],r:[1,0],d:e.z1},e.x0+.5,e.x1-.5,8.6,40),_.setColor(3816512);let l=e.h,u=e.h+14,d=e.z0+4,f=e.z0+16;for(let[t,r]of[[e.x0+1,d],[e.x1-1.6,d],[e.x0+1,f-.6],[e.x1-1.6,f-.6]])_.box(t,l,r,t+.6,u,r+.6),n.box(t,l,r,t+.6,u,r+.6,`pole`);for(let t of[l+7,u-.6])_.box(e.x0+1,t,d,e.x1-1,t+.6,d+.6),_.box(e.x0+1,t,f-.6,e.x1-1,t+.6,f),n.box(e.x0+1,t,d,e.x1-1,t+.6,d+.6,`pole`),n.box(e.x0+1,t,f-.6,e.x1-1,t+.6,f,`pole`);_.cyl(0,u,(d+f)/2,.35,.2,18,8),n.cyl(0,(d+f)/2,u,u+18,.33,.19,`pole`),r.add(0,u+18,(d+f)/2,0,1,0,`antenna`),V(c,-e.x1+.5,-e.x0-.5,l+1.5,l+6.5,.7)}let Je=K+.006,Qe=(e,t,n,r)=>C.quad([e,Je,r],[n,Je,r],[n,Je,t],[e,Je,t],[0,1,0],[e/9.6,-r/9.6,n/9.6,-t/9.6]);for(let e of q.plazaRows){let{c0:t,c1:n}=st(e);Qe(-q.plazaX,t,-F.AV_HALF,n),Qe(F.AV_HALF,t,q.plazaX,n)}{let{c0:e,c1:t}=st(-80);Qe(-F.AV_HALF-F.AV_WALK,e,F.AV_HALF+F.AV_WALK,t)}let $e=Je+.003,ct=new St,lt=(e,t,n,r,i)=>ct.quad([e,$e,r],[n,$e,r],[n,$e,t],[e,$e,t],[0,1,0],[0,0,1,1],i),ut=[.3,.29,.28];for(let e of q.plazaRows){let{c0:t,c1:n}=st(e);for(let e of[-1,1]){let r=e*F.AV_HALF,a=e*q.plazaX,o=(e,t,n,r,a=1.2)=>{let o=r-t>n-e,s=Math.max(1,Math.round((o?r-t:n-e)/a));for(let a=0;a<s;a++){let c=.86+i()*.28,l=ut.map(e=>e*c);o?lt(e,t+(r-t)*a/s+.01,n,t+(r-t)*(a+1)/s-.01,l):lt(e+(n-e)*a/s+.01,t,e+(n-e)*(a+1)/s-.01,r,l)}};o(Math.min(r,r+e*.9),t,Math.max(r,r+e*.9),n);for(let e=t+19.2;e<n-2;e+=19.2)o(Math.min(r,a),e,Math.max(r,a),e+.45,.9);for(let r of[11.6,22.4]){let i=e*(F.AV_HALF+r);o(Math.min(i,i+e*.45),t,Math.max(i,i+e*.45),n,.9)}o(Math.min(a,a-e*1.2),t,Math.max(a,a-e*1.2),n,1.5)}}{let e=q.tkts,t=(e.zFront-e.zBack)/e.n,a=.42;for(let r=0;r<e.n;r++){let i=e.zFront-r*t,o=K+(r+1)*a;O.setColor(r%2?[.78,.74,.74]:[1,1,1]),O.box(e.x0,le?K+r*a:K,e.zBack,e.x1,o,i,55),n.box(e.x0,K,e.zBack,e.x1,o,i,`wall`)}let o=K+e.n*a;pe([e.x0,P,e.zBack],[e.x0,P,e.zFront],[-1,0,0],1.4,.55),pe([e.x1,P,e.zFront],[e.x1,P,e.zBack],[1,0,0],1.4,.55),pe([e.x1,P,e.zBack],[e.x0,P,e.zBack],[0,0,-1],1.4,.55);for(let r=0;r<e.n;r++){let o=e.zFront-r*t+.012,s=K+(r+1)*a;h.quad([e.x0,s-a+.02,o],[e.x1,s-a+.02,o],[e.x1,s-.06,o],[e.x0,s-.06,o],[0,0,1],[.5,.5,.5,.5],[.4,.05,.045]),h.quad([e.x0,s-.05,o],[e.x1,s-.05,o],[e.x1,s-.01,o],[e.x0,s-.01,o],[0,0,1],[.5,.5,.5,.5],[.5,.28,.25]),h.quad([e.x0,s+.004,o-.012],[e.x1,s+.004,o-.012],[e.x1,s+.004,o-.16],[e.x0,s+.004,o-.16],[0,1,0],[.5,.5,.5,.5],[.3,.16,.15]),_.setColor(3356219);for(let n of[e.x0-.04,e.x1+.005])_.box(n,K,o-t,n+.035,s-.08,o+.012);_.setColor(8159366);for(let n of[e.x0-.05,e.x1+.005])_.box(n,s-.08,o-t,n+.045,s+.012,o+.012);_.setColor(11054514);for(let n of[e.x0+.08,(e.x0+e.x1)/2-.03,e.x1-.14])I(n,s,o-.08,n+.06,s+1,o-.02,`pole`),I(n-.01,s+.94,o-t,n+.07,s+1,o,`pole`);for(let r of[e.x0+.03,e.x1-.03])ne.quad([r,s-.02,o],[r,s-.02,o-t],[r,s+1.08,o-t],[r,s+1.08,o],[r<(e.x0+e.x1)/2?-1:1,0,0],[0,0,1,1]),n.box(r-.02,s,o-t,r+.02,s+1.08,o,`glass`);if(r!==e.n-1)for(let n=e.x0+.6;n<e.x1-.5;n+=.62+i()*.5)if(i()<(r%3==1?.95:.74)){let i=Math.abs(Math.sin(n*12.9898+r*78.233)*43758.5453)%1;if(i<(r%3==1?.8:.55))continue;at.push({x:n+(i-.5)*.3,z:e.zFront-r*t-.12,y:s-.43,ry:(i*7.1%1-.5)*.6,mode:`sit`})}else at.push({x:n+(i()-.5)*.15,z:e.zFront-r*t-.12,y:s-.43,ry:(i()-.5)*.5,mode:`sit`})}V({n:[0,-1],r:[-1,0],d:-e.zBack},-e.x1+.15,-e.x0-.15,K+.35,o-.1,.12,{noTrim:!0,bezel:.12,flush:!0,noSpill:!0}),_.setColor(10134440);for(let t of[e.x0+.05,e.x1-.1])_.box(t,o,e.zBack,t+.05,o+1.05,e.zBack+1.4);_.box(e.x0,o,e.zBack,e.x1,o+1.05,e.zBack+.06),n.box(e.x0,o,e.zBack,e.x1,o+1.05,e.zBack+.06,`glass`),e.zFront,r.edge(e.x0,e.zBack+.2,e.x1,e.zBack+.2,o,0,-1)}let dt=[],ft=(e,t,r,i,a)=>{dt.push([e-2,t-2,r+2,i+2]),_.setColor(2105636).box(e,K,t,r,K+a,i),n.box(e,K,t,r,K+a,i,`wall`),he(e-1,t-1,r+1,i+1,.7),_.setColor(5921888).box(e-.4,K+a,t-.4,r+.4,K+a+.5,i+.4),n.box(e-.4,K+a,t-.4,r+.4,K+a+.5,i+.4,`roof`);let o={x0:e,x1:r,z0:t,z1:i};for(let e of[`px`,`nx`,`pz`,`nz`]){let t=Ve(o,e);V(t.f,t.t0+.3,t.t1-.3,K+1.2,K+a-.3,.12,{bezel:.12,bright:1.1,flush:!0})}};for(let e of q.plazaRows){let{z0:t,z1:n}=st(e);e===-160?(ft(-34,t+8,-26,t+13,4.6),ft(24,n-16,31,n-10,4.2)):ft(26,t+10,33,t+15,4.4)}let _t=[],Dt=[];for(let e of q.plazaRows){let{z0:t,z1:n}=st(e);for(let e of[-1,1]){let r=q.tkts,a=(e,t,n,i,a,o=2.2)=>{let s=n/2,c=i/2;return e+s>r.x0-3&&e-s<r.x1+3&&t+c>r.zBack-3&&t-c<r.zFront+4||dt.some(([n,r,i,a])=>e+s>n-1&&e-s<i+1&&t+c>r-1&&t-c<a+1)||_t.some(([r,a,s,c])=>Math.abs(r-e)<(s+n)/2+o&&Math.abs(a-t)<(c+i)/2+o)?!1:(_t.push([e,t,n,i,a]),!0)};for(let r=t+3+i()*3;r<n-2.5;r+=8+i()*5){if(i()<.15)continue;let t=1.7+i()*.5;a(e*(F.AV_HALF+4.3+i()*.4),r,t,t,i()<.8?0:2)}for(let[r,o]of[[t+2.4,1],[n-2.4,-1]])for(let t=F.AV_HALF+10+i()*3;t<q.plazaX-4;t+=6.5+i()*4){if(i()<.3)continue;let n=1.6+i()*.6,s=i()<.25;a(e*t,r+o*(s?.4:0),s?n*2.4:n,n,s?3:i()<.85?0:2)}for(let r=0,o=0;r<4&&o<80;o++){let o=r<2,s=o?2.6+i()*.4:1.8+i()*.4;a(e*(F.AV_HALF+9+i()*(q.plazaX-F.AV_HALF-14)),t+10+i()*(n-t-20),s,s,o?4:1,5)&&r++}for(let r=t+1.5;r<n-1;r+=2.6)Dt.push([e*(F.AV_HALF+1.05),r])}}for(let e of q.endRows){let{z0:t,z1:n}=st(e);if(e===-80)for(let e of[-1,1])for(let r=t+1.5;r<n-1;r+=2.6)Dt.push([e*(F.AV_HALF-.6),r])}for(let e of q.plazaRows){let{c0:t,c1:n}=st(e),r=q.tkts;for(let e of[-1,1])for(let i=F.AV_HALF+2.4;i<q.plazaX-1;i+=2.2)for(let a of[t+.7,n-.7]){let t=e*i;t>r.x0-1&&t<r.x1+1&&a>r.zBack-1&&a<r.zFront+1||Dt.push([t,a])}}let Ot=[];for(let e of q.plazaRows){let{z0:t,z1:n}=st(e);for(let e of[-1,1])for(let r=0;r<14;r++){let r=e*(17+i()*24),a=t+3+i()*(n-t-6),o=q.tkts;r>o.x0-2&&r<o.x1+2&&a>o.zBack-2&&a<o.zFront+2||_t.some(([e,t,n,i])=>Math.abs(e-r)<n/2+2&&Math.abs(t-a)<i/2+2)||dt.some(([e,t,n,i])=>r>e&&r<n&&a>t&&a<i)||Ot.some(([e,t])=>Math.abs(e-r)<3&&Math.abs(t-a)<3)||Ot.push([r,a])}}let kt=e=>{let t=e===`ball`;t&&(e=!1);let n=de(t?29:e?19:9),r=t?new D(.47,16,12):e?new v(.5,1,14,6):new d(1,1,1,6,5,6);r.translate(0,.5,0);let i=r.attributes.position;for(let r=0;r<i.count;r++){let a=i.getX(r),o=i.getY(r),s=i.getZ(r);if(t){let e=1+.06*Math.sin(a*13+s*7)*Math.cos(o*11);i.setXYZ(r,a*e,.5+(o-.5)*e*.92,s*e);continue}if(!e){let e=1-.18*Math.max(0,Math.abs(a)+Math.abs(s)-.7)-.1*Math.max(0,o-.8)*(Math.abs(a)+Math.abs(s));a*=e,s*=e}let c=1+(n()-.5)*.1;i.setXYZ(r,a*c,o*(o>.02?1+(n()-.5)*.06:1),s*c)}r.computeVertexNormals();let a=new fe,o=e?300:t?420:560;for(let r=0;r<o;r++){let r,i,o,s,c,l;if(t){let e=n()*2-1,t=n()*Math.PI*2,a=Math.sqrt(1-e*e);s=a*Math.cos(t),c=e,l=a*Math.sin(t),r=s*.47,i=.5+c*.47,o=l*.47}else if(e){i=n()*.95;let e=.5*(1-i)+.02,t=n()*Math.PI*2;r=Math.cos(t)*e,o=Math.sin(t)*e,s=Math.cos(t),c=.45,l=Math.sin(t)}else{let e=Math.floor(n()*5),t=n()-.5,a=n();if(e===4)r=t*.9,o=(n()-.5)*.9,i=1,s=0,c=1,l=0;else{let n=[1,-1,0,0][e],u=[0,0,1,-1][e];r=n*.5+(n?0:t),o=u*.5+(u?0:t),i=.05+a*.95,s=n,c=.15,l=u}}let u=.1+n()*.09,d=n()*Math.PI,f=new S().lookAt(new k(0,0,0),new k(s+(n()-.5)*.8,c+(n()-.5)*.8,l+(n()-.5)*.8),new k(0,1,0));f.multiply(new S().makeRotationZ(d)).setPosition(r+s*.03,i,o+l*.03);let p=.8+n()*.4;a.setColor([p,p,p]).setXf(f);let m=[a.vert(-u/2,-u/2,0,0,0,1,0,0),a.vert(u/2,-u/2,0,0,0,1,1,0),a.vert(u/2,u/2,0,0,0,1,1,1),a.vert(-u/2,u/2,0,0,0,1,0,1)];a.quad(m[0],m[1],m[2],m[3])}return a.setXf(null),{core:r,cards:a.build()}},At=kt(!1),jt=kt(!0),Mt=kt(`ball`),Nt=new fe;Nt.setColor(9078400).box(-.5,.06,-.5,.5,.86,.5).setColor(10131087).box(-.54,.86,-.54,.54,1,.54).setColor(5591630).box(-.47,0,-.47,.47,.06,.47).setColor(4867908).box(-.506,.45,-.506,.506,.475,.506).box(-.506,.2,-.506,.506,.215,.506).setColor(3095333).box(-.46,.96,-.46,.46,1.005,.46);let Pt=Nt.build(),Ft=new w({vertexColors:!0,roughness:.6,metalness:.35}),It=Ct(it+`ts_foliage.webp`,{aniso:4}),Lt=new w({color:3096870,roughness:.95}),Rt=new w({map:It,color:12897464,alphaTest:.45,side:2,vertexColors:!0,roughness:.78}),zt=new ee(Pt,Ft,Math.max(1,_t.length)),Bt=[0,0,0];_t.forEach(([,,,,e])=>{Bt[e===3?0:e]++});let Vt=e=>[new ee(e.core,Lt,Math.max(1,_t.length*4)),new ee(e.cards,Rt,Math.max(1,_t.length*4))],J=[Vt(At),Vt(jt),Vt(Mt)],Ht=[0,0,0],Ut=[[.78,.8,.84],[.82,.76,.7],[.42,.42,.44],[.62,.58,.55]],Wt=new S,Gt=new m;_t.forEach(([e,t,r,a,o],s)=>{let c=o===4?.55+i()*.1:o===3?1:1.08+i()*.14;Wt.makeScale(r,c,a).setPosition(e,K,t),zt.setMatrixAt(s,Wt);let l=Ut[Math.floor(i()*Ut.length)];zt.setColorAt(s,Gt.setRGB(l[0],l[1],l[2])),he(e-r*.5-.55,t-a*.5-.55,e+r*.5+.55,t+a*.5+.55,.6),n.box(e-r*.5,K,t-a*.5,e+r*.5,K+.86*c,t+a*.5,`equipment`),n.box(e-r*.54,K+.86*c,t-a*.54,e+r*.54,K+c,t+a*.54,`equipment`);let u=(e,t,n,r,i)=>{for(let i of[-.3,.3]){let a=i*r*2,o=Math.min(.13,r*.12),s=(r,i)=>e[0]?[t[0]+e[0]*(n+.006),i,t[1]+(a+r)*e[0]]:[t[0]-(a+r)*e[1],i,t[1]+e[1]*(n+.006)];h.quad(s(-o,K+.12),s(o,K+.12),s(o,K+.26),s(-o,K+.26),[e[0],0,e[1]],[.5,.5,.5,.5],[1,.93,.8])}};if(o!==4&&(u([0,1],[e,t],a/2,r/2),u([0,-1],[e,t],a/2,r/2),u([1,0],[e,t],r/2,a/2),u([-1,0],[e,t],r/2,a/2)),o===4){ot.push({x:e,z:t,y:K+c*.96,kind:`street`,sc:.7+i()*.25,clear:99}),n.cyl(e,t,K+c,K+c+3.2,.24,.2,`pole`);return}let d=o===3?0:o,[f,p]=J[d],m=Ht[d]++,g=.8+i()*.4;if(o===1){let a=r*(.72+i()*.15),o=1.9+i()*1.3;Wt.makeScale(a,o,a).setPosition(e,K+c,t),n.cyl(e,t,K+c,K+c+o,a*.5,.02,`equipment`)}else if(o===2){let a=r*(.8+i()*.18);Wt.makeScale(a,a,a).setPosition(e,K+c-.05,t),n.cyl(e,t,K+c,K+c+a*.95,a*.45,a*.3,`equipment`)}else{let s=r>a,l=(s?r:a)*.97,u=(s?a:r)*.96,m=o===3?.8+i()*.45:1+i()*.55,h=Math.max(1,Math.min(4,Math.round(l/u))),_=l/h,v=(r,i,a)=>{let o=-l/2+_*(r+.5),d=s?e+o:e,f=s?t:t+o;Wt.makeScale(s?_*1.04:u*a,i,s?u*a:_*1.04).setPosition(d,K+c,f);let p=(s?_*1.04:u)/2,m=(s?u:_*1.04)/2;n.box(d-p,K+c,f-m,d+p,K+c+i,f+m,`equipment`)};for(let e=1;e<h;e++){let t=Ht[d]++;v(e,m*(.9+i()*.2),.95+i()*.08),f.setMatrixAt(t,Wt),p.setMatrixAt(t,Wt),p.setColorAt(t,Gt.setRGB(g*(.9+i()*.2),g,g*(.85+i()*.2)))}v(0,m,1)}f.setMatrixAt(m,Wt),p.setMatrixAt(m,Wt),p.setColorAt(m,Gt.setRGB(g*(.9+i()*.2),g,g*(.85+i()*.2)))}),zt.count=_t.length,J.forEach(([e,t],n)=>{e.count=t.count=Ht[n]});let[[Kt,qt],[Jt,Yt],[Xt,Zt]]=J,Qt=new fe;Qt.setColor(3816511).cyl(0,0,0,.16,.16,.08,14,!1).setColor(10133154).cyl(0,.08,0,.15,.15,.8,14,!1).setColor(2763822).cyl(0,.72,0,.152,.152,.05,14,!1).setColor(10791084).cyl(0,.88,0,.15,.1,.07,14,!1).cyl(0,.95,0,.1,.02,.05,14,!0);let $t=Qt.build();for(let e=Dt.length-1;e>=0;e--)i()<.12&&Dt.splice(e,1);let en=new ee($t,new w({vertexColors:!0,roughness:.38,metalness:.75}),Math.max(1,Dt.length)),tn=[[1,1,1],[.85,.84,.8],[.28,.28,.3],[.62,.63,.64],[.95,.93,.88]];Dt.forEach(([e,t],r)=>{let a=.84+i()*.1,o=.82;Wt.makeScale(o,a,o).setPosition(e,K,t),en.setMatrixAt(r,Wt),me(e,t,.34,.34,.55);let s=tn[Math.floor(i()*tn.length)];en.setColorAt(r,Gt.setRGB(s[0],s[1],s[2])),n.cyl(e,t,K,K+.88*a,.155*o,.155*o,`pole`),n.cyl(e,t,K+.88*a,K+a,.15*o,.02*o,`pole`)}),en.count=Dt.length;let nn=[{ch:[[.75,0],[-.75,0],[0,.75],[0,-.75]],col:10692138},{ch:[[.75,0],[-.75,0]],col:3825482},{ch:[[.75,0],[0,.75],[0,-.75]],col:9212052}],rn=e=>{let t=new fe;t.setColor(2895408).cyl(0,0,0,.05,.05,.72,6,!1).cyl(0,.72,0,.4,.4,.04,12,!0);for(let[n,r]of e.ch){t.setColor(e.col).box(n-.22,.44,r-.22,n+.22,.48,r+.22);let i=Math.sign(n)*.2,a=Math.sign(r)*.2;t.box(n+i-(i?.02:.22),.48,r+a-(a?.02:.22),n+i+(i?.02:.22),.9,r+a+(a?.02:.22));for(let[e,i]of[[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]])t.setColor(2895408).box(n+e-.015,0,r+i-.015,n+e+.015,.44,r+i+.015)}return t.build()},an=[12071980,2775690,14196778,3107386,15262422,2042426,13157040],on=new w({vertexColors:!0,roughness:.5,metalness:.6}),sn=nn.map(e=>new ee(rn(e),on,Math.max(1,Ot.length))),cn=[0,0,0];Ot.forEach(([e,t],r)=>{let a=Math.floor(i()*3),o=nn[a];if(Wt.makeTranslation(e,K,t),sn[a].setMatrixAt(cn[a]++,Wt),me(e,t,1.15,1.15,.4),n.box(e-.4,K,t-.4,e+.4,K+.76,t+.4,`equipment`),i()<.45){let r=an[Math.floor(i()*an.length)],a=1.2+i()*.3;_.setColor(9080208).cyl(e,K+.76,t,.025,.025,1.7,6,!1),n.cyl(e,t,K+.76,K+2.4,.03,.03,`pole`),_.setColor(r).cyl(e,K+2.2,t,a,.03,.42,10,!0),n.cyl(e,t,K+2.2,K+2.62,a,.03,`awning`),_.setColor(r).cyl(e,K+2.08,t,a,a,.12,10,!1),me(e,t,a+.5,a+.5,.3)}for(let[r,i]of o.ch)n.box(e+r-.22,K,t+i-.22,e+r+.22,K+.48,t+i+.22,`equipment`);for(let[n,r]of o.ch)i()<.55&&at.push({x:e+n*.81,z:t+r*.81,y:K,ry:Math.atan2(-n,-r),mode:`sit`})}),sn.forEach((e,t)=>{e.count=cn[t]});let ln=sn[0];ln.name=`tsCafe`;let Y=[..._t.map(([e,t,n,r])=>[e,t,Math.max(n,r)*.6+.8]),...Ot.map(([e,t])=>[e,t,1.8]),...dt.map(([e,t,n,r])=>[(e+n)/2,(t+r)/2,Math.max(n-e,r-t)/2])],un=(e,t,n)=>{let r=q.tkts;return e>r.x0-n-1&&e<r.x1+n+1&&t>r.zBack-n-1&&t<r.zFront+n+1?!1:!Y.some(([r,i,a])=>Math.hypot(r-e,i-t)<a+n)},dn=(e,t,r)=>{let a=1.9,o=.95,s=r===`x`?a/2:o/2,c=r===`x`?o/2:a/2;I(e-s,K+.25,t-c,e+s,K+1.15,t+c,`equipment`,11120048),he(e-s-.5,t-c-.5,e+s+.5,t+c+.5,.6),me(e,t,1.3,1.3,.25),I(e-s-.04,K+1.15,t-c-.04,e+s+.04,K+1.22,t+c+.04,`equipment`,6974832),_.setColor(1710618);for(let[n,r]of[[-1,-1],[1,-1],[-1,1],[1,1]])_.cyl(e+n*(s-.2),K,t+r*(c-.12),.2,.2,.25,8,!0);n.box(e-s,K,t-c,e+s,K+.25,t+c,`equipment`),_.setColor(9080208).cyl(e,K+1.22,t,.03,.03,1.2,6,!1),n.cyl(e,t,K+1.22,K+2.42,.03,.03,`pole`),_.setColor(an[Math.floor(i()*an.length)]).cyl(e,K+2.2,t,1.25,.02,.45,12,!0),n.cyl(e,t,K+2.2,K+2.65,1.25,.02,`awning`);let l=r===`x`?{n:[0,-1],r:[-1,0],d:-(t-c)}:{n:[-1,0],r:[0,1],d:-(e-s)},u=r===`x`?-(e+s)+.15:t-c+.15;V(l,u,u+a-.3,K+.55,K+1,.02,{sign:!0,bezel:.03,frame:2763306,bright:1})},fn=(e,t,n)=>{let r=3.2,i=1.8,a=2.7;I(e-r/2,K,t-i/2,e+r/2,K+a,t+i/2,`wall`,2379834),he(e-r/2-.8,t-i/2-.8,e+r/2+.8,t+i/2+.8,.65),I(e-r/2-.25,K+a,t-i/2-.25,e+r/2+.25,K+a+.18,t+i/2+.25,`roof`,1784362),_.setColor(13616814).box(e-r/2-.015,K+a-.28,t-i/2-.015,e+r/2+.015,K+a-.02,t+i/2+.015),_.setColor(1711131).box(e-r/2-.015,K,t-i/2-.015,e+r/2+.015,K+.22,t+i/2+.015);for(let[n,o]of[[-1,-1],[1,-1],[-1,1],[1,1]])I(e+n*r/2-.09,K+.22,t+o*i/2-.09,e+n*r/2+.09,K+a-.28,t+o*i/2+.09,`wall`,3104325);h.quad([e-r/2-.1,K+a-.005,t-i/2-.2],[e+r/2+.1,K+a-.005,t-i/2-.2],[e+r/2+.1,K+a-.005,t-i/2-.05],[e-r/2-.1,K+a-.005,t-i/2-.05],[0,-1,0],[0,0,3.4000000000000004/.25,1],[1,.85,.6]);let o=Ve({x0:e-r/2,x1:e+r/2,z0:t-i/2,z1:t+i/2},n);V(o.f,o.t0+.2,o.t1-.2,K+a-.55,K+a-.1,.03,{sign:!0,bezel:.03,frame:1454116,bright:1});for(let e=0;e<3;e++)V(o.f,o.t0+.25+e*.95,o.t0+1.1+e*.95,K+.9,K+1.9,.12,{bezel:.04,frame:3158064,noTrim:!0,bright:.8,flush:!0,noSpill:!0})},pn=(e,t)=>{I(e-1.2,K,t-1.2,e+1.2,K+2.8,t+1.2,`wall`,15001320),he(e-2,t-2,e+2,t+2,.6),I(e-1.22,K+2.2,t-1.22,e+1.22,K+2.55,t+1.22,`wall`,2047882),I(e-1.35,K+2.8,t-1.35,e+1.35,K+2.95,t+1.35,`roof`,2763824),I(e-.5,K+2.95,t-.15,e+.5,K+3.15,t+.15,`equipment`,3158584),h.quad([e-.48,K+2.97,t-.155],[e,K+2.97,t-.155],[e,K+3.13,t-.155],[e-.48,K+3.13,t-.155],[0,0,-1],[.5,.5,.5,.5],[1,.2,.2]),h.quad([e,K+2.97,t-.155],[e+.48,K+2.97,t-.155],[e+.48,K+3.13,t-.155],[e,K+3.13,t-.155],[0,0,-1],[.5,.5,.5,.5],[.3,.45,1]);for(let n of[`px`,`nx`,`pz`,`nz`]){let r=Ve({x0:e-1.2,x1:e+1.2,z0:t-1.2,z1:t+1.2},n);R(r.f,r.t0+.3,r.t1-.3,K+1.1,K+2.05,0,.015,`wall`,1713456)}},mn=(e,t)=>{I(e-.16,K,t-.45,e+.16,K+2.9,t+.45,`equipment`,2763823),I(e-.21,K,t-.5,e+.21,K+.12,t+.5,`equipment`,4606027),I(e-.17,K+2.9,t-.46,e+.17,K+2.98,t+.46,`equipment`,9080208);for(let n of[`px`,`nx`]){let r=Ve({x0:e-.16,x1:e+.16,z0:t-.45,z1:t+.45},n);V(r.f,r.t0+.07,r.t1-.07,K+.95,K+2.75,.015,{bezel:.04,frame:1710620,noTrim:!0,flush:!0,noSpill:!0,bright:.85})}me(e,t,.75,1,.5)},hn=(e,t,n,r)=>{let i=1.9,a=.5,o=(r,i,a,o,s,c,l)=>n?I(e+a,i,t+r,e+c,s,t+o,`equipment`,l):I(e+r,i,t+a,e+o,s,t+c,`equipment`,l);for(let e of[-.85,i/2-.18])o(e,K,-.5/2,e+.08,K+.42,a/2,2829615),o(e,K+.42,r>0?a/2-.08:-.5/2,e+.08,K+.86,r>0?a/2:-.5/2+.08,2829615);for(let e=0;e<4;e++){let t=-.5/2+a/4*e+.01;o(-1.9/2,K+.42,t,i/2,K+.46,t+a/4-.02,7035464)}for(let e of[.56,.7]){let t=r>0?a/2-.1:-.19;o(-1.9/2,K+e,t,i/2,K+e+.1,t+.04,7035464)}n?he(e-.6,t-1.3,e+.6,t+1.3,.45):he(e-1.3,t-.6,e+1.3,t+.6,.45)};for(let e of q.plazaRows){let{z0:t,z1:n}=st(e);for(let e of[-1,1]){for(let r=t+9+i()*6;r<n-6;r+=20+i()*8){let t=e*(F.AV_HALF+3.1);un(t,r,.9)&&(mn(t,r),Y.push([t,r,1]))}for(let r=0,a=0;r<5&&a<40;a++){let a=i()<.6,o=e*(F.AV_HALF+5+i()*(q.plazaX-F.AV_HALF-10)),s=t+5+i()*(n-t-10);if(!un(o,s,1.4))continue;let c=i()<.5?1:-1;hn(o,s,a,c),Y.push([o,s,1.4]),r++,i()<.6&&at.push({x:o+(a?-c*.05:(i()-.5)*1),z:s+(a?(i()-.5)*1:-c*.05),y:K,ry:a?Math.atan2(-c,0):Math.atan2(0,-c),mode:`sit`})}}}let gn=[];for(let e of q.plazaRows){let{z0:t,z1:n}=st(e);for(let e of[-1,1]){for(let r=0,a=0;r<3&&a<30;a++){let a=e*(F.AV_HALF+3.6+i()*6),o=t+4+i()*(n-t-8);un(a,o,1.6)&&(dn(a,o,`z`),Y.push([a,o,1.8]),r++)}for(let r=t+6;r<n-4;r+=9+i()*5){let t=e*(F.AV_HALF+2.1);un(t,r,.5)&&(gn.push([t,r]),Y.push([t,r,.5]))}for(let r=0;r<20;r++){let r=e*(q.plazaX-3.5),a=t+6+i()*(n-t-12);if(un(r,a,2.2)){fn(r,a,e<0?`px`:`nx`),Y.push([r,a,2.4]);break}}}if(e===-160)for(let e=0;e<30;e++){let e=22+i()*14,r=t+10+i()*(n-t-20);if(un(e,r,2)){pn(e,r),Y.push([e,r,2.2]);break}}}{let e=[11022378,2772874,13214252,3107386,13618372,1842206,3832480,8006482],t=(t,n,r,a,o)=>{let s=(e,i)=>t===`x`?[e,n+r*i]:[n+r*i,e],c=(e,t,n,r,i,a,o,c)=>{let l=s(e,n),u=s(t,r);I(Math.min(l[0],u[0]),i,Math.min(l[1],u[1]),Math.max(l[0],u[0]),a,Math.max(l[1],u[1]),o,c)},l=(t,n)=>{let r=e[Math.floor(i()*e.length)];c(t-.05,t+.05,n+.18,n+.28,K,K+.42,`pole`,2763565),c(t-.2,t+.2,n+.1,n+.36,K,K+.03,`equipment`,2763565),c(t-.24,t+.24,n,n+.46,K+.42,K+1.02,`equipment`,r),c(t-.26,t+.26,n-.02,n+.48,K+1.02,K+1.07,`equipment`,2829358),c(t-.19,t+.19,n+.46,n+.47,K+.6,K+.94,`equipment`,1844524),c(t-.2,t+.2,n+.46,n+.475,K+.5,K+.56,`equipment`,10132638),c(t+.06,t+.18,n+.3,n+.42,K+1.07,K+1.2,`equipment`,9079951),me(...s(t,n+.23),.45,.45,.45)},u=(e,t)=>{for(let[n,r]of[[-.2,.05],[.16,.05],[-.2,.47],[.16,.47]])c(e+n,e+n+.04,t+r,t+r+.04,K,K+.14,`pole`,1780821);c(e-.26,e+.26,t,t+.56,K+.14,K+1.02,`equipment`,2046586),c(e-.24,e+.24,t+.03,t+.53,K+1.02,K+1.16,`equipment`,2046586),c(e-.2,e+.2,t+.08,t+.48,K+1.16,K+1.22,`equipment`,2046586),c(e-.16,e+.16,t+.56,t+.575,K+.86,K+.95,`equipment`,12172478),me(...s(e,t+.28),.5,.5,.5)},d=a+1+i()*4;for(;d<o-2;){let e=i(),t=.5+i()*.2;if(e<.5){let e=2+Math.floor(i()*4),n=e*.56;if(d+n>o-1)break;let r=s(d+n/2,t+.25);if(!un(r[0],r[1],n/2+.3)){d+=3;continue}for(let n=0;n<e;n++)l(d+.28+n*.56,t);if(Y.push([r[0],r[1],n/2+.3]),i()<.6){let e=s(d+n+.55,t+.3);un(e[0],e[1],.5)&&(gn.push(e),Y.push([e[0],e[1],.5]))}d+=n+6+i()*9}else if(e<.72){let e=s(d,t+.28);if(un(e[0],e[1],.6)&&(u(d,t),Y.push([e[0],e[1],.6])),i()<.7){let e=s(d+.9,t+.3);un(e[0],e[1],.5)&&(gn.push(e),Y.push([e[0],e[1],.5]))}d+=7+i()*9}else{let e=s(d,t+.3);un(e[0],e[1],.5)&&(gn.push(e),Y.push([e[0],e[1],.5])),d+=5+i()*8}}};for(let e of[...q.plazaRows,...q.endRows]){let{c0:n,c1:r}=st(e),i=q.plazaRows.includes(e),a=i?q.plazaX+1:F.AV_HALF+F.AV_WALK+2,o=i?q.towerX-3:q.endX-3;for(let e of[-1,1]){for(let[i,s]of[[n,1],[r,-1]])e>0?t(`x`,i,s,a,o):t(`x`,i,s,-o,-a);if(i){let i=e*(F.AV_HALF+1.5),a=e;t(`z`,i,a,n+2,n+16),t(`z`,i,a,r-16,r-2)}}if(e===-320)for(let e of[-1,1])t(`z`,e*F.AV_HALF,e,n+3,r-3)}}let _n=new fe;_n.setColor(2968116).cyl(0,0,0,.3,.33,.9,12,!1).setColor(2374186).cyl(0,.9,0,.35,.3,.12,12,!0);let vn=new ee(_n.build(),new w({vertexColors:!0,roughness:.6,metalness:.5}),Math.max(1,gn.length));vn.count=gn.length,vn.name=`tsTrash`,gn.forEach(([e,t],r)=>{Wt.makeTranslation(e,K,t),vn.setMatrixAt(r,Wt),me(e,t,.6,.6,.55),n.cyl(e,t,K,K+.9,.3,.33,`equipment`),n.cyl(e,t,K+.9,K+1.02,.35,.3,`equipment`)}),vn.castShadow=vn.receiveShadow=!0,vn.computeBoundingSphere(),e.add(vn);for(let t of[zt,Kt,qt,Jt,Yt,Xt,Zt,en,...sn])t.castShadow=!0,t.receiveShadow=!0,t.computeBoundingSphere(),e.add(t);zt.name=`tsPlanters`,Kt.name=`tsHedges`,en.name=`tsBollards`;{let e=q.tkts,t=(e,t,n,r)=>un(e,t,.35)?(at.push({x:e,z:t,ry:n,mode:`stand`,clip:r}),Y.push([e,t,.35]),!0):!1,n=[];for(let e of q.plazaRows){let{z0:t,z1:r}=st(e);for(let e of[-1,1])n.push([e,t+1.5,r-1.5,F.AV_HALF+1.6,q.plazaX-1.2])}{let{z0:e,z1:t}=st(-80);for(let r of[-1,1])n.push([r,e+1.5,t-1.5,q.oneTS.x1+.9,F.AV_HALF+F.AV_WALK-.8])}for(let[e,r,a,o,s]of n){let n=(a-r)*(s-o),c=Math.round(n/36),l=Math.round(n/19);for(let n=0;n<c;n++){let c=e*(o+i()*(s-o)),l=r+i()*(a-r),u=2+Math.floor(i()*i()*5),d=.45+u*.08,f=i()*6.28,p=i()<.35;for(let r=0;r<u;r++){let a=f+r/u*6.28+(i()-.5)*.5,o=c+Math.cos(a)*d,s=l+Math.sin(a)*d*.85;t(o,s,p?Math.atan2(n%2?e:-e,0)+(i()-.5)*1.2:Math.atan2(c-o,l-s),p?i()<.45?`lookUp`:i()<.5?`photo`:`phone`:i()<.7?`talk`:`idle`)}}for(let n=0;n<l;n++)t(e*(o+i()**1.05*(s-o)),i()<.3?i()<.5?r+i()**2*16:a-i()**2*16:r+i()*(a-r),i()*6.28,i()<.55?`phone`:`idle`)}for(let n=0;n<26;n++)t(e.x0-1+i()*(e.x1-e.x0+2),e.zFront+.8+i()*5,Math.PI+(i()-.5)*2,i()<.5?`phone`:`talk`);for(let e of[...q.plazaRows,...q.endRows]){let{c0:n,c1:r}=st(e),a=q.plazaRows.includes(e),o=a?q.plazaX+.8:F.AV_HALF+F.AV_WALK+.8,s=a?q.towerX-1:q.endX-1;for(let e of[-1,1])for(let[a,c]of[[n,1],[r,-1]]){let n=Math.round((s-o)/2.6);for(let r=0;r<n;r++){let n=e*(o+i()**1.5*(s-o)),r=i();if(r<.35)t(n,a+c*(F.ST_WALK-.7-i()*.4),Math.atan2(0,c),i()<.5?`idle`:`phone`);else if(r<.55)t(n,a+c*(.8+i()*.4),Math.atan2(0,-c)+(i()-.5)*.8,i()<.5?`idle`:`phone`);else if(r<.8){let e=a+c*(1.4+i()*1.4),r=i()*6.28;t(n,e,r,`talk`)&&t(n+Math.sin(r)*.75,e+Math.cos(r)*.75,r+Math.PI,`talk`)}else t(n,a+c*(1.2+i()*2),i()*6.28,i()<.4?`lookUp`:`phone`)}}if(e===-320)for(let e of[-1,1])for(let a=0;a<26;a++){let a=n+2+i()*(r-n-4);i()<.4?t(e*(F.AV_HALF+F.AV_WALK-.8),a,Math.atan2(e,0),`idle`):t(e*(F.AV_HALF+.9+i()*3),a,i()*6.28,i()<.5?`phone`:`talk`)}}for(let e of at)e.mode===`stand`&&me(e.x,e.z,.42,.42,.5)}let yn=new St,bn=(e,t)=>{let n=(t%F.ST_SP+F.ST_SP)%F.ST_SP;if(n<F.ST_HALF||n>F.ST_SP-F.ST_HALF)return 0;if(Math.abs(e)<F.AV_HALF){let{c0:e,c1:n}=st(-80);return t>e&&t<n?K:0}return K};for(let e of be){let{f:t,ta:n,tb:r,ya:i,yb:a,avg:o}=e;if(!o)continue;let s=r-n,c=a-i,l=(i+a)/2,u=Math.max(o[0],o[1],o[2],.02),d=rt*Math.min(.7,s*c/(l*l*.6+30));if(d<.012)continue;let f=o.map(e=>e/u*(.35+Math.sqrt(u))*d),p=Math.min(30,6+l*1),m=n-s*.25,h=r+s*.25,g=Math.ceil(p/1.5);for(let e=0;e<g;e++){let i=e/g*p,a=(e+1)/g*p,o=L(t,(n+r)/2,0,(i+a)/2),s=bn(o[0],o[2])+.03;yn.quad(L(t,m,s,i),L(t,h,s,i),L(t,h,s,a),L(t,m,s,a),[0,1,0],[0,1-i/p,1,1-a/p],f)}if(i<16){let e=.47,a=f.map(e=>e*.45);yn.quad(L(t,n-.5,K,e),L(t,r+.5,K,e),L(t,r+.5,i,e),L(t,n-.5,i,e),[t.n[0],0,t.n[1]],[0,.35,1,1],a)}}let xn=new St;for(let e of z){let{f:t,ta:n,tb:r,ya:i,yb:a,avg:o}=e,s=r-n,c=a-i,l=Math.max(o[0],o[1],o[2],.02),u=Math.min(3.2,.9+.12*Math.min(s,c)),d=.035,f=[t.n[0],0,t.n[1]],p=.3*Math.min(1,Math.sqrt(s*c)/8),m=o.map(e=>e/l*(.3+Math.sqrt(l))*p),h=[n-u,n,r,r+u],g=[Math.max(K+.05,i-u),i,a,a+u];for(let e=0;e<3;e++)for(let n=0;n<3;n++){if(e===1&&n===1)continue;let r=+(e===0),i=+(e===2),a=+(n===0),o=+(n===2);xn.quad(L(t,h[e],g[n],d),L(t,h[e+1],g[n],d),L(t,h[e+1],g[n+1],d),L(t,h[e],g[n+1],d),f,[r,a,i,o],m)}}let Sn=new St,Cn=new St,wn=new St,Tn=new St,X=(e,t,n,r,i,a,o=0,s=[1,1,1])=>{let c=i%4/4,l=1-Math.floor(i/4)/4,u=Math.cos(o),d=Math.sin(o),f=(n,r)=>[e+n*u-r*d,a,t+n*d+r*u],p=l-.25,m=l;i===2&&(p=l-.15625,m=l-.09375),Sn.quad(f(-n/2,r/2),f(n/2,r/2),f(n/2,-r/2),f(-n/2,-r/2),[0,1,0],[c+.002,p+.002,c+.248,m-.002],s)};{let e=Je+.005,t=(e,t)=>_t.some(([n,r,i,a])=>Math.abs(n-e)<i/2+.6&&Math.abs(r-t)<a/2+.6)||dt.some(([n,r,i,a])=>e>n&&e<i&&t>r&&t<a)||e>q.tkts.x0-1&&e<q.tkts.x1+1&&t>q.tkts.zBack-1&&t<q.tkts.zFront+1;for(let n of q.plazaRows){let{c0:r,c1:a}=st(n);for(let n of[-1,1]){let o=F.AV_HALF+1,s=q.plazaX-1;for(let c=0;c<70;c++){let c=n*(o+i()*(s-o)),l=r+1+i()*(a-r-2);if(t(c,l))continue;let u=i();if(u<.06)X(c,l,.9,.9,i()<.5?0:1,e,i()*6.28);else if(u<.12)X(c,l,.7,.7,3,e);else if(u<.48){let t=1.5+i()*3.5;X(c,l,t,t*(.6+i()*.6),4+Math.floor(i()*4),e,i()*6.28)}else if(u<.68){let t=1.2+i()*1.6;X(c,l,t,t,8+Math.floor(i()*2),e,i()*6.28)}else if(u<.8){let t=1.5+i()*2;X(c,l,t,t*.5,10+Math.floor(i()*2),e,i()*6.28)}else if(u<.9)X(c,l,1.2,.8,12+Math.floor(i()*2),e,i()<.5?0:Math.PI/2);else{let t=2.5+i()*3;X(c,l,t,t*.7,14,e,i()*6.28)}}for(let t=r+8+i()*6;t<a-4;t+=14+i()*10)X(n*(F.AV_HALF+1.6),t,.5,3,2,e,Math.PI/2)}}let n=.014;for(let e=-318;e<-2;e+=3+i()*5){let t=[-8.25,-2.75,2.75,8.25][Math.floor(i()*4)]+(i()-.5)*1.2,r=(e%F.ST_SP+F.ST_SP)%F.ST_SP;if(r<F.ST_HALF+3||r>F.ST_SP-F.ST_HALF-3)continue;let a=i();a<.1?X(t,e,.9,.9,0,n,i()*6.28):a<.55?X(t,e,1.2+i()*1.5,2.5+i()*4,4+Math.floor(i()*4),n,(i()-.5)*.3,[.8,.8,.8]):a<.8?X(t,e,3+i()*4,.6,15,n,(i()-.5)*2.5):X(t,e,2+i()*2,1.2+i(),14,n,i()*6.28)}let r=(e,t,n,r,i,a,o=0,s=1)=>{let c=i%2/2,l=1-Math.floor(i/2)/2,u=Math.cos(o),d=Math.sin(o),f=(n,r)=>[e+n*u-r*d,a,t+n*d+r*u],p=[c+.004,l-.496,c+.496,l-.004];if(i===3){let i=Math.sin(e*12.9898+t*78.233)*43758.5453%1,a=Math.abs(i*7.31%1);i<0&&(p=[p[2],p[1],p[0],p[3]]),a>.5&&(p=[p[0],p[3],p[2],p[1]]),n*=.65+.7*a,r*=1.35-.7*a,s*=.7}Cn.quad(f(-n/2,r/2),f(n/2,r/2),f(n/2,-r/2),f(-n/2,-r/2),[0,1,0],p,[s,s,s])},a=.017;for(let e of[-320,-240,-160,-80]){let t=e+F.ST_HALF,n=e+F.ST_SP-F.ST_HALF;if(e!==-80){for(let e of[-8.25,-2.75,2.75,8.25])for(let o of[-.85,.85])for(let s=t+1;s<n-1;){let t=6+i()*10,c=Math.min(n-1,s+t);if(r(e+o+(i()-.5)*.15,(s+c)/2,.75+i()*.3,c-s+1.5,0,a,(i()-.5)*.01,.6+i()*.4),c>=n-1)break;s=c-.8}for(let e=0;e<7;e++){let e=1.5+i()*3.5,a=1.5+i()*5;r(-9+i()*18,t+4+i()*(n-t-8),e,a,1,.018000000000000002,(i()<.8?0:Math.PI/2)+(i()-.5)*.04)}for(let e=0;e<4;e++){let e=2.5+i()*3;r(-9+i()*18,t+3+i()*(n-t-6),e,e,3,.019000000000000003,i()*6.28)}for(let e of[-F.AV_HALF+.3,F.AV_HALF-.3])for(let i=t+4;i<n-4;i+=8)r(e,i,.55,8.4,0,.018000000000000002,0,1)}for(let t=0;t<2;t++)for(let n of[e-F.ST_HALF-2.4,e+F.ST_HALF+2.4])for(let e=-10+t*2;e<10;e+=4.2+i())r(e+2,n+(i()-.5),4.6+i()*1.5,3.6+i(),2,.02,i()<.5?0:Math.PI,.7+i()*.3);for(let t=0;t<2;t++)for(let n of[-F.AV_HALF-2.4,F.AV_HALF+2.4])for(let a=e-4.5+t*1.7;a<e+4.5;a+=3.6)r(n+(i()-.5),a+1.8,3.6+i(),4.4,2,.02,Math.PI/2,.7+i()*.3);for(let t of[-1,1]){for(let n of[e-2.5,e+2.5])for(let e of[-.8,.8])for(let o=F.AV_HALF+6;o<q.towerX;o+=9+i()*5)r(t*(o+5),n+e,.7+i()*.3,10+i()*3,0,a,Math.PI/2+(i()-.5)*.01,.8);for(let n=0;n<7;n++)r(t*(F.AV_HALF+4+i()*(q.towerX-16)),e-3+i()*6,1.5+i()*3,1.2+i()*2.5,1,.018000000000000002,(i()<.8?0:Math.PI/2)+(i()-.5)*.04,n%2?1:1.7+i()*.6);for(let n=0;n<3;n++)X(t*(F.AV_HALF+6+i()*(q.towerX-20)),e+(i()-.5)*5,.9,.9,i()<.5?0:1,.021,i()*6.28);for(let n=0;n<10;n++){let n=2+i()*3;r(t*(F.AV_HALF+4+i()*(q.towerX-16)),e-3.5+i()*7,n,n*.8,i()<.4?3:2,.019000000000000003,i()*6.28,.7)}for(let n=0;n<3;n++)r(t*(F.AV_HALF+6+i()*26),e+(i()-.5)*.6,.7+i()*.5,9.6,1,.018500000000000003,(i()-.5)*.05,1.5+i()*.5);for(let n=0;n<5;n++){let n=1.2+i()*1.6;r(t*(F.AV_HALF+5+i()*30),e+(i()-.5)*7,n,n*(.7+i()*.6),1,.0182,(i()-.5)*.08,i()<.5?1:1.6+i()*.5)}for(let n=0;n<2;n++)X(t*(F.AV_HALF+7+i()*22),e+(i()-.5)*5,.8,.8,1,.021,i()*6.28);for(let n=0;n<3;n++){let n=2+i()*3.5;r(t*(F.AV_HALF+4+i()*30),e+(i()-.5)*8,n,n*.8,3,.019200000000000002,i()*6.28,.8)}for(let n of[e-F.ST_HALF+.3,e+F.ST_HALF-.3])for(let e=F.AV_HALF+1;e<q.towerX;e+=8)r(t*(e+4),n,.55,8.4,0,.018000000000000002,Math.PI/2,1)}for(let t=0;t<5;t++)r(-8+i()*16,e-3+i()*6,4+i()*4,3+i()*3,i()<.7?2:1,.018000000000000002,i()*6.28,.6)}let o=(e,t,n,r,i,a,o=0,s=1)=>{let c=i%2/2,l=1-Math.floor(i/2)/2,u=Math.cos(o),d=Math.sin(o),f=(n,r)=>[e+n*u-r*d,a,t+n*d+r*u];wn.quad(f(-n/2,r/2),f(n/2,r/2),f(n/2,-r/2),f(-n/2,-r/2),[0,1,0],[c+.004,l-.496,c+.496,l-.004],[s,s,s])},s=.0196;for(let e of[-320,-240,-160,-80]){let t=e+F.ST_HALF,n=e+F.ST_SP-F.ST_HALF;if(e!==-80){for(let e of[-8.25,-2.75,2.75,8.25]){let r=e<0?t+3:n-3,a=e<0?1:-1;i()<.55&&o(e+(i()-.5)*.4,r+a*(6+i()*8),1.9,5+i()*5,0,s,(i()-.5)*.08,.7+i()*.3);for(let t=0;t<2;t++)o(e+(i()-.5)*.6,r+a*(1.5+t*5.5+i()*1.5),1.3+i()*.8,1.6+i(),1,.019799999999999998,i()*6.28,.8+i()*.2)}for(let e of[-1,1])for(let r=t+2;r<n-3;r+=5.5)o(e*(F.AV_HALF-.55),r+2.75,1.1,5.8,2,.02,e>0?Math.PI:0,.9);for(let e=0;e<6;e++){let e=2.5+i()*4;o(-10+i()*20,t+3+i()*(n-t-6),e,e*(.6+i()*.5),3,.019299999999999998,i()*6.28,.8)}}for(let t of[-1,1]){for(let[n,r]of[[e-F.ST_HALF,Math.PI/2],[e+F.ST_HALF,-Math.PI/2]]){let e=n+(r>0?.55:-.55);for(let n=F.AV_HALF+1;n<q.towerX-1;n+=5.5)o(t*(n+2.75),e,1.1,5.8,2,.02,r,.9)}for(let n of[e-2.5,e+2.5]){let e=t*(F.AV_HALF+5+i()*10);i()<.6&&o(e,n+(i()-.5)*.3,1.8,5+i()*4,0,s,Math.PI/2+(i()-.5)*.1,.8),o(t*(F.AV_HALF+4+i()*3),n+(i()-.5)*.5,1.4,1.8,1,.019799999999999998,i()*6.28,.9)}for(let n=0;n<9;n++){let n=2+i()*4;o(t*(F.AV_HALF+2+i()*36),e+(i()-.5)*7.5,n,n*.7,3,.019299999999999998,i()*6.28,1)}for(let n=0;n<3;n++)o(t*(F.AV_HALF+3+i()*30),e+(i()-.5)*6,1.8,4+i()*4,0,s,Math.PI/2+(i()-.5)*.5,.7)}}let c=(e,t,n,r,i,a,o=0,s=1)=>{let c=i%2/2,l=1-Math.floor(i/2)/2,u=Math.cos(o),d=Math.sin(o),f=(n,r)=>[e+n*u-r*d,a,t+n*d+r*u];Tn.quad(f(-n/2,r/2),f(n/2,r/2),f(n/2,-r/2),f(-n/2,-r/2),[0,1,0],[c+.004,l-.496,c+.496,l-.004],[s,s,s])},l=(e,t)=>{let n=(t%F.ST_SP+F.ST_SP)%F.ST_SP;return n<F.ST_HALF-.3||n>F.ST_SP-F.ST_HALF+.3?Math.abs(e)<q.towerX:Math.abs(e)<F.AV_HALF-.3&&!(t>-80&&t<0)};for(let e=0;e<300;e++){let e=i()<.5,t=[-320,-240,-160,-80,0][Math.floor(i()*5)],n=e?(i()-.5)*2*(F.AV_HALF-1.5):(i()-.5)*2*(q.towerX-4),r=e?-318+i()*236:t+(i()-.5)*(F.ST_ROAD-1.5);if(!l(n,r))continue;let a=i();if(a<.4){let e=3.5+i()*3;c(n,r,e,e,0,.020399999999999998,i()*6.28,.6+i()*.4)}else if(a<.55){let e=2.2+i()*2.5;c(n,r,e,e,1,.020599999999999997,i()*6.28,.8)}else if(a<.93){let a=e?[-8.25,-2.75,2.75,8.25][Math.floor(i()*4)]:0,o=e?a+(i()-.5)*.3:n,s=e?r:t+(i()<.5?-2.5:2.5)+(i()-.5)*.3;l(o,s)&&c(o,s,1+i()*.6,2.4+i()*2.5,2,.0208,e?(i()-.5)*.1:Math.PI/2+(i()-.5)*.1,.8+i()*.2)}else a>.975&&c(n,r,2.44,3.05,3,.020999999999999998,e?0:Math.PI/2,.9+i()*.2)}}let En=Ce(),Z=ve(),Q=Ct(it+`ts_pavers.webp`,{repeat:!0,aniso:16}),Dn=wt(),$=(t,n,r,i=!1)=>{if(!t)return null;let a=new y(t,n);return a.name=r,a.castShadow=i,a.receiveShadow=!0,e.add(a),a},On=e=>new w({map:e,color:2763306,emissive:16777215,emissiveMap:e,emissiveIntensity:2.5,roughness:.28,metalness:0,vertexColors:!0}),kn=On(En);kn.userData.nightGain=1,kn.defines={...kn.defines,CITYL_NOSPEC:``},kn.onBeforeCompile=e=>{Object.assign(e.uniforms,Ye()),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,re(nt.fragmentCommon,Xe)).replace(`#include <emissivemap_fragment>`,re(nt.fragmentEmissive,Ze,et.replace(`+ 1e-4;`,`* clamp(vColor.r / 0.7, 0.3, 1.0) + 1e-4;`)))};let An=$(u.build(),kn,`tsScreens`);{let e=new w({map:En,vertexColors:!0,roughness:.62,metalness:0,color:14869218,emissive:16777215,emissiveMap:En,emissiveIntensity:0});e.userData.nightLit=.3,e.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <map_fragment>`,nt.fragmentMap)},$(ae.build(),e,`tsVinyl`)}{let e=new E({map:Tt(),vertexColors:!0,transparent:!0,depthWrite:!1,side:2,polygonOffset:!0,polygonOffsetFactor:-6,polygonOffsetUnits:-6});Object.assign(e,{blending:5,blendEquation:100,blendSrc:204,blendDst:205,blendSrcAlpha:200,blendDstAlpha:201}),e.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <color_fragment>`,nt.fragmentColor)};let t=$(oe.build(),e,`tsAO`);t&&(t.receiveShadow=!1,t.renderOrder=3)}$(f.build(),tt(On(Z),`tsSigns`),`tsSigns`);{let e=new w({color:0,emissive:16777215,emissiveMap:Z,emissiveIntensity:2.2,roughness:.4,metalness:0,vertexColors:!0,side:2});e.onBeforeCompile=e=>{e.fragmentShader=e.fragmentShader.replace(`#include <emissivemap_fragment>`,nt.fragmentEmissiveSignLetterCutout)},e.customProgramCacheKey=()=>`tsNeon`,tt(e,`neon`),$(Ae.build(),e,`tsNeon`)}$(h.build(),new E({map:Dn,vertexColors:!0,color:16777215,side:2}),`tsLights`);{let e=Ct(it+`ts_ticker.webp`,{aniso:8});e.wrapS=g;let t=$(He.build(),tt(new w({map:e,color:2105376,emissive:16777215,emissiveMap:e,emissiveIntensity:2.4,roughness:.35}),`ticker`),`tsTicker`);t&&(t.onBeforeRender=()=>{e.offset.x=performance.now()*4e-5%1})}{let e=Ct(it+`ts_spill.png`,{aniso:1}),t=new E({map:e,vertexColors:!0,transparent:!0,depthWrite:!1,side:2,polygonOffset:!0,polygonOffsetFactor:-4,polygonOffsetUnits:-4});Object.assign(t,{blending:5,blendEquation:100,blendSrc:201,blendDst:201,blendSrcAlpha:200,blendDstAlpha:201});let n=$(yn.build(),t,`tsSpill`);n&&(n.receiveShadow=!1,n.renderOrder=2),n&&(n.onBeforeRender=()=>{t.color.setScalar(1-(te.enabled?1:.78)*ie.value)});let r=new Uint8Array(16384);for(let e=0;e<64;e++)for(let t=0;t<64;t++){let n=Math.min(1,Math.hypot(t/63,e/63)),i=Math.round(255*(1-n)**2.2),a=(e*64+t)*4;r[a]=r[a+1]=r[a+2]=i,r[a+3]=255}let i=new b(r,64,64);i.magFilter=p,i.minFilter=p,i.needsUpdate=!0;let a=t.clone();a.map=i,a.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace(`#include <common>`,nt.vertexCommon).replace(`#include <project_vertex>`,nt.vertexProjectVertex),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,nt.fragmentCommonByHaloFade).replace(`#include <opaque_fragment>`,nt.fragmentOpaque)},a.customProgramCacheKey=()=>`tsHaloFade`;let o=$(xn.build(),a,`tsHalo`);o&&(o.receiveShadow=!1,o.renderOrder=2,o.onBeforeRender=()=>{a.color.setScalar(1-(te.enabled?1:.72)*ie.value)}),An&&(n||o)&&(An.onBeforeRender=()=>{let e=!(te.enabled&&ie.value>.99);n&&(n.visible=e),o&&(o.visible=e)})}{let e=Ct(it+`ts_decals.webp`,{aniso:8}),t=new w({map:e,vertexColors:!0,transparent:!0,depthWrite:!1,roughness:.75,polygonOffset:!0,polygonOffsetFactor:-5,polygonOffsetUnits:-5});Object.assign(t,{blending:5,blendEquation:100,blendSrc:204,blendDst:205,blendSrcAlpha:200,blendDstAlpha:201});let n=$(Sn.build(),t,`tsDecals`);n&&(n.renderOrder=1);let r=Ct(it+`ts_road.webp`,{aniso:8}),i=t.clone();i.map=r;let a=$(Cn.build(),i,`tsRoadWear`);a&&(a.renderOrder=1);let o=t.clone();o.map=Ct(it+`ts_road2.webp`,{aniso:8});let s=$(wn.build(),o,`tsRoadWear2`);s&&(s.renderOrder=1);let c=t.clone();c.map=Ct(it+`ts_road3.webp`,{aniso:8});let l=$(Tn.build(),c,`tsRoadWear3`);l&&(l.renderOrder=1)}let jn=Ct(it+`ts_shops.webp`,{aniso:4});{let e=new w({map:jn,color:3158064,emissive:16777215,emissiveMap:jn,emissiveIntensity:1,roughness:.05,metalness:0,vertexColors:!0});e.onBeforeCompile=e=>{e.vertexShader=nt.storefrontVertexPrefix+e.vertexShader.replace(`#include <project_vertex>`,nt.vertexProjectVertexStorefront),e.fragmentShader=nt.storefrontFragmentPrefix+e.fragmentShader.replace(`#include <map_fragment>`,nt.fragmentMapStorefrontGlass).replace(`#include <emissivemap_fragment>`,nt.fragmentEmissiveStorefrontInterior)},$(A.build(),e,`tsShops`)}_.v&&$(_.build(),new w({vertexColors:!0,roughness:.55,metalness:.5}),`tsFrames`,!0);let Mn=Ct(it+`ts_pavers_n.webp`,{srgb:!1,repeat:!0,aniso:16}),Nn=Ct(it+`ts_pavers_r.webp`,{srgb:!1,repeat:!0,aniso:8}),Pn=new w({map:Q,normalMap:Mn,normalScale:new T(.9,.9),roughnessMap:Nn,roughness:1,metalness:0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),Fn=Ct(it+`noise.png`,{srgb:!1,repeat:!0,aniso:1}),In=[];{let e=q.tkts;for(let t of q.plazaRows){let{c0:n,c1:r}=st(t);for(let t of[-1,1])for(let a=0,o=0;a<4&&o<60;o++){let o=2.2+i()*2.2,s=t*(F.AV_HALF+4+o+i()*(q.plazaX-F.AV_HALF-8-2*o)),c=n+3+o+i()*(r-n-6-2*o);s+o>e.x0-1&&s-o<e.x1+1&&c+o>e.zBack-1&&c-o<e.zFront+1||In.some(e=>Math.hypot(e.x-s,e.y-c)<e.z+o+2.5)||(In.push(new x(s,c,o,Math.floor(i()*4))),a++)}}for(;In.length<24;)In.push(new x(0,0,-1,0))}Pn.onBeforeCompile=e=>{e.uniforms.tMacro={value:Fn},e.uniforms.uCirc={value:In},e.uniforms.uEdgeX={value:q.plazaX},e.fragmentShader=nt.paversFragmentPrefix+e.fragmentShader.replace(`#include <map_fragment>`,nt.fragmentMapPaverGrime)},$(C.build(),Pn,`tsPavers`);{let e=new St,t=.0125,n=(n,r,i,a)=>e.quad([n,t,a],[i,t,a],[i,t,r],[n,t,r],[0,1,0],[n/37,a/37,i/37,r/37]);for(let e of[-320,-240,-160])n(-F.AV_HALF,e+F.ST_HALF,F.AV_HALF,e+F.ST_SP-F.ST_HALF);for(let e of[-320,-240,-160,-80,0])n(-q.towerX,e-F.ST_HALF,q.towerX,e+F.ST_HALF);let r=e=>{let t=new w({map:Fn,color:6118231,roughness:.93,metalness:0,transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-4,polygonOffsetUnits:-4});return Object.assign(t,{blending:5,blendEquation:100,blendSrc:204,blendDst:205,blendSrcAlpha:200,blendDstAlpha:201}),t.onBeforeCompile=t=>{t.fragmentShader=t.fragmentShader.replace(`#include <map_fragment>`,re(nt.fragmentMapCrosswalkWear,37,F.ST_SP,F.ST_HALF+2.4,F.ST_SP-F.ST_HALF-2.4,F.AV_HALF-.5,F.AV_HALF+.5,F.ST_HALF-.5,F.ST_HALF+.2,F.ST_SP,F.AV_HALF+2.4,e?`clamp(cw, 0.0, 1.0) * (0.32 + 0.5 * chip)`:`diffuseColor.a`,q.towerX,q.towerX-24))},t.customProgramCacheKey=()=>`tsDust`+(e?`CW`:``),t},i=$(e.build(),r(!1),`tsRoadDust`);i&&(i.renderOrder=.5);let a=new St,o=.02,s=(e,t,n,r)=>a.quad([e,o,r],[n,o,r],[n,o,t],[e,o,t],[0,1,0],[e/37,r/37,n/37,t/37]);for(let e of[-320,-240,-160,-80,0]){for(let t of[e-F.ST_HALF-5.2,e+F.ST_HALF+.2])t>-330&&t<0&&s(-F.AV_HALF,t,F.AV_HALF,t+5);for(let t of[-1,1])s(t>0?F.AV_HALF+.2:-F.AV_HALF-4.6,e-F.ST_HALF,t>0?F.AV_HALF+4.6:-F.AV_HALF-.2,e+F.ST_HALF)}let c=$(a.build(),r(!0),`tsCrossWear`);c&&(c.renderOrder=1.5,c.receiveShadow=!0)}{let e=new w({color:13623524,transparent:!0,opacity:.2,roughness:.04,metalness:.2,side:2,depthWrite:!1,vertexColors:!0});Object.assign(e,{blending:5,blendEquation:100,blendSrc:204,blendDst:205,blendSrcAlpha:200,blendDstAlpha:201});let t=$(ne.build(),e,`tsGlass`);t&&(t.renderOrder=4)}if($(ct.build(),new w({vertexColors:!0,roughness:.8,polygonOffset:!0,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),`tsBands`),O.v){let e=$(O.build(),Object.assign(new w({color:11017250,emissive:12588060,emissiveIntensity:.12,roughness:.5,metalness:.1,vertexColors:!0}),{userData:{nightGain:.4}}),`tsTKTS`,!0);e&&(e.material.userData.nightGain=.4)}let Ln=xe.commit(`ts`);return Et(Se),{planters:_t.length,bollards:Dt.length,screens:u.v/4,crowd:at.length,lights:Ln}}var Ot=(e,t)=>Math.abs(e)<q.towerX+6&&t>-332&&t<8;function kt(e){let t=de(77);for(let n=e.length-1;n>=0;n--){let r=e[n];Math.abs(r.x)<q.towerX+8&&r.z>-330&&r.z<8&&t()>-1&&e.splice(n,1)}for(let t of ot)e.push(t)}var At=`// hero shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`,jt=`// buildings shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`,Mt=[`roofEdge`,`roofCorner`,`ledge`,`waterTower`,`antenna`,`pole`,`lampTop`,`signalMast`],Nt=Object.fromEntries(Mt.map((e,t)=>[e,t])),Pt=class{constructor(){this.raw=[],this.cell=32}add(e,t,n,r,i,a,o){this.raw.push(e,t,n,r,i,a,Nt[o]??0)}edge(e,t,n,r,i,a,o,s=`roofEdge`,c=7){let l=Math.hypot(n-e,r-t),u=Math.max(1,Math.round(l/c));for(let c=1;c<u;c++){let l=c/u;this.add(e+(n-e)*l,i,t+(r-t)*l,a,0,o,s)}u===1&&l>2&&this.add((e+n)/2,i,(t+r)/2,a,0,o,s)}addBlockers(e){(this.blockers??=[]).push(...e)}addTreeBlockers(e){let t=[];for(let n of e?.pools??[]){if(!/^trees-.*-near$/.test(n.mesh?.name??``))continue;let e=n.geo??n.mesh.geometry;e.boundingBox||e.computeBoundingBox();let r=e.boundingBox,i=Math.max(-r.min.x,r.max.x,-r.min.z,r.max.z)*.9;for(let e of n.items){let n=e.s??1;t.push({x:e.x,z:e.z,r:i*n+.45,y0:e.y+r.min.y*n-1.9,y1:e.y+r.max.y*n})}}return this.addBlockers(t),t.length}_blocked(e,t,n){let r=this.blockers;if(!r)return!1;this._bh||(this._bh=new Map,r.forEach((e,t)=>{for(let n=Math.floor((e.x-e.r)/16);n<=Math.floor((e.x+e.r)/16);n++)for(let r=Math.floor((e.z-e.r)/16);r<=Math.floor((e.z+e.r)/16);r++){let e=n*7919+r,i=this._bh.get(e);i||this._bh.set(e,i=[]),i.push(t)}}));let i=this._bh.get(Math.floor(e/16)*7919+Math.floor(n/16));if(!i)return!1;for(let a of i){let i=r[a];if(t>i.y0&&t<i.y1&&(e-i.x)**2+(n-i.z)**2<i.r*i.r)return!0}return!1}finalize(e){let t=this.raw,n=t.length/7,r=[];for(let i=0;i<n;i++){let n=i*7,a=t[n],o=t[n+1],s=t[n+2],c=t[n+3],l=t[n+5],u=t[n+6];if(!this._blocked(a,o,s)&&!(u===Nt.ledge&&o<8)&&!(u>=3&&o<3)){if(e){let r=u<3?a-c*.12:a,i=u<3?s-l*.12:s,d=e.topAt(r,i,o+.3);if(d.id<0||Math.abs(d.y-o)>(u<3?.06:.3))continue;if(u>=3){let r=e.topAt(a,s,o+.3);if(r.id<0)continue;t[n+1]=r.y}else t[n+1]=d.y;let f=t[n+1],p=u>=3?.35:.3;if(e.inside(a,f+p,s)||e.inside(a,f+1.2,s)||e.cast(a,f+.02,s,0,1,0,2)||e.cast(r,f+.02,i,0,1,0,2))continue;if(u===Nt.ledge){let t=a-c*.6,n=s-l*.6,r=e.topAt(t,n,f+.05);if(r.id<0||Math.abs(r.y-f)>.05||e.inside(t,f+.3,n))continue}if(u<3){let t=a+c*.35,n=s+l*.35;if(e.inside(t,f+(u===Nt.ledge?1.3:.3),n))continue}}r.push(i)}}let i=new Float32Array(r.length*6),a=new Uint8Array(r.length);r.forEach((e,n)=>{for(let r=0;r<6;r++)i[n*6+r]=t[e*7+r];a[n]=t[e*7+6]}),this.P=i,this.K=a,this.raw=null,this.blockers=null,this._bh=null;let o=this.cell,s=new Map;for(let e=0;e<a.length;e++){let t=Math.floor(i[e*6]/o)*73856093^Math.floor(i[e*6+2]/o)*19349663,n=s.get(t);n||s.set(t,n=[]),n.push(e)}return this.hash=s,this}get count(){return this.K?this.K.length:this.raw.length/7}query(e,t,n=null){let r=[];if(!this.hash)return r;let i=this.cell,a=this.P,o=t*t,s=Math.floor((e.x-t)/i),c=Math.floor((e.x+t)/i),l=Math.floor((e.z-t)/i),u=Math.floor((e.z+t)/i),d=[];for(let t=s;t<=c;t++)for(let r=l;r<=u;r++){let s=this.hash.get(t*73856093^r*19349663);if(s)for(let c of s){let s=c*6,l=a[s]-e.x,u=a[s+1]-e.y,f=a[s+2]-e.z,p=l*l+u*u+f*f;p>o||Math.floor(a[s]/i)===t&&Math.floor(a[s+2]/i)===r&&(!n||n.includes(Mt[this.K[c]]))&&d.push(c,p)}}let f=[];for(let e=0;e<d.length;e+=2)f.push(e);f.sort((e,t)=>d[e+1]-d[t+1]);for(let e of f){let t=d[e],n=t*6;r.push({pos:new k(a[n],a[n+1],a[n+2]),normal:new k(a[n+3],a[n+4],a[n+5]),kind:Mt[this.K[t]]})}return r}};function Ft(e,t){let n=t?.anchors?.()??t?.propAnchors?.();if(Array.isArray(n)){let r=new Map;for(let e of t?.pools??[]){if(e.mesh?.name!==`antenna`)continue;let t=e.geo??e.mesh.geometry;t.boundingBox||t.computeBoundingBox(),r.set(`antenna`,{items:e.items,maxY:t.boundingBox.max.y})}for(let e of n){let t=r.get(e.kind);if(t){let n=null,r=.25;for(let i of t.items){let t=Math.hypot(i.x-e.pos.x,i.z-e.pos.z);t<r&&(r=t,n=i)}n&&(e.pos.y=n.y+t.maxY*(n.scale3?n.scale3[1]*(n.s??1):n.s??1))}}let i=new Set;for(let e of t?.pools??[])if(e.mesh?.name===`mast`)for(let t of e.items)i.add(Math.round(t.x*10)+`,`+Math.round(t.z*10));for(let t of n)t.kind===`signalMast`&&i.has(Math.round(t.pos.x*10)+`,`+Math.round(t.pos.z*10))||e.add(t.pos.x,t.pos.y,t.pos.z,t.normal?.x??0,t.normal?.y??1,t.normal?.z??0,t.kind);return n.length}let r=t?.pools??[],i=0,a=(t,n,r,a,o)=>{let s=t.s??1,c=Math.cos(t.ry),l=Math.sin(t.ry);e.add(t.x+(n*c+a*l)*s,t.y+r*s,t.z+(-n*l+a*c)*s,0,1,0,o),i++};for(let e of r){let t=e.mesh?.name;if(t===`lamp`)for(let t of e.items)a(t,0,9.15,2.9,`lampTop`);else if(t===`mast`)for(let t of e.items)a(t,0,7.9,0,`signalMast`),a(t,0,6.8,10.4,`signalMast`)}return i}var It=[[1,1,1],[1,.9,.1],[1,.5,.1],[.2,.5,1],[1,.15,.1],[.3,1,.3],[.3,1,.3],[.1,.8,.4]];function Lt(e,t,r=150){let i=e.query(t,r),o=[],l=[],d=[],f=[];for(let e of i){let t=It[Mt.indexOf(e.kind)]??[1,1,1];o.push(e.pos.x,e.pos.y+.05,e.pos.z),l.push(...t),d.push(e.pos.x,e.pos.y+.05,e.pos.z,e.pos.x+e.normal.x*.8,e.pos.y+.05+e.normal.y*.8,e.pos.z+e.normal.z*.8),f.push(...t,...t)}let p=new O;p.name=`zipDebug`;let m=new C;m.setAttribute(`position`,new c(o,3)),m.setAttribute(`color`,new c(l,3)),p.add(new n(m,new a({size:11,sizeAttenuation:!1,vertexColors:!0,depthTest:!1})));let h=new C;return h.setAttribute(`position`,new c(d,3)),h.setAttribute(`color`,new c(f,3)),p.add(new s(h,new u({vertexColors:!0,depthTest:!1}))),p.children.forEach(e=>{e.frustumCulled=!1,e.renderOrder=11}),p}function Rt(e,t,n,r){let i=new URLSearchParams(typeof location<`u`?location.search:``),a={zips:i.has(`zipdbg`),collision:i.has(`coldbg`),radius:+(i.get(`dbgr`)||60)},o=null,s=null,c=new k(1e9,0,0),l=t=>(t&&(e.remove(t),t.traverse(e=>{e.geometry?.dispose(),e.material?.dispose()})),null);return{set(e){Object.assign(a,e),c.set(1e9,0,0),a.zips||(o=l(o)),a.collision||(s=l(s))},update(i){(a.zips||a.collision)&&(i.position.distanceTo(c)<a.radius*.3||(c.copy(i.position),a.zips&&(o=l(o),o=Lt(n,i.position,a.radius*2),e.add(o)),a.collision&&(s=l(s),s=r(t,i.position,a.radius),e.add(s))))}}}var zt=`// props shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`;function Bt(){let e=document.createElement(`canvas`);e.width=e.height=512;let t=e.getContext(`2d`),n=de(777);for(let e=0;e<4;e++){let r=e%2*256,i=Math.floor(e/2)*256,a=[],o=e===3?7:3;for(let e=0;e<=12;e++)a.push([r+10+236*e/12,i+10+(n()-.5)*o]);for(let e=1;e<=12;e++)a.push([r+256-10+(n()-.5)*o,i+10+236*e/12]);for(let e=11;e>=0;e--)a.push([r+10+236*e/12,i+256-10+(n()-.5)*o]);for(let e=11;e>=1;e--)a.push([r+10+(n()-.5)*o,i+10+236*e/12]);t.beginPath(),a.forEach(([e,n],r)=>r?t.lineTo(e,n):t.moveTo(e,n)),t.closePath();let s=[.36,.62,.34,.6][e];t.fillStyle=e===1?`rgba(132,132,130,0.36)`:e===3?`rgba(116,116,114,0.3)`:`rgba(22,24,27,${s})`,t.fill(),t.save(),t.clip();for(let e=0;e<900;e++){let e=r+n()*256,a=i+n()*256,o=.6+n()*1.6;t.fillStyle=n()<.5?`rgba(120,120,118,${.08+n()*.1})`:`rgba(10,10,12,${.1+n()*.15})`,t.fillRect(e,a,o,o)}for(let e=0;e<6;e++){let e=t.createRadialGradient(r+n()*256,i+n()*256,2,r+n()*256,i+n()*256,40+n()*60);e.addColorStop(0,`rgba(140,140,138,0.10)`),e.addColorStop(1,`rgba(140,140,138,0)`),t.fillStyle=e,t.fillRect(r,i,256,256)}t.restore(),t.lineWidth=5,t.strokeStyle=`rgba(8,8,9,0.55)`,t.stroke(),t.lineWidth=2,t.strokeStyle=`rgba(150,150,146,0.22)`,t.stroke()}let r=new o(e);return r.colorSpace=f,r.anisotropy=8,r}function Vt({scene:e}){let t=de(9011),n=[],i=[],a=[],o=0,s=(e,t,r,s,c,l)=>{let u=c%2/2,d=Math.floor(c/2)/2,f=.5,p=[[u,d],[u+f,d],[u+f,d+f],[u,d+f]];l&&(p=[p[1],p[2],p[3],p[0]]);let m=[[e,s],[r,s],[r,t],[e,t]];for(let e=0;e<4;e++)n.push(m[e][0],.008,m[e][1]),i.push(...p[e]);a.push(o,o+1,o+2,o,o+2,o+3),o+=4},l=V;for(let e=0;e<oe.length;e++){let n=oe[e];for(let r=0;r+1<N.length;r++){if(!he(e,r))continue;let i=N[r]+ue(r)+9,a=N[r+1]-ue(r+1)-9,o=7+Math.floor(t()*6);for(let e=0;e<o;e++){let e=t(),r,o,c,u;if(e>.62&&e<.78){let e=n+(t()-.5)*16,r=1.2+t()*2.2,o=3+t()*6,c=i+t()*Math.max(1,a-i-o-3),u=Math.floor(t()*4),d=(t()<.5?-1:1)*(1.4+t()*2.2),f=1+t()*1.4,p=c+t()*o*.6,m=1.2+t()*2;for(let[t,i,a,h]of[[e-r/2,c,e+r/2,c+o],[Math.min(e,e+d)-f/2,p,Math.max(e,e+d)+f/2,p+m]]){let e=Math.max(t,n-F.AV_HALF+.2),r=Math.min(a,n+F.AV_HALF-.2);r-e<.5||r>l.x0&&e<l.x1&&h>l.z0&&i<l.z1||s(e,i,r,h,u,h-i>r-e)}continue}if(e<.5){let e=Math.floor(t()*6),s=n-9+e*3.6+(t()-.5)*.8,l=.9+t()*1.6,d=4+t()*9,f=i+t()*Math.max(1,a-i-d);r=s-l/2,o=s+l/2,c=f,u=f+d}else if(e<.8){let e=n+(t()-.5)*18,s=1+t()*1.8,l=1.8+t()*4.2,d=i+t()*(a-i-l);r=e-s/2,o=e+s/2,c=d,u=d+l}else if(e<.88){let e=2+Math.floor(t()*2),s=Math.floor(t()*(7-e)),l=7+t()*9,d=i+t()*Math.max(1,a-i-l);r=n-F.AV_HALF+.5+s*3.5,o=r+e*3.5,c=d,u=d+l}else{let e=t()<.5?-1:1,s=5+t()*5,l=.9+t()*.8,d=i+t()*(a-i-l);r=e<0?n-F.AV_HALF+.3:n+F.AV_HALF-.3-s,o=r+s,c=d,u=d+l}if(r=Math.max(r,n-F.AV_HALF+.2),o=Math.min(o,n+F.AV_HALF-.2),o-r<.5||u<=c||o>l.x0&&r<l.x1&&u>l.z0&&c<l.z1)continue;let d=Math.floor(t()*4);(e<.5||e>=.8&&e<.88)&&!(d&1)&&Math.abs(Math.sin(r*12.9898+c*78.233)*43758.5453)%1<.65&&d++,s(r,c,o,u,d,u-c>o-r)}}}for(let e=0;e<N.length;e++){let n=N[e];for(let r=0;r<2*oe.length+1;r+=2){let i=se(e,r);if(!i)continue;let[a,o]=i;if(!(o-a<30||t()<.15))for(let r=0,i=2+Math.floor(t()*3);r<i;r++){let r=1.5+t()*6,i=1+t()*2.8,c=a+8+t()*(o-a-16-r),l=n-ue(e)+.3+t()*(2*ue(e)-.6-i);s(c,l,c+r,l+i,Math.floor(t()*4),!1)}}}let u=new C;u.setAttribute(`position`,new c(n,3)),u.setAttribute(`normal`,new c(Array(o).fill(0).flatMap(()=>[0,1,0]),3)),u.setAttribute(`uv`,new c(i,2)),u.setIndex(new r(a,1)),u.computeBoundingSphere();let d=new w({map:Bt(),transparent:!0,depthWrite:!1,roughness:.8,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),f=new y(u,d);return f.name=`roadPatches`,f.receiveShadow=!0,f.renderOrder=0,e.add(f),f}var J={MH_A:0,MH_B:1,PLATE:2,GRATE:3,OIL_A:4,OIL_B:5,TAR_A:6,TAR_B:7,DRIP:8,GUTTER:9,AO:10,STAIN:11,BLOT:12};function Ht(){let e=document.createElement(`canvas`);e.width=e.height=1024;let t=e.getContext(`2d`),n=de(4711),r=(e,n)=>{t.save(),t.translate(e%4*256,Math.floor(e/4)*256),t.beginPath(),t.rect(0,0,256,256),t.clip(),n(),t.restore()},i=(e,r,i,a=.5,o=0,s=0,c=256,l=256)=>{for(let u=0;u<e;u++){let e=o+n()*c,u=s+n()*l,d=.6+n()*1.8;t.fillStyle=n()<a?`rgba(150,145,138,${r+n()*(i-r)})`:`rgba(8,8,9,${r+n()*(i-r)})`,t.fillRect(e,u,d,d)}},a=(e,n,r,i,a=`10,10,12`)=>{let o=t.createRadialGradient(e,n,0,e,n,r);o.addColorStop(0,`rgba(${a},${i})`),o.addColorStop(.6,`rgba(${a},${i*.5})`),o.addColorStop(1,`rgba(${a},0)`),t.fillStyle=o,t.fillRect(e-r,n-r,2*r,2*r)};for(let[e,o]of[[J.MH_A,!1],[J.MH_B,!0]])r(e,()=>{if(t.fillStyle=`rgba(12,12,13,0.55)`,t.beginPath(),t.arc(128,128,124,0,7),t.fill(),t.fillStyle=`rgba(52,48,44,0.97)`,t.beginPath(),t.arc(128,128,112,0,7),t.fill(),t.strokeStyle=`rgba(96,74,52,0.9)`,t.lineWidth=7,t.beginPath(),t.arc(128,128,109,0,7),t.stroke(),t.save(),t.beginPath(),t.arc(128,128,100,0,7),t.clip(),t.strokeStyle=`rgba(120,116,108,0.75)`,t.lineWidth=3,o){for(let e=22;e<100;e+=17)t.beginPath(),t.arc(128,128,e,0,7),t.stroke();for(let e=0;e<16;e++){let n=e/16*Math.PI*2;t.beginPath(),t.moveTo(128+Math.cos(n)*22,128+Math.sin(n)*22),t.lineTo(128+Math.cos(n)*100,128+Math.sin(n)*100),t.stroke()}t.fillStyle=`rgba(40,38,35,0.95)`,t.fillRect(68,116,120,24),t.fillStyle=`rgba(130,125,115,0.7)`;for(let e=0;e<9;e++)t.fillRect(74+e*12.5,121,8,14)}else for(let e=-100;e<100;e+=13)for(let r=-100;r<100;r+=13)(e/13+r/13)%2==0&&(t.fillStyle=`rgba(118,114,106,${.45+n()*.3})`,t.fillRect(128+e,128+r,9,9));a(128+(n()-.5)*80,128+(n()-.5)*80,70,.35,`70,48,30`),i(500,.1,.3,.4),t.restore()});r(J.PLATE,()=>{t.fillStyle=`rgba(58,56,53,0.96)`,t.fillRect(6,6,244,244),t.strokeStyle=`rgba(105,100,92,0.55)`,t.lineWidth=2;for(let e=10;e<246;e+=10)for(let n=10+(e%20?5:0);n<246;n+=10)t.beginPath(),t.moveTo(n-3,e-3),t.lineTo(n+3,e+3),t.stroke();for(let e=0;e<5;e++)a(20+n()*216,20+n()*216,30+n()*50,.35,`92,58,32`);t.strokeStyle=`rgba(15,15,16,0.85)`,t.lineWidth=6,t.strokeRect(6,6,244,244),i(600,.1,.3)}),r(J.GRATE,()=>{t.fillStyle=`rgba(30,29,28,0.97)`,t.fillRect(10,60,236,136),t.fillStyle=`rgba(5,5,6,0.95)`;for(let e=26;e<230;e+=16)t.fillRect(e,74,8,108);t.strokeStyle=`rgba(88,80,70,0.8)`,t.lineWidth=6,t.strokeRect(12,62,232,132),a(128,128,120,.3)}),r(J.OIL_A,()=>{for(let e=0;e<14;e++)a(128+(n()-.5)*120,128+(n()-.5)*170,18+n()*45,.16+n()*.14);i(300,.05,.15,.2,40,30,176,196)}),r(J.OIL_B,()=>{for(let e=0;e<26;e++)a(30+n()*196,30+n()*196,6+n()*22,.18+n()*.2)});for(let e of[J.TAR_A,J.TAR_B])r(e,()=>{t.strokeStyle=`rgba(6,6,7,0.62)`,t.lineCap=`round`,t.lineJoin=`round`;let r=e===J.TAR_A?2:5;for(let i=0;i<r;i++){let r=n()*256,i=0,a=Math.PI/2+(n()-.5)*.6;t.lineWidth=4+n()*4,t.beginPath(),t.moveTo(r,i),e===J.TAR_B&&(r=n()*256,i=n()*256,t.moveTo(r,i),a=n()*7);for(let e=0;e<40;e++)a+=(n()-.5)*.7,r+=Math.cos(a)*8,i+=Math.sin(a)*8,t.lineTo(r,i);t.stroke()}});r(J.DRIP,()=>{let e=t.createLinearGradient(0,0,256,0);e.addColorStop(0,`rgba(10,10,12,0)`),e.addColorStop(.3,`rgba(10,10,12,0.1)`),e.addColorStop(.5,`rgba(10,10,12,0.22)`),e.addColorStop(.7,`rgba(10,10,12,0.1)`),e.addColorStop(1,`rgba(10,10,12,0)`),t.fillStyle=e,t.fillRect(0,0,256,256);for(let e=0;e<90;e++)a(128+(n()-.5)*70,n()*256,3+n()*9,.15+n()*.2);for(let e of[30.72,225.28]){let n=t.createLinearGradient(e-20,0,e+20,0);n.addColorStop(0,`rgba(120,120,122,0)`),n.addColorStop(.5,`rgba(120,120,122,0.07)`),n.addColorStop(1,`rgba(120,120,122,0)`),t.fillStyle=n,t.fillRect(e-20,0,40,256)}let r=t.createLinearGradient(0,0,0,256);r.addColorStop(0,`rgba(0,0,0,1)`),r.addColorStop(.15,`rgba(0,0,0,0)`),r.addColorStop(.85,`rgba(0,0,0,0)`),r.addColorStop(1,`rgba(0,0,0,1)`),t.globalCompositeOperation=`destination-out`,t.fillStyle=r,t.fillRect(0,0,256,256),t.globalCompositeOperation=`source-over`}),r(J.GUTTER,()=>{let e=t.createLinearGradient(0,0,256,0);e.addColorStop(0,`rgba(14,13,12,0.5)`),e.addColorStop(.25,`rgba(14,13,12,0.32)`),e.addColorStop(.7,`rgba(14,13,12,0.08)`),e.addColorStop(1,`rgba(14,13,12,0)`),t.fillStyle=e,t.fillRect(0,0,256,256);for(let e=0;e<40;e++)a(n()*256*.5,n()*256,8+n()*24,.12+n()*.12);for(let e=0;e<260;e++){let e=n()*256*.35,r=n()*256;t.fillStyle=n()<.5?`rgba(${110+n()*40},${80+n()*30},${40+n()*20},0.5)`:`rgba(170,165,155,${.2+n()*.3})`,t.fillRect(e,r,1+n()*3,1+n()*3)}}),r(J.AO,()=>{let e=t.createLinearGradient(0,0,256,0);e.addColorStop(0,`rgba(10,9,8,0.62)`),e.addColorStop(.12,`rgba(10,9,8,0.4)`),e.addColorStop(.45,`rgba(10,9,8,0.12)`),e.addColorStop(1,`rgba(10,9,8,0)`),t.fillStyle=e,t.fillRect(0,0,256,256);for(let e=0;e<30;e++)a(n()*256*.25,n()*256,6+n()*18,.1)}),r(J.STAIN,()=>{for(let e=0;e<10;e++)a(30+n()*196,30+n()*196,15+n()*40,.08+n()*.08);for(let e=0;e<160;e++)t.fillStyle=`rgba(20,20,20,${.25+n()*.3})`,t.beginPath(),t.arc(n()*256,n()*256,1+n()*2,0,7),t.fill()}),r(J.BLOT,()=>{for(let e=0;e<8;e++)a(64+n()*128,64+n()*128,30+n()*60,.1+n()*.08,`22,20,18`)});let s=new o(e);return s.colorSpace=f,s.anisotropy=8,s}var Ut=[];function Wt({scene:e,buildings:t=null}){Ut.length=0;let n=de(31337),i=[],a=[],o=[],s=0,l=1/256,u=(e,t,n,r,c,u=[0,-1],d=.01)=>{let f=e%4/4+l,p=1-(Math.floor(e/4)+1)/4+l,m=.25-2*l,[h,g]=u,_=-g,v=h,y=[[-r,-c],[r,-c],[r,c],[-r,c]],b=[[f,p],[f+m,p],[f+m,p+m],[f,p+m]];for(let e=0;e<4;e++)i.push(t+_*y[e][0]+h*y[e][1],d,n+v*y[e][0]+g*y[e][1]),a.push(...b[e]);o.push(s,s+1,s+2,s,s+2,s+3),s+=4},d=V,f=(e,t)=>e>d.x0-.5&&e<d.x1+.5&&t>d.z0-.5&&t<d.z1+.5,p=(e,t)=>{let n=ce(e,t).type;return(n===`avenue`||n===`street`||n===`intersection`)&&!f(e,t)},m=(e,t,r,i,a,o,s=[0,-1],c=.3,l=.01)=>{for(let d=r;d<i-2;){let r=Math.min(o*(.7+n()*.6),i-d);n()>c&&p(t,d+r/2)&&u(e,t,d+r/2,a,r/2,s,l),d+=r+n()*3}};for(let e=0;e<oe.length;e++){let t=oe[e];for(let r=0;r+1<N.length;r++){if(!he(e,r))continue;let i=N[r]+ue(r)+1.5,a=N[r+1]-ue(r+1)-1.5;if(a-i<10)continue;for(let e of[-1,1])for(let r=0;r<3;r++){let o=t+e*(.2+F.AV_LANE*r+F.AV_LANE/2)+(n()-.5)*.3;if(m(J.DRIP,o,i+2,a-2,r===2?.7:.8,11,[0,-1],r===2?.55:.3),r<2){for(let[e,t]of[[i+3,1],[a-3,-1]])if(n()<.75){let r=e+t*(1.5+n()*4);u(n()<.5?J.OIL_A:J.OIL_B,o+(n()-.5)*.4,r,.9+n()*.4,1.6+n()*.8)}}}for(let e of[-1,1]){let r=t+e*(F.AV_HALF-.4);m(J.GUTTER,r,i-1,a+1,.4,16,[0,e],.05,.0095);for(let r of[i+1.5,a-1.5])n()<.7&&u(J.GRATE,t+e*(F.AV_HALF-.35),r,.5,.35,[e,0],.011)}let o=2+Math.floor(n()*3);for(let e=0;e<o;e++){let r=t+(n()-.5)*16,o=i+4+n()*(a-i-8);p(r,o)&&(u(n()<.6?J.MH_A:J.MH_B,r,o,.48,.48,[Math.cos(e),Math.sin(e)],.0105),Ut.push([r,o]))}if(n()<.3){let e=t+(n()-.5)*12,r=i+6+n()*(a-i-12);p(e,r)&&u(J.PLATE,e,r,1.2,.8+n()*.6,[0,-1],.0105)}for(let e of[N[r]+ue(r)+2.3,N[r+1]-ue(r+1)-2.3])for(let r of[-1,1])for(let i=0;i<3;i++){if(n()<.3)continue;let a=t+r*(.2+F.AV_LANE*i+F.AV_LANE/2)+(n()-.5)*.4;p(a,e)&&u(J.DRIP,a,e,1.1+n()*.3,2.4,[0,-1],.013)}for(let e=0,r=1+Math.floor(n()*3);e<r;e++){let e=t+(n()-.5)*18,r=i+5+n()*(a-i-10);p(e,r)&&u(n()<.5?J.TAR_A:J.TAR_B,e,r,2+n()*2,3+n()*4,n()<.5?[0,-1]:[1,0])}}}for(let e=0;e<N.length;e++){let t=N[e];for(let r=0;r<2*oe.length+1;r+=2){let i=se(e,r);if(!i)continue;let[a,o]=i,s=a+1.5,c=o-1.5;if(!(c-s<12)){for(let r=s+2;r<c-2;){let i=Math.min(18*(.7+n()*.6),c-r);n()>.15&&p(r+i/2,t)&&u(J.DRIP,r+i/2,t+(n()-.5)*.4,1.1,i/2,[1,0]);for(let a of[-1,1])n()>.05&&p(r+i/2,t+a*(ue(e)-.4))&&u(J.GUTTER,r+i/2,t+a*(ue(e)-.4),.4,i/2,[-a,0],.0095);r+=i+n()*2}for(let[e,r]of[[s+2,1],[c-2,-1]])n()<.6&&u(n()<.5?J.OIL_A:J.OIL_B,e+r*(2+n()*4),t+(n()-.5),1.6+n()*.8,.9+n()*.3,[1,0]);if(n()<.8){let e=s+6+n()*(c-s-12),r=t+(n()-.5)*4;p(e,r)&&(u(n()<.5?J.MH_A:J.MH_B,e,r,.48,.48,[0,-1],.0105),Ut.push([e,r]))}if(n()<.35){let e=s+6+n()*(c-s-12);p(e,t)&&u(J.TAR_B,e,t+(n()-.5)*3,2.5,4,[1,0])}}}}for(let e=0;e<oe.length;e++)for(let t=0;t<N.length;t++){let r=oe[e],i=N[t];if(ce(r,i).type===`intersection`)for(let e=0,a=3+Math.floor(n()*4);e<a;e++){let e=r+(n()-.5)*(F.AV_HALF*1.6),a=i+(n()-.5)*(ue(t)*1.4);if(!p(e,a))continue;let o=1.6+n()*2.2,s=n()*6.28;u(n()<.6?J.BLOT:J.OIL_A,e,a,o,o*(.7+n()*.5),[Math.cos(s),Math.sin(s)],.0102)}}let h=F.CURB_H+.006,g=(e,t)=>ce(e,t).type===`sidewalk`;if(t)for(let e of t)for(let t of e.masses||[]){if(t.y0>.2)continue;let e=[[t.x0,t.z0,t.x0,t.z1,-1,0],[t.x1,t.z0,t.x1,t.z1,1,0],[t.x0,t.z0,t.x1,t.z0,0,-1],[t.x0,t.z1,t.x1,t.z1,0,1]];for(let[t,r,i,a,o,s]of e){let e=Math.hypot(i-t,a-r);if(e<2)continue;let c=Math.max(1,Math.round(e/12)),l=e/c,d=(i-t)/e,f=(a-r)/e;for(let e=0;e<c;e++){let i=t+d*l*(e+.5),a=r+f*l*(e+.5);g(i+o*.6,a+s*.6)&&(u(J.AO,i+o*.55,a+s*.55,.55,l/2+.02,[s,-o],h),n()<.18?u(J.STAIN,i+o*(1.2+n()*1.6),a+s*(1.2+n()*1.6),1.2,1.2,[d,f],h+.001):n()<.12&&u(J.BLOT,i+o*(1.5+n()*1.5),a+s*(1.5+n()*1.5),1.5,1.5,[d,f],h+.001))}}}let _=new C;_.setAttribute(`position`,new c(i,3)),_.setAttribute(`normal`,new c(new Float32Array(s*3).map((e,t)=>+(t%3==1)),3)),_.setAttribute(`uv`,new c(a,2)),_.setIndex(new r(o,1)),_.computeBoundingSphere();let v=new w({map:Ht(),transparent:!0,depthWrite:!1,roughness:.78,metalness:0,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-2}),b=new y(_,v);return b.name=`streetGrime`,b.receiveShadow=!0,b.renderOrder=0,e.add(b),b}function Gt(e){let t=[];if(!e)return t;for(let n of e){let e=n.lot;if(!e||!e.sides)continue;let r=(n.masses||[]).filter(e=>e.y0<.2);if(!r.length)continue;let i={x0:Math.min(...r.map(e=>e.x0)),x1:Math.max(...r.map(e=>e.x1)),z0:Math.min(...r.map(e=>e.z0)),z1:Math.max(...r.map(e=>e.z1))},a=[[`nx`,e.x0,e.z0,i.x0,e.z1,-1,0],[`px`,i.x1,e.z0,e.x1,e.z1,1,0],[`nz`,e.x0,e.z0,e.x1,i.z0,0,-1],[`pz`,e.x0,i.z1,e.x1,e.z1,0,1]];for(let[n,r,i,o,s,c,l]of a){if(e.sides[n]!==`street`)continue;let a=c?o-r:s-i,u=c?s-i:o-r;a<4.5||u<10||Math.abs((r+o)/2)<110&&(i+s)/2>-335&&(i+s)/2<10||t.push({x0:r,z0:i,x1:o,z1:s,nx:c,nz:l,W:a,L:u})}}return t}function Kt(){let e=1024,t=document.createElement(`canvas`);t.width=t.height=e;let n=t.getContext(`2d`),r=de(3131);n.fillStyle=`#6d6a64`,n.fillRect(0,0,e,e);let i=204.8;for(let t=0;t<10;t++)for(let a=-1;a<6;a++){let o=a*i+t%2*i/2,s=t*102.4,c=136+(r()-.5)*30,l=(r()-.5)*10,u=r()<.08?.78:1,d=(c+l)*u,f=(c+l*.4)*u,p=(c-l*.6-4)*u,m=e=>{n.fillStyle=`rgb(${d|0},${f|0},${p|0})`,n.fillRect(o+e+2,s+2,200.8,98.4)};m(0),m(e),m(-1024)}for(let t=0;t<26e3;t++){let t=r()<.5?40:220;n.fillStyle=`rgba(${t},${t},${t},${.05+r()*.08})`,n.fillRect(r()*e,r()*e,1+r()*1.5,1+r()*1.5)}for(let t=0;t<260;t++){n.fillStyle=`rgba(35,33,30,${.25+r()*.3})`;let t=1.5+r()*3;n.beginPath(),n.arc(r()*e,r()*e,t,0,7),n.fill()}for(let t=0;t<22;t++){let t=r()*e,i=r()*e,a=40+r()*140,o=n.createRadialGradient(t,i,2,t,i,a);o.addColorStop(0,`rgba(40,36,30,${.1+r()*.12})`),o.addColorStop(1,`rgba(40,36,30,0)`),n.fillStyle=o,n.fillRect(0,0,e,e)}let a=new o(t);return a.wrapS=a.wrapT=g,a.colorSpace=f,a.anisotropy=8,a}function qt({scene:e,strips:t}){if(!t.length)return null;let n=[],i=[],a=[],o=0,s=F.CURB_H+.004,l=[],u=(e,t)=>{if(t.x0>=e.x1||t.x1<=e.x0||t.z0>=e.z1||t.z1<=e.z0)return[e];let n=[];t.z0>e.z0&&n.push({x0:e.x0,x1:e.x1,z0:e.z0,z1:t.z0}),t.z1<e.z1&&n.push({x0:e.x0,x1:e.x1,z0:t.z1,z1:e.z1});let r=Math.max(e.z0,t.z0),i=Math.min(e.z1,t.z1);return t.x0>e.x0&&n.push({x0:e.x0,x1:t.x0,z0:r,z1:i}),t.x1<e.x1&&n.push({x0:t.x1,x1:e.x1,z0:r,z1:i}),n};for(let e of t){let t=[{x0:e.x0,x1:e.x1,z0:e.z0,z1:e.z1}];if(le)for(let e of l)t=t.flatMap(t=>u(t,e));l.push(e);let r=e.nx!==0;for(let e of t){if(e.x1-e.x0<.01||e.z1-e.z0<.01)continue;let t=[[e.x0,e.z1],[e.x1,e.z1],[e.x1,e.z0],[e.x0,e.z0]];for(let[e,a]of t)n.push(e,s,a),i.push(r?a/8:e/8,r?-e/8:-a/8);a.push(o,o+1,o+2,o,o+2,o+3),o+=4}}let d=new C;d.setAttribute(`position`,new c(n,3)),d.setAttribute(`normal`,new c(new Float32Array(o*3).map((e,t)=>+(t%3==1)),3)),d.setAttribute(`uv`,new c(i,2)),d.setIndex(new r(a,1)),d.computeBoundingSphere();let f=new w({map:Kt(),roughness:.86,metalness:0,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),p=new y(d,f);return p.name=`plazaPaving`,p.receiveShadow=!0,e.add(p),p}var Jt=`// flags shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`,Yt=`// rooftops shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`,Xt=`// roofplants shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`,Zt=_e(`nobatch`),Qt=_e(`nowarm`),$t=512,en=new E({colorWrite:!1,depthWrite:!1,depthTest:!1}),tn=e=>Object.keys(e.attributes).sort().map(t=>t+e.attributes[t].itemSize+(e.attributes[t].normalized?`n`:``)+e.attributes[t].array.constructor.name).join(`,`)+(e.index?`|i`:``);function nn(e,t,n,r){let i=new y(e,t);return i.name=n,i.castShadow=!!r.castShadow,i.receiveShadow=!!r.receiveShadow,r.smallCasters&&(i.userData.smallCasters=!0),r.renderOrder&&(i.renderOrder=r.renderOrder),i}function rn(e,n,r,i={},a=[]){let o=e.length,s=Array(o).fill(null),c=[],l=[],u=new Map;for(let t=0;t<o;t++){let n=e[t];if(!n)continue;let r=a[t]||[0,0],o=(Zt||i.merge===!1?`i`+t:Math.floor(r[0]/$t)+`,`+Math.floor(r[1]/$t))+`|`+(n.index?tn(n):`noindex`+t);u.has(o)||u.set(o,[]),u.get(o).push(t)}for(let a of u.values()){let o={tiles:a,sup:null,nVis:0};if(a.length===1){let t=a[0],u=nn(e[t],n,r+` `+t,i);s[t]={m:u,grp:o,vis:!0,sh:!0},l.push(u),e[t]=null,o.nVis=1,c.push(o);continue}let u=0,d=0;for(let t of a)u+=e[t].attributes.position.count,d+=e[t].index.count;let f=new C,p=e[a[0]];for(let[n,r]of Object.entries(p.attributes)){let i=new r.array.constructor(u*r.itemSize),o=0;for(let t of a){let r=e[t].attributes[n].array;i.set(r,o),o+=r.length}f.setAttribute(n,new t(i,r.itemSize,r.normalized))}let m=new(u>65535?Uint32Array:Uint16Array)(d),h=[],g=0,_=0;for(let t of a){let n=e[t],r=n.index.array;for(let e=0;e<r.length;e++)m[_+e]=r[e]+g;n.boundingSphere||n.computeBoundingSphere(),n.boundingBox||n.computeBoundingBox(),h.push([_,r.length,n.boundingSphere,n.boundingBox]),g+=n.attributes.position.count,_+=r.length,n.dispose(),e[t]=null}let v=new t(m,1);f.setIndex(v),f.computeBoundingSphere(),f.computeBoundingBox();let y=nn(f,n,r+` super`,i);y.visible=!1,l.push(y),o.sup=y,a.forEach((e,t)=>{let[a,c,u,d]=h[t],p=new C;for(let[e,t]of Object.entries(f.attributes))p.setAttribute(e,t);p.setIndex(v),p.setDrawRange(a,c),p.boundingSphere=u,p.boundingBox=d,p.userData.sharedRange=!0;let m=nn(p,n,r+` `+e,i);s[e]={m,grp:o,vis:!0,sh:!0},l.push(m)}),o.nVis=a.length,c.push(o)}let d=e=>{if(!e.sup){let t=s[e.tiles[0]];t.m.visible=t.vis,t.m.castShadow=t.sh&&!!i.castShadow;return}let t=!0,n=null,r=!0;for(let i of e.tiles){let e=s[i];if(!e.vis){t=!1;break}n===null?n=e.sh:e.sh!==n&&(r=!1)}let a=t&&r;e.sup.visible=a,e.sup.castShadow=a&&n&&!!i.castShadow;for(let t of e.tiles){let e=s[t];e.m.visible=!a&&e.vis,e.m.castShadow=e.sh&&!!i.castShadow}};for(let e of c)d(e);let f=new C;f.setDrawRange(0,0);let p=new y(f,en);return p.name=r+` upload`,p.frustumCulled=!1,p.visible=!1,l.push(p),{mesh:l[0]??null,meshes:l,warm(e){let t=s[e];if(!t||Qt)return!1;let n=t.m.geometry;if(t.wq||=[...Object.keys(n.attributes),n.index?`#index`:null].filter(Boolean),!t.wq.length)return!1;let r=t.wq.shift();for(let e of Object.keys(f.attributes))f.deleteAttribute(e);return f.setIndex(null),r===`#index`?(f.setAttribute(`position`,n.attributes.position),f.setIndex(n.index)):f.setAttribute(r===`position`?r:`position`,n.attributes[r]),p.visible=!0,!0},endWarm:()=>{p.visible=!1},has:e=>!!s[e],setVisible(e,t){let n=s[e];n&&n.vis!==t&&(n.vis=t,d(n.grp))},setShadow(e,t){let n=s[e];n&&n.sh!==t&&(n.sh=t,d(n.grp))}}}var an=`// signage shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`,{district:on,mulberry32:sn,streetsAt:cn,SITES:ln}=pe,Y=ne(()=>an),un=ge(`city/tex/`),dn=512,fn=typeof location<`u`?new URLSearchParams(location.search):new URLSearchParams,pn=fn.has(`nosignage`);function mn(e,t,n=[]){let r=Array.from({length:e},()=>[]);return(i,a,o=null)=>{let s=0,c=-1;for(let l=0;l<e;l++){if(o&&o(l)||n.includes(l))continue;let e=1e5;for(let t of r[l])e=Math.min(e,Math.hypot(t[0]-i,t[1]-a));e+=t()*40,e>c&&(c=e,s=l)}return r[s].push([i,a]),s}}function hn(e,t,n,r,i,a,o,s=o){let c=2/o,l=2/s;if(e+=c,n-=2*c,t+=l,r-=2*l,a>i){let e=i/a;t+=r*(1-e)/2,r*=e}else{let t=a/i;e+=n*(1-t)/2,n*=t}return[e,t,e+n,t+r]}var gn=(e,t)=>hn(e%8/8,1-(Math.floor(e/8)+1)/16,1/8,1/16,2,t,4096),_n=(e,t)=>hn(e%16/16,.5-(Math.floor(e/16)+1)/8,1/16,1/8,.5,t,4096),vn=(e,t)=>{let n=hn(e%4/4,1-(Math.floor(e/4)+1)/16,1/4,1/16,4,t,2048);return n[0]+=2,n[2]+=2,n},yn=(e,t,n,r,i)=>{let a=hn(e/2048,1-(t+r)/1792,n/2048,r/1792,4,i,2048,1792);return a[0]+=4,a[2]+=4,a},bn=(e,t)=>yn(e%2*1024,Math.floor(e/2)*256,1024,256,t),xn=(e,t)=>yn(e%4*512,1024+Math.floor(e/4)*128,512,128,t),Sn=(e,t)=>yn(e%4*512,1280+Math.floor(e/4)*128,512,128,t),Cn=[1,4,8,11,12,13,19,21,24,28,33,35,36,37,40,48,52,56,60,61,62,63],wn=[2,11,12,13,15,19,24,32,36,41,44,45,46,51,52,56,59,61],Tn=class{constructor(){this.p=[],this.n=[],this.uv=[],this.c=[],this.s=[],this.l=[],this.i=[],this.v=0}quad(e,t,n,r,i,a){for(let n of e)this.p.push(n[0],n[1],n[2]),this.n.push(t[0],t[1],t[2]),this.c.push(r[0],r[1],r[2]),this.s.push(i,a);n?this.uv.push(n[0],n[1],n[2],n[1],n[2],n[3],n[0],n[3]):this.uv.push(0,0,0,0,0,0,0,0),this.l.push(0,0,1,0,1,1,0,1),this.i.push(this.v,this.v+1,this.v+2,this.v,this.v+2,this.v+3),this.v+=4}build(){if(!this.v)return null;let e=new C;return e.setAttribute(`position`,new c(this.p,3)),e.setAttribute(`normal`,new c(this.n,3)),e.setAttribute(`uv`,new c(this.uv,2)),e.setAttribute(`color`,new c(this.c,3)),e.setAttribute(`aSig`,new c(this.s,2)),e.setAttribute(`aLoc`,new c(this.l,2)),e.setIndex(this.v>65535?new r(this.i,1):new h(this.i,1)),e.computeBoundingSphere(),e.computeBoundingBox(),e}},X=e=>[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255].map(e=>e**2.2);function En(e,t){switch(t){case`pz`:return{O:[e.x0,e.z1],T:[1,0],N:[0,1],W:e.x1-e.x0,s:t};case`nz`:return{O:[e.x1,e.z0],T:[-1,0],N:[0,-1],W:e.x1-e.x0,s:t};case`px`:return{O:[e.x1,e.z1],T:[0,-1],N:[1,0],W:e.z1-e.z0,s:t};default:return{O:[e.x0,e.z0],T:[0,1],N:[-1,0],W:e.z1-e.z0,s:t}}}var Z=(e,t,n,r)=>[e.O[0]+e.T[0]*t+e.N[0]*r,n,e.O[1]+e.T[1]*t+e.N[1]*r],Q=(e,t,n,r,i,a,o)=>{let s=Z(e,t,n,r),c=Z(e,i,a,o);return[Math.min(s[0],c[0]),n,Math.min(s[2],c[2]),Math.max(s[0],c[0]),a,Math.max(s[2],c[2])]};function Dn(e,t,n,r,i,a,o,s,c,l=null,u=0,d=0,f=63,p=0){let m=(e,n,r)=>Z(t,e,n,r),h=[t.T[0],0,t.T[1]],g=[t.N[0],0,t.N[1]],_=e=>e.map(e=>-e);f&1&&e.quad([m(n,i,s),m(r,i,s),m(r,a,s),m(n,a,s)],g,l,l?[1,1,1]:c,l?u:p,d),f&2&&e.quad([m(r,i,o),m(n,i,o),m(n,a,o),m(r,a,o)],_(g),null,c,p,0),f&4&&e.quad([m(r,i,s),m(r,i,o),m(r,a,o),m(r,a,s)],h,null,c,p,0),f&8&&e.quad([m(n,i,o),m(n,i,s),m(n,a,s),m(n,a,o)],_(h),null,c,p,0),f&16&&e.quad([m(n,a,s),m(r,a,s),m(r,a,o),m(n,a,o)],[0,1,0],null,c.map(e=>e*1.1),p,0),f&32&&e.quad([m(n,i,o),m(r,i,o),m(r,i,s),m(n,i,s)],[0,-1,0],null,c.map(e=>e*.6),p,0)}function $(e,t,n,r,i,a,o,s){let c=Q(t,n,i,o,r,a,s);e.box(c[0],c[1],c[2],c[3],c[4],c[5])}function On(e){let t=new l().load(e);return t.colorSpace=f,t.anisotropy=8,t}function kn(e,t,n,r,i){let a=new w({map:e,vertexColors:!0,roughness:.6,metalness:0,transparent:r,depthWrite:!r,polygonOffset:r,polygonOffsetFactor:r?-3:0,polygonOffsetUnits:r?-3:0});r&&Object.assign(a,{blending:5,blendEquation:100,blendSrc:204,blendDst:205,blendSrcAlpha:200,blendDstAlpha:201});let o={tSigns:{value:t},tNoiseS:{value:n},tArt:{value:i},uNightK:ie,uScreenK:A,uScrBoost:qe,uScrKnee:Qe,uScrTop:$e};return a.onBeforeCompile=e=>{Object.assign(e.uniforms,o),e.vertexShader=e.vertexShader.replace(`#include <common>`,Y.vertexCommon).replace(`#include <fog_vertex>`,Y.vertexFogVertex),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,Y.fragmentCommon).replace(`#include <map_fragment>`,Y.fragmentMap).replace(`#include <color_fragment>`,Y.fragmentColor).replace(`#include <roughnessmap_fragment>`,Y.fragmentRoughness).replace(`#include <metalnessmap_fragment>`,Y.fragmentMetalness).replace(`#include <emissivemap_fragment>`,re(Y.fragmentEmissive,`if (K == 3 || K == 4) sgE *= uScreenK * (K == 4 ? mix(1.0, 1.7, uNightK) : 1.0 + (uScrBoost - 1.0) * uNightK); /* (lighting2 r5) exposure-compensated at every preset (night) LED x uScrBoost at night */
`,`if (K == 6) sgE *= mix(1.0, 0.3, uNightK);
`))},a.customProgramCacheKey=()=>`city-signage-r5n2-`+(r?`g`:`o`),a}function An({scene:e,gen:t}){let n={roof:0,wall:0,ghost:0,blade:0,led:0,tris:0,meshes:0,at:{roof:[],wall:[],ghost:[],blade:[],led:[],marquee:[],canopy:[],letters:[],flag:[],awning:[],win:[]}};typeof window<`u`&&(window.__signStats=n);let r=(e,t,r,i)=>{let a=n.at[e];if(a.length<5e3){let e=Z(t,r,i,0);a.push([Math.round(e[0]),Math.round(i),Math.round(e[2]),t.N[0],t.N[1]])}};if(pn)return{update(){},stats:n};let a=t.solids,o=t.zips,s=sn(90210),c=We(),l=We(),u=mn(64,s),d=mn(64,s),f=mn(64,s),h=mn(8,s),_=new Map,v=(e,t)=>{let n=Math.floor(e/dn)+`,`+Math.floor(t/dn),r=_.get(n);return r||(r={op:new Tn,gh:new Tn,x0:Math.floor(e/dn)*dn,z0:Math.floor(t/dn)*dn},_.set(n,r)),r},x=new Map,S=(e,t,n,r,i,a)=>{for(let o=Math.floor(e/16);o<=Math.floor(r/16);o++)for(let s=Math.floor(n/16);s<=Math.floor(a/16);s++){let c=o*100003+s,l=x.get(c);l||x.set(c,l=[]),l.push(e,t,n,r,i,a)}};for(let e=0;e<a.t.length;e++){let t=e*6;(a.b[t+1]>=3||a.b[t+1]>=1.8&&a.b[t+4]>2.4)&&S(a.b[t],a.b[t+1],a.b[t+2],a.b[t+3],a.b[t+4],a.b[t+5])}let C=e=>{for(let t=Math.floor(e[0]/16);t<=Math.floor(e[3]/16);t++)for(let n=Math.floor(e[2]/16);n<=Math.floor(e[5]/16);n++){let r=x.get(t*100003+n);if(r){for(let t=0;t<r.length;t+=6)if(r[t+4]>e[1]+.05&&r[t+1]<e[4]&&e[3]>r[t]&&e[0]<r[t+3]&&e[5]>r[t+2]&&e[2]<r[t+5])return!0}}return!1},w=new Map;t.footprints.forEach((e,t)=>{for(let n=Math.floor(e.x0/32);n<=Math.floor(e.x1/32);n++)for(let r=Math.floor(e.z0/32);r<=Math.floor(e.z1/32);r++){let e=n*100003+r,i=w.get(e);i||w.set(e,i=[]),i.push(t)}});let T=(e,n,r,i,a)=>{let o=0,s=new Set;for(let c=Math.floor(e/32);c<=Math.floor(r/32);c++)for(let l=Math.floor(n/32);l<=Math.floor(i/32);l++)for(let u of w.get(c*100003+l)??[]){if(s.has(u))continue;s.add(u);let c=t.footprints[u];c!==a&&c.x1>e&&c.x0<r&&c.z1>n&&c.z0<i&&(o=Math.max(o,c.h))}return o},E=(e,t)=>{let n=`block`;for(let r of[3,6,10,15]){let i=Z(e,t,0,r),a=cn(i[0],i[2]);if(a.type===`avenue`)return`avenue`;a.type===`street`||a.type===`intersection`?n=`street`:a.type===`water`||a.type===`sidewalk`&&a.fill?n===`block`&&(n=`water`):a.type===`park`&&n===`block`&&(n=`park`)}return n},D=[ln.heraldSquare,ln.unionSquare].filter(Boolean).map(e=>[(e.x0+e.x1)/2,(e.z0+e.z1)/2]);for(let e of P??[])if(e?.kind===`broadway`&&Array.isArray(e.pts))for(let[t,n]of e.pts)(oe??[]).some(e=>Math.abs(e-t)<1)&&(me?.(t,n)??!0)&&D.push([t,n]);D.length||D.push([0,320],[430,1040]);let O=ln.timesSquare??{x0:1e6,x1:1e6,z0:1e6,z1:1e6},ee=e=>e.x1>O.x0-30&&e.x0<O.x1+30&&e.z1>O.z0-90&&e.z0<O.z1+10,te=e=>e.layer===j.RED||e.layer===j.BROWN||e.layer===j.BUFF,ne={[j.RED]:X(8014396),[j.BROWN]:X(6046264),[j.BUFF]:X(10257512)},re=[3948352,4869452,3027251,5591626,4015680].map(X),ie=e=>e.poly??e.lot?.poly??e.masses?.find(e=>e.y0<.1&&e.poly)?.poly??null,A=(e,t)=>{let n=on(e,t),r=Math.exp(-Math.hypot(e,t+160)/420),i=Math.max(0,...D.map(([n,r])=>Math.exp(-Math.hypot(e-n,t-r)/220)));return{d:n,dens:Math.min(1.6,.3+.55*(n.midtown??0)+.35*(n.village??0)+.9*r+.8*i-.2*(n.parkEdge??0)-.15*(n.harlem??0)-.35*(n.fidi??0))}},ae=(e,t,r,i=null)=>{if(!Array.isArray(e)||e.length<3||!t||t.type===`glass`||!((t.gH??0)>3.6)||!(r>(t.gH??0)+3))return;let a=0,o=0;for(let t of e)a+=t[0],o+=t[1];a/=e.length,o/=e.length;let{d:s,dens:c}=A(a,o);if(s.id===`park`)return;let l=sn(Math.floor(a*3.7)*73856093^Math.floor(o*2.9)*19349663^40465),u=v(a,o),d=t.gH,f=d-1.52,p=d-.6,m=Math.min(.92,.3+.45*c);for(let t=0;t<e.length;t++){let r=e[t],s=e[(t+1)%e.length],d=Math.hypot(s[0]-r[0],s[1]-r[1]);if(d<5||i&&i[t]!==`street`)continue;let h=[(s[0]-r[0])/d,(s[1]-r[1])/d],g=[h[1],-h[0]];g[0]*((r[0]+s[0])/2-a)+g[1]*((r[1]+s[1])/2-o)<0&&(g=[-g[0],-g[1]]);let _=Math.abs(-h[1]-g[0])<1e-6&&Math.abs(h[0]-g[1])<1e-6?{O:r,T:h,N:g,W:d}:{O:s,T:[-h[0],-h[1]],N:g,W:d},v=E(_,d/2);if(v!==`avenue`&&v!==`street`)continue;let y=Math.max(1,Math.floor(d/6.5+.5)),b=d/y;for(let e=0;e<y;e++){if(l()>m)continue;let t=e*b+.4,r=(e+1)*b-.4,i=[g[0],0,g[1]],a=X([1842463,2764600,3810336,2044710,6969914,2894896][Math.floor(l()*6)]);u.op.quad([Z(_,t,f,.012),Z(_,r,f,.012),Z(_,r,p,.012),Z(_,t,p,.012)],i,null,a,0,0);let o=Math.min(r-t-.16,(p-f-.12)*4.6),s=(t+r-o)/2;u.op.quad([Z(_,s,f+.06,.018),Z(_,s+o,f+.06,.018),Z(_,s+o,p-.06,.018),Z(_,s,p-.06,.018)],i,vn(Math.floor(l()*64),o/(p-f-.12)),[1,1,1],4,.3+.35*Math.min(1,c)*l()),n.front=(n.front??0)+1}}};for(let e of t.polyBuildings??[])ae(e.poly,e.A,e.H,Array.isArray(e.faces)?e.faces:null);let M=[3103290,8006186,2768234,10126424,3500650,9062954,5909066,3158064,6973994].map(X),se=(e,t,i,o,s,c,l=-1)=>{let u=1.15+c()*.35,d=.55,f=l>=0?.4:.3,p=M[Math.floor(c()*M.length)],m=c()<.3?Math.round((o-i)/.32):0,h=s-d,g=Math.hypot(u,d),_=[t.N[0]*d/g,u/g,t.N[1]*d/g],v=(e,n,r)=>Z(t,e,n,r);e.quad([v(i,h,u),v(o,h,u),v(o,s,.02),v(i,s,.02)],_,null,p,7,m),e.quad([v(i,s-.03,.02),v(o,s-.03,.02),v(o,h-.03,u-.02),v(i,h-.03,u-.02)],_.map(e=>-e),null,p.map(e=>e*.3),7,0),Dn(e,t,i,o,h-f,h,u-.02,u+.01,p,null,7,m,61,7);for(let[n,r]of[[i,-1],[o,1]]){let i=v(n,s,.02),a=v(n,h,u-.02),o=v(n,h-f*.2,.25),c=[t.T[0]*r,0,t.T[1]*r];e.quad([i,o,a,a],c,null,p.map(e=>e*.8),7,0),e.quad([i,a,o,o],c.map(e=>-e),null,p.map(e=>e*.8),7,0)}if(l>=0){let n=Math.min(o-i-.4,(f-.09)*4.6),r=(i+o-n)/2;e.quad([v(r,h-f+.05,u+.014),v(r+n,h-f+.05,u+.014),v(r+n,h-.04,u+.014),v(r,h-.04,u+.014)],[t.N[0],0,t.N[1]],vn(l,n/(f-.09)),[1,1,1],1,0)}let y=Q(t,i,0,0,o,0,u),b=t.N[0]===0?2:0,x=t.N[0]+t.N[1];a.ramp(y[0],h-.03,y[2],y[3],y[5],b,x>0?s:h,x>0?h:s,`awning`,1,.03),a.box(...Q(t,i,h-f,u-.02,o,h,u+.01),`awning`,1),S(...Q(t,i,h-f,0,o,s,u+.02)),n.awning=(n.awning??0)+1,r(`awning`,t,(i+o)/2,s)},ce=[...t.buildings].sort((e,t)=>(e.lot?.cx??0)-(t.lot?.cx??0)||(e.lot?.cz??0)-(t.lot?.cz??0));for(let e of ce){let{lot:i,A:s,masses:p}=e;if(i&&!i.reserved&&(ie(e)||i.angle||i.rot)){ie(e)&&ae(ie(e),s,e.H);continue}if(!i||!s||!p?.length||i.reserved||ee(i))continue;let g=i.cx??(i.x0+i.x1)/2,_=i.cz??(i.z0+i.z1)/2,y=on(g,_);if(y.id===`park`)continue;let b=sn(Math.floor(g*3.7)*73856093^Math.floor(_*2.9)*19349663^20903),x=Math.exp(-Math.hypot(g-0,_+160)/420),w=Math.max(...D.map(([e,t])=>Math.exp(-Math.hypot(g-e,_-t)/220))),O=Math.min(1.6,.3+.55*y.midtown+.35*y.village+.9*x+.8*w-.2*y.parkEdge-.15*y.harlem-.35*y.fidi),A=p.find(e=>e.y0<.1&&!e.round&&!e.crown);if(!A)continue;let j=s.type,M=j===`glass`,oe=(e,t)=>(t===`nx`?Math.abs(e.x0-i.x0)<.15:t===`px`?Math.abs(e.x1-i.x1)<.15:t===`nz`?Math.abs(e.z0-i.z0)<.15:Math.abs(e.z1-i.z1)<.15)?e.sides?.[t]??i.sides?.[t]??`street`:`inner`,ce=(e,t)=>p.some(n=>n!==e&&n.y1>t[1]+.2&&n.y0<t[4]&&n.x0<t[3]&&n.x1>t[0]&&n.z0<t[5]&&n.z1>t[2]),le=[`nx`,`px`,`nz`,`pz`].map(e=>({s:e,t:oe(A,e),fr:En(A,e)}));for(let e of le)e.t===`street`&&(e.view=E(e.fr,e.fr.W/2));let N=A.y1,ue=A.parapet??1,de=!p.some(e=>e!==A&&e.y0>A.y1-.5&&e.y0<A.y1+.5&&e.x0<=A.x0+.1&&e.x1>=A.x1-.1&&e.z0<=A.z0+.1&&e.z1>=A.z1-.1);if(!M&&N>8&&N<75&&de&&y.fidi<.55){let e=le.filter(e=>e.t===`street`&&e.fr.W>9).map(e=>({...e,w:e.view===`avenue`?.42:e.view===`water`?.4:e.view===`street`?.1:0})).filter(e=>e.w>0).sort((e,t)=>t.w-e.w)[0];if(e&&b()<e.w*O){let i=e.fr,s=e.view===`water`?4.6+b()*1.4:3.6+b()*1.6,l=Math.min(i.W-1.2,s*(2.05+b()*.45)),d=Math.max(.6,(i.W-l)*(.15+b()*.7)),f=d+l,p=-.7,m=-1.02,h=N+(ue+1.6+b()*3.2),y=h+s,x=Q(i,d-.2,N,-3.3,f+.2,y+.8,.6),w=Q(i,d-.2,N+ue+.35,-3.3,f+.2,y+.8,-.05);if(l>6.5&&!C(w)&&!ce(A,x)){let e=v(g,_),C=re[Math.floor(b()*re.length)],w=gn(u(g,_),l/s);Dn(e.op,i,d,f,h,y,m,p,C,w,1,0),c.rect(Z(i,(d+f)/2,(h+y)/2,-.6699999999999999),[i.N[0],0,i.N[1]],[i.T[0],0,i.T[1]],l,s,null,1,{uv:w,printed:!0}),Dn(e.op,i,d-.12,f+.12,y,y+.14,-1.06,-.6399999999999999,C.map(e=>e*.7),null,0,0,62),Dn(e.op,i,d-.12,f+.12,h-.16,h,-1.06,-.6399999999999999,C.map(e=>e*.7),null,0,0,62);for(let t of[d-.12,f])Dn(e.op,i,t,t+.12,h-.16,y+.14,-1.06,-.6399999999999999,C.map(e=>e*.75),null,0,0,61);a.box(...Q(i,d-.12,h-.16,-1.06,f+.12,y+.14,-.6399999999999999),`equipment`);let T=Math.max(2,Math.ceil(l/3.6)+1),E=t.tile(g,_).det;for(let t=0;t<T;t++){let n=d+.3+(l-.6-.26)*(t/(T-1));Dn(e.op,i,n,n+.26,N,y,-1.32,m,C,null,0,0,62),a.box(...Q(i,n,N,-1.32,n+.26,y,m),`pole`),E.setPart(xe.STEEL).setColor(C),$(E,i,n+.05,n+.21,N,h+s*.5,-3.22,-3.02),$(E,i,n+.07,n+.19,h+s*.5-.14,h+s*.5,-3.22,-1.32),$(E,i,n+.07,n+.19,N+.9,N+1.02,-3.22,-1.32),a.box(...Q(i,n+.05,N,-3.22,n+.21,h+s*.5,-3.02),`pole`)}E.setPart(xe.GRATE).setColor(5921882),$(E,i,d-.1,f+.1,h-.26,h-.2,p,.25),E.setPart(xe.STEEL).setColor(C),$(E,i,d-.1,f+.1,h-.34,h-.26,.15000000000000002,.25);for(let e=d;e<=f+.01;e+=l/Math.max(1,Math.round(l/2.4)))$(E,i,e-.03,e+.03,h-.34,h+.72,.18000000000000005,.24);$(E,i,d-.1,f+.1,h+.68,h+.74,.18000000000000005,.24),a.box(...Q(i,d-.1,h-.34,p,f+.1,h-.2,.25),`awning`,1),E.setPart(xe.PAINT).setColor(2763820);for(let e=d+1;e<f-.5;e+=3.2)$(E,i,e-.035,e+.035,y+.14,y+.62,-.92,-.85),$(E,i,e-.035,e+.035,y+.55,y+.62,-.92,.25),$(E,i,e-.16,e+.16,y+.44,y+.6,.050000000000000044,.3800000000000001);o.edge?.(...(()=>{let e=Z(i,d,0,-1.72/2),t=Z(i,f,0,-1.72/2);return[e[0],e[2],t[0],t[2]]})(),y+.14,i.N[0],i.N[1],`roofEdge`,5),S(...x),n.roof++,r(`roof`,i,(d+f)/2,h)}}}if(!M&&j!==`deco`&&e.H<110)for(let e of le){if(e.t!==`party`||e.fr.W<8)continue;let i=e.fr,o=Q(i,.3,0,.2,i.W-.3,1,1.2),l=T(o[0],o[2],o[3],o[5],null),p=Math.max(l+1.2,(s.gH??4)+1.5),m=A.y1-1.2;if(m-p<6.5)continue;let y=te(s)&&(j===`walkup`||j===`loft`||j===`apt`||j===`postwar`),x=.5*O+(y?.12:0);if(b()>x)continue;let S=y&&b()<.5,C=i.W-1.6,w=m-p,E=v(g,_);if(S){let e=Math.min(C,16+b()*6),t=e/4,a=Math.max(1,Math.min(3,Math.floor(w/(t*1.1)))),o=(i.W-e)/2,c=m-.6-b()*Math.max(0,w-a*t*1.1)*.5;for(let n=0;n<a&&c-t>p;n++){let r=b()<.6?bn(h(g+n*50,_),e/t):vn(f(g+n*50,_,e=>!Cn.includes(e)),e/t);E.op.quad([Z(i,o,c-t,.045),Z(i,o+e,c-t,.045),Z(i,o+e,c,.045),Z(i,o,c,.045)],[i.N[0],0,i.N[1]],r,ne[s.layer]??[.3,.25,.2],5,.42+b()*.2),c-=t*1.12}n.ghost++,r(`ghost`,i,i.W/2,m)}else{let e=w>C*.8,o,l;if(e?(l=Math.min(w,34),o=Math.min(C,l*.62),l=Math.min(l,o/.5)):(o=Math.min(C,26),l=Math.min(w,o/1.7),o=Math.min(o,l*2.3)),o<6||l<5)continue;let f=(i.W-o)*(.3+b()*.4),p=m-b()*(w-l)*.4,h=p-l,v=e?_n(d(g,_),o/l):gn(u(g,_),o/l);if(te(s)&&b()<.55)E.op.quad([Z(i,f,h,.05),Z(i,f+o,h,.05),Z(i,f+o,p,.05),Z(i,f,p,.05)],[i.N[0],0,i.N[1]],v,ne[s.layer]??[.3,.25,.2],2,0);else{let e=re[Math.floor(b()*re.length)],n=e.map(e=>e*.72),r=.32,s=.2;Dn(E.op,i,f,f+o,h,p,.02,.25,e,v,1,0,1),c.rect(Z(i,f+o/2,(h+p)/2,.28),[i.N[0],0,i.N[1]],[i.T[0],0,i.T[1]],o,l,null,1,{uv:v,printed:!0}),Dn(E.op,i,f-s,f+o+s,p,p+s,0,r,n,null,0,0,61),Dn(E.op,i,f-s,f+o+s,h-s,h,0,r,n,null,0,0,61),Dn(E.op,i,f-s,f,h,p,0,r,n,null,0,0,61),Dn(E.op,i,f+o,f+o+s,h,p,0,r,n,null,0,0,61),a.box(...Q(i,f-s,h-s,0,f+o+s,p+s,r),`wall`);let u=t.tile(g,_).det,d=h-s-.28,m=f-s,y=f+o+s;u.setPart(xe.GRATE).setColor(5592922),$(u,i,m,y,d,d+.06,.05,1),u.setPart(xe.STEEL).setColor(e),$(u,i,m,y,d-.1,d,.9,1),$(u,i,m,y,d+1,d+1.06,.93,.99);let x=Math.max(2,Math.round(o/2.6)+1);for(let e=0;e<x;e++){let t=m+.1+(y-m-.2)*e/(x-1);$(u,i,t-.03,t+.03,d,d+1,.93,.99),u.tube(Z(i,t,d-1.1,.02),Z(i,t,d-.04,.95),.04,4)}u.setPart(xe.PAINT).setColor(2763820);for(let e=f+1;e<f+o-.4;e+=3)u.tube(Z(i,e,d+1.03,.96),Z(i,e,d+1.55,1.45),.03,4),$(u,i,e-.17,e+.17,d+1.5,d+1.68,1.28,1.6);a.box(...Q(i,m,d-.1,0,y,d+.06,1),`awning`,1)}n.wall++,r(`wall`,i,f+o/2,h)}}if(!M&&(j===`loft`||j===`walkup`||j===`apt`)&&(s.gH??0)>3.5)for(let e of le){if(e.t!==`street`||e.fr.W<9||e.view!==`avenue`&&e.view!==`street`||b()>(e.view===`avenue`?.2:.11)*O)continue;let i=e.fr,o=.95+b()*.75*Math.min(1,O),c=o*4,u=s.gH+.9,d=u+c;if(d>A.y1-1.5)continue;let f=b()<.5?1.6+b()*1.2:i.W-1.6-b()*1.2,p=.3,m=p+o,h=v(g,_),y=wn[Math.floor(b()*wn.length)],x=[X(1842463),X(5905690),X(1911370),X(8022586)][Math.floor(b()*4)];Dn(h.op,i,f-.18,f+.18,u,d,p,m,x,null,0,0,61);let S=vn(y,c/o),C=.45+.4*Math.min(1,O),w=(e,t,n)=>Z(i,e,t,n),T=(e,t)=>{let n=t>0?m-.06:.36,r=t>0?.36:m-.06,a=u+.08,o=d-.08,s=[i.T[0]*t,0,i.T[1]*t],c=h.op,l=c.v;for(let t of[w(e,a,n),w(e,a,r),w(e,o,r),w(e,o,n)])c.p.push(t[0],t[1],t[2]),c.n.push(...s),c.c.push(1,1,1),c.s.push(4,C);c.uv.push(S[0],S[3],S[0],S[1],S[2],S[1],S[2],S[3]),c.l.push(0,0,1,0,1,1,0,1),c.i.push(l,l+1,l+2,l,l+2,l+3),c.v+=4};T(f+.185,1),T(f-.185,-1);{let e=[S[0]-2,S[1],S[2]-2,S[3]];for(let t of[1,-1])l.rect(Z(i,f+t*.2,(u+d)/2,(p+m)/2),[i.T[0]*t,0,i.T[1]*t],[i.N[0]*t,0,i.N[1]*t],o,c,null,1,{uv:e,whole:!0,gain:.7,range:10})}let E=Math.max(4,Math.round((c-.2)/.17));h.op.quad([w(f-.13,u+.1,m+.006),w(f+.13,u+.1,m+.006),w(f+.13,d-.1,m+.006),w(f-.13,d-.1,m+.006)],[i.N[0],0,i.N[1]],[0,0,2,E],x,6,.9+.5*Math.min(1,O)),Dn(h.op,i,f-.24,f+.24,d,d+.12,.25,m+.08,x.map(e=>e*.8),null,0,0,61);let D=t.tile(g,_).det;D.setPart(xe.STEEL).setColor(2763564);for(let e of[u+.35,d-.35])$(D,i,f-.04,f+.04,e-.06,e+.06,0,.38),$(D,i,f-.1,f+.1,e-.18,e+.18,0,.05),D.tube(Z(i,f,e-.9,.03),Z(i,f,e-.04,.35),.025,4);a.box(...Q(i,f-.19,u,0,f+.19,d,m),`equipment`,1),n.blade++,r(`blade`,i,f,u);break}let P=s.gH??0;if(!M&&P>4.2&&A.y1>14){let e=.5*Math.min(1,x*1.6)+.04*y.midtown+.03*w,i=le.find(e=>e.t===`street`&&(e.view===`street`||e.view===`avenue`)&&e.fr.W>12);if(i&&b()<e){let e=i.fr,o=Math.min(e.W-4,7+b()*5),s=2.6+b()*.8,l=1.3+b()*.5,u=1.5+b()*(e.W-o-3),d=u+o,f=Math.max(3.3,P-1.9),p=f+l;if(!C(Q(e,u-.1,f-.1,.6,d+.1,p+.2,s+.1))){let i=v(g,_).op,l=[12,42,53,21,31,15,48,12,42],h=x>.3?l[Math.floor(b()*l.length)]:[15,48,12,42][Math.floor(b()*4)],y=X([2761760,6967328,3807256,1711136][Math.floor(b()*4)]);Dn(i,e,u,d,f,p,.05,s,y,null,0,0,29);let C=(t,n,r)=>Z(e,t,n,r),w=[e.N[0],0,e.N[1]],T=[e.T[0],0,e.T[1]],E=T.map(e=>-e),D=f+.22,O=p-.22,k=O-D;i.quad([C(u+.25,D,s+.006),C(d-.25,D,s+.006),C(d-.25,O,s+.006),C(u+.25,O,s+.006)],w,vn(h,(o-.5)/k),[1,1,1],4,.9);let ee=vn(h,4);i.quad([C(d+.006,D,s-.25),C(d+.006,D,.3),C(d+.006,O,.3),C(d+.006,O,s-.25)],T,ee,[1,1,1],4,.9),i.quad([C(u-.006,D,.3),C(u-.006,D,s-.25),C(u-.006,O,s-.25),C(u-.006,O,.3)],E,ee,[1,1,1],4,.9);let te=.16;for(let[e,t]of[[f+.04,D-.04],[O+.04,p-.04]]){let n=Math.round((o-.1)/te),r=Math.round((s-.1)/te);i.quad([C(u+.05,e,s+.008),C(d-.05,e,s+.008),C(d-.05,t,s+.008),C(u+.05,t,s+.008)],w,[0,0,n,1],y,6,1.4),i.quad([C(d+.008,e,s-.05),C(d+.008,e,.1),C(d+.008,t,.1),C(d+.008,t,s-.05)],T,[0,0,r,1],y,6,1.4),i.quad([C(u-.008,e,.1),C(u-.008,e,s-.05),C(u-.008,t,s-.05),C(u-.008,t,.1)],E,[0,0,r,1],y,6,1.4)}let ne=Math.round(o/.45),re=Math.round(s/.45);i.quad([C(u,f-.002,.05),C(d,f-.002,.05),C(d,f-.002,s),C(u,f-.002,s)],[0,-1,0],[0,0,ne,re],y,6,1.1);let ie=t.tile(g,_).det;ie.setPart(xe.STEEL).setColor(2303013);for(let t of[u+.4,d-.4])$(ie,e,t-.03,t+.03,p+.02,p+.08+s*.6,0,.06),$(ie,e,t-.02,t+.02,p,p+.05,.05,s-.3);a.box(...Q(e,u,f,0,d,p,s),`awning`,1),S(...Q(e,u-.1,f-.1,0,d+.1,p+.2,s+.1)),c.point(Z(e,(u+d)/2,f-.5,s*.6),new m(1,.72,.42),10+2.5*o,12,.4),n.marquee=(n.marquee??0)+1,r(`marquee`,e,(u+d)/2,f)}}}if(P>3.4&&A.y1>14){let e=le.filter(e=>e.t===`street`&&(e.view===`avenue`||e.view===`street`||e.view===`park`)&&e.fr.W>14).sort((e,t)=>(t.view!==`street`)-(e.view!==`street`))[0];if(e){let i=e.fr,s=i.W*(.4+b()*.2),c=v(g,_),l=t.tile(g,_).det,u=M||j===`deco`||j===`postwar`,d=j===`apt`||j===`postwar`,f=!1;if(d&&b()<.6&&[`sidewalk`].includes(cn(...(e=>[e[0],e[2]])(Z(i,s,0,3.9))).type)){let e=2.3,t=3.5,o=2.95,u=3.3;if(!C(Q(i,s-e/2-.1,2.5,.1,s+e/2+.1,3.5999999999999996,3.6))){let d=X([2047275,5904927,1713472,2763306,3878434][Math.floor(b()*5)]);Dn(c.op,i,s-e/2,s+e/2,o,u,.02,t,d,null,7,0,61,7);let p=1.196;c.op.quad([Z(i,s-p/2,2.99,3.512),Z(i,s+p/2,2.99,3.512),Z(i,s+p/2,3.25,3.512),Z(i,s-p/2,3.25,3.512)],[i.N[0],0,i.N[1]],vn([15,48,10,36,35,60,63][Math.floor(b()*7)],p/.26),X(13215840),8,0),l.setPart(xe.GALV).setColor(12098138);for(let t of[-1,1])l.tube(Z(i,s+t*(e/2-.12),0,3.35),Z(i,s+t*(e/2-.12),o,3.35),.035,6),a.box(...Q(i,s+t*(e/2-.12)-.04,0,3.31,s+t*(e/2-.12)+.04,o,3.39),`pole`);a.box(...Q(i,s-e/2,o,0,s+e/2,u,t),`awning`,1),S(...Q(i,s-e/2,0,0,s+e/2,u,t)),f=!0,n.canopy=(n.canopy??0)+1,r(`canopy`,i,s,o)}}if(!f&&(u||d)&&b()<.55+.3*y.fidi){let e=.36+b()*.16,t=Math.min(i.W-2,e*4.3),a=P-.45,o=a-e;o>2.4&&!C(Q(i,s-t/2,o,0,s+t/2,a,.3))&&(c.op.quad([Z(i,s-t/2,o,.035),Z(i,s+t/2,o,.035),Z(i,s+t/2,a,.035),Z(i,s-t/2,a,.035)],[i.N[0],0,i.N[1]],vn([10,36,35,15,48,60,63,41][Math.floor(b()*8)],t/e),X(b()<.6?13215840:13158596),8,0),S(...Q(i,s-t/2,o,0,s+t/2,a,.1)),n.letters=(n.letters??0)+1,r(`letters`,i,s,o))}if(u&&e.view!==`street`&&b()<.3+.35*Math.min(1,O)){let e=P+1.5;for(let a of[-2.4,2.4]){let c=s+a;if(c<1||c>i.W-1||C(Q(i,c-.4,e-1.4,0,c+.4,e+1.9,2.7)))continue;let u=Z(i,c,e,0),d=Z(i,c,e+1.8,2.6);l.setPart(xe.GALV).setColor(13218426),l.tube(u,d,.035,6),(t.buildings.flags??=[]).push({top:new k(...d),base:new k(...u),N:[i.N[0],0,i.N[1]],T:[i.T[0],0,i.T[1]],color:Math.floor(b()*4)}),o.add?.(d[0],d[1]+.035,d[2],0,1,0,`pole`),S(...Q(i,c-.3,e-1.4,0,c+.3,e+1.9,2.7)),n.flag=(n.flag??0)+1,r(`flag`,i,c,e)}}}}if(!M&&P>3.6&&j!==`deco`&&A.y1>P+3){let e=Math.min(.92,.3+.45*O);for(let t of le){if(t.t!==`street`||t.view!==`avenue`&&t.view!==`street`||t.fr.W<5)continue;let r=t.fr,i=Math.max(1,Math.floor(r.W/6.5+.5)),o=r.W/i,s=P-.6,c=s-(.72+b()*.36),l=v(g,_),u=b()<.35,d=Math.floor(b()*64),f=X([1842463,2764600,3810336,2044710,6969914,2894896][Math.floor(b()*6)]);for(let t=0;t<i;t++){let i=t*o+.38,p=(t+1)*o-.38;if(!u&&b()>e){let e=Math.min(P-.6,Math.max(P-1.5,3.6));e-.95>=2.63&&b()<.5*Math.min(1,O)+.12&&!C(Q(r,i,2.4,.1,p,e+.1,1.8))&&se(l.op,r,i,p,e,b,Math.floor(b()*64));continue}let m=.16+b()*.1;if(C(Q(r,i,c,0,p,s,m+.05))||C(Q(r,i,3,.2,p,s,1.6))){u=!1;continue}let h=u?f:X([1842463,2764600,3810336,2044710,6969914,2894896,4857374,2109514][Math.floor(b()*8)]);Dn(l.op,r,i,p,c,s,.02,m,h,null,0,0,61);let g=Math.min(p-i-.16,(s-c-.12)*4.6),_=(i+p-g)/2,v=u?d:Math.floor(b()*64),y=!u&&b()<.22?xn(Math.floor(b()*8),g/(s-c-.12)):vn(v,g/(s-c-.12)),x=.3+.35*Math.min(1,O)*b();l.op.quad([Z(r,_,c+.06,m+.004),Z(r,_+g,c+.06,m+.004),Z(r,_+g,s-.06,m+.004),Z(r,_,s-.06,m+.004)],[r.N[0],0,r.N[1]],y,[1,1,1],4,x),a.box(...Q(r,i,c,0,p,s,m),`equipment`,1),S(...Q(r,i,c,0,p,s,m)),n.front=(n.front??0)+1,c-.06-.85>=2.63&&b()<.35*Math.min(1,O)+.08&&!C(Q(r,i,2.4,.1,p,c-.1,1.8))&&se(l.op,r,i,p,c-.06,b)}}}if(!M&&j!==`deco`&&P>3.4){let e=A.p??s,t=e.floorH??3.3,i=e.margin??.6,a=Math.floor((A.y1+(A.parapet??0)-P)/t+.01);if((e.style??0)<1.5&&A.y1>P+t+1){let o=Math.min(.75,.2+.45*Math.min(1,O));for(let s of le){if(s.t!==`street`||s.view!==`avenue`&&s.view!==`street`||b()>o)continue;let c=s.fr,l=c.W-2*i;if(l<2.5)continue;let u=Math.max(1,Math.floor(l/(e.bayW??2.4)+.5)),d=l/u;if(a<5&&d>2.15)continue;let f=d*(e.winW??.5),p=t*(e.winH??.55),m=(t-p)*.42;a>=5&&(p=Math.min(t-.5,p*1.14),m=(t-p)*.5);let h=Math.min(f*.96,1.7),y=h/4,x=P+m+p*(.42+b()*.2);if(h<.5||y>p*.5)continue;let S=Math.floor(b()*16),w=Math.min(u,1+Math.floor(b()*3)),T=Math.floor(b()*(u-w+1)),E=v(g,_);for(let e=0;e<w;e++){let t=i+(T+e+.5)*d;C(Q(c,t-h/2,x-y/2,0,t+h/2,x+y/2,.06))||(E.op.quad([Z(c,t-h/2,x-y/2,.014),Z(c,t+h/2,x-y/2,.014),Z(c,t+h/2,x+y/2,.014),Z(c,t-h/2,x+y/2,.014)],[c.N[0],0,c.N[1]],Sn(S,h/y),[1,1,1],9,0),n.winLetters=(n.winLetters??0)+1,r(`win`,c,t,x))}}}}let fe=le.filter(e=>e.t===`street`&&(e.view===`avenue`||e.view===`street`)).length>=2,pe=.55*w*w+.02*y.midtown+.04*x+.025*y.fidi;if(fe&&N>18&&b()<pe){let e=le.filter(e=>e.t===`street`&&(e.view===`avenue`||e.view===`street`)&&e.fr.W>12).sort((e,t)=>(t.view===`avenue`)-(e.view===`avenue`)).slice(0,w>.45?2:1);for(let t of e){let e=t.fr,i=Math.min(e.W*.45,9+b()*7),o=Math.min(N-(s.gH??5)-3,i*(.45+b()*.35));if(o<4)continue;let l=[`nx`,`px`,`nz`,`pz`].indexOf(t.s),f=le.filter(e=>e.t===`street`&&e!==t&&[`nx`,`px`,`nz`,`pz`].indexOf(e.s)>>1!=l>>1)[0],p=b()<.5;if(f){let t=Z(e,e.W,0,0),n=f.fr;p=Math.abs(n.N[0]?t[0]-n.O[0]:t[2]-n.O[1])<.5}let m=p?e.W-i-.4:.4,h=(s.gH??5)+1.2,y=h+o,x=v(g,_),S=i/o>1.1,C=S?u(g,_):d(g,_),w=S?gn(C,i/o):_n(C,i/o),T=(S?we:Te)[C]??[.15,.15,.15],E=.2126*T[0]+.7152*T[1]+.0722*T[2],D=1.35*Math.min(1.4,Math.max(.5,(.15/(E+.02))**.5));Dn(x.op,e,m-.18,m+i+.18,h-.18,y+.18,.02,.42,X(1710877),null,0,0,62),Dn(x.op,e,m,m+i,h,y,.42,.45,X(1710877),w,3,D,1),a.box(...Q(e,m-.18,h-.18,0,m+i+.18,y+.18,.45),`equipment`,1),c.rect(Z(e,m+i/2,(h+y)/2,.4),[e.N[0],0,e.N[1]],[e.T[0],0,e.T[1]],i,o,T,1,{uv:w,gain:1.8}),n.led++,r(`led`,e,m+i/2,h)}}}for(let e of t.roofSignPanels??[]){let t=En(e.alx?{x0:e.a0,x1:e.a1,z0:e.plane,z1:e.plane}:{x0:e.plane,x1:e.plane,z0:e.a0,z1:e.a1},e.k),r=e.a1-e.a0,i=e.y1-e.y0,a=Z(t,r/2,0,0),o=v(a[0],a[2]),s=gn(u(a[0],a[2]),r/i);o.op.quad([Z(t,0,e.y0,0),Z(t,r,e.y0,0),Z(t,r,e.y1,0),Z(t,0,e.y1,0)],[t.N[0],0,t.N[1]],s,[1,1,1],1,0),c.rect(Z(t,r/2,(e.y0+e.y1)/2,.03),[t.N[0],0,t.N[1]],[t.T[0],0,t.T[1]],r,i,null,1,{uv:s,printed:!0}),n.roofPanel=(n.roofPanel??0)+1}t.textures;let le=kn(Ce(),ve(),(()=>{let e=new Uint8Array(65536),t=sn(7),n=Array.from({length:768},()=>t()),r=e=>e*e*(3-2*e);for(let t=0;t<128;t++)for(let i=0;i<128;i++)for(let a=0;a<3;a++){let o=0,s=.5,c=1;for(let e=0;e<3;e++){let e=4*c,l=i/128*e,u=t/128*e,d=Math.floor(l),f=Math.floor(u),p=r(l-d),m=r(u-f),h=(t,r)=>n[((t%e+e)%e*16+(r%e+e)%e)%256*3+a];o+=s*((h(d,f)*(1-p)+h(d+1,f)*p)*(1-m)+(h(d,f+1)*(1-p)+h(d+1,f+1)*p)*m),s*=.5,c*=2}e[(t*128+i)*4+a]=Math.round(255*Math.min(1,o/.875)),e[(t*128+i)*4+3]=255}let a=new b(e,128,128);return a.wrapS=a.wrapT=g,a.magFilter=p,a.minFilter=i,a.generateMipmaps=!0,a.needsUpdate=!0,a})(),!1,On(un+`city_signart.webp`)),N=[];for(let t of _.values()){let r=t.op.build(),i=t.gh.build(),a={x0:t.x0,z0:t.z0,op:null,gh:null};if(r){let t=new y(r,le);t.name=`signage`,t.castShadow=!0,t.receiveShadow=!0,t.userData.smallCasters=!0,t.userData.maxCascade=2,e.add(t),a.op=t,n.tris+=r.index.count/3}if(i){let t=new y(i,null);t.name=`signageGhost`,t.castShadow=!1,t.receiveShadow=!0,t.renderOrder=1,e.add(t),a.gh=t,n.tris+=i.index.count/3}(a.op||a.gh)&&N.push(a)}if(n.meshes=N.reduce((e,t)=>e+!!t.op+!!t.gh,0),n.lights=c.commit(`signage`),n.bladeLights=l.commit(`signBlades`,{grid:Se(),mergeA:0}),console.log(`[signage] ${n.roof} rooftop billboards (+${n.roofPanel??0} roof-kit ad faces), ${n.front??0} shop fascias, ${n.marquee??0} marquees, ${n.wall} wall ads, ${n.ghost} ghost signs, ${n.blade} blade signs, ${n.led} LED screens, ${n.awning??0} awnings, ${n.canopy??0} canopies, ${n.letters??0} lobby letters, ${n.winLetters??0} window letterings, ${n.flag??0} flags | ${N.length} cells, ${n.meshes} meshes, ${(n.tris/1e3).toFixed(1)}k tris`),fn.has(`signdbg`)){let[e,t,r]=(fn.get(`signdbg`)||`0,0,900`).split(`,`).map(Number);for(let i in n.at)console.log(`[signage-at] `+i+` `+JSON.stringify(n.at[i].filter(n=>Math.hypot(n[0]-e,n[2]-t)<r).slice(0,40)))}return typeof window<`u`&&(window.__signage=n),{stats:n,update(e){for(let t of N){let n=Math.max(0,t.x0-e.x,e.x-(t.x0+dn)),r=Math.max(0,t.z0-e.z,e.z-(t.z0+dn)),i=Math.hypot(n,r);t.op&&(t.op.visible=i<850,t.op.castShadow=i<120),t.gh&&(t.gh.visible=i<520)}}}}var jn=`// neon shader sections. Use parseShaderSections() to select an injection chunk.\r
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
`;export{We as C,Ee as D,De as E,kt as S,Pe as T,At as _,Yt as a,at as b,qt as c,Gt as d,zt as f,jt as g,Rt as h,Xt as i,Vt as l,Ft as m,An as n,Jt as o,Pt as p,rn as r,Ut as s,jn as t,Wt as u,Dt as v,Fe as w,Ot as x,lt as y};
//# sourceMappingURL=world~index-Cjr1W_GQ.js.map