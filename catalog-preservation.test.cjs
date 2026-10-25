const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const vm = require('node:vm');
const root = __dirname;
const baseline = cp.execFileSync('git', ['show', '41cb39136c68c229733675a01d5fe3ce045edbf0:index.html'], {cwd:root, encoding:'utf8'}).replace(/\r\n/g,'\n');
const current = fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n');
function catalog(s) {return s.match(/  <!-- ⑦ Catalog Grid -->[\s\S]*?(?=  <footer|  <!-- ⑧|  <!-- Footer)/)?.[0]}
const copyKeys = new Set(['hero-headline','hero-subtext','s2-eyebrow','s2-headline','s2-body','s2-learn','s3-eyebrow','s3-learn','cta-headline','cta-body','cta-btn','footer-copy']);
const dictPattern = /var i18nData = (\{[\s\S]*?^    \});/m;
function scripts(s) {return [...s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1].trim()).filter(Boolean).map(x=>x.replace(/^[ \t]*\/\/ BEGIN reviewed purchase-link handling\n[\s\S]*?^[ \t]*\/\/ END reviewed purchase-link handling\n/gm,'').replace(/^[ \t]*if \(window\.CoarHeroProducts\) window\.CoarHeroProducts\.syncAdminUI\(on\);\n/gm,'').replace(/^[ \t]*if \(window\.CoarHeroProducts && window\.CoarHeroProducts\.setLanguage\) window\.CoarHeroProducts\.setLanguage\(lang\);\n/gm,'').replace(dictPattern,'/* reviewed brand copy */')).join('\n')}
function dictionary(s) {const m=s.match(dictPattern);assert.ok(m,'i18n dictionary exists');return JSON.parse(JSON.stringify(vm.runInNewContext('('+m[1]+')',Object.create(null),{timeout:100})))}
test('Full Catalog markup remains byte-equivalent',()=>{assert.ok(catalog(baseline));assert.ok(catalog(current)===catalog(baseline),'Catalog changed')});
test('Existing inline logic unchanged apart from two feature UI hooks and reviewed copy',()=>{assert.ok(scripts(current)===scripts(baseline),'Existing inline logic changed')});
test('Catalog translations and all non-copy dictionary values remain unchanged',()=>{const old=dictionary(baseline),now=dictionary(current);assert.deepEqual(Object.keys(now).sort(),Object.keys(old).sort());for(const lang of Object.keys(old)){for(const [key,value] of Object.entries(old[lang])){if(!copyKeys.has(key))assert.equal(now[lang][key],value,lang+':'+key)}for(const [key,value] of Object.entries(now[lang])){assert.equal(typeof value,'string');assert.ok(key in old[lang]||copyKeys.has(key),'Unexpected translation key')}}});
test('Exactly two independently keyed hero controls',()=>{assert.equal((current.match(/data-hero-product-slot="section[23]"/g)||[]).length,2);assert.ok(current.includes('id="section2-learn-more"'));assert.ok(current.includes('id="section3-learn-more"'));assert.ok(current.includes('id="section3"'))});
test('New feature cannot mutate Catalog storage or styles',()=>{const js=fs.readFileSync(path.join(root,'hero-products.js'),'utf8');assert.ok(!/\bsaveProducts\s*\(/.test(js));assert.ok(!/['"]\/products\.json/.test(js));const css=fs.readFileSync(path.join(root,'hero-products.css'),'utf8');assert.ok(!/#catalog|\.catalog-items|\.catalog-item/.test(css))});
test('Third slot is not filled with an arbitrary product',()=>{const config=JSON.parse(fs.readFileSync(path.join(root,'hero-products.json'),'utf8'));assert.equal(config.section3,null);assert.equal(config.section2.url,'https://coarfamily.myshopify.com/ko/products/dr-cpu-lacto-exosome-glutathione-capsule-cream')});
