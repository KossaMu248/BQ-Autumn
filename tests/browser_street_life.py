"""Actual V17 street routines, civilian panic and keyboard/touch integration.

Game actors are never replaced or assigned test states. Debug warps only choose a
real starting location; all interactions and movement use keyboard/touch inputs.
Renderer-only anatomy/source probes live in browser_wardrobe.py.
"""
import argparse
import functools
import subprocess
import time
import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

sys.dont_write_bytecode = True
from playwright.sync_api import sync_playwright
from browser_wardrobe import AUDIT, ENTRY, SHOTS, ROOT, source_hashes

LIFE_AUDIT = r"""(() => {
  window.__lifeText=[];window.__hideFrames=[];window.__walkAudits=[];
  const text=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(value,...args){
    if(this.canvas.id==='game'&&String(value)==='AAH!')__lifeText.push({value:String(value),color:this.fillStyle});
    return text.call(this,value,...args);
  };
  window.__installLifeAudit=()=>{
    const original=BearlyBrawlArt.adult;
    BearlyBrawlArt.adult=function(c,n,x,y,h,...args){
      if(!n.hiding||c.canvas.id!=='game'){
        const result=original.call(this,c,n,x,y,h,...args),motion=BearlyNpcMotion.audit();
        if(n.activity==='walk'&&motion?.variant===n.variant&&motion?.details)__walkAudits.push({id:n.id,x:n.x,depth:n.depth,lane:n.sidewalkDepth,distance:n.distance,mood:n.mood,...motion});
        if(__walkAudits.length>600)__walkAudits.splice(0,300);
        return result;
      }
      const m=c.getTransform(),points=[[x-h*.65,y-h*1.25],[x+h*.65,y+h*.12]].map(([xx,yy])=>({x:m.a*xx+m.c*yy+m.e,y:m.b*xx+m.d*yy+m.f}));
      const box={x:Math.max(0,Math.floor(Math.min(...points.map(v=>v.x)))),y:Math.max(0,Math.floor(Math.min(...points.map(v=>v.y))))};
      box.w=Math.min(c.canvas.width-box.x,Math.ceil(Math.max(...points.map(v=>v.x)))-box.x);box.h=Math.min(c.canvas.height-box.y,Math.ceil(Math.max(...points.map(v=>v.y)))-box.y);
      if(box.w<=0||box.h<=0)return original.call(this,c,n,x,y,h,...args);
      const before=c.getImageData(box.x,box.y,box.w,box.h).data;
      const result=original.call(this,c,n,x,y,h,...args),after=c.getImageData(box.x,box.y,box.w,box.h).data;
      const mask=[];for(let at=0;at<after.length;at+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(after[at+k]-before[at+k])))>14)mask.push(at);
      __hideFrames=[{id:n.id,prop:n.hideTarget?.id,box,mask,after,canvas:c.canvas}];return result;
    };
  };
  window.__readHideProof=()=>__hideFrames.map(frame=>{
    const {box,mask,after,canvas}=frame,now=canvas.getContext('2d').getImageData(box.x,box.y,box.w,box.h).data;
    let covered=0;for(const at of mask)if(Math.max(...[0,1,2].map(k=>Math.abs(now[at+k]-after[at+k])))>14)covered++;
    return{id:frame.id,prop:frame.prop,drawnBodyPixels:mask.length,coveredBodyPixels:covered,coveredRatio:covered/Math.max(1,mask.length)};
  });
})();"""


def read(page):
    return page.evaluate('BearlyVisits.audit()')


def actor(state, ident):
    return next(n for n in state['combat']['npcs'] if n['id'] == ident)


def hold(page, key, milliseconds, touch=False):
    if not touch:
        page.keyboard.down(key)
        page.clock.run_for(milliseconds)
        page.keyboard.up(key)
    else:
        selector = {'ArrowLeft':'[data-direction="-1"]','ArrowRight':'[data-direction="1"]','ArrowUp':'[data-depth="-1"]','ArrowDown':'[data-depth="1"]'}[key]
        box = page.locator(selector).bounding_box()
        session = page.context.new_cdp_session(page)
        session.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}]})
        page.clock.run_for(milliseconds)
        session.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
        session.detach()
    page.clock.run_for(120)


