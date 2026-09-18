"use strict";
/* === v22 : identité trajectographique + incertitude explicite + validation croisée === */
Tracker.prototype.update=function(dets,merges){
  this.frame++; if(merges)this.mergeFrames.push(this.frame);
  let dt=this.dt;
  let chK=Math.sqrt(A0/0.9)*((R&&R.K)?R.K:4);
  let tr=[...this.tracks.values()];
  for(let t of tr){
    if(t.lost){t.vx*=0.85;t.vy*=0.85;}
    t.px=t.x+t.vx*dt;t.py=t.y+t.vy*dt;
  }
  let okS=d=>d.s>0.65*chK&&d.s<1.4*chK;
  let okY=d=>d.y>0.10*meta.h&&d.y<0.85*meta.h;
  let vd=dets.filter(d=>okS(d)&&okY(d));
  /* naissances UNIQUEMENT à la première frame */
  if(!this.tracks.size&&vd.length===NB_ROIS)
    for(let i=0;i<vd.length;i++)this.spawn(vd[i],i);
  let done=new Set();
  let nT=tr.length,nD=vd.length;
  let uncertSet=new Set();
  if(nT&&nD){
    let cost=(t,d)=>{
      let gate=40+1.6*Math.hypot(t.vx,t.vy)*dt+8*t.lost;
      let dist=Math.hypot(t.px-d.x,t.py-d.y)+1.0*Math.abs(t.s-d.s);
      let vx=d.x-t.px,vy=d.y-t.py;
      let dot=t.vx*vx+t.vy*vy;
      let pen=(dot<0&&Math.hypot(t.vx,t.vy)>60)?30:0;
      return dist<gate?dist+pen:1e9;
    };
    let perms=[];
    let rec=(i,f,used,csum)=>{
      if(i===nT){perms.push({f:f.slice(),c:csum});return;}
      f[i]=-1;rec(i+1,f,used,csum+120);
      for(let j=0;j<nD;j++){
        if(used[j])continue;
        let c=cost(tr[i],vd[j]);
        if(c>1e8)continue;
        used[j]=true;f[i]=j;rec(i+1,f,used,csum+c);used[j]=false;f[i]=-1;
      }
    };
    rec(0,[],[],0);
    perms.sort((a,b)=>a.c-b.c);
    let bestP=perms[0]||null,secondP=null;
    if(bestP)for(let p of perms){
      if(p===bestP)continue;
      let diff=false;
      for(let i=0;i<nT;i++)if(p.f[i]!==bestP.f[i]){diff=true;break;}
      if(diff){secondP=p;break;}
    }
    if(bestP&&secondP&&(secondP.c-bestP.c)<20)
      for(let i=0;i<nT;i++)if(bestP.f[i]!==secondP.f[i])uncertSet.add(i);
    for(let i=0;i<nT;i++)for(let j=i+1;j<nT;j++)
      if(Math.hypot(tr[i].px-tr[j].px,tr[i].py-tr[j].py)<50){uncertSet.add(i);uncertSet.add(j);}
    if(bestP)bestP.f.forEach((j,i)=>{
      if(j<0)return;
      let t=tr[i],d=vd[j];
      let k=Math.max(1,this.frame-t.last);
      t.vx=clamp(.35*t.vx+.65*(d.x-t.x)/(k*dt));
      t.vy=clamp(.35*t.vy+.65*(d.y-t.y)/(k*dt));
      t.x=d.x;t.y=d.y;
      t.s=Math.min(Math.max(d.s,0.7*chK),1.35*chK);
      t.sMin=Math.min(t.sMin,t.s);t.sMax=Math.max(t.sMax,t.s);
      t.last=this.frame;t.lost=0;t.conf=Math.max(30,Math.round(100-60*(Math.hypot(t.px-d.x,t.py-d.y)/(40+1.6*Math.hypot(t.vx,t.vy)*dt+8*t.lost))));
      done.add(t);
    });
  }
  for(let t of tr)if(!done.has(t)){t.lost++;t.occ.push(this.frame);t.conf=Math.max(15,100-10*t.lost);}
  let best=new Map();
  for(let t of [...this.tracks.values()]){
    let o=best.get(t.rank);
    if(!o)best.set(t.rank,t);
    else{let bad=(t.lost>o.lost||(t.lost===o.lost&&t.last<o.last))?t:o;this.tracks.delete(bad.id);}
  }
  let ui=0;
  for(let t of this.tracks.values()){
    let unc=uncertSet.has(ui);ui++;
    t.uncert=unc?1:0;
    if(t.lost)continue;
    let sp=Math.hypot(t.vx,t.vy);
    t.vmax=Math.max(t.vmax,sp);t.vsum+=sp;t.vn++;
    t.bands[sp<100?0:sp<500?1:sp<700?2:sp<=1500?3:4]++;
  }
  let act=[...this.tracks.values()].filter(t=>!t.lost);
  outer:for(let i=0;i<act.length;i++)for(let j=i+1;j<act.length;j++)
    if(Math.hypot(act[i].x-act[j].x,act[i].y-act[j].y)<1.1*(act[i].s+act[j].s)){this.closeFrames.push(this.frame);break outer;}
  /* ov enrichi pour audit */
  if(R&&R.framesData){
    let last=R.framesData[R.framesData.length-1];
    if(last&&last.ov)last.ov.ranks=(last.ov.ranks||[]).map(e=>{
      let t=[...this.tracks.values()].find(q=>q.r===e.r||q.rank===e.r);
      if(t){e.uncert=t.uncert;e.conf=t.conf||0;}
      return e;});
  }
};
// === FIN MORCEAU 1 ===
