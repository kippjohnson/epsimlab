import type {LabEvent} from '../engine/model';
export function SchematicAnatomy({site,onSite,events,now,explain=false}:{site:string;onSite:(s:string)=>void;events:LabEvent[];now:number;explain?:boolean}){
 const active=(node:string)=>events.some(e=>e.kind==='activation'&&e.node===node&&now-e.t<160);
 return <div className="anatomy"><svg viewBox="0 0 270 285" role="img" aria-label="Schematic cardiac anatomy with HRA, His, coronary sinus and RV catheter locations">
  <defs><radialGradient id="chamber"><stop stopColor="#263b4f" stopOpacity=".55"/><stop offset="1" stopColor="#111d29" stopOpacity=".2"/></radialGradient><pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#263443"/></pattern><filter id="glow"><feGaussianBlur stdDeviation="4"/></filter></defs>
  <rect width="270" height="285" fill="url(#dots)"/>
  <path d="M104 36 C78 17 45 41 47 76 C17 101 32 144 66 151 C62 186 81 231 139 262 C189 245 230 179 221 131 C246 99 225 65 197 60 C172 24 130 17 104 36Z" fill="url(#chamber)" stroke="#405064" strokeWidth="1.2"/>
  <path d="M105 37 C105 78 91 108 113 135 C85 161 95 219 139 262 M113 135 C141 146 147 205 139 262 M113 135 C143 128 180 107 221 131 M49 78 C71 74 84 94 94 114 M65 150 C84 143 93 137 113 135" fill="none" stroke="#34465a"/>
  <path d="M97 14 L95 43 M77 153 L55 263 M183 27 L190 53 M230 74 L248 65 M235 92 L254 90" stroke="#3f5064" strokeWidth="10" fill="none"/>
  <path d="M97 14 L95 43 M77 153 L55 263" stroke="#111d29" strokeWidth="7"/>
  <path d="M59 275 Q90 155 68 97" stroke="#6bb6ff" strokeWidth="1.8" fill="none" opacity=".75"/>
  <path d="M64 275 Q98 162 110 127" stroke="#f1c267" strokeWidth="1.8" fill="none" opacity=".8"/>
  <path d="M69 275 Q87 169 112 143 Q146 121 198 125" stroke="#c291ef" strokeWidth="1.8" fill="none" opacity=".8"/>
  <path d="M74 275 Q88 151 111 149 Q133 166 132 224" stroke="#69d7aa" strokeWidth="1.8" fill="none" opacity=".8"/>
  {[139,152,165,178,190].map((x,i)=><circle key={i} cx={x} cy={132-i*2} r="2.1" fill="#c291ef"/>)}
  <text x="53" y="69" className="chamber-label">RA</text><text x="169" y="77" className="chamber-label">LA</text><text x="84" y="190" className="chamber-label">RV</text><text x="169" y="185" className="chamber-label">LV</text>
  {[{id:'HRA',x:68,y:97,node:'A',c:'#6bb6ff',tx:32,ty:108},{id:'His',x:110,y:127,node:'H',c:'#f1c267',tx:114,ty:116},{id:'CS',x:198,y:125,node:'A',c:'#c291ef',tx:216,ty:124},{id:'RVA',x:132,y:224,node:'V',c:'#69d7aa',tx:147,ty:232}].map(p=><g key={p.id} onClick={()=>onSite(p.id)} className="electrode"><circle cx={p.x} cy={p.y} r="15" fill="transparent"/>{(site===p.id||explain&&active(p.node))&&<circle cx={p.x} cy={p.y} r="11" fill={p.c} opacity=".15"/>}<circle cx={p.x} cy={p.y} r={explain&&active(p.node)?5:3.5} fill={p.c}/><text x={p.tx} y={p.ty} fill={p.c} fontSize="10">{p.id==='RVA'?'RV':p.id}</text></g>)}
 </svg><div className="anatomy-caption"><span>Schematic anatomy</span><span>ANTERIOR</span></div></div>;
}
