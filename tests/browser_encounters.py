"""V18 real-input street encounter, shared health and contact regression checks.

Debug warps select real route locations. Tests never spawn projectiles, replace
NPCs, force aggression or assign health. Separate renderer probes may use
synthetic poses, but all integration cases use the actual controls and actors.
"""
from browser_fixture import prepared_ready
import argparse
import functools
import hashlib
import json
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
ENTRY='autumn-v19.html'
SHOTS=ROOT/'screenshots'/'revision19'
DAMAGE={'rock':10,'bottle':30,'firecracker':20}

AUDIT=r"""(() => {
  window.__encounterDraws=[];window.__modelShotDraws=[];window.__weaponFxDraws=[];window.__healthChanges=[];
  window.__installEncounterAudit=()=>{
    const projectile=BearlyBrawlArt.projectile,adult=BearlyBrawlArt.adult,fx=BearlyWeaponEffects.draw,update=BearlyVisits.update;let previousHealth=BEARLY_DEBUG().health;const previousContactIds=new Set();
    BearlyBrawlArt.projectile=function(c,q,...args){__modelShotDraws.push({id:q.id,kind:q.kind,age:q.age,mode:BearlyVisits.audit().mode,x:q.x,depth:q.depth});if(__modelShotDraws.length>3000)__modelShotDraws.splice(0,1000);return projectile.call(this,c,q,...args);};
    BearlyBrawlArt.adult=function(c,n,x,y,h,...args){const result=adult.call(this,c,n,x,y,h,...args);if(n.kind==='gangster'){const k=BearlyKids.audit().drawn[n.item];__encounterDraws.push({id:n.id,item:n.item,x:n.x,depth:n.depth,moving:n.moving,state:n.state,activity:n.activity,aggressive:n.aggressive,behindCover:n.behindCover,height:h,mode:BearlyVisits.audit().mode,render:k});if(__encounterDraws.length>3000)__encounterDraws.splice(0,1000);}return result;};
    BearlyVisits.update=function(...args){const result=update.apply(this,args),s=BearlyVisits.audit(),health=BEARLY_DEBUG().health,allContacts=[...s.combat.contacts.map(e=>({...e,uid:'model:'+e.id})),...BEARLY_PROJECTILE_QA.state().history.map(e=>({...e,uid:'cycling:'+e.id}))],newContacts=allContacts.filter(e=>!previousContactIds.has(e.uid));for(const e of allContacts)previousContactIds.add(e.uid);if(health!==previousHealth){__healthChanges.push({before:previousHealth,after:health,delta:previousHealth-health,modelHealth:s.combat.hp,mode:s.mode,x:s.x,depth:s.depth,newContacts,punchers:s.combat.npcs.filter(n=>n.punching&&Math.abs(n.x-s.x)<70&&Math.abs(n.depth-s.depth)<25).map(n=>({id:n.id,kind:n.kind,x:n.x,depth:n.depth})),counterEffects:s.combat.effects.filter(e=>e.kind==='counter'&&e.age<.06)});previousHealth=health;}return result;};
    window.BearlyWeaponEffects={...window.BearlyWeaponEffects,draw:function(c,e,x,y,...args){const result=fx.call(this,c,e,x,y,...args);if(c.canvas.id==='game'){__weaponFxDraws.push({weapon:e.weapon||e.kind,target:e.target,age:e.age,x,y,mode:BearlyVisits.audit().mode});if(__weaponFxDraws.length>2000)__weaponFxDraws.splice(0,1000);}return result;}};
  };
})();"""


def state(page):
    return page.evaluate('BearlyVisits.audit()')


def model_actor(page,ident):
    return next(n for n in state(page)['combat']['npcs'] if n['id']==ident)


def begin_hold(page,key):
    if not getattr(page,'_qa_touch',False):page.keyboard.down(key);return None
    if state(page)['mode']=='street':selector={'ArrowRight':'[data-direction="1"]','ArrowLeft':'[data-direction="-1"]','ArrowUp':'[data-depth="-1"]','ArrowDown':'[data-depth="1"]'}[key]
    else:selector=f'.touch-controls [data-key="{key}"]'
    box=page.locator(selector).bounding_box();assert box,selector
    session=page.context.new_cdp_session(page);session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}]});return session


def end_hold(page,key,session):
    if session:session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});session.detach()
    else:page.keyboard.up(key)