def start(page, base, errors, failures, touch=False):
    page.add_init_script(AUDIT)
    page.add_init_script(LIFE_AUDIT)
    page.clock.install()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append([response.status,response.url]) if response.status >=400 else None)
    page.goto(f'{base}/{ENTRY}')
    page.wait_for_function('BearlyVisits.audit().artReady && BearlyNpcMotion.ready() && BearlyStreetLife.ready() && (!BearlyNpcMotion.cacheStats || BearlyNpcMotion.cacheStats().complete)', timeout=180000)
    page.clock.pause_at(page.evaluate('Date.now()+1000')/1000)
    page.evaluate('__installWardrobeActorAudit();__installLifeAudit()')
    if touch: page.locator('#introStart').tap()
    else: page.click('#introStart')
    page.evaluate('BEARLY_DEBUG_MENU.settings.godMode=true;BEARLY_DEBUG_MENU.warp(2500/1.5)')
    page.clock.run_for(100)
    riding=page.evaluate('BearlyVisits.residents().map(n=>({id:n.id,variant:n.variant,active:n.active,visible:n.visible,hp:n.hp}))')
    page.evaluate('__wardrobeCalls=[]')
    page.clock.run_for(80)
    riding_draws=page.evaluate('__wardrobeCalls.filter(c=>c.actor).map(c=>({id:c.actor.id,variant:c.actor.variant,source:c.source,pose:c.sourcePose,activity:c.actor.activity}))')
    settings_selector='#debugOpenBtn' if page.locator('#debugOpenBtn').is_visible() else '.ride-settings'
    assert page.locator(settings_selector).is_visible(), 'Riding Settings must be genuinely visible'
    if touch: page.locator(settings_selector).tap()
    else: page.locator(settings_selector).click()
    page.clock.run_for(180)
    assert page.evaluate('BEARLY_DEBUG_MENU.isOpen()')
    assert read(page)['mode'] is None, 'Shortcut must start from actual riding'
    if touch: page.locator('#debugLifeBtn').tap()
    else: page.locator('#debugLifeBtn').click()
    page.clock.run_for(250)
    shortcut_transition=read(page)
    assert shortcut_transition['transition']=='dismount', shortcut_transition
    assert not page.evaluate('BEARLY_DEBUG_MENU.isOpen()')
    page.clock.run_for(2300)
    assert read(page)['mode']=='street'
    foot=read(page)
    assert [(n['id'],n['variant']) for n in foot['combat']['npcs']]==[(n['id'],n['variant']) for n in riding]
    assert all(n['active'] and n['visible'] for n in foot['combat']['npcs'] if n['id'] in ['promenade-walker','civilian-reader','civilian-bench'])
    assert any(c['id']=='civilian-reader' and c['pose']=='read' for c in riding_draws),riding_draws
    visible={n['id'] for n in riding if n['active'] and n['visible']}
    assert all(c['id'] in visible for c in riding_draws),riding_draws
    return {'shortcut':{'settings':settings_selector,'action':'#debugLifeBtn','initialMode':None,'observedTransition':shortcut_transition['transition'],'finalMode':foot['mode'],'finalX':foot['x'],'debugClosed':not page.evaluate('BEARLY_DEBUG_MENU.isOpen()')},'ridingActors':riding,'ridingDraws':riding_draws,'footActors':[{k:n.get(k) for k in ['id','variant','activity','active','visible','depth']} for n in foot['combat']['npcs']]}


