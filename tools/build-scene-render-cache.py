"""Compile immutable scene renderer outputs; original artwork remains untouched.

Run from the repository with Playwright Chromium installed. The browser performs
exactly the existing alpha cleanup, downscale, color filters and texture strokes;
Python only stores the lossless PNG bytes and hashes their source dependencies.
"""
import base64
import functools
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'cache'
ATLAS = {'centrum':'centrum-buildings-v5.png','neighbourhood':'neighbourhood-buildings-v5.png','hazards':'painted-hazards-v5.png','residents':'residents-v5.png','castle':'slott-manor-v5.png','shops':'workshop-pizzeria-v6.png'}
TILES = [
    ['road','#79766b',12500,['#cec0a31f','#161f1c19','#e9dabb16','#383c351d']],
    ['wood','#6f7150',4500,['#f4d3911d','#252f2428','#b7ab7130']],
    ['grass','#647447',6500,['#d4ac5b40','#263c2930','#b6b05d40']],
    ['paving','#a39b83',5500,['#f0dfbc20','#3a392d1c','#e1cb9c22']],
]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args): pass

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    manifest={'format':1,'revision':19,'producer':'tools/build-scene-render-cache.py','sources':{},'textures':{}}
    for name in [*ATLAS.values(),'autumn-tree.png']:
        path=ROOT/'assets'/'art'/name
        manifest['sources'][str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
            page=browser.new_page()
            page.goto(f'http://127.0.0.1:{server.server_port}/assets/cache/')
            outputs=page.evaluate(r'''async ({atlas,tiles})=>{
              const out=[],canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
              async function image(file){const im=new Image();im.src='../../assets/art/'+file;await im.decode();return im;}
              function record(name,c,detail){out.push({name,width:c.width,height:c.height,png:c.toDataURL('image/png').split(',')[1],...detail});}
              for(const [id,file] of Object.entries(atlas)){
                const im=await image(file),raw=canvas(im.naturalWidth,im.naturalHeight),g=raw.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
                const data=g.getImageData(0,0,raw.width,raw.height);for(let i=3;i<data.data.length;i+=4)if(data.data[i]<25)data.data[i]=0;g.putImageData(data,0,0);
                const scale=(id==='hazards'||id==='residents')?0.5:1;let result=raw;
                if(scale<1){result=canvas(raw.width*scale,raw.height*scale);result.getContext('2d').drawImage(raw,0,0,result.width,result.height);}
                record('scene-v19-'+id+'.png',result,{kind:'atlas',id,scale,source:'assets/art/'+file,alphaThreshold:25});
              }
              const tree=await image('autumn-tree.png'),scale=Math.min(1,700/tree.naturalHeight);
              for(let variant=0;variant<3;variant++){
                const c=canvas(tree.naturalWidth*scale,tree.naturalHeight*scale),g=c.getContext('2d');g.filter=variant===1?'saturate(.84) hue-rotate(-12deg)':variant===2?'saturate(1.1) hue-rotate(7deg)':'none';g.drawImage(tree,0,0,c.width,c.height);
                record('tree-v19-'+variant+'.png',c,{kind:'tree',variant,source:'assets/art/autumn-tree.png',sourceWidth:tree.naturalWidth,sourceHeight:tree.naturalHeight,filter:g.filter});
              }
              const noise=(n,s=0)=>{const v=Math.sin(n*127.1+s*311.7)*43758.5453;return v-Math.floor(v);};
              for(const [name,base,count,palette]of tiles){const c=canvas(256,256),g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,256,256);
                for(let i=0;i<count;i++){g.fillStyle=palette[i%palette.length];const x=noise(i,3)*256,y=noise(i,7)*256;g.fillRect(x,y,noise(i,5)*2.4+.4,noise(i,6)*1.2+.4);}
                record('tile-v19-'+name+'.png',c,{kind:'tile',id:name,count,base,palette});
              }
              return out;
            }''',{'atlas':ATLAS,'tiles':TILES})
            browser.close()
        for item in outputs:
            content=base64.b64decode(item.pop('png'));name=item.pop('name');path=OUT/name;path.write_bytes(content)
            manifest['textures']['assets/cache/'+name]={**item,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()}
        target=OUT/'scene-manifest-v19.json';target.write_text(json.dumps(manifest,indent=2)+'\n')
        print(json.dumps({'result':'compiled','textures':len(outputs),'bytes':sum(x['bytes'] for x in manifest['textures'].values()),'manifest':str(target.relative_to(ROOT))}))
    finally:
        server.shutdown();server.server_close()
if __name__=='__main__':main()
