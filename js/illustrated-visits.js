/* Playable side areas: compact rooms, walking docks/gardens and a boat level. */
(() => {
  'use strict';
  const host=document.querySelector('.canvas-wrap'),shell=document.querySelector('.game-shell');
  const quests=window.BearlyQuests.game,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const prompt=document.createElement('button');prompt.className='visit-prompt';prompt.type='button';prompt.hidden=true;host.append(prompt);
  const panel=document.createElement('section');panel.className='area-panel';panel.hidden=true;
  panel.setAttribute('aria-label','Location and quests');
  panel.innerHTML='<div class="area-heading"><strong class="area-name"></strong><button type="button" class="area-fullscreen" aria-label="Fullscreen">⛶</button><button type="button" class="area-settings" aria-label="Settings">⚙</button><button type="button" class="area-exit">BACK TO BIKE ↗</button></div><p class="area-message" aria-live="polite"></p><p class="area-quest"></p>';
  const controls=document.createElement('div');controls.className='area-controls';controls.hidden=true;
  controls.innerHTML='<button type="button" data-direction="-1" aria-label="Walk or steer left">← <small>WALK</small></button><button type="button" data-direction="1" aria-label="Walk or steer right">→ <small>WALK</small></button><button type="button" class="area-action">TALK · E</button>';
  shell.append(panel,controls);
  const nameEl=panel.querySelector('.area-name'),messageEl=panel.querySelector('.area-message'),questEl=panel.querySelector('.area-quest'),actionButton=controls.querySelector('.area-action');
  const journal=document.createElement('div');journal.className='adventure-journal';journal.hidden=true;host.append(journal);
  const art={};
  for(const [key,file] of Object.entries({transfer:'bike-transfer-v7.png',walk:'carrier-walk-v7.png',workshop:'workshop-interior-v7.png',room:'pizzeria-walkable-v7.png',people:'front-carrier-v7.png',boat:'dinghy-v7.png',water:'waterfront.png',forest:'forest.png',verge:'autumn-verge.png'})){
    const im=new Image();im.src='assets/art/'+file;art[key]=im;
  }
  let candidate=null,context=null,place=null,mode=null,x=160,velocity=0,face=1,clock=0,stride=0,fade=0,focused=null,paused=false,lastMessage='';
  let transition=null,pendingEntry=false;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const held=new Set(),contacts=new Map(),buoys=[1150,2450,3900],seeds=[1050,1540,2110];
  const walkFrames=[[26,14,313,482,180,495],[420,14,273,483,567,496],[811,15,264,481,950,495],[1192,13,315,484,1345,496],[19,519,341,479,184,997],[423,520,282,479,570,998],[806,519,308,477,949,995],[1198,519,317,482,1345,1000]];
  const transferFrames=[[57,13,490,484,307,495],[607,9,341,493,780,500],[1121,8,304,494,1258,500],[110,516,347,493,258,1007],[604,515,340,495,772,1008],[1112,517,287,495,1259,1010]];
  const floor=535;
  const lawn=document.createElement('canvas');lawn.width=lawn.height=128;const lg=lawn.getContext('2d');lg.fillStyle='#66754b';lg.fillRect(0,0,128,128);
  for(let i=0;i<1500;i++){const h=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v);};lg.fillStyle=['#b6ac5c40','#364c392a','#d5b87033'][i%3];lg.fillRect(h(i)*128,h(i+501)*128,1+h(i+135)*2,1);}

  function setMessage(text){if(text!==lastMessage){messageEl.textContent=text;lastMessage=text;}}
  function clear(){held.clear();contacts.clear();for(const b of controls.querySelectorAll('[data-direction]'))b.classList.remove('held');}
  function eligible(s){return s?.playing&&s.grounded&&Math.abs(s.speed)<45;}
  function choose(next,start){mode=next;x=start;velocity=0;fade=.45;paused=false;clear();refresh();}
  function enter(){
    if(transition||!candidate||!eligible(context)||!art.people.naturalWidth||!art.transfer.naturalWidth||!art.walk.naturalWidth)return;
    place=candidate;focused=document.activeElement;context.clearInput();clock=0;stride=0;face=1;paused=false;
    transition={kind:'dismount',elapsed:0,duration:3};
    if(place.role==='water')quests.act('start');
    document.body.classList.add('autumn-exploring');prompt.hidden=true;panel.hidden=false;controls.hidden=false;
    panel.querySelector('.area-exit').focus();setMessage('Stopping, parking the bike, and settling the baby into the front carrier…');refresh(false);
  }
  function close(){
    if(!mode&&!transition)return;
    context?.clearInput();clear();transition=null;pendingEntry=false;document.getElementById('mobilePauseBtn').textContent='Ⅱ PAUSE';mode=null;place=null;panel.hidden=true;controls.hidden=true;
    document.body.classList.remove('autumn-exploring');focused?.focus();
  }
  function leave(){
    if(transition)return;
    paused=false;
    if(mode==='water'){quests.act('return');choose('dock',1980);transition={kind:'land',elapsed:0,duration:1.2};setMessage('Bringing the dinghy alongside and stepping back onto the dock…');}
    else {context?.clearInput();clear();mode=null;transition={kind:'mount',elapsed:0,duration:3};setMessage('Returning to the bicycle, settling the baby in the rear seat, and getting ready to ride…');refresh(false);}
  }
  function stepTransition(dt){
    transition.elapsed+=dt;
    if(transition.elapsed<transition.duration)return;
    const kind=transition.kind;transition=null;
    if(kind==='dismount'){choose(place.role==='water'?'dock':['park','castle'].includes(place.role)?'garden':'room',160);fade=.25;}
    else if(kind==='mount'){transition={kind:'done'};close();}
    else if(kind==='board'){choose('water',180);setMessage('MÄLAREN · Steer with ← → or A/D. Pass the three golden buoys, then return to the dock.');}
    else {x=1980;refresh(false);}
  }
  function targets(){
    if(!mode||!place)return [];
    const q=quests.snapshot();
    if(mode==='water')return [{x:180,label:'MOOR AT THE DOCK',kind:'moor'}];
    if(mode==='dock')return [{x:115,label:'BACK TO BIKE',kind:'exit'},{x:730,label:q.lunch?'DELIVER LUNCH':'TALK TO BOATKEEPER',kind:'keeper'},{x:2050,label:!q.repaired?'PATCH THE DINGHY':q.boatReady?'BOARD BOAT':'CHECK THE BOAT',kind:'boat'}];
    if(mode==='garden')return [{x:115,label:'BACK TO BIKE',kind:'exit'},{x:590,label:place.role==='park'?'TALK TO GARDENER':'READ GARDEN SIGN',kind:'gardener'},...seeds.filter((_,i)=>place.role==='park'&&!q.seeds.includes(i)).map(v=>({x:v,label:'PICK UP SEED PACKET',kind:'seed',id:seeds.indexOf(v)}))];
    const kind=place.role==='pizza'?'lunch':place.role==='workshop'?'kit':place.role==='library'?'chart':'talk';
    const label=kind==='lunch'?(q.lunch||q.delivered?'TALK TO COOK':'COLLECT BOATKEEPER’S LUNCH'):kind==='kit'?(q.kit||q.repaired?'TALK TO MECHANIC':'BORROW PATCH KIT'):kind==='chart'?'READ LAKE CHART':'TALK';
    return [{x:115,label:'BACK TO BIKE',kind:'exit'},{x:790,label,kind}];
  }
  function nearby(){return targets().find(t=>Math.abs(t.x-x)<105)||null;}
  function act(){
    if(paused||transition||fade>0)return;
    const t=nearby(),q=quests.snapshot();if(!t)return;
    switch(t.kind){
      case 'exit':leave();return;
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
    stride=0;refresh(false);
  }
  function refresh(initial=true){
    if(!mode&&!transition)return;
    const q=quests.snapshot(),t=nearby();
    if(transition){document.getElementById('mobilePauseBtn').textContent=paused?'▶ RESUME':'Ⅱ PAUSE';nameEl.textContent=paused?'PAUSED':transition.kind==='dismount'?'PARKING THE BICYCLE':transition.kind==='mount'?'BACK TO THE BICYCLE':transition.kind==='board'?'BOARDING THE DINGHY':'STEPPING ASHORE';actionButton.disabled=true;actionButton.textContent='ONE MOMENT…';panel.querySelector('.area-exit').disabled=true;return;}
    panel.querySelector('.area-exit').disabled=false;
    const pauseButton=document.getElementById('mobilePauseBtn');pauseButton.textContent=paused?'▶ RESUME':'Ⅱ PAUSE';pauseButton.setAttribute('aria-label',paused?'Resume exploration':'Pause exploration');
    nameEl.textContent=paused?'PAUSED':mode==='water'?'MÄLAREN · BUOY TRAIL':mode==='dock'?'MÄLARENS BÅTHUS · DOCK':mode==='garden'?place.label+' · GARDEN':place.label;
    panel.querySelector('.area-exit').textContent=mode==='water'?'BACK TO DOCK ↗':'BACK TO BIKE ↗';
    actionButton.disabled=!t||paused;actionButton.textContent=t?t.label+' · E':'WALK CLOSER';
    for(const b of controls.querySelectorAll('[data-direction]'))b.querySelector('small').textContent=mode==='water'?'STEER':'WALK';
    questEl.textContent=place.role==='park'?`GARDENER’S FAVOUR · Seeds ${q.seeds.length}/3${q.garden?' · Returned ✓':''}`:q.voyage?'LAKE TRAIL COMPLETE · The boat is yours to borrow.':q.started?`BOATKEEPER’S FAVOUR · Lunch ${q.delivered?'delivered ✓':q.lunch?'in satchel':'needed'} · Dinghy ${q.repaired?'patched ✓':q.kit?'kit in satchel':'needs patch kit'} · Buoys ${q.buoys.length}/3`: '← → / A D walk · E / Space interact · Escape leave';
    if(initial)setMessage(mode==='dock'?'Walk along the dock to meet the boatkeeper. The dinghy is moored at the far end.':mode==='garden'?'A path beyond the building. Walk further to explore; talk to the gardener along the way.':'You leave the bicycle outside. Walk over to the counter to talk. The baby rides safely in a front carrier.');
  }
  function update(s){
    context=s;
    if(s.debugOpen){clear();return;}
    if(transition){if(!paused)stepTransition(Math.min(.05,Math.max(0,s.dt||0)));refresh(false);return;}
    const q=quests.snapshot();journal.hidden=!!mode||!s.playing||!q.started;
    journal.textContent=q.voyage?'LAKE TRAIL COMPLETE ✓':q.delivered&&q.repaired?`MÄLAREN · Buoys ${q.buoys.length}/3 · Return to the boatkeeper`:`BOATKEEPER · Lunch ${q.delivered?'✓':q.lunch?'packed':'at Pizza & Kebab'} · Patch ${q.repaired?'✓':q.kit?'kit packed':'at workshop'}`;
    if(!mode){candidate=s.playing?window.BearlyNeighbourhood.nearestEntrance(s.x):null;prompt.hidden=!candidate;const ready=art.people.naturalWidth>0&&art.transfer.naturalWidth>0&&art.walk.naturalWidth>0;
      if(candidate){prompt.disabled=!eligible(s)||!ready;prompt.textContent=!ready?'GETTING READY…':eligible(s)?`ENTER ${candidate.label} · E`:`STOP TO VISIT ${candidate.label}`;}if(pendingEntry&&candidate&&eligible(s)&&ready){pendingEntry=false;enter();}return;}
    const dt=Math.min(.05,Math.max(0,s.dt||0));if(paused)return;
    clock+=dt;fade=Math.max(0,fade-dt);
    const dir=(held.has('right')||[...contacts.values()].includes(1)?1:0)-(held.has('left')||[...contacts.values()].includes(-1)?1:0);
    if(dir)face=dir;
    if(mode==='water'){
      velocity+=(dir*260-velocity)*Math.min(1,dt*3);x=clamp(x+velocity*dt,110,4550);stride+=Math.abs(velocity)*dt;
      buoys.forEach((bx,i)=>{if(Math.abs(x-bx)<85&&!quests.snapshot().buoys.includes(i)){quests.act('buoy',i);setMessage(`BUOY ${i+1} CHECKED · ${quests.snapshot().buoys.length===3?'All three! Return left to the dock.':'Keep exploring the lake.'}`);}});
    }else {velocity=fade>0?0:dir*200;x=clamp(x+velocity*dt,80,mode==='room'?1040:mode==='dock'?2250:2320);stride+=Math.abs(velocity)*dt;}
    refresh(false);
  }
  function bindHold(button,direction){
    button.addEventListener('pointerdown',e=>{e.preventDefault();contacts.set(e.pointerId,direction);button.classList.add('held');try{button.setPointerCapture?.(e.pointerId);}catch(_){}});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>{contacts.delete(e.pointerId);button.classList.remove('held');});
  }
  for(const b of controls.querySelectorAll('[data-direction]'))bindHold(b,Number(b.dataset.direction));
  panel.querySelector('.area-fullscreen').addEventListener('click',()=>window.BearlyFullscreen.toggle());panel.querySelector('.area-settings').addEventListener('click',()=>window.BEARLY_DEBUG_MENU.toggle(true));
  prompt.addEventListener('click',enter);actionButton.addEventListener('click',act);panel.querySelector('.area-exit').addEventListener('click',leave);
  window.addEventListener('keydown',e=>{
    if(e.code==='F3'||window.BEARLY_DEBUG_MENU?.isOpen())return;
    if(transition){if(e.code==='KeyP'&&!e.repeat){paused=!paused;refresh(false);}e.preventDefault();e.stopImmediatePropagation();return;}
    if(!mode){if(e.code==='KeyE'&&!e.repeat&&candidate&&eligible(context)){e.preventDefault();e.stopImmediatePropagation();enter();}return;}
    if(e.code==='Tab')return;
    e.preventDefault();e.stopImmediatePropagation();
    if(['ArrowLeft','KeyA'].includes(e.code))held.add('left');
    if(['ArrowRight','KeyD'].includes(e.code))held.add('right');
    if(!e.repeat&&['KeyE','Space','Enter'].includes(e.code))act();
    if(e.code==='Escape')leave();
    if(e.code==='KeyP'){paused=!paused;clear();refresh(false);}
  },true);
  window.addEventListener('keyup',e=>{if(['ArrowLeft','KeyA'].includes(e.code))held.delete('left');if(['ArrowRight','KeyD'].includes(e.code))held.delete('right');},true);
  window.addEventListener('blur',()=>{clear();if(mode||transition){paused=true;refresh(false);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();if(mode||transition){paused=true;refresh(false);}}});
  // The pause button remains useful on a phone while exploring.
  document.getElementById('mobilePauseBtn').addEventListener('click',e=>{if(mode||transition){e.stopImmediatePropagation();paused=!paused;clear();refresh(false);}},true);
  function image(c,im,dx,dy,dw,dh){if(im?.naturalWidth)c.drawImage(im,dx,dy,dw,dh);}
  function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
  function text(c,str,x,y,size=18,color='#f5e4ba'){c.fillStyle=color;c.font=`bold ${size}px Trebuchet MS`;c.fillText(str,x,y);}
  function rounded(c,x,y,w,h,color,r=6){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  function actor(c,px,py,height=190,seated=false){
    let im=art.people;if(!im.naturalWidth)return;
    const moving=Math.abs(velocity)>1&&!paused,frame=seated?7:moving?[1,2,3,4][Math.floor(stride/23)%4]:nearby()&&clock%7>5?6:Math.floor(clock/2)%2?5:0;
    // Authored source crops include the talking hand without bleeding into the seated frame.
    const frames=[[51,13,256,488,179,498],[415,12,289,487,557,498],[815,16,290,484,954,498],[1196,13,322,485,1345,498],[27,520,328,483,183,1001],[448,522,256,483,570,1003],[812,523,360,480,941,1001],[1200,584,317,409,1350,990]];
    let crop=frames[frame];
    if(moving&&!seated&&walkFrames.length){im=art.walk;crop=walkFrames[Math.floor(stride/15)%8];}
    const [sx,sy,sw,sh,fx,fy]=crop,scale=height/(im===art.walk?480:488);
    c.save();c.translate(px,py);if(face<0)c.scale(-1,1);
    if(!seated){c.fillStyle='#162e2945';c.beginPath();c.ellipse(0,1,41,8,0,0,Math.PI*2);c.fill();}
    c.drawImage(im,sx,sy,sw,sh,(sx-fx)*scale,(sy-fy)*scale,sw*scale,sh*scale);
    if(seated){ // Visible safety vest over the front carrier for the lake outing.
      c.strokeStyle='#f4ae42';c.lineWidth=4;c.beginPath();c.moveTo(-2,-height*.28);c.lineTo(1,-height*.18);c.moveTo(13,-height*.28);c.lineTo(16,-height*.18);c.stroke();
    }
    c.restore();
  }
  function npc(c,px,py,key='resident-0'){
    window.BearlyAtlas.draw(c,key,px,py,80);
    c.save();rounded(c,px-17,py-190,34,26,'#f1db9c');text(c,'…',px-8,py-173,18,'#365141');c.restore();
  }
  function hotspot(c,px,py){c.save();c.strokeStyle='#ffdc83';c.lineWidth=2;c.beginPath();c.ellipse(px,py,28,7,0,0,Math.PI*2);c.stroke();c.restore();}
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
    hotspot(c,115,floor);hotspot(c,790,floor);npc(c,870,500);
    actor(c,x,floor,225);
    text(c,'EXIT',82,595,17);text(c,place.role==='pizza'?'COOK':place.role==='workshop'?'MECHANIC':place.role==='library'?'LIBRARIAN':'NEIGHBOUR',760,595,17);
  }
  function drawBoat(c,px,py){
    c.save();c.translate(px,py);if(face<0)c.scale(-1,1);
    // Passenger sits behind the near side of the hull, never on the bicycle.
    const oldFace=face;face=1;actor(c,0,24,165,true);face=oldFace;
    if(art.boat.naturalWidth)c.drawImage(art.boat,52,275,1682,497,-155,-35,310,92);c.restore();
  }
  function drawOpen(c){
    const areaWidth=mode==='water'?4700:mode==='dock'?2450:2500,cam=clamp(x-420,0,areaWidth-1160);
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
      drawBoat(c,x,505+Math.sin(clock*1.6)*3);text(c,'DOCK',115,385,19);
    }else if(mode==='dock'){
      rect(c,0,400,2450,240,'#5b8f91c9');
      rect(c,0,452,1830,140,'#9b7b52');rect(c,1760,452,490,140,'#9b7b52');
      for(let i=0;i<60;i++){rect(c,i*40,452,2,140,'#4c5942');rect(c,i*40,457,38,3,'#c0a377');}
      for(const px of [40,360,680,1000,1320,1640,2210]){rect(c,px,425,14,190,'#5c6047');rounded(c,px-4,415,22,14,'#bdb18a');}
      window.BearlyAtlas.draw(c,'boathouse',440,454,420);npc(c,730,floor);hotspot(c,730,floor);hotspot(c,2050,floor);hotspot(c,115,floor);
      if(art.boat.naturalWidth)c.drawImage(art.boat,52,275,1682,497,1920,544,310,92);
      if(transition&&['board','land'].includes(transition.kind)){
        const progress=smooth(transition.elapsed/transition.duration),t=transition.kind==='board'?progress:1-progress;
        const oldX=x,oldV=velocity,oldStride=stride;x=1980+70*t;velocity=t<.65?90:0;stride=transition.elapsed*180;
        actor(c,x,floor+42*t,215-50*t,t>.65);
        if(t>.65&&art.boat.naturalWidth)c.drawImage(art.boat,52,275,1682,497,1920,544,310,92);
        x=oldX;velocity=oldV;stride=oldStride;
      }else actor(c,x,floor,215);text(c,'BOATKEEPER',650,595,19);text(c,quests.snapshot().boatReady?'DINGHY · READY':'DINGHY · NEEDS A FAVOUR',1840,425,19);
    }else{
      rect(c,0,400,2500,240,c.createPattern(lawn,'repeat'));rect(c,0,500,2500,88,'#b3a17d');
      for(let i=0;i<60;i++){rect(c,i*45,515,35,2,'#d2c09a80');}
      window.BearlyAtlas.draw(c,place.role==='park'?'greenhouse':'castle',350,495,470);
      for(let i=0;i<4;i++){window.BearlyStreetProps.draw(c,'bench',950+i*430,505,100,clock);if(art.verge.naturalWidth)c.drawImage(art.verge,12,38,2152,651,1100+i*430,455,150,45);}
      npc(c,590,floor);hotspot(c,590,floor);hotspot(c,115,floor);
      if(place.role==='park')seeds.forEach((sx,i)=>{if(!quests.snapshot().seeds.includes(i)){rounded(c,sx-12,502,24,31,'#efd391');text(c,'✿',sx-7,524,17,'#577747');hotspot(c,sx,floor);}});
      actor(c,x,floor,215);text(c,'GARDEN ENTRANCE',50,595,18);
    }
    c.restore();
  }
  function render(c,W,H){
    if(!mode)return false;
    c.save();c.scale(W/1160,H/640);c.clearRect(0,0,1160,640);
    if(mode==='room')drawRoom(c);else drawOpen(c);
    if(fade>0){c.fillStyle=`rgba(24,37,29,${fade/.45})`;c.fillRect(0,0,1160,640);}
    if(paused){rect(c,0,0,1160,640,'#17392bb0');text(c,'PAUSED · P OR PAUSE TO RESUME',285,320,26);}
    c.restore();return true;
  }
  function roadPresentation(c,s,bike,ride,park){
    if(!transition||!['dismount','mount'].includes(transition.kind))return false;
    const raw=clamp(transition.elapsed/transition.duration,0,1),t=transition.kind==='mount'?1-raw:raw;
    if(t<.04){ride();return true;}
    park();
    const gy=s.bikeGroundY??s.groundAt(bike.x);if(gy===null)return true;
    const walking=clamp((t-.7)/.3,0,1),door=window.BearlyNeighbourhood.entrance(place).x;
    const support=window.BearlyNeighbourhood.placement(place,s.groundAt);
    const px=bike.x+22+(door-bike.x-22)*smooth(walking),py=gy+((support?.foot??gy-106)-gy)*smooth(walking),height=145-65*walking;
    if(walking>0){
      const oldFace=face,oldV=velocity,oldStride=stride;const direction=Math.sign(door-bike.x-22)||1;face=transition.kind==='mount'?-direction:direction;velocity=100;stride=(transition.kind==='mount'?1-walking:walking)*160;
      c.save();c.globalAlpha*=clamp((1-walking)/.12,0,1);actor(c,px,py,height);c.restore();face=oldFace;velocity=oldV;stride=oldStride;
    }else if(transferFrames.length){
      const frame=Math.min(5,Math.floor(t/.7*6)),[sx,sy,sw,sh,fx,fy]=transferFrames[frame],scale=height/488;
      c.save();c.translate(px,py);c.drawImage(art.transfer,sx,sy,sw,sh,(sx-fx)*scale,(sy-fy)*scale,sw*scale,sh*scale);c.restore();
    }
    return true;
  }
  function hideRoadBaby(){
    if(!transition||!['dismount','mount'].includes(transition.kind))return false;
    const p=transition.elapsed/transition.duration,t=transition.kind==='mount'?1-p:p;
    return t>=.7*2/6;
  }
  window.BearlyVisits={active:()=>!!mode||!!transition,close,update,render,roadPresentation,hideRoadBaby,requestEntry:()=>{pendingEntry=true;},audit:()=>({mode:mode||transition?.kind||null,transition:transition?.kind||null,phase:transition?Math.min(1,transition.elapsed/transition.duration):null,place:place?.key,x,velocity,frame:Math.floor(stride/15)%8,baby:'front-carrier',paused,near:nearby()?.kind,quest:quests.snapshot(),artReady:!!art.people.naturalWidth&&!!art.boat.naturalWidth&&!!art.transfer.naturalWidth&&!!art.walk.naturalWidth}),quests};
})();
