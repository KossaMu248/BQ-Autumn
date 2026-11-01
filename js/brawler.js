/* Shared adult population, social aggression and on-foot combat. Cycling physics stay separate. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),inactive=n=>['screen','down','fall','dead','held'].includes(n.state);
  function create(){
    let time=0,heat=0,phase='cute',frenzy=0,cooldown=0,hp=100,hurtUntil=0,lastAction=-99,held=null,attackUntil=0,hitStop=0,baby=null,serial=0,defeatAge=0;
    let npcs=[],effects=[],shots=[],arena='',protectedMode=false;
    const arenas=new Map(),stats={grabs:0,throws:0,mauls:0,frenzyMauls:0,transformations:0,witnesses:0,defeats:0,enemyShots:0,screenImpacts:0};
    function enter(key,items=[],reset=false){
      if(arena===key&&!reset)return;
      release();arena=key;
      if(!arenas.has(key)||reset)arenas.set(key,items.map((n,i)=>({...n,home:n.x,homeDepth:n.depth||0,depth:n.depth||0,id:n.id||`npc-${i}`,variant:n.variant??i%3,state:'idle',age:0,hp:n.hp||60,maxHp:n.hp||60,face:1,distance:0,angryUntil:0,nextHit:time+1.2,hitUntil:0,alertUntil:0})));
      npcs=arenas.get(key);effects=[];shots=[];attackUntil=0;
    }
    function effect(kind,x,depth){effects.push({id:serial++,kind,x,depth,age:0});}
    function gain(amount){
      if(phase==='madness'||cooldown>0)return;
      heat=clamp(heat+amount,0,100);lastAction=time;
      if(heat>=100){release();phase='madness';frenzy=8;stats.transformations++;effect('transform',0,0);}
      else if(heat>=35)phase='apex';
    }
    function carryBack(){baby={position:'back'};}
    function provoke(victim){
      for(const n of npcs){
        if(inactive(n)&&n!==victim)continue;
        if(n===victim||Math.abs(n.x-victim.x)<280&&Math.abs(n.depth-victim.depth)<100){
          if(n!==victim&&n.angryUntil<=time)stats.witnesses++;
          n.angryUntil=Math.max(n.angryUntil,time+12);n.alertUntil=time+(n===victim?.25:.65);n.nextHit=Math.max(n.nextHit,time+.8);
        }
      }
    }
    function nearest(player,radius=88){return npcs.filter(n=>!inactive(n)&&Math.abs(n.x-player.x)<radius&&Math.abs(n.depth-player.depth)<27).sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x))[0]||null;}
    function hurtNpc(n,amount,p,knock=false){
      provoke(n);n.hp=Math.max(0,n.hp-amount);n.age=0;n.hitUntil=time+.5;n.x+=p.face*(knock?32:16);
      if(n.hp===0){n.state='fall';stats.defeats++;}else n.state=knock?'down':'stagger';
      effect('claws',n.x,n.depth);
    }
    function release(){if(held){held.state='down';held.age=0;held=null;}}
    function grab(p){
      if(hp<=0||phase==='madness'||p.z>9)return false;
      if(held)return throwAtScreen(p);
      const n=nearest(p,90);if(!n)return false;
      provoke(n);carryBack();n.state='held';n.age=0;held=n;stats.grabs++;gain(13);lastAction=time;return true;
    }
    function throwAtScreen(p){
      if(!held||hp<=0||phase==='madness')return false;
      const n=held;held=null;provoke(n);const before=n.hp;n.hp=Math.max(0,n.hp-32);n.lastDamage=before-n.hp;n.state='screen';n.age=0;n.startX=n.x;n.startDepth=n.depth;n.impacted=false;
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
      hurtUntil=time+.65;effect('hurt',p.x||0,p.depth||0);
      if(p.riding){p.hurtRider?.(amount);return true;}
      hp=Math.max(0,hp-amount);
      if(hp===0){release();heat=0;phase='cute';carryBack();defeatAge=0;effect('faint',p.x||0,p.depth||0);}return true;
    }
    function recover(){hp=100;defeatAge=0;hurtUntil=time+2;baby=null;}
    function update(dt,p){
      dt=clamp(dt,0,.05);protectedMode=!!p.godMode;time+=dt;cooldown=Math.max(0,cooldown-dt);hitStop=Math.max(0,hitStop-dt);if(hp===0)defeatAge+=dt;
      if(phase==='madness'){frenzy=Math.max(0,frenzy-dt);if(frenzy===0){phase='cute';heat=0;cooldown=2;lastAction=time;effect('calm',p.x,p.depth);}}
      else if(time-lastAction>3){heat=Math.max(0,heat-dt*3);if(heat<35)phase='cute';}
      for(const n of npcs){
        n.age+=dt;n.moving=false;
        if(n.state==='held'){n.x+=(p.x+p.face*65-n.x)*Math.min(1,dt*22);n.depth=p.depth;n.z=p.z+25;continue;}
        if(n.state==='screen'){
          if(n.age>=.64&&!n.impacted){n.impacted=true;stats.screenImpacts++;effect('screen-smack',n.x,n.depth);}
          if(n.age>1.65){n.state=n.hp===0?'dead':'down';n.age=0;if(n.hp===0)stats.defeats++;}continue;
        }
        if(n.state==='fall'){if(n.age>.75){n.state='dead';n.age=0;}continue;}
        if(n.state==='dead'){if(n.age>12){n.state='rise';n.age=0;n.hp=n.maxHp;n.angryUntil=0;n.x=n.home;n.depth=n.homeDepth;}continue;}
        if(n.state==='down'){if(n.age>2.8){n.state='rise';n.age=0;}continue;}
        if(n.state==='rise'){if(n.age>.5){n.state='idle';n.age=0;}continue;}
        if(n.state==='stagger'){if(n.age>.45){n.state='idle';n.age=0;}else continue;}
        if(phase==='madness'&&!p.riding&&Math.abs(n.x-p.x)<110&&Math.abs(n.depth-p.depth)<29&&p.z<48){hurtNpc(n,100,p,true);stats.frenzyMauls++;attackUntil=time+.22;continue;}
        const aggressive=n.hostile||n.angryUntil>time,close=Math.abs(n.x-p.x),lane=Math.abs(n.depth-p.depth);
        if(aggressive&&close<700&&hp>0){
          n.face=Math.sign(p.x-n.x)||n.face;
          if(n.hostile&&p.riding)continue; // The original cycling encounter owns these attacks.
          if(time<n.alertUntil)continue;
          if(n.state==='windup'){
            if(n.age>.55){shots.push({id:serial++,kind:n.item||'rock',x:n.x,depth:n.depth,fromX:n.x,fromDepth:n.depth,targetX:p.x,targetDepth:p.depth,age:0,duration:Math.max(.45,close/380),fromZ:n.kind==='gangster'?52:90,z:90});n.state='release';n.age=0;n.nextHit=time+2.2;stats.enemyShots++;}continue;
          }
          if(n.state==='release'){if(n.age>.3){n.state='idle';n.age=0;}continue;}
          if(n.hostile&&close>95){if(time>=n.nextHit){n.state='windup';n.age=0;}continue;}
          const dx=Math.sign(p.x-n.x)*Math.min(Math.max(0,close-49),95*dt),dy=Math.sign(p.depth-n.depth)*Math.min(lane,55*dt);
          n.x+=dx;n.depth+=dy;n.distance+=Math.hypot(dx,dy);n.moving=Math.hypot(dx,dy)>.02;
          if(close<70&&lane<25&&p.z<30&&time>n.nextHit){n.nextHit=time+1.1;n.punchUntil=time+.25;hit(8,p);effect('counter',n.x,n.depth);}
        }else if(n.patrol){
          const patrol=n.patrolVariant??n.variant%3;
          const wait=3+patrol*1.25,span=285,speed=24+patrol*3,duration=span*2/speed,cycle=duration*2+wait*2,t=(time+patrol*7)%cycle;
          let target=n.home-span;if(t>wait&&t<wait+duration)target+=speed*(t-wait);else if(t>=wait+duration&&t<wait*2+duration)target=n.home+span;else if(t>=wait*2+duration)target=n.home+span-speed*(t-wait*2-duration);
          const dx=clamp(target-n.x,-speed*dt,speed*dt);n.x+=dx;n.face=Math.sign(dx)||n.face;n.distance+=Math.abs(dx);n.moving=Math.abs(dx)>.02;
        }
      }
      for(const q of shots){
        q.age+=dt;const t=Math.min(1,q.age/q.duration);q.x=q.fromX+(q.targetX-q.fromX)*t;q.depth=q.fromDepth+(q.targetDepth-q.fromDepth)*t;q.z=q.fromZ*(1-t)+48*t+Math.sin(t*Math.PI)*85;
        if(Math.abs(q.x-p.x)<23&&Math.abs(q.depth-p.depth)<24&&Math.abs(q.z-(p.z+60))<48&&p.z<38){hit(q.kind==='bottle'?53:q.kind==='firecracker'?57:55,p);effect('projectile',q.x,q.depth);q.age=99;}
        else if(t===1){effect('projectile',q.x,q.depth);q.age=99;}
      }
      shots=shots.filter(q=>q.age<q.duration);
      effects.forEach(e=>e.age+=dt);effects=effects.filter(e=>e.age<1.2);
      if(baby&&hp>0&&phase==='cute'&&!held&&time-lastAction>4&&!npcs.some(n=>!inactive(n)&&!n.hostile&&n.angryUntil>time&&Math.abs(n.x-p.x)<350)){baby=null;}
    }
    function cancel(calm=false){release();phase='cute';heat=0;frenzy=0;baby=null;attackUntil=0;hitStop=0;if(calm)npcs.forEach(n=>n.angryUntil=0);}
    function lookup(id){for(const list of arenas.values()){const n=list.find(n=>n.id===id);if(n)return {...n};}return null;}
    function snapshot(key){return {arena,time,heat,phase,frenzy,hp,defeatAge,hurt:time<hurtUntil&&hp>0,invulnerable:phase==='madness'||protectedMode,held:held?.id||null,attack:time<attackUntil,hitStop,baby:baby?{...baby}:null,npcs:(key?arenas.get(key)||[]:npcs).map(n=>({...n,mood:n.hostile?'hostile':n.angryUntil>time?'aggressive':'calm',punching:(n.punchUntil||0)>time})),shots:shots.map(q=>({...q})),effects:effects.map(e=>({...e})),stats:{...stats}};}
    return {enter,grab,throwAtScreen,maul,update,hit,recover,cancel,snapshot,lookup};
  }
  window.BearlyBrawler={create};
})();
