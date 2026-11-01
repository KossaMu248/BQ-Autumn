"""Measure navigation, first input and cold gameplay before any art-ready wait.

Run one profiling browser at a time. CPU-throttled phone cases also exercise the
cooperative path without Worker/OffscreenCanvas; this is not a physical iPhone
benchmark. --baseline serves the unchanged V18 source from commit67831ae while
sharing its original assets, so this test must reject the reported regression.
"""
import argparse
import base64
import functools
import hashlib
import json
import math
import subprocess
import tempfile
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'screenshots' / 'revision19'
BASELINE_COMMIT = '67831aef42573527b7a8fc19cebc963df42f6625'
PROFILES = {
    'desktop': {'size': (1440, 1000), 'cpu': 1, 'fallback': False},
    'phone-portrait': {'size': (390, 844), 'cpu': 4, 'fallback': False},
    'phone-fallback': {'size': (844, 390), 'cpu': 4, 'fallback': True},
}

INSTRUMENT = r"""(() => {
  const data=window.__startup={phase:'navigation',longTasks:[],raf:[],loops:[],events:[],timers:[],imageCallbacks:[],bikeSprites:[],heroDraws:[],samples:[],walkInput:[]};
  let tick=performance.now(),lastRAF=0,hooked=false;
  new PerformanceObserver(list=>{for(const e of list.getEntries())data.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
  setInterval(()=>{const now=performance.now();data.timers.push({at:now,delay:Math.max(0,now-tick-50),phase:data.phase});tick=now;},50);
  const nativeRAF=requestAnimationFrame.bind(window);
  function trace(t){if(lastRAF)data.raf.push({at:t,interval:t-lastRAF,phase:data.phase});lastRAF=t;nativeRAF(trace);}nativeRAF(trace);
  const proto=HTMLImageElement.prototype;let p=proto,desc;
  while(p&&!desc){desc=Object.getOwnPropertyDescriptor(p,'onload');p=Object.getPrototypeOf(p);}
  const user=Symbol('startup-onload');
  if(desc?.set)Object.defineProperty(proto,'onload',{configurable:true,get(){return this[user];},set(fn){this[user]=fn;return desc.set.call(this,typeof fn!=='function'?fn:function(e){const start=performance.now();try{return fn.call(this,e);}finally{data.imageCallbacks.push({at:start,duration:performance.now()-start,source:this.src.split('/').pop(),width:this.naturalWidth,height:this.naturalHeight});}});}});
  for(const type of ['pointerdown','pointerup','pointercancel','click','keydown','keyup'])addEventListener(type,e=>{
    if(type==='click'&&e.target.closest?.('#introStart')){data.phase='riding';data.clickedAt=performance.now();}
    const direction=e.target.closest?.('[data-direction]')?.getAttribute('data-direction');
    if(data.phase==='walking'&&((direction==='1'&&['pointerdown','pointerup','pointercancel'].includes(type))||(e.key==='ArrowRight'&&['keydown','keyup'].includes(type)))){
      const state=BearlyVisits.audit();data.walkInput.push({type,at:performance.now(),simulation:state.combat.time,x:state.x});
    }
    data.events.push({type,at:performance.now(),target:e.target.id||e.target.className});
  },true);
  function hooks(){
    if(hooked||!window.BearlyHero||!window.BearlyHeroRig)return;
    hooked=true;const originalSprite=BearlyHero.sprite,originalHero=BearlyHeroRig.draw;
    window.BearlyHero={...BearlyHero,sprite:function(im){const start=performance.now(),result=originalSprite.call(this,im);if(data.bikeSprites.length<200)data.bikeSprites.push({at:start,duration:performance.now()-start,width:im?.naturalWidth||0,height:im?.naturalHeight||0,source:im?.src?.split('/').pop()});return result;}};
    BearlyHeroRig.draw=function(...args){const start=performance.now(),result=originalHero.apply(this,args);data.heroDraws.push({at:start,duration:performance.now()-start,phase:data.phase});return result;};
  }
  window.requestAnimationFrame=fn=>nativeRAF(t=>{hooks();if(fn.name!=='loop')return fn(t);const start=performance.now();fn(t);data.loops.push({at:start,duration:performance.now()-start,phase:data.phase});});
  setInterval(()=>{const startup=window.BEARLY_STARTUP?.();data.samples.push({at:performance.now(),phase:data.phase,startup,npc:window.BearlyNpcMotion?.cacheStats?.(),hero:window.BearlyHeroRig?.cacheStats?.()});},250);
})();"""


