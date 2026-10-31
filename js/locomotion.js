/* Continuous two-leg locomotion. A planted sole moves back at ground speed. */
(() => {
  'use strict';
  const TAU=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function foot(phase,height=225,weight=1){
    const p=((phase%1)+1)%1,duty=.62,half=height*.10;
    if(p<duty)return {x:half*(1-2*p/duty)*weight,y:0,angle:p>duty-.1?(p-duty+.1)*1.2*weight:0,stance:true};
    const t=(p-duty)/(1-duty);
    return {x:-half*Math.cos(Math.PI*t)*weight,y:-height*.085*Math.sin(Math.PI*t)*weight,angle:-.22*Math.sin(Math.PI*t)*weight,stance:false};
  }
  function pose(distance,height=225,weight=1){
    // 2*half during the stance part: the stance foot stays fixed in the world.
    const cycle=height*.20/.62,phase=distance/cycle;
    const far=foot(phase+.5,height,weight),near=foot(phase,height,weight);
    return {far,near,phase:((phase%1)+1)%1,bob:height*.006*(1-Math.cos(phase*TAU*2))*weight};
  }
  function knee(hip,ankle,thigh,shin){
    const dx=ankle.x-hip.x,dy=ankle.y-hip.y,d=clamp(Math.hypot(dx,dy),.01,thigh+shin-.01);
    const along=(thigh*thigh-shin*shin+d*d)/(2*d),out=Math.sqrt(Math.max(0,thigh*thigh-along*along));
    return {x:hip.x+dx/d*along+dy/d*out,y:hip.y+dy/d*along-dx/d*out};
  }
  window.BearlyLocomotion={pose,knee};
})();