def hold(page,key,milliseconds,settle=80):
    session=begin_hold(page,key);page.clock.run_for(max(1,round(milliseconds)));end_hold(page,key,session)
    if settle:page.clock.run_for(settle)


def wait_clock(page,predicate,limit=12000,step=50):
    for _ in range(round(limit/step)+1):
        current=state(page)
        if predicate(current):return current
        page.clock.run_for(step)
    raise AssertionError({'timeout':limit,'state':state(page)})


def move_x(page,target,tolerance=10):
    for _ in range(30):
        s=state(page);dx=target-s['x']
        if abs(dx)<tolerance:return
        hold(page,'ArrowRight' if dx>0 else 'ArrowLeft',min(240,max(20,abs(dx)/120*1000)))
    raise AssertionError({'moveTarget':target,'state':state(page)})


def provoke_existing_gang(page,retreat=230):
    """Talk to a real passive neighbour, then make room for actual projectiles."""
    s=state(page);candidates=sorted((n for n in s['combat']['npcs'] if n.get('kind')=='gangster' and n.get('active',True) and n.get('visible',True) and n['hp']>0 and not n.get('aggressive')),key=lambda n:abs(n['x']-s['x']))
    assert candidates and abs(candidates[0]['x']-s['x'])<600,s
    target=candidates[0];ident=target['id']
    choices=[]
    for side in [-1,1]:
        x=target['x']+side*90
        entrance=page.evaluate('(x)=>BearlyNeighbourhood.nearestEntrance(x)',x)
        choices.append((bool(entrance),abs(x-s['x']),side))
    side=min(choices)[2]
    for _ in range(25):
        s=state(page);n=model_actor(page,ident);dy=max(-85,min(60,n['depth']))-s['depth'];dx=n['x']+side*90-s['x']
        if abs(dy)>9:hold(page,'ArrowDown' if dy>0 else 'ArrowUp',min(220,max(20,abs(dy)/140*1000)))
        elif abs(dx)>9:hold(page,'ArrowRight' if dx>0 else 'ArrowLeft',min(220,max(20,abs(dx)/120*1000)))
        else:break
    if side>0:hold(page,'ArrowLeft',8,30)
    else:hold(page,'ArrowRight',8,30)
    before=state(page);n=model_actor(page,ident)
    assert not n['aggressive'],n
    assert 'BOTHER THE NEIGHBOURS' in page.locator('.area-action').inner_text(),{'target':n,'state':before,'action':page.locator('.area-action').inner_text()}
    hp=before['combat']['hp']
    if getattr(page,'_qa_touch',False):page.locator('.area-action').tap()
    else:page.keyboard.press('e')
    page.clock.run_for(40);after=state(page)
    assert model_actor(page,ident)['aggressive'],after
    assert after['combat']['hp']==hp and model_actor(page,ident)['hp']==n['hp'],'Talking must provoke without applying fabricated damage'
    if retreat:move_x(page,model_actor(page,ident)['x']+side*retreat)
    return {'targetId':ident,'item':n['item'],'side':side,'beforeHp':hp,'targetHp':n['hp'],'crewId':n.get('crewId')}


def source_hashes():
    paths=[ROOT/ENTRY,*[ROOT/'js'/name for name in ['game.js','illustrated-visits.js','brawler.js','brawler-art.js','illustrated-kids.js','weapon-effects.js','hero-rig.js','locomotion.js','street-life.js','illustrated-world.js','illustrated-neighbourhood.js']],ROOT/'css'/'illustrated.css']
    return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()}


def start(browser,base,errors,failures,position=3800,protected=False,size=(1440,1000),touch=False):
    context=browser.new_context(viewport={'width':size[0],'height':size[1]},is_mobile=touch,has_touch=touch);page=context.new_page();page._qa_touch=touch;page.clock.install();page.add_init_script(AUDIT)
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failures.append([r.status,r.url]) if r.status>=400 else None)
    page.goto(f'{base}/{ENTRY}');page.wait_for_function(prepared_ready('BearlyVisits.audit().artReady&&BearlyKids.ready()&&window.BearlyWeapons&&window.BearlyWeaponEffects&&BEARLY_DEBUG_MENU.stats().frames>0'),timeout=120000)
    page.clock.pause_at(page.evaluate('Date.now()+1000')/1000)
    if touch:page.locator('#introStart').tap()
    else:page.locator('#introStart').click()
    page.evaluate('(p)=>{BEARLY_DEBUG_MENU.settings.godMode=p.protected;BEARLY_DEBUG_MENU.warp(p.x/1.5);__installEncounterAudit()}',{'protected':protected,'x':position});page.clock.run_for(160)
    return context,page


