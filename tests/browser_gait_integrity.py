"""V17 opaque-body regression and intermediate-weight visual evidence.

A source-alpha template uses the same pose and draw transforms at full draw
alpha, then its core is eroded in final display pixels. Starts/stops must retain
that source opacity. This catches the V16 alpha crossfade that connectivity alone missed.
Renderer probes do not alter real game actors. Phase boards require visual review
for anatomy, artwork, carrier placement and boot shape.
"""
import argparse
import base64
import functools
import hashlib
import json
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
ENTRY='autumn-v17.html'
SHOTS=ROOT/'screenshots'/'revision17'

PROBE=r"""async ({legacyCode}) => {
  const W=360,H=360,X=180,Y=320,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const c=canvas.getContext('2d',{willReadFrequently:true}),weights=[0,.05,.1,.2,.3,.4,.6,.8,1],phases=[0,.25,.5,.75],results=[],faults=[];
  const finalRig=BearlyHeroRig,nativeDraw=c.drawImage.bind(c),edgeDiagnostics=[];let forceSourceAlpha=false;
  c.drawImage=(...args)=>{const alpha=c.globalAlpha;if(forceSourceAlpha)c.globalAlpha=1;const result=nativeDraw(...args);c.globalAlpha=alpha;return result;};
  function paint(rig,height,face,back,phase,weight,sourceTemplate=false){
    forceSourceAlpha=sourceTemplate;
    c.resetTransform();c.globalAlpha=1;c.clearRect(0,0,W,H);
    rig.draw(c,X,Y,height,face,{state:{hp:100,...(back?{baby:{position:'back'}}:{})},talking:true,distance:BearlyLocomotion.cycleLength(height)*phase,weight});
    return c.getImageData(0,0,W,H).data;
  }
  function mask(a,b,height,radius=Math.max(1,Math.round(height/90))){
    const points=[];
    for(let y=Math.ceil(Y-height*.95);y<Y-height*.32;y++)for(let x=Math.floor(X-height*.65);x<X+height*.65;x++){
      let opaque=true;for(let dy=-radius;dy<=radius&&opaque;dy++)for(let dx=-radius;dx<=radius;dx++){
        const at=((y+dy)*W+x+dx)*4+3;if(a[at]<250||b[at]<250){opaque=false;break;}}
      if(opaque)points.push((y*W+x)*4+3);
    }
    if(points.length<Math.max(100,height*height*.02))throw Error('Insufficient independently opaque torso interior '+JSON.stringify({height,count:points.length}));
    return points;
  }
  function measure(pixels,points){let opaque=0,minAlpha=255,sum=0;for(const at of points){const alpha=pixels[at];opaque+=alpha>=246;minAlpha=Math.min(minAlpha,alpha);sum+=alpha;}return{pixels:points.length,opaqueRatio:opaque/points.length,minAlpha,meanAlpha:sum/points.length};}
  let controls=0;
  for(const height of [90,145,225])for(const face of [-1,1])for(const back of [false,true])for(const phase of phases){
    const a=paint(finalRig,height,face,back,phase,0),b=paint(finalRig,height,face,back,phase,1),oldPoints=mask(a,b,height);
    for(const weight of weights){const pixels=paint(finalRig,height,face,back,phase,weight),reference=paint(finalRig,height,face,back,phase,weight,true),points=mask(reference,reference,height,2),proof=measure(pixels,points),row={height,face,carrier:back?'back':'front',phase,weight,...proof};results.push(row);if(proof.opaqueRatio<.995)faults.push(row);
      if(height===90&&face===1&&phase===0&&weight===.2){const low=oldPoints.filter(at=>pixels[at]<246);edgeDiagnostics.push({height,face,carrier:back?'back':'front',phase,weight,endpointMask:measure(pixels,oldPoints),posedCore:proof,lowEndpointPixels:low.length,matchingReferenceAA:low.filter(at=>Math.abs(pixels[at]-reference[at])<=1&&reference[at]<250).length,pixels:low.slice(0,30).map(at=>({x:((at-3)/4)%W,y:Math.floor((at-3)/4/W),actualAlpha:pixels[at],sourceTemplateAlpha:reference[at]}))});}
    }
    if(height===145&&face===1&&phase===0){
      const reference=paint(finalRig,height,face,back,phase,.2,true),points=mask(reference,reference,height,2),normal=paint(finalRig,height,face,back,phase,.2),faded=new Uint8ClampedArray(normal);
      for(let at=3;at<faded.length;at+=4)faded[at]=Math.round(faded[at]*.75);
      if(measure(faded,points).opaqueRatio>=.995)throw Error('Alpha-crossfade negative control was not caught');controls++;
      const damaged=new Uint8ClampedArray(normal),column=new Map();for(const at of points){const x=((at-3)/4)%W;column.set(x,(column.get(x)||0)+1);}const cut=[...column].sort((a,b)=>b[1]-a[1])[0][0];
      for(let y=0;y<H;y++)for(let x=cut-1;x<=cut+1;x++)damaged[(y*W+x)*4+3]=0;
      if(measure(damaged,points).opaqueRatio>=.995)throw Error('Missing-seam negative control was not caught');controls++;
    }
  }
  let legacy=null;
  if(legacyCode){
    (0,eval)(legacyCode);const old=BearlyHeroRig;
    await new Promise((resolve,reject)=>{const started=Date.now();function poll(){if(old.ready())return resolve();if(Date.now()-started>30000)return reject(Error('Legacy references did not load'));setTimeout(poll,25);}poll();});
    const reference=paint(old,145,1,false,0,.2,true),points=mask(reference,reference,145,2),proof=measure(paint(old,145,1,false,0,.2),points);
    legacy={reference:'3863cc1',weight:.2,...proof,caught:proof.opaqueRatio<.995};window.BearlyHeroRig=finalRig;
    if(!legacy.caught)throw Error('Known V16 body-alpha regression was not caught '+JSON.stringify(legacy));
  }
  let boundedBodyCache=null;
  if(finalRig.cacheStats){
    const initial=finalRig.cacheStats();
    for(const height of [145,90,225])for(const back of [false,true])for(let phase=0;phase<48;phase++)paint(finalRig,height,1,back,phase/48,1);
    const after=finalRig.cacheStats();
    if(after.frames>after.frameLimit||after.bytes>after.limitBytes||after.limitBytes!==32*1024*1024)throw Error('Hero cache exceeds its explicit bounds '+JSON.stringify(after));
    if(after.scratchBytes>2*1024*1024)throw Error('Transient body scratch buffers exceeded2MiB '+JSON.stringify(after));
    const beforeReuse=finalRig.cacheStats();
    for(const height of [90,225])for(const back of [false,true])for(let phase=0;phase<48;phase++)paint(finalRig,height,-1,back,phase/48,1);
    const reused=finalRig.cacheStats();
    if(reused.frames!==beforeReuse.frames||reused.bytes!==beforeReuse.bytes)throw Error('Height/heading variations changed canonical body-cache storage '+JSON.stringify({beforeReuse,reused}));
    boundedBodyCache={initial,after,reused,canonicalStorageReused:true};
  }
  const boards=[];
  for(const back of [false,true]){
    const board=document.createElement('canvas');board.width=1320;board.height=880;const g=board.getContext('2d');
    const boardWeights=[0,.1,.2,.3,.4,1];
    for(let row=0;row<4;row++)for(let col=0;col<6;col++){
      const x=col*220,y=row*220;g.fillStyle='#ece7dc';g.fillRect(x,y,220,220);g.fillStyle='#d5d0c4';for(let yy=0;yy<220;yy+=10)for(let xx=0;xx<220;xx+=10)if((xx/10+yy/10)%2)g.fillRect(x+xx,y+yy,10,10);
      g.fillStyle='#242820';g.font='12px Arial';g.fillText(`phase ${phases[row]} · weight ${boardWeights[col]}`,x+9,y+17);
      finalRig.draw(g,x+110,y+202,145,1,{state:{hp:100,...(back?{baby:{position:'back'}}:{})},distance:BearlyLocomotion.cycleLength(145)*phases[row],weight:boardWeights[col]});
    }
    boards.push({carrier:back?'back':'front',png:board.toDataURL('image/png')});
  }
  return{cases:results.length,minOpaqueRatio:Math.min(...results.map(r=>r.opaqueRatio)),minMeanAlpha:Math.min(...results.map(r=>r.meanAlpha)),negativeControls:controls,faultCount:faults.length,faults:faults.slice(0,40),legacy,edgeDiagnostics,coreRule:'Same pose/source transforms at full draw alpha;2pixel erosion in final display space;unchanged99.5%ofcore≥246alpha',boundedBodyCache,boards};
}"""


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass


