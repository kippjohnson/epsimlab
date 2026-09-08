import {CHANNELS,FS} from './engine/signals';
import type {LabEvent,Command} from './engine/model';
export interface Snapshot {caseId:string;now:number;commands:Command[]}
export interface Session {id:string;title:string;savedAt:string;engineVersion:string;snapshot:Snapshot;measurements:Measurement[]}
export interface Measurement {id:string;start:number;end:number;label:string;channel:string}
export class Recording {
 capacity=FS*180;data=CHANNELS.map(()=>new Float32Array(this.capacity));end=0;events:LabEvent[]=[];revision=0;
 append(start:number,end:number,data:Float32Array[],events:LabEvent[]){const at=Math.round(start*FS/1000);for(let c=0;c<data.length;c++)for(let i=0;i<data[c].length;i++)this.data[c][(at+i)%this.capacity]=data[c][i];this.end=end;this.events.push(...events);this.events=this.events.filter(e=>e.t>this.end-180000);this.revision++;}
 value(ch:number,t:number){if(t<Math.max(0,this.end-180000)||t>=this.end)return 0;return this.data[ch][Math.floor(t*FS/1000)%this.capacity];}
 clear(){this.end=0;this.events=[];this.data.forEach(d=>d.fill(0));this.revision++;}
}
function openDB(owner='guest'):Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(owner==='guest'?'ep-lab':'ep-lab-account-'+owner,1);request.onupgradeneeded=()=>request.result.createObjectStore('sessions',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function saveSession(session:Session,owner='guest'){const db=await openDB(owner);return new Promise<void>((resolve,reject)=>{const tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').put(session);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
export async function listSessions(owner='guest'){const db=await openDB(owner);return new Promise<Session[]>((resolve,reject)=>{const request=db.transaction('sessions').objectStore('sessions').getAll();request.onsuccess=()=>{db.close();resolve((request.result as Session[]).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));};request.onerror=()=>{db.close();reject(request.error);};});}
export function downloadJSON(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
