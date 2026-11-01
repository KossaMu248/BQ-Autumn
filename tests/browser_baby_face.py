"""Verify the continuous original bike passenger and V12 carrier expressions.

This checks real draw calls, uniform transforms and rendered opaque face pixels
against the unchanged source WebPs. Pose boards support visual anchor review;
the assertions do not claim to judge the artwork subjectively.
"""
import argparse
import functools
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "screenshots" / "revision18"
ENTRY = "autumn-v18.html"
ORIGINALS = {
    "baby_pose_idle.webp": "a27d4ea977d35d89ac927ca371eb66c5e366b096b1eb057e8552853f14578823",
    "baby_pose_laugh.webp": "4decc347ee84105fb22f47ad945d8cfa0612672360fdbd0ce879661981d6793e",
    "baby_pose_terror.webp": "ad1faf6677a2fcb674887c42feaa4498af724b97ed2a848bb6e3df046a5ac9ea",
    "baby_pose_brace.webp": "e0a172d980ca27bae9bf82d37d8ab97935f78bc5862c12c250e29c2604329478",
    "baby_pose_leanBack.webp": "a0dd21135d421463620860444ebee2c862e2d659b1e19be6031ebbde88c53360",
    "baby_pose_leanForward.webp": "4cfba1def3c14c567751d598a04a653c4f1e81159317341d3e0b68be6e79b92b",
    "baby_pose_point.webp": "4dc3514feaf2dd70e002a25a34ef7c0707e725e6580ab61cc94e68a5b6ed2a2c",
    "baby_pose_sick.webp": "2e1f1c4bd3c51b6919638f1135a33bea36a0cf0c886ac71478340ed910b6c22f",
    "v151_baby_pose_excited.png": "90b655b42abd70a1e3ec7dd9f758988c4a1d26aaa91b2565ceeb58ca723e3e0b",
    "v151_baby_pose_sick.png": "32dc7d3bbd707101c0ff82cf6ef6e359702bc6adec0de91132b59514e2caf426",
}

SOURCE_FRAMES = json.loads(r'''{"idle":{"file":"baby_pose_idle.webp","size":[82,146],"pivot":[52,94],"seamY":94,"occludeFrom":90,"protected":{"face":[[52,35],[66,36],[66,43],[60,52]],"chin":[[62,63],[60,64],[57,66],[54,67],[51,68],[62,66],[60,67],[58,68],[54,69]],"neck":[[48,69],[48,70]],"collar":[[36,72],[43,77],[53,77]],"torso":[[40,82],[49,84]],"chair":[[16,52],[17,58],[22,70],[25,75],[30,99],[47,103]]}},"laugh":{"file":"baby_pose_laugh.webp","size":[88,154],"pivot":[57,103],"seamY":103,"occludeFrom":97,"protected":{"face":[[51,39],[64,39],[66,48],[61,59]],"chin":[[64,71],[59,74],[51,75]],"neck":[[43,73]],"collar":[[44,79],[54,83],[61,83]],"torso":[[49,89]],"chair":[[15,70],[23,86],[34,105],[49,115]]}},"brace":{"file":"baby_pose_brace.webp","size":[98,143],"pivot":[59,101],"seamY":101,"occludeFrom":95,"protected":{"face":[[55,39],[70,40],[73,49],[65,60]],"chin":[[64,70],[56,72],[49,72]],"neck":[[42,72]],"collar":[[44,76],[53,82]],"torso":[[49,86]],"chair":[[14,65],[23,83],[35,99],[48,109]]}},"terror":{"file":"baby_pose_terror.webp","size":[99,155],"pivot":[64,104],"seamY":104,"occludeFrom":97,"protected":{"face":[[55,31],[77,31],[77,43],[67,59]],"chin":[[76,69],[68,74],[56,75]],"neck":[[44,72]],"collar":[[46,79],[58,84]],"torso":[[52,90]],"chair":[[14,70],[26,91],[37,107],[58,119]]}},"leanBack":{"file":"baby_pose_leanBack.webp","size":[106,140],"pivot":[65,92],"seamY":92,"occludeFrom":87,"protected":{"face":[[48,20],[74,42]],"chin":[[72,64]],"neck":[[45,68]],"collar":[[69,72]],"torso":[[52,78]],"hand":[[70,86]],"chair":[[18,63],[38,87],[57,94]]}},"leanForward":{"file":"baby_pose_leanForward.webp","size":[88,153],"pivot":[43,109],"seamY":109,"occludeFrom":102,"protected":{"face":[[59,25],[68,48]],"chin":[[67,86]],"neck":[[37,68]],"collar":[[33,70],[52,89]],"torso":[[34,85]],"hand":[[42,104]],"chair":[[14,66],[22,88],[25,105]]}},"point":{"file":"baby_pose_point.webp","size":[97,142],"pivot":[56,92],"seamY":92,"occludeFrom":88,"protected":{"face":[[50,20],[64,42]],"chin":[[66,70]],"neck":[[40,65]],"collar":[[59,77]],"torso":[[45,76]],"hand":[[62,86]],"chair":[[23,59],[35,84],[50,94]]}},"sick":{"file":"v151_baby_pose_sick.png","size":[99,145],"pivot":[44,101],"seamY":101,"occludeFrom":95,"protected":{"face":[[42,25],[47,49]],"chin":[[49,80]],"neck":[[27,68]],"collar":[[39,84]],"torso":[[28,82]],"hand":[[52,94]],"chair":[[8,60],[18,84],[30,102]]}},"excited":{"file":"v151_baby_pose_excited.png","size":[106,140],"pivot":[65,92],"seamY":92,"occludeFrom":87,"protected":{"face":[[48,20],[74,42]],"chin":[[72,64]],"neck":[[45,68]],"collar":[[69,72]],"torso":[[52,78]],"hand":[[70,86]],"chair":[[18,63],[38,87],[57,94]]}},"sickLegacy":{"file":"baby_pose_sick.webp","size":[99,145],"pivot":[44,101],"seamY":101,"occludeFrom":95,"protected":{"face":[[42,25],[47,49]],"chin":[[49,80]],"neck":[[27,68]],"collar":[[39,84]],"torso":[[28,82]],"hand":[[52,94]],"chair":[[8,60],[18,84],[30,102]]}}}''')

