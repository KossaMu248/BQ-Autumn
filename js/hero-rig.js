/* One on-foot model: authored carrier torsos/actions and source-calibrated leg geometry. */
(() => {
  'use strict';
  const images={},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  for(const [key,file] of Object.entries({front:'front-carrier-v7.png',back:'back-carrier-v11.png',reactions:'carrier-reactions-v11.png',parts:'matched-legs-v11.png'})){
    const im=new Image();im.src='assets/art/'+file;images[key]=im;
  }
  // Use the original character's face pixels, rather than reinterpreting his
  // identity in each carrier painting. These are head-only original textures.
  for(const [key,file] of Object.entries({smile:'face_smile.webp',excited:'face_happy.webp'})){
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
    const im=images[key],tile=document.createElement('canvas');tile.width=im.naturalWidth;tile.height=im.naturalHeight;
    tile.dataset.sourceAsset=im.src.split('/').pop();
    const g=tile.getContext('2d');g.drawImage(im,0,0);
    // Only soften the cropped bottom of the jaw into the shirt collar. Eyes,
    // nose and smile remain the original pixels at a uniform scale.
    const fade=g.createLinearGradient(0,tile.height-13,0,tile.height);fade.addColorStop(0,'#fff');fade.addColorStop(1,'#fff0');
    g.globalCompositeOperation='destination-in';g.fillStyle=fade;g.fillRect(0,0,tile.width,tile.height);
    return faceTextures[key]=tile;
  }
  function drawCarrier(c,image,rect,origin,s,headName,bob=0){
    const [sx,sy,sw,sh]=rect,[ox,oy]=origin,head=heads[headName],[hx,hy,hw,hh]=head.box;
    const X=x=>(x-ox)*s,Y=y=>(y-oy)*s+bob;
    const H=x=>X(head.flip<0?hx+hw-(x-hx):x),rear=head.flip<0?hx-2:hx+1;
    // Remove the generated head silhouette before placing the real one. A
    // head-shaped hole retains the adjacent harness, fur and supporting arms.
    c.save();c.beginPath();c.rect(X(sx),Y(sy),sw*s,sh*s);
    c.moveTo(H(hx+hw*.35),Y(head.flip<0?hy+hh+1:hy+hh*.88));
    c.bezierCurveTo(H(hx+hw*.03),Y(hy+hh*(head.flip<0?.94:.85)),H(rear),Y(hy+hh*.67),H(rear),Y(hy+hh*.43));
    c.bezierCurveTo(H(rear),Y(hy+hh*.12),H(hx+hw*.2),Y(hy-2),H(hx+hw*.5),Y(hy-1));
    c.bezierCurveTo(H(hx+hw*.9),Y(hy-2),H(hx+hw+2),Y(hy+hh*.28),H(hx+hw*.96),Y(hy+hh*.5));
    c.bezierCurveTo(H(hx+hw+3),Y(hy+hh*.66),H(hx+hw),Y(hy+hh*.85),H(hx+hw*.7),Y(hy+hh*.88));
    c.closePath();c.clip('evenodd');c.drawImage(image,sx,sy,sw,sh,X(sx),Y(sy),sw*s,sh*s);c.restore();
    const key=['maul','grab'].includes(headName)?'excited':'smile',face=originalFace(key);
    const headHeight=Math.max(hh,hw*face.height/face.width),scale=headHeight/face.height;
    c.save();c.translate(X(head.neck[0]),Y(head.neck[1]));c.rotate(head.angle);if(head.flip)c.scale(head.flip,1);
    c.drawImage(face,-face.width*.575*scale*s,-(face.height-6)*scale*s,face.width*scale*s,face.height*scale*s);c.restore();
    return {source:'assets/'+face.dataset.sourceAsset,headOnly:true,uniformScale:scale*s,pose:headName};
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
