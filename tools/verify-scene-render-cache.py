"""Verify exact scene-cache pixels and cooperative missing-cache recovery."""
import functools,json,time
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'screenshots'/'revision19';out.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
result={}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox']);p=b.new_page();p.goto(f'http://127.0.0.1:{server.server_port}/assets/cache/')
  result['pixels']=p.evaluate(r'''async()=>{
   const manifest=await(await fetch('scene-manifest-v19.json')).json(),load=async file=>{const im=new Image();im.src='/'+file;await im.decode();return im;},make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},results=[];
   const noise=(n,s=0)=>{const v=Math.sin(n*127.1+s*311.7)*43758.5453;return v-Math.floor(v);};
   for(const [file,info]of Object.entries(manifest.textures)){
    const expected=make(info.width,info.height),g=expected.getContext('2d',{willReadFrequently:true});
    if(info.kind==='atlas'){const im=await load(info.source),raw=make(im.naturalWidth,im.naturalHeight),r=raw.getContext('2d',{willReadFrequently:true});r.drawImage(im,0,0);const data=r.getImageData(0,0,raw.width,raw.height);for(let i=3;i<data.data.length;i+=4)if(data.data[i]<25)data.data[i]=0;r.putImageData(data,0,0);g.drawImage(raw,0,0,expected.width,expected.height);}
    else if(info.kind==='tree'){g.filter=info.filter;g.drawImage(await load(info.source),0,0,expected.width,expected.height);}
    else {g.fillStyle=info.base;g.fillRect(0,0,256,256);for(let i=0;i<info.count;i++){g.fillStyle=info.palette[i%info.palette.length];g.fillRect(noise(i,3)*256,noise(i,7)*256,noise(i,5)*2.4+.4,noise(i,6)*1.2+.4);}}
    const actual=make(info.width,info.height),a=actual.getContext('2d',{willReadFrequently:true});a.drawImage(await load(file),0,0);const ep=g.getImageData(0,0,info.width,info.height).data,ap=a.getImageData(0,0,info.width,info.height).data;let mismatches=0,max=0;for(let i=0;i<ep.length;i++){const error=Math.abs(ep[i]-ap[i]);if(error)mismatches++;max=Math.max(max,error);}results.push({file,width:info.width,height:info.height,mismatches,maxError:max});
   }return results;
  }''')
  assert all(x['mismatches']==0 for x in result['pixels']),result['pixels'];p.close()
  p=b.new_page();p.goto(f'http://127.0.0.1:{server.server_port}/assets/cache/');p.set_content(f'<base href="http://127.0.0.1:{server.server_port}/">');p.add_script_tag(url='/js/illustrated-atlas.js');p.add_script_tag(url='/js/illustrated-world.js');p.evaluate('async()=>{await Promise.all([BearlyAtlas.loaded,BearlyWorld.loaded,BearlyWorld.prepareFor(210)])}');result['normal']=p.evaluate('({atlas:BearlyAtlas.audit(),world:BearlyWorld.audit()})');assert result['normal']['atlas']['cached']==6 and result['normal']['world']['treesCached']==3 and result['normal']['world']['tilesCached']==4,result['normal'];assert result['normal']['world']['requestedImages']==['assets/v57_pano_homes.webp','assets/art/autumn-verge.png'],result['normal'];p.evaluate('async()=>{await BearlyWorld.prepareAll()}');assert p.evaluate('Object.values(BearlyWorld.ready()).every(Boolean)');p.close()
  p=b.new_page();p.route('**/assets/cache/*.png',lambda r:r.abort());p.goto(f'http://127.0.0.1:{server.server_port}/assets/cache/');p.set_content(f'<base href="http://127.0.0.1:{server.server_port}/"><button id="probe">Probe</button>');p.evaluate("window.__tasks=[];new PerformanceObserver(l=>__tasks.push(...l.getEntries().map(e=>e.duration))).observe({entryTypes:['longtask']});document.querySelector('#probe').onclick=()=>window.__clicked=true")
  p.add_script_tag(url=f'http://127.0.0.1:{server.server_port}/js/illustrated-atlas.js');p.add_script_tag(url=f'http://127.0.0.1:{server.server_port}/js/illustrated-world.js');start=time.monotonic();p.locator('#probe').click();click=(time.monotonic()-start)*1000;p.evaluate('async()=>{await Promise.all([BearlyAtlas.loaded,BearlyWorld.loaded])}');result['fallback']=p.evaluate('({atlas:BearlyAtlas.audit(),world:BearlyWorld.audit(),longTasks:__tasks,clicked:__clicked})');result['fallback']['clickMs']=click;assert result['fallback']['clicked'] and result['fallback']['atlas']['fallback']==6 and result['fallback']['world']['fallback']==7,result['fallback'];assert not result['fallback']['atlas']['errors'] and not result['fallback']['world']['errors'],result['fallback'];p.close();b.close()
 result['result']='passed';(out/'scene-cache-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:server.shutdown()
