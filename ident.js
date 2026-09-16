"use strict";
/* === v19 : marqueurs ancrés au roi physique (piste), pas à la place === */
drawMarkers=function(K,frameIdx,ov){
  let child=$("#child").checked;
  if(child){
    for(let e of ov.ranks){
      let r=e.r;
      let bx=e.x, by=e.y, bs=e.s, lost=e.lost;
      if(!isFinite(bx)||!isFinite(by)||!isFinite(bs))continue;
      let cx=bx/K, cy=(by+0.9*bs)/K;
      let rad=1.2*bs/K*(1+0.05*Math.sin(frameIdx*0.35));
      ctx.save();
      if(lost){ctx.globalAlpha=.4;ctx.setLineDash([8,7]);}
      ctx.strokeStyle=COLORS[r];ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(cx,cy,rad,0,7);ctx.stroke();
      ctx.restore();
      if(R&&R.carrierRank===r&&frameIdx>=R.carrierFrame){
        ctx.strokeStyle="#ff1747";ctx.lineWidth=3;
        ctx.beginPath();ctx.arc(cx,cy,rad+5,0,7);ctx.stroke();
        ctx.fillStyle="#ff1747";ctx.font="bold 9px monospace";
        ctx.fillText("PORTEUR",cx-20,cy+rad+12);
      }
      ctx.globalAlpha=lost?.5:1;
      ctx.font="bold "+Math.round(.5*bs/K)+"px monospace";
      ctx.strokeStyle="#000";ctx.lineWidth=3;
      ctx.strokeText(LETTERS[r],cx-rad*.5,cy-rad*1.15);
      ctx.fillStyle=COLORS[r];ctx.fillText(LETTERS[r],cx-rad*.5,cy-rad*1.15);
      ctx.font=Math.round(.7*bs/K)+"px serif";
      ctx.fillText(EMO[r],cx+rad*.15,cy-rad*1.15);
      ctx.globalAlpha=1;ctx.font="12px monospace";
    }
    if(ov.apple){
      ctx.strokeStyle="#ff4081";ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(ov.apple[0]/K,ov.apple[1]/K,1.2*ov.apple[2]/K,0,7);ctx.stroke();
      ctx.font=Math.round(.7*ov.apple[2]/K)+"px serif";
      ctx.fillText("🍎",ov.apple[0]/K-.35*ov.apple[2]/K,ov.apple[1]/K-1.3*ov.apple[2]/K);
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
};
let _rep2=buildReport;
buildReport=function(){
  _rep2();
  if(R){
    let t=R.tr;
    let lines=["","--- IDENTITÉ (preuve de continuité) ---"];
    for(let[id,x]of t.tracks){
      lines.push("piste #"+id+" lettre "+LETTERS[x.rank]+" : vue "+x.vn+" f, coast "+x.occ.length+" f, couronne "+Math.round(x.sMin)+"-"+Math.round(x.sMax)+" px");
    }
    lines.push("croisements détectés: "+t.swaps+" → les lettres suivent le roi physique, pas la place");
    lines.push("portage: calculé sur la piste la plus proche de la boule à sa disparition, suivi jusqu'à la fin");
    $("#pre").textContent+="\n"+lines.join("\n");
  }
};
let bk5=$("#jsok");
if(bk5){bk5.textContent="✅ JS v19 (identité physique chargée)";bk5.style.color="#69f0ae";}
