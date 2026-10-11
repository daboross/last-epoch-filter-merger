import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import '../extension/core.js';
const [input,exported]=process.argv.slice(2);if(!input||!exported)throw Error('Usage: node scripts/check-roundtrip.mjs input.xml exported.xml');
const a=LEMerge.parse(fs.readFileSync(input,'utf8'),{DOMParser}),b=LEMerge.parse(fs.readFileSync(exported,'utf8'),{DOMParser});
assert.equal(a.name,b.name,'Export name must match to prevent testing a stale clipboard.');assert.equal(a.rules.length,b.rules.length);
const canonical=n=>{if(n.nodeType===3)return n.textContent.trim();if(n.nodeType!==1)return '';return [n.namespaceURI,n.localName,Array.from(n.attributes).filter(a=>!a.name.startsWith('xmlns')).map(a=>[a.namespaceURI,a.localName,a.value]).sort(),Array.from(n.childNodes).map(canonical).filter(Boolean)];};
for(let i=0;i<a.rules.length;i++) {
  for(const field of ['type','recolor','color','emphasized','SoundId','MapIconId','BeamOverride','BeamSizeOverride','BeamColorOverride','isEnabled','nameOverride'])assert.equal(LEMerge.value(a.rules[i].node,field),LEMerge.value(b.rules[i].node,field),`priority ${i+1}: ${field}`);
  assert.deepEqual(canonical(LEMerge.children(a.rules[i].node,'conditions')[0]),canonical(LEMerge.children(b.rules[i].node,'conditions')[0]),`priority ${i+1}: conditions`);
}
console.log(`PASS: ${a.rules.length} rules in live XML round trip; same name, order, all condition payloads and all styling fields.`);