def approach(page, ident, touch=False):
    # Stay to the actor's right and face left. Only ordinary movement inputs are
    # used; source actors, HP, time, routes and civilian flags remain untouched.
    for _ in range(18):
        state=read(page);n=actor(state,ident);dx=n['x']+65-state['x'];dy=n['depth']-state['depth']
        if abs(dy)>9: hold(page,'ArrowDown' if dy>0 else 'ArrowUp', max(30,min(260,round(abs(dy)/118*1000))),touch)
        elif abs(dx)>13: hold(page,'ArrowRight' if dx>0 else 'ArrowLeft', max(30,min(260,round(abs(dx)/120*1000))),touch)
        else:
            hold(page,'ArrowLeft',25,touch)
            state=read(page);n=actor(state,ident)
            if abs(n['x']-state['x'])<100 and abs(n['depth']-state['depth'])<23:return
    raise AssertionError({'approach':ident,'state':read(page)})


def peace_only(state):
    for n in state['combat']['npcs']:
        if n.get('civilian'):
            assert not n['hostile'] and n['angryUntil']==0 and not n['punching'],n
            assert n['state'] not in ['windup','release'],n


def shot(page,name):
    page.screenshot(path=str(SHOTS/f'street-life-{name}.png'))


def witness_flow(page, touch=False, label='desktop'):
    approach(page,'promenade-walker',touch)
    before=read(page);initial={i:actor(before,i) for i in ['promenade-walker','civilian-reader','civilian-bench']}
    page.evaluate('__lifeText=[];__wardrobeCalls=[]')
    if touch: page.locator('.area-maul').tap()
    else: page.keyboard.press('j')
    page.clock.run_for(100)
    scared=read(page);peace_only(scared)
    assert actor(scared,'promenade-walker')['hp']==initial['promenade-walker']['hp']-22
    assert all(actor(scared,i)['fear'] and actor(scared,i)['screaming'] for i in ['civilian-reader','civilian-bench']),scared
    assert scared['combat']['stats']['civilianScares']>=2
    assert scared['streetLife']['audioRequests']>before['streetLife']['audioRequests']
    text=page.evaluate('__lifeText');assert text and all(c['color']=='#ffffff' for c in text),text
    shot(page,label+'-scream')
    # Let the real stagger finish while the bear opens a lead, then prove the
    # pursuing adult runs faster and closes the measured world-space distance.
    hold(page,'ArrowRight',350,touch)
    first=read(page);distance1=abs(actor(first,'promenade-walker')['x']-first['x'])
    hold(page,'ArrowRight',650,touch)
    chased=read(page);peace_only(chased);distance2=abs(actor(chased,'promenade-walker')['x']-chased['x'])
    runner=actor(first,'promenade-walker')
    assert distance2<distance1-10,{'first':distance1,'second':distance2,'runner':runner}
    assert runner['running'] and runner['speed']>=269,runner
    assert all(abs(actor(chased,i)['x']-initial['promenade-walker']['x'])>abs(initial[i]['x']-initial['promenade-walker']['x']) for i in ['civilian-reader','civilian-bench'])
    shot(page,label+'-run-and-flee')
    hold(page,'ArrowRight',600,touch)
    page.clock.run_for(1400)
    hiding=read(page);peace_only(hiding)
    hidden=[n for n in hiding['combat']['npcs'] if n.get('civilian') and n['hiding']]
    assert len(hidden)>=2,hidden
    drawn={p['id'] for p in hiding['streetLife']['drawnProps']}
    proof=page.evaluate('__readHideProof()')
    visibleproof=[p for p in proof if p['drawnBodyPixels']>100 and p['prop'] in drawn]
    assert visibleproof and max(p['coveredRatio'] for p in visibleproof)>.25,{'proof':proof,'drawn':list(drawn)}
    shot(page,label+'-bush-hide')
    # Civilian state remains peaceful over repeated updates during real combat.
    samples=[]
    for _ in range(4):page.clock.run_for(300);state=read(page);peace_only(state);samples.append({'time':state['combat']['time'],'civilians':[{k:n.get(k) for k in ['id','activity','hp','angryUntil','punching','hiding']} for n in state['combat']['npcs'] if n.get('civilian') and n['id'].startswith('civilian-')]})
    return {'initial':{i:{k:n.get(k) for k in ['x','depth','hp','activity']} for i,n in initial.items()},'screams':scared['combat']['stats']['screams'],'screamText':text[:6],'audioRequests':scared['streetLife']['audioRequests'],'chaseDistanceBefore':distance1,'chaseDistanceAfter':distance2,'runningSpeed':runner['speed'],'hidden':[{'id':n['id'],'target':n['hideTarget'],'x':n['x'],'depth':n['depth']} for n in hidden],'occlusion':visibleproof,'peaceSamples':samples}


