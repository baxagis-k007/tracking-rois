"use strict";
let $=s=>document.querySelector(s), clamp=v=>Math.max(-3000,Math.min(3000,v));
let NB_ROIS=3;
let COLORS=["#ff5722","#4caf50","#2196f3"], EMO=["🦊","🐸","🐙"], LETTERS=["A","B","C"], NAMES=["gauche","milieu","droite"];
let SEL=new Set([0,1,2]), SEL_USED=new Set([0,1,2]);
let ERRS=[]; let R_AUTO=null;
window.addEventListener("error",e=>ERRS.push(e.message+" @ligne "+e.lineno));
let vid=null, vidUrl=null;
function newVideoEl(){
  let v=document.createElement("video");
  v.muted=true; v.playsInline=true; v.preload="auto";
  return v;
}
let can=$("#view"), ctx=can.getContext("2d",{willReadFrequently:true});
let mcan=$("#mask"), mctx=mcan.getContext("2d");
let meta=null, R=null, simLast=null, running=false, A0=1200;
function seek(t){return new Promise(res=>{
  if(Math.abs(vid.currentTime-t)<1e-4)return res();
  let done=false;
  let h=()=>{if(done)return;done=true;vid.removeEventListener("seeked",h);res();};
  vid.addEventListener("seeked",h);
  vid.currentTime=t;
  setTimeout(h,400);
});}
function dilate(m,w,h){let o=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;
    for(let dy=-1;dy<=1&&!v;dy++)for(let dx=-1;dx<=1;dx++){
      let yy=y+dy,xx=x+dx;if(yy<0||xx<0||yy>=h||xx>=w)continue;
      if(m[yy*w+xx]){v=1;break;}}
    o[y*w+x]=v;}
  return o;}
function erode(m,w,h){let o=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=1;
    for(let dy=-1;dy<=1&&v;dy++)for(let dx=-1;dx<=1;dx++){
      let yy=y+dy,xx=x+dx;if(yy<0||xx<0||yy>=h||xx>=w)continue;
      if(!m[yy*w+xx]){v=0;break;}}
    o[y*w+x]=v;}
  return o;}
function drawMask(mask,w,h){
  let id=mctx.createImageData(w,h);
  for(let i=0;i<w*h;i++){let v=mask[i]?255:0;
    id.data[i*4]=v;id.data[i*4+1]=v;id.data[i*4+2]=v;id.data[i*4+3]=255;}
  mctx.putImageData(id,0,0);}
function label(mask,w,h){
  let lab=new Int32Array(w*h),parent=[0];let next=1;
  let find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x];}return x;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let i=y*w+x;if(!mask[i])continue;
    let l=x>0?lab[i-1]:0,u=y>0?lab[i-w]:0;
    if(l&&u){let fl=find(l),fu=find(u);lab[i]=Math.min(fl,fu);if(fl!==fu)parent[Math.max(fl,fu)]=Math.min(fl,fu);}
    else if(l||u)lab[i]=l||u;
    else{parent[next]=next;lab[i]=next;next++;}}
  let agg=new Map();
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let li=lab[y*w+x];if(!li)continue;let rt=find(li);
    let a=agg.get(rt)||{n:0,x0:x,x1:x,y0:y,y1:y};
    a.n++;a.x0=Math.min(a.x0,x);a.x1=Math.max(a.x1,x);a.y0=Math.min(a.y0,y);a.y1=Math.max(a.y1,y);agg.set(rt,a);}
  return agg;}
function mergeBoxes(boxes,g){
  let changed=true;
  while(changed){changed=false;
    outer:for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      let a=boxes[i],b=boxes[j];
      let dx=Math.max(a.x0,b.x0)-Math.min(a.x1,b.x1);
      let dy=Math.max(a.y0,b.y0)-Math.min(a.y1,b.y1);
      if(dx<=g&&dy<=g){
        a.x0=Math.min(a.x0,b.x0);a.y0=Math.min(a.y0,b.y0);
        a.x1=Math.max(a.x1,b.x1);a.y1=Math.max(a.y1,b.y1);a.n+=b.n;
        boxes.splice(j,1);changed=true;break outer;}}}
  return boxes;}
