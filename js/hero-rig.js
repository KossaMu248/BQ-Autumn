/* One on-foot model: authored carrier torsos/actions and source-calibrated leg geometry. */
(() => {
  'use strict';
  const images={},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  for(const [key,file] of Object.entries({front:'front-carrier-v7.png',back:'back-carrier-v11.png',reactions:'carrier-reactions-v11.png',parts:'matched-legs-v11.png'})){
    const im=new Image();im.src='assets/art/'+file;images[key]=im;
  }
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
  function ready(){return Object.values(images).every(im=>im.naturalWidth>0);}
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
    c.drawImage(images[f.image],sx,sy,sw,sh,(sx-f.origin[0])*s,(sy-f.origin[1])*s,sw*s,sh*s);c.restore();
  }
  function draw(c,px,py,h,face,options={}){
    if(!ready())return false;
    const state=options.state||{},back=!!state.baby,profile=profiles[back?'back':'front'],s=h/profile.stature;
    const gait=window.BearlyLocomotion.pose(options.distance||0,h,options.weight||0),jump=options.jump||0;
    c.save();c.translate(px,py);if(face<0)c.scale(-1,1);
    let pose=state.hp===0?(state.defeatAge<.55?'collapse':'defeated'):state.hurt?(back?'backHurt':'frontHurt'):state.attack?'maul':state.held?'grab':null;
    if(pose){fullPose(c,pose,h);lastAudit={pose,carrier:pose==='frontHurt'?'front':'back',integratedCarrier:true,height:h,source:actions[pose].image};c.restore();return true;}
    const texture=prepareParts(),weight=clamp(options.weight||0,0,1),blend=clamp(weight/.4,0,1),ox=profile.origin[0],oy=profile.origin[1],landmarks={};
    // The standing painting has one boot permanently ahead. Ease both feet onto
    // a shared walking track so either leg can lead by the same useful distance.
    const track=(profile.near.sole[0]+profile.far.sole[0])*.5;
    if(blend<1){c.save();c.globalAlpha*=1-blend;const [sx,sy,sw,sh]=profile.torso,fullH=profile.image==='front'?489:516;c.drawImage(images[profile.image],sx,sy,sw,fullH,(sx-ox)*s,(sy-oy)*s+gait.bob,sw*s,fullH*s);c.restore();}
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
    c.clip();c.drawImage(images[profile.image],sx,sy,sw,sh,(sx-ox)*s,(sy-oy)*s+gait.bob,sw*s,sh*s);c.restore();c.restore();
    lastAudit={pose:'walking',carrier:back?'back':'front',integratedCarrier:true,height:h,source:profile.image,stature:profile.stature,landmarks,gait};c.restore();return true;
  }
  window.BearlyHeroRig={ready,draw,audit:()=>JSON.parse(JSON.stringify(lastAudit)),profiles:()=>JSON.parse(JSON.stringify(profiles))};
})();
