import type {LabEvent} from './model';
export const FS=2000;
export const CHANNELS=[
 {id:'II',label:'II',color:'#d9e8eb',kind:'surface'},
 {id:'V1',label:'V1',color:'#d9e8eb',kind:'surface'},
 {id:'HRA',label:'HRA 1–2',color:'#6bb6ff',kind:'ic'},
 {id:'HISp',label:'His 3–4',color:'#f1c267',kind:'ic'},
 {id:'HISd',label:'His 1–2',color:'#f1c267',kind:'ic'},
 {id:'CSp',label:'CS 9–10',color:'#c291ef',kind:'ic'},
 {id:'CSm',label:'CS 5–6',color:'#b482e4',kind:'ic'},
 {id:'CSd',label:'CS 1–2',color:'#a474d4',kind:'ic'},
 {id:'RV',label:'RV 1–2',color:'#69d7aa',kind:'ic'}
] as const;
function g(t:number,m:number,s:number){return Math.exp(-0.5*((t-m)/s)**2);}
function bipole(t:number,amp:number=1,width:number=2){return amp*(g(t,8,width)-.8*g(t,12,width*1.25));}
/** Causal, phenomenological templates; these are not a volume-conductor forward solution. */
export function contribution(channel:number,e:LabEvent,t:number){
 const d=t-e.t;if(d<0||d>420)return 0;
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
 render(start:number,end:number,events:LabEvent[]){this.history.push(...events.filter(e=>e.kind==='activation'||e.kind==='stimulus'));this.history=this.history.filter(e=>e.t>=start-450);const n=Math.round((end-start)*FS/1000),data=CHANNELS.map(()=>new Float32Array(n));for(let i=0;i<n;i++){const t=start+i*1000/FS;for(let ch=0;ch<CHANNELS.length;ch++){let v=.003*Math.sin(t*.071+ch*3)+.002*Math.sin(t*.137+ch);if(ch<2)v+=.015*Math.sin(t*.0015);for(const e of this.history)v+=contribution(ch,e,t);data[ch][i]=this.filters[ch].lp.process(this.filters[ch].hp.process(v));}}return data;}
}
