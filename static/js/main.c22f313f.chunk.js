(this["webpackJsonpdroste-creator"]=this["webpackJsonpdroste-creator"]||[]).push([[0],{30:function(e,t,n){},32:function(e,t,n){"use strict";n.r(t);var r=n(0),a=n(6),o=n.n(a),c=n(3),s=n(4),i=n.n(s);function l(e){return[e[4]*e[8]-e[5]*e[7],e[2]*e[7]-e[1]*e[8],e[1]*e[5]-e[2]*e[4],e[5]*e[6]-e[3]*e[8],e[0]*e[8]-e[2]*e[6],e[2]*e[3]-e[0]*e[5],e[3]*e[7]-e[4]*e[6],e[1]*e[6]-e[0]*e[7],e[0]*e[4]-e[1]*e[3]]}function d(e,t){for(var n=Array(9),r=0;3!=r;++r)for(var a=0;3!=a;++a){for(var o=0,c=0;3!=c;++c)o+=e[3*r+c]*t[3*c+a];n[3*r+a]=o}return n}function j(e,t){return[e[0]*t[0]+e[1]*t[1]+e[2]*t[2],e[3]*t[0]+e[4]*t[1]+e[5]*t[2],e[6]*t[0]+e[7]*t[1]+e[8]*t[2]]}function h(e,t,n,r,a,o,c,s){var i=[e,n,a,t,r,o,1,1,1],h=j(l(i),[c,s,1]);return d(i,[h[0],0,0,0,h[1],0,0,0,h[2]])}function x(e,t,n,r,a,o,c,s,i,j){var x=function(e,t,n,r,a,o,c,s,i,j,x,u,b,p,m,f){var O=h(e,t,a,o,i,j,b,p);return d(h(n,r,c,s,x,u,m,f),l(O))}(0,0,n,r,e,0,a,o,0,t,c,s,e,t,i,j);for(let l=0;9!=l;++l)x[l]=x[l]/x[8];return[x[0],x[3],0,x[6],x[1],x[4],0,x[7],0,0,1,0,x[2],x[5],0,x[8]]}n(30);var u=n(1);function b({distance:e,angle:t}){return{x:e*Math.cos(t),y:e*Math.sin(t)}}function p({x:e,y:t}){return{distance:Math.sqrt(Math.pow(e,2)+Math.pow(t,2)),angle:Math.atan2(t,e)}}window.GLOBAL_ANIMATION="OFF";const m=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],f={OFF:"Off",IN:"In",OUT:"Out"};function O({label:e,value:t,options:n,onChange:a,disabled:o=!1}){const[s,i]=Object(r.useState)(!1),l=Object(r.useRef)();return((e,t)=>{const n=n=>{e.current&&!e.current.contains(n.target)&&t()};Object(r.useEffect)((()=>(document.addEventListener("click",n),()=>{document.removeEventListener("click",n)})))})(l,(()=>{i(!1)})),Object(u.jsxs)("div",{className:"dropdown ".concat(s?"":"-hide"," ").concat(o?"-disabled":""),ref:l,onClick:()=>{i(!o&&!s)},children:[Object(u.jsxs)(c.e,{className:"dropdown-header",children:[e," ",Object(u.jsx)("strong",{children:n[t]})]}),Object(u.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:Object(u.jsx)("polyline",{points:"6 9 12 15 18 9"})}),Object(u.jsx)("div",{className:"dropdown-options",children:Object.keys(n).map((e=>Object(u.jsx)("div",{className:"dropdown-option",onClick:()=>{a(e),i(!1)},children:Object(u.jsx)(c.e,{children:n[e]})},e)))})]})}function g(){console.info(">>"),document.querySelector(".jb-file-uploader").click()}const y={Flor:{src:"/droste-creator/flor.jpg",ratio:1,example:[.852,.001,1.1312,.6366,-.073,.28,.148,.999],deep:40},"Tokyo 1":{src:"/droste-creator/tokyo1.jpg",ratio:3/4,example:[.15,.2,.85,.2,.15,.9,.85,.9],deep:32},"Tokyo 2":{src:"/droste-creator/tokyo2.jpg",ratio:3/4,example:[.15,.2,.85,.2,.15,.9,.85,.9],deep:32},"Tokyo 3":{src:"/droste-creator/tokyo3.jpg",ratio:3/4,example:[.15,.2,.85,.2,.15,.9,.85,.9],deep:32},Stars:{src:"/droste-creator/stars.jpg",ratio:3/4,example:[.15,.2,.85,.2,.15,.9,.85,.9],deep:32},Dotomblurry:{src:"/droste-creator/dotomblurry.jpg",ratio:3/4,example:[.15,.12,.85,.12,.15,.87,.85,.87],deep:32}};var w=function(){const[e,t]=Object(r.useState)(y[Object.keys(y)[Math.floor(Math.random()*Object.keys(y).length)]]),n=Math.min(window.innerHeight-64,window.innerWidth/e.ratio),a=n*e.ratio,o=n,[s,l]=Object(r.useState)(!1),[d,j]=Object(r.useState)("handleDrag"),[h,w]=Object(r.useState)(e.deep||32),v=window.innerWidth-a>300,k=!!v||s,[N,A]=Object(r.useState)("OFF"),[M,L]=Object(r.useState)([{x:a*e.example[0],y:o*e.example[1]},{x:a*e.example[2],y:o*e.example[3]},{x:a*e.example[4],y:o*e.example[5]},{x:a*e.example[6],y:o*e.example[7]}]);Object(r.useEffect)((()=>{const n=Math.min(window.innerHeight-64,window.innerWidth/e.ratio),r=n*e.ratio,a=n;t(e),w(e.deep||32),L([{x:r*e.example[0],y:a*e.example[1]},{x:r*e.example[2],y:a*e.example[3]},{x:r*e.example[4],y:a*e.example[5]},{x:r*e.example[6],y:a*e.example[7]}])}),[e]);const D={handleDrag:function({x:e,y:t},n){L((r=>{const a=[...r];return a[n]={x:e,y:t},a}))},handleDragMirror:function({x:e,y:t},n){L((r=>{const c=[...r];return c[n]={x:e,y:t},c[function(e){return 0===e?3:1===e?2:2===e?1:3===e?0:void 0}(n)]={x:a-e,y:o-t},c}))},handleDragLockAspect:function({x:e,y:t},n){L((r=>{const c=[...r];c[n]={x:e,y:t};const s=c[0],i=p({x:c[3].x-s.x,y:c[3].y-s.y}),l=p({x:a,y:0}),d=p({x:0,y:o}),j=p({x:a,y:o}),h=Math.sqrt(a*a+o*o),x=Math.sqrt(Math.pow(c[3].x-s.x,2)+Math.pow(c[3].y-s.y,2)),u={distance:x/h*a,angle:i.angle+l.angle-j.angle};c[1]={x:s.x+b(u).x,y:s.y+b(u).y};const m={distance:x/h*o,angle:i.angle+d.angle-j.angle};return c[2]={x:s.x+b(m).x,y:s.y+b(m).y},c}))}},C=x(a,o,M[0].x-0*a,M[0].y-0*o,M[1].x-0*a,M[1].y-0*o,M[2].x-0*a,M[2].y-0*o,M[3].x-0*a,M[3].y-0*o),I=function(e){const[t,n,r,a,o,c,s,i,l,d,j,h,x,u,b,p]=e,m=[[t,n,r,a],[o,c,s,i],[l,d,j,h],[x,u,b,p]];for(var f,O=m.length,g=[],y=0;y<O;y++)g[y]=[];for(y=0;y<O;y++)for(var w=0;w<O;w++)g[y][w]=0,y==w&&(g[y][w]=1);for(var v=0;v<O;v++){for(f=m[v][v],w=0;w<O;w++)m[v][w]/=f,g[v][w]/=f;for(y=v+1;y<O;y++)for(f=m[y][v],w=0;w<O;w++)m[y][w]-=m[v][w]*f,g[y][w]-=g[v][w]*f}for(v=O-1;v>0;v--)for(y=v-1;y>=0;y--)for(f=m[y][v],w=0;w<O;w++)m[y][w]-=m[v][w]*f,g[y][w]-=g[v][w]*f;for(y=0;y<O;y++)for(w=0;w<O;w++)m[y][w]=g[y][w];return m}(C).flat();function F(e){const[t,n,r,a,o,c,s,i,l,d,j,h,x,u,b,p]=e;return[t,o,x,n,c,u,a,i,p]}function T(e,t){const n=F(e),r=F(t);return[(a=function(e,t){for(var n=Array(9),r=0;3!=r;++r)for(var a=0;3!=a;++a){for(var o=0,c=0;3!=c;++c)o+=e[3*r+c]*t[3*c+a];n[3*r+a]=o}return n}(n,r))[0],a[3],0,a[6],a[1],a[4],0,a[7],0,0,1,0,a[2],a[5],0,a[8]];var a}const S=[m];for(let r=1;r<h;r++)S.push(T(S[r-1],C.flat()));return Object(r.useEffect)((()=>{window.GLOBAL_ANIMATION=N}),[N]),Object(r.useEffect)((()=>{const e=document.querySelector(".main-animatable");let t=0;!function n(){"OUT"===window.GLOBAL_ANIMATION?(t+=.009,t>1&&(t-=1)):"IN"===window.GLOBAL_ANIMATION&&(t-=.009,t<0&&(t+=1));const r=I.map(((e,n)=>e*t+m[n]*(1-t))),a="matrix3d(".concat(r.join(","),")");if(e.style.transform=a,"OFF"!==window.GLOBAL_ANIMATION)window.requestAnimationFrame(n);else{const t="matrix3d(".concat(m.join(","),")");e.style.transform=t}}()}),[I,N]),Object(u.jsxs)(r.Fragment,{children:[Object(u.jsxs)("div",{className:"main",onClick:()=>{l(!1)},children:[Object(u.jsx)(c.c,{accent:"#e74c3c"}),Object(u.jsx)("div",{className:"img image-container-cut",style:{height:o,width:a,overflow:"hidden"},children:Object(u.jsx)("div",{className:"main-animatable image-container -transformable",children:S.map(((t,n)=>Object(u.jsx)("img",{alt:"",className:"img -transformed -transformable",style:{width:a,height:o,transform:"matrix3d(".concat(t.join(","),")")},src:e.src},n)))})}),Object(u.jsx)(i.a,{defaultPosition:M[0],position:M[0],onDrag:(e,t)=>D[d](t,0),children:Object(u.jsx)("button",{className:"point",children:"0"})}),"handleDragLockAspect"!==d&&Object(u.jsx)(i.a,{defaultPosition:M[1],position:M[1],onDrag:(e,t)=>D[d](t,1),children:Object(u.jsx)("button",{className:"point",children:"1"})}),"handleDragLockAspect"!==d&&Object(u.jsx)(i.a,{defaultPosition:M[2],position:M[2],onDrag:(e,t)=>D[d](t,2),children:Object(u.jsx)("button",{className:"point",children:"2"})}),Object(u.jsx)(i.a,{defaultPosition:M[3],position:M[3],onDrag:(e,t)=>D[d](t,3),children:Object(u.jsx)("button",{className:"point",children:"3"})})]}),Object(u.jsxs)("div",{className:"sidebar ".concat(k?"":"-hide"),children:[Object(u.jsx)("div",{className:"sidebar-element",children:Object(u.jsx)(O,{label:"Controls",value:d,options:{handleDrag:"Free",handleDragMirror:"Mirror",handleDragLockAspect:"Aspect Lock"},onChange:j})}),Object(u.jsx)("div",{className:"sidebar-element",children:Object(u.jsx)(O,{label:"Depth",value:h,options:{8:8,16:16,32:32,72:72,128:128,256:"256 \u26a0\ufe0f"},onChange:e=>w(Number(e))})}),Object(u.jsx)("div",{className:"sidebar-element",children:Object(u.jsx)(O,{label:"Animation",value:N,options:f,onChange:A})}),Object(u.jsx)("hr",{}),Object(u.jsx)("div",{className:"sidebar-element",children:Object(u.jsx)(O,{label:"Load Example",value:null,options:Object.keys(y),onChange:e=>{const n=y[Object.keys(y)[e]];t(n)}})}),Object(u.jsx)("div",{className:"sidebar-element",children:Object(u.jsxs)(c.e,{children:["Droste Creator is a tool to create recursive images. Source"," ",Object(u.jsx)(c.a,{href:"https://github.com/javierbyte/droste-creator",children:"Github"}),". Code and pictures by ",Object(u.jsx)(c.a,{href:"https://javier.xyz",children:"javierbyte"}),"."]})}),!1]}),Object(u.jsxs)("div",{className:"topnav",children:[Object(u.jsxs)(c.e,{style:{flex:1,display:"flex",flexWrap:"wrap"},children:[Object(u.jsx)("div",{children:"Droste"}),Object(u.jsx)("strong",{children:"Creator"})]}),Object(u.jsx)("div",{style:{flex:1}}),Object(u.jsx)(c.b,{onClick:g,children:"New Picture"}),Object(u.jsx)("input",{className:"jb-file-uploader",type:"file",onChange:function(e){e.stopPropagation(),e.preventDefault();const n=e.dataTransfer,r=(n?n.files:e.target.files)[0],a=new window.FileReader;a.onload=async e=>{const n=e.currentTarget.result,[r,a]=await async function(e,t=529984){return new Promise((n=>{let r=new Image;r.src=e,r.onload=()=>{let e=document.createElement("canvas");const a=r.width,o=r.height;let c=r.width,s=r.height;for(;c*s>t;)c/=Math.sqrt(2,2),s/=Math.sqrt(2,2);c=Math.round(c),s=Math.round(s),e.width=c,e.height=s,e.getContext("2d").drawImage(r,0,0,c,s),n([e.toDataURL(),{originalWidth:a,originalHeight:o}])}}))}(n);t({src:r,ratio:a.originalWidth/a.originalHeight,example:[.2,.2,.8,.2,.2,.8,.8,.8],deep:20})},a.readAsDataURL(r)},multiple:!0,accept:"image/*","aria-label":"Drop an image here, or click to select"}),Object(u.jsx)(c.d,{w:1}),!v&&Object(u.jsx)(c.b,{onClick:()=>{l(!s)},children:Object(u.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[Object(u.jsx)("circle",{cx:"12",cy:"12",r:"3"}),Object(u.jsx)("path",{d:"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"})]})})]})]},e.src)};o.a.render(Object(u.jsx)(w,{}),document.getElementById("root"))}},[[32,1,2]]]);
//# sourceMappingURL=main.c22f313f.chunk.js.map