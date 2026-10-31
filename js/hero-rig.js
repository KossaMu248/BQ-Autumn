/* One on-foot model: authored carrier torsos/actions and source-calibrated leg geometry. */
(() => {
  'use strict';
  const images={},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  for(const [key,file] of Object.entries({front:'front-carrier-v7.png',back:'back-carrier-v11.png',reactions:'carrier-reactions-v11.png',parts:'matched-legs-v11.png',frontBackground:'front-background-v11-2.png',backBackground:'back-background-v11-2.png',reactionBackground:'reaction-background-v11-2.png',boatBackground:'boat-background-v11-2.png',transferBackground:'transfer-background-v11-2.png'})){
    const im=new Image();im.src='assets/art/'+file;images[key]=im;
  }
  // Use the original character's face pixels, rather than reinterpreting his
  // identity in each carrier painting. These are head-only original textures.
  for(const [key,file] of Object.entries({portrait:'baby_pose_idle.webp'})){
    const im=new Image();im.src='assets/'+file;images[key]=im;
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
  let parts=null,lastAudit={};
  const faceTextures={};
  function ready(){return Object.values(images).every(im=>im.naturalWidth>0);}
  function originalFace(key){
    if(faceTextures[key])return faceTextures[key];
    const im=images[key],tile=document.createElement('canvas');tile.width=82;tile.height=82;
    tile.dataset.sourceAsset=im.src.split('/').pop();
    tile.dataset.sourceRect='0,0,82,82';
    const g=tile.getContext('2d');
    // The original in-game head already has its complete smile, jaw and neck.
    // Extract that natural silhouette, excluding every bicycle-seat pixel.
    g.beginPath();g.moveTo(48,73);
    g.bezierCurveTo(40,73,29,67,25,60);g.bezierCurveTo(21,57,17,51,15,46);
    g.bezierCurveTo(12,43,12,39,15,35);g.bezierCurveTo(13,27,20,16,30,12);
    g.bezierCurveTo(45,5,61,9,66,22);g.bezierCurveTo(71,29,71,35,72,39);
    g.bezierCurveTo(74,43,73,48,69,50);g.bezierCurveTo(70,57,69,63,67,66);
    g.bezierCurveTo(64,70,58,73,53,73);
    g.closePath();g.clip();g.drawImage(im,0,0);
    // At the short neck, the old sprite includes blue/white shirt pixels.
    // Remove cloth only; retain the source jaw's own skin alpha all the way to its tip.
    const pixels=g.getImageData(0,0,tile.width,tile.height);
    for(let y=64;y<tile.height;y++)for(let x=0;x<tile.width;x++){
      const i=(y*tile.width+x)*4,r=pixels.data[i],green=pixels.data[i+1],b=pixels.data[i+2];
      if(r<=green*1.04||r<=b*1.06)pixels.data[i+3]=0;
    }
    g.putImageData(pixels,0,0);
    return faceTextures[key]=tile;
  }
  function drawCarrier(c,image,rect,origin,s,headName,bob=0){
    const [sx,sy,sw,sh]=rect,[ox,oy]=origin,head=heads[headName],[hx,hy,hw,hh]=head.box;
    const X=x=>(x-ox)*s,Y=y=>(y-oy)*s+bob;
    const plate=images[backgrounds[headName]],nx=head.neck[0],ny=head.neck[1];
    const H=x=>X(head.flip<0?hx+hw-(x-hx):x);
    // Replace just the old head footprint with repaired clothing/background.
    // This keeps the narrower complete head from exposing a cut hole or an old ear.
    const hole=new Path2D();hole.moveTo(H(hx+hw*.3),Y(hy+hh+2));
    hole.bezierCurveTo(H(hx-hw*.04),Y(hy+hh*.96),H(hx-3),Y(hy+hh*.7),H(hx-3),Y(hy+hh*.43));
    hole.bezierCurveTo(H(hx-3),Y(hy+hh*.12),H(hx+hw*.2),Y(hy-3),H(hx+hw*.5),Y(hy-3));
    hole.bezierCurveTo(H(hx+hw*.91),Y(hy-3),H(hx+hw+3),Y(hy+hh*.25),H(hx+hw+3),Y(hy+hh*.5));
    hole.bezierCurveTo(H(hx+hw+5),Y(hy+hh*.68),H(hx+hw+1),Y(hy+hh*.97),H(hx+hw*.7),Y(hy+hh+2));hole.closePath();
    const body=new Path2D();body.rect(X(sx),Y(sy),sw*s,sh*s);body.addPath(hole);
    c.save();c.clip(body,'evenodd');c.drawImage(image,sx,sy,sw,sh,X(sx),Y(sy),sw*s,sh*s);c.restore();
    c.save();c.clip(hole);c.drawImage(plate,sx,sy,sw,sh,X(sx),Y(sy),sw*s,sh*s);c.restore();
    const face=originalFace('portrait'),scale=hh/61,u=hh/85,neckLength=2*u;
    c.save();c.translate(X(head.neck[0]),Y(head.neck[1]));c.rotate(head.angle);if(head.flip)c.scale(head.flip,1);
    // A short shaded neck sits behind the full jaw. Its lower end tucks into
    // the real shirt collar, which is drawn over the neck after the portrait.
    c.scale(s,s);const skin=c.createLinearGradient(0,-9*u,0,5*u);skin.addColorStop(0,'#8f7564');skin.addColorStop(1,'#c38b72');
    c.fillStyle=skin;c.beginPath();c.moveTo(-8*u,5*u);c.bezierCurveTo(-11*u,0,-8*u,-8*u,-2*u,-10*u);c.bezierCurveTo(6*u,-10*u,11*u,-u,9*u,5*u);c.closePath();c.fill();
    c.drawImage(face,-51*scale,-69*scale-neckLength,face.width*scale,face.height*scale);c.restore();
    const collarTop=Math.max(ny+3*u,hy+hh),collarBottom=hy+hh+14;
    c.drawImage(image,hx-4,collarTop,hw+8,collarBottom-collarTop,X(hx-4),Y(collarTop),(hw+8)*s,(collarBottom-collarTop)*s);
    // A curved front neckline covers the neck base, while the full chin stays
    // above it. The backing and original shirt remain behind this front fold.
    c.save();c.translate(X(nx),Y(ny));c.rotate(head.angle);if(head.flip)c.scale(head.flip,1);c.scale(s*u,s*u);
    const collar=new Path2D();collar.moveTo(-16,0);collar.bezierCurveTo(-9,4,7,6,16,1);collar.lineTo(17,9);collar.bezierCurveTo(7,13,-10,12,-18,7);collar.closePath();
    const cloth=c.createLinearGradient(0,0,0,13);cloth.addColorStop(0,'#5ca8bf');cloth.addColorStop(.45,'#2d7eaa');cloth.addColorStop(1,'#245a7f');
    c.fillStyle=cloth;c.fill(collar);c.strokeStyle='#244b68';c.lineWidth=.8;c.stroke(collar);
    c.strokeStyle='#e5e8dc';c.lineWidth=1.6;c.lineCap='round';c.beginPath();c.moveTo(-16,0);c.bezierCurveTo(-9,4,7,6,16,1);c.stroke();c.restore();
    return {source:'assets/'+face.dataset.sourceAsset,headOnly:true,completeChin:true,sourceRect:[0,0,82,82],uniformScale:scale*s,pose:headName};
  }
  function prepareParts(){
    if(parts)return parts;
    function tile(rect){const [x,y,w,h]=rect,c=document.createElement('canvas');c.width=w;c.height=h;c.dataset.sourceAsset='matched-legs-v11.png';c.getContext('2d').drawImage(images.parts,x,y,w,h,0,0,w,h);return c;}
    parts={pants:(()=>{const c=document.createElement('canvas');c.width=105;c.height=68;c.dataset.sourceAsset='front-carrier-v7.png';c.getContext('2d').drawImage(images.front,84,329,105,68,0,0,105,68);return c;})(),near:{fur:tile([180,129,515,293]),boot:tile([160,370,712,433])},far:{fur:tile([1110,160,385,267]),boot:tile([1077,372,642,421])}};return parts;
  }
  function fullPose(c,name,h){
    const f=actions[name],[sx,sy,sw,sh]=f.rect,s=h/f.stature;
    // The staggered sheet is not a regular grid: exclude adjacent helmet/boot tips.
    const outline=name==='grab'?[[817,8],[1381,8],[1381,502],[960,502],[960,512],[817,512]]:
      name==='backHurt'?[[944,503],[1412,503],[1412,1013],[933,1013],[933,516],[944,516]]:null;
    c.save();
    if(outline){c.beginPath();for(const [i,[x,y]] of outline.entries())i?c.lineTo((x-f.origin[0])*s,(y-f.origin[1])*s):c.moveTo((x-f.origin[0])*s,(y-f.origin[1])*s);c.closePath();c.clip();}
    const likeness=drawCarrier(c,images[f.image],f.rect,f.origin,s,name==='backIdle'?'back':name);c.restore();return likeness;
  }
  function draw(c,px,py,h,face,options={}){
    if(!ready())return false;
    const state=options.state||{},back=!!state.baby,profile=profiles[back?'back':'front'],s=h/profile.stature;
    const gait=window.BearlyLocomotion.pose(options.distance||0,h,options.weight||0),jump=options.jump||0;
    c.save();c.translate(px,py);if(face<0)c.scale(-1,1);
    let pose=state.hp===0?(state.defeatAge<.55?'collapse':'defeated'):state.hurt?(back?'backHurt':'frontHurt'):state.attack?'maul':state.held?'grab':null;
    if(pose){const babyFace=fullPose(c,pose,h);lastAudit={pose,carrier:pose==='frontHurt'?'front':'back',integratedCarrier:true,babyFace,height:h,source:actions[pose].image};c.restore();return true;}
    const texture=prepareParts(),weight=clamp(options.weight||0,0,1),blend=clamp(weight/.4,0,1),ox=profile.origin[0],oy=profile.origin[1],landmarks={};
    // The standing painting has one boot permanently ahead. Ease both feet onto
    // a shared walking track so either leg can lead by the same useful distance.
    const track=(profile.near.sole[0]+profile.far.sole[0])*.5;
    const headName=back?'back':'front';let babyFace;
    if(blend<1){c.save();c.globalAlpha*=1-blend;const [sx,sy,sw,sh]=profile.torso,fullH=profile.image==='front'?489:516;babyFace=drawCarrier(c,images[profile.image],[sx,sy,sw,fullH],profile.origin,s,headName,gait.bob);c.restore();}
    c.save();c.globalAlpha*=blend;
    for(const name of ['far','near']){
      const leg=profile[name],f=gait[name],hip={x:(leg.hip[0]-ox)*s,y:(profile.pelvisY-oy)*s+gait.bob};
      const sole={x:(track-ox+(leg.sole[0]-track)*(1-.85*weight))*s+f.x,y:(leg.sole[1]-oy)*s+f.y-h*.035*Math.min(1,jump/35)};
      let angle=f.angle;
      if(options.groundAt){
        const wx=px+face*sole.x,base=options.groundAt(px),at=options.groundAt(wx);
        if(base!=null&&at!=null)sole.y+=at-base;
        const a=options.groundAt(wx-4),b=options.groundAt(wx+4);if(f.stance&&a!=null&&b!=null)angle+=Math.atan2(b-a,8)*face;
      }
      const ax=(leg.cuff[0]-leg.sole[0])*s,ay=(leg.cuff[1]-leg.sole[1])*s,cs=Math.cos(angle),sn=Math.sin(angle);
      const cuff={x:sole.x+ax*cs-ay*sn,y:sole.y+ax*sn+ay*cs};
      const joint=window.BearlyLocomotion.knee(hip,cuff,(leg.hip[1]-profile.pelvisY+8)*s,(leg.cuff[1]-leg.hip[1]+18)*s);
      function link(im,a,b,width,padding){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(dy,dx)-Math.PI/2);c.drawImage(im,-width*.5,-padding,width,len+padding*2);c.restore();}
      link(texture[name].fur,joint,cuff,leg.furWidth*s,8*s);
      const [bx,by,bw,bh]=leg.boot;c.save();c.translate(sole.x,sole.y);c.rotate(angle);c.drawImage(texture[name].boot,(bx-leg.sole[0])*s,(by-leg.sole[1])*s,bw*s,bh*s);c.restore();
      // Keep the upper shorts/pelvis intact. Fabric cuffs turn less than the
      // underlying thigh so the two panels do not scissor across the crotch.
      const thigh=Math.hypot(joint.x-hip.x,joint.y-hip.y),turn=clamp(Math.atan2(joint.x-hip.x,joint.y-hip.y)*.6,-.4,.4);
      const hem={x:hip.x+Math.sin(turn)*thigh,y:hip.y+Math.cos(turn)*thigh};
      link(texture.pants,hip,hem,(name==='near'?104:70)*s,9*s);
      landmarks[name]={hip,opening:{x:(leg.hip[0]-ox)*s,y:(leg.hip[1]-oy)*s},knee:joint,sole,cuff,bootWidth:bw*s,bootHeight:bh*s};
    }
    const [sx,sy,sw,sh]=profile.torso;c.save();c.beginPath();c.rect((sx-ox)*s,(sy-oy)*s+gait.bob,sw*s,(profile.waist-sy)*s);
    if(!back){for(const [i,[x,y]] of [[242,322],[285,322],[292,352],[270,363],[242,348]].entries())i?c.lineTo((x-ox)*s,(y-oy)*s+gait.bob):c.moveTo((x-ox)*s,(y-oy)*s+gait.bob);c.closePath();}
    c.clip();babyFace=drawCarrier(c,images[profile.image],profile.torso,profile.origin,s,headName,gait.bob);c.restore();c.restore();
    lastAudit={pose:'walking',carrier:back?'back':'front',integratedCarrier:true,babyFace,height:h,source:profile.image,stature:profile.stature,landmarks,gait};c.restore();return true;
  }
  function drawAuthored(c,image,rect,origin,scale,pose){
    if(!ready()||!heads[pose])return false;
    const babyFace=drawCarrier(c,image,rect,origin,scale,pose);
    lastAudit={pose,carrier:'front',integratedCarrier:true,babyFace};return true;
  }
  window.BearlyHeroRig={ready,draw,drawAuthored,audit:()=>JSON.parse(JSON.stringify(lastAudit)),profiles:()=>JSON.parse(JSON.stringify(profiles))};
})();
