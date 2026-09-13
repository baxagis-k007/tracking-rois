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
$("#btnExport").onclick=async()=>{
  if(running||!R||!R.framesData.length)return;
  running=true; $("#btnExport").disabled=true;
  $("#autoStatus").textContent="⬇️ Préparation de l'export…";
  let imgs=[];
  for(let fd of R.framesData){let im=new Image(); im.src=fd.img; imgs.push(im);}
  for(let im of imgs){try{if(im.decode)await im.decode();}catch(e){}}
  let stream=can.captureStream(30);
  let mime="video/webm";
  if(window.MediaRecorder&&MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported("video/webm;codecs=vp9"))mime="video/webm;codecs=vp9";
  let rec=new MediaRecorder(stream,{mimeType:mime});
  let chunks=[];
  rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
  let stopped=new Promise(res=>rec.onstop=res);
  rec.start();
  let t0=performance.now();
  for(let i=0;i<R.framesData.length;i++){
    ctx.drawImage(imgs[i],0,0,can.width,can.height);
    drawMarkers(R.K,i,R.framesData[i].ov);
    let target=t0+(i+1)*1000/R.fps;
    let wait=target-performance.now();
    if(wait>0)await new Promise(r=>setTimeout(r,wait));
  }
  rec.stop(); await stopped;
  let blob=new Blob(chunks,{type:"video/webm"});
  let url=URL.createObjectURL(blob);
  let aEl=document.createElement("a");
  aEl.href=url; aEl.download="tracking_"+(meta.name||"video")+".webm";
  document.body.appendChild(aEl); aEl.click(); aEl.remove();
  $("#autoStatus").textContent="⬇️ Vidéo exportée ("+Math.round(blob.size/1024)+" Ko) : tracking_"+(meta.name||"video")+".webm";
  running=false; $("#btnExport").disabled=false;
};
function buildReport(){
  let t=R.tr, vm=Math.max(0,...[...t.tracks.values()].map(x=>x.vmax));
  let L=["=== RAPPORT TRACKING v17 ===","Généré le "+new Date().toLocaleString(),
   "Fichier: "+meta.name+" | "+meta.w+"x"+meta.h+" | durée "+meta.dur.toFixed(2)+" s",
   "fps analysé: "+R.fps+" | frames: "+R.frames,
   "mode: "+($("#carrierMode").checked?"🍎 porteur auto (tous les rois suivis)":"sélection manuelle: "+R.sel.map(r=>LETTERS[r]).join(",")),
   "réglage: "+(R_AUTO? "🤖 auto ("+R_AUTO.n+" configs, score "+R_AUTO.score+", S>"+R_AUTO.cfg.smin+" V>"+R_AUTO.cfg.vmin+" aire>"+R_AUTO.cfg.amin+")"
                      : "manuel (H "+R.S.h0+"-"+R.S.h1+"°, S>="+R.S.smin+", V>="+R.S.vmin+", aireMin="+R.S.amin+")"),
   "A0 (aire couronne apprise): "+Math.round(A0),
   "détections gardées par frame: "+Object.entries(R.counts).map(([k,v])=>k+"→"+v).join(" "),
   "assignations par rang: "+t.rankAssigns+" f | par proximité: "+t.proxAssigns+" f",
   "échanges de rang (vrais swaps) détectés: "+t.swaps,
   "frames problématiques capturées: "+(R.bad.map(b=>b.f).join(", ")||"aucune"),
   "erreurs de frame: "+R.errs+(R.errMsg?" ("+R.errMsg+")":""),
   "erreurs JS globales: "+(ERRS.join(" | ")||"aucune"),"",
   "--- PISTES ("+t.nid+") ---"];
  for(let[id,x]of t.tracks){
    let pc=x.bands.map(b=>Math.round(100*b/Math.max(1,x.vn)));
    let tag=LETTERS[x.rank]+" ("+NAMES[x.rank]+")"+(R.carrierRank===x.rank?" 🍎 PORTEUR":"");
    L.push("#"+id+" roi "+tag+": vie "+(x.last-x.first+1)+" f (f"+x.first+"-f"+x.last+") | v_moy "+Math.round(x.vsum/Math.max(1,x.vn))
      +" px/s | v_max "+Math.round(x.vmax)+" px/s | régimes <100:"+pc[0]+"% 100-500:"+pc[1]+"% 500-700:"+pc[2]
      +"% 700-1500:"+pc[3]+"% >1500:"+pc[4]+"% | couronne h "+Math.round(x.sMin)+"-"+Math.round(x.sMax)+" px");
  }
  let A=R.apple;
  L.push("","--- BOULE ROUGE 🍎 & PORTEUR ---");
  if(A.last>=0){
    let fd=R.frameDets[A.last]||[];
    let bi=-1,bd=1e9;
    fd.forEach((d,idx)=>{let dd=Math.abs(d.x-A.x); if(dd<bd){bd=dd;bi=idx;}});
    L.push("boule visible: f"+A.first+" → f"+A.last+" | dernière position x="+Math.round(A.x)+
      " | roi le plus proche: "+(bi>=0?LETTERS[bi]+" ("+NAMES[bi]+")":"?"));
    if(R.carrierRank>=0)L.push("PORTEUR = roi "+LETTERS[R.carrierRank]+" ("+NAMES[R.carrierRank]+") à partir de f"+R.carrierFrame+" (boule couverte/disparue)");
    else L.push("boule encore visible à la fin → pas de porteur");
  }else L.push("boule non détectée dans cette vidéo");
  L.push("","--- ÉVÉNEMENTS ---",
   "fusions/splits: "+t.mergeFrames.length+" f → "+(ranges(t.mergeFrames)||"-"),
   "proximités/risque de swap: "+(ranges(t.closeFrames)||"-"),
   "occlusions (frames cachées): "+[...t.tracks].map(([id,x])=>"#"+id+": "+(ranges(x.occ)||"ok")).join(" | "),
   "","--- RÉGLAGES SUGGÉRÉS ---",
   "v_max mesurée "+Math.round(vm)+" px/s → gate max ≈ "+Math.round(1.3*Math.max(100,vm)/R.fps+8)+" px à "+R.fps+" fps");
  if(simLast)L.push("","--- SIMILITUDE (crops) ---","hist "+simLast.hist+"% | pixels "+simLast.pix+"% → "+simLast.verdict);
  $("#pre").textContent=L.join("\n");
}
let loadImg=f=>new Promise(res=>{let im=new Image();im.onload=()=>res(im);im.src=URL.createObjectURL(f);});
$("#btnSim").onclick=async()=>{
  let a=$("#simA").files[0],b=$("#simB").files[0]; if(!a||!b)return;
  let ia=await loadImg(a),ib=await loadImg(b);
  let c=document.createElement("canvas");c.width=c.height=64;
  let x=c.getContext("2d",{willReadFrequently:true});
  let g=im=>{x.clearRect(0,0,64,64);let k=Math.max(64/im.width,64/im.height),w=im.width*k,h=im.height*k;
    x.drawImage(im,(64-w)/2,(64-h)/2,w,h);return x.getImageData(0,0,64,64).data;};
  let A=g(ia),B=g(ib),h1=new Array(24).fill(0),h2=new Array(24).fill(0); let mad=0;
  for(let i=0;i<4096;i++){
    for(let ch2=0;ch2<3;ch2++){h1[ch2*8+Math.min(7,A[i*4+ch2]>>5)]++;h2[ch2*8+Math.min(7,B[i*4+ch2]>>5)]++;}
    mad+=Math.abs((A[i*4]+A[i*4+1]+A[i*4+2])-(B[i*4]+B[i*4+1]+B[i*4+2]))/3;
  }
  mad/=4096; let inter=0; for(let i=0;i<24;i++)inter+=Math.min(h1[i],h2[i]);
  simLast={hist:Math.round(100*inter/4096),pix:Math.round(100*(1-mad/255))};
  simLast.verdict=simLast.hist>90&&simLast.pix>90?"clones quasi identiques":simLast.hist>75?"très similaires":"différents";
  $("#simOut").textContent="Similarité: hist "+simLast.hist+"% | pixels "+simLast.pix+"% → "+simLast.verdict;
};
$("#btnCopy").onclick=()=>navigator.clipboard.writeText($("#pre").textContent).then(()=>{
  $("#btnCopy").textContent="✅ Copié !"; setTimeout(()=>$("#btnCopy").textContent="📋 Copier le rapport",1500);});
let bk3=$("#jsok");
if(bk3){bk3.textContent="✅ JS v17 complet (core+ui1+ui2 chargés)";bk3.style.color="#69f0ae";}
