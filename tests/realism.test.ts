import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../src/engine/Engine.ts';
import {Engine as PreviousEngine} from '../src/engine/legacy/Engine.ts';
import {CHANNELS,contribution,localActivationPeak,Synthesizer} from '../src/engine/signals.ts';
import {DEFAULT_MANEUVER} from '../src/engine/curriculum.ts';
import {analyzeManeuver} from '../src/engine/diagnosticAnalysis.ts';
import {CASES,ENGINE_VERSION,type LabEvent,type Command} from '../src/engine/model.ts';
const ch=(id:string)=>CHANNELS.findIndex(c=>c.id===id);
const activation=(node:'A'|'H'|'V',extra:Partial<LabEvent>={}):LabEvent=>({id:1,t:0,kind:'activation',node,label:node,...extra});
const induction={site:'HRA' as const,s1:500,beats:8,s2:280,output:5,width:1};
const peak=(id:string,e:LabEvent)=>localActivationPeak(ch(id),e);

test('retrograde nodal activation starts septally; lateral pathway return starts in distal CS',()=>{
 const e=new Engine();e.advance(6000);e.pace(induction);e.advance(15000);
 const retro=e.events.filter(x=>x.kind==='activation'&&x.node==='A'&&x.from==='U').at(-1)!;
 assert.equal(retro.atrialPattern,'concentric');
 assert.ok(peak('HISd',retro)<peak('HRA',retro));assert.ok(peak('HISd',retro)<peak('CSp',retro));
 const ap=new Engine('avrt-01');ap.advance(5000);const a=ap.events.filter(x=>x.node==='A'&&x.kind==='activation').at(-1)!;
 assert.ok(peak('CSd',a)<peak('CSp',a));assert.ok(peak('CSd',a)<peak('HISd',a));
 const advanced=new Engine('avnrt-atypical');advanced.advance(5000);
 assert.ok(advanced.events.filter(x=>x.kind==='activation'&&x.node==='A').every(x=>x.atrialPattern==='concentric'));
});
test('bipolar direction changes polarity; local signals are balanced and distinct from far field',()=>{
 const forward=activation('A',{atrialDelays:[0,0,0,0,0,0]}),reverse={...forward,atrialPattern:'distal' as const};
 let sum=0,energy=0;
 for(let t=0;t<100;t+=.1){const a=contribution(ch('CSp'),forward,t),b=contribution(ch('CSp'),reverse,t);assert.ok(Math.abs(a+b)<1e-10);sum+=a;energy+=Math.abs(a);}
 assert.ok(Math.abs(sum)<energy*.001,'bipolar potential should have approximately zero area');
 const width=(id:string,e:LabEvent)=>{const a=Array.from({length:300},(_,i)=>Math.abs(contribution(ch(id),e,i*.5))),max=Math.max(...a),idx=a.flatMap((x,i)=>x>max*.1?[i]:[]);return idx.at(-1)!-idx[0];};
 assert.ok(width('HISd',activation('H'))<width('CSp',activation('V')));
 const v=activation('V'),rv=Array.from({length:150},(_,i)=>Math.abs(contribution(ch('RV'),v,i))),hra=Array.from({length:150},(_,i)=>Math.abs(contribution(ch('HRA'),v,i)));
 assert.ok(Math.max(...rv)>10*Math.max(...hra));
});
test('RV myocardial pacing reverses the local ventricular sequence and preserves sharp near field',()=>{
 const native=activation('V'),paced=activation('V',{morphology:'paced',pacingSite:'RVA'});
 assert.ok(peak('HISd',native)<peak('RV',native));
 assert.ok(peak('RV',paced)<peak('HISd',paced));
 assert.ok(peak('HISd',paced)<peak('CSd',paced));
 assert.notEqual(contribution(ch('RV'),native,15),contribution(ch('RV'),paced,15));
});
test('rapid atrial drive progressively delays AV nodal conduction, blocks, then recovers',()=>{
 const e=new Engine('avrt-01');e.advance(6000);e.intervene({type:'cardiovert'});e.advance(10000);
 e.pace({site:'HRA',s1:240,beats:30,s2:null,output:5,width:1});e.advance(19000);
 const byId=new Map(e.events.map(x=>[x.id,x]));
 const h=e.events.filter(x=>x.kind==='activation'&&x.node==='H'&&x.t>10100&&x.t<17000);
 const delays=h.map(x=>x.t-byId.get(x.cause!)!.t);
 assert.ok(delays.slice(0,6).every((x,i,a)=>i===0||x>a[i-1]),String(delays));
 const block=e.events.find(x=>x.label.includes('incompletely recovered'))!;assert.ok(block);
 const next=h.find(x=>x.t>block.t)!;assert.ok(next.t-byId.get(next.cause!)!.t<delays[5]);
 assert.ok(e.events.filter(x=>x.kind==='stimulus').every(x=>x.captured),'nodal block must not be mislabeled atrial noncapture');
});
test('foundational maneuvers have reports, true incremental intervals, location effects and replay',()=>{
 const run=(site:'apex'|'base')=>{const e=new Engine('avrt-01');e.advance(6000);e.diagnostic({...DEFAULT_MANEUVER,cycle:270,beats:12,site});e.advance(16000);return e;};
 const apex=run('apex'),base=run('base');
 for(const e of [apex,base]){assert.equal(e.commands[0].type,'maneuver');assert.ok(e.diagnosticState().report);const replay=new Engine(e.caseId);for(const c of e.commands){replay.advance(c.t);replay.applyCommand(c);}replay.advance(e.now);assert.deepEqual(replay.events,e.events);}
 const sa=(e:Engine)=>parseInt(e.diagnosticState().report!.values.find(v=>v.label==='Stimulus → A')!.value);
 assert.ok(sa(apex)>sa(base));
 const inc=new Engine();inc.advance(6000);inc.diagnostic({...DEFAULT_MANEUVER,maneuver:'incremental',cycle:500,beats:20});inc.advance(16000);
 const pulses=inc.events.filter(x=>x.kind==='stimulus');
 for(let i=1;i<pulses.length;i++)assert.equal(pulses[i].t-pulses[i-1].t,Math.max(220,500-(i-1)*20));
});
test('His-timed PVC can be cancelled or fail capture without implying a negative pathway test',()=>{
 const e=new Engine('avrt-01');e.advance(6000);e.diagnostic({...DEFAULT_MANEUVER,maneuver:'pvc',output:0});e.advance(8500);
 assert.equal(e.diagnosticState().report?.status,'Incomplete capture');assert.ok(!e.events.some(x=>x.evidence==='hisPVC'));
 const cancelled=new Engine();cancelled.advance(6000);cancelled.diagnostic({...DEFAULT_MANEUVER,maneuver:'pvc'});cancelled.stop();cancelled.advance(10000);assert.equal(cancelled.events.filter(x=>x.kind==='stimulus').length,0);
});
test('strength-duration capture thresholds are consistent across foundation and advanced networks',()=>{
 for(const width of [.1,.5,1,2])for(const output of [.1,.8,1,2,5]){
  const results=['avnrt-01','his-purkinje'].map(id=>{const e=new Engine(id);e.advance(6050);e.pace({...induction,beats:1,s2:null,output,width});e.advance(6200);return e.events.find(x=>x.kind==='stimulus')!.captured;});
  assert.equal(results[0],results[1],`width ${width}, output ${output}`);
 }
});
// Authored event fixture verifies analyzer logic independently of the engine that generates rhythms.
test('postpacing analysis retains V–A–A–V and excludes later interventions from a completed window',()=>{
 let id=0;const events:LabEvent[]=[];const add=(t:number,node:'A'|'V',cause?:number)=>{const e={id:++id,t,node,kind:'activation' as const,label:node,cause};events.push(e);return e.id;};
 for(let t=0;t<2000;t+=400){add(t,'V');add(t+100,'A');}
 for(const t of [2100,2400,2700]){const s=++id;events.push({id:s,t,kind:'stimulus',node:'V',label:'vop',captured:true});add(t,'V',s);add(t+100,'A',s);}
 add(2950,'A');add(3100,'V');
 const command:Command={...DEFAULT_MANEUVER,t:2000,cycle:300,beats:3};
 const r=analyzeManeuver(events,[command],5000)!;
 assert.equal(r.status,'Atrial acceleration with stable S–A');
 assert.equal(r.values.find(x=>x.label==='Last paced V then activations')!.value,'V–A–A–V');
 assert.notEqual(analyzeManeuver(events,[command,{t:4500,type:'drug',drug:'adenosine'}],5000)!.status,'Confounded');
 assert.equal(analyzeManeuver(events,[command,{t:3000,type:'drug',drug:'adenosine'}],5000)!.status,'Confounded');
});
test('para-Hisian analysis cannot count unrelated sinus atria as retrograde return',()=>{
 const events:LabEvent[]=[];let id=0;
 for(const t of [100,500,900]){events.push({id:++id,t,kind:'stimulus',label:'parahis',node:'V',captured:true});events.push({id:++id,t:t+100,kind:'activation',node:'A',label:'sinus'});}
 const r=analyzeManeuver(events,[{...DEFAULT_MANEUVER,maneuver:'parahis',t:0,cycle:400,beats:3,capture:'rv'}],3000)!;
 assert.equal(r.status,'Retrograde conduction not established');
 assert.equal(r.values.find(x=>x.label==='Mean stimulus → A')?.value,'No atrial return');
});
test('all fifteen cases preserve causality, finite recordings and deterministic maneuver replay',()=>{
 for(const c of CASES.filter(c=>!c.legacy)){
  const a=new Engine(c.id);a.advance(6037);a.diagnostic({...DEFAULT_MANEUVER,maneuver:'vop',cycle:300,beats:8});a.advance(10500);a.stop();a.advance(11000);
  const b=new Engine(c.id);for(const command of a.commands){while(b.now+37<command.t)b.advance(b.now+37);b.advance(command.t);b.applyCommand(command);}b.advance(a.now);assert.deepEqual(a.events,b.events,c.id);
  const byId=new Map(a.events.map(x=>[x.id,x]));for(const e of a.events){assert.ok(Number.isFinite(e.t));if(e.cause&&byId.has(e.cause))assert.ok(byId.get(e.cause)!.t<=e.t,c.id);}
  const data=new Synthesizer().render(10000,11000,a.events.filter(x=>x.t>=9500));assert.ok(data.every(x=>x.every(Number.isFinite)),c.id);
 }
});
test('0.4 studies select frozen physiology instead of silently changing saved command responses',()=>{
 assert.notEqual(ENGINE_VERSION,'0.4.0');
 for(const c of CASES){const old=new PreviousEngine(c.id),restored=new Engine(c.id,'0.4.0');
  for(const e of [old,restored]){e.advance(6000);e.pace({...induction,site:'RVA',s1:270,beats:12,s2:null});e.advance(16000);}
  assert.deepEqual(restored.events,old.events,c.id);assert.equal(restored.version,'0.4.0');
 }
});

