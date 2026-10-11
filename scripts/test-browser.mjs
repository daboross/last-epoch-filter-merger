import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import '../extension/core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const executablePath=process.env.MERGER_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const extension=path.join(root,'dist/chromium');
const profile=fs.mkdtempSync(path.join(tmpdir(),'le-merger-test-'));
const context=await chromium.launchPersistentContext(profile,{executablePath,headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],acceptDownloads:true});
const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
// No live website requests are allowed, including incidental favicon requests.
await context.route(/^https?:/,route=>route.abort());
function filter(name,types){return `<ItemFilter xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><name>${name}</name><lastModifiedInVersion>1.5.2.2</lastModifiedInVersion><lootFilterVersion>9</lootFilterVersion><rules>${types.map((type,i)=>`<Rule><type>${type}</type><conditions/><isEnabled>true</isEnabled><recolor>true</recolor><color>${i+4}</color><nameOverride>${name}${i}</nameOverride><Order>${i}</Order></Rule>`).reverse().join('')}</rules></ItemFilter>`;}
const a=filter('A',['SHOW','HIDE']),b=filter('B',['SHOW','HIDE','SHOW']);
try {
  // Run the actual packaged workbench in a browser, including file reads/downloads.
  const page=await context.newPage();
  await page.goto('file:///'+path.join(root,'extension/index.html').replaceAll('\\','/'));
  await page.locator('#fileA').setInputFiles({name:'a.xml',mimeType:'application/xml',buffer:Buffer.from(a)});
  await page.locator('#fileB').setInputFiles({name:'b.xml',mimeType:'application/xml',buffer:Buffer.from(b)});
  await page.locator('#name').fill('Browser smoke test');await page.locator('#merge').click();
  await page.locator('#resultTitle').filter({hasText:'5/200'}).waitFor();
  const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadPromise;
  const doc=LEMerge.parse(fs.readFileSync(await download.path(),'utf8'),{DOMParser,XMLSerializer});
  assert.deepEqual(doc.rules.map(r=>LEMerge.value(r.node,'nameOverride')),['A0','B0','B1','B2','A1']);
  assert.deepEqual(doc.rules.map(r=>LEMerge.value(r.node,'color')),['4','4','5','6','5']);
  await page.locator('#mode').selectOption('concat');assert.equal(await page.locator('#result').isVisible(),false);
  await page.locator('#merge').click();await page.locator('#preview').waitFor({state:'attached'});
  assert.match(await page.locator('#preview').textContent(),/"deferredHides": 0/);
  await page.locator('#xmlB').fill('<broken>');await page.locator('#merge').click();assert.match(await page.locator('#status').textContent(),/Invalid ItemFilter/);assert.equal(await page.locator('#result').isVisible(),false);
  await page.screenshot({path:path.join(root,'artifacts/browser-validation.png'),fullPage:true});
  console.log('PASS: real browser workbench file inputs, merge order, unchanged colors, XML download, concat, stale-result invalidation and invalid XML.');
  // Exercise packaged extension with a deterministic site fixture, not the production account.
  let worker=context.serviceWorkers()[0];
  if(!worker){try{worker=await context.waitForEvent('serviceworker',{timeout:5000});}catch{}}
  if(worker){
    const id=new URL(worker.url()).host;
    await context.route('https://www.lastepochtools.com/loot-filters/view/test*',route=>route.fulfill({contentType:'text/html',body:`<html><body><div id="export">Export</div><input id="loot-filter-import" type="file"><div id="imported"></div><script>document.getElementById('export').onclick=()=>{const e=document.createElement('div');e.textContent='Copy To Clipboard';e.onclick=()=>{const t=document.createElement('textarea');t.value=${JSON.stringify(a)};document.body.append(t);t.remove();};document.body.append(e);};document.getElementById('loot-filter-import').onchange=async function(){document.getElementById('imported').textContent=await this.files[0].text();};</script></body></html>`}));
    const site=await context.newPage();await site.goto('https://www.lastepochtools.com/loot-filters/view/test');
    const workbench=await context.newPage();await workbench.goto(`chrome-extension://${id}/index.html`);
    await workbench.locator('#captureA').click();await workbench.locator('#summaryA').filter({hasText:'2 rules'}).waitFor();
    await workbench.locator('#xmlB').fill(b);await workbench.locator('#merge').click();
    await workbench.locator('#stage').click();await site.locator('#imported').filter({hasText:'ItemFilter'}).waitFor();
    const staged=LEMerge.parse(await site.locator('#imported').textContent(),{DOMParser});assert.equal(staged.rules.length,5);
    console.log('PASS: loaded Chromium extension, host-scoped content script, site-tab discovery, export capture, storage and import file transfer.');
  } else {console.log('LIMITATION: installed browser did not load unpacked extensions in headless mode; adapter unit tests ran separately.');}
  // Run the distributed userscript with a local GM storage shim, without Tampermonkey or a live site.
  await context.route('https://www.lastepochtools.com/loot-filters/view/userscript-fixture',route=>route.fulfill({contentType:'text/html',body:'<input id="loot-filter-import" type="file"><div id="imported"></div><script>document.querySelector("input").onchange=async function(){document.getElementById("imported").textContent=await this.files[0].text();};</script>'}));
  const userpage=await context.newPage();await userpage.goto('https://www.lastepochtools.com/loot-filters/view/userscript-fixture');
  await userpage.evaluate(()=>{const store=new Map();window.GM_getValue=(k,f)=>store.get(k)??f;window.GM_setValue=(k,v)=>store.set(k,v);window.GM_registerMenuCommand=()=>{};});
  await userpage.addScriptTag({path:path.join(root,'last-epoch-filter-merger.user.js')});
  await userpage.locator('#launcher').click();
  await userpage.locator('#fileA').setInputFiles({name:'a.xml',mimeType:'application/xml',buffer:Buffer.from(a)});
  await userpage.locator('#summaryA').filter({hasText:'2 rules'}).waitFor();
  await userpage.locator('#fileB').setInputFiles({name:'b.xml',mimeType:'application/xml',buffer:Buffer.from(b)});
  await userpage.locator('#summaryB').filter({hasText:'3 rules'}).waitFor();
  await userpage.locator('#merge').click();assert.equal(await userpage.locator('#count').textContent(),'5/200 rules');
  const ud=userpage.waitForEvent('download');await userpage.locator('#download').click();
  const up=LEMerge.parse(fs.readFileSync(await (await ud).path(),'utf8'),{DOMParser});
  assert.deepEqual(up.rules.map(r=>LEMerge.value(r.node,'color')),['4','4','5','6','5']);
  await userpage.locator('#import').click();await userpage.locator('#imported').filter({hasText:'ItemFilter'}).waitFor();
  assert.equal(LEMerge.parse(await userpage.locator('#imported').textContent(),{DOMParser}).rules.length,5);
  await userpage.screenshot({path:path.join(root,'artifacts/userscript-validation.png'),fullPage:true});
  console.log('PASS: distributed userscript shadow UI, file loading, automatic hide ordering, unchanged colors, XML download and mock import.');
  assert.deepEqual(errors,[]);
} finally {await context.close();}
