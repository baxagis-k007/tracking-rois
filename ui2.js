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
