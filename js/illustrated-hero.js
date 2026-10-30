/* A light material/ink pass over the familiar bear art. Rig and silhouette stay intact. */
(() => {
  'use strict';
  const cache=new WeakMap();
  function sprite(im){
    if(!im?.naturalWidth)return im;
    if(cache.has(im))return cache.get(im);
    try{
      const layer=document.createElement('canvas');layer.width=im.naturalWidth;layer.height=im.naturalHeight;
      const g=layer.getContext('2d',{willReadFrequently:true});
      g.filter='contrast(1.045) saturate(1.06)';g.drawImage(im,0,0);g.filter='none';
      const pixels=g.getImageData(0,0,layer.width,layer.height);
      for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]<25)pixels.data[i]=0;
      g.putImageData(pixels,0,0);
      g.globalCompositeOperation='source-atop';
      const light=g.createLinearGradient(0,0,layer.width,layer.height);
      light.addColorStop(0,'#ffc97116');light.addColorStop(.5,'#eac58104');light.addColorStop(1,'#3446320b');
      g.fillStyle=light;g.fillRect(0,0,layer.width,layer.height);g.globalCompositeOperation='source-over';
      const ink=document.createElement('canvas');ink.width=layer.width;ink.height=layer.height;
      const ic=ink.getContext('2d');ic.drawImage(layer,0,0);ic.globalCompositeOperation='source-in';ic.fillStyle='#272b22';ic.fillRect(0,0,ink.width,ink.height);
      const result=document.createElement('canvas');result.width=layer.width;result.height=layer.height;
      const out=result.getContext('2d');out.globalAlpha=.78;
      for(const [x,y] of [[-1,0],[1,0],[0,-1],[0,1]])out.drawImage(ink,x,y);
      out.globalAlpha=1;out.drawImage(layer,0,0);cache.set(im,result);return result;
    }catch(_){cache.set(im,im);return im;}
  }
  window.BearlyHero={sprite};
})();
