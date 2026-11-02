/* Relaxed street locomotion and civilian activities. Source pixels stay authored;
   a connected texture mesh supplies continuous opposing steps and relaxed arms. */
(() => {
  'use strict';
  // Lossless build caches contain the exact approved prepared source pixels.
  // Fetch/decode once; small sprite installs yield rather than flood-fill sheets
  // on the input/render thread (including browsers without OffscreenCanvas).
  const renderCache=window.BearlyActorRenderCache||(window.BearlyActorRenderCache=(()=>{
    let preparation=Promise.resolve();const prepare=task=>{const next=preparation.then(task);preparation=next.catch(()=>{});return next;};
    const images=new Map(),manifest=typeof fetch==='function'?fetch('assets/cache/actors-v19-manifest.json').then(r=>{if(!r.ok)throw Error('Actor render cache '+r.status);return r.json();}):Promise.reject(Error('No render-cache fetch'));
    const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
    const image=file=>{if(images.has(file))return images.get(file);const pending=new Promise((resolve,reject)=>{const im=new Image();im.decoding='async';im.fetchPriority='low';im.onload=async()=>{try{await im.decode?.();}catch{}resolve(im);};im.onerror=()=>reject(Error('Missing '+file));im.src=file;});images.set(file,pending);return pending;};
    return{manifest,image,yieldTask,prepare};
  })());
  const yieldPreparation=()=>window.__BEARLY_BUILD_RENDER_CACHE?Promise.resolve():renderCache.yieldTask();
  const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),atlases={},profiles=Array.from({length:12},(_,variant)=>({variant,poses:{},heightScale:variant===9?1.05:variant===11?.84:1}));
  let lastAudit=null;
  const WALK_PHASES=48,CACHE_LIMIT=48*1024*1024,walkBanks=new Map();
  const neutralFrames=new Map();let neutralBytes=0;
  let cacheWorker=null,cacheWorkerURL=null,workerJob=null;
  const cacheState={height:144,started:false,scheduled:false,complete:false,mode:'idle',startedAt:0,completedMs:0,bytes:0,hits:0,misses:0,bakes:0,buildMs:0,maxBuildMs:0,mainBuildMs:0,maxMainBuildMs:0};
  const phaseOrder=[0,24,12,36,6,30,18,42,3,27,15,39,9,33,21,45,...Array.from({length:48},(_,i)=>i).filter(i=>i%3)];
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
  async function prepare(spec,image){
    const source=make(image.naturalWidth,image.naturalHeight),g=source.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
    const rgba=g.getImageData(0,0,source.width,source.height).data,w=source.width,h=source.height,size=w*h,cw=w/spec.cols,ch=h/spec.rows;
    for(const at of [0,w-1,(h-1)*w,size-1])if(rgba[at*4+3]>1)throw Error('Motion atlas must have transparent corners: '+spec.file);
    const labels=new Int16Array(size),seen=new Uint8Array(size),queue=new Int32Array(size),components=[];
    for(let seed=0;seed<size;seed++){
      if((seed&65535)===0)await yieldPreparation();
      if(seen[seed]||rgba[seed*4+3]<160)continue;
      let head=0,tail=1,sumX=0,sumY=0;queue[0]=seed;seen[seed]=1;
      while(head<tail){if((head&2047)===0)await yieldPreparation();const at=queue[head++],x=at%w,y=Math.floor(at/w);sumX+=x;sumY+=y;
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
    while(head<tail){if((head&2047)===0)await yieldPreparation();const at=queue[head++],x=at%w,y=Math.floor(at/w),label=labels[at];
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
        const xx=x+ox,yy=y+oy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const next=yy*w+xx;
        if(labels[next]||!rgba[next*4+3])continue;labels[next]=label;queue[tail++]=next;
      }
    }
    // Isolated smoke/soft ink has no opaque bridge. Keep it in its own cell.
    for(let at=0;at<size;at++){if((at&65535)===0)await yieldPreparation();if(rgba[at*4+3]&&!labels[at])labels[at]=clamp(Math.floor(Math.floor(at/w)/ch),0,spec.rows-1)*spec.cols+clamp(Math.floor((at%w)/cw),0,spec.cols-1)+1;}
    const bounds=cells.map(()=>[w,h,-1,-1]),cores=cells.map(()=>[w,h,-1,-1]);
    for(let at=0;at<size;at++){if((at&65535)===0)await yieldPreparation();if(labels[at]){const b=bounds[labels[at]-1],x=at%w,y=Math.floor(at/w);b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);
      if(rgba[at*4+3]>=160){const q=cores[labels[at]-1];q[0]=Math.min(q[0],x);q[1]=Math.min(q[1],y);q[2]=Math.max(q[2],x);q[3]=Math.max(q[3],y);}}}
    for(let index=0;index<cells.length;index++){
      await yieldPreparation();
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
  function loadLegacy(){return Promise.all(specifications.map(spec=>new Promise(resolve=>{const image=new Image(),entry={image,ready:false,error:null};atlases[spec.file]=entry;
    image.onload=async()=>{try{await renderCache.prepare(()=>prepare(spec,image));finalize();entry.ready=true;entry.error=null;if(ready())startWalkCache();}catch(e){entry.error=String(e);}resolve();};image.onerror=()=>{entry.error='Missing '+spec.file;resolve();};image.src='assets/art/'+spec.file;
  })));}
  let preparedManifest=null,preparationMode='compiled',cacheFailure=null,walkPreparationReady=!!window.__BEARLY_BUILD_RENDER_CACHE;
  // V19 source extraction stays exact; walking pixels have their own version.
  const walkManifest=window.__BEARLY_BUILD_WALK_CACHE||window.__BEARLY_BUILD_RENDER_CACHE?Promise.resolve(null):typeof fetch!=='function'?Promise.resolve({error:'No walking-cache fetch'}):fetch('assets/cache/npc-walk-v20-manifest.json').then(r=>{if(!r.ok)throw Error('Walking cache '+r.status);return r.json();}).catch(error=>({error:String(error)}));
  async function loadCompiled(){
    const manifest=await renderCache.manifest;if(manifest.format!==1)throw Error('Unsupported actor cache');
    let slice=performance.now();const pending=manifest.npcSources.map(pack=>renderCache.image(pack.file));
    for(const [index,pack]of manifest.npcSources.entries()){const entry=atlases[pack.source]={image:null,ready:false,error:null},image=await pending[index];
      for(const info of pack.frames){const [x,y,w,h]=info.cacheRect,tile=make(w,h);tile.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);
        Object.assign(tile.dataset,{sourceAsset:pack.source,sourceRect:info.rect.join(','),sourcePose:info.pose,sourceVariant:String(info.variant)});
        const {cacheRect,pixelSHA256,...metadata}=info;profiles[info.variant].poses[info.pose]={...metadata,tile};
        if(performance.now()-slice>2){await renderCache.yieldTask();slice=performance.now();}
      }entry.ready=true;
    }
    const walks=await walkManifest;
    if(walks&&!walks.error){
      const bytes=walks.walks?.reduce((sum,b)=>sum+b.width*b.height*4*WALK_PHASES,0)+(walks.neutral?.frames?.reduce((sum,f)=>sum+f.cacheRect[2]*f.cacheRect[3]*4,0)||0);
      if(walks.format!==1||walks.version!=='v20'||walks.phaseCount!==WALK_PHASES||walks.walks?.length!==12||!Number.isFinite(bytes)||bytes>CACHE_LIMIT||!Number.isFinite(walks.canonicalHeight)||walks.canonicalHeight<64||walks.canonicalHeight>192||!walks.walks.every(b=>b.frames?.length===WALK_PHASES))cacheFailure='Unsupported walking cache';
      else{preparedManifest=walks;cacheState.height=walks.canonicalHeight;
        if(walks.neutral)try{
          const image=await renderCache.image(walks.neutral.file);let began=performance.now();
          for(const info of walks.neutral.frames){const [x,y,w,h]=info.cacheRect;let tile;
            if(window.createImageBitmap)tile=await createImageBitmap(image,x,y,w,h);
            else{tile=make(w,h);tile.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);}
            const frame=profiles[info.variant].poses.walkA,attribution={sourceAsset:frame.source.split('/').pop(),sourceRect:frame.rect.join(','),sourcePose:'walkA',sourceVariant:String(info.variant),sourceTransform:'neutral-cache'};
            if(tile.dataset)Object.assign(tile.dataset,attribution);else tile.dataset=attribution;
            neutralFrames.set(info.variant,{canvas:tile,details:info.details,index:0,width:w,height:h,x:info.x,y:info.y});neutralBytes+=w*h*4;
            if(performance.now()-began>2){await renderCache.yieldTask();began=performance.now();}
          }
        }catch(error){cacheFailure='Neutral cache: '+String(error);}
      }
    }else if(walks?.error){cacheFailure=walks.error;}
    walkPreparationReady=true;startWalkCache();
  }
  for(const spec of specifications)atlases[spec.file]={image:null,ready:false,error:null};
  const loaded=window.__BEARLY_BUILD_RENDER_CACHE?loadLegacy():loadCompiled().catch(error=>{preparationMode='cooperative-fallback';cacheFailure=String(error);walkPreparationReady=true;return loadLegacy();});
  function ready(){return walkPreparationReady&&Object.values(atlases).every(a=>a.ready)&&profiles.every(p=>p.poses.idle);}
  function publicFrame(frame){const {tile,feet,legSplit,walkingParts,...data}=frame;return JSON.parse(JSON.stringify({...data,heightScale:profiles[frame.variant].heightScale}));}
  function frames(){return profiles.flatMap(p=>Object.values(p.poses).map(publicFrame));}
  function get(variant,pose='idle'){const profile=profiles[((variant%12)+12)%12];return profile?.poses[pose]||profile?.poses.idle;}
  function raw(c,frame,x,y,height,face=1,alpha=1){
    const s=height/frame.stature,flip=face*frame.sourceFace<0?-1:1,[sx,sy]=frame.rect,[ax,ay]=frame.anchor;
    c.save();c.translate(x,y);c.scale(flip,1);c.globalAlpha*=alpha;c.drawImage(frame.tile,(sx-ax)*s,(sy-ay)*s,frame.tile.width*s,frame.tile.height*s);c.restore();
  }
  function drawPose(c,{variant=0,pose='idle',x=0,y=0,height=130,face=1,alpha=1}={}){const frame=get(variant,pose);if(!frame)return false;raw(c,frame,x,y,height,face,alpha);return true;}
  function source(variant,pose){const frame=get(variant,pose);return frame?{image:frame.tile,rect:[0,0,frame.tile.width,frame.tile.height],original:publicFrame(frame)}:null;}

  // Landmarks are measured on one relaxed walk drawing per identity. A single
  // source keeps faces, clothing and body projection consistent for the cycle.
  // Each row: near hip/knee/ankle/heel/toe, far equivalents, waist, protected
  // foreground hands/bag rectangles. The masks never split a sleeve into a leg.
  const walkingAnatomy=[
    {near:[[133,179],[128,233],[104,289],[98,326],[37,304]],far:[[153,188],[174,238],[201,290],[231,312],[169,331]],waist:181,clean:[[115,178],[164,178],[169,191],[165,211],[159,232],[147,251],[132,269],[123,286],[120,288],[108,294],[95,292],[83,285],[80,276],[81,266],[94,254],[98,240],[101,222],[112,203],[118,190]],hands:[[35,143,43,58],[196,144,44,68]]},
    {near:[[130,182],[158,233],[186,282],[169,318],[244,306]],far:[[119,187],[91,232],[67,274],[45,293],[91,318]],waist:177,clean:[[113,174],[164,175],[169,188],[174,201],[181,216],[188,232],[192,247],[195,258],[201,269],[202,277],[200,281],[190,285],[181,289],[172,289],[164,286],[157,281],[151,272],[147,258],[139,242],[131,227],[122,210],[114,194]],hands:[[48,159,45,59],[210,135,59,60]]},
    {near:[[101,186],[128,237],[159,284],[145,325],[224,301]],far:[[98,197],[67,233],[37,276],[9,293],[67,318]],waist:195,clean:[[73,189],[111,180],[126,184],[133,198],[141,215],[153,234],[161,251],[164,265],[172,273],[176,282],[175,287],[164,296],[152,300],[140,297],[132,291],[124,282],[117,269],[111,250],[104,234],[94,219],[85,203]],hands:[[16,159,47,56],[173,138,57,58]]},
    {near:[[135,186],[106,237],[84,282],[98,319],[28,299]],far:[[148,193],[174,237],[197,279],[224,287],[169,319]],waist:189,clean:[[104,178],[163,179],[159,192],[150,211],[140,231],[129,252],[120,270],[112,285],[105,291],[95,294],[89,291],[82,287],[72,282],[69,272],[76,262],[81,246],[88,232],[95,216],[102,200],[105,188]],hands:[[16,129,58,61],[184,148,54,67]]},
    {near:[[92,184],[123,239],[154,291],[146,329],[205,309]],far:[[84,194],[57,235],[32,282],[8,303],[58,325]],waist:188,clean:[[70,178],[126,177],[131,191],[140,211],[148,231],[154,252],[158,264],[164,274],[165,282],[161,284],[155,288],[149,291],[143,293],[140,294],[131,291],[128,286],[123,276],[116,261],[106,247],[97,230],[88,213],[78,197]],hands:[[0,164,40,62],[162,144,53,62]]},
    {near:[[119,195],[146,244],[166,290],[153,330],[226,308]],far:[[111,214],[74,249],[36,283],[11,302],[58,325]],waist:218,clean:[[119,193],[136,194],[149,213],[162,235],[172,255],[182,277],[182,284],[177,292],[159,301],[150,297],[142,287],[136,270],[126,250],[115,237],[108,225],[110,212]],hands:[[6,156,53,66],[171,145,54,62]]},
    {near:[[169,211],[195,252],[214,291],[197,338],[268,314]],far:[[165,217],[134,251],[101,282],[68,311],[127,334]],waist:215,clean:[[152,199],[181,201],[193,216],[206,237],[214,260],[222,275],[225,277],[228,290],[215,296],[202,302],[191,305],[186,293],[178,278],[171,257],[159,239],[147,222]],hands:[[52,168,53,64],[238,133,56,65]]},
    {near:[[174,197],[193,246],[214,290],[199,333],[267,311]],far:[[166,215],[134,251],[108,281],[80,307],[134,332]],waist:212,clean:[[158,183],[188,180],[200,199],[211,221],[215,239],[222,259],[227,270],[232,282],[219,288],[204,294],[193,298],[188,291],[181,273],[174,252],[160,231],[148,216],[145,207]],hands:[[71,159,53,64],[239,130,45,65]]},
    {near:[[170,196],[192,246],[213,289],[199,330],[267,309]],far:[[161,214],[131,247],[104,277],[68,305],[128,330]],waist:210,clean:[[151,190],[180,188],[194,208],[205,232],[216,257],[224,269],[232,279],[219,287],[201,295],[190,299],[184,288],[176,270],[169,250],[157,232],[144,217],[138,205]],hands:[[56,154,56,65],[238,130,51,67]]},
    {near:[[161,224],[214,279],[260,346],[248,391],[327,352]],far:[[148,241],[108,287],[66,337],[30,353],[96,387]],waist:224,clean:[[132,219],[196,216],[206,242],[227,270],[235,296],[250,322],[269,339],[272,342],[264,352],[256,361],[247,365],[239,349],[233,332],[214,313],[206,294],[197,281],[171,264],[154,245],[138,234]],hands:[[72,217,54,62],[252,190,61,66]]},
    {near:[[158,242],[197,294],[237,352],[220,390],[310,368]],far:[[140,253],[99,295],[59,338],[24,350],[92,378]],waist:247,clean:[[132,248],[201,244],[210,253],[228,276],[239,306],[254,335],[263,345],[250,355],[235,364],[222,367],[214,350],[207,330],[193,307],[181,289],[163,274],[142,256]],hands:[[26,210,62,68],[254,192,63,69]]},
    {near:[[173,196],[205,237],[237,280],[223,311],[303,294]],far:[[153,205],[119,240],[87,278],[52,289],[112,317]],waist:192,clean:[[159,203],[176,198],[206,193],[219,211],[235,238],[247,254],[258,264],[247,273],[232,282],[220,286],[211,270],[203,252],[194,236],[177,223]],hands:[[57,76,118,137],[238,137,72,86]]}
  ];
  const WALK_DUTY=.60,WALK_EXCURSION=.17;
  function walkExcursion(frame){const [hip,knee,ankle]=walkingAnatomy[frame.variant].near;return clamp((Math.hypot(knee[0]-hip[0],knee[1]-hip[1])+Math.hypot(ankle[0]-knee[0],ankle[1]-knee[1]))/frame.stature*.42,.12,WALK_EXCURSION);}
  function walkCycle(h,variant){return 2*h*walkExcursion(get(variant,'walkA'))/WALK_DUTY;}
  function foot(phase,h,half){
    const p=((phase%1)+1)%1,duty=.60;
    if(p<duty)return{x:half*(1-2*p/duty),y:0,angle:0,stance:true};
    const t=(p-duty)/(1-duty),t2=t*t,t3=t2*t,tangent=-2*half*(1-duty)/duty;
    // Hermite endpoints retain the same backwards velocity as support. The
    // raised recovery foot returns with zero vertical velocity at contact.
    const x=(2*t3-3*t2+1)*-half+(t3-2*t2+t)*tangent+(-2*t3+3*t2)*half+(t3-t2)*tangent;
    return{x,y:-h*.067*16*t2*(1-t)*(1-t),angle:.27*Math.sin(Math.PI*t)*Math.sin(Math.PI*(t+.15)),stance:false};
  }
  function triangle(c,image,source,destination){
    const [a,b,d]=source,[p,q,r]=destination,den=a.x*(b.y-d.y)+b.x*(d.y-a.y)+d.x*(a.y-b.y);if(Math.abs(den)<.0001)return;
    const A=(p.x*(b.y-d.y)+q.x*(d.y-a.y)+r.x*(a.y-b.y))/den,B=(p.y*(b.y-d.y)+q.y*(d.y-a.y)+r.y*(a.y-b.y))/den,C=(p.x*(d.x-b.x)+q.x*(a.x-d.x)+r.x*(b.x-a.x))/den,D=(p.y*(d.x-b.x)+q.y*(a.x-d.x)+r.y*(b.x-a.x))/den,E=(p.x*(b.x*d.y-d.x*b.y)+q.x*(d.x*a.y-a.x*d.y)+r.x*(a.x*b.y-b.x*a.y))/den,F=(p.y*(b.x*d.y-d.x*b.y)+q.y*(d.x*a.y-a.x*d.y)+r.y*(a.x*b.y-b.x*a.y))/den;
    // A true edge-parallel outset keeps diagonal joins fully covered by ink.
    const ap=Math.hypot(q.x-r.x,q.y-r.y),aq=Math.hypot(r.x-p.x,r.y-p.y),ar=Math.hypot(p.x-q.x,p.y-q.y),perimeter=ap+aq+ar,center={x:(ap*p.x+aq*q.x+ar*r.x)/perimeter,y:(ap*p.y+aq*q.y+ar*r.y)/perimeter},radius=Math.abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x))/perimeter,expansion=.7/Math.max(.01,radius);c.save();c.beginPath();destination.forEach((v,i)=>{const dx=v.x-center.x,dy=v.y-center.y,x=v.x+dx*expansion,y=v.y+dy*expansion;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.clip();c.transform(A,B,C,D,E,F);
    // Destination overlap cannot sample remote source pixels if a bent cloth
    // triangle becomes very thin. Keep a bounded two-source-pixel seam allowance only.
    const xs=source.map(p=>p.x),ys=source.map(p=>p.y);c.beginPath();c.rect(Math.min(...xs)-2,Math.min(...ys)-2,Math.max(...xs)-Math.min(...xs)+4,Math.max(...ys)-Math.min(...ys)+4);c.clip();c.drawImage(image,0,0);c.restore();
  }
  function prepareWalkingFrame(frame){
    if(frame.walkingParts)return frame.walkingParts;
    const definition=walkingAnatomy[frame.variant],w=frame.tile.width,h=frame.tile.height,source=frame.tile.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),parts={};
    const point=([x,y])=>({x,y}),bones={};
    for(const side of ['near','far']){const [hip,knee,ankle,heel,toe]=definition[side].map(point);bones[side]={hip,knee,ankle,heel,toe,sole:{x:(heel.x+toe.x)/2,y:(heel.y+toe.y)/2}};}
    // The far hip is occluded by the nearer thigh/coat. Place that joint under
    // the waistband, rather than treating the first visible crotch pixel as it.
    const nearLength=Math.hypot(bones.near.knee.x-bones.near.hip.x,bones.near.knee.y-bones.near.hip.y)+Math.hypot(bones.near.ankle.x-bones.near.knee.x,bones.near.ankle.y-bones.near.knee.y),farShin=Math.hypot(bones.far.ankle.x-bones.far.knee.x,bones.far.ankle.y-bones.far.knee.y),farThigh=nearLength*.99-farShin,hipDx=bones.far.knee.x-bones.far.hip.x;bones.far.hip.y=bones.far.knee.y-Math.sqrt(Math.max(1,farThigh*farThigh-hipDx*hipDx));
    const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
    const labels=new Uint8Array(w*h),near=bones.near,far=bones.far;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const at=y*w+x;if(!source.data[at*4+3]||y<definition.waist)continue;
      const inHand=definition.hands.some(([a,b,c,d])=>x>=a&&x<a+c&&y>=b&&y<b+d),r=source.data[at*4],g=source.data[at*4+1],b=source.data[at*4+2];
      if(frame.variant===11){
        // The tote and cardigan overlap the actual waistband. Protect their
        // warm canvas/teal ink and outline, rather than retaining a rectangle
        // of the original far trouser thigh as part of the upper body.
        let garment=false;
        if(y<218&&x>=55&&x<242)for(let oy=-2;oy<=2&&!garment;oy++)for(let ox=-2;ox<=2;ox++){const xx=x+ox,yy=y+oy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const at=(yy*w+xx)*4,rr=source.data[at],gg=source.data[at+1],bb=source.data[at+2];if(source.data[at+3]>64&&(rr>gg*1.025&&gg>bb*1.12||gg>rr*1.1&&bb>rr*1.1)){garment=true;break;}}
        if(garment||inHand&&x>230)continue;
      }else if(inHand&&(frame.variant!==9||y<238||r>g*1.14&&r>b*1.3))continue;
      const p={x,y},score=bone=>Math.min(distance(p,bone.hip,bone.knee),distance(p,bone.knee,bone.ankle),distance(p,bone.heel,bone.toe));
      labels[at]=score(near)<=score(far)?1:2;
    }
    const measuredHems={0:[[83,285],[95,292],[108,294],[120,288],[123,286]],1:[[161,283],[172,289],[181,289],[190,285],[199,281],[201,280]],2:[[139,297],[151,300],[163,297],[174,289],[176,285]],3:[[72,282],[82,287],[89,291],[95,294],[105,291],[112,285]],4:[[131,291],[140,294],[143,293],[149,291],[155,288],[161,284],[165,282]],5:[[150,297],[159,301],[177,292],[182,284]],6:[[191,305],[202,302],[215,296],[228,290]],7:[[193,298],[204,294],[219,288],[232,282]],8:[[190,299],[201,295],[219,287],[232,279]],9:[[247,365],[256,361],[264,352],[272,342]],10:[[222,367],[235,364],[250,355],[263,345]],11:[[220,286],[232,282],[247,273],[258,264]]};
    const hem=measuredHems[frame.variant],hemAt=x=>{x=Math.max(hem[0][0],Math.min(hem[hem.length-1][0],x));let a=hem[0],b=hem[1];for(let i=1;i<hem.length;i++){a=hem[i-1];b=hem[i];if(x<=b[0])break;}return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);};
    for(const [name,label]of [['upper',0],['near',1],['far',2],['nearBoot',1],['farBoot',2]]){
      const tile=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):document.createElement('canvas');tile.width=w;tile.height=h;const g=tile.getContext('2d'),pixels=g.createImageData(w,h);
      for(let at=0;at<w*h;at++)if(labels[at]===label){const y=Math.floor(at/w),x=at%w,leg=label?bones[label===1?'near':'far']:null,boot=name.endsWith('Boot');if(leg){const dx=leg.toe.x-leg.heel.x,dy=leg.toe.y-leg.heel.y,length=Math.hypot(dx,dy),above=((x-leg.ankle.x)*dy-(y-leg.ankle.y)*dx)*frame.sourceFace/length;if(boot?above>15:above < 8)continue;if(name==='nearBoot'&&hem&&y<hemAt(x))continue;}for(let k=0;k<4;k++)pixels.data[at*4+k]=source.data[at*4+k];}
      g.putImageData(pixels,0,0);parts[name]=tile;
    }
    // Ownership masks can leave a few isolated translucent source specks below
    // a hand. Keep every substantial body/hand/bag component, discard the dots.
    const upperG=parts.upper.getContext('2d',{willReadFrequently:true}),upperPixels=upperG.getImageData(0,0,w,h),upperSeen=new Uint8Array(w*h),upperComponents=[];
    for(let seed=0;seed<w*h;seed++)if(!upperSeen[seed]&&upperPixels.data[seed*4+3]){const queue=[seed];upperSeen[seed]=1;for(let head=0;head<queue.length;head++){const at=queue[head],x=at%w,y=Math.floor(at/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,next=yy*w+xx;if(xx<0||xx>=w||yy<0||yy>=h||upperSeen[next]||!upperPixels.data[next*4+3])continue;upperSeen[next]=1;queue.push(next);}}upperComponents.push(queue);}
    const upperMinimum=Math.max(24,upperComponents.reduce((max,p)=>Math.max(max,p.length),0)*.002);for(const component of upperComponents)if(component.length<upperMinimum)for(const at of component)upperPixels.data[at*4+3]=0;upperG.putImageData(upperPixels,0,0);
    // Complete near-leg material is shared by both chains. The far source
    // thigh is occluded in the authored step and must not become exposed fins.
    const leg=typeof OffscreenCanvas==='function'?new OffscreenCanvas(w,h):document.createElement('canvas');leg.width=w;leg.height=h;const lg=leg.getContext('2d',{willReadFrequently:true});
    if(definition.clean){lg.save();lg.beginPath();definition.clean.forEach(([x,y],i)=>i?lg.lineTo(x,y):lg.moveTo(x,y));lg.closePath();lg.clip();lg.drawImage(frame.tile,0,0);lg.restore();}else lg.drawImage(parts.near,0,0);
    const template=lg.getImageData(0,0,w,h),seen=new Uint8Array(w*h),components=[];
    for(let seed=0;seed<w*h;seed++)if(!seen[seed]&&template.data[seed*4+3]>0){const queue=[seed];seen[seed]=1;for(let head=0;head<queue.length;head++){const at=queue[head],x=at%w,y=Math.floor(at/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,next=yy*w+xx;if(xx<0||xx>=w||yy<0||yy>=h||seen[next]||!template.data[next*4+3])continue;seen[next]=1;queue.push(next);}}components.push(queue);}
    components.sort((a,b)=>b.length-a.length);const keep=new Uint8Array(w*h);for(const at of components[0]||[])keep[at]=1;for(let at=0;at<w*h;at++)if(!keep[at])template.data[at*4+3]=0;lg.putImageData(template,0,0);parts.leg=leg;
    return frame.walkingParts={...parts,bones,waist:definition.waist,pelvis:{x:(near.hip.x+far.hip.x)/2,y:(near.hip.y+far.hip.y)/2}};
  }
  function solveWalkingKnee(hip,ankle,thigh,shin,front){
    const dx=ankle.x-hip.x,dy=ankle.y-hip.y,actual=Math.max(.001,Math.hypot(dx,dy)),d=Math.max(Math.abs(thigh-shin)+.001,Math.min(thigh+shin-.001,actual)),along=(thigh*thigh-shin*shin+d*d)/(2*d),out=Math.sqrt(Math.max(0,thigh*thigh-along*along));
    return{x:hip.x+dx/actual*along+front*dy/actual*out,y:hip.y+dy/actual*along-front*dx/actual*out};
  }
  function rig(c,frame,phase,h,face,weight=1){
    weight=clamp(Number.isFinite(weight)?weight:1,0,1);
    const parts=prepareWalkingFrame(frame),s=h/frame.stature,front=frame.sourceFace,flip=face*front<0?-1:1,nearSource=parts.bones.near;
    const half=h*walkExcursion(frame),cycleLength=2*half/WALK_DUTY;
    const rotate=(p,a)=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)}),length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const bodyX=h*.005*Math.sin(phase*TAU)*weight,sway=.008*Math.sin(phase*TAU)*weight,feet={};
    for(const [index,side]of ['near','far'].entries()){
      const source=parts.bones.near,f=foot(phase+index*.5,h,half);
      if(weight!==1){const rest=foot(index*.5,h,half);f.x=rest.x+(f.x-rest.x)*weight;f.y*=weight;f.angle*=weight;if(weight===0)f.stance=true;}
      const baseAngle=Math.atan2((source.toe.y-source.heel.y)*front,(source.toe.x-source.heel.x)*front),angle=front*f.angle-baseAngle,projection=side==='far'?.98:1,track=h*.035;
      const floor=side==='far'?-h*.024:0,ankleOffset=rotate({x:(source.ankle.x-source.sole.x)*s*projection,y:(source.ankle.y-source.sole.y)*s*projection},angle),sole={x:front*(f.x+(side==='near'?1:-1)*track)-ankleOffset.x,y:floor+f.y};
      const rigid=p=>{const a=rotate({x:(p.x-source.sole.x)*s*projection,y:(p.y-source.sole.y)*s*projection},angle);return{x:sole.x+a.x,y:sole.y+a.y};};
      const ankle=rigid(source.ankle),thigh=length(nearSource.hip,nearSource.knee)*s*projection,shin=length(nearSource.knee,nearSource.ankle)*s*projection;
      feet[side]={source,f,sole,ankle,heel:rigid(source.heel),toe:rigid(source.toe),rigid,thigh,shin,angle,floor,projection,hipOffset:{x:front*(side==='near'?1:-1)*h*.022,y:side==='far'?-h*.016:0}};
    }
    // The fixed baseline is calibrated for the whole excursion. Knees absorb
    // the swing; the torso has a restrained two-beat rise, not a squat cycle.
    if(!parts.pelvisBaseline)parts.pelvisBaseline=new Map();let baseline=parts.pelvisBaseline.get(h);
    if(baseline===undefined){
      baseline=-Infinity;
      for(let i=0;i<48;i++)for(const side of ['near','far']){
        const leg=feet[side],index=side==='far'?.5:0,f=foot(i/48+index,h,half),source=leg.source,angle=front*f.angle-Math.atan2((source.toe.y-source.heel.y)*front,(source.toe.x-source.heel.x)*front),offset=rotate({x:(source.ankle.x-source.sole.x)*s*leg.projection,y:(source.ankle.y-source.sole.y)*s*leg.projection},angle),ankle={x:front*(f.x+(side==='near'?1:-1)*h*.035),y:leg.floor+f.y+offset.y},dx=ankle.x-leg.hipOffset.x,reach=(leg.thigh+leg.shin)*.98,vertical=Math.sqrt(Math.max(reach*reach-dx*dx,reach*reach*.15));baseline=Math.max(baseline,ankle.y-vertical-leg.hipOffset.y);
      }
      baseline+=h*.006;parts.pelvisBaseline.set(h,baseline);
    }
    const pelvisY=baseline-h*.004*(1-Math.cos(phase*TAU*2))*weight,anchor={x:parts.pelvis.x,y:nearSource.hip.y};
    const bodyPoint=p=>{const a=rotate({x:(p.x-anchor.x)*s,y:(p.y-anchor.y)*s},sway);return{x:a.x+bodyX,y:a.y+pelvisY};};
    const landmarks={};c.save();c.scale(flip,1);
    for(const side of ['far','near']){
      const leg=feet[side],source=nearSource,ss=s*leg.projection,hip={x:leg.hipOffset.x+bodyX,y:pelvisY+leg.hipOffset.y},knee=solveWalkingKnee(hip,leg.ankle,leg.thigh,leg.shin,front),thighAngle=Math.atan2(knee.y-hip.y,knee.x-hip.x)-Math.atan2(source.knee.y-source.hip.y,source.knee.x-source.hip.x),shinAngle=Math.atan2(leg.ankle.y-knee.y,leg.ankle.x-knee.x)-Math.atan2(source.ankle.y-source.knee.y,source.ankle.x-source.knee.x);
      c.save();c.translate(leg.sole.x,leg.sole.y);c.rotate(leg.angle);c.scale(ss,ss);c.translate(-leg.source.sole.x,-leg.source.sole.y);c.drawImage(parts.nearBoot,0,0);c.restore();
      const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);},down={x:source.ankle.x-source.hip.x,y:source.ankle.y-source.hip.y},dl=Math.hypot(down.x,down.y),map=p=>{const along=((p.x-source.knee.x)*down.x+(p.y-source.knee.y)*down.y)/dl,blend=smooth((along+12)/24),angle=thighAngle+(shinAngle-thighAngle)*blend,a=rotate({x:(p.x-source.knee.x)*ss,y:(p.y-source.knee.y)*ss},angle);return{x:knee.x+a.x,y:knee.y+a.y};};
      const bounds=walkingAnatomy[frame.variant].clean,xx=[...bounds.map(p=>p[0]),source.hip.x,source.knee.x,source.ankle.x],yy=[...bounds.map(p=>p[1]),source.hip.y,source.knee.y,source.ankle.y],x0=Math.min(...xx),x1=Math.max(...xx),y0=Math.min(...yy),y1=Math.max(...yy),nx=Math.ceil((x1-x0)/6),ny=Math.ceil((y1-y0)/6),cuts=a=>a.sort((a,b)=>a-b).filter((v,i,s)=>!i||v-s[i-1]>1e-7),xs=cuts([...Array.from({length:nx+1},(_,i)=>x0+(x1-x0)*i/nx),source.hip.x,source.knee.x,source.ankle.x]),ys=cuts([...Array.from({length:ny+1},(_,i)=>y0+(y1-y0)*i/ny),source.hip.y,source.knee.y,source.ankle.y]),grid=ys.map(y=>xs.map(x=>{const p={x,y};return{source:p,target:map(p)};}));
      for(let row=0;row<ys.length-1;row++)for(let col=0;col<xs.length-1;col++){const a=grid[row][col],b=grid[row][col+1],d=grid[row+1][col+1],e=grid[row+1][col];triangle(c,parts.leg,[a.source,b.source,d.source],[a.target,b.target,d.target]);triangle(c,parts.leg,[a.source,d.source,e.source],[a.target,d.target,e.target]);}
      const vertex=p=>grid[ys.findIndex(y=>Math.abs(y-p.y)<1e-6)][xs.findIndex(x=>Math.abs(x-p.x)<1e-6)].target,painted={hip:vertex(source.hip),knee:vertex(source.knee),ankle:vertex(source.ankle)};
      for(const [name,point]of Object.entries(painted)){const planned=name==='hip'?hip:name==='knee'?knee:leg.ankle;if(Math.hypot(point.x-planned.x,point.y-planned.y)>1e-5)throw Error('Painted NPC joint misses anatomical chain: '+frame.variant+'/'+side+'/'+name);}
      landmarks[side]={...painted,cuff:painted.ankle,sole:leg.sole,heel:leg.heel,toe:leg.toe,stance:leg.f.stance,thigh:leg.thigh,shin:leg.shin,floor:leg.floor,renderedFromSource:true,source:{image:frame.source,pose:frame.pose,points:source,bootPoints:leg.source,projection:leg.projection},sourcePoints:source};
    }
    const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    const upperPoint=p=>{const a=bodyPoint(p),down=smooth((p.y-(parts.waist-h/s*.35))/(h/s*.27)),outer=smooth((Math.abs(p.x-anchor.x)-h/s*.14)/(h/s*.17)),side=Math.sign(p.x-anchor.x)||1,arm=down*outer;return{x:a.x+side*Math.cos(phase*TAU)*h*.030*arm*weight,y:a.y-h*.004*Math.sin(phase*TAU)**2*arm*weight};};
    const nx=12,ny=20,grid=Array.from({length:ny+1},(_,row)=>Array.from({length:nx+1},(_,col)=>{const p={x:frame.tile.width*col/nx,y:frame.tile.height*row/ny};return{source:p,target:upperPoint(p)};}));
    for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){const a=grid[row][col],b=grid[row][col+1],d=grid[row+1][col+1],e=grid[row+1][col];triangle(c,parts.upper,[a.source,b.source,d.source],[a.target,b.target,d.target]);triangle(c,parts.upper,[a.source,d.source,e.source],[a.target,d.target,e.target]);}
    c.restore();return{phase,cycleLength,stanceDuty:.60,landmarks,landmarkSpace:'source-facing',sourceFace:front,flip,renderedFace:face,bodyShift:bodyX,bob:pelvisY,sway,halfStride:half*weight,armSwing:h*.030*weight,connectedMesh:true,anatomicalChain:true,sourcePose:frame.pose,sourceImage:frame.source,...(weight===1?{}:{neutral:weight===0,gaitWeight:weight})};
  }
  // Bake the approved deformation once. Gameplay submits one small sprite per
  // walker, independent of its height, heading or number of times it is drawn.
  // Work yields between poses, and an unseen phase never tessellates in draw().
  function startWalkCache(){
    if(window.__BEARLY_BUILD_WALK_CACHE)return;
    if(cacheState.started||(!preparedManifest&&!ready()))return;cacheState.started=true;cacheState.startedAt=performance.now();
    if(preparedManifest){cacheState.mode='compiled';for(const item of preparedManifest.walks)walkBanks.set(item.variant,{...item,frames:Array(WALK_PHASES).fill(null),cursor:0,built:0,hits:0,misses:0,activeUntil:0,workerReady:false,requested:false,loading:null});return;}
    const layout=height=>profiles.map(profile=>{const f=profile.poses.walkA||profile.poses.idle,width=Math.ceil(Math.max(1,f.core[2]/f.stature+.28)*height)+12,heightPx=Math.ceil(height*1.20)+12;return{variant:profile.variant,width,height:heightPx,x:width/2,y:height*1.10+6};});
    let layouts=layout(cacheState.height);
    while(layouts.reduce((sum,p)=>sum+p.width*p.height*4*WALK_PHASES,0)>CACHE_LIMIT){cacheState.height-=16;layouts=layout(cacheState.height);}
    const priority=[0,9,11,10,1,2,3,4,5,6,7,8];
    for(const variant of priority){const geometry=layouts[variant];walkBanks.set(variant,{...geometry,frames:Array(WALK_PHASES).fill(null),cursor:0,built:0,hits:0,misses:0,activeUntil:0,workerReady:false,requested:!!window.__BEARLY_BUILD_RENDER_CACHE,loading:null});}
    if(window.__BEARLY_BUILD_RENDER_CACHE){startCacheWorker();scheduleWalkCache();}
  }
  function warmVariant(variant){
    startWalkCache();const bank=walkBanks.get(variant);if(!bank)return Promise.resolve();bank.requested=true;
    if(bank.loading)return bank.loading;
    if(!preparedManifest){if(!cacheWorker)startCacheWorker();scheduleWalkCache();return Promise.resolve();}
    bank.loading=(async()=>{const image=await renderCache.image(bank.file);let slice=performance.now();
      for(const frame of bank.framesMeta||preparedManifest.walks.find(p=>p.variant===variant).frames){const index=frame.index;if(bank.frames[index])continue;const x=index%bank.columns*bank.width,y=Math.floor(index/bank.columns)*bank.height,started=performance.now();let tile;
        if(window.createImageBitmap)tile=await createImageBitmap(image,x,y,bank.width,bank.height);
        else{tile=make(bank.width,bank.height);tile.getContext('2d').drawImage(image,x,y,bank.width,bank.height,0,0,bank.width,bank.height);}
        acceptPose(bank,index,tile,frame.details,performance.now()-started,false);
        if(performance.now()-slice>2){await renderCache.yieldTask();slice=performance.now();}
      }
      if([...walkBanks.values()].every(b=>b.built===WALK_PHASES))finishCache();
    })().catch(error=>{bank.error=String(error);bank.fallback=true;cacheState.mode='compiled-with-cooperative-fallback';if(!cacheWorker)startCacheWorker();scheduleWalkCache();});
    return bank.loading;
  }
  function preloadAll(){startWalkCache();return Promise.all([...walkBanks.keys()].map(warmVariant));}
  function finishCache(){
    cacheState.complete=true;cacheState.completedMs=performance.now()-cacheState.startedAt;
    if(cacheWorker){cacheWorker.terminate();cacheWorker=null;}
    if(cacheWorkerURL){URL.revokeObjectURL(cacheWorkerURL);cacheWorkerURL=null;}
  }
  function acceptPose(bank,index,image,details,elapsed,onMain){
    if(bank.frames[index]){image.close?.();return;}
    const frame=profiles[bank.variant].poses.walkA||profiles[bank.variant].poses.idle;
    const attribution={sourceAsset:frame.source.split('/').pop(),sourceRect:frame.rect.join(','),sourcePose:frame.pose,sourceVariant:String(frame.variant),sourceTransform:'walk-cache',sourcePhase:String(index/WALK_PHASES)};
    // ImageBitmap and Canvas draws carry the same original-source attribution.
    if(image.dataset)Object.assign(image.dataset,attribution);else image.dataset=attribution;
    bank.frames[index]={canvas:image,details,index};bank.built++;cacheState.bytes+=bank.width*bank.height*4;cacheState.bakes++;
    cacheState.buildMs+=elapsed;cacheState.maxBuildMs=Math.max(cacheState.maxBuildMs,elapsed);
    if(onMain){cacheState.mainBuildMs+=elapsed;cacheState.maxMainBuildMs=Math.max(cacheState.maxMainBuildMs,elapsed);}
  }
  function startCacheWorker(){
    if(!window.Worker||!window.OffscreenCanvas||!window.createImageBitmap)return;
    try{
      const source=`'use strict';const walkingAnatomy=${JSON.stringify(walkingAnatomy)};const TAU=Math.PI*2,WALK_DUTY=${WALK_DUTY},WALK_EXCURSION=${WALK_EXCURSION},clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),frames=new Map();let output=null;
${walkExcursion.toString()}
${foot.toString()}
${prepareWalkingFrame.toString()}
${solveWalkingKnee.toString()}
${triangle.toString()}
${rig.toString()}
onmessage=event=>{const m=event.data;if(m.type==='source'){const tile=new OffscreenCanvas(m.bitmap.width,m.bitmap.height);tile.getContext('2d',{willReadFrequently:true}).drawImage(m.bitmap,0,0);m.bitmap.close();frames.set(m.variant,{...m.frame,tile});return;}const started=performance.now();if(!output||output.width!==m.width||output.height!==m.height)output=new OffscreenCanvas(m.width,m.height);const g=output.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,m.width,m.height);g.translate(m.x,m.y);const details=rig(g,frames.get(m.variant),m.index/m.phaseCount,m.heightScale,frames.get(m.variant).sourceFace),bitmap=output.transferToImageBitmap();postMessage({variant:m.variant,index:m.index,details,elapsed:performance.now()-started,bitmap},[bitmap]);};`;
      cacheWorkerURL=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));cacheWorker=new Worker(cacheWorkerURL);cacheState.mode='worker';
      cacheWorker.onmessage=event=>{const m=event.data,bank=walkBanks.get(m.variant);workerJob=null;acceptPose(bank,m.index,m.bitmap,m.details,m.elapsed,false);scheduleWalkCache();};
      cacheWorker.onerror=()=>{if(cacheWorker)cacheWorker.terminate();cacheWorker=null;cacheState.mode='idle';if(workerJob){workerJob.bank.cursor--;workerJob=null;}scheduleWalkCache();};
      for(const bank of walkBanks.values()){const frame=profiles[bank.variant].poses.walkA||profiles[bank.variant].poses.idle;createImageBitmap(frame.tile).then(bitmap=>{if(!cacheWorker){bitmap.close();return;}cacheWorker.postMessage({type:'source',variant:bank.variant,frame:publicFrame(frame),bitmap},[bitmap]);bank.workerReady=true;scheduleWalkCache();}).catch(()=>{cacheWorker?.terminate();cacheWorker=null;cacheState.mode='idle';if(workerJob){workerJob.bank.cursor--;workerJob=null;}scheduleWalkCache();});}
    }catch{cacheWorker=null;cacheState.mode='idle';}
  }
  function scheduleWalkCache(){
    if(cacheState.scheduled||cacheState.complete||workerJob)return;
    const pending=[...walkBanks.values()].filter(bank=>bank.requested&&bank.built<WALK_PHASES&&(!preparedManifest||bank.fallback));
    if(!pending.length){if([...walkBanks.values()].every(b=>b.built===WALK_PHASES))finishCache();return;}
    const now=performance.now(),eligible=cacheWorker?pending.filter(b=>b.workerReady):pending;
    if(!eligible.length)return;
    const bank=eligible.find(b=>b.activeUntil>now)||eligible[0];while(bank.frames[phaseOrder[bank.cursor]])bank.cursor++;const index=phaseOrder[bank.cursor++];
    if(cacheWorker){workerJob={bank,index};cacheWorker.postMessage({type:'bake',variant:bank.variant,index,phaseCount:WALK_PHASES,heightScale:cacheState.height,width:bank.width,height:bank.height,x:bank.x,y:bank.y});return;}
    cacheState.scheduled=true;
    // Always finish this one reserved phase, even with zero idle budget. Skipping
    // it after advancing the cursor permanently lost frames on busy phones.
    const next=()=>{cacheState.scheduled=false;const frame=profiles[bank.variant].poses.walkA||profiles[bank.variant].poses.idle,canvas=make(bank.width,bank.height),g=canvas.getContext('2d'),started=performance.now();
      g.translate(bank.x,bank.y);const details=rig(g,frame,index/WALK_PHASES,cacheState.height,frame.sourceFace);
      const pixels=g.getImageData(0,0,bank.width,bank.height);g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,bank.width,bank.height);g.putImageData(pixels,0,0);acceptPose(bank,index,canvas,details,performance.now()-started,true);scheduleWalkCache();
    };
    if(window.requestIdleCallback)requestIdleCallback(next);else setTimeout(()=>next(null),32);
  }
  function cachedWalk(c,frame,phase,h,face){
    warmVariant(frame.variant);const bank=walkBanks.get(frame.variant),normalized=((phase%1)+1)%1,index=Math.round(normalized*WALK_PHASES)%WALK_PHASES;
    if(!bank){raw(c,get(frame.variant,normalized<.5?'walkA':'walkB')||frame,0,0,h,face);return null;}
    bank.activeUntil=performance.now()+2500;let entry=bank.frames[index];
    if(entry){cacheState.hits++;bank.hits++;}else{
      cacheState.misses++;bank.misses++;let distance=WALK_PHASES;
      for(let i=0;!preparedManifest&&i<WALK_PHASES;i++)if(bank.frames[i]){const gap=Math.min(Math.abs(i-index),WALK_PHASES-Math.abs(i-index));if(gap<distance){entry=bank.frames[i];distance=gap;}}
    }
    if(!entry){const authored=get(frame.variant,normalized<.5?'walkA':'walkB')||frame;raw(c,authored,0,0,h,face);return null;}
    const scale=h/cacheState.height,flip=face*frame.sourceFace<0?-1:1;c.save();c.scale(flip,1);c.drawImage(entry.canvas,-bank.x*scale,-bank.y*scale,bank.width*scale,bank.height*scale);c.restore();return{cacheEntry:entry,scale,flip,face};
  }
  function cachedNeutral(c,frame,h,face,breathing){
    const bank=walkBanks.get(frame.variant),neutral=neutralFrames.get(frame.variant),entry=neutral||bank?.frames[0];
    if(!entry){raw(c,frame,0,0,h,face);return null;}
    const geometry=neutral||bank,scale=h/cacheState.height,flip=face*frame.sourceFace<0?-1:1;
    c.save();c.scale(flip,1);c.drawImage(entry.canvas,-geometry.x*scale,-geometry.y*scale,geometry.width*scale,geometry.height*scale);c.restore();
    return{cacheEntry:entry,scale,flip,face,breathing,neutral:true};
  }
  function motionAudit(){
    if(!lastAudit)return null;let details=lastAudit.details;
    if(details?.cacheEntry){const {cacheEntry,scale,flip,face,breathing=1,neutral=false}=details,d=cacheEntry.details,point=p=>({x:p.x*scale*flip,y:p.y*scale*breathing}),landmarks={};
      for(const [side,leg]of Object.entries(d.landmarks)){const out={...leg};for(const key of ['hip','knee','ankle','cuff','sole','heel','toe','contact'])if(leg[key])out[key]=point(leg[key]);for(const key of ['thigh','shin','floor'])if(Number.isFinite(leg[key]))out[key]=leg[key]*scale;landmarks[side]=out;}
      details={...d,landmarks,landmarkSpace:'display',flip,renderedFace:face,cycleLength:d.cycleLength*scale,bodyShift:d.bodyShift*scale*flip,bob:d.bob*scale,halfStride:d.halfStride*scale,armSwing:d.armSwing*scale,cached:true,neutral,phaseIndex:cacheEntry.index,phaseCount:WALK_PHASES};}
    return JSON.parse(JSON.stringify({...lastAudit,details}));
  }
  function cacheStats(){const stats={preparationMode,cacheFailure,onDemand:!!preparedManifest,visibleComplete:[...walkBanks.values()].filter(b=>b.requested).every(b=>b.built===WALK_PHASES),requestedVariants:[...walkBanks.values()].filter(b=>b.requested).map(b=>b.variant),phaseCount:WALK_PHASES,canonicalHeight:cacheState.height,frameCount:cacheState.bakes,capacity:profiles.length*WALK_PHASES,bytes:cacheState.bytes,limitBytes:CACHE_LIMIT,hits:cacheState.hits,misses:cacheState.misses,bakes:cacheState.bakes,buildMs:cacheState.buildMs,maxBuildMs:cacheState.maxBuildMs,mainBuildMs:cacheState.mainBuildMs,maxMainBuildMs:cacheState.maxMainBuildMs,mode:cacheState.mode,warmupMs:cacheState.completedMs||performance.now()-cacheState.startedAt,complete:cacheState.complete,variants:[...walkBanks.values()].map(b=>({variant:b.variant,frames:b.built,width:b.width,height:b.height,bytes:b.built*b.width*b.height*4,hits:b.hits,misses:b.misses}))};stats.walkingBytes=stats.bytes;stats.neutralBytes=neutralBytes;stats.neutralCount=neutralFrames.size;stats.bytes+=neutralBytes;for(const variant of stats.variants){const frame=neutralFrames.get(variant.variant);variant.neutralBytes=frame?frame.width*frame.height*4:0;variant.bytes+=variant.neutralBytes;}return stats;}
  function seated(c,frame,x,y,h,face,seatHeight,t=0,reading=false){
    const s=h/frame.stature,flip=face*frame.sourceFace<0?-1:1,[px,py]=frame.seatPivot||frame.anchor,[sx,sy]=frame.rect;
    c.save();c.translate(x,y-seatHeight);c.rotate(Math.sin(t*.75+frame.variant)* (reading?.0035:.0018));c.scale(flip,1+.0025*Math.sin(t*1.6+frame.variant));c.drawImage(frame.tile,(sx-px)*s,(sy-py)*s,frame.tile.width*s,frame.tile.height*s);c.restore();
  }
  function draw(c,n,x,y,height=130,scale=1){
    if(n.active===false||n.visible===false)return true;
    const variant=Number.isFinite(n.variant)?((n.variant%12)+12)%12:0,profile=profiles[variant],reaction=['stagger','fall','dead','down','rise'].includes(n.state);
    if(!profile?.poses.idle)return false;
    warmVariant(variant);
    if(variant<9&&(reaction||n.state==='held'))return false;
    const moving=!!n.moving,aggressive=n.hostile||n.mood==='hostile'||n.mood==='aggressive',activity=n.activity||(moving?(aggressive?'run':'walk'):'idle'),face=n.face||1,h=height*profile.heightScale,t=n.age||0;
    let pose='idle',mode=activity,phase=0,details=null;
    if(variant>=9&&reaction)pose=n.state==='stagger'?'hurt':n.state==='fall'?(n.age<.4?'fall':'prone'):n.state==='rise'?(n.age<.25?'prone':'hurt'):'prone';
    else if(n.state==='held')pose=variant>=9?'hurt':'idle';
    else if(['sit','read','smoke','hide'].includes(activity))pose=profile.poses[activity]?activity:'idle';
    else if(['run','flee'].includes(activity)||n.running){phase=(n.distance||0)/(h*1.05);pose=((phase%1)+1)%1<.5?'runA':'runB';}
    else if(moving||activity==='walk'){phase=(n.distance||0)/walkCycle(h,variant);pose='walkA';mode='walk';}
    else if(aggressive&&variant<9)return false;
    const neutralIdle=pose==='idle'&&!aggressive&&activity==='idle'&&!moving&&!reaction,frame=get(variant,neutralIdle?'walkA':pose);if(!frame)return false;
    c.save();c.translate(x,y);c.scale(scale,scale);
    if(mode==='walk'&&!reaction){details=cachedWalk(c,frame,phase,h,face);}
    else if(!reaction&&(['run','flee'].includes(activity)||n.running)){
      const flight=-(Math.sin(((phase%1)+1)%1*Math.PI*2)**2)*h*.035,lean=(face>0?1:-1)*.055;
      c.save();c.translate(0,flight);c.rotate(lean);raw(c,frame,0,0,h,face);c.restore();
    }else if(neutralIdle){const breathing=1+.004*Math.sin(t*1.8+variant);c.save();c.scale(1,breathing);details=cachedNeutral(c,frame,h,face,breathing);c.restore();}
    else if(['sit','read'].includes(pose)&&frame.seatPivot){seated(c,frame,0,0,h,face,n.activityProp?.seatHeight??h*.29,t,pose==='read');}
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
  window.BearlyNpcMotion={ready,loaded,preloadAll,frames,frame:(variant,pose)=>{const f=get(variant,pose);return f?publicFrame(f):null;},source,drawPose,draw,audit:motionAudit,cacheStats,diagnostics:()=>Object.fromEntries(Object.entries(atlases).map(([k,v])=>[k,{ready:v.ready,error:v.error}]))};
})();
