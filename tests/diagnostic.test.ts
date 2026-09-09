import test from 'node:test';import assert from 'node:assert/strict';
import {Engine} from '../src/engine/Engine.ts';
import {CASES,ENGINE_VERSION,isCompatibleSession,validCommand,type Command} from '../src/engine/model.ts';
import {DEFAULT_MANEUVER,validDiagnostic} from '../src/engine/curriculum.ts';
import {Synthesizer,CHANNELS} from '../src/engine/signals.ts';
import {observations} from '../src/teaching.ts';
const advanced=CASES.filter(c=>c.advanced);
function run(id:string,maneuver='vop',output=5){const e=new Engine(id);e.advance(6000);e.diagnostic({...DEFAULT_MANEUVER,maneuver:maneuver as typeof DEFAULT_MANEUVER.maneuver,cycle:Math.max(220,e.metrics().cl-30),beats:12,output});e.advance(16000);return e;}
test('ten additional distinct curricula retain old case/version compatibility',()=>{
 assert.equal(advanced.length,10);assert.equal(CASES.filter(c=>!c.legacy).length,15);assert.equal(new Set(advanced.map(c=>c.mechanism)).size,10);
 for(const c of advanced){assert.ok(isCompatibleSession(ENGINE_VERSION,c.id));assert.equal(isCompatibleSession('0.3.0',c.id),false);const e=new Engine(c.id);e.advance(6000);assert.ok(e.events.some(x=>x.kind==='activation'&&x.node==='V'));assert.ok(e.metrics().rate>0);}
 assert.ok(isCompatibleSession('0.3.0','avnrt-01'));assert.ok(validCommand({t:0,type:'cardiovert'},'0.3.0'));
});
test('His-refractory PVC changes septal/PJRT atrial timing but not the nodal loop',()=>{
 for(const [id,delta] of [['avnrt-atypical',0],['avrt-septal',-20],['pjrt-study',-20]] as const){const e=run(id,'pvc');const r=e.diagnosticState().report!;assert.equal(observations(e.events).find(x=>x.id===(delta===0?'pvcUnchanged':'pvcReset'))?.valid,true);assert.equal(r.status,'Captured during His refractoriness');assert.ok(r.values.some(v=>v.label==='Next A vs predicted'&&v.value.startsWith(String(delta)+' ms')),JSON.stringify(r));}
 const failed=run('avrt-septal','pvc',0);assert.ok(!failed.events.some(e=>e.evidence==='hisPVC'));assert.equal(failed.diagnosticState().report?.status,'Incomplete capture');
});
test('ventricular overdrive reports causally entrained atrium and discriminating return intervals',()=>{
 const nodal=run('avnrt-atypical'),ap=run('avrt-septal');for(const e of [nodal,ap]){const r=e.diagnosticState().report!;assert.equal(r.status,'Atrial acceleration with stable S–A');assert.ok(r.values.some(v=>v.label==='Last paced V then activations'&&v.value==='V–A–V'));}
 const ppi=(e:Engine)=>parseInt(e.diagnosticState().report!.values.find(v=>v.label.startsWith('PPI −'))!.value);
 assert.ok(ppi(nodal)>ppi(ap)+100);assert.equal(run('avrt-septal','vop',0).diagnosticState().report?.status,'Incomplete capture');
});
test('para-Hisian pacing records true His capture and nodal vs septal pathway responses',()=>{
 const values=(id:string,capture:'his-rv'|'rv'|'atrial')=>{const e=new Engine(id);e.advance(6000);e.intervene({type:'cardiovert'});e.advance(10000);e.diagnostic({...DEFAULT_MANEUVER,maneuver:'parahis',cycle:400,beats:12,capture});e.advance(19000);return e.diagnosticState().report!;};
 const sa=(r:ReturnType<typeof values>)=>parseInt(r.values.find(v=>v.label==='Mean stimulus → A')!.value);
 assert.ok(sa(values('avnrt-atypical','rv'))-sa(values('avnrt-atypical','his-rv'))>=60);
 assert.equal(sa(values('avrt-septal','rv')),sa(values('avrt-septal','his-rv')));
 assert.equal(values('avrt-septal','atrial').status,'Direct atrial capture — invalid comparison');
 const e=new Engine('avrt-septal');e.advance(6000);assert.throws(()=>e.diagnostic({...DEFAULT_MANEUVER,maneuver:'parahis'}));assert.equal(e.commands.length,0);
});
test('incremental atrial pacing exposes infra-His block and S3 follows S2',()=>{
 const e=new Engine('his-purkinje');e.advance(6000);assert.ok(observations(e.events).find(x=>x.id==='prolongedHV')?.valid);e.diagnostic({...DEFAULT_MANEUVER,maneuver:'incremental',cycle:600,beats:20});e.advance(22000);assert.ok(e.events.some(x=>x.evidence==='infraHis'));
 const p=new Engine('wpw-study');p.advance(6000);p.pace({site:'HRA',s1:500,beats:8,s2:280,s3:240,output:5,width:1});p.advance(12000);const s=p.events.filter(x=>x.kind==='stimulus');assert.equal(s.at(-1)!.label,'S3');assert.equal(s.at(-1)!.t-s.at(-2)!.t,240);assert.ok(p.events.some(x=>x.evidence==='preexcitation'));
});
test('mapping sites yield distinct activation and voltage; circuit vs bystander entrainment differs',()=>{
 const e=new Engine('rvot-vt');e.advance(6000);e.diagnostic({type:'collect-map'});e.diagnostic({type:'map',site:3});e.advance(8000);e.diagnostic({type:'collect-map'});assert.ok(e.diagnosticState().points.some(p=>p.site===0&&p.activation===-35));assert.ok(e.diagnosticState().points.some(p=>p.site===3&&p.activation===24));
 const measure=(site:number)=>{const e=new Engine('scar-vt');e.advance(6000);e.diagnostic({type:'map',site});e.advance(8000);e.diagnostic({...DEFAULT_MANEUVER,maneuver:'entrain',cycle:390,beats:20});e.advance(23000);const r=e.diagnosticState().report!;assert.equal(r.status,'Circuit acceleration established');return parseInt(r.values.find(v=>v.label==='Local PPI − baseline local cycle')!.value);};assert.equal(measure(1),0);assert.equal(measure(6),170);
});
test('wrong-site and no-contact lesions preserve rhythm; circuit lesions prevent reinduction',()=>{
 for(const id of ['la-macroreentry','rvot-vt','fascicular-vt','scar-vt']){const e=new Engine(id);e.advance(6000);e.diagnostic({type:'map',site:6});e.diagnostic({type:'lesion',duration:10,contact:1});e.advance(8000);assert.ok(e.diagnosticState().tachy);e.diagnostic({type:'map',site:id==='rvot-vt'?0:2});e.diagnostic({type:'lesion',duration:10,contact:0});assert.ok(e.diagnosticState().tachy);e.diagnostic({type:'lesion',duration:10,contact:1});e.advance(10000);assert.equal(e.diagnosticState().tachy,false);e.diagnostic({...DEFAULT_MANEUVER,maneuver:'induce'});e.advance(14000);assert.equal(e.diagnosticState().tachy,false);}
});
test('adenosine-sensitive AT and fascicular drug response coexist with preserved ventricular independence',()=>{
 const at=new Engine('at-sensitive');at.advance(6000);at.intervene({type:'drug',drug:'adenosine'});at.advance(10000);assert.equal(at.diagnosticState().tachy,false);at.intervene({type:'drug',drug:'isoproterenol'});at.advance(16000);assert.ok(at.diagnosticState().tachy);
 const vt=new Engine('fascicular-vt');vt.advance(6000);assert.ok(observations(vt.events).find(x=>x.id==='avDissociation')?.valid);vt.intervene({type:'drug',drug:'verapamil'});vt.advance(10000);assert.equal(vt.diagnosticState().tachy,false);
});
test('all new maneuvers, drug effects and mapping actions replay exactly across time chunks',()=>{
 for(const c of advanced){const a=new Engine(c.id);a.advance(6000);a.pace({site:'HRA',s1:500,beats:3,s2:280,s3:240,output:5,width:1});a.advance(9000);a.diagnostic({...DEFAULT_MANEUVER,maneuver:'vop',cycle:330,beats:5});a.advance(12000);a.stop();a.diagnostic({type:'map',site:1});a.advance(14000);a.diagnostic({type:'collect-map'});a.intervene({type:'drug',drug:'esmolol'});a.advance(16000);
  const b=new Engine(c.id);for(const command of a.commands){while(b.now+37<command.t)b.advance(b.now+37);b.advance(command.t);b.applyCommand(command);}b.advance(a.now);assert.deepEqual(b.events,a.events,c.id);assert.deepEqual(b.diagnosticState(),a.diagnosticState(),c.id);assert.deepEqual(b.snapshot(),a.snapshot());}
});
test('diagnostic commands reject malformed and incompatible histories',()=>{
 for(const value of [{...DEFAULT_MANEUVER,cycle:NaN},{...DEFAULT_MANEUVER,beats:2.5},{type:'map',site:7},{type:'lesion',duration:10,contact:2}])assert.equal(validDiagnostic(value),false);
 assert.equal(validCommand({...DEFAULT_MANEUVER,t:0},'0.3.0'),false);assert.equal(validCommand({t:0,type:'drug',drug:'verapamil'},'0.3.0'),false);assert.ok(validCommand({...DEFAULT_MANEUVER,t:0}));
});
test('every new case renders finite continuous signals including mapping electrograms',()=>{
 for(const c of advanced){const render=(chunk:number)=>{const e=new Engine(c.id),s=new Synthesizer(),out=CHANNELS.map(()=>[] as number[]);for(let t=0;t<1600;t+=chunk){const n=e.events.length;e.advance(t+chunk);s.render(t,t+chunk,e.events.slice(n)).forEach((a,i)=>out[i].push(...a));}return out;};const a=render(50),b=render(100);assert.deepEqual(a,b,c.id);assert.ok(a.flat().every(Number.isFinite));assert.ok(a[CHANNELS.findIndex(c=>c.id==='MAP')].some(x=>x!==0)||c.mechanism==='conduction');}
});
