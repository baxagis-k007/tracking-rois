"use strict";
/* === fix3 v19.3 : marqueurs compacts (ellipse couronne + badge lettre) === */
drawMarkers=function(K,frameIdx,ov){
  let child=$("#child").checked;
  if(child){
    for(let e of ov.ranks){
      let r=e.r,bx=e.x,by=e.y,bs=e.s,lost=e.lost;
      if(!isFinite(bx)||!isFinite(by)||!isFinite(bs))continue;
      let cx=bx/K, cy=by/K;
      let rx=0.68*bs/K, ry=0.52*bs/K;
      ctx.save();
      if(lost){ctx.globalAlpha=.4;ctx.setLineDash([6,5]);}
      ctx.strokeStyle=COLORS[r];ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,7);ctx.stroke();
      ctx.restore();
      if(R&&R.carrierRank===r&&frameIdx>=R.carrierFrame){
        ctx.strokeStyle="#ff1747";ctx.lineWidth=2.5;
        ctx.beginPath();ctx.ellipse(cx,cy,rx+4,ry+4,0,0,7);ctx.stroke();
        ctx.fillStyle="#ff1747";ctx.font="bold 8px monospace";
        ctx.fillText("PORTEUR",cx-16,cy+ry+22);
      }
      let byBadge=cy-ry-9;
      ctx.globalAlpha=lost?.5:1;
      ctx.fillStyle=COLORS[r];
      ctx.beginPath();ctx.arc(cx,byBadge,8,0,7);ctx.fill();
      ctx.fillStyle="#fff";ctx.font="bold 9px monospace";
      ctx.fillText(LETTERS[r],cx-3,byBadge+3);
      ctx.globalAlpha=1;ctx.font="12px monospace";
    }
    if(ov.apple){
      ctx.strokeStyle="#ff4081";ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(ov.apple[0]/K,ov.apple[1]/K,1.1*ov.apple[2]/K,0,7);ctx.stroke();
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
let bk7=$("#jsok");
if(bk7){bk7.textContent="✅ JS v19.3 (marqueurs compacts)";bk7.style.color="#69f0ae";}
