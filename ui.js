"use strict";
function updSel(){
  for(let r=0;r<3;r++)$("#sel"+r).classList.toggle("on",SEL.has(r));
  $("#legend").innerHTML=[...SEL].sort().map(r=>
    '<span style="border:3px solid '+COLORS[r]+';border-radius:10px;padding:6px 10px;font-size:16px">'+EMO[r]+' Roi '+LETTERS[r]+' ('+NAMES[r]+')</span>').join("");
}
for(let r=0;r<3;r++)$("#sel"+r).onclick=()=>{
  if(SEL.has(r)){if(SEL.size>1)SEL.delete(r);}else SEL.add(r);
  updSel();};
updSel();
$("#fileVideo").onchange=e=>{
  let f=e.target.files[0]; if(!f)return;
  let st=$("#autoStatus");
  if(!(f.type||"").startsWith("video/")){
    st.textContent="❌ « "+f.name+" » n'est pas une vidéo (type: "+(f.type||"inconnu")+"). Choisissez un fichier vidéo (MP4 de préférence).";
    return;
  }
  try{if(vid)vid.pause();}catch(err){}
  if(vidUrl)URL.revokeObjectURL(vidUrl);
  vid=newVideoEl();
  vidUrl=URL.createObjectURL(f);
  vid.src=vidUrl;
  $("#btnRun").disabled=true; $("#btnAuto").disabled=true; $("#btnExport").disabled=true;
  st.textContent="📂 "+f.name+" · "+Math.round(f.size/1048576*10)/10+" Mo — chargement…";
  let ok=false, tries=0;
  let finish=()=>{
    if(ok)return; ok=true;
    meta={name:f.name,w:vid.videoWidth,h:vid.videoHeight,dur:vid.duration};
    if(!meta.w||!meta.h||!isFinite(meta.dur)){
      ok=false;
      st.textContent="❌ Métadonnées illisibles : format/codec incompatible. Réexportez en MP4 H.264 720p (CapCut → Export → 720p).";
      return;
    }
    can.width=320; can.height=Math.round(320*meta.h/meta.w);
    mcan.width=320; mcan.height=can.height;
    ctx.font="12px monospace";
    try{ctx.drawImage(vid,0,0,can.width,can.height);}catch(err){}
    $("#btnRun").disabled=false; $("#btnAuto").disabled=false;
    st.textContent="✅ Vidéo prête : "+meta.w+"x"+meta.h+", "+meta.dur.toFixed(1)+" s → choisissez les rois puis ▶ Analyser ou 🤖";
  };
  vid.onloadeddata=()=>finish();
  vid.onerror=()=>{ if(!ok)st.textContent="❌ Lecture impossible (erreur "+(vid.error?vid.error.code:"?")+") : codec non supporté (souvent HEVC/H.265 ou MOV). Réexportez en MP4 H.264 720p."; };
  let poll=setInterval(()=>{
    tries++;
    if(ok||vid.error){clearInterval(poll);return;}
    if(vid.readyState>=2){finish();clearInterval(poll);return;}
    if(tries===6&&vid.readyState>=1){ try{vid.currentTime=Math.min(0.1,(vid.duration||1)/2);}catch(err){} }
    if(tries===12&&vid.readyState>=1){ let p=vid.play(); if(p&&p.catch)p.catch(()=>{}); }
    if(tries===16){ try{vid.pause();}catch(err){} }
    if(tries>=30){ clearInterval(poll);
      if(!ok)st.textContent+=" · ⚠️ aucune image après 9 s : format probablement incompatible (MP4 H.264 recommandé)."; }
  },300);
};
class Tracker{
  constructor(fps){this.fps=fps;this.dt=1/fps;this.tracks=new Map();this.nid=0;this.frame=0;
    this.mergeFrames=[];this.closeFrames=[];this.swaps=0;this.rankAssigns=0;this.proxAssigns=0;}
  spawn(d,rank){let id=this.nid++;
    this.tracks.set(id,{id,x:d.x,y:d.y,s:d.s,vx:0,vy:0,lost:0,rank,
      first:this.frame,last:this.frame,occ:[],bands:[0,0,0,0,0],vmax:0,vsum:0,vn:0,sMin:d.s,sMax:d.s});}
  plausible(t,d){return d.s>0.6*t.s&&d.s<1.6*t.s&&d.y>0.10*meta.h&&d.y<0.85*meta.h;}
  update(dets,merges){
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
        if(Math.hypot(t.px-d.x,t.py-d.y)<gate){apply(t,d);uD.add(d);}
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
  }
}
let ranges=fr=>{let o=[];let s=null,p=null;
  for(let f of fr){if(s===null){s=p=f;}else if(f===p+1)p=f;else{o.push(s===p?""+s:s+"-"+p);s=p=f;}}
  if(s!==null)o.push(s===p?""+s:s+"-"+p);return o.join(", ");};