def dismount(page,touch=False):
    assert state(page)['mode'] is None
    if touch:page.locator('.dismount-button').tap()
    else:page.keyboard.press('q')
    return wait_clock(page,lambda s:s['mode']=='street',4000)


def contacts(page):
    return page.evaluate("""() => [...BearlyVisits.audit().combat.contacts.map(e=>({...e,domain:'model',uid:'model:'+e.id})),...BEARLY_PROJECTILE_QA.state().history.map(e=>({...e,domain:'cycling',uid:'cycling:'+e.id}))]""")


def crew_for(page,kind):
    return next(c for c in page.evaluate('BEARLY_V158_QA().crews') if c['item']==kind)


def passive_modes(browser,base,errors,failures,size=(1440,1000),touch=False):
    context,page=start(browser,base,errors,failures,protected=True,size=size,touch=touch)
    first=crew_for(page,'bottle');page.evaluate('(x)=>BEARLY_DEBUG_MENU.warp(x/1.5)',first['x']-350);page.clock.run_for(160)
    initial=page.evaluate('BearlyVisits.residents()');identities=[(n['id'],n['variant']) for n in initial]
    before=page.evaluate('BEARLY_DEBUG().thrownCount');page.clock.run_for(2400)
    calm=page.evaluate('BearlyVisits.residents().filter(n=>n.kind===\"gangster\")');assert all(not n['aggressive'] for n in calm),calm
    cover_members=[n for n in calm if n.get('behindCover') and abs(n['x']-first['x'])<400]
    assert cover_members,calm
    props=page.evaluate('BearlyStreetLife.audit().props');drawn_props=page.evaluate('BearlyStreetLife.audit().drawnProps')
    for n in cover_members:
        prop=next(p for p in props if p['id']==n['activityProp']['id'])
        assert prop['kind'] in ['utility','firebin'] and n['depth']<prop['depth'] and abs(n['x']-prop['x'])<5,{'actor':n,'prop':prop}
        assert any(p['id']==prop['id'] for p in drawn_props),{'undrawnCoverProp':prop,'drawnProps':drawn_props}
    samples=[];pedal=begin_hold(page,'ArrowUp')
    for _ in range(40):page.clock.run_for(100);samples.append({'rider':page.evaluate('BEARLY_TOUCH_STATUS()'),'gangs':page.evaluate('BearlyVisits.residents().filter(n=>n.kind===\"gangster\").map(n=>({id:n.id,aggressive:n.aggressive,gangAlert:n.gangAlert}))')})
    end_hold(page,'ArrowUp',pedal)
    assert all(not n['aggressive'] for s in samples for n in s['gangs']),samples
    assert page.evaluate('BEARLY_DEBUG().thrownCount')==before,'Passing crews must not launch unprovoked cycling shots'
    page.evaluate('(x)=>BEARLY_DEBUG_MENU.warp(x/1.5)',first['x']-300);page.clock.run_for(160)
    page.screenshot(path=str(SHOTS/f'gang-passive-bike-{size[0]}.png'))
    dismount(page,touch);page.clock.run_for(1600);foot=state(page)
    assert [(n['id'],n['variant']) for n in foot['combat']['npcs']]==identities
    assert all(not n['aggressive'] for n in foot['combat']['npcs'] if n.get('kind')=='gangster')
    page.screenshot(path=str(SHOTS/f'gang-passive-foot-{size[0]}.png'))
    hold(page,'ArrowUp',600)
    foot_pass=[];walking=begin_hold(page,'ArrowRight')
    for _ in range(48):
        page.clock.run_for(100);s=state(page);foot_pass.append({'x':s['x'],'depth':s['depth'],'gangs':[{'id':n['id'],'aggressive':n['aggressive'],'alert':n.get('gangAlert')} for n in s['combat']['npcs'] if n.get('kind')=='gangster']})
    end_hold(page,'ArrowRight',walking)
    assert foot_pass[-1]['x']-foot_pass[0]['x']>500 and all(not n['aggressive'] for sample in foot_pass for n in sample['gangs']),foot_pass
    assert state(page)['combat']['stats']['enemyShots']==0,'Walking past a crew must not trigger unprovoked shots'
    provoked=provoke_existing_gang(page);page.clock.run_for(900);active=state(page)
    assert any(n.get('aggressive') for n in active['combat']['npcs'] if n.get('kind')=='gangster')
    assert page.locator('.foot-heart').count()==5 and page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(SHOTS/f'gang-provoked-{size[0]}.png'))
    draws=page.evaluate('__encounterDraws');assert any(d['mode'] is None for d in draws) and any(d['mode']=='street' for d in draws)
    assert all(abs(d['render']['height']-d['height']*.9375)<.01 for d in draws if d['render']),draws[-4:]
    result={'viewport':size,'input':'touch' if touch else 'keyboard','actorCount':len(identities),'passBySamples':len(samples),'footPassBySamples':foot_pass,'unprovokedShots':page.evaluate('BEARLY_DEBUG().thrownCount')-before,'passiveCoverMembers':[{'id':n['id'],'x':n['x'],'depth':n['depth'],'prop':n['activityProp']} for n in cover_members],'provocation':provoked,'activeGangIds':[n['id'] for n in active['combat']['npcs'] if n.get('kind')=='gangster' and n.get('aggressive')],'draws':draws[-40:]}
    context.close();return result


