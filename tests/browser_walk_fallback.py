"""Missing walking packs must finish on a browser with no worker/idle budget.

This checks cooperative fallback liveness and bounded output. It is not a
performance benchmark or a replacement for visual anatomy review.
"""
import functools
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'screenshots' / 'revision20'


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def hashes():
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in ROOT.glob('js/*.js')}


def main():
    OUT.mkdir(exist_ok=True)
    frozen = hashes()
    server = ThreadingHTTPServer(('127.0.0.1', 0),
                                functools.partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    errors, unexpected, missing = [], [], []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
            page = browser.new_page()
            page.add_init_script("""
                window.Worker = undefined;
                window.OffscreenCanvas = undefined;
                window.requestIdleCallback = callback => setTimeout(() =>
                    callback({didTimeout:false,timeRemaining:()=>0}), 0);
                window.cancelIdleCallback = clearTimeout;
            """)
            page.on('pageerror', lambda e: errors.append(str(e)))

            def block_pack(route):
                missing.append(route.request.url)
                route.fulfill(status=404, body='Intentional missing walking pack')

            page.route('**/assets/cache/npc-walk-*-v20.png', block_pack)
            page.on('response', lambda r: unexpected.append([r.status, r.url])
                    if r.status >= 400 and not ('/npc-walk-' in r.url and '-v20.png' in r.url) else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/autumn-v20.html',
                      wait_until='domcontentloaded')
            page.wait_for_function('window.BearlyNpcMotion?.ready()', timeout=60000)
            page.evaluate('BearlyNpcMotion.preloadAll()')
            page.wait_for_function('BearlyNpcMotion.cacheStats().complete', timeout=120000)
            cache = page.evaluate('BearlyNpcMotion.cacheStats()')
            assert len(set(missing)) == 12, missing
            assert cache['frameCount'] == cache['capacity'] == 576, cache
            assert cache['bytes'] <= cache['limitBytes'] == 48 * 1024 * 1024, cache
            assert all(v['frames'] == 48 for v in cache['variants']), cache
            rendered = page.evaluate("""() => {
                const canvas=document.createElement('canvas');canvas.width=420;canvas.height=370;
                const c=canvas.getContext('2d',{willReadFrequently:true}),rows=[];
                for(let variant=0;variant<12;variant++){
                    c.clearRect(0,0,420,370);
                    BearlyNpcMotion.draw(c,{variant,state:'idle',hp:100,moving:true,
                        activity:'walk',distance:0,face:1},210,330,145);
                    const audit=BearlyNpcMotion.audit(),pixels=c.getImageData(0,0,420,370).data;
                    let ink=0;for(let i=3;i<pixels.length;i+=4)ink+=pixels[i]>=140;
                    rows.push({variant,cached:audit.details?.cached,
                        anatomical:audit.details?.anatomicalChain,ink});
                }
                return rows;
            }""")
            assert all(r['cached'] and r['anatomical'] and r['ink'] > 500 for r in rendered), rendered
            assert not errors, errors
            assert not unexpected, unexpected
            assert frozen == hashes(), 'Production scripts changed during fallback check'
            result = {'result': 'passed', 'entry': 'autumn-v20.html',
                      'scenario': 'All walking packs missing; no Worker/OffscreenCanvas; zero idle budget',
                      'sourceSHA256': frozen, 'missingPacks': sorted(set(missing)),
                      'cache': cache, 'rendered': rendered,
                      'pageErrors': errors, 'unexpectedHttpFailures': unexpected}
            (OUT / 'walk-fallback-evidence.json').write_text(json.dumps(result, indent=2) + '\n')
            print(json.dumps({'result': 'passed', 'frames': cache['frameCount'],
                              'bytes': cache['bytes'], 'renderedIdentities': len(rendered)}))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
