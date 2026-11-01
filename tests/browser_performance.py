"""Sustained V17 browser performance after street routines have started.

This uses real game actors, actual keyboard/touch controls, native browser time,
and no recording. Debug warps choose locations; NPC state is never replaced.
Only one performance browser should run at a time. Results describe this headless
Chromium environment, not measurements on a physical phone.
"""
import argparse
import functools
import hashlib
import json
import math
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ENTRY = 'autumn-v17.html'
FOOT_SPEED = 120
SHOTS = ROOT / 'screenshots' / 'revision17'

INSTRUMENT = r"""(() => {
  const raf=requestAnimationFrame.bind(window),draw=CanvasRenderingContext2D.prototype.drawImage;
  let enabled=false,last=0,frame=null,data=null;
  const now=()=>performance.now();
  function summaryActor(n){return{id:n.id,variant:n.variant,activity:n.activity,state:n.state,moving:!!n.moving,running:!!n.running,x:n.x,depth:n.depth,visible:n.visible,active:n.active,civilian:!!n.civilian};}
  CanvasRenderingContext2D.prototype.drawImage=function(...args){if(enabled&&frame&&this.canvas.id==='game')frame.images++;return draw.apply(this,args);};
  window.requestAnimationFrame=callback=>raf(timestamp=>{
    if(!enabled||callback.name!=='loop')return callback(timestamp);
    frame={images:0,adults:0,walkers:[],npcs:[],npcMs:0,heroMs:0,visitsMs:0,heroCalls:0};
    if(last)data.intervals.push(timestamp-last);last=timestamp;
    const start=now();callback(timestamp);const elapsed=now()-start;
    data.callbacks.push(elapsed);data.frameSeries.push({timestamp,callbackMs:elapsed,heroMs:frame.heroMs,npcMs:frame.npcMs,updateMs:frame.visitsMs,images:frame.images,walkers:frame.walkers.length});data.images+=frame.images;data.npcMs+=frame.npcMs;data.heroMs+=frame.heroMs;data.visitsMs+=frame.visitsMs;
    data.heroCounts.push(frame.heroCalls);data.walkerCounts.push(frame.walkers.length);data.adultCounts.push(frame.adults);
    if(!data.samples.length||timestamp-data.samples.at(-1).timestamp>450){
      const state=window.BearlyVisits.audit();
      data.samples.push({timestamp,time:state.combat.time,x:state.x,mode:state.mode,population:state.combat.population,drawnWalkers:frame.walkers,drawnActors:frame.npcs,heroCache:window.BearlyHeroRig.cacheStats?.()||null,cache:window.BearlyNpcMotion.cacheStats?.()||null});
    }
    frame=null;
  });
  window.__installPerformanceHooks=()=>{
    const adult=BearlyBrawlArt.adult,hero=BearlyHeroRig.draw,update=BearlyVisits.update;
    BearlyBrawlArt.adult=function(c,n,...args){
      if(!enabled||!frame)return adult.call(this,c,n,...args);
      const start=now();const result=adult.call(this,c,n,...args);frame.npcMs+=now()-start;frame.adults++;
      if(n.kind!=='gangster'){frame.npcs.push(summaryActor(n));if(n.moving&&n.activity==='walk')frame.walkers.push(n.id);}return result;
    };
    BearlyHeroRig.draw=function(...args){if(!enabled||!frame)return hero.apply(this,args);const start=now(),result=hero.apply(this,args);frame.heroMs+=now()-start;frame.heroCalls++;return result;};
    BearlyVisits.update=function(...args){if(!enabled||!frame)return update.apply(this,args);const start=now(),result=update.apply(this,args);frame.visitsMs+=now()-start;return result;};
  };
  window.__beginPerformance=()=>{last=0;data={intervals:[],callbacks:[],samples:[],walkerCounts:[],adultCounts:[],heroCounts:[],frameSeries:[],images:0,npcMs:0,heroMs:0,visitsMs:0,heroCalls:0};enabled=true;};
  window.__endPerformance=()=>{enabled=false;frame=null;return data;};
})();"""

