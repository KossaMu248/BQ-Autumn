"""Verify the complete original baby head through the V11.2 canvas renderer.

This checks real draw calls, uniform transforms and rendered opaque face pixels
against the unchanged source WebPs. Pose boards support visual anchor review;
the assertions do not claim to judge the artwork subjectively.
"""
import functools
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "screenshots" / "revision11-2"
ENTRY = "autumn-v11-2.html"
ORIGINALS = {
    "baby_pose_idle.webp": "a27d4ea977d35d89ac927ca371eb66c5e366b096b1eb057e8552853f14578823",
}

AUDIT = r"""(() => {
  const native=CanvasRenderingContext2D.prototype.drawImage;
  const sourceProofs=new WeakMap(),headSource='baby_pose_idle.webp';
  const chinPoints=[[60,62],[62,63],[60,64],[57,66],[54,67],[51,68],
    [62,66],[60,67],[58,68],[54,69]];
  const neckPoints=[[48,69],[48,70]],chairPoints=[[16,52],[17,58],[22,70],[25,75]];
  // This low-alpha white source pixel is collar/background fringe, outside
  // the warm jaw. It is intentionally removed with the original blue clothing.
  const backgroundFringePoints=[[54,70]];
  const featureRects=[[30,17,29,11],[49,31,21,8],[63,39,7,8],[56,49,11,8]];
  const chinOutline=[[49,60],[62,60],[64,63],[60,67],[54,70],[49,69]];
  const canvas=()=>document.createElement('canvas');
  function dimensions(call){
    const a=call.args;
    return a.length===8?{sx:a[0],sy:a[1],sw:a[2],sh:a[3],dx:a[4],dy:a[5],dw:a[6],dh:a[7]}:
      {sx:0,sy:0,sw:call.width,sh:call.height,dx:a[0],dy:a[1],
        dw:a.length===4?a[2]:call.width,dh:a.length===4?a[3]:call.height};
  }
  function point(call,x,y){
    const d=dimensions(call),u=d.dx+(x-d.sx)*d.dw/d.sw,v=d.dy+(y-d.sy)*d.dh/d.sh;
    const [a,b,c,e,tx,ty]=call.matrix;return {x:a*u+c*v+tx,y:b*u+e*v+ty};
  }
  function bounds(call,target){
    const d=dimensions(call),corners=[[d.sx,d.sy],[d.sx+d.sw,d.sy],[d.sx,d.sy+d.sh],[d.sx+d.sw,d.sy+d.sh]].map(p=>point(call,...p));
    const x=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x)))-2),y=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y)))-2);
    return {x,y,w:Math.max(0,Math.min(target.width,Math.ceil(Math.max(...corners.map(p=>p.x)))+2)-x),
      h:Math.max(0,Math.min(target.height,Math.ceil(Math.max(...corners.map(p=>p.y)))+2)-y)};
  }
  window.__faceDraws=[];window.__looseChair=[];window.__nativeDrawImage=native;
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
    const source=image?.dataset?.sourceAsset || image?.src?.split('/').pop() || '';
    if(['game','face-probe','chin-probe'].includes(this.canvas.id)){
      if(/^(?:baby_pose_idle|face_smile|face_happy)\.webp$/.test(source) && this.globalAlpha>.001){
        const t=this.getTransform();
        const call={target:this.canvas.id,source,args,
          width:image.naturalWidth||image.width,height:image.naturalHeight||image.height,
          matrix:[t.a,t.b,t.c,t.d,t.e,t.f],alpha:this.globalAlpha,
          filter:this.filter,composite:this.globalCompositeOperation,
          smoothing:this.imageSmoothingEnabled,quality:this.imageSmoothingQuality};
        Object.defineProperty(call,'image',{value:image});
        if(this.canvas.id==='chin-probe' && this.globalAlpha>.999){
          const b=bounds(call,this.canvas);
          if(b.w && b.h)Object.defineProperty(call,'before',{value:{...b,pixels:this.getImageData(b.x,b.y,b.w,b.h)}});
        }
        window.__faceDraws.push(call);
      }
      if(this.canvas.id==='game' && /baby_pose_idle\.webp$/.test(source)){
        const area=window.BearlyVisits?.audit?.();
        const verifiedHeadCandidate=image instanceof HTMLCanvasElement && image.width===82 && image.height===82;
        const whole=args.length<8 || (args[2]>65 && args[3]>90);
        if(area?.mode && area.mode!=='water' && !area.transition && this.globalAlpha>.01 && whole && !verifiedHeadCandidate)
          window.__looseChair.push({source,args,mode:area.mode});
      }
    }
    return native.call(this,image,...args);
  };
  window.__prepareFaceReferences=async()=>{
    const image=new Image();image.src='assets/'+headSource;await image.decode();
    if(image.naturalWidth!==82||image.naturalHeight!==146)throw new Error('Original full sprite dimensions changed');
    const original=canvas();original.width=original.height=82;native.call(original.getContext('2d'),image,0,0);
    window.__originalHead=original;
    const chin=canvas();chin.width=chin.height=82;const cg=chin.getContext('2d');
    cg.fillStyle='#fff';cg.beginPath();chinOutline.forEach(([x,y],i)=>i?cg.lineTo(x,y):cg.moveTo(x,y));cg.closePath();cg.fill();
    cg.globalCompositeOperation='destination-in';native.call(cg,original,0,0);window.__chinMask=chin;
    const features=canvas();features.width=features.height=82;const fg=features.getContext('2d');
    fg.fillStyle='#fff';for(const r of featureRects)fg.fillRect(...r);native.call(fg,chin,0,0);
    fg.globalCompositeOperation='destination-in';native.call(fg,original,0,0);window.__featureMask=features;
  };
  window.__lastFaceCall=target=>window.__faceDraws.filter(d=>d.target===target && d.alpha>.999).at(-1);
  window.__verifyHeadSource=call=>{
    if(sourceProofs.has(call.image))return sourceProofs.get(call.image);
    if(call.source!==headSource || call.width!==82 || call.height!==82 || !(call.image instanceof HTMLCanvasElement))
      throw new Error('Expected complete original head extraction: '+JSON.stringify(call));
    const got=call.image.getContext('2d').getImageData(0,0,82,82).data;
    const want=__originalHead.getContext('2d').getImageData(0,0,82,82).data;
    const chin=__chinMask.getContext('2d').getImageData(0,0,82,82).data;
    let compared=0,chinCompared=0,maxRGB=0,maxAlpha=0;
    const points=[...chinPoints,...neckPoints];
    // Interior feature pixels establish identity; the complete chin contour is
    // checked separately, including its natural translucent taper.
    for(const [x,y,w,h]of featureRects)for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)
      if(want[(yy*82+xx)*4+3]>=240)points.push([xx,yy]);
    for(let y=0;y<82;y++)for(let x=0;x<82;x++)if(chin[(y*82+x)*4+3]>=64){points.push([x,y]);chinCompared++;}
    for(const [x,y]of points){
      const i=(y*82+x)*4;if(want[i+3]<32)continue;
      const rgb=Math.max(...[0,1,2].map(k=>Math.abs(want[i+k]-got[i+k]))),alpha=Math.abs(want[i+3]-got[i+3]);
      maxRGB=Math.max(maxRGB,rgb);maxAlpha=Math.max(maxAlpha,alpha);compared++;
      if(alpha>2 || rgb>(want[i+3]>253?2:5))throw new Error('Original face/chin/neck pixel changed or cropped: '+JSON.stringify({x,y,want:[...want.slice(i,i+4)],got:[...got.slice(i,i+4)]}));
    }
    for(const [x,y]of chairPoints)if(got[(y*82+x)*4+3]!==0)
      throw new Error('Bicycle chair pixel leaked into extracted head: '+JSON.stringify({x,y}));
    for(const [x,y]of backgroundFringePoints)if(got[(y*82+x)*4+3]!==0)
      throw new Error('White collar/background fringe leaked into head: '+JSON.stringify({x,y}));
    const proof={compared,chinCompared,maxRGB,maxAlpha,chairSamplesCleared:chairPoints.length,
      backgroundFringeSamplesCleared:backgroundFringePoints.length};sourceProofs.set(call.image,proof);return proof;
  };
  window.__verifyFacePixels=(target,expectedSource)=>{
    const call=__lastFaceCall(target);
    if(!call)throw new Error('No opaque original-face draw on '+target);
    if(call.source!==expectedSource)throw new Error('Unexpected face source: '+JSON.stringify(call));
    const sourceProof=__verifyHeadSource(call),source=call.image;
    if(call.filter!=='none'||call.composite!=='source-over')throw new Error('Face color transform: '+JSON.stringify(call));
    const d=dimensions(call),[ma,mb,mc,md]=call.matrix,sx=Math.hypot(ma,mb)*d.dw/d.sw,sy=Math.hypot(mc,md)*d.dh/d.sh;
    if(Math.abs(sx/sy-1)>1e-7 || Math.abs(ma*mc+mb*md)>1e-7)
      throw new Error('Original face stretched/skewed: '+JSON.stringify(call));
    if(d.sx!==0||d.sy!==0||d.sw!==82||d.sh!==82)throw new Error('Full chin extraction cropped again: '+JSON.stringify(call));
    const actual=document.getElementById(target),expected=canvas(),mask=canvas();
    expected.width=actual.width;expected.height=actual.height;
    mask.width=actual.width;mask.height=actual.height;
    const g=expected.getContext('2d');g.setTransform(...call.matrix);
    g.imageSmoothingEnabled=call.smoothing;g.imageSmoothingQuality=call.quality;
    native.call(g,source,...call.args);
    const mg=mask.getContext('2d');mg.setTransform(...call.matrix);native.call(mg,__featureMask,...call.args);
    const selection=mg.getImageData(0,0,mask.width,mask.height).data;
    const want=g.getImageData(0,0,expected.width,expected.height).data;
    const got=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data;
    let compared=0,mismatches=0,maxError=0;
    for(let i=0;i<want.length;i+=4){
      if(want[i+3]<254 || selection[i+3]<254)continue;
      compared++;let delta=0;
      for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(want[i+k]-got[i+k]));
      // The game canvas adds its own fractional viewport transform. Allow the
      // small premultiplied-alpha/interpolation rounding difference at edges.
      maxError=Math.max(maxError,delta);if(delta>6)mismatches++;
    }
    if(compared<20 || mismatches/compared>.005)
      throw new Error('Original facial features not visible: '+JSON.stringify({target,call,compared,mismatches,maxError}));
    return {source:call.source,sourceSize:[call.width,call.height],uniformScale:sx,
      mirrored:ma*md-mb*mc<0,compared,mismatches,maxError,sourceProof};
  };
  function finalChin(call){
    const b=call.before;if(!b)throw new Error('Missing pre-face pixels for final chin visibility check');
    const expected=canvas(),mask=canvas();expected.width=mask.width=b.w;expected.height=mask.height=b.h;
    const g=expected.getContext('2d');g.putImageData(b.pixels,0,0);
    const matrix=[...call.matrix];matrix[4]-=b.x;matrix[5]-=b.y;g.setTransform(...matrix);
    g.imageSmoothingEnabled=call.smoothing;g.imageSmoothingQuality=call.quality;
    native.call(g,call.image,...call.args);
    const mg=mask.getContext('2d');mg.setTransform(...matrix);native.call(mg,__chinMask,...call.args);
    const selection=mg.getImageData(0,0,b.w,b.h).data,want=g.getImageData(0,0,b.w,b.h).data;
    const got=document.getElementById('chin-probe').getContext('2d').getImageData(b.x,b.y,b.w,b.h).data;
    let compared=0,mismatches=0,maxError=0;
    for(let i=0;i<selection.length;i+=4){
      if(selection[i+3]<100)continue;compared++;
      const delta=Math.max(...[0,1,2,3].map(k=>Math.abs(want[i+k]-got[i+k])));
      maxError=Math.max(maxError,delta);if(delta>6)mismatches++;
    }
    if(compared<25 || mismatches)throw new Error('Complete lower jaw occluded after final layers: '+JSON.stringify({compared,mismatches,maxError}));
    return {compared,mismatches,maxError};
  }
  window.__verifyFinalChin=(render,normalCall,negativeControls=false)=>{
    const target=document.getElementById('chin-probe'),c=target.getContext('2d');
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,target.width,target.height);
    const center=point(normalCall,57,65);c.setTransform(8,0,0,8,160-center.x*8,160-center.y*8);
    render(c);const call=__lastFaceCall('chin-probe');
    const sourceProof=__verifyHeadSource(call),visible=finalChin(call);
    if(negativeControls){
      const preserved=c.getImageData(0,0,320,320);c.save();c.setTransform(1,0,0,1,0,0);
      c.fillStyle='#ff00ff';c.fillRect(100,100,120,120);c.restore();
      let blocked=false;try{finalChin(call);}catch(e){blocked=/occluded/.test(e.message);}
      c.putImageData(preserved,0,0);if(!blocked)throw new Error('Chin test failed its collar-occlusion negative control');
      const cut=canvas();cut.width=cut.height=82;const cg=cut.getContext('2d');native.call(cg,call.image,0,0);cg.clearRect(0,61,82,21);
      const fake={...call};Object.defineProperty(fake,'image',{value:cut});
      let cropped=false;try{__verifyHeadSource(fake);}catch(e){cropped=/changed or cropped/.test(e.message);}
      if(!cropped)throw new Error('Chin test failed its cropped-jaw negative control');
    }
    return {zoom:8,...visible,sourceProof,negativeControls};
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
    page.wait_for_function("BearlyHeroRig.ready() && BearlyVisits.audit().artReady && BearlyAtlas.ready()", timeout=60000)
    page.evaluate("__prepareFaceReferences()")
    page.clock.pause_at(page.evaluate("Date.now()+1000") / 1000)
    return page


def renderer_probes(browser, base, errors, failures):
    context = browser.new_context(viewport={"width": 1280, "height": 780})
    page = load(context, base, errors, failures)
    # Stop live DOM callbacks before replacing the visible game with a renderer
    # review board. Every cell is drawn by BearlyHeroRig.draw itself.
    page.evaluate("""() => {
      document.body.innerHTML='<canvas id="face-board" width="1280" height="780"></canvas><canvas id="face-probe" width="320" height="260" hidden></canvas><canvas id="chin-probe" width="320" height="320" hidden></canvas>';
      document.body.style.cssText='margin:0;padding:0;display:block;background:#d8e0d0';
    }""")
    results = []
    for height, label in [(145, "normal"), (90, "small")]:
        probes = page.evaluate(r"""height => {
          const states=[['front idle',{},0,0],['front near lead',{},0,1],['front far lead',{},.5,1],
            ['front hurt',{hurt:true},0,0],['back idle',{baby:{}},0,0],['back near lead',{baby:{}},0,1],
            ['back far lead',{baby:{}},.5,1],['back hurt',{baby:{},hurt:true},0,0],
            ['grab',{baby:{},held:'adult'},0,0],['maul',{baby:{},attack:true},0,0],
            ['collapse',{baby:{},hp:0,defeatAge:.2},0,0],['defeated',{baby:{},hp:0,defeatAge:.8},0,0]];
          document.getElementById('face-board').height=780;
          window.__chinBoard=document.createElement('canvas');__chinBoard.width=1280;__chinBoard.height=1920;
          const cb=__chinBoard.getContext('2d');cb.fillStyle='#d8e0d0';cb.fillRect(0,0,1280,1920);cb.font='15px Arial';
          const board=document.getElementById('face-board').getContext('2d');
          board.fillStyle='#d8e0d0';board.fillRect(0,0,1280,780);board.font='15px Arial';
          const c=document.getElementById('face-probe').getContext('2d'),results=[];
          for(const [index,[name,state,phase,weight]]of states.entries())for(const face of [1,-1]){
            c.clearRect(0,0,320,260);window.__faceDraws=[];
            const render=ctx=>BearlyHeroRig.draw(ctx,160,225,height,face,{distance:phase*(height*.2/.62),weight,state:{hp:100,...state}});
            render(c);
            const pixels=__verifyFacePixels('face-probe','baby_pose_idle.webp');
            const chin=__verifyFinalChin(render,__lastFaceCall('face-probe'),index===0&&face===1&&height===145);
            const audit=BearlyHeroRig.audit();
            if(!audit.integratedCarrier || !audit.babyFace?.headOnly)throw new Error('Carrier/head audit missing');
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
        page.locator("#face-board").screenshot(path=str(SHOTS / f"original-baby-complete-chin-board-{label}.png"))
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
        probes = page.evaluate(r"""height => {
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
            c.clearRect(0,0,320,260);window.__faceDraws=[];
            const render=ctx=>{
              ctx.save();ctx.translate(160,pose==='boat'?190:225);ctx.scale(heading,1);
              if(!BearlyHeroRig.drawAuthored(ctx,__authoredImages[image],rect,origin,height/stature,pose))
                throw new Error('Authored pose did not render: '+pose);
              ctx.restore();
            };
            render(c);
            const pixels=__verifyFacePixels('face-probe','baby_pose_idle.webp');
            const chin=__verifyFinalChin(render,__lastFaceCall('face-probe'));
            const audit=BearlyHeroRig.audit();
            if(audit.pose!==pose || !audit.integratedCarrier || !audit.babyFace?.headOnly)
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
        page.locator("#face-board").screenshot(path=str(SHOTS / f"original-baby-authored-chin-board-{label}.png"))
    context.close()
    return {"renderer": results, "authoredRenderer": authored}


def game_capture(page, name, expected):
    check = page.evaluate("source=>__verifyFacePixels('game',source)", expected)
    page.locator(".canvas-wrap").screenshot(path=str(SHOTS / f"{name}.png"))
    return {"screenshot": name + ".png", "pixels": check}


def game_controls(browser, base, errors, failures, width, height, mobile=False):
    context = browser.new_context(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile)
    page = load(context, base, errors, failures)
    page.locator("#introStart").click()
    page.evaluate("BEARLY_DEBUG_MENU.settings.godMode=true;BEARLY_DEBUG_MENU.warp(2500/1.5)")
    page.clock.run_for(100)
    page.locator(".dismount-button").click() if mobile else page.keyboard.press("q")
    page.clock.run_for(2700)
    evidence = [game_capture(page, f"original-baby-front-{width}", "baby_pose_idle.webp")]
    for key, heading in [("ArrowRight", "right"), ("ArrowLeft", "left")]:
        page.evaluate("window.__faceDraws=[]")
        page.keyboard.down(key)
        page.clock.run_for(340)
        evidence.append(game_capture(page, f"original-baby-walk-{heading}-{width}", "baby_pose_idle.webp"))
        page.keyboard.up(key)
        page.clock.run_for(250)
    page.evaluate("BearlyVisits.practice();window.__faceDraws=[]")
    page.locator(".area-maul").tap() if mobile else page.keyboard.press("j")
    page.clock.run_for(100)
    assert page.evaluate("BearlyHeroRig.audit().pose") == "maul"
    evidence.append(game_capture(page, f"original-baby-maul-{width}", "baby_pose_idle.webp"))
    page.evaluate("window.__faceDraws=[]")
    page.locator(".area-grab").tap() if mobile else page.keyboard.press("g")
    page.clock.run_for(450)
    assert page.evaluate("BearlyHeroRig.audit().pose") == "grab"
    evidence.append(game_capture(page, f"original-baby-grab-{width}", "baby_pose_idle.webp"))
    page.locator(".area-grab").tap() if mobile else page.keyboard.press("g")
    page.clock.run_for(1900)
    assert page.evaluate("BearlyVisits.audit().baby") == "back-carrier"
    evidence.append(game_capture(page, f"original-baby-back-{width}", "baby_pose_idle.webp"))
    if mobile:
        for selector in [".area-jump", ".area-grab", ".area-maul", ".area-exit"]:
            box = page.locator(selector).bounding_box()
            assert box and box["x"] >= 0 and box["y"] >= 0
            assert box["x"] + box["width"] <= width + 1 and box["y"] + box["height"] <= height + 1
        assert page.locator(".foot-heart").count() == 5
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    assert not page.evaluate("window.__looseChair"), "A separate bicycle-seat baby was rendered on foot"
    context.close()
    return evidence


def main():
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
            evidence = renderer_probes(browser, base, errors, failures)
            for width, height, mobile in [(1440, 1000, False), (390, 844, True), (844, 390, True)]:
                evidence[str(width)] = game_controls(browser, base, errors, failures, width, height, mobile)
            browser.close()
        assert not errors, errors
        assert not failures, failures
        (SHOTS / "original-face-pixel-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
        print(json.dumps({"result": "passed", "rendererCases": len(evidence["renderer"]),
            "authoredCases": len(evidence["authoredRenderer"]),
            "originalSHA256": ORIGINALS, "evidence": str(SHOTS / "original-face-pixel-evidence.json")}, indent=2))
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
