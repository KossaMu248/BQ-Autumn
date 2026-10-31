const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const window={};vm.runInNewContext(fs.readFileSync('js/brawler.js','utf8'),{window});
const make=()=>window.BearlyBrawler.create(),p={x:0,depth:0,z:0,face:1};
function step(c,seconds,player=p){for(let t=0;t<seconds;t+=.02)c.update(.02,player)}
const range=make();range.enter('a',[{id:'far-depth',x:40,depth:55}]);assert.equal(range.grab(p),false);assert.equal(range.maul(p),false);
range.enter('b',[{id:'near',x:50,depth:0}]);assert.equal(range.grab({...p,z:30}),false);assert.equal(range.maul({...p,z:40}),false);
assert.equal(range.grab(p),true);assert.equal(range.snapshot().held,'near');assert.ok(range.snapshot().baby,'baby is in a separate safe seat');assert.equal(range.throwAtScreen(p),true);
assert.equal(range.snapshot().npcs[0].state,'screen');step(range,1);assert.equal(range.snapshot().npcs[0].state,'down');step(range,3);assert.equal(range.snapshot().npcs[0].state,'idle','NPC recovers for future interactions');
const c=make();c.enter('practice',[{id:'a',x:60,depth:0},{id:'b',x:70,depth:0},{id:'c',x:80,depth:0}]);
assert.ok(c.grab(p));assert.ok(c.throwAtScreen(p));assert.equal(c.snapshot().phase,'primal');
assert.ok(c.maul(p));assert.equal(c.maul(p),false,'maul cooldown stops event spam');step(c,.44);assert.ok(c.maul(p));step(c,.44);
assert.ok(c.grab(p));assert.ok(c.throwAtScreen(p));assert.equal(c.snapshot().phase,'rolling');assert.equal(c.snapshot().frenzy,8);
const hp=c.snapshot().hp;assert.equal(c.hit(99),false);assert.equal(c.snapshot().hp,hp,'rolling is invulnerable');
step(c,8.1);assert.equal(c.snapshot().phase,'cute');assert.equal(c.snapshot().heat,0);assert.equal(c.snapshot().invulnerable,false);assert.equal(c.hit(8),true);assert.equal(c.snapshot().hp,hp-8,'immunity ends with the frenzy');
step(c,6);assert.equal(c.snapshot().baby,null,'carrier returns once the action is calm');
const snapshot=c.snapshot();snapshot.npcs.length=0;assert.ok(c.snapshot().npcs.length>0);
c.cancel();assert.equal(c.snapshot().held,null);assert.equal(c.snapshot().phase,'cute');
console.log('Brawler checks passed: lane/jump reach, grab/throw, recovery, maul cooldown, primal buildup, timed invulnerability and return to cute.');
