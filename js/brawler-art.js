/* Painted NPC cast, reactions and staged full-body foreground screen impacts. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),images={};
  for(const [id,path] of Object.entries({adults:'assets/art/adult-npcs-v9.png',reactions:'assets/art/npc-reactions-v10.png',gangReactions:'assets/art/gang-reactions-v10.png',screenFull:'assets/art/npc-screen-full-v10-1.png',gangScreenFull:'assets/art/gang-screen-full-v10-1.png',bottle:'assets/v162_projectile_bottle.png',rock:'assets/v162_projectile_rock.png',firecracker:'assets/v162_projectile_firecracker.png'})){const im=new Image();im.src=path;images[id]=im;}
  const people=[[58,20,566,785],[725,54,487,753],[1305,10,516,795]];
  function reaction(c,n,col,h){
    const im=images.reactions,cw=im.naturalWidth/4,ch=im.naturalHeight/3,row=n.variant%3,sc=h/ch;
    c.save();
    if(col===2&&row===0){const left=-cw*sc*.5;c.beginPath();c.moveTo(left+16*sc,-h);c.lineTo(left+cw*sc,-h);c.lineTo(left+cw*sc,0);c.lineTo(left,0);c.lineTo(left,-h+243*sc);c.lineTo(left+16*sc,-h+243*sc);c.closePath();c.clip();}
    c.drawImage(im,col*cw,row*ch,cw,ch,-cw*sc*.5,-h,cw*sc,h);c.restore();
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
  const screenFrames={
    resident:[[7,36,363,692],[389,50,332,678],[733,52,349,675],[7,730,367,681],[386,744,335,670],[730,751,350,661]],
    gangster:[[14,22,351,667],[369,26,346,664],[724,22,349,669],[13,731,354,667],[368,734,353,655],[723,722,352,681]]
  };
  function screenSource(n,damaged){
    const gang=n.kind==='gangster',col=gang?Math.max(0,['bottle','rock','firecracker'].indexOf(n.item)):n.variant%3;
    return {image:gang?images.gangScreenFull:images.screenFull,rect:screenFrames[gang?'gangster':'resident'][col+(damaged?3:0)]};
  }
  function screenBody(c,n,w,h,damaged){const source=screenSource(n,damaged);c.drawImage(source.image,...source.rect,-w*.5,-h*.5,w,h);}
  function overlay(c,state,W,H,project,reduced,view={left:0,width:W}){
    const center=view.left+view.width*.5;
    for(const n of state.npcs.filter(n=>n.state==='screen')){
      const im=n.kind==='gangster'?images.gangScreenFull:images.screenFull;if(!im.naturalWidth)continue;
      const age=n.age,source=screenSource(n,age>=.74),aspect=source.rect[2]/source.rect[3],arrival=clamp(age/.64,0,1),ease=arrival*arrival*(3-2*arrival),start=project(n.startX,n.startDepth);
      const targetH=Math.min(H*.70,view.width*.78/aspect),initialH=Math.min(targetH,start.height*(n.kind==='gangster'?.46:1));
      const hit=Math.max(0,age-.64),slide=clamp((hit-.42)/.59,0,1),squash=!reduced&&age>=.64&&hit<.14?Math.sin(hit/.14*Math.PI)*.10:0;
      let h=(initialH+(targetH-initialH)*ease)*(1-squash*.65),w=h*aspect*(1+squash),rotation=reduced||age>=.64?0:Math.sin(arrival*Math.PI)*.08;
      // Fit the transformed WHOLE cel, including both boots, within the visible camera crop.
      const cosine=Math.abs(Math.cos(rotation)),sine=Math.abs(Math.sin(rotation));
      let bw=w*cosine+h*sine,bh=h*cosine+w*sine;
      const fit=Math.min(1,(view.width-16)/bw,(H-24)/bh);w*=fit;h*=fit;bw*=fit;bh*=fit;
      const rawX=start.x+(center-start.x)*ease,rawY=(start.y-initialH*.5)+(H*.45-(start.y-initialH*.5))*ease-(reduced?0:Math.sin(arrival*Math.PI)*28);
      const cx=clamp(rawX,view.left+bw*.5+8,view.left+view.width-bw*.5-8),cy=slide>0?H*.45+slide*slide*H*.9:clamp(rawY,bh*.5+12,H-bh*.5-12);
      c.save();c.translate(cx,cy);c.rotate(rotation);c.globalAlpha=1-slide*.8;
      screenBody(c,n,w,h,age>=.74);
      if(age>=.64&&hit<.5){
        const faceY=-h*.30,r=Math.min(w*.45,h*.15);
        c.strokeStyle='#ffffffa0';c.lineWidth=1.4;
        for(let i=0;i<7;i++){const a=i*Math.PI*2/7+.2,rr=r*(.8+(i%3)*.12);c.beginPath();c.moveTo(Math.cos(a)*rr*.45,faceY+Math.sin(a)*rr*.45);c.lineTo(Math.cos(a)*rr,faceY+Math.sin(a)*rr);c.lineTo(Math.cos(a+.12)*rr*1.16,faceY+Math.sin(a+.12)*rr*1.16);c.stroke();}
        c.shadowColor='#000';c.shadowBlur=4;c.textAlign='center';c.font=`600 ${Math.min(24,view.width*.075)}px Arial, sans-serif`;c.fillStyle='#fff';if(view.width>=W*.8)c.fillText('SMACK!',0,-h*.5-10);
        c.font=`600 ${Math.min(23,view.width*.075)}px Arial, sans-serif`;c.fillStyle='#f2a28e';c.fillText('−'+(n.lastDamage??32),w*.23,-h*.03);
        if(n.hp===0){c.fillStyle='#fff';c.font='600 15px Arial, sans-serif';c.fillText('KO',w*.23,h*.05);}
      }
      c.restore();
    }
  }
  window.BearlyBrawlArt={ready:()=>Object.values(images).every(im=>im.naturalWidth>0)&&window.BearlyHeroRig.ready(),adult,projectile,impact,overlay};
})();
