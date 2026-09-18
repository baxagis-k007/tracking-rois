"use strict";
/* === v25 : preuve géométrique de couverture + 3 scores + audit visuel f±8 === */
let _rep25=buildReport;
buildReport=function(){
  _rep25();
  if(!R||!R.framesData||!R.framesData.length)return;
  let n=R.framesData.length;
  let ball=i=>{let ov=R.framesData[i].ov;return ov&&ov.apple?ov.apple:null;};
  let kings=i=>{let ov=R.framesData[i].ov;return ov&&ov.ranks?ov.ranks:[];};
  let visE=i=>kings(i).filter(e=>!e.lost);
  let vc=0;for(let i=0;i<n;i++)if(ball(i))vc++;
  let jamaisCouvert=vc/n>0.85;
  let disp=(R._valid&&R._valid.disp>=0)?R._valid.disp:-1;
  if(disp<0&&!jamaisCouvert){
    for(let i=0;i<n-12;i++){
      if(ball(i)){let gap=true;for(let j=i+1;j<=Math.min(n-1,i+12);j++)if(ball(j)){gap=false;break;}if(gap){disp=i;break;}}
    }
  }
  let L=["","--- GÉOMÉTRIE DE LA COUVERTURE (v25) ---"];
  if(disp<0||jamaisCouvert){
    L.push("boule visible "+Math.round(100*vc/n)+"% des frames → pas de couverture à prouver (SANS OBJET)");
  }else{
    let a=ball(disp);
    let car=-1;
    for(let k=disp;k>=Math.max(0,disp-6)&&car<0;k--){
      let bb=ball(k);if(!bb)continue;
      let ve=visE(k);if(!ve.length)continue;
      let bd=1e9;
      for(let e of ve){let dd=Math.hypot(e.x-bb[0],e.y-bb[1]);if(dd<bd){bd=dd;car=e.r;}}
    }
    let tProx=false,tSep=false,tCover=false,tAppr=false;
    if(car>=0&&a){
      let ce=null;
      for(let k=disp;k>=Math.max(0,disp-6)&&!ce;k--)ce=kings(k).find(e=>e.r===car)||null;
      let sz=ce?ce.s:150;
      let dCar=ce?Math.hypot(ce.x-a[0],ce.y-a[1]):1e9;
      tProx=dCar<0.9*sz;
      let sepOk=true;
      for(let e of kings(disp)){
        if(e.r===car)continue;
        if(Math.hypot(e.x-a[0],e.y-a[1])<1.6*Math.max(dCar,1))sepOk=false;
      }
      tSep=sepOk;
      let end=Math.min(n-1,disp+12),cov=0,tot=0;
      for(let k=disp+1;k<=end;k++){
        let e=kings(k).find(q=>q.r===car);
        if(!e)continue;
        tot++;
        if(Math.hypot(e.x-a[0],e.y-a[1])<1.2*sz)cov++;
      }
      tCover=tot>0&&(cov/tot)>=0.7;
      let d0=null,d1=null;
      for(let k=disp-5;k<disp;k++){
        let bb=ball(k),e=kings(k).find(q=>q.r===car);
        if(!bb||!e)continue;
        let dd=Math.hypot(e.x-bb[0],e.y-bb[1]);
        if(d0===null)d0=dd;
        d1=dd;
      }
      tAppr=(d0!==null&&d1!==null&&(d1<d0-10||d1<0.8*sz));
    }
    let proof=tProx&&tSep&&tCover;
    L.push("trou de boule: f"+disp+" | dernière position boule x="+Math.round(a?a[0]:-1));
    L.push("roi candidate: "+(car>=0?LETTERS[car]:"?"));
    L.push("test proximité (boule dans le contour du roi): "+(tProx?"PASS":"ÉCHEC"));
    L.push("test séparation (autres rois éloignés): "+(tSep?"PASS":"ÉCHEC"));
    L.push("test couverture pendant le trou: "+(tCover?"PASS":"ÉCHEC"));
    L.push("test approche (rapprochement avant trou): "+(tAppr?"PASS":"ÉCHEC"));
    if(proof){
      if(car>=0){R.carrierRank=car;R.carrierFrame=disp;}
      L.push("→ COUVERTURE PROUVÉE : porteur confirmé "+(car>=0?LETTERS[car]:"?"));
    }else{
      R.carrierRank=-1;R.carrierFrame=1e9;
      L.push("→ TROU DE DÉTECTION, PAS UNE COUVERTURE : porteur NON confirmé (anneau rouge retiré)");
    }
    let gal=$("#gal");
    if(gal){
      gal.innerHTML="";
      let s0=Math.max(0,disp-8),s1=Math.min(n-1,disp+8);
      for(let i=s0;i<=s1;i++){
        let fd=R.framesData[i];if(!fd||!fd.img)continue;
        let bb=ball(i);
        let div=document.createElement("div");
        div.innerHTML='<p class="muted">f'+i+' boule:'+(bb?Math.round(bb[0]):"—")+(i===disp?" ← début du trou":"")+'</p><img src="'+fd.img+'" style="width:90%">';
        gal.appendChild(div);
      }
      let w=$("#galWrap"); if(w)w.style.display="block";
    }
  }
  let pct3=Math.round(100*((R.counts&&R.counts[3])||0)/Math.max(1,R.frames));
  L.push("","--- TROIS SCORES (v25) ---",
    "1) détection rois: "+pct3+"% des frames à 3 couronnes");
  for(let r of [0,1,2]){
    let v=0,u=0,tt=0;
    for(let fd of R.framesData){
      let e=(fd.ov.ranks||[]).find(q=>q.r===r);
      if(!e)continue;tt++;if(!e.lost)v++;if(e.uncert)u++;
    }
    let visP=Math.round(100*v/Math.max(1,tt)), uncP=Math.round(100*u/Math.max(1,tt));
    L.push("   roi "+LETTERS[r]+" : visibilité "+visP+"% | identité continue "+Math.round(visP*(1-uncP/100))+"%");
  }
  L.push("3) porteur: "+(R.carrierRank<0?"non confirmé / sans objet":"confirmé = roi "+LETTERS[R.carrierRank]+" (verdict v25 fait foi)"));
  $("#pre").textContent+="\n"+L.join("\n");
};
let bk13=$("#jsok");
if(bk13){bk13.textContent="✅ v25 | preuve géométrique + 3 scores + audit f±8";bk13.style.color="#69f0ae";}
