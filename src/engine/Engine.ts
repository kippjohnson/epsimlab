import {DiagnosticEngine} from './DiagnosticEngine.ts';
import {EMPTY_DIAGNOSTIC,validDiagnostic,type DiagnosticAction} from './curriculum.ts';
import {DRUGS,TARGETS,CTI_TARGETS,validTherapy,type DrugId,type TargetId,type TherapyAction,type TherapyState} from './therapy.ts';
import { CASES, type LabEvent, type NodeId, type Protocol, type Command, validCommand } from './model.ts';
interface Scheduled {t:number; seq:number; type:'arrive'|'sinus'|'pace'|'driver'|'rf'|'drug-end'|'convert'|'shock-expire'|'escape';drug?:DrugId; node?:NodeId; from?:NodeId; cause?:number; label:string; protocol?:Protocol; generation?:number}
/** Deterministic dual-pathway network. All times in ms; queue ordering is stable. */
class LegacyEngine {
 now=0; events:LabEvent[]=[]; commands:Command[]=[]; private queue:Scheduled[]=[]; private sequence=0; private id=0;
 private last:Record<NodeId,number>={A:-1e9,U:-1e9,L:-1e9,H:-1e9,V:-1e9};
 private refractory:Record<NodeId,number>={A:180,U:180,L:200,H:190,V:210};
 private fastLast=-1e9; private slowLast=-1e9; private generation=0;
 private seed=61723;
 private drugs:Partial<Record<DrugId,number>>={};private lesions:Partial<Record<TargetId,number>>={};
 private rf:TherapyState['rf']=null;private rfGeneration=0;private shockPending=false;private shockGeneration=0;
 private tests:TherapyState['tests']=[];private lastConversion:number|null=null;private sinusStarted=false;private driverSuppressedUntil=0;private avrtRunning=true;private escapeStarted=false;
 private active(drug:DrugId){return (this.drugs[drug]??0)>this.now;}
 private lesioned(target:TargetId){return (this.lesions[target]??0)>=1;}
 private ensureSinus(){if(!this.sinusStarted){this.sinusStarted=true;this.schedule({t:this.now+800,type:'sinus',label:'Sinus impulse'});}}
 private nodalDelay(value:number){return Math.round(value*((this.active('esmolol')||this.active('verapamil'))?1.55:1)*(this.active('isoproterenol')?.8:1));}
 private erp(node:NodeId){return this.refractory[node]+(node==='U'?((this.active('esmolol')||this.active('verapamil'))?240:0)-(this.active('isoproterenol')?40:0):0);}
 therapyState():TherapyState{return {drugs:(Object.entries(this.drugs) as [DrugId,number][]).filter(([,until])=>until>this.now).map(([id,until])=>({id,until})),lesions:{...this.lesions},rf:this.rf?{...this.rf}:null,shockPending:this.shockPending,tests:[...this.tests],avBlock:this.lesioned('his-risk'),lastConversion:this.lastConversion};}

