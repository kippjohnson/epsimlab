export class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
export const fail=(status,message)=>{throw new HttpError(status,message);};
export const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra}});
export async function readJSON(request,limit=16384){
 const reader=request.body?.getReader();if(!reader)fail(400,'A JSON request body is required.');let length=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();fail(413,'This request is too large.');}chunks.push(value);}
 const buffer=new Uint8Array(length);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}
 try{const data=JSON.parse(new TextDecoder().decode(buffer));if(!data||Array.isArray(data)||typeof data!=='object')fail(400,'Enter valid request details.');return data;}catch{fail(400,'Enter valid JSON request details.');}
}
export const normalizeEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
export function email(value){const e=normalizeEmail(value);if(e.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(e))fail(400,'Enter a valid email address.');return e;}
export function name(value){const n=typeof value==='string'?value.trim().replace(/\s+/g,' '):'';if(n.length<2||n.length>120)fail(400,'Enter a name between 2 and 120 characters.');return n;}
export function phone(value){if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||value.length>32||!/^[+\d ().-]+$/.test(value)||value.replace(/\D/g,'').length<7)fail(400,'Enter a valid phone number or leave it blank.');return value.trim();}
export function password(value){if(typeof value!=='string'||value.length<12||value.length>128)fail(400,'Use a password between 12 and 128 characters.');return value;}
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export async function sha256(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export function cookie(request,key){const part=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='));if(!part)return '';try{return decodeURIComponent(part.slice(key.length+1));}catch{return '';}}
export function trustedOrigins(env){return [new URL(env.BETTER_AUTH_URL).origin,...(env.DEV_ORIGIN?[env.DEV_ORIGIN]:[])];}
export function checkMutation(request,env){
 if(['GET','HEAD'].includes(request.method))return;
 const origin=request.headers.get('Origin');if(!origin||!trustedOrigins(env).includes(origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')fail(403,'This request must come from EPSimLab.');
 if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))fail(415,'Use application/json.');
}
export async function rateLimit(env,request,scope,max=20,seconds=60){
 const now=Date.now(),window=Math.floor(now/(seconds*1000));const ip=request.headers.get('CF-Connecting-IP')||'local';
 const key=scope+':'+window+':'+await sha256(ip);const row=await env.DB.prepare('INSERT INTO request_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(window+2)*seconds*1000).first();
 if(row.count>max)fail(429,'Too many requests. Please try again later.');
 await env.DB.prepare('DELETE FROM request_limits WHERE expires_at<?').bind(now).run();
}
export function auditStatement(env,actor,target,action,detail={}){return env.DB.prepare('INSERT INTO account_audit(id,actor_id,target_id,action,detail,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,target,action,JSON.stringify(detail),Date.now());}
