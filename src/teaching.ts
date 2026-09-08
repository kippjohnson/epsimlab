import type {LabEvent,MechanismId,Protocol} from './engine/model.ts';
export const DIAGNOSES=[
 {id:'avnrt',label:'AV nodal reentrant tachycardia',sub:'Slow–fast AVNRT'},
 {id:'avrt',label:'Orthodromic AV reentrant tachycardia',sub:'Accessory pathway mediated'},
 {id:'at',label:'Focal atrial tachycardia',sub:'An atrial source'},
 {id:'flutter',label:'Typical atrial flutter',sub:'An organized atrial circuit'},
 {id:'af',label:'Atrial fibrillation',sub:'Disorganized atrial activity'},
 {id:'sinus',label:'Sinus tachycardia',sub:'Sinus-node driven rhythm'}
];
export const TEACHING:Record<MechanismId,{name:string;question:string;tasks:string[];explanation:string;limit:string;protocol:Protocol|null;protocolLabel:string;keyEvidence:string[]}>= {
 avnrt:{name:'Slow–fast AVNRT',question:'Can an early atrial beat start a repeating electrical loop?',tasks:['Observe sinus rhythm: atrium → His bundle → ventricle.','Deliver the atrial induction train. Look for a sudden conduction delay and a faster sustained rhythm.','Freeze the response. Compare the AH interval before induction and the VA interval during tachycardia.'],explanation:'The premature atrial beat meets a refractory fast pathway and travels down the slow pathway. The fast pathway recovers and conducts backward, allowing a nodal loop to continue. In this case, atrial activation follows ventricular activation closely.',limit:'An AH jump and short VA support this example but are not definitive diagnostic criteria on their own. This simplified nodal network does not reproduce every pacing response.',protocol:{site:'HRA',s1:500,beats:8,s2:280,output:5,width:1},protocolLabel:'Run atrial induction',keyEvidence:['jump','shortva']},
 avrt:{name:'Orthodromic AVRT',question:'Does a route outside the AV node return the impulse to the atrium?',tasks:['The study opens during tachycardia. Measure consecutive V–V and V–A intervals.','Compare CS 1–2 with CS 9–10: which atrial signal comes first?','Try ventricular pacing and follow the atrial response. A return sequence is a clue; formal proof requires more maneuvers.'],explanation:'An impulse travels forward through the AV node and His–Purkinje system, then returns from ventricle to atrium through a concealed left-sided accessory pathway. The circuit includes A, H and V. Distal CS atrial activity precedes proximal CS activity in this example.',limit:'This is one left-sided pathway example, not all AVRT. A long VA or eccentric sequence alone does not prove pathway participation. His-refractory ventricular stimulation, validated entrainment measurements and pathway localization are not implemented.',protocol:{site:'RVA',s1:270,beats:8,s2:null,output:5,width:1},protocolLabel:'Run ventricular pacing',keyEvidence:['longva','eccentric']},
 at:{name:'Focal atrial tachycardia',question:'Does the atrium keep its own clock when the ventricle is paced?',tasks:['Measure several A–A intervals on HRA before pacing.','Deliver the ventricular pacing train; compare atrial timing while ventricular timing changes.','Look for the same atrial cycle length after pacing. Consider whether the ventricle is necessary for the rhythm.'],explanation:'A simulated atrial focus fires every 420 ms and conducts forward through the AV node. Ventricular pacing changes ventricular timing while the atrial driver continues. That independence supports an atrial-driven mechanism in this case.',limit:'This is a non-resetting focal driver with absent retrograde VA conduction. Real AT may be automatic, triggered or reentrant and can respond differently to pacing. This model does not locate an ablation target.',protocol:{site:'RVA',s1:330,beats:8,s2:null,output:5,width:1},protocolLabel:'Run ventricular pacing',keyEvidence:['regularA','independent']},
 flutter:{name:'Typical atrial flutter',question:'Is the atrium beating faster than the pulse suggests?',tasks:['Measure A–A on HRA and V–V on RV across several cycles.','Count two atrial activations for each ventricular activation; inspect the surface atrial waveform.','Explain why a regular ventricular pulse can conceal a faster atrial rhythm.'],explanation:'An organized atrial driver repeats every 240 ms. AV nodal refractoriness allows alternate impulses through, giving a 480 ms ventricular cycle and a 125 bpm pulse. The intended clinical scenario is typical, cavotricuspid-isthmus-dependent flutter.',limit:'The atrial circuit is represented by a periodic driver and ordered catheter delays, not a spatial CTI circuit. These recordings show an organized atrial tachyarrhythmia with 2:1 conduction; proving typical flutter needs mapping and entrainment, which are not implemented.',protocol:null,protocolLabel:'Pause and measure',keyEvidence:['rapidA','twoToOne']},
 af:{name:'Atrial fibrillation',question:'Can you find a stable atrial cycle or a repeating ventricular pattern?',tasks:['Set Sweep to 25 mm/s and compare at least six consecutive A–A and V–V intervals.','Inspect the changing, fragmented atrial signals across HRA and CS.','Explain the difference between disorganized atrial activity and organized flutter with variable conduction.'],explanation:'Irregular local atrial activations and variable AV nodal recovery produce an irregular ventricular response. Atrial signal timing and morphology vary across recording sites; there is no single stable atrial cycle to follow.',limit:'AF uses a seeded synthetic local-activation model, not a biophysical simulation of multiple wavefronts or pulmonary-vein triggers. Irregular V–V alone does not establish AF. Isolation, cardioversion and AF induction are not modeled.',protocol:null,protocolLabel:'Pause and compare',keyEvidence:['irregularA','irregularV']}
};
const intervals=(events:LabEvent[])=>events.slice(1).map((e,i)=>e.t-events[i].t);
const mean=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
const spread=(xs:number[])=>xs.length?Math.max(...xs)-Math.min(...xs):Infinity;
export function observations(events:LabEvent[]){
 const end=events.at(-1)?.t??0;
 const recent=events.filter(e=>e.kind==='activation'&&e.t>end-6000);
 const a=recent.filter(e=>e.node==='A'),v=recent.filter(e=>e.node==='V');
 const aa=intervals(a),vv=intervals(v);
 const regularA=aa.length>=6&&spread(aa)<10,regularV=vv.length>=6&&spread(vv)<10;
 const va=v.map(e=>{const next=a.find(x=>x.t>=e.t);return next?next.t-e.t:Infinity;}).filter(Number.isFinite);
 const byId=new Map(events.map(e=>[e.id,e]));
 const ah=events.filter(e=>e.kind==='activation'&&e.node==='H').flatMap(h=>{let ancestor=byId.get(h.cause??-1);for(let i=0;ancestor&&i<5;i++){if(ancestor.node==='A')return [h.t-ancestor.t];ancestor=byId.get(ancestor.cause??-1);}return [];});
 // Observe a stable atrial clock during an actual run of captured ventricular stimuli.
 const paced=events.filter(e=>e.kind==='stimulus'&&e.node==='V');
 let independent=false;
 for(let i=5;i<paced.length;i++){
  const train=paced.slice(i-5,i+1);const pp=intervals(train);
  if(spread(pp)>1||mean(pp)>600||train.filter(e=>e.captured).length<3)continue;
  const atria=events.filter(e=>e.kind==='activation'&&e.node==='A'&&e.t>=train[0].t&&e.t<=train[5].t);
  const ai=intervals(atria);
  const prior=events.filter(e=>e.kind==='activation'&&e.node==='A'&&e.t<train[0].t).slice(-4);
  const ventricular=events.filter(e=>e.kind==='activation'&&e.node==='V'&&e.t>=train[0].t&&e.t<=train[5].t);
  if(ai.length>=3&&prior.length===4&&spread(ai)<5&&Math.abs(mean(intervals(prior))-mean(ai))<5&&Math.abs(mean(ai)-mean(pp))>40&&intervals(ventricular).some(t=>Math.abs(t-mean(ai))>40))independent=true;
 }
 const facts=[
  {id:'jump',label:'Marked AH prolongation during the induction sequence',valid:ah.some(t=>t>=250)&&ah.some(t=>t<=130),why:'Compare atrial-to-His conduction before and during induction; this checks the modeled AH change, not a formal decremental AH-jump protocol.'},
  {id:'shortva',label:'A short, consistent VA interval during sustained tachycardia',valid:regularA&&regularV&&mean(vv)<400&&va.length>=6&&va.every(t=>t<70),why:'Look for repeatable atrial activation shortly after each ventricular activation during the fast rhythm.'},
  {id:'longva',label:'A longer, consistent VA interval during sustained tachycardia',valid:regularA&&regularV&&mean(vv)<400&&va.length>=6&&va.every(t=>t>=100&&t<200),why:'Measure V to the next A in tachycardia; a longer VA interval is a clue, not a diagnosis by itself.'},
  {id:'eccentric',label:'Distal CS atrial activity consistently precedes proximal CS',valid:a.filter(e=>e.atrialPattern==='distal').length>=6,why:'Compare the atrial components in CS 1–2 and CS 9–10, not their ventricular far-field signals.'},
  {id:'regularA',label:'A stable atrial cycle with discrete atrial signals',valid:regularA&&a.every(e=>e.atrialPattern!=='fibrillation'),why:'Measure consecutive atrial intervals. An organized atrial clock is shared by several mechanisms; assess its rate and relationship to the ventricle too.'},
  {id:'independent',label:'The atrial clock continues unchanged during captured ventricular pacing',valid:independent,why:'This needs an actual ventricular pacing train with capture and several atrial cycles that march through at their own rate.'},
  {id:'rapidA',label:'Rapid, regular atrial activity at 200–300 ms intervals',valid:regularA&&mean(aa)>=200&&mean(aa)<=300,why:'Follow atrial rather than ventricular deflections and measure several consecutive A–A intervals.'},
  {id:'twoToOne',label:'Two organized atrial cycles for each ventricular cycle',valid:regularA&&regularV&&Math.abs(mean(vv)/mean(aa)-2)<.05,why:'The measured V–V interval should be approximately twice the A–A interval across several cycles.'},
  {id:'irregularA',label:'Variable atrial timing with changing, fragmented local signals',valid:aa.length>=6&&spread(aa)>50&&a.filter(e=>e.atrialPattern==='fibrillation').length>=6,why:'Inspect both interval variability and the changing atrial signals across catheters.'},
  {id:'irregularV',label:'Irregular ventricular intervals without a stable repeating cycle',valid:vv.length>=6&&spread(vv)>80,why:'Compare at least six ventricular intervals outside a pacing train. Irregularity alone is insufficient to diagnose AF.'}
 ];
 return facts;
}
export function assess(mechanism:MechanismId,chosen:string,evidence:string[],events:LabEvent[]){
 const findings=observations(events);const supported=evidence.filter(id=>findings.some(f=>f.id===id&&f.valid));
 const unsupported=evidence.filter(id=>!supported.includes(id));
 const complete=TEACHING[mechanism].keyEvidence.every(id=>supported.includes(id));
 return {findings,supported,unsupported,correct:chosen===mechanism&&complete&&unsupported.length===0};
}
export const GLOSSARY=[
 ['EP study','A test of the heart’s electrical system. Catheters record signals from inside the heart and deliver timed pulses to investigate an abnormal rhythm.'],
 ['A / H / V','A is atrial activation (upper chambers), H is His-bundle activation (the electrical connection below the AV node), and V is ventricular activation (lower chambers). These are electrical events, not contractions.'],
 ['Surface ECG / electrogram','II and V1 show electrical activity from a surface viewpoint. Intracardiac electrograms show local activity near a catheter, often with smaller signals from distant tissue. All rows share one time axis.'],
 ['HRA / His / CS / RV','HRA records the high right atrium; His records near the conduction system; CS samples atrial activation along the coronary sinus; RV records the right ventricle. Catheter numbers identify pairs of electrodes.'],
 ['AH / HV / VA','AH runs from local atrial to His activation; HV from His to ventricular activation; VA from ventricular to the following atrial activation. Always specify the recording site and which deflections you measured.'],
 ['Cycle length / TCL','Time between successive activations. TCL means tachycardia cycle length. A 300 ms cycle corresponds to 60,000 ÷ 300 = 200 beats/minute. Atrial and ventricular cycle lengths can differ.'],
 ['Pacing / capture','Pacing delivers an electrical pulse. Capture means that pulse actually activates nearby tissue. A pacing artifact alone does not prove capture.'],
 ['S1 / S2','S1 is a series of evenly spaced paced beats. S2 is an extra beat delivered at a chosen interval after the final S1. An earlier beat tests how recovered tissue responds.'],
 ['Refractory / block','Recently activated tissue needs time to recover. An impulse arriving too soon may fail to propagate: functional conduction block.'],
 ['Antegrade / retrograde','Antegrade means forward from atrium toward ventricle. Retrograde means backward toward the atrium.'],
 ['Reentry / focus','Reentry is a repeating electrical loop. A focus is a localized source of repeated impulses. A pacing response helps test which structures are needed to sustain a rhythm.'],
 ['Sweep / gain / calipers','Sweep changes how much time fits on screen; gain changes signal height. Calipers measure elapsed time between two points. Neither sweep nor gain changes the heart rate.']
];
export const SOURCES=[
 ['American Heart Association · What an EP study does','https://www.heart.org/en/health-topics/arrhythmia/symptoms-diagnosis--monitoring-of-arrhythmia/electrophysiology-studies'],
 ['Cleveland Clinic · AVNRT','https://my.clevelandclinic.org/health/diseases/22923-avnrt'],
 ['Cleveland Clinic · Atrial tachycardia','https://my.clevelandclinic.org/health/diseases/21800-atrial-tachycardia'],
 ['Cleveland Clinic · Atrial flutter','https://my.clevelandclinic.org/health/diseases/22885-atrial-flutter'],
 ['Heart Rhythm Society · AF consensus overview','https://www.hrsonline.org/resource/2024-ehra-hrs-aphrs-lahrs-expert-consensus-statement-on-catheter-and-surgical-ablation-of-atrial-fibrillation/']
];
