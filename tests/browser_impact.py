"""Actual grab/throw controls and full-body damage screenshots."""
import functools
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];SHOTS=ROOT/'screenshots/revision11-1';SHOTS.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
errors=[];failures=[]
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox'])
  for w,h in [(1440,1000),(390,844),(844,390)]:
   ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=w<1000,has_touch=w<1000);p=ctx.new_page();p.clock.install();p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:failures.append(r.url) if r.status>=400 else None)
   p.goto(f'http://127.0.0.1:{server.server_port}/autumn-v11-1.html');p.wait_for_function('BearlyVisits.audit().artReady&&BearlyAtlas.ready()');p.clock.pause_at(p.evaluate('Date.now()+1000')/1000);p.locator('#introStart').click();p.evaluate('BEARLY_DEBUG_MENU.warp(2500/1.5);BearlyVisits.practice()');p.clock.run_for(2600)
   if w<1000:p.locator('.area-grab').tap()
   else:p.keyboard.press('g')
   p.clock.run_for(100);assert p.evaluate('!!BearlyVisits.audit().combat.held')
   if w<1000:p.locator('.area-grab').tap()
   else:p.keyboard.press('g')
   p.clock.run_for(300)
   if w==1440:p.locator('.canvas-wrap').screenshot(path=str(SHOTS/'full-body-flight.png'))
   p.clock.run_for(370)
   if w==1440:p.locator('.canvas-wrap').screenshot(path=str(SHOTS/'full-body-contact.png'))
   p.clock.run_for(180);state=p.evaluate('BearlyVisits.audit().combat');target=next(n for n in state['npcs'] if n['id']=='practice-a')
   assert target['state']=='screen' and target['hp']==28 and target['lastDamage']==32 and state['stats']['screenImpacts']==1,target
   p.locator('.canvas-wrap').screenshot(path=str(SHOTS/f'full-body-damage-{w}.png'))
   assert p.locator('.foot-heart').count()==5;assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert p.evaluate('BEARLY_BUILD_ID')=='AUTUMN_RIDE_ART_V11_1'
   p.clock.run_for(1000);assert p.evaluate("BearlyVisits.audit().combat.npcs.find(n=>n.id==='practice-a').state")=='down'
   if w==1440:
    p.evaluate('BEARLY_DEBUG_MENU.settings.godMode=true;BearlyVisits.practice()')
    for _ in range(3):p.keyboard.press('j');p.clock.run_for(450)
    p.clock.run_for(1300);assert p.evaluate("BearlyVisits.audit().combat.npcs.some(n=>n.state==='dead')")
    p.locator('.canvas-wrap').screenshot(path=str(SHOTS/'npc-defeat-witnesses.png'))
   ctx.close()
  b.close()
 assert not errors,errors
 assert not failures,failures
 print('Impact browser checks passed: real keyboard/touch grabs and throws, whole-body contact/damaged poses, actual 32 HP damage, impact timing, recovery, hearts and desktop/phone layouts.')
finally:server.shutdown()
