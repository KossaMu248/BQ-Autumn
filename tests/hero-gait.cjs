/* Bear walking checks: cadence, contacts, bounded anatomy and continuous weight transfer. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');

function canvasContext(){
  const state={globalAlpha:1},stack=[];
  return new Proxy(state,{get(object,key){
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
  assert.ok(cycle/height>.70&&cycle/height<.85,'a complete cycle travels most of a body height');
  const cadence=155/cycle;
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
    assert.ok((front-back)/height>.46,'foot travel is visibly longer than the old short shuffle');
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

let cases=0,maxHipAdjustment=0;
for(const height of [90,145,225,300])for(const carrier of ['front','back'])for(const face of [-1,1])for(let phase=0;phase<128;phase++){
  rig.draw(canvasContext(),0,0,height,face,{state:{hp:100,...(carrier==='back'?{baby:{}}:{})},weight:1,distance:gait.cycleLength(height)*phase/128});
  const audit=rig.audit();
  assert.equal(audit.carrier,carrier);assert.equal(audit.integratedCarrier,true);
  assert.equal(audit.babyFace.continuousUpperBody,true);assert.equal(audit.babyFace.headOnly,false);
  assert.ok(Math.abs(audit.body.roll)<.03&&Math.abs(audit.body.sway)<height*.011,'whole-body motion stays small');
  for(const leg of Object.values(audit.landmarks)){
    close(Math.hypot(leg.knee.x-leg.hip.x,leg.knee.y-leg.hip.y),leg.thighLength);
    close(Math.hypot(leg.cuff.x-leg.knee.x,leg.cuff.y-leg.knee.y),leg.shinLength);
    assert.ok(Math.abs(leg.hip.x-audit.body.pivot.x)<height*.17,'attachments stay under the painted shorts');
    const adjustment=Math.hypot(leg.hip.x-leg.nominalHip.x,leg.hip.y-leg.nominalHip.y)/height;
    maxHipAdjustment=Math.max(maxHipAdjustment,adjustment);
    assert.ok(adjustment<.025,'pelvic transfer accommodates reach without rubber limbs');
  }
  cases++;
}
// Eased starts/stops have no abrupt foot or torso jumps as blend weight changes.
for(const phase of [.0,.23,.51,.79]){
  let previous=null;
  for(let step=0;step<=100;step++){
    const weight=step/100,p=gait.pose(gait.cycleLength(145)*phase,145,weight);
    if(previous)for(const name of ['near','far'])assert.ok(Math.hypot(p[name].x-previous[name].x,p[name].y-previous[name].y)<1,'weight changes continuously');
    previous=p;
  }
}
console.log(JSON.stringify({result:'passed',rigCases:cases,streetCycle:gait.cycleLength(145),cyclesPerSecond:155/gait.cycleLength(145),maxHipAdjustment}));
