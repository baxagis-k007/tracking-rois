
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
// === FIN MORCEAU 1 ===
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
// === FIN MORCEAU 2 ===