def run_controls(browser,base,errors,failures):
    SHOTS.mkdir(exist_ok=True)
    evidence={}
    def checkpoint():
        (SHOTS/'street-life-controls-evidence.json').write_text(json.dumps({'entry':ENTRY,'result':'checking','controls':evidence,'sourceSHA256':source_hashes()},indent=2)+'\n')
    page=browser.new_page(viewport={'width':1440,'height':1000})
    evidence['crossMode']=start(page,base,errors,failures)
    state=read(page)
    assert state['streetLife']['localSlots']<54 and state['combat']['population']['offstage']>0,state['combat']['population']
    locals_=[n for n in state['combat']['npcs'] if n.get('patrol') and n.get('kind')!='gangster']
    assert len(locals_)==27 and all(n['routeMax']-n['routeMin']>=800 for n in locals_),len(locals_)
    assert [actor(state,i)['activity'] for i in ['civilian-bench','civilian-reader','civilian-smoker']]==['sit','read','smoke']
    props={p['id']:p for p in state['streetLife']['props']}
    for ident in ['civilian-bench','civilian-reader','civilian-smoker']:
        n=actor(state,ident);p=props[n['activityProp']['id']]
        assert abs(n['x']-p['x'])<2 and abs(n['depth']-p['depth'])<2 and p['seatHeight']==38
    evidence['population']=state['combat']['population'];evidence['streetAudit']=state['streetLife'];checkpoint()
    shot(page,'desktop-resting')
    page.evaluate('__walkAudits=[];__wardrobeCalls=[]')
    page.clock.run_for(5600)
    walking=page.evaluate('__walkAudits.filter(v=>v.id==="promenade-walker")')
    assert len(walking)>20 and all(abs(v['depth']-v['lane'])<2 and v['mood']=='calm' for v in walking),walking[:3]
    leads=[v['details']['landmarks']['near']['sole']['x']-v['details']['landmarks']['far']['sole']['x'] for v in walking]
    assert min(leads)<-12 and max(leads)>12,{'passiveLeads':leads[:20],'range':[min(leads),max(leads)]}
    draws=page.evaluate('__wardrobeCalls.filter(c=>c.actor?.id==="promenade-walker"&&c.actor.activity==="walk")')
    assert draws and all(v['source']=='npc-motion-a-v16.png' for v in draws),draws[:2]
    evidence['passiveWalking']={'sampleCount':len(walking),'distance':walking[-1]['distance']-walking[0]['distance'],'opposingFootLeadRange':[min(leads),max(leads)],'laneDepth':walking[-1]['lane'],'relaxedSource':draws[0]['source']}
    checkpoint();shot(page,'desktop-relaxed-walk')
    page.close()
    page=browser.new_page(viewport={'width':1440,'height':1000});start(page,base,errors,failures)
    evidence['desktop']=witness_flow(page);checkpoint()
    persistent=[(n['id'],n['variant'],n['hp']) for n in read(page)['combat']['npcs']]
    page.evaluate('BEARLY_DEBUG_MENU.warp(8000/1.5)');page.clock.run_for(16000)
    calm=read(page);peace_only(calm)
    assert [(n['id'],n['variant'],n['hp']) for n in calm['combat']['npcs']]==persistent
    assert all(not actor(calm,i)['fear'] and not actor(calm,i)['hiding'] and actor(calm,i)['activity'] in ['walk','idle','sit','read','smoke'] for i in ['civilian-reader','civilian-bench'])
    evidence['returnToCalm']={i:{k:actor(calm,i).get(k) for k in ['id','activity','fear','hiding','hp','variant']} for i in ['civilian-reader','civilian-bench']};checkpoint()
    page.close()
    # Fresh real street for a direct attack on an ordinary civilian.
    page=browser.new_page(viewport={'width':1440,'height':1000});start(page,base,errors,failures)
    approach(page,'civilian-reader');before=actor(read(page),'civilian-reader');page.keyboard.press('j');page.clock.run_for(100)
    hit=read(page);peace_only(hit);victim=actor(hit,'civilian-reader')
    assert victim['hp']==before['hp']-22 and victim['fear'] and victim['screaming'] and victim['angryUntil']==0,victim
    page.clock.run_for(1300);after=read(page);peace_only(after)
    assert actor(after,'civilian-reader')['activity'] in ['flee','hide','cower']
    shot(page,'civilian-hit-flees');evidence['directHit']={k:victim.get(k) for k in ['id','hp','fear','screaming','activity','angryUntil','punching']}
    checkpoint();page.close()
    for width,height in [(390,844),(844,390)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True)
        page=context.new_page();start(page,base,errors,failures,True)
        evidence[str(width)]=witness_flow(page,True,str(width));checkpoint()
        assert page.locator('.foot-heart').count()==5
        assert page.locator('.area-message').evaluate('(e)=>getComputedStyle(e).color')=='rgb(255, 255, 255)'
        assert page.locator('.area-panel').evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert page.locator('.canvas-wrap').bounding_box()['height']>=height-2
        context.close()
    assert not errors,errors
    assert not failures,failures
    return evidence


