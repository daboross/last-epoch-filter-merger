'use strict';
const api = globalThis.browser || globalThis.chrome;
const $ = id => document.getElementById(id);
let merged;
function status(text) { $('status').textContent = text; }
function invalidate() { merged = undefined; $('result').hidden = true; }
function summarize(slot) {
  try { const f = LEMerge.parse($('xml'+slot).value); $('summary'+slot).textContent=`${f.name || 'Unnamed'} · ${f.rules.length} rules · game ${f.gameVersion} · schema ${f.schemaVersion}`; }
  catch(e) { $('summary'+slot).textContent=e.message; }
}
function apiCall(fn,...args) {
  if (globalThis.browser) return fn(...args);
  return new Promise((resolve,reject) => fn(...args,result => {const error=chrome.runtime.lastError;error?reject(Error(error.message)):resolve(result);}));
}
async function loadTabs() {
  const selected=$('siteTab').value;
  const tabs = await apiCall(api.tabs.query.bind(api.tabs),{url:'https://www.lastepochtools.com/loot-filters/*'});
  $('siteTab').replaceChildren(...tabs.map(tab=>{const option=document.createElement('option');option.value=tab.id;option.textContent=tab.title || tab.url;return option;}));
  if (tabs.some(tab => String(tab.id)===selected)) $('siteTab').value=selected;
}
async function send(message) {
  if (!$('siteTab').value) throw Error('Open a Last Epoch Tools filter tab and refresh the tab list.');
  const id=Number($('siteTab').value);
  const result=await apiCall(api.tabs.sendMessage.bind(api.tabs),id,message);
  if (result.error) throw Error(result.error);
  return result.result;
}
async function attempt(operation) {
  const buttons=Array.from(document.querySelectorAll('button'));buttons.forEach(button=>button.disabled=true);
  try {await operation();} catch(e) {status(e.message);} finally {buttons.forEach(button=>button.disabled=false);}
}
for(const slot of ['A','B']) {
  $('file'+slot).addEventListener('change',()=>attempt(async()=>{invalidate();const file=$('file'+slot).files[0];if(!file)return;if(file.size>10_000_000)throw Error('File exceeds 10 MB.');$('xml'+slot).value=await file.text();summarize(slot);status('Loaded filter '+slot);}));
  $('xml'+slot).addEventListener('input',()=>{invalidate();summarize(slot);});
  $('capture'+slot).addEventListener('click',()=>attempt(async()=>{status('Capturing site export…');const xml=await send({kind:'capture'});LEMerge.parse(xml);invalidate();$('xml'+slot).value=xml;summarize(slot);await apiCall(api.storage.local.set.bind(api.storage.local),{['xml'+slot]:xml});status('Captured filter '+slot);}));
}
for(const id of ['name','mode']) $(id).addEventListener('input',invalidate);
$('merge').addEventListener('click',()=>attempt(async()=>{invalidate();merged=LEMerge.merge($('xmlA').value,$('xmlB').value,{name:$('name').value,mode:$('mode').value});$('result').hidden=false;$('resultTitle').textContent=`${merged.report.name} · ${merged.report.count}/200 rules`;$('warnings').textContent=merged.report.warnings.join(' ');$('preview').textContent=JSON.stringify(merged.report,null,2);status('Merged. All rule payloads preserved; only priority and filter metadata changed.');}));
function download(text,filename,type) {const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const filename=()=>merged.report.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'.xml';
$('download').addEventListener('click',()=>download(merged.xml,filename(),'application/xml'));
$('report').addEventListener('click',()=>download(JSON.stringify(merged.report,null,2),filename()+'.report.json','application/json'));
$('refresh').addEventListener('click',()=>attempt(loadTabs));
$('stage').addEventListener('click',()=>attempt(async()=>{const result=await send({kind:'stage',xml:merged.xml,filename:filename()});status(result.message);await apiCall(api.tabs.update.bind(api.tabs),Number($('siteTab').value),{active:true});}));
if (!api?.runtime?.id) document.querySelectorAll('.site').forEach(e=>e.hidden=true);
else attempt(async()=>{const saved=await apiCall(api.storage.local.get.bind(api.storage.local),['xmlA','xmlB']);for(const slot of ['A','B'])if(saved['xml'+slot]){$('xml'+slot).value=saved['xml'+slot];summarize(slot);}await loadTabs();});
