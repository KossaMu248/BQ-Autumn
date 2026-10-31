/* Playable side areas: compact rooms, walking docks/gardens and a boat level. */
(() => {
  'use strict';
  const host=document.querySelector('.canvas-wrap'),shell=document.querySelector('.game-shell');
  const quests=window.BearlyQuests.game,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rideTools=document.createElement('div');rideTools.className='ride-utilities';rideTools.hidden=true;
  rideTools.innerHTML='<button type="button" class="dismount-button">DISMOUNT · Q</button>';
  shell.insertBefore(rideTools,document.querySelector('.touch-controls'));
  const dismountButton=rideTools.querySelector('button');
  const prompt=document.createElement('button');prompt.className='visit-prompt';prompt.type='button';prompt.hidden=true;host.append(prompt);
  const panel=document.createElement('section');panel.className='area-panel';panel.hidden=true;
  panel.setAttribute('aria-label','Location and quests');
  panel.innerHTML='<div class="area-heading"><strong class="area-name"></strong><button type="button" class="area-fullscreen" aria-label="Fullscreen">⛶</button><button type="button" class="area-settings" aria-label="Settings">⚙</button><button type="button" class="area-exit">BACK TO BIKE ↗</button></div><p class="area-message" aria-live="polite"></p><p class="area-quest"></p>';
  const controls=document.createElement('div');controls.className='area-controls';controls.hidden=true;
  controls.innerHTML='<div class="area-dpad"><button type="button" data-depth="-1" aria-label="Move up the ground plane">↑</button><button type="button" data-direction="-1" aria-label="Move left">←</button><button type="button" data-depth="1" aria-label="Move down the ground plane">↓</button><button type="button" data-direction="1" aria-label="Move right">→</button></div><div class="area-moves"><button type="button" class="area-jump">JUMP · SPACE</button><button type="button" class="area-grab">GRAB · G</button><button type="button" class="area-maul">MAUL · J</button><button type="button" class="area-action">TALK · E</button></div>';
  const status=document.createElement('div');status.className='brawl-status';status.innerHTML='<span class="brawl-hp">HP 100</span><div class="primal-track" role="progressbar" aria-label="Primal meter" aria-valuemin="0" aria-valuemax="100"><i></i></div><strong>CUTE</strong>';
  panel.append(status);

  shell.append(panel,controls);
  const nameEl=panel.querySelector('.area-name'),messageEl=panel.querySelector('.area-message'),questEl=panel.querySelector('.area-quest'),actionButton=controls.querySelector('.area-action');
  const journal=document.createElement('div');journal.className='adventure-journal';journal.hidden=true;host.append(journal);
  const art={};
  for(const [key,file] of Object.entries({transfer:'bike-transfer-v7.png',workshop:'workshop-interior-v7.png',room:'pizzeria-walkable-v7.png',people:'front-carrier-v7.png',passengers:'boat-passengers-v8.png',parts:'walking-leg-parts-v8.png',boat:'dinghy-v7.png',water:'waterfront.png',forest:'forest.png',verge:'autumn-verge.png'})){
    const im=new Image();im.src='assets/art/'+file;art[key]=im;
  }
  let candidate=null,context=null,place=null,mode=null,x=160,velocity=0,face=1,clock=0,stride=0,fade=0,focused=null,paused=false,lastMessage='';
  let walkWeight=0,pendingStepOff=false,streetEntry=false,streetReturn=0,returning=false;
  const combat=window.BearlyBrawler.create();let combatState=combat.snapshot();
  let depth=0,depthVelocity=0,jumpZ=0,jumpVelocity=0,streetReturnDepth=0,externalShadow=false,viewOffset=0,practiceQueue=false;
  let transition=null,pendingEntry=false;
  const land=()=>!!mode&&mode!=='water';
  const player=()=>({x,depth,z:jumpZ,face,godMode:!!context?.godMode});
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const held=new Set(),contacts=new Map(),buoys=[1150,2450,3900],seeds=[1050,1540,2110];
  const transferFrames=[[57,13,490,484,307,495],[607,9,341,493,780,500],[1121,8,304,494,1258,500],[110,516,347,493,258,1007],[604,515,340,495,772,1008],[1112,517,287,495,1259,1010]];
  const floor=535;
  const lawn=document.createElement('canvas');lawn.width=lawn.height=128;const lg=lawn.getContext('2d');lg.fillStyle='#66754b';lg.fillRect(0,0,128,128);
  for(let i=0;i<1500;i++){const h=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v);};lg.fillStyle=['#b6ac5c40','#364c392a','#d5b87033'][i%3];lg.fillRect(h(i)*128,h(i+501)*128,1+h(i+135)*2,1);}

  function setMessage(text){if(text!==lastMessage){messageEl.textContent=text;lastMessage=text;}}
  function clear(){held.clear();contacts.clear();for(const b of controls.querySelectorAll('[data-direction],[data-depth]'))b.classList.remove('held');}
  function eligible(s){return s?.playing&&s.grounded&&Math.abs(s.speed)<45;}
  function choose(next,start){
    mode=next;x=start;velocity=0;depth=0;depthVelocity=0;jumpZ=0;jumpVelocity=0;fade=.45;paused=false;clear();setupCombat();refresh();
  }
  function setupCombat(){
    combat.cancel();
    const npcs=mode==='street'?[
      {id:'near-a',x:x+155,depth:0,variant:0,patrol:true},
      {id:'near-b',x:x+330,depth:35,variant:1,patrol:true},
      {id:'near-c',x:x-190,depth:-35,variant:2,patrol:true},
      ...window.BearlyNeighbourhood.scenes.map((b,i)=>({id:'place-'+b.key,x:b.x+b.w*.5,depth:-60,variant:i%3,patrol:true}))
    ]:mode==='room'?[{id:'host',x:870,depth:-35,variant:place.role==='workshop'?0:place.role==='pizza'?2:1}]:mode==='dock'?[{id:'keeper',x:730,depth:0,variant:0}]:mode==='garden'?[{id:'gardener',x:590,depth:0,variant:1}]:[];
    combat.enter(mode+':'+(mode==='street'?'route':place.key),npcs);combatState=combat.snapshot();
    if(practiceQueue&&mode==='street'){combat.enter('practice-'+clock,[{id:'practice-a',x:x+65,depth:0,variant:0},{id:'practice-b',x:x+165,depth:25,variant:1},{id:'practice-c',x:x+270,depth:-25,variant:2}]);practiceQueue=false;combatState=combat.snapshot();}
  }
  function jump(){
    if(!land()||paused||transition||jumpZ>1)return;
    jumpVelocity=mode==='street'?355:455;returning=false;
  }
  function grab(){
    if(!land()||paused||transition||!window.BearlyBrawlArt.ready())return;
    if(combat.grab(player())){combatState=combat.snapshot();setMessage(combatState.held?'GRABBED · Press G / Grab again to throw toward the screen.':'THROWN · Right at the screen!');}
    else setMessage('Move close to an adult NPC in the same lane to grab.');
  }
  function maul(){
    if(!land()||paused||transition||!window.BearlyBrawlArt.ready())return;
    if(combat.maul(player())){combatState=combat.snapshot();setMessage(combatState.phase==='rolling'?'MADNESS BOWLING · Eight seconds of invulnerability. Steer through the crowd!':combatState.phase==='primal'?'PRIMAL · The cute bear is losing its composure…':'CLAWS OUT · Successful attacks build Primal.');}
  }
  function enter(){
    if(mode==='street'){enterFromStreet();return;}
    if(transition||!candidate||!eligible(context)||!art.people.naturalWidth||!art.transfer.naturalWidth||!art.parts.naturalWidth)return;
    place=candidate;focused=document.activeElement;context.clearInput();clock=0;stride=0;face=1;paused=false;
    streetEntry=false;transition={kind:'dismount',elapsed:0,duration:2.4,goal:'entry'};
    if(place.role==='water')quests.act('start');
    document.body.classList.add('autumn-exploring');prompt.hidden=true;panel.hidden=false;controls.hidden=false;
    panel.querySelector('.area-exit').focus();setMessage('Stopping, parking the bike, and settling the baby into the front carrier…');refresh(false);
  }
  function stepOff(){
    if(mode||transition||!context?.playing)return;
    pendingStepOff=!pendingStepOff;
  }
  function startStreet(){
    pendingStepOff=false;streetEntry=false;returning=false;walkWeight=0;
    focused=document.activeElement;context.clearInput();clock=0;stride=0;face=1;paused=false;
    place={key:'road',label:'HÄSSELBY · ON FOOT',role:'street'};
    transition={kind:'dismount',elapsed:0,duration:2.1,goal:'street'};
    document.body.classList.add('autumn-exploring');prompt.hidden=true;panel.hidden=false;controls.hidden=false;
    setMessage('Parking here and settling the baby into the front carrier…');refresh(false);
  }
  function enterFromStreet(){
    const b=window.BearlyNeighbourhood.nearestEntrance(x);if(!b)return;
    if(jumpZ>3)return;place=b;streetReturnDepth=depth;if(b.role==='water')quests.act('start');streetEntry=true;streetReturn=x;clear();velocity=0;
    transition={kind:'door-enter',elapsed:0,duration:.65,goal:'entry'};
    setMessage('Walking inside…');refresh(false);
  }
  function close(){
    if(!mode&&!transition){pendingStepOff=false;return;}
    pendingStepOff=false;returning=false;combat.cancel();combatState=combat.snapshot();jumpZ=0;jumpVelocity=0;depth=0;
    context?.clearInput();clear();transition=null;pendingEntry=false;document.getElementById('mobilePauseBtn').textContent='Ⅱ PAUSE';mode=null;place=null;panel.hidden=true;controls.hidden=true;
    document.body.classList.remove('autumn-exploring');focused?.focus();
  }
  function leave(){
    if(transition)return;
    if(jumpZ>3)return;
    paused=false;combat.cancel();combatState=combat.snapshot();
    if(mode==='water'){quests.act('return');choose('dock',1980);transition={kind:'land',elapsed:0,duration:1.2};setMessage('Bringing the dinghy alongside and stepping back onto the dock…');}
    else if(mode==='street'){
      if(Math.abs(x-context.x-28)>55||Math.abs(depth)>15){clear();returning=true;setMessage('Walking back to the parked bicycle. Use a direction button to cancel.');return;}
      context.clearInput();clear();transition={kind:'mount',elapsed:0,duration:2.1,goal:'street'};mode=null;
      setMessage('Securing the baby in the rear seat and getting back on the bicycle…');refresh(false);
    }
    else if(streetEntry){clear();mode=null;x=streetReturn;transition={kind:'door-exit',elapsed:0,duration:.65};setMessage('Stepping outside. Your bicycle is still where you parked it.');refresh(false);}
    else {context?.clearInput();clear();mode=null;transition={kind:'mount',elapsed:0,duration:2.4,goal:'entry'};setMessage('Returning to the bicycle, settling the baby in the rear seat, and getting ready to ride…');refresh(false);}
  }
  function stepTransition(dt){
    transition.elapsed+=dt;
    if(transition.elapsed<transition.duration)return;
    const {kind,goal}=transition;transition=null;
    if(kind==='dismount'&&goal==='street'){choose('street',context.x+28);fade=0;setMessage('On foot · Arrows / WASD move. Space jumps; G grabs or throws; J mauls. E enters buildings; Q returns to your bicycle.');}
    else if(kind==='door-exit'){choose('street',streetReturn);depth=streetReturnDepth;fade=0;}
    else if(kind==='dismount'||kind==='door-enter'){choose(place.role==='water'?'dock':['park','castle'].includes(place.role)?'garden':'room',160);fade=.25;}
    else if(kind==='mount'){transition={kind:'done'};close();}
    else if(kind==='board'){choose('water',180);setMessage('MÄLAREN · Steer with ← → or A/D. Pass the three golden buoys, then return to the dock.');}
    else {x=1980;refresh(false);}
  }
  function targets(){
    if(!mode||!place)return [];
    const q=quests.snapshot();
    if(mode==='street'){
      const b=window.BearlyNeighbourhood.nearestEntrance(x);
      return [...(b?[{x:window.BearlyNeighbourhood.entrance(b).x,label:'ENTER '+b.label,kind:'enter'}]:[]),{x:context.x+28,label:'MOUNT BICYCLE',kind:'remount'}];
    }
    if(mode==='water')return [{x:180,label:'MOOR AT THE DOCK',kind:'moor'}];
    if(mode==='dock')return [{x:115,label:'BACK TO BIKE',kind:'exit'},{x:730,label:q.lunch?'DELIVER LUNCH':'TALK TO BOATKEEPER',kind:'keeper'},{x:2050,label:!q.repaired?'PATCH THE DINGHY':q.boatReady?'BOARD BOAT':'CHECK THE BOAT',kind:'boat'}];
    if(mode==='garden')return [{x:115,label:'BACK TO BIKE',kind:'exit'},{x:590,label:place.role==='park'?'TALK TO GARDENER':'READ GARDEN SIGN',kind:'gardener'},...seeds.filter((_,i)=>place.role==='park'&&!q.seeds.includes(i)).map(v=>({x:v,label:'PICK UP SEED PACKET',kind:'seed',id:seeds.indexOf(v)}))];
    const kind=place.role==='pizza'?'lunch':place.role==='workshop'?'kit':place.role==='library'?'chart':'talk';
    const label=kind==='lunch'?(q.lunch||q.delivered?'TALK TO COOK':'COLLECT BOATKEEPER’S LUNCH'):kind==='kit'?(q.kit||q.repaired?'TALK TO MECHANIC':'BORROW PATCH KIT'):kind==='chart'?'READ LAKE CHART':'TALK';
    return [{x:115,label:'BACK TO BIKE',kind:'exit'},{x:790,label,kind}];
  }
  function nearby(){return targets().find(t=>Math.abs(t.x-x)<105)||null;}
  function act(){
    if(paused||transition||fade>0||jumpZ>3)return;
    const t=nearby(),q=quests.snapshot();if(!t){if(mode==='street')leave();return;}
    switch(t.kind){
      case 'exit':case 'remount':leave();return;
      case 'enter':enterFromStreet();return;
      case 'moor':leave();return;
      case 'lunch':quests.act('lunch');setMessage(q.delivered?'COOK · Thanks for taking lunch to the boatkeeper. Enjoy the lake!':q.lunch?'COOK · It’s wrapped up warm. The boatkeeper is at Mälaren’s boathouse.':'COOK · Could you take this warm lunch to the boatkeeper? There’s room in your satchel.');break;
      case 'kit':quests.act('kit');setMessage(q.repaired?'MECHANIC · That little boat should hold water now. Happy sailing!':'MECHANIC · Here’s a patch kit for the leaky dinghy. Use it beside the boat at the boathouse.');break;
      case 'chart':quests.act('chart');setMessage('LIBRARIAN · Three golden buoys mark our lake trail. I’ve marked their distances on your chart. Bring the boat back when you’ve found them.');break;
      case 'keeper':
        if(q.lunch){quests.act('deliver');setMessage('BOATKEEPER · Warm lunch! Thank you. Patch the dinghy with a kit from the bike workshop, then take it out to check our three buoys.');}
        else setMessage(q.voyage?'BOATKEEPER · All three buoys checked. Well sailed, both of you! You can borrow the boat again.':q.boatReady?'BOATKEEPER · Lunch delivered and the leak fixed. The boat is ready—walk to the far end of the dock.':q.delivered?'BOATKEEPER · Thanks for lunch. The dinghy is at the far end of the dock. It needs a patch kit from the bike workshop.':'BOATKEEPER · Fancy a lake trip? Bring me lunch from Pizza & Kebab, and borrow a patch kit from the bike workshop for the dinghy.');break;
      case 'boat':
        if(!q.repaired){if(q.kit){quests.act('repair');setMessage(q.delivered?'BEAR · Patch pressed, leak fixed. The boatkeeper has lunch. Ready for the lake!':'BEAR · Patch pressed, leak fixed. Now bring the boatkeeper lunch before borrowing it.');}else setMessage('The dinghy has a small leak. Borrow a patch kit from the bike workshop.');}
        else if(!q.boatReady)setMessage('The dinghy is patched. Bring the boatkeeper lunch from Pizza & Kebab before borrowing it.');
        else {clear();transition={kind:'board',elapsed:0,duration:1.2};setMessage('Stepping aboard and sitting down with the baby safely in the front carrier…');}
        break;
      case 'seed':quests.act('seed',t.id);setMessage('A lost seed packet, safe in your satchel. Find all three and bring them to the gardener.');break;
      case 'gardener':
        if(place.role!=='park'){setMessage('MANOR GARDEN · A quiet detour through the autumn trees. Your bicycle is waiting at the entrance.');break;}
        if(q.seeds.length===3){quests.act('garden');setMessage('GARDENER · All three seed packets! Thank you—next spring’s flowers are safe.');}
        else setMessage(`GARDENER · The wind scattered three seed packets along the garden path. Could you find them? You have ${q.seeds.length} of 3.`);
        break;
      default:setMessage(place.role==='cafe'?'BAKER · The boatkeeper likes a warm lunch. Try Pizza & Kebab on the market street.':'NEIGHBOUR · Welcome in. There’s a lovely walk at the greenhouse and a boat down by the boathouse.');
    }
    refresh(false);
  }
  function refresh(initial=true){
    if(!mode&&!transition)return;
    const q=quests.snapshot(),t=nearby();
    if(transition){document.getElementById('mobilePauseBtn').textContent=paused?'▶ RESUME':'Ⅱ PAUSE';nameEl.textContent=paused?'PAUSED':transition.kind==='dismount'?'PARKING THE BICYCLE':transition.kind==='mount'?'BACK TO THE BICYCLE':transition.kind==='board'?'BOARDING THE DINGHY':transition.kind.startsWith('door')?'AT THE DOORWAY':'STEPPING ASHORE';actionButton.disabled=true;actionButton.textContent='ONE MOMENT…';panel.querySelector('.area-exit').disabled=true;return;}
    panel.querySelector('.area-exit').disabled=false;
    const pauseButton=document.getElementById('mobilePauseBtn');pauseButton.textContent=paused?'▶ RESUME':'Ⅱ PAUSE';pauseButton.setAttribute('aria-label',paused?'Resume exploration':'Pause exploration');
    nameEl.textContent=paused?'PAUSED':mode==='water'?'MÄLAREN · BUOY TRAIL':mode==='dock'?'MÄLARENS BÅTHUS · DOCK':mode==='garden'?place.label+' · GARDEN':mode==='street'?'HÄSSELBY · ON FOOT':place.label;
    panel.querySelector('.area-exit').textContent=mode==='water'?'BACK TO DOCK ↗':streetEntry&&mode!=='street'?'BACK OUTSIDE ↗':'BACK TO BIKE ↗';
    actionButton.disabled=(!t&&mode!=='street')||paused;actionButton.textContent=t?t.label+' · E':mode==='street'?'WALK BACK TO BIKE · Q':'WALK CLOSER';
    controls.dataset.mode=mode;
    controls.querySelector('.area-grab').textContent=combatState.held?'THROW · G':'GRAB · G';
    for(const cls of ['.area-grab','.area-maul','.area-jump'])controls.querySelector(cls).disabled=mode==='water'||paused;
    status.querySelector('.brawl-hp').textContent='HP '+combatState.hp;
    const meter=status.querySelector('.primal-track'),value=combatState.phase==='rolling'?combatState.frenzy/8*100:combatState.heat;
    meter.setAttribute('aria-valuenow',String(Math.round(value)));meter.querySelector('i').style.width=value+'%';
    status.dataset.phase=combatState.phase;status.querySelector('strong').textContent=combatState.phase==='rolling'?`MADNESS · ${combatState.frenzy.toFixed(1)}s · INVULNERABLE`:combatState.phase==='primal'?'PRIMAL':combatState.baby?'BABY IN SAFE SEAT · COOLING DOWN':'CUTE';
    status.hidden=mode==='water';
    questEl.textContent=place.role==='park'?`GARDENER’S FAVOUR · Seeds ${q.seeds.length}/3${q.garden?' · Returned ✓':''}`:q.voyage?'LAKE TRAIL COMPLETE · The boat is yours to borrow.':q.started?`BOATKEEPER’S FAVOUR · Lunch ${q.delivered?'delivered ✓':q.lunch?'in satchel':'needed'} · Dinghy ${q.repaired?'patched ✓':q.kit?'kit in satchel':'needs patch kit'} · Buoys ${q.buoys.length}/3`: 'Arrows / WASD move · Space jump · E interact · G grab/throw · J maul';
    if(initial)setMessage(mode==='dock'?'Walk along the dock to meet the boatkeeper. The dinghy is moored at the far end.':mode==='garden'?'A path beyond the building. Walk further to explore; talk to the gardener along the way.':'You leave the bicycle outside. Walk over to the counter to talk. The baby rides safely in a front carrier.');
  }
  function update(s){
    context=s;
    rideTools.hidden=!!mode||!!transition||!s.playing;
    if(s.debugOpen){clear();return;}
    if(transition){if(!paused)stepTransition(Math.min(.05,Math.max(0,s.dt||0)));refresh(false);return;}
    const q=quests.snapshot();journal.hidden=!!mode||!s.playing||!q.started;
    journal.textContent=q.voyage?'LAKE TRAIL COMPLETE ✓':q.delivered&&q.repaired?`MÄLAREN · Buoys ${q.buoys.length}/3 · Return to the boatkeeper`:`BOATKEEPER · Lunch ${q.delivered?'✓':q.lunch?'packed':'at Pizza & Kebab'} · Patch ${q.repaired?'✓':q.kit?'kit packed':'at workshop'}`;
    if(!mode){if(!s.playing)pendingStepOff=false;candidate=s.playing?window.BearlyNeighbourhood.nearestEntrance(s.x):null;prompt.hidden=!candidate;const ready=art.people.naturalWidth>0&&art.transfer.naturalWidth>0&&art.parts.naturalWidth>0&&art.passengers.naturalWidth>0;
      dismountButton.disabled=!ready;dismountButton.textContent=pendingStepOff?'SLOWING TO DISMOUNT…':'DISMOUNT · Q';
      if(pendingStepOff&&s.playing&&ready&&s.brakeToStop?.()){startStreet();return;}
      if(candidate){prompt.disabled=!eligible(s)||!ready;prompt.textContent=!ready?'GETTING READY…':eligible(s)?`ENTER ${candidate.label} · E`:`STOP TO VISIT ${candidate.label}`;}if(pendingEntry&&candidate&&eligible(s)&&ready){pendingEntry=false;enter();}return;}
    const dt=Math.min(.05,Math.max(0,s.dt||0));if(paused)return;
    if(held.has('maul'))maul();
    const moveDt=combatState.hitStop>0?0:dt;
    clock+=dt;fade=Math.max(0,fade-dt);
    let dir=(held.has('right')||[...contacts.values()].includes(1)?1:0)-(held.has('left')||[...contacts.values()].includes(-1)?1:0);
    let vertical=(held.has('down')||[...contacts.values()].includes('down')?1:0)-(held.has('up')||[...contacts.values()].includes('up')?1:0);
    if(mode==='street'&&returning){
      if(dir||vertical)returning=false;
      else if(Math.abs(x-context.x-28)<7&&Math.abs(depth)<7){returning=false;x=context.x+28;depth=0;velocity=0;leave();return;}
      else {dir=Math.abs(x-context.x-28)>4?Math.sign(context.x+28-x):0;vertical=Math.abs(depth)>4?-Math.sign(depth):0;}
    }
    if(dir)face=dir;
    if(mode==='water'){
      velocity+=(dir*260-velocity)*Math.min(1,dt*3);x=clamp(x+velocity*dt,110,4550);stride+=Math.abs(velocity)*dt;
      buoys.forEach((bx,i)=>{if(Math.abs(x-bx)<85&&!quests.snapshot().buoys.includes(i)){quests.act('buoy',i);setMessage(`BUOY ${i+1} CHECKED · ${quests.snapshot().buoys.length===3?'All three! Return left to the dock.':'Keep exploring the lake.'}`);}});
    }else {
      const rolling=combatState.phase==='rolling',speed=rolling?410:combatState.phase==='primal'?235:200;
      const horizontal=rolling?(dir||face):dir,diagonal=horizontal&&vertical?Math.SQRT1_2:1;
      const target=fade>0?0:horizontal*speed*diagonal,rate=horizontal?1200:1600;
      velocity+=clamp(target-velocity,-rate*dt,rate*dt);
      const next=x+velocity*moveDt;
      if(mode!=='street'||s.road?.groundAt(next)!=null)x=clamp(next,mode==='street'?60:80,mode==='street'?s.road.finish-60:mode==='room'?1040:mode==='dock'?2250:2320);
      else velocity=0;

      if(mode==='street')s.followFoot?.(x);
    }
    const depthTarget=vertical*(mode==='water'?95:140)*(dir?Math.SQRT1_2:1);
    depthVelocity+=clamp(depthTarget-depthVelocity,-1000*dt,1000*dt);
    const bounds=mode==='street'?[-90,65]:mode==='room'?[-36,60]:mode==='water'?[-35,40]:[-35,40];
    depth=clamp(depth+depthVelocity*moveDt,...bounds);
    if(mode!=='water')stride+=Math.hypot(velocity,depthVelocity)*moveDt;
    if(jumpZ>0||jumpVelocity>0){jumpZ+=jumpVelocity*moveDt;jumpVelocity-=1050*moveDt;if(jumpZ<=0){jumpZ=0;jumpVelocity=0;}}
    combat.update(dt,player());combatState=combat.snapshot();
    if(combatState.hp===0){combat.cancel();combat.recover();combatState=combat.snapshot();x=mode==='street'?context.x+28:160;depth=0;jumpZ=0;setMessage('The bear shakes it off back by the entrance.');}
    walkWeight+=(Math.min(1,Math.hypot(velocity,depthVelocity)/120)-walkWeight)*(1-Math.exp(-dt*16));
    refresh(false);
  }
  function bindHold(button,direction){
    button.addEventListener('pointerdown',e=>{e.preventDefault();contacts.set(e.pointerId,direction);button.classList.add('held');try{button.setPointerCapture?.(e.pointerId);}catch(_){}});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>{contacts.delete(e.pointerId);button.classList.remove('held');});
  }
  for(const b of controls.querySelectorAll('[data-direction]'))bindHold(b,Number(b.dataset.direction));
  for(const b of controls.querySelectorAll('[data-depth]'))bindHold(b,Number(b.dataset.depth)<0?'up':'down');
  controls.querySelector('.area-jump').addEventListener('click',jump);
  controls.querySelector('.area-grab').addEventListener('click',grab);
  const maulButton=controls.querySelector('.area-maul');maulButton.addEventListener('pointerdown',e=>{e.preventDefault();held.add('maul');maul();try{maulButton.setPointerCapture(e.pointerId);}catch(_){}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])maulButton.addEventListener(event,()=>held.delete('maul'));
  panel.querySelector('.area-fullscreen').addEventListener('click',()=>window.BearlyFullscreen.toggle());panel.querySelector('.area-settings').addEventListener('click',()=>window.BEARLY_DEBUG_MENU.toggle(true));
  dismountButton.addEventListener('click',stepOff);
  prompt.addEventListener('click',enter);actionButton.addEventListener('click',act);panel.querySelector('.area-exit').addEventListener('click',leave);
  window.addEventListener('keydown',e=>{
    if(e.code==='F3'||window.BEARLY_DEBUG_MENU?.isOpen())return;
    if(transition){if(e.code==='KeyP'&&!e.repeat){paused=!paused;refresh(false);}e.preventDefault();e.stopImmediatePropagation();return;}
    if(!mode){if(e.code==='KeyQ'&&!e.repeat&&context?.playing){e.preventDefault();e.stopImmediatePropagation();stepOff();return;}if(e.code==='KeyE'&&!e.repeat&&candidate&&eligible(context)){e.preventDefault();e.stopImmediatePropagation();enter();}return;}
    if(e.code==='Tab')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(['ArrowLeft','KeyA'].includes(e.code))held.add('left');
    if(['ArrowRight','KeyD'].includes(e.code))held.add('right');
    if(['ArrowUp','KeyW'].includes(e.code))held.add('up');
    if(['ArrowDown','KeyS'].includes(e.code))held.add('down');
    if(e.code==='KeyJ'){held.add('maul');if(!e.repeat)maul();}
    if(!e.repeat&&e.code==='KeyG')grab();
    if(!e.repeat&&e.code==='Space')jump();
    if(!e.repeat&&['KeyE','Enter'].includes(e.code))act();
    if(e.code==='Escape'||e.code==='KeyQ')leave();
    if(e.code==='KeyP'){paused=!paused;clear();refresh(false);}
  },true);
  window.addEventListener('keyup',e=>{if(['ArrowLeft','KeyA'].includes(e.code))held.delete('left');if(['ArrowRight','KeyD'].includes(e.code))held.delete('right');if(['ArrowUp','KeyW'].includes(e.code))held.delete('up');if(['ArrowDown','KeyS'].includes(e.code))held.delete('down');if(e.code==='KeyJ')held.delete('maul');},true);
  window.addEventListener('blur',()=>{clear();if(mode||transition){paused=true;refresh(false);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();if(mode||transition){paused=true;refresh(false);}}});
  // The pause button remains useful on a phone while exploring.
  document.getElementById('mobilePauseBtn').addEventListener('click',e=>{if(mode||transition){e.stopImmediatePropagation();paused=!paused;clear();refresh(false);}},true);
  function image(c,im,dx,dy,dw,dh){if(im?.naturalWidth)c.drawImage(im,dx,dy,dw,dh);}
  function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
  function text(c,str,x,y,size=18,color='#f5e4ba'){c.fillStyle=color;c.font=`bold ${size}px Trebuchet MS`;c.fillText(str,x,y);}
  function rounded(c,x,y,w,h,color,r=6){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  let legTextures=null;
  function prepareLegs(){
    if(legTextures)return legTextures;
    legTextures=[[153,28,507,660],[879,28,378,661],[1422,266,605,424]].map(part=>[false,true].map(far=>{
      const tile=document.createElement('canvas');tile.width=Math.ceil(part[2]*.25);tile.height=Math.ceil(part[3]*.25);
      const g=tile.getContext('2d');if(far)g.filter='brightness(.8)';g.drawImage(art.parts,...part,0,0,tile.width,tile.height);return tile;
    }));return legTextures;
  }
  function walkingActor(c,px,py,height=190){
    const textures=prepareLegs();
    const gait=window.BearlyLocomotion.pose(stride,height,Math.max(walkWeight,Math.min(1,Math.abs(velocity)/120)));
    const scale=height/488;
    c.save();c.translate(px,py);if(face<0)c.scale(-1,1);
    if(!externalShadow){c.fillStyle='#162e2945';c.beginPath();c.ellipse(0,1,height*.18,height*.032,0,0,Math.PI*2);c.fill();}
    function limb(a,b,width,far,lower=false){
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(dy,dx)-Math.PI/2);
      // Authored fur components overlap at the knee and tuck under the shorts.
      c.drawImage(textures[lower?1:0][far?1:0],-width/2,-width*.25,width,length+width*.5);
      c.restore();
    }
    function leg(f,far){
      const hip={x:(far?-20:14)*height/225,y:-height*.285+gait.bob};
      const sole={x:f.x+(far?-18:16)*height/225,y:f.y+(far?-height*.045:height*.008)-(jumpZ>0?height*.055*Math.min(1,jumpZ/35):0)};
      let roadAngle=0;
      if(mode==='street'&&!transition&&context?.road){
        const wx=px+face*sole.x,base=context.road.groundAt(px),at=context.road.groundAt(wx);
        if(base!=null&&at!=null)sole.y+=at-base;
        const left=context.road.groundAt(wx-4),right=context.road.groundAt(wx+4);
        if(f.stance&&left!=null&&right!=null)roadAngle=Math.atan2(right-left,8)*face;
      }
      const ankle={x:sole.x-2*height/225,y:sole.y-height*.115};
      const joint=window.BearlyLocomotion.knee(hip,ankle,height*.12,height*.115);
      limb(hip,joint,height*.12,far);limb(joint,ankle,height*.105,far,true);
      c.save();c.translate(sole.x,sole.y);c.rotate(f.angle+roadAngle);
      c.drawImage(textures[2][far?1:0],-height*.07,-height*.13,height*.185,height*.13);c.restore();
    }
    leg(gait.far,true);leg(gait.near,false);
    // One stable painted torso and carrier; both articulated legs tuck under the shorts.
    if(combatState.baby)window.BearlyBrawlArt.torso(c,height,gait.bob,combatState);else c.drawImage(art.people,51,13,256,370,(51-179)*scale,(13-498)*scale+gait.bob,256*scale,370*scale);
    c.restore();
  }
  function actor(c,px,py,height=190,seated=false){
    if(!art.people.naturalWidth)return;
    if(!seated&&art.parts.naturalWidth){walkingActor(c,px,py,height);return;}
    const [sx,sy,sw,sh,fx,fy]=[108,64,872,1364,350,1000],scale=height/1364;
    c.save();c.translate(px,py);if(face<0)c.scale(-1,1);
    c.drawImage(art.passengers,sx,sy,sw,sh,(sx-fx)*scale,(sy-fy)*scale,sw*scale,sh*scale);c.restore();
  }
  function npc(c,px,py,key='resident-0'){
    window.BearlyAtlas.draw(c,key,px,py,80);
    c.save();rounded(c,px-17,py-190,34,26,'#f1db9c');text(c,'…',px-8,py-173,18,'#365141');c.restore();
  }
  function hotspot(c,px,py){c.save();c.strokeStyle='#ffdc83';c.lineWidth=2;c.beginPath();c.ellipse(px,py,28,7,0,0,Math.PI*2);c.stroke();c.restore();}
  function landActors(c,ground,height){
    const draws=combatState.npcs.filter(n=>n.state!=='screen').map(n=>({kind:'npc',depth:n.depth+(n.state==='held'?1:0),n}));
    draws.push({kind:'player',depth});
    if(combatState.baby)draws.push({kind:'baby',depth:combatState.baby.depth});
    draws.sort((a,b)=>a.depth-b.depth);
    for(const d of draws){
      if(d.kind==='npc'){
        const n=d.n,gy=ground(n.x,n.depth);if(gy==null)continue;
        c.save();c.fillStyle='#1c3f3340';c.beginPath();c.ellipse(n.x,gy,20,5,0,0,Math.PI*2);c.fill();c.restore();
        window.BearlyBrawlArt.adult(c,n,n.x,gy-(n.state==='held'?(n.z||25):0),height*.88);
      }else if(d.kind==='baby'){
        const b=combatState.baby,gy=ground(b.x,b.depth);if(gy!=null)window.BearlyBrawlArt.shelter(c,b.x,gy,height*.36);
      }else{
        const gy=ground(x,depth);if(gy==null)continue;
        c.save();c.fillStyle='#163b3045';c.beginPath();c.ellipse(x,gy,height*.18*(1-jumpZ/300),height*.032,0,0,Math.PI*2);c.fill();c.restore();
        externalShadow=true;
        if(!window.BearlyBrawlArt.player(c,x,gy-jumpZ,height,face,combatState))actor(c,x,gy-jumpZ,height);
        externalShadow=false;
      }
    }
    for(const e of combatState.effects){
      const follow=['transform','hurt','faint'].includes(e.kind),ex=follow?x:e.x,ed=follow?depth:e.depth,gy=ground(ex,ed);if(gy!=null)window.BearlyBrawlArt.impact(c,e,ex,gy,height,reduced());
    }
  }
  function overlay(c,W,H,road=null){
    if(!land()||transition)return;
    const project=(nx,nd)=>{
      if(mode==='street'&&road){
        const gy=road.groundAt(nx)??road.groundAt(x)??0;
        return {x:W*.32+1.35*(nx-road.cameraX-W*.32),y:H*.22+1.35*(gy+nd-road.cameraY-H*.22),height:145*.88*1.35};
      }
      return {x:(nx-(mode==='room'?0:viewOffset))*W/1160,y:(floor+nd)*H/640,height:195*H/640};
    };
    window.BearlyBrawlArt.overlay(c,combatState,W,H,project,reduced());
    if(combatState.phase==='rolling'){
      c.save();c.strokeStyle='#e6ab4a90';c.lineWidth=6;c.strokeRect(4,4,W-8,H-8);c.restore();
    }
  }
  function drawRoom(c){
    if(place.role==='pizza')image(c,art.room,0,0,1160,640);
    else if(place.role==='workshop'&&art.workshop.naturalWidth)image(c,art.workshop,0,0,1160,640);
    else{
      const wall=c.createLinearGradient(0,0,0,540);wall.addColorStop(0,'#d6bb86');wall.addColorStop(1,'#84774f');rect(c,0,0,1160,640,wall);
      rect(c,0,420,1160,220,'#98714c');
      for(let i=0;i<18;i++){rect(c,i*75,420,2,220,'#594f3c60');}
      rounded(c,450,50,235,240,'#425f53');image(c,art.water,455,55,225,230);
      for(let xx=0;xx<1160;xx+=120)rect(c,xx,50,3,360,'#ae926c45');
      if(place.role==='library')for(const xx of [210,740]){rect(c,xx,65,210,315,'#584d36');for(let yy=80;yy<370;yy+=70){for(let j=0;j<11;j++)rect(c,xx+10+j*17,yy,13,53,['#96684e','#71866a','#b79c60'][j%3]);rect(c,xx,yy+55,210,7,'#c6a775');}}
      else if(place.role==='workshop'){
        rounded(c,220,80,220,225,'#66745b');c.strokeStyle='#c5b38b';c.lineWidth=7;for(let i=0;i<6;i++){c.beginPath();c.moveTo(245+i*30,110);c.lineTo(240+i*30,175+i%3*20);c.stroke();}
        c.strokeStyle='#334c3e';c.lineWidth=7;for(const xx of [535,700]){c.beginPath();c.arc(xx,350,52,0,Math.PI*2);c.stroke();}c.beginPath();c.moveTo(535,350);c.lineTo(590,260);c.lineTo(635,350);c.lineTo(535,350);c.lineTo(665,275);c.lineTo(700,350);c.stroke();
      }else{image(c,art.room,200,50,250,280);}
      rounded(c,60,100,90,320,'#314d40');rounded(c,73,120,63,230,'#a79e77');rect(c,133,263,6,6,'#f7d685');
      rounded(c,720,350,380,55,'#3c5544');rect(c,735,405,350,110,'#ad8259');
      text(c,place.role==='workshop'?'CYKELVERKSTAD':place.label,730,330,20);
    }
    // Walkable foreground floor: actors stand in front of the room furnishings.
    const shade=c.createLinearGradient(0,465,0,640);shade.addColorStop(0,'#7e654400');shade.addColorStop(1,'#3b372c95');rect(c,0,465,1160,175,shade);
    hotspot(c,115,floor);hotspot(c,790,floor);landActors(c,(xx,dd)=>floor+dd,225);
    text(c,'EXIT',82,595,17);text(c,place.role==='pizza'?'COOK':place.role==='workshop'?'MECHANIC':place.role==='library'?'LIBRARIAN':'NEIGHBOUR',760,595,17);
  }
  // All points use the painted boat's source coordinates. The front gunwale
  // covers feet, while the rear rim and the midship bench remain behind the passenger.
  const hullFront=[[180,477],[290,525],[600,552],[920,541],[1190,502],[1480,444],[1690,380],[1745,790],[170,790]];
  const boatSeat={x:-50,y:5,height:170};
  function hull(c,px,py,front=false){
    if(!art.boat.naturalWidth)return;
    c.save();c.translate(px-155,py-35);c.scale(310/1682,92/497);c.translate(-52,-275);
    if(front){c.beginPath();hullFront.forEach(([xx,yy],i)=>i?c.lineTo(xx,yy):c.moveTo(xx,yy));c.closePath();c.clip();}
    c.drawImage(art.boat,0,0);c.restore();
  }
  function drawBoat(c,px,py){
    c.save();c.translate(px,py);if(face<0)c.scale(-1,1);
    hull(c,0,0); // Far side and bench.
    const oldFace=face;face=1;actor(c,boatSeat.x,boatSeat.y,boatSeat.height,true);face=oldFace;
    hull(c,0,0,true); // Only the near wall goes in front of the passenger.
    c.restore();
  }
  function drawOpen(c){
    const areaWidth=mode==='water'?4700:mode==='dock'?2450:2500,cam=clamp(x-420,0,areaWidth-1160);viewOffset=cam;
    const bg=mode==='garden'?art.forest:art.water;
    image(c,bg,0,0,1160,640);
    c.save();c.translate(-cam,0);
    if(mode==='water'){
      const water=c.createLinearGradient(0,325,0,640);water.addColorStop(0,'#6a9f9d');water.addColorStop(1,'#315f68');rect(c,0,335,4700,305,water);
      for(let i=0;i<125;i++){const xx=i*43+Math.sin(clock*.7+i)*8,yy=357+(i*37)%270;c.strokeStyle=i%2?'#c5dbb650':'#e6d6a23a';c.lineWidth=2;c.beginPath();c.ellipse(xx,yy,16+i%4*6,2,0,0,Math.PI);c.stroke();}
      rect(c,0,405,260,18,'#ad8759');for(let i=0;i<4;i++)rect(c,25+i*62,420,10,130,'#675c42');
      for(const [i,bx] of buoys.entries()){
        const by=470+Math.sin(clock*1.1+i)*4,col=quests.snapshot().buoys.includes(i)?'#6fba91':'#dfb552';
        rounded(c,bx-17,by,34,26,col);rect(c,bx-2,by-65,4,67,'#e1d0a0');c.fillStyle=col;c.beginPath();c.moveTo(bx+2,by-65);c.lineTo(bx+38,by-53);c.lineTo(bx+2,by-42);c.fill();text(c,String(i+1),bx-7,by+20,17,'#294a42');
        if(quests.snapshot().chart)text(c,`${Math.round(bx/10)} m`,bx-22,by-80,14);
      }
      drawBoat(c,x,505+depth+Math.sin(clock*1.6)*3);text(c,'DOCK',115,385,19);
    }else if(mode==='dock'){
      rect(c,0,400,2450,240,'#5b8f91c9');
      rect(c,0,452,1830,140,'#9b7b52');rect(c,1760,452,490,140,'#9b7b52');
      for(let i=0;i<60;i++){rect(c,i*40,452,2,140,'#4c5942');rect(c,i*40,457,38,3,'#c0a377');}
      for(const px of [40,360,680,1000,1320,1640,2210]){rect(c,px,425,14,190,'#5c6047');rounded(c,px-4,415,22,14,'#bdb18a');}
      window.BearlyAtlas.draw(c,'boathouse',440,454,420);hotspot(c,730,floor);hotspot(c,2050,floor);hotspot(c,115,floor);
      hull(c,2075,579);
      if(transition&&['board','land'].includes(transition.kind)){
        const progress=smooth(transition.elapsed/transition.duration),t=transition.kind==='board'?progress:1-progress;
        const oldX=x,oldV=velocity,oldStride=stride;
        x=1980+(2075+boatSeat.x-1980)*t;velocity=t<.8?70:0;stride=transition.elapsed*140;
        const height=215+(boatSeat.height-215)*t,hipY=floor-215*.285+(579+boatSeat.y-(floor-215*.285))*t,sit=smooth((t-.45)/.45);
        c.save();c.globalAlpha*=1-sit;actor(c,x,hipY+height*.285,height);c.restore();
        c.save();c.globalAlpha*=sit;actor(c,x,hipY,height,true);c.restore();
        hull(c,2075,579,true);
        x=oldX;velocity=oldV;stride=oldStride;
      }else landActors(c,(xx,dd)=>floor+dd,215);text(c,'BOATKEEPER',650,595,19);text(c,quests.snapshot().boatReady?'DINGHY · READY':'DINGHY · NEEDS A FAVOUR',1840,425,19);
    }else{
      rect(c,0,400,2500,240,c.createPattern(lawn,'repeat'));rect(c,0,500,2500,88,'#b3a17d');
      for(let i=0;i<60;i++){rect(c,i*45,515,35,2,'#d2c09a80');}
      window.BearlyAtlas.draw(c,place.role==='park'?'greenhouse':'castle',350,495,470);
      for(let i=0;i<4;i++){window.BearlyStreetProps.draw(c,'bench',950+i*430,505,100,clock);if(art.verge.naturalWidth)c.drawImage(art.verge,12,38,2152,651,1100+i*430,455,150,45);}
      hotspot(c,590,floor);hotspot(c,115,floor);
      if(place.role==='park')seeds.forEach((sx,i)=>{if(!quests.snapshot().seeds.includes(i)){rounded(c,sx-12,502,24,31,'#efd391');text(c,'✿',sx-7,524,17,'#577747');hotspot(c,sx,floor);}});
      landActors(c,(xx,dd)=>floor+dd,215);text(c,'GARDEN ENTRANCE',50,595,18);
    }
    c.restore();
  }
  function render(c,W,H){
    if(!mode||mode==='street')return false;
    c.save();c.scale(W/1160,H/640);c.clearRect(0,0,1160,640);
    if(mode==='room')drawRoom(c);else drawOpen(c);
    if(fade>0){c.fillStyle=`rgba(24,37,29,${fade/.45})`;c.fillRect(0,0,1160,640);}
    if(paused){rect(c,0,0,1160,640,'#17392bb0');text(c,'PAUSED · P OR PAUSE TO RESUME',285,320,26);}
    c.restore();overlay(c,W,H);return true;
  }
  function roadPresentation(c,s,bike,ride,park){
    const roadTransfer=transition&&['dismount','mount'].includes(transition.kind);
    const doorway=transition?.kind?.startsWith('door');
    if(!roadTransfer&&mode!=='street'&&!doorway)return false;
    if(!roadTransfer){
      park();let px=x,py=s.groundAt(x),height=145;if(py===null)return true;
      if(doorway){
        const f=smooth(transition.elapsed/transition.duration),t=transition.kind==='door-enter'?f:1-f;
        const door=window.BearlyNeighbourhood.entrance(place).x,base=window.BearlyNeighbourhood.placement(place,s.groundAt)?.foot??py-100;
        px=streetReturn+(door-streetReturn)*t;py=py+(base-py)*t;height=145-65*t;
      }
      if(doorway){const oldV=velocity,oldStride=stride,oldFace=face;velocity=100;stride=transition.elapsed*110;face=(Math.sign(window.BearlyNeighbourhood.entrance(place).x-streetReturn)||1)*(transition.kind==='door-exit'?-1:1);actor(c,px,py,height);velocity=oldV;stride=oldStride;face=oldFace;}
      else landActors(c,(xx,dd)=>{const g=s.groundAt(xx);return g==null?null:g+dd;},height);return true;
    }
    const raw=clamp(transition.elapsed/transition.duration,0,1),t=transition.kind==='mount'?1-raw:raw;
    if(t<=0){ride();return true;}
    park();const mountedBlend=1-smooth(t/.12);if(mountedBlend>0){c.save();c.globalAlpha*=mountedBlend;ride();c.restore();}
    const gy=s.bikeGroundY??s.groundAt(bike.x);if(gy===null)return true;
    const walking=transition.goal==='entry'?smooth(clamp((t-.72)/.28,0,1)):0;
    const door=transition.goal==='entry'?window.BearlyNeighbourhood.entrance(place).x:bike.x+28;
    const base=transition.goal==='entry'?window.BearlyNeighbourhood.placement(place,s.groundAt)?.foot??gy-106:s.groundAt(bike.x+28)??gy;
    const standingX=bike.x+6+22*smooth(t/.18),px=standingX+(door-standingX)*walking,py=gy+(base-gy)*(transition.goal==='street'?smooth((t-.72)/.28):walking),height=145-65*walking;
    if(walking>0){
      const oldFace=face,oldV=velocity,oldStride=stride;face=(Math.sign(door-bike.x-28)||1)*(transition.kind==='mount'?-1:1);velocity=100;stride=(transition.kind==='mount'?1-walking:walking)*130;
      c.save();c.globalAlpha*=clamp((1-walking)/.15,0,1);actor(c,px,py,height);c.restore();face=oldFace;velocity=oldV;stride=oldStride;
    }else{
      const frameTime=clamp((t-.03)/.69,0,1)*5,idx=Math.floor(frameTime),blend=smooth((frameTime-idx-.65)/.35);
      function cel(n,alpha){const [sx,sy,sw,sh,fx,fy]=transferFrames[Math.min(5,n)],scale=height/488;c.save();c.globalAlpha*=alpha;c.translate(px,py);c.drawImage(art.transfer,sx,sy,sw,sh,(sx-fx)*scale,(sy-fy)*scale,sw*scale,sh*scale);c.restore();}
      const settle=transition.goal==='street'?smooth((t-.82)/.18):0;
      c.save();c.globalAlpha*=(1-settle)*(1-mountedBlend);cel(idx,1-blend);if(blend>0)cel(idx+1,blend);c.restore();
      if(settle>0){const oldV=velocity;velocity=0;c.save();c.globalAlpha*=settle;actor(c,px,py,height);c.restore();velocity=oldV;}
    }
    return true;
  }
  function roadBabyAlpha(){
    if(mode==='street'||transition?.kind?.startsWith('door'))return 0;
    if(!transition||!['dismount','mount'].includes(transition.kind))return 1;
    const p=clamp(transition.elapsed/transition.duration,0,1),t=transition.kind==='mount'?1-p:p;
    return 1-smooth((t-(.03+.69*1.65/5))/(.69*.35/5));
  }
  function hideRoadBaby(){
    if(mode==='street'||transition?.kind?.startsWith('door'))return true;
    if(!transition||!['dismount','mount'].includes(transition.kind))return false;
    const p=transition.elapsed/transition.duration,t=transition.kind==='mount'?1-p:p;
    return t>=.03+.69*2/5;
  }
  window.BearlyVisits={active:()=>!!mode||!!transition,close,update,render,overlay,footActive:()=>!!mode&&mode!=='water',practice:()=>{practiceQueue=true;if(land())setupCombat();else pendingStepOff=true;},roadPresentation,hideRoadBaby,roadBabyAlpha,requestEntry:()=>{pendingEntry=true;},audit:()=>({mode:mode||transition?.kind||null,transition:transition?.kind||null,phase:transition?Math.min(1,transition.elapsed/transition.duration):null,place:place?.key,x,velocity,frame:Math.floor(stride/15)%8,baby:combatState.baby?'safe-seat':'front-carrier',paused,near:nearby()?.kind,quest:quests.snapshot(),gait:window.BearlyLocomotion.pose(stride,mode==='street'?145:225,walkWeight),boatSeat:{...boatSeat},parkedAt:context?.x,depth,jump:jumpZ,combat:combatState,artReady:window.BearlyBrawlArt.ready()&&!!art.people.naturalWidth&&!!art.boat.naturalWidth&&!!art.transfer.naturalWidth&&!!art.parts.naturalWidth&&!!art.passengers.naturalWidth}),quests};
})();
