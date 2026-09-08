import {hashPassword,verifyPassword} from 'better-auth/crypto';
import {createAuth,actorFor,configured,publicPerson,previewCookie,requireActor,requireSuperuser} from './auth.js';
import {auditStatement,checkMutation,cookie,email,fail,HttpError,json,name,normalizeEmail,password,phone,randomToken,rateLimit,readJSON,sha256} from './security.js';

async function findPerson(env,id){const p=await env.DB.prepare('SELECT * FROM people WHERE id=?').bind(id).first();if(!p)fail(404,'Account not found.');return p;}
async function invite(env,person,actorId){
 if(person.status!=='invited'||person.user_id)fail(409,'Only unactivated accounts can be invited.');
 const token=randomToken(),id=crypto.randomUUID(),now=Date.now();
 await env.DB.batch([
  env.DB.prepare('UPDATE invitations SET revoked_at=? WHERE person_id=? AND used_at IS NULL AND revoked_at IS NULL').bind(now,person.id),
  env.DB.prepare('INSERT INTO invitations(id,person_id,token_hash,created_by,created_at) VALUES(?,?,?,?,?)').bind(id,person.id,await sha256(token),actorId,now),
  auditStatement(env,actorId,person.id,'invitation.created')
 ]);
 return {activationUrl:new URL('/#activate='+token,env.BETTER_AUTH_URL).href};
}
async function invitation(env,token){
 if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))fail(400,'Use a valid invitation link.');
 const i=await env.DB.prepare('SELECT i.id AS invitation_id,i.used_at,i.revoked_at,p.* FROM invitations i JOIN people p ON p.id=i.person_id WHERE i.token_hash=?').bind(await sha256(token)).first();
 if(!i||i.revoked_at||['disabled','removed'].includes(i.status))fail(404,'This invitation is invalid or has been revoked.');
 if(i.used_at||i.user_id||i.status!=='invited')fail(409,'This account has already been activated. Please sign in.');
 return i;
}
async function activate(env,request,body){
 await rateLimit(env,request,'activate',6,300);
 const i=await invitation(env,body.token),displayName=name(body.name),secret=password(body.password);
 const hash=await hashPassword(secret),uid=crypto.randomUUID(),now=Date.now();
 // Guard the entire atomic batch with the still-current invitation. No public sign-up or first-user role promotion.
 const results=await env.DB.batch([
  env.DB.prepare(`INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at)
   SELECT ?,?,p.email,1,?,? FROM people p JOIN invitations i ON i.person_id=p.id
   WHERE p.id=? AND p.status='invited' AND p.user_id IS NULL AND i.id=? AND i.used_at IS NULL AND i.revoked_at IS NULL`).bind(uid,displayName,now,now,i.id,i.invitation_id),
  env.DB.prepare("INSERT INTO auth_account(id,issuer,account_id,provider_id,user_id,password,created_at,updated_at) SELECT ?,'local:credential',id,'credential',id,?,?,? FROM auth_user WHERE id=?").bind(crypto.randomUUID(),hash,now,now,uid),
  env.DB.prepare("UPDATE people SET user_id=?,status='active',name=?,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM auth_user WHERE id=?)").bind(uid,displayName,now,i.id,uid),
  env.DB.prepare('UPDATE invitations SET used_at=? WHERE person_id=? AND used_at IS NULL AND EXISTS(SELECT 1 FROM auth_user WHERE id=?)').bind(now,i.id,uid),
  env.DB.prepare("INSERT INTO account_audit(id,actor_id,target_id,action,created_at) SELECT ?,?,?,'account.activated',? WHERE EXISTS(SELECT 1 FROM auth_user WHERE id=?)").bind(crypto.randomUUID(),uid,i.id,now,uid)
 ]);
 if(results[0].meta.changes!==1)fail(409,'This invitation changed. Ask for a new link.');
 return json({activated:true,email:i.email},201);
}
async function register(env,request,body){
 await rateLimit(env,request,'register',5,3600);
 if(body.website)fail(400,'Unable to create this account.');
 const address=email(body.email),displayName=name(body.name),secret=password(body.password);
 const existing=await env.DB.prepare('SELECT id FROM people WHERE email=?').bind(address).first();
 if(existing)fail(409,'An account or invitation already exists for this email. Sign in or use your invitation link.');
 const hash=await hashPassword(secret),uid=crypto.randomUUID(),personId=crypto.randomUUID(),now=Date.now();
 // Self-registration can only create a regular user. Existing invited/disabled/owner identities are reserved.
 const results=await env.DB.batch([
  env.DB.prepare(`INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at)
   SELECT ?,?,?,0,?,? WHERE NOT EXISTS(SELECT 1 FROM people WHERE email=?) AND NOT EXISTS(SELECT 1 FROM auth_user WHERE email=?)`).bind(uid,displayName,address,now,now,address,address),
  env.DB.prepare("INSERT INTO auth_account(id,issuer,account_id,provider_id,user_id,password,created_at,updated_at) SELECT ?,'local:credential',id,'credential',id,?,?,? FROM auth_user WHERE id=?").bind(crypto.randomUUID(),hash,now,now,uid),
  env.DB.prepare("INSERT INTO people(id,user_id,name,email,role,status,owner,created_at,updated_at) SELECT ?,id,name,email,'user','active',0,?,? FROM auth_user WHERE id=?").bind(personId,now,now,uid),
  env.DB.prepare("UPDATE account_requests SET status='resolved',resolved_at=? WHERE kind='access' AND email=? AND status='pending' AND EXISTS(SELECT 1 FROM auth_user WHERE id=?)").bind(now,address,uid),
  env.DB.prepare("INSERT INTO account_audit(id,actor_id,target_id,action,created_at) SELECT ?,?,?,'account.registered',? WHERE EXISTS(SELECT 1 FROM auth_user WHERE id=?)").bind(crypto.randomUUID(),uid,personId,now,uid)
 ]);
 if(results[0].meta.changes!==1)fail(409,'An account already exists for this email. Please sign in.');
 return json({created:true,email:address},201);
}
async function changePassword(env,actor,body){
 requireActor(actor,{passwordChange:true});
 const current=typeof body.currentPassword==='string'?body.currentPassword:'',next=password(body.newPassword);
 if(!current||current.length>128||current===next)fail(400,'Enter your current password and a different new password.');
 const credential=await env.DB.prepare("SELECT id,password FROM auth_account WHERE user_id=? AND provider_id='credential'").bind(actor.userId).first();
 if(!credential?.password||!await verifyPassword({password:current,hash:credential.password}))fail(400,'The current password is incorrect.');
 const nextHash=await hashPassword(next),now=Date.now();
 const result=await env.DB.batch([
  env.DB.prepare('UPDATE auth_account SET password=?,updated_at=? WHERE id=? AND password=?').bind(nextHash,now,credential.id,credential.password),
  env.DB.prepare('UPDATE people SET must_change_password=0,updated_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM auth_account WHERE id=? AND password=?)').bind(now,actor.userId,credential.id,nextHash),
  env.DB.prepare('DELETE FROM auth_session WHERE user_id=? AND id<>?').bind(actor.userId,actor.sessionId),
  env.DB.prepare('DELETE FROM role_previews WHERE user_id=?').bind(actor.userId),
  auditStatement(env,actor.userId,actor.person.id,'password.changed')
 ]);
 if(result[0].meta.changes!==1)fail(409,'Your credentials changed. Sign in again.');
 return json({changed:true,otherSessionsRevoked:true});
}
async function setPassword(env,actor,person,body){
 requireSuperuser(actor);
 if(person.owner||person.user_id===actor.userId||person.role==='superuser')fail(403,'Superusers must change their own passwords.');
 if(person.status==='disabled'||person.status==='removed')fail(409,'Restore access before setting a password.');
 const hash=await hashPassword(password(body.newPassword)),now=Date.now();
 const statements=[];
 if(!person.user_id){
  const uid=crypto.randomUUID();
  statements.push(env.DB.prepare("INSERT INTO auth_user(id,name,email,email_verified,created_at,updated_at) SELECT ?,name,email,0,?,? FROM people WHERE id=? AND status='invited' AND user_id IS NULL").bind(uid,now,now,person.id));
  statements.push(env.DB.prepare("INSERT INTO auth_account(id,issuer,account_id,provider_id,user_id,password,created_at,updated_at) SELECT ?,'local:credential',id,'credential',id,?,?,? FROM auth_user WHERE id=?").bind(crypto.randomUUID(),hash,now,now,uid));
  statements.push(env.DB.prepare("UPDATE people SET user_id=?,status='active',must_change_password=1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM auth_user WHERE id=?)").bind(uid,now,person.id,uid));
 }else{
  statements.push(env.DB.prepare("UPDATE auth_account SET password=?,updated_at=? WHERE user_id=? AND provider_id='credential'").bind(hash,now,person.user_id));
  statements.push(env.DB.prepare('UPDATE people SET must_change_password=1,updated_at=? WHERE id=?').bind(now,person.id));
  statements.push(env.DB.prepare('DELETE FROM auth_session WHERE user_id=?').bind(person.user_id));
  statements.push(env.DB.prepare('DELETE FROM role_previews WHERE user_id=?').bind(person.user_id));
 }
 statements.push(env.DB.prepare('UPDATE invitations SET revoked_at=? WHERE person_id=? AND used_at IS NULL').bind(now,person.id));
 statements.push(env.DB.prepare("UPDATE account_requests SET status='resolved',resolved_at=? WHERE kind='password' AND email=? AND status='pending'").bind(now,person.email));
 statements.push(auditStatement(env,actor.userId,person.id,'password.reset',{sessionsRevoked:true}));
 const result=await env.DB.batch(statements);
 if(!result[0].meta.changes)fail(409,'This account changed. Refresh and try again.');
 return json({updated:true,mustChangePassword:true});
}
async function createPerson(env,actor,body){
 requireSuperuser(actor);const displayName=name(body.name),address=email(body.email),contact=phone(body.phone),now=Date.now(),id=crypto.randomUUID();
 if(body.role&&body.role!=='user')fail(400,'New invitations start as users. Change the role after creating the account.');
 const existing=await env.DB.prepare('SELECT id FROM people WHERE email=?').bind(address).first();if(existing)fail(409,'That email already has an account.');
 await env.DB.batch([
  env.DB.prepare("INSERT INTO people(id,name,email,phone,role,status,created_at,updated_at) VALUES(?,?,?,?,'user','invited',?,?)").bind(id,displayName,address,contact,now,now),
  env.DB.prepare("UPDATE account_requests SET status='invited',resolved_at=? WHERE kind='access' AND email=? AND status='pending'").bind(now,address),
  auditStatement(env,actor.userId,id,'account.invited')
 ]);
 const person=await findPerson(env,id);return json({person:publicPerson(person),...await invite(env,person,actor.userId)},201);
}
async function updatePerson(env,actor,person,body){
 requireSuperuser(actor);
 const displayName=body.name===undefined?person.name:name(body.name),contact=body.phone===undefined?person.phone:phone(body.phone);
 const nextRole=body.role??person.role;if(!['user','superuser'].includes(nextRole))fail(400,'Choose User or Superuser.');
 const nextStatus=body.status??person.status;if(!['active','invited','disabled','removed'].includes(nextStatus))fail(400,'Choose a valid account status.');
 if((person.owner||person.user_id===actor.userId)&&(nextRole!==person.role||nextStatus!==person.status))fail(403,'You cannot disable, remove, or demote your own account or the owner.');
 if((nextStatus==='active'&&!person.user_id)||(nextStatus==='invited'&&person.user_id))fail(400,'Activate this account through an invitation or temporary password.');
 if(person.status==='removed'&&nextStatus===person.status)fail(409,'Restore this account before editing it.');
 // Changing an unactivated address is safe; active addresses are stable login identities.
 const address=body.email===undefined?person.email:email(body.email);
 if(address!==person.email&&person.user_id)fail(400,'An activated sign-in email cannot be edited. Update the profile name or invite the new address.');
 const now=Date.now();const statements=[env.DB.prepare('UPDATE people SET name=?,phone=?,role=?,status=?,email=?,updated_at=? WHERE id=?').bind(displayName,contact,nextRole,nextStatus,address,now,person.id)];
 if(person.user_id)statements.push(env.DB.prepare('UPDATE auth_user SET name=?,updated_at=? WHERE id=?').bind(displayName,now,person.user_id));
 if(nextStatus!==person.status||nextRole!==person.role||address!==person.email){
  statements.push(env.DB.prepare('UPDATE invitations SET revoked_at=? WHERE person_id=? AND used_at IS NULL').bind(now,person.id));
  if(person.user_id){statements.push(env.DB.prepare('DELETE FROM auth_session WHERE user_id=?').bind(person.user_id));statements.push(env.DB.prepare('DELETE FROM role_previews WHERE user_id=?').bind(person.user_id));}
 }
 statements.push(auditStatement(env,actor.userId,person.id,'account.updated',{role:nextRole,status:nextStatus}));
 await env.DB.batch(statements);return json({person:publicPerson(await findPerson(env,person.id))});
}
async function notifyOwner(env,record){
 if(!env.ACCOUNT_EMAIL||!env.NOTIFICATION_EMAIL||!env.EMAIL_FROM)return;
 // Optional Cloudflare email binding. No invitation tokens or passwords in notifications.
 try{await env.ACCOUNT_EMAIL.send({to:env.NOTIFICATION_EMAIL,from:{email:env.EMAIL_FROM,name:'EPSimLab'},subject:record.kind==='access'?'EPSimLab access request':'EPSimLab password help request',text:`${record.kind==='access'?record.name+' requested access.':'Password help was requested.'}\nEmail: ${record.email}\n\nReview Accounts in EPSimLab: ${env.BETTER_AUTH_URL}`});await env.DB.prepare('UPDATE account_requests SET notified_at=? WHERE id=?').bind(Date.now(),record.id).run();}catch{console.error('EPSimLab account notification failed',{requestId:record.id});}
}
async function accessRequest(env,request,body,kind,ctx){
 if(typeof body.website==='string'&&body.website.trim())return json({received:true},202);
 await rateLimit(env,request,'request-'+kind,5,3600);
 const address=email(body.email),displayName=kind==='access'?name(body.name):'',note=typeof body.note==='string'?body.note.trim():'';
 if(note.length>1000)fail(400,'Keep your note under 1,000 characters.');
 const id=crypto.randomUUID(),now=Date.now();
 const result=await env.DB.prepare("INSERT OR IGNORE INTO account_requests(id,kind,email,name,note,created_at) VALUES(?,?,?,?,?,?)").bind(id,kind,address,displayName,note,now).run();
 if(result.meta.changes){const work=notifyOwner(env,{id,kind,email:address,name:displayName});if(ctx?.waitUntil)ctx.waitUntil(work);else await work;}
 return json({received:true},201);
}
export async function accountsAPI(request,env,ctx){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/identity'&&request.method==='GET'){
  if(!configured(env))return json({configured:false,account:null});
  const actor=await actorFor(env,request);return json({configured:true,account:actor?{...actor.person,effectiveRole:actor.role,previewing:actor.previewing}:null});
 }
 if(!configured(env))fail(503,'Accounts are not configured on this instance.');
 checkMutation(request,env);
 if(path.startsWith('/api/auth/')){
  const allowed=new Set(['POST /api/auth/sign-in/email','POST /api/auth/sign-out']);
  if(!allowed.has(request.method+' '+path))fail(404,'This authentication action is unavailable.');
  const body=await readJSON(request);
  if(path.endsWith('/sign-in/email')){
   await rateLimit(env,request,'sign-in',20,60);
   const address=email(body.email);if(typeof body.password!=='string'||body.password.length>128)fail(400,'Enter your password.');
   return createAuth(env).handler(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({email:address,password:body.password,rememberMe:body.rememberMe!==false})}));
  }
  return createAuth(env).handler(new Request(request.url,{method:'POST',headers:request.headers,body:'{}'}));
 }
 if(path==='/api/invitations/inspect'&&request.method==='POST'){
  await rateLimit(env,request,'invitation-inspect',30,60);const i=await invitation(env,(await readJSON(request)).token);return json({email:i.email,name:i.name});
 }
 if(path==='/api/invitations/activate'&&request.method==='POST')return activate(env,request,await readJSON(request));
 if(path==='/api/register'&&request.method==='POST')return register(env,request,await readJSON(request));
 if(path==='/api/access-requests'&&request.method==='POST')fail(410,'You can now create an account directly.');
 if(path==='/api/password-reset-requests'&&request.method==='POST')return accessRequest(env,request,await readJSON(request),'password',ctx);
 const actor=await actorFor(env,request);
 if(path==='/api/account/password'&&request.method==='POST'){requireActor(actor,{passwordChange:true});await rateLimit(env,request,'password-change',10,300);return changePassword(env,actor,await readJSON(request));}
 requireActor(actor);
 if(path==='/api/account/profile'&&request.method==='PATCH'){
  const body=await readJSON(request),displayName=name(body.name),contact=phone(body.phone),now=Date.now();
  await env.DB.batch([env.DB.prepare('UPDATE people SET name=?,phone=?,updated_at=? WHERE user_id=?').bind(displayName,contact,now,actor.userId),env.DB.prepare('UPDATE auth_user SET name=?,updated_at=? WHERE id=?').bind(displayName,now,actor.userId),auditStatement(env,actor.userId,actor.person.id,'profile.updated')]);return json({updated:true});
 }
 if(path==='/api/account/sessions'){
  if(request.method==='GET'){const {results}=await env.DB.prepare('SELECT id,created_at,expires_at,user_agent FROM auth_session WHERE user_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 50').bind(actor.userId,Date.now()).all();return json({sessions:results.map(s=>({id:s.id,createdAt:s.created_at,expiresAt:s.expires_at,userAgent:s.user_agent,current:s.id===actor.sessionId}))});}
  if(request.method==='POST'){const body=await readJSON(request);if(body.allOthers===true)await env.DB.prepare('DELETE FROM auth_session WHERE user_id=? AND id<>?').bind(actor.userId,actor.sessionId).run();else{if(typeof body.id!=='string'||body.id===actor.sessionId)fail(400,'Use Sign out to end your current session.');await env.DB.prepare('DELETE FROM auth_session WHERE id=? AND user_id=?').bind(body.id,actor.userId).run();}return json({revoked:true});}
 }
 if(path==='/api/account/preview'&&request.method==='POST'){
  if(actor.person.role!=='superuser')fail(403,'Superuser access is required.');const body=await readJSON(request);
  if(typeof body.enabled!=='boolean')fail(400,'Choose a preview mode.');
  const token=body.enabled?randomToken():'';
  await env.DB.prepare('DELETE FROM role_previews WHERE user_id=? AND session_id=?').bind(actor.userId,actor.sessionId).run();
  if(token)await env.DB.prepare('INSERT INTO role_previews(token_hash,user_id,session_id,expires_at) VALUES(?,?,?,?)').bind(await sha256(token),actor.userId,actor.sessionId,Date.now()+8*3600000).run();
  return json({previewing:body.enabled},200,{'Set-Cookie':previewCookie(request,token,token?8*3600:0)});
 }
 requireSuperuser(actor);
 if(path==='/api/admin/people'){
  if(request.method==='GET'){const search=(url.searchParams.get('q')??'').slice(0,120);const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));const where=search?' WHERE name LIKE ? OR email LIKE ?':'';const stmt=env.DB.prepare('SELECT * FROM people'+where+' ORDER BY created_at DESC LIMIT 101 OFFSET ?');const {results}=await(search?stmt.bind('%'+search+'%','%'+search+'%',offset):stmt.bind(offset)).all();return json({people:results.slice(0,100).map(publicPerson),hasMore:results.length>100});}
  if(request.method==='POST')return createPerson(env,actor,await readJSON(request));
 }
 if(path==='/api/admin/person'&&request.method==='PATCH'){const body=await readJSON(request);return updatePerson(env,actor,await findPerson(env,body.id??''),body);}
 if(path==='/api/admin/invitations'&&request.method==='POST'){const body=await readJSON(request),person=await findPerson(env,body.id??'');if(body.revoke){await env.DB.batch([env.DB.prepare('UPDATE invitations SET revoked_at=? WHERE person_id=? AND used_at IS NULL').bind(Date.now(),person.id),auditStatement(env,actor.userId,person.id,'invitation.revoked')]);return json({revoked:true});}return json(await invite(env,person,actor.userId));}
 if(path==='/api/admin/password'&&request.method==='POST'){await rateLimit(env,request,'admin-password',15,300);const body=await readJSON(request);return setPassword(env,actor,await findPerson(env,body.id??''),body);}
 if(path==='/api/admin/revoke-sessions'&&request.method==='POST'){const person=await findPerson(env,(await readJSON(request)).id??'');if(person.owner&&person.user_id!==actor.userId)fail(403,'The owner manages their own sessions.');if(person.user_id)await env.DB.batch([env.DB.prepare('DELETE FROM auth_session WHERE user_id=? AND id<>?').bind(person.user_id,actor.sessionId),auditStatement(env,actor.userId,person.id,'sessions.revoked')]);return json({revoked:true});}
 if(path==='/api/admin/requests'){
  if(request.method==='GET'){const {results}=await env.DB.prepare("SELECT * FROM account_requests WHERE status='pending' ORDER BY created_at DESC LIMIT 200").all();return json({requests:results});}
  if(request.method==='PATCH'){const body=await readJSON(request);if(!['declined','resolved'].includes(body.status)||typeof body.id!=='string')fail(400,'Choose a request and status.');await env.DB.batch([env.DB.prepare("UPDATE account_requests SET status=?,resolved_at=? WHERE id=? AND status='pending'").bind(body.status,Date.now(),body.id),auditStatement(env,actor.userId,body.id,'request.'+body.status)]);return json({updated:true});}
 }
 if(path==='/api/admin/audit'&&request.method==='GET'){const {results}=await env.DB.prepare('SELECT a.*,p.name AS actor_name FROM account_audit a LEFT JOIN people p ON p.user_id=a.actor_id ORDER BY a.created_at DESC LIMIT 100').all();return json({events:results});}
 fail(404,'Not found.');
}