function crownDims(){let ch=Math.sqrt(A0/0.9);return{ch,cw:1.35*ch};}
function peaksInBox(mask,w,h,b,kmax){
  let n=b.x1-b.x0+1, top=new Array(n).fill(1e9);
  for(let x=b.x0;x<=b.x1;x++)
    for(let y=b.y0;y<=b.y1;y++)
      if(mask[y*w+x]){top[x-b.x0]=y;break;}
  let sm=top.map((_,i)=>{let s=0,c=0;
    for(let d=-2;d<=2;d++){let j=i+d;if(j>=0&&j<n&&top[j]<1e9){s+=top[j];c++;}}
    return c?s/c:1e9;});
  let W=18;
  let prom=sm.map((v,i)=>{
    if(v>1e8)return -1;
    let l=v,r=v;
    for(let j=i;j>=Math.max(0,i-W);j--)l=Math.max(l,sm[j]);
    for(let j=i;j<=Math.min(n-1,i+W);j++)r=Math.max(r,sm[j]);
    return Math.min(l,r)-v;});
  let cand=[];
  for(let i=0;i<n;i++)if(prom[i]>=5)cand.push(i);
  cand.sort((a,b)=>prom[b]-prom[a]);
  let picked=[];
  for(let i of cand){
    if(picked.length>=kmax)break;
    if(picked.every(p=>Math.abs(p-i)>=12))picked.push(i);}
  if(!picked.length){let bi=0,bv=1e9;
    for(let i=0;i<n;i++)if(sm[i]<bv){bv=sm[i];bi=i;}
    picked.push(bi);}
  picked.sort((a,b)=>a-b);
  return picked.map(i=>({x:b.x0+i,y:sm[i]}));
}
function detectFrom(img,S,K,withMask){
  let d=img.data,w=img.width,h=img.height;
  let mask=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++){
    let r=d[i*4]/255,g=d[i*4+1]/255,b=d[i*4+2]/255;
    let mx=Math.max(r,g,b),mn=Math.min(r,g,b),df=mx-mn;let hh=0;
    if(df>0){if(mx===r)hh=((g-b)/df)%6;else if(mx===g)hh=(b-r)/df+2;else hh=(r-g)/df+4;hh*=60;if(hh<0)hh+=360;}
    if(hh>=S.h0&&hh<=S.h1&&(mx>0?df/mx:0)>=S.smin&&mx>=S.vmin)mask[i]=1;
  }
  mask=erode(dilate(mask,w,h),w,h);
  mask=erode(dilate(mask,w,h),w,h);
  if(withMask)drawMask(mask,w,h);
  let boxes=[];
  for(let c of label(mask,w,h).values())
    if(c.n>=S.amin)boxes.push({x0:c.x0,y0:c.y0,x1:c.x1,y1:c.y1,n:c.n});
  boxes=mergeBoxes(boxes,10);
  for(let b of boxes){
    let r=(b.x1-b.x0+1)/(b.y1-b.y0+1);
    if(r>1.05&&r<1.75&&b.n>0.75*A0&&b.n<1.3*A0)
      A0=Math.min(2500,Math.max(600,0.95*A0+0.05*b.n));
  }
  let cd=crownDims(), ch=cd.ch, cw=cd.cw;
  let dets=[];let merges=0;
  for(let b of boxes){
    let bw=b.x1-b.x0+1,bh=b.y1-b.y0+1;
    let kArea=Math.min(3,Math.max(1,Math.round(b.n/A0)));
    if(b.n>1.35*A0&&kArea<2)kArea=2;
    if(b.n>2.4*A0&&kArea<3)kArea=3;
    let pk=peaksInBox(mask,w,h,b,3);
    let k=Math.min(3,Math.max(kArea,pk.length));
    if(k===1){dets.push({x:(b.x0+bw/2)*K,y:(b.y0+bh/2)*K,s:bh*K,n:b.n});continue;}
    merges++;
    for(let q=0;q<k;q++){
      if(q<pk.length)dets.push({x:pk[q].x*K,y:(pk[q].y+0.55*ch)*K,s:ch*K,n:b.n/k});
      else dets.push({x:(b.x0+bw*(q+.5)/k)*K,y:(b.y0+bh/2)*K,s:bh*K,n:b.n/k});
    }
  }
  dets=dets.filter(dd=>isFinite(dd.x)&&isFinite(dd.y)&&isFinite(dd.s)&&dd.s>0&&dd.y>0);
  dets.sort((a,b)=>b.n-a.n);
  return{dets:dets.slice(0,NB_ROIS).sort((a,b)=>a.x-b.x),merges};
}
function detectApple(img,K){
  let d=img.data,w=img.width,h=img.height;
  let mask=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++){
    let r=d[i*4]/255,g=d[i*4+1]/255,b=d[i*4+2]/255;
    let mx=Math.max(r,g,b),mn=Math.min(r,g,b),df=mx-mn;let hh=0;
    if(df>0){if(mx===r)hh=((g-b)/df)%6;else if(mx===g)hh=(b-r)/df+2;else hh=(r-g)/df+4;hh*=60;if(hh<0)hh+=360;}
    let s=mx>0?df/mx:0;
    if((hh<=24||hh>=336)&&s>=0.55&&mx>=0.35)mask[i]=1;
  }
  mask=erode(dilate(mask,w,h),w,h);
  let bestC=null;
  for(let c of label(mask,w,h).values()){
    if(c.n<40)continue;
    let bw=c.x1-c.x0+1,bh=c.y1-c.y0+1,r=bw/bh;
    if(r<0.55||r>1.8)continue;
    if(!bestC||c.n>bestC.n)bestC=c;
  }
  if(!bestC)return null;
  let bw=bestC.x1-bestC.x0+1,bh=bestC.y1-bestC.y0+1;
  return{x:(bestC.x0+bw/2)*K,y:(bestC.y0+bh/2)*K,s:bh*K};
}
