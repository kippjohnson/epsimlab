import type {LabEvent} from './model';

// Cycle length is attached by the signal renderer, not by the conduction model.
export type SignalEvent = LabEvent & {cycleLength?:number};
const NATIVE_CHEST:Record<string,number[]>={V1:[0,.25,-.80,-.08],V2:[-.03,.40,-.85,.16],V3:[-.03,.70,-.62,.24],V4:[-.03,1.05,-.35,.32],V5:[-.03,1.10,-.16,.30],V6:[-.03,.85,-.06,.24]};

/** A finite, smooth lobe: no activity before onset or after offset. */
function lobe(t:number,start:number,end:number){
 if(t<=start||t>=end)return 0;
 return Math.sin(Math.PI*(t-start)/(end-start))**2;
}

function limb(id:string,i:number,ii:number):number|undefined{
 if(id==='I')return i;
 if(id==='II')return ii;
 if(id==='III')return ii-i;
 if(id==='aVR')return -(i+ii)/2;
 if(id==='aVL')return i-ii/2;
 if(id==='aVF')return ii-i/2;
}

function repolarization(e:SignalEvent,t:number,qrsEnd:number){
 // An authored rate response, not a patient QT prediction or correction formula.
 const rr=Math.max(250,Math.min(1500,e.cycleLength??800));
 const qt=Math.max(qrsEnd+100,Math.min(420,360*Math.cbrt(rr/800)));
 return lobe(t,qrsEnd+35,qt);
}

/** Normal conduction: approximately 90 ms QRS, onset at the V event. */
export function nativeVentricular(id:string,e:SignalEvent,t:number){
 const q=lobe(t,0,22),r=lobe(t,10,56),s=lobe(t,38,90),tw=repolarization(e,t,90);
 const shape=(qr:number,rr:number,sr:number,tr:number)=>qr*q+rr*r+sr*s+tr*tw;
 const i=shape(-.06,.65,-.10,.18),ii=shape(-.12,1,-.28,.23);
 const derived=limb(id,i,ii);if(derived!==undefined)return derived;
 const p=NATIVE_CHEST[id];return p?shape(p[0],p[1],p[2],p[3]):0;
}

/** RV myocardial capture: broad LBBB-like pattern with discordant T waves.
 * His + RV capture uses a shorter complex. These are templates, not spatial maps.
 */
export function pacedVentricular(id:string,e:SignalEvent,t:number){
 const conductionCapture=e.captureMode==='his-rv';
 const duration=conductionCapture?110:160;
 const u=t*160/duration;
 const broad=.65*lobe(u,0,94)+.75*lobe(u,60,160);
 const negative=.95*lobe(u,2,156)-.08*lobe(u,4,25);
 const tw=repolarization(e,t,duration);
 const base=e.pacingSite==='RV-base'||e.pacingSite==='para-His';
 const i=(conductionCapture?.65:.75)*broad-.22*tw;
 const ii=(conductionCapture?.85:base?.55:-.90)*broad+(conductionCapture||base?-.20:.24)*tw;
 const derived=limb(id,i,ii);if(derived!==undefined)return derived;
 const lead=Number(id.slice(1));
 if(lead<=3){const amp=[1,.85,.55][lead-1];return -amp*negative+.25*amp*tw;}
 const amp=[.45,.90,.85][lead-4];return amp*broad-.25*amp*tw;
}
