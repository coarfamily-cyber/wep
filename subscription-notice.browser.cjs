'use strict';
// Offline browser regression. Serve this checkout at 127.0.0.1:8769 first.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.SUBSCRIPTION_TEST_ORIGIN || 'http://127.0.0.1:8769';
const evidence = process.env.SUBSCRIPTION_EVIDENCE || '/tmp/coar-subscription-notice';
fs.mkdirSync(evidence, { recursive: true });
const results = [];
const words = { en: ['Subscribe', 'Subscriptions coming soon'], kr: ['구독', '이메일 구독 준비 중'], ja: ['購読', 'メール購読は準備中です'], zh: ['订阅', '邮件订阅正在准备中'], es: ['Suscribirse', 'Suscripciones próximamente'] };
function overlap(a,b) { return a.x < b.x+b.width-1 && a.x+a.width > b.x+1 && a.y < b.y+b.height-1 && a.y+a.height > b.y+1; }
(async () => {
 const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
 for (const width of [320,390,1440]) {
  const height = width===320 ? 568 : width===390 ? 844 : 900;
  const context = await browser.newContext({serviceWorkers:'block',viewport:{width,height},isMobile:width<769,hasTouch:width<769});
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  let writes=0, subscriptionRequests=0; const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=req.url();
   if(!['GET','HEAD'].includes(req.method())){writes++;return route.abort();}
   if(/script\.google|googleapis.*mail|\/subscription\//.test(url)){subscriptionRequests++;return route.abort();}
   if(url.startsWith(base+'/'))return route.continue();
   // Mirror flag-icons geometry so blocked external artwork cannot hide overlap.
   if(url.includes('flag-icons.min.css'))return route.fulfill({contentType:'text/css',body:'.fi{display:inline-block;width:1.333333em;line-height:1em;background:#556;}.fi:before{content:"\\00a0"}'});
   if(url.includes('firebaseio.com/products.json'))return route.fulfill({json:[{id:1,name_en:'Offline fixture',link:'https://www.buyma.com/item/133993659/'}]});
   if(url.includes('firebaseio.com/learnMoreProducts.json'))return route.fulfill({json:{}});
   return route.abort();
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.CoarHeroProducts?.getState().loaded);
  const dialog=page.locator('#subscription-notice'),nav=page.locator('.subscription-nav'),footer=page.locator('.subscription-contact');
  for(const [lang,[label,title]] of Object.entries(words)){
   await page.evaluate(lang=>setLang(lang),lang);
   await page.waitForFunction(label=>document.querySelector('.subscription-nav').getAttribute('aria-label')===label,label);
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   const b=await nav.boundingBox(),logo=await page.locator('.logo-wrapper').boundingBox();
   assert.ok(!overlap(b,logo),`logo overlap ${width}/${lang}: ${JSON.stringify({b,logo})}`);
   for(const flag of await page.locator('body > .lang-switcher .lang-btn').all()){
    if(await flag.isVisible())assert.ok(!overlap(b,await flag.boundingBox()),`flag overlap ${width}/${lang}`);
   }
   assert.ok(b.x>=0&&b.x+b.width<=width&&b.y>=0,'nav bounds');
   await nav.click(); await page.waitForFunction(()=>document.querySelector('dialog#subscription-notice').open);
   assert.equal(await dialog.locator('h2').textContent(),title);
   assert.equal(await dialog.locator('input,form,a[href]').count(),0);
   assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);
   for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);}
   const d=await dialog.boundingBox();assert.ok(d.x>=0&&d.x+d.width<=width+.5&&d.y>=0&&d.y+d.height<=height+.5);assert.ok(Math.abs(d.x-(width-d.width)/2)<1&&Math.abs(d.y-(height-d.height)/2)<1,'centered dialog');
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#subscription-notice').open&&!history.state?.coarSubscriptionNotice);
   assert.equal(await nav.evaluate(e=>document.activeElement===e),true);
   assert.equal(await page.locator('body').evaluate(e=>e.style.overflow),'');
   await nav.press('Enter');await page.waitForFunction(()=>document.querySelector('#subscription-notice').open);
   const outline=await dialog.locator('.subscription-close').evaluate(e=>getComputedStyle(e).outlineStyle);assert.equal(outline,'solid');
   await page.goBack();await page.waitForFunction(()=>!document.querySelector('#subscription-notice').open);
   assert.ok(page.url().startsWith(base+'/'));
   await nav.click();await dialog.locator('.subscription-dismiss').click();await page.waitForFunction(()=>!document.querySelector('#subscription-notice').open&&!history.state?.coarSubscriptionNotice);
   await footer.click();await page.waitForFunction(()=>document.querySelector('#subscription-notice').open);await dialog.locator('.subscription-close').click();await page.waitForFunction(()=>!document.querySelector('#subscription-notice').open&&!history.state?.coarSubscriptionNotice);
   assert.equal(await footer.evaluate(e=>document.activeElement===e),true);
   results.push({width,lang,noOverlap:true,localized:true,noForm:true,focusTrap:true,escape:true,keyboard:true,back:true,close:true,reopen:true,footer:true});
  }
  await page.evaluate(()=>{setLang('kr');scrollTo({top:0,behavior:'instant'});});
  await page.screenshot({path:path.join(evidence,`${width}-nav.png`)});
  await nav.click();await page.screenshot({path:path.join(evidence,`${width}-notice.png`)});
  if(width<769){await page.setViewportSize({width:height,height:width});await page.waitForTimeout(80);const d=await dialog.boundingBox();assert.ok(d.x>=0&&d.x+d.width<=height+.5&&d.y>=0&&d.y+d.height<=width+.5);await page.setViewportSize({width,height});}
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#subscription-notice').open&&!history.state?.coarSubscriptionNotice);
  // Background contact and capsule still behave after the notice releases focus/scroll.
  await page.locator('.section-strip .btn-primary').click();
  assert.equal(await page.locator('#support-toast').evaluate(e=>getComputedStyle(e).display!=='none'),true);
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.locator('.logo-wrapper').click({position:{x:80,y:55}});
  assert.equal(await page.locator('#loginModal').evaluate(e=>e.classList.contains('open')),true);
  await page.evaluate(()=>closeLoginModal());
  assert.equal(writes,0);assert.equal(subscriptionRequests,0);assert.deepEqual(errors,[]);
  results.push({width,rotation:width<769,contact:true,adminEntry:true,networkWrites:writes,subscriptionRequests,scriptErrors:errors});
  await context.close();
 }
 await browser.close();fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(results,null,2));console.log('PASS '+results.length+' browser cases');
})().catch(e=>{fs.writeFileSync(path.join(evidence,'partial.json'),JSON.stringify(results,null,2));console.error(e);process.exit(1);});