PROFILES = {
    'cold-foot-desktop': {'size':(1440,1000),'mode':'street','warm':0,'duration':20,'cold':True},
    'foot-desktop': {'size':(1440,1000),'mode':'street','warm':20},
    'foot-portrait': {'size':(390,844),'mode':'street','warm':20,'touch':True},
    'foot-landscape': {'size':(844,390),'mode':'street','warm':20,'touch':True},
    'cycling-desktop': {'size':(1440,1000),'mode':'cycling','warm':20},
    'garden-desktop': {'size':(1440,1000),'mode':'garden','location':24400,'warm':2},
    'dock-desktop': {'size':(1440,1000),'mode':'dock','location':31750,'warm':2},
}


def source_hashes():
    paths=[ROOT/ENTRY,*[ROOT/'js'/name for name in ['game.js','npc-motion.js','brawler-art.js','brawler.js','hero-rig.js','locomotion.js','illustrated-visits.js','street-life.js','illustrated-neighbourhood.js','illustrated-world.js']],ROOT/'css'/'illustrated.css']
    return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()}


def compact(page):
    return page.evaluate("""() => {const s=BearlyVisits.audit();return{mode:s.mode,transition:s.transition,x:s.x,parkedAt:s.parkedAt,time:s.combat.time,phase:s.combat.phase,population:s.combat.population,npcs:s.combat.npcs.map(n=>({id:n.id,variant:n.variant,activity:n.activity,state:n.state,x:n.x,depth:n.depth,moving:n.moving,running:n.running,civilian:n.civilian,active:n.active,visible:n.visible})),cache:BearlyNpcMotion.cacheStats?.()||null,heroCache:BearlyHeroRig.cacheStats?.()||null,cycling:window.BEARLY_TOUCH_STATUS?.()};}""")


def quantile(values,p):
    if not values:return None
    values=sorted(values);return values[min(len(values)-1,math.ceil((len(values)-1)*p))]


def distribution(values):
    return {'count':len(values),'mean':sum(values)/len(values) if values else None,'p50':quantile(values,.5),'p95':quantile(values,.95),'p99':quantile(values,.99),'max':max(values) if values else None,'over40ms':sum(v>40 for v in values),'over50ms':sum(v>50 for v in values),'over100ms':sum(v>100 for v in values)}


def count_summary(values):
    return {'count':len(values),'min':min(values) if values else 0,'max':max(values) if values else 0,'mean':sum(values)/len(values) if values else 0,'p95':quantile(values,.95)}


def cdp_metrics(session):
    return {item['name']:item['value'] for item in session.send('Performance.getMetrics')['metrics']}



def loaded_resource_hashes(session):
    """Hash the browser's loaded resources, rather than refetch changed files."""
    tree=session.send('Page.getResourceTree')['frameTree'];frame=tree['frame'];out={}
    resources=[{'url':frame['url'],'type':'Document'},*tree.get('resources',[])]
    for resource in resources:
        if resource['type'] not in ['Script','Stylesheet','Document']:continue
        url=resource['url'];path=url.split('127.0.0.1:',1)[-1].split('/',1)[-1].split('?',1)[0]
        if not (path.endswith('.js') or path.endswith('.css') or path==ENTRY):continue
        try:
            content=session.send('Page.getResourceContent',{'frameId':frame['id'],'url':url})
            if not content.get('base64Encoded'):out[path]=hashlib.sha256(content['content'].encode()).hexdigest()
        except Exception:continue
    return out


def process_cpu(session):
    try:return session.send('SystemInfo.getProcessInfo')['processInfo']
    except Exception:return []


def cpu_delta(before,after):
    previous={p['id']:p for p in before};out={}
    for process in after:
        old=previous.get(process['id'])
        if old:out[process['type']]=out.get(process['type'],0)+max(0,process['cpuTime']-old['cpuTime'])
    return out


def real_press(page,key,duration,touch=False):
    if not touch:
        page.keyboard.down(key);page.wait_for_timeout(duration);page.keyboard.up(key);return
    box=page.locator('[data-direction="1"]').bounding_box();session=page.context.new_cdp_session(page)
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}]});page.wait_for_timeout(duration);session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});session.detach()


