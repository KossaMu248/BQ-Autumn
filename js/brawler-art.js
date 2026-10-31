/* Painted cast, attached baby carriers and staged foreground screen impacts. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),images={};
  for(const [id,path] of Object.entries({bear:'assets/art/brawler-bear-v9.png',adults:'assets/art/adult-npcs-v9.png',baby:'assets/baby_pose_idle.webp',reactions:'assets/art/npc-reactions-v10.png',gangReactions:'assets/art/gang-reactions-v10.png',bearDamage:'assets/art/bear-damage-v10.png',bottle:'assets/v162_projectile_bottle.png',rock:'assets/v162_projectile_rock.png',firecracker:'assets/v162_projectile_firecracker.png'})){const im=new Image();im.src=path;images[id]=im;}
  const poses=[[67,12,323,482,240,493],[500,17,494,473,695,488],[987,85,546,383,1240,466],[30,509,466,489,255,996]];
  const people=[[58,20,566,785],[725,54,487,753],[1305,10,516,795]];
  function bearCel(c,index,height){
    const [sx,sy,sw,sh,fx,fy]=poses[index],sc=height/480;
    c.save();
    if(index===1){c.beginPath();for(const [i,[xx,yy]] of [[500,17],[995,17],[995,310],[930,310],[930,493],[500,493]].entries())i?c.lineTo((xx-fx)*sc,(yy-fy)*sc):c.moveTo((xx-fx)*sc,(yy-fy)*sc);c.closePath();c.clip();}
    if(index===2){c.beginPath();c.moveTo((1020-fx)*sc,(85-fy)*sc);c.lineTo((1536-fx)*sc,(85-fy)*sc);c.lineTo((1536-fx)*sc,(470-fy)*sc);c.lineTo((980-fx)*sc,(470-fy)*sc);c.lineTo((980-fx)*sc,(315-fy)*sc);c.lineTo((1020-fx)*sc,(315-fy)*sc);c.closePath();c.clip();}
    c.drawImage(images.bear,sx,sy,sw,sh,(sx-fx)*sc,(sy-fy)*sc,sw*sc,sh*sc);c.restore();
  }
  function carrier(c,h,bob=0,position='front',pose=0){
    const back=position==='back',x=back?(pose===2?-.28:-.30)*h:.12*h,y=(back?(pose===4?-.52:pose===3?-.70:pose===2?-.88:-.83):-.64)*h+bob,hh=h*.34,ww=hh*images.baby.naturalWidth/images.baby.naturalHeight;
    c.save();c.strokeStyle='#497894';c.lineWidth=h*.024;c.lineCap='round';c.beginPath();
    c.moveTo(back?-h*.19:h*.04,-h*.67+bob);c.quadraticCurveTo(back?-h*.34:h*.25,-h*.55+bob,x+ww*.12,y+hh*.72);c.stroke();
    c.drawImage(images.baby,x-ww*.5,y,ww,hh);c.restore();
  }
  function torso(c,h,bob){
    // The walking rig and the torso now share the same bear, stature and hem anchor.
    const [sx,sy,sw,,fx,fy]=poses[0],cut=fy-105,sc=h/480;
    c.drawImage(images.bear,sx,sy,sw,cut-sy,(sx-fx)*sc,(sy-fy)*sc+bob,sw*sc,(cut-sy)*sc);
  }
  function damageBear(c,h,state){
    const im=images.bearDamage;if(!im.naturalWidth)return false;
    const col=state.hp===0?(state.defeatAge<.55?1:2):0;
    const [sx,sy,sw,sh,fx,fy]=[[39,44,510,620,292,662],[669,168,692,488,1015,655],[1423,353,735,290,1785,643]][col],sc=h/614;
    if(state.baby)carrier(c,h,0,'back',state.hp===0?(col===2?4:3):0);
    c.drawImage(im,sx,sy,sw,sh,(sx-fx)*sc,(sy-fy)*sc,sw*sc,sh*sc);
    if(!state.baby)carrier(c,h,0,'front');return true;
  }
  function player(c,x,y,h,face,state){
    if(!images.bear.naturalWidth)return false;
    if(!state.attack&&!state.held&&!state.hurt&&state.hp>0)return false;
    c.save();c.translate(x,y);if(face<0)c.scale(-1,1);
    if(state.hp===0||state.hurt){damageBear(c,h,state);c.restore();return true;}
    const pose=state.attack?2:1;
    if(state.phase==='madness')c.rotate(Math.sin(state.time*28)*.035);
    if(state.baby)carrier(c,h,0,'back',pose);
    bearCel(c,pose,h);
    if(!state.baby)carrier(c,h,0,'front');c.restore();return true;
  }
  function reaction(c,n,col,h){
    const im=images.reactions,cw=im.naturalWidth/4,ch=im.naturalHeight/3,row=n.variant%3,sc=h/ch;
    c.drawImage(im,col*cw,row*ch,cw,ch,-cw*sc*.5,-h,cw*sc,h);
  }
  function gang(c,n,h){
    const frame=n.state==='windup'?2:n.state==='release'?4:n.state==='stagger'?5:Math.floor((n.distance||0)/12)%2;
    const fallen=['down','fall','dead','rise'].includes(n.state);
    if(fallen&&images.gangReactions.naturalWidth){
      const im=images.gangReactions,cw=im.naturalWidth/3,ch=im.naturalHeight/2,col=['bottle','rock','firecracker'].indexOf(n.item),sc=h/ch;
      c.drawImage(im,Math.max(0,col)*cw,ch,cw,ch,-cw*sc*.5,-h,cw*sc,h);return;
    }
    if(n.state==='stagger')c.rotate(Math.sin(n.age*30)*.15);
    window.BearlyKids.draw(c,{kind:n.item||'rock',frame,height:h});
  }
  function adult(c,n,x,y,h=130,scale=1){
    if(!images.adults.naturalWidth)return;
    if(n.kind==='gangster')h*=.46;
    c.save();c.translate(x,y);c.scale(scale,scale);
    const sourceFace=n.kind==='gangster'?1:n.variant===0?-1:1,flip=(n.face||1)*sourceFace<0;if(flip)c.scale(-1,1);
    if(n.kind==='gangster'){gang(c,n,h);c.restore();return;}
    const reactionState=['stagger','fall','dead','down','rise'].includes(n.state);
    if(reactionState&&images.reactions.naturalWidth){
      const col=['dead','down'].includes(n.state)?2:n.state==='fall'?(n.age<.4?1:2):n.state==='rise'?(n.age<.25?2:0):0;
      if(n.state==='stagger')c.translate(Math.sin(n.age*35)*h*.018,0);
      reaction(c,n,col,h);c.restore();return;
    }
    const [sx,sy,sw,sh]=people[n.variant%3],sc=h/sh,w=sw*sc,phase=(n.distance||0)/27;
    const moving=n.moving;
    if(n.state==='held')c.rotate(-.22);
    if(n.punching)c.rotate(.12);
    if(moving){
      const cut=sh*.58,legY=sy+cut;
      for(let i=0;i<2;i++){
        c.save();c.translate((i?1:-1)*w*.10,-h*.42);c.rotate(Math.sin(phase+i*Math.PI)*.085);
        c.drawImage(images.adults,sx+i*sw/2,legY,sw/2,sh-cut,-w*(i?0:.5),0,w*.5,(sh-cut)*sc);c.restore();
      }
      c.drawImage(images.adults,sx,sy,sw,cut,-w*.5,-h,w,cut*sc);
    }else c.drawImage(images.adults,sx,sy,sw,sh,-w*.5,-h,w,h);
    if(n.mood!=='calm'){
      c.strokeStyle='#c44c3c';c.lineWidth=2;c.beginPath();c.moveTo(-5,-h-8);c.lineTo(5,-h-8);c.moveTo(0,-h-13);c.lineTo(0,-h-3);c.stroke();
    }
    c.restore();
  }
  function projectile(c,q,x,y){
    const im=images[q.kind];if(!im?.naturalWidth)return;const w=q.kind==='rock'?16:q.kind==='bottle'?32:29,h=q.kind==='rock'?10:q.kind==='bottle'?18:16;
    c.save();c.translate(x,y);c.rotate(q.age*3);c.drawImage(im,-w/2,-h/2,w,h);c.restore();
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
  function screenFace(c,n,size){
    if(n.kind==='gangster'&&images.gangReactions.naturalWidth){
      const im=images.gangReactions,cw=im.naturalWidth/3,ch=im.naturalHeight/2,col=Math.max(0,['bottle','rock','firecracker'].indexOf(n.item));c.drawImage(im,col*cw,0,cw,ch,-size*.5,-size*.5,size,size);return;
    }
    const im=images.reactions,cw=im.naturalWidth/4,ch=im.naturalHeight/3;c.drawImage(im,cw*3,ch*(n.variant%3),cw,ch,-size*.5,-size*.5,size,size);
  }
  function overlay(c,state,W,H,project,reduced,view={left:0,width:W}){
    const center=view.left+view.width*.5;
    for(const n of state.npcs.filter(n=>n.state==='screen')){
      const age=n.age,start=project(n.startX,n.startDepth),arrival=clamp(age/.64,0,1),ease=arrival*arrival*(3-2*arrival),cx=start.x+(center-start.x)*ease,cy=start.y+(H*.46-start.y)*ease-Math.sin(arrival*Math.PI)*30;
      c.save();
      if(age<.64){c.translate(cx,cy);if(!reduced)c.rotate(Math.sin(arrival*Math.PI)*.6);adult(c,{...n,state:'idle'},0,0,start.height,1+arrival*1.7);}
      else{
        const hit=age-.64,slide=clamp((hit-.42)/.59,0,1),size=Math.min(H*.72,view.width*.94),squash=hit<.14?Math.sin(hit/.14*Math.PI)*.12:0;
        c.globalAlpha=1-slide*.8;c.translate(center,H*.45+slide*slide*H*.9);c.scale(1+squash,1-squash*.7);screenFace(c,n,size);
        if(hit<.5){
          c.strokeStyle='#ffffffa0';c.lineWidth=1.4;
          for(let i=0;i<7;i++){const a=i*Math.PI*2/7+.2,r=size*(.3+(i%3)*.06);c.beginPath();c.moveTo(Math.cos(a)*r*.5,Math.sin(a)*r*.5);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);c.lineTo(Math.cos(a+.12)*r*1.18,Math.sin(a+.12)*r*1.18);c.stroke();}
          c.font='600 25px Arial, sans-serif';c.fillStyle='#fff';c.textAlign='center';c.shadowColor='#000';c.shadowBlur=4;c.fillText('SMACK!',0,-size*.53);
        }
      }
      c.restore();
    }
  }
  window.BearlyBrawlArt={ready:()=>Object.values(images).every(im=>im.naturalWidth>0),torso,player,adult,carrier,projectile,impact,overlay};
})();
