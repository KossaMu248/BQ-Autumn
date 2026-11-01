/* One on-foot model: authored carrier torsos/actions and source-calibrated leg geometry. */
(() => {
  'use strict';
  const images={},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  for(const [key,file] of Object.entries({front:'front-carrier-v7.png',back:'back-carrier-v11.png',reactions:'carrier-reactions-v11.png',parts:'matched-legs-v11.png',frontBackground:'front-background-v11-2.png',backBackground:'back-background-v11-2.png',reactionBackground:'reaction-background-v11-2.png',boatBackground:'boat-background-v11-2.png',transferBackground:'transfer-background-v11-2.png'})){
    const im=new Image();im.src='assets/art/'+file;images[key]=im;
  }
  const heads={
    front:{box:[183,173,83,85],neck:[232,255],angle:0},
    back:{box:[270,79,84,78],neck:[320,154],angle:-.08},
    grab:{box:[940,70,84,82],neck:[990,149],angle:-.06},
    maul:{box:[360,544,82,80],neck:[399,620],angle:.06},
    backHurt:{box:[955,541,83,78],neck:[1003,616],angle:-.08},
    frontHurt:{box:[358,204,111,109],neck:[421,309],angle:-.06},
    collapse:{box:[966,108,128,116],neck:[1053,221],angle:-.14},
    defeated:{box:[1814,178,115,111],neck:[1880,286],angle:-.06},
    boat:{box:[471,464,199,198],neck:[592,658],angle:0},
    transfer2:{box:[1332,140,92,85],neck:[1366,222],angle:0,flip:-1},
    transfer3:{box:[366,628,90,82],neck:[405,705],angle:0,flip:-1},
    transfer4:{box:[772,678,87,82],neck:[824,757],angle:0},
    transfer5:{box:[1267,678,88,85],neck:[1320,760],angle:0}
  };
  const backgrounds={front:'frontBackground',back:'backBackground',grab:'backBackground',maul:'backBackground',backHurt:'backBackground',frontHurt:'reactionBackground',collapse:'reactionBackground',defeated:'reactionBackground',boat:'boatBackground',transfer2:'transferBackground',transfer3:'transferBackground',transfer4:'transferBackground',transfer5:'transferBackground'};
  // All landmarks are measured in the SAME source coordinates as the carrier torso.
  // Image-left is the near leg in these right-facing three-quarter paintings.
  const profiles={
    front:{image:'front',stature:488,origin:[179,500],torso:[51,13,256,377],waist:365,pelvisY:335,near:{hip:[137,386],sole:[155,500],cuff:[131,420],furWidth:84,boot:[85,418,125,84]},far:{hip:[207,384],sole:[220,491],cuff:[202,418],furWidth:65,boot:[164,414,108,78]}},
    back:{image:'back',stature:507,origin:[414,516],torso:[252,4,310,398],waist:370,pelvisY:345,near:{hip:[363,397],sole:[373,516],cuff:[351,436],furWidth:86,boot:[305,429,134,88]},far:{hip:[451,395],sole:[483,506],cuff:[445,433],furWidth:68,boot:[408,427,127,80]}}
  };
  // Complete painted figures: baby, fabric seat, shoulder straps, waist belt and arms stay together.
  const actions={
    backIdle:{image:'back',rect:[252,4,310,516],origin:[404,516],stature:507},
    grab:{image:'back',rect:[817,8,564,504],origin:[1061,506],stature:507},
    maul:{image:'back',rect:[146,531,635,456],origin:[440,981],stature:507},
    backHurt:{image:'back',rect:[933,503,479,510],origin:[1174,1008],stature:507},
    frontHurt:{image:'reactions',rect:[61,7,515,705],origin:[315,705],stature:696},
    collapse:{image:'reactions',rect:[747,102,664,604],origin:[1085,704],stature:696},
    defeated:{image:'reactions',rect:[1528,173,592,530],origin:[1835,701],stature:696}
  };
  let parts=null,lastAudit={},nativeFrames=null;
  const preparedBodies=new Map();
  const upperBodies={
    front:{box:[182,172,94,131],waist:[238,298],raise:6,lip:[[198,294],[226,299],[264,291]]},
    back:{box:[269,78,88,139],waist:[302,212],raise:20,lip:[[276,208],[302,216],[328,203]]},
    grab:{box:[939,69,89,149],waist:[962,214],raise:20,lip:[[922,211],[959,220],[984,204]]},
    maul:{box:[330,542,114,136],waist:[344,670],raise:20,lip:[[313,667],[344,680],[376,653]]},
    backHurt:{box:[952,539,94,154],waist:[994,691],raise:16,lip:[[974,679],[994,697],[1020,677]]},
    frontHurt:{box:[357,202,113,174],waist:[409,373],source:'reactions',lip:[[361,361],[402,379],[446,360]]},
    collapse:{box:[941,106,158,191],waist:[973,291],raise:18,source:'reactions',texture:[944,215,20,24],lip:[[924,285],[962,300],[1003,274]]},
    defeated:{box:[1768,176,160,165],waist:[1800,338],raise:18,source:'reactions',texture:[1800,270,20,24],lip:[[1743,323],[1789,342],[1832,319]]},
    boat:{box:[470,463,222,310],waist:[614,770],raise:15,source:'boatOriginal',texture:[543,792,50,30],lip:[[500,747],[551,765],[684,747]]},
    transfer2:{box:[1289,138,138,145],waist:[1344,278],lip:[[1308,266],[1342,282],[1375,266]]},
    transfer3:{box:[351,627,108,143],waist:[378,764],lip:[[350,753],[379,768],[409,750]]},
    transfer4:{box:[771,676,111,132],waist:[829,803],lip:[[791,792],[829,807],[866,789]]},
    transfer5:{box:[1265,676,102,135],waist:[1327,806],lip:[[1288,794],[1325,810],[1362,791]]}
  };
  function ready(){return Object.values(images).every(im=>im.naturalWidth>0)&&!!window.BearlyBabyPassenger?.ready();}
  function babyMood(options={}){
    const state=options.state||{};
    const startled=(state.effects||[]).some(e=>e.kind==='throw'&&e.age<.65||e.kind==='screen-smack'&&e.age<.3);
    if(state.hp===0||state.hurt||state.attack||state.phase==='madness'||startled)return 'terror';
    if(state.held)return 'brace';
    if((options.jump||0)>8)return 'terror';
    if(options.talking)return 'point';
    if(options.transfer)return 'brace';
    if(options.mode==='water'&&Math.abs(options.speed||0)>20)return 'excited';
    if((options.weight||0)>.4)return 'laugh';
    return 'idle';
  }
  function carrierBody(image,rect,name){
    const key=name+':'+rect.join(',');if(preparedBodies.has(key))return preparedBodies.get(key);
    const [sx,sy,sw,sh]=rect,head=heads[name],[hx,hy,hw,hh]=head.box,upper=upperBodies[name],[ux,uy,uw,uh]=upper.box;
    const tile=document.createElement('canvas');tile.width=sw;tile.height=sh;
    const c=tile.getContext('2d');c.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
    const mask=document.createElement('canvas');mask.width=sw;mask.height=sh;const m=mask.getContext('2d');m.translate(-sx,-sy);m.fillStyle='#fff';
    const H=x=>head.flip<0?hx+hw-(x-hx):x;
    // Remove the former painted head and upper child as one union. The clean
    // backing restores the bear, straps and empty carrier behind the passenger.
    m.beginPath();m.moveTo(H(hx+hw*.3),hy+hh+3);
    m.bezierCurveTo(H(hx-hw*.04),hy+hh*.96,H(hx-3),hy+hh*.7,H(hx-3),hy+hh*.43);
    m.bezierCurveTo(H(hx-3),hy+hh*.12,H(hx+hw*.2),hy-3,H(hx+hw*.5),hy-3);
    m.bezierCurveTo(H(hx+hw*.91),hy-3,H(hx+hw+3),hy+hh*.25,H(hx+hw+3),hy+hh*.5);
    m.bezierCurveTo(H(hx+hw+5),hy+hh*.68,H(hx+hw+1),hy+hh*.97,H(hx+hw*.7),hy+hh+3);m.closePath();m.fill();
    const left=Math.min(ux,upper.waist[0]-25*hh/85),right=Math.max(ux+uw,upper.waist[0]+25*hh/85);
    m.beginPath();m.moveTo(head.neck[0]-30*hh/85,hy+hh-10);m.lineTo(head.neck[0]+36*hh/85,hy+hh-10);
    m.lineTo(right,head.neck[1]+20*hh/85);m.lineTo(right,uy+uh);m.lineTo(left,uy+uh);m.lineTo(left,head.neck[1]+27*hh/85);m.closePath();m.fill();
    c.globalCompositeOperation='destination-out';c.drawImage(mask,0,0);
    const patch=document.createElement('canvas');patch.width=sw;patch.height=sh;const g=patch.getContext('2d');
    g.drawImage(images[backgrounds[name]],sx,sy,sw,sh,0,0,sw,sh);g.globalCompositeOperation='destination-in';g.drawImage(mask,0,0);
    c.globalCompositeOperation='source-over';c.drawImage(patch,0,0);preparedBodies.set(key,tile);return tile;
  }
  function paintCarrierBody(c,image,rect,origin,s,name,bob=0){
    const [sx,sy,sw,sh]=rect;c.drawImage(carrierBody(image,rect,name),(sx-origin[0])*s,(sy-origin[1])*s+bob,sw*s,sh*s);
  }
  function paintPassenger(c,image,rect,origin,s,name,options={},bob=0){
    const head=heads[name],upper=upperBodies[name],u=head.box[3]/85;
    const lip=upper.lip.map(([x,y])=>[x,y-(upper.raise||0)*u]),[a,q,b]=lip;
    const middle=[(a[0]+2*q[0]+b[0])/4,(a[1]+2*q[1]+b[1])/4];
    const angle=clamp(Math.atan2(head.neck[0]-upper.waist[0],upper.waist[1]-head.neck[1]),-.2,.2);
    const X=x=>(x-origin[0])*s,Y=y=>(y-origin[1])*s+bob;
    const mood=babyMood({...options,transfer:options.transfer||name.startsWith('transfer')});
    if(!nativeFrames)nativeFrames=window.BearlyBabyPassenger.frames();
    const native=nativeFrames[window.BearlyBabyPassenger.resolve(mood)],scale=head.box[3]/61,flip=head.flip||1;
    const lipAt=x=>{let lo=0,hi=1;for(let i=0;i<18;i++){const t=(lo+hi)/2,xx=(1-t)*(1-t)*a[0]+2*(1-t)*t*q[0]+t*t*b[0];if(xx<x)lo=t;else hi=t;}const t=(lo+hi)/2;return(1-t)*(1-t)*a[1]+2*(1-t)*t*q[1]+t*t*b[1];};
    // Fit the native clothing cut edge behind the curved pouch. Open-jaw and
    // leaning frames keep the SAME physical scale, with enough fabric overlap.
    let padding=8*u;const cs=Math.cos(angle),sn=Math.sin(angle);
    for(const [px,py]of native.polygon.filter(point=>point[1]>=native.occludeFrom)){
      const dx=(px-native.pivot[0])*scale*flip,dy=(py-native.pivot[1])*scale;
      const rx=dx*cs-dy*sn,ry=dx*sn+dy*cs;
      padding=Math.max(padding,lipAt(middle[0]+rx)-middle[1]-ry+3*u);
    }
    const seam=[middle[0],middle[1]+padding];
    const passenger=window.BearlyBabyPassenger.draw(c,{mood,x:X(seam[0]),y:Y(seam[1]),scale:scale*s,angle,flip});
    // The original neck and shirt remain continuous. Only the lower torso cut
    // disappears behind the front of the actual carrier pouch, below the face.
    const depth=Math.max(32*u,padding+14*u),foreground=new Path2D();foreground.moveTo(X(a[0]),Y(a[1]));foreground.quadraticCurveTo(X(q[0]),Y(q[1]),X(b[0]),Y(b[1]));
    foreground.lineTo(X(b[0]),Y(b[1]+depth));foreground.quadraticCurveTo(X(q[0]),Y(q[1]+depth),X(a[0]),Y(a[1]+depth));foreground.closePath();
    c.save();c.clip(foreground);const [sx,sy,sw,sh]=rect;let textureMap=null;
    if(upper.texture){
      const top=Math.min(a[1],q[1],b[1]),bottom=Math.max(a[1],q[1],b[1])+depth,destination=[a[0],top,b[0]-a[0],bottom-top];
      c.drawImage(image,...upper.texture,X(destination[0]),Y(destination[1]),destination[2]*s,destination[3]*s);textureMap={source:upper.texture,destination};
    }else c.drawImage(upper.source?image:images[backgrounds[name]],sx,sy,sw,sh,X(sx),Y(sy),sw*s,sh*s);
    c.restore();
    c.save();c.strokeStyle='#274b60';c.lineWidth=1.8*s;c.beginPath();c.moveTo(X(a[0]),Y(a[1]));c.quadraticCurveTo(X(q[0]),Y(q[1]),X(b[0]),Y(b[1]));c.stroke();c.restore();
    return {...passenger,pose:name,pouch:{lip,depth,seam,origin,scale:s,bob,source:upper.source||backgrounds[name],textureMap,padding}};
  }
  function drawCarrier(c,image,rect,origin,s,name,options={},bob=0){paintCarrierBody(c,image,rect,origin,s,name,bob);return paintPassenger(c,image,rect,origin,s,name,options,bob);}
  function prepareParts(){
    if(parts)return parts;
    function tile(rect){const [x,y,w,h]=rect,c=document.createElement('canvas');c.width=w;c.height=h;c.dataset.sourceAsset='matched-legs-v11.png';c.getContext('2d').drawImage(images.parts,x,y,w,h,0,0,w,h);return c;}
    parts={pants:(()=>{const c=document.createElement('canvas');c.width=99;c.height=32;c.dataset.sourceAsset='front-carrier-v7.png';c.getContext('2d').drawImage(images.front,92,344,99,32,0,0,99,32);return c;})(),near:{fur:tile([180,129,515,293]),boot:tile([160,370,712,433])},far:{fur:tile([1110,160,385,267]),boot:tile([1077,372,642,421])}};return parts;
  }
  function fullPose(c,name,h,options={}){
    const f=actions[name],[sx,sy,sw,sh]=f.rect,s=h/f.stature;
    // The staggered sheet is not a regular grid: exclude adjacent helmet/boot tips.
    const outline=name==='grab'?[[817,8],[1381,8],[1381,502],[960,502],[960,512],[817,512]]:
      name==='backHurt'?[[944,503],[1412,503],[1412,1013],[933,1013],[933,516],[944,516]]:null;
    c.save();
    if(outline){c.beginPath();for(const [i,[x,y]] of outline.entries())i?c.lineTo((x-f.origin[0])*s,(y-f.origin[1])*s):c.moveTo((x-f.origin[0])*s,(y-f.origin[1])*s);c.closePath();c.clip();}
    const likeness=drawCarrier(c,images[f.image],f.rect,f.origin,s,name==='backIdle'?'back':name,options);c.restore();return likeness;
  }
  function draw(c,px,py,h,face,options={}){
    if(!ready())return false;
    const state=options.state||{},back=!!state.baby,profile=profiles[back?'back':'front'],s=h/profile.stature;
    const gait=window.BearlyLocomotion.pose(options.distance||0,h,options.weight||0),jump=options.jump||0;
    c.save();c.translate(px,py);if(face<0)c.scale(-1,1);
    let pose=state.hp===0?(state.defeatAge<.55?'collapse':'defeated'):state.hurt?(back?'backHurt':'frontHurt'):state.attack?'maul':state.held?'grab':null;
    if(pose){const babyFace=fullPose(c,pose,h,options);lastAudit={pose,carrier:pose==='frontHurt'?'front':'back',integratedCarrier:true,babyFace,height:h,source:actions[pose].image};c.restore();return true;}
    const texture=prepareParts(),weight=clamp(options.weight||0,0,1),blend=clamp(weight/.4,0,1),ox=profile.origin[0],oy=profile.origin[1],landmarks={};
    // The standing painting has one boot permanently ahead. Ease both feet onto
    // a shared walking track so either leg can lead by the same useful distance.
    const track=(profile.near.sole[0]+profile.far.sole[0])*.5;
    const pelvisTrack=(profile.near.hip[0]+profile.far.hip[0])*.5;
    const pivot={x:(pelvisTrack-ox)*s,y:(profile.pelvisY-oy)*s+gait.bob};
    const bodyPoint=(x,y)=>({x:pivot.x+gait.sway+(x-pivot.x)*Math.cos(gait.roll)-(y-pivot.y)*Math.sin(gait.roll),y:pivot.y+(x-pivot.x)*Math.sin(gait.roll)+(y-pivot.y)*Math.cos(gait.roll)});
    const bodyTransform=()=>{c.translate(pivot.x+gait.sway,pivot.y);c.rotate(gait.roll);c.translate(-pivot.x,-pivot.y);};
    const headName=back?'back':'front';let babyFace;
    if(blend<1){c.save();bodyTransform();c.globalAlpha*=1-blend;const [sx,sy,sw,sh]=profile.torso,fullH=profile.image==='front'?489:516;paintCarrierBody(c,images[profile.image],[sx,sy,sw,fullH],profile.origin,s,headName,gait.bob);c.restore();}
    c.save();c.globalAlpha*=blend;
    for(const name of ['far','near']){
      const leg=profile[name],f=gait[name];
      // Pelvic yaw advances the supporting hip underneath the intact shorts.
      // Wide boot travel therefore does not lengthen the bear's short legs.
      const hip=bodyPoint((leg.hip[0]-ox)*s*(1-.70*weight)+pivot.x*.70*weight+f.x*.50,pivot.y);
      const sole={x:(track-ox+(leg.sole[0]-track)*(1-.85*weight))*s+f.x,y:(leg.sole[1]-oy)*s+f.y-h*.035*Math.min(1,jump/35)};
      let angle=f.angle;
      if(options.groundAt){
        const wx=px+face*sole.x,base=options.groundAt(px),at=options.groundAt(wx);
        if(base!=null&&at!=null)sole.y+=at-base;
        const a=options.groundAt(wx-4),b=options.groundAt(wx+4);if(f.stance&&a!=null&&b!=null)angle+=Math.atan2(b-a,8)*face;
      }
      const ax=(leg.cuff[0]-leg.sole[0])*s,ay=(leg.cuff[1]-leg.sole[1])*s,cs=Math.cos(angle),sn=Math.sin(angle);
      const cuff={x:sole.x+ax*cs-ay*sn,y:sole.y+ax*sn+ay*cs};
      const thighLength=(leg.hip[1]-profile.pelvisY+8)*s,shinLength=(leg.cuff[1]-leg.hip[1]+18)*s,reach=thighLength+shinLength-.01;
      const nominalHip={...hip};
      // Weight transfer stays within the painted pelvis. On changing terrain,
      // settle the attachment before solving IK; never stretch either limb.
      hip.y=cuff.y-clamp(cuff.y-hip.y,-reach*.98,reach*.98);
      const horizontalReach=Math.sqrt(Math.max(0,reach*reach-(cuff.y-hip.y)*(cuff.y-hip.y)));
      hip.x=clamp(hip.x,cuff.x-horizontalReach,cuff.x+horizontalReach);
      const joint=window.BearlyLocomotion.knee(hip,cuff,thighLength,shinLength);
      function link(im,a,b,width,padding){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(dy,dx)-Math.PI/2);c.drawImage(im,-width*.5,-padding,width,len+padding*2);c.restore();}
      const thigh=Math.hypot(joint.x-hip.x,joint.y-hip.y),turn=clamp(Math.atan2(joint.x-hip.x,joint.y-hip.y)*.90,-.78,.78);
      const panelLength=thigh*.94,panelWidth=(name==='near'?104:80)*s,pa={x:Math.sin(turn),y:Math.cos(turn)},pn={x:Math.cos(turn),y:-Math.sin(turn)};
      const hem={x:hip.x+pa.x*panelLength,y:hip.y+pa.y*panelLength};
      const shinAxis={x:(cuff.x-joint.x)/shinLength,y:(cuff.y-joint.y)/shinLength},shinNormal={x:shinAxis.y,y:-shinAxis.x};
      // The source fur has a flat upper extraction edge. Keep it behind the
      // actual moving cloth opening rather than exposing a rectangular patch.
      const cap={x:hem.x-pa.x*3*s,y:hem.y-pa.y*3*s},lower={x:cuff.x+shinAxis.x*9*s,y:cuff.y+shinAxis.y*9*s};
      c.save();c.beginPath();
      c.moveTo(cap.x-pn.x*leg.furWidth*s*.5,cap.y-pn.y*leg.furWidth*s*.5);
      c.lineTo(cap.x+pn.x*leg.furWidth*s*.5,cap.y+pn.y*leg.furWidth*s*.5);
      c.lineTo(lower.x+shinNormal.x*leg.furWidth*s*.6,lower.y+shinNormal.y*leg.furWidth*s*.6);
      c.lineTo(lower.x-shinNormal.x*leg.furWidth*s*.6,lower.y-shinNormal.y*leg.furWidth*s*.6);c.closePath();c.clip();
      link(texture[name].fur,joint,cuff,leg.furWidth*s,18*s);c.restore();
      const [bx,by,bw,bh]=leg.boot;c.save();c.translate(sole.x,sole.y);c.rotate(angle);c.drawImage(texture[name].boot,(bx-leg.sole[0])*s,(by-leg.sole[1])*s,bw*s,bh*s);c.restore();
      // Cloth-only texture and an explicit hem conceal the upper fur cap. The
      // original pelvis stays intact above both articulated panels.
      c.save();c.translate(hip.x,hip.y);c.rotate(-turn);c.drawImage(texture.pants,-panelWidth*.5,-8*s,panelWidth,panelLength+8*s);
      c.strokeStyle='#1d1b19';c.lineWidth=1.8*s;c.beginPath();c.moveTo(-panelWidth*.48,panelLength);c.lineTo(panelWidth*.48,panelLength);c.stroke();c.restore();
      landmarks[name]={hip,nominalHip,opening:hem,knee:joint,sole,cuff,thighLength,shinLength,bootWidth:bw*s,bootHeight:bh*s};
    }
    const [sx,sy,sw,sh]=profile.torso;c.save();bodyTransform();c.beginPath();c.rect((sx-ox)*s,(sy-oy)*s+gait.bob,sw*s,(profile.waist+12-sy)*s);
    if(!back){for(const [i,[x,y]] of [[242,322],[285,322],[292,352],[270,363],[242,348]].entries())i?c.lineTo((x-ox)*s,(y-oy)*s+gait.bob):c.moveTo((x-ox)*s,(y-oy)*s+gait.bob);c.closePath();}
    c.clip();paintCarrierBody(c,images[profile.image],profile.torso,profile.origin,s,headName,gait.bob);c.restore();c.restore();
    c.save();bodyTransform();babyFace=paintPassenger(c,images[profile.image],profile.torso,profile.origin,s,headName,options,gait.bob);c.restore();
    lastAudit={pose:'walking',carrier:back?'back':'front',integratedCarrier:true,babyFace,height:h,source:profile.image,stature:profile.stature,landmarks,gait,body:{pivot,sway:gait.sway,roll:gait.roll}};c.restore();return true;
  }
  function drawAuthored(c,image,rect,origin,scale,pose,options={}){
    if(!ready()||!heads[pose])return false;
    const babyFace=drawCarrier(c,image,rect,origin,scale,pose,options);
    lastAudit={pose,carrier:'front',integratedCarrier:true,babyFace};return true;
  }
  window.BearlyHeroRig={ready,draw,drawAuthored,babyMood,layout:()=>JSON.parse(JSON.stringify(upperBodies)),audit:()=>JSON.parse(JSON.stringify(lastAudit)),profiles:()=>JSON.parse(JSON.stringify(profiles))};
})();
