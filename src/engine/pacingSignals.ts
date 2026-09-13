import type {LabEvent} from './model';

/** Old event streams have no pulse metadata; their original preset was 5 mA / 1 ms. */
export const stimulusWidth=(e:LabEvent)=>Math.max(.1,Math.min(2,e.pulseWidth??1));
export const stimulusOutput=(e:LabEvent)=>Math.max(0,Math.min(20,e.output??5));

/** Physical stimulus artifact, independent of whether the tissue captures.
 * A short causal amplifier response retains sub-sample (0.1 ms) pulse energy.
 * The unfiltered square command is drawn separately on the STIM timing row.
 */
export function pacingArtifact(id:string,surface:boolean,e:LabEvent,t:number){
 const d=t-e.t,output=stimulusOutput(e),width=stimulusWidth(e);
 if(d<=0||d>width+8||output===0)return 0;
 const response=d<width?1-Math.exp(-d/.15):(1-Math.exp(-width/.15))*Math.exp(-(d-width)/.65);
 const strength=output/5;
 const atrial=e.pacingSite==='HRA'||e.node==='A';
 let amplitude:number;
 if(surface){
  // Derive the limb artifacts from I and II to preserve their voltage identities.
  const i=atrial?.35:-.45,ii=atrial?.65:.75;
  const limb:Record<string,number>={I:i,II:ii,III:ii-i,aVR:-(i+ii)/2,aVL:i-ii/2,aVF:ii-i/2};
  amplitude=limb[id]??([.8,-.7,.65,-.6,.55,-.5][Number(id.slice(1))-1]??.5);
 }else{
  const near=atrial?id.startsWith('HRA'):e.pacingSite==='mapping'?id==='MAP':e.pacingSite==='para-His'?id.startsWith('HIS'):id.startsWith('RV');
  amplitude=near?2.5:id.startsWith('CS')?-.70:id.startsWith('HIS')?.85:.55;
 }
 return amplitude*strength*response;
}