def damage_case(browser,base,errors,failures,kind,mode):
    context,page=start(browser,base,errors,failures)
    crew=crew_for(page,kind);page.evaluate('(x)=>BEARLY_DEBUG_MENU.warp(x/1.5)',crew['x']-290);page.clock.run_for(160)
    if mode=='foot':
        dismount(page);provoked=provoke_existing_gang(page)
    else:
        # Pressure is an actual stopped/facing interaction. Moving past at speed
        # was checked separately and does not manufacture an attack.
        targets=[n for n in page.evaluate('BearlyVisits.residents()') if n.get('kind')=='gangster' and n.get('crewId')==f"crew-{crew['x']}"]
        if not targets:targets=[n for n in page.evaluate('BearlyVisits.residents()') if n.get('kind')=='gangster' and abs(n['x']-crew['x'])<200]
        target=next((n for n in targets if n['item']==kind),targets[0]);page.evaluate('(x)=>BEARLY_DEBUG_MENU.warp(x/1.5)',target['x']-85);page.clock.run_for(100)
        wait_clock(page,lambda s:any(n.get('aggressive') and abs(n['x']-crew['x'])<500 for n in s['combat']['npcs'] if n.get('kind')=='gangster'),5000)
        provoked={'targetId':target['id'],'method':'stopped facing proximity warning'}
    seen=set();hit=None;all_contacts=[]
    for _ in range(400):
        page.clock.run_for(50)
        for e in contacts(page):
            if e['uid'] in seen:continue
            seen.add(e['uid']);all_contacts.append(e)
            if e['target']=='bear' and e['weapon']==kind and e['appliedDamage']>0:hit=e;break
        if hit:break
    assert hit,{'kind':kind,'mode':mode,'contacts':all_contacts,'state':state(page)}
    assert hit['appliedDamage']==DAMAGE[kind] and hit['hpBefore']-hit['hpAfter']==DAMAGE[kind],hit
    current=state(page);health=page.evaluate('BEARLY_DEBUG().health');assert current['combat']['hp']==health,{'foot':current['combat']['hp'],'rider':health}
    if mode=='foot':
        widths=page.locator('.foot-heart i').evaluate_all('(items)=>items.map(e=>parseFloat(e.style.width))');assert abs(sum(widths)/100-health/20)<.001,{'hearts':widths,'health':health}
    else:widths=None
    page.screenshot(path=str(SHOTS/f'weapon-{kind}-{mode}-contact.png'))
    # Persistent visual flames/marks must not inflict unrecorded extra ticks.
    before=health;start_ids={e['uid'] for e in contacts(page)};page.clock.run_for(600);after=page.evaluate('BEARLY_DEBUG().health');extra=[e for e in contacts(page) if e['uid'] not in start_ids];applied=sum(e['appliedDamage'] for e in extra)
    assert before-after==applied,{'unrecordedDamage':before-after-applied,'contacts':extra}
    fx=page.evaluate('__weaponFxDraws');assert any(e['weapon']==kind and e['target']=='bear' for e in fx),fx[-10:]
    swap_before=page.evaluate('BEARLY_DEBUG().health');swap_ids={e['uid'] for e in contacts(page)};change_offset=page.evaluate('__healthChanges.length')
    page.keyboard.press('q')
    if mode=='foot':wait_clock(page,lambda s:s['mode'] is None and s['transition'] is None,15000)
    else:wait_clock(page,lambda s:s['mode']=='street',5000)
    swap_after=page.evaluate('BEARLY_DEBUG().health');swap_contacts=[e for e in contacts(page) if e['uid'] not in swap_ids]
    swap_changes=page.evaluate('(offset)=>__healthChanges.slice(offset)',change_offset)
    assert all(e['after']==e['modelHealth'] for e in swap_changes),swap_changes
    recorded=sum(e['appliedDamage'] for e in swap_contacts)
    melee=[e for e in swap_changes if e['delta'] in [8,10] and e['punchers'] and e['counterEffects'] and not any(c['appliedDamage']>0 for c in e['newContacts'])]
    assert swap_before-swap_after==recorded+sum(e['delta'] for e in melee),{'lostSharedHealth':True,'before':swap_before,'after':swap_after,'contacts':swap_contacts,'changes':swap_changes}
    assert state(page)['combat']['hp']==swap_after
    result={'weapon':kind,'mode':mode,'expectedDamage':DAMAGE[kind],'expectedHearts':DAMAGE[kind]/20,'contact':hit,'health':health,'heartWidths':widths,'provocation':provoked,'contacts':all_contacts,'noUnrecordedTickWindow':{'before':before,'after':after,'newContactDamage':applied},'actualEffectDraws':fx[-20:],'sharedHealthModeSwap':{'before':swap_before,'after':swap_after,'mode':state(page)['mode'],'contactDamage':recorded,'observedMeleeDamage':sum(e['delta'] for e in melee),'changes':swap_changes}}
    context.close();return result


