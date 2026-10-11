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
    return {status:'staged',message:'XML supplied to the site import flow. Review its rule order, choose Private, and finish the site’s Save/Create step. This does not confirm a saved filter.'};
  }
  scope.LESite = {capture,stage,findText};
})(globalThis);
