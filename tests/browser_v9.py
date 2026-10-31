"""Playable areas and adventure smoke checks. Requires Playwright Chromium."""
import functools
import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SHOTS=ROOT/'screenshots'/'revision12';SHOTS.mkdir(parents=True,exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
errors,failures=[],[]
def watch(p):
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('response',lambda r:failures.append([r.status,r.url]) if r.status>=400 else None)
def ready(p,entry='autumn-v12.html'):
    p.goto(f'{base}/{entry}')
    p.wait_for_function('window.BearlyAtlas?.ready() && BearlyVisits.audit().artReady')
    p.clock.pause_at(p.evaluate('Date.now()+1000')/1000);p.click('#introStart');p.clock.run_for(200)
    p.evaluate('BEARLY_DEBUG_MENU.settings.godMode=true')
def audit(p):return p.evaluate('BearlyVisits.audit()')
def enter(p,x,mode):
    p.evaluate('(x)=>BEARLY_DEBUG_MENU.warp(x/1.5)',x);p.clock.run_for(100)
    p.locator('.visit-prompt').click();p.clock.run_for(3400)
    assert audit(p)['mode']==mode

def move(p,target):
    start=audit(p)['x'];key='ArrowRight' if target>start else 'ArrowLeft'
    p.keyboard.down(key);p.clock.run_for(round(abs(target-start)/200*1000));p.keyboard.up(key);p.clock.run_for(250)
    assert abs(audit(p)['x']-target)<12,(target,audit(p))
def leave(p):
    p.keyboard.press('Escape')
    for _ in range(60):
        if audit(p)['mode'] is None:break
        p.clock.run_for(80)
    assert audit(p)['mode'] is None

def action(p):p.keyboard.press('e');p.clock.run_for(50)
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
        if '--phones-only' not in sys.argv:
            p=browser.new_page(viewport={'width':1440,'height':1100});p.clock.install();watch(p);ready(p)
            # A building really swaps to a playable on-foot scene and preserves the bicycle.
            enter(p,15700,'room');ride=p.evaluate('BEARLY_TOUCH_STATUS()')
            assert audit(p)['baby']=='front-carrier'
            p.keyboard.down('ArrowRight');p.clock.run_for(400)
            a=audit(p);p.clock.run_for(180);b=audit(p);p.keyboard.up('ArrowRight');p.clock.run_for(30)
            assert b['x']>a['x'] and a['frame']!=b['frame'],'Animated walk advances through poses'
            move(p,700);action(p);assert audit(p)['quest']['lunch']
            p.screenshot(path=str(SHOTS/'pizza-on-foot.png'))
            p.keyboard.press('r');p.clock.run_for(50);assert audit(p)['mode']=='room'
            assert p.evaluate('BEARLY_TOUCH_STATUS().x')==ride['x'],'Cycling remains frozen while walking'
            p.keyboard.press('p');before=audit(p)['x'];p.keyboard.down('ArrowLeft');p.clock.run_for(400);assert audit(p)['x']==before;p.keyboard.up('ArrowLeft');p.keyboard.press('p')
            leave(p);assert audit(p)['mode'] is None
            assert abs(p.evaluate('BEARLY_TOUCH_STATUS().x')-ride['x'])<2
            # The dinghy stays locked without the repair, even after lunch is delivered.
            enter(p,31750,'dock');move(p,640);action(p);assert audit(p)['quest']['delivered']
            p.screenshot(path=str(SHOTS/'dock.png'));move(p,1980);action(p);assert audit(p)['mode']=='dock' and not audit(p)['quest']['boatReady']
            leave(p);enter(p,5600,'room');move(p,700);action(p);assert audit(p)['quest']['kit'];p.screenshot(path=str(SHOTS/'workshop.png'));leave(p)
            enter(p,17700,'room');move(p,700);action(p);assert audit(p)['quest']['chart'];leave(p)
            enter(p,31750,'dock');move(p,1980);action(p);assert audit(p)['quest']['boatReady'];action(p);p.clock.run_for(1600);assert audit(p)['mode']=='water';p.clock.run_for(600)
            p.keyboard.down('ArrowRight');p.clock.run_for(6500);p.keyboard.up('ArrowRight');p.clock.run_for(50);p.screenshot(path=str(SHOTS/'lake.png'))
            p.keyboard.down('ArrowRight');p.clock.run_for(11000);p.keyboard.up('ArrowRight');p.clock.run_for(50)
            assert len(audit(p)['quest']['buoys'])==3 and not audit(p)['quest']['voyage']
            p.keyboard.down('ArrowLeft');p.clock.run_for(18500);p.keyboard.up('ArrowLeft');p.clock.run_for(800);action(p);p.clock.run_for(1400)
            assert audit(p)['mode']=='dock' and audit(p)['quest']['voyage'];leave(p)
            # A second area has a different walking quest.
            enter(p,24400,'garden');move(p,520);action(p)
            for sx in [1050,1540,2110]:move(p,sx);action(p)
            move(p,650);action(p);assert audit(p)['quest']['garden'];p.screenshot(path=str(SHOTS/'garden.png'));leave(p)
            # Adventure progress survives a reload, separate from cycling scores.
            ready(p);assert audit(p)['quest']['voyage'] and audit(p)['quest']['garden']
            for entry in ['index.html','autumn-v3.html','autumn-v4.html','autumn-v5.html','autumn-v6.html','autumn-v7.html','autumn-v8.html']:
                ready(p,entry);assert p.evaluate('BEARLY_BUILD_ID')=='AUTUMN_RIDE_ART_V12'
            p.close()
        for width,height in [(390,844),(844,390)]:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,device_scale_factor=1)
            p=context.new_page();p.clock.install();watch(p);ready(p);p.evaluate('BEARLY_DEBUG_MENU.warp(15700/1.5)');p.clock.run_for(100);p.locator('.visit-prompt').tap();p.clock.run_for(3400)
            button=p.locator('[data-direction="1"]').bounding_box();cdp=context.new_cdp_session(p);start=audit(p)['x']
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':button['x']+button['width']/2,'y':button['y']+button['height']/2}]})
            p.clock.run_for(2700);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});p.clock.run_for(40)
            assert audit(p)['x']>start+450
            p.locator('.area-action').tap();assert audit(p)['quest']['lunch'];p.screenshot(path=str(SHOTS/f'phone-{width}.png'))
            assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
            p.locator('.area-exit').tap();p.clock.run_for(2450);assert audit(p)['mode'] is None
            context.close()
        browser.close()
    assert not errors,errors
    assert not failures,failures
    print(json.dumps({'result':'passed','checks':(['touch entrance access','phone walking and room actions','return to cycling','390x844 and 844x390','no JS or HTTP failures'] if '--phones-only' in sys.argv else ['animated on-foot entry','baby front carrier','keyboard and touch walking','room actions','cycling freeze/resume','boat requirements and repair','all three lake buoys and return','garden quest','saved progress','eight entry points','390x844 and 844x390','no JS or HTTP failures'])},indent=2))
finally:server.shutdown()
