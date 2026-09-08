import {ENGINE_VERSION} from '../src/engine/model.ts';
import {accountsAPI} from './accounts.js';
import {configured} from './auth.js';
import {HttpError,json} from './security.js';
import {studiesAPI} from './studies.js';
import {learningAPI} from './learning.js';
import legacy from './legacy-session.js';
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(url.hostname==='ep-lab-simulator.kippwjo.workers.dev'&&['GET','HEAD'].includes(request.method))return Response.redirect('https://app.epsimlab.com'+path+url.search,308);
  try{
   if(path==='/api/health')return json({app:'epsimlab',version:'0.5.0',engineVersion:ENGINE_VERSION,accounts:configured(env),storage:configured(env)||Boolean(env.DB&&env.RECORDINGS)});
   if(!path.startsWith('/api/')){
    const response=await env.ASSETS.fetch(request);const headers=new Headers(response.headers);
    headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','DENY');
    headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' blob:; worker-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    return new Response(response.body,{status:response.status,headers});
   }
   // The original optional bearer sync never held production data. It is unavailable once accounts are enabled.
   if(path==='/api/session')return configured(env)?json({error:'Sign in and use account studies.'},410):legacy.fetch(request,env);
   const response=path==='/api/learning/module-0'?await learningAPI(request,env):path==='/api/studies'?await studiesAPI(request,env):await accountsAPI(request,env,ctx);
   const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');
   return new Response(response.body,{status:response.status,headers});
  }catch(error){
   if(error instanceof HttpError)return json({error:error.message},error.status);
   // Never log request bodies, credential hashes, invitation tokens, or session cookies.
   console.error('EPSimLab API operation failed',{path});
   return json({error:'This operation could not be completed. Please try again.'},500);
  }
 }
};
