/* Autumn Streets — independent, terrain-aware art direction. No physics changes. */
(() => {
  'use strict';
  const ink='#292d26', TAU=Math.PI*2;
  const noise=(n,s=0)=>{const v=Math.sin(n*127.1+s*311.7)*43758.5453;return v-Math.floor(v);};
  const panorama=new Image();panorama.src='assets/art/waterfront.png';
  const tree=new Image();tree.src='assets/art/autumn-tree.png';
  const verge=new Image();verge.src='assets/art/autumn-verge.png';
  const cafe=new Image();cafe.src='assets/art/cafe.png';
  const metro=new Image();metro.src='assets/art/metro.png';
  const forest=new Image();forest.src='assets/art/forest.png';
  const tiles={};
  function tile(name,base,count,palette){
    const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,256,256);
    for(let i=0;i<count;i++){g.fillStyle=palette[i%palette.length];const x=noise(i,3)*256,y=noise(i,7)*256;g.fillRect(x,y,noise(i,5)*2.4+.4,noise(i,6)*1.2+.4);}
    tiles[name]=c;
  }
  tile('road','#79766b',12500,['#cec0a31f','#161f1c19','#e9dabb16','#383c351d']);
  tile('wood','#6f7150',4500,['#f4d3911d','#252f2428','#b7ab7130']);
  tile('grass','#647447',6500,['#d4ac5b40','#263c2930','#b6b05d40']);
  tile('paving','#a39b83',5500,['#f0dfbc20','#3a392d1c','#e1cb9c22']);
  function shape(c,pts,fill,stroke=ink,width=2){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  function rect(c,x,y,w,h,fill,stroke=ink,r=0){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.lineWidth=2;c.strokeStyle=stroke;c.stroke();}}
  function ellipse(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();}
  function line(c,pts,col,width){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=col;c.lineWidth=width;c.stroke();}
  function label(c,text,x,y,size=14,col='#f7e9c6'){c.font=`900 ${size}px 'Trebuchet MS',sans-serif`;c.textAlign='center';c.fillStyle=col;c.fillText(text,x,y);c.textAlign='left';}
  function leaf(c,x,y,size,seed){c.save();c.translate(x,y);c.rotate(noise(seed,9)*6.28);shape(c,[[-size*.7,0],[-size,-size*.65],[-size*.2,-size*.5],[0,-size],[size*.3,-size*.35],[size,-size*.45],[size*.7,.2],[.2,size*.5]],['#c78b2b','#d3a941','#a85c2d','#b6ab4e'][Math.abs(seed)%4],null);line(c,[[0,-size*.65],[0,size*.75]],'#84602d',.7);c.restore();}
  const treeCache=new Map();
  function paintedTree(c,x,foot,height,seed){
    if(tree.complete&&tree.naturalWidth){
      // Cache color variants once; no per-frame image filters.
      const variant=Math.abs(seed)%3;let art=treeCache.get(variant);
      if(!art){art=document.createElement('canvas');const scale=Math.min(1,700/tree.naturalHeight);art.width=tree.naturalWidth*scale;art.height=tree.naturalHeight*scale;const g=art.getContext('2d');g.filter=variant===1?'saturate(.84) hue-rotate(-12deg)':variant===2?'saturate(1.1) hue-rotate(7deg)':'none';g.drawImage(tree,0,0,art.width,art.height);treeCache.set(variant,art);}
      const width=height*art.width/art.height;c.drawImage(art,x-width*.5,foot-height,width,height);return;
    }
    // Readable fallback while local art loads.
    c.save();c.translate(x,foot);shape(c,[[-12,0],[-9,-170],[-50,-235],[-42,-240],[0,-190],[30,-247],[36,-240],[12,-167],[17,0]],'#6b5136');
    for(let i=0;i<36;i++){const a=noise(i+seed,2)*TAU,r=Math.sqrt(noise(i+seed,4))*height*.28;ellipse(c,Math.cos(a)*r,-height*.72+Math.sin(a)*r*.7,30,25,['#8f9e3e','#b8a43c','#6b823f','#c8a449'][i%4]);}c.restore();
  }
  function range(s,pad=250){return [Math.max(0,s.cameraX-pad),Math.min(s.finish+1200,s.cameraX+s.W+pad)];}
  function ground(s,x){return s.groundAt(x);}
  function strip(c,s,top,bottom,fill,stroke=null){
    const [lo,hi]=range(s,260);
    for(const seg of s.segments){if(seg[1]<lo||seg[0]>hi)continue;const a=Math.max(lo,seg[0]),b=Math.min(hi,seg[1]),ya=ground(s,a),yb=ground(s,b);shape(c,[[a,ya+top],[b,yb+top],[b,yb+bottom],[a,ya+bottom]],fill,stroke,2);}
  }
  function textureStrip(c,s,top,bottom,name){strip(c,s,top,bottom,c.createPattern(tiles[name],'repeat'));}
  function fence(c,s){
    const [lo,hi]=range(s);const pitch=22;
    for(let x=Math.floor(lo/pitch)*pitch;x<hi;x+=pitch){const y=ground(s,x),y2=ground(s,x+pitch);if(y==null||y2==null)continue;
      const top=y-196;shape(c,[[x,top+3],[x+pitch,top+(y2-y)+3],[x+pitch,y2-104],[x,y-104]],c.createPattern(tiles.wood,'repeat'),'#414a37',1.2);
      line(c,[[x+4,top+9],[x+4,y-112]],'#a9a47870',1.3);for(let j=0;j<3;j++)line(c,[[x+9+j*3,top+14+noise(x,j)*20],[x+8+j*3,y-110-noise(x,j+4)*17]],'#333c2c35',.7);
    }
    for(const off of [-185,-121]){
      for(let x=Math.floor(lo/90)*90;x<hi;x+=90){const a=ground(s,x),b=ground(s,x+90);if(a==null||b==null)continue;shape(c,[[x,a+off],[x+90,b+off],[x+90,b+off+8],[x,a+off+8]],'#727657','#3d4632',1.7);line(c,[[x,a+off],[x+90,b+off]],'#adab7b',2);}
    }
    for(let x=Math.floor(lo/176)*176;x<hi;x+=176){const y=ground(s,x);if(y==null)continue;rect(c,x-7,y-211,15,110,'#6d7150','#3c4434',2);line(c,[[x-4,y-206],[x-4,y-105]],'#acaa7c',2);rect(c,x-9,y-214,19,6,'#969571','#414832',1);}
  }
  function shrub(c,x,y,w,seed){
    if(verge.complete&&verge.naturalWidth){
      const width=w*1.3,height=width*verge.naturalHeight/verge.naturalWidth;
      c.drawImage(verge,x-width*.5,y-height+4,width,height);return;
    }
    for(let i=0;i<14;i++){const xx=x+(noise(seed+i,8)-.5)*w;const yy=y-noise(seed+i,9)*15;ellipse(c,xx,yy,5+noise(i,6)*5,5,['#68783c','#9c9b42','#b5a547','#4a663a'][i%4]);}
  }
  function lamp(c,x,y){c.save();c.translate(x,y);ellipse(c,5,2,22,3,'#27312433');rect(c,-4,-220,8,220,'#38483d',ink,2);line(c,[[0,-214],[15,-235],[42,-235]],ink,7);line(c,[[0,-215],[16,-233],[41,-233]],'#7d8770',3);shape(c,[[27,-236],[51,-236],[47,-220],[32,-220]],'#e8c875');rect(c,29,-240,22,5,'#38483d',ink,2);ellipse(c,39,-224,5,2,'#fff1b2');c.restore();}
  function shop(c,x,y,name,seed){
    if(cafe.complete&&cafe.naturalWidth){const w=310,h=w*cafe.naturalHeight/cafe.naturalWidth;c.drawImage(cafe,x-w/2,y-h+h*.035,w,h);return;}
    c.save();c.translate(x,y);const width=260;const wall=['#c28e63','#b9a177','#ba8062'][Math.abs(seed)%3];
    ellipse(c,0,4,150,10,'#2d352d30');rect(c,-width/2,-250,width,250,wall,ink,2);
    shape(c,[[-144,-247],[0,-296],[144,-247]],'#64584a');line(c,[[-140,-245],[140,-245]],'#d2b389',5);
    for(let j=0;j<3;j++){const xx=-99+j*77;rect(c,xx,-221,43,58,'#334b4b',ink,1);rect(c,xx+4,-217,34,47,'#81a1a0',null);line(c,[[xx+23,-217],[xx+23,-171]],'#e4d5af',3);line(c,[[xx+4,-192],[xx+37,-192]],'#e4d5af',3);rect(c,xx-3,-163,49,5,'#dbc79d',ink,1);}
    rect(c,-126,-140,252,34,'#28483d',ink,3);label(c,name,0,-117,17);
    for(let j=0;j<10;j++)rect(c,-130+j*26,-105,26,20,j%2?'#ead5a2':'#a55236',ink,1);
    rect(c,-111,-80,137,75,'#314744',ink,1);rect(c,-106,-75,127,62,'#8daca0',null);line(c,[[-49,-75],[-49,-13]],'#d5c5a0',4);line(c,[[-102,-69],[-64,-23]],'#c8d9b46a',2);label(c,'KAFFE & KANELBULLAR',-43,-39,7,'#fff1c9');
    rect(c,42,-83,67,83,'#364e44',ink,1);rect(c,49,-76,53,53,'#78968d',ink,0);ellipse(c,95,-15,2,2,'#f1d393');rect(c,-130,-5,260,7,'#807559',ink,1);
    for(let i=0;i<85;i++){const xx=-124+noise(i,seed)*249,yy=-242+noise(i,seed+2)*91;c.fillStyle='#5b513215';c.fillRect(xx,yy,noise(i,3)*12+2,1);}
    c.restore();
  }
  function station(c,x,y){
    if(metro.complete&&metro.naturalWidth){const w=350,h=w*678/1513;c.drawImage(metro,11,162,1513,678,x-w/2,y-h+3,w,h);return;}
    c.save();c.translate(x,y);ellipse(c,0,3,180,10,'#25372d30');rect(c,-150,-120,300,120,'#748775',ink,3);rect(c,-155,-135,310,23,'#384f46',ink,3);
    for(let i=0;i<5;i++)rect(c,-140+i*57,-105,48,99,'#80a5a0',ink,1);rect(c,-13,-102,26,98,'#2b4542',ink,1);
    rect(c,-121,-173,242,38,'#254e79',ink,4);label(c,'HÄSSELBY GÅRD',0,-148,17,'#f6ecd0');
    rect(c,163,-231,7,231,'#3e5149',ink,1);ellipse(c,166,-235,24,24,'#eee6cd');c.strokeStyle=ink;c.lineWidth=3;c.stroke();label(c,'T',166,-226,27,'#28619a');
    for(let i=0;i<4;i++){line(c,[[-142+i*85,-100],[-115+i*85,-16]],'#dae8ce50',3);}c.restore();
  }
  function parkSign(c,x,y,text,small){c.save();c.translate(x,y);rect(c,-4,-114,8,114,'#7d7150',ink,1);rect(c,-62,-122,124,40,'#315949',ink,3);label(c,text,0,-104,12);if(small)label(c,small,0,-89,7,'#d7cfaa');c.restore();}
  function frontage(s,x,pad=0){
    const zone=s.districtAt(x).style;
    if([7400,11325].some(center=>Math.abs(x-center)<185+pad))return true;
    const pitch=zone==='square'?570:zone==='homes'?1420:0;
    if(!pitch)return false;
    const center=Math.round((x-110)/pitch)*pitch+110;
    return center>500&&Math.abs(center-x)<155+pad;
  }
  function skylineFallback(c,s){const sky=c.createLinearGradient(0,0,0,640);sky.addColorStop(0,'#75acd0');sky.addColorStop(.6,'#b8d0c9');sky.addColorStop(1,'#e5ca9a');c.fillStyle=sky;c.fillRect(0,0,s.W,s.H);c.fillStyle='#7b9e92';for(let i=-1;i<18;i++){const x=i*93-(s.cameraX*.09)%93;rect(c,x,250-noise(i,4)*70,80,140,'#859c8f',null);}c.fillStyle='#699fa8';c.fillRect(0,310,s.W,330);}
  window.BearlyWorld={
    sky(c,s){
      skylineFallback(c,s);
      if(!s.backdrop)return;
      if(panorama.complete&&panorama.naturalWidth){
        const h=s.H*.78,w=h*panorama.naturalWidth/panorama.naturalHeight, top=-110;
        const scroll=s.cameraX*.075,phase=scroll%(w*2);let start=-phase;
        for(let i=-1;i<5;i++){const x=start+i*w;if(x>s.W||x+w<0)continue;c.save();if(i%2){c.translate(x+w,top);c.scale(-1,1);c.drawImage(panorama,0,0,w,h);}else c.drawImage(panorama,x,top,w,h);c.restore();}
        c.fillStyle='#75a7aa';c.fillRect(0,h+top,s.W,s.H-h-top);
      }
      if(forest.complete&&forest.naturalWidth){
        const fadeIn=Math.min(1,Math.max(0,(s.cameraX-20250)/1000));
        const fadeOut=Math.min(1,Math.max(0,(27750-s.cameraX)/1000));
        const alpha=fadeIn*fadeOut;
        if(alpha>0){
          c.save();c.globalAlpha=alpha;
          const h=s.H,w=h*forest.naturalWidth/forest.naturalHeight;
          const scroll=s.cameraX*.16,phase=scroll%(w*2);
          for(let i=-1;i<5;i++){const x=-phase+i*w;if(x>s.W||x+w<0)continue;c.save();if(i%2){c.translate(x+w,0);c.scale(-1,1);c.drawImage(forest,0,0,w,h);}else c.drawImage(forest,x,0,w,h);c.restore();}
          c.restore();
        }
      }
      // A quiet translucent warm light ties the lake to the street.
      const light=c.createLinearGradient(0,0,s.W,s.H);light.addColorStop(0,'#f4cd6a00');light.addColorStop(1,'#e4b85a13');c.fillStyle=light;c.fillRect(0,0,s.W,s.H);
    },
    backstreet(c,s){
      const [lo,hi]=range(s,400);
      // Terrain beneath the street, including true gaps in the original track.
      strip(c,s,-117,1800,c.createPattern(tiles.grass,'repeat'));
      const style=s.district.style;
      // Trees sit behind the fence, never on the rideable collision surface.
      const step=420;
      for(let k=Math.floor(lo/step)-1;k<hi/step+1;k++){
        const x=k*step+70+noise(k,19)*85,y=ground(s,x);if(y==null)continue;
        const forest=s.districtAt(x).style==='forest';
        const h=(forest?390:340)+noise(k,20)*95;
        paintedTree(c,x,y-110,h,k+13);
        if(forest){const xx=x+170,yy=ground(s,xx);if(yy!==null)paintedTree(c,xx,yy-115,340+noise(k,5)*80,k+19);}
      }
      fence(c,s);
      for(let k=Math.floor(lo/1420)-1;k<=hi/1420;k++){
        const x=k*1420+110,y=ground(s,x);if(y==null||x<500)continue;
        if(s.districtAt(x).style==='homes')shop(c,x,y-106,'HÄSSELBY CAFÉ',k);
      }
      for(let k=Math.floor(lo/570)-1;k<=hi/570;k++){
        const x=k*570+110,y=ground(s,x);if(y==null||s.districtAt(x).style!=='square')continue;
        shop(c,x,y-106,['BAGERIET','GRÖNT & GOTT','LILLA PIZZERIAN'][Math.abs(k)%3],k);
      }
      if(s.metro)for(const x of [7400,11325]){const y=ground(s,x);if(x>lo-350&&x<hi+350&&y!=null)station(c,x,y-107);}
      // Broken-up planted verge at the fence base, then a stone footpath.
      for(let k=Math.floor(lo/65);k<hi/65;k++){const x=k*65,y=ground(s,x);if(y==null)continue;shrub(c,x,y-106,74,k);}
      textureStrip(c,s,-99,-69,'paving');
      for(let x=Math.floor(lo/62)*62;x<hi;x+=62){const y=ground(s,x);if(y==null)continue;line(c,[[x,y-98],[x-7,y-70]],'#5b5c4a60',1);}
      for(let k=Math.floor(lo/1050);k<hi/1050;k++){const x=k*1050+780,y=ground(s,x);if(y==null||frontage(s,x,30))continue;lamp(c,x,y-91);}
      for(let k=Math.floor(lo/670);k<hi/670;k++){
        const x=k*670+520,y=ground(s,x);if(y==null||frontage(s,x,25))continue;
        const type=k%3===0?'bin':'bench';window.BearlyStreetProps?.draw(c,type,x,y-84,type==='bench'?98:35,s.time);
      }
      for(let k=Math.floor(lo/2200);k<hi/2200;k++){const x=k*2200+330,y=ground(s,x);if(y==null||frontage(s,x,95))continue;const zone=s.districtAt(x).style;parkSign(c,x,y-97,zone==='lake'?'MÄLAREN':zone==='forest'?'GRIMSTA':'HÄSSELBY',zone==='lake'?'STRANDPROMENAD':'CYKELVÄG  /  CYCLE ROUTE');}
    },
    road(c,s){
      textureStrip(c,s,-66,70,'road');
      const [lo,hi]=range(s,230);
      // Raised rear kerb; each stone is a separate sloped block.
      for(let x=Math.floor(lo/62)*62;x<hi;x+=62){const a=ground(s,x),b=ground(s,x+61);if(a==null||b==null)continue;
        shape(c,[[x,a-72],[x+61,b-72],[x+60,b-59],[x,a-59]],'#888674','#4b5144',1.5);
        line(c,[[x+2,a-72],[x+59,b-72]],'#c6bea0',2.2);
      }
      // Sparse worn paint and cracks, deterministic in world coordinates.
      for(let x=Math.floor(lo/230)*230;x<hi;x+=230){const a=ground(s,x),b=ground(s,x+74);if(a==null||b==null)continue;
        line(c,[[x,a+44],[x+74,b+44]],'#c9bfa270',4);for(let j=0;j<7;j++){const xx=x+noise(j,x)*78;const yy=ground(s,xx);if(yy!=null){c.fillStyle='#79766b';c.fillRect(xx,yy+41,noise(j,6)*5+1,2);}}
      }
      for(let k=Math.floor(lo/170);k<hi/170;k++){const x=k*170+noise(k,4)*90,y=ground(s,x);if(y==null)continue;const yy=y-36+noise(k,6)*83;line(c,[[x,yy],[x+8,yy+3],[x+14,yy-2],[x+24,yy+5]],'#4b4c4148',.8);}
      // Near pavement: bevel, weathered face, and individually joined stones.
      textureStrip(c,s,70,101,'paving');
      for(let x=Math.floor(lo/78)*78;x<hi;x+=78){const a=ground(s,x),b=ground(s,x+77);if(a==null||b==null)continue;
        shape(c,[[x,a+71],[x+77,b+71],[x+70,b+92],[x-5,a+92]],'#a7a08a','#595d4f',1.5);
        line(c,[[x+2,a+72],[x+74,b+72]],'#d4c9aa',3);
        shape(c,[[x-5,a+92],[x+70,b+92],[x+70,b+106],[x-5,a+106]],'#646b5b','#404b3e',1.2);
      }
      for(let k=Math.floor(lo/28);k<hi/28;k++){const x=k*28+noise(k,3)*18,y=ground(s,x);if(y==null)continue;const off=noise(k,8)<.58?(-59+noise(k,5)*16):(55+noise(k,5)*46);leaf(c,x,y+off,3+noise(k,4)*4,k);}
    },
    foreground(c,s){
      const [lo,hi]=range(s,160);
      for(let k=Math.floor(lo/115);k<hi/115;k++){
        const x=k*115+noise(k,20)*58,y=ground(s,x);if(y==null)continue;
        shrub(c,x,y+130,90,k+55);
        for(let j=0;j<6;j++)leaf(c,x+(j-3)*14,y+114+noise(k+j,18)*18,4,k+j);
      }
      // Falling leaves are atmospheric, rather than a full-screen effect.
      if(!s.reducedMotion){for(let k=Math.floor(lo/330);k<hi/330;k++){const x=k*330+120+Math.sin(s.time*.5+k)*27,y=ground(s,x);if(y==null)continue;const drift=(s.time*15+k*81)%240;leaf(c,x,y-340+drift,3.4,k);}}
    },
    ready(){return{panorama:panorama.complete&&panorama.naturalWidth>0,tree:tree.complete&&tree.naturalWidth>0,verge:verge.complete&&verge.naturalWidth>0,cafe:cafe.complete&&cafe.naturalWidth>0,metro:metro.complete&&metro.naturalWidth>0,forest:forest.complete&&forest.naturalWidth>0};}
  };
})();
