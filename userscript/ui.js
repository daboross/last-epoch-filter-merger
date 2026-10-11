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
