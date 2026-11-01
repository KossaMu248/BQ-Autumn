import functools,json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
from browser_encounters import provoke_existing_gang
ROOT=Path(__file__).resolve().parents[1];shots=ROOT/'screenshots/revision18';shots.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
srv=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));Thread(target=srv.serve_forever,daemon=True).start()
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1000});p.clock.install();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(f'http://127.0.0.1:{srv.server_port}/autumn-v18.html');p.wait_for_function('BearlyVisits.audit().artReady&&BearlyAtlas.ready()&&window.BEARLY_DEBUG_MENU?.stats().frames>0');p.clock.pause_at(p.evaluate('Date.now()+1000')/1000);p.click('#introStart');p.evaluate('BEARLY_DEBUG_MENU.settings.godMode=true;BEARLY_DEBUG_MENU.warp(2500/1.5)');p.clock.run_for(100)
 read=lambda:p.evaluate('BearlyVisits.audit()')
 before=read()['combat']['npcs'];p.screenshot(path=str(shots/'residents-riding.png'));p.keyboard.press('q');p.clock.run_for(2500);after=read()['combat']['npcs'];assert [n['id'] for n in before]==[n['id'] for n in after]
 p.keyboard.down('ArrowRight');p.clock.run_for(300);p.screenshot(path=str(shots/'walk-right.png'));p.clock.run_for(140);p.screenshot(path=str(shots/'walk-opposite-legs.png'));p.keyboard.up('ArrowRight');p.clock.run_for(200)
 p.evaluate('BearlyVisits.practice()');p.keyboard.press('j');p.clock.run_for(100);assert read()['baby']=='back-carrier';p.screenshot(path=str(shots/'maul-back-carrier.png'))
 p.keyboard.press('g');p.clock.run_for(100);p.keyboard.press('g');p.clock.run_for(800);assert read()['combat']['stats']['screenImpacts']>0;p.screenshot(path=str(shots/'face-smack.png'))
 # Actual nearby NPCs react to witnessing violence; distant civilians stay calm.
 assert read()['combat']['stats']['witnesses']>=2
 p.clock.run_for(1200);p.evaluate('BearlyVisits.practice()')
 for _ in range(3):p.keyboard.press('j');p.clock.run_for(450)
 assert any(n['state'] in ['fall','dead'] for n in read()['combat']['npcs']);p.screenshot(path=str(shots/'npc-defeat.png'))
 # A passive real crew throws only after the bear uses the visible BOTHER interaction.
 p.evaluate('BEARLY_DEBUG_MENU.settings.godMode=false;BEARLY_DEBUG_MENU.warp(3800/1.5)');p.clock.run_for(100);p.keyboard.press('q');p.clock.run_for(2300);provoke_existing_gang(p)
 hurt=False;ko=False
 for _ in range(140):
  p.clock.run_for(100);state=read()['combat']
  if 0<state['hp']<100 and state['hurt'] and not hurt:p.screenshot(path=str(shots/'bear-hurt.png'));hurt=True
  if state['hp']==0:
   assert p.locator('.area-action').is_disabled();p.screenshot(path=str(shots/'bear-collapse.png'));p.clock.run_for(700);p.screenshot(path=str(shots/'bear-defeated.png'));ko=True;break
 assert hurt and ko,read()
 assert read()['combat']['stats']['enemyShots']>=2
 p.clock.run_for(1500);assert read()['combat']['hp']==100
 assert p.locator('.foot-heart').count()==5
 # Hearts retain their red art while dialogue stays white and the HUD has no box.
 assert p.locator('.area-message').evaluate('(e)=>getComputedStyle(e).color')=='rgb(255, 255, 255)'
 assert p.locator('.area-panel').evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
 assert not errors,errors
 p.close()
 for w,h in [(390,844),(844,390)]:
  ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True);p=ctx.new_page();p.clock.install();p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(f'http://127.0.0.1:{srv.server_port}/autumn-v18.html');p.wait_for_function('BearlyVisits.audit().artReady&&BearlyAtlas.ready()&&window.BEARLY_DEBUG_MENU?.stats().frames>0');p.clock.pause_at(p.evaluate('Date.now()+1000')/1000);p.locator('#introStart').tap();p.evaluate('BEARLY_DEBUG_MENU.warp(2500/1.5);BearlyVisits.practice()');p.clock.run_for(2600)
  p.locator('.area-maul').tap();p.clock.run_for(90);assert read()['baby']=='back-carrier'
  p.locator('.area-grab').tap();p.clock.run_for(90);p.locator('.area-grab').tap();p.clock.run_for(800)
  p.screenshot(path=str(shots/f'face-impact-phone-{w}.png'));assert p.evaluate('document.documentElement.scrollWidth<=innerWidth');assert p.locator('.foot-heart').count()==5
  assert p.locator('.canvas-wrap').bounding_box()['height']>=h-2;ctx.close()
 assert not errors,errors
 b.close()
print('NPC browser checks passed: persistent bike/foot population, nearby witnesses, attached back carrier, face-first screen impact, NPC defeats, provoked gang throws, animated bear damage/KO/respawn, hearts and phone layouts.')
srv.shutdown()
