import {validTherapy,type TherapyAction} from './therapy.ts';
/** Shared domain contracts. Spatial identities remain stable as procedure modules grow. */
export type NodeId = 'A' | 'U' | 'L' | 'H' | 'V';
export type Site = 'HRA' | 'RVA';
export type EventKind = 'activation' | 'stimulus' | 'block' | 'note' | 'shock';
export interface LabEvent { id:number; t:number; kind:EventKind; node?:NodeId; from?:NodeId; cause?:number; label:string; captured?:boolean; atrialPattern?:'distal'|'focal'|'flutter'|'fibrillation'; atrialDelays?:number[] }
export interface Protocol { site:Site; s1:number; beats:number; s2:number|null; output:number; width:number }
export type Command = {t:number; type:'pace'; protocol:Protocol}|{t:number;type:'stop'}|({t:number}&TherapyAction);
export interface TissueRegion { id:string; label:string; position:[number,number,number]; excitability:number; conductionScale:number; lesionIds:string[] }
export interface Electrode { id:string; regionId:string; position:[number,number,number]; contact:number; thresholdMA:number }
export interface Lesion { id:string; regionId:string; modality:'RF'|'cryo'|'PFA'; createdAt:number; reversible:boolean; extentMM:number }
export interface ImplantedLead { id:string; electrode:Electrode; fixation:'unfixed'|'fixed'; sensingMV:number; impedanceOhm:number }
export const ENGINE_VERSION='0.3.0';
export type MechanismId='avnrt'|'avrt'|'at'|'flutter'|'af';
export interface CaseDefinition {id:string;title:string;subtitle:string;description:string;difficulty:string;mechanism:MechanismId;fastERP:number;slowDelay:number;legacy?:boolean}
export const CASES:CaseDefinition[] = [
 {id:'avnrt-01',title:'The narrow-complex mystery',subtitle:'Induce and investigate',description:'A 34-year-old has abrupt episodes of palpitations. The study begins in sinus rhythm. Use the atrial induction protocol, then compare atrial and ventricular timing.',difficulty:'Foundation',mechanism:'avnrt',fastERP:340,slowDelay:255},
 {id:'avrt-01',title:'The return route',subtitle:'Follow the activation sequence',description:'A 26-year-old arrives in a regular narrow-complex tachycardia. Compare the His and coronary sinus recordings, then explore how ventricular pacing affects atrial timing.',difficulty:'Intermediate',mechanism:'avrt',fastERP:340,slowDelay:255},
 {id:'at-01',title:'An atrial rhythm of its own',subtitle:'Find what drives the rhythm',description:'A 57-year-old has persistent regular palpitations. The clinical rhythm is already running. Measure the atrial cycle length before, during, and after ventricular pacing.',difficulty:'Intermediate',mechanism:'at',fastERP:340,slowDelay:255},
 {id:'flutter-01',title:'Two atrial beats, one pulse',subtitle:'Count the hidden activity',description:'A 68-year-old presents with a regular pulse of about 125 bpm. Inspect the atrial recordings carefully: the ventricular rate may hide a faster atrial rhythm.',difficulty:'Foundation',mechanism:'flutter',fastERP:340,slowDelay:255},
 {id:'af-01',title:'A rhythm without a metronome',subtitle:'Compare organization and timing',description:'A 73-year-old has an irregular pulse. Compare several consecutive atrial and ventricular intervals, and look for a repeatable atrial activation sequence.',difficulty:'Foundation',mechanism:'af',fastERP:340,slowDelay:255},
 // Retained for exact replay of studies exported before the five-case library.
 {id:'avnrt-02',title:'A different cycle length',subtitle:'Legacy parameter variant',description:'A slower-conduction AVNRT variant retained for saved studies.',difficulty:'Practice',mechanism:'avnrt',fastERP:350,slowDelay:285,legacy:true}
];
export const isCompatibleSession=(version:string,caseId:string)=>CASES.some(c=>c.id===caseId)&&(version===ENGINE_VERSION||version==='0.2.0'||version==='0.1.0'&&['avnrt-01','avnrt-02'].includes(caseId));
export const REGIONS:TissueRegion[]=[{id:'high-ra',label:'High right atrium',position:[-26,26,0],excitability:1,conductionScale:1,lesionIds:[]},{id:'his',label:'His bundle',position:[0,0,0],excitability:1,conductionScale:1,lesionIds:[]},{id:'rv-apex',label:'RV apex',position:[-16,-46,10],excitability:1,conductionScale:1,lesionIds:[]},{id:'cti',label:'Cavotricuspid isthmus',position:[-22,-12,6],excitability:1,conductionScale:1,lesionIds:[]}];

export function validCommand(command:unknown,version=ENGINE_VERSION):command is Command{
 if(!command||typeof command!=='object')return false;const c=command as Command;
 if(!Number.isFinite(c.t)||c.t<0)return false;
 if(c.type==='stop')return true;
 if(c.type!=='pace')return version===ENGINE_VERSION&&validTherapy(c);
 const p=c.protocol;return Boolean(p&&['HRA','RVA'].includes(p.site)&&Number.isFinite(p.s1)&&p.s1>=220&&p.s1<=1500&&Number.isInteger(p.beats)&&p.beats>=1&&p.beats<=30&&Number.isFinite(p.output)&&p.output>=0&&p.output<=20&&Number.isFinite(p.width)&&p.width>=.1&&p.width<=2&&(p.s2===null||Number.isFinite(p.s2)&&p.s2>=180&&p.s2<=1000));
}
