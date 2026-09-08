import type {LabEvent} from './model';
export const FS=2000;
export const CHANNELS=[
 // Preserve the original indices for recordings and existing signal consumers.
 {id:'II',label:'II',color:'#d9e8eb',kind:'surface'},
 {id:'V1',label:'V1',color:'#d9e8eb',kind:'surface'},
 {id:'HRA',label:'HRA 1–2',color:'#6bb6ff',kind:'ic'},
 {id:'HISp',label:'His 3–4',color:'#f1c267',kind:'ic'},
 {id:'HISd',label:'His 1–2',color:'#f1c267',kind:'ic'},
 {id:'CSp',label:'CS 9–10',color:'#c291ef',kind:'ic'},
 {id:'CSm',label:'CS 5–6',color:'#b482e4',kind:'ic'},
 {id:'CSd',label:'CS 1–2',color:'#a474d4',kind:'ic'},
 {id:'RV',label:'RV 1–2',color:'#69d7aa',kind:'ic'},
 ...['I','III','aVR','aVL','aVF','V2','V3','V4','V5','V6'].map(id=>({id,label:id,color:'#d9e8eb',kind:'surface' as const})),
 {id:'HRA23',label:'HRA 2–3',color:'#6bb6ff',kind:'ic'},
 {id:'HRA34',label:'HRA 3–4',color:'#6bb6ff',kind:'ic'},
 {id:'HIS23',label:'His 2–3',color:'#f1c267',kind:'ic'},
 ...[8,7,6,4,3,2].map(low=>({id:'CS'+low+(low+1),label:`CS ${low}–${low+1}`,color:'#b482e4',kind:'ic' as const})),
 {id:'RV23',label:'RV 2–3',color:'#69d7aa',kind:'ic'},
 {id:'RV34',label:'RV 3–4',color:'#69d7aa',kind:'ic'}
] as const;
export const SURFACE_IDS=['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];
export const CATHETER_GROUPS=[
 {name:'High right atrium',ids:['HRA34','HRA23','HRA']},
 {name:'His bundle',ids:['HISp','HIS23','HISd']},
 {name:'Coronary sinus',ids:['CSp','CS89','CS78','CS67','CSm','CS45','CS34','CS23','CSd']},
 {name:'Right ventricle',ids:['RV34','RV23','RV']},
];
export const DISPLAY_IDS=[...SURFACE_IDS,...CATHETER_GROUPS.flatMap(g=>g.ids)];
export const DEFAULT_TRACE_IDS=['II','V1','HRA','HISp','HISd','CSp','CS78','CSm','CS34','CSd','RV'];
export const displayChannels=(ids:readonly string[])=>DISPLAY_IDS.filter(id=>ids.includes(id)).map(id=>CHANNELS.findIndex(c=>c.id===id));

function g(t:number,m:number,s:number){return Math.exp(-0.5*((t-m)/s)**2);}
function bipole(t:number,amp:number=1,width:number=2){return amp*(g(t,8,width)-.8*g(t,12,width*1.25));}
/** Causal, phenomenological templates; these are not a volume-conductor forward solution. */
function legacyContribution(channel:number,e:LabEvent,t:number){
 const d=t-e.t;if(d<0||d>420)return 0;
 if(e.kind==='shock')return d<180?(channel<2?2:1.2)*Math.exp(-d/35)*Math.cos(d*.22):0;
 if(e.kind==='stimulus')return d<4?(channel<2?.13:.7)*Math.exp(-d*1.5):0;
 if(e.kind!=='activation')return 0;
 if(channel<2){if(e.node==='A'){
  if(e.atrialPattern==='flutter')return d<240?(channel===0?-.2:.14)*(d<190?d/190:(240-d)/50):0;
  if(e.atrialPattern==='fibrillation')return .045*Math.sin(d*.12+e.id)*(g(d,65,40)+.4*g(d,135,25));
  return (e.atrialPattern==='focal'?-.8:1)*(channel===0?.12:-.09)*g(d,40,15);
 }if(e.node==='V')return channel===0?-.14*g(d,7,2)+.95*g(d,16,3)-.27*g(d,25,4)+.23*g(d,230,40):.28*g(d,10,3)-.7*g(d,23,5)-.1*g(d,210,36);return 0;}
 const delays=e.atrialPattern==='distal'?[55,40,40,28,14,0]:e.atrialPattern==='focal'?[0,25,25,40,54,68]:e.atrialPattern==='flutter'?[0,55,55,95,115,135]:e.atrialDelays??[0,10,10,0,14,28];
 const atrial=(amp:number,width=2)=>{const dt=d-(delays[channel-2]??0);return e.atrialPattern==='fibrillation'?bipole(dt,amp*.35,1.4)+bipole(dt-17,amp*.22,2)+bipole(dt-39,-amp*.19,1.5):bipole(dt,amp,width);};
 if(channel===2){if(e.node==='A')return atrial(1.4);if(e.node==='V')return bipole(d,.08,6);}
 if(channel===3||channel===4){if(e.node==='A')return atrial(channel===3?.8:.35);if(e.node==='H')return bipole(d,channel===3?.42:.9,1.2);if(e.node==='V')return bipole(d,channel===3?.55:.8,3);}
 if(channel>=5&&channel<=7){if(e.node==='A')return atrial(1.0-(channel-5)*.12,2.5);if(e.node==='V')return bipole(d-(channel-5)*7,.3,5);}
 if(channel===8){if(e.node==='V')return bipole(d,1.5,3);if(e.node==='A')return bipole(d,.035,4);}
 return 0;
}
const CHEST_TEMPLATES:Record<string,number[]>={V2:[.08,.4,-.85,.16],V3:[.1,.7,-.62,.24],V4:[.12,1.05,-.35,.32],V5:[.1,1.1,-.16,.3],V6:[.08,.85,-.06,.24]};
/** Authored lead templates, not a patient-specific 12-lead forward model. */
function surfaceContribution(id:string,e:LabEvent,t:number):number{
 const d=t-e.t;if(d<0||d>420)return 0;
 const ii=legacyContribution(0,e,t);
 if(id==='II')return ii;
 if(id==='V1')return legacyContribution(1,e,t);
 const i=e.kind!=='activation'?ii*.65:e.node==='A'?ii*.65:e.node==='V'?-.06*g(d,7,2)+.62*g(d,16,3)-.08*g(d,25,4)+.18*g(d,230,40):0;
 if(id==='I')return i;
 if(id==='III')return ii-i;
 if(id==='aVR')return -(i+ii)/2;
 if(id==='aVL')return i-ii/2;
 if(id==='aVF')return ii-i/2;
 // Independent chest-lead templates share activation timing and show R-wave progression.
 const [p,r,s,tw]=CHEST_TEMPLATES[id];
 if(e.kind!=='activation')return ii;
 if(e.node==='A')return ii*p/.12;
 if(e.node==='V')return -.035*g(d,6,2)+r*g(d,16,3)+s*g(d,25,4)+tw*g(d,230,40);
 return 0;
}
const csPosition:Record<string,number>={CSp:0,CS89:.25,CS78:.5,CS67:.75,CSm:1,CS45:1.25,CS34:1.5,CS23:1.75,CSd:2};
export function contribution(channel:number,e:LabEvent,t:number):number{
 const c=CHANNELS[channel];if(!c)return 0;
 if(c.kind==='surface')return surfaceContribution(c.id,e,t);
 if(channel<9)return legacyContribution(channel,e,t);
 const d=t-e.t;if(d<0||d>420)return 0;
 if(e.kind==='stimulus'||e.kind==='shock')return legacyContribution(8,e,t);
 if(e.kind!=='activation')return 0;
 if(c.id==='HIS23')return (legacyContribution(3,e,t)+legacyContribution(4,e,t))/2;
 if(c.id.startsWith('HRA')){
  const offset=c.id==='HRA23'?3:6;
  return e.node==='A'?legacyContribution(2,e,t-offset)*(c.id==='HRA23'?.9:.8):legacyContribution(2,e,t);
 }
 if(c.id.startsWith('RV')){
  const offset=c.id==='RV23'?2:4;
  return e.node==='V'?legacyContribution(8,e,t-offset)*(c.id==='RV23'?.9:.8):legacyContribution(8,e,t);
 }
 const position=csPosition[c.id];
 if(position!==undefined){
  const delays=e.atrialPattern==='distal'?[28,14,0]:e.atrialPattern==='focal'?[40,54,68]:e.atrialPattern==='flutter'?[95,115,135]:e.atrialDelays?.slice(3,6)??[0,14,28];
  const lo=Math.floor(position),hi=Math.ceil(position),delay=delays[lo]+(delays[hi]-delays[lo])*(position-lo),dt=d-delay,amp=1-position*.12;
  if(e.node==='A')return e.atrialPattern==='fibrillation'?bipole(dt,amp*.35,1.4)+bipole(dt-17,amp*.22,2)+bipole(dt-39,-amp*.19,1.5):bipole(dt,amp,2.5);
  if(e.node==='V')return bipole(d-position*7,.3,5);
 }
 return 0;
}
function background(channel:number,t:number):number{
 const noise=(ch:number)=>.003*Math.sin(t*.071+ch*3)+.002*Math.sin(t*.137+ch);
 const c=CHANNELS[channel];if(c.kind==='ic')return noise(channel);
 const ii=noise(0)+.015*Math.sin(t*.0015),i=noise(9)+.01*Math.sin(t*.0015);
 if(c.id==='II')return ii;
 if(c.id==='I')return i;
 if(c.id==='III')return ii-i;
 if(c.id==='aVR')return -(i+ii)/2;
 if(c.id==='aVL')return i-ii/2;
 if(c.id==='aVF')return ii-i/2;
 return noise(channel)+.015*Math.sin(t*.0015);
}
/** RBJ biquad, causal and stateful. Filter changes use a short settling period. */
class Biquad {
 b0:number;b1:number;b2:number;a1:number;a2:number;z1=0;z2=0;
 constructor(type:'high'|'low',frequency:number){const w=2*Math.PI*frequency/FS,c=Math.cos(w),s=Math.sin(w),alpha=s/(2*Math.SQRT1_2),a0=1+alpha;this.b0=(type==='low'?(1-c)/2:(1+c)/2)/a0;this.b1=(type==='low'?1-c:-(1+c))/a0;this.b2=this.b0;this.a1=-2*c/a0;this.a2=(1-alpha)/a0;}
 process(x:number){const y=this.b0*x+this.z1;this.z1=this.b1*x-this.a1*y+this.z2;this.z2=this.b2*x-this.a2*y;return y;}
}
export class Synthesizer {
 private filters:{hp:Biquad;lp:Biquad}[]=[]; private history:LabEvent[]=[];
 constructor(public band:'standard'|'narrow'='standard'){this.setBand(band);}
 setBand(band:'standard'|'narrow'){this.band=band;this.filters=CHANNELS.map(c=>({hp:new Biquad('high',c.kind==='surface'?.5:band==='standard'?30:100),lp:new Biquad('low',c.kind==='surface'?150:band==='standard'?500:300)}));}
 render(start:number,end:number,events:LabEvent[]){this.history.push(...events.filter(e=>e.kind==='activation'||e.kind==='stimulus'||e.kind==='shock'));this.history=this.history.filter(e=>e.t>=start-450);const n=Math.round((end-start)*FS/1000),data=CHANNELS.map(()=>new Float32Array(n));for(let i=0;i<n;i++){const t=start+i*1000/FS;for(let ch=0;ch<CHANNELS.length;ch++){let v=background(ch,t);for(const e of this.history)v+=contribution(ch,e,t);data[ch][i]=this.filters[ch].lp.process(this.filters[ch].hp.process(v));}}return data;}
}
