/* Relaxed street locomotion and civilian activities. Source pixels stay authored;
   a connected texture mesh supplies continuous opposing steps and relaxed arms. */
(() => {
  'use strict';
  const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),atlases={},profiles=Array.from({length:12},(_,variant)=>({variant,poses:{},heightScale:variant===9?1.05:variant===11?.84:1}));
  let lastAudit=null;
  const specifications=[
    ...['a','b','c'].map((pack,index)=>({file:`npc-motion-${pack}-v16.png`,rows:3,cols:5,variants:[index*3,index*3+1,index*3+2],poses:['idle','walkA','walkB','runA','runB']})),
    {file:'civilian-standing-v16.png',rows:1,cols:3,variants:[9,10,11],poses:['idle'],standing:true},
    {file:'civilian-motion-v16.png',rows:3,cols:4,variants:[9,10,11],poses:['walkA','walkB','runA','runB']},
    {file:'civilian-rest-v16.png',rows:3,cols:4,variants:[9,10,11],poses:['sit','read','smoke','hide']},
    {file:'civilian-reactions-v16.png',rows:3,cols:5,variants:[9,10,11],poses:['hurt','fall','prone','screen','screenDamaged']}
  ];
  const sourceFacing=variant=>variant===0||variant===3?-1:1;
  const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};

  // Resolve ownership from the opaque authored bodies, then grow into their
  // translucent edges. This keeps whole toes/hoods even when the atlas is not a
  // mathematically perfect grid, without importing the neighbour's silhouette.
  function prepare(spec,image){
    const source=make(image.naturalWidth,image.naturalHeight),g=source.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
    const rgba=g.getImageData(0,0,source.width,source.height).data,w=source.width,h=source.height,size=w*h,cw=w/spec.cols,ch=h/spec.rows;
    for(const at of [0,w-1,(h-1)*w,size-1])if(rgba[at*4+3]>1)throw Error('Motion atlas must have transparent corners: '+spec.file);
    const labels=new Int16Array(size),seen=new Uint8Array(size),queue=new Int32Array(size),components=[];
    for(let seed=0;seed<size;seed++){
      if(seen[seed]||rgba[seed*4+3]<160)continue;
      let head=0,tail=1,sumX=0,sumY=0;queue[0]=seed;seen[seed]=1;
      while(head<tail){const at=queue[head++],x=at%w,y=Math.floor(at/w);sumX+=x;sumY+=y;
        for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
          const xx=x+ox,yy=y+oy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
          const next=yy*w+xx;if(seen[next]||rgba[next*4+3]<160)continue;seen[next]=1;queue[tail++]=next;
        }
      }
      if(tail>1500)components.push({pixels:queue.slice(0,tail),x:sumX/tail,y:sumY/tail,count:tail});
    }
    const cells=Array.from({length:spec.rows*spec.cols},()=>[]);
    for(const body of components){const col=clamp(Math.floor(body.x/cw),0,spec.cols-1),row=clamp(Math.floor(body.y/ch),0,spec.rows-1);cells[row*spec.cols+col].push(body);}
    if(cells.some(v=>!v.length))throw Error('Missing complete motion pose: '+spec.file);
    // Large disconnected props such as a newspaper belong to the same pose.
    let head=0,tail=0;for(let i=0;i<cells.length;i++)for(const body of cells[i])for(const at of body.pixels){labels[at]=i+1;queue[tail++]=at;}
    while(head<tail){const at=queue[head++],x=at%w,y=Math.floor(at/w),label=labels[at];
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
        const xx=x+ox,yy=y+oy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const next=yy*w+xx;
        if(labels[next]||!rgba[next*4+3])continue;labels[next]=label;queue[tail++]=next;
      }
    }
    // Isolated smoke/soft ink has no opaque bridge. Keep it in its own cell.
    for(let at=0;at<size;at++)if(rgba[at*4+3]&&!labels[at])labels[at]=clamp(Math.floor(Math.floor(at/w)/ch),0,spec.rows-1)*spec.cols+clamp(Math.floor((at%w)/cw),0,spec.cols-1)+1;
    const bounds=cells.map(()=>[w,h,-1,-1]),cores=cells.map(()=>[w,h,-1,-1]);
    for(let at=0;at<size;at++)if(labels[at]){const b=bounds[labels[at]-1],x=at%w,y=Math.floor(at/w);b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);
      if(rgba[at*4+3]>=160){const q=cores[labels[at]-1];q[0]=Math.min(q[0],x);q[1]=Math.min(q[1],y);q[2]=Math.max(q[2],x);q[3]=Math.max(q[3],y);}}
    for(let index=0;index<cells.length;index++){
      const row=Math.floor(index/spec.cols),col=index%spec.cols,variant=spec.standing?spec.variants[col]:spec.variants[row],pose=spec.standing?'idle':spec.poses[col];
      const [x0,y0,x1,y1]=bounds[index],rect=[x0,y0,x1-x0+1,y1-y0+1],tile=make(rect[2],rect[3]),tg=tile.getContext('2d'),pixels=tg.createImageData(rect[2],rect[3]);
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const at=y*w+x;if(labels[at]!==index+1)continue;const d=((y-y0)*rect[2]+x-x0)*4;for(let k=0;k<4;k++)pixels.data[d+k]=rgba[at*4+k];}
      tg.putImageData(pixels,0,0);tile.dataset.sourceAsset=spec.file;tile.dataset.sourceRect=rect.join(',');tile.dataset.sourcePose=pose;tile.dataset.sourceVariant=String(variant);
      const core=cores[index],frame={variant,pose,source:'assets/art/'+spec.file,rect,core:[core[0],core[1],core[2]-core[0]+1,core[3]-core[1]+1],anchor:[(core[0]+core[2])*.5,core[3]],stature:core[3]-core[1],sourceFace:sourceFacing(variant),tile};
      profiles[variant].poses[pose]=frame;
    }
  }
  function finalize(){
    for(const profile of profiles){
      const idle=profile.poses.idle;if(!idle)continue;
      const base=idle.stature;profile.stature=base;
      for(const frame of Object.values(profile.poses)){
        if(frame.pose==='idle')continue;
        const family=frame.source.split('/').pop();
        if(family.startsWith('npc-motion-')){
          frame.stature=base;
          // These cells share one physical scale and floor within their row.
          const atlas=atlases[family],col=specifications.find(s=>s.file===family).poses.indexOf(frame.pose),cellW=atlas.image.naturalWidth/5;
          frame.anchor=[idle.anchor[0]+col*cellW,idle.anchor[1]];
        }else if(family==='civilian-motion-v16.png'){
          const walk=[profile.poses.walkA,profile.poses.walkB];frame.stature=Math.max(...walk.map(f=>f.core[3]));
        }else if(family==='civilian-rest-v16.png'){
          const smoke=profile.poses.smoke;frame.stature=smoke.core[3];
          if(['sit','read','hide'].includes(frame.pose))frame.stature*=1.18;
        }else if(family==='civilian-reactions-v16.png'){
          frame.stature=profile.poses.hurt.core[3];
        }
      }
      // Measured buttock contact points in the authored seated paintings.
      if(profile.variant>=9){
        const pivots=[[[170,265],[548,265]],[[160,614],[541,614]],[[185,946],[565,945]]][profile.variant-9];
        for(const [i,pose]of ['sit','read'].entries())if(profile.poses[pose])profile.poses[pose].seatPivot=pivots[i];
      }
    }
  }
  for(const spec of specifications){const image=new Image(),entry={image,ready:false,error:null};atlases[spec.file]=entry;
    image.onload=()=>{try{prepare(spec,image);finalize();entry.ready=true;entry.error=null;}catch(e){entry.error=String(e);}};image.onerror=()=>entry.error='Missing '+spec.file;image.src='assets/art/'+spec.file;
  }
  function ready(){return Object.values(atlases).every(a=>a.ready)&&profiles.every(p=>p.poses.idle);}
  function publicFrame(frame){const {tile,feet,legSplit,...data}=frame;return JSON.parse(JSON.stringify({...data,heightScale:profiles[frame.variant].heightScale}));}
  function frames(){return profiles.flatMap(p=>Object.values(p.poses).map(publicFrame));}
  function get(variant,pose='idle'){const profile=profiles[((variant%12)+12)%12];return profile?.poses[pose]||profile?.poses.idle;}
  function raw(c,frame,x,y,height,face=1,alpha=1){
    const s=height/frame.stature,flip=face*frame.sourceFace<0?-1:1,[sx,sy]=frame.rect,[ax,ay]=frame.anchor;
    c.save();c.translate(x,y);c.scale(flip,1);c.globalAlpha*=alpha;c.drawImage(frame.tile,(sx-ax)*s,(sy-ay)*s,frame.tile.width*s,frame.tile.height*s);c.restore();
  }
  function drawPose(c,{variant=0,pose='idle',x=0,y=0,height=130,face=1,alpha=1}={}){const frame=get(variant,pose);if(!frame)return false;raw(c,frame,x,y,height,face,alpha);return true;}
  function source(variant,pose){const frame=get(variant,pose);return frame?{image:frame.tile,rect:[0,0,frame.tile.width,frame.tile.height],original:publicFrame(frame)}:null;}

  function foot(phase,h,half){const p=((phase%1)+1)%1,duty=.62;if(p<duty)return{x:half*(1-2*p/duty),y:0,angle:p>duty-.12?(p-duty+.12)*.65:0,stance:true};const t=(p-duty)/(1-duty);return{x:-half*Math.cos(Math.PI*t),y:-h*.070*Math.sin(Math.PI*t),angle:-.19*Math.sin(Math.PI*t),stance:false};}
  function triangle(c,image,source,destination){
    const [a,b,d]=source,[p,q,r]=destination,den=a.x*(b.y-d.y)+b.x*(d.y-a.y)+d.x*(a.y-b.y);if(Math.abs(den)<.0001)return;
    const A=(p.x*(b.y-d.y)+q.x*(d.y-a.y)+r.x*(a.y-b.y))/den,B=(p.y*(b.y-d.y)+q.y*(d.y-a.y)+r.y*(a.y-b.y))/den;
    const C=(p.x*(d.x-b.x)+q.x*(a.x-d.x)+r.x*(b.x-a.x))/den,D=(p.y*(d.x-b.x)+q.y*(a.x-d.x)+r.y*(b.x-a.x))/den;
    const E=(p.x*(b.x*d.y-d.x*b.y)+q.x*(d.x*a.y-a.x*d.y)+r.x*(a.x*b.y-b.x*a.y))/den,F=(p.y*(b.x*d.y-d.x*b.y)+q.y*(d.x*a.y-a.x*d.y)+r.y*(a.x*b.y-b.x*a.y))/den;
    const center={x:(p.x+q.x+r.x)/3,y:(p.y+q.y+r.y)/3};
    c.save();c.beginPath();destination.forEach((v,i)=>{const dx=v.x-center.x,dy=v.y-center.y,length=Math.hypot(dx,dy)||1,x=v.x+dx/length*.65,y=v.y+dy/length*.65;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.clip();c.transform(A,B,C,D,E,F);c.drawImage(image,0,0);c.restore();
  }
  function rig(c,frame,phase,h,face){
    const s=h/frame.stature,[rx,ry]=frame.rect,[cx,cy,cw,ch]=frame.core,ax=frame.anchor[0]-rx,ay=frame.anchor[1]-ry,top=cy-ry,left=cx-rx;
    const flip=face*frame.sourceFace<0?-1:1,front=frame.sourceFace,half=h*.17,bodyX=h*.007*Math.sin(phase*TAU),bob=-h*.005*(1-Math.cos(phase*TAU*2)),sway=.008*Math.sin(phase*TAU);
    if(!frame.feet){
      const w=frame.tile.width,hh=frame.tile.height,rgba=frame.tile.getContext('2d').getImageData(0,0,w,hh).data,visited=new Uint8Array(w*hh),bodies=[],start=Math.floor(top+ch*.90);
      for(let y=start;y<hh;y++)for(let x=0;x<w;x++){const seed=y*w+x;if(visited[seed]||rgba[seed*4+3]<160)continue;const queue=[seed];visited[seed]=1;let head=0,xx=0,count=0,x0=w,x1=0,y1=0;
        while(head<queue.length){const at=queue[head++],px=at%w,py=Math.floor(at/w);xx+=px;count++;x0=Math.min(x0,px);x1=Math.max(x1,px);y1=Math.max(y1,py);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=px+dx,ny=py+dy,next=ny*w+nx;if(nx<0||nx>=w||ny<start||ny>=hh||visited[next]||rgba[next*4+3]<160)continue;visited[next]=1;queue.push(next);}}
        if(count>50)bodies.push({x:xx/count,y:y1,x0,x1,count});
      }
      bodies.sort((a,b)=>b.count-a.count);const pair=bodies.slice(0,2).sort((a,b)=>a.x-b.x);
      frame.feet=pair.length===2?pair:[{x:left+cw*.25,y:ay,x1:left+cw*.49},{x:left+cw*.75,y:ay,x0:left+cw*.51}];frame.legSplit=(frame.feet[0].x1+frame.feet[1].x0)/2;
    }
    const point=(x,y)=>{const xx=(x-ax)*s,yy=(y-ay)*s;return{x:xx*Math.cos(sway)-yy*Math.sin(sway)+bodyX,y:xx*Math.sin(sway)+yy*Math.cos(sway)+bob};};
    const feet=frame.feet.map((p,i)=>{const f=foot(phase+i*.5,h,half),base=point(p.x,p.y),sole={x:front*f.x+(i?1:-1)*h*.012,y:f.y};return{source:p,sole,delta:{x:sole.x-base.x,y:sole.y-base.y},stance:f.stance,angle:f.angle};});
    const map=(x,y,legSide)=>{
      const u=(x-left)/cw,v=(y-top)/ch,side=Math.sign(u-.5),outer=clamp((Math.abs(u-.5)-.20)/.28,0,1),armDown=clamp((v-.21)/.40,0,1),armStop=1-clamp((v-.66)/.07,0,1),base=point(x,y);
      // Each pixel belongs to one continuous surface. The outer sleeves and
      // hands retain torso motion; only the inner trouser branches follow feet.
      const protectHands=1-clamp((Math.abs(u-.5)-.24)/.16,0,1)*(1-clamp((v-.66)/.08,0,1));
      const legT=clamp((v-.51)/.40,0,1),weight=legT*legT*(3-2*legT)*protectHands,leg=feet[legSide];
      const arm=side*front*Math.cos(phase*TAU)*h*.046*outer*armDown*armStop;
      return{x:base.x+leg.delta.x*weight+arm,y:base.y+leg.delta.y*weight-h*.006*Math.sin(phase*TAU)**2*outer*armDown*armStop};
    };
    c.save();c.scale(flip,1);
    // Keep each shoe rigid and plant it at its measured source sole. The mesh
    // overlaps only its ankle; it cannot stretch a trainer into a flat wedge.
    for(const i of [1,0]){const f=feet[i],x0=i?frame.legSplit:0,x1=i?frame.tile.width:frame.legSplit;c.save();c.translate(f.sole.x,f.sole.y);c.rotate(front*f.angle);c.scale(s,s);c.translate(-f.source.x,-f.source.y);c.beginPath();c.rect(x0,top+ch*.89,x1-x0,frame.tile.height);c.clip();c.drawImage(frame.tile,0,0);c.restore();}
    const nx=5,ny=17,end=top+ch*.91;
    for(let side=0;side<2;side++)for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){
      const leftEdge=side?frame.legSplit:0,rightEdge=side?frame.tile.width:frame.legSplit,x0=leftEdge+(rightEdge-leftEdge)*col/nx,x1=leftEdge+(rightEdge-leftEdge)*(col+1)/nx,y0=end*row/ny,y1=end*(row+1)/ny;
      const a={x:x0,y:y0},b={x:x1,y:y0},d={x:x1,y:y1},e={x:x0,y:y1};triangle(c,frame.tile,[a,b,d],[map(x0,y0,side),map(x1,y0,side),map(x1,y1,side)]);triangle(c,frame.tile,[a,d,e],[map(x0,y0,side),map(x1,y1,side),map(x0,y1,side)]);
    }
    c.restore();return{phase,landmarks:{near:{sole:feet[0].sole,stance:feet[0].stance},far:{sole:feet[1].sole,stance:feet[1].stance}},bodyShift:bodyX,bob,sway,halfStride:half,armSwing:h*.046,connectedMesh:true};
  }
  function seated(c,frame,x,y,h,face,seatHeight,t=0,reading=false){
    const s=h/frame.stature,flip=face*frame.sourceFace<0?-1:1,[px,py]=frame.seatPivot||frame.anchor,[sx,sy]=frame.rect;
    c.save();c.translate(x,y-seatHeight);c.rotate(Math.sin(t*.75+frame.variant)* (reading?.0035:.0018));c.scale(flip,1+.0025*Math.sin(t*1.6+frame.variant));c.drawImage(frame.tile,(sx-px)*s,(sy-py)*s,frame.tile.width*s,frame.tile.height*s);c.restore();
  }
  function draw(c,n,x,y,height=130,scale=1){
    if(n.active===false||n.visible===false)return true;
    const variant=Number.isFinite(n.variant)?((n.variant%12)+12)%12:0,profile=profiles[variant],reaction=['stagger','fall','dead','down','rise'].includes(n.state);
    if(!ready()||!profile?.poses.idle)return false;
    if(variant<9&&(reaction||n.state==='held'))return false;
    const moving=!!n.moving,aggressive=n.hostile||n.mood==='hostile'||n.mood==='aggressive',activity=n.activity||(moving?(aggressive?'run':'walk'):'idle'),face=n.face||1,h=height*profile.heightScale,t=n.age||0;
    let pose='idle',mode=activity,phase=0,details=null;
    if(variant>=9&&reaction)pose=n.state==='stagger'?'hurt':n.state==='fall'?(n.age<.4?'fall':'prone'):n.state==='rise'?(n.age<.25?'prone':'hurt'):'prone';
    else if(n.state==='held')pose=variant>=9?'hurt':'idle';
    else if(['sit','read','smoke','hide'].includes(activity))pose=profile.poses[activity]?activity:'idle';
    else if(['run','flee'].includes(activity)||n.running){phase=(n.distance||0)/(h*1.05);pose=((phase%1)+1)%1<.5?'runA':'runB';}
    else if(moving||activity==='walk'){phase=(n.distance||0)/(h*.72);pose='idle';mode='walk';}
    else if(aggressive&&variant<9)return false;
    const frame=get(variant,pose);if(!frame)return false;
    c.save();c.translate(x,y);c.scale(scale,scale);
    if(mode==='walk'&&!reaction){details=rig(c,frame,phase,h,face);}
    else if(!reaction&&(['run','flee'].includes(activity)||n.running)){
      const flight=-(Math.sin(((phase%1)+1)%1*Math.PI*2)**2)*h*.035,lean=(face>0?1:-1)*.055;
      c.save();c.translate(0,flight);c.rotate(lean);raw(c,frame,0,0,h,face);c.restore();
    }else if(['sit','read'].includes(pose)&&frame.seatPivot){seated(c,frame,0,0,h,face,n.activityProp?.seatHeight??h*.29,t,pose==='read');}
    else if(activity==='hide'&&variant<9){c.save();c.scale(1,.65);raw(c,frame,0,0,h,face);c.restore();}
    else{const breathing=!reaction&&n.state!=='held'?1+.004*Math.sin(t*1.8+variant):1;c.save();c.scale(1,breathing);raw(c,frame,0,0,h,face);c.restore();}
    if(activity==='smoke'&&!reaction){
      // The painted cigarette stays in its authored hand; soft wisps rise and
      // drift independently instead of remaining a frozen part of the pose.
      c.save();c.translate(face*h*.14,-h*.68);c.strokeStyle='rgba(230,236,230,.22)';c.lineWidth=Math.max(.6,h*.005);
      for(let i=0;i<3;i++){const p=((t*.22+i/3)%1+1)%1,drift=Math.sin(t*.7+i)*h*.018,yy=-p*h*.20;c.globalAlpha=Math.sin(p*Math.PI)*.65;c.beginPath();c.moveTo(drift,yy);c.bezierCurveTo(drift+h*.016,yy-h*.022,drift-h*.014,yy-h*.035,drift+h*.007,yy-h*.055);c.stroke();}c.restore();
    }
    if(n.state==='held'){/* Supporting hands/throw motion is provided by the bear rig. */}
    c.restore();lastAudit={variant,activity,pose,phase,source:frame.source,sourceRect:frame.rect,height:h,heightScale:profile.heightScale,civilian:n.civilian===true,details};return true;
  }
  window.BearlyNpcMotion={ready,frames,frame:(variant,pose)=>{const f=get(variant,pose);return f?publicFrame(f):null;},source,drawPose,draw,audit:()=>lastAudit?JSON.parse(JSON.stringify(lastAudit)):null,diagnostics:()=>Object.fromEntries(Object.entries(atlases).map(([k,v])=>[k,{ready:v.ready,error:v.error}]))};
})();
