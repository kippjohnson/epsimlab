import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
let html=await readFile('dist/index.html','utf8');
for(const m of [...html.matchAll(/<script[^>]+src="([^\"]+)"[^>]*><\/script>/g)]){const js=await readFile('dist/'+m[1].replace(/^\.\//,''),'utf8');html=html.replace(m[0],()=>'<script type="module">'+js.replace(/<\/script/gi,'<\\/script')+'</script>');}
for(const m of [...html.matchAll(/<link[^>]+href="([^\"]+\.css)"[^>]*>/g)]){const css=await readFile('dist/'+m[1].replace(/^\.\//,''),'utf8');html=html.replace(m[0],()=>'<style>'+css+'</style>');}
html=html.replace(/<link[^>]+(?:manifest|icon)[^>]*>/g,'');
await mkdir('release',{recursive:true});await writeFile('release/ep-lab.html',html);
console.log('Standalone app: release/ep-lab.html');

const assets=(await readdir('dist/assets')).map(x=>'./assets/'+x);
const version='ep-lab-'+assets.join('-');
const sw=`const CACHE=${JSON.stringify(version)};const FILES=${JSON.stringify(['./','./index.html','./icon.svg','./manifest.webmanifest',...assets])};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ep-lab-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));return;}e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));});`;
await writeFile('dist/sw.js',sw);
