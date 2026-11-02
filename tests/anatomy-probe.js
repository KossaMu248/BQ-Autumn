async ({only}) => {
  const W=420,H=370,X=210,Y=330,N=48,canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d',{willReadFrequently:true}),faults=[],families=[],boards=[];
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const span=values=>(Math.max(...values)-Math.min(...values))/(values.reduce((a,b)=>a+b,0)/values.length);
  const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  const sourceKey=leg=>JSON.stringify(leg.source||leg.sourcePoints||null);
  const ankle=leg=>leg.ankle||leg.cuff;
  const pixels=()=>c.getImageData(0,0,W,H).data;
  function upperEdge(data,h){
    // A short opaque row suppresses isolated antialiased fur pixels. In these
    // steady poses the helmet/head stays above the passenger and torso.
    const minimum=Math.max(3,Math.floor(h*.025));
    for(let y=0;y<H;y++){let count=0;for(let x=0;x<W;x++)count+=data[(y*W+x)*4+3]>=160?1:0;if(count>=minimum)return y-Y;}
    return NaN;
  }
  function upperMotion(rows){
    const tops=rows.map(row=>row.upperEdge).filter(Number.isFinite);
    return {range:tops.length?Math.max(...tops)-Math.min(...tops):Infinity,
      maxStep:tops.length?Math.max(...tops.slice(1).map((value,index)=>Math.abs(value-tops[index]))):Infinity};
  }
  const excessiveUpperMotion=(rows,h)=>upperMotion(rows).range>h*.055;
  function connected(data,h){
    const seen=new Uint8Array(W*H),queue=new Int32Array(W*H),parts=[];
    for(let start=0;start<W*H;start++){
      if(seen[start]||data[start*4+3]<140)continue;
      let head=0,tail=1;queue[0]=start;seen[start]=1;
      while(head<tail){const at=queue[head++],x=at%W,y=Math.floor(at/W);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const xx=x+dx,yy=y+dy;if(xx<0||xx>=W||yy<0||yy>=H)continue;
          const next=yy*W+xx;if(seen[next]||data[next*4+3]<140)continue;
          seen[next]=1;queue[tail++]=next;
        }
      }parts.push(tail);
    }
    parts.sort((a,b)=>b-a);
    const total=parts.reduce((a,b)=>a+b,0);
    return {majorComponents:parts.filter(size=>size>h*h*.025).length,mainRatio:(parts[0]||0)/total};
  }
  function ink(data,p,h){
    const radius=Math.max(2,Math.ceil(h*.015));
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
      const x=Math.round(X+p.x+dx),y=Math.round(Y+p.y+dy);
      if(x>=0&&x<W&&y>=0&&y<H&&data[(y*W+x)*4+3]>=140)return true;
    }return false;
  }
  function bodyFailure(data,h){const a=connected(data,h);return a.majorComponents!==1||a.mainRatio<.99;}
  function analyse(rows,label,h,cycle){
    const out={label,height:h,cycleLength:cycle,frames:rows.length,legs:{},failures:[]},problem=(issue,extra={})=>out.failures.push({issue,...extra});
    for(const row of rows)for(const side of ['near','far']){
      const leg=row.legs?.[side];
      if(!leg||!['hip','knee','sole','heel','toe'].every(key=>finite(leg[key]))||!finite(ankle(leg))||!leg.renderedFromSource){
        problem('No complete leg chain sampled from the painted source',{phase:row.phase,side});
        return out;
      }
    }
    for(const side of ['near','far']){
      const legs=rows.map(row=>row.legs[side]);
      const thighs=legs.map(leg=>distance(leg.hip,leg.knee)),shins=legs.map(leg=>distance(leg.knee,ankle(leg))),shoes=legs.map(leg=>distance(leg.heel,leg.toe));
      const angles=legs.map(leg=>{const a={x:leg.hip.x-leg.knee.x,y:leg.hip.y-leg.knee.y},b={x:ankle(leg).x-leg.knee.x,y:ankle(leg).y-leg.knee.y};return Math.acos(Math.max(-1,Math.min(1,(a.x*b.x+a.y*b.y)/(Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y)))));});
      const sources=new Set(legs.map(sourceKey));
      let maxStep=0,maxStanceDrift=0,maxStanceRise=0;
      for(let i=1;i<rows.length;i++)for(const key of ['hip','knee','sole','heel','toe'])maxStep=Math.max(maxStep,distance(legs[i-1][key],legs[i][key]));
      // Measure one painted material point on the sole, not the contact point
      // that legitimately migrates from heel to toe. Exclude the outer20% of
      // each supporting interval where the shoe can roll into/out of contact.
      const intervals=[];let group=[];
      for(let i=0;i<rows.length;i++){
        if(legs[i].stance)group.push(i);
        else if(group.length){intervals.push(group);group=[];}
      }if(group.length)intervals.push(group);
      for(const interval of intervals){const margin=Math.max(2,Math.ceil(interval.length*.2)),indices=interval.slice(margin,-margin);if(indices.length<5)continue;
        const points=indices.map(i=>({x:rows[i].distance+legs[i].sole.x,y:legs[i].sole.y}));
        maxStanceDrift=Math.max(maxStanceDrift,Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)));
        maxStanceRise=Math.max(maxStanceRise,Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)));
      }
      const summary=out.legs[side]={thighSpan:span(thighs),shinSpan:span(shins),shoeSpan:span(shoes),kneeAngleRange:Math.max(...angles)-Math.min(...angles),maxJointStep:maxStep,maxInteriorStanceDrift:maxStanceDrift,maxInteriorStanceRise:maxStanceRise,uniqueSourceMappings:sources.size,meanThigh:thighs.reduce((a,b)=>a+b,0)/thighs.length,meanShin:shins.reduce((a,b)=>a+b,0)/shins.length};
      if(summary.thighSpan>.05||summary.shinSpan>.05)problem('Painted thigh/shin changes length during walking',{side,...summary});
      if(summary.shoeSpan>.02)problem('Painted shoe stretches during walking',{side,...summary});
      if(sources.size!==1)problem('Authored leg/source ownership switches mid-stride',{side,sourceMappings:[...sources]});
      if(summary.kneeAngleRange<.12)problem('Painted knee remains rigid through swing',{side,...summary});
      if(maxStep>h*.12)problem('Painted joint or shoe teleports between neighboring phases',{side,...summary});
      if(maxStanceDrift>h*.04||maxStanceRise>h*.025)problem('Supporting foot slides or bounces relative to the ground',{side,...summary});
      if(!intervals.some(interval=>interval.length>=9))problem('No sustained planted-foot interval',{side});
    }
    const leads=rows.map(row=>row.legs.near.sole.x-row.legs.far.sole.x);
    out.leadRange=[Math.min(...leads),Math.max(...leads)];
    if(out.leadRange[0]>=-h*.025||out.leadRange[1]<=h*.025)problem('Feet do not exchange the lead');
    return out;
  }
  let negativeControls=0;
  function negativeChecks(rows,label,h,cycle,data){
    if(!rows[0]?.legs?.near?.hip)return;
    const copy=()=>JSON.parse(JSON.stringify(rows));
    const stretched=copy();for(let i=0;i<stretched.length;i++)stretched[i].legs.near.knee.y+=Math.sin(i/N*Math.PI*2)*h*.08;
    if(!analyse(stretched,label,h,cycle).failures.some(f=>f.issue==='Painted thigh/shin changes length during walking'))throw Error('Stretched thigh/shin negative control escaped');negativeControls++;
    const swapped=copy();swapped[N/2].legs.near.source={injected:'different authored key'};
    if(!analyse(swapped,label,h,cycle).failures.some(f=>f.issue==='Authored leg/source ownership switches mid-stride'))throw Error('Source-switch negative control escaped');negativeControls++;
    const dragging=copy();for(let i=0;i<dragging.length;i++)dragging[i].legs.near.sole.x+=dragging[i].distance*.6;
    if(!analyse(dragging,label,h,cycle).failures.some(f=>f.issue==='Supporting foot slides or bounces relative to the ground'))throw Error('Sliding-foot negative control escaped');negativeControls++;
    const broken=new Uint8ClampedArray(data),cut=Math.round(Y-h*.23);
    for(let y=cut-2;y<=cut+2;y++)for(let x=0;x<W;x++)broken[(y*W+x)*4+3]=0;
    if(!bodyFailure(broken,h))throw Error('Actual painted detached-leg negative control escaped');negativeControls++;
    const shift=dy=>{const altered=new Uint8ClampedArray(data.length);for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const yy=y+dy;if(yy<0||yy>=H)continue;const from=(y*W+x)*4,to=(yy*W+x)*4;
      for(let channel=0;channel<4;channel++)altered[to+channel]=data[from+channel];
    }return altered;};
    const pump=Math.ceil(h*.05),pumping=[{upperEdge:upperEdge(shift(-pump),h)},{upperEdge:upperEdge(shift(pump),h)}];
    if(!excessiveUpperMotion(pumping,h))throw Error('Actual painted excessive-body-bob negative control escaped');negativeControls++;
  }
  function clear(){c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.clearRect(0,0,W,H);}
  function normaliseLegs(legs,flip=1){
    if(!legs)return legs;
    return Object.fromEntries(Object.entries(legs).map(([side,leg])=>[side,{...leg,...Object.fromEntries(['hip','knee','ankle','cuff','sole','heel','toe','contact'].filter(key=>finite(leg[key])).map(key=>[key,{x:leg[key].x*flip,y:leg[key].y}]))}]));
  }
  function finish(rows,label,h,cycle,bodyFailures,jointInkFailures,data){
    const result=analyse(rows,label,h,cycle);
    const upper=upperMotion(rows);result.upperSilhouetteRange=upper.range;
    result.maxAdjacentUpperSilhouetteStep=upper.maxStep;
    if(excessiveUpperMotion(rows,h))result.failures.push({issue:'Painted head/torso pumps excessively during a flat walk',range:upper.range,limit:h*.055,maxAdjacentStep:upper.maxStep});
    result.bodyFailures=bodyFailures;result.jointInkFailures=jointInkFailures;
    if(bodyFailures)result.failures.push({issue:'Detached or missing painted body',cases:bodyFailures});
    if(jointInkFailures)result.failures.push({issue:'Reported anatomical joint has no painted body nearby',cases:jointInkFailures});
    families.push(result);for(const failure of result.failures)faults.push({label,...failure});
    negativeChecks(rows,label,h,cycle,data);
  }
  if(only!=='npc')for(const back of [false,true])for(const h of [145,225]){
    const rows=[],cycle=BearlyLocomotion.cycleLength(h);let bodyFailures=0,jointInkFailures=0,last;
    const board=document.createElement('canvas');board.width=1440;board.height=370;const g=board.getContext('2d');
    for(let i=0;i<N*2;i++){
      clear();BearlyHeroRig.draw(c,X,Y,h,1,{state:{hp:100,...(back?{baby:{position:'back'}}:{})},distance:cycle*i/N,weight:1});
      const audit=BearlyHeroRig.audit(),data=pixels(),legs=normaliseLegs(audit.landmarks);
      if(Math.round((audit.body?.cachePhase||0)*N)%N!==i%N)faults.push({label:`bear-${back?'back':'front'}-${h}`,issue:'Reported stride does not select its requested prepared phase',requested:i%N,actual:audit.body?.cachePhase});
      rows.push({phase:i/N,distance:cycle*i/N,legs,upperEdge:upperEdge(data,h)});last=data;
      bodyFailures+=bodyFailure(data,h)?1:0;
      if(legs)for(const leg of Object.values(legs))for(const point of ['hip','knee','ankle'])if(finite(point==='ankle'?ankle(leg):leg[point])&&!ink(data,point==='ankle'?ankle(leg):leg[point],h))jointInkFailures++;
      if(h===145&&i<N&&i%8===0){const x=i/8*240;g.fillStyle='#e7e2d7';g.fillRect(x,0,240,370);g.drawImage(canvas,90,0,240,370,x,0,240,370);g.fillStyle='#202520';g.font='14px Arial';g.fillText(`phase ${(i/N).toFixed(3)}`,x+8,20);}
    }
    finish(rows,`bear-${back?'back':'front'}-${h}`,h,cycle,bodyFailures,jointInkFailures,last);
    if(h===145)boards.push({name:`bear-${back?'back':'front'}`,png:board.toDataURL('image/png')});
    // The old renderer changed source at walk weight .45 even without moving
    // phase. Source identity must remain stable throughout starts and stops.
    const mappings=new Set(),transitionLegs={near:[],far:[]};let transitionBodyFailures=0;
    for(let i=0;i<=20;i++){
      clear();BearlyHeroRig.draw(c,X,Y,h,1,{state:{hp:100,...(back?{baby:{position:'back'}}:{})},distance:cycle*.23,weight:i/20});
      const audit=BearlyHeroRig.audit();mappings.add(JSON.stringify(Object.values(audit.landmarks||{}).map(sourceKey)));
      transitionBodyFailures+=bodyFailure(pixels(),h)?1:0;
      for(const side of ['near','far'])if(audit.landmarks?.[side])transitionLegs[side].push(audit.landmarks[side]);
    }
    if(mappings.size!==1)faults.push({label:`bear-${back?'back':'front'}-${h}`,issue:'Authored leg/source ownership switches during start/stop',uniqueSourceMappings:mappings.size});
    if(transitionBodyFailures)faults.push({label:`bear-${back?'back':'front'}-${h}`,issue:'Painted body separates during start/stop',cases:transitionBodyFailures});
    for(const side of ['near','far']){
      const values=transitionLegs[side];if(values.length!==21||values.some(leg=>!finite(leg.hip)||!finite(leg.knee)||!finite(ankle(leg))))continue;
      const thighSpan=span(values.map(leg=>distance(leg.hip,leg.knee))),shinSpan=span(values.map(leg=>distance(leg.knee,ankle(leg)))),shoeSpan=span(values.map(leg=>distance(leg.heel,leg.toe)));
      let maxStep=0;for(let i=1;i<values.length;i++)for(const key of ['hip','knee','sole','heel','toe'])maxStep=Math.max(maxStep,distance(values[i-1][key],values[i][key]));
      if(thighSpan>.05||shinSpan>.05||shoeSpan>.02||maxStep>h*.05)faults.push({label:`bear-${back?'back':'front'}-${h}`,issue:'Painted leg anatomy changes abruptly during start/stop',side,thighSpan,shinSpan,shoeSpan,maxStep});
    }
  }
  if(only!=='bear')for(let variant=0;variant<12;variant++){
    const rows=[],h=145*(variant===9?1.05:variant===11?.84:1);let bodyFailures=0,jointInkFailures=0,last,cycle=h*.72;
    // Probe phase zero first so the renderer can expose its actual stride.
    clear();BearlyNpcMotion.draw(c,{id:'anatomy-'+variant,variant,state:'idle',hp:100,moving:true,activity:'walk',distance:0,face:1,civilian:variant>=6},X,Y,145);
    const initial=BearlyNpcMotion.audit();cycle=initial?.details?.cycleLength||cycle;
    for(let i=0;i<N*2;i++){
      clear();BearlyNpcMotion.draw(c,{id:'anatomy-'+variant,variant,state:'idle',hp:100,moving:true,activity:'walk',distance:cycle*i/N,face:1,civilian:variant>=6},X,Y,145);
      const audit=BearlyNpcMotion.audit(),data=pixels(),details=audit?.details||{};
      if(details.phaseIndex!==i%N)faults.push({label:`npc-${variant}`,issue:'Reported stride does not select its requested prepared phase',requested:i%N,actual:details.phaseIndex});
      const flip=details.landmarkSpace==='display'?1:(details.flip??((audit?.sourceFace||details.sourceFace||1)<0?-1:1));
      const legs=normaliseLegs(details.landmarks,flip);
      rows.push({phase:i/N,distance:cycle*i/N,legs,upperEdge:upperEdge(data,h)});last=data;
      bodyFailures+=bodyFailure(data,h)?1:0;
      if(legs)for(const leg of Object.values(legs))for(const point of ['hip','knee','ankle'])if(finite(point==='ankle'?ankle(leg):leg[point])&&!ink(data,point==='ankle'?ankle(leg):leg[point],h))jointInkFailures++;
    }
    finish(rows,`npc-${variant}`,h,cycle,bodyFailures,jointInkFailures,last);
  }
  return {families,negativeControls,faults,boards};
}