function drawMarkers(K,frameIdx,ov){
  let child=$("#child").checked;
  if(child){
    for(let e of ov.ranks){
      let r=e.r, bx,by,bs,lost=e.lost;
      if(ov.dets.length===NB_ROIS&&ov.dets[r]){bx=ov.dets[r][0];by=ov.dets[r][1];bs=ov.dets[r][2];}
      else{bx=e.x;by=e.y;bs=e.s;}
      if(!isFinite(bx)||!isFinite(by)||!isFinite(bs))continue;
      let cx=bx/K, cy=(by+1.7*bs)/K;
      let rad=1.9*bs/K*(1+0.06*Math.sin(frameIdx*0.35));
      ctx.save();
      if(lost){ctx.globalAlpha=.45;ctx.setLineDash([10,8]);}
      ctx.strokeStyle=COLORS[r];ctx.lineWidth=5;
      ctx.beginPath();ctx.arc(cx,cy,rad,0,7);ctx.stroke();
      ctx.restore();
      if(R&&R.carrierRank===r&&frameIdx>=R.carrierFrame){
        ctx.strokeStyle="#ff1747";ctx.lineWidth=4;
        ctx.beginPath();ctx.arc(cx,cy,rad+7,0,7);ctx.stroke();
        ctx.fillStyle="#ff1747";ctx.font="bold 10px monospace";
        ctx.fillText("PORTEUR",cx-24,cy+rad+16);
      }
      ctx.globalAlpha=lost?.5:1;
      ctx.font=Math.round(.9*bs/K)+"px serif";
      ctx.fillText(EMO[r],cx-rad/2,(by-0.7*bs)/K);
      ctx.font="bold "+Math.round(.55*bs/K)+"px monospace";
      ctx.strokeStyle="#000";ctx.lineWidth=3;
      ctx.strokeText(LETTERS[r],cx+rad*.72,cy-rad*.72);
      ctx.fillStyle=COLORS[r];
      ctx.fillText(LETTERS[r],cx+rad*.72,cy-rad*.72);
      ctx.globalAlpha=1;ctx.font="12px monospace";
    }
    if(ov.apple){
      ctx.strokeStyle="#ff4081";ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(ov.apple[0]/K,ov.apple[1]/K,1.4*ov.apple[2]/K,0,7);ctx.stroke();
      ctx.font=Math.round(.8*ov.apple[2]/K)+"px serif";
      ctx.fillText("🍎",ov.apple[0]/K-.4*ov.apple[2]/K,ov.apple[1]/K-1.5*ov.apple[2]/K);
      ctx.font="12px monospace";
    }
  }else{
    for(let e of ov.ranks){
      ctx.fillStyle=e.lost?"#f66":"#4f8";
      ctx.beginPath();ctx.arc(e.x/K,e.y/K,4,0,7);ctx.fill();
      ctx.fillText(LETTERS[e.r],e.x/K+6,e.y/K-6);
    }
    ctx.strokeStyle="#ff0";ctx.lineWidth=1.5;
    for(let d of ov.dets){
      ctx.beginPath();
      ctx.moveTo(d[0]/K-4,d[1]/K-4);ctx.lineTo(d[0]/K+4,d[1]/K+4);
      ctx.moveTo(d[0]/K+4,d[1]/K-4);ctx.lineTo(d[0]/K-4,d[1]/K+4);
      ctx.stroke();
    }
  }
}
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
     carrierRank=-1,carrierFrame:1e9,
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
  let L=["=== RAPPORT TRACKING v16.1 ===","Généré le "+new Date().toLocaleString(),
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
let bk=$("#jsok");
if(bk){bk.textContent="✅ JS v16.1 complet (core.js + ui.js chargés)";bk.style.color="#69f0ae";}
