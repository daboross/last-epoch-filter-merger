import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM,ResourceLoader} from 'jsdom';
class Offline extends ResourceLoader { fetch(){throw Error('Tests must not access the network.');} }
const bundle=fs.readFileSync(new URL('../last-epoch-filter-merger.user.js',import.meta.url),'utf8');
const filter=(name,types)=>`<ItemFilter><name>${name}</name><lootFilterVersion>9</lootFilterVersion><rules>${types.map((t,i)=>`<Rule><type>${t}</type><conditions/><isEnabled>true</isEnabled><color>${i+6}</color><nameOverride>${name}${i}</nameOverride><Order>${i}</Order></Rule>`).reverse().join('')}</rules></ItemFilter>`;
const a=filter('A',['SHOW','HIDE']),b=filter('B',['SHOW','HIDE','SHOW']);
function page(store=new Map(),html='') {
  const dom=new JSDOM(html,{url:'https://www.lastepochtools.com/loot-filters/view/offline-fixture',runScripts:'outside-only',resources:new Offline()});
  const w=dom.window; w.GM_getValue=(key,fallback)=>store.get(key)??fallback; w.GM_setValue=(key,value)=>store.set(key,value); w.GM_registerMenuCommand=()=>{};
  w.Element.prototype.getClientRects=()=>[{}];w.eval(bundle);
  return {dom,w,root:w.document.getElementById('le-merger').shadowRoot,$:id=>w.document.getElementById('le-merger').shadowRoot.getElementById(id)};
}
async function open(p) {p.$('launcher').click();await new Promise(r=>setTimeout(r,0));}
function fill(p,id,value){p.$(id).value=value;p.$(id).dispatchEvent(new p.w.Event('input'));}
test('bundled userscript automatically defers hides and keeps colors',async()=>{
  const p=page(new Map([['sourceA',a],['sourceB',b]]));await open(p);p.$('merge').click();
  assert.equal(p.$('count').textContent,'5/200 rules');const report=JSON.parse(p.$('preview').textContent);
  assert.deepEqual(report.rules.map(r=>r.name),['A0','B0','B1','B2','A1']);assert.equal(report.sources[0].deferredHides,1);
  let downloaded; p.w.URL.createObjectURL=blob=>{downloaded=blob;return 'blob:test';};p.w.URL.revokeObjectURL=()=>{};p.w.HTMLAnchorElement.prototype.click=()=>{};
  p.$('download').click(); const xml=await new Promise(resolve=>{const r=new p.w.FileReader();r.onload=()=>resolve(r.result);r.readAsText(downloaded);});
  const parsed=p.w.LEMerge.parse(xml);assert.deepEqual(Array.from(parsed.rules,r=>p.w.LEMerge.value(r.node,'color')),['6','6','7','8','7']);p.w.close();
});
test('source storage survives navigation and edits invalidate a result',async()=>{
  const store=new Map();let p=page(store);await open(p);fill(p,'xmlA',a);fill(p,'xmlB',b);p.w.close();
  p=page(store);await open(p);assert.equal(p.$('xmlA').value,a);p.$('merge').click();assert.equal(p.$('result').hidden,false);
  fill(p,'name','Changed');assert.equal(p.$('result').hidden,true);p.$('merge').click();fill(p,'xmlB','<broken>');p.$('merge').click();assert.equal(p.$('result').hidden,true);assert.match(p.$('status').textContent,/Invalid/);p.w.close();
});
test('userscript captures a mock export into persistent source A',async()=>{
  const store=new Map();const p=page(store,'<button id="export">Export</button>');await open(p);
  p.w.document.getElementById('export').onclick=()=>{const btn=p.w.document.createElement('button');btn.textContent='Copy To Clipboard';btn.onclick=()=>{const t=p.w.document.createElement('textarea');t.value=a;p.w.document.body.append(t);t.remove();};p.w.document.body.append(btn);};
  await p.$('captureA').onclick();assert.equal(store.get('sourceA'),a);assert.equal(p.w.document.getElementById('le-merger').hidden,false);p.w.close();
});
test('userscript submits merged XML through a mock import file input',async()=>{
  const p=page(new Map([['sourceA',a],['sourceB',b]]),'<input id="loot-filter-import" type="file">');await open(p);p.$('merge').click();
  p.w.DataTransfer=class {constructor(){this.files=[];this.items={add:f=>this.files.push(f)};}};
  const input=p.w.document.querySelector('input');Object.defineProperty(input,'files',{value:[],writable:true});let changed=false;input.onchange=()=>{changed=true;};
  await p.$('import').onclick();assert.equal(changed,true);assert.equal(input.files[0].name,'Merged loot filter.xml');assert.match(p.$('status').textContent,/submitted/);p.w.close();
});
test('userscript metadata has scoped access and no remote dependencies',()=>{
  assert.match(bundle,/@match\s+https:\/\/www\.lastepochtools\.com\/loot-filters\/\*/);
  assert.doesNotMatch(bundle,/@require|@connect|GM_xmlhttpRequest|clipboardRead/);
});
