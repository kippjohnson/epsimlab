import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../worker/index.js';
import landing from '../worker/landing.js';

test('the simulator stays public and the old address redirects to the app domain',async()=>{
 const ASSETS={fetch:async()=>new Response('<main>Simulator</main>')};
 const r=await app.fetch(new Request('https://app.epsimlab.com/'),{ASSETS});
 assert.equal(r.status,200);assert.match(await r.text(),/Simulator/);
 const old=await app.fetch(new Request('https://ep-lab-simulator.kippwjo.workers.dev/?case=avnrt-01'),{ASSETS});
 assert.equal(old.status,308);assert.equal(old.headers.get('Location'),'https://app.epsimlab.com/?case=avnrt-01');
 assert.equal((await app.fetch(new Request('https://app.epsimlab.com/api/identity'),{})).status,200);
});

test('the landing page is separate from the simulator and www uses the canonical domain',async()=>{
 const env={ASSETS:{fetch:async()=>new Response('<h1>Practice an EP study.</h1>')}};
 const r=await landing.fetch(new Request('https://epsimlab.com/'),env);
 assert.equal(r.status,200);assert.match(await r.text(),/Practice an EP study/);
 assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
 const www=await landing.fetch(new Request('https://www.epsimlab.com/'),env);
 assert.equal(www.status,308);assert.equal(www.headers.get('Location'),'https://epsimlab.com/');
});