 readonly definition:typeof CASES[number];
 constructor(public caseId='avnrt-01') {const definition=CASES.find(c=>c.id===caseId);if(!definition)throw new Error('Unknown study case.');this.definition=definition;
  const m=definition.mechanism;
  if(m==='avnrt'){this.sinusStarted=true;this.schedule({t:0,type:'sinus',label:'Sinus impulse'});}
  else if(m==='avrt')this.schedule({t:0,type:'arrive',node:'A',label:'Clinical tachycardia begins'});
  else {this.refractory.U=300;if(m==='af')this.refractory.A=60;this.schedule({t:0,type:'driver',label:'Clinical atrial rhythm'});}
 }
 private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 private schedule(e:Omit<Scheduled,'seq'>){const event={...e,seq:this.sequence++};let lo=0,hi=this.queue.length;while(lo<hi){const m=(lo+hi)>>>1;const x=this.queue[m];if(x.t<event.t||(x.t===event.t&&x.seq<event.seq))lo=m+1;else hi=m;}this.queue.splice(lo,0,event);}
 private record(e:Omit<LabEvent,'id'>){const event={...e,id:++this.id};this.events.push(event);return event.id;}
 private propagate(node:NodeId,from:NodeId,t:number,cause:number,label:string){this.schedule({t,type:'arrive',node,from,cause,label});}
 advance(to:number){if(!Number.isFinite(to)||to<this.now)throw new Error('Simulation time must advance monotonically.');while(this.queue.length&&this.queue[0].t<=to){const e=this.queue.shift()!;this.now=e.t;this.deliver(e);}this.now=to;}
 private deliver(e:Scheduled){
  if(e.type==='drug-end'){if(this.drugs[e.drug!]===e.t)this.record({t:e.t,kind:'note',label:DRUGS[e.drug!].name+' · modeled effect ended'});return;}
  if(e.type==='shock-expire'){if(e.generation===this.shockGeneration&&this.shockPending){this.shockPending=false;this.record({t:e.t,kind:'note',label:'Synchronized shock cancelled · no ventricular trigger within 3 s'});}return;}
  if(e.type==='convert'){this.convert(e.label);return;}
  if(e.type==='escape'){this.schedule({t:e.t+1500,type:'escape',label:'Ventricular escape'});if(e.t-this.last.V>=1450)this.activate('V',e.t,undefined,undefined,'Ventricular escape · AV conduction injury');return;}
  if(e.type==='rf'){
   if(!this.rf||e.generation!==this.rfGeneration)return;
   const r=this.rf,previous=this.lesions[r.target]??0;this.lesions[r.target]=Math.min(1,previous+r.power*r.contact/300);
   if(previous<1&&this.lesions[r.target]!>=1-1e-9){this.lesions[r.target]=1;this.record({t:e.t,kind:'note',label:'RF lesion established · '+TARGETS.find(t=>t.id===r.target)!.name});this.applyLesions();}
   if(e.t<r.end)this.schedule({t:e.t+1000,type:'rf',generation:this.rfGeneration,label:'RF energy'});
   else{this.rf=null;this.record({t:e.t,kind:'note',label:'RF delivery finished'});}return;
  }

  if(e.type==='driver'){
   const m=this.definition.mechanism;const interval=m==='at'?420:m==='flutter'?240:90+Math.floor(this.random()*121);
   this.schedule({t:e.t+interval,type:'driver',label:e.label});
   if(e.t<this.driverSuppressedUntil)return;
   this.activate('A',e.t,undefined,undefined,m==='at'?'Focal atrial impulse':m==='flutter'?'Organized atrial circuit activation':'Irregular local atrial activation');return;
  }
  if(e.type==='sinus'){this.schedule({t:e.t+(this.active('isoproterenol')?550:(this.active('esmolol')||this.active('verapamil'))?1000:800),type:'sinus',label:'Sinus impulse'});if(e.t-this.last.A>=(this.active('isoproterenol')?450:700))this.activate('A',e.t,undefined,undefined,'Sinus atrial activation');return;}
  if(e.type==='pace'){
   if(e.generation!==this.generation)return;
   const p=e.protocol!;const node=p.site==='HRA'?'A':'V';const threshold=(p.site==='HRA'?0.6:0.8)*(1+0.5/p.width);
   const captured=p.output>=threshold&&e.t-this.last[node]>=this.erp(node);
   const cause=this.record({t:e.t,kind:'stimulus',node,label:e.label,captured});
   if(captured&&e.label==='S2'&&this.definition.mechanism==='avrt'&&!this.lesioned('left-ap'))this.avrtRunning=true;
   if(captured)this.activate(node,e.t,undefined,cause,`${p.site} paced capture`);
   else this.record({t:e.t,kind:'note',label:p.output<threshold?'No capture · output below threshold':'No capture · tissue refractory',cause});
   return;
  }
  this.activate(e.node!,e.t,e.from,e.cause,e.label);
 }
 private activate(node:NodeId,t:number,from:NodeId|undefined,cause:number|undefined,label:string){
  if(node==='U'&&this.active('adenosine')||node==='H'&&this.lesioned('his-risk')||label.includes('slow-pathway')&&this.lesioned('slow-pathway')||label.includes('accessory-pathway')&&this.lesioned('left-ap')){this.record({t,kind:'block',node,from,cause,label:'Conduction blocked · '+(this.active('adenosine')?'adenosine':'ablated tissue')});return;}
  if(t-this.last[node]<this.erp(node)){this.record({t,kind:'block',node,from,cause,label:`${node} refractory · wavefront blocked`});return;}
  this.last[node]=t;
  const m=this.definition.mechanism;
  const atrialPattern=node==='A'&&!label.includes('paced')&&!label.includes('Sinus')?(m==='avrt'&&from==='V'?'distal':m==='at'?'focal':m==='flutter'?'flutter':m==='af'?'fibrillation':undefined):undefined;
  const atrialDelays=atrialPattern==='fibrillation'?Array.from({length:6},()=>Math.floor(this.random()*65)):undefined;
  const id=this.record({t,kind:'activation',node,from,cause,label,...(atrialPattern?{atrialPattern}:{}),...(atrialDelays?{atrialDelays}:{})});
  if(node==='V'&&this.shockPending){this.shockPending=false;this.schedule({t:t+16,type:'convert',label:'Synchronized cardioversion'});}
  if(m!=='avnrt'){
   if(node==='A'&&!(from==='V'&&!this.avrtRunning))this.propagate('U','A',t+20,id,'Atrial input to AV node');
   if(node==='U'){
    if(m==='af')this.refractory.U=300+Math.floor(this.random()*181);
    this.propagate('H','U',t+this.nodalDelay(95),id,'Antegrade AV nodal conduction');
   }
   if(node==='H')this.propagate('V','H',t+45,id,'His–Purkinje ventricular activation');
   if(node==='V'&&m==='avrt'&&!this.lesioned('left-ap')&&(this.avrtRunning||from!=='H'))this.propagate('A','V',t+140,id,'Retrograde accessory-pathway conduction');
   return;
  }
  if(node==='A'){if(from!=='U')this.propagate('U','A',t+20,id,'Atrial input to AV node');}
  if(node==='U'){
   if(from!=='A')this.propagate('A','U',t+10,id,'Retrograde atrial activation');
   if(t-this.fastLast>=this.definition.fastERP){this.fastLast=t;this.propagate('L','U',t+this.nodalDelay(85),id,'Antegrade fast-pathway conduction');}
   else this.record({t,kind:'block',node:'U',cause:id,label:'Fast pathway refractory'});
   if(!this.lesioned('slow-pathway')&&t-this.slowLast>=(this.active('isoproterenol')?190:230)){this.slowLast=t;this.propagate('L','U',t+this.nodalDelay(this.definition.slowDelay),id,'Antegrade slow-pathway conduction');}
  }
  if(node==='L'){
   if(from!=='H'&&from!=='V')this.propagate('H','L',t+10,id,'His activation');
   if(t-this.fastLast>=240){this.fastLast=t;this.propagate('U','L',t+this.nodalDelay(60),id,'Retrograde fast-pathway conduction');}
  }
  if(node==='H'){if(from!=='V')this.propagate('V','H',t+45,id,'His–Purkinje ventricular activation');}
  if(node==='V'){this.propagate('L','V',t+90,id,'Retrograde ventricular input');}
 }
 pace(protocol:Protocol,record=true){
  if(!['HRA','RVA'].includes(protocol.site)||!Number.isFinite(protocol.s1)||protocol.s1<220||protocol.s1>1500||!Number.isInteger(protocol.beats)||protocol.beats<1||protocol.beats>30||!Number.isFinite(protocol.output)||protocol.output<0||protocol.output>20||!Number.isFinite(protocol.width)||protocol.width<0.1||protocol.width>2|| (protocol.s2!==null&&(!Number.isFinite(protocol.s2)||protocol.s2<180||protocol.s2>1000)))throw new Error('Invalid pacing protocol.');
  if(!validCommand({t:this.now,type:'pace',protocol}))throw new Error('Invalid pacing protocol.');
  if(record)this.commands.push({t:this.now,type:'pace',protocol:{...protocol}});
  this.generation++;const generation=this.generation;const start=this.now+100;
  for(let i=0;i<protocol.beats;i++)this.schedule({t:start+i*protocol.s1,type:'pace',label:`S1 · ${i+1}/${protocol.beats}`,protocol:{...protocol},generation});
  if(protocol.s2!==null)this.schedule({t:start+(protocol.beats-1)*protocol.s1+protocol.s2,type:'pace',label:'S2',protocol:{...protocol},generation});
  if(protocol.s2!==null&&protocol.s3!=null)this.schedule({t:start+(protocol.beats-1)*protocol.s1+protocol.s2+protocol.s3,type:'pace',label:'S3',protocol:{...protocol},generation});
  this.record({t:this.now,kind:'note',label:`${protocol.site} · ${protocol.beats} × ${protocol.s1} ms${protocol.s2!==null?' + S2 '+protocol.s2+' ms':''}`});
  return start+(protocol.beats-1)*protocol.s1+(protocol.s2??0)+(protocol.s3??0);
 }
 stop(record=true){this.generation++;if(record)this.commands.push({t:this.now,type:'stop'});this.record({t:this.now,kind:'note',label:'Stimulator stopped'});}
 private convert(reason:string){
  if(reason==='Synchronized cardioversion')this.record({t:this.now,kind:'shock',label:reason+' · triggered on modeled R peak'});
  this.generation++;this.rf=null;this.rfGeneration++;this.shockPending=false;this.avrtRunning=false;
  this.queue=this.queue.filter(e=>e.type!=='arrive'&&e.type!=='pace');
  for(const node of Object.keys(this.last) as NodeId[])this.last[node]=this.now;
  this.fastLast=this.now;this.slowLast=this.now;
  if(['at','flutter','af'].includes(this.definition.mechanism))this.driverSuppressedUntil=this.definition.mechanism==='at'&&!this.lesioned('atrial-focus')?this.now+5000:Infinity;
  this.lastConversion=this.now;this.ensureSinus();
  this.record({t:this.now,kind:'note',label:reason+' · rhythm interrupted; substrate remains unless ablated'+(this.definition.mechanism==='at'&&!this.lesioned('atrial-focus')?' · automatic AT will recur':'')});
 }
 private applyLesions(){
  this.tests=[];
  if(this.lesioned('his-risk')&&!this.escapeStarted){this.escapeStarted=true;this.schedule({t:this.now+1500,type:'escape',label:'Ventricular escape'});this.record({t:this.now,kind:'note',label:'Complication · persistent AV conduction injury; slow ventricular escape modeled'});}
  if(this.definition.mechanism==='at'&&this.lesioned('atrial-focus')||this.definition.mechanism==='flutter'&&CTI_TARGETS.every(t=>this.lesioned(t))){this.driverSuppressedUntil=Infinity;this.ensureSinus();this.record({t:this.now,kind:'note',label:'Atrial driver interrupted by lesion set · test the endpoint'});}
  if(this.definition.mechanism==='avrt'&&this.lesioned('left-ap')){this.avrtRunning=false;this.ensureSinus();}
 }
 intervene(action:TherapyAction,record=true){
  if(!validTherapy(action))throw new Error('Invalid treatment command.');
  if(action.type==='ablate'&&this.rf)throw new Error('Stop the current RF application before starting another.');
  if(action.type==='drug'&&this.active(action.drug))throw new Error('This modeled drug exposure is still active.');
  if(action.type==='cardiovert'&&this.shockPending)throw new Error('A synchronized shock is already armed.');
  if(action.type==='test'&&action.test.startsWith('cti')&&this.definition.mechanism!=='flutter')throw new Error('CTI testing is available in the flutter case.');
  if(record)this.commands.push({...action,t:this.now});
  if(action.type==='drug'){
   this.drugs[action.drug]=this.now+DRUGS[action.drug].duration;this.ensureSinus();
   if(action.drug==='adenosine'&&this.definition.mechanism==='avrt')this.avrtRunning=false;
   this.schedule({t:this.drugs[action.drug]!,type:'drug-end',drug:action.drug,label:'Drug effect ended'});
   if(action.drug==='ibutilide'&&['flutter','af'].includes(this.definition.mechanism))this.schedule({t:this.now+10000,type:'convert',label:'Ibutilide conversion example'});
   this.record({t:this.now,kind:'note',label:DRUGS[action.drug].name+' administered · fixed teaching exposure'});
  }
  if(action.type==='cardiovert'){this.shockPending=true;this.schedule({t:this.now+3000,type:'shock-expire',generation:++this.shockGeneration,label:'Synchronization timeout'});this.record({t:this.now,kind:'note',label:'Cardioversion armed · awaiting ventricular synchronization'});}
  if(action.type==='cancel-shock'){this.shockPending=false;this.shockGeneration++;this.record({t:this.now,kind:'note',label:'Synchronized cardioversion cancelled'});}
  if(action.type==='ablate'){
   this.rf={target:action.target,power:action.power,contact:action.contact,start:this.now,end:this.now+action.duration*1000};
   this.schedule({t:this.now+1000,type:'rf',generation:++this.rfGeneration,label:'RF energy'});
   this.record({t:this.now,kind:'note',label:`RF started · ${action.target} · ${action.power} W · ${action.duration} s · contact ${Math.round(action.contact*100)}% (model)`});
  }
  if(action.type==='stop-ablation'){this.rf=null;this.rfGeneration++;this.record({t:this.now,kind:'note',label:'RF stopped · delivered tissue effect retained'});}
  if(action.type==='test'){
   if(action.test==='induction')this.pace({site:'HRA',s1:500,beats:8,s2:280,output:5,width:1},false);
   else if(action.test==='va')this.pace({site:'RVA',s1:600,beats:8,s2:null,output:5,width:1},false);
   else{const blocked=CTI_TARGETS.every(t=>this.lesioned(t));const delay=blocked?150:45;
    this.tests.push({direction:action.test,blocked,delay,t:this.now});this.tests=this.tests.slice(-10);
    this.record({t:this.now,kind:'note',label:`CTI ${action.test==='cti-clockwise'?'septal → lateral':'lateral → septal'} probe · ${blocked?'line blocked; activation takes the longer modeled route':'conduction through a gap'} · ${delay} ms`});
   }
   this.record({t:this.now,kind:'note',label:'Endpoint test · '+action.test+(this.therapyState().drugs.length?' · drug effects active; reassess after washout':'')});
  }
 }
 applyCommand(command:Command){if(!validCommand(command))throw new Error('Invalid command.');if(command.type==='pace')return this.pace(command.protocol);if(command.type==='stop'){this.stop();return this.now;}if(validDiagnostic(command))throw new Error('Open an advanced case to use this maneuver.');this.intervene(command);return this.now;}
 isPacing(){return this.queue.some(e=>e.type==='pace'&&e.generation===this.generation);}
 metrics(){const ventricular=this.events.filter(e=>e.kind==='activation'&&e.node==='V').slice(-5);if(ventricular.length&&this.now-ventricular.at(-1)!.t>2500)return {cl:0,rate:0,regular:false};const intervals=ventricular.slice(1).map((e,i)=>e.t-ventricular[i].t);const cl=intervals.length?Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length):800;return{cl,rate:Math.round(60000/cl),regular:intervals.length>=3&&Math.max(...intervals)-Math.min(...intervals)<10};}
 snapshot(){return {caseId:this.caseId,now:this.now,commands:this.commands};}
}

