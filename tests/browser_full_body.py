"""Check actual screen-impact draw bounds and complete source figures in Chromium.

This exercises the renderer independently of combat AI, so every cast member,
motion preference and portrait crop receives the same flight/impact coverage.
Opaque connected components identify the actual bodies; observed clip paths
are checked in source coordinates rather than assuming fixed sheet cells.
It does not write screenshots or mutate the game state.
"""
import functools
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ENTRY = "autumn-v18.html"
ASSETS = ("cast-screen-a-v15.png", "cast-screen-b-v15.png", "cast-screen-c-v15.png", "civilian-reactions-v16.png", "teen-screen-v18.png")
TEEN_POSE_ASSETS = ("teen-molotov-poses-v18.png", "teen-rock-poses-v18.png", "teen-firecracker-poses-v18.png", "teen-run-opposites-v18.png")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    required = [ROOT / ENTRY, *(ROOT / "assets" / "art" / name for name in (*ASSETS, *TEEN_POSE_ASSETS))]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
    if missing:
        raise SystemExit("Full-body regression needs: " + ", ".join(missing))

    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))
    )
    Thread(target=server.serve_forever, daemon=True).start()
    errors, failed_assets = [], []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            page.clock.install()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on(
                "response",
                lambda response: failed_assets.append(response.url)
                if response.status >= 400
                else None,
            )
            page.goto(f"http://127.0.0.1:{server.server_port}/{ENTRY}")
            page.wait_for_function("BearlyVisits.audit().artReady && BearlyAtlas.ready() && BearlyKids.ready() && window.BEARLY_DEBUG_MENU?.stats().frames>0")
            page.clock.pause_at(page.evaluate("Date.now()+1000") / 1000)
            result = page.evaluate(
                r"""async () => {
                  await BearlyKids.loaded;
                  const teenScreenFrames=BearlyKids.frames().filter(frame=>/^screen/.test(frame.pose));
                  if(teenScreenFrames.length!==6||teenScreenFrames.some(frame=>!frame.source.endsWith('/teen-screen-v18.png')))throw Error('Missing six authored teen full-body screen cels');
                  const rawSources=new Map();
                  for(const name of ['cast-screen-a-v15.png','cast-screen-b-v15.png','cast-screen-c-v15.png','civilian-reactions-v16.png','teen-screen-v18.png']){const im=new Image();im.src='assets/art/'+name;await im.decode();rawSources.set(name,im);}
                  const W=1160,H=640,canvas=document.createElement('canvas');
                  canvas.width=W;canvas.height=H;
                  const ctx=canvas.getContext('2d'),actualDraw=ctx.drawImage.bind(ctx),actualText=ctx.fillText.bind(ctx);
                  const sourceComponents=new Map();
                  const actualSave=ctx.save.bind(ctx),actualRestore=ctx.restore.bind(ctx),actualBegin=ctx.beginPath.bind(ctx),actualMove=ctx.moveTo.bind(ctx),actualLine=ctx.lineTo.bind(ctx),actualClose=ctx.closePath.bind(ctx),actualClip=ctx.clip.bind(ctx);
                  let clipStack=[],activeClips=[],pathContours=[];
                  function worldPoint(x,y){const m=ctx.getTransform();return {x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};}
                  ctx.save=function(){clipStack.push(activeClips.slice());return actualSave();};
                  ctx.restore=function(){activeClips=clipStack.pop()||[];return actualRestore();};
                  ctx.beginPath=function(){pathContours=[];return actualBegin();};
                  ctx.moveTo=function(x,y){pathContours.push([worldPoint(x,y)]);return actualMove(x,y);};
                  ctx.lineTo=function(x,y){if(!pathContours.length)pathContours.push([]);pathContours[pathContours.length-1].push(worldPoint(x,y));return actualLine(x,y);};
                  ctx.closePath=function(){return actualClose();};
                  ctx.clip=function(...args){
                    const unsupported=args.some(arg=>typeof arg!=='string')||!pathContours.length;
                    activeClips.push({contours:pathContours.map(contour=>contour.map(p=>({...p}))),rule:args.find(arg=>typeof arg==='string')||'nonzero',unsupported});
                    return actualClip(...args);
                  };
                  let draws=[],texts=[];
                  ctx.fillText=function(value,...args){texts.push(String(value));return actualText(value,...args);};
                  // Observe the real destination corners after all renderer transforms.
                  ctx.drawImage=function(im,...args){
                    const name=(im.dataset?.sourceAsset||im.src||'').split('/').pop().split('?')[0];
                    if(rawSources.has(name) && this.globalAlpha>.01){
                      const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;
                      const origin=im.dataset?.sourceRect?.split(',').map(Number)||[0,0,iw,ih];
                      let sx=0,sy=0,sw=iw,sh=ih,dx,dy,dw,dh;
                      if(args.length===8)[sx,sy,sw,sh,dx,dy,dw,dh]=args;
                      else if(args.length===4)[dx,dy,dw,dh]=args;
                      else { [dx,dy]=args;dw=sw;dh=sh; }
                      const matrix=this.getTransform();
                      const points=[[dx,dy],[dx+dw,dy],[dx+dw,dy+dh],[dx,dy+dh]].map(([x,y])=>({x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f}));
                      const inverse=matrix.inverse();
                      const clips=activeClips.map(clip=>({...clip,contours:clip.contours.map(contour=>contour.map(p=>{
                        const x=inverse.a*p.x+inverse.c*p.y+inverse.e,y=inverse.b*p.x+inverse.d*p.y+inverse.f;
                        return {x:origin[0]+(sx+(x-dx)*sw/dw)*origin[2]/iw,y:origin[1]+(sy+(y-dy)*sh/dh)*origin[3]/ih};
                      }))}));
                      const tile=im instanceof HTMLCanvasElement?im.getContext('2d').getImageData(0,0,iw,ih).data:null;
                      draws.push({im:rawSources.get(name),sx:origin[0]+sx*origin[2]/iw,sy:origin[1]+sy*origin[3]/ih,sw:sw*origin[2]/iw,sh:sh*origin[3]/ih,points,clips,alpha:this.globalAlpha,tile,iw,ih,origin});
                    }
                    return actualDraw(im,...args);
                  };
                  function bodyComponents(im){
                    if(sourceComponents.has(im))return sourceComponents.get(im);
                    const source=document.createElement('canvas');source.width=im.naturalWidth;source.height=im.naturalHeight;
                    const c=source.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0);
                    const pixels=c.getImageData(0,0,source.width,source.height).data,w=source.width,h=source.height,size=w*h;
                    const seen=new Uint8Array(size),queue=new Int32Array(size),major=[];
                    // Eight-connected opacity, including toes or palms crossing nominal grid edges.
                    for(let seed=0;seed<size;seed++){
                      if(seen[seed]||pixels[seed*4+3]<160)continue;
                      let head=0,tail=1,sumX=0,sumY=0;queue[0]=seed;seen[seed]=1;
                      while(head<tail){
                        const index=queue[head++],x=index%w,y=Math.floor(index/w);sumX+=x;sumY+=y;
                        for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
                          const xx=x+ox,yy=y+oy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
                          const next=yy*w+xx;if(seen[next]||pixels[next*4+3]<160)continue;
                          seen[next]=1;queue[tail++]=next;
                        }
                      }
                      if(tail>1500)major.push({pixels:queue.slice(0,tail),count:tail,centerX:sumX/tail,centerY:sumY/tail});
                    }
                    const civilian=/civilian-reactions-v16/.test(im.src),rows=civilian?3:2,columns=civilian?5:3;
                    if(major.length!==rows*columns)throw Error('Expected '+rows*columns+' separate opaque bodies in '+im.src+'; got '+major.map(c=>c.count).join(','));
                    // Independent connected components, ordered by mass centres,
                    // identify actors even when palms/toes cross nominal cells.
                    major.sort((a,b)=>a.centerY-b.centerY);
                    const frames=[];
                    for(let row=0;row<rows;row++)frames.push(...major.slice(row*columns,(row+1)*columns).sort((a,b)=>a.centerX-b.centerX).map((body,col)=>({...body,row,col})));
                    const analysis={frames,pixels,width:w,height:h,civilian,kind:/teen-screen-v18/.test(im.src)?'gangster':'resident'};
                    sourceComponents.set(im,analysis);return analysis;
                  }
                  function insideClip(x,y,clip){
                    if(clip.unsupported)return false;
                    let winding=0;
                    for(const points of clip.contours)for(let i=0;i<points.length;i++){
                      const a=points[i],b=points[(i+1)%points.length],cross=(b.x-a.x)*(y-a.y)-(x-a.x)*(b.y-a.y);
                      if(a.y<=y&&b.y>y&&cross>0)winding++;
                      else if(a.y>y&&b.y<=y&&cross<0)winding--;
                    }
                    return clip.rule==='evenodd'?Math.abs(winding)%2===1:winding!==0;
                  }
                  const coverageCache=new Map();
                  function componentCoverage(draw,actor,damaged){
                    const {im,sx,sy,sw,sh,clips,tile,iw,ih,origin}=draw,analysis=bodyComponents(im);
                    const col=analysis.civilian?(damaged?4:3):actor.variant%3;
                    const row=analysis.civilian?actor.variant-9:(damaged?1:0);
                    const clipKey=clips.map(clip=>[clip.rule,clip.unsupported,clip.contours.map(contour=>contour.map(p=>[p.x.toFixed(3),p.y.toFixed(3)]))]);
                    const key=JSON.stringify([im.src,sx,sy,sw,sh,row,col,clipKey,!!tile,origin]);
                    if(coverageCache.has(key))return coverageCache.get(key);
                    const counts=analysis.frames.map(body=>{
                      let included=0;
                      for(const index of body.pixels){
                        const x=index%analysis.width+.5,y=Math.floor(index/analysis.width)+.5;
                        const tx=Math.floor((x-origin[0])*iw/origin[2]),ty=Math.floor((y-origin[1])*ih/origin[3]);
                        const sourcePresent=!tile||(tx>=0&&ty>=0&&tx<iw&&ty<ih&&tile[(ty*iw+tx)*4+3]>=analysis.pixels[index*4+3]-2);
                        if(sourcePresent&&x>=sx&&x<sx+sw&&y>=sy&&y<sy+sh&&clips.every(clip=>insideClip(x,y,clip)))included++;
                      }
                      return included;
                    });
                    const dominant=counts.indexOf(Math.max(...counts)),actual=analysis.frames[dominant];
                    const expectedIndex=analysis.frames.findIndex(body=>body.row===row&&body.col===col),expected=analysis.frames[expectedIndex];
                    if(!expected)throw Error('No independent body for '+JSON.stringify({source:im.src,variant:actor.variant,row,col}));
                    const value={row:actual.row,col:actual.col,damaged:analysis.civilian?actual.col===4:actual.row===1,kind:analysis.kind,total:expected.count,coverage:counts[expectedIndex]/expected.count,otherBodyPixels:counts.reduce((sum,count,i)=>sum+(i===expectedIndex?0:count),0),unsupportedClip:clips.some(clip=>clip.unsupported)};
                    coverageCache.set(key,value);return value;
                  }
                  const profiles=[
                    {name:'desktop/full landscape',left:0,width:W},
                    {name:'portrait left',left:0,width:296},
                    {name:'portrait middle',left:432,width:296},
                    {name:'portrait right',left:W-296,width:296}
                  ];
                  const actors=[
                    ...Array.from({length:12},(_,variant)=>({kind:'resident',variant,civilian:variant>=6,item:'rock'})),
                    ...['bottle','rock','firecracker'].map((item,variant)=>({kind:'gangster',variant,item}))
                  ];
                  const faults=[];let samples=0,drawCount=0,damagedSamples=0,minCoverage=1,maxNeighborPixels=0;
                  for(const profile of profiles)for(const actor of actors)for(const reduced of [false,true]){
                    for(const side of ['left','center','right'])for(const age of [.05,.3,.6,.64,.72,.85,1.0]){
                      const startX=profile.left+(side==='left'?12:side==='right'?profile.width-12:profile.width*.5);
                      const npc={...actor,id:'render-test',state:'screen',age,startX:1,startDepth:0,x:1,depth:0,face:1,hp:actor.variant===2?0:28,maxHp:60,lastDamage:actor.variant===2?6:32};
                      const state={npcs:[npc],time:age},before=JSON.stringify(state);
                      draws=[];texts=[];ctx.resetTransform();ctx.globalAlpha=1;ctx.clearRect(0,0,W,H);
                      BearlyBrawlArt.overlay(ctx,state,W,H,()=>({x:startX,y:H*.88,height:172}),reduced,{left:profile.left,width:profile.width});
                      const label={profile:profile.name,kind:actor.kind,variant:actor.variant,reduced,side,age};
                      if(JSON.stringify(state)!==before)faults.push({...label,issue:'renderer changed input health/damage/state'});
                      if(!draws.length){faults.push({...label,issue:'no full-body art was drawn'});continue;}
                      let hasDamaged=false;
                      for(const draw of draws){
                        drawCount++;
                        const xs=draw.points.map(p=>p.x),ys=draw.points.map(p=>p.y),bounds={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
                        if(bounds.left<profile.left-.5||bounds.right>profile.left+profile.width+.5||bounds.top<-.5||bounds.bottom>H+.5)faults.push({...label,issue:'full body outside visible view',bounds});
                        const source=componentCoverage(draw,actor,age>=.74);
                        const expectedFile=actor.kind==='gangster'?'teen-screen-v18.png':actor.variant>=9?'civilian-reactions-v16.png':'cast-screen-'+['a','b','c'][Math.floor(actor.variant/3)]+'-v15.png';
                        if(!draw.im.src.split('?')[0].endsWith('/'+expectedFile))faults.push({...label,issue:'wrong wardrobe pack',source:draw.im.src,expectedFile});
                        minCoverage=Math.min(minCoverage,source.coverage);maxNeighborPixels=Math.max(maxNeighborPixels,source.otherBodyPixels);
                        if(source.coverage<1)faults.push({...label,issue:'source crop or observed clip omits opaque body pixels',coverage:source.coverage});
                        if(source.otherBodyPixels>0)faults.push({...label,issue:'neighbor body fragment rendered',otherBodyPixels:source.otherBodyPixels});
                        if(source.kind!==actor.kind||source.unsupportedClip)faults.push({...label,issue:'wrong cast or unobserved clip',sourceKind:source.kind,unsupportedClip:source.unsupportedClip});
                        if(source.damaged&&draw.alpha>.2)hasDamaged=true;
                      }
                      if(age>=.85){
                        damagedSamples++;
                        if(!hasDamaged)faults.push({...label,issue:'damaged full-body row not displayed'});
                        if(!texts.some(text=>/^[−-]\d+$/.test(text)&&Number(text.slice(1))===npc.lastDamage))faults.push({...label,issue:'visible damage amount differs from actual throw damage',texts,damage:npc.lastDamage});
                      }
                      samples++;
                    }
                  }
                  return {samples,drawCount,damagedSamples,minCoverage,maxNeighborPixels,teenScreenFrames,faults:faults.slice(0,30),faultCount:faults.length};
                }"""
            )
            browser.close()
        assert not errors, errors
        assert not failed_assets, failed_assets
        assert result["samples"] == 2520, result
        assert result["faultCount"] == 0, json.dumps(result, indent=2)
        directory = ROOT / "screenshots" / "revision18"
        directory.mkdir(exist_ok=True)
        paths = [ROOT / ENTRY, ROOT / "js" / "brawler-art.js", ROOT / "js" / "npc-motion.js", ROOT / "js" / "illustrated-kids.js", *(ROOT / "assets" / "art" / name for name in (*ASSETS, *TEEN_POSE_ASSETS))]
        evidence = {"entry": ENTRY, "result": "passed", **result,
                    "pageErrors": errors, "httpFailures": failed_assets,
                    "sourceSHA256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
        (directory / "cast-full-body-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
        print(
            f"Full-body renderer checks passed: {result['samples']} flight/impact samples, "
            "all fifteen actors (twelve adults and three crews), both motion preferences, complete opaque body components, "
            f"portrait-edge framing and damaged cels (opaque coverage {result['minCoverage']:.0%}, neighbor pixels {result['maxNeighborPixels']})."
        )
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