def hashes(directory=ROOT):
    files=[*directory.glob('js/*.js'),*directory.glob('css/*.css'),*directory.glob('*.html'),directory/'autumn-version.json']
    return {str(p.relative_to(directory)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}


def distribution(values):
    values=sorted(values)
    if not values:return {'count':0,'mean':0,'p95':0,'max':0}
    return {'count':len(values),'mean':sum(values)/len(values),'p95':values[math.ceil((len(values)-1)*.95)],'max':values[-1]}


def loaded_hashes(session):
    tree=session.send('Page.getResourceTree')['frameTree'];frame=tree['frame'];result={}
    for item in [{'url':frame['url'],'type':'Document'},*tree.get('resources',[])]:
        if item['type'] not in ['Script','Stylesheet','Document']:continue
        try:
            content=session.send('Page.getResourceContent',{'frameId':frame['id'],'url':item['url']})
            raw=base64.b64decode(content['content']) if content.get('base64Encoded') else content['content'].encode()
            result[item['url'].split('/',3)[-1].split('?')[0]]=hashlib.sha256(raw).hexdigest()
        except Exception as error:result[item['url'].split('/',3)[-1].split('?')[0]]='unreadable:'+str(error)
    return result


def hold(page,selector,key,milliseconds,touch,session=None):
    if not touch:
        page.keyboard.down(key);page.wait_for_timeout(milliseconds);page.keyboard.up(key);return
    box=page.locator(selector).bounding_box();assert box,selector
    owned=session is None
    if owned:session=page.context.new_cdp_session(page)
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}]})
    page.wait_for_timeout(milliseconds);session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    if owned:session.detach()


