/* One opaque on-foot figure: original cloth/fur, rigid authored shoes and native passenger. */
(() => {
  'use strict';
  const images={},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const imageFiles={lowerIdle:'bear-idle-lower-v18.png',front:'front-carrier-v7.png',back:'back-carrier-v11.png',reactions:'carrier-reactions-v11.png',frontBackground:'front-background-v11-2.png',backBackground:'back-background-v11-2.png',reactionBackground:'reaction-background-v11-2.png',boatBackground:'boat-background-v11-2.png',transferBackground:'transfer-background-v11-2.png'};
  const decodedImages=new Set();let preloadPromise=null,preloadStarted=false;
  // Walking/carrier artwork is optional while riding. Start these requests only
  // after the critical cycling scene can draw, or when a visit requests them.
  for(const key of Object.keys(imageFiles))images[key]=new Image();
  function preload(){
    if(preloadPromise)return preloadPromise;preloadStarted=true;
    preloadPromise=Promise.all(Object.entries(imageFiles).map(([key,file])=>new Promise((resolve,reject)=>{
      const im=images[key];let finished=false;
      const finish=()=>{if(finished)return;finished=true;decodedImages.add(key);resolve();};
      im.decoding='async';im.fetchPriority='low';
      im.onload=()=>{if(typeof im.decode==='function')im.decode().then(finish,reject);else finish();};
      im.onerror=()=>reject(new Error('Unable to load carrier artwork: '+file));
      im.src='assets/art/'+file;
      if(im.naturalWidth>0&&typeof im.decode!=='function')finish();
    })));
    return preloadPromise;
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
  let lastAudit={},nativeFrames=null;
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
  function ready(){return preloadStarted&&Object.keys(imageFiles).every(key=>images[key].naturalWidth>0&&(typeof images[key].decode!=='function'||decodedImages.has(key)))&&!!window.BearlyBabyPassenger?.ready();}
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
  function fullPose(c,name,h,options={}){
    const f=actions[name],[sx,sy,sw,sh]=f.rect,s=h/f.stature;
    // The staggered sheet is not a regular grid: exclude adjacent helmet/boot tips.
    const outline=name==='grab'?[[817,8],[1381,8],[1381,502],[960,502],[960,512],[817,512]]:
      name==='backHurt'?[[944,503],[1412,503],[1412,1013],[933,1013],[933,516],[944,516]]:null;
    c.save();
    if(outline){c.beginPath();for(const [i,[x,y]] of outline.entries())i?c.lineTo((x-f.origin[0])*s,(y-f.origin[1])*s):c.moveTo((x-f.origin[0])*s,(y-f.origin[1])*s);c.closePath();c.clip();}
    const likeness=drawCarrier(c,images[f.image],f.rect,f.origin,s,name==='backIdle'?'back':name,options);c.restore();return likeness;
  }
  const BODY_HEIGHT=280,BODY_PHASES=48,bodyFrames=new Map(),bodyScratch=new Map();
  const BODY_CACHE_LIMIT=32*1024*1024;let bodyCacheHits=0,bodyCacheMisses=0,bodyCacheBytes=0,bodyBuildMs=0,maxBodyBuildMs=0,transientBuilds=0,bodyBitmaps=0,bitmapFailures=0;const bodyNow=()=>typeof performance==='object'?performance.now():Date.now();
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  function surfacePose(profile,h,gait,weight,settle=true){
    const s=h/profile.stature,ox=profile.origin[0],oy=profile.origin[1],pivot={x:((profile.near.hip[0]+profile.far.hip[0])*.5-ox)*s,y:(profile.pelvisY-oy)*s};
    const angle=gait.roll,cs=Math.cos(angle),sn=Math.sin(angle),shift={x:gait.sway,y:gait.bob-(LOWER_HEIGHT-(oy-profile.pelvisY))*s};
    const bodyPoint=(x,y)=>({x:pivot.x+(x-pivot.x)*cs-(y-pivot.y)*sn+shift.x,y:pivot.y+(x-pivot.x)*sn+(y-pivot.y)*cs+shift.y});
    const transform=c=>{c.translate(pivot.x+shift.x,pivot.y+shift.y);c.rotate(angle);c.translate(-pivot.x,-pivot.y);};
    const pelvisPoint=(x,y)=>{const blend=smooth((y/s+oy-(profile.pelvisY-45))/45),a=gait.pelvisRoll||0,dx=x-pivot.x,dy=y-pivot.y,xx=pivot.x+dx*Math.cos(a)-dy*Math.sin(a)+(gait.pelvisSway||0),yy=pivot.y+dx*Math.sin(a)+dy*Math.cos(a);return bodyPoint(x+(xx-x)*blend,y+(yy-y)*blend);};
    const pose={s,ox,oy,pivot,angle,shift,bodyPoint,pelvisPoint,transform,legs:{}};
    pose.legs=anatomicalLegs(profile,pose,gait,weight,settle);return pose;
  }
  function surfaceTriangle(c,image,source,destination){
    const [a,b,d]=source,[p,q,r]=destination,den=a.x*(b.y-d.y)+b.x*(d.y-a.y)+d.x*(a.y-b.y);if(Math.abs(den)<.0001)return;
    const A=(p.x*(b.y-d.y)+q.x*(d.y-a.y)+r.x*(a.y-b.y))/den,B=(p.y*(b.y-d.y)+q.y*(d.y-a.y)+r.y*(a.y-b.y))/den,C=(p.x*(d.x-b.x)+q.x*(a.x-d.x)+r.x*(b.x-a.x))/den,D=(p.y*(d.x-b.x)+q.y*(a.x-d.x)+r.y*(b.x-a.x))/den,E=(p.x*(b.x*d.y-d.x*b.y)+q.x*(d.x*a.y-a.x*d.y)+r.x*(a.x*b.y-b.x*a.y))/den,F=(p.y*(b.x*d.y-d.x*b.y)+q.y*(d.x*a.y-a.x*d.y)+r.y*(a.x*b.y-b.x*a.y))/den;
    // A true edge-parallel outset keeps diagonal joins fully covered by ink.
    const ap=Math.hypot(q.x-r.x,q.y-r.y),aq=Math.hypot(r.x-p.x,r.y-p.y),ar=Math.hypot(p.x-q.x,p.y-q.y),perimeter=ap+aq+ar,center={x:(ap*p.x+aq*q.x+ar*r.x)/perimeter,y:(ap*p.y+aq*q.y+ar*r.y)/perimeter},radius=Math.abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x))/perimeter,expansion=.7/Math.max(.01,radius);c.save();c.beginPath();destination.forEach((v,i)=>{const dx=v.x-center.x,dy=v.y-center.y,x=v.x+dx*expansion,y=v.y+dy*expansion;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.clip();c.transform(A,B,C,D,E,F);
    // Destination overlap cannot sample remote source pixels if a bent cloth
    // triangle becomes very thin. Keep a bounded two-source-pixel seam allowance only.
    const xs=source.map(p=>p.x),ys=source.map(p=>p.y);c.beginPath();c.rect(Math.min(...xs)-2,Math.min(...ys)-2,Math.max(...xs)-Math.min(...xs)+4,Math.max(...ys)-Math.min(...ys)+4);c.clip();c.drawImage(image,0,0);c.restore();
  }
  const LOWER_HEIGHT=190,lowerPrepared=new Map(),upperPrepared=new Map();
  // One physical material throughout idle, acceleration, every stride and stop.
  // The near thigh owns the broad front shorts panel and right-hand boot; the
  // partly hidden far thigh owns the left-hand fur/boot. Those were previously
  // assigned to different painted contact keys, changing volume mid-stride.
  const lowerKey={name:'anatomical-idle-material',image:'lowerIdle',rect:[170,94,1021,1085],waist:[650,145],floor:1179,width:590,crotch:[600,595],legs:{
    far:{hip:[510,180],knee:[455,500],cuff:[405,790],heel:[205,1010],toe:[635,1080],sole:[470,1083]},
    near:{hip:[690,180],knee:[755,530],cuff:[820,850],heel:[650,1110],toe:[1180,1150],sole:[940,1155]}
  }};
  const lowerScale=(LOWER_HEIGHT+10)/(lowerKey.floor-lowerKey.waist[1]);
  const lowerNorm=([x,y])=>({x:(x-lowerKey.waist[0])*lowerScale,y:(y-lowerKey.waist[1])*lowerScale});
  const boneLength=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function lowerPoint(profile,pose,raw){const p=lowerNorm(raw);return pose.pelvisPoint(pose.pivot.x+p.x*pose.s,(profile.pelvisY-10-pose.oy+p.y)*pose.s);}
  function lowerRest(profile,pose,raw){const p=lowerNorm(raw);return{x:pose.pivot.x+p.x*pose.s,y:(profile.pelvisY-10-pose.oy+p.y-LOWER_HEIGHT+(pose.oy-profile.pelvisY))*pose.s};}
  const settledPelves=new Map();
  function walkingSettle(profile,height,weight){
    if(!settledPelves.has(profile.image)){
      let peak=0;const canonical=280;
      for(let phase=0;phase<64;phase++){const gait=window.BearlyLocomotion.pose(window.BearlyLocomotion.cycleLength(canonical)*phase/64,canonical,1);peak=Math.max(peak,surfacePose(profile,canonical,gait,1,false).requiredDrop);}
      // A stocky bear rests with unlocked knees, rather than the old fully
      // extended lower-sheet pose that raised its head above nominal stature.
      const idle=Math.max(canonical*.03,surfacePose(profile,canonical,window.BearlyLocomotion.pose(0,canonical,0),0,false).requiredDrop);
      settledPelves.set(profile.image,{peak:peak+canonical*.002,idle});
    }
    const {peak,idle}=settledPelves.get(profile.image);return(idle+(peak-idle)*weight)*height/280;
  }
  function anatomicalLegs(profile,pose,gait,weight,settle){
    const legs={},restCenter=(lowerRest(profile,pose,lowerKey.legs.near.sole).x+lowerRest(profile,pose,lowerKey.legs.far.sole).x)*.5;
    let drop=0;
    for(const side of ['far','near']){
      const source=lowerKey.legs[side],f=gait[side],hip=lowerPoint(profile,pose,source.hip),rest=lowerRest(profile,pose,source.sole),p=lowerNorm(source.sole),a=lowerNorm(source.cuff),k=lowerNorm(source.knee),q=lowerNorm(source.hip),angle=f.angle,cs=Math.cos(angle),sn=Math.sin(angle);
      // A small depth separation remains while walking; neither foot is forced
      // onto the other foot's centre line. The actual sole is the contact point.
      const sole={x:restCenter+(rest.x-restCenter)*(1-.75*weight)+f.x-pose.s*profile.stature*.01*weight,y:rest.y+f.y};
      const rigid=raw=>{const v=lowerNorm(raw),x=(v.x-p.x)*pose.s,y=(v.y-p.y)*pose.s;return{x:sole.x+x*cs-y*sn,y:sole.y+x*sn+y*cs};};
      const ankle=rigid(source.cuff),thigh=boneLength(q,k)*pose.s,shin=boneLength(k,a)*pose.s,maxReach=(thigh+shin)*.998,dx=ankle.x-hip.x,dy=ankle.y-hip.y,vertical=Math.sqrt(Math.max(.001,maxReach*maxReach-dx*dx));
      drop=Math.max(drop,dy-vertical);
      legs[side]={source,sole,ankle,cuff:ankle,hip,thigh,shin,rigid,angle,stance:f.stance,kneeFlex:f.kneeFlex||0,contact:sole};
    }
    // The pelvis settles over the planted leg rather than stretching its bones.
    // Both carrier, torso and real hip sockets follow this same fitted motion.
    pose.requiredDrop=Math.max(0,drop);const height=pose.s*profile.stature,settled=settle?walkingSettle(profile,height,weight):0;
    pose.supportDrop=Math.max(pose.requiredDrop,settled);pose.shift.y+=pose.supportDrop+pose.s*.15*weight;
    for(const side of ['far','near']){const leg=legs[side];leg.hip=lowerPoint(profile,pose,leg.source.hip);leg.knee=window.BearlyLocomotion.knee(leg.hip,leg.ankle,leg.thigh,leg.shin);leg.heel=leg.rigid(leg.source.heel);leg.toe=leg.rigid(leg.source.toe);}
    return legs;
  }
  function lowerSplit(y){
    const points=[[94,650],[315,650],[500,650],[595,600],[700,590],[790,600],[900,610],[1083,645],[1179,645]];
    for(let i=1;i<points.length;i++)if(y<=points[i][0]){const [a,x]=points[i-1],[b,z]=points[i];return x+(z-x)*(y-a)/(b-a);}return 645;
  }
  function lowerImage(){
    if(lowerPrepared.has(0))return lowerPrepared.get(0);
    const [x,y,w,h]=lowerKey.rect,tile=document.createElement('canvas');tile.width=Math.ceil(w*lowerScale);tile.height=Math.ceil(h*lowerScale);tile.getContext('2d').drawImage(images.lowerIdle,x,y,w,h,0,0,tile.width,tile.height);
    const result={key:lowerKey,tile,scale:lowerScale};lowerPrepared.set(0,result);return result;
  }
  function lowerPart(side,shoe=false){
    const index=(side==='far'?1:2)+(shoe?2:0);if(lowerPrepared.has(index))return lowerPrepared.get(index);
    const base=lowerImage(),[rx,ry,rw,rh]=lowerKey.rect,leg=lowerKey.legs[side],tile=document.createElement('canvas');tile.width=base.tile.width;tile.height=base.tile.height;const c=tile.getContext('2d');
    c.save();c.scale(tile.width/rw,tile.height/rh);c.translate(-rx,-ry);c.beginPath();
    const low=shoe?leg.cuff[1]-5:ry,high=shoe?ry+rh:leg.cuff[1]+10,ys=[low,...[315,500,595,700,790,900,1083].filter(y=>y>low&&y<high),high];
    if(side==='far'){c.moveTo(rx,low);for(const y of ys)c.lineTo(lowerSplit(y),y);c.lineTo(rx,high);}
    else{c.moveTo(rx+rw,low);for(const y of ys)c.lineTo(lowerSplit(y),y);c.lineTo(rx+rw,high);}
    c.closePath();c.clip();c.drawImage(images.lowerIdle,...lowerKey.rect,...lowerKey.rect);c.restore();
    // Flatten these small immutable masks once, before any steady-pose bakes.
    const pixels=c.getImageData(0,0,tile.width,tile.height);if(pixels){c.clearRect(0,0,tile.width,tile.height);c.putImageData(pixels,0,0);}
    const result={...base,tile,side,shoe};lowerPrepared.set(index,result);return result;
  }
  function prepareLower(index){return index===0?lowerImage():lowerPart(index%2?'far':'near',index>=3);}
  function boneMap(raw,a,b,p,q,scale){
    const angle=Math.atan2(q.y-p.y,q.x-p.x)-Math.atan2(b[1]-a[1],b[0]-a[0]),cs=Math.cos(angle),sn=Math.sin(angle),x=(raw[0]-a[0])*lowerScale*scale,y=(raw[1]-a[1])*lowerScale*scale;
    return{x:p.x+x*cs-y*sn,y:p.y+x*sn+y*cs};
  }
  function anatomicalPoint(profile,pose,side,raw){
    const leg=pose.legs[side],source=leg.source,y=raw[1],pelvis=lowerPoint(profile,pose,raw),thigh=boneMap(raw,source.hip,source.knee,leg.hip,leg.knee,pose.s),shin=boneMap(raw,source.knee,source.cuff,leg.knee,leg.ankle,pose.s),boot=leg.rigid(raw),mix=(a,b,w)=>({x:a.x+(b.x-a.x)*w,y:a.y+(b.y-a.y)*w});
    let result=mix(pelvis,thigh,smooth((y-(source.hip[1]-35))/110));
    result=mix(result,shin,smooth((y-(source.knee[1]-45))/90));
    result=mix(result,boot,smooth((y-(source.cuff[1]-80))/55));
    // Shared crotch cloth stays one joined surface until the painted legs fork.
    const branch=smooth((y-500)/100),edge=smooth(Math.abs(raw[0]-lowerSplit(y))/70);return mix(pelvis,result,branch+(1-branch)*edge);
  }
  function lowerMesh(profile,pose,gait,weight){
    const [rx,ry,rw,rh]=lowerKey.rect,triangles=[],vertices=[],rendered={},normSource=([x,y])=>({x:(x-rx)/rw*lowerImage().tile.width,y:(y-ry)/rh*lowerImage().tile.height});
    for(const side of ['far','near']){
      const leg=pose.legs[side],raw=leg.source,part=lowerPart(side),shoe=lowerPart(side,true),rows=[ry,145,raw.hip[1],280,315,400,500,595,raw.knee[1]-45,raw.knee[1],raw.knee[1]+45,raw.cuff[1]-80,raw.cuff[1]-25,raw.cuff[1],raw.cuff[1]+10].filter((y,i,a)=>a.indexOf(y)===i).sort((a,b)=>a-b),nx=6,grid=[];
      const centre=y=>{const points=[[ry,raw.hip[0]],[raw.hip[1],raw.hip[0]],[raw.knee[1],raw.knee[0]],[raw.cuff[1],raw.cuff[0]],[1179,raw.sole[0]]];for(let i=1;i<points.length;i++)if(y<=points[i][0]){const [a,x]=points[i-1],[b,z]=points[i];return x+(z-x)*(y-a)/(b-a);}return raw.sole[0];};
      for(const y of rows)for(let col=0;col<=nx;col++){
        const left=side==='far'?rx:lowerSplit(y),right=side==='far'?lowerSplit(y):rx+rw,mid=clamp(centre(y),left+1,right-1),x=col<=nx/2?left+(mid-left)*col/(nx/2):mid+(right-mid)*(col-nx/2)/(nx/2),vertex={raw:[x,y],source:normSource([x,y]),destination:anatomicalPoint(profile,pose,side,[x,y])};grid.push(vertex);vertices.push(vertex);
      }
      for(let row=0;row<rows.length-1;row++)for(let col=0;col<nx;col++){const a=row*(nx+1)+col,b=a+1,d=a+nx+2,e=a+nx+1;for(const order of [[a,b,d],[a,d,e]]){const t=order.map(i=>grid[i]);t.image=part.tile;triangles.push(t);}}
      // A shoe has a single rigid transform; it never passes through knee skinning.
      const sy=raw.cuff[1]-5,corners=[[rx,sy],[rx+rw,sy],[rx+rw,ry+rh],[rx,ry+rh]].map(p=>({raw:p,source:normSource(p),destination:leg.rigid(p)}));
      for(const order of [[0,1,2],[0,2,3]]){const t=order.map(i=>corners[i]);t.image=shoe.tile;triangles.push(t);}vertices.push(...corners);
      // Hip/knee/ankle are explicit mesh vertices. Boot landmarks sample its
      // affine transform, the exact same transform painted by its two triangles.
      const sample=point=>{const vertex=grid.find(v=>Math.abs(v.raw[0]-point[0])<.001&&Math.abs(v.raw[1]-point[1])<.001);if(!vertex)throw Error('Missing painted anatomical joint '+side+':'+point.join(','));return vertex.destination;};
      rendered[side]={hip:sample(raw.hip),knee:sample(raw.knee),ankle:sample(raw.cuff),cuff:sample(raw.cuff),heel:leg.rigid(raw.heel),toe:leg.rigid(raw.toe),sole:leg.rigid(raw.sole),thigh:leg.thigh,shin:leg.shin,source:{image:images.lowerIdle.src.split('/').pop(),pose:lowerKey.name,hip:raw.hip,knee:raw.knee,ankle:raw.cuff,cuff:raw.cuff,heel:raw.heel,toe:raw.toe,sole:raw.sole},renderedFromSource:true};
    }
    return{source:lowerImage(),vertices,triangles,knees:Object.fromEntries(Object.entries(rendered).map(([side,leg])=>[side,leg.knee])),rendered};
  }
  function upperSource(profile,name){if(upperPrepared.has(name))return upperPrepared.get(name);const [sx,sy,sw,sh]=profile.torso,tile=document.createElement('canvas');tile.width=sw;tile.height=sh;const c=tile.getContext('2d');c.drawImage(carrierBody(images[profile.image],profile.torso,name),0,0);c.globalCompositeOperation='destination-in';c.beginPath();const outline=name==='front'?[[51,13],[307,13],[307,367],[269,367],[240,348],[235,337],[198,342],[143,340],[76,330],[51,320]]:[[252,4],[562,4],[562,340],[494,344],[440,350],[400,350],[319,339],[252,326]];for(const [i,[x,y]]of outline.entries())i?c.lineTo(x-sx,y-sy):c.moveTo(x-sx,y-sy);c.closePath();c.fill();c.globalCompositeOperation='source-over';const image=c.getImageData(0,0,sw,sh);c.putImageData(image,0,0);const result={tile,rect:profile.torso};upperPrepared.set(name,result);return result;}
  function bakeBody(profile,name,gait,weight,scratch=false){
    const buildStart=bodyNow();if(scratch)transientBuilds++;const pose=surfacePose(profile,BODY_HEIGHT,gait,weight),lower=lowerMesh(profile,pose,gait,weight),upper=upperSource(profile,name),[sx,sy,sw,sh]=upper.rect,triangles=[...lower.triangles],points=lower.vertices.map(v=>v.destination),upperTriangles=[];
    const upperPoint=(x,y)=>{const point=pose.bodyPoint((x-pose.ox)*pose.s,(y-pose.oy)*pose.s);if(name==='back'){const sleeve=Math.exp(-(((x-367)/74)**4)-((y-291)/91)**4)*smooth((y-180)/85),phase=gait.phase*Math.PI*2;point.x+=Math.cos(phase)*gait.cycleLength*.055*sleeve*weight;point.y+=Math.sin(phase)*gait.cycleLength*.007*sleeve*weight;}return point;};
    for(let row=0;row<10;row++)for(let col=0;col<6;col++){const x0=sw*col/6,x1=sw*(col+1)/6,y0=sh*row/10,y1=sh*(row+1)/10,v=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>({source:{x,y},destination:upperPoint(sx+x,sy+y)}));for(const order of [[0,1,2],[0,2,3]]){const t=order.map(i=>v[i]);upperTriangles.push(t);points.push(...t.map(p=>p.destination));}}
    const left=Math.floor(Math.min(...points.map(p=>p.x)))-2,top=Math.floor(Math.min(...points.map(p=>p.y)))-2,right=Math.ceil(Math.max(...points.map(p=>p.x)))+2,bottom=Math.ceil(Math.max(...points.map(p=>p.y)))+2,canvas=scratch?(bodyScratch.get(name)||document.createElement('canvas')):document.createElement('canvas');if(scratch)bodyScratch.set(name,canvas);canvas.width=right-left;canvas.height=bottom-top;
    canvas.dataset.sourceAsset=profile.image==='front'?'front-carrier-v7.png':'back-carrier-v11.png';canvas.dataset.sourceRect=upper.rect.join(',');canvas.dataset.sourcePose=name;canvas.dataset.sourceTransform='continuous-surface';canvas.dataset.sourceAssets=JSON.stringify([canvas.dataset.sourceAsset,images.lowerIdle.src.split('/').pop()]);canvas.dataset.lowerPose=lower.source.key.name;
    const c=canvas.getContext('2d');c.translate(-left,-top);for(const t of triangles)surfaceTriangle(c,t.image||lower.source.tile,t.map(v=>v.source),t.map(v=>v.destination));for(const t of upperTriangles)surfaceTriangle(c,upper.tile,t.map(v=>v.source),t.map(v=>v.destination));
    // Flatten the recorded mesh into pixels once. Reusing a canvas whose display
    // list still contains every clipped triangle can replay that work on draw.
    const pixels=c.getImageData(0,0,canvas.width,canvas.height);c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);c.putImageData(pixels,0,0);
    const frame={canvas,image:canvas,width:canvas.width,height:canvas.height,left,top,gait,weight,triangles:triangles.length+upperTriangles.length,rect:upper.rect,lowerPose:lower.source.key.name,lowerRect:lower.source.key.rect,knees:lower.knees,rendered:lower.rendered,disposed:false,pending:false,bitmap:false};
    if(!scratch&&window.createImageBitmap){frame.pending=true;const attribution={...canvas.dataset};window.createImageBitmap(canvas).then(bitmap=>{frame.pending=false;if(frame.disposed){bitmap.close();return;}bitmap.dataset=attribution;frame.image=bitmap;frame.bitmap=true;bodyBitmaps++;canvas.width=1;canvas.height=1;frame.canvas=null;}).catch(()=>{frame.pending=false;bitmapFailures++;});}
    const buildMs=bodyNow()-buildStart;bodyBuildMs+=buildMs;maxBodyBuildMs=Math.max(maxBodyBuildMs,buildMs);return frame;
  }
  function bodyFrame(profile,name,distance,h,weight){
    const phase=((distance/window.BearlyLocomotion.cycleLength(h))%1+1)%1,index=Math.round(phase*BODY_PHASES)%BODY_PHASES,steady=weight>=.999,idle=weight<=.0001,key=name+':'+(idle?'idle':index);
    if((steady||idle)&&bodyFrames.has(key)){bodyCacheHits++;const frame=bodyFrames.get(key);bodyFrames.delete(key);bodyFrames.set(key,frame);return frame;}
    const effectivePhase=steady?index/BODY_PHASES:phase,gait=window.BearlyLocomotion.pose(window.BearlyLocomotion.cycleLength(BODY_HEIGHT)*effectivePhase,BODY_HEIGHT,weight),frame=bakeBody(profile,name,gait,weight,!steady&&!idle);bodyCacheMisses++;
    if(steady||idle){bodyFrames.set(key,frame);bodyCacheBytes+=frame.width*frame.height*4;while(bodyCacheBytes>BODY_CACHE_LIMIT||bodyFrames.size>98){const oldest=bodyFrames.keys().next().value,evicted=bodyFrames.get(oldest);bodyCacheBytes-=evicted.width*evicted.height*4;evicted.disposed=true;if(evicted.bitmap){evicted.image.close();bodyBitmaps--;}if(evicted.canvas){evicted.canvas.width=1;evicted.canvas.height=1;}bodyFrames.delete(oldest);}}return frame;
  }
  function draw(c,px,py,h,face,options={}){
    if(!ready())return false;const state=options.state||{},back=!!state.baby,name=back?'back':'front',profile=profiles[name],s=h/profile.stature,weight=clamp(options.weight||0,0,1);
    c.save();c.translate(px,py);if(face<0)c.scale(-1,1);
    const action=state.hp===0?(state.defeatAge<.55?'collapse':'defeated'):state.hurt?(back?'backHurt':'frontHurt'):state.attack?'maul':state.held?'grab':null;
    if(action){const babyFace=fullPose(c,action,h,options);lastAudit={pose:action,carrier:action==='frontHurt'?'front':'back',integratedCarrier:true,babyFace,height:h,source:actions[action].image};c.restore();return true;}
    let slope=0;if(options.groundAt){const a=options.groundAt(px-18),b=options.groundAt(px+18);if(a!=null&&b!=null)slope=Math.atan2(b-a,36)*face;}c.rotate(slope);
    const frame=bodyFrame(profile,name,options.distance||0,h,weight),scale=h/BODY_HEIGHT;c.drawImage(frame.image,frame.left*scale,frame.top*scale,frame.width*scale,frame.height*scale);
    const gait=window.BearlyLocomotion.pose(frame.gait.phase*window.BearlyLocomotion.cycleLength(h),h,weight),pose=surfacePose(profile,h,gait,weight);c.save();pose.transform(c);const babyFace=paintPassenger(c,images[profile.image],profile.torso,profile.origin,s,name,options);c.restore();
    const landmarks={};for(const side of ['near','far']){const f=pose.legs[side],r=frame.rendered[side],point=v=>({x:v.x*scale,y:v.y*scale});landmarks[side]={...Object.fromEntries(['hip','knee','ankle','cuff','heel','toe','sole'].map(k=>[k,point(r[k])])),renderedFromSource:true,source:r.source,thighLength:r.thigh*scale,shinLength:r.shin*scale,plannedSole:f.sole,plannedCuff:f.cuff,angle:f.angle,stance:f.stance,kneeFlex:f.kneeFlex,contact:f.contact,bootWidth:Math.hypot(r.toe.x-r.heel.x,r.toe.y-r.heel.y)*scale,rigidShoe:true};}
    lastAudit={pose:'walking',carrier:name,integratedCarrier:true,babyFace,height:h,source:profile.image,sourceRect:frame.rect,lowerPose:frame.lowerPose,lowerSourceRect:frame.lowerRect,authoredLowerBody:true,stature:profile.stature,landmarks,gait,body:{pivot:pose.pivot,sway:pose.shift.x,bob:pose.shift.y,roll:pose.angle,pelvisSway:gait.pelvisSway,pelvisRoll:gait.pelvisRoll,slope,opaque:true,surfaces:1,continuous:true,triangles:frame.triangles,canonicalHeight:BODY_HEIGHT,lowerHeight:LOWER_HEIGHT,supportDrop:pose.supportDrop,anatomicalLegs:true,cachePhase:frame.gait.phase},cache:{frames:bodyFrames.size,hits:bodyCacheHits,misses:bodyCacheMisses}};c.restore();return true;
  }
  let sourceWarmupPromise=null,sourceWarmupDone=0,sourceWarmupMs=0,sourceWarmupMaxMs=0;
  function warmupSources(){
    if(sourceWarmupPromise)return sourceWarmupPromise;
    sourceWarmupPromise=preload().then(()=>new Promise((resolve,reject)=>{
      const tasks=[...Array.from({length:5},(_,index)=>()=>prepareLower(index)),()=>upperSource(profiles.front,'front'),()=>upperSource(profiles.back,'back')];
      const schedule=()=>{if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(run,{timeout:1000});else window.setTimeout(()=>run(null),32);};
      const run=deadline=>{
        // Make progress even when a busy device only grants tiny idle windows.
        // Rescheduling a fresh deadline here can starve every requested visit.
        // Each callback prepares exactly one source piece, never the full rig.
        const began=bodyNow();try{tasks.shift()();}catch(error){reject(error);return;}const elapsed=bodyNow()-began;sourceWarmupDone++;sourceWarmupMs+=elapsed;sourceWarmupMaxMs=Math.max(sourceWarmupMaxMs,elapsed);
        if(tasks.length)schedule();else resolve();
      };
      schedule();
    }));
    return sourceWarmupPromise;
  }
  function cacheStats(){return {frames:bodyFrames.size,bytes:bodyCacheBytes,limitBytes:BODY_CACHE_LIMIT,frameLimit:98,phases:BODY_PHASES,canonicalHeight:BODY_HEIGHT,hits:bodyCacheHits,misses:bodyCacheMisses,transientBuilds,bitmapFrames:bodyBitmaps,bitmapFailures,mode:window.createImageBitmap?'bitmap':'raster-canvas',pendingBitmaps:[...bodyFrames.values()].filter(f=>f.pending).length,buildMs:bodyBuildMs,maxBuildMs:maxBodyBuildMs,scratchBytes:[...bodyScratch.values()].reduce((n,c)=>n+c.width*c.height*4,0),sourceWarmup:{prepared:sourceWarmupDone,total:7,complete:sourceWarmupDone===7,buildMs:sourceWarmupMs,maxTaskMs:sourceWarmupMaxMs}};}
  function drawAuthored(c,image,rect,origin,scale,pose,options={}){
    if(!ready()||!heads[pose])return false;
    const babyFace=drawCarrier(c,image,rect,origin,scale,pose,options);
    lastAudit={pose,carrier:'front',integratedCarrier:true,babyFace};return true;
  }
  window.BearlyHeroRig={ready,preload,warmupSources,draw,drawAuthored,babyMood,cacheStats,layout:()=>JSON.parse(JSON.stringify(upperBodies)),audit:()=>JSON.parse(JSON.stringify(lastAudit)),profiles:()=>JSON.parse(JSON.stringify(profiles))};
})();
