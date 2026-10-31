/* Painted adult actors and arcade impacts. Foreground throws use screen-space scale. */
(() => {
  'use strict';
  const images={};
  for(const [id,path] of Object.entries({bear:'assets/art/brawler-bear-v9.png',adults:'assets/art/adult-npcs-v9.png',baby:'assets/baby_pose_idle.webp'})){const im=new Image();im.src=path;images[id]=im;}
  const poses=[[67,12,323,482,240,493],[500,17,494,473,695,488],[987,85,546,383,1240,466],[30,509,466,489,255,996],[581,565,388,379,775,755],[1097,574,389,364,1292,756]];
  const people=[[58,20,566,785],[725,54,487,753],[1305,10,516,795]];
  function bearCel(c,index,height){
    const [sx,sy,sw,sh,fx,fy]=poses[index],sc=height/480;
    c.save();
    if(index===1){c.beginPath();for(const [i,[xx,yy]] of [[500,17],[995,17],[995,310],[930,310],[930,493],[500,493]].entries())i?c.lineTo((xx-fx)*sc,(yy-fy)*sc):c.moveTo((xx-fx)*sc,(yy-fy)*sc);c.closePath();c.clip();}
    if(index===2){c.beginPath();c.moveTo((1020-fx)*sc,(85-fy)*sc);c.lineTo((1536-fx)*sc,(85-fy)*sc);c.lineTo((1536-fx)*sc,(470-fy)*sc);c.lineTo((980-fx)*sc,(470-fy)*sc);c.lineTo((980-fx)*sc,(315-fy)*sc);c.lineTo((1020-fx)*sc,(315-fy)*sc);c.closePath();c.clip();}
    c.drawImage(images.bear,sx,sy,sw,sh,(sx-fx)*sc,(sy-fy)*sc,sw*sc,sh*sc);c.restore();
  }
  function torso(c,height,bob,state){
    const i=['apex','madness'].includes(state.phase)?3:0,[sx,sy,sw,sh,fx,fy]=poses[i],h=fy-110-sy,sc=height/480;
    c.drawImage(images.bear,sx,sy,sw,h,(sx-fx)*sc,(sy-fy)*sc+bob,sw*sc,h*sc);
  }
  function player(c,x,y,h,face,state){
    if(!images.bear.naturalWidth)return false;
    if(!state.attack&&!state.held)return false;
    c.save();c.translate(x,y);if(face<0)c.scale(-1,1);if(state.phase==='madness')c.rotate(Math.sin(state.time*28)*.045);bearCel(c,state.attack?2:1,h);c.restore();return true;
  }
  function adult(c,n,x,y,h=130,scale=1){
    if(!images.adults.naturalWidth)return;
    const [sx,sy,sw,sh]=people[n.variant%3],w=h*sw/sh;
    c.save();c.translate(x,y-(n.state==='down'?h*.12:h*.48));c.scale(scale,scale);
    if(n.state==='down')c.rotate(Math.PI*.46);
    else if(n.state==='stagger')c.rotate(Math.sin(n.age*25)*.12);
    else if(n.state==='held')c.rotate(-.25);
    c.drawImage(images.adults,sx,sy,sw,sh,-w/2,-h*.52,w,h);
    if(n.hitUntil>0&&n.state==='stagger'){
      c.strokeStyle='#9a3b37';c.lineWidth=2;
      for(let j=0;j<3;j++){c.beginPath();c.moveTo(-w*.14+j*6,-h*.17);c.lineTo(-w*.02+j*6,-h*.02);c.stroke();}
    }
    c.restore();
  }
  function shelter(c,x,y,h=55){
    c.save();c.fillStyle='#315d53';c.beginPath();c.roundRect(x-h*.48,y-h*.40,h*.96,h*.46,8);c.fill();
    const im=images.baby;if(im.naturalWidth)c.drawImage(im,x-h*.35,y-h,h*.70,h);
    c.strokeStyle='#c9dca1';c.lineWidth=2;c.globalAlpha=.65;c.beginPath();c.ellipse(x,y-h*.43,h*.62,h*.72,0,0,Math.PI*2);c.stroke();c.restore();
  }
  function impact(c,e,x,y,h=145,reduced=false){
    const age=e.age,t=Math.max(0,1-age/.85),claws=e.kind==='claws';
    c.save();c.translate(x,y-h*.45);c.globalAlpha=t;
    if(claws){
      c.fillStyle='#e2d1a9';for(let i=0;i<5;i++){const a=i*2.399;c.beginPath();c.ellipse(Math.cos(a)*h*.14,Math.sin(a)*h*.12,h*.20,h*.12,a,0,Math.PI*2);c.fill();}
      c.strokeStyle='#a53a36';c.lineWidth=3;
      for(let i=0;i<3;i++){c.beginPath();c.moveTo(-h*.2+i*9,-h*.2);c.quadraticCurveTo(i*10,h*.02,h*.16+i*5,h*.22);c.stroke();}
    }
    for(let i=0;i<10;i++){
      const a=i*2.399,spread=reduced?8:10+age*105,px=Math.cos(a)*spread,py=Math.sin(a)*spread-age*30;
      c.fillStyle=claws&&i<3?'#9d3a34':['#edce7e','#dfdfc0','#a8744f'][i%3];c.fillRect(px,py,claws&&i<3?3:5,claws&&i<3?4:3);
    }
    c.restore();
  }
  function overlay(c,state,W,H,project,reduced){
    for(const n of state.npcs.filter(n=>n.state==='screen')){
      const t=Math.min(1,n.age/.95),start=project(n.startX,n.startDepth),ease=t*t*(3-2*t),x=start.x+(W*.5-start.x)*ease,y=start.y+(H*.58-start.y)*ease-Math.sin(t*Math.PI)*45;
      c.save();c.translate(x,y);if(!reduced)c.rotate(t*t*Math.PI*1.6);c.globalAlpha=t>.8?(1-t)/.2:1;
      adult(c,{...n,state:'idle'},0,0,start.height,1+6*t*t);c.restore();
      if(t>.72&&t<.95){
        c.save();c.globalAlpha=(.95-t)*2.5;c.strokeStyle='#f8df9d';c.lineWidth=4;
        for(let i=0;i<9;i++){const a=i*2.399;c.beginPath();c.moveTo(W*.5+Math.cos(a)*30,H*.5+Math.sin(a)*30);c.lineTo(W*.5+Math.cos(a)*(95+i*5),H*.5+Math.sin(a)*(90+i*4));c.stroke();}
        c.fillStyle='#fff2cf';c.font='900 40px Trebuchet MS';c.textAlign='center';c.fillText('WHUMP!',W*.5,H*.30);c.restore();
      }
    }
  }
  window.BearlyBrawlArt={ready:()=>Object.values(images).every(im=>im.naturalWidth>0),torso,player,adult,shelter,impact,overlay};
})();