test('no His trigger reports an undelivered maneuver rather than waiting forever',()=>{
 const e=new Engine('his-purkinje');e.advance(6000);e.intervene({type:'drug',drug:'adenosine'});e.advance(6500);e.diagnostic({...DEFAULT_MANEUVER,maneuver:'pvc'});e.advance(10000);
 assert.equal(e.diagnosticState().report?.status,'No stimulus delivered');
});
test('pacing a fully lesioned mapping site cannot report capture',()=>{
 const e=new Engine('scar-vt');e.advance(6000);e.diagnostic({type:'map',site:1});e.diagnostic({type:'lesion',duration:10,contact:1});e.diagnostic({...DEFAULT_MANEUVER,maneuver:'pacemap'});e.advance(12000);
 const pulses=e.events.filter(x=>x.kind==='stimulus');assert.ok(pulses.length);assert.ok(pulses.every(x=>!x.captured));
 assert.equal(e.diagnosticState().report?.status,'Incomplete capture');
});

test('a sufficiently long ventricular train can entrain AVNRT; faster pacing can interrupt it',()=>{
 const run=(cycle:number)=>{const e=new Engine();e.advance(6000);e.pace(induction);e.advance(15000);e.diagnostic({...DEFAULT_MANEUVER,cycle,beats:20});e.advance(26000);return e;};
 const entrained=run(285);assert.equal(entrained.diagnosticState().report?.status,'Atrial acceleration with stable S–A');assert.equal(entrained.metrics().cl,315);
 const interrupted=run(230);assert.equal(interrupted.metrics().cl,800);assert.notEqual(interrupted.diagnosticState().report?.status,'Atrial acceleration with stable S–A');
});
