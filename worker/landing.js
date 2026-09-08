export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.hostname==='www.epsimlab.com')return Response.redirect('https://epsimlab.com'+url.pathname+url.search,308);
  const response=await env.ASSETS.fetch(request);
  const headers=new Headers(response.headers);
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Referrer-Policy','no-referrer');
  headers.set('Content-Security-Policy',"default-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'");
  headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  return new Response(response.body,{status:response.status,headers});
 }
};
