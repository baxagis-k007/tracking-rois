"use strict";
/* === FIX v18 : slot forcé quand piste perdue + porteur recalculé === */
Tracker.prototype.update=function(dets,merges){
  this.frame++; if(merges)this.mergeFrames.push(this.frame);
  let dt=this.dt;
  for(let t of this.tracks.values()){t.px=t.x+t.vx*dt;t.py=t.y+t.vy*dt;}
  let tr=[...this.tracks.values()];
  for(let i=0;i<tr.length;i++)for(let j=i+1;j<tr.length;j++){
    let L=tr[i],R2=tr[j]; if(L.rank>R2.rank){let tmp=L;L=R2;R2=tmp;}
    let dx=L.px-R2.px;
    if(dx>15&&dx<90&&L.vx>0&&R2.vx<0){let r=L.rank;L.rank=R2.rank;R2.rank=r;this.swaps++;}
  }
  let done=new Set(), uD=new Set();
  let apply=(t,d)=>{
    let k=Math.max(1,this.frame-t.last);
    t.vx=clamp(.35*t.vx+.65*(d.x-t.x)/(k*dt));
    t.vy=clamp(.35*t.vy+.65*(d.y-t.y)/(k*dt));
    t.x=d.x;t.y=d.y;t.s=d.s;t.sMin=Math.min(t.sMin,d.s);t.sMax=Math.max(t.sMax,d.s);
    t.last=this.frame;t.lost=0;done.add(t);};
  if(dets.length===NB_ROIS){
    this.rankAssigns++;
    for(let t of this.tracks.values()){
      let d=dets[t.rank];
      if(!d||!this.plausible(t,d))continue;
      let sp=Math.hypot(t.vx,t.vy);
      let gate=t.lost>3?Math.max(80,1.3*sp*dt+10):Math.max(45,1.3*sp*dt+10);
      if(Math.hypot(t.px-d.x,t.py-d.y)<gate||t.lost>2){apply(t,d);uD.add(d);}
    }
  }else{
    this.proxAssigns++;
    let pairs=[];
    for(let t of this.tracks.values())dets.forEach(d=>{
      pairs.push([Math.hypot(t.px-d.x,t.py-d.y)+1.0*Math.abs(t.s-d.s),t,d]);});
    pairs.sort((p,q)=>p[0]-q[0]);
    for(let[c,t,d]of pairs){
      if(done.has(t)||uD.has(d)||!this.plausible(t,d))continue;
      let sp=Math.hypot(t.vx,t.vy), gate=t.lost>3?80:45;
      if(c<Math.max(gate,1.3*sp*dt+8)){apply(t,d);uD.add(d);}
    }
  }
  for(let t of this.tracks.values())
    if(!done.has(t)){t.lost++;t.occ.push(this.frame);}
  if(dets.length===NB_ROIS)
    for(let r of SEL_USED)
      if(![...this.tracks.values()].some(t=>t.rank===r))this.spawn(dets[r],r);
  let best=new Map();
  for(let t of [...this.tracks.values()]){
    let o=best.get(t.rank);
    if(!o)best.set(t.rank,t);
    else{let bad=(t.lost>o.lost||(t.lost===o.lost&&t.last<o.last))?t:o;this.tracks.delete(bad.id);}
  }
  for(let t of this.tracks.values()){
    if(t.lost)continue;
    let sp=Math.hypot(t.vx,t.vy);
    t.vmax=Math.max(t.vmax,sp);t.vsum+=sp;t.vn++;
    t.bands[sp<100?0:sp<500?1:sp<700?2:sp<=1500?3:4]++;
  }
  let act=[...this.tracks.values()].filter(t=>!t.lost);
  outer:for(let i=0;i<act.length;i++)for(let j=i+1;j<act.length;j++)
    if(Math.hypot(act[i].x-act[j].x,act[i].y-act[j].y)<1.1*(act[i].s+act[j].s)){this.closeFrames.push(this.frame);break outer;}
};
let _origReport=buildReport;
buildReport=function(){
  if(R&&R.carrierRank<0&&R.apple&&R.apple.last>=0&&R.apple.last<R.frames-2){
    let fd=R.frameDets[R.apple.last]||[];
    let bi=-1,bd=1e9;
    fd.forEach((d,idx)=>{let dd=Math.abs(d.x-R.apple.x); if(dd<bd){bd=dd;bi=idx;}});
    if(bi>=0){R.carrierRank=bi;R.carrierFrame=R.apple.last;}
  }
  _origReport();
};
let bk4=$("#jsok");
if(bk4){bk4.textContent="✅ JS v18 complet (fix slot+porteur chargé)";bk4.style.color="#69f0ae";}
