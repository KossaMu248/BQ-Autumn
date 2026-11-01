"""V15 cast source coverage, real population continuity and phone controls.

Production draw calls are observed. Independent opaque connected components
check each standing/reaction crop and clip, including adjacent portrait cells.
"""
import argparse
import functools
import hashlib
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ENTRY = "autumn-v15.html"
SHOTS = ROOT / "screenshots" / "revision15"


def source_hashes():
    paths = [ROOT / "js" / "brawler-art.js"]
    for group in "abc":
        paths.extend(ROOT / "assets" / "art" / name for name in [
            f"adult-cast-{group}-v15.png",
            f"cast-reactions-{group}-v15.png",
            f"cast-screen-{group}-v15.png",
        ])
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}

AUDIT = r"""(() => {
  const native=CanvasRenderingContext2D.prototype.drawImage;
  const assets=/^(?:adult-cast-[abc]-v15|cast-(?:reactions|screen)-[abc]-v15)\.png$/;
  window.__wardrobeCalls=[];window.__wardrobeActor=null;
  CanvasRenderingContext2D.prototype.drawImage=function(im,...args){
    const source=(im.src||'').split('/').pop().split('?')[0];
    if(this.canvas.id==='game'&&assets.test(source)&&this.globalAlpha>.01){
      __wardrobeCalls.push({source,args,actor:__wardrobeActor?{...__wardrobeActor}:null});
    }
    return native.call(this,im,...args);
  };
  window.__installWardrobeActorAudit=()=>{
    const adult=BearlyBrawlArt.adult;
    BearlyBrawlArt.adult=function(c,n,...args){
      const previous=__wardrobeActor;__wardrobeActor={id:n.id,variant:n.variant,state:n.state,kind:n.kind||'resident'};
      try{return adult.call(this,c,n,...args);}finally{__wardrobeActor=previous;}
    };
  };
})();"""