def remount_projectile_case(browser,base,errors,failures):
    context,page=start(browser,base,errors,failures,position=3790)
    dismount(page);provoke_existing_gang(page)
    parked=state(page)['parkedAt']+28;move_x(page,parked)
    for _ in range(10):
        depth=state(page)['depth']
        if abs(depth)<8:break
        hold(page,'ArrowDown' if depth<0 else 'ArrowUp',min(160,max(20,abs(depth)/140*1000)))
    launched=wait_clock(page,lambda s:any(q['age']<.12 for q in s['combat']['shots']),12000,16)
    shot=next(q for q in launched['combat']['shots'] if q['age']<.12);hp=launched['combat']['hp']
    page.keyboard.press('q');page.clock.run_for(32);assert state(page)['transition']=='mount',state(page)
    during=state(page);assert any(q['id']==shot['id'] for q in during['combat']['shots'])
    mounted=wait_clock(page,lambda s:s['mode'] is None and s['transition'] is None,5000,16);page.clock.run_for(32)
    draws=page.evaluate('(id)=>__modelShotDraws.filter(q=>q.id===id)',shot['id'])
    assert any(d['mode']=='street' for d in draws),draws
    assert any(d['mode']=='mount' for d in draws),draws
    assert any(d['mode'] is None for d in draws),draws
    assert state(page)['combat']['hp']==page.evaluate('BEARLY_DEBUG().health')
    page.screenshot(path=str(SHOTS/'model-projectile-after-remount.png'))
    result={'shot':shot,'healthBefore':hp,'healthAfter':state(page)['combat']['hp'],'drawnModes':[d['mode'] for d in draws],'lastDraws':draws[-8:],'survivedMount':True};context.close();return result


