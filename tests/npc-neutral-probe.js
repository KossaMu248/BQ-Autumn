async () => {
  const W=480,H=360,X=240,Y=320,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d',{willReadFrequently:true}),native=c.drawImage.bind(c),neutralImages=new Set(),families=[],faults=[],controls=[];
  let calls=[];
  c.drawImage=(image,...args)=>{const data=image.dataset||{};if(['neutral-cache','walk-cache'].includes(data.sourceTransform)){
    calls.push({transform:data.sourceTransform,sourceAsset:data.sourceAsset,sourceRect:data.sourceRect,sourcePose:data.sourcePose,sourceVariant:String(data.sourceVariant)});
    if(data.sourceTransform==='neutral-cache')neutralImages.add(image);
  }return native(image,...args);};
  const clear=()=>{calls=[];c.resetTransform();c.globalAlpha=1;c.clearRect(0,0,W,H);};
  const pixels=()=>c.getImageData(0,0,W,H).data;
  function signature(data,h){
    let top=null,bottom=null;
    for(let y=0;y<H;y++){let count=0;for(let x=0;x<W;x++)count+=data[(y*W+x)*4+3]>=160?1:0;if(count>=3){if(top===null)top=y;bottom=y;}}
    if(top===null)throw Error('Missing visible NPC in neutral material probe');
    let headArea=0,headLeft=W,headRight=-1,bodyArea=0;
    for(let y=top;y<Math.min(H,top+h*.24);y++)for(let x=0;x<W;x++)if(data[(y*W+x)*4+3]>=160){headArea++;headLeft=Math.min(headLeft,x);headRight=Math.max(headRight,x);}
    for(let y=Math.ceil(top+h*.25);y<Math.min(H,top+h*.67);y++)for(let x=0;x<W;x++)bodyArea+=data[(y*W+x)*4+3]>=160?1:0;
    return{top,bottom,height:bottom-top+1,headWidth:headRight-headLeft+1,headArea,bodyArea,headLeft,headRight};
  }
  const ratio=(a,b)=>b?a/b:Infinity;
  function differences(a,b){
    const values={headWidth:ratio(a.headWidth,b.headWidth),headArea:ratio(a.headArea,b.headArea),bodyArea:ratio(a.bodyArea,b.bodyArea),height:ratio(a.height,b.height)},reasons=[];
    for(const [key,limit]of [['headWidth',.10],['headArea',.12],['bodyArea',.20],['height',.10]])if(Math.abs(values[key]-1)>limit)reasons.push({metric:key,ratio:values[key],limit});
    return{ratios:values,reasons};
  }
  function material(list,expected){
    if(list.length!==1)return{error:'Expected exactly one prepared NPC sprite',calls:list};
    const {transform,...source}=list[0];if(transform!==expected||source.sourcePose!=='walkA')return{error:'Unexpected neutral/walking source',calls:list};
    return source;
  }
  for(let variant=0;variant<12;variant++)for(const face of [-1,1]){
    const state={id:'neutral-probe-'+variant,variant,state:'idle',activity:'idle',moving:false,age:0,hp:100,face,mood:'calm',civilian:variant>=6};
    clear();if(BearlyNpcMotion.draw(c,state,X,Y,128)===false)throw Error('NPC material unavailable');
    const audit=BearlyNpcMotion.audit(),h=audit.height,neutralPixels=pixels(),neutral=signature(neutralPixels,h),neutralSource=material(calls,'neutral-cache'),family={variant,face,height:h,neutral,neutralSource,phases:[],faults:[]};
    if(neutralSource.error)family.faults.push(neutralSource);
    const cycle=audit.details?.cycleLength;if(!Number.isFinite(cycle)||cycle<=0)throw Error('Missing physical NPC cycle length');
    for(let phase=0;phase<48;phase++){
      clear();BearlyNpcMotion.draw(c,{...state,activity:'walk',moving:true,distance:cycle*phase/48},X,Y,128);
      const measured=signature(pixels(),h),proof=differences(measured,neutral),source=material(calls,'walk-cache');
      family.phases.push({phase,...measured,ratios:proof.ratios});
      if(proof.reasons.length)family.faults.push({phase,issue:'Neutral/walk visible material proportions change',reasons:proof.reasons});
      if(source.error||JSON.stringify(source)!==JSON.stringify(neutralSource))family.faults.push({phase,issue:'Neutral/walk texture attribution changes',neutral:neutralSource,walking:source});
    }
    // Actual image pixels: stretch only the head horizontally, preserving all
    // rows and the actor's total height. A height-only guard cannot catch it.
    const stretched=new Uint8ClampedArray(neutralPixels),center=(neutral.headLeft+neutral.headRight)/2;
    for(let y=neutral.top;y<Math.min(H,neutral.top+h*.24);y++)for(let x=0;x<W;x++){
      const fromX=Math.round(center+(x-center)/1.3),to=(y*W+x)*4;
      for(let channel=0;channel<4;channel++)stretched[to+channel]=fromX>=0&&fromX<W?neutralPixels[(y*W+fromX)*4+channel]:0;
    }
    const stretch=differences(signature(stretched,h),neutral),caught=stretch.reasons.some(reason=>['headWidth','headArea'].includes(reason.metric));
    if(!caught)throw Error('Actual-pixel head-only stretch negative control escaped '+JSON.stringify({variant,face,stretch}));
    controls.push({kind:'head-stretch',variant,face,caught,reasons:stretch.reasons});
    if(variant===9||variant===11){
      clear();BearlyNpcMotion.drawPose(c,{variant,pose:'idle',x:X,y:Y,height:h,face});
      const legacy=signature(pixels(),h),proof=differences(legacy,neutral),raw=BearlyNpcMotion.frame(variant,'idle'),walk=BearlyNpcMotion.frame(variant,'walkA');
      const sourceChanged=raw.source!==walk.source||JSON.stringify(raw.rect)!==JSON.stringify(walk.rect);
      controls.push({kind:'legacy-standing-material',variant,face,caught:proof.reasons.length>0||sourceChanged,pixelCaught:proof.reasons.length>0,pixelReasons:proof.reasons,legacy,neutral,sourceChanged});
    }
    families.push(family);for(const fault of family.faults)faults.push({variant,face,...fault});
  }
  const neutralRGBABytes=[...neutralImages].reduce((sum,image)=>sum+(image.naturalWidth||image.width)*(image.naturalHeight||image.height)*4,0);
  if(neutralImages.size!==12)faults.push({issue:'Neutral poses do not reuse twelve unique source objects',actual:neutralImages.size});
  return{neutralFrameCount:neutralImages.size,neutralRGBABytes,families,faultCount:faults.length,faults,negativeControls:controls.length,controls,
    limits:{headWidth:.10,headArea:.12,upperBodyArea:.20,overallHeight:.10},inputHeight:128};
}
