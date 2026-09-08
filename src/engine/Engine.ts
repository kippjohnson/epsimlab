import { CASES, type LabEvent, type NodeId, type Protocol, type Command } from './model.ts';
interface Scheduled {t:number; seq:number; type:'arrive'|'sinus'|'pace'|'driver'; node?:NodeId; from?:NodeId; cause?:number; label:string; protocol?:Protocol; generation?:number}
/** Deterministic dual-pathway network. All times in ms; queue ordering is stable. */
export class Engine {
 now=0; events:LabEvent[]=[]; commands:Command[]=[]; private queue:Scheduled[]=[]; private sequence=0; private id=0;
 private last:Record<NodeId,number>={A:-1e9,U:-1e9,L:-1e9,H:-1e9,V:-1e9};
 private refractory:Record<NodeId,number>={A:180,U:180,L:200,H:190,V:210};
 private fastLast=-1e9; private slowLast=-1e9; private generation=0;
 private seed=61723;
 readonly definition:typeof CASES[number];
 constructor(public caseId='avnrt-01') {const definition=CASES.find(c=>c.id===caseId);if(!definition)throw new Error('Unknown study case.');this.definition=definition;
  const m=definition.mechanism;
  if(m==='avnrt')this.schedule({t:0,type:'sinus',label:'Sinus impulse'});
  else if(m==='avrt')this.schedule({t:0,type:'arrive',node:'A',label:'Clinical tachycardia begins'});
  else {this.refractory.U=300;if(m==='af')this.refractory.A=60;this.schedule({t:0,type:'driver',label:'Clinical atrial rhythm'});}
 }
 private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 private schedule(e:Omit<Scheduled,'seq'>){const event={...e,seq:this.sequence++};let lo=0,hi=this.queue.length;while(lo<hi){const m=(lo+hi)>>>1;const x=this.queue[m];if(x.t<event.t||(x.t===event.t&&x.seq<event.seq))lo=m+1;else hi=m;}this.queue.splice(lo,0,event);}
 private record(e:Omit<LabEvent,'id'>){const event={...e,id:++this.id};this.events.push(event);return event.id;}
 private propagate(node:NodeId,from:NodeId,t:number,cause:number,label:string){this.schedule({t,type:'arrive',node,from,cause,label});}
 advance(to:number){if(!Number.isFinite(to)||to<this.now)throw new Error('Simulation time must advance monotonically.');while(this.queue.length&&this.queue[0].t<=to){const e=this.queue.shift()!;this.now=e.t;this.deliver(e);}this.now=to;}
 private deliver(e:Scheduled){
  if(e.type==='driver'){
   const m=this.definition.mechanism;const interval=m==='at'?420:m==='flutter'?240:90+Math.floor(this.random()*121);
   this.schedule({t:e.t+interval,type:'driver',label:e.label});
   this.activate('A',e.t,undefined,undefined,m==='at'?'Focal atrial impulse':m==='flutter'?'Organized atrial circuit activation':'Irregular local atrial activation');return;
  }
  if(e.type==='sinus'){this.schedule({t:e.t+800,type:'sinus',label:'Sinus impulse'});if(e.t-this.last.A>=700)this.activate('A',e.t,undefined,undefined,'Sinus atrial activation');return;}
  if(e.type==='pace'){
   if(e.generation!==this.generation)return;
   const p=e.protocol!;const node=p.site==='HRA'?'A':'V';const threshold=(p.site==='HRA'?0.6:0.8)*(1+0.5/p.width);
   const captured=p.output>=threshold&&e.t-this.last[node]>=this.refractory[node];
   const cause=this.record({t:e.t,kind:'stimulus',node,label:e.label,captured});
   if(captured)this.activate(node,e.t,undefined,cause,`${p.site} paced capture`);
   else this.record({t:e.t,kind:'note',label:p.output<threshold?'No capture · output below threshold':'No capture · tissue refractory',cause});
   return;
  }
  this.activate(e.node!,e.t,e.from,e.cause,e.label);
 }
 private activate(node:NodeId,t:number,from:NodeId|undefined,cause:number|undefined,label:string){
  if(t-this.last[node]<this.refractory[node]){this.record({t,kind:'block',node,from,cause,label:`${node} refractory · wavefront blocked`});return;}
  this.last[node]=t;
  const m=this.definition.mechanism;
  const atrialPattern=node==='A'&&!label.includes('paced')?(m==='avrt'&&from==='V'?'distal':m==='at'?'focal':m==='flutter'?'flutter':m==='af'?'fibrillation':undefined):undefined;
  const atrialDelays=atrialPattern==='fibrillation'?Array.from({length:6},()=>Math.floor(this.random()*65)):undefined;
  const id=this.record({t,kind:'activation',node,from,cause,label,...(atrialPattern?{atrialPattern}:{}),...(atrialDelays?{atrialDelays}:{})});
  if(m!=='avnrt'){
   if(node==='A')this.propagate('U','A',t+20,id,'Atrial input to AV node');
   if(node==='U'){
    if(m==='af')this.refractory.U=300+Math.floor(this.random()*181);
    this.propagate('H','U',t+95,id,'Antegrade AV nodal conduction');
   }
   if(node==='H')this.propagate('V','H',t+45,id,'His–Purkinje ventricular activation');
   if(node==='V'&&m==='avrt')this.propagate('A','V',t+140,id,'Retrograde accessory-pathway conduction');
   return;
  }
  if(node==='A'){if(from!=='U')this.propagate('U','A',t+20,id,'Atrial input to AV node');}
  if(node==='U'){
   if(from!=='A')this.propagate('A','U',t+10,id,'Retrograde atrial activation');
   if(t-this.fastLast>=this.definition.fastERP){this.fastLast=t;this.propagate('L','U',t+85,id,'Antegrade fast-pathway conduction');}
   else this.record({t,kind:'block',node:'U',cause:id,label:'Fast pathway refractory'});
   if(t-this.slowLast>=230){this.slowLast=t;this.propagate('L','U',t+this.definition.slowDelay,id,'Antegrade slow-pathway conduction');}
  }
  if(node==='L'){
   if(from!=='H'&&from!=='V')this.propagate('H','L',t+10,id,'His activation');
   if(t-this.fastLast>=240){this.fastLast=t;this.propagate('U','L',t+60,id,'Retrograde fast-pathway conduction');}
  }
  if(node==='H'){if(from!=='V')this.propagate('V','H',t+45,id,'His–Purkinje ventricular activation');}
  if(node==='V'){this.propagate('L','V',t+90,id,'Retrograde ventricular input');}
 }
 pace(protocol:Protocol,record=true){
  if(!['HRA','RVA'].includes(protocol.site)||!Number.isFinite(protocol.s1)||protocol.s1<220||protocol.s1>1500||!Number.isInteger(protocol.beats)||protocol.beats<1||protocol.beats>30||!Number.isFinite(protocol.output)||protocol.output<0||protocol.output>20||!Number.isFinite(protocol.width)||protocol.width<0.1||protocol.width>2|| (protocol.s2!==null&&(!Number.isFinite(protocol.s2)||protocol.s2<180||protocol.s2>1000)))throw new Error('Invalid pacing protocol.');
  if(record)this.commands.push({t:this.now,type:'pace',protocol:{...protocol}});
  this.generation++;const generation=this.generation;const start=this.now+100;
  for(let i=0;i<protocol.beats;i++)this.schedule({t:start+i*protocol.s1,type:'pace',label:`S1 · ${i+1}/${protocol.beats}`,protocol:{...protocol},generation});
  if(protocol.s2!==null)this.schedule({t:start+(protocol.beats-1)*protocol.s1+protocol.s2,type:'pace',label:'S2',protocol:{...protocol},generation});
  this.record({t:this.now,kind:'note',label:`${protocol.site} · ${protocol.beats} × ${protocol.s1} ms${protocol.s2!==null?' + S2 '+protocol.s2+' ms':''}`});
  return start+(protocol.beats-1)*protocol.s1+(protocol.s2??0);
 }
 stop(record=true){this.generation++;if(record)this.commands.push({t:this.now,type:'stop'});this.record({t:this.now,kind:'note',label:'Stimulator stopped'});}
 metrics(){const ventricular=this.events.filter(e=>e.kind==='activation'&&e.node==='V').slice(-5);const intervals=ventricular.slice(1).map((e,i)=>e.t-ventricular[i].t);const cl=intervals.length?Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length):800;return{cl,rate:Math.round(60000/cl),regular:intervals.length>=3&&Math.max(...intervals)-Math.min(...intervals)<10};}
 snapshot(){return {caseId:this.caseId,now:this.now,commands:this.commands};}
}
