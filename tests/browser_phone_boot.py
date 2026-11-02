"""A network wait must not classify a fast touch device as CPU-limited."""
import hashlib
import json
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'screenshots/revision20'


def main():
    delayed, errors, failures = [], [], []

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT), **kwargs)

        def log_message(self, *args):
            pass

        def do_GET(self):
            if self.path.split('?')[0].endswith('/bear_pose_pedal.png'):
                delayed.append(self.path)
                time.sleep(1)
            super().do_GET()

    frozen = hashlib.sha256((ROOT / 'js/game.js').read_bytes()).hexdigest()
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 390, 'height': 844},
                                          is_mobile=True, has_touch=True)
            page = context.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('response', lambda r: failures.append([r.status, r.url]) if r.status >= 400 else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/autumn-v20.html', wait_until='domcontentloaded')
            page.locator('#introStart').tap()
            page.wait_for_function('window.BEARLY_STARTUP?.().ready&&BEARLY_STARTUP().firstFrameAt!==null', timeout=60000)
            startup = page.evaluate('BEARLY_STARTUP()')
            resource = page.evaluate("performance.getEntriesByType('resource').find(r=>r.name.endsWith('/bear_pose_pedal.png'))?.toJSON()")
            assert page.evaluate("matchMedia('(pointer: coarse)').matches")
            assert delayed and resource and resource['duration'] >= 950, (delayed, resource)
            assert startup['setupCpuMs'] <= 30 and startup['renderScale'] == 1, startup
            assert not errors and not failures, (errors, failures)
            assert hashlib.sha256((ROOT / 'js/game.js').read_bytes()).hexdigest() == frozen
            OUT.mkdir(exist_ok=True)
            result = {'result': 'passed', 'scenario': 'Native CPU, coarse pointer, delayed critical image',
                      'startup': startup, 'delayedResource': resource, 'gameSHA256': frozen,
                      'pageErrors': errors, 'httpFailures': failures}
            (OUT / 'fast-phone-delayed-network-evidence.json').write_text(json.dumps(result, indent=2) + '\n')
            print(json.dumps({'result': 'passed', 'setupCpuMs': startup['setupCpuMs'],
                              'renderScale': startup['renderScale'], 'networkDelayMs': resource['duration']}))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
