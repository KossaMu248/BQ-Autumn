"""Rendered leg-chain continuity, source ownership and planted-contact checks.

These are renderer probes, not performance measurements. They inspect the
painted joint audit and actual alpha image, retain source hashes, and include
negative controls for the defects that geometry-only gait tests missed. A
passing ledger still requires review of the phase boards and actual game clip.
"""
import argparse
import base64
import functools
import hashlib
import json
import subprocess
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'screenshots' / 'revision20'
BASELINE = 'da109213fdf24947c2ac0b85de900214cc72e44f'


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def hashes(directory, only=None, baseline=False):
    names = []
    if only != 'npc':
        names.extend(['locomotion', 'baby-passenger', 'hero-rig'])
    if only != 'bear':
        names.extend(['illustrated-kids', 'npc-motion'])
    files = [directory / 'js' / f'{name}.js' for name in names]
    if only != 'npc':
        files.extend(directory / 'assets' / 'art' / name for name in [
            'bear-idle-lower-v18.png', 'front-carrier-v7.png', 'back-carrier-v11.png'])
    if only != 'bear':
        # Cached pixels are the actual submitted walker, not just an optional
        # optimization. Freeze their bytes as well as the renderer source.
        version = 'v19' if baseline else 'v20'
        files.extend(path for path in (directory / 'assets' / 'cache').rglob('*')
                     if path.is_file() and version in str(path.relative_to(directory / 'assets' / 'cache')))
    return {str(p.relative_to(directory)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in files}


def baseline_directory(target):
    # Source stays isolated while artists/riggers work in the shared checkout.
    for name in subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASELINE], cwd=ROOT, text=True).splitlines():
        if name.startswith(('js/', 'css/')) or name.endswith('.html') and '/' not in name:
            path = target / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(subprocess.check_output(['git', 'show', f'{BASELINE}:{name}'], cwd=ROOT))
    (target / 'assets').symlink_to(ROOT / 'assets', target_is_directory=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', action='store_true', help='prove the new anatomy guards reject original V19')
    parser.add_argument('--only', choices=['bear', 'npc'])
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    errors, failures = [], []
    with tempfile.TemporaryDirectory(prefix='autumn-anatomy-') as temporary:
        directory = ROOT
        entry = 'autumn-v20.html'
        if args.baseline:
            directory = Path(temporary)
            baseline_directory(directory)
            entry = 'autumn-v19.html'
        before = hashes(directory, args.only, args.baseline)
        server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(directory)))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
                page = browser.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('response', lambda response: failures.append([response.status, response.url]) if response.status >= 400 else None)
                # Renderer-only fixture avoids the live game RAF and unrelated
                # source changes while one rig is being reviewed independently.
                names = [name.removeprefix('js/') for name in before if name.startswith('js/')]
                fixture = ''.join(f'<script src="js/{name}"></script>' for name in names)
                page.route('**/anatomy-fixture.html', lambda route: route.fulfill(body=fixture, content_type='text/html'))
                page.goto(f'http://127.0.0.1:{server.server_port}/anatomy-fixture.html')
                if args.only != 'npc':
                    page.wait_for_function('window.BearlyHeroRig&&window.BearlyBabyPassenger')
                    page.evaluate('BearlyHeroRig.preload()')
                    page.wait_for_function('BearlyHeroRig.ready()', timeout=90000)
                    page.evaluate('BearlyHeroRig.warmupSources()')
                if args.only != 'bear':
                    page.wait_for_function('window.BearlyNpcMotion&&BearlyNpcMotion.ready()', timeout=180000)
                    page.evaluate('BearlyNpcMotion.preloadAll()')
                    page.wait_for_function('BearlyNpcMotion.cacheStats().complete', timeout=180000)
                result = page.evaluate((ROOT / 'tests' / 'anatomy-probe.js').read_text(), {'only': args.only})
                for board in result.pop('boards'):
                    filename = f"{'baseline-' if args.baseline else ''}anatomy-{board['name']}.png"
                    (OUT / filename).write_bytes(base64.b64decode(board['png'].split(',', 1)[1]))
                browser.close()
            result.update({'entry': entry, 'baseline': args.baseline,
                           'baselineCommit': BASELINE if args.baseline else None,
                           'sourceSHA256': before, 'pageErrors': errors, 'httpFailures': failures,
                           'limits': {'segmentLengthSpan': .05, 'shoeLengthSpan': .02,
                                      'interiorStanceDriftHeights': .04,
                                      'adjacentJointStepHeights': .12,
                                      'upperSilhouetteRangeHeights': .055,
                                      'walkingToRawIdleOpaqueHeightRatio': [.9,1.1]},
                           'measurement': 'manually posed native renderer; no performance claim; visual review required'})
            result['result'] = 'expected-regression' if args.baseline and result['faults'] else 'failed' if result['faults'] else 'passed'
            target = OUT / f"{'baseline-' if args.baseline else ''}anatomy-evidence{('-'+args.only) if args.only else ''}.json"
            target.write_text(json.dumps(result, indent=2) + '\n')
            print(json.dumps({'result': result['result'], 'families': len(result['families']),
                              'negativeControls': result['negativeControls'],
                              'faultCount': len(result['faults']),
                              'faults': [{'label': f['label'], 'issue': f['issue']}
                                         for f in result['faults'][:30]]}))
            assert not errors, errors
            assert not failures, failures
            assert before == hashes(directory, args.only, args.baseline), 'Renderer source changed during anatomy probe'
            if args.baseline:
                assert result['faults'], 'The original defective V19 walk escaped the anatomy guards'
            else:
                assert not result['faults'], result['faults']
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