def run(browser,base,entry,name,with_walk=True,baseline=False):
    profile=PROFILES[name];w,h=profile['size'];touch=name!='desktop'
    context=browser.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch)
    page=context.new_page();page.add_init_script(INSTRUMENT)
    if profile['fallback']:page.add_init_script("Object.defineProperty(window,'Worker',{value:undefined,configurable:true});Object.defineProperty(window,'OffscreenCanvas',{value:undefined,configurable:true});")
    errors=[];failures=[];network_hashes={}
    def response_received(response):
        if response.status>=400:failures.append([response.status,response.url])
        if response.request.resource_type in ['document','script','stylesheet']:
            try:network_hashes[response.url.split('/',3)[-1].split('?')[0]]=hashlib.sha256(response.body()).hexdigest()
            except Exception as error:network_hashes[response.url.split('/',3)[-1].split('?')[0]]='unreadable:'+str(error)
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',response_received)
    session=context.new_cdp_session(page);session.send('Page.enable');session.send('Emulation.setCPUThrottlingRate',{'rate':profile['cpu']})
    wall=time.monotonic();page.goto(f'{base}/{entry}',wait_until='domcontentloaded',timeout=120000);dom_wall=time.monotonic()-wall
    click=time.monotonic()
    if touch:page.locator('#introStart').tap(timeout=120000)
    else:page.locator('#introStart').click(timeout=120000)
    click_wall=time.monotonic()-click
    # Measurement already started at navigation. Do not wait for ready/cache flags
    # before testing the actual start button, pedalling or UI responsiveness.
    page.wait_for_function("document.getElementById('introOverlay').hidden&&(window.BEARLY_STARTUP?.()||window.BEARLY_TOUCH_STATUS?.())?.state==='playing'",timeout=30000)
    page.evaluate("__startup.phase='riding';__startup.playingAt=performance.now();BEARLY_DEBUG_MENU.settings.godMode=true")
    ride_start=page.evaluate('(window.BEARLY_STARTUP?.()||BEARLY_TOUCH_STATUS()).x');hold(page,'.touch-controls [data-key="ArrowUp"]','ArrowUp',3500,touch,session)
    pedal_end=page.evaluate('(window.BEARLY_STARTUP?.()||BEARLY_TOUCH_STATUS()).x');hold(page,'.touch-controls [data-key="ArrowDown"]','ArrowDown',1800,touch,session);page.wait_for_timeout(2700)
    ride_end=page.evaluate('(window.BEARLY_STARTUP?.()||BEARLY_TOUCH_STATUS()).x');startup=page.evaluate('structuredClone(__startup)')
    startup_resources=page.evaluate("performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').pop(),start:e.startTime,duration:e.duration,bytes:e.encodedBodySize,transferred:e.transferSize}))")
    walking=None
    if with_walk:
        page.evaluate("__startup.phase='transfer';__startup.transferAt=performance.now()");page.locator('.dismount-button').tap() if touch else page.keyboard.press('q')
        transfer_start=time.monotonic();page.wait_for_function("BearlyVisits.audit().mode==='street'&&!BearlyVisits.audit().transition",timeout=30000)
        transfer_seconds=time.monotonic()-transfer_start
        page.evaluate("__startup.phase='walking'");start=page.evaluate('BearlyVisits.audit().x');simulation_start=page.evaluate('BearlyVisits.lifeTime()');walk_wall=time.monotonic();hold(page,'.area-controls [data-direction="1"]','ArrowRight',3000,touch,session);page.wait_for_timeout(200)
        simulation_seconds=page.evaluate('BearlyVisits.lifeTime()')-simulation_start
        walking={'transferWallSeconds':transfer_seconds,'wallSeconds':time.monotonic()-walk_wall,'simulationSeconds':simulation_seconds,'expectedInputDistance':120*max(0,simulation_seconds-.15),'distance':page.evaluate('BearlyVisits.audit().x')-start,'hero':page.evaluate('BearlyHeroRig.audit()'),'cache':page.evaluate('BearlyHeroRig.cacheStats()')}
    all_data=page.evaluate('__startup')
    if walking:
        down=next((e for e in all_data['walkInput'] if e['type'] in ['pointerdown','keydown']),None)
        up=next((e for e in all_data['walkInput'] if e['type'] in ['pointerup','pointercancel','keyup'] and down and e['at']>=down['at']),None)
        walking['inputEvents']=all_data['walkInput']
        if down and up:
            walking['pressedSimulationSeconds']=up['simulation']-down['simulation'];walking['pressedDistance']=up['x']-down['x']
            walking['expectedInputDistance']=120*max(0,walking['pressedSimulationSeconds']-.1)
        else:walking['expectedInputDistance']=float('inf');walking['pressedDistance']=0
    resources=page.evaluate("performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').pop(),start:e.startTime,duration:e.duration,bytes:e.encodedBodySize,transferred:e.transferSize}))")
    loops=startup['loops'];ride=[x for x in loops if x['phase']=='riding'];ride_intervals=[b['at']-a['at'] for a,b in zip(ride,ride[1:])]
    stat={
        'profile':name,'cpuRate':profile['cpu'],'fallback':profile['fallback'],'entry':entry,'domWallSeconds':dom_wall,'clickCallSeconds':click_wall,
        'firstLoopMs':loops[0]['at'] if loops else None,'firstNativeBikeMs':next((x['at'] for x in startup['bikeSprites'] if x['width']>0),None),
        'longTasks':distribution([e['duration'] for e in startup['longTasks']]),'totalBlockingMs':sum(max(0,e['duration']-50) for e in startup['longTasks']),
        'timerLagMs':distribution([x['delay'] for x in startup['timers']]),'rafIntervalMs':distribution([x['interval'] for x in startup['raf']]),
        'ridingLoopMs':distribution([x['duration'] for x in ride]),'ridingFPS':1000/(sum(ride_intervals)/len(ride_intervals)) if ride_intervals else 0,'rideDistance':pedal_end-ride_start,'settledRideDistance':ride_end-ride_start,'input':'touch' if touch else 'keyboard',
        'imageCallbacks':sorted(startup['imageCallbacks'],key=lambda x:-x['duration'])[:30],
        'resources':{'count':len(startup_resources),'bytes':sum(x['bytes'] for x in startup_resources),'transferredBytes':sum(x['transferred'] for x in startup_resources),'largest':sorted(startup_resources,key=lambda x:-x['bytes'])[:20]},
        'resourcesAfterWalking':{'count':len(resources),'bytes':sum(x['bytes'] for x in resources)},
        'resourcesByFirstFrame':{'count':sum(x['start']+x['duration']<=(loops[0]['at'] if loops else 0) for x in startup_resources),'bytes':sum(x['bytes'] for x in startup_resources if x['start']+x['duration']<=(loops[0]['at'] if loops else 0))},
        'adaptiveBacking':page.evaluate('window.BEARLY_STARTUP?.()||null'),'walking':walking,'coldFootLongTasks':distribution([e['duration'] for e in all_data['longTasks'] if e['start']>=all_data.get('transferAt',float('inf'))]),'coldFootTimerLagMs':distribution([x['delay'] for x in all_data['timers'] if x['phase'] in ['transfer','walking']]),'walkingLoopMs':distribution([x['duration'] for x in all_data['loops'] if x['phase']=='walking']),
        'loadedSHA256':{**loaded_hashes(session),**network_hashes},'pageErrors':errors,'httpFailures':failures,'timeline':all_data,
    }
    limits={'firstMs':4000 if not touch else 8000,'clickSeconds':1 if not touch else 2,'longMs':250 if not touch else 500,'minFPS':20 if not touch else 12}
    problems=[]
    if stat['firstLoopMs'] is None or stat['firstLoopMs']>limits['firstMs']:problems.append('first game frame exceeds startup budget')
    if stat['firstNativeBikeMs'] is None or stat['firstNativeBikeMs']>limits['firstMs']:problems.append('native bicycle/bear artwork is not ready within startup budget')
    if click_wall>limits['clickSeconds']:problems.append('start button stalls')
    if stat['longTasks']['max']>limits['longMs']:problems.append('loading or early play monopolizes main thread')
    if stat['timerLagMs']['max']>limits['longMs']*2:problems.append('scheduled UI heartbeat stalls during startup')
    if stat['ridingFPS']<limits['minFPS']:problems.append('first riding seconds collapse below responsiveness floor')
    if stat['rideDistance']<=150:problems.append('actual pedal input did not move the bike')
    if walking and (walking['pressedDistance']<walking['expectedInputDistance']*.9 or not walking['hero'].get('integratedCarrier')):problems.append('first walking input or original carrier did not render correctly')
    if walking and (stat['coldFootLongTasks']['max']>limits['longMs'] or stat['coldFootTimerLagMs']['max']>limits['longMs']*2):problems.append('first dismount/walking preparation freezes the UI')
    if errors or failures:problems.append('page or HTTP error')
    stat.update({'limits':limits,'failures':problems,'result':'passed' if not problems else 'failed'})
    OUT.mkdir(exist_ok=True);page.screenshot(path=str(OUT/f'startup-{"baseline-" if baseline else ""}{name}.png'));context.close();return stat


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--case',action='append',choices=PROFILES);parser.add_argument('--entry');parser.add_argument('--baseline',action='store_true');parser.add_argument('--no-walk',action='store_true');args=parser.parse_args()
    OUT.mkdir(exist_ok=True);reference=hashes();entry=args.entry or json.loads((ROOT/'autumn-version.json').read_text())['entry']
    temporary=None;directory=ROOT
    if args.baseline:
        temporary=tempfile.TemporaryDirectory(prefix='autumn-v18-startup-');directory=Path(temporary.name)
        files=subprocess.check_output(['git','ls-tree','-r','--name-only',BASELINE_COMMIT],cwd=ROOT,text=True).splitlines()
        for name in files:
            if name.endswith(('.js','.css','.html','.json')) and (name.startswith(('js/','css/')) or '/' not in name):
                p=directory/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(subprocess.check_output(['git','show',f'{BASELINE_COMMIT}:{name}'],cwd=ROOT))
        (directory/'assets').symlink_to(ROOT/'assets',target_is_directory=True);entry=args.entry or 'autumn-v18.html'
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(directory)));Thread(target=server.serve_forever,daemon=True).start()
    evidence={'entry':entry,'baseline':args.baseline,'baselineCommit':BASELINE_COMMIT if args.baseline else None,'environment':'Headless Chromium, native time; phones use4xCPU/touch emulation, fallback disables Worker and OffscreenCanvas.','sourceSHA256':hashes(directory),'cases':[]}
    target=OUT/('startup-baseline-evidence.json' if args.baseline else 'startup-performance-evidence.json')
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
            for name in args.case or PROFILES:
                case=run(browser,f'http://127.0.0.1:{server.server_port}',entry,name,not args.no_walk,args.baseline)
                expected=hashes(directory);loaded=case['loadedSHA256'];required=[entry,'js/game.js','css/illustrated.css']
                mismatches=[path for path,value in loaded.items() if path in expected and expected[path]!=value]
                if mismatches or any(path not in loaded for path in required):case['failures'].append('loaded script/style/entry hashes do not match frozen source');case['result']='failed'
                evidence['cases'].append(case);evidence['result']='checking';target.write_text(json.dumps(evidence,indent=2)+'\n')
                print(json.dumps({k:case[k] for k in ['profile','result','firstLoopMs','clickCallSeconds','longTasks','totalBlockingMs','ridingFPS','failures']}),flush=True)
            browser.close()
        if args.baseline:
            assert any(c['failures'] for c in evidence['cases']),'V18 baseline should expose the startup regression'
            evidence['result']='expected-regression'
        else:
            assert reference==hashes(),'Production source changed during measurement'
            assert all(not c['failures'] for c in evidence['cases']),[(c['profile'],c['failures']) for c in evidence['cases']]
            evidence['result']='passed'
        target.write_text(json.dumps(evidence,indent=2)+'\n')
    finally:
        server.shutdown();server.server_close()
        if temporary:temporary.cleanup()


if __name__=='__main__':main()
