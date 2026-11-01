'use strict';
// Offline viewport/zoom/fold regression; no real Firebase, mail or admin writes.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.HERO_TEST_ORIGIN||'http://127.0.0.1:8771';
const out=process.env.HERO_TEST_EVIDENCE||'/tmp/coar-responsive-hero';fs.mkdirSync(out,{recursive:true});
const sizes=[[600,600],[600,900],[700,700],[768,1024],[1024,768],[820,1180],[1180,820],[900,900],[1024,1024],[1199,900],[1200,1200],[320,568],[390,844],[1440,900],[1920,1080]];
const copy={en:'Thoughtfully selected skincare for a comfortable daily routine. ',kr:'매일 편안하게 사용할 수 있는 스킨케어 제품을 소개합니다. 자세한 정보를 끝까지 확인하세요. ',ja:'毎日のスキンケアに使いやすい商品を選びました。詳しい情報を最後までご確認ください。 ',zh:'精心挑选适合日常护理的护肤品，请阅读完整说明并查看商品信息。 ',es:'Cuidado de la piel seleccionado para tu rutina diaria. Consulta toda la información del producto. '};
const product={name:copy.kr.repeat(12),image:'images/dr-cpu-glutathione-capsule-cream.png',url:'https://coarfamily.myshopify.com/ko/products/dr-cpu-lacto-exosome-glutathione-capsule-cream',cta:'View product ›'};
const results=[];
const split=(w,h)=>w>=600&&(w<=1199||w/h<=1.2);
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],headless:true});
 for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(7000);let writes=0;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const req=route.request(),url=req.url();if(!['GET','HEAD'].includes(req.method())){writes++;return route.abort();}if(url.endsWith('/hero-products.json'))return route.fulfill({json:{version:1,section2:product,section3:product}});if(url.startsWith(origin+'/'))return route.continue();if(url.includes('flag-icons.min.css'))return route.fulfill({contentType:'text/css',body:'.fi{display:inline-block;width:1.333333em;line-height:1em}.fi:before{content:"\\00a0"}'});return route.abort();});
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.CoarHeroProducts?.getState().loaded);
  async function geometry(slot){return page.locator('#'+slot).evaluate(e=>{const box=x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};const text=e.querySelector('.section-text-overlay'),media=e.querySelector('video')||e.querySelector('.hero-visual'),headline=e.querySelector('.light-headline'),body=e.querySelector('.light-body');return {section:box(e),text:box(text),media:box(media),headline:box(headline),body:body&&box(body),position:getComputedStyle(text).position,transform:getComputedStyle(media).transform,vw:innerWidth,vh:innerHeight,scroll:document.documentElement.scrollWidth};});}
  function check(g,mode,label){assert.ok(g.text.x>=-.5&&g.text.right<=width+.5,'copy horizontal bounds '+label);assert.ok(g.scroll<=width+1,'page overflow '+label);if(mode){assert.equal(g.position,'relative',label);assert.ok(g.text.y>=g.media.bottom-.6,'copy overlaps media '+label);assert.ok(g.headline.y>=g.media.bottom-.6,'headline overlaps media '+label);assert.ok(g.headline.bottom<=g.text.bottom+.5,'headline clipped '+label);assert.ok(g.text.bottom<=g.section.bottom+.5,'section clips copy '+label);if(g.body?.height)assert.ok(g.body.y>=g.media.bottom-.5&&g.body.bottom<=g.text.bottom+.5,'body clipped '+label);}}
  for(const lang of Object.keys(copy)){
   await page.evaluate(lang=>setLang(lang),lang);await page.waitForTimeout(20);
   for(const slot of ['section2','section3']){
    let g=await geometry(slot);check(g,split(width,height),`${width}x${height}/${lang}/${slot}`);
    if(lang==='kr'&&slot==='section3'&&[700,820,1024,1180].includes(width)){await page.locator('#'+slot).evaluate(e=>e.scrollIntoView({behavior:'instant'}));await page.screenshot({path:path.join(out,`${width}x${height}-default.png`)});}
    if(split(width,height)){
     await page.locator('#'+slot+' .light-headline').evaluate((e,s)=>e.textContent=s,copy[lang].repeat(3));
     if(await page.locator('#'+slot+' .light-body').count())await page.locator('#'+slot+' .light-body').evaluate((e,s)=>e.textContent=s,copy[lang].repeat(9));
     g=await geometry(slot);check(g,true,`long ${width}/${lang}/${slot}`);
    }
    const trigger=page.locator('#'+slot+' .coar-hero-trigger');
    await trigger.evaluate(e=>{const r=e.getBoundingClientRect();scrollTo({top:scrollY+r.top-innerHeight*.4,behavior:'instant'});});await page.waitForTimeout(30);
    const beforeY=await page.evaluate(()=>scrollY),r=await trigger.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);await page.waitForTimeout(510);
    const surface=page.locator('#'+slot+' .coar-hero-surface');const b=await surface.boundingBox();
    assert.equal(await trigger.getAttribute('aria-expanded'),'true');assert.ok(b.x>=-.6&&b.x+b.width<=width+.6&&b.y>=-.6&&b.y+b.height<=height+.6,'open capsule bounds');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-beforeY)<1,'opening scroll jump');
    const panel=page.locator('#'+slot+' .coar-hero-panel');await panel.evaluate(e=>{e.scrollTop=e.scrollHeight;});const cta=await page.locator('#'+slot+' .coar-hero-cta').boundingBox(),pb=await panel.boundingBox();assert.ok(cta.y>=pb.y-.6&&cta.y+cta.height<=pb.y+pb.height+.6,'long product CTA unreachable');
    await page.keyboard.press('Escape');await page.waitForTimeout(500);assert.equal(await trigger.getAttribute('aria-expanded'),'false');
    if(split(width,height))check(await geometry(slot),true,'after open');
    results.push({width,height,lang,slot,split:split(width,height),naturalCopy:true,longCopyTested:split(width,height),openClose:true,longProductEnd:true,noScrollJump:true});
   }
  }
  assert.equal(writes,0);assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}x${height}`);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 }
 // Resize the SAME document through fold/unfold, landscape and narrow layouts.
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block'});const page=await context.newPage();const cdp=await context.newCDPSession(page);
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());await page.route('**/hero-products.json',r=>r.fulfill({json:{version:1,section2:product,section3:product}}));await page.goto(origin+'/');await page.waitForFunction(()=>window.CoarHeroProducts?.getState().loaded);
 for(const [width,height] of [[820,1180],[1180,820],[700,700],[390,844],[768,1024],[1024,768],[320,568],[1440,900]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  const heroHeight=await page.locator('body > section.hero').first().evaluate(e=>e.getBoundingClientRect().height);assert.ok(heroHeight>0,'first hero remains visible');
  const trigger=page.locator('#section3 .coar-hero-trigger');await trigger.evaluate(e=>{const r=e.getBoundingClientRect();scrollTo({top:scrollY+r.top-innerHeight*.4,behavior:'instant'});});await page.waitForTimeout(50);await trigger.tap();await page.waitForTimeout(520);await page.keyboard.press('Escape');await page.waitForTimeout(490);
  results.push({resizeTo:[width,height],firstHeroHeight:heroHeight,reopen:true});
 }
 // Pinch/page-scale emulation changes visualViewport, without UA model guessing.
 await page.setViewportSize({width:820,height:1180});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>visualViewport.scale)>1.9);assert.ok(!await page.locator('meta[name=viewport]').getAttribute('content').then(x=>/user-scalable=no|maximum-scale/.test(x)));await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
 // 200% desktop layout zoom equivalent: 1440x900 CSS viewport becomes 720x450.
 await page.setViewportSize({width:720,height:450});await page.waitForTimeout(100);assert.equal(await page.locator('#section3 .section-text-overlay').evaluate(e=>getComputedStyle(e).position),'relative');
 await page.locator('.subscription-nav').tap();assert.equal(await page.locator('#subscription-notice').evaluate(e=>e.open),true);await page.keyboard.press('Escape');await page.waitForFunction(()=>!history.state?.coarSubscriptionNotice);
 results.push({pageScale:2,zoomLayout:[720,450],subscriptionDialog:true});await context.close();await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS '+results.length+' cases');
})().catch(e=>{fs.writeFileSync(path.join(out,'partial.json'),JSON.stringify(results,null,2));console.error(e);process.exit(1);});
