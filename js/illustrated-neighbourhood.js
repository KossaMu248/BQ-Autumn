/* Authored stops along the ride, with a quiet civilian world behind the collision plane. */
(() => {
  'use strict';
  const A=()=>window.BearlyAtlas;
  const hash=(n,k=0)=>{const v=Math.sin(n*127.1+k*311.7)*43758.5453;return v-Math.floor(v);};
  // Placed scenes, not a repeating bakery strip. x uses the existing 42,000-unit route.
  const scenes=[
    {x:1500,key:'apartment',w:370,label:'BACKSTUGEVÄGEN',role:'home'},
    {x:3600,key:'courtyard',w:350,label:'GÅRDEN',role:'home'},
    {x:5600,key:'corner-shop',w:330,label:'KVARTERSBUTIKEN',role:'shop'},
    {x:7700,key:'arcade',w:510,label:'HÄSSELBY CENTRUM',role:'shop'},
    {x:9450,key:'apartment',w:330,label:'CENTRUMHUSEN',role:'home'},
    {x:11325,key:'metro',w:400,label:'HÄSSELBY GÅRD',role:'metro'},
    {x:13750,key:'civic-hall',w:370,label:'PÅ TORGET',role:'square'},
    {x:15700,key:'corner-shop',w:350,label:'TORGHÖRNAN',role:'shop'},
    {x:17700,key:'library',w:470,label:'BIBLIOTEKET',role:'library'},
    {x:19600,key:'arcade',w:430,label:'TORGETS BUTIKER',role:'shop'},
    {x:21400,key:'castle',w:360,label:'SLOTTSVÄGEN',role:'castle'},
    {x:24400,key:'greenhouse',w:290,label:'GRIMSTA TRÄDGÅRD',role:'park'},
    {x:29100,key:'courtyard',w:340,label:'STRANDKVARTERET',role:'home'},
    {x:31750,key:'boathouse',w:360,label:'MÄLARENS BÅTHUS',role:'water'},
    {x:35200,key:'cafe',w:295,label:'FIKA VID VATTNET',role:'cafe'},
    {x:38700,key:'boathouse',w:280,label:'STRANDPROMENADEN',role:'water'}
  ];
  function nearScene(x,pad=0){return scenes.some(b=>Math.abs(b.x-x)<b.w*.5+pad);}
  const birds=new Map();let previousX=0;
  const stats={scenes:0,residents:0,birds:0,scattered:0};
  function billboard(c,x,y,text){
    c.save();c.translate(x,y);c.strokeStyle='#5b6045';c.lineWidth=4;c.beginPath();c.moveTo(-49,-2);c.lineTo(-49,22);c.moveTo(49,-2);c.lineTo(49,22);c.stroke();c.fillStyle='#304f3f';c.strokeStyle='#283d2f';c.lineWidth=2;
    c.beginPath();c.roundRect(-68,-26,136,23,3);c.fill();c.stroke();c.fillStyle='#f1dfb3';c.font='900 10px Trebuchet MS';c.textAlign='center';c.fillText(text,0,-11);c.restore();
  }
  function bird(c,x,y,t,fly,seed){
    c.save();c.translate(x,y);if(fly){const flap=Math.sin(t*14+seed)*5;c.fillStyle='#6d7b78';c.strokeStyle='#354b45';c.lineWidth=1;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-9,-9-flap,-16,-2-flap);c.quadraticCurveTo(-9,-1,0,3);c.quadraticCurveTo(9,-1,16,-2-flap);c.quadraticCurveTo(9,-9-flap,0,0);c.fill();c.stroke();}
    c.fillStyle='#788785';c.strokeStyle='#34473e';c.lineWidth=.9;c.beginPath();c.ellipse(0,0,5.5,3.7,-.15,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#546d6d';c.beginPath();c.arc(4,-3,2.6,0,Math.PI*2);c.fill();c.fillStyle='#d4b776';c.beginPath();c.moveTo(6,-4);c.lineTo(9,-3);c.lineTo(6,-2);c.fill();c.fillStyle='#1f3129';c.fillRect(4,-4,1,1);if(!fly){c.strokeStyle='#b58d6e';c.beginPath();c.moveTo(-2,2);c.lineTo(-2,6);c.moveTo(2,2);c.lineTo(2,6);c.stroke();}c.restore();
  }
  function pathBase(s,x){return s.groundAt(x);}
  function civilian(c,s,b,index){
    const t=s.reducedMotion?0:s.time;
    const walk=index%3,span=b.role==='home'?80:100;
    const moving=walk!==0;
    const phase=(t*.10+index*.29)%2;
    const dx=moving?(phase<1?phase:2-phase)*span-span*.5:0;
    const x=b.x-b.w*.23+index*55+dx;
    if(s.crewXs?.some(cx=>Math.abs(cx-x)<235))return;
    const gy=pathBase(s,x);if(gy===null)return;
    const close=Math.abs(s.bikeX-x)<380;
    const frame=walk===0?(close?1:0):walk===1?(2+(s.reducedMotion?0:Math.floor(t*2.8)%2)):(4+(s.reducedMotion?0:Math.floor(t*2.6)%2));
    const key='resident-'+frame,info=A().info(key);if(!info)return;
    // Fixed stature per pair, even if a wave reaches above the head.
    const base=A().info('resident-'+(walk===0?0:walk===1?2:4));const h=walk===0?65:70;
    const width=h*info.w/(base.footY-base.y);
    A().draw(c,key,x,gy-91,width,{flip:moving&&phase>=1});stats.residents++;
  }
  function steam(c,x,y,t,alpha=.24){
    c.save();c.lineCap='round';c.lineWidth=1.7;c.strokeStyle='#f3e5c7';
    for(let i=0;i<3;i++){const age=(t*.25+i*.33)%1;c.globalAlpha=alpha*(1-age);const yy=y-age*30;c.beginPath();c.moveTo(x+i*5,yy);c.bezierCurveTo(x-6+i*5,yy-7,x+6+i*5,yy-12,x+i*5,yy-18);c.stroke();}c.restore();
  }
  function building(c,s,b){
    const y=s.groundAt(b.x);if(y===null)return;
    const foot=y-106;
    if(b.key==='metro'){if(s.metro)window.BearlyWorld.station(c,b.x,foot);}
    else if(b.key==='cafe')window.BearlyWorld.cafe(c,b.x,foot);
    else A().draw(c,b.key,b.x,foot,b.w);
    // Warm open-window/cafe glow stays very restrained and belongs to the facade.
    if(['cafe','shop','library'].includes(b.role)){
      const shimmer=s.reducedMotion?1:.92+.08*Math.sin(s.time*1.1+b.x);
      c.save();c.globalAlpha=.035*shimmer;c.fillStyle='#ffd47b';c.beginPath();c.ellipse(b.x,foot-42,b.w*.25,27,0,0,Math.PI*2);c.fill();c.restore();
    }
    if(b.role==='cafe'){
      if(!s.reducedMotion)steam(c,b.x+80,foot-15,s.time,.28);
      window.BearlyStreetProps.draw(c,'bench',b.x+b.w*.65,foot+18,82,s.time);
    }
    if(b.role==='library'||b.role==='square'){
      billboard(c,b.x+b.w*.38,foot-4,b.role==='library'?'LÄS EN STUND':'VÄLKOMMEN TILL TORGET');
    }
    if(b.role==='water'){
      // A few shoreline ripples make each boathouse stop feel connected to Mälaren.
      c.save();c.strokeStyle='#d5dcc070';c.lineWidth=1.3;
      for(let j=0;j<3;j++){const offset=s.reducedMotion?0:Math.sin(s.time*.6+j)*4;c.beginPath();c.ellipse(b.x+b.w*.55+offset,foot-6-j*4,22+j*7,2.5,0,0,Math.PI);c.stroke();}c.restore();
    }
  }
  window.BearlyNeighbourhood={
    scenes,
    frontage:nearScene,
    fenceEnds:()=>scenes.filter(b=>['shop','square','library','metro'].includes(b.role)).flatMap(b=>[b.x-b.w*.65-35,b.x+b.w*.65+35]),
    fenceGap:x=>scenes.some(b=>['shop','square','library','metro'].includes(b.role)&&Math.abs(b.x-x)<b.w*.65+35),
    buildings(c,s){stats.scenes=0;for(const b of scenes){if(b.x+b.w*.7<s.cameraX-250||b.x-b.w*.7>s.cameraX+s.W+250)continue;building(c,s,b);stats.scenes++;}},
    life(c,s){
      stats.residents=0;stats.birds=0;
      if(s.bikeX<previousX-1000){birds.clear();stats.scattered=0;}previousX=s.bikeX;
      for(let i=0;i<scenes.length;i++){
        const b=scenes[i];if(b.x+b.w<s.cameraX-200||b.x-b.w>s.cameraX+s.W+200)continue;
        if(!['castle','water'].includes(b.role))civilian(c,s,b,i%3);
        if(['shop','square','library','park','cafe'].includes(b.role)){
          const bx=b.x+b.w*.48,gy=s.groundAt(bx);if(gy===null)continue;
          if(!s.reducedMotion&&s.playing&&Math.abs(s.bikeX-bx)<210&&!birds.has(i)){birds.set(i,s.time);stats.scattered++;}
          const age=birds.has(i)?s.time-birds.get(i):-1,fly=age>=0&&age<6;
          for(let j=0;j<3;j++){const x=bx+(j-1)*15+(fly?age*(20+j*7):0),y=gy-89+(fly?-Math.sin(Math.min(age/6,1)*Math.PI)*70-age*7:0);bird(c,x,y,s.time,fly,i+j);stats.birds++;}
        }
      }
    },
    audit:()=>({...stats,sceneCount:scenes.length,uniqueBuildingKeys:new Set(scenes.map(s=>s.key)).size,placements:scenes.map(b=>({x:b.x,key:b.key,label:b.label}))})
  };
})();