def source_hashes():
    paths=[ROOT/ENTRY,*[ROOT/'js'/name for name in ['hero-rig.js','locomotion.js','baby-passenger.js','npc-motion.js']]]
    return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}



def actual_front_frames(page):
    page.set_viewport_size({'width':1440,'height':1000})
    page.wait_for_function('!BearlyHeroRig.cacheStats||BearlyHeroRig.cacheStats().pendingBitmaps===0',timeout=30000)
    page.clock.pause_at(page.evaluate('Date.now()+1000')/1000)
    page.locator('#introStart').click();page.evaluate('BEARLY_DEBUG_MENU.settings.godMode=true;BEARLY_DEBUG_MENU.warp(2500/1.5)');page.clock.run_for(100)
    page.locator('#debugOpenBtn').click();page.clock.run_for(100);page.locator('#debugLifeBtn').click();page.clock.run_for(2500)
    assert page.evaluate('BearlyVisits.audit().mode')=='street'
    captures=[]
    def capture(name):
        audit=page.evaluate('BearlyHeroRig.audit()')
        inferred=page.evaluate("""() => {const a=BearlyHeroRig.audit(),full=BearlyLocomotion.pose(a.gait.phase*a.gait.cycleLength,a.height,1);let product=0,square=0;for(const side of ['near','far'])for(const axis of ['x','y']){product+=a.gait[side][axis]*full[side][axis];square+=full[side][axis]**2;}return square?product/square:0;}""")
        assert audit['carrier']=='front' and audit['babyFace']['continuousUpperBody']
        assert audit['body']['opaque'] and audit['body']['continuous']
        page.locator('.canvas-wrap').screenshot(path=str(SHOTS/name))
        captures.append({'file':name,'inferredWalkWeight':inferred,'gait':audit['gait'],'body':audit['body'],'babyMood':audit['babyFace']['mood']})
    page.keyboard.down('ArrowRight')
    for elapsed,delta in [(40,40),(80,40),(160,80)]:page.clock.run_for(delta);capture(f'bear-start-{elapsed:03d}.png')
    page.keyboard.up('ArrowRight')
    for elapsed,delta in [(140,140),(320,180)]:page.clock.run_for(delta);capture(f'bear-stop-{elapsed:03d}.png')
    assert any(.05<c['inferredWalkWeight']<.4 for c in captures),captures
    assert any(c['inferredWalkWeight']>.6 for c in captures),captures
    assert page.locator('.foot-heart').count()==5
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    return captures


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--legacy-regression',action='store_true');args=parser.parse_args()
    SHOTS.mkdir(exist_ok=True);errors=[];failures=[];legacy=None
    if args.legacy_regression:legacy=subprocess.check_output(['git','show','3863cc1:js/hero-rig.js'],cwd=ROOT,text=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
    before=source_hashes()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox']);page=browser.new_page();page.clock.install();page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failures.append([r.status,r.url]) if r.status>=400 else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/{ENTRY}')
            page.wait_for_function('BearlyVisits.audit().artReady&&BearlyHeroRig.ready()&&(!BearlyNpcMotion.cacheStats||BearlyNpcMotion.cacheStats().complete)',timeout=180000)
            result=page.evaluate(PROBE,{'legacyCode':legacy})
            for board in result.pop('boards'):
                name=f"bear-weight-integrity-{board['carrier']}.png";(SHOTS/name).write_bytes(base64.b64decode(board['png'].split(',',1)[1]))
            if not result['faultCount']:result['actualControls']=actual_front_frames(page)
            browser.close()
        result.update({'entry':ENTRY,'result':'passed' if not result['faultCount'] else 'failed','sourceSHA256':before,'pageErrors':errors,'httpFailures':failures})
        (SHOTS/'bear-weight-integrity-evidence.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result));assert not result['faultCount'],result;assert not errors,errors;assert not failures,failures;assert before==source_hashes(),'Source changed while probing'
    finally:server.shutdown();server.server_close()


if __name__=='__main__':main()
