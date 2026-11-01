"""Verify decoded render caches against SHA-256 of every original prepared RGBA tile."""
import functools,hashlib,json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'screenshots/revision19'
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
manifest=json.loads((ROOT/'assets/cache/actors-v19-manifest.json').read_text())
for name,expected in manifest['sourceSHA256'].items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==expected,name
for name,expected in manifest['cacheSHA256'].items():assert hashlib.sha256((ROOT/'assets/cache'/name).read_bytes()).hexdigest()==expected,name
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox']);page=browser.new_page();errors=[];failures=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failures.append([r.status,r.url]) if r.status>=400 else None)
  npc=(ROOT/'js/npc-motion.js').read_text().replace('window.BearlyNpcMotion={','window.__exportNpc=()=>({profiles,walkBanks:[...walkBanks.values()]});window.BearlyNpcMotion={')
  kids=(ROOT/'js/illustrated-kids.js').read_text().replace('window.BearlyKids={','window.__exportKids=()=>({banks,sources});window.BearlyKids={')
  page.route('**/actor-cache-check.html',lambda r:r.fulfill(body='<script src="js/illustrated-kids.js"></script><script src="js/npc-motion.js"></script>',content_type='text/html'))
  page.route('**/js/npc-motion.js',lambda r:r.fulfill(body=npc,content_type='application/javascript'));page.route('**/js/illustrated-kids.js',lambda r:r.fulfill(body=kids,content_type='application/javascript'))
  page.goto(f'http://127.0.0.1:{server.server_port}/actor-cache-check.html');page.wait_for_function('BearlyKids.ready()&&BearlyNpcMotion.ready()',timeout=120000)
  before=page.evaluate('BearlyNpcMotion.cacheStats()');assert before['frameCount']==0 and not before['requestedVariants'],before
  page.evaluate('BearlyNpcMotion.preloadAll()');page.wait_for_function('BearlyNpcMotion.cacheStats().complete',timeout=120000)
  result=page.evaluate(r'''async()=>{
   const manifest=await BearlyActorRenderCache.manifest,npc=__exportNpc(),kids=__exportKids(),hash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join(''),faults=[],seen=new Set();let sourceCases=0,walkCases=0;
   for(const pack of manifest.npcSources)for(const expected of pack.frames){const actual=npc.profiles[expected.variant].poses[expected.pose],pixels=actual.tile.getContext('2d',{willReadFrequently:true}).getImageData(0,0,actual.tile.width,actual.tile.height);sourceCases++;if(await hash(pixels.data)!==expected.pixelSHA256)faults.push({type:'adultPixels',variant:expected.variant,pose:expected.pose});for(const k of ['source','rect','core','anchor','stature','sourceFace','seatPivot'])if(JSON.stringify(actual[k])!==JSON.stringify(expected[k]))faults.push({type:'adultMetadata',k,variant:expected.variant,pose:expected.pose});}
   for(const pack of manifest.teenSources)for(const expected of pack.frames){const actual=kids.sources[pack.source].frames.find(f=>f.kind===expected.kind&&f.pose===expected.pose),pixels=actual.tile.getContext('2d',{willReadFrequently:true}).getImageData(0,0,actual.tile.width,actual.tile.height);sourceCases++;if(await hash(pixels.data)!==expected.pixelSHA256)faults.push({type:'teenPixels',kind:expected.kind,pose:expected.pose});for(const k of ['source','rect','core','anchor','stature'])if(JSON.stringify(actual[k])!==JSON.stringify(expected[k]))faults.push({type:'teenMetadata',k,kind:expected.kind,pose:expected.pose});}
   for(const expected of manifest.walks){const bank=npc.walkBanks.find(b=>b.variant===expected.variant);for(const frame of expected.frames){const actual=bank.frames[frame.index],c=document.createElement('canvas');c.width=bank.width;c.height=bank.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(actual.canvas,0,0);walkCases++;seen.add(actual.canvas);if(await hash(g.getImageData(0,0,c.width,c.height).data)!==frame.pixelSHA256)faults.push({type:'walkPixels',variant:bank.variant,index:frame.index});if(JSON.stringify(actual.details)!==JSON.stringify(frame.details))faults.push({type:'walkLandmarks',variant:bank.variant,index:frame.index});}}
   const stats=BearlyNpcMotion.cacheStats();return{sourceCases,walkCases,uniqueWalkFrames:seen.size,faults,stats,teenMode:BearlyKids.audit().preparationMode};
  }''')
  assert not errors,errors
  assert not failures,failures
  assert result['sourceCases']==144 and result['walkCases']==result['uniqueWalkFrames']==576,result
  assert not result['faults'],result['faults'][:20]
  assert result['stats']['bytes']<=result['stats']['limitBytes'] and result['stats']['mainBuildMs']==0,result['stats']
  result.update({'result':'passed','coldCache':before,'pageErrors':errors,'httpFailures':failures,'sourceSHA256':manifest['sourceSHA256']})
  OUT.mkdir(exist_ok=True);(OUT/'actor-render-cache-evidence.json').write_text(json.dumps(result,indent=2)+'\n')
  print(json.dumps({k:result[k]for k in ['result','sourceCases','walkCases','uniqueWalkFrames','faults']}));browser.close()
finally:server.shutdown()
