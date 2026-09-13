import test from 'node:test';import assert from 'node:assert/strict';
import {Synthesizer,FS,CHANNELS,contribution,localActivationPeak} from '../src/engine/signals.ts';
import {Engine} from '../src/engine/Engine.ts';
import type {LabEvent} from '../src/engine/model.ts';
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

const channel=(id:string)=>CHANNELS.findIndex(c=>c.id===id);
const beat=(extra:Partial<LabEvent>={}):LabEvent=>({id:1,t:500,kind:'activation',node:'V',label:'V',...extra});
const pulse=(extra:Partial<LabEvent>={}):LabEvent=>({id:2,t:500,kind:'stimulus',node:'V',label:'S1',pacingSite:'RVA',output:5,pulseWidth:1,captured:true,...extra});
/** Subtract the same filtered background so measurement concerns the event itself. */
function isolated(events:LabEvent[],end=1000,backgroundEvents:LabEvent[]=[]){
 const data=new Synthesizer().render(0,end,events);
 const baseline=new Synthesizer().render(0,end,backgroundEvents);
 return data.map((values,ch)=>Float64Array.from(values,(v,i)=>v-baseline[ch][i]));
}
function dominantDeflection(values:ArrayLike<number>,start:number,end:number){
 let peak=0;for(let t=start;t<end;t+=.5){const v=values[Math.round(t*2)];if(Math.abs(v)>Math.abs(peak))peak=v;}return peak;
}
/** Locate QRS slopes across simultaneous leads; exclude the later T wave. */
function qrsDuration(data:ArrayLike<number>[],onset:number,window:number){
 const slopes:number[]=[];
 for(let d=0;d<window;d+=.5){
  const n=Math.round((onset+d)*2);
  slopes.push(Math.max(...['I','II','V1','V5'].map(id=>Math.abs(data[channel(id)][n+1]-data[channel(id)][n])/.5)));
 }
 const cutoff=Math.max(...slopes)*.05;
 const active=slopes.flatMap((s,i)=>s>cutoff?[i*.5]:[]);
 assert.ok(active.length>0,'a measurable QRS must be present');
 return active.at(-1)!-active[0];
}

test('filtered myocardial-paced QRS is broad and His plus RV capture shortens it',()=>{
 const native=isolated([beat()]);
 const myocardial=isolated([beat({morphology:'paced',pacingSite:'RVA'})]);
 const his=isolated([beat({morphology:'paced',pacingSite:'para-His',captureMode:'his-rv'})]);
 const nativeDuration=qrsDuration(native,500,120),myocardialDuration=qrsDuration(myocardial,500,190),hisDuration=qrsDuration(his,500,140);
 assert.ok(nativeDuration>=80&&nativeDuration<=105,`native ${nativeDuration} ms`);
 assert.ok(myocardialDuration>=145&&myocardialDuration<=175,`RVA ${myocardialDuration} ms`);
 assert.ok(hisDuration>=95&&hisDuration<=125,`His + RV ${hisDuration} ms`);
 assert.ok(myocardialDuration-nativeDuration>50,'pacing must visibly broaden the native QRS');
 assert.ok(myocardialDuration-hisDuration>30,'His capture must change the paced QRS');
 for(const data of [native,myocardial,his]){
  for(const id of ['II','V1'])assert.ok(data[channel(id)].slice(0,1000).every(v=>v===0),'no ventricular signal before activation');
 }
});

test('RV apical pacing has negative V1 and inferior complexes, positive lateral complexes and discordant T waves',()=>{
 const data=isolated([beat({morphology:'paced',pacingSite:'RVA'})]);
 for(const id of ['V1','II','III','aVF'])assert.ok(dominantDeflection(data[channel(id)],500,680)<-.1,id+' QRS should be predominantly negative');
 for(const id of ['I','aVL','V5','V6'])assert.ok(dominantDeflection(data[channel(id)],500,680)>.1,id+' QRS should be predominantly positive');
 assert.ok(Math.abs(dominantDeflection(data[channel('aVR')],500,680))>.01,'derived aVR must retain a visible QRS');
 assert.ok(dominantDeflection(data[channel('V1')],730,870)>0,'V1 T should oppose its QRS');
 assert.ok(dominantDeflection(data[channel('V6')],730,870)<0,'V6 T should oppose its QRS');
});

test('noncapturing pulses retain artifact on every lead, while zero output produces no artifact',()=>{
 for(const pacingSite of ['HRA','RVA','para-His','mapping'] as const){
  const event=pulse({pacingSite,node:pacingSite==='HRA'?'A':pacingSite==='mapping'?undefined:'V'});
  const captured=isolated([event]),failed=isolated([{...event,captured:false}]);
  for(let ch=0;ch<CHANNELS.length;ch++){
   assert.deepEqual(failed[ch],captured[ch],`${pacingSite} ${CHANNELS[ch].id}: artifact must not reveal capture`);
   assert.ok(Math.abs(dominantDeflection(failed[ch],500,525))>.005,`${pacingSite} artifact missing from ${CHANNELS[ch].id}`);
  }
 }
 const zero=isolated([pulse({output:0,captured:false})]);
 for(const values of zero)assert.ok(values.every(v=>v===0),'zero-output command must not synthesize an electrical artifact');
 const hra=isolated([pulse({pacingSite:'HRA',node:'A'})]),rv=isolated([pulse()]);
 assert.ok(Math.abs(dominantDeflection(hra[channel('HRA')],500,525))>Math.abs(dominantDeflection(rv[channel('HRA')],500,525))*2);
 assert.ok(Math.abs(dominantDeflection(rv[channel('RV')],500,525))>Math.abs(dominantDeflection(hra[channel('RV')],500,525))*2);
});

