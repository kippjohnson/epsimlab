import {analyzeManeuver} from './diagnosticAnalysis.ts';
import {CASES,validCommand,type Command,type LabEvent,type Protocol,type NodeId} from './model.ts';
import {DEFAULT_MANEUVER,EMPTY_DIAGNOSTIC,mapNames,validDiagnostic,type DiagnosticAction,type DiagnosticState,type MapPoint} from './curriculum.ts';
import {DRUGS,EMPTY_THERAPY,validTherapy,type TherapyAction,type TherapyState,type DrugId} from './therapy.ts';
type Q={t:number;seq:number;kind:'node'|'sinus'|'focus'|'stim'|'drug-end'|'shock'|'timeout'|'local';node?:string;from?:string;cause?:number;origin?:string;label?:string;generation?:number;cycle?:number;output?:number;capture?:string;site?:number;drug?:DrugId;location?:'apex'|'base'};
/** Reduced excitable network: recovery and competing wavefront arrival determine capture/resetting.
 * Mapping uses seven fixed network locations; it is not a patient-specific anatomical solver. */
export class DiagnosticEngine {
 now=0;events:LabEvent[]=[];commands:Command[]=[];readonly definition:typeof CASES[number];
 private queue:Q[]=[];private seq=0;private id=0;private last:Record<string,number>={};private generation=0;private tachy=true;private drugs:Partial<Record<DrugId,number>>={};private shock=false;private lastConversion:number|null=null;
 private reports:NonNullable<DiagnosticState['reports']>=[];private selected=0;private points:MapPoint[]=[];private lesions:number[]=Array(7).fill(0);private endpoint:string|null=null;private pendingPVC:Extract<DiagnosticAction,{type:'maneuver'}>|null=null;private pvcToken=0;
 constructor(public caseId:string){this.definition=CASES.find(c=>c.id===caseId)!;const m=this.m;this.tachy=!['conduction','wpw'].includes(m);
  this.add({t:0,kind:'sinus'});
  if(['atypical'].includes(m))this.add({t:0,kind:'node',node:'N',origin:'circuit'});
  if(['septal','pjrt'].includes(m))this.add({t:0,kind:'node',node:'A',origin:'circuit'});
  if(this.ring)this.add({t:0,kind:'node',node:'F0',origin:'circuit'});
  if(['sensitive','rvot'].includes(m))this.add({t:0,kind:'focus'});
 }
 private get m(){return this.definition.mechanism;}
 private get ring(){return ['macro','fascicular','scar'].includes(this.m);}
 private get vt(){return ['rvot','fascicular','scar'].includes(this.m);}
 private get ap(){return ['septal','pjrt','wpw'].includes(this.m);}
 private get target(){return this.m==='atypical'||this.m==='pjrt'?1:this.m==='wpw'?3:this.m==='sensitive'?2:this.m==='macro'?2:this.m==='fascicular'?2:this.m==='scar'?1:0;}
 private get cured(){return this.lesions[this.target]>=1;}
 private active(id:DrugId){return (this.drugs[id]??0)>this.now;}
 private note(label:string,evidence?:string){this.record({t:this.now,kind:'note',label,...(evidence?{evidence}:{})});}
 private record(e:Omit<LabEvent,'id'>){const event={...e,id:++this.id};this.events.push(event);return event.id;}
 private add(e:Omit<Q,'seq'>){const q={...e,seq:this.seq++};let i=this.queue.length;while(i>0&&this.queue[i-1].t>q.t)i--;this.queue.splice(i,0,q);}
 private edge(q:Q,node:string,delay:number,origin=q.origin){this.add({t:q.t+Math.round(delay),kind:'node',node,from:q.node,cause:q.cause,origin});}
 private erp(node:string){if(node==='AP')return this.m==='wpw'?300:this.m==='pjrt'?210:190;if(node==='P')return this.m==='conduction'?470:180;if(node==='N')return 170+((this.active('esmolol')||this.active('verapamil'))?180:0)-(this.active('isoproterenol')?30:0);return node==='V'?190:node==='H'?180:node==='A'?150:170;}
 private nodal(base:number,di:number){return Math.round((base+Math.max(0,400-di)*.15)*((this.active('esmolol')||this.active('verapamil'))?1.5:1)*(this.active('isoproterenol')?.8:1));}
 advance(to:number){if(!Number.isFinite(to)||to<this.now)throw new Error('Simulation time must advance monotonically.');let work=0;while(this.queue.length&&this.queue[0].t<=to){if(++work>1000000)throw new Error('Network event limit exceeded.');const q=this.queue.shift()!;this.now=q.t;this.deliver(q);}this.now=to;}
 private deliver(q:Q){
  if(q.kind==='sinus'){this.add({t:q.t+(this.active('isoproterenol')?550:800),kind:'sinus'});if(!this.tachy||this.vt)this.node({...q,kind:'node',node:'A',origin:'sinus'});return;}
  if(q.kind==='focus'){this.add({t:q.t+(this.active('isoproterenol')?340:420),kind:'focus'});if(this.tachy&&!this.cured){if(this.m==='rvot')this.node({...q,kind:'node',node:'F0',origin:'focus'});else this.node({...q,kind:'node',node:'A',origin:'focus'});}return;}
  if(q.kind==='drug-end'){this.note(DRUGS[q.drug!].name+' · effect ended');return;}
  if(q.kind==='shock'){this.convert('Synchronized cardioversion');this.record({t:q.t,kind:'shock',label:'Synchronized shock · modeled R peak'});return;}
  if(q.kind==='timeout'){if(q.label==='idle'){if(this.tachy&&this.last[this.vt?'V':'A']===q.cause){this.tachy=false;this.note('Sustained activation ceased · reassess the substrate.');}return;}if(q.label==='PVC'&&q.generation===this.pvcToken&&this.pendingPVC){this.pendingPVC=null;this.note('PVC cancelled: no antegrade His event within 3 s.');}else if(q.label==='shock'&&this.shock){this.shock=false;this.note('Cardioversion cancelled: no ventricular trigger.');}return;}
  if(q.kind==='stim'){
   if(q.generation!==this.generation)return;
   const node=q.node!,threshold=node==='A'?.9:1.2,captured=(q.output??5)>=threshold&&q.t-(this.last[node]??-1e9)>=this.erp(node);
   const cause=this.record({t:q.t,kind:'stimulus',node:node==='A'?'A':node==='V'?'V':undefined,label:q.label??'S1',captured,site:q.site,origin:q.origin});
   if(!captured){this.note((q.output??5)<threshold?'No capture · output below threshold':'No capture · tissue refractory');return;}
   if(q.label==='His-timed PVC'){const refractory=q.t-(this.last.H??-1e9)<this.erp('H');this.note(`PVC captured · ${Math.round(q.t-(this.last.H??q.t))} ms after H · His ${refractory?'refractory':'recovered'}`,refractory?'hisPVC':undefined);}
   if(node==='A'&&['S2','S3'].includes(q.label??'')&&this.m==='wpw'&&!this.cured&&q.t+35-(this.last.AP??-1e9)<this.erp('AP')){this.tachy=true;this.note('Premature atrial capture encounters antegrade pathway refractoriness.');}
   this.node({...q,kind:'node',cause,origin:'paced'});
   if(q.capture==='his-rv')this.node({...q,kind:'node',node:'H',from:'V',cause,origin:'paced'});
   if(q.capture==='atrial'){this.node({...q,kind:'node',node:'A',cause,origin:'paced'});this.note('Direct atrial capture: do not interpret this as a valid para-Hisian comparison.');}
   return;
  }
  if(q.kind==='local'){if(q.site===this.selected)this.local(q,q.node!);return;}
  this.node(q);
 }
 private node(q:Q){
  const node=q.node!,di=q.t-(this.last[node]??-1e9);
  if(node==='N'&&this.active('adenosine')||node==='AP'&&this.cured||node==='N'&&this.m==='atypical'&&this.cured&&q.origin!=='sinus'||node.startsWith('F')&&this.ring&&(this.lesions[Number(node.slice(1))]??0)>=1){this.record({t:q.t,kind:'block',node:node==='N'?'U':undefined,label:'Conduction blocked at '+node,cause:q.cause});return;}
  if(di<this.erp(node)){this.record({t:q.t,kind:'block',node:node==='P'?'V':['A','H','V'].includes(node)?node as NodeId:undefined,from:node==='P'?'H':undefined,label:node+' refractory · wavefront blocked',cause:q.cause,...(node==='P'&&this.m==='conduction'?{evidence:'infraHis'}:{})});return;}
  this.last[node]=q.t;
  if(node===(this.vt?'V':'A')&&this.tachy)this.add({t:q.t+2000,kind:'timeout',label:'idle',cause:q.t});
  if(['A','H','V'].includes(node)){
   const morphology=node==='V'?(q.from==='AP'?'preexcited':this.vt&&(this.tachy||q.origin==='paced')?this.m:q.origin==='paced'&&!q.from?'paced':undefined):undefined;
   const evidence=node==='V'&&q.from==='AP'?'preexcitation':undefined;
   const atrialPattern=node==='A'&&q.origin!=='sinus'&&!(q.origin==='paced'&&!q.from)?(this.m==='sensitive'?'focal':this.m==='macro'?'flutter':undefined):undefined;
   q.cause=this.record({t:q.t,kind:'activation',node:node as NodeId,from:['A','H','V'].includes(q.from??'')?q.from as NodeId:undefined,cause:q.cause,label:`${node} ${q.origin??'conducted'} activation`,origin:q.origin,...(morphology?{morphology:morphology as LabEvent['morphology']}:{}) ,...(evidence?{evidence}:{}),...(node==='V'&&q.origin==='paced'&&(!q.from||q.from.startsWith('F'))?{paceSite:q.from?.startsWith('F')?Number(q.from.slice(1)):6}:{}),...(atrialPattern?{atrialPattern}:{}),...(node==='A'&&this.ap&&q.from==='AP'?{atrialDelays:[20,0,0,8,18,28]}:{})});
   if(node==='H'&&q.from!=='V'&&this.pendingPVC){const p=this.pendingPVC;this.pendingPVC=null;this.add({t:q.t+p.coupling,kind:'stim',node:'V',output:p.output,generation:this.generation,label:'His-timed PVC',origin:p.site,location:p.site});}
   if(node==='V'&&this.shock){this.shock=false;this.add({t:q.t+16,kind:'shock'});}
  }
  if(node==='F'+this.selected)this.local(q,node);
  if(!this.ring&&!this.vt&&node==='A'&&!q.from?.startsWith('F')){const delay=this.m==='sensitive'?[30,20,0,65,85,95,110][this.selected]:[0,10,45,30,55,70,85][this.selected];this.add({...q,t:q.t+delay,kind:'local',site:this.selected});}
  if(node.startsWith('F')){
   const i=Number(node.slice(1));
   // In this single-front ring, the antidromic paced front extinguishes the old front.
   if(!this.ring&&!this.vt&&q.origin==='paced')this.edge(q,'A',i*8);
   if(this.ring&&q.origin==='paced'&&(!q.from&&i<6||q.from==='F6'&&i===1))this.queue=this.queue.filter(e=>!(e.kind==='node'&&/^F[0-5]$/.test(e.node??'')));
   if(this.ring&&i===6&&q.from!=='F1'&&this.tachy)this.edge(q,'F1',85);
   if(this.ring&&this.tachy){if(i<6)this.edge(q,'F'+((i+1)%6),this.m==='macro'?60:this.m==='fascicular'?55:70);if(i===1&&q.from!=='F6')this.edge(q,'F6',85);}
   if(this.m==='macro'&&i===0)this.edge(q,'A',0);
   if(this.m==='rvot'&&i===0||['fascicular','scar'].includes(this.m)&&i===2)this.edge(q,'V',this.m==='rvot'?35:this.m==='fascicular'?30:45);
   if(this.vt&&!this.tachy&&i===0&&q.origin==='paced')this.edge(q,'V',35);
   if(this.vt&&i>0&&q.origin==='paced'&&(!this.tachy||!this.ring))this.edge(q,'V',35+i*8);
   if(i===6)return;
   return;
  }
  if(node==='A'){
   if(!(this.m==='atypical'&&this.tachy&&!(q.origin==='paced'&&!q.from))&&!(this.ap&&!this.tachy&&q.from==='AP'))this.edge(q,'N',20);
   if(this.m==='wpw'&&q.from!=='AP'&&!this.cured)this.edge(q,'AP',35);
  }
  if(node==='N'){
   if(this.m==='atypical'&&this.tachy){this.edge(q,'R',255);if(q.from!=='H')this.edge(q,'H',10);this.edge(q,'A',270);}
   else if(q.from==='H')this.edge(q,'A',this.nodal(65,di));
   else this.edge(q,'H',this.nodal(this.m==='conduction'?90:120,di));
  }
  if(node==='R'&&this.tachy)this.edge(q,'N',125);
  if(node==='H'){
   if(q.from==='V'){if(this.m!=='conduction')this.edge(q,'N',45);}
   else if(!(this.vt&&this.tachy))this.edge(q,'P',this.m==='conduction'?85:45);
  }
  if(node==='P')this.edge(q,'V',0);
  if(node==='V'){
   if(this.ap&&!this.cured&&q.from!=='AP')this.edge(q,'AP',q.origin==='paced'&&!q.from?(q.location==='base'?0:5):0);
   if(q.origin==='paced'&&!q.from||!this.tachy)this.edge(q,'H',q.origin==='paced'&&q.capture==='his-rv'?0:q.location==='base'?40:70);
   if(this.vt&&q.origin==='paced'&&!q.from&&this.ring&&this.tachy)this.edge(q,'F0',this.m==='scar'?95:65);
   if(this.vt&&!this.ring&&q.origin!=='local-only'){const offset=this.selected===0?0:this.selected*8;this.add({t:q.t+offset,kind:'node',node:'F'+(this.selected||6),origin:'local-only'});}
  }
  if(node==='AP'){
   if(q.from==='A')this.edge(q,'V',35);
   else this.edge(q,'A',this.m==='pjrt'?this.nodal(280,di):this.m==='wpw'?150:100);
  }
 }
 private local(q:Q,node:string){
  const voltage=this.m==='scar'?[.65,.25,.8,1.1,.9,.08,.7][this.selected]:1.2-this.selected*.08;
  this.record({t:q.t,kind:'local',site:this.selected,node:this.vt?'V':'A',label:mapNames(this.m)[this.selected]+' · local electrogram',voltage,cause:q.cause,evidence:this.m==='fascicular'&&node.startsWith('F')?'purkinje':undefined});
 }
 pace(p:Protocol,record=true){if(!validCommand({type:'pace',t:this.now,protocol:p}))throw new Error('Invalid pacing protocol.');if(record)this.commands.push({t:this.now,type:'pace',protocol:{...p}});this.generation++;let t=this.now+100;
  for(let i=0;i<p.beats;i++)this.add({t:t+i*p.s1,kind:'stim',node:p.site==='HRA'?'A':'V',output:p.output/(.5+.5/p.width),generation:this.generation,label:`S1 · ${i+1}/${p.beats}`});
  t+=(p.beats-1)*p.s1;if(p.s2!==null){t+=p.s2;this.add({t,kind:'stim',node:p.site==='HRA'?'A':'V',output:p.output/(.5+.5/p.width),generation:this.generation,label:'S2'});if(p.s3!=null){t+=p.s3;this.add({t,kind:'stim',node:p.site==='HRA'?'A':'V',output:p.output/(.5+.5/p.width),generation:this.generation,label:'S3'});}}
  this.note(`${p.site} programmed stimulation · ${p.s1} ms`);return t;
 }
 diagnostic(action:DiagnosticAction,record=true){if(!validDiagnostic(action))throw new Error('Invalid diagnostic command.');if(action.type==='maneuver'&&['induce','entrain','pacemap'].includes(action.maneuver)&&this.m==='conduction')throw new Error('Use programmed or incremental atrial pacing in this conduction study.');if(action.type==='maneuver'&&action.maneuver==='parahis'&&this.tachy)throw new Error('Para-Hisian pacing requires sinus rhythm here. Cardiovert first, then compare His+RV and RV-only capture.');if(action.type==='lesion'&&this.m==='conduction')throw new Error('No ablation target in this conduction study.');if(action.type==='maneuver'){const previous=analyzeManeuver(this.events,this.commands,this.now,this.isPacing());if(previous)this.reports=[...this.reports,previous].slice(-8);}if(record)this.commands.push({...action,t:this.now});this.endpoint=null;
  if(action.type==='map'){this.selected=action.site;this.note('Mapping catheter at '+mapNames(this.m)[action.site]);return;}
  if(action.type==='collect-map'){this.collect();return;}
  if(action.type==='lesion'){if(this.m==='conduction')throw new Error('No ablation target in this conduction study.');this.lesions[this.selected]=Math.min(1,this.lesions[this.selected]+action.duration*action.contact/10);this.note(`Teaching lesion · ${mapNames(this.m)[this.selected]} · ${Math.round(this.lesions[this.selected]*100)}%`);if(this.cured||this.ring&&this.selected<6&&this.lesions[this.selected]>=1)this.convert('Circuit tissue interrupted by lesion');return;}
  if(action.type==='endpoint'){this.endpoint=this.tachy?'Rhythm continues: endpoint not established.':this.therapyState().drugs.length?'Drug effect active: reassess after washout.':'Rhythm interrupted. Repeat the induction maneuver and observe for recurrence.';this.note(this.endpoint);return;}
  const a=action;
  if(a.maneuver==='induce'){if(this.cured||this.ring&&this.lesions.slice(0,6).some(x=>x>=1)){this.endpoint='Induction challenge: target tissue blocks the authored circuit.';this.note(this.endpoint,'endpoint');return;}this.tachy=true;this.queue=this.queue.filter(q=>q.kind!=='focus'&&!(q.kind==='node'&&q.origin==='circuit'));this.add({t:this.now+100,kind:this.m==='sensitive'||this.m==='rvot'?'focus':'node',node:this.ring?'F0':this.m==='atypical'?'N':'A',origin:'circuit'});this.endpoint='Authored circuit seeded. Observe the rhythm; use programmed stimulation to investigate recovery.';this.note('Induction challenge · '+this.endpoint);return;}
  if(a.maneuver==='parahis'&&this.tachy)throw new Error('Para-Hisian pacing requires sinus rhythm here. Cardiovert first, then compare His+RV and RV-only capture.');
  this.generation++;
  if(a.maneuver==='pvc'){this.pendingPVC=a;this.add({t:this.now+3000,kind:'timeout',label:'PVC',generation:++this.pvcToken});this.note(`PVC armed · H + ${a.coupling} ms`);return;}
  const target=a.maneuver==='aop'||a.maneuver==='incremental'?'A':a.maneuver==='entrain'||a.maneuver==='pacemap'?'F'+this.selected:'V';
  let t=this.now+100;
  for(let i=0;i<a.beats;i++){this.add({t,kind:'stim',node:target,output:a.output,generation:this.generation,label:`${a.maneuver} · ${i+1}/${a.beats}`,capture:a.maneuver==='parahis'?a.capture:undefined,site:this.selected,origin:a.site,location:a.site});t+=a.maneuver==='incremental'?Math.max(220,a.cycle-i*20):a.cycle;}
  this.note(`${a.maneuver} · ${a.cycle} ms · ${a.beats} pulses · ${a.site}${a.maneuver==='parahis'?' · '+a.capture:''}`);
 }
 private collect(){
  const candidates=this.events.filter(e=>e.kind==='local'&&e.site===this.selected&&e.t>this.now-3000).reverse();let local:LabEvent|undefined,reference:LabEvent|undefined;
  for(const candidate of candidates){const ref=this.events.filter(e=>e.kind==='activation'&&e.node===(this.vt?'V':'A')&&Math.abs(e.t-candidate.t)<=220).sort((a,b)=>Math.abs(a.t-candidate.t)-Math.abs(b.t-candidate.t))[0];if(ref){local=candidate;reference=ref;break;}}
  if(!local||!reference){this.note('Wait for a complete local activation and reference beat before collecting.');return;}
  this.points.push({site:this.selected,name:mapNames(this.m)[this.selected],t:this.now,activation:local.t-reference.t,voltage:local.voltage??0,paceMatch:null,ppi:null});this.points=this.points.slice(-50);this.note('Mapping point collected · '+mapNames(this.m)[this.selected],'mapCollected');
 }
 private convert(reason:string){this.tachy=false;this.pendingPVC=null;this.generation++;this.queue=this.queue.filter(q=>!['node','stim','focus'].includes(q.kind));this.lastConversion=this.now;this.note(reason+' · observe, then test inducibility.','conversion');}
 intervene(a:TherapyAction,record=true){if(!validTherapy(a))throw new Error('Invalid treatment.');if(['ablate','stop-ablation','test'].includes(a.type))throw new Error('Use the diagnostic workspace mapping and endpoint tools for this case.');if(a.type==='drug'&&this.active(a.drug))throw new Error('Drug exposure is still active.');if(a.type==='cardiovert'&&this.shock)throw new Error('A synchronized shock is already armed.');if(record)this.commands.push({...a,t:this.now});
  if(a.type==='drug'){this.drugs[a.drug]=this.now+DRUGS[a.drug].duration;this.add({t:this.drugs[a.drug]!,kind:'drug-end',drug:a.drug});this.note(DRUGS[a.drug].name+' · fixed teaching exposure');if(a.drug==='adenosine'&&['sensitive','rvot','atypical','septal','pjrt','wpw'].includes(this.m))this.convert('Adenosine-sensitive rhythm interruption');if(a.drug==='verapamil'&&this.m==='fascicular')this.convert('Verapamil-sensitive fascicular circuit interruption');if(a.drug==='ibutilide'&&this.m==='macro')this.convert('Ibutilide teaching conversion');if(a.drug==='isoproterenol'&&['sensitive','rvot'].includes(this.m)&&!this.cured){this.tachy=true;this.queue=this.queue.filter(q=>q.kind!=='focus');this.add({t:this.now+100,kind:'focus'});}}
  if(a.type==='cardiovert'){this.shock=true;this.add({t:this.now+3000,kind:'timeout',label:'shock'});this.note('Cardioversion armed');}
  if(a.type==='cancel-shock')this.shock=false;
 }
 diagnosticState():DiagnosticState{return {...EMPTY_DIAGNOSTIC,site:this.selected,points:[...this.points],lesions:[...this.lesions],tachy:this.tachy,busy:this.isPacing(),endpoint:this.endpoint,reports:[...this.reports],report:analyzeManeuver(this.events,this.commands,this.now,this.isPacing())};}
 therapyState():TherapyState{return {...EMPTY_THERAPY,drugs:(Object.entries(this.drugs) as [DrugId,number][]).filter(([,until])=>until>this.now).map(([id,until])=>({id,until})),shockPending:this.shock,lastConversion:this.lastConversion};}
 stop(record=true){this.generation++;this.pendingPVC=null;if(record)this.commands.push({t:this.now,type:'stop'});this.note('Stimulator stopped');}
 isPacing(){return Boolean(this.pendingPVC)||this.queue.some(q=>q.kind==='stim'&&q.generation===this.generation);}
 applyCommand(c:Command){if(!validCommand(c))throw new Error('Invalid command.');if(c.type==='pace')return this.pace(c.protocol);if(c.type==='stop')this.stop();else if(validDiagnostic(c))this.diagnostic(c);else this.intervene(c as TherapyAction);return this.now;}
 snapshot(){return {caseId:this.caseId,now:this.now,commands:this.commands};}
 metrics(){const v=this.events.filter(e=>e.kind==='activation'&&e.node==='V').slice(-5);const intervals=v.slice(1).map((e,i)=>e.t-v[i].t);const cl=intervals.length?Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length):800;return {cl,rate:Math.round(60000/cl),regular:intervals.length>=3&&Math.max(...intervals)-Math.min(...intervals)<10};}
}
