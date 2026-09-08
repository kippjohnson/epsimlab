import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import worker from '../worker/index.js';
import {randomToken,sha256} from '../worker/security.js';

test('accounts integrate with real D1: activation, permissions, recovery and private studies',async t=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB'],compatibilityDate:'2026-05-15'});
 t.after(()=>mf.dispose());
 const DB=await mf.getD1Database('DB');
 const sql=await readFile(new URL('../worker/migrations/0001_accounts.sql',import.meta.url),'utf8');
 await DB.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>DB.prepare(s)));
 const learningSQL=await readFile(new URL('../worker/migrations/0002_learning_progress.sql',import.meta.url),'utf8');
 await DB.batch(learningSQL.split(';').map(s=>s.trim()).filter(Boolean).map(s=>DB.prepare(s)));
 const origin='http://localhost:8787',env={DB,BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:randomToken()};
 let ip=0;
 const check=async(label,fn)=>{await fn();t.diagnostic(label);};
 async function call(path,method='GET',body?,cookies='',extra={}){
  const response=await worker.fetch(new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':`192.0.2.${++ip}`,Cookie:cookies,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
  const data=await response.json();
  return {status:response.status,data,cookies:response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),headers:response.headers};
 }
 async function seed(address,role='user',owner=0){
  const id=crypto.randomUUID(),token=randomToken(),now=Date.now();
  await DB.prepare('INSERT INTO people(id,email,name,role,owner,status,created_at,updated_at) VALUES(?,?,?,?,?,\'invited\',?,?)').bind(id,address,'Test Person',role,owner,now,now).run();
  await DB.prepare('INSERT INTO invitations(id,person_id,token_hash,created_by,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,await sha256(token),'bootstrap',1).run();
  return {id,token,email:address};
 }
 const initialPassword='LocalTestPassword!234',nextPassword='ChangedTestPassword!234';
 async function activate(p){const r=await call('/api/invitations/activate','POST',{token:p.token,name:'Test Person',password:initialPassword,role:'superuser',email:'attacker@example.com'});assert.equal(r.status,201,JSON.stringify(r.data));}
 async function login(email,password=initialPassword){const r=await call('/api/auth/sign-in/email','POST',{email,password});assert.equal(r.status,200,JSON.stringify(r.data));assert.match(r.cookies,/ep-lab.session_token=/);return r.cookies;}
 const owner=await seed('owner@example.com','superuser',1),user=await seed('user@example.com'),other=await seed('other@example.com');
 await check('open registration creates only regular accounts and protects reserved identities',async()=>{
  const signup={name:'New Learner',email:'  SIGNUP@Example.com  ',password:initialPassword,role:'superuser',owner:true,status:'active',emailVerified:true};
  assert.equal((await call('/api/register','POST',{...signup,email:owner.email})).status,409);
  assert.equal((await call('/api/register','POST',signup,'',{Origin:'https://evil.example'})).status,403);
  assert.equal((await call('/api/register','POST',{...signup,password:'short'})).status,400);
  const results=await Promise.all([1,2].map(()=>call('/api/register','POST',signup)));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const signedIn=await login('signup@example.com');
  const identity=(await call('/api/identity','GET',undefined,signedIn)).data.account;
  assert.equal(identity.role,'user');assert.equal(identity.owner,false);assert.equal(identity.status,'active');
  assert.equal((await DB.prepare('SELECT email_verified FROM auth_user WHERE email=?').bind('signup@example.com').first()).email_verified,0);
  assert.equal((await call('/api/admin/people','GET',undefined,signedIn)).status,403);
  assert.equal((await call('/api/register','POST',signup)).status,409);
  assert.equal((await call('/api/studies','POST',{title:'Guest study'})).status,401);
 });
 await check('concurrent activation consumes an invitation exactly once',async()=>{
  const p=await seed('race@example.com');
  const results=await Promise.all([1,2].map(()=>call('/api/invitations/activate','POST',{token:p.token,name:'Race Fellow',password:initialPassword})));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM auth_user WHERE email=?').bind(p.email).first()).n,1);
 });
 await check('invites are durable, single-use, email-bound and cannot elevate roles',async()=>{
  assert.equal((await call('/api/invitations/inspect','POST',{token:user.token})).data.email,user.email);
  for(const p of [owner,user,other])await activate(p);
  assert.equal((await call('/api/invitations/activate','POST',{token:user.token,name:'Again',password:initialPassword})).status,409);
  const row=await DB.prepare('SELECT email,role FROM people WHERE id=?').bind(user.id).first();assert.deepEqual(row,{email:user.email,role:'user'});
  assert.equal((await call('/api/auth/sign-up/email','POST',{name:'Attacker',email:'attacker@example.com',password:initialPassword})).status,404);
 });
 let ownerCookie=await login(owner.email),userCookie=await login(user.email),otherCookie=await login(other.email);
 await check('credentials produce sessions; unauthenticated and cross-origin mutations are denied',async()=>{
  const identity=await call('/api/identity','GET',undefined,ownerCookie);assert.equal(identity.data.account.owner,true);
  assert.equal(identity.data.account.effectiveRole,'superuser');assert.match(identity.headers.get('Cache-Control'),/no-store/);
  assert.equal((await call('/api/admin/people')).status,401);
  assert.equal((await call('/api/admin/people','GET',undefined,userCookie)).status,403);
  assert.equal((await call('/api/account/profile','PATCH',{name:'Invalid'},userCookie,{Origin:'https://evil.example'})).status,403);
  assert.equal((await call('/api/account/profile','PATCH',{name:'Invalid'},userCookie,{Origin:''})).status,403);
  assert.equal((await call('/api/auth/sign-in/email','POST',{email:user.email,password:'incorrect password'})).status,401);
  assert.equal((await call('/api/account/profile','PATCH',{name:'Updated User',phone:'+1 555 123 4567',role:'superuser'},userCookie)).status,200);
  assert.equal((await call('/api/identity','GET',undefined,userCookie)).data.account.role,'user');
 });
 await check('Module 0 progress is private, validated, durable and completion is server-derived',async()=>{
  const path='/api/learning/module-0',progress={version:1,answers:{'signals-clock':0,'signals-gain':1},completed:['scenarios'],userId:other.id};
  assert.equal((await call(path)).status,401);
  assert.equal((await call(path,'PUT',progress)).status,401);
  assert.deepEqual((await call(path,'GET',undefined,userCookie)).data.answers,{});
  assert.equal((await call(path,'PUT',progress,userCookie,{Origin:'https://evil.example'})).status,403);
  const saved=await call(path,'PUT',progress,userCookie);assert.equal(saved.status,200);assert.deepEqual(saved.data.completed,['signals']);
  const loaded=await call(path,'GET',undefined,userCookie);assert.deepEqual(loaded.data.answers,progress.answers);assert.match(loaded.headers.get('Cache-Control'),/no-store/);
  assert.deepEqual((await call(path,'GET',undefined,otherCookie)).data.answers,{});
  assert.equal((await call(path,'PUT',{...progress,answers:{'invented':0}},userCookie)).status,400);
  assert.equal((await call(path,'PUT',{...progress,version:999},userCookie)).status,400);
  assert.equal((await call(path,'PUT',{...progress,note:'a'.repeat(5000)},userCookie)).status,413);
  assert.equal((await call(path,'POST',progress,userCookie)).status,405);
  assert.deepEqual((await call(path,'GET',undefined,userCookie)).data.answers,progress.answers);
  await call(path,'PUT',{version:1,answers:{'signals-clock':1}},userCookie);
  assert.deepEqual((await call(path,'GET',undefined,userCookie)).data.completed,[]);
  const relogin=await login(user.email);assert.deepEqual((await call(path,'GET',undefined,relogin)).data.answers,{'signals-clock':1});
 });
 await check('owner protection and server-enforced preview permissions',async()=>{
  for(const update of [{role:'user'},{status:'disabled'},{status:'removed'}])assert.equal((await call('/api/admin/person','PATCH',{id:owner.id,...update},ownerCookie)).status,403);
  assert.equal((await call('/api/admin/password','POST',{id:owner.id,newPassword:nextPassword},ownerCookie)).status,403);
  const preview=await call('/api/account/preview','POST',{enabled:true},ownerCookie);assert.equal(preview.status,200);
  const previewCookie=ownerCookie+'; '+preview.cookies;
  assert.equal((await call('/api/identity','GET',undefined,previewCookie)).data.account.effectiveRole,'user');
  assert.equal((await call('/api/admin/people','GET',undefined,previewCookie)).status,403);
  assert.equal((await call('/api/account/preview','POST',{enabled:false},previewCookie)).status,200);
 });
 let studyId;
 await check('saved studies are bound to the authenticated user for list, load and delete',async()=>{
  const study={id:'client-selected-id',userId:(await call('/api/identity','GET',undefined,otherCookie)).data.account.userId,title:'Test AVNRT',engineVersion:'0.2.0',snapshot:{caseId:'avnrt-01',now:6000,commands:[]},measurements:[]};
  const saved=await call('/api/studies','POST',study,userCookie);assert.equal(saved.status,201,JSON.stringify(saved.data));studyId=saved.data.study.id;assert.notEqual(studyId,study.id);
  assert.equal((await call('/api/studies','GET',undefined,userCookie)).data.studies.length,1);
  assert.equal((await call('/api/studies','GET',undefined,otherCookie)).data.studies.length,0);
  assert.equal((await call('/api/studies?id='+studyId,'GET',undefined,otherCookie)).status,404);
  assert.equal((await call('/api/studies','DELETE',{id:studyId},otherCookie)).status,404);
  assert.equal((await call('/api/session','GET',undefined,userCookie)).status,410);
 });
 await check('requests are private and invitations can be replaced and revoked',async()=>{
  for(const email of [user.email,'unknown@example.com'])assert.equal((await call('/api/password-reset-requests','POST',{email})).status,201);
  assert.equal((await call('/api/access-requests','POST',{email:'new@example.com',name:'New Fellow'})).status,410);
  assert.equal((await call('/api/admin/requests','GET',undefined,userCookie)).status,403);
  const created=await call('/api/admin/people','POST',{email:'new@example.com',name:'New Fellow'},ownerCookie);assert.equal(created.status,201);
  const token=new URL(created.data.activationUrl).hash.slice(10);
  const replacement=await call('/api/admin/invitations','POST',{id:created.data.person.id},ownerCookie);assert.equal(replacement.status,200);
  assert.equal((await call('/api/invitations/inspect','POST',{token})).status,404);
  assert.equal((await call('/api/admin/invitations','POST',{id:created.data.person.id,revoke:true},ownerCookie)).status,200);
  assert.equal((await call('/api/invitations/inspect','POST',{token:new URL(replacement.data.activationUrl).hash.slice(10)})).status,404);
 });
 await check('temporary reset revokes sessions and blocks account use until a private password is chosen',async()=>{
  assert.equal((await call('/api/admin/password','POST',{id:user.id,newPassword:nextPassword},ownerCookie)).status,200);
  assert.equal((await call('/api/identity','GET',undefined,userCookie)).data.account,null);
  userCookie=await login(user.email,nextPassword);
  assert.equal((await call('/api/identity','GET',undefined,userCookie)).data.account.mustChangePassword,true);
  assert.equal((await call('/api/studies','GET',undefined,userCookie)).status,403);
  assert.equal((await call('/api/account/password','POST',{currentPassword:'wrong password',newPassword:initialPassword},userCookie)).status,400);
  assert.equal((await call('/api/account/password','POST',{currentPassword:nextPassword,newPassword:initialPassword},userCookie)).status,200);
  assert.equal((await call('/api/identity','GET',undefined,userCookie)).data.account.mustChangePassword,false);
  assert.equal((await call('/api/studies?id='+studyId,'GET',undefined,userCookie)).status,200);
 });
 await check('password changes revoke other sessions; disable, restore and role changes invalidate access',async()=>{
  const secondCookie=await login(user.email);
  assert.equal((await call('/api/account/password','POST',{currentPassword:initialPassword,newPassword:nextPassword},userCookie)).status,200);
  assert.equal((await call('/api/identity','GET',undefined,secondCookie)).data.account,null);
  assert.equal((await call('/api/admin/person','PATCH',{id:user.id,status:'disabled'},ownerCookie)).status,200);
  assert.equal((await call('/api/identity','GET',undefined,userCookie)).data.account,null);
  assert.equal((await call('/api/auth/sign-in/email','POST',{email:user.email,password:nextPassword})).status,403);
  assert.equal((await call('/api/admin/person','PATCH',{id:user.id,status:'active'},ownerCookie)).status,200);
  userCookie=await login(user.email,nextPassword);
  assert.equal((await call('/api/studies?id='+studyId,'GET',undefined,userCookie)).status,200);
  assert.equal((await call('/api/admin/person','PATCH',{id:other.id,role:'superuser'},ownerCookie)).status,200);
  assert.equal((await call('/api/identity','GET',undefined,otherCookie)).data.account,null);
  otherCookie=await login(other.email);
  assert.equal((await call('/api/admin/people','GET',undefined,otherCookie)).status,200);
  assert.equal((await call('/api/admin/person','PATCH',{id:owner.id,role:'user'},otherCookie)).status,403);
  assert.equal((await call('/api/studies','DELETE',{id:studyId},userCookie)).status,200);
  const events=await call('/api/admin/audit','GET',undefined,ownerCookie);assert.ok(events.data.events.length>10);
  assert.doesNotMatch(JSON.stringify(events.data),new RegExp(initialPassword+'|'+nextPassword+'|session_token|token_hash|password_hash'));
 });
 await check('rate limits and request size limits reject abuse',async()=>{
  const body={email:'rate-test@example.com',name:'Rate Test'};
  for(let i=0;i<5;i++)assert.equal((await call('/api/password-reset-requests','POST',body,'',{'CF-Connecting-IP':'198.51.100.1'})).status,201);
  assert.equal((await call('/api/password-reset-requests','POST',body,'',{'CF-Connecting-IP':'198.51.100.1'})).status,429);
  assert.equal((await call('/api/register','POST',{...body,note:'a'.repeat(20000)})).status,413);
  for(let i=0;i<5;i++)assert.equal((await call('/api/register','POST',{email:'signup@example.com',name:'Reserved User',password:initialPassword},'',{'CF-Connecting-IP':'198.51.100.2'})).status,409);
  assert.equal((await call('/api/register','POST',{email:'signup@example.com',name:'Reserved User',password:initialPassword},'',{'CF-Connecting-IP':'198.51.100.2'})).status,429);
 });
});
