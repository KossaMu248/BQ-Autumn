/* Optional neighbourhood visits. The ride is held in place while indoors. */
(() => {
  'use strict';
  const host=document.querySelector('.canvas-wrap');
  const prompt=document.createElement('button');
  prompt.className='visit-prompt';prompt.hidden=true;prompt.type='button';host.append(prompt);
  const room=document.createElement('dialog');room.className='visit-room';
  room.setAttribute('aria-labelledby','visit-title');
  room.innerHTML='<div class="visit-room-copy"><span class="eyebrow">A LITTLE DETOUR</span><h2 id="visit-title"></h2><p class="visit-description"></p></div><div class="visit-art" aria-hidden="true"></div><p class="visit-note">Your bicycle is waiting outside. Take your time.</p><button type="button">BACK TO THE RIDE →</button><small>Escape to leave</small>';
  host.append(room);
  const descriptions={pizza:'Warm lights, a wood-fired oven, and a little table by the window. Welcome to Pizza & Kebab.',workshop:'A friendly bike workshop, full of spare wheels, well-used tools, and the smell of chain oil.',shop:'A warm little neighbourhood shop, with shelves full of everyday essentials.',library:'A quiet corner, full of stories. Even the baby lowers their voice.',cafe:'Coffee, cinnamon buns, and a well-earned moment out of the autumn air.',square:'Step inside the community hall. There is always something happening on the noticeboard.',park:'Under the greenhouse roof, the last green leaves are keeping autumn at bay.',castle:'A quiet manor room, with a view towards the autumn gardens.',water:'Oars, ropes, and the smell of timber. Mälaren is just outside.'};
  let candidate=null,context=null,returnFocus=null;
  function eligible(s){return s.playing&&s.grounded&&Math.abs(s.speed)<45;}
  function furnishings(role){
    if(role==='library'||role==='shop')return [125,335,545].map((x,i)=>`<g transform="translate(${x} 115)"><rect width="140" height="200" rx="4" fill="#6a5139"/>${[35,90,145].map(y=>`<path d="M10 ${y+35}h120" stroke="#c39661" stroke-width="7"/>${Array.from({length:7},(_,j)=>`<rect x="${12+j*17}" y="${y}" width="12" height="32" fill="${['#9f6652','#b29d59','#6b8981'][(i+j)%3]}"/>`).join('')}`).join('')}</g>`).join('');
    if(role==='workshop')return '<rect x="130" y="140" width="540" height="95" fill="#6c775b"/><path d="M150 245h500v18H150zM170 260v70m460-70v70" fill="#ad8354" stroke="#6b563e" stroke-width="8"/><g fill="none" stroke="#344f43" stroke-width="6"><circle cx="295" cy="290" r="43"/><circle cx="465" cy="290" r="43"/><path d="M295 290l50-85 45 85h-95l75-60h70l25 60m-125-85h30m70 25l-8-25h-25"/></g><path d="M200 155v50m30-50v50m330-50v50m30-50v50" stroke="#dbc7a0" stroke-width="8"/>';
    if(role==='water')return '<path d="M150 120L230 310M250 120L170 310" stroke="#846343" stroke-width="12"/><path d="M520 290q100-160 130 0z" fill="#c39357"/><circle cx="430" cy="250" r="42" fill="none" stroke="#b79766" stroke-width="12"/>';
    if(role==='park')return [170,310,490,630].map(x=>`<path d="M${x} 300v-120" stroke="#527454" stroke-width="6"/><ellipse cx="${x-18}" cy="210" rx="28" ry="12" fill="#68845b" transform="rotate(25 ${x-18} 210)"/><ellipse cx="${x+18}" cy="240" rx="28" ry="12" fill="#466c51"/><path d="M${x-30} 285h60l-10 50h-40z" fill="#af7957"/>`).join('');
    return '<rect x="240" y="240" width="320" height="22" rx="7" fill="#a77a4c"/><path d="M265 260v80m270-80v80" stroke="#71583d" stroke-width="12"/><path d="M175 245v85m0-40h55m395-45v85m0-40h-55" fill="none" stroke="#5c6c53" stroke-width="13"/><ellipse cx="400" cy="232" rx="35" ry="8" fill="#eee1be"/><path d="M380 210h35v20h-35z" fill="#ead4a9"/><path d="M415 213q20 0 0 14" fill="none" stroke="#ead4a9" stroke-width="4"/>';
  }
  function enter(){
    if(!context||!candidate||!eligible(context)||room.open)return;
    returnFocus=document.activeElement;context.clearInput();
    room.querySelector('h2').textContent=candidate.label;
    room.querySelector('.visit-description').textContent=descriptions[candidate.role];
    room.querySelector('.visit-art').innerHTML=`<svg viewBox="0 0 800 370" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="370" fill="#dfceb0"/><path d="M0 300h800v70H0z" fill="#9c805a"/><path d="M0 300h800" stroke="#645d43" stroke-width="8"/><rect x="325" y="35" width="150" height="115" rx="45" fill="#9bac95" stroke="#f3e8cc" stroke-width="12"/><path d="M400 35v115m-75-57h150" stroke="#f3e8cc" stroke-width="6"/>${furnishings(candidate.role)}</svg>`;
    if(candidate.role==='pizza'){
      const image=document.createElement('img');image.src='assets/art/pizzeria-interior-v6.png';image.alt='A cozy pizza and kebab shop with warm lamps, wooden tables, a pizza oven and an autumn window.';
      room.querySelector('.visit-art').replaceChildren(image);
    }
    room.dataset.place=candidate.key;
    prompt.hidden=true;room.showModal();room.querySelector('button').focus();
  }
  function close(){
    if(!room.open)return;
    context?.clearInput();room.close();
    if(returnFocus?.isConnected)returnFocus.focus();
  }
  prompt.addEventListener('click',enter);room.querySelector('button').addEventListener('click',close);
  room.addEventListener('cancel',e=>{e.preventDefault();close();});
  // Capture before the game's shortcuts so a visit cannot trigger a restart or hop.
  window.addEventListener('keydown',e=>{
    if(room.open){if(e.code==='Tab')return;e.preventDefault();e.stopImmediatePropagation();if(e.code==='Escape')close();return;}
    if(e.code==='KeyE'&&!e.repeat&&candidate&&context&&eligible(context)){
      e.preventDefault();e.stopImmediatePropagation();enter();
    }
  },true);
  window.BearlyVisits={active:()=>room.open,close,update(s){
    context=s;if(room.open)return;
    candidate=s.playing?window.BearlyNeighbourhood.nearestEntrance(s.x):null;
    prompt.hidden=!candidate;
    if(candidate){prompt.disabled=!eligible(s);prompt.textContent=eligible(s)?`ENTER ${candidate.label} · E`:`STOP TO VISIT ${candidate.label}`;}
  }};
})();
