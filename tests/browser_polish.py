"""Transition, fullscreen and readable V12 debug menu checks."""
import functools
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];SHOTS=ROOT/'screenshots'/'revision14';errors=[];failures=[]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/autumn-v14.html'
def luminance(rgb):
    values=[float(n)/255 for n in rgb.removeprefix('rgb(').removesuffix(')').split(',')]
    vals=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values]
    return sum(a*b for a,b in zip(vals,[.2126,.7152,.0722]))
try:
    with sync_playwright() as pw:
        b=pw.chromium.launch(headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1000});p.clock.install()
        p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:failures.append(r.url) if r.status>=400 else None)
        p.goto(base);p.wait_for_function('BearlyVisits.audit().artReady && BearlyAtlas.ready()');p.clock.pause_at(p.evaluate('Date.now()+1000')/1000);p.click('#introStart');p.clock.run_for(100)
        p.click('#fullscreenBtn');p.wait_for_function('BearlyFullscreen.state() !== "window"');assert p.locator('.fullscreen-tools').is_visible()
        p.locator('.fullscreen-settings').click();p.clock.run_for(50);assert p.locator('#debugPanel').is_visible()
        for selector in ['#debugPanel h3','#debugPanel .dbg-toggles label','#debugPanel .dbg-readout','#debugPanel .dbg-content button','#debugPanel .dbg-help']:
            colors=p.locator(selector).first.evaluate('(e)=>{const s=getComputedStyle(e);return [s.color,s.backgroundColor]}')
            if colors[1]=='rgba(0, 0, 0, 0)':colors[1]='rgb(245, 235, 207)'
            a,c=sorted(map(luminance,colors));assert (c+.05)/(a+.05)>=4.5,(selector,colors)
        assert 'V12' in p.locator('#debugPanel h2').inner_text()
        assert p.locator('[data-dbg-place]').count()==5
        p.screenshot(path=str(SHOTS/'debug-fullscreen.png'))
        p.keyboard.press('Escape');assert not p.locator('#debugPanel').is_visible()
        p.locator('.fullscreen-exit').click();p.wait_for_function('BearlyFullscreen.state() === "window"')
        # Preview uses the real dismount, and Settings holds the animation in place.
        p.click('#debugOpenBtn');p.click('#debugEntryBtn');p.clock.run_for(450)
        assert p.evaluate('BearlyVisits.audit().transition')=='dismount'
        ride=p.evaluate('BEARLY_TOUCH_STATUS().x')
        p.screenshot(path=str(SHOTS/'dismount-step.png'))
        p.clock.run_for(850);p.screenshot(path=str(SHOTS/'dismount-carrier.png'))
        p.keyboard.press('F3');phase=p.evaluate('BearlyVisits.audit().phase');p.clock.run_for(500);assert p.evaluate('BearlyVisits.audit().phase')==phase
        assert p.locator('#debugPanel').is_visible(),(p.evaluate('BearlyVisits.audit()'),p.locator('#debugReadout').inner_text());assert 'dismount' in p.locator('#debugReadout').inner_text(),(p.evaluate('BearlyVisits.audit()'),p.locator('#debugReadout').inner_text())
        p.keyboard.press('F3');p.clock.run_for(2200);assert p.evaluate('BearlyVisits.audit().mode')=='room'
        assert p.evaluate('BEARLY_TOUCH_STATUS().x')==ride
        p.locator('.area-fullscreen').click();p.wait_for_function('BearlyFullscreen.state() !== "window"')
        p.locator('.fullscreen-settings').click();assert p.locator('#debugPanel').is_visible();p.keyboard.press('Escape')
        p.locator('.fullscreen-exit').click();p.wait_for_function('BearlyFullscreen.state() === "window"')
        p.keyboard.press('Escape');p.clock.run_for(1200);assert p.evaluate('BearlyVisits.audit().transition')=='mount';assert p.evaluate('BEARLY_TOUCH_STATUS().x')==ride
        p.screenshot(path=str(SHOTS/'remount.png'));p.clock.run_for(2100);assert p.evaluate('BearlyVisits.audit().mode') is None
        b.close()
        # Explicitly simulate a browser without native fullscreen (e.g. older phone support).
    with sync_playwright() as pw:
        b=pw.chromium.launch(headless=True,args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        p=ctx.new_page();p.clock.install();p.on('pageerror',lambda e:errors.append(str(e)))
        p.add_init_script('Element.prototype.requestFullscreen=undefined');p.goto(base);p.wait_for_function('BearlyVisits.audit().artReady');p.click('#introStart');p.clock.run_for(80)
        p.locator('#fullscreenBtn').tap();assert p.evaluate('BearlyFullscreen.state()')=='viewport';assert p.locator('.fullscreen-tools').is_visible()
        p.locator('.fullscreen-settings').tap();assert p.locator('#debugPanel').is_visible();p.screenshot(path=str(SHOTS/'debug-phone.png'))
        p.locator('#debugCloseBtn').tap();p.locator('.fullscreen-exit').tap();assert p.evaluate('BearlyFullscreen.state()')=='window'
        assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
        b.close()
    assert not errors,errors
    assert not failures,failures
    print('Polish checks passed: native fullscreen, phone viewport fallback/exit, accessible settings in fullscreen, text contrast, V12 locations/readout, dismount/remount, animation hold, exact bicycle preservation.')
finally:server.shutdown()
