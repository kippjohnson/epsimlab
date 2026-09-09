import test from 'node:test';import assert from 'node:assert/strict';
import {Synthesizer,FS,CHANNELS,contribution} from '../src/engine/signals.ts';
import {Engine} from '../src/engine/Engine.ts';
function samples(band:'standard'|'narrow',chunk:number){const engine=new Engine();const synth=new Synthesizer(band);const data:number[][]=Array.from({length:CHANNELS.length},()=>[]);for(let start=0;start<1600;start+=chunk){const old=engine.events.length;engine.advance(start+chunk);const block=synth.render(start,start+chunk,engine.events.slice(old));block.forEach((x,i)=>data[i].push(...x));}return data;}
test('signal samples are finite, have correct rate, and preserve frame-boundary continuity',()=>{const a=samples('standard',50),b=samples('standard',100);for(let ch=0;ch<CHANNELS.length;ch++){assert.equal(a[ch].length,FS*1.6);assert.ok(a[ch].every(Number.isFinite));assert.deepEqual(a[ch],b[ch]);}});
test('intracardiac filter changes waveforms while surface ECG is unchanged',()=>{const a=samples('standard',50),b=samples('narrow',50);assert.deepEqual(a[0],b[0]);assert.notDeepEqual(a[4],b[4]);const energy=(x:number[])=>x.reduce((s,v)=>s+v*v,0);assert.ok(energy(b[4])<energy(a[4]));});

test('catalog covers all standard ECG leads and every adjacent pair on the four catheters',()=>{
 const labels=CHANNELS.map(c=>c.label);
 assert.equal(new Set(CHANNELS.map(c=>c.id)).size,31);
 assert.deepEqual(CHANNELS.filter(c=>c.kind==='surface').map(c=>c.id).sort(),['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'].sort());
 for(const [catheter,poles] of [['CS',10],['HRA',4],['His',4],['RV',4]] as const)
  for(let low=1;low<poles;low++)assert.ok(labels.includes(`${catheter} ${low}–${low+1}`));
 assert.deepEqual(CHANNELS.slice(0,9).map(c=>c.id),['II','V1','HRA','HISp','HISd','CSp','CSm','CSd','RV']);
});
test('rendered limb leads obey Einthoven and augmented lead relationships, including artifacts',()=>{
 const e=new Engine();e.advance(1200);const s=new Synthesizer();
 const data=s.render(0,1200,[...e.events,{id:999,t:200,kind:'stimulus',label:'S1',captured:true},{id:1000,t:500,kind:'shock',label:'Synchronized shock'}]);
 const lead=(id:string)=>data[CHANNELS.findIndex(c=>c.id===id)];
 for(let n=0;n<data[0].length;n++){
  const i=lead('I')[n],ii=lead('II')[n];
  for(const [id,expected] of [['III',ii-i],['aVR',-(i+ii)/2],['aVL',i-ii/2],['aVF',ii-i/2]] as const)
   assert.ok(Math.abs(lead(id)[n]-expected)<2e-7,`${id} sample ${n}`);
 }
});
test('CS intermediate pairs interpolate activation times in forward and distal-first patterns',()=>{
 const labels=['CS 9–10','CS 8–9','CS 7–8','CS 6–7','CS 5–6','CS 4–5','CS 3–4','CS 2–3','CS 1–2'];
 const peaks=(atrialPattern?:'distal'|'focal'|'flutter')=>labels.map(label=>{
  const ch=CHANNELS.findIndex(c=>c.label===label),event={id:1,t:0,kind:'activation' as const,node:'A' as const,label:'A',atrialPattern};
  let peak=-Infinity,at=0;for(let t=0;t<180;t+=.25){const v=contribution(ch,event,t);if(v>peak){peak=v;at=t;}}
  return at;
 });
 for(const pattern of [undefined,'distal','focal','flutter'] as const){
  const times=peaks(pattern);
  for(let i=1;i<times.length;i++)assert.ok(pattern==='distal'?times[i]<times[i-1]:times[i]>times[i-1],`${pattern}: ${times}`);
 }
});
test('all surface leads ignore the intracardiac filter and each chest lead has distinct morphology',()=>{
 const a=samples('standard',50),b=samples('narrow',50);
 CHANNELS.forEach((c,i)=>{if(c.kind==='surface')assert.deepEqual(a[i],b[i],c.id);});
 for(let lead=2;lead<=6;lead++)assert.notDeepEqual(a[CHANNELS.findIndex(c=>c.id===`V${lead}`)],a[1]);
});
