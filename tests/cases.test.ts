import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine/Engine.ts';
import {CASES,isCompatibleSession} from '../src/engine/model.ts';
import {assess,observations,TEACHING} from '../src/teaching.ts';
import {contribution,Synthesizer,CHANNELS} from '../src/engine/signals.ts';
const act=(e:Engine,node:string)=>e.events.filter(x=>x.kind==='activation'&&x.node===node);
const intervals=(xs:{t:number}[])=>xs.slice(1).map((x,i)=>x.t-xs[i].t);

test('five visible cases have distinct mechanisms; legacy AVNRT studies remain compatible',()=>{
 const visible=CASES.filter(c=>!c.legacy&&!c.advanced);assert.equal(visible.length,5);assert.equal(new Set(visible.map(c=>c.mechanism)).size,5);
 assert.ok(isCompatibleSession('0.1.0','avnrt-02'));assert.ok(isCompatibleSession('0.2.0','af-01'));
 assert.equal(isCompatibleSession('0.1.0','af-01'),false);assert.equal(isCompatibleSession('9.0.0','avnrt-01'),false);assert.throws(()=>new Engine('unknown'));
});
test('AVRT has a causal V-to-A return limb with distal CS earliest and normal forward HV',()=>{
 const e=new Engine('avrt-01');e.advance(6000);assert.equal(e.metrics().cl,300);
 const byId=new Map(e.events.map(x=>[x.id,x]));
 for(const a of act(e,'A').slice(1)){const parent=byId.get(a.cause!);assert.equal(parent?.node,'V');assert.equal(a.t-parent!.t,140);assert.equal(a.atrialPattern,'distal');}
 for(const v of act(e,'V')){const h=byId.get(v.cause!);assert.equal(h?.node,'H');assert.equal(v.t-h!.t,45);}
 const a=act(e,'A')[1];const peak=(ch:number)=>Array.from({length:120},(_,i)=>({i,y:Math.abs(contribution(ch,a,a.t+i))})).sort((a,b)=>b.y-a.y)[0].i;
 assert.ok(peak(7)<peak(6)&&peak(6)<peak(5));
});
test('focal AT maintains its atrial clock during ventricular pacing across start phases',()=>{
 for(const now of [6000,6350,6700,7010,8500]){const e=new Engine('at-01');e.advance(now);e.pace(TEACHING.at.protocol!);e.advance(now+16000);
 assert.ok(intervals(act(e,'A')).every(t=>t===420));assert.ok(intervals(act(e,'V')).some(t=>t!==420));
 assert.equal(assess('at','at',TEACHING.at.keyEvidence,e.events).correct,true,`phase ${now}`);}
});
test('typical flutter teaching scenario has 240 ms atrial clock and 2:1 AV conduction',()=>{
 const e=new Engine('flutter-01');e.advance(12000);assert.ok(intervals(act(e,'A')).every(t=>t===240));assert.ok(intervals(act(e,'V')).every(t=>t===480));assert.equal(e.metrics().rate,125);
 assert.ok(e.events.some(x=>x.kind==='block'&&x.node==='U'));assert.ok(act(e,'A').length>=2*act(e,'V').length);
});
test('AF has irregular local atrial and ventricular intervals and changing catheter delays',()=>{
 const e=new Engine('af-01');e.advance(12000);assert.ok(new Set(intervals(act(e,'A'))).size>20);assert.ok(new Set(intervals(act(e,'V'))).size>10);assert.equal(e.metrics().regular,false);
 const atria=act(e,'A');assert.ok(atria.every(a=>a.atrialPattern==='fibrillation'));assert.notDeepEqual(atria[0].atrialDelays,atria[1].atrialDelays);
 assert.equal(assess('af','af',TEACHING.af.keyEvidence,e.events).correct,true);
});
test('each case rubric accepts collected evidence and rejects wrong diagnoses and unsupported claims',()=>{
 for(const c of CASES.filter(c=>!c.legacy&&!c.advanced)){const e=new Engine(c.id);e.advance(6000);const lesson=TEACHING[c.mechanism];if(lesson.protocol)e.pace(lesson.protocol);e.advance(24000);
 assert.equal(assess(c.mechanism,c.mechanism,lesson.keyEvidence,e.events).correct,true,c.id);
 assert.equal(assess(c.mechanism,'sinus',lesson.keyEvidence,e.events).correct,false);
 assert.equal(assess(c.mechanism,c.mechanism,lesson.keyEvidence.slice(0,1),e.events).correct,false);
 assert.equal(assess(c.mechanism,c.mechanism,[...lesson.keyEvidence,'unobserved'],e.events).correct,false);
 }
});
test('a guessed mechanism or failed capture cannot substitute for observed pacing evidence',()=>{
 const e=new Engine();e.advance(6000);assert.equal(assess('avnrt','avnrt',TEACHING.avnrt.keyEvidence,e.events).correct,false);
 const at=new Engine('at-01');at.advance(6000);assert.equal(observations(at.events).find(f=>f.id==='independent')?.valid,false);
 at.pace({...TEACHING.at.protocol!,output:.1});at.advance(16000);assert.equal(observations(at.events).find(f=>f.id==='independent')?.valid,false);
});
test('new cases replay exactly with different time chunking, including AF after pacing and stopping',()=>{
 for(const c of CASES.filter(c=>!c.advanced&&c.mechanism!=='avnrt')){const a=new Engine(c.id);a.advance(6230);a.pace({site:'RVA',s1:270,beats:8,s2:null,output:5,width:1});a.advance(7200);a.stop();a.advance(12340);a.pace({site:'HRA',s1:500,beats:4,s2:280,output:5,width:1});a.advance(20000);
 const b=new Engine(c.id);for(const cmd of a.commands){while(b.now+37<cmd.t)b.advance(b.now+37);b.advance(cmd.t);if(cmd.type==='pace')b.pace(cmd.protocol);else b.stop();}b.advance(a.now);assert.deepEqual(b.events,a.events,c.id);assert.deepEqual(b.metrics(),a.metrics());}
});
test('all case waveforms remain finite and frame-continuous with phenotype-specific signals',()=>{
 const samples=(id:string,chunk:number)=>{const e=new Engine(id),s=new Synthesizer(),data:number[][]=Array.from({length:CHANNELS.length},()=>[]);for(let t=0;t<1200;t+=chunk){const n=e.events.length;e.advance(t+chunk);s.render(t,t+chunk,e.events.slice(n)).forEach((x,i)=>data[i].push(...x));}return data;};
 for(const c of CASES.filter(c=>!c.legacy&&!c.advanced)){const a=samples(c.id,50),b=samples(c.id,100);assert.deepEqual(a,b,c.id);assert.ok(a.flat().every(Number.isFinite));}
 assert.notDeepEqual(samples('af-01',50)[2],samples('flutter-01',50)[2]);
});
