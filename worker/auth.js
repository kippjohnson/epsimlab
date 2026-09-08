import {APIError,betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {drizzle} from 'drizzle-orm/d1';
import * as schema from './auth-schema.js';
import {cookie,fail,sha256,trustedOrigins} from './security.js';
export function configured(env){return Boolean(env.DB&&env.BETTER_AUTH_URL&&env.BETTER_AUTH_SECRET?.length>=32);}
export function createAuth(env){
 if(!configured(env))fail(503,'Accounts are not configured on this instance.');
 return betterAuth({
  appName:'EPSimLab',baseURL:env.BETTER_AUTH_URL,secret:env.BETTER_AUTH_SECRET,trustedOrigins:trustedOrigins(env),
  database:drizzleAdapter(drizzle(env.DB),{provider:'sqlite',schema}),
  emailAndPassword:{enabled:true,disableSignUp:true,minPasswordLength:12,maxPasswordLength:128},
  session:{expiresIn:60*60*24*14,updateAge:60*60*24,cookieCache:{enabled:false}},
  advanced:{cookiePrefix:'ep-lab',useSecureCookies:new URL(env.BETTER_AUTH_URL).protocol==='https:',ipAddress:{ipAddressHeaders:['cf-connecting-ip']}},
  rateLimit:{enabled:true,storage:'database',window:60,max:20},
  databaseHooks:{session:{create:{before:async session=>{
   const person=await env.DB.prepare("SELECT id FROM people WHERE user_id=? AND status='active'").bind(session.userId).first();
   if(!person)throw new APIError('FORBIDDEN',{message:'This account does not have active access.'});
   return {data:session};
  }}}}
 });
}
export const publicPerson=p=>({id:p.id,userId:p.user_id,name:p.name,email:p.email,phone:p.phone,role:p.role,status:p.status,owner:Boolean(p.owner),mustChangePassword:Boolean(p.must_change_password),createdAt:p.created_at});
export function previewCookie(request,value,age){const secure=new URL(request.url).protocol==='https:'?'; Secure':'';return `ep-lab-preview=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure}`;}
export async function actorFor(env,request){
 if(!configured(env))return null;
 const session=await createAuth(env).api.getSession({headers:request.headers,query:{disableCookieCache:true}});
 if(!session?.user)return null;
 const person=await env.DB.prepare("SELECT * FROM people WHERE user_id=? AND status='active'").bind(session.user.id).first();
 if(!person)return null;
 const token=cookie(request,'ep-lab-preview');
 const preview=person.role==='superuser'&&token?await env.DB.prepare('SELECT token_hash FROM role_previews WHERE token_hash=? AND user_id=? AND session_id=? AND expires_at>?').bind(await sha256(token),session.user.id,session.session.id,Date.now()).first():null;
 return {person:publicPerson(person),userId:session.user.id,sessionId:session.session.id,previewing:Boolean(preview),role:preview?'user':person.role};
}
export function requireActor(actor,{passwordChange=false}={}){
 if(!actor)fail(401,'Sign in to continue.');
 if(actor.person.mustChangePassword&&!passwordChange)fail(403,'Choose a new password before continuing.');
 return actor;
}
export function requireSuperuser(actor){requireActor(actor);if(actor.role!=='superuser'||actor.previewing)fail(403,'Superuser access is required.');return actor;}
