/* Painted Autumn Ride cast. Rendering only; the existing encounter state drives poses. */
(() => {
  'use strict';
  const cast={
    bottle:{file:'kid-molotov.png',outfit:'Charcoal hoodie · burgundy cap · faded denim'},
    rock:{file:'kid-rock.png',outfit:'Olive bomber · black hood · cargo trousers'},
    firecracker:{file:'kid-dynamite.png',outfit:'Navy puffer · red cap · blue denim'}
  };
  // Per-frame source and foot anchors are authored against the generated sheets.
  // Filling this table once avoids alpha readbacks or image filters during play.
  const layouts={"bottle":{"bodyHeight":420,"frames":[{"x":189,"y":72,"w":187,"h":420,"footX":256,"footY":491},{"x":601,"y":124,"w":293,"h":364,"footX":768,"footY":487},{"x":1100,"y":109,"w":338,"h":381,"footX":1280,"footY":489},{"x":95,"y":532,"w":356,"h":420,"footX":256,"footY":951},{"x":585,"y":573,"w":423,"h":378,"footX":768,"footY":950},{"x":1098,"y":589,"w":357,"h":362,"footX":1280,"footY":950}]},"rock":{"bodyHeight":416,"frames":[{"x":192,"y":75,"w":186,"h":416,"footX":256,"footY":490},{"x":621,"y":88,"w":274,"h":403,"footX":768,"footY":491},{"x":1109,"y":88,"w":323,"h":404,"footX":1280,"footY":491},{"x":121,"y":568,"w":317,"h":404,"footX":256,"footY":972},{"x":581,"y":578,"w":418,"h":388,"footX":768,"footY":966},{"x":1103,"y":593,"w":344,"h":374,"footX":1280,"footY":967}]},"firecracker":{"bodyHeight":387,"frames":[{"x":183,"y":82,"w":171,"h":387,"footX":256,"footY":469},{"x":637,"y":119,"w":253,"h":350,"footX":768,"footY":469},{"x":1127,"y":119,"w":296,"h":350,"footX":1280,"footY":469},{"x":129,"y":577,"w":311,"h":381,"footX":256,"footY":957},{"x":589,"y":607,"w":398,"h":346,"footX":768,"footY":953},{"x":1109,"y":618,"w":323,"h":337,"footX":1280,"footY":954}]}};
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
