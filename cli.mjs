#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import './extension/core.js';
const defaultDir = path.join(os.homedir(), 'AppData', 'LocalLow', 'Eleventh Hour Games', 'Last Epoch', 'Filters');
const args = process.argv.slice(2), command = args.shift();
const usage = `Last Epoch filter merger (Node 18+)\n  node cli.mjs list [--dir PATH]\n  node cli.mjs merge A.xml B.xml --name "Merged" --out result.xml [--mode smart-tail|concat] [--install] [--dir PATH] [--legacy-order reverse|document]\nNames without a path are resolved in the local game Filters directory.\nsmart-tail follows the requested per-source trailing-hide exception; colors and duplicate rules are kept.\n--install creates a NEW file in Filters; existing files are never overwritten.\nA JSON report is written beside the XML.`;
try {
  const opts = {}, positional = [];
  while (args.length) { const arg = args.shift(); if (arg === '--install') opts.install = true; else if (arg.startsWith('--')) { if (!['--dir','--name','--out','--mode','--legacy-order'].includes(arg) || !args.length || args[0].startsWith('--')) throw Error(`Invalid option ${arg}`); opts[arg.slice(2)] = args.shift(); } else positional.push(arg); }
  const dir = path.resolve(opts.dir || defaultDir);
  if (command === 'list') {
    const entries = fs.readdirSync(dir).filter(f => /\.xml$/i.test(f)).map(file => { try { const f = LEMerge.parse(fs.readFileSync(path.join(dir, file), 'utf8'), { DOMParser }); return { file, name:f.name, rules:f.rules.length, gameVersion:f.gameVersion, schema:f.schemaVersion }; } catch(e) { return {file,error:e.message}; } });
    console.log(JSON.stringify({directory:dir, filters:entries}, null, 2));
  } else if (command === 'merge') {
    if (positional.length !== 2 || !opts.out || !opts.name) throw Error(usage);
    const resolveInput = f => path.resolve(fs.existsSync(f) ? f : path.join(dir, f));
    const inputs = positional.map(resolveInput);
    const { xml, report } = LEMerge.merge(...inputs.map(f => fs.readFileSync(f,'utf8')), { DOMParser, XMLSerializer, name:opts.name, mode:opts.mode || 'smart-tail', legacyOrder:opts['legacy-order'] || 'reverse' });
    const out = path.resolve(opts.out), reportPath = out + '.report.json';
    const targets = [out,reportPath];
    let install;
    if (opts.install) { const filename = opts.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,''); if (!filename || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(filename)) throw Error('Choose a different filter name for installation.'); install=path.join(dir,filename+'.xml'); if (install!==out) targets.push(install); }
    for (const target of targets) if (fs.existsSync(target) || inputs.includes(target)) throw Error(`Refusing to overwrite ${target}`);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,xml,{flag:'wx'}); fs.writeFileSync(reportPath,JSON.stringify(report,null,2),{flag:'wx'});
    if (install && install!==out) { fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(install,xml,{flag:'wx'}); }
    console.log(JSON.stringify({output:out,report:reportPath,installed:install,count:report.count,warnings:report.warnings},null,2));
  } else console.log(usage);
} catch (e) { console.error(e.message); process.exitCode = 1; }
