"""Run with python3 tests/browser_v6.py (requires Playwright Chromium)."""
import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / 'screenshots' / 'revision6'
SHOTS.mkdir(parents=True, exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
errors, failures = [], []

def watch(page):
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failures.append([response.status, response.url]) if response.status >= 400 else None)

def ready(page, entry='autumn-v6.html'):
    page.goto(f'{base}/{entry}')
    page.wait_for_function('window.BearlyAtlas?.ready() && Object.values(BearlyWorld.ready()).every(Boolean)')
    page.click('#introStart')
    page.wait_for_function('window.BEARLY_TOUCH_STATUS().state === "playing"')
    page.evaluate('BEARLY_DEBUG_MENU.settings.godMode=true')

def warp(page, x):
    page.evaluate('(x)=>BEARLY_DEBUG_MENU.warp(x/1.5)', x)
    page.wait_for_timeout(75)

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1440, 'height':1000})
        watch(page)
        ready(page)
        scenes = page.evaluate('BearlyNeighbourhood.scenes')
        assert len(scenes) == 12 and len({s['key'] for s in scenes}) == 12
        for role in ['metro','library','cafe']:
            assert sum(s['role'] == role for s in scenes) == 1
        for scene in scenes:
            warp(page, scene['x'])
            assert page.evaluate('BearlyNeighbourhood.audit().scenes') >= 1
            if scene['key'] in ['apartment','workshop','pizzeria','library','cafe','greenhouse','boathouse']:
                page.screenshot(path=str(SHOTS / f"{scene['key']}.png"))
            if scene['key'] == 'pizzeria':
                page.keyboard.press('e')
                page.wait_for_function('BearlyVisits.active() && document.querySelector(".visit-art img")?.naturalWidth>0')
                before = page.evaluate('({ride:BEARLY_TOUCH_STATUS(),npc:BearlyNeighbourhood.audit().residentTime})')
                page.keyboard.press('r')  # Gameplay shortcuts must not leak through the modal.
                page.wait_for_timeout(700)
                after = page.evaluate('({ride:BEARLY_TOUCH_STATUS(),npc:BearlyNeighbourhood.audit().residentTime})')
                assert before == after, 'Ride, held controls and NPC clock must freeze during visits'
                assert page.evaluate('document.activeElement.closest("dialog") !== null')
                page.screenshot(path=str(SHOTS / 'pizza-interior.png'))
                page.keyboard.press('Escape')
                assert not page.evaluate('BearlyVisits.active()')
                x = page.evaluate('BEARLY_TOUCH_STATUS().x')
                page.keyboard.down('ArrowUp');page.wait_for_timeout(550);page.keyboard.up('ArrowUp')
                assert page.evaluate('BEARLY_TOUCH_STATUS().x') > x + 10, 'Ride resumes after leaving'
        warp(page, 1500)
        assert not page.locator('.visit-prompt').is_visible(), 'Homes remain private'
        page.keyboard.down('ArrowUp');page.wait_for_timeout(550);page.keyboard.up('ArrowUp')
        assert page.evaluate('BEARLY_TOUCH_STATUS().speed') > 20
        page.keyboard.press('Space');page.wait_for_timeout(80)
        assert not page.evaluate('BEARLY_TOUCH_STATUS().contact'), 'Hop still works'
        page.keyboard.press('r');page.wait_for_timeout(80)
        assert page.evaluate('BEARLY_TOUCH_STATUS().x') < 400, 'Restart still works'
        for entry in ['index.html','autumn-v3.html','autumn-v4.html','autumn-v5.html']:
            ready(page, entry)
            assert page.evaluate('BEARLY_BUILD_ID') == 'AUTUMN_RIDE_ART_V6'
        page.close()
        for width,height in [(390,844),(844,390)]:
            context = browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,device_scale_factor=1)
            mobile = context.new_page();watch(mobile);ready(mobile)
            warp(mobile,15700)
            mobile.locator('.visit-prompt').tap()
            mobile.wait_for_function('BearlyVisits.active() && document.querySelector(".visit-art img")?.naturalWidth>0')
            mobile.screenshot(path=str(SHOTS / f'pizza-interior-{width}.png'))
            mobile.locator('.visit-room button').tap()
            assert not mobile.evaluate('BearlyVisits.active()')
            assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'No horizontal overflow'
            warp(mobile,1500)
            pedal=mobile.locator('.touch-controls button[data-key="ArrowUp"]').bounding_box()
            assert pedal
            cdp=context.new_cdp_session(mobile)
            before=mobile.evaluate('BEARLY_TOUCH_STATUS().x')
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':pedal['x']+pedal['width']/2,'y':pedal['y']+pedal['height']/2}]})
            mobile.wait_for_timeout(550)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            assert mobile.evaluate('BEARLY_TOUCH_STATUS().x') > before+10, 'Touch pedal advances bike'
            mobile.screenshot(path=str(SHOTS / f'ride-{width}.png'))
            context.close()
        reduced=browser.new_context(reduced_motion='reduce');page=reduced.new_page();watch(page);ready(page);warp(page,17700)
        before=page.evaluate('BearlyNeighbourhood.audit().residentsOnRoute')
        page.wait_for_timeout(450)
        after=page.evaluate('BearlyNeighbourhood.audit().residentsOnRoute')
        assert before == after, 'Reduced motion keeps NPCs still'
        assert page.evaluate('BearlyNeighbourhood.audit().scattered') == 0
        browser.close()
    assert not errors, errors
    assert not failures, failures
    print(json.dumps({'result':'passed','scenes':12,'entry_points':5,'mobile_viewports':['390x844','844x390'],'checks':['entry/exit','freeze/resume','keyboard controls','touch pedal','reduced motion','no page errors or failed HTTP responses']},indent=2))
finally:
    server.shutdown()