def run_video(browser,base,errors,failures):
    """Cropped wall-clock animation preview; complete UI stays in screenshots."""
    evidence={'sourceSHA256':source_hashes(),'viewport':{'width':1280,'height':720},'capture':{'width':960,'height':540},'fullscreen':True,'segments':[]};clips=[]
    for kind in ['bear-walk','neighbourhood']:
        context=browser.new_context(viewport={'width':1280,'height':720},record_video_dir=str(SHOTS),record_video_size={'width':960,'height':540})
        born=time.monotonic();page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('response',lambda response:failures.append([response.status,response.url]) if response.status>=400 else None)
        page.goto(f'{base}/{ENTRY}');page.wait_for_function('BearlyVisits.audit().artReady && BearlyNpcMotion.ready() && BearlyStreetLife.ready()',timeout=120000)
        page.click('#introStart');page.evaluate('BEARLY_DEBUG_MENU.settings.godMode=true;BEARLY_DEBUG_MENU.warp(2500/1.5)')
        page.wait_for_timeout(150);page.keyboard.press('q');page.wait_for_function('BearlyVisits.audit().mode==="street"',timeout=10000)
        page.locator('.area-fullscreen').click();page.wait_for_function('document.fullscreenElement!==null',timeout=5000);page.wait_for_timeout(150)
        begin=time.monotonic()-born;initial=read(page)
        if kind=='bear-walk':
            page.keyboard.down('ArrowRight');page.wait_for_timeout(4000);page.keyboard.up('ArrowRight');page.wait_for_timeout(250)
            after=read(page);assert after['x']-initial['x']>400,{'realTimeWalkDistance':after['x']-initial['x']}
            page.keyboard.down('ArrowLeft');page.wait_for_timeout(1600);page.keyboard.up('ArrowLeft');page.wait_for_timeout(250)
            details={'walkSeconds':4,'walkDistance':after['x']-initial['x'],'baby':initial['baby'],'hero':after['hero']}
        else:
            page.wait_for_function('BearlyVisits.residents().some(n=>n.id==="promenade-walker"&&n.activity==="walk")',timeout=10000)
            page.wait_for_timeout(1000)
            for _ in range(20):
                state=read(page);n=actor(state,'promenade-walker');dx=n['x']+65-state['x'];dy=n['depth']-state['depth']
                if abs(dy)>9:key='ArrowDown' if dy>0 else 'ArrowUp';duration=min(220,max(35,round(abs(dy)/140*1000)))
                elif abs(dx)>15:key='ArrowRight' if dx>0 else 'ArrowLeft';duration=min(220,max(35,round(abs(dx)/120*1000)))
                else:break
                page.keyboard.down(key);page.wait_for_timeout(duration);page.keyboard.up(key);page.wait_for_timeout(60)
            page.keyboard.down('ArrowLeft');page.wait_for_timeout(25);page.keyboard.up('ArrowLeft');page.wait_for_timeout(80)
            before=read(page);page.keyboard.press('j');page.wait_for_timeout(150);scared=read(page)
            assert scared['combat']['stats']['mauls']>before['combat']['stats']['mauls'],scared
            page.keyboard.down('ArrowRight');page.wait_for_timeout(1400);page.keyboard.up('ArrowRight');page.wait_for_timeout(3500)
            final=read(page);peace_only(final)
            assert final['combat']['stats']['civilianScares']>=1 and final['combat']['stats']['hides']>=1
            details={'mauls':final['combat']['stats']['mauls'],'screams':final['combat']['stats']['screams'],'hides':final['combat']['stats']['hides'],'baby':final['baby'],'npcs':[{k:n.get(k) for k in ['id','activity','moving','running','speed','hp','hiding','civilian']} for n in final['combat']['npcs'] if n['id'] in ['promenade-walker','civilian-reader','civilian-bench','civilian-smoker']]}
        end=time.monotonic()-born;video=page.video;page.close();context.close();raw=Path(video.path())
        trimmed=SHOTS/f'street-life-{kind}-realtime.webm'
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',f'{begin:.3f}','-i',str(raw),'-t',f'{end-begin:.3f}','-an','-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','6','-crf','28','-b:v','0',str(trimmed)],check=True)
        raw.unlink();clips.append(trimmed)
        evidence['segments'].append({'kind':kind,'file':trimmed.name,'wallClockSeconds':round(end-begin,3),**details})
        (SHOTS/'street-life-video-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
    concat=SHOTS/'street-life-video-list.txt';concat.write_text(''.join("file '"+p.name+"'\n" for p in clips))
    output=SHOTS/'street-life-animation-preview.webm'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-vf','crop=720:540:0:0','-an','-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','6','-crf','28','-b:v','0',str(output)],check=True)
    concat.unlink();evidence['file']=output.name;evidence['label']='Cropped animation preview; full UI is shown in the accompanying screenshots.';evidence['export']={'width':720,'height':540,'crop':[0,0,720,540]};evidence['captureArtifact']='Headless fullscreen can crop the outer UI and pad the right side of its screencast. This intentionally cropped preview is not evidence of full-frame UI fitting.';evidence['requestedViewport']=evidence.pop('viewport');evidence['captureRequestedFullscreen']=evidence.pop('fullscreen');evidence['result']='passed';evidence['pageErrors']=errors;evidence['httpFailures']=failures
    (SHOTS/'street-life-video-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
    assert not errors,errors
    assert not failures,failures
    return evidence


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--video-only',action='store_true');args=parser.parse_args()
    SHOTS.mkdir(exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    errors=[];failures=[]
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
            controls=(run_video if args.video_only else run_controls)(browser,f'http://127.0.0.1:{server.server_port}',errors,failures)
            browser.close()
        if args.video_only:
            print(json.dumps({'result':'passed','video':controls['file']}));return
        result={'entry':ENTRY,'result':'passed','controls':controls,'sourceSHA256':source_hashes(),'pageErrors':errors,'httpFailures':failures}
        (SHOTS/'street-life-controls-evidence.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps({'result':'passed','viewports':['1440×1000','390×844','844×390'],'chase':[controls[k]['chaseDistanceBefore']-controls[k]['chaseDistanceAfter'] for k in ['desktop','390','844']]}))
    finally:server.shutdown();server.server_close()


if __name__=='__main__':main()