def open_page(browser,base,profile,errors,failures):
    w,h=profile['size'];touch=profile.get('touch',False)
    context=browser.new_context(viewport={'width':w,'height':h},is_mobile=touch,has_touch=touch)
    page=context.new_page();page.add_init_script(INSTRUMENT)
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('response',lambda response:failures.append([response.status,response.url]) if response.status>=400 else None)
    page.goto(f'{base}/{ENTRY}');page.wait_for_function('BearlyVisits.audit().artReady&&BearlyNpcMotion.ready()',timeout=120000)
    if touch:page.locator('#introStart').tap()
    else:page.locator('#introStart').click()
    page.evaluate('BEARLY_DEBUG_MENU.settings.godMode=true')
    if profile['mode'] in ['garden','dock']:
        page.evaluate('(x)=>BEARLY_DEBUG_MENU.warp(x/1.5)',profile['location']);page.wait_for_timeout(100)
        page.locator('.visit-prompt').click();page.wait_for_function('(m)=>BearlyVisits.audit().mode===m',arg=profile['mode'],timeout=15000)
    else:
        page.evaluate('BEARLY_DEBUG_MENU.warp(2500/1.5)');page.wait_for_timeout(150)
        if profile['mode']=='street':
            settings=page.locator('#debugOpenBtn') if page.locator('#debugOpenBtn').is_visible() else page.locator('.ride-settings')
            if touch:settings.tap()
            else:settings.click()
            page.wait_for_timeout(180)
            if touch:page.locator('#debugLifeBtn').tap()
            else:page.locator('#debugLifeBtn').click()
            page.wait_for_function('BearlyVisits.audit().mode===\"street\"',timeout=15000)
    page.evaluate('__installPerformanceHooks()')
    return context,page


