"use strict";
/* === v24 : détection boule relaxée + verdict honnête (porteur / jamais couverte) === */
detectApple=function(img,K){
  let d=img.data,w=img.width,h=img.height;
  let mask=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++){
    let r=d[i*4]/255,g=d[i*4+1]/255,b=d[i*4+2]/255;
    let mx=Math.max(r,g,b),mn=Math.min(r,g,b),df=mx-mn;let hh=0;
    if(df>0){if(mx===r)hh=((g-b)/df)%6;else if(mx===g)hh=(b-r)/df+2;else hh=(r-g)/df+4;hh*=60;if(hh<0)hh+=360;}
    let s=mx>0?df/mx:0;
    if((hh<=26||hh>=334)&&s>=0.45&&mx>=0.22)mask[i]=1;
  }
  mask=erode(dilate(mask,w,h),w,h);
  let bestC=null;
  for(let c of label(mask,w,h).values()){
    if(c.n<28)continue;
    let bw=c.x1-c.x0+1,bh=c.y1-c.y0+1,r=bw/bh;
    if(r<0.5||r>2.0)continue;
    if(!bestC||c.n>bestC.n)bestC=c;
  }
  if(!bestC)return null;
  let bw=bestC.x1-bestC.x0+1,bh=bestC.y1-bestC.y0+1;
  return{x:(bestC.x0+bw/2)*K,y:(bestC.y0+bh/2)*K,s:bh*K};
};
let _rep24=buildReport;
buildReport=function(){
  _rep24();
  if(R&&R.framesData&&R.framesData.length){
    let n=R.framesData.length;
    let visCount=0,lastVis=-1;
    for(let i=0;i<n;i++){
      let ov=R.framesData[i].ov;
      if(ov&&ov.apple){visCount++;lastVis=i;}
    }
    let frac=visCount/n;
    let L=["","--- VERDICT PORTEUR (v24) ---"];
    if(frac>0.85){
      R.carrierRank=-1;R.carrierFrame=1e9;
      L.push("boule visible "+Math.round(100*frac)+"% des frames → JAMAIS COUVERTE : aucun porteur dans cette vidéo");
      if(lastVis>=0){
        let ov=R.framesData[lastVis].ov,a=ov.apple;
        let ve=(ov.ranks||[]).filter(e=>!e.lost);
        let bi=-1,bd=1e9;
        for(let e of ve){let dd=Math.hypot(e.x-a[0],e.y-a[1]);if(dd<bd){bd=dd;bi=e.r;}}
        L.push("position finale de la boule : sous/près du roi "+(bi>=0?LETTERS[bi]:"?")+" (f"+lastVis+")");
      }
      L.push("PORTEUR déclaré : aucun | RÉSULTAT : SANS OBJET");
    }else{
      let car=R.carrierRank;
      let ov=lastVis>=0?R.framesData[lastVis].ov:null;
      let finTxt="boule absente à la fin";
      let bi=-1;
      if(ov&&ov.apple){
        let ve=(ov.ranks||[]).filter(e=>!e.lost);
        let bd=1e9;
        for(let e of ve){let dd=Math.hypot(e.x-ov.apple[0],e.y-ov.apple[1]);if(dd<bd){bd=dd;bi=e.r;}}
        finTxt="sous roi "+(bi>=0?LETTERS[bi]:"?");
      }
      let res=(car<0)?"INCONNU":(bi<0?"—":(bi===car?"COHÉRENT":"ÉCHEC — identité incohérente"));
      L.push("PORTEUR déclaré : "+(car>=0?LETTERS[car]:"aucun"),
             "BOULE FINALE : "+finTxt,
             "RÉSULTAT : "+res);
    }
    $("#pre").textContent+="\n"+L.join("\n");
  }
};
let bk12=$("#jsok");
if(bk12){bk12.textContent="✅ v24 | boule relaxée + verdict honnête";bk12.style.color="#69f0ae";}
