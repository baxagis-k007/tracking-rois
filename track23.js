"use strict";
/* === v23 : coût assoupli + vrai trou de boule + verrou sur position visible === */
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
  if(!this.tracks.size&&vd.length===NB_ROIS)
    for(let i=0;i<vd.length;i++)this.spawn(vd[i],i);
  let done=new Set();
  let nT=tr.length,nD=vd.length;
  let uncertSet=new Set();
  if(nT&&nD){
    let cost=(t,d)=>{
      let gate=70+1.6*Math.hypot(t.vx,t.vy)*dt+10*t.lost;
      let dist=Math.hypot(t.px-d.x,t.py-d.y)+0.25*Math.abs(t.s-d.s);
      let vx=d.x-t.px,vy=d.y-t.py;
      let dot=t.vx*vx+t.vy*vy;
      let pen=(dot<0&&Math.hypot(t.vx,t.vy)>60)?30:0;
      return dist<gate?dist+pen:1e9;
    };
    let perms=[];
    let rec=(i,f,used,csum)=>{
      if(i===nT){perms.push({f:f.slice(),c:csum});return;}
      f[i]=-1;rec(i+1,f,used,csum+200);
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
      t.last=this.frame;t.lost=0;t.conf=90;
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
  if(R&&R.framesData){
    let last=R.framesData[R.framesData.length-1];
    if(last&&last.ov)last.ov.ranks=(last.ov.ranks||[]).map(e=>{
      let t=[...this.tracks.values()].find(q=>q.r===e.r||q.rank===e.r);
      if(t){e.uncert=t.uncert;e.conf=t.conf||0;}
      return e;});
  }
};
let _rep23=buildReport;
buildReport=function(){
  if(R&&R.framesData&&R.framesData.length){
    let n=R.framesData.length;
    let vis=i=>{let ov=R.framesData[i]&&R.framesData[i].ov;return ov&&ov.apple?ov.apple:null;};
    let disp=-1,reap=-1;
    for(let i=0;i<n-12;i++){
      if(vis(i)){
        let gap=true;
        for(let j=i+1;j<=Math.min(n-1,i+12);j++)if(vis(j)){gap=false;break;}
        if(gap){disp=i;break;}
      }
    }
    if(disp>=0)for(let j=disp+13;j<n;j++)if(vis(j)){reap=j;break;}
    let carAt=i=>{
      for(let k=i;k>=Math.max(0,i-6);k--){
        let ov=R.framesData[k].ov,a=vis(k);
        if(!ov||!a)continue;
        let ve=(ov.ranks||[]).filter(e=>!e.lost);
        if(!ve.length)continue;
        let bi=-1,bd=1e9;
        for(let e of ve){let dd=Math.hypot(e.x-a[0],e.y-a[1]);if(dd<bd){bd=dd;bi=e.r;}}
        return bi;
      }
      return -1;
    };
    if(disp>=0){
      let car=carAt(disp);
      if(car>=0){R.carrierRank=car;R.carrierFrame=disp;}
      let ov=R.framesData[disp].ov,a=vis(disp);
      let dists=(ov.ranks||[]).map(e=>LETTERS[e.r]+":"+Math.round(Math.hypot(e.x-a[0],e.y-a[1]))+(e.lost?"(caché)":"")).join(" ");
      let repTxt="boule non réapparue après f"+disp;
      let coherent="—";
      if(reap>=0){
        let rr=carAt(reap);
        repTxt="boule réapparue à f"+reap+" sous "+(rr>=0?LETTERS[rr]:"?");
        coherent=(rr===car)?"COHÉRENT":"INCOHÉRENT";
      }
      let conf=0;
      if(car>=0){
        let N=n-1-disp,v=0,u=0;
        for(let i=disp;i<n;i++){
          let e2=(R.framesData[i].ov.ranks||[]).find(q=>q.r===car);
          if(e2&&!e2.lost)v++;
          if(e2&&e2.uncert)u++;
        }
        conf=Math.max(0,Math.min(100,Math.round(100*(v/Math.max(1,N))*(1-u/Math.max(1,N)))));
      }
      R._valid={disp,reap,car,dists,repTxt,coherent,conf};
    }
  }
  _rep23();
  if(R&&R._valid){
    let V=R._valid;
    let L=["","--- VALIDATION CROISÉE 🍎 (v23) ---",
      "distances boule↔rois à f"+V.disp+" : "+V.dists,
      "porteur verrouillé : "+(V.car>=0?LETTERS[V.car]:"?")+" à f"+V.disp,
      V.repTxt,
      "conclusion : "+V.coherent,
      "confiance porteur : "+V.conf+" %",
      "","--- CONFIANCE / INCERTITUDE PAR PISTE ---"];
    for(let r of [0,1,2]){
      let v=0,u=0,tt=0;
      for(let fd of R.framesData){
        let e=(fd.ov.ranks||[]).find(q=>q.r===r);
        if(!e)continue;
        tt++;if(!e.lost)v++;if(e.uncert)u++;
      }
      L.push("roi "+LETTERS[r]+" : visible "+Math.round(100*v/Math.max(1,tt))+"% | incertain "+Math.round(100*u/Math.max(1,tt))+"% des frames");
    }
    $("#pre").textContent+="\n"+L.join("\n");
  }
};
let bk11=$("#jsok");
if(bk11){bk11.textContent="✅ v23 | coût assoupli + verrou visible";bk11.style.color="#69f0ae";}
