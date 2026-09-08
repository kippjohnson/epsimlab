import test from 'node:test';import assert from 'node:assert/strict';
import {Engine} from '../src/engine/Engine.ts';
import {validCommand,ENGINE_VERSION,type Command} from '../src/engine/model.ts';
import {CTI_TARGETS,type TargetId} from '../src/engine/therapy.ts';
const induce=(e:Engine)=>{e.advance(e.now+6000);e.pace({site:'HRA',s1:500,beats:8,s2:280,output:5,width:1});e.advance(e.now+7000);};
const aAfter=(e:Engine,t:number)=>e.events.filter(x=>x.kind==='activation'&&x.node==='A'&&x.t>t);
const lesion=(e:Engine,target:TargetId,contact=1,duration=10)=>{e.intervene({type:'ablate',target,power:30,duration,contact});e.advance(e.now+duration*1000);};
test('adenosine interrupts AV nodal reentry and AVRT but preserves atrial drivers, then washes out',()=>{
 for(const id of ['avnrt-01','avrt-01','at-01','flutter-01','af-01']){
  const e=new Engine(id);if(id==='avnrt-01')induce(e);else e.advance(6000);
  const t=e.now;e.intervene({type:'drug',drug:'adenosine'});e.advance(t+6000);
  assert.ok(!e.events.some(x=>x.kind==='activation'&&x.node==='V'&&x.t>t+1500));
  if(['at-01','flutter-01','af-01'].includes(id))assert.ok(aAfter(e,t+1500).length>8);
  e.advance(t+14000);assert.equal(e.therapyState().drugs.length,0);assert.ok(e.events.some(x=>x.node==='V'&&x.kind==='activation'&&x.t>t+9000));
  if(['avnrt-01','avrt-01'].includes(id))assert.equal(e.metrics().rate,75);
 }
});
test('esmolol slows the ventricular response; isoproterenol accelerates sinus timing',()=>{
 const e=new Engine('at-01');e.advance(6000);const rate=e.metrics().rate;e.intervene({type:'drug',drug:'esmolol'});e.advance(22000);assert.ok(e.metrics().rate<rate);assert.ok(aAfter(e,16000).length>10);
 const s=new Engine();s.advance(6000);s.intervene({type:'drug',drug:'isoproterenol'});s.advance(13000);assert.ok(s.metrics().rate>75);
});
test('cardioversion synchronizes to an actual ventricular event, retains substrate and permits focal AT recurrence',()=>{
 for(const id of ['avrt-01','at-01','flutter-01','af-01']){const e=new Engine(id);e.advance(6000);e.intervene({type:'cardiovert'});e.advance(10000);const shock=e.events.find(x=>x.kind==='shock')!;assert.ok(shock);assert.ok(e.events.some(x=>x.node==='V'&&x.kind==='activation'&&x.t===shock.t-16));assert.deepEqual(e.therapyState().lesions,{});e.advance(20000);assert.equal(e.metrics().rate,id==='at-01'?143:75);}
 const e=new Engine();e.advance(6000);e.intervene({type:'cardiovert'});e.intervene({type:'cancel-shock'});e.advance(10000);assert.ok(!e.events.some(x=>x.kind==='shock'));
});
test('ibutilide conversion is delayed and restricted to the authored flutter and AF examples',()=>{
 for(const id of ['flutter-01','af-01','at-01']){const e=new Engine(id);e.advance(6000);e.intervene({type:'drug',drug:'ibutilide'});e.advance(12000);assert.equal(e.therapyState().lastConversion,null);e.advance(24000);assert.equal(e.metrics().rate,id==='at-01'?143:75);}
});
test('slow pathway RF depends on contact and duration, persists after stop, and prevents reinduction',()=>{
 const e=new Engine();induce(e);lesion(e,'slow-pathway',0);assert.equal(e.therapyState().lesions['slow-pathway'],0);assert.ok(e.metrics().rate>150);
 e.intervene({type:'ablate',target:'slow-pathway',power:30,duration:10,contact:1});e.advance(e.now+3000);e.intervene({type:'stop-ablation'});e.advance(e.now+5000);assert.ok(Math.abs(e.therapyState().lesions['slow-pathway']!-.3)<1e-8);
 lesion(e,'slow-pathway');e.advance(e.now+5000);assert.equal(e.metrics().rate,75);induce(e);e.advance(e.now+5000);assert.equal(e.metrics().rate,75);
});
test('accessory pathway and focal AT lesions change only the relevant substrate',()=>{
 const e=new Engine('avrt-01');e.advance(6000);lesion(e,'atrial-focus');assert.ok(e.metrics().rate>150);lesion(e,'left-ap');e.advance(e.now+6000);assert.equal(e.metrics().rate,75);
 const start=e.now;e.intervene({type:'test',test:'va'});e.advance(start+7000);assert.ok(!e.events.some(x=>x.kind==='activation'&&x.node==='A'&&x.from==='V'&&x.t>start));
 const at=new Engine('at-01');at.advance(6000);lesion(at,'atrial-focus');at.advance(at.now+15000);assert.equal(at.metrics().rate,75);assert.ok(!aAfter(at,at.now-10000).some(x=>x.label.includes('Focal')));
});
test('CTI gaps sustain the circuit; complete line and both directional probes establish the model endpoint',()=>{
 const e=new Engine('flutter-01');e.advance(6000);lesion(e,CTI_TARGETS[0]);lesion(e,CTI_TARGETS[2]);e.intervene({type:'test',test:'cti-clockwise'});assert.equal(e.therapyState().tests.at(-1)!.blocked,false);assert.equal(e.metrics().rate,125);
 lesion(e,CTI_TARGETS[1]);e.advance(e.now+7000);assert.equal(e.metrics().rate,75);assert.deepEqual(e.therapyState().tests,[]);
 for(const test of ['cti-clockwise','cti-counterclockwise'] as const)e.intervene({type:'test',test});assert.ok(e.therapyState().tests.every(x=>x.blocked&&x.delay===150));
});
test('His-region injury is persistent and has a slow ventricular escape, not a successful cure',()=>{
 const e=new Engine();e.advance(6000);lesion(e,'his-risk');e.advance(e.now+15000);assert.equal(e.therapyState().avBlock,true);assert.equal(e.metrics().rate,40);assert.ok(aAfter(e,e.now-5000).length>3);
});
test('mixed treatment histories replay exactly across time chunks and reject malformed commands',()=>{
 const e=new Engine('flutter-01');e.advance(6000);e.intervene({type:'drug',drug:'adenosine'});e.advance(16000);lesion(e,'cti-annular');lesion(e,'cti-mid');lesion(e,'cti-caval');e.intervene({type:'test',test:'cti-clockwise'});e.advance(e.now+6000);
 for(const chunk of [37,250]){const r=new Engine(e.caseId);for(const c of e.commands){while(r.now+chunk<c.t)r.advance(r.now+chunk);r.advance(c.t);r.applyCommand(c);}r.advance(e.now);assert.deepEqual(r.events,e.events);assert.deepEqual(r.therapyState(),e.therapyState());}
 for(const c of [{type:'drug',drug:'fake'},{type:'ablate',target:'his-risk',power:999,duration:10,contact:1},{type:'ablate',target:'left-ap',power:30,duration:10,contact:NaN},{type:'test',test:'fake'}]){assert.equal(validCommand({...c,t:0}),false);assert.throws(()=>new Engine().applyCommand({...c,t:0} as Command));}
 assert.ok(validCommand({type:'cardiovert',t:0},ENGINE_VERSION));assert.equal(validCommand({type:'cardiovert',t:0},'0.2.0'),false);
});

test('synchronization times out without a ventricular trigger and drugs cannot be stacked repeatedly',()=>{
 const e=new Engine();e.advance(6000);e.intervene({type:'drug',drug:'adenosine'});assert.throws(()=>e.intervene({type:'drug',drug:'adenosine'}));e.advance(8000);e.intervene({type:'cardiovert'});e.advance(11500);assert.equal(e.therapyState().shockPending,false);assert.ok(!e.events.some(x=>x.kind==='shock'));assert.ok(e.events.some(x=>x.label.includes('no ventricular trigger')));
});
