import {CHANNELS,contribution} from './signals.ts';
import type {LabEvent,Command} from './model';
export interface ManeuverReport {title:string;status:string;values:{label:string;value:string}[];interpretation:string;start:number;end:number|null}
const mean=(a:number[])=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
const diffs=(a:LabEvent[])=>a.slice(1).map((e,i)=>e.t-a[i].t);
export function analyzeManeuver(events:LabEvent[],commands:Command[],now:number,busy=false):ManeuverReport|null{
 const command=commands.filter(c=>c.type==='maneuver').at(-1);if(!command||command.type!=='maneuver')return null;
 const start=command.t,range=events.filter(e=>e.t>=start),stim=range.filter(e=>e.kind==='stimulus'&&(e.label.startsWith(command.maneuver)||command.maneuver==='pvc'&&e.label==='His-timed PVC'));
 const prior=events.filter(e=>e.kind==='activation'&&e.node==='V'&&e.t<start).slice(-5),cycles=diffs(prior),tcl=cycles.length>=3&&Math.max(...cycles)-Math.min(...cycles)<10?mean(cycles):null;
 const byId=new Map(events.map(e=>[e.id,e]));
 const descends=(event:LabEvent,id:number)=>{let x:LabEvent|undefined=event;for(let i=0;x&&i<30;i++){if(x.id===id)return true;x=byId.get(x.cause??-1);}return false;};
 const values=[{label:'Captured pulses',value:`${stim.filter(e=>e.captured).length} / ${stim.length}`}];
 const result:ManeuverReport={title:command.maneuver==='pvc'?'His-timed ventricular extrastimulus':command.maneuver.toUpperCase(),start,end:stim.at(-1)?.t??null,status:busy?'Delivering':'Awaiting response',values,interpretation:'Inspect capture and the activation sequence before drawing a conclusion.'};
 if(command.maneuver==='induce'){result.status='Induction challenge';result.interpretation='This control seeds the authored circuit. Programmed stimulation separately tests recovery and capture.';return result;}
 if(busy||!stim.length)return result;
 const last=stim.at(-1)!;if(now<last.t+1500)return result;
 const subsequent=commands.filter(c=>c.t>start&&!['map','collect-map'].includes(c.type));if(subsequent.length){result.status='Confounded';result.interpretation='Another intervention occurred during the observation window. Repeat the maneuver in isolation.';return result;}
 if(stim.slice(-3).some(e=>!e.captured)||stim.length<3&&command.maneuver!=='pvc'){result.status='Incomplete capture';result.interpretation='The final three pulses did not establish a complete captured train. Do not interpret this as a negative diagnostic response.';return result;}
 if(command.maneuver==='pvc'){
  const h=events.filter(e=>e.kind==='activation'&&e.node==='H'&&e.t<=last.t).at(-1);const a=events.filter(e=>e.kind==='activation'&&e.node==='A'&&e.t<last.t).slice(-5),aa=diffs(a),next=events.find(e=>e.kind==='activation'&&e.node==='A'&&e.t>last.t);
  const stable=aa.length>=3&&Math.max(...aa)-Math.min(...aa)<10,expected=stable?a.at(-1)!.t+mean(aa):null;
  if(h)values.push({label:'H → stimulus',value:Math.round(last.t-h.t)+' ms'});
  if(expected!==null&&next)values.push({label:'Next A vs predicted',value:`${Math.round(next.t-expected)} ms (negative = advanced)`});
  const refractory=range.some(e=>e.evidence==='hisPVC');result.status=refractory?'Captured during His refractoriness':'His refractoriness not established';
  result.interpretation=!stable?'Baseline atrial timing was not stable enough to predict the next A.':!refractory?'Interpret the ventricular stimulus timing before assessing pathway participation.':next&&expected!==null&&Math.abs(next.t-expected)>10?'The next atrial activation changed timing. Inspect subsequent cycles for resetting; distinguish pathway participation from a bystander connection.':'No measurable atrial advance was demonstrated. A negative response does not exclude an accessory pathway.';
  return result;
 }
 if(command.maneuver==='parahis'){
  const sa=stim.flatMap(s=>{const a=events.find(e=>e.kind==='activation'&&e.node==='A'&&e.t>=s.t&&e.t<s.t+command.cycle);return a?[a.t-s.t]:[];});
  const hisCapture=stim.filter(s=>events.some(e=>e.kind==='activation'&&e.node==='H'&&e.cause===s.id&&e.t===s.t)).length;values.push({label:'Confirmed direct His captures',value:hisCapture+' / '+stim.length});
  values.push({label:'Capture setting',value:command.capture},{label:'Mean stimulus → A',value:sa.length?Math.round(mean(sa))+' ms':'No atrial return'});
  result.status=command.capture==='atrial'?'Direct atrial capture — invalid comparison':'Compare with other capture setting';result.interpretation='Compare stimulus-to-A time and atrial sequence at the same cycle length after changing His capture. A decremental or distant pathway can be masked by nodal conduction.';return result;
 }
 if(tcl!==null)values.push({label:'Baseline V–V cycle',value:Math.round(tcl)+' ms'});
 if(command.maneuver==='vop'){
  const lastThree=stim.slice(-3),atrial=lastThree.map(s=>{const a=events.find(e=>e.kind==='activation'&&e.node==='A'&&e.t>=s.t&&e.t<s.t+1500&&descends(e,s.id));return a?[a]:[];});
  const sas=atrial.map((a,i)=>a.length===1?a[0].t-lastThree[i].t:NaN);
  const entrained=lastThree.length===3&&sas.every(Number.isFinite)&&Math.max(...sas)-Math.min(...sas)<5&&tcl!==null&&command.cycle<tcl-10;
  result.status=entrained?'Atrial acceleration with stable S–A':'Atrial entrainment not established';
  if(!entrained){result.interpretation='The atrium did not demonstrably follow the last three captured stimuli at a faster, stable cycle. Do not assign a diagnostic postpacing sequence or PPI cutoff.';return result;}
  const nextV=events.find(e=>e.kind==='activation'&&e.node==='V'&&e.t>last.t+5&&!stim.some(s=>s.id===e.cause));
  const linkedA=atrial.at(-1)![0];const post=events.filter(e=>e.kind==='activation'&&['A','V'].includes(e.node??'')&&e.t>=linkedA.t).slice(0,2);
  values.push({label:'Last paced V then activations',value:'V–'+post.map(e=>e.node).join('–')});
  if(nextV&&tcl!==null){const ppi=nextV.t-last.t;values.push({label:'PPI − TCL (RV event reference)',value:Math.round(ppi-tcl)+' ms'});const h=events.filter(e=>e.kind==='activation'&&e.node==='H'&&e.t<start).at(-1),a=events.filter(e=>e.kind==='activation'&&e.node==='A'&&h&&e.t<h.t).at(-1),returnH=events.find(e=>e.kind==='activation'&&e.node==='H'&&e.t>linkedA.t&&e.t<nextV.t);if(h&&a&&returnH){const change=returnH.t-linkedA.t-(h.t-a.t);values.push({label:'Return AH − baseline AH',value:Math.round(change)+' ms'},{label:'AH-corrected PPI − TCL',value:Math.round(ppi-tcl-Math.max(0,change))+' ms'});}}
  values.push({label:'Stimulus → A',value:Math.round(mean(sas))+' ms'});const baselineVA=prior.flatMap(v=>{const a=events.find(e=>e.kind==='activation'&&e.node==='A'&&e.t>=v.t&&e.t<start);return a?[a.t-v.t]:[];});if(baselineVA.length)values.push({label:'S–A minus baseline V–A',value:Math.round(mean(sas)-mean(baselineVA))+' ms'});
  result.interpretation='The atrium followed pacing. Inspect the last entrained A and return sequence. PPI is referenced to the modeled RV activation; AH correction is shown only when an A–H pair brackets the ventricular return. No automatic diagnostic cutoff is applied.';return result;
 }
 if(command.maneuver==='entrain'||command.maneuver==='pacemap'){
  const local=events.filter(e=>e.kind==='local'&&e.site===last.site&&e.t>last.t+5).at(0);
  const priorLocal=events.filter(e=>e.kind==='local'&&e.site===last.site&&e.t<start).slice(-5),lc=diffs(priorLocal),localCL=lc.length>=3&&Math.max(...lc)-Math.min(...lc)<10?mean(lc):null;
  const lastThree=stim.slice(-3),referenceNode=prior.some(e=>e.morphology==='scar'||e.morphology==='fascicular'||e.morphology==='rvot')?'V':'A';
  const following=lastThree.map(s=>events.find(e=>e.kind==='activation'&&e.node===referenceNode&&e.t>=s.t&&e.t<s.t+1500&&descends(e,s.id)));
  const delays=following.map((e,i)=>e?e.t-lastThree[i].t:NaN),entrained=delays.length===3&&delays.every(Number.isFinite)&&Math.max(...delays)-Math.min(...delays)<5&&localCL!==null&&command.cycle<localCL-10;
  if(local&&localCL!==null&&entrained)values.push({label:'Local PPI − baseline local cycle',value:Math.round(local.t-last.t-localCL)+' ms'});
  if(command.maneuver==='pacemap'){const clinical=prior.find(e=>['rvot','scar','fascicular'].includes(e.morphology??'')),paced=events.find(e=>e.kind==='activation'&&e.node==='V'&&e.t>=last.t&&e.t<last.t+500&&descends(e,last.id));if(clinical&&paced){let xy=0,xx=0,yy=0;for(let ch=0;ch<CHANNELS.length;ch++){if(CHANNELS[ch].kind!=='surface')continue;for(let t=0;t<250;t+=5){const a=contribution(ch,clinical,clinical.t+t),b=contribution(ch,paced,paced.t+t);xy+=a*b;xx+=a*a;yy+=b*b;}}if(xx&&yy)values.push({label:'Surface template similarity',value:(100*xy/Math.sqrt(xx*yy)).toFixed(1)+'%'});}}
  result.status=command.maneuver==='pacemap'?'Compare paced and clinical morphology':entrained?'Circuit acceleration established':'Circuit entrainment not established';result.interpretation='Local PPI is shown only when the final captured pulses causally accelerate the reference chamber at a stable interval. Surface similarity compares the authored waveform templates; it is not a clinical pace-map score or proof of an isthmus.';return result;
 }
 result.status='Recording ready';result.interpretation=command.maneuver==='incremental'?'Each pulse is 20 ms earlier than the preceding cycle, down to 220 ms. Locate the first blocked impulse using A, H and V.':'Compare atrial and ventricular timing during and after captured pacing.';return result;
}
