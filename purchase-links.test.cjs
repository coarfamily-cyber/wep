const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const hero = require('./hero-products.js');
const html = fs.readFileSync('index.html', 'utf8');
const preview = 'https://y1kj9970blrpbwfp-82748997889.shopifypreview.com/products_preview?preview_key=6b708ac7c2b4c77ddc8f8cca958505d6';
const oldScrub = 'https://4pxh8fi9nrmobxcj-82748997889.shopifypreview.com/products_preview?preview_key=cd49d55fa1331f7d20368b3134c59c4f';
const scrub = 'https://coarfamily.myshopify.com/products/plu365-body-scrub-100-g-raspberry';

test('only the verified Raspberry identity and legacy URL are remapped', () => {
  const record = {name: 'Plu365 Body Scrub 100 g - Raspberry', url: oldScrub};
  assert.equal(hero.normalizeRecord(record).product.url, scrub);
  assert.equal(record.url, oldScrub);
  assert.equal(hero.normalizeRecord({...record, name:'Another product'}).product.url, oldScrub);
  assert.equal(hero.normalizeRecord({...record, url:preview}).product.url, preview);
  assert.equal(hero.normalizeRecord({...record, url:scrub}).product.url, scrub);
});

function render(lang) {
  const products = [
    {name:'Hydrating Ampoule 30ml PDRN Serum', link:preview},
    {name:'Earth Hinoki Body Wash', link:preview},
    ...['133993659','133950766','133935153'].map(id=>({name:id,link:'https://www.buyma.com/item/'+id+'/'}))
  ];
  const before = JSON.stringify(products);
  const cards = [];
  const staticCards = Array.from({length:5},()=>({label:null, querySelector(){return this.label}, prepend(label){this.label=label}}));
  const container = {innerHTML:'',insertAdjacentHTML(_,markup){
    const card={markup,labels:[],querySelector(){return {prepend:label=>card.labels.push(label)}}};
    cards.push(card);this.lastElementChild=card;
  }};
  const document = {getElementById:()=>container,createElement:()=>({className:'',textContent:''}),querySelectorAll:()=>staticCards};
  const code = html.slice(html.indexOf('    function renderCustomProducts()'),html.indexOf('    // 모바일 도트 인디케이터',html.indexOf('    function renderCustomProducts()')));
  assert.ok(code.includes('function renderCustomProducts'));
  vm.runInNewContext(code+';renderCustomProducts();', {window:{_currentLang:lang}, document, URL, getProducts:()=>products,isAdmin:()=>false});
  assert.equal(JSON.stringify(products),before,'stored multilingual product records must remain intact');
  return {cards,staticCards};
}

test('unverified previews become non-links; all other sellers remain linked and labeled',()=>{
  const {cards,staticCards}=render('en');
  for(const card of cards.slice(0,2)) {
    assert.ok(card.markup.startsWith('<div '));
    assert.ok(!card.markup.includes('href='));
    assert.equal(card.labels[0].textContent,'Purchase link pending verification');
  }
  cards.slice(2).forEach((card,i)=>{
    assert.ok(card.markup.includes('href="https://www.buyma.com/item/'+['133993659','133950766','133935153'][i]+'/"'));
    assert.equal(card.labels[0].textContent,'BUYMA');
  });
  assert.ok(staticCards.every(card=>card.label.textContent==='Etsy'));
});

test('pending-link notice follows every existing site language',()=>{
  for(const [lang,text] of Object.entries({en:'Purchase link pending verification',ko:'구매 링크 확인 중',ja:'購入リンク確認中',zh:'购买链接待确认',es:'Enlace de compra pendiente de verificar'})) {
    assert.equal(render(lang).cards[0].labels[0].textContent,text);
  }
});

test('footer destinations are real policy pages and an existing introduction section',()=>{
  assert.match(html, /href="#section2" data-i18n="footer-about"/);
  assert.match(html, /id="section2"/);
  assert.match(html, /href="https:\/\/coarfamily.myshopify.com\/policies\/privacy-policy" data-i18n="footer-privacy"/);
  assert.match(html, /href="https:\/\/coarfamily.myshopify.com\/policies\/terms-of-service" data-i18n="footer-terms"/);
  assert.match(html, /href="#" id="support-btn"/);
});
