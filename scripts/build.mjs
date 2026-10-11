import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const raw='https://raw.githubusercontent.com/daboross/last-epoch-filter-merger/main/last-epoch-filter-merger.user.js';
const header=`// ==UserScript==
// @name         Last Epoch Filter Merger
// @namespace    https://github.com/daboross/last-epoch-filter-merger
// @version      1.0.0
// @description  Merge two loot filters without changing colors; automatically defer qualifying hide blocks.
// @match        https://www.lastepochtools.com/loot-filters/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @downloadURL  ${raw}
// @updateURL    ${raw}
// @run-at       document-idle
// @noframes
// @license      MIT
// ==/UserScript==\n`;
const sources=['extension/core.js','extension/site-adapter.js','userscript/ui.js'];
fs.writeFileSync(path.join(root,'last-epoch-filter-merger.user.js'),header+'\n(function(){\n'+sources.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n')+'\n})();\n');
for(const target of ['firefox','chromium']) {
  const out=path.join(root,'dist',target);fs.mkdirSync(out,{recursive:true});
  for(const file of fs.readdirSync(path.join(root,'extension')))fs.copyFileSync(path.join(root,'extension',file),path.join(out,file));
  if(target==='chromium') {
    const file=path.join(out,'manifest.json'),m=JSON.parse(fs.readFileSync(file,'utf8'));
    m.manifest_version=3;m.action=m.browser_action;delete m.browser_action;
    m.background={service_worker:'background.js'};m.host_permissions=m.permissions.filter(p=>p.startsWith('https:'));m.permissions=m.permissions.filter(p=>!p.startsWith('https:'));delete m.browser_specific_settings;
    fs.writeFileSync(file,JSON.stringify(m,null,2));
  }
}
console.log('Built installable userscript and optional development browser packages.');
