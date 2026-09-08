// Optional browser smoke test. Install: npm install --no-save playwright && npx playwright install chromium
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1512,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(resolve('release/ep-lab.html')).href);
 await page.getByRole('button',{name:'Deliver pacing train'}).waitFor();
 await page.getByLabel('Dismiss tip').click();await page.waitForTimeout(1500);
 await page.getByRole('button',{name:'Deliver pacing train'}).click();
 await page.waitForTimeout(7500);
 assert.match(await page.locator('.rhythm-card').innerText(),/190/,'Induction produces the expected rate');
 await page.getByRole('button',{name:'Freeze',exact:true}).click();
 assert.equal(await page.locator('.review-panel').count(),1);
 await page.getByRole('button',{name:'Calipers',exact:true}).click();
 const box=await page.locator('.recording-panel canvas').boundingBox();
 await page.mouse.move(box.x+box.width*.35,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.45);await page.mouse.up();
 assert.equal(await page.locator('.measurement-row').count(),1);
 await page.getByRole('button',{name:'Save study',exact:true}).click();
 await page.waitForTimeout(500);await page.getByLabel('Saved studies',{exact:true}).click();
 assert.ok(await page.locator('dialog .case-choice').count());
 await page.getByLabel('Close dialog').click();
 await page.getByRole('button',{name:'Commit diagnosis',exact:true}).click();
 await page.getByRole('button',{name:'AV nodal reentrant tachycardia Slow–fast AVNRT'}).click();
 await page.getByLabel('Short VA interval during sustained tachycardia').check();
 await page.locator('dialog').getByRole('button',{name:'Commit diagnosis',exact:true}).click();
 assert.match(await page.locator('.result-box').innerText(),/diagnosis is supported/);
 await page.getByRole('button',{name:'Explore the mechanism'}).click();
 await mkdir('qa',{recursive:true});await page.screenshot({path:'qa/desktop.png',fullPage:true});
 for(const width of [1024,768,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No horizontal overflow at ${width}`);await page.screenshot({path:`qa/viewport-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:1512,height:1100});await page.getByRole('button',{name:'Replay my maneuvers'}).click();await page.waitForTimeout(1500);assert.match(await page.locator('.recording-header').innerText(),/REPLAY/);
 assert.deepEqual(errors,[]);console.log('Browser smoke checks passed.');
} finally {await browser.close();}
