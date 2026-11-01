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
ENTRY = "autumn-v14.html"
ASSETS = ("cast-screen-a-v14.png", "cast-screen-b-v14.png", "cast-screen-c-v14.png", "gang-screen-full-v10-1.png")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    required = [ROOT / ENTRY, *(ROOT / "assets" / "art" / name for name in ASSETS)]
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
            page.wait_for_function("BearlyVisits.audit().artReady && BearlyAtlas.ready()")
            page.clock.pause_at(page.evaluate("Date.now()+1000") / 1000)
            result = page.evaluate(
                r"""() => {
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
                    if(/(?:cast-screen-[abc]-v14|gang-screen-full-v10-1)\.png(?:\?|$)/.test(im.src||'') && this.globalAlpha>.01){
                      let sx=0,sy=0,sw=im.naturalWidth,sh=im.naturalHeight,dx,dy,dw,dh;
                      if(args.length===8)[sx,sy,sw,sh,dx,dy,dw,dh]=args;
                      else if(args.length===4)[dx,dy,dw,dh]=args;
                      else { [dx,dy]=args;dw=sw;dh=sh; }
                      const matrix=this.getTransform();
                      const points=[[dx,dy],[dx+dw,dy],[dx+dw,dy+dh],[dx,dy+dh]].map(([x,y])=>({x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f}));
                      const inverse=matrix.inverse();
                      const clips=activeClips.map(clip=>({...clip,contours:clip.contours.map(contour=>contour.map(p=>{
                        const x=inverse.a*p.x+inverse.c*p.y+inverse.e,y=inverse.b*p.x+inverse.d*p.y+inverse.f;
                        return {x:sx+(x-dx)*sw/dw,y:sy+(y-dy)*sh/dh};
                      }))}));
                      draws.push({im,sx,sy,sw,sh,points,clips,alpha:this.globalAlpha});
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
                      if(tail>10000)major.push({pixels:queue.slice(0,tail),count:tail,centerX:sumX/tail,centerY:sumY/tail});
                    }
                    if(major.length!==6)throw Error('Expected six separate opaque bodies in '+im.src+'; got '+major.map(c=>c.count).join(','));
                    // Find the gap between body bands from their mass centers, never a sheet halfway line.
                    major.sort((a,b)=>a.centerY-b.centerY);let split=1,gap=-1;
                    for(let i=1;i<major.length;i++){const distance=major[i].centerY-major[i-1].centerY;if(distance>gap){gap=distance;split=i;}}
                    if(split!==3)throw Error('Expected three distinct bodies in each visual band of '+im.src);
                    const frames=[major.slice(0,split),major.slice(split)].flatMap((row,rowIndex)=>row.sort((a,b)=>a.centerX-b.centerX).map((body,col)=>({...body,row:rowIndex,col})));
                    const analysis={frames,width:w,height:h,kind:/gang-screen-full-v10-1/.test(im.src)?'gangster':'resident'};
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
                  function componentCoverage(draw,col){
                    const {im,sx,sy,sw,sh,clips}=draw,analysis=bodyComponents(im);
                    const clipKey=clips.map(clip=>[clip.rule,clip.unsupported,clip.contours.map(contour=>contour.map(p=>[p.x.toFixed(3),p.y.toFixed(3)]))]);
                    const key=JSON.stringify([im.src,sx,sy,sw,sh,col,clipKey]);
                    if(coverageCache.has(key))return coverageCache.get(key);
                    const counts=analysis.frames.map(body=>{
                      let included=0;
                      for(const index of body.pixels){
                        const x=index%analysis.width+.5,y=Math.floor(index/analysis.width)+.5;
                        if(x>=sx&&x<sx+sw&&y>=sy&&y<sy+sh&&clips.every(clip=>insideClip(x,y,clip)))included++;
                      }
                      return included;
                    });
                    const dominant=counts.indexOf(Math.max(...counts)),row=analysis.frames[dominant].row;
                    const expectedIndex=analysis.frames.findIndex(body=>body.row===row&&body.col===col),expected=analysis.frames[expectedIndex];
                    const value={row,kind:analysis.kind,total:expected.count,coverage:counts[expectedIndex]/expected.count,otherBodyPixels:counts.reduce((sum,count,i)=>sum+(i===expectedIndex?0:count),0),unsupportedClip:clips.some(clip=>clip.unsupported)};
                    coverageCache.set(key,value);return value;
                  }
                  const profiles=[
                    {name:'desktop/full landscape',left:0,width:W},
                    {name:'portrait left',left:0,width:296},
                    {name:'portrait middle',left:432,width:296},
                    {name:'portrait right',left:W-296,width:296}
                  ];
                  const actors=[
                    ...Array.from({length:9},(_,variant)=>({kind:'resident',variant,item:'rock'})),
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
                        const source=componentCoverage(draw,actor.variant%3);
                        const expectedFile=actor.kind==='gangster'?'gang-screen-full-v10-1.png':'cast-screen-'+['a','b','c'][Math.floor(actor.variant/3)]+'-v14.png';
                        if(!draw.im.src.split('?')[0].endsWith('/'+expectedFile))faults.push({...label,issue:'wrong wardrobe pack',source:draw.im.src,expectedFile});
                        minCoverage=Math.min(minCoverage,source.coverage);maxNeighborPixels=Math.max(maxNeighborPixels,source.otherBodyPixels);
                        if(source.coverage<1)faults.push({...label,issue:'source crop or observed clip omits opaque body pixels',coverage:source.coverage});
                        if(source.otherBodyPixels>0)faults.push({...label,issue:'neighbor body fragment rendered',otherBodyPixels:source.otherBodyPixels});
                        if(source.kind!==actor.kind||source.unsupportedClip)faults.push({...label,issue:'wrong cast or unobserved clip',sourceKind:source.kind,unsupportedClip:source.unsupportedClip});
                        if(source.row===1&&draw.alpha>.2)hasDamaged=true;
                      }
                      if(age>=.85){
                        damagedSamples++;
                        if(!hasDamaged)faults.push({...label,issue:'damaged full-body row not displayed'});
                        if(!texts.some(text=>/^[−-]\d+$/.test(text)&&Number(text.slice(1))===npc.lastDamage))faults.push({...label,issue:'visible damage amount differs from actual throw damage',texts,damage:npc.lastDamage});
                      }
                      samples++;
                    }
                  }
                  return {samples,drawCount,damagedSamples,minCoverage,maxNeighborPixels,faults:faults.slice(0,30),faultCount:faults.length};
                }"""
            )
            browser.close()
        assert not errors, errors
        assert not failed_assets, failed_assets
        assert result["samples"] == 2016, result
        assert result["faultCount"] == 0, json.dumps(result, indent=2)
        directory = ROOT / "screenshots" / "revision14"
        directory.mkdir(exist_ok=True)
        paths = [ROOT / "js" / "brawler-art.js", *(ROOT / "assets" / "art" / name for name in ASSETS)]
        evidence = {"entry": ENTRY, "result": "passed", **result,
                    "pageErrors": errors, "httpFailures": failed_assets,
                    "sourceSHA256": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
        (directory / "cast-full-body-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
        print(
            f"Full-body renderer checks passed: {result['samples']} flight/impact samples, "
            "all twelve actors (nine adults and three crews), both motion preferences, complete opaque body components, "
            f"portrait-edge framing and damaged cels (opaque coverage {result['minCoverage']:.0%}, neighbor pixels {result['maxNeighborPixels']})."
        )
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
