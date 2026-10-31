/* Painted NPC cast, reactions and staged full-body foreground screen impacts. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),images={};
  for(const [id,path] of Object.entries({adults:'assets/art/adult-streetwear-v12.png',reactions:'assets/art/streetwear-reactions-v12.png',gangReactions:'assets/art/gang-reactions-v10.png',screenFull:'assets/art/streetwear-screen-v12.png',gangScreenFull:'assets/art/gang-screen-full-v10-1.png',bottle:'assets/v162_projectile_bottle.png',rock:'assets/v162_projectile_rock.png',firecracker:'assets/v162_projectile_firecracker.png'})){const im=new Image();im.src=path;images[id]=im;}
  const people=[[51,18,576,783],[721,45,498,762],[1308,7,523,800]];
  const outfits=[
    'Black puffer and beanie · charcoal hoodie and track pants · crossbody bag · trainers',
    'Navy tracksuit and baseball cap · crossbody bag · trainers',
    'Olive puffer vest and cargo pants · gray beanie · crossbody bag · trainers'
  ];
  // The falling soles extend outside their nominal square cells. Keep the whole
  // figure and use source-space masks where the unused portrait sits beside it.
  const reactionFrames=[
    {stature:359,frames:[[27,6,271,365,181,368],[388,47,381,323,543,367],[751,204,367,163,905,364]]},
    {stature:342,frames:[[31,375,272,348,181,720],[381,398,369,328,543,723],[750,578,362,138,905,713]]},
    {stature:356,frames:[[21,723,301,363,181,1082],[381,731,359,350,543,1078],[747,912,371,170,905,1079]]}
  ];
  function reaction(c,n,col,h){
    const im=images.reactions,row=n.variant%3,profile=reactionFrames[row],f=profile.frames[col],sc=h/profile.stature;
    const [sx,sy,sw,sh,ax,ay]=f;
    c.save();
    const outline=row===0&&col===1?[[388,47],[769,47],[769,273],[749,273],[749,370],[388,370]]:
      row===0&&col===2?[[771,204],[1086,204],[1086,273],[1118,273],[1118,367],[751,367],[751,273],[771,273]]:
      col===2&&row!==1?[[sx,sy],[1086,sy],[1086,row*362+273],[1118,row*362+273],[1118,sy+sh],[sx,sy+sh]]:null;
    if(outline){c.beginPath();for(const [i,[x,y]]of outline.entries())i?c.lineTo((x-ax)*sc,(y-ay)*sc):c.moveTo((x-ax)*sc,(y-ay)*sc);c.closePath();c.clip();}
    c.drawImage(im,sx,sy,sw,sh,(sx-ax)*sc,(sy-ay)*sc,sw*sc,sh*sc);c.restore();
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
    resident:[[5,42,377,705],[394,49,340,696],[725,53,358,694],[1,758,385,683],[393,774,342,667],[722,774,364,668]],
    gangster:[[14,22,351,667],[369,26,346,664],[724,22,349,669],[13,731,354,667],[368,734,353,655],[723,722,352,681]]
  };
  const screenMasks=[null,
    [[394,49],[724,49],[724,650],[734,650],[734,745],[394,745]],
    [[725,53],[1083,53],[1083,747],[740,747],[740,650],[725,650]],null,
    [[393,774],[724,774],[724,1340],[735,1340],[735,1441],[393,1441]],
    [[722,774],[1086,774],[1086,1442],[740,1442],[740,1340],[722,1340]]
  ];
  function screenSource(n,damaged){
    const gang=n.kind==='gangster',col=gang?Math.max(0,['bottle','rock','firecracker'].indexOf(n.item)):n.variant%3;
    const index=col+(damaged?3:0);
    return {image:gang?images.gangScreenFull:images.screenFull,rect:screenFrames[gang?'gangster':'resident'][index],outline:gang?null:screenMasks[index]};
  }
  function screenBody(c,n,w,h,damaged){
    const source=screenSource(n,damaged),[sx,sy,sw,sh]=source.rect;c.save();
    if(source.outline){c.beginPath();for(const[i,[x,y]]of source.outline.entries()){
      const dx=-w*.5+(x-sx)*w/sw,dy=-h*.5+(y-sy)*h/sh;i?c.lineTo(dx,dy):c.moveTo(dx,dy);
    }c.closePath();c.clip();}
    c.drawImage(source.image,...source.rect,-w*.5,-h*.5,w,h);c.restore();
  }
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
  window.BearlyBrawlArt={ready:()=>Object.values(images).every(im=>im.naturalWidth>0)&&window.BearlyHeroRig.ready(),adult,projectile,impact,overlay,
    outfit:n=>n.kind==='gangster'?window.BearlyKids.outfit(n.item||'rock'):outfits[n.variant%3]};
})();
