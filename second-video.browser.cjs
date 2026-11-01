'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.INTRO_TEST_ORIGIN||'http://127.0.0.1:8777',out=process.env.SECOND_EVIDENCE||'/workspace/second-box-evidence';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),results=[];
for(const [w,h] of [[320,568],[390,844],[700,700],[820,1180],[1180,820],[1440,900]]){
 const c=await browser.newContext({viewport:{width:w,height:h},hasTouch:true,isMobile:w<1025,serviceWorkers:'block'}),p=await c.newPage();let writes=0;
 await p.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){writes++;return r.abort();}return r.request().url().startsWith(base+'/')?r.continue():r.abort();});
 await p.goto(base+'/');p.setDefaultTimeout(6000);const root=p.locator('#section2'),v=p.locator('#section2-video');
 await p.evaluate(()=>document.getElementById('section2').scrollIntoView({behavior:'instant'}));await p.waitForFunction(()=>!document.getElementById('section2-video').paused);await p.waitForTimeout(200);
 const tap=async()=>{const r=await root.boundingBox();const x=w*.2,y=Math.max(0,r.y)+(Math.min(h,r.y+r.height)-Math.max(0,r.y))*.4;await p.touchscreen.tap(x,y);};
 assert.equal(await v.evaluate(e=>e.muted&&e.playsInline&&e.loop&&e.autoplay),true);const t=await v.evaluate(e=>e.currentTime);await p.waitForTimeout(150);assert.ok(await v.evaluate(e=>e.currentTime)>t);
 await tap();await p.waitForFunction(()=>document.getElementById('section2-video').paused);assert.equal(await v.evaluate(e=>e.muted),true);await tap();await p.waitForFunction(()=>!document.getElementById('section2-video').paused);
 await root.focus();await p.keyboard.press('Enter');assert.equal(await v.evaluate(e=>e.paused),true);let y=await p.evaluate(()=>scrollY);await p.keyboard.press('Space');await p.waitForFunction(()=>!document.getElementById('section2-video').paused);assert.equal(await p.evaluate(()=>scrollY),y);assert.equal(await root.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
 await p.mouse.move(w*.7,h*.3);await p.mouse.down();await p.mouse.move(w*.7-80,h*.3+20);await p.mouse.move(w*.7,h*.3);await p.mouse.up();assert.equal(await v.evaluate(e=>e.paused),false);
 await p.locator('#sound-btn').evaluate(e=>e.click());assert.equal(await v.evaluate(e=>e.paused),false);assert.equal(await v.evaluate(e=>e.muted),false);await p.locator('#sound-btn').evaluate(e=>e.click());
 await p.locator('#section2 .section-copy').evaluate(e=>e.click());assert.equal(await v.evaluate(e=>e.paused),false);
 for(const lang of ['en','kr','ja','zh','es']){await p.evaluate(l=>setLang(l),lang);await p.waitForTimeout(30);assert.ok((await root.getAttribute('aria-label')).length>0);assert.equal(await v.evaluate(e=>e.paused),false);}
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await v.evaluate(e=>e.paused),true);await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(()=>!document.getElementById('section2-video').paused);
 await tap();await p.waitForFunction(()=>document.getElementById('section2-video').paused);await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(200);await p.evaluate(()=>document.getElementById('section2').scrollIntoView({behavior:'instant'}));await p.waitForTimeout(200);assert.equal(await v.evaluate(e=>e.paused),true);await tap();await p.waitForFunction(()=>!document.getElementById('section2-video').paused);
 await p.setViewportSize({width:h,height:w});await p.waitForTimeout(200);await p.evaluate(()=>document.getElementById('section2').scrollIntoView({behavior:'instant'}));await p.waitForFunction(()=>!document.getElementById('section2-video').paused);
 await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.getElementById('section2-video').paused);assert.equal(await root.getAttribute('role'),null);await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForFunction(()=>!document.getElementById('section2-video').paused);
 assert.equal(writes,0);results.push({w,h,tap:true,muted:true,keyboard:true,childExcluded:true,dragExcluded:true,visibility:true,manualPauseRetained:true,rotation:true,languages:5,reducedMotion:true,writes});await c.close();
}
await browser.close();fs.writeFileSync(out+'/second-results.json',JSON.stringify(results,null,2));console.log('PASS '+results.length+' second video cases');})().catch(e=>{console.error(e);process.exit(1)});