AUDIT = r"""(() => {
  const native=CanvasRenderingContext2D.prototype.drawImage,proofs=new WeakMap();
  const groups=['face','chin','neck','collar','torso'];
  const carriers=/^(front-carrier-v7|back-carrier-v11|carrier-reactions-v11|boat-passengers-v8|bike-transfer-v7|(?:front|back|reaction|boat|transfer)-background-v11-2)\.png$/;
  const targets=['game','face-probe','chin-probe','passenger-probe'];
  const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  window.__nativeDrawImage=native;window.__babyDraws=[];window.__carrierDraws=[];window.__looseChair=[];window.__rimWitness=null;let sequence=0;
  function dimensions(d){const a=d.args;return a.length===8?{sx:a[0],sy:a[1],sw:a[2],sh:a[3],dx:a[4],dy:a[5],dw:a[6],dh:a[7]}:
    {sx:0,sy:0,sw:d.width,sh:d.height,dx:a[0],dy:a[1],dw:a.length===4?a[2]:d.width,dh:a.length===4?a[3]:d.height};}
  function point(d,x,y){const q=dimensions(d),u=q.dx+(x-q.sx)*q.dw/q.sw,v=q.dy+(y-q.sy)*q.dh/q.sh;
    const[a,b,c,e,tx,ty]=d.matrix;return{x:a*u+c*v+tx,y:b*u+e*v+ty};}
  window.__sourcePoint=point;
  function box(d,target){const q=dimensions(d),ps=[[q.sx,q.sy],[q.sx+q.sw,q.sy],[q.sx,q.sy+q.sh],[q.sx+q.sw,q.sy+q.sh]].map(p=>point(d,...p));
    const x=Math.max(0,Math.floor(Math.min(...ps.map(p=>p.x)))-2),y=Math.max(0,Math.floor(Math.min(...ps.map(p=>p.y)))-2);
    return{x,y,w:Math.max(0,Math.min(target.width,Math.ceil(Math.max(...ps.map(p=>p.x)))+2)-x),h:Math.max(0,Math.min(target.height,Math.ceil(Math.max(...ps.map(p=>p.y)))+2)-y)};}
  function isSource(source){return /^(baby_pose_\w+\.webp|v151_baby_pose_\w+\.png|face_smile\.webp|face_happy\.webp)$/.test(source);}
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
    const source=image?.dataset?.sourceAsset||image?.src?.split('/').pop()||'';
    if(targets.includes(this.canvas.id) && this.globalAlpha>.001 && (isSource(source)||carriers.test(source))){
      const t=this.getTransform(),d={sequence:++sequence,target:this.canvas.id,source,args,width:image.naturalWidth||image.width,height:image.naturalHeight||image.height,
        matrix:[t.a,t.b,t.c,t.d,t.e,t.f],alpha:this.globalAlpha,filter:this.filter,composite:this.globalCompositeOperation,
        smoothing:this.imageSmoothingEnabled,quality:this.imageSmoothingQuality,piece:image instanceof HTMLCanvasElement};
      Object.defineProperty(d,'image',{value:image});
      if(isSource(source)){
        if(this.canvas.id==='chin-probe' && d.alpha>.999){const b=box(d,this.canvas);if(b.w&&b.h)Object.defineProperty(d,'before',{value:{...b,pixels:this.getImageData(b.x,b.y,b.w,b.h)}});}
        window.__babyDraws.push(d);
        const area=window.BearlyVisits?.audit?.();
        if(this.canvas.id==='game'&&!d.piece&&area?.mode&&area.mode!=='water'&&!area.transition&&d.alpha>.01)
          window.__looseChair.push({source,args,mode:area.mode});
      }else window.__carrierDraws.push(d);
    }
    return native.call(this,image,...args);
  };
  const nativeStroke=CanvasRenderingContext2D.prototype.stroke;
  CanvasRenderingContext2D.prototype.stroke=function(...args){
    const baby=window.__babyDraws.filter(d=>d.target==='chin-probe'&&d.piece&&d.alpha>.999).at(-1);
    const witness=this.canvas.id==='chin-probe'&&this.globalAlpha>.999&&baby&&
      window.__carrierDraws.some(d=>d.target==='chin-probe'&&d.sequence>baby.sequence&&d.alpha>.999);
    if(!witness)return nativeStroke.apply(this,args);
    const before=this.getImageData(0,0,this.canvas.width,this.canvas.height);nativeStroke.apply(this,args);
    const after=this.getImageData(0,0,this.canvas.width,this.canvas.height);
    const result=window.__rimWitness||{changed:new Uint8Array(this.canvas.width*this.canvas.height),rgba:new Uint8ClampedArray(after.data.length)};
    for(let i=0;i<after.data.length;i+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(after.data[i+k]-before.data[i+k])))>6){
      result.changed[i/4]=1;for(let k=0;k<4;k++)result.rgba[i+k]=after.data[i+k];}
    window.__rimWitness=result;
  };
  window.__resetBabyAudit=()=>{window.__babyDraws=[];window.__carrierDraws=[];window.__rimWitness=null;sequence=0;};
  window.__lastBaby=(target,piece=true)=>window.__babyDraws.filter(d=>d.target===target&&d.piece===piece&&d.alpha>.999).at(-1);
  window.__prepareReferences=async specs=>{
    window.__specs=specs;window.__sourceToMood={};window.__references={};window.__protectedMasks={};window.__visibleMasks={};window.__screenMasks={};
    for(const[name,spec]of Object.entries(specs)){
      window.__sourceToMood[spec.file]=name;
      const image=new Image();image.src='assets/'+spec.file;await image.decode();
      if(image.naturalWidth!==spec.size[0]||image.naturalHeight!==spec.size[1])throw new Error('Original sprite dimensions changed: '+name);
      const raw=make(...spec.size);native.call(raw.getContext('2d'),image,0,0);window.__references[name]=raw;
      const mask=make(...spec.size),g=mask.getContext('2d');g.fillStyle='#fff';
      for(const group of groups)for(const[x,y]of spec.protected[group]||[])g.fillRect(x-1,y-1,3,3);
      const centers=['neck','collar','torso'].map(k=>{const p=spec.protected[k];return[p.reduce((a,v)=>a+v[0],0)/p.length,p.reduce((a,v)=>a+v[1],0)/p.length];});
      g.lineWidth=2;g.strokeStyle='#fff';g.lineCap='round';g.beginPath();centers.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
      g.globalCompositeOperation='destination-in';native.call(g,raw,0,0);window.__protectedMasks[name]=mask;
      const visible=make(...spec.size),vg=visible.getContext('2d');native.call(vg,mask,0,0);
      const belowCollar=Math.max(...spec.protected.collar.map(p=>p[1]))+3;
      vg.clearRect(0,belowCollar,spec.size[0],spec.size[1]-belowCollar);window.__visibleMasks[name]=visible;
      // Small gameplay renders need enough covered sample pixels to observe.
      // Widen only the selection; raw source and final color tolerances stay.
      const screen=make(...spec.size),sg=screen.getContext('2d');
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)native.call(sg,visible,dx,dy);
      sg.clearRect(0,belowCollar,spec.size[0],spec.size[1]-belowCollar);
      window.__screenMasks[name]=screen;
    }
  };
  function specFor(d){const name=__sourceToMood[d.source];if(!name)throw new Error('Unexpected baby source: '+JSON.stringify(d));return{name,spec:__specs[name]};}
  window.__verifyPieceSource=d=>{
    if(proofs.has(d.image))return proofs.get(d.image);
    const{name,spec}=specFor(d),[w,h]=spec.size;
    if(!d.piece||d.width!==w||d.height!==spec.seamY+1)throw new Error('Expected original continuous head-neck-collar-torso piece: '+JSON.stringify(d));
    const got=d.image.getContext('2d').getImageData(0,0,w,d.height).data,want=__references[name].getContext('2d').getImageData(0,0,w,h).data;
    const selection=__protectedMasks[name].getContext('2d').getImageData(0,0,w,h).data;
    let compared=0,maxRGB=0,maxAlpha=0;const byGroup={};
    function check(x,y){const i=(y*w+x)*4;if(want[i+3]<32)return;
      const rgb=Math.max(...[0,1,2].map(k=>Math.abs(want[i+k]-(got[i+k]||0)))),alpha=Math.abs(want[i+3]-(got[i+3]||0));
      compared++;maxRGB=Math.max(maxRGB,rgb);maxAlpha=Math.max(maxAlpha,alpha);
      if(alpha>2||rgb>(want[i+3]>253?2:5))throw new Error('Native head/neck/collar/torso changed or separated: '+JSON.stringify({name,x,y,want:[...want.slice(i,i+4)],got:[...got.slice(i,i+4)]}));}
    for(const group of groups){byGroup[group]=0;for(const[x,y]of spec.protected[group]||[]){check(x,y);byGroup[group]++;}if(!byGroup[group])throw new Error('Missing native continuity sample: '+name+'/'+group);}
    for(let y=0;y<=spec.seamY;y++)for(let x=0;x<w;x++)if(selection[(y*w+x)*4+3]>=254&&want[(y*w+x)*4+3]>=254)check(x,y);
    for(const[x,y]of spec.protected.chair||[]){if(y<d.height&&got[(y*w+x)*4+3]!==0)throw new Error('Chair pixel leaked into passenger: '+JSON.stringify({name,x,y}));}
    const proof={mood:name,source:spec.file,compared,maxRGB,maxAlpha,byGroup,chairSamplesCleared:spec.protected.chair.length};proofs.set(d.image,proof);return proof;
  };
  function drawExpected(target,d,withBackdrop=false){
    const b=withBackdrop?d.before:{x:0,y:0,w:target.width,h:target.height};
    if(!b)throw new Error('Missing pre-passenger pixels');const expected=make(b.w,b.h),g=expected.getContext('2d');
    if(withBackdrop)g.putImageData(b.pixels,0,0);
    const m=[...d.matrix];m[4]-=b.x;m[5]-=b.y;g.setTransform(...m);g.imageSmoothingEnabled=d.smoothing;g.imageSmoothingQuality=d.quality;
    native.call(g,d.image,...d.args);return{canvas:expected,box:b,matrix:m};
  }
  function transformedMask(name,d,b,sourceMask){const mask=make(b.w,b.h),g=mask.getContext('2d'),m=[...d.matrix];m[4]-=b.x;m[5]-=b.y;g.setTransform(...m);native.call(g,sourceMask||__visibleMasks[name],...d.args);return g.getImageData(0,0,b.w,b.h).data;}
  window.__verifyVisiblePiece=(target,expectedMood,focused=false)=>{
    const d=__lastBaby(target);if(!d)throw new Error('No visible continuous passenger: '+target);
    if(target!=='game'&&__babyDraws.filter(v=>v.target===target&&v.piece&&v.alpha>.999).length!==1)
      throw new Error('Head, neck and original collar must render as one continuous raster piece');
    const{name,spec}=specFor(d);if(name!==expectedMood)throw new Error('Wrong actual mood asset: '+JSON.stringify({expectedMood,actual:name,source:d.source}));
    const sourceProof=__verifyPieceSource(d),q=dimensions(d),[a,b,c,e]=d.matrix,sx=Math.hypot(a,b)*q.dw/q.sw,sy=Math.hypot(c,e)*q.dh/q.sh;
    if(Math.abs(sx/sy-1)>1e-7||Math.abs(a*c+b*e)>1e-7||d.filter!=='none'||d.composite!=='source-over')throw new Error('Passenger native geometry/colors altered: '+JSON.stringify(d));
    if(q.sx!==0||q.sy!==0||q.sw!==d.width||q.sh!==d.height)throw new Error('Continuous native piece cropped again');
    const actual=document.getElementById(target),expected=drawExpected(actual,d,focused),bbox=expected.box;
    const want=expected.canvas.getContext('2d').getImageData(0,0,bbox.w,bbox.h).data,got=actual.getContext('2d').getImageData(bbox.x,bbox.y,bbox.w,bbox.h).data;
    const selection=transformedMask(name,d,bbox,focused?__visibleMasks[name]:__screenMasks[name]);let compared=0,mismatches=0,maxError=0;const details=[];
    for(let i=0;i<selection.length;i+=4){if(selection[i+3]<(focused?200:128))continue;if(!focused&&want[i+3]<254)continue;
      compared++;const delta=Math.max(...[0,1,2].map(k=>Math.abs(want[i+k]-got[i+k])));maxError=Math.max(maxError,delta);if(delta>6){mismatches++;
        if(details.length<8){const x=i/4%bbox.w+bbox.x,y=Math.floor(i/4/bbox.w)+bbox.y,p=new DOMMatrix(d.matrix).inverse().transformPoint(new DOMPoint(x+.5,y+.5));
          details.push({x,y,source:[q.sx+(p.x-q.dx)*q.sw/q.dw,q.sy+(p.y-q.dy)*q.sh/q.dh],want:[...want.slice(i,i+4)],got:[...got.slice(i,i+4)]});}}}
    if(compared<(focused?30:3)||mismatches/compared>.005)throw new Error('Native face-neck-COLLAR continuity hidden by later layers: '+JSON.stringify({case:window.__case,target,name,compared,mismatches,maxError,details}));
    return{mood:name,source:d.source,uniformScale:sx,mirrored:a*e-b*c<0,compared,mismatches,maxError,sourceProof};
  };
  function seamMask(d){
    const{name,spec}=specFor(d),w=d.width,h=d.height,c=make(w,h),g=c.getContext('2d');
    const pixels=d.image.getContext('2d').getImageData(0,0,w,h).data,raw=__references[name].getContext('2d').getImageData(0,0,...spec.size).data;
    let nativeSamples=0;g.fillStyle='#fff';
    for(let y=spec.occludeFrom;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4;if(pixels[i+3]<240)continue;
      if([1,2].some(dy=>(y+dy>=h||pixels[((y+dy)*w+x)*4+3]<64)&&raw[((y+dy)*w+x)*4+3]>=240)){g.fillRect(x,y,1,1);nativeSamples++;}
    }
    if(!nativeSamples)throw new Error('No original native waist edge samples: '+name);return{canvas:c,nativeSamples};
  }
  window.__verifyWaistHidden=()=>{
    const d=__lastBaby('chin-probe'),target=document.getElementById('chin-probe'),{name}=specFor(d),expected=drawExpected(target,d,true),b=expected.box;
    const raw=expected.canvas.getContext('2d').getImageData(0,0,b.w,b.h).data,got=target.getContext('2d').getImageData(b.x,b.y,b.w,b.h).data;
    const seam=seamMask(d),selection=transformedMask(name,d,b,seam.canvas),bodyMatch=new Uint8Array(b.w*b.h);
    const pose=window.__case?.name||'',expectedPouch=/front hurt|collapse|defeated/.test(pose)?'carrier-reactions-v11.png':
      pose==='boat'?'boat-passengers-v8.png':pose.startsWith('transfer')?'transfer-background-v11-2.png':
      /back|grab|maul|madness/.test(pose)?'back-background-v11-2.png':'front-background-v11-2.png';
    const layers=__carrierDraws.filter(v=>v.target==='chin-probe'&&v.alpha>.999&&v.source===expectedPouch);
    if(!layers.length)throw new Error('Expected authored pouch source was not drawn: '+JSON.stringify({pose,expectedPouch}));
    let lastBodyPixels=null;
    for(const layer of layers){
      const c=make(b.w,b.h),g=c.getContext('2d'),m=[...layer.matrix];m[4]-=b.x;m[5]-=b.y;g.setTransform(...m);native.call(g,layer.image,...layer.args);
      const pixels=g.getImageData(0,0,b.w,b.h).data;lastBodyPixels=pixels;
      for(let i=0;i<selection.length;i+=4)if(selection[i+3]>=200&&pixels[i+3]>=250&&Math.max(...[0,1,2].map(k=>Math.abs(pixels[i+k]-got[i+k])))<=6)bodyMatch[i/4]=1;
    }
    let compared=0,visibleNative=0,matchedAuthoredPouch=0,matchedImage=0,matchedRim=0,nativeColorMatches=0;const details=[];
    for(let i=0;i<selection.length;i+=4){if(selection[i+3]<200)continue;compared++;
      const pixel=i/4,world=(Math.floor(pixel/b.w)+b.y)*target.width+(pixel%b.w)+b.x,rim=window.__rimWitness;
      // The pouch's drawn rim can cover the last waist pixel. Count only pixels
      // actually changed by that foreground stroke and still present at finish.
      const rimMatch=rim?.changed[world]&&Math.max(...[0,1,2].map(k=>Math.abs(rim.rgba[world*4+k]-got[i+k])))<=1;
      const covered=bodyMatch[pixel]||rimMatch,nativeMatch=Math.max(...[0,1,2].map(k=>Math.abs(raw[i+k]-got[i+k])))<=6;
      if(nativeMatch)nativeColorMatches++;if(nativeMatch&&!covered)visibleNative++;
      if(bodyMatch[pixel])matchedImage++;if(rimMatch)matchedRim++;if(covered)matchedAuthoredPouch++;
      if(!covered&&details.length<12)details.push({x:pixel%b.w+b.x,y:Math.floor(pixel/b.w)+b.y,native:[...raw.slice(i,i+4)],final:[...got.slice(i,i+4)],pouch:[...lastBodyPixels.slice(i,i+4)]});
    }
    if(compared<5||visibleNative/compared>.1||matchedAuthoredPouch/compared<.97)
      throw new Error('Original torso waist seam is exposed or lacks authored pouch: '+JSON.stringify({case:window.__case,name,compared,visibleNative,matchedAuthoredPouch,matchedImage,matchedRim,nativeColorMatches,nativeSamples:seam.nativeSamples,details}));
    return{compared,visibleNative,matchedAuthoredPouch,matchedImage,matchedRim,nativeColorMatches,nativeSamples:seam.nativeSamples};
  };
  window.__focusPiece=(render,normalCall,mood,negativeControls=false)=>{
    const{name,spec}=specFor(normalCall),p=spec.protected.collar,center=point(normalCall,p.reduce((s,v)=>s+v[0],0)/p.length,p.reduce((s,v)=>s+v[1],0)/p.length);
    const target=document.getElementById('chin-probe'),g=target.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,384,384);
    window.__carrierDraws=[];g.setTransform(8,0,0,8,192-center.x*8,270-center.y*8);render(g);
    const pixels=__verifyVisiblePiece('chin-probe',mood,true),waist=__verifyWaistHidden(),d=__lastBaby('chin-probe');
    if(negativeControls){
      const saved=g.getImageData(0,0,384,384);g.save();g.setTransform(1,0,0,1,0,0);g.fillStyle='#ff00ff';g.fillRect(142,240,100,65);g.restore();
      let covered=false;try{__verifyVisiblePiece('chin-probe',mood,true);}catch(e){covered=/continuity hidden/.test(e.message);}g.putImageData(saved,0,0);
      if(!covered)throw new Error('Neck/collar foreground-occlusion negative control failed');
      const cut=make(d.width,d.height),cg=cut.getContext('2d');native.call(cg,d.image,0,0);const joinY=Math.max(...spec.protected.neck.map(p=>p[1]))+1;cg.clearRect(0,joinY,d.width,2);
      const fake={...d};Object.defineProperty(fake,'image',{value:cut});let separated=false;try{__verifyPieceSource(fake);}catch(e){separated=/changed or separated/.test(e.message);}
      if(!separated)throw new Error('Separated native neck/collar negative control failed');
      const seam=seamMask(d),q=drawExpected(target,d,true),selection=transformedMask(name,d,q.box,seam.canvas),replacement=g.getImageData(q.box.x,q.box.y,q.box.w,q.box.h),raw=q.canvas.getContext('2d').getImageData(0,0,q.box.w,q.box.h).data;
      for(let i=0;i<selection.length;i+=4)if(selection[i+3]>=200)for(let k=0;k<4;k++)replacement.data[i+k]=raw[i+k];g.putImageData(replacement,q.box.x,q.box.y);
      let exposed=false;try{__verifyWaistHidden();}catch(e){exposed=/waist seam/.test(e.message);}g.putImageData(saved,0,0);
      if(!exposed)throw new Error('Exposed-waist negative control failed');
    }
    return{zoom:8,pixels,waist,negativeControls};
  };
})();"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def load(context, base, errors, failures):
    page = context.new_page()
    page.clock.install()
    page.add_init_script(AUDIT)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda r: failures.append((r.status, r.url)) if r.status >= 400 else None)
    page.goto(f"{base}/{ENTRY}")
    page.wait_for_function("BearlyHeroRig.ready() && BearlyBabyPassenger.ready() && BearlyVisits.audit().artReady && BearlyAtlas.ready() && window.BEARLY_DEBUG_MENU?.stats().frames>0", timeout=60000)
    page.evaluate("__prepareReferences", SOURCE_FRAMES)
    page.clock.pause_at(page.evaluate("Date.now()+1000") / 1000)
    return page


def native_moods(page):
    return page.evaluate("""() => {
      const board=document.getElementById('face-board');board.height=780;
      const b=board.getContext('2d');b.fillStyle='#d8e0d0';b.fillRect(0,0,1280,780);b.font='14px Arial';
      const c=document.getElementById('face-probe').getContext('2d'),results=[];
      for(const[index,name]of Object.keys(__specs).entries())for(const scale of [1.08,.7])for(const flip of [1,-1]){
        c.clearRect(0,0,320,260);__resetBabyAudit();
        BearlyBabyPassenger.draw(c,{mood:name,x:160,y:190,scale,flip});
        const pixels=__verifyVisiblePiece('face-probe',name);
        if(Math.abs(pixels.uniformScale-scale)>1e-7)throw new Error('Mood changed the native physical scale: '+name);
        results.push({name,scale,flip,pixels});
        if(scale===1.08&&flip===1){
          const x=index%4*320,y=Math.floor(index/4)*260,spec=__specs[name];b.fillStyle='#222';b.fillText(name+' · bike source / continuous passenger',x+8,y+20);
          __nativeDrawImage.call(b,__references[name],x+82-spec.pivot[0]*scale,y+170-spec.pivot[1]*scale,spec.size[0]*scale,spec.size[1]*scale);
          b.save();b.translate(x+232,y+170);b.scale(scale,scale);
          __nativeDrawImage.call(b,__lastBaby('face-probe').image,-spec.pivot[0],-spec.pivot[1]);b.restore();
        }
      }
      return results;
    }""")


def probe_evaluate(page, script, height):
    try:
        return page.evaluate(script, height)
    except Exception as error:
        # Retain the actual failed render for geometry review before the test
        # closes its browser; these are unedited browser canvas captures.
        page.evaluate("""() => {
          const d=__lastBaby('face-probe');
          if(d&&window.__failedRender){
            const spec=__specs[__sourceToMood[d.source]],p=spec.protected.collar;
            const center=__sourcePoint(d,p.reduce((s,v)=>s+v[0],0)/p.length,p.reduce((s,v)=>s+v[1],0)/p.length);
            const g=document.getElementById('chin-probe').getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,384,384);
            g.setTransform(8,0,0,8,192-center.x*8,270-center.y*8);__failedRender(g);
          }
          for(const [id,top]of [['face-probe',0],['chin-probe',270]]){
            const c=document.getElementById(id);c.hidden=false;
            c.style.cssText='display:block;position:fixed;left:0;top:'+top+'px;z-index:9999;background:#d8e0d0';
          }
        }""")
        for identifier, label in [("face-probe", "scene"), ("chin-probe", "focused")]:
            page.locator("#" + identifier).screenshot(path=str(SHOTS / f"passenger-failure-{label}.png"))
        (SHOTS / "passenger-failure-case.json").write_text(json.dumps({"case": page.evaluate("window.__case"), "error": str(error)}, indent=2) + "\n")
        raise


def renderer_probes(browser, base, errors, failures, sources_only=False):
    context = browser.new_context(viewport={"width": 1280, "height": 780})
    page = load(context, base, errors, failures)
    rules = page.evaluate("""() => {
      const cases=[
        ['recent throw',{effects:[{kind:'throw',age:.2}]},{},'terror'],
        ['throw expires',{effects:[{kind:'throw',age:.65}]},{},'idle'],
        ['recent impact',{effects:[{kind:'screen-smack',age:.2}]},{},'terror'],
        ['impact expires',{effects:[{kind:'screen-smack',age:.3}]},{},'idle'],
        ['startle precedes held',{held:'adult',effects:[{kind:'throw',age:.2}]},{},'terror'],
        ['expired startle resumes held',{held:'adult',effects:[{kind:'throw',age:1}]},{},'brace'],
        ['expired startle resumes talk',{effects:[{kind:'throw',age:1}]},{talking:true},'point']];
      return cases.map(([name,state,options,expected])=>{
        const actual=BearlyHeroRig.babyMood({state:{hp:100,...state},...options});
        if(actual!==expected)throw new Error('Baby mood priority/expiry: '+JSON.stringify({name,expected,actual}));
        return{name,expected,actual};
      });
    }""")
    # Stop live DOM callbacks before replacing the visible game with a renderer
    # review board. Every cell is drawn by BearlyHeroRig.draw itself.
    page.evaluate("""() => {
      document.body.innerHTML='<canvas id="face-board" width="1280" height="780"></canvas><canvas id="face-probe" width="320" height="260" hidden></canvas><canvas id="chin-probe" width="384" height="384" hidden></canvas>';
      document.body.style.cssText='margin:0;padding:0;display:block;background:#d8e0d0';
    }""")
    native = native_moods(page)
    page.locator("#face-board").screenshot(path=str(SHOTS / "original-bike-and-continuous-passenger-moods.png"))
    if sources_only:
        context.close()
        return {"nativeMoods": native, "moodRules": rules}
    results = []
    for height, label in [(145, "normal"), (90, "small")]:
        probes = probe_evaluate(page, r"""height => {
          const states=[['front idle',{},0,0],['front near lead',{},0,1],['front far lead',{},.5,1],
            ['front hurt',{hurt:true},0,0],['back idle',{baby:{}},0,0],['back near lead',{baby:{}},0,1],
            ['back far lead',{baby:{}},.5,1],['back hurt',{baby:{},hurt:true},0,0],
            ['grab',{baby:{},held:'adult'},0,0],['maul',{baby:{},attack:true},0,0],
            ['collapse',{baby:{},hp:0,defeatAge:.2},0,0],['defeated',{baby:{},hp:0,defeatAge:.8},0,0],
            ['jump',{},0,0,{jump:25}],['talk',{},0,0,{talking:true}],
            ['back jump',{baby:{}},0,0,{jump:25}],['madness',{baby:{},phase:'madness'},0,0]];
          document.getElementById('face-board').height=1040;
          window.__chinBoard=document.createElement('canvas');__chinBoard.width=1280;__chinBoard.height=2560;
          const cb=__chinBoard.getContext('2d');cb.fillStyle='#d8e0d0';cb.fillRect(0,0,1280,2560);cb.font='15px Arial';
          const board=document.getElementById('face-board').getContext('2d');
          board.fillStyle='#d8e0d0';board.fillRect(0,0,1280,1040);board.font='15px Arial';
          const c=document.getElementById('face-probe').getContext('2d'),results=[];
          for(const [index,[name,state,phase,weight,extra={}] ]of states.entries())for(const face of [1,-1]){
            window.__case={name,height,heading:face};
            c.clearRect(0,0,320,260);__resetBabyAudit();
            const render=ctx=>BearlyHeroRig.draw(ctx,160,225,height,face,{distance:phase*BearlyLocomotion.cycleLength(height),weight,state:{hp:100,...state},...extra});
            window.__failedRender=render;
            render(c);
            const mood=name==='talk'?'point':/hurt|maul|collapse|defeated|jump|madness/.test(name)?'terror':name==='grab'?'brace':weight?'laugh':'idle';
            const pixels=__verifyVisiblePiece('face-probe',mood);
            const chin=__focusPiece(render,__lastBaby('face-probe'),mood,index===0&&face===1&&height===145);
            const audit=BearlyHeroRig.audit();
            if(!audit.integratedCarrier)throw new Error('Carrier/head audit missing');
            if(pixels.mirrored!==(face<0))throw new Error('Face heading did not mirror with body');
            results.push({name,height,heading:face,pixels,chin});
            const cell=index*2+(face<0?1:0),cx=cell%4*320,cy=Math.floor(cell/4)*320;
            cb.fillStyle='#222';cb.fillText(name+' · '+(face>0?'right':'left')+' · h'+height,cx+10,cy+20);
            __nativeDrawImage.call(cb,document.getElementById('chin-probe'),cx+20,cy+30,280,280);
            if(face===1){
              const x=index%4*320,y=Math.floor(index/4)*260;
              board.fillStyle='#222';board.fillText(name+' · h'+height,x+12,y+22);
              __nativeDrawImage.call(board,c.canvas,x,y);
            }
          }
          return results;
        }""", height)
        results.extend(probes)
        page.locator("#face-board").screenshot(path=str(SHOTS / f"original-baby-pose-board-{label}.png"))
        page.evaluate("""() => {
          const board=document.getElementById('face-board');board.height=__chinBoard.height;
          __nativeDrawImage.call(board.getContext('2d'),__chinBoard,0,0);
        }""")
        page.locator("#face-board").screenshot(path=str(SHOTS / f"continuous-collar-and-pouch-board-{label}.png"))
    # Match the authored passenger crop and transfer cels used by Visits. These
    # share the real head renderer, without replaying an unrelated boat quest.
    page.evaluate("""async () => {
      window.__authoredImages={};
      for(const [key,file]of Object.entries({boat:'boat-passengers-v8.png',transfer:'bike-transfer-v7.png'})){
        const image=new Image();image.src='assets/art/'+file;await image.decode();
        window.__authoredImages[key]=image;
      }
    }""")
    authored = []
    for height, label in [(145, "normal"), (90, "small")]:
        probes = probe_evaluate(page, r"""height => {
          const frames=[
            ['boat','boat',[108,64,872,1364],[350,1000],1364,false],
            ['transfer2','transfer',[1121,8,304,494],[1258,500],488,true],
            ['transfer3','transfer',[110,516,347,493],[258,1007],488,true],
            ['transfer4','transfer',[604,515,340,495],[772,1008],488,false],
            ['transfer5','transfer',[1112,517,287,495],[1259,1010],488,false]];
          document.getElementById('face-board').height=780;
          window.__chinBoard=document.createElement('canvas');__chinBoard.width=1280;__chinBoard.height=960;
          const cb=__chinBoard.getContext('2d');cb.fillStyle='#d8e0d0';cb.fillRect(0,0,1280,960);cb.font='15px Arial';
          const board=document.getElementById('face-board').getContext('2d');
          board.fillStyle='#d8e0d0';board.fillRect(0,0,1280,780);board.font='15px Arial';
          const c=document.getElementById('face-probe').getContext('2d'),results=[];
          for(const [index,[pose,image,rect,origin,stature,headFlip]]of frames.entries())for(const heading of [1,-1]){
            window.__case={name:pose,height,heading};
            c.clearRect(0,0,320,260);__resetBabyAudit();
            const render=ctx=>{
              ctx.save();ctx.translate(160,pose==='boat'?190:225);ctx.scale(heading,1);
              if(!BearlyHeroRig.drawAuthored(ctx,__authoredImages[image],rect,origin,height/stature,pose,{mode:'water',speed:pose==='boat'?80:0,transfer:pose!=='boat'}))
                throw new Error('Authored pose did not render: '+pose);
              ctx.restore();
            };
            window.__failedRender=render;
            render(c);
            const mood=pose==='boat'?'excited':'brace';
            const pixels=__verifyVisiblePiece('face-probe',mood);
            const chin=__focusPiece(render,__lastBaby('face-probe'),mood);
            const audit=BearlyHeroRig.audit();
            if(audit.pose!==pose || !audit.integratedCarrier)
              throw new Error('Authored carrier/head audit missing: '+pose);
            if(pixels.mirrored!==((heading<0)!==headFlip))
              throw new Error('Authored head orientation changed: '+pose);
            results.push({name:pose,height,heading,rect,origin,scale:height/stature,pixels,chin});
            const cell=index*2+(heading<0?1:0),x=cell%4*320,y=Math.floor(cell/4)*260;
            board.fillStyle='#222';board.fillText(pose+' · '+(heading>0?'right':'left')+' · h'+height,x+12,y+22);
            __nativeDrawImage.call(board,c.canvas,x,y);
            const cx=cell%4*320,cy=Math.floor(cell/4)*320;
            cb.fillStyle='#222';cb.fillText(pose+' · '+(heading>0?'right':'left')+' · h'+height,cx+10,cy+20);
            __nativeDrawImage.call(cb,document.getElementById('chin-probe'),cx+20,cy+30,280,280);
          }
          return results;
        }""", height)
        authored.extend(probes)
        page.locator("#face-board").screenshot(path=str(SHOTS / f"original-baby-authored-board-{label}.png"))
        page.evaluate("""() => {
          const board=document.getElementById('face-board');board.height=__chinBoard.height;
          __nativeDrawImage.call(board.getContext('2d'),__chinBoard,0,0);
        }""")
        page.locator("#face-board").screenshot(path=str(SHOTS / f"continuous-authored-collar-and-pouch-{label}.png"))
    context.close()
    return {"nativeMoods": native, "moodRules": rules, "renderer": results, "authoredRenderer": authored}


def game_capture(page, name, expected):
    try:
        check = page.evaluate("mood=>__verifyVisiblePiece('game',mood)", expected)
    except Exception:
        page.locator(".canvas-wrap").screenshot(path=str(SHOTS / f"{name}-failure.png"))
        raise
    page.locator(".canvas-wrap").screenshot(path=str(SHOTS / f"{name}.png"))
    return {"screenshot": name + ".png", "pixels": check}


def bike_sources(page):
    results = []
    for pose, expected in [("idle", "idle"), ("laugh", "laugh"), ("terror", "terror"),
                           ("brace", "brace"), ("leanBack", "excited"),
                           ("leanForward", "leanForward"), ("point", "point"), ("sick", "sick")]:
        page.evaluate("pose=>{__resetBabyAudit();BEARLY_POSES.set(pose)}", pose)
        page.clock.run_for(40)
        evidence = page.evaluate("""expected => {
          const d=__lastBaby('game',false),spec=__specs[expected];
          if(!d||d.source!==spec.file||d.width!==spec.size[0]||d.height!==spec.size[1])
            throw new Error('Off-bike source differs from actual original bike mood: '+JSON.stringify({expected,draw:d}));
          const a=d.args,w=a.length===4?a[2]:d.width;
          return{pose:BEARLY_POSES.current(),mood:expected,source:d.source,physicalScale:Math.hypot(d.matrix[0],d.matrix[1])*w/d.width};
        }""", expected)
        results.append(evidence)
    page.evaluate("BEARLY_POSES.set(null);__resetBabyAudit()")
    page.clock.run_for(50)
    assert max(r["physicalScale"] for r in results) - min(r["physicalScale"] for r in results) < .0001
    return results


def game_controls(browser, base, errors, failures, width, height, mobile=False):
    context = browser.new_context(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile)
    page = load(context, base, errors, failures)
    page.locator("#introStart").click()
    page.evaluate("BEARLY_DEBUG_MENU.settings.godMode=true;BEARLY_DEBUG_MENU.warp(2500/1.5)")
    page.clock.run_for(100)
    bike = bike_sources(page) if not mobile else []
    page.locator(".dismount-button").click() if mobile else page.keyboard.press("q")
    page.clock.run_for(2700)
    evidence = [game_capture(page, f"original-baby-front-{width}", "idle")]
    for key, heading in [("ArrowRight", "right"), ("ArrowLeft", "left")]:
        page.evaluate("__resetBabyAudit()")
        page.keyboard.down(key)
        page.clock.run_for(340)
        evidence.append(game_capture(page, f"original-baby-walk-{heading}-{width}", "laugh"))
        page.keyboard.up(key)
        page.clock.run_for(250)
    page.keyboard.press("Space")
    page.clock.run_for(180)
    assert page.evaluate("BearlyVisits.audit().jump") > 20
    evidence.append(game_capture(page, f"original-baby-jump-{width}", "terror"))
    page.clock.run_for(800)
    evidence.append(game_capture(page, f"original-baby-after-jump-{width}", "idle"))
    page.evaluate("BearlyVisits.practice();__resetBabyAudit()")
    page.locator(".area-maul").tap() if mobile else page.keyboard.press("j")
    page.clock.run_for(100)
    assert page.evaluate("BearlyHeroRig.audit().pose") == "maul"
    evidence.append(game_capture(page, f"original-baby-maul-{width}", "terror"))
    page.evaluate("__resetBabyAudit()")
    page.locator(".area-grab").tap() if mobile else page.keyboard.press("g")
    page.clock.run_for(450)
    assert page.evaluate("BearlyHeroRig.audit().pose") == "grab"
    evidence.append(game_capture(page, f"original-baby-grab-{width}", "brace"))
    page.locator(".area-grab").tap() if mobile else page.keyboard.press("g")
    page.clock.run_for(100)
    assert not page.evaluate("BearlyVisits.audit().combat.held")
    evidence.append(game_capture(page, f"original-baby-throw-{width}", "terror"))
    page.clock.run_for(1800)
    assert page.evaluate("BearlyVisits.audit().baby") == "back-carrier"
    evidence.append(game_capture(page, f"original-baby-back-{width}", "idle"))
    if not mobile:
        page.evaluate("BEARLY_DEBUG_MENU.warp(BearlyNeighbourhood.entrance(BearlyNeighbourhood.scenes.find(b=>b.key==='pizzeria')).x/1.5)")
        page.clock.run_for(100)
        page.locator(".visit-prompt").click()
        page.clock.run_for(3200)
        page.keyboard.down("ArrowRight")
        page.clock.run_for(4800)
        page.keyboard.up("ArrowRight")
        page.clock.run_for(250)
        page.keyboard.press("e")
        page.clock.run_for(120)
        assert page.evaluate("BearlyVisits.audit().quest.lunch")
        evidence.append(game_capture(page, "original-baby-genuine-shop-talk", "point"))
        page.clock.run_for(3200)
        evidence.append(game_capture(page, "original-baby-talk-ended", "idle"))
        # The second original hostile crew stands in open light. The first
        # crew's underpass intentionally shades every rendered face pixel.
        page.evaluate("BEARLY_DEBUG_MENU.settings.godMode=false;BEARLY_DEBUG_MENU.warp(7260/1.5)")
        page.clock.run_for(100)
        page.keyboard.press("q")
        page.clock.run_for(2300)
        saw_hurt = False
        saw_defeat = False
        for _ in range(160):
            page.clock.run_for(100)
            combat = page.evaluate("BearlyVisits.audit().combat")
            if not saw_hurt and 0 < combat["hp"] < 100 and combat["hurt"]:
                # Retain the real hurt state while its brief impact particles
                # move clear of the original shirt/collar sampling area.
                page.clock.run_for(250)
                assert page.evaluate("BearlyVisits.audit().combat.hurt")
                evidence.append(game_capture(page, "original-baby-real-projectile-hurt", "terror"))
                saw_hurt = True
            if combat["hp"] == 0:
                page.clock.run_for(250)
                assert page.evaluate("BearlyVisits.audit().combat.hp") == 0
                evidence.append(game_capture(page, "original-baby-real-defeat", "terror"))
                saw_defeat = True
                break
        assert saw_hurt and saw_defeat
    if mobile:
        for selector in [".area-jump", ".area-grab", ".area-maul", ".area-exit"]:
            box = page.locator(selector).bounding_box()
            assert box and box["x"] >= 0 and box["y"] >= 0
            assert box["x"] + box["width"] <= width + 1 and box["y"] + box["height"] <= height + 1
        assert page.locator(".foot-heart").count() == 5
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    assert not page.evaluate("window.__looseChair"), "A separate bicycle-seat baby was rendered on foot"
    context.close()
    return {"bikeSources": bike, "controls": evidence}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--sources-only", action="store_true")
    modes.add_argument("--renderer-only", action="store_true")
    modes.add_argument("--controls-only", action="store_true")
    options = parser.parse_args()
    for name, digest in ORIGINALS.items():
        assert hashlib.sha256((ROOT / "assets" / name).read_bytes()).hexdigest() == digest, f"Original face changed: {name}"
    SHOTS.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    errors, failures = [], []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            base = f"http://127.0.0.1:{server.server_port}"
            if options.controls_only:
                # A focused rerun reports only work executed in that invocation.
                # Release-specific phase consolidation is an explicit operation.
                evidence = {"phases": []}
            else:
                evidence = renderer_probes(browser, base, errors, failures, options.sources_only)
                if not options.sources_only:
                    # Checkpoint the successful renderer phase before starting
                    # gameplay, so a later control failure cannot lose its data.
                    (SHOTS / "original-passenger-renderer-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
            if not (options.sources_only or options.renderer_only):
                for width, height, mobile in [(1440, 1000, False), (390, 844, True), (844, 390, True)]:
                    evidence[str(width)] = game_controls(browser, base, errors, failures, width, height, mobile)
            browser.close()
        assert not errors, errors
        assert not failures, failures
        if not (options.sources_only or options.renderer_only):
            evidence.setdefault("phases", []).append({"phase": "actual_controls", "result": "passed", "viewports": ["1440x1000", "390x844", "844x390"]})
        evidence["originalSHA256"] = ORIGINALS
        evidence["entry"] = ENTRY
        filename = "original-passenger-source-evidence.json" if options.sources_only else "original-passenger-renderer-evidence.json" if options.renderer_only else "original-face-pixel-evidence.json"
        (SHOTS / filename).write_text(json.dumps(evidence, indent=2) + "\n")
        print(json.dumps({"result": "passed", "nativeMoodCases": len(evidence.get("nativeMoods", [])),
            "rendererCases": len(evidence.get("renderer", [])), "authoredCases": len(evidence.get("authoredRenderer", [])),
            "originalSHA256": ORIGINALS, "evidence": str(SHOTS / filename)}, indent=2))
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
