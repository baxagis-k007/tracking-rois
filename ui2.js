"use strict";
$("#btnAuto").onclick=async()=>{
  if(running)return; running=true; $("#btnRun").disabled=true; $("#btnAuto").disabled=true;
  $("#prog").style.display="block";
  let fps=+$("#fps").value||30, K=meta.w/can.width;
  let total=Math.floor(meta.dur*fps);
  let step=Math.max(1,Math.floor(total/20));
  let samples=[];
  for(let i=0;i<=total;i+=step){
    await seek(Math.min(i/fps,meta.dur-.001));
    ctx.drawImage(vid,0,0,can.width,can.height);
    samples.push(ctx.getImageData(0,0,can.width,can.height));
    $("#prog>div").style.width=(50*i/total)+"%";
    await new Promise(r=>setTimeout(r,0));
  }
  let grid=[];
  for(let s of[0.45,0.55,0.65])for(let v of[0.5,0.6])for(let a of[80,150])
    grid.push({h0:20,h1:75,smin:s,vmin:v,amin:a});
  let best=null;
  for(let gi=0;gi<grid.length;gi++){
    let score=0;
    for(let im of samples){
      let n=detectFrom(im,grid[gi],K,false).dets.length;
      score+= n===3?1: n===2?0.5: n===1?0.15:0;
    }
    $("#autoStatus").textContent="🤖 Essai "+(gi+1)+"/"+grid.length+" …";
    $("#prog>div").style.width=(50+50*gi/grid.length)+"%";
    if(gi%3===0)await new Promise(r=>setTimeout(r,0));
    if(!best||score>best.score)best={score,cfg:grid[gi]};
  }
  $("#smin").value=best.cfg.smin; $("#vmin").value=best.cfg.vmin; $("#amin").value=best.cfg.amin;
  R_AUTO={n:grid.length,score:(best.score/samples.length).toFixed(2),cfg:best.cfg};
  $("#autoStatus").textContent="🤖 Config: S>"+best.cfg.smin+" V>"+best.cfg.vmin+" aire>"+best.cfg.amin+" (score "+R_AUTO.score+") → analyse…";
  running=false;
  await $("#btnRun").onclick();
  $("#btnAuto").disabled=false;
};
// === FIN MORCEAU 1 ===
$("#btnRun").onclick=async()=>{
  if(running)return; running=true; $("#btnRun").disabled=true; $("#btnExport").disabled=true; $("#prog").style.display="block";
  A0=1200; ERRS.length=0;
  SEL_USED=$("#carrierMode").checked?new Set([0,1,2]):new Set(SEL);
  let fps=+$("#fps").value||30;
  let S={h0:+$("#h0").value,h1:+$("#h1").value,smin:+$("#smin").value,vmin:+$("#vmin").value,amin:+$("#amin").value};
  let K=meta.w/can.width;
  R={fps,K,S,frames:0,counts:{},bad:[],errs:0,errMsg:"",frameDets:[],framesData:[],
     carrierRank:-1,carrierFrame:1e9,
     apple:{x:0,y:0,s:0,first:-1,last:-1,miss:0},
     tr:new Tracker(fps),sel:[...SEL_USED].sort()};
  vid.pause();
  let total=Math.floor(meta.dur*fps);
  let store=total<=1800;
  for(let i=0;i<=total;i++){
    try{
      await seek(Math.min(i/fps,meta.dur-.001));
      ctx.drawImage(vid,0,0,can.width,can.height);
      let snap=store?can.toDataURL("image/jpeg",0.75):null;
      let imgData=ctx.getImageData(0,0,can.width,can.height);
      let res=detectFrom(imgData,S,K,true);
      let dets=res.dets, merges=res.merges;
      let ap=detectApple(imgData,K);
      R.counts[dets.length]=(R.counts[dets.length]||0)+1;
      R.frameDets.push(dets.map(d=>({x:d.x,y:d.y})));
      let A=R.apple;
      if(ap&&ap.y>0.2*meta.h&&ap.y<0.95*meta.h&&ap.s>20&&ap.s<140&&
         (A.last<0||Math.hypot(ap.x-A.x,ap.y-A.y)<150)){
        A.x=ap.x;A.y=ap.y;A.s=ap.s;A.last=R.frames; if(A.first<0)A.first=R.frames; A.miss=0;
      }else if(!ap)A.miss++;
      if(A.last>=0&&R.carrierRank<0&&A.miss>8){
        let fd=R.frameDets[A.last]||[]; let bi=-1,bd=1e9;
        fd.forEach((d,idx)=>{let dd=Math.abs(d.x-A.x); if(dd<bd){bd=dd;bi=idx;}});
        if(bi>=0){R.carrierRank=bi;R.carrierFrame=A.last;}
      }
      R.tr.update(dets,merges); R.frames++;
      if(dets.length!==NB_ROIS&&R.bad.length<6)R.bad.push({f:i,v:can.toDataURL(),m:mcan.toDataURL()});
      let ov={dets:dets.map(d=>[d.x,d.y,d.s]),
        ranks:[...R.tr.tracks.values()].filter(t=>SEL_USED.has(t.rank))
          .map(t=>({r:t.rank,x:t.lost?t.px:t.x,y:t.lost?t.py:t.y,s:t.s,lost:t.lost>0})),
        apple:(A.last>=0&&R.frames-1-A.last<=3)?[A.x,A.y,A.s]:null};
      if(store)R.framesData.push({img:snap,ov});
      drawMarkers(K,i,ov);
    }catch(err){R.errs++;R.errMsg=String(err)+" | "+((err.stack||"").split("\n")[1]||"").trim();}
    $("#prog>div").style.width=(100*i/total)+"%";
    if(i%10===0)await new Promise(r=>setTimeout(r,0));
  }
  try{
    let gal=$("#gal"); gal.innerHTML="";
    for(let b of R.bad){
      let div=document.createElement("div");
      div.innerHTML='<p class="muted">frame '+b.f+'</p><img src="'+b.v+'" style="width:48%"><img src="'+b.m+'" style="width:48%">';
      gal.appendChild(div);}
    $("#galWrap").style.display=R.bad.length?"block":"none";
    buildReport();
    if(R.framesData.length)$("#btnExport").disabled=false;
  }catch(err){
    $("#pre").textContent="ERREUR DANS buildReport: "+err+"\n"+(err.stack||"");
  }
  running=false; $("#btnRun").disabled=false;
};
// === FIN MORCEAU 2 ===