test('2 kHz artifacts retain pulse-width differences below one sample and track output independently of capture',()=>{
 const response=(width:number,output=5)=>isolated([pulse({t:500.2,pulseWidth:width,output,captured:false})]);
 const short=response(.1),lessShort=response(.4),one=response(1),two=response(2),doubleOutput=response(1,10);
 const energy=(data:Float64Array[],ch:number)=>data[ch].slice(1000,1100).reduce((sum,v)=>sum+v*v,0);
 for(const id of ['II','RV','MAP']){
  const ch=channel(id);
  assert.notDeepEqual(short[ch],lessShort[ch],id+' must retain sub-sample pulse width');
  assert.notDeepEqual(one[ch],two[ch],id+' must retain programmed duration');
  assert.ok(energy(lessShort,ch)>energy(short,ch)*1.3,id+' wider sub-sample pulse must carry more artifact energy');
  assert.ok(energy(two,ch)>energy(one,ch)*1.2,id+' 2 ms pulse must differ materially from 1 ms');
  const ratio=energy(doubleOutput,ch)/energy(one,ch);assert.ok(ratio>3.95&&ratio<4.05,id+' doubled output should double voltage');
 }
});

test('paced and conduction-system capture retain all limb-lead voltage identities after filtering',()=>{
 const events=[pulse(),beat({morphology:'paced',pacingSite:'RVA'}),pulse({id:3,t:760,pacingSite:'para-His'}),beat({id:4,t:760,morphology:'paced',pacingSite:'para-His',captureMode:'his-rv'})];
 const data=new Synthesizer().render(0,1200,events);
 for(let n=0;n<data[0].length;n++){
  const i=data[channel('I')][n],ii=data[channel('II')][n];
  for(const [id,expected] of [['III',ii-i],['aVR',-(i+ii)/2],['aVL',i-ii/2],['aVF',ii-i/2]] as const)
   assert.ok(Math.abs(data[channel(id)][n]-expected)<3e-7,`${id} paced sample ${n}`);
 }
});

test('fractional stimuli and half-millisecond frame boundaries preserve a single continuous recording',()=>{
 const events:LabEvent[]=[
  beat({t:0}),pulse({t:99.9,pulseWidth:.1,captured:false}),pulse({id:3,t:400.25,pulseWidth:.4}),
  beat({id:4,t:400.25,morphology:'paced',pacingSite:'RVA'}),pulse({id:5,t:720.4,pulseWidth:2}),
  beat({id:6,t:720.4,morphology:'paced',pacingSite:'RVA'}),beat({id:7,t:1050}),
 ];
 const render=(chunk:number)=>{
  const synth=new Synthesizer(),output:number[][]=CHANNELS.map(()=>[]);let cursor=0;
  for(let start=0;start<1400;start+=chunk){
   const end=Math.min(1400,start+chunk),recent:LabEvent[]=[];
   while(cursor<events.length&&events[cursor].t<=end)recent.push(events[cursor++]);
   synth.render(start,end,recent).forEach((values,ch)=>output[ch].push(...values));
  }
  return output;
 };
 const a=render(12.5),b=render(37.5),c=render(1400);
 for(let ch=0;ch<CHANNELS.length;ch++){
  assert.equal(a[ch].length,2800);assert.ok(a[ch].every(Number.isFinite));
  assert.deepEqual(a[ch],b[ch],CHANNELS[ch].id+' fractional frame continuity');
  assert.deepEqual(a[ch],c[ch],CHANNELS[ch].id+' single-pass continuity including repolarization');
 }
});

test('faster ventricular cycles shorten repolarization without widening the conducted QRS',()=>{
 const final=beat({id:2,t:1200});
 const lastResponse=(rr:number)=>{
  const prior=beat({t:final.t-rr});return isolated([prior,final],1700,[prior]);
 };
 const slow=lastResponse(800),fast=lastResponse(300),ch=channel('II');
 const tPeak=(data:Float64Array[])=>{
  let max=-Infinity,at=0;for(let t=final.t+125;t<final.t+430;t+=.5){const v=data[ch][Math.round(t*2)];if(v>max){max=v;at=t;}}return at;
 };
 assert.ok(tPeak(slow)-tPeak(fast)>30,'the T wave should occur earlier after a faster preceding V–V interval');
 assert.ok(Math.abs(qrsDuration(slow,1200,120)-qrsDuration(fast,1200,120))<1,'rate response must not create ventricular aberrancy');
 for(let t=1200;t<1295;t+=.5)assert.ok(Math.abs(slow[ch][t*2]-fast[ch][t*2])<2e-7,'QRS activation is unchanged by repolarization timing');
});

test('optional local annotations follow delayed catheter electrograms rather than global atrial timestamps',()=>{
 const ch=channel('HISd');
 for(const atrialPattern of [undefined,'distal','focal','flutter'] as const){
  const event=beat({node:'A',atrialPattern}),data=isolated([event]),label=localActivationPeak(ch,event);
  let max=0,displayedPeak=0;
  for(let t=event.t;t<event.t+180;t+=.5){const v=Math.abs(data[ch][Math.round(t*2)]);if(v>max){max=v;displayedPeak=t;}}
  assert.ok(Math.abs(displayedPeak-label)<=8,`${atrialPattern}: template annotation must identify the filtered local deflection`);
  if(atrialPattern==='distal'){
   assert.ok(label-event.t>30,'distal return must not put its His A label at the global A time');
   assert.ok(label-localActivationPeak(channel('CSd'),event)>25,'His A must follow the distal CS A');
  }
 }
 for(const node of ['H','V'] as const){
  const event=beat({node}),label=localActivationPeak(ch,event);
  assert.ok(label>=event.t&&label<event.t+15,`${node}: mark its local electrogram, not another activation`);
 }
});