def cycling_dismount_projectile_case(browser,base,errors,failures,kind='bottle'):
    """Natural mounted throw stays planted and keeps flying after actual Q."""
    context,page=start(browser,base,errors,failures,protected=True)
    crew=crew_for(page,kind);target=next(n for n in page.evaluate('BearlyVisits.residents()') if n.get('kind')=='gangster' and n['item']==kind and abs(n['x']-crew['x'])<200)
    page.evaluate('(x)=>BEARLY_DEBUG_MENU.warp(x/1.5)',target['x']-85)
    for _ in range(600):
        page.clock.run_for(16)
        if page.evaluate('BEARLY_PROJECTILE_QA.state().projectiles.length'):break
    launched=page.evaluate('BEARLY_PROJECTILE_QA.state()');assert launched['projectiles'],launched
    cues=page.evaluate("__encounterDraws.filter(d=>d.mode===null&&d.aggressive&&['windup','release','recover'].includes(d.state))")
    assert len(cues)>=15,cues
    assert all(not d['moving'] for d in cues),cues
    groups={}
    for d in cues:groups.setdefault(d['id'],[]).append(d)
    assert any(len(items)>=10 for items in groups.values()),groups
    for ident,items in groups.items():
        assert max(d['x'] for d in items)-min(d['x'] for d in items)<.01,{'slidingThrower':ident,'cues':items}
    before_hp=page.evaluate('BEARLY_DEBUG().health');history_ids={e['id'] for e in launched['history']}
    page.keyboard.press('q');page.clock.run_for(100)
    flight=page.evaluate('BEARLY_PROJECTILE_QA.state()');phase=state(page)['mode']
    assert phase is not None,phase
    assert flight['projectiles'] and any(abs(q['x']-launched['projectiles'][0]['x'])>5 or abs(q['y']-launched['projectiles'][0]['y'])>5 for q in flight['projectiles']),{'frozenFlight':True,'before':launched,'after':flight}
    wait_clock(page,lambda s:s['mode']=='street',4000,16);page.clock.run_for(1000)
    landed=page.evaluate('BEARLY_PROJECTILE_QA.state()');ground=[e for e in landed['history'] if e['id'] not in history_ids]
    assert not landed['projectiles'] and any(e['weapon']==kind for e in ground) and all(e['target']=='ground' and e['appliedDamage']==0 for e in ground),landed
    assert before_hp==page.evaluate('BEARLY_DEBUG().health'),'The parked bicycle must not remain a hurtbox'
    fx=page.evaluate('__weaponFxDraws');assert any(e['target']=='ground' and e['mode'] is not None for e in fx),fx[-12:]
    # A short stone flash can already have expired by full dismount; long-lived
    # Molotov road flames must visibly continue ageing while on foot.
    age_progress=None
    if kind=='bottle':
        age_before=max((e['age'] for e in landed['impacts']),default=0);page.clock.run_for(240);age_after=max((e['age'] for e in page.evaluate('BEARLY_PROJECTILE_QA.state().impacts')),default=0)
        assert age_after-age_before>.15,{'frozenGroundEffect':True,'before':age_before,'after':age_after};age_progress=age_after-age_before
    page.screenshot(path=str(SHOTS/f'cycling-{kind}-ground-after-dismount.png'))
    result={'weapon':kind,'launch':launched,'flightDuringDismount':flight,'groundContacts':ground,'plantedCueFrames':len(cues),'cueTravelByActor':{ident:max(d['x'] for d in items)-min(d['x'] for d in items) for ident,items in groups.items()},'effectAgeProgress':age_progress,'parkedBikeDamage':before_hp-page.evaluate('BEARLY_DEBUG().health')}
    context.close();return result


