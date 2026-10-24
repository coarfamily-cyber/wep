const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = __dirname;
const baseline = cp.execFileSync('git', ['show', '41cb39136c68c229733675a01d5fe3ce045edbf0:index.html'], {cwd:root, encoding:'utf8'}).replace(/\r\n/g,'\n');
const current = fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n');
function catalog(s) {return s.match(/  <!-- ⑦ Catalog Grid -->[\s\S]*?(?=  <footer|  <!-- ⑧|  <!-- Footer)/)?.[0]}
function scripts(s) {return [...s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1].trim()).filter(Boolean).map(x=>x.replace(/^[ \t]*if \(window\.CoarHeroProducts\) window\.CoarHeroProducts\.syncAdminUI\(on\);\n/gm,'')).join('\n')}
test('Full Catalog markup remains byte-equivalent',()=>{assert.ok(catalog(baseline));assert.ok(catalog(current)===catalog(baseline),'Catalog changed')});
test('Existing inline logic remains unchanged apart from admin UI hook',()=>{assert.ok(scripts(current)===scripts(baseline),'Existing inline scripts changed')});
test('Exactly two independently keyed hero controls',()=>{assert.equal((current.match(/data-hero-product-slot="section[23]"/g)||[]).length,2);assert.ok(current.includes('id="section2-learn-more"'));assert.ok(current.includes('id="section3-learn-more"'));assert.ok(current.includes('id="section3"'))});
test('New feature cannot mutate Catalog storage or styles',()=>{const js=fs.readFileSync(path.join(root,'hero-products.js'),'utf8');assert.ok(!/\bsaveProducts\s*\(/.test(js));assert.ok(!/['"]\/products\.json/.test(js));const css=fs.readFileSync(path.join(root,'hero-products.css'),'utf8');assert.ok(!/#catalog|\.catalog-items|\.catalog-item/.test(css))});
test('Third slot is not filled with an arbitrary product',()=>{const config=JSON.parse(fs.readFileSync(path.join(root,'hero-products.json'),'utf8'));assert.equal(config.section3,null);assert.equal(config.section2.url,'https://coarfamily.myshopify.com/ko/products/dr-cpu-lacto-exosome-glutathione-capsule-cream')});
