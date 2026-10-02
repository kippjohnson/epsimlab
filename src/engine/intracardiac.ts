import type {LabEvent} from './model';

/** Fixed catheter observations of a reduced activation model, in mV and ms.
 * A bipolar EGM is the difference between two delayed local electrode potentials.
 * Direction changes polarity; near-field width and far-field content depend on the
 * recording site. These parameters are illustrative, not fitted patient data.
 */
function electrode(t:number,width:number){
 if(t<=0||t>=12*width)return 0;
 // Compact support avoids introducing a noncausal prepotential at event onset.
 const x=(t-6*width)/width;
 return Math.exp(-.5*x*x)*Math.sin(Math.PI*t/(12*width))**2;
}
const scaleCache=new Map<string,number>();
function bipolar(t:number,amplitude:number,width:number,separation:number,direction=1){
 if(t<=0||t>=12*width+separation)return 0;
 const key=width+':'+separation;
 let scale=scaleCache.get(key);
 if(scale===undefined){
  let peak=0;
  for(let x=0;x<12*width+separation;x+=.05)peak=Math.max(peak,Math.abs(electrode(x,width)-electrode(x-separation,width)));
  scale=1/(2*peak);scaleCache.set(key,scale);
 }
 return direction*amplitude*scale*(electrode(t,width)-electrode(t-separation,width));
}
const csPosition:Record<string,number>={CSp:0,CS89:.25,CS78:.5,CS67:.75,CSm:1,CS45:1.25,CS34:1.5,CS23:1.75,CSd:2};
export function atrialDelays(e:LabEvent):number[]{
 if(e.atrialDelays)return e.atrialDelays;
 switch(e.atrialPattern){
  case 'distal':return [55,40,40,28,14,0];
  case 'concentric':return [35,0,0,8,22,36];
  case 'focal':return [0,25,25,40,54,68];
  case 'flutter':return [0,55,55,95,115,135];
  default:return [0,25,25,35,49,63];
 }
}
const interpolate=(values:number[],position:number)=>{
 const lo=Math.floor(position),hi=Math.ceil(position);
 return values[lo]+(values[hi]-values[lo])*(position-lo);
};
function atrial(t:number,amplitude:number,width:number,separation:number,e:LabEvent,direction:number){
 if(e.atrialPattern!=='fibrillation')return bipolar(t,amplitude,width,separation,direction);
 // Deterministic local fractionation varies with activation and electrode location;
 // stable rhythms retain repeatable morphology rather than beat-to-beat random noise.
 const phase=(e.id*13+Math.round(amplitude*100))%17;
 return bipolar(t,amplitude*.52,1.25,separation,direction)
  +bipolar(t-13-phase,amplitude*.28,1.8,separation,-direction)
  +bipolar(t-39-phase/2,amplitude*.20,1.4,separation,direction);
}
export function intracardiac(id:string,e:LabEvent,t:number):number{
 const d=t-e.t;if(d<0||d>420)return 0;
 if(e.kind==='shock')return 1.2*Math.exp(-d/35)*Math.cos(d*.22);
 if(id==='MAP'){
  if(e.kind!=='local')return 0;
  const amplitude=e.voltage??1;
  if(e.evidence==='purkinje')return bipolar(d,amplitude,.65,1.5)+bipolar(d-24,amplitude*.45,2.2,3);
  if(e.electrogram==='fractionated')return bipolar(d,amplitude,1.5,3)+bipolar(d-21,amplitude*.55,1.8,4,-1)+bipolar(d-48,amplitude*.35,2,4);
  return bipolar(d,amplitude,1.4,3);
 }
 if(e.kind!=='activation')return 0;
 const delays=atrialDelays(e),retro=e.atrialPattern==='concentric'||e.atrialPattern==='distal';
 const paced=e.morphology==='paced'||e.morphology==='escape';
 if(id.startsWith('HRA')){
  const pair=id==='HRA'?0:id==='HRA23'?1:2;
  if(e.node==='A')return atrial(d-delays[0]-(retro?2-pair:pair)*3,2.2-pair*.22,1.3+pair*.12,3.4,e,retro?-1:1);
  if(e.node==='V')return bipolar(d-(paced?38:18),.10,4.2,2.5);
 }
 if(id.startsWith('HIS')){
  const pair=id==='HISd'?0:id==='HIS23'?1:2;
  if(e.node==='A')return atrial(d-delays[1],.55+pair*.32,1.35+pair*.12,2.8,e,retro?-1:1);
  if(e.node==='H')return bipolar(d,.9-pair*.23,.65+pair*.06,1.6,e.from==='V'?-1:1);
  if(e.node==='V')return bipolar(d-(paced?25:0),1.4-pair*.25,2+pair*.15,3.2,paced?-1:1);
 }
 const position=csPosition[id];
 if(position!==undefined){
  if(e.node==='A'){
   const direction=e.atrialPattern==='distal'?-1:1;
   return atrial(d-interpolate(delays.slice(3,6),position),1.7-position*.17,1.7+position*.13,3.8,e,direction);
  }
  // Ventricular far field is broader and smaller than the local atrial EGM.
  if(e.node==='V')return bipolar(d-(paced?45+position*12:12+position*7),.42+position*.03,4.2+position*.25,3,paced?-1:1);
 }
 if(id.startsWith('RV')){
  const pair=id==='RV'?0:id==='RV23'?1:2;
  if(e.node==='V')return bipolar(d+(paced?0:-8)-pair*2,3-pair*.3,1.65+pair*.12,3.5,paced?-1:1);
  if(e.node==='A')return bipolar(d-delays[1]-10,.045,4.5,2,retro?-1:1);
 }
 return 0;
}
