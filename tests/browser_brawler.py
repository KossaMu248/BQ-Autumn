"""Play the brawler loop through keyboard/touch controls."""
import functools
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];SHOTS=ROOT/'screenshots'/'revision15';SHOTS.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/autumn-v15.html';errors=[];failures=[]
def read(p):return p.evaluate('BearlyVisits.audit()')
def ready(p):
 p.clock.install();p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:failures.append(r.url) if r.status>=400 else None)
 p.goto(base);p.wait_for_function('BearlyVisits.audit().artReady&&BearlyAtlas.ready()');p.click('#introStart');p.evaluate('BEARLY_DEBUG_MENU.warp(2500/1.5);BearlyVisits.practice()');p.clock.run_for(2900);assert read(p)['mode']=='street'
def axis(p,key,ms):p.keyboard.down(key);p.clock.run_for(ms);p.keyboard.up(key);p.clock.run_for(180)
def approach(p,target):
 for _ in range(8):
  s=read(p);dx=target['x']-65-s['x'];dy=target['depth']-s['depth']
  if abs(dx)<10 and abs(dy)<8:return
  if abs(dx)>8:axis(p,'ArrowRight' if dx>0 else 'ArrowLeft',max(30,round(abs(dx)/235*1000)))
  if abs(dy)>7:axis(p,'ArrowDown' if dy>0 else 'ArrowUp',max(30,round(abs(dy)/140*1000)))
 assert abs(target['x']-65-read(p)['x'])<20
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1150});ready(p)
  assert p.locator('.canvas-wrap > .area-panel').count()==1 and p.locator('.canvas-wrap > .area-controls').count()==1
  original=read(p)['x'];axis(p,'ArrowUp',280);assert read(p)['depth']<-15 and abs(read(p)['x']-original)<2
  axis(p,'ArrowDown',280);p.keyboard.press('Space');p.clock.run_for(180);assert read(p)['jump']>30
  p.screenshot(path=str(SHOTS/'jump-depth.png'));p.clock.run_for(750);assert read(p)['jump']==0
  # Align lane with the first rehearsal NPC and maul, then throw it.
  target=read(p)['combat']['npcs'][0];approach(p,target)
  p.keyboard.press('j');p.clock.run_for(80);assert read(p)['combat']['stats']['mauls']==1
  p.screenshot(path=str(SHOTS/'maul.png'));p.keyboard.press('g');p.clock.run_for(100);assert read(p)['combat']['held']
  assert read(p)['baby']=='back-carrier';p.screenshot(path=str(SHOTS/'grapple.png'))
  p.keyboard.press('g');p.clock.run_for(320);assert read(p)['combat']['phase']=='apex';assert 'APEX PRIMAL' in p.locator('.brawl-status').inner_text();p.screenshot(path=str(SHOTS/'throw-at-screen.png'))
  target=next(n for n in read(p)['combat']['npcs'] if n['id']=='practice-b');approach(p,target)
  p.keyboard.press('j');p.clock.run_for(100);p.keyboard.press('g');p.clock.run_for(80);assert read(p)['combat']['held']
  p.keyboard.press('g');p.clock.run_for(50);assert read(p)['combat']['phase']=='madness' and read(p)['combat']['invulnerable']
  assert 'MADNESS MAULING BEAR' in p.locator('.brawl-status').inner_text()
  hp=read(p)['combat']['hp'];axis(p,'ArrowUp',450);assert read(p)['combat']['hp']==hp
  assert abs(read(p)['x']-target['x']+65)<35, 'frenzy does not auto-roll away'
  p.clock.run_for(500) # Let the foreground throw clear so the upright frenzy pose is visible.
  p.screenshot(path=str(SHOTS/'madness-mauling.png'));p.clock.run_for(8200)
  assert read(p)['combat']['phase']=='cute' and not read(p)['combat']['invulnerable']
  p.clock.run_for(5300);assert read(p)['baby']=='front-carrier';p.screenshot(path=str(SHOTS/'cute-again.png'))
  p.close()
  for w,h in [(390,844),(844,390)]:
   ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True);p=ctx.new_page();ready(p)
   assert p.locator('.canvas-wrap').bounding_box()['height']>=h-2, 'HUD must not shrink phone scene'
   for selector in ['.area-jump','.area-grab','.area-maul','[data-depth="1"]','.area-exit']:
    box=p.locator(selector).bounding_box();assert 0<=box['y'] and box['y']+box['height']<=h and box['x']+box['width']<=w,(selector,box)
   p.locator('.area-jump').tap();p.clock.run_for(150);assert read(p)['jump']>20;p.clock.run_for(700)
   button=p.locator('[data-depth="1"]').bounding_box();cdp=ctx.new_cdp_session(p)
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':button['x']+button['width']/2,'y':button['y']+button['height']/2}]});p.clock.run_for(300);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});p.clock.run_for(200)
   assert read(p)['depth']>15
   # Return toward the adult's lane, then use grab/throw buttons.
   button=p.locator('[data-depth="-1"]').bounding_box();cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':button['x']+button['width']/2,'y':button['y']+button['height']/2}]});p.clock.run_for(300);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});p.clock.run_for(200)
   p.locator('.area-grab').tap();p.clock.run_for(100);assert read(p)['combat']['held'];p.locator('.area-grab').tap();p.clock.run_for(100);assert read(p)['combat']['stats']['throws']==1
   p.screenshot(path=str(SHOTS/f'brawler-phone-{w}.png'));assert p.evaluate('document.documentElement.scrollWidth<=innerWidth');ctx.close()
  b.close()
 assert not errors,errors
 assert not failures,failures
 print('Browser brawler checks passed: depth, jump/landing, maul/grab/screen throw, attached back carrier, primal, temporary mauling immunity, cute recovery, and phone touch controls.')
finally:server.shutdown()
