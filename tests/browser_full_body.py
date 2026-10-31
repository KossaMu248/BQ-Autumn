"""Check actual screen-impact draw bounds and complete source figures in Chromium.

This exercises the renderer independently of combat AI, so every cast member,
motion preference and portrait crop receives the same flight/impact coverage.
It does not write screenshots or mutate the game state.
"""
import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ENTRY = "autumn-v10-1.html"
ASSETS = ("npc-screen-full-v10-1.png", "gang-screen-full-v10-1.png")


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
                  const sourcePixels=new Map();
                  let draws=[],texts=[];
                  ctx.fillText=function(value,...args){texts.push(String(value));return actualText(value,...args);};
                  // Observe the real destination corners after all renderer transforms.
                  ctx.drawImage=function(im,...args){
                    if(/(?:npc|gang)-screen-full-v10-1\.png(?:\?|$)/.test(im.src||'') && this.globalAlpha>.01){
                      let sx=0,sy=0,sw=im.naturalWidth,sh=im.naturalHeight,dx,dy,dw,dh;
                      if(args.length===8)[sx,sy,sw,sh,dx,dy,dw,dh]=args;
                      else if(args.length===4)[dx,dy,dw,dh]=args;
                      else { [dx,dy]=args;dw=sw;dh=sh; }
                      const matrix=this.getTransform();
                      const points=[[dx,dy],[dx+dw,dy],[dx+dw,dy+dh],[dx,dy+dh]].map(([x,y])=>({x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f}));
                      draws.push({im,sx,sy,sw,sh,points,alpha:this.globalAlpha});
                    }
                    return actualDraw(im,...args);
                  };
                  function opaquePixels(im){
                    if(!sourcePixels.has(im)){
                      const source=document.createElement('canvas');
                      source.width=im.naturalWidth;source.height=im.naturalHeight;
                      const c=source.getContext('2d',{willReadFrequently:true});c.drawImage(im,0,0);
                      sourcePixels.set(im,c.getImageData(0,0,source.width,source.height).data);
                    }
                    return sourcePixels.get(im);
                  }
                  const coverageCache=new Map();
                  function cellCoverage(draw,col){
                    const {im,sx,sy,sw,sh}=draw,cw=im.naturalWidth/3,ch=im.naturalHeight/2;
                    const row=Math.min(1,Math.floor((sy+sh*.5)/ch));
                    const key=[im.src,sx,sy,sw,sh,col,row].join('|');
                    if(coverageCache.has(key))return coverageCache.get(key);
                    const pixels=opaquePixels(im);let total=0,omitted=0;
                    for(let y=Math.ceil(row*ch);y<Math.floor((row+1)*ch);y++){
                      for(let x=Math.ceil(col*cw);x<Math.floor((col+1)*cw);x++){
                        if(pixels[(y*im.naturalWidth+x)*4+3]<160)continue;
                        total++;if(x<sx||x>=sx+sw||y<sy||y>=sy+sh)omitted++;
                      }
                    }
                    const value={row,total,coverage:total?1-omitted/total:0};coverageCache.set(key,value);return value;
                  }
                  const profiles=[
                    {name:'desktop/full landscape',left:0,width:W},
                    {name:'portrait left',left:0,width:296},
                    {name:'portrait middle',left:432,width:296},
                    {name:'portrait right',left:W-296,width:296}
                  ];
                  const actors=[
                    ...[0,1,2].map(variant=>({kind:'resident',variant,item:'rock'})),
                    ...['bottle','rock','firecracker'].map((item,variant)=>({kind:'gangster',variant,item}))
                  ];
                  const faults=[];let samples=0,drawCount=0,damagedSamples=0;
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
                        const source=cellCoverage(draw,actor.variant);
                        if(source.coverage<.99)faults.push({...label,issue:'source crop omits part of the figure',coverage:source.coverage});
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
                  return {samples,drawCount,damagedSamples,faults:faults.slice(0,30),faultCount:faults.length};
                }"""
            )
            browser.close()
        assert not errors, errors
        assert not failed_assets, failed_assets
        assert result["samples"] == 1008, result
        assert result["faultCount"] == 0, json.dumps(result, indent=2)
        print(
            f"Full-body renderer checks passed: {result['samples']} flight/impact samples, "
            "all six actors, both motion preferences, source-figure coverage, "
            "portrait-edge framing and damaged cels."
        )
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
