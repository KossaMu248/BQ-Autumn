"""V18 authored NPC-frame coverage and runtime walking/running checks.

Whole authored frames retain every opaque body/prop component and exclude other
cells. Runtime rigs are checked independently for connected bodies and visible
lower/upper-body motion; unused pixels from a limb's source are not falsely
required to appear in a posed torso.
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
ENTRY = "autumn-v18.html"
SHOTS = ROOT / "screenshots" / "revision18"


def source_hashes():
    paths = [ROOT / ENTRY, *[ROOT / "js" / name for name in ["game.js", "brawler-art.js", "npc-motion.js", "brawler.js", "hero-rig.js", "locomotion.js", "illustrated-visits.js", "street-life.js"]]]
    paths.extend(ROOT / "assets" / "art" / f"npc-motion-{g}-v16.png" for g in "abc")
    paths.extend(ROOT / "assets" / "art" / f"civilian-{kind}-v16.png" for kind in ["standing", "motion", "rest", "reactions"])
    paths.extend(ROOT / "assets" / "art" / f"cast-{kind}-{g}-v15.png" for kind in ["reactions", "screen"] for g in "abc")
    paths.extend(ROOT / 'assets' / 'art' / name for name in ['teen-molotov-poses-v18.png','teen-rock-poses-v18.png','teen-firecracker-poses-v18.png','teen-screen-v18.png','teen-run-opposites-v18.png'])
    paths.extend(ROOT / 'js' / name for name in ['illustrated-kids.js','weapon-effects.js'])
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()}


AUDIT = r"""(() => {
  const native=CanvasRenderingContext2D.prototype.drawImage;
  const assets=/^(?:adult-cast-[abc]-v15|cast-(?:reactions|screen)-[abc]-v15|npc-motion-[abc]-v16|civilian-(?:standing|motion|rest|reactions)-v16|teen-(?:molotov|rock|firecracker)-poses-v18|teen-screen-v18|teen-run-opposites-v18)\.png$/;
  window.__wardrobeCalls=[];window.__wardrobeActor=null;
  CanvasRenderingContext2D.prototype.drawImage=function(im,...args){
    const source=(im.dataset?.sourceAsset||im.src||'').split('/').pop().split('?')[0];
    if(this.canvas.id==='game'&&assets.test(source)&&this.globalAlpha>.01){
      __wardrobeCalls.push({source,args,sourceRect:im.dataset?.sourceRect||null,sourcePose:im.dataset?.sourcePose||null,actor:__wardrobeActor?{...__wardrobeActor}:null});
    }
    return native.call(this,im,...args);
  };
  window.__installWardrobeActorAudit=()=>{
    const adult=BearlyBrawlArt.adult;
    BearlyBrawlArt.adult=function(c,n,...args){
      const previous=__wardrobeActor;
      __wardrobeActor={id:n.id,variant:n.variant,state:n.state,activity:n.activity,civilian:!!n.civilian,visible:n.visible,kind:n.kind||'resident'};
      try{return adult.call(this,c,n,...args);}finally{__wardrobeActor=previous;}
    };
  };
})();"""

PROBES = r"""async () => {
  const canvas=document.createElement('canvas');canvas.width=440;canvas.height=340;
  const c=canvas.getContext('2d'),native=c.drawImage.bind(c),sources=new Map(),coverageCache=new Map();
  const save=c.save.bind(c),restore=c.restore.bind(c),begin=c.beginPath.bind(c),move=c.moveTo.bind(c),line=c.lineTo.bind(c),rect=c.rect.bind(c),close=c.closePath.bind(c),clip=c.clip.bind(c);
  let calls=[],stack=[],active=[],contours=[];
  const basename=s=>s.split('/').pop().split('?')[0];
  const world=(x,y)=>{const m=c.getTransform();return{x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};};
  c.save=()=>{stack.push(active.slice());return save();};c.restore=()=>{active=stack.pop()||[];return restore();};
  c.beginPath=()=>{contours=[];return begin();};
  c.moveTo=(x,y)=>{contours.push([world(x,y)]);return move(x,y);};
  c.lineTo=(x,y)=>{if(!contours.length)contours.push([]);contours.at(-1).push(world(x,y));return line(x,y);};
  c.rect=(x,y,w,h)=>{contours.push([[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>world(...p)));return rect(x,y,w,h);};
  c.closePath=()=>close();
  c.clip=(...args)=>{active.push({contours:contours.map(v=>v.map(p=>({...p}))),unsupported:args.some(v=>typeof v!=='string')||!contours.length});return clip(...args);};
  c.drawImage=(im,...args)=>{
    const source=basename(im.dataset?.sourceAsset||im.src||'');
    if(source){
      const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;
      const [sx,sy,sw,sh,dx,dy,dw,dh]=args.length===8?args:args.length===4?[0,0,iw,ih,...args]:[0,0,iw,ih,args[0],args[1],iw,ih];
      const origin=im.dataset?.sourceRect?.split(',').map(Number)||[0,0,iw,ih],inverse=c.getTransform().inverse();
      const point=p=>{
        const x=inverse.a*p.x+inverse.c*p.y+inverse.e,y=inverse.b*p.x+inverse.d*p.y+inverse.f;
        return{x:origin[0]+(sx+(x-dx)*sw/dw)*origin[2]/iw,y:origin[1]+(sy+(y-dy)*sh/dh)*origin[3]/ih};
      };
      let tile=null;
      if(im instanceof HTMLCanvasElement)tile=im.getContext('2d').getImageData(0,0,iw,ih).data;
      calls.push({source,im,iw,ih,origin,sx,sy,sw,sh,tile,alpha:c.globalAlpha,filter:c.filter,clips:active.map(v=>({unsupported:v.unsupported,contours:v.contours.map(ps=>ps.map(point))}))});
    }
    return native(im,...args);
  };
  function spec(name){
    if(/^teen-(molotov|rock|firecracker)-poses-v18/.test(name))return{rows:3,cols:5,type:'teenPose',kind:({molotov:'bottle',rock:'rock',firecracker:'firecracker'})[name.match(/^teen-(.*)-poses/)[1]]};
    if(name==='teen-screen-v18.png')return{rows:2,cols:3,type:'teenScreen'};
    if(name==='teen-run-opposites-v18.png')return{rows:3,cols:2,type:'teenOpposite'};
    if(/^npc-motion-[abc]-v16/.test(name))return{rows:3,cols:5,type:'motion',group:'abc'.indexOf(name.match(/-([abc])-v16/)[1])};
    if(name==='civilian-standing-v16.png')return{rows:1,cols:3,type:'civilStanding'};
    if(name==='civilian-motion-v16.png')return{rows:3,cols:4,type:'civilMotion'};
    if(name==='civilian-rest-v16.png')return{rows:3,cols:4,type:'civilRest'};
    if(name==='civilian-reactions-v16.png')return{rows:3,cols:5,type:'civilReaction'};
    if(/^cast-reactions-[abc]-v15/.test(name))return{rows:3,cols:3,type:'reaction',group:'abc'.indexOf(name.match(/-([abc])-v15/)[1])};
    if(/^cast-screen-[abc]-v15/.test(name))return{rows:2,cols:3,type:'screen',group:'abc'.indexOf(name.match(/-([abc])-v15/)[1])};
    throw Error('Unexpected NPC source '+name);
  }
  async function source(name){
    if(sources.has(name))return sources.get(name);
    const layout=spec(name),im=new Image();im.src='assets/art/'+name;await im.decode();
    const raw=document.createElement('canvas');raw.width=im.naturalWidth;raw.height=im.naturalHeight;
    const g=raw.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
    const pixels=g.getImageData(0,0,raw.width,raw.height).data,w=raw.width,h=raw.height,size=w*h;
    const seen=new Uint8Array(size),queue=new Int32Array(size),groups=Array.from({length:layout.rows*layout.cols},()=>[]),major=Array(groups.length).fill(0);
    // Assign entire connected components by their mass centre, not by clipping
    // their pixels to nominal cells. Toes crossing a cell edge remain included.
    // Detached newspapers/cigarette smoke stay with the authored cell as well.
    for(let seed=0;seed<size;seed++){
      if(seen[seed]||pixels[seed*4+3]<160)continue;
      let head=0,tail=1,sumX=0,sumY=0;queue[0]=seed;seen[seed]=1;
      while(head<tail){
        const at=queue[head++],x=at%w,y=Math.floor(at/w);sumX+=x;sumY+=y;
        for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
          const xx=x+ox,yy=y+oy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
          const next=yy*w+xx;if(seen[next]||pixels[next*4+3]<160)continue;
          seen[next]=1;queue[tail++]=next;
        }
      }
      if(tail<8)continue;
      const col=Math.min(layout.cols-1,Math.floor((sumX/tail)/w*layout.cols)),row=Math.min(layout.rows-1,Math.floor((sumY/tail)/h*layout.rows)),index=row*layout.cols+col;
      groups[index].push(queue.slice(0,tail));major[index]=Math.max(major[index],tail);
    }
    if(major.some(v=>v<1500))throw Error('Missing independent opaque body in '+name+': '+major.join(','));
    const value={...layout,name,pixels,w,h,groups:groups.map(parts=>({parts,total:parts.reduce((n,p)=>n+p.length,0)}))};
    sources.set(name,value);return value;
  }
  function expected(s,variant,pose){
    const p=String(pose).toLowerCase().replace(/[-_]/g,''),local=variant%3;
    if(s.type==='teenPose'){if(s.kind!==variant)throw Error('Wrong teen identity source');return ['idle','phone','lean','warn','cover','ready','windup','release','recover','hurt','runa','runb','runc','rund','prone'].indexOf(p);}
    if(s.type==='teenOpposite')return ['bottle','rock','firecracker'].indexOf(variant)*2+['runc','rund'].indexOf(p);
    if(s.type==='teenScreen')return (p==='screendamaged'?3:0)+['bottle','rock','firecracker'].indexOf(variant);
    if(['motion','reaction','screen'].includes(s.type)&&s.group!==Math.floor(variant/3))throw Error('Wrong identity pack '+JSON.stringify({source:s.name,variant,pose}));
    if(s.type==='motion')return local*5+({idle:0,walka:1,walkb:2,runa:3,runb:4}[p]);
    if(s.type==='reaction')return local*3+({hurt:0,stagger:0,fall:1,falling:1,prone:2,dead:2}[p]);
    if(s.type==='screen')return (p==='screendamaged'?3:0)+local;
    if(variant<9)throw Error('Civilian source used for old character '+variant);
    const row=variant-9;
    if(s.type==='civilStanding')return row;
    if(s.type==='civilMotion')return row*4+({walka:0,walkb:1,runa:2,runb:3}[p]);
    if(s.type==='civilRest')return row*4+({sit:0,read:1,smoke:2,hide:3,cower:3}[p]);
    return row*5+({hurt:0,stagger:0,fall:1,falling:1,prone:2,dead:2,screen:3,screendamaged:4}[p]);
  }
  function inside(x,y,v){
    if(v.unsupported)return false;let winding=0;
    for(const ps of v.contours)for(let i=0;i<ps.length;i++){
      const a=ps[i],b=ps[(i+1)%ps.length],cross=(b.x-a.x)*(y-a.y)-(x-a.x)*(b.y-a.y);
      if(a.y<=y&&b.y>y&&cross>0)winding++;else if(a.y>y&&b.y<=y&&cross<0)winding--;
    }return winding!==0;
  }
  function retained(d,x,y,rawAlpha){
    const u=(x-d.origin[0])*d.iw/d.origin[2],v=(y-d.origin[1])*d.ih/d.origin[3];
    if(u<d.sx||u>=d.sx+d.sw||v<d.sy||v>=d.sy+d.sh||d.clips.some(p=>!inside(x,y,p)))return false;
    if(!d.tile)return true;
    const xx=Math.floor(u),yy=Math.floor(v);return xx>=0&&yy>=0&&xx<d.iw&&yy<d.ih&&d.tile[(yy*d.iw+xx)*4+3]>=rawAlpha-2;
  }
  async function coverage(draws,variant,pose){
    const names=[...new Set(draws.map(d=>d.source))];
    if(names.length!==1)throw Error('A whole authored pose must use one source '+JSON.stringify({variant,pose,names}));
    const s=await source(names[0]),index=expected(s,variant,pose),target=s.groups[index];
    if(!target)throw Error('Unmapped independent pose '+JSON.stringify({variant,pose,source:s.name,index}));
    const key=JSON.stringify([s.name,variant,pose,draws.map(d=>[d.origin,d.sx,d.sy,d.sw,d.sh,d.clips])]);
    if(coverageCache.has(key))return coverageCache.get(key);
    const counts=s.groups.map(group=>{
      let count=0;for(const part of group.parts)for(const at of part){const x=at%s.w+.5,y=Math.floor(at/s.w)+.5;if(draws.some(d=>retained(d,x,y,s.pixels[at*4+3])))count++;}return count;
    });
    const result={source:s.name,coverage:counts[index]/target.total,neighborPixels:counts.reduce((n,v,i)=>n+(i===index?0:v),0),unsupported:draws.some(d=>d.clips.some(v=>v.unsupported))};
    coverageCache.set(key,result);return result;
  }
  const frames=BearlyNpcMotion.frames(),results=[],faults=[];
  if(!frames.length)throw Error('No authored motion frames exposed');
  for(const frame of frames)for(const heading of [1,-1])for(const height of [145,90]){
    calls=[];active=[];stack=[];contours=[];c.resetTransform();c.globalAlpha=1;c.clearRect(0,0,440,340);
    const drawn=BearlyNpcMotion.drawPose(c,{variant:frame.variant,pose:frame.pose,x:220,y:290,height,face:heading});
    if(drawn===false||!calls.length)throw Error('No authored frame '+JSON.stringify(frame));
    if(calls.some(d=>d.alpha<.999||d.filter!=='none'))throw Error('Authored pose unexpectedly faded/filtered '+JSON.stringify(frame));
    const proof=await coverage(calls,frame.variant,frame.pose),label={variant:frame.variant,pose:frame.pose,heading,height,...proof};
    if(proof.coverage!==1||proof.neighborPixels!==0||proof.unsupported)faults.push(label);results.push(label);
  }
  // Existing combat reactions still use whole authored cels and remain strict.
  for(let variant=0;variant<12;variant++)for(const [pose,state,age]of [['hurt','stagger',.15],['fall','fall',.2],['prone','dead',1]])for(const heading of [1,-1])for(const height of [145,90]){
    calls=[];active=[];stack=[];contours=[];c.resetTransform();c.globalAlpha=1;c.clearRect(0,0,440,340);
    BearlyBrawlArt.adult(c,{id:'source-'+variant,variant,civilian:variant>=6,state,age,face:heading,mood:'calm',activity:'cower',hp:40},220,290,height);
    if(!calls.length)throw Error('No reaction source '+JSON.stringify({variant,pose}));
    const proof=await coverage(calls,variant,pose),label={variant,pose,heading,height,...proof};
    if(proof.coverage!==1||proof.neighborPixels!==0||proof.unsupported)faults.push(label);results.push(label);
  }
  const teenFrames=BearlyKids.frames();
  for(const frame of teenFrames)for(const heading of [1,-1])for(const height of [145,90]){
    calls=[];active=[];stack=[];contours=[];c.resetTransform();c.globalAlpha=1;c.clearRect(0,0,440,340);
    const source=BearlyKids.source(frame.kind,frame.pose),scale=height/source.stature;
    c.save();c.translate(220,290);c.scale(heading,1);c.drawImage(source.image,...source.rect,-source.anchor[0]*scale,-source.anchor[1]*scale,source.rect[2]*scale,source.rect[3]*scale);c.restore();
    const proof=await coverage(calls,frame.kind,frame.pose),label={kind:frame.kind,pose:frame.pose,heading,height,...proof};
    if(proof.coverage!==1||proof.neighborPixels!==0||proof.unsupported)faults.push(label);results.push(label);
  }
  return{authoredFrames:frames.length+teenFrames.length,adultAuthoredFrames:frames.length,teenAuthoredFrames:teenFrames.length,cases:results.length,minCoverage:Math.min(...results.map(r=>r.coverage)),maxNeighborPixels:Math.max(...results.map(r=>r.neighborPixels)),faultCount:faults.length,faults:faults.slice(0,30)};
}"""

RUNTIME = r"""() => {
  const canvas=document.createElement('canvas');canvas.width=360;canvas.height=300;
  const c=canvas.getContext('2d',{willReadFrequently:true}),nativeDraw=c.drawImage.bind(c),observedCache=new Set(),observedPhases=new Map();
  c.drawImage=(im,...args)=>{if(im.dataset?.sourceTransform==='walk-cache'){observedCache.add(im);const variant=+im.dataset.sourceVariant;if(!observedPhases.has(variant))observedPhases.set(variant,new Set());observedPhases.get(variant).add(Math.round(+im.dataset.sourcePhase*48)%48);}return nativeDraw(im,...args);};
  function pixels(){return c.getImageData(0,0,360,300).data;}
  function measure(data,height){
    const w=360,h=300,seen=new Uint8Array(w*h),queue=new Int32Array(w*h),parts=[];let total=0;
    for(let seed=0;seed<w*h;seed++){
      if(seen[seed]||data[seed*4+3]<140)continue;
      let head=0,tail=1;queue[0]=seed;seen[seed]=1;
      while(head<tail){const at=queue[head++],x=at%w,y=Math.floor(at/w);for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
        const xx=x+ox,yy=y+oy;if(xx<0||xx>=w||yy<0||yy>=h)continue;const next=yy*w+xx;
        if(seen[next]||data[next*4+3]<140)continue;seen[next]=1;queue[tail++]=next;
      }}parts.push(tail);total+=tail;
    }
    parts.sort((a,b)=>b-a);return{majorComponents:parts.filter(v=>v>height*height*.025).length,mainRatio:parts[0]/total};
  }
  const cases=[],faults=[];let negatives=0;
  for(let variant=0;variant<12;variant++)for(const height of [145,90])for(const heading of [1,-1])for(const activity of ['walk','run']){
    let baseline=null,maxFootChange=0,maxArmChange=0;
    for(let phase=0;phase<48;phase++){
      c.resetTransform();c.clearRect(0,0,360,300);
      BearlyBrawlArt.adult(c,{id:'gait-'+variant,kind:'resident',variant,civilian:variant>=6,state:'idle',age:phase*.1,activity,moving:true,running:activity==='run',speed:activity==='run'?260:55,distance:phase/48*height*(variant===9?1.05:variant===11?.84:1)*(activity==='walk'?.72:1.05),face:heading,mood:activity==='run'&&variant<6?'aggressive':'calm',hp:60},180,260,height);
      const data=pixels(),body=measure(data,height);
      if(!baseline)baseline=data;
      let feet=0,arms=0;
      for(let y=Math.floor(260-height);y<270;y++)for(let x=50;x<310;x++){
        const at=(y*360+x)*4,changed=Math.max(...[0,1,2,3].map(k=>Math.abs(data[at+k]-baseline[at+k])))>35;
        if(changed&&y>260-height*.24)feet++;
        if(changed&&y>260-height*.75&&y<260-height*.4)arms++;
      }
      maxFootChange=Math.max(maxFootChange,feet);maxArmChange=Math.max(maxArmChange,arms);
      const label={variant,height,heading,activity,phase,...body};
      if(body.majorComponents!==1||body.mainRatio<.99)faults.push(label);
      cases.push(label);
    }
    if(maxFootChange<height*.5||maxArmChange<height*.18)faults.push({variant,height,heading,activity,issue:'Static lower/upper-body animation',maxFootChange,maxArmChange});
    if(variant===0&&heading===1&&activity==='walk'){
      c.clearRect(0,260-height*.3,360,4);const broken=measure(pixels(),height);
      if(broken.majorComponents===1&&broken.mainRatio>=.99)throw Error('Detached-leg runtime negative control failed');negatives++;
    }
  }
  return{cases:cases.length,cachedFrameCount:observedCache.size,cacheRGBABytes:[...observedCache].reduce((sum,im)=>sum+im.width*im.height*4,0),cachedPhases:Object.fromEntries([...observedPhases].map(([v,phases])=>[v,[...phases].sort((a,b)=>a-b)])),minMainBodyRatio:Math.min(...cases.map(v=>v.mainRatio)),negativeControls:negatives,faultCount:faults.length,faults:faults.slice(0,30)};
}"""


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--renderer-only", action="store_true")
    modes.add_argument("--controls-only", action="store_true")
    args = parser.parse_args()
    SHOTS.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    errors, failures, evidence = [], [], {"entry": ENTRY, "build": "AUTUMN_RIDE_ART_V18"}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
            if not args.controls_only:
                page = browser.new_page()
                page.clock.install()
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.on("response", lambda r: failures.append([r.status, r.url]) if r.status >= 400 else None)
                page.goto(f"http://127.0.0.1:{server.server_port}/{ENTRY}")
                page.wait_for_function("BearlyVisits.audit().artReady && BearlyNpcMotion.ready() && (!BearlyNpcMotion.cacheStats || BearlyNpcMotion.cacheStats().complete)", timeout=180000)
                page.clock.pause_at(page.evaluate("Date.now()+1000") / 1000)
                catalog = page.evaluate("BearlyBrawlArt.wardrobe()")
                assert len(catalog) == 12 and len({n['label'] for n in catalog}) == 12
                assert [n['variant'] for n in catalog if n['character'].get('civilian')] == list(range(6, 12))
                assert [n['variant'] for n in catalog if n['character'].get('faceCovered')] == [2, 5]
                assert [n['character']['age'] for n in catalog[9:]] == [24,46,68]
                assert sum(n['character']['ageGroup']=='young-adult' for n in catalog)==7
                evidence['catalog'] = catalog
                evidence['sourceCoverage'] = page.evaluate(PROBES)
                (SHOTS / 'street-life-source-evidence.json').write_text(json.dumps({**evidence,'result':'checking','sourceSHA256':source_hashes()},indent=2)+'\n')
                assert evidence['sourceCoverage']['faultCount'] == 0, evidence['sourceCoverage']
                cache_before = page.evaluate('BearlyNpcMotion.cacheStats?.() || null')
                evidence['runtimeMotion'] = page.evaluate(RUNTIME)
                cache_after = page.evaluate('BearlyNpcMotion.cacheStats?.() || null')
                if cache_after:
                    assert evidence['runtimeMotion']['cachedFrameCount'] == cache_after['frameCount'], evidence['runtimeMotion']
                    assert evidence['runtimeMotion']['cacheRGBABytes'] == cache_after['bytes'], evidence['runtimeMotion']
                    assert all(phases == list(range(48)) for phases in evidence['runtimeMotion']['cachedPhases'].values()), evidence['runtimeMotion']
                    assert cache_after['complete'] and cache_after['frameCount'] == cache_after['capacity'] == 576, cache_after
                    assert cache_after['bytes'] <= cache_after['limitBytes'] == 48*1024*1024, cache_after
                    assert sum(v['bytes'] for v in cache_after['variants']) == cache_after['bytes'], cache_after
                    assert all(v['frames'] == cache_after['phaseCount'] == 48 for v in cache_after['variants']), cache_after
                    assert cache_after['frameCount'] == cache_before['frameCount'] and cache_after['bytes'] == cache_before['bytes'], 'Different sizes/headings must reuse the bounded cache'
                    assert cache_after['hits']-cache_before['hits'] >= 2304, cache_after
                    evidence['boundedWalkCache'] = {'before':cache_before,'after':cache_after,'variedHeightAndHeadingCases':2304,'unchangedBytes':True,'unchangedFrameCount':True}

                (SHOTS / 'street-life-source-evidence.json').write_text(json.dumps({**evidence,'result':'checking','sourceSHA256':source_hashes()},indent=2)+'\n')
                assert evidence['runtimeMotion']['faultCount'] == 0, evidence['runtimeMotion']
                page.close()
                evidence.update({"result": "passed", "sourceSHA256": source_hashes(), "pageErrors": errors, "httpFailures": failures})
                (SHOTS / 'street-life-source-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
            if not args.renderer_only:
                from browser_street_life import run_controls
                evidence['controls'] = run_controls(browser, f"http://127.0.0.1:{server.server_port}", errors, failures)
            browser.close()
        assert not errors, errors
        assert not failures, failures
        evidence.update({"result": "passed", "sourceSHA256": source_hashes(), "pageErrors": errors, "httpFailures": failures})
        filename = 'street-life-source-evidence.json' if args.renderer_only else 'street-life-controls-evidence.json' if args.controls_only else 'street-life-evidence.json'
        (SHOTS / filename).write_text(json.dumps(evidence, indent=2) + '\n')
        print(json.dumps({"result": "passed", "sourceCoverage": evidence.get('sourceCoverage'), "runtimeMotion": evidence.get('runtimeMotion'), "controls": bool(evidence.get('controls'))}))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