def scene_and_frame_case(browser,base,errors,failures):
    context,page=start(browser,base,errors,failures,position=2500,protected=True)
    page.wait_for_function(prepared_ready('Object.values(BearlyWorld.ready()).every(Boolean)'),timeout=60000)
    samples=[]
    for x in [2500,10000,16000,23500,27500,32000]:
        page.evaluate('(x)=>BEARLY_DEBUG_MENU.warp(x/1.5)',x);page.clock.run_for(160)
        weights=page.evaluate('(x)=>BearlyWorld.backdropAt(x)',x)
        assert abs(sum(weights.values())-1)<1e-8,weights
        if x<27450:assert weights['waterfront']==0,weights
        if x==32000:assert weights['waterfront']==1,weights
        frame=page.evaluate("""() => Object.fromEntries(['body','.canvas-wrap','#game','.touch-controls','.game-shell'].map(s=>{const e=document.querySelector(s),c=getComputedStyle(e);return[s,{background:c.backgroundColor,border:c.borderColor}]}))""")
        for selector in ['body','.canvas-wrap','#game','.touch-controls','.game-shell']:
            rgb=frame[selector]['background'];values=[float(v.strip()) for v in rgb[rgb.index('(')+1:rgb.index(')')].split(',')]
            if len(values)==4 and values[3]==0:continue
            assert max(values[:3])-min(values[:3])<=8 and max(values[:3])<45,{'nonNeutralFrame':selector,'color':rgb}
        page.screenshot(path=str(SHOTS/f'scene-progression-{x}.png'));samples.append({'x':x,'weights':weights,'frame':frame})
    doors=page.evaluate('BearlyNeighbourhood.scaleAudit()');context.close();return {'samples':samples,'doorScaleAudit':doors}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--behavior-only',action='store_true');parser.add_argument('--damage-only',action='store_true');parser.add_argument('--weapon',choices=DAMAGE);parser.add_argument('--mode',choices=['foot','bike']);parser.add_argument('--transitions-only',action='store_true');parser.add_argument('--remount-only',action='store_true');parser.add_argument('--flights-only',action='store_true');parser.add_argument('--scenes-only',action='store_true');args=parser.parse_args()
    SHOTS.mkdir(exist_ok=True);server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start();errors=[];failures=[];result={'entry':ENTRY,'result':'checking','sourceSHA256AtStart':source_hashes(),'passive':[],'damage':[]}
    target=SHOTS/('encounter-transitions-evidence.json' if args.transitions_only else 'encounter-remount-evidence.json' if args.remount_only else 'encounter-flights-evidence.json' if args.flights_only else 'scene-progression-evidence.json' if args.scenes_only else 'encounter-behavior-evidence.json' if args.behavior_only else 'encounter-damage-evidence.json' if args.damage_only else 'encounter-integration-evidence.json')
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
            if args.transitions_only:
                result['remountProjectile']=remount_projectile_case(browser,f'http://127.0.0.1:{server.server_port}',errors,failures);target.write_text(json.dumps(result,indent=2)+'\n');print('Actual model projectile survives remount: passed',flush=True)
                result['cyclingDismountProjectile']=cycling_dismount_projectile_case(browser,f'http://127.0.0.1:{server.server_port}',errors,failures);target.write_text(json.dumps(result,indent=2)+'\n');print('Actual cycling projectile continues after dismount: passed',flush=True)
                result['damage']=[damage_case(browser,f'http://127.0.0.1:{server.server_port}',errors,failures,'bottle',mode) for mode in ['foot','bike']]
            elif args.remount_only:
                result['remountProjectile']=remount_projectile_case(browser,f'http://127.0.0.1:{server.server_port}',errors,failures)
            elif args.scenes_only:
                result['scenes']=scene_and_frame_case(browser,f'http://127.0.0.1:{server.server_port}',errors,failures)
            elif args.flights_only:
                result['cyclingDismountProjectiles']=[]
                for kind in DAMAGE:
                    result['cyclingDismountProjectiles'].append(cycling_dismount_projectile_case(browser,f'http://127.0.0.1:{server.server_port}',errors,failures,kind));target.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'groundFlight':kind,'result':'passed'}),flush=True)
            elif not args.damage_only:
                for size in [(1440,1000),(390,844),(844,390)]:result['passive'].append(passive_modes(browser,f'http://127.0.0.1:{server.server_port}',errors,failures,size,size[0]!=1440));target.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passive':size,'result':'passed'}),flush=True)
            if not args.behavior_only and not args.transitions_only and not args.scenes_only and not args.flights_only and not args.remount_only:
                for mode in [args.mode] if args.mode else ['foot','bike']:
                    for kind in [args.weapon] if args.weapon else DAMAGE:result['damage'].append(damage_case(browser,f'http://127.0.0.1:{server.server_port}',errors,failures,kind,mode));target.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'weapon':kind,'mode':mode,'result':'passed'}),flush=True)
            browser.close()
        result.update({'result':'passed','sourceSHA256AtEnd':source_hashes(),'pageErrors':errors,'httpFailures':failures});target.write_text(json.dumps(result,indent=2)+'\n');assert not errors,errors;assert not failures,failures
    except BaseException as error:
        result.update({'result':'failed','failure':repr(error),'sourceSHA256AtEnd':source_hashes(),'pageErrors':errors,'httpFailures':failures});target.write_text(json.dumps(result,indent=2)+'\n');raise
    finally:server.shutdown();server.server_close()


if __name__=='__main__':main()
