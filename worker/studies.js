import {ENGINE_VERSION,isCompatibleSession,validCommand} from '../src/engine/model.ts';
import {actorFor,requireActor} from './auth.js';
import {checkMutation,fail,json,readJSON} from './security.js';
export function cleanStudy(session){
 const s=session?.snapshot;
 if(!isCompatibleSession(session?.engineVersion,s?.caseId)||!Number.isFinite(s?.now)||s.now<0||s.now>14400000||!Array.isArray(s.commands)||s.commands.length>1000||typeof session.title!=='string'||session.title.length>120)fail(400,'Unsupported study.');
 let previous=0;for(const c of s.commands){if(!c||!Number.isFinite(c.t)||c.t<previous||c.t>s.now||!validCommand(c,session.engineVersion))fail(400,'Invalid command history.');previous=c.t;}
 return {id:typeof session.id==='string'?session.id.slice(0,80):crypto.randomUUID(),title:session.title,engineVersion:session.engineVersion,savedAt:new Date().toISOString(),snapshot:{caseId:s.caseId,now:s.now,commands:s.commands},measurements:Array.isArray(session.measurements)?session.measurements.filter(m=>m&&typeof m.label==='string'&&m.label.length<100&&typeof m.channel==='string'&&m.channel.length<40&&Number.isFinite(m.start)&&Number.isFinite(m.end)).slice(0,100):[]};
}
export async function studiesAPI(request,env){
 checkMutation(request,env);const actor=requireActor(await actorFor(env,request)),url=new URL(request.url),id=url.searchParams.get('id');
 if(request.method==='GET'){
  if(id){const row=await env.DB.prepare('SELECT payload FROM account_studies WHERE id=? AND user_id=?').bind(id,actor.userId).first();if(!row)fail(404,'Study not found.');return json({study:JSON.parse(row.payload)});}
  const {results}=await env.DB.prepare('SELECT id,title,case_id,updated_at FROM account_studies WHERE user_id=? ORDER BY updated_at DESC LIMIT 100').bind(actor.userId).all();return json({studies:results});
 }
 if(request.method==='POST'){
  const study=cleanStudy(await readJSON(request,131072)),id=crypto.randomUUID();study.id=id;
  const result=await env.DB.prepare('INSERT INTO account_studies(id,user_id,title,case_id,payload,updated_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM account_studies WHERE user_id=?)<100').bind(id,actor.userId,study.title,study.snapshot.caseId,JSON.stringify(study),Date.now(),actor.userId).run();
  if(!result.meta.changes)fail(409,'Your account has 100 saved studies. Remove an older one before saving another.');
  return json({saved:true,study},201);
 }
 if(request.method==='DELETE'){
  const body=await readJSON(request);if(typeof body.id!=='string')fail(400,'Choose a saved study.');const result=await env.DB.prepare('DELETE FROM account_studies WHERE id=? AND user_id=?').bind(body.id,actor.userId).run();if(!result.meta.changes)fail(404,'Study not found.');return json({deleted:true});
 }
 fail(405,'Method not allowed.');
}
