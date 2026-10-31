/* Adult NPC brawler states, independent of the cycling simulation and quest save. */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function create(){
    let time=0,heat=0,phase='cute',frenzy=0,cooldown=0,hp=100,hurtUntil=0,lastAction=-99,held=null,attackUntil=0,hitStop=0,baby=null,serial=0;
    let npcs=[],effects=[],arena='',protectedMode=false;
    const stats={grabs:0,throws:0,mauls:0,frenzyMauls:0,transformations:0};
    function enter(key,items){
      if(arena===key&&npcs.length)return;
      release();arena=key;npcs=items.map((n,i)=>({...n,home:n.x,homeDepth:n.depth||0,depth:n.depth||0,id:n.id||`npc-${i}`,variant:n.variant??i%3,state:'idle',age:0,angryUntil:0,nextHit:0,hitUntil:0}));
      effects=[];baby=null;attackUntil=0;
    }
    function effect(kind,x,depth){effects.push({id:serial++,kind,x,depth,age:0});}
    function gain(amount){
      if(phase==='madness'||cooldown>0)return;
      heat=clamp(heat+amount,0,100);lastAction=time;
      if(heat>=100){release();phase='madness';frenzy=8;held=null;stats.transformations++;effect('transform',0,0);}
      else if(heat>=35)phase='apex';
    }
    function shelter(player){if(!baby)baby={x:player.x-85,depth:clamp(player.depth-25,-75,50)};}
    function nearest(player,radius=88){
      return npcs.filter(n=>!['screen','down','held'].includes(n.state)&&Math.abs(n.x-player.x)<radius&&Math.abs(n.depth-player.depth)<25).sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x))[0]||null;
    }
    function release(){if(held){held.state='down';held.age=0;held.angryUntil=0;held=null;}}
    function grab(player){
      if(phase==='madness'||player.z>9)return false;
      if(held)return throwAtScreen(player);
      const n=nearest(player,90);if(!n)return false;
      shelter(player);n.state='held';n.age=0;held=n;stats.grabs++;gain(13);lastAction=time;return true;
    }
    function throwAtScreen(player){
      if(!held||phase==='madness')return false;
      const n=held;held=null;n.state='screen';n.age=0;n.startX=n.x;n.startDepth=n.depth;n.angryUntil=0;
      stats.throws++;effect('throw',n.x,n.depth);gain(24);hitStop=.045;lastAction=time;return true;
    }
    function maul(player){
      if(time<attackUntil||player.z>32)return false;
      const n=held||nearest(player,110);if(!n)return false;
      shelter(player);if(held===n)held=null;
      n.state=phase==='madness'?'down':'stagger';n.age=0;n.angryUntil=phase==='madness'?0:time+5;n.nextHit=time+1.1;n.hitUntil=time+.45;
      n.x+=player.face*22;stats.mauls++;attackUntil=time+(phase==='madness'?.22:.42);gain(19);hitStop=.055;effect('claws',n.x,n.depth);lastAction=time;return true;
    }
    function hit(amount){
      if(phase==='madness'||protectedMode||time<hurtUntil)return false;
      hp=Math.max(0,hp-amount);hurtUntil=time+.65;effect('hurt',0,0);
      if(hp===0){release();heat=0;phase='cute';baby=null;effect('faint',0,0);}return true;
    }
    function recover(){hp=100;hurtUntil=time+2;}
    function update(dt,player){
      dt=clamp(dt,0,.05);protectedMode=!!player.godMode;time+=dt;cooldown=Math.max(0,cooldown-dt);hitStop=Math.max(0,hitStop-dt);
      if(phase==='madness'){
        frenzy=Math.max(0,frenzy-dt);
        if(frenzy===0){phase='cute';heat=0;cooldown=2;lastAction=time;effect('calm',player.x,player.depth);}
      }else if(time-lastAction>3){heat=Math.max(0,heat-dt*3);if(heat<35)phase='cute';}
      for(const n of npcs){
        n.age+=dt;
        if(n.state==='held'){n.x+=(player.x+player.face*65-n.x)*Math.min(1,dt*22);n.depth=player.depth;n.z=player.z+25;continue;}
        if(n.state==='screen'){if(n.age>.95){n.state='down';n.age=0;}continue;}
        if(n.state==='down'){if(n.age>2.8){n.state='idle';n.age=0;n.angryUntil=0;}continue;}
        if(n.state==='stagger'&&n.age>.5){n.state='idle';n.age=0;}
        if(phase==='madness'&&Math.abs(n.x-player.x)<110&&Math.abs(n.depth-player.depth)<29&&player.z<48){
          n.state='down';n.age=0;n.x+=player.face*38;n.angryUntil=0;stats.frenzyMauls++;attackUntil=time+.22;effect('claws',n.x,n.depth);continue;
        }
        if(n.angryUntil>time&&n.state==='idle'){
          n.x+=Math.sign(player.x-n.x)*Math.min(Math.abs(player.x-n.x),65*dt);
          n.depth+=Math.sign(player.depth-n.depth)*Math.min(Math.abs(player.depth-n.depth),45*dt);
          if(Math.abs(n.x-player.x)<68&&Math.abs(n.depth-player.depth)<24&&player.z<28&&time>n.nextHit){n.nextHit=time+1.1;hit(8);effect('counter',n.x,n.depth);}
        }else if(n.state==='idle'&&n.patrol){
          const p=(time*.045+n.variant*.37)%2,walk=p<.85||p>1&&p<1.85;
          if(walk)n.x+=((p<1?1:-1)*19)*dt;
          n.x=clamp(n.x,n.home-90,n.home+90);
        }
      }
      effects.forEach(e=>e.age+=dt);effects=effects.filter(e=>e.age<1.2);
      if(baby&&phase==='cute'&&!held&&time-lastAction>5&&!npcs.some(n=>n.angryUntil>time)){baby=null;}
    }
    function cancel(){release();phase='cute';heat=0;frenzy=0;baby=null;attackUntil=0;hitStop=0;npcs.forEach(n=>{n.angryUntil=0;if(n.state==='screen'){n.state='down';n.age=0;}});}
    function snapshot(){return {time,heat,phase,frenzy,hp,invulnerable:phase==='madness'||protectedMode,held:held?.id||null,attack:time<attackUntil,hitStop,baby:baby?{...baby}:null,npcs:npcs.map(n=>({...n})),effects:effects.map(e=>({...e})),stats:{...stats}};}
    return {enter,grab,throwAtScreen,maul,update,hit,recover,cancel,snapshot};
  }
  window.BearlyBrawler={create};
})();