PROBES = r"""() => {
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=500;
  const c=canvas.getContext('2d'),native=c.drawImage.bind(c),components=new Map(),coverageCache=new Map();
  const save=c.save.bind(c),restore=c.restore.bind(c),begin=c.beginPath.bind(c),move=c.moveTo.bind(c),line=c.lineTo.bind(c),rect=c.rect.bind(c),close=c.closePath.bind(c),clip=c.clip.bind(c);
  let calls=[],stack=[],active=[],contours=[];
  const world=(x,y)=>{const m=c.getTransform();return{x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};};
  c.save=()=>{stack.push(active.slice());return save();};c.restore=()=>{active=stack.pop()||[];return restore();};
  c.beginPath=()=>{contours=[];return begin();};
  c.moveTo=(x,y)=>{contours.push([world(x,y)]);return move(x,y);};
  c.lineTo=(x,y)=>{if(!contours.length)contours.push([]);contours.at(-1).push(world(x,y));return line(x,y);};
  c.rect=(x,y,w,h)=>{contours.push([[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>world(...p)));return rect(x,y,w,h);};
  c.closePath=()=>close();
  c.clip=(...args)=>{active.push({contours:contours.map(v=>v.map(p=>({...p}))),unsupported:args.some(v=>typeof v!=='string')||!contours.length});return clip(...args);};
  c.drawImage=(im,...args)=>{
    if(im.src){
      const[sx,sy,sw,sh,dx,dy,dw,dh]=args.length===8?args:[0,0,im.naturalWidth,im.naturalHeight,...args];
      const inverse=c.getTransform().inverse();
      calls.push({im,sx,sy,sw,sh,clips:active.map(v=>({unsupported:v.unsupported,contours:v.contours.map(points=>points.map(p=>{
        const x=inverse.a*p.x+inverse.c*p.y+inverse.e,y=inverse.b*p.x+inverse.d*p.y+inverse.f;
        return{x:sx+(x-dx)*sw/dw,y:sy+(y-dy)*sh/dh};
      }))}))});
    }
    return native(im,...args);
  };
  function analyze(im){
    if(components.has(im))return components.get(im);
    const source=document.createElement('canvas');source.width=im.naturalWidth;source.height=im.naturalHeight;
    const g=source.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);
    const pixels=g.getImageData(0,0,source.width,source.height).data,w=source.width,h=source.height,size=w*h;
    const seen=new Uint8Array(size),queue=new Int32Array(size),bodies=[];
    for(let seed=0;seed<size;seed++){
      if(seen[seed]||pixels[seed*4+3]<160)continue;
      let head=0,tail=1,sumX=0,sumY=0;queue[0]=seed;seen[seed]=1;
      while(head<tail){
        const at=queue[head++],x=at%w,y=Math.floor(at/w);sumX+=x;sumY+=y;
        for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
          const xx=x+ox,yy=y+oy;if(xx<0||xx>=w||yy<0||yy>=h)continue;
          const next=yy*w+xx;if(seen[next]||pixels[next*4+3]<160)continue;
          seen[next]=1;queue[tail++]=next;
        }
      }
      if(tail>10000)bodies.push({pixels:queue.slice(0,tail),count:tail,x:sumX/tail,y:sumY/tail});
    }
    const name=im.src.split('/').pop(),reaction=/reactions/.test(name),columns=3,rows=reaction?3:1;
    if(bodies.length!==columns*rows)throw Error('Unexpected separate opaque bodies '+name+': '+bodies.map(b=>b.count));
    bodies.sort((a,b)=>a.y-b.y);
    const ordered=[];for(let row=0;row<rows;row++)ordered.push(...bodies.slice(row*columns,(row+1)*columns).sort((a,b)=>a.x-b.x));
    const value={bodies:ordered,w,name,columns};components.set(im,value);return value;
  }
  function inside(x,y,v){
    if(v.unsupported)return false;let winding=0;
    for(const points of v.contours)for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],cross=(b.x-a.x)*(y-a.y)-(x-a.x)*(b.y-a.y);
      if(a.y<=y&&b.y>y&&cross>0)winding++;else if(a.y>y&&b.y<=y&&cross<0)winding--;
    }return winding!==0;
  }
  function sourceCoverage(draws,variant,pose){
    const a=analyze(draws[0].im),key=JSON.stringify([a.name,variant,pose,draws.map(d=>[d.sx,d.sy,d.sw,d.sh,d.clips.map(v=>[v.unsupported,v.contours.map(ps=>ps.map(p=>[p.x.toFixed(3),p.y.toFixed(3)]))])])]);
    if(coverageCache.has(key))return coverageCache.get(key);
    const index=pose<0?variant%3:(variant%3)*a.columns+pose;
    const counts=a.bodies.map(body=>{
      let count=0;for(const at of body.pixels){const x=at%a.w+.5,y=Math.floor(at/a.w)+.5;
        if(draws.some(d=>x>=d.sx&&x<d.sx+d.sw&&y>=d.sy&&y<d.sy+d.sh&&d.clips.every(v=>inside(x,y,v))))count++;
      }return count;
    });
    const value={source:a.name,coverage:counts[index]/a.bodies[index].count,neighborPixels:counts.reduce((n,v,i)=>n+(i===index?0:v),0),unsupported:draws.some(d=>d.clips.some(v=>v.unsupported))};
    coverageCache.set(key,value);return value;
  }
  const cases=[['idle',{},-1],['walking',{moving:true,distance:47},-1],['held',{state:'held'},-1],['stagger',{state:'stagger',age:.15},0],['falling',{state:'fall',age:.2},1],['fallen',{state:'fall',age:.6},2],['dead',{state:'dead'},2],['rise early',{state:'rise',age:.1},2],['rise late',{state:'rise',age:.3},0]];
  const results=[],faults=[];
  for(let variant=0;variant<9;variant++)for(const[name,patch,pose]of cases)for(const heading of [1,-1])for(const height of [145,90]){
    calls=[];active=[];stack=[];contours=[];c.resetTransform();c.clearRect(0,0,800,500);
    BearlyBrawlArt.adult(c,{id:'probe-'+variant,kind:'resident',variant,state:'idle',age:0,face:heading,mood:'calm',hp:60,...patch},400,400,height);
    const label={variant,name,heading,height};
    if(!calls.length){faults.push({...label,issue:'No painted source draw'});continue;}
    const group=['a','b','c'][Math.floor(variant/3)];
    const expected=pose<0?'adult-cast-'+group+'-v15.png':'cast-reactions-'+group+'-v15.png';
    if(calls.some(d=>!d.im.src.split('?')[0].endsWith('/'+expected)))faults.push({...label,issue:'Wrong outfit source',expected,actual:calls.map(d=>d.im.src)});
    const coverage=sourceCoverage(calls,variant,pose);
    if(coverage.coverage!==1||coverage.neighborPixels!==0||coverage.unsupported)faults.push({...label,...coverage});
    results.push({...label,...coverage});
  }
  return{cases:results.length,minCoverage:Math.min(...results.map(r=>r.coverage)),maxNeighborPixels:Math.max(...results.map(r=>r.neighborPixels)),faults: faults.slice(0,25),faultCount:faults.length};
}"""


