import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {Engine} from '../src/engine/Engine.ts';
import {Synthesizer} from '../src/engine/signals.ts';

// Exercise the actual worker's message handler and timer without waiting in real time.
const workerCode=ts.transpileModule(readFileSync(new URL('../src/engine/sim.worker.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function worker(caseId='avnrt-01'){
 let timer=()=>{};const messages:any[]=[];
 const context=vm.createContext({exports:{},onmessage:null,require:(id:string)=>{if(id==='./Engine')return {Engine};if(id==='./signals')return {Synthesizer};throw new Error(id);},postMessage:(m:any)=>messages.push(structuredClone(m)),setInterval:(fn:()=>void,ms:number)=>{assert.equal(ms,50);timer=fn;}});
 vm.runInContext(workerCode,context);
 const send=(data:unknown)=>(context.onmessage as (m:unknown)=>void)({data});
 const frame=()=>messages.filter(m=>m.type==='frame').at(-1);
 send({type:'init',caseId});
 return {messages,send,frame,tick:(count=1)=>{for(let i=0;i<count;i++)timer();},take:()=>messages.splice(0)};
}
test('worker advances the whole study at quarter, half, normal and fast speed without resuming pause',()=>{
 for(const speed of [.25,.5,1,5]){const w=worker();w.send({type:'speed',value:speed});w.tick(20);assert.equal(w.frame().end,6000+1000*speed);w.send({type:'pause',value:true});w.send({type:'speed',value:.25});const end=w.frame().end;w.tick(20);assert.equal(w.frame().end,end);w.send({type:'pause',value:false});w.tick(4);assert.equal(w.frame().end,end+50);}
 const w=worker();w.send({type:'speed',value:.5});for(const value of [0,-1,NaN,Infinity,'0.25',2])w.send({type:'speed',value});w.tick(4);assert.equal(w.frame().end,6100);
 w.send({type:'init',caseId:'scar-vt'});w.tick(4);assert.equal(w.frame().end,6100,'speed remains selected when opening another case');
});
test('slower worker playback preserves exact signals and events through pacing, drug washout, shock and lesions',()=>{
 const run=(speed:number,caseId:string)=>{const w=worker(caseId);w.take();w.send({type:'speed',value:speed});
  const frames:any[]=[];const until=(t:number)=>{while((frames.at(-1)?.end??6000)<t){w.tick();const batch=w.take();assert.ok(!batch.some(m=>m.type==='error'),JSON.stringify(batch.filter(m=>m.type==='error')));frames.push(...batch.filter(m=>m.type==='frame'));}};
  w.send({type:'pace',protocol:{site:'RVA',s1:400,beats:5,s2:280,s3:240,output:5,width:1}});until(6500);
  w.send({type:'therapy',action:{type:'drug',drug:'adenosine'}});until(7000);
  if(caseId==='scar-vt'){w.send({type:'diagnostic',action:{type:'map',site:1}});w.send({type:'diagnostic',action:{type:'lesion',duration:5,contact:.5}});}else w.send({type:'therapy',action:{type:'ablate',target:'slow-pathway',power:30,duration:5,contact:.5}});
  until(13000);w.send({type:'therapy',action:{type:'cardiovert'}});until(15000);
  return {events:frames.flatMap(f=>f.events),signals:Array.from({length:frames[0].data.length},(_,ch)=>frames.flatMap(f=>Array.from(f.data[ch]))),therapy:frames.at(-1).therapy};
 };
 for(const caseId of ['avnrt-01','scar-vt']){const normal=run(1,caseId);for(const speed of [.5,.25])assert.deepEqual(run(speed,caseId),normal,`${caseId} at ${speed}×`);}
});
test('saved study replay uses the selected slow speed and retains command timestamps',()=>{
 const w=worker('scar-vt');const snapshot={caseId:'scar-vt',now:6500,commands:[{t:6000,type:'map',site:1}]};w.send({type:'speed',value:.25});w.send({type:'replay',snapshot});const start=w.frame().end;w.tick(20);assert.equal(w.frame().end,start+250);while(w.frame().end<6500)w.tick();assert.ok(w.messages.some(m=>m.type==='replay-complete'));w.send({type:'snapshot'});assert.deepEqual(w.messages.at(-1).snapshot,snapshot);const end=w.frame().end;w.tick();assert.equal(w.frame().end,end);
});

test('a study saved between normal-speed frames replays to its exact final time at any speed',()=>{
 for(const speed of [.25,.5,1,5]){const w=worker('scar-vt');const snapshot={caseId:'scar-vt',now:6512.5,commands:[{t:6012.5,type:'map',site:1}]};w.send({type:'speed',value:speed});w.send({type:'replay',snapshot});while(!w.messages.some(m=>m.type==='replay-complete'))w.tick();assert.equal(w.frame().end,snapshot.now);w.send({type:'snapshot'});assert.deepEqual(w.messages.at(-1).snapshot,snapshot);}
});
