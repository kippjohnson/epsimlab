import {MODULE_ZERO_VERSION,cleanFoundationAnswers,completedLessons} from '../src/module0.ts';
import {actorFor,requireActor} from './auth.js';
import {checkMutation,fail,json,readJSON} from './security.js';
export async function learningAPI(request,env){
 checkMutation(request,env);
 const actor=requireActor(await actorFor(env,request));
 if(request.method==='GET'){
  const row=await env.DB.prepare('SELECT version,answers,updated_at FROM learning_progress WHERE user_id=? AND module_id=?').bind(actor.userId,'module-0').first();
  const answers=row?.version===MODULE_ZERO_VERSION?cleanFoundationAnswers(JSON.parse(row.answers))??{}:{};
  return json({version:MODULE_ZERO_VERSION,answers,completed:completedLessons(answers),updatedAt:row?.updated_at??null});
 }
 if(request.method==='PUT'){
  const body=await readJSON(request,4096),answers=cleanFoundationAnswers(body.answers);
  if(body.version!==MODULE_ZERO_VERSION||!answers)fail(400,'Unsupported learning progress. Refresh the page and try again.');
  const updatedAt=Date.now();
  await env.DB.prepare('INSERT INTO learning_progress(user_id,module_id,version,answers,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,module_id) DO UPDATE SET version=excluded.version,answers=excluded.answers,updated_at=excluded.updated_at').bind(actor.userId,'module-0',MODULE_ZERO_VERSION,JSON.stringify(answers),updatedAt).run();
  return json({saved:true,version:MODULE_ZERO_VERSION,completed:completedLessons(answers),updatedAt});
 }
 fail(405,'Method not allowed.');
}
