"""Build or verify V20 walking packs from the actual anatomical renderer.

Original source packs stay V19. Walking bounds are measured across every phase,
then one shared canonical size is selected within the 48 MiB RGBA limit.
Requires Playwright Chromium; no source artwork is edited.
"""
import argparse
import base64
import functools
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'assets/cache'
MANIFEST = CACHE / 'npc-walk-v20-manifest.json'
LIMIT = 48 * 1024 * 1024


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


BUILD = r"""async () => {
    const {profiles,rig,get}=__walkCompiler, phases=48, limit=48*1024*1024;
    const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
    const scratch=make(512,512),s=scratch.getContext('2d',{willReadFrequently:true});
    let height=144,layouts;
    const tick=()=>new Promise(r=>setTimeout(r,0));
    while(true){
        layouts=[];
        for(let variant=0;variant<12;variant++){
            const frame=get(variant,'walkA');let left=512,top=512,right=-1,bottom=-1;
            for(let index=0;index<=phases;index++){
                s.setTransform(1,0,0,1,0,0);s.clearRect(0,0,512,512);s.translate(256,420);
                rig(s,frame,index===phases?0:index/phases,height,frame.sourceFace,index===phases?0:1);
                const rgba=s.getImageData(0,0,512,512).data;
                for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(rgba[(y*512+x)*4+3]){
                    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
                }
                if(index%8===7)await tick();
            }
            if(right<left||left<2||right>509||top<2||bottom>509)throw Error('Unbounded or missing walking figure '+variant);
            left-=258;right-=254;top-=422;bottom-=418;
            layouts.push({variant,width:right-left+1,height:bottom-top+1,x:-left,y:-top});
        }
        const bytes=layouts.reduce((sum,b)=>sum+b.width*b.height*4*(phases+1),0);
        if(bytes<=limit)break;
        height-=16;if(height<80)throw Error('Walking bounds cannot fit memory limit');
    }
    const outputs=[],walks=[],hash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');
    for(const layout of layouts){
        const frame=get(layout.variant,'walkA'),tile=make(layout.width,layout.height),t=tile.getContext('2d',{willReadFrequently:true});
        const pack=make(layout.width*8,layout.height*6),g=pack.getContext('2d'),frames=[];
        for(let index=0;index<phases;index++){
            t.setTransform(1,0,0,1,0,0);t.clearRect(0,0,tile.width,tile.height);t.translate(layout.x,layout.y);
            const details=rig(t,frame,index/phases,height,frame.sourceFace),pixels=t.getImageData(0,0,tile.width,tile.height);
            g.putImageData(pixels,(index%8)*layout.width,Math.floor(index/8)*layout.height);
            frames.push({index,details,pixelSHA256:await hash(pixels.data)});
            if(index%8===7)await tick();
        }
        const name=`npc-walk-${layout.variant}-v20.png`;
        outputs.push({name,data:pack.toDataURL('image/png')});
        walks.push({...layout,file:'assets/cache/'+name,columns:8,frames});
    }
    const cellW=Math.max(...layouts.map(b=>b.width)),cellH=Math.max(...layouts.map(b=>b.height)),idle=make(cellW*4,cellH*3),ig=idle.getContext('2d'),neutral=[];
    for(const layout of layouts){
        const frame=get(layout.variant,'walkA'),tile=make(layout.width,layout.height),g=tile.getContext('2d',{willReadFrequently:true});g.translate(layout.x,layout.y);
        const details=rig(g,frame,0,height,frame.sourceFace,0),pixels=g.getImageData(0,0,layout.width,layout.height),x=layout.variant%4*cellW,y=Math.floor(layout.variant/4)*cellH;
        ig.putImageData(pixels,x,y);neutral.push({variant:layout.variant,cacheRect:[x,y,layout.width,layout.height],x:layout.x,y:layout.y,details,pixelSHA256:await hash(pixels.data)});await tick();
    }
    outputs.push({name:'npc-idle-v20.png',data:idle.toDataURL('image/png')});
    const neutralRgbaBytes=layouts.reduce((sum,b)=>sum+b.width*b.height*4,0),walkingRgbaBytes=neutralRgbaBytes*phases;
    return {manifest:{format:1,version:'v20',canonicalHeight:height,phaseCount:phases,
        limitBytes:limit,rgbaBytes:walkingRgbaBytes+neutralRgbaBytes,walkingRgbaBytes,neutralRgbaBytes,walks,
        neutral:{file:'assets/cache/npc-idle-v20.png',width:idle.width,height:idle.height,frames:neutral}},outputs};
}"""


