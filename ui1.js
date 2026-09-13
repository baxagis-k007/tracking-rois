
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
