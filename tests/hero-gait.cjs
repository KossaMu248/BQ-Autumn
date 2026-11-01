/* Bear walking checks: cadence, contacts, bounded anatomy and continuous weight transfer. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');

function canvasContext(){
  const state={globalAlpha:1,draws:[]},stack=[];
  return new Proxy(state,{get(object,key){
    if(key==='drawImage')return(image,...args)=>object.draws.push({image,args,alpha:object.globalAlpha});
    if(key==='save')return()=>stack.push({...object});
    if(key==='restore')return()=>Object.assign(object,stack.pop());
    return key in object?object[key]:()=>{};
  },set(object,key,value){object[key]=value;return true;}});
}
const window={},sandbox={window,Image:class{naturalWidth=2400;naturalHeight=2400;},
  Path2D:class{moveTo(){}quadraticCurveTo(){}lineTo(){}closePath(){}},
  document:{createElement:()=>({width:0,height:0,dataset:{},getContext:()=>canvasContext()})}};
for(const name of ['locomotion','baby-passenger','hero-rig'])vm.runInNewContext(fs.readFileSync('js/'+name+'.js','utf8'),sandbox);
const gait=window.BearlyLocomotion,rig=window.BearlyHeroRig;
const close=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);

for(const height of [90,145,225,300]){
  const cycle=gait.cycleLength(height);
  assert.ok(cycle/height>.55&&cycle/height<.65,'cycle distance fits the original short-legged anatomy');
  const cadence=120/cycle;
  if(height===145)assert.ok(cadence>1.1&&cadence<1.55,'street walking avoids rapid foot tapping');
  const first=gait.pose(0,height,1),half=gait.pose(cycle/2,height,1);
  assert.ok(first.near.x>first.far.x&&half.far.x>half.near.x,'each foot takes its turn in front');
  for(const side of ['near','far']){
    let front=-Infinity,back=Infinity,highest=0;
    for(let step=0;step<256;step++){
      const distance=cycle*step/256,p=gait.pose(distance,height,1),q=gait.pose(distance+cycle,height,1);
      assert.ok(p.near.stance||p.far.stance,'a walk always has a supporting foot');
      const foot=p[side],next=gait.pose(distance+.00001,height,1)[side];
      front=Math.max(front,foot.x);back=Math.min(back,foot.x);highest=Math.min(highest,foot.y);
      close(foot.x,q[side].x);close(foot.y,q[side].y);close(foot.angle,q[side].angle);
      if(foot.stance&&next.stance)close(distance+foot.x,distance+.00001+next.x);
    }
    assert.ok((front-back)/height>.34,'foot travel remains substantially longer than the pre-V16 shuffle');
    assert.ok(highest/height<-.06&&highest/height>-.10,'swing clears the ground without marching');
  }
  // Heel strike and toe-off stay continuous in position and velocity.
  for(const boundary of [0,gait.stanceDuty,1]){
    const epsilon=cycle*.00001;
    const a=gait.pose(boundary*cycle-epsilon,height,1).near;
    const b=gait.pose(boundary*cycle,height,1).near;
    const c=gait.pose(boundary*cycle+epsilon,height,1).near;
    assert.ok(Math.abs(c.x-a.x)<height*.0001&&Math.abs(c.y-a.y)<height*.0001);
    close((b.x-a.x)/epsilon,(c.x-b.x)/epsilon,.002);
    close((b.y-a.y)/epsilon,(c.y-b.y)/epsilon,.002);
  }
}

let cases=0;
for(const height of [90,145,225,300])for(const carrier of ['front','back'])for(const face of [-1,1])for(const weight of [0,.05,.1,.2,.3,.4,.6,.8,1])for(let phase=0;phase<8;phase++){
  const context=canvasContext();
  rig.draw(context,0,0,height,face,{state:{hp:100,...(carrier==='back'?{baby:{}}:{})},weight,distance:gait.cycleLength(height)*phase/8});
  const audit=rig.audit(),profile=rig.profiles()[carrier];
  assert.equal(audit.carrier,carrier);assert.equal(audit.integratedCarrier,true);
  assert.equal(audit.babyFace.continuousUpperBody,true);assert.equal(audit.babyFace.headOnly,false);
  const bodies=context.draws.filter(d=>d.image.dataset?.sourceTransform==='continuous-surface');
  assert.equal(bodies.length,1,'idle, transitions and steady walking paint exactly one body');
  assert.equal(bodies[0].alpha,1,'intermediate weights never fade the torso or produce ghost boots');
  assert.equal(audit.body.surfaces,1);assert.equal(audit.body.continuous,true);
  assert.ok(Math.abs(audit.body.roll)<.03&&Math.abs(audit.body.sway)<height*.011,'the native face remains on a gently moving rigid torso');
  for(const side of ['near','far']){
    const leg=audit.landmarks[side],source=profile[side],scale=height/profile.stature;
    assert.equal(leg.rigidShoe,true);
    close(leg.bootWidth/leg.bootHeight,source.boot[2]/source.boot[3]);
    assert.ok(Math.hypot(leg.cuff.x-leg.sole.x,leg.cuff.y-leg.sole.y)<height*.20,'the shoe collar remains attached to its own sole');
    if(weight===0){close(leg.sole.x,(source.sole[0]-profile.origin[0])*scale);close(leg.sole.y,(source.sole[1]-profile.origin[1])*scale);}
  }
  cases++;
}
// A warm steady pose reuses its rendered body; transient poses cannot corrupt it.
const context=canvasContext(),options={state:{hp:100},weight:1,distance:gait.cycleLength(145)*.25};
rig.draw(context,0,0,145,1,options);const steady=context.draws.find(d=>d.image.dataset?.sourceTransform==='continuous-surface').image;
rig.draw(canvasContext(),0,0,145,1,{...options,weight:.2});const repeated=canvasContext();rig.draw(repeated,0,0,145,1,options);
assert.equal(repeated.draws.find(d=>d.image.dataset?.sourceTransform==='continuous-surface').image,steady);
const cache=rig.cacheStats();assert.ok(cache.bytes<=cache.limitBytes&&cache.frames<=cache.frameLimit,'both carrier banks remain within the cache budget');
// Eased starts/stops have no abrupt foot or torso jumps as blend weight changes.
for(const phase of [.0,.23,.51,.79]){
  let previous=null;
  for(let step=0;step<=100;step++){
    const weight=step/100,p=gait.pose(gait.cycleLength(145)*phase,145,weight);
    if(previous)for(const name of ['near','far'])assert.ok(Math.hypot(p[name].x-previous[name].x,p[name].y-previous[name].y)<1,'weight changes continuously');
    previous=p;
  }
}
console.log(JSON.stringify({result:'passed',rigCases:cases,streetCycle:gait.cycleLength(145),cyclesPerSecond:120/gait.cycleLength(145),cacheBytes:cache.bytes}));
