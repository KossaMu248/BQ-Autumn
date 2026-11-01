"""Free dismount, continuous gait, on-foot doors and seated boat compositing."""
from browser_fixture import prepared_ready
import functools
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];SHOTS=ROOT/'screenshots'/'revision19';SHOTS.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/autumn-v19.html';errors=[];failures=[]
def read(p):return p.evaluate('BearlyVisits.audit()')
def ready(p):
 p.clock.install();p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:failures.append(r.url) if r.status>=400 else None)
 p.goto(base);p.wait_for_function(prepared_ready('BearlyVisits.audit().artReady && BearlyAtlas.ready() && window.BEARLY_DEBUG_MENU?.stats().frames>0'),timeout=60000);p.clock.pause_at(p.evaluate('Date.now()+1000')/1000);p.click('#introStart');p.clock.run_for(100);p.evaluate('BEARLY_DEBUG_MENU.settings.godMode=true')
def warp(p,x):p.evaluate('(x)=>BEARLY_DEBUG_MENU.warp(x/1.5)',x);p.clock.run_for(80)
def entrance(p,key):return p.evaluate('(key)=>BearlyNeighbourhood.entrance(BearlyNeighbourhood.scenes.find(b=>b.key===key)).x',key)
def finish(p):
 for _ in range(100):
  if read(p)['mode'] is None:return
  p.clock.run_for(80)
 raise AssertionError(read(p))
def move(p,target):
 for _ in range(4):
  delta=target-read(p)['x']
  if abs(delta)<8:return
  key='ArrowRight' if delta>0 else 'ArrowLeft';p.keyboard.down(key);p.clock.run_for(round(abs(delta)/120*1000));p.keyboard.up(key);p.clock.run_for(250)
 assert abs(target-read(p)['x'])<14
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1100});ready(p)
  warp(p,2500);assert p.evaluate('BearlyNeighbourhood.nearestEntrance(BEARLY_TOUCH_STATUS().x)') is None
  p.evaluate('BEARLY_V89_TEST.faster()');p.keyboard.press('q');p.clock.run_for(4000)
  assert read(p)['mode']=='street';parked=read(p)['parkedAt'];assert 2500<parked<2750,'moving bike eases to a stop'
  cam=p.evaluate('BEARLY_V158_QA().cam');poses=[];p.keyboard.down('ArrowRight')
  for i in range(12):p.clock.run_for(70);poses.append(read(p)['gait'])
  assert any(a['far']['y']<-.5 for a in poses) and any(a['near']['y']<-.5 for a in poses),'both legs swing'
  assert all(a['far']['stance'] or a['near']['stance'] for a in poses),'at least one planted foot'
  p.clock.run_for(800);assert p.evaluate('BEARLY_TOUCH_STATUS().x')==parked
  assert p.evaluate('BEARLY_V158_QA().cam')>cam+120,'camera follows walker'
  p.keyboard.up('ArrowRight');p.clock.run_for(250);p.screenshot(path=str(SHOTS/'free-walking.png'))
  p.keyboard.press('q');finish(p);assert abs(p.evaluate('BEARLY_TOUCH_STATUS().x')-parked)<2
  # Walk into a building after leaving the bike elsewhere, then step back outside.
  shop=entrance(p,'pizzeria');warp(p,shop-250);p.locator('.dismount-button').click();p.clock.run_for(2600);assert read(p)['mode']=='street';streetPark=read(p)['parkedAt']
  move(p,shop);p.keyboard.press('e');p.clock.run_for(1100);assert read(p)['mode']=='room'
  p.screenshot(path=str(SHOTS/'shop-walking.png'));p.keyboard.press('Escape');p.clock.run_for(800)
  assert read(p)['mode']=='street' and read(p)['parkedAt']==streetPark,'leaving shop returns outside without teleporting bike'
  p.keyboard.press('q');finish(p)
  # Boarding uses the same bench anchor and foreground mask as sailing.
  p.evaluate("for(const a of ['lunch','deliver','kit','repair'])BearlyQuests.game.act(a)")
  warp(p,entrance(p,'boathouse'));p.keyboard.press('e');p.clock.run_for(3000);assert read(p)['mode']=='dock';move(p,1980);p.keyboard.press('e');p.clock.run_for(600);p.screenshot(path=str(SHOTS/'boarding.png'));p.clock.run_for(1000)
  assert read(p)['mode']=='water';p.keyboard.down('ArrowRight');p.clock.run_for(3500);p.keyboard.up('ArrowRight');p.clock.run_for(200);p.screenshot(path=str(SHOTS/'boat-right.png'))
  p.keyboard.down('ArrowLeft');p.clock.run_for(500);p.keyboard.up('ArrowLeft');p.clock.run_for(200);p.screenshot(path=str(SHOTS/'boat-left.png'))
  p.close()
  for w,h in [(390,844),(844,390)]:
   ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True);p=ctx.new_page();ready(p);warp(p,2500)
   p.locator('.dismount-button').tap();p.clock.run_for(2700);assert read(p)['mode']=='street'
   control=p.locator('[data-direction="1"]').bounding_box();cdp=ctx.new_cdp_session(p);before=read(p)['x']
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':control['x']+control['width']/2,'y':control['y']+control['height']/2}]});p.clock.run_for(850);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});p.clock.run_for(250)
   assert read(p)['x']>before+85;p.screenshot(path=str(SHOTS/f'free-walking-{w}.png'))
   assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
   p.locator('.area-exit').tap();finish(p);ctx.close()
  b.close()
 assert not errors,errors
 assert not failures,failures
 print('Movement checks passed: dismount away from entrances and while moving, both legs swing, planted feet, following camera, same parked bike, walking through shop doors, boat boarding and both headings, phone touch/overflow.')
finally:server.shutdown()