/** Route existing cases through their original network to preserve saved-study behavior. */
export class Engine {
 private core:LegacyEngine|DiagnosticEngine;
 constructor(caseId='avnrt-01'){this.core=CASES.find(c=>c.id===caseId)?.advanced?new DiagnosticEngine(caseId):new LegacyEngine(caseId);}
 get now(){return this.core.now;}get events(){return this.core.events;}get commands(){return this.core.commands;}get definition(){return this.core.definition;}get caseId(){return this.core.caseId;}
 advance(t:number){this.core.advance(t);}pace(p:Protocol,record=true){return this.core.pace(p,record);}stop(record=true){this.core.stop(record);}
 intervene(a:TherapyAction,record=true){this.core.intervene(a,record);}applyCommand(c:Command){return this.core.applyCommand(c);}
 isPacing(){return this.core.isPacing();}metrics(){return this.core.metrics();}snapshot(){return this.core.snapshot();}therapyState(){return this.core.therapyState();}
 diagnostic(a:DiagnosticAction){if(this.core instanceof DiagnosticEngine)this.core.diagnostic(a);else if(a.type==='maneuver'&&['vop','aop','incremental'].includes(a.maneuver))this.core.pace({site:a.maneuver==='vop'?'RVA':'HRA',s1:a.cycle,beats:a.beats,s2:null,output:a.output,width:1});else throw new Error('This maneuver requires one of the advanced diagnostic cases.');}
 diagnosticState(){return this.core instanceof DiagnosticEngine?this.core.diagnosticState():{...EMPTY_DIAGNOSTIC,busy:this.core.isPacing()};}
}
