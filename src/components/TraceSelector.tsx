import {CHANNELS,SURFACE_IDS,CATHETER_GROUPS,DISPLAY_IDS,DEFAULT_TRACE_IDS} from '../engine/signals';
import './trace-selector.css';

export const ALL_TRACES=DISPLAY_IDS;
const STORAGE_KEY='epsimlab.visible-traces.v1';

export function readTraceSelection():string[]{
 try{
  const saved:unknown=JSON.parse(localStorage.getItem(STORAGE_KEY)??'null');
  if(Array.isArray(saved)){
   const selected=ALL_TRACES.filter(id=>saved.includes(id));
   if(selected.length)return selected;
  }
 }catch{/* Use the full display when storage is unavailable. */}
 return [...DEFAULT_TRACE_IDS];
}
export function rememberTraceSelection(selected:string[]){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(selected));}catch{/* Display selection still works without storage. */}
}

const groups=[{name:'Surface ECG',ids:SURFACE_IDS},...CATHETER_GROUPS];
export function TraceSelector({selected,onChange}:{selected:string[];onChange:(ids:string[])=>void}){
 const toggle=(id:string)=>onChange(ALL_TRACES.filter(key=>key===id?!selected.includes(key):selected.includes(key)));
 return <div className="trace-selector">
  <p>Choose the signals shown in the live recording and frozen review. All {CHANNELS.length} signals continue to be recorded.</p>
  <div className="trace-presets" role="group" aria-label="Tracing presets">
   <button className="button subtle" onClick={()=>onChange([...DEFAULT_TRACE_IDS])}>EP study</button>
   <button className="button subtle" onClick={()=>onChange([...SURFACE_IDS])}>12-lead ECG</button>
   <button className="button subtle" onClick={()=>onChange([...ALL_TRACES])}>All signals</button>
   <button className="button subtle" onClick={()=>onChange(CHANNELS.filter(c=>c.kind==='ic').map(c=>c.id))}>Intracardiac only</button>
   <button className="button subtle" onClick={()=>onChange(['II','HISd','RV'])}>II / His / RV</button>
  </div>
  <div className="trace-groups">{groups.map(group=><fieldset key={group.name} className={group.name==='Surface ECG'?'surface-lead-group':''}><legend>{group.name}</legend><div className="trace-pair-options">{group.ids.map(id=>CHANNELS.find(c=>c.id===id)!).map(channel=><label key={channel.id}>
   <input type="checkbox" checked={selected.includes(channel.id)} disabled={selected.length===1&&selected.includes(channel.id)} onChange={()=>toggle(channel.id)}/>
   <i style={{background:channel.color}}/><span>{channel.label}</span>
  </label>)}</div></fieldset>)}</div>
  <p className="trace-selection-note">Catheter channels are adjacent bipolar pairs. Surface ECG morphology is schematic.</p>
  <p className="trace-selection-note">{selected.length} of {CHANNELS.length} signals visible. Keep at least one selected. This preference is remembered on this device.</p>
 </div>;
}
