import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import '../extension/core.js';
const dir=process.argv[2] || path.join(os.homedir(),'AppData/LocalLow/Eleventh Hour Games/Last Epoch/Filters');
const files=fs.readdirSync(dir).filter(f=>/\.xml$/i.test(f));const options={DOMParser,XMLSerializer};
let pairs=0;
for(const a of files) for(const b of files) {
 const aa=fs.readFileSync(path.join(dir,a),'utf8'),bb=fs.readFileSync(path.join(dir,b),'utf8');
 const sources=[LEMerge.parse(aa,options),LEMerge.parse(bb,options)];
 const result=LEMerge.merge(aa,bb,{...options,name:'Local compatibility test'});
 const parsed=LEMerge.parse(result.xml,options);
 assert.equal(parsed.rules.length,sources.reduce((n,s)=>n+s.rules.length,0));
 result.report.rules.forEach((r,i)=>{
   const before=sources[r.source==='A'?0:1].rules[r.sourcePriority-1].node;
   const after=parsed.rules[i].node;
   for(const field of ['type','recolor','color','emphasized','SoundId','MapIconId','BeamOverride','BeamSizeOverride','BeamColorOverride','isEnabled','nameOverride'])assert.equal(LEMerge.value(after,field),LEMerge.value(before,field));
   const canonical=n=>{if(n.nodeType===3)return n.textContent.trim();if(n.nodeType!==1)return '';return [n.namespaceURI,n.localName,Array.from(n.attributes).filter(a=>!a.name.startsWith('xmlns')).map(a=>[a.namespaceURI,a.localName,a.value]).sort(),Array.from(n.childNodes).map(canonical).filter(Boolean)];};
   assert.deepEqual(canonical(LEMerge.children(after,'conditions')[0]),canonical(LEMerge.children(before,'conditions')[0]));
 });pairs++;
}
console.log(`PASS: ${files.length} live local filters, ${pairs} ordered pairs; counts, all condition payloads, colors, sounds, beams, icons and enabled state preserved. Originals only read.`);
