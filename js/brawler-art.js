/* Painted NPC cast, reactions and staged full-body foreground screen impacts. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),images={},sourceImages={};
  const files={
    adultsA:'assets/art/adult-wardrobe-a-v13.png',reactionsA:'assets/art/wardrobe-reactions-a-v13.png',screenA:'assets/art/wardrobe-screen-a-v13.png',
    adultsB:'assets/art/adult-wardrobe-b-v13.png',reactionsB:'assets/art/wardrobe-reactions-b-v13.png',screenB:'assets/art/wardrobe-screen-b-v13.png',
    adultsCasual:'assets/art/adult-npcs-v9.png',reactionsCasual:'assets/art/npc-reactions-v10.png',screenCasual:'assets/art/npc-screen-full-v10-1.png',
    gangReactions:'assets/art/gang-reactions-v10.png',gangScreenFull:'assets/art/gang-screen-full-v10-1.png',
    bottle:'assets/v162_projectile_bottle.png',rock:'assets/v162_projectile_rock.png',firecracker:'assets/v162_projectile_firecracker.png'
  };
  for(const [id,path] of Object.entries(files)){const im=new Image();im.src=path;images[id]=im;sourceImages[path]=im;}
  // Each wardrobe carries its own measured source geometry. Clothing selection
  // never changes with aggression, damage, transport or the screen-throw state.
  const wardrobes=[];
  function addWardrobe(label,pack,standing,reactions,screen){
    wardrobes.push({variant:wardrobes.length,label,standing:{image:files['adults'+pack],rect:standing,face:wardrobes.length%3===0?-1:1,split:pack==='B'&&wardrobes.length%3===2?.76:.58},
      reactions:{image:files['reactions'+pack],...reactions},screen:{image:files['screen'+pack],frames:screen}});
  }
  const frame=(rect,anchor,outline)=>({rect,anchor,...(outline?{outline}:{})});
  // Retain the entire soft silhouette as well as opaque anatomy. The cream
  // beanie's faint edge shares a rectangular crop with the gray figure's shoes,
  // so two measured outlines separate them without clipping either body.
  const newReactionsA=[
    {stature:331,frames:[frame([77,19,329,355],[243,358]),frame([525,44,411,300],[731,331]),frame([1060,186,434,174],[1278,353])]},
    {stature:282,frames:[frame([90,378,346,300],[263,667],[[90,378],[436,378],[436,678],[345,678],[345,649],[220,649],[220,678],[90,678]]),frame([553,380,400,284],[752,654]),frame([1063,503,446,161],[1284.5,656])]},
    {stature:325,frames:[frame([61,650,359,360],[241.5,996],[[225,650],[340,650],[340,676],[420,676],[420,1010],[61,1010],[61,676],[225,676]]),frame([525,689,441,294],[746,976]),frame([1082,810,426,183],[1293.5,982])]}
  ];
  const newReactionsB=[
    {stature:303,frames:[frame([93,75,284,331],[239,391]),frame([457,160,325,231],[621,383]),frame([835,237,360,153],[1016,374])]},
    {stature:324,frames:[frame([90,461,306,348],[245,795]),frame([447,556,361,242],[630,789]),frame([831,624,369,172],[1015.5,783])]},
    {stature:319,frames:[frame([95,842,310,338],[251.5,1169]),frame([457,921,337,245],[624.5,1157]),frame([815,996,395,184],[1011.5,1164])]}
  ];
  const newScreenA=[
    [{rect:[8,131,351,621]},{rect:[7,854,351,624]}],
    [{rect:[378,140,299,616]},{rect:[377,857,303,621]}],
    [{rect:[685,125,339,629]},{rect:[691,845,333,633]}]
  ];
  const newScreenB=[
    [{rect:[5,119,372,643]},{rect:[0,814,378,622]}],
    [{rect:[384,142,333,621]},{rect:[385,834,330,602]}],
    [{rect:[742,115,344,647]},{rect:[741,814,345,624]}]
  ];
  const namesA=[
    'Burgundy premium puffer · black hoodie and loose nylon trousers · black/gray performance runners · low cap · patterned brown sling',
    'Dove-gray technical fleece set · tapered joggers · white leather low-top trainers · navy cap · black athletic sling',
    'Oversized cream graphic hoodie · relaxed blue denim · white/gray luxury runners · tan beanie · brown sling'
  ];
  const namesB=[
    'Silver quilted vest · black heavyweight hoodie · brown tactical cargos · black/white performance runners · black beanie and sling',
    'Teal/charcoal nylon windbreaker set · loose nylon joggers · white/silver runners · white cap · dark athletic sling',
    'Long black premium down parka · plum hoodie · relaxed charcoal denim · cream luxury runners · burgundy beanie · patterned brown sling'
  ];
  const standingA=[[23,8,609,814],[700,36,531,790],[1313,0,551,826]],standingB=[[12,6,609,820],[691,27,554,799],[1332,0,541,826]];
  for(let i=0;i<3;i++)addWardrobe(namesA[i],'A',standingA[i],newReactionsA[i],newScreenA[i]);
  for(let i=0;i<3;i++)addWardrobe(namesB[i],'B',standingB[i],newReactionsB[i],newScreenB[i]);
  const casualNames=[
    'Olive work jacket · cream knit · relaxed blue denim · brown boots · burgundy beanie',
    'Navy autumn jacket · rust scarf · charcoal trousers · brown boots · tied hair',
    'Mustard jacket · gray scarf · olive trousers · gray trainers · gray beanie'
  ];
  const casualStanding=[[47,13,584,798],[718,44,503,772],[1298,1,530,811]];
  const casualReactions=[
    {stature:344,frames:[frame([26,6,261,352],[181,354]),frame([379,47,363,309],[543,352],[[379,47],[742,47],[742,292],[724,292],[724,356],[379,356]]),frame([731,199,355,151],[905,346],[[751,199],[1086,199],[1086,350],[731,350],[731,280],[751,280]])]},
    {stature:330,frames:[frame([34,366,251,338],[181,700]),frame([376,386,347,318],[543,700]),frame([731,556,350,136],[905,688])]},
    {stature:345,frames:[frame([21,705,284,353],[181,1054]),frame([372,710,342,340],[543,1046]),frame([734,889,354,157],[905,1042])]}
  ];
  const casualScreen=[[7,36,363,692],[389,50,332,678],[733,52,349,675],[7,730,367,681],[386,744,335,670],[730,751,350,661]];
  for(let i=0;i<3;i++)addWardrobe(casualNames[i],'Casual',casualStanding[i],casualReactions[i],[{rect:casualScreen[i]},{rect:casualScreen[i+3]}]);
  function wardrobe(n){const variant=Number.isFinite(n.variant)?Math.trunc(n.variant):0;return wardrobes[(variant%wardrobes.length+wardrobes.length)%wardrobes.length];}
  function reaction(c,n,col,h){
    const profile=wardrobe(n).reactions,im=sourceImages[profile.image],f=profile.frames[col],sc=h/profile.stature;
    const [sx,sy,sw,sh]=f.rect,[ax,ay]=f.anchor;
    c.save();
    const outline=f.outline;
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
    const profile=wardrobe(n),im=sourceImages[profile.standing.image];if(!im.naturalWidth)return;
    if(n.kind==='gangster')h*=.46;
    c.save();c.translate(x,y);c.scale(scale,scale);
    const sourceFace=n.kind==='gangster'?1:profile.standing.face,flip=(n.face||1)*sourceFace<0;if(flip)c.scale(-1,1);
    if(n.kind==='gangster'){gang(c,n,h);c.restore();return;}
    const reactionState=['stagger','fall','dead','down','rise'].includes(n.state);
    if(reactionState&&sourceImages[profile.reactions.image].naturalWidth){
      const col=['dead','down'].includes(n.state)?2:n.state==='fall'?(n.age<.4?1:2):n.state==='rise'?(n.age<.25?2:0):0;
      if(n.state==='stagger')c.translate(Math.sin(n.age*35)*h*.018,0);
      reaction(c,n,col,h);c.restore();return;
    }
    const [sx,sy,sw,sh]=profile.standing.rect,sc=h/sh,w=sw*sc,phase=(n.distance||0)/27;
    const moving=n.moving;
    if(n.state==='held')c.rotate(-.22);
    if(n.punching)c.rotate(.12);
    if(moving){
      const split=profile.standing.split,cut=sh*split,overlap=sh*.06,legY=sy+cut-overlap;
      for(let i=0;i<2;i++){
        // Each source half pivots around its own attachment. Its zero-phase
        // position exactly matches the standing painting, with no outward gap.
        const pivot=(i?1:-1)*w*.25;
        c.save();c.translate(pivot,-h*(1-split));c.rotate(Math.sin(phase+i*Math.PI)*.085);
        c.drawImage(im,sx+i*sw/2,legY,sw/2,sh-cut+overlap,-w*.25,-overlap*sc,w*.5,(sh-cut+overlap)*sc);c.restore();
      }
      // A continuous band of the authored upper body covers both moving joints.
      // The longer parka keeps its hem in this intact foreground section.
      const upperHeight=Math.min(sh,cut+overlap*.55);
      c.drawImage(im,sx,sy,sw,upperHeight,-w*.5,-h,w,upperHeight*sc);
    }else c.drawImage(im,sx,sy,sw,sh,-w*.5,-h,w,h);
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
  const gangScreenFrames=[[14,22,351,667],[369,26,346,664],[724,22,349,669],[13,731,354,667],[368,734,353,655],[723,722,352,681]];
  function screenSource(n,damaged){
    if(n.kind==='gangster'){
      const col=Math.max(0,['bottle','rock','firecracker'].indexOf(n.item));
      return {image:images.gangScreenFull,rect:gangScreenFrames[col+(damaged?3:0)]};
    }
    const profile=wardrobe(n).screen;return {image:sourceImages[profile.image],...profile.frames[damaged?1:0]};
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
      const age=n.age,source=screenSource(n,age>=.74);if(!source.image.naturalWidth)continue;
      const aspect=source.rect[2]/source.rect[3],arrival=clamp(age/.64,0,1),ease=arrival*arrival*(3-2*arrival),start=project(n.startX,n.startDepth);
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
  window.BearlyBrawlArt={ready:()=>Object.values(images).every(im=>im.naturalWidth>0)&&wardrobes.every(w=>w.reactions.frames?.length===3&&w.screen.frames?.length===2)&&window.BearlyHeroRig.ready(),adult,projectile,impact,overlay,
    outfit:n=>n.kind==='gangster'?window.BearlyKids.outfit(n.item||'rock'):wardrobe(n).label,
    wardrobeCount:wardrobes.length,wardrobe:()=>JSON.parse(JSON.stringify(wardrobes))};
})();
