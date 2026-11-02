async () => {
  // Complement the source-posed99.5% check with a mask independent of baked
  // opacity. A/B references retain <1% soft native neck/passenger pixels;
  // the faulty triangle grid loses about4.4% of this same silhouette core.
  const W=400,H=380,X=200,Y=330,LIMIT=.01,canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d',{willReadFrequently:true}),rows=[],faults=[],controls=[];

  function core(data,height){
    const points=[];
    for(let y=Math.floor(Y-height*.95);y<Y-height*.32;y++)for(let x=Math.floor(X-height*.60);x<X+height*.60;x++){
      let inside=true;
      for(let dy=-2;dy<=2&&inside;dy++)for(let dx=-2;dx<=2;dx++){
        if(data[((y+dy)*W+x+dx)*4+3]<30){inside=false;break;}
      }
      if(inside)points.push({x,y,at:(y*W+x)*4+3});
    }
    if(points.length<Math.max(100,height*height*.02))throw Error('Insufficient independent alpha-grid silhouette core '+JSON.stringify({height,pixels:points.length}));
    return points;
  }
  function measure(data,points){
    let opaque=0;const low=[];
    for(const point of points){const alpha=data[point.at];if(alpha>=246)opaque++;else low.push({x:point.x,y:point.y,alpha});}
    low.sort((a,b)=>a.alpha-b.alpha);
    return{corePixels:points.length,opaquePixels:opaque,lowAlphaPixels:low.length,
      opaqueRatio:opaque/points.length,lowAlphaRatio:low.length/points.length,
      lowestAlphaSamples:low.slice(0,20)};
  }
  for(const height of [90,145,225])for(const back of [false,true])for(const phase of [0,.25,.5,.75])for(const weight of [0,.2,1]){
    c.resetTransform();c.globalAlpha=1;c.globalCompositeOperation='source-over';c.clearRect(0,0,W,H);
    const drawn=BearlyHeroRig.draw(c,X,Y,height,1,{state:{hp:100,...(back?{baby:{}}:{})},distance:BearlyLocomotion.cycleLength(height)*phase,weight});
    if(drawn===false)throw Error('Hero artwork unavailable for independent alpha-grid probe');
    const pixels=c.getImageData(0,0,W,H).data,points=core(pixels,height);
    const row={height,carrier:back?'back':'front',phase,weight,...measure(pixels,points)};
    rows.push(row);if(row.lowAlphaRatio>LIMIT)faults.push(row);

    if(phase===0&&weight===1){
      // Inject real partial-alpha diagonal pixels, not holes or solver flags.
      // They remain in the >=30 silhouette mask, so eroding that mask cannot
      // conveniently exclude the defect as a source-opaque reference would.
      const grid=new Uint8ClampedArray(pixels);let changed=0;
      for(const point of points)if((point.x+point.y)%12===0){grid[point.at]=Math.min(grid[point.at],180);changed++;}
      const damaged=measure(grid,core(grid,height));
      if(damaged.lowAlphaRatio<=LIMIT)throw Error('Actual-pixel diagonal alpha-grid negative control escaped '+JSON.stringify({height,back,changed,...damaged}));
      controls.push({height,carrier:back?'back':'front',changedPixels:changed,lowAlphaRatio:damaged.lowAlphaRatio,caught:true});
    }
  }
  const worstCases=[...rows].sort((a,b)=>b.lowAlphaRatio-a.lowAlphaRatio).slice(0,8);
  return{cases:rows.length,minOpaqueRatio:Math.min(...rows.map(row=>row.opaqueRatio)),
    maxLowAlphaRatio:Math.max(...rows.map(row=>row.lowAlphaRatio)),allowedLowAlphaRatio:LIMIT,
    rule:'Actual rendered alpha>=30 silhouette;2-display-pixel erosion;>=246 center alpha;at most1% native soft-source residual',
    faultCount:faults.length,faults,negativeControls:controls.length,controls,worstCases,rows};
}
