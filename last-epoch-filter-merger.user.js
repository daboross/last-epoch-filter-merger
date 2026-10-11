// ==UserScript==
// @name         Last Epoch Filter Merger
// @namespace    https://github.com/daboross/last-epoch-filter-merger
// @version      1.0.0
// @description  Merge two loot filters without changing colors; automatically defer qualifying hide blocks.
// @match        https://www.lastepochtools.com/loot-filters/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/daboross/last-epoch-filter-merger/main/last-epoch-filter-merger.user.js
// @updateURL    https://raw.githubusercontent.com/daboross/last-epoch-filter-merger/main/last-epoch-filter-merger.user.js
// @run-at       document-idle
// @noframes
// @license      MIT
// ==/UserScript==

(function(){
(function (scope) {
  'use strict';
  const children = (node, name) => Array.from(node.childNodes || []).filter(n => n.nodeType === 1 && (!name || n.nodeName === name));
  const child = (node, name) => children(node, name)[0];
  const value = (node, name) => child(node, name)?.textContent.trim() ?? '';
  function set(node, name, text) {
    let field = child(node, name);
    if (!field) { field = node.ownerDocument.createElement(name); node.appendChild(field); }
    field.textContent = String(text);
  }
  function parse(xml, { DOMParser = scope.DOMParser, legacyOrder = 'reverse' } = {}) {
    if (typeof xml !== 'string' || xml.length > 10_000_000) throw Error('Expected XML text smaller than 10 MB.');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error('DTD and entity declarations are unsupported.');
    const errors = [];
    const doc = new DOMParser({ errorHandler: { warning: e => errors.push(e), error: e => errors.push(e), fatalError: e => errors.push(e) } }).parseFromString(xml.replace(/^\uFEFF/, ''), 'application/xml');
    if (errors.length || doc.getElementsByTagName('parsererror').length || doc.documentElement?.nodeName !== 'ItemFilter') throw Error('Invalid ItemFilter XML.');
    const root = doc.documentElement;
    if (children(root, 'rules').length !== 1) throw Error('Expected exactly one rules container.');
    const container = child(root, 'rules');
    const nodes = children(container);
    if (nodes.some(n => n.nodeName !== 'Rule')) throw Error('Unsupported element in rules container.');
    let rules = nodes.map((node, index) => {
      const type = value(node, 'type');
      if (!['SHOW', 'HIDE', 'RECOLOR'].includes(type)) throw Error(`Unsupported rule action: ${type || '(missing)'}.`);
      if (children(node, 'conditions').length !== 1) throw Error('Each rule must have one conditions container.');
      if (!['true', 'false'].includes(value(node, 'isEnabled'))) throw Error('Each rule must declare isEnabled true or false.');
      return { node, index, type, order: value(node, 'Order') };
    });
    const hasOrder = rules.filter(r => r.order !== '').length;
    if (hasOrder && hasOrder !== rules.length) throw Error('Mixed missing/present Order fields; cannot infer priority.');
    if (hasOrder) {
      if (rules.some(r => !/^\d+$/.test(r.order) || !Number.isSafeInteger(Number(r.order))) || new Set(rules.map(r => Number(r.order))).size !== rules.length) throw Error('Order fields must be distinct non-negative integers.');
      rules.sort((a, b) => Number(a.order) - Number(b.order));
    } else if (legacyOrder === 'reverse') rules.reverse();
    else if (legacyOrder !== 'document') throw Error('legacyOrder must be reverse or document.');
    return { doc, root, rules, name: value(root, 'name'), gameVersion: value(root, 'lastModifiedInVersion'), schemaVersion: value(root, 'lootFilterVersion'), orderSource: hasOrder ? 'Order ascending' : `legacy ${legacyOrder}` };
  }
  function compareVersions(a, b) {
    const aa = a.split('.').map(Number), bb = b.split('.').map(Number);
    if ([...aa, ...bb].some(n => !Number.isFinite(n))) return 0;
    for (let i = 0; i < Math.max(aa.length, bb.length); i++) if ((aa[i] || 0) !== (bb[i] || 0)) return (aa[i] || 0) - (bb[i] || 0);
    return 0;
  }
  function merge(aXml, bXml, options = {}) {
    const { name = 'Merged filter', mode = 'smart-tail', maxRules = 200, DOMParser = scope.DOMParser, XMLSerializer = scope.XMLSerializer } = options;
    if (!name.trim()) throw Error('Provide a non-empty filter name.');
    if (!['smart-tail', 'concat'].includes(mode)) throw Error('Unknown merge mode.');
    if (!Number.isInteger(maxRules) || maxRules < 1 || maxRules > 200) throw Error('maxRules must be 1–200.');
    const sources = [parse(aXml, options), parse(bXml, options)];
    const body = [], tail = [], deferred = [];
    sources.forEach((source, sourceIndex) => {
      const firstHide = source.rules.findIndex(r => r.type === 'HIDE');
      const qualifying = firstHide >= 0 && source.rules.slice(0, firstHide).every(r => r.type !== 'HIDE') && source.rules.slice(firstHide).every(r => r.type === 'HIDE');
      const split = mode === 'smart-tail' && qualifying ? firstHide : source.rules.length;
      source.rules.forEach((rule, i) => (i < split ? body : tail).push({ ...rule, source: sourceIndex, sourcePriority: i + 1 }));
      deferred.push(source.rules.length - split);
    });
    const rules = [...body, ...tail];
    if (rules.length > maxRules) throw Error(`Merged filter has ${rules.length} rules; limit is ${maxRules}. No rules were dropped. Choose smaller filters.`);
    const output = sources[0].doc.cloneNode(true), root = output.documentElement, container = child(root, 'rules');
    while (container.firstChild) container.removeChild(container.firstChild);
    // The game's XML is bottom-to-top; Order=0 is highest priority.
    for (let i = rules.length - 1; i >= 0; i--) {
      const node = output.importNode(rules[i].node, true);
      // Carry namespace declarations inherited from the source root.
      for (const attr of Array.from(sources[rules[i].source].root.attributes || [])) if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) node.setAttribute(attr.name, attr.value);
      set(node, 'Order', i);
      container.appendChild(node);
    }
    set(root, 'name', name.trim());
    const newer = compareVersions(sources[1].gameVersion, sources[0].gameVersion) > 0 ? sources[1] : sources[0];
    if (newer.gameVersion) set(root, 'lastModifiedInVersion', newer.gameVersion);
    if (sources.every(s => /^\d+$/.test(s.schemaVersion))) set(root, 'lootFilterVersion', Math.max(...sources.map(s => Number(s.schemaVersion))));
    const warnings = [];
    if (deferred.some(n => n)) warnings.push('Trailing hide blocks moved after both source bodies as requested; visibility can change.');
    if (rules.some((r, i) => r.type === 'HIDE' && i < rules.length - 1 && value(r.node, 'isEnabled') === 'true' && children(child(r.node, 'conditions')).length === 0)) warnings.push('An enabled unconditional hide can make subsequent rules unreachable.');
    if (sources.some(s => s.orderSource.startsWith('legacy'))) warnings.push('Legacy source without Order interpreted using legacyOrder; confirm priority in the game.');
    if (sources[0].schemaVersion !== sources[1].schemaVersion) warnings.push('Different schema versions: preserved rule payloads and used the higher numeric version; import validation still required.');
    const report = { name: name.trim(), mode, count: rules.length, gameVersion: value(root, 'lastModifiedInVersion'), schemaVersion: value(root, 'lootFilterVersion'), sources: sources.map((s, i) => ({ name: s.name, count: s.rules.length, orderSource: s.orderSource, deferredHides: deferred[i] })), warnings, rules: rules.map((r, i) => ({ priority: i + 1, source: r.source === 0 ? 'A' : 'B', sourcePriority: r.sourcePriority, type: r.type, enabled: value(r.node, 'isEnabled'), name: value(r.node, 'nameOverride') })) };
    const xml = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(output);
    parse(xml, { DOMParser });
    return { xml, report };
  }
  scope.LEMerge = { parse, merge, value, children };
})(globalThis);

(function(scope) {
  'use strict';
  function findText(doc, text) {
    return Array.from(doc.querySelectorAll('a,button,div,span')).find(e => e.textContent.trim() === text && !Array.from(e.children).some(c => c.textContent.trim() === text) && !e.closest('#le-merger') && e.getClientRects().length);
  }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function waitFor(fn, timeout = 4000) {
    const end = Date.now() + timeout;
    do { const result = fn(); if (result) return result; await delay(75); } while (Date.now() < end);
    throw Error('Site control not found. Refresh the filter page or use XML files instead.');
  }
  async function capture(doc = document) {
    if (!/\/loot-filters\/view\//.test(doc.location.pathname)) throw Error('Open a saved filter view page first.');
    let resolveXml;
    const pending = new Promise(resolve => { resolveXml = resolve; });
    function inspect(text) { if (typeof text === 'string' && text.length < 10_000_000 && /<ItemFilter[\s>]/.test(text)) resolveXml(text); }
    function inspectNode(node) {
      if (node.nodeType !== 1) return;
      if (node.matches('textarea,input')) inspect(node.value);
      for (const e of node.querySelectorAll('textarea,input')) inspect(e.value);
    }
    const observer = new scope.MutationObserver(records => records.forEach(record => [...record.addedNodes,...record.removedNodes].forEach(inspectNode)));
    const copyListener = () => { inspect(doc.activeElement?.value); inspect(doc.getSelection()?.toString()); };
    observer.observe(doc.body, {childList:true,subtree:true});
    doc.addEventListener('copy',copyListener,true);
    let timer;
    try {
      if (!findText(doc,'Copy To Clipboard')) (await waitFor(() => findText(doc,'Export'))).click();
      (await waitFor(() => findText(doc,'Copy To Clipboard'))).click();
      return await Promise.race([pending, new Promise((_,reject) => {timer=setTimeout(() => reject(Error('Could not capture this export. Use Save To File, then load the XML here, or paste the copied XML.')),5000);})]);
    } finally { clearTimeout(timer); observer.disconnect(); doc.removeEventListener('copy',copyListener,true); }
  }
  async function stage(xml, filename, doc = document) {
    const parsed = new scope.DOMParser().parseFromString(xml,'application/xml');
    if (parsed.querySelector('parsererror') || parsed.documentElement.nodeName !== 'ItemFilter') throw Error('Invalid merged XML.');
    if (Array.from(doc.querySelectorAll('a')).some(a => a.textContent.trim() === 'Log In' && a.getClientRects().length)) throw Error('Log in to Last Epoch Tools first, then retry.');
    const input = doc.querySelector('#loot-filter-import');
    if (!input || input.type !== 'file') throw Error('Site import control changed. Download XML and use Create Loot Filter → Import From File.');
    const transfer = new scope.DataTransfer();
    transfer.items.add(new scope.File([xml],filename,{type:'application/xml'}));
    input.files = transfer.files;
    input.dispatchEvent(new scope.Event('change',{bubbles:true}));
    return {status:'submitted',message:'XML submitted to Last Epoch Tools. The site normally creates a new private filter immediately. Check the selected tab for the new filter, rule count and privacy setting; this message alone does not confirm creation.'};
  }
  scope.LESite = {capture,stage,findText};
})(globalThis);

(function () {
  'use strict';
  if (document.getElementById('le-merger')) return;
  const host = document.createElement('div'); host.id = 'le-merger';
  document.body.append(host);
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>
    :host{all:initial;font:15px system-ui;color:#eee}button,input,textarea,select{font:inherit}button{cursor:pointer;padding:8px;margin:4px}input,textarea,select{background:#fff;color:#111;padding:6px;box-sizing:border-box}#launcher{position:fixed;right:18px;bottom:18px;z-index:2147483646;background:#253b44;color:white;border:1px solid #aaa;border-radius:8px}#panel{position:fixed;inset:5vh max(3vw,calc((100vw - 950px)/2));overflow:auto;background:#20252b;padding:20px;border:1px solid #aaa;border-radius:8px;z-index:2147483647;box-shadow:0 0 0 100vmax #0009}#panel[hidden],#result[hidden]{display:none}.sources{display:flex;gap:16px;flex-wrap:wrap}.slot{flex:1;min-width:240px}textarea{width:100%;height:100px}input[type=text]{width:100%}label{display:block;margin:8px 0}#status{white-space:pre-wrap}pre{white-space:pre-wrap;max-height:220px;overflow:auto}small{display:block}h2{margin-top:0}
  </style><button id="launcher">Merge filters</button><section id="panel" hidden role="dialog" aria-label="Merge Last Epoch filters"><button id="close" style="float:right">Close</button><h2>Merge Last Epoch filters</h2><p>Capture A on its filter page, then visit B and capture B. Sources stay in Tampermonkey storage. You can also load XML files or paste exports.</p><div class="sources">${['A','B'].map(s=>`<div class="slot"><h3>Filter ${s}</h3><button id="capture${s}">Use current page as ${s}</button><label>XML file <input id="file${s}" type="file" accept=".xml,text/xml,application/xml"></label><label>XML export<textarea id="xml${s}" spellcheck="false"></textarea></label><small id="summary${s}"></small></div>`).join('')}</div><label>New filter name<input id="name" type="text" value="Merged loot filter"></label><label>Rule ordering <select id="mode"><option value="smart-tail">A then B; move qualifying trailing hides to the end</option><option value="concat">A then B, without moving hides</option></select></label><button id="merge">Merge</button><p id="status" role="status"></p><div id="result" hidden><h3 id="count"></h3><button id="download">Download XML</button><button id="report">Download report</button><button id="import">Import as a new private filter</button><p>Import submits the XML to this page's import control. Last Epoch Tools normally creates a new private filter immediately.</p><pre id="preview"></pre></div></section>`;
  const hiddenStyle=document.createElement('style'); hiddenStyle.textContent=':host([hidden]){display:none}'; root.append(hiddenStyle);
  const $ = id => root.getElementById(id);
  let merged;
  const message = text => { $('status').textContent = text; };
  const invalidate = () => { merged = undefined; $('result').hidden = true; };
  async function save(slot) { await GM_setValue('source'+slot,$('xml'+slot).value); }
  function summary(slot) {
    try { const p=LEMerge.parse($('xml'+slot).value); $('summary'+slot).textContent=`${p.name}: ${p.rules.length} rules`; }
    catch { $('summary'+slot).textContent=$('xml'+slot).value ? 'Not a valid ItemFilter XML export yet.' : 'No source selected.'; }
  }
  async function open() {
    for (const slot of ['A','B']) { $('xml'+slot).value=await GM_getValue('source'+slot,''); summary(slot); }
    invalidate(); $('panel').hidden=false;
  }
  $('launcher').onclick=open; $('close').onclick=()=>{ $('panel').hidden=true; };
  for (const slot of ['A','B']) {
    $('xml'+slot).oninput=()=>{ invalidate(); summary(slot); save(slot).catch(e=>message(e.message)); };
    $('file'+slot).onchange=async()=>{
      invalidate(); try { const file=$('file'+slot).files[0]; if (!file) return;
        if(file.size>10_000_000) throw Error('Filter exceeds the 10 MB size limit.');
        const xml=await file.text(); LEMerge.parse(xml); $('xml'+slot).value=xml; summary(slot); await save(slot);
      } catch(e) { message(e.message); }
    };
    $('capture'+slot).onclick=async()=>{
      invalidate(); host.hidden=true;
      try { const xml=await LESite.capture(document); LEMerge.parse(xml); $('xml'+slot).value=xml; summary(slot); await save(slot); message('Captured filter '+slot+'.'); }
      catch(e) { message(e.message); }
      finally { host.hidden=false; }
    };
  }
  $('name').oninput=invalidate; $('mode').onchange=invalidate;
  $('merge').onclick=()=>{
    invalidate(); try {
      merged=LEMerge.merge($('xmlA').value,$('xmlB').value,{name:$('name').value,mode:$('mode').value});
      $('count').textContent=`${merged.report.count}/200 rules`;
      $('preview').textContent=JSON.stringify(merged.report,null,2); $('result').hidden=false;
      message('Merged. Rule conditions, colors and styles are preserved.');
    } catch(e) { message(e.message); }
  };
  function download(text, filename, type) {
    const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const filename=()=>($('name').value.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim() || 'Merged loot filter');
  $('download').onclick=()=>{ if(merged)download(merged.xml,filename()+'.xml','application/xml'); };
  $('report').onclick=()=>{ if(merged)download(JSON.stringify(merged.report,null,2),filename()+'.json','application/json'); };
  $('import').onclick=async()=>{
    if(!merged)return; $('import').disabled=true;
    try { message((await LESite.stage(merged.xml,filename()+'.xml',document)).message); }
    catch(e) { message(e.message); }
    finally { $('import').disabled=false; }
  };
  GM_registerMenuCommand('Merge Last Epoch filters',open);
})();

})();
