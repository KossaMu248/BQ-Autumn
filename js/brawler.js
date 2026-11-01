/* Shared population, sidewalk routines, civilian fear and on-foot combat. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const inactive=n=>['screen','down','fall','dead','held'].includes(n.state);
  const shown=n=>n.active!==false&&n.visible!==false;
  const activityFor=kind=>({bench:'sit',newspaper:'read',smoke:'smoke'})[kind]||'idle';
  function create(){
    let time=0,heat=0,phase='cute',frenzy=0,cooldown=0,hp=100,hurtUntil=0,lastAction=-99,held=null,attackUntil=0,hitStop=0,baby=null,serial=0,defeatAge=0;
    let npcs=[],effects=[],shots=[],arena='',protectedMode=false,lastFight=null;
    const arenas=new Map(),stats={grabs:0,throws:0,mauls:0,frenzyMauls:0,transformations:0,witnesses:0,defeats:0,enemyShots:0,screenImpacts:0,screams:0,civilianScares:0,hides:0,departures:0,arrivals:0};
    function scheduleOn(n){
      if(!n.schedule)return true;
      const period=Math.max(1,n.schedule.period||90),offset=n.schedule.offset||0;
      return ((time+offset)%period+period)%period<clamp(n.schedule.on??55,0,period);
    }
    function setActivity(n,next){if(n.activity!==next){n.activity=next;n.activityAge=0;}}
    function enter(key,items=[],reset=false){
      if(arena===key&&!reset)return;
      release();arena=key;
      if(!arenas.has(key)||reset)arenas.set(key,items.map((seed,i)=>{
        const civilian=seed.civilian===true,style=seed.patrolVariant??(seed.variant??i)%3;
        const sidewalkDepth=seed.sidewalkDepth??(seed.patrol?-70:(seed.depth||0));
        const n={...seed,civilian,hostile:civilian?false:!!seed.hostile,home:seed.x,homeDepth:seed.patrol?sidewalkDepth:(seed.depth||0),sidewalkDepth,
          depth:seed.patrol?sidewalkDepth:(seed.depth||0),id:seed.id||`npc-${i}`,variant:seed.variant??i%3,patrolVariant:style,
          state:'idle',age:0,hp:seed.hp||60,maxHp:seed.hp||60,face:seed.face||1,distance:0,speed:0,moving:false,running:false,
          angryUntil:0,nextHit:time+1.2,hitUntil:0,alertUntil:0,activity:'idle',activityAge:0,activityProp:null,
          fearUntil:0,screamUntil:0,screamReady:0,fearReactionUntil:0,hiding:false,hideTarget:null,hideUntil:0,
          routeMin:Math.min(seed.routeMin??seed.x-285,seed.routeMax??seed.x+285),routeMax:Math.max(seed.routeMin??seed.x-285,seed.routeMax??seed.x+285),
          routeDirection:seed.routeDirection||((style%2)?-1:1),routeIndex:null,restUntil:0,departing:false,active:true,visible:true};
        n.routineExplicit=seed.routeMin!=null||seed.routeMax!=null||!!seed.restSpots?.length;
        n.restSpots=(seed.restSpots||[]).map(q=>({...q,depth:q.depth??sidewalkDepth}));
        n.hideSpots=(seed.hideSpots||[]).map(q=>({...q,depth:q.depth??sidewalkDepth}));
        n.routePoints=[{id:'route-left',x:n.routeMin,depth:sidewalkDepth,kind:'idle',duration:3+style},...n.restSpots.filter(q=>q.x>n.routeMin&&q.x<n.routeMax),{id:'route-right',x:n.routeMax,depth:sidewalkDepth,kind:'idle',duration:3+style}].sort((a,b)=>a.x-b.x);
        const initial=n.restSpots.find(q=>Math.abs(q.x-n.x)<4);
        if(initial){n.depth=initial.depth;n.activity=activityFor(initial.kind);n.activityProp={...initial};n.restUntil=time+(initial.duration||10);}
        n.active=n.visible=scheduleOn(n);if(!n.active)n.activity='offstage';
        return n;
      }));
      npcs=arenas.get(key);effects=[];shots=[];attackUntil=0;lastFight=null;
    }
    function effect(kind,x,depth,extra={}){const e={id:serial++,kind,x,depth,age:0,...extra};effects.push(e);return e;}
    function gain(amount){
      if(phase==='madness'||cooldown>0)return;
      heat=clamp(heat+amount,0,100);lastAction=time;
      if(heat>=100){release();phase='madness';frenzy=8;stats.transformations++;effect('transform',0,0);}
      else if(heat>=35)phase='apex';
    }
    function carryBack(){baby={position:'back'};}
    function hidePlace(n,threat){
      const away=Math.sign(n.x-threat.x)||n.face||1;
      const choices=n.hideSpots.filter(q=>q.id!==n.hideTarget?.id&&Math.abs(q.x-n.x)<1700&&Math.abs(q.x-threat.x)>170);
      choices.sort((a,b)=>{
        const score=q=>Math.min(1100,Math.abs(q.x-threat.x))*1.1-Math.abs(q.x-n.x)*.3+((q.x-n.x)*away>=-15?260:0);
        return score(b)-score(a);
      });
      if(choices.length)return {...choices[0]};
      let tx=clamp(n.x+away*780,Math.max(30,n.routeMin-400),n.routeMax+400);
      if(Math.abs(tx-threat.x)<180)tx=away>0?n.routeMax+400:Math.max(30,n.routeMin-400);
      return {id:null,kind:'offscreen',x:tx,depth:n.sidewalkDepth};
    }
    function scare(n,threat,force=false){
      if(!n.civilian||!shown(n)||n.hp<=0)return;
      const already=n.fearUntil>time,cornered=n.hiding&&Math.abs(n.x-threat.x)<170;
      n.angryUntil=0;n.punchUntil=0;
      if(already&&!force&&!cornered){n.fearUntil=Math.max(n.fearUntil,time+6);return;}
      if(!already)stats.civilianScares++;
      n.fearUntil=Math.max(n.fearUntil,time+14);n.threat={x:threat.x,depth:threat.depth||0};
      n.hideTarget=hidePlace(n,n.threat);n.hiding=false;n.hideUntil=0;n.activityProp=null;n.restUntil=0;
      n.fearReactionUntil=time+(already?0:.2);
      if(time>=n.screamReady){n.screamUntil=time+1.2;n.screamReady=time+4.5;stats.screams++;effect('scream',n.x,n.depth,{actorId:n.id});}
      setActivity(n,'cower');
    }
    function markFight(x,depth){lastFight={x,depth:depth||0,until:time+2.2};}
    function provoke(victim,p){
      const threat={x:p?.x??victim.x,depth:p?.depth??victim.depth};markFight(threat.x,threat.depth);
      for(const n of npcs){
        if(!shown(n)||(inactive(n)&&n!==victim))continue;
        if(n===victim||Math.abs(n.x-victim.x)<(n.civilian?360:280)&&Math.abs(n.depth-victim.depth)<115){
          if(n!==victim&&(n.civilian?n.fearUntil<=time:n.angryUntil<=time))stats.witnesses++;
          if(n.civilian){scare(n,threat,n===victim);continue;}
          n.angryUntil=Math.max(n.angryUntil,time+12);n.alertUntil=time+(n===victim?.25:.65);n.nextHit=Math.max(n.nextHit,time+.8);
        }
      }
    }
    function nearest(player,radius=88){return npcs.filter(n=>shown(n)&&!inactive(n)&&Math.abs(n.x-player.x)<radius&&Math.abs(n.depth-player.depth)<27).sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x))[0]||null;}
    function hurtNpc(n,amount,p,knock=false){
      provoke(n,p);n.hp=Math.max(0,n.hp-amount);n.age=0;n.hitUntil=time+.5;n.x+=p.face*(knock?32:16);
      if(n.hp===0){n.state='fall';stats.defeats++;}else n.state=knock?'down':'stagger';
      effect('claws',n.x,n.depth);
    }
    function release(){if(held){held.state='down';held.age=0;held=null;}}
    function grab(p){
      if(hp<=0||phase==='madness'||p.z>9)return false;
      if(held)return throwAtScreen(p);
      const n=nearest(p,90);if(!n)return false;
      provoke(n,p);carryBack();n.state='held';n.age=0;held=n;stats.grabs++;gain(13);lastAction=time;return true;
    }
    function throwAtScreen(p){
      if(!held||hp<=0||phase==='madness')return false;
      const n=held;held=null;provoke(n,p);const before=n.hp;n.hp=Math.max(0,n.hp-32);n.lastDamage=before-n.hp;n.state='screen';n.age=0;n.startX=n.x;n.startDepth=n.depth;n.impacted=false;
      stats.throws++;effect('throw',n.x,n.depth);gain(24);hitStop=.045;lastAction=time;return true;
    }
    function maul(p){
      if(hp<=0||time<attackUntil||p.z>32)return false;
      const n=held||nearest(p,110);if(!n)return false;
      carryBack();if(held===n)held=null;hurtNpc(n,phase==='madness'?100:22,p,phase==='madness');
      stats.mauls++;attackUntil=time+(phase==='madness'?.22:.42);gain(19);hitStop=.055;lastAction=time;return true;
    }
    function hit(amount,p={}){
      if(hp<=0||phase==='madness'||protectedMode||time<hurtUntil)return false;
      hurtUntil=time+.65;effect('hurt',p.x||0,p.depth||0);markFight(p.x||0,p.depth||0);
      if(p.riding){p.hurtRider?.(amount);return true;}
      hp=Math.max(0,hp-amount);
      if(hp===0){release();heat=0;phase='cute';carryBack();defeatAge=0;effect('faint',p.x||0,p.depth||0);}return true;
    }
    function recover(){hp=100;defeatAge=0;hurtUntil=time+2;baby=null;}
    function moveTo(n,tx,td,speed,dt){
      const dx=clamp(tx-n.x,-speed*dt,speed*dt),dy=clamp(td-n.depth,-Math.max(75,speed*.58)*dt,Math.max(75,speed*.58)*dt);
      n.x+=dx;n.depth+=dy;n.face=Math.sign(dx)||n.face;n.distance+=Math.hypot(dx,dy);n.speed=dt>0?Math.hypot(dx,dy)/dt:0;n.moving=n.speed>.5;
    }
    function scheduled(n,p,dt){
      if(!n.schedule)return false;
      const wanted=scheduleOn(n),entry=n.schedule.entryX??n.home,offscreen=Math.max(620,p.populationViewRadius||720);
      if(!n.active){
        setActivity(n,'offstage');n.visible=false;
        if(wanted&&Math.abs(entry-p.x)>offscreen){n.active=n.visible=true;n.x=entry;n.depth=n.sidewalkDepth;n.routeIndex=null;n.departing=false;stats.arrivals++;setActivity(n,'walk');}
        else return true;
      }
      const busy=inactive(n)||n.state!=='idle'||n.hitUntil>time||n.fearUntil>time||n.hiding||(!n.civilian&&(n.hostile||n.angryUntil>time));
      if(wanted){n.departing=false;return false;}
      if(busy)return false;
      n.departing=true;n.activityProp=null;
      const exit=n.schedule.exitX??(Math.abs(n.routeMin-p.x)>Math.abs(n.routeMax-p.x)?n.routeMin:n.routeMax);
      moveTo(n,exit,n.sidewalkDepth,n.walkSpeed||54,dt);setActivity(n,n.moving?'walk':'idle');
      if(Math.abs(n.x-exit)<3&&Math.abs(n.x-p.x)>offscreen){n.active=n.visible=false;n.departing=false;setActivity(n,'offstage');stats.departures++;}
      return true;
    }
    function chooseRoutePoint(n){
      const points=n.routePoints;
      let i=n.routeDirection>0?points.findIndex(q=>q.x>n.x+4):-1;
      if(n.routeDirection<0){for(let j=points.length-1;j>=0;j--)if(points[j].x<n.x-4){i=j;break;}}
      if(i<0){n.routeDirection*=-1;i=n.routeDirection>0?0:points.length-1;}
      n.routeIndex=i;return points[i];
    }
    function routine(n,dt){
      n.running=false;n.hiding=false;
      if(!n.patrol){moveTo(n,n.x,n.homeDepth,60,dt);setActivity(n,'idle');return;}
      if(!n.routineExplicit){
        const patrol=n.patrolVariant,wait=3+patrol*1.25,span=285,speed=24+patrol*3,duration=span*2/speed,cycle=duration*2+wait*2,t=(time+patrol*7)%cycle;
        let target=n.home-span;if(t>wait&&t<wait+duration)target+=speed*(t-wait);else if(t>=wait+duration&&t<wait*2+duration)target=n.home+span;else if(t>=wait*2+duration)target=n.home+span-speed*(t-wait*2-duration);
        moveTo(n,target,n.sidewalkDepth,speed,dt);setActivity(n,n.moving?'walk':'idle');return;
      }
      if(n.restUntil>time){setActivity(n,activityFor(n.activityProp?.kind));return;}
      n.activityProp=null;
      const point=n.routeIndex==null?chooseRoutePoint(n):n.routePoints[n.routeIndex];
      const dist=Math.abs(point.x-n.x),speed=Math.min(n.walkSpeed||54,Math.max(14,dist*2.6));
      moveTo(n,point.x,point.depth??n.sidewalkDepth,speed,dt);setActivity(n,n.moving?'walk':'idle');
      if(Math.abs(n.x-point.x)<2&&Math.abs(n.depth-(point.depth??n.sidewalkDepth))<2){
        n.x=point.x;n.depth=point.depth??n.sidewalkDepth;n.speed=0;n.moving=false;
        n.activityProp={...point};n.restUntil=time+(point.duration??(point.kind==='idle'?3:10));setActivity(n,activityFor(point.kind));
        if(n.routeIndex===0)n.routeDirection=1;else if(n.routeIndex===n.routePoints.length-1)n.routeDirection=-1;
        n.routeIndex=null;
      }
    }
    function frightened(n,dt){
      if(n.fearUntil<=time){
        if(n.hiding||n.hideTarget||n.threat){n.hiding=false;n.hideTarget=null;n.threat=null;n.activityProp=null;n.routeIndex=null;}
        return false;
      }
      if(n.hiding){setActivity(n,'hide');return true;}
      if(time<n.fearReactionUntil){setActivity(n,'cower');return true;}
      const place=n.hideTarget||hidePlace(n,n.threat||{x:n.x-n.face*100,depth:n.depth});n.hideTarget=place;
      moveTo(n,place.x,place.depth??n.sidewalkDepth,n.fleeSpeed||250,dt);n.running=n.moving;setActivity(n,n.moving?'flee':'cower');
      if(Math.abs(n.x-place.x)<7&&Math.abs(n.depth-(place.depth??n.sidewalkDepth))<7){
        n.speed=0;n.moving=n.running=false;
        if(place.kind!=='offscreen'){
          n.hiding=true;n.hideUntil=time+(place.duration||9+n.patrolVariant);n.fearUntil=Math.max(n.fearUntil,n.hideUntil);n.activityProp={...place};setActivity(n,'hide');stats.hides++;
        }
      }
      return true;
    }
    function update(dt,p){
      dt=clamp(dt,0,.05);protectedMode=!!p.godMode;time+=dt;cooldown=Math.max(0,cooldown-dt);hitStop=Math.max(0,hitStop-dt);if(hp===0)defeatAge+=dt;
      if(phase==='madness'){frenzy=Math.max(0,frenzy-dt);if(frenzy===0){phase='cute';heat=0;cooldown=2;lastAction=time;effect('calm',p.x,p.depth);}}
      else if(time-lastAction>3){heat=Math.max(0,heat-dt*3);if(heat<35)phase='cute';}
      for(const n of npcs){
        n.age+=dt;n.activityAge+=dt;n.moving=n.running=false;n.speed=0;
        if(n.civilian){n.hostile=false;n.angryUntil=0;n.punchUntil=0;}
        if(n.civilian&&shown(n)&&lastFight?.until>time&&Math.abs(n.x-lastFight.x)<360&&Math.abs(n.depth-lastFight.depth)<115&&!inactive(n))scare(n,lastFight);
        if(scheduled(n,p,dt))continue;
        if(!shown(n))continue;
        if(n.state==='held'){n.x+=(p.x+p.face*65-n.x)*Math.min(1,dt*22);n.depth=p.depth;n.z=p.z+25;setActivity(n,'held');continue;}
        if(n.state==='screen'){
          setActivity(n,'screen');if(n.age>=.64&&!n.impacted){n.impacted=true;stats.screenImpacts++;effect('screen-smack',n.x,n.depth);}
          if(n.age>1.65){n.state=n.hp===0?'dead':'down';n.age=0;if(n.hp===0)stats.defeats++;}continue;
        }
        if(n.state==='fall'){setActivity(n,'fall');if(n.age>.75){n.state='dead';n.age=0;}continue;}
        if(n.state==='dead'){setActivity(n,'dead');if(n.age>12){n.state='rise';n.age=0;n.hp=n.maxHp;n.angryUntil=0;n.x=n.home;n.depth=n.homeDepth;n.fearUntil=0;n.hiding=false;}continue;}
        if(n.state==='down'){setActivity(n,'down');if(n.age>2.8){n.state='rise';n.age=0;}continue;}
        if(n.state==='rise'){setActivity(n,'rise');if(n.age>.5){n.state='idle';n.age=0;}continue;}
        if(n.state==='stagger'){setActivity(n,'cower');if(n.age>.45){n.state='idle';n.age=0;}else continue;}
        if(phase==='madness'&&!p.riding&&Math.abs(n.x-p.x)<110&&Math.abs(n.depth-p.depth)<29&&p.z<48){hurtNpc(n,100,p,true);stats.frenzyMauls++;attackUntil=time+.22;continue;}
        if(n.civilian&&frightened(n,dt))continue;
        const aggressive=!n.civilian&&(n.hostile||n.angryUntil>time),close=Math.abs(n.x-p.x),lane=Math.abs(n.depth-p.depth);
        if(aggressive&&close<1100&&hp>0){
          n.hiding=false;n.activityProp=null;n.restUntil=0;n.routeIndex=null;n.face=Math.sign(p.x-n.x)||n.face;
          if(n.hostile&&p.riding){setActivity(n,'fight');continue;}
          if(time<n.alertUntil){setActivity(n,'fight');continue;}
          if(n.state==='windup'){
            setActivity(n,'fight');if(n.age>.55){shots.push({id:serial++,kind:n.item||'rock',x:n.x,depth:n.depth,fromX:n.x,fromDepth:n.depth,targetX:p.x,targetDepth:p.depth,age:0,duration:Math.max(.45,close/380),fromZ:n.kind==='gangster'?52:90,z:90});n.state='release';n.age=0;n.nextHit=time+2.2;stats.enemyShots++;markFight(n.x,n.depth);}continue;
          }
          if(n.state==='release'){setActivity(n,'fight');if(n.age>.3){n.state='idle';n.age=0;}continue;}
          if(n.hostile&&close>95&&close<=300){setActivity(n,'fight');if(time>=n.nextHit){n.state='windup';n.age=0;}continue;}
          const stop=n.hostile?280:49,tx=p.x+n.face*-stop;
          moveTo(n,close>stop?tx:n.x,p.depth,n.runSpeed||270,dt);n.running=n.moving;setActivity(n,n.moving?'run':'fight');
          if(close<70&&lane<25&&p.z<30&&time>n.nextHit){n.nextHit=time+1.1;n.punchUntil=time+.25;hit(8,p);effect('counter',n.x,n.depth);markFight(n.x,n.depth);}
        }else routine(n,dt);
      }
      for(const q of shots){
        q.age+=dt;const t=Math.min(1,q.age/q.duration);q.x=q.fromX+(q.targetX-q.fromX)*t;q.depth=q.fromDepth+(q.targetDepth-q.fromDepth)*t;q.z=q.fromZ*(1-t)+48*t+Math.sin(t*Math.PI)*85;
        if(Math.abs(q.x-p.x)<23&&Math.abs(q.depth-p.depth)<24&&Math.abs(q.z-(p.z+60))<48&&p.z<38){hit(q.kind==='bottle'?53:q.kind==='firecracker'?57:55,p);effect('projectile',q.x,q.depth);q.age=99;}
        else if(t===1){effect('projectile',q.x,q.depth);q.age=99;}
      }
      shots=shots.filter(q=>q.age<q.duration);
      effects.forEach(e=>e.age+=dt);effects=effects.filter(e=>e.age<1.2);
      if(baby&&hp>0&&phase==='cute'&&!held&&time-lastAction>4&&!npcs.some(n=>shown(n)&&!inactive(n)&&!n.hostile&&!n.civilian&&n.angryUntil>time&&Math.abs(n.x-p.x)<350)){baby=null;}
    }
    function cancel(calm=false){
      release();phase='cute';heat=0;frenzy=0;baby=null;attackUntil=0;hitStop=0;
      if(calm){lastFight=null;npcs.forEach(n=>{n.angryUntil=0;n.fearUntil=0;n.hiding=false;n.hideTarget=null;n.screamUntil=0;});}
    }
    function lookup(id){for(const list of arenas.values()){const n=list.find(n=>n.id===id);if(n)return {...n};}return null;}
    function snapshot(key){
      const list=key?arenas.get(key)||[]:npcs;
      return {arena,time,heat,phase,frenzy,hp,defeatAge,hurt:time<hurtUntil&&hp>0,invulnerable:phase==='madness'||protectedMode,held:held?.id||null,attack:time<attackUntil,hitStop,baby:baby?{...baby}:null,
        npcs:list.map(n=>({...n,activityProp:n.activityProp?{...n.activityProp}:null,hideTarget:n.hideTarget?{...n.hideTarget}:null,
          fear:n.civilian&&n.fearUntil>time,screaming:n.screamUntil>time,mood:n.civilian?(n.fearUntil>time?'scared':'calm'):n.hostile?'hostile':n.angryUntil>time?'aggressive':'calm',punching:!n.civilian&&(n.punchUntil||0)>time})),
        shots:shots.map(q=>({...q})),effects:effects.map(e=>({...e})),stats:{...stats},
        population:{total:list.length,active:list.filter(shown).length,offstage:list.filter(n=>!shown(n)).length,civilian:list.filter(n=>n.civilian).length,fleeing:list.filter(n=>n.activity==='flee').length,hiding:list.filter(n=>n.hiding).length,resting:list.filter(n=>['sit','read','smoke'].includes(n.activity)).length}};
    }
    return {enter,grab,throwAtScreen,maul,update,hit,recover,cancel,snapshot,lookup};
  }
  window.BearlyBrawler={create};
})();
