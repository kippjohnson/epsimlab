import {ENGINE_VERSION,isCompatibleSession} from '../src/engine/model.ts';
// Optional anonymous per-device session sync. The 256-bit bearer token never leaves
// this device except over HTTPS to this origin; only its SHA-256 hash is persisted.
const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const validProtocol=p=>p&&['HRA','RVA'].includes(p.site)&&Number.isFinite(p.s1)&&p.s1>=220&&p.s1<=1500&&Number.isInteger(p.beats)&&p.beats>=1&&p.beats<=30&&Number.isFinite(p.output)&&p.output>=0&&p.output<=20&&Number.isFinite(p.width)&&p.width>=.1&&p.width<=2&&(p.s2===null||Number.isFinite(p.s2)&&p.s2>=180&&p.s2<=1000);
async function readLimited(request){const reader=request.body?.getReader();if(!reader)throw new Error('No body');let length=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>131072){await reader.cancel();throw new Error('Too large');}chunks.push(value);}const buffer=new Uint8Array(length);let offset=0;for(const v of chunks){buffer.set(v,offset);offset+=v.length;}return JSON.parse(new TextDecoder().decode(buffer));}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/health')return json({app:'ep-lab',version:ENGINE_VERSION,storage:Boolean(env.DB&&env.RECORDINGS)});
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(url.pathname!=='/api/session')return json({error:'Not found'},404);
  if(!['GET','PUT'].includes(request.method))return json({error:'Method not allowed'},405);
  if(!env.DB||!env.RECORDINGS)return json({error:'Cloud storage is not configured. Local sessions remain available.'},503);
  const origin=request.headers.get('Origin');if(origin&&origin!==url.origin)return json({error:'Origin not allowed'},403);
  const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return json({error:'Device session token required'},401);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));const owner=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');const key=`sessions/${owner}/latest.json`;
  try{
   if(request.method==='GET'){const row=await env.DB.prepare('SELECT object_key FROM sessions WHERE owner_hash = ?').bind(owner).first();if(!row)return json({error:'No synced study'},404);const object=await env.RECORDINGS.get(row.object_key);if(!object)return json({error:'No synced recording'},404);return new Response(object.body,{headers});}
   let session;try{session=await readLimited(request);}catch{return json({error:'Invalid or oversized session (128 KiB maximum)'},400);}
   const s=session?.snapshot;if(!isCompatibleSession(session?.engineVersion,s?.caseId)||!Number.isFinite(s?.now)||s.now<0||s.now>14400000||!Array.isArray(s?.commands)||s.commands.length>1000||typeof session.title!=='string'||session.title.length>120)return json({error:'Unsupported session'},400);
   let previous=0;for(const c of s.commands){if(!Number.isFinite(c.t)||c.t<previous||c.t>s.now||!['pace','stop'].includes(c.type)||c.type==='pace'&&!validProtocol(c.protocol))return json({error:'Invalid command history'},400);previous=c.t;}
   const clean={id:typeof session.id==='string'?session.id.slice(0,80):crypto.randomUUID(),title:session.title,engineVersion:session.engineVersion,savedAt:new Date().toISOString(),snapshot:{caseId:s.caseId,now:s.now,commands:s.commands},measurements:Array.isArray(session.measurements)?session.measurements.filter(m=>typeof m.label==='string'&&m.label.length<100&&typeof m.channel==='string'&&m.channel.length<40&&Number.isFinite(m.start)&&Number.isFinite(m.end)).slice(0,100):[]};
   await env.RECORDINGS.put(key,JSON.stringify(clean),{httpMetadata:{contentType:'application/json'}});
   await env.DB.prepare('INSERT INTO sessions (owner_hash,title,case_id,engine_version,saved_at,object_key) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_hash) DO UPDATE SET title=excluded.title,case_id=excluded.case_id,engine_version=excluded.engine_version,saved_at=excluded.saved_at,object_key=excluded.object_key').bind(owner,clean.title,s.caseId,clean.engineVersion,clean.savedAt,key).run();
   return json({saved:true,savedAt:clean.savedAt});
  }catch{return json({error:'Storage unavailable; your local save is unaffected'},503);}
 }
};
