/* Painted Autumn Ride cast. Rendering only; the existing encounter state drives poses. */
(() => {
  'use strict';
  const cast={
    bottle:{file:'kid-molotov-streetwear-v4.png',outfit:'Black puffer gilet · matching tracksuit · crossbody bag'},
    rock:{file:'kid-rock-streetwear-v4.png',outfit:'Olive technical jacket · dark tracksuit · crossbody bag'},
    firecracker:{file:'kid-dynamite-streetwear-v4.png',outfit:'Navy puffer · matching tracksuit · crossbody bag'}
  };
  // Per-frame source and foot anchors are authored against the generated sheets.
  // Filling this table once avoids alpha readbacks or image filters during play.
  const layouts={"bottle":{"bodyHeight":478,"frames":[{"x":170,"y":17,"w":209,"h":481,"footX":256,"footY":495},{"x":588,"y":69,"w":342,"h":426,"footX":768,"footY":492},{"x":1087,"y":52,"w":375,"h":443,"footX":1280,"footY":492},{"x":66,"y":499,"w":412,"h":479,"footX":256,"footY":975},{"x":565,"y":552,"w":462,"h":425,"footX":768,"footY":974},{"x":1090,"y":562,"w":388,"h":414,"footX":1280,"footY":973}]},"rock":{"bodyHeight":471,"frames":[{"x":170,"y":29,"w":224,"h":474,"footX":256,"footY":500},{"x":601,"y":41,"w":315,"h":463,"footX":768,"footY":501},{"x":1074,"y":42,"w":407,"h":463,"footX":1280,"footY":502},{"x":85,"y":527,"w":383,"h":458,"footX":256,"footY":982},{"x":556,"y":537,"w":482,"h":444,"footX":768,"footY":978},{"x":1074,"y":540,"w":404,"h":441,"footX":1280,"footY":978}]},"firecracker":{"bodyHeight":496,"frames":[{"x":111,"y":6,"w":222,"h":499,"footX":256,"footY":502},{"x":610,"y":48,"w":330,"h":456,"footX":768,"footY":501},{"x":1129,"y":50,"w":372,"h":455,"footX":1280,"footY":502},{"x":59,"y":522,"w":390,"h":464,"footX":256,"footY":983},{"x":543,"y":542,"w":494,"h":439,"footX":768,"footY":978},{"x":1077,"y":550,"w":416,"h":431,"footX":1280,"footY":978}]}};
  const assets={},prepared={};
  const loaded=Promise.all(Object.entries(cast).map(([kind,info])=>new Promise(resolve=>{
    const im=new Image();assets[kind]=im;
    im.onload=()=>{
      // Discard barely visible alpha speckles once, never during animation.
      // The authored PNG remains unchanged; this is the game render texture.
      try{
        const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
        const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
        const pixels=g.getImageData(0,0,c.width,c.height);
        for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]<25)pixels.data[i]=0;
        g.putImageData(pixels,0,0);prepared[kind]=c;
      }catch(_){prepared[kind]=im;}
      resolve();
    };im.onerror=resolve;
    im.src='assets/art/'+info.file;
  })));
  const drawn={};
  function draw(ctx,{kind='bottle',frame=0,height=76}){
    const im=assets[kind],layout=layouts[kind];
    if(!im?.naturalWidth||!layout)return false;
    const f=layout.frames[Math.max(0,Math.min(5,frame|0))];
    const scale=height/layout.bodyHeight;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(prepared[kind]||im,f.x,f.y,f.w,f.h,(f.x-f.footX)*scale,(f.y-f.footY)*scale,f.w*scale,f.h*scale);
    drawn[kind]={frame,height,outfit:cast[kind].outfit};return true;
  }
  window.BearlyKids={draw,loaded,
    outfit:kind=>cast[kind]?.outfit||cast.bottle.outfit,
    ready:()=>Object.keys(cast).every(k=>assets[k]?.naturalWidth&&layouts[k]?.frames.length===6),
    audit:()=>({ready:Object.keys(cast).every(k=>assets[k]?.naturalWidth&&layouts[k]),drawn:{...drawn},types:Object.keys(cast)})};
})();