WALK_CONNECTIVITY = r"""() => {
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=500;
  const c=canvas.getContext('2d',{willReadFrequently:true}),faults=[],results=[];let negativeControls=0;
  function measure(height){
    const width=height*2+100,h=height+60,data=c.getImageData(250-height,400-height-24,width,h).data;
    const size=width*h,seen=new Uint8Array(size),queue=new Int32Array(size),counts=[];let total=0;
    for(let at=0;at<size;at++)if(data[at*4+3]>=160)total++;
    for(let seed=0;seed<size;seed++){
      if(seen[seed]||data[seed*4+3]<160)continue;
      let head=0,tail=1;queue[0]=seed;seen[seed]=1;
      while(head<tail){
        const at=queue[head++],x=at%width,y=Math.floor(at/width);
        for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
          const xx=x+ox,yy=y+oy;if(xx<0||xx>=width||yy<0||yy>=h)continue;
          const next=yy*width+xx;if(seen[next]||data[next*4+3]<160)continue;
          seen[next]=1;queue[tail++]=next;
        }
      }counts.push(tail);
    }
    return{opaque:total,mainRatio:Math.max(...counts)/total,majorComponents:counts.filter(v=>v>=Math.max(8,total*.02)).length};
  }
  const draw=(variant,heading,height,moving,distance)=>{
    c.resetTransform();c.clearRect(0,0,600,500);
    BearlyBrawlArt.adult(c,{id:'continuity',kind:'resident',variant,state:'idle',face:heading,mood:'calm',moving,distance},300,400,height);
  };
  for(let variant=0;variant<9;variant++)for(const heading of [1,-1])for(const height of [145,90]){
    draw(variant,heading,height,false,0);const idle=measure(height);
    if(idle.majorComponents!==1)throw Error('Authored idle itself contains detached major pieces: '+JSON.stringify({variant,height,heading,idle}));
    for(let phase=0;phase<8;phase++){
      draw(variant,heading,height,true,phase*Math.PI/4*27);const actual=measure(height);
      const label={variant,heading,height,phase,mainRatio:actual.mainRatio,majorComponents:actual.majorComponents,idleRatio:idle.mainRatio};
      if(actual.majorComponents!==1||actual.mainRatio<idle.mainRatio-.01)faults.push(label);
      results.push(label);
    }
    if(variant===0&&heading===1){
      draw(variant,heading,height,false,0);c.clearRect(0,400-height*.3,600,3);
      const broken=measure(height);
      if(broken.majorComponents===1&&broken.mainRatio>=idle.mainRatio-.01)throw Error('Detached-leg connectivity negative control failed');
      negativeControls++;
    }
  }
  return{cases:results.length,minMainBodyRatio:Math.min(...results.map(v=>v.mainRatio)),negativeControls,faultCount:faults.length,faults:faults.slice(0,25)};
}"""


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def expected_standing(variant):
    return "adult-cast-" + "abc"[variant // 3] + "-v15.png"


def verify_actual_calls(page):
    calls = page.evaluate("window.__wardrobeCalls")
    adults = [c for c in calls if c["actor"] and c["actor"]["kind"] != "gangster"]
    assert adults, "Actual game rendered no reactive adults"
    for call in adults:
        assert call["source"] == expected_standing(call["actor"]["variant"]), call
    return {c["actor"]["id"]: {"variant": c["actor"]["variant"], "source": c["source"]} for c in adults}


def approach_actor(page, actor_id):
    """Reach a real patrolling actor with movement keys, without editing its state."""
    pressed = set()
    try:
        for _ in range(100):
            state = page.evaluate("""id => {
              const area=BearlyVisits.audit();
              return{x:area.x,depth:area.depth,npc:area.combat.npcs.find(n=>n.id===id)};
            }""", actor_id)
            target = state["npc"]
            assert target and target["hp"] == 60, state
            dx, dy = target["x"] - state["x"], target["depth"] - state["depth"]
            if abs(dx) < 55 and abs(dy) < 14:
                break
            wanted = set()
            if abs(dx) >= 45:
                wanted.add("ArrowRight" if dx > 0 else "ArrowLeft")
            if abs(dy) >= 10:
                wanted.add("ArrowDown" if dy > 0 else "ArrowUp")
            for key in pressed - wanted:
                page.keyboard.up(key)
            for key in wanted - pressed:
                page.keyboard.down(key)
            pressed = wanted
            page.clock.run_for(75)
        else:
            raise AssertionError("Could not reach the real masked NPC: " + str(state))
    finally:
        for key in pressed:
            page.keyboard.up(key)
    page.clock.run_for(80)


def controls(browser, base, errors, failures, width, height):
    mobile = width < 1000
    context = browser.new_context(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile)
    page = context.new_page()
    page.clock.install()
    page.add_init_script(AUDIT)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("response", lambda r: failures.append([r.status, r.url]) if r.status >= 400 else None)
    page.goto(f"{base}/{ENTRY}")
    page.wait_for_function("BearlyVisits.audit().artReady && BearlyAtlas.ready()")
    page.clock.pause_at(page.evaluate("Date.now()+1000") / 1000)
    page.evaluate("__installWardrobeActorAudit()")
    page.locator("#introStart").click()
    page.evaluate("BEARLY_DEBUG_MENU.settings.godMode=true;BEARLY_DEBUG_MENU.warp(2500/1.5)")
    page.clock.run_for(100)
    before = page.evaluate("BearlyVisits.residents().filter(n=>n.kind!=='gangster')")
    variant_by_id = {n["id"]: n["variant"] for n in before}
    assert set(variant_by_id.values()) == set(range(9)), variant_by_id
    seen = verify_actual_calls(page)
    evidence = {"viewport": [width, height], "population": len(before), "outfits": sorted(set(variant_by_id.values()))}
    if not mobile:
        for variant in range(9):
            actor = next(n for n in before if n["variant"] == variant)
            page.evaluate("x=>{__wardrobeCalls=[];BEARLY_DEBUG_MENU.warp(x/1.5)}", actor["home"])
            page.clock.run_for(100)
            here = verify_actual_calls(page)
            assert any(n["variant"] == variant for n in here.values()), {"requested": variant, "seen": here}
            seen.update(here)
            page.locator(".canvas-wrap").screenshot(path=str(SHOTS / f"cast-street-{variant}.png"))
        assert {n["variant"] for n in seen.values()} == set(range(9)), seen
    anchor = min((n for n in page.evaluate("BearlyVisits.residents()") if n.get("kind") != "gangster" and n["variant"] in [2, 5]), key=lambda n: (abs(n.get("depth", 0)), n["home"]))
    page.evaluate("x=>{BEARLY_DEBUG_MENU.warp(x/1.5);__wardrobeCalls=[]}", anchor["x"])
    page.clock.run_for(100)
    riding_seen = verify_actual_calls(page)
    page.locator(".dismount-button").tap() if mobile else page.keyboard.press("q")
    page.clock.run_for(2700)
    assert page.evaluate("BearlyVisits.audit().mode") == "street"
    after = page.evaluate("BearlyVisits.residents().filter(n=>n.kind!=='gangster')")
    assert {n["id"]: n["variant"] for n in after} == variant_by_id
    foot_seen = verify_actual_calls(page)
    shared = set(riding_seen) & set(foot_seen)
    assert shared
    assert all(riding_seen[k] == foot_seen[k] for k in shared)
    assert page.locator(".foot-heart").count() == 5
    page.locator(".canvas-wrap").screenshot(path=str(SHOTS / f"cast-foot-{width}.png"))
    if width in [1440, 390]:
        page.locator(".canvas-wrap").screenshot(path=str(SHOTS / ("cast-street-game.png" if width == 1440 else "cast-street-phone.png")))
    page.locator(".area-exit").tap() if mobile else page.keyboard.press("q")
    page.clock.run_for(2800)
    assert not page.evaluate("BearlyVisits.audit().mode")
    assert {n["id"]: n["variant"] for n in page.evaluate("BearlyVisits.residents().filter(n=>n.kind!=='gangster')")} == variant_by_id
    # The actual room host uses the ordinary resident wardrobe, distinct from crews.
    page.keyboard.press("F3")
    page.locator('[data-dbg-place="pizzeria"]').click()
    page.keyboard.press("F3")
    page.clock.run_for(100)
    page.locator(".visit-prompt").click()
    page.clock.run_for(3400)
    assert page.evaluate("BearlyVisits.audit().mode") == "room", page.evaluate("BearlyVisits.audit()")
    host = page.evaluate("BearlyVisits.audit().combat.npcs.find(n=>n.id==='host')")
    assert host["variant"] in [6, 7, 8], host
    assert {n["id"]: n["variant"] for n in page.evaluate("BearlyVisits.residents().filter(n=>n.kind!=='gangster')")} == variant_by_id
    page.keyboard.press("Escape")
    page.clock.run_for(2800)
    assert not page.evaluate("BearlyVisits.audit().mode")
    # Reach an actual masked resident through normal movement, then use the
    # real grab/throw controls. No synthetic NPC state or practice replacement.
    masked = page.evaluate("id=>BearlyVisits.residents().find(n=>n.id===id)", anchor["id"])
    assert masked["variant"] in [2, 5] and masked["hp"] == 60, masked
    page.evaluate("x=>{BEARLY_DEBUG_MENU.warp(x/1.5);__wardrobeCalls=[]}", masked["x"])
    page.clock.run_for(100)
    page.locator(".dismount-button").tap() if mobile else page.keyboard.press("q")
    page.clock.run_for(2700)
    assert page.evaluate("BearlyVisits.audit().mode") == "street"
    approach_actor(page, anchor["id"])
    page.locator(".area-grab").tap() if mobile else page.keyboard.press("g")
    page.clock.run_for(100)
    held = page.evaluate("BearlyVisits.audit().combat.held")
    assert held == anchor["id"], {"wanted": anchor["id"], "held": held}
    page.locator(".area-grab").tap() if mobile else page.keyboard.press("g")
    page.clock.run_for(850)
    target = page.evaluate("id=>BearlyVisits.audit().combat.npcs.find(n=>n.id===id)", held)
    assert target["state"] == "screen" and target["hp"] == 28 and target["lastDamage"] == 32, target
    screen_calls = page.evaluate("__wardrobeCalls.filter(c=>/cast-screen/.test(c.source))")
    expected_screen = "cast-screen-" + "abc"[target["variant"] // 3] + "-v15.png"
    assert screen_calls and all(c["source"] == expected_screen for c in screen_calls), screen_calls
    page.locator(".canvas-wrap").screenshot(path=str(SHOTS / f"cast-impact-{width}.png"))
    if not mobile:
        page.locator(".canvas-wrap").screenshot(path=str(SHOTS / "cast-screen-impact.png"))
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    if mobile:
        for selector in [".area-grab", ".area-maul", ".area-exit"]:
            box = page.locator(selector).bounding_box()
            assert box and box["x"] >= 0 and box["y"] >= 0
            assert box["x"] + box["width"] <= width + 1 and box["y"] + box["height"] <= height + 1
    evidence.update({"actualAdultsObserved": seen, "sameBikeFootActors": sorted(shared), "roomHostVariant": host["variant"], "actualThrow": {"id": target["id"], "variant": target["variant"], "faceCovered": target["variant"] in [2, 5], "damage": target["lastDamage"], "hp": target["hp"], "source": screen_calls[-1]["source"]}})
    context.close()
    return evidence


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    phase = parser.add_mutually_exclusive_group()
    phase.add_argument("--renderer-only", action="store_true")
    phase.add_argument("--controls-only", action="store_true")
    options = parser.parse_args()
    SHOTS.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    errors, failures = [], []
    evidence = {"entry": ENTRY, "build": "AUTUMN_RIDE_ART_V15"}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
            page = browser.new_page()
            page.clock.install()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("response", lambda r: failures.append([r.status, r.url]) if r.status >= 400 else None)
            base = f"http://127.0.0.1:{server.server_port}"
            page.goto(f"{base}/{ENTRY}")
            page.wait_for_function("BearlyVisits.audit().artReady && BearlyAtlas.ready()")
            page.clock.pause_at(page.evaluate("Date.now()+1000") / 1000)
            assert page.evaluate("BEARLY_BUILD_ID") == "AUTUMN_RIDE_ART_V15"
            catalog = page.evaluate("BearlyBrawlArt.wardrobe()")
            assert page.evaluate("BearlyBrawlArt.wardrobeCount") == 9
            assert len(catalog) == 9 and len({n["label"] for n in catalog}) == 9
            characters = [n.get("character") for n in catalog]
            assert all(characters), "Each cast entry needs its intended age design metadata"
            assert [n["ageGroup"] for n in characters] == ["young-adult"] * 6 + ["older-adult"] * 3, characters
            assert all(18 <= n["age"] <= 24 for n in characters[:6]), characters
            assert all(n["age"] >= 35 for n in characters[6:]), characters
            assert [n["age"] for n in characters] == [20, 21, 22, 21, 20, 20, 52, 42, 55], characters
            assert [n["faceCovered"] for n in characters] == [False, False, True, False, False, True, False, False, False], characters
            evidence["ageGroups"] = {"youngAdult": 6, "olderAdult": 3}
            evidence["faceCoveredVariants"] = [2, 5]
            evidence["catalog"] = catalog
            evidence["sourceSHA256"] = source_hashes()
            if not options.controls_only:
                evidence["sourceCoverage"] = page.evaluate(PROBES)
                assert evidence["sourceCoverage"]["cases"] == 324, evidence["sourceCoverage"]
                assert evidence["sourceCoverage"]["faultCount"] == 0, evidence["sourceCoverage"]
                evidence["walkingConnectivity"] = page.evaluate(WALK_CONNECTIVITY)
                assert evidence["walkingConnectivity"]["cases"] == 288, evidence["walkingConnectivity"]
                assert evidence["walkingConnectivity"]["faultCount"] == 0, evidence["walkingConnectivity"]
                (SHOTS / "cast-source-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
            page.close()
            if not options.renderer_only:
                for width, height in [(1440, 1000), (390, 844), (844, 390)]:
                    evidence[str(width)] = controls(browser, base, errors, failures, width, height)
            browser.close()
        assert not errors, errors
        assert not failures, failures
        evidence.update({"result": "passed", "pageErrors": errors, "httpFailures": failures})
        filename = "cast-source-evidence.json" if options.renderer_only else "cast-controls-evidence.json" if options.controls_only else "cast-evidence.json"
        (SHOTS / filename).write_text(json.dumps(evidence, indent=2) + "\n")
        print(json.dumps({"result": "passed", "outfits": len(catalog), "sourceCoverage": evidence.get("sourceCoverage"), "walkingConnectivity": evidence.get("walkingConnectivity"), "viewports": [k for k in ["1440", "390", "844"] if k in evidence]}))
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
