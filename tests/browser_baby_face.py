"""Verify original baby-face pixels through the V11.1 canvas renderer.

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
SHOTS = ROOT / "screenshots" / "revision11-1"
ENTRY = "autumn-v11-1.html"
ORIGINALS = {
    "face_smile.webp": "e327ead47355c327b0ae857dccbd23dab6f7238ba8f5441bea51a0f77a8181b0",
    "face_happy.webp": "bfff2f1ca4ce07d3eccb459270bda6560f072d11b03b2faf6c077e8abb984630",
}

AUDIT = r"""(() => {
  const native=CanvasRenderingContext2D.prototype.drawImage;
  window.__faceDraws=[];window.__looseChair=[];window.__nativeDrawImage=native;
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
    const source=image?.dataset?.sourceAsset || image?.src?.split('/').pop() || '';
    if(['game','face-probe'].includes(this.canvas.id)){
      if(/^face_(smile|happy)\.webp$/.test(source) && this.globalAlpha>.001){
        const t=this.getTransform();
        window.__faceDraws.push({target:this.canvas.id,source,args,
          width:image.naturalWidth||image.width,height:image.naturalHeight||image.height,
          matrix:[t.a,t.b,t.c,t.d,t.e,t.f],alpha:this.globalAlpha,
          filter:this.filter,composite:this.globalCompositeOperation,
          smoothing:this.imageSmoothingEnabled,quality:this.imageSmoothingQuality});
      }
      if(this.canvas.id==='game' && /baby_pose_idle\.webp$/.test(source)){
        const area=window.BearlyVisits?.audit?.();
        const whole=args.length<8 || (args[2]>=image.naturalWidth*.8 && args[3]>=image.naturalHeight*.8);
        if(area?.mode && area.mode!=='water' && !area.transition && this.globalAlpha>.01 && whole)
          window.__looseChair.push({source,args,mode:area.mode});
      }
    }
    return native.call(this,image,...args);
  };
  window.__prepareFaceReferences=async()=>{
    window.__faceReferences={};
    for(const source of ['face_smile.webp','face_happy.webp']){
      const image=new Image();image.src='assets/'+source;await image.decode();
      const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
      const g=c.getContext('2d');native.call(g,image,0,0);
      // Ignore the authorized 13px jaw-alpha fade. Eyes, nose and smile remain.
      g.clearRect(0,c.height-13,c.width,13);
      window.__faceReferences[source]=c;
    }
  };
  window.__verifyFacePixels=(target,expectedSource)=>{
    const calls=window.__faceDraws.filter(d=>d.target===target && d.alpha>.999);
    if(!calls.length)throw new Error('No opaque original-face draw on '+target);
    const call=calls.at(-1),source=window.__faceReferences[call.source];
    if(!source || call.source!==expectedSource)throw new Error('Unexpected face source: '+JSON.stringify(call));
    if(call.filter!=='none'||call.composite!=='source-over')throw new Error('Face color transform: '+JSON.stringify(call));
    const a=call.args,sw=a.length===8?a[2]:call.width,sh=a.length===8?a[3]:call.height;
    const dw=a.length===8?a[6]:a.length===4?a[2]:call.width,dh=a.length===8?a[7]:a.length===4?a[3]:call.height;
    const [ma,mb,mc,md]=call.matrix,sx=Math.hypot(ma,mb)*dw/sw,sy=Math.hypot(mc,md)*dh/sh;
    if(Math.abs(sx/sy-1)>1e-7 || Math.abs(ma*mc+mb*md)>1e-7)
      throw new Error('Original face stretched/skewed: '+JSON.stringify(call));
    if(call.width!==source.width||call.height!==source.height)
      throw new Error('Original source dimensions changed: '+JSON.stringify(call));
    const actual=document.getElementById(target),expected=document.createElement('canvas');
    expected.width=actual.width;expected.height=actual.height;
    const g=expected.getContext('2d');g.setTransform(...call.matrix);
    g.imageSmoothingEnabled=call.smoothing;g.imageSmoothingQuality=call.quality;
    native.call(g,source,...call.args);
    const want=g.getImageData(0,0,expected.width,expected.height).data;
    const got=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data;
    let compared=0,mismatches=0,maxError=0;
    for(let i=0;i<want.length;i+=4){
      if(want[i+3]<254)continue;
      compared++;let delta=0;
      for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(want[i+k]-got[i+k]));
      // The game canvas adds its own fractional viewport transform. Allow the
      // small premultiplied-alpha/interpolation rounding difference at edges.
      maxError=Math.max(maxError,delta);if(delta>6)mismatches++;
    }
    if(compared<45 || mismatches/compared>.005)
      throw new Error('Original facial features not visible: '+JSON.stringify({target,call,compared,mismatches,maxError}));
    return {source:call.source,sourceSize:[call.width,call.height],uniformScale:sx,
      mirrored:ma*md-mb*mc<0,compared,mismatches,maxError};
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
      document.body.innerHTML='<canvas id="face-board" width="1280" height="780"></canvas><canvas id="face-probe" width="320" height="260" hidden></canvas>';
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
          const board=document.getElementById('face-board').getContext('2d');
          board.fillStyle='#d8e0d0';board.fillRect(0,0,1280,780);board.font='15px Arial';
          const c=document.getElementById('face-probe').getContext('2d'),results=[];
          for(const [index,[name,state,phase,weight]]of states.entries())for(const face of [1,-1]){
            c.clearRect(0,0,320,260);window.__faceDraws=[];
            BearlyHeroRig.draw(c,160,225,height,face,{distance:phase*(height*.2/.62),weight,state:{hp:100,...state}});
            const expected=['maul','grab'].includes(name)?'face_happy.webp':'face_smile.webp';
            const pixels=__verifyFacePixels('face-probe',expected);
            const audit=BearlyHeroRig.audit();
            if(!audit.integratedCarrier || !audit.babyFace?.headOnly)throw new Error('Carrier/head audit missing');
            if(pixels.mirrored!==(face<0))throw new Error('Face heading did not mirror with body');
            results.push({name,height,heading:face,pixels});
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
          const board=document.getElementById('face-board').getContext('2d');
          board.fillStyle='#d8e0d0';board.fillRect(0,0,1280,780);board.font='15px Arial';
          const c=document.getElementById('face-probe').getContext('2d'),results=[];
          for(const [index,[pose,image,rect,origin,stature,headFlip]]of frames.entries())for(const heading of [1,-1]){
            c.clearRect(0,0,320,260);window.__faceDraws=[];
            c.save();c.translate(160,pose==='boat'?190:225);c.scale(heading,1);
            if(!BearlyHeroRig.drawAuthored(c,__authoredImages[image],rect,origin,height/stature,pose))
              throw new Error('Authored pose did not render: '+pose);
            c.restore();
            const pixels=__verifyFacePixels('face-probe','face_smile.webp');
            const audit=BearlyHeroRig.audit();
            if(audit.pose!==pose || !audit.integratedCarrier || !audit.babyFace?.headOnly)
              throw new Error('Authored carrier/head audit missing: '+pose);
            if(pixels.mirrored!==((heading<0)!==headFlip))
              throw new Error('Authored head orientation changed: '+pose);
            results.push({name:pose,height,heading,rect,origin,scale:height/stature,pixels});
            const cell=index*2+(heading<0?1:0),x=cell%4*320,y=Math.floor(cell/4)*260;
            board.fillStyle='#222';board.fillText(pose+' · '+(heading>0?'right':'left')+' · h'+height,x+12,y+22);
            __nativeDrawImage.call(board,c.canvas,x,y);
          }
          return results;
        }""", height)
        authored.extend(probes)
        page.locator("#face-board").screenshot(path=str(SHOTS / f"original-baby-authored-board-{label}.png"))
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
    evidence = [game_capture(page, f"original-baby-front-{width}", "face_smile.webp")]
    for key, heading in [("ArrowRight", "right"), ("ArrowLeft", "left")]:
        page.evaluate("window.__faceDraws=[]")
        page.keyboard.down(key)
        page.clock.run_for(340)
        evidence.append(game_capture(page, f"original-baby-walk-{heading}-{width}", "face_smile.webp"))
        page.keyboard.up(key)
        page.clock.run_for(250)
    page.evaluate("BearlyVisits.practice();window.__faceDraws=[]")
    page.locator(".area-maul").tap() if mobile else page.keyboard.press("j")
    page.clock.run_for(100)
    assert page.evaluate("BearlyHeroRig.audit().pose") == "maul"
    evidence.append(game_capture(page, f"original-baby-maul-{width}", "face_happy.webp"))
    page.evaluate("window.__faceDraws=[]")
    page.locator(".area-grab").tap() if mobile else page.keyboard.press("g")
    page.clock.run_for(450)
    assert page.evaluate("BearlyHeroRig.audit().pose") == "grab"
    evidence.append(game_capture(page, f"original-baby-grab-{width}", "face_happy.webp"))
    page.locator(".area-grab").tap() if mobile else page.keyboard.press("g")
    page.clock.run_for(1900)
    assert page.evaluate("BearlyVisits.audit().baby") == "back-carrier"
    evidence.append(game_capture(page, f"original-baby-back-{width}", "face_smile.webp"))
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
