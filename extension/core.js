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
      const qualifying = firstHide > 0 && source.rules.slice(0, firstHide).every(r => r.type !== 'HIDE') && source.rules.slice(firstHide).every(r => r.type === 'HIDE');
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
    if (sources.some(s => s.rules.some((r, i) => r.type === 'HIDE' && i < s.rules.length - 1 && value(r.node, 'isEnabled') === 'true' && children(child(r.node, 'conditions')).length === 0))) warnings.push('An enabled unconditional hide can make subsequent rules unreachable.');
    if (sources.some(s => s.orderSource.startsWith('legacy'))) warnings.push('Legacy source without Order interpreted using legacyOrder; confirm priority in the game.');
    if (sources[0].schemaVersion !== sources[1].schemaVersion) warnings.push('Different schema versions: preserved rule payloads and used the higher numeric version; import validation still required.');
    const report = { name: name.trim(), mode, count: rules.length, gameVersion: value(root, 'lastModifiedInVersion'), schemaVersion: value(root, 'lootFilterVersion'), sources: sources.map((s, i) => ({ name: s.name, count: s.rules.length, orderSource: s.orderSource, deferredHides: deferred[i] })), warnings, rules: rules.map((r, i) => ({ priority: i + 1, source: r.source === 0 ? 'A' : 'B', sourcePriority: r.sourcePriority, type: r.type, enabled: value(r.node, 'isEnabled'), name: value(r.node, 'nameOverride') })) };
    const xml = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(output);
    parse(xml, { DOMParser });
    return { xml, report };
  }
  scope.LEMerge = { parse, merge, value, children };
})(globalThis);