VERIFY = r"""async manifest => {
    await BearlyNpcMotion.loaded;
    await BearlyNpcMotion.preloadAll();
    while(!BearlyNpcMotion.cacheStats().complete)await new Promise(r=>setTimeout(r,10));
    const {profiles,rig,get}=__walkCompiler,rows=[],h=manifest.canonicalHeight;
    const make=(w,hh)=>{const c=document.createElement('canvas');c.width=w;c.height=hh;return c;};
    const hash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');
    for(const bank of manifest.walks){
        const direct=make(bank.width,bank.height),cached=make(bank.width,bank.height),a=direct.getContext('2d',{willReadFrequently:true}),b=cached.getContext('2d',{willReadFrequently:true}),frame=get(bank.variant,'walkA');
        let changed=0,maxError=0,edgeInk=0;
        for(let index=0;index<48;index++){
            a.setTransform(1,0,0,1,0,0);a.clearRect(0,0,bank.width,bank.height);a.translate(bank.x,bank.y);
            const details=rig(a,frame,index/48,h,frame.sourceFace),expected=a.getImageData(0,0,bank.width,bank.height).data;
            if(await hash(expected)!==bank.frames[index].pixelSHA256)throw Error('Stale direct phase '+bank.variant+':'+index);
            b.setTransform(1,0,0,1,0,0);b.clearRect(0,0,bank.width,bank.height);
            BearlyNpcMotion.draw(b,{variant:bank.variant,state:'idle',moving:true,activity:'walk',
                face:frame.sourceFace,distance:details.cycleLength*index/48},bank.x,bank.y,h/profiles[bank.variant].heightScale);
            const audit=BearlyNpcMotion.audit(),actual=b.getImageData(0,0,bank.width,bank.height).data;
            if(!audit.details?.cached||audit.details.phaseIndex!==index)throw Error('Wrong cached phase '+bank.variant+':'+index);
            for(let p=0;p<actual.length;p++){const e=Math.abs(expected[p]-actual[p]);changed+=e!==0;maxError=Math.max(maxError,e);}
            for(let y=0;y<bank.height;y++)for(let x=0;x<bank.width;x++)if((x===0||y===0||x===bank.width-1||y===bank.height-1)&&actual[(y*bank.width+x)*4+3])edgeInk++;
        }
        rows.push({variant:bank.variant,phases:48,differentChannels:changed,maxError,edgeInk});
    }
    const neutrals=[];
    for(const info of manifest.neutral.frames){
        const bank=manifest.walks.find(b=>b.variant===info.variant),frame=get(info.variant,'walkA'),direct=make(bank.width,bank.height),cached=make(bank.width,bank.height),a=direct.getContext('2d',{willReadFrequently:true}),b=cached.getContext('2d',{willReadFrequently:true});
        a.translate(bank.x,bank.y);rig(a,frame,0,h,frame.sourceFace,0);const expected=a.getImageData(0,0,bank.width,bank.height).data;
        if(await hash(expected)!==info.pixelSHA256)throw Error('Stale neutral '+info.variant);
        BearlyNpcMotion.draw(b,{variant:info.variant,state:'idle',moving:false,activity:'idle',age:-info.variant/1.8,face:frame.sourceFace},bank.x,bank.y,h/profiles[info.variant].heightScale);
        const audit=BearlyNpcMotion.audit(),actual=b.getImageData(0,0,bank.width,bank.height).data;
        if(!audit.details?.cached||!audit.details.neutral||audit.details.sourcePose!=='walkA')throw Error('Wrong neutral '+info.variant);
        let changed=0,maxError=0,edgeInk=0;for(let p=0;p<actual.length;p++){const e=Math.abs(expected[p]-actual[p]);changed+=e!==0;maxError=Math.max(maxError,e);}
        for(let y=0;y<bank.height;y++)for(let x=0;x<bank.width;x++)if((x===0||y===0||x===bank.width-1||y===bank.height-1)&&actual[(y*bank.width+x)*4+3])edgeInk++;
        neutrals.push({variant:info.variant,differentChannels:changed,maxError,edgeInk});
    }
    return {rows,neutrals,cache:BearlyNpcMotion.cacheStats()};
}"""


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['build', 'verify'])
    args = parser.parse_args()
    frozen = sha(ROOT / 'js/npc-motion.js')
    manifest = None
    if args.action == 'verify':
        manifest = json.loads(MANIFEST.read_text())
        assert manifest['rendererSHA256'] == frozen, 'Renderer changed since walk packs were built'
        for name, expected in manifest['sourceSHA256'].items():
            assert sha(ROOT / name) == expected, name
        for name, expected in manifest['cacheSHA256'].items():
            assert sha(CACHE / name) == expected, name
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    errors, failures = [], []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
            page = browser.new_page()
            if args.action == 'build':
                page.add_init_script('window.__BEARLY_BUILD_WALK_CACHE=true')
            source = (ROOT / 'js/npc-motion.js').read_text().replace(
                'window.BearlyNpcMotion={',
                'window.__walkCompiler={profiles,rig,get};window.BearlyNpcMotion={')
            page.route('**/walk-compiler.html', lambda r: r.fulfill(
                body='<script src="js/npc-motion.js"></script>', content_type='text/html'))
            page.route('**/js/npc-motion.js', lambda r: r.fulfill(body=source, content_type='application/javascript'))
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('response', lambda r: failures.append([r.status, r.url]) if r.status >= 400 else None)
            page.goto(f'http://127.0.0.1:{server.server_port}/walk-compiler.html')
            page.wait_for_function('BearlyNpcMotion.ready()', timeout=120000)
            if args.action == 'build':
                data = page.evaluate(BUILD)
                assert frozen == sha(ROOT / 'js/npc-motion.js'), 'Renderer changed during build'
                manifest = data['manifest']
                for item in data['outputs']:
                    (CACHE / item['name']).write_bytes(base64.b64decode(item['data'].split(',', 1)[1]))
                original = json.loads((CACHE / 'actors-v19-manifest.json').read_text())
                manifest['sourceSHA256'] = {name: expected for name, expected in original['sourceSHA256'].items()
                                            if Path(name).name in {p['source'] for p in original['npcSources']}}
                manifest['cacheSHA256'] = {item['name']: sha(CACHE / item['name']) for item in data['outputs']}
                manifest['rendererSHA256'] = frozen
                MANIFEST.write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
                summary = {'result': 'built', 'identities': 12, 'frames': 576,
                           'canonicalHeight': manifest['canonicalHeight'], 'rgbaBytes': manifest['rgbaBytes']}
            else:
                data = page.evaluate(VERIFY, manifest)
                assert all(r['differentChannels'] == r['edgeInk'] == 0 for r in data['rows'] + data['neutrals']), data
                assert data['cache']['frameCount'] == 576 and data['cache']['neutralCount'] == 12 and data['cache']['bytes'] <= LIMIT, data['cache']
                assert data['cache']['bytes'] == data['cache']['walkingBytes'] + data['cache']['neutralBytes'] == manifest['rgbaBytes']
                assert frozen == sha(ROOT / 'js/npc-motion.js'), 'Renderer changed during verification'
                data.update({'result': 'passed', 'rendererSHA256': frozen,
                             'manifestSHA256': sha(MANIFEST), 'pageErrors': errors, 'httpFailures': failures})
                target = ROOT / 'screenshots/revision20/npc-walk-cache-evidence.json'
                target.parent.mkdir(exist_ok=True)
                target.write_text(json.dumps(data, indent=2) + '\n')
                summary = {'result': 'passed', 'frames': 576, 'differentChannels': 0,
                           'edgeInk': 0, 'neutrals': 12, 'rgbaBytes': data['cache']['bytes']}
            assert not errors, errors
            assert not failures, failures
            browser.close()
            print(json.dumps(summary))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