def run_case(browser,browser_session,base,name,duration,baseline,errors,failures):
    profile=PROFILES[name];context,page=open_page(browser,base,profile,errors,failures)
    session=context.new_cdp_session(page);session.send('Performance.enable')
    loaded=loaded_resource_hashes(session)
    started=compact(page);warm_start=started['time'];warm=profile['warm']
    page.wait_for_function('(target)=>BearlyVisits.audit().combat.time>=target',arg=warm_start+warm,timeout=120000)
    if profile['mode']=='street' and not profile.get('cold'):
        # The former four-second check mostly saw resting actors. Require real
        # sustained walking before timing, including actors culled generously by
        # the production scene, whose draw work still costs browser CPU.
        page.wait_for_function("BearlyVisits.residents().filter(n=>n.active!==false&&n.visible!==false&&n.activity==='walk'&&n.moving&&Math.abs(n.x-2500)<1100).length>=3",timeout=30000)
    if not profile.get('cold'):
        page.wait_for_function('!BearlyNpcMotion.cacheStats||BearlyNpcMotion.cacheStats().complete',timeout=180000)
    before=compact(page);metrics_before=cdp_metrics(session);cpu_before=process_cpu(browser_session)
    page.evaluate('__beginPerformance()');wall=time.monotonic()
    key='ArrowUp' if profile['mode']=='cycling' else 'ArrowRight'
    real_press(page,key,round(duration*1000),profile.get('touch',False))
    raw=page.evaluate('__endPerformance()');elapsed=time.monotonic()-wall
    after=compact(page);metrics_after=cdp_metrics(session);cpu_after=process_cpu(browser_session)
    if profile['mode']=='cycling':distance=after['cycling']['x']-before['cycling']['x']
    else:distance=after['x']-before['x']
    intervals=distribution(raw['intervals']);callbacks=distribution(raw['callbacks']);count=len(raw['callbacks'])
    result={'profile':name,'loadedResourceSHA256':loaded,'viewport':{'width':profile['size'][0],'height':profile['size'][1]},'warmSimulationSeconds':before['time']-started['time'],'wallSeconds':elapsed,'simulationSeconds':after['time']-before['time'],'distance':distance,'expectedFootSpeed':FOOT_SPEED if profile['mode']!='cycling' else None,'normalizedWalkingProgress':distance/(FOOT_SPEED*max(.01,elapsed-.15)) if profile['mode']=='street' else None,'fps':1000/intervals['mean'] if intervals['mean'] else 0,'frameIntervalMs':intervals,'wholeLoopMs':callbacks,'drawImages':raw['images'],'drawImagesPerFrame':raw['images']/max(1,count),'npcPaintMsPerFrame':raw['npcMs']/max(1,count),'heroPaintMsPerFrame':raw['heroMs']/max(1,count),'heroDraws':count_summary(raw['heroCounts']),'visitsUpdateMsPerFrame':raw['visitsMs']/max(1,count),'walkingActors':count_summary(raw['walkerCounts']),'walkingActorDraws':sum(raw['walkerCounts']),'adultDrawCalls':count_summary(raw['adultCounts']),'samples':raw['samples'],'frameSeries':raw['frameSeries'],'before':before,'after':after,'rendererMetricDelta':{key:metrics_after.get(key,0)-metrics_before.get(key,0) for key in ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','JSHeapUsedSize']},'browserProcessCpuSeconds':cpu_delta(cpu_before,cpu_after)}
    failures_case=[]
    if not baseline:
        if profile['mode']!='cycling' and min(raw['heroCounts'],default=0)<1:failures_case.append('on-foot hero was omitted from a measured frame')
        if result['fps']<28:failures_case.append('sustained FPS below28')
        if intervals['p95']>65:failures_case.append('p95 frame interval above65ms')
        if profile['mode']=='street' and distance<FOOT_SPEED*max(0,duration-.15)*.90:failures_case.append('normal walking loses more than10% of wall-clock distance')
        if profile['mode']=='cycling' and distance<100:failures_case.append('actual cycling input did not move the bicycle')
    for cache_name in ['cache','heroCache']:
        cache=after.get(cache_name)
        if cache and cache.get('limitBytes') is not None and cache.get('bytes',0)>cache['limitBytes']:failures_case.append(cache_name+' exceeds byte limit')
        if cache and cache.get('capacity') is not None and cache.get('frameCount',0)>cache['capacity']:failures_case.append(cache_name+' exceeds frame capacity')
        if cache and cache.get('frameLimit') is not None and cache.get('frames',0)>cache['frameLimit']:failures_case.append(cache_name+' exceeds frame limit')
        if cache and cache.get('scratchBytes',0)>2*1024*1024:failures_case.append(cache_name+' scratch buffers exceed2MiB')
    if not profile.get('cold') and after.get('cache'):
        if after['cache']['misses']!=before['cache']['misses']:failures_case.append('steady-state walking requested an uncached phase')
        if after['cache']['hits']-before['cache']['hits']<sum(raw['walkerCounts']):failures_case.append('walking draws did not all reuse cached poses')
    result['failures']=failures_case
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'horizontal overflow'
    page.screenshot(path=str(SHOTS/f'performance-{name}.png'))
    session.detach();context.close();return result


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--case',action='append',choices=PROFILES)
    parser.add_argument('--duration',type=float)
    parser.add_argument('--baseline',action='store_true')
    args=parser.parse_args();SHOTS.mkdir(exist_ok=True)
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
    errors=[];failures=[];evidence={'entry':ENTRY,'environment':'Headless Chromium; these are not physical-phone benchmarks.','recording':False,'virtualClock':False,'baseline':args.baseline,'sourceSHA256':source_hashes(),'cases':[]}
    target=SHOTS/('sustained-baseline-evidence.json' if args.baseline else 'sustained-performance-evidence.json')
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox']);browser_session=browser.new_browser_cdp_session()
            for name in args.case or PROFILES:
                result=run_case(browser,browser_session,f'http://127.0.0.1:{server.server_port}',name,args.duration or PROFILES[name].get('duration',6),args.baseline,errors,failures);evidence['cases'].append(result);evidence.update({'result':'checking','pageErrors':errors,'httpFailures':failures});target.write_text(json.dumps(evidence,indent=2)+'\n')
                print(json.dumps({key:result[key] for key in ['profile','fps','wallSeconds','distance','wholeLoopMs','drawImagesPerFrame','walkingActors','failures']}),flush=True)
                assert not result['failures'],result['failures']
            browser_session.detach();browser.close()
        assert not errors,errors
        assert not failures,failures
        assert evidence['sourceSHA256']==source_hashes(),'Production source changed during this run; compare stage hashes before claiming a final measurement.'
        evidence['result']='passed';target.write_text(json.dumps(evidence,indent=2)+'\n')
    finally:server.shutdown();server.server_close()


if __name__=='__main__':main()
