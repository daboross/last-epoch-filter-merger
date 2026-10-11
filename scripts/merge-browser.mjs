// Drive the actual packaged extension workbench with XML files. No manual XML edits.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import '../extension/core.js';
const [a,b,name,out]=process.argv.slice(2);
if(!a||!b||!name||!out)throw Error('Usage: node scripts/merge-browser.mjs A.xml B.xml "New filter name" result.xml');
const output=path.resolve(out);if(fs.existsSync(output)||fs.existsSync(output+'.report.json'))throw Error('Output already exists; choose a new filename.');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),extension=path.join(root,'dist/chromium');
const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'le-merge-browser-')),{executablePath:process.env.MERGER_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try {
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:10000});
  const page=await context.newPage();await page.goto(`chrome-extension://${new URL(worker.url()).host}/index.html`);
  await page.locator('#fileA').setInputFiles(path.resolve(a));await page.locator('#summaryA').filter({hasText:'rules'}).waitFor();
  await page.locator('#fileB').setInputFiles(path.resolve(b));await page.locator('#summaryB').filter({hasText:'rules'}).waitFor();
  await page.locator('#name').fill(name);await page.locator('#merge').click();await page.locator('#result').waitFor({state:'visible'});
  const report=JSON.parse(await page.locator('#preview').textContent());
  const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadPromise;
  const xml=fs.readFileSync(await download.path(),'utf8');
  const expected=LEMerge.merge(fs.readFileSync(a,'utf8'),fs.readFileSync(b,'utf8'),{DOMParser,XMLSerializer,name});
  assert.deepEqual(report,expected.report);
  const parsed=LEMerge.parse(xml,{DOMParser});assert.equal(parsed.rules.length,report.count);
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,xml,{flag:'wx'});fs.writeFileSync(output+'.report.json',JSON.stringify(report,null,2),{flag:'wx'});
  await page.screenshot({path:output+'.workbench.png',fullPage:true});
  console.log(JSON.stringify({output,count:report.count,sources:report.sources,warnings:report.warnings},null,2));
}finally{await context.close();}
