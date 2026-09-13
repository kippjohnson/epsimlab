import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine/Engine.ts';
const preset={site:'HRA' as const,s1:500,beats:8,s2:280,output:5,width:1};
test('baseline: one atrial, His and ventricular activation per sinus cycle',()=>{const e=new Engine();e.advance(6000);const act=e.events.filter(x=>x.kind==='activation');const a=act.filter(x=>x.node==='A');const h=act.filter(x=>x.node==='H');const v=act.filter(x=>x.node==='V');assert.equal(a.length,8);assert.equal(h.length,a.length);assert.equal(v.length,a.length);for(let i=0;i<a.length;i++){assert.equal(h[i].t-a[i].t,115);assert.equal(v[i].t-h[i].t,45);}assert.equal(e.metrics().cl,800);});
test('atrial extrastimulus induces sustained graph reentry over different start phases',()=>{for(const now of [6000,6350,6700,7010,8500]){const e=new Engine();e.advance(now);const end=e.pace(preset);e.advance(end+10000);assert.equal(e.metrics().cl,315,`phase ${now}`);assert.equal(e.metrics().regular,true);const last=e.events.filter(x=>x.kind==='activation'&&x.node==='V').slice(-8);last.slice(1).forEach((x,i)=>assert.equal(x.t-last[i].t,315));assert.ok(e.events.some(x=>x.label==='Fast pathway refractory'));}});
test('non-premature S2 does not induce reentry',()=>{const e=new Engine();e.advance(6000);e.pace({...preset,s2:500});e.advance(24000);assert.equal(e.metrics().cl,800);});
test('variant conduction delay produces a different tachycardia cycle length',()=>{const e=new Engine('avnrt-02');e.advance(6000);e.pace(preset);e.advance(25000);assert.equal(e.metrics().cl,345);});
test('subthreshold stimulus fails to capture and cannot induce tachycardia',()=>{const e=new Engine();e.advance(6000);e.pace({...preset,output:.1});e.advance(18000);const stimuli=e.events.filter(x=>x.kind==='stimulus');assert.equal(stimuli.length,9);assert.ok(stimuli.every(x=>x.captured===false));assert.equal(e.metrics().cl,800);});
test('pulse width changes capture threshold',()=>{for(const [width,captured] of [[.1,false],[2,true]] as const){const e=new Engine();e.advance(6050);e.pace({...preset,beats:1,s2:null,output:1,width});e.advance(6300);assert.equal(e.events.find(x=>x.kind==='stimulus')?.captured,captured);}});
test('stop removes pending stimuli without erasing prior activations',()=>{const e=new Engine();e.advance(6000);e.pace(preset);e.advance(6800);e.stop();e.advance(14000);assert.equal(e.events.filter(x=>x.kind==='stimulus').length,2);});
test('command replay gives exactly the same events with different advance chunk sizes',()=>{const a=new Engine();a.advance(6000);a.pace(preset);a.advance(15000);a.pace({...preset,site:'RVA',s1:285,beats:12,s2:null});a.advance(23000);const b=new Engine();for(const cmd of a.commands){while(b.now+37<cmd.t)b.advance(b.now+37);b.advance(cmd.t);if(cmd.type==='pace')b.pace(cmd.protocol);else b.stop();}b.advance(a.now);assert.deepEqual(b.events,a.events);});
test('protocol and time validation rejects invalid input',()=>{const e=new Engine();assert.throws(()=>e.pace({...preset,s1:NaN}));assert.throws(()=>e.pace({...preset,width:0}));assert.throws(()=>e.pace({...preset,beats:3.5}));e.advance(10);assert.throws(()=>e.advance(9));});

test('every foundational case distinguishes delivered RV pulses from captured ventricular activation',()=>{
 for(const caseId of ['avnrt-01','avrt-01','at-01','flutter-01','af-01']){
  for(const output of [0,5]){
   const e=new Engine(caseId);e.advance(6000);e.pace({...preset,site:'RVA',s1:400,beats:8,s2:250,s3:230,output,width:.6});e.advance(11500);
   const pulses=e.events.filter(x=>x.kind==='stimulus');assert.equal(pulses.length,10);
   assert.ok(pulses.every(x=>x.output===output&&x.pulseWidth===.6&&x.pacingSite==='RVA'));
   if(output===5)assert.ok(pulses.some(x=>x.captured),caseId);
   for(const pulse of pulses){
    const capture=e.events.filter(x=>x.kind==='activation'&&x.cause===pulse.id);
    assert.equal(capture.length,pulse.captured?1:0,caseId);
    if(pulse.captured){assert.equal(capture[0].node,'V');assert.equal(capture[0].t,pulse.t);assert.equal(capture[0].morphology,'paced');}
   }
   assert.ok(e.events.filter(x=>x.kind==='activation'&&x.node==='V'&&x.from==='H').every(x=>x.morphology===undefined));
  }
 }
});

test('atrial pacing preserves conducted ventricular morphology; refractory ventricular pulses do not create paced QRS',()=>{
 const atrial=new Engine();atrial.advance(6000);atrial.pace(preset);atrial.advance(15000);
 assert.ok(atrial.events.filter(x=>x.kind==='stimulus').every(x=>x.pacingSite==='HRA'&&x.output===5&&x.pulseWidth===1));
 assert.ok(atrial.events.filter(x=>x.kind==='activation'&&x.node==='V').every(x=>x.morphology===undefined));
 const refractory=new Engine();refractory.advance(100);refractory.pace({...preset,site:'RVA',beats:1,s2:null});refractory.advance(500);
 const pulse=refractory.events.find(x=>x.kind==='stimulus')!;assert.equal(pulse.captured,false);assert.equal(pulse.output,5);
 assert.ok(!refractory.events.some(x=>x.kind==='activation'&&x.cause===pulse.id));
});

test('ventricular escape following AV conduction injury has a ventricular-origin morphology without a pacing stimulus',()=>{
 const e=new Engine();e.advance(6000);e.intervene({type:'ablate',target:'his-risk',power:30,contact:1,duration:10});e.advance(21000);
 const escape=e.events.filter(x=>x.kind==='activation'&&x.label.startsWith('Ventricular escape'));
 assert.ok(escape.length>2);assert.ok(escape.every(x=>x.node==='V'&&x.morphology==='escape'&&x.pacingSite===undefined));
 assert.equal(e.events.filter(x=>x.kind==='stimulus').length,0);
});
